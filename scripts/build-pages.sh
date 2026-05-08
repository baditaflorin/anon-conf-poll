#!/usr/bin/env bash
set -euo pipefail

bash scripts/prepare-pages.sh

export VITE_APP_VERSION="${VITE_APP_VERSION:-$(node -p "require('./package.json').version")}"

source_commit="$(git log -1 --format=%H -- . ':(exclude)docs' 2>/dev/null || true)"
if [ -z "$source_commit" ]; then
  source_commit="$(git rev-parse HEAD 2>/dev/null || printf local)"
fi

export VITE_GIT_COMMIT="${VITE_GIT_COMMIT:-${source_commit:0:12}}"

tsc -b
vite build
cp docs/index.html docs/404.html
