import { describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS, lifecycle } from '@/config'
import { buildSeed } from '@/data/seed'
import { bundleFor, type DB } from '@/domain/db'
import { evaluateGate } from '@/domain/gates'
import { insightFor } from '@/domain/insight'
import { reconcileTier } from '@/domain/plan'
import { computeReadiness } from '@/domain/readiness'
import { recommendRiskTier } from '@/domain/riskRecommend'
import { metricValues } from '@/domain/validation'

const insight = (db: DB, id: string) => insightFor(bundleFor(db, id)!, DEFAULT_WEIGHTS)

function complete(db: DB, solutionId: string, templateId: string) {
  const a = db.activities.find((x) => x.solutionId === solutionId && x.templateId === templateId)!
  a.status = 'complete'
  const ev = db.evidence.find((e) => e.activityId === a.id)
  if (ev) ev.status = 'approved'
}

describe('primary demo: AI Customer Support Resolution Assistant', () => {
  test('starts in Validate at 76% readiness with the three spec blockers', () => {
    const i = insight(buildSeed(), 's_support')
    expect(i.bundle.solution.stage).toBe('validate')
    expect(i.readiness.overall).toBe(76)
    expect(i.gate.unmet.map((u) => u.label).sort()).toEqual(['Complete UAT', 'Define production monitoring plan', 'Validate human oversight in practice'])
    expect(i.next.title).toMatch(/human oversight/i)
  })

  test('a completed activity without approved evidence does not satisfy the gate', () => {
    const db = buildSeed()
    db.activities.find((a) => a.id === 's_support__v_uat')!.status = 'complete'
    const gate = evaluateGate(bundleFor(db, 's_support')!)
    expect(gate.unmet.find((u) => u.activityId === 's_support__v_uat')?.detail).toMatch(/UAT Sign-off is missing/)
  })

  test('closing the blockers opens the gate and raises readiness', () => {
    const db = buildSeed()
    const before = computeReadiness(bundleFor(db, 's_support')!, DEFAULT_WEIGHTS).overall
    for (const t of ['v_oversight', 'v_uat', 'v_monitoring']) complete(db, 's_support', t)
    const after = insight(db, 's_support')
    expect(after.gate.canAdvance).toBe(true)
    expect(after.readiness.overall).toBeGreaterThan(before)
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

describe('feasibility threshold at the Assess gate', () => {
  const FEASIBILITY = 'g_a_feasibility'
  const classifier = () => bundleFor(buildSeed(), 's_classifier')!
  const criterion = (b: ReturnType<typeof classifier>) => evaluateGate(b).criteria.find((c) => c.id === FEASIBILITY)

  test('fails when the measured result is below the threshold set before the spike', () => {
    const c = criterion(classifier())
    expect(c).toMatchObject({ met: false, detail: '78% against a threshold of 85%', tiers: ['moderate', 'high'] })
  })

  test('passes once the result meets the threshold', () => {
    const b = classifier()
    b.metrics.find((m) => m.key === 'feasibility_eval_pass_rate')!.current = 86
    expect(criterion(b)).toMatchObject({ met: true, detail: '86% meets the 85% threshold' })
  })

  test('is skipped for Low risk', () => {
    const b = classifier()
    b.solution = { ...b.solution, riskTier: 'low' }
    expect(criterion(b)).toBeUndefined()
  })
})

describe('validation', () => {
  test('metric targets must move in the direction of improvement', () => {
    expect(metricValues({ baseline: 18, target: 22 }, 'min', 'decrease').target).toBeDefined()
    expect(metricValues({ baseline: 18, target: 14 }, 'min', 'decrease').target).toBeUndefined()
    expect(metricValues({ current: 140 }, '%', 'increase').current).toBeDefined()
  })
})
