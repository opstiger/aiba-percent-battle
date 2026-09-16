import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/shoe-last-slope-20260916');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:process.env.AIBA_MOBILE?{width:390,height:844}:{width:720,height:900},isMobile:!!process.env.AIBA_MOBILE,hasTouch:!!process.env.AIBA_MOBILE,deviceScaleFactor:1});await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260911');await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBACrowdLife);
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});

 await page.addScriptTag({path:path.join(root,'tools/shoe-fit-lab.js')});
 await page.evaluate(()=>{
  window.labScene=new THREE.Scene();labScene.background=new THREE.Color(0xc3c3c3);labScene.add(new THREE.HemisphereLight(0xffffff,0x777777,1));const light=new THREE.DirectionalLight(0xffffff,1.25);light.position.set(-3,4,5);labScene.add(light);
  window.labCamera=new THREE.OrthographicCamera(-.65,.65,.82,-.82,.01,30);
  window.subject=rivals[0];applyStarStyle(subject,LEGENDS.find(s=>s.id==='j23'));labScene.add(subject.g);subject.g.visible=false;window.baseRig=['legs','knees','ankles','footRoots','toeRoots','arms','elbows'].flatMap(k=>subject[k].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()})));
  window.last=AIBAShoeFitLab.build({highTop:true});labScene.add(last);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:0xaaaaaa}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.name='labFloor';labScene.add(floor);
 });
 const save=async(name)=>{const data=await page.evaluate(()=>{labScene.updateMatrixWorld(true);labCamera.updateMatrixWorld(true);renderer.render(labScene,labCamera);return renderer.domElement.toDataURL();});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));};
 report.standard=await page.evaluate(()=>{last.geometry.computeBoundingBox();const b=last.geometry.boundingBox,s=b.getSize(new THREE.Vector3());return {LWH:[s.z,s.x,s.y],sections:AIBAShoeFitLab.sections,triangles:last.geometry.attributes.position.count/3};});
 assert(Math.abs(report.standard.LWH[0]-1)<1e-6);assert(Math.abs(report.standard.LWH[1]-.39)<1e-6);assert(Math.abs(report.standard.LWH[2]-.29)<1e-6);report.envelope=await page.evaluate(()=>{const b=new THREE.Box3().setFromObject(last);return {height:b.max.y-b.min.y,width:b.max.x-b.min.x};});assert(Math.abs(report.envelope.height-.46)<1e-6);
 for(const [name,pos]of [['front',[0,.18,3]],['side',[3,.18,.24]],['top',[0,3,.24]],['rear45',[2,1.5,-2]]]){
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
   const before=rigSnapshot();const f=AIBAShoeFitLab.apply(subject,{length});const after=rigSnapshot();
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
    const beforeFit=rigSnapshot();const contacts=AIBAShoeFitLab.sync(subject,{grounded:pose==='jump'?false:pose==='run'?[true,false]:true});if(JSON.stringify(beforeFit)!==JSON.stringify(rigSnapshot()))throw Error('Fit changed skeleton');
    const view=pose==='side'?[3,.95,0]:pose==='rear'?[0,.95,-3]:pose==='front'?[0,.95,3]:[2.6,1.2,3.4];
    labCamera.position.set(...view);labCamera.lookAt(0,pose==='jump'?1.17:.86,.06);labScene.updateMatrixWorld(true);
    return {pose,contacts,minY:subject.footRoots.map(f=>{const m=f.getObjectByName('ShoeLastDebug');return new THREE.Box3().setFromObject(m).min.y;}),rig:rigSnapshot()};
   },pose);
   for(const c of result.contacts)assert(Number.isFinite(c.after));if(pose!=='jump'&&pose!=='run')result.minY.forEach(y=>assert(Math.abs(y)<1e-6));assert(result.minY.every(y=>y>=-1e-5));data.poses.push(result);await save('L'+length.toFixed(2)+'-'+pose);
  }
  report.fits.push(data);
 }
 report.restore=await page.evaluate(()=>{const hidden=subject.shoeFitDebug.hidden.slice();AIBAShoeFitLab.clear(subject);return {visibilityRestored:hidden.every(([m,v])=>m.visible===v),anchors:subject.footRoots.flatMap(f=>f.children.filter(c=>c.name==='ShoeFitAnchor')).length};});assert(report.restore.visibilityRestored);assert.equal(report.restore.anchors,0);
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS normalized last, rig identity and visibility restoration; pose contacts recorded for review');await ctx.close();
}finally{await browser.close();}
