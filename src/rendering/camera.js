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
const CAM={mode:0,names:CAM_BASE_NAMES.concat(["自定义视角 1","自定义视角 2"])};
function cameraInPlay(){
  return G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||
    G.state==="rushintro"||G.state==="rushbetween"||G.state==="pregame"||G.state==="lastshot"||
    G.state==="bootshot"||G.state==="resultbeat"||G.state==="victorycine"||G.state==="wincine";
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
  const modes=[0,1,2];
  customCameraSlots.forEach((v,i)=>{if(v||cameraEditor&&cameraEditor.slot===i)modes.push(3+i);});
  return modes;
}
function cameraModeLabel(mode){
  const i=customCameraSlotIndex(mode);
  return i>=0?"自定义视角 "+(i+1):(CAM_BASE_NAMES[mode]||CAM_BASE_NAMES[1]);
}
function setCameraIcon(){
  if(typeof AIBASetIcon==="function")AIBASetIcon("camBtn","camera",cameraModeLabel(CAM.mode));
}
function setCameraMode(mode,options){
  const modes=availableCameraModes();
  CAM.mode=modes.includes(mode)?mode:1;
  setCameraIcon();
  applyCamMode();
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
  passer.g.visible=inPlay;
  oppPasser.g.visible=inPlay&&G.mode==="battle";
  $("camBtn").style.display=inPlay?"block":"none";
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
  const sideK=opts.sideK!=null?opts.sideK:(opts.broadcast?0.62:0.44);
  const backK=opts.backK!=null?opts.backK:(opts.broadcast?0.67:0.82);
  const heightK=opts.heightK!=null?opts.heightK:(opts.broadcast?0.34:0.25);
  _afBack.set(-dir.x*backK+perp.x*side*sideK,heightK,-dir.z*backK+perp.z*side*sideK).normalize();
  _afForward.copy(_afBack).negate();
  _afRight.crossVectors(_afForward,V3(0,1,0)).normalize();
  _afUp.crossVectors(_afRight,_afForward).normalize();
  const vFov=camera.fov*Math.PI/180;
  const aspect=camera.aspect||(innerWidth/innerHeight)||1;
  const hFov=2*Math.atan(Math.tan(vFov/2)*aspect);
  const tanH=Math.tan(hFov/2),tanV=Math.tan(vFov/2);
  const marginX=opts.marginX||1.32,marginY=opts.marginY||1.24;
  let dist=0;
  _afPts.forEach(p=>{
    _afTmp.copy(p).sub(_afCenter);
    const x=_afTmp.dot(_afRight),y=_afTmp.dot(_afUp),z=_afTmp.dot(_afForward);
    dist=Math.max(dist,Math.abs(x)*marginX/tanH-z,Math.abs(y)*marginY/tanV-z);
  });
  dist=clamp(dist+(opts.pad==null?.45:opts.pad),opts.minDist||5.2,opts.maxDist||30);
  rig.pos.copy(_afCenter).addScaledVector(_afBack,dist);
  rig.look.copy(_afCenter);
}
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
  const isContest=G.mode==="contest";
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
      if(fb&&fb.phase==="fly"&&fb.mesh)fpTarget=Math.max(fpTarget,HOOP.y+0.15+(fb.mesh.position.y-HOOP.y)*0.5);
    }
    fpLookY=fpLookY==null?fpTarget:fpLookY+(fpTarget-fpLookY)*Math.min(1,dt*7);
    rig.look.set(HOOP.x,fpLookY,HOOP.z);
    camSnap=true;
  }else if(CAM.mode===1){
    if(isBattle||isRush||isContest){
      // 投篮机同款低位越肩球员锁定镜头；百分大战会随距离平滑拉远。
      updatePlayerLockCamera(dt);
    }else{
      camTarget.pos.set(P.pos.x-d.x*2.85,2.18+P.jump*0.4,P.pos.z-d.z*2.85);
      camTarget.look.set(P.pos.x+d.x*2.45,1.66+P.jump*0.5,P.pos.z+d.z*2.45);
      dampRig(dt,6);
    }
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
}
/* CameraDirector：所有镜头的唯一调度入口。镜头优先级固定为
   调试编辑器 > 回放/胜利/英雄演出 > 过场接管 > 模式专属镜头 > 常规跟随。
   具体镜头仍由各演出模块提供，这里只决定本帧谁拥有 rig，避免 game-loop
   里不断增长的 if/else 互相抢写相机。 */
function updateCameraDirector(dt){
  if(window.AIBACamera&&AIBACamera.isEditing&&AIBACamera.isEditing()){
    AIBACamera.updateEditor(dt);return "editor";
  }
  if(VICTORY_CINE.on&&G.state!=="victorycine")stopVictoryCine();
  if(rep.on){updReplay(dt);return "replay";}
  if(VICTORY_CINE.on){updVictoryCine(dt);return "victory";}
  if(winCine.on){updWinCine(dt);return "win";}
  if(hero.on){updHero(dt);return "hero";}
  if(G.cutAway||G.battleCut||G.state==="pregame")return "takeover";
  if(G.state==="aishow"){updShowCam();return "show";}
  if(["menu","diff","intro","roundend","sim","bracket","champion","runnerup","eliminated","battleend","rushend","lsend"].includes(G.state)){
    const a=G.tNow*0.1;
    rig.pos.set(Math.cos(a)*18,8+Math.sin(G.tNow*0.3)*0.5,COURT.midZ+Math.sin(a)*20);
    rig.look.set(0,2.2,COURT.midZ);
    return "menu";
  }
  /* 绝杀观看阶段由模式接管转头镜头；球到手后再回到常规跟随。 */
  if(G.state==="lastshot"&&typeof updateLastShotCam==="function"&&updateLastShotCam(dt))return "lastshot";
  if((G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="bootshot"||G.state==="resultbeat")&&!G.glideCam){
    updPlayCam(dt);return "play";
  }
  if(G.state==="lastshot")updPlayCam(dt);
  return "idle";
}
function ballWorldPos(out){
  // Camera mode is presentation only. Shot physics always starts at the real
  // player skeleton's ball grip so first/third person produce the same shot.
  pBall.getWorldPosition(out);
  return out;
}


window.AIBA.runtime.register("rendering:camera",Object.freeze({
  P,CAM,faceTo,cycleCam,setCameraMode,applyCamMode,eyePos,autoFrameCam,updPlayCam,updateCameraDirector,ballWorldPos,
  requestCameraFov,releaseCameraFov,applyCameraFovStack,
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
