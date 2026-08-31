const PREGAME_DUNK_STYLE_LEGACY="legacy";
const PREGAME_DUNK_STYLE_AIR_JORDAN="air-jordan";
function readPregameDunkStyle(){
  try{
    const raw=typeof location!=="undefined"&&typeof URLSearchParams!=="undefined"
      ?new URLSearchParams(location.search).get("pregameDunk"):null;
    return String(raw||"").toLowerCase()===PREGAME_DUNK_STYLE_LEGACY
      ?PREGAME_DUNK_STYLE_LEGACY:PREGAME_DUNK_STYLE_AIR_JORDAN;
  }catch(e){return PREGAME_DUNK_STYLE_AIR_JORDAN;}
}
let pregameDunkStyle=readPregameDunkStyle();
const PREGAME={
  on:false,t:0,idx:0,dur:0,shots:[],actors:[],snaps:[],prevState:null,cb:null,chalk:null,poseCache:new Map(),
  dunkStyle:pregameDunkStyle
};
function setPregameDunkStyle(style){
  const value=String(style||"").toLowerCase().replace(/_/g,"-");
  pregameDunkStyle=value===PREGAME_DUNK_STYLE_LEGACY
    ?PREGAME_DUNK_STYLE_LEGACY:PREGAME_DUNK_STYLE_AIR_JORDAN;
  PREGAME.dunkStyle=pregameDunkStyle;
  return pregameDunkStyle;
}
function getPregameDunkStyle(){return PREGAME.dunkStyle;}
const PREGAME_ACTIONS=["shoot","stretch","dunk","chalk","hang","finger","huddle","wave","pump"];
const PREGAME_CAMS=["orbit","push","low","overhead","freeze","follow","pan","pull"];
const pregamePick=a=>a[(Math.random()*a.length)|0];
const PREGAME_LABELS={
  shoot:"投篮热身",stretch:"拉伸热身",dunk:"Air Jordan 扣篮",chalk:"撒镁粉",hang:"挂框定格",
  finger:"对镜头摇手指",huddle:"拥抱打气",wave:"向镜头致意",pump:"赛前加油"
};
function pregameBallFor(guy){
  if(guy===player)return pBall;
  if(guy===passer)return passerBall;
  return guy&&guy.ball?guy.ball:null;
}
function pregameBallGrip(guy){
  return guy&&guy.ballGrips&&guy.ballGrips[0]?guy.ballGrips[0]:null;
}
/* 赛前演示里的球也必须走和正式比赛相同的 ballGrip 生命周期。
   之前这里直接写 ball.position，球看起来是在手附近，但手一动球并没有跟着动。
   持球阶段把球挂到 grip；出手/扣篮离手后再挂回 scene，飞行轨迹才不会被人物根节点带走。 */
