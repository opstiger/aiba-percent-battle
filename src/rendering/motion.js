/* shooting pose driven by charge phase: 下蹲→举球(屈肘)→起跳伸展→顶点出手=完美 */
let poseK=0,landT=0;
const SHOT_STANCE_YAW=Math.PI/9;
function ease01(t){
  t=clamp(t,0,1);
  return t*t*(3-2*t);
}
const mixN=(a,b,k)=>a+(b-a)*k;
function shotCurves(ph){
  const loadIn=ease01(ph/0.32);
  const rise=ease01((ph-0.58)/0.28);
  return {
    dip:loadIn*(1-rise),
    lift:ease01((ph-0.28)/0.48),
    rise,
    jmp:ease01((ph-0.76)/0.22),
    over:Math.max(0,ph-1)
  };
}
function poseFootBottomY(hip,knee,ankle){
  const a1=hip,a2=hip+knee,a3=hip+knee+ankle;
  return 0.78
    -0.34*Math.cos(a1)
    -0.32*Math.cos(a2)
    -0.04*Math.cos(a3)
    -0.05*Math.sin(a3)
    -0.065*Math.abs(Math.cos(a3))
    -0.15*Math.abs(Math.sin(a3));
}
const POSE_STAND_FOOT_Y=poseFootBottomY(0,0,0);
const HAND_FINGER_REST=-.08;
const HAND_FINGER_FOLLOW=[.14,.38,Math.PI/6,.16];
/* v2.19.5 手部动作链：整段投篮只有两个关键帧、一个相位、一种坐标空间。
   SHOT_READY_POSE = 接球到手后的胸前持球(逐项就是 T台导入前的旧版持球姿势)，
   SHOT_SET_POSE   = T台导入的满蓄力最高点(常量原封不动)。
   抬球段 k=ease01(lift) 把肩点 / 骨长 / 肩肘腕四元数 / 手指一起从前者插到后者，
   k=1 时每一项都逐字等于 SHOT_SET_POSE，所以前段怎么调都动不到最高点。
   注意两条铁律：
   1) 持球段的腕部一律写 parent-local(手相对前臂)，绝不用世界/球员局部的绝对朝向
      反解——那会让手掌不跟着大臂走，就是 v2.19.4 “手全乱”的根因；
   2) 抬球段不再让旧版肩肘曲线继续驱动投篮臂。球现在硬挂在投篮手 ballGrip 上，
      旧曲线的中段会把球甩到体前 0.9m 再收回来；两个关键帧直插才有顺畅的上升弧。
   世界方向约束只留给出手后的 follow-through：那时球已脱手，掌心朝地、指尖朝框。 */
const HAND_ROOT_BASE={x:0,y:-.29,z:.01};
const READY_FADE_IN=.3;          // 非玩家(对手/过场)从站姿淡入持球帧的 lift 长度
/* 迎球掌面 → 持球握法要转约 130°，0.18s 会到 17°/帧偏跳；0.28s 落到约 11°/帧。
   期间若玩家已按下蓄力，settle 只是把迎球帧与本帧蓄力目标混合，仍然连续收敛。 */
const CATCH_SETTLE_SECONDS=.28;
/* 压腕必须发生在球脱手之后。ballGrip 在掌心前方约 19cm，压腕会把它从掌上翻到掌下：
   若压腕与伸肘共用同一条 extend 曲线，球会在真正 release 前先掉 33cm，出手点比
   最高点还低，看上去就不是"从托着球的手掌直接送出去"。
   SHOT_WRIST_SNAP_DELAY 必须与 shot-motion.js 的 BALL_RELEASE_AT 对齐(check.js 有断言)：
   0 → DELAY 只伸肩肘把球往上往前送，球在 DELAY 脱手(球心此刻全程最高)，之后手腕才压下去。 */
const SHOT_WRIST_SNAP_DELAY=.092;
const SHOT_WRIST_SNAP_SECONDS=.13;
const SHOT_SET_BALL={x:-.106,y:1.8962,z:.3201};
const SHOOT_FINGER_SPLAY=[.0525,.0175,-.0175,-.0525];
const GUIDE_FINGER_SPLAY=[.0525,.0175,-.0175,-.0525];
const SHOT_SET_POSE=Object.freeze({
  shooting:Object.freeze({
    shoulder:Object.freeze([-.285,1.36,0]),
    upperLength:.330734607,
    lowerLength:.276592301,
    armQuat:Object.freeze([-.771945537,0,.075446120,.631195667]),
    elbowQuat:Object.freeze([-.211899914,-.622461483,.529677286,.535800431]),
    handQuat:Object.freeze([.275696195,-.659803686,-.572028782,-.401788223]),
    curl:.28
  }),
  guide:Object.freeze({
    shoulder:Object.freeze([.3141,1.36,0]),
    upperLength:.305539539,
    lowerLength:.307871632,
    armQuat:Object.freeze([-.754591073,0,-.399618856,.520477744]),
    elbowQuat:Object.freeze([-.217816534,.142860016,-.213889428,.941487273]),
    handQuat:Object.freeze([.055782583,-.267888208,.221143724,-.936066058]),
    curl:.18
  })
});
/* 关键帧 A：接球到手后的胸前持球。腕部四元数与手指曲度直接沿用 SHOT_SET_POSE——
   握球方式从接到球那一刻就定死，抬球段只有肩和肘在动，手腕全程几乎不转，
   所以不会再出现掌面追不上小臂的乱转。肩肘四元数由脚本反解得到：把 T台最高点
   分别在躯干空间绕 X 放下 91°/上臂空间开肘 21°，使球心落到体前 (-.13,1.20,.52)、
   辅助手掌心贴在球的另一侧 (.03,1.17,.55)。 */
