// Seak multiplayer server: serves index.html and runs the authoritative game over WebSocket.
// The game rules live in index.html (<script id="engine">) and are shared with the browser's Solo mode.
const http=require('http'),fs=require('fs'),path=require('path'),vm=require('vm');const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;const HTML=path.join(__dirname,'index.html');
function loadEngine(){const src=fs.readFileSync(HTML,'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,ctx);return ctx.module.exports;}
const E=loadEngine();
const FAST=parseFloat(process.env.SEAK_SPEED||'1');// e.g. 0.05 for tests
const dur={};for(const k in E.DUR)dur[k]=Math.round(E.DUR[k]*FAST);
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url.startsWith('/index.html')||req.url.startsWith('/?')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(HTML).pipe(res);}
 else if(req.url==='/health'){res.end('ok');}else{res.writeHead(404);res.end('not found');}});
const wss=new WebSocketServer({server});const rooms=new Map();let nextId=1;
function code(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let c;do{c=Array.from({length:4},()=>A[Math.floor(Math.random()*A.length)]).join('');}while(rooms.has(c));return c;}
function broadcast(room){const msg=JSON.stringify({t:'state',state:room.st,now:Date.now()});room.lastRev=room.st.rev;for(const c of room.clients)if(c.readyState===1)c.send(msg);}
wss.on('connection',ws=>{ws.id='p'+(nextId++);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;}const now=Date.now();const err=msg=>ws.send(JSON.stringify({t:'err',msg}));
  if(m.t==='create'||m.t==='join'){let room;if(m.t==='create'){const c=code();room={st:E.createState(c,{dur}),clients:new Set(),lastRev:-1};rooms.set(c,room);}
   else{room=rooms.get(String(m.code||'').toUpperCase());if(!room)return err('Room not found');}
   if(!E.addPlayer(room.st,ws.id,String(m.name||'Player')))return err(room.st.order.length>=6?'Room is full (6 max)':'Game already started');
   ws.room=room;room.clients.add(ws);ws.send(JSON.stringify({t:'welcome',id:ws.id,code:room.st.code}));broadcast(room);return;}
  const room=ws.room;if(!room)return;const st=room.st;let r='ok';
  if(m.t==='act')r=E.setAction(st,ws.id,m.action,m.target);else if(m.t==='buy')r=E.buy(st,ws.id,m.item,m.cell);else if(m.t==='ready')E.setReady(st,ws.id);
  else if(m.t==='start')E.startGame(st,now);else if(m.t==='bot'){if(st.phase==='lobby')E.addPlayer(st,'bot'+(nextId++),['Pixel','Juno','Byte','Mochi','Nova'][st.order.length%5]+' (AI)',true);}
  if(r!=='ok')err(r);E.tick(st,now);broadcast(room);});
 ws.on('close',()=>{const room=ws.room;if(!room)return;room.clients.delete(ws);E.removePlayer(room.st,ws.id);if(!room.clients.size)rooms.delete(room.st.code);else broadcast(room);});});
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){E.tick(room.st,now);if(room.st.rev!==room.lastRev)broadcast(room);}},200);
server.listen(PORT,()=>console.log(`Seak running on http://localhost:${PORT}`));
