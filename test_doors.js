// Door regression test (no browser): player doors (enter+exit, screen-direction keys incl. diagonal fallback, all buildings + houses) and agent doors
// (Pixel/Juno/Byte entering and leaving buildings), plus the earlier guarantees: no diagonal door entry, no corner cutting.
const fs=require('fs'),vm=require('vm');
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ctx);const E=ctx.module.exports;
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
const SD={up:[-1,-1],down:[1,1],left:[-1,1],right:[1,-1]};
// what the client does for one held screen key
function press(st,id,key,now){const p=st.players[id];const hd=SD[key];for(const d of E.stepTries(st,id,hd)){if(E.step(st,id,d[0],d[1],now))return true;}return false;}
// every (key) the player might press when standing at (x,y) for a given target door: any key whose screen vector contains the axis towards the door
const keysToward=(dx,dy)=>Object.keys(SD).filter(k=>SD[k][0]===dx||SD[k][1]===dy).filter(k=>(dx&&SD[k][0]===dx)||(dy&&SD[k][1]===dy));
function fresh(){const st=E.createState('DOOR',{speed:1});E.addPlayer(st,'me','Me');for(let i=0;i<4;i++)E.addPlayer(st,'h'+i,'H'+i);E.startGame(st,1000,'me');st.dayStart=1000-st.dur.day*12/24;st.dayEnd=st.dayStart+st.dur.day;return st;}
let T=100000;const nowT=()=>(T+=400);
// ---------- player: buildings ----------
{const st=fresh();const p=st.players.me;
 for(const b of E.TOWN.buildings){const sign=Math.sign;const ed={x:b.door.x-b.exit.x,y:b.door.y-b.exit.y};
  // approach: stand on the exit tile; the door is exactly one orthogonal step away
  for(const key of keysToward(ed.x,ed.y)){p.pos={map:'town',x:b.exit.x,y:b.exit.y,dir:'up'};st.dayStart=nowT()-st.dur.day*12/24;st.dayEnd=st.dayStart+st.dur.day;
   const r=press(st,'me',key,nowT());ok(r&&p.pos.map==='b:'+b.id,`${b.id}: pressing ${key} at the door walks IN (${p.pos.map})`);
   if(p.pos.map==='b:'+b.id){const I=E.pubInfo(b.id);const ex={x:I.door.x-p.pos.x,y:I.door.y-p.pos.y};
    // walk to spawn then out: from the spawn tile the exit door is straight ahead
    p.pos.x=I.spawn.x;p.pos.y=I.spawn.y;const dd={x:I.door.x-I.spawn.x,y:I.door.y-I.spawn.y};let out=false;
    for(const k2 of keysToward(dd.x,dd.y)){p.pos={map:'b:'+b.id,x:I.spawn.x,y:I.spawn.y,dir:'up'};out=press(st,'me',k2,nowT())&&p.pos.map==='town';if(!out)ok(false,`${b.id}: key ${k2} does not walk OUT`);}
    ok(out,`${b.id}: pressing toward the exit walks OUT`);}}
  // diagonal never enters a door
  const dg=[[ed.x||1,ed.y||1],[-(ed.x||1),ed.y||1]];}
 // no diagonal door entry (direct engine step diagonally onto the door tile)
 const b=E.TOWN.buildings[0];for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){p.pos={map:'town',x:b.door.x-sx,y:b.door.y-sy,dir:'up'};const was=E.walkable(st,'town',p.pos.x,p.pos.y);if(!was)continue;const r=E.step(st,'me',sx,sy,nowT());ok(!(r&&p.pos.map!=='town'),`diagonal step onto ${b.id} door does not enter`);}
}
// ---------- player: houses ----------
{const st=fresh();for(const id of st.order){}
 for(const id of st.order){const p=st.players[id];const h=E.TOWN.houses[p.lot];const ed={x:h.door.x-h.exit.x,y:h.door.y-h.exit.y};
  for(const key of keysToward(ed.x,ed.y)){p.pos={map:'town',x:h.exit.x,y:h.exit.y,dir:'up'};const r=press(st,id,key,nowT());ok(r&&p.pos.map==='h'+p.lot,`${p.name}'s house: ${key} walks IN`);
   if(p.pos.map==='h'+p.lot){const I=E.homeInfo(st,p.lot);const dd={x:I.door.x-I.spawn.x,y:I.door.y-I.spawn.y};let out=false;for(const k2 of keysToward(dd.x,dd.y)){p.pos={map:'h'+p.lot,x:I.spawn.x,y:I.spawn.y,dir:'up'};out=press(st,id,k2,nowT())&&p.pos.map==='town';if(!out)ok(false,`house ${p.lot}: ${k2} does not exit`);}ok(out,`${p.name}'s house: walks OUT`);}}}
 // visiting a neighbour (another player's door) works too
 const a=st.players.me,bp=st.players.h0,hb=E.TOWN.houses[bp.lot];a.pos={map:'town',x:hb.exit.x,y:hb.exit.y,dir:'up'};const ed={x:hb.door.x-hb.exit.x,y:hb.door.y-hb.exit.y};
 ok(press(st,'me',keysToward(ed.x,ed.y)[0],nowT())&&a.pos.map==='h'+bp.lot,"walking into a neighbour's door visits");}