const SHOT_READY_POSE=Object.freeze({
  shooting:Object.freeze({
    armQuat:Object.freeze([-.089994,-.053858,.052834,.993081]),
    elbowQuat:Object.freeze([-.306843,-.514408,.635139,.487679]),
    handQuat:SHOT_SET_POSE.shooting.handQuat
  }),
  guide:Object.freeze({
    armQuat:Object.freeze([-.337447,.222332,-.332060,.852311]),
    elbowQuat:Object.freeze([-.132315,.161506,-.200184,.957254]),
    handQuat:SHOT_SET_POSE.guide.handQuat
  })
});
/* 迎球帧：双手抬到胸前"要球"，掌心正对来球、手指朝上。
   原来大臂垂在身侧、腕只有 1.0m —— 第一人称下整双手的 NDC y 都在 -1.04~-1.39，
   全部掉出画面下缘，只剩指尖蹭到画面底边，看着就是"两坨奇怪的形状"。
   现在腕抬到 1.40m(与肩基本同高)、体前 0.59m，掌心朝向 (0,0,1)、手指朝上 (0,.97,0)，
   双掌间距 0.47m。 */
const SHOT_CATCH_POSE=Object.freeze({
  shooting:Object.freeze({
    armQuat:Object.freeze([-.639191,.095356,-.080318,.758875]),
    elbowQuat:Object.freeze([-.247404,0,0,.968912]),
    handQuat:Object.freeze([-.581035,0,0,.813878])
  }),
  guide:Object.freeze({
    armQuat:Object.freeze([-.639191,-.095356,.080318,.758875]),
    elbowQuat:Object.freeze([-.247404,0,0,.968912]),
    handQuat:Object.freeze([-.581035,0,0,.813878])
  })
});
/* 每次接球随机一点变化：双手要球 / 单手抬高要球，另一只手位置也各有微差。
   纯视觉，不影响接球判定(球始终落到 handRoots[0])。 */
const CATCH_VARIANTS=Object.freeze([
  {name:"双手",lead:1,off:{arm:0,elbow:0,wrist:0}},
  {name:"双手偏高",lead:1,off:{arm:-.14,elbow:-.10,wrist:.06}},
  {name:"投篮手抬高",lead:0,off:{arm:.30,elbow:.22,wrist:-.12}},
  {name:"辅助手抬高",lead:1,off:{arm:.30,elbow:.22,wrist:-.12}}
]);
let catchVariant=CATCH_VARIANTS[0];
function pickCatchVariant(){
  catchVariant=CATCH_VARIANTS[(Math.random()*CATCH_VARIANTS.length)|0];
  return catchVariant;
}
const SHOT_FOLLOW_POSE=Object.freeze({
  /* 肩肘仍沿用伸臂终点；腕部不能再沿旧 handRig 本地 Euler 轴压腕。
     T台定姿改变了腕部基轴，独立插值肩/肘/腕的 parent-local 四元数会让掌心在
     压腕中段先侧翻。handActorQuat 改为球员局部目标：掌心(local -Z)朝地面(-Y)、
     指尖(local -Y)朝篮筐(+Z)、拇指侧(local +X)朝辅助手(+X)。 */
  shooting:Object.freeze({
    armQuat:Object.freeze([-.965750,.028981,.007734,.257734]),
    elbowQuat:Object.freeze([-.039989,0,0,.999200]),
    handActorQuat:Object.freeze([-Math.SQRT1_2,0,0,Math.SQRT1_2])
  }),
  guide:Object.freeze({
    armQuat:Object.freeze([-.857128,-.017145,-.010296,.514716]),
    elbowQuat:Object.freeze([-.305059,0,0,.952334]),
    handQuat:SHOT_SET_POSE.guide.handQuat
  })
});
let _shotPoseTargetQuat=null,_shotPoseBaseQuat=null,_shotPoseActorQuat=null,
  _shotPoseParentQuat=null,_shotPoseWorldQuat=null,_shotPoseDesiredQuat=null;
const _readyHandPos=typeof THREE!=="undefined"?new THREE.Vector3():null;
const _poseXAxis=typeof THREE!=="undefined"?new THREE.Vector3(1,0,0):null;
const _setHandPos=typeof THREE!=="undefined"?new THREE.Vector3():null;
const _catchTargetPos=typeof THREE!=="undefined"?new THREE.Vector3():null;
const _catchStartPos=typeof THREE!=="undefined"?new THREE.Vector3():null;
function ensureShotPoseTemps(){
  if(_shotPoseTargetQuat||typeof THREE==="undefined")return;
  _shotPoseTargetQuat=new THREE.Quaternion();
  _shotPoseBaseQuat=new THREE.Quaternion();
  _shotPoseActorQuat=new THREE.Quaternion();
  _shotPoseParentQuat=new THREE.Quaternion();
  _shotPoseWorldQuat=new THREE.Quaternion();
  _shotPoseDesiredQuat=new THREE.Quaternion();
}
function targetQuat(values){
  ensureShotPoseTemps();
  return _shotPoseTargetQuat.set(values[0],values[1],values[2],values[3]).normalize();
}
function blendNodeQuat(node,values,k){
  if(!node||k<=0)return;
  node.quaternion.slerp(targetQuat(values),clamp(k,0,1));
}
/* 在父节点(躯干/上臂)空间叠一个绕 X 的小幅修饰，等价于旧版直接改 rotation.x，
   但不会破坏已经插好的四元数姿势。系数带 (1-k) 保证最高点一分不差。 */
