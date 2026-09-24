/* 篮筐组近景逐帧截图（PH-3 验收用）。跑：node scripts/hoop-fx.frames.mjs [输出目录]
   默认输出 artifacts/hoop-fx-<日期>/，每种结果一组帧 + contact.html 拼图页。

   ?physics=real&seed=7 进练习模式，挑出空心 / 转筐进 / 磕出三种球，在碰筐、穿网的关键
   时刻把镜头钉在篮筐侧前方近景截图。镜头通过包一层 renderer.render 覆盖（游戏每帧会重写
   相机）；截图在同一个任务里 toDataURL（preserveDrawingBuffer=false，晚一拍就是黑屏）。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","hoop-fx-"+new Date().toISOString().slice(0,10).replace(/-/g,"")));
fs.mkdirSync(OUT,{recursive:true});
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
    try{B=await m.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding","--use-gl=angle","--use-angle=swiftshader"]});break;}catch(e){}
  }
  if(B)break;
}
if(!B){console.error("需要 Playwright: npx playwright install chromium");server.close();process.exit(2);}
const ctx=await B.newContext({viewport:{width:720,height:540},deviceScaleFactor:1});
try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
const page=await ctx.newPage();
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?physics=real&seed=7&intro=0&quality=hd`,{waitUntil:"load",timeout:60000});
await page.waitForFunction("typeof startPractice==='function'&&typeof G!=='undefined'",{timeout:30000});
await page.evaluate(()=>{
  const core=window.AIBA.runtime.service("rendering:core");
  const r=core.renderer,orig=r.render.bind(r);
  window.__cam=null;
  r.render=(sc,cam)=>{
    if(window.__cam&&cam&&cam.isPerspectiveCamera){cam.position.set(...window.__cam.p);cam.lookAt(...window.__cam.look);cam.updateMatrixWorld(true);}
    return orig(sc,cam);
  };
  const bl=document.getElementById("bootLoad");if(bl)bl.style.display="none";
  document.querySelectorAll(".hud,#hud,#toast,#tip,#coachTip").forEach(e=>e.style.visibility="hidden");
  window.requestAnimationFrame=()=>0;
  THREE.Clock.prototype.getDelta=()=>1/60;
  window.__step=n=>{for(let i=0;i<n;i++){try{animate();}catch(e){}}};
  window.__wait=ms=>new Promise(r=>setTimeout(r,ms));
  window.__shot=null;
  const orig2=window.spawnPhysicsBall;
  window.spawnPhysicsBall=function(){const b=orig2.apply(this,arguments);window.__shot=b;return b;};
});

/* 在练习里按力度找一颗指定结果的球（每次重开练习保证种子序列一致） */
async function findShot(kind,powers){
  for(const pw of powers){
    const got=await page.evaluate(async({pw})=>{
      try{showMenu();window.__step(20);}catch(e){}
      startPractice();
      for(let i=0;i<80&&!G.canShoot;i++){window.__step(30);await window.__wait(5);}
      if(!G.canShoot)return null;
      window.__shot=null;
      if(!startCharge())G.charging=true;
      G.power=0;let c=0;while(G.power<pw&&c++<400)window.__step(1);
      doRelease();
      for(let i=0;i<30&&!window.__shot;i++)window.__step(1);
      const b=window.__shot;if(!b)return null;
      return {kind:b.physicsKind,events:b.events.map(e=>[e.type,+e.t.toFixed(3),+(e.impulse||0).toFixed(2)])};
    },{pw});
    if(got&&got.kind===kind)return {pw,...got};
  }
  return null;
}
async function capture(tag,times){
  const frames=[];
  for(const [label,t] of times){
    const data=await page.evaluate(async({t})=>{
      const b=window.__shot;
      while(b&&b.t<t-1/120&&window.AIBA.runtime.service("gameplay:shots").balls.includes(b))window.__step(1);
      window.__cam={p:[.78,3.02,-7.1],look:[0,2.86,-8.0]};
      window.animate();
      const url=document.querySelector("canvas").toDataURL("image/jpeg",.9);
      const fx=window.AIBAHoopDynamics&&window.AIBAHoopDynamics.state;
      return {url,t:b?+b.t.toFixed(3):null,rimPitch:fx?+fx.rimPitch.a.toFixed(4):null,boardPitch:fx?+fx.boardPitch.a.toFixed(4):null};
    },{t});
    const file=`${tag}-${label}.jpg`;
    fs.writeFileSync(path.join(OUT,file),Buffer.from(data.url.split(",")[1],"base64"));
    frames.push({file,label,t:data.t,rimPitch:data.rimPitch,boardPitch:data.boardPitch});
  }
  return frames;
}

const report={};
const plan=[["swish",[74,73,75,72,76]],["rattleIn",[68,79,80,67,69,78,81,66]],["rimOut",[62,86,60,88,64,84]]];
for(const [kind,powers] of plan){
  const shot=await findShot(kind,powers);
  if(!shot){console.log(`没找到 ${kind}`);continue;}
  const first=shot.events.find(e=>e[0]==="rim"||e[0]==="net"||e[0]==="made")||shot.events[0];
  const t0=first[1];
  const times=[["a-before",t0-.10],["b-contact",t0+.01],["c-+60ms",t0+.06],["d-+120ms",t0+.12],["e-+220ms",t0+.22],["f-+400ms",t0+.40],["g-+700ms",t0+.70]];
  report[kind]={pw:shot.pw,events:shot.events,frames:await capture(kind,times)};
  console.log(`${kind}: 蓄力 ${shot.pw}，事件 ${shot.events.map(e=>e[0]+"@"+e[1]+(e[2]?"("+e[2]+")":"")).join(" ")}`);
  report[kind].frames.forEach(f=>console.log(`   ${f.label} t=${f.t} 篮筐下压 ${f.rimPitch} 篮板 ${f.boardPitch}`));
}
fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify({report,errs},null,2));
const html=`<!doctype html><meta charset=utf-8><title>篮筐组近景</title><style>body{background:#111;color:#ddd;font:13px system-ui;margin:16px}h2{margin:18px 0 6px}.row{display:flex;gap:6px;flex-wrap:wrap}figure{margin:0}img{width:300px;display:block}figcaption{font-size:11px;color:#9aa}</style>`+
  Object.entries(report).map(([k,r])=>`<h2>${k} · 蓄力 ${r.pw}</h2><div class=row>`+r.frames.map(f=>`<figure><img src="${f.file}"><figcaption>${f.label} · t=${f.t}s · 篮筐 ${f.rimPitch}</figcaption></figure>`).join("")+"</div>").join("");
fs.writeFileSync(path.join(OUT,"contact.html"),html);
console.log("输出:",OUT,"页面报错:",errs.length);errs.slice(0,5).forEach(e=>console.log("  "+e));
await B.close();server.close();