// ---------- corner cutting / diagonal rules still hold ----------
{const st=fresh();const p=st.players.me;const b=E.TOWN.buildings.find(b=>b.id==='mart')||E.TOWN.buildings[0];
 // diagonal moves that would clip a wall corner are refused
 let refused=0,tried=0;for(let y=b.y-1;y<=b.y+b.h;y++)for(let x=b.x-1;x<=b.x+b.w;x++){for(const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){if(!E.walkable(st,'town',x,y)||E.tileAt(st,'town',x,y)==='D'||E.tileAt(st,'town',x,y)==='P')continue;const nx=x+dx,ny=y+dy;if(!E.walkable(st,'town',nx,ny))continue;
   const sideBlocked=!E.walkable(st,'town',x+dx,y)||!E.walkable(st,'town',x,y+dy);if(!sideBlocked)continue;tried++;p.pos={map:'town',x,y,dir:'up'};if(!E.step(st,'me',dx,dy,nowT()))refused++;}}
 ok(tried>0&&refused===tried,`no corner cutting (${refused}/${tried} refused)`);}
// ---------- agents: Pixel, Juno, Byte enter and leave buildings ----------
{const st=E.createState('AGT',{speed:1});E.addPlayer(st,'me','Me');['Pixel','Juno','Byte'].forEach((n,i)=>E.addPlayer(st,'ai'+i,n+' (AI)',true));E.startGame(st,1000,'me');st.dayStart=1000-st.dur.day*12/24;st.dayEnd=st.dayStart+st.dur.day;
 // direct path: from a building's exit tile an agent following the pathfinder steps through the door and later back out
 for(const id of ['ai0','ai1','ai2']){const p=st.players[id];let entered=0,left=0,now=1000;
  for(const b of E.TOWN.buildings){p.pos={map:'town',x:b.exit.x,y:b.exit.y,dir:'up'};const n=E.nextStep(st,'town',p.pos.x,p.pos.y,(x,y)=>x===b.door.x&&y===b.door.y);now+=400;
   if(n&&E.step(st,id,n[0]-p.pos.x,n[1]-p.pos.y,now)&&p.pos.map==='b:'+b.id){entered++;const I=E.pubInfo(b.id);p.pos={map:p.pos.map,x:I.spawn.x,y:I.spawn.y,dir:'up'};const m=E.nextStep(st,p.pos.map,p.pos.x,p.pos.y,(x,y)=>x===I.door.x&&y===I.door.y);now+=400;if(m&&E.step(st,id,m[0]-p.pos.x,m[1]-p.pos.y,now)&&p.pos.map==='town')left++;}}
  ok(entered===E.TOWN.buildings.length&&left===entered,`${st.players[id].name}: pathfinder enters and leaves all ${E.TOWN.buildings.length} buildings (${entered}/${left})`);}
 // live simulation: with the real AI loop agents visit buildings and come back out
 const st2=E.createState('SIM',{speed:1});E.addPlayer(st2,'me','Me');['Pixel','Juno','Byte'].forEach((n,i)=>E.addPlayer(st2,'ai'+i,n+' (AI)',true));E.startGame(st2,1000,'me');
 const inB={ai0:0,ai1:0,ai2:0},outB={ai0:0,ai1:0,ai2:0},was={};let now=1000;
 for(let i=0;i<9000;i++){now+=250;st2.players.me.needs.energy=100;E.tick(st2,now);for(const id of ['ai0','ai1','ai2']){const m=st2.players[id].pos.map,w=was[id]||'town';if(w==='town'&&m[0]==='b')inB[id]++;if(w[0]==='b'&&m==='town')outB[id]++;was[id]=m;}if(st2.phase!=='day')break;}
 for(const id of ['ai0','ai1','ai2'])ok(inB[id]>0&&outB[id]>0,`${st2.players[id].name} in the live AI loop: entered ${inB[id]}x, left ${outB[id]}x`);
 // agents also enter/leave their own house
 let homeIn=0;const w2={};const st3=E.createState('HM',{speed:1});E.addPlayer(st3,'me','Me');E.addPlayer(st3,'ai0','Pixel (AI)',true);E.startGame(st3,1000,'me');let n3=1000;for(let i=0;i<9000&&st3.phase==='day';i++){n3+=250;st3.players.me.needs.energy=100;E.tick(st3,n3);const m=st3.players.ai0.pos.map;if((w2.m||'town')==='town'&&m[0]==='h')homeIn++;w2.m=m;}
 ok(homeIn>0,`Pixel enters a house in the live loop (${homeIn}x)`);}
console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);
