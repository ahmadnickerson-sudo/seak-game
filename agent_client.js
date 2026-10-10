#!/usr/bin/env node
// Seak headless agent bridge: lets an external agent (or a script) play as a normal player.
// Usage: node agent_client.js <inviteURL e.g. https://host/?room=ABCD> <name> [--auto]
// Then type commands on stdin (one per line). Events are printed as JSON lines on stdout.
//   status                      -> prints your needs/coins/position/actions
//   go <place>                  -> walk there: diner | office | school | arcade | mart | plaza | home | house <player> | <x>,<y> (town tile)
//   do <action> [arg]           -> act at the spot you're next to: sleep eat work play hang study talk checkout | shop <item key e.g. coffee, f:couch>
//   do gift <item> <player>     -> give flowers|plush|f:<furniture>|coins:5|coins:10|coins:20 to an adjacent player/agent
//   say <text>                  -> speech bubble above your agent (shown to everyone, max 80 chars)
//   run on|off                  -> run (~1.8x faster steps) or walk
//   place <item>                -> place a bought furniture item inside your house (auto tile)
//   start                       -> start the game (host only matters; anyone may press start)
//   auto on|off                 -> simple autopilot: keep needs up (sleep/eat/play/hang/work)
//   quit
const WebSocket=require('ws'),vm=require('vm'),readline=require('readline');
const [,,link,nameArg,...flags]=process.argv;
if(!link){console.error('usage: node agent_client.js <inviteURL> <name> [--auto]');process.exit(2);}
const U=new URL(link),code=(U.searchParams.get('room')||'').toUpperCase(),name=(nameArg||U.searchParams.get('name')||'Agent').slice(0,12);
if(!/^[A-Z]{4}$/.test(code)){console.error('invite URL must contain ?room=CODE');process.exit(2);}
const out=o=>console.log(JSON.stringify(o));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let running=false,E,ws,me=null,st=null,auto=flags.includes('--auto'),queue=Promise.resolve(),walking=0;
async function loadEngine(){const html=await (await fetch(U.origin+'/')).text();const src=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];const c={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,c);return c.module.exports;}
const send=m=>ws&&ws.readyState===1&&ws.send(JSON.stringify(m));
const P=()=>st&&st.players[me];
function goalFor(place){const t=String(place||'').trim().toLowerCase();const pub={diner:'C',office:'W',school:'K',arcade:'2',mart:'$'};
 if(pub[t]){const map='b:'+t,L=E.PUB_LAYOUT[t],ch=pub[t];return{map,fn:(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>L[y+dy]&&L[y+dy][x+dx]===ch)};}
 if(t==='plaza'){const sp=E.TOWN.spots.filter(s=>s.place==='plaza');return{map:'town',fn:(x,y)=>sp.some(s=>Math.abs(s.x-x)+Math.abs(s.y-y)===1)};}
 if(t==='home'||t==='bed'){const p=P(),bed=p.items.find(i=>i.t==='bed')||{x:1,y:1};return{map:'h'+p.lot,fn:(x,y)=>Math.abs(x-bed.x)+Math.abs(y-bed.y)===1};}
 if(t.startsWith('house ')){const who=t.slice(6);const q=Object.values(st.players).find(q=>q.name.toLowerCase().startsWith(who));if(!q)return null;return{map:'h'+q.lot,fn:(x,y)=>{const s=E.homeInfo(st,q.lot).spawn;return x===s.x&&y===s.y;}};}
 const m=t.match(/^(\d+)\s*,\s*(\d+)$/);if(m)return{map:'town',fn:(x,y)=>x===+m[1]&&y===+m[2]};return null;}
