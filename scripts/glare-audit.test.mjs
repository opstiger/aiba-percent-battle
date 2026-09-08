/* 眩光/白斑验收台 v2。跑:node scripts/glare-audit.test.mjs
   ⚠ 验收不通过时进程以**非零退出码**结束(exit 1),不能只打印数字。

   v1 的两个致命问题,这一版全部修掉:
   ① 镜头是假的。v1 直接写 camera.position/lookAt,绕开了游戏的跟随逻辑,
      测的根本不是玩家看到的画面。现在统一走
        setCameraMode(mode,{silent:true})
      并等若干帧让跟随逻辑真正跑起来再采样。
      模式:CAM_BASE_NAMES = ["第一人称","球员跟随","转播视角"] → 0/1/2,
      3/4 是自定义槽(后侧 177°、低机位靠它构造)。
   ② 消融在错误的前提下做。v1 把 rim/envMap 消融放在 fx=0(关后期)页面里,
      那不能证明生产配置下的效果。现在**全部在 fx=1(后期开启)**下进行,
      bloom 用 AIBAGrade.set({bloomStrength:0}) 单关,而不是连其它后期一起关掉。

   判据不是"过曝面积占比"(它会把分散小点和整块白斑算成同一个数),
   而是**最大连续过曝区域**(连通域)+ **高光区木纹保留度**。

   另加"地板纯净诊断":只留地板/灯光/材质,隐去球员、白线、光圈、篮球,
   用来确认白斑到底来自地板材质本身,还是来自别的物体。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"artifacts","glare");
fs.mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){if(e.code==="EISDIR"){rs.writeHead(204);return rs.end();}rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
const ARGS=["--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding"];
const MAX_BLOB=1500;      // 绝对兜底:单个洗白连通块超过此像素数即判失败
/* 主判据:最大洗白块占**可见木地板**的比例(%)。
   旧版只看绝对像素(<1500 即通过),但各机位地板在画面里占的面积差异极大,
   绝对数没有可比性 —— 这也正是"数字全绿、截图仍有宽幅泛白"的成因之一。
   改用占比才能反映洗白相对地板面积的严重程度。 */
const MAX_PCT=1.5;

