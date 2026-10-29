# 0006 · Evidence is approved by a second person

**Status:** Accepted · **v1.0 · 10.29.2026**

## Context
Gates already had gatekeepers and no self-approval (ADR 0005), but a gate requirement counted as met the moment its evidence read Approved, and Approved was a dropdown anyone could pick, the evidence owner included. Readiness also gave 60% credit to finished work whose evidence was missing, while the gate gave it nothing. The two numbers told different stories about the same work.

## Decision
- Evidence records **who approved it and when** (`approvedById`, `approvedAt`), plus the approver's one-line note.
- Anyone on the team can move evidence **Missing to Draft**, **Draft to In Review**, and **In Review back to Draft**. Approved is reached one way only: **Approve, from In Review, by a team member who isn't the evidence owner**, with a note.
- The store re-checks every rule and refuses anything else with a plain reason, so no screen, form or saved patch can reach Approved another way. New evidence always starts unapproved.
- Each approval is logged in the history feed with the approver as the actor, whose evidence it was, and the activity it backs.
- Readiness credit for finished work follows its evidence: approved or not required **1.0**, in review **0.7**, draft **0.4**, missing **0** when the activity blocks the gate for the solution's risk tier and **0.3** when it doesn't. In-progress credit is unchanged.
- The demo data names an approver for every seeded approval, using the stage gate's specialist gatekeeper, then the sponsor, and never the owner.

## Consequences
- "Approved" now means a second person looked at it, which is what a gate decision relies on.
- Readiness and the gate agree: finished work that isn't proven counts for less, and a gate-blocking item with no evidence counts for nothing. Seeded scores moved by two points at most.
- The demo has no logins, so the approver is chosen from the team list, the same way gatekeepers are. Real accounts would bind this to the signed-in user.
- Approved is final in this version. Reopening evidence after approval is a later decision.
- The saved-data version went up, so each browser's demo starts fresh once (ADR 0002).
