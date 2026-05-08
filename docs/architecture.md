# Architecture

`anon-conf-poll` is a Mode A static application. GitHub Pages serves the shell, and every runtime capability executes inside the attendee or organizer browser.

## Context

```mermaid
C4Context
    title Context
    Person(organizer, "Organizer", "Creates rooms, imports attendee commitments, exports results")
    Person(attendee, "Attendee", "Votes and submits Q&A anonymously")
    System_Boundary(pages, "GitHub Pages") {
      System(app, "anon-conf-poll", "Static React app")
    }
    System_Ext(signaling, "WebRTC signaling", "Configurable y-webrtc signaling endpoint")
    Rel(organizer, app, "Uses")
    Rel(attendee, app, "Uses")
    Rel(app, signaling, "Peer discovery")
```

## Container

```mermaid
C4Container
    title Browser containers
    Person(user, "Browser user")
    System_Boundary(browser, "Browser") {
      Container(ui, "React UI", "TypeScript", "Room, poll, Q&A, export workflows")
      Container(crdt, "Yjs document", "Yjs", "Shared room state")
      Container(proofs, "Proof engine", "Semaphore", "Group membership proof and nullifier verification")
      Container(crypto, "Crypto helpers", "libsodium", "Hashes, random bytes, local encryption helpers")
      ContainerDb(storage, "IndexedDB", "idb-keyval", "Local rooms and credentials")
      ContainerDb(duckdb, "DuckDB-WASM", "WASM", "Local SQL analytics")
    }
    System_Ext(peer, "Other browsers")
    Rel(user, ui, "Interacts")
    Rel(ui, crdt, "Reads/writes")
    Rel(ui, proofs, "Generates and verifies proofs")
    Rel(ui, duckdb, "Loads result table")
    Rel(ui, storage, "Persists local state")
    Rel(crdt, peer, "WebRTC mesh sync")
```

## Boundaries

- The frontend bundle is public and contains no secrets.
- Credentials are generated or imported locally.
- Votes are accepted only after nullifier and group membership checks.
- Exports are generated locally; no central analytics service receives attendee data.
