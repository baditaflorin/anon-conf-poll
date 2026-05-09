# 0048 - Determinism And Reproducibility Guarantees

## Status

Accepted

## Context

Fixture outputs must be byte-identical for the same input.

## Decision

Inference outputs are deterministic:

- stable ordering follows input order
- stable IDs derive from normalized text
- timestamps are excluded from normalized fixture outputs
- export provenance includes schema version, app version, source kind, source checksum, and operation parameters

## Consequences

Regression tests can compare expected JSON directly.

## Alternatives Considered

Random IDs for inferred entities were rejected.
