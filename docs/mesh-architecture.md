# How the mesh actually works

What happens, end-to-end, when your MacBook and your phone load the same room URL and end up showing each other's votes.

## The pieces

- **Browser A** (MacBook Air, on home wifi behind your router's NAT)
- **Browser B** (phone, on LTE behind carrier NAT)
- **GitHub Pages** — serves the static HTML/JS bundle (`https://baditaflorin.github.io/anon-conf-poll/`)
- **Your Hetzner box** (`176.9.123.221`, exposed as `turn.0docker.com`) running three Docker services:
  - **token-server** at `https://turn.0docker.com/credentials` — issues short-lived TURN credentials
  - **signaling** at `wss://turn.0docker.com/ws` — relays WebRTC handshake messages
  - **coturn** at `turn:turn.0docker.com:3479` — UDP/TCP TURN relay for peers that can't connect directly
- **Google's public STUN servers** (`stun.l.google.com:19302`) — helps each browser learn its own public IP

## The flow

### 1. Page load

Both browsers fetch the static app from GitHub Pages over HTTPS. After this point, GitHub is out of the loop entirely — the page is a self-contained SPA.

### 2. TURN credential fetch

Each browser fires `GET https://turn.0docker.com/credentials` with `Origin: https://baditaflorin.github.io`. The token-server checks the Origin against its allowlist, then generates:

```
username = unix_timestamp_of_expiry        (now + 3600)
password = base64(HMAC-SHA1(TURN_SECRET, username))
```

This is the standard "TURN REST API" pattern ([RFC draft](https://datatracker.ietf.org/doc/html/draft-uberti-behave-turn-rest-00)). The secret never leaves the server. The credentials expire after one hour so leaked tokens have a tight blast radius. Returned JSON:

```json
{
  "username": "1778508473",
  "password": "oQNoBKAyiXv5VcmpZRbTQhADoIY=",
  "ttl": 3600,
  "uris": ["turn:turn.0docker.com:3479"]
}
```

The browser saves this to `localStorage` as the active ICE-server list (alongside two Google STUN servers).

### 3. Signaling WebSocket

Each browser opens `wss://turn.0docker.com/ws`. Nginx on the front-of-stack VM (`10.10.10.10`) proxies the upgrade to the signaling container (`10.10.10.1:4444`). Both browsers send:

```json
{"type":"subscribe","topics":["anon-conf-poll:room-27fc5f6d42f144b9"]}
{"type":"publish","topic":"anon-conf-poll:room-…","data":{"type":"announce","from":"random-uuid-A"}}
```

The signaling server is a 70-line Node.js program. It maintains a `Map<topic, Set<ws>>` and forwards every `publish` to every other subscriber of that topic. **It does not know what's inside `data`.** The whole signaling protocol is "broadcast this JSON blob to everyone else in this topic."

### 4. ICE candidate gathering

Each browser creates an `RTCPeerConnection` configured with:

```js
{
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:turn.0docker.com:3479", username, credential }
  ];
}
```

The browser then gathers three flavors of candidate addresses for itself:

- **host** — direct LAN address (`192.168.1.42`)
- **srflx** (server-reflexive) — what STUN reflects back: your home router's public IP and port, learned by asking `stun.l.google.com:19302` "what do you see as my source address?"
- **relay** — your browser tells coturn "allocate me a UDP port on your side"; coturn responds with `176.9.123.221:51234`. Now any UDP packet sent to that port gets relayed back to your browser.

### 5. Offer/answer exchange via signaling

The initiating browser (`A`) calls `createOffer()` and gets an SDP blob. It publishes:

```json
{
  "type": "publish",
  "topic": "room-…",
  "data": {
    "type": "signal",
    "from": "uuid-A",
    "to": "uuid-B",
    "signal": { "type": "offer", "sdp": "…" }
  }
}
```

Signaling forwards to B. B calls `setRemoteDescription`, then `createAnswer()`, and sends an answer back the same way. Each peer also publishes every ICE candidate as it gets gathered (trickle ICE). After this exchange both browsers have a complete picture of how the other is reachable.

### 6. Connectivity checks

The browsers now try every (local candidate × remote candidate) pair simultaneously, sending STUN binding requests over each pair. The first pair that succeeds in both directions wins.

Priority order roughly:

1. **host ↔ host** — both on the same LAN. Works if your Mac and phone are both on your home wifi.
2. **srflx ↔ srflx** — public IP to public IP, "punching through" both NATs. Works for ~80% of consumer NATs.
3. **relay** — both peers send through coturn. Always works (as long as coturn is reachable) but doubles the bandwidth and adds your-server-side latency.

For your Mac on wifi + phone on LTE: srflx ↔ srflx usually wins. Same wifi: host ↔ host wins. Symmetric NAT or strict corporate firewall: falls back to relay.

### 7. Data flow

Once the connection is up, an `RTCDataChannel` carries Yjs CRDT updates and Awareness state. Every vote, every question, every "who's online" ping is a few hundred bytes over that channel. The signaling server only sees the initial handshake — once the peers are connected, no app data flows through your Hetzner box (unless TURN was the winning path).

### 8. Peer churn

When a browser tab closes, its data channel closes; Yjs's awareness reflects it. When iOS Safari backgrounds the tab, it sends `close(1001)` to signaling; on resume, lib0/websocket auto-reconnects within ~270ms. y-webrtc re-announces, the peer is re-discovered, a new RTCPeerConnection is negotiated. Locally-cached Yjs state catches up via CRDT merge — no votes lost.

## What's running on your Hetzner box

```
176.9.123.221  (Proxmox host, public IP)
├── enp4s0           public interface
├── vmbr1 10.10.10.1  internal bridge
│
├── /opt/turn/coturn-hetzner       network_mode: host
│   └── coturn  listening on 0.0.0.0:3479 udp/tcp
│       --use-auth-secret --realm=turn.0docker.com
│       --external-ip=176.9.123.221
│       --min-port=49152 --max-port=65535
│
├── /opt/turn/turn-token-server    port 10.10.10.1:3001
│   └── 70-line Node.js HMAC credential issuer
│
├── /opt/turn/signaling            port 10.10.10.1:4444
│   └── 70-line Node.js y-webrtc signaling
│
└── nginx VM (10.10.10.10) — TLS termination, reverse proxy
    ├── turn.0docker.com:443 /credentials  → 10.10.10.1:3001
    ├── turn.0docker.com:443 /ws           → 10.10.10.1:4444 (WebSocket upgrade)
    └── Lets Encrypt cert renewed via certbot webroot
```

External traffic flow:

- Hetzner's network → Proxmox host enp4s0 → iptables DNAT (80/443) → nginx VM
- nginx terminates TLS, proxies to the right container by path
- coturn's UDP traffic on 3479 + 49152–65535 hits the host directly (network_mode: host bypasses the DNAT for those ports)

## Why this took so long to get right

- `wss://signaling.yjs.dev` (y-webrtc's default) is a dead Heroku app with no DNS — the app silently fell back to it and just never connected.
- Self-hosting the signaling server is easy (70 lines) but the wire format has one subtle gotcha: text vs binary frames. We hit it. See `postmortem-phase4-mesh-deadlock.md`.
- TURN setup has many small moving parts that all have to be right at once: HMAC secret, external-ip, port range, firewall, DNS, TLS cert, Origin allowlist on the token server, env vars baked into the SPA build.