function addParentXRot(node,rad){
  if(!node||!rad||typeof THREE==="undefined")return;
  ensureShotPoseTemps();
  _shotPoseTargetQuat.setFromAxisAngle(_poseXAxis,rad);
  node.quaternion.premultiply(_shotPoseTargetQuat).normalize();
}
function capturePoseNode(node,actorRoot){
  if(!node)return null;
  const pose={
    p:[node.position.x,node.position.y,node.position.z],
    q:[node.quaternion.x,node.quaternion.y,node.quaternion.z,node.quaternion.w],
    e:[node.rotation.x,node.rotation.y,node.rotation.z]
  };
  if(actorRoot&&typeof THREE!=="undefined"&&node.getWorldQuaternion&&actorRoot.getWorldQuaternion){
    ensureShotPoseTemps();
    node.getWorldQuaternion(_shotPoseWorldQuat);
    actorRoot.getWorldQuaternion(_shotPoseActorQuat);
    _shotPoseDesiredQuat.copy(_shotPoseActorQuat).invert().multiply(_shotPoseWorldQuat).normalize();
    pose.aq=[_shotPoseDesiredQuat.x,_shotPoseDesiredQuat.y,_shotPoseDesiredQuat.z,_shotPoseDesiredQuat.w];
  }
  return pose;
}
function setArmSegmentLength(o,index,upperLength,lowerLength){
  const elbow=o.elbows&&o.elbows[index],hand=o.handRoots&&o.handRoots[index];
  if(elbow)elbow.position.set(0,-upperLength,0);
  if(hand)hand.position.set(0,-lowerLength,0);
  const upper=o.upperArms&&o.upperArms[index],fore=o.forearms&&o.forearms[index];
  if(upper){upper.scale.y=upperLength/.265;upper.position.y=-upperLength*.5-.0125;}
  if(fore){fore.scale.y=lowerLength/.27;fore.position.y=-lowerLength*.5;}
  const sleeve=o.sleeves&&o.sleeves[index];
  if(sleeve){sleeve.scale.y=upperLength/.285;sleeve.position.y=-upperLength*.5-.03;}
  const wrist=o.wrists&&o.wrists[index];
  if(wrist)wrist.position.y=-lowerLength+.02;
}
function resetArmGeometry(o){
  if(!o||!o.arms||!o.elbows||!o.handRoots)return;
  o.arms[0].position.set(-o.baseShoulderX,1.36,0);
  o.arms[1].position.set(o.baseShoulderX,1.36,0);
  setArmSegmentLength(o,0,.32,.29);
  setArmSegmentLength(o,1,.32,.29);
  o.handRoots[0].position.z=HAND_ROOT_BASE.z;
  o.handRoots[1].position.z=HAND_ROOT_BASE.z;
}
function poseHandJoints(o,c){
  if(!o||!o.handRoots)return;
  resetArmGeometry(o);
  const lift=c&&c.lift||0;
  o.handRoots.forEach((hand,index)=>{
    if(!hand)return;
    if(hand.position)hand.position.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
    hand.rotation.x=(index===0?.08:0)*lift;
    hand.rotation.y=0;
    hand.rotation.z=(index===0?-.025:0)*lift;
  });
  (o.fingerJoints||[]).forEach(fingers=>fingers.forEach(finger=>{
    finger.rotation.x=HAND_FINGER_REST;finger.rotation.y=0;finger.rotation.z=0;
  }));
}
function poseShootingHandToBall(o,c){
  // 兼容旧调用名；最终双手 transform 只由 applyShotSetPose() 写入。
  return !!(o&&c);
}
function applyShootingHandWorldFollow(o,state,startPose){
  if(!o||!o.g||!o.handRoots||!o.handRoots[0]||typeof THREE==="undefined")return;
  const shoot=o.handRoots[0],parent=shoot.parent;
  if(!parent)return;
  ensureShotPoseTemps();
  o.g.updateMatrixWorld(true);
  /* 先保存 poseGuy 在本帧给出的无压腕基线，供 recovery 回收；随后始终在球员局部
     空间插值整只手掌，避免肩肘同时运动时把腕部插值轴带向身体侧面。 */
  shoot.getWorldQuaternion(_shotPoseWorldQuat);
  o.g.getWorldQuaternion(_shotPoseActorQuat);
  _shotPoseBaseQuat.copy(_shotPoseActorQuat).invert().multiply(_shotPoseWorldQuat).normalize();
  _shotPoseTargetQuat.set(
    SHOT_FOLLOW_POSE.shooting.handActorQuat[0],SHOT_FOLLOW_POSE.shooting.handActorQuat[1],
    SHOT_FOLLOW_POSE.shooting.handActorQuat[2],SHOT_FOLLOW_POSE.shooting.handActorQuat[3]
  ).normalize();
  /* 压腕相位与伸肘相位分离：真实出手时间轴(带 age)下，球脱手前手腕不动，
     球一走手腕才翻。回放/过场/对手没有 age，沿用旧的 extend 相位。 */
  const wristK=state.age!=null
    ?ease01((state.age-SHOT_WRIST_SNAP_DELAY)/SHOT_WRIST_SNAP_SECONDS)
    :(state.extend||0);
  if(state.recover>0){
    _shotPoseDesiredQuat.copy(_shotPoseTargetQuat).slerp(_shotPoseBaseQuat,state.recover).normalize();
  }else if(startPose&&startPose.aq&&startPose.aq.length===4){
    _shotPoseDesiredQuat.set(startPose.aq[0],startPose.aq[1],startPose.aq[2],startPose.aq[3])
      .slerp(_shotPoseTargetQuat,wristK).normalize();
  }else{
    _shotPoseDesiredQuat.copy(_shotPoseBaseQuat).slerp(_shotPoseTargetQuat,wristK).normalize();
  }
  /* desired actor-local → world → 当前 elbow parent-local。父节点怎么转都不会改变
     掌心朝地、指尖朝框这两个最终世界方向约束。 */
  _shotPoseWorldQuat.copy(_shotPoseActorQuat).multiply(_shotPoseDesiredQuat).normalize();
  parent.getWorldQuaternion(_shotPoseParentQuat);
  shoot.quaternion.copy(_shotPoseParentQuat.invert().multiply(_shotPoseWorldQuat)).normalize();
}
function applyFollowThroughFingers(o,k){
  if(!o)return;
  const follow=ease01(k||0);
  const fingers=o.fingerJoints&&o.fingerJoints[0];
  if(fingers)fingers.forEach((finger,index)=>{
    const bend=HAND_FINGER_FOLLOW[index]||.14;
    finger.rotation.x=mixN(finger.rotation.x,bend,follow);
  });
}
function applyHandFollowThroughPose(o,k,startPose){
  const follow=ease01(k||0);
  applyShootingHandWorldFollow(o,{extend:follow,recover:0},startPose);
  applyFollowThroughFingers(o,k);
}
function captureShotPose(o){
  if(!o||!o.arms||!o.elbows)return null;
  if(o.g&&o.g.updateMatrixWorld)o.g.updateMatrixWorld(true);
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  return {
    release:{shoot:capturePoseNode(shoot),elbow:capturePoseNode(shootEl),hand:capturePoseNode(o.handRoots&&o.handRoots[0],o.g)},
    guide:{arm:capturePoseNode(guide),elbow:capturePoseNode(guideEl),hand:capturePoseNode(o.handRoots&&o.handRoots[1])}
  };
}
function applyShotSetPose(o,c,active){
  const curve=c||{};
  const isPlayer=typeof player!=="undefined"&&o===player;
  const charging=isPlayer&&typeof G!=="undefined"&&G.charging;
  const ready=isPlayer&&typeof G!=="undefined"&&G.canShoot&&!G.charging;
  const holding=ready||charging||!!active;
  const enabled=active==null?(holding||(curve.lift||0)>0):!!active;
  if(!o||!o.arms||!o.elbows||!enabled)return;
  const lift=Math.max(curve.lift||0,0);
  const k=ease01(lift);
  const dip=curve.dip||0;
  /* 玩家接到球就直接站在持球关键帧上(接球缓冲由 poseCatchHands 负责收敛到它)；
     对手与过场里的球员没有“持球”状态，就在抬球最初 30% 里从站姿淡入这一帧。 */
  const holdIn=holding?1:ease01(clamp(lift/READY_FADE_IN,0,1));
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  const shootHand=o.handRoots&&o.handRoots[0],guideHand=o.handRoots&&o.handRoots[1];

  // 关键帧 A：胸前持球。玩家 holdIn 恒为 1，所以接到球就稳稳站在这一帧上。
  blendNodeQuat(shoot,SHOT_READY_POSE.shooting.armQuat,holdIn);
  blendNodeQuat(shootEl,SHOT_READY_POSE.shooting.elbowQuat,holdIn);
  blendNodeQuat(shootHand,SHOT_READY_POSE.shooting.handQuat,holdIn);
  blendNodeQuat(guide,SHOT_READY_POSE.guide.armQuat,holdIn);
  blendNodeQuat(guideEl,SHOT_READY_POSE.guide.elbowQuat,holdIn);
  blendNodeQuat(guideHand,SHOT_READY_POSE.guide.handQuat,holdIn);
  if(_readyHandPos)_readyHandPos.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);

  /* 关键帧 B：同一个 k 把肩点、骨长、肩/肘/腕四元数、手指一起收敛到 T台最高点。
     腕部只写 parent-local，所以整段上升里手掌始终跟着前臂走。 */
  blendNodeQuat(shoot,SHOT_SET_POSE.shooting.armQuat,k);
  blendNodeQuat(shootEl,SHOT_SET_POSE.shooting.elbowQuat,k);
  blendNodeQuat(shootHand,SHOT_SET_POSE.shooting.handQuat,k);
  blendNodeQuat(guide,SHOT_SET_POSE.guide.armQuat,k);
  blendNodeQuat(guideEl,SHOT_SET_POSE.guide.elbowQuat,k);
  blendNodeQuat(guideHand,SHOT_SET_POSE.guide.handQuat,k);
  [SHOT_SET_POSE.shooting,SHOT_SET_POSE.guide].forEach((target,index)=>{
    const arm=o.arms[index];
    arm.position.x=mixN(arm.position.x,target.shoulder[0],k);
    arm.position.y=mixN(arm.position.y,target.shoulder[1],k);
    arm.position.z=mixN(arm.position.z,target.shoulder[2],k);
    const upper=mixN(.32,target.upperLength,k),lower=mixN(.29,target.lowerLength,k);
    // 写完骨长后腕点回到前臂末端；再按同一个 k 把持球腕位混回去，绝不做世界位置反解。
    setArmSegmentLength(o,index,upper,lower);
    const hand=o.handRoots&&o.handRoots[index];
    if(hand&&_readyHandPos&&_setHandPos){
      _setHandPos.copy(hand.position);
      hand.position.copy(_readyHandPos).lerp(_setHandPos,k);
    }
  });

  // 下蹲蓄力时双臂随身体轻微沉一下；(1-k) 保证到最高点时这份修饰已经归零。
  addParentXRot(shoot,-.12*dip*(1-k));
  addParentXRot(guide,-.20*dip*(1-k));

  // 握球方式从持球帧起就与最高点一致，手指只在非玩家淡入时才从松弛态收拢。
  const grip=Math.max(holdIn,k);
  const curls=[SHOT_SET_POSE.shooting.curl,SHOT_SET_POSE.guide.curl];
  (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,index)=>{
    finger.rotation.x=mixN(HAND_FINGER_REST,curls[handIndex],grip);
    finger.rotation.y=0;
    const splay=handIndex===0?SHOOT_FINGER_SPLAY:GUIDE_FINGER_SPLAY;
    finger.rotation.z=(splay[index]||0)*grip;
  }));
  if(o.g){
    o.g.userData.shotSetPoseController="applyShotSetPose";
    o.g.userData.shotSetPosePhase=k>=1?"tstage-set":(k>0?"ready-to-tstage":"ready-hold");
    o.g.userData.shotSetHoldIn=holdIn;
    o.g.userData.shotSetBall=[SHOT_SET_BALL.x,SHOT_SET_BALL.y,SHOT_SET_BALL.z];
  }
}
function applyShotFollowThroughPose(o,state,pose){
  if(!o||!o.arms||!o.elbows||!state||!state.active)return;
  const captured=pose&&pose.release&&pose.release.shoot?pose:captureShotPose(o);
  const release=captured&&captured.release,guideStart=captured&&captured.guide;
  if(!release||!guideStart)return;
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  ensureShotPoseTemps();
  const applyQuat=(node,start,targetValues)=>{
    if(!node||!start)return;
    _shotPoseBaseQuat.copy(node.quaternion);
    _shotPoseTargetQuat.set(targetValues[0],targetValues[1],targetValues[2],targetValues[3]).normalize();
    if(state.recover>0)node.quaternion.copy(_shotPoseTargetQuat).slerp(_shotPoseBaseQuat,state.recover);
    else node.quaternion.set(start.q[0],start.q[1],start.q[2],start.q[3]).slerp(_shotPoseTargetQuat,state.extend);
    node.quaternion.normalize();
  };
  // 肩肘从用户松手前姿势连续伸展；辅助手自然向球侧打开，随后一起回收。
  applyQuat(shoot,release.shoot,SHOT_FOLLOW_POSE.shooting.armQuat);
  applyQuat(shootEl,release.elbow,SHOT_FOLLOW_POSE.shooting.elbowQuat);
  applyQuat(guide,guideStart.arm,SHOT_FOLLOW_POSE.guide.armQuat);
  applyQuat(guideEl,guideStart.elbow,SHOT_FOLLOW_POSE.guide.elbowQuat);
  applyShootingHandWorldFollow(o,state,release.hand);
  applyFollowThroughFingers(o,state.follow);
}
/* ---------------- 共享跑动循环 ----------------
   全项目唯一的一套跑动姿势：绝杀 5v5、AI 表演赛、以后任何需要跑动的角色都走这里，
   不要再各写一套。关键点：
     · 步频由**位移**驱动而不是时间——按 dt 推进相位会让腿的摆动和实际位移脱钩，
       走一步的时间里身体平移了别的距离，脚就在地上滑；
     · 摆幅由速度主导，站住不动腿就停(只留呼吸)，不会原地踏步；
     · 触地高度乘身高倍率 hs，高个才不会陷进地板。
   state 由调用方持有，需要 phase / idleT / lean / face 四个字段。 */
