import { describe, expect, test } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { handleAdvisor, MAX_BODY_BYTES, type AdvisorDeps } from '../advisor'
import { BUDGET_SPENT, BUSY, costOf, LIMITS, MemoryGuard } from '../guard'

const ctx = { kind: 'portfolio', solutions: [], insights: [] }
const env = { ANTHROPIC_API_KEY: 'sk-ant-test' }
const web = { origin: 'https://navigator.icarianforge.com', clientHeader: 'web', clientId: 'visitor-1' }

const ANSWER = { summary: 'All good.', recommendations: [], risksToDiscuss: [], questionsForStakeholders: [], gateOutlook: '' }

/** A stand-in for the SDK client: no network, a fixed answer and usage. */
function fakeClient(opts: { fail?: Error; usage?: Record<string, number> } = {}): NonNullable<AdvisorDeps['createClient']> {
  return () => ({
    beta: {
      messages: {
        create: (async () => {
          if (opts.fail) throw opts.fail
          return { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 10_000, output_tokens: 2_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...opts.usage } }
        }) as never,
      },
    },
  })
}

const ask = (deps: AdvisorDeps, body: unknown = { question: 'What should I do next?', context: ctx }, e: Record<string, string> = env) =>
  handleAdvisor('POST', body, e, { log: () => {}, guard: new MemoryGuard(), ...deps })

describe('advisor endpoint', () => {
  test('reports built-in mode and refuses live calls without a server key', async () => {
    expect((await handleAdvisor('GET', undefined, {})).body).toEqual({ live: false })
    expect((await handleAdvisor('POST', { question: 'hi', context: ctx }, {}, { meta: web })).status).toBe(503)
  })

  test('only answers the app itself', async () => {
    expect((await ask({ meta: { ...web, origin: 'https://evil.example' }, createClient: fakeClient() })).status).toBe(403)
    expect((await ask({ meta: { ...web, clientHeader: null }, createClient: fakeClient() })).status).toBe(403)
    expect((await ask({ meta: { ...web, origin: null }, createClient: fakeClient() })).status).toBe(403)
  })

  test('refuses oversized requests before calling the model', async () => {
    let called = false
    const r = await ask({ meta: { ...web, bodyBytes: MAX_BODY_BYTES + 1 }, createClient: () => ((called = true), fakeClient()('')) })
    expect(r.status).toBe(413)
    expect(called).toBe(false)
  })

  test('rejects empty questions and malformed context', async () => {
    expect((await ask({ meta: web, createClient: fakeClient() }, { question: '  ', context: ctx })).status).toBe(400)
    expect((await ask({ meta: web, createClient: fakeClient() }, { question: 'hi', context: { kind: 'x' } })).status).toBe(400)
  })

  test('answers, records the cost, and logs tokens and spend', async () => {
    const guard = new MemoryGuard()
    const lines: Record<string, unknown>[] = []
    const r = await handleAdvisor('POST', { question: 'What next?', context: ctx }, env, { meta: web, guard, createClient: fakeClient(), log: (l) => lines.push(l) })
    expect(r.status).toBe(200)
    expect((r.body as { answer: { summary: string } }).answer.summary).toBe('All good.')
    expect((await guard.usage()).spentUsd).toBeCloseTo(costOf('claude-opus-5-5', { input_tokens: 10_000, output_tokens: 2_000 }))
    expect(lines.find((l) => l.event === 'advisor_call')).toMatchObject({ input_tokens: 10_000, output_tokens: 2_000 })
  })

  test('rate-limits a busy visitor', async () => {
    const guard = new MemoryGuard()
    for (let i = 0; i < LIMITS.perMinute; i++) expect((await ask({ meta: web, guard, createClient: fakeClient() })).status).toBe(200)
    const r = await ask({ meta: web, guard, createClient: fakeClient() })
    expect(r.status).toBe(429)
    expect(r.body).toEqual({ error: BUSY })
    expect(r.headers?.['Retry-After']).toBeDefined()
    // Another visitor is unaffected.
    expect((await ask({ meta: { ...web, clientId: 'visitor-2' }, guard, createClient: fakeClient() })).status).toBe(200)
  })

  test('stops spending once the daily budget is used up', async () => {
    const guard = new MemoryGuard(0.1)
    expect((await ask({ meta: web, guard, createClient: fakeClient({ usage: { output_tokens: 10_000 } }) })).status).toBe(200)
    const r = await ask({ meta: { ...web, clientId: 'visitor-9' }, guard, createClient: fakeClient() })
    expect(r.status).toBe(429)
    expect(r.body).toEqual({ error: BUDGET_SPENT })
  })

  test('warns once spend passes 80% of the cap', async () => {
    const lines: Record<string, unknown>[] = []
    const guard = new MemoryGuard(0.1)
    // $0.09 of a $0.10 cap: past the 80% line, still under the cap.
    await handleAdvisor('POST', { question: 'What next?', context: ctx }, env, { meta: web, guard, createClient: fakeClient({ usage: { output_tokens: 2_500 } }), log: (l) => lines.push(l) })
    expect(lines.filter((l) => l.event === 'advisor_budget_alert')).toHaveLength(1)
    await handleAdvisor('POST', { question: 'What next?', context: ctx }, env, { meta: { ...web, clientId: 'visitor-3' }, guard, createClient: fakeClient({ usage: { output_tokens: 0, input_tokens: 100 } }), log: (l) => lines.push(l) })
    expect(lines.filter((l) => l.event === 'advisor_budget_alert')).toHaveLength(1)
  })

  test('refuses to spend when the rate-limit counters are unreachable', async () => {
    let called = false
    const broken = { check: () => Promise.reject(new Error('storage down')), record: async () => {}, usage: async () => ({ spentUsd: 0, budgetUsd: 5 }) }
    const r = await ask({ meta: web, guard: broken, createClient: () => ((called = true), fakeClient()('')) })
    expect(r.status).toBe(503)
    expect(called).toBe(false)
  })

  test('an invalid key degrades to a friendly 503, never a stack trace', async () => {
    const fail = new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers())
    const r = await ask({ meta: web, createClient: fakeClient({ fail }) })
    expect(r.status).toBe(503)
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts:\d+/)
  })

  test('the status shows the live model and today’s budget', async () => {
    const r = await handleAdvisor('GET', undefined, env, { guard: new MemoryGuard(5) })
    expect(r.body).toMatchObject({ live: true, budget: { dailyUsd: 5, spentTodayUsd: 0 }, limits: { perMinute: LIMITS.perMinute, perDay: LIMITS.perDay } })
  })
})
