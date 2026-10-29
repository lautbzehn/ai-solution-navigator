import { DIMENSIONS, readinessScopeEnd, stageDef, stageOrder, STAGE_IDS } from '@/config'
import { evidenceForActivity, type SolutionBundle, type Weights } from './db'
import type { Activity, ActivityStatus, DimensionId, Evidence, EvidenceStatus, StageId } from './types'

/* Implementation Readiness
   ------------------------
   How prepared the overall implementation is to reach (and run in) production.
   It is NOT a measure of AI safety or model quality alone.

   · Each required activity in scope earns credit by status.
   · Completed work counts when its evidence is approved. Until then it earns
     part of the credit, by how far the evidence has got: in review 0.7, draft
     0.4. Missing evidence earns nothing on a gate-blocking activity, the same
     as the gate, and 0.3 on any other. A checked box is not proof.
   · Open high-severity risks without mitigation pull Risk & Governance down.
   · Dimension scores roll up by configurable weights. */

const STATUS_CREDIT: Record<ActivityStatus, number> = {
  complete: 1,
  in_progress: 0.4,
  blocked: 0.15,
  not_started: 0,
  not_applicable: 0,
}

const COMPLETE_EVIDENCE_CREDIT: Record<Exclude<EvidenceStatus, 'missing'>, number> = {
  approved: 1,
  not_required: 1,
  in_review: 0.7,
  draft: 0.4,
}

const COMPLETE_MISSING_CREDIT = { blocking: 0, other: 0.3 }

export function activityCredit(activity: Activity, evidence?: Evidence): number {
  if (activity.status === 'complete') {
    if (!activity.evidenceTemplateId || !evidence) return 1
    if (evidence.status === 'missing') return activity.blocking ? COMPLETE_MISSING_CREDIT.blocking : COMPLETE_MISSING_CREDIT.other
    return COMPLETE_EVIDENCE_CREDIT[evidence.status]
  }
  let credit = STATUS_CREDIT[activity.status]
  if (activity.status === 'in_progress' && evidence && (evidence.status === 'draft' || evidence.status === 'in_review')) credit += 0.1
  return credit
}

export interface ReadinessGap {
  activityId: string
  name: string
  stage: StageId
  status: ActivityStatus
  evidenceStatus?: EvidenceStatus
  ownerId: string
  /** Overall readiness points gained if this gap is fully closed. */
  points: number
}

export interface ReadinessModifier {
  label: string
  points: number
}

export interface DimensionScore {
  id: DimensionId
  name: string
  description: string
  /** Normalized weight as a percentage of the total. */
  weight: number
  score: number
  total: number
  complete: number
  awaitingEvidence: number
  explanation: string
  improve: string
  gaps: ReadinessGap[]
  modifiers: ReadinessModifier[]
}

export type Pace = 'on_pace' | 'behind' | 'well_behind'

export interface Readiness {
  overall: number
  expected: number
  pace: Pace
  dimensions: DimensionScore[]
  stageProgress: Record<StageId, number>
  scopeEnd: StageId
}

export function paceFor(score: number, expected: number): Pace {
  if (score >= expected) return 'on_pace'
  if (score >= expected - 10) return 'behind'
  return 'well_behind'
}

const STATUS_WORD: Record<ActivityStatus, string> = {
  not_started: 'not started',
  in_progress: 'in progress',
  blocked: 'blocked',
  complete: 'complete',
  not_applicable: 'n/a',
}

