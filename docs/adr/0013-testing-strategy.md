# 0013 - Testing Strategy

## Status

Accepted

## Context

The app has high-risk protocol logic and a static deployment path that must remain working.

## Decision

Use:

- Vitest for proof helper, room model, reducer, and export logic tests.
- Testing Library for important UI flows.
- Playwright for one happy-path browser smoke test.
- `scripts/smoke.sh` to build, serve `docs/`, and run Playwright.

Targets:

- `make test`
- `make test-integration`
- `make smoke`
- coverage target of at least 70% for logic modules over time.

## Consequences

- Fast local checks replace CI.
- Protocol regressions are caught before push hooks complete.
- Browser-only WASM failures are covered by smoke tests.

## Alternatives Considered

- GitHub Actions: rejected by project constraint.
- Manual-only browser testing: rejected.
