/* 球员建模近景（游戏内真实光照、着色、球鞋）。跑：node scripts/model-shots.mjs [输出目录]
   百分大战里球员站定持球，镜头绕球员拍 正面 / 3/4 / 侧面 / 背面 全身近景 + 头部特写。
   STAR=j23 指定球星；EXTRA 追加 URL 参数（如 "&shade=classic"）拍对照。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","model-shots"));
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
  const data=await page.evaluate(({cam})=>{window.__cam=cam;window.animate();return document.querySelector("canvas").toDataURL("image/jpeg",.92);},{cam});
  fs.writeFileSync(path.join(OUT,name+".jpg"),Buffer.from(data.split(",")[1],"base64"));
}
const info=await page.evaluate(async({starId})=>{
  window.__noRender=true;
  const star=LEGENDS.find(s=>s&&s.id===starId)||LEGENDS[0];
  G.battleOpp=LEGENDS.find(s=>s.id!==star.id);
  G.myStar=star;applyStarStyle(player,star);
  startBattle();
  for(let i=0;i<300&&!(G.state==="battle"&&G.canShoot);i++){window.__step(30);await window.__wait(5);}
  for(let i=0;i<40;i++)window.__step(1);
  window.__noRender=false;
  // 藏掉 HUD 与场上其他人，只看这一个球员
  document.querySelectorAll("#hud,#battleControls,#toast,#pops").forEach(e=>e&&(e.style.visibility="hidden"));
  const p=player.g.position,f=player.g.rotation.y;
  return {p:[p.x,p.y,p.z],f,star:star.id};
},{starId:process.env.STAR||"j23"});
const [x,,z]=info.p,f=info.f,R=2.4;
const at=(yaw,dist,h,lookY)=>({p:[x+Math.sin(f+yaw)*dist,h,z+Math.cos(f+yaw)*dist],look:[x,lookY,z]});
await snap("front",at(0,R,1.15,.95));
await snap("three-quarter",at(.75,R,1.2,.95));
await snap("side",at(Math.PI/2,R,1.1,.95));
await snap("back",at(Math.PI,R,1.2,.95));
await snap("head",at(.45,.95,1.72,1.6));
await snap("feet",at(.6,1.1,.45,.2));
console.log("输出:",OUT,"球星",info.star,"报错",errs.length,errs.slice(0,3));
await B.close();server.close();
