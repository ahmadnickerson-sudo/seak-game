// Town upgrade test (no browser): outer ring roads (walkable, connected, agent pathing, doors/spawns untouched) and the town square
// (brick paving, solid fountain/trees/benches, grass walkable, doors + spots reachable).
const fs=require('fs'),vm=require('vm');
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ctx);const E=ctx.module.exports;
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
const T=E.TOWN,g=(x,y)=>T.g[y][x],W=T.w,H=T.h;
const st=E.createState('TOWN',{speed:1});E.addPlayer(st,'me','Me');for(let i=0;i<7;i++)E.addPlayer(st,'a'+i,'A'+i);E.startGame(st,1000,'me');
const walk=(x,y)=>E.walkable(st,'town',x,y);
// ---- roads ----
const WEST=[1,2],EAST=[W-3,W-2];
for(const [name,xs] of [['west',WEST],['east',EAST]]){let all=true,walk_=true;for(let y=1;y<H-1;y++)for(const x of xs){if(g(x,y)!=='=')all=false;if(!walk(x,y))walk_=false;}
 ok(all,`${name} outer road is road tiles along the whole height (2 wide)`);ok(walk_,`${name} outer road is walkable`);}
ok(g(0,10)==='T'&&g(W-1,10)==='T','map border still trees outside the outer roads');
for(const y of [E.TOWN.houses[0].y+4,22,23,37]){ok(g(3,y)==='=' && g(2,y)==='=' && g(W-4,y)==='=' && g(W-3,y)==='=',`row ${y}: lane/main road touches both outer roads`);}
// connectivity: BFS over walkable tiles from the west outer road
function bfs(sx,sy,block){const seen=new Set([sx+','+sy]),q=[[sx,sy]];while(q.length){const [x,y]=q.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H||seen.has(nx+','+ny))continue;if(!walk(nx,ny)||(block&&block(nx,ny)))continue;seen.add(nx+','+ny);q.push([nx,ny]);}}return seen;}
const all=bfs(1,1);
ok(all.has((W-2)+',1')&&all.has((W-2)+','+(H-2)),'west and east outer roads are connected to each other');
// the ring is a loop: still connected with the centre avenue and the main road cut out
const cut=bfs(1,1,(x,y)=>((x>=33&&x<=34)&&y>=9&&y<=36)||((y>=22&&y<=23)&&x>=3&&x<=W-4));
ok(cut.has((W-2)+','+(H-2)),'ring is a loop: west and east roads stay connected via the top/bottom lanes without the avenue and main road');
// every house exit and building exit is reachable from the outer roads (nothing blocked)
for(const h of T.houses)ok(all.has(h.exit.x+','+h.exit.y),`house ${h.lot} exit reachable`);
for(const b of T.buildings){ok(all.has(b.exit.x+','+b.exit.y),`${b.id} exit reachable`);ok(g(b.door.x,b.door.y)==='P','door tile intact for '+b.id);}
for(const s of E.TOWN.spots){const adj=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>all.has((s.x+dx)+','+(s.y+dy)));ok(adj,`${s.place} spot ${s.x},${s.y} has a reachable neighbour`);}
// agent pathing: path function exists? use agent navigation through engine helper if present, else BFS length from west road to far east road
// ---- square ----
const PL=T.plaza;let brick=0;for(let y=PL.y;y<PL.y+PL.h;y++)for(let x=PL.x;x<PL.x+PL.w;x++)if(g(x,y)===',')brick++;
ok(brick>=60,`square has brick paving tiles (${brick})`);
const solid=(x,y)=>!walk(x,y);
const F=[[27,30],[28,30],[27,31],[28,31]];
ok(F.every(([x,y])=>g(x,y)==='F'&&solid(x,y)),'fountain is a solid 2x2');
ok(g(26,30)!=='F'&&g(29,30)!=='F','no stray fountain tiles');
let trees=0;for(let y=PL.y;y<PL.y+PL.h;y++)for(let x=PL.x;x<PL.x+PL.w;x++)if(g(x,y)==='T'){trees++;if(!solid(x,y))ok(false,'tree walkable');}
ok(trees>=6,`square has solid trees (${trees})`);
let grass=0,gOK=true;for(let y=PL.y;y<PL.y+PL.h;y++)for(let x=PL.x;x<PL.x+PL.w;x++)if(g(x,y)==='.'){grass++;if(!walk(x,y))gOK=false;}
ok(grass>=20&&gOK,`grass patches in the square are walkable (${grass})`);
for(const s of E.TOWN.spots.filter(s=>s.place==='plaza'))ok(g(s.x,s.y)==='S'&&solid(s.x,s.y),`bench ${s.x},${s.y} is solid`);
// every walkable tile in/around the square is reachable (nothing walled in)
let unreach=0;for(let y=PL.y-1;y<=PL.y+PL.h;y++)for(let x=PL.x-1;x<=PL.x+PL.w;x++)if(walk(x,y)&&!all.has(x+','+y))unreach++;
ok(unreach===0,'all walkable tiles around the square are reachable');
// route across the square: west side to east side along the avenue and along the brick
ok(all.has('22,30')&&all.has('44,30')&&all.has('33,30'),'square west, middle (avenue) and east are reachable');
// agents can actually path: run the three AIs for a while at high speed with the real engine loop if available
// nextStep (the agents' BFS): walk from the far west road to the far east road and to every spot/door using only nextStep
function route(sx,sy,goal,max){let x=sx,y=sy;for(let i=0;i<max;i++){if(goal(x,y))return i;const n=E.nextStep(st,'town',x,y,goal);if(!n)return -1;x=n[0];y=n[1];}return -1;}
{const r=route(1,1,(x,y)=>x===W-2&&y===H-2,400);ok(r>0,`agent BFS routes west outer road -> east outer road (${r} steps)`);
 const r2=route(1,10,(x,y)=>x===W-2&&y===10,400);ok(r2>0&&r2<=W,`agent route along the main road/lane crosses the map (${r2} steps)`);
 for(const s of T.spots)ok(route(W-2,5,(x,y)=>Math.abs(x-s.x)+Math.abs(y-s.y)===1,500)>0,`agent from the east road reaches ${s.place} spot ${s.x},${s.y}`);}
// full simulation: the three AIs live a day at high speed, no crash, every AI position is always on a walkable tile
{const st2=E.createState('SIM',{speed:.01});E.addPlayer(st2,'me','Me');for(const n of ['Pixel','Juno','Byte'])E.addPlayer(st2,'ai'+n,n+' (AI)',true);E.startGame(st2,1000,'me');
 let now=1000,bad=0,doors=new Set();for(let i=0;i<4000;i++){now+=100;E.tick(st2,now);for(const id of st2.order){const p=st2.players[id];if(p.pos.map==='town'&&!['.','=',',','D','P'].includes(E.tileAt(st2,'town',p.pos.x,p.pos.y)))bad++;if(p.pos.map!=='town')doors.add(id+':'+p.pos.map);}}
 ok(bad===0,'AI agents never stand on a solid tile (fountain/trees/benches) over 4000 ticks');ok(doors.size>0,'AI agents still enter buildings/homes ('+doors.size+' visits)');}
console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);
