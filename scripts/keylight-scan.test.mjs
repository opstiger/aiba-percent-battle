/* 主光灯位扫描台。跑:node scripts/keylight-scan.test.mjs
   为什么不能拍脑袋改灯位:v2.20 已经踩过一次 —— 背光 rim 从 y=7.5 压到 4.5,
   地板法线吃的余弦从 0.42 掉到 0.24,近处地板整整差了 30 个灰阶。灯位和地板亮度
   是强耦合的,肉眼只看"影子好看了"很容易顺手把地板拍黑。
   所以这里把候选灯位逐个套上去渲染,同时盯四个数:
     · 角色区 std    —— 明暗层次,自阴影有没有读出体积感(越高越好)
     · 角色区 mean   —— 不能为了层次把人拍黑(掉太多就是失败)
     · 地板区 mean   —— 上面那次踩坑的直接指标
     · 地板暗区占比  —— 影子铺开的面积,"落地感"来自影子的方向不是影子的存在
   三个数一起看才能判断,只看一个必然改坏。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch({args:["--mute-audio"]});break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}

const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.addInitScript(()=>{
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,a){
    if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
    return orig.call(this,t,a);
  };
});
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:20000,polling:"raf"});
await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:20000,polling:"raf"});

/* 候选灯位。[x,y,z] + 一句为什么试它。
   基准是当前的 (6.2,11.8,4.2);其余按俯角从保守到激进排。 */
const CANDIDATES=[
  {name:"当前 6.2/11.8/4.2 (46°俯角)",pos:[6.2,11.8,4.2]},
  {name:"   9 / 8.5 / 5.5 (30°)",pos:[9,8.5,5.5]},
  {name:"  10 / 7   / 6   (23°)",pos:[10,7,6]},
  {name:"  12 / 9   / 3   (侧更强)",pos:[12,9,3]},
  {name:"   8 / 6   / 7   (最低最斜)",pos:[8,6,7]}
];

const rows=await page.evaluate((cands)=>{
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  if(!gl)return [{error:"拿不到 webgl context"}];
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const grab=()=>{const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const g=AIBA.runtime.service("legacy");

  /* 角色屏幕包围盒。readPixels 原点左下、y 朝上;投影的 v.y 朝下,要翻。 */
  const box=new THREE.Box3().setFromObject(g.player.g);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(let i=0;i<8;i++){
    const v=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
    if(v.z>1)continue;
    const sx=(v.x*0.5+0.5)*W,py=(1-(0.5-v.y*0.5))*H;
    x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,py);y1=Math.max(y1,py);
  }
  const bx0=Math.max(0,Math.floor(x0)),bx1=Math.min(W-1,Math.ceil(x1));
  const by0=Math.max(0,Math.floor(y0)),by1=Math.min(H-1,Math.ceil(y1));

  const lum=(p,i)=>0.299*p[i*4]+0.587*p[i*4+1]+0.114*p[i*4+2];
  const regionStats=(p,ax0,ax1,ay0,ay1)=>{
    let n=0,s=0;const vals=[];
    for(let y=ay0;y<=ay1;y++)for(let x=ax0;x<=ax1;x++){const i=y*W+x;const l=lum(p,i);vals.push(l);s+=l;n++;}
    const mean=s/n;let v=0;for(const l of vals)v+=(l-mean)**2;
    return {mean,std:Math.sqrt(v/n),vals};
  };

  const out=[];
  for(const c of cands){
    spot.position.set(c.pos[0],c.pos[1],c.pos[2]);
    /* 灯位变了 shadow camera 要重算,否则阴影还按旧矩阵投 */
    spot.shadow.camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    const p=grab();

    const body=regionStats(p,bx0,bx1,by0,by1);
    /* 地板:画面下方 22%。首屏构图人物偏中上,这块基本是场地。
       用画面固定比例而不是投影球场坐标,省掉一次坐标换算也更稳。 */
    const floor=regionStats(p,0,W-1,0,Math.floor(H*0.22));
    /* 地板暗区占比:以该灯位下地板均值的 62% 为界,统计比它更暗的像素。
       阈值跟着均值走,避免"整体拍黑"被误读成"影子变多"。 */
    const thr=floor.mean*0.62;
    let dark=0;for(const l of floor.vals)if(l<thr)dark++;

    /* 俯角,便于对照 */
    const dx=spot.target.position.x-c.pos[0],dy=spot.target.position.y-c.pos[1],dz=spot.target.position.z-c.pos[2];
    const pitch=Math.atan2(Math.abs(dy),Math.hypot(dx,dz))*180/Math.PI;

    out.push({name:c.name,
      俯角:+pitch.toFixed(1),
      角色std:+body.std.toFixed(2),角色mean:+body.mean.toFixed(1),
      地板mean:+floor.mean.toFixed(1),地板暗区占比:+(dark/floor.vals.length*100).toFixed(2)});
  }
  return out;
},CANDIDATES);

/* 以当前灯位为基准算变化量,方便一眼看出"多换了什么、代价是什么" */
const base=rows.find(r=>r.name.startsWith("当前"));
console.log("灯位".padEnd(30),"俯角   角色std   角色mean   地板mean   地板暗区%");
for(const r of rows){
  if(r.error){console.log(r.error);continue;}
  const d=(k)=>{if(!base||r===base)return "";const v=r[k]-base[k];
    return (v>=0?"+":"")+v.toFixed(1);};
  console.log(
    r.name.padEnd(30),
    String(r.俯角).padStart(4),
    String(r.角色std).padStart(8),`(基准)`===r.name?"":`(${d("角色std")})`.padStart(9),
    String(r.角色mean).padStart(7),`(基准)`===r.name?"":`(${d("角色mean")})`.padStart(9),
    String(r.地板mean).padStart(7),`(基准)`===r.name?"":`(${d("地板mean")})`.padStart(9),
    String(r.地板暗区占比).padStart(8));
}
console.log(errs.length?"报错: "+errs[0]:"零报错");
await browser.close();server.close();