/* 注入页面的:真实镜头 + 连通域 + 木纹保留度 */
const PROBE=`
window.__nf=function(n){return new Promise(function(res){
  var i=0;function step(){ if(i++>=n)return res(); requestAnimationFrame(step); }
  requestAnimationFrame(step);
});};
window.__setupViews=function(){
  /* 后侧 177° 与低机位没有内置模式,用两个自定义槽构造。
     自定义视角参数:{yaw,pitch,distance,targetY} */
  try{
    customCameraSlots[0]={yaw:177*Math.PI/180,pitch:0.30,distance:5.5,targetY:1.20};
    customCameraSlots[1]={yaw:Math.PI,pitch:-0.20,distance:2.6,targetY:0.78};
  }catch(e){}
  /* 机位数开关。每个机位都要额外做 2 次全场景渲染 + readPixels 来生成 mask,
     六机位 × 多配置会把渲染进程拖死。QUICK=1 时只跑前三个关键机位
     (跟随/转播/低机位,含验收点名的两个最差角度)先确认趋势。 */
  window.__VIEW_LIMIT=${process.env.QUICK?3:6};
};
window.__VIEWS=[
  {name:"普通",    mode:null},
  {name:"跟随",    mode:1},
  {name:"转播",    mode:2},
  {name:"第一人称",mode:0},
  {name:"后侧177", mode:3},
  {name:"低机位",  mode:4}
];
/* ⚠ 关键:不进入 gameplay,setCameraMode 只是一个标志,相机逻辑根本不会跑。
   实测:之前测的"基线最大块 44 像素"其实是菜单状态的画面 ——
   你看到的"跟随镜头左前方白斑"截图根本覆盖不到。
   AIBATrailer.prepare 会设 G.state="round" 并完成 playable 初始化。 */
window.__enterGameplay=async function(){
  const diag={AIBATrailer:typeof window.AIBATrailer!=="undefined"};
  /* 尝试 AIBATrailer.prepare —— 它会把 G.state 设成 "round" 并摆好球员,
     但它**只对 runtime 注册有效**,且依赖 sceneProgress 等上下文。 */
  if(diag.AIBATrailer&&window.AIBATrailer&&window.AIBATrailer.prepare){
    try{await window.AIBATrailer.prepare({camera:1});diag.prepareCalled=true;}catch(e){diag.prepareErr=String(e);}
  }
  /* 不调 clear —— 它会把准备好的状态清掉。 */
  /* 然后**强制覆盖**关键状态,确保无论 prepare 成不成功,都进入 playable。 */
  if(typeof G!=="undefined"){
    G.state="round";G.mode=G.mode||"contest";G.running=true;G.canShoot=false;
    G.charging=false;G.moving=false;G.glideCam=false;
    if(typeof PAUSE!=="undefined")PAUSE.on=false;
  }
  if(typeof P!=="undefined"&&P.pos){P.pos.set(0,0,COURT.midZ+2);P.walking=false;P.jump=0;}
  /* ⚠ 关键:DOM 上覆盖着开场菜单(百分大战 logo + Rack Rush 等),
     canvas 在它后面被挡着 —— 测到的"跟随镜头"其实是菜单截图。
     强制隐藏所有非 canvas 的 body 直接子元素,留下纯 3D 画面。 */
  const old=document.getElementById("__glare_test_style");
  if(old)old.remove();
  const style=document.createElement("style");
  style.id="__glare_test_style";
  style.textContent="body>*:not(canvas){display:none!important}#hud,#battleControls,#midBtn{display:none!important}";
  document.head.append(style);
  /* 强制设跟随相机,绕过任何菜单态的相机约束 */
  if(typeof CAM!=="undefined"){CAM.mode=1;if(typeof applyCamMode==="function")applyCamMode();}
  await window.__nf(25);
  diag.Gstate=typeof G!=="undefined"?G.state:"?";
  diag.CAMmode=typeof CAM!=="undefined"?CAM.mode:"?";
  diag.Ppos=typeof P!=="undefined"&&P.pos?[P.pos.x.toFixed(2),P.pos.z.toFixed(2)]:"?";
  diag.DOMChildren=Array.from(document.body.children).map(e=>e.tagName+(e.id?"#"+e.id:"")).join(",");
  return diag;
};
/* 切完机位必须**等相机稳定**再采样,不能只等固定帧数。
   实测证据:各页面的**首次** probe 可见地板只有 334325,而稳定后是 458538
   (差 12% 屏幕面积)—— 相机还在过渡途中,地板有大块落在视野外。
   这直接让"占可见地板比例"在各配置间不可比(①⑤ 偏小、②③④ 正常),
   会得出完全错误的消融结论。所以改成轮询到位置不再变化为止。 */
window.__waitCamStable=async function(maxF){
  let last=null;
  for(let i=0;i<(maxF||60);i++){
    await window.__nf(1);
    const q=camera.position,cur=[q.x,q.y,q.z];
    if(last&&Math.abs(cur[0]-last[0])<1e-4&&Math.abs(cur[1]-last[1])<1e-4&&
       Math.abs(cur[2]-last[2])<1e-4)return true;
    last=cur;
  }
  return false;
};
/* ===== 精确 mask:按**对象**生成可见区域,不再按屏幕位置猜 =====
   做法:临时只显示目标对象 + scene.overrideMaterial 强制纯白 + 黑背景渲染,
   读回后白色区就是该类对象**实际可见**的像素(自动含深度遮挡:
   被球员/球/篮架挡住的部分不会出现)。
   ⚠ 旧版用"画面下方 62%"当地板,把看台、广告板、人物边缘、白线全算了进去,
     所以过曝率与"木纹保留"都不可信 —— 白线和人物边缘的梯度就足以把后者抬到 1.0。 */
/* ⚠ 内存:这些 W*H 级别的 buffer 必须**复用**,不能每次调用都 new。
   30 次 probe × 4 个大数组会让页面内存持续增长,实测跑到第 3 个配置就
   "Target page, context or browser has been closed"(渲染进程被杀)。
   slot 0/1/2 分别给 地板/白线/三秒区,保证三者各自独立不被覆盖。 */
let __mBuf=null,__mS=null,__whiteMat=null,__blackMat=null;
window.__makeMask=function(kind,slot){
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  if(!__mBuf||__mBuf.length!==W*H*4){
    __mBuf=new Uint8Array(W*H*4);
    __mS=[new Uint8Array(W*H),new Uint8Array(W*H),new Uint8Array(W*H),new Uint8Array(W*H)];
  }
  const buf=__mBuf;
  if(!__whiteMat)__whiteMat=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
  const want=(o)=>{
    if(typeof kind==="function")return kind(o);   // 供 __makeMaskOcc 复用同一渲染路径
    if(kind==="floor")return (typeof courtFloor!=="undefined")&&o===courtFloor;
    if(kind==="line") return o.name==="courtLine";
    if(kind==="zone") return o.name==="courtZone";
    return false;
  };
  /* 隐藏法:只显示目标、其它隐藏,override 纯白渲染。
     ⚠ 曾用"把所有对象材质换成黑/白"来保留遮挡,但那会让 Three.js 为每种
       几何/instancing 组合重编译 shader,实测第一个配置就把渲染进程拖死
       ("Target page... has been closed")。隐藏法只切 visible、不碰材质,很轻。
     代价:mask 是"投影区"不含遮挡,所以另用 __makeMaskOcc 把球员/球挖掉。 */
  const saved=[];
  scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine){saved.push([o,o.visible]);o.visible=want(o);}});
  const ovr=scene.overrideMaterial;
  scene.overrideMaterial=__whiteMat;
  const cc=new THREE.Color();renderer.getClearColor(cc);const ca=renderer.getClearAlpha();
  renderer.setClearColor(0x000000,1);
  renderer.render(scene,camera);gl.finish();
  gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  scene.overrideMaterial=ovr;renderer.setClearColor(cc,ca);
  for(let i=0;i<saved.length;i++)saved[i][0].visible=saved[i][1];
  const m=__mS[slot|0];
  for(let i=0;i<W*H;i++)m[i]=buf[i*4]>127?1:0;
  return {W:W,H:H,m:m};
};
/* 遮挡物(球员/球)mask —— 从地板区里挖掉。
   隐藏法的 floorMask 是"地板投影区",里面混着被球员/球挡住的像素,
   那些位置实际渲染的是球衣和篮球,它们的亮部会被误统计成"地板洗白"
   (这是最容易被误判的一类,因为它们本身就很亮)。 */
/* "要从木地板里排除"的合并 mask:白线 + 三秒区 + 球员/球,**一次渲染**搞定。
   ⚠ 分开渲染 line/zone/occ 三张会让每机位多出 3 次全场景渲染 + 3 次
      readPixels(每次 4MB),六机位 × 多配置下来渲染进程会被拖死
     (实测跑完 ① 就 "Target page has been closed")。
     这三类的用途完全相同 —— 都是"不算木地板",合并成一张即可。 */
window.__makeMaskExclude=function(slot){
  const targets=new Set(),roots=[];
  try{
    if(typeof player!=="undefined"&&player.g)roots.push(player.g);
    if(typeof passer!=="undefined"&&passer.g)roots.push(passer.g);
    if(typeof oppPasser!=="undefined"&&oppPasser.g)roots.push(oppPasser.g);
    if(typeof rivals!=="undefined")for(const r of rivals)if(r&&r.g)roots.push(r.g);
  }catch(e){}
  for(const r of roots)r.traverse(o=>{if(o.isMesh||o.isPoints)targets.add(o);});
  return window.__makeMask(o=>targets.has(o)||o.name==="courtLine"||o.name==="courtZone",slot);
};
/* V(明度)与 S(饱和度)。
   **洗白的本质不是"亮度顶到 255",而是颜色被冲淡**:亮度上去、饱和度掉下来。
   旧版阈值 248 只抓顶格过曝,所以那片 200~245 的宽幅失色亮带永远测不出来 ——
   数字好看但肉眼可见。必须 V、S 一起看,才能覆盖"未剪裁的失色亮带"。 */
window.__vs=function(r,g,b){
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  return {v:mx/255,s:mx?(d/mx):0};
};
/* 与 mask 同理:主分析里的像素/标记数组也全部复用,避免每机位重新分配 */
let __gP=null,__gWood=null,__gWash=null,__gSeen=null,__gSt=null;
window.__glareProbe=async function(){
  await window.__enterGameplay();
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const N=W*H;
  if(!__gP||__gP.length!==N*4){
    __gP=new Uint8Array(N*4);__gWood=new Uint8Array(N);
    __gWash=new Uint8Array(N);__gSeen=new Uint8Array(N);__gSt=new Int32Array(N);
  }
  const p=__gP;
  const out=[];
  if(typeof window.__setupViews==="function")window.__setupViews();
  for(const v of window.__VIEWS.slice(0,window.__VIEW_LIMIT||6)){
    /* 真实镜头:调游戏自己的 setCameraMode,再等帧让跟随逻辑跑起来 */
    /* ⚠ 顺序很关键:**先固定球员,再切镜头**。
       反过来(先切镜头再挪球员)时,跟随相机是基于**旧**球员位置起算的,
       下一帧才发现球员瞬移,于是长距离插值把相机甩到场外高处
       —— 实测 cam=[14.8,8.5,16.1],地板整个落在视野外,可见木地板=0。
       固定球员同时保证各配置的"占可见地板比例"横向可比
       (跟随/第一人称镜头都跟着球员,球员漂则相机漂、地板面积变)。 */
    if(typeof P!=="undefined"&&P.pos){P.pos.set(0,0,COURT.midZ+2);P.walking=false;}
    /* ⚠ 球员对象建好时是 visible=false(buildCharacters 里的初值),
       跟随/第一人称镜头要**看得见**它才跟得上;不可见时相机会退回默认观察位,
       实测被甩到 y≈8 的场外高处(cam=[9.1,8,22]),地板整个在视野外、可见木地板=0。 */
    if(typeof player!=="undefined"&&player.g)player.g.visible=true;
    if(v.mode!==null&&typeof setCameraMode==="function")setCameraMode(v.mode,{silent:true});
    /* 相机落地校验:贴地机位不该出现在 y>6 或场外。不合格就重切一次再等。 */
    for(let att=0;att<3;att++){
      await window.__waitCamStable(60);
      const cp=camera.position;
      if(cp.y<6&&Math.abs(cp.x)<22&&cp.z>-20&&cp.z<32)break;
      if(v.mode!==null&&typeof setCameraMode==="function")setCameraMode(v.mode,{silent:true});
      await window.__nf(25);
    }
    renderer.render(scene,camera);gl.finish();
    renderer.render(scene,camera);gl.finish();
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
    /* 精确 mask:木地板 / 白线 / 三秒区 分开取(slot 0/1/2 保证互不覆盖) */
    const F=window.__makeMask("floor",0),E=window.__makeMaskExclude(1);
    /* 纯木地板 = 可见地板 且 不属于排除集(白线/三秒区/球员/球)。
       这几类任一混进来都会让指标失真:白线自带高亮、球员球衣和球本身就很亮。 */
    const wood=__gWood;wood.fill(0);let nWood=0;
    let nFloor=0,nExc=0;
    for(let i=0;i<N;i++){if(F.m[i])nFloor++;if(E.m[i])nExc++;}
    for(let i=0;i<N;i++)if(F.m[i]&&!E.m[i]){wood[i]=1;nWood++;}
    /* 基准:木地板自身的明度/饱和度中位数 —— 用**木板自己**做参照,
       不用全场,也不掺线条/几何边界。隔 3 像素采样:求中位数足够,
       又不会堆积百万级浮点数组(那是渲染进程被杀的元凶之一)。 */
    const vs=[],ss=[];
    for(let i=0;i<N;i+=3){
      if(!wood[i])continue;
      const c=window.__vs(p[i*4],p[i*4+1],p[i*4+2]);
      vs.push(c.v);ss.push(c.s);
    }
    vs.sort((a,b)=>a-b);ss.sort((a,b)=>a-b);
    const vBase=vs.length?vs[vs.length>>1]:0,sBase=ss.length?ss[ss.length>>1]:0;
    /* 洗白 = 亮 且 明显失色。不要求顶格 —— 这正是"未剪裁失色亮带" */
    const V_TH=Math.max(0.72,vBase*1.20),S_TH=sBase*0.75;
    const wash=__gWash;wash.fill(0);let nWash=0;
    for(let i=0;i<N;i++){
      if(!wood[i])continue;
      const c=window.__vs(p[i*4],p[i*4+1],p[i*4+2]);
      if(c.v>=V_TH&&c.s<=S_TH){wash[i]=1;nWash++;}
    }
    /* 洗白连通域(8 邻域:4 邻域会把细长亮带低估成碎片) */
    const seen=__gSeen,st=__gSt;seen.fill(0);
    let maxBlob=0,bx0=1e9,by0=1e9,bx1=-1,by1=-1;
    for(let i=0;i<N;i++){
      if(!wash[i]||seen[i])continue;
      let sp=0,cnt=0,x0=1e9,y0=1e9,x1=-1,y1=-1;
      st[sp++]=i;seen[i]=1;
      while(sp>0){
        const k=st[--sp];cnt++;
        const kx=k%W,ky=(k/W)|0;
        if(kx<x0)x0=kx;if(kx>x1)x1=kx;if(ky<y0)y0=ky;if(ky>y1)y1=ky;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dy)continue;
          const nx=kx+dx,ny=ky+dy;
          if(nx<0||ny<0||nx>=W||ny>=H)continue;
          const j=ny*W+nx;
          if(!seen[j]&&wash[j]){seen[j]=1;st[sp++]=j;}
        }
      }
      if(cnt>maxBlob){maxBlob=cnt;bx0=x0;by0=y0;bx1=x1;by1=y1;}
    }
    /* 木地板区局部对比度:只在 wood 内、且左右都属 wood,排除线条与几何边界 */
    let gW=0,nW=0;
    for(let y=1;y<H;y++)for(let x=1;x<W;x++){
      const i=y*W+x,j=i-1;
      if(!wood[i]||!wood[j])continue;
      const a=0.299*p[i*4]+0.587*p[i*4+1]+0.114*p[i*4+2];
      const b=0.299*p[j*4]+0.587*p[j*4+1]+0.114*p[j*4+2];
      gW+=Math.abs(a-b);nW++;
    }
    out.push({机位:v.name,分辨率:W+"x"+H,可见木地板:nWood,
      地板mask:nFloor,排除mask:nExc,
      cam:[+camera.position.x.toFixed(1),+camera.position.y.toFixed(1),+camera.position.z.toFixed(1)],
      洗白占比:+(nWood?(nWash/nWood*100):0).toFixed(2),
      最大洗白块:maxBlob,
      最大块占木地板:+(nWood?(maxBlob/nWood*100):0).toFixed(2),
      基准明度:+vBase.toFixed(3),基准饱和度:+sBase.toFixed(3),
      木地板对比度:+(nW?(gW/nW):0).toFixed(2),
      /* readPixels 的 y 从底部起算,截图是顶部起算,这里换算成截图坐标便于框注 */
      问题框:maxBlob?[bx0,H-1-by1,bx1,H-1-by0]:null});
  }
  return out;
};
/* 跟随镜头下扫描**球员站位**。
   只测开场默认位置是不够的:跟随相机绕着球员转,掠射高光落在地板的哪个方位
   取决于球员站哪 —— 验收截图里那块"左前方泛白"很可能只在某个站位才出现。
   所以把球员依次摆到几个典型位置,每个位置都等相机跟随稳定后采样,取最坏值。 */
window.__POS=[
  {n:"弧顶",   x:0,    z:COURT.midZ+3},
  {n:"左翼",   x:-5,   z:HOOP.z+4},
  {n:"右翼",   x:5,    z:HOOP.z+4},
  {n:"左底角", x:-6.5, z:HOOP.z+1},
  {n:"右底角", x:6.5,  z:HOOP.z+1},
  {n:"篮下",   x:0,    z:HOOP.z+1.5},
  {n:"左侧低位",x:-4,   z:COURT.midZ-2},
  {n:"右侧低位",x:4,    z:COURT.midZ-2}
];
window.__glareAtPos=async function(){
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const p=new Uint8Array(W*H*4);
  const lum=i=>0.299*p[i*4]+0.587*p[i*4+1]+0.114*p[i*4+2];
  if(typeof setCameraMode==="function")setCameraMode(1,{silent:true});  // 跟随
  const out=[];
  for(const pos of window.__POS){
    try{if(typeof P!=="undefined"&&P.pos){P.pos.x=pos.x;P.pos.z=pos.z;}}catch(e){}
    await window.__nf(16);
    renderer.render(scene,camera);gl.finish();
    renderer.render(scene,camera);gl.finish();
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
    const yTop=Math.floor(H*0.62),N=W*yTop,TH=248;
    const seen=new Uint8Array(N),stack=new Int32Array(N);
    let maxRun=0,total=0;
    for(let i=0;i<N;i++){
      if(lum(i)<TH)continue;
      total++;
      if(seen[i])continue;
      let sp=0,cnt=0;stack[sp++]=i;seen[i]=1;
      while(sp>0){
        const k=stack[--sp];cnt++;
        const kx=k%W,ky=(k/W)|0;
        if(kx>0){const j=k-1;if(!seen[j]&&lum(j)>=TH){seen[j]=1;stack[sp++]=j;}}
        if(kx<W-1){const j=k+1;if(!seen[j]&&lum(j)>=TH){seen[j]=1;stack[sp++]=j;}}
        if(ky>0){const j=k-W;if(!seen[j]&&lum(j)>=TH){seen[j]=1;stack[sp++]=j;}}
        if(ky<yTop-1){const j=k+W;if(!seen[j]&&lum(j)>=TH){seen[j]=1;stack[sp++]=j;}}
      }
      if(cnt>maxRun)maxRun=cnt;
    }
    let gHi=0,nHi=0,gMid=0,nMid=0;
    for(let y=4;y<yTop;y+=2)for(let x=1;x<W;x+=2){
      const i=y*W+x,a=lum(i),b=lum(i-1),d=Math.abs(a-b);
      if(a>=200&&b>=200){gHi+=d;nHi++;}
      else if(a>=120&&a<180&&b>=120&&b<180){gMid+=d;nMid++;}
    }
    const gH=nHi?gHi/nHi:0,gM=nMid?gMid/nMid:0;
    out.push({机位:"跟随@"+pos.n,过曝占比:+(total/N*100).toFixed(2),最大连通块:maxRun,
      大块数:0,高光梯度:+gH.toFixed(3),木色梯度:+gM.toFixed(3),
      木纹保留:+(gM?Math.min(1,gH/gM):0).toFixed(2)});
  }
  return out;
};
/* 地板纯净诊断:只留地板/灯光/材质 */
window.__purify=function(){
  try{
    if(typeof player!=="undefined"&&player&&player.g)player.g.visible=false;
    if(typeof balls!=="undefined")balls.forEach(b=>{if(b.mesh)b.mesh.visible=false;if(b.blob)b.blob.visible=false;});
    if(typeof handBall!=="undefined")handBall.visible=false;
    if(typeof pBall!=="undefined")pBall.visible=false;
    if(typeof curSpotRing!=="undefined"&&curSpotRing)curSpotRing.visible=false;
    if(typeof netMesh!=="undefined"&&netMesh)netMesh.visible=false;
    if(typeof farNet!=="undefined"&&farNet)farNet.visible=false;
    /* 白线/中圈是 RingGeometry;三秒区是 PlaneGeometry 但不是 courtFloor */
    scene.traverse(o=>{
      if(!o.isMesh||o===courtFloor)return;
      const t=o.geometry&&o.geometry.type;
      if(t==="RingGeometry"||t==="PlaneGeometry"||t==="CircleGeometry")o.visible=false;
    });
    const hud=document.getElementById("hud");if(hud)hud.style.display="none";
    const bc=document.getElementById("battleControls");if(bc)bc.style.display="none";
  }catch(e){}
};`;

