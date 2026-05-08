# 0005 - Client-Side Storage Strategy

## Status

Accepted

## Context

Mode A needs local persistence for rooms, credentials, and last-known Yjs state.

## Decision

Use IndexedDB through `idb-keyval` for structured local state and small `localStorage` entries for non-sensitive UI preferences.

Persist:

- recent rooms
- local attendee credential
- last room snapshot
- export preferences

Do not persist:

- organizer-only private roster source material
- raw identity documents unless explicitly imported by the user

## Consequences

- The app works offline after initial load for local review/export.
- Device loss means local credential loss unless the attendee saves their invite code.
- Sensitive data stays on the attendee device.

## Alternatives Considered

- OPFS: useful for larger artifacts, but not needed for v1.
- Server storage: rejected by ADR 0001.
