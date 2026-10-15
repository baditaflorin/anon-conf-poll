# Fleet context — drop-in brief for AI agents

This file is the **canonical** cold-start brief for any AI agent
working inside a baditaflorin fleet service repo. It is maintained in
`services-registry/CLAUDE.md` (the registry is the catalog) and
propagated into each fleet repo by `fleet-runner inject` (whole file)
and `bin/propagate_agent_guidance.py` (managed Graph-first and
release-receipt blocks, in small batches); `fleet-runner converge`
reports repos whose copy differs.

If you find a stale copy that differs from this one, the registry copy
wins — refresh and re-propagate, don't fork it.

> ## ⚠️ RULE ZERO — work against `origin/main`, NOT stale workspace code
>
> **Before you read, triage, build, bump, or deploy ANYTHING:**
> `git fetch origin --tags` first, then operate against `origin/main`
> (via `git show origin/main:<file>` or a fresh
> `git worktree add … origin/main`). The shared
> `/root/workspace/<repo>/` working tree is whatever the last (often
> parallel) agent left it — usually close to `origin/main`, but it can
> silently lag or sit on a leftover branch. Acting on it
> ships old code, opens PRs against already-fixed bugs, and lets
> concurrent agents stomp each other. `fleet-runner build-test` runs
> against the working tree and is NOT freshness-correct — confirm any
> "failure" against a fresh `origin/main` worktree before triaging.
> Details below under "pull often, push often." DON'T SKIP THIS.

Per-service specifics (id, port, version, category) live in the
repo's own `service.yaml` (plus optional `deploy.yaml` and
`README.md`); mesh and slug are registry data (`services.json`,
`slug.json`). This file is intentionally generic — it explains the
*fleet*, not any one service.

## Graph-first workflow

For every change to a registered service, establish the graph boundary
before broad code search, planning, or a deploy:

```bash
# Canonical registry / graph service ID.
fleet-runner graph-context fleet-preflight --json

# Run only when graph-context names inspect_bounded_dependencies as a next action.
fleet-runner deps fleet-preflight --depth 1 --top 10 --since 24h --json

# Workspace repository name; ctx normalizes it to the graph service ID.
fleet-runner ctx go-fleet-preflight --callers 3 --callees 3 --graph-since 24h --budget 1500 --workdir /root/workspace
```

<!-- anchor id=graph-first-workflow-graph-context repo=go_fleet_runner symbol=verb:graph-context verified=6bebc4351 digest=sha256:8afc8bd71a2f98f7a648dceb9418ecbef26d537fc8817caf2d3e120fc6044e3d on=2026-10-12 -->
<!-- anchor id=graph-first-workflow-deps repo=go_fleet_runner symbol=verb:deps verified=6bebc4351 digest=sha256:101210cc8bf29087966ee4208be474e74e653a10eba5efa059fc5e78f92857f8 on=2026-10-12 -->
<!-- anchor id=graph-first-workflow-ctx repo=go_fleet_runner symbol=verb:ctx verified=6bebc4351 digest=sha256:f7a62ec3c73911e2e840945f3e84d98761973b0d67400a105e99e5a2939dea36 on=2026-10-12 -->

The `graph-context` result is a token-bounded, review-only agent brief. It
contains the service identity, declared topology, bounded runtime evidence,
attention signals, and typed next actions. It can recommend investigation;
it never authorizes a code, configuration, secret, or deployment change.

Use the result in this order:

1. **Scope and review attention** with `graph-context`: identity,
   declared topology, bounded runtime evidence, and its typed next actions.
2. **Assess blast radius only when requested** with `deps`: declared
   dependencies and dependents first, then bounded observed callers/callees
   for the stated time window.
3. **Read only the needed source context** with `ctx`; do not start
   with the much broader `ai-context` unless the brief or investigation
   shows that source-specific detail is necessary.
4. **Close the loop after a human-approved deploy** with
   `fleet-runner explain <canonical-service-id> --since 24h --json`,
   alongside the normal build, health, self-test, version, and gateway
   checks.

<!-- anchor id=graph-first-workflow-explain repo=go_fleet_runner symbol=verb:explain verified=6bebc4351 digest=sha256:0f1eccdcbdb8e81597e07a40b4db06aeca2ca525da426ab342c376de2fd58d78 on=2026-10-12 -->

`graph-context`, `deps`, and `explain` use the canonical
registry/graph ID (for example `fleet-preflight`). `ctx` accepts a
workspace repository name (for example `go-fleet-preflight`) and
normalizes it. Identity and declared `depends_on` relationships come
from `services-registry` and are authoritative design intent.
Observed incoming/outgoing calls are runtime evidence, labelled with
their source and time window; they help assess impact but never replace
the registry or grant permission. A missing runtime edge means “not
observed in this window,” not “no caller exists.”

The graph reader is deliberately read-only and excludes credentials,
headers, payloads, and raw request paths. Never put its credential in a
prompt, source file, shell history, or commit; the runner loads reader
access through the approved vault path. Record the graph query window,
declared dependencies/dependents, relevant observed callers/callees,
and post-deploy verification in the change receipt.

**Building a new service?** See
[`services-registry/SERVICE-TEMPLATE.md`](SERVICE-TEMPLATE.md) — the
canonical per-service scaffold (file-by-file templates for `main.go`,
`service.yaml`, `Dockerfile`, etc., plus a paste-ready cold-start
prompt you can feed Claude / ChatGPT / Gemini). Some fleet repos carry
a copy next to this file; copies can lag, so treat `services-registry`
as the source.

## Risk tier — what needs extra care before you touch it

Most changes are low-risk: the fleet's own tooling (probe-first
deploy, rollback-on-`/selftest`-fail) is the safety net, so a plain
`fleet-runner deploy <repo>` is enough. A few categories aren't
covered by that net — check the relevant section *before* you act,
not after something breaks fleet-wide:

| Touching...                                             | Do this first |
|-----------------------------------------------------------|----------------|
| One `go_<thing>` service, no shared code                  | Just `fleet-runner deploy <repo>` — you're covered. |
| `safehttp`, middleware, auth, or the gateway               | `fleet-runner deploy-all --repos <lowest-blast-radius-repo>,<others> --canary 1 --soak 90s --gate-no-restarts` first (staged canary + gate; `--repos` order is rollout order; see `fleet-runner deploy-all --help`). Never a fleet-wide rollout on first touch here. |
| `go-common` or a `go-fleet-*` primitive (has >1 consumer)   | See "Fleet-wide changes — change go-common, not consumers" below — one bad edit breaks every consumer at once. |
| DNS records or secrets                                     | Read `RUNBOOK-UNATTENDED.md` first. DNS only via the Hetzner Cloud API (`go-fleet-dns-sync` reads vault entry `hcloud_token`, env fallback `HCLOUD_TOKEN`; `fleet-runner deploy` reads `HETZNER_TOKEN`) — never `dns.hetzner.com`. Secrets originate in `go-fleet-secrets`; never commit them to repos, compose files or `services.json`. `fleet-runner deploy` materializes the values a service needs into a mode-600 per-service `.env` on the dockerhost and into container env, so never print or copy it. `fleet-runner` reads `HETZNER_TOKEN` from its own process env. |
| `proxy_egress` in `overrides.json`                          | Read the `proxy_egress` section in `FLEET.md` first — it's not simply "on = safer": some upstreams 403 the proxy IPs, some services need it on to get an internet route at all. Direction depends on the upstream. |
| A SQLite-backed service                                    | The three mandatory rules under "SQLite safety" below aren't optional — read them first. |

Not sure which tier something is? Default one tier higher and use a
staged `deploy-all --canary 1 --soak ...` before a broad rollout.

## Fleet at a glance

The canonical catalog is `services-registry/services.json`; it lists
530 entries (391 container, 139 static) as of 2026-10-12 (pinned
`e08695528`), so do not hard-code counts, read the file. The canonical
conventions doc is `services-registry/FLEET.md` — **read it first**
for any fleet-wide task.

## Capacity-aware placement: one source, deterministic gates

Fleet Graph answers **what is related to a service** (declared topology and
bounded observed calls); it is deliberately not a CPU/RAM scanner. The sole
authoritative capacity source is `go-fleet-metrics-hub`'s Prometheus API. Before
considering an already-approved runtime target, run:

```bash
fleet-runner graph-context <service-id>
fleet-runner capacity --hosts dockerhost,domainscope-runtime
```

<!-- anchor id=metrics-hub-capacity-capacity repo=go_fleet_runner symbol=verb:capacity verified=6bebc4351 digest=sha256:34625b8a9c4f41286ca2ee90a7aee6df9ff987c2532ec0c5abce79779c194069 on=2026-10-12 -->

`capacity` rejects missing/down node telemetry, incomplete CPU/memory metrics,
and insufficient available memory. Load per core above the preferred threshold
is reported as a warning only, so an ELIGIBLE host can still be busy. Its
selected host is
capacity-only advice: it never authorizes migration or overrides registry
cluster/runtime ownership. A real placement/deploy still needs fresh
`origin/main`, dependency/caller review, `fleet-runner allocate-port`, deploy
preflight, rollback capture, image/container verification, `/health`,
`/selftest`, `/version`, and gateway smoke. No telemetry means fail closed.

<!-- anchor id=port-allocation-allocate-port repo=go_fleet_runner symbol=verb:allocate-port verified=6bebc4351 digest=sha256:e648e1c4bec458426872a913eea49e8a49e03595896e398c93ed4558030f7177 on=2026-10-12 -->

Do not SSH several hosts to compare `uptime`/`free` when Metrics Hub covers the
targets. Add a private node-exporter scrape target and wait for `up=1` if a host
is absent. Prometheus config is a single-file bind mount: after replacing it,
recreate only Prometheus so it observes the new inode. Capacity reads use a
dedicated restricted reader credential, never a broad fleet or Graph key.

The registry's `host-placement-policy.json` is the companion policy layer: it
maps a public logical target name to its cluster, Metrics Hub label, state, and
allowed workload classes. It deliberately never carries private IPs or SSH
configuration. `active` is eligible for review, `restricted` requires a
non-empty explicit service allowlist, and `build-only` is excluded from
placement. Change the policy and its schema in the same PR; do not hand-code a
host decision in an agent or service repository.

<!-- anchor id=host-placement-policy-states repo=services-registry symbol=json:schema/host-placement-policy.v1.json#/$defs/host/properties/state/enum verified=c3b320064 digest=sha256:21dbb1fa007b05e5c61c66b7739b86218c7d419f592fd36632d1ea9d7b513c41 on=2026-10-12 -->

### Reading the registry — fetch a slice, not the full blob

`services.json` is about 1 MB, lists every service (`services.summary.txt` has
the total) and has ~26 fields each. If you
only need IDs, names, ports, TRL, or URLs, **fetch a slice instead**
— it's the same `raw.githubusercontent.com` path with a different
filename. Sized for AI agents on a token budget.

| URL suffix                | shape                                                    | size  | use when |
|---------------------------|----------------------------------------------------------|-------|----------|
| `services.ids.json`       | `[{"id": "a11y-quick"}, …]`                              | ~14 KB | "what services exist?" (sunset omitted) |
| `services.names.json`     | `[{id, name}]`                                           | ~29 KB | pickers / menus |
| `services.minimal.json`   | `[{id, name, mesh, kind, category, language, trl, url}]`| ~97 KB | catalog overview |
| `services.urls.json`      | `[{id, url, health_url, example_path, auth_help}]`      | ~119 KB | building Open / smoke links |
| `services.trl.json`       | `[{id, trl, trl_ceiling, trl_assessed_at, …}]`          | ~65 KB | TRL audits |
| `services.ports.json`     | `[{id, host_port, container_port}]`                     | ~26 KB | port allocation / conflict checks |
| `services.deploy.json`    | `[{id, mesh, kind, runtime, language, repo_url}]`       | ~87 KB | fleet-runner deploy targeting |
| `services.depends.json`   | `[{id, depends_on}]`                                     | ~13 KB | declared dependency edges |
| `services.mcp.json`       | `[{id, name, url, mcp_ready, mcp_tool_count, …}]`        | ~40 KB | MCP-ready services |

Base URL: `https://raw.githubusercontent.com/baditaflorin/services-registry/main/<file>`.

Only fall back to the full `services.json` when you need fields the
slices don't carry (auth surface details, vhost knobs, descriptions).
Slices are derived — never edit them. `services.json` is generated too: edit
`overrides.json` (the hand-edited input) and run `python3 bin/generate.py`
(`--slices-only` rebuilds just the slices).

Every public entry in the registry has four orthogonal classifying axes: kind,
mesh, runtime, language.
Don't conflate them — agent tooling gates behavior on `kind`, not on
mesh.

### Axis 1 — `kind` (what shape of deployable)

| `kind`      | What it is                                  | Has port? | `/health`? | Workspace on LXC? | Bumpable version? | Counted in `fleet-runner health` / `smoke` / `deploy`? |
|-------------|---------------------------------------------|-----------|------------|-------------------|--------------------|--------------------------------------------------------|
| `container` | Container service (compose or Coolify)      | yes       | yes        | yes               | yes                | yes                                                    |
| `static`    | Static GitHub Pages site                    | no        | no         | yes (container operations skip it) | no (exception: `pentest-dashboard`) | **no** — has its own `fleet-runner pages-audit`        |

<!-- anchor id=kind-static-pages-audit repo=go_fleet_runner symbol=verb:pages-audit verified=6bebc4351 digest=sha256:1f393614de6c9d4c4f37d3cf00e216c5b25d9941a7b46a8b87e5977a595f8ab0 on=2026-10-12 -->

If this repo's `service.yaml` (or registry entry) says `kind: static`,
**trust `kind`, not the file layout**: such a repo normally has no
Dockerfile, port, or Go code (a few do, e.g. `pentest-dashboard`). Pages
services are HTML/CSS/JS published by GitHub Pages CI — there is no container
to deploy and no `/health` to probe.

### Axis 2 — `mesh` (which network + auth domain)

| `mesh` | Domain pattern | Auth | Typical contents |
|---|---|---|---|
| `0exec` | `<slug>.0exec.com` | Keystore-verified request headers (`api_key`); entries with `auth.type: none` are public | infrastructure, security, fleet tooling, proxy, observability |
| `0crawl` | `<slug>.0crawl.com` | Keystore-verified request headers | domains, recon, web analysis |
| `pages` | `*.github.io` / custom | none (static) | peer-to-peer and browser-only apps, productivity tools, games |
| `custom` | own domain | none | services outside the fleet apex domains |

