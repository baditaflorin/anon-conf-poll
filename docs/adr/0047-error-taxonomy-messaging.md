# 0047 - Error Taxonomy And Messaging Guidelines

## Status

Accepted

## Context

Errors should be recoverable where possible and always actionable.

## Decision

Use four error classes:

- `input`: malformed pasted data, bad CSV, invalid invite
- `domain`: duplicate attendee, no eligible rows, missing poll options
- `crypto`: proof generation/verification problems
- `runtime`: browser/network/WASM failures

Every user-facing error includes what failed, why, and now what.

## Consequences

Tests can assert domain messages instead of raw exceptions.

## Alternatives Considered

One generic error toast was rejected.