function poseRunCycle(o,state,speed,dt,opts){
  if(!o||!o.legs||!state)return 0;
  const cfg=opts||{},hs=cfg.hs||1;
  const run=clamp(speed/3.6,0,1);
  const stride=.5+.6*run;
  state.phase=(state.phase||0)+(speed*dt/stride)*Math.PI;
  state.idleT=(state.idleT||0)+dt;
  const s=Math.sin(state.phase),c=Math.cos(state.phase);
  const swing=.06+run*.80,idle=Math.sin(state.idleT*1.7)*.03;
  const hipA=s*swing,hipB=-s*swing;
  const kneeA=Math.max(0,-hipA)*(.5+run*.9);
  const kneeB=Math.max(0,-hipB)*(.5+run*.9);
  const ankA=-(hipA+kneeA)*.85,ankB=-(hipB+kneeB)*.85;
  o.legs[0].rotation.x=hipA;o.legs[1].rotation.x=hipB;
  o.knees[0].rotation.x=kneeA;o.knees[1].rotation.x=kneeB;
  o.ankles[0].rotation.x=ankA;o.ankles[1].rotation.x=ankB;
  o.shoes[0].rotation.x=0;o.shoes[1].rotation.x=0;
  if(cfg.arms!==false){
    // 防守人张开双臂，进攻人自然摆臂
    if(cfg.defensive){
      const spread=.55+run*.25;
      o.arms[0].rotation.z=-spread;o.arms[1].rotation.z=spread;
      o.arms[0].rotation.x=-.5-idle;o.arms[1].rotation.x=-.5+idle;
      o.elbows[0].rotation.x=-.35;o.elbows[1].rotation.x=-.35;
    }else{
      o.arms[0].rotation.z=0;o.arms[1].rotation.z=0;
      o.arms[0].rotation.x=-.25+c*swing*.75;
      o.arms[1].rotation.x=-.25-c*swing*.75;
      o.elbows[0].rotation.x=-.55-run*.35;o.elbows[1].rotation.x=-.55-run*.35;
    }
  }
  state.lean=(state.lean||0)+(run*.16-(state.lean||0))*Math.min(1,dt*6);
  o.g.rotation.x=state.lean;
  if(cfg.resetHead!==false&&o.headRoot)o.headRoot.rotation.set(0,0,0);
  const footY=(poseFootBottomY(hipA,kneeA,ankA)+poseFootBottomY(hipB,kneeB,ankB))*.5;
  o.g.position.y=POSE_STAND_FOOT_Y-footY*hs;
  return footY;
}
/* 接球时上半身绕髋关节向前俯 10°（矢状面内的前倾，肩膀往膝盖方向压）。
   之前接球只有屈膝、上半身是竖直的，看起来像"直着腰把球接住"。

   ⚠ 这个骨架里 g.rotation.x 的正号是【后仰】，不是前倾。
   实测：+0.175 时头沿朝向位移 -0.0376m（往后），-0.175 时 +0.0376m（往前）。
   所以前倾必须用负号。原来那行的注释写着"上身前倾:蓄力约10°"但用的是
   正号 0.12*load —— 注释和实际方向是反的，蓄力时人其实在后仰。
   这次一并翻正（见下面的 -0.12*load）。

   前倾在蓄力抬球的过程中按 lift 平滑让位，lift=1 时严格归零 ——
   最高点姿势因此逐字不变（check.js 有 1e-3 的球心断言，动到最高点会立刻失败）。
   c.hold 由调用方给：玩家在球到手到出手之间给 1，其余角色不给就是 0。 */
