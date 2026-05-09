# Phase 3 Findings

## Top 5 Usability Gaps

1. Users can paste real rosters and polls, but they cannot upload or drag/drop the files they actually have.
2. Results can leave the app, but a full room/session state cannot round-trip back in.
3. Autosave restores only part of the work; drafts, previews, selections, and activity are lost.
4. Export actions download files but do not support clipboard workflows.
5. There is no obvious start-fresh/reset control, so recovering from a wrong room depends on browser state knowledge.

## Top 5 Half-Baked Features

1. Results CSV: finish as honest vote CSV plus copy support.
2. Results JSON: finish as copyable provenance export and keep as result export.
3. Autosave: finish with versioned schema and migration.
4. PWA/offline claim: keep manifest, but document no service-worker guarantee.
5. Conference-scale WebRTC claim: keep as an experimental static mesh and document limitations.

## Top 5 Codebase Pain Points

1. `src/App.tsx` is a 923-line workflow and rendering module.
2. Download/export code is duplicated and not testable at the boundary.
3. Clipboard writes have no shared failure handling.
4. Persistence is unversioned.
5. E2E tests do not cover real-user file/state/copy paths yet.

## Top 5 Documentation/Reality Mismatches

1. README says "imports attendee commitments"; the app imports rosters and generates commitments.
2. README implies conference-scale WebRTC, but actual mesh reliability is browser/network dependent.
3. PWA/offline language in ADRs is stronger than shipped service-worker behavior.
4. CSV export is not a complete results artifact; it is vote rows.
5. State round-trip is not yet documented because it does not exist.

## Fully Usable Means

1. A stranger can load roster/poll/invite/state data by paste, file picker, or drag/drop.
2. A stranger can export results and full state, then import the state in a new browser and continue.
3. Every visible control either completes an end-to-end workflow or is absent.
4. Reloading the page keeps the latest room setup and explains what was restored.
5. README claims match tested behavior and call out static WebRTC limits honestly.

## Phase 3 Success Metrics

- Input audit: at least 10 green rows, and all red rows either implemented or explicitly out of scope.
- Output audit: at least 8 green rows, and all red rows either implemented or explicitly out of scope.
- Controls audit: 0 red production controls.
- State round-trip: exported state imports with identical room id, polls, active invite, drafts, and activity.
- Tests: unit, e2e smoke, lint, typecheck, build, and smoke pass before push.

## Out Of Scope

- No runtime backend or deployment mode change.
- No new voting feature types.
- No visual polish pass.
- No OCR/image input.
- No folder import.
- No owned TURN/signaling relay.
