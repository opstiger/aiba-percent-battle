/* 头发支点验收台。跑:node scripts/hair-check.test.mjs

   验的是**模型坐标**,不是视觉估计。
   背景:原来 hairGrp 直接挂 headRoot,pivot 落在 (0,0,0)(≈脚底),
   而发块在 y≈1.785 —— 力臂约等于身高,仅 3° 就让发冠横移约 8cm(穿头主因)。

   本脚本做两件事:
   ① 实测:在真实角色上施加 motion.js 用的最大摆角,测发块的**世界坐标位移**。
   ② 对照:用同样公式算出"若 pivot 仍在脚底"会位移多少,两者并列,
      好让"改了多少"是可核对的数字,而不是"看起来好了"。

   判据:贴头皮层(hairBase)必须为 0;外层/末端应在毫米~1cm 量级。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){if(e.code==="EISDIR"){rs.writeHead(204);return rs.end();}rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
const ARGS=["--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding"];
let b=null;for(const m of mods()){try{b=await m.chromium.launch({args:ARGS});break;}catch(e){}}
if(!b){console.error("需要 Playwright");process.exit(2);}
const page=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
page.on("pageerror",e=>console.log("pageerror: "+String(e).slice(0,160)));
await page.addInitScript(()=>{
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,a){
    if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
    return orig.call(this,t,a);
  };
});
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=1`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
try{
  await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:90000,polling:"raf"});
  await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:90000,polling:"raf"});
}catch(e){console.log("!! 开场未启动");await page.close();await b.close();server.close();process.exit(2);}

const r=await page.evaluate(()=>{
  const guy=(typeof player!=="undefined")?player:null;
  if(!guy)return {error:"拿不到 player"};
  /* motion.js 实际使用的最大摆角:
     跑步 runSpring≈-0.038 → hairPivot.rotation.z=runSpring*1.8≈-0.0684 rad(3.92°)
     末端 hairTail 系数 1.3 → 约 -0.0889 rad(5.09°) */
  const SWAY=-0.038*1.8, TAIL_Z=-0.038*1.8*0.45, TAIL_X=-0.038*1.8*0.62;
  const V=THREE.Vector3;
  const worldOf=(obj)=>{const v=new V();obj.getWorldPosition(v);return v;};
  /* 收集三层各自的代表发块(取该层第一个子对象) */
  const pick=(grp)=>grp&&grp.children&&grp.children.length?grp.children[0]:null;
  const sample=(label)=>{
    const out={};
    const layers=[["hairBase",guy.hairBase],["hairGrp(外层)",guy.hairGrp],["hairTail",guy.hairTail]];
    for(const [n,grp] of layers){
      const m=pick(grp);
      if(!m){out[n]=null;continue;}
      const p0=worldOf(m);
      out[n]={x:+p0.x.toFixed(4),y:+p0.y.toFixed(4),z:+p0.z.toFixed(4)};
    }
    return out;
  };
  /* 遍历**所有**发型(含女性 long),确认分层覆盖没有漏掉某一种 */
  const STYLES=["buzz","afro","cornrows","ponytail","bun","flattop","short","fade","long"];
  const all={};
  for(const style of STYLES){
    if(typeof setHair==="function")setHair(guy,style,0x222222);
    scene.updateMatrixWorld(true);
    const layers=[["base",guy.hairBase],["sway",guy.hairGrp],["tail",guy.hairTail]];
    if(guy.hairPivot)guy.hairPivot.rotation.set(0,0,0);
    if(guy.hairTail)guy.hairTail.rotation.set(0,0,0);
    scene.updateMatrixWorld(true);
    const rest={};
    for(const [n,grp] of layers){
      const m=grp&&grp.children&&grp.children.length?grp.children[0]:null;
      rest[n]=m?worldOf(m):null;
    }
    if(guy.hairPivot)guy.hairPivot.rotation.z=SWAY;
    if(guy.hairTail){guy.hairTail.rotation.z=TAIL_Z;guy.hairTail.rotation.x=TAIL_X;}
    scene.updateMatrixWorld(true);
    const moved={};
    for(const [n,grp] of layers){
      const m=grp&&grp.children&&grp.children.length?grp.children[0]:null;
      moved[n]=m?worldOf(m):null;
    }
    if(guy.hairPivot)guy.hairPivot.rotation.set(0,0,0);
    if(guy.hairTail)guy.hairTail.rotation.set(0,0,0);
    scene.updateMatrixWorld(true);
    const d={};
    for(const n of Object.keys(rest)){
      d[n]=(rest[n]&&moved[n])?+(rest[n].distanceTo(moved[n])*100).toFixed(3):null;
    }
    all[style]={位移cm:d,块数:{
      base:guy.hairBase?guy.hairBase.children.length:0,
      sway:guy.hairGrp?guy.hairGrp.children.length:0,
      tail:guy.hairTail?guy.hairTail.children.length:0}};
  }
  /* ① 静止基准 */
  if(guy.hairPivot)guy.hairPivot.rotation.set(0,0,0);
  if(guy.hairTail)guy.hairTail.rotation.set(0,0,0);
  scene.updateMatrixWorld(true);
  const rest=sample("rest");
  /* ② 施加最大摆角 */
  if(guy.hairPivot)guy.hairPivot.rotation.z=SWAY;
  if(guy.hairTail){guy.hairTail.rotation.z=TAIL_Z;guy.hairTail.rotation.x=TAIL_X;}
  scene.updateMatrixWorld(true);
  const moved=sample("moved");
  /* ③ 复位 */
  if(guy.hairPivot)guy.hairPivot.rotation.set(0,0,0);
  if(guy.hairTail)guy.hairTail.rotation.set(0,0,0);
  scene.updateMatrixWorld(true);

  /* 位移(米 → 厘米) */
  const delta={};
  for(const k of Object.keys(rest)){
    if(!rest[k]||!moved[k]){delta[k]=null;continue;}
    const dx=moved[k].x-rest[k].x,dy=moved[k].y-rest[k].y,dz=moved[k].z-rest[k].z;
    delta[k]={位移cm:+(Math.hypot(dx,dy,dz)*100).toFixed(3),
              水平cm:+(Math.hypot(dx,dz)*100).toFixed(3)};
  }
  /* ④ 对照:若支点仍在脚底(0,0,0),同样角度会位移多少 —— 纯几何计算 */
  const headScale=(typeof VOXEL_HEAD_SCALE!=="undefined")?VOXEL_HEAD_SCALE:.86;
  const legacy=(yLocal,ang)=>+(yLocal*Math.sin(Math.abs(ang))*headScale*100).toFixed(3);
  const crownY=1.785;
  return {
    全发型覆盖:all,
    摆角:{hairPivot度:+(SWAY*180/Math.PI).toFixed(2),hairTailZ度:+(TAIL_Z*180/Math.PI).toFixed(2),hairTailX度:+(TAIL_X*180/Math.PI).toFixed(2)},
    实测位移cm:delta,
    对照若支点在脚底:{
      发冠y1_785转3度:legacy(crownY,3*Math.PI/180),
      发冠y1_785转实测角:legacy(crownY,SWAY)
    },
    层信息:{
      hairBase块数:guy.hairBase?guy.hairBase.children.length:0,
      hairGrp块数:guy.hairGrp?guy.hairGrp.children.length:0,
      hairTail块数:guy.hairTail?guy.hairTail.children.length:0,
      当前发型:guy.hairStyle
    }
  };
});
console.log(JSON.stringify(r,null,1));
await page.close();await b.close();server.close();
