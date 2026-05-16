# Fleet context — drop-in brief for AI agents

This file is the **canonical** cold-start brief for any AI agent
working inside a baditaflorin fleet service repo. It is maintained in
`services-registry/CLAUDE.md` (the registry is the catalog) and
propagated to every fleet repo via `fleet-runner inject`.

If you find a stale copy that differs from this one, the registry copy
wins — refresh and re-propagate, don't fork it.

Per-service specifics (port, mesh, slug, version, category) live in
the repo's own `service.yaml` + `deploy.yaml` + `README.md`. This file
is intentionally generic — it explains the *fleet*, not any one
service.

**Building a new service?** See
[`services-registry/SERVICE-TEMPLATE.md`](SERVICE-TEMPLATE.md) — the
canonical per-service scaffold (file-by-file templates for `main.go`,
`service.yaml`, `Dockerfile`, etc., plus a paste-ready cold-start
prompt you can feed Claude / ChatGPT / Gemini). Propagated to every
fleet repo next to this file.

## Fleet at a glance

~220 service repos under `github.com/baditaflorin/*`. The canonical
catalog is `services-registry/services.json`; the canonical
conventions doc is `services-registry/FLEET.md` — **read it first**
for any fleet-wide task.

### Reading the registry — fetch a slice, not the full blob

`services.json` is ~280 KB / ~250 entries / ~26 fields each. If you
only need IDs, names, ports, TRL, or URLs, **fetch a slice instead**
— it's the same `raw.githubusercontent.com` path with a different
filename. Sized for AI agents on a token budget.

| URL suffix                | shape                                                    | size  | use when |
|---------------------------|----------------------------------------------------------|-------|----------|
| `services.ids.json`       | `["a11y-quick", …]`                                      | ~5 KB | "what services exist?" |
| `services.names.json`     | `[{id, name}]`                                           | ~13 KB | pickers / menus |
| `services.minimal.json`   | `[{id, name, mesh, kind, category, language, trl, url}]`| ~44 KB | catalog overview |
| `services.urls.json`      | `[{id, url, health_url, example_path, auth_help}]`      | ~63 KB | building Open / smoke links |
| `services.trl.json`       | `[{id, trl, trl_ceiling, trl_assessed_at, …}]`          | ~31 KB | TRL audits |
| `services.ports.json`     | `[{id, host_port, container_port}]`                     | ~12 KB | port allocation / conflict checks |
| `services.deploy.json`    | `[{id, mesh, kind, runtime, language, repo_url}]`       | ~40 KB | fleet-runner deploy targeting |

Base URL: `https://raw.githubusercontent.com/baditaflorin/services-registry/main/<file>`.

Only fall back to the full `services.json` when you need fields the
slices don't carry (auth surface details, vhost knobs, descriptions).
Slices are derived — never edit them; edit `services.json` /
`overrides.json` and run `python3 bin/generate.py`.

Every entry in the registry has three orthogonal classifying axes.
Don't conflate them — agent tooling gates behavior on `kind`, not on
mesh.

### Axis 1 — `kind` (what shape of deployable)

| `kind`      | What it is                                  | Has port? | `/health`? | Workspace on LXC? | Bumpable version? | Counted in `fleet-runner health` / `smoke` / `deploy`? |
|-------------|---------------------------------------------|-----------|------------|-------------------|--------------------|--------------------------------------------------------|
| `container` | Docker service on the dockerhost            | yes       | yes        | yes               | yes                | yes                                                    |
| `static`    | Static GitHub Pages site                    | no        | no         | no                | no                 | **no** — has its own `fleet-runner pages-audit`        |

If this repo's `service.yaml` (or registry entry) says `kind: static`,
**stop looking for a Dockerfile, a port, or Go code**. Pages services
are HTML/CSS/JS published by GitHub Pages CI — there is no container
to deploy and no `/health` to probe.

### Axis 2 — `mesh` (which network + auth domain)

| `mesh`       | Domain pattern         | Auth                                                                       | Typical contents                       |
|--------------|------------------------|----------------------------------------------------------------------------|----------------------------------------|
| `mesh-0exec` | `<slug>.0exec.com`     | `?api_key=…` or `X-API-Key` header — keystore-gated                        | proxy, search, ocr, security           |
| `mesh-0crawl`| `<slug>.0crawl.com`    | `Authorization: Bearer` / `X-API-Key` / `?api_key=…` — keystore-gated (same auth surface as 0exec) | domains, recon, web-analysis           |
| `mesh-pages` | `*.github.io` / custom | none (static)                                                              | dashboards, catalogs, browser-only WASM apps |

