/* 下一代球员模型展示页（character-lab.html）截图。跑：node scripts/character-lab.shots.mjs [输出目录]
   SHOTS 环境变量可覆盖默认清单，格式 "star:pose:view:angle,..."。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.resolve(process.argv[2]||path.join(ROOT,"artifacts","character-lab"));
fs.mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{
  const c=decodeURIComponent(rq.url.split("?")[0]);
  if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}
  const f=path.join(ROOT,c==="/"?"/character-lab.html":c);
  fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}
    rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});
});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
let B=null;
for(const base of [import.meta.url,"/opt/homebrew/lib/node_modules/"].concat(
    (()=>{try{const n=path.join(process.env.HOME||"",".npm/_npx");
      return fs.readdirSync(n).map(d=>path.join(n,d,"node_modules")+"/");}catch(e){return [];}})())){
  for(const pkg of ["playwright","playwright-core"]){
    let m;try{m=createRequire(base)(pkg);}catch(e){continue;}
    try{B=await m.chromium.launch({args:["--mute-audio","--use-gl=angle","--use-angle=swiftshader"]});break;}catch(e){}
  }
  if(B)break;
}
if(!B){console.error("需要 Playwright");server.close();process.exit(2);}
const SHOTS=(process.env.SHOTS||"j23:stand:both:three-quarter,j23:stand:both:front,j23:stand:both:back,j23:stand:both:head,j23:release:next:side,j23:set:next:three-quarter,curry:hold:both:three-quarter,ionescu:stand:both:three-quarter").split(",");
const errs=[];
const ctx=await B.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
const page=await ctx.newPage();
page.on("pageerror",e=>errs.push(e.message));
page.on("console",m=>{if(m.type()==="error"||m.type()==="warning")errs.push("console: "+m.text());});
for(const spec of SHOTS){
  const [star,pose,view,angle]=spec.split(":");
  await page.goto(`http://127.0.0.1:${port}/character-lab.html?star=${star}&pose=${pose}&view=${view}&angle=${angle}&nohud=1`,{waitUntil:"load"});
  await page.waitForFunction("window.__lab&&window.__lab.next",{timeout:30000});
  await page.waitForTimeout(600);
  const name=`${star}-${pose}-${view}-${angle}.jpg`;
  await page.screenshot({path:path.join(OUT,name),type:"jpeg",quality:90});
  console.log("拍好",name);
}
console.log("报错",errs.length);errs.slice(0,10).forEach(e=>console.log("  "+e));
await B.close();server.close();
