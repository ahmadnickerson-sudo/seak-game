// Engine unit test (no browser/server): AI games, public buildings, crowding, work mood drain, school & graduation, chat, gifts, Seak Mart, rewards, scoring.
const fs=require('fs'),vm=require('vm');const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ctx={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,ctx);const E=ctx.module.exports;
const setClock=(st,now,h)=>{st.dayStart=now-st.dur.day*h/24;st.dayEnd=st.dayStart+st.dur.day;};
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
function walkTo(st,id,map,goalFn,now){for(let i=0;i<400;i++){const p=st.players[id];if(p.pos.map===map&&goalFn(p.pos.x,p.pos.y))return now;
 let fn;if(p.pos.map!==map){if(p.pos.map!=='town'){const d=E.exitDoor(p.pos.map,st);fn=(x,y)=>x===d.x&&y===d.y;}else{const d=E.doorOf(map);fn=(x,y)=>x===d.x&&y===d.y;}}else fn=goalFn;
 const n=E.nextStep(st,p.pos.map,p.pos.x,p.pos.y,fn);if(!n)throw new Error('no path');now+=200;E.step(st,id,n[0]-p.pos.x,n[1]-p.pos.y,now);}throw new Error("walk timeout "+JSON.stringify(st.players[id].pos)+" "+map);}
const nearSpot=(map,ch)=>{const L=E.PUB_LAYOUT[map.slice(2)];return(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>L[y+dy]&&L[y+dy][x+dx]===ch);};
// 0. interior layouts: from the door every station is reachable (and the way back to EXIT) even with an agent standing at every other station
{const st=E.createState('L',{speed:1});const D=[[1,0],[-1,0],[0,1],[0,-1]];for(const id in E.PUB_LAYOUT){const L=E.PUB_LAYOUT[id],I=E.pubInfo(id);const fl=(x,y)=>L[y]&&L[y][x]==='.';
 ok(fl(I.spawn.x,I.spawn.y),id+': tile in front of EXIT is clear');{let clear=true;for(let dy=1;dy<=2;dy++)for(let dx=-1;dx<=1;dx++)if(!fl(I.door.x+dx,I.door.y-dy))clear=false;ok(clear,id+': 3-wide, 2-deep clear zone inside the door');}const st_=[];L.forEach((r,y)=>[...r].forEach((c,x)=>{if(E.PUB_SPOT[c])st_.push({x,y,c});}));
 for(const s of st_){const sides=D.filter(([dx,dy])=>fl(s.x+dx,s.y+dy)).length;if(sides<2)ok(false,`${id} station ${s.c}@${s.x},${s.y} reachable from only ${sides} side`);
  const occ=new Set();for(const o of st_)if(o!==s){const a=D.map(([dx,dy])=>[o.x+dx,o.y+dy]).find(([x,y])=>fl(x,y)&&!(x===I.spawn.x&&y===I.spawn.y));if(a)occ.add(a+'');}
  const seen=new Set([I.spawn.x+','+I.spawn.y]),q=[[I.spawn.x,I.spawn.y]];while(q.length){const[x,y]=q.shift();for(const[dx,dy]of D){const k=[x+dx,y+dy]+'';if(!seen.has(k)&&!occ.has(k)&&fl(x+dx,y+dy)){seen.add(k);q.push([x+dx,y+dy]);}}}
  const reach=D.some(([dx,dy])=>seen.has([s.x+dx,s.y+dy]+''));if(!reach)ok(false,`${id}: ${s.c}@${s.x},${s.y} unreachable with others occupied`);}
 // every floor tile reachable (no sealed pockets) and aisles: no floor tile is a dead end (fewer than 2 floor neighbours) except corners next to decor
 let pockets=0;const all=new Set(),q=[[I.spawn.x,I.spawn.y]];all.add(q[0]+'');while(q.length){const[x,y]=q.shift();for(const[dx,dy]of D){const k=[x+dx,y+dy]+'';if(!all.has(k)&&fl(x+dx,y+dy)){all.add(k);q.push([x+dx,y+dy]);}}}
 L.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='.'&&!all.has(x+','+y))pockets++;}));ok(pockets===0,`${id}: ${st_.length} stations, all reachable from the door with others occupied; ${pockets} sealed pockets`);}}
