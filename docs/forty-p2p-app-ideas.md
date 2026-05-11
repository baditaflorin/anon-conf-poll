# Forty more peer-to-peer apps

A bigger, denser list than the previous two docs. Five clusters of eight, no overlap with the ten ideas already in [`self-hosted-webrtc-stack.md`](./self-hosted-webrtc-stack.md) or [`fun-p2p-app-ideas.md`](./fun-p2p-app-ideas.md). Each item is intentionally short — pitch, the experience, why mesh, the primitive — so you can scan all forty in five minutes and pick.

Tag legend: 🎉 party · 🎵 audio · 🎨 visual · 🌳 outdoor · 🛋️ chill · 🧠 game · 🍝 mundane

---

## Cluster A — party games & social mischief (8)

### `mafia-mesh` 🎉🧠
Werewolf / Mafia with phones as role cards. Roles assigned via cryptographic commit-reveal; the moderator screen narrates each phase; phones flash red during "night, mafia open your eyes" so non-mafia stay heads-down honestly. *Why mesh:* role secrecy is end-to-end; no server ever knows who's the wolf. *Primitive:* Yjs awareness for game state, Semaphore-style commitments for the role assignment.

### `fishbowl-paper` 🎉
The three-round paper game (taboo → charades → one-word) but the prompts come from everyone simultaneously, anonymously, before the first round. *Why mesh:* prompt collection is anonymous within the friend group, not the entire internet. *Primitive:* round-trip pubsub over y-webrtc data channel; no awareness needed.

### `cards-against-mesh` 🎉
A clone of you-know-what with user-imported decks. Each phone is a hand; the round's "judge" sees submissions anonymously; the deck file is a JSON the host drag-drops. *Why mesh:* your group's filthy custom deck never leaves your group. *Primitive:* y-webrtc room + a 200-line state machine.

### `drawing-telephone` 🎉🎨
Like `whisper-chain` but alternates between draw and describe. Round 1: write a phrase. Round 2: next phone gets the phrase and draws it. Round 3: next phone gets the drawing and describes it. Repeat. End: scroll the chain. *Why mesh:* drawings are ~50 KB PNGs, perfectly happy in a data channel. *Primitive:* `<canvas>` to blob, blob over `RTCDataChannel`.

### `never-have-i-ever` 🎉
Prompt appears on every phone simultaneously. Each person taps "yes I have" or "no I haven't" privately. The aggregate count flips into view — *"6 of 8 have"* — but no one knows who. Optional Semaphore proofs to keep it cryptographically anonymous, not just trust-the-app anonymous. *Primitive:* anonymous aggregation = `anon-conf-poll`'s exact pattern.

### `truth-wheel` 🎉
Big spinning wheel on the host's screen; spins to a random connected phone; that phone reveals a randomly-drawn prompt only the recipient sees ("the most awkward thing you've Googled in the last week"). Player reads it aloud to the room. *Why mesh:* the wheel-to-phone selection is fair (uniform random over current peer IDs) and the prompt deck is shared. *Primitive:* y-webrtc awareness for current peer list, host-side weighted random pick.

### `red-flag-blue-flag` 🎉
Each round a random "dating flag" appears on every phone ("texts only with full punctuation"). Players privately swipe red / blue / depends. Aggregate revealed with mild commentary. *Why mesh:* it's funnier when it's anonymous, and no SaaS gets to keep a profile of your judgment patterns. *Primitive:* tiny y-webrtc app, single shared array of flags pre-loaded.

### `accent-roulette` 🎉
Phones each get a random accent assigned ("Cork", "1920s newsreader", "exhausted barista"). Host calls a topic. Each player gives a 30-second monologue in their assigned accent. Group votes on best. *Why mesh:* assignment must be private to each player or the surprise is ruined. *Primitive:* per-phone secret + shared topic via awareness.

---

## Cluster B — phone-as-physical-object tricks (8)

### `mesh-aquarium` 🎨🛋️
Drawn fish swim across the screens of N phones arranged on a table. Each phone owns a tank "section". Your fish leaves your screen on the right at `y=120` and appears on the next phone's screen at `y=120` swimming left-to-right. Add fish by drawing them. *Why mesh:* the fish position is a shared piece of state with a single authoritative owner that hands off at the edge. *Primitive:* same handoff pattern as `mob-pong`; physics is just drift + sine wave.

