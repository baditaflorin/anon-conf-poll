# 0009 - Configuration And Secrets Management

## Status

Accepted

## Context

The frontend cannot contain secrets. Static configuration still needs to expose public URLs and transport choices.

## Decision

Use Vite environment variables with `VITE_` prefix for public configuration only:

- app version
- git commit
- repository URL
- PayPal URL
- WebRTC signaling URL

`.env.example` documents placeholders. Real `.env*` files are gitignored. Gitleaks runs in hooks when available.

## Consequences

- No secret can be depended on at runtime.
- Public transport endpoints are visible and configurable.
- Builds are reproducible with explicit version and commit inputs.

## Alternatives Considered

- Runtime config endpoint: rejected by ADR 0001.
- Hidden encrypted frontend secrets: rejected because frontend secrets are not secrets.