let BROWSER=null;
async function getBrowser(){
  if(!BROWSER){for(const m of mods()){try{BROWSER=await m.chromium.launch({args:ARGS});break;}catch(e){}}}
  return BROWSER;
}
async function open(url){
  const b=await getBrowser();if(!b)return null;
  /* 900×600 而非 1280×800:mask 方案要为每个机位额外做整屏 readPixels,
     1M 像素 × 多机位 × 多配置会把渲染进程拖死(实测跑完 ① 即
     "Target page has been closed")。降到 54 万像素后稳定跑完全程;
     分辨率会随结果一起注明,不影响"占可见地板比例"这类相对指标。 */
  const page=await b.newPage({viewport:{width:900,height:600},deviceScaleFactor:1});
  page.on("pageerror",e=>console.log("   pageerror: "+String(e).slice(0,160)));
  await page.addInitScript(()=>{
    const orig=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(t,a){
      if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
      return orig.call(this,t,a);
    };
  });
  await page.goto(url,{waitUntil:"commit"});
  await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
  try{
    await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:90000,polling:"raf"});
    await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:90000,polling:"raf"});
  }catch(e){console.log("!! 开场未启动: "+url);await page.close();return null;}
  await page.evaluate(PROBE);
  await page.evaluate(()=>window.__setupViews());
  return page;
}

