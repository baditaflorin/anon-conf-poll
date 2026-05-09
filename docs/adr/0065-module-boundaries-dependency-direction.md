# 0065 - Module Boundaries and Dependency Direction

## Status

Accepted.

## Context

The codebase already separates polls, proofs, sync, analytics, and substance inference. Phase 3 adds state and IO boundaries.

## Decision

Dependency direction is:

`App.tsx` -> feature/application helpers -> domain helpers -> shared primitives.

Feature helpers must not import React components. State/import/export helpers may import schemas and domain types, but not UI state setters.

## Consequences

New tests can exercise state and file routing without rendering the app.

## Alternatives Considered

Introducing a full application-service layer was rejected as too much ceremony for a static single-page app.
