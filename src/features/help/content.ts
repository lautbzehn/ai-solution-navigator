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
    steps: ['In Work, complete the gate activities and attach their evidence.', 'Get each piece of evidence approved. A checked box alone does not count.', 'When every requirement is met, select Request decision in the header so a gatekeeper can record Go.'],
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
    steps: ['Select New solution in the top bar.', 'Give it a name, describe the problem, and pick the owner. Then select Create now, fill in later.', 'Or add what you already know: users, outcome, how AI helps, data. With enough answers you get a recommended risk tier; otherwise it starts as a Moderate placeholder until Assess confirms it.'],
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
  { category: 'Lifecycle and gates', q: 'What are the eight stages?', a: 'Discover, Assess, Design, Build, Validate, Deploy, Operate, and Improve / Retire. Each ends in a gate except the last, which is continuous.' },
  { category: 'Lifecycle and gates', q: 'What standards is the lifecycle based on?', a: 'Recognized practice for AI systems. The stages follow the AI system life cycle in ISO/IEC 22989: Discover and Assess are inception, Design and Build are design and development, Validate is verification and validation, Deploy and Operate are deployment and operation, and Improve / Retire covers re-evaluation and retirement. Risk work follows the NIST AI Risk Management Framework, starting in planning and running the whole way. The gates come from Stage-Gate: each stage ends in a decision a named person makes.' },
  { category: 'Lifecycle and gates', q: 'What does a gate check?', a: 'Blocking activities must be complete with approved evidence, plus criteria such as named roles, defined metrics, and mitigated high risks. The gate review explains anything still open.' },
  { category: 'Lifecycle and gates', q: 'What does the Assess gate need from a feasibility spike?', a: "For Moderate and High risk, a result measured on sample data that meets a threshold the team set before running it; a memo isn't enough. Record it as a metric with the Feasibility result key." },
  { category: 'Lifecycle and gates', q: 'Who decides that a solution can advance?', a: 'A gatekeeper. Each gate names the roles allowed to decide it, such as the Executive Sponsor or Governance / Risk, and the solution owner never decides their own gate. The gatekeeper records the decision with a rationale and any conditions. Neither the system nor the AI advisor ever approves on its own.' },
  { category: 'Lifecycle and gates', q: 'Can a project be put on hold or stopped?', a: 'Yes, at any gate. The gatekeeper chooses Go (advance), Hold (pause with every bit of progress kept) or Stop (end the project, with the record and the reason kept). A held project resumes exactly where it paused. Stopping early is a valid outcome, not a failure.' },
  { category: 'Readiness', q: 'What does the readiness score measure?', a: 'How prepared the whole implementation is to move forward, across seven weighted dimensions. It is not a measure of model quality alone.' },
  { category: 'Readiness', q: "Why is a solution 'behind pace'?", a: 'Each stage expects a minimum readiness. Below it shows amber; more than 10 points below shows red.' },
  { category: 'Readiness', q: 'Can we change how readiness is weighted?', a: 'Yes. Open Lifecycle Framework, then Readiness weights. Every score in the portfolio recalculates immediately.' },
  { category: 'Risk and evidence', q: 'How is the risk tier chosen?', a: 'When you create a solution and add what the AI does, whose experience it reaches, and how sensitive the data is, the app recommends a tier from impact, data sensitivity, and autonomy. Without those answers it starts as a Moderate placeholder until the Assess gate confirms it. Higher tiers add required controls and stronger gate criteria.' },
  { category: 'Risk and evidence', q: "Why doesn't a completed activity count fully?", a: "Readiness and gates give full credit only when the evidence is approved, so 'done' always means 'proven'." },
  { category: 'Risk and evidence', q: 'Where do I find evidence?', a: 'In Work. Expand any activity to see its evidence, submit it for review, or approve it. Show: Gaps lists everything not yet approved, and evidence not tied to an activity sits at the end under Other evidence.' },
  { category: 'Lifecycle and gates', q: 'How do I see a stage in detail?', a: "Select any stage on the lifecycle bar in a solution. A panel opens with the stage's purpose, progress, required activities, and its gate." },
  { category: 'Risk and evidence', q: 'Who approves evidence?', a: "Anyone on the team except the person who owns it. The owner drafts it and submits it for review. Then a teammate chooses Approve, picks who is signing off, and adds a one-line note on what they checked. The app logs who approved it and when, and never lets owners sign off their own work." },
  { category: 'Risk and evidence', q: 'What happens to a high-severity risk with no mitigation?', a: 'It lowers Risk & Governance readiness and blocks the Validate gate until a mitigation is recorded.' },
  { category: 'Reports', q: 'Where do the report numbers come from?', a: "They're calculated live from every solution's activities, evidence, risks, metrics, and gate history." },
  { category: 'Reports', q: 'Can I filter the reports?', a: 'Yes, by date range, lifecycle stage, and risk tier. The insights recalculate for whatever you select.' },
  { category: 'AI advisor', q: 'What does the star icon do?', a: 'It asks the AI advisor for an analysis of that specific area, such as a gate, the risks, or delivery across the portfolio.' },
  { category: 'AI advisor', q: 'Does the AI advisor make decisions?', a: 'No. It analyzes, recommends, and explains. Approvals, gate decisions, and legal or security determinations stay with your team.' },
  { category: 'AI advisor', q: 'Is it a live AI model?', a: 'By default it uses built-in guidance computed in your browser from the live data. When a server key is configured it answers with Claude, and falls back automatically if that is unavailable.' },
  { category: 'Demo data', q: 'Is this real data?', a: 'No. Every person, solution, and number is fictional demo data.' },
  { category: 'Demo data', q: 'Who built this?', a: 'Dan West, an AI strategy and operations leader. About this project, at the bottom of the sidebar, has the story behind it and how to get in touch.' },
  { category: 'Demo data', q: "What's Icarian Forge?", a: "Dan's personal AI lab, where he builds and tests what he advises on. This app is one of its projects." },
  { category: 'Demo data', q: 'Are my changes saved?', a: 'Yes, in this browser only. Nobody else sees them. Settings, then Reset demo data, restores the original portfolio.' },
  { category: 'Demo data', q: 'Is my visit counted?', a: "Anonymously, so Dan can see which pages people find useful: the pages you open, for how long, and links that take you out of the app. Never its buttons, and never anything you type or change. No cookies, and nothing at all if your browser sends Global Privacy Control. Details at icarianforge.com/privacy." },
]
