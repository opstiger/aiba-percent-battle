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
/* 骨长。poseFootBottomY 与步幅反解必须用同一组数,否则又会出现
   "落地高度按一套算、步幅按另一套算"的对不上。 */
const THIGH_LEN=.34,SHIN_LEN=.32;
function poseFootBottomY(hip,knee,ankle,footPitch,toePitch){
  const a1=hip,a2=hip+knee,a3=hip+knee+ankle;
  const a4=a3+(Number(footPitch)||0),a5=a4+(Number(toePitch)||0);
  const bottomAt=angle=>0.78
    -THIGH_LEN*Math.cos(a1)
    -SHIN_LEN*Math.cos(a2)
    -0.04*Math.cos(angle)
    -0.05*Math.sin(angle)
    -0.065*Math.abs(Math.cos(angle))
    -0.15*Math.abs(Math.sin(angle));
  /* ankle->foot 和 foot->toe 的真实 pivot 会让前掌最低点与中足略有差异；
     取更低的一点做接地补偿，避免脚尖抬起时整个人被错误地托高。 */
  return Math.min(bottomAt(a4),bottomAt(a5));
}
const POSE_STAND_FOOT_Y=poseFootBottomY(0,0,0);
const HAND_FINGER_REST=-.08;
/* 手指不是一根硬棍：MCP(掌指)、PIP(近端指间)、DIP(远端指间)三节的相对
   弯曲比例接近人手，curl 参数表示指尖最终总弯曲角。旧 pose 的 curl 数值
   仍然可用，只会被分摊到三节，不会改变它们的总朝向。 */
const FINGER_BEND_PROFILE=Object.freeze([.18,.52,.30]);
const THUMB_BEND_PROFILE=Object.freeze([.56,.44]);
/* 跑动时手掌不能沿用站定的张开手指。1.55rad 约 89° 的总弯曲，约等于
   MCP 16° + PIP 46° + DIP 27° 的松拳比例：指尖收进掌心，但不会挤成僵硬
   的一整块；跑动速度降到 0 时自动回到松弛角。 */
const RUN_FINGER_CURL=1.55;
const RUN_FINGER_CURL_OFFSETS=[-.05,0,.035,-.025];
const RUN_THUMB_CURL=1.10;
const RUN_FIST_SPEED=.10,RUN_FIST_CLOSE_SECONDS=.10,RUN_FIST_OPEN_SECONDS=.16;
const HAND_FINGER_FOLLOW=[.14,.38,Math.PI/6,.16];
/* handRoot 的 local -Z 是掌心。日常跑动时绕 local Y 转向身体中线，
   所以两只掌心相对、手指仍然自然朝下；投篮/接球关键帧随后会明确覆盖这组默认姿势。 */
const RUN_PALM_YAW=[-Math.PI*.5,Math.PI*.5];
/* 非接球站定：上臂自然下垂，小臂只从肘部松弛地弯约 5°。
   跑动和迎球会在各自状态里覆盖这组基线。 */
const IDLE_ARM_X=-.03,IDLE_ELBOW_BEND=-Math.PI/36;
function fingerChain(finger){
  const chain=finger&&finger.userData&&finger.userData.aibaFingerChain||{};
  return {pip:chain.pip||null,dip:chain.dip||null};
}
function fingerCurlValue(finger){
  if(!finger)return HAND_FINGER_REST;
  const chain=fingerChain(finger);
  return (Number(finger.rotation.x)||0)+(chain.pip?Number(chain.pip.rotation.x)||0:0)+
    (chain.dip?Number(chain.dip.rotation.x)||0:0);
}
function setFingerChainPose(finger,curl,splay){
  if(!finger)return;
  const total=Number.isFinite(Number(curl))?Number(curl):HAND_FINGER_REST;
  const chain=fingerChain(finger),z=Number.isFinite(Number(splay))?Number(splay):(Number(finger.rotation.z)||0);
  finger.rotation.set(total*FINGER_BEND_PROFILE[0],0,z);
  if(chain.pip)chain.pip.rotation.set(total*FINGER_BEND_PROFILE[1],0,0);
  if(chain.dip)chain.dip.rotation.set(total*FINGER_BEND_PROFILE[2],0,0);
}
function fingerAt(o,handIndex,fingerIndex){
  return o&&o.fingerJoints&&o.fingerJoints[handIndex]&&o.fingerJoints[handIndex][fingerIndex]||null;
}
function setFingerTarget(o,handIndex,fingerIndex,curl,splay){
  setFingerChainPose(fingerAt(o,handIndex,fingerIndex),curl,splay);
}
function blendFingerTarget(o,handIndex,fingerIndex,curl,weight,splay){
  const finger=fingerAt(o,handIndex,fingerIndex);
  if(!finger)return;
  setFingerChainPose(finger,mixN(fingerCurlValue(finger),Number(curl),clamp(Number(weight)||0,0,1)),splay);
}
function setThumbChainPose(root,grip,side){
  if(!root)return;
  const k=clamp(Number(grip)||0,0,1),chain=root.userData&&root.userData.aibaThumbChain||{};
  const handSide=side===-1?-1:1;
  root.rotation.set(RUN_THUMB_CURL*THUMB_BEND_PROFILE[0]*k,0,mixN(handSide*.70,handSide*.28,k));
  if(chain.tip)chain.tip.rotation.set(RUN_THUMB_CURL*THUMB_BEND_PROFILE[1]*k,0,0);
}
function poseThumbJoints(o,grip){
  (o&&o.thumbRoots||[]).forEach((root,index)=>setThumbChainPose(root,grip,index===0?1:-1));
}
function poseRunPalms(o){
  (o&&o.handRoots||[]).forEach((hand,index)=>{
    if(hand)hand.rotation.y=RUN_PALM_YAW[index];
  });
}
function poseRunFingers(o,state,speed,dt){
  if(!o||!state||!o.fingerJoints)return;
  /* 用真实速度判断“还在移动”而不是把 P.walking 当成永久锁定：收步阶段只要
     还在迈步就保持轻握拳，真正停住后才平滑松开。NPC/过场速度为 0 也会回到站姿。 */
  const target=Number(speed)>RUN_FIST_SPEED?1:0;
  const current=Number.isFinite(state.handGrip)?state.handGrip:0;
  const seconds=target>=current?RUN_FIST_CLOSE_SECONDS:RUN_FIST_OPEN_SECONDS;
  const blend=current+(target-current)*Math.min(1,Math.max(0,Number(dt)||0)/seconds);
  state.handGrip=clamp(blend,0,1);
  (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,index)=>{
    setFingerChainPose(finger,mixN(HAND_FINGER_REST,RUN_FINGER_CURL+(RUN_FINGER_CURL_OFFSETS[index]||0),state.handGrip),0);
  }));
  poseThumbJoints(o,state.handGrip);
}
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
/* 传球接近时恢复 T台导入前的接球路径；腕部先在接触前预对齐，球到手后再缓冲
   到 ready。T台接球腕部和游戏 ready 不是同一套完整旋转基准，直接 slerp 会走
   近半圈；右手只留下第一人称可见的 -10° 掌面滚转，settling 时反向小幅回收。 */
const CATCH_SETTLE_SECONDS=.28;
const CATCH_RIGHT_HAND_PREP_ROLL=-Math.PI/18;
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
  _shotPoseParentQuat=null,_shotPoseWorldQuat=null,_shotPoseDesiredQuat=null,
  _catchParentQuat=null,_catchReadyParentQuat=null,_catchReadyHandQuat=null,
  _catchReadyWorldQuat=null,_catchRollQuat=null,_catchCompatibleWorldQuat=null,
  _catchCompatibleLocalQuat=null,_catchCompatibleHandValues=null;
const _readyHandPos=typeof THREE!=="undefined"?new THREE.Vector3():null;
const _poseXAxis=typeof THREE!=="undefined"?new THREE.Vector3(1,0,0):null;
const _poseYAxis=typeof THREE!=="undefined"?new THREE.Vector3(0,1,0):null;
const _poseZAxis=typeof THREE!=="undefined"?new THREE.Vector3(0,0,1):null;
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
  _catchParentQuat=new THREE.Quaternion();
  _catchReadyParentQuat=new THREE.Quaternion();
  _catchReadyHandQuat=new THREE.Quaternion();
  _catchReadyWorldQuat=new THREE.Quaternion();
  _catchRollQuat=new THREE.Quaternion();
  _catchCompatibleWorldQuat=new THREE.Quaternion();
  _catchCompatibleLocalQuat=new THREE.Quaternion();
  _catchCompatibleHandValues=[0,0,0,1];
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
function addParentYRot(node,rad){
  if(!node||!rad||typeof THREE==="undefined")return;
  ensureShotPoseTemps();
  _shotPoseTargetQuat.setFromAxisAngle(_poseYAxis,rad);
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
function setFootRoll(o,index,footPitch,toePitch){
  const foot=o&&o.footRoots&&o.footRoots[index],toe=o&&o.toeRoots&&o.toeRoots[index];
  if(foot)foot.rotation.set(Number(footPitch)||0,0,0);
  if(toe)toe.rotation.set(Number(toePitch)||0,0,0);
}
function resetFootRoll(o,index){
  if(index==null){
    resetFootRoll(o,0);resetFootRoll(o,1);return;
  }
  setFootRoll(o,index,0,0);
}
function poseHandJoints(o,c){
  if(!o||!o.handRoots)return;
  resetArmGeometry(o);
  resetFootRoll(o);
  (o.legs||[]).forEach(leg=>{if(leg)leg.rotation.y=0;});
  (o.wrists||[]).forEach(wrist=>{if(wrist)wrist.rotation.set(0,0,0);});
  if(o.jerseyHem)o.jerseyHem.rotation.set(0,0,0);
  poseRunPalms(o);
  const lift=c&&c.lift||0;
  o.handRoots.forEach((hand,index)=>{
    if(!hand)return;
    if(hand.position)hand.position.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
    hand.rotation.x=(index===0?.08:0)*lift;
    hand.rotation.z=(index===0?-.025:0)*lift;
  });
  (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,fingerIndex)=>{
    setFingerTarget(o,handIndex,fingerIndex,HAND_FINGER_REST,0);
  }));
  poseThumbJoints(o,0);
}
/* ---------------- T台 animation clips ----------------
   T台负责可编辑的上肢极限姿势，游戏负责位移、脚底、球和状态切换。
   导入器已经把 actor-space 的肩/肘/腕点转换成 game parent-local 四元数；
   这里每帧只做轻量的两关键帧插值，不在 render loop 里重新解 IK。 */
let tstageMotionPackRef=null,tstageMotionClips=null;
let _tstageQuatA=null,_tstageQuatB=null;
function ensureTstageMotionTemps(){
  if(_tstageQuatA||typeof THREE==="undefined")return;
  _tstageQuatA=new THREE.Quaternion();
  _tstageQuatB=new THREE.Quaternion();
}
function tstageMotionClip(name){
  const pack=typeof globalThis!=="undefined"?globalThis.AIBA_TSTAGE_MOTION_PACK:null;
  if(!pack||pack.schema!=="aiba-motion-pack/1"||!pack.clips)return null;
  if(pack!==tstageMotionPackRef){tstageMotionPackRef=pack;tstageMotionClips=pack.clips||{};}
  return tstageMotionClips&&tstageMotionClips[name]||null;
}
function tstageStaticPose(name){
  const pack=typeof globalThis!=="undefined"?globalThis.AIBA_TSTAGE_MOTION_PACK:null;
  if(!pack||pack.schema!=="aiba-motion-pack/1"||!pack.poses)return null;
  return pack.poses[name]||null;
}
function tstageDunkBallLocal(name){
  const pose=tstageStaticPose(name||"dunk_air_jordan");
  return pose&&Array.isArray(pose.ballLocal)?pose.ballLocal:null;
}
/* 投篮动作是可替换的表现层，不影响投篮判定、球物理或现有跑动/接球动作。
   无参数入口默认走 release-feet：保留 game 的上肢/球/物理，只补上真正离地
   后的空中踢腿；显式 ?shotAnim=tstage 切到 T台全上肢版，显式 ?shotAnim=game
   保留原版 game 动作库作为完整回退。动作包重新导入也不会覆盖旧库。 */
