# Deploy

Live site:

https://baditaflorin.github.io/anon-conf-poll/

Repository:

https://github.com/baditaflorin/anon-conf-poll

## Publishing

GitHub Pages is configured to serve `main /docs`.

```sh
make build
git add docs package.json package-lock.json
git commit -m "build: publish pages"
git push
```

## Rollback

Revert the commit that changed `docs/` and push `main`.

```sh
git revert <commit_sha>
git push
```

## Custom Domain

Add the domain as `docs/CNAME`, configure the domain in repository Pages settings, and point DNS at GitHub Pages according to:

https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

GitHub Pages does not support `_headers` or `_redirects`; SPA fallback uses `docs/404.html`.
