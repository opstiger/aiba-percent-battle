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
  const legs=o.legs.map((leg,i)=>{
    const hip=p(leg),knee=p(o.knees[i]),v=knee.sub(hip).normalize().applyQuaternion(actorInv);
    return {z:+v.z.toFixed(3)};
  });
  const motion=AIBA.runtime.service("rendering:motion").getState();
  const pass=g.getPassing();
  return {state:g.G.state,walking:!!g.P.walking,moving:!!g.G.moving,canShoot:!!g.G.canShoot,
    pass:pass?{t:+pass.t.toFixed(3),dur:+pass.dur.toFixed(3),progress:+(pass.t/pass.dur).toFixed(3)}:null,
    catch:g.G.passCatch?{active:!!g.G.passCatch.active,settling:!!g.G.passCatch.settling,progress:+(g.G.passCatch.progress||0).toFixed(3)}:null,
    walk:motion.walk?{t:+motion.walk.t.toFixed(3),dur:+motion.walk.dur.toFixed(3),k:+(motion.walk.t/motion.walk.dur).toFixed(3)}:null,
    tstage:{run:o.g.userData.tstageAnimation==="run",runPhase:o.g.userData.tstageRunPhase??null,runBodyBob:o.g.userData.tstageRunBodyBob??null,
      runSource:o.g.userData.tstageRunSource||null,catch:o.g.userData.tstageAnimation==="catching",
      catchSource:o.g.userData.catchPoseSource||null},
    legs,arms};
});

const capture=async(name,distance=3.45,sideOffset=.82)=>{
  /* 审计机位只改变截图，不改变游戏的动作/状态：放到球员正前方侧一点，
     否则正常的球员跟随机位从背后看不到肘部，截图无法审手臂。 */
  await page.evaluate(({distance,sideOffset})=>{
    const g=AIBA.runtime.service("legacy"),d=new THREE.Vector3(Math.sin(g.P.face),0,Math.cos(g.P.face)),side=new THREE.Vector3(d.z,0,-d.x);
    g.G.glideCam=true;
    g.rig.pos.copy(g.P.pos).addScaledVector(d,distance).addScaledVector(side,sideOffset);g.rig.pos.y=1.38;
    g.rig.look.copy(g.P.pos);g.rig.look.y=1.02;
  },{distance,sideOffset});
  await page.waitForTimeout(80);
  const info=await inspect();
  await page.screenshot({path:path.join(OUT,name+".png")});
  fs.writeFileSync(path.join(OUT,name+".json"),JSON.stringify(info,null,2));
  console.log("  SNAP  "+name+" "+JSON.stringify({walking:info.walking,moving:info.moving,pass:info.pass,catch:info.catch,tstage:info.tstage,bends:info.arms.map(a=>a.bend),meshes:info.arms.map(a=>a.meshes)}));
  return info;
};

const idle=await capture("00-idle-no-catch",2.35,.9);
assert(!idle.walking&&!idle.moving&&!idle.canShoot,"站定无球状态没有误判为接球/走位");
assert(idle.arms.every(a=>a.upperTilt<=12&&a.lowerTilt<=18&&a.bend>=2&&a.bend<=12),"站定不接球时双臂近垂直、肘部只保留约 5° 松弛弯曲");
assert(idle.arms.every(a=>a.meshes>0&&a.palmInward),"站定不接球时双手仍存在且掌心相对");
await page.evaluate(()=>{
  G.canShoot=true;
  if(typeof pBall!=="undefined")pBall.visible=true;
});
await page.waitForTimeout(100);

/* 首次确认站定基线，然后正常出手。 */
const ready=await capture("01-ready-before-shot");
await page.evaluate(()=>{startCharge();});
await page.waitForTimeout(120);
await page.evaluate(()=>{G.power=weatherAdjustedIdeal(curShot(),true);doRelease();});

await page.waitForFunction("G.moving===true&&P.walking===true",{timeout:20000});
const walk=await capture("02-walk-before-catch");
assert(walk.moving&&walk.walking,"出手后真实进入走位");
assert(walk.tstage.run,"小跑状态使用 T台 run 动作片段");
assert(walk.arms.every(a=>a.meshes>0),"普通小跑两侧手臂都有可见网格");
assert(walk.arms.every(a=>a.bend>=35&&a.bend<=135),"普通小跑两侧肘部保持弯折(35°~135°)");
assert(walk.arms.every(a=>a.palmInward),"普通小跑两只掌心相对而不是朝地");
assert(walk.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside),"普通小跑肩-肘-腕都在画面内");
assert(Number.isFinite(walk.tstage.runBodyBob),"普通小跑应用 T台 bodyBob 起伏参数");
const walkClose=await capture("02-walk-closeup",2.35,.9);
assert(walkClose.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135),"近景小跑两侧手臂仍可见且保持弯肘");
assert(walkClose.arms.every(a=>a.palmInward),"近景小跑两只掌心相对而不是朝地");
const walkSamples=[];
for(let i=0;i<6;i++){await page.waitForTimeout(55);walkSamples.push(await inspect());}
assert(walkSamples.every(info=>info.walking&&info.moving),"连续跑动采样始终保持走位状态");
assert(walkSamples.every(info=>info.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135)),"连续跑动采样手臂始终可见且保持弯肘");
assert(walkSamples.every(info=>info.arms.every(a=>a.palmInward)),"连续跑动采样掌心始终相对");
assert(walkSamples.every(info=>info.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside)),"连续跑动采样肩-肘-腕始终在画面内");
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
const profile=await capture("02-walk-profile",2.8,1.75);
assert(profile.arms.every(a=>a.meshes>0&&a.bend>=35&&a.bend<=135),"侧面跑动截图两侧手臂仍保持弯肘");
assert(profile.arms.every(a=>a.palmInward),"侧面跑动截图两只掌心仍相对");
assert(profile.arms.every(a=>a.shoulder.inside&&a.elbow.inside&&a.wrist.inside),"侧面跑动截图肩-肘-腕均可见");

await page.waitForFunction("G.moving===true&&P.walking===true&&G.passCatch&&G.passCatch.active&&G.passCatch.settling!==true&&AIBA.runtime.service('legacy').getPassing()",{timeout:20000});
const catchInfo=await capture("03-walk-while-ball-in-flight");
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
