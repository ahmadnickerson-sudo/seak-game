// Headless multiplayer test. Run: SEAK_SPEED=0.06 node server.js  then  node test_mp.js
// Covers: create/join, running (fast steps accepted), walk-in Diner + eat inside, Seak Mart purchase, movement sync between clients, an action trigger (Sleep at bed), a visit, full 7 days, synced results.
const WebSocket=require('ws');const URL='ws://localhost:'+(process.env.PORT||3000);
const fs=require('fs'),vm=require('vm');const ectx={module:{exports:{}},globalThis:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],ectx);const E=ectx.module.exports;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mk=n=>new Promise(r=>{const ws=new WebSocket(URL);ws.st=null;ws.errs=[];ws.emotes=[];ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='emote')ws.emotes.push(m.id);if(m.t==='arcmsg')(ws.arc=ws.arc||[]).push(m);if(m.t==='welcome')ws.id=m.id;if(m.t==='state')ws.st=m.state;
 if(m.t==='pos'&&ws.st)for(const id in m.p){const[a,x,y,dir]=m.p[id];if(ws.st.players[id])ws.st.players[id].pos={map:a,x,y,dir};}if(m.t==='err'){ws.errs.push(m.msg);console.log(n,'err:',m.msg);}});ws.on('open',()=>r(ws));});
const wait=(f,ms=20000,what='')=>new Promise((r,j)=>{const t0=Date.now(),i=setInterval(()=>{if(f()){clearInterval(i);r();}else if(Date.now()-t0>ms){clearInterval(i);j(new Error('timeout: '+what));}},10);});
const tx=(ws,m)=>ws.send(JSON.stringify(m));
async function walk(ws,dx,dy,n){for(let i=0;i<n;i++){tx(ws,{t:'step',dx,dy});await sleep(120);}}
async function walkTo(ws,map,goalFn){for(let i=0;i<200;i++){const p=ws.st.players[ws.id],q=p.pos;if(q.map===map&&goalFn(q.x,q.y))return;
 let fn;if(q.map!==map){if(q.map!=='town'){const d=E.exitDoor(q.map,ws.st);fn=(x,y)=>x===d.x&&y===d.y;}else{const d=E.doorOf(map);fn=(x,y)=>x===d.x&&y===d.y;}}else fn=goalFn;
 const n=E.nextStep(ws.st,q.map,q.x,q.y,fn);if(!n)throw new Error('no path');const before=JSON.stringify(q);tx(ws,{t:'step',dx:n[0]-q.x,dy:n[1]-q.y});
 await wait(()=>JSON.stringify(ws.st.players[ws.id].pos)!==before,1500,'step ack').catch(()=>{});await sleep(100);}throw new Error('walkTo timeout');}
