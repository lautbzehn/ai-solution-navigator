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
