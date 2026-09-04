/* 角色自阴影 A/B 验证台。跑:node scripts/selfshadow-ab.test.mjs
   为什么必须这么测:自阴影调不好会退化成 shadow acne(麻点)或 peter-panning(影子脱离),
   这两种失败肉眼一眼可见、但没有任何断言能挡住。所以这里在同一帧状态下把
   receiveShadow 开关一次,读两次 WebGL 像素做差 —— 两次之间除了这个开关
   **没有任何变量**(同一机位、同一姿势、同一灯光),差异必然来自自阴影本身。

   关键设计:
     · 不截图对比,直接在页面里 readPixels。运镜/演出随机用 Math.random(),
       截图两次连人物站位都不一样,差异里混着噪声,测不出东西。
     · preserveDrawingBuffer 用 addInitScript 注入,不碰生产代码。
     · ?fx=0 关掉后期合成,排除 grade.js 的色调/暗角干扰,只看阴影本身。         */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch({args:["--mute-audio"]});break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}

/* --mobile 模拟粗指针设备:core.js 会据此把阴影贴图从 1024 砍到 512。
   512 才是 acne 真正的风险点(≈10cm/纹素),桌面测不出问题不代表手机没问题。 */
const MOBILE=process.argv.includes("--mobile");
/* 注意:AA_COARSE_POINTER 的判据里有 `Math.min(innerWidth,innerHeight)<700`,
   所以竖屏 420×860 **也算粗指针**(阴影贴图 512)。要测真正的桌面 1024 路径,
   短边必须 >=700,这里桌面档用 1280×800。踩过:早先用 420×860 当"桌面"跑,
   报出来的 mapSize 是 512,等于没测到桌面。 */
const page=await browser.newPage(MOBILE
  ?{viewport:{width:420,height:860},deviceScaleFactor:2,hasTouch:true,isMobile:true}
  :{viewport:{width:1280,height:800},deviceScaleFactor:1});
const errs=[];page.on("pageerror",e=>errs.push(e.message));
/* 只有在页面脚本跑之前 patch 才生效:three 建 context 时就要带上这个参数,
   之后改是改不了的(会拿到已存在的 context,参数被忽略)。 */
await page.addInitScript((m)=>{
  window.__MOBILE=m;          // evaluate 跑在浏览器里,拿不到 Node 作用域的变量
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,attrs){
    if(type==="webgl"||type==="webgl2"||type==="experimental-webgl")
      attrs=Object.assign({},attrs,{preserveDrawingBuffer:true});
    return orig.call(this,type,attrs);
  };
},MOBILE);
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
/* 等人物站定持球:这时姿势稳定、在画面中央,是比对的理想状态。 */
await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:20000,polling:"raf"});
await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:20000,polling:"raf"});

