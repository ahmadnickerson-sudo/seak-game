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
   if(!E.addPlayer(room.st,ws.id,String(m.name||'Player')))return err(room.st.order.length>=E.MAX_PLAYERS?`Room is full (${E.MAX_PLAYERS} max)`:'That game has already started. Ask the host to make a new room.');
   ws.room=room;room.clients.add(ws);ws.send(JSON.stringify({t:'welcome',id:ws.id,code:room.st.code}));broadcast(room);return;}
  const room=ws.room;if(!room)return;const st=room.st;let r='ok';
  if(m.t==='say'){E.chat(st,ws.id,m.text,Date.now());return;}
  if(m.t==='step'){E.step(st,ws.id,m.dx|0,m.dy|0,now);return;}// positions go out in the 10Hz 'pos' broadcast
  if(m.t==='do')r=E.doAction(st,ws.id,String(m.action),now,m.arg==null?null:String(m.arg));else if(m.t==='buy')r=E.buy(st,ws.id,String(m.item),m.x==null?null:m.x|0,m.y==null?null:m.y|0);
  else if(m.t==='start')E.startGame(st,now);else if(m.t==='bot'){if(st.phase==='lobby')E.addPlayer(st,'bot'+(nextId++),['Pixel','Juno','Byte','Mochi','Nova','Kiwi','Ziggy'][st.order.length%7]+' (AI)',true);}
  if(r!=='ok')err(r);E.tick(st,now);broadcast(room);});
 ws.on('close',()=>{const room=ws.room;if(!room)return;room.clients.delete(ws);E.removePlayer(room.st,ws.id);if(!room.clients.size)rooms.delete(room.st.code);else broadcast(room);});});
// game tick + state on change (needs/coins/visits/timer are server-authoritative)
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){E.tick(room.st,now);if(room.st.rev!==room.lastRev)broadcast(room);}},50);
// positions at 10Hz
setInterval(()=>{for(const room of rooms.values()){if(room.st.phase!=='day')continue;const msg=JSON.stringify({t:'pos',p:E.positions(room.st)});for(const c of room.clients)if(c.readyState===1)c.send(msg);}},100);
server.listen(PORT,()=>console.log(`Seak running on http://localhost:${PORT}`));
