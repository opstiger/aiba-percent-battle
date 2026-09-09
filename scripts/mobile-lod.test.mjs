/* 手机端近场观众 LOD 的可逆性验收。跑:node scripts/mobile-lod.test.mjs
   非零退出码 = 验收不通过。

   背景(只在手机上出现的坑):
     enableVisionControl() 会**先**把 VISION.desired=true,再 await getUserMedia。
     perf.js 的包装器随即 applyForVision() → 手机上 setThin(true),藏掉 2/5 近场观众。
     随后摄像头授权被拒(手机上很常见,非 HTTPS 也必失败),vision.js 的 catch 里
     **直接**写 VISION.desired=false,并不走 disableVisionControl,
     于是包装器再也不会触发 —— 瘦身永久留着。
     桌面 wantThin=isMobile()&&visionOn() 恒为 false,所以只有手机能看见:
     场边观众凭空少掉 2/5,表现就是"各种透明"。

   所以这里验三件事,缺一不可:
     ① 桌面(pointer:fine)任何情况下都不该瘦身
     ② 手机上 desired=true 时确实瘦身(否则下面那条会变成空断言)
     ③ 手机上 desired **直接**回落 false 后,必须自愈回全员 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript"};
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

const MOBILE_UA="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36";
async function probe(kind){
  const opts=kind==="mobile"
    ? {viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:MOBILE_UA}
    : {viewport:{width:1280,height:800},deviceScaleFactor:1};
  const ctx=await B.newContext(opts);
  try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
  const page=await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=8801`,{waitUntil:"load",timeout:60000});
  await page.waitForFunction("typeof AIBAPerf!=='undefined'&&typeof VISION!=='undefined'",{timeout:30000});
  const r=await page.evaluate(async()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    const coarse=matchMedia("(pointer:coarse)").matches;
    const boot=AIBAPerf.stats();
    /* 复现那条真实链路:desired 先置 true(enableVisionControl 的第一行),
       LOD 生效;再**直接**写回 false(catch 里的写法),不走 disableVisionControl。 */
    VISION.desired=true;AIBAPerf.applyForVision();
    const engaged=AIBAPerf.stats();
    VISION.desired=false;
    await w(2400);
    const healed=AIBAPerf.stats();
    return {coarse,boot:{thin:boot.thinned,hidden:boot.hidden,people:boot.people},
      engaged:{thin:engaged.thinned,hidden:engaged.hidden},
      healed:{thin:healed.thinned,hidden:healed.hidden},
      hasHeal:typeof AIBAPerf.startSelfHeal};
  });
  await ctx.close();
  return r;
}

const M=await probe("mobile"),D=await probe("desktop");
await B.close();server.close();

let bad=false;
const say=(ok,txt)=>{console.log((ok?"  PASS  ":"  FAIL  ")+txt);if(!ok)bad=true;};
console.log("手机 "+JSON.stringify(M)+"\n桌面 "+JSON.stringify(D)+"\n");

say(M.coarse===true,"手机上下文确实是 pointer:coarse(否则整份测试都是空跑)");
say(D.coarse===false,"桌面上下文是 pointer:fine");
say(M.hasHeal==="function","perf.js 带自愈入口 startSelfHeal");
say(M.boot.thin===false&&M.boot.hidden===0,"手机刚开局不瘦身(视觉模式没开)");
/* ② 必须先证明"能瘦身",否则 ③ 会变成永远成立的空断言 */
say(M.engaged.thin===true&&M.engaged.hidden>0,
  "手机 desired=true 时确实瘦身(藏了 "+M.engaged.hidden+" 个),这条不成立的话下一条就是空断言");
say(M.healed.thin===false&&M.healed.hidden===0,
  "desired 直接回落 false 后自愈回全员(实测 thin="+M.healed.thin+" hidden="+M.healed.hidden+")");
say(D.engaged.thin===false&&D.healed.hidden===0,"桌面全程不瘦身");

console.log("");
if(bad){console.log("❌ 验收不通过");process.exit(1);}
console.log("✅ 手机端近场观众 LOD 可逆");
process.exit(0);
