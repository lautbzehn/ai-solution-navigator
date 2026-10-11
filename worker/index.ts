import { handleAdvisor, MAX_BODY_BYTES, type AdvisorEnv } from '../server/advisor'
import { budgetFrom, clientIdFor, decide, today, type AdvisorGuard, type GuardVerdict } from '../server/guard'

/* Cloudflare Worker for navigator.icarianforge.com.
   Static files (the built app in ./dist) are served by the assets binding;
   only /api/* reaches this code. Set ANTHROPIC_API_KEY with
   `npx wrangler secret put ANTHROPIC_API_KEY` to enable the live advisor.
   The advisor's rate limits and daily spend cap live in one Durable Object
   (AdvisorGuardObject) so they hold across every Cloudflare location. */

/* The few Durable Object types this file uses, so it type-checks without the full Workers type package. */
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}
interface DurableObjectState {
  storage: DurableObjectStorage
}
interface DurableObjectStub {
  fetch(input: string, init?: RequestInit): Promise<Response>
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStub
}

interface Env extends AdvisorEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  ADVISOR_GUARD?: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/advisor') {
      const raw = request.method === 'POST' ? await request.text() : ''
      let body: unknown
      if (raw && raw.length <= MAX_BODY_BYTES) {
        try {
          body = JSON.parse(raw)
        } catch {
          body = undefined
        }
      }
      const guard = env.ADVISOR_GUARD ? durableGuard(env.ADVISOR_GUARD) : undefined
      const r = await handleAdvisor(request.method, body, env, {
        guard,
        meta: {
          origin: request.headers.get('Origin'),
          clientHeader: request.headers.get('X-Navigator-Client'),
          clientId: await clientIdFor(request.headers.get('CF-Connecting-IP') ?? 'unknown'),
          bodyBytes: new TextEncoder().encode(raw).length,
        },
      })
      return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store', ...(r.headers ?? {}) } })
    }
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 })
    return env.ASSETS.fetch(request)
  },
}

/** The guard, backed by the single AdvisorGuardObject instance. */
function durableGuard(ns: DurableObjectNamespace): AdvisorGuard {
  const stub = ns.get(ns.idFromName('advisor-guard'))
  const call = async <T,>(path: string, payload?: unknown): Promise<T> => {
    const res = await stub.fetch(`https://guard${path}`, payload === undefined ? undefined : { method: 'POST', body: JSON.stringify(payload) })
    return (await res.json()) as T
  }
  return {
    check: (clientId) => call<GuardVerdict>('/check', { clientId }),
    record: async (costUsd) => {
      await call('/record', { costUsd })
    },
    usage: () => call<{ spentUsd: number; budgetUsd: number }>('/usage'),
  }
}

/** Keeps the advisor's counters: today's spend, and each visitor's recent and daily question counts. */
export class AdvisorGuardObject {
  private minute = new Map<string, number[]>()
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    const now = Date.now()
    const day = today(now)
    const budgetUsd = budgetFrom(this.env.ADVISOR_DAILY_BUDGET_USD)
    const spentKey = `spent:${day}`
    const spentUsd = (await this.state.storage.get<number>(spentKey)) ?? 0

    if (pathname === '/usage') return Response.json({ spentUsd, budgetUsd })

    const payload = (await request.json().catch(() => ({}))) as { clientId?: string; costUsd?: number }
    if (pathname === '/record') {
      const cost = Number(payload.costUsd)
      if (Number.isFinite(cost) && cost > 0) await this.state.storage.put(spentKey, spentUsd + cost)
      return Response.json({ ok: true })
    }

    const clientId = payload.clientId ?? 'anonymous'
    const dayKey = `day:${day}:${clientId}`
    const dayCount = (await this.state.storage.get<number>(dayKey)) ?? 0
    // Keep the per-minute memory small: forget visitors with no request in the last minute.
    if (this.minute.size > 2000) for (const [id, ts] of this.minute) if (!ts.some((t) => now - t < 60_000)) this.minute.delete(id)
    const hits = (this.minute.get(clientId) ?? []).filter((t) => now - t < 60_000)
    const verdict = decide({ spentUsd, budgetUsd, minuteHits: hits, dayCount }, now)
    if (verdict.ok) {
      this.minute.set(clientId, [...hits, now])
      await this.state.storage.put(dayKey, dayCount + 1)
    }
    return Response.json(verdict)
  }
}
