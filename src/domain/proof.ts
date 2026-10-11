import type { SolutionBundle } from './db'
import { daysSince } from './time'
import type { PocCharter, PocResults, ProofCheck, Solution } from './types'

/* Proof of concept
   ----------------
   Nothing gets build money until a time-boxed proof on real data clears the
   thresholds its charter set before the work started. The charter and results
   live on the solution; the Proof gate reads them through `proofCheck`, and the
   Scale Potential score explains the decision line by line. */

/** First attempt plus two iterations. */
export const MAX_PROOF_ATTEMPTS = 3

export function defaultCharter(solution: Pick<Solution, 'riskTier'>): PocCharter {
  return {
    hypothesis: '',
    timeboxWeeks: 4,
    budget: 25_000,
    pilotUserCap: 25,
    qualityTarget: 85,
    goldenSetSize: solution.riskTier === 'high' ? 200 : 50,
    valueTarget: 15,
    costCeilingPct: 20,
    iteration: 1,
  }
}

/** A charter is agreed once it has a real hypothesis and every threshold is set. */
export function charterGaps(c?: PocCharter): string[] {
  if (!c) return ['hypothesis', 'thresholds']
  const gaps: string[] = []
  if (c.hypothesis.trim().length < 15) gaps.push('hypothesis')
  if (!(c.timeboxWeeks > 0) || !(c.budget > 0)) gaps.push('timebox and budget')
  if (!(c.qualityTarget > 0) || !(c.goldenSetSize > 0) || !(c.valueTarget > 0) || !(c.costCeilingPct > 0)) gaps.push('thresholds')
  return gaps
}