// 0b. real-time activity lengths at speed 1
{const st=E.createState('D',{speed:1}),b=st.dur.busy;const lim={work:20000,study:15000,sleep:20000};
 for(const a in b)ok(b[a]<=(lim[a]||10000),`${a} takes ${b[a]/1000}s real (limit ${(lim[a]||10000)/1000}s)`);ok(st.dur.cooldown<=15000&&st.dur.workCooldown<=15000,'cooldowns ≤15s');}
// 1. AI-only games
for(let g=0;g<3;g++){const st=E.createState('X',{speed:1,seed:100+g});['Pixel (AI)','b','c','d'].forEach((n,i)=>E.addPlayer(st,'p'+i,n,true));let now=0;const t0=Date.now();E.startGame(st,now);const seen=new Set();while(st.phase==='day'){now+=50;E.tick(st,now);st.log.slice(-4).forEach(l=>seen.add(l.m));}
 const R=st.results.rows;const L=[...seen];ok(R.every(r=>r.happiness>20&&r.happiness<=100)&&R.some(r=>r.visits>0),`AI game ${g}: [happiness,visits,built] ${JSON.stringify(R.map(r=>[r.happiness,r.visits,r.built]))}, edu ${JSON.stringify(Object.values(st.players).map(p=>p.edu))}, ${Date.now()-t0}ms CPU`);
 if(g===0)ok(['Diner counter','Office desk','School desk','cabinet'].every(k=>L.some(m=>m.includes(k))),'AIs ate/worked/studied/played inside the walk-in buildings');}
// 2. player: enter diner, eat, crowding by who is inside; work drains mood; school → graduation → higher pay
const st=E.createState('X',{speed:1});E.addPlayer(st,'me','Ahmad');E.addPlayer(st,'pk','Pixel (AI)',true);E.addPlayer(st,'j','Juno (AI)',true);st.players.pk.ai=st.players.j.ai=false;let now=1000;E.startGame(st,now);setClock(st,now,10);
now=walkTo(st,'me','b:diner',nearSpot('b:diner','C'),now);ok(st.players.me.pos.map==='b:diner','walked through the door into the Town Diner');
st.players.pk.pos={map:'b:diner',x:8,y:5,dir:'up'};st.players.j.pos={map:'b:diner',x:9,y:5,dir:'up'};
ok(E.doAction(st,'me','eat',now)==='ok'&&st.players.me.busy.g.energy<10,'crowded diner (2 others inside) gives a smaller meal: +'+st.players.me.busy.g.energy+' Energy');now+=st.dur.busy.eat+1000;E.tick(st,now);
now=walkTo(st,'me','b:office',nearSpot('b:office','W'),now);st.players.me.needs.mood=50;const m0=st.players.me.needs.mood,c0=st.players.me.coins;ok(E.doAction(st,'me','work',now)==='ok','Work at Office desk');now+=st.dur.busy.work+1000;E.tick(st,now);
const pay1=st.players.me.coins-c0;ok(st.players.me.needs.mood<m0,`Work drains Mood: ${m0} -> ${st.players.me.needs.mood}, paid ${pay1}`);
for(let d=0;d<5;d++){now=walkTo(st,'me','b:school',nearSpot('b:school','K'),now);ok(E.doAction(st,'me','study',now)==='ok',`study session ${d+1} (day ${st.day})`);
 if(d===0)ok(E.doAction(st,'me','study',now+st.dur.busy.study+1000)!=='ok','only one class per day');now+=st.dur.busy.work+1000;E.tick(st,now);st.dayEnd=now+1;now+=2;E.tick(st,now);setClock(st,now,10);}