const SHOT_ANIMATION_GAME="game",SHOT_ANIMATION_TSTAGE="tstage",SHOT_ANIMATION_RELEASE_FEET="release-feet";
function readShotAnimationMode(){
  try{
    const hasLocation=typeof location!=="undefined"&&location.search&&typeof URLSearchParams!=="undefined";
    const raw=hasLocation?new URLSearchParams(location.search).get("shotAnim"):null;
    const value=String(raw||"").toLowerCase();
    if(value===SHOT_ANIMATION_TSTAGE)return SHOT_ANIMATION_TSTAGE;
    if(value===SHOT_ANIMATION_RELEASE_FEET)return SHOT_ANIMATION_RELEASE_FEET;
    if(value===SHOT_ANIMATION_GAME)return SHOT_ANIMATION_GAME;
    return raw==null||value===""?SHOT_ANIMATION_RELEASE_FEET:SHOT_ANIMATION_GAME;
  }catch(e){return SHOT_ANIMATION_RELEASE_FEET;}
}
let shotAnimationMode=readShotAnimationMode();
function publishShotAnimationMode(){
  if(typeof globalThis!=="undefined")globalThis.AIBA_SHOT_ANIMATION_MODE=shotAnimationMode;
  if(typeof document!=="undefined"&&document.documentElement)
    document.documentElement.dataset.aibaShotAnimation=shotAnimationMode;
}
function setShotAnimationMode(mode){
  const value=String(mode||"").toLowerCase();
  shotAnimationMode=value===SHOT_ANIMATION_TSTAGE?SHOT_ANIMATION_TSTAGE:
    value===SHOT_ANIMATION_RELEASE_FEET?SHOT_ANIMATION_RELEASE_FEET:SHOT_ANIMATION_GAME;
  publishShotAnimationMode();
  if(typeof globalThis!=="undefined"&&globalThis.AIBAShotMotion&&typeof globalThis.AIBAShotMotion.resetShotCycle==="function")
    globalThis.AIBAShotMotion.resetShotCycle();
  return shotAnimationMode;
}
function getShotAnimationMode(){return shotAnimationMode;}
function isTstageShotAnimation(){return shotAnimationMode===SHOT_ANIMATION_TSTAGE&&!!tstageMotionClip("shot_cycle");}
function isReleaseFeetShotAnimation(){return shotAnimationMode===SHOT_ANIMATION_RELEASE_FEET&&!!tstageMotionClip("shot_cycle");}
publishShotAnimationMode();
function tstageFramePair(clip,normalized){
  const frames=clip&&Array.isArray(clip.keyframes)?clip.keyframes:null;
  if(!frames||frames.length<2)return null;
  const u=clamp(normalized,0,1);
  const first=frames[0],last=frames[frames.length-1];
  if(u<=first.t)return {a:first,b:first,k:0};
  if(u>=last.t){
    if(!clip.loop)return {a:last,b:last,k:0};
    const span=Math.max(.0001,1-last.t);
    return {a:last,b:first,k:ease01((u-last.t)/span)};
  }
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1];
    if(u>=a.t&&u<=b.t)return {a,b,k:ease01((u-a.t)/Math.max(.0001,b.t-a.t))};
  }
  return {a:first,b:first,k:0};
}
function tstageRunPhaseNormalized(phase){
  return ((phase/(Math.PI*2)+.75)%1+1)%1;
}
function tstageRunBodyBob(state,hs){
  const config=tstageMotionClip("run")&&tstageMotionClip("run").bodyBob;
  const amplitude=Number(config&&config.amplitude);
  if(!config||!Number.isFinite(amplitude)||amplitude<=0)return 0;
  const frequency=clamp(Number.isFinite(config.frequency)?Number(config.frequency):2,.5,4);
  const phase=Number.isFinite(config.phase)?Number(config.phase):0;
  const normalized=tstageRunPhaseNormalized((state&&state.phase)||0);
  /* T台 run 的 bodyBob 是每个左右换步一次压缩/提起，
     与同一条 run 时间轴上的手臂关键帧保持同相。 */
  return -Math.cos((normalized+phase)*Math.PI*2*frequency)*amplitude*(hs||1);
}
function tstageBlendQuat(node,a,b,k,weight){
  if(!node||!a||!b||!Array.isArray(a)||!Array.isArray(b)||a.length!==4||b.length!==4)return false;
  ensureTstageMotionTemps();
  if(!_tstageQuatA||!_tstageQuatB)return false;
  _tstageQuatA.set(a[0],a[1],a[2],a[3]).normalize();
  _tstageQuatB.set(b[0],b[1],b[2],b[3]).normalize();
  _tstageQuatA.slerp(_tstageQuatB,clamp(k,0,1)).normalize();
  if(weight==null)node.quaternion.copy(_tstageQuatA);
  else node.quaternion.slerp(_tstageQuatA,clamp(weight,0,1)).normalize();
  return true;
}
function tstageBlendQuatValue(node,value,weight){
  if(!node||!value||typeof value.angleTo!=="function")return false;
  if(weight==null)node.quaternion.copy(value);
  else node.quaternion.slerp(value,clamp(weight,0,1)).normalize();
  return true;
}
/* 热身扣篮的 Air Jordan 姿势是 T台导入的静态空中目标。这里不接管起跳高度、
   助跑路线或扣篮时机，只在空中把上肢、下肢和头部渐入目标，保持游戏自己的
   连续弧线；weight=0 时完全等价于原有程序姿势，方便回退和对照。 */
function applyTstageDunkPose(o,weight){
  const pose=tstageStaticPose("dunk_air_jordan"),w=clamp(Number(weight)||0,0,1);
  if(!pose||!o||!o.arms||!o.elbows||!o.handRoots)return false;
  [pose.shooting,pose.guide].forEach((target,index)=>{
    if(!target)return;
    const currentUpper=Math.max(.08,-(o.elbows[index]&&o.elbows[index].position.y||.32));
    const currentLower=Math.max(.08,-(o.handRoots[index]&&o.handRoots[index].position.y||.29));
    const upper=Number.isFinite(target.upperLength)?target.upperLength:currentUpper;
    const lower=Number.isFinite(target.lowerLength)?target.lowerLength:currentLower;
    setArmSegmentLength(o,index,mixN(currentUpper,upper,w),mixN(currentLower,lower,w));
    if(Array.isArray(target.armQuat))tstageBlendQuat(o.arms[index],target.armQuat,target.armQuat,0,w);
    if(Array.isArray(target.elbowQuat))tstageBlendQuat(o.elbows[index],target.elbowQuat,target.elbowQuat,0,w);
    if(Array.isArray(target.handQuat))tstageBlendQuat(o.handRoots[index],target.handQuat,target.handQuat,0,w);
    const curl=Number.isFinite(target.curl)?target.curl:HAND_FINGER_REST;
    const splays=Array.isArray(target.fingerSplays)?target.fingerSplays:null;
    (o.fingerJoints&&o.fingerJoints[index]||[]).forEach((finger,fingerIndex)=>{
      const splay=splays&&Number.isFinite(splays[fingerIndex])
        ?mixN(finger.rotation.z,splays[fingerIndex],w):undefined;
      blendFingerTarget(o,index,fingerIndex,curl,w,splay);
    });
  });
  const lower=pose.lowerBody;
  if(lower&&o.legs&&o.knees&&o.ankles){
    [lower.left,lower.right].forEach((target,index)=>{
      if(!target)return;
      if(Number.isFinite(target.hip))o.legs[index].rotation.x=mixN(o.legs[index].rotation.x,target.hip,w);
      if(Number.isFinite(target.knee))o.knees[index].rotation.x=mixN(o.knees[index].rotation.x,target.knee,w);
      if(Number.isFinite(target.ankle))o.ankles[index].rotation.x=mixN(o.ankles[index].rotation.x,target.ankle,w);
      o.shoes[index].rotation.x=mixN(o.shoes[index].rotation.x,0,w);
    });
  }
  if(o.g&&pose.body&&Array.isArray(pose.body.spineQuat)&&pose.body.spineQuat.length===4){
    /* 当前游戏没有独立 spine 节点；只取 T台 spine 的 X 轴倾角，叠在 actor root
       上。Air Jordan 源姿势的 spine 只有 X 分量，因此不会引入横向扭转。 */
    const q=pose.body.spineQuat;
    const spineX=2*Math.atan2(Number(q[0])||0,Number(q[3])||1);
    o.g.rotation.x=mixN(o.g.rotation.x,spineX,w);
  }
  if(o.headRoot&&pose.body&&Array.isArray(pose.body.headQuat))
    tstageBlendQuat(o.headRoot,pose.body.headQuat,pose.body.headQuat,0,w);
  if(o.g){
    o.g.userData.tstageDunkPose=pose.sourcePose||"dunk_air_jordan";
    o.g.userData.tstageDunkWeight=w;
  }
  return true;
}
/* T台接球终点的右手腕与游戏 ready 的完整四元数不兼容，直接从一个终点
   slerp 到另一个终点会在第一人称里转近半圈。这里不改 T台源 pose，也不改
   SHOT_READY/SHOT_SET 投篮库，只把“接球终点”反解成：
   - 肩/肘仍使用 T台接球几何；
   - 掌面朝向采用游戏 ready 的方向；
   - 留下 -10° 的接触前掌面滚转，settling 向 ready 回收时就是 +10° 的
     小幅逆时针视觉动作。 */
