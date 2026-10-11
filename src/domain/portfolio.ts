import { STAGES, stageOrder } from '@/config'
import type { SolutionInsight } from './insight'
import type { GateAttempt, ReadinessSnapshot, RiskTier, StageId } from './types'

const DAY = 86_400_000

export const READINESS_BUCKETS = [
  { key: 'lt50', label: '<50%', min: 0, max: 49 },
  { key: '50_69', label: '50–69%', min: 50, max: 69 },
  { key: '70_84', label: '70–84%', min: 70, max: 84 },
  { key: '85', label: '85%+', min: 85, max: 100 },
] as const
export type ReadinessBucket = (typeof READINESS_BUCKETS)[number]['key']

export const bucketOf = (score: number): ReadinessBucket => READINESS_BUCKETS.find((b) => score >= b.min && score <= b.max)!.key

export const inProductionStage = (s: StageId) => stageOrder(s) >= stageOrder('operate')

export function summarize(items: SolutionInsight[], gateAttempts: GateAttempt[]) {
  const n = items.length || 1
  const production = items.filter((i) => inProductionStage(i.bundle.solution.stage))
  const implDays = production
    .map((i) => {
      const op = i.bundle.solution.stageHistory.find((v) => v.stage === 'operate')
      return op ? (new Date(op.enteredAt).getTime() - new Date(i.bundle.solution.createdAt).getTime()) / DAY : undefined
    })
    .filter((x): x is number => x !== undefined)
  const ids = new Set(items.map((i) => i.bundle.solution.id))
  const attempts = gateAttempts.filter((g) => ids.has(g.solutionId))
  return {
    total: items.length,
    inAssessment: items.filter((i) => i.bundle.solution.stage === 'assess').length,
    early: items.filter((i) => stageOrder(i.bundle.solution.stage) <= stageOrder('assess')).length,
    inValidation: items.filter((i) => i.bundle.solution.stage === 'validate').length,
    production: production.length,
    blocked: items.filter((i) => i.health.status === 'blocked').length,
    atRisk: items.filter((i) => i.health.status === 'at_risk').length,
    avgReadiness: Math.round(items.reduce((t, i) => t + i.readiness.overall, 0) / n),
    avgImplementationDays: implDays.length ? Math.round(implDays.reduce((a, b) => a + b, 0) / implDays.length) : 0,
    expectedValue: items.reduce((t, i) => t + i.bundle.solution.expectedValue, 0),
    realizedValue: items.reduce((t, i) => t + i.bundle.solution.realizedValue, 0),
    gatePassRate: attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 100,
  }
}

export function stageDistribution(items: SolutionInsight[]) {
  return STAGES.map((s) => ({
    stage: s.id,
    name: s.name === 'Improve / Retire' ? 'Improve' : s.name,
    count: items.filter((i) => i.bundle.solution.stage === s.id).length,
  }))
}

export function readinessDistribution(items: SolutionInsight[]) {
  return READINESS_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: items.filter((i) => bucketOf(i.readiness.overall) === b.key).length }))
}

export function riskDistribution(items: SolutionInsight[]) {
  const tiers: RiskTier[] = ['low', 'moderate', 'high']
  return tiers.map((t) => ({ tier: t, count: items.filter((i) => i.bundle.solution.riskTier === t).length }))
}

/** Average completion of each stage across the solutions that have reached it. */
export function stageCompletion(items: SolutionInsight[]) {
  return STAGES.map((s) => {
    const reached = items.filter((i) => stageOrder(i.bundle.solution.stage) >= stageOrder(s.id))
    const avg = reached.length ? Math.round(reached.reduce((t, i) => t + i.readiness.stageProgress[s.id], 0) / reached.length) : 0
    return { stage: s.id, name: s.name === 'Improve / Retire' ? 'Improve' : s.name, completion: avg, solutions: reached.length }
  })
}

/** Weekly portfolio readiness: average of each solution's latest snapshot as of that week. */
export function readinessTrend(snapshots: ReadinessSnapshot[], solutionIds: string[], weeks = 16, now = Date.now()) {
  const ids = new Set(solutionIds)
  const bySolution = new Map<string, ReadinessSnapshot[]>()
  for (const s of snapshots) {
    if (!ids.has(s.solutionId)) continue
    const list = bySolution.get(s.solutionId) ?? []
    list.push(s)
    bySolution.set(s.solutionId, list)
  }
  for (const list of bySolution.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  const out: { week: string; date: string; readiness: number; solutions: number }[] = []
  for (let w = weeks; w >= 0; w--) {
    const date = new Date(now - w * 7 * DAY).toISOString().slice(0, 10)
    const values: number[] = []
    for (const list of bySolution.values()) {
      let latest: ReadinessSnapshot | undefined
      for (const s of list) if (s.date <= date) latest = s
      if (latest) values.push(latest.readiness)
    }
    if (!values.length) continue
    out.push({
      week: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date,
      readiness: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      solutions: values.length,
    })
  }
  return out
}
