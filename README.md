# Seak 🏡 (free-move edition)
A cozy multiplayer life-sim: you walk your AI agent roommate around a shared pastel town, keep its needs up, build your home, and visit neighbors.

## Play solo (no install)
Open `index.html` in a browser → **Play Solo**. You play with 3 AI neighbors who walk around using BFS pathfinding.

## Multiplayer (1–8 players incl. AI neighbors, room code, no login)
```
npm install
node server.js        # or: npm start  (honors PORT)
```
Open http://localhost:3000 → name → **Create room** → share the 4-letter code; others open the same URL and **Join**. Host can add AI neighbors in the lobby, then **Start**.
**Invite link:** the lobby shows `<your-site>/?room=CODE` with Copy (and Share on phones). Opening it shows a simple *Join room CODE* screen (`#nameIn` + `#joinBtn`; add `&name=Pinky` to prefill the name). Bad, full, or already-started rooms show a clear message. Hidden when the page is opened as a file.

**Agents / bots as players:** `node agent_client.js "https://your-site/?room=CODE" Pinky [--auto]` joins like a normal player over the same WebSocket. Commands on stdin: `status`, `go diner|office|school|arcade|mart|plaza|home|house <name>|x,y`, `do <action> [arg]`, `do gift <flowers|plush|f:item|coins:5|coins:10|coins:20> <player>`, `say <text>`, `run on|off`, `place <item>`, `start`, `auto on|off`, `quit`. Events print as JSON lines.

Same Wi-Fi: `http://<your-LAN-IP>:3000`. Public: deploy the folder to Render/Railway (start command `node server.js`).

## Controls
- Move: **Arrow keys / WASD**, or the on-screen D-pad (phones). Hold **Shift** (or toggle 🏃 Run) to run.
- Act: walk next to a spot and press **E / Space**, or tap the action button that pops up.
- Walk into a house door to go inside; step on **EXIT** to leave.
- Build: inside your own house, pick an item in the Build panel, then tap a free tile (dashed outline). Placement that would block a spot or the walkway is refused. **Rearrange:** press on placed furniture and drag it (mouse or touch) to another tile: valid tiles glow green, an invalid target shows red and the item snaps back. Furniture someone is using can't be moved. Synced through the server as a `move` action.

## What's new (free-move v2)
- Rooms hold up to 8 players (humans + AIs); 8 house lots (two new ones at the east end of each row).
- Town doubled to 68×46 tiles: roads, lanes, side paths, trees, and dashed **Open lots** for future locations.
- Walk-in buildings: **Town Diner** (counters), **Office** (desks), **School** (desks), **Arcade** (cabinets). Walk through the door to go in, EXIT to leave. The Plaza keeps benches and the fountain.
- **School:** Study at a school desk (one class per day, −5 Energy). Attend on 5 different days (School is open every day, Mon–Sun 8:00–15:00) to graduate 🎓; Work then pays 60% more. Progress shows in the HUD as “School N/5 days”.
- **Work** now costs Mood (−7) as well as Energy.
- **Run:** hold Shift (or toggle 🏃 Run on phones) to move about 1.8× faster. Walking costs ~1 Energy per 40 tiles, running 3×; can't run below 10 Energy. Below 30 Energy Mood slips slowly.
- **Premium (Seak Mart):** ⌚ Watch 80 (exact clock + opening times, +5 Mood), 🚗 Car 200 (parks at home, faster + no Energy drain on roads, +10 Mood).
- **Arcade mini-games:** press E at a cabinet. Pong (2 paired cabinets = 2-player online, CPU fallback after 5s), Blockfall, Chomp Maze. Score bonus up to +8 Mood on top of the normal Play reward; best scores are logged. `node test_arcade.js` checks them in headless Chrome.
- **Homes:** everyone starts in a Starter home (7×6). Real Estate desk: Cozy House 150 (9×7), Dream House 350 (11×8, +5 Mood per home sleep), Hilltop Villa 500 (13×9, only one, you move there). Not giftable.
- **Chat:** press E next to any player or agent: +4 Social each (AI neighbors answer with a speech bubble).
- A crowded diner now means other agents *inside* the diner: smaller meals.
- **Seak Mart** (walk-in store), **Great Shift streaks / Star Employee**, coins count toward the final score, **Richest** title, trophies on the results screen.

