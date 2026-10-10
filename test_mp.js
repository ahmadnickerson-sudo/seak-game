// Headless multiplayer test. Run: SEAK_SPEED=0.06 node server.js  then  node test_mp.js
// Covers: create/join, movement sync between clients, an action trigger (Sleep at bed), a visit, full 7 days, synced results.
const WebSocket=require('ws');const URL='ws://localhost:'+(process.env.PORT||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mk=n=>new Promise(r=>{const ws=new WebSocket(URL);ws.st=null;ws.errs=[];ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome')ws.id=m.id;if(m.t==='state')ws.st=m.state;
 if(m.t==='pos'&&ws.st)for(const id in m.p){const[a,x,y,dir]=m.p[id];if(ws.st.players[id])ws.st.players[id].pos={map:a,x,y,dir};}if(m.t==='err'){ws.errs.push(m.msg);console.log(n,'err:',m.msg);}});ws.on('open',()=>r(ws));});
const wait=(f,ms=20000,what='')=>new Promise((r,j)=>{const t0=Date.now(),i=setInterval(()=>{if(f()){clearInterval(i);r();}else if(Date.now()-t0>ms){clearInterval(i);j(new Error('timeout: '+what));}},10);});
const tx=(ws,m)=>ws.send(JSON.stringify(m));
async function walk(ws,dx,dy,n){for(let i=0;i<n;i++){tx(ws,{t:'step',dx,dy});await sleep(120);}}
let pass=0;const ok=m=>{pass++;console.log('✔',m);};
(async()=>{const a=await mk('A');tx(a,{t:'create',name:'Ahmad'});await wait(()=>a.st,5000,'create');const code=a.st.code;ok('room created '+code);
 const b=await mk('B');tx(b,{t:'join',code,name:'Juno'});await wait(()=>b.st&&a.st.order.length===2,5000,'join');ok('B joined, both see 2 players');
 tx(a,{t:'start'});await wait(()=>b.st.phase==='day'&&b.st.day===1,5000,'start');ok('day 1 started on both clients');
 const A=()=>b.st.players[a.id].pos,start={...A()};
 await walk(a,-1,0,1);await wait(()=>A().x===start.x-1,2000,'move sync');ok(`movement synced: B sees A move ${start.x},${start.y} -> ${A().x},${A().y}`);
 await walk(a,1,0,1);await walk(a,0,-1,1);await wait(()=>A().map==='h0',2000,'enter');ok('B sees A enter their house (map h0)');
 await walk(a,-1,0,3);await walk(a,0,-1,3);await wait(()=>A().x===1&&A().y===2,2000,'reach bed');
 const e0=a.st.players[a.id].needs.energy;tx(a,{t:'do',action:'sleep'});
 await wait(()=>b.st.players[a.id].busy&&b.st.players[a.id].busy.a==='sleep',3000,'busy');ok('action trigger: A sleeping at bed (B sees busy=sleep)');
 await wait(()=>!a.st.players[a.id].busy,5000,'finish');ok(`sleep finished, energy ${e0} -> ${a.st.players[a.id].needs.energy} (server-authoritative)`);
 // B walks along row 5 to A's door and in => Visit
 const bs=b.st.players[b.id].pos;await walk(b,-1,0,bs.x-6);await walk(b,0,-1,1);
 await wait(()=>a.st.players[a.id].visits===1&&a.st.players[b.id].pos.map==='h0',3000,'visit');ok(`visit: B entered A's house, A visits=${a.st.players[a.id].visits}, log: "${a.st.log.filter(l=>/visited/.test(l.m)).pop().m}"`);
 await walk(b,0,1,1);await wait(()=>a.st.players[b.id].pos.map==='town',2000,'exit');await walk(b,0,-1,1);await sleep(300);
 if(a.st.players[a.id].visits!==1)throw new Error('visit counted twice same day');ok('re-entering same day does not add a second visit');
 tx(a,{t:'buy',item:'plant',x:5,y:2});await wait(()=>b.st.players[a.id].items.some(i=>i.t==='plant'),3000,'buy');ok('build synced: plant placed at (5,2)');
 let days=new Set();await wait(()=>{days.add(a.st.day);return a.st.phase==='results'&&b.st.phase==='results';},90000,'7 days');ok('played through days '+[...days].join(','));
 if(JSON.stringify(a.st.results)!==JSON.stringify(b.st.results))throw new Error('results desync');ok('results identical on both clients: '+JSON.stringify(a.st.results));
 console.log(`PASS (${pass} checks)`);process.exit(0);})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
