// Headless tests for building collision, doors, crates, zombie pathing. Run: node test_walls.js
const DM=require('./shared.js');const fs=require('fs');
let fail=0;const ok=(n,c,d='')=>{console.log(c?'PASS':'FAIL',n,d);if(!c)fail++;};
const B=DM.buildings;
ok('14 buildings',B.length===14,B.length);
// doors
ok('every building has 2-3 doors on distinct sides',B.every(b=>b.doors.length>=2&&b.doors.length<=3&&new Set(b.doors.map(d=>d.s)).size===b.doors.length),B.map(b=>b.doors.length).join(','));
ok('bigger interiors get 3 doors',B.every(b=>((b.w-2)*(b.h-2)>=12)===(b.doors.length===3)));
// crates
ok('crates scale with interior size (1 per ~16 floor tiles, max 8)',B.every(b=>b.crates.length===Math.max(1,Math.min(8,Math.ceil((b.w-2)*(b.h-2)/16)))),B.map(b=>b.crates.length).join(','));
{const ORIG={house:[7,6],diner:[13,9],office:[13,9],school:[15,9],arcade:[13,9],mart:[17,11]};
 B.forEach(b=>{const o=b.id?ORIG[b.id]:(b.idx===8?[13,9]:ORIG.house);ok(`${b.id||'house'+b.idx}: interior matches original Seak (${o[0]-2}x${o[1]-2} floor)`,b.w===o[0]&&b.h===o[1]);});
 const crateFrac=B.map(b=>b.crates.length/((b.w-2)*(b.h-2)));ok('crates never exceed 12% of floor',crateFrac.every(f=>f<=.125),crateFrac.map(f=>f.toFixed(2)).join(','));
 ok('every building has 2-3 doors',B.every(b=>b.doors.length>=2&&b.doors.length<=3));
 const ov=[];for(const a of B)for(const c of B)if(a.idx<c.idx&&a.x<c.x+c.w&&c.x<a.x+a.w&&a.y<c.y+c.h&&c.y<a.y+a.h)ov.push(a.idx+'/'+c.idx);ok('no overlapping buildings',ov.length===0,ov.join());
 const roadHit=B.some(b=>{for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)if([1,2,33,34,65,66].includes(x)||[8,22,23,37].includes(y))return true;return false});ok('buildings keep the main/ring roads clear',!roadHit);}
ok('crates never on/next to doorway inner cells',B.every(b=>b.crates.every(c=>b.doors.every(d=>Math.abs(d.in.x-c[0])+Math.abs(d.in.y-c[1])>1))));
// all floor reachable from every door by BFS on the real solid grid
function reach(sx,sy){const seen=new Set([sx+','+sy]),q=[[sx,sy]];while(q.length){const[x,y]=q.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(seen.has(k)||DM.isSolid(nx,ny))continue;seen.add(k);q.push([nx,ny]);}}return seen;}
const spawnReach=reach(33,23);
for(const b of B){const fl=[];for(let y=b.y+1;y<b.y+b.h-1;y++)for(let x=b.x+1;x<b.x+b.w-1;x++)if(!b.crates.some(c=>c[0]===x&&c[1]===y))fl.push(x+','+y);
 ok(`${b.id||'house'+b.idx}: all interior floor reachable from road`,fl.every(k=>spawnReach.has(k)));
 ok(`${b.id||'house'+b.idx}: every door reachable from road both ways`,b.doors.every(d=>spawnReach.has(d.out.x+','+d.out.y)&&spawnReach.has(d.x+','+d.y)));}
// walls solid for players
for(const b of B){const t=b.doors[0];
 // find a wall tile (not a door) and try to walk into it from outside
 let wall=null;for(let x=b.x;x<b.x+b.w&&!wall;x++)if(DM.tiles[b.y][x]==='W'&&groundOut(x,b.y-1))wall={x,y:b.y,ox:x,oy:b.y-1};
 function groundOut(x,y){return !DM.isSolid(x,y);}
 if(wall){const p={x:wall.ox,y:wall.oy};for(let i=0;i<60;i++)DM.moveEntity(p,0,.1,DM.PR);ok(`${b.id||'house'+b.idx}: cannot walk through wall`,p.y<wall.y-.5+.01+0.0&&p.y<=wall.y-.5,p.y.toFixed(2));}}
// walk in and out of every door with the player circle (straight in, to far interior, back out)
let walked=0,total=0;
for(const b of B)for(const d of b.doors){total++;
 const p={x:d.out.x,y:d.out.y};const dir={x:Math.sign(d.in.x-d.out.x),y:Math.sign(d.in.y-d.out.y)};
 for(let i=0;i<20;i++)DM.moveEntity(p,dir.x*.1,dir.y*.1,DM.PR);
 const inside=Math.round(p.x)===d.in.x&&Math.round(p.y)===d.in.y||(Math.abs(p.x-d.in.x)<.6&&Math.abs(p.y-d.in.y)<.6);
 for(let i=0;i<20;i++)DM.moveEntity(p,-dir.x*.1,-dir.y*.1,DM.PR);
 const out=Math.abs(p.x-d.out.x)<.6&&Math.abs(p.y-d.out.y)<.6;if(inside&&out)walked++;else console.log('  stuck at',b.id||b.idx,d,p);}
