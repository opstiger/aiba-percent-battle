/* 验证"同种子 = 同结果"。跑:node scripts/rng-determinism.test.mjs
   为什么必须用无头浏览器跑:预览标签页一旦切到后台,requestAnimationFrame 就冻结,
   开场演出走不完、永远进不到可投篮状态(实测 1.5 秒只推进 0.08 秒)。
   Playwright 的页面不受这个影响。

   测法:进到投篮机的可投状态后,直接写 G.power 再 doRelease() ——
   力度完全受控,两轮之间唯一的变量就是随机数本身。
   力度故意取甜区边缘(±6/±9/±12),让 r 真正参与 swish/rattle/bank/miss 的分支;
   全打甜区正中会恒定 swish,那样测不出任何东西。 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",
  ".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",
  ".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};
function serve(){
  return new Promise(resolve=>{
    const s=http.createServer((req,res)=>{
      const clean=decodeURIComponent(req.url.split("?")[0]);
      if(clean==="/favicon.ico"){res.writeHead(204);return res.end();}
      const file=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!file.startsWith(ROOT)){res.writeHead(403);return res.end();}
      fs.readFile(file,(e,buf)=>{
        if(e){res.writeHead(404);return res.end();}
        res.writeHead(200,{"content-type":MIME[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
        res.end(buf);
      });
    });
    s.listen(0,"127.0.0.1",()=>resolve({s,port:s.address().port}));
  });
}
function candidates(){
  const out=[],seen=new Set();
  const push=base=>{for(const p of ["playwright","playwright-core"]){
    try{const m=createRequire(base)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");
  try{const n=path.join(process.env.HOME||"","/.npm/_npx");
    for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}
  return out;
}
async function launch(){
  for(const m of candidates()){
    try{return await m.chromium.launch();}catch(e){}
    try{return await m.chromium.launch({channel:"chrome"});}catch(e){}
  }
  console.error("跑不了:装 Playwright  npm i -g playwright && npx playwright install chromium");
  process.exit(2);
}

const {s:server,port}=await serve();
const browser=await launch();
const page=await browser.newPage({viewport:{width:900,height:1000}});
const errs=[];
page.on("pageerror",e=>errs.push(e.message));

await page.goto(`http://127.0.0.1:${port}/index.html?seed=2024`,{waitUntil:"load"});
await page.evaluate(async()=>{
  await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);   // 非音频测试一律静音
  const bl=document.getElementById("bootLoad");if(bl)bl.style.display="none";
  dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}));
});
await page.waitForTimeout(600);

/* 走真实入口进投篮机(goDiff+pickDiff),再把开场演出点过去 */
await page.evaluate(()=>{goDiff("rackrush");});
await page.waitForTimeout(400);
await page.evaluate(()=>{pickDiff("normal");});
for(let i=0;i<30;i++){
  const ready=await page.evaluate(()=>G.state==="rackrush"&&G.canShoot);
  if(ready)break;
  await page.evaluate(()=>{
    const b=[...document.querySelectorAll("button")].filter(x=>x.offsetParent)
      .find(x=>/LEVEL RUN|Skip|跳过|开打|START|GO|开始/i.test(x.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(500);
}
const ready=await page.evaluate(()=>G.state==="rackrush"&&G.canShoot);
if(!ready){
  const st=await page.evaluate(()=>({state:G.state,canShoot:G.canShoot}));
  console.error("进不到可投状态:",JSON.stringify(st));
  await browser.close();server.close();process.exit(1);
}

/* 球不是同步生成的:releaseShot 里走 afterPlayerLands(...),
   要等球员落地才真正把球放出来。所以每投一球都得轮询等它出现。 */
const probe=seed=>page.evaluate(async seedVal=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  AIBARandom.reseed(seedVal);
  /* 精力必须一起复位:playerSweetZone() 里乘了 fatigueFactor(),
     上一轮投完 8 球精力掉了,下一轮甜区就变窄,结果自然对不上 ——
     那不是随机数不确定,是游戏状态带过来的。要测随机数就得把状态钉死。 */
  if(window.AIBAGear&&AIBAGear._setStamina)AIBAGear._setStamina(999);
  G.streak=0;G.missRun=0;
  const ideal=weatherAdjustedIdeal(G.shot,true);
  const out=[];
  for(const d of [0,6,-6,9,-9,12,3,-3]){
    const n0=balls.length;
    G.charging=true;G.canShoot=true;
    G.power=ideal+d;
    doRelease();
    let b=null;
    for(let i=0;i<40&&!b;i++){await sleep(50);if(balls.length>n0)b=balls[balls.length-1];}
    out.push(b?b.outcome:"无球");
    while(balls.length>n0){const x=balls.pop();scene.remove(x.mesh);scene.remove(x.blob);}
    G.canShoot=true;G.charging=false;
    await sleep(60);
  }
  return out;
},seed);

// 先看清楚为什么投不出球
const diag=await page.evaluate(()=>({
  state:G.state,canShoot:G.canShoot,charging:G.charging,
  curShot:typeof curShot==="function"?(curShot()?"有":"null"):"没有 curShot",
  shotIdx:G.shotIdx,seqLen:G.seq?G.seq.length:"无 seq",
  ballsBefore:balls.length
}));
console.log("诊断:",JSON.stringify(diag));

const a=await probe(2024),b=await probe(2024),c=await probe(9999);
await browser.close();server.close();

let fail=0;
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)fail++;};
console.log("种子 2024 第一遍:",a.join(","));
console.log("种子 2024 第二遍:",b.join(","));
console.log("种子 9999      :",c.join(","));

check(!a.every(x=>x==="无球"),"真的投出了球(全是无球说明这次测试无效)");
check(JSON.stringify(a)===JSON.stringify(b),"同种子 + 同力度 -> 结果逐球一致");
check(JSON.stringify(a)!==JSON.stringify(c),"换种子结果不同(说明随机数真的参与了判定)");
check(new Set(a).size>1,"结果里有多种落点(力度确实打到了随机分支上)");
check(!errs.length,"运行期零报错"+(errs.length?": "+errs[0]:""));

console.log(fail?`\n${fail} 条失败`:"\n可复现性验证通过");
process.exit(fail?1:0);
