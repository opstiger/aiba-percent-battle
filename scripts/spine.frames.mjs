/* 胸腔叠加层（M3）逐帧验收。跑：node scripts/spine.frames.mjs [输出目录]
   侧面机位连拍完美 / 过力 / 欠力三种出手，记录胸腔俯仰；并量"出手跳球"：出手前一帧
   画面上手里的球（带叠加层）与出手后第一帧飞出的球之间的距离。手在出手瞬间本身以约 4m/s
   在动，一帧就有 6~7cm，所以看的是与 EXTRA="&spine=off" 对照组的差值，不看绝对值。
   EXTRA="&spine=off" 拍关闭叠加层的对照组。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","spine-frames"));
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


const rows={};
for(const [name,pw] of [["perfect",74],["over",84],["under",52]]){
  const r=await page.evaluate(async({pw})=>{
    /* 百分大战是第三人称（练习默认第一人称，身体隐藏，叠加层按设计不作用于隐藏角色） */
    if(G.state!=="battle"){
      try{showMenu();window.__step(20);}catch(e){}
      if(!G.battleOpp)G.battleOpp=LEGENDS[0];
      startBattle();
    }
    window.__noRender=true;
    for(let i=0;i<200&&!(G.state==="battle"&&G.canShoot);i++){window.__step(30);await window.__wait(5);}
    const shots=window.AIBA.runtime.service("gameplay:shots");
    const pp=player.g.position,face=player.g.rotation.y;
    // 侧面机位：球员右侧 2.6m
    const side=[Math.cos(face)*2.6,0,-Math.sin(face)*2.6];
    const cam={p:[pp.x+side[0],1.35,pp.z+side[2]],look:[pp.x,1.15,pp.z]};
    const frames=[],pitch=[];
    const snap=tag=>{window.__noRender=false;window.__cam=cam;window.animate();window.__noRender=true;frames.push([tag,document.querySelector("canvas").toDataURL("image/jpeg",.85)]);};
    const seen=new Set(shots.balls);
    if(!startCharge())G.charging=true;G.power=0;
    let k=0,handBefore=null,ball=null,shotAt=-1;
    while(k++<200){
      if(G.charging&&G.power>=pw)doRelease();
      window.animate();
      const d=window.AIBASpine&&AIBASpine.debug(player);pitch.push(d?+d.pitch.toFixed(3):0);
      ball=shots.balls.find(x=>!seen.has(x)&&!x.opp&&!x.silent);
      if(!ball){handBefore=AIBASpine?AIBASpine.withPose(player,()=>pBall.getWorldPosition(new THREE.Vector3())):pBall.getWorldPosition(new THREE.Vector3());}
      else if(shotAt<0)shotAt=k;
      if(k%6===0&&frames.length<12)snap("f"+String(k).padStart(3,"0"));
      if(shotAt>0&&k-shotAt>70)break;
    }
    const b0=ball&&ball.p0;
    const pop=b0&&handBefore?Math.hypot(b0.x-handBefore.x,b0.y-handBefore.y,b0.z-handBefore.z):null;
    return {frames,pitch,pop,shotAt,err:G.lastErr};
  },{pw});
  const dir=path.join(OUT,name);fs.mkdirSync(dir,{recursive:true});
  r.frames.forEach(([tag,url])=>fs.writeFileSync(path.join(dir,tag+".jpg"),Buffer.from(url.split(",")[1],"base64")));
  rows[name]={pop:r.pop,shotAt:r.shotAt,err:r.err,pitchMin:Math.min(...r.pitch),pitchMax:Math.max(...r.pitch),pitchAfter:r.pitch.slice(r.shotAt,r.shotAt+40).filter((_,i)=>i%5===0)};
  console.log(name,"err",r.err&&r.err.toFixed(1),"出手跳球",r.pop&&(r.pop*100).toFixed(1)+"cm","胸腔俯仰范围",Math.min(...r.pitch).toFixed(3),"~",Math.max(...r.pitch).toFixed(3),"出手后",JSON.stringify(rows[name].pitchAfter));
}
fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify({rows,errs},null,2));
console.log("输出:",OUT,"报错",errs.length,errs.slice(0,3));
await B.close();server.close();
