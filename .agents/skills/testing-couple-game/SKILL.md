---
name: testing-couple-game
description: How to run and browser-test the LoveLink couple-game (Express + Socket.IO realtime 2-player web game) in couple-game/ with two simultaneous phone-sized clients.
---

# Testing LoveLink (couple-game)

## Run it
```bash
cd couple-game && npm install && node server.js      # PORT env, default 3000
curl -s localhost:3000/healthz                       # {"ok":true,"rooms":N}
```
`npm test` (socket-level smoke) and `npm run lint` also exist, but they do not prove UI behaviour —
the game is realtime and 2-player, so use two real browser clients.

## Two-client setup (mobile viewport)
The app is mobile-first; test at a phone-ish viewport. Separate Chrome **user-data-dirs** are
required so the two clients get separate socket sessions and separate `localStorage`
(`lovelink:name` is cached and prefills the nickname field):
```bash
google-chrome --user-data-dir=/tmp/profA --window-size=390,844 --new-window "http://localhost:3000/" &
google-chrome --user-data-dir=/tmp/profB --window-size=390,844 --new-window "http://localhost:3000/" &
wmctrl -l -G                       # then place them side by side, e.g.
wmctrl -i -r <id> -e 0,20,20,532,844
wmctrl -i -r <id> -e 0,720,20,532,844
```
Notes:
- Typing a URL with `?` in the omnibox can get mangled by autocomplete — click the omnibox,
  `ctrl+a`, type the full `http://localhost:3000/?room=CODE`, then Return.
- Dismiss the Chrome "Translate this page" bubble before clicking page elements.
- CDP/`browser_console` may be unavailable for these windows; rely on screenshots.

## Flow reference (public/app.js, src/rooms.js)
- Home: nickname → "Buat Room Baru" → URL becomes `/?room=CODE`; partner opens that URL (code
  auto-prefills) → "Gabung". Max 2 *connected* players; a 3rd gets "Room sudah penuh (maksimal 2 orang)",
  a bad code gets "Kode room tidak ditemukan."
- Reconnect: `joinRoom` matches a **disconnected player with the same (case-insensitive) name** and
  restores their slot + score — so always rejoin with the identical nickname.
- Mode selection only works when the room is full; both clients are switched by server broadcast.
- Quiz: per-player view hides the partner's answer until both submit (only `partnerSubmitted` flag).
  Selecting a mode resets both player scores to 0.
- Sinkron Hati: `goAt` = 2000–4500 ms after both ready, tap window 6000 ms after that. Screenshot
  round-trips are slow, so a round can time out while you poll — to test a **false start**, have both
  clients tap immediately after "Aku Siap" (finishes the round instantly with `falseStart`). For a
  normal round, wait ~5 s after ready then click both hearts in one batched action.
  Beware: the result panel's "Ronde Berikutnya" button sits near the heart's coordinates, so a
  late click can accidentally advance the round.

## Love-point sources
The header `love point` counter is a shared room value fed by three places in `src/rooms.js`:
quiz rounds where both guessed correctly (+2), completed Truth-or-Dare cards (+1), and Sinkron Hati
round points (0–3). A mismatch between a rendered pill and this counter was a real bug once — when
verifying scoring, always compare the panel text against the header, not just the panel.

## Devin Secrets Needed
None — everything runs locally with no credentials.