const CATCH_HIP_LEAN=-0.175;   // 10° 前倾（负号=前倾，见上）
const CATCH_LEAN_RATE=9;      // 屈髋的平滑速率(1/秒)
let holdLean=0;
/* 球到手那一帧 G.canShoot 硬翻 true，直接用会让躯干一帧折下 10°，所以做指数平滑。
   注意：updPose 有两条实现（motion.js 这条是兜底，shot-motion.js 那条才是当前生效的），
   两边都必须把结果写进曲线的 hold，否则只改一条会完全看不到效果。 */
function updateHoldLean(dt){
  const want=(typeof G!=="undefined"&&G.canShoot)?1:0;
  holdLean+=(want-holdLean)*Math.min(1,(dt||0.016)*CATCH_LEAN_RATE);
  return holdLean;
}
function poseGuy(o,c,lk){
  poseHandJoints(o,c);
  const sh=o.arms[0],gd=o.arms[1]; // arms[0]=x-0.33=角色右手(面朝篮筐时屏幕右侧) 投篮 / arms[1]=左手 护球
  sh.rotation.x=-0.35-0.25*c.dip-1.55*c.lift-0.9*c.jmp;
  o.elbows[1].rotation.x=-(0.45+1.2*c.lift)*(1-c.jmp*0.92)-0.4*c.over;
  gd.rotation.x=-0.35-0.2*c.dip-1.1*c.lift-0.5*c.jmp+0.55*c.over;
  o.elbows[0].rotation.x=-(0.4+0.85*c.lift)*(1-c.jmp*0.6);
  sh.rotation.z=-0.12*c.lift;gd.rotation.z=0.18*c.lift;
  // 所有普通姿势完成后，唯一一次写入控制台给出的松手前双手姿势。
  applyShotSetPose(o,c);
  // Real-shot leg chain: knees load forward, calves fold back into a V, soles stay planted until takeoff.
  const load=c.dip*(1-c.jmp*0.86);
  const land=lk||0;
  const hipBase=-0.48*load-0.24*land+0.06*c.jmp;
  const kneeBase=Math.max(0,0.98*load+0.82*land-0.78*c.jmp);
  const hipLead=hipBase-0.03*load,hipTrail=hipBase+0.03*load;
  const kneeLead=kneeBase*0.96,kneeTrail=kneeBase*1.04;
  const ankleLead=-(hipLead+kneeLead)*0.98-0.18*c.jmp+0.04*land;
  const ankleTrail=-(hipTrail+kneeTrail)*0.98-0.18*c.jmp+0.04*land;
  o.legs[0].rotation.x=hipLead;
  o.legs[1].rotation.x=hipTrail;
  o.knees[0].rotation.x=kneeLead;
  o.knees[1].rotation.x=kneeTrail;
  o.ankles[0].rotation.x=ankleLead;
  o.ankles[1].rotation.x=ankleTrail;
  o.shoes[0].rotation.x=0;
  o.shoes[1].rotation.x=0;
  // 上身前倾:蓄力约10°(0.17rad),起跳回正并略后仰送球
  /* 接球前倾，随 lift 让位给蓄力/最高点的躯干角。
     -0.12*load：蓄力也翻成前倾（原来是 +，实际是后仰，和注释相反）。
     over/jmp/land 三项维持原样 —— 最高点的 -0.03*jmp 是 T台导入姿势的一部分，
     被 check.js 的球心断言锁着，不能动。 */
  const catchLean=CATCH_HIP_LEAN*(c.hold||0)*(1-ease01(c.lift));
  o.g.rotation.x=catchLean - 0.12*load - 0.06*c.over - 0.03*c.jmp + 0.08*land;
  const footY=(poseFootBottomY(hipLead,kneeLead,ankleLead)+poseFootBottomY(hipTrail,kneeTrail,ankleTrail))*0.5;
  return POSE_STAND_FOOT_Y-footY;
}
function shotStanceBlend(c,ready){
  return clamp(Math.max(ready?0.72:0,c.dip*.55+c.lift*.85+c.jmp*.35),0,1);
}
function poseGuidePalmToBall(o,c,ready){
  // 兼容旧调用名；辅助手不再有第二套最终姿势写入。
  return !!(o&&c&&ready!=null);
}
function tuneGuideHandPose(o,c,ready){
  // 兼容旧调用名；最终控制权已收敛到 applyShotSetPose()。
  return !!(o&&c&&ready!=null);
}
/* 传球接近时恢复 T台导入前的接球路径；球到手后不再一帧切换，先用 0.18 秒
   从接球终点缓冲到旧版 ready/当前蓄力目标。 */
