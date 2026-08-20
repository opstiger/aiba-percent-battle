/* 首屏第一投的端到端验证。跑:node scripts/boot-shot.test.mjs
   必须用无头浏览器:预览标签页切后台就冻结 rAF,球永远飞不完。

   验的是几条"错了首屏就翻车"的性质:
     - 点一下之后真的投出了球,而且**必定空心入网**(不能有任何失败可能)
     - 甜区没有被移动(不作弊):出手力度 == ideal
     - 音频在按下那一刻解锁,但菜单音乐**不能**提前进来(要把留白留给刷网)
     - 不点也会自动投,绝不卡死
     - 跳过随时可用
     - 只在首次跑,第二次直接进首页 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",
  ".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
function serve(){
  return new Promise(res=>{
    const s=http.createServer((rq,rs)=>{
      const clean=decodeURIComponent(rq.url.split("?")[0]);
      if(clean==="/favicon.ico"){rs.writeHead(204);return rs.end();}
      const f=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!f.startsWith(ROOT)){rs.writeHead(403);return rs.end();}
      fs.readFile(f,(e,b)=>{
        if(e){rs.writeHead(404);return rs.end();}
        rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});
        rs.end(b);
      });
    });
    s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));
  });
}
function mods(){
  const out=[],seen=new Set();
  const push=b=>{for(const p of ["playwright","playwright-core"]){
    try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");
  try{const n=path.join(process.env.HOME||"","/.npm/_npx");
    for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}
  return out;
}
async function launch(){
  for(const m of mods()){
    try{return await m.chromium.launch();}catch(e){}
    try{return await m.chromium.launch({channel:"chrome"});}catch(e){}
  }
  console.error("需要 Playwright: npm i -g playwright && npx playwright install chromium");
  process.exit(2);
}

const {s:server,port}=await serve();
const browser=await launch();
let fail=0;
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)fail++;};

async function fresh(extra){
  const page=await browser.newPage({viewport:{width:420,height:860}});
  const errs=[];
  page.on("pageerror",e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=1${extra||""}`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);  // 非音频测试一律静音
  });
  return {page,errs};
}
/* 走完整启动:等门就绪 -> 点门 -> 进首屏投篮 */
async function toIntro(page){
  await page.waitForFunction("window.BOOT_READY===true",{timeout:25000});
  /* 注意:navigation.js 把加载门从 pointerdown 改绑到了 pointerup
     (它 removeEventListener 掉了 pointerdown 那个),所以这里必须发 pointerup。 */
  await page.evaluate(()=>{const g=document.getElementById("bootLoad");if(g)g.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));});
  await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:8000});
}

console.log("① 点一下 -> 必定空心入网");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  const before=await page.evaluate(()=>({state:G.state,cam:CAM.mode,
    spot:[+P.pos.x.toFixed(2),+P.pos.z.toFixed(2)],
    menuMusic:!!(window.audioState&&audioState().menuMusic)}));
  // 记录出手力度和 ideal,验证"甜区没被移动"
  await page.evaluate(()=>{
    window.__rel=null;const o=window.doRelease;
    window.doRelease=function(){window.__rel={power:G.power,ideal:weatherAdjustedIdeal(curShot(),true)};return o.apply(this,arguments);};
  });
  await page.evaluate(()=>dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})));
  const musicDuringFlight=await page.evaluate(async()=>{
    await new Promise(r=>setTimeout(r,260));
    return !!(window.audioState&&audioState().menuMusic);
  });
  await page.waitForFunction("window.AIBABootShot.state().on===false",{timeout:12000});
  const after=await page.evaluate(()=>({state:G.state,cam:CAM.mode,balls:balls.length,
    rel:window.__rel,made:(G.shots||[]).length?!!G.shots[G.shots.length-1].made:null,
    seen:localStorage.getItem("aiba_boot_shot_seen")}));
  check(before.state==="bootshot","按下前处于 bootshot 状态");
  check(before.cam===0,"第一人称机位");
  check(Math.abs(before.spot[0])<0.2&&Math.abs(before.spot[1])<0.3,"站在弧顶 ("+before.spot.join(",")+")");
  check(!before.menuMusic,"仪式开始时菜单音乐没有提前进来");
  check(!musicDuringFlight,"球飞行途中菜单音乐仍未进来(留白给刷网)");
  check(!!after.rel,"真的调用了出手");
  check(after.rel&&Math.abs(after.rel.power-after.rel.ideal)<0.01,
    "出手力度 == ideal,甜区没被移动"+(after.rel?` (${after.rel.power} vs ${after.rel.ideal})`:""));
  check(after.state==="menu","收场后回到首页状态");
  check(after.balls===0,"首屏那颗球已清理,没带进首页");
  check(after.seen==="1","已标记看过,第二次不再跑");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n② 不点也会自动投,不卡死");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  // 把空闲阈值改短,免得真等 6 秒
  const auto=await page.evaluate(async()=>{
    const t0=Date.now();
    await new Promise(r=>setTimeout(r,7200));
    return {on:AIBABootShot.state().on,phase:AIBABootShot.state().phase,ms:Date.now()-t0};
  });
  check(auto.on===false||auto.phase!=="idle","6 秒没点会自动投出(现在 phase="+auto.phase+")");
  check(!errs.length,"零报错");
  await page.close();
}

console.log("\n③ 跳过随时可用");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  await page.evaluate(()=>skipBootShot());
  await page.waitForFunction("window.AIBABootShot.state().on===false",{timeout:6000});
  const st=await page.evaluate(()=>({state:G.state,seen:localStorage.getItem("aiba_boot_shot_seen")}));
  check(st.state==="menu","跳过后进首页");
  check(st.seen==="1","跳过也算看过");
  check(!errs.length,"零报错");
  await page.close();
}

console.log("\n④ 第二次进入不再跑仪式");
{
  const page=await browser.newPage({viewport:{width:420,height:860}});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"load"});
  await page.evaluate(()=>{try{localStorage.setItem("aiba_boot_shot_seen","1");}catch(e){}});
  const run=await page.evaluate(()=>window.AIBABootShot?AIBABootShot.shouldRun():"没加载");
  check(run===false,"看过之后 shouldRun() 返回 false");
  await page.close();
}

await browser.close();server.close();
console.log(fail?`\n${fail} 条失败`:"\n首屏第一投验证通过");
process.exit(fail?1:0);
