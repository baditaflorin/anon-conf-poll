# 0044 - Confidence Model

## Status

Accepted

## Context

Inference must not be silently wrong. Users need to know when a roster, field, or poll guess is uncertain.

## Decision

Use a simple deterministic confidence model:

- `high`: strong header/pattern match and no blocking anomalies
- `medium`: enough structure to preview, but review recommended
- `low`: ambiguous or partial data; user must inspect before applying

Each inferred field and preview has a confidence value and reasoning strings. Exports include confidence and anomalies.

## Consequences

The app can make useful guesses while staying honest.

## Alternatives Considered

Hidden confidence was rejected because it creates wrong-but-confident behavior.
