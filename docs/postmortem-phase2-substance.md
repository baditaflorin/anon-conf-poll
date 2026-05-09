# Phase 2 Substance Postmortem

## Real-Data Pass Rate

| Fixture                 | Before  | After   | Evidence                                                                                   |
| ----------------------- | ------- | ------- | ------------------------------------------------------------------------------------------ |
| 01 clean invite         | Pass    | Pass    | Existing happy path remains covered by smoke tests.                                        |
| 02 wrapped invite       | Fail    | Pass    | `parseInviteInput` normalizes internal whitespace and wrappers.                            |
| 03 JSON invite wrapper  | Fail    | Pass    | JSON arrays, quoted strings, and `invite=` prefixes are accepted.                          |
| 04 Eventbrite roster    | Fail    | Pass    | Roster inference detects eligible, duplicate, and excluded rows.                           |
| 05 Zoom roster          | Fail    | Pass    | Status columns filter pending/cancelled registrants.                                       |
| 06 agenda poll text     | Fail    | Pass    | Poll prose and bullet lists infer title/options with stable IDs.                           |
| 07 poll spreadsheet CSV | Fail    | Pass    | Quoted commas and Unicode labels survive CSV grouping.                                     |
| 08 corrupt room hash    | Fail    | Pass    | Damaged links render a recoverable room-link screen.                                       |
| 09 legacy manifest      | Fail    | Pass    | Schema errors become field-level recovery messages.                                        |
| 10 duplicate nullifier  | Partial | Partial | Duplicate wording/export is honest; cross-device timing still depends on mesh propagation. |

Baseline: 2/10. After Phase 2: 9/10 fully pass, 1/10 partial.

## Logic Gaps Closed

1. No real roster ingestion: closed with deterministic CSV inference for Eventbrite, Zoom, and generic rosters.
2. No poll draft ingestion: closed with poll text and poll CSV inference.
3. Brittle invite parsing: closed with wrapper, whitespace, URL, JSON, and prefix normalization.
4. Broken room links were not recoverable enough: closed with safe decode and damaged-link recovery UI.
5. Duplicate cross-device votes were misleading: improved with nullifier-aware wording and export metadata, but full prevention still depends on mesh sync timing.

## Smart Behaviors

- Roster paste immediately previews eligible, duplicate, excluded, source shape, confidence, and issues.
- Poll draft paste immediately previews inferred poll count, option counts, confidence, and issues.
- Invite paste accepts common real copy shapes without manual token surgery.
- Broken room links fail in organizer language and keep the user inside a recoverable state.
- Exports carry provenance: app version, source commit, schema version, counts, and inference summaries.

## Determinism

All 10 Phase 2 fixture assertions pass. Re-running roster and poll inference on identical input returns identical output. Export payloads intentionally include a generation timestamp, so deterministic tests cover normalized inference state rather than timestamped artifact bytes.

## Performance

Measured with `npm run perf:phase2` on 2026-05-09:

| Task                 | Median    | p95       | Worst     |
| -------------------- | --------- | --------- | --------- |
| Clean invite parse   | 0.096 ms  | 2.138 ms  | 2.138 ms  |
| Wrapped invite parse | 0.090 ms  | 0.496 ms  | 0.496 ms  |
| Eventbrite roster    | 0.130 ms  | 5.216 ms  | 5.216 ms  |
| Zoom roster          | 0.120 ms  | 0.718 ms  | 0.718 ms  |
| Poll text            | 0.099 ms  | 1.245 ms  | 1.245 ms  |
| Poll CSV             | 0.122 ms  | 1.431 ms  | 1.431 ms  |
| Corrupt room hash    | 0.043 ms  | 1.005 ms  | 1.005 ms  |
| Legacy manifest      | 0.064 ms  | 1.531 ms  | 1.531 ms  |
| 5,000-row roster     | 10.005 ms | 26.497 ms | 26.497 ms |

## Surprises

- The most damaging failures were not cryptographic; they were mundane copy/paste and CSV boundary problems.
- Vite masked a `lz-string` ESM interop issue that the Node perf runner caught.
- Duplicate-vote correctness was already mostly in the tally layer, but the user-facing language made it feel wrong.

## Still Open

1. Import/export full app state, not only results.
2. File upload and drag/drop for rosters, poll drafts, and saved state.
3. Copy-to-clipboard for exports, not just room/invite links.
4. A clear reset/start-fresh control.
5. More explicit recovery for WebRTC mesh limitations at conference scale.

## Honest Take

The app no longer feels like a toy when an organizer brings attendee CSVs, poll drafts, or messy invite text. It still has toy-shaped usability gaps around end-to-end import/export state, file handling, and first-time workflow clarity. Those are Phase 3 completeness problems, not Phase 2 inference problems.
