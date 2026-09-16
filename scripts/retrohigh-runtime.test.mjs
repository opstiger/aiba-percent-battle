import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/retrohigh-production-20260916/runtime');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:process.env.AIBA_MOBILE?{width:390,height:844}:{width:720,height:900},isMobile:!!process.env.AIBA_MOBILE,hasTouch:!!process.env.AIBA_MOBILE,deviceScaleFactor:1});await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260911');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBACrowdLife);
 await page.evaluate(()=>{window.__lifeFreeze=false;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});



 /* CAM.mode 必须配 applyCamMode():游戏里这两步永远成对(setCameraMode 就是这么写的)。
    少了它 player.g.visible 不会刷新,而 updateAll 会跳过不可见角色,
    lastContacts 永远是空的 —— 这条断言过不过纯看开场动画的时序。 */
 await page.evaluate(()=>{CAM.mode=1;applyCamMode();applyStarStyle(player,LEGENDS.find(s=>s.id==='j23'));AIBAEquipmentVisuals.applyShoes(player,null);});
 /* startRound() 之后先走开场动画,期间 cameraInPlay() 为假、player.g.visible 为假,
    而 updateAll 会跳过不可见角色。原来直接数 12 帧就断言,等于和开场动画赛跑 ——
    赢了就过,输了 lastContacts 就是空的。先等真正进入可玩状态,再数 12 帧。 */
 await page.waitForFunction(()=>player.g.visible,null,{timeout:60000});
 await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n>=12)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
 report.live=await page.evaluate(()=>({version:GAME_VERSION,shoe:!!player.baseShoeKit,contacts:player.baseShoeKit?.lastContacts,roots:player.baseShoeKit?.roots.map(r=>r.parent.name)}));assert(report.live.shoe);assert.equal(report.live.contacts.length,2);assert(report.live.contacts.every(c=>Number.isFinite(c.after)));
 await page.evaluate(()=>{window.__lifeFreeze=true;camera.position.set(player.g.position.x+1,1.1,player.g.position.z+3);camera.lookAt(player.g.position.x,.85,player.g.position.z);camera.updateMatrixWorld(true);renderer.render(scene,camera);});
 const png=await page.evaluate(()=>renderer.domElement.toDataURL());fs.writeFileSync(path.join(out,'in-game.png'),Buffer.from(png.split(',')[1],'base64'));
 report.actors=await page.evaluate(()=>['j23','h13','ionescu'].map(id=>{applyStarStyle(rivals[0],LEGENDS.find(s=>s.id===id));const g=rivals[0];AIBABasketballShoes.apply(g,'RetroHigh');g.g.position.y=poseGuy(g,{dip:0,lift:0,jmp:0,over:0},0,1);g.g.updateMatrixWorld(true);const before=g.ankles.map(n=>n.matrix.toArray());AIBABasketballShoes.update(g,1/60,{snap:true});return {id,lefty:g.lefty,scale:g.g.scale.toArray(),sameAnkles:JSON.stringify(before)===JSON.stringify(g.ankles.map(n=>n.matrix.toArray())),pair:g.baseShoeKit.roots.map(r=>r.children[0].name),min:g.baseShoeKit.lastContacts.map(c=>c.after)};}));assert(report.actors.every(r=>r.sameAnkles));assert(report.actors.find(r=>r.id==='h13').lefty);
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS live game-loop fitting, default Jordan shoe, left-handed and female actor fits');await ctx.close();
}finally{await browser.close();}
