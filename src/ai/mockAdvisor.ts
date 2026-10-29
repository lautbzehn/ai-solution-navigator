import type { AdvisorArea, SolutionArea } from './areas'
import type { AdvisorAnswer, AdvisorRecommendation, PortfolioContext, SolutionContext } from './types'

/* Deterministic AI advisor.
   Runs entirely in the browser from the same context the live model receives,
   so the app is fully useful at $0 and when the API is unavailable. It
   analyzes, recommends, and explains; it never approves or changes state. */

type Intent = 'next' | 'blocked' | 'gaps' | 'evidence' | 'risks' | 'stakeholder' | 'gate' | 'readiness' | 'value' | 'decisions' | 'brief' | 'lifecycle' | 'work' | 'team' | 'history' | 'case'

/* A star icon names its area, so the analysis never depends on guessing from the wording. */
const AREA_INTENT: Record<SolutionArea, Intent> = {
  brief: 'brief',
  next: 'next',
  gate: 'gate',
  readiness: 'readiness',
  lifecycle: 'lifecycle',
  work: 'work',
  evidence: 'evidence',
  risks: 'risks',
  decisions: 'decisions',
  metrics: 'value',
  case: 'case',
  team: 'team',
  history: 'history',
}
const isSolutionArea = (a?: AdvisorArea): a is SolutionArea => !!a && a in AREA_INTENT
const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`)
const ownerName = (owner: string) => owner.replace(/ \(.*\)$/, '')

const ROLE_KEYWORDS: [RegExp, string][] = [
  [/secur|dwight|threat|inject/, 'Security'],
  [/privacy|legal|jan\b|consent|gdpr/, 'Privacy / Legal'],
  [/\bdata\b|oscar|data owner/, 'Data Owner'],
  [/financ|angela|budget|cost/, 'Finance'],
  [/operat|ops\b|darryl|support|incident|monitor/, 'Operations'],
  [/\bux\b|research|pam\b|design team/, 'UX / Research'],
  [/\bqa\b|evaluat|holly|test/, 'QA / Evaluation'],
  [/sponsor|executive|michael|leadership/, 'Executive Sponsor'],
  [/governance|complian|toby|risk team/, 'Governance / Risk'],
  [/engineer|ryan|developer/, 'Engineering'],
  [/architect|gabe/, 'AI / Solution Architect'],
  [/change|training|kelly|comms/, 'Change Management'],
  [/business owner|erin|uat owner/, 'Business Owner'],
]

export function classify(question: string): { intent: Intent; role?: string } {
  const q = question.toLowerCase()
  const role = ROLE_KEYWORDS.find(([re]) => re.test(q))?.[1]
  if (role && /discuss|talk|meet|ask|prepare for|1:1|sync|agenda|with/.test(q)) return { intent: 'stakeholder', role }
  if (/can'?t advance|cannot advance|why can|blocking|blocked|stuck|hold(ing)? (us|me) up/.test(q)) return { intent: 'blocked' }
  if (/gate|prepare|review|go-?live|ready to (advance|move)/.test(q)) return { intent: 'gate' }
  if (/evidence|document|proof|missing/.test(q)) return { intent: 'evidence' }
  if (/risk|mitigat|exposure/.test(q)) return { intent: 'risks' }
  if (/gap|weak|behind|lagging/.test(q)) return { intent: 'gaps' }
  if (/readiness|score|why is .*(\d|low|high)|explain/.test(q)) return { intent: 'readiness' }
  if (/value|metric|kpi|adoption|roi|outcome/.test(q)) return { intent: 'value' }
  if (/decision|decide|approve/.test(q)) return { intent: 'decisions' }
  if (role) return { intent: 'stakeholder', role }
  return { intent: 'next' }
}

const SEV_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }

function gateOutlook(c: SolutionContext) {
  if (!c.solution.nextStage) return `${c.solution.name} is in ${c.solution.stage}, the final continuous stage. Focus on improvement, value, and retirement criteria.`
  const pace = c.solution.daysInStage > c.solution.typicalDaysInStage ? ` It has been in ${c.solution.stage} ${c.solution.daysInStage} days, longer than the typical ${c.solution.typicalDaysInStage}.` : ` ${c.solution.daysInStage} days in ${c.solution.stage} so far (typical ${c.solution.typicalDaysInStage}).`
  if (c.gate.canAdvance) return `All ${c.gate.total} requirements for the ${c.gate.name} are met. The sponsor can record the gate decision now.${pace}`
  return `${c.gate.met} of ${c.gate.total} requirements met for the ${c.gate.name}. Still open: ${c.gate.unmet.map((u) => u.label).join('; ')}.${pace}`
}

function fromUnmet(u: SolutionContext['gate']['unmet'][number], c: SolutionContext, why?: string): AdvisorRecommendation {
  const evidenceOnly = /Activity complete, but/.test(u.detail)
  return {
    title: evidenceOnly ? `Get approval on the evidence for "${u.label}"` : u.label,
    why: why ?? (evidenceOnly ? `${u.detail}. The gate needs approved evidence, not just a completed checkbox.` : `${u.detail}. This is a gate requirement for moving to ${c.solution.nextStage}.`),
    owner: u.owner ?? 'Unassigned',
    impact: `Blocks the ${c.gate.name}${u.dueDate ? ` · due ${u.dueDate}` : ''}`,
    blocking: true,
    priority: 'high',
    activityId: u.activityId,
  }
}

function questionsFor(role: string, c: SolutionContext): string[] {
  const s = c.solution.name
  const base: Record<string, string[]> = {
    Security: [
      `Has prompt-injection and data-leakage testing been completed for ${s}, and where are the results?`,
      'Can a user review and override every AI output before it reaches a customer? Has that been observed in practice?',
      'Are access scopes for integrations least-privilege, and is there an audit trail?',
      'What security condition, if any, would you attach to the next gate?',
    ],
    'Privacy / Legal': ['Which personal data does the solution process, and is the legal basis documented?', 'Are retention and provider zero-retention terms in place?', 'Is anything in the risk register a legal blocker rather than a mitigable risk?'],
    'Data Owner': ['Is the data fit for purpose and current, especially for edge cases?', 'Who maintains the knowledge sources after go-live?', 'Are there access-rights or lineage concerns we haven\'t recorded?'],
    Finance: ['Do you agree with the value hypothesis and how it will be measured?', 'What evidence would you need to report realized value?', 'Are there costs (model usage, support) missing from the business case?'],
    Operations: ['Is the monitoring plan specific enough: signals, thresholds, and who responds?', 'Is the support runbook ready for day one, including how to disable the AI?', 'What volume and latency should we plan for at full rollout?'],
    'UX / Research': ['Does the human review moment fit the real workflow under load?', 'What did users misunderstand in testing?', 'How will users know when not to trust the AI?'],
    'QA / Evaluation': ['Did evaluation results meet the thresholds set in Design?', 'What happens at production scale that the offline set doesn\'t cover?', 'Which failure modes should be monitored after launch?'],
    'Executive Sponsor': [`Are you comfortable accepting the residual risk for ${s}?`, 'What conditions would you attach to the gate decision (pilot size, review cadence)?', 'Is the expected value still a priority this quarter?'],
    'Governance / Risk': ['Is the risk tier still correct given recent changes?', 'Which risks need explicit acceptance before deployment?', 'Is the evidence pack sufficient for the gate?'],
    Engineering: ['Is the configuration versioned so results can be traced and rolled back?', 'Is the rollback path tested?', 'Any technical debt that changes the known limitations?'],
    'AI / Solution Architect': ['Do the known limitations reflect what evaluation found?', 'Would any planned change (model, prompt, data) require re-evaluation?', 'Is the autonomy level still right for the risk tier?'],
    'Change Management': ['Is training ready, including when not to trust the AI?', 'Who are the champions for the pilot cohort?', 'How will adoption be measured in the first 30 days?'],
    'Business Owner': ['Did UAT cover the highest-value and highest-risk scenarios?', 'Are you ready to sign off, or what would change your mind?', 'What does success look like in the first month?'],
  }
  return base[role] ?? ['What do you need from the PM to move forward?', 'Is anything blocking you that isn\'t visible in the plan?']
}

export function answerSolution(question: string, c: SolutionContext, area?: AdvisorArea): AdvisorAnswer {
  const { intent, role } = isSolutionArea(area) ? { intent: AREA_INTENT[area], role: undefined } : classify(question)
  const openRisks = [...c.risks].sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))
  const unmitigated = openRisks.filter((r) => (r.severity === 'High' || r.severity === 'Critical') && r.mitigation === 'None recorded')
  const riskLines = (list = openRisks) => list.slice(0, 4).map((r) => `${r.title} (${r.severity}, ${r.status.toLowerCase()}): ${r.mitigation === 'None recorded' ? 'no mitigation yet' : r.mitigation} · ${r.owner}`)
  const outlook = gateOutlook(c)
  const nba = c.nextBestAction
  const blank: AdvisorAnswer = { summary: '', recommendations: [], risksToDiscuss: [], questionsForStakeholders: [], gateOutlook: outlook }

  switch (intent) {
    case 'blocked': {
      if (!c.solution.nextStage) return { ...blank, summary: `${c.solution.name} is in ${c.solution.stage}, which has no exit gate. Nothing is blocking advancement.` }
      if (c.gate.canAdvance)
        return { ...blank, summary: `Nothing is blocking. All ${c.gate.total} requirements for the ${c.gate.name} are met. The next step is for the sponsor to record the gate decision.`, recommendations: [{ title: 'Request the gate review', why: 'Every requirement is met and evidenced. A named decision owner must record the decision; the system never advances on its own.', owner: c.team.find((t) => /Executive Sponsor/.test(t.role))?.name ?? c.solution.owner, impact: `Moves the solution into ${c.solution.nextStage}`, blocking: false, priority: 'high', activityId: null }] }
      return {
        ...blank,
        summary: `You can't advance to ${c.solution.nextStage} yet: ${c.gate.unmet.length} of ${c.gate.total} gate requirements are still open. Each needs to be complete and backed by approved evidence. A checked box alone doesn't count.`,
        recommendations: c.gate.unmet.slice(0, 6).map((u, i) => fromUnmet(u, c, i === 0 && nba.activityId === u.activityId ? nba.why : undefined)),
        risksToDiscuss: riskLines(unmitigated.length ? unmitigated : openRisks.slice(0, 2)),
      }
    }

    case 'gate': {
      const sponsor = c.team.find((t) => /Executive Sponsor/.test(t.role))
      const recs = c.gate.unmet.slice(0, 5).map((u) => fromUnmet(u, c))
      if (sponsor) recs.push({ title: `Schedule the gate review with ${sponsor.name}`, why: 'The gate decision must be recorded by a named owner, with rationale and any conditions.', owner: c.solution.owner, impact: c.gate.canAdvance ? `Moves the solution into ${c.solution.nextStage}` : 'Book it now so it isn\'t the bottleneck once the evidence lands', blocking: false, priority: c.gate.canAdvance ? 'high' : 'medium', activityId: null })
      return {
        ...blank,
        summary: c.gate.canAdvance
          ? `You're ready for the ${c.gate.name}. Bring the evidence pack, the open risks with their mitigations, and a proposed set of conditions.`
          : `To prepare for the ${c.gate.name}, close the ${c.gate.unmet.length} open requirements below, then walk the sponsor through the evidence, residual risk, and proposed conditions.`,
        recommendations: recs,
        risksToDiscuss: riskLines(),
        questionsForStakeholders: sponsor ? [{ who: `${sponsor.name} (Executive Sponsor)`, questions: questionsFor('Executive Sponsor', c) }] : [],
      }
    }

    case 'evidence': {
      const done = c.evidenceGaps.filter((e) => e.activityCompleted)
      const missing = c.evidenceGaps.filter((e) => !e.activityCompleted)
      const recs: AdvisorRecommendation[] = [
        ...done.map((e) => ({ title: `Get the ${e.name} approved`, why: `The work is marked complete but the evidence is ${e.status.toLowerCase()}. Readiness and gates only give full credit for approved evidence.`, owner: e.owner, impact: `Fastest readiness gain: no new work, just review and approval (${e.stage})`, blocking: c.gate.unmet.some((u) => u.detail.includes(e.name)), priority: 'high' as const, activityId: c.activities.find((a) => a.evidence?.startsWith(e.name))?.id ?? null })),
        ...missing.map((e) => ({ title: `Produce the ${e.name}`, why: `Required for a ${c.solution.riskTier}-risk solution in ${e.stage}; currently ${e.status.toLowerCase()}.`, owner: e.owner, impact: c.gate.unmet.some((u) => u.detail.includes(e.name)) ? `Blocks the ${c.gate.name}` : `Needed before the ${e.stage} gate`, blocking: c.gate.unmet.some((u) => u.detail.includes(e.name)), priority: c.gate.unmet.some((u) => u.detail.includes(e.name)) ? ('high' as const) : ('medium' as const), activityId: c.activities.find((a) => a.evidence?.startsWith(e.name))?.id ?? null })),
      ].sort((a, b) => Number(b.blocking) - Number(a.blocking)).slice(0, 6)
      return {
        ...blank,
        summary: c.evidenceGaps.length
          ? `${c.evidenceGaps.length} required evidence ${c.evidenceGaps.length === 1 ? 'item is' : 'items are'} not yet approved for the current and next stage: ${done.length} where the work is done but approval is pending, and ${missing.length} not yet produced.`
          : 'All required evidence for the current and next stage is approved.',
        recommendations: recs,
      }
    }

    case 'risks': {
      const recs: AdvisorRecommendation[] = openRisks.slice(0, 5).map((r) => ({
        title: r.mitigation === 'None recorded' ? `Define a mitigation for "${r.title}"` : r.status === 'Open' ? `Start mitigating "${r.title}"` : `Confirm the mitigation for "${r.title}" is working`,
        why: `${r.severity} severity, ${r.likelihood.toLowerCase()} likelihood (${r.category}). ${r.mitigation === 'None recorded' ? 'Without a mitigation it lowers Risk & Governance readiness and blocks the Validate gate.' : `Current mitigation: ${r.mitigation}`}`,
        owner: r.owner,
        impact: r.severity === 'Critical' || r.severity === 'High' ? 'Affects Risk & Governance readiness and gate eligibility' : 'Keeps the register current for the risk review',
        blocking: r.mitigation === 'None recorded' && (r.severity === 'High' || r.severity === 'Critical'),
        priority: r.severity === 'Critical' || r.severity === 'High' ? 'high' : 'medium',
        activityId: null,
      }))
      return {
        ...blank,
        summary: openRisks.length
          ? `${openRisks.length} open ${openRisks.length === 1 ? 'risk' : 'risks'} for this ${c.solution.riskTier}-risk solution${unmitigated.length ? `, ${unmitigated.length} high-severity without a mitigation. Start there.` : '. Every high-severity risk has a mitigation.'}`
          : 'No open risks are recorded. If this feels optimistic, run a short risk workshop with Security and Governance.',
        recommendations: recs,
        risksToDiscuss: riskLines(),
      }
    }

    case 'stakeholder': {
      const r = role ?? 'Security'
      const people = c.team.filter((t) => t.role.includes(r))
      if (!people.length)
        return { ...blank, summary: `No one holds the ${r} role on this solution yet. Assign someone in the Team tab before the conversation; some gates require this role.`, recommendations: [{ title: `Assign a ${r} lead`, why: 'Specialized work needs a named, accountable owner before it can be scheduled.', owner: c.solution.owner, impact: 'Unblocks role-dependent activities and gates', blocking: false, priority: 'high', activityId: null }] }
      const names = people.map((p) => p.name)
      const theirs = c.activities.filter((a) => names.some((n) => a.owner.startsWith(n)) && a.status !== 'Complete' && a.status !== 'Not Applicable')
      const theirRisks = c.risks.filter((x) => names.some((n) => x.owner.startsWith(n)) || (r === 'Security' && /Security|Privacy|Model/.test(x.category)) || (r === 'Privacy / Legal' && /Privacy|Legal/.test(x.category)))
      return {
        ...blank,
        summary: `Agenda for ${names.join(' and ')} (${r}): ${theirs.length ? `${theirs.length} open ${theirs.length === 1 ? 'activity' : 'activities'} they own${theirs.some((a) => a.blocking) ? ', including gate requirements' : ''}` : 'no open activities they own'}, ${theirRisks.length} related ${theirRisks.length === 1 ? 'risk' : 'risks'}, and the questions below.`,
        recommendations: theirs.slice(0, 4).map((a) => ({ title: a.name, why: `${a.status}${a.evidence ? ` · ${a.evidence}` : ''}${a.blockedReason ? ` · Blocked: ${a.blockedReason}` : ''}${a.lastComment ? ` · Latest: "${a.lastComment.slice(0, 140)}"` : ''}`, owner: a.owner, impact: a.blocking ? `Gate requirement for ${a.stage}` : `Counts toward ${a.stage} readiness`, blocking: a.blocking, priority: a.blocking ? 'high' : 'medium', activityId: a.id })),
        risksToDiscuss: riskLines(theirRisks),
        questionsForStakeholders: people.map((p) => ({ who: `${p.name} (${r})`, questions: questionsFor(r, c) })),
      }
    }

    case 'gaps':
    case 'readiness': {
      const dims = [...c.readiness.dimensions].sort((a, b) => (100 - b.score) * b.weightPct - (100 - a.score) * a.weightPct)
      const status = c.readiness.pace === 'on_pace' ? 'on pace' : c.readiness.pace === 'behind' ? 'slightly behind pace' : 'well behind pace'
      return {
        ...blank,
        summary: `Implementation readiness is ${c.readiness.overall}/100, ${status} for ${c.solution.stage} (expected ≥${c.readiness.expectedForStage}). It measures how ready the whole implementation is to move forward, not AI safety alone. The biggest weighted gaps are ${dims.slice(0, 2).map((d) => `${d.name} (${d.score})`).join(' and ')}.`,
        recommendations: dims.slice(0, 4).map((d) => ({ title: `${d.name}: ${d.score}/100`, why: d.explanation, owner: c.activities.find((a) => d.topGaps.includes(a.name))?.owner ?? c.solution.owner, impact: `${d.weightPct}% of overall readiness${d.topGaps.length ? `. Close: ${d.topGaps.slice(0, 2).join(', ')}` : ''}`, blocking: c.gate.unmet.some((u) => d.topGaps.includes(u.label)), priority: d.score < c.readiness.expectedForStage ? 'high' : 'medium', activityId: c.activities.find((a) => d.topGaps.includes(a.name))?.id ?? null })),
      }
    }

    case 'brief': {
      const pace = c.readiness.pace === 'on_pace' ? 'on pace' : c.readiness.pace === 'behind' ? 'slightly behind pace' : 'well behind pace'
      const status = c.health.status === 'on_track' ? 'on track' : `${c.health.status === 'blocked' ? 'blocked' : 'at risk'} (${c.health.reasons[0]?.replace(/\.$/, '') ?? 'see status'})`
      const gateLine = !c.solution.nextStage ? 'It is in the final, continuous stage.' : c.gate.canAdvance ? `All ${c.gate.total} gate requirements are met.` : `${c.gate.met} of ${c.gate.total} gate requirements are met.`
      const recs: AdvisorRecommendation[] = []
      if (nba.title) recs.push({ title: nba.title, why: nba.why, owner: nba.owner ?? c.solution.owner, impact: nba.impact, blocking: c.gate.unmet.length > 0, priority: 'high', activityId: nba.activityId })
      for (const u of c.gate.unmet.slice(0, 3)) if (u.activityId !== nba.activityId && recs.length < 3) recs.push(fromUnmet(u, c))
      if (unmitigated[0]) recs.push({ title: `Add a mitigation for "${unmitigated[0].title}"`, why: `${unmitigated[0].severity}-severity risk with no mitigation.`, owner: unmitigated[0].owner, impact: 'Raises Risk & Governance readiness', blocking: false, priority: 'high', activityId: null })
      return {
        ...blank,
        summary: `${c.solution.name} is in ${c.solution.stage} (${c.solution.daysInStage} days, typical ${c.solution.typicalDaysInStage}) and ${status}. Readiness is ${c.readiness.overall}/100, ${pace} (expected ≥${c.readiness.expectedForStage}). ${gateLine} ${openRisks.length ? `${openRisks.length} open ${openRisks.length === 1 ? 'risk' : 'risks'}${unmitigated.length ? `, ${unmitigated.length} high-severity without a mitigation` : ''}.` : 'No open risks.'} Expected value is ${usd(c.solution.expectedAnnualValueUsd)} a year.`,
        recommendations: recs.slice(0, 4),
        risksToDiscuss: riskLines(unmitigated.length ? unmitigated : openRisks.slice(0, 2)),
      }
    }

    case 'lifecycle': {
      const req = (stage: string | null) => c.activities.filter((a) => a.stage === stage && a.required && a.status !== 'Not Applicable')
      const cur = req(c.solution.stage)
      const done = cur.filter((a) => a.status === 'Complete')
      const open = cur.filter((a) => a.status !== 'Complete').sort((a, b) => Number(b.blocking) - Number(a.blocking))
      const ahead = req(c.solution.nextStage)
      const started = ahead.filter((a) => a.status !== 'Not Started')
      const long = c.solution.daysInStage > c.solution.typicalDaysInStage
      return {
        ...blank,
        summary: `${done.length} of ${cur.length} required ${c.solution.stage} activities are complete${open.some((a) => a.blocking) ? `, and ${open.filter((a) => a.blocking).length} of the open ones block the gate` : ''}. ${c.solution.daysInStage} days in ${c.solution.stage} against a typical ${c.solution.typicalDaysInStage}${long ? ', so it is running long' : ''}. ${c.solution.nextStage ? `${ahead.length} required activities wait in ${c.solution.nextStage}; ${started.length} already started.` : 'This is the final stage.'}`,
        recommendations: [
          ...open.slice(0, 4).map((a) => ({ title: a.name, why: `${a.status}${a.evidence ? ` · ${a.evidence}` : ''}${a.blockedReason ? ` · Blocked: ${a.blockedReason}` : ''}`, owner: a.owner, impact: a.blocking ? `Gate requirement for ${c.solution.stage}` : `Counts toward ${c.solution.stage} readiness`, blocking: a.blocking, priority: a.blocking ? ('high' as const) : ('medium' as const), activityId: a.id })),
          ...ahead.filter((a) => a.status === 'Not Started' && a.blocking).slice(0, 2).map((a) => ({ title: `Start early: ${a.name}`, why: `Gate work for ${c.solution.nextStage}. Starting the long-lead pieces now shortens the next stage.`, owner: a.owner, impact: `Prepares the ${c.solution.nextStage} gate`, blocking: false, priority: 'low' as const, activityId: a.id })),
        ],
      }
    }

    case 'work': {
      const today = new Date().toISOString().slice(0, 10)
      const open = c.activities.filter((a) => a.status !== 'Complete' && a.status !== 'Not Applicable')
      const blocked = open.filter((a) => a.status === 'Blocked')
      const overdue = open.filter((a) => a.dueDate && a.dueDate < today && a.status !== 'Blocked')
      const unowned = open.filter((a) => a.owner.startsWith('Unassigned'))
      const load = new Map<string, number>()
      for (const a of open) if (!a.owner.startsWith('Unassigned')) load.set(ownerName(a.owner), (load.get(ownerName(a.owner)) ?? 0) + 1)
      const [top] = [...load.entries()].sort((a, b) => b[1] - a[1])
      const inFlight = open.filter((a) => a.status === 'In Progress' && a.blocking && !overdue.includes(a))
      return {
        ...blank,
        summary: `${open.length} open ${open.length === 1 ? 'activity' : 'activities'} across ${c.solution.stage}${c.solution.nextStage ? ` and ${c.solution.nextStage}` : ''}: ${blocked.length + overdue.length + unowned.length ? [blocked.length && `${blocked.length} blocked`, overdue.length && `${overdue.length} overdue`, unowned.length && `${unowned.length} without an owner`].filter(Boolean).join(', ') : 'nothing blocked, overdue, or unowned'}.${top ? ` ${top[0]} carries the most (${top[1]}).` : ''}`,
        recommendations: [
          ...blocked.map((a) => ({ title: `Unblock "${a.name}"`, why: a.blockedReason ?? 'Marked blocked without a reason. Ask the owner what it is waiting on.', owner: a.owner, impact: a.blocking ? 'Blocks the stage gate' : 'Holds up readiness', blocking: a.blocking, priority: 'high' as const, activityId: a.id })),
          ...overdue.map((a) => ({ title: `Reset or finish "${a.name}"`, why: `Was due ${a.dueDate}; still ${a.status.toLowerCase()}.`, owner: a.owner, impact: a.blocking ? 'Overdue gate work puts the solution at risk' : 'Keeps the plan honest', blocking: a.blocking, priority: a.blocking ? ('high' as const) : ('medium' as const), activityId: a.id })),
          ...unowned.map((a) => ({ title: `Assign an owner for "${a.name}"`, why: 'Work without a named owner rarely moves.', owner: c.solution.owner, impact: a.blocking ? 'Gate requirement' : 'Counts toward readiness', blocking: a.blocking, priority: 'medium' as const, activityId: a.id })),
          ...inFlight.map((a) => ({ title: `Keep "${a.name}" moving`, why: `In progress${a.evidence ? ` · ${a.evidence}` : ''}${a.lastComment ? ` · Latest: "${a.lastComment.slice(0, 120)}"` : ''}`, owner: a.owner, impact: `Gate requirement for ${a.stage}`, blocking: true, priority: 'medium' as const, activityId: a.id })),
        ].slice(0, 5),
      }
    }

    case 'team': {
      const sorted = [...c.team].sort((a, b) => b.openActivities - a.openActivities)
      const heavy = sorted[0]
      const unowned = c.activities.filter((a) => a.owner.startsWith('Unassigned') && a.status !== 'Complete' && a.status !== 'Not Applicable')
      const recs: AdvisorRecommendation[] = []
      if (heavy && heavy.openActivities >= 3) recs.push({ title: `Check ${heavy.name}'s capacity`, why: `${heavy.name} (${heavy.role}) owns ${heavy.openActivities} open required activities, the most on the team. A single owner is the usual hidden bottleneck.`, owner: c.solution.owner, impact: 'Spreads gate work so one calendar does not set the pace', blocking: false, priority: 'high', activityId: null })
      for (const a of unowned.slice(0, 3)) recs.push({ title: `Assign an owner for "${a.name}"`, why: 'Unowned work does not get scheduled.', owner: c.solution.owner, impact: a.blocking ? 'Gate requirement' : 'Counts toward readiness', blocking: a.blocking, priority: 'medium', activityId: a.id })
      for (const u of c.gate.unmet.slice(0, 2)) if (u.owner) recs.push({ title: `Agree a date with ${ownerName(u.owner)} for "${u.label}"`, why: u.detail, owner: u.owner, impact: `Blocks the ${c.gate.name}`, blocking: true, priority: 'high', activityId: u.activityId })
      return {
        ...blank,
        summary: `${c.team.length} people work on ${c.solution.name}.${heavy ? ` ${heavy.name} (${heavy.role}) carries the most open required work (${heavy.openActivities}).` : ''} ${unowned.length ? `${unowned.length} open ${unowned.length === 1 ? 'activity has' : 'activities have'} no owner.` : 'Every open activity has an owner.'}`,
        recommendations: recs.slice(0, 5),
        questionsForStakeholders: heavy ? [{ who: `${heavy.name} (${heavy.role.split(', ')[0]})`, questions: questionsFor(heavy.role.split(', ')[0], c).slice(0, 3) }] : [],
      }
    }

    case 'history': {
      const changes = c.recentChanges
      const proposed = changes.filter((x) => x.status === 'proposed')
      const retest = changes.filter((x) => /model|prompt|data/.test(x.type) && x.status !== 'rejected')
      return {
        ...blank,
        summary: changes.length
          ? `${changes.length} recent ${changes.length === 1 ? 'change' : 'changes'}; ${proposed.length} awaiting approval. ${retest.length ? `${retest.length} ${retest.length === 1 ? 'touches' : 'touch'} the model, prompt, or data, so evaluation should be re-run before shipping.` : 'None touch the model, prompt, or data.'}`
          : 'No changes have been logged. Log material changes to scope, model, data, prompts, or workflow so evaluation and risk can be re-checked.',
        recommendations: [
          ...proposed.map((x) => ({ title: `Get a decision on "${x.description}"`, why: 'Proposed changes sit in limbo until someone approves or rejects them.', owner: c.solution.owner, impact: 'Keeps the change log trustworthy', blocking: false, priority: 'medium' as const, activityId: null })),
          ...retest.map((x) => ({ title: `Re-run evaluation after "${x.description}"`, why: 'Model, prompt, and data changes can shift accuracy and failure modes. Prior results may no longer hold.', owner: c.team.find((t) => /QA/.test(t.role))?.name ?? c.solution.owner, impact: 'Protects the evaluation evidence the gates rely on', blocking: false, priority: 'high' as const, activityId: null })),
        ].slice(0, 5),
      }
    }

    case 'case':
    case 'value': {
      const measured = c.metrics.filter((m) => m.current !== null)
      const weak = c.metrics.filter((m) => m.health === 'Off track' || m.health === 'Watch')
      const unmeasured = c.metrics.filter((m) => m.current === null)
      const fmt = (v: number) => `$${Math.round(v / 1000)}K`
      const valueLine = `Expected value is ${fmt(c.solution.expectedAnnualValueUsd)} a year${c.solution.realizedAnnualValueUsd ? `, with ${fmt(c.solution.realizedAnnualValueUsd)} realized so far` : ', none realized yet'}. ${measured.length} of ${c.metrics.length} metrics have current values${weak.length ? `; ${weak.length} need attention` : ''}.`
      return {
        ...blank,
        summary: intent === 'case' ? `The case: ${c.solution.businessProblem.split(/(?<=\.)\s/)[0]} The target outcome is to ${c.solution.desiredOutcome.charAt(0).toLowerCase()}${c.solution.desiredOutcome.slice(1).replace(/\.$/, '')}. ${valueLine}` : valueLine,
        recommendations: [
          ...weak.map((m) => ({ title: `Investigate ${m.name}`, why: `${m.health}: current ${m.current} ${m.unit} vs target ${m.target} ${m.unit} (baseline ${m.baseline ?? 'n/a'}).`, owner: c.solution.owner, impact: 'Protects the value case', blocking: false, priority: 'high' as const, activityId: null })),
          ...unmeasured.slice(0, 3).map((m) => ({ title: `Start measuring ${m.name}`, why: `Target ${m.target ?? 'not set'} ${m.unit}, but no current value yet. Value can't be proven without it.`, owner: c.solution.owner, impact: 'Needed for value and adoption reporting', blocking: false, priority: 'medium' as const, activityId: null })),
        ].slice(0, 5),
      }
    }

    case 'decisions': {
      const pending = c.decisions.filter((d) => d.outcome === 'Pending')
      return {
        ...blank,
        summary: pending.length ? `${pending.length} ${pending.length === 1 ? 'decision is' : 'decisions are'} waiting. Pending decisions often hide behind blocked activities.` : 'No decisions are pending. Recent decisions are listed in the Decisions tab.',
        recommendations: pending.map((d) => ({ title: `Get a decision on "${d.title}"`, why: 'Open decisions stall the work that depends on them. Bring the recommendation and the evidence reviewed.', owner: d.owner, impact: 'Unblocks dependent activities', blocking: c.activities.some((a) => a.status === 'Blocked'), priority: 'high' as const, activityId: null })),
      }
    }

    default: {
      const recs: AdvisorRecommendation[] = []
      if (nba.title) recs.push({ title: nba.title, why: nba.why, owner: nba.owner ?? c.solution.owner, impact: nba.impact, blocking: c.gate.unmet.length > 0, priority: 'high', activityId: nba.activityId })
      for (const u of c.gate.unmet.slice(0, 4)) if (u.activityId !== nba.activityId) recs.push(fromUnmet(u, c))
      if (unmitigated[0]) recs.push({ title: `Add a mitigation for "${unmitigated[0].title}"`, why: `${unmitigated[0].severity}-severity risk with no mitigation. It lowers Risk & Governance readiness.`, owner: unmitigated[0].owner, impact: 'Raises readiness and protects the Validate gate', blocking: false, priority: 'high', activityId: null })
      const owner = recs[0]?.owner ?? ''
      const ownerRole = c.team.find((t) => owner.startsWith(t.name))?.role.split(', ')[0]
      return {
        ...blank,
        summary: c.gate.canAdvance
          ? `Everything for the ${c.gate.name} is in place. Your next move is to request the gate review and record the decision.`
          : `Focus on "${nba.title.replace(/ before requesting.*$/, '')}". It's the highest-priority of the ${c.gate.unmet.length} open requirements for the ${c.gate.name}. After that, work through the rest in the order below.`,
        recommendations: recs.slice(0, 5),
        risksToDiscuss: riskLines(unmitigated.length ? unmitigated : openRisks.slice(0, 2)),
        questionsForStakeholders: ownerRole ? [{ who: owner, questions: questionsFor(ownerRole, c).slice(0, 3) }] : [],
      }
    }
  }
}

