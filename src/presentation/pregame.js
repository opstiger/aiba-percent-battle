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
/* 挂框定格(双手挂框)和双手扣篮都去掉了:动作很怪。扣篮改单手,并且大幅增加跳舞动作占比,去掉平淡挥手/拉伸 */
const PREGAME_ACTIONS=["dance","dance","dance","dunk","dunk","shoot","chalk"];
const PREGAME_CAMS=["bulletOrbit","whipPush","dunkBulletCam","lowHeroArc","finaleDualCrane","orbit","push","low","follow"];
const pregamePick=a=>a[(Math.random()*a.length)|0];
/* 这个球员现在是不是写实蒙皮(是的话能跳完整舞蹈,包括霹雳定格;方块人只跳 vox_ok 的) */
function pregameHasSkinnedRig(guy){
  try{return [window.AIBATripo].concat(window.AIBATripoRivals||[]).some(s=>s&&s.ready&&s.player===guy&&s.root);}catch(e){return false;}
}
function pregameSkinned(guy,actor){
  try{
    if(pregameHasSkinnedRig(guy))return true;
    const starId=(actor&&actor.star&&actor.star.id)||(guy&&guy.o&&guy.o.id)||(guy===player&&G.myStar&&G.myStar.id);
    if(starId&&window.AIBATripo&&Array.isArray(window.AIBATripo.models)&&window.AIBATripo.models.indexOf(starId)>=0)return true;
    return false;
  }catch(e){return false;}
}
const PREGAME_LABELS={
  shoot:"后撤步三分 · STEP-BACK",stretch:"热身律动",dunk:"飞跃暴扣 · SKY SLAM",chalk:"霸气撒镁粉 · CHALK TOSS",hang:"挂框定格",
  finger:"赛前热舞",huddle:"双星斗舞 · CYPHER",wave:"赛前热舞",pump:"赛前热舞",dance:"热身炫舞 · SHOWTIME"
};
const PREGAME_DANCE_LABELS={
  hiphop:"街头律动 · HIP-HOP",dancing:"花式舞步 · GROOVE",silly:"全场嗨舞 · SHOWTIME",
  freeze:"街舞定格 · FREEZE",freeze2:"倒立定格 · POWER FREEZE"
};
function ensurePregameDanceClip(seg,actor,avoidClip){
  if(!seg||!(window.AIBADance&&AIBADance.ready&&AIBADance.ids&&AIBADance.ids.length))return false;
  const avoidList=Array.isArray(avoidClip)?avoidClip.slice():(avoidClip?[avoidClip]:[]);
  if(Array.isArray(PREGAME.actors)){
    for(const a of PREGAME.actors){
      if(a&&a!==actor&&a._idleClip&&avoidList.indexOf(a._idleClip)<0)avoidList.push(a._idleClip);
    }
  }
  if(!seg.clip){
    const clip=AIBADance.pick(pregameSkinned(actor&&actor.guy,actor),avoidList);
    if(clip){
      seg.clip=clip;
      const c=AIBADance.clips[clip];
      seg.danceStart=c?rnd(0,Math.max(0,c.dur-(seg.dur||2.3)-.2)):0;
    }
  }
  if(seg.group&&PREGAME.actors.length>1&&!seg.clip2){
    const other=PREGAME.actors.find(a=>a!==actor)||PREGAME.actors[1];
    const avoid2=[seg.clip].concat(avoidList).filter(Boolean);
    const clip2=AIBADance.pick(pregameSkinned(other&&other.guy,other),avoid2);
    if(clip2){
      seg.clip2=clip2;
      const c2=AIBADance.clips[clip2];
      seg.danceStart2=c2?rnd(0,Math.max(0,c2.dur-(seg.dur||2.3)-.2)):0;
    }
  }
  return !!seg.clip;
}
function pregameHermiteWarp(x,r0,r1,u0,u1){
  x=clamp(x,0,1);
  const mSlow=(u1-u0)/Math.max(.001,r1-r0);
  if(x<=r0){
    const s=x/Math.max(.001,r0),s2=s*s,s3=s2*s;
    const d0=1.62*u0,d1=mSlow*r0;
    return (s3-2*s2+s)*d0+(-2*s3+3*s2)*u0+(s3-s2)*d1;
  }
  if(x<r1)return u0+(x-r0)*mSlow;
  const span=Math.max(.001,1-r1),s=(x-r1)/span,s2=s*s,s3=s2*s;
  const d0=mSlow*span,d1=1.62*(1-u1);
  return (2*s3-3*s2+1)*u1+(s3-2*s2+s)*d0+(-2*s3+3*s2)+(s3-s2)*d1;
}
/* 电影级变速(加速->子弹时间慢镜->加速):仅对带 seg.speedRamp 的真实热身镜头生效,保持合成测试线性时间轴兼容 */
function pregameWarpU(rawU,seg){
  if(!seg||!seg.speedRamp)return rawU;
  if(seg.action==="dunk")return pregameHermiteWarp(rawU,.25,.74,.35,.64);
  if(seg.action==="shoot"||seg.action==="chalk")return pregameHermiteWarp(rawU,.25,.72,.40,.61);
  return pregameHermiteWarp(rawU,.24,.72,.38,.58);
}
function pregameBulletWeight(rawU,seg){
  if(!seg||!seg.speedRamp)return 0;
  const r0=seg.action==="dunk"?.25:.24,r1=seg.action==="dunk"?.74:.72;
  return smoothRange(r0-.06,r0+.07,rawU)*(1-smoothRange(r1-.07,r1+.06,rawU));
}
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
  let d=a-b;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return b+d*(1-k);
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
  const x=heroPos.x+(heroPos.x>0?-1.85:1.85)*(side||1);
  const z=heroPos.z+0.25;
  return pregameClampPos(V3(x,0,z));
}
function pregameBuildActors(opts){
  const heroName=G.myStar&&G.myStar.n?G.myStar.n:"YOU";
  const actors=[{guy:player,name:heroName,role:"hero",star:G.myStar||null,base:P.pos.clone(),face:P.face}];
  let other=null;
  const oppStar=opts.mode==="battle"?G.battleOpp:(G.stage==="final"?G.finalist:(G.opponents&&G.opponents[0]));
  if(oppStar&&rivals&&rivals[0]){
    rivals[0].o=oppStar;
    rivals[0].active=true;
    other={guy:rivals[0],name:oppStar.n||"对手",role:"opponent",star:oppStar};
  }else if(opts.mode==="battle"&&G.battleOpp&&rivals[0]){
    other={guy:rivals[0],name:G.battleOpp.n||"对手",role:"opponent",star:G.battleOpp};
  }else{
    const rv=rivals.find(x=>x.active);
    if(rv&&rv!==actors[0].guy)other={guy:rv,name:rv.o&&rv.o.n?rv.o.n:"挑战者",role:"opponent",star:rv.o||null};
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
  const hero=actors[0],rival=actors[1]||actors[0];
  /* 5幕电影级转播热身秀(~11.4s):每一幕都有明确主角(球员或吉祥物),主打街舞/定格炫舞+飞跃暴扣+子弹时间环绕跟拍 */
  const dunkActor=actors.length>1&&Math.random()<0.45?rival:hero;
  const showcaseActor=dunkActor===hero?rival:hero;
  const showcaseAction=pregamePick(["dance","dance","dance","chalk","shoot"]);
  const plan=[
    {actor:hero,action:"dance",cam:"bulletOrbit",dur:rnd(2.25,2.45),side:1,group:false},
    {actor:rival,action:"dance",cam:"whipPush",dur:rnd(2.20,2.40),side:-1,group:false},
    {actor:dunkActor,action:"dunk",cam:"dunkBulletCam",dur:rnd(2.35,2.55),side:Math.random()<0.5?-1:1,group:false},
    {actor:showcaseActor,action:showcaseAction,cam:"lowHeroArc",dur:showcaseAction==="dance"?rnd(2.15,2.35):rnd(1.95,2.15),side:1,group:false},
    {actor:hero,action:"dance",cam:"finaleDualCrane",dur:rnd(2.20,2.40),side:-1,group:actors.length>1}
  ];
  let t=0;const usedClips=[];
  for(let i=0;i<plan.length;i++){
    const item=plan[i],actor=item.actor||hero;
    const seg={
      start:t,dur:item.dur,actor,action:item.action,cam:item.cam,
      side:item.side,seed:rnd(-0.75,0.75),group:!!item.group,speedRamp:true
    };
    if(seg.action==="dance"){
      ensurePregameDanceClip(seg,actor,usedClips);
      if(seg.clip&&usedClips.indexOf(seg.clip)<0)usedClips.push(seg.clip);
      if(seg.clip2&&usedClips.indexOf(seg.clip2)<0)usedClips.push(seg.clip2);
    }
    shots.push(seg);
    t+=seg.dur;
  }
  return shots;
}
function pregameCaption(seg,bulletActive){
  const el=$("vsBanner");
  if(el)el.style.display="none";
}
function pregamePlace(actor,pos,face){
  const guy=actor.guy;
  guy.g.visible=true;guy.g.position.set(pos.x,0,pos.z);guy.g.rotation.order="XYZ";guy.g.rotation.set(0,face,0);
}
function pregameActionBase(actor,action,u,seg){
  const base=actor.base.clone();
  if((action==="huddle"||(seg&&seg.group))&&PREGAME.actors.length>1){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other){
      const mid=actor.base.clone().lerp(other.base,0.5);
      base.copy(mid);base.x+=(actor.role==="hero"?-0.56:0.56);
    }
  }
  if(action==="dunk"||action==="hang"){
    const rimSpot=V3(action==="hang"?0:(actor.role==="opponent"?0.16:-0.16),0,HOOP.z+(action==="hang"?0.34:0.52));
    const approachEnd=action==="hang"?.34:PREGAME_DUNK_TIMING.contact;
    base.lerp(rimSpot,ease01(clamp(u/approachEnd,0,1)));
  }
  return pregameClampPos(base);
}
function pregameIdle(actor,t,seg){
  const guy=actor.guy,ball=pregameBallFor(guy);
  pregamePlace(actor,actor.base,actor.face);pregameNeutral(guy);
  if(ball)ball.visible=false;
  if(window.AIBADance&&AIBADance.ready&&AIBADance.ids&&AIBADance.ids.length){
    const other=PREGAME.actors.find(a=>a!==actor);
    const activeClip=seg&&seg.clip;
    const avoid=[activeClip,seg&&seg.clip2,other&&other._idleClip].filter(Boolean);
    if(!actor._idleClip||(activeClip&&actor._idleClip===activeClip)||(seg&&seg.clip2&&actor._idleClip===seg.clip2)||(other&&other._idleClip&&actor._idleClip===other._idleClip)){
      actor._idleClip=AIBADance.pick(pregameSkinned(guy,actor),avoid);
    }
    const smp=actor._idleClip?AIBADance.sample(actor._idleClip,t+(actor.role==="hero"?0:1.7)):null;
    if(smp){
      const hasRig=pregameHasSkinnedRig(guy),clipInfo=AIBADance.clips[actor._idleClip];
      if(!hasRig&&clipInfo&&clipInfo.vox_ok)AIBADance.applyVox(guy,smp.vox,0.78);
      if(hasRig||pregameSkinned(guy,actor)){
        if(!guy._danceQ)guy._danceQ=new Float32Array(smp.q.length);
        guy._danceQ.set(smp.q);
        guy.pregameDance={q:guy._danceQ,hy:smp.hy,w:0.78};
      }
      return;
    }
  }
  const groove=Math.sin(t*6.2+(actor.role==="hero"?0:1.4));
  guy.g.position.y=Math.abs(groove)*0.045;
  guy.g.rotation.z=groove*0.035;
  guy.arms[0].rotation.x=-0.95+groove*0.28;
  guy.arms[1].rotation.x=-0.95-groove*0.28;
  guy.elbows.forEach(e=>e.rotation.x=-0.65);
}
/* 扣篮不是“跳到最高点后把球从身体旁边抛向篮筐”。热身镜头需要读出一条完整的
   动作因果链：起跳持球 -> 球从篮圈上方压入网 -> 投篮手抓住篮圈 -> 身体摆一下
   再松手落地。所有时间点都放在同一条 segment 时间轴上，便于截图回归和以后
   在 T台/游戏之间继续微调。 */