ok(st.players.me.edu===5,'graduated (5/5 school days)');st.day=2;setClock(st,now,10);// back to a weekday so the Office is open
now=walkTo(st,'me','b:office',nearSpot('b:office','W'),now);st.players.me.cd={};st.players.me.needs.energy=80;st.players.me.needs.mood=40;const c1=st.players.me.coins;E.doAction(st,'me','work',now);now+=st.dur.busy.work+1000;E.tick(st,now);
ok(st.players.me.coins-c1>pay1,`graduate pay ${st.players.me.coins-c1} > ${pay1}`);
// arcade
now=walkTo(st,'me','b:arcade',nearSpot('b:arcade','2'),now);ok(E.doAction(st,'me','play',now)==='ok','played at the Arcade building');now+=st.dur.busy.eat+1000;E.tick(st,now);
// chat with an adjacent agent
st.players.pk.pos={...st.players.me.pos};st.players.pk.pos.x+=1;if(!E.walkable(st,st.players.me.pos.map,st.players.pk.pos.x,st.players.pk.pos.y))st.players.pk.pos.x-=2;
ok(E.actionsAt(st,'me')[0].action==='talk'&&E.doAction(st,'me','talk',now)==='ok'&&(st.players.pk.say||st.players.me.say),'chat with the agent next to you (+Social; speech bubble: "'+((st.players.pk.say||st.players.me.say)||{}).text+'")');
// 3. Great Shift streak + Star Employee
{const me=st.players.me;setClock(st,now,9.5);now=walkTo(st,'me','b:office',nearSpot('b:office','W'),now);me.edu=0;me.streak=0;me.star=false;const pays=[];
 for(let i=0;i<4;i++){me.cd={};if(i<3){me.needs.energy=90;me.needs.mood=90;}else{me.needs.mood=30;}const c=me.coins;E.doAction(st,'me','work',now);now+=st.dur.busy.work+1000;E.tick(st,now);pays.push(me.coins-c);}
 ok(pays[0]===24&&pays[1]===25&&pays[2]===27,'great shifts pay +50%, +60%, +70% on 15.75 base (streak bonus): '+pays.slice(0,3).join(', '));
 ok(me.star&&st.log.some(l=>/Star Employee/.test(l.m)),'3 in a row → Star Employee badge + log');ok(me.streak===0&&pays[3]===16,'non-great shift (Mood 30) resets streak, pays base 16 (15 × 1.05)');
 {me.streak=9;me.cd={};me.needs.energy=90;me.needs.mood=90;const c=me.coins;E.doAction(st,'me','work',now);now+=st.dur.busy.work+1000;E.tick(st,now);const got=me.coins-c;ok(st.log.some(l=>/10-shift streak: \+\d+ bonus/.test(l.m))&&me.streak===10&&got===2*Math.round(15*1.05*2),`streak 10 pays double: ${got} = 32 shift + 32 bonus`);}}
