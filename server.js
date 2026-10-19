// SEAK: DEAD END — free, room-code co-op zombie shooter. Server owns combat state.
'use strict';
function normAng(v,d){v=+v;if(!Number.isFinite(v))return d||0;v=Math.max(-1e4,Math.min(1e4,v));return Math.atan2(Math.sin(v),Math.cos(v));}
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000, HTML=path.join(__dirname,'index.html'), rooms=new Map();let seq=0;
const DM=require('./shared.js');
const MAX=8, W=68,H=46;
const guns={1:{damage:34,rate:300,spread:.045,pellets:1,speed:15},2:{damage:17,rate:95,spread:.10,pellets:1,speed:17},3:{damage:15,rate:650,spread:.43,pellets:7,speed:12}};
function fresh(code){return{code,players:{},zombies:[],bullets:[],pickups:DM.ammoInit(),respawns:[],wave:0,phase:'lobby',host:null,breakUntil:0,nextId:1,ended:false,clients:new Set(),last:Date.now()};}
function roomInfo(c){const r=rooms.get(String(c||'').toUpperCase());if(!r)return{exists:false};const ps=Object.values(r.players);return{exists:true,code:r.code,started:r.phase!=='lobby',phase:r.phase,players:ps.length,max:MAX,full:ps.length>=MAX,names:ps.map(p=>p.name),wave:r.wave};}
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0];
 const page=()=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(HTML).pipe(res);};
 if(u==='/'||u==='/index.html')return page();
 if(u==='/health'){res.end('ok');return;}
 if(u.startsWith('/api/room/')){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(roomInfo(decodeURIComponent(u.slice(10)))));return;}
 if(u.startsWith('/room/')){ // invite link: browsers get the game page (it auto-reads the code); API clients asking for JSON get status
  if(String(req.headers.accept||'').includes('application/json')&&!String(req.headers.accept).includes('text/html')){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(roomInfo(decodeURIComponent(u.slice(6)))));return;}
  return page();}
 res.writeHead(404);res.end('not found');});
