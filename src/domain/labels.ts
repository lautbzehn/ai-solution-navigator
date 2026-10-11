import type {
  ActivityStatus,
  AIPattern,
  ChangeStatus,
  ChangeType,
  DecisionOutcome,
  DecisionType,
  EvidenceStatus,
  Likelihood,
  MetricCategory,
  MetricMeasurement,
  Priority,
  RiskCategory,
  RiskStatus,
  RiskTier,
  Severity,
} from './types'

export const ACTIVITY_STATUS: Record<ActivityStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  complete: 'Complete',
  not_applicable: 'Not Applicable',
}
export const ACTIVITY_STATUS_ORDER: ActivityStatus[] = ['not_started', 'in_progress', 'blocked', 'complete', 'not_applicable']

export const EVIDENCE_STATUS: Record<EvidenceStatus, string> = {
  missing: 'Missing',
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  not_required: 'Not Required',
}
export const EVIDENCE_STATUS_ORDER: EvidenceStatus[] = ['missing', 'draft', 'in_review', 'approved', 'not_required']

export const PRIORITY: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export const RISK_TIER: Record<RiskTier, string> = { low: 'Low', moderate: 'Moderate', high: 'High' }

export const RISK_CATEGORY: Record<RiskCategory, string> = {
  data: 'Data',
  security: 'Security',
  privacy: 'Privacy',
  model: 'Model / AI',
  operational: 'Operational',
  business: 'Business',
  legal: 'Legal / Compliance',
  adoption: 'Adoption',
  financial: 'Financial',
  reputational: 'Reputational',
}
export const SEVERITY: Record<Severity, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
export const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical']
export const LIKELIHOOD: Record<Likelihood, string> = { unlikely: 'Unlikely', possible: 'Possible', likely: 'Likely' }
export const LIKELIHOOD_ORDER: Likelihood[] = ['unlikely', 'possible', 'likely']
export const RISK_STATUS: Record<RiskStatus, string> = { open: 'Open', mitigating: 'Mitigating', accepted: 'Accepted', closed: 'Closed' }

export const DECISION_OUTCOME: Record<DecisionOutcome, string> = {
  pending: 'Pending',
  approved: 'Approved',
  approved_with_conditions: 'Approved with conditions',
  rejected: 'Rejected',
  deferred: 'Deferred',
  on_hold: 'On hold',
  stopped: 'Stopped',
  resumed: 'Resumed',
}
export const DECISION_TYPE: Record<DecisionType, string> = {
  gate: 'Gate',
  scope: 'Scope',
  design: 'Design',
  risk: 'Risk',
  deployment: 'Deployment',
  other: 'Other',
}

export const METRIC_CATEGORY: Record<MetricCategory, string> = {
  business: 'Business',
  product: 'Product',
  adoption: 'Adoption',
  ai_performance: 'AI Performance',
  operational: 'Operational',
  financial: 'Financial',
}
export const METRIC_MEASUREMENT: Record<MetricMeasurement, string> = {
  not_applicable: 'Not Applicable',
  planned: 'Planned',
  baseline: 'Baseline captured',
  target: 'Target set',
  current: 'Measuring',
}

export const CHANGE_TYPE: Record<ChangeType, string> = {
  scope: 'Scope change',
  model: 'Model change',
  data_source: 'Data source change',
  prompt_config: 'Prompt / configuration change',
  workflow: 'Workflow change',
  risk: 'Risk change',
}
export const CHANGE_STATUS: Record<ChangeStatus, string> = { proposed: 'Proposed', approved: 'Approved', implemented: 'Implemented', rejected: 'Rejected' }

export const AI_PATTERN: Record<AIPattern, { label: string; hint: string }> = {
  knowledge_retrieval: { label: 'Knowledge Retrieval', hint: 'Find and summarize answers from documents' },
  automation: { label: 'Automation', hint: 'Perform steps in a workflow automatically' },
  classification: { label: 'Classification', hint: 'Sort, tag, or route items' },
  prediction: { label: 'Prediction', hint: 'Forecast an outcome or score likelihood' },
  generation: { label: 'Generation', hint: 'Draft text, summaries, or content' },
  decision_support: { label: 'Decision Support', hint: 'Recommend options to a human decision-maker' },
  agent: { label: 'Agent / Autonomous Action', hint: 'Takes actions on its own toward a goal' },
  other: { label: 'Other', hint: 'Something else' },
}
