/* 照明分层测量台。跑:node scripts/lighting-bands.test.mjs
   为什么需要它:环境光一旦提上去,**所有**朝上的面和朝下的面都会被均匀提亮,
   顶棚会跟着一块亮起来 —— 那就没有"照明分层"了,画面重新变成一张平贴纸。
   真实球馆的层级是:场地被顶灯照亮 → 看台中等 → 顶棚相对暗。
   这里把画面横切成三条带分别测亮度,直接读出这个层级在不在。

   另外测场地带的**局部方差**:相邻像素梯度的均值。地板被画成密集细板+深缝时,
   这个数会明显偏高 —— 它就是"竹席感/百叶感"的量化替身,
   改纹理前后各跑一次就能看出降频有没有真的生效(而不是自我感觉良好)。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch({args:["--mute-audio"]});break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}

const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errs=[];page.on("pageerror",e=>errs.push(e.stack||e.message));
/* 光靠 pageerror 不够:初始化卡住时错误常常只进了 console,
   于是一直只看到"开场未启动(无 pageerror)",完全不知道卡在哪一步。
   加上 console.error 之后,这类"静默卡死"才有线索。 */
page.on("console",m=>{if(m.type()==="error")errs.push("console.error: "+m.text());});
await page.addInitScript(()=>{
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,a){
    if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
    return orig.call(this,t,a);
  };
});
/* --al1 强制只开一盏投影灯(其余纯照明),用来验证"多灯填亮"到底有没有真的填:
   如果 1 盏投影的深度 ≈ 2 盏投影的一半,说明两盏的影**没有重叠**,多方向成立;
   如果两者接近,说明两盏的影重叠在同一片,那"多灯"就白做了,得继续拉大跨度。 */
