/* T台投篮动作切换回归。
   验证无参数入口默认采用 release-feet、显式 ?shotAnim=game 仍保留原版动作、
   ?shotAnim=tstage 能驱动 shot_cycle，且 ?shotAnim=release-feet 只叠加 release
   下肢；蓄力/出手时两侧手臂仍有完整网格。
   非音频测试会先静音。 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"captures","shot-animation");
fs.mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      const clean=decodeURIComponent((req.url||"/").split("?")[0]);
      if(clean==="/favicon.ico"){res.writeHead(204);return res.end();}
      const file=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!file.startsWith(ROOT)){res.writeHead(403);return res.end("no");}
      fs.readFile(file,(err,buf)=>{
        if(err){res.writeHead(404);return res.end("404 "+clean);}
        res.writeHead(200,{"content-type":MIME[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
        res.end(buf);
      });
    });
    server.listen(0,"127.0.0.1",()=>resolve({server,port:server.address().port}));
  });
}

function playwrightCandidates(){
  const out=[],seen=new Set();
  const push=base=>{
    for(const pkg of ["playwright","playwright-core"]){
      try{const mod=createRequire(base)(pkg);if(mod?.chromium&&!seen.has(mod)){seen.add(mod);out.push(mod);}}catch(e){}
    }
  };
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");
  return out;
}

async function launchBrowser(){
  const problems=[];
  for(const mod of playwrightCandidates()){
    try{return await mod.chromium.launch({headless:true});}catch(e){problems.push(e.message.split("\n")[0]);}
    try{return await mod.chromium.launch({channel:"chrome",headless:true});}catch(e){problems.push(e.message.split("\n")[0]);}
  }
  throw new Error("Playwright 起不来浏览器: "+problems.slice(0,3).join(" | "));
}

const check=(ok,msg)=>console.log(`${ok?"  PASS  ":"  FAIL  "}${msg}`);
let failures=0;
const assert=(ok,msg)=>{if(!ok)failures++;check(ok,msg);};

async function boot(page,port,mode){
  const shotParam=mode?`&shotAnim=${encodeURIComponent(mode)}`:"";
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20260830${shotParam}`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(response=>response.text()).then(code=>eval(code));
  });
  await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof startRound==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  await page.waitForFunction("G.state==='round'",{timeout:30000});
  await page.waitForFunction("G.canShoot===true",{timeout:30000});
  await page.waitForFunction("!G.passCatch||!G.passCatch.active",{timeout:30000});
}

function inspect(page){
  return page.evaluate(()=>{
    const o=player;
    let meshes=0;
    const arms=o.arms.map(arm=>{
      let visible=0;arm.traverse(node=>{if(node.isMesh){meshes++;if(node.visible)visible++;}});
      return {visible};
    });
    o.g.updateMatrixWorld(true);
    const p=node=>node.getWorldPosition(new THREE.Vector3());
    const lengths=o.arms.map((arm,index)=>({
      upper:p(o.elbows[index]).distanceTo(p(arm)),
      lower:p(o.handRoots[index]).distanceTo(p(o.elbows[index]))
    }));
    return {
      mode:document.documentElement.dataset.aibaShotAnimation,
      apiMode:typeof AIBA_SHOT_ANIMATION_MODE!=="undefined"?AIBA_SHOT_ANIMATION_MODE:null,
      tstage:typeof AIBASetShotAnimationMode==="function",
      tstageEnabled:typeof AIBAShotAnimation!=="undefined"&&AIBAShotAnimation.isTstage(),
      releaseFeetEnabled:typeof AIBAShotAnimation!=="undefined"&&AIBAShotAnimation.isReleaseFeet(),
      clip:typeof AIBA_TSTAGE_MOTION_PACK!=="undefined"&&AIBA_TSTAGE_MOTION_PACK.clips&&AIBA_TSTAGE_MOTION_PACK.clips.shot_cycle
        ?{duration:AIBA_TSTAGE_MOTION_PACK.clips.shot_cycle.duration,frames:AIBA_TSTAGE_MOTION_PACK.clips.shot_cycle.keyframes.length}:null,
      gameState:{state:G.state,canShoot:!!G.canShoot,charging:!!G.charging,moving:!!G.moving,walking:!!P.walking,power:G.power,jump:Number(P.jump)||0},
      source:o.g.userData.tstageShotSource||null,
      phase:Number.isFinite(o.g.userData.tstageShotPhase)?o.g.userData.tstageShotPhase:null,
      duration:o.g.userData.tstageShotDuration||null,
      releaseFeet:{
        source:o.g.userData.releaseFeetSource||null,
        weight:Number.isFinite(o.g.userData.releaseFeetWeight)?o.g.userData.releaseFeetWeight:null,
        kickWeight:Number.isFinite(o.g.userData.releaseFeetKickWeight)?o.g.userData.releaseFeetKickWeight:null,
        airborne:o.g.userData.releaseFeetAirborne===true,
        landBlend:Number.isFinite(o.g.userData.releaseFeetLandBlend)?o.g.userData.releaseFeetLandBlend:null,
        recover:Number.isFinite(o.g.userData.releaseFeetRecover)?o.g.userData.releaseFeetRecover:null,
        joints:o.legs.map((leg,index)=>({hip:leg.rotation.x,knee:o.knees[index].rotation.x,ankle:o.ankles[index].rotation.x,foot:o.footRoots[index].rotation.x,toe:o.toeRoots[index].rotation.x})),
      },
      motionStats:typeof AIBAMotion!=="undefined"&&AIBAMotion.stats?AIBAMotion.stats():null,
      arms,meshes,lengths,
      legs:o.legs.map((leg,index)=>{
        const point=node=>{const v=node.getWorldPosition(new THREE.Vector3()).applyQuaternion(o.g.getWorldQuaternion(new THREE.Quaternion()).invert());return {x:v.x,y:v.y,z:v.z};};
        return {hip:leg.rotation.x,knee:o.knees[index].rotation.x,ankle:o.ankles[index].rotation.x,shoe:o.shoes[index].rotation.x,
          hipPoint:point(leg),kneePoint:point(o.knees[index]),anklePoint:point(o.ankles[index])};
      }),
    };
  });
}

const {server,port}=await serve();
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:760,height:820},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await boot(page,port,null);
  const defaultReady=await inspect(page);
  assert(defaultReady.mode==="release-feet"&&defaultReady.releaseFeetEnabled,
    "无参数游戏入口默认启用空中踢腿版，且动作库仍可切换");
  assert(!defaultReady.releaseFeet.source,"无参数入口待机阶段不提前写入踢腿");

  await boot(page,port,"game");
  const gameReady=await inspect(page);
  assert(gameReady.mode==="game","显式 ?shotAnim=game 保持原版投篮动作");
  assert(gameReady.tstage,"投篮动作切换接口已加载");
  await page.evaluate(()=>startCharge());
  await page.waitForTimeout(160);
  const gameCharge=await inspect(page);
  assert(gameCharge.mode==="game"&&!gameCharge.source,"game 模式蓄力不写入 T台 shot_cycle");
  await page.evaluate(()=>{G.power=weatherAdjustedIdeal(curShot(),true);doRelease();});
  await page.waitForTimeout(100);
  const gameRelease=await inspect(page);
  console.log("  METRIC game-release="+JSON.stringify({state:gameRelease.gameState,joints:gameRelease.legs.map(l=>({hip:+l.hip.toFixed(3),knee:+l.knee.toFixed(3),ankle:+l.ankle.toFixed(3)}))}));
  await page.screenshot({path:path.join(OUT,"game-release-air.png")});

  await boot(page,port,"tstage");
  const tstageReady=await inspect(page);
  assert(tstageReady.mode==="tstage","?shotAnim=tstage 进入 T台版");
  await page.evaluate(()=>startCharge());
  await page.waitForTimeout(180);
  const tstageCharge=await inspect(page);
  assert(tstageCharge.mode==="tstage"&&tstageCharge.source&&tstageCharge.phase>0,"蓄力阶段驱动 T台时间轴");
  assert(tstageCharge.duration===1.8,"游戏读取 T台当前总时长 1.8s");
  assert(tstageCharge.arms.every(arm=>arm.visible>0),"T台蓄力阶段两侧手臂网格完整可见");
  assert(tstageCharge.lengths.every(length=>length.upper>.18&&length.lower>.2),"T台蓄力阶段肩-肘-腕骨段未断开");

  await page.evaluate(()=>{G.power=weatherAdjustedIdeal(curShot(),true);doRelease();});
  await page.waitForTimeout(180);
  const tstageRelease=await inspect(page);
  assert(tstageRelease.source&&tstageRelease.phase>tstageCharge.phase,"出手后 T台时间轴继续向前推进");
  assert(tstageRelease.arms.every(arm=>arm.visible>0),"T台出手阶段两侧手臂网格完整可见");

  await boot(page,port,"release-feet");
  const releaseFeetReady=await inspect(page);
  assert(releaseFeetReady.mode==="release-feet"&&releaseFeetReady.releaseFeetEnabled,
    "?shotAnim=release-feet 进入第三种下肢混合版");
  assert(!releaseFeetReady.releaseFeet.source,"第三种待机阶段保留原版 game 下肢");
  await page.evaluate(()=>startCharge());
  await page.waitForTimeout(420);
  const releaseFeetCharge=await inspect(page);
  assert(!releaseFeetCharge.releaseFeet.source&&releaseFeetCharge.releaseFeet.weight===null,
    "第三种地面蓄力阶段保持原版 game 下肢，不提前踢腿");
  assert(releaseFeetCharge.arms.every(arm=>arm.visible>0),"第三种蓄力阶段两侧手臂网格完整可见");
  assert(releaseFeetCharge.legs.every(leg=>[leg.hip,leg.knee,leg.ankle,leg.shoe].every(Number.isFinite)),
    "第三种蓄力阶段下肢关节数据有限且未丢失");

  /* 等到游戏物理已经越过 takeoff，再释放；验证踢腿的触发依据是真正离地，
     而不是“按下蓄力过了多少毫秒”。 */
  await page.waitForTimeout(360);
  const airborneCharge=await inspect(page);
  assert(airborneCharge.gameState.charging&&!airborneCharge.releaseFeet.source,
    "第三种越过起跳点但尚未出手时仍不提前写入踢腿");
  await page.evaluate(()=>{G.power=weatherAdjustedIdeal(curShot(),true);doRelease();});
  /* 不用固定毫秒猜峰值：等运行时明确报告 airborne，避免浏览器调度稍慢时
     截到刚松手、尚未起跳的旧腿姿势。 */
  await page.waitForFunction("player.g.userData.releaseFeetAirborne===true&&player.g.userData.releaseFeetKickWeight>.5",{timeout:3000});
  const releaseFeetRelease=await inspect(page);
  await page.evaluate(()=>{
    const g=AIBA.runtime.service("legacy"),d=new THREE.Vector3(Math.sin(g.P.face),0,Math.cos(g.P.face)),side=new THREE.Vector3(d.z,0,-d.x);
    g.G.glideCam=true;
    g.CAM.mode=1;g.applyCamMode();
    g.rig.pos.copy(g.P.pos).addScaledVector(d,2.35).addScaledVector(side,.9);g.rig.pos.y=1.38;
    g.rig.look.copy(g.P.pos);g.rig.look.y=1.02;
  });
  await page.waitForTimeout(80);
  await page.screenshot({path:path.join(OUT,"release-feet-air.png")});
  await page.evaluate(()=>{
    const g=AIBA.runtime.service("legacy"),d=new THREE.Vector3(Math.sin(g.P.face),0,Math.cos(g.P.face)),side=new THREE.Vector3(d.z,0,-d.x);
    g.rig.pos.copy(g.P.pos).addScaledVector(d,.45).addScaledVector(side,2.4);g.rig.pos.y=1.18;
    g.rig.look.copy(g.P.pos);g.rig.look.y=1.0;
  });
  await page.waitForTimeout(60);
  await page.screenshot({path:path.join(OUT,"release-feet-air-side.png")});
  assert((releaseFeetRelease.releaseFeet.source==="shot_release"||releaseFeetRelease.releaseFeet.source==="release_keep_land")&&
    releaseFeetRelease.releaseFeet.airborne&&releaseFeetRelease.gameState.jump>.2&&
    releaseFeetRelease.releaseFeet.weight>.5&&releaseFeetRelease.releaseFeet.weight<=.75,
    "第三种空中出手阶段才采用小幅 release/落地下肢目标");
  console.log("  METRIC release-feet="+JSON.stringify({state:releaseFeetRelease.gameState,joints:releaseFeetRelease.releaseFeet.joints.map(j=>Object.fromEntries(Object.entries(j).map(([k,v])=>[k,+v.toFixed(3)]))),legs:releaseFeetRelease.legs.map(l=>({knee:+l.kneePoint.z.toFixed(3),ankle:+l.anklePoint.z.toFixed(3)})),weight:releaseFeetRelease.releaseFeet.weight,kickWeight:releaseFeetRelease.releaseFeet.kickWeight,landBlend:releaseFeetRelease.releaseFeet.landBlend,recover:releaseFeetRelease.releaseFeet.recover}));
  const releaseJoints=releaseFeetRelease.releaseFeet.joints;
  assert(releaseJoints[0].ankle-releaseJoints[1].ankle>.16&&releaseJoints[0].hip<-.18,
    "空中释放帧保留可辨识的单侧踢腿，而不是两腿直落");
  const kickReach=Math.abs(releaseFeetRelease.legs[0].anklePoint.z-releaseFeetRelease.legs[1].anklePoint.z);
  console.log("  METRIC release-feet-kick-reach="+kickReach.toFixed(3));
  assert(kickReach>.16,"空中出手腿相对另一条腿有可见的前送距离");
  assert(releaseFeetRelease.arms.every(arm=>arm.visible>0),"第三种出手阶段保留原版双臂网格");

  await page.evaluate(()=>AIBASetShotAnimationMode("game"));
  await page.waitForTimeout(80);
  const switched=await inspect(page);
  assert(switched.mode==="game"&&!switched.releaseFeetEnabled,"运行时可切回 game 模式");

  /* 松手瞬间身体不能先掉再弹。以前理想力度松手后 base.jmp 塌回 rise，根节点
     0.565→0.457→0.561(120fps)，第一人称视线也跟着沉一下；空中踢腿的落脚补偿
     又会把根节点往下拽 1–2cm 再弹回。按固定帧长手动推进，小踢腿(库里)和大踢腿
     (乔丹)各投早/准/晚三档，松手前后 0.1s 内不允许 >1cm 的回跳。 */
  for(const star of ["curry","j23"])for(const ratio of [.85,1,1.15]){
    await page.goto("about:blank");
    await page.addInitScript(id=>{try{localStorage.setItem("aiba_selected_star_v1",id);}catch(e){}},star);
    await boot(page,port,null);
    const probe=await page.evaluate(({star,ratio})=>{
      window.requestAnimationFrame=()=>0;
      const DT=1/120;AIBA.runtime.service("core:game-loop").clock.getDelta=()=>DT;
      for(let i=0;i<10;i++)window.animate();
      if(!startCharge())return {error:"startCharge failed"};
      const target=weatherAdjustedIdeal(curShot(),true)*ratio;
      const ys=[];let rel=-1;
      for(let f=0;f<400&&(rel<0||f<=rel+12);f++){
        if(rel<0&&G.power>=target-1){G.power=target;doRelease();rel=f;}
        window.animate();ys.push(player.g.position.y);
      }
      if(rel<0)return {error:"never released"};
      const seg=ys.slice(Math.max(0,rel-12),rel+13);
      let rebound=0;
      for(let i=1;i<seg.length;i++)for(let j=i;j<seg.length;j++){
        const low=Math.min(...seg.slice(i,j+1));
        rebound=Math.max(rebound,Math.min(seg[i-1],seg[j])-low);
      }
      return {rebound,style:player.shotStyle&&player.shotStyle.kick};
    },{star,ratio});
    const tag=`${star} 力度×${ratio}`;
    if(probe.error){assert(false,`${tag} 松手探针失败: ${probe.error}`);continue;}
    console.log(`  METRIC release-root-rebound ${star} x${ratio}=${(probe.rebound*100).toFixed(2)}cm kick=${probe.style}`);
    assert(probe.rebound<.01,`${tag} 松手前后 0.1s 根节点无 >1cm 回跳(实际 ${(probe.rebound*100).toFixed(2)}cm)`);
  }

  /* 绝杀模式出手要和普通模式同一套动作。以前 updateBodyState 每帧把 g.y 按回 0(蓄力时人不离地)，
     松手到球离手那 0.09s 又被当成"等传球"摆张手要球(g.y=-0.04、持球点 1.83→1.39)，
     LS.released 一到再硬切写死的定格臂(一帧跳 0.3m)。120fps 下逐帧差分不许出现这种跳变。 */
  {
    await page.goto("about:blank");
    await page.addInitScript(()=>{try{localStorage.setItem("aiba_selected_star_v1","curry");}catch(e){}});
    await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20260830&lsSeed=off`,{waitUntil:"load"});
    await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(code=>eval(code));});
    await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof beginLastShot==='function'",{timeout:20000});
    const ls=await page.evaluate(()=>{
      window.requestAnimationFrame=()=>0;
      let DT=1/60;AIBA.runtime.service("core:game-loop").clock.getDelta=()=>DT;
      if(typeof hidePanel==="function")hidePanel();
      beginLastShot(true);
      for(let n=0;n<4000&&!(G.state==="lastshot"&&G.canShoot);n++)window.animate();
      if(!G.canShoot)return {error:"last shot never handed the ball over"};
      DT=1/120;
      if(!startCharge())return {error:"startCharge failed"};
      const target=weatherAdjustedIdeal(curShot(),true),grip=new THREE.Vector3(),rows=[];let rel=-1;
      for(let f=0;f<500&&(rel<0||f<=rel+36);f++){
        if(rel<0&&G.power>=target-1){G.power=target;doRelease();rel=f;}
        window.animate();player.g.updateMatrixWorld(true);
        rows.push([player.g.position.y,player.ballGrips[0].getWorldPosition(grip).y]);
      }
      if(rel<0)return {error:"never released"};
      const seg=rows.slice(Math.max(0,rel-36),rel+37);
      let dy=0,dg=0;
      for(let i=1;i<seg.length;i++){dy=Math.max(dy,Math.abs(seg[i][0]-seg[i-1][0]));dg=Math.max(dg,Math.abs(seg[i][1]-seg[i-1][1]));}
      return {dy,dg,releaseY:rows[rel][0]};
    });
    if(ls.error)assert(false,"绝杀出手探针失败: "+ls.error);
    else{
      console.log("  METRIC lastshot-release="+JSON.stringify({maxStepY:+ls.dy.toFixed(3),maxStepGrip:+ls.dg.toFixed(3),releaseY:+ls.releaseY.toFixed(3)}));
      assert(ls.releaseY>.3,`绝杀蓄力起跳时身体真的离地(松手时根节点 ${ls.releaseY.toFixed(3)}m)`);
      assert(ls.dy<.08&&ls.dg<.08,`绝杀松手前后 0.3s 根节点/持球点逐帧连续(最大单帧 ${ls.dy.toFixed(3)} / ${ls.dg.toFixed(3)}m)`);
    }
  }

  if(errors.length){failures++;check(false,"投篮动作预览无运行时错误: "+errors[0]);}
  else check(true,"投篮动作预览无运行时错误");
}finally{
  await browser.close();
  server.close();
}
console.log(failures?`\n${failures} 条失败`:"\n投篮动作切换回归通过");
process.exit(failures?1:0);
