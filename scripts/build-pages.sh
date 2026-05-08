#!/usr/bin/env bash
set -euo pipefail

bash scripts/prepare-pages.sh

export VITE_APP_VERSION="${VITE_APP_VERSION:-$(node -p "require('./package.json').version")}"
export VITE_GIT_COMMIT="${VITE_GIT_COMMIT:-$(git rev-parse --short=12 HEAD 2>/dev/null || printf local)}"

tsc -b
vite build
cp docs/index.html docs/404.html