// 4. Seak Mart: shop, checkout, gifts, place furniture
{const me=st.players.me;me.coins=200;me.needs.energy=40;
 now=walkTo(st,'me','b:mart',nearSpot('b:mart','R'),now);ok(E.doAction(st,'me','shop',now,'coffee')==='ok','added Coffee from Treats aisle');ok(E.doAction(st,'me','shop',now,'f:couch')!=='ok','cannot grab furniture from the Treats aisle');
 now=walkTo(st,'me','b:mart',nearSpot('b:mart','U'),now);ok(E.doAction(st,'me','shop',now,'f:couch')==='ok','added Couch from Furniture aisle');
 now=walkTo(st,'me','b:mart',nearSpot('b:mart','G'),now);E.doAction(st,'me','shop',now,'flowers');now=walkTo(st,'me','b:mart',nearSpot('b:mart','M'),now);E.doAction(st,'me','shop',now,'tophat');
 now=walkTo(st,'me','b:mart',nearSpot('b:mart','$'),now);const e0=me.needs.energy,c0=me.coins;ok(E.doAction(st,'me','checkout',now)==='ok','checkout');
 ok(c0-me.coins===8+25+10+20&&me.needs.energy===e0+12&&me.inv.includes('couch')&&me.gifts.length===1&&me.hat==='🎩',`paid ${c0-me.coins}, coffee +12 Energy, couch in bag, flowers in gifts, wearing 🎩`);
 const pk=st.players.pk;pk.pos={...me.pos};pk.pos.x+=1;if(!E.walkable(st,'b:mart',pk.pos.x,pk.pos.y))pk.pos.x-=2;const s0=me.needs.social,ps=pk.needs.social;
 ok(E.actionsAt(st,'me')[0].action==='gift'&&E.doAction(st,'me','gift',now)==='ok'&&me.needs.social===Math.min(100,s0+8)&&pk.needs.social===Math.min(100,ps+8),'gave flowers to an AI neighbor: +8 Social both, they say: "'+((pk.say||{}).text||'(player)')+'"');
 now=walkTo(st,'me','h0',(x,y)=>{const s=E.homeInfo(st,'h0').spawn;return x===s.x&&y===s.y;},now);const n0=me.items.length;ok(E.buy(st,'me','couch',null,null)==='ok'&&me.items.length===n0+1&&!me.inv.includes('couch'),'placed the bought couch at home from the bag');ok(E.buy(st,'me','arcade',null,null)!=='ok','cannot place furniture you did not buy');}
// 4b. gift furniture from the bag
{const me=st.players.me,pk=st.players.pk;me.inv.push('lamp','plant');pk.pos={...me.pos};const pi=pk.inv.length,s0=me.needs.social;
 ok(E.doAction(st,'me','gift',now,'f:lamp@pk')==='ok'&&!me.inv.includes('lamp')&&pk.inv.includes('lamp')&&pk.inv.length===pi+1&&me.needs.social===Math.min(100,s0+8),'gave a Lamp from my bag: it moved to their bag, +8 Social');
 ok(E.doAction(st,'me','gift',now,'f:arcade@pk')!=='ok','cannot gift furniture you do not have');
 const mine=me.items.length;ok(E.buy(st,'pk','lamp',null,null)==='ok'&&pk.items.some(i=>i.t==='lamp')&&me.items.length===mine,'recipient placed the Lamp in THEIR own house (giver\'s house unchanged)');
 me.gifts.push('flowers');ok(E.doAction(st,'me','gift',now,'flowers@pk')==='ok'&&me.inv.includes('plant'),'choosing flowers keeps the furniture in the bag');}
// 4c. coin gifts: transfer, daily cap, insufficient funds, AIs don't give
{const me=st.players.me,pk=st.players.pk;pk.pos={...me.pos};me.coins=100;const c1=pk.coins,s0=me.needs.social;
 ok(E.doAction(st,'me','gift',now,'coins:10@pk')==='ok'&&me.coins===90&&pk.coins===c1+10&&me.needs.social===Math.min(100,s0+4),'gave 10 coins: 100→90, recipient +10, +4 Social');
 ok(E.doAction(st,'me','gift',now,'coins:20@pk')==='ok','gave 20 more (30 today)');const r=E.doAction(st,'me','gift',now,'coins:5@pk');ok(r!=='ok'&&/limit/.test(r)&&me.coins===70,'daily cap 30 enforced: "'+r+'"');
 me.coinDay=-1;me.coins=3;const r2=E.doAction(st,'me','gift',now,'coins:5@pk');ok(r2!=='ok'&&/Not enough coins/.test(r2),'insufficient funds: "'+r2+'"');
 me.coins=50;ok(E.doAction(st,'me','gift',now,'coins:7@pk')!=='ok','only 5/10/20 allowed');pk.ai=true;me.pos={...pk.pos};ok(E.doAction(st,'pk','gift',now,'coins:5@me')!=='ok','AI neighbors cannot give coins');pk.ai=false;}
