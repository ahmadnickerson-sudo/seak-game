const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http');
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9344','--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let tabs;for(let i=0;i<30;i++){try{tabs=await get('http://127.0.0.1:9344/json');break;}catch{await sleep(200);}}
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={};const errs=[];
 ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(JSON.stringify(m.params.args));});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 await cmd('Runtime.enable');await cmd('Page.enable');if(process.env.NO_STORAGE)await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})"});await cmd('Page.navigate',{url:require('url').pathToFileURL(require('path').join(__dirname,'index.html')).href});await sleep(1000);
 const box=async sel=>ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 const click=async([x,y])=>{for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});};
 const key=async(k,code,vk)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk});await sleep(40);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk});await sleep(60);};
 await click(await box('#soloBtn'));await sleep(400);let fails=0;const ok=(c,m)=>{if(!c)fails++;console.log((c?'✔ ':'✘ ')+m);};
 const shot=async n=>{const r=await cmd('Page.captureScreenshot',{format:'png'});require('fs').writeFileSync('screens/'+n,Buffer.from(r.result.data,'base64'));};
 for(const[c,game,run]of[['2','blockfall','drop'],['3','chomp','move'],['1','pong','move']]){
  await ev(`(()=>{const B=__seakBridge,st=B.st,p=st.players[B.me];const L=SeakEngine.PUB_LAYOUT.arcade;for(let y=0;y<L.length;y++)for(let x=0;x<L[0].length;x++)if(L[y][x]==='${c}'&&L[y+1][x]==='.'){p.pos={map:'b:arcade',x,y:y+1,dir:'up'};p.busy=null;p.cd={};p.needs.energy=80;p.needs.mood=40;st.rev++;return;}})()`);await sleep(300);
  await key('e','KeyE',69);await sleep(300);{const v=await ev("SeakArcade.isOpen()+'|'+document.getElementById('arcOv').style.display");ok(v==='true|flex',game+': E at its cabinet opens the mini-game '+v);}
  const pos0=await ev('JSON.stringify(__seak().pos)');
  if(run==='drop'){for(let i=0;i<40&&await ev('SeakArcade.isOpen()&&!SeakArcade._cur().over');i++)await key(' ','Space',32);ok(await ev('!SeakArcade.isOpen()||SeakArcade._cur().over'),'blockfall: hard drops stack up to a top-out');await shot('arcade_blockfall.png');await sleep(2200);}
  else{for(const k of[['ArrowLeft','ArrowLeft',37],['ArrowUp','ArrowUp',38],['ArrowRight','ArrowRight',39]]){await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k[0],code:k[1],windowsVirtualKeyCode:k[2]});await sleep(500);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k[0],code:k[1],windowsVirtualKeyCode:k[2]});}
   if(game==='chomp')ok(await ev('SeakArcade._cur()._dots.size<SeakArcade._cur()._total-1||SeakArcade._cur()._me.x!==7'),'chomp: arrows move the chomper and eat dots');
   await shot('arcade_'+game+'.png');ok(pos0===await ev('JSON.stringify(__seak().pos)'),game+': arrow keys do not walk the agent while the game is open');await key('Escape','Escape',27);await sleep(300);}
  ok(!await ev('SeakArcade.isOpen()'),game+': game closed');const last=await ev('window.__arcLast');ok(new RegExp('^'+game+':\\d+').test(last||''),game+': result sent '+last);
  await sleep(200);ok(await ev(`(()=>{const p=__seakBridge.st.players[__seakBridge.me];return p.busy&&p.busy.a==='play'})()`),game+': agent is now playing (Mood reward pending)');}
 console.log('errors:',errs.length?errs:'none');if(errs.length)fails++;console.log(fails?'FAIL':'PASS');ch.kill();process.exit(fails?1:0);})();
