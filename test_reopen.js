// Reopen test: persistent Chrome profile, open file, Play Solo, move, close browser, reopen (same file, a renamed copy, and reload mid-game).
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http'),fs=require('fs'),path=require('path'),url=require('url'),os=require('os');
const PROFILE=fs.mkdtempSync(path.join(os.tmpdir(),'seak-prof-'));const FILE=path.join(__dirname,'index.html');const COPY=path.join(os.tmpdir(),'index (1).html');fs.copyFileSync(FILE,COPY);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
let fails=0;const check=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
async function session(fileUrl,fn){const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9334','--user-data-dir='+PROFILE,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
 let tabs;for(let i=0;i<40;i++){try{tabs=await get('http://127.0.0.1:9334/json');break;}catch{await sleep(200);}}
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={},errs=[];
 ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push(JSON.stringify(m.params.args));});
 const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
 const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true})).result.result.value;
 await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Page.navigate',{url:fileUrl});await sleep(900);
 const api={cmd,ev,errs,shot:async f=>{const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(f,Buffer.from(r.result.data,'base64'));},
  menuVisible:()=>ev(`(()=>{const m=document.getElementById('menu'),g=document.getElementById('game');return (m.offsetHeight>0&&getComputedStyle(m).display!=='none')||(g.offsetHeight>0&&getComputedStyle(g).display!=='none')})()`),
  key:async(k,code)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await sleep(60);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code});await sleep(200);}};
 try{await fn(api);}finally{try{await cmd('Browser.close');}catch{}ch.kill();await sleep(800);}}
(async()=>{const U=url.pathToFileURL(FILE).href;
 await session(U,async a=>{check(await a.menuVisible(),'first open: start screen visible');await a.ev("document.getElementById('nameIn').value='Ahmad'");await a.ev("document.getElementById('soloBtn').click()");await sleep(300);
  const p0=await a.ev('JSON.stringify(__seak().pos)');await a.key('a','KeyA');const p1=await a.ev('JSON.stringify(__seak().pos)');check(p0!==p1,'played: moved '+p0+' -> '+p1);
  await a.cmd('Page.reload');await sleep(900);check(await a.menuVisible(),'reload mid-game: page not blank');await a.shot(path.join(__dirname,'screens','reopen_reload.png'));check(!a.errs.length,'no console errors (session 1): '+JSON.stringify(a.errs));});
 await session(U,async a=>{check(await a.menuVisible(),'reopen same file after closing browser: start screen visible');check(await a.ev("document.getElementById('nameIn').value")==='Ahmad','saved name restored');
  await a.shot(path.join(__dirname,'screens','reopen.png'));await a.ev("document.getElementById('soloBtn').click()");await sleep(300);const p0=await a.ev('JSON.stringify(__seak().pos)');await a.key('d','KeyD');check(p0!==await a.ev('JSON.stringify(__seak().pos)'),'reopened game playable');check(!a.errs.length,'no console errors (reopen): '+JSON.stringify(a.errs));});
 await session(url.pathToFileURL(COPY).href,async a=>{check(await a.menuVisible(),'renamed copy "index (1).html": start screen visible');check(!a.errs.length,'no console errors (copy)');});
 // corrupt saved data
 await session(U,async a=>{await a.ev("localStorage.setItem('seakName','\\u0000'.repeat(5000));localStorage.setItem('seakSave','{broken')");await a.cmd('Page.reload');await sleep(900);check(await a.menuVisible(),'garbage in localStorage: start screen visible');check(!a.errs.length,'no console errors (bad data)');});
 console.log(fails?'FAIL':'PASS');process.exit(fails?1:0);})();
