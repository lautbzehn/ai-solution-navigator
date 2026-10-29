import { dimensionDef, STAGES, stageDef, stageOrder } from '@/config'
import { evidenceForActivity } from './db'
import type { SolutionInsight } from './insight'
import { metricHealth, variance } from './metrics'
import { inProductionStage } from './portfolio'
import type { AuditEntry, GateAttempt, Metric, MetricKey, RiskTier, StageId } from './types'

/* Portfolio Intelligence. Every number here is a deterministic calculation
   over the same records the workspace edits, so reports update live. */

const DAY = 86_400_000

export type RangeKey = '30' | '90' | '180' | '365' | 'all'
export interface ReportFilters {
  range: RangeKey
  stage: StageId | 'production' | 'in_flight' | ''
  risk: RiskTier | ''
}

export const rangeStart = (range: RangeKey, now = Date.now()) => (range === 'all' ? 0 : now - Number(range) * DAY)

export function applyFilters(items: SolutionInsight[], f: ReportFilters) {
  return items.filter((i) => {
    const s = i.bundle.solution
    if (f.risk && s.riskTier !== f.risk) return false
    if (f.stage === 'production') return inProductionStage(s.stage)
    if (f.stage === 'in_flight') return !inProductionStage(s.stage)
    if (f.stage && s.stage !== f.stage) return false
    return true
  })
}

/* --------------------------------------------------------- performance -- */

export function implementationPerformance(items: SolutionInsight[], gateAttempts: GateAttempt[], audit: AuditEntry[], range: RangeKey, now = Date.now()) {
  const from = rangeStart(range, now)
  const ids = new Set(items.map((i) => i.bundle.solution.id))
  const activities = items.flatMap((i) => i.bundle.activities)

  const stageDays = STAGES.map((stage) => {
    const durations: number[] = []
    let ongoing = 0
    for (const i of items) {
      for (const v of i.bundle.solution.stageHistory) {
        if (v.stage !== stage.id) continue
        const end = v.exitedAt ? new Date(v.exitedAt).getTime() : now
        if (!v.exitedAt) ongoing++
        durations.push((end - new Date(v.enteredAt).getTime()) / DAY)
      }
    }
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    return { stage: stage.id, name: shortStage(stage.id), avgDays: avg, typicalDays: stage.typicalDays, samples: durations.length, ongoing }
  })

  const toProduction = items
    .map((i) => {
      const op = i.bundle.solution.stageHistory.find((v) => v.stage === 'operate')
      return op ? (new Date(op.enteredAt).getTime() - new Date(i.bundle.solution.createdAt).getTime()) / DAY : undefined
    })
    .filter((x): x is number => x !== undefined)

  const completedInRange = activities.filter((a) => a.status === 'complete' && a.completedAt && new Date(a.completedAt).getTime() >= from)
  const blocked = activities.filter((a) => a.status === 'blocked')
  const overdue = activities.filter((a) => a.blocking && a.stage === items.find((i) => i.bundle.solution.id === a.solutionId)?.bundle.solution.stage && a.status !== 'complete' && a.status !== 'not_applicable' && a.dueDate && new Date(a.dueDate).getTime() + DAY < now)

  const attempts = gateAttempts.filter((g) => g.decision && ids.has(g.solutionId) && new Date(g.ts).getTime() >= from)
  const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : undefined

  const reopened = audit.filter(
    (e) => e.entityType === 'activity' && e.action === 'status_changed' && e.from === 'Complete' && e.solutionId && ids.has(e.solutionId) && new Date(e.ts).getTime() >= from,
  ).length
  const reworkRate = completedInRange.length ? Math.round((reopened / completedInRange.length) * 1000) / 10 : 0

  // Weekly throughput of completed activities.
  const weeks = range === 'all' ? 26 : Math.min(26, Math.ceil(Number(range) / 7))
  const throughput = Array.from({ length: weeks }, (_, k) => {
    const end = now - (weeks - 1 - k) * 7 * DAY
    const start = end - 7 * DAY
    return {
      week: new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      completed: activities.filter((a) => a.completedAt && new Date(a.completedAt).getTime() > start && new Date(a.completedAt).getTime() <= end).length,
    }
  })

  return {
    stageDays,
    avgToProduction: toProduction.length ? Math.round(toProduction.reduce((a, b) => a + b, 0) / toProduction.length) : undefined,
    avgAge: items.length ? Math.round(items.reduce((t, i) => t + (now - new Date(i.bundle.solution.createdAt).getTime()) / DAY, 0) / items.length) : 0,
    completed: completedInRange.length,
    blocked: blocked.length,
    overdue: overdue.length,
    attempts: attempts.length,
    passRate,
    reopened,
    reworkRate,
    throughput,
  }
}

