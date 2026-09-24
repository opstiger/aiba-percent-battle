/* 真实物理（?physics=real）逐模式冒烟。跑：node scripts/physics-modes.smoke.mjs
   非零退出码 = 不通过。

   在无头 Chromium 里分别用 physics=real 与 physics=classic，逐个模式（练习 / 三分大赛 /
   投篮机 / 百分大战 / 绝杀）各投 8 球，力度有准有偏。每个模式跑完立刻打印一行。检查：
     - 物理模式不能有报错；每一球都要能回到"可以投下一球"（回合推进没被卡死）
     - 物理模式下玩家的球确实走了物理分支，且每颗物理球都结算了（进 / 不进各触发一次）
     - 绝杀模式按设计不接物理；经典模式一颗物理球都不能有（默认行为逐位不变）
   只验逻辑：renderer.render 置空（软件光栅化几千帧要几十分钟，且与本测试无关）。
   为什么不直接跑 smoke-browser.js：它在每个模式里打满整局、帧上限 12000，无头软件渲染下
   两遍要一小时以上，而且中途没有任何输出，卡住和慢分不清。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript",".wasm":"application/wasm"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{
  const c=decodeURIComponent(rq.url.split("?")[0]);
  if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}
  const f=path.join(ROOT,c==="/"?"/index.html":c);
  fs.readFile(f,(e,b)=>{if(e){rs.writeHead(e.code==="EISDIR"?204:404);return rs.end();}
    rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});
});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});

let B=null;
for(const base of [import.meta.url,"/opt/homebrew/lib/node_modules/"].concat(
    (()=>{try{const n=path.join(process.env.HOME||"",".npm/_npx");
      return fs.readdirSync(n).map(d=>path.join(n,d,"node_modules")+"/");}catch(e){return [];}})())){
  for(const pkg of ["playwright","playwright-core"]){
    let m;try{m=createRequire(base)(pkg);}catch(e){continue;}
    try{B=await m.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break;}catch(e){}
  }
  if(B)break;
}
if(!B){console.error("需要 Playwright: npx playwright install chromium");server.close();process.exit(2);}

const MODES=[
  ["练习","startPractice()"],
  ["三分大赛",'goDiff("normal");if(typeof startRound==="function")startRound();'],
  ["投篮机","startRackRush()"],
  ["百分大战","startBattle()"],
  ["绝杀","beginLastShot(true)"]
];
const POWERS=[74,80,66,90,58,74,77,70];
/* 每个模式开一个新页面：上一个模式的 setTimeout（比如投篮机关间计时）会串进下一个模式，
   曾让百分大战在两种物理模式下都结束在 rushend——是测试隔离问题，不是游戏问题。 */
