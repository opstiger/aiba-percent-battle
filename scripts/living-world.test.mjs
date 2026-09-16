import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/living-world-20260911');fs.mkdirSync(out,{recursive:true});
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
 report.walkers=await page.evaluate(()=>{
   const s=AIBACrowdLife.state,start=s.walkers.map(w=>w.g.getWorldPosition(V3(0,0,0)));let missingFloor=0,pauses=0,walks=0;
   for(let t=0;t<80;t+=.5){AIBACrowdLife.update(t);scene.updateMatrixWorld(true);for(const w of s.walkers){
     const ray=new THREE.Raycaster(w.g.position.clone().add(V3(0,.2,0)),V3(0,-1,0),0,.6);
     if(!ray.intersectObject(s.root.getObjectByName('arenaAisleSteps')).length)missingFloor++;
     w.status==='walk'?walks++:pauses++;
   }}
   AIBACrowdLife.update(8);scene.updateMatrixWorld(true);const distance=s.walkers.map((w,i)=>w.g.getWorldPosition(V3(0,0,0)).distanceTo(start[i]));
   const w=s.walkers[0];camera.fov=45;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const inward=V3(-w.g.position.x,0,-w.g.position.z).normalize();camera.position.copy(w.g.position).addScaledVector(inward,3.5);camera.position.y+=2;camera.lookAt(w.g.position.clone().add(V3(0,.8,0)));
   return {count:s.walkers.length,paths:s.paths.length,distance,missingFloor,walks,pauses};
 });assert(report.walkers.distance.every(d=>d>1));assert(report.walkers.walks>0&&report.walkers.pauses>0);assert.equal(report.walkers.missingFloor,0);await save('aisle-walker');
 await page.evaluate(()=>{applyScenePreset('beachSunset',{persist:false});window.__drinkPerson=streetCrowd.people.find(p=>p.life);__drinkPerson.life.phase=0;
   const p=__drinkPerson;streetCrowd.people.forEach(q=>{q.g.visible=q===p;});const dir=V3(0,0,-1).applyQuaternion(p.g.quaternion);camera.fov=36;camera.position.copy(p.g.position).addScaledVector(dir,3.1);camera.position.y=1.6;camera.lookAt(p.g.position.clone().add(V3(0,1.05,0)));camera.updateProjectionMatrix();
 });
 report.drink=[];
 for(const t of [0,1,2.5,6]){
   const data=await page.evaluate(t=>{streetCrowd.root.userData.clock=t-.001;updStreetCrowd(t,.001);scene.updateMatrixWorld(true);const p=__drinkPerson,l=p.life;
     return {amount:l.amount,cup:l.cup.getWorldPosition(V3(0,0,0)).toArray(),mouthGap:l.cup.localToWorld(V3(.012,.27,.025)).distanceTo(l.mouth.getWorldPosition(V3(0,0,0)))};
   },t);report.drink.push(data);await save('drink-'+t);
 }
 assert(report.drink[2].mouthGap<.05);assert.equal(report.drink[0].amount,0);assert.equal(report.drink[3].amount,0);assert.notDeepEqual(report.drink[0].cup,report.drink[2].cup);
 report.chat=await page.evaluate(()=>{applyScenePreset('shonanCoast',{persist:false});const p=streetCrowd.people.find(p=>p.chat?.turn===0);const t=24-p.chat.phase;streetCrowd.root.userData.clock=t-.001;updStreetCrowd(t,.001);
   const dir=V3(0,0,-1).applyQuaternion(p.g.quaternion);camera.position.copy(p.g.position).addScaledVector(dir,4);camera.position.y=1.7;camera.lookAt(p.g.position.clone().add(V3(0,1.1,0)));
   return {count:streetCrowd.people.filter(p=>p.chat).length,turn:p.g.rotation.y-p.baseRot,mouth:p.chat.mouth.scale.y,arm:p.arms[0].rotation.x};
 });assert(report.chat.count>=2&&Math.abs(report.chat.turn)>.1);await save('conversation');
 report.campus=await page.evaluate(()=>{const pointSegment=(p,a,b)=>{const d=b.clone().sub(a),k=clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(d,k));};let clearance=Infinity;
 for(const p of streetCrowd.people)for(let i=0;i<RACKS.length-1;i++)clearance=Math.min(clearance,pointSegment(p.g.position,RACKS[i].p,RACKS[i+1].p));
 camera.fov=62;camera.position.set(2,5,4.5);camera.lookAt(0,1,-7.5);camera.updateProjectionMatrix();return {count:streetCrowd.people.length,routeClearance:clearance,insideBaseline:streetCrowd.people.filter(p=>p.g.position.z>COURT.nearBaseline&&Math.abs(p.g.position.x)<7.62).length};
 });assert(report.campus.count>=170);assert(report.campus.routeClearance>1);assert(report.campus.insideBaseline>0);await save('campus-overview');

 await page.evaluate(()=>{applyScenePreset('indoor',{persist:false});player.g.visible=true;passer.g.visible=false;oppPasser.g.visible=false;player.g.position.set(0,0,0);player.g.rotation.set(0,.2,0);applyStarStyle(player,LEGENDS.find(s=>s.id==='curry'));poseGuy(player,{dip:0,lift:0,jmp:0,over:0},0,1);camera.fov=30;camera.position.set(.9,1.4,3.4);camera.lookAt(0,1.05,0);camera.updateProjectionMatrix();});
 report.jersey=await page.evaluate(()=>{const shell=player.g.getObjectByName('jerseyShell');return {name:shell.geometry.name,count:shell.geometry.attributes.position.count,groups:shell.geometry.groups.length};});assert.equal(report.jersey.name,'tailoredJerseyPanels');await save('jersey-front');
 report.shoulders=await page.evaluate(()=>{scene.updateMatrixWorld(true);const shell=player.g.getObjectByName('jerseyShell'),skin=player.g.getObjectByName('jerseyNeckInset');return [-1,1].map(side=>{const origin=player.g.localToWorld(V3(side*.17,1.65,0)),ray=new THREE.Raycaster(origin,V3(0,-1,0));const hits=ray.intersectObjects([shell,skin]);return hits[0]?.object.name;});});assert.deepEqual(report.shoulders,['jerseyShell','jerseyShell']);
 await page.evaluate(()=>{camera.position.set(.7,2.6,2.3);camera.lookAt(0,1.32,0);});await save('jersey-shoulder-top');

 await page.evaluate(()=>{camera.position.set(-.9,1.4,-3.4);camera.lookAt(0,1.05,0);});await save('jersey-back');
 await page.evaluate(()=>{camera.position.set(.9,1.4,3.4);camera.lookAt(0,1.05,0);applyStarStyle(player,LEGENDS.find(s=>s.id==='h13'));poseGuy(player,{dip:0,lift:.8,jmp:0,over:0},0,1);});await save('jersey-lefty');
 report.hoodie=await page.evaluate(()=>{AIBAEquipmentVisuals.applyHead(player,{id:'head-hoodie',color:'#485a66'});return {hem:player.jerseyHem.visible,shell:player.g.getObjectByName('jerseyShell').visible,inset:player.g.getObjectByName('jerseyNeckInset').visible};});assert(!report.hoodie.hem&&!report.hoodie.shell&&!report.hoodie.inset);await save('jersey-hoodie');
 const restored=await page.evaluate(()=>{AIBAEquipmentVisuals.applyHead(player,null);return player.g.getObjectByName('jerseyShell').visible&&player.g.getObjectByName('jerseyNeckInset').visible;});assert(restored);
 report.faceBounds=await page.evaluate(()=>{
   const samples=[];
   for(const place of ['beachSunset','shonanCoast','flowerCourt','spanishQuarter','rainyCourt','outdoorSunny','arcticSnow','medCliff']){
     applyScenePreset(place,{persist:false});let count=0,maxHeight=0,maxWidth=0,maxDepth=0;
     for(const p of streetCrowd.people){if(p.phone&&p.phone.parent!==p.arms[1])throw new Error("Phone detached from hand");if(p.ball&&p.ball.parent!==p.arms[0])throw new Error("Ball detached from hand");}
     const people=streetCrowd.people.filter(p=>p.life||p.chat);
     for(let t=0;t<36;t+=.125){
       for(const p of people)updateStreetLife(p,t);
       scene.updateMatrixWorld(true);
       for(const p of people){const m=(p.life||p.chat).mouth,box=new THREE.Box3().setFromObject(m),size=box.getSize(V3(0,0,0));
         maxHeight=Math.max(maxHeight,size.y);maxWidth=Math.max(maxWidth,size.x);maxDepth=Math.max(maxDepth,size.z);count++;
       }
     }
     samples.push({place,count,maxHeight,maxWidth,maxDepth});
   }return samples;
 });
 for(const row of report.faceBounds){assert(row.maxHeight<.05,JSON.stringify(row));assert(row.maxWidth<.07&&row.maxDepth<.07,JSON.stringify(row));}
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'life-report.json'),JSON.stringify(report,null,2));console.log('PASS aisle floors/walking/pauses, hand-to-mouth contact, chat pairs, tailored jersey and hoodie restoration');await ctx.close();
}finally{await browser.close();}