function pregameHoldBall(guy,ball,offset){
  const grip=pregameBallGrip(guy);
  if(!grip||!ball)return false;
  if(ball.parent!==grip)grip.add(ball);
  ball.position.copy(offset||V3(0,0,0));
  ball.quaternion.set(0,0,0,1);ball.scale.set(1,1,1);ball.visible=true;
  ball.userData.pregameBallMode="held";
  return true;
}
function pregameHoldBallAtPose(guy,ball,poseLocal,weight){
  if(!pregameHoldBall(guy,ball))return false;
  if(!poseLocal||poseLocal.length!==3||!weight)return true;
  const grip=pregameBallGrip(guy);if(!grip||!guy.g)return true;
  guy.g.updateMatrixWorld(true);
  const targetWorld=guy.g.localToWorld(V3(poseLocal[0],poseLocal[1],poseLocal[2]));
  const gripLocal=grip.worldToLocal(targetWorld);
  ball.position.lerp(gripLocal,clamp(weight,0,1));
  return true;
}
function pregameReleaseBall(guy,ball){
  if(!guy||!guy.g||!ball||!scene)return null;
  guy.g.updateMatrixWorld(true);ball.updateMatrixWorld(true);
  const worldPos=V3();ball.getWorldPosition(worldPos);
  const worldQuat=ball.getWorldQuaternion(new THREE.Quaternion());
  if(typeof scene.attach==="function")scene.attach(ball);
  else scene.add(ball);
  /* scene 通常是世界根节点；显式重写一次变换，兼容旧 Three attach 不保留姿态的情况。 */
  scene.worldToLocal(worldPos);ball.position.copy(worldPos);
  const sceneQuat=scene.getWorldQuaternion(new THREE.Quaternion()).invert();
  ball.quaternion.copy(sceneQuat.multiply(worldQuat));
  ball.userData.pregameBallMode="flight";
  return worldPos.clone();
}
function pregameRotSnap(list){return list?list.map(x=>x.rotation.clone()):[];}
function pregameRotRestore(list,rots){if(!list||!rots)return;list.forEach((x,i)=>{if(rots[i])x.rotation.copy(rots[i]);});}
function pregameBlendNode(node,from,k){
  if(!node||!from)return;
  node.rotation.x=from.x+(node.rotation.x-from.x)*k;
  node.rotation.y=from.y+(node.rotation.y-from.y)*k;
  node.rotation.z=from.z+(node.rotation.z-from.z)*k;
}
function pregameFingerSnap(guy){
  return (guy&&guy.fingerJoints||[]).map(hand=>hand.map(root=>{
    const chain=root&&root.userData&&root.userData.aibaFingerChain||{};
    return {root:root.rotation.clone(),pip:chain.pip?chain.pip.rotation.clone():null,dip:chain.dip?chain.dip.rotation.clone():null};
  }));
}
function pregameFingerRestore(guy,poses){
  (guy&&guy.fingerJoints||[]).forEach((hand,handIndex)=>hand.forEach((root,fingerIndex)=>{
    const pose=poses&&poses[handIndex]&&poses[handIndex][fingerIndex],chain=root&&root.userData&&root.userData.aibaFingerChain||{};
    if(!pose)return;
    if(pose.root)root.rotation.copy(pose.root);
    if(chain.pip&&pose.pip)chain.pip.rotation.copy(pose.pip);
    if(chain.dip&&pose.dip)chain.dip.rotation.copy(pose.dip);
  }));
}
function pregameFingerBlend(guy,poses,k){
  (guy&&guy.fingerJoints||[]).forEach((hand,handIndex)=>hand.forEach((root,fingerIndex)=>{
    const pose=poses&&poses[handIndex]&&poses[handIndex][fingerIndex],chain=root&&root.userData&&root.userData.aibaFingerChain||{};
    if(!pose)return;
    pregameBlendNode(root,pose.root,k);
    if(chain.pip&&pose.pip)pregameBlendNode(chain.pip,pose.pip,k);
    if(chain.dip&&pose.dip)pregameBlendNode(chain.dip,pose.dip,k);
  }));
}
function pregameThumbSnap(guy){
  return (guy&&guy.thumbRoots||[]).map(root=>{
    const tip=root&&root.userData&&root.userData.aibaThumbChain&&root.userData.aibaThumbChain.tip;
    return {root:root.rotation.clone(),tip:tip?tip.rotation.clone():null};
  });
}
function pregameThumbRestore(guy,poses){
  (guy&&guy.thumbRoots||[]).forEach((root,index)=>{
    const pose=poses&&poses[index],tip=root&&root.userData&&root.userData.aibaThumbChain&&root.userData.aibaThumbChain.tip;
    if(!pose)return;
    if(pose.root)root.rotation.copy(pose.root);
    if(tip&&pose.tip)tip.rotation.copy(pose.tip);
  });
}
function pregameThumbBlend(guy,poses,k){
  (guy&&guy.thumbRoots||[]).forEach((root,index)=>{
    const pose=poses&&poses[index],tip=root&&root.userData&&root.userData.aibaThumbChain&&root.userData.aibaThumbChain.tip;
    if(!pose)return;
    pregameBlendNode(root,pose.root,k);
    if(tip&&pose.tip)pregameBlendNode(tip,pose.tip,k);
  });
}
function pregameSnapGuy(guy){
  const ball=pregameBallFor(guy);
  return {guy,pos:guy.g.position.clone(),rot:guy.g.rotation.clone(),visible:guy.g.visible,
    active:guy.active,celeb:guy._celeb||null,ballVisible:ball?ball.visible:false,
    ballPos:ball?ball.position.clone():null,ballQuat:ball?ball.quaternion.clone():null,
    ballScale:ball?ball.scale.clone():null,ballParent:ball?ball.parent:null,ballMat:ball?ball.material:null,
    arms:pregameRotSnap(guy.arms),elbows:pregameRotSnap(guy.elbows),legs:pregameRotSnap(guy.legs),
    knees:pregameRotSnap(guy.knees),ankles:pregameRotSnap(guy.ankles),shoes:pregameRotSnap(guy.shoes),
    hands:pregameRotSnap(guy.handRoots),fingers:pregameFingerSnap(guy),thumbs:pregameThumbSnap(guy),
    head:guy.headRoot?guy.headRoot.rotation.clone():null};
}
function pregameRestoreGuy(s){
  const guy=s.guy,ball=pregameBallFor(guy);
  guy.g.position.copy(s.pos);guy.g.rotation.copy(s.rot);guy.g.visible=s.visible;guy._celeb=s.celeb;
  if(s.active!==undefined)guy.active=s.active;
  if(ball){
    if(s.ballParent&&ball.parent!==s.ballParent)s.ballParent.add(ball);
    ball.visible=s.ballVisible;if(s.ballPos)ball.position.copy(s.ballPos);
    if(s.ballQuat)ball.quaternion.copy(s.ballQuat);if(s.ballScale)ball.scale.copy(s.ballScale);
    if(s.ballMat)ball.material=s.ballMat;ball.userData.pregameBallMode=null;
  }
  pregameRotRestore(guy.arms,s.arms);pregameRotRestore(guy.elbows,s.elbows);pregameRotRestore(guy.legs,s.legs);
  pregameRotRestore(guy.knees,s.knees);pregameRotRestore(guy.ankles,s.ankles);pregameRotRestore(guy.shoes,s.shoes);
  pregameRotRestore(guy.handRoots,s.hands);pregameFingerRestore(guy,s.fingers);pregameThumbRestore(guy,s.thumbs);
  if(guy.headRoot&&s.head)guy.headRoot.rotation.copy(s.head);
}
function pregameNeutral(guy){
  guy.g.rotation.x=0;guy.g.position.y=0;
  if(typeof resetArmGeometry==="function")resetArmGeometry(guy);
  if(guy.headRoot)guy.headRoot.rotation.set(0,0,0);
  /* 无球站定也使用主比赛的自然下垂基线：上臂接近垂直，肘部只留约 5° 松弛弯曲。
     预热的投篮/挥手动作随后会显式覆盖它，避免把接球姿势带进日常站姿。 */
  guy.arms.forEach(a=>a.rotation.set(-.03,0,0));
  guy.elbows.forEach(e=>e.rotation.set(-Math.PI/36,0,0));
  (guy.handRoots||[]).forEach((hand,index)=>{hand.rotation.set(0,index===0?-Math.PI*.5:Math.PI*.5,0);});
  (guy.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,fingerIndex)=>{
    if(typeof setFingerChainPose==="function")setFingerChainPose(finger,typeof HAND_FINGER_REST==="number"?HAND_FINGER_REST:-.08,0);
    else finger.rotation.set(typeof HAND_FINGER_REST==="number"?HAND_FINGER_REST:-.08,0,0);
  }));
  if(typeof poseThumbJoints==="function")poseThumbJoints(guy,0);
  guy.legs.forEach(l=>l.rotation.set(0,0,0));
  guy.knees.forEach(k=>k.rotation.set(0,0,0));
  guy.ankles.forEach(a=>a.rotation.set(0,0,0));
  guy.shoes.forEach(s=>s.rotation.set(0,0,0));
}
function pregamePoseSnapshot(guy){
  return {
    pos:guy.g.position.clone(),rot:guy.g.rotation.clone(),
    arms:pregameRotSnap(guy.arms),elbows:pregameRotSnap(guy.elbows),legs:pregameRotSnap(guy.legs),
    knees:pregameRotSnap(guy.knees),ankles:pregameRotSnap(guy.ankles),shoes:pregameRotSnap(guy.shoes),
    hands:pregameRotSnap(guy.handRoots),fingers:pregameFingerSnap(guy),thumbs:pregameThumbSnap(guy),
    head:guy.headRoot?guy.headRoot.rotation.clone():null
  };
}
function pregameAngleLerp(a,b,k){
  let d=b-a;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return a+d*k;
}
function pregameBlendRotations(list,from,k){
  if(!list||!from)return;
  list.forEach((part,i)=>{
    const prev=from[i];if(!prev)return;
    pregameBlendNode(part,prev,k);
  });
}
function pregameSmoothPose(guy,dt){
  if(!guy||!guy.g||!guy.g.position||!guy.g.rotation)return;
  const target=pregamePoseSnapshot(guy),prev=PREGAME.poseCache.get(guy);
  if(!prev){PREGAME.poseCache.set(guy,target);return;}
  const k=1-Math.exp(-Math.max(0,dt)*18);
  guy.g.position.lerpVectors(prev.pos,target.pos,k);
  guy.g.rotation.x=prev.rot.x+(target.rot.x-prev.rot.x)*k;
  guy.g.rotation.y=pregameAngleLerp(prev.rot.y,target.rot.y,k);
  guy.g.rotation.z=prev.rot.z+(target.rot.z-prev.rot.z)*k;
  pregameBlendRotations(guy.arms,prev.arms,k);pregameBlendRotations(guy.elbows,prev.elbows,k);
  pregameBlendRotations(guy.legs,prev.legs,k);pregameBlendRotations(guy.knees,prev.knees,k);
  pregameBlendRotations(guy.ankles,prev.ankles,k);pregameBlendRotations(guy.shoes,prev.shoes,k);
  pregameBlendRotations(guy.handRoots,prev.hands,k);pregameFingerBlend(guy,prev.fingers,k);pregameThumbBlend(guy,prev.thumbs,k);
  if(guy.headRoot&&prev.head&&target.head){
    guy.headRoot.rotation.x=prev.head.x+(target.head.x-prev.head.x)*k;
    guy.headRoot.rotation.y=pregameAngleLerp(prev.head.y,target.head.y,k);
    guy.headRoot.rotation.z=prev.head.z+(target.head.z-prev.head.z)*k;
  }
  PREGAME.poseCache.set(guy,pregamePoseSnapshot(guy));
}
function pregameClampPos(v){
  v.x=clamp(v.x,-COURT.halfWidth+0.9,COURT.halfWidth-0.9);
  v.z=clamp(v.z,COURT.nearBaseline+1.0,COURT.playMaxZ-0.7);
  return v;
}
function pregameSideBase(heroPos,side){
  const x=heroPos.x+(heroPos.x>0?-2.8:2.8)*(side||1);
  const z=heroPos.z+1.15;
  return pregameClampPos(V3(x,0,z));
}
function pregameBuildActors(opts){
  const heroName=G.myStar&&G.myStar.n?G.myStar.n:"YOU";
  const actors=[{guy:player,name:heroName,role:"hero",base:P.pos.clone(),face:P.face}];
  let other=null;
  if(opts.mode==="battle"&&G.battleOpp&&rivals[0]){
    other={guy:rivals[0],name:G.battleOpp.n||"对手",role:"opponent"};
  }else{
    const rv=rivals.find(x=>x.active);
    if(rv&&rv!==actors[0].guy)other={guy:rv,name:rv.o&&rv.o.n?rv.o.n:"挑战者",role:"opponent"};
    else if(passer)other={guy:passer,name:"训练搭档",role:"teammate"};
  }
  if(other){
    other.base=pregameSideBase(actors[0].base,1);
    other.face=faceTo(other.base,HOOP);
    if(other.guy.active!==undefined)other.guy.active=true;
    actors.push(other);
  }
  actors.forEach(a=>{a.base=pregameClampPos(a.base.clone());a.face=faceTo(a.base,HOOP);});
  return actors;
}
function pregameBuildShots(opts){
  const shots=[],actors=PREGAME.actors;
  const wanted=opts.mode==="battle"?5.8:(opts.mode==="rackrush"?5.0:5.2);
  let t=0,i=0,lastAction="";
  while(t<wanted){
    const actor=actors[i%actors.length]||actors[0];
    let action;
    if(i===0)action="shoot";
    else if(i===1)action=pregamePick(["chalk","hang","dunk"]);
    else action=pregamePick(PREGAME_ACTIONS);
    if(action===lastAction)action=pregamePick(PREGAME_ACTIONS);
    if(action==="huddle"&&actors.length<2)action="pump";
    if((action==="dunk"||action==="hang")&&opts.mode==="contest"&&Math.random()<0.45)action="shoot";
    const dur=rnd(1.15,1.65),cam=pregamePick(PREGAME_CAMS);
    shots.push({start:t,dur,actor,action,cam,side:Math.random()<0.5?-1:1,seed:rnd(0,Math.PI*2),group:action==="huddle"});
    t+=dur;i++;lastAction=action;
  }
  return shots;
}
function pregameCaption(seg){
  const el=$("vsBanner"),mode=G.mode==="battle"?"PERCENT BATTLE":(G.mode==="rackrush"?"RACK RUSH":"3PT CONTEST");
  const name=seg.group?"TEAM":seg.actor.name;
  el.innerHTML=`<span style="font-size:11px;color:#7feaff;letter-spacing:2px">${mode} / PREGAME</span><br>${name} · ${PREGAME_LABELS[seg.action]||"赛前热身"}`;
  el.style.display="block";
}
function pregamePlace(actor,pos,face){
  const guy=actor.guy;
  guy.g.visible=true;guy.g.position.set(pos.x,0,pos.z);guy.g.rotation.set(0,face,0);
}
function pregameActionBase(actor,action,u){
  const base=actor.base.clone();
  if(action==="huddle"&&PREGAME.actors.length>1){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other){
      const mid=actor.base.clone().lerp(other.base,0.5);
      base.copy(mid);base.x+=(actor.role==="hero"?-0.42:0.42);
    }
  }
  if(action==="dunk"||action==="hang"){
    const rimSpot=V3(action==="hang"?0:(actor.role==="opponent"?0.16:-0.16),0,HOOP.z+(action==="hang"?0.34:0.52));
    const approachEnd=action==="hang"?.34:.44;
    base.lerp(rimSpot,ease01(clamp(u/approachEnd,0,1)));
  }
  return pregameClampPos(base);
}
function pregameIdle(actor,t){
  const guy=actor.guy,ball=pregameBallFor(guy);
  pregamePlace(actor,actor.base,actor.face);pregameNeutral(guy);
  guy.g.position.y=Math.abs(Math.sin(t*3.1+(actor.role==="hero"?0:1.4)))*0.025;
  guy.arms[0].rotation.x=-0.48+Math.sin(t*2.5)*0.12;
  guy.arms[1].rotation.x=-0.48-Math.sin(t*2.3)*0.12;
  if(ball)ball.visible=false;
}
/* 扣篮不是“跳到最高点后把球从身体旁边抛向篮筐”。热身镜头需要读出一条完整的
   动作因果链：起跳持球 -> 球从篮圈上方压入网 -> 投篮手抓住篮圈 -> 身体摆一下
   再松手落地。所有时间点都放在同一条 segment 时间轴上，便于截图回归和以后
   在 T台/游戏之间继续微调。 */
