/* Core domain model for Forge Navigator.
   Lifecycle methodology lives in config/lifecycle.json; these types describe
   both that configuration and the per-solution records that instantiate it. */

export type StageId =
  | 'discover'
  | 'assess'
  | 'design'
  | 'build'
  | 'validate'
  | 'deploy'
  | 'operate'
  | 'improve'

export type RiskTier = 'low' | 'moderate' | 'high'
export type DimensionId =
  | 'business_value'
  | 'product'
  | 'technical'
  | 'ai_evaluation'
  | 'risk_governance'
  | 'operational'
  | 'adoption'
export type RoleId = string
export type Priority = 'high' | 'medium' | 'low'

/* ------------------------------------------------------------- config -- */

export interface StageDef {
  id: StageId
  name: string
  /** A few words for diagrams: what the stage achieves. */
  tagline: string
  purpose: string
  keyQuestion: string
  expectedReadiness: number
  typicalDays: number
}

export interface RiskTierDef {
  id: RiskTier
  name: string
  summary: string
  description: string
  rigor: string
}

export interface DimensionDef {
  id: DimensionId
  name: string
  weight: number
  description: string
}

export interface RoleDef {
  id: RoleId
  name: string
  responsibilities: string
}

export interface EvidenceTemplate {
  id: string
  name: string
  type: string
  description: string
}

export interface ActivityTemplate {
  id: string
  stage: StageId
  name: string
  description: string
  why: string
  consequence: string
  ownerRole: RoleId
  contributorRoles: RoleId[]
  dimension: DimensionId
  requiredFor: RiskTier[]
  blockingFor: RiskTier[]
  evidence: string | null
  priority: Priority
  tags?: string[]
}

export type GateCriterionDef =
  | { id: string; type: 'field'; field: SolutionTextField; minLength: number; label: string; description: string }
  | { id: string; type: 'role'; roles: RoleId[]; label: string; description: string }
  | { id: string; type: 'metrics'; minDefined: number; requireCurrent?: boolean; label: string; description: string }
  | { id: string; type: 'risks'; rule: 'no_unmitigated_high'; label: string; description: string }
  /** A measured result must meet its target. Applies only to the risk tiers listed. */
  | { id: string; type: 'metric_threshold'; metricKey: MetricKey; comparator: 'gte' | 'lte'; tiers: RiskTier[]; label: string; description: string }

export interface GateDef {
  stage: StageId
  name: string
  description: string
  criteria: GateCriterionDef[]
  /** Gatekeepers: roles allowed to decide this gate (Go, Hold or Stop). The solution owner never decides their own gate. */
  approverRoles: RoleId[]
}

/** A group of consecutive stages (Plan, Deliver, Run) used to explain the flow. */
export interface PhaseDef {
  id: string
  name: string
  summary: string
  stages: StageId[]
}

export interface LifecycleConfig {
  version: string
  name: string
  phases: PhaseDef[]
  stages: StageDef[]
  riskTiers: RiskTierDef[]
  readinessDimensions: DimensionDef[]
  roles: RoleDef[]
  evidenceTemplates: EvidenceTemplate[]
  activityTemplates: ActivityTemplate[]
  gates: GateDef[]
}

/* ------------------------------------------------------------ records -- */

export interface Person {
  id: string
  name: string
  title: string
  department: string
  /** Hue (0–360) for the avatar tint. */
  hue: number
}

export type SolutionTextField = 'businessProblem' | 'targetUsers' | 'desiredOutcome' | 'whyAI' | 'dataSources'

export type AIPattern =
  | 'knowledge_retrieval'
  | 'automation'
  | 'classification'
  | 'prediction'
  | 'generation'
  | 'decision_support'
  | 'agent'
  | 'other'

export interface TeamMember {
  personId: string
  roleId: RoleId
}

export interface StageVisit {
  stage: StageId
  enteredAt: string
  exitedAt?: string
}

export interface Solution {
  id: string
  name: string
  description: string
  /** Accountable solution owner. */
  ownerId: string
  stage: StageId
  riskTier: RiskTier
  /** A tier set without enough answers is a placeholder until the Assess gate confirms it. Absent means confirmed. */
  riskTierStatus?: 'provisional' | 'confirmed'
  businessProblem: string
  targetUsers: string
  desiredOutcome: string
  whyAI: string
  aiPatterns: AIPattern[]
  dataSources: string
  /** Expected annual value in USD. */
  expectedValue: number
  /** Realized annualized value in USD (production solutions). */
  realizedValue: number
  team: TeamMember[]
  stageHistory: StageVisit[]
  createdAt: string
  updatedAt: string
  /** Seeded solutions are fictional demo data. */
  demo?: boolean
  /** Active unless a gate decision put it on hold or stopped it. */
  state?: LifecycleState
  /** The reason given with the Hold or Stop decision. */
  stateReason?: string
  stateChangedAt?: string
}

/** Stage-Gate decisions: Go advances, Hold pauses with progress kept, Stop ends the project. */
export type LifecycleState = 'active' | 'on_hold' | 'stopped'