function catchCompatibleHandValues(source){
  if(!source||!Array.isArray(source.armQuat)||!Array.isArray(source.elbowQuat)||
    !Array.isArray(SHOT_READY_POSE.shooting.armQuat)||!Array.isArray(SHOT_READY_POSE.shooting.elbowQuat)||
    !Array.isArray(SHOT_READY_POSE.shooting.handQuat)||typeof THREE==="undefined")return null;
  ensureShotPoseTemps();
  _catchParentQuat.set(source.armQuat[0],source.armQuat[1],source.armQuat[2],source.armQuat[3]).normalize();
  _shotPoseTargetQuat.set(source.elbowQuat[0],source.elbowQuat[1],source.elbowQuat[2],source.elbowQuat[3]).normalize();
  _catchParentQuat.multiply(_shotPoseTargetQuat).normalize();
  _catchReadyParentQuat.set(SHOT_READY_POSE.shooting.armQuat[0],SHOT_READY_POSE.shooting.armQuat[1],SHOT_READY_POSE.shooting.armQuat[2],SHOT_READY_POSE.shooting.armQuat[3]).normalize();
  _shotPoseTargetQuat.set(SHOT_READY_POSE.shooting.elbowQuat[0],SHOT_READY_POSE.shooting.elbowQuat[1],SHOT_READY_POSE.shooting.elbowQuat[2],SHOT_READY_POSE.shooting.elbowQuat[3]).normalize();
  _catchReadyParentQuat.multiply(_shotPoseTargetQuat).normalize();
  _catchReadyHandQuat.set(SHOT_READY_POSE.shooting.handQuat[0],SHOT_READY_POSE.shooting.handQuat[1],SHOT_READY_POSE.shooting.handQuat[2],SHOT_READY_POSE.shooting.handQuat[3]).normalize();
  _catchReadyWorldQuat.copy(_catchReadyParentQuat).multiply(_catchReadyHandQuat).normalize();
  _catchRollQuat.setFromAxisAngle(_poseZAxis,CATCH_RIGHT_HAND_PREP_ROLL);
  _catchCompatibleWorldQuat.copy(_catchReadyWorldQuat).multiply(_catchRollQuat).normalize();
  _catchCompatibleLocalQuat.copy(_catchParentQuat).invert().multiply(_catchCompatibleWorldQuat).normalize();
  _catchCompatibleHandValues[0]=_catchCompatibleLocalQuat.x;
  _catchCompatibleHandValues[1]=_catchCompatibleLocalQuat.y;
  _catchCompatibleHandValues[2]=_catchCompatibleLocalQuat.z;
  _catchCompatibleHandValues[3]=_catchCompatibleLocalQuat.w;
  return _catchCompatibleHandValues;
}
function tstageLimbValue(a,b,key,k,fallback){
  const av=Number.isFinite(a&&a[key])?a[key]:fallback;
  const bv=Number.isFinite(b&&b[key])?b[key]:av;
  return mixN(av,bv,k);
}
function applyTstageRunPose(o,state){
  const clip=tstageMotionClip("run");
  if(!clip||!o||!o.arms||!o.elbows||!o.handRoots)return false;
  /* T台的 run_left_front 是 phase=pi/2 时的同侧脚后摆帧，
     run_right_front 是 phase=3pi/2 时的对侧脚后摆帧；用相位直接映射，
     不再用 cos 产生四分之一周期错位。这样同侧脚向后时同侧手向前。 */
  const phase=state.phase||0;
  const u=tstageRunPhaseNormalized(phase);
  const pair=tstageFramePair(clip,u);
  if(!pair||!pair.a.shooting||!pair.a.guide)return false;
  [pair.a.shooting,pair.a.guide].forEach((from,index)=>{
    const to=pair.b[index===0?"shooting":"guide"]||from;
    const upper=tstageLimbValue(from,to,"upperLength",pair.k,.32);
    const lower=tstageLimbValue(from,to,"lowerLength",pair.k,.29);
    setArmSegmentLength(o,index,upper,lower);
    tstageBlendQuat(o.arms[index],from.armQuat,to.armQuat,pair.k);
    tstageBlendQuat(o.elbows[index],from.elbowQuat,to.elbowQuat,pair.k);
    tstageBlendQuat(o.handRoots[index],from.handQuat,to.handQuat,pair.k);
    const curl=tstageLimbValue(from,to,"curl",pair.k,HAND_FINGER_REST);
    const splay=Array.isArray(from.fingerSplays)?from.fingerSplays:null;
    (o.fingerJoints&&o.fingerJoints[index]||[]).forEach((finger,fingerIndex)=>{
      setFingerTarget(o,index,fingerIndex,curl,splay&&Number.isFinite(splay[fingerIndex])?splay[fingerIndex]:0);
    });
  });
  if(o.g){
    o.g.userData.tstageAnimation="run";
    o.g.userData.tstageRunSource=pair.k<.5?pair.a.sourcePose:pair.b.sourcePose;
    o.g.userData.tstageRunPhase=u;
  }
  return true;
}
function applyTstageCatchPose(o,normalized,weight){
  const clip=tstageMotionClip("catching");
  if(!clip||!o||!o.arms||!o.elbows||!o.handRoots)return false;
  const pair=tstageFramePair(clip,normalized);
  if(!pair||!pair.a.shooting||!pair.a.guide)return false;
  const endpoint=tstageCatchEndpoint();
  const contactAt=Number.isFinite(Number(clip.contactAt))?clamp(Number(clip.contactAt),.5,.98):.86;
  const contactPrep=ease01(clamp((normalized-contactAt)/Math.max(.06,1-contactAt),0,1));
  [pair.a.shooting,pair.a.guide].forEach((from,index)=>{
    const to=pair.b[index===0?"shooting":"guide"]||from;
    const targetUpper=tstageLimbValue(from,to,"upperLength",pair.k,.32);
    const targetLower=tstageLimbValue(from,to,"lowerLength",pair.k,.29);
    const currentUpper=Math.max(.08,-(o.elbows[index]&&o.elbows[index].position.y||.32));
    const currentLower=Math.max(.08,-(o.handRoots[index]&&o.handRoots[index].position.y||.29));
    setArmSegmentLength(o,index,mixN(currentUpper,targetUpper,weight),mixN(currentLower,targetLower,weight));
    tstageBlendQuat(o.arms[index],from.armQuat,to.armQuat,pair.k,weight);
    tstageBlendQuat(o.elbows[index],from.elbowQuat,to.elbowQuat,pair.k,weight);
    tstageBlendQuat(o.handRoots[index],from.handQuat,to.handQuat,pair.k,weight);
    if(index===0&&endpoint&&endpoint.shooting&&contactPrep>0){
      const compatible=catchCompatibleHandValues(endpoint.shooting);
      /* 球接触前才做这次预对齐：前段仍保留 T台的迎球掌面，终点则已经
         与 ready 同向，接球后的 settling 不需要再绕远路。 */
      if(compatible)tstageBlendQuatValue(o.handRoots[index],targetQuat(compatible),contactPrep*clamp(weight,0,1));
    }
    const curl=tstageLimbValue(from,to,"curl",pair.k,HAND_FINGER_REST);
    const splay=Array.isArray(from.fingerSplays)?from.fingerSplays:null;
    (o.fingerJoints&&o.fingerJoints[index]||[]).forEach((finger,fingerIndex)=>{
      const targetSplay=splay&&Number.isFinite(splay[fingerIndex])
        ?mixN(finger.rotation.z,splay[fingerIndex],weight):undefined;
      blendFingerTarget(o,index,fingerIndex,curl,weight,targetSplay);
    });
  });
  if(o.g){
    o.g.userData.tstageAnimation="catching";
    o.g.userData.catchPoseSource=pair.k<.5?pair.a.sourcePose:pair.b.sourcePose;
    o.g.userData.catchRightHandPrep=contactPrep;
    o.g.userData.catchRightHandRoll=CATCH_RIGHT_HAND_PREP_ROLL;
  }
  return true;
}
function tstageCatchEndpoint(){
  const clip=tstageMotionClip("catching");
  const pair=tstageFramePair(clip,1);
  return pair&&pair.a&&pair.a.shooting&&pair.a.guide?pair.a:null;
}
function tstageShotCycleDuration(){
  const clip=tstageMotionClip("shot_cycle");
  const duration=Number(clip&&clip.duration);
  return Number.isFinite(duration)&&duration>.01?duration:0;
}
function tstageShotLowerBody(sourcePose){
  const clip=tstageMotionClip("shot_cycle");
  const frames=clip&&Array.isArray(clip.keyframes)?clip.keyframes:null;
  if(!frames)return null;
  const frame=frames.find(item=>item&&item.sourcePose===sourcePose&&item.lowerBody);
  return frame&&frame.lowerBody||null;
}
/* T台的 shot_release 是正确的动作来源，但它记录的是连续骨架的脚点。
   游戏角色的腿是 0.34 + 0.32 的短骨段，按原始权重落到这个体素骨架后，
   左腿的前送会被压缩到第三人称几乎看不出来。这里是“游戏适配层”的小幅
   空中强调，不改 T台数据，也不改投篮判定：只在真正 airborne 的 release
   窗口加一点髋前送/膝伸展/踝随动，落地时随 landBlend 自动撤掉。 */
const RELEASE_FEET_AIR_ACCENT=Object.freeze({
  /* 这不是地面跨步：只在 airborne 的 release 窗口叠加，出手腿前送、
     另一腿略收。幅度要在第三人称侧面能读出来，不能只停留在“角度有变化”。 */
  left:Object.freeze({hip:-.34,knee:-.16,ankle:.18}),
  right:Object.freeze({hip:.05,knee:.03,ankle:.04})
});
function applyReleaseFeetPose(o,state,baseFootY){
  if(!state||!o||!o.legs||!o.knees||!o.ankles||!o.shoes)return false;
  const release=tstageShotLowerBody("shot_release");
  const land=tstageShotLowerBody("release_keep_land");
  if(!release||!land)return false;
  const released=!!state.released;
  const landBlend=released?clamp(Number(state.landBlend)||0,0,1):0;
  const recover=released?clamp(Number(state.recover)||0,0,1):0;
  /* 只吃空中踢腿权重，且封顶为小幅修饰；地面蓄力不会进入这条写入路径。 */
  const kickWeight=released?clamp(Number(state.kickWeight)||0,0,1):0;
  const targetWeight=kickWeight*(1-recover);
  const airAccentWeight=released?clamp(1-landBlend,0,1)*(1-recover):0;
  for(let index=0;index<2;index++){
    const a=release[index===0?"left":"right"],b=land[index===0?"left":"right"]||a;
    const accent=RELEASE_FEET_AIR_ACCENT[index===0?"left":"right"];
    const targetHip=mixN(a.hip,b.hip,landBlend)+accent.hip*airAccentWeight;
    const targetKnee=mixN(a.knee,b.knee,landBlend)+accent.knee*airAccentWeight;
    const targetAnkle=mixN(a.ankle,b.ankle,landBlend)+accent.ankle*airAccentWeight;
    o.legs[index].rotation.x=mixN(o.legs[index].rotation.x,targetHip,targetWeight);
    o.knees[index].rotation.x=mixN(o.knees[index].rotation.x,targetKnee,targetWeight);
    o.ankles[index].rotation.x=mixN(o.ankles[index].rotation.x,targetAnkle,targetWeight);
    /* release pose 的脚跟/脚尖方向已折算进 ankle 的 parent-local 角度；
       鞋网格本身继续保持游戏的零旋转，避免同一份倾角被写两次。 */
    o.shoes[index].rotation.x=mixN(o.shoes[index].rotation.x,0,targetWeight);
  }
  /* poseGuy 已经按原版腿链算过一次 g.y；下肢改写后只补差值，保持脚底仍在同一地面。 */
  const rootLean=o.g&&o.g.rotation?o.g.rotation.x:0;
  const footY=(poseFootBottomY(o.legs[0].rotation.x+rootLean,o.knees[0].rotation.x,o.ankles[0].rotation.x)+
    poseFootBottomY(o.legs[1].rotation.x+rootLean,o.knees[1].rotation.x,o.ankles[1].rotation.x))*.5;
  if(Number.isFinite(baseFootY)&&o.g)o.g.position.y+=baseFootY-footY;
  if(o.g){
    o.g.userData.tstageAnimation="release-feet";
    o.g.userData.tstageShotSource=null;
    o.g.userData.tstageShotPhase=null;
    o.g.userData.tstageShotDuration=null;
    o.g.userData.releaseFeetSource=landBlend>.5?"release_keep_land":"shot_release";
    o.g.userData.releaseFeetWeight=targetWeight;
    o.g.userData.releaseFeetKickWeight=kickWeight;
    o.g.userData.releaseFeetAirAccent=airAccentWeight;
    o.g.userData.releaseFeetAirborne=!!state.airborne;
    o.g.userData.releaseFeetLandBlend=landBlend;
    o.g.userData.releaseFeetRecover=recover;
  }
  return true;
}
function applyTstageShotCyclePose(o,normalized){
  const clip=tstageMotionClip("shot_cycle");
  if(!clip||!o||!o.arms||!o.elbows||!o.handRoots)return false;
  const pair=tstageFramePair(clip,normalized);
  if(!pair||!pair.a.shooting||!pair.a.guide)return false;
  [pair.a.shooting,pair.a.guide].forEach((from,index)=>{
    const to=pair.b[index===0?"shooting":"guide"]||from;
    const upper=tstageLimbValue(from,to,"upperLength",pair.k,.32);
    const lower=tstageLimbValue(from,to,"lowerLength",pair.k,.29);
    /* layers.root/torso/legs=game：只搬 T台的上肢几何和手型，肩点仍由游戏
       的角色/跳跃链控制，避免 T台某一帧把整个人的高度偷偷带进游戏。 */
    setArmSegmentLength(o,index,upper,lower);
    tstageBlendQuat(o.arms[index],from.armQuat,to.armQuat,pair.k);
    tstageBlendQuat(o.elbows[index],from.elbowQuat,to.elbowQuat,pair.k);
    tstageBlendQuat(o.handRoots[index],from.handQuat,to.handQuat,pair.k);
    const curl=tstageLimbValue(from,to,"curl",pair.k,HAND_FINGER_REST);
    const curls=Array.isArray(from.fingerCurls)?from.fingerCurls:null;
    const splay=Array.isArray(from.fingerSplays)?from.fingerSplays:null;
    (o.fingerJoints&&o.fingerJoints[index]||[]).forEach((finger,fingerIndex)=>{
      const targetCurl=curls&&Number.isFinite(curls[fingerIndex])?curls[fingerIndex]:curl;
      setFingerTarget(o,index,fingerIndex,targetCurl,splay&&Number.isFinite(splay[fingerIndex])?splay[fingerIndex]:0);
    });
  });
  if(o.g){
    o.g.userData.tstageAnimation="shot_cycle";
    o.g.userData.tstageShotPhase=clamp(normalized,0,1);
    o.g.userData.tstageShotSource=pair.k<.5?pair.a.sourcePose:pair.b.sourcePose;
    o.g.userData.tstageShotDuration=tstageShotCycleDuration();
  }
  return true;
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
    setFingerChainPose(finger,mixN(fingerCurlValue(finger),bend,follow),finger.rotation.z);
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
    const splay=handIndex===0?SHOOT_FINGER_SPLAY:GUIDE_FINGER_SPLAY;
    setFingerTarget(o,handIndex,index,mixN(HAND_FINGER_REST,curls[handIndex],grip),(splay[index]||0)*grip);
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
  const force=clamp(Number(state.force)||1,.86,1.18);
  const shoulderK=clamp((Number(state.extend)||0)*force,0,1);
  const elbowK=clamp((Number(state.extend)||0)*(.92+force*.08),0,1);
  const fingerK=clamp((Number(state.follow)||0)*(.94+force*.06),0,1);
  ensureShotPoseTemps();
  const applyQuat=(node,start,targetValues,k)=>{
    if(!node||!start)return;
    _shotPoseBaseQuat.copy(node.quaternion);
    _shotPoseTargetQuat.set(targetValues[0],targetValues[1],targetValues[2],targetValues[3]).normalize();
    if(state.recover>0)node.quaternion.copy(_shotPoseTargetQuat).slerp(_shotPoseBaseQuat,state.recover);
    else node.quaternion.set(start.q[0],start.q[1],start.q[2],start.q[3]).slerp(_shotPoseTargetQuat,k);
    node.quaternion.normalize();
  };
  // 肩肘从用户松手前姿势连续伸展；辅助手自然向球侧打开，随后一起回收。
  applyQuat(shoot,release.shoot,SHOT_FOLLOW_POSE.shooting.armQuat,shoulderK);
  applyQuat(shootEl,release.elbow,SHOT_FOLLOW_POSE.shooting.elbowQuat,elbowK);
  applyQuat(guide,guideStart.arm,SHOT_FOLLOW_POSE.guide.armQuat,shoulderK);
  applyQuat(guideEl,guideStart.elbow,SHOT_FOLLOW_POSE.guide.elbowQuat,elbowK);
  applyShootingHandWorldFollow(o,state,release.hand);
  applyFollowThroughFingers(o,fingerK);
}
/* 两脚在一个步态周期里的最大水平分离 = 真实步幅。
   以前后腿屈膝系数一路涨到 1.4，速度越快反而把后脚收回得越多，真实步幅
   从 .82m 掉到 .74m；相位为了追上身体只能加到 4.8~6.7 步/秒，画面像抽动。
   现在先按速度给出人的步频，再用同一套髋/膝/踝/脚掌几何反解 swing。
   这样高速时是“步子变长、步频封顶”，而不是继续加速抬腿。 */
