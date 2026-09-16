import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/retrohigh-production-20260916');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:process.env.AIBA_MOBILE?{width:390,height:844}:{width:720,height:900},isMobile:!!process.env.AIBA_MOBILE,hasTouch:!!process.env.AIBA_MOBILE,deviceScaleFactor:1});await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260911');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBACrowdLife);
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});


 await page.evaluate(()=>{
  window.labScene=new THREE.Scene();labScene.background=new THREE.Color(0xc3c3c3);labScene.add(new THREE.HemisphereLight(0xffffff,0x777777,1));const light=new THREE.DirectionalLight(0xffffff,1.25);light.position.set(-3,4,5);labScene.add(light);
  window.labCamera=new THREE.OrthographicCamera(-.65,.65,.82,-.82,.01,30);
  window.subject=rivals[0];applyStarStyle(subject,LEGENDS.find(s=>s.id==='j23'));labScene.add(subject.g);subject.g.visible=false;window.baseRig=['legs','knees','ankles','footRoots','toeRoots','arms','elbows'].flatMap(k=>subject[k].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()})));
  window.last=createBasketballShoe();labScene.add(last);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:0xaaaaaa}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.name='labFloor';labScene.add(floor);
 });
 const save=async(name)=>{const data=await page.evaluate(()=>{labScene.updateMatrixWorld(true);labCamera.updateMatrixWorld(true);renderer.render(labScene,labCamera);return renderer.domElement.toDataURL();});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));};
 report.standard=await page.evaluate(()=>{const b=new THREE.Box3().setFromObject(last),s=b.getSize(new THREE.Vector3());return {...last.userData.shoe,LWH:[s.z,s.x,s.y],meshCount:last.children.length,materials:new Set(last.children.map(m=>m.material.uuid)).size};});
 assert(Math.abs(report.standard.LWH[0]-1)<1e-6);assert(Math.abs(report.standard.LWH[1]-.39)<1e-6);assert(Math.abs(report.standard.LWH[2]-.46)<.005);assert.equal(report.standard.meshCount,1);assert.equal(report.standard.materials,1);
 for(const name of ['outsole','outsoleEdge','midsole','toeCap','toeBox','mudguard','eyestay','quarterPanel','heelCounter','collar','tongue','laceBlock'])assert(report.standard.modules.some(m=>m.name===name),name);
 for(const [name,pos]of [['front',[0,.18,3]],['side',[3,.18,.24]],['top',[0,3,.24]],['front45',[2,1.5,2]],['rear45',[2,1.5,-2]]]){
  await page.evaluate(([name,pos])=>{labScene.getObjectByName('labFloor').visible=name!=='top';labCamera.up.set(0,1,0);if(name==='top')labCamera.up.set(0,0,-1);labCamera.position.set(...pos);labCamera.lookAt(0,name==='top'?0:.15,.24);labCamera.updateProjectionMatrix();},[name,pos]);await save('last-'+name);
 }
 // A spatial gauge only: no collar wall, tongue or high-top shoe geometry.
 await page.evaluate(()=>{const pts=[new THREE.Vector3(.22,.46,-.26),new THREE.Vector3(.22,.46,.74)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0x555555,dashSize:.02,gapSize:.015}));line.computeLineDistances();line.name='reference046';labScene.add(line);const baseLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.22,.11,-.26),new THREE.Vector3(.22,.11,.74)]),new THREE.LineDashedMaterial({color:0x666666,dashSize:.015,gapSize:.01}));baseLine.computeLineDistances();line.add(baseLine);labCamera.up.set(0,1,0);labCamera.position.set(3,.22,.24);labCamera.lookAt(0,.22,.24);});await save('last-height-reference');
 fs.writeFileSync(path.join(out,'ShoeLast_L1.object.json'),await page.evaluate(()=>JSON.stringify(last.toJSON())));
 report.fits=[];
 for(const length of [.42,.44,.46]){
  const data=await page.evaluate(length=>{
   last.visible=false;labScene.getObjectByName('reference046').visible=false;labScene.getObjectByName('labFloor').visible=true;subject.g.visible=true;subject.g.position.set(0,0,0);subject.g.rotation.set(0,0,0);
   window.rigSnapshot=()=>['legs','knees','ankles','footRoots','toeRoots'].flatMap(k=>subject[k].map(o=>({id:o.uuid,parent:o.parent.uuid,p:o.position.toArray(),r:o.rotation.toArray(),s:o.scale.toArray()})));
   const before=rigSnapshot();const f=AIBABasketballShoes.apply(subject,"RetroHigh",{length});const after=rigSnapshot();
   labCamera.left=-.75;labCamera.right=.75;labCamera.top=.9375;labCamera.bottom=-.9375;labCamera.up.set(0,1,0);labCamera.updateProjectionMatrix();
   return {length,rigUnchanged:JSON.stringify(before)===JSON.stringify(after),audit:f.audit,poses:[]};
  },length);assert(data.rigUnchanged);
  for(const pose of ['front','side','rear','prepare','jump','land','run']){
   const result=await page.evaluate(pose=>{
    baseRig.forEach(({n,p,q,s})=>{n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);});subject.g.rotation.set(0,0,0);subject.g.position.set(0,0,0);G.tNow=0;
    const neutral={dip:0,lift:0,jmp:0,over:0};let c=neutral,landing=0;
    if(pose==='prepare')c={dip:1,lift:.5,jmp:0,over:0};if(pose==='jump')c={dip:0,lift:1,jmp:1,over:0};if(pose==='land')landing=1;
    subject.g.position.y=poseGuy(subject,c,landing,1)+(pose==='jump'?.55:0);
    if(pose==='run'){const state={phase:0,stride:0,bob:0};for(let i=0;i<24;i++)poseRunCycle(subject,state,1.6,1/60,{sway:true});}
    const beforeFit=rigSnapshot();const contacts=(AIBABasketballShoes.update(subject,1/60,{snap:true}),subject.baseShoeKit.lastContacts);if(JSON.stringify(beforeFit)!==JSON.stringify(rigSnapshot()))throw Error('Fit changed skeleton');
    const view=pose==='side'?[3,.95,0]:pose==='rear'?[2.6,1.2,-3.4]:pose==='front'?[0,.95,3]:[2.6,1.2,3.4];
    labCamera.position.set(...view);labCamera.lookAt(0,pose==='jump'?1.17:.86,.06);labScene.updateMatrixWorld(true);
    return {pose,contacts,minY:subject.footRoots.map(f=>{const m=f.getObjectByName('ShoeFitAnchor');let min=Infinity;const v=new THREE.Vector3();m.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y);}}});return min;}),rig:rigSnapshot()};
   },pose);
   for(const c of result.contacts)assert(Number.isFinite(c.after));if(pose!=='jump'&&pose!=='run')result.minY.forEach(y=>assert(Math.abs(y)<.012));assert(result.minY.every(y=>y>=-.001),JSON.stringify(result));data.poses.push(result);await save('L'+length.toFixed(2)+'-'+pose);
  }
  report.fits.push(data);
 }
 report.restore=await page.evaluate(()=>{const hidden=subject.baseShoeKit.hidden.slice();AIBABasketballShoes.clear(subject);return {visibilityRestored:hidden.every(([m,v])=>m.visible===v),anchors:subject.footRoots.flatMap(f=>f.children.filter(c=>c.name==='ShoeFitAnchor')).length};});assert(report.restore.visibilityRestored);assert.equal(report.restore.anchors,0);

 report.dynamic=await page.evaluate(()=>{
  const g=subject;AIBABasketballShoes.apply(g,'RetroHigh');let state={phase:0,stride:0,bob:0},min=Infinity,maxStep=0,lastOffsets=[0,0],rigIntact=true;
  for(let i=0;i<240;i++){const speed=i<180?1.6:Math.max(0,1.6*(1-(i-180)/45));poseRunCycle(g,state,speed,1/60,{sway:true,decel:i>=180?1:0});const before=JSON.stringify(rigSnapshot());AIBABasketballShoes.update(g,1/60);rigIntact&&=before===JSON.stringify(rigSnapshot());g.baseShoeKit.lastContacts.forEach((c,j)=>{min=Math.min(min,c.after);if(i>0)maxStep=Math.max(maxStep,Math.abs(c.correction-lastOffsets[j]));lastOffsets[j]=c.correction;});}
  let minAir=Infinity;for(let i=0;i<=120;i++){const t=i/120,jump=Math.sin(Math.PI*t);g.g.position.y=poseGuy(g,{dip:0,lift:1,jmp:jump,over:0},0,1)+jump*.55;const before=JSON.stringify(rigSnapshot());AIBABasketballShoes.update(g,1/60);rigIntact&&=before===JSON.stringify(rigSnapshot());if(t>.3&&t<.7)minAir=Math.min(minAir,...g.baseShoeKit.lastContacts.map(c=>c.after));}
  return {runAndStopFrames:240,shotFrames:121,minSole:min,maxAnchorFrameStep:maxStep,minAir,rigIntact};
 });assert(report.dynamic.rigIntact);assert(report.dynamic.minSole>-.0061);assert(report.dynamic.minAir>.25);assert(report.dynamic.maxAnchorFrameStep<.035);
 report.switching=await page.evaluate(()=>{let peak=0;for(let i=0;i<12;i++){AIBAEquipmentVisuals.applyShoes(subject,{id:'shoes-anchor',color:'#334455'});if(subject.baseShoeKit)throw Error('Old and new shoe both active');AIBAEquipmentVisuals.applyShoes(subject,null);if(!subject.baseShoeKit)throw Error('Default shoe not restored');let n=0;subject.g.traverse(o=>{if(o.name==='base_basketball_shoe')n++;});peak=Math.max(peak,n);if(n!==2)throw Error('Duplicate shoes');}const [l,r]=subject.baseShoeKit.roots.map(a=>a.children[0].children[0]);return {cycles:12,peak,sharedGeometry:l.geometry===r.geometry,sharedMaterial:l.material===r.material};});assert(report.switching.sharedGeometry&&report.switching.sharedMaterial);
 for(const colorway of ['classicRedBlackWhite','royalBlueBlackWhite','purpleBlackWhite','bredDark']){await page.evaluate(colorway=>{subject.g.visible=false;labScene.remove(last);window.last=createBasketballShoe({colorway});labScene.add(last);labScene.getObjectByName('reference046').visible=false;labCamera.left=-.65;labCamera.right=.65;labCamera.top=.82;labCamera.bottom=-.82;labCamera.position.set(2,1.5,2);labCamera.lookAt(0,.15,.24);labCamera.updateProjectionMatrix();},colorway);await save('color-'+colorway);}
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS normalized last, rig identity and visibility restoration; pose contacts recorded for review');await ctx.close();
}finally{await browser.close();}
