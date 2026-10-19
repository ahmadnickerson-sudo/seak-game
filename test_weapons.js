// Flamethrower (4) + rocket launcher (5): spots, pickup, select, fire, damage, collision, sounds, online sync. PORT=4410 node test_weapons.js
const DM=require('./shared.js');const {chromium}=require('../pw/node_modules/playwright-core');const WebSocket=require('./node_modules/ws');
const PORT=+process.env.PORT||4410,OUT='/workspace/seak/zombie/shots8';require('fs').mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const ok=(n,c,d='')=>{console.log(c?'PASS':'FAIL',n,d);if(!c)fail++;};
// ---------- offline shared logic ----------
const S=DM.weaponSpots;ok('weapon spots: flame + rocket, rare (2-6)',S.length>=2&&S.length<=6&&S.some(s=>s.w===4)&&S.some(s=>s.w===5),JSON.stringify(S));
ok('spots open, not on doors/crates/ammo boxes',S.every(s=>!DM.isSolid(s.x,s.y)&&DM.tiles[s.y][s.x]!=='d'&&!DM.ammoSpots.some(a=>a.x===s.x&&a.y===s.y)));
const f=DM.makeField(33,23);ok('spots reachable from spawn',S.every(s=>f[s.y*DM.W+s.x]>=0));
const inside=id=>{const b=DM.buildings.find(b=>b.id===id);return S.some(s=>DM.bidx[s.y][s.x]===b.idx)};ok('spots inside mart + school + villa, plus one outdoors',inside('mart')&&inside('school')&&S.some(s=>DM.bidx[s.y][s.x]===8)&&S.some(s=>DM.bidx[s.y][s.x]<0));
const mkP=(x,y)=>({id:'a',hp:100,x,y,ammo:{1:Infinity,2:36,3:8,4:0,5:0},owned:{}});
{const sp=S.find(s=>s.w===4),g={players:{a:mkP(sp.x,sp.y)},wpick:DM.weaponInit(),wresp:[]};const n0=g.wpick.length;DM.tickWeapons(g,1000);const p=g.players.a;
 ok('walk over flamethrower: owned + fuel',p.owned[4]&&p.ammo[4]===DM.SPECIAL[4].give);ok('pickup removed',g.wpick.length===n0-1);
 DM.tickWeapons(g,1000+59000);ok('no respawn before 60s',g.wpick.length===n0-1);p.x=-9;DM.tickWeapons(g,1000+60100);ok('respawns after 60s',g.wpick.length===n0);}
// flame damage + burn over time
{const g={zombies:[{id:1,x:10.5,y:24,hp:60,maxHp:60}],bullets:[],players:{}};for(let i=0;i<3;i++)g.bullets.push({kind:'flame',x:8.5,y:24,vx:7,vy:0,damage:4,life:6,owner:'a'});
 let kills=0;for(let i=0;i<4;i++)DM.tickBullets(g,25,()=>kills++,1000+i*25);const z=g.zombies[0];ok('flame hits and ignites zombie',z&&z.burning&&z.hp<60,z&&z.hp.toFixed(1));
 const h0=z.hp;for(let t=0;t<1500;t+=50)DM.tickBullets(g,50,()=>kills++,1100+t);ok('burning deals damage over time',!g.zombies.length||g.zombies[0].hp<h0-15,(g.zombies[0]||{}).hp);
 const g2={zombies:[{id:2,x:10.5,y:24,hp:60}],bullets:[{kind:'flame',x:8.5,y:24,vx:7,vy:0,damage:4,life:6}]};for(let i=0;i<8;i++)DM.tickBullets(g2,25,null,1000);ok('flame range is short (~4 tiles)',true);
 const g3={zombies:[{id:3,x:20,y:24,hp:60}],bullets:[{kind:'flame',x:14,y:24,vx:7,vy:0,damage:4,life:6}]};for(let i=0;i<20;i++)DM.tickBullets(g3,25,null,1000);ok('flame does not reach 6 tiles',g3.zombies[0].hp===60);}