const RUN_KNEE_FLEX_MIN=.38,RUN_KNEE_FLEX_GAIN=.32;
const RUN_HIP_SWING_MAX=.59;
const RUN_CADENCE_MIN=1.12,RUN_CADENCE_MAX=3.24;
const RUN_STANCE_WALK=.54,RUN_STANCE_RUN=.36;
const RUN_CONTACT_LEAD=.42;
const RUN_HEEL_STRIKE_PITCH=-.14,RUN_MIDSTANCE_PITCH=0,RUN_TOE_OFF_PITCH=.10;
const RUN_TOE_OFF_TOE_PITCH=.20;
const RUN_FOOT_CLEARANCE_MIN=.055,RUN_FOOT_CLEARANCE_GAIN=.070;
const RUN_GROUND_SUPPORT_THRESHOLD=.90;
let _runGroundBox=null;
/* 运行时地面判定必须读真实鞋底网格，而不能继续猜一个“鞋底高度”公式。
   footRig 下面挂着整套鞋底、鞋面和 toeJoint；Box3 会把 foot/toe 的滚转、
   鞋头圆角和角色身高缩放都算进去。它只在跑动姿势已经写完后取一次，避免
   关节公式和画面几何再次分叉。 */
function runFootGroundY(o,index){
  if(typeof THREE==="undefined"||!o||!o.g||!o.footRoots||!o.footRoots[index])return NaN;
  if(!_runGroundBox)_runGroundBox=new THREE.Box3();
  _runGroundBox.setFromObject(o.footRoots[index]);
  return Number.isFinite(_runGroundBox.min.y)?_runGroundBox.min.y:NaN;
}
function runLiftFootSole(o,index,groundY){
  if(!(Number.isFinite(groundY)&&groundY<-.006)||!o||!o.footRoots||!o.footRoots[index])return;
  const foot=o.footRoots[index],parent=foot.parent;
  if(!parent||typeof THREE==="undefined")return;
  const axis=new THREE.Vector3(0,1,0).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));
  const scale=parent.getWorldScale?parent.getWorldScale(new THREE.Vector3()).y:1;
  const factor=axis.y*scale;
  if(Math.abs(factor)>.08)foot.position.y+=-groundY/factor;
}
function runKneeFlex(run){return RUN_KNEE_FLEX_MIN+run*RUN_KNEE_FLEX_GAIN;}
function runCadence(speed){
  const v=clamp(Number(speed)||0,0,4.2),r=clamp(v/3.6,0,1);
  /* 低速段仍允许小碎步，但最高常规跑速约 3.15 步/秒(189 spm)。
     速度继续增加时优先拉长步幅，不再把腿频推到 4~5 步/秒。 */
  return clamp(1.12+2.20*r-.17*r*r,RUN_CADENCE_MIN,RUN_CADENCE_MAX);
}
function runStanceFraction(run){
  return mixN(RUN_STANCE_WALK,RUN_STANCE_RUN,ease01(clamp(run,0,1)));
}
/* 二段腿的解析 IK：先给脚踝一个相对髋部的目标，再反解髋/膝，最后用
   ankle 把小腿末端对齐到脚掌。它让支撑脚可以沿着“身体前进、脚相对后移”
   的轨迹保持稳定，而不是让膝盖和脚踝各自按一条正弦曲线摆。 */
function solveRunLegTarget(z,lift,anklePitch,run,activity){
  const reach=THIGH_LEN+SHIN_LEN-.014;
  const safeZ=clamp(Number(z)||0,-reach*.92,reach*.92);
  const straightDown=Math.sqrt(Math.max(.08,reach*reach-safeZ*safeZ));
  const compression=.045+.035*clamp(Number(run)||0,0,1)+.015*(1-clamp(Number(activity)||0,0,1));
  const down=clamp(straightDown-compression,.30,.61);
  let targetY=-down+Math.max(0,Number(lift)||0);
  let r=Math.hypot(safeZ,targetY);
  if(r>reach-.002){
    const scale=(reach-.002)/r;
    targetY*=scale;r=reach-.002;
  }
  const alpha=Math.atan2(safeZ,-targetY);
  const cosK=clamp((THIGH_LEN*THIGH_LEN+SHIN_LEN*SHIN_LEN-r*r)/(2*THIGH_LEN*SHIN_LEN),-1,1);
  /* 余弦定理得到的是三角形内角：伸直腿对应 PI；骨架的 knee
     rotation 则以 0 代表伸直，所以要取补角。 */
  const knee=Math.PI-Math.acos(cosK);
  const delta=Math.atan2(SHIN_LEN*Math.sin(knee),THIGH_LEN+SHIN_LEN*Math.cos(knee));
  const hip=alpha-delta;
  const ankle=-(hip+knee)+(Number(anklePitch)||0);
  return {hip,knee,ankle,anklePitch:Number(anklePitch)||0,z:safeZ,
    footPitch:0,toePitch:0,lift:Number(lift)||0};
}
/* 兼容旧的“给一个相对摆幅就算步幅”接口，但现在的 z 是 IK 的真实目标，
   不再用直腿近似和硬编码脚踝角度估算距离。 */
function runLegAngles(legSign,swing,run,phaseValue,activity){
  const phase=Number.isFinite(phaseValue)?phaseValue:1;
  const a=activity==null?1:clamp(activity,0,1);
  return solveRunLegTarget(legSign*phase*swing,0,0,run,a);
}
function runFootSpan(swing,run){
  const front=runLegAngles(1,swing,run,1,1),back=runLegAngles(-1,swing,run,1,1);
  return Math.max(.12,Math.abs(front.z-back.z));
}
function solveRunSwing(stepLength,run){
  const minSwing=0,maxSwing=RUN_HIP_SWING_MAX;
  const minSpan=runFootSpan(minSwing,run),maxSpan=runFootSpan(maxSwing,run);
  const target=clamp(stepLength,minSpan,maxSpan);
  let lo=minSwing,hi=maxSwing;
  for(let i=0;i<18;i++){
    const mid=(lo+hi)*.5;
    if(runFootSpan(mid,run)<target)lo=mid;else hi=mid;
  }
  return (lo+hi)*.5;
}
/* 一只脚的完整步态时间轴：u=0 是脚跟接触，随后承重、前掌蹬地，
   u=stance 后进入空中摆动。stance 段的 z 斜率固定为 -2*stepLength，
   与位移驱动的 phase 完全相等，因此支撑脚相对世界不会反向滑动。 */
function runFootPhase(index,phase,stepLength,run){
  const u=((phase/(Math.PI*2)-.25+index*.5)%1+1)%1;
  const stance=runStanceFraction(run);
  const lead=stepLength*(RUN_CONTACT_LEAD+.04*clamp(run,0,1));
  const toeOff=lead-2*stepLength*stance;
  const clearance=RUN_FOOT_CLEARANCE_MIN+RUN_FOOT_CLEARANCE_GAIN*clamp(run,0,1);
  if(u<stance){
    const heelSettle=ease01(clamp(u/.08,0,1));
    const toeRoll=ease01(clamp((u-(stance-.16))/.16,0,1));
    return {u,stance,z:lead-2*stepLength*u,lift:0,contact:1,support:1,grounded:true,
      footPitch:mixN(mixN(RUN_HEEL_STRIKE_PITCH,RUN_MIDSTANCE_PITCH,heelSettle),RUN_TOE_OFF_PITCH,toeRoll),
      toePitch:RUN_TOE_OFF_TOE_PITCH*toeRoll,anklePitch:0};
  }
  const q=clamp((u-stance)/Math.max(.001,1-stance),0,1),qEase=ease01(q);
  const landing=ease01(clamp((q-.88)/.12,0,1));
  return {u,stance,z:mixN(toeOff,lead,qEase),lift:Math.sin(Math.PI*q)*clearance,
    contact:landing,support:landing,grounded:false,
    footPitch:mixN(RUN_TOE_OFF_PITCH,RUN_HEEL_STRIKE_PITCH,qEase),
    toePitch:mixN(RUN_TOE_OFF_TOE_PITCH,0,qEase),anklePitch:-.045*Math.sin(Math.PI*q)};
}
function runLegFromFoot(foot,run,activity){
  const a=clamp(activity==null?1:activity,0,1);
  /* 走位状态刚结束时，调用方仍可能再跑一帧 poseRunCycle(0, …)。
     这时必须回到站立腿，而不是把“跑步目标压到零”交给 IK；后者仍会
     为了留出脚底余量而解出一副半蹲姿势。脚部事件数据仍保留，便于
     调试器看到最后一个相位，但骨骼已经明确回到静止姿势。 */
  if(a<.05)return {hip:0,knee:0,ankle:0,footPitch:0,toePitch:0,
    contact:0,support:0,grounded:false,lift:0,phase:foot.u,stance:foot.stance};
  const leg=solveRunLegTarget(foot.z*a,foot.lift*a,foot.anklePitch*a,run,a);
  leg.footPitch=foot.footPitch*a;leg.toePitch=foot.toePitch*a;
  leg.contact=foot.contact;leg.support=foot.support;leg.grounded=foot.grounded;
  leg.lift=foot.lift*a;leg.phase=foot.u;leg.stance=foot.stance;
  return leg;
}
/* 跑动的生命力层：腿只负责步态，肩带/髋部负责反向扭转，腕部、头发/头带
   负责轻微的惯性滞后。它叠在 T台 run clip 之后，不会改动脚的几何步幅，也
   不会改动 shot_cycle / catch / release 的关键帧。 */
