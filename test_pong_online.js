// Online 2-player Pong sync test. Run: SEAK_SPEED=0.5 node server.js  then  node test_pong_online.js
// Covers: challenge refused unless both have Pong open, server-authoritative match start, mirrored consistent state on both clients,
// a paddle move by one player showing up in the other's view, ball actually moving, and pongEnd when a player leaves.
const WebSocket=require('ws');const URL='ws://localhost:'+(process.env.PORT||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++;};
const mk=()=>new Promise(r=>{const ws=new WebSocket(URL);ws.errs=[];ws.pong=null;ws.ends=0;ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){ws.id=m.id;ws.code=m.code;}if(m.t==='state')ws.st=m.state;if(m.t==='err')ws.errs.push(m.msg);if(m.t==='pong')ws.pong=m;if(m.t==='pongEnd')ws.ends++;});ws.on('open',()=>r(ws));});
const wait=(f,ms=5000)=>new Promise(r=>{const t0=Date.now(),i=setInterval(()=>{if(f()||Date.now()-t0>ms){clearInterval(i);r(f());}},10);});
const tx=(ws,m)=>ws.send(JSON.stringify(m));
const http=require('http');const hget=u=>new Promise(r=>http.get(URL.replace('ws:','http:')+u,res=>{let n=0;res.on('data',c=>n+=c.length);res.on('end',()=>r({code:res.statusCode,type:res.headers['content-type'],n}));}));
(async()=>{{const b=await hget('/assets/furniture/bed.png');ok(b.code===200&&b.type==='image/png'&&b.n>1000,'server serves furniture art (static /assets/furniture)');const t=await hget('/assets/furniture/..%2f..%2fserver.js');ok(t.code===404,'no path traversal outside assets');}
 const a=await mk();tx(a,{t:'create',name:'Ann'});await wait(()=>a.code);const b=await mk();tx(b,{t:'join',code:a.code,name:'Bo'});await wait(()=>b.id&&a.st&&a.st.order.length===2);
 tx(a,{t:'arc',game:'pong'});await sleep(150);tx(a,{t:'pongChallenge',to:b.id});ok(await wait(()=>a.errs.length,1500),'challenge refused while opponent has no Pong open');ok(!a.pong&&!b.pong,'no match started');
 tx(b,{t:'arc',game:'pong'});await sleep(150);tx(a,{t:'pongChallenge',to:b.id});ok(await wait(()=>a.pong&&b.pong),'challenge starts a match; both clients get server state');
 ok(a.pong.you==='a'&&b.pong.you==='b'&&a.pong.opp==='Bo'&&b.pong.opp==='Ann','roles + opponent names');
 await sleep(100);const pa=a.pong,pb=b.pong;ok(Math.abs(pa.b[1]-pb.b[1])<40&&pa.sa===pb.sa&&pa.sb===pb.sb,'both clients see the same ball + score');
 const y0=a.pong.b[1];await sleep(300);ok(Math.abs(a.pong.b[1]-y0)>5,'ball is simulated by the server');
 tx(b,{t:'pongPad',x:60});await sleep(150);ok(Math.abs(a.pong.pb-240)<1,'b moves its paddle (own view x=60) → a sees top paddle at 240 (mirrored)');
 tx(a,{t:'pongPad',x:100});await sleep(150);ok(Math.abs(b.pong.pa-100)<1,'a moves its paddle → b receives it');
 tx(a,{t:'pongPad',x:9999});await sleep(150);ok(a.pong.pa===270,'paddle clamped');
 tx(b,{t:'arc',game:null});ok(await wait(()=>a.ends>0),'opponent leaving sends pongEnd (client falls back to CPU)');
 tx(b,{t:'arc',game:'pong'});await sleep(100);tx(b,{t:'pongChallenge',to:a.id});ok(await wait(()=>b.pong&&b.pong.you==='a'),'rematch possible after a match ends');
 a.close();ok(await wait(()=>b.ends>0),'disconnect sends pongEnd');b.close();
 console.log(fails?`${fails} FAILED`:'ALL PONG ONLINE TESTS PASSED');process.exit(fails?1:0);})();
