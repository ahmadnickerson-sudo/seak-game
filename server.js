// Seak multiplayer server: serves index.html and runs the authoritative game over WebSocket.
// The game rules live in index.html (<script id="engine">) and are shared with the browser's Solo mode.
const http=require('http'),fs=require('fs'),path=require('path'),vm=require('vm');const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;const HTML=path.join(__dirname,'index.html');
function loadEngine(){const src=fs.readFileSync(HTML,'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,ctx);return ctx.module.exports;}
const E=loadEngine();
const SPEED=parseFloat(process.env.SEAK_SPEED||'1');// e.g. 0.03 for tests (scales day length, action time, cooldowns)
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url.startsWith('/index.html')||req.url.startsWith('/?')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(HTML).pipe(res);}
 else if(req.url==='/health'){res.end('ok');}else{res.writeHead(404);res.end('not found');}});
const wss=new WebSocketServer({server});const rooms=new Map();let nextId=1;
function code(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let c;do{c=Array.from({length:4},()=>A[Math.floor(Math.random()*A.length)]).join('');}while(rooms.has(c));return c;}
function broadcast(room){const msg=JSON.stringify({t:'state',state:room.st,now:Date.now()});room.lastRev=room.st.rev;for(const c of room.clients)if(c.readyState===1)c.send(msg);}
wss.on('connection',ws=>{ws.id='p'+(nextId++);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;}const now=Date.now();const err=msg=>ws.send(JSON.stringify({t:'err',msg}));
  if(m.t==='create'||m.t==='join'){let room;if(m.t==='create'){const c=code();room={st:E.createState(c,{speed:SPEED}),clients:new Set(),lastRev:-1};rooms.set(c,room);}
   else{room=rooms.get(String(m.code||'').toUpperCase());if(!room)return err(`Room ${String(m.code||'').toUpperCase()} not found. Check the code or ask the host for a new link.`);}
   if(!E.addPlayer(room.st,ws.id,String(m.name||'Player'),false,m.look))return err(room.st.order.length>=E.MAX_PLAYERS?`Room is full (${E.MAX_PLAYERS} max)`:'That game has already started. Ask the host to make a new room.');
   ws.room=room;room.clients.add(ws);ws.send(JSON.stringify({t:'welcome',id:ws.id,code:room.st.code}));broadcast(room);return;}
  const room=ws.room;if(!room)return;const st=room.st;let r='ok';
  // arcade: 'arc' marks which mini-game you have open (for Pong pairing); 'arcmsg' relays Pong frames to your partner
  if(m.t==='arc'){const p=st.players[ws.id];if(p){const g=m.game;p.arc=['pong','pong-cpu','blockfall','chomp'].includes(g)?g:null;if(p.arc!=='pong')endPong(room,ws.id);st.rev++;broadcast(room);}return;}
  // online 2-player Pong: the server owns ball + paddles (see pongTick); clients only send their paddle x
  if(m.t==='pongChallenge'){const me=st.players[ws.id],to=st.players[m.to];if(!me||!to||to===me||me.ai||to.ai||me.arc!=='pong'||to.arc!=='pong')return err('They need to have Pong open to play online.');
   if(room.pong&&!room.pong.over)return err('A Pong match is already on in this room.');room.pong={a:ws.id,b:to.id,pa:PONG.W/2,pb:PONG.W/2,sa:0,sb:0,over:false};pongServe(room.pong,1);sendPong(room);return;}
  if(m.t==='pongPad'){const P=room.pong;if(!P||P.over)return;const x=Math.max(PONG.PW/2,Math.min(PONG.W-PONG.PW/2,+m.x||PONG.W/2));if(ws.id===P.a)P.pa=x;else if(ws.id===P.b)P.pb=PONG.W-x;return;}
  if(m.t==='pongLeave'){endPong(room,ws.id);return;}
  if(m.t==='arcmsg'){const me=st.players[ws.id],to=st.players[m.to];if(!me||!to||me.arc!=='pong'||to.arc!=='pong')return;for(const c of room.clients)if(c.id===m.to&&c.readyState===1)c.send(JSON.stringify({t:'arcmsg',from:ws.id,data:m.data}));return;}
  if(m.t==='say'){E.chat(st,ws.id,m.text,Date.now());return;}
  if(m.t==='step'){E.step(st,ws.id,m.dx|0,m.dy|0,now,!!m.run);return;}// positions go out in the 10Hz 'pos' broadcast
  if(m.t==='do')r=E.doAction(st,ws.id,String(m.action),now,m.arg==null?null:String(m.arg));else if(m.t==='buy')r=E.buy(st,ws.id,String(m.item),m.x==null?null:m.x|0,m.y==null?null:m.y|0);else if(m.t==='rotate')r=E.rotateItem(st,ws.id,m.x|0,m.y|0);else if(m.t==='move')r=E.moveItem(st,ws.id,m.fx|0,m.fy|0,m.x|0,m.y|0);
  else if(m.t==='start')E.startGame(st,now);else if(m.t==='bot'){if(st.phase==='lobby')E.addPlayer(st,'bot'+(nextId++),['Pixel','Juno','Byte','Mochi','Nova','Kiwi','Ziggy'][st.order.length%7]+' (AI)',true);}
  if(r!=='ok')err(r);E.tick(st,now);broadcast(room);});
 ws.on('close',()=>{const room=ws.room;if(!room)return;endPong(room,ws.id);room.clients.delete(ws);E.removePlayer(room.st,ws.id);if(!room.clients.size)rooms.delete(room.st.code);else broadcast(room);});});