/* ---------------------------------------------------------- bottlenecks -- */

export function bottlenecks(items: SolutionInsight[], now = Date.now()) {
  return STAGES.filter((s) => s.id !== 'improve' && s.id !== 'operate').map((stage) => {
    const here = items.filter((i) => i.bundle.solution.stage === stage.id)
    const days = here.map((i) => {
      const v = i.bundle.solution.stageHistory.find((x) => x.stage === stage.id && !x.exitedAt)
      return v ? (now - new Date(v.enteredAt).getTime()) / DAY : 0
    })
    const reasonCount = new Map<string, number>()
    for (const i of here) {
      for (const c of i.gate.unmet) {
        const label = reasonLabel(i, c.activityId, c.kind, c.label)
        reasonCount.set(label, (reasonCount.get(label) ?? 0) + 1)
      }
    }
    const reasons = [...reasonCount.entries()].sort((a, b) => b[1] - a[1])
    return {
      stage: stage.id,
      name: stage.name,
      solutions: here.length,
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
      typicalDays: stage.typicalDays,
      blocked: here.filter((i) => i.health.status === 'blocked').length,
      atRisk: here.filter((i) => i.health.status === 'at_risk').length,
      openRequirements: here.reduce((n, i) => n + i.gate.unmet.length, 0),
      primaryReason: reasons.length ? reasons.slice(0, 2).map(([r]) => r).join(' / ') : here.length ? 'Ready for gate review' : '–',
      reasons: reasons.slice(0, 2).map(([r]) => r),
      ids: here.map((i) => i.bundle.solution.id),
    }
  })
}

/** Group unmet requirements into readable themes. */
function reasonLabel(i: SolutionInsight, activityId: string | undefined, kind: string, label: string) {
  if (kind === 'risks') return 'Unmitigated risk'
  if (kind === 'role') return 'Missing owners'
  if (kind === 'metrics') return 'Success metrics'
  if (kind === 'field') return 'Problem framing'
  const a = i.bundle.activities.find((x) => x.id === activityId)
  if (!a) return label
  const t = a.templateId ?? ''
  if (a.status === 'complete') return 'Evidence approval'
  if (/uat/.test(t)) return 'UAT'
  if (/eval|redteam|pilot|testplan/.test(t)) return 'Evaluation'
  if (/oversight|autonomy/.test(t)) return 'Human oversight'
  if (/privacy|security|secpriv/.test(t)) return 'Security / Privacy'
  if (/risk|residual|board|golive/.test(t)) return 'Risk & approvals'
  if (/monitor|support|incident|rollback|readiness/.test(t)) return 'Operational readiness'
  if (/data/.test(t)) return 'Data'
  return dimensionDef(a.dimension).name
}

/* ------------------------------------------------------------------ risk -- */

export function riskReport(items: SolutionInsight[]) {
  const risks = items.flatMap((i) => i.bundle.risks.map((r) => ({ ...r, solutionName: i.bundle.solution.name, tier: i.bundle.solution.riskTier })))
  const open = risks.filter((r) => r.status === 'open' || r.status === 'mitigating')
  const byCategory = new Map<string, number>()
  for (const r of open) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1)
  return {
    open,
    total: risks.length,
    unmitigatedHigh: open.filter((r) => (r.severity === 'high' || r.severity === 'critical') && !r.mitigation.trim()),
    critical: open.filter((r) => r.severity === 'critical'),
    byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    byTier: (['low', 'moderate', 'high'] as RiskTier[]).map((t) => ({ tier: t, solutions: items.filter((i) => i.bundle.solution.riskTier === t).length, openRisks: open.filter((r) => r.tier === t).length })),
  }
}

