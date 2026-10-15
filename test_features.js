// Feature test (no browser): engine rules + server rooms. Covers host-only start, "started by", joining a started game,
// rejoin by session token and by name, diagonal screen-direction steps, building collision, Furniture aisle purchase, gifts + notices.
// Spawns its own server: node test_features.js
const fs=require('fs'),vm=require('vm'),http=require('http'),{spawn}=require('child_process'),WebSocket=require('ws');
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ctx);const E=ctx.module.exports;
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// ---------- engine ----------
{const st=E.createState('ENG',{speed:1});E.addPlayer(st,'a','Ann');E.addPlayer(st,'b','Bo');E.addPlayer(st,'ai','Pixel (AI)',true);
 ok(st.host==='a','first human is the host (AI never is)');
 ok(/Only the host/.test(E.startGame(st,1000,'b'))&&st.phase==='lobby','non-host cannot start: '+E.startGame(st,1000,'b'));
 ok(E.startGame(st,1000,'a')==='ok'&&st.phase==='day'&&st.startedBy==='Ann','host starts; startedBy = Ann');
 ok(/already started/.test(E.startGame(st,1000,'a')),'second start refused');
 const s2=E.createState('H2');E.addPlayer(s2,'a','Ann');E.addPlayer(s2,'b','Bo');E.removePlayer(s2,'a');ok(s2.host==='b','host passes on when the host leaves the lobby');
 // diagonal steps
 let now=2000;const p=st.players.a;const spot=(()=>{for(let y=3;y<E.TH-3;y++)for(let x=3;x<E.TW-3;x++){let all=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(E.TOWN.g[y+dy][x+dx]!=='.')all=false;if(all)return{x,y};}})();
 p.pos={map:'town',x:spot.x,y:spot.y,dir:'down'};now+=500;
 ok(E.step(st,'a',-1,-1,now)&&p.pos.x===spot.x-1&&p.pos.y===spot.y-1&&p.pos.dir==='up','Up (screen) = grid (-1,-1): one diagonal step');
 now+=500;ok(E.step(st,'a',1,-1,now)&&p.pos.x===spot.x&&p.pos.y===spot.y-2&&p.pos.dir==='right','Right (screen) = grid (+1,-1)');
 now+=500;ok(E.step(st,'a',1,1,now)&&p.pos.dir==='down','Down (screen) = grid (+1,+1)');now+=500;ok(E.step(st,'a',-1,1,now)&&p.pos.dir==='left','Left (screen) = grid (-1,+1)');
 p.pos={map:'town',x:spot.x,y:spot.y,dir:'down'};const row=E.TOWN.g[spot.y],setT=(c)=>{E.TOWN.g[spot.y]=typeof row==='string'?row.slice(0,spot.x+1)+c+row.slice(spot.x+2):row.map((v,i)=>i===spot.x+1?c:v);};setT('B');now+=500;
 ok(!E.step(st,'a',1,1,now)&&p.pos.x===spot.x,'diagonal cannot cut a corner past a wall');E.TOWN.g[spot.y]=row;
 now+=500;ok(!E.step(st,'a',2,0,now)&&!E.step(st,'a',0,0,now),'steps longer than one tile / zero are rejected');
 // collision: building footprints
 let bad=0;for(const b of E.TOWN.buildings)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){const door=x===b.door.x&&y===b.door.y;if(E.walkable(st,'town',x,y)!==(door&&E.isOpen(st,b.id)))bad++;}
 ok(bad===0,'every building tile is solid except its door (Seak Mart roof/walls cannot be walked on)');
 const mart=E.TOWN.buildings.find(b=>b.id==='mart');p.pos={map:'town',x:mart.door.x-1,y:mart.exit.y,dir:'up'};now+=500;ok(!E.step(st,'a',1,-1,now)&&p.pos.y===mart.exit.y,'cannot enter a door diagonally (and no step onto the building)');
 // Furniture aisle purchase
 p.pos={map:'b:mart',x:3,y:6,dir:'up'};p.coins=100;p.inv=[];const acts=E.actionsAt(st,'a').filter(a=>a.action==='shop');ok(acts.some(a=>a.aisle==='U'),'standing at the Furniture aisle offers Browse');
 ok(E.doAction(st,'a','shop',now,'f:couch')==='ok'&&E.doAction(st,'a','shop',now,'f:lamp')==='ok','add Couch + Lamp from the Furniture aisle');
 ok(/aisle/.test(E.doAction(st,'a','shop',now,'coffee')),'but Treats items are refused at the Furniture aisle');
 p.pos={map:'b:mart',x:11,y:7,dir:'up'};now+=100;ok(E.doAction(st,'a','checkout',now)==='ok'&&p.inv.includes('couch')&&p.inv.includes('lamp')&&p.coins===100-25-10,'checkout: furniture lands in the bag, coins paid ('+p.coins+' left)');
 ok(Object.keys(E.ITEMS).every(k=>E.catItem('f:'+k)&&E.catItem('f:'+k).aisle==='U'),'every furniture item in the game is sold in the Furniture aisle');
 ok(Object.values(E.CAT).filter(i=>i.aisle==='P').every(i=>typeof i.c==='number')&&!/\$|usd|real/i.test(JSON.stringify(E.CAT)),'Premium aisle: only in-game coin prices, no real-money fields');
 // gifts + notices
 const q=st.players.b;p.pos={map:'town',x:spot.x,y:spot.y,dir:'down'};q.pos={map:'town',x:spot.x+1,y:spot.y,dir:'down'};p.gifts.push('flowers');p.inv=['plant'];
 ok(!q.notice,'no notice yet');now+=100;ok(E.doAction(st,'a','gift',now,'flowers@b')==='ok'&&q.notice&&q.notice.n===1&&/Ann gave you/.test(q.notice.text),'gift: receiver gets a notice: "'+(q.notice&&q.notice.text)+'"');
 ok(E.doAction(st,'a','gift',now,'f:plant@b')==='ok'&&q.notice.n===2,'furniture gift bumps the notice counter');
 p.coins=50;ok(E.doAction(st,'a','gift',now,'coins:5@b')==='ok'&&q.notice.n===3&&/5 coins/.test(q.notice.text),'coin gift notice');}