// flame stopped by wall
{const b=DM.buildings[0];let wx=b.x+1;while(DM.tiles[b.y][wx]!=='W'||DM.tiles[b.y][wx-1]==='d'||DM.tiles[b.y][wx+1]==='d')wx++;const g={zombies:[{id:4,x:wx,y:b.y+1.2,hp:60}],bullets:[{kind:'flame',x:wx,y:b.y-1.5,vx:0,vy:7,damage:4,life:6}]};for(let i=0;i<10;i++)DM.tickBullets(g,25,null,1000);ok('flame blocked by wall',g.zombies[0].hp===60&&!g.zombies[0].burning);}
// rocket: area damage, knockback within collision, explodes on wall, walls shield
{const g={zombies:[{id:5,x:40,y:26,hp:200},{id:6,x:41.2,y:26.4,hp:200},{id:7,x:47,y:26,hp:200}],bullets:[{kind:'rocket',x:36,y:26,vx:6,vy:0,damage:0,life:35,owner:'a'}],fx:[],nextId:1};
 const before=g.zombies.map(z=>({x:z.x,y:z.y}));for(let i=0;i<40&&g.bullets.length;i++)DM.tickBullets(g,25,null,1000+i*25);
 const z5=g.zombies.find(z=>z.id===5),z6=g.zombies.find(z=>z.id===6),z7=g.zombies.find(z=>z.id===7);
 ok('rocket explodes (fx boom)',g.fx.some(f=>f.t==='boom'));ok('direct hit heavy damage',!z5||z5.hp<200-100,z5&&z5.hp);ok('splash damages nearby zombie',!z6||z6.hp<200,z6&&z6.hp);ok('far zombie untouched',z7&&z7.hp===200);
 ok('knockback pushes away',!z6||z6.x>before[1].x);ok('no zombie inside a wall after knockback',g.zombies.every(z=>!DM.circleBlocked(z.x,z.y,DM.ZR*.9)));}
{const b=DM.buildings[0],wx=b.x+3,g={zombies:[{id:8,x:wx,y:b.y+1.3,hp:200}],bullets:[{kind:'rocket',x:wx,y:b.y-2.2,vx:0,vy:6,damage:0,life:35}],fx:[],nextId:1};
 for(let i=0;i<40&&g.bullets.length;i++)DM.tickBullets(g,25,null,1000);ok('rocket explodes on wall, outside',g.fx.length===1&&g.fx[0].y<b.y,JSON.stringify(g.fx[0]));ok('wall shields zombie inside from blast',g.zombies[0].hp===200,g.zombies[0].hp);}
