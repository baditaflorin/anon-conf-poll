# 0017 - Dependency Policy

## Status

Accepted

## Context

The project touches cryptography and browser networking. Custom implementations are risky.

## Decision

Prefer production-ready libraries:

- Semaphore for anonymous membership proofs.
- Yjs and `y-webrtc` for CRDT sync.
- DuckDB-WASM for local SQL.
- libsodium for cryptographic primitives.
- Zod for validation.

Dependencies must be pinned through `package-lock.json`, reviewed with `npm audit`, and justified in ADRs for major additions.

## Consequences

- The app inherits tested protocol implementations.
- Bundle size must be monitored as WASM libraries are added.
- Major upgrades require testing proof, sync, and export flows.

## Alternatives Considered

- Custom cryptography or CRDT code: rejected.