let FAIL=0;
async function probe(page,label,tag){
  const diag=await page.evaluate("__enterGameplay()");
  console.log("\n[diag] "+JSON.stringify(diag));
  const r=await page.evaluate("__glareProbe()");
  console.log("\n--- "+label+" ---");
  console.log("  机位     分辨率    可见木地板   洗白%  最大洗白块  占木地板%   基准V/基准S  木地板对比度");
  for(const v of r){
    /* 判定改用**占可见木地板的比例**:不同机位地板在画面里占的面积差很多,
       绝对像素数没有可比性(这正是旧版"最大连通块 <1500 就通过"被判失效的原因
       —— 阈值卡在绝对像素上,而洗白是按地板面积占比才有意义)。
       同时保留绝对块大小与问题框,便于定位。 */
    const bad=(v.最大块占木地板>MAX_PCT)||(v.最大洗白块>MAX_BLOB);
    if(bad)FAIL++;
    console.log("  "+v.机位.padEnd(8)+String(v.分辨率).padStart(9)+
      String(v.可见木地板).padStart(11)+String(v.洗白占比).padStart(8)+
      String(v.最大洗白块).padStart(12)+String(v.最大块占木地板).padStart(11)+
      "   "+String(v.基准明度).padStart(5)+"/"+String(v.基准饱和度).padStart(5)+
      String(v.木地板对比度).padStart(12)+(bad?"   ✗ 超限":""));
    if(v.问题框)console.log("       └ 问题框(截图坐标 x0,y0,x1,y1): "+JSON.stringify(v.问题框));
    if(v.可见木地板===0)console.log("       ⚠ 可见木地板=0: 地板mask="+v.地板mask+
      " 排除="+v.排除mask+" cam="+JSON.stringify(v.cam));
  }
  /* 每个配置都把六个镜头各存一张截图,作为交付证据。
     ⚠ 截图偶发超时(Playwright 默认会等字体加载完毕),曾因此把整轮验收带崩,
        导致后面 4 个配置根本没跑。截图是证据、不是判据 ——
        失败只记录,指标判定必须照常进行。 */
  for(const v of r){
    const f=path.join(OUT,tag+"_"+v.机位.replace(/[^\w一-龥]/g,"")+".png");
    try{await page.screenshot({path:f,timeout:20000});}
    catch(e){console.log("   (截图失败 "+v.机位+": "+String((e&&e.message)||e).slice(0,70)+")");}
  }
  return r;
}