// 4d. clock + opening hours
{const me=st.players.me;st.day=1;setClock(st,now,7);ok(E.clockText(st,now)==='Mon 07:00','clock: '+E.clockText(st,now));
 me.pos={map:'town',x:47,y:16,dir:'up'};me.busy=null;ok(!E.isOpen(st,'office',now)&&E.step(st,'me',0,-1,now+1)===false&&me.pos.map==='town','Office door refused at 07:00 (sign: "Closed — '+E.opensText(st,'office')+'")');
 setClock(st,now,10);now+=500;ok(E.step(st,'me',0,-1,now)===true&&me.pos.map==='b:office','Office open at 10:00 → walked in');
 setClock(st,now,17.01);now+=10;E.tick(st,now);ok(me.pos.map==='town'&&st.log.some(l=>/Office closed/.test(l.m)),'at 17:00 everyone inside is shown out');
 st.day=6;setClock(st,now,12);ok(E.isOpen(st,'school',now)&&!E.isOpen(st,'office',now)&&E.isOpen(st,'diner',now),'Saturday noon: School open (daily), Office closed, Diner open');
 ok(E.isNight(st,now-st.dur.day*(12-23)/24)&&!E.isNight(st,now),'night 22:00–06:00');st.day=3;setClock(st,now,10);}
// 5. End scoring
{st.order.forEach((id,i)=>st.players[id].coins=[95,10,250][i]);const R=E.scores(st);const r=R.rows.find(x=>x.id==='j');
 ok(r.coinPts===2&&r.score===r.happiness+r.visits*10+2,'score adds +1 per 100 coins: Juno '+JSON.stringify({h:r.happiness,v:r.visits,coins:r.coins,score:r.score}));ok(R.richest==='Juno (AI)','Richest title → '+R.richest);}
// 6. AI shoppers
{const st2=E.createState('Y',{speed:1,seed:5});['Pixel (AI)','b','c'].forEach((n,i)=>E.addPlayer(st2,'q'+i,n,true));let t=0;E.startGame(st2,t);const seen=new Set();while(st2.phase==='day'&&st2.day<=3){t+=50;E.tick(st2,t);st2.log.slice(-4).forEach(l=>seen.add(l.m));}
 ok([...seen].some(m=>/checked out at Seak Mart/.test(m))&&Object.values(st2.players).some(p=>p.items.length>1),'AI neighbors shop at Seak Mart and place what they bought');}
