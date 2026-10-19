// Free-aim test: server must use the continuous shoot angle (normalized), reject junk. PORT=4410 node test_aim.js
const WebSocket=require('./node_modules/ws');const PORT=process.env.PORT||4410;let fail=0;const ok=(n,c,d='')=>{console.log(c?'PASS':'FAIL',n,d);if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const ws=new WebSocket('ws://localhost:'+PORT);let st=null,id=null;ws.on('message',d=>{const m=JSON.parse(d);if(m.t==='welcome'){id=m.id;st=m.game}if(m.t==='state')st=m.game;});
await new Promise(r=>ws.on('open',r));ws.send(JSON.stringify({t:'create',name:'Aim'}));await sleep(2600);
const ang=[0.37,2.9,-3.0,0.05,1.234];
const DM=require('./shared.js');
for(const a of ang){const p0=st.players[id];if(!DM.clearLine(p0.x,p0.y,p0.x+Math.cos(a)*5,p0.y+Math.sin(a)*5,.05)){ok('skip blocked angle '+a+' (wall/tree within 5 tiles)',true);continue;}ws.send(JSON.stringify({t:'input',mx:0,my:0,angle:a,weapon:1}));await sleep(60);let seen=null;
 ws.send(JSON.stringify({t:'shoot',weapon:1,angle:a}));for(let i=0;i<10&&!seen;i++){await sleep(20);const b=st.bullets.find(b=>b.owner===id);if(b)seen=b;}
 if(!seen){ok('bullet at '+a,false,'none');continue;}const got=Math.atan2(seen.vy,seen.vx);ok('bullet angle '+a,Math.abs(Math.atan2(Math.sin(got-a),Math.cos(got-a)))<.05,got.toFixed(3));await sleep(500);}
ws.send(JSON.stringify({t:'shoot',weapon:1,angle:7.5}));await sleep(300);// wraps
ws.send(JSON.stringify({t:'shoot',weapon:1,angle:'junk'}));ws.send(JSON.stringify({t:'shoot',weapon:1,angle:1e300}));await sleep(300);
ok('junk angles do not crash server',ws.readyState===1&&st.bullets.every(b=>Number.isFinite(b.vx)&&Number.isFinite(b.vy)));
ws.close();process.exit(fail?1:0)})();
