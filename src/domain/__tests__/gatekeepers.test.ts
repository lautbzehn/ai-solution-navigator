import { beforeEach, describe, expect, test } from 'vitest'
import { lifecycle } from '@/config'
import { buildSeed } from '@/data/seed'
import { useStore } from '@/data/store'
import { canDecideGate, gatekeepers, stateOf } from '@/domain/gatekeepers'

const DEMO = 's_support'
const solution = () => useStore.getState().solutions.find((s) => s.id === DEMO)!

beforeEach(() => {
  useStore.setState({ ...buildSeed() })
})

describe('gatekeepers', () => {
  test('every gate names who may decide it', () => {
    for (const g of lifecycle.gates) expect(g.approverRoles.length).toBeGreaterThan(0)
  })

  test('the solution owner never decides their own gate', () => {
    const s = solution()
    expect(gatekeepers(s).some((g) => g.personId === s.ownerId)).toBe(false)
    expect(canDecideGate(s, s.ownerId)).toBe(false)
  })

  test('only team members holding a gatekeeper role qualify', () => {
    const s = solution()
    const roles = lifecycle.gates.find((g) => g.stage === s.stage)!.approverRoles
    for (const k of gatekeepers(s)) expect(roles).toContain(k.roleId)
    expect(gatekeepers(s).length).toBeGreaterThan(0)
  })
})

describe('Go, Hold, Stop', () => {
  test('Hold needs a gatekeeper and a reason, pauses the work, and blocks Go until resumed', () => {
    const store = useStore.getState()
    const s = solution()
    const keeper = gatekeepers(s)[0].personId

    expect(store.holdSolution(DEMO, { ownerId: s.ownerId, rationale: 'Waiting on the data agreement' }).ok).toBe(false)
    expect(store.holdSolution(DEMO, { ownerId: keeper, rationale: 'short' }).ok).toBe(false)
    expect(store.holdSolution(DEMO, { ownerId: keeper, rationale: 'Waiting on the data agreement' }).ok).toBe(true)
    expect(stateOf(solution())).toBe('on_hold')
    expect(useStore.getState().decisions[0].outcome).toBe('on_hold')

    const go = useStore.getState().advanceStage(DEMO, { ownerId: keeper, conditions: '', rationale: 'Ready to move on now' })
    expect(go.ok).toBe(false)

    expect(useStore.getState().resumeSolution(DEMO, { ownerId: keeper, rationale: 'The agreement is signed' }).ok).toBe(true)
    expect(stateOf(solution())).toBe('active')
    expect(solution().stage).toBe(s.stage)
  })

  test('opening a blocked gate creates no attempt', () => {
    // The review used to call advanceStage on open just to log a failed attempt.
    const before = useStore.getState()
    const r = before.advanceStage(DEMO, { ownerId: solution().ownerId, conditions: '', rationale: '' })
    expect(r.ok).toBe(false)
    expect(useStore.getState().gateAttempts).toHaveLength(before.gateAttempts.length)
    expect(useStore.getState().audit).toHaveLength(before.audit.length)
  })

  test('submitting Hold logs one attempt that did not pass', () => {
    const keeper = gatekeepers(solution())[0].personId
    const count = useStore.getState().gateAttempts.length
    expect(useStore.getState().holdSolution(DEMO, { ownerId: keeper, rationale: 'Waiting on the pilot cohort' }).ok).toBe(true)
    const attempts = useStore.getState().gateAttempts
    expect(attempts).toHaveLength(count + 1)
    expect(attempts.at(-1)).toMatchObject({ solutionId: DEMO, stage: 'validate', passed: false, decision: 'hold' })
    expect(attempts.at(-1)!.blockers).toHaveLength(3)
  })

  test('submitting Go on a passable gate logs one attempt that passed, with no rationale needed', () => {
    const db = buildSeed()
    for (const t of ['v_oversight', 'v_uat', 'v_monitoring']) {
      const a = db.activities.find((x) => x.id === `${DEMO}__${t}`)!
      a.status = 'complete'
      db.evidence.find((e) => e.activityId === a.id)!.status = 'approved'
    }
    useStore.setState({ ...db })
    const keeper = gatekeepers(solution())[0].personId
    const count = useStore.getState().gateAttempts.length
    expect(useStore.getState().advanceStage(DEMO, { ownerId: keeper, conditions: '', rationale: '' }).ok).toBe(true)
    expect(useStore.getState().gateAttempts).toHaveLength(count + 1)
    expect(useStore.getState().gateAttempts.at(-1)).toMatchObject({ solutionId: DEMO, stage: 'validate', passed: true, decision: 'go' })
    expect(solution().stage).toBe('deploy')
  })

  test('Stop ends the project, keeps the record, and cannot be resumed', () => {
    const s = solution()
    const keeper = gatekeepers(s)[0].personId
    expect(useStore.getState().stopSolution(DEMO, { ownerId: keeper, rationale: 'The pilot showed no time saved' }).ok).toBe(true)
    expect(stateOf(solution())).toBe('stopped')
    expect(solution().stateReason).toBe('The pilot showed no time saved')
    expect(useStore.getState().decisions[0].outcome).toBe('stopped')
    expect(useStore.getState().resumeSolution(DEMO, { ownerId: keeper, rationale: 'Try again please' }).ok).toBe(false)
  })
})
