# 0069 - Type-Safety Policy at Boundaries

## Status

Accepted.

## Context

The repo has no unsafe `any`, but JSON and browser file inputs are inherently unknown.

## Decision

Use `unknown` only at external boundaries, then narrow with Zod schemas or explicit guards. Do not add `any`, `@ts-ignore`, or unchecked state imports.

## Consequences

Bad state files and malformed input become recoverable user errors.

## Alternatives Considered

Casting parsed JSON directly to domain types was rejected.
