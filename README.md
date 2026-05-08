# anon-conf-poll

Live GitHub Pages site: https://baditaflorin.github.io/anon-conf-poll/

GitHub repository: https://github.com/baditaflorin/anon-conf-poll

Support development: https://www.paypal.com/paypalme/florinbadita

Static, anonymous live polling with CRDT sync, zk one-vote proofs, and local analytics.

## Quickstart

```sh
npm install
make install-hooks
make dev
make test
make build
```

## What It Does

`anon-conf-poll` lets attendees vote and submit Q&A from a shared URL. Poll state syncs between browsers with Yjs over WebRTC, eligibility is checked with Semaphore-style zero-knowledge membership proofs and per-poll nullifiers, and organizers can export/query results locally with DuckDB-WASM. The app is designed for GitHub Pages first: no application server, no attendee identity database, and no secrets in the frontend.

![anon-conf-poll demo](docs/demo.png)

## Architecture

```mermaid
C4Context
    title anon-conf-poll context
    Person(organizer, "Organizer", "Creates poll rooms and imports attendee commitments")
    Person(attendee, "Attendee", "Votes and asks questions from a URL")
    System_Boundary(pages, "GitHub Pages static boundary") {
      System(app, "Browser app", "React, Yjs, WebRTC, Semaphore, libsodium, DuckDB-WASM")
    }
    System_Ext(stun, "Public WebRTC signaling/STUN", "Configurable peer discovery transport")
    Rel(organizer, app, "Creates rooms and exports results")
    Rel(attendee, app, "Votes anonymously")
    Rel(app, stun, "Discovers peers; no poll identities stored")
```

More detail lives in `docs/architecture.md` and `docs/adr/`.

## Deployment

This is a Mode A static site. Vite builds directly into `docs/`, which GitHub Pages serves from `main /docs`.

```sh
make build
make pages-preview
```

## Security

Never commit secrets. The frontend contains only public configuration and static assets. See `SECURITY.md` for disclosure guidance and `docs/privacy.md` for privacy details.
