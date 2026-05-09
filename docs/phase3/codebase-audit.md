# Phase 3 Codebase Health Audit

Status reflects the app after Phase 2 substance work and before Phase 3 implementation.

## Measurements

| Metric                          | Current                                            | Evidence                                                                                       |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- | --- | ------------------------------- |
| Largest module                  | 923 lines                                          | `src/App.tsx` owns bootstrap, room state, import, export, proof actions, and rendering.        |
| TODO/FIXME/XXX/HACK             | 0                                                  | `rg -n "TODO                                                                                   | FIXME | XXX | HACK"` returned no source hits. |
| `any` / ts-ignore holes         | 0 unsafe `any`; 4 intentional `unknown` boundaries | `duckdb.ts`, `inviteInput.ts`, and fixture tests parse external data through `unknown`.        |
| Dead exports                    | 0 obvious                                          | `ts-prune` produced no unreferenced export output.                                             |
| Duplicated download/copy logic  | 2 blocks                                           | `downloadResults` and `downloadBlob` both create object URLs and anchors.                      |
| Duplicated export serialization | 2 blocks                                           | Results JSON and invite roster serialize ad hoc in `App.tsx`.                                  |
| Persistence schema              | 1 unversioned shape                                | `RecentRoom` has no schema version or migration path.                                          |
| Boundary validation             | Partial                                            | Room/invite inputs use Zod; state export/import does not exist yet.                            |
| Module boundaries               | Partial                                            | Domain inference is modular, but application workflow still lives in `App.tsx`.                |
| Real-user path tests            | Partial                                            | Fixture tests cover inference; e2e covers paste preview and DuckDB, not file/state/copy flows. |

## DRY Violations

1. `src/App.tsx` has two download helpers instead of one canonical export/download utility.
2. `src/App.tsx` assembles JSON/CSV outputs directly instead of using one exporter boundary.
3. Clipboard writes happen directly without a shared fallback/error convention.

## SOLID Violations

1. `RoomExperience` changes for input, output, persistence, proof actions, sync, debug, and rendering.
2. `localStore.ts` stores only recent room/invite with no versioned persistence boundary.
3. Export provenance lives in a Phase 2 module, but state export/import needs its own application-level contract.

## Type Safety Holes

No unsafe `any` or `@ts-ignore` is present. The remaining `unknown` casts are at external boundaries and should remain guarded by schemas or explicit narrowing.

## Test Coverage Holes

1. State export/import round trip.
2. File routing for roster, poll, invite, and app state.
3. Clipboard fallback behavior.
4. Reset/start-fresh persistence clearing.
5. README claim drift.

## Final Status After Phase 3

| Metric                           | Before                  | After                                                                                                                   |
| -------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Largest module                   | `src/App.tsx` 923 lines | `src/App.tsx` 1,343 lines; intentionally accepted because Phase 3 added UI wiring while extracting IO/state boundaries. |
| TODO/FIXME/XXX/HACK              | 0                       | 0                                                                                                                       |
| Unsafe `any` / ts-ignore         | 0                       | 0                                                                                                                       |
| Intentional `unknown` boundaries | 4                       | 4; all remain at JSON/DuckDB fixture boundaries.                                                                        |
| Duplicated download code         | 2 blocks                | 0; `features/io/downloads.ts` owns downloads/clipboard/print.                                                           |
| State schema                     | Unversioned recent room | Versioned `AppStateSnapshot` with migration from legacy shape.                                                          |
| Boundary validation              | Partial                 | State import validates with Zod; room/invite validation unchanged.                                                      |
| Real-user path tests             | Partial                 | Added state round-trip, file-routing unit test, and Playwright file import/state download smoke.                        |

Accepted debt: `RoomExperience` is still too large. ADR 0064 rejects a broad component refactor in Phase 3 because it would not unblock strangers as directly as the completed import/export work.
