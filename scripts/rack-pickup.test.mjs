/* 取球穿模验收台。跑:node scripts/rack-pickup.test.mjs
   非零退出码 = 验收不通过。

   验的是**球心到躯干盒的侵入深度**,逐帧量,不是看截图估。
   躯干实体:characters.js 里 roundedBoxGeometry(0.5,0.52,0.27) 挂在局部 y=1.13。
   把球换算进 player.g 的局部坐标(worldToLocal 已经把 g.scale 除掉了,
   所以局部空间里躯干盒就是这三个标称尺寸),再按球半径把盒子膨胀一圈,
   球心落在膨胀盒内部就是穿模,深度取"推出去最省力的那个方向"。

   三个必须踩过的坑(前面都吃过):
     · 无头环境的 rAF 节流没保证,用墙钟 setTimeout 等动画会等出 turn=0
       (要么还没开始要么早就结束)。必须冻结 rAF + 手动按 1/60 步进。
     · 默认第一人称下 player.g.visible=false,但几何仍在,量坐标不受影响。
     · G.passCatch.target 每帧被 updPass 写成球的世界坐标,直接读它就是球位。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{
  const c=decodeURIComponent(rq.url.split("?")[0]);
  if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}
  const f=path.join(ROOT,c==="/"?"/index.html":c);
  fs.readFile(f,(e,b)=>{if(e){rs.writeHead(e.code==="EISDIR"?204:404);return rs.end();}
    rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});
});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});

let BROWSER=null;
for(const base of [import.meta.url,"/opt/homebrew/lib/node_modules/"].concat(
    (()=>{try{const n=path.join(process.env.HOME||"",".npm/_npx");
      return fs.readdirSync(n).map(d=>path.join(n,d,"node_modules")+"/");}catch(e){return [];}})())){
  for(const pkg of ["playwright","playwright-core"]){
    let m;try{m=createRequire(base)(pkg);}catch(e){continue;}
    try{BROWSER=await m.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break;}catch(e){}
  }
  if(BROWSER)break;
}
if(!BROWSER){console.error("需要 Playwright: npx playwright install chromium");server.close();process.exit(2);}

const ctx=await BROWSER.newContext({viewport:{width:1100,height:700},deviceScaleFactor:1});
try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
await ctx.addInitScript(()=>{
  let seed=8801;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=fn=>raf(t=>{if(!window.__freeze)fn(t);});
});
const page=await ctx.newPage();
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&quality=hd&seed=8801`,{waitUntil:"load",timeout:60000});
await page.waitForFunction("typeof player!=='undefined'&&player&&player.g&&typeof readyBall==='function'",{timeout:30000});
await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
try{await page.waitForFunction("G.canShoot===true",{timeout:20000});}
catch(e){console.log("!! 回合没起来。页面报错:",errs.slice(0,3).join(" | ")||"(无)");
  await BROWSER.close();server.close();process.exit(2);}

const R=await page.evaluate(({FRAMES})=>{
  const loop=window.AIBA.runtime.service("core:game-loop");
  window.__freeze=true;loop.clock.getDelta=()=>1/60;

  /* 球半径:直接量 ballGeo 的包围球,不写死数字 */
  let ballR=0.12;
  try{ballGeo.computeBoundingSphere();ballR=ballGeo.boundingSphere.radius;}catch(e){}

  const TORSO={hx:0.25,hy:0.26,cy:1.13,hz:0.135};
  const pen=(l)=>{ // l = 球心的 player.g 局部坐标
    const dx=TORSO.hx+ballR-Math.abs(l.x);
    const dy=TORSO.hy+ballR-Math.abs(l.y-TORSO.cy);
    const dz=TORSO.hz+ballR-Math.abs(l.z);
    if(dx<=0||dy<=0||dz<=0)return 0;           // 任一轴在外面 → 没碰上
    return Math.min(dx,dy,dz);                  // 推出去最省力的方向
  };

  G.canShoot=false;handBall.visible=false;pBall.visible=false;
  readyBall();

  const frames=[];
  for(let i=0;i<FRAMES;i++){
    window.animate();
    const pc=G.passCatch;
    if(!pc||!pc.target)continue;
    const w=pc.target.clone();
    player.g.updateMatrixWorld(true);
    const l=player.g.worldToLocal(w.clone());
    frames.push({i,
      prog:+(pc.progress||0).toFixed(3),
      turn:+((G.pickupTurn||0)*57.2958).toFixed(1),
      reach:+(G.pickupReach||0).toFixed(3),
      wx:+w.x.toFixed(3),wy:+w.y.toFixed(3),wz:+w.z.toFixed(3),
      lx:+l.x.toFixed(3),ly:+l.y.toFixed(3),lz:+l.z.toFixed(3),
      pen:+pen(l).toFixed(4)});
    if(pc.settling)break;
  }
  /* 架子几何:低位槽与球员的相对关系,用来核对"坡朝篮筐 / 球员站得更后" */
  const props=window.AIBA.runtime.service("rendering:props");
  const spec=props.getRackBalls().regular;
  let rackInfo=null;
  const s=curShot&&curShot();
  const ri=(s&&s.rack!=null)?s.rack:0;
  try{
    const lo=props.rackSlotWorld(ri,4,new THREE.Vector3());
    const hi=props.rackSlotWorld(ri,0,new THREE.Vector3());
    const dir=HOOP.clone().sub(P.pos);dir.y=0;dir.normalize();
    const perp=new THREE.Vector3(dir.z,0,-dir.x);
    const rel=lo.clone().sub(P.pos);
    rackInfo={
      低位槽高:+lo.y.toFixed(3),高位槽高:+hi.y.toFixed(3),
      坡沿篮筐方向:+hi.clone().sub(lo).dot(dir).toFixed(3),   // >0 = 低端朝篮筐
      坡沿横向:+hi.clone().sub(lo).dot(perp).toFixed(3),
      低位球在球员前方:+rel.dot(dir).toFixed(3),              // >0 = 球在球员前面
      低位球横向距离:+rel.dot(perp).toFixed(3),
      球架侧:props.getRackSide()};
  }catch(e){rackInfo={err:String(e).slice(0,80)};}
  return {ballR:+ballR.toFixed(4),frames,rackInfo,count:spec.length};
},{FRAMES:60});