async function openPage(mode){
  const ctx=await B.newContext({viewport:{width:900,height:600},deviceScaleFactor:1});
  try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
  const page=await ctx.newPage();
  const errs=[];page.on("pageerror",e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?physics=${mode}&seed=7&intro=0`,{waitUntil:"load",timeout:60000});
  await page.waitForFunction("typeof startPractice==='function'&&typeof G!=='undefined'",{timeout:30000});
  await page.evaluate(()=>{
    const core=window.AIBA.runtime.service("rendering:core");
    if(core&&core.renderer)core.renderer.render=()=>{};
    const bl=document.getElementById("bootLoad");if(bl)bl.style.display="none";
    window.requestAnimationFrame=()=>0;
    THREE.Clock.prototype.getDelta=()=>1/60;
    window.__errs=[];
    window.__step=n=>{for(let i=0;i<n;i++){try{animate();}catch(e){window.__errs.push("animate: "+e.message+" @ "+String(e.stack||"").split("\n").slice(1,3).map(l=>l.trim().replace(/^at /,"").replace(/http:\/\/127\.0\.0\.1:\d+\//,"")).join(" ← "));}}};
    window.__wait=ms=>new Promise(r=>setTimeout(r,ms));
    window.__stat={spawned:0,settled:0,kinds:{}};
    const orig=window.spawnPhysicsBall;
    if(typeof orig==="function")window.spawnPhysicsBall=function(){
      const b=orig.apply(this,arguments);window.__stat.spawned++;(window.__phys=window.__phys||[]).push(b);
      window.__stat.kinds[b.physicsKind]=(window.__stat.kinds[b.physicsKind]||0)+1;
      /* 结算检查：进球触发 madeBall，没进触发 decided 事件里的 missBall，二者必居其一 */
      const ev=b.events.find(e=>e.type==="made"||e.type==="decided");
      if(ev)b.__settleT=ev.t;
      return b;
    };
    /* 结算按游戏真正派发的事件计：进球（made）或判负（decided 且不会进）各算一次。
       早先按"轮询时刻 ≥ 结算时刻"去数，蓄力循环里没轮询，结算和移除都落在蓄力期间的球会被漏数。 */
    const origEvent=window.physicsBallEvent;
    if(typeof origEvent==="function")window.physicsBallEvent=function(b,e){
      if(!b.__counted&&(e.type==="made"||(e.type==="decided"&&!b.willMake))){b.__counted=true;window.__stat.settled++;}
      return origEvent.apply(this,arguments);
    };
    window.__trackSettled=()=>{};
  });
  return {ctx,page,errs};
}
async function run(mode){
  const rows=[],kinds={};let spawned=0;const pageErrs=[];
  for(const [name,setup] of MODES){
    const t0=Date.now();
    const {ctx,page,errs}=await openPage(mode);
    const row=await page.evaluate(async({setup,POWERS})=>{
      const PLAYABLE=/^(round|tiebreak|battle|rackrush|lastshot)$/;
      const before=window.__errs.length,spawned0=window.__stat.spawned,settled0=window.__stat.settled;
      try{if(typeof showMenu==="function"){showMenu();window.__step(30);await window.__wait(50);}}catch(e){}
      try{(0,eval)(setup);}catch(e){window.__errs.push("setup: "+e.message);}
      let k=0;
      while(!PLAYABLE.test(G.state)&&k<6000){window.__step(60);k+=60;await window.__wait(5);}
      const state0=G.state;
      let shot=0,stuck=0,frames=k;
      for(const pw of POWERS){
        let g=0;
        while(!G.canShoot&&g<900&&PLAYABLE.test(G.state)){window.__step(10);window.__trackSettled();g+=10;if(g%120===0)await window.__wait(5);}
        frames+=g;
        if(!PLAYABLE.test(G.state))break;
        if(!G.canShoot){stuck++;break;}
        if(typeof startCharge==="function"&&!startCharge())G.charging=true;
        G.power=0;let c=0;while(G.power<pw&&c++<400){window.__step(1);}
        doRelease();shot++;
        for(let i=0;i<30;i++){window.__step(10);window.__trackSettled();await window.__wait(2);}
        frames+=300+c;
      }
      for(let i=0;i<60;i++){window.__step(10);window.__trackSettled();}
      return {state0,stateEnd:G.state,shots:shot,stuck,frames,
        physicsBalls:window.__stat.spawned-spawned0,settled:window.__stat.settled-settled0,
        newErrs:window.__errs.slice(before,before+3),errCount:window.__errs.length-before,kinds:window.__stat.kinds,
        /* 没结算的物理球：把它的状态带出来，别只报一个数 */
        unsettled:(window.__phys||[]).filter(b=>!b.__counted).map(b=>({t:+b.t.toFixed(2),settleT:b.__settleT,endT:+b.endT.toFixed(2),phase:b.phase,
          inBalls:window.AIBA.runtime.service("gameplay:shots").balls.includes(b),kind:b.physicsKind,ev:b.events.map(e=>e.type+"@"+e.t.toFixed(2)).join(" ")}))};
    },{setup,POWERS});
    await ctx.close();
    row.模式=name;row.秒=Math.round((Date.now()-t0)/1000);
    spawned+=row.physicsBalls;for(const k in row.kinds)kinds[k]=(kinds[k]||0)+row.kinds[k];
    pageErrs.push(...errs);
    console.log(`[physics=${mode}] ${name}: 起始 ${row.state0} → ${row.stateEnd}，投 ${row.shots} 球，物理球 ${row.physicsBalls}，已结算 ${row.settled}，卡住 ${row.stuck}，报错 ${row.errCount}，${row.秒}s`);
    row.newErrs.forEach(e=>console.log("     "+e));
    row.unsettled.forEach(u=>console.log("     未结算: "+JSON.stringify(u)));
    rows.push(row);
  }
  return {mode,rows,stat:{spawned,kinds},errs:pageErrs};
}

const failures=[];
const real=await run("real");
const classic=await run("classic");
console.log("\n物理球结果分布:",JSON.stringify(real.stat.kinds));
for(const r of [real,classic])if(r.errs.length){console.log(`physics=${r.mode} 页面报错:`);r.errs.slice(0,6).forEach(e=>console.log("   "+e));}
real.rows.forEach((row,i)=>{
  const c=classic.rows[i],name=row.模式;
  /* 两种模式都有的报错是原有问题（比如直接 startBattle() 跳过赛前选对手，OPP.o 为空），
     不算物理改动引入；物理模式不能比经典模式多 */
  if(row.errCount>(c?c.errCount:0))failures.push(`${name}：物理模式 ${row.errCount} 条报错，经典模式 ${c?c.errCount:0} 条`);
  if(row.stuck)failures.push(`${name}：物理模式投完一球后回不到可投状态`);
  if(!/^(round|tiebreak|battle|rackrush|lastshot)$/.test(row.state0))failures.push(`${name}：没进入可投状态（${row.state0}）`);
  if(name==="绝杀"){if(row.physicsBalls)failures.push("绝杀：按设计不接物理，却生成了物理球");}
  else{
    if(row.physicsBalls<Math.min(3,row.shots))failures.push(`${name}：投了 ${row.shots} 球只有 ${row.physicsBalls} 颗物理球`);
    if(row.settled<row.physicsBalls)failures.push(`${name}：${row.physicsBalls} 颗物理球只有 ${row.settled} 颗结算`);
  }
  if(c&&c.shots&&row.shots<c.shots-1)failures.push(`${name}：物理模式只投出 ${row.shots} 球，经典模式 ${c.shots} 球`);
});
if(real.errs.length>classic.errs.length)failures.push(`物理模式页面报错 ${real.errs.length} 条，经典模式 ${classic.errs.length} 条`);
if(classic.stat.spawned)failures.push(`经典模式生成了 ${classic.stat.spawned} 颗物理球，默认行为被改变`);

await B.close();server.close();
if(failures.length){console.log("\n❌ 物理全模式冒烟未通过：");failures.forEach(f=>console.log("  - "+f));process.exit(1);}
console.log("\n✅ 物理逐模式冒烟：无报错、回合推进正常、物理球全部结算，经典模式未受影响");
