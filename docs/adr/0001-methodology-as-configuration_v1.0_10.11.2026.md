# 0001 · The methodology is configuration, not code

**Status:** Accepted · **v1.0 · 10.11.2026**

## Context
Every company runs AI delivery a little differently: different stages, review boards, evidence, and roles. A tool that hard-codes one company's process gets worked around instead of used.

## Decision
The whole methodology lives in `src/config/lifecycle.json`: stages and phases, gates with their criteria and gatekeepers, activity and evidence templates tagged by risk tier, roles, and readiness weights. Components and domain logic read it; none of them name a specific stage's rules.

## Consequences
- Changing the file changes the plan, gates, readiness, Framework page, and reports together.
- The domain stays generic and testable.
- The file is large to edit by hand. A methodology editor is the natural next step if non-technical teams need to change it.
