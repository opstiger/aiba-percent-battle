/* ---------------- 每日挑战 · 绝杀时刻 | 5v5 演员池 ----------------
   现有场上只有 passer/oppPasser/rivals 三类背景角色,不足以撑起 5v5。
   这里按需(首次进入模式时)创建 9 个方块球员:4 名队友 + 5 名防守人,你是第 10 人。
   全部走 bakeActorSegments 烘焙——他们配色固定、永不换装,烘焙后每人只剩十几个 draw call。 */
(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  const chars=runtime&&runtime.service("rendering:characters");
  const motion=runtime&&runtime.service("rendering:motion");
  if(!runtime||!ctx||!chars||!motion)throw new Error("Last Shot squad requires runtime, characters and motion services");
  const {scene,V3,clamp,faceTo,HOOP}=ctx;
  const {poseFootBottomY}=motion;

  const ALLY_IDS=["ally0","ally1","ally2","ally3"];
  const FOE_IDS=["foe0","foe1","foe2","foe3","foe4"];
  const IDS=ALLY_IDS.concat(FOE_IDS);
  const STAND_FOOT_Y=poseFootBottomY(0,0,0);
  const BALL_R=0.16;
  /* headRoot 的原点在球员局部 y≈0.203(脚踝高度)，头网格却挂在它局部 y=1.62，
     所以直接写 headRoot.rotation 会让头沿 1.39m 半径公转——实测抬头 .58rad
     头就飘出 0.797m，看着就是"头离开身体"。characters.js 的 VOXEL_HEAD_PIVOT_Y
     本来就是脖子高度，这里旋转后重算 position，把旋转中心搬回脖子。 */
  const HEAD_PIVOT_Y=1.45;
  const _headOffset=new THREE.Vector3();
  function pivotHead(guy){
    const h=guy&&guy.headRoot;if(!h)return;
    if(h.userData.pivotBaseY==null)h.userData.pivotBaseY=h.position.y;
    _headOffset.set(0,h.userData.pivotBaseY-HEAD_PIVOT_Y,0).applyQuaternion(h.quaternion);
    h.position.set(_headOffset.x,HEAD_PIVOT_Y+_headOffset.y,_headOffset.z);
  }
  /* 持球核心要真的运球：球固定抱在胸前、球员却在跑，是最扎眼的穿帮。
     球在体侧上下弹，运球手跟着球起落压腕。 */
  function poseDribble(actor,dt,run){
    const ball=actor.ball;if(!ball||!ball.visible)return;
    const guy=actor.guy;
    /* 变向就换手：把这一帧的位移投到身体左右轴上，带死区避免直线跑时左右抖。
       arms[0] 建在 -X 侧(角色右手)，所以球必须跟着运球手同侧——原来球固定在 +X
       却用 arms[0] 去拍，手和球分在身体两边。 */
    const lastX=actor.dribbleLastX,lastZ=actor.dribbleLastZ;
    actor.dribbleLastX=actor.pos.x;actor.dribbleLastZ=actor.pos.z;
    if(lastX!=null){
      const vx=actor.pos.x-lastX,vz=actor.pos.z-lastZ;
      const right=Math.cos(actor.face)*vx-Math.sin(actor.face)*vz;
      if(right>.004)actor.dribbleHand=0;
      else if(right<-.004)actor.dribbleHand=1;
    }
    const hand=actor.dribbleHand||0,side=hand===0?-1:1;
    actor.dribbleT=(actor.dribbleT||0)+dt*(6.4+run*3.4);
    const bounce=Math.abs(Math.sin(actor.dribbleT));
    ball.position.set(side*0.32,BALL_R+(0.86-BALL_R)*bounce,0.26+run*0.12);
    guy.arms[hand].rotation.x=-0.16-0.46*(1-bounce);
    guy.arms[hand].rotation.z=side*0.28;
    guy.elbows[hand].rotation.x=-0.62+0.34*bounce;
  }
  const REACTION_ALLY_MADE=["raise","point","rush","push","hug","crash","retrieve"];
  const REACTION_FOE_MADE=["fall","head","invalid","kneel","freeze"];
  const REACTION_ALLY_MISS=["sad","head","slow","retrieve"];
  const REACTION_FOE_MISS=["raise","point","rush"];
  /* 每种反应各自的注视对象与移动目标。球落定之后视线就该散开——冲上来的看你、
     捡球的看球、懊恼的低头看地，而不是十个人继续锁死篮筐。
     带 move 的必须走 poseRunner，否则就是"没有走路动作自己飘过来"。 */
  const REACTION_META=Object.freeze({
    raise:{gaze:"player"},
    point:{gaze:"player"},
    rush:{gaze:"player",move:"player",speed:2.9},
    push:{gaze:"player",move:"player",speed:2.6},
    hug:{gaze:"player",move:"player",speed:2.8},
    crash:{gaze:"player",move:"player",speed:4.2},
    retrieve:{gaze:"ball",move:"rim",speed:2.6},
    fall:{gaze:"ground"},
    head:{gaze:"ground"},
    kneel:{gaze:"ground"},
    sad:{gaze:"ground"},
    slow:{gaze:"ground"},
    invalid:{gaze:"hoop"},
    freeze:{gaze:"player"}
  });

  let squad=null;

  function build(cfg){
    if(squad)return squad;
    const actors={};
    IDS.forEach(id=>{
      const ally=id.indexOf("ally")===0;
      const guy=chars.voxelGuy();
      guy.g.visible=false;scene.add(guy.g);
      const skin=ally?cfg.team.ally:cfg.team.foe;
      // 持球核心穿主色,和其他队友区分开,方便你一眼找到球在谁手上。
      const jersey=(id==="ally0"&&cfg.star)?cfg.star.jersey:skin.jersey;
      const shorts=(id==="ally0"&&cfg.star)?cfg.star.shorts:skin.shorts;
      chars.randomizeOutfit(guy);
      chars.dressGuy(guy,jersey,shorts,"");
      const ball=new THREE.Mesh(ctx.ballGeo,ctx.matBall);
      ball.position.set(0,1.12,0.32);ball.visible=false;guy.g.add(ball);
      /* 身高差：控卫最矮、中锋最高，攻防对位之间也不一样高。
         hs 会参与所有触地计算(footY / 头高 / 起跳)，否则高个会陷进地板。 */
      const hs=(cfg.choreography[id]&&cfg.choreography[id].height)||1;
      guy.g.scale.setScalar(hs);
      /* 场上十个人不可能动作一模一样。即使抽到同一个反应，幅度/频率/惯用手/
         举手高度也各不相同，这样一眼看过去才像十个人而不是十个复制体。 */
      const style={
        amp:.78+Math.random()*.45,
        rate:.82+Math.random()*.42,
        lift:-2.72-Math.random()*.30,        // 举手高度，全部落在接近垂直的区间
        swing:.38+Math.random()*.26,         // 左右挥动 22°–37°
        hand:Math.random()<.5?0:1,
        both:Math.random()<.45,              // 有人举双手，有人只举一只
        bias:(Math.random()-.5)*.22,
        pace:.86+Math.random()*.30   // 个体跑动快慢，避免所有人像剧本一样同速
      };
      actors[id]={id,guy,ball,ally,hs,style,phase:Math.random()*6.28,pos:V3(0,0,0),face:0,lean:0,
        reaction:null,reactionT:0,startPos:V3(0,0,0)};
    });
    squad={actors,cfg,baked:false,post:null};
    return squad;
  }

  /* 烘焙要等换装完成之后再做,否则装备件会被合并掉。放在首次显示前一次性执行。 */
  function bakeOnce(){
    if(!squad||squad.baked)return;
    IDS.forEach(id=>chars.bakeActorSegments(squad.actors[id].guy));
    squad.baked=true;
  }

  /* ---------------- 防守模型 ----------------
     不再让防守人跟着手写路点和进攻人同频同步——那看起来是两个人绑在一根杆子上。
     改成有延迟、有速度上限的追踪(Reynolds arrive)，参数取自公开的篮球实测区间：
       · 反应延迟 0.22s —— 防守人看到的是进攻人 0.22 秒前的位置
         (横向第一步在进攻方给出线索后 0.2–0.3s 才启动)
       · 贴防最大速度 4.5m/s，低于持球突破的 4.95m/s 峰值 —— 所以 crossover 一定能
         拉开身位，实测甩开约 1.2m，与"crossover 制造约 5 feet 分离"吻合
       · 扑防(closeout) 5.6m/s：4–6m 距离用 0.8–1.0s 冲到位
     结果是防守人被变向甩开、再加速追回，而不是永远贴在 1.05m。 */
  /* DEF_ACCEL 是这里最关键的一个数：给到 15m/s² 时防守人 0.3 秒就能拉满速，
     惯性等于不存在，0.22s 的感知延迟会被瞬间补掉，看起来仍然是同频同步。
     取 7.5m/s²(真实横移变向量级) 之后，crossover 时防守人会因为惯性冲过头、
     必须减速反向，身位才真正被拉开。 */
  const DEF_REACTION=.22,DEF_MARK_SPEED=4.0,DEF_CLOSEOUT_SPEED=4.6,DEF_ACCEL=7.5,
    DEF_MARK_GAP=1.15,DEF_ARRIVE=.18,TRAIL_SECONDS=1.2;
  function recordTrail(actor,t){
    const tr=actor.trail||(actor.trail=[]);
    tr.push({t,x:actor.pos.x,z:actor.pos.z});
    while(tr.length>2&&t-tr[0].t>TRAIL_SECONDS)tr.shift();
  }
  function trailAt(actor,t){
    const tr=actor.trail;
    if(!tr||!tr.length)return{x:actor.pos.x,z:actor.pos.z};
    if(t<=tr[0].t)return{x:tr[0].x,z:tr[0].z};
    for(let i=tr.length-1;i>=0;i--){
      if(tr[i].t<=t){
        const a=tr[i],b=tr[Math.min(tr.length-1,i+1)];
        const span=Math.max(1e-4,b.t-a.t),k=clamp((t-a.t)/span,0,1);
        return{x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k};
      }
    }
    return{x:tr[0].x,z:tr[0].z};
  }
  /* arrive steering：朝目标加速，接近时按 time-to-target 减速，避免到位后左右抖。
     返回本帧实际速度，供 poseRunner 决定腿的摆幅。 */
  function steerTo(actor,tx,tz,dt,maxSpeed,accel){
    const ox=tx-actor.pos.x,oz=tz-actor.pos.z,dist=Math.hypot(ox,oz);
    const want=dist>1e-3?Math.min(maxSpeed||DEF_MARK_SPEED,dist/DEF_ARRIVE):0;
    const wx=dist>1e-3?ox/dist*want:0,wz=dist>1e-3?oz/dist*want:0;
    actor.vx=actor.vx||0;actor.vz=actor.vz||0;
    let dvx=wx-actor.vx,dvz=wz-actor.vz;
    const dv=Math.hypot(dvx,dvz),cap=(accel||DEF_ACCEL)*dt;
    if(dv>cap){dvx=dvx/dv*cap;dvz=dvz/dv*cap;}
    actor.vx+=dvx;actor.vz+=dvz;
    actor.pos.x+=actor.vx*dt;actor.pos.z+=actor.vz*dt;
    return Math.hypot(actor.vx,actor.vz);
  }
  // 防守站位：卡在被盯人与篮筐之间 gap 处（用延迟位置，所以变向时会被甩开）
  function markTarget(markPos,gap){
    const dx=HOOP.x-markPos.x,dz=HOOP.z-markPos.z,d=Math.hypot(dx,dz)||1;
    const g=gap||DEF_MARK_GAP;
    return{x:markPos.x+dx/d*g,z:markPos.z+dz/d*g};
  }
  function samplePath(path,t){
    if(!path||!path.length)return null;
    if(t<=path[0].t)return path[0].p;
    for(let i=1;i<path.length;i++){
      if(t<=path[i].t){
        const a=path[i-1],b=path[i],span=Math.max(1e-4,b.t-a.t);
        const k=clamp((t-a.t)/span,0,1);
        // smoothstep:起步和到位都不突兀,避免路点之间出现机械折线
        const e=k*k*(3-2*k);
        return V3(a.p.x+(b.p.x-a.p.x)*e,0,a.p.z+(b.p.z-a.p.z)*e);
      }
    }
    return path[path.length-1].p;
  }

  /* 跑动姿势:大腿摆动 + 小腿折叠 + 手臂反向摆动。速度为 0 时退化成微幅呼吸待机。 */
  /* 跑动姿势统一走 motion.js 的 poseRunCycle——全项目只有那一套实现。
     这里只负责把 actor 的状态喂进去，再补一个转向。 */
  function poseRunner(actor,speed,dt,lookAt){
    motion.poseRunCycle(actor.guy,actor,speed,dt,{defensive:actor.defensive,hs:actor.hs||1});
    if(lookAt){
      const want=faceTo(actor.guy.g.position,lookAt);
      actor.face+=angleDelta(actor.face,want)*Math.min(1,dt*7);
      actor.guy.g.rotation.y=actor.face;
    }
  }
  function angleDelta(from,to){
    let d=to-from;while(d>Math.PI)d-=6.283185307;while(d<-Math.PI)d+=6.283185307;return d;
  }
  function headTrack(actor,target,dt){
    const guy=actor.guy;if(!guy.headRoot||!target)return;
    const headY=guy.g.position.y+1.62*(actor.hs||1),dx=target.x-actor.pos.x,dz=target.z-actor.pos.z;
    const want=faceTo(actor.pos,target),localYaw=clamp(angleDelta(actor.face,want),-.72,.72);
    const pitch=Math.atan2(target.y-headY,Math.max(.001,Math.hypot(dx,dz)));
    guy.headRoot.rotation.y+=(localYaw-guy.headRoot.rotation.y)*Math.min(1,dt*8);
    guy.headRoot.rotation.x+=(clamp(-pitch,-.58,.26)-guy.headRoot.rotation.x)*Math.min(1,dt*8);
    guy.headRoot.rotation.z*=Math.max(0,1-dt*8);
  }
  /* 出手后的观察姿势。faceTarget 决定身体转向、target 决定视线;
     两者都为 null 时保持当前朝向、头平滑回正——球已经落定又还没开始庆祝的空档,
     不该继续盯着篮筐或地上的球。 */
  function poseWatcher(actor,dt,target,faceTarget){
    const guy=actor.guy;
    if(faceTarget){
      const want=faceTo(actor.pos,faceTarget);
      actor.face+=angleDelta(actor.face,want)*Math.min(1,dt*4.5);
    }
    actor.phase+=dt*2.6;
    const breath=Math.sin(actor.phase)*.025;
    guy.g.rotation.y=actor.face;guy.g.rotation.x=breath*.3;guy.g.rotation.z=0;
    guy.legs[0].rotation.x=0;guy.legs[1].rotation.x=0;
    guy.knees[0].rotation.x=.12;guy.knees[1].rotation.x=.12;
    guy.ankles[0].rotation.x=-.08;guy.ankles[1].rotation.x=-.08;
    guy.shoes[0].rotation.x=0;guy.shoes[1].rotation.x=0;
    guy.arms[0].rotation.x=-.42+breath;guy.arms[1].rotation.x=-.42-breath;
    guy.arms[0].rotation.z=-.08;guy.arms[1].rotation.z=.08;
    guy.elbows[0].rotation.x=-.42;guy.elbows[1].rotation.x=-.42;
    guy.g.position.y=STAND_FOOT_Y-poseFootBottomY(0,.12,-.1)*(actor.hs||1);
    if(target)headTrack(actor,target,dt);
    else if(guy.headRoot){
      const k=Math.min(1,dt*6);
      guy.headRoot.rotation.x*=1-k;guy.headRoot.rotation.y*=1-k;guy.headRoot.rotation.z*=1-k;
    }
  }
  function moveActor(actor,target,dt,speed){
    if(!target)return;
    const dx=target.x-actor.pos.x,dz=target.z-actor.pos.z,d=Math.hypot(dx,dz);
    if(d>.04){const k=Math.min(1,(speed||2.2)*dt/d);actor.pos.x+=dx*k;actor.pos.z+=dz*k;}
    actor.guy.g.position.x=actor.pos.x;actor.guy.g.position.z=actor.pos.z;
  }
  /* 冲过来庆祝的落点。原来所有人共用 playerPos±0.22 这一个点，十个人叠在同一格里，
     第一人称直接穿进别人的身体——罚球失败后对方庆祝时最明显，因为大家本来就贴着
     三秒区站，冲两步就全糊在你脸上。
     改成：每个人沿"自己来的那个方向"停在你身周一圈，再按编号错开角度和半径。 */
  const MOB_RADIUS=1.34;
  function mobTarget(actor,p){
    const from=actor.startPos||actor.pos;
    let ang=Math.atan2(from.x-p.x,from.z-p.z);
    if(!isFinite(ang))ang=0;
    /* 扇形间隔必须大于 separate() 的 MIN_GAP 对应的弧长(1.34m 半径下约 0.73rad)，
       否则几个人挤在同一段弧上互相推，最后全被顶到两米开外，根本挤不到你身边。 */
    if(actor.mobSlot!=null)ang+=(actor.mobSlot-((actor.mobCount||1)-1)/2)*.76;
    const r=MOB_RADIUS+(actor.mobSlot!=null?(actor.mobSlot%2)*.36:0);
    return V3(p.x+Math.sin(ang)*r,0,p.z+Math.cos(ang)*r);
  }
  function poseReaction(actor,dt,ballTarget,playerPos){
    const guy=actor.guy,action=actor.reaction||"freeze";
    actor.reactionT+=dt;
    const t=actor.reactionT,s=Math.sin(t*7),pulse=Math.max(0,Math.sin(t*6));
    const meta=REACTION_META[action]||REACTION_META.freeze;
    const playerTarget=playerPos?mobTarget(actor,playerPos):null;
    /* 视线各看各的:冲过来的看你,捡球的看球,懊恼的低头看地——不再全场统一盯篮筐。 */
    let gaze=null;
    if(meta.gaze==="player")gaze=playerPos||null;
    else if(meta.gaze==="ball")gaze=ballTarget||null;
    else if(meta.gaze==="hoop")gaze=HOOP;
    else if(meta.gaze==="ground")gaze=V3(actor.pos.x+Math.sin(actor.face)*1.1,0,actor.pos.z+Math.cos(actor.face)*1.1);
    /* 两个抢球的人原来共用篮下同一个点，于是他们会一直顶在一起(实测中心距被
       separate 卡在 0.98m，可两人都在前伸手臂抢球，手臂直接穿过对方身体)。
       按 rimSlot 左右分开站，各抢一边。 */
    const rimSpot=meta.move==="rim"
      ?V3(HOOP.x+(actor.rimSlot===1?.78:actor.rimSlot===0?-.78:0),0,HOOP.z+.85+(actor.rimSlot===1?.35:0))
      :null;
    const moveTarget=meta.move==="player"?playerTarget:rimSpot;
    if(moveTarget){
      /* 有位移就必须有腿。原来这里只改 pos 再摆站立姿势,人是"飘"过去的。
         先按实际位移速度跑起来,再让下面的反应动作覆盖上半身。 */
      const fromX=actor.pos.x,fromZ=actor.pos.z;
      moveActor(actor,moveTarget,dt,(meta.speed||2.25)*pace(actor)*(actor.reactionPace||1));
      const moved=Math.hypot(actor.pos.x-fromX,actor.pos.z-fromZ)/Math.max(1e-3,dt);
      poseRunner(actor,moved,dt,gaze||moveTarget);
      if(gaze)headTrack(actor,gaze,dt);
    }else{
      poseWatcher(actor,dt,gaze,gaze);
    }
    const st=actor.style||{amp:1,rate:1,lift:-2.85,swing:.5,hand:0,both:false,bias:0};
    const wv=Math.sin(t*6.2*st.rate+actor.phase);
    const hand=st.hand,other=1-hand,sgn=hand===0?-1:1;
    if(action==="raise"){
      /* 举手必须接近垂直，靠 rotation.z 做 ±30° 左右挥动。
         绝不能用"斜前方伸直"那种抬法。 */
      /* 挥动中心必须外偏(ARM_OUT)，否则内摆会把手扫进头里——实测掌心一度只离
         头心 0.118m。肘也不能绷直(原来只弯 11°–20°，整条手臂像根棍子)，
         保持 30°–50° 的自然弯曲，小臂才有正常倾斜。 */
      guy.arms[hand].rotation.x=st.lift+.10*wv;
      guy.arms[hand].rotation.z=swingZ(sgn,ARM_OUT+sgn*st.bias,wv*st.swing*.8);
      guy.elbows[hand].rotation.x=-.58-.26*Math.abs(wv);
      if(st.both){
        const w2=Math.sin(t*6.2*st.rate+actor.phase+2.4);
        guy.arms[other].rotation.x=st.lift+.10*w2;
        guy.arms[other].rotation.z=swingZ(-sgn,ARM_OUT-sgn*st.bias,w2*st.swing*.8);
        guy.elbows[other].rotation.x=-.58-.26*Math.abs(w2);
      }else{
        guy.arms[other].rotation.x=-.34;guy.arms[other].rotation.z=-sgn*.16;
        guy.elbows[other].rotation.x=-.72;
      }
      guy.g.position.y+=pulse*.12*st.amp;
    }else if(action==="point"){
      // 握拳下拉(fist pump)：肘大幅弯曲，手臂始终在体侧，天然避开敏感区间
      guy.arms[hand].rotation.x=-.88+.34*wv*st.amp;
      guy.arms[hand].rotation.z=sgn*(.30+st.bias);
      guy.elbows[hand].rotation.x=-1.78+.42*wv;
      guy.arms[other].rotation.x=-.30;guy.arms[other].rotation.z=-sgn*.20;
      guy.elbows[other].rotation.x=-.86;
      guy.g.position.y+=pulse*.06*st.amp;
    }else if(action==="rush"||action==="push"||action==="crash"){
      /* 跑动中绝不能把双臂写死——两只手都抬到胸前内收就是"双手交叉像叉车冲过来"。
         一只手随步频挥舞(相位用 actor.phase 错开，每个人不一样)，另一只手保留
         poseRunner 刚写好的自然摆臂，只在 crash 这种最激动的反应里才两只手都甩。 */
      /* 边跑边挥手：摆动必须留在垂直附近，绝不能扫过"斜前方伸直"。
         每个人的幅度/频率/惯用手都不同，不会十个人整齐划一。 */
      const wave=Math.sin(t*7.5*st.rate+actor.phase);
      guy.arms[hand].rotation.x=st.lift+.20*wave;
      guy.arms[hand].rotation.z=swingZ(sgn,ARM_OUT+sgn*st.bias,wave*st.swing*st.amp*.8);
      guy.elbows[hand].rotation.x=-.62-.24*Math.abs(wave);
      if(action==="crash"){
        const wave2=Math.sin(t*7.5*st.rate+actor.phase+2.1);
        guy.arms[other].rotation.x=st.lift+.20*wave2;
        guy.arms[other].rotation.z=swingZ(-sgn,ARM_OUT-sgn*st.bias,wave2*st.swing*st.amp*.8);
        guy.elbows[other].rotation.x=-.62-.24*Math.abs(wave2);
      }
      guy.g.position.y+=pulse*(action==="crash"?.13:.05)*st.amp;
    }else if(action==="hug"){
      /* 张开双臂只在真的抱到人的时候；还在路上就照常挥手跑，不然就是叉车。 */
      const near=playerTarget?1-clamp(Math.hypot(actor.pos.x-playerTarget.x,actor.pos.z-playerTarget.z)/1.7,0,1):1;
      const wave=Math.sin(t*7.2+actor.phase);
      guy.arms[0].rotation.x=mixN(-1.48-.42*wave,-1.46,near);
      guy.arms[0].rotation.z=mixN(-.20+.32*wave,.66,near);
      guy.arms[1].rotation.x=mixN(guy.arms[1].rotation.x,-1.46,near);
      guy.arms[1].rotation.z=mixN(guy.arms[1].rotation.z,-.66,near);
      guy.elbows[0].rotation.x=mixN(-.44+.38*wave,-.12,near);
      guy.elbows[1].rotation.x=mixN(guy.elbows[1].rotation.x,-.12,near);
      guy.g.position.y+=pulse*.10*near;
    }else if(action==="retrieve"){
      guy.arms[0].rotation.x=-.78;guy.arms[1].rotation.x=-.68;
      guy.knees[0].rotation.x=.58;guy.knees[1].rotation.x=.48;
    }else if(action==="fall"){
      const k=clamp((t-.22)/.42,0,1);guy.g.rotation.z=.95*k;guy.g.position.y=Math.max(.12,STAND_FOOT_Y*(1-k));
      guy.arms[0].rotation.x=-.95;guy.arms[0].rotation.z=-.78;
      guy.arms[1].rotation.x=-.82;guy.arms[1].rotation.z=.72;
      guy.knees[0].rotation.x=.92*k;guy.knees[1].rotation.x=.64*k;
    }else if(action==="head"){
      guy.arms[0].rotation.x=-1.24;guy.arms[0].rotation.z=-.54;
      guy.arms[1].rotation.x=-1.24;guy.arms[1].rotation.z=.54;
      guy.elbows[0].rotation.x=-.24;guy.elbows[1].rotation.x=-.24;
    }else if(action==="invalid"){
      guy.arms[0].rotation.x=-1.02;guy.arms[0].rotation.z=.72*s;
      guy.arms[1].rotation.x=-1.02;guy.arms[1].rotation.z=-.72*s;
      guy.elbows[0].rotation.x=-.18;guy.elbows[1].rotation.x=-.18;
    }else if(action==="kneel"){
      guy.g.position.y=.06;guy.legs[0].rotation.x=-.38;guy.legs[1].rotation.x=-.32;
      guy.knees[0].rotation.x=1.18;guy.knees[1].rotation.x=1.08;
      guy.arms[0].rotation.x=-.88;guy.arms[1].rotation.x=-.76;
    }else if(action==="sad"){
      guy.g.rotation.x=.18;guy.arms[0].rotation.x=.10;guy.arms[1].rotation.x=.08;
      guy.headRoot&& (guy.headRoot.rotation.x=.34);
    }else if(action==="slow"){
      guy.arms[0].rotation.x=-.08;guy.arms[1].rotation.x=-.08;
      guy.headRoot&& (guy.headRoot.rotation.x=.18);
    }else if(action==="freeze"){
      guy.arms[0].rotation.x=-.34;guy.arms[1].rotation.x=-.34;
    }
  }

  function startPostShot(){
    if(!squad)return;
    squad.post={active:true,t:0,reaction:null};
    IDS.forEach(id=>{
      const actor=squad.actors[id];actor.reaction=null;actor.reactionT=0;actor.startPos.copy(actor.pos);
    });
  }
  function startReaction(made,playerPos){
    if(!squad)return;
    if(!squad.post)squad.post={active:true,t:0,reaction:null};
    if(squad.post.reaction)return;
    squad.post.reaction={made:!!made,t:0,playerPos:playerPos?playerPos.clone():null};
    /* 打铁的时候球是活的：离篮筐最近的两个人必须立刻冲过去抢，不分敌我。
       随机抽反应会出现"球弹在地上没人管"的假象。 */
    let boarders=null;
    IDS.forEach(id=>{squad.actors[id].rimSlot=null;});
    if(!made){
      boarders=IDS.map(id=>({id,d:Math.hypot(squad.actors[id].pos.x-HOOP.x,squad.actors[id].pos.z-HOOP.z)}))
        .sort((a,b)=>a.d-b.d).slice(0,2).map(v=>v.id);
      boarders.forEach((id,i)=>{squad.actors[id].rimSlot=i;});
    }
    IDS.forEach(id=>{
      const actor=squad.actors[id];
      const pool=made?(actor.ally?REACTION_ALLY_MADE:REACTION_FOE_MADE):(actor.ally?REACTION_ALLY_MISS:REACTION_FOE_MISS);
      actor.reaction=(boarders&&boarders.indexOf(id)>=0)?"retrieve":pool[(Math.random()*pool.length)|0];
      actor.reactionT=0;actor.reactionPace=.85+Math.random()*.34;actor.startPos.copy(actor.pos);
    });
    // 给要冲过来的人编号，mobTarget 靠它把落点错开
    let mob=0;
    IDS.forEach(id=>{
      const a=squad.actors[id];
      a.mobSlot=MOB_REACTIONS[a.reaction||""]?mob++:null;
    });
    IDS.forEach(id=>{squad.actors[id].mobCount=mob;});
  }
  /* 打铁瞬间进入抢篮板：离球最近的三个人冲向落点，够近了就起跳争抢。
     没有这一步，球从框上弹下来会没人管，全场干看着。 */
  const REBOUND_JUMP_SECONDS=.72,REBOUND_REACH=1.5;
  /* 球权归属先定下来，再让人去抢——否则谁先跑到就归谁，等于比谁的路点近。
     防守方大概率保护篮板(真实比赛防守篮板率就是七成左右)。 */
  const DEF_REBOUND_RATE=.72;
  function startRebound(ballPos){
    if(!squad)return;
    const order=IDS.map(id=>({id,d:Math.hypot(squad.actors[id].pos.x-ballPos.x,squad.actors[id].pos.z-ballPos.z)}))
      .sort((a,b)=>a.d-b.d);
    const defenseWins=Math.random()<DEF_REBOUND_RATE;
    // 赢球权的一方里，离球最近的那个人拿到球
    const winner=(order.find(v=>squad.actors[v.id].ally!==defenseWins)||order[0]).id;
    squad.rebound={active:true,t:0,winner,ally:squad.actors[winner].ally,secured:false,putback:null};
    order.forEach((v,i)=>{
      const a=squad.actors[v.id];
      a.chasing=i<3||v.id===winner;
      a.chasePace=.85+Math.random()*.34;   // 每个人冲抢的速度不同
    });
    return squad.rebound;
  }
  function reboundState(){return squad&&squad.rebound||null;}
  function poseRebound(actor,dt,ballPos){
    const guy=actor.guy;
    const d=Math.hypot(actor.pos.x-ballPos.x,actor.pos.z-ballPos.z);
    const speed=steerTo(actor,ballPos.x,ballPos.z,dt,4.4*pace(actor)*(actor.chasePace||1),DEF_ACCEL*1.2);
    poseRunner(actor,speed,dt,ballPos);
    const rb=squad.rebound;
    // 只有拿到球权的那个人能真正"收下"球
    if(rb&&!rb.secured&&actor.id===rb.winner&&d<.75){rb.secured=true;rb.securedAt=0;}
    // 够近而且球还在够得着的高度，就起跳抢
    if(actor.reboundJump==null&&d<REBOUND_REACH&&ballPos.y>.9&&ballPos.y<3.4)actor.reboundJump=0;
    if(actor.reboundJump!=null){
      actor.reboundJump+=dt;
      const j=clamp(actor.reboundJump/REBOUND_JUMP_SECONDS,0,1);
      guy.g.position.y+=Math.sin(j*Math.PI)*.5;
      guy.arms[0].rotation.x=-2.55;guy.arms[1].rotation.x=-2.48;
      guy.arms[0].rotation.z=-.16;guy.arms[1].rotation.z=.16;
      guy.elbows[0].rotation.x=-.18;guy.elbows[1].rotation.x=-.22;
      if(actor.reboundJump>REBOUND_JUMP_SECONDS)actor.reboundJump=null;
    }
    headTrack(actor,ballPos,dt);
  }
  // 抢到球之后的两种收尾动作：我方补篮 / 防守方外传
  function setActorBall(id,visible){
    const a=squad&&squad.actors[id];if(!a||!a.ball)return;
    a.ball.visible=!!visible;a.ball.position.set(0,1.18,0.30);
  }
  function actorHand(id){
    const a=squad&&squad.actors[id];if(!a)return null;
    return V3(a.pos.x,1.65*(a.hs||1),a.pos.z+.22);
  }
  function startPutback(id){
    const a=squad&&squad.actors[id];if(!a)return;
    a.putback=0;a.reboundJump=0;
  }
  function startOutlet(id){
    const a=squad&&squad.actors[id];if(!a)return;
    a.outlet=0;
  }
  function posePossession(actor,dt){
    const guy=actor.guy;
    if(actor.putback!=null){
      // 补篮：双手把球往框上送
      actor.putback+=dt;
      const k=clamp(actor.putback/.42,0,1);
      guy.arms[0].rotation.x=-2.30-.35*k;guy.arms[1].rotation.x=-2.18-.32*k;
      guy.arms[0].rotation.z=-.14;guy.arms[1].rotation.z=.18;
      guy.elbows[0].rotation.x=-.55+.42*k;guy.elbows[1].rotation.x=-.60+.44*k;
      if(actor.putback>1.1)actor.putback=null;
      return true;
    }
    if(actor.outlet!=null){
      // 防守篮板后转身外传：抱球→转体→单臂推出
      actor.outlet+=dt;
      const k=clamp(actor.outlet/.55,0,1);
      actor.face+=angleDelta(actor.face,faceTo(actor.pos,V3(actor.pos.x,0,actor.pos.z+6)))*Math.min(1,dt*3.5);
      guy.g.rotation.y=actor.face;
      guy.arms[0].rotation.x=-1.28+.55*k;guy.arms[0].rotation.z=-.30;
      guy.arms[1].rotation.x=-1.10+.40*k;guy.arms[1].rotation.z=.26;
      guy.elbows[0].rotation.x=-1.05+.85*k;guy.elbows[1].rotation.x=-.95+.70*k;
      if(actor.outlet>1.2)actor.outlet=null;
      return true;
    }
    return false;
  }
  /* 罚球站位（按 NBA 规则排）：
       禁区两侧各有站位格，从底线往罚球线数依次是
         第 1 格 = 防守方、第 2 格 = 进攻方、第 3 格 = 防守方。
       实际占位是 3 名防守 + 2 名进攻穿插在禁区两边，其余人一律退到三分线外。
     坐标：篮筐 z=-8，底线在篮筐后 1.2m(z=-9.2)，禁区宽 4.9m(x=±2.45)，
     三格距底线 2.1 / 3.0 / 3.9m，罚球线距篮筐 4.6m。 */
  const LANE_X=2.45,BASELINE_Z=HOOP.z-1.2;
  const FT_LANE=[
    {x:-LANE_X,z:BASELINE_Z+2.1,def:true},   // 左·第1格 防守
    {x: LANE_X,z:BASELINE_Z+2.1,def:true},   // 右·第1格 防守
    {x:-LANE_X,z:BASELINE_Z+3.0,def:false},  // 左·第2格 进攻
    {x: LANE_X,z:BASELINE_Z+3.0,def:false},  // 右·第2格 进攻
    {x:-LANE_X,z:BASELINE_Z+3.9,def:true}    // 左·第3格 防守
  ];
  // 其余人退到三分线外，避开罚球者正前方那条线
  const FT_ARC=[[-48,7.2],[48,7.2],[-78,7.0],[78,7.0],[-20,7.6],[20,7.6]];
  function lineUpForFreeThrow(ftSpot){
    if(!squad)return;
    squad.post={active:true,t:0,reaction:null};
    squad.rebound=null;
    const defs=FOE_IDS.slice(),alls=ALLY_IDS.slice(),arc=[];
    const place=(id,x,z)=>{
      const a=squad.actors[id];
      a.reaction=null;a.chasing=false;a.putback=null;a.outlet=null;
      a.contestJump=null;a.contestPending=null;a.pressure=0;a.handsUp=0;
      a.vx=0;a.vz=0;
      a.pos.set(x,0,z);
      a.guy.g.position.set(x,a.guy.g.position.y,z);
      a.face=faceTo(a.pos,ftSpot||HOOP);
      a.guy.g.rotation.y=a.face;
      if(a.ball)a.ball.visible=false;
    };
    FT_LANE.forEach(slot=>{
      const id=slot.def?defs.shift():alls.shift();
      if(id)place(id,slot.x,slot.z);
    });
    defs.concat(alls).forEach((id,i)=>{
      const a=FT_ARC[i%FT_ARC.length],rad=a[0]*Math.PI/180;
      place(id,HOOP.x+Math.sin(rad)*a[1],HOOP.z+Math.cos(rad)*a[1]);
    });
  }
  function updatePostShot(dt,ballPos,playerPos,livePos){
    if(!squad||!squad.post)return;
    squad.post.t+=dt;
    /* ballPos 为 null = 球已落定(sequence 的 gazeTarget 判定)。此时既不追球也不锁筐:
       身体保持当前朝向、头平滑回正,等反应动作接手后再各看各的。 */
    const reaction=squad.post.reaction;
    IDS.forEach(id=>{
      const actor=squad.actors[id];
      if(reaction)poseReaction(actor,dt,ballPos,playerPos||reaction.playerPos);
      // 打铁后的抢板混战：最近的三个人追球并起跳
      else if(posePossession(actor,dt)){/* 补篮 / 外传动作接管上半身 */}
      else if(squad.rebound&&squad.rebound.active&&actor.chasing&&livePos)poseRebound(actor,dt,livePos);
      // 球还在飞：内线去篮下卡位抢板，其余人原地看球
      else if(BOX_OUT_SPOTS[id]&&ballPos)poseBoxOut(actor,dt,!actor.ally);
      // 球还在空中时，篮下 7m 内的人也往里跟进抢位置，而不是站着看
      else if(ballPos&&Math.hypot(actor.pos.x-HOOP.x,actor.pos.z-HOOP.z)<7)poseTrailIn(actor,dt);
      else poseWatcher(actor,dt,ballPos,ballPos?HOOP:null);
      // 姿势写完后统一守卫手势安全，再把头的旋转中心搬回脖子。
      guardArms(actor.guy);
      pivotHead(actor.guy);
    });
    if(reaction)separate(playerPos||reaction.playerPos);
  }
  /* 反应阶段所有人都在自由移动，没有战术站位约束，很容易两个人走进同一格，
     或者直接走进你身上(第一人称就是整块身体糊在屏幕上)。复用编排阶段那套 separate：
     之前它只在 update() 里跑，反应阶段完全没有约束，罚球失败后对方一拥而上必穿模。 */

  function place(t){
    if(!squad)return;
    const chore=squad.cfg.choreography;
    IDS.forEach(id=>{
      const actor=squad.actors[id],plan=chore[id];if(!plan)return;
      const p=samplePath(plan.path,t);if(!p)return;
      actor.pos.copy(p);
      actor.guy.g.position.x=p.x;actor.guy.g.position.z=p.z;
      actor.defensive=!actor.ally;
      actor.face=faceTo(p,HOOP);
      actor.guy.g.rotation.y=actor.ally?actor.face:actor.face+Math.PI;
    });
  }

  /* 路点是手写的,过渡段难免让两个人撞到一起。这里做一次松弛:任何一对中心距
     小于 MIN_GAP 就沿连线各推开一半;你本人位置固定,只把别人推离你,不推你。
     没有这一步,防守人和自己盯的人在跑动中会明显穿模。 */
  const MIN_GAP=0.98,PLAYER_GAP=1.15;
  function separate(playerPos){
    const list=IDS.map(id=>squad.actors[id]);
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<list.length;i++){
        for(let j=i+1;j<list.length;j++){
          const a=list[i].pos,b=list[j].pos;
          let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
          if(d>=MIN_GAP)continue;
          if(d<1e-4){dx=Math.cos(i*2.4);dz=Math.sin(i*2.4);d=1;}
          const push=(MIN_GAP-d)/d*0.5;
          a.x-=dx*push;a.z-=dz*push;b.x+=dx*push;b.z+=dz*push;
        }
      }
      if(!playerPos)continue;
      list.forEach(actor=>{
        let dx=actor.pos.x-playerPos.x,dz=actor.pos.z-playerPos.z,d=Math.hypot(dx,dz);
        if(d>=PLAYER_GAP)return;
        if(d<1e-4){dx=1;dz=0;d=1;}
        const push=(PLAYER_GAP-d)/d;
        actor.pos.x+=dx*push;actor.pos.z+=dz*push;
      });
    }
    list.forEach(actor=>{actor.guy.g.position.x=actor.pos.x;actor.guy.g.position.z=actor.pos.z;});
  }

  /* 盯你的那个防守人：接球前是协防倾向(离你远、盯着弱侧)，球一传出就 closeout 扑你，
     到位后贴身对位；你迟迟不出手，他会在合适距离起跳封盖。
     阶段来自 sequence 传进来的 phase：{passing, inHand, chargeT}。 */
  /* 扑防不能扑到贴脸：CONTEST_GAP 留到 1.25m(一个身位)，扑防速度取实测区间下限
     4.6m/s，让你有出手窗口。起跳时机 1.25s——正常蓄力 0.78s 出手时他还在两米外。
     起跳由你的起跳动作触发(triggerContest)，不再用持球秒表。 */
  const CLOSEOUT_GAP=1.6,CONTEST_GAP=1.25,CONTEST_JUMP_SECONDS=.95;
  const _phase={};
  const mixN=(a,b,k)=>a+(b-a)*k;
  function updateOnBall(actor,dt,playerPos,st){
    if(!playerPos)return actor.speed||0;
    const gapNow=Math.hypot(actor.pos.x-playerPos.x,actor.pos.z-playerPos.z);
    if(!st.passing&&!st.inHand){
      actor.onBallPhase="help";
      // 协防倾向：待在原协防位，只把身体侧对，不扑
      const p=samplePath(squad.cfg.choreography[actor.id].path,st.t||0);
      if(p)return steerTo(actor,p.x,p.z,dt,2.6,10);
      return 0;
    }
    // 球传出的一刻起才开始反应，仍然带 0.22s 的启动延迟
    actor.closeoutT=(actor.closeoutT||0)+dt;
    if(actor.closeoutT<DEF_REACTION){actor.onBallPhase="react";return steerTo(actor,actor.pos.x,actor.pos.z,dt,0,DEF_ACCEL);}
    /* 持球拖得越久压迫越强：贴得更近、手举得更高。你不投他不会跳(真实防守也这样)，
       但绝不能干站着——错过出手时机就该被越贴越死。 */
    const pressure=clamp(((st.chargeT||0)-.9)/1.1,0,1);
    actor.pressure=st.inHand?pressure:0;
    const gap=st.inHand?CONTEST_GAP-.28*pressure:CLOSEOUT_GAP;
    /* 必须堵在你与篮筐之间，也就是你的投篮路线上。
       原来用"保持防守人当前方位角"靠近，结果他从哪边来就停在哪边——一直在侧面。 */
    const spot=markTarget(playerPos,gap);
    const tx=spot.x,tz=spot.z;
    const closing=gapNow>gap+.25;
    actor.onBallPhase=closing?"closeout":"contest";
    const speed=steerTo(actor,tx,tz,dt,closing?DEF_CLOSEOUT_SPEED:DEF_MARK_SPEED,closing?DEF_ACCEL*1.35:DEF_ACCEL);
    /* 起跳不是按秒表触发的——玩家 0.59s 起跳、0.78s 就出手，中间只有 0.19s，
       任何"持球满 X 秒才跳"的阈值都永远等不到，结果就是从不封盖。
       改成跟随：sequence 看到你起跳就调 triggerContest()，防守人隔 0.08–0.28s
       (人的视觉反应)再蹬地起跳，正好赶在你出手前后把手举起来。 */
    if(actor.contestCool>0)actor.contestCool-=dt;
    if(actor.handsUp>0)actor.handsUp=Math.max(0,actor.handsUp-dt*.6);
    if(actor.contestPending!=null){
      actor.contestPending-=dt;
      if(actor.contestPending<=0){actor.contestPending=null;
        if(!(actor.contestCool>0))actor.contestJump=0;}
    }
    if(actor.contestJump!=null){
      actor.contestJump+=dt;
      // 落地后要重新蹬地才能再跳，否则会无缝连跳
      if(actor.contestJump>CONTEST_JUMP_SECONDS){actor.contestJump=null;actor.contestCool=.55;}
    }
    return speed;
  }
  /* 球一出手，内线就该去篮下抢位置：防守方抢内线(背身卡住进攻人)，进攻方绕外侧冲抢。
     没有这一步，出手后全场只是站着看球，篮下空无一人。 */
  /* 只有真正的内线去抢板。外线球员起点在七八米外，让他们冲篮下反而假。
     防守方(foe4)占内侧、进攻方(ally3)只能从外侧挤——这就是卡位。 */
  const BOX_OUT_SPOTS={ally3:{x:-1.05,z:1.25},foe4:{x:-.75,z:.85}};
  function poseBoxOut(actor,dt,defensive){
    const guy=actor.guy,spot=BOX_OUT_SPOTS[actor.id];if(!spot)return false;
    const tx=HOOP.x+spot.x,tz=HOOP.z+spot.z;
    const speed=steerTo(actor,tx,tz,dt,(defensive?3.4:3.8)*pace(actor),DEF_ACCEL);
    // 防守人背对篮筐把人挡在身后，进攻人面向篮筐找空位
    const face=defensive?faceTo(actor.pos,HOOP)+Math.PI:faceTo(actor.pos,HOOP);
    actor.face+=angleDelta(actor.face,face)*Math.min(1,dt*5);
    poseRunner(actor,speed,dt,null);
    guy.g.rotation.y=actor.face;
    // 卡位姿势：屈膝沉重心、双臂横向张开占住位置
    const set=1-clamp(speed/2.2,0,1);
    guy.legs[0].rotation.x=mixN(guy.legs[0].rotation.x,-.16,set);
    guy.legs[1].rotation.x=mixN(guy.legs[1].rotation.x,-.16,set);
    guy.knees[0].rotation.x=mixN(guy.knees[0].rotation.x,.52,set);
    guy.knees[1].rotation.x=mixN(guy.knees[1].rotation.x,.52,set);
    guy.arms[0].rotation.x=mixN(guy.arms[0].rotation.x,-.62,set);
    guy.arms[1].rotation.x=mixN(guy.arms[1].rotation.x,-.62,set);
    guy.arms[0].rotation.z=mixN(guy.arms[0].rotation.z,-.92,set);
    guy.arms[1].rotation.z=mixN(guy.arms[1].rotation.z,.92,set);
    guy.elbows[0].rotation.x=mixN(guy.elbows[0].rotation.x,-.55,set);
    guy.elbows[1].rotation.x=mixN(guy.elbows[1].rotation.x,-.55,set);
    return true;
  }
  /* ---------------- 手势安全守卫 ----------------
     绝对不允许出现"单臂接近伸直 + 斜前上方"的组合——那个姿势有明确的历史含义，
     不能出现在任何庆祝里。举手一律接近垂直(仰角 >55°)，或者把肘明显弯下来。
     这里是最后一道兜底：姿势写完后扫一遍，命中就把肘压弯。 */
  function armElevation(rotX){
    const up=-Math.cos(rotX),fwd=-Math.sin(rotX);
    return{elev:Math.atan2(up,Math.abs(fwd))*180/Math.PI,fwd};
  }
  function guardArms(guy){
    for(let i=0;i<2;i++){
      const arm=guy.arms[i],el=guy.elbows[i];
      if(!arm||!el)continue;
      const{elev,fwd}=armElevation(arm.rotation.x);
      if(fwd>.5&&elev>-12&&elev<55&&Math.abs(el.rotation.x)<.35)el.rotation.x=-.68;
    }
  }
  /* 举手压迫：还没起跳，但手已经举到你脸前干扰视线。拖得越久举得越高。 */
  function poseContestHands(actor,pressure){
    const guy=actor.guy,k=clamp(pressure,0,1);
    guy.arms[0].rotation.x=mixN(guy.arms[0].rotation.x,-2.28,k);
    guy.arms[1].rotation.x=mixN(guy.arms[1].rotation.x,-1.62,k);
    guy.arms[0].rotation.z=mixN(guy.arms[0].rotation.z,-.14,k);
    guy.arms[1].rotation.z=mixN(guy.arms[1].rotation.z,.30,k);
    guy.elbows[0].rotation.x=mixN(guy.elbows[0].rotation.x,-.10,k);
    guy.elbows[1].rotation.x=mixN(guy.elbows[1].rotation.x,-.34,k);
  }
  /* 球在空中时的跟进：不是全速冲，是慢跑往篮下靠，占住二次进攻的位置。
     每个人的落点错开，避免十个人叠在篮下同一点。 */
  function poseTrailIn(actor,dt){
    const seed=(actor.style&&actor.style.bias||0)*8;
    const tx=HOOP.x+Math.sin(seed+actor.phase)*1.9,tz=HOOP.z+1.6+Math.cos(seed)*1.1;
    const speed=steerTo(actor,tx,tz,dt,1.9*pace(actor),DEF_ACCEL*.6);
    poseRunner(actor,speed,dt,HOOP);
  }
  // 封盖起跳：双手向上撑满，身体腾空，落地前收腿——这是防守人唯一的起跳动作。
  function poseContestJump(actor){
    const guy=actor.guy,j=clamp(actor.contestJump/CONTEST_JUMP_SECONDS,0,1);
    // 弹跳高度与你一致(玩家峰值 0.55m)，高个不因为缩放就跳得更高
    const h=Math.sin(j*Math.PI)*.55;
    guy.g.position.y+=h;
    guy.arms[0].rotation.x=-2.62;guy.arms[0].rotation.z=-.10;
    guy.arms[1].rotation.x=-2.40;guy.arms[1].rotation.z=.16;
    guy.elbows[0].rotation.x=-.05;guy.elbows[1].rotation.x=-.14;
    guy.legs[0].rotation.x=.20*(1-j);guy.legs[1].rotation.x=-.14*(1-j);
    guy.knees[0].rotation.x=.42*Math.sin(j*Math.PI);guy.knees[1].rotation.x=.28*Math.sin(j*Math.PI);
  }
  /* 玩家起跳出手 → 防守人跟着反应。近处的大概率(78%)跳起来封，小概率只举手贴住；
     还在扑的路上(3m 外)就不跳了——边跑边跳不合理，但手要举起来干扰。
     总之绝不会站着干看。返回本次是否有人真的起跳，便于自检。 */
  const CONTEST_JUMP_CHANCE=.78,CONTEST_JUMP_RANGE=3.0;
  // 个体跑动倍率：同一个人保持一致(不会抖)，人与人之间不同
  const pace=a=>(a.style&&a.style.pace)||1;
  const ARM_OUT=.48;   // 举手挥动的外偏中心，保证内摆不扫到头
  /* 手臂朝上时，向身体中线的内摆会把手扫进头顶。外摆随意，内摆砍到 45%。
     sgn<0 的手臂(arms[0], 建在 -X)内摆是 z 变正，sgn>0 的反之。 */
  function swingZ(sgn,center,amp){
    const inward=sgn<0?Math.max(0,amp):Math.min(0,amp);
    return sgn*center+(amp-inward)+inward*.45;
  }
  function triggerContest(playerPos){
    if(!squad)return false;
    let jumped=false;
    FOE_IDS.forEach(id=>{
      const actor=squad.actors[id];
      if(actor.contestJump!=null||actor.contestPending!=null)return;
      const d=playerPos?Math.hypot(actor.pos.x-playerPos.x,actor.pos.z-playerPos.z):99;
      if(d>CONTEST_JUMP_RANGE){actor.handsUp=Math.max(actor.handsUp||0,.9);return;}
      if(Math.random()<CONTEST_JUMP_CHANCE){
        actor.contestPending=.08+Math.random()*.20;jumped=true;
      }else actor.handsUp=1;   // 不起跳的那部分：举手贴住继续干扰
    });
    return jumped;
  }
  /* 出手瞬间的干扰强度。分两层：
       · 贴到正面本身就有干扰(0.45)——真实比赛里手举在你脸前就够влиять手感，不必起跳；
       · 起跳且时机对，才叠到接近 1.0，那才是真封盖。
     "防守人在投篮肩一个身位内"才构成干扰，1.9m 之外一律为 0。 */
  /* 最近防守人的水平距离。犯规判定必须用它，不能用 contestLevel——
     后者在 1.9m 之外恒为 0，拿它当门槛等于"果断出手永远不可能被犯规"。 */
  function defenderDistance(playerPos){
    if(!squad||!playerPos)return 99;
    let best=99;
    FOE_IDS.forEach(id=>{
      const actor=squad.actors[id];
      best=Math.min(best,Math.hypot(actor.pos.x-playerPos.x,actor.pos.z-playerPos.z));
    });
    return best;
  }
  function contestLevel(playerPos){
    if(!squad||!playerPos)return 0;
    let best=0;
    FOE_IDS.forEach(id=>{
      const actor=squad.actors[id];
      const d=Math.hypot(actor.pos.x-playerPos.x,actor.pos.z-playerPos.z);
      if(d>1.9)return;
      /* 满分距离必须对得上贴防实际能站到的位置(CONTEST_GAP 1.25)，
         否则算出来的干扰强度永远够不到阈值，等于封盖形同虚设。 */
      const near=1-clamp((d-1.35)/.55,0,1);
      /* 手是在蹬地那一刻就举满的(见 poseContestJump)，所以有效封盖窗口从起跳就开始，
         而不是等身体升到最高点——你起跳后 0.19s 就出手了，等最高点永远等不到。
         窗口 0–0.62s、峰值 0.22s：他早跳一点就盖到，晚跳一点就只是干扰，
         而他的起跳延迟本身是 0.08–0.28s 随机，这就是"一定概率"的来源。 */
      const rise=actor.contestJump==null?.45*(actor.handsUp||0)
        :1-clamp(Math.abs(actor.contestJump-.22)/.40,0,1);
      best=Math.max(best,near*(.45+.55*rise));
    });
    return best;
  }
  function update(t,dt,playerPos,phase){
    if(!squad)return;
    const chore=squad.cfg.choreography,actors=squad.actors;
    const src=phase||{};
    _phase.passing=!!src.passing;_phase.inHand=!!src.inHand;_phase.chargeT=src.chargeT||0;_phase.t=t;
    const st=_phase;
    /* 进攻方走编排路点；防守方改成延迟追踪。顺序很重要：先把进攻方落位并记录轨迹，
       防守方才能读到"进攻人 0.22 秒前的位置"。 */
    ALLY_IDS.forEach(id=>{
      const actor=actors[id],plan=chore[id];if(!plan)return;
      const p=samplePath(plan.path,t);if(!p)return;
      /* 速度必须取纯路径位移。用 actor.pos 差分会把上一帧 separate() 的推挤
         算成跑动，摆腿频率就会忽快忽慢。 */
      const prev=samplePath(plan.path,Math.max(0,t-dt));
      actor.speed=prev?Math.hypot(p.x-prev.x,p.z-prev.z)/Math.max(1e-3,dt):0;
      actor.pos.copy(p);
      actor.defensive=false;
      recordTrail(actor,t);
    });
    FOE_IDS.forEach(id=>{
      const actor=actors[id],plan=chore[id];if(!plan)return;
      actor.defensive=true;
      if(plan.marks==="you"){actor.speed=updateOnBall(actor,dt,playerPos,st);return;}
      const mark=plan.marks&&actors[plan.marks];
      if(!mark){
        // 没有对位目标(协防/包夹是编排好的战术跑位)，仍按路点走
        const p=samplePath(plan.path,t);if(!p)return;
        const prev=samplePath(plan.path,Math.max(0,t-dt));
        actor.speed=prev?Math.hypot(p.x-prev.x,p.z-prev.z)/Math.max(1e-3,dt):0;
        actor.pos.copy(p);return;
      }
      if(plan.help){
        // 包夹是战术指令，走编排路点，但到位后交给追踪，免得贴着人抖
        const p=samplePath(plan.path,t);if(!p)return;
        const prev=samplePath(plan.path,Math.max(0,t-dt));
        actor.speed=prev?Math.hypot(p.x-prev.x,p.z-prev.z)/Math.max(1e-3,dt):0;
        actor.pos.copy(p);return;
      }
      const seen=trailAt(mark,t-DEF_REACTION);
      const tgt=markTarget(seen,plan.gap);
      actor.speed=steerTo(actor,tgt.x,tgt.z,dt,DEF_MARK_SPEED*pace(actor),DEF_ACCEL);
    });
    separate(playerPos);
    IDS.forEach(id=>{
      const actor=actors[id],plan=chore[id];if(!plan)return;
      // 防守人看着自己盯的人,进攻人看篮筐;盯你的那个始终转向你,压迫感来自这里。
      let look=HOOP;
      if(plan.marks==="you"&&playerPos)look=playerPos;
      else if(plan.marks&&actors[plan.marks])look=actors[plan.marks].pos;
      poseRunner(actor,actor.speed||0,dt,look);
      if(actor.ball&&actor.ball.visible)poseDribble(actor,dt,clamp((actor.speed||0)/3.6,0,1));
      if(actor.contestJump!=null)poseContestJump(actor);
      else if((actor.pressure||0)>0||(actor.handsUp||0)>0)poseContestHands(actor,Math.max(actor.pressure||0,actor.handsUp||0));
      guardArms(actor.guy);
      pivotHead(actor.guy);
    });
  }

  function show(visible){
    if(!squad)return;
    if(visible)bakeOnce();
    IDS.forEach(id=>{squad.actors[id].guy.g.visible=!!visible;});
  }

  /* 谁正朝你冲过来庆祝 —— 只认 move==="player" 那几种反应。
     第一人称的推搡冲击要挂在"人真的到了"这一刻，不能拿定时器假装。 */
  const MOB_REACTIONS={rush:1,push:1,hug:1,crash:1};
  function nearestMate(pos){
    if(!squad||!pos)return null;
    let best=null;
    ALLY_IDS.forEach(id=>{
      const a=squad.actors[id];
      if(!a||!MOB_REACTIONS[a.reaction||""])return;
      const d=Math.hypot(a.pos.x-pos.x,a.pos.z-pos.z);
      if(!best||d<best.dist)best={id,dist:d};
    });
    return best;
  }

  function handler(){return squad?squad.actors.ally0:null;}
  function setHandlerBall(visible){
    const a=handler();if(a)a.ball.visible=!!visible;
  }
  function dispose(){
    if(!squad)return;
    IDS.forEach(id=>{squad.actors[id].guy.g.visible=false;});
  }

  const api=Object.freeze({build,place,update,nearestMate,guardArms,startPostShot,updatePostShot,startReaction,show,handler,setHandlerBall,dispose,contestLevel,defenderDistance,triggerContest,startRebound,reboundState,setActorBall,actorHand,startPutback,startOutlet,lineUpForFreeThrow,ALLY_IDS,FOE_IDS,
    get squad(){return squad;}});
  global.AIBALastShotSquad=api;
  runtime.register("mode:last-shot:squad",api);
})(window);
