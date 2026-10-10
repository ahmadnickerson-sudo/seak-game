const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http');
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9333','--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let tabs;for(let i=0;i<30;i++){try{tabs=await get('http://127.0.0.1:9333/json');break;}catch{await sleep(200);}}
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={};const errs=[];
 ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(JSON.stringify(m.params.args));});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 await cmd('Runtime.enable');await cmd('Page.enable');if(process.env.NO_STORAGE)await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})"});await cmd('Page.navigate',{url:require('url').pathToFileURL(require('path').join(__dirname,'index.html')).href});await sleep(1000);
 // real click on name field, type, then real click on Play Solo
 const box=async sel=>ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 const click=async([x,y])=>{for(const type of['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});};
 await click(await box('#soloBtn'));await sleep(300);
 console.log('after Play Solo:',JSON.stringify(await ev('__seak()')),'active:',await ev('document.activeElement.id||document.activeElement.tagName'));
 const key=async(k,code,vk)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk});await sleep(60);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk});await sleep(200);};
 const tests=[['w','KeyW',87],['s','KeyS',83],['a','KeyA',65],['d','KeyD',68],['ArrowUp','ArrowUp',38],['ArrowDown','ArrowDown',40],['ArrowLeft','ArrowLeft',37],['ArrowRight','ArrowRight',39],['w','',87],['s','',83],['A','',65],['D','',68]];
 let fails=0;for(const[k,c,vk]of tests){const a=await ev('JSON.stringify(__seak().pos)');await key(k,c,vk);const b=await ev('JSON.stringify(__seak().pos)');const moved=a!==b;if(!moved)fails++;console.log(`${moved?'✔':'✘'} key=${k} code=${c||'(empty)'}  ${a} -> ${b}`);}
 // Space/E should not re-click a focused button
 console.log('errors:',errs.length?errs:'none');console.log(fails?'FAIL':'PASS');ch.kill();process.exit(fails?1:0);})();
