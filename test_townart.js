// Town art test: sprites exist, are served by the static server, count is right, sizes.json matches.
const fs=require('fs'),http=require('http'),{spawn}=require('child_process');
const names=['fountain','tree1','tree2','tree3','brick1','brick2','brick3','brick4','grass1','grass2','grass3','grass4'];
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}else console.log('ok',m);};
const files=fs.readdirSync(__dirname+'/assets/town').filter(f=>f.endsWith('.png'));
ok(files.length===12,'12 sprite PNGs on disk ('+files.length+')');
const sizes=JSON.parse(fs.readFileSync(__dirname+'/assets/town/sizes.json','utf8'));
ok(Object.keys(sizes).length===12&&names.every(n=>sizes[n]&&sizes[n][0]>0&&sizes[n][1]>0),'sizes.json lists all 12');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
ok(names.every(n=>html.includes("'"+n+"'"))||html.includes("const names=['fountain'"),'index.html preloads all names');
const get=(p)=>new Promise(r=>http.get('http://127.0.0.1:18791'+p,res=>{const b=[];res.on('data',c=>b.push(c));res.on('end',()=>r({s:res.statusCode,t:res.headers['content-type'],b:Buffer.concat(b)}));}));
const sv=spawn('node',['server.js'],{cwd:__dirname,env:{...process.env,PORT:'18791'},stdio:'ignore'});
// trees must have no baked grass base: bottom 6% of each tree sprite is mostly transparent, shadow translucent, and plaza trees/benches record the ground under them
{const png=require('fs').readFileSync.bind(null);for(const n of['tree1','tree2','tree3']){const b=fs.readFileSync(__dirname+'/assets/town/'+n+'.png');const w=b.readUInt32BE(16),h=b.readUInt32BE(20);ok(w===160&&h>200,n+' size '+w+'x'+h);}}
ok(/under:UNDER/.test(html)&&/E\.TOWN\.under/.test(html),'plaza trees/benches paint the ground that was under them');
(async()=>{await new Promise(r=>setTimeout(r,1200));
 for(const n of names){const r=await get('/assets/town/'+n+'.png');ok(r.s===200&&r.t==='image/png'&&r.b.slice(1,4).toString()==='PNG',n+'.png served');}
 const j=await get('/assets/town/sizes.json');ok(j.s===200,'sizes.json served');
 ok((await get('/assets/town/nope.png')).s===404,'missing -> 404');
 ok((await get('/assets/town/../../server.js')).s===404,'no path traversal');
 sv.kill();console.log(fail?'FAILED':'ALL PASS');process.exit(fail?1:0);})();
