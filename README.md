# Seak 🏡
A cozy multiplayer life-sim: you and your AI agent roommate seek your dream life in a shared town.

## Play solo (no install)
Double-click `index.html` → **Play Solo**. You play against 3 AI neighbor agents, all in the browser.

## Multiplayer (1–6 players, room code, no login)
```
npm install
node server.js        # or: npm start
```
Open http://localhost:3000 → enter name → **Create room** → share the 4-letter code. Friends open the same URL and **Join**.
- Same Wi-Fi: friends use `http://<your-LAN-IP>:3000` (find it with `ipconfig` / `ifconfig`).
- Public link: deploy this folder free to Render / Railway / Glitch (start command `node server.js`; the server honors `PORT`).
- Host can add **AI neighbors** in the lobby.

## How to play
Each day (~2¼ min, shared timer): **Plan** (60s) pick ONE instruction or type it ("cook for the neighbors") → **Build** (40s) buy items, tap a cell in your house to place → **Resolve** (30s) all agents act at once.
- Needs: Energy, Mood, Social (decay daily). Actions: Sleep, Eat/Cook, Hang out, Work, Play, Visit.
- Collisions: 2+ agents at the Town Diner (no home kitchen) get smaller meals; a home party (couch/café) wakes sleeping next-door agents; visits to one house stack for extra Social; shared meals give +Social.
- Items: Bed (Sleep+), Kitchen (cook at home), Couch/Café (host Hang out+), Desk (Work+), Console/Arcade (Play+), Plant/Lamp/Garden (daily Mood, visitor bonus).
- After Day 7: score = average needs + 10 × visits. Titles: Best Host, Most Rested, Town Architect.
- Tap any house to go inside; **Exit house** returns to town. Everyone pressing Ready skips the timer.

## Dev
- Rules live once in `index.html` `<script id="engine">`; `server.js` loads the same engine (authoritative state, 200 ms tick).
- `SEAK_SPEED=0.03 node server.js` then `node test_mp.js` runs a 2-client, 7-day sync test.