Both container meshes are gated by the **same** keystore (see auth
section below). One revoke = killed everywhere. The 0crawl path-token
shape is preserved as a backwards-compat alias and feeds into the
same `auth_request` flow on the nginx side.

### Axis 3 — `runtime` (how it's started)

| `runtime`     | What it means                                             |
|---------------|-----------------------------------------------------------|
| `compose`     | Default for `kind: container`. Docker-compose on the dockerhost; deploy = `docker compose pull && up -d` |
| `systemd`     | Reserved — a service unit on a host; deploy = `systemctl restart` |
| `binary`      | Reserved — a static binary run by hand or by a launcher    |
| `k8s`         | Reserved — managed by a kube manifest                      |
| `github-pages`| Default for `kind: static`. Built and served by GitHub Pages CI |
| `external`    | Reserved — runs outside the fleet, included for reference only |

`runtime` is orthogonal to `language`. A Go service might be `runtime: compose` today and `runtime: systemd` tomorrow without re-classifying it as a different language or kind. `fleet-runner deploy` dispatches on `runtime`.

### Axis 4 — `language` (primary implementation)

| `language` | When to use it                                                 |
|------------|----------------------------------------------------------------|
| `go`       | Default for `kind: container` in this fleet                    |
| `node`     | Node.js services (a handful of proxies + Bing/Duck SERP scrapers) |
| `python`   | Python services (currently 1: `python-proxy`)                  |
| `c`        | C services (currently 1: `c-proxy`)                            |
| `rust`     | Reserved for future use                                        |
| `html`     | Default for `kind: static` — plain HTML/CSS/JS Pages sites     |
| `wasm`     | Static Pages site whose primary payload is a WASM binary       |
| `other`    | Anything that doesn't fit                                      |

`fleet-runner --filter language=go converge` (or `--filter
kind=container,language=go update-dep …`) narrows bulk operations so
a Go-only dep bump never touches a Node, Python, or static service.

Look at `service.yaml` in this repo to see which axes apply.

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

## Key sibling repos

| Repo                  | Role                                                                           | Visibility |
|-----------------------|--------------------------------------------------------------------------------|------------|
| `services-registry`   | canonical catalog (services.json + FLEET.md + this file)                       | PUBLIC     |
| `go-common`           | shared Go lib — SSRF-safe HTTP, jsbundle recovery, **apikey client**, ua, middleware | PUBLIC |
| `go-apikey-service`   | **the keystore** — issues/verifies/revokes API keys for `mesh-0exec`           | varies     |
| `go-catalog-service`  | renders services.json into `catalog.0exec.com`                                 | PRIVATE    |
| `go_fleet_runner`     | CLI to operate the fleet (`health`, `smoke`, `inject`, `push`, …)              | PRIVATE    |
| `0crawl-platform`     | nginx vhost templates (also embedded in fleet-runner)                          | PRIVATE    |
| `fleet-state`         | live operational state, runbooks, SSH topology                                 | PRIVATE    |

## Auth — both container meshes use the **same** keystore (`go-apikey-service`)

**The keystore is the fleet's single point of compromise.** Treat it
like a CA root: every `0exec` and `0crawl` service trusts whatever it
says. If this repo is on `mesh-pages` (i.e. `kind: static`), the
keystore does not apply — skip this section.

Three canonical request shapes (every mesh, every service):

  1. `Authorization: Bearer <key>` — production canonical, what every SDK uses.
  2. `X-API-Key: <key>` — legacy header alias, same handler.
  3. `?api_key=<key>` — demo / browser-playground only (key leaks in logs).

A fourth legacy shape, `https://<slug>.0crawl.com/t/<token>/...`, **was
deprecated on 2026-05-14**. The gateway returns **410 Gone** with
`Location: /<rest>?api_key=<token>` and a `Deprecation` header for any
caller still using it. After one deprecation cycle (~2026-06-14) the
410 block will be removed; `/t/<anything>` will return plain 404.

Request flow at the gateway:

1. **nginx vhost** captures the key into `$api_key_in` (Bearer regex →
   X-API-Key header → ?api_key query, in that order).
2. **Static fallback** — if `$api_key_in` matches the universal demo
   key (`$default_token`, from `/etc/nginx/conf.d/_default_token.conf`),
   accept immediately and set `X-Auth-User: demo`. Survives keystore
   outages for the public demo path. The default token is rate-limited
   to 1 req/s and ~60 req/h per IP at this layer.
3. Otherwise nginx POSTs `X-Verify-Key: $api_key_in` to the keystore's
   `/verify` via `auth_request`.
4. Keystore checks SQLite → returns 200 + `X-Auth-User` / `X-Auth-Scope`,
   or 401.
5. On 200, nginx forwards the original request to the service container
   with `X-Auth-*` headers AND `X-API-Key: $api_key_in` populated, so
   the upstream `middleware.TokenAuthKeystore` sees a positive auth
   signal regardless of which gateway auth path was taken.

**Services do not call the keystore themselves** — nginx already gated
the request. Trust the gateway-injected `X-Auth-*` headers. If you
genuinely need verification inside a service (admin tooling, internal
RPC), use the canonical clients — never handroll HTTP calls:

```go
// Middleware (preferred — gateway header fast-path + keystore fallback + Cache + fail-closed 503):
import "github.com/baditaflorin/go-common/middleware"   // ≥ v0.7.0
// Direct client (only for non-HTTP-handler code):
import "github.com/baditaflorin/go-common/apikey"
c := apikey.New() // reads APIKEY_SERVICE_URL + APIKEY_SERVICE_ADMIN_TOKEN
verifier := apikey.NewCache(c) // 15-min positive cache, no negative cache
result, err := verifier.Verify(ctx, userKey)
```

Keystore outage behaviour (designed-in graceful degradation):
- **Static fallback** in nginx keeps the public demo key working.
- **`apikey.Cache`** in each service keeps recently-verified callers
  working ~15 min.
- **Snapshot data** in `fleet-state/state/snapshot.json` flags the
  keystore as BROKEN once `/health` fails — that's the alert.
- **Recovery procedure**: private `fleet-state/RUNBOOK.md` under
  "keystore outage".

The admin token (`X-Admin-Token` on `/issue`, `/revoke`, `/list`,
`/purge`) is stored as `ADMIN_TOKEN` on the keystore container and
read by clients from `APIKEY_SERVICE_ADMIN_TOKEN`. Rotation playbook:
private `fleet-state/OPS.md`.

## Auth — `mesh-0crawl` legacy `/t/<token>/` shape (DEPRECATED)

Sunset on 2026-05-14. The gateway returns **410 Gone** with
`Location: /<rest>?api_key=<token>` and `Deprecation: version="v1"`.
Any SDK or client still using `/t/<token>/...` should follow the
`Location` header to the canonical shape. The 410 block itself will
be removed in the following deprecation cycle; after that
`/t/<anything>` returns 404.

Defense in depth: `go-common/middleware` v0.11.0 dropped path-token
extraction from `extractToken`, so even a caller bypassing the gateway
and hitting an upstream container directly with `/t/<token>/...` will
not be authenticated. The only paths that work are the three canonical
auth shapes documented above.

## `go-common` packages — use these, don't reinvent

| Package      | Import path                                       | Purpose                                                 |
|--------------|---------------------------------------------------|---------------------------------------------------------|
| safehttp     | `github.com/baditaflorin/go-common/safehttp`      | SSRF-safe HTTP client, DNS-rebind guard                 |
| ua           | `github.com/baditaflorin/go-common/ua`            | Standard User-Agent builder                             |
| jsbundle     | `github.com/baditaflorin/go-common/jsbundle`      | source-map recovery for scanning JS bundles             |
| apikey       | `github.com/baditaflorin/go-common/apikey`        | keystore client (`Verify`, `Cache`, admin endpoints)    |
| middleware   | `github.com/baditaflorin/go-common/middleware`    | `TokenAuthKeystore` HTTP middleware (≥ v0.7.0)          |