export function answerPortfolio(question: string, c: PortfolioContext, area?: AdvisorArea): AdvisorAnswer {
  const q = question.toLowerCase()
  const n = c.solutions.length
  const blank: AdvisorAnswer = { summary: '', recommendations: [], risksToDiscuss: [], questionsForStakeholders: [], gateOutlook: '' }
  const attention = c.solutions.filter((s) => s.status !== 'on_track').sort((a, b) => (a.status === 'blocked' ? -1 : 1) - (b.status === 'blocked' ? -1 : 1))
  const behind = c.solutions.filter((s) => s.readiness < s.expected).sort((a, b) => a.readiness - a.expected - (b.readiness - b.expected))
  const toRec = (s: PortfolioContext['solutions'][number]): AdvisorRecommendation => ({
    title: `${s.name}: ${s.nextBestAction}`,
    why: `${s.status === 'blocked' ? 'Blocked' : s.status === 'at_risk' ? 'At risk' : 'On track'} in ${s.stage}. ${s.statusReasons[0] ?? ''} Readiness ${s.readiness}% (expected ≥${s.expected}).`,
    owner: `${s.name} owner`,
    impact: `${s.openGateRequirements} open gate requirements`,
    blocking: s.status === 'blocked',
    priority: s.status === 'on_track' ? 'medium' : 'high',
    activityId: null,
  })
  const insight = (re: RegExp) => c.insights.find((i) => re.test(i)) ?? ''

  const valueAnswer = (): AdvisorAnswer => {
    const exp = c.solutions.reduce((t, s) => t + s.expectedValueUsd, 0)
    const real = c.solutions.reduce((t, s) => t + s.realizedValueUsd, 0)
    const pipeline = c.solutions.filter((s) => !s.realizedValueUsd).sort((a, b) => b.expectedValueUsd - a.expectedValueUsd)
    const adoption = (c.adoption ?? []).filter((a) => a.adoptionRatePct !== null)
    const low = adoption.filter((a) => (a.adoptionRatePct ?? 0) < 30)
    return {
      ...blank,
      summary: `The portfolio expects ${usd(exp)} a year; ${usd(real)} (${exp ? Math.round((real / exp) * 100) : 0}%) is realized today. The biggest unrealized value sits in ${pipeline.slice(0, 2).map((s) => `${s.name} (${usd(s.expectedValueUsd)})`).join(' and ')}.${adoption.length ? ` ${adoption.length} ${adoption.length === 1 ? 'solution reports' : 'solutions report'} adoption${low.length ? `; ${low.map((a) => `${a.solution} is at ${a.adoptionRatePct}%`).join(', ')}` : ', all above 30%'}.` : ''}`,
      recommendations: [
        ...pipeline.slice(0, 3).map(toRec),
        ...low.slice(0, 2).map((a) => ({ title: `Lift adoption of ${a.solution}`, why: `${a.activeUsers ?? 0} of ${a.eligibleUsers ?? '?'} eligible users are active (${a.adoptionRatePct}%). Value can't be realized by people who don't use it.`, owner: `${a.solution} owner`, impact: 'Turns expected value into realized value', blocking: false, priority: 'high' as const, activityId: null })),
      ].slice(0, 5),
      gateOutlook: insight(/value/i),
    }
  }

  const riskAnswer = (): AdvisorAnswer => {
    const risks = c.risks ?? []
    const unmit = risks.filter((r) => (r.severity === 'High' || r.severity === 'Critical') && r.mitigation === 'None recorded')
    const crit = risks.filter((r) => r.severity === 'Critical')
    const per = new Map<string, number>()
    for (const r of risks) per.set(r.solution, (per.get(r.solution) ?? 0) + 1)
    const [top] = [...per.entries()].sort((a, b) => b[1] - a[1])
    const focus = [...crit, ...unmit].filter((r, i, a) => a.indexOf(r) === i)
    return {
      ...blank,
      summary: risks.length
        ? `${risks.length} open risks across the portfolio: ${crit.length} critical and ${unmit.length} high-severity without a mitigation.${top ? ` The most exposure sits with ${top[0]} (${top[1]}).` : ''}`
        : 'No open risks are recorded across the portfolio.',
      recommendations: focus.slice(0, 5).map((r) => ({
        title: r.mitigation === 'None recorded' ? `Define a mitigation for "${r.title}"` : `Confirm the mitigation for "${r.title}" is working`,
        why: `${r.severity} risk on ${r.solution}. ${r.mitigation === 'None recorded' ? 'Without a mitigation it lowers Risk & Governance readiness and blocks the Validate gate.' : `Current mitigation: ${r.mitigation}`}`,
        owner: r.owner,
        impact: 'Affects Risk & Governance readiness and gate eligibility',
        blocking: r.mitigation === 'None recorded',
        priority: 'high' as const,
        activityId: null,
      })),
      risksToDiscuss: focus.slice(0, 4).map((r) => `${r.title} (${r.severity}, ${r.solution}) · ${r.owner}`),
    }
  }

  switch (area) {
    case 'portfolio': {
      const prod = c.solutions.filter((s) => s.stage === 'Operate' || s.stage === 'Improve / Retire')
      return {
        ...blank,
        summary: `${n} solutions: ${prod.length} in production and ${n - prod.length} in flight. ${n - behind.length} ${n - behind.length === 1 ? 'is' : 'are'} at or above the readiness their stage expects; ${behind.length} ${behind.length === 1 ? 'is' : 'are'} behind${behind[0] ? `, furthest behind ${behind[0].name} (${behind[0].readiness}% vs ≥${behind[0].expected})` : ''}.`,
        recommendations: (behind.length ? behind : attention).slice(0, 4).map(toRec),
        gateOutlook: c.insights[0] ?? '',
      }
    }
    case 'progress':
    case 'health': {
      const avg = Math.round(c.solutions.reduce((t, s) => t + s.readiness, 0) / (n || 1))
      const stages = new Map<string, number>()
      for (const s of c.solutions) stages.set(s.stage, (stages.get(s.stage) ?? 0) + 1)
      const [busiest] = [...stages.entries()].sort((a, b) => b[1] - a[1])
      const counts = { on: c.solutions.filter((s) => s.status === 'on_track').length, risk: c.solutions.filter((s) => s.status === 'at_risk').length, blocked: c.solutions.filter((s) => s.status === 'blocked').length }
      return {
        ...blank,
        summary:
          area === 'health'
            ? `${counts.on} of ${n} solutions are on track, ${counts.risk} at risk, and ${counts.blocked} blocked. Average readiness is ${avg}%. ${behind.length} ${behind.length === 1 ? 'solution is' : 'solutions are'} behind the readiness their stage expects${behind.length ? `: ${behind.slice(0, 3).map((s) => s.name).join(', ')}` : ''}.`
            : `Average readiness is ${avg}%. ${behind.length} of ${n} solutions ${behind.length === 1 ? 'is' : 'are'} behind the readiness their stage expects, and the most work sits in ${busiest?.[0] ?? 'no stage'} (${busiest?.[1] ?? 0}). ${insight(/bottleneck/i)}`,
        recommendations: [...attention, ...behind.filter((s) => !attention.includes(s))].slice(0, 4).map(toRec),
      }
    }
    case 'delivery': {
      const d = c.delivery
      if (!d) return { ...blank, summary: c.insights[0] ?? 'No delivery data yet.' }
      const slow = d.stages.filter((s) => s.solutions > 0 && s.avgDays > s.typicalDays).sort((a, b) => b.avgDays / b.typicalDays - a.avgDays / a.typicalDays)
      const there = slow[0] ? c.solutions.filter((s) => s.stage === slow[0].name) : []
      return {
        ...blank,
        summary: `${d.gatePassRatePct !== null ? `Gate pass rate is ${d.gatePassRatePct}%` : 'No gate decisions yet'}${d.avgDaysToProduction !== null ? `, and solutions take ${d.avgDaysToProduction} days on average to reach production` : ''}. ${slow[0] ? `${slow[0].name} is the slowest stage: ${slow[0].avgDays} days on average against a typical ${slow[0].typicalDays}, main reason: ${slow[0].primaryReason}.` : 'No stage is running over its typical duration.'} ${d.blockedActivities} ${d.blockedActivities === 1 ? 'activity is' : 'activities are'} blocked and ${d.overdueActivities} overdue.`,
        recommendations: [...there, ...attention.filter((s) => !there.includes(s))].slice(0, 4).map(toRec),
        gateOutlook: insight(/bottleneck|gate/i),
      }
    }
    case 'portfolio-risk':
      return riskAnswer()
    case 'value':
      return valueAnswer()
    case 'risk-value': {
      const r = riskAnswer()
      const v = valueAnswer()
      return { ...blank, summary: `${r.summary} ${v.summary}`, recommendations: [...r.recommendations.slice(0, 2), ...v.recommendations.slice(0, 2)], risksToDiscuss: r.risksToDiscuss.slice(0, 3) }
    }
    case 'ai-quality': {
      const m = c.aiMetrics ?? []
      const off = m.filter((x) => x.health === 'Off track')
      const watch = m.filter((x) => x.health === 'Watch')
      const solutions = new Set(m.map((x) => x.solution)).size
      return {
        ...blank,
        summary: m.length
          ? `${solutions} ${solutions === 1 ? 'solution reports' : 'solutions report'} ${m.length} AI evaluation metrics. ${off.length ? `${off.length} ${off.length === 1 ? 'is' : 'are'} off target: ${off.map((x) => `${x.name} on ${x.solution}`).join(', ')}.` : 'None are off target.'}${watch.length ? ` ${watch.length} ${watch.length === 1 ? 'is' : 'are'} worth watching.` : ''}`
          : 'No solution is reporting AI evaluation metrics yet. Map accuracy, hallucination, and override metrics in each solution so quality can be compared.',
        recommendations: off.length + watch.length
          ? [...off, ...watch].slice(0, 5).map((x) => ({ title: `Investigate ${x.name} on ${x.solution}`, why: `${x.health}: currently ${x.current}${x.unit === '%' ? '%' : ` ${x.unit}`} against a target of ${x.target}${x.unit === '%' ? '%' : ` ${x.unit}`}.`, owner: `${x.solution} owner`, impact: 'Protects AI quality and user trust', blocking: false, priority: x.health === 'Off track' ? ('high' as const) : ('medium' as const), activityId: null }))
          : c.solutions
              .filter((s) => ['Validate', 'Deploy'].includes(s.stage) && m.some((x) => x.solution === s.name))
              .map((s) => ({ title: `Re-measure ${s.name} at production scale`, why: `Offline evaluation results often drift under real traffic. The pilot should re-check ${m.filter((x) => x.solution === s.name).map((x) => x.name.toLowerCase()).slice(0, 3).join(', ')} before go-live.`, owner: `${s.name} owner`, impact: 'Keeps quality evidence current for the Deploy gate', blocking: false, priority: 'medium' as const, activityId: null })),
      }
    }
  }

  if (/value|roi|dollar|\$/.test(q)) return valueAnswer()
  if (/bottleneck|stuck|slow|where/.test(q)) {
    return { ...blank, summary: c.insights[0] ?? 'No clear bottleneck right now.', recommendations: attention.slice(0, 4).map(toRec), gateOutlook: c.insights.slice(1, 3).join(' ') }
  }
  if (/risk|mitigat/.test(q)) return riskAnswer()
  return {
    ...blank,
    summary: attention.length
      ? `${attention.length} of ${n} solutions need attention: ${attention.map((s) => `${s.name} (${s.status === 'blocked' ? 'blocked' : 'at risk'})`).join(', ')}. Open a solution and the advisor will focus on it.`
      : `All ${n} solutions are on track. Open a solution for a focused recommendation.`,
    recommendations: (attention.length ? attention : c.solutions.slice(0, 3)).slice(0, 4).map(toRec),
    gateOutlook: c.insights.slice(0, 2).join(' '),
  }
}
