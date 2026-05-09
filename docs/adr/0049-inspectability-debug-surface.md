# 0049 - Inspectability And Debug Surface

## Status

Accepted

## Context

Power users and maintainers need to inspect inference decisions without browser devtools.

## Decision

Enable `?debug=1` or `&debug=1` to show a compact debug panel with:

- app version/commit
- current room id
- roster/poll inference summaries
- activity log
- last export provenance

No secrets or raw private invite keys appear in the debug panel.

## Consequences

Support can ask users for state summaries without collecting identities.

## Alternatives Considered

Always-visible diagnostics were rejected as polish clutter.
