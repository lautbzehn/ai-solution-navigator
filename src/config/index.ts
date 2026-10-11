import raw from './lifecycle.json'
import type {
  ActivityTemplate,
  DimensionDef,
  DimensionId,
  GateDef,
  LifecycleConfig,
  RiskTier,
  Solution,
  StageDef,
  StageId,
} from '@/domain/types'

/** The lifecycle methodology. Everything stage-, gate-, and readiness-related
    is read from here so the methodology can evolve without touching UI. */
export const lifecycle = raw as LifecycleConfig

export const STAGES: StageDef[] = lifecycle.stages
export const PHASES = lifecycle.phases
export const STAGE_IDS: StageId[] = STAGES.map((s) => s.id)

const stageIndex = new Map(STAGE_IDS.map((id, i) => [id, i]))
export const stageOrder = (id: StageId) => stageIndex.get(id) ?? 0
export const stageDef = (id: StageId) => STAGES[stageOrder(id)]
export const nextStage = (id: StageId): StageId | undefined => STAGE_IDS[stageOrder(id) + 1]
export const isFinalStage = (id: StageId) => stageOrder(id) === STAGE_IDS.length - 1
export const FIRST_STAGE: StageId = STAGE_IDS[0]
/** The stage where a solution is in front of everyone and running for real. */
export const RUN_STAGE: StageId = STAGE_IDS[STAGE_IDS.length - 1]

export const gateFor = (stage: StageId): GateDef | undefined => lifecycle.gates.find((g) => g.stage === stage)

export const riskTierDef = (id: RiskTier) => lifecycle.riskTiers.find((t) => t.id === id)!
export const roleDef = (id: string) => lifecycle.roles.find((r) => r.id === id)
export const roleName = (id: string) => roleDef(id)?.name ?? id
export const evidenceTemplate = (id: string) => lifecycle.evidenceTemplates.find((e) => e.id === id)
export const activityTemplate = (id: string) => lifecycle.activityTemplates.find((a) => a.id === id)

export const isRequired = (t: ActivityTemplate, tier: RiskTier) => t.requiredFor.includes(tier)
export const isBlocking = (t: ActivityTemplate, tier: RiskTier) => t.blockingFor.includes(tier)

/** Controls that apply only because of a higher risk tier (vs. Low). */
export const riskBasedControls = (tier: RiskTier) =>
  lifecycle.activityTemplates.filter((t) => isRequired(t, tier) && !isRequired(t, 'low'))

export const DEFAULT_WEIGHTS: Record<DimensionId, number> = Object.fromEntries(
  lifecycle.readinessDimensions.map((d) => [d.id, d.weight]),
) as Record<DimensionId, number>

export const DIMENSIONS: DimensionDef[] = lifecycle.readinessDimensions
export const dimensionDef = (id: DimensionId) => DIMENSIONS.find((d) => d.id === id)!

/** Readiness scope: through Launch until a solution is running for everyone, then
    through its current stage. Readiness means "ready to reach and run in production". */
export const readinessScopeEnd = (stage: StageId): StageId =>
  stageOrder(stage) > stageOrder('launch') ? stage : 'launch'

/** People on the team who may record a stage's gate decision: they hold one of
    the gate's approver roles and are not the solution's own owner. */
export function eligibleApprovers(solution: Solution, stage: StageId = solution.stage): string[] {
  const roles = gateFor(stage)?.approverRoles ?? []
  return Array.from(new Set(solution.team.filter((m) => roles.includes(m.roleId)).map((m) => m.personId))).filter((id) => id !== solution.ownerId)
}

export const approverRoleNames = (stage: StageId) => (gateFor(stage)?.approverRoles ?? []).map(roleName)
