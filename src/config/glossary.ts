/* Concise explanations for concepts that aren't obvious at a glance. */

export const GLOSSARY = {
  readiness: {
    title: 'Implementation Readiness',
    body: 'Measures how prepared the overall solution is to advance through the lifecycle. It does not represent AI safety or model quality alone.',
  },
  readinessPace: {
    title: 'Expected readiness',
    body: 'Each stage has a minimum readiness that keeps a solution on pace. Below it is amber; more than 10 points below is red.',
  },
  riskTier: {
    title: 'Risk tier',
    body: 'Low: internal assistance with low impact. Moderate: business-critical workflow or material impact. High: consequential decisions, sensitive data, autonomy, or significant exposure. Higher risk adds required controls and stronger gate criteria.',
  },
  lifecycle: {
    title: 'Lifecycle stages',
    body: 'Discover → Assess → Design → Build → Validate → Deploy → Operate → Improve/Retire. Each stage ends in a gate; governance runs continuously across all of them.',
  },
  gate: {
    title: 'Gate criteria',
    body: 'The requirements that must be met before a solution can move to the next stage. Blocking activities need to be complete and backed by approved evidence.',
  },
  gatekeeper: {
    title: 'Gatekeepers and decisions',
    body: 'Each gate names the roles allowed to decide it, such as the Executive Sponsor or Governance / Risk. A gatekeeper chooses Go (advance), Hold (pause with progress kept) or Stop (end the project). The solution owner never decides their own gate.',
  },
  evidence: {
    title: 'Evidence',
    body: 'Structured proof that work was done to the required standard: an assessment, a review, a sign-off. A completed checkbox without approved evidence does not count as full readiness.',
  },
  aiEvaluation: {
    title: 'AI evaluation',
    body: 'Testing the AI against defined criteria and thresholds (accuracy, unsupported claims, bias) on representative data, then at production scale during the pilot.',
  },
  humanOversight: {
    title: 'Human oversight',
    body: 'How people review, correct, approve, or override AI output, and whether that works in practice under real workload, not just on paper.',
  },
  residualRisk: {
    title: 'Residual risk',
    body: 'The risk that remains after mitigations are in place. Leaders must accept it explicitly before deployment.',
  },
  adoptionReadiness: {
    title: 'Adoption readiness',
    body: 'Whether users are identified, trained, and bought in, and whether adoption will be measured after launch.',
  },
  businessValue: {
    title: 'Business value',
    body: 'Expected value is the annualized value in the approved value hypothesis. Realized value is what production measurement shows today.',
  },
  blocking: {
    title: 'Blocking',
    body: 'A blocking activity must be complete, with approved evidence, before the stage gate can pass. Which activities block depends on the risk tier.',
  },
  nextBestAction: {
    title: 'Next best action',
    body: 'The single most useful thing to drive right now, chosen from the open gate requirements by blockers, priority, and due date.',
  },
  health: {
    title: 'Status',
    body: 'Derived from the work itself. Blocked: a gate activity is blocked. At risk: critical or unmitigated high risks, overdue gate work, or readiness well behind pace.',
  },
  gatePassRate: {
    title: 'Gate pass rate',
    body: 'Share of gate attempts that passed on the first try. Failed attempts mean a team asked to advance before requirements were met.',
  },
  reworkRate: {
    title: 'Rework rate',
    body: 'Completed activities that were later reopened, as a share of all completions.',
  },
} as const

export type GlossaryKey = keyof typeof GLOSSARY
