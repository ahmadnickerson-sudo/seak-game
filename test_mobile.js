// Mobile/touch + desktop regression test (Playwright-core + system Chrome). PORT=4392 node test_mobile.js (server must be running)
const {chromium}=require('../pw/node_modules/playwright-core');const WebSocket=require('./node_modules/ws');
const PORT=process.env.PORT||4392,URL=`http://localhost:${PORT}/`,OUT='/workspace/seak/zombie/shots2';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const rep=(n,ok,d='')=>{console.log(ok?'PASS':'FAIL',n,d);if(!ok)fail++;};
(async()=>{
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const mk=async(opts)=>{const ctx=await br.newContext(opts);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.errs=errs;return{ctx,pg};};
const MOB={viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'};
// ---------- MOBILE SOLO ----------
{const {ctx,pg}=await mk(MOB);const cdp=await ctx.newCDPSession(pg);
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 const center=async sel=>pg.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},sel);
 await pg.goto(URL);await sleep(500);await pg.screenshot({path:OUT+'/m01_menu.png'});
 await pg.tap('#solo');await sleep(800);
 const vis=await pg.evaluate(()=>({touch:getComputedStyle(document.querySelector('#touch')).display,side:getComputedStyle(document.querySelector('#side')).display,ta:getComputedStyle(document.querySelector('#game')).touchAction,meta:document.querySelector('meta[name=viewport]').content,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));
 rep('mobile: touch controls shown',vis.touch==='block',JSON.stringify(vis));
 rep('mobile: side panel hidden so the map gets the screen',vis.side==='none');
 rep('mobile: touch-action none + no-zoom viewport',vis.ta==='none'&&/user-scalable=no/.test(vis.meta)&&/maximum-scale=1/.test(vis.meta));
 rep('mobile: page does not overflow/scroll',vis.sw<=vis.cw&&vis.sh<=vis.ch);
 // zoom
 const z=await pg.evaluate(()=>{const v=__dead.view,cv=document.querySelector('#cv');return{scale:v.scale,w:cv.width,base:Math.min(cv.width/((68+46)*12+100),cv.height/(46*6+100))}});
 rep(`mobile: zoomed in vs full-map fit (scale ${z.scale.toFixed(2)} vs ${z.base.toFixed(2)}, x${(z.scale/z.base).toFixed(1)})`,z.scale>z.base*2);
 const tilesVisible=z.w/(z.scale*24);rep(`mobile: ~${tilesVisible.toFixed(0)} tiles across the screen`,tilesVisible<=18);
 await pg.evaluate(()=>{const g=__dead.game;const p=g.players[__dead.me];p.hp=p.maxHp=1e9;});
 await pg.screenshot({path:OUT+'/m02_solo_start.png'});
 // D-pad: RIGHT moves player to the right on screen, with camera following
 const scr=()=>pg.evaluate(()=>{const p=__dead.game.players[__dead.me],q=__dead.pt(p.x,p.y),cv=document.querySelector('#cv'),r=cv.getBoundingClientRect();return{wx:p.x,wy:p.y,sx:q.x/cv.width*r.width,sy:q.y/cv.height*r.height,w:r.width,h:r.height,ox:__dead.view.ox}});
 const a=await scr();const dR=await center('#dpad .r');
 await touch('touchStart',[{x:dR.x,y:dR.y,id:1}]);await sleep(900);await touch('touchEnd',[]);await sleep(200);const b=await scr();
 rep('D-pad RIGHT moves player (world dx>0, dy<0 = screen right)',b.wx>a.wx+1&&b.wy<a.wy-1,`${a.wx.toFixed(1)},${a.wy.toFixed(1)} -> ${b.wx.toFixed(1)},${b.wy.toFixed(1)}`);
 rep('camera follows: player stays near screen centre horizontally',Math.abs(b.sx-b.w/2)<b.w*.2,`sx ${b.sx.toFixed(0)}/${b.w}`);
 rep('camera moved with the player (view offset changed)',Math.abs(b.ox-a.ox)>20);
 for(const [k,t] of [['u','up: world -x,-y'],['d','down: +x,+y'],['l','left: -x,+y']]){const s0=await scr();const c=await center('#dpad .'+k);await touch('touchStart',[{x:c.x,y:c.y,id:1}]);await sleep(500);await touch('touchEnd',[]);await sleep(150);const s1=await scr();
  const dx=s1.wx-s0.wx,dy=s1.wy-s0.wy;const okk=k==='u'?dx<-.5&&dy<-.5:k==='d'?dx>.5&&dy>.5:dx<-.5&&dy>.5;rep('D-pad '+t,okk,`d=${dx.toFixed(1)},${dy.toFixed(1)}`);}
 // wait for first wave
 for(let i=0;i<20;i++){if(await pg.evaluate(()=>__dead.game.zombies.length>0&&__dead.game.phase==='playing'))break;await sleep(500);}
 // weapon buttons
 const w2=await center('#wbtns button[data-w="2"]');await touch('touchStart',[{x:w2.x,y:w2.y,id:1}]);await touch('touchEnd',[]);await sleep(150);
 rep('weapon button 2 selects machine gun',await pg.evaluate(()=>__dead.weapon===2));
 // MULTI-TOUCH: hold D-pad right + FIRE together; auto-aim at nearest zombie
 const fb=await center('#shootBtn'),dR2=await center('#dpad .r');
 const s0=await scr();const ammo0=await pg.evaluate(()=>__dead.game.players[__dead.me].ammo[2]);
 await touch('touchStart',[{x:dR2.x,y:dR2.y,id:1},{x:fb.x,y:fb.y,id:2}]);await sleep(700);
 const mid=await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];let best=null,bd=1e9;for(const z of g.zombies){const d=Math.hypot(z.x-p.x,z.y-p.y);if(d<bd){bd=d;best=z}}return{ang:p.angle,want:best?Math.atan2(best.y-p.y,best.x-p.x):null,bullets:g.bullets.length,ammo:p.ammo[2],x:p.x,y:p.y,fireOn:__dead.T.fire,vx:__dead.T.vx}});
 await pg.screenshot({path:OUT+'/m03_solo_move_and_shoot.png'});
 await touch('touchEnd',[]);await sleep(200);
 rep('multi-touch: moving AND firing at once (solo)',mid.fireOn&&mid.vx!==0&&mid.ammo<ammo0&&Math.hypot(mid.x-s0.wx,mid.y-s0.wy)>.8,`ammo ${ammo0}->${mid.ammo}, moved ${Math.hypot(mid.x-s0.wx,mid.y-s0.wy).toFixed(1)}`);
 rep('FIRE auto-aims at nearest zombie',mid.want!=null&&Math.abs(Math.atan2(Math.sin(mid.ang-mid.want),Math.cos(mid.ang-mid.want)))<.25,`ang ${mid.ang.toFixed(2)} want ${mid.want&&mid.want.toFixed(2)}`);
 rep('releasing touches stops move + fire',await pg.evaluate(()=>!__dead.T.fire&&__dead.T.vx===0&&__dead.T.vy===0));
 // no zombies -> aims along last move direction
 await pg.evaluate(()=>{const g=__dead.game;g.zombies=[];g.phase='playing';});
 const dL=await center('#dpad .l');await touch('touchStart',[{x:dL.x,y:dL.y,id:1}]);await sleep(120);
 const ang=await pg.evaluate(()=>__dead.game.players[__dead.me].angle);await touch('touchEnd',[]);
 rep('no zombie: aim = last move direction (left = world -x,+y)',Math.abs(Math.atan2(Math.sin(ang-Math.atan2(1,-1)),Math.cos(ang-Math.atan2(1,-1))))<.3,ang.toFixed(2));
 // no scroll / zoom on touch drags
 await touch('touchStart',[{x:200,y:300,id:1}]);await touch('touchMove',[{x:200,y:100,id:1}]);await touch('touchEnd',[]);
 rep('swipe on stage does not scroll the page',await pg.evaluate(()=>scrollY===0&&scrollX===0&&visualViewport.scale===1));
 rep('mobile solo: no page errors',pg.errs.length===0,JSON.stringify(pg.errs));
 await ctx.close();}
