# Phase 3 Output Pathway Audit

Status reflects the app after Phase 2 substance work and before Phase 3 implementation.

| Exit path               | Status          | Evidence                                                                           | Phase 3 decision                               |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| Copy room URL           | Works fully     | Header copy button writes `room=` hash URL.                                        | Keep and test.                                 |
| Copy active invite      | Works fully     | Invite copy button writes current invite code.                                     | Keep and test.                                 |
| Download invite roster  | Works fully     | Organizer can download JSON array of invite codes.                                 | Keep and test.                                 |
| Download results JSON   | Works partially | Exports manifest, votes, questions, and provenance, but not full UI/session state. | Keep and add state export.                     |
| Download results CSV    | Works partially | Exports vote rows only; Q&A and provenance are omitted.                            | Make label honest and add copy.                |
| Copy results JSON/CSV   | Not built       | No clipboard path for exports.                                                     | Finish.                                        |
| Downloadable state file | Not built       | No full round-trip state artifact.                                                 | Finish with versioned schema.                  |
| Import exported state   | Not built       | No inverse operation for state export.                                             | Finish.                                        |
| Shareable URL           | Works partially | Room manifests share via URL hash; large state cannot share.                       | Keep, document limit, add copy state fallback. |
| Print-friendly view     | Not built       | Browser print includes all chrome.                                                 | Add minimal print CSS and print button.        |
| Screenshot/export image | Not built       | No claim and not needed for core workflow.                                         | Out of scope.                                  |
| Embed code              | Not built       | No claim and not needed for Mode A v1.                                             | Out of scope.                                  |
| API/curl output         | Not built       | Static browser app has no API.                                                     | Out of scope; docs must not claim it.          |

## Green/Yellow/Red

- Green: 3
- Yellow: 3
- Red: 7

## Final Status After Phase 3

| Exit path               | Final status                | Evidence                                                        |
| ----------------------- | --------------------------- | --------------------------------------------------------------- |
| Copy room URL           | Green                       | Shared clipboard helper with fallback errors.                   |
| Copy active invite      | Green                       | Shared clipboard helper with fallback errors.                   |
| Download invite roster  | Green                       | Canonical download helper writes invite JSON.                   |
| Download results JSON   | Green                       | Provenance JSON remains available.                              |
| Download vote CSV       | Green                       | Label now says vote CSV and output is copyable/downloadable.    |
| Copy results JSON/CSV   | Green                       | Dedicated copy buttons for JSON and vote CSV.                   |
| Downloadable state file | Green                       | Versioned app-state JSON export.                                |
| Import exported state   | Green                       | Same schema imports and migrates.                               |
| Shareable URL           | Green with documented limit | Room URL remains hash-based; state files cover large workflows. |
| Print-friendly view     | Green                       | Print button and print CSS hide setup chrome.                   |
| Screenshot/export image | Out of scope                | No claim.                                                       |
| Embed code              | Out of scope                | No claim.                                                       |
| API/curl output         | Out of scope                | Mode A has no runtime API.                                      |

Final: 10 green, 0 yellow, 0 red, 3 out of scope.
