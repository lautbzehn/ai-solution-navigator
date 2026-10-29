# Changelog

All notable changes to the Forge AI Solution Navigator. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Evidence is approved by a second person.** Approve works only on evidence that's in review, asks who is approving (anyone on the team but the owner) and for a one-line note, and logs the approval in history. Approved items read "Approved by {name} · {date}". The store refuses every other route to Approved, including the owner approving their own work. ([ADR 0006](docs/adr/0006-evidence-approved-by-a-second-person_v1.0_10.29.2026.md))
- A Help answer, "Who approves evidence?"
- Twelve tests for the readiness credit table and the approval rules (57 in total).
- Three tests for gate decisions: opening a blocked gate logs nothing, Hold logs an attempt that didn't pass, and Go logs one that did (60 in total).
- Three tests for the short create: step 1 alone lands in Discover as a Moderate placeholder with its Discover work open, enough answers set a confirmed tier, and passing Assess confirms a placeholder (63 in total).

### Changed
- **Creating a solution takes a name, a problem, and an owner.** "Create now, fill in later" sits right on step 1. Step 2, "Anything else you already know?", is optional and collapsed: users, outcome and value, how AI helps, data, sponsor. Whatever is left blank is Discover work, and answers typed at create no longer tick off Discover activities.
- **A placeholder risk tier says so.** Without enough answers to recommend one, a new solution starts as Moderate and its header reads "Risk tier is a placeholder until Assess confirms it." Passing the Assess gate confirms it.
- **The gate review puts fixing first.** While a gate is blocked, its main button is "Resolve next blocker", which opens the first open requirement. Hold and Stop sit inside the Gate decision section as secondary choices. Once every requirement is met, the review opens with Go selected, and Go no longer needs a rationale (Hold and Stop still do).
- **One name for the gate action**: "Review gate · 3 open" while blocked and "Request decision" once it can pass, in the header, the Overview, the next-action card and the gate-open toast. "Advance to {stage}" and "Check gate" are gone.
- **Gate pass rate counts decisions, not peeks.** Opening a gate to look no longer logs a failed attempt; only a gatekeeper's Go, Hold or Stop counts. Reports, its Delivery insight and the glossary say so.
- **Readiness tells the same story as the gate.** Finished work counts when its evidence is approved: in review earns 0.7, draft 0.4, and missing evidence earns nothing on a gate-blocking activity (0.3 on any other). It used to earn 0.6 even with no evidence at all. Work still in progress keeps its small bonus when its evidence is approved early, so approving never lowers the score. The readiness tooltip and the Readiness section say so.
- The Evidence tab and the activity drawer show a status pill and buttons for the next step (Start draft, Submit for review, Back to draft, Approve) instead of a free dropdown.
- Demo data: every seeded approval names its approver, two items finished their review so the scores hold steady, and three history entries that showed people approving their own evidence now show a teammate. Saved demo data starts fresh once.
- Dan's title reads "AI strategy and operations leader" in the README and Help, matching his résumé.

### Added
- Anonymous visit counts for Dan, the same as on www.icarianforge.com: the pages you open, for how long, and links that take you out of the app. Never its buttons, and never anything you type or change. No cookies, nothing at all under Global Privacy Control, and a new Help answer, "Is my visit counted?", says so. The script is `public/insights.js`, reporting to www.icarianforge.com/api/i.

### Changed
- The welcome note greets you from Dan and keeps to two points, why he built it and what it does, with roomier spacing, a note to check back for what's new, and a shorter Dwight disclaimer.

## [1.3.0] · 2026-10-13

### Changed
- Dependencies: Vite 8.3.4 and lucide-react 1.53.
- The guided tour is split by responsibility: the script (`tourSteps.tsx`), layout math (`tourGeometry.ts`, unit-tested), static panels (`TourPanels.tsx`), and the motion and state in `OnboardingTour.tsx`.
- In the sidebar, a category's name now opens and closes its sections on its own page, just like the arrow. From anywhere else it goes to that page with its sections showing.
- However the guided tour ends (finished, skipped, or Escape), it brings you back to where the app starts: My Overview, scrolled to the top, with its sections showing in the sidebar. Skipping on the welcome screen leaves you where you are.
- The welcome note reads like Dan talking to a friend: "Hi, I'm Dan West. Thanks for stopping by.", why he built it, what it does, who decides, what it's based on, and an invitation to explore.

### Security
- Saved demo data is validated on load (collections, record ids, known stages, settings); anything malformed falls back to a fresh demo instead of crashing the app.
- The advisor refuses oversized requests from their declared length, before reading the body, and its rate-limit storage deletes earlier days' counters.
- `.dev.vars` is gitignored, and `.env.example` documents every advisor setting.
- A strict Content Security Policy: the browser runs only the app's own scripts, and nothing can load from other sites except Cloudflare Web Analytics. Also adds `Cross-Origin-Opener-Policy` and extends HSTS to subdomains.

## [1.2.0] · 2026-10-10

### Added
- **Gatekeepers.** Every gate names the roles allowed to decide it, such as the Executive Sponsor or Governance / Risk. The solution owner never decides their own gate. ([ADR 0005](docs/adr/0005-gatekeepers-go-hold-stop_v1.0_10.11.2026.md))
- **Go, Hold, and Stop decisions** at every gate, each with a required rationale and logged in Decisions. Holds keep all progress and can be resumed; stops keep the record and the reason.
- Held and stopped solutions show their state in the header, the next-action card, and lists. Stopped work leaves portfolio totals; held work leaves Needs attention.
- "Decided by" on each gate in the Framework page, a glossary tip, and Help answers.
- Five tests for the decision rules (30 in total).

## [1.1.0] · 2026-10-10

### Changed
- **Back to the eight-stage lifecycle**, Discover to Improve / Retire, now grounded in ISO/IEC 22989, the NIST AI Risk Management Framework, and Stage-Gate, with a standards note on the Framework page and in Help. ([ADR 0004](docs/adr/0004-eight-stage-lifecycle_v1.0_10.11.2026.md))
- Case study v1.4 adds "What it's built on."

### Kept from a short-lived five-stage experiment
- **Live advisor guardrails:** app-only calls, per-visitor limits, and a site-wide daily budget in a Durable Object. ([ADR 0003](docs/adr/0003-advisor-recommends-people-decide_v1.0_10.11.2026.md))

### Removed
- The five-stage lifecycle and its proof-of-concept features. Saved five-stage demo data reseeds cleanly.

## [1.0.0] · 2026-10-09

### Added
- A welcome note from Dan on each new visit, with a clear disclaimer that all demo data is fictional.
- About page, product case study, README screenshots, and CI that tests and builds every pull request.
- Security headers on every page and file.

### Changed
- Wrangler 4.149, clearing three high-severity advisories in local tooling.

## [0.9.0] · 2026-10-09

### Added
- My Overview with a personal briefing, favorites, recently viewed, and a left-to-right framework diagram.
- Typo-tolerant Help search.

## [0.8.0] · 2026-10-08

### Added
- Help center and an eight-step guided tour.
- Icarian Forge branding and color-coded functional areas.

### Changed
- A simpler workspace: sections fold with one-line summaries, and the solution page went from ten tabs to seven.

## [0.1.0] · 2026-10-07

### Added
- First proof of concept: portfolio dashboard, solution workspace, gate validation, readiness scoring, and the built-in advisor.
- Deployed to Cloudflare Workers at navigator.icarianforge.com.
