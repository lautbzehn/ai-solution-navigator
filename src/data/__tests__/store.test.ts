import { beforeEach, describe, expect, test } from 'vitest'
import { buildSeed } from '@/data/seed'
import { useStore } from '@/data/store'

/* Customer Support Resolution Assistant: Pam's UX design is done and in review,
   and Dwight's human oversight validation is still a draft. */
const UX_DESIGN = 's_support__ev_ux_design'
const OVERSIGHT = 's_support__ev_oversight_validation'

const evidence = (id: string) => useStore.getState().evidence.find((e) => e.id === id)!

beforeEach(() => {
  useStore.setState({ ...buildSeed() })
})

describe('evidence approval', () => {
  test('an owner cannot approve their own evidence', () => {
    const owner = evidence(UX_DESIGN).ownerId
    const r = useStore.getState().approveEvidence(UX_DESIGN, { approverId: owner, note: 'Looks right to me' })
    expect(r.ok).toBe(false)
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