export function computeReadiness(bundle: SolutionBundle, weights: Weights): Readiness {
  const { solution } = bundle
  const scopeEnd = readinessScopeEnd(solution.stage)
  const scopeIdx = stageOrder(scopeEnd)
  const totalWeight = DIMENSIONS.reduce((n, d) => n + (weights[d.id] ?? 0), 0) || 1

  const inScope = bundle.activities.filter(
    (a) => a.required && a.status !== 'not_applicable' && stageOrder(a.stage) <= scopeIdx,
  )

  const dimensions: DimensionScore[] = DIMENSIONS.map((def) => {
    const items = inScope.filter((a) => a.dimension === def.id)
    const w = weights[def.id] ?? 0
    const normWeight = (w / totalWeight) * 100
    let sum = 0
    let complete = 0
    let awaitingEvidence = 0
    const gaps: ReadinessGap[] = []
    for (const a of items) {
      const ev = evidenceForActivity(bundle, a)
      const c = activityCredit(a, ev)
      sum += c
      if (a.status === 'complete') {
        complete++
        if (c < 1) awaitingEvidence++
      }
      if (c < 1) {
        gaps.push({
          activityId: a.id,
          name: a.name,
          stage: a.stage,
          status: a.status,
          evidenceStatus: ev?.status,
          ownerId: a.ownerId,
          points: ((1 - c) / items.length) * normWeight,
        })
      }
    }

    const modifiers: ReadinessModifier[] = []
    if (def.id === 'risk_governance') {
      let penalty = 0
      for (const r of bundle.risks) {
        if (r.status !== 'open' && r.status !== 'mitigating') continue
        if (r.severity !== 'high' && r.severity !== 'critical') continue
        if (!r.mitigation.trim()) {
          penalty += 8
          modifiers.push({ label: `"${r.title}" has no mitigation`, points: -8 })
        } else if (r.status === 'open') {
          penalty += 3
          modifiers.push({ label: `"${r.title}" mitigation not yet underway`, points: -3 })
        }
      }
      if (penalty > 25) modifiers.splice(0, modifiers.length, { label: 'Multiple high-severity risks lack mitigation', points: -25 })
    }

    const base = items.length ? (sum / items.length) * 100 : 100
    const modTotal = modifiers.reduce((n, m) => n + m.points, 0)
    const score = Math.round(Math.max(0, Math.min(100, base + modTotal)))

    gaps.sort((a, b) => b.points - a.points)

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      weight: Math.round(normWeight * 10) / 10,
      score,
      total: items.length,
      complete,
      awaitingEvidence,
      gaps,
      modifiers,
      explanation: explain(items.length, complete, awaitingEvidence, gaps, modifiers),
      improve: gaps.length
        ? `Completing "${gaps[0].name}" adds about ${gaps[0].points.toFixed(1)} points to overall readiness.`
        : modifiers.length
          ? 'Add mitigations to the open high-severity risks.'
          : 'Nothing outstanding in scope.',
    }
  })

  const overall = Math.round(
    dimensions.reduce((n, d) => n + d.score * ((weights[d.id] ?? 0) / totalWeight), 0),
  )
  const expected = stageDef(solution.stage).expectedReadiness

  return {
    overall,
    expected,
    pace: paceFor(overall, expected),
    dimensions,
    stageProgress: stageProgress(bundle),
    scopeEnd,
  }
}

function explain(total: number, complete: number, awaiting: number, gaps: ReadinessGap[], mods: ReadinessModifier[]) {
  if (!total) return 'No required work for this dimension is in scope yet.'
  const parts: string[] = []
  if (!gaps.length) parts.push(`All ${total} required activities in scope are complete and evidenced.`)
  else {
    parts.push(`${complete} of ${total} required activities complete.`)
    const open = gaps.filter((g) => g.status !== 'complete')
    if (open[0]) {
      const more = open.length > 1 ? ` and ${open.length - 1} more` : ''
      parts.push(`Outstanding: ${open[0].name} (${STATUS_WORD[open[0].status]})${more}.`)
    }
  }
  if (awaiting) parts.push(`${awaiting} completed ${awaiting === 1 ? 'activity still lacks' : 'activities still lack'} approved evidence.`)
  if (mods.length) parts.push(mods.map((m) => `${m.label} (${m.points}).`).join(' '))
  return parts.join(' ')
}

export function stageProgress(bundle: SolutionBundle): Record<StageId, number> {
  const out = {} as Record<StageId, number>
  for (const stage of STAGE_IDS) {
    const items = bundle.activities.filter((a) => a.stage === stage && a.required && a.status !== 'not_applicable')
    if (!items.length) {
      out[stage] = 0
      continue
    }
    const sum = items.reduce((n, a) => n + activityCredit(a, evidenceForActivity(bundle, a)), 0)
    out[stage] = Math.round((sum / items.length) * 100)
  }
  return out
}
