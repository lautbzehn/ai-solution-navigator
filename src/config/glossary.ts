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
    body: 'Frame → Prove → Build → Launch → Run. Frame and Prove test the idea small; Build and Launch deliver it carefully; Run measures it every quarter. Each stage ends in a gate that can advance, park, or stop a solution.',
  },
  gate: {
    title: 'Gate criteria',
    body: 'The requirements that must be met before a solution can move to the next stage. Blocking activities need to be complete and backed by approved evidence. Any gate can also park or stop a solution at any time.',
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
    body: 'Share of requests to advance that passed. A failed attempt means someone asked to advance before the requirements were met. Checking a gate to see what is open never counts.',
  },
  proofGate: {
    title: 'Proof gate',
    body: 'The checkpoint between a small proof of concept and any build money. It reads the PoC results against the charter and records one of four decisions: scale, iterate, pivot, or stop.',
  },
  pocCharter: {
    title: 'PoC charter',
    body: 'The rules of a proof of concept, agreed with the sponsor before it starts: a hypothesis, a 2 to 6 week timebox, a budget cap, a pilot user cap, and pass thresholds for quality, value, and run cost.',
  },
  scalePotential: {
    title: 'Scale Potential',
    body: 'A 0 to 100 score for the Proof gate: quality 30, value 25, unit economics 20, production data 10, pilot adoption 10, sponsor commitment 5. 75 and up is ready to scale; under 50 is not viable yet.',
  },
  killRate: {
    title: 'Kill rate',
    body: 'Share of ideas that reached a Proof decision and were stopped early, before any build money. A healthy portfolio stops plenty of ideas, and stops them fast.',
  },
  reworkRate: {
    title: 'Rework rate',
    body: 'Completed activities that were later reopened, as a share of all completions.',
  },
} as const

export type GlossaryKey = keyof typeof GLOSSARY
