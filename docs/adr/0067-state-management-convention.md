# 0067 - State-Management Convention

## Status

Accepted.

## Context

The app is a local-first static SPA. State is small enough for React state and IndexedDB persistence, but it needs a canonical persisted shape.

## Decision

Keep live UI state in `RoomExperience` and persist a versioned `AppStateSnapshot` through IndexedDB. Persist only local browser/session material:

- manifest
- active invite
- organizer invite codes
- drafts
- selected options
- activity log
- saved timestamp

CRDT vote/question data remains in Yjs and exported results; it is not treated as durable local state.

## Consequences

Reload restores setup work without creating a hidden server-side source of truth.

## Alternatives Considered

Adding Redux/Zustand was rejected because the state graph is still small and local.
