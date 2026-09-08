(() => {
 const panel=document.createElement('div');panel.id='codex-audit';panel.style='position:fixed;z-index:999999;right:8px;bottom:8px;background:#101b25e8;color:white;padding:8px;font:12px sans-serif;max-width:620px';
 const output=document.createElement('div');output.textContent='Codex 只读验收 · 已在游戏脚本前静音';panel.append(output);document.body.append(panel);
 // Audit controls must not bubble into the game's charge/release handlers.
 for(const kind of ['pointerdown','pointerup','touchstart','touchend'])panel.addEventListener(kind,e=>e.stopPropagation());
 const frames=n=>new Promise(res=>{const tick=()=>--n<=0?res():requestAnimationFrame(tick);requestAnimationFrame(tick);});
 const save=(name,meta,png)=>fetch('/__audit/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,meta,png})});
 const meta=()=>({time:new Date().toISOString(),version:GAME_VERSION,three:THREE.REVISION,state:G.state,mode:G.mode,cameraMode:CAM.mode,camera:camera.position.toArray(),player:P.pos.toArray(),rim:{intensity:rim.intensity,mask:rim.layers.mask},cameraMask:camera.layers.mask,playerMask:player.g.layers.mask,childMask:player.legs[0].layers.mask,floor:FLOOR_PHYS,grade:AIBAGrade.get?AIBAGrade.get():null,renderSize:[renderer.domElement.width,renderer.domElement.height]});
 async function snap(name,extra){renderer.render(scene,camera);await save(name,{...meta(),...extra},renderer.domElement.toDataURL('image/png'));output.textContent='已保存 '+name;}
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style='font:12px sans-serif;padding:6px;margin:2px';b.onclick=async e=>{e.stopPropagation();b.disabled=true;try{await fn();}catch(err){output.textContent='ERROR '+err.message;console.error(err);}finally{b.disabled=false;}};panel.append(b);}
 async function prep(){
  await AIBATrailer.prepare({camera:1,mode:'contest',player:'k24'});
  RENDER_QUALITY.locked=true;RENDER_QUALITY.min=1;RENDER_QUALITY.max=1.4;RENDER_QUALITY.target=1.2;RENDER_QUALITY.scale=1.2;applyRenderScale(true);
  G.running=false;G.canShoot=false;G.glideCam=false;P.pos.copy(RACKS[1].p);P.face=faceTo(P.pos,HOOP);resetWalkSpeed();
  customCameraSlots[0]={yaw:177*Math.PI/180,pitch:.30,distance:5.5,targetY:1.20};
  customCameraSlots[1]={yaw:Math.PI,pitch:-.20,distance:2.6,targetY:.78};
  panel.style.display='block';await frames(25);output.textContent='准备完成；真实游戏相机；声音屏蔽';
 }
 button('准备验收',prep);
 button('六机位截图',async()=>{for(const [name,mode] of [['follow',1],['broadcast',2],['first',0],['rear177',3],['low',4]]){setCameraMode(mode,{silent:true});await frames(28);await snap('latest-'+name);}P.pos.copy(RACKS[3].p);P.face=faceTo(P.pos,HOOP);setCameraMode(1,{silent:true});await frames(28);await snap('latest-follow-right');});
 button('轮廓光消融',async()=>{P.pos.copy(RACKS[1].p);P.face=faceTo(P.pos,HOOP);setCameraMode(1,{silent:true});await frames(30);const saved={intensity:rim.intensity,mask:rim.layers.mask};try{await snap('layer-baseline');rim.layers.disable(1);await frames(3);await snap('layer-disable1');rim.layers.mask=saved.mask;rim.intensity=0;await frames(3);await snap('layer-rim0');}finally{rim.intensity=saved.intensity;rim.layers.mask=saved.mask;}});
 button('跑动采样',async()=>{
  P.pos.copy(RACKS[0].p);P.face=faceTo(P.pos,RACKS[2].p);resetWalkSpeed();setCameraMode(1,{silent:true});await frames(24);
  const rows=[],marks=new Set(),original=poseRunCycle;poseRunCycle=function(o,s,v,dt,cfg){const value=original(o,s,v,dt,cfg);if(o===player){const d=o.g.userData;rows.push({t:walk&&walk.t,k:walk?walk.t/walk.dur:1,v,dt,phase:s.phase,step:d.runStride,targetStep:d.runTargetStride,cadence:d.runCadence,targetCadence:d.runTargetCadence,decel:d.runDecel,clipPhase:s.runClipPhase,pos:P.pos.toArray(),face:P.face,feet:o.footRoots.map(f=>f.getWorldPosition(new THREE.Vector3()).toArray()),contacts:d.runFootContact,hip:o.legs.map(l=>l.rotation.x),knee:o.knees.map(l=>l.rotation.x),bodyY:o.g.position.y,bodyBob:d.tstageRunBodyBob,ground:d.runFootGround,arms:o.arms.map(a=>a.rotation.x)});}return value;};
  try{walkTo({p:RACKS[2].p},()=>{});let guard=0;while(walk&&guard++<1500){await frames(1);const k=walk?walk.t/walk.dur:1;for(const m of [.20,.45,.65,.80,.90,.96])if(k>=m&&!marks.has(m)){marks.add(m);await snap('run-'+Math.round(m*100),{sample:rows[rows.length-1]});}}await frames(8);await snap('run-arrival');await save('run-samples',{rows});}finally{poseRunCycle=original;}
 });
 button('跑步近景',async()=>{
  await prep();
  customCameraSlots[0]={yaw:1.55,pitch:.18,distance:2.45,targetY:1.08};setCameraMode(3,{silent:true});await frames(20);
  P.pos.copy(RACKS[0].p);P.face=faceTo(P.pos,RACKS[2].p);resetWalkSpeed();
  walkTo({p:RACKS[2].p},()=>{});let guard=0;const marks=new Set();
  while(walk&&guard++<1500){await frames(1);const k=walk?walk.t/walk.dur:1;for(const m of [.45,.80,.94,.98])if(k>=m&&!marks.has(m)){marks.add(m);await snap('run-close-'+Math.round(m*100),{sample:{k}});}}
  await frames(8);await snap('run-close-arrival');
 });
 button('发根与末端采样',async()=>{
  const old=player.hairStyle,oldColor=player.hairMat.color.getHex(),original=updPose;const rows=[];updPose=()=>{};
  try{setCameraMode(3,{silent:true});customCameraSlots[0]={yaw:1.6,pitch:.25,distance:2,targetY:1.55};await frames(20);
   for(const style of ['buzz','afro','cornrows','ponytail','bun','long']){setHair(player,style,0x222222);player.hairPivot.rotation.set(0,0,0);player.hairTail.rotation.set(0,0,0);scene.updateMatrixWorld(true);
    const groups=[player.hairBase,player.hairGrp,player.hairTail],before=groups.map(g=>g.children.map(m=>m.getWorldPosition(new THREE.Vector3())));await snap('hair-'+style+'-rest');
    player.hairPivot.rotation.z=-.038*1.8;player.hairTail.rotation.set(-.038*1.8*.62,0,-.038*1.8*.45);scene.updateMatrixWorld(true);
    rows.push({style,pivot:player.hairPivot.position.toArray(),tailOrigin:player.hairTail.getWorldPosition(new THREE.Vector3()).toArray(),maxDisplacement:groups.map((g,i)=>Math.max(0,...g.children.map((m,j)=>m.getWorldPosition(new THREE.Vector3()).distanceTo(before[i][j]))))});await snap('hair-'+style+'-sway');}
   await save('hair-samples',{rows});
  }finally{setHair(player,old,oldColor);player.hairPivot.rotation.set(0,0,0);player.hairTail.rotation.set(0,0,0);updPose=original;}
 });
 button('出手后旋实测',async()=>{
  await prep();G.practice=true;G.seq=[{rack:1,ball:0,val:1,money:false}];G.shotIdx=0;G.canShoot=true;
  customCameraSlots[0]={yaw:1.5,pitch:.14,distance:4.8,targetY:1.5};setCameraMode(3,{silent:true});await frames(25);
  const original=spinBall,rows=[],marks=new Set();spinBall=function(b,dt,damping){const q=b.mesh.getWorldQuaternion(new THREE.Quaternion()),top=new THREE.Vector3(0,1,0).applyQuaternion(q.clone().invert());original(b,dt,damping);if(b.phase==='fly'){const forward=b.v0.clone().setY(0).normalize();const movement=top.applyQuaternion(b.mesh.getWorldQuaternion(new THREE.Quaternion())).sub(new THREE.Vector3(0,1,0));rows.push({t:b.t,dt,topForwardDelta:movement.dot(forward),omega:b.spinOmega.toArray(),v0:b.v0.toArray(),q:b.mesh.quaternion.toArray(),position:b.mesh.position.toArray()});}};
  try{if(!startCharge())throw Error('startCharge failed');let guard=0;while(G.charging&&G.power<shotIdeal(curShot())&&guard++<600)await frames(1);doRelease();
   for(let i=0;i<450;i++){await frames(1);const b=balls.find(x=>!x.opp);if(b){for(const t of [.15,.30,.60])if(b.t>=t&&!marks.has(t)){marks.add(t);await snap('backspin-'+Math.round(t*100),{sample:rows[rows.length-1]});}if(b.t>1.2)break;}}
   await save('backspin-runtime',{rows});output.textContent='后旋采样完成 '+rows.length+' 帧';
  }finally{spinBall=original;}
 });
 button('观众3分采样',async()=>{
  G.cheer=.6;triggerStreetCrowdReaction('make',3);const rows=[];const start=G.tNow;const marks=new Set();
  for(let i=0;i<260;i++){await frames(1);const t=G.tNow-start;rows.push({t,cheer:G.cheer,reaction:nearCourtCrowd.reaction,people:nearCourtCrowd.people.length});for(const m of [.1,.5,1,2])if(t>=m&&!marks.has(m)){marks.add(m);await snap('crowd-'+Math.round(m*100));}if(t>2.2)break;}
  await save('crowd-samples',{rows});
 });
 button('截图当前',()=>snap('manual-current'));
 const vis=document.createElement('style');vis.textContent='#codex-audit{display:block!important}';document.head.append(vis);
})();
