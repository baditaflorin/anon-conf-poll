# Five fun peer-to-peer app ideas

Companion to [`self-hosted-webrtc-stack.md`](./self-hosted-webrtc-stack.md). Those five ideas were *useful*. These five are *fun* — built for shared moments at parties, gatherings, hikes, dinners. Each one is GitHub-Pages-only, peer-to-peer over the self-hosted infra at `turn.0docker.com`, and works between strangers who scan a QR.

The pattern is the same: copy `turnConfig.ts` from the stack reference, change the `STORAGE_PREFIX`, decide on signaling (y-webrtc for room-mesh apps, PeerJS for star topology, raw `RTCPeerConnection` for QR/manual exchange).

---

## 5.1 `mob-pong` — the Pong ball travels across all your phones

**One-line pitch:** put 4 phones in a row on a table, the Pong ball *physically rolls from one screen to the next*.

Two paddles, one on the leftmost phone, one on the rightmost. The ball is a shared piece of state. When it leaves your screen on the right at `x = screen.width, y = 250`, the next phone in the mesh starts rendering it entering at `x = 0, y = 250` — same velocity, same physics. The four phones form one continuous play surface. Phones figure out their position in the row via "shake to claim spot N" or by a host scrolling through QR-coded position assignments.

**Why this stack:** every frame the ball-owner phone publishes `{ position, velocity, owner-id }` over y-webrtc awareness. The next phone in the row picks it up when the ball crosses its boundary. Clock sync over data channel keeps the cross-phone handoff smooth (<30 ms perceived latency on the same wifi, ~80 ms over TURN). The TURN relay is what makes it work when one player is on cellular and the other on hotel wifi — same NAT-busting story as everything else.

**Key tech:** y-webrtc awareness for the shared ball state, `requestAnimationFrame` synced via WebRTC clock-sync routine (NTP-style RTT measurement), Canvas 2D rendering, DeviceOrientation API for tilt-based paddle control on phones without keyboards.

**Stretch:** play space arranged in an L or a circle (not just a row). Detect adjacency via NFC tap or "swipe ball from screen A to screen B" gesture.

---

## 5.2 `whisper-chain` — voice-note telephone game

**One-line pitch:** the children's "telephone" game, except your voice clip mutates as it travels and at the end everyone hears the comedy.

Round mechanic:
1. Host starts a round with a prompt ("describe your worst hangover in 5 seconds").
2. The first peer records 5 seconds, the recording is sent to a random next peer over the data channel.
3. That peer hears it, then records what they think they heard — also 5 seconds.
4. Continues for N hops or until everyone's been a link.
5. The final phone broadcasts the full chain — every clip in order — and the screen displays the round trip as a stack of waveforms. Everyone listens together and laughs.

**Why this stack:** the audio blobs are ~80 KB each at 8 kHz Opus — fast over data channel even on TURN-relayed paths. No server-side audio storage means it's actually anonymous between rounds; the recordings live only in the mesh of currently-open tabs. Close the tabs and the embarrassing audio is gone forever.

**Key tech:** `MediaRecorder` for 5-second Opus clips, `RTCDataChannel` with `binaryType: 'arraybuffer'` for sending the blobs, a tiny ring-buffer of peer IDs to determine "next person". Optional: Whisper-tiny via `@huggingface/transformers` for live in-browser transcription of each clip so you can read the textual mutation alongside the audio.

**Stretch:** "mode: drawing telephone" — each hop alternates between voice and a quick sketch on a canvas. Mutation across modalities.

---

## 5.3 `silent-disco-radio` — one DJ phone, N listening phones, no speakers

**One-line pitch:** one person plays a track on their phone; everyone else hears the same audio on their own headphones, perfectly synced, with zero setup beyond scanning a QR.

The DJ picks a track from their device, hits play, the audio streams over `RTCPeerConnection` audio tracks (not data channel — actual audio tracks so Opus encoding is browser-native and bandwidth is minimal). Listeners scan a QR, get the page, allow audio, plug in headphones. The DJ sees a live count of active listeners and a real-time waveform; listeners see what's playing + a "wave" button that briefly flashes everyone else's screens when tapped. Voting on the next track is anonymous via Semaphore proofs (copy the pattern from `anon-conf-poll`).

**Why this stack:** WebRTC media streams over TURN are how this works at all — peer-to-peer audio is the entire architecture. Doing this with HTTP audio streaming would either need a server (kills the no-backend property) or restrict you to LAN. The signaling-server gets the listeners discovering the DJ; coturn handles the actual stream relay when listeners are on cellular.

**Key tech:** `RTCPeerConnection.addTrack` with an audio MediaStreamTrack, `AudioContext` for the live waveform on the DJ's screen and the spectrum on listeners' screens, optional MIDI input for DJ controls (Web MIDI API). The clock sync routine from `mob-pong` ensures everyone's "wave" button flashes are also synchronized.

