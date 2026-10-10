// Engine unit test (no browser/server): AI games, public buildings, crowding, work mood drain, school & graduation, Pinky.
const fs=require('fs'),vm=require('vm');const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,ctx);const E=ctx.module.exports;
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
function walkTo(st,id,map,goalFn,now){for(let i=0;i<400;i++){const p=st.players[id];if(p.pos.map===map&&goalFn(p.pos.x,p.pos.y))return now;
 let fn;if(p.pos.map!==map){if(p.pos.map!=='town'){const d=p.pos.map[0]==='b'?{x:5,y:6}:{x:4,y:6};fn=(x,y)=>x===d.x&&y===d.y;}else{const d=E.doorOf(map);fn=(x,y)=>x===d.x&&y===d.y;}}else fn=goalFn;
 const n=E.nextStep(st,p.pos.map,p.pos.x,p.pos.y,fn);if(!n)throw new Error('no path');now+=200;E.step(st,id,n[0]-p.pos.x,n[1]-p.pos.y,now);}throw new Error('walk timeout');}
const nearSpot=(map,ch)=>{const L=E.PUB_LAYOUT[map.slice(2)];return(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>L[y+dy]&&L[y+dy][x+dx]===ch);};
// 1. AI-only games
for(let g=0;g<3;g++){const st=E.createState('X',{speed:1,seed:100+g});['Pinky (AI)','b','c','d'].forEach((n,i)=>E.addPlayer(st,'p'+i,n,true));let now=0;const t0=Date.now();E.startGame(st,now);const seen=new Set();while(st.phase==='day'){now+=50;E.tick(st,now);st.log.slice(-4).forEach(l=>seen.add(l.m));}
 const R=st.results.rows;const L=[...seen];ok(R.every(r=>r.happiness>20&&r.happiness<=100)&&R.some(r=>r.visits>0),`AI game ${g}: [happiness,visits,built] ${JSON.stringify(R.map(r=>[r.happiness,r.visits,r.built]))}, edu ${JSON.stringify(Object.values(st.players).map(p=>p.edu))}, ${Date.now()-t0}ms CPU`);
 if(g===0)ok(['Diner counter','Office desk','School desk','Arcade cabinet'].every(k=>L.some(m=>m.includes(k))),'AIs ate/worked/studied/played inside the walk-in buildings');}
// 2. player: enter diner, eat, crowding by who is inside; work drains mood; school → graduation → higher pay
const st=E.createState('X',{speed:1});E.addPlayer(st,'me','Ahmad');E.addPlayer(st,'pk','Pinky (AI)',true);E.addPlayer(st,'j','Juno (AI)',true);st.players.pk.ai=st.players.j.ai=false;let now=1000;E.startGame(st,now);
now=walkTo(st,'me','b:diner',nearSpot('b:diner','C'),now);ok(st.players.me.pos.map==='b:diner','walked through the door into the Town Diner');
st.players.pk.pos={map:'b:diner',x:8,y:5,dir:'up'};st.players.j.pos={map:'b:diner',x:9,y:5,dir:'up'};
ok(E.doAction(st,'me','eat',now)==='ok'&&st.players.me.busy.g.energy<10,'crowded diner (2 others inside) gives a smaller meal: +'+st.players.me.busy.g.energy+' Energy');now+=7000;E.tick(st,now);
now=walkTo(st,'me','b:office',nearSpot('b:office','W'),now);const m0=st.players.me.needs.mood,c0=st.players.me.coins;ok(E.doAction(st,'me','work',now)==='ok','Work at Office desk');now+=9000;E.tick(st,now);
const pay1=st.players.me.coins-c0;ok(st.players.me.needs.mood<m0,`Work drains Mood: ${m0} -> ${st.players.me.needs.mood}, paid ${pay1}`);
for(let d=0;d<3;d++){now=walkTo(st,'me','b:school',nearSpot('b:school','K'),now);ok(E.doAction(st,'me','study',now)==='ok',`study session ${d+1} (day ${st.day})`);
 if(d===0)ok(E.doAction(st,'me','study',now+9000)!=='ok','only one class per day');now+=9000;E.tick(st,now);st.dayEnd=now+1;now+=2;E.tick(st,now);st.dayEnd=now+150000;}
ok(st.players.me.edu===3,'graduated (edu 3/3)');now=walkTo(st,'me','b:office',nearSpot('b:office','W'),now);st.players.me.cd={};st.players.me.needs.energy=80;const c1=st.players.me.coins;E.doAction(st,'me','work',now);now+=9000;E.tick(st,now);
ok(st.players.me.coins-c1>pay1,`graduate pay ${st.players.me.coins-c1} > ${pay1}`);
// arcade
now=walkTo(st,'me','b:arcade',nearSpot('b:arcade','A'),now);ok(E.doAction(st,'me','play',now)==='ok','played at the Arcade building');now+=7000;E.tick(st,now);
// Pinky talk
st.players.pk.pos={...st.players.me.pos};st.players.pk.pos.x+=1;if(!E.walkable(st,st.players.me.pos.map,st.players.pk.pos.x,st.players.pk.pos.y))st.players.pk.pos.x-=2;
ok(E.actionsAt(st,'me')[0].action==='talk'&&E.doAction(st,'me','talk',now)==='ok'&&st.players.pk.say,'talk to Pinky: "'+(st.players.pk.say&&st.players.pk.say.text)+'"');
console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);