The registry stores the bare values above; the `mesh-<name>` spelling is only
for GitHub topics and `service.yaml`.

Container meshes use the shared keystore. Send credentials only in the
`Authorization: Bearer` header or the supported `X-API-Key` header. Never put
keys in a URL path or query string.

### Axis 3 — `runtime` (how it's started)

| `runtime`     | What it means                                             |
|---------------|-----------------------------------------------------------|
| `compose`     | Default for `kind: container`. Docker-compose on the dockerhost; deploy = `docker compose pull && up -d` |
| `coolify`     | Deployed through the Coolify API; `fleet-runner deploy` dispatches to it instead of SSH + compose |
| `systemd`     | Reserved — a service unit on a host; deploy = `systemctl restart` |
| `binary`      | Reserved — a static binary run by hand or by a launcher    |
| `k8s`         | Reserved — managed by a kube manifest                      |
| `github-pages`| Default for `kind: static`. Built and served by GitHub Pages CI |
| `external`    | Runs outside the fleet; registered via `$external` so its port is claimed. `clone-missing` and gateway vhost rendering skip it |

`runtime` is orthogonal to `language`. A Go service might be `runtime: compose` today and `runtime: systemd` tomorrow without re-classifying it as a different language or kind. `fleet-runner deploy` dispatches on `runtime`.

### Axis 4 — `language` (primary implementation)

| `language` | When to use it                                                 |
|------------|----------------------------------------------------------------|
| `go`       | Default for `kind: container` in this fleet                    |
| `node`     | Node.js services (proxies, SERP scrapers, a few geo/OCR/NLP extractors) |
| `python`   | Python services (see `services.summary.txt` for the count)     |
| `c`        | C services (currently 1: `c-proxy`)                            |
| `rust`     | Reserved for future use                                        |
| `html`     | Default for `kind: static` — plain HTML/CSS/JS Pages sites     |
| `wasm`     | Static Pages site whose primary payload is a WASM binary       |
| `other`    | Anything that doesn't fit                                      |

Bulk verbs that take `--filter K=V[,K=V]` (for example
`fleet-runner update-dep --filter kind=container,language=go <module@version>`)
narrow the operation so a Go-only dep bump never touches a Node, Python, or
static service. Put all flags before `<module@version>`; `converge` has no
`--filter` flag.

In a service repo, look at its `service.yaml` (or its registry entry in
`services.json`) to see which axes apply.

## TRL — technology readiness level

Every `services.json` entry may carry a `trl` field 1–9:

| TRL | Band         | Meaning                                                              |
|-----|--------------|----------------------------------------------------------------------|
| 1–3 | toy          | single regex / no tests. Don't depend on it.                         |
| 4–5 | developing   | curated lists, multi-step logic, partial tests.                      |
| 6–7 | real         | RFC-compliant parsing, evidence trails, real test coverage.          |
| 8–9 | production   | battle-tested, cross-checks, SLA-grade.                              |

`trl_ceiling` marks services that **structurally cannot** advance
further (e.g. needs a browser engine, needs paid threat intel).
`trl_assessed_at` older than ~90 days is stale — re-audit.

<!-- anchor id=trl-cmdtrlreview repo=go_fleet_runner symbol=go:cmd_trl_review.go#cmdTRLReview verified=6bebc4351 digest=sha256:0e431989c33d02dd54e9a945f588319737fe7347bf55e93f8d553ac4e2fee26b on=2026-10-12 -->

## Key sibling repos

| Repo                  | Role                                                                                | Visibility |
|-----------------------|-------------------------------------------------------------------------------------|------------|
| `services-registry`   | canonical catalog (services.json + FLEET.md + this file)                            | PUBLIC     |
| `go-common`           | shared Go lib — SSRF-safe HTTP, jsbundle recovery, **apikey client**, ua, middleware | PUBLIC |
| `mesh-common`         | shared TS/React runtime for the `mesh-*` P2P fleet (see "mesh-* P2P fleet" below)   | PUBLIC     |
| `go-fleet-persona`    | cross-app + cross-origin display-identity service (`persona.0exec.com`)             | PRIVATE    |
| `go_apikey_service`   | **the keystore** — issues/verifies/revokes API keys for `mesh-0exec`                | PRIVATE    |
| `go-catalog-service`  | renders services.json into `catalog.0exec.com`                                      | PRIVATE    |
| `go_fleet_runner`     | CLI to operate the fleet (`health`, `smoke`, `inject`, `push`, …)                   | PRIVATE    |
| `0crawl-platform`     | bootstrap/reference IaC (certbot DNS-01 hooks, batch vhost-drift scripts, reference nginx templates; bootstrap/ and compose/ are README-only); its nginx templates are a diverged reference copy, the deployed templates are embedded in fleet-runner | PRIVATE |
| `fleet-state`         | live operational state, runbooks, SSH topology                                      | PRIVATE    |

## mesh-* P2P fleet — separate from the container fleet

The `mesh-*` repos under `baditaflorin/*` are a **distinct fleet** from the
0exec/0crawl container services described above. They are browser-only,
rootless WebRTC apps published as static GitHub Pages sites (`kind: static`,
`mesh: pages`). They do not have container images, ports, `/health`
endpoints, or keystore-gated auth.

Each app depends on **`@baditaflorin/mesh-common`** via `file:../mesh-common`
so the bundle is fully self-contained on every GH Pages deploy — no npm
publish step, no runtime dependency on a registry.

### `mesh-common` — shared runtime + drop-in components

Single source of truth for the look, feel, and capabilities of every
`mesh-*` app. Versioned via `package.json` and `CHANGELOG.md`; consumers
re-bundle on the next `npm run build`.

Headline primitives (see mesh-common `CHANGELOG.md` for the current version and exports):

| Module                        | What it does                                                                 |
|-------------------------------|------------------------------------------------------------------------------|
| `MeshShell`                   | App chrome: settings drawer + beacon; app bar with Invite/Settings buttons when `config.shellLayout` is set, else legacy text "Invite" button, ⚙ settings FAB and self-ref bar |
| `SettingsDrawer`              | Room id + signaling/TURN overrides; injection slot for per-app extras        |
| `createMeshConfig`            | One-call config factory (app name, accent, version, signaling/TURN defaults) |
| `useYRoom`                    | `{doc, provider, peerId, peerCount}` for a Yjs room over WebRTC              |
| `clockSync`                   | NTP-over-Yjs offset → mesh-median time (~10–30 ms stable)                    |
| `commitReveal`                | SHA-256 commit/reveal for anonymous votes, fair RNG, role assignment         |
| `identity` + `tofuRegistry`   | Ed25519 keypair + TOFU pinned-pubkey registry (per-room crypto identity)     |
| `moderator` + `ModeratorBadge`| Signed first-claim-wins role with 30-min auto-expire                         |
| `PersonalQR` / `QRExchange`   | Inline-SVG QR (real-URL payload) + camera scanner                            |
| `useAwareness`                | Typed wrapper around `y-protocols/awareness` (presence / cursors / typing)   |
| `PeerAvatar`                  | Deterministic SVG avatar from peerId / pubkey — zero network, zero PII       |
| `useTypedMap` / `useTypedArray` | Zod-validated `Y.Map` / `Y.Array` — hostile peers' writes filtered at the edge |
| `useRoomSeal` / `deriveRoomKey` | Room-wide AES-GCM seal via PBKDF2(passphrase, roomId) — opt-in E2E         |
| `MeshErrorBoundary`           | Drop-in crash containment for the `<Feature>` subtree                        |
| `useMeshLink`                 | Typed encoder/parser for the `#r=…&p=…&x=…` deep-link fragment               |
| `useMultiRoom`                | Run several Yjs rooms in one tab (facilitator dashboards, embeds, side-by-side) |
| `usePresenceCursors`          | Figma-style live cursors built on `useAwareness`                             |
| `useThreadedMessages`         | `Y.Map<msgId, {parent, body, by, at, sig}>` with `post()` / `reply()`        |
| `useReadReceipts`             | Per-peer monotone "last seen at message N"                                   |
| `useOfflineQueue`             | Buffer writes when isolated; replay through `flush()` on reconnect           |
| `useFileShare`                | Chunked file share through the Yjs transport                                 |
| `SafeMarkdown`                | `marked` Markdown; output filtered to a tag/attr allow-list (raw HTML is filtered, not rejected; link schemes are deny-listed) |
| `useFakeTime`                 | Test-only clock fixture; production collapses to `Date.now()`                |
| **`useFleetPersona`**         | **Cross-app + cross-origin display identity (nickname + name + avatar)**     |
| **`FleetAvatar`**             | **Drop-in avatar for the current fleet persona; reuses `PeerAvatar`**        |
| **`FleetIdentityPanel`**      | **Drop-in settings UI; auto-mounted inside `MeshShell` by default in 0.10.1+**|

### Fleet identity (`fleetPersona`) — three-tier resolver

`useFleetPersona({ appName, serviceUrl? })` resolves a `FleetPersona`
(`nickname + name + avatarSeed + avatarVariant + paletteIndex`) through
three tiers, falling back gracefully if any is unavailable:

| Tier | Where                       | Notes                                                                         |
|------|-----------------------------|-------------------------------------------------------------------------------|
| L0   | per-app `localStorage`      | Always wins once the user types something                                     |
| L1   | same-origin `localStorage`  | **Free** on GH Pages — every `mesh-*` app under `baditaflorin.github.io` shares one origin |
| L2   | `https://persona.0exec.com` | Optional cross-origin sync; 2 s fetch timeout; fire-and-forget; service-down → silent |

The L2 fetch never blocks the UI; if the service is down or slow, L0/L1
keep the user's identity intact. Writes from app code propagate down the
stack respecting the per-app `mode` setting (`off` / `local-fleet` /
`remote-fleet`).

Field validation: strict ASCII allowlist `^[A-Za-z0-9_\- .]{1,32}$` on
`nickname` and `name`, and `^[A-Za-z0-9_\-]{1,64}$` on `avatarSeed` —
identical on client and server, neutralises a class
of stored-XSS / homoglyph concerns. `anonId` and `writeToken` are
128-bit hex; `writeToken` is stored in `localStorage`
(`mesh-fleet:v1:writeToken`) and `ensureWriteToken` / `readWriteToken` are
exported from the package root, so any app on the origin can read it.

Cross-origin handoff: `fp.buildHandoffUrl(targetOrigin)` returns a URL
with `#fp=<base64>` that carries `anonId + writeToken + persona`. Open
on the new origin → `useFleetPersona` auto-consumes the fragment on
mount, wipes the hash from the URL, and the new origin has the same
identity. Works with `PersonalQR` for cross-device transfer.

`MeshShell` mounts `FleetIdentityPanel` inside the settings drawer by
default in mesh-common ≥ 0.10.1. Apps that want to opt out (kiosks,
apps that own their own identity flow) pass `fleetIdentityServiceUrl={null}`;
apps that want a staging endpoint pass their own URL.

### `go-fleet-persona` — companion service for L2 sync

Public URL: **`https://persona.0exec.com`** (canonical) and
`https://fleet-persona.0exec.com` (alias).

| Aspect            | Value                                                                          |
|-------------------|--------------------------------------------------------------------------------|
| Registry id       | `fleet-persona`                                                                |
| Mesh / kind / runtime | `0exec` / `container` / `compose`                                          |
| Port              | `18209` (host) → `18209` (container)                                           |
| Image             | `ghcr.io/baditaflorin/fleet-persona` (cosign-signed; tag pinned by `fleet-runner deploy`; the 2026-10-10 state snapshot records the running container on `:latest`) |
| Auth              | `none` — **public read by design**; writes argon2id-gated by client-held writeToken |
| Storage           | pure-Go SQLite (`modernc.org/sqlite`) on a single docker volume                |
| Tests             | `go test ./...` (unit + handler); `testing/smoke.sh` runs the full lifecycle end-to-end |

Wire surface (responses from `/v1/*` and `/selftest` use the go-common envelope `{ status, data }`):

```
GET    /v1/health                → 200 { status, data: { ok, ver, ts, ro } }
GET    /health                   → 200 { status: "ok", service, version }  (go-common default, not the envelope)
GET    /selftest                 → 200 { status, data: { ok, ver, checks[] } }  (200 = all green, 503 = any fail)
GET    /v1/persona/{anonId}      → 200 { status, data: { nickname, name, avatarSeed, avatarVariant, paletteIndex, updatedAt } } | 404
PUT    /v1/persona/{anonId}      → 204 (no body)   request: { …persona, writeToken }
DELETE /v1/persona/{anonId}      → 204 (no body)   request: { writeToken }
```

CORS is `*` by design — the read API is public; `anonId` itself is the
only read-secret (and display names are non-PII). Writes require a
separate 128-bit `writeToken` argon2id-hashed at rest.

Privacy stance: no IP addresses stored (only short-lived hashes in
rate-limit buckets, daily-rotated salt); no User-Agent / Referer / app
name kept; no mapping that lets the operator reconstruct which apps a
browser opens.

Rate limits: 60 reads/min/IP and 30 writes/hour/(IP, anonId) by default;
4 KB body cap; global read-only kill switch via the `READ_ONLY` env var.

### When building or auditing a `mesh-*` app

- `kind: static` — no Dockerfile, no `/health`, no keystore. The
  ⚙ FAB renders `SettingsDrawer` which auto-mounts `FleetIdentityPanel`
  on `mesh-common ≥ 0.10.1`. No per-app code needed to surface the panel.
- HTML/CSS/JS published from `docs/`. Build locally with `npm run build`;
  commit `docs/` and push. GH Pages serves it within ~1 min.
- Pre-commit hook (`.githooks/pre-commit`) runs `npm run fmt:check` and
  `npm run typecheck`; the pre-push hook adds `npm run smoke`
  (`bash scripts/smoke.sh`: vitest unit tests when present + `npm run build`
  + sanity-check of `docs/index.html`, `docs/404.html` and `docs/assets`).
  **Never `--no-verify`**; if a hook fails, run `npm run fmt` and re-commit.
- `useFleetPersona` is the canonical way to read/write the user's display
  name — never roll your own `myName` localStorage key for new apps.
  Existing apps can migrate at their own pace; the panel is opt-in for
  the user via the sync-mode radio.

## Inbound auth — container meshes

Container services with `auth.type: api_key` are gated by `go-apikey-service`
at the gateway; `auth.type: none` services are public by design and are not
gated. Use a keystore-issued key in the `Authorization: Bearer <key>` header;
clients that require the compatibility header may use `X-API-Key`. Keys in URL
paths are unsupported. `?api_key=` is still accepted by the gateway and by
go-common `ExtractToken` for compatibility, but do not use it: URLs are copied
into browser history, proxies, and logs.