/* ---------------------------------------------------- value & outcomes -- */

export function outcomeRows(items: SolutionInsight[]) {
  return items.flatMap((i) =>
    i.bundle.metrics
      .filter((m) => (m.category === 'business' || m.category === 'financial') && m.measurement !== 'not_applicable')
      .map((m) => ({ metric: m, solution: i.bundle.solution, health: metricHealth(m), variance: variance(m) })),
  )
}

const metricByKey = (metrics: Metric[], key: MetricKey) => metrics.find((m) => m.key === key && m.measurement !== 'not_applicable')

export function adoptionRows(items: SolutionInsight[]) {
  return items
    .map((i) => {
      const m = i.bundle.metrics
      const eligible = metricByKey(m, 'eligible_users')
      const active = metricByKey(m, 'active_users')
      const rate = eligible?.current && active?.current !== undefined ? Math.round((active.current / eligible.current) * 100) : undefined
      return {
        solution: i.bundle.solution,
        eligible: eligible?.current,
        active: active?.current,
        rate,
        frequency: metricByKey(m, 'usage_frequency'),
        satisfaction: metricByKey(m, 'satisfaction'),
      }
    })
    .filter((r) => r.eligible !== undefined || r.active !== undefined || r.satisfaction)
}

export const AI_KEYS: { key: MetricKey; label: string }[] = [
  { key: 'accuracy', label: 'Accuracy / eval score' },
  { key: 'hallucination_rate', label: 'Hallucination rate' },
  { key: 'escalation_rate', label: 'Escalation rate' },
  { key: 'override_rate', label: 'Human override rate' },
  { key: 'defect_rate', label: 'Defect rate' },
]

export function aiPerformanceRows(items: SolutionInsight[]) {
  return items
    .map((i) => ({ solution: i.bundle.solution, cells: AI_KEYS.map((k) => metricByKey(i.bundle.metrics, k.key)) }))
    .filter((r) => r.cells.some((c) => c && c.current !== undefined))
}

/* -------------------------------------------------------------- insights -- */

export interface Insight {
  id: string
  title: string
  body: string
  tone: 'accent' | 'warning' | 'danger' | 'success'
  link?: string
}

