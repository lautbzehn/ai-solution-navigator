/* Help center content. Kept as data so the guide, FAQ, and search stay in sync. */

export interface Guide {
  id: string
  title: string
  steps: string[]
  /** Where "Show me" goes: a route, or an action the help panel performs. */
  to?: string
  action?: 'create'
}

export const GUIDES: Guide[] = [
  {
    id: 'health',
    title: 'Check portfolio health in 30 seconds',
    steps: ['Open My Overview.', 'Read your one-line briefing, what is yours, and the four headline numbers.', 'Open Needs your attention to see what is blocked or at risk, and the next step for each.'],
    to: '/#attention',
  },
  {
    id: 'blocked',
    title: "Find out why a solution can't advance",
    steps: ['Open a solution from My Overview, the Solutions Hub, or your Favorites.', 'On Overview, Gate readiness lists every open requirement and who owns it.', 'Select a requirement to open the activity and see exactly what is missing.'],
    to: '/solutions/s_support',
  },
  {
    id: 'advance',
    title: 'Move a solution to the next stage',
    steps: ['In Work, complete the gate activities and attach their evidence.', 'Get each piece of evidence approved. A checked box alone does not count.', 'Select Request decision in the header (it reads Check gate while work is open) and record the decision with a named approver.'],
    to: '/solutions/s_support/work',
  },
  {
    id: 'advisor',
    title: 'Get an AI analysis of any area',
    steps: ['Find the star icon on a section header.', 'Select it. The AI advisor opens with an analysis of just that area.', 'Ask follow-up questions in the advisor panel.'],
    to: '/solutions/s_support',
  },
  {
    id: 'create',
    title: 'Start a new AI initiative',
    steps: ['Select New solution in the top bar.', 'Describe the problem, the users, and how AI will help.', 'Review the recommended risk tier. The plan and gates are generated to match it.'],
    action: 'create',
  },
  {
    id: 'report',
    title: 'Report to leadership',
    steps: ['Open Reports.', 'Read the three key insights, then open only the section you need.', 'Filter by date range, lifecycle stage, or risk tier.'],
    to: '/reports',
  },
]

export const FAQ_CATEGORIES = ['Getting around', 'Lifecycle and gates', 'Readiness', 'Risk and evidence', 'Reports', 'AI advisor', 'Demo data'] as const
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]

export interface Faq {
  category: FaqCategory
  q: string
  a: string
}

export const FAQS: Faq[] = [
  { category: 'Getting around', q: "What's the fastest way to find a solution?", a: 'Press ⌘K (Ctrl K on Windows) anywhere and type its name, or open the Solutions Hub and filter by status, stage, risk, owner, or readiness. Star the ones you use most and they stay under Favorites in the sidebar.' },
  { category: 'Getting around', q: 'Why are sections folded?', a: 'Each section shows a one-line headline so you can scan a page in seconds. Open only what you need, or use Expand all. The app remembers what you opened.' },
  { category: 'Getting around', q: 'What are the items under each sidebar page?', a: "They're the sections of that page. Select one to jump straight to it. Use the arrow beside any sidebar group to open or close it at any time; the sidebar remembers your choice." },
  { category: 'Getting around', q: 'How do I keep a solution handy?', a: 'Select the star beside its name. Starred solutions stay under Favorites in the sidebar; select the star again to remove one. Recently viewed shows the ones you opened last.' },
  { category: 'Lifecycle and gates', q: 'What are the five stages?', a: 'Frame, Prove, Build, Launch, and Run. Frame and Prove test an idea small, Build and Launch deliver it carefully, and Run measures it every quarter. Each stage ends in a gate; Run ends in a recurring value review.' },
  { category: 'Lifecycle and gates', q: 'What is the Proof gate?', a: 'The checkpoint between a small, time-boxed proof of concept and any build money. It compares the PoC results with the thresholds in its charter, shows a Scale Potential score, and records one of four decisions: scale, iterate, pivot, or stop.' },
  { category: 'Lifecycle and gates', q: 'Can a project be paused or stopped?', a: 'Yes, at any gate. Park pauses it with all progress kept, and Resume picks it up again. Stop closes it and keeps the lesson. Stopping early is counted as a good outcome in the kill rate.' },
  { category: 'Lifecycle and gates', q: 'What does a gate check?', a: 'Blocking activities must be complete with approved evidence, plus criteria such as named roles, defined metrics, and mitigated high risks. The gate review explains anything still open.' },
  { category: 'Lifecycle and gates', q: 'Who decides that a solution can advance?', a: 'A named approver records the gate decision with a rationale and any conditions: the sponsor for most gates, and never the solution\'s own owner. Neither the app nor the AI advisor advances anything on its own.' },
  { category: 'Readiness', q: 'What does the readiness score measure?', a: 'How prepared the whole implementation is to move forward, across seven weighted dimensions. It is not a measure of model quality alone.' },
  { category: 'Readiness', q: "Why is a solution 'behind pace'?", a: 'Each stage expects a minimum readiness. Below it shows amber; more than 10 points below shows red.' },
  { category: 'Readiness', q: 'Can we change how readiness is weighted?', a: 'Yes. Open Lifecycle Framework, then Readiness weights. Every score in the portfolio recalculates immediately.' },
  { category: 'Risk and evidence', q: 'How is the risk tier chosen?', a: 'The new-solution wizard recommends one from impact, data sensitivity, and autonomy. Higher tiers add required controls and stronger gate criteria.' },
  { category: 'Risk and evidence', q: "Why doesn't a completed activity count fully?", a: "Readiness and gates give full credit only when the evidence is approved, so 'done' always means 'proven'." },
  { category: 'Risk and evidence', q: 'What happens to a high-severity risk with no mitigation?', a: 'It lowers Risk & Governance readiness and blocks the Proof and Release readiness gates until a mitigation is recorded.' },
  { category: 'Reports', q: 'Where do the report numbers come from?', a: "They're calculated live from every solution's activities, evidence, risks, metrics, and gate history." },
  { category: 'Reports', q: 'Can I filter the reports?', a: 'Yes, by date range, lifecycle stage, and risk tier. The insights recalculate for whatever you select.' },
  { category: 'AI advisor', q: 'What does the star icon do?', a: 'It asks the AI advisor for an analysis of that specific area, such as a gate, the risks, or delivery across the portfolio.' },
  { category: 'AI advisor', q: 'Does the AI advisor make decisions?', a: 'No. It analyzes, recommends, and explains. Approvals, gate decisions, and legal or security determinations stay with your team.' },
  { category: 'AI advisor', q: 'Is it a live AI model?', a: 'By default it uses built-in guidance computed in your browser from the live data. When a server key is configured it answers with Claude, and falls back automatically if that is unavailable.' },
  { category: 'Demo data', q: 'Is this real data?', a: 'No. Every person, solution, and number is fictional demo data.' },
  { category: 'Demo data', q: 'Who built this?', a: 'Dan West, an AI strategy and adoption leader. About this project, at the bottom of the sidebar, has the story behind it and how to get in touch.' },
  { category: 'Demo data', q: "What's Icarian Forge?", a: "Dan's personal AI lab, where he builds and tests what he advises on. This app is one of its projects." },
  { category: 'Demo data', q: 'Are my changes saved?', a: 'Yes, in this browser only. Nobody else sees them. Settings, then Reset demo data, restores the original portfolio.' },
]
