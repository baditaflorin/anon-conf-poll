# Self-hosted WebRTC stack — reference, pattern, and meta-prompt

The maintainer (`baditaflorin`) operates a small WebRTC infrastructure on a single Hetzner VPS at `turn.0docker.com`. Any GitHub-Pages-only static app can point at it and get peer-to-peer connectivity across NATs without standing up its own backend.

This document covers four things, in order:

1. **The stack** — three independently deployable services, all open-source.
2. **The integration pattern** — the exact ~70-line `turnConfig.ts` module to copy into a new app.
3. **Apps already on the stack** — nine repos, what each one demonstrates.
4. **Five new app ideas** that would use it well.
5. **Meta-prompt** — paste this into a fresh Claude Code session to start a new app on this stack without re-deriving any context.

---

## 1. The stack

```
┌─────────────────────────────────────────────────────────────┐
│  baditaflorin/anon-conf-poll  ──┐                           │
│  baditaflorin/cipher          ──┤  (browser apps,           │
│  baditaflorin/meshtrack-studio ─┤   GitHub Pages,           │
│  baditaflorin/your-new-app    ──┘   no backend of their own)│
└──────────────┬──────────────────┬──────────────┬────────────┘
               │                  │              │
               │ wss://           │ https://     │ turn:
               │ turn.0docker.com │ turn.0docker │ turn.0docker
               │ /ws              │ .com/        │ .com:3479
               │                  │ credentials  │
               ▼                  ▼              ▼
       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
       │ signaling-   │   │ turn-token-  │   │ coturn-      │
       │ server       │   │ server       │   │ hetzner      │
       │              │   │              │   │              │
       │ y-webrtc     │   │ HMAC TURN    │   │ TURN relay   │
       │ pub/sub      │   │ creds        │   │ for peers    │
       │ /health      │   │ /health      │   │ behind NAT   │
       │ /metrics     │   │ /metrics     │   │ /metrics:9641│
       └──────────────┘   └──────────────┘   └──────────────┘
        70 lines Node     200 lines Node     coturn 4.6
```

| Repo | Endpoint | What it does |
|---|---|---|
| [baditaflorin/signaling-server](https://github.com/baditaflorin/signaling-server) | `wss://turn.0docker.com/ws` | y-webrtc compatible WebSocket fan-out. Clients `subscribe` to a topic (room name), `publish` JSON blobs, and the server rebroadcasts to every other subscriber. Inspects nothing inside the `data` field. |
| [baditaflorin/turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | Issues time-limited HMAC-SHA1 credentials (1-hour TTL by default). The shared secret never leaves the server. Returns `{username, password, ttl, uris}`. |
| [baditaflorin/coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner) | `turn:turn.0docker.com:3479` UDP/TCP | The actual TURN relay. Runs `coturn 4.6` in Docker with `--use-auth-secret`, validating HMAC creds against the same secret the token server signs with. UDP relay ports 49152–65535. |

All three have `/health`, Prometheus `/metrics`, nginx example configs, and bootstrap scripts. **Total cost: ~4 €/month** on a Hetzner CX22 running all three side-by-side.

If `turn.0docker.com` goes down, every consumer falls back to STUN-only (which works for ~70% of NAT pairs but not symmetric/mobile-carrier NATs). Set `VITE_TURN_TOKEN_URL=""` or `localStorage["<app>:turnTokenUrl"] = ""` to opt out entirely.

### Wire-format gotcha (cost: 3 days of debugging)

The y-webrtc client uses **text** WebSocket frames. The Node.js `ws` library's `on('message', raw => …)` hands you a `Buffer`, and `ws.send(buffer)` sends a **binary** frame, which the browser silently drops because `lib0/websocket` only `JSON.parse`s text. **Always convert** to string before forwarding:

```js
const text = typeof raw === 'string' ? raw : raw.toString('utf8');
peer.send(text);  // ✅
```

This bug is fixed upstream in `signaling-server` v1.0.0+. Don't reimplement signaling without copying that fix.

---

## 2. The integration pattern

Drop this file (or the appropriate flavour) into your app. **Single file, no dependencies, ~70 lines.** Adapt the localStorage key prefix to your app name.

```ts
// src/lib/turnConfig.ts

const DEFAULT_TURN_TOKEN_URL = "https://turn.0docker.com/credentials";
const STORAGE_PREFIX = "your-app";   // ← change this

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

type TurnCredentialResponse = {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
};

function loadTurnTokenUrl(): string {
  if (typeof localStorage === "undefined") return DEFAULT_TURN_TOKEN_URL;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}:turnTokenUrl`);
  if (stored !== null) return stored;
  const env = (import.meta as ImportMeta).env?.VITE_TURN_TOKEN_URL as string | undefined;
  return env ?? DEFAULT_TURN_TOKEN_URL;
}

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const tokenUrl = loadTurnTokenUrl();
  if (!tokenUrl) return STUN_SERVERS;
  try {
    const res = await fetch(tokenUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cred = (await res.json()) as TurnCredentialResponse;
    if (!Array.isArray(cred.uris) || cred.uris.length === 0) {
      throw new Error("token server returned no TURN URIs");
    }
    return [
      ...STUN_SERVERS,
      ...cred.uris.map((u) => ({
        urls: u,
        username: cred.username,
        credential: cred.password,
      })),
    ];
  } catch (err) {
    console.warn("[turn] credential fetch failed, falling back to STUN-only:", err);
    return STUN_SERVERS;
  }
}
```

For y-webrtc apps, **also** define `loadSignalingUrls()`:

```ts
const DEFAULT_SIGNALING_URL = "wss://turn.0docker.com/ws";
const DEAD_SIGNALING_URLS = new Set([
  "wss://signaling.yjs.dev",                          // dead Heroku app
  "ws://signaling.yjs.dev",
  "wss://y-webrtc-signaling-eu.herokuapp.com",        // dead
]);

