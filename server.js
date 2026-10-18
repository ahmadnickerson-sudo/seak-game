// SEAK: DEAD END — free, room-code co-op zombie shooter. Server owns combat state.
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000, HTML=path.join(__dirname,'index.html'), rooms=new Map();let seq=0;
const DM=require('./shared.js');
const MAX=8, W=68,H=46;
const guns={1:{damage:34,rate:300,spread:.045,pellets:1,speed:15},2:{damage:17,rate:95,spread:.10,pellets:1,speed:17},3:{damage:15,rate:650,spread:.43,pellets:7,speed:12}};
function fresh(code){return{code,players:{},zombies:[],bullets:[],pickups:[],wave:0,phase:'break',breakUntil:Date.now()+1500,nextId:1,ended:false,clients:new Set(),last:Date.now()};}
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url.startsWith('/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(HTML).pipe(res);}else if(req.url==='/health'){res.end('ok');}else if(req.url.startsWith('/room/')){const r=rooms.get(req.url.slice(6).split('?')[0].toUpperCase());res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(r?{exists:true,code:r.code,players:Object.keys(r.players).length,wave:r.wave}:{exists:false}));}else{res.writeHead(404);res.end('not found');}});
const wss=new WebSocketServer({server});
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o));}
function broadcast(r){const game=publicState(r);for(const c of r.clients)send(c,{t:'state',game});}
function publicState(r){return{code:r.code,players:r.players,zombies:r.zombies,bullets:r.bullets,pickups:r.pickups,wave:r.wave,phase:r.phase,breakUntil:r.breakUntil,ended:r.ended,nextId:r.nextId};}
function addPlayer(r,ws,name){if(Object.keys(r.players).length>=MAX)return null;let id='p'+(++seq);r.players[id]={id,name:String(name||'Survivor').replace(/[<>]/g,'').slice(0,12),x:33+(Math.random()-.5)*3,y:23+(Math.random()-.5)*3,hp:100,maxHp:100,score:0,weapon:1,ammo:{1:Infinity,2:36,3:8},reserve:{1:Infinity,2:180,3:48},lastShot:0,angle:0,color:['#b7f36b','#ffb36b','#7dc9ff','#e7a5ff'][Object.keys(r.players).length%4]};ws.id=id;ws.room=r;r.clients.add(ws);return id;}
function spawn(r){r.wave++;r.phase='playing';const n=5+r.wave*3;for(let i=0;i<n;i++){let sp=DM.spawnPoint(Math.random),x=sp.x,y=sp.y,type=r.wave>=4&&Math.random()<.25?2:r.wave>=2&&Math.random()<.35?1:0,hp=(type===2?100:type===1?65:40)+r.wave*12;r.zombies.push({id:r.nextId++,x,y,type,hp,maxHp:hp,speed:(type===2?1.1:type===1?1.5:1.8)+r.wave*.08,damage:(type===2?18:type===1?12:8)+Math.floor(r.wave/3)*3,hitAt:0});}for(const p of Object.values(r.players)){p.hp=Math.min(100,p.hp+20);p.ammo[2]=Math.min(36,p.ammo[2]+12);p.ammo[3]=Math.min(8,p.ammo[3]+3);}}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.t==='create'||m.t==='join'){let r,code;if(m.t==='create'){do{code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms.has(code));r=fresh(code);rooms.set(code,r);}else{code=String(m.code||'').toUpperCase();r=rooms.get(code);if(!r)return send(ws,{t:'err',msg:'Room not found. Create a room first.'});}
const id=addPlayer(r,ws,m.name);if(!id)return send(ws,{t:'err',msg:'Room is full.'});send(ws,{t:'welcome',id,code:r.code,game:publicState(r)});broadcast(r);return;}
const r=ws.room,p=r&&r.players[ws.id];if(!p)return;
if(m.t==='input'){p.mx=Math.max(-1,Math.min(1,+m.mx||0));p.my=Math.max(-1,Math.min(1,+m.my||0));p.angle=Number.isFinite(+m.angle)?+m.angle:p.angle;p.weapon=[1,2,3].includes(+m.weapon)?+m.weapon:p.weapon;}
if(m.t==='shoot'){const n=[1,2,3].includes(+m.weapon)?+m.weapon:p.weapon,g=guns[n],now=Date.now();if(r.phase!=='playing'||p.hp<=0||now-p.lastShot<g.rate||p.ammo[n]===0)return;p.lastShot=now;p.weapon=n;if(p.ammo[n]!==Infinity)p.ammo[n]--;const a=Number.isFinite(+m.angle)?+m.angle:p.angle;for(let i=0;i<g.pellets;i++){const ang=a+(Math.random()-.5)*g.spread;r.bullets.push({x:p.x,y:p.y,vx:Math.cos(ang)*g.speed,vy:Math.sin(ang)*g.speed,damage:g.damage,owner:p.id,life:35,color:n===3?'#ffcc8a':'#ffe17a'});}}
if(m.t==='restart'){r.zombies=[];r.bullets=[];r.wave=0;r.phase='break';r.breakUntil=Date.now()+800;for(const q of Object.values(r.players)){q.hp=100;q.score=0;q.x=33;q.y=23;}r.ended=false;}
});ws.on('close',()=>{const r=ws.room;if(!r)return;r.clients.delete(ws);delete r.players[ws.id];if(!Object.keys(r.players).length)rooms.delete(r.code);else broadcast(r);});});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){let dt=Math.min(50,now-r.last);r.last=now;if(r.ended)continue;
if(r.phase==='break'){if(now>=r.breakUntil)spawn(r);}else if(r.phase==='playing'){
for(const p of Object.values(r.players)){if(p.hp<=0)continue;let l=Math.hypot(p.mx||0,p.my||0)||1;DM.moveEntity(p,(p.mx||0)/l*dt*.004,(p.my||0)/l*dt*.004,DM.PR);}
DM.tickZombies(r,dt,now);
DM.tickBullets(r,dt,(z,b)=>{if(r.players[b.owner])r.players[b.owner].score+=10+z.type*5;});

if(!r.zombies.length){r.phase='break';r.breakUntil=now+5000;}if(Object.values(r.players).every(p=>p.hp<=0)){r.ended=true;r.phase='over';}
}broadcast(r);}},50);
server.listen(PORT,()=>console.log(`SEAK: DEAD END running at http://localhost:${PORT}`));
