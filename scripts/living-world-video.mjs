import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=process.cwd(),stage='video';
const out=path.join(root,'artifacts/living-world-20260911',stage);fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'];
const cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))candidates.push(path.join(cache,d,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
assert(browser,'Playwright required');const errors=[],report={};
try{
 for(const sceneName of ['indoor','beachSunset','shonanCoast']){
  const ctx=await browser.newContext({viewport:{width:720,height:960},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:720,height:960}}});
  await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
  await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__flowFreeze)f(t);});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4195/index.html?intro=0&seed=20260910');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g);
  await page.evaluate(name=>{
   window.__flowFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset(name,{persist:false});
   player.g.visible=false;passer.g.visible=false;oppPasser.g.visible=false;
   for(const child of [...document.body.children])if(child!==renderer.domElement)child.style.display='none';
   document.body.appendChild(renderer.domElement);renderer.domElement.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:block';
   renderer.setPixelRatio(1);renderer.setSize(720,960);camera.fov=42;camera.aspect=720/960;camera.updateProjectionMatrix();
   let subject,base=0;
   if(name==='indoor'){
    subject=AIBACrowdLife.state.walkers[0].g;
   }else if(name==='beachSunset'){
    const p=streetCrowd.people.find(p=>p.life);p.life.phase=0;subject=p.g;streetCrowd.people.forEach(q=>q.g.visible=q===p);
   }else{
    const p=streetCrowd.people.find(p=>p.chat?.turn===0);subject=p.g;base=22-p.chat.phase;
   }
   const aim=()=>{const pos=subject.getWorldPosition(V3(0,0,0)),dir=name==='indoor'?V3(-pos.x,0,-pos.z).normalize():V3(.4,0,-1).applyQuaternion(subject.quaternion).normalize();camera.position.copy(pos).addScaledVector(dir,3.5);camera.position.y+=name==='indoor'?2:1.5;camera.lookAt(pos.clone().add(V3(0,1,0)));};
   const start=performance.now();window.__reviewTimer=setInterval(()=>{const t=(performance.now()-start)/1000;
    if(name==='indoor')AIBACrowdLife.update(t+7);else {streetCrowd.root.userData.clock=base+t-.033;updStreetCrowd(base+t,.033);}
    scene.updateMatrixWorld(true);aim();renderer.render(scene,camera);
   },1000/30);
  },sceneName);
  await page.waitForTimeout(6500);await page.evaluate(()=>clearInterval(window.__reviewTimer));
  const video=page.video();await page.close();await video.saveAs(path.join(out,sceneName+'.webm'));await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS muted environment video captures');
}finally{await browser.close();}