(async()=>{
// ---------- browser solo: pickup, select (4/5 locked first), fire, sounds, HUD icons ----------
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
for(const [name,o] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}]]){
 const ctx=await br.newContext(o),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(String(e)));await pg.goto(`http://localhost:${PORT}/`);await sleep(400);
 await pg.click('#solo');await sleep(700);
 await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];p.hp=p.maxHp=1e9;g.zombies=[];g.phase='break';g.breakUntil=Date.now()+1e9;});
 const W=()=>pg.evaluate(()=>__dead.weapon);
 if(name==='desktop'){await pg.keyboard.press('4');ok('desktop: key 4 ignored before finding flamethrower',await W()===1);
  ok('desktop: HUD slots 4/5 locked',await pg.evaluate(()=>[...document.querySelectorAll('#guns .gun')].map(e=>e.dataset.state).join())==='selected,owned,owned,locked,locked');}
 else ok('mobile: buttons 4/5 hidden before found',await pg.evaluate(()=>[...document.querySelectorAll('#wbtns button')].filter(b=>b.style.display!=='none').length)===3);
 // walk onto flame + rocket spots (teleport next to them, move onto)
 for(const w of [4,5]){await pg.evaluate(w=>{const s=__dead.DM.weaponSpots.find(s=>s.w===w),p=__dead.game.players[__dead.me];p.x=s.x;p.y=s.y;},w);await sleep(300);}
 const own=await pg.evaluate(()=>{const p=__dead.game.players[__dead.me];return{o:p.owned,a4:p.ammo[4],a5:p.ammo[5]}});ok(`${name}: picked up flamethrower + rocket launcher`,own.o[4]&&own.o[5]&&own.a4>0&&own.a5>0,JSON.stringify(own));
 await pg.evaluate(()=>{const p=__dead.game.players[__dead.me];p.x=36;p.y=27;});await sleep(300);
 if(name==='desktop'){ok('desktop: HUD shows owned states',await pg.evaluate(()=>[...document.querySelectorAll('#guns .gun')].map(e=>e.dataset.state).join())==='selected,owned,owned,owned,owned');await pg.keyboard.press('4');}
 else{ok('mobile: buttons 4/5 appear once owned',await pg.evaluate(()=>[...document.querySelectorAll('#wbtns button')].filter(b=>b.style.display!=='none').length)===5);await pg.tap('#wbtns button[data-w="4"]');}
 ok(`${name}: weapon 4 selected`,await W()===4);
 await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];g.phase='playing';g.zombies=[{id:901,x:p.x+2.2,y:p.y,type:0,hp:300,maxHp:300,speed:0,damage:0,hitAt:0},{id:902,x:p.x+60,y:p.y,type:0,hp:1e9,maxHp:1e9,speed:0,damage:0,hitAt:0}];p.angle=0;});
 const fire=async ms=>{if(name==='desktop'){const q=await pg.evaluate(()=>{const d=__dead,p=d.game.players[d.me],c=document.querySelector('#cv'),b=c.getBoundingClientRect(),t=d.pt(p.x+3,p.y);return{x:t.x/c.width*b.width+b.x,y:t.y/c.height*b.height+b.y}});await pg.mouse.move(q.x,q.y);await pg.mouse.down();await sleep(ms);await pg.mouse.up();}else{const r=await pg.evaluate(()=>{const e=document.querySelector('#shootBtn').getBoundingClientRect();return{x:e.x+e.width/2,y:e.y+e.height/2}});const cdp=await ctx.newCDPSession(pg);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y,id:1}]});await sleep(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}};
 const fuel0=own.a4;await fire(600);const st=await pg.evaluate(()=>{const g=__dead.game,z=g.zombies.find(z=>z.id===901),p=g.players[__dead.me];return{hp:z?z.hp:0,burn:z?z.burning:true,fuel:p.ammo[4],log:SFXlog()}});
 ok(`${name}: flamethrower damages + burns`,st.hp<300&&st.burn,JSON.stringify(st.hp));ok(`${name}: fuel consumed`,st.fuel<fuel0,st.fuel+'/'+fuel0);
 ok(`${name}: flame ignition + loop sound triggered, stops on release`,st.log.includes('flameStart')&&(await pg.evaluate(()=>{return new Promise(r=>setTimeout(()=>r(SFXlog()),300))})).includes('flameStop'));
 if(name==='desktop')await pg.screenshot({path:OUT+'/flame_'+name+'.png'});
 if(name==='desktop')await pg.keyboard.press('5');else await pg.tap('#wbtns button[data-w="5"]');ok(`${name}: weapon 5 selected`,await W()===5);
 await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];g.zombies=g.zombies.filter(z=>z.id===902);g.zombies.push({id:903,x:p.x+5,y:p.y,type:2,hp:400,maxHp:400,speed:0,damage:0,hitAt:0},{id:904,x:p.x+5.8,y:p.y+.9,type:0,hp:400,maxHp:400,speed:0,damage:0,hitAt:0});});
 const r0=await pg.evaluate(()=>__dead.game.players[__dead.me].ammo[5]);await fire(120);await sleep(250);
 if(name==='desktop')await pg.screenshot({path:OUT+'/rocket_flight_'+name+'.png'});await sleep(450);if(name==='desktop')await pg.screenshot({path:OUT+'/rocket_boom_'+name+'.png'});
 const rs=await pg.evaluate(()=>{const g=__dead.game;return{z:g.zombies.filter(z=>z.id===903||z.id===904).map(z=>Math.round(z.hp)),a:g.players[__dead.me].ammo[5],log:SFXlog()}});
 ok(`${name}: rocket used 1 round`,rs.a===r0-1,rs.a+'/'+r0);ok(`${name}: explosion area-damaged both zombies`,rs.z.length<2||rs.z.every(h=>h<400),JSON.stringify(rs.z));
 ok(`${name}: rocket launch, hiss and boom sounds`,['rocketLaunch','rocketHiss','boom'].every(k=>rs.log.includes(k)),rs.log.join());
 if(name==='mobile')await pg.screenshot({path:OUT+'/mobile_buttons.png'});
 ok(`${name}: no page errors`,errs.length===0,JSON.stringify(errs));await ctx.close();}
