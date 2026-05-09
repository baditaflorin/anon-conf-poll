# 0045 - State Taxonomy And State Machine

## Status

Accepted

## Context

V1 has implicit states: booting, loaded, busy, broken hash, no invite, duplicate, exported. Phase 2 needs explicit handling.

## Decision

Document reachable states in `docs/phase2-substance/states.md` and model long-running UI operations as named tasks with idle, running, success, recoverable error, and cancelled outcomes.

Key states:

- booting
- loaded-empty
- loaded-room
- damaged-room-link
- roster-preview-empty/some/error
- poll-preview-empty/some/error
- proof-running
- analytics-running
- export-ready

## Consequences

No state should strand the user without retry/reset/create-new-room actions.

## Alternatives Considered

Implicit boolean flags were rejected for new inference paths.
