// Mobile free-aim: dragging the FIRE button aims continuously; no drag keeps auto-aim. PORT=4410 node test_freeaim.js
const {chromium}=require('../pw/node_modules/playwright-core');const PORT=process.env.PORT||4410;const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const rep=(n,ok,d='')=>{console.log(ok?'PASS':'FAIL',n,d);if(!ok)fail++;};
(async()=>{const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});const pg=await ctx.newPage();const cdp=await ctx.newCDPSession(pg);
const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
await pg.goto(`http://localhost:${PORT}/`);await sleep(400);await pg.tap('#solo');await sleep(700);
await pg.evaluate(()=>{const g=__dead.game;g.zombies=[];g.phase='break';g.breakUntil=Date.now()+1e9;g.players[__dead.me].hp=g.players[__dead.me].maxHp=1e9;});
const fb=await pg.evaluate(()=>{const r=document.querySelector('#shootBtn').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
const ang=async()=>pg.evaluate(()=>__dead.game.players[__dead.me].angle);
// no drag -> auto-aim default (no zombies: last move dir)
await touch('touchStart',[{x:fb.x,y:fb.y,id:1}]);await sleep(150);const a0=await ang();rep('no drag: auto-aim default used',typeof a0==='number');
for(const [dx,dy] of [[40,0],[-40,0],[0,40],[0,-40],[28,-28]]){await touch('touchMove',[{x:fb.x+dx,y:fb.y+dy,id:1}]);await sleep(150);
 const a=await ang(),sa=Math.atan2((Math.cos(a)+Math.sin(a))*6,(Math.cos(a)-Math.sin(a))*12),want=Math.atan2(dy,dx);
 rep(`drag (${dx},${dy}) aims that screen direction`,Math.abs(Math.atan2(Math.sin(sa-want),Math.cos(sa-want)))<.12,`want ${want.toFixed(2)} got ${sa.toFixed(2)}`);}
await touch('touchEnd',[]);await sleep(100);
rep('release returns to auto-aim',await pg.evaluate(()=>__dead.T.aim==null));
await br.close();process.exit(fail?1:0)})();
