/* Advisor guard
   -------------
   The live advisor is a public endpoint that spends real money, so every call
   passes three checks before it reaches the model:
   · a per-visitor rate limit (a few questions a minute, a few dozen a day),
   · a site-wide daily spend cap (ADVISOR_DAILY_BUDGET_USD, default $5), and
   · a log line per call with tokens, cost, and latency.
   The Cloudflare Worker keeps these counters in one Durable Object so they hold
   across every edge location; local development uses the in-memory version. */

export const LIMITS = {
  perMinute: 6,
  /** About $1 to $2 of live answers per visitor, so one visitor can't use up the day's budget. */
  perDay: 20,
  /** Default daily spend cap when ADVISOR_DAILY_BUDGET_USD is not set. */
  dailyBudgetUsd: 5,
  /** Log a warning once spend passes this share of the daily cap. */
  alertAt: 0.8,
}

export type GuardVerdict = { ok: true } | { ok: false; error: string; retryAfterSeconds: number }

export interface AdvisorGuard {
  /** May this visitor ask a question now? Counts the request when it may. */
  check(clientId: string): Promise<GuardVerdict>
  /** Add a finished call's cost to today's spend. */
  record(costUsd: number): Promise<void>
  usage(): Promise<{ spentUsd: number; budgetUsd: number }>
}

export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

const secondsToMidnightUtc = (now: number) => Math.max(60, Math.ceil((Date.parse(`${today(now)}T00:00:00Z`) + 86_400_000 - now) / 1000))

export const BUSY = 'You have asked a lot of questions in a short time. Give it a minute, or use the built-in guidance meanwhile.'
export const DAILY_LIMIT = 'You have reached today’s limit for live AI answers. Built-in guidance still works, and the limit resets tomorrow.'
export const BUDGET_SPENT = 'Today’s live AI budget for this demo is used up. Built-in guidance still works, and the budget resets tomorrow.'

/** The rules, independent of where the counters live. */
export function decide(state: { spentUsd: number; budgetUsd: number; minuteHits: number[]; dayCount: number }, now: number): GuardVerdict {
  if (state.spentUsd >= state.budgetUsd) return { ok: false, error: BUDGET_SPENT, retryAfterSeconds: secondsToMidnightUtc(now) }
  if (state.dayCount >= LIMITS.perDay) return { ok: false, error: DAILY_LIMIT, retryAfterSeconds: secondsToMidnightUtc(now) }
  const recent = state.minuteHits.filter((t) => now - t < 60_000)
  if (recent.length >= LIMITS.perMinute) return { ok: false, error: BUSY, retryAfterSeconds: Math.ceil((60_000 - (now - recent[0])) / 1000) }
  return { ok: true }
}

export const budgetFrom = (raw?: string) => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : LIMITS.dailyBudgetUsd
}

/** In-memory counters for local development (one process, resets on restart). */
export class MemoryGuard implements AdvisorGuard {
  private day = today()
  private spent = 0
  private minute = new Map<string, number[]>()
  private daily = new Map<string, number>()
  constructor(private budgetUsd = LIMITS.dailyBudgetUsd, private now: () => number = Date.now) {}

  private roll() {
    const d = today(this.now())
    if (d === this.day) return
    this.day = d
    this.spent = 0
    this.daily.clear()
    this.minute.clear()
  }

  async check(clientId: string): Promise<GuardVerdict> {
    this.roll()
    const now = this.now()
    const hits = (this.minute.get(clientId) ?? []).filter((t) => now - t < 60_000)
    const verdict = decide({ spentUsd: this.spent, budgetUsd: this.budgetUsd, minuteHits: hits, dayCount: this.daily.get(clientId) ?? 0 }, now)
    if (verdict.ok) {
      this.minute.set(clientId, [...hits, now])
      this.daily.set(clientId, (this.daily.get(clientId) ?? 0) + 1)
    }
    return verdict
  }

  async record(costUsd: number) {
    this.roll()
    this.spent += costUsd
  }

  async usage() {
    this.roll()
    return { spentUsd: this.spent, budgetUsd: this.budgetUsd }
  }
}

/** Per-million-token prices (USD). Cache rates follow the usual 0.1x read and 1.25x write
    ratios where a model's card doesn't list them. Unknown models are priced as Opus. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

export interface UsageLike {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

export function costOf(model: string, u: UsageLike) {
  const p = PRICES[model] ?? Object.entries(PRICES).find(([id]) => model.startsWith(id))?.[1] ?? PRICES['claude-opus-5-5']
  const usd = ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1_000_000
  return Math.round(usd * 1_000_000) / 1_000_000
}

/** A stable, anonymous id for a visitor: we never store raw IP addresses. */
export async function clientIdFor(ip: string) {
  const bytes = new TextEncoder().encode(`navigator:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}
