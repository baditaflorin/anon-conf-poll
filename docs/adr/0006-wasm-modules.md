# 0006 - WASM Modules

## Status

Accepted

## Context

The project needs browser cryptography, proof work, and local analytics. WASM is appropriate when mature libraries already provide it.

## Decision

Use these WASM-backed libraries:

- `@duckdb/duckdb-wasm` for local SQL and export preparation.
- `libsodium-wrappers` for hashing, random bytes, and optional symmetric encryption helpers.
- Semaphore packages for zk group membership proofs and verification.

Load expensive WASM lazily behind user actions or async app initialization. Avoid SharedArrayBuffer-only paths because GitHub Pages cannot configure COOP/COEP headers.

## Consequences

- Initial UI can load before heavy proof/analytics modules are ready.
- Browser compatibility must be tested in Playwright and documented.
- Proof generation may be slower on low-end attendee devices.

## Alternatives Considered

- Custom JS crypto: rejected.
- Server-side proof generation: rejected because identities must stay off server infrastructure.
