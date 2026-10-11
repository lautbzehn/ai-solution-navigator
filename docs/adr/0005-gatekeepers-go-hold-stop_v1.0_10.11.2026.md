# 0005 · Gatekeepers decide each gate: Go, Hold, or Stop

**Status:** Accepted · **v1.0 · 10.11.2026**

## Context
A gate that anyone can approve, including the person running the project, is a checkbox, not a control. Real Stage-Gate practice also lets gatekeepers pause or stop work, not only advance it.

## Decision
- Each gate lists its **gatekeeper roles** in `lifecycle.json`, for example Validation: Executive Sponsor or Governance / Risk.
- Only a team member holding one of those roles may decide, and **never the solution owner** (separation of duties). If no one qualifies, the gate says which role to add.
- The gatekeeper chooses **Go** (only when every requirement is met), **Hold** (pause with all progress kept; Resume later), or **Stop** (end the project; the record and reason stay). A rationale is required, and every decision is logged.
- Lifecycle state (`active`, `on_hold`, `stopped`) is kept separate from health. Stopped work leaves portfolio totals; held work leaves Needs attention.
- The store re-checks every rule on submit.

## Consequences
- Decisions are attributable and auditable, matching how governance boards work.
- Stopping early reads as a valid outcome, not a failure.
- The demo has no logins, so the gatekeeper is chosen from the team list. Real accounts would bind this to the signed-in user's role.
