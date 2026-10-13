# Changelog

All notable changes to the Forge AI Solution Navigator. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
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