const wss=new WebSocketServer({server});
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o));}
function broadcast(r){const game=publicState(r);for(const c of r.clients)send(c,{t:'state',game});}
function pubPlayers(r){const o={};for(const[k,p]of Object.entries(r.players)){const{token,disc,...q}=p;o[k]=q;}return o;}
function publicState(r){return{code:r.code,players:pubPlayers(r),zombies:r.zombies,bullets:r.bullets,pickups:r.pickups,wave:r.wave,phase:r.phase,host:r.host,breakUntil:r.breakUntil,ended:r.ended,nextId:r.nextId};}
function addPlayer(r,ws,name){if(Object.keys(r.players).length>=MAX)return null;let id='p'+(++seq);r.players[id]={id,name:String(name||'Survivor').replace(/[<>]/g,'').slice(0,12),x:33+(Math.random()-.5)*3,y:23+(Math.random()-.5)*3,hp:100,maxHp:100,score:0,weapon:1,ammo:{1:Infinity,2:36,3:8},reserve:{1:Infinity,2:180,3:48},lastShot:0,angle:0,ready:false,token:crypto.randomBytes(8).toString('hex'),color:['#b7f36b','#ffb36b','#7dc9ff','#e7a5ff'][Object.keys(r.players).length%4]};ws.id=id;ws.room=r;r.clients.add(ws);if(!r.host)r.host=id;return id;}
function allReady(r){const ps=Object.values(r.players).filter(p=>!p.disc);return ps.length>0&&ps.every(p=>p.ready);}
function startGame(r){r.phase='break';r.breakUntil=Date.now()+1500;r.last=Date.now();for(const q of Object.values(r.players))q.ready=true;}
function dropPlayer(r,id){delete r.players[id];if(r.host===id){const n=Object.keys(r.players)[0];r.host=n||null;}if(!Object.keys(r.players).length)rooms.delete(r.code);}
function spawn(r){r.wave++;r.phase='playing';const n=5+r.wave*3;for(let i=0;i<n;i++){let sp=DM.spawnPoint(Math.random),x=sp.x,y=sp.y,type=r.wave>=4&&Math.random()<.25?2:r.wave>=2&&Math.random()<.35?1:0,hp=(type===2?100:type===1?65:40)+r.wave*12;r.zombies.push({id:r.nextId++,x,y,type,hp,maxHp:hp,speed:(type===2?1.1:type===1?1.5:1.8)+r.wave*.08,damage:(type===2?18:type===1?12:8)+Math.floor(r.wave/3)*3,hitAt:0});}for(const p of Object.values(r.players)){p.hp=Math.min(100,p.hp+20);p.ammo[2]=Math.min(36,p.ammo[2]+12);p.ammo[3]=Math.min(8,p.ammo[3]+3);}}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.t==='create'||m.t==='join'){let r,code;if(m.t==='create'){do{code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms.has(code));r=fresh(code);rooms.set(code,r);}else{code=String(m.code||'').toUpperCase();r=rooms.get(code);if(!r)return send(ws,{t:'err',msg:'Room not found. Create a room first.'});}
if(m.t==='join'&&m.token){const old=Object.values(r.players).find(q=>q.token===m.token);if(old){old.disc=0;for(const c of r.clients)if(c.id===old.id)r.clients.delete(c);ws.id=old.id;ws.room=r;r.clients.add(ws);send(ws,{t:'welcome',id:old.id,token:old.token,code:r.code,game:publicState(r)});broadcast(r);return;}}
const id=addPlayer(r,ws,m.name);if(!id)return send(ws,{t:'err',msg:'Room is full.'});send(ws,{t:'welcome',id,token:r.players[id].token,code:r.code,game:publicState(r)});broadcast(r);return;}
const r=ws.room,p=r&&r.players[ws.id];if(!p)return;
if(m.t==='ready'){if(r.phase!=='lobby')return;p.ready=!!m.v;broadcast(r);return;}
if(m.t==='start'){if(r.phase!=='lobby')return;if(ws.id!==r.host)return send(ws,{t:'err',msg:'Only the host can start.'});if(!allReady(r))return send(ws,{t:'err',msg:'Everyone must be ready first.'});startGame(r);broadcast(r);return;}
if(m.t==='leave'){ws.close();return;}
if(m.t==='input'){p.mx=Math.max(-1,Math.min(1,+m.mx||0));p.my=Math.max(-1,Math.min(1,+m.my||0));p.angle=normAng(m.angle,p.angle);p.weapon=[1,2,3].includes(+m.weapon)?+m.weapon:p.weapon;}
if(m.t==='shoot'){const n=[1,2,3].includes(+m.weapon)?+m.weapon:p.weapon,g=guns[n],now=Date.now();if(r.phase!=='playing'||p.hp<=0||now-p.lastShot<g.rate||p.ammo[n]===0)return;p.lastShot=now;p.weapon=n;if(p.ammo[n]!==Infinity)p.ammo[n]--;const a=normAng(m.angle,p.angle);for(let i=0;i<g.pellets;i++){const ang=a+(Math.random()-.5)*g.spread;r.bullets.push({x:p.x,y:p.y,vx:Math.cos(ang)*g.speed,vy:Math.sin(ang)*g.speed,damage:g.damage,owner:p.id,life:35,color:n===3?'#ffcc8a':'#ffe17a'});}}
if(m.t==='restart'){r.zombies=[];r.bullets=[];r.wave=0;r.phase='break';r.breakUntil=Date.now()+800;for(const q of Object.values(r.players)){q.hp=100;q.score=0;q.x=33;q.y=23;}r.ended=false;}
});ws.on('close',()=>{const r=ws.room;if(!r)return;r.clients.delete(ws);const p=r.players[ws.id];if(!p)return;
 if(r.clients.has&&[...r.clients].some(c=>c.id===ws.id))return; // a newer socket took over (reconnect)
 if(r.phase==='lobby'){dropPlayer(r,ws.id);if(rooms.has(r.code))broadcast(r);}
 else{p.disc=Date.now();p.mx=0;p.my=0;setTimeout(()=>{const q=r.players[p.id];if(q&&q.disc&&Date.now()-q.disc>=19000){dropPlayer(r,p.id);if(rooms.has(r.code))broadcast(r);}},20000);}
});});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){let dt=Math.min(50,now-r.last);r.last=now;if(r.ended)continue;
DM.tickAmmo(r,now);if(r.phase==='break'){if(now>=r.breakUntil)spawn(r);}else if(r.phase==='playing'){
for(const p of Object.values(r.players)){if(p.hp<=0)continue;let l=Math.hypot(p.mx||0,p.my||0)||1;DM.moveEntity(p,(p.mx||0)/l*dt*.004,(p.my||0)/l*dt*.004,DM.PR);}
DM.tickZombies(r,dt,now);
DM.tickBullets(r,dt,(z,b)=>{if(r.players[b.owner])r.players[b.owner].score+=10+z.type*5;});

if(!r.zombies.length){r.phase='break';r.breakUntil=now+5000;}if(Object.values(r.players).every(p=>p.hp<=0)){r.ended=true;r.phase='over';}
}broadcast(r);}},50);
server.listen(PORT,()=>console.log(`SEAK: DEAD END running at http://localhost:${PORT}`));