### `wave-canvas` 🎨
Touch any phone screen. A ripple expands from your touch point, leaves the edge of your phone, and re-enters the next phone in the arrangement from the matching edge. Group sits in a circle, taps create circulating ripples. *Why mesh:* the ripple is a single piece of moving state; same primitive as the aquarium. *Primitive:* WebGL fragment shader for the ripple field, position handoff over data channel.

### `firefly-walk` 🌳🎨
Group of friends walking outdoors at night. Phones display nothing but a slowly-pulsing soft yellow. The pulse is synchronized across all phones via NTP-over-WebRTC clock sync. From a distance you look like a swarm. Add gentle audio chirps for full effect. *Why mesh:* the synchronization IS the experience. *Primitive:* clock sync routine, full-screen `<div>` with animated background.

### `lightning-flash` 🌳🎨
You're at a viewpoint at night and want a group photo lit by flashes. Designate one phone as the camera. All others raise their phones with their flashlights pointed at the subject. Tap "FLASH" on the camera phone — all phones strobe their flashlight simultaneously (sub-50ms accuracy via clock sync). Camera shutter triggered on the same beat. *Why mesh:* nothing else gets you a fairly-bright flash from 6 angles at once on $0 of hardware. *Primitive:* `ImageCapture.takePhoto()`, `MediaStreamTrack` `applyConstraints({ advanced: [{ torch: true }] })`, clock sync.

### `mesh-marquee` 🎨🎉
Line up 6 phones on a bar/table. Type a message on one phone. Letters scroll across them like a vintage stadium marquee. Each phone renders its slice of the total text width; positioning is determined by initial calibration ("tap them left-to-right in order"). *Why mesh:* the marquee illusion only works with synchronized frame-rate scrolling across multiple discrete screens. *Primitive:* shared `Y.Doc` with the text + scroll offset; each phone renders its window.

### `dance-floor-tile` 🎨🎉
At a small house party, attendees put their phones face-up on the floor in a grid. Each phone is one tile. Music plays. The host phone (or anyone with the controller view) sends "ripple from corner X" / "checkerboard pulse" patterns; tiles light up accordingly. Optional: each tile cycles its own color when stepped on (using accelerometer). *Why mesh:* sub-50ms tile-to-tile sync is what makes the floor pattern read as one surface. *Primitive:* clock sync + full-screen color animation.

