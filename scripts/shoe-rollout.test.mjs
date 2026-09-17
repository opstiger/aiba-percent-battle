/* Grey-model review for the three new shoe families.
 * Renders production geometry with colour removed, so approving these images
 * approves what will actually ship — no lab-model translation step in between.
 * Nothing here is wired into index.html yet; shoe-styles.js is injected per run. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/shoe-rollout-20260916');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const FAMILIES=['RetroHighPanels','StripeMidPanels','CanvasHighPanels','AirRunnerPanels'];
const LABEL={RetroHighPanels:'RetroHigh · 篮球人物剪影',StripeMidPanels:'StripeMid · 三道斜带中帮',CanvasHighPanels:'CanvasHigh · 帆布高帮',AirRunnerPanels:'AirRunner · 缓震低帮'};
/* 面数预算。RetroHigh 524 是已上线的参照,新品系不许翻倍——手机端还欠一个 400 面 LOD。 */
const BUDGET={RetroHighPanels:760,StripeMidPanels:720,CanvasHighPanels:800,AirRunnerPanels:760};
const report={errors:[],families:{}};
try{
 const ctx=await browser.newContext({viewport:{width:720,height:900},deviceScaleFactor:1});
 await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 /* 开发机常年跑满(实测 load 60~120),load 事件可以拖到几十秒。
    先等 DOM,再单独等运行时就绪,比赌一个 load 超时稳。 */
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260916',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBARetroHigh,null,{timeout:120000});
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});
 await page.addScriptTag({path:path.join(root,'src/rendering/shoe-styles.js')});

 await page.evaluate(()=>{
  window.shoeAudit=g=>{
   const fit=g.baseShoeKit;if(!fit)return {ok:false};
   const shoes=fit.roots.map(a=>a.children[0]);
   return {ok:fit.options.colorway.startsWith('approved_')&&shoes.length===2&&shoes.every(s=>s?.getObjectByName('base_basketball_shoe')?.visible),family:fit.options.family,colorway:fit.options.colorway,oldVisible:fit.hidden.some(([m])=>m.visible)};
  };
 });
 report.gear=await page.evaluate(()=>{
  applyStarStyle(player,LEGENDS.find(s=>s.id==='curry'));const expected=player.defaultBasketballShoe.colorway;
  return [...AIBAGear.CATALOG.shoes,null].map(item=>{AIBAEquipmentVisuals.applyShoes(player,item);return {id:item?.id||'none',...shoeAudit(player),unchanged:player.baseShoeKit.options.colorway===expected};});
 });assert(report.gear.every(r=>r.ok&&r.unchanged&&!r.oldVisible));
 report.custom=await page.evaluate(()=>{applyStarStyle(rivals[0],{...LEGENDS[0],id:'qa-custom-shoe',col:[0x315b47,0xffffff]});return shoeAudit(rivals[0]);});assert(report.custom.ok);
 report.tattoos=await page.evaluate(()=>LEGENDS.map(star=>{
  applyStarStyle(rivals[0],star);
  let count=0;rivals[0].g.traverse(o=>{if(o.name==='tattooInk')count++;});
  return {id:star.id,count};
 }));
 assert(report.tattoos.length>=18&&report.tattoos.every(row=>row.count>0),'every named player must receive a tattoo visual');
 report.passers=await page.evaluate(()=>[shoeAudit(passer),shoeAudit(oppPasser)]);assert(report.passers.every(r=>r.ok&&!r.oldVisible));
 // Capture actual select-screen dressing, including the live selected player.
 await page.evaluate(()=>{
  window.previewShoeRows=[];window.previewGuys=[];const original=window.applyStarStyle;
  window.applyStarStyle=function(g,star){const result=original.apply(this,arguments);previewShoeRows.push({id:star.id,...shoeAudit(g)});previewGuys.push(g);return result;};
  window.__lifeFreeze=false;showAIBAPlayerSelect('contest');
 });
 await page.waitForFunction(()=>document.querySelectorAll('[data-locker-avatar].ready').length>=10,null,{timeout:120000});
 report.locker=await page.evaluate(()=>({rows:previewShoeRows,ready:document.querySelectorAll('[data-locker-avatar].ready').length,failed:document.querySelectorAll('[data-locker-avatar].failed').length}));
 assert(report.locker.rows.length>=10);assert(report.locker.rows.every(r=>r.ok&&!r.oldVisible));assert.equal(report.locker.failed,0);
 await page.screenshot({path:path.join(out,'player-select.png')});
 await page.evaluate(()=>{AIBALockerPreview.destroy();hidePanel();window.__lifeFreeze=true;});
 report.previewDisposed=await page.evaluate(()=>previewGuys.every(g=>!g.baseShoeKit));assert(report.previewDisposed,'preview cleanup must detach all shoe kits');
 report.modes=[];
 for(const mode of ['contest','battle','rackrush','speed100','practice','lastshot']){
  const row=await page.evaluate(mode=>{
   chooseAIBAPlayer('j23');
   if(mode==='lastshot'){beginLastShot(true);}
   else if(mode==='practice'){startPractice();}
   else{goDiff(mode==='speed100'?'rackrush':mode,true);pickDiff('normal');
    if(mode==='contest')startRound();else if(mode==='battle')startBattle();else startRackRush(mode==='speed100'?'speed100':'classic');}
   const actors=mode==='lastshot'?Object.values(AIBALastShotSquad.squad.actors).map(a=>shoeAudit(a.guy)):mode==='contest'?rivals.map(shoeAudit):mode==='battle'?[shoeAudit(rivals[0])]:[];
   return {mode,state:G.state,star:G.myStar?.id,player:shoeAudit(player),actors};
  },mode);
  assert(row.player.ok&&!row.player.oldVisible,mode+' player');assert.equal(row.star,'j23');assert(row.actors.every(r=>r.ok&&!r.oldVisible),mode+' actors');report.modes.push(row);
 }
 assert.equal(report.modes.find(r=>r.mode==='lastshot').actors.length,9);
 report.repeatSquad=await page.evaluate(()=>{
  chooseAIBAPlayer('curry');beginLastShot(true);
  return {player:shoeAudit(player),star:G.myStar.id,actors:Object.values(AIBALastShotSquad.squad.actors).map(a=>shoeAudit(a.guy))};
 });assert.equal(report.repeatSquad.star,'curry');assert(report.repeatSquad.actors.every(r=>r.ok&&!r.oldVisible));
 // A real in-game close-up, using production colors and the game scene.
 await page.evaluate(()=>{
  AIBALastShotSquad.show(false);player.g.visible=true;player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
  player.g.position.y=poseGuy(player,{dip:0,lift:0,jmp:0,over:0},0,1);AIBABasketballShoes.update(player,1/60,{snap:true});
  camera.position.set(.9,.42,1.5);camera.lookAt(0,.30,.03);camera.updateMatrixWorld(true);renderer.render(scene,camera);
 });
 const png=await page.evaluate(()=>renderer.domElement.toDataURL());fs.writeFileSync(path.join(out,'production-shoes.png'),Buffer.from(png.split(',')[1],'base64'));
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS selection screen / saved gear / custom player / 2 passers / 6 mode entries / 9 last-shot actors / repeated selection');
 await ctx.close();
}finally{await browser.close();}
