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

## Final Status After Phase 3

| Entry point           | Final status | Evidence                                                                                                               |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Paste roster CSV      | Green        | Existing textarea remains covered by e2e smoke.                                                                        |
| Paste poll text/CSV   | Green        | Existing textarea remains covered by e2e smoke.                                                                        |
| Paste invite code     | Green        | Fixture parser and UI import path remain covered.                                                                      |
| Room URL deep link    | Green        | Safe room decoder accepts hashes and full URLs.                                                                        |
| Restored autosave     | Green        | Versioned app-state persistence restores room setup, drafts, selected options, invite, activity, and raw sync records. |
| File upload           | Green        | `Import files` accepts CSV/TXT/JSON and is covered by Playwright.                                                      |
| Drag/drop             | Green        | The room-control panel handles dropped CSV/TXT/JSON files through the same router.                                     |
| Multi-file input      | Green        | The file router processes multiple files with per-file activity/toast outcomes.                                        |
| Imported state        | Green        | State JSON imports through file/drop/route and validates with Zod.                                                     |
| Clipboard read button | Green        | Invite clipboard read has permission failure fallback.                                                                 |
| URL input field       | Green        | Room URLs, `#room=...`, and invite-like text route through the same classifier.                                        |
| Mobile file sources   | Green        | Standard file picker is available to mobile browser file providers.                                                    |
| Sample/demo loader    | Green        | Sample roster and poll draft button exercises real input paths.                                                        |
| Folder input          | Out of scope | ADR 0061: not meaningful for the single-room static workflow.                                                          |
| Image paste/camera    | Out of scope | ADR 0061: no OCR/image parsing claim.                                                                                  |

Final: 13 green, 0 yellow, 0 red, 2 out of scope.
