import type { AdvisorAnswer, AdvisorRecommendation, PortfolioContext, SolutionContext } from './types'

/* Deterministic Implementation Advisor.
   Runs entirely in the browser from the same context the live model receives,
   so the app is fully useful at $0 and when the API is unavailable. It
   analyzes, recommends, and explains; it never approves or changes state. */

type Intent = 'next' | 'blocked' | 'gaps' | 'evidence' | 'risks' | 'stakeholder' | 'gate' | 'readiness' | 'value' | 'decisions'

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

export function answerSolution(question: string, c: SolutionContext): AdvisorAnswer {
  const { intent, role } = classify(question)
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

    case 'value': {
      const measured = c.metrics.filter((m) => m.current !== null)
      const weak = c.metrics.filter((m) => m.health === 'Off track' || m.health === 'Watch')
      const unmeasured = c.metrics.filter((m) => m.current === null)
      const fmt = (v: number) => `$${Math.round(v / 1000)}K`
      return {
        ...blank,
        summary: `Expected value is ${fmt(c.solution.expectedAnnualValueUsd)} a year${c.solution.realizedAnnualValueUsd ? `, with ${fmt(c.solution.realizedAnnualValueUsd)} realized so far` : ', none realized yet'}. ${measured.length} of ${c.metrics.length} metrics have current values${weak.length ? `; ${weak.length} need attention` : ''}.`,
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

export function answerPortfolio(question: string, c: PortfolioContext): AdvisorAnswer {
  const q = question.toLowerCase()
  const attention = c.solutions.filter((s) => s.status !== 'on_track').sort((a, b) => (a.status === 'blocked' ? -1 : 1) - (b.status === 'blocked' ? -1 : 1))
  const toRec = (s: PortfolioContext['solutions'][number]): AdvisorRecommendation => ({
    title: `${s.name}: ${s.nextBestAction}`,
    why: `${s.status === 'blocked' ? 'Blocked' : s.status === 'at_risk' ? 'At risk' : 'On track'} in ${s.stage}. ${s.statusReasons[0] ?? ''} Readiness ${s.readiness}% (expected ≥${s.expected}).`,
    owner: `${s.name} owner`,
    impact: `${s.openGateRequirements} open gate requirements`,
    blocking: s.status === 'blocked',
    priority: s.status === 'on_track' ? 'medium' : 'high',
    activityId: null,
  })
  if (/value|roi|dollar|\$/.test(q)) {
    const exp = c.solutions.reduce((n, s) => n + s.expectedValueUsd, 0)
    const real = c.solutions.reduce((n, s) => n + s.realizedValueUsd, 0)
    const pipeline = c.solutions.filter((s) => !s.realizedValueUsd).sort((a, b) => b.expectedValueUsd - a.expectedValueUsd)
    return { summary: `The portfolio expects $${(exp / 1e6).toFixed(1)}M a year; $${Math.round(real / 1000)}K is realized today. The biggest unrealized value sits in ${pipeline.slice(0, 2).map((s) => s.name).join(' and ')}.`, recommendations: pipeline.slice(0, 3).map(toRec), risksToDiscuss: [], questionsForStakeholders: [], gateOutlook: c.insights.find((i) => /value/i.test(i)) ?? '' }
  }
  if (/bottleneck|stuck|slow|where/.test(q)) {
    return { summary: c.insights[0] ?? 'No clear bottleneck right now.', recommendations: attention.slice(0, 4).map(toRec), risksToDiscuss: [], questionsForStakeholders: [], gateOutlook: c.insights.slice(1, 3).join(' ') }
  }
  return {
    summary: attention.length
      ? `${attention.length} of ${c.solutions.length} solutions need attention: ${attention.map((s) => `${s.name} (${s.status === 'blocked' ? 'blocked' : 'at risk'})`).join(', ')}. Open a solution and the advisor will focus on it.`
      : `All ${c.solutions.length} solutions are on track. Open a solution for a focused recommendation.`,
    recommendations: (attention.length ? attention : c.solutions.slice(0, 3)).slice(0, 4).map(toRec),
    risksToDiscuss: [],
    questionsForStakeholders: [],
    gateOutlook: c.insights.slice(0, 2).join(' '),
  }
}
