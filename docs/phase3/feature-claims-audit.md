# Phase 3 Feature Claims Audit

Status reflects README, ADRs, postmortems, and in-app copy after Phase 2 substance work and before Phase 3 implementation.

| Claim                          | Location                     | Status            | Finding                                                                           | Phase 3 decision                                      |
| ------------------------------ | ---------------------------- | ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Live Pages URL exists          | README                       | Shipped fully     | URL exists and Pages is configured from `main /docs`.                             | Keep.                                                 |
| GitHub repo link exists        | README and app               | Shipped fully     | Header link points at repository.                                                 | Keep.                                                 |
| PayPal support link exists     | README and app               | Shipped fully     | Header link points at PayPal.                                                     | Keep.                                                 |
| Version and commit displayed   | App and postmortem           | Shipped fully     | Header displays build metadata.                                                   | Keep; update after bump.                              |
| Attendees vote/Q&A through URL | README                       | Shipped fully     | Shared room URL loads room and Q&A/vote UI.                                       | Keep.                                                 |
| Yjs/WebRTC sync                | README/ADRs                  | Shipped partially | Uses `y-webrtc`, but conference-scale reliability has no TURN/relay guarantee.    | Keep with limitations.                                |
| One-vote-per-attendee proofs   | README/ADRs                  | Shipped partially | Semaphore proof/nullifier path exists; full proving artifacts are not e2e-smoked. | Keep with limitations.                                |
| Local DuckDB analytics         | README/app                   | Shipped fully     | Smoke test initializes DuckDB.                                                    | Keep.                                                 |
| JSON/CSV exports               | README/postmortem            | Shipped partially | JSON has provenance; CSV is vote-only.                                            | Clarify and test.                                     |
| "Imports attendee commitments" | README diagram               | Shipped partially | The UI imports rosters and generates commitments, not pre-existing commitments.   | Correct wording.                                      |
| Offline-friendly/PWA           | ADRs/manifest                | Shipped partially | Manifest exists; service worker/offline caching is not implemented.               | Document as installable shell, not offline guarantee. |
| No analytics/PII collection    | privacy docs                 | Shipped fully     | No external analytics script exists.                                              | Keep.                                                 |
| Full roster file flow          | postmortem v0.1.0 open item  | Not shipped       | Phase 2 added paste only.                                                         | Finish in Phase 3.                                    |
| State import/export            | Phase 2 postmortem open item | Not shipped       | No state artifact.                                                                | Finish in Phase 3.                                    |

## Green/Yellow/Red

- Green: 7
- Yellow: 5
- Red: 2