ok(`players walk in and out of every door (${walked}/${total})`,walked===total);
// bullets
{const b=B[0],c=b.crates[0];const g={bullets:[{x:c[0]-3,y:c[1],vx:15,vy:0,damage:1,life:35}],zombies:[]};
 // approach crate along its row from the west only if clear: just step bullet straight into crate cell
 const gg={bullets:[{x:c[0]-.9,y:c[1],vx:15,vy:0,damage:1,life:35}],zombies:[]};for(let i=0;i<5;i++)DM.tickBullets(gg,50);ok('bullet stopped by crate',gg.bullets.length===0);
 const w=b.doors[0];const o={bullets:[{x:w.out.x,y:w.out.y,vx:Math.sign(w.in.x-w.out.x)*15,vy:Math.sign(w.in.y-w.out.y)*15,damage:1,life:35}],zombies:[]};DM.tickBullets(o,10);DM.tickBullets(o,10);ok('bullet passes through doorway',o.bullets.length===1&&!DM.pointSolid(o.bullets[0].x,o.bullets[0].y));
 // bullet fired at wall
 let wl=null;for(let x=b.x;x<b.x+b.w;x++)if(DM.tiles[b.y][x]==='W'){wl=x;break;}
 const wb={bullets:[{x:wl,y:b.y-2,vx:0,vy:15,damage:1,life:35}],zombies:[]};for(let i=0;i<4;i++)DM.tickBullets(wb,50);ok('bullet stopped by wall',wb.bullets.length===0);
 // bullet cannot hit zombie behind a wall
 const zb={bullets:[{x:wl,y:b.y-2,vx:0,vy:15,damage:50,life:35}],zombies:[{x:wl,y:b.y+1,hp:40}]};for(let i=0;i<4;i++)DM.tickBullets(zb,50);ok('zombie behind wall not hit',zb.zombies.length===1&&zb.zombies[0].hp===40);}
// zombie pathing: chase players hiding at the farthest interior cell of every building
function sim(game,seconds){const t0=1e6;let now=t0;for(let i=0;i<seconds*20;i++){now+=50;DM.tickZombies(game,50,now);for(const p of Object.values(game.players))p.hp=100;}return game;}
let zOk=0,zTot=0,minD=0;
const starts=[[1,1],[66,1],[1,44],[66,44],[33,1],[33,44],[1,22],[66,22],[20,10],[45,36],[10,24],[57,24]].filter(s=>!DM.circleBlocked(s[0],s[1],DM.ZR));
for(const b of B){
 const fl=[];for(let y=b.y+1;y<b.y+b.h-1;y++)for(let x=b.x+1;x<b.x+b.w-1;x++)if(!b.crates.some(c=>c[0]===x&&c[1]===y))fl.push([x,y]);
 const far=fl.sort((a,c)=>Math.min(...b.doors.map(d=>Math.abs(d.in.x-c[0])+Math.abs(d.in.y-c[1])))-Math.min(...b.doors.map(d=>Math.abs(d.in.x-a[0])+Math.abs(d.in.y-a[1]))))[0];
 const game={players:{p:{id:'p',x:far[0],y:far[1],hp:100}},zombies:starts.map((s,i)=>({id:i,x:s[0],y:s[1],hp:50,speed:1.8,damage:0,hitAt:0,type:0})),bullets:[]};
 // 90 simulated seconds, record when each zombie first gets within melee range
 const got=new Set();let now=1e6;for(let i=0;i<90*20;i++){now+=50;DM.tickZombies(game,50,now);for(const z of game.zombies)if(Math.hypot(z.x-far[0],z.y-far[1])<.7)got.add(z.id);}
 zTot+=game.zombies.length;zOk+=got.size;if(got.size!==game.zombies.length)console.log('  not reached',b.id||b.idx,game.zombies.filter(z=>!got.has(z.id)).map(z=>[starts[z.id],z.x.toFixed(1),z.y.toFixed(1)].join(' ')));
 for(const z of game.zombies)if(DM.circleBlocked(z.x,z.y,DM.ZR*.99))minD++;}
ok(`zombies from 12 map points reach a player hiding deep in each building (${zOk}/${zTot})`,zOk===zTot);
ok('no zombie ended inside a solid tile',minD===0,minD);
// zombies exit buildings to chase a player outside
{const b=B[8];const c=b.crates[0];const game={players:{p:{id:'p',x:33,y:23,hp:100}},zombies:[{id:1,x:b.x+2,y:b.y+1,hp:9,speed:1.8,hitAt:0,type:0,damage:0}],bullets:[]};
 let now=1e6,hit=false;for(let i=0;i<60*20&&!hit;i++){now+=50;DM.tickZombies(game,50,now);hit=Math.hypot(game.zombies[0].x-33,game.zombies[0].y-23)<.7;}ok('zombie leaves a building (via a door) to reach a player outside',hit);}
// spawn points valid
let bad=0;for(let i=0;i<2000;i++){const s=DM.spawnPoint(Math.random);if(DM.circleBlocked(s.x,s.y,DM.ZR)||!spawnReach.has(Math.round(s.x)+','+Math.round(s.y)))bad++;}
ok('2000 zombie spawn points are open and connected',bad===0,bad);
ok('player start (33,23) open',!DM.circleBlocked(33,23,DM.PR)&&!DM.circleBlocked(31.5,21.5,DM.PR)&&!DM.circleBlocked(34.5,24.5,DM.PR));
// map layout unchanged: ground tiles equal original outside buildings
const orig=JSON.parse(fs.readFileSync('/tmp/new.json','utf8')).g;let diff=0;for(let y=0;y<DM.H;y++)for(let x=0;x<DM.W;x++){if(DM.bidx[y][x]<0&&orig[y][x]!==DM.tiles[y][x])diff++;}
ok('map outside building footprints unchanged',diff===0,diff);
// client/server share identical map code
const html=fs.readFileSync(__dirname+'/index.html','utf8'),sh=fs.readFileSync(__dirname+'/shared.js','utf8');
ok('index.html embeds identical shared.js',html.includes(sh.trim()));
console.log(fail?`\n${fail} FAILED`:'\nALL PASSED');process.exit(fail?1:0);
