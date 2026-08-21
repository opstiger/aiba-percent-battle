/* 首屏开场运镜的取景检查台。跑:node scripts/boot-shot.frames.mjs [--out captures/cine]
   在固定时刻各拍一帧,用来判断"空镜好不好看 / 人物什么时候入画 / 过肩位准不准"。
   必须无头浏览器:预览标签切后台就冻结 rAF,运镜根本不走。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const OUT=path.resolve(ROOT,(args.indexOf("--out")>=0?args[args.indexOf("--out")+1]:"captures/cine"));
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch();break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}
fs.mkdirSync(OUT,{recursive:true});
const page=await browser.newPage({viewport:{width:420,height:860},deviceScaleFactor:2});
const errs=[];page.on("pageerror",e=>errs.push(e.message));
/* 关键:必须用 commit 而不是 load。等到 load 再开始盯,运镜早就走完了(实测偏 2.4s)。
   raf 轮询保证在开场后一两帧内就抓到。 */
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1`,{waitUntil:"commit"});
await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:20000,polling:"raf"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
/* 采样点覆盖:空镜 -> 人物起步 -> 入画 -> 就位 -> 镜头落定 */
const MARKS=[0.15,0.7,1.3,1.70,1.95,2.20,2.50,2.85,3.30,3.80,4.40];
for(const at of MARKS){
  /* 按运镜自己的时间等,不用墙钟:页面启动快慢有一秒级抖动,
     用墙钟会整体漂掉(实测漏拍过开头两帧空镜)。 */
  try{
    await page.waitForFunction(`AIBABootShot.state().t>=${at}`,{timeout:15000,polling:"raf"});
  }catch(e){}
  const info=await page.evaluate(()=>{
    const st=AIBABootShot.state();
    const g=AIBA.runtime.service("legacy");
    const cam=AIBA.runtime.service("rendering:core").camera;
    /* 人物在画面里的横向位置(百分比),用来判断"入画了没有" */
    /* 取胸口高度(1.15m)而不是脚下:低机位仰拍时脚会掉出画面下缘,
       用脚判断会把明明看得见的人报成"画面外"。
       v.z>1 = 点在相机背后,这时 v.x 会翻转成 ±几十的假值,必须单独挡掉。 */
    const v=new THREE.Vector3(g.P.pos.x,1.15,g.P.pos.z).project(cam);
    const behind=v.z>1;
    return {phase:st.phase,运镜秒:+st.t.toFixed(2),fov:+cam.fov.toFixed(1),
      cam:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)],
      人物:[+g.P.pos.x.toFixed(2),+g.P.pos.z.toFixed(2)],
      离机位:+Math.hypot(g.P.pos.x-cam.position.x,g.P.pos.z-cam.position.z).toFixed(2),
      屏幕x:behind?null:+((v.x*0.5+0.5)*100).toFixed(0),
      屏幕y:behind?null:+((-v.y*0.5+0.5)*100).toFixed(0),
      /* 开场那一秒模型是主动藏起来的。只报投影位置会写成"在画面内",
         但画面上根本没人 —— 必须把可见性一起报出来,否则日志在骗自己。 */
      渲染中:!!(g.player&&g.player.g&&g.player.g.visible),
      球在手:!!(g.pBall&&g.pBall.visible), 可投:!!g.G.canShoot,
      位置:behind?"相机背后":(Math.abs(v.x)<=1&&Math.abs(v.y)<=1?"在画面内":"出框")};
  });
  const name=`cine-${String(at.toFixed(2)).replace(".","_")}s.png`;
  await page.screenshot({path:path.join(OUT,name)});
  const scr=info.屏幕x==null?"      —":`x${String(info.屏幕x).padStart(4)}% y${String(info.屏幕y).padStart(4)}%`;
  console.log(`${String(info.运镜秒).padStart(5)}s ${info.phase.padEnd(7)} fov${String(info.fov).padStart(4)}  机位(${info.cam.join(",")})  人物(${info.人物.join(",")}) 离机位${String(info.离机位).padStart(5)}m  ${scr}  ${info.渲染中?info.位置:"未显形(空镜)"}${info.球在手?" 持球":""}${info.可投?" 可投":""}`);
}
console.log(errs.length?"报错: "+errs[0]:"零报错");
console.log("输出 "+path.relative(ROOT,OUT)+"/");
await browser.close();server.close();
