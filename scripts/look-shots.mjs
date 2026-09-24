/* 固定机位外观对比截图（人物 / 场地）。跑：node scripts/look-shots.mjs [输出目录]
   环境变量 EXTRA 追加 URL 参数，比如 EXTRA="&shade=classic" 拍改前，不带拍改后：
     EXTRA="&shade=classic" node scripts/look-shots.mjs artifacts/look-classic
     node scripts/look-shots.mjs artifacts/look-shaded
   机位：百分大战游戏机位（蓄力中）、玩家正面 3/4、玩家侧面、转播高机位、底线机位。
   相机通过包一层 renderer.render 覆盖；截图在同一任务里 toDataURL（否则黑屏）。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","look-baseline"));
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
const ctx=await B.newContext({viewport:{width:900,height:600},deviceScaleFactor:1});
try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
const page=await ctx.newPage();
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?physics=real&seed=7&intro=0&quality=hd${process.env.EXTRA||""}`,{waitUntil:"load",timeout:60000});
await page.waitForFunction("typeof startPractice==='function'&&typeof G!=='undefined'",{timeout:30000});
await page.evaluate(()=>{
  const core=window.AIBA.runtime.service("rendering:core");
  const r=core.renderer,orig=r.render.bind(r);
  window.__cam=null;
  /* 镜头在游戏的镜头导演之后设定（改 rig），而不是在 renderer.render 里改相机：
     地板倒影（floor-reflect.js）在主渲染之前按主相机画，渲染时才改相机会让两者对不上。 */
  const origDirector=window.updateCameraDirector;
  window.updateCameraDirector=function(){
    const out=origDirector.apply(this,arguments);
    if(window.__cam){rig.pos.set(...window.__cam.p);rig.look.set(...window.__cam.look);}
    return out;
  };
  r.render=(sc,cam)=>{
    if(window.__noRender)return;                 // 等待阶段不渲染（软件光栅化太慢）
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


async function snap(name,cam){
  const data=await page.evaluate(({cam})=>{window.__cam=cam;window.animate();return document.querySelector("canvas").toDataURL("image/jpeg",.9);},{cam});
  fs.writeFileSync(path.join(OUT,name+".jpg"),Buffer.from(data.split(",")[1],"base64"));
}
// 1) 百分大战：游戏机位（不覆盖相机），蓄力中
await page.evaluate(async()=>{
  window.__noRender=true;
  if(!G.battleOpp)G.battleOpp=LEGENDS[0];
  startBattle();
  for(let i=0;i<200&&!(G.state==="battle"&&G.canShoot);i++){window.__step(30);await window.__wait(5);}
  if(!startCharge())G.charging=true;G.power=0;let c=0;while(G.power<40&&c++<200)window.__step(1);
  window.__noRender=false;
});
await snap("battle-gamecam",null);
// 2) 玩家近景：正面 3/4、侧面
const pp=await page.evaluate(()=>{const p=player.g.position;return [p.x,p.y,p.z];});
await snap("player-front34",{p:[pp[0]+1.6,1.55,pp[2]-2.4],look:[pp[0],1.05,pp[2]]});
await snap("player-side",{p:[pp[0]+2.6,1.3,pp[2]],look:[pp[0],1.0,pp[2]]});
// 3) 球场全景（转播高机位）
await snap("court-broadcast",{p:[11,7.5,-2],look:[0,1,-5]});
await snap("court-baseline",{p:[0,2.2,-12.4],look:[0,1.6,0]});
console.log("输出:",OUT,"报错",errs.length,errs.slice(0,3));
await B.close();server.close();
