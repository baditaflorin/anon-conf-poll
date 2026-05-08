.PHONY: help install-hooks dev build data test test-integration smoke lint fmt pages-preview clean hooks-pre-commit hooks-commit-msg hooks-pre-push release

help:
	@printf '%s\n' \
		"make install-hooks     wire .githooks into git" \
		"make dev               run the Vite dev server" \
		"make build             build the Pages-ready app into docs/" \
		"make data              Mode A no-op" \
		"make test              run unit tests" \
		"make test-integration  run integration tests" \
		"make smoke             build, serve docs/, and run Playwright" \
		"make lint              run linters and type checks" \
		"make fmt               autoformat source and docs" \
		"make pages-preview     serve docs/ as GitHub Pages would" \
		"make release           tag the current commit as VERSION=vX.Y.Z" \
		"make clean             remove generated caches"

install-hooks:
	git config core.hooksPath .githooks
	chmod +x .githooks/*

dev:
	npm run dev

build:
	npm run build

data:
	@printf '%s\n' "Mode A: no static data pipeline is required."

test:
	npm run test

test-integration:
	npm run test:integration

smoke:
	npm run smoke

lint:
	npm run fmt:check
	npm run lint
	npm run typecheck
	npm run audit

fmt:
	npm run fmt

pages-preview:
	npm run pages-preview

hooks-pre-commit:
	.githooks/pre-commit

hooks-commit-msg:
	@[ -n "$(MSG)" ] || (printf '%s\n' "Usage: make hooks-commit-msg MSG=.git/COMMIT_EDITMSG"; exit 2)
	.githooks/commit-msg "$(MSG)"

hooks-pre-push:
	.githooks/pre-push

release:
	@[ -n "$(VERSION)" ] || (printf '%s\n' "Usage: make release VERSION=v0.1.0"; exit 2)
	git tag "$(VERSION)"
	git push origin "$(VERSION)"

clean:
	rm -rf coverage .vite node_modules/.tmp playwright-report test-results