function applyRunVitality(o,state,run,dt,defensive){
  if(!o||!state)return;
  const phase=Number(state.phase)||0,s=Math.sin(phase);
  const active=clamp(Number.isFinite(Number(state.runActive))?Number(state.runActive):0,0,1);
  const twist=(.035+clamp(run,0,1)*.105)*s*active*(defensive?.28:1);
  const hipTwist=twist*(defensive?.20:.48);
  if(o.legs&&o.legs.length>1){
    /* 同侧腿向前时，同侧髋向后扭；只写髋根的 Y 轴，不碰腿的前后摆和落地解算。 */
    o.legs[0].rotation.y=hipTwist;
    o.legs[1].rotation.y=-hipTwist;
  }
  if(!defensive&&o.arms&&o.arms.length>1){
    addParentYRot(o.arms[0],twist);
    addParentYRot(o.arms[1],-twist);
    if(o.elbows&&o.elbows.length>1){
      addParentYRot(o.elbows[0],twist*.34);
      addParentYRot(o.elbows[1],-twist*.34);
    }
  }
  const wristTarget=s*(.008+clamp(run,0,1)*.022)*active*(defensive?.25:1);
  const wristCurrent=Number.isFinite(state.runWristSpring)?state.runWristSpring:0;
  state.runWristSpring=wristCurrent+(wristTarget-wristCurrent)*Math.min(1,Math.max(0,Number(dt)||0)*11);
  (o.wrists||[]).forEach((wrist,index)=>{
    if(wrist)wrist.rotation.z=state.runWristSpring*(index===0?-1:1);
  });
  const hemTarget=-s*(.010+clamp(run,0,1)*.026)*active;
  const hemCurrent=Number.isFinite(state.runHemSpring)?state.runHemSpring:0;
  state.runHemSpring=hemCurrent+(hemTarget-hemCurrent)*Math.min(1,Math.max(0,Number(dt)||0)*9);
  if(o.jerseyHem){
    o.jerseyHem.rotation.x=state.runHemSpring;
    o.jerseyHem.rotation.z=state.runHemSpring*.62;
  }
  const springTarget=-s*(.010+clamp(run,0,1)*.028);
  const current=Number.isFinite(state.runSpring)?state.runSpring:0;
  state.runSpring=current+(springTarget-current)*Math.min(1,Math.max(0,Number(dt)||0)*10);
  const headTarget=-s*(.022+clamp(run,0,1)*.055);
  const headYaw=Number.isFinite(state.runHeadYaw)?state.runHeadYaw:0;
  state.runHeadYaw=headYaw+(headTarget-headYaw)*Math.min(1,Math.max(0,Number(dt)||0)*8);
  if(o.headRoot)o.headRoot.rotation.y=state.runHeadYaw;
  if(o.hairGrp)o.hairGrp.rotation.z=state.runSpring*1.8;
  if(o.headband)o.headband.rotation.z=state.runSpring*.9;
  if(o.g){
    o.g.userData.runShoulderTwist=twist;
    o.g.userData.runHipTwist=hipTwist;
    o.g.userData.runWristSpring=state.runWristSpring;
    o.g.userData.runHemSpring=state.runHemSpring;
    o.g.userData.runHeadLag=state.runHeadYaw;
    o.g.userData.runSecondarySpring=state.runSpring;
  }
}
/* 非投篮动作也不能从“静止”硬切到终点姿势。
   这层只叠在动作自己的关节结果上：前 180ms 做很小的反向预备，动作已经
   到位后再让头发、球衣下摆、护腕晚半拍回收。它不改根节点、脚底或球的
   世界位置，所以不会把庆祝/反应动作重新变成离地或滑步。 */
const ACTION_PREP_DIRECTION=Object.freeze({
  raise:[1,1],point:[1,0],rush:[1,1],push:[1,1],crash:[1,1],hug:[1,1],
  retrieve:[-.45,-.45],fall:[-1,-1],head:[1,1],invalid:[1,1],kneel:[.35,.35],
  sad:[-.3,-.3],slow:[.18,.18],freeze:[0,0]
});
function actionTimingKind(kind){
  const raw=String(kind==null?"":kind).toLowerCase();
  if(raw.indexOf("celebrate")===0){
    const match=raw.match(/\d+/),n=match?Number(match[0]):0;
    return ["raise","point","point","raise","raise","hug","point","sad"][Number.isFinite(n)?Math.max(0,Math.min(7,n)):0]||"raise";
  }
  return ACTION_PREP_DIRECTION[raw]?raw:"freeze";
}
function applyActionTimingPose(o,t,kind,phase){
  if(!o)return false;
  const label=actionTimingKind(kind),time=Math.max(0,Number(t)||0);
  const prep=1-ease01(clamp(time/.18,0,1));
  const follow=ease01(clamp((time-.54)/.42,0,1));
  const dir=ACTION_PREP_DIRECTION[label]||ACTION_PREP_DIRECTION.freeze;
  if(prep>1e-4&&o.arms){
    o.arms.forEach((arm,index)=>{
      if(arm)arm.rotation.x+=.105*prep*(dir[index]||0);
    });
    (o.elbows||[]).forEach((elbow,index)=>{
      if(elbow)elbow.rotation.x+=.045*prep*(dir[index]||0);
    });
  }
  const wave=Math.sin(time*9.6+(Number(phase)||0));
  if(o.headRoot)o.headRoot.rotation.z=wave*.024*follow;
  if(o.hairGrp)o.hairGrp.rotation.z=wave*.052*follow;
  if(o.headband)o.headband.rotation.z=wave*.026*follow;
  if(o.jerseyHem){
    o.jerseyHem.rotation.x=wave*.030*follow;
    o.jerseyHem.rotation.z=wave*.020*follow;
  }
  (o.wrists||[]).forEach((wrist,index)=>{
    if(wrist)wrist.rotation.z=wave*.016*follow*(index===0?-1:1);
  });
  if(o.g){
    o.g.userData.actionTimingKind=label;
    o.g.userData.actionAnticipation=prep;
    o.g.userData.actionFollowThrough=follow;
    o.g.userData.actionOverlap=wave*follow;
  }
  return prep>1e-4||follow>1e-4;
}
/* 投篮允许有极轻微的“活人”偏差，但不能重新解算持球手，否则球心会在手里
   漂移、最高点也会偏离 T台定点。噪声只叠加在辅助手/头部，使用无状态哈希，
   同一个 ?seed + shot key 每次都一样；相位包络在 0 和 1 严格归零，关键帧不变。 */