function poseCatchHands(o,state,dt){
  if(!o||!o.arms||!o.elbows||!o.handRoots)return;
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  const shootHand=o.handRoots[0],guideHand=o.handRoots[1];
  const settling=!!(state&&state.settling);
  // 一次接球只抽一次变体：progress 归零那一帧重抽
  if(!settling&&state&&(state.progress||0)<.02&&!state._variantPicked){
    state._variantPicked=true;pickCatchVariant();
  }

  if(settling){
    state.settle=clamp((state.settle||0)+Math.max(0,dt||0)/CATCH_SETTLE_SECONDS,0,1);
    const t=ease01(state.settle);
    const fromCatch=(node,values)=>{
      if(!node)return;
      ensureShotPoseTemps();
      _shotPoseBaseQuat.copy(node.quaternion);
      node.quaternion.copy(targetQuat(values)).slerp(_shotPoseBaseQuat,t).normalize();
    };
    // 当前 node transform 是 applyShotSetPose 写好的持球帧；从迎球帧向它收敛。
    fromCatch(shoot,SHOT_CATCH_POSE.shooting.armQuat);
    fromCatch(shootEl,SHOT_CATCH_POSE.shooting.elbowQuat);
    fromCatch(guide,SHOT_CATCH_POSE.guide.armQuat);
    fromCatch(guideEl,SHOT_CATCH_POSE.guide.elbowQuat);
    [shootHand,guideHand].forEach(hand=>{
      if(!hand||!_catchTargetPos||!_catchStartPos)return;
      _catchTargetPos.copy(hand.position);
      _catchStartPos.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
      hand.position.copy(_catchStartPos).lerp(_catchTargetPos,t);
    });
    // 腕部一并从迎球掌面收回到持球握法(球已在手上，这一步就是"接住后调整握球")。
    fromCatch(shootHand,SHOT_CATCH_POSE.shooting.handQuat);
    fromCatch(guideHand,SHOT_CATCH_POSE.guide.handQuat);
    (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach(finger=>{
      const targetX=finger.rotation.x;
      finger.rotation.x=mixN(handIndex===0?HAND_FINGER_REST-.16:HAND_FINGER_REST-.10,targetX,t);
    }));
    if(state.settle>=1)state.active=false;
    if(o.g)o.g.userData.catchPosePhase=state.active?"settling":"ready";
    return;
  }

  // 传球飞行段：从 poseGuy 给出的站姿逐步伸手迎球，终点就是迎球帧。
  const k=ease01(clamp(state&&state.progress||0,0,1));
  blendNodeQuat(shoot,SHOT_CATCH_POSE.shooting.armQuat,k);
  blendNodeQuat(shootEl,SHOT_CATCH_POSE.shooting.elbowQuat,k);
  blendNodeQuat(guide,SHOT_CATCH_POSE.guide.armQuat,k);
  blendNodeQuat(guideEl,SHOT_CATCH_POSE.guide.elbowQuat,k);
  /* 个体变化：本次接球抽到的变体让"非主手"那侧略低/略高，或两只手都再抬一点，
     这样每次接球的手型不会一模一样。偏移在 parent 空间叠加，不破坏掌心朝向。 */
  const cv=catchVariant||CATCH_VARIANTS[0],offArm=cv.off.arm*k,offEl=cv.off.elbow*k;
  if(offArm||offEl){
    const lead=cv.lead|0,other=1-lead;
    addParentXRot(o.arms[other],offArm);
    addParentXRot(o.elbows[other],offEl);
    if(cv.name==="双手偏高"){addParentXRot(o.arms[lead],offArm);addParentXRot(o.elbows[lead],offEl);}
  }
  /* 迎球手型只写 parent-local：掌心随肩肘一起伸出去朝向来球，不做世界朝向锁定。
     绝对不能在这里把腕部重置成 identity —— 传球常常在出手跟随没走完时就开始，
     重置会一帧抹掉压腕姿势(实测 105°/帧)。和肩肘一样，从本帧已有姿势 slerp 过去。 */
  [shootHand,guideHand].forEach((hand,index)=>{
    if(!hand||!_readyHandPos)return;
    _readyHandPos.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
    hand.position.lerp(_readyHandPos,k);
    blendNodeQuat(hand,(index===0?SHOT_CATCH_POSE.shooting:SHOT_CATCH_POSE.guide).handQuat,k);
  });
  (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,index)=>{
    finger.rotation.x=handIndex===0?HAND_FINGER_REST-(.16*k):HAND_FINGER_REST-(.10*k);
    finger.rotation.z=(handIndex===0?SHOOT_FINGER_SPLAY[index]:GUIDE_FINGER_SPLAY[index])*k;
  }));
  if(o.g)o.g.userData.catchPosePhase="incoming";
}
function poseBallPos(v,c){
  v.set(-0.13+0.04*c.jmp,
    0.82+0.23*(1-c.dip)+0.7*c.lift+0.52*c.jmp,
    0.34-0.05*c.lift-0.18*c.jmp);
  return v;
}
function updPose(dt){
  const s=curShot();
  const ideal=s?weatherAdjustedIdeal(s,false):IDEAL;
  poseK=G.charging?G.power/ideal:Math.max(0,poseK-dt*4.5);
  const base=shotCurves(poseK);
  const phys=globalThis.AIBAShotPhysics
    ?AIBAShotPhysics.update({charging:G.charging,dt,ideal,rate:playerChargeRate(),curve:base})
    :null;
  const c=phys?phys.curve:base;
  /* 接球屈髋的开关。G.canShoot 在球到手那一帧硬翻 true，直接用会让躯干
     一帧折下 10°，所以这里做指数平滑再交给 poseGuy。 */
  c.hold=updateHoldLean(dt);
  // apex cue: tiny vibration + faint tick at the top of the jump
  if(G.charging&&!G.apexed&&(phys?phys.apexCue:poseK>=1)){
    G.apexed=true;
    if(navigator.vibrate)navigator.vibrate(12);
    blip(960,0.03,"square",0.045);
  }
  if(phys&&phys.autoRelease&&G.charging)doRelease();
  if(phys&&phys.justLanded)landT=0.3;
  if(landT>0)landT-=dt;
  const lk=landT>0?Math.sin((0.3-landT)/0.3*Math.PI):0;
  P.jump=phys&&phys.airborne?Math.max(0,c.jmp*0.55):Math.max(-0.06,c.jmp*0.55-c.over*0.55);
  P.eyeDip=-0.26*c.dip-0.09*lk;
  // first-person: right-hand shot pocket, ball rises past the face to overhead
  hands.position.x=-0.05*c.lift;
  hands.position.y=-0.5-0.2*c.dip+0.3*c.lift+0.42*c.jmp;
  hands.position.z=-0.62+0.12*c.dip-0.17*c.jmp;
  hands.rotation.x=-0.25*c.lift-0.85*c.jmp+c.over*1.1;
  hands.rotation.z=-0.07*c.lift;
  // avatar
  player.g.position.set(P.pos.x,0,P.pos.z);
  player.g.rotation.y=P.face;
  if(P.walking){
    P.walkT+=dt*9;
    const sw=Math.sin(P.walkT);
    player.g.rotation.x=0;
    player.legs[0].rotation.x=sw*0.7;player.legs[1].rotation.x=-sw*0.7;
    player.knees[0].rotation.x=Math.max(0,-sw*0.5+0.25);player.knees[1].rotation.x=Math.max(0,sw*0.5+0.25);
    player.ankles[0].rotation.x=-sw*0.25;player.ankles[1].rotation.x=sw*0.25;
    player.shoes[0].rotation.x=0;player.shoes[1].rotation.x=0;
    player.arms[0].rotation.x=-sw*0.45;player.arms[1].rotation.x=sw*0.45;
    player.elbows[0].rotation.x=-0.4;player.elbows[1].rotation.x=-0.4;
    poseHandJoints(player,shotCurves(0));
  }else{
    player.g.position.y=poseGuy(player,c,lk)+P.jump;
  }
  poseBallPos(pBall.position,c);
}