async function walkTo(place){const g=goalFor(place);if(!g){out({ev:'error',msg:'unknown place '+place});return false;}walking++;
 try{for(let i=0;i<400;i++){const p=P();if(!p||st.phase!=='day'){await sleep(300);continue;}if(p.busy){await sleep(200);continue;}const q=p.pos;
  if(q.map===g.map&&g.fn(q.x,q.y)){out({ev:'arrived',place,pos:q});return true;}
  let fn;if(q.map!==g.map){if(q.map!=='town'){const d=E.exitDoor(q.map,st);fn=(x,y)=>x===d.x&&y===d.y;}else{const d=E.doorOf(g.map);fn=(x,y)=>x===d.x&&y===d.y;}}else fn=g.fn;
  const n=E.nextStep(st,q.map,q.x,q.y,fn);if(!n){out({ev:'error',msg:'no path to '+place});return false;}
  const before=JSON.stringify(q);send({t:'step',dx:n[0]-q.x,dy:n[1]-q.y});
  const t0=Date.now();for(let k=0;k<40&&JSON.stringify(P().pos)===before;k++)await sleep(running?10:50);const gap=(running?83:150)-(Date.now()-t0);if(gap>0)await sleep(gap);}
  out({ev:'error',msg:'walk timed out'});return false;}finally{walking--;}}
async function doAct(a,arg,who){if(a==='gift'&&who){const q=Object.values(st.players).find(q=>q.name.toLowerCase().startsWith(who.toLowerCase()));if(!q){out({ev:'error',msg:'no player named '+who});return;}arg=(arg||'')+'@'+q.id;}
 send({t:'do',action:a,arg:arg||null});await sleep(300);const p=P();out({ev:'did',action:a,busy:p&&p.busy?p.busy.a:null});}
async function autopilot(){while(true){await sleep(500);if(!auto||walking||!P()||st.phase!=='day'||P().busy)continue;const p=P(),n=p.needs;
 let plan=n.energy<40?['home','sleep']:p.coins<25?['office','work']:n.energy<60?['diner','eat']:n.mood<=n.social?['arcade','play']:['plaza','hang'];
 if(p.cd&&p.cd[plan[1]]>Date.now())plan=['diner','eat'];out({ev:'auto',plan});if(await walkTo(plan[0]))await doAct(plan[1]);}}
function handle(line){const [cmd,...rest]=line.trim().split(/\s+/);const arg=rest.join(' ');
 const job={status:async()=>{const p=P();out({ev:'status',phase:st&&st.phase,day:st&&st.day,me:p&&{name:p.name,pos:p.pos,needs:p.needs,coins:p.coins,visits:p.visits,edu:p.edu,streak:p.streak,inv:p.inv,gifts:p.gifts,busy:p.busy&&p.busy.a},actions:p?E.actionsAt(st,me).map(a=>a.action+(a.aisle?':'+a.aisle:'')+(a.target?':'+a.target:'')):[]});},
  go:()=>walkTo(arg),do:()=>doAct(rest[0],rest[1],rest.slice(2).join(' ')),say:async()=>send({t:'say',text:arg}),run:async()=>{running=rest[0]!=='off';out({ev:'run',on:running});},
  place:async()=>send({t:'buy',item:rest[0],x:null,y:null}),start:async()=>send({t:'start'}),auto:async()=>{auto=rest[0]!=='off';out({ev:'auto',on:auto});},quit:async()=>process.exit(0)}[cmd];
 if(!job){if(cmd)out({ev:'error',msg:'unknown command '+cmd});return;}queue=queue.then(job).catch(e=>out({ev:'error',msg:String(e)}));}
(async()=>{E=await loadEngine();ws=new WebSocket((U.protocol==='https:'?'wss://':'ws://')+U.host);
 ws.on('open',()=>send({t:'join',code,name}));ws.on('close',()=>{out({ev:'closed'});process.exit(1);});
 ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){me=m.id;out({ev:'joined',code:m.code,id:me,name});}
  else if(m.t==='err')out({ev:'error',msg:m.msg});
  else if(m.t==='state'){const prev=st;st=m.state;const L=st.log;if(prev&&L.length)L.slice(-3).forEach(l=>{if(!prev.log.some(x=>x.m===l.m))out({ev:'log',msg:l.m});});}
  else if(m.t==='pos'&&st)for(const id in m.p){const q=st.players[id];if(q){const[a,x,y,dir]=m.p[id];q.pos={map:a,x,y,dir};}}});
 readline.createInterface({input:process.stdin}).on('line',handle);autopilot();})().catch(e=>{out({ev:'error',msg:String(e)});process.exit(1);});
