// Sound system: weapon shots, click, pickups, zombie hit/death/groan, hurt, wave, game over, mute (M + HUD, localStorage), remote shots w/ distance+pan. PORT=4420 node test_sound.js
const {chromium}=require('../pw/node_modules/playwright-core'),WebSocket=require('./node_modules/ws');const devices={'iPhone 13':{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'}};const PORT=+process.env.PORT||4420;let fails=0;
const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+x));if(!c)fails++;};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 for(const [name,o] of [['desktop',{viewport:{width:1280,height:800}}],['mobile',{...devices['iPhone 13']}]]){
  const ctx=await br.newContext(o),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(String(e)));await pg.goto(`http://localhost:${PORT}/`);await sleep(300);
  if(name==='desktop')ok('hint line lists all 5 weapons',await pg.evaluate(()=>/1 pistol · 2 machine gun · 3 shotgun · 4 flamethrower · 5 rocket launcher/.test([...document.querySelectorAll('.hint')].map(e=>e.textContent).join('|'))));
  await pg.click('#solo');await sleep(600);
  await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];p.hp=p.maxHp=1e9;p.x=36;p.y=27;g.zombies=[{id:902,x:p.x+60,y:p.y,type:0,hp:1e9,maxHp:1e9,speed:0,damage:0,hitAt:0}];g.phase='playing';g.breakUntil=0;});
  const L=()=>pg.evaluate(()=>SFXlog().join(' '));const has=async(re)=>{for(let i=0;i<15;i++){if(re.test(await L()))return true;await sleep(100);}return false;};
  if(name==='desktop'){for(const [k,s] of [['1','pistol'],['2','mg'],['3','shotgun']]){await pg.keyboard.press(k);await pg.mouse.move(900,400);await pg.mouse.down();await sleep(80);await pg.mouse.up();await sleep(500);ok(`${s} sound`,await has(new RegExp(s+'@')));}
   ok('shotgun pump rack',await has(/pump@/));
   await pg.evaluate(()=>{__dead.game.players[__dead.me].ammo[2]=0;});await pg.keyboard.press('2');await pg.mouse.down();await sleep(80);await pg.mouse.up();ok('empty click',await has(/click@/));}
  else{await pg.tap('#shootBtn');ok('mobile pistol sound',await has(/pistol@/));}
  await pg.evaluate(()=>{const g=__dead.game,p=g.players[__dead.me];g.zombies=[{id:801,x:p.x+3,y:p.y,type:0,hp:100,maxHp:100,speed:0,damage:0,hitAt:0}];});await sleep(200);
  await pg.evaluate(()=>{__dead.game.zombies[0].hp=60;});ok('zombie hit',await has(/zhit@/));
  await pg.evaluate(()=>{__dead.game.zombies=[];});ok('zombie death',await has(/zdeath@/));
  await pg.evaluate(()=>{const g=__dead.game;for(let i=0;i<6;i++)g.zombies.push({id:810+i,x:g.players[__dead.me].x+4+i,y:g.players[__dead.me].y+1,type:i%3,hp:1e9,maxHp:1e9,speed:0,damage:0,hitAt:0});});
  ok('zombie groans (distance volume)',await (async()=>{for(let i=0;i<60;i++){const m=(await L()).match(/groan@([\d.]+)/);if(m)return +m[1]<1;await sleep(100);}return false;})());
  await pg.evaluate(()=>{const p=__dead.game.players[__dead.me];p.hp-=10;});ok('player hurt',await has(/hurt@/));
  await pg.evaluate(()=>{const s=__dead.DM.ammoSpots?null:null;const p=__dead.game.players[__dead.me];p.pickAt=Date.now();p.pickMsg='+AMMO';});ok('ammo pickup sound',await has(/reload@/));
  await pg.evaluate(()=>{const p=__dead.game.players[__dead.me];p.pickAt=Date.now()+5;p.pickMsg='FLAMETHROWER FOUND';});ok('weapon pickup sound',await has(/wpickup@/));
  await pg.evaluate(()=>{__dead.game.wave++;});ok('wave sting',await has(/wave@/));
  if(name==='desktop'){await pg.keyboard.press('m');ok('M mutes + saved',await pg.evaluate(()=>localStorage.getItem('deadVol')==='0'&&/MUTED/.test(document.querySelector('#muteBtn').textContent)));
   await pg.reload();await sleep(300);ok('mute persists after reload',await pg.evaluate(()=>/MUTED/.test(document.querySelector('#muteBtn').textContent)));
   await pg.click('#solo');await sleep(400);await pg.click('#muteBtn');ok('HUD button cycles volume',await pg.evaluate(()=>localStorage.getItem('deadVol')==='1'));
   await pg.evaluate(()=>{const g=__dead.game;g.players[__dead.me].hp=0;});ok('game over sound',await (async()=>{for(let i=0;i<40;i++){if(/gameover@/.test(await L()))return true;await sleep(100);}return false;})());}
  else{const b=await pg.evaluate(()=>{const e=document.querySelector('#muteBtn').getBoundingClientRect();return e.width>0&&e.height>0;});ok('mobile mute button visible',b);await pg.tap('#muteBtn');ok('mobile tap cycles volume',await pg.evaluate(()=>localStorage.getItem('deadVol')==='0.5'));
   await pg.screenshot({path:'/workspace/seak/zombie/shot_sound_mobile.png'});}
  ok(name+': no page errors',errs.length===0,errs.join('|'));await ctx.close();}
 // online: remote player's shot heard with distance vol + pan
 const ctx=await br.newContext({viewport:{width:1280,height:800}}),pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(String(e)));await pg.goto(`http://localhost:${PORT}/`);await sleep(300);
 await pg.fill('#name','Host').catch(()=>{});await pg.click('#create');await pg.waitForSelector('#lobby',{state:'visible'});await sleep(300);const code=(await pg.textContent('#lbCode')).trim();
 const w=new WebSocket('ws://localhost:'+PORT);let wid=null;w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome')wid=m.id;});await new Promise(r=>w.on('open',r));w.send(JSON.stringify({t:'join',code:String(code).trim(),name:'Bot'}));await sleep(500);
 w.send(JSON.stringify({t:'ready',v:true}));await pg.click('#lbReady');await sleep(400);await pg.click('#lbStart');await sleep(800);
 for(let i=0;i<4;i++){w.send(JSON.stringify({t:'shoot',angle:1.0,weapon:1}));await sleep(450);}
 const lg=await pg.evaluate(()=>SFXlog().join(' '));const m=lg.match(/pistol@([\d.]+),(-?[\d.]+)/);
 ok('online: remote pistol shot heard',!!m,lg.slice(-300));if(m)ok('online: remote shot attenuated by distance',+m[1]<=.8,m[0]);
 ok('online: no page errors',errs.length===0,errs.join('|'));w.close();await br.close();console.log(fails?`${fails} FAILED`:'ALL PASS');process.exit(fails?1:0);})();
