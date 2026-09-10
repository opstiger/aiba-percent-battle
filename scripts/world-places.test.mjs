/* Actual production scenes, fixed cameras and time, audio disabled before navigation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'artifacts/world-places-20260910');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))candidates.push(path.join(cache,d,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
if(!browser)throw Error('Playwright Chromium required');
const report={scenes:{},errors:[]},names=['outdoorSunny','rainyCourt','flowerCourt','shonanCoast','medCliff','beachSunset'];
try{
  for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
    await context.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
    await context.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__placeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4189')+'/index.html?intro=0&seed=20260910',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBAWorldPlaces,{timeout:60000});
    await page.evaluate(()=>{window.__placeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();});
    const save=async(name,view)=>{
      const png=await page.evaluate(view=>{
        player.g.visible=false;player.groundShadow.visible=false;camera.fov=view==='play'?58:64;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
        if(view==='play'){camera.position.set(3.8,2.3,1.5);camera.lookAt(0,3,-9);}
        else if(view==='reverse'){camera.position.set(-15,7,-12);camera.lookAt(0,5,12);}
        else{camera.position.set(20,12,24);camera.lookAt(0,5,-7);}
        renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,camera);renderer.info.autoReset=true;return renderer.domElement.toDataURL();
      },view);fs.writeFileSync(path.join(out,`${mobile?'mobile-':''}${name}-${view}.png`),Buffer.from(png.split(',')[1],'base64'));
    };
    for(const name of names){
      const data=await page.evaluate(name=>{
        applyScenePreset(name,{persist:false});const s=environmentRoot.userData.placeState;
        const start={cloud:s.clouds[0].g.position.x,plant:s.plants[0].pivot.rotation.z,cars:s.vehicles.map(v=>v.g.position.z)};
        const oldRandom=Math.random;let randomCalls=0;Math.random=()=>{randomCalls++;return oldRandom();};
        for(let i=0;i<180;i++){AIBAWorldPlaces.update(1/30,.35);if(name==='flowerCourt')updateFlowerCourt(.5,1/30);updStreetCrowd(i/30,1/30);}
        Math.random=oldRandom;
        const end={cloud:s.clouds[0].g.position.x,plant:s.plants[0].pivot.rotation.z,cars:s.vehicles.map(v=>v.g.position.z)};
        const people=streetCrowd.people,idle=people.map(p=>p.g.position.y),crowdLayout=people.map(p=>[p.kind,...p.origin.toArray()]);triggerStreetCrowdReaction('final',10);
        for(let i=0;i<45;i++)updStreetCrowd(6+i/30,1/30);
        const response=people.map(p=>p.response);
        Math.random=()=>{randomCalls++;return oldRandom();};s.nextBird=0;AIBAWorldPlaces.update(.01,.35);const birdCount=s.birds.length,birdStart=s.birds[0].g.position.toArray();AIBAWorldPlaces.update(2,.35);const birdEnd=s.birds[0].g.position.toArray();Math.random=oldRandom;
        s.nextBird=100;AIBAWorldPlaces.update(32,.35);const birdsRecycled=s.birds.length===0;
        let flowerWind=null;if(name==='flowerCourt'){const f=environmentRoot.userData.flowerState,old=Array.from(f.ground.petals.instanceMatrix.array.slice(0,16));AIBAWorldPlaces.update(.5,.35);updateFlowerCourt(.5,.5);flowerWind={before:old,after:Array.from(f.ground.petals.instanceMatrix.array.slice(0,16)),count:f.ground.target};}
        return {start,end,randomCalls,idle,response,crowdLayout,nearCrowdHidden:!nearCourtCrowd.root.visible,birdCount,birdStart,birdEnd,birdsRecycled,flowerWind,
          vehicles:s.vehicles.map(v=>({type:v.type,x:v.g.position.x,z:v.g.position.z})),surface:courtFloor.material.map.name,roughness:courtFloor.material.roughness,clearcoat:courtFloor.material.clearcoat,
          hoop:HOOP.toArray(),nearNet:netMesh.position.toArray(),farNet:farNet.position.toArray(),originalHidden:courtHoopRigs.every(r=>r.children.every(c=>c.userData.keepOutdoor||!c.visible)),
          cloudGeometry:s.clouds[0].g.children[0].geometry.attributes.position.count,plants:s.plants.length};
      },name);
      assert.notEqual(data.start.cloud,data.end.cloud);assert.notEqual(data.start.plant,data.end.plant);assert.equal(data.randomCalls,0,'environment animation must not consume gameplay randomness');
      assert.ok(data.originalHidden&&data.nearCrowdHidden);assert.deepEqual(data.hoop,[0,3.05,-8]);assert.equal(data.nearNet[2],-8);assert.equal(data.farNet[2],17.49);
      assert.ok(data.birdCount>0&&data.birdCount<=3);assert.notDeepEqual(data.birdStart,data.birdEnd);assert.ok(data.birdsRecycled);
      assert.ok(data.idle.filter(y=>y===0).length>=data.idle.length/2,'majority are grounded at idle');assert.ok(data.response.some(x=>x===0)&&data.response.some(x=>x>0));
      if(name==='outdoorSunny'){assert.notDeepEqual(data.start.cars,data.end.cars);assert.ok(data.vehicles.every(v=>Math.abs(v.x)>=19&&Math.abs(v.x)<=27));assert.ok(data.vehicles.some(v=>v.type==='schoolbus'));assert.ok(data.vehicles.some(v=>v.type==='bus'));}
      if(data.flowerWind)assert.notDeepEqual(data.flowerWind.before,data.flowerWind.after);
      report.scenes[(mobile?'mobile-':'')+name]=data;await save(name,'play');if(!mobile){await save(name,'wide');await save(name,'reverse');}
      data.render=await page.evaluate(()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory}}));
      if(name==='beachSunset'){
        const night=await page.evaluate(()=>{const s=environmentRoot.userData.placeState;AIBAWorldPlaces.update(0,0);const day=environmentRoot.userData.litWindows,daySky=Array.from(s.sky.geometry.attributes.color.array);AIBAWorldPlaces.update(0,1);return{day,night:environmentRoot.userData.litWindows,total:s.lights.length,skyChanged:daySky.some((v,i)=>v!==s.sky.geometry.attributes.color.array[i]),sun:s.sunDisc.material.opacity};});
        assert.equal(night.day,0);assert.ok(night.night>0);assert.ok(night.skyChanged);assert.equal(night.sun,0);report.scenes[(mobile?'mobile-':'')+name].night=night;await save(name+'-night','play');if(!mobile)await save(name+'-night','reverse');
      }
    }
    report[mobile?'mobileRecovery':'recovery']=await page.evaluate(()=>{
      const originalMaps=new Set(),disposed=[];let baseline;
      for(let i=0;i<3;i++){
        for(const name of ['outdoorSunny','rainyCourt','flowerCourt','beachSunset']){applyScenePreset(name,{persist:false});const tex=courtFloor.material.map;originalMaps.add(tex);tex.addEventListener('dispose',()=>disposed.push(tex.uuid));renderer.render(scene,camera);}
        applyScenePreset('indoor',{persist:false});renderer.render(scene,camera);if(i===0)baseline={...renderer.info.memory};
      }
      return {baseline,after:{...renderer.info.memory},disposed:disposed.length,textures:originalMaps.size,indoorMap:courtFloor.material.map===courtIndoorTexture,roughnessMap:courtFloor.material.roughnessMap===courtRoughTexture,hoops: courtHoopRigs.every(r=>r.children.every(c=>c.visible))&&nearCourtCrowd.root.visible,place:!!environmentRoot.userData.placeState};
    });
    const recovery=report[mobile?'mobileRecovery':'recovery'];assert.equal(recovery.disposed,recovery.textures);assert.ok(recovery.indoorMap&&recovery.roughnessMap&&recovery.hoops&&!recovery.place);assert.ok(recovery.after.geometries<=recovery.baseline.geometries+2);assert.ok(recovery.after.textures<=recovery.baseline.textures+2);
    await context.close();
  }
  // Every scene needs its own crowd layout; keep this tied to names.length so
  // adding a scene fails loudly if its layout was copied from another one.
  assert.equal(new Set(names.map(n=>JSON.stringify(report.scenes[n].crowdLayout))).size,names.length,
    `each of the ${names.length} scenes needs an independent crowd layout`);
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('world places runtime, screenshots, desktop/touch, weather animation, crowds, hoops and resource recovery: PASS');
}finally{await browser.close();}
