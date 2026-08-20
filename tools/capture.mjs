/* 固定机位 / 固定取景 / 固定视口的自动截图台。
   跑:  node tools/capture.mjs            # 拍全套
        node tools/capture.mjs --filter 连帽衫
        node tools/capture.mjs --bench     # 顺带测每张的单帧耗时
        node tools/capture.mjs --out captures/before

   为什么要有它:改装备外观时,以前只能进游戏、打开更衣室、手动改 CSS 把试衣镜放大,
   一件一件看,还看不到侧面背面;而且预览标签页一旦切到后台,rAF 就冻结,截出来是全黑。
   这里用 Playwright 起无头 Chromium,视口、机位、取景、背景全部写死,
   所以两次运行之间任何像素差异都只可能来自代码改动本身。

   依赖:Playwright(已全局安装)。缺了会给出明确提示,不会静默失败。 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const opt=(name,def)=>{const i=args.indexOf(name);return i>=0?args[i+1]:def;};
const has=name=>args.includes(name);

const OUT=path.resolve(ROOT,opt("--out","captures"));
const FILTER=opt("--filter","");
const BENCH=has("--bench");
const WIDTH=+opt("--width","900"),HEIGHT=+opt("--height","1100");

/* ---------- 找 Playwright ---------- */
/* Playwright 是 CJS 包,必须用 createRequire 拿,不能 import() ——
   动态 import 一个 CJS 文件只会拿到 ESM 包装层,chromium 是 undefined。踩过。
   本项目没有 package.json,所以要挨个试全局/npx 缓存里的安装位置。 */
function playwrightCandidates(){
  const out=[],seen=new Set();
  const push=base=>{
    for(const pkg of ["playwright","playwright-core"]){
      try{
        const mod=createRequire(base)(pkg);
        if(mod&&mod.chromium&&!seen.has(mod)){seen.add(mod);out.push(mod);}
      }catch(e){}
    }
  };
  push(import.meta.url);
  push("/opt/homebrew/lib/node_modules/");
  push("/usr/local/lib/node_modules/");
  try{  // npx 缓存目录名是哈希,扫一层
    const npx=path.join(process.env.HOME||"","/.npm/_npx");
    for(const dir of fs.readdirSync(npx))push(path.join(npx,dir,"node_modules")+"/");
  }catch(e){}
  return out;
}
/* 光找到包不够:全局那份 playwright 可能比本地下载的 Chromium 新,
   launch() 会报 "Executable doesn't exist"。所以挨个真的启一次,
   谁能起来就用谁;都不行再退回系统装的 Chrome。 */
async function launchBrowser(){
  const mods=playwrightCandidates();
  const problems=[];
  for(const mod of mods){
    try{return {browser:await mod.chromium.launch(),how:"playwright 自带 chromium"};}
    catch(e){problems.push(e.message.split("\n")[0]);}
    try{return {browser:await mod.chromium.launch({channel:"chrome"}),how:"系统 Chrome"};}
    catch(e){problems.push(e.message.split("\n")[0]);}
  }
  console.error("Playwright 起不来浏览器:");
  problems.slice(0,3).forEach(p=>console.error("  · "+p));
  console.error("修:  npx playwright install chromium");
  process.exit(2);
}

/* ---------- 自带静态服务器,不依赖外面先起好 ---------- */
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",
  ".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",
  ".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};
function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      const clean=decodeURIComponent(req.url.split("?")[0]);
      /* 浏览器会自动要一次 favicon.ico,项目里没有这个文件。
         与其在报错里滤掉(console 消息不带 URL,滤不准),不如直接回个 204。 */
      if(clean==="/favicon.ico"){res.writeHead(204);return res.end();}
      const file=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!file.startsWith(ROOT)){res.writeHead(403);return res.end("no");}
      fs.readFile(file,(err,buf)=>{
        if(err){res.writeHead(404);return res.end("404 "+clean);}
        res.writeHead(200,{"content-type":MIME[path.extname(file)]||"application/octet-stream",
          "cache-control":"no-store"});
        res.end(buf);
      });
    });
    server.listen(0,"127.0.0.1",()=>resolve({server,port:server.address().port}));
  });
}

/* ---------- 拍摄清单 ----------
   命名规则 <类别>-<条目>-<机位>,排序后同一件装备的几个机位会挨在一起,
   方便直接用图片查看器左右翻着比。 */