The gateway verifies the key and forwards authenticated identity headers to
the service. Do not add a public fallback or accept a shared demo credential.
On invalid or unavailable verification, follow the service's fail-closed
behavior and the private fleet recovery runbook. The keystore health check and
fleet snapshot provide outage alerts; there is no static gateway bypass.

For direct service verification outside the gateway request path, use the
canonical Go Common client rather than hand-rolled HTTP calls:

```go
import "github.com/baditaflorin/go-common/apikey"
c := apikey.New() // APIKEY_SERVICE_URL and APIKEY_SERVICE_ADMIN_TOKEN
verifier := apikey.NewCache(c)
result, err := verifier.Verify(ctx, userKey)
```

The keystore admin token is stored as `ADMIN_TOKEN` on the keystore and read
by authorized clients through `APIKEY_SERVICE_ADMIN_TOKEN`. Keep it in the
approved secret store and follow the private rotation runbook.

### Outbound auth — service-to-service calls

The section above covers INBOUND keystore auth (how a service
authenticates its callers). For OUTBOUND auth — how a service
identifies itself when calling another fleet service — see
**[ADR-0027 — Fleet authentication canonical flow](docs/adr/0027-fleet-auth-canonical-flow.md)**.

In one line: the canonical bootstrap is
`fleet-runner key provision <slug>` (three separate steps, not atomic: issue
keystore key + write `/opt/services/<repo-dir>/.env` on dockerhost +
`docker compose up -d`; `<repo-dir>` is resolved from the registry and can
differ from `<slug>`; if a later step fails the issued key remains, so rerun it
or revoke the key with `fleet-runner key revoke`).
Audit at rest with `fleet-runner audit fleet-auth-scope` to find running
containers whose `FLEET_API_KEY` is unset or has an unrecognised prefix
(shape-only check; it does not verify scope).

Code-side guard: every service that does outbound calls to a fleet
sibling MUST use `apikey.MustResolveCritical(slug, "FLEET_API_KEY")`
in `main.go`. The binary fail-fast-exits if `FLEET_API_KEY` is missing or malformed,
surfacing configuration errors before a runtime request fails.

### Image tagging — every build pushes `:<short-sha>` + `:<version>` + `:latest`

`fleet-runner deploy` pins the dockerhost compose to
`ghcr.io/baditaflorin/<repo>:<short-sha>` (the git short sha of the
commit the binary was built from). `:<version>` and `:latest` still
get pushed for human-readable discoverability but production compose pins
`:<sha>` (a failed-smoke rollback temporarily pins `:rollback`, and
`deploy-authorized` pins by digest). Drift detection reduces to "does the pin
match origin/main HEAD" — see
**[ADR-0028 — Image tagging + version-bump policy](docs/adr/0028-image-tagging-and-version-bump-policy.md)**.

Legacy `:latest` / `:<semver>` pins on the dockerhost are auto-migrated
to `:<sha>` on the next `fleet-runner deploy <slug>` invocation, so
existing services flip over organically as they get touched.

## `go-common` packages — use these, don't reinvent

| Package      | Import path                                       | Purpose                                                 |
|--------------|---------------------------------------------------|---------------------------------------------------------|
| safehttp     | `github.com/baditaflorin/go-common/safehttp`      | SSRF-safe HTTP client, DNS-rebind guard                 |
| ua           | `github.com/baditaflorin/go-common/ua`            | Standard User-Agent builder                             |
| jsbundle     | `github.com/baditaflorin/go-common/jsbundle`      | source-map recovery for scanning JS bundles             |
| apikey       | `github.com/baditaflorin/go-common/apikey`        | keystore client (`Verify`, `Cache`, admin endpoints)    |
| middleware   | `github.com/baditaflorin/go-common/middleware`    | `TokenAuthKeystore` HTTP middleware (≥ v0.7.0)          |
| loadshed     | `github.com/baditaflorin/go-common/loadshed`      | non-blocking concurrency gate: cap calls to a slow upstream, fast-503 the excess (`loadshed_shed_total`) (≥ v0.65.0) |
| agent        | `github.com/baditaflorin/go-common/agent`         | machine-readable "agent contract" a service advertises so AI agents can call it correctly |
| backoffcoord | `github.com/baditaflorin/go-common/backoffcoord`  | distributed backoff coordinator client; consult before retrying a failed upstream |
| bootgate     | `github.com/baditaflorin/go-common/bootgate`      | opt-in boot-time gate: spreads a first heavy cycle out in time and backs off while the host is overloaded |
| browserheaders | `github.com/baditaflorin/go-common/browserheaders` | coherent browser-typical HTTP headers for outbound calls that must pass trivial bot detection |
| cache        | `github.com/baditaflorin/go-common/cache`         | generic, concurrency-safe LRU+TTL cache                 |
| cgroup       | `github.com/baditaflorin/go-common/cgroup`        | resource counters and limits for the current Linux cgroup |
| circuitbreaker | `github.com/baditaflorin/go-common/circuitbreaker` | in-process circuit breaker per (service, upstream): closed → open → half-open, with `Allow`/`Success`/`Failure` and an observer hook |
| client       | `github.com/baditaflorin/go-common/client`        | low-level HTTP client abstractions (capability negotiation, URL proxying helpers); prefer `safehttp.NewClient` |
| clock        | `github.com/baditaflorin/go-common/clock`         | `Clock` interface with real and controllable mock implementations |
| config       | `github.com/baditaflorin/go-common/config`        | loads service configuration from `service.yaml` and environment variables |
| credentiallease | `github.com/baditaflorin/go-common/credentiallease` | task-bound client for a credential broker               |
| credentiallease/broker | `github.com/baditaflorin/go-common/credentiallease/broker` | fail-closed HTTP core for credentiallease v1 broker deployments |
| dataformat   | `github.com/baditaflorin/go-common/dataformat`    | conversion between JSON, CSV, XML, YAML and TOML        |
| dbx          | `github.com/baditaflorin/go-common/dbx`           | context-aware database entry point: instrumented pgx `database/sql`, native `pgxpool` |
| degraded     | `github.com/baditaflorin/go-common/degraded`      | accumulates degradation reasons for the request into the response envelope `degraded` array |
| depcheck     | `github.com/baditaflorin/go-common/depcheck`      | registry of named health probes included in the `/health` JSON |
| deploymentauthorization | `github.com/baditaflorin/go-common/deploymentauthorization` | signed deployment-decision contract shared by the authority and fleet runner |
| deploymentintent | `github.com/baditaflorin/go-common/deploymentintent` | versioned deployment intent exchanged by deployment control-plane components |
| deploymentlease | `github.com/baditaflorin/go-common/deploymentlease` | fail-closed client for the Fleet Deployment Authority mTLS authorization and target-lease API |
| env          | `github.com/baditaflorin/go-common/env`           | typed helpers for reading environment variables with defaults or required-or-fatal semantics |
| errors       | `github.com/baditaflorin/go-common/errors`        | typed `Error` with HTTP status, stable error code, message and cause |
| fleetfetch   | `github.com/baditaflorin/go-common/fleetfetch`    | caller-side client for the fleet-wide HTTP fetch cache  |
| graph        | `github.com/baditaflorin/go-common/graph`         | instruments service-to-service calls and emits them to go-fleet-graph |
| header       | `github.com/baditaflorin/go-common/header`        | canonical HTTP header name constants                    |
| ledger       | `github.com/baditaflorin/go-common/ledger`        | client for the fleet token ledger: charge the caller's own balance before expensive work |
| meshresult   | `github.com/baditaflorin/go-common/meshresult`    | canonical classification of an enricher result plus its HTTP-status mapping |
| metrics      | `github.com/baditaflorin/go-common/metrics`       | in-process request statistics collector served at `/metrics/json` |
| nullify      | `github.com/baditaflorin/go-common/nullify`       | `StringOrNil`: store NULL instead of placeholder strings such as "unknown" in verdict columns |
| obs          | `github.com/baditaflorin/go-common/obs`           | localhost-only pprof + `/metrics` debug server and Go runtime/process Prometheus collectors |
| openapi      | `github.com/baditaflorin/go-common/openapi`       | types and helpers for building the OpenAPI 3.0.3 document served at `/openapi.json` |
| pagination   | `github.com/baditaflorin/go-common/pagination`    | canonical cursor-based and offset-based paginated response types |
| pentest      | `github.com/baditaflorin/go-common/pentest`       | security-testing helpers: bounded-concurrency worker pool and result aggregator |
| profiling    | `github.com/baditaflorin/go-common/profiling`     | opt-in continuous profiling through Grafana Pyroscope   |
| promx        | `github.com/baditaflorin/go-common/promx`         | fleet-wide Prometheus collectors and the single-call `AutoWire` |
| proxysupplier | `github.com/baditaflorin/go-common/proxysupplier` | resolves the upstream egress-proxy URL for outbound HTTP (`PROXY_SUPPLIER`) |
| qrterm       | `github.com/baditaflorin/go-common/qrterm`        | turns a URL, id or token into a terminal QR code or a PNG |
| ratecoord    | `github.com/baditaflorin/go-common/ratecoord`     | distributed rate-limit coordination client              |
| reqstats     | `github.com/baditaflorin/go-common/reqstats`      | per-request resource stats in `Server-Timing` and `X-Request-Stats` headers |
| response     | `github.com/baditaflorin/go-common/response`      | canonical fleet JSON response envelope                  |
| retry        | `github.com/baditaflorin/go-common/retry`         | context-aware retry with configurable backoff (exponential, full jitter) |
| runtimetune  | `github.com/baditaflorin/go-common/runtimetune`   | container-aware Go runtime memory/GC tuning at process start |
| secrets      | `github.com/baditaflorin/go-common/secrets`       | client for the go-fleet-secrets vault (`GET /secrets/<name>`) |
| server       | `github.com/baditaflorin/go-common/server`        | canonical fleet HTTP server bootstrap                   |
| shutdown     | `github.com/baditaflorin/go-common/shutdown`      | single-call graceful shutdown for `net/http` servers    |
| spiffe       | `github.com/baditaflorin/go-common/spiffe`        | adapts the SPIFFE Workload API to credentiallease identities |
| telemetry    | `github.com/baditaflorin/go-common/telemetry`     | W3C trace propagation, HTTP spans and OTLP/HTTP export  |
| testhelpers/fakeexec | `github.com/baditaflorin/go-common/testhelpers/fakeexec` | in-memory fake for the command-runner seam used to shell out to git / go / docker |
| testhelpers/fakegraph | `github.com/baditaflorin/go-common/testhelpers/fakegraph` | captures `graph.Event` values in tests                  |
| testhelpers/fakekey | `github.com/baditaflorin/go-common/testhelpers/fakekey` | in-memory `apikey.Verifier` for tests                   |
| testhelpers/httpmock | `github.com/baditaflorin/go-common/testhelpers/httpmock` | canonical `httptest.Server` factories for common upstream patterns |
| testhelpers/testclock | `github.com/baditaflorin/go-common/testhelpers/testclock` | thin re-export of `clock.NewMock` and `clock.Mock` for tests |
| validate     | `github.com/baditaflorin/go-common/validate`      | struct-tag-driven JSON request decoding and validation  |
| version      | `github.com/baditaflorin/go-common/version`       | build identity variables injected via `-ldflags`        |
| wordbound    | `github.com/baditaflorin/go-common/wordbound`     | Unicode-aware word-boundary helpers (Go regexp `\b` is ASCII-only) |
| workpool     | `github.com/baditaflorin/go-common/workpool`      | bounded-concurrency worker pool                         |

```go
import (
    "github.com/baditaflorin/go-common/safehttp"
    "github.com/baditaflorin/go-common/ua"
)
client := safehttp.NewClient(
    safehttp.WithTimeout(10*time.Second),
    safehttp.WithUserAgent(ua.Build(ServiceID, Version)),
    // v0.16.0+ : auto-emit traces, auto-consult backoff, auto-tag degraded[]
    safehttp.WithTraceCollector(os.Getenv("CALL_TRACER_URL")),
    safehttp.WithBackoffCoordinator(os.Getenv("BACKOFF_COORDINATOR_URL")),
    safehttp.WithDegradedSink(&degraded),
)
// Errors: safehttp.ErrBlocked, safehttp.ErrInvalidScheme, safehttp.ErrMissingHost
u, err := safehttp.NormalizeURL(rawInput)
```

**safehttp is for OUTBOUND (public-internet) HTTP only.** Calls to sibling
fleet services on the private docker mesh (`http://go-fleet-*:<port>` /
`http://<slug>:<port>`) MUST use a plain `net/http.Client`, NOT safehttp
— the SSRF guard correctly rejects private IPs and will return
`safehttp.ErrBlocked` immediately. Use a short timeout (1-3s),
fail-open semantics, and append `"<primitive>-down"` to a per-request
`degraded []string` slice on env-unset / timeout / 5xx. Surface
`degraded[]` in the response JSON envelope. Confirmed pattern across
every Phase 3 consumer migration (2026-05-17, ADR-0024) — every agent
that tried safehttp for intra-mesh calls hit ErrBlocked and pivoted to
plain `http.Client`.

**Selftest and policy rule engines also live in `go-common`** (v0.17.0+ /
v0.18.0+):

| Package    | Import path                                      | Purpose                                                |
|------------|--------------------------------------------------|--------------------------------------------------------|
| selftest   | `github.com/baditaflorin/go-common/selftest`     | Canonical `/selftest` suite consumed by go-fleet-selftest-aggregator |
| policyeval | `github.com/baditaflorin/go-common/policyeval`   | Small in-Go rule DSL: `Evaluate(rules []Rule, fact Fact) (Result, error)`, where `Result` carries `Decision`, `Matched` and `Explanation` — replaces ~5 custom rule engines |

## Service conventions (required for fleet-runner compatibility)

- **Port**: from `PORT` env; fallback to a build-time constant; must
  match `service.yaml`, compose, and `deploy.yaml`.
- **Health**: `GET /health` → `{"status":"ok","service":"<id>","version":"<ver>"}`.
- **Version**: `GET /version` → `{"version":"<ver>"}`.
- **Metrics**: `GET /metrics` (Prometheus).
- **Gateway health**: `GET /_gw_health` is added by the nginx
  template, not by the service — don't re-implement.
- **User-Agent**: `ua.Build(ServiceID, Version)`.
- **Docker image**: `ghcr.io/baditaflorin/<id>:<version>` (no `v`
  prefix on the tag).
