# Phase 2 Substance Plan

## Ranking Principle

Items are ranked by impact on the 10 real-data audit inputs, not by implementation novelty. The first wave closes failures that block organizers from using their own attendee lists, poll drafts, copied invite codes, and broken room links.

## Picklist

| Rank | Catalog item                            | Why it matters for real inputs                                            | Evidence fixture(s)    |
| ---- | --------------------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| 1    | 6. Auto-detect structure                | Roster and poll input should produce a useful first guess.                | 4, 5, 6, 7             |
| 2    | 8. Useful first guess on first input    | Users should correct previews, not configure from zero.                   | 4, 5, 6                |
| 3    | 33. Validate at boundaries              | Broken hashes and malformed manifests must not crash bootstrap.           | 8, 9                   |
| 4    | 32. Errors are actionable               | Invite/room failures need what/why/now-what.                              | 2, 3, 8, 9             |
| 5    | 9. Format normalization by default      | BOM, CRLF, NBSP, smart quotes, wrapped tokens should normalize.           | 2, 4, 7                |
| 6    | 15. Domain conventions baked in         | CSV delimiter sniffing, header detection, eligibility filtering.          | 4, 5, 7                |
| 7    | 7. Auto-classify fields                 | Name/email/status/ticket columns need inferred roles.                     | 4, 5                   |
| 8    | 12. Domain-aware validation             | Duplicates, cancelled registrants, missing emails need warnings.          | 4, 5                   |
| 9    | 16. Confidence scores                   | Every inference needs high/medium/low confidence in UI/export.            | 4, 5, 6, 7             |
| 10   | 18. Surface anomalies                   | Duplicates, excluded rows, malformed rows, empty poll options.            | 4, 5, 7                |
| 11   | 17. Suggest fixes                       | Tell users whether to skip, dedupe, or review suspicious rows.            | 4, 5, 8                |
| 12   | 13. Recognize common shapes             | Eventbrite roster, Zoom roster, poll prose, poll CSV.                     | 4, 5, 6, 7             |
| 13   | 14. Domain-aware export                 | Export must carry provenance, schema, confidence, source summary.         | 10                     |
| 14   | 38. Output provenance                   | Make exports reproducible and supportable.                                | 10                     |
| 15   | 35. Deterministic outputs               | Same roster/poll input must produce byte-identical normalized output.     | all inference fixtures |
| 16   | 22. Stable IDs everywhere               | Inferred poll/option IDs must survive re-import/rename.                   | 6, 7                   |
| 17   | 24. Enumerate every reachable state     | Broken links, empty previews, busy, cancelled, errors become intentional. | 8, 9                   |
| 18   | 25. No stuck states                     | Every error needs a path to retry, reset, or create a new room.           | 8, 9                   |
| 19   | 27. Concurrency safety                  | Double-clicking inference/vote/export must not corrupt state.             | 10                     |
| 20   | 1. Fuzz parser                          | Real fixtures plus synthetic broken cases should never crash parsers.     | all                    |
| 21   | 2. Encoding variants                    | Normalize BOM, CRLF/LF, NBSP, smart quotes, Unicode text.                 | 4, 7                   |
| 22   | 4. Partial inputs                       | Truncated links/files degrade meaningfully.                               | 8                      |
| 23   | 5. Adversarial input                    | Broken CSV quotes, formula-like cells, invalid JSON do not get trusted.   | 7, 9                   |
| 24   | 28. Profile real-data inputs            | Measure median/p95/worst parser time.                                     | all                    |
| 25   | 31. Cache expensive things              | Avoid re-parsing unchanged roster/poll drafts.                            | 4, 5, 6, 7             |
| 26   | 36. Inspectable history                 | Record import/apply/export/vote outcomes for support.                     | all                    |
| 27   | 37. Debug overlay                       | `?debug=1` exposes inferred state and fixture diagnostics.                | all                    |
| 28   | 39. Remember corrections within session | If a user chooses a delimiter/status policy once, reuse it.               | 4, 5                   |

## Implementation Waves

1. **Boundary safety**: safe room decoding, invite normalization, actionable errors.
2. **Inference core**: roster and poll parsers, confidence, anomalies, deterministic IDs.
3. **UI wiring**: useful first guesses inside existing room control surface.
4. **Exports/history/debug**: provenance, activity log, `?debug=1`.
5. **Fixture gates**: real-data fixtures, fuzz cases, determinism, performance budgets.

## Non-Goals Reaffirmed

No backend, no auth, no new voting feature types, no visual polish pass, no analytics tracking, no owned signaling/TURN topology, and no protocol replacement.