const BAND=[["无","" ],["冷静金","band-gold"],["专注青","band-focus"],["铁人绿","band-iron"],
  ["闪电黄","band-volt"],["黑面具","head-mask"],["棒球帽","head-cap"],["太阳镜","head-shades"],
  ["连帽衫","head-hoodie"],["奇葩头套","head-weird"]];
const SHOES=[["疾风橙","shoes-blaze"],["稳踏青","shoes-anchor"],["长跑灰","shoes-marathon"],["回弹紫","shoes-spring"]];
const SLEEVE=[["稳定白","sleeve-steady"],["冷血黑","sleeve-ice"],["快弹红","sleeve-snap"],["节能蓝","sleeve-saver"]];

function shots(){
  const list=[];
  const base="viewer.html?nohud=1&bg=neutral";
  for(const [name,id] of BAND)
    for(const angle of ["front","three-quarter","side"])
      list.push({name:`头部-${name}-${angle}`,
        url:`${base}&focus=head&angle=${angle}${id?`&band=${id}`:""}`});
  for(const [name,id] of BAND)
    if(id==="head-hoodie"||id==="head-weird"||id==="head-cap")
      list.push({name:`头部-${name}-全身`,url:`${base}&focus=full&angle=three-quarter&band=${id}`});
  for(const [name,id] of SHOES)
    list.push({name:`球鞋-${name}-feet`,url:`${base}&focus=feet&angle=three-quarter&shoes=${id}`});
  for(const [name,id] of SLEEVE)
    list.push({name:`护腕-${name}-torso`,url:`${base}&focus=torso&angle=three-quarter&sleeve=${id}`});
  list.push({name:`全身-裸装-front`,url:`${base}&focus=full&angle=front`});
  list.push({name:`全身-裸装-back`,url:`${base}&focus=full&angle=back`});
  return FILTER?list.filter(s=>s.name.includes(FILTER)):list;
}

/* ---------- 跑 ---------- */
const {browser,how}=await launchBrowser();
const {server,port}=await serve();
fs.mkdirSync(OUT,{recursive:true});
const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:2});
const errors=[];
/* 浏览器每个 origin 会自动请求一次 favicon.ico,项目里没有这个文件,
   于是第一张图必定带一条 404。它不是项目的错,滤掉,否则"零报错"这个信号就废了。 */
const IGNORE=/favicon\.ico/;
const note=msg=>{if(!IGNORE.test(msg))errors.push(msg);};
page.on("pageerror",e=>note(e.message));
page.on("console",m=>{if(m.type()==="error")note("console: "+m.text().slice(0,160));});
page.on("requestfailed",r=>note("请求失败: "+r.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//,"")));
page.on("response",r=>{if(r.status()>=400)note("HTTP "+r.status()+": "+r.url().replace(/^http:\/\/127\.0\.0\.1:\d+\//,""));});

const list=shots();
const report=[];
console.log(`拍 ${list.length} 张 · 视口 ${WIDTH}×${HEIGHT}@2x · ${how} · 输出 ${path.relative(ROOT,OUT)}/`);
for(const shot of list){
  const before=errors.length;
  await page.goto(`http://127.0.0.1:${port}/${shot.url}`,{waitUntil:"load"});
  await page.waitForFunction("window.__viewerReady===true",{timeout:15000});
  await page.evaluate("window.__viewerDraw&&window.__viewerDraw()");
  const file=path.join(OUT,shot.name+".png");
  await page.screenshot({path:file});
  let bench=null;
  if(BENCH)bench=await page.evaluate("window.__viewerBench(45)");
  const err=errors.length-before;
  report.push({name:shot.name,url:shot.url,bench,errors:err,
    messages:err?errors.slice(before,before+err):undefined});
  console.log(` ${err?"⚠":"·"} ${shot.name}${bench?`  ${bench.medianMs}ms  ${bench.calls} calls  ${bench.triangles} tri`:""}`);
}
await browser.close();
server.close();

fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify({
  at:new Date().toISOString(),viewport:[WIDTH,HEIGHT],shots:report},null,2));

const bad=report.filter(r=>r.errors);
if(BENCH){
  const worst=report.filter(r=>r.bench).sort((a,b)=>b.bench.calls-a.bench.calls)[0];
  if(worst)console.log(`\n开销最大的一张:${worst.name} · ${worst.bench.calls} draw calls · ${worst.bench.triangles} 三角面 · ${worst.bench.medianMs}ms/帧`);
}
console.log(bad.length?`\n${bad.length} 张有报错:${bad.map(b=>b.name).join(", ")}`:`\n${report.length} 张全部拍完,零报错`);
process.exit(bad.length?1:0);
