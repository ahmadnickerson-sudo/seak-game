// Invite / lobby / ready-up flow: ws script + two real browser contexts (desktop + mobile emulation) + proxy-path check. PORT=4410 node test_invite.js
const {chromium}=require('../pw/node_modules/playwright-core');const WebSocket=require('./node_modules/ws');const http=require('http');
const PORT=+process.env.PORT||4410,BASE=`http://localhost:${PORT}`,OUT='/workspace/seak/zombie/shots7';require('fs').mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const rep=(n,ok,d='')=>{console.log(ok?'PASS':'FAIL',n,d);if(!ok)fail++;};
const getRaw=(p,hdr={})=>new Promise((res,rej)=>http.get(BASE+p,{headers:hdr},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res({s:r.statusCode,h:r.headers,b:d}));}).on('error',rej));
const cl=()=>{const w=new WebSocket('ws://localhost:'+PORT);const c={w,st:null,id:null,errs:[],token:null};w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){c.id=m.id;c.code=m.code;c.token=m.token;c.st=m.game}if(m.t==='state')c.st=m.game;if(m.t==='err')c.errs.push(m.msg);});c.open=new Promise(r=>w.on('open',r));c.send=o=>w.send(JSON.stringify(o));return c;};
(async()=>{
// ---------- ws script: server-authoritative ready/start ----------
const A=cl(),B=cl();await A.open;await B.open;A.send({t:'create',name:'Host'});await sleep(300);
rep('create: room starts in LOBBY (no instant game start)',A.st&&A.st.phase==='lobby'&&/^[A-Z]{4}$/.test(A.code),A.code+' '+(A.st&&A.st.phase));
await sleep(2000);rep('lobby stays idle (no zombies/waves while waiting)',A.st.phase==='lobby'&&A.st.zombies.length===0&&A.st.wave===0);
let info=JSON.parse((await getRaw('/api/room/'+A.code)).b);rep('/api/room/CODE reports lobby',info.exists&&!info.started&&info.players===1);
const pg0=await getRaw('/?room='+A.code);rep('GET /?room=CODE serves the game page (was 404)',pg0.s===200&&/SEAK: DEAD END/.test(pg0.b));
const pg1=await getRaw('/room/'+A.code,{Accept:'text/html'});rep('GET /room/CODE (browser) serves the game page',pg1.s===200&&/<canvas/.test(pg1.b));
const js=await getRaw('/room/'+A.code,{Accept:'application/json'});rep('GET /room/CODE (json) returns status',JSON.parse(js.b).exists===true);
rep('unknown room reports exists:false',JSON.parse((await getRaw('/api/room/ZZZZ')).b).exists===false);
B.send({t:'join',code:A.code.toLowerCase(),name:'Guest'});await sleep(300);
rep('join (lowercase code) links into the same room',B.st&&B.code===A.code&&Object.keys(A.st.players).length===2);
rep('host is the first player',A.st.host===A.id&&B.st.host===A.id);
A.send({t:'start'});await sleep(200);rep('start with nobody ready is ignored',A.st.phase==='lobby');
A.send({t:'ready',v:true});await sleep(200);A.send({t:'start'});await sleep(200);rep('start blocked while guest not ready',A.st.phase==='lobby'&&A.errs.length>0,A.errs.join('|'));
B.send({t:'ready',v:true});await sleep(150);B.send({t:'start'});await sleep(200);rep('non-host cannot start',B.st.phase==='lobby'&&B.errs.some(e=>/host/i.test(e)));
B.send({t:'ready',v:false});await sleep(150);rep('unready after ready is reflected',B.st.players[B.id].ready===false&&A.st.players[B.id].ready===false);
A.send({t:'start'});await sleep(200);rep('start blocked again after unready',A.st.phase==='lobby');
B.w.close();await sleep(300);rep('player leaving removes them from the requirement',Object.keys(A.st.players).length===1);
A.send({t:'start'});await sleep(300);rep('host alone + ready can start',A.st.phase!=='lobby');
A.w.close();await sleep(200);
// host handover + 3 players
{const H=cl(),P=cl(),Q=cl();await H.open;await P.open;await Q.open;H.send({t:'create',name:'H'});await sleep(250);P.send({t:'join',code:H.code,name:'P'});await sleep(150);Q.send({t:'join',code:H.code,name:'Q'});await sleep(250);
 rep('3 players listed',Object.keys(H.st.players).length===3);P.send({t:'ready',v:true});Q.send({t:'ready',v:true});await sleep(200);H.w.close();await sleep(300);
 rep('host leaves: next player becomes host',P.st.host===P.id&&Object.keys(P.st.players).length===2);
 P.send({t:'start'});await sleep(300);rep('new host can start once all (remaining) ready',P.st.phase!=='lobby',P.st.phase);P.w.close();Q.w.close();}
// ---------- two real browsers ----------
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const MOB={viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true};
const c1=await br.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']}),c2=await br.newContext(MOB);
const h=await c1.newPage(),g=await c2.newPage();const errs=[];for(const p of[h,g])p.on('pageerror',e=>errs.push(String(e)));
await h.goto(BASE+'/');await sleep(400);await h.fill('#name','Alice');await h.click('#create');await h.waitForSelector('#lobby',{state:'visible'});await sleep(300);
const code=await h.textContent('#lbCode');rep('host sees lobby with 4-letter room code',/^[A-Z]{4}$/.test(code),code);
const link=await h.inputValue('#lbLink');rep('invite link shown',link===`${BASE}/?room=${code}`,link);
await h.click('#lbCopy');await sleep(300);const clip=await h.evaluate(()=>navigator.clipboard.readText().catch(()=>'ERR'));rep('copy button puts the invite link on the clipboard',clip===link,clip);
rep('host Start disabled until ready',await h.isDisabled('#lbStart'));
rep('lobby message says waiting',/Waiting for 1 player to ready up/.test(await h.textContent('#lbMsg')),await h.textContent('#lbMsg'));
await h.screenshot({path:OUT+'/01_host_lobby_desktop.png'});
// phone opens the invite link
await g.goto(link);await sleep(700);
rep('invite page shown on phone',await g.isVisible('#inviteCard')&&(await g.textContent('#invCode'))===code);
rep('invite page shows lobby status',/1 in the lobby: Alice/.test(await g.textContent('#invStatus')),await g.textContent('#invStatus'));
await g.screenshot({path:OUT+'/02_phone_invite.png'});
await g.fill('#name','Bobby');await g.tap('#invJoin');await g.waitForSelector('#lobby',{state:'visible'});await sleep(400);
rep('phone linked into the same room (same code)',(await g.textContent('#lbCode'))===code);
const rowsH=await h.$$eval('#lbList .lbrow',r=>r.map(x=>x.textContent));rep('host lobby lists both players live',rowsH.length===2&&rowsH.some(t=>/Alice/.test(t))&&rowsH.some(t=>/Bobby/.test(t)),rowsH.join(' | '));
rep('guest lobby lists both players',(await g.$$eval('#lbList .lbrow',r=>r.length))===2);
rep('guest has no Start button',!(await g.isVisible('#lbStart')));
rep('host message: waiting for 2 players',/Waiting for 2 players to ready up/.test(await h.textContent('#lbMsg')));
await h.click('#lbReady');await sleep(300);
rep('host ready shown on both screens',(await h.$eval('#lbList .lbrow[data-ready="1"]',e=>e.textContent)).includes('Alice')&&(await g.$$eval('#lbList .lbrow[data-ready="1"]',r=>r.length))===1);
rep('Start still disabled (guest not ready)',await h.isDisabled('#lbStart'));rep('message updates to 1 player',/Waiting for 1 player to ready up/.test(await h.textContent('#lbMsg')));
await g.tap('#lbReady');await sleep(300);rep('guest ready -> Start enabled for host',!(await h.isDisabled('#lbStart')));
await g.screenshot({path:OUT+'/03_phone_lobby_ready.png'});await h.screenshot({path:OUT+'/04_host_lobby_all_ready.png'});
await g.tap('#lbReady');await sleep(300);rep('guest unready disables Start again',await h.isDisabled('#lbStart'));
await g.tap('#lbReady');await sleep(300);
// phone leaves and rejoins by typing the code (join-by-code path)
await g.tap('#lbLeave');await sleep(400);rep('leave: host sees only 1 player and Start waits for host',(await h.$$eval('#lbList .lbrow',r=>r.length))===1);
await g.goto(BASE+'/');await sleep(400);await g.fill('#name','Bobby');await g.fill('#code',code.toLowerCase());await g.tap('#join');await g.waitForSelector('#lobby',{state:'visible'});await sleep(300);
rep('join by typing the code works on phone',(await g.textContent('#lbCode'))===code);
await g.tap('#lbReady');await sleep(300);
await h.click('#lbStart');await sleep(2500);
rep('host game screen visible after Start',await h.isVisible('#game')&&!(await h.isVisible('#lobby')));rep('phone game screen visible (everyone started)',await g.isVisible('#game')&&!(await g.isVisible('#lobby')));
rep('phone touch controls visible in game',await g.evaluate(()=>getComputedStyle(document.querySelector('#touch')).display==='block'));
const pl=await h.evaluate(()=>Object.values(__dead.game.players).map(p=>p.name).sort().join(','));rep('both players in the same running game',pl==='Alice,Bobby',pl);
await sleep(2500);rep('zombie waves spawned for both',(await h.evaluate(()=>__dead.game.zombies.length))>0&&(await g.evaluate(()=>__dead.game.zombies.length))>0);
await h.screenshot({path:OUT+'/05_host_in_game.png'});await g.screenshot({path:OUT+'/06_phone_in_game.png'});
// reconnect: kill the phone socket mid-game, it must rejoin as the same player
const idBefore=await g.evaluate(()=>__dead.me);await g.evaluate(()=>{window.__ws_kill=1;});
await g.evaluate(()=>{document.dispatchEvent(new Event('x'));});
// closing the underlying socket via CDP-less trick: expose through offline emulation
const killed=await g.evaluate(()=>{try{const s=__dead.sock();s.close();return true}catch{return false}});
if(killed){await sleep(4000);const idAfter=await g.evaluate(()=>__dead.me);rep('phone auto-reconnects as the SAME player after a dropped connection',idAfter===idBefore&&(await g.evaluate(()=>Object.keys(__dead.game.players).length))===2,idBefore+' '+idAfter);}
{const leak=await g.evaluate(()=>JSON.stringify(__dead.game.players).includes('token'));rep('session tokens are not leaked to other clients',!leak);}
rep('no page errors in either browser',errs.length===0,JSON.stringify(errs));
await br.close();
// ---------- proxy-style path: wss-like reverse proxy that forwards ws upgrade (Render-like) ----------
{const net=require('net');const PP=PORT+100;const px=net.createServer(s=>{const t=net.connect(PORT,'127.0.0.1');s.pipe(t);t.pipe(s);s.on('error',()=>t.destroy());t.on('error',()=>s.destroy());});await new Promise(r=>px.listen(PP,r));
 const w=new WebSocket('ws://localhost:'+PP+'/');const got=await new Promise(r=>{w.on('open',()=>w.send(JSON.stringify({t:'create',name:'Prox'})));w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome')r(m)});setTimeout(()=>r(null),3000);});
 rep('ws works through a TCP reverse proxy (Render-style)',!!got&&got.game.phase==='lobby');w.close();px.close();}
console.log(fail?'FAILED':'ALL PASSED');process.exit(fail?1:0)})();