// ---------- MOBILE ONLINE (page = Alice via touch, node ws = Bob observer) ----------
{const {ctx,pg}=await mk(MOB);const cdp=await ctx.newCDPSession(pg);const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 const center=async sel=>pg.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},sel);
 await pg.goto(URL);await sleep(400);await pg.fill('#name','Phone');await pg.tap('#create');await sleep(1200);
 const code=await pg.evaluate(()=>document.querySelector('#room').textContent.replace('ROOM ',''));
 const B={st:null,id:null};const w=new WebSocket('ws://localhost:'+PORT);w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){B.id=m.id;B.st=m.game}if(m.t==='state')B.st=m.game;});await new Promise(r=>w.on('open',r));w.send(JSON.stringify({t:'join',code,name:'Bob'}));await sleep(500);
 rep('online: touch controls shown after joining a room',await pg.evaluate(()=>getComputedStyle(document.querySelector('#touch')).display==='block'));
 for(let i=0;i<30&&!(B.st.phase==='playing'&&B.st.zombies.length);i++)await sleep(300);
 const me=await pg.evaluate(()=>__dead.me);const p0=B.st.players[me];
 await pg.evaluate(()=>{});const fb=await center('#shootBtn'),dR=await center('#dpad .r'),w2=await center('#wbtns button[data-w="2"]');
 await touch('touchStart',[{x:w2.x,y:w2.y,id:3}]);await touch('touchEnd',[]);await sleep(100);
 await touch('touchStart',[{x:dR.x,y:dR.y,id:1},{x:fb.x,y:fb.y,id:2}]);
 let sawB=0,maxB=0;for(let i=0;i<14;i++){await sleep(60);maxB=Math.max(maxB,B.st.bullets.length);}await pg.screenshot({path:OUT+'/m04_online_move_and_shoot.png'});
 await touch('touchEnd',[]);await sleep(400);
 const p1=B.st.players[me];
 rep('online: server moved the touch player (D-pad)',Math.hypot(p1.x-p0.x,p1.y-p0.y)>.8,`${p0.x.toFixed(1)},${p0.y.toFixed(1)} -> ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`);
 rep('online: server fired bullets from the same touch (FIRE, machine gun)',maxB>0&&p1.ammo[2]<=p0.ammo[2],`bullets seen ${maxB}, ammo ${p1.ammo[2]}`);
 rep('online: weapon button selected machine gun on server',p1.weapon===2);
 await pg.screenshot({path:OUT+'/m05_online_after.png'});
 rep('mobile online: no page errors',pg.errs.length===0,JSON.stringify(pg.errs));w.close();await ctx.close();}