export function loadSignalingUrls(): string[] {
  if (typeof localStorage === "undefined") return [DEFAULT_SIGNALING_URL];
  const stored = localStorage.getItem(`${STORAGE_PREFIX}:signalingUrl`) ?? "";
  if (stored && DEAD_SIGNALING_URLS.has(stored)) {
    localStorage.removeItem(`${STORAGE_PREFIX}:signalingUrl`);
  } else if (stored) {
    return [stored];
  }
  const envUrl =
    (import.meta.env?.VITE_WEBRTC_SIGNALING as string | undefined) ??
    DEFAULT_SIGNALING_URL;
  return [envUrl];
}
```

### Wiring it into each library

#### y-webrtc

```ts
import { WebrtcProvider } from "y-webrtc";
import { loadSignalingUrls, fetchIceServers } from "./turnConfig";

const iceServers = await fetchIceServers();  // ← await this BEFORE constructing the provider
const provider = new WebrtcProvider(roomName, doc, {
  signaling: loadSignalingUrls(),
  peerOpts: { config: { iceServers } },
});
```

#### PeerJS

```ts
import { Peer } from "peerjs";
import { fetchIceServers } from "./turnConfig";

const iceServers = await fetchIceServers();
const peer = new Peer(myId, { config: { iceServers } });
```

#### Raw `RTCPeerConnection`

If your code is async-friendly:

```ts
const iceServers = await fetchIceServers();
const pc = new RTCPeerConnection({ iceServers });
```

If you need a synchronous constructor (e.g. you're inside a non-async class init), start with `STUN_SERVERS` and upgrade once the fetch resolves:

```ts
import { fetchIceServers, STUN_SERVERS } from "./turnConfig";

