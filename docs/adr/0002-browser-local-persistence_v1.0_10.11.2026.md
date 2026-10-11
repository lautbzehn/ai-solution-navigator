# 0002 · Each visitor's data stays in their own browser

**Status:** Accepted · **v1.0 · 10.11.2026**

## Context
The Navigator is a public demo. Visitors should be free to click, approve, and break things without signing up or seeing each other's changes, and it should cost nothing to run.

## Decision
The store persists to `localStorage` through a `StateStorage` adapter (`src/data/storage.ts`). The persisted state is versioned; any version mismatch reseeds the demo instead of loading an incompatible shape. Settings → Reset demo data restores the starting portfolio.

## Consequences
- No accounts, no shared database, no personal data held by the app.
- Teams can't collaborate in the demo. Moving to a shared workspace means swapping the storage adapter for a server API, a contained change.
