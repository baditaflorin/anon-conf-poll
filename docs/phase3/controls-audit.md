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
