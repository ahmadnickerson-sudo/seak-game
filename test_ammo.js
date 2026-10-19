// Ammo box tests: placement rules (offline) + solo logic + 2-client online pickup/respawn. PORT=4410 node test_ammo.js [--fast]
const DM=require('./shared.js'),WebSocket=require('./node_modules/ws');const PORT=process.env.PORT||4410;let fail=0;const ok=(n,c,d='')=>{console.log(c?'PASS':'FAIL',n,d);if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const S=DM.ammoSpots;ok('several spots ('+S.length+')',S.length>=12);
ok('no spot on solid/door/crate',S.every(s=>!DM.isSolid(s.x,s.y)&&DM.tiles[s.y][s.x]!=='d'&&DM.tiles[s.y][s.x]!=='C'));
const dc=[];for(const b of DM.buildings)for(const d of b.doors)dc.push([d.x,d.y],[d.out.x,d.out.y],[d.in.x,d.in.y]);
ok('no spot on/next to a door',S.every(s=>dc.every(c=>Math.abs(c[0]-s.x)>1||Math.abs(c[1]-s.y)>1)));
ok('some inside buildings',S.some(s=>DM.bidx[s.y][s.x]>=0));ok('some outdoors',S.some(s=>DM.bidx[s.y][s.x]<0));
// every spot reachable from player spawn (BFS field)
const f=DM.makeField(33,23);ok('all spots reachable',S.every(s=>f[s.y*DM.W+s.x]>=0));
// zombies can still reach players standing on a box (pickups are not solid)
ok('pickups non-solid',S.every(s=>!DM.circleBlocked(s.x,s.y,DM.PR)));
// solo logic
const g={players:{a:{hp:100,x:S[0].x,y:S[0].y,ammo:{1:Infinity,2:10,3:47}}},pickups:DM.ammoInit(),respawns:[]};const n0=g.pickups.length,t=1000;
DM.tickAmmo(g,t);const a=g.players.a;ok('MG +60 (10->70)',a.ammo[2]===70);ok('shotgun capped at 48',a.ammo[3]===48);ok('box removed',g.pickups.length===n0-1);
a.x=-5;DM.tickAmmo(g,t+24000);ok('no respawn before 25s',g.pickups.length===n0-1);DM.tickAmmo(g,t+25100);ok('respawns at same spot',g.pickups.length===n0&&g.pickups.some(p=>p.x===S[0].x&&p.y===S[0].y));
const g2={players:{a:{hp:100,x:S[0].x,y:S[0].y,ammo:{1:Infinity,2:180,3:48}}},pickups:DM.ammoInit(),respawns:[]};DM.tickAmmo(g2,t);ok('full ammo does not consume box',g2.pickups.length===n0);
(async()=>{const mk=()=>{const w=new WebSocket('ws://localhost:'+PORT);w.st=null;w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){w.id=m.id;w.code=m.code;w.st=m.game}if(m.t==='state')w.st=m.game;});return w;};
 const A=mk();await new Promise(r=>A.on('open',r));A.send(JSON.stringify({t:'create',name:'A'}));await sleep(800);
 const B=mk();await new Promise(r=>B.on('open',r));B.send(JSON.stringify({t:'join',code:A.code,name:'B'}));await sleep(500);for(const c of[A,B])c.send(JSON.stringify({t:'ready',v:true}));await sleep(300);A.send(JSON.stringify({t:'start'}));await sleep(500);
 ok('online: both clients see boxes',A.st.pickups.length>5&&B.st.pickups.length===A.st.pickups.length);
 const n=A.st.pickups.length;
 // walk A onto a box that is not the spawn one
 const tgt=A.st.pickups.reduce((q,p)=>Math.hypot(p.x-33,p.y-23)>Math.hypot(q.x-33,q.y-23)?q:p);
 const pa=()=>A.st.players[A.id];const ammo0=pa().ammo[2];
 const t0=Date.now();while(Date.now()-t0<60000&&A.st.pickups.some(p=>p.id===tgt.id)){const p=pa(),dx=tgt.x-p.x,dy=tgt.y-p.y,l=Math.hypot(dx,dy)||1;A.send(JSON.stringify({t:'input',mx:dx/l,my:dy/l,angle:0,weapon:1}));await sleep(50);}
 A.send(JSON.stringify({t:'input',mx:0,my:0,angle:0,weapon:1}));await sleep(200);
 ok('online: box collected by walking over it (or someone did)',!A.st.pickups.some(p=>p.id===tgt.id),'ammo '+ammo0+'->'+pa().ammo[2]);
 ok('online: other client sees it vanish',!B.st.pickups.some(p=>p.id===tgt.id));
 ok('online: pickup flash flag set',!!pa().pickAt);
 if(!process.argv.includes('--fast')){await sleep(26000);ok('online: box respawned for both',A.st.pickups.some(p=>p.id===tgt.id)&&B.st.pickups.some(p=>p.id===tgt.id));}
 A.close();B.close();console.log(fail?'FAILED':'ALL PASSED');process.exit(fail?1:0);})();
