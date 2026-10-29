import { beforeEach, describe, expect, test } from 'vitest'
import { DEFAULT_WEIGHTS } from '@/config'
import { buildSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { bundleFor } from '@/domain/db'
import { gatekeepers } from '@/domain/gatekeepers'
import { insightFor } from '@/domain/insight'

const STEP_ONE = {
  name: 'AI Contract Clause Reviewer',
  businessProblem: 'Legal reviews 300 vendor contracts a month by hand, and each one takes two hours.',
  ownerId: 'p_jim',
}

const solution = (id: string) => useStore.getState().solutions.find((s) => s.id === id)!
const activity = (id: string, templateId: string) => useStore.getState().activities.find((a) => a.solutionId === id && a.templateId === templateId)!

beforeEach(() => {
  useStore.setState({ ...buildSeed() })
})

describe('short create', () => {
  test('step 1 only lands in Discover as a Moderate placeholder, with the Discover work still open', () => {
    const id = useStore.getState().createSolution(STEP_ONE)
    expect(solution(id)).toMatchObject({ stage: 'discover', riskTier: 'moderate', riskTierStatus: 'provisional' })
    for (const t of ['d_problem', 'd_users', 'd_outcome']) expect(activity(id, t).status).toBe('not_started')

    const insight = insightFor(bundleFor(useStore.getState(), id)!, DEFAULT_WEIGHTS)
    expect(insight.next.activityId).toBe(activity(id, 'd_problem').id)
  })

  test('enough answers on step 2 set a confirmed, recommended tier', () => {
    const id = useStore.getState().createSolution({ ...STEP_ONE, riskTier: 'high', aiPatterns: ['agent'], targetUsers: 'Customers who email support' })
    expect(solution(id)).toMatchObject({ riskTier: 'high', riskTierStatus: 'confirmed', targetUsers: 'Customers who email support' })
    expect(activity(id, 'd_users').status).toBe('not_started')
  })

  test('passing the Assess gate confirms a placeholder tier', () => {
    const store = useStore.getState()
    const id = store.createSolution(STEP_ONE)
    // Move straight to a passable Assess gate: everything in Assess done and approved, the team staffed.
    useStore.setState({
      solutions: useStore.getState().solutions.map((s) => (s.id === id ? { ...s, stage: 'assess', team: [...s.team, { personId: 'p_michael', roleId: 'executive_sponsor' }, { personId: 'p_toby', roleId: 'governance_risk' }, { personId: 'p_erin', roleId: 'business_owner' }, { personId: 'p_oscar', roleId: 'data_owner' }, { personId: 'p_dwight', roleId: 'security' }] } : s)),
      activities: useStore.getState().activities.map((a) => (a.solutionId === id && a.stage === 'assess' ? { ...a, status: 'complete' } : a)),
      evidence: useStore.getState().evidence.map((e) => (e.solutionId === id && e.stage === 'assess' ? { ...e, status: 'approved', approvedById: 'p_michael' } : e)),
    })
    const keeper = gatekeepers(solution(id))[0].personId
    const r = useStore.getState().advanceStage(id, { ownerId: keeper, conditions: '', rationale: '' })
    expect(r).toMatchObject({ ok: true })
    expect(solution(id)).toMatchObject({ stage: 'design', riskTierStatus: 'confirmed' })
  })
})