export type ActivityStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'not_applicable'

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string
}

export interface Activity {
  id: string
  solutionId: string
  stage: StageId
  /** Lifecycle template this activity instantiates; absent for ad-hoc work. */
  templateId?: string
  name: string
  description: string
  dimension: DimensionId
  ownerId: string
  contributorIds: string[]
  status: ActivityStatus
  priority: Priority
  dueDate?: string
  required: boolean
  blocking: boolean
  /** Evidence template expected to back this activity. */
  evidenceTemplateId?: string
  comments: Comment[]
  createdAt: string
  completedAt?: string
  blockedReason?: string
}

export type EvidenceStatus = 'missing' | 'draft' | 'in_review' | 'approved' | 'not_required'

export interface Evidence {
  id: string
  solutionId: string
  stage: StageId
  templateId?: string
  activityId?: string
  name: string
  type: string
  ownerId: string
  status: EvidenceStatus
  required: boolean
  /** Date of the latest status change. */
  date: string
  link?: string
  notes?: string
  /** Who approved it: always someone other than the owner. Set only by the store's approve command. */
  approvedById?: string
  approvedAt?: string
  /** The approver's one-line note on what they checked. */
  approvalNote?: string
}

export type RiskCategory =
  | 'data'
  | 'security'
  | 'privacy'
  | 'model'
  | 'operational'
  | 'business'
  | 'legal'
  | 'adoption'
  | 'financial'
  | 'reputational'
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type Likelihood = 'unlikely' | 'possible' | 'likely'
export type RiskStatus = 'open' | 'mitigating' | 'accepted' | 'closed'

export interface Risk {
  id: string
  solutionId: string
  title: string
  category: RiskCategory
  severity: Severity
  likelihood: Likelihood
  impact: string
  mitigation: string
  ownerId: string
  status: RiskStatus
  dueDate?: string
  createdAt: string
}

export type DecisionOutcome = 'pending' | 'approved' | 'approved_with_conditions' | 'rejected' | 'deferred' | 'on_hold' | 'stopped' | 'resumed'
export type DecisionType = 'gate' | 'scope' | 'design' | 'risk' | 'deployment' | 'other'

export interface Decision {
  id: string
  solutionId: string
  stage: StageId
  title: string
  type: DecisionType
  date: string
  ownerId: string
  recommendation: string
  outcome: DecisionOutcome
  rationale: string
  evidenceIds: string[]
  conditions: string
  impact: string
}

export type MetricCategory = 'business' | 'product' | 'adoption' | 'ai_performance' | 'operational' | 'financial'
export type MetricDirection = 'increase' | 'decrease'
/** Where a metric is in its measurement lifecycle. */
export type MetricMeasurement = 'not_applicable' | 'planned' | 'baseline' | 'target' | 'current'
export type MetricKey =
  | 'eligible_users'
  | 'active_users'
  | 'usage_frequency'
  | 'satisfaction'
  | 'accuracy'
  | 'hallucination_rate'
  | 'escalation_rate'
  | 'override_rate'
  | 'defect_rate'
  | 'feasibility_eval_pass_rate'

export interface MetricPoint {
  date: string
  value: number
}

export interface Metric {
  id: string
  solutionId: string
  name: string
  category: MetricCategory
  description: string
  baseline?: number
  target?: number
  current?: number
  unit: string
  direction: MetricDirection
  ownerId: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  measurement: MetricMeasurement
  /** Well-known metric used by portfolio reports. */
  key?: MetricKey
  history: MetricPoint[]
}

export type ChangeType = 'scope' | 'model' | 'data_source' | 'prompt_config' | 'workflow' | 'risk'
export type ChangeStatus = 'proposed' | 'approved' | 'implemented' | 'rejected'

export interface Change {
  id: string
  solutionId: string
  date: string
  type: ChangeType
  description: string
  ownerId: string
  impact: string
  approvalRequired: boolean
  status: ChangeStatus
}

export interface AuditEntry {
  id: string
  ts: string
  actorId: string
  solutionId?: string
  action: 'created' | 'updated' | 'status_changed' | 'advanced' | 'gate_blocked' | 'commented' | 'assigned' | 'deleted' | 'approved'
  entityType: 'solution' | 'activity' | 'evidence' | 'risk' | 'decision' | 'metric' | 'change' | 'team' | 'gate'
  entityId: string
  entityName: string
  field?: string
  /** Display values at the time. For 'approved': the evidence owner's name in `from`, the activity it backs in `to`. */
  from?: string
  to?: string
}

export interface GateAttempt {
  id: string
  solutionId: string
  stage: StageId
  ts: string
  passed: boolean
  blockers: string[]
  /** The gatekeeper's call. Pass rate counts only attempts that carry one; older saved data may lack it. */
  decision?: 'go' | 'hold' | 'stop'
}

export interface ReadinessSnapshot {
  solutionId: string
  date: string
  readiness: number
}
