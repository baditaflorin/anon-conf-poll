# UX suggestions

Concrete things that would make `anon-conf-poll` easier to use. Ranked roughly by impact-to-effort ratio.

## Top priority — first-load confusion

These are the things a first-time user hits in the first 30 seconds.

### 1. The first screen should answer "what do I do now?"

Right now the app opens with a status strip, a "Room Control" panel, a Q&A column, and several polls — without any onboarding. A first-time user doesn't know whether to start fresh, paste a link, or just click around.

**Fix:** Replace the busy initial state with a single decision card:

> _"How are you joining?"_
> — **Host a session** (creates a new room, shows the share link)
> — **Join with a link** (paste field)
> — **Try the demo** (loads sample data)

After picking, transition into the current UI. Returning users who already have state skip this screen.

### 2. The share link is the product — make it obvious

Hosting a session and not realizing you need to send the URL to attendees is the most common confusion. Today there's just a small `📋` icon in Room Control.

**Fix:** After room creation, show a big modal/banner: _"Share this link with attendees"_ + the URL in large monospace + a single big "Copy link" button + a "Show QR code" toggle. Dismiss to enter the room.

### 3. QR code for the room link

For in-person events (the actual use case), people will scan it from a slide or printout. `qrcode` is a tiny dependency (10 KB). Show the QR alongside the URL anywhere the room link appears.

## Mid priority — polish

### 4. Mobile layout

The status strip, settings panels, and poll cards work but are dense on a phone. Specifically:

- Status badges wrap awkwardly at narrow widths — already partially fixed with `auto-fit, minmax(220px, 1fr)`, verify on actual devices.
- The "Room Control" left column should collapse into a single FAB ("⊕") on mobile that opens a sheet.
- Vote buttons should be the largest tap target on the screen.

### 5. Mesh state should be plain English

Today the primary status reads `Mesh: connecting · 1 peer(s)` — useful for debugging, baffling for users.

**Fix:** Show one of:

- _"Just you in this room. Share the link to invite others."_ (0 peers)
- _"Connected with 2 others."_ (peers > 0, status=connected)
- _"Trying to reconnect…"_ (status=connecting and was previously connected)
- _"Offline. Votes will sync when you reconnect."_ (offline)

Keep the technical view in the collapsed Diagnostics panel.

### 6. Vote affordance

The "Cast anonymous vote" button is at the bottom of a long list of polls. Sticky-to-bottom on scroll so it's always reachable, or one button per poll inline.

### 7. Question count badge

On a busy room, the Q&A column scrolls past. A small "5 new questions since you last looked" pill on scroll-up would help moderators.

### 8. Voting feedback

After casting, today the UI just shows "0 verified → 1 verified" updating somewhere. Show a clear confirmation toast: _"Vote cast anonymously. Your identity is hidden from everyone, including the room organizer."_

## Lower priority — nice to have

### 9. Roster import preview

When importing a CSV, show the first 3 rows + detected columns + a "this looks right" confirmation before committing. Today the inference happens silently.

### 10. Live-results toggle

Some session formats want to hide live tallies until the poll closes. Add a per-poll setting: "Show results to attendees: [Live] [Only after I close the poll]".

### 11. Poll templates

"3-point likert", "Yes/no", "Pick one of N", "Pick up to N" — a small dropdown when adding a poll. Faster than typing options every time.

### 12. URL hygiene

The room URL includes the full manifest in the fragment. For 30+ attendees that's a long URL. Consider:

- A short-link service (own one, since adding a third party would break the no-server property)
- Or accept it as a feature — long URLs are immediately recognizable as "this is the room"

### 13. Connection-quality indicator

When WebRTC is on the relay path (TURN-mediated), latency is higher. A small ⚡/🐢 indicator: _"Direct connection (fast)" vs "Relayed via TURN (slower)"_ would help users understand why typing in Q&A might lag.

### 14. Offline-first messaging

The app already works offline (local Yjs doc), but doesn't communicate that. On disconnect: _"You're offline. Your votes are saved locally and will sync when reconnected."_

### 15. Result export polish

The PDF/CSV/JSON export already exists. Add named bookmarks: _"Download results as: PDF for stakeholders / CSV for analysis / JSON for archive"_.

## What to NOT change

These are tempting "improvements" that would break the actual product:

- **Don't add login/accounts.** The whole point is anonymous attendance via Semaphore proofs. Identity is a feature; removing it would defeat the app.
- **Don't add a backend "for syncing".** Yjs CRDT over WebRTC is the architecture. Adding a server-side store changes the privacy model.
- **Don't auto-clear localStorage between sessions.** Some events span days; losing the room manifest on reload would lose state.
- **Don't add real-time presence beyond Yjs awareness.** "Florin is typing" defeats anonymity.

## Implementation order (suggested)

1. **First-load decision card** (#1) + **share-link modal** (#2) + **QR code** (#3) — together, one PR. Single biggest improvement.
2. **Plain-English mesh state** (#5) — one-line change.
3. **Mobile polish** (#4) + **sticky vote button** (#6) — second PR.
4. Everything else as taste/time allows.
