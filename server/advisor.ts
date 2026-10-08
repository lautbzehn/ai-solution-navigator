import Anthropic from '@anthropic-ai/sdk'
import type { AdvisorAnswer, AdvisorContext, AdvisorStatus } from '../src/ai/types'

/* Server-side Implementation Advisor.
   The API key stays on the server. Live mode is opt-in: it runs only when
   ANTHROPIC_API_KEY is set in the server environment, so a fresh checkout or
   a public demo never incurs API charges. Shared by the Vite dev middleware
   and the Vercel function in /api. */

const model = () => process.env.ADVISOR_MODEL || 'claude-opus-5-5'

const SYSTEM_PROMPT = `You are an AI implementation advisor supporting a Lead Product Manager.

Your role is to help the PM successfully move an AI solution through an enterprise implementation lifecycle (Discover, Assess, Design, Build, Validate, Deploy, Operate, Improve/Retire). Governance is continuous across the lifecycle, and higher-risk solutions require more evidence and stronger gate criteria.

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
}

const UNAVAILABLE = 'The Implementation Advisor is temporarily unavailable. You can continue managing the implementation manually.'

export function advisorStatus(): AdvisorStatus {
  return process.env.ANTHROPIC_API_KEY ? { live: true, model: model() } : { live: false }
}

export async function handleAdvisor(method: string, body: unknown): Promise<HandlerResult> {
  if (method === 'GET') return { status: 200, body: advisorStatus() }
  if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { status: 503, body: { error: 'Live advisor is not configured on this server.' } }

  const parsed = parseBody(body)
  if (!parsed) return { status: 400, body: { error: 'Ask a question about the current solution.' } }

  const client = new Anthropic({ apiKey })
  const history = (parsed.history ?? []).slice(-4).flatMap((h) => [
    { role: 'user' as const, content: h.question },
    { role: 'assistant' as const, content: h.summary },
  ])

  try {
    const response = await client.beta.messages.create({
      model: model(),
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

    if (response.stop_reason === 'refusal') return { status: 422, body: { error: 'The advisor could not answer that question. Try rephrasing it around the implementation.' } }
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return { status: 502, body: { error: UNAVAILABLE } }
    const answer = normalize(JSON.parse(text.text))
    if (!answer) return { status: 502, body: { error: UNAVAILABLE } }
    return { status: 200, body: { answer, source: 'live', model: response.model } }
  } catch (error) {
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
