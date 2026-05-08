# 0002 - Architecture Overview And Module Boundaries

## Status

Accepted

## Context

The app has protocol-sensitive logic and an interactive UI. Boundaries must make proof verification, CRDT sync, storage, and analytics independently testable.

## Decision

Use feature modules under `src/features/` and shared utilities under `src/shared/`.

- `features/polls`: room model, poll creation, voting, and Q&A operations.
- `features/proofs`: anonymous credential, group, proof, and nullifier handling.
- `features/sync`: Yjs document/provider setup and awareness state.
- `features/analytics`: DuckDB-WASM result loading and exports.
- `features/storage`: IndexedDB/local persistence.
- `shared`: UI primitives, configuration, errors, and build metadata.

## Consequences

- Protocol code can be unit-tested without rendering React.
- UI components stay thin and domain-oriented.
- Future Mode C work can replace sync or storage adapters without rewriting the UI.

## Alternatives Considered

- One large React state module: simpler initially but too risky for crypto and sync logic.
- Backend-first domain layout: rejected because this is a static browser app.
