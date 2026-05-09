# 0050 - Interaction-Learning Policy

## Status

Accepted

## Context

Phase 2 allows remembering user corrections within the session. This must be transparent and non-creepy.

## Decision

Remember only session-local inference preferences:

- last accepted roster eligibility policy
- last delimiter override
- last poll CSV grouping choice

Preferences stay in component state/local browser state and never sync to peers or exports unless included as explicit operation parameters.

## Consequences

The app can default similar inputs more intelligently without hidden tracking.

## Alternatives Considered

Cross-session behavioral learning was rejected for privacy and scope.
