// Browser test: every furniture item has true 4-direction art (no mirroring). Each rotation renders a distinct sprite,
// r2 is not a horizontal mirror of r0, front decals (screens/oven doors) hide when turned away, and the sprite stays inside its canvas.
const WebSocket=require('ws');const {spawn}=require('child_process');const http=require('http');
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--remote-debugging-port=9353','--window-size=1280,800','file://'+__dirname+'/index.html'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const get=u=>new Promise((r,j)=>http.get(u,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)));}).on('error',j));
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++;};
(async()=>{let tabs;for(let i=0;i<30;i++){try{tabs=await get('http://127.0.0.1:9353/json');break;}catch{await sleep(200);}}await sleep(1200);
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));let id=0;const pend={};
ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pend[m.id])pend[m.id](m);});
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const r=(await cmd('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const out={};const px=S=>S.cv.getContext('2d').getImageData(0,0,S.cv.width,S.cv.height);
 for(const k of Object.keys(SeakEngine.ITEMS)){const col=SeakEngine.ITEMS[k].col,d=[0,1,2,3].map(r=>px(__seakFurnSprite(k,col,r,40)));const W=d[0].width,H=d[0].height;
  const diff=(a,b,mir)=>{let n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(y*W+(mir?W-1-x:x))*4;if(Math.abs(a.data[i+3]-b.data[j+3])>40||Math.abs(a.data[i]-b.data[j])>40)n++;}return n;};
  const edge=a=>{let n=0;for(let x=0;x<W;x++){if(a.data[x*4+3]>20)n++;}return n;};
  out[k]={d01:diff(d[0],d[1]),d02:diff(d[0],d[2]),d13:diff(d[1],d[3]),m02:diff(d[0],d[2],true),ink:d.map(a=>{let n=0;for(let i=3;i<a.data.length;i+=4)if(a.data[i]>20)n++;return n;}),top:d.map(edge)};}
 const cy=c=>{let n=0;const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<a.length;i+=4)if(a[i]<30&&a[i+1]<30&&a[i+2]<30&&a[i+3]>200)n++;return n;};
 out.screen=[0,1,2,3].map(r=>cy(__seakFurnSprite('arcpong','#6f5cff',r,40).cv));return out;})()`})).result;
if(r.exceptionDetails){ok(false,'eval '+JSON.stringify(r.exceptionDetails).slice(0,400));}else{const o=r.result.value;
 for(const k of Object.keys(o)){if(k==='screen')continue;const v=o[k],sym=k==='plant'||k==='lamp'||k==='garden';
  ok(v.ink.every(n=>n>50),`${k}: all 4 rotations draw`);ok(v.top.every(n=>n===0),`${k}: sprite fits its canvas`);
  if(!sym){ok(v.d02>50,`${k}: back view (r2) differs from front (r0)`);ok(v.d01>50&&v.d13>50,`${k}: side views differ`);ok(v.m02>30,`${k}: back view is not a mirror of the front`);}}
 ok(o.screen[0]>20&&o.screen[1]>20,'Pong screen bezel visible from the front rotations');console.log('screen px',o.screen);ok(o.screen[2]<o.screen[0]*.6&&o.screen[3]<o.screen[0]*.6,'Pong screen hidden on back rotations (rear panel shown)');}
ch.kill();console.log(fails?`${fails} FAILED`:'ALL PASS');process.exit(fails?1:0);})();
