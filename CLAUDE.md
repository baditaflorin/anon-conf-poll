# Notes for Claude

Short briefing for future Claude sessions working on this repo. Read this before debugging anything mesh / WebRTC / signaling related.

## What this app is

A GitHub-Pages-hosted SPA for anonymous live polling. Two parts:
- **Frontend** (`src/`) — React + Yjs CRDT + Semaphore zero-knowledge proofs + y-webrtc for transport.
- **Self-hosted infra** on `turn.0docker.com` (Hetzner box) — three Docker services: signaling, TURN credential issuer, coturn TURN relay. Sources live in `/opt/turn/{signaling,turn-token-server,coturn-hetzner}/` on the server.

See `docs/mesh-architecture.md` for the full data flow.

## Gotchas that have already cost real time

### 1. Signaling forwards must be TEXT frames

In `/opt/turn/signaling/server.js`, when re-broadcasting a `publish` message, **send a string, not a Buffer**:

```js
const text = typeof raw === 'string' ? raw : raw.toString('utf8');
peer.send(text);   // ✅ text frame, browser JSON.parses it
peer.send(raw);    // ❌ binary frame, browser silently drops it
```

This bug looked exactly like "WebRTC fails to connect across NATs" — the announce delivers (server logs `delivered=1`), but the receiver never generates an SDP offer because y-webrtc's `switch(m.type)` falls through silently on a Blob.

Full postmortem: `docs/postmortem-phase4-mesh-deadlock.md`. Don't repeat this.

### 2. The y-webrtc default signaling server is dead

`wss://signaling.yjs.dev` (the library default) is a Heroku app whose DNS no longer resolves. If you see "Mesh connecting · 1 peer(s)" forever, **first** check what signaling URL is actually being used — `loadSignalingUrl() || appConfig.signalingUrl` in `yjsRoom.ts`. The production default in `src/shared/config.ts` is `wss://turn.0docker.com/ws`. Users may have a stale value in `localStorage["anon-conf-poll:signalingUrl"]`; `iceConfig.ts` has a `DEAD_SIGNALING_SERVERS` migration that clears known-dead values automatically.

### 3. TURN credentials are auto-fetched from `https://turn.0docker.com/credentials`

This is set as the default in `iceConfig.ts`'s `loadTurnTokenUrl()`. The token server issues HMAC-signed credentials valid for 1 hour. **Always fetch fresh** — don't cache credentials past their TTL or coturn will reject Allocate requests with 401.

### 4. coturn is `network_mode: host`

It binds directly to the Proxmox host's interface (no Docker port mapping). External IP `176.9.123.221` for `--external-ip`. Port range 49152–65535 for relay allocations. If you see coturn logs with `remote 127.0.0.1` for sessions, those are the loopback healthcheck — ignore them. Real external clients will show their public IP.

### 5. iOS Safari sends close(1001) when backgrounded

If you see frequent disconnect/reconnect cycles in the signaling logs (`code=1001 reason=(none)`), that's the user switching apps on their phone. lib0/websocket auto-reconnects within ~270ms and y-webrtc re-announces. This is normal and not a bug. Don't waste time investigating it.

### 6. Two-tab BroadcastChannel can mask cross-device bugs

Y-webrtc uses a BroadcastChannel for same-origin same-browser-tabs as a fast path that skips WebRTC entirely. Opening two tabs on the same desktop will "work" via BroadcastChannel even if WebRTC is completely broken. **Always test with two different browsers (or one browser + one phone) when verifying mesh connectivity changes.**

## Debugging mesh issues — the right order

1. Open DevTools console on both devices. Look for `[sync]` and `[ice]` log lines (they're plentiful by design).
2. SSH to `root@176.9.123.221` and run `docker logs -f signaling-signal-1`. Have both devices on the page. You should see:
   - Two `CONNECT total=2` lines (one per device)
   - Two `subscribe` lines for the same topic
   - Two `publish dataType=announce` (the second one should show `delivered=1`)
   - Within a few seconds, **multiple `publish dataType=signal`** lines flying both ways. **This is the diagnostic.** If `dataType=signal` never appears, WebRTC negotiation is broken — that's the bug we hit in phase 4.
3. Check coturn: `docker logs --tail=50 coturn-hetzner-coturn-1`. Look for `username=<timestamp>` sessions with `rp=N, rb=N` showing nonzero bytes. If only `username=<>` sessions exist, no TURN auth attempts are happening (browser is using STUN/host only — that's fine if it works).
4. The status badge in the app shows `Peers: seen N · rtc N · tap↺`. `seen` = peers announced via signaling. `rtc` = WebRTC connections established. If `seen ≥ 1` but `rtc = 0`, ICE is failing. If `seen = 0`, signaling itself isn't delivering announces.

## Deploying changes

- **Frontend:** `cd ~/Documents/GITHUB_PROJECTS/anon-conf-poll && npm run build && git add docs/ && git commit && git push`. GitHub Pages auto-deploys from the `docs/` directory. Takes 1–2 minutes to propagate. Hard-refresh both devices.
- **Signaling server:** edit `/tmp/signaling-server.js` locally → `scp` to `root@176.9.123.221:/opt/turn/signaling/server.js` → `ssh … 'cd /opt/turn/signaling && docker compose build signal && docker compose up -d signal'`.
- **TURN token server / coturn:** same pattern, paths `/opt/turn/{turn-token-server,coturn-hetzner}/`. coturn doesn't need a rebuild after config-only changes — just `docker compose restart coturn`.

## Repo conventions

- `docs/` is both the GitHub-Pages publish root and the human documentation directory. Documentation goes in `docs/*.md`; built JS goes in `docs/assets/`.
- Postmortems are numbered: `docs/postmortem-phase{N}-{slug}.md`. Add new ones rather than editing old ones.
- Version is bumped in `package.json` (drives the version string shown in the app header). Bump for any user-visible release.

## Things deliberately NOT done

- No service worker / offline cache. Hard refresh always gets the latest build.
- No analytics, no telemetry, no error reporting beacons.
- No backend database. All state is CRDT in browsers + URL fragment for room manifest.
