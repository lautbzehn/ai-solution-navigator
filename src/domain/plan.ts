import { evidenceTemplate, isBlocking, isRequired, lifecycle } from '@/config'
import { uid } from './db'
import type { Activity, ActivityTemplate, Evidence, RiskTier, Solution } from './types'

/* The implementation plan for a solution is instantiated from the lifecycle
   methodology. Risk tier decides which controls are required and blocking, so
   changing the tier re-shapes the plan instead of being a cosmetic label. */

const applies = (t: ActivityTemplate, tier: RiskTier) => isRequired(t, tier) || t.requiredFor.length === 0

function ownerFor(solution: Solution, roleId: string) {
  return (
    solution.team.find((m) => m.roleId === roleId)?.personId ??
    solution.team.find((m) => m.roleId === 'product_manager')?.personId ??
    solution.ownerId
  )
}

function makeActivity(solution: Solution, t: ActivityTemplate, now: string): Activity {
  const ownerId = ownerFor(solution, t.ownerRole)
  return {
    id: uid('act'),
    solutionId: solution.id,
    stage: t.stage,
    templateId: t.id,
    name: t.name,
    description: t.description,
    dimension: t.dimension,
    ownerId,
    contributorIds: Array.from(
      new Set(
        t.contributorRoles
          .map((r) => solution.team.find((m) => m.roleId === r)?.personId)
          .filter((x): x is string => !!x && x !== ownerId),
      ),
    ),
    status: 'not_started',
    priority: t.priority,
    required: isRequired(t, solution.riskTier),
    blocking: isBlocking(t, solution.riskTier),
    evidenceTemplateId: t.evidence ?? undefined,
    comments: [],
    createdAt: now,
  }
}

function makeEvidence(solution: Solution, activity: Activity, now: string): Evidence | undefined {
  if (!activity.evidenceTemplateId) return undefined
  const tpl = evidenceTemplate(activity.evidenceTemplateId)
  if (!tpl) return undefined
  return {
    id: uid('ev'),
    solutionId: solution.id,
    stage: activity.stage,
    templateId: tpl.id,
    activityId: activity.id,
    name: tpl.name,
    type: tpl.type,
    ownerId: activity.ownerId,
    status: 'missing',
    required: activity.required,
    date: now,
  }
}

export function instantiatePlan(solution: Solution, now: string) {
  const activities: Activity[] = []
  const evidence: Evidence[] = []
  for (const t of lifecycle.activityTemplates) {
    if (!applies(t, solution.riskTier)) continue
    const a = makeActivity(solution, t, now)
    activities.push(a)
    const ev = makeEvidence(solution, a, now)
    if (ev) evidence.push(ev)
  }
  return { activities, evidence }
}

export interface TierReconciliation {
  activities: Activity[]
  evidence: Evidence[]
  added: string[]
  nowRequired: string[]
  relaxed: string[]
}

/** Re-shape an existing plan for a new risk tier, preserving all progress. */
export function reconcileTier(solution: Solution, activities: Activity[], evidence: Evidence[], tier: RiskTier, now: string): TierReconciliation {
  const next = { ...solution, riskTier: tier }
  const added: string[] = []
  const nowRequired: string[] = []
  const relaxed: string[] = []
  const outActs: Activity[] = []
  const outEv = [...evidence]

  for (const a of activities) {
    const t = a.templateId ? lifecycle.activityTemplates.find((x) => x.id === a.templateId) : undefined
    if (!t) {
      outActs.push(a)
      continue
    }
    const required = isRequired(t, tier)
    const blocking = isBlocking(t, tier)
    if (required && !a.required) nowRequired.push(a.name)
    if (!required && a.required) relaxed.push(a.name)
    outActs.push({ ...a, required, blocking })
    const evIdx = outEv.findIndex((e) => e.activityId === a.id)
    if (evIdx >= 0) outEv[evIdx] = { ...outEv[evIdx], required }
  }

  for (const t of lifecycle.activityTemplates) {
    if (!applies(t, tier)) continue
    if (activities.some((a) => a.templateId === t.id)) continue
    const a = makeActivity(next, t, now)
    outActs.push(a)
    added.push(a.name)
    const ev = makeEvidence(next, a, now)
    if (ev) outEv.push(ev)
  }

  return { activities: outActs, evidence: outEv, added, nowRequired, relaxed }
}