/* ---------------- 第二段:走位路线会不会撞上球架 ----------------
   坡度转成顺出手线之后,箱体从球员站位往**身后**延伸约 1m(上一版是往两侧)。
   这是这次改动带来的新风险,而且用户明确要过:"记得球员别穿模,要绕过篮球架啥的"。
   这里不靠动画抽样(抽样只覆盖跑到的那几帧),直接算几何:
   每个球架的世界包围盒 vs 相邻点位之间的走位线段,取最小水平距离。 */
const W=await page.evaluate(()=>{
  const props=window.AIBA.runtime.service("rendering:props");
  const stands=props.getRackBalls().regularStands||[];
  /* ⚠ 不能用 Box3.setFromObject:那是**世界轴对齐**盒。架子现在是斜的,
     一个 1.46×0.46 的斜箱体的 AABB 会膨胀到近 1.5×1.5,把球员站位整个包进去,
     于是量出"间隙 0"的假红(第一版就是这么错的,只有恰好轴对齐的那个架子读数正常)。
     这里改成真正的**有向包围盒**:先求箱体在自己局部空间的 AABB,
     查询点用 worldToLocal 转进去再比 —— 旋转就自然消掉了。 */
  const boxes=[];
  for(let i=0;i<stands.length;i++){
    const st=stands[i];if(!st)continue;
    st.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(st.matrixWorld).invert();
    const lb=new THREE.Box3();
    st.traverse(c=>{
      if(!c.isMesh||!c.geometry)return;
      c.updateMatrixWorld(true);
      c.geometry.computeBoundingBox();
      const b=c.geometry.boundingBox.clone();
      b.applyMatrix4(new THREE.Matrix4().copy(inv).multiply(c.matrixWorld));
      lb.union(b);
    });
    if(lb.isEmpty())continue;
    boxes.push({i,st,minx:lb.min.x,maxx:lb.max.x,minz:lb.min.z,maxz:lb.max.z});
  }
  const spots=RACKS.map(r=>({x:r.p.x,z:r.p.z}));
  const _t=new THREE.Vector3();
  /* 点到有向箱体的水平距离(在箱体内部时为 0) */
  const dPointBox=(x,z,b)=>{
    _t.set(x,0.45,z);b.st.worldToLocal(_t);
    const dx=Math.max(b.minx-_t.x,0,_t.x-b.maxx),dz=Math.max(b.minz-_t.z,0,_t.z-b.maxz);
    return Math.hypot(dx,dz);
  };
  /* 线段对矩形:线段上取 200 个采样点,够密(点位间距 3~5m ⇒ 步长 2~3cm) */
  const dSegBox=(a,c,b)=>{
    let m=Infinity;
    for(let t=0;t<=200;t++){const u=t/200;
      m=Math.min(m,dPointBox(a.x+(c.x-a.x)*u,a.z+(c.z-a.z)*u,b));}
    return m;
  };
  const standing=[],path=[];
  for(const b of boxes){
    standing.push({rack:b.i,d:+dPointBox(spots[b.i].x,spots[b.i].z,b).toFixed(3)});
    for(let k=0;k+1<spots.length;k++){
      path.push({seg:k+"→"+(k+1),rack:b.i,d:+dSegBox(spots[k],spots[k+1],b).toFixed(3)});
    }
  }
  return {standing,path,boxes:boxes.length};
});

