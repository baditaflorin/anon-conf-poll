# 0010 - GitHub Pages Publishing Strategy

## Status

Accepted

## Context

The live GitHub Pages URL is a first-class deliverable from the first commit. GitHub Actions are not allowed.

## Decision

Publish from the `main` branch `/docs` folder:

- `vite.config.ts` sets `base: "/anon-conf-poll/"`.
- `make build` writes production assets directly into `docs/`.
- `docs/404.html` mirrors `docs/index.html`.
- `docs/` is intentionally committed and not gitignored.
- Cache busting comes from Vite hashed asset filenames.

## Consequences

- Publishing is a normal git commit and push.
- Rollback is a normal git revert of a Pages artifact commit.
- The repo contains generated frontend assets by design.

## Alternatives Considered

- `gh-pages` branch: workable, but adds branch choreography without GitHub Actions.
- `main /`: rejected because source and generated assets would be mixed too heavily.