```go
import (
    "github.com/baditaflorin/go-common/safehttp"
    "github.com/baditaflorin/go-common/ua"
)
client := safehttp.NewClient(
    safehttp.WithTimeout(10*time.Second),
    safehttp.WithUserAgent(ua.Build(ServiceID, Version)),
)
// Errors: safehttp.ErrBlocked, safehttp.ErrInvalidScheme, safehttp.ErrMissingHost
u, err := safehttp.NormalizeURL(rawInput)
```

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
- **Tagging**: `git tag <version>` (no `v` prefix), e.g. `1.2.3`.
- **service.yaml** must keep: `id`, `name`, `version`, `port`,
  `category`, `health` block, `test` block.

## `overrides.json` — per-service patches and bulk rules

The catalog is `services.json` (auto-derived). Per-service hand-curated
patches live in `services-registry/overrides.json`. Two shapes coexist:

**Per-slug patches** (current shape, unchanged):
```json
{
  "python-proxy": { "proxy_read_timeout": "300s", "trl": 6 },
  "node-search-bing": { "vhost": { "proxy_buffering": "off" } }
}
```

**Bulk rules** (new, via reserved `$rules` key):
```json
{
  "$rules": [
    {
      "name": "phone-extractor-san-cert",
      "match": { "mesh": "0crawl", "ids": ["a11y-quick", "broken-links", "…"] },
      "patch": { "cert_domain": "phone-extractor.0crawl.com" },
      "why":   "46 vhosts share phone-extractor's SAN cert"
    }
  ]
}
```

Match clauses: any of `ids` (explicit list), `mesh`, `kind`, `language`,
`runtime`, `category` — combined with all-of semantics. Rules apply in
declaration order; per-slug entries win. Use rules to encode "47 services
share this cert_domain" as one line instead of 47.

**Audit surface** — never grep overrides by hand:

```
fleet-runner overrides list   [--filter mesh=0crawl] [--key cert_domain]
fleet-runner overrides explain <slug>      # full breakdown per key + source
fleet-runner overrides audit                # stale slugs, unused rules, key adoption counts
```

`fleet-runner converge` also surfaces overrides drift (stale per-slug
entries that reference removed services; rules with no matching
service).

## fleet-runner

Binary at `/usr/local/bin/fleet-runner` on **Builder LXC 108**. From
any workspace dir on that LXC:

```
fleet-runner health [--insecure]             # /health on all live container services (skips kind=static)
fleet-runner smoke  [--insecure]             # GET example_url on all container services
fleet-runner pages-audit                     # verify pages_url 200s for every kind=static entry
fleet-runner build-test                      # go test ./... in every kind=container,language=go workspace
fleet-runner update-dep <mod@ver>            # bump dep across all language=go repos
fleet-runner inject <src> <dest>             # copy a file into every repo (still all kinds, on purpose)
fleet-runner exec   "<cmd>"                  # shell command in every repo (filterable)
fleet-runner push   "<msg>"                  # commit+push all dirty repos
fleet-runner nginx-render                    # regenerate vhosts from templates
fleet-runner rotate-default-token <value>    # gateway-only rotation, zero repo edits
fleet-runner default-token                   # print the current gateway default token
fleet-runner overrides list                  # per service, which override keys apply (and via which rule)
fleet-runner overrides explain <slug>        # one service: every override key and its source (slug vs rule)
fleet-runner overrides audit                 # stale per-slug entries, unused rules, per-key adoption counts
fleet-runner new-service <name> <port> [cat] # scaffold new service
fleet-runner stats                           # audit log + token usage summary
```

All commands accept `--filter kind=container,language=go` (and so on)
to narrow the set. All commands accept `--tokens-used N --model NAME`
for LLM accounting. **`kind: static` entries are skipped by default
on every container-shaped operation** — don't try to deploy or health-
check a static Pages site.

## Infrastructure topology

| Target          | SSH                                                            |
|-----------------|----------------------------------------------------------------|
| Bastion         | `ssh root@0docker.com`                                         |
| Builder LXC 108 | `ssh root@0docker.com 'pct exec 108 -- bash -lc "<cmd>"'`      |
| Dockerhost VM   | `ssh -J root@0docker.com ubuntu_vm@10.10.10.20`                |
| Webgateway      | `ssh -J root@0docker.com florin@10.10.10.10`                   |

- **Builder LXC 108** is a Proxmox container on `0docker.com`. Hosts
  per-service build workspaces at `/root/workspace/<repo>/` and the
  `fleet-runner` binary.

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
- **Dockerhost VM** runs the service containers. Compose dirs:
  `/opt/services/<repo>/`, `/opt/security/<repo>/`,
  `/home/ubuntu_vm/pentest/<repo>/`.
