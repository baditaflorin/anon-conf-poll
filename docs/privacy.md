# Privacy & Security

`anon-conf-poll` ships with no analytics, no application server, and no backend that sees vote contents. This document explains exactly what each party in the system can and cannot see, so you can decide whether the privacy properties match your threat model.

## Glossary

- **You** — the operator running this app (e.g. florin running it on `baditaflorin.github.io`).
- **Voter** — someone with a valid invite who casts a vote in a room.
- **Peer** — any browser currently connected to a given room's mesh (voters, the operator's browser, anyone with the room URL).
- **Hetzner / your host** — whoever runs the signaling + coturn + token-server infrastructure (in the default deployment, that's a Hetzner dedicated server you control).
- **GitHub** — serves the static SPA from GitHub Pages.

## What flows where

| Data | Stays in browser | Sent to peers | Sent to your Hetzner box | Sent to GitHub |
|---|---|---|---|---|
| Attendee names, emails (roster) | ✅ | ❌ | ❌ | ❌ |
| Invite secrets / Semaphore identities | ✅ | ❌ | ❌ | ❌ |
| Room manifest (poll questions, options, attendee *commitments*) | ✅ | ✅ via WebRTC | ❌ (the URL fragment is never sent in HTTP) | ❌ |
| Cast votes (anonymous, with ZK proof) | ✅ | ✅ via WebRTC | ❌ unless TURN-relayed (then encrypted) | ❌ |
| Q&A items | ✅ | ✅ via WebRTC | ❌ unless TURN-relayed (then encrypted) | ❌ |
| Peer ID (random UUID per session) | ✅ | ✅ in signaling | ✅ in signaling | ❌ |
| Your public IP | ✅ | ✅ in ICE candidates (SDP) | ✅ in TCP socket + ICE candidates | ✅ on page load |
| WebRTC SDP blobs | ✅ | ✅ via signaling | ✅ but treated as opaque JSON | ❌ |
| TLS handshake metadata (SNI = `turn.0docker.com`) | ❌ | ❌ | ✅ | ❌ |
| TURN credentials (HMAC username/password) | ✅ | ❌ | ✅ when fetched | ❌ |

## Where the anonymity actually comes from

The "anon" in `anon-conf-poll` is **cryptographic**, not network-level. It comes from [Semaphore](https://semaphore.appliedzkp.org/), a zero-knowledge group membership proof:

1. When invites are minted, each attendee gets a private **identity commitment** that is published in the room manifest's merkle tree.
2. When casting a vote, the attendee's browser generates a Semaphore proof that says: *"I know a secret whose commitment is in this merkle tree, and I am voting `X` on poll `Y`, and my nullifier for `(Y, secret)` is `N`."* — without revealing which commitment is theirs.
3. Other peers verify the proof and accept the vote. The nullifier `N` prevents the same voter from voting twice on the same poll (without identifying them).

Result: even with the full vote stream from the mesh, no peer can link a vote to a specific attendee. The voter could be anyone in the attendee set.

**This is independent of who can see the network traffic.** Even if your Hetzner box logged every byte forever, the vote contents would (a) be DTLS-encrypted between peers and unreadable to your server, and (b) even if decrypted, only contain Semaphore proofs that don't identify the voter.

## What your Hetzner box can see

You operate the signaling server, the TURN credential issuer, and the coturn TURN relay. Concretely, your server sees:

1. **Signaling traffic** — every WebSocket message routed between peers in any room. Each message looks like:
   - `subscribe / unsubscribe` with a topic name like `anon-conf-poll:room-27fc5f6d…`
   - `publish` with an opaque `data` blob, which carries:
     - peer announces (random UUIDs)
     - SDP offer/answer blobs (these contain ICE candidates → which contain **public IPs** of both peers, and sometimes local LAN IPs)
     - ICE candidate updates as they're trickled
   - `ping`/`pong` keepalives
2. **Token issuance** — every call to `GET /credentials` with an `Origin` header. Logs include source IP, timestamp, and the issued (timestamp, hmac) pair.
3. **TURN allocations** (only when peers fall back to relay):
   - Source IP + port of the allocating client
   - Allocated relay port
   - Total bytes relayed (in coturn's session logs)
   - The actual byte stream — but **DTLS-SRTP encrypted with keys negotiated between peers**, so unreadable by coturn.
4. **TLS termination metadata** — nginx logs include source IP, path, response code, user-agent for each HTTPS request to `turn.0docker.com`.

What your server **cannot** see:
- Vote contents, Q&A text, attendee names, invite secrets.
- The room manifest (lives in the URL fragment, never sent over the wire — the SPA reads it from `location.hash`).
- Direct peer-to-peer traffic when ICE finds a host or srflx path (most of the time).

## What other peers in the room can see

When you join a room you're in a fully-connected mesh with every other peer. Each peer can:

- See your random peer UUID (regenerates per page load).
- See your **public IP** (and sometimes your LAN IP via `host` ICE candidates — though modern Chrome/Firefox mitigate this with mDNS-obfuscated candidates).
- See every vote published in the room, including the Semaphore proof and nullifier (but not which voter cast it).
- See every Q&A item.

What other peers cannot see:
- Your attendee identity (the Semaphore proof is anonymous within the attendee set).
- Your local attendee roster.
- Your invite secret.

⚠️ **Anyone who has the room URL is a peer.** There is no authentication. The URL fragment contains the room manifest including the merkle root of attendee commitments. Whoever has the link can join the mesh, see all votes, and try to publish their own (their vote will be rejected if they don't have a valid Semaphore identity in the tree).

## What GitHub can see

GitHub Pages serves the static SPA. On page load it sees:
- Your IP and user-agent.
- The exact path requested (`/anon-conf-poll/` or with hash, but **hashes are never sent in HTTP requests** — so GitHub does not see the room ID).

After load, GitHub has no further involvement.

## Threat model summary

| Adversary | Can read votes? | Can identify voters? | Can disrupt the room? |
|---|---|---|---|
| Passive network observer (ISP, coffee-shop wifi) | ❌ (TLS to GitHub + signaling, DTLS between peers) | ❌ | ❌ |
| Your Hetzner host (you) / a compromise of it | ❌ (DTLS) | ❌ for vote contents; ✅ for peer IPs + room IDs | ✅ can take signaling/TURN offline → mesh degrades |
| GitHub (compromised static hosting) | ❌ until they MITM the JS, then ✅ | ✅ if they replace the JS | ✅ can serve broken app |
| Malicious peer with valid invite | ✅ sees all votes | ❌ Semaphore hides which attendee | ✅ can spam Q&A, vote within their own quota |
| Malicious peer **without** invite, but with URL | ✅ sees all votes | ❌ | ✅ can spam Q&A; cannot cast valid votes |
| Coordinated attacker with link + valid invite + traffic-analysis on your Hetzner | ✅ | maybe — correlating timing of an IP appearing in signaling with a vote arriving in the mesh is theoretically possible if the room is small. Probability shrinks with room size. | ✅ |

## Hardening levers you have

If you need stronger anonymity than the defaults provide:

- **Tor browser** — masks the voter's IP from peers, the signaling server, and TURN. Slower, and Tor exit IPs may be blocked by some networks.
- **Force TURN-only** — set the `RTCPeerConnection.iceTransportPolicy` to `"relay"` in `yjsRoom.ts`. Hides peer IPs from each other (only the relay IP is exposed). But all traffic goes through your Hetzner box, which then becomes a tempting traffic-analysis target.
- **Don't host signaling/TURN yourself if you'll be analyzing your own results** — the operator-as-adversary problem. Use a third-party signaling/TURN with no relationship to the vote organizer.
- **Smaller attendee sets are less anonymous.** With 3 attendees, the Semaphore proof narrows the voter to 1-of-3, which combined with timing and IP correlation may de-anonymize. With 30+, this becomes much harder. Aim for room sizes large enough that the anonymity set is meaningful.
- **Don't share the room URL publicly.** The URL is the access control. Treat it like a password.

## What changed from earlier versions

The earlier `Privacy` doc said your server sees "IP-level network metadata." That undersold it. Your server also sees the SDP blobs (with public IPs of all peers), peer UUIDs, room IDs, and — if TURN is the winning ICE path — the encrypted byte stream of every WebRTC message. It still cannot read vote contents, but the metadata exposure is real and worth being explicit about.