const PREGAME_DUNK_TIMING=Object.freeze({
  takeoffStart:.06,contact:.42,ballRelease:.48,ballEntry:.53,ballThrough:.59,
  ballExit:.69,hangEnd:.77,landEnd:.98
});
function pregameDunkAir(u){
  const t=PREGAME_DUNK_TIMING;
  if(u<=t.takeoffStart)return 0;
  if(u<t.contact)return Math.sin(ease01((u-t.takeoffStart)/Math.max(.001,t.contact-t.takeoffStart))*Math.PI*.5);
  if(u<t.hangEnd)return 1;
  return 1-smoothRange(t.hangEnd,t.landEnd,u);
}
function pregameDunkPhase(u){
  const t=PREGAME_DUNK_TIMING;
  if(u<t.contact)return "takeoff";
  if(u<t.ballRelease)return "rim-contact";
  if(u<t.hangEnd)return "hang";
  if(u<t.landEnd)return "land";
  return "recover";
}
function pregameDunkSpineX(weight){
  const pose=typeof tstageStaticPose==="function"?tstageStaticPose("dunk_air_jordan"):null;
  const q=pose&&pose.body&&Array.isArray(pose.body.spineQuat)?pose.body.spineQuat:null;
  const spineX=q&&q.length===4?2*Math.atan2(Number(q[0])||0,Number(q[3])||1):0;
  return spineX*clamp(Number(weight)||0,0,1);
}
/* 进入挂框窗口后，先让身体绕投篮手做很小的前后摆，再补偿根节点位移，把
   handRig 留在篮圈前沿。这样脚不会“吸”到篮板下，也不会出现人已经落地而手还
   悬在篮圈上的断裂。commitCache 只在平滑姿势之后使用，避免跳过过渡。 */
