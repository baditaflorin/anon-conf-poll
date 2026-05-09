# Phase 3 Controls Audit

Status reflects the app after Phase 2 substance work and before Phase 3 implementation.

| Control                      | Status          | Evidence                                                                                | Phase 3 decision              |
| ---------------------------- | --------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| GitHub Star link             | Works fully     | Opens repository URL.                                                                   | Keep.                         |
| PayPal link                  | Works fully     | Opens configured PayPal URL.                                                            | Keep.                         |
| Copy room URL                | Works fully     | Calls clipboard write.                                                                  | Keep; add fallback handling.  |
| Title input                  | Works fully     | Used by `New room`.                                                                     | Keep.                         |
| Attendees input              | Works partially | Applies numeric value but accepts invalid typed values until room creation.             | Clamp and validate.           |
| Roster CSV textarea          | Works fully     | Infers preview and attendee count.                                                      | Keep.                         |
| Poll draft textarea          | Works fully     | Infers preview and room polls.                                                          | Keep.                         |
| New room                     | Works fully     | Generates commitments and updates URL.                                                  | Keep; make double-click-safe. |
| Invite textarea              | Works fully     | Parsed through Phase 2 importer.                                                        | Keep.                         |
| Load invite                  | Works fully     | Loads valid invite and rejects wrong-room invite.                                       | Keep.                         |
| Copy mine                    | Works fully     | Copies active invite; disabled without invite.                                          | Keep; add fallback.           |
| Invite roster download       | Works fully     | Downloads invite code array.                                                            | Keep.                         |
| Poll radio buttons           | Works fully     | Selects option per poll.                                                                | Keep.                         |
| Cast anonymous vote          | Works partially | Counts local vote and blocks local repeat; cross-device duplicate still sync-dependent. | Keep with honest wording.     |
| Q&A textarea                 | Works fully     | Captures question text.                                                                 | Keep.                         |
| Submit Q&A                   | Works fully     | Creates and publishes proof-backed question.                                            | Keep.                         |
| Run DuckDB                   | Works fully     | Loads DuckDB-WASM and renders summary.                                                  | Keep.                         |
| JSON export                  | Works partially | Downloads results but no copy/state inverse.                                            | Finish.                       |
| CSV export                   | Works partially | Downloads vote rows only.                                                               | Rename/copy or expand.        |
| Damaged-link create new room | Works fully     | Recovery screen creates a new room.                                                     | Keep.                         |
| Start fresh / reset          | Not built       | No explicit clear-state control.                                                        | Finish.                       |
| Import state/file controls   | Not built       | No controls.                                                                            | Finish.                       |

## Green/Yellow/Red

- Green: 15
- Yellow: 5
- Red: 2

## Final Status After Phase 3

| Control group              | Final status                       | Evidence                                                                         |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| Project links              | Green                              | Repository and PayPal links unchanged.                                           |
| Room link copy/open        | Green                              | Copy and URL import both work.                                                   |
| File/drop import           | Green                              | File picker and drop route CSV/TXT/JSON.                                         |
| Sample data                | Green                              | Loads real roster/poll draft examples.                                           |
| Title/attendees/new room   | Green                              | Attendee count clamps to 4-256 and new-room button is busy-safe.                 |
| Roster/poll draft controls | Green                              | Paste and file paths both feed inference.                                        |
| Invite load/copy/paste     | Green                              | Manual, clipboard, and routed import paths work.                                 |
| Invite roster              | Green                              | Downloads invite JSON through the shared helper.                                 |
| Voting/Q&A                 | Green with known mesh timing limit | Local duplicate blocks remain; cross-device duplicate timing remains documented. |
| DuckDB/results             | Green                              | Run, download, copy, state, and print controls are wired.                        |
| Start fresh                | Green                              | Clears IndexedDB state and creates a new room.                                   |
| Damaged-link recovery      | Green                              | Creates a new room from recovery screen.                                         |

Final: 21 green-equivalent controls, 1 documented limitation, 0 red controls.