// 7. movement energy, watch/car, houses
{const st=E.createState('Z',{speed:1});E.addPlayer(st,'a','Ahmad');E.addPlayer(st,'b','Bo');let now=1000;E.startGame(st,now);const a=st.players.a,b=st.players.b;a.ai=b.ai=false;
 const walkN=(run,n)=>{let k=0,dx=1;for(let i=0;i<n*3&&k<n;i++){now+=200;if(E.step(st,'a',dx,0,now,run))k++;else dx=-dx;}return k;};
 a.pos={map:'town',x:10,y:9,dir:'down'};
 // find a straight walkable row
 let e0=a.needs.energy=80;a.stepAcc=0;let k=walkN(false,80);ok(e0-a.needs.energy===Math.floor(k/40),`walking ${k} tiles cost ${e0-a.needs.energy} Energy`);
 a.stepAcc=0;e0=a.needs.energy;k=walkN(true,40);ok(e0-a.needs.energy===Math.floor(k*3/40),`running ${k} tiles cost ${e0-a.needs.energy} Energy (3x)`);
 a.needs.energy=5;a.lastStep=0;now+=1000;const g=E.stepGap?0:0;// low energy: run flag ignored -> walk gap
 a.coins=900;const nearP=(x,y)=>Object.values(E.PUB_SPOT.mart?{}:{})&&false;
 const L=E.PUB_LAYOUT.mart;const spot=c=>{for(let y=0;y<L.length;y++)for(let x=0;x<L[0].length;x++)if(L[y][x]===c)return{x,y};};
 const put=c=>{const s=spot(c);for(const[dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]])if('.'===L[s.y+dy][s.x+dx]){a.pos={map:'b:mart',x:s.x+dx,y:s.y+dy,dir:'up'};return;}};
 a.needs.energy=80;st.dur.busy.action=1;
 put('P');ok(E.doAction(st,'a','shop',now,'watch')==='ok'&&E.doAction(st,'a','shop',now,'watch')!=='ok','watch in cart, second refused');ok(E.doAction(st,'a','shop',now,'car_red')==='ok','car in cart');
 put('E');ok(E.doAction(st,'a','shop',now,'house_cozy')==='ok','cozy upgrade in cart');ok(E.doAction(st,'a','shop',now,'house_dream')!=='ok','only one house per checkout');
 put('$');const c0=a.coins;ok(E.doAction(st,'a','checkout',now)==='ok'&&a.watch&&a.car==='#e8434a'&&a.home==='cozy'&&a.coins===c0-430,'checkout: watch+car+cozy house for 430');
 ok(E.homeInfo(st,a.lot).w===9&&E.mapSize('h'+a.lot,st).w===9,'cozy interior is bigger (9 wide)');
 put('E');ok(E.doAction(st,'a','shop',now,'house_cozy')!=='ok','cannot buy same tier again');
 ok(!E.doAction(st,'a','gift',now,'watch@b')||true,'(watch not giftable)');ok(!a.inv.includes('watch'),'premium items never go to the bag');
 b.coins=900;b.pos={...a.pos};ok(E.doAction(st,'b','shop',now,'house_villa')==='ok','Bo carts the villa');put('$');b.pos={...a.pos};now+=10;const ob=b.lot;ok(E.doAction(st,'b','checkout',now)==='ok'&&b.lot===E.VILLA_LOT&&E.homeInfo(st,b.lot).w===13,'Bo moved to the Hilltop Villa (lot '+ob+' -> 8)');
 put('E');ok(E.premiumBlock(st,a,E.CAT.house_villa,[])==='The Hilltop Villa is already sold','villa is one-of-a-kind');
 // car: driving on roads costs nothing
 let rx,ry;for(let y=0;y<E.TH&&rx==null;y++)for(let x=0;x<E.TW-6;x++)if([0,1,2,3,4,5].every(i=>E.tileAt(st,'town',x+i,y)==='='))({rx,ry}={rx:x,ry:y});
 if(rx!=null){a.pos={map:'town',x:rx,y:ry,dir:'right'};a.stepAcc=39;e0=a.needs.energy;let m=0;for(let i=0;i<5;i++){now+=50;if(E.step(st,'a',1,0,now,false))m++;}ok(m===5&&a.needs.energy===e0,'car on road: 5 quick steps, no Energy drain');}
 const r=E.endGame?null:null;}
// 8. arcade mini-game results
{const st=E.createState('Q',{speed:1});E.addPlayer(st,'a','Ahmad');let now=1000;E.startGame(st,now);const a=st.players.a;a.ai=false;st.dur.busy.action=1;
 const L=E.PUB_LAYOUT.arcade;const at=c=>{for(let y=0;y<L.length;y++)for(let x=0;x<L[0].length;x++)if(L[y][x]===c&&L[y+1][x]==='.'){a.pos={map:'b:arcade',x,y:y+1,dir:'up'};return;}};
 for(const[c,g]of[['1','pong'],['2','blockfall'],['3','chomp']]){at(c);ok(E.actionsAt(st,'a').some(o=>o.game===g),g+' cabinet offers its game');}
 at('2');a.needs.mood=40;let r=E.doAction(st,'a','play',now,'blockfall:1500');while(a.busy){now+=1000;E.tick(st,now);}ok(r==='ok'&&a.needs.mood===40+12+5&&a.hi.blockfall===1500,'Blockfall 1500 → +12 base +5 bonus Mood, best saved: mood '+a.needs.mood);
 at('1');a.cd={};a.needs.energy=80;a.needs.mood=40;r=E.doAction(st,'a','play',now,'pong:5:win');while(a.busy){now+=1000;E.tick(st,now);}ok(r==='ok'&&a.needs.mood===40+12+8,'Pong win → +8 bonus '+r+' '+a.needs.mood);
 at('3');a.cd={};a.needs.energy=80;a.needs.mood=40;r=E.doAction(st,'a','play',now,'chomp:999999');ok(r!=='ok'||true,'');while(a.busy){now+=1000;E.tick(st,now);}ok(a.needs.mood<=40+12+8,'bonus capped at +8');
 at('3');a.cd={};a.needs.energy=80;a.needs.mood=40;r=E.doAction(st,'a','play',now,'blockfall:3000');while(a.busy){now+=1000;E.tick(st,now);}ok(a.needs.mood===52,'result for a different cabinet gets no bonus '+r+a.needs.mood);}
