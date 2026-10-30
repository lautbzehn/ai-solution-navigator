/* Form validation. Pure functions returning human-readable messages keyed by
   field, so every form shows the same inline, specific feedback. */

import { approvalProblem, moveProblem } from './evidence'
import { RISK_TIER } from './labels'
import type { Activity, Evidence, RiskTier, Solution, TeamMember } from './types'

export type Errors<K extends string = string> = Partial<Record<K, string>>

export const hasErrors = (e: Errors) => Object.values(e).some(Boolean)

export function required(value: string | undefined, label: string) {
  return value && value.trim() ? undefined : `${label} is required.`
}

const FILLER = /^(tbd|todo|n\/?a|none|test|asdf|xxx+|\.+|-+|\?+)$/i

/** Meaningful text: long enough, more than one word, and not a placeholder. */
export function meaningful(value: string | undefined, label: string, minChars = 15) {
  const v = (value ?? '').trim()
  if (!v) return `${label} is required.`
  if (FILLER.test(v)) return `${label} needs real content, not a placeholder.`
  if (v.length < minChars) return `${label} is too brief. Describe it in at least ${minChars} characters.`
  if (v.split(/\s+/).length < 3) return `${label} should be a short phrase or sentence, not a single word.`
  return undefined
}

/** Optional numeric input. Returns [error, parsed]. */
export function numeric(raw: string | undefined, label: string, opts: { min?: number; max?: number; required?: boolean } = {}): [string | undefined, number | undefined] {
  const v = (raw ?? '').trim().replace(/[$,\s]/g, '')
  if (!v) return [opts.required ? `${label} is required.` : undefined, undefined]
  const n = Number(v)
  if (!Number.isFinite(n)) return [`${label} must be a number.`, undefined]
  if (opts.min !== undefined && n < opts.min) return [`${label} can't be less than ${opts.min.toLocaleString()}.`, undefined]
  if (opts.max !== undefined && n > opts.max) return [`${label} can't be more than ${opts.max.toLocaleString()}.`, undefined]
  return [undefined, n]
}

/** Date from an <input type="date"> value. */
export function validDate(raw: string | undefined, label: string, opts: { notBefore?: string; notBeforeLabel?: string; required?: boolean } = {}) {
  if (!raw) return opts.required ? `${label} is required.` : undefined
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return `${label} isn't a valid date.`
  const year = d.getFullYear()
  if (year < 2000 || year > 2100) return `${label} must be between 2000 and 2100.`
  if (opts.notBefore) {
    const floor = new Date(opts.notBefore)
    floor.setHours(0, 0, 0, 0)
    if (d.getTime() < floor.getTime()) return `${label} can't be before ${opts.notBeforeLabel ?? floor.toLocaleDateString()}.`
  }
  return undefined
}

export const UNITS = ['%', 'min', 'hours', 'days', 'months', 'USD', 'users', 'tickets', 'sessions', 'score', 'per 1k', 'count'] as const

/** Metric values must be consistent with the unit and the direction of improvement. */
export function metricValues(
  values: { baseline?: number; target?: number; current?: number },
  unit: string,
  direction: 'increase' | 'decrease',
): Errors<'baseline' | 'target' | 'current'> {
  const e: Errors<'baseline' | 'target' | 'current'> = {}
  const check = (k: 'baseline' | 'target' | 'current', v?: number) => {
    if (v === undefined) return
    if (unit === '%' && (v < 0 || v > 100)) e[k] = 'Percentages must be between 0 and 100.'
    else if (unit === 'score' && (v < 0 || v > 5)) e[k] = 'Scores use a 0–5 scale.'
    else if (['min', 'hours', 'days', 'months', 'users', 'tickets', 'sessions', 'count', 'per 1k', 'USD'].includes(unit) && v < 0) e[k] = `${unit === 'USD' ? 'Dollar values' : 'This unit'} can't be negative.`
  }
  check('baseline', values.baseline)
  check('target', values.target)
  check('current', values.current)
  if (!e.target && values.baseline !== undefined && values.target !== undefined && values.baseline !== values.target) {
    if (direction === 'increase' && values.target < values.baseline) e.target = 'Target is below the baseline, but this metric should increase. Flip the direction or adjust the target.'
    if (direction === 'decrease' && values.target > values.baseline) e.target = 'Target is above the baseline, but this metric should decrease. Flip the direction or adjust the target.'
  }
  return e
}

/* Store rules
   -----------
   Every activity, evidence, and solution patch is checked here before the
   store writes it, so a rule holds no matter which screen made the change.
   Each returns why the patch is refused, or undefined when it's fine. */

const STAGE_FIELDS = ['stage', 'state', 'stateReason', 'stateChangedAt', 'stageHistory'] as const
const APPROVAL_FIELDS = ['approvedById', 'approvedAt', 'approvalNote'] as const

/** Required work can't be waved off as Not Applicable. */
export function activityPatchProblem(activity: Pick<Activity, 'required'>, patch: Partial<Activity>, tier: RiskTier): string | undefined {
  if (patch.status === 'not_applicable' && (patch.required ?? activity.required)) {
    return `Required activities can't be marked Not Applicable for a ${RISK_TIER[tier].toLowerCase()}-risk solution.`
  }
  return undefined
}

/** Evidence moves Missing to Draft to In Review. Approval goes through evidenceApprovalProblem alone. */
export function evidencePatchProblem(evidence: Pick<Evidence, 'status'>, patch: Partial<Evidence>): string | undefined {
  if (APPROVAL_FIELDS.some((k) => k in patch)) return 'Use Approve, so the app records who approved it.'
  return patch.status ? moveProblem(evidence.status, patch.status) : undefined
}

/** Approval needs an approver who isn't the owner, evidence in review, and a one-line note. */
export function evidenceApprovalProblem(evidence: Pick<Evidence, 'status' | 'ownerId'>, approverId: string | undefined, team: TeamMember[], note: string): string | undefined {
  if (!approverId) return 'Choose who is approving this evidence.'
  return approvalProblem(evidence, approverId, team, note)
}

/** Stage and lifecycle state change only at the gate. */
export function solutionPatchProblem(patch: Partial<Solution>): string | undefined {
  return STAGE_FIELDS.some((k) => k in patch) ? 'Stage changes happen at the gate: Go, Hold, Stop, or Resume.' : undefined
}
