/* Real production scene A/B. No saves; isolated, muted contexts, deterministic
   random source, identical camera, and measured scene-switch resource recovery. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts/model-craft-20260909');fs.mkdirSync(out,{recursive:true});
const base=process.env.AIBA_QA_URL||'http://127.0.0.1:4187';
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'];
const cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))candidates.push(path.join(cache,d,'node_modules/'));
let browser;
for(const candidate of candidates){
  try{const pw=createRequire(candidate)('playwright');browser=await pw.chromium.launch({args:['--mute-audio','--disable-background-timer-throttling']});break;}catch{}
}
if(!browser)throw Error('No available Playwright Chromium');
const report={},errors=[];
try{
  for(const variant of ['classic','detail']){
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
    await context.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
    await context.addInitScript(()=>{
      let seed=20260909;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
      const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__craftFreeze)f(t);});
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(variant+': '+e.message));
    report[variant]={};
    const save=async name=>{
      const data=await page.evaluate(()=>renderer.domElement.toDataURL('image/png'));
      fs.writeFileSync(path.join(out,variant+'-'+name+'.png'),Buffer.from(data.split(',')[1],'base64'));
    };
    try{
      await page.goto(base+'/viewer.html?nohud=1&bg=neutral&angle=three-quarter&craft='+variant,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__viewerReady);
      report[variant].rig=await page.evaluate(()=>{
        window.__craftFreeze=true;const {guy:g,root,camera}=__viewerModel();root.rotation.y=.55;
        renderer.render(scene,camera);
        return ['arms','elbows','handRoots','ballGrips','legs','knees','ankles','footRoots','toeRoots'].map(k=>[k,g[k].map(n=>[n.position.toArray(),n.quaternion.toArray()])]);
      });
      await save('player');
      for(const id of ['shoes-anchor','shoes-blaze','shoes-marathon','shoes-spring']){
        await page.evaluate(id=>{
          const {guy:g,root,camera}=__viewerModel();root.rotation.y=.70;AIBAEquipmentVisuals.applyShoes(g,{id,color:'#358b96'});
          camera.position.set(0,.43,1.22);camera.lookAt(0,.18,0);renderer.render(scene,camera);
        },id);await save(id);
      }
      await page.goto(base+'/index.html?intro=0&seed=20260909&craft='+variant,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&typeof applyScenePreset==='function');
      await page.evaluate(()=>{window.__craftFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();G.tNow=0;});
      report[variant].scenes={};
      for(const name of ['indoor','outdoorSunny','rainyCourt','flowerCourt','beachSunset']){
        report[variant].scenes[name]=await page.evaluate(name=>{
          applyScenePreset(name,{persist:false});
          if(name==='flowerCourt')for(let i=0;i<90;i++)updateFlowerCourt(.8,1/30);
          if(name==='beachSunset')updateBeachSunset(.05,0);
          player.g.visible=false;player.groundShadow.visible=false;
          camera.fov=58;camera.aspect=1280/900;camera.updateProjectionMatrix();
          camera.position.set(17,9,18);camera.lookAt(0,1,-5);camera.updateMatrixWorld(true);
          renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,camera);
          renderer.info.autoReset=true;
          const craft=environmentRoot.getObjectByName('courtCraft');
          return {craft:craft?.userData||null,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
            memory:{...renderer.info.memory},hoop:HOOP.toArray(),ball:BALL_RADIUS};
        },name);await save(name);
        await page.evaluate(()=>{camera.position.set(3.8,2.3,1.5);camera.lookAt(0,2.0,-9);renderer.render(scene,camera);});
        await save(name+'-play');
      }
      report[variant].switches=await page.evaluate(()=>{
        const counts=[];
        for(let pass=0;pass<3;pass++){
          for(const name of ['outdoorSunny','beachSunset','flowerCourt','rainyCourt','indoor'])applyScenePreset(name,{persist:false});
          renderer.render(scene,camera);counts.push({...renderer.info.memory,roots:environmentRoot.children.length});
        }
        return counts;
      });
      // Coarse pointer/lite path is verified in its own mobile context below.
    }finally{await context.close();}
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try{
    await mobile.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
    await mobile.addInitScript(()=>{
      const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__craftFreeze)f(t);});
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
    });
    const page=await mobile.newPage();page.on('pageerror',e=>errors.push('mobile: '+e.message));
    await page.goto(base+'/index.html?intro=0&seed=20260909',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g);
    await page.evaluate(()=>{
      window.__craftFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();
      player.g.visible=false;player.groundShadow.visible=false;
      camera.position.set(3.8,2.3,1.5);camera.lookAt(0,2,-9);camera.updateMatrixWorld(true);
    });
    report.mobile=[];
    for(const name of ['outdoorSunny','rainyCourt','flowerCourt','beachSunset']){
      const info=await page.evaluate(name=>{
        applyScenePreset(name,{persist:false});
        renderer.render(scene,camera);
        return {name,mode:AIBAGrade.mode,coarse:matchMedia('(pointer:coarse)').matches,rt:window.AIBAGrade?.rtInfo(),craft:environmentRoot.getObjectByName('courtCraft')?.userData};
      },name);report.mobile.push(info);
      const data=await page.evaluate(()=>renderer.domElement.toDataURL('image/png'));
      fs.writeFileSync(path.join(out,'mobile-'+name+'.png'),Buffer.from(data.split(',')[1],'base64'));
    }
  }finally{await mobile.close();}
  assert.deepEqual(report.detail.rig,report.classic.rig,'joint transforms changed');
  for(const name of ['indoor','outdoorSunny','rainyCourt','flowerCourt','beachSunset']){
    const a=report.classic.scenes[name],b=report.detail.scenes[name];
    assert.deepEqual(b.hoop,a.hoop);assert.equal(b.ball,a.ball);
    if(name!=='indoor'){
      assert(b.craft?.boxes>100,'missing architectural detail '+name);
      assert(b.calls-a.calls<=8,'static detail draw budget exceeded '+name);
    }else assert.equal(b.craft,null);
  }
  for(const variant of ['classic','detail']){
    const s=report[variant].switches;
    assert.deepEqual(s[2],s[1],'resource growth after repeated preset switches');
  }
  assert(report.mobile.every(m=>m.coarse&&m.craft?.boxes>100),'mobile detail missing');
  assert(report.mobile.every(m=>m.mode==='lite'&&m.rt?.depthBuffer===true&&m.rt?.depthTexture===false),'mobile lite depth buffer regression');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify(report,null,2));
  console.log('PASS craft scene construction, draw budget, preset disposal, rig preservation, mobile loading');
}finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2));await browser.close();
}
