# 0012 - Metrics And Observability

## Status

Accepted

## Context

Mode A cannot expose Prometheus metrics. The default should be privacy-preserving.

## Decision

Ship no analytics in v1. Observability consists of:

- local UI health indicators for sync, proof, and analytics readiness
- local exportable diagnostics with no attendee identity fields
- Playwright smoke tests for deployed behavior

## Consequences

- Maintainers do not get usage metrics.
- Attendees are not tracked.
- Operators must rely on local reports and reproducible test cases.

## Alternatives Considered

- Plausible: privacy-friendly but unnecessary for v1.
- Custom beacon: rejected because it creates a backend dependency.
