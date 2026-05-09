# Phase 3 Completeness Plan

## Ranking Principle

Items are ranked by how quickly they unblock a stranger trying to use their own data end-to-end.

## Picklist

| Rank | Catalog item                   | Implementation scope                                                        | User impact                                    |
| ---- | ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | 1. Claimed input pathways work | Add text/CSV/JSON file picker for rosters, poll drafts, invites, and state. | Users can load files they already have.        |
| 2    | 2. Format detection            | Route files by extension, JSON schema, and text shape.                      | Users do not choose parser details.            |
| 3    | 4. Multi-file input            | Process multiple files with per-file activity/errors.                       | Batch roster+poll+invite/state workflows work. |
| 4    | 6. Clipboard read              | Add explicit paste-from-clipboard action with permission fallback.          | Copying from email/docs becomes one click.     |
| 5    | 7. Sample/demo parity          | Add sample data loader for roster and poll inputs.                          | Demo no longer hides real input paths.         |
| 6    | 8. Resume from last session    | Persist drafts, previews, selections, activity, and invite with migration.  | Reloads stop losing setup work.                |
| 7    | 9. Export formats work         | Keep results JSON/CSV honest and test output generation.                    | Users can take data out.                       |
| 8    | 10. Copy outputs               | Copy JSON/CSV/state to clipboard with confirmation.                         | Users can paste into docs/spreadsheets.        |
| 9    | 11. Downloadable state         | Add versioned app-state export.                                             | Users can archive and resume a room.           |
| 10   | 12. Shareable URL limits       | Keep room URL copy and document/hash-size limits.                           | Large state has an honest alternative.         |
| 11   | 13. Print view                 | Add print button and print CSS for results.                                 | Organizers can produce a simple report.        |
| 12   | 15. Triage half-baked features | Document finish/hide/delete decisions in ADR 0063.                          | UI stops overpromising.                        |
| 13   | 18. Settings completeness      | Avoid adding a settings page; no placeholder settings exist.                | No fake controls.                              |
| 14   | 19. Help/docs alignment        | Rewrite README limitations and feature claims.                              | Docs match reality.                            |
| 15   | 20. DRY duplicated logic       | Extract export/download/clipboard helpers.                                  | Less fragile output code.                      |
| 16   | 22. Canonical domain types     | Add state-export types/schema as the only round-trip shape.                 | Import/export share a contract.                |
| 17   | 23. Shared validation schemas  | Validate state import with Zod.                                             | Bad state files fail safely.                   |
| 18   | 24. Split god module           | Move app-state/export boundary out of `App.tsx`.                            | Core workflows become testable.                |
| 19   | 31. One error convention       | Route import/export errors through actionable toast/activity messages.      | Failures tell users what to do.                |
| 20   | 35. Eliminate unsafe `any`     | Keep `unknown` only at boundary schemas.                                    | Type safety stays honest.                      |
| 21   | 36. Validate boundaries        | Validate imported state and file routing.                                   | External data is not trusted.                  |
| 22   | 38. Every save saves           | Persist full session draft.                                                 | Browser reload is safe.                        |
| 23   | 39. Migrations                 | Add schema version and legacy recent-room migration.                        | Existing users are not stranded.               |
| 24   | 40. Clear state                | Add start-fresh control that clears persisted state and creates a new room. | Users can recover from wrong rooms.            |
| 25   | 41. Round-trip                 | Add unit tests for state export/import.                                     | State artifacts are real, not decorative.      |
| 26   | 42. README verified checklist  | Add claims checklist and limitations.                                       | Documentation drift becomes visible.           |
| 27   | 46. Stranger test              | Run private-window workflow and record findings.                            | Mandatory usability check.                     |
| 28   | 47. Fix top 3 stranger issues  | Address file/state/reset confusion.                                         | The top real workflow blockers are closed.     |

## Implementation Order

1. ADRs for completeness policy.
2. State/export boundary and tests.
3. App UI wiring for file/drop/clipboard/state/reset.
4. Documentation and audit grid updates.
5. Stranger test and postmortem.
