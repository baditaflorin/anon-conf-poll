# 0001 - Deployment Mode

## Status

Accepted

## Context

The project must default to GitHub Pages and only add a runtime backend if browser or build-time execution is genuinely insufficient. The requested product needs live polling, anonymous one-vote enforcement, encrypted local handling, and local analytics.

## Decision

Use Mode A: Pure GitHub Pages. The application is a static Vite build served from `main /docs`.

Runtime behavior happens in the browser:

- Yjs and `y-webrtc` synchronize poll state between attendees.
- Semaphore generates and verifies anonymous membership proofs with nullifiers for one-vote-per-poll.
- `libsodium-wrappers-sumo` provides browser cryptographic primitives.
- DuckDB-WASM powers local result tables, CSV/JSON export preparation, and ad hoc queries.
- IndexedDB and local storage persist device-local rooms and credentials.

WebRTC signaling is configurable and treated as transport infrastructure. It does not store attendee identities or authoritative poll results.

## Consequences

- The public surface is a free static URL.
- There is no runtime app server, no runtime database, and no backend secret.
- Conference-scale reliability depends on browser and WebRTC mesh constraints; large events may need a later signaling or relay ADR.
- Pages cannot set COOP/COEP headers, so WASM choices must work without SharedArrayBuffer-only deployment assumptions.

## Alternatives Considered

- Mode B with pre-built data: unnecessary because v1 does not need public static datasets.
- Mode C with Docker backend: rejected for v1 because votes can be peer-synced and verified locally without a server-side identity database.