export function portfolioInsights(items: SolutionInsight[], perf: ReturnType<typeof implementationPerformance>): Insight[] {
  const out: Insight[] = []
  const inFlight = items.filter((i) => !inProductionStage(i.bundle.solution.stage))
  const necks = bottlenecks(items).filter((b) => b.solutions > 0 && b.stage !== 'operate')

  // 1. Lifecycle bottleneck.
  if (inFlight.length && necks.length) {
    const top = [...necks].sort((a, b) => b.solutions - a.solutions || b.openRequirements - a.openRequirements)[0]
    const share = Math.round((top.solutions / inFlight.length) * 100)
    out.push({
      id: 'bottleneck',
      title: 'Portfolio insight',
      body: `${stageDef(top.stage).name} is the largest lifecycle bottleneck, with ${share}% of in-flight solutions waiting there${top.reasons.length ? `, held up mostly by ${top.reasons.join(' and ').toLowerCase()}` : ''}. They've spent ${top.avgDays} days in stage on average, against a typical ${top.typicalDays}.`,
      tone: top.avgDays > top.typicalDays ? 'warning' : 'accent',
      link: `/solutions?stage=${top.stage}`,
    })
  }

  // 2. Risk concentration.
  const high = items.filter((i) => i.bundle.solution.riskTier === 'high')
  const allOpen = items.reduce((n, i) => n + i.gate.unmet.length + i.bundle.activities.filter((a) => a.status === 'blocked').length, 0)
  const highOpen = high.reduce((n, i) => n + i.gate.unmet.length + i.bundle.activities.filter((a) => a.status === 'blocked').length, 0)
  if (high.length && allOpen) {
    const portfolioShare = Math.round((high.length / items.length) * 100)
    const openShare = Math.round((highOpen / allOpen) * 100)
    out.push({
      id: 'risk',
      title: 'Risk insight',
      body: `High-risk solutions represent ${portfolioShare}% of the portfolio but account for ${openShare}% of open gate requirements and blocked work. Higher rigor is doing its job; these need the most PM attention.`,
      tone: openShare > portfolioShare * 1.5 ? 'danger' : 'warning',
      link: '/solutions?risk=high',
    })
  }

  // 3. Evidence gap.
  let awaiting = 0
  const solutionsWithGaps = new Set<string>()
  const examples: string[] = []
  for (const i of items) {
    for (const a of i.bundle.activities) {
      if (a.status !== 'complete' || !a.evidenceTemplateId) continue
      const ev = evidenceForActivity(i.bundle, a)
      if (ev && ev.status !== 'approved' && ev.status !== 'not_required') {
        awaiting++
        solutionsWithGaps.add(i.bundle.solution.id)
        if (examples.length < 2 && a.blocking) examples.push(`${ev.name} (${i.bundle.solution.name.replace(/^AI /, '')})`)
      }
    }
  }
  if (awaiting) {
    out.push({
      id: 'evidence',
      title: 'Evidence insight',
      body: `${awaiting} completed ${awaiting === 1 ? 'activity' : 'activities'} across ${solutionsWithGaps.size} ${solutionsWithGaps.size === 1 ? 'solution' : 'solutions'} still lack approved evidence${examples.length ? `, including ${examples.join(' and ')}` : ''}. Approving it is the fastest way to raise readiness without new work.`,
      tone: 'accent',
    })
  }

  // 4. Value realization.
  const prod = items.filter((i) => inProductionStage(i.bundle.solution.stage))
  if (prod.length) {
    const exp = prod.reduce((t, i) => t + i.bundle.solution.expectedValue, 0)
    const real = prod.reduce((t, i) => t + i.bundle.solution.realizedValue, 0)
    const pct = exp ? Math.round((real / exp) * 100) : 0
    const pipeline = items.filter((i) => !inProductionStage(i.bundle.solution.stage)).reduce((t, i) => t + i.bundle.solution.expectedValue, 0)
    out.push({
      id: 'value',
      title: 'Value insight',
      body: `Solutions in production have realized ${pct}% of their expected value. Another $${(pipeline / 1_000_000).toFixed(1)}M a year is still in flight. Getting Validate-stage solutions live is the biggest value lever.`,
      tone: pct >= 80 ? 'success' : 'warning',
      link: '/reports#value',
    })
  }

  // 5. Pace.
  const behind = items.filter((i) => i.readiness.pace !== 'on_pace')
  if (behind.length) {
    out.push({
      id: 'pace',
      title: 'Readiness insight',
      body: `${behind.length} of ${items.length} solutions ${behind.length === 1 ? 'is' : 'are'} behind the readiness expected for ${behind.length === 1 ? 'its' : 'their'} stage: ${behind.slice(0, 3).map((i) => i.bundle.solution.name.replace(/^AI /, '')).join(', ')}${behind.length > 3 ? '…' : '.'}`,
      tone: behind.some((i) => i.readiness.pace === 'well_behind') ? 'danger' : 'warning',
      link: '/solutions?sort=readiness',
    })
  }

  // 6. Quality of flow.
  if (perf.passRate !== undefined && perf.attempts >= 3) {
    out.push({
      id: 'gates',
      title: 'Delivery insight',
      body: `${perf.passRate}% of gate decisions were Go. Each Hold or Stop means a gatekeeper sent the work back before it was ready, so watch rework (${perf.reworkRate}%) and review evidence early.`,
      tone: perf.passRate >= 80 ? 'success' : 'warning',
      link: '/reports#delivery',
    })
  }
  return out
}

export const shortStage = (s: StageId) => (s === 'improve' ? 'Improve' : stageDef(s).name)
export const stageIndex = stageOrder