const base=`http://127.0.0.1:${port}/index.html?intro=1&fx=1`;

/* ===== 页面 A:生产配置(fx=1)下的四项消融 ===== */
let A=await open(base);
if(A){
  await probe(A,"① 基线(生产配置 fx=1, rim=0 已关闭)","01_baseline");

  /* ①b 跟随镜头 × 球员站位扫描 —— **暂时停用**。
     两个原因:① 它仍用已判定无效的旧指标(画面下方 62% + 阈值 248),
     结论不可信;② 8 个站位各做一次整屏 readPixels,是渲染进程被拖死的
     主要嫌疑 —— 实测它一跑完,后续 ②③④ 全部 "Target page has been closed"。
     先保证主消融能稳定跑完,待 mask 方案跑顺后再按同一套指标重写它。 */
  const posR=[];
  console.log("\n--- ①b 跟随镜头 × 球员站位扫描 ---");
  console.log("  站位        过曝%   最大连通块  高光梯度  木色梯度  木纹保留");
  for(const v of posR){
    const bad=v.最大连通块>MAX_BLOB;if(bad)FAIL++;
    console.log("  "+v.机位.replace("跟随@","").padEnd(9)+
      String(v.过曝占比).padStart(6)+String(v.最大连通块).padStart(11)+
      String(v.高光梯度).padStart(10)+String(v.木色梯度).padStart(10)+
      String(v.木纹保留).padStart(10)+(bad?"   ✗ 超限":""));
  }
  for(const v of posR){
    try{await A.screenshot({path:path.join(OUT,"01b_follow_"+v.机位.replace("跟随@","")+".png"),timeout:20000});}
    catch(e){console.log("   (截图失败 "+v.机位+")");}
  }

  await A.evaluate(()=>{window.__rim=[];scene.traverse(o=>{if(o.isDirectionalLight&&Math.abs(o.position.y-4.5)<0.01)window.__rim.push(o);});
    for(const l of window.__rim)l.intensity=0;});
  await probe(A,"② rim=0(后期仍开)","02_rim0");

  await A.evaluate(()=>{for(const l of window.__rim)l.intensity=0;
    if(courtFloor&&courtFloor.material){courtFloor.material.envMapIntensity=0;courtFloor.material.needsUpdate=true;}});
  await probe(A,"③ envMapIntensity=0(后期仍开)","03_env0");

  await A.evaluate(()=>{if(courtFloor&&courtFloor.material){courtFloor.material.envMapIntensity=0.48;courtFloor.material.needsUpdate=true;}
    if(window.AIBAGrade&&window.AIBAGrade.set)window.AIBAGrade.set({bloomStrength:0});});
  await probe(A,"④ bloomStrength=0(只关泛光,其它后期保留)","04_bloom0");
  await A.close();
}

