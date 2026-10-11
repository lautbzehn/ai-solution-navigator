# Forge AI Solution Navigator

[![CI](https://github.com/lautbzehn/ai-solution-navigator/actions/workflows/ci.yml/badge.svg)](https://github.com/lautbzehn/ai-solution-navigator/actions/workflows/ci.yml)

**Live demo: [navigator.icarianforge.com](https://navigator.icarianforge.com)** · **[The story behind it](docs/case-study_v1.4_10.11.2026.md)**: why I built it and the choices I made along the way

**A Product Manager's workspace for taking AI solutions from opportunity to production.**

![The portfolio overview: every AI project at a glance, with the two that need help up front](docs/screenshots/dashboard.png)

**Hi, I'm Dan West, and this is my portfolio project.** I'm an AI strategy and adoption leader with nearly 20 years in IT, and I built the Navigator from zero to show how I think about AI products, from the first idea to running in production.

<p>
  <img src="docs/screenshots/workspace.png" width="49%" alt="One project's workspace: where it is, how ready it is, and what to do next">
  <img src="docs/screenshots/gate-blocked.png" width="49%" alt="A blocked stage gate: exactly what's missing, who owns it, and a link to fix it">
</p>

*Left: one project's workspace, with where it is and what to do next. Right: when a project can't move forward yet, it shows exactly what's missing and who can help.*

If you've ever watched an AI pilot stall somewhere between "this works" and "this is live," this is for you. The Navigator shows, for every AI project at once, *where it is, what's next, who owns it, what proof is still missing, and whether it's really ready to move forward.*

It follows 8 stages (Discover → Assess → Design → Build → Validate → Deploy → Operate → Improve/Retire), with checks that get stricter as the risk goes up. It's meant to sit alongside your compliance tools, not replace them. Inside the app, **About this project** tells the story and how to reach me.

> All people, companies, solutions, and figures are fictional demo data (Dunder Mifflin, with The Office cast).

## What it does

- **Portfolio dashboard:** KPIs, lifecycle distribution, readiness trend, risk and value, and the solutions that need attention. Every chart drills down.
- **Solution workspace:** a lifecycle rail, a **Next Best Action** with owner and impact, and seven tabs: Overview, Lifecycle, Work, Evidence, Risks & decisions, Metrics, and Team & history. Busy views fold into collapsible sections whose headers carry a one-line headline.
- **Real gate validation:** each stage's exit gate combines blocking activities (which ones block depends on the risk tier) with explicit criteria (fields, roles, metrics, risk rules). A completed activity *without approved evidence* does not pass. Blocked advancement always explains why, with owners and links to resolve.
- **Gatekeepers and real decisions:** each gate names who may decide it (for example the Executive Sponsor or Governance / Risk), never the solution's own owner. The gatekeeper chooses **Go** (advance), **Hold** (pause with progress kept, resume anytime) or **Stop** (end it, with the reason kept), and every decision lands in the log. Stopped work leaves the portfolio totals but stays on record.
- **Implementation readiness:** seven weighted dimensions (configurable). Every score shows its why, its gaps, and what would raise it. It measures implementation readiness, not AI safety alone.
- **Risk-based rigor:** changing a solution's risk tier reshapes its plan. High risk adds autonomy boundaries, override controls, adversarial testing, executive risk acceptance, and board approval.
- **Portfolio Intelligence:** health, delivery performance (time per stage, gate pass rate, rework), lifecycle bottlenecks, risk heat map, business outcomes, adoption, and AI performance, with deterministic key insights.
- **AI advisor:** a contextual advisor that analyzes → recommends → explains. A star icon on each section asks it for an analysis of just that area. It runs as live Claude when a server key is configured, behind per-visitor rate limits and a daily spend cap, and falls back to built-in deterministic guidance ($0) whenever Claude isn't available. It never approves, changes lifecycle state, or makes legal or security determinations.
- **Audit and change log:** every change is recorded with who, what, from, and to.

## Demo script (5 minutes)

1. **Dashboard**: 8 solutions, 2 need attention. Click **Validate** in Lifecycle distribution.
2. Open **AI Customer Support Resolution Assistant** (Validate, Moderate risk, **76% ready**).
3. Next Best Action: *Validate human oversight in practice*, owner Dwight Schrute. Click the star icon next to it to ask the AI advisor.
4. Click **Advance to Deploy**: blocked, with 3 requirements (oversight validation, UAT, monitoring plan).
5. Open the oversight activity, mark it **Complete**: the gate still flags the draft evidence. Approve it and readiness rises.
6. Resolve UAT and the monitoring plan the same way. The gate opens.
7. **Advance to Deploy**: record the decision (the rationale is required). It lands in the Decisions log.
8. Check the **Dashboard** and **Reports**: the portfolio has updated. Reset from **Settings** when you're done.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain and server tests
npm run build      # type-check and production build
```

Data persists in your browser (localStorage), so every viewer gets a private sandbox. **Settings → Reset demo data** restores the starting portfolio.

### Live AI advisor (optional)

The advisor works out of the box in built-in mode. To use Claude:

```bash
cp .env.example .env
# set ANTHROPIC_API_KEY=... (server-side only; never sent to the browser)
# optional: ADVISOR_MODEL (defaults to claude-opus-5-5)
npm run dev
```

The browser sends a compact JSON snapshot of the current solution to `/api/advisor`; the server calls the Messages API with structured JSON output and server-side refusal fallback, then validates the response. Any failure falls back to built-in guidance with a clear notice.

**Guardrails** (`server/guard.ts`), checked before any money is spent:

- Only the app itself may call it (origin and client header checks), and requests over 64 KB are refused.
- Each visitor (an anonymous hash, never a raw IP) gets 6 questions a minute and 20 a day.
- The whole site has a daily budget, `ADVISOR_DAILY_BUDGET_USD` (default $5). Past it, everyone gets built-in guidance until midnight UTC.
- Every call logs model, tokens, cost, and latency (`advisor_call`), and an `advisor_budget_alert` line once spend passes 80% of the budget.

On Cloudflare the counters live in one Durable Object (`AdvisorGuardObject`), so limits hold across every edge location. Locally they live in memory.

## Deploy (Cloudflare Workers)

The app runs as a Cloudflare Worker at `navigator.icarianforge.com`. Static files come from `./dist`; only `/api/*` reaches the Worker (`worker/index.ts`).

```bash
npm run deploy                                  # build + wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY       # optional: enable the live advisor
```

## Architecture

```
src/config/lifecycle.json   The methodology: stages, activities, evidence, gates, risk tiers, roles, readiness weights
src/domain/                 Pure logic: readiness, gates, health, next best action, plan instantiation, reports, validation
src/data/                   Zustand store (actions + audit trail), persistence adapter, seed data, derived hooks
src/ai/                     Advisor contract, context builder, deterministic advisor, client
server/advisor.ts           Server-side Claude integration (shared by the Vite dev middleware and the Worker)
server/guard.ts             Advisor guardrails: app-only calls, per-visitor limits, a site-wide daily budget
worker/index.ts             Cloudflare Worker: serves the app and /api/advisor
src/components/             Design system: UI primitives, charts, lifecycle rail, readiness gauge
src/features/               Screens: dashboard, solutions, workspace, reports, framework, settings, advisor, create flow
```

UI → application logic (domain) → data layer → AI integration. The lifecycle is never hard-coded into components; edit `lifecycle.json` and the plan, gates, readiness, Framework page, and reports all follow.

**Persistence:** the store talks to a `StateStorage` adapter (`src/data/storage.ts`). It's browser-local so the public demo never mixes visitors' data; swapping in SQLite or a REST API is a one-file change.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Radix UI primitives · Recharts · Zustand · Anthropic TypeScript SDK (server only).

Design direction drew on two 21st.dev references, adapted to the app's own tokens: the **Charcoal Ink dashboard sidebar** (arunjdass) for the shell, and the **Layro Charts & KPI Cards** kit (uvain) for chart and KPI conventions (thin marks, direction-aware KPIs, hidden data tables for screen readers).
