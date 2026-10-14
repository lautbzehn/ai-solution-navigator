import Anthropic from '@anthropic-ai/sdk'
import type { AdvisorAnswer, AdvisorContext, AdvisorStatus } from '../src/ai/types'
import { budgetFrom, costOf, LIMITS, MemoryGuard, type AdvisorGuard } from './guard'

/* Server-side AI advisor.
   The API key stays on the server. Live mode is opt-in: it runs only when
   ANTHROPIC_API_KEY is set in the server environment, so a fresh checkout
   never incurs API charges. Because the endpoint is public, every call is
   checked before it reaches the model: it must come from the app's own pages,
   stay under a size cap, and pass the per-visitor rate limit and the daily
   spend cap (see guard.ts). Every call is logged with tokens, cost, and
   latency. Shared by the Vite dev middleware and the Cloudflare Worker. */

/** Server configuration. Node (Vite dev) reads process.env; the Cloudflare Worker passes its env bindings. */
export interface AdvisorEnv {
  ANTHROPIC_API_KEY?: string
  ADVISOR_MODEL?: string
  /** Site-wide daily spend cap in USD (default 5). */
  ADVISOR_DAILY_BUDGET_USD?: string
  /** Extra comma-separated origins allowed to call the advisor (the live site and localhost always are). */
  ADVISOR_ALLOWED_ORIGINS?: string
}

/** Who is calling, as the transport layer (Worker or dev server) sees it. */
export interface RequestMeta {
  origin?: string | null
  /** The app's own fetches send `X-Navigator-Client: web`. */
  clientHeader?: string | null
  /** Anonymous visitor id for rate limiting (a hash, never a raw IP). */
  clientId?: string
  /** Size of the raw request body in bytes. */
  bodyBytes?: number
}

/** The slice of the SDK this handler uses, so tests can pass a stand-in. */
type MessagesClient = { beta: { messages: { create: Anthropic['beta']['messages']['create'] } } }

export interface AdvisorDeps {
  guard?: AdvisorGuard
  meta?: RequestMeta
  createClient?: (apiKey: string) => MessagesClient
  log?: (line: Record<string, unknown>) => void
  now?: () => number
}

/** Requests larger than this are refused before they are parsed or sent anywhere. */
export const MAX_BODY_BYTES = 64 * 1024
export const TOO_LARGE = 'That request is too large for the advisor. Try asking about one solution at a time.'
export const LIVE_ORIGINS = ['https://navigator.icarianforge.com', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173']
export const CLIENT_HEADER = 'x-navigator-client'

// Local development shares one in-memory guard per process.
let devGuard: MemoryGuard | undefined
const defaultGuard = (env: AdvisorEnv) => (devGuard ??= new MemoryGuard(budgetFrom(env.ADVISOR_DAILY_BUDGET_USD)))
const defaultLog = (line: Record<string, unknown>) => console.log(JSON.stringify(line))
const nodeEnv = (): AdvisorEnv => (typeof process !== 'undefined' ? process.env : {})
const model = (env: AdvisorEnv) => env.ADVISOR_MODEL || 'claude-opus-5-5'

const SYSTEM_PROMPT = `You are an AI implementation advisor supporting a Lead Product Manager.

Your role is to help the PM successfully move an AI solution through an enterprise implementation lifecycle (Discover, Assess, Design, Build, Validate, Deploy, Operate, Improve/Retire). Each stage ends in a gate where a named person decides. Governance is continuous across the lifecycle, and higher-risk solutions require more evidence and stronger gate criteria.

You receive a JSON snapshot of the solution (or of the whole portfolio) and the PM's question. Base every statement on that snapshot.

You should:
- Analyze the current state
- Identify gaps
- Prioritize the most important next action
- Explain why it matters
- Identify the appropriate owner, by name and role from the snapshot
- Identify blocking issues
- Recommend evidence
- Highlight risks
- Prepare the PM for upcoming gate reviews

You should not:
- Pretend to approve a solution
- Override governance requirements
- Invent completed evidence, activities, people, or numbers that are not in the snapshot
- Claim a solution is safe
- Make legal determinations
- Make security approvals
- Change lifecycle state autonomously; humans record every gate decision

Remember that implementation readiness measures how ready the overall implementation is to move forward. It is not a measure of AI safety or model quality alone. A completed activity whose evidence is not approved does not satisfy a gate.

Write for a busy PM: concise, specific, and actionable. Keep the summary to two or three sentences. Return at most five recommendations, ordered by priority. When a recommendation maps to an activity in the snapshot, set activityId to that activity's id; otherwise set it to null. Use empty arrays when a section doesn't apply, and an empty string for gateOutlook when no gate is relevant.`

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          owner: { type: 'string' },
          impact: { type: 'string' },
          blocking: { type: 'boolean' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          activityId: { type: ['string', 'null'] },
        },
        required: ['title', 'why', 'owner', 'impact', 'blocking', 'priority', 'activityId'],
        additionalProperties: false,
      },
    },
    risksToDiscuss: { type: 'array', items: { type: 'string' } },
    questionsForStakeholders: {
      type: 'array',
      items: {
        type: 'object',
        properties: { who: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } } },
        required: ['who', 'questions'],
        additionalProperties: false,
      },
    },
    gateOutlook: { type: 'string' },
  },
  required: ['summary', 'recommendations', 'risksToDiscuss', 'questionsForStakeholders', 'gateOutlook'],
  additionalProperties: false,
} as const