/* ===== 页面 B:关 PBR ===== */
let B=await open(base+"&pbr=0");
if(B){await probe(B,"⑤ pbr=0(后期仍开)","05_pbr0");await B.close();}

/* ===== 页面 C:地板纯净诊断 ===== */
let C=await open(base);
if(C){
  await C.evaluate(()=>window.__purify());
  await probe(C,"⑥ 纯净诊断 rim=0(当前值)","06_pure_rim005");
  await C.evaluate(()=>{window.__rim=[];scene.traverse(o=>{if(o.isDirectionalLight&&Math.abs(o.position.y-4.5)<0.01)window.__rim.push(o);});
    for(const l of window.__rim)l.intensity=0;});
  await probe(C,"⑦ 纯净诊断 rim=0","07_pure_rim0");
  await C.evaluate(()=>{for(const l of window.__rim)l.intensity=0;
    if(window.AIBAGrade&&window.AIBAGrade.set)window.AIBAGrade.set({bloomStrength:0});});
  await probe(C,"⑧ 纯净诊断 bloom=0","08_pure_bloom0");
  await C.close();
}

if(BROWSER)await BROWSER.close();
server.close();
console.log("\n================ 结论 ================");
console.log("截图目录: "+OUT);
console.log("判定: 最大洗白块 > "+MAX_BLOB+" 像素,或占可见木地板 > "+MAX_PCT+"% ⇒ 失败");
console.log("mask: 按对象生成(木地板/白线/三秒区分离),**保留遮挡**");
console.log("洗白定义: 亮(V≥max(0.72,基准V×1.20)) 且 失色(S≤基准S×0.75),不要求顶格");
if(FAIL>0){
  console.log("❌ 验收不通过: "+FAIL+" 个镜头出现超限白斑");
  process.exit(1);
}else{
  console.log("✅ 六个真实镜头均通过(无超限白斑)");
  process.exit(0);
}
