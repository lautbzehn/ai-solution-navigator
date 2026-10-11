import { gateFor, isFinalStage, nextStage, roleName, stageDef } from '@/config'
import { evidenceForActivity, type SolutionBundle } from './db'
import type { ActivityStatus, EvidenceStatus, GateDef, StageId } from './types'

/* Gate validation
   ---------------
   A stage's exit gate is the union of:
   · every blocking activity instantiated for that stage (blocking is set per
     risk tier in lifecycle.json — higher risk ⇒ more blocking controls), each
     of which also needs approved evidence when evidence is expected, and
   · the gate's explicit criteria (fields, roles, metrics, risk rules).
   The UI never just disables a button: every unmet criterion says why. */

export type CriterionKind = 'activity' | 'field' | 'role' | 'metrics' | 'risks'

export interface CriterionResult {
  id: string
  kind: CriterionKind
  label: string
  description: string
  met: boolean
  /** Short human explanation of the current state. */
  detail: string
  activityId?: string
  evidenceId?: string
  ownerId?: string
  activityStatus?: ActivityStatus
  evidenceStatus?: EvidenceStatus
  dueDate?: string
  priority?: 'high' | 'medium' | 'low'
}

export interface GateResult {
  stage: StageId
  nextStage?: StageId
  gate?: GateDef
  criteria: CriterionResult[]
  unmet: CriterionResult[]
  canAdvance: boolean
  isFinal: boolean
}

const ACT_WORD: Record<ActivityStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  complete: 'Complete',
  not_applicable: 'Not applicable',
}
const EV_WORD: Record<EvidenceStatus, string> = {
  missing: 'missing',
  draft: 'in draft',
  in_review: 'in review',
  approved: 'approved',
  not_required: 'not required',
}

export function evaluateGate(bundle: SolutionBundle, stage: StageId = bundle.solution.stage): GateResult {
  const { solution } = bundle
  const gate = gateFor(stage)
  const criteria: CriterionResult[] = []

  // Blocking activities for this stage.
  for (const a of bundle.activities) {
    if (a.stage !== stage || !a.blocking || a.status === 'not_applicable') continue
    const ev = a.evidenceTemplateId ? evidenceForActivity(bundle, a) : undefined
    const evidenceOk = !a.evidenceTemplateId || !ev || ev.status === 'approved' || ev.status === 'not_required'
    const done = a.status === 'complete'
    let detail: string
    if (done && evidenceOk) detail = ev ? `Complete · ${ev.name} approved` : 'Complete'
    else if (done && ev) detail = `Activity complete, but ${ev.name} is ${EV_WORD[ev.status]}`
    else if (ev) detail = `${ACT_WORD[a.status]} · ${ev.name} ${EV_WORD[ev.status]}`
    else detail = ACT_WORD[a.status]
    criteria.push({
      id: `act:${a.id}`,
      kind: 'activity',
      label: a.name,
      description: a.description,
      met: done && evidenceOk,
      detail,
      activityId: a.id,
      evidenceId: ev?.id,
      ownerId: a.ownerId,
      activityStatus: a.status,
      evidenceStatus: ev?.status,
      dueDate: a.dueDate,
      priority: a.priority,
    })
  }

  for (const c of gate?.criteria ?? []) {
    switch (c.type) {
      case 'field': {
        const value = (solution[c.field] ?? '').trim()
        const met = value.length >= c.minLength
        criteria.push({ id: c.id, kind: 'field', label: c.label, description: c.description, met, detail: met ? 'Documented' : value ? 'Too brief to be meaningful' : 'Not yet documented' })
        break
      }
      case 'role': {
        const missing = c.roles.filter((r) => !solution.team.some((m) => m.roleId === r))
        criteria.push({
          id: c.id,
          kind: 'role',
          label: c.label,
          description: c.description,
          met: missing.length === 0,
          detail: missing.length ? `Missing: ${missing.map(roleName).join(', ')}` : 'All assigned',
        })
        break
      }
      case 'metrics': {
        const defined = bundle.metrics.filter(
          (m) => m.measurement !== 'not_applicable' && m.baseline !== undefined && m.target !== undefined && (!c.requireCurrent || m.current !== undefined),
        ).length
        criteria.push({
          id: c.id,
          kind: 'metrics',
          label: c.label,
          description: c.description,
          met: defined >= c.minDefined,
          detail: `${defined} of ${c.minDefined} required metrics ${c.requireCurrent ? 'measured' : 'defined'}`,
        })
        break
      }
      case 'risks': {
        const offending = bundle.risks.filter(
          (r) => (r.status === 'open' || r.status === 'mitigating') && (r.severity === 'high' || r.severity === 'critical') && (!r.mitigation.trim() || !r.ownerId),
        )
        criteria.push({
          id: c.id,
          kind: 'risks',
          label: c.label,
          description: c.description,
          met: offending.length === 0,
          detail: offending.length ? `${offending.length} high-severity ${offending.length === 1 ? 'risk lacks' : 'risks lack'} a mitigation: ${offending.map((r) => r.title).join('; ')}` : 'All high-severity risks have mitigations and owners',
        })
        break
      }
    }
  }

  const unmet = criteria.filter((c) => !c.met)
  const isFinal = isFinalStage(stage)
  return {
    stage,
    nextStage: nextStage(stage),
    gate,
    criteria,
    unmet,
    canAdvance: !isFinal && unmet.length === 0,
    isFinal,
  }
}

export function gateLabel(stage: StageId) {
  const next = nextStage(stage)
  return next ? `${stageDef(stage).name} → ${stageDef(next).name}` : stageDef(stage).name
}