- **Tagging**: `fleet-runner bump-version <repo> <patch|minor|major> --push`
  commits, creates `git tag <version>` (no `v` prefix), e.g. `1.2.3`, and
  pushes it; without `--push` it only edits files and prints the `git tag`
  command to run. Some service repos (go-fleet-metrics-hub, go-proxy,
  go-fleet-build-broker) also or only use `v<version>` tags; the image tag
  and `service.yaml` `version` stay without `v`.
- **service.yaml** must keep: `id`, `name`, `version`, `port`,
  `category`, `health` block, `test` block.

## `overrides.json` — per-service patches and bulk rules

The catalog is `services.json` (auto-derived). Per-service hand-curated
patches live in `services-registry/overrides.json`. Four shapes coexist:

**Per-slug patches** (current shape, unchanged):
```json
{
  "python-proxy": { "proxy_read_timeout": "300s", "trl": 6 },
  "kokoro-ovms-adapter": { "vhost": { "proxy_buffering": "off" } }
}
```

**Per-slug container resource caps** (`cpus`, `mem_limit`, `pids_limit`).
The fleet-wide backstop lives in `host-conventions.yaml`
(`container_defaults`, default `cpus: 2.0` / `mem_limit: "1g"` /
`pids_limit: 512`). Heavy/browser services raise them per-slug in
`overrides.json`, which **wins over** `mesh_defaults` and
`container_defaults` (precedence rule #4):

```json
{
  "infrastructure-fetch-cache": { "cpus": 4.0, "mem_limit": "3g" },
  "html-proxy":                 { "cpus": 8,   "mem_limit": "8g", "pids_limit": 2048 }
}
```

`cpus` is a number (e.g. `4` or `4.0`); `mem_limit` is a docker size
string (e.g. `"3g"`). These are honored by `fleet-runner render-compose`
(and `deploy --render-compose`) **only with fleet-runner ≥ the version
from go_fleet_runner PR #82** — earlier binaries silently rendered the
`host-conventions.yaml` default. A service that hand-maintains its own
caps in its base `docker-compose.yml` opts OUT of overlay injection with
`"compose_self_managed": true`.

For a service whose published ports must stay private to its cluster's Dockerhost,
set `"compose_bind_to_gateway_upstream": true` in its per-slug override. The
renderer resolves the address from private cluster configuration; do not put an
internal IP in this public repository. An explicit `render-compose
--bind-address` still overrides the per-service setting for that invocation.

> **Operational gotcha:** a live `docker update --cpus N` on a running
> container **reverts** to the rendered value on the next
> `render-compose` / `deploy` unless the per-slug `cpus` override is set
> in `overrides.json`. Declare the cap there to make it durable.

**Bulk rules** (reserved `$rules` key, since 2026-05-14):
```json
{
  "$rules": [
    {
      "name": "wildcard-cert-0crawl",
      "match": { "mesh": "0crawl" },
      "patch": { "cert_domain": "wildcard.0crawl.com" },
      "why":   "All *.0crawl.com vhosts share the wildcard cert"
    }
  ]
}
```

Match clauses: any of `ids` (explicit list), `mesh`, `kind`, `language`,
`runtime`, `category` — combined with all-of semantics. Rules apply in
declaration order; per-slug entries win. Use rules to encode "every
*.0crawl.com service shares this cert_domain" as one rule instead of one
entry per service.

**Multi-service repos** (via reserved `$expand` key) — one GitHub repo
emits N catalog entries when a compose project ships multiple
independently-addressable services (different host_ports, different
`*.<mesh>.com` hostnames) inside one repo. Each child gets its own
slug + url + host_port; `$rules` and per-slug overrides re-apply on
top. The parent's topic-derived entry is dropped iff
`replace_parent: true`. When the children later split into their own
repos with their own `mesh-*` topics, drop the `$expand` entry and
the per-repo topic-derived entries take over with the same slugs.

```json
{
  "$expand": [
    {
      "name": "go-fleet-metrics-hub-children",
      "parent_repo": "go-fleet-metrics-hub",
      "replace_parent": true,
      "children": [
        { "id": "fleet-discovery",  "host_port": 18201, "container_port": 18203, "category": "observability" },
        { "id": "fleet-grafana",    "host_port": 18202, "container_port": 3000,  "category": "observability" },
        { "id": "fleet-prometheus", "host_port": 18203, "container_port": 18203, "category": "observability" }
      ],
      "why": "one compose project, several host_ports — register all so allocate-port sees them"
    }
  ]
}
```

**External / third-party containers** (via reserved `$external` key) —
third-party upstream containers (Plausible, …) that run on the
dockerhost but are NOT in the fleet repo set: no `mesh-*` GitHub
topic for the generator to latch onto, no fleet-runner ownership of
the compose file. Without a registry row their `host_port` is
invisible to `allocate-port` — and the next deploy will silently
re-claim it (the 2026-05-19 plausible incident). One row here keeps
the allocator honest. Defaults to `runtime: external`, which
`clone-missing` and `nginx-render` skip. `fleet-runner deploy` (including
its build step) has no `external` gate, so never run it against an
`$external` slug. `$rules` are NOT applied to `$external` entries (fleet
knobs like `cert_domain` / `proxy_egress` have no meaning for an
upstream-managed container). See ADR-0031.

```json
{
  "$external": [
    {
      "id": "plausible",
      "name": "Plausible Analytics",
      "host_port": 18204,
      "container_port": 8000,
      "repo_url": "https://github.com/plausible/community-edition",
      "auth": { "type": "none" },
      "external_compose_dir": "/opt/services/plausible/",
      "external_image": "ghcr.io/plausible/community-edition:v3.2.1",
      "why": "fleet-pixel's optional upstream; runs at /opt/services/plausible/ — register so allocate-port sees 18204 as taken"
    }
  ]
}
```

<!-- anchor id=external-registry-entries-external-0-externa repo=services-registry symbol=json:overrides.json#/$external/0/external_image verified=e08695528 digest=sha256:805c93ff45d59c082bfc5091c6952f1509d570112df0ae00025f5b21299bbf36 on=2026-10-12 -->
<!-- anchor id=port-allocation-external-0-host-port repo=services-registry symbol=json:overrides.json#/$external/0/host_port verified=e08695528 digest=sha256:dcacdef7c85b353596110dc1c6981acca45e795993db25004de80ec851f16503 on=2026-10-12 -->

**Audit surface** — never grep overrides by hand:

```
fleet-runner overrides list   [--filter mesh=0crawl] [--key cert_domain]
fleet-runner overrides explain <slug>      # full breakdown per key + source
fleet-runner overrides audit                # stale slugs, unused rules, key adoption counts
```

<!-- anchor id=overrides-audit-surface-overrides repo=go_fleet_runner symbol=verb:overrides verified=6bebc4351 digest=sha256:3ccb1bbb2d4117a7ed0b687018199c778b18c21ea513ca6c7862a22483254627 on=2026-10-12 -->

`fleet-runner converge` also surfaces overrides drift (stale per-slug
entries that reference removed services; rules with no matching
service).

## fleet-runner

Binary at `/usr/local/bin/fleet-runner` on **Builder LXC 108**. From
any workspace dir on that LXC:

```
fleet-runner health [--insecure]             # GET health_url of every service the services-dashboard API lists (no kind filter)
fleet-runner smoke  [--insecure]             # GET example_url of every service the services-dashboard API lists that has one
fleet-runner pages-audit                     # verify pages_url 200s for every kind=static entry
fleet-runner build-test                      # go test ./... in every kind=container,language=go workspace
fleet-runner update-dep <mod@ver>            # bump dep across all language=go repos (or a subset: --repos a,b / --filter mesh=…,category=…,ids=a;b)
fleet-runner rollout --dep <mod@ver> [--grep REGEX] [--graph-callers-of S,…] [--depends-on S,…] [--clone] [--apply [--pr]]  # blast-radius: discover EVERY affected service (grep ∪ graph ∪ depends_on), bump + build/test, land only the green (plan-only by default)
fleet-runner deploy-all                       # redeploy a filtered set (--repos a,b / --mesh / --framework); skips repos listed in excludes.json (name-collision repos, not an infra guard)
fleet-runner inject <src> <dest>             # copy a file into every repo (still all kinds, on purpose)
fleet-runner exec   "<cmd>"                  # shell command in every repo (no filter; always all repos incl. tooling)
fleet-runner push   "<msg>"                  # commit+push all dirty repos
fleet-runner nginx-render                    # regenerate vhosts from templates
fleet-runner overrides list                  # per service, which override keys apply (and via which rule)
fleet-runner overrides explain <slug>        # one service: every override key and its source (slug vs rule)
fleet-runner overrides audit                 # stale per-slug entries, unused rules, per-key adoption counts
fleet-runner new-service <name> <port> [cat] # scaffold new service
fleet-runner scaffold-compose <repo>...      # write canonical docker-compose.yml from registry (--apply [--commit --push] | --missing for every container repo lacking one)
fleet-runner scaffold-service-yaml <repo>... # write canonical service.yaml from registry
fleet-runner render-compose [<service-id>]   # render docker-compose.override.yml from host-conventions + overrides into --out (default /tmp/fleet-compose-render) and preview the first 3; --diff/--push/--restart act on the dockerhost. For a canonical docker-compose.yml preview use scaffold-compose <repo> (dry-run by default)
fleet-runner audit compose-drift             # surface compose files diverging from the canonical fleet shape
fleet-runner audit registry-host-port-set    # services without a registered host_port (silent squatter discovery)
fleet-runner audit orphaned-listeners        # SSH to the dockerhost, diff live `ss -tlnp` listeners against registered host_ports (v0.7.36+; --json goes AFTER the subcommand name, same as compose-drift)
fleet-runner stats                           # audit log + token usage summary
```

<!-- anchor id=fleet-runner-verbs-health repo=go_fleet_runner symbol=verb:health verified=6bebc4351 digest=sha256:24e024c191e54f6cd107d1debc945163ed3b485d9bfebdeaf5fb15dee68f80cb on=2026-10-12 -->
<!-- anchor id=bootstrap-compose-scaffold-compose repo=go_fleet_runner symbol=verb:scaffold-compose verified=101e9fb9f digest=sha256:22ed1710cf05923377e67ccb33ec2b670dc02eddd9487f6bbfd18e26734e81f1 on=2026-10-14 -->

`new-service` does not set GitHub topics. `bin/generate.py` registers a repo
only with a `mesh-<mesh>` topic, and also reads `lang-<x>` (defaults to go on
container meshes) and `category-<cat>`:
`gh repo edit --add-topic mesh-0crawl --add-topic lang-go --add-topic category-<cat>`.

**Bootstrap a service that's missing its compose at HEAD** — the canonical
two-liner (replaces hand-rolled `cat > docker-compose.yml` heredocs that
got the shape wrong in the past):

```bash
fleet-runner scaffold-compose --apply --commit --push <repo>   # flags BEFORE the repo
fleet-runner deploy <repo> --bootstrap --force-build --skip-smoke
```

`scaffold-compose --missing` will find every container repo without a
compose at HEAD and render one for each in a single pass.

`update-dep`, `rollout`, `overrides list`, `audit` and the registry-driven
sweep verbs (`sed`, `shape`, `template`) accept
`--filter kind=container,language=go` (and so on) to narrow the set;
`health`, `smoke`, `build-test`, `exec`, `inject`, `push`, `deploy-all` and
`scaffold-*` do not. The filter axes are `mesh`, `kind`, `language`,
`category`, and `ids` (the surgical "just these repos" axis — list
members separated by `;` since commas separate `k=v` pairs). For
`update-dep` and `deploy-all` there's also a dedicated `--repos a,b,c`
convenience flag (accepts registry ids OR workspace dir names). So a
two-repo dep bump no longer needs hand-edits:
`fleet-runner update-dep --push --repos go_foo,go_bar <mod@ver>`.
`update-dep` keeps Kind=container + Language=go defaults, so a targeted
bump never reaches a static/non-Go repo, and the exclude list always
wins over an explicitly-named repo (excludes.json lists only
name-collision repos; the keystore is not in it). Only `health`, `smoke`,
`build-test`, `update-dep`, `exec`, `inject`, `push` and `pages-audit`
(plus `ai-context`, `dep-cve`, `e2e`, `export-collection`, `tokens`)
accept `--tokens-used N --model NAME` for LLM accounting. **`kind: static`
entries are skipped by default by `build-test`, `update-dep`, `rollout`
and `scaffold-*`**; `deploy-all`, `exec`, `inject` and `push` do not
filter by kind — don't deploy-all or health-check a static Pages site
(use `pages-audit`).

<!-- anchor id=static-skip-gomoddirsfiltered repo=go_fleet_runner symbol=go:main.go#goModDirsFiltered verified=6bebc4351 digest=sha256:812d05fe33bb54ea47a6380d38259fde77c078f14ac544eca92648e64d806460 on=2026-10-12 -->

### All fleet-runner verbs (generated)

Generated from the dispatch switch in `go_fleet_runner/main.go`; `fleet-runner --help` lists fewer. Do not edit by hand.

<!-- BEGIN GENERATED:verbs repo=go_fleet_runner -->
_120 verbs, generated from the dispatch switch in `go_fleet_runner/main.go`; do not edit by hand._

`ai-context`, `allocate-port`, `astedit`, `astgrep`, `audit`, `audit-callers`, `audit-graph`, `audit-log`, `batch`, `branch`, `broker-canary`, `build-test`, `builder-pool`, `bump-version`, `canary-inventory`, `capacity`, `capacity-report`, `cert`, `change-receipts`, `changelog`, `classify`, `clone-missing`, `compose-heal`, `compose-image-heal`, `compose-port-prep`, `compose-ports-strip`, `compute-attribution`, `converge`, `coolify`, `ctx`, `cve-history`, `cve-root-cause`, `dep-cve`, `dep-cve-merge`, `depgraph`, `deploy`, `deploy-all`, `deploy-authorized`, `deploy-debt`, `deploy-pool`, `deps`, `diagram`, `digest`, `disk-report`, `dns-heal`, `drift`, `e2e`, `exec`, `explain`, `export-collection`, `fleetfetch-migrate`, `forecast`, `gateway-health`, `git-traffic`, `graph-context`, `grep`, `health`, `horizon`, `hosts-sync`, `image-gc`, `inject`, `install-fleet-access-log-conf`, `install-verify-cache-conf`, `intent`, `investigate-url`, `key`, `loadtest`, `mirror-clone`, `mirror-fetch`, `new-service`, `nginx-drift-audit`, `nginx-render`, `overrides`, `pages-audit`, `placement-check`, `placement-plan`, `playbook`, `pool-guardian`, `pool-metrics-targets`, `pool-plan`, `pool-status`, `port-heal`, `prs`, `publish-image`, `push`, `real-data-loops`, `remediate`, `render-compose`, `replay`, `rollout`, `scaffold-compose`, `scaffold-service-yaml`, `scanopy`, `scanopy-audit`, `scanopy-mcp`, `sed`, `select`, `session-summary`, `shape`, `smoke`, `spiffe-audit`, `spiffe-entries`, `split`, `stage`, `stage-batch`, `stash`, `state`, `stats`, `sweep-rollback`, `sync-deps`, `template`, `tokens`, `trl-review`, `update-dep`, `verify-image`, `whois`, `why`, `woodpecker`, `worktree-audit`, `worktree-prune`
<!-- END GENERATED:verbs -->

## Infrastructure topology

| Target          | SSH                                                            |
|-----------------|----------------------------------------------------------------|
| Bastion         | `ssh root@0docker.com`                                         |
| Builder LXC 108 | `ssh root@0docker.com 'pct exec 108 -- bash -lc "<cmd>"'`      |
| Dockerhost VM   | `ssh -J root@0docker.com ubuntu_vm@10.10.10.20`                |
| Webgateway      | `ssh -J root@0docker.com florin@10.10.10.10`                   |

- **Builder LXC 108** is a Proxmox container on `0docker.com`. Hosts
  per-service build workspaces at `/root/workspace/<repo>/`, the
  `fleet-runner` binary, and (pilot, ADR-0035) Woodpecker CI
  server+agent at `/opt/woodpecker/` — `docker compose ps` there to
  check status; `.env` holds the generated secrets, not committed
  anywhere.

  **AI-agent rule — always use a git worktree, never the shared
  workspace directly.** Multiple AI sessions (or a session + a human)
  routinely target the same repo concurrently; sharing
  `/root/workspace/<repo>/` produces silent races (one session's
  `git checkout`/`reset --hard` clobbers the other's working tree
  mid-build, image tags get pushed in the wrong order, deploys flip
  to the loser's commit). Each session must isolate its checkout:

  ```
  cd /root/workspace/<repo>
  git fetch origin
  git worktree add /root/wt/<repo>-<short-purpose> origin/<branch>
  cd /root/wt/<repo>-<short-purpose>
  # do work, build, push, then:
  git worktree remove /root/wt/<repo>-<short-purpose>
  ```

  Worktrees share the same `.git` (cheap; no extra clone), but each
  has its own `HEAD`, working tree, and `git status`. The shared
  `/root/workspace/<repo>/` stays as the canonical "long-lived
  upstream tracker" — operate on it only for read-only inspection
  (`git log`, `git diff`); never `checkout` / `reset` there.

  Build images from inside the worktree with the same
  `docker buildx build --platform linux/amd64 --provenance=false …`
  command; tag with a short purpose suffix (e.g.
  `1.6.172-postmerge`, `1.6.171-traits-pr9c`) so concurrent builds
  don't trample one canonical tag. Remove the worktree on exit so
  Builder LXC disk doesn't accumulate stale checkouts.

  **AI-agent rule — pull often, push often. Never trust the
  working-tree state as truth.** The shared workspace is converged
  to `origin` hourly by `repo-converge.timer` on Builder LXC 108
  (checkouts with active work, unpushed commits or a detached HEAD
  are skipped), so HEADs are usually fresh, but a skipped checkout
  can still lag `origin/main`. Three
  failure modes a stale checkout causes, all observed live 2026-05-16:

  1. **Wrong-direction drift detection.** Reading
     `/root/workspace/<repo>/service.yaml` as "the intended
     version" surfaces a months-old version string and triggers a
     rebuild that would ship the wrong code if the build worktree
     weren't separately on `origin/main`.
  2. **False triage rabbit holes.** A "broken" repo per
     `fleet-runner build-test` is often just stale workspace state
     — `origin/main` is already green because a parallel agent
     pushed the fix you can't see. PRs get opened against problems
     that don't exist; obsolete-on-arrival.
  3. **Concurrent agents overwriting each other.** Holding commits
     locally invites another session landing a competing fix; both
     branches diverge invisibly until one stomps the other.

  The hard rules:

  - **Before reading any repo state** (`service.yaml`, source,
    tests, `go.mod`): `cd /root/workspace/<repo> && git fetch
    origin --tags` first. Then read via `git show origin/main:<file>`
    or a fresh `git worktree add ... origin/main`. Never the
    working-tree file directly.
  - **Before triaging a "broken" repo**: re-run the failure against
    a fresh `origin/main` worktree. If green, the workspace is
    stale, not the code. Stop and verify before opening a PR.
  - **Push every commit immediately.** `git commit && git push`
    is one breath. Holding commits locally is what enables the
    concurrent-collision class above.
  - **Fleet-runner subcommands that read workspace state** (deploy,
    audit, etc.) must `git fetch origin` first and read via
    `git show origin/main:<path>`. `readRepoServiceYAML` in
    `go_fleet_runner/deploy_workspace.go` is the canonical example.
  - **`fleet-runner build-test` is currently NOT freshness-correct**
    — it runs against the working tree. Treat its output as a
    lower bound, not authoritative; confirm any "failure" against
    a fresh worktree before triaging.
- **Dockerhost VM** runs the service containers. Compose dirs:
  `/opt/services/<repo>/`, `/opt/security/<repo>/`,
  `/home/ubuntu_vm/pentest/<repo>/`.
- **OpenObserve VM 630 on 0own** is the current fleet log aggregator and
  uses `https://openobserve.0own.com`; traces enter through
  `https://otlp.0exec.com`. The former 0docker CT 106 is absent from the
  live host. Its PBS snapshots are being recovered for historical data
  validation; do not treat old CT references as a live rollback endpoint.
  Credentials are ingestion-only secrets from `go-fleet-secrets`; never
  place them in a service repo or reuse the root credential for senders.
  Retention and stream coverage must be verified on VM 630 before pruning
  old snapshots.

<!-- anchor id=rule-zero-worktrees-build-test repo=go_fleet_runner symbol=verb:build-test verified=6bebc4351 digest=sha256:48d16ff7ed1f442a4e042868920a42f36a6313ad59abafd2166901e5f5f1121a on=2026-10-12 -->

  **Query it with `bin/oo`, not hand-rolled curl.** `services-registry/bin/oo`
  is the deterministic CLI (`logs`, `grep`, `errors`, `since-redeploy`,
  `context`, `compare`, `restarts`, `rate`, `versions`, `new`, `check`,
  `save`/`saved`/`run`, `summary`, `link`, `containers`, `hosts`, `tail`,
  `query`, `streams`, `stream-info`) — run `bin/oo` with no args for full
  usage rather than duplicating it here; the script's own header comment
  is the source of truth for what each command does and its defaults, and
  this list will drift if a command gets added/renamed without this line
  being touched too. Needs `OPENOBSERVE_USER` / `OPENOBSERVE_PASSWORD` /
  `OPENOBSERVE_URL` set (see `bin/fleet-runner.env.example`; obtain
  `OPENOBSERVE_USER` / `OPENOBSERVE_PASSWORD` from the approved protected
  credential path described in private `fleet-state/OPS.md`; never commit them
  to any repo). Proxies every request through the bastion via
  SSH to `https://openobserve.0own.com`. `query`/`run` default to compact JSON with OpenObserve's own
  response metadata stripped (pass `--pretty` for indented + full
  metadata) — the other commands print plain text (except `stream-info`,
  which prints the stream schema as JSON). Every user-supplied value going into a WHERE clause is
  SQL-escaped (`sql_escape` in the script) and every search request
  normalizes failures into a consistent, non-silent error shape (`_oo_error`
  — never a raw traceback, never indistinguishable from "zero results";
  `streams` / `stream-info` handle failures themselves) — copy
  both patterns if you add a new command that talks to OpenObserve.

  **Check `bin/oo streams` and host coverage before relying on a stream.**
  The active 0own instance returned `Search stream not found: default` on
  2026-10-07, so do not assume host/journald logs are available. `docker_logs`
  contains container stdout/stderr only for hosts with a running shipper,
  tagged `container_name` / `host` / `image` / compose labels. Missing rows
  are not evidence of zero activity or a clean soak. `docker logs` and the
  `json-file` driver are unchanged; centralized collection is a second,
  independent path.

  **How `docker_logs` gets populated**: a small Vector (`timberio/vector`,
  pinned by digest) container named `vector-log-shipper` runs at
  `/opt/observability/vector-log-shipper/` on enrolled Docker hosts. The
  GitHub email runner host was a verified coverage gap on 2026-10-07: five
  containers were running, no shipper was present, and authenticated search
  found no host records in the checked window. It reads container logs via the
  Docker socket — the same
  read path `docker logs` uses — and ships a copy to the single central
  OpenObserve instance; it does not touch each container's own logging driver
  or config, so nothing about existing services changes, and no per-service
  compose edits are needed. New containers are picked up automatically. The
  0mcp fleet reaches the same instance through its public TLS endpoint because
  its private LAN is independent. See `docs/observability/CENTRAL-OPENOBSERVE.md`
  for the host contract, disk buffering, and rollout procedure. **Gotcha found
  wiring this up**: Vector 0.57.0's `${VAR}` env-var interpolation does
  not reliably substitute inside the `http` sink's `uri`/`auth.*`
  fields in this image — config loads fine but every request fails
  with "invalid uri character" / 401. Don't fight it: render
  `vector.toml` with real values baked in before deploying (a plain
  template + `sed`/similar is enough) rather than relying on Vector's
  own interpolation for those fields.

  Adding a **new** docker host to the fleet should get a
  `vector-log-shipper` too, following the same compose shape (see the
  existing deployments as the reference) — this isn't automated by
  `fleet-runner` yet.
- **Webgateway** runs nginx (the public TLS terminator) and the
  keystore-aware `auth_request` flow. vhosts live in
  `/etc/nginx/sites-enabled/<host>.{http,https}.conf`. Most are regular
  files, but some are symlinks into `sites-available/`, and
  `fleet-runner nginx-render --push` writes to both directories, so
  `sites-available/` is in use. Edit
  `sites-enabled/` directly for one-offs, or re-render via
  `fleet-runner nginx-render --push`. Surprised an agent for ~10min
  in the 2026-05-17 batch (ADR-0023 gap 5).
- Build + push: `docker buildx build --platform linux/amd64 --provenance=false -t ghcr.io/baditaflorin/<repo>:<short-sha> --push .` (image repo is the GitHub repo name, e.g. `go_a11y_quick`, unless `service.yaml` `registry.image` overrides it)

Operational topology, env-var names and rotation procedures are in **private**
`fleet-state/OPS.md`; credential values live in `go-fleet-secrets` or
protected host files, never in OPS.md — never commit SSH targets, IPs, or
tokens to service repos.
  

## Session continuity — handing off to a fresh agent

When a session gets long enough that context feels tight, hand off to a
new Claude with [`RESUME-PROMPT.md`](RESUME-PROMPT.md). It's a copy-paste
first-message template; its built / deployed / blocked sections date from
2026-05-16, so refresh them against live state before use — so the user
doesn't have to repeat themselves. The prompt stays public (no topology / IPs / tokens); it
references this CLAUDE.md, RUNBOOK-UNATTENDED.md, and private OPS.md
for the rest.

## Unattended automation — secrets, DNS, preflight (read RUNBOOK-UNATTENDED.md)

**Three primitives let any agent ship a brand-new service from "local
code" to "live with DNS + scope + secrets" without operator intervention:**

| Service | Role | Port |
|---------|------|------|
| [`go-fleet-secrets`](https://github.com/baditaflorin/go-fleet-secrets) | Encrypted vault for tokens (Hetzner, GitHub PAT, SMTP, platform API keys) | 18140 |
| [`go-fleet-dns-sync`](https://github.com/baditaflorin/go-fleet-dns-sync) | Registry → Hetzner Cloud DNS reconciler (30-min ticker) | 18141 |
| [`go-fleet-preflight`](https://github.com/baditaflorin/go-fleet-preflight) | Pre-deploy checklist (registry + DNS + port + secrets) | 18142 |

The full operational playbook — bootstrap, secret rotation, "how to add
a new service unattended", agent anti-patterns — lives in
[`RUNBOOK-UNATTENDED.md`](RUNBOOK-UNATTENDED.md). **Read that before
asking the user for tokens or where things live.**

Key facts an agent needs to know:

- **DNS API**: `https://api.hetzner.cloud/v1` (Bearer auth). The older
  `dns.hetzner.com` Console API is **deprecated** — don't use it.
- **Zone**: `0exec.com` is Hetzner Cloud zone id `1285812`.
- **Gateway IP**: `176.9.123.221` — A records of `runtime=compose`
  services point here; nginx terminates TLS and routes to the right upstream
  port. `runtime=coolify` services use a different public edge (see
  `bin/fleet-edge-probe.py` `GATEWAY_IPS`).
- **Token env name**: `go-fleet-dns-sync` reads `HCLOUD_TOKEN` (fallback
  `HETZNER_TOKEN`); `fleet-runner deploy` reads only `HETZNER_TOKEN` — set
  both to the same value.
- **Secrets**: live in `go-fleet-secrets`; never hand-write them into env
  files on the dockerhost (`fleet-runner deploy` materializes vault-backed
  values into a mode-600 `/opt/services/<slug>/.env` at deploy time),
  NEVER in service repos, NEVER in services.json / overrides.json.
  Each secret has a `consumers` allowlist (`X-Auth-User` scope).
- **Before any deploy**: call preflight; expect 200 (green) or 424 with
  a detailed checklist of what's red.

## Operations playbook — teach yourself to fish

**For any AI agent (Claude, Gemini, Haiku, GPT-anything) that lands in
this repo and is asked to bump versions, allocate ports, or deploy.
The fleet has canonical tooling — your job is to learn to invoke it.
This section gives you the exact commands plus the manual fallback
when the canonical tool isn't reachable.**

### How to invoke `fleet-runner` from anywhere

`fleet-runner` lives on **Builder LXC 108** at `/usr/local/bin/fleet-runner`.
The LXC is a Proxmox container on `0docker.com`. From any host with SSH
access to the bastion:

```bash
# One-off invocation (works from your laptop, a CI runner, anywhere):
ssh root@0docker.com "pct exec 108 -- /usr/local/bin/fleet-runner <subcommand> [args...]"

# Examples:
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner converge'
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner allocate-port --count 1'
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner audit --all'
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> patch --push'
```

<!-- anchor id=fleet-runner-invocation-converge repo=go_fleet_runner symbol=verb:converge verified=6bebc4351 digest=sha256:58d68013fea726aa56947ab5cad42f19ad6a7a44d55b93d66e0b7ec1ee0b23cd on=2026-10-12 -->

If you don't have SSH access to `0docker.com`, **stop and ask the user
to run the command, copy-pasting the exact line above**. Do not
substitute a different command. If you can't involve the user
(autonomous run), drop down to the "manual fallback" recipe in each
section below — but mark in your output that you used the fallback so
the user can verify nothing drifted.

#### Even shorter: install the local shim

On a fresh workstation, once SSH keys to the bastion are set up
(target identities are in private `fleet-state/OPS.md`), install
`fleet-runner-shim` as `/usr/local/bin/fleet-runner` and every recipe
below works with the bare command (drop the
`ssh "$FLEET_BASTION" 'pct exec "$FLEET_LXC" -- "$FLEET_REMOTE_BIN"'` prefix).
One-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/baditaflorin/services-registry/main/bin/fleet-runner-shim \
  | sudo tee /usr/local/bin/fleet-runner >/dev/null \
  && sudo chmod +x /usr/local/bin/fleet-runner
fleet-runner --help            # smoke test — should print the remote binary's help
```

After install, the canonical examples shorten to e.g.
`fleet-runner converge`, `fleet-runner allocate-port --count 1`,
`fleet-runner deploy go_<repo>`. The shim is thin — it forwards argv, plus
the fixed whitelist of token/env variables in the `for v in` loop of
`bin/fleet-runner-shim`, over SSH to LXC 108 — so output, exit codes, and
prompts behave as on the LXC. The shim also sends caller identity
(`FLEET_CALLER_HOST`/`USER`/`AGENT`/`SESSION`, derived from the local
hostname, user, `CLAUDE_AGENT_NAME` and `CLAUDE_SESSION_ID` when not already
set) so the remote audit log can tell laptops and agents apart. Source: [`services-registry/bin/fleet-runner-shim`](bin/fleet-runner-shim).

Some verbs need env vars sourced (notably the `key …` family needs
`APIKEY_SERVICE_URL` + `APIKEY_SERVICE_ADMIN_TOKEN`, and
`audit fleet-auth-consumers` needs `FLEET_SECRETS_ADMIN_TOKEN`;
`audit fleet-auth-scope` only needs SSH reach to the dockerhost;
`deploy` needs `HETZNER_TOKEN` for the
DNS step — all from `fleet-state/OPS.md`). Drop
[`bin/fleet-runner.env.example`](bin/fleet-runner.env.example) into
`~/.fleet-runner.env`, fill in the admin tokens, then
`source ~/.fleet-runner.env` from your shell rc. Without it, every
admin op errors with `keystore unavailable: dial localhost:18021`
and a `deploy` of a host that has no A record and no zone wildcard
aborts (exit 4) with `no A record for <fqdn> and $HETZNER_TOKEN not set`.

**Env-file MUST use `export KEY=VAL` lines, not bare `KEY=VAL`** —
otherwise `source` populates the current shell but the vars don't
propagate to child processes (the `fleet-runner` binary). The
template in `bin/fleet-runner.env.example` is already in the right
shape; copy it verbatim. The LXC 108 copy at `/root/.fleet-runner.env`
was migrated to `export` form on 2026-05-19. If you maintain another
copy elsewhere, mirror the same shape.

### Recipe — Allocating a port for a new service (or resolving a conflict)

> **A host_port collision does NOT fail loudly — it clobbers a live
> service.** `fleet-runner deploy` resolves the dockerhost compose dir
> **by host_port**. If you hand-pick a port another service already
> owns, `deploy <your-service>` finds the *other* service's
> `/opt/services/<that-repo>/` directory, overwrites its
> `docker-compose.yml` with your image, and rolls your container in
> place — **silently evicting the live service that owned the port**.
> Observed 2026-05-31: `fleet-pipe` registered on a hand-picked `18256`
> took down `svg-icon-inventory` (which already owned 18256), because
> the deploy deployed pipe into svg's compose dir. **Always take the
> port from `allocate-port`; never hand-pick.**
>
> Recovery if you collide: (1) `docker compose down` your squatter in
> the victim's dir to free the port; (2) `fleet-runner deploy
> <victim_repo> --bootstrap --force-build` — a *plain* deploy is fooled
> into a no-op when the squatter happens to report the same version, so
> force it; (3) move your service to a free port in BOTH the registry
> (`overrides.json` → regen → push) and the repo (Dockerfile, compose,
> service.yaml, deploy.yaml), then redeploy.

**Canonical (preferred):**

```bash
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner allocate-port --count 1'
# Output: a single integer like 18099 — that's your host_port

# Multiple at once:
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner allocate-port --count 3'
```

**Manual fallback (when canonical isn't reachable):**

1. Open `services-registry/services.json` and find the highest
   `host_port` currently in use in the reserved range (default
   `18100–18999`).
2. Pick the next integer above the max.
3. Set **both** `host_port` (e.g. `18099`) and `container_port` (what the
   service binds inside its docker container; for most services this
   equals `host_port`) for the service's slug in
   `services-registry/overrides.json` (`services.json` is generated; run
   `python3 bin/generate.py` and push both).
4. Verify no clash: `grep -En '"(host|container)_port":[[:space:]]*<your-pick>,?$' services-registry/services.json` should return only your line(s).

**When you hit "port X is already taken" — the case Gemini got wrong:**

The registry is the truth, not the running container. Find the
squatter:

```bash
# Anyone claiming this port in the registry?
python3 -c "import json; d=json.load(open('services-registry/services.json')); print([e['id'] for e in d if e.get('container_port')==8313 or e.get('host_port')==8313])"

# Registry entries WITHOUT a host_port (this audit cannot see a running container that has no registry entry at all; compare docker ps on the dockerhost with services.json for that):
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner audit registry-host-port-set'
```

If the squatter has no registry entry, register it so the allocator sees
its port: for a third-party container add an `$external` row (`id`,
`host_port`, `repo_url`, plus `container_port`) to `overrides.json`; for a
first-party repo add the `mesh-*` GitHub topics (a per-slug patch alone
creates no entry), then set `host_port` in its `overrides.json` patch. Run
`python3 bin/generate.py` and push. `allocate-port` is read-only and only
proposes a free port. (To find live listeners with no registry row at all,
`fleet-runner audit orphaned-listeners` checks the dockerhost against
`services.json`.)
Your service keeps its original port. Only reallocate
your service's port if the squatter has a legitimate registered claim.

### Recipe — Bumping a service version (atomically across all files)

**Canonical:** `fleet-runner bump-version` updates `service.yaml`, any
`const Version = "..."` in `main.go`/`version.go`, prepends a
`CHANGELOG.md` entry (see "Per-repo `CHANGELOG.md`" below), and with
`--push` commits, creates the git tag, and pushes commit + tag together.
Without `--push` it only writes files and prints the commit/tag commands:

```bash
# Local bump (writes files, prints next steps for review)
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> patch'

# Atomic bump + commit + tag + push (one-shot)
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> patch --push'

# Write a richer changelog entry instead of the auto-derived commit list:
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> minor --changelog "### Added
- new /foo endpoint
### Fixed
- BREAKING: renamed ?q= to ?url=" --push'

# Variants:  minor  /  major  /  --set 2.0.0
```

After the bump lands, the **container is still running the OLD
version** until you deploy. Pair with `fleet-runner deploy <repo>`.

**Manual fallback:**

```bash
cd /path/to/<repo>
# 1. service.yaml (preserve quoting — quoted stays quoted)
sed -i.bak 's/^version: "1.2.3"/version: "1.2.4"/' service.yaml && rm service.yaml.bak

# 2. main.go / version.go const, if present
grep -l 'const Version' *.go
sed -i.bak 's/const Version = "1.2.3"/const Version = "1.2.4"/' main.go && rm main.go.bak

# 3. Commit, tag, push, push tag — ALL FOUR (Gemini forgot step 4)
git add -A && git commit -m "chore: bump version to 1.2.4"
git tag 1.2.4              # NO leading v
git push
git push origin 1.2.4      # tags don't ride `git push` by default
```

Tag *after* the commit, push *both*.

### Recipe — Deploying a service

**Canonical for a routine single-host update:**

```bash
fleet-runner deploy go_<repo>
```

`deploy-authorized`, `deploy-pool` and `deploy-all` are separate entry
points; when deployment authority is required
(`FLEET_DEPLOYMENT_AUTHORITY_MODE=required`), plain `deploy` is refused.

On Builder LXC 108 the registry cache race needs no flag; cosign signing
is degraded as of 2026-10-13 and deploys there need `--skip-cosign`:

- **Registry cache race** — `raw.githubusercontent.com/.../services.json`
  is still Fastly-cached with `max-age=300`, so `fleet-runner` resolves
  the registry source itself when `--services` isn't passed
  (`ResolveServicesSource`, shipped 2026-05-21; made stale-proof in
  go_fleet_runner v0.7.303). After one bounded `git fetch origin main`
  per process it reads `/root/workspace/services-registry/services.json`
  only while that file is byte-identical to origin/main. If the checkout
  is behind or edited, it reads origin/main's copy from the checkout's
  git objects instead and warns on stderr how far behind the checkout
  is; if git cannot verify the checkout (not a clone of
  `baditaflorin/services-registry`, fetch failed), it reads the CDN URL.
  `overrides.json` follows the same rule. A stale or dirty workspace
  checkout therefore no longer feeds old data into the registry lookups
  of `nginx-render`, `deploy`, `render-compose` or `whois` (on
  2026-10-12 it was 212 commits behind and made `nginx-render
  --exact-filter proxy` refuse a pooled service as "not explicitly
  marked replicable"). An explicit `--services <path>` is never
  touched. The check only fetches: it moves
  `refs/remotes/origin/main` and adds objects, and never changes the
  checkout's working tree, index or HEAD.
  Since go_fleet_runner v0.7.319 the decisions `deploy` takes
  from the registry itself (the deploy shape: compose project or
  Coolify; the `proxy_egress` rule; the wildcard-certificate lookup)
  read it through the same check, and stop instead of falling through
  when the registry cannot be used: the checkout cannot be verified and
  neither `origin/main` nor the CDN can be read, or the bytes are not
  valid JSON. A workspace root chosen with `FLEET_RUNNER_WORKSPACE_ROOT`
  is read as it is. Since go_fleet_runner v0.7.492 an explicit
  `deploy --services <path>` (and `--overrides <path>`) that names a file
  outside the shared checkout is read as given for those three decisions
  too, and for the service lookup and the vhost and compose override the
  deploy renders (a file that cannot be read or parsed stops the deploy; it
  never falls back to `origin/main`); one that names the checkout's own
  file is replaced by the default, which is the verified registry.
  Since go_fleet_runner v0.7.336 `clusters.json` is
  read the same way by everything that acts on the host it picks
  (`deploy`, `deploy-authorized`, `deploy-all`'s gate, `placement-plan`,
  `nginx-render`'s pools and the pool tools, `stage`, `port-heal
  --reconcile` (its placement half), `drift`, `render-compose`,
  `dns-heal`, `compose-image-heal`) and, since v0.7.343, by
  `audit compose-drift`. The file may be absent (a 404 from the CDN
  means no placement), but a checkout that cannot be verified while the
  CDN cannot be read stops the command. The other audit and report verbs
  still read the working tree (go_fleet_runner
  `docs/registry-checkout-readers.md`).
- **Cosign signing** — degraded as of 2026-10-13: the vault's
  `cosign-public-key` is populated (`fleet-runner verify-image` still
  verifies previously signed images), but the vault signing key is
  empty, so deploys run with `--skip-cosign` and the images they push
  are unsigned. Once the vault entries are restored, a plain `deploy`
  signs on push and verifies on pull with no flag. `--skip-cosign` is
  an emergency-only bypass (vault unreachable, key mid-rotation, signing
  key empty) — pass it only while signing is unavailable. `deploy`
  refuses it without a reason
  (`--skip-cosign-reason "<why>"` or `FLEET_SKIP_COSIGN_REASON`); it prints
  a loud bypass warning and lands an audit-log row that records the reason,
  precisely so it's never silently routine.

<!-- anchor id=skip-cosign-reason repo=go_fleet_runner symbol=go:deploy_cosign.go#resolveSkipCosignReason verified=02bf8378f digest=sha256:f9d3e56291db47b14ad0e2e8e79a585d5e19b9e87549db4d6c56dfcbb84e9657 on=2026-10-12 -->
`fleet-runner deploy` is idempotent end-to-end. The pipeline is built
to fail fast BEFORE touching prod, and to refuse to declare success
unless every check confirms the new image actually carries the new
code AND the cross-service-call gate is green.

Before step 1, deploy runs the stale-checkout guard (`--allow-stale` /
`--no-fetch`), refuses sunset or IAC-rendered private services, runs the
placement-plan gate (with `--placement-plan`), the caller-impact gate
(only on a major version bump with live callers; bypass
`--skip-caller-check`) and, for public services, the edge preflight gate
(bypass `--skip-preflight`; fails open on a preflight outage). After the smoke gate it writes
deploy-meta, re-renders the vhost, runs the limit_req postflight and
image-gc.

1. **DNS** — checks the A record resolves; creates it only when it is
   missing and no zone wildcard covers it (needs the DNS API token);
   skipped for private and `--pool-target` deploys. The vhost and cert
   (http vhost, certbot, full vhost pair) are ensured after the roll,
   before the smoke gate.
2. **Drift detection** — reads `service.yaml` `version` from
   `origin/main` via `git show` (NOT the long-lived workspace tree,
   which is shared and routinely stale) and compares to the live
   `GET /version`. If the versions match AND the dockerhost compose pin
   equals origin/main's short SHA (ADR-0028), the deploy is an
   idempotent no-op. A SHA mismatch (or `--force-build`) rebuilds and
   rolls even at the same version.
3. **Pre-flight** (Go repos) — in a fresh `git worktree add origin/main`
   on Builder LXC 108, run `go build ./...` and `go test ./...`.
   Failure aborts here; prod is not touched.
4. **Build + push** — `docker buildx build --platform linux/amd64
   --provenance=false --push` tagging both `:<version>` and
   `:latest`.
5. **Pull + digest assertion** — `docker compose pull` on dockerhost,
   then `docker inspect` the new `:<short-sha>` image ID. If it equals
   the previously-running digest on the drift path, the deploy fails:
   the new manifest didn't propagate (GHCR auth scope, tag cache,
   platform mismatch), and rolling forward would be a no-op
   masquerading as a deploy (under `--force-build` a byte-identical
   rebuild only warns).
6. **Roll** — `docker compose up -d` recreates the container.
7. **Health-wait** — poll `docker inspect …{{.State.Health.Status}}`
   until "healthy" (up to 90s). "unhealthy" fails immediately;
   "starting" keeps polling; empty = no HEALTHCHECK directive,
   trust the container and proceed.
8. **Smoke gate** — three probes: `GET /health` must be 200 (a 404 is
   skipped as "not implemented", like `/selftest`), `GET
   /selftest` must be 200 (or 404 = "service didn't implement it,
   skip"); 503 is the codified "internal sources errored" signal and
   fails the gate. `GET /version` must match the version we just
   pushed — catches "container restarted but the image didn't roll".
9. **Rollback on smoke fail** — captures the previous image digest
   before the roll; on smoke failure, retags that digest as `:rollback`
   on the dockerhost (no GHCR roundtrip), re-pins compose to
   `:rollback` and `compose up -d`, waits
   for HEALTHCHECK, re-smokes. The new image stays in GHCR but is
   NOT kept running.

Flags: `--force-build` (rebuild + roll even when versions match),
`--skip-build` (assume the image is already in GHCR), `--skip-smoke`
(offline DR), `--no-rollback` (leave the new image in place on smoke
fail — for fix-forward scenarios).

**Manual fallback (when LXC 108 is unreachable):**

If you must deploy manually, do **all** of these in order — do not skip
any:

```bash
# 1. Build on an AMD64 host (NOT on an ARM Mac — binary won't run)
docker buildx build --platform linux/amd64 --provenance=false \
  -t ghcr.io/baditaflorin/go_<repo>:<version> --push .

# 2. Roll the container forward on the dockerhost
ssh -J root@0docker.com ubuntu_vm@10.10.10.20 '
  cd <compose-dir>   # the container's com.docker.compose.project.working_dir label (read it with `docker inspect`); usually /opt/services/go_<repo>, sometimes go-<slug>
  sudo docker compose pull && sudo docker compose up -d
'

# 3. Update the gateway-served deployment metadata (catalog UI reads it)
#    <fqdn> = host of the service url in services.json
#    (<slug>.0crawl.com or <slug>.0exec.com). Compute the sha locally in
#    the service repo (after `git fetch origin`); $SHA is expanded before
#    ssh, not on the gateway. No nginx reload: the gateway serves the file
#    per request (alias, Cache-Control: no-store), and every reload costs a
#    full config parse and a new worker generation (fleet-runner stopped
#    reloading here in go_fleet_runner v0.7.341).
SHA=$(git rev-parse --short origin/main)
ssh -J root@0docker.com florin@10.10.10.10 "
  echo '{\"sha\":\"$SHA\",\"version\":\"<version>\",\"deployed_at\":\"'\$(date -u +%FT%TZ)'\"}' \
    | sudo tee /etc/nginx/deploy-meta/<fqdn>.json
"

# 4. Smoke test
curl -sSf https://<slug>.<mesh>.com/health
```

If step 3 or 4 fails, the deploy is incomplete even though the
container is running. Don't declare done until both succeed.

### Recipe — Self-check before declaring "done"

Three commands. Run all three. If anything in the category you touched
is flagged, fix it before stopping. **Do not pass `--services`** to any
of these three — `converge`, `audit`, and `state snapshot` don't accept
that flag (confirmed on v0.7.11: `flag provided but not defined:
-services`). They already read the registry correctly without it — see
"Recipe — Deploying a service" above for why the local-copy race no
longer needs a flag at all:

```bash
fleet-runner converge
fleet-runner audit --all
fleet-runner state snapshot
```

### Recipe — Rolling out a blast-radius change (shared lib / shared dep)

**When a change to a shared thing affects N services** — a `go-common`
bump (use plan mode alone to list consumers of a changed client
signature or new env contract; `rollout --apply` only bumps a Go module
dependency) — don't hand-grep and hope. `fleet-runner rollout` finds the
affected Go container services (union of three discovery sources;
completeness depends on checked-out repos), propagates the change, and
proves each still builds.

```bash
# 1. PLAN (read-only, the default): see the complete affected set.
#    Run on Builder LXC 108 so the code-grep sees the full workspace.
fleet-runner rollout \
  --dep github.com/baditaflorin/go-common@<LATEST> \
  --grep 'client\.JSProxy(DOM)?\(|GetRendered\(|FetchNetwork\(|RenderJS' \
  --graph-callers-of js-proxy,js-proxy-network,infrastructure-fetch-cache

# 2. APPLY: bump + build/test each consumer, land one auto-merge PR per repo,
#    emit a fleet-state/sweeps manifest (revertable via sweep-rollback).
fleet-runner rollout --dep …@<LATEST> --grep '…' --clone --apply --pr
```

Discovery is the **union** of three sources, because each has blind spots:
`--grep` (code signature — catches cold consumers the runtime graph never
saw), `--graph-callers-of` (go-fleet-graph inbound callers), `--depends-on`
(services.json declared edges). The union is intersected with
`kind=container,language=go` + excludes, and the backend slugs themselves
are dropped.

Three non-obvious rules:

- **The runtime graph can be blind to intra-mesh calls.** Direct
  `client.JSProxy` calls use a plain `net/http.Client` and are not recorded
  from the caller side; fleetfetch (fetch-cache) calls are graph-instrumented
  only in services running a go-common that includes the fleetfetch graph
  transport (added 2026-10-02) with `GRAPH_ENABLED=true` (default false).
  `fleet-runner deps <slug>` can show zero OBSERVED callers for an
  intra-mesh backend even when many services depend on it (its DECLARED
  TOPOLOGY block lists the services.json `depends_on` dependents).
  For intra-mesh deps the **code-grep is authoritative** — that's why rollout
  unions grep with the graph instead of trusting the graph alone.
- **`--clone` first** (or run on LXC 108 where the workspace is kept
  nearly complete): the grep is only as complete as the local checkouts, and
  the registry has about 500 repos as of 2026-10-13 that may not all be
  cloned on a given host. rollout
  reports a "code-grep is PARTIAL" warning when repos are missing.
- **Always pass the actual LATEST dep version**, never a stale literal —
  `go get dep@vOld` on a repo already ahead silently *downgrades* it.

### Recipe — Closing a capability gap (gap → fix loop)

**When you notice during a real engagement that a fleet service is
missing a capability** (didn't return needed signal, doesn't handle
a class of input, response is silent on a real failure), don't lose
the discovery. Capture it, then route through the right tool:

```
real engagement
     │
     v
gap noticed  ───>  add a record to a findings JSON
     │             (id, kind, repo, gap_summary, suggested_fix,
     │              [optional] auto_apply + patch_unified_diff,
     │              session_context)
     v
bin/autofix.py findings.json [--apply]
     │
     ├── auto_apply: true + fleet repo + clean patch ──> CLONE + APPLY
     │      + TEST + PUSH + DEPLOY + /selftest [+ rollback on fail]
     │
     └── anything else ────────────────────────────────> bin/disclose.py
            files the gap as an issue on the right repo (either fleet
            repo for fleet_gap; merchant repo for external_leak)
```

Both tools live in
[`baditaflorin/go-pentest-leak-bounty-policy/bin/`](https://github.com/baditaflorin/go-pentest-leak-bounty-policy/tree/main/bin).
Run from any workstation with `gh auth status` green.

**`bin/autofix.py`** lands mechanical fixes unattended. Hard safety
rails — every gate is a clearly-named abort, never silent:

- `skip_not_fleet` — repo not under `baditaflorin/`. Repos outside
  `baditaflorin/` are never auto-modified; the gate checks the org
  only, not fork status, so a fork of a third-party project under
  `baditaflorin/` passes it.
- `skip_no_auto_apply` — finding must opt in with `auto_apply: true`.
- `skip_no_patch` — must include a `patch_unified_diff`.
- `git apply --check` — patch applies cleanly to a fresh clone before
  any state mutation.
- Test gate — `go test ./...` (or `npm test`) must pass.
- `/selftest` gate — post-deploy, the service's `/selftest` must
  return 200. `/health` only proves the binary booted; `/selftest`
  exercises the patched code path only when the service registers a
  `selftest.Suite` (otherwise go-common/server returns a default 200
  stub that proves no more than `/health`).
- **Auto-rollback** — on `/selftest` fail, force-push origin back to
  the pre-fix SHA AND redeploy the previous image.

**`bin/disclose.py`** files an issue when the fix isn't mechanical
(or the repo is third-party). `external_leak` redacts the token to
the prefix shape only — never re-publicizes the secret.

**Findings file shape** (single JSON, `findings: [...]`). One record:

```json
{
  "id": "gap-7",
  "kind": "fleet_gap",
  "repo": "baditaflorin/go-pentest-<svc>",
  "auto_apply": true,
  "gap_summary": "...",
  "patch_unified_diff": "--- a/file\n+++ b/file\n@@ ...\n",
  "suggested_fix": "...",
  "session_context": "..."
}
```

See
[`bin/findings-fleet-gaps-example.json`](https://github.com/baditaflorin/go-pentest-leak-bounty-policy/blob/main/bin/findings-fleet-gaps-example.json)
for the shape of every `fleet_gap` dispatch path (it has no
`external_leak` record).

**Why this matters for the fleet:** every service that exposes a
public API should ship a `/selftest` endpoint that exercises its
real dependencies (resolver, upstream API, embedded data). Without
a mounted `selftest.Suite`, the autofix `/selftest` gate is vacuous:
go-common/server answers a default 200, which proves nothing about
the patched code path. See
`go-pentest-takeover-checker` and `go-pentest-subfinder` (v0.2+)
for the canonical pattern.

### Anti-patterns — observed in prior agent sessions

1. **"Port 8313 is taken, I'll pick 8500 and edit `service.yaml`."** Use
   `fleet-runner allocate-port` and register the squatter. See "Allocating
   a port" above. **And never hand-pick a port at all** — deploy resolves
   the dockerhost compose dir by host_port, so a collision silently
   clobbers + evicts the live service that owns it (the 2026-05-31
   fleet-pipe/svg-icon-inventory incident). Always take the number from
   `allocate-port`.

<!-- anchor id=port-allocation-containercomposedir repo=go_fleet_runner symbol=go:deploy_compose_sync.go#containerComposeDir verified=6bebc4351 digest=sha256:b535184bb43b793d76cc57b963002943650dd3d1508799079a055a8873f8165f on=2026-10-12 -->

2. **"I bumped the version in `service.yaml` and pushed."** Did you tag
   git AND push the tag AND bump `service.yaml`/`Dockerfile`/`CHANGELOG.md`?
   Use `fleet-runner bump-version <repo> patch --push`; the image is
   rebuilt and re-pinned by `fleet-runner deploy`.

3. **"All repos are pushed to origin/main."** Pushing code ≠ deploying.
   The container is on the old image until `fleet-runner deploy`
   (or the manual fallback) runs.

4. **"I edited `service.yaml` port from 8313 to 8500 to avoid conflict."**
   Silent multi-file drift. `fleet-runner audit port-matches-registry`
   catches this. Don't.

5. **"I ran `git tag X.Y.Z`."** Did you `git push origin X.Y.Z`? Tags
   don't ride `git push` by default.

6. **"`fleet-runner` isn't working for me, I'll use a different deploy
   path."** Stop. Either report the exact command + error to the user,
   or use the manual fallback recipe above and **say so** in your
   summary so the user can verify the catalog-meta step landed.

7. **"`fleet-runner audit <check> --json` says unknown check `--json`."**
   Go's `flag` package stops parsing at the first non-flag argument, so
   `audit feature-without-bump --json` reads `--json` as a positional
   check name. Put `--json` **before** the check name:
   `fleet-runner audit --json feature-without-bump`. Same rule for
   `--severity`, `--filter`. Subcommands with their own FlagSet
   (`audit compose-drift`, `audit compose-image-drift`,
   `audit vhost-drift`) accept flags in any order because they parse
   their own args list.

8. **`bump-version` against a stale workspace.** Bug fixed in 2026-05-17
   afternoon: `fleet-runner bump-version` now `git fetch origin --tags`
   first and refuses to bump if origin/main is ahead. The historical
   failure shape was: bump created a tag pointing at the wrong SHA,
   `git push` rejected with "would clobber existing tag", recovery
   required manual `git tag -d <ver>`. If you hit that on an older
   binary, the recovery is still: `git -C /root/workspace/<repo>
   tag -d <ver>` then re-run bump-version.

9. **`./binary &` smoke tests on Builder LXC 108.** Don't. The builder
   is a build/CI and `fleet-runner` host (Woodpecker, buildkit, registry
   mirror, fleet-triage) — it is **not** a host for registered fleet
   services. When an agent runs `go build && ./binary &` inside
   `/root/workspace/<repo>/` to "quickly check the handler responds,"
   the binary backgrounds, the agent's SSH session ends, and the
   process becomes an orphan (`PPid=1`) listening on whichever port it
   bound. Twelve such orphans were found on 2026-05-21 — three of them
   silently squatting *registered* host_ports (e.g. 18107/18224),
   poised to confuse the next agent who deploys the canonical service
   to dockerhost and runs `ss -tlnp` to debug. Canonical smoke is the
   `fleet-runner deploy` smoke gate against the dockerhost-side
   container, not an in-process binary on the builder. If you genuinely
   need to exercise the handler before `deploy`, run `go test ./...`
   (`httptest` servers bind an ephemeral `127.0.0.1` port in-process and
   die with the test) — no orphan risk. If you
   *must* bind a port, use `127.0.0.1:0` (ephemeral) and `kill` it on
   the same line that started it.

## Deploy failure class — a saturated slow upstream sheds load and rolls back deploys (2026-06-08)

**Symptom.** `fleet-runner deploy <enricher>` (or any container deploy)
rolls back at the smoke gate because the new image's `GET /selftest`
times out — even though `/health` is green and the code is fine. The
real cause is somewhere else entirely: a *different* service is piling
goroutines on a slow shared upstream and starving the whole dockerhost's
scheduler, so every service's `/selftest` probe stalls past its 8 s
deadline. One service's overload silently fails everyone's deploys.

<!-- anchor id=deploy-smoke-gate-max-time-8 repo=go_fleet_runner symbol="regex:deploy_smoke_direct.go#--max-time 8" verified=6bebc4351 digest=sha256:3a797aed5032adaf9bbbb07a81ac6160f1b0cae4a5dc3442e4c9e95d4d7fd8be on=2026-10-12 -->

The canonical instance: `go_infrastructure_fetch_cache` (port 18205)
proxies render requests to `go-js-proxy` / `go-html-proxy`, each held up
to 95 s. A backfill fan-out fires thousands of concurrent `render=*`
requests; ~8.3k goroutines pile on the saturated renderer (host loadavg
56/20 cores); the scheduler thrashes; downstream enrichers' `/selftest`
probes time out; healthy deploys fleet-wide roll back. Any service that
proxies to a saturatable sibling (a renderer, a headless browser, a
rate-limited upstream) can produce the same blast radius.

**Diagnosis.** Confirm it's goroutine pile-up, not the deploying service:

```bash
# Goroutine count on the suspected proxy (fetch-cache here): a healthy
# box sits in the low hundreds; a pile-up reads thousands.
curl -s http://<dockerhost>:18205/metrics | grep '^go_goroutines'

# The human-readable stats page surfaces the shed + upstream-error
# counters: a climbing render_shed means the gate is actively shedding
# (good — it's protecting the box); a high upstream_errors means the
# renderer itself is failing/slow (the root cause).
curl -s http://<dockerhost>:18205/ | grep -E 'render_shed|upstream_errors'
```

For the fleet-standard signal, `loadshed_shed_total{service,gate}` is
emitted on `/metrics` by services that wire `promx.AutoWire` for
`go-common/loadshed` gates, once a gate has shed at least once (until
then only `loadshed_admitted_total` and `loadshed_in_flight` appear). A
sustained nonzero rate is the "this box is shedding load" signal; no
Prometheus alert rule uses it as of 2026-10-13.

<!-- anchor id=loadshed-loadshed-shed-total repo=go-common symbol=regex:promx/loadshed.go#loadshed_shed_total verified=879bbaa1c digest=sha256:9b6e372a22aea8df5258e24235627c7efd149b046ecd34d5e0b5a70cd8bda9c2 on=2026-10-12 -->

**Live mitigation (no rebuild).** The render cap is env-tunable. Lower
`MAX_RENDER_INFLIGHT` to shed sooner and shrink the pile-up, then
re-render and restart the container — no image rebuild, no
`fleet-runner deploy`. The cap is pinned in the service's generated
`docker-compose.override.yml`, which wins over `.env`, so the change goes
through the service's `overrides.json` entry in services-registry:

```bash
# On the dockerhost, in the service's compose dir (read-only check):
cd /opt/services/go-infrastructure-fetch-cache && grep MAX_RENDER_INFLIGHT docker-compose.override.yml   # the pinned cap
# Editing .env does NOT change it, and `sudo docker compose up -d` keeps
# the pinned value. Edit overrides.json in services-registry, merge it to
# main, then on the builder (fleet-runner is not installed on the dockerhost):
fleet-runner render-compose infrastructure-fetch-cache --push --restart
```

Once the pile-up drains, the stalled `/selftest` probes pass and deploys
stop rolling back. Re-run the blocked deploy. Set the cap back up (or
remove it for the default 64) when the upstream recovers. The durable
fix for the root-cause backfill is to rate-limit the fan-out producer,
not just shed at the cache.

**Building a new proxy-to-slow-upstream service?** Don't hand-roll the
shed semaphore — use `go-common/loadshed` (`loadshed.New(name, limit)` +
`TryAcquire`/`WriteShed`, or `gate.Guard` middleware). It gives you the
fast-503 + `Retry-After` path and the `loadshed_shed_total` metric for
free. See `go_infrastructure_fetch_cache`'s `renderGate` for the
canonical in-line (gate only the expensive sub-path) usage.

## SQLite safety — mandatory three rules (adopted 2026-05-26; no automated check enforces them)

`modernc.org/sqlite` uses real `fcntl` syscalls for WAL file locking.
Go creates one OS thread per goroutine blocking on a real syscall — unlike
HTTP or postgres, which go through Go's epoll/kqueue poller and do NOT
spawn threads. Under high `/verify` traffic, an uncancellable goroutine per
request × 5s busy_timeout = 1388 OS threads = 48 GB RAM exhausted on the
host (go-apikey-service incident 2026-05-26).

**Any service that opens a `modernc.org/sqlite` DB MUST follow all three:**

```go
// 1. Serialise writes at the Go pool level (channel wait, not fcntl wait).
//    This prevents thread explosion: Go queues at the pool, not the syscall.
db.SetMaxOpenConns(1)
db.SetMaxIdleConns(1)

// 2. Cap busy_timeout — belt-and-suspenders, protects against pool leaks.
//    Use ≤ 500ms.
dsn := path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(500)&..."

// 3. Context-bound ALL goroutines that write to the DB.
//    Never: go db.Exec(...)
//    Always:
go func(k string, ts int64) {
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()
    _, _ = db.ExecContext(ctx, `UPDATE ...`, ts, k)
}(key, now)
```

<!-- anchor id=sqlite-safety-busy-timeout-d repo=go-fleet-dns-sync symbol=regex:store.go#busy_timeout\(\d+\) verified=2885f9e34 digest=sha256:a59a128314f9a458b5400ad42412ae1b367eab034cdab2ba4ca1c9954fafbc4e on=2026-10-12 -->

**Audit one-liner** — run this from the workspace root (the directory that
holds the sibling repos; `FLEET_RUNNER_WORKSPACE_ROOT`, default
`/root/workspace` on the builder) to find violations before they cause an
incident:

```bash
# Find SQLite services missing safety rules
WORKSPACE="${FLEET_RUNNER_WORKSPACE_ROOT:-/root/workspace}"
for dir in "$WORKSPACE"/*/; do
  go_mod="$dir/go.mod"
  [ -f "$go_mod" ] || continue
  grep -q "modernc.org/sqlite" "$go_mod" || continue
  echo "=== $dir ==="
  files=$(find "$dir" -name '*.go' ! -name '*_test.go' ! -path '*/vendor/*')
  echo "$files" | xargs grep -q "SetMaxOpenConns" || echo "  MISSING: SetMaxOpenConns"
  echo "$files" | xargs grep -q "busy_timeout" && \
    echo "$files" | xargs grep -oh 'busy_timeout([0-9]*' | sed 's/.*(//' | \
    awk '{if($1>500) print "  HIGH busy_timeout: "$1"ms (reduce to ≤500)"}'
  echo "$files" | xargs grep -n "go db\." | grep -v '//' | \
    sed 's/^/  FIRE-AND-FORGET goroutine: /'
done
```

## Fleet-wide changes — change `go-common`, not consumers

The cardinal rule when you'd otherwise touch every service: **modify
the library and bump the dep.** A `go-common` patch plus
`fleet-runner update-dep --push github.com/baditaflorin/go-common@vX.Y.Z`
beats hundreds of PRs. To bump only a subset (stragglers, one mesh, one
category) add `--repos a,b` or `--filter mesh=…,category=…,ids=a;b` —
`update-dep` is no longer fleet-wide-only.

**`go-common` ≥ v0.55.0 — `/selftest` bypasses the fetch cache.** The
`selftest.Suite` now runs every check with
`safehttp.WithoutFetchCacheContext(ctx)`, so `/selftest` validates the
service's REAL outbound path (DNS + TLS + origin) instead of routing
live probes through a cold fleet cache. Before this, live-probe
selftests (e.g. a detector fetching vercel/netlify/fly) routed through
the cold cache on the freshly-built image and blew past
`fleet-runner deploy`'s 8 s smoke `/selftest` timeout — false-failing
otherwise-healthy deploys and rolling them back. If you see a deploy
roll back on a `/selftest` timeout while `/health` is green, the fix is
to bump the service to go-common ≥ v0.55.0 and redeploy; do NOT reach
for `--skip-smoke`. Need a single client to skip the cache outside
selftest? `safehttp.WithoutFetchCache()` (per-client) or
`WithoutFetchCacheContext(ctx)` (per-request).

Since go_fleet_runner v0.7.393, `deploy`'s direct smoke probe retries up to 5 times, 4 s apart, when a probe gets no HTTP response at all (curl prints `000`: connection refused, reset or timeout), so a container that is not listening yet is not rolled back for that; any HTTP status, including 4xx and 5xx, is judged on the first answer.

<!-- anchor id=selftest-fetch-cache-probedirect repo=go_fleet_runner symbol=go:deploy_smoke_direct.go#probeDirect verified=101e9fb9f digest=sha256:9eb4e4a3eaa7e56651f227e3815e59452872711f8e19092ae6827f7dd0eb9ab4 on=2026-10-14 -->
<!-- anchor id=selftest-fetch-cache-withoutfetchcachecontex repo=go-common symbol=go:safehttp/fetchcache.go#WithoutFetchCacheContext verified=879bbaa1c digest=sha256:e3bc237b8580886297b9c77d3ba644af87f623a770d6a6de9aeb7e66a724b6a9 on=2026-10-12 -->

## Per-repo `CHANGELOG.md` — capture what changed at each version

Every container repo keeps a **`CHANGELOG.md`** at its root, newest
entry on top, in the shape `fleet-runner bump-version` emits (`go-common`'s newer
headings use `## [X.Y.Z] - YYYY-MM-DD`, which `fleet-runner change-receipts`
does not count):

```markdown
## <version> — <YYYY-MM-DD>

### Added | Changed | Fixed | Removed
- one bullet per meaningful change; lead breaking changes with **BREAKING:**
```

Why: with hundreds of services moving independently, "what shipped in this
version and could it have broken X?" is otherwise un-answerable without
trawling git. A per-version, human-and-AI-written entry makes
regressions diff-able at a glance and feeds the fleet-wide
`fleet-runner changelog` digest with intent (not just PR titles).

**You (the agent) write the entry — you just made the change, so you
know what happened and why.** `fleet-runner bump-version` scaffolds it
for you: it prepends a `## <newver> — <date>` block to `CHANGELOG.md`
(creating the file if absent), auto-populating it with the commit
subjects since the previous tag. Pass `--changelog $'### Added\n- …'`
(ANSI-C quoting; the value is written verbatim, a literal `\n` is not
expanded) to write a richer entry instead of the auto-derived one. The changelog
edit rides the same atomic bump commit as `service.yaml` + the tag, so
a bump made with `bump-version` normally lands with a changelog entry (a
write failure only prints a WARNING; versions bumped by hand are not checked). This is opt-out only by
omission — don't bump a service's version without leaving a changelog
entry.

<!-- anchor id=bump-version-prependchangelogentry repo=go_fleet_runner symbol=go:bump_version.go#prependChangelogEntry verified=6bebc4351 digest=sha256:c4c6a3718d7d469d5b7fc44349ccc731532ae7bd336b1e673be0d798ff7aa239 on=2026-10-12 -->
<!-- anchor id=bump-version-changelogbody repo=go_fleet_runner symbol=go:bump_version.go#changelogBody verified=6bebc4351 digest=sha256:20f443bb5cbc821951c78d047d4971cf6d7e5ed81b65a7ffc8c5c193c18b3f87 on=2026-10-12 -->

## Local workflow

- Local workspace root: `/Users/live/Documents/Codex/2026-05-08/`.
  Sibling repos sit next to this one — read them directly when you
  need to understand a dependency.
- CI: self-hosted **Woodpecker CI** is live at
  [https://ci.0exec.com](https://ci.0exec.com) on Builder LXC 108 (see
  [ADR-0035](docs/adr/0035-self-hosted-ci-on-builder-lxc.md)) —
  server + agent at `/opt/woodpecker/` on the LXC, capped at 3
  concurrent workflows per agent (two agents on the LXC, 6 in total; a
  load-aware controller admits capacity from other hosts) so it doesn't
  contend with `fleet-runner deploy-all` batches on the same box.
  GitHub webhooks are wired
  (OAuth App + nginx vhost reusing the `wildcard.0exec.com` cert);
  pull requests and pushes to the default branch trigger CI on every
  activated repo (a push to a PR branch is covered by its PR run, and
  the canonical template skips docs-only `CLAUDE.md`/`AGENTS.md`
  changes). Most repos run `go build ./... && go test ./...` — the same
  gate `fleet-runner deploy`'s pre-flight already runs — and the
  non-Go repos run their own checks. A
  cron every six hours (`docker builder prune -af --filter
  unused-for=6h`, at :15), a weekly prune and disk-pressure guard
  scripts keep the LXC's build-cache disk usage bounded. Nearly every
  `go.mod` repo carries a `.woodpecker.yml`; migrating repos to the PR
  plus default-branch trigger template runs through
  `bin/woodpecker_trigger_rollout.py`, tracked via `git log` on this
  file / repo PRs — no separate rollout ledger. Still don't scaffold GitHub
  Actions build workflows — that's the billing model this exists to
  avoid. Repos without their own `go.mod` (composite-pattern services
  built on a shared `go_composite_runner` base image) get no
  `go build`/`go test` pipeline — there's no local Go source for
  `go build` to act on; most have no pipeline at all, and a few carry a
  wrapper-validation `.woodpecker.yml` instead (for example
  `go_merchant_profile`).
- Supply chain: prefer npm packages ≥ 3 days old over `@latest` —
  accept known CVEs over zero-day supply-chain injection.
- Supply chain: prefer npm packages ≥ 3 days old over `@latest` —
  accept known CVEs over zero-day supply-chain injection.

## Canonical release receipts

Every meaningful release must form one traceable chain:

`CHANGELOG.md` entry -> version/tag -> PR or commit SHA -> deployed image/digest -> production verification.

The changelog is the narrative receipt: state what changed, why, and the verification result. For container services, use `fleet-runner bump-version <repo> patch|minor|major --push` where possible; it keeps the version, changelog, commit, and tag together. A code push is not a deployment—record the verified production image/digest and standard health, self-test, version, and gateway result.

Inspect the fleet deterministically with:

```bash
fleet-runner change-receipts --sort prs --top 50
```

<!-- anchor id=release-receipts-change-receipts repo=go_fleet_runner symbol=verb:change-receipts verified=6bebc4351 digest=sha256:eaa3a86295d8c67e4f365a142452f7130e41755abcc05b3908232a72930cde6f on=2026-10-12 -->

That command reports commits, PR-number receipts, changelog-backed version counts and latest activity per service (add `--json` to also get each service's current version). Static applications are outside the changelog chain (almost none carry a `CHANGELOG.md` or version) and `change-receipts` skips them by default (its `-filter` defaults to `kind=container`); the published GitHub Pages build for the commit is the available deployment evidence, but nothing records it as a receipt.