// ---------- online Pong (server-authoritative). Player a defends the bottom edge, b the top; b's client mirrors the view ----------
const PONG={W:300,H:400,PW:60,TO:5};
function pongServe(P,d){P.ball={x:PONG.W/2,y:PONG.H/2,vx:(Math.random()-.5)*3,vy:3.2*d};}
function sendTo(room,id,o){for(const c of room.clients)if(c.id===id&&c.readyState===1)c.send(JSON.stringify(o));}
function sendPong(room){const P=room.pong,st=room.st,nm=id=>(st.players[id]||{}).name||'player',base={t:'pong',b:[P.ball.x,P.ball.y],pa:P.pa,pb:P.pb,sa:P.sa,sb:P.sb,over:P.over};
 sendTo(room,P.a,{...base,you:'a',opp:nm(P.b)});sendTo(room,P.b,{...base,you:'b',opp:nm(P.a)});}
function endPong(room,id){const P=room.pong;if(!P||(id!==P.a&&id!==P.b))return;room.pong=null;if(!P.over)sendTo(room,id===P.a?P.b:P.a,{t:'pongEnd'});}
function pongStep(P,f){const {W,H,PW}=PONG,b=P.ball;b.x+=b.vx*f;b.y+=b.vy*f;if(b.x<6||b.x>W-6){b.vx*=-1;b.x=Math.max(6,Math.min(W-6,b.x));}
 if(b.vy>0&&b.y>H-26&&b.y<H-10&&Math.abs(b.x-P.pa)<PW/2+6){b.vy=-Math.min(9,Math.abs(b.vy)*1.06);b.vx+=(b.x-P.pa)/9;}
 if(b.vy<0&&b.y<26&&b.y>10&&Math.abs(b.x-P.pb)<PW/2+6){b.vy=Math.min(9,Math.abs(b.vy)*1.06);b.vx+=(b.x-P.pb)/9;}
 if(b.y>H+10){P.sb++;pongServe(P,-1);}else if(b.y<-10){P.sa++;pongServe(P,1);}if(P.sa>=PONG.TO||P.sb>=PONG.TO)P.over=true;}
setInterval(()=>{for(const room of rooms.values()){const P=room.pong;if(!P)continue;if(!P.over){pongStep(P,1);pongStep(P,1);}sendPong(room);if(P.over)room.pong=null;}},33);
// game tick + state on change (needs/coins/visits/timer are server-authoritative)
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){E.tick(room.st,now);if(room.st.rev!==room.lastRev)broadcast(room);}},50);
// positions at 10Hz
setInterval(()=>{for(const room of rooms.values()){if(room.st.phase!=='day')continue;const msg=JSON.stringify({t:'pos',p:E.positions(room.st)});for(const c of room.clients)if(c.readyState===1)c.send(msg);}},100);
server.listen(PORT,()=>console.log(`Seak running on http://localhost:${PORT}`));
