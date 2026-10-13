// Appearance sync test (needs the server): PORT=3100 SEAK_SPEED=0.01 node server.js, then PORT=3100 node test_appearance.js
// Host joins with a chosen look, a guest with a bogus look, an old client with none: everyone sees the same validated looks.
const WebSocket=require('ws');const PORT=process.env.PORT||3100;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
function client(){const ws=new WebSocket('ws://127.0.0.1:'+PORT);const c={ws,st:null,id:null,code:null,err:null};ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')c.st=m.state;if(m.t==='welcome'){c.id=m.id;c.code=m.code;}if(m.t==='err'||m.t==='error')c.err=m;});c.open=new Promise(r=>ws.on('open',r));return c;}
(async()=>{const fs=require('fs'),vm=require('vm');const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];const cx={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,cx);const E=cx.module.exports;
 const want={hair:'bun',hairCol:'#d1495b',skin:'#8d5a37',outfit:'#1fbfbf',acc:'glasses'};
 const a=client();await a.open;a.ws.send(JSON.stringify({t:'create',name:'Host',look:want}));for(let i=0;i<50&&!a.code;i++)await sleep(50);ok(!!a.code,'room created '+a.code);
 const b=client();await b.open;b.ws.send(JSON.stringify({t:'join',code:a.code,name:'Hacker',look:{hair:'<img onerror=1>',skin:'red',outfit:'#1fbfbf',acc:'crown',extra:'x'.repeat(5000)}}));
 const c=client();await c.open;c.ws.send(JSON.stringify({t:'join',code:a.code,name:'Oldie'}));
 a.ws.send(JSON.stringify({t:'bot'}));await sleep(600);
 const S=a.st,SB=b.st;ok(S&&SB&&S.order.length===4,'4 players in room');
 const pa=S.players[a.id],pb=S.players[b.id],pc=S.players[c.id],bot=S.order.map(i=>S.players[i]).find(p=>p.ai);
 ok(JSON.stringify(pa.look)===JSON.stringify(want),'host look kept exactly '+JSON.stringify(pa.look));
 ok(pb.look.hair!=='<img onerror=1>'&&E.LOOK.hair.includes(pb.look.hair)&&E.LOOK.skin.includes(pb.look.skin)&&pb.look.acc==='none'&&pb.look.outfit==='#1fbfbf'&&!('extra' in pb.look),'bogus look sanitized (valid fields kept, bad ones defaulted) '+JSON.stringify(pb.look));
 ok(pc.look&&Object.keys(pc.look).every(k=>E.LOOK[k].includes(pc.look[k])),'old client without look gets a valid default '+JSON.stringify(pc.look));
 ok(bot&&bot.look&&E.LOOK.hair.includes(bot.look.hair),'server AI bot has a look');
 ok(JSON.stringify(SB.players[a.id].look)===JSON.stringify(want)&&JSON.stringify(c.st.players[b.id].look)===JSON.stringify(pb.look),'every client sees the same looks');
 // engine: solo AI signatures distinct
 const st=E.createState('S');E.addPlayer(st,'me','Me',false,want);['Pixel','Juno','Byte'].forEach((n,i)=>E.addPlayer(st,'ai'+i,n+' (AI)',true));const L=['ai0','ai1','ai2'].map(i=>JSON.stringify(st.players[i].look));
 ok(new Set(L).size===3&&L[0]===JSON.stringify(E.AI_LOOKS.Pixel)&&L[2]===JSON.stringify(E.AI_LOOKS.Byte),'Pixel, Juno, Byte have their own signature looks');
 [a,b,c].forEach(x=>x.ws.close());console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})();
