# Contributing

Thanks for improving `anon-conf-poll`.

## Local Workflow

```sh
npm install
make install-hooks
make lint
make test
make build
make smoke
```

Commits must use Conventional Commits, such as `feat: add encrypted export` or `docs: document proof profile`.

## Standards

- Keep the app deployable as a static GitHub Pages site.
- Do not add runtime secrets or server-only assumptions to frontend code.
- Prefer production-ready libraries over custom protocol code.
- Add or update ADRs before significant architectural changes.
- Keep generated Pages artifacts in `docs/`.
