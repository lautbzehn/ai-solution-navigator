import { activityTemplate, nextStage, stageDef } from '@/config'
import type { SolutionBundle } from './db'
import { gateLabel, type CriterionResult, type GateResult } from './gates'
import type { Readiness } from './readiness'

export interface NextAction {
  kind: 'unblock' | 'complete_activity' | 'approve_evidence' | 'gate_criterion' | 'advance' | 'sustain'
  title: string
  why: string
  ownerId?: string
  impact: string
  blocking: boolean
  activityId?: string
  evidenceId?: string
  criterionId?: string
  /** Workspace tab where the action is taken, for non-activity actions. */
  tab?: 'risks' | 'team' | 'metrics' | 'overview'
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

function rankCriterion(c: CriterionResult) {
  // In-flight work first (closest to done), then priority, then due date.
  const statusRank = c.activityStatus === 'complete' ? 0 : c.activityStatus === 'in_progress' ? 1 : c.activityStatus === 'blocked' ? 2 : 3
  const due = c.dueDate ? new Date(c.dueDate).getTime() : Number.MAX_SAFE_INTEGER
  // Blocked work and unmitigated high-severity risks come before everything else.
  const urgent = c.activityStatus === 'blocked' || c.kind === 'risks' ? -1 : 0
  return [urgent, PRIORITY_RANK[c.priority ?? 'medium'], due, statusRank] as const
}

export function sortUnmet(unmet: CriterionResult[]) {
  return [...unmet].sort((a, b) => {
    const ra = rankCriterion(a)
    const rb = rankCriterion(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return 0
  })
}

/** Deterministic next best action: the single most useful thing the PM can drive now. */
export function nextBestAction(bundle: SolutionBundle, gate: GateResult, readiness: Readiness): NextAction {
  const { solution } = bundle
  const label = gateLabel(solution.stage)
  const remaining = gate.unmet.length

  if (gate.isFinal) {
    const open = bundle.activities.find((a) => a.stage === solution.stage && a.required && a.status !== 'complete' && a.status !== 'not_applicable')
    if (open) {
      return {
        kind: 'complete_activity',
        title: `${open.name}`,
        why: activityTemplate(open.templateId ?? '')?.why ?? open.description,
        ownerId: open.ownerId,
        impact: 'Keeps the solution healthy in continuous improvement.',
        blocking: false,
        activityId: open.id,
      }
    }
    return {
      kind: 'sustain',
      title: 'Review value and decide: invest, sustain, or retire',
      why: 'All improvement activities are complete. Use realized value and adoption data to decide the next horizon.',
      impact: 'Keeps the portfolio focused on solutions that deliver value.',
      blocking: false,
    }
  }

  if (!remaining) {
    const next = nextStage(solution.stage)!
    return {
      kind: 'advance',
      title: `Request the ${label} gate review`,
      why: `All ${gate.criteria.length} gate requirements are met. Record the gate decision to move into ${stageDef(next).name}.`,
      impact: `Moves the solution into ${stageDef(next).name}.`,
      blocking: false,
    }
  }

  const [top] = sortUnmet(gate.unmet)
  const pointsFor = (activityId?: string) => {
    if (!activityId) return 0
    for (const d of readiness.dimensions) {
      const g = d.gaps.find((x) => x.activityId === activityId)
      if (g) return g.points
    }
    return 0
  }
  const blockingNote = remaining === 1 ? `It is the last requirement blocking the ${label} gate.` : `It is one of ${remaining} requirements blocking the ${label} gate.`

  if (top.kind === 'activity' && top.activityId) {
    const activity = bundle.activities.find((a) => a.id === top.activityId)!
    const tpl = activityTemplate(activity.templateId ?? '')
    const pts = pointsFor(activity.id)
    const ptsNote = pts >= 1 ? ` Closing it adds about ${pts.toFixed(1)} readiness points.` : ''

    if (activity.status === 'blocked') {
      return {
        kind: 'unblock',
        title: `Unblock "${activity.name}"`,
        why: `${activity.blockedReason ? `Blocked: ${activity.blockedReason}. ` : ''}${tpl?.why ?? ''}`.trim(),
        ownerId: activity.ownerId,
        impact: `${blockingNote}${ptsNote}`,
        blocking: true,
        activityId: activity.id,
        criterionId: top.id,
      }
    }
    if (activity.status === 'complete' && top.evidenceId) {
      const ev = bundle.evidence.find((e) => e.id === top.evidenceId)!
      return {
        kind: 'approve_evidence',
        title: `Get the ${ev.name} approved`,
        why: `"${activity.name}" is marked complete, but the gate needs approved evidence, not just a checked box. The ${ev.name} is currently ${ev.status.replace('_', ' ')}.`,
        ownerId: ev.ownerId,
        impact: `${blockingNote}${ptsNote}`,
        blocking: true,
        activityId: activity.id,
        evidenceId: ev.id,
        criterionId: top.id,
      }
    }
    return {
      kind: 'complete_activity',
      title: `${activity.name} before requesting the ${label} gate`,
      why: tpl ? `${tpl.why} ${tpl.consequence}` : activity.description,
      ownerId: activity.ownerId,
      impact: `${blockingNote}${ptsNote}`,
      blocking: true,
      activityId: activity.id,
      evidenceId: top.evidenceId,
      criterionId: top.id,
    }
  }

  const risky = top.kind === 'risks' ? bundle.risks.find((r) => (r.status === 'open' || r.status === 'mitigating') && (r.severity === 'critical' || r.severity === 'high') && (!r.mitigation.trim() || !r.ownerId)) : undefined
  const title =
    risky ? `Define a mitigation for "${risky.title}"`
    : top.kind === 'role' ? `Assign the missing owners (${top.detail.replace('Missing: ', '')})`
    : top.kind === 'metrics' ? 'Define success metrics with baselines and targets'
    : top.kind === 'metric_threshold' ? 'Measure the feasibility result against its threshold'
    : top.kind === 'field' ? `Document the ${top.label.replace(/ (documented|defined)$/i, '').toLowerCase()}`
    : top.label
  return {
    kind: 'gate_criterion',
    title,
    why: risky
      ? `${risky.severity === 'critical' ? 'A critical' : 'A high-severity'} ${risky.category} risk has no mitigation: ${risky.impact} Unmitigated high-severity risks lower Risk & Governance readiness and block the gate.`
      : `${top.description} Current state: ${top.detail}.`,
    ownerId: risky?.ownerId,
    tab: risky ? 'risks' : top.kind === 'role' ? 'team' : top.kind === 'metrics' || top.kind === 'metric_threshold' ? 'metrics' : 'overview',
    impact: blockingNote,
    blocking: true,
    criterionId: top.id,
  }
}
