// Regression tests for disconnect cleanup, exit orientation, and Seak Mart cart controls.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const c={module:{exports:{}},globalThis:{}};vm.runInNewContext(src,c);const E=c.module.exports;
function state(){const s=E.createState('T');E.addPlayer(s,'eli','Eli');E.addPlayer(s,'p7','Player 7');E.startGame(s,1000);return s;}
{
 const s=state();E.removePlayer(s,'eli');
 assert(!s.players.eli,'disconnected player is deleted');assert(!s.order.includes('eli'),'disconnected player removed from roster');
 E.tick(s,2000);assert(!s.players.eli,'no AI takeover survives ticks');console.log('PASS clean disconnect removes player and prevents ghost AI');
}
{
 const s=state();s.players.eli.ai=false;E.removePlayer(s,'eli');for(let t=1100;t<10000;t+=100)E.tick(s,t);
 assert(!s.players.eli,'full boot cannot convert Eli into AI');assert(!s.order.includes('eli'));console.log('PASS Eli full-boot regression: no AI takeover');
}
{
 const s=state();const id='p7';E.removePlayer(s,id);assert(!s.players[id]);assert(!s.order.includes(id));assert(!Object.values(s.players).some(p=>p.name==='Player 7 (AI)'));console.log('PASS Player 7 split-world regression: disconnect does not leave parallel ghost');
}
{
 const s=E.createState('EXIT');E.addPlayer(s,'p','P');E.startGame(s,1000);
 // Test each public building exit using the interior EXIT tile and town-side facing.
 for(const b of E.TOWN.buildings){
   const p=s.players.p,info=E.pubInfo(b.id),L=E.PUB_LAYOUT[b.id],x=info.door.x,y=info.door.y;
   const adj={x,y:y-1};p.pos={map:'b:'+b.id,x:adj.x,y:adj.y,dir:'down'};
   E.step(s,'p',0,1,3000+E.TOWN.buildings.indexOf(b)*200);
   assert.equal(p.pos.map,'town',`${b.id} exits to town`);
   assert.equal(p.pos.dir,b.exit.y<b.door.y?'up':'down',`${b.id} faces away from entrance`);
 }
 console.log('PASS public building exit orientation');
}
{
 const s=E.createState('C');E.addPlayer(s,'p','P');E.startGame(s,1000);const p=s.players.p;
 p.pos={map:'b:mart',x:4,y:4,dir:'up'};p.cart=['coffee','coffee','f:couch'];
 assert.equal(E.doAction(s,'p','unshop',1100,'coffee'),'ok');assert.deepEqual(Array.from(p.cart),['coffee','f:couch']);
 assert.equal(E.doAction(s,'p','clearcart',1200,null),'ok');assert.equal(p.cart.length,0);
 p.pos={map:'town',x:1,y:1,dir:'up'};assert.notEqual(E.doAction(s,'p','unshop',1300,'coffee'),'ok','server validates cart removal against actual contents');
 console.log('PASS cart remove-one and clear-cart actions');
}
