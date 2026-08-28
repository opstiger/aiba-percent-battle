/* 结果留白的契约测试。跑:node scripts/result-beat.test.mjs

   留白只是演出,但它夹在"结果出来"和"弹结算面板"之间 —— 演出出任何岔子,
   玩家就会停在一个没有 HUD、也没有面板的中间态,只能刷新页面。
   所以这里守的不是"好不好看",是"会不会把人卡住":
     · onDone 必须恰好执行一次
     · 重入(上一段没收尾又来一段)不能丢掉任何一个 onDone
     · 随时可跳过
     · 留白期间镜头还在场上,不能甩回菜单环绕 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const o=[],seen=new Set();const p=b=>{for(const n of["playwright","playwright-core"]){try{const m=createRequire(b)(n);if(m&&m.chromium&&!seen.has(m)){seen.add(m);o.push(m);}}catch(e){}}};p(import.meta.url);p("/opt/homebrew/lib/node_modules/");p("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))p(path.join(n,d,"node_modules")+"/");}catch(e){}return o;}
let br;for(const m of mods()){try{br=await br||await m.chromium.launch();break;}catch(e){}}
if(!br){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}
let fail=0;const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)fail++;};
const page=await br.newPage({viewport:{width:420,height:860}});
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`,{waitUntil:"load"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
await page.waitForFunction("window.AIBAResultBeat&&typeof G!=='undefined'",{timeout:20000});

console.log("① onDone 恰好一次,且真的等满了时间");
{
  const r=await page.evaluate(async()=>{
    let n=0,at=0;const t0=Date.now();
    AIBAResultBeat.play({eyebrow:"测试",score:42,unit:"分",seconds:1.0,onDone:()=>{n++;at=Date.now()-t0;}});
    const during=AIBAResultBeat.active();
    await new Promise(r=>setTimeout(r,2200));
    return {n,at,during};
  });
  check(r.during===true,"play 之后处于留白中");
  check(r.n===1,"onDone 恰好执行 1 次(实际 "+r.n+")");
  check(r.at>=900&&r.at<=1600,"确实等了约 1 秒才进结算(实际 "+r.at+"ms)");
}

console.log("\n② 重入不丢 onDone");
{
  const r=await page.evaluate(async()=>{
    const fired=[];
    AIBAResultBeat.play({score:1,seconds:5,onDone:()=>fired.push("A")});
    await new Promise(r=>setTimeout(r,120));
    AIBAResultBeat.play({score:2,seconds:1,onDone:()=>fired.push("B")});
    await new Promise(r=>setTimeout(r,2000));
    return fired;
  });
  check(r.length===2&&r[0]==="A"&&r[1]==="B",
    "两段的 onDone 都执行了且不重复(实际 "+JSON.stringify(r)+")");
}

console.log("\n③ 随时可跳过");
{
  const r=await page.evaluate(async()=>{
    let n=0;const t0=Date.now();let at=0;
    AIBAResultBeat.play({score:7,seconds:6,onDone:()=>{n++;at=Date.now()-t0;}});
    await new Promise(r=>setTimeout(r,200));
    dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    return {n,at,still:AIBAResultBeat.active()};
  });
  check(r.n===1&&r.at<900,"点一下立刻收尾并进结算("+r.at+"ms)");
  check(r.still===false,"跳过后不再处于留白中");
}

console.log("\n④ 留白期间镜头留在场上");
{
  const r=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    const cam=AIBA.runtime.service("rendering:core").camera;
    startPractice();
    for(let i=0;i<160;i++){if(g.G.canShoot)break;await new Promise(r=>setTimeout(r,50));}
    const before=cam.position.clone();
    g.G.state="resultbeat";
    await new Promise(r=>setTimeout(r,700));
    const during=cam.position.clone();
    // 菜单环绕机位在 y=8 上下绕大圈;比赛机位远低于它
    return {beforeY:+before.y.toFixed(2),duringY:+during.y.toFixed(2),
            moved:+before.distanceTo(during).toFixed(2)};
  });
  check(r.duringY<5,"resultbeat 期间机位没有甩到菜单环绕高度(y="+r.duringY+")");
  check(r.moved<6,"机位没有瞬移("+r.moved+"m)");
}

check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
await br.close();server.close();
console.log(fail?`\n${fail} 条失败`:"\n结果留白验证通过");
process.exit(fail?1:0);