- **Webgateway** runs nginx (the public TLS terminator) and the
  keystore-aware `auth_request` flow.
- Build + push: `docker buildx build --platform linux/amd64 --provenance=false -t ghcr.io/baditaflorin/<id>:<ver> --push .`

Operational topology and credentials are in **private**
`fleet-state/OPS.md` — never commit SSH targets, IPs, or tokens to
service repos.

## Session continuity — handing off to a fresh agent

When a session gets long enough that context feels tight, hand off to a
new Claude with [`RESUME-PROMPT.md`](RESUME-PROMPT.md). It's a copy-paste
first-message that carries forward what's been built, what's deployed,
what's blocked, and where to pick up — so the user doesn't have to repeat
themselves. The prompt stays public (no topology / IPs / tokens); it
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
- **Gateway IP**: `176.9.123.221` — every fleet A record points here;
  nginx terminates TLS and routes to the right upstream port.
- **Token env name**: `HCLOUD_TOKEN` (canonical, matches hcloud-cli +
  official Go SDK). `HETZNER_TOKEN` kept as back-compat alias.
- **Secrets**: live in `go-fleet-secrets`, NEVER in env on dockerhost,
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
`fleet-runner deploy go_<repo>`. The shim is dumb — it just forwards
argv over SSH to LXC 108 — so output, exit codes, and prompts behave
exactly as on the LXC. Source: [`services-registry/bin/fleet-runner-shim`](bin/fleet-runner-shim).

### Recipe — Allocating a port for a new service (or resolving a conflict)

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
3. Add an entry to `services.json` with **both** `host_port` (e.g.
   `18099`) and `container_port` (what the service binds inside its
   docker container — usually `8xxx`).
4. Verify no clash: `grep -E '"(host\|container)_port":\s*<your-pick>' services-registry/services.json` should return only your line.

**When you hit "port X is already taken" — the case Gemini got wrong:**

The registry is the truth, not the running container. Find the
squatter:

```bash
# Anyone claiming this port in the registry?
python3 -c "import json; d=json.load(open('services-registry/services.json')); print([e['id'] for e in d if e.get('container_port')==8313 or e.get('host_port')==8313])"

# Services WITHOUT a registered host_port (likely silent squatters):
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner audit registry-host-port-set'
```

If the squatter has no registry entry, **add one for it** with
`allocate-port`. Your service keeps its original port. Only reallocate
your service's port if the squatter has a legitimate registered claim.

### Recipe — Bumping a service version (atomically across all files)

**Canonical:** `fleet-runner bump-version` updates `service.yaml`, any
`const Version = "..."` in `main.go`/`version.go`, creates the git
tag, and (with `--push`) pushes commit + tag together:

