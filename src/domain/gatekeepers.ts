import { gateFor, roleName } from '@/config'
import type { LifecycleState, RoleId, Solution, StageId } from './types'

/* Stage-Gate decision rights. Each gate names its gatekeepers (roles) in the
   methodology file. Only a team member holding one of those roles may decide the
   gate, Go, Hold or Stop, and the solution's own owner never decides their own
   gate (separation of duties). The final stage has no exit gate, so its holds
   and stops fall back to the sponsor or business owner. */

const FALLBACK_ROLES: RoleId[] = ['executive_sponsor', 'business_owner']

export const stateOf = (s: Pick<Solution, 'state'>): LifecycleState => s.state ?? 'active'

export const approverRolesFor = (stage: StageId): RoleId[] => gateFor(stage)?.approverRoles ?? FALLBACK_ROLES

export const approverRoleNames = (stage: StageId): string[] => approverRolesFor(stage).map(roleName)

export interface Gatekeeper {
  personId: string
  roleId: RoleId
}

/** Team members who may decide this stage's gate: holders of a gatekeeper role, never the solution owner. */
export function gatekeepers(solution: Pick<Solution, 'team' | 'ownerId' | 'stage'>, stage: StageId = solution.stage): Gatekeeper[] {
  const roles = approverRolesFor(stage)
  const out: Gatekeeper[] = []
  for (const role of roles) {
    for (const m of solution.team) {
      if (m.roleId === role && m.personId !== solution.ownerId && !out.some((g) => g.personId === m.personId)) out.push({ personId: m.personId, roleId: m.roleId })
    }
  }
  return out
}

export const canDecideGate = (solution: Pick<Solution, 'team' | 'ownerId' | 'stage'>, personId: string, stage: StageId = solution.stage) =>
  gatekeepers(solution, stage).some((g) => g.personId === personId)

/** "Executive Sponsor or Governance / Risk" for a stage's gate. */
export const gatekeeperPhrase = (stage: StageId) => {
  const names = approverRoleNames(stage)
  return names.length <= 1 ? (names[0] ?? 'a gatekeeper') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}
