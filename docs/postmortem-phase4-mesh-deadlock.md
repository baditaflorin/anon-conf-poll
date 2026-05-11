# Postmortem — Phase 4: Mesh Deadlock at "1 peer(s)"

**Date range:** Three days of debugging.
**Symptom user saw:** `Mesh connecting · 1 peer(s)` forever. Two devices on two networks, never seeing each other. Tried desktop + mobile, two laptops, same wifi, different wifi — always one peer.
**Severity:** Total — the core feature (live cross-device polling) never worked end-to-end in production.
**One-line root cause:** The self-hosted y-webrtc signaling server re-broadcast incoming WebSocket frames as **binary** instead of **text**, so the receiving browser silently dropped every forwarded message.
**One-line fix:** `peer.send(raw)` → `peer.send(raw.toString('utf8'))` in `/opt/turn/signaling/server.js`.

---

## How the bug expressed itself

The server logs looked healthy:

```
[ws] CONNECT from ::ffff:10.10.10.10 path:/ws  total=1
[ws] subscribe anon-conf-poll:room-…
[ws] publish topic=anon-conf-poll:room-… dataType=announce subscribers=1 delivered=0
[ws] CONNECT from ::ffff:10.10.10.10 path:/ws  total=2
[ws] subscribe anon-conf-poll:room-…
[ws] publish topic=anon-conf-poll:room-… dataType=announce subscribers=2 delivered=1
[http] GET / -
[http] GET / -
…  (silence for 5 minutes)
```

`delivered=1` looked like success. The first client subscribed, the second client announced, and the server forwarded the announce to the first client. By every metric on the server, the protocol was working.

But nothing happened next. Y-webrtc should have:

1. Received the announce on client 1
2. Created a `WebrtcConn` with the remote peer ID
3. Spun up a `SimplePeer` as initiator
4. Generated an SDP offer via `RTCPeerConnection.createOffer()`
5. Published that offer back via signaling

Step 5 was the diagnostic gold: a publish with `dataType=signal`. **It never came.** After the fix, the same log filled with 18 `dataType=signal` entries within seconds: offer, answer, ICE candidates flying both ways.

## Why the message was being dropped silently

In Node.js's `ws` library:

- `ws.on('message', (raw, isBinary) => …)` hands you a `Buffer` regardless of frame type
- `ws.send(string)` sends a **text** frame
- `ws.send(Buffer)` sends a **binary** frame

The server received the browser's text frame and immediately re-sent it as a `Buffer` to all other subscribers — a binary frame.

In `lib0/websocket` (which y-webrtc uses on the browser side):

```js
ws.onmessage = (e) => {
  let n = e.data;
  let i = typeof n == "string" ? JSON.parse(n) : n;
  // … emit message
};
```

A text frame arrives as a `string` and gets `JSON.parse`'d. A binary frame arrives as a `Blob` and passes straight through unparsed.

Then y-webrtc:

```js
this.on('message', m => {
  switch (m.type) {   // ← Blob has no .type === 'publish', falls through
    case 'publish': …
  }
});
```

Silent fallthrough. No error. No warning. The announce was logically received and discarded.

## Why it took three days

Every reasonable hypothesis pointed somewhere else first.

1. **"signaling.yjs.dev is dead"** — the y-webrtc default signaling server (Heroku-hosted) has no DNS resolution. True, real bug, solved by self-hosting at `wss://turn.0docker.com/ws`. But fixing this revealed the deeper bug.
2. **"TLS cert is wrong"** — `turn.0docker.com` initially had no HTTPS because Hetzner iptables DNAT was forwarding 80/443 to the wrong VM. Real bug, fixed with certbot on the nginx VM.
3. **"coturn has empty auth-secret"** — the `${TURN_SECRET}` was being expanded to empty by a heredoc on the server. Real bug, fixed by literal-quoted env_file.
4. **"coturn sees external IPs as 127.0.0.1"** — turned out to be loopback STUN healthchecks from inside the container, not a masquerade issue. Wasted ~half a day.
5. **"Hetzner cloud firewall blocks UDP 49152-65535"** — tested with `nc -u`, confirmed open. Half a day.
6. **"TURN credentials aren't being baked in at build time"** — `VITE_TURN_TOKEN_URL` and `VITE_WEBRTC_SIGNALING` weren't set in the build env, so the app fell back to dead defaults. Real bug, fixed by changing the defaults in `config.ts` and `iceConfig.ts`.
7. **"React is destroying and recreating the provider"** — the disconnect/reconnect cycle on the WS looked suspicious. Investigated React effects, manifest stability, the lib0 keepalive timeout. Dead end — turns out the cycle was just iOS Safari sending close(1001) when backgrounded.
8. **"y-webrtc has a key/Promise bug"** — misread the source briefly and convinced myself that `room.key` being a `Promise.resolve(null)` was breaking the decryption branch. Re-read the constructor and saw `this.key.then(key => openRoom(…, key))` — key is awaited and unwrapped. Dead end.
9. **The fix.** After eight wrong turns and a "you're failing for three days" from the user, looked at the actual byte-level transport between `ws.on('message', raw => …)` and `peer.send(raw)`. The buffer/string distinction in `ws` was the entire bug.

