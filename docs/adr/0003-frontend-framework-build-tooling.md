# 0003 - Frontend Framework And Build Tooling

## Status

Accepted

## Context

The frontend is the product. It needs strong typing, good test tooling, a small static build, and GitHub Pages base-path support.

## Decision

Use React, TypeScript strict mode, and Vite. Use plain CSS modules/global CSS for the first version instead of adding a component framework.

Core libraries:

- `vite` for build and dev server.
- `react` and `react-dom` for UI.
- `zod` for schema validation.
- `@tanstack/react-query` for async initialization and cache state.
- `vitest` and Testing Library for unit/component tests.
- Playwright for smoke/e2e tests.

## Consequences

- The app builds quickly into `docs/`.
- The base path `/anon-conf-poll/` is explicit in `vite.config.ts`.
- Avoiding a large UI kit helps keep the initial payload smaller.

## Alternatives Considered

- Svelte: good fit, but React has broader ecosystem coverage for current test and protocol integrations.
- Next.js: unnecessary because the project is static and Pages-first.