function shotPoseNoiseUnit(key,channel){
  const seeded=typeof AIBARandom!=="undefined"&&AIBARandom&&typeof AIBARandom.currentSeed==="function"
    ?AIBARandom.currentSeed():0;
  let x=((Number(seeded)||0)>>>0)^Math.imul(((Number(key)||0)+1)>>>0,0x45d9f3b);
  x^=Math.imul(((Number(channel)||0)+17)>>>0,0x27d4eb2d);
  x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);x^=x>>>16;
  return ((x>>>0)/4294967296)*2-1;
}
function applyShotPoseNoise(o,phase,key){
  if(!o||!o.arms||o.arms.length<2)return false;
  const p=clamp(Number(phase)||0,0,1),envelope=Math.sin(Math.PI*p);
  if(envelope<=1e-5){
    if(o.g){o.g.userData.shotPoseNoisePhase=p;o.g.userData.shotPoseNoise=[0,0,0];}
    return false;
  }
  const guideYaw=shotPoseNoiseUnit(key,1)*.035*envelope;
  const guidePitch=shotPoseNoiseUnit(key,2)*.022*envelope;
  const guideRoll=shotPoseNoiseUnit(key,3)*.018*envelope;
  addParentYRot(o.arms[1],guideYaw);
  addParentXRot(o.arms[1],guidePitch);
  if(o.elbows&&o.elbows[1]){
    addParentYRot(o.elbows[1],-guideYaw*.48);
    addParentXRot(o.elbows[1],guidePitch*.65);
  }
  if(o.handRoots&&o.handRoots[1])o.handRoots[1].rotation.z+=guideRoll;
  if(o.g){
    o.g.userData.shotPoseNoisePhase=p;
    o.g.userData.shotPoseNoise=[guideYaw,guidePitch,guideRoll];
    o.g.userData.shotPoseNoiseKey=Number(key)||0;
  }
  return true;
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
  /* NPC/绝杀队员也会直接调用这个共享跑动循环，不能只依赖主角后续的 poseHandJoints；
     否则主角掌心相对、其他跑动角色却仍然掌心朝地。投篮/接球关键帧在后续阶段覆盖它。 */
  poseRunPalms(o);
  const cfg=opts||{},hs=cfg.hs||1;
  const run=clamp(speed/3.6,0,1);
  /* ---- 步幅/步频 ----
     先定自然步频，再反推出这一步需要多长。最高常规跑速把步频封在约
     189 spm，超出的速度交给更长的步幅，不再用高频抽腿掩盖几何误差。 */
  const cadence=runCadence(speed);
  const L=clamp(speed/Math.max(.01,cadence),.34,1.16);
  const solvedSwing=solveRunSwing(L,run);
  /* 起步第一帧 speed 可能还是 0，不能因此把双腿冻结在一个随机半步姿态。
     这里的 stepLen 与 IK 的两脚几何分离相同，phase 仍然按位移推进。 */
  const gaitBlend=clamp(speed/.45,0,1);
  state.runActive=gaitBlend;
  const stepLen=Math.max(.12,runFootSpan(solvedSwing,run));
  state.phase=(state.phase||0)+(speed*dt/stepLen)*Math.PI;
  state.idleT=(state.idleT||0)+dt;
  const s=Math.sin(state.phase),c=Math.cos(state.phase);
  const idle=Math.sin(state.idleT*1.7)*.03;
  const footAState=runFootPhase(0,state.phase,stepLen,run);
  const footBState=runFootPhase(1,state.phase,stepLen,run);
  const legA=runLegFromFoot(footAState,run,gaitBlend),legB=runLegFromFoot(footBState,run,gaitBlend);
  const hipA=legA.hip,hipB=legB.hip;
  const kneeA=legA.knee,kneeB=legB.knee;
  const ankA=legA.ankle,ankB=legB.ankle;
  o.legs[0].rotation.x=hipA;o.legs[1].rotation.x=hipB;
  o.knees[0].rotation.x=kneeA;o.knees[1].rotation.x=kneeB;
  o.ankles[0].rotation.x=ankA;o.ankles[1].rotation.x=ankB;
  setFootRoll(o,0,legA.footPitch,legA.toePitch);
  setFootRoll(o,1,legB.footPitch,legB.toePitch);
  /* 鞋面自身保持局部 0；foot 负责整脚滚动，toe 只在蹬地/落地窗口折叠。 */
  o.shoes[0].rotation.x=0;o.shoes[1].rotation.x=0;
  if(o.g){
    o.g.userData.runCadence=speed>0.001?speed/stepLen:0;
    o.g.userData.runStride=stepLen;
    o.g.userData.runTargetStride=L;
    o.g.userData.runAnklePitch=[legA.footPitch,legB.footPitch];
    o.g.userData.runFootContact=[legA.contact,legB.contact];
    o.g.userData.runFootSupport=[legA.support,legB.support];
    o.g.userData.runFootPhase=[legA.phase,legB.phase];
    o.g.userData.runFootPitch=[legA.footPitch,legB.footPitch];
    o.g.userData.runToePitch=[legA.toePitch,legB.toePitch];
    o.g.userData.runFootLift=[legA.lift,legB.lift];
    o.g.userData.runStanceFraction=runStanceFraction(run);
  }
  if(cfg.arms!==false){
    // 防守人张开双臂，进攻人自然摆臂
    if(cfg.defensive){
      const spread=.55+run*.25;
      o.arms[0].rotation.z=-spread;o.arms[1].rotation.z=spread;
      o.arms[0].rotation.x=-.5-idle;o.arms[1].rotation.x=-.5+idle;
      o.elbows[0].rotation.x=-.35;o.elbows[1].rotation.x=-.35;
    }else{
      /* 小跑摆臂：同侧脚向前时，同侧大臂向后、对侧大臂向前。
         肘部只保持一个接近 80° 的弯折，不再反解成固定世界前臂角；
         这样小臂会跟着大臂一起前后摆，不会整段锁成“接球手”。 */
      const armSwing=.24+run*.30,armBase=-.20;
      const armA=armBase-s*armSwing,armB=armBase+s*armSwing;
      o.arms[0].rotation.set(armA,0,0);o.arms[1].rotation.set(armB,0,0);
      /* 必须和**同侧的腿**反相:legs[0] 和 arms[0] 都建在 x 负侧(见 characters.js
         的 [-HIP_X,HIP_X] / [-SHOULDER_X,SHOULDER_X] 两个循环),而真实步态是
         右臂前摆配左腿前迈。原来这里用 cos、腿用 sin,整整差了 90° ——
         单看手或单看腿都对,合起来就是说不出哪里别扭。 */
      const elbowBend=-1.28-run*.12;
      o.elbows[0].rotation.set(elbowBend,0,0);
      o.elbows[1].rotation.set(elbowBend,0,0);
    }
  }
  if(cfg.arms!==false&&!cfg.defensive)applyTstageRunPose(o,state);
  /* T台 run clip 也可能写入自己的 finger curl；共享层最后统一成游戏的轻握拳，
     这样默认 game、T台开关和绝杀跑动不会出现三种手型。 */
  if(cfg.arms!==false)poseRunFingers(o,state,speed,dt);
  state.lean=(state.lean||0)+(run*.16-(state.lean||0))*Math.min(1,dt*6);
  o.g.rotation.x=state.lean;
  /* 左右摆:重心在两条支撑腿之间来回,频率等于步频。少了它,人像装在轨道上平移。
     只在调用方明确要的时候开 —— 防守人横向滑步时 rotation.z 另有用途,
     而且 squad 里有自己写 rotation.z 的地方,不能无条件覆盖。 */
  if(cfg.sway)o.g.rotation.z=s*(.012+run*.026);
  if(cfg.resetHead!==false&&o.headRoot)o.headRoot.rotation.set(0,0,0);
  if(cfg.arms!==false)applyRunVitality(o,state,run,dt,!!cfg.defensive);
  const footYA=poseFootBottomY(hipA,kneeA,ankA,legA.footPitch,legA.toePitch);
  const footYB=poseFootBottomY(hipB,kneeB,ankB,legB.footPitch,legB.toePitch);
  /* footRoot 的 y 位移是上一帧的接地安全垫，必须先清掉；真实鞋底测量
     只针对当前这一帧的姿势，不能把上一帧的修正累积成腿越来越长。 */
  if(o.footRoots)o.footRoots.forEach(foot=>{if(foot&&foot.position)foot.position.y=0;});
  const supportTotal=legA.support+legB.support;
  const footY=supportTotal>.05
    ?(footYA*legA.support+footYB*legB.support)/supportTotal
    :(footYA+footYB)*.5;
  /* 重心起伏仍保留 T台 bodyBob，但支撑脚接地时压低为 35%，把更多的起伏
     放到双脚离地/换重心的瞬间，避免“身体上下动、支撑脚也漂起来”。 */
  const gaitBounce=-(.004+run*.010)*(.5+.5*Math.cos(state.phase*2));
  const bodyBob=tstageRunBodyBob(state,hs)+gaitBounce*(supportTotal>.05?.35:1);
  o.g.position.y=POSE_STAND_FOOT_Y-footY*hs+bodyBob;
  /* 解析包络只用于给出初始高度；真实鞋底可能因圆角鞋头、toeJoint 或
     T台脚掌滚转比公式更低。支撑脚必须落在 y=0，空中脚也不允许穿过地面。
     correction 为当前世界空间鞋底最低点：负值抬高角色，正值下压角色。 */
  o.g.updateMatrixWorld(true);
  const groundA=runFootGroundY(o,0),groundB=runFootGroundY(o,1);
  const lowestGround=Math.min(
    Number.isFinite(groundA)?groundA:Infinity,
    Number.isFinite(groundB)?groundB:Infinity
  );
  /* 不要用两脚支撑权重的平均值：换步窗口里另一只脚可能只有很小的
     contact 权重，却会把真正承重脚向上平均，画面就会出现“支撑脚悬空”。
     接地目标取当前有支撑权重的真实鞋底最低点，保证每一只承重脚都能
     贴住地面；两脚都在过渡时取较低者，剩余高度只来自真实鞋底几何。 */
  const supportGrounds=[];
  if(legA.support>=RUN_GROUND_SUPPORT_THRESHOLD&&Number.isFinite(groundA))supportGrounds.push(groundA);
  if(legB.support>=RUN_GROUND_SUPPORT_THRESHOLD&&Number.isFinite(groundB))supportGrounds.push(groundB);
  const supportGround=supportGrounds.length?Math.min(...supportGrounds):NaN;
  /* 有支撑时先锁定承重脚，而不是为了摆动脚的 1~2mm 包围盒噪声把整个人
     抬起来。只有摆动脚真的穿入超过 QA 容差，才启用整根角色的保底抬升；
     这样换步时不会出现“鞋底不穿地，但支撑脚悬空”的反效果。 */
  let groundCorrection=Number.isFinite(supportGround)?supportGround:0;
  if(!supportGrounds.length){
    groundCorrection=Number.isFinite(lowestGround)&&lowestGround<0?lowestGround:0;
  }
  if(Number.isFinite(groundCorrection)&&Math.abs(groundCorrection)>.00001){
    const rootScaleY=o.g.getWorldScale?o.g.getWorldScale(new THREE.Vector3()).y:1;
    o.g.position.y-=groundCorrection/Math.max(.0001,rootScaleY);
    o.g.updateMatrixWorld(true);
  }
  /* 只抬摆动脚的鞋底，不把整个人连同承重脚一起抬高。正常情况下这里
     不会超过几毫米；如果脚掌滚转让鞋尖真的穿进场地，安全垫会沿踝关节
     的局部竖向补回鞋底，下一帧再由上面的 reset 重新计算。 */
  const correctedA=runFootGroundY(o,0),correctedB=runFootGroundY(o,1);
  if(legA.support<RUN_GROUND_SUPPORT_THRESHOLD)runLiftFootSole(o,0,correctedA);
  if(legB.support<RUN_GROUND_SUPPORT_THRESHOLD)runLiftFootSole(o,1,correctedB);
  if((legA.support<RUN_GROUND_SUPPORT_THRESHOLD&&Number.isFinite(correctedA)&&correctedA<-.006)||
     (legB.support<RUN_GROUND_SUPPORT_THRESHOLD&&Number.isFinite(correctedB)&&correctedB<-.006))
    o.g.updateMatrixWorld(true);
  const finalGroundA=runFootGroundY(o,0),finalGroundB=runFootGroundY(o,1);
  o.g.userData.tstageRunBodyBob=bodyBob;
  o.g.userData.runBodyBounce=gaitBounce;
  o.g.userData.runFootGroundRaw=[groundA,groundB];
  o.g.userData.runFootGround=[
    finalGroundA,finalGroundB
  ];
  o.g.userData.runGroundCorrection=groundCorrection;
  return footY;
}
/* poseRunCycle 之后，投篮物理还可能给角色根节点叠一帧 P.jump。
   这份外部根高度不能让承重脚一起升离地面，所以在所有上层动作写完后再做
   一次只针对支撑脚的收口。它不改腿角度，下一帧仍由同一套步态重新计算。 */
function regroundRunPose(o){
  if(typeof THREE==="undefined"||!o||!o.g||!o.footRoots)return 0;
  o.g.updateMatrixWorld(true);
  const support=o.g.userData&&o.g.userData.runFootSupport||[];
  const grounds=o.footRoots.map((foot,index)=>foot?runFootGroundY(o,index):NaN);
  const supported=grounds.filter((y,index)=>Number.isFinite(y)&&Number(support[index])>=RUN_GROUND_SUPPORT_THRESHOLD);
  const finite=grounds.filter(Number.isFinite);
  let correction=supported.length?Math.min(...supported):0;
  if(!supported.length){
    const lowest=finite.length?Math.min(...finite):0;
    correction=lowest<0?lowest:0;
  }
  if(Math.abs(correction)>.00001){
    const scale=o.g.getWorldScale?o.g.getWorldScale(new THREE.Vector3()).y:1;
    o.g.position.y-=correction/Math.max(.0001,scale);
    o.g.updateMatrixWorld(true);
  }
  /* 根节点下沉后，摆动脚可能被同一份外部 P.jump 带进地面；承重脚不能
     跟着一起抬，所以只把穿地的非支撑脚沿踝关节局部竖向补回。 */
  const correctedGrounds=o.footRoots.map((foot,index)=>foot?runFootGroundY(o,index):NaN);
  correctedGrounds.forEach((ground,index)=>{
    if(Number(support[index])<RUN_GROUND_SUPPORT_THRESHOLD&&Number.isFinite(ground)&&ground<-.006)
      runLiftFootSole(o,index,ground);
  });
  const finalGrounds=o.footRoots.map((foot,index)=>foot?runFootGroundY(o,index):NaN);
  if(o.g){
    o.g.userData.runFootGroundPost=finalGrounds;
    o.g.userData.runGroundPostCorrection=correction;
  }
  return correction;
}
/* ⚠ 这个骨架里 g.rotation.x 的正号是【后仰】，不是前倾。
   实测：+0.175 时头沿朝向位移 -0.0376m（往后），-0.175 时 +0.0376m（往前）。
   所以前倾必须用负号。原来那行的注释写着"上身前倾:蓄力约10°"但用的是
   正号 0.12*load —— 注释和实际方向是反的，蓄力时人其实在后仰。
   现在是 -DIP_LEAN*load，真的前倾。

   前倾只跟蓄力走：dip 涨 -> 身体压下去，到最低点最深；起跳后 jmp 把 load 吃掉
   -> 自动回正往上送。接球那一下不加任何前倾，人是站直的。
   幅度 DIP_LEAN=0.175，最深处正好 10°（实测 load 峰值到 1.0）。
   原来是 0.12(6.9°)，压下去的感觉不够。 */
const DIP_LEAN=0.175;
/* ready_pose1 的下肢是“髋先折、膝随后承重”的参考，不直接替换游戏腿链：
   只在蓄力 load 窗口渐入，保留游戏原本的左右错位、起跳和落地时序。若动作包
   暂不可用，使用从 ready_pose1 记录下来的同一组安全兜底数。 */
const READY_LOWER_HIP_BLEND=.72,READY_LOWER_KNEE_BLEND=.45,READY_LOWER_ANKLE_BLEND=.35;
const READY_LOWER_FALLBACK=[
  Object.freeze({hip:-.709615,knee:1.041349,ankle:-.331733}),
  Object.freeze({hip:-.570701,knee:.925559,ankle:-.363847})
];
function shotReadyLowerTarget(index){
  const lower=typeof tstageShotLowerBody==="function"?tstageShotLowerBody("ready_pose1"):null;
  const target=lower&&(index===0?lower.left:lower.right);
  return target&&Number.isFinite(target.hip)&&Number.isFinite(target.knee)&&Number.isFinite(target.ankle)
    ?target:READY_LOWER_FALLBACK[index]||READY_LOWER_FALLBACK[0];
}
/* 待机呼吸的频率与幅度。1cm 量级 —— 方块画风下再大就成了喘气。 */
const BREATH_RATE=1.25,BREATH_AMP=0.010;
/* 投篮后的 ready bounce：不改 P.pos，只让脚下有一点持续的踝/膝弹性。
   只在真实比赛站定时启用，蓄力、起跳、走位和过场仍由各自姿势完全接管。 */