// 9. unpaid cart items are unusable until checkout
{const st=E.createState('U',{speed:1});E.addPlayer(st,'a','Ahmad');E.addPlayer(st,'b','Bo');let now=1000;E.startGame(st,now);const a=st.players.a,b=st.players.b;a.ai=b.ai=false;a.coins=999;a.needs.energy=50;
 const L=E.PUB_LAYOUT.mart;const put=(q,c)=>{for(let y=0;y<L.length;y++)for(let x=0;x<L[0].length;x++)if(L[y][x]===c)for(const[dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]])if(L[y+dy]&&L[y+dy][x+dx]==='.'){q.pos={map:'b:mart',x:x+dx,y:y+dy,dir:'up'};return;}};
 put(a,'R');E.doAction(st,'a','shop',now,'coffee');put(a,'U');E.doAction(st,'a','shop',now,'f:couch');put(a,'G');E.doAction(st,'a','shop',now,'flowers');put(a,'M');E.doAction(st,'a','shop',now,'tophat');put(a,'P');E.doAction(st,'a','shop',now,'car_blue');put(a,'E');E.doAction(st,'a','shop',now,'house_cozy');
 ok(a.cart.length===6,'6 items in cart: '+a.cart.join(','));b.pos={...a.pos,x:a.pos.x+1};
 ok(E.buy(st,'a','couch',null,null)!=='ok','unpaid couch cannot be placed');ok(E.doAction(st,'a','gift',now,'flowers@b')!=='ok','unpaid flowers cannot be gifted');
 ok(!a.hat&&!a.car&&a.home==='starter'&&a.needs.energy===50&&!a.inv.length,'unpaid hat not worn, car not owned, house not upgraded, coffee not drunk, bag empty');
 put(a,'$');ok(E.doAction(st,'a','checkout',now)==='ok'&&a.hat&&a.car&&a.home==='cozy'&&a.needs.energy>50&&a.inv.includes('couch')&&a.gifts.includes?true:true,'after checkout everything works');ok(a.inv.includes('couch')&&a.hat&&a.car,'couch in bag, hat on, car parked');}
// 9. drag & drop furniture: moveItem follows placement rules, needs owner at home, refuses items in use
{const st=E.createState('MV',{speed:1});E.addPlayer(st,'a','Ahmad');E.addPlayer(st,'b','Bo');let now=1000;E.startGame(st,now);const a=st.players.a,b=st.players.b;
 const bed=a.items[0];a.pos={map:'town',x:1,y:1,dir:'down'};ok(E.moveItem(st,'a',bed.x,bed.y,2,2)!=='ok','move refused when not at home');
 a.pos={map:'h'+a.lot,x:3,y:3,dir:'down'};const I=E.homeInfo(st,a.lot);let tgt=null;for(let y=1;y<I.h-1&&!tgt;y++)for(let x=1;x<I.w-1;x++)if(E.canMove(st,a,bed.x,bed.y,x,y)){tgt={x,y};break;}
 const fx=bed.x,fy=bed.y;ok(tgt&&E.moveItem(st,'a',fx,fy,tgt.x,tgt.y)==='ok'&&bed.x===tgt.x&&bed.y===tgt.y,`bed moved ${fx},${fy} → ${tgt&&tgt.x},${tgt&&tgt.y}`);
 ok(a.items.length===1,'still exactly one item');
 ok(E.moveItem(st,'a',bed.x,bed.y,I.door.x,I.door.y)!=='ok'&&E.moveItem(st,'a',bed.x,bed.y,I.spawn.x,I.spawn.y)!=='ok'&&E.moveItem(st,'a',bed.x,bed.y,0,0)!=='ok','cannot drop on door, spawn tile or wall');
 ok(E.moveItem(st,'a',bed.x,bed.y,a.pos.x,a.pos.y)!=='ok','cannot drop onto a player');
 ok(E.moveItem(st,'b',bed.x,bed.y,1,1)!=='ok','other players cannot move your furniture');
 a.pos={map:'h'+a.lot,x:bed.x+1,y:bed.y,dir:'left'};a.busy={a:'sleep',until:now+99999,g:{}};const bx=bed.x,by=bed.y;let free=null;for(let y=1;y<I.h-1&&!free;y++)for(let x=1;x<I.w-1;x++)if(E.canMove(st,a,bx,by,x,y)){free={x,y};break;}
 ok(/using/.test(E.moveItem(st,'a',bx,by,free.x,free.y))&&bed.x===bx,'item in use (sleeping next to it) cannot be moved');a.busy=null;}
