# Case Study: Forge AI Solution Navigator

**v1.0 · 10.09.2026** · Dan West · [Live demo](https://navigator.icarianforge.com) · [Source](../README.md)

---

## The one-line version

Most enterprise AI pilots don't fail on the model. They fail between the pilot and production, where nobody can say what stage an initiative is in, what evidence is missing, or who owns the next move. I built a workspace that answers those questions for every AI initiative at once, and makes it hard to skip the steps that matter.

## The problem

- **Leaders lose the thread.** An AI portfolio of eight or ten initiatives spreads across data science, engineering, legal, security, operations, and the business. Status lives in decks and spreadsheets that are out of date the day after they are written.
- **"Done" is not the same as "proven."** Teams mark a task complete without the evidence behind it. A model evaluation exists as a Slack message, not an approved artifact. Gates get waved through.
- **Governance is all or nothing.** Either every initiative goes through the full heavyweight review (and low-risk ideas die in the queue), or nothing does (and a high-risk system ships with no oversight plan).
- **Existing tools miss the middle.** Project trackers know tasks but not AI risk. GRC platforms know controls but not delivery. Neither tells a Product Manager what to do next.

## Who it's for

| User | What they need | How the Navigator answers |
| --- | --- | --- |
| Lead Product Manager (primary) | Where is each initiative, what's next, who owns it | Lifecycle rail, Next Best Action with owner and impact |
| Executive sponsor | Is the portfolio healthy, where is value at risk | Portfolio dashboard and Intelligence view, every chart drills down |
| Specialists (risk, security, data, ops) | What evidence is expected from me, by when | Stage activities with named owners and evidence templates |
| Auditor / risk committee | Who decided what, and why | Decisions log with required rationale, full change history |

## Key product decisions

### 1. The methodology is data, not code

The 8-stage lifecycle (Discover → Assess → Design → Build → Validate → Deploy → Operate → Improve/Retire) lives in a single config file: 60 activity templates, 41 evidence templates, 7 gates, 15 roles, 3 risk tiers, 7 readiness dimensions. The plan, gates, readiness scoring, framework page, and reports all read from it.

- **Why:** every organization's AI governance is a little different, and it changes as regulation moves. A change in policy should be a config edit, not a sprint.
- **Trade-off:** a config-driven engine is harder to build than hard-coded screens. Worth it, because it's what makes the product adoptable beyond one team.

### 2. Gates check evidence, not checkboxes

A stage's exit gate passes only when its blocking activities are complete **and** their evidence is approved, plus explicit criteria (required fields, assigned roles, metric thresholds, risk rules). When a gate blocks, it always says why, who owns the fix, and links straight to it.

- **Why:** the most common failure I've seen in AI delivery is a gate passed on assertion. Making "complete without approved evidence" visibly fail changes behavior without a policy memo.
- **Trade-off:** more friction per stage. The fix for that is decision 3, not weaker gates.

### 3. Rigor scales with risk

Changing an initiative's risk tier reshapes its plan on the spot. Low risk keeps the plan lean. High risk adds autonomy boundaries, human override controls, adversarial testing, executive risk acceptance, and board approval.

- **Why:** one-size governance either smothers low-risk work or under-protects high-risk work. Proportionality is how governance earns adoption instead of workarounds.

### 4. Readiness is explained, never just scored

Seven weighted dimensions (Business Value 15, Product 15, Technical 15, AI Evaluation 20, Risk & Governance 15, Operational 10, Adoption 10), with configurable weights. Every score shows its reasoning, its gaps, and what would raise it.

- **Why:** a number without a reason gets argued with or ignored. A number with "here's the gap and here's who closes it" gets acted on.
- **Deliberate scope:** it measures *implementation* readiness, not AI safety alone. Adoption and operations carry real weight because that's where pilots quietly die.

### 5. The AI advisor recommends, people decide

A contextual advisor analyzes, recommends, and explains for any section of a solution. It has hard limits by design: it never approves, never changes lifecycle state, and never makes legal or security determinations.

- **Runs at $0 by default** with built-in deterministic guidance, so the demo and any low-budget pilot work with no API key.
- **Live Claude when configured**, server-side only, with structured output, response validation, and automatic fallback to built-in guidance if anything fails.
- **Why:** in a governance tool, an AI that can approve its own recommendations is a liability. Keeping humans as the deciders is the feature, not a limitation.

## What I chose not to build

- **A GRC platform.** No control libraries, policy authoring, or regulatory mapping. The Navigator links to that work; it doesn't replace it.
- **Multi-tenant backend for the demo.** Data stays in each visitor's browser, so every viewer gets a private sandbox and the public demo never mixes data. Swapping in a database is a one-file change behind a storage adapter.
- **Integrations (Jira, ServiceNow, etc.).** Valuable later, but they would have tested plumbing, not the core idea. The core idea needed to be proven first.

## How I'd measure success in a real rollout

| Outcome | Metric | Why it matters |
| --- | --- | --- |
| Faster, cleaner delivery | Median days per stage; gate pass rate on first attempt | Shows the process removes friction instead of adding it |
| Fewer surprises | Rework rate after a gate; issues found in Operate that a gate should have caught | Tests whether evidence-based gates actually work |
| Proportional governance | Cycle time by risk tier | Low-risk work should move fast; if it doesn't, the tiers are wrong |
| Real adoption | Weekly active PMs; share of initiatives updated in the last 14 days | Stale data means the tool has become another spreadsheet |
| Value realized | Initiatives reaching Operate with a measured business outcome | The point of the whole exercise |

## What's next

1. **Pilot with one real portfolio** and tune stage gates and readiness weights from actual cycle-time data.
2. **Shared backend and roles** so a team works from one source of truth, with permissions by role.
3. **Integrations** that pull activity status from the tools specialists already use, so nobody double-enters work.
4. **Regulatory overlays** (for example EU AI Act risk categories) as optional config packs on top of the base lifecycle.

## How it's built

React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI, Recharts, Zustand, and the Anthropic SDK on the server. Domain logic (readiness, gates, health, next best action, plan generation) is pure and unit tested, separate from the UI. Deployed on Cloudflare Workers at [navigator.icarianforge.com](https://navigator.icarianforge.com), with automated test and build checks on every change.

---

*All people, companies, and figures in the demo are fictional (Dunder Mifflin, with The Office cast).*
