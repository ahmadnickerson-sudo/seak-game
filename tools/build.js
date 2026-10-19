// Regenerates shared.js from the original map engine embedded in index.html and injects it into index.html.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/)||html.match(/<script>([\s\S]*?Seak shared engine[\s\S]*?)<\/script>/);
const g={};new Function('globalThis','module',m[1].replace(/\}\)\(typeof globalThis.*$/,'})(globalThis)'))(g,undefined);
const T=g.SeakEngine.TOWN;
const data={w:g.SeakEngine.TW,h:g.SeakEngine.TH,g:T.g,houses:T.houses.map(h=>({x:h.x,y:h.y,w:h.w,h:h.h,door:h.door})),buildings:T.buildings.map(b=>({id:b.id,x:b.x,y:b.y,w:b.w,h:b.h,door:b.door}))};
// ---- Interiors enlarged to the ORIGINAL Seak interior sizes (HOME_TIERS.starter 7x6, villa 13x9, public PUB_LAYOUT 13x9 / 15x9 / 17x11 incl. walls) ----
const RECTS={houses:[[8,2,7,6,11,7],[24,2,7,6,27,7],[44,2,7,6,47,7],[8,38,7,6,11,38],[24,38,7,6,27,38],[44,38,7,6,47,38],[58,2,7,6,61,7],[58,38,7,6,61,38],[5,25,13,9,11,33]],
 buildings:{diner:[3,12,13,9,9,20],school:[17,12,15,9,24,20],office:[35,12,13,9,41,20],arcade:[50,25,13,9,56,33],mart:[48,11,17,11,56,21]}};
{const g=data.g.map(r=>r.split(''));for(const r of g)for(let i=0;i<r.length;i++)if('HBDP'.includes(r[i]))r[i]='.';
 const put=(x,y,w,h,ch)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)g[yy][xx]=ch;};
 data.houses=RECTS.houses.map(([x,y,w,h,dx,dy])=>{put(x,y,w,h,'H');return{x,y,w,h,door:{x:dx,y:dy}};});
 data.buildings=data.buildings.map(o=>{const [x,y,w,h,dx,dy]=RECTS.buildings[o.id];put(x,y,w,h,'B');return{id:o.id,x,y,w,h,door:{x:dx,y:dy}};});
 data.g=g.map(r=>r.join(''));}
const logic=fs.readFileSync(path.join(__dirname,'shared.logic.js'),'utf8');
const js=`(function(root,f){const m=f();if(typeof module!=='undefined'&&module.exports)module.exports=m;else root.DeadMap=m;})(this,function(){'use strict';\nconst DATA=${JSON.stringify(data)};\n${logic}\n});\n`;
fs.writeFileSync(path.join(root,'shared.js'),js);
const tag='<script id="deadmap">'+js+'</script>';
let out=html.replace(/<script id="deadmap">[\s\S]*?<\/script>/,()=>tag);
if(out===html&&!html.includes('id="deadmap"')){out=html.replace(/<script>\n?\(\(\)=>\{'use strict';\nconst E=window\.SeakEngine/,s=>tag+'\n'+s);}
if(!out.includes('id="deadmap"'))throw new Error('inject failed');
fs.writeFileSync(path.join(root,'index.html'),out);console.log('built',js.length);
