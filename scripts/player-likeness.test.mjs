import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/player-likeness-20260914');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1});await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260911');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBACrowdLife);
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});
 const save=async name=>{const png=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL();});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png.split(',')[1],'base64'));};

 await page.evaluate(()=>{player.g.visible=false;passer.g.visible=false;oppPasser.g.visible=false;rivals.forEach(r=>r.g.visible=false);window.__subject=rivals[0];__subject.g.visible=true;__subject.g.position.set(0,0,0);__subject.g.rotation.set(0,.18,0);camera.fov=32;camera.position.set(.7,1.4,3.5);camera.lookAt(0,1.05,0);camera.updateProjectionMatrix();});
 const ids=await page.evaluate(()=>LEGENDS.map(s=>s.id));report.players=[];
 for(const id of ids){
   const row=await page.evaluate(id=>{const star=LEGENDS.find(s=>s.id===id),g=__subject;
     const snap=()=>({mirror:Math.sign(g.g.scale.x),skin:g.mS.color.getHex(),hair:g.hairStyle,hairColor:g.hairMat.color.getHex(),beard:g.beardGrp.visible,beardStyle:g.beardGrp.visible?g.beardGrp.userData.style:null,shoe:g.shoes.map(s=>s.material.color.getHex()),sleeves:g.sleeves.map(s=>s.visible),wrists:g.wrists.map(s=>s.visible),headband:g.headband.visible});
     applyStarStyle(g,star);const a=snap();applyStarStyle(g,LEGENDS.find(s=>s.id==='h13'));applyStarStyle(g,star);const b=snap();poseGuy(g,{dip:0,lift:0,jmp:0,over:0},0,1);
     return {id,name:star.n,a,b,expectedSkin:new THREE.Color(star.skin).convertSRGBToLinear().getHex(),expectedHair:star.hairStyle};
   },id);assert.deepEqual(row.a,row.b,'unstable appearance '+id);assert.equal(row.a.mirror,id==="h13"?-1:1);assert.equal(row.a.skin,row.expectedSkin);assert.equal(row.a.hair,row.expectedHair);report.players.push(row);await save(id);
 }
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS all '+ids.length+' roster appearances deterministic after switching; skin/hair match fixed profiles');await ctx.close();
}finally{await browser.close();}
