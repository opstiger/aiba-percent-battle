/* ---------------- 胸腔叠加层（M3 躯干分节 + 力度驱动的身体动作） ----------------
   诊断：骨架没有骨盆/胸腔分节，躯干是一整块，前倾后仰只能转整个根节点——做不出屈髋、
   跑动时肩髋反向扭转、出手随挥这些"重心在动"的动作；欠力/过力在身体上也看不出来。

   为什么不直接改骨架层级：手臂位置在多处按根节点坐标写死（motion.js 肩高 1.36），
   投篮姿势还会记录"相对根节点"的朝向再写回（capturePoseNode 的 aq）。中间插一层关节，
   这些地方全要改，牵动 2000 多行别的 AI 反复迭代过的动作代码。
   这里用动画系统里标准的"叠加层"：骨架不动；每帧动作全部算完、临渲染前，把胸口以上的
   部件整体绕腰椎（离地 .95m）转一个小角度，渲染完再复原——下一帧的动作代码看到的
   永远是原始姿势（blendNodeQuat 会从当前值 slerp，不复原就会把叠加层滚进下一帧）。

   驱动全部从已经算好的姿势里读，不碰动作系统：
     - 屈膝带屈髋：膝盖弯下去胸口自然前倾（所有角色）
     - 跑动反向扭转：两腿摆动差 → 躯干反向扭（所有角色）
     - 落地缓冲：从空中落回地面那一刻胸口往前一沉
     - 出手随挥（玩家）：按这一球的力度误差——过力身体前冲，欠力胸口塌着，力度看得见
   接线：characters.js voxelGuy() 末尾 register(o)；game-loop 在 render 前后调 apply / restore；
   camera.js ballWorldPos 用 withPose 读出手点（否则出手瞬间球会从手里跳几厘米）。
   ?spine=off 关闭。

   投篮签名层（2026-09-24 第二轮，用户反馈"变化不大、各球星区分度不够"）：
     幅度整体放大约 1.7 倍，并按球星的 shotStyle（config.js SHOT_STYLES）叠加三项：
       jump  起跳高度倍率——空中身体按比例抬高 / 压低（乔丹 1.35，科沃尔 .72）
       fade  后仰——离地后上身往后倒（科比 .26 弧度）
       hold  随挥定格——出手 .1s 后把两条手臂的姿势定住若干秒再放下（雷·阿伦 .8s）
     都只在渲染时生效，不碰 check.js 锁到毫米的姿势计算。 */
