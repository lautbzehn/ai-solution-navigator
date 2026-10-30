import { beforeEach, describe, expect, test } from 'vitest'
import { buildSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { gatekeepers } from '@/domain/gatekeepers'

/* Customer Support Resolution Assistant: Pam's UX design is done and in review,
   and Dwight's human oversight validation is still a draft. */
const UX_DESIGN = 's_support__ev_ux_design'
const OVERSIGHT = 's_support__ev_oversight_validation'

const evidence = (id: string) => useStore.getState().evidence.find((e) => e.id === id)!

beforeEach(() => {
  useStore.setState({ ...buildSeed() })
})

describe('evidence approval', () => {
  test('an owner cannot approve their own evidence, and nobody can approve it anonymously', () => {
    const owner = evidence(UX_DESIGN).ownerId
    const r = useStore.getState().approveEvidence(UX_DESIGN, { approverId: owner, note: 'Looks right to me' })
    expect(r.ok).toBe(false)
    expect(useStore.getState().approveEvidence(UX_DESIGN, { approverId: '', note: 'Looks right to me' })).toEqual({ ok: false, reason: 'Choose who is approving this evidence.' })
    expect(evidence(UX_DESIGN).status).toBe('in_review')
  })

  test('evidence still in draft cannot be approved', () => {
    expect(evidence(OVERSIGHT).status).toBe('draft')
    const r = useStore.getState().approveEvidence(OVERSIGHT, { approverId: 'p_toby', note: 'Read the shadowing notes' })
    expect(r.ok).toBe(false)
    expect(evidence(OVERSIGHT).status).toBe('draft')
    expect(evidence(OVERSIGHT).approvedById).toBeUndefined()
  })

  test('a teammate approves evidence in review, and history records who, whose, and for what', () => {
    const r = useStore.getState().approveEvidence(UX_DESIGN, { approverId: 'p_dwight', note: 'Walked the flows with two agents' })
    expect(r.ok).toBe(true)
    expect(evidence(UX_DESIGN)).toMatchObject({ status: 'approved', approvedById: 'p_dwight', approvalNote: 'Walked the flows with two agents' })

    const [entry] = useStore.getState().audit
    expect(entry).toMatchObject({
      action: 'approved',
      actorId: 'p_dwight',
      entityType: 'evidence',
      entityId: UX_DESIGN,
      from: 'Pam Beesly',
      to: 'Design user experience and workflow integration',
    })
    expect(entry.ts).toBe(evidence(UX_DESIGN).approvedAt)
  })

  test('no other path reaches Approved', () => {
    const store = useStore.getState()
    expect(store.updateEvidence(UX_DESIGN, { status: 'approved' }).ok).toBe(false)
    expect(store.updateEvidence(OVERSIGHT, { status: 'approved' }).ok).toBe(false)
    // The type already forbids this; the cast plays a caller that slips past it.
    expect(store.addEvidence({ solutionId: 's_support', stage: 'validate', name: 'Pilot sign-off', type: 'Sign-off', ownerId: 'p_erin', required: false, status: 'approved' as never }).ok).toBe(false)
    expect(evidence(UX_DESIGN).status).toBe('in_review')
    expect(useStore.getState().evidence.some((e) => e.name === 'Pilot sign-off')).toBe(false)
  })
})

describe('store rules', () => {
  const activity = (id: string) => useStore.getState().activities.find((a) => a.id === id)!
  const solution = () => useStore.getState().solutions.find((s) => s.id === 's_support')!

  test('required work cannot be marked Not Applicable, and the reason comes back for the toast', () => {
    const uat = activity('s_support__v_uat')
    expect(uat.required).toBe(true)
    const auditBefore = useStore.getState().audit.length

    const r = useStore.getState().updateActivity(uat.id, { status: 'not_applicable' })
    expect(r).toEqual({ ok: false, reason: "Required activities can't be marked Not Applicable for a moderate-risk solution." })
    expect(activity(uat.id).status).toBe(uat.status)
    expect(useStore.getState().audit).toHaveLength(auditBefore)

    // Other changes still go through.
    expect(useStore.getState().updateActivity(uat.id, { priority: 'low' })).toEqual({ ok: true })
    expect(activity(uat.id).priority).toBe('low')
  })

  test('stage and state change only at the gate', () => {
    const store = useStore.getState()
    const reason = 'Stage changes happen at the gate: Go, Hold, Stop, or Resume.'
    expect(store.updateSolution('s_support', { stage: 'deploy' })).toEqual({ ok: false, reason })
    expect(store.updateSolution('s_support', { state: 'stopped' })).toEqual({ ok: false, reason })
    expect(solution()).toMatchObject({ stage: 'validate' })
    expect(solution().state ?? 'active').toBe('active')

    // The gate is still the way through.
    const keeper = gatekeepers(solution())[0].personId
    expect(store.holdSolution('s_support', { ownerId: keeper, rationale: 'Waiting on the data agreement' }).ok).toBe(true)
    expect(solution().state).toBe('on_hold')
    expect(store.updateSolution('s_support', { name: 'AI Customer Support Assistant' }).ok).toBe(true)
  })
})