// ---------- DESKTOP regression (no touch) ----------
{const {ctx,pg}=await mk({viewport:{width:1280,height:800}});await pg.goto(URL);await sleep(400);await pg.click('#solo');await sleep(800);
 const v=await pg.evaluate(()=>({touch:getComputedStyle(document.querySelector('#touch')).display,side:getComputedStyle(document.querySelector('#side')).display,sc:__dead.view.scale,base:Math.min(document.querySelector('#cv').width/((68+46)*12+100),document.querySelector('#cv').height/(46*6+100)),T:__dead.T.on}));
 rep('desktop: no touch overlay, side panel shown, touch aim off',v.touch==='none'&&v.side!=='none'&&!v.T,JSON.stringify(v));
 rep('desktop: follow camera at 2x the old whole-map fit',Math.abs(v.sc/v.base-2)<.02,`${v.sc.toFixed(3)} vs ${v.base.toFixed(3)}`);
 const x0=await pg.evaluate(()=>__dead.game.players[__dead.me].x);await pg.keyboard.down('d');await sleep(500);await pg.keyboard.up('d');const x1=await pg.evaluate(()=>__dead.game.players[__dead.me].x);
 rep('desktop: WASD still moves',x1>x0+.5,`${x0.toFixed(1)}->${x1.toFixed(1)}`);
 await pg.keyboard.press('3');rep('desktop: key 3 selects shotgun',await pg.evaluate(()=>__dead.weapon===3));
 for(let i=0;i<20;i++){if(await pg.evaluate(()=>__dead.game.zombies.length>0))break;await sleep(500);}
 await pg.mouse.move(900,300);await pg.mouse.down();await sleep(400);await pg.mouse.up();
 rep('desktop: mouse aim + click still fires',await pg.evaluate(()=>__dead.game.players[__dead.me].ammo[3]<8||__dead.game.bullets.length>0));
 await pg.screenshot({path:OUT+'/m06_desktop_unchanged.png'});rep('desktop: no page errors',pg.errs.length===0,JSON.stringify(pg.errs));await ctx.close();}
await br.close();console.log(fail?`\n${fail} FAILED`:'\nALL PASSED');process.exit(fail?1:0);})();
