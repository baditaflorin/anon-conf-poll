# Privacy

`anon-conf-poll` ships with no analytics.

## What Is Collected

Nothing is collected by this application server-side because there is no application server.

## What Stays Local

- Attendee invite codes or credentials.
- Poll votes before and after synchronization.
- Exported result data.
- DuckDB query history inside the current browser session.

## What Peers See

Peers in the same room receive replicated Yjs state: poll metadata, vote records, proof public signals, nullifiers, and Q&A items. They do not receive attendee names from the app.

## Transport Caveat

The configured WebRTC signaling server can observe connection metadata needed for peer discovery, such as IP-level network metadata. It is not the source of truth for votes and does not receive attendee identities from the app.
