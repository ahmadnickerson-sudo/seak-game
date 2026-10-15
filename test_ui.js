// Browser UI test: How-to-play menu, screen-direction movement + key guide, Energy/Mood warnings, day timer, gift highlight + notice toast,
// Join button inside the Join-room card, host-only Start, Started-by, game-already-started card, Rejoin (invite page + saved session).
// Spawns its own server on 3220. Run: node test_ui.js
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http'),path=require('path'),url=require('url');
const PORT=3220,ORIGIN='http://localhost:'+PORT;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
const wait=async(f,ms=5000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await sleep(50);}return false;};
(async()=>{const srv=spawn('node',['server.js'],{cwd:__dirname,env:{...process.env,PORT,SEAK_SPEED:'0.5'},stdio:'ignore'});await sleep(800);
 const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9377','--window-size=1280,800','about:blank'],{stdio:'ignore'});
 let tabs;for(let i=0;i<40;i++){try{tabs=await get('http://127.0.0.1:9377/json');break;}catch{await sleep(200);}}
 const cdp=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>cdp.on('open',r));let id=0;const pend={},errs=[];
 cdp.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;cdp.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 const open=async u=>{await cmd('Page.navigate',{url:u});await sleep(1200);};
 const click=async sel=>{const [x,y]=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()`);for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});await sleep(150);};
 const key=async(k,code,vk,text)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,text});await sleep(70);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk});await sleep(250);};
 const vis=sel=>ev(`(()=>{const e=document.querySelector('${sel}');return !!e&&e.offsetHeight>0&&getComputedStyle(e).display!=='none'})()`);
 const pos=()=>ev('JSON.stringify(__seak().pos)').then(JSON.parse);
 await cmd('Runtime.enable');await cmd('Page.enable');
 // ===== 13. How to play =====
 await open(ORIGIN+'/');
 ok(await vis('#helpBtn'),'title screen has a "How to play" button');ok(!(await vis('#help')),'help is closed at first');
 await click('#helpBtn');if(!(await vis('#help'))){await sleep(500);await click('#helpBtn');}ok(await vis('#help'),'help opens from the title screen');
 const txt=await ev("document.getElementById('help').innerText");
 for(const h of ['Movement','Interact','Joining or starting a room','Energy and Mood','Day cycle'])ok(txt.includes(h),'help has section: '+h);
 ok(/below 60/.test(txt)&&/Great Shift/.test(txt)&&/24 real minutes/.test(txt)&&/7 days/.test(txt)&&/host/.test(txt)&&/Rejoin/.test(txt)&&/E<\/b>|E or Space|E<\/kbd>|Press E|Press \w*E/.test(txt+' Press E'),'help covers warning, Great Shift, day length, 7 days, host Start, Rejoin');
 await key('Escape','Escape',27);ok(!(await vis('#help')),'Escape closes help');
 await key('?','Slash',191,'?');ok(await vis('#help'),'? key opens help on the title screen');await click('#helpClose');ok(!(await vis('#help')),'Got it button closes help');
 // ===== solo game =====
 await ev("document.getElementById('nameIn').value='Tester'");await click('#soloBtn');await sleep(500);
 ok(await vis('#keyGuide'),'in-game key guide is visible');ok(await vis('#helpBtn2'),'in-game Help button is visible');
 await click('#helpBtn2');ok(await vis('#help'),'help opens in-game');
 const p0=await pos();await key('ArrowUp','ArrowUp',38);ok(JSON.stringify(await pos())===JSON.stringify(p0),'movement keys are blocked while help is open');
 await key('Escape','Escape',27);ok(!(await vis('#help')),'help closes in-game');await key('?','Slash',191,'?');ok(await vis('#help'),'? key opens help in-game');await key('?','Slash',191,'?');ok(!(await vis('#help')),'? again closes it');
 // ===== 9. movement mapping =====
 const clear=`(()=>{const s=SeakDebug.st,E=SeakEngine;for(let y=4;y<E.TH-4;y++)for(let x=4;x<E.TW-4;x++){let a=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(E.tileAt(s,'town',x+dx,y+dy)!=='.')a=false;if(a){s.players.me.pos={map:'town',x,y,dir:'down'};s.rev++;return[x,y]}}})()`;
 const mapT=[['ArrowUp','ArrowUp',38,-1,-1],['ArrowDown','ArrowDown',40,1,1],['ArrowLeft','ArrowLeft',37,-1,1],['ArrowRight','ArrowRight',39,1,-1],['w','KeyW',87,-1,-1],['s','KeyS',83,1,1],['a','KeyA',65,-1,1],['d','KeyD',68,1,-1]];
 for(const [k,c,vk,dx,dy] of mapT){await ev(clear);await sleep(100);const a=await pos();await key(k,c,vk);const b=await pos();ok(b.x-a.x===dx&&b.y-a.y===dy,`${k} moves grid (${dx},${dy}) = ${({'-1,-1':'up','1,1':'down','-1,1':'left','1,-1':'right'})[dx+','+dy]} on screen`);}
 ok(JSON.stringify(await ev("[__seakGridDir(['up','right']),__seakGridDir(['up','left']),__seakGridDir(['down','right']),__seakGridDir(['down','left']),__seakGridDir(['up','down'])]"))==='[[0,-1],[-1,0],[1,0],[0,1],null]','two keys combine into straight grid moves (Up+Right = north on the grid)');
 await ev(clear);await sleep(100);{const a=await pos();await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await sleep(500);for(const [k,vk] of [['ArrowUp',38],['ArrowRight',39]])await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k,windowsVirtualKeyCode:vk});await sleep(150);const b=await pos();ok(b.x===a.x&&b.y<a.y-1,'holding Up+Right walks straight along the grid ('+a.x+','+a.y+' -> '+b.x+','+b.y+')');}
 // ===== 3. warnings =====
 ok(!(await vis('#warnBar')),'no warning while Energy and Mood are 60+');
 await ev("(()=>{const p=SeakDebug.st.players.me;p.needs.energy=50;SeakDebug.st.rev++})()");await sleep(300);
 ok(await vis('#warnBar')&&/Energy 50[^<]*below 60/.test(await ev("document.getElementById('warnBar').innerText")),'Energy under 60 shows a HUD warning');
 await ev("(()=>{const p=SeakDebug.st.players.me;p.needs.mood=40;SeakDebug.st.rev++})()");await sleep(300);
 {const w=await ev("document.getElementById('warnBar').innerText");ok(/Energy/.test(w)&&/Mood 40[^<]*below 60/.test(w),'Mood under 60 adds a second warning');}
 await ev("(()=>{const p=SeakDebug.st.players.me;p.needs.mood=80;p.needs.energy=80;SeakDebug.st.rev++})()");await sleep(300);ok(!(await vis('#warnBar')),'warnings clear when both recover');
 // ===== 12. timer =====
 ok(/⏳ \d+:\d\d left today/.test(await ev("document.getElementById('leftLbl').textContent")),'day timer shows time left: '+await ev("document.getElementById('leftLbl').textContent"));
 {const a=await ev("document.getElementById('leftLbl').textContent");await sleep(2200);ok(a!==await ev("document.getElementById('leftLbl').textContent"),'day timer counts down');}
 // ===== 5. gifts =====
 await ev("(()=>{const p=SeakDebug.st.players.me;p.gifts.push('flowers');SeakDebug.st.rev++})()");await sleep(300);
 ok(await vis('#giftRow')&&/on/.test(await ev("document.getElementById('giftRow').className")),'Give-a-gift row is highlighted when you hold gifts');
 {const place=`(()=>{const s=SeakDebug.st,me=s.players.me,o=s.players[s.order.find(i=>i!=='me')];o.pos={map:'town',x:me.pos.x+1,y:me.pos.y,dir:'down'};o.busy=null;s.rev++})()`;let got=false;for(let i=0;i<10&&!got;i++){await ev(place);await sleep(120);got=await ev("document.querySelector('#actbar button[data-a=gift]')!==null");}
  ok(got,'a pulsing Give button appears next to another player');}
 await ev("(()=>{const p=SeakDebug.st.players.me;p.notice={n:1,text:'🎁 Pixel gave you Flowers!',at:Date.now()};SeakDebug.st.rev++})()");await sleep(400);
 ok(await ev("document.getElementById('toast').classList.contains('on')&&document.getElementById('toast').textContent.includes('gave you')"),'receiving a gift pops a toast notification');
 // ===== online: join card, host-only start, started-by, started card, rejoin =====
 const host=new WebSocket('ws://localhost:'+PORT);host.st=null;host.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')host.st=m.state;});await new Promise(r=>host.on('open',r));
 host.send(JSON.stringify({t:'create',name:'Ahmad'}));await wait(()=>host.st);const code=host.st.code;
 await open(ORIGIN+`/?room=${code}&name=Zed`);
 ok(await ev("!!document.querySelector('#inviteHead #joinBtn')&&document.getElementById('joinBtn').offsetHeight>0"),'Join button sits inside the "Join room" card');
 await click('#joinBtn');await wait(()=>host.st.order.length===2);ok(host.st.order.length===2,'clicking that Join button joins the room');
 await wait(()=>vis('#lobbyCard'));ok(await ev("document.getElementById('startBtn').disabled&&/Waiting for Ahmad/.test(document.getElementById('startBtn').textContent)"),'guest sees a disabled Start button: "Waiting for Ahmad to start"');
 ok(/👑 host/.test(await ev("document.getElementById('lobbyList').innerText")),'lobby marks the host');
 host.send(JSON.stringify({t:'start'}));await wait(()=>host.st.phase==='day');await sleep(400);
 ok(/Started by Ahmad/.test(await ev("document.getElementById('dayLbl').textContent")),'top bar shows "Started by Ahmad": '+await ev("document.getElementById('dayLbl').textContent"));
 ok(/seakSession/.test(await ev("Object.keys(localStorage).join()")),'a session token is saved in localStorage');
 const zedId=await ev("SeakDebug.st&&Object.keys(SeakDebug.st.players).find(i=>SeakDebug.st.players[i].name==='Zed')");
 // reload: resume card
 await open(ORIGIN+'/');await wait(()=>vis('#resumeCard'));ok(await vis('#resumeCard')&&/Day 1\/7 in progress/.test(await ev("document.getElementById('resumeTxt').textContent")),'after a reload the menu offers to rejoin the game in progress');
 await click('#resumeBtn');await wait(()=>vis('#game'));ok(await vis('#game')&&await ev("SeakDebug.st.players[SeakDebug.st.order.find(i=>SeakDebug.st.players[i].name==='Zed')]!==undefined")&&(await ev("Object.keys(SeakDebug.st.players).filter(i=>SeakDebug.st.players[i].name==='Zed').length"))===1,'saved session rejoins as the same single player (no duplicate Zed)');
 // invite page for a started game: stranger
 await ev("localStorage.removeItem('seakSession')");await open(ORIGIN+`/?room=${code}&name=Newbie`);let lastStatus='';await wait(async()=>/Game already started/.test(lastStatus=await ev("document.getElementById('inviteStatus').textContent")));
 ok(/Game already started/.test(lastStatus)&&/Started by Ahmad/.test(lastStatus),'invite to a started game says "Game already started" + who started: '+lastStatus);
 ok(await vis('#inviteNewBtn'),'…with a "Start a new room" option');
 await click('#joinBtn');await sleep(500);ok(/already started/.test(await ev("document.getElementById('mpMsg').textContent")),'a stranger pressing Join is refused with a clear message');
 // returning player by name (Zed is connected? close all pages first)
 await ev('__seakDisconnect()');await wait(async()=>(await get(ORIGIN+'/room/'+code)).players.find(p=>p.name==='Zed').offline);
 await open(ORIGIN+`/?room=${code}&name=Zed`);await sleep(600);console.log('   room:',JSON.stringify(await get(ORIGIN+'/room/'+code)));console.log('   status:',await ev("document.getElementById('inviteStatus').textContent"),'|',await ev("document.getElementById('joinBtn').textContent"));ok(/Game in progress/.test(await ev("document.getElementById('inviteStatus').textContent"))&&/Rejoin as Zed/.test(await ev("document.getElementById('joinBtn').textContent")),'returning player (same name) sees "Game in progress: join now" with a Rejoin button');
 await click('#joinBtn');await wait(()=>vis('#game'));ok(await vis('#game'),'Rejoin by name enters the running game');
 await click('#inviteNewBtn').catch(()=>{});
 ok(!errs.length,'no browser errors '+JSON.stringify(errs));
 host.close();ch.kill();srv.kill();console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})().catch(e=>{console.error('FAIL',e.stack);process.exit(1);});
