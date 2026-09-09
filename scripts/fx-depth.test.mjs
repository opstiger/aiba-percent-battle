/* 后期渲染目标的深度缓冲验收。跑:node scripts/fx-depth.test.mjs
   非零退出码 = 验收不通过。

   背景(只在触屏设备上翻车):
     grade.js 的 FX_MODE = COARSE ? "lite" : "full",也就是**所有触屏设备**都走 lite。
     而 lite 档建 rtScene 时把同一个开关同时接到了 depthBuffer 上:
       rtScene=makeRT(w,h,LITE?false:true)   →   depthBuffer:false
     整个 3D 场景于是被画进一个**没有 Z-buffer** 的渲染目标 —— 没有深度就没有遮挡判定,
     观众躯干被座椅盖掉、架上的球被箱体盖掉、球员的腿被地板盖掉,
     表现出来正是用户报的"各种透明、球不见了",而桌面走 full 档一切正常。
     那个 flag 的本意只是"要不要深度**贴图**做景深",两件事必须分开。

   断言顺序有讲究:先证明手机上下文确实走 lite 档,否则"lite 档有深度"会退化成空断言。 */
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
  await page.waitForFunction("typeof AIBAGrade!=='undefined'&&typeof renderer!=='undefined'",{timeout:30000});
  /* rtInfo 要等 ensureTargets 跑过一次才有值,先逼一帧真实渲染 */
  await page.evaluate(()=>{renderer.render(scene,camera);});
  const r=await page.evaluate(()=>({
    coarse:matchMedia("(pointer:coarse)").matches,
    mode:AIBAGrade.mode,active:AIBAGrade.isActive(),
    rt:AIBAGrade.rtInfo?AIBAGrade.rtInfo():"no-rtInfo"
  }));
  await ctx.close();
  return r;
}

const M=await probe("mobile"),D=await probe("desktop");
await B.close();server.close();

let bad=false;
const say=(ok,txt)=>{console.log((ok?"  PASS  ":"  FAIL  ")+txt);if(!ok)bad=true;};
console.log("手机 "+JSON.stringify(M)+"\n桌面 "+JSON.stringify(D)+"\n");

say(M.coarse===true,"手机上下文确实是 pointer:coarse(不成立则整份测试空跑)");
say(M.mode==="lite","手机确实走 lite 档(不成立则下面那条是空断言)");
say(D.mode==="full","桌面走 full 档");
say(!!M.rt&&M.rt!=="no-rtInfo","拿得到 rtInfo");
say(!!M.rt&&M.rt.depthBuffer===true,
  "【关键】手机 lite 档的场景 RT 必须有 Z-buffer(实测 depthBuffer="+(M.rt&&M.rt.depthBuffer)+")");
say(!!D.rt&&D.rt.depthBuffer===true,"桌面 full 档也有 Z-buffer");
say(!!M.rt&&M.rt.depthTexture===false,"lite 档不该浪费一张深度贴图(景深本就关着)");
say(!!D.rt&&D.rt.depthTexture===true,"full 档要有深度贴图给景深用");

console.log("");
if(bad){console.log("❌ 验收不通过");process.exit(1);}
console.log("✅ 两档的场景渲染目标都有深度缓冲");
process.exit(0);