**Stretch:** multiple DJ rooms in the same physical space, separated by hashtag in the URL; attendees can hop between rooms with a swipe.

---

## 5.4 `room-jeopardy` — instant trivia night with phones as buzzers

**One-line pitch:** four lines of setup and you've got a Jeopardy game with proper buzzers for any group at any table.

Host loads a CSV of questions (or picks from a built-in pack — geography, music, your in-jokes). Host's screen shows the current question + scoreboard, projected on a TV or just held up. Attendees scan a QR; each gets a single full-screen "BUZZ" button. The first phone to tap claims the question (with timestamp resolved by WebRTC clock sync — sub-50ms accuracy beats human reaction time). The buzzer is greyed out for everyone else until the host marks the answer right or wrong; if wrong, the buzzer reopens.

Scoreboard is anonymous-by-default — each player picks an emoji + handle the host never sees their device identity — and stored only in the connected browsers.

**Why this stack:** the precision of "who buzzed first" is the entire gameplay — a centralized server would add 100ms of round-trip and ruin the fairness. P2P with NTP-style clock sync between the host and each phone makes it fair. TURN handles the inevitable "uncle Steve is on cellular" case.

**Key tech:** y-webrtc awareness for the buzzer state, a 50-line NTP-style sync routine over data channel, `screen.orientation.lock("portrait")` so phones don't accidentally rotate during play, CSV import for custom question packs, optional in-browser TTS for the host to "read" questions aloud.

**Stretch:** team mode — buzzes pool by team color, scoreboard groups them, host can assign teams via "shake to team red/blue".

---

## 5.5 `constellation-naming` — collaborative stargazing on a real sky

**One-line pitch:** point your phone at any star, mark it, give it a name; over the course of a night your friends collectively map the actual sky above you.

You're outside with friends. Open the page, allow camera + orientation. Look up, point your phone, tap. The page records the orientation (azimuth + altitude from `DeviceOrientationEvent`), shows a dot on a shared celestial dome map. Other phones in the mesh see your dot appear in their map oriented to *their* phone's bearing, so when they look up they can find the same star. Name a star, draw a constellation by connecting your dots, see what others connected. By the end of the night the room has a shared, ephemeral, hand-drawn star atlas that disappears when everyone closes the tab — or one person can take a screenshot.

**Why this stack:** the whole point is the shared map, in real time, between people sitting on the same hillside. Wifi is unlikely (you're outside); cellular is almost certain. TURN is what makes the mesh work when nobody's on shared LAN. The mesh discovery cost is one QR scan to join the room.

**Key tech:** `DeviceOrientationEvent` for camera bearing (with the always-fun iOS Safari permission gymnastics), a celestial-sphere coordinate system (RA/Dec converted from device heading + GPS), Yjs `Y.Map` of named points, optional offline copy of a star catalog (~50 KB of bright stars for "is your point near a real star?" hinting).

**Stretch:** time-lapse mode — replay everyone's dot-placement in 30 seconds at the end of the night. Or contour mode — group's dots are auto-clustered into "constellations".

---

## Picking between them

| Idea | Setting | Group size | Vibe | Hard part |
|---|---|---|---|---|
| `mob-pong` | indoors, table | 2–8 | kinetic, kids will scream | clock sync at frame rate |
| `whisper-chain` | dinner party | 4–12 | comedy | smooth audio handoff |
| `silent-disco-radio` | gathering / dance floor | 5–50 | musical | latency between DJ and listeners |
| `room-jeopardy` | living room / pub | 3–15 | competitive | fair "who buzzed first" with clock skew |
| `constellation-naming` | outdoors at night | 3–20 | contemplative | DeviceOrientation accuracy + cellular-only mesh |

**Easiest first prototype:** `room-jeopardy`. Pure data-channel messages, no audio/video streams, no orientation math. The whole game logic fits in ~300 lines on top of the standard `turnConfig.ts` pattern.

**Most viral demo:** `mob-pong`. Showing it to one person sells the entire stack better than any README. "Yes, the ball really does roll from this phone to that one."

**Most replayable:** `whisper-chain`. The audio mutation is funnier every round and people demand to do it again.

---

## Reusing the meta-prompt

To kick any of these off in a fresh Claude Code session, paste the meta-prompt at the bottom of [`self-hosted-webrtc-stack.md`](./self-hosted-webrtc-stack.md) and replace the `[ describe your app ]` paragraph with the matching one-line pitch + "Reference apps to mimic" pointing at the closest pattern (e.g. `mob-pong` → mimic `meshtrack-studio` for y-webrtc + awareness; `room-jeopardy` → mimic `anon-conf-poll` for the Semaphore anonymity if you want anonymous scores).
