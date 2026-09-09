/* 球架 / 取球 / 左手镜像的取景截图台。不是测试,是给人看的。
   跑:node scripts/rack-shots.mjs   输出:artifacts/rack-20260909/

   为什么单独写一个而不是靠预览面板截图:面板显示与否由用户界面控制,
   我这边控制不了,而且它一隐藏就不再合成帧。自带 Playwright 出图完全不依赖它。

   三个必须踩过的坑(前面都吃过):
     · preserveDrawingBuffer 必须开,否则 toDataURL 拿到已清空的缓冲 = 纯黑图
     · rAF 要能冻结,否则摆好机位后游戏循环下一帧就把它覆盖回普通游戏画面
     · 默认第一人称下 player.g.visible=false —— 不手动打开就是"渲染正常但人不见了" */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"artifacts/rack-20260909");
fs.mkdirSync(OUT,{recursive:true});
const mime={".js":"text/javascript",".html":"text/html",".css":"text/css",".json":"application/json",".png":"image/png",".mp3":"audio/mpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp4":"video/mp4"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/favicon.ico"){res.writeHead(204);return res.end();}
  const file=path.resolve(ROOT,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname));
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(err.code==="EISDIR"?204:404);return res.end();}
    res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(data);
  });
});

let browser;
const shot=async(page,name)=>{
  const data=await page.evaluate(()=>renderer.domElement.toDataURL("image/png"));
  fs.writeFileSync(path.join(OUT,name+".png"),Buffer.from(data.split(",")[1],"base64"));
  console.log("  →",name+".png");
};

