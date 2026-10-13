// Browser test: drag & drop furniture in your own home (mouse + touch), invalid drop snaps back, tap-to-place still works.
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http');
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9337','--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
(async()=>{let tabs;for(let i=0;i<30;i++){try{tabs=await get('http://127.0.0.1:9337/json');break;}catch{await sleep(200);}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={};const errs=[];
ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(JSON.stringify(m.params.args));});
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>{const r=(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result;if(r.exceptionDetails)throw new Error(e+' => '+JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Page.navigate',{url:require('url').pathToFileURL(require('path').join(__dirname,'index.html')).href});await sleep(1000);
const b=await ev(`(()=>{const r=document.querySelector('#soloBtn').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x:b[0],y:b[1],button:'left',clickCount:1});await sleep(800);
await ev(`(()=>{const B=__seakBridge,p=B.st.players[B.me];p.pos={map:'h'+p.lot,x:3,y:4,dir:'down'};B.st.rev++;})()`);await sleep(400);
const P=`__seakBridge.st.players[__seakBridge.me]`;
const scr=(x,y,lift=0)=>ev(`(()=>{const iso=window.__seakIso,r=document.getElementById('cv').getBoundingClientRect();return [r.left+(${x}+.5-(${y}+.5))*iso.tw+iso.ox, r.top+(${x}+.5+${y}+.5)*iso.th+iso.oy-${lift}*iso.th]})()`);
const free=async(fx,fy,skip)=>JSON.parse(await ev(`(()=>{const B=__seakBridge,p=${P},E=SeakEngine;for(let y=1;y<12;y++)for(let x=1;x<14;x++)if(E.canMove(B.st,p,${fx},${fy},x,y)&&!(${JSON.stringify(skip||[])}).some(s=>s[0]===x&&s[1]===y))return JSON.stringify([x,y]);return 'null'})()`));
const mouseDrag=async(a,z)=>{await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:a[0],y:a[1],button:'left',buttons:1,clickCount:1});for(let i=1;i<=8;i++){await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:a[0]+(z[0]-a[0])*i/8,y:a[1]+(z[1]-a[1])*i/8,button:'left',buttons:1});await sleep(30);}await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:z[0],y:z[1],button:'left',buttons:0,clickCount:1});await sleep(400);};
let bed=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));
// 1. mouse drag (grab the block's top face, slightly above its ground tile)
let to=await free(bed.x,bed.y);await mouseDrag(await scr(bed.x,bed.y,.5),await scr(to[0],to[1]));
let now_=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));ok(now_.x===to[0]&&now_.y===to[1],`mouse drag moved bed ${bed.x},${bed.y} → ${now_.x},${now_.y} (wanted ${to})`);bed=now_;
// 2. invalid drop (onto the player) snaps back
const me=JSON.parse(await ev(`JSON.stringify(${P}.pos)`));await mouseDrag(await scr(bed.x,bed.y),await scr(me.x,me.y));now_=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));ok(now_.x===bed.x&&now_.y===bed.y,'invalid drop (onto player) snaps back');
// 3. touch drag
await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});to=await free(bed.x,bed.y);const a=await scr(bed.x,bed.y),z=await scr(to[0],to[1]);
await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1]}]});for(let i=1;i<=8;i++){await cmd('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a[0]+(z[0]-a[0])*i/8,y:a[1]+(z[1]-a[1])*i/8}]});await sleep(30);}await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(400);
now_=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));ok(now_.x===to[0]&&now_.y===to[1],`touch drag moved bed → ${now_.x},${now_.y} (wanted ${to})`);bed=now_;await cmd('Emulation.setTouchEmulationEnabled',{enabled:false});
// 4. tap on an item (no movement) does nothing
await mouseDrag(await scr(bed.x,bed.y),await scr(bed.x,bed.y));now_=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));ok(now_.x===bed.x&&now_.y===bed.y,'plain tap on item does not move it');
// 5. tap-to-place still works
await ev(`(()=>{const p=${P};p.inv.push('plant');__seakBridge.st.rev++})()`);await sleep(300);await ev(`[...document.querySelectorAll('#shop button')].find(b=>b.dataset.i==='plant').click()`);await sleep(200);
const pt=JSON.parse(await ev(`(()=>{const B=__seakBridge,p=${P};for(let y=1;y<12;y++)for(let x=1;x<14;x++)if(SeakEngine.canPlace(B.st,p,x,y))return JSON.stringify([x,y]);})()`));const c=await scr(pt[0],pt[1]);
for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x:c[0],y:c[1],button:'left',clickCount:1});await sleep(400);
ok(await ev(`${P}.items.some(i=>i.t==='plant'&&i.x===${pt[0]}&&i.y===${pt[1]})`),`tap-to-place plant at ${pt}`);
// 6. item in use cannot be dragged
await ev(`(()=>{const p=${P},b=p.items[0];p.pos={map:p.pos.map,x:b.x,y:b.y+1,dir:'up'};p.busy={a:'sleep',until:Date.now()+60000,g:{}};__seakBridge.st.rev++})()`);bed=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));to=await free(bed.x,bed.y);await mouseDrag(await scr(bed.x,bed.y),await scr(to[0],to[1]));
now_=JSON.parse(await ev(`JSON.stringify(${P}.items[0])`));ok(now_.x===bed.x&&now_.y===bed.y,'bed in use (sleeping) is not dragged');
ok(!errs.length,'no console errors '+JSON.stringify(errs));console.log(fails?'FAIL':'PASS');ch.kill();process.exit(fails?1:0);})();
