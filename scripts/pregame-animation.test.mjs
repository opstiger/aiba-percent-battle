/* 赛前热身的球/镜头回归。
   验证投篮、扣篮的球在离手前挂在真实 ballGrip，离手后才进入世界飞行；
   同时验证 orbit 只转镜头，球员根节点和脚下朝向不追着镜头旋转。
   非音频浏览器测试先静音。 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",
  ".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};

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

const {server,port}=await serve();
const browser=await launchBrowser();
const captureDir=path.join(ROOT,"captures","pregame-audit");
fs.mkdirSync(captureDir,{recursive:true});

try{
  const page=await browser.newPage({viewport:{width:760,height:820},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20260831&preview=pregame-dunk-hang1`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(response=>response.text()).then(code=>eval(code));
  });
  await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof G!=='undefined'&&typeof startStageCeremony==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("contest",true);pickDiff("normal");beginStage();hidePanel();startStageCeremony();});
  await page.waitForFunction("AIBA.runtime.service('presentation:pregame').PREGAME.on===true",{timeout:20000});

  await page.evaluate(()=>{
    const p=AIBA.runtime.service("presentation:pregame").PREGAME;
    const actor=p.actors[0];
    p.t=0;p.idx=0;p.on=true;
    p.shots=[
      {start:0,dur:1.6,actor,action:"shoot",cam:"orbit",side:1,seed:.2,_justStarted:true},
      {start:1.6,dur:1.6,actor,action:"dunk",cam:"follow",side:-1,seed:1.7},
      {start:3.2,dur:1.5,actor,action:"finger",cam:"orbit",side:1,seed:2.5}
    ];
    p.dur=4.7;
  });

  const snapshot=()=>page.evaluate(()=>{
    const p=AIBA.runtime.service("presentation:pregame").PREGAME;
    const seg=p.shots[p.idx],actor=seg&&seg.actor,guy=actor&&actor.guy,ball=guy&&
      (guy===player?pBall:guy===passer?passerBall:guy.ball);
    const grip=guy&&guy.ballGrips&&guy.ballGrips[0];
    let distance=null,handWorld=null,handRootWorld=null,ballWorld=null,rimDistance=null,handRootRimDistance=null;
    if(ball&&grip){
      guy.g.updateMatrixWorld(true);ball.updateMatrixWorld(true);
      const b=ball.getWorldPosition(new THREE.Vector3()),h=grip.getWorldPosition(new THREE.Vector3());
      const hr=guy.handRoots&&guy.handRoots[0]?guy.handRoots[0].getWorldPosition(new THREE.Vector3()):null;
      distance=b.distanceTo(h);ballWorld={x:+b.x.toFixed(3),y:+b.y.toFixed(3),z:+b.z.toFixed(3)};
      handWorld={x:+h.x.toFixed(3),y:+h.y.toFixed(3),z:+h.z.toFixed(3)};
      if(hr){handRootWorld={x:+hr.x.toFixed(3),y:+hr.y.toFixed(3),z:+hr.z.toFixed(3)};if(typeof HOOP!=='undefined')handRootRimDistance=hr.distanceTo(HOOP);}
      if(typeof HOOP!=='undefined')rimDistance=h.distanceTo(HOOP);
    }
    return {t:+p.t.toFixed(3),idx:p.idx,action:seg&&seg.action,u:seg?+(Math.max(0,Math.min(1,(p.t-seg.start)/seg.dur))).toFixed(3):null,
      rootYaw:guy?guy.g.rotation.y:null,rootRoll:guy?guy.g.rotation.z:null,rootY:guy?+guy.g.position.y.toFixed(3):null,
      actorFace:actor?actor.face:null,
      ballVisible:!!(ball&&ball.visible),ballParentIsGrip:!!(ball&&grip&&ball.parent===grip),
      ballParentIsScene:!!(ball&&ball.parent===scene),ballGripDistance:distance,handWorld,handRootWorld,ballWorld,
      rimDistance:guy&&guy.g&&Number.isFinite(rimDistance)?+rimDistance.toFixed(3):null,
      handRootRimDistance:guy&&guy.g&&Number.isFinite(handRootRimDistance)?+handRootRimDistance.toFixed(3):null,
      dunkPhase:guy&&guy.g&&guy.g.userData?guy.g.userData.pregameDunkPhase||null:null,
      dunkBallPhase:seg&&seg._pregameDunkBallPhase||null};
  });
  const waitUntil=expr=>page.waitForFunction(expr,{timeout:6000});

  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>.20");
  const shootHeld=await snapshot();
  await page.screenshot({path:path.join(captureDir,"01-shoot-held.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>.95");
  const shootFlight=await snapshot();
  await page.screenshot({path:path.join(captureDir,"02-shoot-flight.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>1.78");
  const dunkHeld=await snapshot();
  await page.screenshot({path:path.join(captureDir,"03-dunk-held.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>2.47");
  const dunkHang=await snapshot();
  await page.screenshot({path:path.join(captureDir,"04-dunk-hang.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>2.60");
  const dunkThrough=await snapshot();
  await page.screenshot({path:path.join(captureDir,"05-dunk-through-rim.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>2.70");
  const dunkHangSwing=await snapshot();
  await page.screenshot({path:path.join(captureDir,"06-dunk-hang-swing.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>2.93");
  const dunkLand=await snapshot();
  await page.screenshot({path:path.join(captureDir,"07-dunk-land.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>3.16");
  const dunkRecover=await snapshot();
  await page.screenshot({path:path.join(captureDir,"08-dunk-recover.png")});
  await waitUntil("AIBA.runtime.service('presentation:pregame').PREGAME.t>3.35");
  const orbitFinger=await snapshot();
  await page.screenshot({path:path.join(captureDir,"09-orbit-finger.png")});

  console.log("  SNAPSHOT",JSON.stringify({dunkHeld,dunkHang,dunkThrough,dunkHangSwing,dunkLand,dunkRecover}));

  assert(shootHeld.action==="shoot"&&shootHeld.ballVisible&&shootHeld.ballParentIsGrip,
    "投篮抬球阶段球可见且父节点是投篮手 ballGrip");
  assert(shootHeld.ballGripDistance<.03,"投篮持球阶段球心与手锚点重合("+shootHeld.ballGripDistance?.toFixed(3)+"m)");
  assert(shootFlight.action==="shoot"&&shootFlight.ballVisible&&shootFlight.ballParentIsScene,
    "投篮出手后球才脱离 ballGrip 进入世界飞行");
  assert(dunkHeld.action==="dunk"&&dunkHeld.ballVisible&&dunkHeld.ballParentIsGrip,
    "扣篮起跳/空中阶段球仍挂在手上，不再空手扣篮");
  assert(dunkHang.action==="dunk"&&dunkHang.dunkPhase==="hang"&&dunkHang.handRootRimDistance<.35,
    "扣篮最高点进入单手挂框阶段，手腕落在篮圈附近("+dunkHang.handRootRimDistance+"m)");
  assert(dunkThrough.action==="dunk"&&dunkThrough.ballVisible&&dunkThrough.ballParentIsScene&&
    (dunkThrough.dunkBallPhase==="through-net"||dunkThrough.dunkBallPhase==="exit-net"),
    "扣篮球脱手后沿篮圈中心穿网，而不是在篮筐下方释放");
  assert(dunkHangSwing.action==="dunk"&&dunkHangSwing.dunkPhase==="hang"&&
    Math.abs(dunkHangSwing.rootRoll-dunkHang.rootRoll)>.08,
    "单手挂框期间身体有可见的小幅摆动("+Math.abs(dunkHangSwing.rootRoll-dunkHang.rootRoll).toFixed(3)+"rad)");
  assert(dunkLand.action==="dunk"&&dunkLand.dunkPhase==="land"&&dunkLand.ballParentIsScene,
    "单手挂框后松手落地，球的飞行状态不会绑回人物根节点");
  assert(dunkRecover.action==="dunk"&&(dunkRecover.dunkPhase==="land"||dunkRecover.dunkPhase==="recover")&&dunkRecover.rootY<.2&&
    dunkRecover.handRootRimDistance>.45,
    "扣篮挂框后已回到地面并放下手臂(rootY="+dunkRecover.rootY+"m)");
  const yawError=[shootHeld,shootFlight,dunkHeld,dunkHang,dunkThrough,dunkHangSwing,dunkLand,dunkRecover,orbitFinger].map(s=>{
    let d=(s.rootYaw||0)-(s.actorFace||0);while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return Math.abs(d);
  });
  assert(Math.max(...yawError)<.08,"环绕镜头期间球员根节点保持朝向，脚不追着镜头自转("+Math.max(...yawError).toFixed(3)+"rad)");
  assert(orbitFinger.action==="finger"&&Math.abs(orbitFinger.rootYaw-orbitFinger.actorFace)<.08,
    "对镜头动作只转头/上身，脚下根节点仍锁定");
  assert(!errors.length,"赛前热身回归无运行时错误"+(errors.length?": "+errors[0]:""));
  await page.close();
}finally{
  await browser.close();
  server.close();
}
console.log(failures?`\n${failures} 条失败`:`\n赛前热身球/镜头回归通过`);
process.exit(failures?1:0);
