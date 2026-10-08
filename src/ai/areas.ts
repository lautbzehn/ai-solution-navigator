/* Focus areas for the AI advisor's star icon. Each area pins the analysis to
   one part of the screen: the question shown in the conversation (and sent to
   the live model), and the one-line tooltip on the icon. The deterministic
   advisor answers each area with a dedicated analysis rather than guessing
   the intent from the wording. */

export type SolutionArea = 'brief' | 'next' | 'gate' | 'readiness' | 'lifecycle' | 'work' | 'evidence' | 'risks' | 'decisions' | 'metrics' | 'case' | 'team' | 'history'
export type PortfolioArea = 'attention' | 'portfolio' | 'progress' | 'risk-value' | 'health' | 'delivery' | 'portfolio-risk' | 'value' | 'ai-quality'
export type AdvisorArea = SolutionArea | PortfolioArea

export const AREAS: Record<AdvisorArea, { label: string; tip: string; question: string }> = {
  // One solution
  brief: { label: 'Briefing', tip: 'Brief me on this solution in 30 seconds', question: 'Give me an executive briefing on this solution: status, readiness, what is blocking it, and the next step.' },
  next: { label: 'Next step', tip: 'Explain this next step and what follows it', question: 'What should I do next, and why?' },
  gate: { label: 'Gate', tip: 'Analyze what stands between this solution and its next gate', question: 'Analyze the gate: what is still open, who owns it, and how do I prepare for the review?' },
  readiness: { label: 'Readiness', tip: 'Explain the readiness score and the biggest gaps', question: 'Explain my readiness score and the biggest weighted gaps.' },
  lifecycle: { label: 'Lifecycle', tip: 'Analyze progress through the current and next stage', question: 'Analyze lifecycle progress: what is done in this stage, what remains, and what to start for the next one.' },
  work: { label: 'Work', tip: 'Find blocked, overdue, and unowned work', question: 'Analyze the work plan: what is blocked, overdue, or unowned, and where is the workload heaviest?' },
  evidence: { label: 'Evidence', tip: 'Find missing or unapproved evidence', question: 'What evidence is missing or still waiting for approval?' },
  risks: { label: 'Risks', tip: 'Rank the risks that need a mitigation or decision', question: 'Analyze the open risks: which need a mitigation or a decision first?' },
  decisions: { label: 'Decisions', tip: 'Check which decisions are holding up work', question: 'Which decisions are pending, and what are they holding up?' },
  metrics: { label: 'Metrics', tip: 'Check outcome, adoption, and AI metrics against targets', question: 'Analyze the metrics: what is off target, and what is not being measured yet?' },
  case: { label: 'Business case', tip: 'Check the value case and how it will be proven', question: 'Analyze the business case: expected value, what has been realized, and how it will be proven.' },
  team: { label: 'Team', tip: 'Spot overloaded owners and missing roles', question: 'Analyze the team: who carries the most open work, and is any work unowned?' },
  history: { label: 'Changes', tip: 'Check recent changes that need approval or re-testing', question: 'Analyze recent changes: which need approval, and which call for re-running evaluation?' },
  // The portfolio
  attention: { label: 'Needs attention', tip: 'Explain what needs attention and what to do first', question: 'Which solutions need my attention, and what should happen first?' },
  portfolio: { label: 'All solutions', tip: 'Summarize the portfolio: who is ahead and who is behind', question: 'Summarize the portfolio: which solutions are ahead of pace and which are behind?' },
  progress: { label: 'Progress', tip: 'Analyze readiness and pace across the portfolio', question: 'Analyze portfolio progress: readiness, pace against each stage, and where work is piling up.' },
  'risk-value': { label: 'Risk and value', tip: 'Weigh portfolio risk against expected value', question: 'Weigh portfolio risk against value: where is the exposure, and where is the unrealized value?' },
  health: { label: 'Portfolio health', tip: 'Explain portfolio health and the solutions behind pace', question: 'Explain portfolio health: what is driving the status mix, and which solutions are behind pace?' },
  delivery: { label: 'Delivery', tip: 'Find the delivery bottleneck and what is slowing it', question: 'Analyze delivery: where is the bottleneck, and what is slowing solutions down?' },
  'portfolio-risk': { label: 'Risk', tip: 'Find the risks across the portfolio that need action', question: 'Analyze portfolio risk: which risks need a mitigation or a decision first?' },
  value: { label: 'Value and adoption', tip: 'Find the unrealized value and the adoption gaps', question: 'Where is the unrealized value, and how is adoption tracking?' },
  'ai-quality': { label: 'AI quality', tip: 'Flag AI metrics that are off target', question: 'Analyze AI quality: which evaluation metrics are off target or need watching?' },
}
