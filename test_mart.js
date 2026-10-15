// Regression test: the Seak Mart Furniture aisle panel must load every time you walk up to it.
// Root cause it guards: the panel only refreshed on a game-state revision, but walking changes position without one, so the aisle list
// could stay on "Walk up to an aisle". Covers solo (repeated visits), online right after joining, after a rejoin, and across a day change.
// Run: node test_mart.js   (SEAK_DIR=/other/checkout and SEAK_SOLO_ONLY=1 to run only the file:// part against another build)
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http'),path=require('path'),url=require('url');
const DIR=process.env.SEAK_DIR||__dirname,PORT=3230,ORIGIN='http://localhost:'+PORT;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
const wait=async(f,ms=6000)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await sleep(40);}return false;};
(async()=>{let srv=null;if(!process.env.SEAK_SOLO_ONLY){srv=spawn('node',['server.js'],{cwd:DIR,env:{...process.env,PORT,SEAK_SPEED:'0.03'},stdio:'ignore'});await sleep(800);}
 const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9388','--window-size=1280,800','about:blank'],{stdio:'ignore'});
 let tabs;for(let i=0;i<40;i++){try{tabs=await get('http://127.0.0.1:9388/json');break;}catch{await sleep(200);}}
 const cdp=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>cdp.on('open',r));let id=0;const pend={},errs=[];
 cdp.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;cdp.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 const open=async u=>{await cmd('Page.navigate',{url:u});await sleep(1200);};
 const click=async sel=>{const [x,y]=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()`);for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});await sleep(150);};
 // furniture buttons in the Mart panel (data-k starts with "f:")
 const furn=()=>ev("(()=>{const c=document.getElementById('martCard');return c&&c.offsetHeight>0?[...document.querySelectorAll('#martItems button')].filter(b=>b.dataset.k.startsWith('f:')).length:-1})()");
 const nItems=await ev("0")||0;
 await cmd('Runtime.enable');await cmd('Page.enable');
 // ===== solo: repeated visits (position changes only, exactly like walking) =====
 await open(url.pathToFileURL(path.join(DIR,'index.html')).href);await ev("document.getElementById('nameIn').value='Mart'");await click('#soloBtn');await sleep(400);
 const total=await ev("Object.keys(SeakEngine.ITEMS).length");
 const setPos=(map,x,y)=>ev(`(()=>{SeakDebug.st.players.me.pos={map:'${map}',x:${x},y:${y},dir:'up'};})()`);
 await setPos('b:mart',8,7);await sleep(150);ok((await furn())===0,'inside the Mart away from aisles: no furniture list yet (panel open)');
 for(let i=1;i<=6;i++){await setPos('b:mart',i%2?3:6,6);ok(await wait(async()=>(await furn())===total,1500),`visit ${i}: walking up to the Furniture aisle lists all ${total} furniture items without any other game event`);await setPos('b:mart',8,7);await sleep(120);}
 // other aisles still work and the cart round-trips
 await setPos('b:mart',3,3);ok(await wait(async()=>(await ev("[...document.querySelectorAll('#martItems button')].some(b=>b.dataset.k==='coffee')"))===true,1500),'Treats aisle also loads on arrival');
 await setPos('b:mart',3,6);await wait(async()=>(await furn())===total,1500);await ev("document.querySelector('#martItems button[data-k=\"f:couch\"]').click()");ok(await wait(async()=>(await ev("SeakDebug.st.players.me.cart.join()"))==='f:couch',1500),'adding a Couch from the aisle puts it in the cart');
 ok(await ev("/Furniture aisle/.test(document.getElementById('martItems').innerText)&&/in-game coins/.test(document.getElementById('aisleDir').innerText)"),'aisle heading + coins-only note are shown');
 if(process.env.SEAK_SOLO_ONLY){ok(!errs.length,'no browser errors '+JSON.stringify(errs));ch.kill();console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);}
 // ===== online: right after joining, after rejoin, after a day change =====
 const host=new WebSocket('ws://localhost:'+PORT);host.st=null;host.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')host.st=m.state;});await new Promise(r=>host.on('open',r));
 host.send(JSON.stringify({t:'create',name:'Hostie'}));await wait(()=>host.st);const code=host.st.code;
 await open(ORIGIN+`/?room=${code}&name=Walker`);await click('#joinBtn');await wait(()=>host.st.order.length===2);host.send(JSON.stringify({t:'start'}));await wait(()=>host.st.phase==='day');
 const walkToMartAisle=async()=>{for(let i=0;i<400;i++){const r=await ev(`(()=>{const s=SeakDebug.st,E=SeakEngine,p=s.players[SeakDebug.me()];const q=p.pos;
   let fn;if(q.map==='town'){const d=E.doorOf('b:mart');fn=(x,y)=>x===d.x&&y===d.y;}else if(q.map==='b:mart'){const L=E.PUB_LAYOUT.mart;fn=(x,y)=>Math.abs(x-3)+Math.abs(y-6)===0;}else{const d=E.exitDoor(q.map,s);fn=(x,y)=>x===d.x&&y===d.y;}
   if(q.map==='b:mart'&&q.x===3&&q.y===6)return 'done';const n=E.nextStep(s,q.map,q.x,q.y,fn);if(!n)return 'nopath';__seakBridge.net({t:'step',dx:n[0]-q.x,dy:n[1]-q.y});return 'step';})()`);
   if(r==='done')return true;if(r==='nopath')return false;await sleep(130);}return false;};
 await ev("SeakDebug.me=()=>__seakBridge.me");
 ok(await walkToMartAisle(),'online: walked from home to the Furniture aisle');ok(await wait(async()=>(await furn())===total,2500),'online, right after joining: aisle lists all furniture');
 // leave and return a few times
 for(let i=0;i<2;i++){await setPos('town',1,1);await sleep(100);await ev("__seakBridge.net({t:'step',dx:0,dy:0})");ok(await walkToMartAisle(),`online visit ${i+2}: walked back in`);ok(await wait(async()=>(await furn())===total,2500),`online visit ${i+2}: aisle loaded`);}
 // rejoin (reload the page; saved session) then walk again
 await open(ORIGIN+'/');await wait(async()=>await ev("document.getElementById('resumeCard').offsetHeight>0"));await click('#resumeBtn');await wait(async()=>await ev("!!SeakDebug.st&&SeakDebug.st.phase==='day'"));await ev("SeakDebug.me=()=>__seakBridge.me");
 ok(await walkToMartAisle(),'after rejoin: walked to the aisle');ok(await wait(async()=>(await furn())===total,2500),'after rejoin: aisle lists all furniture');
 // day change while standing there
 const d0=await ev("SeakDebug.st.day");ok(await wait(async()=>(await ev("SeakDebug.st.day"))>d0,60000),'a new day started');await sleep(300);
 ok((await furn())===total||await wait(async()=>(await furn())===total,2000),'after the day changed: aisle still listed');
 await ev("(()=>{const s=SeakDebug.st,p=s.players[__seakBridge.me];})()");
 ok(!errs.length,'no browser errors '+JSON.stringify(errs));
 host.close();ch.kill();srv&&srv.kill();console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})().catch(e=>{console.error('FAIL',e.stack);process.exit(1);});
