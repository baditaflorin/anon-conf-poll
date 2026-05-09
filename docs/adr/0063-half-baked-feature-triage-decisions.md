# 0063 - Half-Baked Feature Triage Decisions

## Status

Accepted.

## Context

Phase 3 must finish, hide, or delete half-baked surfaces before adding polish.

## Decision

| Surface                | Decision                  | Rationale                                                                      |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| Results JSON           | Finish                    | It is already useful; add copy and provenance tests.                           |
| Vote CSV               | Finish and label honestly | It should remain vote rows, not pretend to include Q&A/provenance.             |
| Autosave               | Finish                    | Reload safety is central to usability.                                         |
| Roster/poll paste      | Keep                      | Phase 2 made it functional; file/drop paths complement it.                     |
| PWA/offline claim      | Keep limited              | Manifest stays, but docs avoid a service-worker offline guarantee.             |
| Conference-scale claim | Keep limited              | The project remains a static mesh experiment with explicit WebRTC limitations. |
| Settings page          | Do not add                | No settings are needed; adding a placeholder page would violate the bar.       |
| API/curl output        | Hide by omission          | No runtime API exists.                                                         |

## Consequences

The UI gets a few real controls, not a settings surface or marketing features.

## Alternatives Considered

Leaving partial exports as-is was rejected because documentation and labels would remain misleading.
