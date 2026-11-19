/* Validates the actual camera owner's depth-of-field state on desktop and touch.
   Run with node scripts/fx-depth.test.mjs. Pass AIBA_CHROMIUM for an alternate executable. */
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
    try{B=await m.chromium.launch({executablePath:process.env.AIBA_CHROMIUM||undefined,
      args:["--mute-audio","--enable-unsafe-swiftshader","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break;}catch(e){}
  }
  if(B)break;
}
if(!B){console.error("需要 Playwright: npx playwright install chromium");server.close();process.exit(2);}

const MOBILE_UA="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36";
async function probe(kind){
  const mobile=kind==="mobile";
  const opts=mobile
    ? {viewport:{width:390,height:760},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:MOBILE_UA}
    : {viewport:{width:960,height:640},deviceScaleFactor:1};
  const ctx=await B.newContext(opts);
  try{
    await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});
    const page=await ctx.newPage();
    const origin=`http://127.0.0.1:${port}`;
    await page.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&seed=8801`,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForFunction(()=>typeof AIBAGrade!=="undefined"&&typeof startPractice==="function"&&player?.g,null,{timeout:30000});
    await page.evaluate(()=>{
      unlockBoot();applyScenePreset("indoor",{persist:false});startPractice();
    });
    await page.waitForFunction(()=>G.state==="round"&&!G.glideCam,null,{timeout:45000});
    const capture=async (preset,mode,state)=>{
      await page.evaluate(({preset,mode,state})=>{
        if(preset)applyScenePreset(preset,{persist:false});
        G.state=state;G.glideCam=null;CAM.mode=mode;applyCamMode();
      },{preset,mode,state});
      await page.waitForFunction(enabled=>camera.userData.firstPerson===enabled&&!!AIBAGrade.focusInfo()===enabled,
        state==="round"&&mode===0,{timeout:20000});
      return page.evaluate(()=>({focus:AIBAGrade.focusInfo(),rt:AIBAGrade.rtInfo(),
        rimDistance:camera.position.distanceTo(HOOP),firstPerson:camera.userData.firstPerson}));
    };
    const indoor=await capture(null,0,"round");
    const meadow=await capture("flowerCourt",0,"round");
    await page.evaluate(()=>setCameraMode(CAM_MEADOW_LOW,{silent:true}));
    await page.waitForFunction(()=>AIBAGrade.focusInfo()?.foreground===true,null,{timeout:20000});
    const low=await page.evaluate(()=>({
      firstPerson:camera.userData.firstPerson,focus:AIBAGrade.focusInfo(),height:camera.position.y,
      subjectDistance:camera.position.distanceTo(player.g.position)
    }));
    const meadowThird=await capture(null,1,"round");
    await page.evaluate(()=>{
      applyScenePreset("rainforest",{persist:false});setCameraMode(1,{silent:true});
    });
    await page.waitForFunction(()=>AIBAGrade.focusInfo()?.foreground&&
      environmentRoot.userData.placeState?.rainforest?.fallback.visible===false,null,{timeout:20000});
    const rainforest=await page.evaluate(()=>({
      firstPerson:camera.userData.firstPerson,focus:AIBAGrade.focusInfo()
    }));
    await page.evaluate(()=>setCameraMode(0,{silent:true}));
    await page.waitForFunction(()=>camera.userData.firstPerson&&AIBAGrade.focusInfo()?.foreground,null,{timeout:20000});
    const forestFirst=await page.evaluate(()=>AIBAGrade.focusInfo());
    const lunar=await capture("lunarCrater",0,"round");
    const third=await capture(null,1,"round");
    const cinematic=await capture(null,0,"pregame");
    return {coarse:await page.evaluate(()=>matchMedia("(pointer:coarse)").matches),indoor,meadow,meadowThird,low,rainforest,forestFirst,lunar,third,cinematic};
  }finally{await ctx.close();}
}

try{
  for(const kind of ["desktop","mobile"]){
    const result=await probe(kind);
    console.log(kind,JSON.stringify(result));
    if(result.coarse!==(kind==="mobile"))throw Error("Incorrect input profile");
    for(const venue of ["indoor","meadow","lunar"]){
      const shot=result[venue];
      if(!shot.focus||!shot.rt?.depthBuffer||!shot.rt.depthTexture||shot.focus.near<shot.rimDistance)
        throw Error(`${kind} ${venue} did not preserve a sharp court and a depth-aware lens`);
    }
    if(result.meadow.focus.strength<=result.indoor.focus.strength)throw Error("Meadow focus should be stronger than the indoor look");
    if(result.third.focus||result.meadowThird.focus||result.cinematic.focus)throw Error("Focus leaked into a standard third-person or cinematic camera");
    if(result.low.firstPerson||!result.low.focus?.foreground||result.low.focus.far>=result.low.subjectDistance)
      throw Error("The meadow's low camera must soften only the foreground, preserving the player and hoop");
    const forest=result.rainforest.focus;
    if(result.rainforest.firstPerson||!forest?.foreground||forest.near<.2||forest.far>=3||
        forest.near!==result.forestFirst.near||forest.far!==result.forestFirst.far)
      throw Error("The rainforest lens must use the same depth range across cameras");
  }
}finally{
  await B.close();
  server.close();
}
