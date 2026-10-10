# Seak 🏡 (free-move edition)
A cozy multiplayer life-sim: you walk your AI agent roommate around a shared pastel town, keep its needs up, build your home, and visit neighbors.

## Play solo (no install)
Open `index.html` in a browser → **Play Solo**. You play with 3 AI neighbors who walk around using BFS pathfinding.

## Multiplayer (1–6 players, room code, no login)
```
npm install
node server.js        # or: npm start  (honors PORT)
```
Open http://localhost:3000 → name → **Create room** → share the 4-letter code; others open the same URL and **Join**. Host can add AI neighbors in the lobby, then **Start**.
Same Wi-Fi: `http://<your-LAN-IP>:3000`. Public: deploy the folder to Render/Railway (start command `node server.js`).

## Controls
- Move: **Arrow keys / WASD**, or the on-screen D-pad (phones).
- Act: walk next to a spot and press **E / Space**, or tap the action button that pops up.
- Walk into a house door to go inside; step on **EXIT** to leave.
- Build: inside your own house, pick an item in the Build panel, then tap a free tile (dashed outline). Placement that would block a spot or the walkway is refused.

## Rules
| Spot | Action | Effect |
|---|---|---|
| Bed (every house starts with one) | Sleep | +18 Energy |
| Diner counter / home Kitchen | Eat/Cook | +10 / +14 Energy |
| Office desk / home Desk | Work | +15 / +22 coins, −6 Energy |
| Plaza bench / Couch / Café | Hang out | +8 / +10 / +12 Social |
| Plaza arcade / Console / Arcade | Play | +8 / +10 / +13 Mood |
| Neighbor's door | Visit | +8 Social you, +5 Social & +1 visit for owner (once per house per day); decor gives you Mood |

- **Real-time days:** each day is ~2½ min. Actions take a few seconds (your agent is busy) and then cool down ~12 s, so you get several actions a day but must choose. Overnight: Energy −22, Mood −18 (+decor), Social −18, +10 coins.
- **Collisions:** a crowded diner gives smaller meals; eating at the same time as someone = shared meal (+Social); hanging out together stacks Social; a hangout in your house or a neighbor's (same row) halves the Sleep of anyone sleeping there; a Plaza party (2+) disturbs sleepers in the bottom-row houses; several visitors at once = packed house bonus.
- **After Day 7:** score = average needs + 10 × visits. Titles: Best Host (visits), Most Rested (Energy), Town Architect (items built).

## How it's built
- `index.html`: UI + canvas renderer + the shared engine (`<script id="engine">`).
- `server.js` loads that same engine with `vm`, runs it authoritatively (needs, coins, visits, day timer, AI), sends full state on change and positions at 10 Hz. Clients predict their own steps and interpolate everyone's movement.
- Test: `PORT=3100 SEAK_SPEED=0.06 node server.js` then `PORT=3100 node test_mp.js`. Keyboard/solo test (headless Chrome, real key events on file://): `node test_keys.js`.
- Previous turn-based version: git tag `v1`.
