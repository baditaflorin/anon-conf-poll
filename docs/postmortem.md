# Postmortem

## What Was Built

`anon-conf-poll` v0.1.0 is a GitHub Pages static app for anonymous live polling and Q&A. It includes:

- room manifests encoded into shareable URLs
- attendee invite generation and import
- Yjs CRDT state over a configurable WebRTC signaling endpoint
- Semaphore zk membership proofs and nullifiers for one-vote-per-poll enforcement
- libsodium hashing helpers for proof signals
- DuckDB-WASM local result summaries
- JSON/CSV exports
- version and source commit displayed in the UI
- repository and PayPal links in the published page

## Was Mode A Correct?

Yes for v1. The core workflow can run from a static URL without a runtime application server. The main caveat remains conference-scale WebRTC behavior: a pure mesh is appropriate for small and medium rooms, but very large events will probably need a later relay/signaling topology decision.

## What Worked

- GitHub Pages from `main /docs` gave a working public surface immediately.
- Semaphore matched the anonymous group membership and nullifier requirement cleanly.
- DuckDB-WASM initialized from the static build and passed Playwright smoke.
- Build metadata is stable because the UI reports the latest non-`docs/` source commit.

## What Did Not Work

- Vite initially wiped handwritten ADRs because `docs/` was both the Pages output and documentation folder. The build now cleans only generated artifacts.
- `libsodium-wrappers` needed an explicit Vite alias to use its CommonJS bundle because the package ESM wrapper imports a sibling file that is not published in the wrapper package.
- `http-server` did not model the GitHub Pages base path correctly; smoke now uses `vite preview`.

## Surprises

- Semaphore proof artifacts and libsodium are large enough that strict lazy loading matters.
- The latest Semaphore package introduced audit warnings through transitive proof tooling, so v0.1.0 pins Semaphore packages to `4.12.1` with npm overrides for patched transitive dependencies.

## Accepted Tech Debt

- WebRTC signaling uses the public default endpoint unless configured otherwise.
- The roster/import UX is intentionally simple JSON invite codes.
- Full proof generation is not exercised in Playwright because it downloads large proving artifacts; unit and smoke tests cover the room contract, duplicate-nullifier tallying, static load, and DuckDB-WASM initialization.
- The app does not yet include a service worker despite being static-friendly.

## Next Improvements

1. Add an importable roster file flow for large attendee lists so room URLs stay small.
2. Add an optional self-hosted y-webrtc signaling recipe and load testing notes for larger conferences.
3. Add a proof-artifact warmup/download progress UI before the first vote.

## Time Spent Vs Estimate

Estimated: 4-6 hours for a usable static v1 scaffold.

Actual: about 3 hours in this implementation pass, with extra time spent on Pages build stability and browser packaging details.
