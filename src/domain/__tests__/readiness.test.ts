import { describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS } from '@/config'
import { buildSeed } from '@/data/seed'
import { bundleFor, evidenceForActivity } from '@/domain/db'
import { activityCredit, computeReadiness } from '@/domain/readiness'
import type { Activity, Evidence, EvidenceStatus } from '@/domain/types'

const finished = (blocking: boolean): Activity => ({
  id: 'act_limits',
  solutionId: 'sol',
  stage: 'build',
  name: 'Document known limitations',
  description: '',
  dimension: 'product',
  ownerId: 'p_gabe',
  contributorIds: [],
  status: 'complete',
  priority: 'high',
  required: true,
  blocking,
  evidenceTemplateId: 'ev_known_limits',
  comments: [],
  createdAt: '2026-10-01T00:00:00.000Z',
})

const proof = (status: EvidenceStatus): Evidence => ({
  id: 'ev_limits',
  solutionId: 'sol',
  stage: 'build',
  templateId: 'ev_known_limits',
  activityId: 'act_limits',
  name: 'Known Limitations',
  type: 'Record',
  ownerId: 'p_gabe',
  status,
  required: true,
  date: '2026-10-01T00:00:00.000Z',
})

describe('readiness credit for completed work', () => {
  test.each([
    { status: 'approved', blocking: true, credit: 1 },
    { status: 'not_required', blocking: true, credit: 1 },
    { status: 'in_review', blocking: true, credit: 0.7 },
    { status: 'draft', blocking: true, credit: 0.4 },
    { status: 'missing', blocking: true, credit: 0 },
    { status: 'missing', blocking: false, credit: 0.3 },
  ] as const)('$status evidence (gate-blocking: $blocking) earns $credit', ({ status, blocking, credit }) => {
    expect(activityCredit(finished(blocking), proof(status))).toBe(credit)
  })

  test('a gate-blocking activity marked complete with missing evidence scores zero', () => {
    const bundle = bundleFor(buildSeed(), 's_coach')!
    const limits = bundle.activities.find((a) => a.templateId === 'b_limits')!
    expect(limits).toMatchObject({ status: 'complete', blocking: true })
    expect(evidenceForActivity(bundle, limits)?.status).toBe('missing')
    expect(activityCredit(limits, evidenceForActivity(bundle, limits))).toBe(0)

    // It counts as a whole gap: closing it is worth its full share of Product Readiness.
    const product = computeReadiness(bundle, DEFAULT_WEIGHTS).dimensions.find((d) => d.id === 'product')!
    const totalWeight = Object.values(DEFAULT_WEIGHTS).reduce((n, w) => n + w, 0)
    const fullShare = (DEFAULT_WEIGHTS.product / totalWeight) * 100 / product.total
    expect(product.gaps.find((g) => g.activityId === limits.id)?.points).toBeCloseTo(fullShare, 6)
  })
})
