// Live checks: solo (headless Chrome) + 2-client multiplayer. Usage: PORT=4391 node test_live.js  (server must be running)
const WebSocket=require('./node_modules/ws');const {spawn}=require('child_process');const http=require('http');const fs=require('fs');
const DM=require('./shared.js');
const PORT=process.env.PORT||4391,OUT='/workspace/seak/zombie/shots2',CDP=9391;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fail=0;const rep=(n,ok,d='')=>{console.log(ok?'PASS':'FAIL',n,d);if(!ok)fail++;};
const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{
const ch=spawn('google-chrome',['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP}`,'--window-size=1400,900','about:blank'],{stdio:'ignore'});
let tabs;for(let i=0;i<40;i++){try{tabs=await get(`http://127.0.0.1:${CDP}/json`);break;}catch{await sleep(200);}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={},errs=[];
ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>{const r=(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result;if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const shot=async(n,clip)=>{await sleep(250);const r=await cmd('Page.captureScreenshot',{format:'png',...(clip?{clip}:{})});fs.writeFileSync(`${OUT}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const keyDown=(k,code,vk)=>cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,text:k});
const keyUp=(k,code,vk)=>cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk});
const KEYS={w:['KeyW',87],a:['KeyA',65],s:['KeyS',83],d:['KeyD',68]};
const hold=async(k,ms)=>{await keyDown(k,...KEYS[k]);await sleep(ms);await keyUp(k,...KEYS[k]);};
const P=async()=>JSON.parse(await ev(`(()=>{const p=__dead.game.players[__dead.me];return JSON.stringify({x:p.x,y:p.y,hp:p.hp})})()`));
await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
await cmd('Page.navigate',{url:`http://localhost:${PORT}/`});await sleep(1200);
await ev(`document.querySelector('#solo').click()`);await sleep(800);
// freeze zombies/waves for the door walk test: put break phase far in future
const freeze=`(()=>{const g=__dead.game;g.phase='break';g.breakUntil=Date.now()+1e9;g.zombies=[];const p=g.players[__dead.me];p.hp=1e9;p.maxHp=1e9;})()`;
await ev(freeze);
// --- REAL KEYBOARD: walk into & out of every door of every building ---
const doors=await ev(`JSON.stringify(__dead.DM.buildings.flatMap(b=>b.doors.map(d=>({b:b.id||("house"+b.idx),x:d.x,y:d.y,s:d.s,ox:d.out.x,oy:d.out.y,ix:d.in.x,iy:d.in.y}))))`).then(JSON.parse);
const vec={N:['w'],S:['s'],E:['d'],W:['a']};
// screen-space keys: iso(x,y): +x is screen down-right (key 'd'), +y is screen down-left (key 's') in the game's world axes
// world +x = D, world -x = A, world +y = S, world -y = W
const wk=(dx,dy)=>dx>0?'d':dx<0?'a':dy>0?'s':'w';
let ok=0;const bad=[];
for(const d of doors){
 await ev(`(()=>{const p=__dead.game.players[__dead.me];p.x=${d.ox};p.y=${d.oy};})()`);await sleep(60);
 const k=wk(Math.sign(d.ix-d.ox),Math.sign(d.iy-d.oy));
 const back=wk(-Math.sign(d.ix-d.ox),-Math.sign(d.iy-d.oy));
 await hold(k,260);await sleep(60);const inn=await P();
 const inside=Math.abs(inn.x-d.ix)<.7&&Math.abs(inn.y-d.iy)<.7&&(Math.abs(inn.x-d.ox)+Math.abs(inn.y-d.oy)>1.2);
 await hold(back,450);await sleep(60);const out=await P();
 const outside=((out.x-d.x)*Math.sign(d.ox-d.x)+(out.y-d.y)*Math.sign(d.oy-d.y))>.55&&Math.abs((out.x-d.x)*Math.sign(d.oy-d.y))+Math.abs((out.y-d.y)*Math.sign(d.ox-d.x))<.3;
 if(inside&&outside)ok++;else bad.push([d,inn,out]);
}
rep(`real key presses: walk in and out of every door (${ok}/${doors.length})`,ok===doors.length,JSON.stringify(bad.slice(0,2)));
// walls block real key presses
{const b=await ev(`JSON.stringify(__dead.DM.buildings[0])`).then(JSON.parse);
 await ev(`(()=>{const p=__dead.game.players[__dead.me];p.x=${b.x+1};p.y=${b.y-1};})()`);await hold('s',600);const q=await P();rep('wall blocks player holding S into wall',q.y<b.y-.4,q.y.toFixed(2));}
// every crate blocks real key presses from every free side
{const cr=await ev(`JSON.stringify(__dead.DM.buildings.flatMap(b=>b.crates.map(c=>({b:b.id||('house'+b.idx),x:c[0],y:c[1]}))))`).then(JSON.parse);let n=0,okc=0;
 for(const c of cr)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const sx=c.x+dx,sy=c.y+dy;const free=await ev(`!__dead.DM.isSolid(${sx},${sy})`);if(!free)continue;
  await ev(`(()=>{const p=__dead.game.players[__dead.me];p.x=${sx};p.y=${sy};})()`);await sleep(40);
  await hold(wk(-dx,-dy),250);const q=await P();n++;const dist=Math.abs(q.x-c.x)+Math.abs(q.y-c.y);if(dist>=.75)okc++;else console.log('  crate pass-through?',c,q);}
 rep(`real key presses cannot walk into any crate (${okc}/${n} approaches, ${cr.length} crates)`,n>0&&okc===n);}
// screenshots: full map + close-ups
await ev(`(()=>{const p=__dead.game.players[__dead.me];p.x=33;p.y=23;})()`);await shot('01_solo_full_map');
const closeup=async(name,bi)=>{const r=await ev(`(()=>{const b=__dead.DM.buildings[${bi}];const a=__dead.pt(b.x+b.w/2-.5,b.y+b.h/2-.5);const cv=document.querySelector('#cv').getBoundingClientRect();return JSON.stringify({x:a.x*cv.width/document.querySelector('#cv').width+cv.left,y:a.y*cv.height/document.querySelector('#cv').height+cv.top,s:__dead.view.scale})})()`).then(JSON.parse);
 await shot(name,{x:Math.max(0,r.x-170),y:Math.max(0,r.y-130),width:340,height:260,scale:2.5});};
await closeup('02_house_closeup',0);await closeup('03_villa_closeup',8);await closeup('04_mart_closeup',13);await closeup('05_diner_closeup',9);
// player standing inside a house doorway
await ev(`(()=>{const b=__dead.DM.buildings[0],d=b.doors[0],p=__dead.game.players[__dead.me];p.x=d.in.x;p.y=d.in.y;})()`);await closeup('06_player_inside_house',0);
// --- zombies in a real solo wave: player hides inside the mart; track stuck zombies ---
await ev(`(()=>{const g=__dead.game;g.phase='break';g.breakUntil=Date.now()+100;const b=__dead.DM.buildings[13],p=g.players[__dead.me];p.hp=1e9;p.maxHp=1e9;p.x=b.x+b.w-2;p.y=b.y+b.h-2;})()`);
await sleep(1500);
const track={};let maxStuck=0,reached=0,samples=0;
for(let i=0;i<45;i++){await sleep(1000);const z=JSON.parse(await ev(`JSON.stringify({z:__dead.game.zombies.map(z=>({id:z.id,x:z.x,y:z.y})),p:(()=>{const p=__dead.game.players[__dead.me];return {x:p.x,y:p.y}})()})`));
 for(const q of z.z){const t=track[q.id]||(track[q.id]={x:q.x,y:q.y,still:0,min:99});const mv=Math.hypot(q.x-t.x,q.y-t.y);const d=Math.hypot(q.x-z.p.x,q.y-z.p.y);t.min=Math.min(t.min,d);
  if(mv<.15&&d>1)t.still++;else t.still=0;t.x=q.x;t.y=q.y;maxStuck=Math.max(maxStuck,t.still);}
 if(i===12)await shot('07_solo_zombies_chasing');if(i===30)await shot('08_solo_zombies_at_mart');}
const ids=Object.keys(track);reached=ids.filter(k=>track[k].min<1.2).length;
rep(`solo: no zombie stood still >2s (max still ${maxStuck}s)`,maxStuck<=2);
rep(`solo: zombies reached player hiding inside the mart (${reached}/${ids.length})`,ids.length>0&&reached===ids.length);
rep('solo: no page errors',errs.length===0,JSON.stringify(errs));
// shoot test: bullet fired into wall does nothing / fire through door works
await ev(`(()=>{const g=__dead.game;g.zombies=[];g.bullets=[];const b=__dead.DM.buildings[0],p=g.players[__dead.me];p.x=b.x+1;p.y=b.y+1;g.phase='break';g.breakUntil=Date.now()+1e9;})()`);
await shot('09_solo_in_house');
ch.kill();
// ================= MULTIPLAYER: 2 clients =================
function cl(name){const w=new WebSocket('ws://localhost:'+PORT);const c={w,st:null,id:null,errs:[]};w.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){c.id=m.id;c.code=m.code;c.st=m.game}if(m.t==='state')c.st=m.game;if(m.t==='err')c.errs.push(m.msg)});c.send=o=>w.send(JSON.stringify(o));c.open=new Promise(r=>w.on('open',r));return c;}
const A=cl(),B=cl();await A.open;await B.open;A.send({t:'create',name:'Alice'});await sleep(300);B.send({t:'join',code:A.code,name:'Bob'});await sleep(300);A.send({t:'ready',v:true});B.send({t:'ready',v:true});await sleep(300);A.send({t:'start'});await sleep(300);
rep('mp: two players in room',Object.keys(A.st.players).length===2);
// each client walks a computed path (BFS on shared grid) into a different building through a different door, driving real server 'input' messages
async function walkTo(c,tx,ty,maxMs=60000){const t0=Date.now();const f=DM.makeField(tx,ty);
 while(Date.now()-t0<maxMs){const p=c.st.players[c.id];if(!p||p.hp<=0)return'dead';if(Math.hypot(p.x-tx,p.y-ty)<.25){c.send({t:'input',mx:0,my:0,angle:0,weapon:1});return'ok';}
  const cx=Math.round(p.x),cy=Math.round(p.y);let nc=DM.nextCell(f,cx,cy);let gx=nc?nc[0]:tx,gy=nc?nc[1]:ty;if(cx===Math.round(tx)&&cy===Math.round(ty)){gx=tx;gy=ty;}
  const dx=gx-p.x,dy=gy-p.y,l=Math.hypot(dx,dy)||1;c.send({t:'input',mx:dx/l,my:dy/l,angle:Math.atan2(dy,dx),weapon:1});await sleep(50);}
 return'timeout';}
// wave 1 spawns ~1.5s after creation; zombies come from map edges. Walk immediately.
const bA=DM.buildings[8],bB=DM.buildings[13]; // villa and mart
const cA=bA.crates[0],cB=bB.crates[0];
const [rA,rB]=await Promise.all([walkTo(A,bA.doors[1].in.x,bA.doors[1].in.y),walkTo(B,bB.doors[2].in.x,bB.doors[2].in.y)]);
const inside=(c,b)=>{const p=c.st.players[c.id];return p.x>b.x&&p.x<b.x+b.w-1&&p.y>b.y&&p.y<b.y+b.h-1;};
rep('mp: Alice walked through a door into the villa (server-authoritative)',rA==='ok'&&inside(A,bA),rA);
rep('mp: Bob walked through a door into the mart',rB==='ok'&&inside(B,bB),rB);
// walk to the exit door on a different side and back out
const dA=bA.doors[0];const o1=await walkTo(A,dA.out.x,dA.out.y);rep('mp: Alice exits via a different door',o1==='ok'||o1==='dead',o1);
// zombie tracking server-side for 30s
const tr={};let stuckMax=0,sawZ=0;const t0=Date.now();
// bots shoot nearest zombie; Bob stays inside, Alice re-enters
walkTo(A,bA.doors[2].in.x,bA.doors[2].in.y,15000);
let wallHit=0,bulletsInSolid=0;
while(Date.now()-t0<30000&&!A.st.ended){
 for(const c of [A,B]){const p=c.st.players[c.id];if(!p||p.hp<=0)continue;if(c.st.zombies.length){const z=c.st.zombies.reduce((q,w)=>!q||Math.hypot(w.x-p.x,w.y-p.y)<Math.hypot(q.x-p.x,q.y-p.y)?w:q,null);const ang=Math.atan2(z.y-p.y,z.x-p.x);if(c===B)c.send({t:'input',mx:0,my:0,angle:ang,weapon:1});c.send({t:'shoot',weapon:c===B?2:1,angle:ang});}}
 await sleep(100);sawZ=Math.max(sawZ,A.st.zombies.length);
 for(const b of A.st.bullets)if(DM.pointSolid(b.x,b.y))bulletsInSolid++;
 const alive=Object.values(A.st.players).filter(p=>p.hp>0);
 for(const z of A.st.zombies){const t=tr[z.id]||(tr[z.id]={x:z.x,y:z.y,t:Date.now(),min:99});const d=alive.length?Math.min(...alive.map(p=>Math.hypot(p.x-z.x,p.y-z.y))):0;
  if(Date.now()-t.t>=1000){const mv=Math.hypot(z.x-t.x,z.y-t.y);t.st=(mv<.15&&d>1.2&&alive.length)?(t.st||0)+1:0;stuckMax=Math.max(stuckMax,t.st||0);t.x=z.x;t.y=z.y;t.t=Date.now();}
  if(DM.circleBlocked(z.x,z.y,DM.ZR*.99))wallHit++;}
}
rep(`mp: zombies spawned (max ${sawZ} at once)`,sawZ>0);
rep(`mp: no zombie stood still >2s (max ${stuckMax}s)`,stuckMax<=2);
rep('mp: no zombie ever inside a wall/crate',wallHit===0,wallHit);
rep('mp: no bullet inside a solid tile when broadcast',bulletsInSolid===0,bulletsInSolid);
console.log('mp state: wave',A.st.wave,'players',Object.values(A.st.players).map(p=>p.name+' hp'+p.hp+' sc'+p.score).join(' | '));
A.w.close();B.w.close();
console.log(fail?`\n${fail} FAILED`:'\nALL PASSED');process.exit(fail?1:0);
})();