function pregamePinDunkHand(guy,u,weight,commitCache){
  const hand=guy&&guy.handRoots&&guy.handRoots[0];
  if(!guy||!guy.g||!hand)return false;
  const t=PREGAME_DUNK_TIMING;
  const hangU=ease01((u-t.ballRelease)/Math.max(.001,t.hangEnd-t.ballRelease));
  const swing=Math.sin(hangU*Math.PI*2),bob=Math.cos(hangU*Math.PI*2);
  guy.g.rotation.x=pregameDunkSpineX(weight)+bob*.026;
  guy.g.rotation.z=swing*.065;
  guy.g.updateMatrixWorld(true);
  const handWorld=hand.getWorldPosition(V3());
  /* 篮圈的 +Z 是球员进攻侧；前沿比圆心更符合单手抓框的视觉，也给球留下
     从手掌向篮圈中心压入的明确路径。handRig 原点是腕部，不是球心。 */
  const anchor=V3(HOOP.x,HOOP.y+.10,HOOP.z+.26);
  guy.g.position.x+=anchor.x-handWorld.x;
  guy.g.position.y+=anchor.y-handWorld.y;
  guy.g.position.z+=anchor.z-handWorld.z;
  guy.g.updateMatrixWorld(true);
  guy.g.userData.pregameDunkHandPinned=true;
  if(commitCache)PREGAME.poseCache.set(guy,pregamePoseSnapshot(guy));
  return true;
}
function pregameAnimate(actor,action,u,seg){
  const guy=actor.guy,ball=pregameBallFor(guy),t=PREGAME.t+seg.seed;
  const base=pregameActionBase(actor,action,u);
  /* 镜头可以环绕取景，但脚下根节点不能追着镜头转。finger/wave 只让头部
     做小幅看镜头，身体保持原本朝向，避免“脚跟着相机自转”。 */
  let face=actor.face;
  if(action==="huddle"){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other)face=faceTo(base,other.guy.g.position);
  }
  pregamePlace(actor,base,face);pregameNeutral(guy);
  if(ball)ball.visible=false;
  if(action==="shoot"){
    updatePregameWarmupShot(actor,guy,ball,u,seg);
  }else if(action==="stretch"){
    const sway=Math.sin(u*Math.PI*2);
    guy.g.rotation.x=0.05+0.14*Math.max(0,sway);
    guy.arms[0].rotation.x=-1.9;guy.arms[1].rotation.x=-2.45;
    guy.arms[0].rotation.z=0.52*sway;guy.arms[1].rotation.z=-0.52*sway;
    guy.elbows.forEach(e=>e.rotation.x=-0.18);
    guy.legs.forEach(l=>l.rotation.x=-0.15);guy.knees.forEach(k=>k.rotation.x=0.44);
  }else if(action==="dunk"){
    const timing=PREGAME_DUNK_TIMING,air=pregameDunkAir(u);
    const gripRise=Math.max(0.98,HOOP.y-2.01+0.015);
    guy.g.position.y=0.08+air*gripRise;
    const reach=u<timing.contact
      ?smoothRange(timing.takeoffStart,timing.contact,u)
      :u<timing.hangEnd?1:1-smoothRange(timing.hangEnd,timing.landEnd,u);
    guy.arms.forEach(a=>a.rotation.x=-0.42-2.38*reach);
    guy.elbows.forEach(e=>e.rotation.x=-0.3-0.48*reach);
    guy.legs[0].rotation.x=-0.12-0.3*air;guy.legs[1].rotation.x=0.1+0.24*air;
    guy.knees.forEach(k=>k.rotation.x=0.18+0.54*air);
    const useAirJordan=PREGAME.dunkStyle===PREGAME_DUNK_STYLE_AIR_JORDAN&&
      typeof applyTstageDunkPose==="function";
    const airJordanWeight=useAirJordan
      ?smoothRange(.12,.29,u)*(1-smoothRange(timing.hangEnd,timing.landEnd-.06,u)):0;
    const airJordanApplied=useAirJordan&&applyTstageDunkPose(guy,airJordanWeight);
    if(ball)ball.material=matBall;
    seg._pregameDunkPoseWeight=airJordanWeight;
    seg._pregameDunkPoseBall=airJordanApplied&&typeof tstageDunkBallLocal==="function"
      ?tstageDunkBallLocal("dunk_air_jordan"):null;
    const phase=pregameDunkPhase(u);
    seg._pregameDunkPhase=phase;
    if(guy.g){
      guy.g.userData.pregameDunkStyle=airJordanApplied?PREGAME_DUNK_STYLE_AIR_JORDAN:PREGAME_DUNK_STYLE_LEGACY;
      guy.g.userData.pregameDunkPoseWeight=airJordanWeight;
      guy.g.userData.pregameDunkPhase=phase;
    }
    if(u>=timing.contact&&u<timing.hangEnd)pregamePinDunkHand(guy,u,airJordanWeight,false);
  }else if(action==="hang"){
    const hangRise=smoothRange(.1,.32,u),hangRelease=smoothRange(.48,.7,u);
    const hang=hangRise*(1-hangRelease),gripRise=Math.max(0.98,HOOP.y-2.01+0.015);
    guy.g.position.y=0.08+hang*gripRise;
    const reach=hangRise*(1-hangRelease*.8);
    guy.arms.forEach(a=>a.rotation.x=-0.42-2.72*reach);
    guy.elbows.forEach(e=>e.rotation.x=-0.3-0.48*reach);
    guy.legs[0].rotation.x=-0.12-0.3*hang;guy.legs[1].rotation.x=0.1+0.24*hang;
    guy.knees.forEach(k=>k.rotation.x=0.18+0.54*hang);
  }else if(action==="chalk"){
    const toss=smoothRange(.42,.72,u),rub=Math.sin(t*16)*(1-toss);
    guy.arms[0].rotation.x=-0.9-toss*1.65+rub*0.08;guy.arms[1].rotation.x=-0.9-toss*1.65-rub*0.08;
    guy.arms[0].rotation.z=-0.25-toss*0.45;guy.arms[1].rotation.z=0.25+toss*0.45;
    guy.elbows.forEach(e=>e.rotation.x=-1.35+toss*0.8);
    guy.g.position.y=Math.max(0,Math.sin(u*Math.PI))*0.08;
    updatePregameChalk(actor,u,t);
  }else if(action==="finger"){
    guy.arms[0].rotation.x=-2.15;guy.arms[0].rotation.z=-0.55;guy.elbows[0].rotation.x=-0.55;
    guy.arms[1].rotation.x=-0.55;guy.elbows[1].rotation.x=-0.55;
    guy.g.position.y=Math.sin(u*Math.PI)*0.05;
  }else if(action==="huddle"){
    const pump=Math.abs(Math.sin(t*6));
    guy.arms.forEach(a=>a.rotation.x=-1.55-pump*0.55);guy.elbows.forEach(e=>e.rotation.x=-1.05);
    guy.g.position.y=pump*0.06;
  }else if(action==="wave"){
    guy.arms[0].rotation.x=-2.25;guy.arms[0].rotation.z=-0.25+Math.sin(t*8)*0.38;guy.elbows[0].rotation.x=-0.35;
    guy.arms[1].rotation.x=-0.5;guy.elbows[1].rotation.x=-0.45;
  }else{
    const pump=Math.abs(Math.sin(t*7));
    guy.arms.forEach(a=>a.rotation.x=-1.9-pump*0.75);guy.elbows.forEach(e=>e.rotation.x=-0.75);
    guy.g.position.y=pump*0.12;guy.knees.forEach(k=>k.rotation.x=0.25*pump);
  }
  if((action==="finger"||action==="wave")&&guy.headRoot){
    const cameraFace=faceTo(base,rig.pos);
    const headYaw=pregameAngleLerp(actor.face,cameraFace,1)-actor.face;
    guy.headRoot.rotation.y=clamp(headYaw,-.46,.46);
  }
}
function pregameSyncBallAfterPose(actor,action,u,seg){
  const guy=actor&&actor.guy,ball=pregameBallFor(guy);
  if(!guy||!ball)return;
  if(action==="shoot"){
    const releaseAt=.54,landAt=.91;
    ball.material=actor.role==="hero"?shotMat(curShot()):matBall;
    if(u<releaseAt){
      /* 这一步在平滑姿势之后执行，球挂到的是本帧最终渲染出来的手，而不是
         尚未收敛的目标姿势。 */
      pregameHoldBall(guy,ball);
      return;
    }
    if(!seg._pregameBallRelease)seg._pregameBallRelease=pregameReleaseBall(guy,ball);
    const release=seg._pregameBallRelease;
    if(!release){ball.visible=false;return;}
    const flight=ease01(clamp((u-releaseAt)/Math.max(.01,landAt-releaseAt),0,1));
    const target=HOOP.clone();
    ball.visible=flight<.98;
    if(ball.visible){
      ball.position.lerpVectors(release,target,flight);
      ball.position.y+=Math.sin(flight*Math.PI)*1.12;
      ball.rotation.x+=.22;
    }
    return;
  }
  if(action!=="dunk"){ball.visible=false;return;}
  const timing=PREGAME_DUNK_TIMING;
  ball.material=matBall;
  if(u>=timing.contact&&u<timing.hangEnd){
    /* 平滑姿势完成后再钉一次腕部，保证实际渲染的 handRig 真正在篮圈前沿，
       同时把本帧结果写回缓存，下一帧不会从旧的根节点位置拉回去。 */
    pregamePinDunkHand(guy,u,seg._pregameDunkPoseWeight||0,true);
  }
  if(u<timing.ballRelease){
    /* Air Jordan pose 的 ballLocal 只作为“手掌相对球心”的校准偏移；球的父节点
       仍然是 ballGrip，所以过渡中的屈肘、抬臂、起跳都会把球一起带上去。 */
    pregameHoldBallAtPose(guy,ball,seg._pregameDunkPoseBall,seg._pregameDunkPoseWeight||0);
    seg._pregameDunkBallPhase="held";
    return;
  }
  if(!seg._pregameBallRelease)seg._pregameBallRelease=pregameReleaseBall(guy,ball);
  const release=seg._pregameBallRelease;
  if(!release){ball.visible=false;return;}
  const entry=V3(HOOP.x,HOOP.y+.24,HOOP.z+.12),center=V3(HOOP.x,HOOP.y+.015,HOOP.z),
    exit=V3(HOOP.x,HOOP.y-.46,HOOP.z+.025);
  if(u<timing.ballEntry){
    const k=ease01((u-timing.ballRelease)/Math.max(.001,timing.ballEntry-timing.ballRelease));
    ball.position.lerpVectors(release,entry,k);seg._pregameDunkBallPhase="to-rim";
  }else if(u<timing.ballThrough){
    const k=ease01((u-timing.ballEntry)/Math.max(.001,timing.ballThrough-timing.ballEntry));
    ball.position.lerpVectors(entry,center,k);seg._pregameDunkBallPhase="through-net";
  }else if(u<timing.ballExit){
    const k=ease01((u-timing.ballThrough)/Math.max(.001,timing.ballExit-timing.ballThrough));
    ball.position.lerpVectors(center,exit,k);seg._pregameDunkBallPhase="exit-net";
  }else{
    ball.visible=false;seg._pregameDunkBallPhase="scored";
    if(guy.g)guy.g.userData.pregameDunkBallPhase="scored";
    return;
  }
  ball.visible=true;ball.userData.pregameBallMode="dunk-flight";
  ball.rotation.set(u*Math.PI*7,u*Math.PI*4,u*Math.PI*5);
  if(seg._pregameDunkBallPhase==="through-net"&&!seg._pregameNetPulsed){
    seg._pregameNetPulsed=true;
    if(typeof setNetPulse==="function")setNetPulse(1);
  }
  if(guy.g)guy.g.userData.pregameDunkBallPhase=seg._pregameDunkBallPhase;
}
function pregameFocus(seg){
  const out=V3(0,0,0),list=seg.group?PREGAME.actors:[seg.actor];
  list.forEach(a=>out.add(a.guy.g.position));out.multiplyScalar(1/Math.max(1,list.length));
  if(seg.action==="dunk"||seg.action==="hang"){
    out.x=(out.x+HOOP.x)*0.5;out.z=(out.z+HOOP.z)*0.5;out.y=2.18;
  }else out.y=1.18;
  return out;
}
function pregameUpdateCamera(seg,u,dt){
  const focus=pregameFocus(seg),actor=seg.actor,guy=actor.guy;
  const face=guy.g.rotation.y||faceTo(actor.base,HOOP);
  const f=V3(Math.sin(face),0,Math.cos(face)),side=V3(f.z,0,-f.x).multiplyScalar(seg.side||1);
  const dest=V3(),look=focus.clone();look.y+=seg.action==="dunk"||seg.action==="hang"?0.45:0.18;
  if(seg.cam==="orbit"){
    const a=seg.seed+u*1.35,r=2.65+Math.sin(u*Math.PI)*0.45;
    dest.set(focus.x+Math.sin(a)*r,1.35+u*0.55,focus.z+Math.cos(a)*r);
  }else if(seg.cam==="push"){
    dest.copy(focus).addScaledVector(f,3.7-u*1.55).addScaledVector(side,0.85).setY(1.05+u*0.82);
  }else if(seg.cam==="low"){
    dest.copy(focus).addScaledVector(f,2.35).addScaledVector(side,0.9+u*0.3).setY(0.62+u*0.28);
  }else if(seg.cam==="overhead"){
    dest.copy(focus).addScaledVector(f,1.35).addScaledVector(side,1.65).setY(4.35-u*0.5);
    look.y=1.05;
  }else if(seg.cam==="follow"){
    dest.copy(focus).addScaledVector(f,2.35+Math.sin(u*Math.PI)*0.55).addScaledVector(side,0.75).setY(1.45);
  }else if(seg.cam==="pan"){
    dest.copy(focus).addScaledVector(f,2.45).addScaledVector(side,-1.55+u*3.1).setY(1.28);
  }else if(seg.cam==="pull"){
    dest.copy(focus).addScaledVector(f,1.75+u*2.05).addScaledVector(side,0.75).setY(1.25+u*0.45);
  }else{
    dest.copy(focus).addScaledVector(f,2.15).addScaledVector(side,1.05).setY(1.22+Math.sin(u*Math.PI)*0.12);
  }
  if(PREGAME.t<0.08||seg._justStarted){rig.pos.copy(dest);rig.look.copy(look);seg._justStarted=false;return;}
  rig.pos.lerp(dest,Math.min(1,dt*5.8));
  rig.look.lerp(look,Math.min(1,dt*7.5));
}
function startPreGameShow(opts,done){
  opts=opts||{};
  PREGAME.prevState=G.state;PREGAME.cb=done;PREGAME.t=0;PREGAME.idx=0;PREGAME.on=true;
  PREGAME.poseCache.clear();
  PREGAME.actors=pregameBuildActors(opts);
  const seen=new Set();
  PREGAME.snaps=PREGAME.actors.filter(a=>{if(seen.has(a.guy))return false;seen.add(a.guy);return true;}).map(a=>pregameSnapGuy(a.guy));
  PREGAME.shots=pregameBuildShots(opts);PREGAME.dur=PREGAME.shots.reduce((m,s)=>Math.max(m,s.start+s.dur),0);
  G.state="pregame";G.running=false;G.canShoot=false;G.charging=false;G.power=0;G.glideCam=false;G.moving=false;
  if(passing){scene.remove(passing.mesh);passing=null;passerBall.visible=true;}
  handBall.visible=false;pBall.visible=false;hands.visible=false;
  applyCamMode();
  player.g.visible=true;passer.g.visible=true;PREGAME.actors.forEach(a=>{a.guy.g.visible=true;if(a.guy.active!==undefined)a.guy.active=true;});
  if(PREGAME.shots[0]){PREGAME.shots[0]._justStarted=true;pregameCaption(PREGAME.shots[0]);}
}
function pregameReadyCameraTarget(){
  const shot=curShot();
  if(G.mode==="battle"){
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.48,marginY:1.36,minDist:5.8,maxDist:32});
    return {pos:camTarget.pos.clone(),look:camTarget.look.clone()};
  }
  if(G.mode==="rackrush"){
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.44,marginY:1.34,minDist:5.6,maxDist:18});
    return {pos:camTarget.pos.clone(),look:camTarget.look.clone()};
  }
  return {pos:shotEye(shot),look:HOOP.clone().add(V3(0,0.15,0))};
}
function finishPreGameShow(){
  const cb=PREGAME.cb,prev=PREGAME.prevState;
  PREGAME.snaps.forEach(pregameRestoreGuy);
  PREGAME.on=false;PREGAME.t=0;PREGAME.idx=0;PREGAME.shots=[];PREGAME.actors=[];PREGAME.snaps=[];PREGAME.cb=null;PREGAME.poseCache.clear();hidePregameChalk();
  $("vsBanner").style.display="none";
  P.jump=0;P.eyeDip=0;P.walking=false;G.state=prev;G.moving=false;G.glideCam=false;
  const ready=pregameReadyCameraTarget();
  glideTo(ready.pos,ready.look,0.75,()=>{if(cb)cb();});
}
function updPreGameShow(dt){
  if(!PREGAME.on)return;
  PREGAME.t+=dt;
  if(PREGAME.t>=PREGAME.dur){finishPreGameShow();return;}
  while(PREGAME.idx<PREGAME.shots.length-1&&PREGAME.t>PREGAME.shots[PREGAME.idx].start+PREGAME.shots[PREGAME.idx].dur){
    PREGAME.idx++;PREGAME.shots[PREGAME.idx]._justStarted=true;pregameCaption(PREGAME.shots[PREGAME.idx]);
  }
  const seg=PREGAME.shots[PREGAME.idx];if(!seg)return;
  const u=clamp((PREGAME.t-seg.start)/seg.dur,0,1);
  hidePregameChalk();
  PREGAME.actors.forEach(a=>{
    if(seg.group||a===seg.actor)pregameAnimate(a,seg.action,u,seg);
    else pregameIdle(a,PREGAME.t);
    pregameSmoothPose(a.guy,dt);
    if(seg.group||a===seg.actor)pregameSyncBallAfterPose(a,seg.action,u,seg);
  });
  pregameUpdateCamera(seg,u,dt);
}

window.AIBA.runtime.register("presentation:pregame",Object.freeze({
  PREGAME,startPreGameShow,pregameReadyCameraTarget,finishPreGameShow,updPreGameShow,
  setPregameDunkStyle,getPregameDunkStyle
}));
