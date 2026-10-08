import { nextStage, riskTierDef, roleName, stageDef, stageOrder } from '@/config'
import { evidenceForActivity } from '@/domain/db'
import { gateLabel } from '@/domain/gates'
import type { SolutionInsight } from '@/domain/insight'
import { ACTIVITY_STATUS, DECISION_OUTCOME, EVIDENCE_STATUS, LIKELIHOOD, RISK_CATEGORY, RISK_STATUS, SEVERITY } from '@/domain/labels'
import { METRIC_HEALTH_LABEL, metricHealth } from '@/domain/metrics'
import { adoptionRows, aiPerformanceRows, bottlenecks, type implementationPerformance } from '@/domain/reports'
import { sortUnmet } from '@/domain/nextAction'
import type { Person } from '@/domain/types'
import type { PortfolioContext, SolutionContext } from './types'

const DAY = 86_400_000

/** Build the advisor's view of one solution. Includes the current and next
    stage in detail and only summaries beyond that, to stay compact. */
export function buildSolutionContext(insight: SolutionInsight, people: Person[], now = Date.now()): SolutionContext {
  const { bundle, readiness, gate, health, next } = insight
  const { solution } = bundle
  const name = (id?: string) => (id ? people.find((p) => p.id === id)?.name ?? 'Unassigned' : 'Unassigned')
  const withRole = (id?: string) => {
    if (!id) return 'Unassigned'
    const roles = solution.team.filter((m) => m.personId === id).map((m) => roleName(m.roleId))
    return roles.length ? `${name(id)} (${roles.join(', ')})` : name(id)
  }
  const visit = solution.stageHistory.find((v) => v.stage === solution.stage && !v.exitedAt)
  const cur = stageOrder(solution.stage)
  const focus = bundle.activities.filter((a) => stageOrder(a.stage) === cur || stageOrder(a.stage) === cur + 1 || (a.status === 'blocked'))

  return {
    kind: 'solution',
    solution: {
      id: solution.id,
      name: solution.name,
      description: solution.description,
      stage: stageDef(solution.stage).name,
      nextStage: nextStage(solution.stage) ? stageDef(nextStage(solution.stage)!).name : null,
      riskTier: riskTierDef(solution.riskTier).name,
      riskTierRigor: riskTierDef(solution.riskTier).rigor,
      owner: withRole(solution.ownerId),
      businessProblem: solution.businessProblem,
      desiredOutcome: solution.desiredOutcome,
      targetUsers: solution.targetUsers,
      expectedAnnualValueUsd: solution.expectedValue,
      realizedAnnualValueUsd: solution.realizedValue,
      daysInStage: visit ? Math.round((now - new Date(visit.enteredAt).getTime()) / DAY) : 0,
      typicalDaysInStage: stageDef(solution.stage).typicalDays,
    },
    health: { status: health.status, reasons: health.reasons },
    readiness: {
      overall: readiness.overall,
      expectedForStage: readiness.expected,
      pace: readiness.pace,
      dimensions: readiness.dimensions.map((d) => ({ name: d.name, score: d.score, weightPct: d.weight, explanation: d.explanation, topGaps: d.gaps.slice(0, 3).map((g) => g.name) })),
    },
    gate: {
      name: gate.isFinal ? 'No exit gate (final stage)' : `${gate.gate?.name ?? 'Stage gate'} (${gateLabel(solution.stage)})`,
      canAdvance: gate.canAdvance,
      met: gate.criteria.length - gate.unmet.length,
      total: gate.criteria.length,
      unmet: sortUnmet(gate.unmet).map((u) => ({ label: u.label, detail: u.detail, owner: u.ownerId ? withRole(u.ownerId) : null, activityId: u.activityId ?? null, dueDate: u.dueDate?.slice(0, 10) ?? null })),
    },
    nextBestAction: { title: next.title, why: next.why, owner: next.ownerId ? withRole(next.ownerId) : null, impact: next.impact, activityId: next.activityId ?? null },
    activities: focus.map((a) => {
      const ev = evidenceForActivity(bundle, a)
      return {
        id: a.id,
        name: a.name,
        stage: stageDef(a.stage).name,
        status: ACTIVITY_STATUS[a.status],
        owner: withRole(a.ownerId),
        blocking: a.blocking,
        required: a.required,
        evidence: ev ? `${ev.name}: ${EVIDENCE_STATUS[ev.status]}` : null,
        dueDate: a.dueDate?.slice(0, 10) ?? null,
        blockedReason: a.blockedReason ?? null,
        lastComment: a.comments.length ? `${name(a.comments[a.comments.length - 1].authorId)}: ${a.comments[a.comments.length - 1].text}` : null,
      }
    }),
    evidenceGaps: bundle.evidence
      .filter((e) => e.required && e.status !== 'approved' && e.status !== 'not_required' && stageOrder(e.stage) <= cur + 1)
      .map((e) => ({ name: e.name, stage: stageDef(e.stage).name, status: EVIDENCE_STATUS[e.status], owner: withRole(e.ownerId), activityCompleted: bundle.activities.find((a) => a.id === e.activityId)?.status === 'complete' })),
    risks: bundle.risks
      .filter((r) => r.status === 'open' || r.status === 'mitigating')
      .map((r) => ({ title: r.title, category: RISK_CATEGORY[r.category], severity: SEVERITY[r.severity], likelihood: LIKELIHOOD[r.likelihood], status: RISK_STATUS[r.status], mitigation: r.mitigation || 'None recorded', owner: withRole(r.ownerId) })),
    decisions: [...bundle.decisions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((d) => ({ title: d.title, outcome: DECISION_OUTCOME[d.outcome], date: d.date.slice(0, 10), owner: name(d.ownerId), conditions: d.conditions })),
    metrics: bundle.metrics.filter((m) => m.measurement !== 'not_applicable').map((m) => ({ name: m.name, category: m.category, baseline: m.baseline ?? null, target: m.target ?? null, current: m.current ?? null, unit: m.unit, health: METRIC_HEALTH_LABEL[metricHealth(m).status] })),
    team: Array.from(new Set(solution.team.map((m) => m.personId))).map((pid) => ({
      name: name(pid),
      role: solution.team.filter((m) => m.personId === pid).map((m) => roleName(m.roleId)).join(', '),
      openActivities: bundle.activities.filter((a) => a.ownerId === pid && a.required && a.status !== 'complete' && a.status !== 'not_applicable' && stageOrder(a.stage) <= cur + 1).length,
    })),
    recentChanges: [...bundle.changes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((c) => ({ type: c.type, description: c.description, status: c.status })),
  }
}

export function buildPortfolioContext(items: SolutionInsight[], insights: string[], perf?: ReturnType<typeof implementationPerformance>, people: Person[] = []): PortfolioContext {
  const name = (id?: string) => (id ? people.find((p) => p.id === id)?.name ?? 'Unassigned' : 'Unassigned')
  const sev = ['critical', 'high', 'medium', 'low']
  return {
    kind: 'portfolio',
    solutions: items.map((i) => ({
      id: i.bundle.solution.id,
      name: i.bundle.solution.name,
      stage: stageDef(i.bundle.solution.stage).name,
      riskTier: riskTierDef(i.bundle.solution.riskTier).name,
      readiness: i.readiness.overall,
      expected: i.readiness.expected,
      status: i.health.status,
      statusReasons: i.health.reasons,
      nextBestAction: i.next.title,
      openGateRequirements: i.gate.unmet.length,
      expectedValueUsd: i.bundle.solution.expectedValue,
      realizedValueUsd: i.bundle.solution.realizedValue,
    })),
    insights,
    risks: items
      .flatMap((i) => i.bundle.risks.filter((r) => r.status === 'open' || r.status === 'mitigating').map((r) => ({ r, solution: i.bundle.solution.name })))
      .sort((a, b) => sev.indexOf(a.r.severity) - sev.indexOf(b.r.severity))
      .slice(0, 30)
      .map(({ r, solution }) => ({ solution, title: r.title, severity: SEVERITY[r.severity], status: RISK_STATUS[r.status], mitigation: r.mitigation || 'None recorded', owner: name(r.ownerId) })),
    delivery: perf && {
      gatePassRatePct: perf.passRate ?? null,
      avgDaysToProduction: perf.avgToProduction ?? null,
      blockedActivities: perf.blocked,
      overdueActivities: perf.overdue,
      reworkRatePct: perf.reworkRate,
      stages: bottlenecks(items).map((b) => ({ name: b.name, solutions: b.solutions, avgDays: b.avgDays, typicalDays: b.typicalDays, blocked: b.blocked, openGateItems: b.openRequirements, primaryReason: b.primaryReason })),
    },
    aiMetrics: aiPerformanceRows(items).flatMap((row) =>
      row.cells.filter((m) => m && m.current !== undefined).map((m) => ({ solution: row.solution.name, name: m!.name, current: m!.current ?? null, target: m!.target ?? null, unit: m!.unit, health: METRIC_HEALTH_LABEL[metricHealth(m!).status] })),
    ),
    adoption: adoptionRows(items).map((r) => ({ solution: r.solution.name, adoptionRatePct: r.rate ?? null, activeUsers: r.active ?? null, eligibleUsers: r.eligible ?? null })),
  }
}
