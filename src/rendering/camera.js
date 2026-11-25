const P={pos:V3(0,0,-0.6),face:0,walking:false,walkT:0,jump:0,eyeDip:0};
function faceTo(from,to){return Math.atan2(to.x-from.x,to.z-from.z);}
const CAM_BASE_NAMES=["第一人称","球员跟随","转播视角"];
const CUSTOM_CAMERA_KEY="aiba_custom_camera_views_v1",CUSTOM_CAMERA_COUNT=2;
const CUSTOM_CAMERA_DEFAULT=Object.freeze({yaw:Math.PI,pitch:.22,distance:4.4,targetY:1.12});
const customCameraSlots=[null,null];
let cameraEditor=null;
const cameraFovStack=new Map();
function applyCameraFovStack(){
  if(typeof camera==="undefined")return 0;
  let winner=null;
  cameraFovStack.forEach((entry,owner)=>{
    if(!entry)return;
    if(!winner||entry.priority>winner.priority||(entry.priority===winner.priority&&entry.seq>winner.seq))
      winner={owner,priority:entry.priority,seq:entry.seq,fov:entry.fov};
  });
  const target=winner?winner.fov:fovForAspect(camera.aspect||1);
  if(Number.isFinite(target)&&Math.abs(camera.fov-target)>.01){
    camera.fov=target;camera.updateProjectionMatrix();
  }
  return target;
}
let cameraFovSeq=0;
function requestCameraFov(owner,fov,priority){
  if(!owner||!Number.isFinite(Number(fov)))return false;
  cameraFovStack.set(String(owner),{fov:Number(fov),priority:Number(priority)||0,seq:++cameraFovSeq});
  applyCameraFovStack();return true;
}
function releaseCameraFov(owner){
  if(owner!=null)cameraFovStack.delete(String(owner));
  applyCameraFovStack();return true;
}
/* 机位 5:转播过肩。排在自定义视角(3、4)之后编号,这样已保存的自定义机位编号不变 */
const CAM_SHOULDER=5,CAM_MEADOW_LOW=6,CAM_MEADOW_TELE=7;
const CAM={mode:0,names:CAM_BASE_NAMES.concat(["自定义视角 1","自定义视角 2","转播过肩","草甸低机位","天山长焦"])};
function cameraInPlay(){
  return G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||
    G.state==="rushintro"||G.state==="rushbetween"||G.state==="pregame"||G.state==="lastshot"||
    G.state==="bootshot"||G.state==="resultbeat"||G.state==="victorycine"||G.state==="wincine"||
    G.state==="cinematic";
}
function cameraNum(v,f){return Number.isFinite(Number(v))?Number(v):f;}
function cameraAngle(v){
  const a=cameraNum(v,0),tau=Math.PI*2;
  return ((a+Math.PI)%tau+tau)%tau-Math.PI;
}
function normalizeCustomCameraView(view){
  view=view||{};
  return {
    yaw:cameraAngle(view.yaw),
    pitch:clamp(cameraNum(view.pitch,CUSTOM_CAMERA_DEFAULT.pitch),-.28,1.12),
    distance:clamp(cameraNum(view.distance,CUSTOM_CAMERA_DEFAULT.distance),2.0,12),
    targetY:clamp(cameraNum(view.targetY,CUSTOM_CAMERA_DEFAULT.targetY),.72,2.15)
  };
}
function copyCustomCameraView(view){return view?normalizeCustomCameraView(view):null;}
function loadCustomCameraSlots(){
  try{
    const raw=JSON.parse(localStorage.getItem(CUSTOM_CAMERA_KEY)||"[]");
    if(Array.isArray(raw))raw.slice(0,CUSTOM_CAMERA_COUNT).forEach((v,i)=>{if(v)customCameraSlots[i]=normalizeCustomCameraView(v);});
    else if(raw&&Array.isArray(raw.slots))raw.slots.slice(0,CUSTOM_CAMERA_COUNT).forEach((v,i)=>{if(v)customCameraSlots[i]=normalizeCustomCameraView(v);});
  }catch(e){}
}
function persistCustomCameraSlots(){
  try{localStorage.setItem(CUSTOM_CAMERA_KEY,JSON.stringify(customCameraSlots));}catch(e){}
}
loadCustomCameraSlots();
function customCameraSlotIndex(mode){
  const i=(mode|0)-3;
  return i>=0&&i<CUSTOM_CAMERA_COUNT?i:-1;
}
function activeCustomCameraView(mode){
  const i=customCameraSlotIndex(mode);
  if(i<0)return null;
  if(cameraEditor&&cameraEditor.mode===mode)return cameraEditor.draft;
  return customCameraSlots[i];
}
function availableCameraModes(){
  if(typeof window!=="undefined"&&window.AIBAVisionAim&&window.AIBAVisionAim.active())return [0,1];
  const modes=[0,1,2,CAM_SHOULDER];
  if(currentScenePreset==="flowerCourt")modes.push(CAM_MEADOW_LOW,CAM_MEADOW_TELE);
  customCameraSlots.forEach((v,i)=>{if(v||cameraEditor&&cameraEditor.slot===i)modes.push(3+i);});
  return modes;
}
function cameraModeLabel(mode){
  const i=customCameraSlotIndex(mode);
  if(mode===CAM_SHOULDER||mode===CAM_MEADOW_LOW||mode===CAM_MEADOW_TELE)return CAM.names[mode];
  return i>=0?"自定义视角 "+(i+1):(CAM_BASE_NAMES[mode]||CAM_BASE_NAMES[1]);
}
function setCameraIcon(){
  if(typeof AIBASetIcon==="function")AIBASetIcon("camBtn","camera",cameraModeLabel(CAM.mode));
}
function setCameraMode(mode,options){
  const modes=availableCameraModes();
  CAM.mode=modes.includes(mode)?mode:1;
  if(typeof G!=="undefined"&&G)G._preSuperCam=null;
  setCameraIcon();
  applyCamMode();
  if(typeof document!=="undefined"&&document.activeElement&&typeof document.activeElement.blur==="function"){
    document.activeElement.blur();
  }
  if(!(options&&options.silent)&&typeof blip==="function")blip(700,0.05,"square",0.06);
  return CAM.mode;
}
function cycleCam(){
  const modes=availableCameraModes(),at=Math.max(0,modes.indexOf(CAM.mode));
  setCameraMode(modes[(at+1)%modes.length]);
}
function captureCustomCameraView(){
  const base=P.pos||V3(0,0,0),face=cameraNum(P.face,0);
  const dx=rig.pos.x-base.x,dz=rig.pos.z-base.z;
  const dist=Math.hypot(dx,dz);
  if(!Number.isFinite(dist)||dist<1.55)return copyCustomCameraView(CUSTOM_CAMERA_DEFAULT);
  const targetY=clamp(cameraNum(rig.look.y-base.y,1.12),.72,2.15);
  return normalizeCustomCameraView({
    yaw:Math.atan2(dx,dz)-face,
    pitch:Math.atan2(rig.pos.y-(base.y+targetY),Math.max(.25,dist)),
    distance:dist,
    targetY
  });
}
function customCameraTarget(view){
  const v=normalizeCustomCameraView(view),base=P.pos||V3(0,0,0),face=cameraNum(P.face,0);
  const angle=face+v.yaw,h=Math.cos(v.pitch)*v.distance;
  return {
    x:base.x+Math.sin(angle)*h,
    y:base.y+v.targetY+Math.sin(v.pitch)*v.distance,
    z:base.z+Math.cos(angle)*h,
    lx:base.x,ly:base.y+v.targetY+P.jump*.22,lz:base.z
  };
}
function updateCustomCamera(dt){
  const view=activeCustomCameraView(CAM.mode);
  if(!view)return false;
  const t=customCameraTarget(view);
  camTarget.pos.set(t.x,t.y,t.z);camTarget.look.set(t.lx,t.ly,t.lz);
  if(cameraEditor)rig.pos.copy(camTarget.pos),rig.look.copy(camTarget.look),camSnap=false;
  else dampRig(dt,6.5);
  return true;
}
function editorReadout(){
  if(!cameraEditor)return;
  const v=cameraEditor.draft,el=document.getElementById("customCameraEditorReadout");
  if(!el)return;
  const deg=n=>Math.round(n*180/Math.PI);
  el.textContent="水平 "+deg(v.yaw)+"° · 俯仰 "+deg(v.pitch)+"° · 距离 "+v.distance.toFixed(1);
}
function applyEditorCamera(){
  if(!cameraEditor)return;
  updateCustomCamera(0);editorReadout();
}
function removeCameraEditor(){
  const el=document.getElementById("customCameraEditor");if(el)el.remove();
}
function reopenSettingsAfterCameraEdit(edit){
  if(edit&&edit.returnToSettings&&window.AIBAPerfSettings&&AIBAPerfSettings.reopen)AIBAPerfSettings.reopen();
}
function finishCustomCameraEdit(saved){
  const edit=cameraEditor;if(!edit)return;
  if(saved){
    customCameraSlots[edit.slot]=normalizeCustomCameraView(edit.draft);persistCustomCameraSlots();
    cameraEditor=null;removeCameraEditor();
    CAM.mode=3+edit.slot;setCameraIcon();applyCamMode();
  }else{
    cameraEditor=null;removeCameraEditor();
    const modes=availableCameraModes();
    CAM.mode=modes.includes(edit.previousMode)?edit.previousMode:1;
    setCameraIcon();applyCamMode();
  }
  camSnap=true;reopenSettingsAfterCameraEdit(edit);
}
function beginCustomCameraEdit(slot,returnToSettings){
  slot=Math.max(0,Math.min(CUSTOM_CAMERA_COUNT-1,slot|0));
  if(cameraEditor)finishCustomCameraEdit(false);
  if(typeof hidePanel==="function")hidePanel();
  const previousMode=CAM.mode;
  const initialView=customCameraSlots[slot]||(cameraInPlay()?captureCustomCameraView():CUSTOM_CAMERA_DEFAULT);
  cameraEditor={slot,mode:3+slot,draft:copyCustomCameraView(initialView),previousMode,
    returnToSettings:returnToSettings!==false,dragging:false,pointerId:null,lastX:0,lastY:0};
  CAM.mode=3+slot;setCameraIcon();applyCamMode();
  // 菜单/难度页没有 inPlay 标记，调镜时仍要让人物作为真实取景对象出现。
  if(player&&player.g)player.g.visible=true;
  if(hands)hands.visible=false;
  mountCameraEditor(slot);applyEditorCamera();
}
function mountCameraEditor(slot){
  removeCameraEditor();
  const el=document.createElement("div");el.id="customCameraEditor";el.innerHTML=`
    <div class="customCameraEditorSurface" aria-label="自定义视角拖动区域">
      <div class="customCameraEditorHint"><small>CUSTOM CAMERA ${slot+1}</small><b>拖动屏幕旋转视角</b><span>水平拖动可 360° 环绕；上下拖动调整俯仰，滚轮调整距离。</span><em id="customCameraEditorReadout"></em></div>
      <div class="customCameraEditorActions">
        <button class="btn gold" type="button" onclick="AIBACameraSaveEditing()">保存到视角 ${slot+1}</button>
        <button class="btn" type="button" onclick="AIBACameraCancelEditing()">取消</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const surface=el.querySelector(".customCameraEditorSurface");
  const stopDrag=event=>{
    if(!cameraEditor)return;
    if(cameraEditor.pointerId!=null&&event.pointerId!=null&&event.pointerId!==cameraEditor.pointerId)return;
    cameraEditor.dragging=false;cameraEditor.pointerId=null;
  };
  surface.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;
    cameraEditor.dragging=true;cameraEditor.pointerId=event.pointerId;cameraEditor.lastX=event.clientX;cameraEditor.lastY=event.clientY;
    if(surface.setPointerCapture)surface.setPointerCapture(event.pointerId);event.preventDefault();
  });
  surface.addEventListener("pointermove",event=>{
    if(!cameraEditor||!cameraEditor.dragging||event.pointerId!==cameraEditor.pointerId)return;
    const dx=event.clientX-cameraEditor.lastX,dy=event.clientY-cameraEditor.lastY;
    cameraEditor.lastX=event.clientX;cameraEditor.lastY=event.clientY;
    cameraEditor.draft.yaw=cameraAngle(cameraEditor.draft.yaw+dx*.012);
    cameraEditor.draft.pitch=clamp(cameraEditor.draft.pitch-dy*.009,-.28,1.12);
    applyEditorCamera();event.preventDefault();
  });
  surface.addEventListener("pointerup",stopDrag);surface.addEventListener("pointercancel",stopDrag);surface.addEventListener("pointerleave",event=>{if(!surface.hasPointerCapture||!surface.hasPointerCapture(event.pointerId))stopDrag(event);});
  surface.addEventListener("wheel",event=>{
    if(!cameraEditor)return;
    cameraEditor.draft.distance=clamp(cameraEditor.draft.distance+event.deltaY*.006,2,12);applyEditorCamera();event.preventDefault();
  },{passive:false});
}
function saveEditing(){finishCustomCameraEdit(true);}
function cancelEditing(){finishCustomCameraEdit(false);}
function refreshCameraSettings(){
  if(document.querySelector(".perfPanel")&&window.AIBAPerfSettings&&AIBAPerfSettings.reopen)AIBAPerfSettings.reopen();
}
function useCustomCameraSlot(slot){
  slot=Math.max(0,Math.min(CUSTOM_CAMERA_COUNT-1,slot|0));
  if(!customCameraSlots[slot])return false;
  setCameraMode(3+slot);refreshCameraSettings();return true;
}
function clearCustomCameraSlot(slot){
  slot=Math.max(0,Math.min(CUSTOM_CAMERA_COUNT-1,slot|0));
  customCameraSlots[slot]=null;persistCustomCameraSlots();
  if(CAM.mode===3+slot)setCameraMode(1,{silent:true});
  if(typeof toast==="function")toast("已清除自定义视角 "+(slot+1),"#9fb4cd");
  refreshCameraSettings();
}
function customCameraSettingsMarkup(){
  const cards=customCameraSlots.map((view,i)=>{
    const saved=!!view,active=CAM.mode===3+i;
    return `<div class="customCameraSlot ${saved?"saved":""} ${active?"active":""}">
      <div class="customCameraSlotHead"><b>视角 ${i+1}</b><span>${active?"当前使用":(saved?"已保存":"空槽位")}</span></div>
      <p>${saved?"已记住水平、俯仰、距离，可随时切换。":"保存一个跟随球员的环绕视角。"}</p>
      <div class="customCameraSlotActions"><button class="btn sm gold" type="button" onclick="AIBACameraBeginEdit(${i})">${saved?"重新调整":"调整并保存"}</button>${saved?`<button class="btn sm" type="button" onclick="AIBACameraUse(${i})">使用</button><button class="btn sm danger" type="button" onclick="AIBACameraClear(${i})">清除</button>`:""}</div>
    </div>`;
  }).join("");
  return `<section class="customCameraSettings"><div class="customCameraSettingsHead"><b>自定义视角</b><span>自由 360° 拖动，最多记住 2 个</span></div><div class="customCameraSlotGrid">${cards}</div><p class="customCameraSettingsNote">进入调镜后直接拖动比赛画面；保存后会加入右上角镜头切换循环，并随球员位置跟随。</p></section>`;
}
function applyCamMode(){
  const inPlay=cameraInPlay();
  hands.visible=CAM.mode===0&&inPlay;
  player.g.visible=CAM.mode!==0&&inPlay;
  const support=G.mode==="battle"||G.mode==="lastshot"||
    (G.mode==="rackrush"&&!!G.rush?.supply)||
    ["pregame","bootshot","wincine","victorycine"].includes(G.state)||
    (typeof passing!=="undefined"&&passing&&!passing.pickup);
  passer.g.visible=inPlay&&!!support;
  oppPasser.g.visible=inPlay&&G.mode==="battle";
  $("camBtn").style.display=inPlay?"block":"none";
  if(CAM.mode!==CAM_MEADOW_TELE||currentScenePreset!=="flowerCourt"){
    releaseCameraFov("meadowTele");
    if(typeof camera!=="undefined"&&camera&&camera.userData&&!meadowIntro.on){
      camera.userData.meadowTele=false;
      camera.userData.meadowTeleIntro=false;
    }
  }
  camSnap=true; // 切换机位时下一帧硬切,避免跨场平滑造成大幅扫镜
  benchVis();
}
function eyePos(){
  const d=V3(Math.sin(P.face),0,Math.cos(P.face));
  return V3(P.pos.x-d.x*0.25,
    EYE+P.eyeDip+P.jump+(P.walking?Math.sin(P.walkT*1.1)*0.05:0),
    P.pos.z-d.z*0.25);
}
/* 自适应取景:用球员全身+篮筐/篮板包围点反推相机距离,不再为中场写死镜头 */
const _afCenter=new THREE.Vector3(),_afMin=new THREE.Vector3(),_afMax=new THREE.Vector3();
const _afBack=new THREE.Vector3(),_afForward=new THREE.Vector3(),_afRight=new THREE.Vector3(),_afUp=new THREE.Vector3();
const _afTmp=new THREE.Vector3(),_afPts=[];
function afAdd(x,y,z){_afPts.push(V3(x,y,z));}
function autoFrameCam(rig,pPos,pJump,faceDir,opts){
  opts=opts||{};
  _afPts.length=0;
  const dir=_afTmp.set(faceDir.x,0,faceDir.z);
  if(dir.lengthSq()<0.001)dir.set(0,0,-1);
  dir.normalize();
  const perp=V3(dir.z,0,-dir.x);
  // 固定取景侧:始终取球员朝向篮筐时的同一侧,篮筐稳定停在屏幕同一边,不再左右翻转
  const side=opts.side!=null?opts.side:1;
  const shoeY=Math.max(0,pJump);
  const headY=1.9+pJump;
  const bodyW=0.48,bodyD=0.34;
  // 球员全身包围盒:脚、肩、头都纳入,避免竖屏时人物被左右/上下切掉。
  [-1,1].forEach(a=>[-1,1].forEach(b=>{
    const x=pPos.x+perp.x*a*bodyW+dir.x*b*bodyD;
    const z=pPos.z+perp.z*a*bodyW+dir.z*b*bodyD;
    afAdd(x,shoeY,z);afAdd(x,1.18+pJump,z);afAdd(x,headY,z);
  }));
  // 篮筐 + 篮板的大致包围点。篮板比篮筐更宽更高,必须一起装进画面。
  [-1.12,1.12].forEach(x=>[2.62,3.88].forEach(y=>afAdd(HOOP.x+x,y,HOOP.z-0.48)));
  [-0.46,0.46].forEach(x=>[-0.18,0.18].forEach(z=>afAdd(HOOP.x+x,HOOP.y,HOOP.z+z)));
  _afMin.set(Infinity,Infinity,Infinity);_afMax.set(-Infinity,-Infinity,-Infinity);
  _afPts.forEach(p=>{_afMin.min(p);_afMax.max(p);});
  _afCenter.addVectors(_afMin,_afMax).multiplyScalar(0.5);
  _afCenter.y+=opts.lookLift||0.08;
  // 从球员侧后方斜看,但距离由视锥计算得出。转播视角略高、略侧。
  // Along the rainforest's left sideline, keep the broadcast rig inside the clearing.
  const lateralRoom=opts.broadcast&&currentScenePreset==="rainforest"
    ? THREE.MathUtils.smoothstep(pPos.x,-6.5,-.8) : 1;
  const sideK=opts.sideK!=null?opts.sideK:(opts.broadcast?0.62:0.44);
  const backK=opts.backK!=null?opts.backK:(opts.broadcast?0.67:0.82);
  const heightK=opts.heightK!=null?opts.heightK:(opts.broadcast?0.34:0.25);
  _afBack.set(-dir.x*backK+perp.x*side*sideK*lateralRoom,heightK,-dir.z*backK+perp.z*side*sideK*lateralRoom).normalize();
  _afForward.copy(_afBack).negate();
  _afRight.crossVectors(_afForward,V3(0,1,0)).normalize();
  _afUp.crossVectors(_afRight,_afForward).normalize();
  const vFov=(Number.isFinite(camera.fov)&&camera.fov>1?camera.fov:68)*Math.PI/180;
  const aspect=camera.aspect||(innerWidth/innerHeight)||1;
  const safeAspect=Number.isFinite(aspect)&&aspect>0.05?aspect:1;
  const hFov=2*Math.atan(Math.tan(vFov/2)*safeAspect);
  const tanH=Math.tan(hFov/2),tanV=Math.tan(vFov/2);
  const safeTanH=Number.isFinite(tanH)&&Math.abs(tanH)>0.001?Math.abs(tanH):0.5;
  const safeTanV=Number.isFinite(tanV)&&Math.abs(tanV)>0.001?Math.abs(tanV):0.5;
  const marginX=opts.marginX||1.32,marginY=opts.marginY||1.24;
  let dist=0;
  _afPts.forEach(p=>{
    _afTmp.copy(p).sub(_afCenter);
    const x=_afTmp.dot(_afRight),y=_afTmp.dot(_afUp),z=_afTmp.dot(_afForward);
    dist=Math.max(dist,Math.abs(x)*marginX/safeTanH-z,Math.abs(y)*marginY/safeTanV-z);
  });
  if(!Number.isFinite(dist))dist=opts.minDist||5.2;
  dist=clamp(dist+(opts.pad==null?.45:opts.pad),opts.minDist||5.2,opts.maxDist||30);
  if(Number.isFinite(dist)&&Number.isFinite(_afCenter.x)){
    rig.pos.copy(_afCenter).addScaledVector(_afBack,dist);
    rig.look.copy(_afCenter);
  }
}
/* 转播过肩机位:摄像师站在球员侧后方,越过肩膀把人和篮筐框在一起。
   两个特点:1) 跟人很慢——球员换点时镜头是"摇过去"而不是"跳过去";
            2) 站定时也不静止——像肩扛摄像机一样缓慢地横移、起伏、推拉(三个互不成倍数的慢周期,不会看出循环)。
   球在空中时视线略微跟着球抬一点。 */
const SHOULDER_CAM={t:0,side:1,sideK:1,lift:0};
function updateShoulderCamera(dt){
  const S=SHOULDER_CAM;S.t+=dt;
  /* 站在哪一侧:球员在场地右半边时摄像师在他右后方(画面里人在右、篮筐在左),反之亦然;过中线附近不来回跳 */
  if(P.pos.x>.8)S.side=1;else if(P.pos.x<-.8)S.side=-1;
  S.sideK+=(S.side-S.sideK)*(1-Math.exp(-1.1*dt));
  const dir=_shBack.set(HOOP.x-P.pos.x,0,HOOP.z-P.pos.z);const dist=Math.max(.5,dir.length());dir.multiplyScalar(1/dist);
  const rx=-dir.z,rz=dir.x;                          // 球员的右手方向(面朝篮筐)
  const far=clamp((dist-6)/9,0,1);
  /* 机位:身后 2.3~2.9 米、侧移 .8 米、比头顶略高 —— 肩膀和后脑在画面一角,篮筐在画面中间 */
  const back=2.3+.6*far,side=.82*S.sideK,h=1.98+.25*far+P.jump*.3;
  /* 缓慢漂移:横移、起伏、推拉,三个互不成倍数的慢周期,站定时也像肩扛摄像机一样在呼吸 */
  const t=S.t,sway=Math.sin(t*.31)*.22+Math.sin(t*.173+1.3)*.1,bob=Math.sin(t*.23+.7)*.07+Math.sin(t*.127)*.035,dolly=Math.sin(t*.151+2.1)*.25;
  camTarget.pos.set(P.pos.x-dir.x*(back+dolly)+rx*(side+sway),h+bob,P.pos.z-dir.z*(back+dolly)+rz*(side+sway));
  /* 视线:落在球员和篮筐之间偏篮筐的位置,两者都在画面里 */
  const k=.62;
  let lift=0;
  if(typeof balls!=="undefined"&&balls.length){
    const fb=balls[balls.length-1];
    if(fb&&fb.mesh&&(fb.phase==="fly"||(fb.phase==="path"&&fb.t<fb.tf)))lift=clamp((fb.mesh.position.y-HOOP.y)*.25,0,.8);
  }
  S.lift+=(lift-S.lift)*(1-Math.exp(-3*dt));
  camTarget.look.set(P.pos.x+(HOOP.x-P.pos.x)*k-rx*sway*.2,1.55+(HOOP.y-1.55)*.55+S.lift,P.pos.z+(HOOP.z-P.pos.z)*k-rz*sway*.2);
  /* 跟得很慢:换点时镜头是摇过去的,不是跳过去的 */
  dampRig(dt,G.moving||P.walking?2.2:1.6);
}
const _shBack=V3(0,0,1);
let fpLookY=null;
const _fpBall=V3(0,0,0);
// 举球到顶时相机相对眼睛下压的幅度;0.46 让相机落到球心下方约 0.2,刚好仰视球看到手背。
/* 第一人称相机高度。FP_RISE 是"眼睛之上"的抬升量，FP_BALL_DUCK 是举球时的下压量。
   两者必须一起调：举球到位的最终高度 = EYE + FP_RISE - FP_BALL_DUCK，这个值(1.60m)
   是已经调好的投篮取景，不能动。
   FP_RISE 原本 0.28 → 不举球时相机 2.06m，比防守人头顶(1.84m)还高，
   所以投完球对方扑上来只能看到头发、接球时手也被压出画面下缘。
   降到 0.05 后不举球是 1.83m(基本就是眼高)，DUCK 同步 0.46→0.23 保持举球取景不变。 */
const FP_RISE=0.05,FP_BALL_DUCK=0.23;
function updPlayCam(dt){
  dt=dt||0.016;
  const d=V3(Math.sin(P.face),0,Math.cos(P.face));
  // 百分大战按站位动态取景,中场这种极端距离也要把人物+篮筐一起框住。
  const isBattle=G.mode==="battle";
  const isRush=G.mode==="rackrush";
  const aimOn=!!(typeof window!=="undefined"&&window.AIBAVisionAim&&window.AIBAVisionAim.active());
  const aimYaw=aimOn&&typeof window.AIBAVisionAim.yawRad==="function"?window.AIBAVisionAim.yawRad():0;
  if(aimOn&&CAM.mode!==0&&CAM.mode!==1){CAM.mode=1;setCameraIcon();applyCamMode();}
  const isContest=G.mode==="contest";
  if((CAM.mode===CAM_MEADOW_LOW||CAM.mode===CAM_MEADOW_TELE)&&currentScenePreset!=="flowerCourt"){
    CAM.mode=1;setCameraIcon();applyCamMode();
  }
  if(CAM.mode!==CAM_MEADOW_TELE){
    if(cameraFovStack.has("meadowTele"))releaseCameraFov("meadowTele");
    if(typeof camera!=="undefined"&&camera&&camera.userData&&!meadowIntro.on){
      camera.userData.meadowTele=false;
      camera.userData.meadowTeleIntro=false;
    }
  }
  if(CAM.mode===0){
    // 第一人称:略微后拉抬高(身体网格在本视角隐藏,不会入画);
    // 球出手后镜头随球高度平滑抬升,保证高弧线在空中全程可见
    const e=eyePos();
    /* 举球到位时相机要让回到球下方。原本恒定 +0.28 会让眼线高过球心(实测相机 2.51 / 球 2.34),
       变成低头看自己的手:投篮手在球的后下方,于是整只手被球挡死,永远看不到手背。
       真实投篮里球是过额头的,眼睛仰视球、从球下缘看到手背和手指。
       这里按球心相对眼睛的高度平滑下压:球在腰间时完全不变(保持原取景),
       球升到眼睛附近才压下去,避免影响非举球阶段的手感。 */
    let fpRise=FP_RISE;
    if(typeof pBall!=="undefined"&&pBall&&(G.canShoot||G.charging)){
      pBall.getWorldPosition(_fpBall);
      const rel=_fpBall.y-e.y;
      /* 原曲线只在球快到眼睛高度时才介入(rel>-0.25)，导致刚接到球、球还在腰腹
         高度(rel≈-0.63)时相机完全不下压，投篮手被压在画面下缘外。
         区间放宽到 rel∈[-0.95, 0.14]：持球时已下压约 29%，举球到位仍是满值，
         保证最终高度精确落回 1.60m 的既有投篮取景。 */
      fpRise-=clamp((rel+0.95)/1.09,0,1)*FP_BALL_DUCK;
    }
    rig.pos.set(e.x-d.x*0.85,e.y+fpRise,e.z-d.z*0.85);
    let fpTarget=HOOP.y+0.15;
    if(typeof balls!=="undefined"&&balls.length){
      const fb=balls[balls.length-1];
      if(fb&&(fb.phase==="fly"||(fb.phase==="path"&&fb.t<fb.tf))&&fb.mesh)fpTarget=Math.max(fpTarget,HOOP.y+0.15+(fb.mesh.position.y-HOOP.y)*0.5);
    }
    fpLookY=fpLookY==null?fpTarget:fpLookY+(fpTarget-fpLookY)*Math.min(1,dt*7);
    if(aimYaw){
      const cs=Math.cos(aimYaw),sn=Math.sin(aimYaw),hx=HOOP.x-e.x,hz=HOOP.z-e.z;
      rig.look.set(e.x+hx*cs+hz*sn,fpLookY,e.z-hx*sn+hz*cs);
    }else{
      rig.look.set(HOOP.x,fpLookY,HOOP.z);
    }
    /* 取球时视线要真的转向球架。第一人称的 look 一直死盯 HOOP,
       所以身体转过去了、镜头没动 —— 玩家在 FP 下永远看不到架子,
       球仍然是"凭空出现在手里"。这里按取球进度把视线朝球(还在架上)插过去,
       0.85 的上限保证篮筐不会完全出画,收球时自己插回来。 */
    const reach=Number(G.pickupReach)||0;
    if(reach>0.001&&G.passCatch&&G.passCatch.target)
      rig.look.lerp(G.passCatch.target,Math.min(.85,reach*.85));
    camSnap=true;
  }else if(CAM.mode===1){
    if(aimOn){
      // 体感瞄准第三人称正背后视角：以球员自身为中心中轴左右微转，人物始终保持在画面中轴
      const cs=Math.cos(aimYaw),sn=Math.sin(aimYaw);
      const rx=d.x*cs+d.z*sn,rz=-d.x*sn+d.z*cs;
      camTarget.pos.set(P.pos.x-rx*2.95,2.15+P.jump*0.4,P.pos.z-rz*2.95);
      camTarget.look.set(P.pos.x+rx*3.2,1.72+P.jump*0.45,P.pos.z+rz*3.2);
      dampRig(dt,7);
    }else if(isBattle||isRush||isContest){
      // 投篮机同款低位越肩球员锁定镜头；百分大战会随距离平滑拉远。
      updatePlayerLockCamera(dt);
    }else{
      camTarget.pos.set(P.pos.x-d.x*2.85,2.18+P.jump*0.4,P.pos.z-d.z*2.85);
      camTarget.look.set(P.pos.x+d.x*2.45,1.66+P.jump*0.5,P.pos.z+d.z*2.45);
      dampRig(dt,6);
    }
  }else if(CAM.mode===CAM_SHOULDER){
    updateShoulderCamera(dt);
  }else if(CAM.mode===CAM_MEADOW_LOW){
    const dx=HOOP.x-P.pos.x,dz=HOOP.z-P.pos.z;
    const distance=Math.max(1,Math.hypot(dx,dz)),back=4.55;
    const smooth=THREE.MathUtils.smoothstep;
    // At the corners, approach from the baseline side to clear the sideline spectators.
    const side=2.65*(1-2*smooth(P.pos.x,1.8,4.3))*(1-2*smooth(Math.abs(P.pos.x),6.05,7.18));
    const x=P.pos.x-(dx*back+dz*side)/distance,z=P.pos.z+(-dz*back+dx*side)/distance;
    const field=environmentRoot.userData.placeState?.meadow?.court;
    camTarget.pos.set(x,(field?.heightAt(x,z)||0)+.42,z);
    camTarget.look.copy(P.pos).lerp(HOOP,.36);
    camTarget.look.y=1.75+P.jump*.14;
    dampRig(dt,6.6);
  }else if(CAM.mode===CAM_MEADOW_TELE){
    // Upgraded Xinjiang "天山长焦" telephoto compression shooting camera:
    // Elevated athletic broadcast height (~1.95m), smart North-Mountain-Corridor framing across all 5 racks
    // (zero bench spectators / fence posts blocking corners, every rack frames player + hoop + colossal Golden Snow Peak),
    // and dynamic shot-arc vertical tracking so high-arcing shots stay cleanly inside the frame.
    const dx=HOOP.x-P.pos.x,dz=HOOP.z-P.pos.z;
    const distance=Math.max(1,Math.hypot(dx,dz));
    const ux=dx/distance,uz=dz/distance;
    const smooth=THREE.MathUtils.smoothstep;
    let flightBreath=0,ballLift=0;
    if(typeof balls!=="undefined"&&balls.length){
      const fb=balls[balls.length-1];
      if(fb&&fb.mesh&&(fb.phase==="fly"||(fb.phase==="path"&&fb.t<fb.tf))){
        flightBreath=smooth(fb.t||0,.04,.42)*(1-smooth(fb.t||0,.78,1.28));
        ballLift=clamp((fb.mesh.position.y-HOOP.y)*.42,0,1.45);
      }
    }
    const aspect=camera.aspect||1;
    const portrait=aspect<0.85;
    const cornerK=smooth(Math.abs(P.pos.x),2.6,6.6);
    // Keep the telephoto camera cleanly inside the open south meadow corridor (|x| <= 9.35m, inside the |x|>=10m
    // sideline spectator & bench ring!) while pulling deeper south at corners so ALL 5 racks frame
    // player + wooden hoop + colossal Xinjiang Golden Snow Peak with ZERO foreground obstructions!
    const northBlend=cornerK*0.72;
    let vx=ux*(1-northBlend),vz=uz*(1-northBlend)-northBlend;
    const vLen=Math.hypot(vx,vz)||1;
    vx/=vLen;vz/=vLen;
    const rx=-vz,rz=vx;

    const baseFov=fovForAspect(aspect);
    const deskFov=clamp(2*Math.atan(Math.tan(baseFov*Math.PI/360)/2.85)*180/Math.PI,22.5,27.0);
    const portFov=THREE.MathUtils.lerp(30.5,46.0,cornerK*cornerK);
    const teleBase=portrait?portFov:deskFov;
    const teleFov=clamp(teleBase-flightBreath*1.4,21.0,46.5);
    // Deeper pullback at corners keeps the horizontal angle between corner player & hoop tight inside narrow portrait screens!
    const baseBack=portrait?THREE.MathUtils.lerp(13.8,16.8,cornerK):THREE.MathUtils.lerp(14.2,16.2,cornerK);
    const back=baseBack*(Math.tan(teleBase*Math.PI/360)/Math.tan(teleFov*Math.PI/360));
    const side=1.35*(1-cornerK)*(1-2*smooth(P.pos.x,2.6,5.8));
    const rawX=P.pos.x-vx*back+rx*side;
    const x=clamp(rawX,-9.35,9.35);
    const z=P.pos.z-vz*back+rz*side;
    const field=environmentRoot.userData.placeState?.meadow?.court;
    const groundY=field?.heightAt?field.heightAt(x,z):0;
    const camHeight=THREE.MathUtils.lerp(1.92,2.24,cornerK)+P.jump*0.10;
    camTarget.pos.set(x,groundY+camHeight,z);
    // Center gaze cleanly between player and hoop so both stay comfortably framed with soaring Golden Snow Peak above.
    const lookK=THREE.MathUtils.lerp(0.46,0.45,cornerK);
    camTarget.look.copy(P.pos).lerp(HOOP,lookK);
    camTarget.look.x-=rx*(0.32*(1-cornerK));
    camTarget.look.z-=rz*(0.32*(1-cornerK));
    camTarget.look.y=THREE.MathUtils.lerp(2.78,2.62,cornerK)+P.jump*0.12+ballLift;
    requestCameraFov("meadowTele",teleFov,25);
    if(camera&&camera.userData){
      camera.userData.meadowTele=true;
      camera.userData.meadowTeleIntro=false;
    }
    // Smooth lateral tracking during rack walks creates Queenstown foreground-vs-mountain motion parallax.
    dampRig(dt,G.moving||P.walking?3.0:5.6);
  }else if(CAM.mode>=3&&CAM.mode<3+CUSTOM_CAMERA_COUNT&&activeCustomCameraView(CAM.mode)){
    updateCustomCamera(dt);
  }else{
    if(isBattle){
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.46,marginY:1.34,minDist:6,maxDist:34,lookLift:0.18,pad:.62});
      dampRig(dt,4.5);
    }else if(isRush){
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.24,marginY:1.2,minDist:5.4,maxDist:20,lookLift:-.12,pad:.3});
      dampRig(dt,5.2);
    }else{
      // 三分大赛/练习转播视角:自适应取景,深远彩球点也能框住球员+篮筐全程
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.4,marginY:1.3,minDist:7.5,maxDist:30,lookLift:0.2,pad:.8,heightK:.52});
      dampRig(dt,5);
    }
  }
  if(typeof window!=="undefined"&&window.AIBAVisionAim&&typeof window.AIBAVisionAim.updateArc==="function"){
    window.AIBAVisionAim.updateArc();
  }
}
// The flight camera owns its visual effects while live play or replay is active.
let cosmicView=null;
function beginCosmicView(){
  const roof=currentScenePreset==="indoor"?["arenaCeiling","arenaCeilingLamps","centerHungScoreboard"]
    .map(name=>indoorRoot.getObjectByName(name)).filter(Boolean):[];
  const forestReveal=environmentRoot.userData.placeState?.rainforest?.uniforms.forestCourtReveal;
  cosmicView={preset:currentScenePreset,far:camera.far,roof:roof.map(mesh=>[mesh,mesh.visible]),forestReveal,yaw:0};
  cosmicGroundFX.prepare(currentScenePreset);
  if(camera.far<520){camera.far=520;camera.updateProjectionMatrix();}
  window.AIBAVisionAim?.updateArc();
}
function endCosmicView(){
  if(!cosmicView)return;
  stopCosmicWind();
  cosmicGroundFX.endView();
  releaseCameraFov("cosmic");
  for(const [mesh,visible] of cosmicView.roof)mesh.visible=visible;
  if(cosmicView.forestReveal)cosmicView.forestReveal.value=0;
  if(currentScenePreset===cosmicView.preset&&camera.far!==cosmicView.far){
    camera.far=cosmicView.far;camera.updateProjectionMatrix();
  }
  cosmicView=null;
  if(!rep.on)applyCamMode();
}
function updateCosmicCamera(ball,dt,interactive=true){
  if(!cosmicView)beginCosmicView();
  const p=ball.mesh.position,t=ball.t;
  const apex=AIBABallPhysics.COSMIC_APEX_T,drop=AIBABallPhysics.COSMIC_DROP_T;
  const smooth=THREE.MathUtils.smoothstep,mix=THREE.MathUtils.lerp;
  const down=smooth(t,.36,apex-.10),high=smooth(p.y,14,110);
  hands.visible=false;player.g.visible=true;
  const faceYaw=interactive?(window.AIBAVisionAim?.cinematicYawRad()||0):0;
  cosmicView.yaw+=(faceYaw-cosmicView.yaw)*(1-Math.exp(-dt*6));
  const pan=cosmicView.yaw*high*down;
  const impact=ball.groundImpact,age=impact?t-impact.t:-Infinity;
  const overviewEnd=apex+.95,terminalStart=drop-COSMIC_FINAL_FALL_LEAD;
  let fov;
  if(t<overviewEnd){
    // Keep the downward reveal long enough to read the whole court.
    const bearing=.50-.28*down+pan*.8;
    const pitch=mix(-.13,1.465,down);
    const distance=mix(3.8,5.8,down)+4.4*smooth(t,apex,apex+1.05);
    const back=distance*Math.cos(pitch);
    const eyeY=p.y+distance*Math.sin(pitch);
    rig.pos.set(p.x+Math.sin(bearing)*back,eyeY,p.z+Math.cos(bearing)*back);
    const summitFov=Math.max(25,2*Math.atan(.115/camera.aspect)*180/Math.PI);
    fov=mix(fovForAspect(camera.aspect),summitFov,down);
    const viewPitch=pitch+Math.atan(down*.23*Math.tan(fov*Math.PI/360));
    rig.look.set(-Math.sin(bearing)*Math.cos(viewPitch),-Math.sin(viewPitch),
      -Math.cos(bearing)*Math.cos(viewPitch)).multiplyScalar(100).add(rig.pos);
    cosmicView.shot="overview";
  }else if(t<terminalStart){
    // Chase from above and to the side. The orbit accelerates as the court grows below.
    const dive=clamp((t-overviewEnd)/(terminalStart-overviewEnd),0,1);
    const bearing=.42+2.25*dive**1.28+pan*.36;
    const radius=mix(7.4,3.9,dive);
    rig.pos.set(p.x+Math.sin(bearing)*radius,p.y+mix(8.0,2.9,dive),p.z+Math.cos(bearing)*radius);
    rig.look.copy(p).y-=mix(1.8,.60,dive);
    fov=mix(47,63,dive)+(camera.aspect<1?8:0);
    cosmicView.shot="spiral";
  }else{
    // Cut to the court side of the hoop and travel down with the ball.
    const closing=1-smooth(p.y,3.0,21);
    const settle=smooth(age,0,.78);
    const bearing=mix(-.88,-.50,closing)+.36*settle;
    const radius=mix(4.45,3.15,closing)-.38*settle;
    const kick=age>=0?.16*Math.sin(44*age)*Math.exp(-age*11):0;
    const x=age>=0?impact.x:p.x,z=age>=0?impact.z:p.z;
    const y=age>=0?AIBABallPhysics.GEOM.ballR:p.y;
    rig.pos.set(x+Math.sin(bearing)*radius,y+mix(2.4,1.0,closing)+.66*settle+kick,
      z+Math.cos(bearing)*radius);
    rig.look.set(x,y+.26*closing-.37*settle,z);
    fov=mix(59,48,closing)+2*settle+(camera.aspect<1?8:0);
    cosmicView.shot=age<0?"net":"impact";
  }
  requestCameraFov("cosmic",fov,80);
  for(const [mesh,visible] of cosmicView.roof){
    const below=mesh.name==="centerHungScoreboard"?9:20;
    mesh.visible=visible&&rig.pos.y<below;
  }
  if(cosmicView.forestReveal){
    cosmicView.forestReveal.value=down*THREE.MathUtils.smoothstep(rig.pos.y,10,17);
  }

  if(!cosmicView.launched){
    cosmicView.launched=true;
    if(t<.27)playCosmicCue("launch");
  }
  if(age>=0&&!cosmicView.impacted){
    cosmicView.impacted=true;
    stopCosmicWind();
    playCosmicCue("impact");
  }
  // Wind intensity follows the vertical motion and stops at the physical contact.
  const ascent=Math.sin(Math.PI*clamp(t/apex,0,1));
  const descent=clamp((t-apex)/(drop-apex),0,1);
  updateCosmicWind(age>=0?0:Math.max(ascent*.84,descent),Math.sin(Math.atan2(rig.pos.x-p.x,rig.pos.z-p.z)));
  cosmicGroundFX.sample(age,impact,currentScenePreset,ball.mesh);
}

/* 新疆草甸开场运镜（皇后镇低机位长焦横移视差 + 希区柯克推拉变焦）：
   在真实游戏场景中实时运行，前段贴草掠过近景木栅栏与野草（近掠远不动），
   后段按 d(t)·tan(FOV(t)/2) = const 锁住球员体量，把远处日照金山拉到眼前，随后丝滑交还稳定投篮机位。 */
const meadowIntro={
  on:false,t:0,dur:5.4,cb:null,endPos:null,endLook:null,endFov:null,skipEl:null,keyHandler:null,prevPlayerVis:true
};
function meadowIntroSkipUI(show){
  if(typeof document==="undefined")return;
  if(show&&!meadowIntro.skipEl){
    const b=meadowIntro.skipEl=document.createElement("button");
    b.id="meadowIntroSkip";b.type="button";b.className="btn sm";b.textContent="跳过 ≫";
    b.style.cssText="position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:62;pointer-events:auto;opacity:.86;margin:0";
    const skip=e=>{e.preventDefault();e.stopPropagation();if(meadowIntro.on)stopMeadowIntro(true);};
    b.addEventListener("pointerdown",skip);b.addEventListener("click",skip);
    document.body.appendChild(b);
  }
  if(meadowIntro.skipEl)meadowIntro.skipEl.style.display=show?"block":"none";
  if(show&&!meadowIntro.keyHandler){
    meadowIntro.keyHandler=e=>{
      if(!meadowIntro.on)return;
      if(e.code==="Space"||e.code==="Escape"||e.code==="Enter"){e.preventDefault();stopMeadowIntro(true);}
    };
    window.addEventListener("keydown",meadowIntro.keyHandler);
  }else if(!show&&meadowIntro.keyHandler){
    window.removeEventListener("keydown",meadowIntro.keyHandler);
    meadowIntro.keyHandler=null;
  }
}
function sampleMeadowIntroPose(u,opts){
  opts=opts||{};
  const smooth=THREE.MathUtils.smoothstep,mix=THREE.MathUtils.lerp;
  const pPos=opts.playerPos||P.pos;
  const field=typeof environmentRoot!=="undefined"?environmentRoot?.userData?.placeState?.meadow?.court:null;
  const hAt=(x,z)=>(field&&typeof field.heightAt==="function"?field.heightAt(x,z):0);
  const dx=HOOP.x-pPos.x,dz=HOOP.z-pPos.z;
  const distPH=Math.max(1,Math.hypot(dx,dz));
  const ux=dx/distPH,uz=dz/distPH,rx=-uz,rz=ux;
  const aspect=(typeof camera!=="undefined"&&camera&&camera.aspect)||1.6;
  const portrait=aspect<0.85;
  // Dramatic ~4.0x Vertigo zoom ratio (mobile 86° -> 25.5°, desktop 74° -> 21.5°).
  const fovWide=portrait?86.0:74.0;
  const fovTele=portrait?25.5:21.5;

  // TRUE ZERO-DRIFT CINEMA HITCHCOCK VERTIGO LINEAR ALGEBRA:
  // Anchor on the player's chest S, move camera strictly along a FIXED unit ray `backDir` by
  // R(t) = R0 * tan(fovWide/2) / tan(fov(t)/2), and steer `lookDir(fov)` by the exact inverse
  // perspective offset (-camRight * ndcX * tanHalfH - camUp * ndcY * tanHalfV)!
  // Result: the player's screen X, screen Y, AND pixel height stay 100.00% PIXEL-FROZEN
  // (<1% drift!) for the entire 3.65s zoom while the hoop & colossal Golden Snow Peak surge ~4x larger!
  const playerBaseY=hAt(pPos.x,pPos.z);
  const S=V3(pPos.x,playerBaseY+1.45,pPos.z);
  // Almost-level back ray (y = +0.038 -> cam y rises gently 1.58m -> 2.02m) keeps the towering Golden Snow Peak
  // summit tip completely inside the top of the frame even at max 4x telephoto compression!
  const backDir=V3(-ux*0.96+rx*0.23,0.038,-uz*0.96+rz*0.23).normalize();
  const fwdDir=backDir.clone().negate();
  const camRight=V3().crossVectors(fwdDir,V3(0,1,0)).normalize();
  const camUp=V3().crossVectors(camRight,fwdDir).normalize();
  const R0=portrait?3.55:4.35;
  // Desired frozen screen coordinates of the player's upper torso (lower-left-center so hoop & Golden Peak soar cleanly above!)
  const ndcX=portrait?-0.16:-0.14;
  const ndcY=portrait?-0.22:-0.20;
  const tanWide0=Math.tan(fovWide*Math.PI/360);
  const lookDir0=fwdDir.clone().addScaledVector(camRight,-ndcX*tanWide0*aspect).addScaledVector(camUp,-ndcY*tanWide0).normalize();
  const cos0=Math.max(0.5,lookDir0.dot(fwdDir));

  const hitchState=(fovDeg)=>{
    const tanHalfV=Math.tan(fovDeg*Math.PI/360);
    const tanHalfH=tanHalfV*aspect;
    // Exact inverse perspective offset keeps S projected at (ndcX, ndcY) identically at EVERY FOV!
    const lookDir=fwdDir.clone()
      .addScaledVector(camRight,-ndcX*tanHalfH)
      .addScaledVector(camUp,-ndcY*tanHalfV)
      .normalize();
    const cosCur=Math.max(0.5,lookDir.dot(fwdDir));
    const scale=(tanWide0/tanHalfV)*(cos0/cosCur);
    const R=R0*scale;
    const p=S.clone().addScaledVector(backDir,R);
    const minGround=hAt(p.x,p.z)+0.85;
    if(p.y<minGround)p.y=minGround;
    const l=p.clone().addScaledVector(lookDir,24);
    return {p,l,lookDir};
  };

  const hStart=hitchState(fovWide);
  const hEnd=hitchState(fovTele);
  const pos=V3(),look=V3();
  let fov=fovTele,introFlag=false;

  // Phase 1 (0.00 -> 0.14, ~0.75s): Short, crisp lateral glide into Hitchcock lock point at steady wide lens.
  // Phase 2 (0.14 -> 0.82, ~3.65s): Pure, uninterrupted, 100% zero-drift 4x Hitchcock Vertigo Dolly-Zoom!
  // Phase 3 (0.82 -> 0.91, ~0.50s): Monumental hold at peak telephoto compression so the eye absorbs the giant mountain wall.
  // Phase 4 (0.91 -> 1.00, ~0.50s): Smooth handoff into active gameplay camera.
  if(u<0.14){
    const k=smooth(u,0.0,0.14);
    const sPos=hStart.p.clone().addScaledVector(V3(rx,0,rz),-3.2);
    sPos.y=Math.max(hStart.p.y-0.08,hAt(sPos.x,sPos.z)+1.55);
    pos.lerpVectors(sPos,hStart.p,k);
    const sLook=sPos.clone().addScaledVector(hStart.lookDir,24);
    look.lerpVectors(sLook,hStart.l,k);
    fov=fovWide;
  }else if(u<0.82){
    const lin=clamp((u-0.14)/0.68,0,1);
    const k=smooth(lin,0,1);
    const tanW=Math.tan(fovWide*Math.PI/360),tanT=Math.tan(fovTele*Math.PI/360);
    const tanCur=tanW*Math.pow(tanT/tanW,k);
    fov=2*Math.atan(tanCur)*180/Math.PI;
    const st=hitchState(fov);
    pos.copy(st.p);
    look.copy(st.l);
  }else if(u<0.91){
    fov=fovTele;
    pos.copy(hEnd.p);
    look.copy(hEnd.l);
  }else{
    const k=smooth(u,0.91,1.0);
    const keepTele=CAM.mode===CAM_MEADOW_TELE;
    const targetPos=keepTele||!opts.endPos?hEnd.p:opts.endPos;
    const targetLook=keepTele||!opts.endLook?hEnd.l:opts.endLook;
    const targetFov=keepTele||opts.endFov==null?fovTele:opts.endFov;
    pos.copy(hEnd.p).lerp(targetPos,k);
    look.copy(hEnd.l).lerp(targetLook,k);
    fov=mix(fovTele,targetFov,k);
  }
  return {pos,look,fov,tele:fov<48,introFlag};
}
function startMeadowIntro(opts,done){
  if(typeof opts==="function"){done=opts;opts={};}
  opts=opts||{};
  meadowIntro.on=true;meadowIntro.t=0;meadowIntro.dur=Number(opts.dur)||5.4;
  meadowIntro.cb=typeof done==="function"?done:null;
  meadowIntro.endPos=opts.endPos?opts.endPos.clone():null;
  meadowIntro.endLook=opts.endLook?opts.endLook.clone():null;
  meadowIntro.endFov=opts.endFov!=null?Number(opts.endFov):fovForAspect((typeof camera!=="undefined"&&camera&&camera.aspect)||1.6);
  if(typeof player!=="undefined"&&player&&player.g){
    meadowIntro.prevPlayerVis=player.g.visible;
    player.g.visible=true;
    player.g.position.set(P.pos.x,0,P.pos.z);
    player.g.rotation.y=P.face;
  }
  if(typeof hands!=="undefined"&&hands)hands.visible=false;
  const s0=sampleMeadowIntroPose(0,{endPos:meadowIntro.endPos,endLook:meadowIntro.endLook,endFov:meadowIntro.endFov});
  rig.pos.copy(s0.pos);rig.look.copy(s0.look);camSnap=true;
  requestCameraFov("meadowIntro",s0.fov,35);
  if(typeof camera!=="undefined"&&camera&&camera.userData){
    camera.userData.meadowTele=true;
    camera.userData.meadowTeleIntro=true;
  }
  if(opts.showSkip!==false)meadowIntroSkipUI(true);
  return true;
}
function stopMeadowIntro(runCb){
  if(!meadowIntro.on)return;
  const cb=meadowIntro.cb;
  meadowIntro.on=false;meadowIntro.t=0;meadowIntro.cb=null;
  meadowIntroSkipUI(false);
  releaseCameraFov("meadowIntro");
  if(typeof camera!=="undefined"&&camera&&camera.userData){
    camera.userData.meadowTele=(CAM.mode===CAM_MEADOW_TELE&&currentScenePreset==="flowerCourt");
    camera.userData.meadowTeleIntro=false;
  }
  if(meadowIntro.endPos&&meadowIntro.endLook&&CAM.mode!==CAM_MEADOW_TELE){
    rig.pos.copy(meadowIntro.endPos);rig.look.copy(meadowIntro.endLook);camSnap=true;
  }
  if(runCb&&cb)cb();
}
function updateMeadowIntro(dt){
  if(!meadowIntro.on)return false;
  if(currentScenePreset!=="flowerCourt"){stopMeadowIntro(true);return false;}
  meadowIntro.t+=Math.max(0,dt||0.016);
  const u=clamp(meadowIntro.t/Math.max(0.1,meadowIntro.dur),0,1);
  const sample=sampleMeadowIntroPose(u,{endPos:meadowIntro.endPos,endLook:meadowIntro.endLook,endFov:meadowIntro.endFov});
  rig.pos.copy(sample.pos);rig.look.copy(sample.look);camSnap=true;
  requestCameraFov("meadowIntro",sample.fov,35);
  if(typeof camera!=="undefined"&&camera&&camera.userData){
    camera.userData.meadowTele=sample.tele;
    camera.userData.meadowTeleIntro=sample.introFlag;
  }
  if(u>=1){stopMeadowIntro(true);return false;}
  return true;
}
function applyMeadowIntroAt(u,opts){
  const s=sampleMeadowIntroPose(clamp(Number(u)||0,0,1),opts||{});
  rig.pos.copy(s.pos);rig.look.copy(s.look);
  camera.position.copy(s.pos);camera.lookAt(s.look);
  requestCameraFov("meadowIntro",s.fov,35);
  if(camera&&camera.userData){camera.userData.meadowTele=s.tele;camera.userData.meadowTeleIntro=s.introFlag;}
  camera.updateMatrixWorld();
  return s;
}
/* CameraDirector：所有镜头的唯一调度入口。镜头优先级固定为
   调试编辑器 > 回放/胜利/英雄演出 > 过场接管 > 模式专属镜头 > 常规跟随。
   具体镜头仍由各演出模块提供，这里只决定本帧谁拥有 rig，避免 game-loop
   里不断增长的 if/else 互相抢写相机。 */
function updateCameraDirector(dt){
  const editing=window.AIBACamera&&AIBACamera.isEditing&&AIBACamera.isEditing();
  const cosmic=cosmicShotInFlight()&&["round","tiebreak","battle","rackrush","rushbetween"].includes(G.state)&&
    !G.cutAway&&!G.battleCut&&!editing&&!rep.on&&!VICTORY_CINE.on&&!winCine.on;
  const cosmicReplay=rep.on&&rep.clip?.cosmic&&rep.t>=REPLAY_PHOTO_DUR;
  if((!cosmic&&!cosmicReplay)||editing||(cosmicView&&cosmicView.preset!==currentScenePreset))endCosmicView();
  if(hero.on&&hero.mode!=="boot"&&(editing||rep.on||VICTORY_CINE.on||winCine.on||cosmic||G.cutAway||G.battleCut))endHero();
  if(editing){
    AIBACamera.updateEditor(dt);return "editor";
  }
  if(VICTORY_CINE.on&&G.state!=="victorycine")stopVictoryCine();
  if(rep.on){updReplay(dt);return "replay";}
  if(VICTORY_CINE.on){updVictoryCine(dt);return "victory";}
  if(winCine.on){updWinCine(dt);return "win";}
  if(cosmic){updateCosmicCamera(cosmicBall,dt);return "cosmic";}
  if(hero.on){updHero(dt);if(hero.on)return "hero";}
  if(meadowIntro.on){if(updateMeadowIntro(dt))return "meadowIntro";}
  if(G.cutAway||G.battleCut||G.state==="pregame")return "takeover";
  if(cameraFovStack.has("meadowTele")&&(currentScenePreset!=="flowerCourt"||CAM.mode!==CAM_MEADOW_TELE||!["round","tiebreak","battle","rackrush","bootshot","resultbeat","lastshot"].includes(G.state))){
    releaseCameraFov("meadowTele");
    if(camera&&camera.userData&&!meadowIntro.on){camera.userData.meadowTele=false;camera.userData.meadowTeleIntro=false;}
  }
  if(G.state==="aishow"){updShowCam();return "show";}
  if(["menu","diff","intro","roundend","sim","bracket","champion","runnerup","eliminated","battleend","rushend","lsend"].includes(G.state)){
    const a=G.tNow*0.1;
    /* 菜单环绕默认走 18×20、高 8m 的椭圆。世界地图把建筑和植被收到边线外 5~6m 之后,
       这条椭圆会从屋脊或树冠里穿过去 —— 雨林场实测整屏被一团叶子糊住。
       所以允许每张场地在 build 时往 placeState.menuOrbit 写一组
       [半长轴x, 半长轴z, 机位高度, 注视高度];没写的场地保持原样。 */
    const orbit=(typeof environmentRoot!=="undefined"&&environmentRoot?.userData?.placeState?.menuOrbit)||null;
    rig.pos.set(Math.cos(a)*(orbit?orbit[0]:18),(orbit?orbit[2]:8)+Math.sin(G.tNow*0.3)*0.5,COURT.midZ+Math.sin(a)*(orbit?orbit[1]:20));
    rig.look.set(0,orbit?orbit[3]:2.2,COURT.midZ);
    return "menu";
  }
  /* 绝杀观看阶段由模式接管转头镜头；球到手后再回到常规跟随。 */
  if(G.state==="lastshot"&&typeof updateLastShotCam==="function"&&updateLastShotCam(dt))return "lastshot";
  if((G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="bootshot"||G.state==="resultbeat")&&!G.glideCam){
    updPlayCam(dt);return "play";
  }
  if(G.state==="lastshot"){updPlayCam(dt);return "play";}
  return "idle";
}
function ballWorldPos(out,atRelease=false){
  // 出手点取当前可见骨架的球心，第一和第三人称共用。带上同一份胸腔叠加。
  const shooter=typeof player!=="undefined"?player:null;
  const readGrip=()=>{
    const skin=window.AIBATripo;
    if(shooter&&skin&&skin.heldBallPosition&&skin.heldBallPosition(shooter,out,atRelease))return out;
    pBall.getWorldPosition(out);
    return out;
  };
  if(window.AIBASpine&&shooter)return AIBASpine.withPose(shooter,readGrip);
  return readGrip();
}


window.AIBA.runtime.register("rendering:camera",Object.freeze({
  P,CAM,faceTo,cycleCam,setCameraMode,applyCamMode,eyePos,autoFrameCam,updPlayCam,updateCameraDirector,ballWorldPos,
  requestCameraFov,releaseCameraFov,applyCameraFovStack,
  startMeadowIntro,stopMeadowIntro,sampleMeadowIntroPose,applyMeadowIntroAt,
  customCameraSlots,availableCameraModes,customCameraSettingsMarkup,beginCustomCameraEdit,saveEditing,cancelEditing,
  useCustomCameraSlot,clearCustomCameraSlot,
  isEditing:()=>!!cameraEditor,updateEditor:()=>!!cameraEditor&&updateCustomCamera(0)
}));

window.AIBACameraBeginEdit=beginCustomCameraEdit;
window.AIBACameraSaveEditing=saveEditing;
window.AIBACameraCancelEditing=cancelEditing;
window.AIBACameraUse=useCustomCameraSlot;
window.AIBACameraClear=clearCustomCameraSlot;
window.AIBACamera=Object.freeze({
  CAM,slots:customCameraSlots,cycle:cycleCam,setMode:setCameraMode,settingsMarkup:customCameraSettingsMarkup,
  beginEdit:beginCustomCameraEdit,saveEditing,cancelEditing,useSlot:useCustomCameraSlot,clearSlot:clearCustomCameraSlot,
  isEditing:()=>!!cameraEditor,updateEditor:()=>!!cameraEditor&&updateCustomCamera(0)
});
window.AIBACameraFov=Object.freeze({request:requestCameraFov,release:releaseCameraFov,apply:applyCameraFovStack});
window.AIBAMeadowIntro=Object.freeze({
  start:startMeadowIntro,stop:stopMeadowIntro,sample:sampleMeadowIntroPose,applyAt:applyMeadowIntroAt,
  isActive:()=>!!meadowIntro.on,release:()=>{releaseCameraFov("meadowIntro");if(camera&&camera.userData){camera.userData.meadowTele=CAM.mode===CAM_MEADOW_TELE&&currentScenePreset==="flowerCourt";camera.userData.meadowTeleIntro=false;}}
});
