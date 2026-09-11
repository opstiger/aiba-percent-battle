import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=process.cwd(),stage=process.env.AIBA_STAGE||'after';
const out=path.join(root,'artifacts/flow-player-20260910',stage);fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'];
const cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))candidates.push(path.join(cache,d,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
assert(browser,'Playwright required');const errors=[],report={};
try{
 const ctx=await browser.newContext({viewport:{width:1000,height:1000}});
 await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{
  let seed=917;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__flowFreeze)f(t);});
  const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 const save=async name=>{const png=await page.evaluate(()=>renderer.domElement.toDataURL());fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png.split(',')[1],'base64'));};
 const base=process.env.AIBA_QA_URL||'http://127.0.0.1:4193';
 await page.goto(base+'/viewer.html?nohud=1&bg=neutral');await page.waitForFunction(()=>window.__viewerReady);
 await page.evaluate(()=>{window.__flowFreeze=true;const {guy,root,camera}=__viewerModel();root.rotation.y=.45;renderer.render(scene,camera);});await save('player');
 for(const hair of ['short','fade','afro','cornrows','bun','ponytail','flattop','buzz']){
  await page.evaluate(hair=>{const {guy,root,camera}=__viewerModel();setHair(guy,hair,0x493522);root.rotation.y=.45;camera.position.set(0,1.7,1.1);camera.lookAt(0,1.69,0);renderer.render(scene,camera);},hair);await save('hair-'+hair);
 }
 if(stage==='after')for(const id of ['shoes-anchor','shoes-blaze','shoes-marathon','shoes-spring']){
  await page.evaluate(id=>{const {guy,root,camera}=__viewerModel();AIBAEquipmentVisuals.applyShoes(guy,{id,color:'#467989'});root.rotation.y=.65;camera.position.set(0,.46,1.4);camera.lookAt(0,.17,0);renderer.render(scene,camera);},id);await save(id);
 }
 await page.goto(base+'/index.html?intro=0&seed=20260910');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g);
 await page.evaluate(()=>{window.__flowFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();});
 report.rig=await page.evaluate(()=>Object.fromEntries(['arms','elbows','handRoots','ballGrips','legs','knees','ankles','footRoots','toeRoots'].map(k=>[k,player[k].map(n=>n.position.toArray())])));
 for(const sceneName of ['flowerCourt','shonanCoast']){
  await page.evaluate(n=>applyScenePreset(n,{persist:false}),sceneName);
  for(const t of [0,.25,.5,1]){
   await page.evaluate(t=>{const s=environmentRoot.userData.placeState;s.time=t;AIBAWorldPlaces.update(0,0);player.g.visible=false;camera.fov=58;camera.aspect=1;camera.updateProjectionMatrix();camera.position.set(3.8,2.3,1.5);camera.lookAt(0,3,-9);renderer.render(scene,camera);},t);await save(sceneName+'-'+t);
  }
  report[sceneName]=await page.evaluate(()=>{const s=environmentRoot.userData.placeState,wire=s.root.getObjectByName('shonanCables');return{water:s.waterfall?.length,cables:wire?.userData,calls:renderer.info.render.calls};});
 }
 if(stage==='after'){
  await page.evaluate(()=>{applyScenePreset('indoor',{persist:false});player.g.visible=true;passer.g.visible=false;oppPasser.g.visible=false;player.g.position.set(0,0,0);player.g.scale.set(1,1,1);player.g.rotation.set(0,.42,0);dressGuy(player,0x263e52,0xc5a86c,'24');setHair(player,'fade',0x36261e);player.headband.visible=false;player.sleeves.forEach(s=>s.visible=false);player.wrists.forEach(s=>s.visible=false);camera.fov=32;camera.position.set(1.3,1.5,3.5);camera.lookAt(0,.95,0);camera.updateProjectionMatrix();});
  for(const [name,c] of [['stand',{dip:0,lift:0,jmp:0,over:0}],['load',{dip:1,lift:.5,jmp:0,over:0}],['set',{dip:.2,lift:1,jmp:.2,over:0}],['release',{dip:0,lift:1,jmp:1,over:1}]]){
   await page.evaluate(c=>{poseGuy(player,c,0,1);renderer.render(scene,camera);},c);await save('game-'+name);
  }
  report.hairRoots=await page.evaluate(()=>{
   const results={};for(const style of ['buzz','short','fade','afro','cornrows','bun','ponytail','flattop']){
    setHair(player,style,0x493522);player.hairPivot.rotation.set(0,0,0);player.g.updateMatrixWorld(true);
    const root=player.hairBase.children[0],before=root.getWorldPosition(new THREE.Vector3());
    player.hairPivot.rotation.set(.06,0,.06);player.g.updateMatrixWorld(true);results[style]=root.getWorldPosition(new THREE.Vector3()).distanceTo(before);
   }player.hairPivot.rotation.set(0,0,0);return results;
  });
  assert(Object.values(report.hairRoots).every(d=>d<1e-10),'hair roots drift');
  report.hoodie=await page.evaluate(()=>{
   poseGuy(player,{dip:0,lift:0,jmp:0,over:0},0,1);setHair(player,'afro',0x36261e);
   AIBAEquipmentVisuals.applyHead(player,{id:'head-hoodie',color:'#485a66'});renderer.render(scene,camera);
   return {hair:[player.hairBase,player.hairGrp,player.hairTail].map(g=>g.visible),hem:player.jerseyHem.visible};
  });await save('game-hoodie');assert(report.hoodie.hair.every(v=>!v)&&!report.hoodie.hem,'hoodie hides underlying hair and hem');
  const restored=await page.evaluate(()=>{AIBAEquipmentVisuals.applyHead(player,null);renderer.render(scene,camera);return [player.hairBase,player.hairGrp,player.hairTail,player.jerseyHem].every(g=>g.visible);});assert(restored,'hoodie removal restores layers');await save('game-restored');
 }
 if(stage==='after'){
  assert.equal(report.flowerCourt.water,2,'one continuous curtain plus impact spray');
  assert(report.shonanCoast.cables?.spans>0,'connected cable spans');
  const previous=JSON.parse(fs.readFileSync(path.join(out,'../before/report.json'),'utf8'));
  assert.deepEqual(report.rig,previous.rig,'rig attachment coordinates changed');
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS flow/player '+stage);await ctx.close();
}finally{await browser.close();}
