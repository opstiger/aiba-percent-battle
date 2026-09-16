import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,'artifacts/immersion-20260911');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
assert(browser,'Playwright Chromium required');const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,...(process.env.AIBA_CAPTURE_VIDEO?{recordVideo:{dir:out,size:{width:1280,height:900}}}:{})});
 await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__freeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4194')+'/index.html?intro=0&seed=20260911');
 await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBABattle);
 await page.evaluate(()=>{window.__freeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});G.myStar=LEGENDS.find(s=>s.id==='thompson');G.battleOpp=LEGENDS.find(s=>s.id==='h13');G.mode='battle';AIBABattle.resetBattleState();OPP.o=G.battleOpp;G.state='battle';G.running=false;
   window.__advanceCrowd=t=>{G.tNow=t;updCrowd(t);updNearCourtCrowd(t,1/60);};__advanceCrowd(10);
   camera.fov=64;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();camera.position.set(2,5,7);camera.lookAt(0,5,-11);player.g.visible=false;
 });
 const save=async name=>{const data=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL();});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));};
 report.idle=await page.evaluate(()=>{
   const first=crowd.groups.map(g=>Array.from(g.arms.instanceMatrix.array));for(let i=1;i<=120;i++)__advanceCrowd(10+i/60);
   return {changed:first.reduce((n,a,j)=>n+a.filter((x,i)=>Math.abs(x-crowd.groups[j].arms.instanceMatrix.array[i])>.005).length,0),count:crowd.groups.reduce((n,g)=>n+g.seats.length,0),teams:crowdTeams(),factions:[-1,0,1].map(team=>crowd.groups.reduce((n,g)=>n+g.seats.filter(s=>s.team===team).length,0))};
 });assert(report.idle.changed>100);assert(report.idle.factions.every(n=>n>0));await save('nba-idle');
 for(const who of ['player','opponent']){
   report[who]=await page.evaluate(who=>{
     __advanceCrowd(who==='player'?20:30);
     const event=crowd.event,score=G.battleOppScore;
     if(who==='player'){G.practice=true;madeBall({val:3,netDir:1});G.practice=false;}
     else AIBABattle.oppScore({val:3});
     const seats=crowd.groups.flatMap(g=>g.seats);
     for(let i=1;i<=80;i++)__advanceCrowd((who==='player'?20:30)+i/60);
     return {eventDelta:crowd.event-event,opponentScoreDelta:G.battleOppScore-score,
       sides:[0,1].map(team=>{const a=seats.filter(s=>s.team===team);return a.reduce((n,s)=>n+s.responseSign,0)/a.length;}),delays:new Set(seats.map(s=>s.responseStart.toFixed(2))).size,durations:new Set(seats.map(s=>s.responseDuration.toFixed(2))).size};
   },who);assert.equal(report[who].eventDelta,1);assert(report[who].delays>20&&report[who].durations>50);await save('nba-'+who+'-score');
 }
 assert(report.player.sides[0]>0&&report.player.sides[1]<0);assert(report.opponent.sides[1]>0&&report.opponent.sides[0]<0);assert.equal(report.opponent.opponentScoreDelta,3);
 if(process.env.AIBA_CAPTURE_VIDEO){
   await page.evaluate(async()=>{
     for(const child of [...document.body.children])if(child!==renderer.domElement)child.style.display='none';
     document.body.appendChild(renderer.domElement);renderer.domElement.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;display:block';renderer.setPixelRatio(1);renderer.setSize(1280,900);
     const label=document.createElement('div');label.style.cssText='position:fixed;left:28px;top:24px;padding:12px 18px;background:#111c;color:#fff;font:20px sans-serif;z-index:100000';document.body.appendChild(label);
     const start=performance.now();let phase=-1;
     await new Promise(resolve=>{const timer=setInterval(()=>{
       const elapsed=(performance.now()-start)/1000,next=elapsed<4?0:elapsed<8?1:2;__advanceCrowd(100+elapsed);
       if(next!==phase){phase=next;label.textContent=['无人进球 · 观众自然活动','玩家命中 · 黄色球衣球迷庆祝','对手命中 · 红色球衣球迷庆祝'][phase];
         if(phase===1){G.practice=true;madeBall({val:3,netDir:1});G.practice=false;}
         if(phase===2)AIBABattle.oppScore({val:3});
       }
       renderer.render(scene,camera);if(elapsed>=12){clearInterval(timer);resolve();}
     },1000/30);});
   });
 }
 report.uniforms=await page.evaluate(()=>{
   applyScenePreset('shonanCoast',{persist:false});let skirts=0,trousers=0;streetCrowd.root.traverse(o=>{if(o.name==='schoolUniformSkirt')skirts++;if(o.name==='schoolUniformTrousers')trousers++;});
   return {skirts,trousers,count:streetCrowd.people.length,seated:streetCrowd.people.filter(p=>p.kind==='bench').length};
 });assert(report.uniforms.skirts>10&&report.uniforms.trousers>10);assert.equal(report.uniforms.seated,0);
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'crowd-report.json'),JSON.stringify(report,null,2));console.log('Real player/CPU score hooks, opposite fan responses, staggered timing, idle motion and school uniforms: PASS');
 const video=page.video();await page.close();if(video)await video.saveAs(path.join(out,'nba-fans.webm'));await ctx.close();
}finally{await browser.close();}