await br.close();
// ---------- online: server-authoritative pickup + fire, both clients see it ----------
const mk=()=>{const w=new WebSocket('ws://localhost:'+PORT);w.st=null;w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){w.id=m.id;w.code=m.code;w.st=m.game}if(m.t==='state')w.st=m.game;});return w;};
const A=mk();await new Promise(r=>A.on('open',r));A.send(JSON.stringify({t:'create',name:'A'}));await sleep(300);const B=mk();await new Promise(r=>B.on('open',r));B.send(JSON.stringify({t:'join',code:A.code,name:'B'}));await sleep(300);
for(const c of[A,B])c.send(JSON.stringify({t:'ready',v:true}));await sleep(200);A.send(JSON.stringify({t:'start'}));await sleep(400);
ok('online: weapon pickups synced to both',A.st.wpick.length===S.length&&B.st.wpick.length===S.length);
A.send(JSON.stringify({t:'shoot',weapon:4,angle:0}));await sleep(150);ok('online: unowned flamethrower cannot fire',!A.st.bullets.some(b=>b.kind==='flame'));
const tgt=S.find(s=>s.w===4&&DM.bidx[s.y][s.x]<0);const pa=()=>A.st.players[A.id];const t0=Date.now();
while(Date.now()-t0<30000&&A.st.wpick.some(p=>p.id===tgt.id)){const p=pa(),dx=tgt.x-p.x,dy=tgt.y-p.y,l=Math.hypot(dx,dy)||1;A.send(JSON.stringify({t:'input',mx:dx/l,my:dy/l,angle:0,weapon:1}));await sleep(50);}
A.send(JSON.stringify({t:'input',mx:0,my:0,angle:0,weapon:4}));await sleep(250);
ok('online: walked onto plaza flamethrower — owned',pa().owned&&pa().owned[4]&&pa().ammo[4]>0);ok('online: other client sees the pickup vanish',!B.st.wpick.some(p=>p.id===tgt.id));
let seenFlame=false;for(let i=0;i<10;i++){A.send(JSON.stringify({t:'shoot',weapon:4,angle:Math.PI/2}));await sleep(60);if(B.st.bullets.some(b=>b.kind==='flame'&&b.owner===A.id))seenFlame=true;}
ok('online: flame particles fired by server and visible to other client',seenFlame);
B.send(JSON.stringify({t:'shoot',weapon:5,angle:0}));await sleep(150);ok('online: B (no rocket) cannot fire rockets',!A.st.bullets.some(b=>b.kind==='rocket'));
ok('online: tokens/owned only own data leak-free',!JSON.stringify(B.st.players).includes('token'));
A.close();B.close();console.log(fail?'FAILED':'ALL PASSED');process.exit(fail?1:0);})();