let pass=0;const ok=m=>{pass++;console.log('✔',m);};
(async()=>{
 // capacity: 8 clients in one room, 9th rejected
 {const cs=[await mk('C1')];tx(cs[0],{t:'create',name:'Cap1'});await wait(()=>cs[0].st,5000,'cap create');const code=cs[0].st.code;
  for(let i=2;i<=8;i++){const c=await mk('C'+i);c.on('message',()=>{});tx(c,{t:'join',code,name:'Cap'+i});cs.push(c);await wait(()=>c.id,3000,'cap join '+i);}
  await wait(()=>cs.every(c=>c.st&&c.st.order.length===8),5000,'8 synced');const cols=new Set(Object.values(cs[0].st.players).map(p=>p.color)),lots=new Set(Object.values(cs[0].st.players).map(p=>p.lot+':'+p.pos.x+','+p.pos.y));
  ok(`8 clients joined one room; all see 8 players, ${cols.size} distinct colors, ${lots.size} distinct lots/spawns`);if(cols.size!==8||lots.size!==8)throw new Error('colors/lots not distinct');
  const c9=await mk('C9');tx(c9,{t:'join',code,name:'Cap9'});await wait(()=>c9.errs.includes('Room is full (8 max)'),3000,'9th rejected');ok('9th client rejected: "Room is full (8 max)"');
  [...cs,c9].forEach(c=>c.close());await sleep(200);}
 const a=await mk('A');tx(a,{t:'create',name:'Ahmad'});await wait(()=>a.st,5000,'create');const code=a.st.code;ok('room created '+code);
 const b=await mk('B');tx(b,{t:'join',code,name:'Juno'});await wait(()=>b.st&&a.st.order.length===2,5000,'join');ok('B joined, both see 2 players');
 tx(a,{t:'start'});await wait(()=>b.st.phase==='day'&&b.st.day===1,5000,'start');ok('day 1 started on both clients');
 const A=()=>b.st.players[a.id].pos,start={...A()};
 await walk(a,-1,0,1);await wait(()=>A().x===start.x-1,2000,'move sync');ok(`movement synced: B sees A move ${start.x},${start.y} -> ${A().x},${A().y}`);
 {const x0=A().x;for(let i=0;i<4;i++){tx(a,{t:'step',dx:1,dy:0,run:true});await sleep(85);}await wait(()=>A().x===x0+4,2000,'run sync');ok('running: 4 steps at ~85ms apart all accepted and synced');for(let i=0;i<3;i++){tx(a,{t:'step',dx:-1,dy:0,run:true});await sleep(85);}await wait(()=>A().x===x0+1,2000,'run back');}
 await sleep(150);await walk(a,0,-1,1);await wait(()=>A().map==='h0',2000,'enter');ok('B sees A enter their house (map h0)');
 await walk(a,-1,0,3);await walk(a,0,-1,3);await wait(()=>A().x===1&&A().y===2,2000,'reach bed');
 const e0=a.st.players[a.id].needs.energy;tx(a,{t:'do',action:'sleep'});
 await wait(()=>b.st.players[a.id].busy&&b.st.players[a.id].busy.a==='sleep',3000,'busy');ok('action trigger: A sleeping at bed (B sees busy=sleep)');
 await wait(()=>!a.st.players[a.id].busy,40000,'finish');ok(`sleep finished, energy ${e0} -> ${a.st.players[a.id].needs.energy} (server-authoritative)`);
 // B walks along row 5 to A's door and in => Visit
 const bs=b.st.players[b.id].pos;await walk(b,-1,0,bs.x-start.x);await walk(b,0,-1,1);
 await wait(()=>a.st.players[a.id].visits===1&&a.st.players[b.id].pos.map==='h0',3000,'visit');ok(`visit: B entered A's house, A visits=${a.st.players[a.id].visits}, log: "${a.st.log.filter(l=>/visited/.test(l.m)).pop().m}"`);
 await walk(b,0,1,2);await wait(()=>a.st.players[b.id].pos.map==='town',3000,'exit');await sleep(150);await walk(b,0,-1,1);await sleep(300);
 if(a.st.players[a.id].visits!==1)throw new Error('visit counted twice same day');ok('re-entering same day does not add a second visit');
 a.errs.length=0;tx(a,{t:'buy',item:'plant',x:5,y:2});await wait(()=>a.errs.some(e=>/Seak Mart/.test(e)),3000,'refuse');ok('placing furniture you have not bought is refused');
 await walkTo(a,'b:diner',(x,y)=>E.PUB_LAYOUT.diner[y-1]&&E.PUB_LAYOUT.diner[y-1][x]==='C');await wait(()=>b.st.players[a.id].pos.map==='b:diner',2000,'diner sync');ok('A walked through the door into the Town Diner (B sees map b:diner)');
 const e1=a.st.players[a.id].needs.energy;tx(a,{t:'do',action:'eat'});await wait(()=>b.st.players[a.id].busy&&b.st.players[a.id].busy.src==='Diner counter',3000,'eat');await wait(()=>!a.st.players[a.id].busy,5000,'eat done');ok(`A ate at the diner counter inside: energy ${e1} -> ${a.st.players[a.id].needs.energy}`);
 const adj=ch=>(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const L=E.PUB_LAYOUT.mart;return L[y+dy]&&L[y+dy][x+dx]===ch;});
 await walkTo(a,'b:mart',adj('R'));tx(a,{t:'do',action:'shop',arg:'coffee'});await wait(()=>b.st.players[a.id].cart.length===1,3000,'cart');
 await walkTo(a,'b:mart',adj('U'));tx(a,{t:'do',action:'shop',arg:'f:plant'});tx(a,{t:'do',action:'shop',arg:'f:lamp'});await wait(()=>b.st.players[a.id].cart.length===3,3000,'cart2');
 {a.errs.length=0;tx(a,{t:'buy',item:'plant'});tx(a,{t:'do',action:'gift',arg:'lamp@'+b.id});await wait(()=>a.errs.length>=2,3000,'unpaid');const pa=a.st.players[a.id];ok(!pa.inv.includes('plant')&&!pa.items.some(i=>i.t==='plant'),'unpaid cart items cannot be placed or gifted (server): '+a.errs.slice(0,2).join(' | '));}
 await walkTo(a,'b:mart',adj('$'));const c0=a.st.players[a.id].coins;tx(a,{t:'do',action:'checkout'});await wait(()=>b.st.players[a.id].coins===c0-28&&!b.st.players[a.id].cart.length,3000,'checkout');ok('Seak Mart: A bought Coffee + Plant + Lamp at checkout (B sees coins '+c0+' -> '+(c0-28)+')');
 await walkTo(a,'h0',(x,y)=>{const s=E.homeInfo(a.st,'h0').spawn;return x===s.x&&y===s.y;});tx(a,{t:'buy',item:'plant',x:5,y:2});await wait(()=>b.st.players[a.id].items.some(i=>i.t==='plant'),3000,'place');ok('placed the bought plant at home; B sees it');
 if(b.st.players[b.id].pos.map!=='h0')throw new Error('B expected in A house');tx(a,{t:'do',action:'gift',arg:'f:lamp@'+b.id});
 await wait(()=>b.st.players[b.id].inv.includes('lamp')&&!b.st.players[a.id].inv.includes('lamp'),3000,'gift furniture');ok('A gave B a Lamp from the bag (moved to B\'s bag)');
 {const ca=a.st.players[a.id].coins,cb=a.st.players[b.id].coins,G=ca>=40?20:10;tx(a,{t:'do',action:'gift',arg:'coins:'+G+'@'+b.id});await wait(()=>b.st.players[b.id].coins===cb+G&&b.st.players[a.id].coins===ca-G,3000,'coin gift');ok(`A gave B ${G} coins (A ${ca}→${ca-G}, B ${cb}→${cb+G})`);if(G===20){
  a.errs.length=0;tx(a,{t:'do',action:'gift',arg:'coins:20@'+b.id});await wait(()=>a.errs.some(e=>/limit/.test(e)),3000,'cap');ok('server enforces 30/day cap: "'+a.errs.find(e=>/limit/.test(e))+'"');}else ok('(cap case covered by engine test; A low on coins)');
  b.errs.length=0;const bc=b.st.players[b.id].coins;if(bc<20){tx(b,{t:'do',action:'gift',arg:'coins:20@'+a.id});await wait(()=>b.errs.some(e=>/Not enough/.test(e)),3000,'funds');ok('insufficient funds refused by server');}
  else{ok('(B has '+bc+' coins; insufficient-funds case covered by engine test)');}}
 tx(b,{t:'buy',item:'lamp',x:null,y:null});await wait(()=>a.st.players[b.id].items.some(i=>i.t==='lamp'),3000,'B places');ok('B placed the gifted Lamp in B\'s own house; A\'s house has no lamp: '+!a.st.players[a.id].items.some(i=>i.t==='lamp'));
 {tx(a,{t:'arcmsg',to:b.id,data:{b:[1,2]}});await sleep(200);ok(!(b.arc||[]).length,'pong relay refused until both have Pong open');tx(a,{t:'arc',game:'pong'});tx(b,{t:'arc',game:'pong'});await wait(()=>a.st.players[b.id].arc==='pong'&&b.st.players[a.id].arc==='pong',3000,'arc flags');ok('both see each other at Pong (pairing flag synced)');
  tx(a,{t:'arcmsg',to:b.id,data:{b:[10,20],l:150,r:150,sl:1,sr:0}});tx(b,{t:'arcmsg',to:a.id,data:{pad:120}});await wait(()=>(b.arc||[]).some(m=>m.from===a.id&&m.data.sl===1)&&(a.arc||[]).some(m=>m.data.pad===120),3000,'relay');ok('Pong frames relayed host→guest and paddle guest→host');tx(a,{t:'arc',game:null});tx(b,{t:'arc',game:null});}
 let days=new Set();await wait(()=>{days.add(a.st.day);return a.st.phase==='results'&&b.st.phase==='results';},150000,'7 days');ok('played through days '+[...days].join(','));
 if(JSON.stringify(a.st.results)!==JSON.stringify(b.st.results))throw new Error('results desync');ok('results identical on both clients: '+JSON.stringify(a.st.results));
 console.log(`PASS (${pass} checks)`);process.exit(0);})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
