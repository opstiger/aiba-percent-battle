import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=process.cwd(),stage='video';
const out=path.join(root,'artifacts/flow-player-20260910',stage);fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'];
const cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))candidates.push(path.join(cache,d,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
assert(browser,'Playwright required');const errors=[],report={};
try{
 for(const sceneName of ['flowerCourt','shonanCoast']){
  const ctx=await browser.newContext({viewport:{width:720,height:960},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:720,height:960}}});
  await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
  await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__flowFreeze)f(t);});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4193/index.html?intro=0&seed=20260910');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g);
  await page.evaluate(name=>{
   window.__flowFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset(name,{persist:false});
   player.g.visible=false;passer.g.visible=false;oppPasser.g.visible=false;
   for(const child of [...document.body.children])if(child!==renderer.domElement)child.style.display='none';
   document.body.appendChild(renderer.domElement);renderer.domElement.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:block';
   renderer.setPixelRatio(1);renderer.setSize(720,960);camera.fov=58;camera.aspect=720/960;camera.updateProjectionMatrix();camera.position.set(3.8,2.3,1.5);camera.lookAt(0,3,-9);
   let last=performance.now();window.__reviewTimer=setInterval(()=>{const now=performance.now();AIBAWorldPlaces.update(Math.min(.05,(now-last)/1000),0);last=now;renderer.render(scene,camera);},1000/30);
  },sceneName);
  await page.waitForTimeout(6500);await page.evaluate(()=>clearInterval(window.__reviewTimer));
  const video=page.video();await page.close();await video.saveAs(path.join(out,sceneName+'.webm'));await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS muted environment video captures');
}finally{await browser.close();}