/* ---------------- passer & pass ----------------
   传球飞行时长。Rack Rush 原本是 .22–.32 秒，5 米传球等于 20m/s，在方块画风下就是
   一道残影，和 0.78 秒的举球、0.725 秒的出手跟随完全不是一个节奏。放慢到 12m/s 量级。
   PASS_FLIGHT_RUSH.budget 是 shots.js 排下一球时给飞行预留的时间，必须跟着 min/max
   的中值走，否则改了飞行时长会连带改掉整关的供球节奏(check.js 有断言)。 */
const PASS_FLIGHT_RUSH=Object.freeze({base:.26,perMeter:.03,min:.36,max:.5,budget:.43});
const PASS_FLIGHT_NORMAL=Object.freeze({base:.3,perMeter:.045,min:.4,max:.75});
function passFlightSeconds(distance){
  const p=G.mode==="rackrush"?PASS_FLIGHT_RUSH:PASS_FLIGHT_NORMAL;
  return clamp(p.base+distance*p.perMeter,p.min,p.max);
}
let passing=null;
function startPass(){
  const s=curShot();if(!s||G.buzzed)return;
  passer.g.rotation.y=faceTo(passer.g.position,P.pos);
  passerBall.visible=false;
  const from=V3(passer.g.position.x,1.25,passer.g.position.z);
  const catchP=eyePos();catchP.y-=0.3;
  const dur=passFlightSeconds(from.distanceTo(catchP));
  const mesh=new THREE.Mesh(ballGeo,shotMat(s));
  mesh.position.copy(from);scene.add(mesh);
  passing={mesh,from,to:catchP,t:0,dur};
  G.passCatch={active:true,progress:0,target:catchP.clone()};
  passer.arms.forEach(a=>{a.rotation.x=-1.5;});
  passer.elbows.forEach(e=>{e.rotation.x=-0.9;});
  tween(0.3,k=>{
    passer.arms.forEach(a=>{a.rotation.x=-1.5+k*1.15;});
    passer.elbows.forEach(e=>{e.rotation.x=-0.9+k*0.8;});
  });
  blipBus(sfxBus||master,300,0.06,"sine",0.07,200);
  noiseBus(sfxBus||master,0.055,0.035,900,4600);
}
function updPass(dt){
  if(!passing)return;
  passing.t+=dt;const k=Math.min(1,passing.t/passing.dur);
  const p=passing;
  p.mesh.position.lerpVectors(p.from,p.to,k);
  p.mesh.position.y+=Math.sin(k*Math.PI)*0.65;
  if(G.passCatch){G.passCatch.active=k<1;G.passCatch.progress=k;G.passCatch.target.copy(p.mesh.position);}
  p.mesh.rotation.x-=dt*10;
  if(k>=1){
    scene.remove(p.mesh);passing=null;passerBall.visible=true;
    if(G.passCatch){
      G.passCatch.active=true;G.passCatch.settling=true;G.passCatch.settle=0;G.passCatch.progress=1;
    }
    if(G.buzzed||!curShot())return;
    sBounce();
    if(navigator.vibrate)navigator.vibrate(8);
    G.canShoot=true;setHandBall();updPowerUI();updDotsUI();
  }
}