## Rules
| Spot | Action | Effect |
|---|---|---|
| Bed (every house starts with one) | Sleep | +18 Energy (+12 without a bed) and +4 Mood; own bed = Well rested: +8 more Energy, +6 more Mood; halved if a noisy hangout is next door |
| Diner counter (walk-in Diner) / home Kitchen | Eat/Cook | +10 / +14 Energy; smaller meal for each other agent inside the Diner; eating at the same time = +5 Social |
| Office desk / home Desk | Work | +16 (15 × 1.05) / +22 coins, −6 Energy, −7 Mood. Graduates ×1.6. **Great Shift** (Energy & Mood ≥ 60): +50% coins, +10% more per streak step (max +100%); 3 in a row = 🏅 Star Employee; every 10th Great Shift in a row (10, 20, 30…) pays a 🔥 streak bonus equal to that shift's pay (double coins) |
| School desk (walk-in School) | Study | −5 Energy, one class per day; 5 school days = Graduated 🎓 |
| Plaza bench / Couch / Café | Hang out | +8 / +10 / +12 Social; +3 per agent hanging out with you |
| Arcade cabinet (walk-in Arcade) / Console / Arcade machine | Play | +12 / +10 / +13 Mood |
| Neighbor's door | Visit | +8 Social for you, +5 Social & +1 visit for the owner (once per house per day); decor gives you Mood |
| Seak Mart aisles → Checkout | Shop | Treats (Coffee +12 Energy, Donut), Fun (Movie +15 Mood, New game +20 Mood), Gifts (Flowers/Plushie), Furniture (all 10 build items → your bag), Cosmetics (Cap/Top hat/Crown, Mint/Gold paint). Pay at the checkout; leaving without paying puts the cart back |
| Next to anyone with a gift or furniture in your bag | Give gift | Pick it in the 🎁 selector: Flowers +8 / Plushie +12 / furniture +8 Social for both. Furniture moves to their bag; they place it in their own home |
| Next to anyone, with coins | Gift coins | 🎁 selector → 5 / 10 / 20 coins move to them, +4 Social both. Max 30 coins given per player per day. AIs don't give coins (they can receive) |
| Next to any player/agent | Talk | +4 Social each (8 s cooldown) |

**Building:** furniture is bought at Seak Mart and goes to your bag. Inside your house, pick it in the Build panel and tap a free tile.

**End of week:** score = average needs + 10 × visits + 1 per 100 leftover coins. Titles: Best Host, Most Rested, Town Architect, Richest, plus 🏅 Star Employee badges and 🥇🥈🥉 trophies.

- **Real-time days:** each day is ~2½ min. Actions take a few seconds (your agent is busy) and then cool down ~12 s, so you get several actions a day but must choose. Overnight: Energy −22, Mood −18 (+decor), Social −18, +10 coins.
- **Timing (real time):** Work 20s, Sleep 20s, Study 15s, Eat/Hang/Play 8s; cooldown 15s (Work 12s).
- **No tile sharing:** two agents can't occupy one tile (server-enforced). Door tiles are always passable, entrants land one tile inside (offset if taken), and a blocked walker slips past after ~1s. AI pathfinding routes around occupied tiles.
- **Interiors:** desks/counters/cabinets/aisles laid out with 2-tile walkways, each station reachable from 2+ sides, and a clear 3×2 zone inside every door (tested).
- **Collisions:** a crowded diner gives smaller meals; eating at the same time as someone = shared meal (+Social); hanging out together stacks Social; a hangout in your house or a neighbor's (same row) halves the Sleep of anyone sleeping there; a Plaza party (2+) disturbs sleepers in the bottom-row houses; several visitors at once = packed house bonus.


## How it's built
- `index.html`: UI + canvas renderer + the shared engine (`<script id="engine">`).
- `server.js` loads that same engine with `vm`, runs it authoritatively (needs, coins, visits, day timer, AI), sends full state on change and positions at 10 Hz. Clients predict their own steps and interpolate everyone's movement.
- Test: `PORT=3100 SEAK_SPEED=0.01 node server.js` then `PORT=3100 node test_mp.js`. Invite/agent test (server at SEAK_SPEED=0.5): `PORT=3100 node test_invite.js`. Keyboard/solo test: `node test_keys.js`. Reopen test: `node test_reopen.js`. Furniture drag test: `node test_drag.js`. Engine test (buildings, school, chat, gifts, Mart, rewards, AI games): `node test_engine.js`.
- Previous turn-based version: git tag `v1`.