const r=await page.evaluate(()=>{
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  if(!gl)return {error:"拿不到 webgl context"};
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const grab=()=>{const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const lumOf=p=>{const n=W*H,l=new Float32Array(n);for(let i=0;i<n;i++){const o=i*4;l[i]=0.299*p[o]+0.587*p[o+1]+0.114*p[o+2];}return l;};
  const stats=l=>{let sum=0;for(let i=0;i<l.length;i++)sum+=l[i];const mean=sum/l.length;
    let v=0,dark=0;for(let i=0;i<l.length;i++){const d=l[i]-mean;v+=d*d;if(l[i]<mean*0.55)dark++;}
    return {mean:+mean.toFixed(2),std:+Math.sqrt(v/l.length).toFixed(2),darkPct:+(dark/l.length*100).toFixed(2)};};

  const g=AIBA.runtime.service("legacy");
  const shot=()=>{renderer.render(scene,camera);return grab();};

  /* ---- 角色屏幕包围盒 ----
     全屏统计里背景占九成,std 主要反映看台和地板,角色那点变化被淹没。
     把角色的世界包围盒八个角投到屏幕取外接矩形,只看这一块。
     readPixels 原点在左下、y 轴朝上,而投影得到的 v.y 朝下,要翻一次。 */
  const box=new THREE.Box3().setFromObject(g.player.g);
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,anyFront=false;
  for(let i=0;i<8;i++){
    const v=new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
    if(v.z>1)continue;                       // 相机背后,投影值会翻转成假值
    anyFront=true;
    const sx=(v.x*0.5+0.5)*W,sy=(0.5-v.y*0.5)*H;
    const py=(1-sy/H)*H;                     // 翻到 readPixels 的坐标系
    x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,py);y1=Math.max(y1,py);
  }
  if(!anyFront)return {error:"角色不在相机前方"};
  const bx0=Math.max(0,Math.floor(x0)),bx1=Math.min(W-1,Math.ceil(x1));
  const by0=Math.max(0,Math.floor(y0)),by1=Math.min(H-1,Math.ceil(y1));
  const inBox=(x,y)=>x>=bx0&&x<=bx1&&y>=by0&&y<=by1;

  /* ---- A:自阴影开(默认) ---- */
  g.player.g.traverse(m=>{if(m.isMesh)m.receiveShadow=true;});
  const A=lumOf(shot());
  /* ---- B:自阴影关 ---- */
  let touched=0;
  g.player.g.traverse(m=>{if(m.isMesh){m.receiveShadow=false;touched++;}});
  const B=lumOf(shot());
  /* 还原,免得留下的状态影响后续手动查看 */
  g.player.g.traverse(m=>{if(m.isMesh)m.receiveShadow=true;});

  /* ---- 全屏差异 ---- */
  let diff=0,diffBig=0,darker=0,brighter=0,maxDelta=0;
  for(let i=0;i<A.length;i++){
    const d=A[i]-B[i];
    if(Math.abs(d)>=2){diff++;if(d<-1)darker++;else if(d>1)brighter++;}
    if(Math.abs(d)>=12)diffBig++;
    if(Math.abs(d)>maxDelta)maxDelta=Math.abs(d);
  }
  /* ---- 角色区域差异 ---- */
  let rn=0,rDiff=0,rDarker=0,rSumA=0,rSumB=0;
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    const i=y*W+x;rn++;rSumA+=A[i];rSumB+=B[i];
    const d=A[i]-B[i];if(Math.abs(d)>=2)rDiff++;if(d<-1)rDarker++;
  }
  const rMeanA=rSumA/rn,rMeanB=rSumB/rn;
  let rVa=0,rVb=0;
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    const i=y*W+x;rVa+=(A[i]-rMeanA)**2;rVb+=(B[i]-rMeanB)**2;
  }

  /* ---- acne 检测 ----
     自阴影最典型的翻车是 shadow acne:应为连续受光的面上冒出孤立麻点。
     判据:某像素比上下左右四邻都暗 18 以上 —— 真实阴影是成片的,不会这样。
     只数"开阴影才多出来的"孤立点,即 A 里孤立、B 里不孤立。 */
  const isolated=(l,x,y)=>{
    if(x<=0||y<=0||x>=W-1||y>=H-1)return false;
    const c=l[y*W+x];
    return (c<l[y*W+x-1]-18)&&(c<l[y*W+x+1]-18)&&(c<l[(y-1)*W+x]-18)&&(c<l[(y+1)*W+x]-18);
  };
  let isoA=0,isoB=0,isoNew=0;
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    const a=isolated(A,x,y),b=isolated(B,x,y);
    if(a)isoA++;if(b)isoB++;if(a&&!b)isoNew++;
  }

  /* ---- 性能 ----
     自阴影的代价在 fragment shader:每个受光片元多一次 shadow map 采样。
     必须 gl.finish() 把 GPU 队列排空,否则测到的只是 CPU 提交时间。 */
  /* 单轮 AB 测出来的增量会在正负之间乱跳(实测出现过 -0.27ms —— 开销不可能是负的),
     那是 GPU 频率/调度噪声,不是真实差异。走 ABAB 多轮、每侧取**最小值**:
     最小值对应"这次没被打断",是最稳定的估计。 */
  const bench=n=>{
    renderer.render(scene,camera);gl.finish();          // 预热,避开首次编译
    const t0=performance.now();
    for(let i=0;i<n;i++)renderer.render(scene,camera);
    gl.finish();
    return (performance.now()-t0)/n;
  };
  const setReceive=v=>g.player.g.traverse(m=>{if(m.isMesh)m.receiveShadow=v;});
  const offs=[],ons=[];
  for(let r=0;r<3;r++){
    setReceive(false);offs.push(bench(40));
    setReceive(true); ons.push(bench(40));
  }
  const msOff=Math.min(...offs),msOn=Math.min(...ons);

  const n=A.length;
  return {
    模式:window.__MOBILE?"手机(512 贴图)":"桌面(1024 贴图)",
    阴影贴图:spot.shadow.mapSize.x,
    viewport:[W,H],角色网格数:touched,
    角色包围盒:[bx1-bx0+1,by1-by0+1],角色占屏:+(rn/n*100).toFixed(2),
    角色区域:{
      开:{mean:+rMeanA.toFixed(2),std:+Math.sqrt(rVa/rn).toFixed(2)},
      关:{mean:+rMeanB.toFixed(2),std:+Math.sqrt(rVb/rn).toFixed(2)},
      受影响占比:+(rDiff/rn*100).toFixed(2),
      变暗占比:+(rDarker/rn*100).toFixed(2)
    },
    全屏:{受影响占比:+(diff/n*100).toFixed(3),明显变暗占比:+(diffBig/n*100).toFixed(3),
          变暗像素:darker,变亮像素:brighter,最大亮度差:+maxDelta.toFixed(1)},
    acne:{开后孤立暗点:isoA,关后孤立暗点:isoB,新增孤立暗点:isoNew,
          新增占比:+(isoNew/rn*100).toFixed(3)},
    性能:{关自阴影ms:+msOff.toFixed(3),开自阴影ms:+msOn.toFixed(3),
          增量ms:+(msOn-msOff).toFixed(3),增幅:msOff>0?+((msOn/msOff-1)*100).toFixed(1)+"%":"n/a"}
  };
});
console.log(JSON.stringify(r,null,2));
console.log(errs.length?"报错: "+errs[0]:"零报错");
await browser.close();server.close();