const AL1=process.argv.includes("--al1")?"&arshalights=1":"";
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0${AL1}`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
/* 开场没跑起来时不要只抛超时 —— 把页面错误一起打出来,否则只能看到
   "waitForFunction Timeout",完全不知道是哪一行炸的。 */
try{
  await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:90000,polling:"raf"});
  await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:90000,polling:"raf"});
}catch(e){
  console.log("!! 开场未启动。页面错误:");
  for(const m of errs)console.log("   "+m);
  if(!errs.length)console.log("   (无 pageerror,可能是初始化卡住或抛在非全局作用域)");
  await browser.close();server.close();
  process.exit(1);
}

const r=await page.evaluate(()=>{
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  if(!gl)return {error:"拿不到 webgl context"};
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const p=new Uint8Array(W*H*4);
  /* 同上:先空渲一帧再读,保证和后面"无阴影"那一侧在同样的 shader 状态下比较。 */
  renderer.render(scene,camera);gl.finish();
  renderer.render(scene,camera);gl.finish();
  gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
  const lum=i=>0.299*p[i*4]+0.587*p[i*4+1]+0.114*p[i*4+2];
  /* readPixels 原点在左下、y 朝上。画面顶部(y 大)是顶棚,底部(y 小)是近处地板。
     首屏是低位机位,画面下 40% 基本是场地。 */
  const band=(y0,y1)=>{
    let s=0,n=0;const vals=[];
    for(let y=y0;y<y1;y++)for(let x=0;x<W;x++){const l=lum(y*W+x);vals.push(l);s+=l;n++;}
    return {mean:+(s/n).toFixed(1),vals};
  };
  const ceil=band(Math.floor(H*0.80),H);      // 画面顶部 20%:顶棚/桁架
  const mid =band(Math.floor(H*0.45),Math.floor(H*0.80)); // 中 35%:看台/远端
  const floor=band(0,Math.floor(H*0.40));     // 下 40%:场地

  /* 场地局部方差:水平相邻像素梯度均值。密集细板+深缝会把它顶高。 */
  let g=0,gn=0;
  const y0=Math.floor(H*0.10),y1=Math.floor(H*0.36);
  for(let y=y0;y<y1;y++)for(let x=1;x<W;x++){g+=Math.abs(lum(y*W+x)-lum(y*W+x-1));gn++;}

  const g2=AIBA.runtime.service("legacy");
  const box=new THREE.Box3().setFromObject(g2.player.g);
  let bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;
  for(let i=0;i<8;i++){
    const v=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
    if(v.z>1)continue;
    const sx=(v.x*0.5+0.5)*W,py=(1-(0.5-v.y*0.5))*H;
    bx0=Math.min(bx0,sx);bx1=Math.max(bx1,sx);by0=Math.min(by0,py);by1=Math.max(by1,py);
  }
  let rs=0,rn=0;
  for(let y=Math.max(0,Math.floor(by0));y<=Math.min(H-1,Math.ceil(by1));y++)
    for(let x=Math.max(0,Math.floor(bx0));x<=Math.min(W-1,Math.ceil(bx1));x++){rs+=lum(y*W+x);rn++;}

  /* 地面阴影:开关 spot.castShadow 做差,直接定位"阴影到底盖了哪些像素"。
     之前试过取场地带最暗 5% 的均值 —— 那个指标是错的:球场两侧本来就刷了深蓝
     (court.js 的 rgba(20,45,91,.68)),最暗的一批永远是那两块,跟影子无关,
     于是柔化前后都报 50,看起来像没改。这里只认"因为开了 castShadow 才变暗"
     的像素,才是真正的投影。
     三个数一起看:面积(糊开后变大)、平均深度(变浅)、最大深度(不再死黑)。 */
  const floorH=Math.floor(H*0.45);   // 画面下部≈场地
  /* 地面**低频**亮度均匀度。局部梯度测的是高频(木纹条纹),测不出光斑 ——
     光斑是大范围的亮暗分布。所以把场地区切成 8×8 网格,看格子之间的亮度方差:
     方差大 = 有几块明显更亮的区域(热点);方差小 = 整片均匀。
     这才是"局部爆白 vs 广域柔和反射"的量化判据。 */
  const GX=8,GY=8,cellW=Math.max(1,Math.floor(W/GX)),cellH=Math.max(1,Math.floor(floorH/GY));
  /* ⚠ 必须排除场外。之前直接把画面下部切成网格算方差,而场外是深蓝(约 40)、
     场内是木色(约 150),这个 3 倍以上的落差完全主导了方差 —— 结果无论怎么调灯光,
     不均匀度都稳定在 37.8,指标对光斑根本不敏感,等于盲调。
     这里先取全场亮度中位数,只统计亮于它一半的像素(即比赛面),
     测出来的才是"球场内部有没有几块更亮的区域"。 */
  const all=[];
  for(let y=0;y<floorH;y+=4)for(let x=0;x<W;x+=4){
    if(x>=bx0&&x<=bx1&&y>=by0&&y<=by1)continue;
    all.push(lum(y*W+x));
  }
  all.sort((a,b)=>a-b);
  const med=all.length?all[Math.floor(all.length/2)]:128;
  const courtMin=med*0.5;
  const cells=[];
  for(let cy=0;cy<GY;cy++)for(let cx=0;cx<GX;cx++){
    let cs=0,cn=0;
    for(let y=cy*cellH;y<(cy+1)*cellH;y++)for(let x=cx*cellW;x<(cx+1)*cellW;x++){
      if(x>=bx0&&x<=bx1&&y>=by0&&y<=by1)continue;
      const l=lum(y*W+x);
      if(l<courtMin)continue;                 // 场外不计入
      cs+=l;cn++;
    }
    if(cn>cellW*cellH*0.25)cells.push(cs/cn);
  }
  const cmean=cells.reduce((a,b)=>a+b,0)/Math.max(1,cells.length);
  const cvar=Math.sqrt(cells.reduce((a,b)=>a+(b-cmean)**2,0)/Math.max(1,cells.length));
  /* 场内 P99 / 过曝占比 —— 这才是"曝光溢出"的判据。
     "不均匀度"测的是格子间的平均差异,对一小块死白不敏感:
     即使只有 2% 的面积被烧到 250+,均值方差也几乎不动,
     但那块在画面上就是刺眼的白斑。 */
  const inCourt=all.filter(l=>l>=courtMin);
  const p99=inCourt.length?inCourt[Math.floor(inCourt.length*0.99)]:0;
  const blown=inCourt.filter(l=>l>=248).length/Math.max(1,inCourt.length);
  /* ⚠ 开关 castShadow 会改变 NUM_SPOT_LIGHT_SHADOWS 宏,触发 three.js **重编译 shader**。
     重编译后的第一帧不可信 —— 之前就是直接读它,结果投影灯从 .20 降到 .10,
     测出来的"阴影深度"反而从 25.3 涨到 31.2(违反物理),那是编译噪声不是阴影。
     所以两侧都要先空渲一帧把 shader 编译掉,再读第二帧。 */
  const savedShadows=arenaLights.map(l=>l.castShadow);
  const p2=new Uint8Array(W*H*4);
  arenaLights.forEach(l=>{l.castShadow=false;});
  renderer.render(scene,camera);gl.finish();          // 预热:让 shader 重编译
  renderer.render(scene,camera);gl.finish();          // 读这一帧
  gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p2);
  arenaLights.forEach((l,i)=>{l.castShadow=savedShadows[i];});
  renderer.render(scene,camera);gl.finish();          // 恢复后同样预热一帧
  const lum2=i=>0.299*p2[i*4]+0.587*p2[i*4+1]+0.114*p2[i*4+2];
  /* ⚠ 必须排掉角色包围盒。关掉 castShadow 同时也会消掉角色的**自阴影**
     (腋下、脖子、球衣下摆那些接触暗部),那些暗部很深,混进来会把"地面阴影深度"
     整个拉高 —— 之前测出 25~31 这种违反物理的数就是这个原因。
     这里只想量"地面上的投影",所以角色占的像素一律跳过。 */
  let sn=0,sd=0,smax=0;
  for(let y=0;y<floorH;y++)for(let x=0;x<W;x++){
    if(x>=bx0&&x<=bx1&&y>=by0&&y<=by1)continue;
    const i=y*W+x,d=lum(i)-lum2(i);
    if(d<=-2){sn++;sd+=-d;if(-d>smax)smax=-d;}
  }

  const sorted=Float64Array.from(floor.vals).sort();
  const dn=Math.max(1,Math.floor(sorted.length*0.05));
  let dsum=0;for(let i=0;i<dn;i++)dsum+=sorted[i];

  return {
    顶棚mean:ceil.mean,中景mean:mid.mean,场地mean:floor.mean,角色mean:+(rs/rn).toFixed(1),
    场地局部梯度:+(g/gn).toFixed(2),
    地面暗部mean:+(dsum/dn).toFixed(1),
    地面亮度不均匀度:+cvar.toFixed(1),
    场内P99:+p99.toFixed(1),
    过曝面积占比:+(blown*100).toFixed(2),
    地面格子最亮最暗比:+(Math.max(...cells)/Math.max(1,Math.min(...cells))).toFixed(2),
    地面阴影:{面积占比:+(sn/(floorH*W)*100).toFixed(2),
             平均深度:sn?+(sd/sn).toFixed(1):0,
             最大深度:+smax.toFixed(1)},
    诊断:{投影灯数:arenaLights.filter(l=>l.castShadow).length,
          座位数:typeof crowd!=="undefined"?crowd.groups.reduce((a,g)=>a+g.seats.length,0):-1,
          看台分组数:typeof crowd!=="undefined"?crowd.groups.length:-1,
          各灯强度:arenaLights.map(l=>+l.intensity.toFixed(2)),
          地面receiveShadow:!!(typeof courtFloor!=="undefined"&&courtFloor&&courtFloor.receiveShadow),
          shadowMapEnabled:!!(renderer.shadowMap&&renderer.shadowMap.enabled)},
    场地比顶棚:+(floor.mean/Math.max(1,ceil.mean)).toFixed(2),
    角色比中景:+(rs/rn/Math.max(1,mid.mean)).toFixed(2)
  };
});
console.log(JSON.stringify(r,null,2));
console.log(errs.length?"报错: "+errs[0]:"零报错");
await browser.close();server.close();
