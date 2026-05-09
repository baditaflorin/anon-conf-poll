# 0064 - DRY Consolidation Map

## Status

Accepted.

## Context

The audit found duplicated object-URL download code, direct clipboard writes, and ad hoc export serialization inside `App.tsx`.

## Decision

Create a small application boundary:

- `features/io/downloads.ts` owns browser download and clipboard helpers
- `features/state/appState.ts` owns state export/import schemas
- `features/state/appState.test.ts` verifies round-trip behavior

Keep rendering in `App.tsx`, but stop building external artifacts directly in render handlers.

## Consequences

The largest component remains large but loses external serialization and browser API duplication.

## Alternatives Considered

A full component refactor was rejected for Phase 3 because it would be larger than the completeness gaps it fixes.
