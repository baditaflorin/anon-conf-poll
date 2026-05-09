# 0060 - Completeness Audit Findings and Phase 3 Success Metrics

## Status

Accepted.

## Context

Phase 2 made the inference engine useful on real rosters, poll drafts, invite strings, and damaged room links. The Phase 3 audit found that a stranger still hits end-to-end usability walls around file input, state round-trip, clipboard exports, reset, and documentation drift.

## Decision

Phase 3 will treat input/output completeness as the product bar:

- paste, file picker, drag/drop, clipboard, deep link, autosave, and state import are the supported input paths
- results JSON, vote CSV, copy-to-clipboard, room URL, invite roster, state file, and print report are the supported output paths
- image/OCR, folder import, embed code, and runtime API output are out of scope
- controls with no complete handler are removed or finished

Success metrics are the counts in `docs/phase3/findings.md`.

## Consequences

The work stays in Mode A and does not change the cryptographic engine. It adds a small application-state boundary and more UI wiring.

## Alternatives Considered

Shipping Phase 2 as-is was rejected because upload/import/export gaps block real users even when inference is smart.