/* ---------------- walking between racks ---------------- */
let walk=null;
function walkTo(shot,cb){
  const base=shotBase(shot);
  const from=P.pos.clone(),to=base.clone();
  const dur=clamp(from.distanceTo(to)/3.4,0.5,1.7);
  P.walking=true;G.moving=true;P.walkT=0;
  walk={from,to,t:0,dur,fMove:faceTo(from,to),f1:faceTo(to,HOOP),cb,step:0};
}
function updWalk(dt){
  if(!walk)return;
  walk.t+=dt;const k=Math.min(1,walk.t/walk.dur);
  P.pos.lerpVectors(walk.from,walk.to,k);
  const tgt=k<0.75?walk.fMove:walk.f1;
  let d=tgt-P.face;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  P.face+=d*Math.min(1,dt*8);
  if(((walk.t*3.4)|0)!==walk.step){
    walk.step=(walk.t*3.4)|0;
    blipBus(playerBus||master,150,0.04,"sine",0.035,90);
    if(Math.random()<0.55)shoeSqueak(false);
  }
  if(k>=1){
    P.face=walk.f1;P.walking=false;G.moving=false;
    player.legs[0].rotation.x=0;player.legs[1].rotation.x=0;
    player.knees[0].rotation.x=0;player.knees[1].rotation.x=0;
    player.ankles[0].rotation.x=0;player.ankles[1].rotation.x=0;
    player.shoes[0].rotation.x=0;player.shoes[1].rotation.x=0;
    player.g.rotation.x=0;
    const cb=walk.cb;walk=null;if(cb)cb();
  }
}


window.AIBA.runtime.register("rendering:motion",Object.freeze({
  ease01,shotCurves,poseFootBottomY,poseRunCycle,poseHandJoints,poseShootingHandToBall,poseGuidePalmToBall,applyHandFollowThroughPose,captureShotPose,applyShotSetPose,applyShotFollowThroughPose,poseGuy,poseBallPos,shotStanceBlend,tuneGuideHandPose,poseCatchHands,updPose,
  startPass,updPass,walkTo,updWalk,
  getState:()=>({poseK,landT,passing,walk})
}));
