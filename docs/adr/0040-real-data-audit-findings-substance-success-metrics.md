# 0040 - Real-Data Audit Findings And Substance Success Metrics

## Status

Accepted

## Context

The Phase 2 audit found that v1 works for its generated demo but fails when organizers bring real attendee rosters, poll drafts, copied invite tokens, and broken room links.

## Decision

Use `docs/phase2-substance/realdata-audit.md` and `docs/phase2-substance/plan.md` as the grading rubric for Phase 2.

Primary success metrics:

- at least 7 of 10 audit inputs complete their primary flow without manual cleanup
- no malformed room hash creates an uncaught bootstrap failure
- same fixture input produces deterministic normalized output
- every inference exposes confidence and anomalies
- roster/poll preview appears in under 1 second for the fixture set

## Consequences

Phase 2 work is fixture-driven. Any inference change must update tests and the audit trend.

## Alternatives Considered

Using the demo workflow as the rubric was rejected because it misses the real-data failures.