export interface AdvisorRequestBody {
  question: string
  context: AdvisorContext
  history?: { question: string; summary: string }[]
}

export interface HandlerResult {
  status: number
  body: unknown
  headers?: Record<string, string>
}

const UNAVAILABLE = 'The AI advisor is temporarily unavailable. You can continue managing the implementation manually.'

export async function advisorStatus(env: AdvisorEnv = nodeEnv(), guard?: AdvisorGuard): Promise<AdvisorStatus> {
  if (!env.ANTHROPIC_API_KEY) return { live: false }
  const usage = await (guard ?? defaultGuard(env)).usage().catch(() => undefined)
  return { live: true, model: model(env), budget: usage && { dailyUsd: usage.budgetUsd, spentTodayUsd: Math.round(usage.spentUsd * 100) / 100 }, limits: { perMinute: LIMITS.perMinute, perDay: LIMITS.perDay } }
}

const allowedOrigins = (env: AdvisorEnv) => [...LIVE_ORIGINS, ...(env.ADVISOR_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)]

export async function handleAdvisor(method: string, body: unknown, env: AdvisorEnv = nodeEnv(), deps: AdvisorDeps = {}): Promise<HandlerResult> {
  const guard = deps.guard ?? defaultGuard(env)
  const log = deps.log ?? defaultLog
  const now = deps.now ?? Date.now
  if (method === 'GET') return { status: 200, body: await advisorStatus(env, guard) }
  if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) return { status: 503, body: { error: 'Live advisor is not configured on this server.' } }

  // Only the app's own pages may call the live model.
  const meta = deps.meta ?? {}
  if (!meta.origin || !allowedOrigins(env).includes(meta.origin) || meta.clientHeader !== 'web') {
    return { status: 403, body: { error: 'The live advisor only answers questions asked from the Navigator itself.' } }
  }
  if ((meta.bodyBytes ?? 0) > MAX_BODY_BYTES || JSON.stringify(body ?? '').length > MAX_BODY_BYTES) {
    return { status: 413, body: { error: TOO_LARGE } }
  }

  const parsed = parseBody(body)
  if (!parsed) return { status: 400, body: { error: 'Ask a question about the current solution.' } }

  // No guard, no spend: if the counters can't be reached, refuse and let the app use built-in guidance.
  const verdict = await guard.check(meta.clientId ?? 'anonymous').catch(() => undefined)
  if (!verdict) {
    log({ event: 'advisor_guard_error', level: 'error' })
    return { status: 503, body: { error: UNAVAILABLE } }
  }
  if (!verdict.ok) {
    log({ event: 'advisor_refused', reason: verdict.error, client: meta.clientId ?? 'anonymous' })
    return { status: 429, body: { error: verdict.error }, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } }
  }

  const client = deps.createClient ? deps.createClient(apiKey) : new Anthropic({ apiKey })
  const started = now()
  const history = (parsed.history ?? []).slice(-4).flatMap((h) => [
    { role: 'user' as const, content: h.question },
    { role: 'assistant' as const, content: h.summary },
  ])

  try {
    const response = await client.beta.messages.create({
      model: model(env),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      messages: [
        ...history,
        {
          role: 'user',
          content: `<snapshot>\n${JSON.stringify(parsed.context)}\n</snapshot>\n\nQuestion: ${parsed.question}`,
        },
      ],
    })

    const cost = costOf(response.model, response.usage)
    // The answer is already paid for, so a bookkeeping hiccup is logged rather than thrown away.
    const usage = await guard
      .record(cost)
      .then(() => guard.usage())
      .catch(() => (log({ event: 'advisor_guard_error', level: 'error', stage: 'record', cost_usd: cost }), { spentUsd: cost, budgetUsd: Infinity }))
    log({
      event: 'advisor_call',
      model: response.model,
      stop_reason: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cost_usd: cost,
      spent_today_usd: Math.round(usage.spentUsd * 10_000) / 10_000,
      latency_ms: now() - started,
    })
    const before = usage.spentUsd - cost
    if (before < usage.budgetUsd * LIMITS.alertAt && usage.spentUsd >= usage.budgetUsd * LIMITS.alertAt) {
      log({ event: 'advisor_budget_alert', level: 'warn', message: `Live advisor spend passed ${Math.round(LIMITS.alertAt * 100)}% of today's $${usage.budgetUsd} cap.`, spent_today_usd: usage.spentUsd })
    }
    if (response.stop_reason === 'refusal') return { status: 422, body: { error: 'The advisor could not answer that question. Try rephrasing it around the implementation.' } }
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return { status: 502, body: { error: UNAVAILABLE } }
    const answer = normalize(JSON.parse(text.text))
    if (!answer) return { status: 502, body: { error: UNAVAILABLE } }
    return { status: 200, body: { answer, source: 'live', model: response.model } }
  } catch (error) {
    log({ event: 'advisor_error', kind: error instanceof Anthropic.APIError ? `api_${error.status ?? 'unknown'}` : error instanceof SyntaxError ? 'bad_json' : 'unexpected', latency_ms: now() - started })
    if (error instanceof Anthropic.AuthenticationError) return { status: 503, body: { error: 'The live advisor is misconfigured (invalid API key). Using built-in guidance instead.' } }
    if (error instanceof Anthropic.RateLimitError) return { status: 503, body: { error: 'The live advisor is busy right now. Try again in a moment.' } }
    if (error instanceof Anthropic.APIError) return { status: 503, body: { error: UNAVAILABLE } }
    if (error instanceof SyntaxError) return { status: 502, body: { error: UNAVAILABLE } }
    return { status: 500, body: { error: UNAVAILABLE } }
  }
}

