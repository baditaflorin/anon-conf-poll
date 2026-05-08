# 0016 - Local Git Hooks

## Status

Accepted

## Context

No GitHub Actions are allowed, so quality gates must run locally.

## Decision

Use plain `.githooks/` wired by `make install-hooks`.

Hooks:

- `pre-commit`: format check, lint, typecheck, gitleaks when installed.
- `commit-msg`: Conventional Commits validation.
- `pre-push`: `make test`, `make build`, `make smoke`.
- `post-merge` and `post-checkout`: dependency hints.

## Consequences

- Contributors need to install hooks locally.
- Hooks are transparent shell scripts that can be run manually.
- Missing optional tools print actionable warnings instead of failing setup.

## Alternatives Considered

- Lefthook: solid, but plain hooks avoid adding another tool.