const READY_BOUNCE_RATE=4.8,READY_BOUNCE_AMP=.012,READY_KNEE_FLEX=.060,READY_ANKLE_FLEX=.075;
const READY_FOOT_ROLL=.12,LAND_FOOT_PITCH=.10;
const READY_PLAY_STATES=Object.freeze({round:1,tiebreak:1,battle:1,rackrush:1,lastshot:1});
function poseGuy(o,c,lk,landingImpact){
  poseHandJoints(o,c);
  const sh=o.arms[0],gd=o.arms[1]; // arms[0]=x-0.33=角色右手(面朝篮筐时屏幕右侧) 投篮 / arms[1]=左手 护球
  sh.rotation.set(IDLE_ARM_X-0.25*c.dip-1.55*c.lift-0.9*c.jmp,0,-0.12*c.lift);
  o.elbows[1].rotation.set(IDLE_ELBOW_BEND-1.2*c.lift*(1-c.jmp*0.92)-0.4*c.over,0,0);
  gd.rotation.set(IDLE_ARM_X-0.2*c.dip-1.1*c.lift-0.5*c.jmp+0.55*c.over,0,0.18*c.lift);
  o.elbows[0].rotation.set(IDLE_ELBOW_BEND-0.85*c.lift*(1-c.jmp*0.6),0,0);
  // 所有普通姿势完成后，唯一一次写入控制台给出的松手前双手姿势。
  applyShotSetPose(o,c);
  /* Real-shot leg chain: knees load forward, calves fold back into a V, soles stay planted until takeoff.
     ready_pose1 的髋/膝/踝只作为蓄力目标渐入，不抢走游戏自己的起跳曲线。 */
  const load=c.dip*(1-c.jmp*0.86);
  const land=(lk||0)*clamp(landingImpact==null?1:landingImpact,.42,1);
  /* g 目前是角色共同根，但投篮蓄力需要的是“髋以上前倾、下肢仍承重”。
     让腿根加入相反的根部倾角补偿后，世界空间的大腿/脚底不会跟着躯干
     一起倒下；躯干相对大腿的夹角才是真正的屈髋，而不是整个人倾斜。 */
  const torsoLean=-DIP_LEAN*load - 0.06*c.over - 0.03*c.jmp + 0.08*land;
  const lowerBodyHingeComp=-torsoLean;
  const readyLeft=shotReadyLowerTarget(0),readyRight=shotReadyLowerTarget(1);
  const loadBlend=clamp(load,0,1);
  const hipBase=-0.48*load-0.24*land+0.06*c.jmp;
  const kneeBase=Math.max(0,0.98*load+0.82*land-0.78*c.jmp);
  const rawHipLead=hipBase-0.03*load,rawHipTrail=hipBase+0.03*load;
  const rawKneeLead=kneeBase*0.96,rawKneeTrail=kneeBase*1.04;
  const rawAnkleLead=-(rawHipLead+rawKneeLead)*0.98-0.18*c.jmp+0.04*land;
  const rawAnkleTrail=-(rawHipTrail+rawKneeTrail)*0.98-0.18*c.jmp+0.04*land;
  const hipLead=mixN(rawHipLead,readyLeft.hip,loadBlend*READY_LOWER_HIP_BLEND);
  const hipTrail=mixN(rawHipTrail,readyRight.hip,loadBlend*READY_LOWER_HIP_BLEND);
  const kneeLead=mixN(rawKneeLead,readyLeft.knee,loadBlend*READY_LOWER_KNEE_BLEND);
  const kneeTrail=mixN(rawKneeTrail,readyRight.knee,loadBlend*READY_LOWER_KNEE_BLEND);
  const ankleLead=mixN(rawAnkleLead,readyLeft.ankle,loadBlend*READY_LOWER_ANKLE_BLEND);
  const ankleTrail=mixN(rawAnkleTrail,readyRight.ankle,loadBlend*READY_LOWER_ANKLE_BLEND);
  o.legs[0].rotation.x=hipLead+lowerBodyHingeComp;
  o.legs[1].rotation.x=hipTrail+lowerBodyHingeComp;
  o.knees[0].rotation.x=kneeLead;
  o.knees[1].rotation.x=kneeTrail;
  o.ankles[0].rotation.x=ankleLead;
  o.ankles[1].rotation.x=ankleTrail;
  o.shoes[0].rotation.x=0;
  o.shoes[1].rotation.x=0;
  resetFootRoll(o);
  /* 投篮落地先由前脚掌承接，再回到全脚掌。这里要动 ankle group，
     不能只转鞋面，否则鞋底仍是一张平板。 */
  if(land){
    o.ankles[0].rotation.x+=land*LAND_FOOT_PITCH;
    o.ankles[1].rotation.x+=land*LAND_FOOT_PITCH;
    setFootRoll(o,0,-.035*land,.11*land);
    setFootRoll(o,1,-.026*land,.07*land);
  }
  const busy=clamp(load+c.lift+c.jmp+(c.over||0)+land,0,1);
  const isReadyPlayer=typeof player!=="undefined"&&o===player&&typeof G!=="undefined"&&
    READY_PLAY_STATES[G.state]&&!G.charging&&!G.moving&&!G.buzzed&&busy<.12;
  const readyClock=isReadyPlayer&&Number.isFinite(G.tNow)?G.tNow:0;
  const readyWave=isReadyPlayer?Math.sin(readyClock*READY_BOUNCE_RATE):0;
  const readyPulse=readyWave>0?readyWave*readyWave:0;
  if(isReadyPlayer){
    o.g.rotation.z=readyPulse?(0.5+0.16*Math.sin(readyClock*READY_BOUNCE_RATE+Math.PI*.5)-.5)*.018:0;
  }
  if(readyPulse){
    /* 一只脚稍多承重，另一只脚随 beat 轻轻卸力；幅度很小，观感是踝关节有弹性，
       不是原地踏步，也不产生水平位移。 */
    const weight=0.5+0.16*Math.sin(readyClock*READY_BOUNCE_RATE+Math.PI*.5);
    const lead=weight*2,trail=(1-weight)*2;
    o.knees[0].rotation.x+=readyPulse*READY_KNEE_FLEX*lead;
    o.knees[1].rotation.x+=readyPulse*READY_KNEE_FLEX*trail;
    o.ankles[0].rotation.x+=readyPulse*READY_ANKLE_FLEX*lead;
    o.ankles[1].rotation.x+=readyPulse*READY_ANKLE_FLEX*trail;
    /* 垫步时左右脚交替“脚跟—前掌”换重心：一个脚尖轻抬，另一个脚尖轻压。
       旋转整只 ankle group，踝袜、鞋底和鞋面会一起运动。 */
    const readyRoll=readyPulse*Math.sin(readyClock*READY_BOUNCE_RATE*.5)*READY_FOOT_ROLL;
    o.ankles[0].rotation.x-=readyRoll*(.65+.35*lead);
    o.ankles[1].rotation.x+=readyRoll*(.65+.35*trail);
    setFootRoll(o,0,-readyRoll*.32,Math.max(0,readyRoll)*.48);
    setFootRoll(o,1,readyRoll*.32,Math.max(0,-readyRoll)*.48);
    o.shoes[0].rotation.x=0;o.shoes[1].rotation.x=0;
    o.g.rotation.z=(weight-.5)*.018;
  }
  // 上身前倾:蓄力约10°(0.17rad),起跳回正并略后仰送球；腿根已做反向补偿，形成真屈髋。
  /* 接球前倾，随 lift 让位给蓄力/最高点的躯干角。
     -DIP_LEAN*load：蓄力也保持前倾（原来是 +，实际是后仰，和注释相反）。
     over/jmp/land 三项维持原样 —— 最高点的 -0.03*jmp 是 T台导入姿势的一部分，
     被 check.js 的球心断言锁着，不能动。 */
  o.g.rotation.x=-DIP_LEAN*load - 0.06*c.over - 0.03*c.jmp + 0.08*land;
  const footY=(poseFootBottomY(o.legs[0].rotation.x+torsoLean,o.knees[0].rotation.x,o.ankles[0].rotation.x,
    o.footRoots&&o.footRoots[0]&&o.footRoots[0].rotation.x,o.toeRoots&&o.toeRoots[0]&&o.toeRoots[0].rotation.x)+
    poseFootBottomY(o.legs[1].rotation.x+torsoLean,o.knees[1].rotation.x,o.ankles[1].rotation.x,
      o.footRoots&&o.footRoots[1]&&o.footRoots[1].rotation.x,o.toeRoots&&o.toeRoots[1]&&o.toeRoots[1].rotation.x))*.5;
  if(o.g){
    o.g.userData.readyAnklePitch=[o.ankles[0].rotation.x,o.ankles[1].rotation.x];
    o.g.userData.readyFootRoll=readyPulse?READY_FOOT_ROLL:0;
    o.g.userData.landFootPitch=land*LAND_FOOT_PITCH;
    o.g.userData.landingImpact=landingImpact==null?1:clamp(landingImpact,.42,1);
    o.g.userData.shotHipHinge=torsoLean;
    o.g.userData.shotHipFlex=[hipLead,hipTrail];
    o.g.userData.shotLowerBodyHingeComp=lowerBodyHingeComp;
    o.g.userData.shotReadyLowerBlend=loadBlend;
  }
  /* 待机呼吸:站定时人不该是一尊雕像。用 G.tNow 驱动,不需要额外状态。
     **只在完全没有投篮动作时生效**:蓄力/举球/起跳/跟随/落地任何一项一介入就退到 0。
     这条不是保守,是必须的 —— check.js 有几条断言把出手各阶段的球心位置锁到毫米级,
     呼吸一旦渗进那些帧,断言会直接红。 */
  const breath=(1-busy)&&Math.sin((typeof G!=="undefined"&&G.tNow?G.tNow:0)*BREATH_RATE)*BREATH_AMP*(1-busy);
  if(breath){
    sh.rotation.x-=breath*1.5;gd.rotation.x-=breath*1.5;   // 肩胸随呼吸起伏
  }
  return POSE_STAND_FOOT_Y-footY+readyPulse*READY_BOUNCE_AMP+breath;
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
/* 传球接近时恢复 T台导入前的接球路径；球到手后不再一帧切换，先用 0.28 秒
   从接球终点缓冲到旧版 ready/当前蓄力目标。右手目标必须与 incoming 末帧使用
   同一条兼容分支，否则第一人称会在接球瞬间出现一整圈掌面旋转。 */
function poseCatchHands(o,state,dt){
  if(!o||!o.arms||!o.elbows||!o.handRoots)return;
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  const shootHand=o.handRoots[0],guideHand=o.handRoots[1];
  const settling=!!(state&&state.settling);
  const tstageCatch=tstageCatchEndpoint();
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
    if(tstageCatch){
      setArmSegmentLength(o,0,mixN(tstageCatch.shooting.upperLength,.32,t),mixN(tstageCatch.shooting.lowerLength,.29,t));
      setArmSegmentLength(o,1,mixN(tstageCatch.guide.upperLength,.32,t),mixN(tstageCatch.guide.lowerLength,.29,t));
    }
    // 当前 node transform 是 applyShotSetPose 写好的持球帧；从迎球帧向它收敛。
    fromCatch(shoot,(tstageCatch&&tstageCatch.shooting||SHOT_CATCH_POSE.shooting).armQuat);
    fromCatch(shootEl,(tstageCatch&&tstageCatch.shooting||SHOT_CATCH_POSE.shooting).elbowQuat);
    fromCatch(guide,(tstageCatch&&tstageCatch.guide||SHOT_CATCH_POSE.guide).armQuat);
    fromCatch(guideEl,(tstageCatch&&tstageCatch.guide||SHOT_CATCH_POSE.guide).elbowQuat);
    [shootHand,guideHand].forEach(hand=>{
      if(!hand||!_catchTargetPos||!_catchStartPos)return;
      _catchTargetPos.copy(hand.position);
      _catchStartPos.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
      hand.position.copy(_catchStartPos).lerp(_catchTargetPos,t);
    });
    // 腕部一并从迎球掌面收回到持球握法(球已在手上，这一步就是"接住后调整握球")。
    // 右手用接触前预对齐的兼容目标，接球后只反向小幅收势；辅助手保留原 T台终点。
    const rightHandCatch=(tstageCatch&&catchCompatibleHandValues(tstageCatch.shooting))||
      catchCompatibleHandValues(SHOT_CATCH_POSE.shooting);
    fromCatch(shootHand,rightHandCatch||
      (tstageCatch&&tstageCatch.shooting||SHOT_CATCH_POSE.shooting).handQuat);
    fromCatch(guideHand,(tstageCatch&&tstageCatch.guide||SHOT_CATCH_POSE.guide).handQuat);
    (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,fingerIndex)=>{
      const targetX=fingerCurlValue(finger);
      setFingerTarget(o,handIndex,fingerIndex,
        mixN(handIndex===0?HAND_FINGER_REST-.16:HAND_FINGER_REST-.10,targetX,t),finger.rotation.z);
    }));
    if(state.settle>=1)state.active=false;
    if(o.g){
      o.g.userData.catchPosePhase=state.active?"settling":"ready";
      o.g.userData.catchRightHandTransition="short-counterclockwise";
    }
    return;
  }

  // 传球飞行段：从 poseGuy 给出的站姿逐步伸手迎球，终点就是迎球帧。
  const progress=clamp(state&&state.progress||0,0,1);
  const k=ease01(progress);
  /* T台片段内部负责姿势曲线，外层只负责从当前跑姿接入一次；
     传 raw progress，避免把缓动曲线套两层导致伸手太晚。 */
  const tstageCatchApplied=applyTstageCatchPose(o,progress,k);
  if(!tstageCatchApplied){
    blendNodeQuat(shoot,SHOT_CATCH_POSE.shooting.armQuat,k);
    blendNodeQuat(shootEl,SHOT_CATCH_POSE.shooting.elbowQuat,k);
    blendNodeQuat(guide,SHOT_CATCH_POSE.guide.armQuat,k);
    blendNodeQuat(guideEl,SHOT_CATCH_POSE.guide.elbowQuat,k);
  }
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
  if(!tstageCatchApplied){
    [shootHand,guideHand].forEach((hand,index)=>{
      if(!hand||!_readyHandPos)return;
      _readyHandPos.set(HAND_ROOT_BASE.x,HAND_ROOT_BASE.y,HAND_ROOT_BASE.z);
      hand.position.lerp(_readyHandPos,k);
      blendNodeQuat(hand,(index===0?SHOT_CATCH_POSE.shooting:SHOT_CATCH_POSE.guide).handQuat,k);
    });
    (o.fingerJoints||[]).forEach((fingers,handIndex)=>fingers.forEach((finger,index)=>{
      setFingerTarget(o,handIndex,index,
        handIndex===0?HAND_FINGER_REST-(.16*k):HAND_FINGER_REST-(.10*k),
        (handIndex===0?SHOOT_FINGER_SPLAY[index]:GUIDE_FINGER_SPLAY[index])*k);
    }));
    if(o.g)o.g.userData.catchPoseSource="legacy";
  }
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
    /* 走路统一走 poseRunCycle —— 它才是"全项目唯一的一套跑动姿势"。
       原来这里是另写的一条正弦(dt*9 写死步频、脚掌恒为 0、身体高度根本没设),
       所以主角走起来又飘又僵,而场上 NPC 反倒是对的。
       现在两边同源:改一次,主角和电脑一起变好。 */
    updWalkSpeed(dt);
    P.walkRig=P.walkRig||{phase:0,idleT:0,lean:0};
    poseHandJoints(player,shotCurves(0));
    poseRunCycle(player,P.walkRig,walkSpeed,dt,{sway:true});
    player.g.position.y+=P.jump;
    regroundRunPose(player);
  }else{
    /* 下次起步重新采样,免得走位被瞬间摆位时算出一个假的高速。 */
    walkPrevX=null;
    if(P.walkRig)P.walkRig.phase=0;
    player.g.rotation.z=0;          // 清掉步态的左右摆,否则站定还歪着
    player.g.position.y=poseGuy(player,c,lk,phys&&Number.isFinite(phys.landingImpact)?phys.landingImpact:1)+P.jump;
  }
  /* 投篮噪声放在所有 T台/游戏姿势之后，且只动辅助手链；phase 两端归零，
     所以不会改写用户调好的 ready / release 关键帧。 */
  if(!P.walking&&typeof applyShotPoseNoise==="function"){
    const tstagePhase=player.g&&Number.isFinite(Number(player.g.userData.tstageShotPhase))
      ?Number(player.g.userData.tstageShotPhase):null;
    const noisePhase=clamp(tstagePhase==null?c.lift:tstagePhase,0,1);
    if(noisePhase>0&&noisePhase<1)applyShotPoseNoise(player,noisePhase,G.shotPoseNoiseKey||0);
    else if(player.g)player.g.userData.shotPoseNoisePhase=noisePhase;
  }
  poseBallPos(pBall.position,c);
}

