# 0015 - Deployment Topology

## Status

Accepted

## Context

ADR 0001 selects Mode A.

## Decision

Deploy only to GitHub Pages:

- Source repository: `https://github.com/baditaflorin/anon-conf-poll`
- Live URL: `https://baditaflorin.github.io/anon-conf-poll/`
- Pages source: `main /docs`

No Docker, nginx, or runtime API topology is used.

## Consequences

- There is no server to patch, back up, or monitor.
- WebRTC signaling remains an external configurable transport.
- Custom domain support can be added by committing `docs/CNAME`.

## Alternatives Considered

- Docker backend on port 25342: rejected for v1 because no runtime API is required.