```bash
# Local bump (writes files, prints next steps for review)
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> patch'

# Atomic bump + commit + tag + push (one-shot)
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner bump-version go_<repo> patch --push'

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

**Canonical (only one right answer):**

```bash
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner deploy go_<repo>'
```

`fleet-runner deploy` is idempotent end-to-end. The pipeline is built
to fail fast BEFORE touching prod, and to refuse to declare success
unless every check confirms the new image actually carries the new
code AND the cross-service-call gate is green:

1. **DNS / vhost / cert** — idempotent shape checks.
2. **Drift detection** — reads `service.yaml` `version` from
   `origin/main` via `git show` (NOT the long-lived workspace tree,
   which is shared and routinely stale) and compares to the live
   `GET /version`. If they match, the deploy is an idempotent no-op.
3. **Pre-flight** (Go repos) — in a fresh `git worktree add origin/main`
   on Builder LXC 108, run `go build ./...` and `go test ./...`.
   Failure aborts here; prod is not touched.
4. **Build + push** — `docker buildx build --platform linux/amd64
   --provenance=false --push` tagging both `:<version>` and
   `:latest`.
5. **Pull + digest assertion** — `docker compose pull` on dockerhost,
   then `docker inspect` the new `:latest` digest. If it equals the
   previously-running digest, the deploy fails: the new manifest
   didn't propagate (GHCR auth scope, tag cache, platform mismatch),
   and rolling forward would be a no-op masquerading as a deploy.
6. **Roll** — `docker compose up -d` recreates the container.
7. **Health-wait** — poll `docker inspect …{{.State.Health.Status}}`
   until "healthy" (up to 90s). "unhealthy" fails immediately;
   "starting" keeps polling; empty = no HEALTHCHECK directive,
   trust the container and proceed.
8. **Smoke gate** — three probes: `GET /health` must be 200, `GET
   /selftest` must be 200 (or 404 = "service didn't implement it,
   skip"); 503 is the codified "internal sources errored" signal and
   fails the gate. `GET /version` must match the version we just
   pushed — catches "container restarted but the image didn't roll".
9. **Rollback on smoke fail** — captures the previous image digest
   before the roll; on smoke failure, retags that digest as `:latest`
   on the dockerhost (no GHCR roundtrip) and `compose up -d`, waits
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
  cd /opt/services/go_<repo>/src
  git pull origin main
  sudo docker compose pull && sudo docker compose up -d
'

# 3. Update the gateway-served deployment metadata (catalog UI reads it)
ssh -J root@0docker.com florin@10.10.10.10 '
  echo "{\"sha\":\"$(git rev-parse HEAD)\",\"version\":\"<version>\",\"deployed_at\":\"$(date -u +%FT%TZ)\"}" \
    | sudo tee /etc/nginx/deploy-meta/<slug>.0exec.com.json
  sudo nginx -s reload
'

# 4. Smoke test
curl -sSf https://<slug>.<mesh>.com/health
```

If step 3 or 4 fails, the deploy is incomplete even though the
container is running. Don't declare done until both succeed.

### Recipe — Self-check before declaring "done"

Three commands. Run all three. If anything in the category you touched
is flagged, fix it before stopping:

```bash
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner converge'
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner audit --all'
ssh root@0docker.com 'pct exec 108 -- /usr/local/bin/fleet-runner state snapshot'
```

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
     │             (kind, repo, request, expected, suggested_fix,
     │              [optional] auto_apply + patch_unified_diff)
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

- `skip_not_fleet` — repo not under `baditaflorin/`. Third-party
  repos can never be auto-modified, period.
- `skip_no_auto_apply` — finding must opt in with `auto_apply: true`.
- `skip_no_patch` — must include a `patch_unified_diff`.
- `git apply --check` — patch applies cleanly to a fresh clone before
  any state mutation.
- Test gate — `go test ./...` (or `npm test`) must pass.
- `/selftest` gate — post-deploy, the service's `/selftest` must
  return 200. `/health` only proves the binary booted; `/selftest`
  exercises the patched code path.
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
for every dispatch path's shape.

**Why this matters for THIS repo:** every service that exposes a
public API should ship a `/selftest` endpoint that exercises its
real dependencies (resolver, upstream API, embedded data). Without
it, the autofix `/selftest` gate has nothing to verify against and
defaults to a weaker `/health` probe — which only proves the binary
booted, not that the patched code path works. See
`go-pentest-takeover-checker` and `go-pentest-subfinder` (v0.2+)
for the canonical pattern.

### Anti-patterns — observed in prior agent sessions

1. **"Port 8313 is taken, I'll pick 8500 and edit `service.yaml`."** Use
   `fleet-runner allocate-port` and register the squatter. See "Allocating
   a port" above.

2. **"I bumped the version in `service.yaml` and pushed."** Did you tag
   git AND push the tag AND update the docker image tag? Use
   `fleet-runner bump-version --push`.

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

## Fleet-wide changes — change `go-common`, not consumers

The cardinal rule when you'd otherwise touch every service: **modify
the library and bump the dep.** A `go-common` patch plus
`fleet-runner update-dep github.com/baditaflorin/go-common@vX.Y.Z`
beats 130 PRs.

## Local workflow

- Local workspace root: `/Users/live/Documents/Codex/2026-05-08/`.
  Sibling repos sit next to this one — read them directly when you
  need to understand a dependency.
- CI: there is none. Husky pre-commit hooks + local `npm run smoke`
  (Node repos) or `go test ./...` (Go repos) are the gate. Don't
  scaffold GitHub Actions build workflows.
- Supply chain: prefer npm packages ≥ 3 days old over `@latest` —
  accept known CVEs over zero-day supply-chain injection.
