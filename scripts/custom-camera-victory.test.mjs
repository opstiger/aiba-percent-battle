/* 自定义视角 + 胜利庆祝接地回归。
   验证两个视角槽位可拖动/保存/进入镜头循环，刷新后仍保留；同时把胜利庆祝
   强制从一个滞空根高度启动，检查真实鞋底仍回到地面。浏览器测试默认静音。 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"captures","custom-camera");
fs.mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf"};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      const clean=decodeURIComponent((req.url||"/").split("?")[0]);
      if(clean==="/favicon.ico"){res.writeHead(204);return res.end();}
      const file=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!file.startsWith(ROOT)){res.writeHead(403);return res.end("no");}
      fs.readFile(file,(err,buf)=>{
        if(err){res.writeHead(404);return res.end("404 "+clean);}
        res.writeHead(200,{"content-type":MIME[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(buf);
      });
    });
    server.listen(0,"127.0.0.1",()=>resolve({server,port:server.address().port}));
  });
}
function playwrightCandidates(){
  const out=[],seen=new Set(),push=base=>{
    for(const pkg of ["playwright","playwright-core"]){
      try{const mod=createRequire(base)(pkg);if(mod?.chromium&&!seen.has(mod)){seen.add(mod);out.push(mod);}}catch(e){}
    }
  };
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");return out;
}
async function launchBrowser(){
  const problems=[];
  for(const mod of playwrightCandidates()){
    try{return await mod.chromium.launch({headless:true});}catch(e){problems.push(e.message.split("\n")[0]);}
    try{return await mod.chromium.launch({channel:"chrome",headless:true});}catch(e){problems.push(e.message.split("\n")[0]);}
  }
  throw new Error("Playwright 起不来浏览器: "+problems.slice(0,3).join(" | "));
}

let failures=0;
const check=(ok,msg)=>{console.log(`${ok?"  PASS  ":"  FAIL  "}${msg}`);if(!ok)failures++;};
const {server,port}=await serve();
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:760,height:820},deviceScaleFactor:1});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=20260830&preview=custom-camera-regression`,{waitUntil:"load"});
  await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(response=>response.text()).then(code=>eval(code));});
  await page.waitForFunction("window.AIBA&&AIBA.runtime&&typeof startRound==='function'&&typeof AIBACameraBeginEdit==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  await page.waitForFunction("G.state==='round'",{timeout:30000});
  await page.waitForFunction("AIBA.runtime.service('rendering:camera')&&typeof AIBACamera==='object'",{timeout:10000});

  const beginEdit=async(slot)=>{
    await page.evaluate(index=>AIBACameraBeginEdit(index,false),slot);
    await page.waitForSelector("#customCameraEditor");
    await page.mouse.move(260,420);await page.mouse.down();await page.mouse.move(350,450,{steps:4});await page.mouse.up();
    return page.locator("#customCameraEditorReadout").innerText();
  };
  const firstReadout=await beginEdit(0);
  check(/水平/.test(firstReadout)&&!/水平 -180° · 俯仰 13° · 距离 4\.4/.test(firstReadout),"第一个视角可通过拖动改变水平/俯仰");
  await page.locator("#customCameraEditor .customCameraEditorActions .btn").nth(0).click();
  await page.waitForFunction("!document.querySelector('#customCameraEditor')",{timeout:5000});

  const secondReadout=await beginEdit(1);
  check(/水平/.test(secondReadout),"第二个视角槽位可独立调整");
  await page.locator("#customCameraEditor .customCameraEditorActions .btn").nth(0).click();
  await page.waitForFunction("!document.querySelector('#customCameraEditor')",{timeout:5000});
  const savedModes=await page.evaluate(()=>({slots:AIBACamera.slots.filter(Boolean).length,modes:AIBA.runtime.service("rendering:camera").availableCameraModes()}));
  check(savedModes.slots===2,"两个自定义视角均已保存");
  check(savedModes.modes.includes(3)&&savedModes.modes.includes(4),"两个自定义视角进入镜头可用列表");
  const cycle=await page.evaluate(()=>{CAM.mode=2;cycleCam();const a=CAM.mode;cycleCam();const b=CAM.mode;return [a,b];});
  check(cycle[0]===3&&cycle[1]===4,"镜头切换从转播视角依次经过自定义视角 1、2");
  await page.screenshot({path:path.join(OUT,"custom-camera-saved.png")});

  await page.reload({waitUntil:"load"});
  await page.waitForFunction("window.AIBA&&typeof AIBACamera==='object'&&typeof startRound==='function'",{timeout:20000});
  const afterReload=await page.evaluate(()=>AIBACamera.slots.filter(Boolean).length);
  check(afterReload===2,"刷新后两个视角仍被记住");

  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});
  await page.waitForFunction("G.state==='round'",{timeout:30000});
  await page.evaluate(()=>{
    // 模拟投篮过场把人物根节点留在空中，庆祝入口必须主动回到真实鞋底地面。
    P.jump=.38;player.g.position.y=.42;startVictoryCine({hero:player,dur:3.0,heroType:0});
  });
  await page.waitForFunction("G.state==='victorycine'",{timeout:5000});
  await page.waitForTimeout(620);
  const ground=await page.evaluate(()=>{
    player.g.updateMatrixWorld(true);
    const box=new THREE.Box3(),ys=player.footRoots.map(foot=>{box.setFromObject(foot);return box.min.y;});
    return {minY:Math.min(...ys),rootY:player.g.position.y,feet:ys};
  });
  check(ground.minY>=-.015,"胜利庆祝真实鞋底保持接地(minY="+ground.minY.toFixed(3)+"m)");
  check(ground.rootY<.15,"庆祝不再继承投篮滞空根高度(rootY="+ground.rootY.toFixed(3)+"m)");
  await page.screenshot({path:path.join(OUT,"victory-grounded.png")});
  check(!errors.length,"自定义视角/胜利庆祝回归无运行时错误"+(errors.length?": "+errors[0]:""));
  await page.close();
}finally{
  await browser.close();server.close();
}
console.log(failures?`\n${failures} 条失败`:`\n自定义视角与胜利庆祝接地回归通过`);
process.exit(failures?1:0);