(function(global){
  "use strict";
  let enabled=true;
  try{enabled=new URLSearchParams(location.search).get("spine")!=="off";}catch(e){}
  const PIVOT_Y=.95;
  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const actors=[];
  const canWeak=typeof WeakRef==="function";

  function spring(){return {a:0,v:0};}
  /* 临界阻尼弹簧追目标：f 频率 Hz */
  function chase(s,target,f,dt){
    const w=2*Math.PI*f;
    const acc=w*w*(target-s.a)-2*w*s.v;
    s.v+=acc*dt;s.a+=s.v*dt;
  }

  function register(o){
    if(!enabled||!o||!o.g)return;
    const legSet=new Set(o.legs||[]);
    actors.push({
      ref:canWeak?new WeakRef(o):o,legSet,
      pitch:spring(),yaw:spring(),roll:spring(),
      lastPos:null,speed:0,wasAir:false,lastBall:null,saved:[],applied:false,
      groundY:null,jumpH:0,ballWasVisible:false,releaseT:-1,holdPose:null,sinceRelease:9
    });
  }
  function deref(a){return canWeak?a.ref.deref():a.ref;}

  /* 胸口以上：根节点的直接子节点里，除了腿、接地影和腰线以下的短裤件。
     头的 headRoot 位置是缩放补偿量（很小），按名字认；球衣下摆贴着腰线，跟着胸口走。 */
  function torsoNodes(o,a,out){
    out.length=0;
    for(const n of o.g.children){
      if(a.legSet.has(n)||n===o.groundShadow)continue;
      if(n===o.headRoot||n===o.jerseyHem||(o.arms&&o.arms.includes(n))){out.push(n);continue;}
      if(n.isMesh&&n.position.y>=.9)out.push(n);
      else if(!n.isMesh&&n.position.y>=.9)out.push(n);
    }
    return out;
  }

  /* ---------- 驱动 ---------- */
  function isPlayer(o){return typeof player!=="undefined"&&o===player;}
  function airborne(o){
    if(isPlayer(o)&&global.AIBAShotPhysics&&AIBAShotPhysics.isAirborne)return AIBAShotPhysics.isAirborne();
    return o.g.position.y>.08;
  }
  /* 最新一颗玩家的球。百分大战里对手也在出手，数组最后一颗常常是对手的，不能只看末尾。 */
  function newPlayerBall(a){
    if(typeof balls==="undefined"||!balls.length)return null;
    for(let i=balls.length-1;i>=0;i--){
      const b=balls[i];
      if(!b||b.opp||b.silent)continue;
      if(b===a.lastBall)return null;
      a.lastBall=b;
      return b;
    }
    return null;
  }
  function heldBall(o){
    if(isPlayer(o))return typeof pBall!=="undefined"?pBall:null;
    return o.ball||null;
  }
  function styleOf(o){return o.shotStyle||{};}
  function drive(a,o,dt){
    // 速度（根节点位移）
    const p=o.g.position;
    if(a.lastPos){const dx=p.x-a.lastPos[0],dz=p.z-a.lastPos[2];a.speed=a.speed*.8+(Math.hypot(dx,dz)/Math.max(dt,1e-3))*.2;}
    a.lastPos=[p.x,p.y,p.z];
    const run=clamp(a.speed/4,0,1);
    /* 离地高度：根节点 y 相对"地面基线"。基线取近期最低点，缓慢上浮跟随（站姿高度会因
       屈膝而变，基线不能写死）。 */
    if(a.groundY===null)a.groundY=p.y;
    a.groundY=Math.min(p.y,a.groundY+dt*.5);
    a.jumpH=Math.max(0,p.y-a.groundY);
    const st=styleOf(o);
    // 屈膝带屈髋：膝盖弯曲量（两膝平均，弧度绝对值）
    const knees=o.knees||[];
    const bend=knees.length?(Math.abs(knees[0].rotation.x)+Math.abs(knees[1].rotation.x))/2:0;
    const air=airborne(o)||a.jumpH>.05;
    // 跑动反向扭转：左腿（下标 0）前摆时 rotation.x 为负，躯干反向扭 → yaw 同号
    const legs=o.legs||[];
    const swing=legs.length===2?(legs[0].rotation.x-legs[1].rotation.x)/2:0;
    /* ⚠ 本骨架 rotation.x 正号是后仰（motion.js 1446 行注释），前倾取负 */
    let pitchT=-clamp(bend/1.1,0,1)*.19-run*.08;
    if(air)pitchT+=.05;                           // 腾空时胸口舒展
    // 签名：后仰（离地越高倒得越多）
    const fade=Number(st.fade)||0;
    if(fade)pitchT+=fade*clamp(a.jumpH/.28,0,1);
    const yawT=air?0:clamp(swing*.32*(.35+.65*run),-.24,.24);
    // 落地缓冲
    if(a.wasAir&&!air)a.pitch.v-=1.5;
    a.wasAir=air;
    /* 出手检测（所有角色通用）：手里的球从可见变为不可见的那一刻 */
    const ball=heldBall(o),vis=!!(ball&&ball.visible);
    a.sinceRelease+=dt;
    if(a.ballWasVisible&&!vis&&(air||a.jumpH>.01||(isPlayer(o)&&typeof G!=="undefined"&&!G.charging))){
      a.sinceRelease=0;a.holdPose=null;
    }
    a.ballWasVisible=vis;
    /* 出手随挥：只对玩家，按力度误差。用"目标角 + 包络"而不是速度冲击：
       临界阻尼弹簧会把冲击在几帧内吃掉（实测只有 .027 弧度，被腾空舒展盖住）。
       包络 .08s 拉起、之后 .6s 回落。 */
    if(isPlayer(o)){
      const b=newPlayerBall(a);
      if(b){
        const zone=typeof playerSweetZone==="function"?Math.max(.5,playerSweetZone()):5.5;
        const u=clamp((Number(G&&G.lastErr)||0)/zone,-3,3);
        if(u>.5)a.followAmt=-(.17+.1*Math.min(1,u-.5));    // 过力：身体往前送出去
        else if(u<-.5)a.followAmt=-.12;                      // 欠力：含胸，没有舒展
        else a.followAmt=.08;                                // 正好：出手瞬间胸口挺起
        a.followT=0;a.followHold=u<-.5?.5:0;
      }
      if(a.followAmt){
        a.followT+=dt;
        const t=a.followT,rise=Math.min(1,t/.08),fall=t<.08+a.followHold?1:Math.max(0,1-(t-.08-a.followHold)/.6);
        const env=rise*fall;
        pitchT=(air&&a.followAmt<0?pitchT-.05:pitchT)+a.followAmt*env;   // 前送 / 含胸时不叠腾空舒展
        if(env<=0&&t>.1)a.followAmt=0;
      }
    }
    chase(a.pitch,pitchT,5.5,dt);
    chase(a.yaw,yawT,7,dt);
    a.pitch.a=clamp(a.pitch.a,-.4,.34);a.yaw.a=clamp(a.yaw.a,-.28,.28);
  }

  /* ---------- 应用 / 复原 ---------- */
  const tmpQ=new THREE.Quaternion(),tmpE=new THREE.Euler(0,0,0,"YXZ"),tmpV=new THREE.Vector3();
  const nodeBuf=[];
  function save(a,n){
    a.saved.push(n,n.position.x,n.position.y,n.position.z,n.quaternion.x,n.quaternion.y,n.quaternion.z,n.quaternion.w);
  }
  const HOLD_CAPTURE=.1,HOLD_BLEND=.22;
  function armChain(o){
    const out=[];
    for(let i=0;i<2;i++){
      if(o.arms&&o.arms[i])out.push(o.arms[i]);
      if(o.elbows&&o.elbows[i])out.push(o.elbows[i]);
      if(o.handRoots&&o.handRoots[i])out.push(o.handRoots[i]);
    }
    return out;
  }
  function applyTo(a,o){
    a.saved.length=0;
    const st=styleOf(o);
    /* 1. 起跳高度：空中身体按比例抬高 / 压低（根节点，腿跟着一起） */
    const jump=Number(st.jump)||1;
    if(jump!==1&&a.jumpH>.005){
      save(a,o.g);
      o.g.position.y+=a.jumpH*(jump-1);
    }
    /* 2. 随挥定格：出手 .1s 时记下两条手臂的姿势，之后 hold 秒内一直定在这个姿势，
          再用 .22s 融回动画本来的姿势。 */
    const hold=Number(st.hold)||0;
    if(hold>0&&a.sinceRelease<HOLD_CAPTURE+hold+HOLD_BLEND){
      const chain=armChain(o);
      if(!a.holdPose&&a.sinceRelease>=HOLD_CAPTURE)a.holdPose=chain.map(n=>n.quaternion.clone());
      if(a.holdPose){
        const t=a.sinceRelease-HOLD_CAPTURE,k=t<hold?1:Math.max(0,1-(t-hold)/HOLD_BLEND);
        chain.forEach((n,i)=>{save(a,n);n.quaternion.slerp(a.holdPose[i],k);});
      }
    }
    /* 3. 胸腔：绕腰椎整体转 */
    if(Math.abs(a.pitch.a)>=1e-4||Math.abs(a.yaw.a)>=1e-4){
      tmpE.set(a.pitch.a,a.yaw.a,0,"YXZ");tmpQ.setFromEuler(tmpE);
      const nodes=torsoNodes(o,a,nodeBuf);
      // 持球：还挂在根节点上的球跟着胸口走（挂在手上的球本来就在手臂下面）
      if(isPlayer(o)&&typeof pBall!=="undefined"&&pBall.parent===o.g)nodes.push(pBall);
      for(const n of nodes){
        save(a,n);
        tmpV.set(n.position.x,n.position.y-PIVOT_Y,n.position.z).applyQuaternion(tmpQ);
        n.position.set(tmpV.x,tmpV.y+PIVOT_Y,tmpV.z);
        n.quaternion.premultiply(tmpQ);
      }
    }
    a.applied=a.saved.length>0;
  }
  /* 倒序复原：同一个节点可能先被"定格"改过、再被"胸腔"改过，倒着恢复才能回到原值 */
  function restoreOne(a){
    if(!a.applied)return;
    const s=a.saved;
    for(let i=s.length-8;i>=0;i-=8){const n=s[i];n.position.set(s[i+1],s[i+2],s[i+3]);n.quaternion.set(s[i+4],s[i+5],s[i+6],s[i+7]);}
    s.length=0;a.applied=false;
  }
  let lastT=0;
  function apply(dt){
    if(!enabled)return;
    const now=performance.now();
    const step=clamp(Number(dt)>0?Number(dt):(lastT?(now-lastT)/1000:1/60),0,.05);lastT=now;
    for(let i=actors.length-1;i>=0;i--){
      const a=actors[i],o=deref(a);
      if(!o){actors.splice(i,1);continue;}
      if(!o.g.parent||!o.g.visible)continue;
      if(step>0)drive(a,o,step);
      applyTo(a,o);
    }
  }
  function restore(){
    if(!enabled)return;
    for(const a of actors)restoreOne(a);
  }
  /* 在叠加层生效的姿势下读世界坐标（出手点必须和画面上的手一致） */
  function withPose(o,fn){
    if(!enabled)return fn();
    const a=actors.find(x=>deref(x)===o);
    // 第一人称时身体隐藏、画面上是另一套手臂：出手点不能带胸腔旋转，否则和那双手对不上
    if(!a||a.applied||!o.g.visible)return fn();
    applyTo(a,o);
    try{o.g.updateMatrixWorld(true);return fn();}
    finally{restoreOne(a);o.g.updateMatrixWorld(true);}
  }
  global.AIBASpine=Object.freeze({enabled,register,apply,restore,withPose,
    get actors(){return actors.length;},
    debug(o){const a=actors.find(x=>deref(x)===o);return a?{pitch:a.pitch.a,yaw:a.yaw.a,speed:a.speed,jumpH:a.jumpH,sinceRelease:a.sinceRelease,holding:!!a.holdPose}:null;}});
})(window);
