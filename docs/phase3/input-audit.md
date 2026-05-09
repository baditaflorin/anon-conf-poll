# Phase 3 Input Pathway Audit

Status reflects the app after Phase 2 substance work and before Phase 3 implementation.

| Entry point           | Status          | Evidence                                                                                  | Phase 3 decision                                                  |
| --------------------- | --------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Paste roster CSV      | Works fully     | `Roster CSV` textarea infers Eventbrite, Zoom, and generic CSV fixtures.                  | Keep and test.                                                    |
| Paste poll text/CSV   | Works fully     | `Poll draft` textarea infers prose and CSV fixtures.                                      | Keep and test.                                                    |
| Paste invite code     | Works fully     | Raw, wrapped, quoted, JSON, and `invite=` shapes pass fixture tests.                      | Keep and test.                                                    |
| Room URL deep link    | Works fully     | Valid hash loads; bad hash renders damaged-room recovery.                                 | Keep and test.                                                    |
| Restored autosave     | Works partially | Last room/invite restores, but roster draft, poll draft, activity, and selections do not. | Finish.                                                           |
| File upload           | Not built       | No file input exists for rosters, polls, invites, or state.                               | Finish for text/CSV/JSON state.                                   |
| Drag/drop             | Not built       | No drop target exists.                                                                    | Finish for text/CSV/JSON state.                                   |
| Multi-file input      | Not built       | No batch file path exists.                                                                | Finish with per-file routing and errors.                          |
| Imported state        | Not built       | Results export exists, but no full-state import.                                          | Finish.                                                           |
| Clipboard read button | Not built       | Browser paste works manually only.                                                        | Add explicit read with fallback messaging.                        |
| URL input field       | Not built       | Deep links work through address bar only.                                                 | Add room/invite URL import field.                                 |
| Mobile file picker    | Not built       | No `<input type=file>` exists.                                                            | Covered by standard file input; manual device testing documented. |
| Folder input          | Not built       | Not meaningful for Mode A single-room workflow.                                           | Out of scope; ADR 0061.                                           |
| Image paste/camera    | Not built       | Product has no OCR/image parsing claim.                                                   | Out of scope; ADR 0061.                                           |
| Demo/sample loader    | Works partially | App auto-generates a sample room; no explicit sample data loader for user input paths.    | Finish as "sample data" for roster/poll/invite.                   |

## Green/Yellow/Red

- Green: 4
- Yellow: 3
- Red: 8