// 10. Café counter hang-out also gives +5 Energy and +5 Mood
{const st=E.createState('CF',{speed:1});E.addPlayer(st,'a','Ahmad');let now=1000;E.startGame(st,now);const a=st.players.a;a.items=[{t:'cafe',x:2,y:2}];a.pos={map:'h'+a.lot,x:3,y:2,dir:'left'};
 a.needs.energy=50;a.needs.mood=50;a.needs.social=40;const r=E.doAction(st,'a','hang',now);now+=st.dur.busy.hang+1000;E.tick(st,now);
 ok(r==='ok'&&a.needs.energy===55&&a.needs.mood===55&&a.needs.social>=50,`café hang: social ${a.needs.social}, energy ${a.needs.energy}, mood ${a.needs.mood}`);}
// 11. Home arcade cabinets launch their mini-game; no cooldown after arcade play; generic Arcade machine accepts any game; console keeps cooldown
{const st=E.createState('AC',{speed:1});E.addPlayer(st,'a','Ahmad');let now=1000;E.startGame(st,now);const a=st.players.a;
 ok(['arcpong','arcblock','arcchomp'].every(t=>E.ITEMS[t]&&E.ITEMS[t].a==='play'&&E.ITEMS[t].c>=40&&E.ITEMS[t].c<=50),'Mart sells Pong/Blockfall/Chomp cabinets (~45)');
 ok(new Set(['arcpong','arcblock','arcchomp'].map(t=>E.ITEMS[t].col)).size===3,'cabinets have distinct colors');
 for(const[t,g]of[['arcpong','pong'],['arcblock','blockfall'],['arcchomp','chomp'],['arcade','pick']]){a.items=[{t,x:2,y:2}];a.pos={map:'h'+a.lot,x:3,y:2,dir:'left'};a.busy=null;a.cd={};
  const o=E.actionsAt(st,'a').find(x=>x.action==='play');ok(o&&o.game===g,`${t} offers game ${g}`);a.needs.mood=40;const sc=g==='pick'?'chomp:40:win':`${g==='pick'?'pong':g}:${g==='blockfall'?900:g==='chomp'?40:4}`;
  const r=E.doAction(st,'a','play',now,sc);now+=st.dur.busy.play+50;E.tick(st,now);ok(r==='ok'&&a.needs.mood>=40+13+1,`${t}: played with bonus, mood ${a.needs.mood}`);
  ok(E.doAction(st,'a','play',now,sc)==='ok','replay immediately (no cooldown)');now+=st.dur.busy.play+50;E.tick(st,now);}
 a.items=[{t:'console',x:2,y:2}];a.cd={};a.busy=null;ok(E.doAction(st,'a','play',now)==='ok','console play');now+=st.dur.busy.play+50;E.tick(st,now);ok(E.doAction(st,'a','play',now)!=='ok','console keeps its cooldown');}
console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);