/* 时间轴(占整段的比例):先在地面助跑到离篮筐约 1.6 米(0→.40),再起跳(.40→.56),
   手到篮圈(.56)→ 球压进网 → 挂一下 → 落地。以前从三分线外一起步就离地,等于飞了七米。 */
const PREGAME_DUNK_TIMING=Object.freeze({
  takeoffStart:.28,contact:.52,ballRelease:.53,ballEntry:.57,ballThrough:.63,
  ballExit:.70,hangEnd:.55,landEnd:.86
});
function pregameDunkAir(u){
  const t=PREGAME_DUNK_TIMING;
  if(u<=t.takeoffStart||u>=t.landEnd)return 0;
  return Math.sin(clamp((u-t.takeoffStart)/Math.max(.001,t.landEnd-t.takeoffStart),0,1)*Math.PI);
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
  guy.g.rotation.z=swing*.095;
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
  const base=pregameActionBase(actor,action,u,seg);
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
    /* 单手扣篮:持球手(arms[0])把球举到篮圈,另一只手向外张开保持平衡,前腿提膝、后腿微屈。
       以前是双手一起举过头 + Air Jordan 静态姿势,看着像举手投降 */
    const timing=PREGAME_DUNK_TIMING,air=pregameDunkAir(u);
    const gripRise=Math.max(0.98,HOOP.y-2.01+0.015);
    guy.g.position.y=0.08+air*gripRise;
    const reach=u<timing.contact
      ?smoothRange(timing.takeoffStart,timing.contact,u)
      :u<timing.hangEnd?1:1-smoothRange(timing.hangEnd,timing.landEnd,u);
    guy.arms[0].rotation.x=-0.42-2.62*reach;guy.arms[0].rotation.z=-0.06*reach;
    guy.elbows[0].rotation.x=-0.3-0.12*reach;
    guy.arms[1].rotation.x=-0.42-0.35*reach;guy.arms[1].rotation.z=0.12+0.95*reach;
    guy.elbows[1].rotation.x=-0.3-0.3*reach;
    guy.legs[0].rotation.x=-0.12-0.72*air;guy.legs[1].rotation.x=0.1+0.3*air;
    guy.knees[0].rotation.x=0.18+0.95*air;guy.knees[1].rotation.x=0.18+0.5*air;
    /* 助跑:离地之前两腿按跑过的距离交替迈步,身体前倾,球夹在持球手腰侧,另一只手摆臂 */
    const runK=1-smoothRange(timing.takeoffStart-.05,timing.takeoffStart+.03,u);
    if(runK>0.001){
      const ph=base.distanceTo(actor.base)*3.3,sw=Math.sin(ph);
      guy.legs[0].rotation.x+=runK*(-0.2+sw*0.85);guy.legs[1].rotation.x+=runK*(-0.2-sw*0.85);
      guy.knees[0].rotation.x+=runK*(0.35+Math.max(0,-sw)*0.9);guy.knees[1].rotation.x+=runK*(0.35+Math.max(0,sw)*0.9);
      guy.arms[0].rotation.x+=runK*(-0.5);guy.elbows[0].rotation.x+=runK*(-0.75);
      guy.arms[1].rotation.x+=runK*(sw*0.7);guy.elbows[1].rotation.x+=runK*(-0.6);
      guy.g.rotation.x=0.17*runK;
      guy.g.position.y+=runK*Math.abs(Math.cos(ph))*0.045;
    }
    if(ball)ball.material=matBall;
    seg._pregameDunkPoseWeight=0;seg._pregameDunkPoseBall=null;
    const phase=pregameDunkPhase(u);
    seg._pregameDunkPhase=phase;
    if(guy.g){
      guy.g.userData.pregameDunkStyle="one-hand";
      guy.g.userData.pregameDunkPoseWeight=0;
      guy.g.userData.pregameDunkPhase=phase;
    }
    if(u>=timing.contact&&u<timing.hangEnd)pregamePinDunkHand(guy,u,0,false);
  }else if(action==="hang"){
    const hangRise=smoothRange(.1,.32,u),hangRelease=smoothRange(.48,.7,u);
    const hang=hangRise*(1-hangRelease),gripRise=Math.max(0.98,HOOP.y-2.01+0.015);
    guy.g.position.y=0.08+hang*gripRise;
    const reach=hangRise*(1-hangRelease*.8);
    guy.arms.forEach(a=>a.rotation.x=-0.42-2.72*reach);
    guy.elbows.forEach(e=>e.rotation.x=-0.3-0.48*reach);
    guy.legs[0].rotation.x=-0.12-0.3*hang;guy.legs[1].rotation.x=0.1+0.24*hang;
    guy.knees.forEach(k=>k.rotation.x=0.18+0.54*hang);
  }else if(action==="dance"){
    /* 热身舞蹈:写实皮套走骨骼(guy.pregameDance),方块人走关节参数;出入场各 10% 平滑混合 */
    const usedSoFar=PREGAME.shots.filter(s=>s!==seg&&(s.clip||s.clip2)).reduce((arr,s)=>{
      if(s.clip)arr.push(s.clip);if(s.clip2)arr.push(s.clip2);return arr;
    },[]);
    ensurePregameDanceClip(seg,actor,usedSoFar);
    const isSecond=seg.group&&actor!==seg.actor&&seg.clip2;
    const clipId=isSecond?seg.clip2:seg.clip;
    const dStart=isSecond?(seg.danceStart2||0):(seg.danceStart||0);
    const smp=window.AIBADance&&clipId?AIBADance.sample(clipId,dStart+u*seg.dur):null;
    if(smp){
      const w=smoothRange(0,.10,u)*(1-smoothRange(.90,1,u));
      const hasRig=pregameHasSkinnedRig(guy),skinned=pregameSkinned(guy,actor),clipInfo=AIBADance.clips[clipId];
      if(!hasRig&&clipInfo&&clipInfo.vox_ok)AIBADance.applyVox(guy,smp.vox,w);   // 写实皮套走骨骼,方块人才走关节参数
      if(hasRig||skinned){
        if(!guy._danceQ)guy._danceQ=new Float32Array(smp.q.length);
        guy._danceQ.set(smp.q);
        guy.pregameDance={q:guy._danceQ,hy:smp.hy,w};
      }
    }else{
      const groove=Math.sin(t*8.5);
      guy.g.position.y=Math.abs(groove)*0.07;guy.g.rotation.z=groove*0.06;
      guy.arms[0].rotation.x=-1.25+groove*0.45;guy.arms[1].rotation.x=-1.25-groove*0.45;
      guy.elbows.forEach(e=>e.rotation.x=-0.85);
    }
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
  if((action==="finger"||action==="wave"||action==="dance")&&guy.headRoot){
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
      if(!seg._pregameSpin)seg._pregameSpin={mesh:ball,v0:target.clone().sub(release),spinStartQuaternion:ball.quaternion.clone()};
      poseBallSpinAtTime(seg._pregameSpin,Math.max(0,u-releaseAt)*(Number(seg.dur)||1));
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
    /* 球跟着持球手走:抬臂过程中从挂点滑到手掌上方,到篮圈时球就在手里(以前球留在胸口,出手那一帧瞬移到篮筐上) */
    if(pregameHoldBall(guy,ball)){
      const grip=pregameBallGrip(guy),hand=guy.handRoots&&guy.handRoots[0];
      const w=smoothRange(timing.takeoffStart-.06,timing.contact-.05,u);
      if(grip&&hand&&w>0){
        guy.g.updateMatrixWorld(true);
        const hw=hand.getWorldPosition(V3());hw.y+=0.15;hw.z-=0.05;
        ball.position.lerp(grip.worldToLocal(hw),w);
      }
    }
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
  const actor=seg.actor||PREGAME.actors[0];
  const heroPos=actor&&actor.guy&&actor.guy.g?actor.guy.g.position:V3(0,0,0);
  const out=heroPos.clone();
  const isDunk=seg.action==="dunk"||seg.action==="hang";
  /* 单人镜头 100% 锁定当前主角(球员或吉祥物),绝不把焦点拉向远端另一名球员导致画面空场;
     仅在双人同框斗舞(seg.group)且两人已并肩站拢时取两人中心点 */
  if(!isDunk&&seg.group&&PREGAME.actors.length>1){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other&&other.guy&&other.guy.g){
      out.x=out.x*0.5+other.guy.g.position.x*0.5;
      out.z=out.z*0.5+other.guy.g.position.z*0.5;
    }
  }
  const lift=Math.max(0,heroPos.y||0);
  if(isDunk){
    const rimBlend=clamp(lift/1.1,0,1)*0.22;
    out.x=out.x*(1-rimBlend)+HOOP.x*rimBlend;
    out.z=out.z*(1-rimBlend)+HOOP.z*rimBlend;
    out.y=1.16+lift*0.88;
  }else{
    out.y=1.06+lift*0.78;
  }
  return out;
}
/* 子弹时间环绕相位:在慢动作窗口内相机反而加速甩镜环绕,形成黑客帝国/NBA转播级“人慢镜快”的强烈反差 */
function pregameOrbitPhase(rawU){
  const slowSweep=smoothRange(0.20,0.76,rawU);
  return clamp(rawU*0.32+slowSweep*0.68,0,1);
}
function pregameUpdateCamera(seg,rawU,u,dt){
  if(dt===undefined){dt=u;u=rawU;}
  const focus=pregameFocus(seg),actor=seg.actor||PREGAME.actors[0],guy=actor.guy;
  const face=guy.g.rotation.y||faceTo(actor.base,HOOP);
  /* 镜头始终放在球员正面偏侧(朝向球员与球场中心/聚光灯),绝不跑到篮架背后拍空场 */
  const f=V3(Math.sin(face),0,Math.cos(face)),side=V3(f.z,0,-f.x).multiplyScalar(seg.side||1);
  const front=f.clone(); // 镜头站在球员面朝的正前方，拍正脸而不是屁股后面
  const dest=V3(),look=focus.clone();
  const isDunk=seg.action==="dunk"||seg.action==="hang";
  const bulletK=pregameBulletWeight(rawU,seg);
  const orbU=pregameOrbitPhase(rawU);
  look.y+=isDunk?0.14:(0.06-bulletK*0.04);
  let targetFov=50;
  if(seg.cam==="finaleDualCrane"||(seg.group&&PREGAME.actors.length>1)){
    /* 终幕双星同框斗舞:低机位贴身环绕切入 -> 子弹时间 160° 掠过双主角 -> 摇臂拉升俯瞰全场聚光灯与烟花 */
    const craneK=smoothRange(0.54,1.0,rawU);
    const a=(orbU-0.5)*2.15;
    const r=2.45-bulletK*0.28+craneK*1.25;
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(0.84+orbU*0.32+craneK*0.68);
    targetFov=48+craneK*5;
  }else if(isDunk||seg.cam==="dunkBulletCam"){
    /* 飞跃暴扣:助跑低角度侧跟 -> 起跳瞬间切入篮下 150° 子弹时间仰拍环绕 -> 挂框震网特写 */
    const airK=smoothRange(0.24,0.76,rawU);
    const a=-1.08+orbU*2.18;
    const r=2.72-bulletK*0.52;
    const liftY=Math.min(0.82,(guy.g.position.y||0)*0.48);
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(1.12-bulletK*0.24+liftY*(1-bulletK*0.35)+airK*0.18);
    targetFov=51+bulletK*5.5;
  }else if(seg.cam==="bulletOrbit"||seg.cam==="orbit"){
    /* 180° 子弹时间环绕跟拍:高速甩入 -> 慢镜时刻贴身低机位大角度环绕主角 -> 甩出 */
    const a=-1.34+orbU*2.68;
    const r=2.95-bulletK*0.76+Math.sin(rawU*Math.PI)*0.12;
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(1.22-bulletK*0.42+rawU*0.18);
    targetFov=50-bulletK*6.5;
  }else if(seg.cam==="whipPush"||seg.cam==="push"){
    /* 急速推轨 + 环绕甩镜:远景急速推进特写 + 子弹时间绕身旋转 */
    const pushK=ease01(clamp(rawU/0.38,0,1));
    const a=-0.95+orbU*2.15;
    const r=3.45-pushK*1.12-bulletK*0.22+(1-bulletK)*0.15;
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(1.34-pushK*0.46+Math.sin(orbU*Math.PI)*0.16);
    targetFov=51-bulletK*7.0;
  }else if(seg.cam==="lowHeroArc"||seg.cam==="low"){
    /* 英雄超低机位仰拍环绕:凸显街舞 Freeze 定格/撒镁粉/后撤步出手张力 */
    const a=-1.18+orbU*2.36;
    const r=2.62-bulletK*0.45;
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(0.72+bulletK*0.08+rawU*0.34);
    targetFov=49-bulletK*5.5;
  }else if(seg.cam==="overhead"){
    dest.copy(focus).addScaledVector(front,2.95).addScaledVector(side,1.05).setY(2.55-u*0.45);
    look.y=0.98;
  }else if(seg.cam==="follow"){
    dest.copy(focus).addScaledVector(front,2.65+Math.sin(u*Math.PI)*0.35).addScaledVector(side,0.92).setY(1.24);
  }else if(seg.cam==="pan"){
    dest.copy(focus).addScaledVector(front,2.75).addScaledVector(side,-1.15+u*2.3).setY(1.18);
  }else if(seg.cam==="pull"){
    dest.copy(focus).addScaledVector(front,2.45+u*1.35).addScaledVector(side,0.72).setY(1.18+u*0.42);
  }else{
    const a=-1.1+orbU*2.2,r=2.68-bulletK*0.42;
    dest.copy(focus).addScaledVector(front,Math.cos(a)*r).addScaledVector(side,Math.sin(a)*r).setY(1.08-bulletK*0.22);
  }
  dest.x=clamp(dest.x,-COURT.halfWidth+0.75,COURT.halfWidth-0.75);
  dest.z=clamp(dest.z,HOOP.z+1.05,COURT.playMaxZ+2.6);
  /* 保持相机与主角的安全跟拍半径,防止贴边裁切时穿过人物身体 */
  const dx=dest.x-focus.x,dz=dest.z-focus.z,distXZ=Math.hypot(dx,dz);
  if(distXZ<1.92){
    const s=1.92/Math.max(0.001,distXZ);
    dest.x=clamp(focus.x+dx*s,-COURT.halfWidth+0.65,COURT.halfWidth-0.65);
    dest.z=clamp(focus.z+dz*s,HOOP.z+0.95,COURT.playMaxZ+2.7);
  }
  if(typeof camera!=="undefined"&&camera&&typeof camera.updateProjectionMatrix==="function"){
    const nextFov=PREGAME.t<0.08||seg._justStarted?targetFov:camera.fov+(targetFov-camera.fov)*Math.min(1,dt*10);
    if(Math.abs(nextFov-camera.fov)>0.02){camera.fov=nextFov;camera.updateProjectionMatrix();}
  }
  if(PREGAME.t<0.08||seg._justStarted){rig.pos.copy(dest);rig.look.copy(look);seg._justStarted=false;return;}
  rig.pos.lerp(dest,Math.min(1,dt*15.5));
  rig.look.lerp(look,Math.min(1,dt*22.0));
}
/* 跳过按钮:第二次看同一段演示的人不该被按住。直接走正常收场(finishPreGameShow),灯光秀会跟着进收场段 */
let pregameSkipEl=null;
function pregameSkipButton(show){
  if(typeof document==="undefined")return;
  if(show&&!pregameSkipEl){
    const b=pregameSkipEl=document.createElement("button");
    b.id="pregameSkip";b.type="button";b.className="btn sm";b.textContent="跳过 ≫";
    b.style.cssText="position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:60;pointer-events:auto;opacity:.86;margin:0";
    const go=e=>{e.preventDefault();e.stopPropagation();if(PREGAME.on)finishPreGameShow();};
    b.addEventListener("pointerdown",go);b.addEventListener("click",go);
    document.body.appendChild(b);
  }
  if(pregameSkipEl)pregameSkipEl.style.display=show?"block":"none";
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
  if(PREGAME.shots[0]){PREGAME.shots[0]._justStarted=true;pregameCaption(PREGAME.shots[0],false);}
  pregameSkipButton(true);
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
  PREGAME.actors.forEach(a=>{a.guy.pregameLift=0;a.guy.pregameDance=null;});
  if(typeof camera!=="undefined"&&camera&&typeof camera.updateProjectionMatrix==="function"&&camera.fov!==50){
    camera.fov=50;camera.updateProjectionMatrix();
  }
  PREGAME.on=false;PREGAME.t=0;PREGAME.idx=0;PREGAME.shots=[];PREGAME.actors=[];PREGAME.snaps=[];PREGAME.cb=null;PREGAME.poseCache.clear();hidePregameChalk();
  $("vsBanner").style.display="none";pregameSkipButton(false);
  P.jump=0;P.eyeDip=0;P.walking=false;G.state=prev;G.moving=false;G.glideCam=false;
  const ready=pregameReadyCameraTarget();
  glideTo(ready.pos,ready.look,0.75,()=>{if(cb)cb();});
}
function updPreGameShow(dt){
  if(!PREGAME.on)return;
  PREGAME.t+=dt;
  if(PREGAME.t>=PREGAME.dur){finishPreGameShow();return;}
  while(PREGAME.idx<PREGAME.shots.length-1&&PREGAME.t>PREGAME.shots[PREGAME.idx].start+PREGAME.shots[PREGAME.idx].dur){
    PREGAME.idx++;PREGAME.shots[PREGAME.idx]._justStarted=true;PREGAME.shots[PREGAME.idx]._bulletBadge=false;
    pregameCaption(PREGAME.shots[PREGAME.idx],false);
  }
  const seg=PREGAME.shots[PREGAME.idx];if(!seg)return;
  const rawU=clamp((PREGAME.t-seg.start)/seg.dur,0,1);
  const u=pregameWarpU(rawU,seg);
  const bulletActive=pregameBulletWeight(rawU,seg)>0.42;
  if(bulletActive!==!!seg._bulletBadge){seg._bulletBadge=bulletActive;pregameCaption(seg,bulletActive);}
  hidePregameChalk();
  PREGAME.actors.forEach(a=>{
    a.guy.pregameDance=null;
    if(seg.group||a===seg.actor)pregameAnimate(a,seg.action,u,seg);
    else pregameIdle(a,PREGAME.t,seg);
    pregameSmoothPose(a.guy,dt);
    /* 写实蒙皮皮套靠这个字段知道人在空中(P.jump 在热身里不动);跳舞时接地由骨骼包络自行控制,不叠加虚假腾空 */
    a.guy.pregameLift=a.guy.pregameDance?0:Math.max(0,a.guy.g.position.y-.06);
    if(seg.group||a===seg.actor)pregameSyncBallAfterPose(a,seg.action,u,seg);
  });
  pregameUpdateCamera(seg,rawU,u,dt);
}

window.AIBA.runtime.register("presentation:pregame",Object.freeze({
  PREGAME,startPreGameShow,pregameReadyCameraTarget,finishPreGameShow,updPreGameShow,
  setPregameDunkStyle,getPregameDunkStyle
}));
