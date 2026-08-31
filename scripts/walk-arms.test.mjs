/* 跑动/接球手臂专项检查台。
   跑: node scripts/walk-arms.test.mjs

   这不是第一人称镜像测试，而是实际走位链的第三人称截图与几何检查：
   真实入口 -> 出手 -> 下一点位 -> 最后减速 -> 传球飞行 -> 到手。
   重点抓“球还没到手，人物已经开始走”这一段，防止手臂被跑姿或接球覆盖抹掉。
   非音频测试先注入 silence-browser.js；截图输出在 captures/walk-arms/，该目录被 gitignore。
*/
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"captures","walk-arms");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",
  ".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",
  ".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      const clean=decodeURIComponent(req.url.split("?")[0]);
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
      try{const mod=createRequire(base)(pkg);if(mod&&mod.chromium&&!seen.has(mod)){seen.add(mod);out.push(mod);}}catch(e){}
    }
  };
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");
  return out;
}

async function launchBrowser(){
  const problems=[];
  for(const mod of playwrightCandidates()){
    try{return await mod.chromium.launch();}catch(e){problems.push(e.message.split("\n")[0]);}
    try{return await mod.chromium.launch({channel:"chrome"});}catch(e){problems.push(e.message.split("\n")[0]);}
  }
  console.error("Playwright 起不来浏览器:");
  problems.slice(0,3).forEach(p=>console.error("  · "+p));
  console.error("修: npx playwright install chromium");
  process.exit(2);
}

const {server,port}=await serve();
const browser=await launchBrowser();
fs.mkdirSync(OUT,{recursive:true});
const page=await browser.newPage({viewport:{width:760,height:820},deviceScaleFactor:1});
const errors=[];
const badResponses=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{
  /* Chromium 会把预览服务器对 audio/voices/ 目录的探测也报成 console error；
     它不是 JS 运行时错误，具体 URL 由 badResponses 单独记录。 */
  if(m.type()==="error"&&!/favicon\.ico/.test(m.text())&&!/Failed to load resource/.test(m.text()))errors.push("console: "+m.text());
});
page.on("response",response=>{
  if(response.status()>=400&&!/favicon\.ico/.test(response.url()))badResponses.push(`${response.status()} ${response.url()}`);
});

const check=(ok,msg)=>console.log(`${ok?"  PASS  ":"  FAIL  "}${msg}`);
let fail=0;
const assert=(ok,msg)=>{if(!ok)fail++;check(ok,msg);};

