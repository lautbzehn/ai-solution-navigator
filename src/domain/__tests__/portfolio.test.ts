import { describe, expect, test } from 'vitest'
import { summarize } from '@/domain/portfolio'
import { gateAttempts, portfolio } from './fixtures'

describe('portfolio summary', () => {
  test('gate pass rate counts decisions only', () => {
    // Go, Hold, Go in this portfolio: 2 of 3. The look without a decision and the other solution's Go don't count.
    expect(summarize(portfolio, gateAttempts).gatePassRate).toBe(67)
    // Opening gates to look, however often, never moves it.
    const peeks = Array.from({ length: 5 }, (_, i) => ({ ...gateAttempts[3], id: `peek_${i}` }))
    expect(summarize(portfolio, [...gateAttempts, ...peeks]).gatePassRate).toBe(67)
    // A Stop counts against it like a Hold.
    expect(summarize(portfolio, [...gateAttempts, { ...gateAttempts[1], id: 'g_stop', decision: 'stop' }]).gatePassRate).toBe(50)
  })

  test('production and time to production come from the stage history', () => {
    expect(summarize(portfolio, gateAttempts)).toMatchObject({ total: 2, production: 1, avgImplementationDays: 40 })
  })
})
