/* 投篮前跳后的短倒步回归。固定 120fps 推进，验证距离驱动、倒向步态、
   支撑脚稳定、逻辑站位不变，以及 NVIDIA 23 离地后不再锁脚/压骨盆。 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"captures","shot-recovery");
fs.mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      const clean=decodeURIComponent((req.url||"/").split("?")[0]);
      if(clean==="/favicon.ico"){res.writeHead(204);return res.end();}
      const file=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end("no");}
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
    try{return await mod.chromium.launch({headless:true,args:["--mute-audio"]});}catch(e){problems.push(e.message.split("\n")[0]);}
    try{return await mod.chromium.launch({channel:"chrome",headless:true,args:["--mute-audio"]});}catch(e){problems.push(e.message.split("\n")[0]);}
  }
  throw new Error("Playwright 起不来浏览器: "+problems.slice(0,3).join(" | "));
}

let failures=0;
const check=(ok,msg)=>console.log(`${ok?"  PASS  ":"  FAIL  "}${msg}`);
const assert=(ok,msg)=>{if(!ok)failures++;check(ok,msg);};

async function boot(browser,port,star){
  const context=await browser.newContext({viewport:{width:900,height:700},deviceScaleFactor:1});
  await context.addInitScript({path:path.join(ROOT,"scripts","silence-browser.js")});
  await context.addInitScript(id=>{try{localStorage.setItem("aiba_selected_star_v1",id);}catch(e){}},star);
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20261126`,{waitUntil:"load",timeout:60000});
  await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof startRound==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  await page.waitForFunction("G.state==='round'&&G.canShoot===true",{timeout:30000});
  await page.waitForFunction("!G.passCatch||!G.passCatch.active",{timeout:30000});
  if(star==="nvidia23")await page.waitForFunction("window.AIBATripo&&AIBATripo.ready&&AIBATripo.modelId==='nvidia23'&&AIBATripo.shotClipReady",{timeout:60000});
  return {page,context,errors};
}

function probe(page,randomValue){
  return page.evaluate(randomValue=>{
    window.requestAnimationFrame=()=>0;
    const DT=1/120,clock=AIBA.runtime.service("core:game-loop").clock;
    clock.getDelta=()=>DT;
    for(let i=0;i<10;i++)window.animate();
    const logical={x:P.pos.x,z:P.pos.z},start={x:player.g.position.x,z:player.g.position.z};
    const dx=HOOP.x-P.pos.x,dz=HOOP.z-P.pos.z,len=Math.hypot(dx,dz)||1,dir={x:dx/len,z:dz/len};
    const rows=[];let released=false,recoveryFrames=0,landed=false,releaseFrame=-1,randomOverride=false;
    const oldRandom=Math.random;
    if(!startCharge())return {error:"startCharge failed"};
    const target=weatherAdjustedIdeal(curShot(),true);
    for(let f=0;f<720;f++){
      if(!released&&G.power>=target-1){
        let seedRoll=0;
        Math.random=()=>{
          if(!new Error().stack.includes("seedShotTail"))return .5;
          const roll=seedRoll++;
          return roll===4?randomValue.hasSweep:roll===5?randomValue.sweep:.5;
        };
        doRelease();
        randomOverride=true;
        released=true;releaseFrame=f;
      }
      window.animate();
      const stats=AIBAMotion.stats(),rec=stats.shotRecovery,ud=player.g.userData;
      if(randomOverride&&stats.followActive){Math.random=oldRandom;randomOverride=false;}
      const rx=player.g.position.x-P.pos.x,rz=player.g.position.z-P.pos.z;
      const offset=rx*dir.x+rz*dir.z;
      const point=node=>{const p=node.getWorldPosition(new THREE.Vector3());return {x:p.x,y:p.y,z:p.z};};
      const ankles=player.ankles.map(point);
      const lengths=player.arms.map((arm,index)=>({
        upper:player.elbows[index].getWorldPosition(new THREE.Vector3()).distanceTo(arm.getWorldPosition(new THREE.Vector3())),
        lower:player.handRoots[index].getWorldPosition(new THREE.Vector3()).distanceTo(player.elbows[index].getWorldPosition(new THREE.Vector3()))
      }));
      const tripo=window.AIBATripo&&AIBATripo.ready?{
        model:AIBATripo.modelId,stanceLocked:!!AIBATripo.stanceLocked,stanceReleased:!!AIBATripo.stanceReleased,
        pelvisDrop:Number(AIBATripo.pelvisDrop)||0,recovery:!!AIBATripo.shotRecovery,
        direction:Number(AIBATripo.runDirection)||0,phase:Number(AIBATripo.phase)||0,shotW:Number(AIBATripo.shotW)||0,
        legs:["LeftUpLeg","LeftLeg","LeftFoot","RightUpLeg","RightLeg","RightFoot"].map(name=>{
          const bone=AIBATripo.root.getObjectByName(name)||AIBATripo.root.getObjectByName("mixamorig:"+name)||AIBATripo.root.getObjectByName("mixamorig"+name);return bone?point(bone):null;
        }),
        torso:["Hips","Spine2","Head"].map(name=>{
          const bone=AIBATripo.root.getObjectByName(name)||AIBATripo.root.getObjectByName("mixamorig:"+name)||AIBATripo.root.getObjectByName("mixamorig"+name);return bone?point(bone):null;
        })
      }:null;
      rows.push({f,offset,x:player.g.position.x,z:player.g.position.z,y:player.g.position.y,
        logicalX:P.pos.x,logicalZ:P.pos.z,jump:P.jump,charging:!!G.charging,walking:!!P.walking,
        recovery:rec.active,landed:rec.landed,landAge:rec.landAge,distance:rec.distance,traveled:rec.traveled,
        speed:rec.speed,duration:rec.duration,blend:rec.blend,steps:rec.steps,stepLength:rec.stepLength,
        noSlide:!!player._noSlideRun,direction:ud.runDirection,phase:ud.runPhase,stride:ud.runStride,
        hasSweep:rec.hasSweep,sweepDistance:rec.sweepDistance,
        support:ud.runFootSupport||[],grounds:ud.runFootGroundPost||ud.runFootGround||[],ankles,lengths,tripo});
      if(rec.active)recoveryFrames++;
      if(rec.landed)landed=true;
      if(released&&landed&&!rec.active&&rec.traveled>0&&Math.abs(offset)<.003)break;
    }
    return {rows,recoveryFrames,landed,logical,start,dir,releaseFrame,errors:[]};
  },randomValue);
}

async function captureRecovery(page,star){
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof startRound==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  await page.waitForFunction("G.state==='round'&&G.canShoot===true",{timeout:30000});
  if(star==="nvidia23")await page.waitForFunction("window.AIBATripo&&AIBATripo.ready&&AIBATripo.modelId==='nvidia23'",{timeout:60000});
  await page.evaluate(()=>startCharge());
  await page.waitForFunction("G.power>=weatherAdjustedIdeal(curShot(),true)-1",{timeout:30000});
  await page.evaluate(()=>{
    const oldRandom=Math.random;let seedRoll=0;
    Math.random=()=>{
      if(!new Error().stack.includes("seedShotTail"))return .5;
      const roll=seedRoll++;
      return roll===4?.1:roll===5?.99:.5;
    };
    doRelease();Math.random=oldRandom;
    window.requestAnimationFrame=()=>0;
    AIBA.runtime.service("core:game-loop").clock.getDelta=()=>1/120;
    for(let i=0;i<720;i++){
      window.animate();
      const stats=AIBAMotion.stats().shotRecovery;
      if(stats.active&&stats.blend>.8)break;
    }
    const stats=AIBAMotion.stats().shotRecovery;
    if(!stats.active||stats.blend<=.8)throw new Error("未能进入回位截图阶段");
  });
  await page.evaluate(()=>{
    const keep=new Set();
    player.g.traverse(object=>keep.add(object));
    for(let object=player.g;object;object=object.parent){keep.add(object);object.visible=true;}
    if(window.AIBATripo&&AIBATripo.ready){
      AIBATripo.root.traverse(object=>keep.add(object));
      for(let object=AIBATripo.root;object;object=object.parent)keep.add(object);
    }
    scene.traverse(object=>{
      if(!keep.has(object)&&!object.isLight&&!object.isCamera)object.visible=false;
    });
    camera.fov=38;camera.updateProjectionMatrix();
    window.__captureRecoveryFrame=fraction=>{
      for(let i=0;i<240;i++){
        const stats=AIBAMotion.stats().shotRecovery;
        if(!stats.active||stats.traveled>=stats.distance*fraction)break;
        window.animate();
      }
      const focus=player.g.position.clone();focus.y=.92;
      camera.position.copy(focus).add(new THREE.Vector3(2.6,0,0));camera.position.y=1.4;
      camera.fov=38;camera.updateProjectionMatrix();
      camera.lookAt(focus);camera.updateMatrixWorld(true);
      renderer.render(scene,camera);
      let posture=null;
      if(window.AIBATripo&&AIBATripo.ready){
        const bone=name=>AIBATripo.root.getObjectByName(name)||AIBATripo.root.getObjectByName("mixamorig:"+name)||AIBATripo.root.getObjectByName("mixamorig"+name);
        const hip=bone("Hips").getWorldPosition(new THREE.Vector3()),head=bone("Head").getWorldPosition(new THREE.Vector3());
        posture={headLift:head.y-hip.y,headReach:Math.hypot(head.x-hip.x,head.z-hip.z)};
      }
      return {traveled:AIBAMotion.stats().shotRecovery.traveled,distance:AIBAMotion.stats().shotRecovery.distance,
        posture,camera:camera.position.toArray(),worldCamera:camera.getWorldPosition(new THREE.Vector3()).toArray(),
        cameraParent:camera.parent?.name||null,zoom:camera.zoom,fov:camera.fov,
        image:renderer.domElement.toDataURL("image/png")};
    };
  });
  for(const fraction of [.25,.65,.92]){
    const metric=await page.evaluate(value=>window.__captureRecoveryFrame(value),fraction);
    const {image,...details}=metric;
    console.log(`  CAPTURE ${star} ${Math.round(fraction*100)}% ${JSON.stringify(details)}`);
    fs.writeFileSync(path.join(OUT,`${star}-backward-${Math.round(fraction*100)}-side.png`),Buffer.from(image.split(",")[1],"base64"));
    const rear=await page.evaluate(value=>{
      const focus=player.g.position.clone();
      focus.y=.92;
      camera.position.copy(focus).add(new THREE.Vector3(1.7,0,-2.1));camera.position.y=1.4;
      camera.fov=38;camera.updateProjectionMatrix();
      camera.lookAt(focus);camera.updateMatrixWorld(true);renderer.render(scene,camera);
      return renderer.domElement.toDataURL("image/png");
    },fraction);
    fs.writeFileSync(path.join(OUT,`${star}-backward-${Math.round(fraction*100)}-rear-three-quarter.png`),Buffer.from(rear.split(",")[1],"base64"));
  }
}

function inspectProbe(result,label){
  if(result.error){assert(false,`${label} 探针失败: ${result.error}`);return;}
  const rows=result.rows,recovery=rows.filter(row=>row.recovery),visual=recovery.filter(row=>row.blend>.001);
  const first=visual[0],last=visual.at(-1);
  assert(result.landed&&visual.length>=8,`${label} 落地后出现连续倒步帧`);
  if(!first||!last)return;
  assert(first.distance>=.27&&first.distance<=.441,`${label} 按真实落地偏移启动回位(${first.distance.toFixed(3)}m)`);
  assert(last.traveled>=first.distance-.002&&Math.abs(last.offset)<.003,`${label} 倒步恰好返回原点(${last.offset.toFixed(3)}m)`);
  assert(rows.every(row=>Math.hypot(row.logicalX-result.logical.x,row.logicalZ-result.logical.z)<1e-6),`${label} 全程不改逻辑站位 P.pos`);
  assert(visual.every(row=>!row.walking&&row.direction===-1&&!row.noSlide),`${label} 使用独立倒步信号且不伪装成 P.walking`);
  assert(first.steps===(first.distance>.24?2:1),`${label} 按距离选择 1–2 步`);
  assert(visual.every(row=>row.stepLength>=.12&&row.stepLength<=.24),`${label} 使用短步长(${first.stepLength.toFixed(3)}m)`);
  assert(last.phase<first.phase-.5,`${label} 步态相位由实际后退距离反向推进`);
  assert(visual.every(row=>Number.isFinite(row.phase)&&Number.isFinite(row.stride)),`${label} 步态相位与步幅均为有限值`);
  assert(visual.every(row=>row.lengths.every(length=>length.upper>.18&&length.lower>.2)),`${label} 回位期间手臂骨段完整`);
  assert(visual.every(row=>row.grounds.length===2&&row.grounds.every(y=>Number.isFinite(y)&&y>=-.008)),`${label} 回位期间鞋底不穿地`);
  let maxRootStep=0,maxSlip=0;
  for(let i=1;i<visual.length;i++){
    const a=visual[i-1],b=visual[i];
    maxRootStep=Math.max(maxRootStep,Math.hypot(b.x-a.x,b.z-a.z));
    for(let foot=0;foot<2;foot++){
      if(a.support[foot]<.5||b.support[foot]<.5)continue;
      const dx=b.ankles[foot].x-a.ankles[foot].x,dz=b.ankles[foot].z-a.ankles[foot].z;
      maxSlip=Math.max(maxSlip,Math.abs(dx*result.dir.x+dz*result.dir.z));
    }
  }
  const minGround=Math.min(...visual.flatMap(row=>row.grounds));
  console.log(`  METRIC ${label} sweep=${first.sweepDistance.toFixed(3)} distance=${first.distance.toFixed(3)} steps=${first.steps} step=${first.stepLength.toFixed(3)} duration=${first.duration.toFixed(3)} rootStep=${maxRootStep.toFixed(4)} supportSlip=${maxSlip.toFixed(4)} minGround=${minGround.toFixed(4)}`);
  assert(maxRootStep<.009,`${label} 根节点逐帧连续，无瞬移(最大 ${maxRootStep.toFixed(4)}m)`);
  assert(maxSlip<.02,`${label} 承重脚世界位移稳定(最大 ${maxSlip.toFixed(4)}m/帧)`);
  if(label.includes("nvidia23")){
    const charge=rows.find(row=>row.charging&&row.jump<=.004&&row.tripo?.stanceLocked);
    const takeoff=rows.find(row=>row.jump>.004&&row.tripo?.stanceReleased);
    assert(charge,`${label} 接地蓄力才建立 neutral stance`);
    assert(takeoff&&!takeoff.tripo.stanceLocked,`${label} 起跳离地立即释放 stance`);
    assert(visual.every(row=>row.tripo?.recovery&&row.tripo.direction===-1),`${label} Tripo 收到明确倒步信号`);
    assert(visual.every(row=>row.tripo.pelvisDrop===0&&!row.tripo.stanceLocked),`${label} 回位期间禁止锁脚和骨盆补偿`);
    assert(visual.every(row=>row.tripo.shotW===0),`${label} 回位期间不再叠加科比投篮收势`);
    assert(last.tripo.phase<first.tripo.phase-.1,`${label} Tripo run clip 按实际位移倒放`);
    const torsoRows=visual.filter(row=>row.tripo?.torso?.every(Boolean));
    const minHeadLift=Math.min(...torsoRows.map(row=>row.tripo.torso[2].y-row.tripo.torso[0].y));
    const maxHeadReach=Math.max(...torsoRows.map(row=>Math.hypot(row.tripo.torso[2].x-row.tripo.torso[0].x,row.tripo.torso[2].z-row.tripo.torso[0].z)));
    console.log(`  METRIC ${label} minHeadLift=${minHeadLift.toFixed(3)} maxHeadReach=${maxHeadReach.toFixed(3)}`);
    assert(minHeadLift>.35&&maxHeadReach<.28,`${label} Tripo 回位躯干保持直立`);
    const base=charge.tripo.legs,legs=last.tripo.legs;
    const lengths=base&&legs?[Math.hypot(base[0].x-base[1].x,base[0].y-base[1].y,base[0].z-base[1].z),Math.hypot(base[1].x-base[2].x,base[1].y-base[2].y,base[1].z-base[2].z)]:[];
    const finalLengths=legs?[Math.hypot(legs[0].x-legs[1].x,legs[0].y-legs[1].y,legs[0].z-legs[1].z),Math.hypot(legs[1].x-legs[2].x,legs[1].y-legs[2].y,legs[1].z-legs[2].z)]:[];
    assert(lengths.every((value,index)=>Math.abs(value-finalLengths[index])<1e-5),`${label} Tripo 腿骨长度恒定`);
  }
}

const {server,port}=await serve();
const browser=await launchBrowser();
try{
  for(const [label,star,randomValue] of [
    ["curry 最小前跳","curry",{hasSweep:.1,sweep:.01}],
    ["curry 最大前跳","curry",{hasSweep:.1,sweep:.99}],
    ["curry 原地跳","curry",{hasSweep:.8,sweep:.5}],
    ["nvidia23 最大前跳","nvidia23",{hasSweep:.1,sweep:.99}]
  ]){
    const {page,context,errors}=await boot(browser,port,star);
    try{
      const result=await probe(page,randomValue);
      if(randomValue.hasSweep>=.55){
        assert(result.error||!result.landed||result.rows.every(row=>row.distance===0),`${label} 原地跳不触发倒步`);
        if(!result.error)console.log(`  METRIC ${label} recovery=none`);
      }else{
        inspectProbe(result,label);
        if(label.includes("最大前跳"))await captureRecovery(page,star);
      }
      assert(errors.length===0,`${label} 无运行时错误${errors[0]?"("+errors[0]+")":""}`);
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  server.close();
}
console.log(failures?`\n${failures} 条失败`:"\n投篮倒步回归通过");
process.exit(failures?1:0);
