/* 过曝定位器。跑:node scripts/blown-map.test.mjs
   为什么需要它:lighting-bands 只报"过曝面积占比"这一个总数,
   3.17% 是散在 ten 个地方还是集中在一块?看不出来。
   这里把每个过曝像素**反投影到地面 y=0**,得到它的世界坐标,
   再按 x / z 分桶 —— 直接读出那块死白落在球场的哪个位置
   (是三秒区?是左侧?还是场外的广告板/观众)。
   用法:改材质前后各跑一次,对比同名的桶。 */
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
await page.addInitScript(()=>{
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,a){
    if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
    return orig.call(this,t,a);
  };
});
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
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
  renderer.render(scene,camera);gl.finish();
  renderer.render(scene,camera);gl.finish();
  gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
  const lum=i=>0.299*p[i*4]+0.587*p[i*4+1]+0.114*p[i*4+2];

  /* readPixels 原点在左下、y 朝上。只扫画面下 45%(近处场地),
     上 55% 是观众/顶棚,反投影到 y=0 没有意义。 */
  const yTop=Math.floor(H*0.45);
  const TH=248;
  const pts=[];
  for(let yg=0;yg<yTop;yg++)for(let x=0;x<W;x++){
    if(lum(yg*W+x)<TH)continue;
    /* 反投影:该像素的视线与地面 y=0 的交点 */
    const ndc=new THREE.Vector3((x/W)*2-1,(yg/H)*2-1,0.5).unproject(camera);
    const dir=ndc.sub(camera.position).normalize();
    if(dir.y>=-1e-4)continue;                    // 视线朝上/平行,打不到地面
    const t=-camera.position.y/dir.y;
    if(t<=0||t>200)continue;                     // 交点在相机背后或太远
    pts.push([camera.position.x+dir.x*t,camera.position.z+dir.z*t,x,yg]);
  }
  /* 反投影只在一个前提下成立:那个像素**本身**就是地面。
     如果过曝的是竖直的广告板/看台,视线会穿过它继续打到后方的地面,
     算出来的坐标是"它背后",位置看着像地板,其实是错的 ——
     刚才照着这个坐标去调地板 clearcoat,过曝一动不动(20320→20347),
     就是被它骗了。所以这里再用 Raycaster 真射一次,取第一个命中的物体:
     统计过曝像素到底落在哪些物体上。 */
  const rc=new THREE.Raycaster();const ex={};
  /* ⚠ Raycaster.params.Points.threshold 默认是 **1 个世界单位**,
     而火焰拖尾粒子 size 只有 .22 —— 等于把每颗 .22 的火星当成半径 1 米的大球,
     于是大片地板像素被误判成"命中粒子"(上一版报 77% 是 Points,就是这么来的)。
     按粒子实际视觉半径给一个接近的值,才能反映它真正盖住了多少像素。 */
  rc.params.Points.threshold=0.12;
  const hit={};let sampled=0;
  const step=Math.max(1,Math.floor(pts.length/400));
  for(let i=0;i<pts.length&&sampled<400;i+=step){
    const [,,sx,sy]=pts[i];sampled++;
    rc.setFromCamera(new THREE.Vector2((sx/W)*2-1,(sy/H)*2-1),camera);
    /* ⚠ THREE.Raycaster **不检查 visible** —— 开场动画用完藏起来的道具
       (visible=false,就飘在相机前 z≈0.8 处)会被照样命中,
       而且是"第一个命中",把后面真实的地板/球员全挡掉。
       上一版就是这么被坑的:报出来 79% 命中一个隐藏的蓝盒子。
       所以必须自己沿 parent 链往上走一遍,把任一层不可见的剔除。 */
    const hits=rc.intersectObjects(scene.children,true)
      .filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});
    if(!hits.length){hit["(未命中/全被隐藏物挡住)"]=(hit["(未命中/全被隐藏物挡住)"]||0)+1;continue;}
    const o=hits[0].object;
    const m=o.material&&o.material.type||"(无材质)";
    /* 广告板/横幅是 MeshBasicMaterial(自发光、不吃光照),单独标出来 ——
       它本来就该是画面里最亮的东西,如果过曝集中在它身上,那不是灯的问题。 */
    const tag=(m==="MeshBasicMaterial"?"[Basic自发光]":"")+m+
              "/"+((o.geometry&&o.geometry.type)||"?");
    hit[tag]=(hit[tag]||0)+1;
    /* 同一个 tag 记一份**样例**:名字/世界坐标/尺寸/材质颜色。
       只报类型不够 —— "BoxGeometry+Lambert" 可能是座椅、广告板、
       地板装饰、角色身上任何一个盒子,不看到坐标和尺寸还是猜。 */
    if(!ex[tag]){
      const wp=new THREE.Vector3();o.getWorldPosition(wp);
      const bb=o.geometry.boundingBox||(o.geometry.computeBoundingBox(),o.geometry.boundingBox);
      ex[tag]={name:o.name||"(无名)",
               世界坐标:[+wp.x.toFixed(1),+wp.y.toFixed(1),+wp.z.toFixed(1)],
               尺寸:bb?[+(bb.max.x-bb.min.x).toFixed(2),+(bb.max.y-bb.min.y).toFixed(2),
                        +(bb.max.z-bb.min.z).toFixed(2)]:null,
               颜色:o.material&&o.material.color?("#"+o.material.color.getHexString()):null,
               自发光:o.material&&o.material.emissive?("#"+o.material.emissive.getHexString()):null,
               可见:o.visible,父级:o.parent?(o.parent.name||o.parent.type):null};
    }
  }

  /* 球场尺寸:读 COURT 常量,拿不到就退回 NBA 半场常用值 */
  const C=(typeof COURT!=="undefined")?COURT:{};
  const halfW=(C.halfWidth??7.5), nearB=(C.nearBaseline??0), farB=(C.farBaseline??14);
  /* 三秒区:宽 4.9 → x∈[-2.45,2.45];长 5.79,贴着两侧底线 */
  const inPaint=(x,z)=>Math.abs(x)<=2.45&&(Math.abs(z-nearB)<=5.79/2||Math.abs(z-farB)<=5.79/2);
  const onCourt=(x,z)=>Math.abs(x)<=halfW&&z>=Math.min(nearB,farB)-0.5&&z<=Math.max(nearB,farB)+0.5;

  const NX=12,NZ=12;
  const zmin=Math.min(nearB,farB)-1,zmax=Math.max(nearB,farB)+1;
  const bx=(x)=>Math.max(0,Math.min(NX-1,Math.floor((x+halfW)/(2*halfW)*NX)));
  const bz=(z)=>Math.max(0,Math.min(NZ-1,Math.floor((z-zmin)/(zmax-zmin)*NZ)));
  const grid=Array.from({length:NZ},()=>new Array(NX).fill(0));
  let paint=0,court=0,off=0,sx=0,sz=0;
  for(const [x,z] of pts){
    grid[bz(z)][bx(x)]++;
    sx+=x;sz+=z;
    if(inPaint(x,z))paint++;
    if(onCourt(x,z))court++;else off++;
  }
  const total=pts.length||1;
  return {
    过曝像素数:pts.length,
    落在三秒区内:+((paint/total)*100).toFixed(1),
    落在场内:+((court/total)*100).toFixed(1),
    落在场外:+((off/total)*100).toFixed(1),
    重心:{x:+(sx/total).toFixed(2),z:+(sz/total).toFixed(2)},
    过曝命中样例:ex,
    过曝命中物体:Object.entries(hit).sort((a,b)=>b[1]-a[1])
                  .map(([k,v])=>k+" ×"+v+" ("+((v/sampled)*100).toFixed(0)+"%)"),
    x轴分桶:Array.from({length:NX},(_,i)=>+(((-halfW+(i+0.5)*(2*halfW/NX)))).toFixed(1))
              .map((cx,i)=>[cx,grid.reduce((a,row)=>a+row[i],0)]),
    z轴分桶:Array.from({length:NZ},(_,i)=>+(zmin+(i+0.5)*((zmax-zmin)/NZ)).toFixed(1))
              .map((cz,i)=>[cz,grid[i].reduce((a,b)=>a+b,0)]),
    热力图:grid.map((row,zi)=>[+(zmin+(zi+0.5)*((zmax-zmin)/NZ)).toFixed(1),...row])
  };
});

console.log(JSON.stringify(r,null,1));
console.log(errs.length?("!! 报错:"+errs.join("|")):"零报错");
await browser.close();server.close();
