// Invite-link + agent bridge test. Needs the server: PORT=3100 SEAK_SPEED=0.5 node server.js ; then PORT=3100 node test_invite.js
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http'),path=require('path'),url=require('url');
const PORT=process.env.PORT||3100,ORIGIN='http://localhost:'+PORT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
const wait=(f,ms=15000,what='')=>new Promise((r,j)=>{const t0=Date.now(),i=setInterval(()=>{Promise.resolve(f()).then(v=>{if(v){clearInterval(i);r(v);}else if(Date.now()-t0>ms){clearInterval(i);j(new Error('timeout: '+what));}});},100);});
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
(async()=>{
 const host=new WebSocket('ws://localhost:'+PORT);host.st=null;host.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')host.st=m.state;if(m.t==='welcome')host.id=m.id;if(m.t==='pos'&&host.st)for(const id in m.p){const q=host.st.players[id];if(q){const[a,x,y]=m.p[id];q.pos={map:a,x,y};}}});
 await new Promise(r=>host.on('open',r));host.send(JSON.stringify({t:'create',name:'Ahmad'}));await wait(()=>host.st,5000,'create');const code=host.st.code;ok(true,'host created room '+code);
 const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9335','--window-size=1100,800','about:blank'],{stdio:'ignore'});
 let tabs;for(let i=0;i<40;i++){try{tabs=await get('http://127.0.0.1:9335/json');break;}catch{await sleep(200);}}
 const cdp=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>cdp.on('open',r));let id=0;const pend={},errs=[];
 cdp.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.text);});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;cdp.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 const open=async u=>{await cmd('Page.navigate',{url:u});await sleep(1200);};
 const click=async sel=>{const [x,y]=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()`);for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});};
 await cmd('Runtime.enable');await cmd('Page.enable');
 // 1. file:// hides the invite UI
 await open(url.pathToFileURL(path.join(__dirname,'index.html')).href+'?room=ABCD');ok(await ev("getComputedStyle(document.getElementById('inviteHead')).display==='none'&&getComputedStyle(document.getElementById('soloCard')).display!=='none'"),'file:// with ?room= keeps the normal start screen (no invite UI)');
 // 2. bad code
 await open(ORIGIN+'/?room=ZZZZ&name=Tester');await click('#joinBtn');await wait(()=>ev("document.getElementById('mpMsg').textContent.includes('not found')"),5000,'bad code msg');ok(true,'invalid room shows: "'+await ev("document.getElementById('mpMsg').textContent")+'"');
 // 3. join via invite link with ?name=
 await open(ORIGIN+`/?room=${code}&name=Pinky`);
 ok(await ev(`document.getElementById('codeIn').value==='${code}'&&document.getElementById('nameIn').value==='Pinky'&&document.getElementById('inviteHead').offsetHeight>0&&document.getElementById('soloCard').offsetHeight===0`),'invite page: "Join room '+code+'" screen, code + name prefilled, solo hidden');
 await click('#joinBtn');await wait(()=>host.st.order.some(i=>host.st.players[i].name==='Pinky'),5000,'browser joined');ok(true,'browser player "Pinky" joined via the invite link');
 const inv=await wait(()=>ev("document.getElementById('inviteBox').offsetHeight>0&&document.getElementById('inviteUrl').value"),5000,'invite box');ok(inv===`${ORIGIN}/?room=${code}`,'lobby shows invite link + Copy button: '+inv);
 // 4. agent bridge joins the same room
 const ag=spawn('node',[path.join(__dirname,'agent_client.js'),`${ORIGIN}/?room=${code}`,'Bot'],{stdio:['pipe','pipe','inherit']});const agOut=[];ag.stdout.on('data',d=>String(d).split('\n').filter(Boolean).forEach(l=>{try{agOut.push(JSON.parse(l));}catch{}}));
 await wait(()=>agOut.some(e=>e.ev==='joined'),8000,'agent joined');await wait(()=>host.st.order.length===3,5000,'3 players');ok(true,'agent_client joined: players = '+host.st.order.map(i=>host.st.players[i].name).join(', '));
 host.send(JSON.stringify({t:'start'}));await wait(()=>host.st.phase==='day',5000,'start');
 {const late=new WebSocket('ws://localhost:'+PORT);let msg='';late.on('message',d=>{const m=JSON.parse(d);if(m.t==='err')msg=m.msg;});await new Promise(r=>late.on('open',r));late.send(JSON.stringify({t:'join',code,name:'Late'}));await wait(()=>msg,3000,'late');ok(/already started/.test(msg),'joining a started game is refused: "'+msg+'"');late.close();}
 ag.stdin.write('say hello from the bridge\n');await wait(()=>host.st.log.some(l=>l.m.includes('Bot: “hello from the bridge”')),5000,'say');ok(true,'agent "say" shows to everyone');
 ag.stdin.write('go diner\n');ag.stdin.write('do eat\n');const botId=host.st.order.find(i=>host.st.players[i].name==='Bot');
 await wait(()=>host.st.players[botId].pos.map==='b:diner'&&(host.st.players[botId].busy||host.st.log.some(l=>l.m.startsWith('🍳 Bot'))),40000,'agent ate');ok(true,'agent walked into the Diner ("go diner") and ate ("do eat")');
 ag.stdin.write('status\n');await wait(()=>agOut.some(e=>e.ev==='status'),3000,'status');ok(true,'status: '+JSON.stringify(agOut.find(e=>e.ev==='status').me.needs));
 ok(!errs.length,'no browser errors '+JSON.stringify(errs));
 ag.kill();ch.kill();host.close();console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