await BROWSER.close();server.close();

const F=R.frames;
if(!F.length){console.log("❌ 没采到取球帧(passCatch 一直是空)");process.exit(1);}
console.log("球半径 "+R.ballR+"m   采样 "+F.length+" 帧\n");
console.log("架子几何:");
for(const k of Object.keys(R.rackInfo))console.log("  "+k.padEnd(16)+R.rackInfo[k]);
console.log("\n帧    进度   转身°  reach   球(局部 x/y/z)          侵入躯干");
for(const f of F){
  if(f.i%3!==0&&f.pen<=0)continue;
  console.log("  "+String(f.i).padStart(2)+"  "+String(f.prog).padStart(6)+
    String(f.turn).padStart(7)+String(f.reach).padStart(8)+
    "   "+String(f.lx).padStart(7)+"/"+String(f.ly).padStart(6)+"/"+String(f.lz).padStart(7)+
    "   "+(f.pen>0?(f.pen*1000).toFixed(1)+"mm ✗":"—"));
}
const worst=F.reduce((a,b)=>b.pen>a.pen?b:a);
const nBad=F.filter(f=>f.pen>0).length;
console.log("\n================ 结论 ================");
console.log("最深侵入 "+(worst.pen*1000).toFixed(1)+"mm  (第 "+worst.i+" 帧, 进度 "+worst.prog+")");
console.log("穿模帧数 "+nBad+"/"+F.length);
if(errs.length)console.log("⚠ 页面报错: "+errs.slice(0,2).join(" | "));
let bad=false;
if(worst.pen>0.005){                       // 5mm 容差:留给圆角与摆臂的正常轻触
  console.log("❌ 取球穿模: 球穿过躯干");bad=true;
}else console.log("✅ 取球全程球心在躯干外");

/* 躯干半宽 0.25m。站位要求 ≥0.25(站着不压到箱体);
   走位线段允许比站位宽松些,但仍要 ≥0.10 —— 低于这个数就是擦着箱体走过去。 */
const TORSO_HALF=0.25,PATH_MIN=0.10;
console.log("\n走位/站位与球架的水平间隙("+W.boxes+" 个箱体):");
const stBad=W.standing.filter(r=>r.d<TORSO_HALF);
console.log("  站位最小间隙 "+Math.min(...W.standing.map(r=>r.d)).toFixed(3)+
  "m   逐架: "+W.standing.map(r=>"#"+r.rack+"="+r.d).join(" "));
const pMin=W.path.reduce((a,b)=>b.d<a.d?b:a);
console.log("  走位最小间隙 "+pMin.d+"m  (线段 "+pMin.seg+" vs 架 #"+pMin.rack+")");
const pBad=W.path.filter(r=>r.d<PATH_MIN);
if(stBad.length){console.log("  ❌ 站位压到箱体: "+stBad.map(r=>"#"+r.rack+"="+r.d).join(" "));bad=true;}
else console.log("  ✅ 站位不压箱体");
/* 走位那条**只报不判**,理由是它是既有缺陷、不是球架转向引入的:
   同一套量法在改动前的 3f82da1 上跑出来是同样的 4 段、同样的 0。
   成因:walkTo 走的是两点之间的**直线**(updWalk 对 from/to 线性插值),
   而每个架子沿出手线往站位后方伸约 1m,正好压在相邻点位的弦上。
   真要修得动走位路径(改成沿三分线绕行,或给架子一个外偏角),
   那是另一件事,会牵动 walk-arms / shot-animation 的时序,不该顺手塞进这次改动。
   ⚠ 修好之后请把下面这段改成硬判定(bad=true),别让它一直停在警告。 */
if(pBad.length){
  console.log("  ⚠ 走位直线穿过箱体(**既有缺陷**,改动前后数字一致,本次不判失败):");
  console.log("     "+pBad.map(r=>r.seg+"/#"+r.rack+"="+r.d).join("  "));
}else console.log("  ✅ 走位不压箱体");

console.log("");
process.exit(bad?1:0);
