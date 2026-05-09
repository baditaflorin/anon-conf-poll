# Phase 2 State Taxonomy

## Global

- `booting`: app shell is preparing a room or validating a link.
- `loaded-room`: a valid room manifest is active.
- `damaged-room-link`: the URL hash looked like a room but could not be decoded or validated.
- `recoverable-error`: user work is intact and a retry/reset path exists.
- `fatal-error`: unrecoverable browser/runtime failure; export/reload guidance must be shown.

## Room Setup

- `roster-empty`: no roster input.
- `roster-preview-some`: rows were inferred and can be applied.
- `roster-preview-error`: roster input could not be parsed; user can edit/retry.
- `poll-preview-empty`: no poll draft input.
- `poll-preview-some`: polls/options were inferred and can be applied.
- `poll-preview-error`: poll input could not be parsed; user can edit/retry.

## Operations

- `idle`: no operation running.
- `generating-commitments`: invite commitments are being created.
- `proof-running`: zk proof is being generated.
- `analytics-running`: DuckDB-WASM is initializing/querying.
- `export-ready`: export payload has been generated.
- `cancelled`: operation was aborted and previous state remains intact.

## Exits

Every recoverable state exposes at least one of:

- retry with edited input
- clear input
- create new room
- copy diagnostic summary
- continue with current room
