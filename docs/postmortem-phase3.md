# Phase 3 Postmortem

## Audit Grids

| Audit           | Before                      | After                                                 |
| --------------- | --------------------------- | ----------------------------------------------------- |
| Input pathways  | 4 green / 3 yellow / 8 red  | 13 green / 0 yellow / 0 red / 2 out of scope          |
| Output pathways | 3 green / 3 yellow / 7 red  | 10 green / 0 yellow / 0 red / 3 out of scope          |
| Controls        | 15 green / 5 yellow / 2 red | 21 green-equivalent / 1 documented limitation / 0 red |
| Feature claims  | 7 green / 5 yellow / 2 red  | 9 aligned claim areas / 0 known mismatches            |

## Half-Baked Feature Triage

- Results JSON: finished with copy support and provenance retained.
- Vote CSV: finished and relabeled honestly as vote rows.
- Autosave: finished with versioned state and legacy migration.
- PWA/offline: kept limited; docs avoid service-worker claims.
- Conference-scale WebRTC: kept limited; docs call out mesh constraints.
- Settings page/API/embed/image export: not added because there is no production handler or Mode A need.

## Codebase Health

| Metric                   | Before                   | After                                                       |
| ------------------------ | ------------------------ | ----------------------------------------------------------- |
| Download duplication     | 2 blocks                 | 0                                                           |
| Clipboard convention     | Direct browser calls     | Shared helper with fallback errors                          |
| Persistence schema       | Unversioned recent room  | Versioned state schema with migration                       |
| Unsafe `any` / ts-ignore | 0                        | 0                                                           |
| TODO/FIXME/XXX/HACK      | 0                        | 0                                                           |
| Real-user path tests     | Inference/e2e paste only | State round-trip, file routing, file import, state download |

Accepted debt: `src/App.tsx` is larger after Phase 3 because the UI surface grew. The external IO/state boundaries are now testable, but a future component split is still valuable.

## Stranger Test

The top three issues were file discovery, save/resume, and reset. Phase 3 fixed all three with visible import controls, state export/import/autosave, and `Start fresh`.

## Documentation Alignment

README now distinguishes:

- roster/poll import from importing pre-existing commitments
- vote CSV from full JSON results
- state JSON from room URL sharing
- static WebRTC mesh limits from guaranteed conference infrastructure
- installable manifest from service-worker offline guarantees

## Surprises

- Completing "output" mostly meant adding the inverse operation: state import mattered more than another export button.
- File routing stayed simple because Phase 2 inference already made format detection reliable.
- The only honest answer for large rooms is still a limitation note; a static WebRTC mesh cannot promise vendor-grade conference transport.

## Still Open

1. Split `RoomExperience` into smaller components and hooks.
2. Add an optional proof-artifact warmup/check before the first vote.
3. Add a manual state-import confirmation preview before applying large state files.
4. Add more mobile-device manual test notes.
5. Explore a later Mode C or hybrid relay ADR for truly large rooms.

## Honest Take

A stranger can now use the app for their own roster and poll data end-to-end: upload files, create a room, export results, save state, reload/import state, and reset. The remaining "not fully professional yet" gap is conference-scale transport reliability, not local usability. For small and medium rooms, it is genuinely usable; for a giant conference, it is still an ambitious static mesh prototype that needs a relay/signaling plan before anyone should bet an event on it.
