import { beforeEach, describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS, lifecycle, STAGE_IDS } from '@/config'
import { buildSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { bundleFor, type DB } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import { insightFor } from '@/domain/insight'
import { reconcileTier } from '@/domain/plan'
import { proofCheck, scalePotential } from '@/domain/proof'
import { computeReadiness } from '@/domain/readiness'
import { pocFunnel } from '@/domain/reports'
import { recommendRiskTier } from '@/domain/riskRecommend'
import { metricValues } from '@/domain/validation'

const insight = (db: DB, id: string) => insightFor(bundleFor(db, id)!, DEFAULT_WEIGHTS)

function complete(db: DB, solutionId: string, templateId: string) {
  const a = db.activities.find((x) => x.solutionId === solutionId && x.templateId === templateId)!
  a.status = 'complete'
  const ev = db.evidence.find((e) => e.activityId === a.id)
  if (ev) ev.status = 'approved'
}

describe('the lifecycle', () => {
  test('has five stages, ending in Run', () => {
    expect(STAGE_IDS).toEqual(['frame', 'prove', 'build', 'launch', 'run'])
  })

  test('every gate can stop or park a solution, and the Proof gate can iterate and pivot', () => {
    for (const g of lifecycle.gates.filter((x) => x.stage !== 'run')) {
      expect(g.outcomes).toEqual(expect.arrayContaining(['advance', 'park', 'stop']))
      expect(g.approverRoles.length).toBeGreaterThan(0)
    }
    expect(lifecycle.gates.find((g) => g.stage === 'prove')!.outcomes).toEqual(expect.arrayContaining(['iterate', 'pivot']))
    expect(lifecycle.gates.find((g) => g.stage === 'run')!.outcomes).toEqual(['sustain', 'retire'])
  })

  test('asks for about a third less required work than the eight-stage plan', () => {
    const required = (tier: 'low' | 'moderate' | 'high') => lifecycle.activityTemplates.filter((t) => t.requiredFor.includes(tier)).length
    expect(required('low')).toBeLessThanOrEqual(26)
    expect(required('moderate')).toBeLessThanOrEqual(33)
    expect(required('high')).toBeLessThanOrEqual(41)
  })
})

describe('primary demo: AI Customer Support Resolution Assistant', () => {
  test('sits at the end of Build with the three release blockers', () => {
    const i = insight(buildSeed(), 's_support')
    expect(i.bundle.solution.stage).toBe('build')
    expect(i.readiness.overall).toBe(73)
    expect(i.gate.unmet.map((u) => u.label).sort()).toEqual(['Complete UAT', 'Define production monitoring plan', 'Validate human oversight in practice'])
    expect(i.next.title).toMatch(/human oversight/i)
  })

  test('a completed activity without approved evidence does not satisfy the gate', () => {
    const db = buildSeed()
    db.activities.find((a) => a.id === 's_support__b_uat')!.status = 'complete'
    const gate = evaluateGate(bundleFor(db, 's_support')!)
    expect(gate.unmet.find((u) => u.activityId === 's_support__b_uat')?.detail).toMatch(/UAT Sign-off is missing/)
  })

  test('closing the blockers opens the gate and raises readiness', () => {
    const db = buildSeed()
    const before = computeReadiness(bundleFor(db, 's_support')!, DEFAULT_WEIGHTS).overall
    for (const t of ['b_oversight', 'b_uat', 'b_monitoring']) complete(db, 's_support', t)
    const after = insight(db, 's_support')
    expect(after.gate.canAdvance).toBe(true)
    expect(after.readiness.overall).toBeGreaterThan(before)
  })
})

describe('the Proof gate', () => {
  test('the Frame gate needs an agreed PoC charter', () => {
    const i = insight(buildSeed(), 's_incident')
    expect(i.gate.unmet.find((u) => u.kind === 'proof')?.detail).toMatch(/hypothesis/)
    expect(i.next.kind).toBe('proof')
  })

  test('reads PoC results against the charter thresholds', () => {
    const db = buildSeed()
    const s = db.solutions.find((x) => x.id === 's_contracts')!
    expect(proofCheck(s, 'quality').met).toBe(true)
    expect(proofCheck(s, 'value')).toMatchObject({ met: false, measured: false })
    s.proof = { ...s.proof, value: 38 }
    expect(proofCheck(s, 'value')).toMatchObject({ met: false, measured: true })
    s.proof = { ...s.proof, value: 44 }
    expect(proofCheck(s, 'value').met).toBe(true)
  })

  test('opens once the results clear the bar and the PoC work is approved', () => {
    const db = buildSeed()
    const s = db.solutions.find((x) => x.id === 's_contracts')!
    s.proof = { ...s.proof, value: 44, pilotAdoption: 83, pilotUsers: 6 }
    for (const t of ['p_prototype', 'p_eval_run', 'p_value_signal', 'p_unit_economics', 'p_prod_data', 'p_scale_plan']) complete(db, 's_contracts', t)
    const i = insight(db, 's_contracts')
    expect(i.gate.unmet).toEqual([])
    expect(scalePotential(i.bundle).band).toBe('ready')
  })

  test('a PoC that missed its charter scores as not viable', () => {
    const sp = scalePotential(bundleFor(buildSeed(), 's_minutes')!)
    expect(sp.band).toBe('not_yet')
    expect(sp.factors.find((f) => f.id === 'economics')!.points).toBe(0)
  })

  test('the funnel counts stopped ideas as a healthy kill rate', () => {
    const db = buildSeed()
    const f = pocFunnel(db.solutions.map((s) => insight(db, s.id)))
    expect(f.steps.map((s) => s.count)).toEqual([11, 10, 7, 2])
    expect(f.stoppedEarly).toBe(1)
    expect(f.killRate).toBe(13)
  })
})

describe('gate decisions', () => {
  beforeEach(() => useStore.getState().resetDemo())

  test('asking to advance before the work is ready is a failed attempt; looking is not', () => {
    const before = useStore.getState().gateAttempts.length
    evaluateGate(bundleFor(useStore.getState(), 's_support')!)
    expect(useStore.getState().gateAttempts.length).toBe(before)
    const r = useStore.getState().decideGate('s_support', { outcome: 'advance', ownerId: 'p_michael', rationale: 'Ship it to the pilot.' })
    expect(r.ok).toBe(false)
    expect(useStore.getState().gateAttempts.length).toBe(before + 1)
  })

  test('only an approver who is not the owner may decide', () => {
    const r = useStore.getState().decideGate('s_support', { outcome: 'park', ownerId: 'p_jim', rationale: 'Waiting on the data platform.' })
    expect(r).toMatchObject({ ok: false })
    expect(useStore.getState().decideGate('s_support', { outcome: 'park', ownerId: 'p_michael', rationale: 'Waiting on the data platform.' }).ok).toBe(true)
  })

  test('stop closes a solution and keeps the lesson; park can resume', () => {
    const { decideGate, resumeSolution } = useStore.getState()
    expect(decideGate('s_classifier', { outcome: 'stop', ownerId: 'p_michael', rationale: 'Labels too inconsistent to learn from.' }).ok).toBe(true)
    const stopped = insight(useStore.getState(), 's_classifier')
    expect(stopped.health.status).toBe('stopped')
    expect(stopped.gate.canAdvance).toBe(false)
    expect(stopped.bundle.solution.stageHistory.at(-1)!.exitedAt).toBeDefined()

    decideGate('s_sales', { outcome: 'park', ownerId: 'p_michael', rationale: 'CRM migration first, then resume.' })
    expect(insight(useStore.getState(), 's_sales').health.status).toBe('parked')
    resumeSolution('s_sales')
    expect(insight(useStore.getState(), 's_sales').health.status).not.toBe('parked')
  })

  test('iterate restarts the PoC with a fresh timebox, at most twice', () => {
    const { decideGate } = useStore.getState()
    expect(decideGate('s_contracts', { outcome: 'iterate', ownerId: 'p_michael', rationale: 'Add OCR clean-up and rerun.' }).ok).toBe(true)
    const s = useStore.getState().solutions.find((x) => x.id === 's_contracts')!
    expect(s.charter!.iteration).toBe(2)
    expect(s.proof).toEqual({})
    expect(s.stageHistory.filter((v) => v.stage === 'prove')).toHaveLength(2)
    decideGate('s_contracts', { outcome: 'iterate', ownerId: 'p_michael', rationale: 'One more pass on scanned PDFs.' })
    expect(decideGate('s_contracts', { outcome: 'iterate', ownerId: 'p_michael', rationale: 'And another one, please.' }).ok).toBe(false)
  })

  test('pivot goes back to Frame and asks for a new hypothesis', () => {
    useStore.getState().decideGate('s_contracts', { outcome: 'pivot', ownerId: 'p_michael', rationale: 'The pain is in intake, not review.' })
    const i = insight(useStore.getState(), 's_contracts')
    expect(i.bundle.solution.stage).toBe('frame')
    expect(i.gate.unmet.some((u) => u.kind === 'proof')).toBe(true)
  })
})

describe('risk-based rigor', () => {
  test('high risk requires more blocking controls than moderate, and moderate more than low', () => {
    const count = (tier: 'low' | 'moderate' | 'high') => lifecycle.activityTemplates.filter((t) => t.blockingFor.includes(tier)).length
    expect(count('high')).toBeGreaterThan(count('moderate'))
    expect(count('moderate')).toBeGreaterThan(count('low'))
  })

  test('raising a solution to High adds controls and keeps progress', () => {
    const db = buildSeed()
    const s = db.solutions.find((x) => x.id === 's_knowledge')!
    const acts = db.activities.filter((a) => a.solutionId === s.id)
    const r = reconcileTier(s, acts, db.evidence.filter((e) => e.solutionId === s.id), 'high', new Date().toISOString())
    expect(r.added.length).toBeGreaterThan(0)
    expect(r.activities.filter((a) => a.status === 'complete').length).toBe(acts.filter((a) => a.status === 'complete').length)
  })

  test('autonomy or regulated data recommends High', () => {
    expect(recommendRiskTier({ patterns: ['agent'], audience: 'internal', sensitivity: 'internal', autonomous: false, criticality: 'helpful' }).tier).toBe('high')
    expect(recommendRiskTier({ patterns: ['knowledge_retrieval'], audience: 'internal', sensitivity: 'internal', autonomous: false, criticality: 'helpful' }).tier).toBe('low')
  })
})

describe('validation', () => {
  test('metric targets must move in the direction of improvement', () => {
    expect(metricValues({ baseline: 18, target: 22 }, 'min', 'decrease').target).toBeDefined()
    expect(metricValues({ baseline: 18, target: 14 }, 'min', 'decrease').target).toBeUndefined()
    expect(metricValues({ current: 140 }, '%', 'increase').current).toBeDefined()
  })
})
