# 0068 - Persistence Schema and Migration Policy

## Status

Accepted.

## Context

`RecentRoom` was unversioned. Existing users should not lose recent rooms when v0.3.0 lands.

## Decision

Persist `AppStateSnapshot` with `schemaVersion: 2`. Loading supports legacy `RecentRoom` by migrating manifest/invite into a v2 snapshot and filling missing fields with safe defaults.

State import files use the same schema. Unsupported future versions fail with an actionable error.

## Consequences

Future changes have a clear migration place. Imported state cannot silently mutate app state unless it validates.

## Alternatives Considered

Clearing old local data was rejected because it would strand existing invite state.
