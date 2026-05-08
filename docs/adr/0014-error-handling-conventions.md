# 0014 - Error Handling Conventions

## Status

Accepted

## Context

Cryptographic, sync, and WASM failures can be confusing. Errors need clear boundaries and safe messages.

## Decision

Use typed `Result`-style helpers for protocol operations and throw only at React/query boundaries where error boundaries or toasts can present recovery actions.

Rules:

- Never swallow errors.
- Never include credential secrets in error messages.
- Convert unknown errors to user-safe messages.
- Keep recovery actions close to the failed UI.

## Consequences

- Tests can assert failure reasons.
- The UI can distinguish invalid invite, duplicate vote, proof failure, and sync unavailable.
- Stack traces remain development-only.

## Alternatives Considered

- Global catch-all only: rejected because users need actionable state.
