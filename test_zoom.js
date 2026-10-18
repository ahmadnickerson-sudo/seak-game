// 2x zoom: follow camera, clamping, screen<->world aim math (desktop + mobile). PORT=4410 node test_zoom.js
const {chromium}=require('../pw/node_modules/playwright-core');const PORT=process.env.PORT||4410;const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const rep=(n,ok,d='')=>{console.log(ok?'PASS':'FAIL',n,d);if(!ok)fail++;};
(async()=>{const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const [name,o] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}]]){
 const ctx=await br.newContext(o);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));await pg.goto(`http://localhost:${PORT}/`);await sleep(400);
 await pg.evaluate(()=>document.querySelector('#solo').click());await sleep(700);
 const hold=()=>pg.evaluate(()=>{const g=__dead.game;g.zombies=[];g.phase='break';g.breakUntil=Date.now()+1e9;const p=g.players[__dead.me];p.hp=p.maxHp=1e9;});await hold();
 const info=()=>pg.evaluate(()=>{const d=__dead,p=d.game.players[d.me],q=d.pt(p.x,p.y),cv=document.querySelector('#cv');const iso=(x,y)=>({x:(x-y)*12,y:(x+y)*6});const w=cv.width,h=cv.height,minX=iso(0,46).x,maxX=iso(68,0).x;const base=Math.min(w/(maxX-minX+100),h/(46*6+100)),mob=Math.max(base,w/(15*24));return{s:d.view.scale,base,mob,w,h,qx:q.x,qy:q.y,ox:d.view.ox,oy:d.view.oy,x:p.x,y:p.y,tw:68,th:46}});
 await sleep(400);let a=await info();const old=name==='mobile'?a.mob:a.base;
 rep(`${name}: scale is 2x the old scale (${a.s.toFixed(2)} vs ${old.toFixed(2)})`,Math.abs(a.s/old-2)<.02);
 rep(`${name}: player near screen centre (follow cam)`,Math.abs(a.qx-a.w/2)<a.w*.1&&Math.abs(a.qy-a.h/2)<a.h*.2,`${a.qx.toFixed(0)},${a.qy.toFixed(0)} of ${a.w}x${a.h}`);
 // camera clamped at map corners: teleport to each corner, no blank beyond map edge
 for(const [tx,ty] of [[2,2],[66,2],[2,44],[66,44]]){await pg.evaluate(([x,y])=>{const p=__dead.game.players[__dead.me];p.x=x;p.y=y;},[tx,ty]);await sleep(1500);const b=await info();
  const left=b.ox,iso=(x,y)=>({x:(x-y)*12,y:(x+y)*6});const minX=iso(0,46).x,maxX=iso(68,0).x;const L=b.ox+minX*b.s,R=b.ox+maxX*b.s;
  rep(`${name}: corner (${tx},${ty}) camera clamped, player visible`,L<=2&&R>=b.w-2&&b.qx>0&&b.qx<b.w&&b.qy>0&&b.qy<b.h,`L${L.toFixed(0)} R${R.toFixed(0)} q ${b.qx.toFixed(0)},${b.qy.toFixed(0)}`);}
 await pg.evaluate(()=>{const p=__dead.game.players[__dead.me];p.x=33;p.y=23;});await sleep(1500);
 // screen->world: mouse at a world point => aim angle toward it (desktop); fire creates bullet in that direction
 if(name==='desktop'){const r=await pg.evaluate(()=>{const d=__dead,p=d.game.players[d.me];const tgts=[[6,0],[-6,0],[0,6],[0,-6],[4,4],[-3,5]];const cv=document.querySelector('#cv'),b=cv.getBoundingClientRect(),out=[];for(const [dx,dy] of tgts){const q=d.pt(p.x+dx,p.y+dy);out.push({dx,dy,cx:q.x/cv.width*b.width+b.x,cy:q.y/cv.height*b.height+b.y});}return out});
  for(const t of r){await pg.mouse.move(t.cx,t.cy);await sleep(150);const ang=await pg.evaluate(()=>__dead.game.players[__dead.me].angle);const want=Math.atan2(t.dy,t.dx);rep(`desktop: aim at world offset (${t.dx},${t.dy})`,Math.abs(Math.atan2(Math.sin(ang-want),Math.cos(ang-want)))<.05,`want ${want.toFixed(2)} got ${ang.toFixed(2)}`);}
  await pg.evaluate(()=>{const g=__dead.game;g.phase='playing';g.zombies.push({id:5,x:2,y:2,type:0,hp:1e9,maxHp:1e9,speed:0,damage:0,hitAt:0});});await pg.mouse.move(r[4].cx,r[4].cy);await pg.mouse.down();await sleep(60);const bl0=await pg.evaluate(()=>({n:__dead.game.bullets.length,ph:__dead.game.phase,ang:__dead.game.bullets.map(b=>Math.atan2(b.vy,b.vx))}));await pg.mouse.up();
  const bl=bl0.ang;rep('desktop: bullet fired toward mouse at 2x zoom',bl.length>0&&Math.abs(bl[0]-Math.PI/4)<.15,JSON.stringify(bl.slice(0,2)));}
 // ammo box pickup at zoom: place a box, walk onto it
 const got=await pg.evaluate(async()=>{const g=__dead.game,p=g.players[__dead.me];p.ammo[2]=5;g.pickups.push({id:77,x:p.x,y:p.y,kind:'ammo'});await new Promise(r=>setTimeout(r,400));return p.ammo[2]});rep(`${name}: ammo box pickup works`,got>=65,'ammo '+got);
 rep(`${name}: no page errors`,errs.length===0,JSON.stringify(errs));await ctx.close();}
await br.close();process.exit(fail?1:0)})();
