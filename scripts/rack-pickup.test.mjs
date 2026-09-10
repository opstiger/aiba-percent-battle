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

/* ---------------- 第二段:走位会不会撞上球架 ----------------
   坡度转成顺出手线之后,箱体从球员站位往**身后**延伸约 1m(上一版是往两侧),
   正好压在相邻点位的弦上。用户要的解法是"走完直线最后绕过去",绕前/绕后按个人习惯。
   这里不靠动画抽样(只覆盖跑到的那几帧),直接算几何:
   把 props.rackDetourWaypoint 给出的折线拿来,逐段量到箱体的最小水平距离。

   ⚠ 必须用**有向**包围盒。Box3.setFromObject 是世界轴对齐盒,斜放的
     1.46×0.46 箱体 AABB 会膨胀到近 1.5×1.5,把站位整个包进去,量出"间隙 0"的假红。 */
const W=await page.evaluate(()=>{
  const props=window.AIBA.runtime.service("rendering:props");
  /* ⚠ 必须先钉死惯用手再量几何。球架摆哪一侧由 currentRackSide() → G.myStar 的
     惯用手决定,而 G.myStar 是开局随机选的 —— 不钉住的话,同一份代码在不同种子下
     量到的是**镜像的两套布局**,右手那套直线穿架、左手那套不穿,断言就会时红时绿。
     (实测:某次跑出 side=-1,"直线原本会撞的段 0/4",于是判定"绕行点没接进 walkTo",
      其实绕行点好好的,只是那一侧本来就不用绕。) */
  window.AIBA.runtime.service("rendering:characters");
  G.myStar={id:"curry"};                       // 右手,rackSide=+1
  props.placeRacks(props.currentRackSide());
  const spots=RACKS.map(r=>r.p);
  const CLEAR=0.34;
  const standing=[],legs=[],modes={};
  for(let i=0;i<spots.length;i++)
    standing.push({rack:i,d:+props.rackPointDist(i,spots[i].x,spots[i].z).toFixed(3)});
  for(const mode of ["front","back"]){
    const rows=[];
    for(let k=0;k+1<spots.length;k++){
      const ri=k+1,from=spots[k].clone(),to=spots[ri];
      const straight=+props.rackSegDist(ri,from.x,from.z,to.x,to.z).toFixed(3);
      const via=props.rackDetourWaypoint(ri,from,mode);
      let d,how;
      if(via){
        d=Math.min(props.rackSegDist(ri,from.x,from.z,via.x,via.z),
                   props.rackSegDist(ri,via.x,via.z,to.x,to.z));
        how="绕"+(mode==="front"?"前":"后");
      }else{d=straight;how="直行";}
      rows.push({seg:k+"→"+ri,rack:ri,straight,d:+d.toFixed(3),how});
    }
    modes[mode]=rows;
  }
  /* ---- 运行时验证:真跑一次走位,逐帧记录球员**实际**位置 ----
     上面量的是 rackDetourWaypoint 这个辅助函数的输出。它算得好,不等于
     walkTo/updWalk 真的用上了 —— 折线插值、时长按总长重算、朝向跟随分段,
     任何一处没接上,球员照样直着穿过去。所以这里必须跑真的走位链路。 */
  const loop=window.AIBA.runtime.service("core:game-loop");
  window.__freeze=true;loop.clock.getDelta=()=>1/60;
  const live={};
  for(const [mode,star] of [["front","curry"],["back","miller"]]){
    const rows=[];
    for(let k=0;k+1<spots.length;k++){
      const ri=k+1;
      const shot=(G.seq||[]).find(x=>x&&x.rack===ri);
      if(!shot){rows.push({seg:k+"→"+ri,d:null,note:"没有该架的 shot"});continue;}
      G.myStar={id:star};
      props.placeRacks(props.currentRackSide());   // 换星之后必须重新摆架,否则量的是上一位的布局
      P.pos.copy(spots[k]);P.walking=false;G.moving=false;
      walkTo(shot,function(){},{});
      let m=Infinity,n=0,dev=0;
      for(let i=0;i<600&&P.walking;i++){
        window.animate();n++;
        m=Math.min(m,props.rackPointDist(ri,P.pos.x,P.pos.z));
        /* 偏离直线多少 —— 用来确认"确实绕了",而不是恰好直线也够开 */
        const ax=spots[k].x,az=spots[k].z,bx=spots[ri].x,bz=spots[ri].z;
        const vx=bx-ax,vz=bz-az,L2=vx*vx+vz*vz;
        const t=L2>0?Math.max(0,Math.min(1,((P.pos.x-ax)*vx+(P.pos.z-az)*vz)/L2)):0;
        dev=Math.max(dev,Math.hypot(P.pos.x-(ax+vx*t),P.pos.z-(az+vz*t)));
      }
      rows.push({seg:k+"→"+ri,d:+m.toFixed(3),frames:n,dev:+dev.toFixed(2),done:!P.walking});
    }
    live[mode]=rows;
  }
  window.__freeze=false;

  const stands=props.getRackBalls().regularStands||[];
  const diag={scene:(typeof currentScenePreset!=="undefined")?currentScenePreset:"?",
    side:props.getRackSide?props.getRackSide():"?",
    stands:stands.slice(0,3).map((st,i)=>{
      if(!st)return null;
      const w=new THREE.Vector3();st.getWorldPosition(w);
      const lb=new THREE.Box3();
      st.updateMatrixWorld(true);
      const inv=new THREE.Matrix4().copy(st.matrixWorld).invert();
      st.traverse(c=>{if(!c.isMesh||!c.geometry)return;c.updateMatrixWorld(true);
        c.geometry.computeBoundingBox();const bb=c.geometry.boundingBox.clone();
        bb.applyMatrix4(new THREE.Matrix4().copy(inv).multiply(c.matrixWorld));lb.union(bb);});
      return {i,vis:st.visible,rotY:+st.rotation.y.toFixed(3),
        world:[+w.x.toFixed(2),+w.z.toFixed(2)],
        localX:[+lb.min.x.toFixed(2),+lb.max.x.toFixed(2)],
        localZ:[+lb.min.z.toFixed(2),+lb.max.z.toFixed(2)]};
    }),
    spots:spots.slice(0,3).map(p=>[+p.x.toFixed(2),+p.z.toFixed(2)])};
  return {standing,modes,CLEAR,live,diag};
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

/* 躯干半宽 0.25m,留一点余量当 0.28。 */
console.log("[diag] "+JSON.stringify(W.diag));
console.log("\n站位与球架的水平间隙:");
const stBad=W.standing.filter(r=>r.d<0.25);
console.log("  最小 "+Math.min(...W.standing.map(r=>r.d)).toFixed(3)+
  "m   逐架: "+W.standing.map(r=>"#"+r.rack+"="+r.d).join(" "));
if(stBad.length){console.log("  ❌ 站位压到箱体: "+stBad.map(r=>"#"+r.rack+"="+r.d).join(" "));bad=true;}
else console.log("  ✅ 站位不压箱体");

console.log("\n走位绕架(阈值 "+W.CLEAR+"m):");
for(const mode of ["front","back"]){
  const rows=W.modes[mode];
  const worstSeg=rows.reduce((a,b)=>b.d<a.d?b:a);
  const clipped=rows.filter(r=>r.d<W.CLEAR);
  console.log("  ["+(mode==="front"?"绕前":"绕后")+"] 最小间隙 "+worstSeg.d+
    "m ("+worstSeg.seg+")   逐段: "+rows.map(r=>r.seg+" "+r.how+"→"+r.d).join("  "));
  const detoured=rows.filter(r=>r.how!=="直行").length;
  console.log("        直线原本会撞的段: "+rows.filter(r=>r.straight<W.CLEAR).length+
    "/"+rows.length+"，实际插入绕行点: "+detoured);
  if(clipped.length){
    console.log("        ❌ 仍然穿过箱体: "+clipped.map(r=>r.seg+"="+r.d).join(" "));bad=true;
  }else console.log("        ✅ 全段不压箱体");
}

console.log("\n运行时实测(真跑 walkTo,逐帧量球员位置):");
for(const [mode,star] of [["front","库里"],["back","米勒"]]){
  const rows=W.live[mode]||[];
  const ok=rows.filter(r=>r.d!=null);
  if(!ok.length){console.log("  ["+star+"] 没采到");bad=true;continue;}
  const worst=ok.reduce((a,b)=>b.d<a.d?b:a);
  console.log("  ["+star+"/"+(mode==="front"?"绕前":"绕后")+"] 最小间隙 "+worst.d+
    "m ("+worst.seg+")   逐段: "+ok.map(r=>r.seg+"→"+r.d+"(偏离直线 "+r.dev+"m)").join("  "));
  const clip=ok.filter(r=>r.d<0.25);            // 运行时按躯干半宽判,不加余量
  const noDev=ok.filter(r=>r.dev<0.15);
  if(clip.length){console.log("        ❌ 实际走位压到箱体: "+clip.map(r=>r.seg+"="+r.d).join(" "));bad=true;}
  else if(noDev.length){console.log("        ❌ 有段几乎没偏离直线,说明绕行点没接进 walkTo: "+
    noDev.map(r=>r.seg).join(" "));bad=true;}
  else console.log("        ✅ 实际走位都绕开了箱体");
}

console.log("");
process.exit(bad?1:0);