const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`)

/** Annual run cost as a percent of expected annual value, when both are known. */
export function runCostPct(solution: Pick<Solution, 'expectedValue' | 'proof'>): number | undefined {
  const cost = solution.proof?.annualRunCost
  if (cost === undefined || !(solution.expectedValue > 0)) return undefined
  return Math.round((cost / solution.expectedValue) * 1000) / 10
}

export interface ProofCheckResult {
  met: boolean
  /** True once the thing being checked has been measured or written. */
  measured: boolean
  detail: string
}

export function proofCheck(solution: Solution, check: ProofCheck): ProofCheckResult {
  const c = solution.charter
  const r: PocResults = solution.proof ?? {}
  if (check === 'charter') {
    const gaps = charterGaps(c)
    return {
      met: gaps.length === 0,
      measured: !!c,
      detail: gaps.length === 0 ? `${c!.timeboxWeeks}-week PoC, ${usd(c!.budget)} cap, thresholds set` : c ? `Still missing: ${gaps.join(', ')}` : 'Not written yet',
    }
  }
  if (!c) return { met: false, measured: false, detail: 'Needs a PoC charter first' }
  if (check === 'quality') {
    if (r.quality === undefined) return { met: false, measured: false, detail: `Not measured yet · target ${c.qualityTarget}% on ${c.goldenSetSize} golden cases` }
    return { met: r.quality >= c.qualityTarget, measured: true, detail: `${r.quality}% on the golden set · target ${c.qualityTarget}%` }
  }
  if (check === 'value') {
    if (r.value === undefined) return { met: false, measured: false, detail: `Not measured yet · target ${c.valueTarget}% better than baseline` }
    return { met: r.value >= c.valueTarget, measured: true, detail: `${r.value}% better than baseline · target ${c.valueTarget}%` }
  }
  const pct = runCostPct(solution)
  if (r.annualRunCost === undefined) return { met: false, measured: false, detail: `Not estimated yet · ceiling ${c.costCeilingPct}% of expected value` }
  if (pct === undefined) return { met: false, measured: true, detail: 'Set an expected annual value to compare the run cost against' }
  return { met: pct <= c.costCeilingPct, measured: true, detail: `${usd(r.annualRunCost)} a year to run, ${pct}% of expected value · ceiling ${c.costCeilingPct}%` }
}

export interface ProveClock {
  totalDays: number
  elapsedDays: number
  remainingDays: number
  /** The timebox has run out and the sponsor owes a decision. */
  overdue: boolean
  pct: number
}

/** Where the PoC is against its timebox. Only meaningful while in Prove. */
export function proveClock(solution: Solution, now = Date.now()): ProveClock | undefined {
  if (solution.stage !== 'prove' || !solution.charter) return undefined
  const visit = [...solution.stageHistory].reverse().find((v) => v.stage === 'prove' && !v.exitedAt)
  if (!visit) return undefined
  const totalDays = Math.max(1, Math.round(solution.charter.timeboxWeeks * 7))
  const elapsedDays = daysSince(visit.enteredAt, now)
  return {
    totalDays,
    elapsedDays,
    remainingDays: totalDays - elapsedDays,
    overdue: elapsedDays > totalDays,
    pct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  }
}

export interface ScaleFactor {
  id: 'quality' | 'value' | 'economics' | 'data' | 'adoption' | 'commitment'
  label: string
  weight: number
  points: number
  detail: string
}

export type ScaleBand = 'ready' | 'promising' | 'not_yet'

export interface ScalePotential {
  score: number
  band: ScaleBand
  factors: ScaleFactor[]
  /** False until at least one PoC result is recorded. */
  measured: boolean
}

export const SCALE_BAND: Record<ScaleBand, { label: string; hint: string }> = {
  ready: { label: 'Ready to scale', hint: 'The evidence supports funding the build.' },
  promising: { label: 'Promising', hint: 'Close the gaps or run one more iteration before scaling.' },
  not_yet: { label: 'Not viable yet', hint: 'Iterate, pivot, or stop. Stopping now is a good outcome.' },
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** A 0 to 100 score for the Proof gate, explained factor by factor. The weights
    are a starting proposal: quality 30, value 25, unit economics 20, production
    data 10, pilot adoption 10, sponsor commitment 5. */
export function scalePotential(bundle: SolutionBundle): ScalePotential {
  const { solution } = bundle
  const c = solution.charter
  const r = solution.proof ?? {}
  const factors: ScaleFactor[] = []

  // Quality earns full credit at the target and none 25 points below it: a
  // pass rate in the 70s against a target of 85 is a real miss, not "close".
  if (r.quality === undefined || !c) factors.push({ id: 'quality', label: 'Quality on the golden set', weight: 30, points: 0, detail: 'Not measured yet' })
  else factors.push({ id: 'quality', label: 'Quality on the golden set', weight: 30, points: Math.round(30 * clamp01((r.quality - (c.qualityTarget - 25)) / 25)), detail: `${r.quality}% against a target of ${c.qualityTarget}%` })
  // Value earns credit in proportion to the target.
  if (r.value === undefined || !c) factors.push({ id: 'value', label: 'Value signal', weight: 25, points: 0, detail: 'Not measured yet' })
  else factors.push({ id: 'value', label: 'Value signal', weight: 25, points: Math.round(25 * clamp01(Math.max(0, r.value) / c.valueTarget)), detail: `${r.value}% better than baseline against a target of ${c.valueTarget}%` })

  const pct = runCostPct(solution)
  if (pct === undefined || !c) factors.push({ id: 'economics', label: 'Unit economics', weight: 20, points: 0, detail: 'Run cost not estimated yet' })
  else {
    const ceiling = c.costCeilingPct
    const points = pct <= ceiling ? 20 : Math.round(20 * clamp01((2 * ceiling - pct) / ceiling))
    factors.push({ id: 'economics', label: 'Unit economics', weight: 20, points, detail: `Run cost is ${pct}% of expected value (ceiling ${ceiling}%)` })
  }

  const data = bundle.activities.find((a) => a.templateId === 'p_prod_data')
  const dataEv = data ? bundle.evidence.find((e) => e.activityId === data.id) : undefined
  const dataPts = !data ? 0 : data.status === 'complete' ? (!dataEv || dataEv.status === 'approved' ? 10 : 7) : data.status === 'in_progress' ? 4 : 0
  factors.push({ id: 'data', label: 'Production data ready', weight: 10, points: dataPts, detail: !data ? 'No data check in the plan' : dataPts === 10 ? 'Access and rights confirmed' : dataPts === 7 ? 'Confirmed, evidence awaiting approval' : dataPts === 4 ? 'Confirmation in progress' : 'Not confirmed yet' })

  if (r.pilotAdoption === undefined) factors.push({ id: 'adoption', label: 'Pilot user adoption', weight: 10, points: 0, detail: 'No pilot feedback yet' })
  else factors.push({ id: 'adoption', label: 'Pilot user adoption', weight: 10, points: Math.round(10 * clamp01(r.pilotAdoption / 100)), detail: `${r.pilotAdoption}% of ${r.pilotUsers ?? 'the'} pilot users would keep using it` })

  const sponsor = solution.team.some((m) => m.roleId === 'executive_sponsor')
  const plan = bundle.activities.find((a) => a.templateId === 'p_scale_plan')
  const commitment = !sponsor ? 0 : plan?.status === 'complete' ? 5 : 3
  factors.push({ id: 'commitment', label: 'Sponsor commitment', weight: 5, points: commitment, detail: !sponsor ? 'No executive sponsor named' : commitment === 5 ? 'Sponsor named and scale plan written' : 'Sponsor named; scale plan not written yet' })

  const score = factors.reduce((n, f) => n + f.points, 0)
  return {
    score,
    band: score >= 75 ? 'ready' : score >= 50 ? 'promising' : 'not_yet',
    factors,
    measured: r.quality !== undefined || r.value !== undefined || r.annualRunCost !== undefined || r.pilotAdoption !== undefined,
  }
}
