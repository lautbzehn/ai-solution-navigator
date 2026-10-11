# 0004 · An eight-stage lifecycle grounded in recognized standards

**Status:** Accepted · **v1.0 · 10.11.2026**

## Context
The lifecycle is the product's spine, so it must be logical to practitioners and credible to reviewers. A short-lived five-stage variant (Frame, Prove, Build, Launch, Run) was tried and judged harder to map to how enterprises and standards describe AI delivery.

## Decision
Use eight stages in three phases, each ending in a gate:

| Phase | Stages | ISO/IEC 22989 life cycle |
|---|---|---|
| Plan | Discover, Assess | Inception |
| Plan | Design | Design and development |
| Deliver | Build | Design and development |
| Deliver | Validate | Verification and validation |
| Deliver | Deploy | Deployment |
| Run | Operate | Operation and monitoring |
| Run | Improve / Retire | Re-evaluation and retirement |

Risk work follows the NIST AI Risk Management Framework, starting in planning and running the whole way. Gates follow Stage-Gate: each stage ends in a decision a named person makes.

## Consequences
- Reviewers can map every stage to a standard they already know.
- The advisor guardrails built during the five-stage experiment were kept.
- Saved five-stage demo data reseeds cleanly (see ADR 0002).