function parseBody(body: unknown): AdvisorRequestBody | undefined {
  const b = (typeof body === 'string' ? safeJson(body) : body) as Partial<AdvisorRequestBody> | undefined
  if (!b || typeof b.question !== 'string' || !b.question.trim() || b.question.length > 2000) return undefined
  if (!b.context || (b.context.kind !== 'solution' && b.context.kind !== 'portfolio')) return undefined
  return { question: b.question.trim(), context: b.context, history: Array.isArray(b.history) ? b.history.slice(-4) : [] }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/** Defensive shape check before anything reaches the browser. */
function normalize(raw: unknown): AdvisorAnswer | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    summary: str(r.summary),
    recommendations: arr(r.recommendations).slice(0, 6).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        title: str(o.title),
        why: str(o.why),
        owner: str(o.owner),
        impact: str(o.impact),
        blocking: o.blocking === true,
        priority: o.priority === 'high' || o.priority === 'low' ? o.priority : 'medium',
        activityId: typeof o.activityId === 'string' ? o.activityId : null,
      }
    }),
    risksToDiscuss: arr(r.risksToDiscuss).map(str).filter(Boolean).slice(0, 6),
    questionsForStakeholders: arr(r.questionsForStakeholders)
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>
        return { who: str(o.who), questions: arr(o.questions).map(str).filter(Boolean).slice(0, 5) }
      })
      .filter((x) => x.who)
      .slice(0, 4),
    gateOutlook: str(r.gateOutlook),
  }
}
