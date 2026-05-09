# 0061 - Input Pathway Coverage Policy

## Status

Accepted.

## Context

Users bring CSV, text, JSON, room URLs, and copied invite text. The app cannot rely on textareas alone.

## Decision

Support these input paths in v0.3.0:

- paste into existing text fields
- explicit clipboard read into the invite field
- file picker for `.csv`, `.txt`, and `.json`
- drag/drop for the same formats
- multi-file routing with one activity record per file
- state-file import through the same file and drop path
- direct room/invite URL import field

Unsupported paths are image/OCR, folder import, and private CORS URL fetching. URL fetching would require a backend or a brittle public proxy; users should paste rendered content or upload the saved file.

## Consequences

All external input is routed through a small file/import boundary before touching room state.

## Alternatives Considered

Adding a server-side fetch proxy was rejected because Phase 3 must remain Mode A.
