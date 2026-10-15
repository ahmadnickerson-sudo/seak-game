// Ice cream stand test (no browser): solid 2x1 stand beside the town square, nothing blocked, agents never stuck, purchase rules.
const fs=require('fs'),vm=require('vm');
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ctx);const E=ctx.module.exports;
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
const T=E.TOWN,W=T.w,H=T.h;
const st=E.createState('ICE',{speed:1});E.addPlayer(st,'me','Me');for(let i=0;i<3;i++)E.addPlayer(st,'a'+i,'A'+i,true);E.startGame(st,1000,'me');
const walk=(x,y)=>E.walkable(st,'town',x,y);
const stand=[[40,30],[41,30]],PL=T.plaza;
ok(stand.every(([x,y])=>T.g[y][x]==='I'),'stand tiles exist (2x1)');
ok(stand.every(([x,y])=>!walk(x,y)),'stand is solid (not walkable)');
ok(stand.every(([x,y])=>x>=PL.x&&x<PL.x+PL.w&&y>=PL.y&&y<PL.y+PL.h),'stand sits in the town square, east side');
ok(T.g.join('').split('I').length-1===2,'exactly 2 stand tiles');
// not blocking anything: tiles around it are walkable, doors/spawns/spots unchanged
for(const [x,y] of [[39,30],[42,30],[40,29],[41,29],[40,31],[41,31]])ok(walk(x,y)||T.g[y][x]==='S',`neighbour ${x},${y} stays walkable`);
for(const h of T.houses)ok(T.g[h.door.y][h.door.x]==='D'&&walk(h.exit.x,h.exit.y),`house ${h.lot} door+exit intact`);
for(const b of T.buildings)ok(T.g[b.door.y][b.door.x]==='P','door intact '+b.id);
// reachability: flood from the west road
const seen=new Set(['1,1']),q=[[1,1]];while(q.length){const [x,y]=q.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(nx<0||ny<0||nx>=W||ny>=H||seen.has(k)||!walk(nx,ny))continue;seen.add(k);q.push([nx,ny]);}}
let unreach=0;for(let y=PL.y-1;y<=PL.y+PL.h;y++)for(let x=PL.x-1;x<=PL.x+PL.w;x++)if(walk(x,y)&&!seen.has(x+','+y))unreach++;
ok(unreach===0,'every walkable tile around the square still reachable');
ok(seen.has('40,31')&&seen.has('41,29'),'both serving sides (north and south) are reachable');
for(const h of T.houses)ok(seen.has(h.exit.x+','+h.exit.y),`house ${h.lot} exit reachable`);
// agents can route around it, and to it
function route(sx,sy,goal){let x=sx,y=sy;for(let i=0;i<500;i++){if(goal(x,y))return i;const n=E.nextStep(st,'town',x,y,goal);if(!n)return -1;x=n[0];y=n[1];}return -1;}
ok(route(1,1,(x,y)=>x===W-2&&y===H-2)>0,'agent crosses the map');
ok(route(30,30,(x,y)=>x===45&&y===30)>0,'agent crosses the square east past the stand');
ok(route(1,1,(x,y)=>stand.some(([sx,sy])=>Math.abs(sx-x)+Math.abs(sy-y)===1))>0,'agent can reach a tile next to the stand');
// purchase
const p=st.players.me;p.pos={map:'town',x:40,y:31,dir:'up'};p.coins=20;p.needs.mood=50;
ok(E.actionsAt(st,'me').some(a=>a.action==='icecream'&&a.src==='Ice cream stand'),'standing next to the stand offers Buy ice cream');
ok(E.doAction(st,'me','icecream',2000)==='ok','purchase succeeds');
ok(p.coins===16&&p.needs.mood===56,`costs 4 coins, +6 Mood (coins ${p.coins}, mood ${p.needs.mood})`);
ok(E.doAction(st,'me','icecream',2001)!=='ok'&&p.coins===16,'cooldown stops spam, no charge');
ok(E.doAction(st,'me','icecream',2000+st.dur.cooldown+1)==='ok'&&p.coins===12,'can buy again after cooldown');
p.cd={};p.coins=3;p.needs.mood=50;ok(E.doAction(st,'me','icecream',99999)!=='ok'&&p.coins===3&&p.needs.mood===50,'too few coins: refused, nothing changes');
p.coins=50;p.needs.mood=98;p.cd={};E.doAction(st,'me','icecream',199999);ok(p.needs.mood===100,'mood caps at 100');
p.pos={map:'town',x:36,y:31,dir:'up'};p.cd={};p.coins=50;ok(E.doAction(st,'me','icecream',299999)!=='ok'&&p.coins===50,'must stand next to the stand');
// agents never use it and never get stuck: simulate a day
const me2=E.createState('ICE2',{speed:0.01});E.addPlayer(me2,'me','Me');['Pixel','Juno','Byte'].forEach((n,i)=>E.addPlayer(me2,'ai'+i,n+' (AI)',true));E.startGame(me2,1000,'me');
let now=1000,bad=0;for(let i=0;i<6000;i++){now+=200;E.tick(me2,now);for(const id of me2.order){const q=me2.players[id];if(q.pos.map==='town'&&!E.walkable(me2,'town',q.pos.x,q.pos.y))bad++;}}
ok(bad===0,'agents never stand on a solid tile over a simulated run');
console.log(fails?`\n${fails} FAILED`:'\nAll ice cream tests passed');process.exit(fails?1:0);
