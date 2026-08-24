/* ---------------- shot motion V2 (可完全回退) ----------------
   原版动作全部保留在 index.html 内联脚本中作为兜底；本模块在主脚本之后
   加载，通过覆盖全局函数提供 V2 动作，localStorage `aiba_motion_v2`=off
   或更衣室开关即可完整恢复原版（函数、球的挂点、第一人称手全部还原）。

   V2 内容：
   1) 球贴手：第三人称把球挂到投篮手腕掌心处，蓄力/举球/出手全程跟手。
   2) 第一人称共享骨架：原手模隐藏(可还原)，镜像第三人称球员的真实双臂、
      肘腕、手掌、手指与装备，同一帧姿势从任何镜头观看都一致。
   3) 顶点即落：接线 AIBAShotPhysics(v1.52 已实现但未接入)——蓄力过顶后
      人物按时间轴自然下落，落地前自动出手并按严重晚释放/短球惩罚。
   4) 实体篮板：飞行段做线段穿越检测，过力平射被篮板正面弹回(算投失)；
      蓄力接近拉满的超远失误会拉高弧线从篮板上方绕过去，永不穿板。 */
(function(global){
  "use strict";

  const LS_KEY="aiba_motion_v2";
  const clampN=(v,a,b)=>Math.max(a,Math.min(b,v));

  /* ---- 篮板实体参数(与内联 free 阶段碰撞常量一致) ---- */
  const BOARD_Z=-8.5,BOARD_HALF_W=0.98,BOARD_Y_MIN=2.9,BOARD_Y_MAX=4.1;
  const BOUNCE_K=0.42;          // 篮板反弹衰减
  const OVER_ERR=19;            // 过力超过该值 → 高弧绕过篮板上方
  const OVER_TOP={y:4.42,z:-9.05,maxX:1.5};

  let on=true;
  try{on=localStorage.getItem(LS_KEY)!=="off";}catch(e){}
  function save(){try{localStorage.setItem(LS_KEY,on?"on":"off");}catch(e){}}

  /* ================= 第一人称 V2：第三人称双臂的显示镜像 ================= */
  const FOLLOW_EXTEND=0.105,BALL_RELEASE_AT=0.092,FOLLOW_HOLD=0.24,FOLLOW_FADE=0.38;
  let fpRig=null,fpHidden=[],fpBallHome=null,followAge=0,followActive=false;
  let releasePose=null;
  let releaseCurve={dip:0,lift:1,rise:1,jmp:1,over:0},lastPoseCurve=releaseCurve,pendingRelease=null;
  const ease01=t=>{t=clampN(t,0,1);return t*t*(3-2*t);};
  const mixN=(a,b,k)=>a+(b-a)*k;
  /* 第一人称相机在眼睛后方 0.85,所以自己的肩和上臂会正对镜头。
     手臂垂着时那截圆角肩块就糊在画面底部,看着像"一只没有手腕没有手指的手"。
     真实第一人称视角里本来也看不到自己的肩膀,所以镜像手臂只保留肘部往下。
     注意:只隐藏 fp 镜像体的网格,第三人称的真实球员手臂不受影响。 */
  const FP_HIDDEN_PARTS=["shoulderBlend","upperArm"];
  /* 第一人称只该看到肘部以下。按网格名字点名隐藏(FP_HIDDEN_PARTS)不够用:
     护臂/长袖这类装备是**后加**到大臂上的匿名 Group,名字对不上,于是修好镜像同步之后
     它们就变成一块悬空浮在手边的板子,底下那截前臂还是光的(实测截图确认过)。
     改成按层级判断:凡是不在肘部子树里的网格,一律不在第一人称出现。
     找不到 handRig 时退回名字表,至少不比以前差。 */
  function underNode(node,root){
    for(let p=node;p;p=p.parent)if(p===root)return true;
    return false;
  }
  function mirrorArm(source,name){
    const clone=source.clone(true),sourceNodes=[],cloneNodes=[];
    clone.name=name;
    source.traverse(node=>sourceNodes.push(node));
    clone.traverse(node=>cloneNodes.push(node));
    // 肘 pivot = handRig 往上走到 clone 的直接子节点
    let elbowRoot=clone.getObjectByName("handRig");
    while(elbowRoot&&elbowRoot.parent&&elbowRoot.parent!==clone)elbowRoot=elbowRoot.parent;
    clone.traverse(node=>{
      node.frustumCulled=false;
      if(!node.isMesh)return;
      node.castShadow=false;node.receiveShadow=false;
      const hide=elbowRoot?!underNode(node,elbowRoot):(FP_HIDDEN_PARTS.indexOf(node.name)>=0);
      if(hide)node.userData.fpAlwaysHidden=true;
    });
    return {source,clone,pairs:sourceNodes.map((node,index)=>[node,cloneNodes[index]])};
  }
  function mountFpBall(){
    if(!fpRig||!fpRig.ballGrip||typeof handBall==="undefined")return;
    if(!fpBallHome)fpBallHome={parent:handBall.parent,pos:handBall.position.clone(),quat:handBall.quaternion.clone(),scale:handBall.scale.clone()};
    fpRig.ballGrip.add(handBall);
    handBall.position.set(0,0,0);handBall.rotation.set(0,0,0);handBall.scale.set(1,1,1);
  }
  function restoreFpBall(){
    if(!fpBallHome||typeof handBall==="undefined")return;
    fpBallHome.parent.add(handBall);
    handBall.position.copy(fpBallHome.pos);handBall.quaternion.copy(fpBallHome.quat);handBall.scale.copy(fpBallHome.scale);
  }
  /* 镜像是**建立那一刻的深拷贝**,pairs 也按当时的遍历顺序固定死了。
     装备(护臂/长袖/连帽衫)是之后才往 player.arms / player.elbows 里加子节点的,
     加进去的东西镜像里永远不会出现 —— 实测:穿上护臂后真实手臂 27 个节点、
     镜像还是 23 个,于是第三人称看得见衣袖、第一人称还是光胳膊。
     这里记一个结构指纹,每帧比一下,对不上就整体重建。
     指纹只数节点个数:装备的增删一定会改变节点数,而纯粹的姿态变化不会 ——
     刚好是"要不要重建"的判据,又不用每帧做深比较。 */
  function armNodeCount(root){let n=0;root.traverse(()=>n++);return n;}
  function armStructureSig(){
    if(!player||!player.arms||!player.arms[0]||!player.arms[1])return "";
    return armNodeCount(player.arms[0])+":"+armNodeCount(player.arms[1]);
  }
  function buildFpRig(){
    if(fpRig||typeof hands==="undefined"||typeof THREE==="undefined"||typeof player==="undefined"||!player.arms||!scene)return;
    // 原相机空间手模保留作经典动作兜底；新版只显示真实球员双臂的镜像。
    /* 只在第一次采集:重建时这些早就是 visible=false 了,再 filter 一次会得到空数组,
       经典手模就再也还原不回来。 */
    if(!fpHidden.length){
      fpHidden=hands.children.filter(c=>c!==handBall&&c.visible!==false);
      fpHidden.forEach(c=>{c.visible=false;});
    }
    const rig=new THREE.Group();rig.name="fpSharedPoseRig";rig.visible=false;
    const shoot=mirrorArm(player.arms[0],"fpShootingArm");
    const guide=mirrorArm(player.arms[1],"fpGuideArm");
    rig.add(shoot.clone,guide.clone);scene.add(rig);
    fpRig={g:rig,shoot,guide,ballGrip:shoot.clone.getObjectByName("ballGrip"),sig:armStructureSig()};
    mountFpBall();
  }
  /* 骨架结构变了就重建。几何体和材质都是和真实球员**共用引用**的
     (Object3D.clone 不复制它们),所以只能把组从场景里摘掉,绝不能 dispose,
     否则会把第三人称球员的网格一起弄坏。 */
  function rebuildFpRig(){
    if(!fpRig)return;
    const wasVisible=fpRig.g.visible;
    restoreFpBall();
    scene.remove(fpRig.g);
    fpRig=null;
    buildFpRig();
    if(fpRig)fpRig.g.visible=wasVisible;
  }
  function syncArmMirror(mirror){
    mirror.pairs.forEach(pair=>{
      const source=pair[0],clone=pair[1];
      clone.position.copy(source.position);clone.quaternion.copy(source.quaternion);clone.scale.copy(source.scale);
      // 每帧从真实球员同步可见性,但肩/上臂在第一人称永远不出现(见 FP_HIDDEN_PARTS)
      clone.visible=source.visible&&!clone.userData.fpAlwaysHidden;
      if(source.isMesh){clone.geometry=source.geometry;clone.material=source.material;}
    });
  }
  function syncFpRigFromPlayer(){
    if(!fpRig||!player||!player.g)return;
    if(fpRig.sig!==armStructureSig()){rebuildFpRig();if(!fpRig)return;}
    fpRig.g.position.copy(player.g.position);fpRig.g.quaternion.copy(player.g.quaternion);fpRig.g.scale.copy(player.g.scale);
    syncArmMirror(fpRig.shoot);syncArmMirror(fpRig.guide);
    // handBall 是第一人称显示副本；位置来自真实投篮手的 ballGrip，不再另写一套持球坐标。
    if(fpRig.ballGrip&&handBall.parent!==fpRig.ballGrip)mountFpBall();
    fpRig.g.updateMatrixWorld(true);
  }
  function setFpRigVisible(v){
    if(!fpRig)return;
    fpRig.g.visible=!!v;
    /* 这里的 on 是模块级总开关(第一人称新手臂启用与否),**不是**参数 v。
       只要新版启用着,相机空间那套经典手模就一直藏着;关掉总开关才放它回来。 */
    fpHidden.forEach(c=>{c.visible=!on;});
  }
  function beginFollow(){
    followAge=0;followActive=true;
  }
  function followState(dt){
    if(!followActive)return {active:false,extend:0,follow:0,recover:1,age:followAge};
    followAge+=Math.max(0,Math.min(.08,dt||0));
    const extend=ease01(followAge/FOLLOW_EXTEND);
    const recover=ease01((followAge-FOLLOW_EXTEND-FOLLOW_HOLD)/FOLLOW_FADE);
    const follow=extend*(1-recover);
    if(followAge>=FOLLOW_EXTEND+FOLLOW_HOLD+FOLLOW_FADE){
      followActive=false;
      return {active:false,extend:1,follow:0,recover:1,age:followAge};
    }
    return {active:true,extend,follow,recover,age:followAge};
  }
  function captureReleasePose(o){
    releasePose=typeof captureShotPose==="function"?captureShotPose(o):null;
  }
  function captureReleaseCurve(){
    releaseCurve={
      dip:lastPoseCurve.dip||0,lift:lastPoseCurve.lift||0,rise:lastPoseCurve.rise||0,
      jmp:lastPoseCurve.jmp||0,over:lastPoseCurve.over||0
    };
  }
  function visualReleaseCurve(c,state){
    if(!state||!state.active)return c;
    const hold=1-state.recover;
    return Object.assign({},c,{
      dip:mixN(c.dip||0,releaseCurve.dip,hold),
      lift:mixN(c.lift||0,releaseCurve.lift,hold),
      rise:mixN(c.rise||0,releaseCurve.rise,hold)
    });
  }
  function applyFollowThroughPose(o,state,poseOverride){
    if(!state||!state.active)return;
    const pose=poseOverride||releasePose;
    if(typeof applyShotFollowThroughPose==="function")applyShotFollowThroughPose(o,state,pose);
  }
  /* 热身/过场/表演赛期间镜头会被搬去弧顶等机位展示球员，但 CAM.mode 仍是 0，
     挂在相机上的第一人称骨架就会跟着停在半空——看起来是"两只空手悬在弧顶"。
     这些状态一律强制隐藏，不依赖各处记得去改 hands.visible。 */
  const FP_HIDDEN_STATES={pregame:1,aishow:1,cinematic:1,victorycine:1,menu:1,diff:1};
  function animFpRig(){
    if(!fpRig&&on)buildFpRig();
    if(!fpRig)return;
    syncFpRigFromPlayer();
    const cine=typeof G!=="undefined"&&!!FP_HIDDEN_STATES[G.state];
    setFpRigVisible(on&&typeof CAM!=="undefined"&&CAM.mode===0&&hands.visible&&!cine);
  }

  /* ================= 第三人称球贴手 ================= */
  let ballAttached=false,pBallHome=null;
  function attachBall(){
    if(ballAttached||typeof player==="undefined"||typeof pBall==="undefined")return;
    // 新骨架的 ballGrip 是唯一持球/物理出手锚点；禁止再用肘节点上的旧坐标兜底。
    const parent=player.ballGrips&&player.ballGrips[0];
    if(!parent)return;
    if(!pBallHome)pBallHome={parent:pBall.parent,pos:pBall.position.clone()};
    parent.add(pBall);
    pBall.position.set(0,0,0);
    ballAttached=true;
  }
  function detachBall(){
    if(!ballAttached||!pBallHome)return;
    pBallHome.parent.add(pBall);
    pBall.position.copy(pBallHome.pos);
    ballAttached=false;
  }

  /* ================= updPose V2：顶点即落 ================= */
  const origUpdPose=global.updPose;
  function updPoseV2(dt){
    const s=curShot();
    const ideal=s?weatherAdjustedIdeal(s,false):IDEAL;
    poseK=G.charging?G.power/ideal:Math.max(0,poseK-dt*4.5);
    const base=shotCurves(poseK);
    const tutorialHold=!!(global.AIBAInteractiveTutorial&&
      typeof global.AIBAInteractiveTutorial.isHoldingRelease==="function"&&
      global.AIBAInteractiveTutorial.isHoldingRelease());
    // v1.52 物理:顶点前沿用原曲线,顶点后接管自然下落;落地前自动出手
    const phys=AIBAShotPhysics.update({charging:G.charging,paused:tutorialHold,dt,ideal,rate:playerChargeRate(),curve:base});
    const rawCurve=phys.curve;
    if(G.charging)lastPoseCurve={dip:rawCurve.dip,lift:rawCurve.lift,rise:rawCurve.rise,jmp:rawCurve.jmp,over:rawCurve.over};
    if(phys.apexCue&&G.charging&&!G.apexed){
      G.apexed=true;
      if(navigator.vibrate)navigator.vibrate(12);
      blip(960,0.03,"square",0.045);
    }
    if(phys.autoRelease&&G.charging){doRelease();}
    if(phys.justLanded)landT=0.3;
    if(landT>0)landT-=dt;
    const lk=landT>0?Math.sin((0.3-landT)/0.3*Math.PI):0;
    const follow=followState(dt);
    const c=visualReleaseCurve(rawCurve,follow);
    // 接球屈髋：这条才是当前生效的 updPose，不写这里改了也看不见
    P.jump=phys.airborne?Math.max(0,rawCurve.jmp*0.55):Math.max(-0.06,rawCurve.jmp*0.55-rawCurve.over*0.28);
    P.eyeDip=-0.26*c.dip-0.09*lk;
    const stance=shotStanceBlend(c,G.canShoot||G.charging);
    // 第三人称
    player.g.position.set(P.pos.x,0,P.pos.z);
    player.g.rotation.y=P.face+(P.walking?0:SHOT_STANCE_YAW*stance);
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
      if(typeof poseHandJoints==="function")poseHandJoints(player,shotCurves(0));
    }else{
      player.g.position.y=poseGuy(player,c,lk)+P.jump;
      const catchState=G.passCatch;
      /* 出手跟随要 0.725 秒，而 Rack Rush 后几关出手 60ms 后就开始传球，两者必然重叠。
         这里必须叠加而不是二选一：先让跟随继续写它的收手姿势，poseCatchHands 再用
         blendNodeQuat 从"本帧已有姿势"往迎球帧插值(progress 小的时候 k≈0)。
         二选一会把跟随姿势整个丢掉，手从静止姿势直接弹去接球，就是"还没收回手就去接了"。 */
      if(follow.active)applyFollowThroughPose(player,follow);
      // 飞行阶段迎球；到手后由同一控制器短暂缓冲到持球帧，禁止一帧换骨架。
      if(catchState&&catchState.active)poseCatchHands(player,catchState,dt);
    }
    // 球挂在投篮手 handRig 上，伸肘与压腕期间连续随手，真正 release 后才隐藏/脱离。
    if(!ballAttached)poseBallPos(pBall.position,c);
    // 先完成真实球员姿势，再把同一组肩肘腕与手指结果镜像给第一人称。
    animFpRig();
    if(pendingRelease&&followAge>=BALL_RELEASE_AT)completePendingRelease();
  }

  /* ================= releaseShot V2：晚释放惩罚 + 高弧过板 ================= */
  const chainedReleaseShot=global.releaseShot; // 可能已被 gear.js 包装,保持链
  function completePendingRelease(){
    if(!pendingRelease)return false;
    const p=pendingRelease;pendingRelease=null;
    if(player&&player.g)player.g.updateMatrixWorld(true);
    if(typeof hands!=="undefined"&&hands)hands.updateMatrixWorld(true);
    const r=chainedReleaseShot.call(p.ctx,p.power,p.shot);
    // 蓄力接近拉满的超远过力:抬高弧线从篮板上方绕过去(落到板后,正常算投失)
    const b=(typeof balls!=="undefined")&&balls[balls.length-1];
    if(b&&!b.opp&&!b.silent&&b.outcome==="miss"&&(G.lastErr||0)>=OVER_ERR){
      const xT=clampN(b.p0.x+b.v0.x*b.tf,-OVER_TOP.maxX,OVER_TOP.maxX);
      b.v0.set((xT-b.p0.x)/b.tf,(OVER_TOP.y-b.p0.y)/b.tf+4.9*b.tf,(OVER_TOP.z-b.p0.z)/b.tf);
    }
    return r;
  }
  function releaseShotV2(power,shot){
    if(!on)return chainedReleaseShot.apply(this,arguments);
    if(pendingRelease)return false;
    captureReleasePose(player);
    captureReleaseCurve();
    beginFollow();
    const ideal=weatherAdjustedIdeal(shot,true);
    /* 必须在 releasePower 扣力度之前把 late 记下来。扣完之后的 power 拿去算的
       err 符号已经不可信了(晚出手也可能被扣成 err<0，看着像蓄力不够)，
       下游(绝杀模式失手诊断)要靠这个原始信号才能分清"没蓄够"和"蓄太久"。 */
    G.lastReleaseLate=AIBAShotPhysics.lastLate?AIBAShotPhysics.lastLate():0;
    const adj=AIBAShotPhysics.releasePower(power,ideal); // 下落中出手→明显偏短
    pendingRelease={ctx:this,power:adj,shot};
    G.canShoot=false;
    return true;
  }

  /* ================= updBalls V2：实体篮板(线段穿越) ================= */
  const origUpdBalls=global.updBalls;
  function boardHit(px,py,pz,qx,qy,qz){
    // 从篮板前方(-z 方向)穿越正面平面,且穿越点落在板面矩形内
    if(!(pz>BOARD_Z&&qz<=BOARD_Z))return null;
    const k=(pz-BOARD_Z)/Math.max(1e-6,pz-qz);
    const hx=px+(qx-px)*k,hy=py+(qy-py)*k;
    if(Math.abs(hx)>BOARD_HALF_W||hy<BOARD_Y_MIN||hy>BOARD_Y_MAX)return null;
    return {x:hx,y:hy};
  }
  function updBallsV2(dt){
    if(!on){origUpdBalls(dt);return;}
    const prev=[];
    for(const b of balls){
      if((b.phase==="fly"||b.phase==="free"||b.phase==="fall")&&b.mesh.position.z>-9.4)
        prev.push([b,b.mesh.position.x,b.mesh.position.y,b.mesh.position.z]);
    }
    origUpdBalls(dt);
    for(const [b,px,py,pz] of prev){
      if(!balls.includes(b))continue;
      const p=b.mesh.position;
      const hit=(b.phase==="fly"||b.phase==="free"||b.phase==="fall")&&boardHit(px,py,pz,p.x,p.y,p.z);
      if(!hit)continue;
      if(b.phase==="fly"){
        // 飞行段撞板:结算为投失并从板面弹回
        const t=Math.min(b.t,b.tf);
        const vy=b.v0.y-9.8*t;
        b.phase="free";
        b.vel.set(b.v0.x*0.4,vy*0.5,Math.abs(b.v0.z)*BOUNCE_K);
        if(b.opp)triggerStreetCrowdReaction("oppMiss",0);
        else if(!b.silent){missBall();toast("🧱 篮板拒绝!","#ff8d7a");}
      }else{
        b.vel.z=Math.abs(b.vel.z)*BOUNCE_K;
        b.vel.x*=0.8;
      }
      p.set(hit.x,hit.y,BOARD_Z+0.02);
      if(typeof playerRimHaptic==="function")playerRimHaptic(b);
      sBoard();
    }
  }

  /* ================= 开关 / 兜底恢复 ================= */
  function installMotionHooks(){
    global.updPose=updPoseV2;
    global.releaseShot=releaseShotV2;
    global.updBalls=updBallsV2;
  }
  function restoreLegacyMotion(){
    if(pendingRelease)completePendingRelease();
    setFpRigVisible(false);
    restoreFpBall();
    detachBall();
    global.updPose=origUpdPose;
    global.releaseShot=chainedReleaseShot;
    global.updBalls=origUpdBalls;
    if(global.AIBAShotPhysics)AIBAShotPhysics.reset();
    followAge=0;followActive=false;pendingRelease=null;
  }
  function apply(){
    if(on){
      buildFpRig();mountFpBall();setFpRigVisible(typeof CAM!=="undefined"&&CAM.mode===0&&hands.visible);attachBall();
      installMotionHooks();
    }else restoreLegacyMotion();
  }
  function setEnabled(v){
    on=!!v;save();apply();
    if(typeof global.toast==="function")global.toast(on?"已启用新版投篮动作":"已恢复经典投篮动作(兜底)",on?"#7CFC6B":"#ffd23f");
  }
  function toggleMarkup(){
    return `<div class="motionToggle"><span><small>SHOT MOTION</small><b>投篮动作引擎</b><em>新版:球贴手+手腕出手+顶点即落+实体篮板;出问题可随时切回经典兜底。</em></span>
      <button type="button" onclick="AIBAMotionToggle()">${on?"V2 新版 · 点击切回经典":"经典兜底 · 点击启用新版"}</button></div>`;
  }
  function toggle(){
    setEnabled(!on);
    const el=document.querySelector(".motionToggle");
    if(el)el.outerHTML=toggleMarkup();
  }

  global.AIBAMotionToggle=toggle;
  global.AIBAShotMotion=Object.freeze({
    applyFollowThroughPose,
    // 姿势在 updPose 之后被改写时(例如绝杀庆祝)，用它把第一人称镜像重新对齐
    syncFp(){if(fpRig)syncFpRigFromPlayer();},
    captureShotPose:o=>typeof captureShotPose==="function"?captureShotPose(o):null
  });
  global.AIBAMotion={
    enabled:()=>on,
    setEnabled,toggleMarkup,restoreLegacy:restoreLegacyMotion,
    stats:()=>({on,ballAttached,fpRig:!!fpRig,followAge:+followAge.toFixed(2),followActive,pendingRelease:!!pendingRelease})
  };
  apply();
})(window);