### `mob-galaga` 🧠🎉
A retro shoot-em-up where enemies fly across a row of 5-8 phones. Each phone has its own ship at the bottom; enemies appear at the top, drift through phone-space, and you can only shoot enemies currently above your phone. Teamwork emerges naturally (lefty player can't see the right side of the screen). *Why mesh:* enemy positions are shared world state; firing/destruction is event-broadcasting. *Primitive:* Yjs `Y.Array` of enemy states, deterministic local rendering of the visible window per phone.

### `mirror-mesh` 🎨
Each phone's screen displays the live camera feed of the *next* phone in a chain. Form a ring. Look at the phone in your hand and you see what your neighbor is filming, which is the next phone, which is filming your neighbor… A WebRTC chain of length 5 produces a fascinating low-fi infinite-mirror feel. *Why mesh:* the video chain is mesh-native; each phone subscribes to exactly one other's stream. *Primitive:* `RTCPeerConnection.addTrack` with video, deterministic "next peer" ordering.

---

## Cluster C — sound & music play (8)

### `mesh-metronome` 🎵
4 phones become a polyrhythm grid. Phone A clicks every quarter note. Phone B every triplet. Phone C every dotted-eighth. Phone D every five-against-four. Each click is a haptic + audible tick perfectly synced via clock sync. Hand them to four people and notice how much harder polyrhythms are to keep when you have to follow another phone. *Why mesh:* the experience requires inter-device sync at single-millisecond precision. *Primitive:* clock sync, `AudioContext.currentTime` scheduling.

### `echo-room` 🎵
Sing or speak into your phone. The phone next to you in the mesh receives your audio with a 200ms delay. The next, 400ms. After five phones, your voice has become a five-voice canon of itself. With six people each adding to their own delay chain, you get an instant amateur choir. *Why mesh:* the staggered delays are intrinsic to the routing topology, not faked. *Primitive:* WebRTC audio tracks, AudioContext delay node per receiver.

### `chord-vote` 🎵🎉
Host plays a slow, looping chord progression on a synth. Audience phones show three buttons: stay, brighter, darker. Aggregate vote shifts the next chord (mode-mixture choices precomputed). Watch a 5-minute jam evolve under crowd direction. *Why mesh:* voting + audio playback are both peer-to-peer. *Primitive:* `WebAudio` for the synth, awareness for vote tallies, NTP-style clock sync so chord change hits the bar line.

### `drone-choir` 🎵🛋️
Each phone holds one sustained pitch (sine wave). Drag a slider to glide your pitch up or down. The host displays a real-time visualization of the resulting chord — which notes are present, which intervals are clashing, when the group accidentally lands on a stack of fifths. Slow, contemplative, occasionally accidentally gorgeous. *Why mesh:* aggregation of slow-changing pitch state across phones; no central audio mix. *Primitive:* `OscillatorNode` per phone, shared pitch state via awareness.

### `tap-symphony` 🎵🎉
Each phone is assigned a single drum sound — kick, snare, hi-hat, clap, cowbell. Tap the screen to play your sound. A 30-second loop records all taps from all phones with their actual timing (clock-corrected). After 30 seconds, the loop plays back simultaneously on every phone — the group has accidentally composed a beat together. *Why mesh:* the loop is a deterministic playback of shared event-stream state. *Primitive:* timestamped event log via data channel, AudioBufferSourceNode for playback.

### `lullaby-chain` 🎵🛋️
Each person hums into their phone for 4 seconds. The mesh stitches everyone's clip end-to-end. The final stitched audio plays back to everyone simultaneously. You hear what you all just made — surprisingly often, lovely; surprisingly often, weird. *Why mesh:* the clips never leave the group of currently-connected phones. *Primitive:* `MediaRecorder` clips over data channel, concatenation via Web Audio buffer copy.

### `karaoke-mesh` 🎵🎉
One designated phone plays the song through its speaker. Every other phone shows synchronized lyrics with the karaoke bouncing-ball highlight. Anyone can grab the "next verse" by raising their phone (accelerometer trigger). Singing rotates around the room. *Why mesh:* tight lyric-to-audio sync across all listener phones. *Primitive:* clock sync, shared lyric file with timestamps, awareness for "current singer" handoff.

### `round-singing` 🎵🎉
Phones auto-arrange a vocal round. Phone 1 starts singing the song (via TTS or playback). Phone 2 starts the same song 2 seconds later. Phone 3, 4 seconds later. Phone 4, 6. The phones now perform a 4-part canon among themselves — set them on a table and listen. Like "Row Row Row Your Boat" but the phones are the choir. *Why mesh:* the offsets are inherent to the routing order; no central conductor needed. *Primitive:* clock sync, shared TTS or audio file, per-phone offset.

---

## Cluster D — outdoor & location-bound (8)

### `scavenger-mesh` 🌳🧠
Host generates 10 photo clues ("find something heart-shaped that isn't a heart", "a sign in a language you don't speak"). Two teams race. Each team takes a phone-mesh-shared photo when they find a match. Teams can see each other's progress in real time but not each other's photos until reveal. *Why mesh:* multi-team progress sync without a leaderboard server; teams play wherever they want without picking a venue. *Primitive:* photo blob over data channel, shared progress counter via awareness.

### `proximity-poker` 🌳🎉
Open the table. Sit near each other. Phones use Bluetooth proximity to seat you at the table in the order you sat down physically. Cards dealt via cryptographic commit-reveal so no central party knows the deck. Folds, raises, all peer-to-peer. *Why mesh:* the no-house property of P2P + crypto card dealing means the game is genuinely trustless. *Primitive:* Web Bluetooth for proximity, mental-poker commit-reveal scheme over data channel.

### `bench-archive` 🌳🛋️
Print a small QR sticker, stick it on a public bench. Anyone who scans it loads a page that joins a "room" tied to that bench. They can leave a 30-second voice note. Anyone who later scans the same sticker hears the previous voices. The audio lives only in browsers that have scanned — when no one has visited in a week, it's gone. *Why mesh:* memory tied to a place, no server retention. *Primitive:* signaling-room name = bench ID (encoded in QR), Yjs `Y.Array` of audio blobs, IndexedDB cache.

### `firework-launcher` 🌳🎉
Group at an outdoor gathering, dusk. Open the app. Tap to "launch". Every phone in the mesh plays the same firework explosion animation + sound at the same instant. Optional: phone flashlights pulse on the boom. Looks magical from 5m away. *Why mesh:* synchronized A/V across phones is the entire payoff. *Primitive:* clock sync, full-screen canvas for the visual, `AudioContext` scheduling for the boom.

### `shadow-puppet-sync` 🌳🎨
Around a campfire or single light source. Phones rest on the ground around the lit area. Each phone shows a synchronized timed dialogue cue + character "stage direction" for whoever's holding it. Group performs a 3-minute shadow puppet play with no rehearsal because every phone tells its puppeteer what to do when. *Why mesh:* synchronized cueing across N phones for one narrative. *Primitive:* shared script with timestamps, clock sync.

### `carpool-bingo` 🌳🧠
Long road trip. Each phone gets a 5×5 bingo card of road sights ("yellow car", "out-of-state plate", "billboard with a mistake", "cow"). Tap to claim. Mesh shows everyone's progress; first to a line buys snacks at the next stop. *Why mesh:* the cards are unique per phone but the claim space is shared; runs entirely offline once joined. *Primitive:* shared `Y.Map` of who-claimed-what, per-phone deterministic card from a seed.

### `hike-checkpoint` 🌳🌳
Plan a hike with friends spread across the trail. Mesh checkpoints established at landmarks — when you reach one, your phone publishes a signed "I was at X" token to the mesh. Anyone slower can see who's ahead and how far. Anyone faster can leave voice notes at checkpoints for the next person to find. *Why mesh:* trail networks have terrible cellular; the mesh forms whenever two hikers come back into range. *Primitive:* opportunistic mesh via signaling reconnect, Yjs `Y.Array` of checkpoint events.

### `peak-pact` 🌳🛋️
A group plans to hike to a summit together but takes different routes / paces. Take a "before" group photo at the trailhead — but the photo is split across all phones cryptographically and can only be reassembled when ALL phones are within Bluetooth range again, at the top. Shared first-look at the start, shared reveal at the summit. *Why mesh:* the photo's reassembly is contingent on the group physically reuniting. *Primitive:* Shamir secret sharing of the photo blob, Web Bluetooth for re-discovery at the summit.

---

## Cluster E — quiet shared moments (8)

### `shared-doodle-fade` 🎨🛋️
A canvas open across N phones. Anyone can draw on it. Every line fades and disappears after 60 seconds. Nothing saves. Use it during a slow conversation; the page becomes a window onto the group's wandering hands. *Why mesh:* the canvas is shared; the no-server property means nothing is archived. *Primitive:* `<canvas>` with timestamped line records over awareness, GC older lines.

### `silence-counter` 🛋️
Group meditation timer. Set 20 minutes. Each phone tracks its holder's movement via accelerometer. Aggregate dashboard shows how many of N peers are "still" right now — but never which ones. Gentle accountability without surveillance. At the end, each phone privately gets "you were still for 17 of 20 minutes" — but the group only sees aggregate stillness. *Why mesh:* anonymous aggregation in real-time. *Primitive:* DeviceMotion API, threshold on jerk, anonymous count via Semaphore-style commitment.

### `slow-letter` 🛋️
Write a letter on the shared room. Set a date in the future. The letter is encrypted; the decryption key is split across all currently-connected peers via Shamir secret sharing. The letter can only be opened when at least 3 of N peers re-join the room on/after that date. Friend pact that requires re-presence to honor. *Why mesh:* the unlock contingency is "we have to be together again". *Primitive:* Shamir + age encryption (libsodium), localStorage for each peer's share.

### `mood-ring-mesh` 🎨🛋️
Each phone shows one color, derived from its holder's recent inputs — taps per minute, ambient light, time of day. The aggregate of everyone's colors becomes a single big swirly background on a host display. No one tells anyone how they feel; the room expresses it. *Why mesh:* the swirl is the group; no individual reveal. *Primitive:* light sensor (where available), local "mood vector", peer averaging.

### `campfire-stories` 🌳🛋️
Take turns. Each phone records 1 minute of audio. When you finish, your audio is broadcast to the next phone in the circle, which begins recording its 1 minute (you can hear the previous story while recording yours). After everyone's spoken, the full chain plays back — every voice, in order, as a single 8-minute listen. *Why mesh:* the chain forms naturally from the mesh topology; no central narrator. *Primitive:* `MediaRecorder`, ordered handoff via awareness, IndexedDB cache while playing back.

### `shared-window` 🛋️🎨
A small private mesh between 2–4 friends in different homes. Each phone holds up its camera to a view it likes — a window, a candle, a garden. Each phone's screen tiles all the others' camera feeds into one composite — your one view is one quarter of the screen, the rest is theirs. Ambient presence without conversation. *Why mesh:* low-latency multi-camera video; nobody's server retains the streams. *Primitive:* multi-track `RTCPeerConnection`, CSS grid layout for the tiles.

### `dawn-circle` 🛋️
You and 4 friends across time zones each set a "wake window". When you open the app in the morning, you join the mesh and your phone plays a soft chime on every other already-awake friend's phone. By 10am, the group has acoustically watched everyone wake up — without text, without notifications. *Why mesh:* the chime triggers on peer presence, not a server cron. *Primitive:* signaling auto-reconnect on app open, "hello" broadcast on join, `AudioContext` for the chime.

### `dream-jar` 🛋️
Open the app immediately on waking. Tap. Record 30 seconds of whatever you remember from your dream. The audio is encrypted to the mesh's group key and dropped into a shared "jar". Anyone in the small private mesh can scroll through everyone's dreams over morning coffee. The jar empties at midnight every day. *Why mesh:* the dreams stay among the small group, never reach a server. *Primitive:* recorded blob over data channel, group-key encryption (libsodium), scheduled cleanup.

---

## How to use this list

**Pick by mood.** The tags are honest signals about when the app fits — a 🎉 idea will feel pointless at a Tuesday lunch, a 🛋️ idea will fall flat at a karaoke night. Match the idea to the actual gathering you have access to.

**Build the smallest one that has a working clock sync.** If you implement the NTP-style clock sync routine once (~50 lines of WebRTC data-channel messaging), you can drop it into `mob-pong`, `firefly-walk`, `lightning-flash`, `dance-floor-tile`, `firework-launcher`, `mesh-metronome`, `round-singing`, `tap-symphony` — eight of these ideas wear the same primitive.

**Build the smallest one that has multi-track audio.** If you implement live audio-stream sharing once (much harder than data channel — needs `RTCPeerConnection.addTrack`, careful gain/echo handling), you unlock `echo-room`, `drone-choir`, `karaoke-mesh`, `mirror-mesh` (video equivalent), `shared-window`.

**Group hardest-to-easiest:**
- *Trivial weekend hack:* `cards-against-mesh`, `never-have-i-ever`, `truth-wheel`, `red-flag-blue-flag`, `accent-roulette`, `carpool-bingo`, `shared-doodle-fade`, `dream-jar`.
- *Weekend with one fancy primitive:* `mafia-mesh`, `fishbowl-paper`, `drawing-telephone`, `mood-ring-mesh`, `bench-archive`, `silence-counter`, `chord-vote`, `slow-letter`.
- *Real engineering (clock sync OR audio streaming):* `mesh-marquee`, `dance-floor-tile`, `mob-galaga`, `mesh-metronome`, `round-singing`, `tap-symphony`, `lullaby-chain`, `karaoke-mesh`, `firefly-walk`, `firework-launcher`, `shadow-puppet-sync`.
- *Multiple hard pieces:* `mesh-aquarium`, `wave-canvas`, `lightning-flash`, `mirror-mesh`, `echo-room`, `drone-choir`, `shared-window`, `proximity-poker`, `peak-pact`.

**Use the meta-prompt.** All forty fit into the meta-prompt at the bottom of [`self-hosted-webrtc-stack.md`](./self-hosted-webrtc-stack.md). Replace `[ describe your app ]` with the relevant pitch + the closest reference repo to mimic, and a fresh Claude Code session will produce a working prototype against the self-hosted stack without re-deriving any infrastructure.
