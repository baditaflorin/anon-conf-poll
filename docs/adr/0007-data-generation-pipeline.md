# 0007 - Data Generation Pipeline

## Status

Accepted

## Context

Mode B requires an offline generator. ADR 0001 chooses Mode A.

## Decision

No data-generation pipeline exists in v1. Demo room data is generated in-browser and static docs are authored by humans.

## Consequences

- `make data` is intentionally a no-op that explains Mode A.
- Future large proof parameter packaging or demo datasets can add a Mode B ADR.

## Alternatives Considered

- Add a Go generator preemptively: rejected to keep v1 static and small.
