// Headless test: two clients join a room, play through 7 days at high speed, verify state stays in sync.
const WebSocket=require('ws');const URL='ws://localhost:'+(process.env.PORT||3000);
const mk=n=>new Promise(r=>{const ws=new WebSocket(URL);ws.st=null;ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome')ws.id=m.id;if(m.t==='state')ws.st=m.state;if(m.t==='err')console.log(n,'err:',m.msg);});ws.on('open',()=>r(ws));});
const wait=(f,ms=20000)=>new Promise((r,j)=>{const t0=Date.now(),i=setInterval(()=>{if(f()){clearInterval(i);r();}else if(Date.now()-t0>ms){clearInterval(i);j(new Error('timeout'));}},20);});
(async()=>{const a=await mk('A');a.send(JSON.stringify({t:'create',name:'Ahmad'}));await wait(()=>a.st);const code=a.st.code;console.log('room',code);
 const b=await mk('B');b.send(JSON.stringify({t:'join',code,name:'Agent'}));await wait(()=>b.st&&b.st.order.length===2&&a.st.order.length===2);console.log('both joined:',a.st.order.map(i=>a.st.players[i].name));
 a.send(JSON.stringify({t:'start'}));await wait(()=>b.st.phase==='plan'&&b.st.day===1);console.log('day 1 plan synced on B');
 for(let d=1;d<=7;d++){await wait(()=>a.st.phase==='plan'&&a.st.day===d&&b.st.phase==='plan'&&b.st.day===d);
  a.send(JSON.stringify({t:'act',action:d%2?'work':'eat'}));b.send(JSON.stringify({t:'act',action:'visit',target:a.id}));
  await wait(()=>b.st.players[a.id].action&&a.st.players[b.id].action==='visit');
  a.send(JSON.stringify({t:'ready'}));b.send(JSON.stringify({t:'ready'}));
  await wait(()=>a.st.phase==='build'&&b.st.phase==='build');a.send(JSON.stringify({t:'buy',item:'plant',cell:d}));
  await wait(()=>b.st.players[a.id].items.length>=1);
  await wait(()=>a.st.phase==='resolve'||a.st.phase==='results'||a.st.day>d);
  await wait(()=>JSON.stringify(a.st.players)===JSON.stringify(b.st.players));
  const pa=a.st.players[a.id];console.log(`day ${d} resolved & synced: A needs ${JSON.stringify(pa.needs)} coins ${pa.coins} visits ${pa.visits} items ${pa.items.length}`);}
 await wait(()=>a.st.phase==='results'&&b.st.phase==='results');console.log('RESULTS (synced):',JSON.stringify(b.st.results));
 if(JSON.stringify(a.st.results)!==JSON.stringify(b.st.results))throw new Error('desync');console.log('PASS');process.exit(0);})().catch(e=>{console.error('FAIL',e);process.exit(1);});
