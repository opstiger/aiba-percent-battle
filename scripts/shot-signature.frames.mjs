/* 各球星投篮签名对比（spine-layer.js 签名层 + config.js SHOT_STYLES）。
   跑：node scripts/shot-signature.frames.mjs [输出目录]；EXTRA="&spine=off" 拍关闭签名层的对照组。
   百分大战（第三人称）里把玩家依次换成各球星，投完美球，侧面机位在同样的相对时刻截图：
   蓄力中 / 出手瞬间 / 出手后 .15 .35 .6 .9 秒，每位球星一行，拼成 grid.jpg。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","shot-signature"));
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
    if(window.__noRender)return;                 // 等待阶段不渲染（软件光栅化几千帧太慢）
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



const STARS=(process.env.STARS||"curry,thompson,allen,j23,k24,bird,t01").split(",");
const rows=[];
for(const id of STARS){
  const r=await page.evaluate(async({id})=>{
    const star=LEGENDS.find(s=>s&&s.id===id);if(!star)return {id,missing:true};
    window.__noRender=true;
    if(G.state!=="battle"){
      try{showMenu();window.__step(20);}catch(e){}
      if(!G.battleOpp)G.battleOpp=LEGENDS.find(s=>s.id!==id);
      G.myStar=star;applyStarStyle(player,star);
      startBattle();
    }else{G.myStar=star;applyStarStyle(player,star);}
    for(let i=0;i<300&&!(G.state==="battle"&&G.canShoot);i++){window.__step(30);await window.__wait(5);}
    const shots=window.AIBA.runtime.service("gameplay:shots");
    const pp=player.g.position,face=player.g.rotation.y;
    const side=[Math.cos(face)*3.2,0,-Math.sin(face)*3.2];
    const cam={p:[pp.x+side[0],1.45,pp.z+side[2]],look:[pp.x,1.35,pp.z]};
    const frames=[];
    const snap=tag=>{window.__noRender=false;window.__cam=cam;window.animate();window.__noRender=true;frames.push([tag,document.querySelector("canvas").toDataURL("image/jpeg",.85)]);};
    const ideal=typeof shotIdeal==="function"?shotIdeal(curShot()):74;
    const seen=new Set(shots.balls);
    if(!startCharge())G.charging=true;G.power=0;
    let k=0,snappedLoad=false,ball=null;
    while(k++<400&&!ball){
      if(G.charging&&G.power>=ideal)doRelease();
      if(!snappedLoad&&G.power>=ideal*.6){snappedLoad=true;snap("a-load");}
      else window.animate();
      ball=shots.balls.find(x=>!seen.has(x)&&!x.opp&&!x.silent);
    }
    snap("b-release");
    const dbg=[];
    let t=0;
    for(const [tag,target] of [["c-+0.15",.15],["d-+0.35",.35],["e-+0.60",.6],["f-+0.90",.9]]){
      while(t<target-1e-6){window.animate();t+=1/60;}
      const d=AIBASpine&&AIBASpine.debug(player);dbg.push(d?{t:+t.toFixed(2),pitch:+d.pitch.toFixed(3),jumpH:+d.jumpH.toFixed(3),holding:d.holding}:null);
      snap(tag);
    }
    return {id,frames,dbg,style:player.shotStyle};
  },{id});
  if(r.missing){console.log("没有球星",id);continue;}
  const dir=path.join(OUT,id);fs.mkdirSync(dir,{recursive:true});
  r.frames.forEach(([tag,url])=>fs.writeFileSync(path.join(dir,tag+".jpg"),Buffer.from(url.split(",")[1],"base64")));
  const st=r.style||{};
  console.log(id.padEnd(9),"jump",st.jump,"fade",st.fade,"hold",st.hold,"kick",st.kick,"|",r.dbg.map(d=>d&&`${d.t}s 俯仰${d.pitch} 离地${d.jumpH}${d.holding?" 定格":""}`).join(" · "));
  rows.push(id);
}
fs.writeFileSync(path.join(OUT,"stars.json"),JSON.stringify(rows));
console.log("输出:",OUT,"报错",errs.length,errs.slice(0,3));
await B.close();server.close();