const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
void fetchIceServers().then((iceServers) => {
  try { pc.setConfiguration({ iceServers }); } catch { /* peer closed */ }
});
```

**Important**: if your app exchanges SDP out of band (QR code, copy/paste, manual transport — `trust-no-one-anonymizer`, `room-presence-mesh`, `cipher`, `match-proof` patterns), the TURN credentials MUST be configured **before** `setLocalDescription()` runs. Otherwise no relay candidates land in the SDP and cross-NAT calls fail silently.

### Override knobs the user already gets for free

| Where | How | Effect |
|---|---|---|
| Build env | `VITE_TURN_TOKEN_URL=https://your-turn.example.com/credentials` | Override at compile time |
| Build env | `VITE_WEBRTC_SIGNALING=wss://your-signal.example.com/ws` | Override signaling (y-webrtc apps only) |
| Browser runtime | `localStorage["<app>:turnTokenUrl"] = "…"` | Per-browser override |
| Disable TURN | Either set to `""` | Falls back to STUN-only |

---

## 3. Apps already on the stack

These exist; copy their patterns rather than re-inventing.

### Fully self-hosted (signaling + TURN)
- **[anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll)** — anonymous live polling with Semaphore zk proofs. The reference implementation. Has the most thorough docs (`docs/mesh-architecture.md`, `docs/postmortem-phase4-mesh-deadlock.md`, `docs/privacy.md`).
- **[meshtrack-studio](https://github.com/baditaflorin/meshtrack-studio)** — collaborative browser DAW.
- **[physical-kanban-sync](https://github.com/baditaflorin/physical-kanban-sync)** — AprilTag-scanned kanban with CRDT board state.

### Custom signaling, our TURN only
- **[castle-question-hour](https://github.com/baditaflorin/castle-question-hour)** — anonymous reflection prompts; Go backend serves signaling at `/api/v1/signal/{code}`; TURN comes from us.
- **[room-vj](https://github.com/baditaflorin/room-vj)** — synced live visuals; PeerJS for signaling; TURN from us.

### No online signaling at all (QR / copy-paste / capsule exchange), our TURN
- **[cipher](https://github.com/baditaflorin/cipher)** — encrypted group chat; signal capsules exchanged via secure messaging.
- **[match-proof](https://github.com/baditaflorin/match-proof)** — Bloom-filter peer matching.
- **[trust-no-one-anonymizer](https://github.com/baditaflorin/trust-no-one-anonymizer)** — anonymized video calls; manual SDP paste.
- **[implemment-the-following-room-presence-mesh](https://github.com/baditaflorin/implemment-the-following-room-presence-mesh)** — opt-in coffee matches; QR-mediated SDP.

The pattern is: every app has its own `turnConfig.ts` (or `meshConfig.ts`) with a per-app localStorage key prefix and one of three integration styles (y-webrtc, PeerJS, raw `RTCPeerConnection`).

---

## 4. Five new app ideas that would use this stack well

Each is **GitHub-Pages-only** (Mode A build to `docs/`), **fully peer-to-peer**, and uses the self-hosted infra by default with a Settings panel letting users point at their own stack.

### 4.1 `link-relay` — peer-to-peer file transfer

**One-line pitch:** Snapdrop without the LAN requirement.

Sender opens the page, drags a file in, gets a short share URL + QR. Receiver opens the URL on any device anywhere, the file streams via WebRTC DataChannel (TURN-relayed when needed). Nothing touches a server in between. Multi-GB file support via chunking + resumable transfer.

**Why this stack:** the TURN relay is essential — direct WebRTC fails for ~50% of mobile-carrier cross-NAT pairs. Without TURN, this is a LAN-only tool. With TURN, it's a Wormhole/Snapdrop replacement that doesn't need anyone else's server.

**Key tech:** y-webrtc for room discovery; `RTCDataChannel` with backpressure; `File.stream()` + `FileSystemWritableFileStream` for streaming write on the receiver; SubtleCrypto for optional end-to-end encryption (the sender shares a key fragment in the URL hash).

### 4.2 `playback-room` — synchronized ad-hoc music for small gatherings

**One-line pitch:** turn 5 phones into a single distributed speaker without an account.

Host opens the page, picks a track from their device (local file or YouTube URL), gets a room link. Attendees scan, all phones play in sync via WebRTC-based clock synchronization (host broadcasts `audioContext.currentTime` over the data channel, peers compute clock skew and schedule playback). Soft pause / vote-skip from any device.

**Why this stack:** signaling discovers peers; TURN unblocks cross-NAT for someone joining from cellular. Total cost to the host: zero. No Sonos, no Spotify group session, no SaaS.

**Key tech:** WebAudio for precise scheduling, y-webrtc awareness for synchronized playhead, a 30-line clock sync routine (NTP-style RTT measurement over data channel).

### 4.3 `show-of-hands` — anonymous live voting via phone tilt

**One-line pitch:** real-time visible aggregate of N people without raising any hands.

Host displays the page on a projector (a big circle of dots, one per peer). Attendees scan a QR, their phone shows a single full-screen voting button. Each device's accelerometer is interpreted as "up / neutral / down" — tilt phone forward = thumbs up, backward = thumbs down. Live aggregate visible on the projector with anonymized dots. No identity, no roster, no signup.

**Why this stack:** the host's view subscribes to the room's awareness state; each phone publishes its tilt; signaling delivers the awareness updates. TURN is the only way two devices on different cellular providers reliably connect, which is the common case at conferences.

**Key tech:** DeviceMotion API, y-webrtc awareness (anonymous since y-webrtc peer IDs are random UUIDs per session), a Canvas dot-grid for the projector.

### 4.4 `whiteboard-mesh` — in-person collaborative whiteboard with anonymous voting on stickies

**One-line pitch:** FigJam for a workshop, without the SaaS, that disappears when the workshop ends.

Multi-device collaborative whiteboard with sticky notes, drawn lines, and emoji reactions. Anyone can drop a sticky; everyone can drag/edit anyone's. Optional anonymous +1 / -1 votes on each sticky. Host can export the final board as PNG/SVG. State lives entirely in connected browsers — close all tabs and the board is gone.

**Why this stack:** Yjs CRDT over the y-webrtc mesh is the right primitive here (no merge conflicts even with 30 simultaneous editors). TURN is essential for "the senior person in the corner of the room is on cellular".

**Key tech:** y-webrtc, Yjs with a `Y.Map` of sticky positions/contents, optional Semaphore proofs for anonymous voting (copy the pattern from `anon-conf-poll`).

### 4.5 `anon-standup` — distributed-team async/sync standup with theme summary

**One-line pitch:** like a Slack standup bot, but with no identity at all, and the summary is computed in the browser.

Each team member loads the page once a day, types three lines (yesterday / today / blockers) which get broadcast over the mesh as anonymous Semaphore-proofed messages. After everyone has submitted (or after a deadline), a local LLM (via WebGPU + `transformers.js` or via the user's own Ollama) extracts themes: "3 mentions of CI flakiness", "2 people blocked on the security review". The summary appears identically on every connected device.

**Why this stack:** the mesh keeps the message stream peer-to-peer, so no employer's IT can read individual contributions. TURN handles VPN/firewall situations. Semaphore proofs make sure only invited team members can contribute, without identifying which one. No backend, no per-seat licensing.

**Key tech:** Semaphore (copy from `anon-conf-poll`), Yjs append-only log, in-browser LLM via `@huggingface/transformers` or proxied Ollama, IndexedDB for the daily archive.

---

## 5. Meta-prompt for a new Claude Code session

Paste this verbatim into a fresh Claude Code session when you want to start a new app on this stack. It is intentionally self-contained so the new session doesn't need to read the 500k-token history that produced this document.

````markdown
I want to build a new GitHub-Pages-only, peer-to-peer browser app using my
existing self-hosted WebRTC infrastructure. Please follow this brief
exactly. Do NOT re-derive any of it — every claim in here is the result of
many days of debugging that already happened.

## App I want to build

[ describe your app in one paragraph here ]

## Constraints

- Static build, hosted on GitHub Pages from `docs/` (Mode A).
- No backend of my own. The app uses my self-hosted WebRTC infrastructure
  (see below) for signaling and TURN relay. Nothing else server-side.
- Vite + React + TypeScript unless I say otherwise.
- A Settings panel must let users override the signaling / TURN endpoints
  via input fields that write to localStorage. Apps must work if my infra
  goes down — fall back to STUN-only with a warning.
- Privacy: any peer-to-peer message visible to other peers in the mesh is
  considered public among them. If anonymity matters, use Semaphore proofs
  (see `anon-conf-poll` for the pattern). State the threat model in
  `docs/privacy.md`.

## Self-hosted infrastructure (use these endpoints by default)

| Repo | Endpoint | Purpose |
|---|---|---|
| [signaling-server](https://github.com/baditaflorin/signaling-server) | `wss://turn.0docker.com/ws` | y-webrtc protocol WebSocket fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner) | `turn:turn.0docker.com:3479` | TURN relay |

Read [docs/self-hosted-webrtc-stack.md in anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll/blob/main/docs/self-hosted-webrtc-stack.md)
for the full integration pattern, including the 70-line `turnConfig.ts`
module to copy. Change the `STORAGE_PREFIX` constant to match this new app.

## Reference apps to mimic

Pick the closest match to the app I want and copy its patterns instead of
inventing your own:

- **Yjs CRDT mesh** → [anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll)
  or [meshtrack-studio](https://github.com/baditaflorin/meshtrack-studio)
- **Anonymous voting / Semaphore proofs** → [anon-conf-poll](https://github.com/baditaflorin/anon-conf-poll)
- **PeerJS-style P2P** → [room-vj](https://github.com/baditaflorin/room-vj)
- **Raw RTCPeerConnection with manual SDP exchange (QR / paste)** →
  [room-presence-mesh](https://github.com/baditaflorin/implemment-the-following-room-presence-mesh)
  or [cipher](https://github.com/baditaflorin/cipher)
- **Video / media streams** → [trust-no-one-anonymizer](https://github.com/baditaflorin/trust-no-one-anonymizer)

## Gotchas to NOT rediscover

1. **The default y-webrtc signaling (`wss://signaling.yjs.dev`) is dead** —
   the Heroku app's DNS no longer resolves. Use my self-hosted one.
2. **The lz-string `compressToEncodedURIComponent` output contains `+`** —
   WhatsApp and several other linkifiers truncate URLs at `+`. If your app
   stores state in the URL fragment via lz-string, post-process the output
   to swap `+` → `_` and reverse on decode (see anon-conf-poll's
   `src/features/polls/room.ts`).
3. **TURN credentials must be in place BEFORE `setLocalDescription`** if
   you're exchanging SDP out of band (QR / copy-paste). Otherwise the
   encoded SDP has no relay candidates and cross-NAT fails silently.
4. **Custom signaling servers that forward `publish` messages MUST send
   text WebSocket frames, not binary.** In Node.js `ws` library,
   `ws.send(buffer)` sends a binary frame which the browser silently
   drops. Always `raw.toString('utf8')` first.
5. **lib0/websocket auto-reconnects with `code: 1001` on iOS Safari when
   the tab backgrounds.** This is normal. Don't try to "fix" it.

## Deliverables I expect

- A working static build that I can commit and GitHub Pages will serve
- A `Settings` panel exposing signaling + TURN endpoint overrides
- `docs/self-hosted-infra.md` linking back to the three infrastructure
  repos and to the reference apps you copied patterns from
- `docs/privacy.md` with the threat model spelled out
- A README that includes a "Self-hosted infrastructure" section pointing
  at signaling-server / turn-token-server / coturn-hetzner

## What I do NOT want

- Auth, user accounts, or any per-user identity (the apps are anonymous /
  ephemeral by design)
- A backend of any kind
- Service workers (hard refresh always gets latest)
- Analytics, telemetry, or error reporting beacons
- Third-party SaaS dependencies (no Auth0, no Vercel, no Supabase)

Begin by reading the reference apps closest to my goal, then propose a
file layout before writing any code. Confirm the approach with me before
committing.
````

That's the full briefing. Paste it, fill in the one paragraph at the top describing what you want to build, and the new session can produce a working app without going through any of the cul-de-sacs that consumed the original conversation.