await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20260828`,{waitUntil:"load"});
await page.evaluate(async()=>{
  await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);
});
await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof startRound==='function'",{timeout:20000});

/* 走真实比赛入口：goDiff -> pickDiff -> startRound，不直接伪造 walk 对象。 */
await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
await page.waitForFunction("G.state==='round'",{timeout:30000});
await page.waitForFunction("G.canShoot===true",{timeout:30000});
/* 先单独测“站定且没有球/没有迎球”：不能把持球或接球姿势误当作日常站姿。 */
await page.evaluate(()=>{
  G.canShoot=false;G.charging=false;G.moving=false;G.passCatch=null;P.walking=false;
  if(typeof pBall!=="undefined")pBall.visible=false;
});
await page.waitForTimeout(120);
await page.evaluate(()=>{
  const g=AIBA.runtime.service("legacy");
  /* 固定一段跨点位走位，当前球已经到手后才替换序列，避免绕过真实的 readyBall。 */
  g.G.seq=[{rack:2,ball:0,val:1,money:false,deep:null},{rack:0,ball:0,val:1,money:false,deep:null}];
  /* startRound 原本随机抽第一架；这里把人和第一球一起归位到弧顶，
     让这次回归确实覆盖“弧顶 -> 左底角”的长走位，而不是误测短距离。 */
  g.G.shotIdx=0;g.P.pos.copy(g.RACKS[2].p);g.P.face=g.faceTo(g.P.pos,g.HOOP);g.P.walking=false;
  g.CAM.mode=1;g.applyCamMode();
});
await page.waitForTimeout(220);

const inspect=()=>page.evaluate(()=>{
  const g=AIBA.runtime.service("legacy"),o=g.player,cam=AIBA.runtime.service("rendering:core").camera;
  const p=n=>{const v=new THREE.Vector3();n.getWorldPosition(v);return v;};
  const proj=v=>{const q=v.clone().project(cam);return {x:q.x,y:q.y,z:q.z,inside:Math.abs(q.x)<=1.18&&Math.abs(q.y)<=1.18&&q.z>-1&&q.z<1};};
  const distance=(a,b)=>a.distanceTo(b);
  o.g.updateMatrixWorld(true);
  const footBox=root=>{
    const box=new THREE.Box3().setFromObject(root);
    return {minY:+box.min.y.toFixed(4),maxY:+box.max.y.toFixed(4)};
  };
  const actorInv=o.g.getWorldQuaternion(new THREE.Quaternion()).invert();
  const arms=o.arms.map((arm,i)=>{
    const shoulder=p(arm),elbow=p(o.elbows[i]),wrist=p(o.handRoots[i]);
    const upper=elbow.clone().sub(shoulder).normalize(),lower=wrist.clone().sub(elbow).normalize();
    const bend=Math.acos(Math.max(-1,Math.min(1,upper.dot(lower))))*180/Math.PI;
    const upperLocal=upper.clone().applyQuaternion(actorInv),lowerLocal=lower.clone().applyQuaternion(actorInv);
    const down=new THREE.Vector3(0,-1,0);
    const upperTilt=Math.acos(Math.max(-1,Math.min(1,upperLocal.dot(down))))*180/Math.PI;
    const lowerTilt=Math.acos(Math.max(-1,Math.min(1,lowerLocal.dot(down))))*180/Math.PI;
    const palmLocal=new THREE.Vector3(0,0,-1).applyQuaternion(o.handRoots[i].getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(actorInv);
    const palmInward=i===0?palmLocal.x>.72:palmLocal.x<-.72;
    let meshes=0;arm.traverse(n=>{if(n.isMesh&&n.visible)meshes++;});
    return {meshes,bend:+bend.toFixed(1),shoulder:proj(shoulder),elbow:proj(elbow),wrist:proj(wrist),
      upperLen:+distance(shoulder,elbow).toFixed(3),lowerLen:+distance(elbow,wrist).toFixed(3),
      upper:[+upperLocal.x.toFixed(3),+upperLocal.y.toFixed(3),+upperLocal.z.toFixed(3)],
      lower:[+lowerLocal.x.toFixed(3),+lowerLocal.y.toFixed(3),+lowerLocal.z.toFixed(3)],
      upperTilt:+upperTilt.toFixed(1),lowerTilt:+lowerTilt.toFixed(1),
      palm:[+palmLocal.x.toFixed(3),+palmLocal.y.toFixed(3),+palmLocal.z.toFixed(3)],palmInward};
  });
  const motionApi=AIBA.runtime.service("rendering:motion");
  const fingerCurl=(o.fingerJoints||[]).map(fingers=>fingers.length
    ?+(fingers.reduce((sum,finger)=>sum+(typeof motionApi.fingerCurlValue==="function"?motionApi.fingerCurlValue(finger):finger.rotation.x),0)/fingers.length).toFixed(3):NaN);
  const fingerJointCount=(o.fingerJoints||[]).map(fingers=>fingers.map(finger=>{
    const chain=finger&&finger.userData&&finger.userData.aibaFingerChain||{};
    return 1+(chain.pip?1:0)+(chain.dip?1:0);
  }));
  const thumbCurl=(o.thumbRoots||[]).map(root=>{
    const tip=root&&root.userData&&root.userData.aibaThumbChain&&root.userData.aibaThumbChain.tip;
    return +((Number(root&&root.rotation.x)||0)+(Number(tip&&tip.rotation.x)||0)).toFixed(3);
  });
  const thumbJointCount=(o.thumbRoots||[]).map(root=>{
    const tip=root&&root.userData&&root.userData.aibaThumbChain&&root.userData.aibaThumbChain.tip;
    return 1+(tip?1:0);
  });
  const legs=o.legs.map((leg,i)=>{
    const hip=p(leg),knee=p(o.knees[i]),v=knee.sub(hip).normalize().applyQuaternion(actorInv);
    return {z:+v.z.toFixed(3)};
  });
  const feet=o.ankles.map((ankle,i)=>{
    const foot=(o.footRoots&&o.footRoots[i])||ankle;
    const toe=(o.toeRoots&&o.toeRoots[i])||null;
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(actorInv);
    const toeForward=toe
      ?new THREE.Vector3(0,0,1).applyQuaternion(toe.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(actorInv)
      :null;
    const runFootPitch=o.g.userData.runFootPitch||o.g.userData.runAnklePitch;
    const runToePitch=o.g.userData.runToePitch;
    const runContact=o.g.userData.runFootContact;
    const runSupport=o.g.userData.runFootSupport;
    const runLift=o.g.userData.runFootLift;
    return {
    ankle:+ankle.rotation.x.toFixed(4),foot:+foot.rotation.x.toFixed(4),toe:+(toe?toe.rotation.x:0).toFixed(4),
    hasFoot:!!o.footRoots&&!!o.footRoots[i],hasToe:!!o.toeRoots&&!!o.toeRoots[i],
    shoe:+o.shoes[i].rotation.x.toFixed(4),
    worldBox:footBox(foot),
    footForwardY:+forward.y.toFixed(4),toeForwardY:toeForward?+toeForward.y.toFixed(4):null,
    runPitch:Number.isFinite(runFootPitch&&runFootPitch[i])
      ?+runFootPitch[i].toFixed(4):null,
    runToePitch:Number.isFinite(runToePitch&&runToePitch[i])
      ?+runToePitch[i].toFixed(4):null,
    runContact:Number.isFinite(runContact&&runContact[i])
      ?+runContact[i].toFixed(4):null,
    runSupport:Number.isFinite(runSupport&&runSupport[i])
      ?+runSupport[i].toFixed(4):null,
    runLift:Number.isFinite(runLift&&runLift[i])
      ?+runLift[i].toFixed(4):null,
    readyPitch:Number.isFinite(o.g.userData.readyAnklePitch&&o.g.userData.readyAnklePitch[i])
      ?+o.g.userData.readyAnklePitch[i].toFixed(4):null
    };
  });
  const motion=motionApi.getState();
  const pass=g.getPassing();
  const rightHandWorld=o.handRoots[0].getWorldQuaternion(new THREE.Quaternion());
  return {state:g.G.state,walking:!!g.P.walking,moving:!!g.G.moving,canShoot:!!g.G.canShoot,
    pass:pass?{t:+pass.t.toFixed(3),dur:+pass.dur.toFixed(3),progress:+(pass.t/pass.dur).toFixed(3)}:null,
    catch:g.G.passCatch?{active:!!g.G.passCatch.active,settling:!!g.G.passCatch.settling,progress:+(g.G.passCatch.progress||0).toFixed(3)}:null,
    walk:motion.walk?{t:+motion.walk.t.toFixed(3),dur:+motion.walk.dur.toFixed(3),k:+(motion.walk.t/motion.walk.dur).toFixed(3)}:null,
    tstage:{run:o.g.userData.tstageAnimation==="run",runPhase:o.g.userData.tstageRunPhase??null,runBodyBob:o.g.userData.tstageRunBodyBob??null,
      runSource:o.g.userData.tstageRunSource||null,catch:o.g.userData.tstageAnimation==="catching",
      catchSource:o.g.userData.catchPoseSource||null,catchRightHandPrep:o.g.userData.catchRightHandPrep??null,
      catchRightHandRoll:o.g.userData.catchRightHandRoll??null},
    gait:{cadence:Number.isFinite(o.g.userData.runCadence)?+o.g.userData.runCadence.toFixed(3):null,
      stride:Number.isFinite(o.g.userData.runStride)?+o.g.userData.runStride.toFixed(3):null,
      targetStride:Number.isFinite(o.g.userData.runTargetStride)?+o.g.userData.runTargetStride.toFixed(3):null},
    shot:{hipHinge:Number.isFinite(o.g.userData.shotHipHinge)?+o.g.userData.shotHipHinge.toFixed(4):null,
      hipFlex:Array.isArray(o.g.userData.shotHipFlex)?o.g.userData.shotHipFlex.map(v=>+v.toFixed(4)):null,
      lowerBodyHingeComp:Number.isFinite(o.g.userData.shotLowerBodyHingeComp)?+o.g.userData.shotLowerBodyHingeComp.toFixed(4):null,
      readyLowerBlend:Number.isFinite(o.g.userData.shotReadyLowerBlend)?+o.g.userData.shotReadyLowerBlend.toFixed(4):null},
    rightHandWorldQuat:[rightHandWorld.x,rightHandWorld.y,rightHandWorld.z,rightHandWorld.w],
    legs,feet,arms,fingerCurl,fingerJointCount,thumbCurl,thumbJointCount};
});

const capture=async(name,distance=3.45,sideOffset=.82,lookY=1.02,waitMs=80)=>{
  /* 审计机位只改变截图，不改变游戏的动作/状态：放到球员正前方侧一点，
     否则正常的球员跟随机位从背后看不到肘部，截图无法审手臂。 */
  await page.evaluate(({distance,sideOffset,lookY})=>{
    const g=AIBA.runtime.service("legacy"),d=new THREE.Vector3(Math.sin(g.P.face),0,Math.cos(g.P.face)),side=new THREE.Vector3(d.z,0,-d.x);
    g.G.glideCam=true;
    g.rig.pos.copy(g.P.pos).addScaledVector(d,distance).addScaledVector(side,sideOffset);g.rig.pos.y=1.38;
    g.rig.look.copy(g.P.pos);g.rig.look.y=lookY;
  },{distance,sideOffset,lookY});
  await page.waitForTimeout(waitMs);
  const info=await inspect();
  await page.screenshot({path:path.join(OUT,name+".png")});
  fs.writeFileSync(path.join(OUT,name+".json"),JSON.stringify(info,null,2));
  console.log("  SNAP  "+name+" "+JSON.stringify({walking:info.walking,moving:info.moving,pass:info.pass,catch:info.catch,tstage:info.tstage,gait:info.gait,shot:info.shot,feet:info.feet.map(f=>({ankle:f.ankle,foot:f.foot,toe:f.toe,runSupport:f.runSupport,runLift:f.runLift,minY:f.worldBox.minY})),bends:info.arms.map(a=>a.bend),meshes:info.arms.map(a=>a.meshes)}));
  return info;
};
const followAuditCamera=async(distance=2.35,sideOffset=.9,lookY=1.02)=>page.evaluate(({distance,sideOffset,lookY})=>{
  const g=AIBA.runtime.service("legacy"),d=new THREE.Vector3(Math.sin(g.P.face),0,Math.cos(g.P.face)),side=new THREE.Vector3(d.z,0,-d.x);
  g.G.glideCam=true;
  g.rig.pos.copy(g.P.pos).addScaledVector(d,distance).addScaledVector(side,sideOffset);g.rig.pos.y=1.38;
  g.rig.look.copy(g.P.pos);g.rig.look.y=lookY;
},{distance,sideOffset,lookY});

const idle=await capture("00-idle-no-catch",2.35,.9);
assert(!idle.walking&&!idle.moving&&!idle.canShoot,"站定无球状态没有误判为接球/走位");
const cadenceProbe=await page.evaluate(()=>{
  const m=AIBA.runtime.service("rendering:motion");
  return [.5,1.4,2.6,3.6,4.6].map(speed=>({speed,cadence:m.runCadence(speed)}));
});
console.log("  METRIC gait-cadence="+JSON.stringify(cadenceProbe.map(v=>({speed:v.speed,cadence:+v.cadence.toFixed(2)}))));
assert(cadenceProbe.find(v=>v.speed===3.6).cadence<4.1,"最快常规跑速的步频不再冲到接近 5 步/秒");
assert(cadenceProbe.find(v=>v.speed===4.6).cadence<3.7,"更高速段步频有上限，速度主要由步幅承担");
assert(idle.feet.every(f=>f.shoe===0),"站定时不只旋转鞋面，鞋面局部保持归零");
assert(idle.fingerCurl.every(v=>Number.isFinite(v)&&v<0),"站定不接球时手指保持松开");
assert(idle.fingerJointCount.every(hand=>hand.every(count=>count===3)),"每根手指在站定状态保留 MCP/PIP/DIP 三节关节");
assert(idle.thumbJointCount.every(count=>count===2),"每只拇指在站定状态保留根部/IP 两节关节");
assert(idle.thumbCurl.every(v=>Number.isFinite(v)&&Math.abs(v)<.05),"站定时拇指保持松弛而不是收成拳");
assert(idle.arms.every(a=>a.upperTilt<=12&&a.lowerTilt<=18&&a.bend>=2&&a.bend<=12),"站定不接球时双臂近垂直、肘部只保留约 5° 松弛弯曲");
assert(idle.arms.every(a=>a.meshes>0&&a.palmInward),"站定不接球时双手仍存在且掌心相对");
const idleFootSamples=[];
for(let i=0;i<24;i++){await page.waitForTimeout(55);idleFootSamples.push(await inspect());}
const readyAnkleRanges=idleFootSamples[0].feet.map((_,i)=>Math.max(...idleFootSamples.map(info=>info.feet[i].ankle))-Math.min(...idleFootSamples.map(info=>info.feet[i].ankle)));
console.log("  METRIC ready-ankle-range="+JSON.stringify(readyAnkleRanges.map(v=>+v.toFixed(3))));
assert(readyAnkleRanges.every(range=>range>.04),"原地垫步会交替改变真实 ankle group，而不是只有膝盖上下");
assert(idleFootSamples.every(info=>info.feet.every(f=>f.shoe===0)),"原地垫步没有退回只转鞋面的假脚掌动作");
await capture("00-idle-feet",1.65,.48,.42);
const landingProbe=await page.evaluate(()=>{
  const m=AIBA.runtime.service("rendering:motion"),c={dip:0,lift:0,rise:0,jmp:0,over:0};
  m.poseGuy(player,c,0);const flat=player.ankles.map(a=>a.rotation.x);
  const flatFoot=player.footRoots.map(a=>a.rotation.x),flatToe=player.toeRoots.map(a=>a.rotation.x);
  m.poseGuy(player,c,1);const landing=player.ankles.map(a=>a.rotation.x);
  const landingFoot=player.footRoots.map(a=>a.rotation.x),landingToe=player.toeRoots.map(a=>a.rotation.x);
  return {flat,landing,delta:landing.map((v,i)=>v-flat[i]),
    footDelta:landingFoot.map((v,i)=>v-flatFoot[i]),toeDelta:landingToe.map((v,i)=>v-flatToe[i])};
});
console.log("  METRIC landing-ankle-pitch="+JSON.stringify(landingProbe.delta.map(v=>+v.toFixed(3))));
console.log("  METRIC landing-foot-roll="+JSON.stringify({foot:landingProbe.footDelta.map(v=>+v.toFixed(3)),toe:landingProbe.toeDelta.map(v=>+v.toFixed(3))}));
assert(landingProbe.delta.every(v=>Math.abs(v)>.06),"投后落地会让真实踝关节出现前脚掌承接/回落动作");
assert(landingProbe.footDelta.every(v=>Math.abs(v)>=.02)&&landingProbe.toeDelta.every(v=>Math.abs(v)>.04),"投后落地会让真实 foot/toe 关节参与前脚掌承接");
const chargeProbe=await page.evaluate(()=>{
  const m=AIBA.runtime.service("rendering:motion"),c={dip:1,lift:0,rise:0,jmp:0,over:0};
  m.poseGuy(player,c,0);player.g.updateMatrixWorld(true);
  const hinge=player.g.userData.shotHipHinge,localHip=player.legs[0].rotation.x;
  return {hinge,localHip,worldHip:hinge+localHip,expected:player.g.userData.shotHipFlex&&player.g.userData.shotHipFlex[0],
    hingeComp:player.g.userData.shotLowerBodyHingeComp,readyBlend:player.g.userData.shotReadyLowerBlend};
});
console.log("  METRIC shot-hip-hinge="+JSON.stringify(chargeProbe));
assert(chargeProbe.hinge<-.12&&Math.abs(chargeProbe.localHip-chargeProbe.worldHip)>.12&&
  Math.abs(chargeProbe.worldHip-chargeProbe.expected)<1e-6,"蓄力时上身前倾、腿根承重，形成真实屈髋而不是只屈膝");
await page.evaluate(()=>{
  G.canShoot=true;
  if(typeof pBall!=="undefined")pBall.visible=true;
});
await page.waitForTimeout(100);

/* 首次确认站定基线，然后正常出手。 */
const ready=await capture("01-ready-before-shot");
/* 蓄力画面用真实 poseGuy() 路径冻结在最深蓄力帧：这样不会因为浏览器
   恰好截在 0.06s 的起始过渡而把“已经开始前倾”误判成“没有屈髋”。
   PAUSE.on 只暂停时间推进，不替换骨架，也不改动作代码。 */
await page.evaluate(()=>{
  const m=AIBA.runtime.service("rendering:motion");
  PAUSE.on=true;G.charging=true;G.canShoot=false;G.moving=false;
  m.poseGuy(player,{dip:1,lift:0,rise:0,jmp:0,over:0},0);
  player.g.updateMatrixWorld(true);
});
const charge=await capture("01-charge-hip-hinge",2.35,.9);
assert(charge.shot.hipHinge<-.12&&charge.shot.readyLowerBlend>.8,"实际蓄力冻结帧融合 ready_pose1 的髋折叠目标");
await page.evaluate(()=>{PAUSE.on=false;G.charging=false;G.canShoot=true;G.power=0;});
await page.evaluate(()=>{startCharge();G.power=weatherAdjustedIdeal(curShot(),true);});
await page.waitForTimeout(50);
await page.evaluate(()=>{G.power=weatherAdjustedIdeal(curShot(),true);doRelease();});

await page.waitForFunction("G.moving===true&&P.walking===true",{timeout:20000});
/* 等待 walkSpeed 经过真实的加速平滑，步频测量不取刚置位的零速首帧。 */
await page.waitForTimeout(180);
const walk=await capture("02-walk-before-catch");
assert(walk.moving&&walk.walking,"出手后真实进入走位");
assert(walk.tstage.run,"小跑状态使用 T台 run 动作片段");
assert(walk.arms.every(a=>a.meshes>0),"普通小跑两侧手臂都有可见网格");
assert(walk.arms.every(a=>a.bend>=35&&a.bend<=135),"普通小跑两侧肘部保持弯折(35°~135°)");
assert(walk.arms.every(a=>a.palmInward),"普通小跑两只掌心相对而不是朝地");
assert(walk.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside),"普通小跑肩-肘-腕都在画面内");
/* waitForFunction 会在走位状态刚置位的第一帧就返回，此时握拳还在 0.10s 的
   收拢过渡中；首帧只验“已经开始收拢”，稳定的闭合幅度由下面近景和连续采样验。 */
assert(walk.fingerCurl.every(v=>Number.isFinite(v)&&v>.05),"普通小跑手指开始进入可见的多关节握拳");
assert(walk.thumbCurl.every(v=>Number.isFinite(v)&&v>.10),"普通小跑拇指同步收进掌心");
assert(Number.isFinite(walk.tstage.runBodyBob),"普通小跑应用 T台 bodyBob 起伏参数");
assert(Number.isFinite(walk.gait.cadence)&&walk.gait.cadence>1&&walk.gait.cadence<4.6,"普通小跑步频落在自然范围");
assert(walk.feet.every(f=>f.shoe===0),"普通小跑没有退回只转鞋面的假脚掌实现");
const walkClose=await capture("02-walk-closeup",2.35,.9);
assert(walkClose.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135),"近景小跑两侧手臂仍可见且保持弯肘");
assert(walkClose.arms.every(a=>a.palmInward),"近景小跑两只掌心相对而不是朝地");
assert(walkClose.fingerCurl.every(v=>Number.isFinite(v)&&v>.95),"近景小跑双手进入多关节轻握拳状态");
assert(walkClose.thumbCurl.every(v=>Number.isFinite(v)&&v>.75),"近景小跑近景可见拇指跨入掌心");
assert(walkClose.fingerJointCount.every(hand=>hand.every(count=>count===3)),"近景小跑每根手指仍是三节关节链");
assert(walkClose.thumbJointCount.every(count=>count===2),"近景小跑拇指仍是两节关节链");
assert(walkClose.feet.every(f=>f.hasFoot&&f.hasToe&&Number.isFinite(f.runPitch)&&Number.isFinite(f.runToePitch)&&f.shoe===0),"近景小跑由真实 foot/toe group 驱动脚跟/前掌滚动");
/* 侧面和脚部截图必须在传球事件前完成；否则进入迎球 pose 后，侧面检查
   会把合法的 catching 手臂误判成“跑姿丢失”。 */
const profile=await capture("02-walk-profile",2.8,1.75,1.02,30);
assert(profile.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135),"侧面跑动截图两侧手臂仍保持弯肘");
assert(profile.arms.every(a=>a.palmInward),"侧面跑动截图两只掌心仍相对");
assert(profile.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside),"侧面跑动截图肩-肘-腕均可见");
await capture("02-walk-feet",1.65,.48,.42,30);
const walkSamples=[];
let catchInfo=null;
for(let i=0;i<12;i++){
  await page.waitForTimeout(55);await followAuditCamera();
  const info=await inspect();
  const incoming=info.pass&&info.pass.progress<.82&&info.catch&&info.catch.active&&!info.catch.settling;
  if(incoming){catchInfo=await capture("03-walk-while-ball-in-flight",3.45,.82,1.02,35);break;}
  /* 纯跑步指标只收集没有传球/接球覆盖的帧，避免把状态切换帧
     错当成“跑步姿势不连续”。 */
  if(info.walking&&info.moving&&!info.pass&&!(info.catch&&info.catch.active))walkSamples.push(info);
}
assert(walkSamples.length>=4,"连续跑动采样至少覆盖 4 帧纯跑步状态");
assert(walkSamples.every(info=>info.walking&&info.moving),"连续跑动纯跑步采样始终保持走位状态");
assert(walkSamples.every(info=>info.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135)),"连续跑动采样手臂始终可见且保持弯肘");
assert(walkSamples.every(info=>info.arms.every(a=>a.palmInward)),"连续跑动采样掌心始终相对");
assert(walkSamples.every(info=>info.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside)),"连续跑动采样肩-肘-腕始终在画面内");
assert(walkSamples.every(info=>info.fingerCurl.every(v=>Number.isFinite(v)&&v>.95)),"连续跑动采样双手始终保持多关节轻握拳");
assert(walkSamples.every(info=>info.thumbCurl.every(v=>Number.isFinite(v)&&v>.75)),"连续跑动采样拇指始终收进掌心");
assert(walkSamples.every(info=>Number.isFinite(info.gait.cadence)&&info.gait.cadence<4.6),"连续跑动步频不会在高速段异常飙升");
assert(walkSamples.some(info=>Number.isFinite(info.gait.cadence)&&info.gait.cadence>1.2),"连续跑动采样能进入自然小跑步频");
const runAnkleRanges=walkSamples[0].feet.map((_,i)=>Math.max(...walkSamples.map(info=>info.feet[i].ankle))-Math.min(...walkSamples.map(info=>info.feet[i].ankle)));
console.log("  METRIC run-ankle-range="+JSON.stringify(runAnkleRanges.map(v=>+v.toFixed(3))));
assert(runAnkleRanges.every(range=>range>.04),"连续跑动时左右脚踝会持续活动，而不是平板脚锁死");
const runFootRanges=walkSamples[0].feet.map((_,i)=>Math.max(...walkSamples.map(info=>info.feet[i].runPitch))-Math.min(...walkSamples.map(info=>info.feet[i].runPitch)));
const runToeRanges=walkSamples[0].feet.map((_,i)=>Math.max(...walkSamples.map(info=>info.feet[i].runToePitch))-Math.min(...walkSamples.map(info=>info.feet[i].runToePitch)));
console.log("  METRIC run-foot-roll="+JSON.stringify({foot:runFootRanges.map(v=>+v.toFixed(3)),toe:runToeRanges.map(v=>+v.toFixed(3))}));
assert(runFootRanges.every(range=>range>.08)&&runToeRanges.every(range=>range>.10),"连续跑动时 foot/toe 关节会完整走过落跟到蹬地的滚动幅度");
const hasContactAndSwing=walkSamples.some(info=>info.feet.some(f=>f.runSupport>.9)&&info.feet.some(f=>f.runLift>.02));
assert(hasContactAndSwing,"连续跑动同时出现支撑脚与摆动脚，支撑脚不会跟着身体漂移");
const runGroundSamples=walkSamples.flatMap(info=>info.feet.map(f=>f.worldBox.minY));
console.log("  METRIC run-foot-ground="+JSON.stringify({min:+Math.min(...runGroundSamples).toFixed(4),max:+Math.max(...runGroundSamples).toFixed(4)}));
assert(runGroundSamples.every(v=>Number.isFinite(v)&&v>=-.006),"连续跑动真实鞋底网格不穿过地面");
const supportedGroundSamples=walkSamples.flatMap((info,sample)=>info.feet
  .filter(f=>f.runSupport>.9)
  .map((f,index)=>({sample,index,support:f.runSupport,minY:f.worldBox.minY})));
console.log("  METRIC run-support-ground="+JSON.stringify(supportedGroundSamples.map(v=>({sample:v.sample,index:v.index,support:+v.support.toFixed(4),minY:+v.minY.toFixed(4)}))));
assert(supportedGroundSamples.length>=4&&supportedGroundSamples.every(v=>v.minY>=-.006&&v.minY<=.012),"跑动支撑脚真实鞋底落在地面容差内");
const hasOppositeRoll=walkSamples.some(info=>{
  const a=info.feet[0],b=info.feet[1];
  return (a.runToePitch>.12&&b.runPitch<-.08)||(b.runToePitch>.12&&a.runPitch<-.08);
});
assert(hasOppositeRoll,"近景小跑一只脚尖上翘准备落跟、另一只脚掌下压准备蹬地");
assert(walkSamples.some(info=>Math.abs(info.feet[0].footForwardY)>.03&&Math.abs(info.feet[1].footForwardY)>.03&&info.feet[0].footForwardY*info.feet[1].footForwardY<0),"连续跑动左右脚的前掌朝向会交替变化");
assert(walkSamples.every(info=>info.feet.every(f=>f.shoe===0)),"连续跑动没有退回只转鞋面的假脚掌实现");
const lowerAngularRanges=walkSamples[0].arms.map((_,i)=>{
  const base=walkSamples[0].arms[i].lower;
  return Math.max(...walkSamples.map(info=>{
    const v=info.arms[i].lower;
    return Math.acos(Math.max(-1,Math.min(1,base[0]*v[0]+base[1]*v[1]+base[2]*v[2])));
  }));
});
console.log("  METRIC run-lower-angle="+JSON.stringify(lowerAngularRanges.map(v=>+(v*180/Math.PI).toFixed(1))));
assert(lowerAngularRanges.every(range=>range>.08),"连续跑动小臂会随大臂前后摆动，不是固定接球角度");
const bodyBobSamples=walkSamples.map(info=>info.tstage.runBodyBob).filter(Number.isFinite);
assert(bodyBobSamples.length>=4&&Math.max(...bodyBobSamples)-Math.min(...bodyBobSamples)>.01,
  "连续跑动身体重心有可见的节奏起伏");
console.log("  METRIC run-body-bob="+JSON.stringify(bodyBobSamples.map(v=>+v.toFixed(4))));
const pairedPhase=walkSamples.flatMap(info=>info.arms.map((arm,i)=>({upper:arm.upper[2],leg:info.legs[i].z})))
  .filter(pair=>Math.abs(pair.upper)>.025&&Math.abs(pair.leg)>.025);
assert(pairedPhase.length>=4&&pairedPhase.filter(pair=>pair.upper*pair.leg<0).length>=pairedPhase.length*.75,
  "左右脚前跨时同侧大臂反向摆动、对侧大臂同步前摆");
if(!catchInfo){
  try{
    await page.waitForFunction("G.moving===true&&P.walking===true&&G.passCatch&&G.passCatch.active&&G.passCatch.settling!==true&&AIBA.runtime.service('legacy').getPassing()",{timeout:5000});
    catchInfo=await capture("03-walk-while-ball-in-flight",3.45,.82,1.02,35);
  }catch(e){
    check(false,"在跑步采样窗口内捕获到传球飞行状态");
  }
}
if(!catchInfo){
  console.log("  FAIL  未捕获到 incoming 传球帧，提前结束专项回归以确保浏览器被关闭");
  await browser.close();server.close();
  process.exit(1);
}
assert(catchInfo.moving&&catchInfo.walking,"球未到手时仍处于碎步走位");
assert(catchInfo.tstage.catch,"未到手的迎球状态使用 T台 catching 动作片段");
assert(catchInfo.tstage.catchSource,"迎球状态记录当前 T台关键帧来源");
assert(catchInfo.pass&&catchInfo.pass.progress<.9,"截图时球仍在传球飞行段");
assert(catchInfo.catch&&catchInfo.catch.active&&!catchInfo.catch.settling,"球未到手但接球状态已显式标记为 incoming");
assert(!catchInfo.canShoot,"球未到手时仍禁止投篮/换点");
assert(catchInfo.arms.every(a=>a.meshes>0),"伸手接球阶段两侧手臂仍有可见网格");
/* 角色会按 bodyProfile 做整体缩放，接球过渡中的上臂实际长度可能落到 .21m 左右；
   用缩放后仍能判定“没有断开”的下限，不把合法的个体身高误报成骨段丢失。 */
assert(catchInfo.arms.every(a=>a.upperLen>.18&&a.lowerLen>.20),"伸手接球阶段肩-肘-腕骨段没有断开");
assert(catchInfo.arms.every(a=>a.bend>=18&&a.bend<=150),"伸手接球阶段肘部没有塌成反折/直线");
assert(catchInfo.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside),"伸手接球阶段两只手都没有跑出画面");

await page.waitForFunction("G.canShoot===true&&G.passCatch&&G.passCatch.settling===true",{timeout:20000});
/* 第一人称回归：相机只切到真实 FP，不移动审计机位；在接球收势第一帧截图，
   再逐帧测右手世界四元数，防止“接球后走大圈”只靠肉眼描述。 */
await page.evaluate(()=>{G.glideCam=false;CAM.mode=0;applyCamMode();});
await page.waitForTimeout(24);
await page.screenshot({path:path.join(OUT,"04-first-person-catch-settle.png")});
const settleSamples=await page.evaluate(async()=>{
  const samples=[],deadline=performance.now()+1200;
  while(performance.now()<deadline){
    const state=G.passCatch;
    if(state&&state.settling){
      player.g.updateMatrixWorld(true);
      const q=player.handRoots[0].getWorldQuaternion(new THREE.Quaternion());
      samples.push({settle:+(state.settle||0).toFixed(4),q:[q.x,q.y,q.z,q.w]});
      if((state.settle||0)>=1)break;
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  return samples;
});
const quatAngleDeg=(a,b)=>{
  const dot=Math.min(1,Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]));
  return 2*Math.acos(dot)*180/Math.PI;
};
const settleAngle=settleSamples.length>1?quatAngleDeg(settleSamples[0].q,settleSamples[settleSamples.length-1].q):NaN;
console.log("  METRIC first-person-right-hand-settle="+JSON.stringify({samples:settleSamples.length,angleDeg:+settleAngle.toFixed(2),first:settleSamples[0]?.settle,last:settleSamples.at(-1)?.settle}));
assert(settleSamples.length>=5,"第一人称接球收势有逐帧右手样本");
assert(Number.isFinite(settleAngle)&&settleAngle>1&&settleAngle<25,"第一人称右手收势只做小幅反向旋转，不走大圈");
const landed=await capture("04-ball-arrived-settle");
assert(landed.canShoot,"球到手后才允许投篮");
assert(landed.arms.every(a=>a.meshes>0),"球到手缓冲阶段两侧手臂仍有可见网格");

console.log("  METRIC ready="+JSON.stringify(ready.arms.map(a=>({bend:a.bend,meshes:a.meshes}))));
console.log("  METRIC walk="+JSON.stringify(walk.arms.map(a=>({bend:a.bend,meshes:a.meshes}))));
console.log("  METRIC catch="+JSON.stringify(catchInfo.arms.map(a=>({bend:a.bend,meshes:a.meshes}))));
console.log("  METRIC landed="+JSON.stringify(landed.arms.map(a=>({bend:a.bend,meshes:a.meshes}))));
if(badResponses.length)console.log("  NOTE  非 2xx 资源: "+badResponses.join(" | "));
console.log(errors.length?"  FAIL  运行时错误: "+errors[0]:"  PASS  无运行时错误");
if(errors.length)fail++;

await browser.close();server.close();
console.log(fail?`\n${fail} 条失败；截图在 ${path.relative(ROOT,OUT)}/`:`\n跑动/接球手臂专项检查通过；截图在 ${path.relative(ROOT,OUT)}/`);
process.exit(fail?1:0);
