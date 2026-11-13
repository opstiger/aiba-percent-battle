/* 切面皮套（实验）：把 src/lab/facet-athlete.js 的切面球员套到 AIBA 玩家骨架上。
   开关：?facet=1 玩家选的球星只要在切面模型的外貌表（AIBAFacet.TUNE）里就换（没选球星的开场画面按 24 号）；?facet=all 不在表里的也换。
   不带参数时本文件什么都不做，游戏和体素皮套照旧。

   做法和 kobe-avatar.js 相同：AIBA 的 player 照常创建、照常被动作系统驱动，渲染前读它各节点的朝向和位置，
   套到切面球员的关节上，渲染时把 AIBA 自己的方块网格藏起来。区别只有两点：
     · 切面球员是刚性分段、关节是父子层级，没有蒙皮、没有手指骨 —— 这里只算 16 个关节的朝向和骨盆位置
     · 外观直接从游戏的 star 记录生成（AIBAFacet.fromStar），不需要烘焙，也没有每位球星一份的手写档案
   玩家这一位由本文件接管时，体素皮套对玩家让位（对手仍是体素）。 */
(function(){
  "use strict";
  const QS=new URLSearchParams(location.search),MODE=QS.get("facet");
  if(!MODE||MODE==="0"||MODE==="off"||MODE==="none")return;
  const ALL=MODE==="all";
  const T=THREE;
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const state={F:null,a:null,root:null,player:null,starId:null,ready:false,ballShift:null,errors:0,lastError:null,camSet:false};
  window.AIBAFacetAvatar=state;

  /* ---------- 1. 加载模型本体（只在开关打开时才取） ---------- */
  {
    const s=document.createElement("script");
    s.src=new URL("facet-athlete.js",SELF).href+"?t="+Date.now();   // 不在 index.html 的版本号盖章范围内，每次取最新
    s.onload=()=>{state.F=window.AIBAFacet||null;};
    s.onerror=e=>{state.lastError=e;console.warn("[facet] 模型加载失败",e);};
    document.head.appendChild(s);
  }

  /* ---------- 2. 这位玩家要不要换、换成谁 ---------- */
  const k24=()=>{try{return (AIBA_CONFIG.CLASSIC_LEGENDS||[]).concat(AIBA_ASSETS.coverStars||[]).find(s=>s.id==="k24")||null;}catch(e){return null;}};
  function wantStar(){
    let star=null;try{star=typeof G!=="undefined"&&G?G.myStar:null;}catch(e){}
    if(!star)return k24();
    return ALL||(state.F&&state.F.TUNE&&state.F.TUNE[star.id])?star:null;   // 调过外貌的球星才换
  }
  /* 体素皮套对玩家让位：它每帧问一次"玩家该换成哪个体素角色"，这里接管的时候回答"不换" */
  {
    const kb=window.AIBAKobe;
    if(kb&&kb.slot&&typeof kb.slot.char==="function"){const orig=kb.slot.char;kb.slot.char=()=>(state.F&&wantStar())?null:orig();}
  }
  const guyNow=()=>typeof player!=="undefined"?player:null;
  const ballNow=()=>typeof pBall!=="undefined"?pBall:null;
  const holdingNow=b=>!!(b&&b.visible&&b.parent&&b.parent.name==="ballGrip");
  const airNow=()=>{try{return typeof P!=="undefined"&&P?Number(P.jump)||0:0;}catch(e){return 0;}};
  const passNow=()=>{try{if(typeof passing!=="undefined"&&passing&&passing.mesh){const k=G&&G.passCatch?Number(G.passCatch.progress)||0:0;return {mesh:passing.mesh,k};}}catch(e){}return null;};

  /* ---------- 3. 站姿骨架（真实尺寸 = 设计尺寸 × 球星身高系数 h） ---------- */
  const PARENT={spine:"pelvis",chest:"spine",head:"chest"};
  const JOINT={pelvis:"hips",spine:"spine",chest:"chest",head:"head"};
  for(const k of ["L","R"]){
    Object.assign(PARENT,{["upperArm"+k]:"chest",["foreArm"+k]:"upperArm"+k,["hand"+k]:"foreArm"+k,["thigh"+k]:"pelvis",["shin"+k]:"thigh"+k,["foot"+k]:"shin"+k});
    Object.assign(JOINT,{["upperArm"+k]:"sh"+k,["foreArm"+k]:"el"+k,["hand"+k]:"wr"+k,["thigh"+k]:"leg"+k,["shin"+k]:"kn"+k,["foot"+k]:"an"+k});
  }
  const ORDER=["pelvis","spine","chest","head","upperArmL","foreArmL","handL","upperArmR","foreArmR","handR","thighL","shinL","footL","thighR","shinR","footR"];
  function restOf(B,h){
    const H={},v=(x,y,z)=>new T.Vector3(x,y,z).multiplyScalar(h);
    H.pelvis=v(0,B.hipY,0);H.spine=v(0,B.hipY+B.spine,0);H.chest=v(0,B.hipY+B.spine+B.chest,0);H.head=v(0,B.hipY+B.spine+B.chest+B.neck,0);
    const shY=B.hipY+B.spine+B.chest+B.shY;
    for(const [k,s] of [["L",1],["R",-1]]){
      H["upperArm"+k]=v(s*B.shX,shY,0);H["foreArm"+k]=v(s*B.shX,shY-B.upArm,0);H["hand"+k]=v(s*B.shX,shY-B.upArm-B.foreArm,0);
      H["thigh"+k]=v(s*B.hipX,B.hipY,0);H["shin"+k]=v(s*B.hipX,B.hipY-B.thigh,0);H["foot"+k]=v(s*B.hipX,B.hipY-B.thigh-B.shin,0);
    }
    return H;
  }

  /* ---------- 4. 挂上 / 卸下 ---------- */
  function detach(){
    if(state.root&&state.root.parent)state.root.parent.remove(state.root);
    if(state.a&&state.a.dispose)try{state.a.dispose();}catch(e){}
    Object.assign(state,{a:null,root:null,player:null,starId:null,ready:false,ballShift:null});
    if(window.AIBAKobe)AIBAKobe.ballShift=null;
  }
  function tryAttach(){
    const F=state.F,guy=guyNow(),star=F?wantStar():null;
    if(!star||!guy){if(state.ready)detach();return;}
    if(!guy.g||!guy.handRoots||!guy.handRoots.length)return;
    if(state.ready&&state.player===guy&&state.starId===star.id)return;
    detach();
    const a=F.build(F.fromStar(star));a.ball.visible=false;
    const root=new T.Group();root.name="facetAvatar";root.add(a.root);
    root.traverse(o=>{o.userData.facet=true;o.frustumCulled=false;});
    guy.g.add(root);
    const h=a.rig.scale.x||1;
    const armIdx={},legIdx={};
    guy.arms.forEach((n,i)=>{armIdx[n.position.x<0?"R":"L"]=i;});
    guy.legs.forEach((n,i)=>{legIdx[n.position.x<0?"R":"L"]=i;});
    Object.assign(state,{a,root,player:guy,starId:star.id,ready:true,h,H:restOf(a.B||F.B,h),armIdx,legIdx,soleY:aibaSoleY(guy),holdW:undefined,tA:0});
    /* 和体素皮套一样：第一人称看不到自己，首次换上时切到第三人称 */
    if(!state.camSet&&typeof CAM!=="undefined"&&CAM.mode===0&&typeof setCameraMode==="function"){state.camSet=true;try{setCameraMode(1,{silent:true});}catch(e){}}
  }
  /* AIBA 鞋底在 footRoot 局部坐标里的最低点（量一次） */
  function aibaSoleY(P){
    let mn=0;const box=new T.Box3(),inv=new T.Matrix4();
    P.g.updateMatrixWorld(true);
    const f=P.footRoots[0];inv.copy(f.matrixWorld).invert();
    f.traverse(o=>{if(o.isMesh&&o.geometry&&!o.userData.facet){o.geometry.computeBoundingBox();box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);mn=Math.min(mn,box.min.y);}});
    return mn;
  }

  /* ---------- 5. 小工具 ---------- */
  const perp=(v,d)=>{const p=v.clone().addScaledVector(d,-v.dot(d));return p.lengthSq()>1e-8?p.normalize():null;};
  /* 朝向：局部 -Y 指向 dir（骨头往下长），局部 +Z 指向 fwd（已和 dir 垂直） */
  const _b=new T.Matrix4();
  const frame=(dir,fwd)=>{const y=dir.clone().negate(),x=new T.Vector3().crossVectors(y,fwd).normalize(),z=new T.Vector3().crossVectors(x,y);return new T.Quaternion().setFromRotationMatrix(_b.makeBasis(x,y,z));};
  /* 两骨 IK：S 根、G 目标、pole 中间关节（肘 / 膝）顶出去的方向。够不着时目标沿原方向收回来 */
  function twoBone(S,G,L1,L2,pole){
    const to=G.clone().sub(S);let d=to.length();
    if(d<1e-6){to.set(0,-1,0);d=1e-6;}else to.multiplyScalar(1/d);
    d=Math.min(Math.max(d,Math.abs(L1-L2)+.004),L1+L2-.002);
    const c=Math.min(1,Math.max(-1,(L1*L1+d*d-L2*L2)/(2*L1*d))),s=Math.sqrt(1-c*c);
    const p=perp(pole,to)||perp(new T.Vector3(0,0,1),to)||new T.Vector3(1,0,0);
    return {E:S.clone().addScaledVector(to,L1*c).addScaledVector(p,L1*s),G:S.clone().addScaledVector(to,d)};
  }
  const Z=()=>new T.Vector3(0,0,1);
  const BALL_R=.16;          // AIBA 球的建模半径
  const PALM_N=.022,PALM_F=.085;   // 球心相对手腕：掌面离骨轴、沿手指方向（设计尺寸）
  const HAND_CLEAR=.275;     // 垂手时手腕离中线的最小距离（短裤外沿约 .22）

  /* ---------- 6. 每次渲染前：重定向 + 球挪到切面球员手上 ---------- */
  const _m=new T.Matrix4(),_w=new T.Vector3();
  function retarget(){
    const P=state.player,H=state.H,h=state.h,J=state.a.joints,ball=ballNow();
    const g=P.g;g.updateWorldMatrix(true,true);
    const gInv=_m.copy(g.matrixWorld).invert();
    /* AIBA 按球星体型给 g 做不等比缩放（落地挤压、左手球员镜像也在这上面）。这一层反向抵消，
       从 AIBA 读来的位置一律乘回缩放，在"没镜像的 g 局部空间"里按真实尺寸算 */
    const Sc=new T.Vector3(Math.abs(g.scale.x),Math.abs(g.scale.y),Math.abs(g.scale.z));
    const loc=n=>new T.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(gInv).multiply(Sc);
    const _rm=new T.Matrix4(),_rp=new T.Vector3(),_rs=new T.Vector3();
    const rot=n=>{const q=new T.Quaternion();_rm.multiplyMatrices(gInv,n.matrixWorld).decompose(_rp,q,_rs);return q;};
    const Q={},Pp={};

    /* 蓄力下蹲：AIBA 的 g 绕脚底前倾，上身会被整条甩到脚尖前面。骨盆往后坐、脊柱反向补回来，
       头 - 髋 - 脚踝保持在一条垂线附近（和体素皮套同一套补偿） */
    const air=airNow(),groundK=Math.max(0,1-Math.min(1,air/.05));
    const isMoving=!!(P.walking||P.running||(typeof G!=="undefined"&&G&&G.moving));
    const ud=g.userData||{};
    const shotLoad=(!isMoving&&Number(ud.shotLoad))||0,readyBlend=(!isMoving&&Number(ud.shotReadyLowerBlend))||0;
    const kneeBend=Math.max(0,P.knees&&P.knees[0]?P.knees[0].rotation.x:0,P.knees&&P.knees[1]?P.knees[1].rotation.x:0);
    const loadK=groundK*Math.max(0,Math.min(1,shotLoad>0?shotLoad:(readyBlend>0?readyBlend:(isMoving?0:kneeBend/.95))));
    const tilt=-g.rotation.x;
    Pp.pelvis=H.pelvis.clone();
    if(loadK>.001){Pp.pelvis.z+=(-.065*loadK-H.pelvis.y*Math.sin(tilt))/Math.max(.7,Math.cos(tilt));Pp.pelvis.y+=-.035*loadK;}
    const chain=(name,q)=>{Q[name]=q;const p=PARENT[name];Pp[name]=Pp[p].clone().add(H[name].clone().sub(H[p]).applyQuaternion(Q[p]));};

    /* 躯干：读 AIBA 胸腔这一帧的朝向，按 骨盆 15% / 腰 53% / 胸 100% 分到三节上 */
    const shell=g.children.find(n=>n.name==="jerseyShell");
    const qT=shell?rot(shell):new T.Quaternion(),I0=new T.Quaternion();
    const qPel=I0.clone().slerp(qT,.15),qSp=I0.clone().slerp(qT,.53),qCh=qT.clone();
    if(loadK>.001&&tilt>.02){
      const ct=Math.max(0,tilt-.04)*loadK,X=new T.Vector3(1,0,0),ax=k=>new T.Quaternion().setFromAxisAngle(X,-ct*k);
      qPel.multiply(ax(.4));qSp.multiply(ax(.45));qCh.multiply(ax(.15));
    }
    Q.pelvis=qPel;chain("spine",qSp);chain("chest",qCh);
    chain("head",P.headRoot?rot(P.headRoot):qCh.clone());

    /* 腿：脚踝跟着 AIBA 脚踝的落点走，两骨 IK 反解膝盖。切面球员腿比 AIBA 长，照抄关节角度脚会迈太远 */
    for(const [sd,s] of [["L",1],["R",-1]]){
      const l=state.legIdx[sd],it="thigh"+sd,is="shin"+sd,ifo="foot"+sd;
      chain(it,Q.pelvis.clone());
      const hipK=Pp[it].clone(),hipA=loc(P.legs[l]),kneeA=loc(P.knees[l]),ankA=loc(P.ankles[l]);
      const tg=ankA.clone();tg.x+=s*(H[ifo].x*s-.125);tg.y+=H[ifo].y-.12*Sc.y;
      const L1=H[is].distanceTo(H[it]),L2=H[ifo].distanceTo(H[is]);
      const fwT=Z().applyQuaternion(rot(P.legs[l])),fwS=Z().applyQuaternion(rot(P.knees[l]));
      const pole=kneeA.clone().sub(hipA.clone().add(ankA).multiplyScalar(.5)).addScaledVector(fwT,.03);
      const k=twoBone(hipK,tg,L1,L2,pole);
      const d1=k.E.clone().sub(hipK).normalize(),d2=k.G.clone().sub(k.E).normalize();
      const f1=perp(fwT,d1)||perp(d2.clone().negate(),d1)||Z(),f2=perp(fwS,d2)||f1;
      Q[it]=frame(d1,f1);Q[is]=frame(d2,f2);Pp[is]=k.E.clone();
      Q[ifo]=rot(P.footRoots[l]);Pp[ifo]=k.G.clone();
    }

    /* 手臂：球不在手里时复制 AIBA 手臂的方向和伸展比例（不照搬位置，两套骨架肩宽、臂长不同）；
       持球时两只手和球整体平移同一个量，AIBA 调好的双手 - 球关系原样保留。0.15s 平滑切换 */
    const now=performance.now(),dtA=Math.min(.1,Math.max(0,(now-(state.tA||now))/1000));state.tA=now;
    const holding=holdingNow(ball);
    state.holdW=(state.holdW??(holding?1:0))+((holding?1:0)-(state.holdW??0))*Math.min(1,dtA/.15);
    const hw=state.holdW*state.holdW*(3-2*state.holdW);
    const arm={};
    for(const sd of ["L","R"]){
      const a=state.armIdx[sd],iu="upperArm"+sd;
      const S0=Pp.chest.clone().add(H[iu].clone().sub(H.chest).applyQuaternion(Q.chest));
      arm[sd]={a,S0,Sa:loc(P.arms[a]),Ea:loc(P.elbows[a]),Wa:loc(P.handRoots[a])};
    }
    const holdShift=arm.L.S0.clone().sub(arm.L.Sa).add(arm.R.S0.clone().sub(arm.R.Sa)).multiplyScalar(.5);
    const inShot=!isMoving&&(holding||(typeof G!=="undefined"&&G&&(G.charging||G.shooting)));
    const target=(sd,extra)=>{
      const {S0,Sa,Ea,Wa}=arm[sd],s=sd==="L"?1:-1,iu="upperArm"+sd,ifo="foreArm"+sd,ih="hand"+sd;
      const La=Ea.distanceTo(Sa)+Wa.distanceTo(Ea),Lk=H[ifo].distanceTo(H[iu])+H[ih].distanceTo(H[ifo]);
      const free=S0.clone().addScaledVector(Wa.clone().sub(Sa).normalize(),Math.min(.995,Wa.distanceTo(Sa)/La)*Lk);
      const low=Math.min(1,Math.max(0,(1.22-free.y)/.2))*Math.max(0,1-Math.abs(free.z)/.28);
      if(low>0&&s*free.x<HAND_CLEAR)free.x=s*(s*free.x+(HAND_CLEAR-s*free.x)*low);
      const held=Wa.clone().add(holdShift).add(extra||new T.Vector3());
      const high=inShot?Math.max(0,Math.min(1,(Wa.y-1.15)/.25)):0;
      return free.lerp(held,Math.max(hw,high));
    };
    const pole=sd=>{const {Sa,Ea,Wa}=arm[sd];const p=Ea.clone().sub(Sa.clone().add(Wa).multiplyScalar(.5));return p.lengthSq()>1e-6?p:new T.Vector3(sd==="L"?.3:-.3,-.2,-1);};
    const solveArm=(sd,tg)=>{
      const iu="upperArm"+sd,ifo="foreArm"+sd,ih="hand"+sd,{S0,a}=arm[sd];
      const fwU=Z().applyQuaternion(rot(P.arms[a])),fwF=Z().applyQuaternion(rot(P.elbows[a]));
      const k=twoBone(S0,tg,H[ifo].distanceTo(H[iu]),H[ih].distanceTo(H[ifo]),pole(sd));
      const d1=k.E.clone().sub(S0).normalize(),d2=k.G.clone().sub(k.E).normalize();
      const f1=perp(fwU,d1)||perp(d2,d1)||Z(),f2=perp(fwF,d2)||f1;
      Q[iu]=frame(d1,f1);Pp[iu]=S0.clone();Q[ifo]=frame(d2,f2);Pp[ifo]=k.E.clone();Pp[ih]=k.G.clone();
      /* 手：朝向照抄 AIBA 的手（两边都是手指 -Y、掌心 -Z）。压腕超过 50° 的部分只取六成，不折成直角 */
      const qA=rot(P.handRoots[a]),rel=Q[ifo].clone().invert().multiply(qA),ang=2*Math.acos(Math.min(1,Math.abs(rel.w)));
      const keep=ang>.87?(.87+(ang-.87)*.6)/ang:1;
      Q[ih]=Q[ifo].clone().multiply(new T.Quaternion().slerp(rel,keep));
      return {G:k.G,qA};
    };
    const R=solveArm("R",target("R"));
    let ballDelta=new T.Vector3(),ballK=null;
    if(holding&&ball){
      const br=BALL_R*Math.max(ball.scale.x,.01);
      /* 掌心 / 指尖方向用 AIBA 手本身的朝向，不用放缓过的手：出手前手臂快速伸直时球不会跟着横跳 */
      const N=new T.Vector3(0,0,-1).applyQuaternion(R.qA),Fd=new T.Vector3(0,-1,0).applyQuaternion(R.qA);
      ballK=R.G.clone().addScaledVector(N,br+PALM_N*h).addScaledVector(Fd,PALM_F*h);
      const grip=P.ballGrips&&P.ballGrips[arm.R.a];
      if(grip)ballDelta=ballK.clone().sub(loc(grip).add(holdShift));
    }
    const tL=target("L",ballDelta.clone().multiplyScalar(hw));
    if(hw>.05||(!isMoving&&holding)){   // 辅助手不越过投篮手，两手不重叠
      if(tL.x<R.G.x+.06)tL.x=R.G.x+.06;
      if(tL.distanceTo(R.G)<.10){const push=tL.clone().sub(R.G);if(push.x<.05)push.x=.05;push.normalize();tL.copy(R.G).addScaledVector(push,.10);}
    }
    solveArm("L",tL);

    /* 贴地：切面球员鞋底最低点对齐地板；腾空时跟 AIBA 的鞋底高度走，但不低于地板 */
    let ours=9,theirs=9;
    const B=state.a.B||state.F.B,sy=-B.ankle*h;
    for(const sd of ["L","R"]){
      const f="foot"+sd;
      for(const dx of [-.045,.045])for(const z of [-.09,.02,.13,.25]){const p=new T.Vector3(dx*h,sy,z*h).applyQuaternion(Q[f]).add(Pp[f]);ours=Math.min(ours,p.y);}
      const fa=P.footRoots[state.legIdx[sd]];
      for(const dx of [-.08,.08])for(const z of [-.12,.2]){const p=new T.Vector3(dx,state.soleY,z).applyMatrix4(fa.matrixWorld).applyMatrix4(gInv);theirs=Math.min(theirs,p.y*Sc.y);}
    }
    const floor=-g.position.y,off=(air>.03?Math.max(theirs,floor):floor)-ours;

    /* 写回关节：层级骨架，局部朝向 = 父朝向⁻¹ × 自己的朝向；位置只有骨盆要写 */
    for(const name of ORDER){const p=PARENT[name],j=J[JOINT[name]];
      if(p)j.quaternion.copy(Q[p]).invert().multiply(Q[name]);else j.quaternion.copy(Q[name]);}
    J.hips.position.copy(Pp.pelvis).divideScalar(h);
    state.a.rig.position.set(0,off,0);
    state.root.scale.set(1/Sc.x,1/Sc.y,1/Sc.z);
    state.root.updateMatrixWorld(true);

    /* 手里的球：挪到切面球员的投篮手上，AIBA 出手从这里读 */
    if(ball){
      const grip=P.ballGrips&&P.ballGrips[arm.R.a];
      if(grip&&ball.parent===grip){
        const t=ballK?ballK.clone():loc(grip).add(R.G.clone().sub(arm.R.Wa));t.y+=off;t.divide(Sc);
        _w.copy(t).applyMatrix4(g.matrixWorld);
        state.ballShift=_w.clone().sub(new T.Vector3().setFromMatrixPosition(grip.matrixWorld));
        if(window.AIBAKobe)AIBAKobe.ballShift=state.ballShift;   // 回放读这个字段把球对到画面上的手
        ball.position.copy(_w.applyMatrix4(_m.copy(grip.matrixWorld).invert()));
      }
    }
  }

  /* ---------- 7. 渲染钩子：藏 AIBA 方块网格（地面软影、手里的球除外），渲染完恢复 ---------- */
  const hidden=[];
  function hideAIBA(){
    const g=state.player.g,ball=ballNow();
    const walk=o=>{
      if(o.userData.facet||o===state.root)return;
      if(ball&&o===ball)return;
      if((o.isMesh||o.isLine||o.isPoints)&&o.visible&&o.userData.groundShadowBaseOpacity==null){o.visible=false;hidden.push(o);}
      for(const c of o.children)walk(c);
    };
    for(const c of g.children)walk(c);
  }
  function restoreAIBA(){for(const o of hidden)o.visible=true;hidden.length=0;}
  const visibleInScene=o=>{for(;o;o=o.parent){if(!o.visible)return false;if(o.isScene)return true;}return false;};
  /* 球和人的比例：游戏的球半径 0.16（直径 32cm，篮筐也按它放大过），拿在 2m 的写实球员手里比头大一圈半。
     只改画面、不碰物理：手里的球画成 BALL_VIS 倍（直径 25cm）；出手后随着离人远去长回原大，到篮筐时和筐的比例还是对的。渲染完恢复 */
  const BALL_VIS=.78,_bp=new T.Vector3(),_gp=new T.Vector3();
  function shrinkBalls(){
    const out=[],g=state.player.g,held=ballNow();
    const set=(m,k)=>{if(!m||!m.scale||k>.999)return;out.push([m,m.scale.clone()]);m.scale.multiplyScalar(k);};
    if(held)set(held,BALL_VIS);
    try{
      if(typeof balls!=="undefined"&&balls.length){
        g.getWorldPosition(_gp);
        for(const b of balls){if(!b||!b.mesh||b.mesh===held)continue;
          b.mesh.getWorldPosition(_bp);const d=Math.hypot(_bp.x-_gp.x,_bp.z-_gp.z),t=Math.min(1,Math.max(0,(d-.8)/3.2));
          set(b.mesh,BALL_VIS+(1-BALL_VIS)*t*t*(3-2*t));}
      }
    }catch(e){}
    /* 球架上的球一起缩（不然手里的比架子上的小一圈），缩完往下落回架子的滑轨上 */
    try{
      const drop=(m)=>{if(!m||!m.visible||!m.scale)return;const r0=BALL_R*m.scale.y;out.push([m,m.scale.clone(),m.position.y]);m.scale.multiplyScalar(BALL_VIS);m.position.y-=r0*(1-BALL_VIS);};
      if(typeof rackBalls!=="undefined")for(const r of rackBalls)if(r)for(const m of r)drop(m);
      if(typeof deepBalls!=="undefined")for(const m of deepBalls)drop(m);
    }catch(e){}
    return out;
  }
  function hookRenderer(){
    const svc=window.AIBA&&AIBA.runtime&&AIBA.runtime.service&&AIBA.runtime.service("rendering:core");
    const R=(svc&&svc.renderer)||(typeof renderer!=="undefined"?renderer:null);
    if(!R||R.__facet){if(!R)setTimeout(hookRenderer,200);return;}
    R.__facet=true;const orig=R.render.bind(R);
    R.render=function(sc,cam){
      if(!state.F)return orig(sc,cam);
      const mirror=sc&&sc.scale&&sc.scale.y<0;   // 地板倒影那一遍沿用正常那一遍算好的关节
      if(!mirror)try{tryAttach();}catch(e){state.lastError=e;state.errors++;if(!state.warned){state.warned=true;console.warn("[facet] 挂载出错",e);}}
      if(!(state.ready&&state.player&&state.player.g&&visibleInScene(state.player.g)))return orig(sc,cam);
      const shrunk=shrinkBalls();   // 先缩球再重定向：掌心到球心的距离按缩过的半径算，手才贴得住球
      if(!mirror)try{retarget();}catch(e){state.lastError=e;state.errors++;if(!state.warned){state.warned=true;console.warn("[facet] 重定向出错",e);}}
      hideAIBA();
      let moved=null;
      try{const p=state.ballShift&&passNow();if(p){const e=p.k*p.k*(3-2*p.k);moved=[p.mesh,p.mesh.position.clone()];p.mesh.position.addScaledVector(state.ballShift,e);}}catch(e){}
      try{return orig(sc,cam);}finally{restoreAIBA();if(moved)moved[0].position.copy(moved[1]);for(const r of shrunk){r[0].scale.copy(r[1]);if(r[2]!=null)r[0].position.y=r[2];}}
    };
  }
  hookRenderer();
})();
