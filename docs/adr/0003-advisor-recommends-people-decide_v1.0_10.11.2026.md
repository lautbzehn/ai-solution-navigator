# 0003 · The AI advisor recommends; people decide

**Status:** Accepted · **v1.0 · 10.11.2026**

## Context
An AI advisor makes the Navigator faster to use, but an advisor that can approve work would undermine the whole point of gates. A public endpoint that calls a paid model also needs protection from abuse and runaway cost.

## Decision
- The advisor analyzes, recommends, and explains. It cannot approve, change lifecycle state, or make legal or security determinations.
- A deterministic advisor runs in the browser for free and is always available.
- The live Claude advisor is optional and guarded server side: app-only calls, a 64 KB body cap, 6 questions a minute and 20 a day per anonymous visitor, and a site-wide daily budget (default $5). Counters live in a Durable Object so limits hold across every edge location.
- Every live call logs model, tokens, cost, and latency.

## Consequences
- The demo costs nothing unless a key is configured, and never more than the daily cap.
- Any refusal or failure degrades gracefully to the built-in guidance.