// ---------- server ----------
(async()=>{const PORT=3210,srv=spawn('node',['server.js'],{cwd:__dirname,env:{...process.env,PORT,SEAK_SPEED:'0.5',SEAK_ROOM_TTL:'60'},stdio:'ignore'});await sleep(800);
 const mk=()=>new Promise(r=>{const w=new WebSocket('ws://localhost:'+PORT);w.st=null;w.errs=[];w.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')w.st=m.state;if(m.t==='welcome'){w.id=m.id;w.token=m.token;w.welcome=m;}if(m.t==='err')w.errs.push(m);});w.on('open',()=>r(w));});
 const tx=(w,m)=>w.send(JSON.stringify(m));const wait=async(f,ms=4000)=>{const t=Date.now();while(Date.now()-t<ms){if(f())return true;await sleep(30);}return false;};
 const info=c=>new Promise(r=>http.get(`http://localhost:${PORT}/room/${c}`,res=>{let d='';res.on('data',x=>d+=x);res.on('end',()=>r(JSON.parse(d)));}));
 try{const A=await mk();tx(A,{t:'create',name:'Ahmad'});await wait(()=>A.st);const code=A.st.code;ok(A.token&&A.token.length>=16,'welcome carries a session token');ok(!JSON.stringify(A.st).includes(A.token),'token is not leaked in shared state');
  const B=await mk();tx(B,{t:'join',code,name:'Bea'});await wait(()=>B.st&&B.st.order.length===2);
  ok((await info(code)).phase==='lobby','room info endpoint: lobby');
  tx(B,{t:'start'});await wait(()=>B.errs.length);ok(B.errs.some(e=>/Only the host/.test(e.msg))&&A.st.phase==='lobby','guest Start is refused: "'+(B.errs[0]||{}).msg+'"');
  tx(A,{t:'start'});await wait(()=>A.st.phase==='day');ok(A.st.phase==='day'&&A.st.startedBy==='Ahmad'&&A.st.host===A.id,'host Start works; state says Started by Ahmad');
  const C=await mk();tx(C,{t:'join',code,name:'Cat'});await wait(()=>C.errs.length);ok(C.errs[0]&&C.errs[0].code==='started'&&/already started/.test(C.errs[0].msg)&&C.errs[0].startedBy==='Ahmad','new player joining a started game gets code "started": "'+C.errs[0].msg+'"');
  const inf=await info(code);ok(inf.exists&&inf.phase==='day'&&inf.startedBy==='Ahmad'&&inf.players.length===2,'room info shows game in progress, started by, players');
  ok(!(await info('ZZZZ')).exists,'room info: unknown room');
  // impostor: same name as an ONLINE player is refused
  const D=await mk();tx(D,{t:'join',code,name:'Bea'});await wait(()=>D.errs.length);ok(D.errs[0]&&D.errs[0].code==='started'&&!D.welcome,'cannot take over the seat of a player who is still connected');
  // rejoin by token
  const bid=B.id,btok=B.token;B.close();await wait(()=>A.st.players[bid]&&A.st.players[bid].offline);ok(A.st.players[bid]&&A.st.players[bid].offline&&A.st.phase==='day','disconnect in a started game keeps the seat (marked away)');
  ok((await info(code)).players.find(p=>p.name==='Bea').offline===true,'room info shows Bea as away');
  const B2=await mk();tx(B2,{t:'join',code,name:'whatever',token:btok});await wait(()=>B2.welcome);ok(B2.welcome&&B2.welcome.rejoined&&B2.id===bid,'rejoin with saved token returns the same player');
  await wait(()=>A.st.players[bid]&&!A.st.players[bid].offline);ok(!A.st.players[bid].offline,'seat is live again');
  ok(B2.st&&B2.st.players[bid].name==='Bea','rejoined player keeps name/progress');
  // rejoin by name (no token)
  const aid=A.id;A.close();await wait(()=>B2.st&&B2.st.players[aid]&&B2.st.players[aid].offline);
  const A2=await mk();tx(A2,{t:'join',code,name:'ahmad'});await wait(()=>A2.welcome);ok(A2.welcome&&A2.welcome.rejoined&&A2.id===aid&&A2.st&&A2.st.host===aid,'rejoin by name (case-insensitive): host seat restored');
  tx(A2,{t:'step',dx:0,dy:1});tx(A2,{t:'start'});await sleep(200);ok(A2.st.phase==='day','game keeps running after rejoin');
  // an empty lobby room still disappears; a started room survives
  A2.close();B2.close();await sleep(400);ok((await info(code)).exists,'started room survives everyone disconnecting (rejoin window)');
  const L=await mk();tx(L,{t:'create',name:'Solo'});await wait(()=>L.st);const lc=L.st.code;L.close();await sleep(300);ok(!(await info(lc)).exists,'empty lobby room is removed');
 }catch(e){ok(false,'server test crashed: '+e.message);}
 srv.kill();console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})();
