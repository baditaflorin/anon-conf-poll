# 0046 - Performance Budgets And Measurement Plan

## Status

Accepted

## Context

Inference should feel immediate on real pasted data.

## Decision

Budgets:

- invite normalization: under 50 ms
- room hash validation: under 50 ms
- roster/poll fixture inference: median under 100 ms, p95 under 300 ms
- large 5,000-row roster preview: under 1 second
- operations over 300 ms show a running state

Add a fixture performance script that writes `docs/perf/phase2-substance.json`.

## Consequences

Performance claims become measured and reproducible.

## Alternatives Considered

Manual timing in the browser was rejected.
