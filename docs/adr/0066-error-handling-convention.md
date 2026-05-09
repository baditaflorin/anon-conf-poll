# 0066 - Error-Handling Convention

## Status

Accepted.

## Context

Real-user import/export errors must say what failed, why, and what to do next.

## Decision

UI handlers will translate thrown errors through `sanitizeError` and add a domain action in toast/activity copy. Boundary helpers return typed results where recovery is expected, and throw only for programmer errors or browser API failures.

## Consequences

Import errors stay localized to the file/path that caused them. The app avoids stack-shaped messages in normal user flows.

## Alternatives Considered

Global error swallowing was rejected because it hides wrongness.