try{
  await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok);});
  const bases=[import.meta.url,"/opt/homebrew/lib/node_modules/"];
  const cache=path.join(process.env.HOME||"",".npm/_npx");
  if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))bases.push(path.join(cache,d,"node_modules/"));
  outer:for(const base of bases)for(const pkg of ["playwright","playwright-core"]){
    let mod;try{mod=createRequire(base)(pkg);}catch{continue;}
    try{browser=await mod.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break outer;}catch{}
  }
  if(!browser)throw new Error("需要 Playwright: npx playwright install chromium");

  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});
  await context.addInitScript(()=>{
    let seed=4211;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    const raf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=fn=>raf(t=>{if(!window.__freeze)fn(t);});
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
  });
  const page=await context.newPage();
  const errs=[];page.on("pageerror",e=>errs.push(e.message));
  await page.goto("http://127.0.0.1:"+server.address().port+"/index.html?intro=0&quality=hd&seed=4211",{waitUntil:"load",timeout:60000});
  await page.waitForFunction("typeof player!=='undefined'&&player&&player.g&&typeof readyBall==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  try{await page.waitForFunction("G.canShoot===true",{timeout:15000});}
  catch(e){console.log("!! 卡住了。页面报错:",errs.slice(0,4).join(" | ")||"(无)");throw e;}

  /* 统一的取景器。传世界坐标,直接写 camera,再冻结出帧。 */
  await page.evaluate(()=>{
    window.__view=(pos,tgt,fov)=>{
      window.__freeze=true;
      player.g.visible=true;if(player.groundShadow)player.groundShadow.visible=true;
      camera.position.set(pos[0],pos[1],pos[2]);
      camera.lookAt(new THREE.Vector3(tgt[0],tgt[1],tgt[2]));
      camera.fov=fov||38;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);renderer.render(scene,camera);
    };
    window.__spot=()=>{const p=RACKS[2].p;return [p.x,p.y,p.z];};
  });

  console.log("① 右手球员:球架在辅助手(左)一侧");
  await page.evaluate(()=>{
    const props=AIBA.runtime.service("rendering:props");
    G.myStar={id:"thompson"};
    AIBA.runtime.service("rendering:characters").applyStarStyle(player,
      {id:"thompson",col:[0xffc72c,0x1d428a],num:11,skin:0x8d5524});
    props.placeRacks(props.currentRackSide());
    const s=RACKS[2].p;const dir=HOOP.clone().sub(s);dir.y=0;dir.normalize();
    player.g.position.set(s.x,0,s.z);player.g.rotation.set(0,Math.atan2(dir.x,dir.z),0);
    P.pos.set(s.x,0,s.z);P.face=Math.atan2(dir.x,dir.z);
    poseGuy(player,shotCurves(0),0,1);
  });
  await page.evaluate(()=>{const s=__spot();__view([s[0]+3.2,2.5,s[2]+3.4],[s[0]-0.4,1.0,s[2]],34);});
  await shot(page,"01-right-hand-rack");

  console.log("② 取球中段:身体转向球架、双手伸过去(球还在架上)");
  /* 不能用 setTimeout 等墙钟:无头环境的 rAF 节流没有保证,上一版就是这么等出
     turn=0(要么还没开始,要么早就结束了)。改成**自己按固定步长驱动帧**,
     想停在取球的哪一拍就停在哪一拍,可复现。 */
  await page.evaluate(({steps})=>{
    const loop=AIBA.runtime.service("core:game-loop");
    window.__freeze=true;                       // 掐掉自动 rAF,只走手动步进
    loop.clock.getDelta=()=>1/60;
    G.canShoot=false;handBall.visible=false;pBall.visible=false;
    readyBall();
    for(let i=0;i<steps;i++)window.animate();   // 60fps 下 17 帧 ≈ 0.283s,正落在 HOLD 末端
  },{steps:17});
  await page.evaluate(()=>{
    const s=__spot();__view([s[0]+3.0,2.3,s[2]+3.2],[s[0]-0.5,1.15,s[2]],32);
  });
  await shot(page,"02-reach-midway");
  const reach=await page.evaluate(()=>{
    const props=AIBA.runtime.service("rendering:props");
    const balls=props.getRackBalls().regular[2].filter(m=>m.visible);
    const low=balls.length?balls.reduce((a,b)=>a.position.y<b.position.y?a:b):null;
    return {turnDeg:+((G.pickupTurn||0)*57.3).toFixed(1),reach:+(G.pickupReach||0).toFixed(2),
      球离手:G.passCatch&&G.passCatch.target&&low
        ?+G.passCatch.target.distanceTo(low.position).toFixed(2):null};
  });
  console.log("   转身 "+reach.turnDeg+"°  reach "+reach.reach);

  console.log("③ 第一人称:看得见球架和伸手");
  await page.evaluate(({steps})=>{
    const loop=AIBA.runtime.service("core:game-loop");
    window.__freeze=true;loop.clock.getDelta=()=>1/60;
    CAM.mode=0;applyCamMode();
    G.canShoot=false;handBall.visible=false;pBall.visible=false;
    readyBall();
    for(let i=0;i<steps;i++)window.animate();
    /* animate() 末尾已经写过 camera 了,这里再渲染一次保证缓冲是新的 */
    renderer.render(scene,camera);
  },{steps:17});
  await shot(page,"03-first-person-reach");

  console.log("④ 左手哈登:整体镜像 + 球架换到右侧");
  await page.evaluate(()=>{
    window.__freeze=false;
    CAM.mode=1;applyCamMode();
    const props=AIBA.runtime.service("rendering:props");
    G.myStar={id:"h13",hand:"left"};
    AIBA.runtime.service("rendering:characters").applyStarStyle(player,
      {id:"h13",hand:"left",col:[0xce1141,0xf7f7f7],num:13,skin:0x8d5524});
    props.placeRacks(props.currentRackSide());
    const s=RACKS[2].p;const dir=HOOP.clone().sub(s);dir.y=0;dir.normalize();
    player.g.position.set(s.x,0,s.z);player.g.rotation.set(0,Math.atan2(dir.x,dir.z),0);
    poseGuy(player,shotCurves(0),0,1);
  });
  await page.evaluate(()=>{const s=__spot();__view([s[0]+3.2,2.5,s[2]+3.4],[s[0]-0.4,1.0,s[2]],34);});
  await shot(page,"04-harden-lefty-rack");

  console.log("⑤ 出手瞬间 A/B:汤普森(几乎不踢) vs 麦迪(全场最大)");
  for(const [id,name] of [["thompson","05-thompson-release"],["t01","06-tmac-release"]]){
    await page.evaluate(({id})=>{
      window.__freeze=false;
      const CFG=window.AIBA_CONFIG;
      AIBA.runtime.service("rendering:characters").applyStarStyle(player,
        {id,col:[0x1d428a,0xffc72c],num:11,skin:0x8d5524});
      player.shotStyle=CFG.shotStyleFor({id});
      const s=RACKS[2].p;const dir=HOOP.clone().sub(s);dir.y=0;dir.normalize();
      player.g.position.set(s.x,0,s.z);player.g.rotation.set(0,Math.atan2(dir.x,dir.z),0);
      G.tNow=0;
      poseGuy(player,shotCurves(1.0,player.shotStyle),0,1);
      applyReleaseFeetPose(player,{released:true,kickWeight:1,landBlend:0,recover:0,airborne:true},0);
    },{id});
    await page.evaluate(()=>{const s=__spot();__view([s[0]+2.6,1.9,s[2]+2.8],[s[0],1.35,s[2]],30);});
    await shot(page,name);
  }

  if(errs.length)console.log("\n⚠ 页面报错:",errs.slice(0,3).join(" | "));
  else console.log("\n零报错。输出目录:",path.relative(ROOT,OUT));
  await context.close();
}finally{
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
}
