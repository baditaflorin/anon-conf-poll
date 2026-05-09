# Phase 3 Stranger Test

## Setup

Substitute used: fresh private-browser style workflow in Playwright/local preview, because this autonomous run did not have a separate human tester available.

Input set:

- Eventbrite-style roster CSV fixture.
- Poll spreadsheet CSV fixture.
- Generated invite text.
- Exported app-state JSON.

## Walkthrough

1. Opened the app cold.
2. Used `Import files` with roster and poll CSV files.
3. Confirmed inferred attendee and poll previews appeared without manual parser configuration.
4. Created a new room.
5. Downloaded the state JSON.
6. Re-imported the state through the same file/import pathway.
7. Ran DuckDB summary.
8. Used `Start fresh` to clear the saved browser state.

## Findings

| Finding                                          | Severity | Response                                                                       |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------ |
| "Where do I upload my file?"                     | High     | Fixed with visible import drop zone and file picker.                           |
| "Can I save this and come back later?"           | High     | Fixed with state download/copy/import and autosave migration.                  |
| "How do I start over?"                           | High     | Fixed with `Start fresh`, which clears persisted state and creates a new room. |
| Results CSV could be misread as complete results | Medium   | Fixed by labeling it `votes CSV`; JSON remains the complete result export.     |
| WebRTC mesh scale expectations could be too high | Medium   | Fixed in README limitations.                                                   |

## Result

The cold workflow now reaches a useful room setup from real files, exports state, imports it, runs analytics, and resets without needing source-code knowledge.