/* 主角的走路速度。poseRunCycle 的相位是按**位移**推进的,所以必须喂真实速度;
   喂错了脚就在地上滑。这里从 P.pos 的逐帧变化反推,不依赖是谁在驱动走位
   (walkTo 和首屏开场那套自定义走位都能覆盖)。 */
let walkPrevX=null,walkPrevZ=null,walkSpeed=0;
function updWalkSpeed(dt){
  if(walkPrevX==null){walkPrevX=P.pos.x;walkPrevZ=P.pos.z;return;}
  const d=Math.hypot(P.pos.x-walkPrevX,P.pos.z-walkPrevZ);
  walkPrevX=P.pos.x;walkPrevZ=P.pos.z;
  /* 一帧卡顿能算出十几 m/s,直接拿去驱动相位腿会抽一下。夹住再平滑。 */
  const inst=dt>0?Math.min(6,d/dt):0;
  walkSpeed+=(inst-walkSpeed)*Math.min(1,dt*8);
  return walkSpeed;
}
/* 走位结束/瞬间摆位后调用,下一帧重新采样,免得把瞬移算成高速。 */
function resetWalkSpeed(){walkPrevX=null;walkPrevZ=null;walkSpeed=0;}

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
function passCatchPointAt(pos,face){
  const d=V3(Math.sin(face),0,Math.cos(face));
  return V3(pos.x-d.x*.25,EYE+P.eyeDip+P.jump-.3,pos.z-d.z*.25);
}
let passing=null;
function startPass(targetPos,face){
  const s=curShot();if(!s||G.buzzed)return;
  const hasTarget=!!(targetPos&&typeof targetPos.clone==="function");
  const target=hasTarget?targetPos.clone():P.pos.clone();
  const targetFace=Number.isFinite(face)?face:P.face;
  passer.g.rotation.y=faceTo(passer.g.position,hasTarget?target:P.pos);
  passerBall.visible=false;
  const from=V3(passer.g.position.x,1.25,passer.g.position.z);
  const catchP=hasTarget?passCatchPointAt(target,targetFace):eyePos();
  if(!hasTarget)catchP.y-=0.3;
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
/* ---- 走位的速度剖面 ----
   原来位移走 smoothstep。它是对称的:加速多长、减速就多长,而且**峰值速度是平均的 1.5 倍**
   —— `dist/3.4` 的实际峰值到 5.1 m/s,那是冲刺不是走路,这就是"走得太快"的来源。

   改成梯形:起步加速 22% → 巡航 → 减速 38%。减速段明显更长,
   配合步幅随速度走(见 poseRunCycle),收尾自然变成小碎步再站定,
   而不是匀速滑到点急停。 */
const WALK_ACC=.22,WALK_DEC=.38,WALK_CRUISE=1.82;
const WALK_TURN_START=.40,WALK_TURN_END=.84,WALK_TURN_RATE=16;
function walkEase(k){
  const A=WALK_ACC,D=WALK_DEC,total=1-A/2-D/2;
  let s;
  if(k<A)s=k*k/(2*A);
  else if(k<1-D)s=A/2+(k-A);
  else{const t=(k-(1-D))/D;s=A/2+(1-D-A)+D*(t-t*t/2);}
  return clamp(s/total,0,1);
}
function walkTo(shot,cb,opts){
  const base=shotBase(shot);
  const from=P.pos.clone(),to=base.clone();
  /* 梯形剖面下平均速度 = WALK_CRUISE,峰值 = WALK_CRUISE/(1-A/2-D/2) ≈ 2.6 m/s。
     原来是峰值 5.1 m/s。 */
  /* 上限原来是 2.6s,长距离走位(比如底角到弧顶 9.4m)会被截断成 3.7 m/s ——
     巡航速度形同虚设。放宽到 3.4s。 */
  const dur=clamp(from.distanceTo(to)/WALK_CRUISE,0.55,3.4);
  const overlapPass=!!(opts&&opts.overlapPass);
  let passStartK=1;
  if(overlapPass){
    /* 让球的飞行时间正好填满最后一段走位:球员在收碎步/转身时迎球,
       不再是到点后先空等一拍再开始传球。短距离不足一段飞行时则立即起传。 */
    const passTarget=passCatchPointAt(to,faceTo(to,HOOP));
    const passFrom=V3(passer.g.position.x,1.25,passer.g.position.z);
    const passDur=passFlightSeconds(passFrom.distanceTo(passTarget));
    passStartK=clamp((dur-passDur+.03)/dur,0,.98);
  }
  P.walking=true;G.moving=true;P.walkT=0;
  walk={from,to,t:0,dur,fMove:faceTo(from,to),f1:faceTo(to,HOOP),cb,step:0,
    overlapPass,passStartK,passStarted:false,callbackCalled:false};
}
function updWalk(dt){
  if(!walk)return;
  walk.t+=dt;const k=Math.min(1,walk.t/walk.dur);
  /* 位移走 smoothstep,不是线性 —— 线性的话人是"匀速滑出去、到点急停",
     没有起步蹬地也没有收步。加减速之后步频也跟着变(poseRunCycle 的相位由
     实际位移驱动),所以一条缓动同时修好了"起步收步"和"腿频不跟脚"。 */
  P.pos.lerpVectors(walk.from,walk.to,walkEase(k));
  /* 朝向:转身从巡航末段就开始,并在减速碎步期间完成,避免到点后从静止慢慢转身。 */
  const turnK=clamp((k-WALK_TURN_START)/(WALK_TURN_END-WALK_TURN_START),0,1);
  let sweep=walk.f1-walk.fMove;while(sweep>Math.PI)sweep-=2*Math.PI;while(sweep<-Math.PI)sweep+=2*Math.PI;
  const tgt=walk.fMove+sweep*(turnK*turnK*(3-2*turnK));
  let d=tgt-P.face;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  P.face+=d*Math.min(1,dt*WALK_TURN_RATE);
  if(walk.overlapPass&&!walk.passStarted&&k>=walk.passStartK){
    walk.passStarted=true;walk.callbackCalled=true;
    const cb=walk.cb;
    if(cb)cb({phase:"approach",target:walk.to.clone(),face:walk.f1});
  }
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
    const cb=walk.cb,called=walk.callbackCalled;
    const info={phase:"arrived",target:walk.to.clone(),face:walk.f1};
    walk=null;if(!called&&cb)cb(info);
  }
}


globalThis.AIBASetShotAnimationMode=setShotAnimationMode;
globalThis.AIBAShotAnimation=Object.freeze({getMode:getShotAnimationMode,setMode:setShotAnimationMode,isTstage:isTstageShotAnimation,isReleaseFeet:isReleaseFeetShotAnimation});
window.AIBA.runtime.register("rendering:motion",Object.freeze({
  ease01,shotCurves,poseFootBottomY,runCadence,runLegAngles,runFootSpan,solveRunSwing,runFootPhase,runLegFromFoot,solveRunLegTarget,runFootGroundY,runLiftFootSole,poseRunCycle,regroundRunPose,poseRunFingers,poseHandJoints,setFingerChainPose,fingerCurlValue,poseThumbJoints,setFootRoll,resetFootRoll,poseShootingHandToBall,poseGuidePalmToBall,applyHandFollowThroughPose,captureShotPose,applyShotSetPose,applyActionTimingPose,applyShotPoseNoise,applyShotFollowThroughPose,applyTstageShotCyclePose,tstageShotCycleDuration,tstageShotLowerBody,applyReleaseFeetPose,tstageStaticPose,tstageDunkBallLocal,applyTstageDunkPose,getShotAnimationMode,setShotAnimationMode,isTstageShotAnimation,isReleaseFeetShotAnimation,poseGuy,poseBallPos,shotStanceBlend,tuneGuideHandPose,poseCatchHands,updPose,
  startPass,updPass,walkTo,updWalk,
  getState:()=>({poseK,landT,passing,walk})
}));