## What I should have done on day one

- **Compare against the reference implementation.** y-webrtc has [`y-webrtc-signaling`](https://github.com/yjs/y-webrtc/blob/master/bin/server.js) in its repo. That reference does `JSON.parse(message)` then re-`JSON.stringify`'s before broadcasting. The conversion to string is implicit in stringify. Mine skipped the parse/stringify roundtrip "for performance" and broke the wire format.
- **Log message bytes, not just routing.** The "delivered=1" log told me the bytes left the server. It didn't tell me what the bytes looked like on the other side. A `console.log(text.slice(0,80))` on the receiver side would have revealed binary garbage in five minutes.
- **Test with two browser tabs on the same machine first.** Same-origin BroadcastChannel would have masked the bug — but as soon as you force WebRTC by opening two tabs in different browsers, the silent-drop becomes visible without any cross-NAT noise muddying the diagnosis.

## Code change

`/opt/turn/signaling/server.js`:

```diff
   } else if (msg.type === 'publish') {
     const set = topics.get(msg.topic);
     let delivered = 0;
+    // CRITICAL: send as TEXT (string), not binary (Buffer).
+    // ws.send(Buffer) sends a binary frame, which lib0/WebSocket on the
+    // browser side does not JSON-parse — the message gets silently dropped.
+    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
     if (set) set.forEach(peer => {
-      if (peer !== ws && peer.readyState === 1) { peer.send(raw); delivered++; }
+      if (peer !== ws && peer.readyState === 1) { peer.send(text); delivered++; }
     });
   }
```

One line of substance. Three days of context.

## What we kept from the chase

The eight wrong turns weren't all wasted:

- Self-hosted signaling at `wss://turn.0docker.com/ws` (replaces the dead public Heroku one).
- Self-hosted coturn at `turn.0docker.com:3479` with HMAC-secret auth and a TLS-fronted token-server at `/credentials` issuing short-lived (1h) credentials per page load.
- Auto-migration in `iceConfig.ts` that clears `wss://signaling.yjs.dev` out of users' localStorage so old sessions self-heal.
- Production defaults baked into `config.ts` and `iceConfig.ts` so the app works without any env vars set at build time.
- A visible `Peers: seen N · rtc N · tap↺` status badge that's clickable — tap to force a re-announce without reloading.
- A 10-second auto re-announce when `webrtcPeers === 0`, so peers that miss the initial handshake retry automatically.
- Per-peer ICE debug logging in DevTools (`[ice] → OFFER`, `[ice] candidate RELAY 🔀`, `[ice] ✅ CONNECTED to peer …`).

All of those are net improvements regardless of the bug. But the bug itself was the one-line buffer/string thing.

## Lessons for next time

1. **When you bridge between two WebSocket implementations, explicitly cast types.** The `ws` package on Node and the browser `WebSocket` API agree on the wire format but disagree on how `send()` interprets its argument. If you're forwarding bytes, decide whether the bytes are text or binary and be explicit.
2. **"Delivered" is not "processed."** A signaling server should log message _content_ (or at least content type / length / first bytes), not just routing decisions. The single most useful diagnostic would have been `text=${text.slice(0,60)}` on the broadcast line.
3. **When eight reasonable hypotheses all fail, check the wire format.** The transport itself is rarely the bug — except when it is. Then it costs you three days because you trusted it.
