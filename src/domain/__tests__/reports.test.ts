import { describe, expect, test } from 'vitest'
import { implementationPerformance, riskReport } from '@/domain/reports'
import { audit, gateAttempts, NOW, portfolio } from './fixtures'

/* Every expected number below is worked out by hand from fixtures.ts. */

describe('Delivery KPIs', () => {
  test('the last 30 days', () => {
    const kpi = implementationPerformance(portfolio, gateAttempts, audit, '30', NOW)
    // Live entered Operate 40 days after it was created. Build hasn't yet.
    expect(kpi.avgToProduction).toBe(40)
    // Ages 100 and 50 days.
    expect(kpi.avgAge).toBe(75)
    // Completed 10 and 5 days ago. The one 40 days ago is out of range.
    expect(kpi.completed).toBe(2)
    expect(kpi.blocked).toBe(1)
    // Only gate-blocking work in the solution's current stage counts as overdue.
    expect(kpi.overdue).toBe(1)
    // Hold, then Go. The look without a decision and the older Go don't count.
    expect(kpi.attempts).toBe(2)
    expect(kpi.passRate).toBe(50)
    // One activity went from Complete back to In progress: 1 of 2 completed.
    expect(kpi.reopened).toBe(1)
    expect(kpi.reworkRate).toBe(50)
    // Five weeks of throughput that hold the two completions.
    expect(kpi.throughput).toHaveLength(5)
    expect(kpi.throughput.reduce((n, w) => n + w.completed, 0)).toBe(2)
  })

  test('all time, and how long each stage takes', () => {
    const kpi = implementationPerformance(portfolio, gateAttempts, audit, 'all', NOW)
    expect(kpi.completed).toBe(3)
    expect(kpi.attempts).toBe(3)
    expect(kpi.passRate).toBe(67)
    expect(kpi.reopened).toBe(2)
    expect(kpi.reworkRate).toBe(66.7)
    // Build took 40 days for Live and 20 so far for Build: 30 on average, one still going.
    expect(kpi.stageDays.find((s) => s.stage === 'build')).toMatchObject({ avgDays: 30, samples: 2, ongoing: 1 })
    expect(kpi.stageDays.find((s) => s.stage === 'operate')).toMatchObject({ avgDays: 60, samples: 1, ongoing: 1 })
    expect(kpi.stageDays.find((s) => s.stage === 'discover')).toMatchObject({ avgDays: 0, samples: 0 })
  })

  test('with no decisions in range there is no pass rate, not a perfect one', () => {
    const kpi = implementationPerformance(portfolio, gateAttempts.filter((g) => !g.decision), audit, 'all', NOW)
    expect(kpi.attempts).toBe(0)
    expect(kpi.passRate).toBeUndefined()
  })
})

describe('risk report', () => {
  test('counts open risks, unmitigated high ones, and where they sit', () => {
    const r = riskReport(portfolio)
    expect(r.total).toBe(4)
    expect(r.open.map((x) => x.id)).toEqual(['r_unmitigated', 'r_critical', 'r_medium'])
    expect(r.unmitigatedHigh.map((x) => x.id)).toEqual(['r_unmitigated'])
    expect(r.critical.map((x) => x.id)).toEqual(['r_critical'])
    expect(r.byCategory).toEqual([{ category: 'privacy', count: 2 }, { category: 'security', count: 1 }])
    expect(r.byTier).toEqual([
      { tier: 'low', solutions: 0, openRisks: 0 },
      { tier: 'moderate', solutions: 1, openRisks: 1 },
      { tier: 'high', solutions: 1, openRisks: 2 },
    ])
  })
})
