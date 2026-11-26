/* 写实蒙皮皮套(试验):选中 MODELS 里登记的球星(star8、star1、star15、star30)时,把画面上的身体换成对应的 glb
   (Mixamo 规范绑骨,65 根骨骼,自带一条 run 动画)。每个球星用自己的模型,互不混用。
   其他球星完全不经过这里;?tripo=1 可以强制任何球星都换成 star8(只为调试)。

   做法和 kobe-avatar.js / facet-avatar.js 同一路数:AIBA 的 player 照常创建、照常被动作系统驱动,
   每次渲染前读它各节点的位置和朝向,套到这副骨骼上,渲染时把 AIBA 自己的方块网格藏起来。不同的地方:
     · 这是单张蒙皮网格,不是刚性分段 —— 上臂/大腿除了对准方向,还要绕自身拧到"肘/膝弯折面"上,否则关节处会拧麻花
     · 手臂比 AIBA 短约 17%、肩更窄更高 —— 手臂按"方向 + 伸展比例"复制,球跟着这副手走,不照搬位置
     · 跑动不走 AIBA 的 poseRunCycle,改放模型自带的 run 动画,相位按实际位移推进(脚不打滑)
     · 第一人称不强制切第三人称:另建一张只含前臂和手的蒙皮网格,替掉 fpSharedPoseRig 的方块手 */
(function(){
  "use strict";
  /* 每个写实球星一条:glb 文件,和模型"面朝哪边"(Tripo 导出的 star8 面朝 +X,Mixamo 绑的 star1 面朝 +Z) */
  const MODELS={
    star8:{file:"star8.glb",yaw:-Math.PI/2},
    /* star1:4.8 万面高模,先焊接重复顶点再减到 1.45 万面(直接减会在脸和衣褶里撕出缝),权重从 Mixamo 绑好的版本转过来 */
    star1:{file:"star1.glb",yaw:0},
    star15:{file:"star15.glb",yaw:0},
    /* star30:混元生成的 4.9 万面静态模型,先焊接重复顶点再减到 1.48 万面,Mixamo 绑骨(护齿是独立碎片,单独拿出来再并回) */
    star30:{file:"star30.glb?v=9378581b22",look:true,yaw:0},
    /* star3 / star30b:混元生成的 4.9 万面静态模型,焊接后减到 1.5 万面,Mixamo 绑骨,权重落到减面网格上;
       跑动沿用 star30 的 24 帧原地版本(按世界旋转差重映射到各自骨架) */
    star3:{file:"star3.glb",yaw:0},
    star30b:{file:"star30b.glb?v=6459b67a97",look:true,yaw:0},
    /* cat1:猫吉祥物,混元生成 → 焊接减面 1.5 万面 → Mixamo 绑骨(用 Mixamo 自带的 run,20 帧);
       握拳手只有食指链,游戏要量掌心方向,所以补了一根不带权重的 HandMiddle1 */
    cat1:{file:"cat1.glb",yaw:0},
    /* husky:哈士奇(凯尔特人),混元生成 → 1.5 万面 → Mixamo 绑骨;哈士奇没有现成的 run,跑动借用猫的 20 帧 run(骨名一致) */
    husky:{file:"husky.glb",yaw:0},
    /* nvidia23:混元 5 万面减至 1.8 万面 → Mixamo 绑骨(33 骨 + 补齐 HandMiddle1 → 35 骨),自带 Slow Run 原地跑动循环 + 科比视频转 3D 跳投动作 */
    nvidia23:{file:"nvidia23.glb?v=ff9a83a316",look:true,yaw:0,shotClip:"nvidia23_kb_shot.json"},
    /* mushroom:魔性金发蘑菇头舞王,Colab 混元生成 → 减面 1.6 万面 → 自动移植 Mixamo 35 骨骨架 + 原视频提取魔性蘑菇舞 */
    mushroom:{file:"mushroom.glb",yaw:0}
  };
  const QS=new URLSearchParams(location.search),FORCE=QS.get("tripo")==="1";
  if(QS.get("tripo")==="0")return;
  const T=THREE;
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const urlOf=id=>new URL("../../assets/models/"+MODELS[id].file,SELF).href;
  const shotClipUrl=file=>new URL("../../assets/dance/"+file,SELF).href;
  const SHOT_CLIP_CACHE={};
  function getShotClip(file){
    if(!file)return null;
    const hit=SHOT_CLIP_CACHE[file];
    if(hit)return hit.ready?hit.data:null;
    const entry=SHOT_CLIP_CACHE[file]={ready:false,loading:true,data:null};
    fetch(shotClipUrl(file)).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(j=>{
      entry.data=j;entry.ready=true;entry.loading=false;
    }).catch(()=>{entry.loading=false;});
    return null;
  }
  const _shotQ=new Float32Array(22*4);
  function sampleShotClip(clip,frame,out){
    if(!clip||!clip.q||!clip.n)return false;
    const f=Math.max(0,Math.min(clip.n-1,frame));
    const i=Math.min(clip.n-2,Math.floor(f)),k=f-i;
    const A=clip.q[i],B=clip.q[i+1];
    for(let b=0;b<22;b++){
      const o=b*4;
      let ax=A[o],ay=A[o+1],az=A[o+2],aw=A[o+3],bx=B[o],by=B[o+1],bz=B[o+2],bw=B[o+3];
      let d=ax*bx+ay*by+az*bz+aw*bw;
      if(d<0){bx=-bx;by=-by;bz=-bz;bw=-bw;d=-d;}
      let s0,s1;
      if(d>.9995){s0=1-k;s1=k;}
      else{const th=Math.acos(d),sn=Math.sin(th);s0=Math.sin((1-k)*th)/sn;s1=Math.sin(k*th)/sn;}
      const x=s0*ax+s1*bx,y=s0*ay+s1*by,z=s0*az+s1*bz,w=s0*aw+s1*bw,inv=1/Math.hypot(x,y,z,w);
      out[o]=x*inv;out[o+1]=y*inv;out[o+2]=z*inv;out[o+3]=w*inv;
    }
    return true;
  }
  const URL_LOADER=new URL("../../vendor/GLTFLoader.r128.js",SELF).href;
  /* 热身舞蹈(presentation/dance.js)的 22 根主骨骼,顺序和 dances.json 的 q 一致(父在前) */
  const DANCE_BONES=["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"];
  const HEIGHT=1.84;                 // 游戏单位。AIBA 方块人约 1.8
  const BALL_R=.16,BALL_VIS=.78;     // 游戏球半径 0.16 偏大;手里的球只在画面上缩到 0.78(和切面皮套一致),不碰物理
  const SHOT_WRIST_LIMIT=Math.PI/4;
  const SHOT_AIR={
    star30:{hip:.10,chest:.15,lean:.055,roll:.025},
    star8:{hip:.18,chest:.23,lean:.145,roll:.045},
    nvidia23:{hip:.18,chest:.23,lean:.145,roll:.045},
    mushroom:{hip:.14,chest:.18,lean:.08,roll:.03},
    star1:{hip:.10,chest:.17,lean:.083,roll:.021},
    // 15 号跟随汤普森的主骨架胸腔，写实层只补轻微开髋。
    star15:{hip:.045,chest:0,lean:0,roll:0}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{const k=clamp(v,0,1);return k*k*(3-2*k);};
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const sceneNow=()=>typeof scene!=="undefined"?scene:null;
  const holdingNow=b=>!!(b&&b.visible&&b.parent&&b.parent.name==="ballGrip");
  /* 热身演示(presentation/pregame.js)直接抬 g.y 做起跳/扣篮,P.jump 不动:它把这一帧的离地高度记在 guy.pregameLift 上 */
  const pregameLift=g=>{try{return g&&g.pregameLift>0?g.pregameLift:0;}catch(e){return 0;}};
  const ALL=[];   // 所有实例(玩家 + 对手),斗屏转播那一遍要给每个都打标记

  /* 一个实例 = 一个球员的皮套。role:"player" 读玩家自己(球 pBall、起跳 P.jump、第一人称),
     "rival" 读 rivals[idx](球 guy.ball、起跳从 poseGuy 记下的落差算、没有第一人称/传球/世界球缩放)。
     两个实例各有各的骨骼表和过渡状态,互不干扰。 */
  function create(role,idx){
    const cfg=role==="player"?{player:true,world:true}:{player:false,world:false};
    const state={ballAlong:.07,ballLift:.015,holdCurl:.32,elbowOut:.9,crouchExtra:.1,landGain:.9,landTau:.11,landV:0,landT:null,ready:false,loading:false,failed:false,errors:0,lastError:null,ballShift:null,runW:0,phase:0,holdW:0,armHold:0,aux:0,role:role};

    const rivalGuy=()=>{try{return typeof rivals!=="undefined"&&rivals[idx]||null;}catch(e){return null;}};
    const wantId=role==="player"
      ?()=>{if(state.off)return null;try{const id=typeof G!=="undefined"&&!!G&&!!G.myStar&&G.myStar.id;if(id&&MODELS[id])return id;}catch(e){}return FORCE?"star8":null;}
      :()=>{if(state.off)return null;try{const rv=rivalGuy();if(!rv||!rv.active)return null;const o=rv.o||(G.opponents&&G.opponents[idx])||(idx===0?G.battleOpp||G.finalist:null);return o&&MODELS[o.id]?o.id:null;}catch(e){return null;}};
    const guyNow=role==="player"?()=>typeof player!=="undefined"?player:null:rivalGuy;
    const ballNow=role==="player"?()=>typeof pBall!=="undefined"?pBall:null:()=>{const g=rivalGuy();return g&&g.ball||null;};
    const fpBallNow=role==="player"?()=>typeof handBall!=="undefined"?handBall:null:()=>null;
    /* 起跳高度:玩家有 P.jump;对手没有,但 poseGuy 每帧记下了"站姿高度"和时间,驱动方再往 g.y 上加的就是起跳 */
    const airNow=role==="player"
      ?()=>{try{const g=typeof player!=="undefined"?player:null;return Math.max(typeof P!=="undefined"&&P?Number(P.jump)||0:0,pregameLift(g));}catch(e){return 0;}}
      :()=>{try{const g=rivalGuy();const pl=pregameLift(g);if(pl>0)return pl;if(!g||!g.g||g.poseYRet==null||!(Math.abs((G.tNow||0)-(g.poseT||0))<.12))return 0;return Math.max(0,g.g.position.y-g.poseYRet);}catch(e){return 0;}};
    const movingNow=role==="player"
      ?(guy,dt)=>{try{return !!(guy.walking||guy.running||guy.shotRecovery?.active||(typeof P!=="undefined"&&P&&P.walking)||(typeof G!=="undefined"&&G&&G.moving))||slidingNow(guy,dt);}catch(e){return false;}}
      :(guy,dt)=>{try{return !!(guy.walking||guy.running)||slidingNow(guy,dt);}catch(e){return false;}};
    /* 热身演示/庆祝里人物移动时(助跑、狂奔、走向篮筐):按位移速度与 running 标志同步触发真实跑步动画，不再脚底飘移 */
    const slidingNow=(guy,dt)=>{try{if(guy._noSlideRun||state.prevX==null||!(dt>0))return false;const p=guy.g.position;return Math.hypot(p.x-state.prevX,p.z-state.prevZ)/dt>.45;}catch(e){return false;}};
    const catchNow=role==="player"?()=>{try{return !!(G.passCatch&&G.passCatch.active)||Number(G.pickupReach)>0;}catch(e){return false;}}:()=>false;
    const passNow=role==="player"?()=>{try{if(typeof passing!=="undefined"&&passing&&passing.mesh&&passing.mesh.visible){const k=passing.pickup?(Number(passing.kb)||0):(G&&G.passCatch?Number(G.passCatch.progress)||0:0);return {mesh:passing.mesh,k};}}catch(e){}return null;}:()=>null;
    /* ---------- 1. 加载(第一次需要时才取) ---------- */
    function load(id){
      if(state.loading||state.root||state.failed)return;
      state.loading=true;state.loadId=id;
      const fail=e=>{state.failed=true;state.loading=false;state.lastError=e;console.warn("[tripo] 模型加载失败",e);};
      const go=()=>new T.GLTFLoader().load(urlOf(id),g=>{try{build(g,id);}catch(e){fail(e);}state.loading=false;},undefined,fail);
      if(T.GLTFLoader)return go();
      const s=document.createElement("script");s.src=URL_LOADER;s.onload=go;s.onerror=fail;document.head.appendChild(s);
    }

    /* ---------- 2. 骨架工具 ----------
       重定向期间 root.matrix 是单位阵,所以骨骼的"世界坐标"就是角色自己的空间:面朝 +Z、头顶 +Y、左手 +X、真实尺寸。
       使用预分配对象池(TV/TQ)消除每帧 200+ 次临时 Vector3/Quaternion 分配导致的手机端 GC 卡顿。 */
    const B={},restL={},restP={},restW={},restWinv={},restPos={};
    const _vPool=Array.from({length:256},()=>new T.Vector3());
    const _qPool=Array.from({length:128},()=>new T.Quaternion());
    let _vPtr=0,_qPtr=0;
    const TV=(x,y,z)=>{const v=_vPool[_vPtr=(_vPtr+1)&255];return v.set(x||0,y||0,z||0);};
    const TQ=()=>{const q=_qPool[_qPtr=(_qPtr+1)&127];return q.identity();};
    const _q=new T.Quaternion(),_pq=new T.Quaternion(),_m=new T.Matrix4(),_v=new T.Vector3();
    const wpos=(n,out)=>{const b=B[n],t=out||TV();return t.setFromMatrixPosition(b.matrixWorld);};
    function setW(bone,qw){bone.parent.getWorldQuaternion(_pq);bone.quaternion.copy(_pq.invert()).multiply(qw);bone.updateMatrixWorld(true);}
    const perp=(v,d)=>{const p=TV().copy(v).addScaledVector(d,-v.dot(d));return p.lengthSq()>1e-8?p.normalize():null;};
    function aim(name,child,dir){
      const cur=wpos(child).sub(wpos(name)).normalize();
      _q.setFromUnitVectors(cur,dir);const qw=TQ().copy(_q).multiply(B[name].getWorldQuaternion(TQ()));setW(B[name],qw);
    }
    const basisQ=(f,n)=>{const s=TV().crossVectors(f,n);return TQ().setFromRotationMatrix(_m.makeBasis(f,n,s));};
    const signedAngle=(a,b,axis)=>Math.atan2(axis.dot(TV().crossVectors(a,b)),a.dot(b));
    /* 两骨 IK。bend:静止姿势下这个关节弯起来时末端摆向哪边(手臂 +Z,腿 -Z)——用来把上段骨头拧到弯折面上 */
    function solveLimb(L,target,pole){
      const s=wpos(L.up),d=TV().copy(target).sub(s);let dist=d.length();
      if(dist<1e-6){d.set(0,-1,0);dist=1e-6;}else d.multiplyScalar(1/dist);
      dist=clamp(dist,Math.abs(L.l1-L.l2)+.004,(L.l1+L.l2)*.998);
      const x=(L.l1*L.l1-L.l2*L.l2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,L.l1*L.l1-x*x));
      const p=perp(pole,d)||perp(TV(0,0,1),d)||TV(1,0,0);
      const elbow=TV().copy(s).addScaledVector(d,x).addScaledVector(p,h),wrist=TV().copy(s).addScaledVector(d,dist);
      const d1=TV().copy(elbow).sub(s).normalize();
      aim(L.up,L.fore,d1);
      const wantB=perp(TV().copy(wrist).sub(elbow),d1);
      if(wantB&&h>.015){
        const q=B[L.up].getWorldQuaternion(TQ());
        const cur=perp(TV().copy(L.bend).applyQuaternion(TQ().copy(q).multiply(restWinv[L.up])),d1);
        if(cur){const ang=signedAngle(cur,wantB,d1)*clamp(h/(.22*L.l1),0,1);setW(B[L.up],TQ().setFromAxisAngle(d1,ang).multiply(q));}
      }
      aim(L.fore,L.hand,TV().copy(wrist).sub(wpos(L.fore)).normalize());
      return wrist;
    }
    /* 限制前臂到掌骨的夹角。掌向和指向共用同一旋转，球心由修正后的掌坐标重新求出。 */
    function shootingWrist(A,f,n,limit){
      A.F.copy(f);A.N.copy(n);
      const fore=wpos(A.L.hand).sub(wpos(A.L.fore)).normalize();
      const bend=fore.angleTo(f);
      if(bend<=limit)return;
      const axis=TV().crossVectors(f,fore);
      if(axis.lengthSq()<1e-8)axis.copy(n);
      const q=TQ().setFromAxisAngle(axis.normalize(),bend-limit);
      A.F.applyQuaternion(q);A.N.applyQuaternion(q);
    }
    /* 皮套腕位经过持球补偿后仍要符合出手方向与肘部余量。以世界向上为准，
       让躯干后仰、侧倾时也能读到同一个肩腕仰角。 */
    function releaseWristTarget(A,target,form,weight,up){
      if(!weight)return target;
      const reach=TV().copy(target).sub(A.S0),distance=reach.length();
      const height=reach.dot(up),horizontal=reach.addScaledVector(up,-height);
      const elevation=Math.atan2(height,horizontal.length());
      const aim=TV(0,0,1).addScaledVector(up,-up.z).normalize();
      horizontal.normalize().lerp(aim,weight*.65);
      if(horizontal.lengthSq()<1e-8)horizontal.copy(aim);
      else horizontal.normalize();
      const angle=elevation+(form.releaseArmAngle*Math.PI/180-elevation)*weight;
      const {l1,l2}=A.L,flex=form.releaseElbowFlex*Math.PI/180;
      const releaseReach=Math.sqrt(l1*l1+l2*l2+2*l1*l2*Math.cos(flex));
      const length=distance+(releaseReach-distance)*weight;
      return horizontal.multiplyScalar(length*Math.cos(angle)).addScaledVector(up,length*Math.sin(angle)).add(A.S0);
    }
    const LIMB={};
    const FINGERS=["Index","Middle","Ring","Pinky"],FEET=["LeftFoot","RightFoot","LeftToeBase","RightToeBase","LeftToe_End","RightToe_End"];
    const footMin=()=>{let m=Infinity;for(const n of FEET)if(B[n]){wpos(n,_v);if(_v.y<m)m=_v.y;}return m;};
    function resetPose(){for(const n in B){B[n].quaternion.copy(restL[n]);}B.Hips.position.copy(restP.Hips);}
    function curlFingers(sideName,L,rad){
      _q.setFromAxisAngle(L.curlAxis,rad);
      for(const fn of FINGERS)for(let i=1;i<=3;i++){const n=sideName+"Hand"+fn+i,b=B[n];if(!b)continue;
        b.quaternion.copy(restL[n]).multiply(restWinv[n]).multiply(_q).multiply(restW[n]);}
      const hb=B[sideName+"Hand"];
      if(hb)hb.updateMatrixWorld(true);
    }

    /* 手指不能插进球里。量的是食/中/无名/小指和拇指的第 2~4 节骨点到球心的距离(骨点在手指中心线上,
       指肚贴球时骨点会在球面里 ~1cm,所以留 REST 的余量)。先少握一点(二分),伸直了还是插进去就把手整体往外推(只推辅助手;
       投篮手的手掌是贴着球定的,伸直了也插进去就保持伸直)。 */
    const FNAMES={Left:[],Right:[]};
    for(const sd of ["Left","Right"]){for(const f of FINGERS)for(let i=2;i<=4;i++)FNAMES[sd].push(sd+"Hand"+f+i);for(let i=2;i<=4;i++)FNAMES[sd].push(sd+"HandThumb"+i);}
    const _fv=new T.Vector3(),_clearP=new T.Vector3(),_clearOut={w:1e9,p:null};
    function clearOf(side,c,r){
      let w=1e9,hasP=false;
      const list=FNAMES[side];
      for(let i=0;i<list.length;i++){
        const b=B[list[i]];if(!b)continue;
        _fv.setFromMatrixPosition(b.matrixWorld);
        const d=_fv.distanceTo(c)-r;
        if(d<w){w=d;hasP=true;_clearP.copy(_fv);}
      }
      _clearOut.w=w;_clearOut.p=hasP?_clearP:null;
      return _clearOut;
    }
    function fitFingers(side,L,c,r,rad0,push){
      const REST=.012;
      const maxIt=push?2:1;
      for(let it=0;it<maxIt;it++){
        curlFingers(side,L,rad0);let o=clearOf(side,c,r);if(o.w>=-REST)return;
        curlFingers(side,L,0);o=clearOf(side,c,r);
        if(o.w>=-REST){let lo=0,hi=rad0;for(let k=0;k<4;k++){const m=(lo+hi)/2;curlFingers(side,L,m);if(clearOf(side,c,r).w>=-REST)lo=m;else hi=m;}curlFingers(side,L,lo);return;}
        if(!push||!o.p)return;
        push(TV().copy(o.p).sub(c).normalize().multiplyScalar(-(o.w+REST)*1.1));
      }
    }

    function findShootingFingerVertices(mesh){
      const fingerBones=mesh.skeleton.bones.map(b=>/RightHand(Index|Middle|Ring|Pinky|Thumb)[1-4]$/.test(b.name));
      const indices=mesh.geometry.attributes.skinIndex.array,weights=mesh.geometry.attributes.skinWeight.array;
      const vertices=[];
      for(let i=0;i<indices.length;i+=4){
        let weight=0;
        for(let j=i;j<i+4;j++)if(fingerBones[indices[j]])weight+=weights[j];
        if(weight>.5)vertices.push(i/4);
      }
      return vertices;
    }
    /* 指骨中心不能代表库里蒙皮的指腹厚度。沿掌面法线求出让球脱离指面所需的最小距离。 */
    function clearShootingFingerSurface(center,normal,radius){
      const mesh=state.mesh;
      mesh.updateMatrixWorld(true);
      let lift=0;
      const r2=(radius+.001)**2;
      for(const index of state.shootingFingerVertices){
        mesh.boneTransform(index,_fv).applyMatrix4(mesh.matrixWorld).sub(center);
        const depth=_fv.dot(normal);
        const across=_fv.lengthSq()-depth*depth;
        if(across<r2)lift=Math.max(lift,depth+Math.sqrt(r2-across));
      }
      center.addScaledVector(normal,lift);
    }

    /* ---------- 3. 建模型:缩放、量静止姿势、切第一人称用的前臂网格、读 run 动画 ---------- */
    /* 换了球星:丢掉上一个模型留下的全部骨骼表,下次渲染再按新球星加载 */
    function unload(){
      if(state.root&&state.root.parent)state.root.parent.remove(state.root);
      for(const o of [B,restL,restP,restW,restWinv,restPos,LIMB])for(const k in o)delete o[k];
      stanceReady=stanceLocked=shotStanceReleased=false;
      _prevPole.hasR=_prevPole.hasL=false;
      Object.assign(state,{root:null,M:null,mesh:null,fp:null,run:null,ready:false,player:null,modelId:null,failed:false,ballMoved:false,guideOff:null,oursG:null,airTop:0,landT:null,landV:0,airPrev:0,airVel:0,shotW:0,shotFrame:0,chargeFrame:null});
    }
    function build(gltf,id){
      if(MODELS[id]&&MODELS[id].shotClip)getShotClip(MODELS[id].shotClip);
      const root=new T.Group();root.name="tripoAvatar";root.matrixAutoUpdate=false;root.visible=false;
      const M=new T.Group();M.rotation.y=MODELS[id].yaw;root.add(M);M.add(gltf.scene);
      let mesh=null;
      const maxAniso=(typeof renderer!=="undefined"&&renderer&&renderer.capabilities&&renderer.capabilities.getMaxAnisotropy)?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;
      gltf.scene.traverse(o=>{o.frustumCulled=false;o.userData.tripo=true;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.isSkinnedMesh&&!mesh)mesh=o;if(o.isBone)B[o.name.replace(/^mixamorig:?/,"")]=o;if(o.isMesh&&o.material&&o.material.map){o.material.map.anisotropy=maxAniso;o.material.map.needsUpdate=true;}});
      if(!mesh||!B.Hips)throw new Error(MODELS[id].file+" 里没有蒙皮网格或骨骼");
      const venueLook=!!MODELS[id].look;
      if(venueLook){
        gltf.scene.traverse(o=>{
          if(o.isMesh&&o.material?.isMeshStandardMaterial)o.material.userData.aibaLinearCharacter=true;
        });
        window.AIBACharacterShading?.shadeTree(root);
      }
      root.updateMatrixWorld(true);
      /* 量身高要用蒙皮后的真实顶点:Mixamo 绑的模型,Armature 节点带着一个 90° 旋转(Z 朝上遗留),
         直接取几何包围盒会把身高当成厚度。静止姿势下蒙皮顶点 = 原顶点,star8 这条路算出来和以前一样 */
      const skinBox=()=>{
        const bx=new T.Box3(),v=new T.Vector3(),pos=mesh.geometry.attributes.position;mesh.updateMatrixWorld(true);
        for(let i=0;i<pos.count;i++){mesh.boneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);bx.expandByPoint(v);}
        return bx;
      };
      let box=skinBox();const s=HEIGHT/(box.max.y-box.min.y);
      M.scale.setScalar(s);root.updateMatrixWorld(true);box=skinBox();
      const hp=wpos("Hips");M.position.set(-hp.x,-box.min.y,-hp.z);root.updateMatrixWorld(true);
      for(const n in B){restL[n]=B[n].quaternion.clone();restP[n]=B[n].position.clone();restW[n]=B[n].getWorldQuaternion(new T.Quaternion());restWinv[n]=restW[n].clone().invert();restPos[n]=wpos(n,new T.Vector3());}
      for(const [k,side] of [["R","Right"],["L","Left"]]){
        const a=LIMB["arm"+k]={up:side+"Arm",fore:side+"ForeArm",hand:side+"Hand",bend:V(0,0,1)};
        a.l1=restPos[a.up].distanceTo(restPos[a.fore]);a.l2=restPos[a.fore].distanceTo(restPos[a.hand]);
        const f=restPos[side+"HandMiddle1"].clone().sub(restPos[a.hand]);a.palm=f.length()*.8;f.normalize();
        const n=perp(V(0,-1,0),f).clone();   // T-pose 掌心朝下
        a.restBasisInv=basisQ(f,n).clone().invert();a.curlAxis=new T.Vector3().crossVectors(f,n).normalize();
        const l=LIMB["leg"+k]={up:side+"UpLeg",fore:side+"Leg",hand:side+"Foot",bend:V(0,0,-1)};
        l.l1=restPos[l.up].distanceTo(restPos[l.fore]);l.l2=restPos[l.fore].distanceTo(restPos[l.hand]);
      }
      /* 第一人称网格:只留主要受前臂/手/手指骨影响的三角面,和主网格共用同一副骨骼 */
      const geo=mesh.geometry,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,names=mesh.skeleton.bones.map(b=>b.name);
      const keep=new Uint8Array(si.count);
      /* 预采样全身各骨骼极值顶点(约 180 个顶点):街舞/倒立定格(freeze/freeze2)时任意部位(手/肘/肩/头/背/膝/脚)都可能触地,
         用真实蒙皮极值顶点做贴地包络,耗时 <0.03ms 且 100% 杜绝任何动作穿模下沉到地板以下 */
      const posAttr=geo.attributes.position,nb=mesh.skeleton.bones.length;
      const bMinX=new Int32Array(nb).fill(-1),bMaxX=new Int32Array(nb).fill(-1),
            bMinY=new Int32Array(nb).fill(-1),bMaxY=new Int32Array(nb).fill(-1),
            bMinZ=new Int32Array(nb).fill(-1),bMaxZ=new Int32Array(nb).fill(-1);
      const vMinX=new Float32Array(nb).fill(Infinity),vMaxX=new Float32Array(nb).fill(-Infinity),
            vMinY=new Float32Array(nb).fill(Infinity),vMaxY=new Float32Array(nb).fill(-Infinity),
            vMinZ=new Float32Array(nb).fill(Infinity),vMaxZ=new Float32Array(nb).fill(-Infinity);
      const hvSet=new Set(),tv=new T.Vector3();
      mesh.updateMatrixWorld(true);
      for(let v=0;v<si.count;v++){
        let bi=0,bw=-1;
        for(let k=0;k<4;k++){const w=sw.array[v*4+k];if(w>bw){bw=w;bi=si.array[v*4+k];}}
        keep[v]=/(ForeArm|Hand)/.test(names[bi]||"")?1:0;
        if(bi>=0&&bi<nb){
          mesh.boneTransform(v,tv);tv.applyMatrix4(mesh.matrixWorld);
          if(tv.x<vMinX[bi]){vMinX[bi]=tv.x;bMinX[bi]=v;}
          if(tv.x>vMaxX[bi]){vMaxX[bi]=tv.x;bMaxX[bi]=v;}
          if(tv.y<vMinY[bi]){vMinY[bi]=tv.y;bMinY[bi]=v;}
          if(tv.y>vMaxY[bi]){vMaxY[bi]=tv.y;bMaxY[bi]=v;}
          if(tv.z<vMinZ[bi]){vMinZ[bi]=tv.z;bMinZ[bi]=v;}
          if(tv.z>vMaxZ[bi]){vMaxZ[bi]=tv.z;bMaxZ[bi]=v;}
          if(tv.y<.04||tv.y>HEIGHT-.12)hvSet.add(v);
        }
      }
      for(let b=0;b<nb;b++){
        for(const idx of [bMinX[b],bMaxX[b],bMinY[b],bMaxY[b],bMinZ[b],bMaxZ[b]])if(idx>=0)hvSet.add(idx);
      }
      const hullVerts=Uint32Array.from(hvSet);
      const soleVertices=venueLook?["Left","Right"].map(side=>["Foot","ToeBase","Toe_End"]
        .map(part=>bMinY[mesh.skeleton.bones.indexOf(B[side+part])])
        .filter(index=>Number.isInteger(index)&&index>=0)):null;
      const src=geo.index.array,out=[];
      for(let i=0;i<src.length;i+=3)if(keep[src[i]]&&keep[src[i+1]]&&keep[src[i+2]])out.push(src[i],src[i+1],src[i+2]);
      const g2=geo.clone();g2.setIndex(new T.BufferAttribute(new src.constructor(out),1));
      const fp=new T.SkinnedMesh(g2,mesh.material);fp.name="tripoFpArms";fp.frustumCulled=false;fp.userData.tripo=true;
      fp.position.copy(mesh.position);fp.quaternion.copy(mesh.quaternion);fp.scale.copy(mesh.scale);
      mesh.parent.add(fp);fp.bind(mesh.skeleton,mesh.bindMatrix);fp.visible=false;
      Object.assign(state,{root,M,mesh,fp,hullVerts,soleVertices,modelId:id,base:M.position.clone(),scale:s,footRest:footMin(),hipY:restPos.Hips.y});
      state.shootingFingerVertices=id==="star30"?findShootingFingerVertices(mesh):null;
      if(MODELS[id]&&MODELS[id].shotClip)getShotClip(MODELS[id].shotClip);
      readRun(gltf.animations&&gltf.animations[0]);
    }
    /* run 动画:按骨骼存成采样表;再量出"脚踩地时往后蹬的速度",得到一个循环对应的前进距离 */
    function readRun(clip){
      if(!clip)return;
      const rot={};let hips=null,t0=Infinity,t1=-Infinity;
      for(const tr of clip.tracks){
        const dot=tr.name.lastIndexOf("."),bn=tr.name.slice(0,dot).replace(/^mixamorig:?/,""),prop=tr.name.slice(dot+1);
        if(!B[bn])continue;
        if(prop==="quaternion"){rot[bn]=tr;t0=Math.min(t0,tr.times[0]);t1=Math.max(t1,tr.times[tr.times.length-1]);}
        else if(prop==="position"&&bn==="Hips")hips=tr;
      }
      if(!(t1>t0))return;
      const run=state.run={rot,hips,t0,span:t1-t0,stride:2.4,arm:/(Shoulder|Arm|Hand)/};
      try{
        const N=40,L=[],R=[];
        for(let i=0;i<=N;i++){resetPose();applyRun(i/N,1,0);state.root.updateMatrixWorld(true);L.push(wpos("LeftToeBase",new T.Vector3()));R.push(wpos("RightToeBase",new T.Vector3()));}
        const sp=[],dt=run.span/N;
        for(let i=0;i<N;i++){const A=L[i].y<R[i].y?L:R;const v=-(A[i+1].z-A[i].z)/dt;if(v>0)sp.push(v);}
        sp.sort((a,b)=>a-b);const v=sp[Math.floor(sp.length*.6)];
        if(Number.isFinite(v)&&v>.5){run.stride=v*run.span;run.speed=v;}
        resetPose();state.root.updateMatrixWorld(true);
      }catch(e){state.lastError=e;}
    }
    function sampleQ(tr,t,out){
      const tm=tr.times,n=tm.length;let i=0;while(i<n-2&&tm[i+1]<=t)i++;
      const a=clamp((t-tm[i])/Math.max(1e-6,tm[i+1]-tm[i]),0,1);
      T.Quaternion.slerpFlat(_sq,0,tr.values,i*4,tr.values,(i+1)*4,a);return out.fromArray(_sq);
    }
    const _sq=[0,0,0,1],_cq=new T.Quaternion();
    /* 把 run 动画按权重 w 混到当前姿势上;armKeep 越大,手臂越保留原姿势(持球/接球时) */
    function applyRun(phase,w,armKeep){
      const run=state.run;if(!run||w<=.001)return;
      const t=run.t0+(phase-Math.floor(phase))*run.span;
      for(const bn in run.rot){
        const k=run.arm.test(bn)?w*(1-armKeep):w;if(k<=.001)continue;
        B[bn].quaternion.slerp(sampleQ(run.rot[bn],t,_cq),k);
      }
      if(run.hips){
        const tr=run.hips,tm=tr.times,n=tm.length;let i=0;while(i<n-2&&tm[i+1]<=t)i++;
        const a=clamp((t-tm[i])/Math.max(1e-6,tm[i+1]-tm[i]),0,1),v=tr.values;
        B.Hips.position.y+=(v[i*3+1]+(v[(i+1)*3+1]-v[i*3+1])*a-restP.Hips.y)*w;   // 只取上下起伏,水平位移由游戏的走位决定
      }
    }

    /* ---------- 4. 换人时:记下 AIBA 这副骨架的左右手/腿下标、鞋底高度 ---------- */
    function attach(guy){
      const sc=sceneNow();if(!sc)return false;
      if(state.root.parent!==sc)sc.add(state.root);
      const armIdx={},legIdx={};
      guy.arms.forEach((n,i)=>{armIdx[n.position.x<0?"R":"L"]=i;});
      guy.legs.forEach((n,i)=>{legIdx[n.position.x<0?"R":"L"]=i;});
      let soleY=0;
      try{
        const box=new T.Box3(),inv=new T.Matrix4();guy.g.updateMatrixWorld(true);
        const f=guy.footRoots[0];inv.copy(f.matrixWorld).invert();
        f.traverse(o=>{if(o.isMesh&&o.geometry){o.geometry.computeBoundingBox();box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);soleY=Math.min(soleY,box.min.y);}});
      }catch(e){}
      stanceReady=stanceLocked=shotStanceReleased=false;
      _prevPole.hasR=_prevPole.hasL=false;
      Object.assign(state,{player:guy,armIdx,legIdx,soleY,ready:true,tA:0,prevX:null,prevZ:null,holdW:0,runW:0,armHold:0});
      return true;
    }

    /* 热身舞蹈:每根主骨骼 = 舞蹈的世界旋转增量 × 这副骨架自己的静止世界朝向(和跑动重映射同一个思路),
     按 w 和当前姿势(正常重定向算出来的)混合,出入场平滑。髋部的上下起伏按这副骨架的髋高换算。
     DANCE_BONES 父在前,因此逐骨只做浅层矩阵累乘,最后统一一次 updateMatrixWorld(true)(省去 22 次递归遍历)。 */
  const _dq=new T.Quaternion(),_dc=new T.Quaternion();
  function applyDance(dn){
    const w=clamp(dn.w==null?1:dn.w,0,1);if(w<=0||!dn.q)return;
    for(let i=0;i<DANCE_BONES.length;i++){
      const n=DANCE_BONES[i],bone=B[n];if(!bone)continue;
      _dq.set(dn.q[i*4],dn.q[i*4+1],dn.q[i*4+2],dn.q[i*4+3]).multiply(restW[n]);
      const targetQ=w<1?(bone.getWorldQuaternion(_dc).slerp(_dq,w)):_dq;
      bone.parent.getWorldQuaternion(_pq).invert();
      bone.quaternion.copy(_pq).multiply(targetQ);
      bone.updateMatrix();
      bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
    }
    state.root.updateMatrixWorld(true);
  }
  function hullMinY(){
    const hv=state.hullVerts,mesh=state.mesh;
    if(!hv||!hv.length||!mesh)return footMin()-state.footRest;
    mesh.updateMatrixWorld(true);
    if(mesh.skeleton)mesh.skeleton.update();
    let minY=Infinity;
    for(let i=0;i<hv.length;i++){
      mesh.boneTransform(hv[i],_v);
      _v.applyMatrix4(mesh.matrixWorld);
      if(_v.y<minY)minY=_v.y;
    }
    return Number.isFinite(minY)?minY:(footMin()-state.footRest);
  }

  /* ---------- 5. 每次渲染前:重定向(零 GC 分配 + 浅层躯干矩阵合并更新) ---------- */
    const _gInv=new T.Matrix4(),_rm=new T.Matrix4(),_rp=new T.Vector3(),_rs=new T.Vector3(),_gp=new T.Vector3(),_gq=new T.Quaternion(),_gs=new T.Vector3();
    const I0=new T.Quaternion(),Xax=V(1,0,0),Yax=V(0,1,0),Zax=V(0,0,1);
    const _armSlots={R:{},L:{}},_prevPole={R:new T.Vector3(),L:new T.Vector3(),hasR:false,hasL:false};
    const _guideOff=new T.Vector3(),_ballWorld=new T.Vector3(),_ballShift=new T.Vector3();
    // Record each shoe in court space, then solve in the unmirrored rig space used by solveLimb.
    const plantFrame=new T.Matrix4(),stanceFrame=new T.Matrix4(),toRig=new T.Matrix4();
    const contacts=["L","R"].map(side=>({side,toeName:side==="L"?"LeftToeBase":"RightToeBase",ankle:new T.Vector3(),sole:new T.Quaternion(),
      toe:new T.Quaternion(),target:new T.Vector3()}));
    let stanceReady=false,stanceLocked=false,shotStanceReleased=false;
    function plantShotFeet(active,clipWeight,air,walking,charging,recovery){
      if(charging&&air<=.004&&!recovery)shotStanceReleased=false;
      if(recovery||shotStanceReleased){
        stanceReady=stanceLocked=false;
        return 0;
      }
      if(walking){
        stanceReady=stanceLocked=false;
        return 0;
      }
      if(active&&air>.004){
        shotStanceReleased=true;
        stanceReady=stanceLocked=false;
        return 0;
      }
      if(!active&&clipWeight<.005)stanceLocked=false;
      if(!stanceReady){
        if(!active||air>0)return 0;
        stanceFrame.copy(plantFrame);
        for(const c of contacts){
          const foot=LIMB["leg"+c.side].hand;
          wpos(foot,c.ankle);B[foot].getWorldQuaternion(c.sole);
          c.toe.copy(B[c.toeName].quaternion);
        }
        stanceReady=true;
      }
      if(active)stanceLocked=true;
      if(!stanceLocked)return 0;
      const weight=(active?1:clipWeight)*(1-smooth(air/.22));
      toRig.copy(plantFrame).invert().multiply(stanceFrame);
      const stanceRotation=TQ().setFromRotationMatrix(toRig);
      const basis=plantFrame.elements,lift=TV(basis[1],basis[5],basis[9]).multiplyScalar(air);
      let lower=0;
      for(const c of contacts){
        const leg=LIMB["leg"+c.side],hip=wpos(leg.up);
        c.target.copy(c.ankle).applyMatrix4(toRig).add(lift).lerp(wpos(leg.hand),1-weight);
        // At full extension let the pelvis yield before a planted heel can lift.
        const dx=hip.x-c.target.x,dz=hip.z-c.target.z,reach=(leg.l1+leg.l2)*.997;
        lower=Math.max(lower,hip.y-c.target.y-Math.sqrt(Math.max(0,reach*reach-dx*dx-dz*dz)));
      }
      if(lower>0){state.M.position.y-=lower;state.M.updateMatrixWorld(true);}
      for(const c of contacts){
        const leg=LIMB["leg"+c.side],toe=B[c.toeName];
        const sole=B[leg.hand].getWorldQuaternion(TQ()).slerp(TQ().copy(stanceRotation).multiply(c.sole),weight);
        const pole=wpos(leg.fore).sub(wpos(leg.up).lerp(wpos(leg.hand),.5));
        if(pole.lengthSq()<.0001)pole.copy(Zax);
        solveLimb(leg,c.target,pole);
        setW(B[leg.hand],sole);
        toe.quaternion.slerp(c.toe,weight);
      }
      return lower;
    }
    function retarget(atRelease=false){
      _vPtr=0;_qPtr=0;
      const guy=state.player,g=guy.g,ball=ballNow(),root=state.root,M=state.M;
      g.updateWorldMatrix(true,true);
      const gInv=_gInv.copy(g.matrixWorld).invert();
      const Sc=TV(Math.abs(g.scale.x),Math.abs(g.scale.y),Math.abs(g.scale.z));   // AIBA 的体型缩放 / 落地挤压,读位置时乘回真实尺寸
      const loc=n=>TV().setFromMatrixPosition(n.matrixWorld).applyMatrix4(gInv).multiply(Sc);
      const rot=n=>{const q=TQ();_rm.multiplyMatrices(gInv,n.matrixWorld).decompose(_rp,q,_rs);return q;};
      /* 用游戏时钟:慢动作、暂停、回放时过渡和相位跟着游戏走,不跟墙上时间走 */
      let now=performance.now();try{if(typeof G!=="undefined"&&G&&Number.isFinite(G.tNow))now=G.tNow*1000;}catch(e){}
      const dt=Math.min(.1,Math.max(0,(now-(state.tA||now))/1000));state.tA=now;
      /* 腾空时不算跑动:热身扣篮起跳那一段人在空中还在往前飘,要是继续当成跑步,跑步权重会把离地高度压回 0 */
      const air=airNow(),recovery=cfg.player&&guy.shotRecovery?.active?guy.shotRecovery:null;
      const moving=air<.05&&movingNow(guy,dt),holding=holdingNow(ball);
      const ease=(cur,to,tau)=>cur+(to-cur)*Math.min(1,dt/tau);
      state.runW=state.run?ease(state.runW,moving?1:0,.11):0;
      state.holdW=ease(state.holdW,holding?1:0,.15);
      state.armHold=ease(state.armHold,(holding||catchNow()||!!guy._celebRunArms)?1:0,.12);
      const rw=state.runW*state.runW*(3-2*state.runW),hw=state.holdW*state.holdW*(3-2*state.holdW);

      /* 跑动相位:按这一帧实际走过的距离推进,一个循环对应 run.stride 这么远 */
      g.matrixWorld.decompose(_gp,_gq,_gs);
      if(state.prevX!=null&&state.run){
        const dx=_gp.x-state.prevX,dz=_gp.z-state.prevZ,d=Math.hypot(dx,dz);
        if(d<1.5)state.phase+=(recovery?(Number(recovery.direction)||-1):1)*d/state.run.stride;
      }
      state.prevX=_gp.x;state.prevZ=_gp.z;

      root.matrix.identity();M.position.copy(state.base);resetPose();

      /* 加深下蹲 + 落地缓冲:都是把脚踝目标相对骨盆抬高 squat 米,膝盖自然更弯,贴地后骨盆就低这么多。
         落地缓冲是一根临界阻尼弹簧:触地那一刻骨盆带着下落速度继续往下,约 0.09 秒压到最低,再慢慢站回来 —— 速度不断档。 */
      if(dt>0){
        const pa=state.airPrev||0;
        const landed=air<=.004&&pa>.004;
        /* 触地发生在这一帧中间:弹簧只算触地之后那一小段时间,否则这一帧会把"落完剩下的高度"和"弹簧第一步"叠在一起,多掉一截 */
        if(landed){state.landV=clamp((state.airVel||0),0,3.6);state.landT=state.landV>.2?clamp(dt-pa/state.landV,0,dt):0;}
        if(air>.004)state.airVel=(pa-air)/dt;
        state.airPrev=air;
        if(state.landT!=null&&!landed){state.landT+=dt;if(state.landT>.9)state.landT=null;}
      }
      /* 蓄力下蹲:AIBA 的 g 绕脚底前倾,上身会被整条甩到脚尖前面。骨盆往后坐、脊柱反向补回来(和另两套皮套同一套补偿) */
      const ud=g.userData||{},groundK=Math.max(0,1-Math.min(1,air/.05));
      const shotLoad=(!moving&&Number(ud.shotLoad))||0,readyBlend=(!moving&&Number(ud.shotReadyLowerBlend))||0;
      const kneeBend=Math.max(0,guy.knees&&guy.knees[0]?guy.knees[0].rotation.x:0,guy.knees&&guy.knees[1]?guy.knees[1].rotation.x:0);
      let loadK=groundK*clamp(shotLoad>0?shotLoad:(readyBlend>0?readyBlend:(moving?0:kneeBend/.95)),0,1);
      const tilt=-g.rotation.x;
      /* 触地前一帧还在空中(下蹲量被 groundK 压成 0),触地这一帧会整份弹回来,髋多掉一截:触地后 0.12 秒内平滑放回 */
      if(state.landT!=null){const r=clamp(state.landT/.12,0,1);loadK*=r*r*(3-2*r);}
      if(loadK>.001){M.position.z+=(-.065*loadK-state.hipY*Math.sin(tilt))/Math.max(.7,Math.cos(tilt));M.position.y+=-.035*loadK;}
      let squat=state.crouchExtra*loadK;
      if(state.landT!=null&&!moving){
        const lt=state.landT;
        /* 主缓冲 + 轻柔衰减双弹弹簧余震，让写实蒙皮落地也有自然的膝踝弹性收稳 */
        const baseBounce=state.landGain*state.landV*lt*Math.exp(-lt/state.landTau);
        const microElastic=Math.max(0,Math.sin(lt*13.8))*Math.exp(-lt*3.6)*0.022*clamp(state.landV/2.2,0.4,1.1);
        squat+=(baseBounce+microElastic)*groundK;
      }
      state.squat=squat=Math.min(squat,.24);
      root.updateMatrixWorld(true);

      /* 躯干:读 AIBA 胸腔和头这一帧的朝向,分到 骨盆 / 腰 / 胸 / 颈 / 头
         按父到子顺序只做单节点浅层矩阵更新,全部设完后再一次刷新 Hips 子树(消除 5 次整棵 65 骨递归遍历) */
      if(!state.shell||state.shell.parent!==g)state.shell=g.children.find(n=>n.name==="jerseyShell")||null;
      const qT=state.shell?rot(state.shell):TQ();
      const qPel=TQ().copy(I0).slerp(qT,.15),qSp=TQ().copy(I0).slerp(qT,.53),qCh=TQ().copy(qT);
      if(loadK>.001&&tilt>.02){
        const ct=Math.max(0,tilt-.04)*loadK,ax=k=>TQ().setFromAxisAngle(Xax,-ct*k);
        qPel.multiply(ax(.4));qSp.multiply(ax(.45));qCh.multiply(ax(.15));
      }
      const qH=guy.headRoot?rot(guy.headRoot):TQ().copy(qCh);
      const airborneShot=air>.004&&ud.shotJump>0&&!moving&&!pregameLift(guy);
      if(airborneShot){
        const sig=SHOT_AIR[state.modelId==="star30b"?"star30":state.modelId]||SHOT_AIR.star1;
        const hip=smooth(air/.15),chest=smooth((air-.022)/.18);
        // 起跳先开髋，胸肩稍后到位。下肢仍以原脚踝目标反解，落地平滑卸掉这些角度。
        qPel.premultiply(TQ().setFromAxisAngle(Yax,sig.hip*hip));
        qPel.premultiply(TQ().setFromAxisAngle(Xax,-sig.lean*.30*hip));
        qPel.premultiply(TQ().setFromAxisAngle(Zax,-sig.roll*.55*hip));
        qCh.premultiply(TQ().setFromAxisAngle(Yax,sig.chest*chest));
        qCh.premultiply(TQ().setFromAxisAngle(Xax,-sig.lean*chest));
        qCh.premultiply(TQ().setFromAxisAngle(Zax,sig.roll*chest));
        qSp.copy(qPel).slerp(qCh,.55);
        const aim=typeof HOOP!=="undefined"
          ?TV().copy(HOOP).applyMatrix4(gInv).multiply(Sc).sub(restPos.Head)
          :TV(0,.17,1);
        const yaw=clamp(Math.atan2(aim.x,aim.z),-.40,.40);
        const pitch=clamp(Math.atan2(aim.y,Math.hypot(aim.x,aim.z)),-.05,.29);
        qH.slerp(TQ().setFromAxisAngle(Yax,yaw).multiply(TQ().setFromAxisAngle(Xax,-pitch)),hip);
      }
      const put=(n,q)=>{if(B[n])setW(B[n],TQ().copy(q).multiply(restW[n]));};
      const putShallow=(n,q)=>{
        const bone=B[n];if(!bone)return;
        bone.parent.getWorldQuaternion(_pq).invert();
        bone.quaternion.copy(_pq).multiply(q).multiply(restW[n]);
        bone.updateMatrix();
        bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
      };
      putShallow("Hips",qPel);putShallow("Spine",qSp);putShallow("Spine1",TQ().copy(qSp).slerp(qCh,.5));putShallow("Spine2",qCh);
      putShallow("Neck",TQ().copy(qCh).slerp(qH,.5));putShallow("Head",qH);
      if(B.Hips)B.Hips.updateMatrixWorld(true);

      /* 腿:脚踝跟着 AIBA 脚踝的落点走(挪到这副骨架自己的胯宽和踝高上),反解膝盖;脚掌朝向照抄 */
      for(const [sd,s,side] of [["L",1,"Left"],["R",-1,"Right"]]){
        const l=state.legIdx[sd],L=LIMB["leg"+sd];
        const hipA=loc(guy.legs[l]),kneeA=loc(guy.knees[l]),ankA=loc(guy.ankles[l]),rf=restPos[side+"Foot"];
        const tg=TV().copy(ankA);tg.x+=rf.x-s*.125;tg.y+=rf.y-.12*Sc.y;tg.y+=squat;
        const fwT=TV().copy(Zax).applyQuaternion(rot(guy.legs[l]));
        const pole=TV().copy(kneeA).sub(TV().copy(hipA).add(ankA).multiplyScalar(.5)).addScaledVector(fwT,.03);
        solveLimb(L,tg,pole);
        put(side+"Foot",rot(guy.footRoots[l]));
      }

      /* 手臂:复制 AIBA 手臂的方向和伸展比例(不照搬位置:肩宽、臂长都不一样) */
      for(const [sd,side] of [["R","Right"],["L","Left"]]){
        const a=state.armIdx[sd],L=LIMB["arm"+sd];
        const S0=wpos(L.up),Sa=loc(guy.arms[a]),Ea=loc(guy.elbows[a]),Wa=loc(guy.handRoots[a]),qA=rot(guy.handRoots[a]);
        const La=Ea.distanceTo(Sa)+Wa.distanceTo(Ea),Lk=L.l1+L.l2,s=sd==="L"?1:-1;
        const free=TV().copy(S0).addScaledVector(TV().copy(Wa).sub(Sa).normalize(),Math.min(.995,Wa.distanceTo(Sa)/La)*Lk);
        const low=clamp((1.22-free.y)/.2,0,1)*Math.max(0,1-Math.abs(free.z)/.28);       // 垂手时别插进短裤
        if(low>0&&s*free.x<.25)free.x=s*(s*free.x+(.25-s*free.x)*low);
        const rawPole=TV().copy(Ea).sub(TV().copy(Sa).add(Wa).multiplyScalar(.5));
        const fallbackPole=TV(s*.35,-.25,-.85).normalize();
        let pole=rawPole.lengthSq()<.015
          ? TV().copy(fallbackPole).lerp(rawPole.lengthSq()>1e-5?TV().copy(rawPole).normalize():fallbackPole,Math.min(1,rawPole.length()/.12))
          : rawPole;
        const pn=TV().copy(pole).normalize();
        const hasPrev=sd==="R"?_prevPole.hasR:_prevPole.hasL;
        if(hasPrev&&dt>0){
          pn.lerp(_prevPole[sd],Math.exp(-18*dt)).normalize();
        }
        _prevPole[sd].copy(pn);
        if(sd==="R")_prevPole.hasR=true;else _prevPole.hasL=true;
        pole=pn;
        /* 持球时肘部放松外张:方块人的肘是贴着身体夹住的,真人抱球时两肘自然离开躯干。
           手举过肩(举球、出手)时逐渐收回,投篮手的肘要回到球的正下方。 */
        {const fl=state.elbowOut*hw*clamp((S0.y+.02-free.y)/.3,0,1);if(fl>.001)pole.normalize().add(TV(s*fl,0,-.25*fl));}
        const slot=_armSlots[sd];
        slot.a=a;slot.L=L;slot.side=side;slot.S0=S0;slot.Sa=Sa;slot.Ea=Ea;slot.Wa=Wa;slot.qA=qA;slot.free=free;slot.pole=pole;
        slot.N=TV(0,0,-1).applyQuaternion(qA);slot.F=TV(0,-1,0).applyQuaternion(qA);
      }
      const setHand=A=>setW(B[A.L.hand],basisQ(A.F,A.N).multiply(A.L.restBasisInv).multiply(restW[A.L.hand]));
      curlFingers("Right",LIMB.armR,.2+.3*rw*(1-state.armHold)+state.holdCurl*hw);curlFingers("Left",LIMB.armL,.2+.3*rw*(1-state.armHold)+state.holdCurl*hw);
      const R=_armSlots.R,Lf=_armSlots.L;
      /* 球:贴在投篮手掌心。辅助手按 AIBA 里"手腕相对球心"的关系摆到这颗球旁边 */
      let ballK=null,ballR=0;
      const grip=guy.ballGrips&&guy.ballGrips[R.a];
      /* 球仍在手上时逐渐从掌根移到指腹；压腕沿用主动作的离球后时序。 */
      const shot=cfg.player&&window.AIBAMotion?window.AIBAMotion.stats():null;
      const following=shot&&shot.followActive&&(!holding||shot.pendingRelease||atRelease);
      const roll=following?smooth(shot.followAge/SHOT_WRIST_SNAP_DELAY):0;
      const wristFollow=following?1-smooth((shot.followAge-SHOT_WRIST_SNAP_DELAY)/.16):0;
      const form=guy.shotStyle;
      const releaseWeight=following&&form&&form.releaseArmAngle
        ?smooth(shot.followAge/(SHOT_WRIST_SNAP_DELAY*.85))*(1-smooth((shot.followAge-.22)/.23)):0;
      const up=releaseWeight?TV(0,1,0).applyQuaternion(TQ().copy(_gq).invert()):null;
      const shootPole=releaseWeight?TV().copy(R.pole).lerp(TV().copy(up).negate().add(TV(-.10,0,0)),releaseWeight):R.pole;
      if(holding)solveLimb(R.L,R.free,R.pole);
      else solveLimb(R.L,releaseWristTarget(R,R.free,form,releaseWeight,up),shootPole);
      if(holding&&ball){
        const br=BALL_R*BALL_VIS*Math.max(ball.scale.x,.01);ballR=br;
        /* 球心相对手腕的向量直接取自 AIBA 那只手(方块手里球本来就在掌心),手的朝向已经抄过来了 */
        /* 这只手比方块手小,AIBA 手腕到球心的距离照搬会让球悬在掌心外面:只保留侧向偏移,沿指向/掌心法向按这只手的尺寸重新定 */
        const rel0=grip?loc(grip).sub(R.Wa):TV();
        const side=TV().copy(rel0).addScaledVector(R.F,-rel0.dot(R.F)).addScaledVector(R.N,-rel0.dot(R.N)).multiplyScalar(.4);
        const along=state.ballAlong+.055*roll,lift=br+state.ballLift;
        const f=TV().copy(R.F),n=TV().copy(R.N);
        const limit=SHOT_WRIST_LIMIT-.15*roll;
        const wrist=wpos(R.L.hand);
        const original=TV().copy(wrist).addScaledVector(f,along).addScaledVector(n,lift);
        shootingWrist(R,f,n,limit);
        const target=original.addScaledVector(R.F,-along).addScaledVector(R.N,-lift);
        // 保住接球后的持球点及举球线，允许肘部让出空间，与腕部一起调整。
        const wristTarget=TV().copy(wrist).lerp(target,.82);
        solveLimb(R.L,releaseWristTarget(R,wristTarget,form,releaseWeight,up),shootPole);
        shootingWrist(R,f,n,limit);
        ballK=wpos(R.L.hand).add(side).addScaledVector(R.F,along).addScaledVector(R.N,lift);
      }else if(airborneShot||wristFollow>0){
        // 离球后延续手腕的伸展，在自然随挥中放宽限幅。
        const limit=SHOT_WRIST_LIMIT-.15*roll*wristFollow;
        shootingWrist(R,TV().copy(R.F),TV().copy(R.N),limit);
      }
      setHand(R);
      if(ballK&&state.shootingFingerVertices?.length){
        // 托球时松开指节，离手前伸指。球心同时供两个视角、辅助手和离手采样使用。
        curlFingers("Right",R.L,.12-.08*roll);
        clearShootingFingerSurface(ballK,R.N,ballR);
      }
      const tL=TV().copy(Lf.free);
      if(ballK&&grip){
        const rel=TV().copy(Lf.Wa).sub(loc(grip)).multiplyScalar(.86);
        const tg=TV().copy(ballK).add(rel);state.guideOff=_guideOff.copy(tg).sub(Lf.free);
        tL.lerp(tg,hw);
        const rh=wpos(R.L.hand);
        if(tL.x<rh.x+.05)tL.x=rh.x+.05;                                               // 辅助手不越过投篮手
      }
      /* 球刚离手:辅助手沿用最后一帧的偏移,按 hw 淡出,不在一帧内跳回原位 */
      else if(state.guideOff&&hw>.001)tL.addScaledVector(state.guideOff,hw);
      else state.guideOff=null;
      solveLimb(Lf.L,tL,Lf.pole);setHand(Lf);
      if(ballK&&ballR>0){
        const rad0=.2+.3*rw*(1-state.armHold)+state.holdCurl*hw;
        if(!state.shootingFingerVertices?.length)fitFingers("Right",R.L,ballK,ballR,rad0,null);
        fitFingers("Left",Lf.L,ballK,ballR,rad0,off=>{tL.add(off);solveLimb(Lf.L,tL,Lf.pole);setHand(Lf);});
      }

      /* 跑动:换成模型自带的 run 动画 */
      if(rw>.001){applyRun(state.phase,rw,state.armHold);}

      /* 专属视频转 3D 投篮动作(如 nvidia23 的科比跳投):蓄力下蹲→高举出手点→滞空压腕随挥→落地缓冲,
         同步保持篮球紧锁在真实投篮手与辅助手之间，且完全保留游戏原生抛物线起跳高度 air。 */
      let sw=0;
      const shotClipFile=state.modelId&&MODELS[state.modelId]&&MODELS[state.modelId].shotClip;
      const shotClip=shotClipFile?getShotClip(shotClipFile):null;
      state.shotClipReady=!!shotClip;
      const dn=guy.pregameDance&&guy.pregameDance.q?guy.pregameDance:null;
      const dw=dn?clamp(dn.w==null?1:dn.w,0,1)*(1-rw):0;
      if(shotClip&&dw<.01){
        const isCharging=cfg.player&&typeof G!=="undefined"&&G&&!!G.charging;
        const inShot=isCharging||following||atRelease||(!cfg.player&&(shotLoad>.03||airborneShot));
        /* 落地后把科比收势平滑交棒给 shot-motion 的自然随机后摆与弹性缓冲 */
        const tailFade=(following&&shot&&Number(shot.timeAfterRelease)>.44)?1-clamp((shot.timeAfterRelease-.44)/.18,0,1):1;
        const targetW=recovery?0:(inShot&&rw<.45?(1-rw)*tailFade:0);
        const tau=targetW>(state.shotW||0)?.06:.13;
        state.shotW=recovery?0:(atRelease&&targetW>0?1:ease(state.shotW||0,targetW,tau));
        sw=state.shotW*state.shotW*(3-2*state.shotW);
        if(sw>.005){
          const mk=shotClip.markers||{gather:0,dip:12,setPoint:16,release:20,apex:24,land:30,end:shotClip.n-1};
          // Keep the final sample during blend-out; returning to gather here would replay the dip.
          let shotF=state.shotFrame??mk.gather;
          if(atRelease){
            shotF=mk.release;
          }else if(isCharging){
            const ideal=curShot()?weatherAdjustedIdeal(curShot(),false):IDEAL;
            const p=clamp(G.power/Math.max(1,ideal),0,1);
            shotF=p<.55?mk.gather+(mk.dip-mk.gather)*p/.55
              :mk.dip+(mk.release-1-mk.dip)*(p-.55)/.45;
            state.chargeFrame=shotF;
          }else if(shot?.pendingRelease){
            const from=state.chargeFrame??mk.gather;
            shotF=from+(mk.release-from)*shot.extensionProgress;
          }else if(following){
            const fa=shot.timeAfterRelease;
            if(fa<.14)shotF=mk.release+(mk.apex-mk.release)*(fa/.14);
            else if(fa<.48)shotF=mk.apex+(mk.land-mk.apex)*((fa-.14)/.34);
            else shotF=mk.land+(mk.end-mk.land)*clamp((fa-.48)/.36,0,1);
          }else if(!cfg.player&&airborneShot){
            shotF=mk.release+(mk.apex-mk.release)*smooth(air/.35);
          }else if(!cfg.player&&inShot){
            const chargeP=clamp(shotLoad||0,0,1);
            if(chargeP<.55)shotF=mk.gather+(mk.dip-mk.gather)*(chargeP/.55);
            else shotF=mk.dip+(mk.release-1-mk.dip)*((chargeP-.55)/.45);
          }
          state.shotFrame=shotF;
          if(sampleShotClip(shotClip,shotF,_shotQ)){
            applyDance({q:_shotQ,w:sw});
            root.updateMatrixWorld(true);
            /* 持球阶段:保留科比全身躯干/深蹲/起跳/举球轨迹，同时对齐老球星(SHOT_READY_POSE→SHOT_SET_POSE)
               的标准持球手掌方位——收球/下沉时投篮手在球后方发力、高点才自然翻腕托球，辅助手稳贴球左侧不钻球底 */
            if(holding&&ball&&B.RightHand&&B.LeftHand){
              const br=BALL_R*BALL_VIS*Math.max(ball.scale.x,.01);
              const rSh=wpos("RightArm"),rEl=wpos("RightForeArm"),rWr=wpos("RightHand");
              const lSh=wpos("LeftArm"),lEl=wpos("LeftForeArm"),lWr=wpos("LeftHand");
              const rPalm=TV().copy(rWr);if(B.RightHandMiddle1)rPalm.lerp(wpos("RightHandMiddle1"),.42);
              const lPalm=TV().copy(lWr);if(B.LeftHandMiddle1)lPalm.lerp(wpos("LeftHandMiddle1"),.42);
              /* 球心直接取科比双掌中点(不再强行 +Y 顶到掌心上方)，略前移 4cm 避开额头/胸口 */
              const guideW=clamp(1-(shotF-mk.setPoint)/Math.max(1,mk.release-mk.setPoint),0,1)*.48;
              const tgtBall=TV().copy(rPalm).lerp(lPalm,guideW);
              tgtBall.z+=.045;
              /* 按动作进度(gather→dip→setPoint)平滑过渡手掌方位：
                 - 收球(0.0): 投篮手掌心在球正后方(约 10° 仰角，与老球星 READY_R 一致)，手指朝上
                 - 下沉(0.5): 投篮手仍在球后方发力(约 26° 仰角)，绝不提前钻到球底
                 - 高点(1.0): 投篮手在球后下方约 40° 沿出手弧线托球，左辅助手全程稳贴球左侧 */
              const liftK=smooth((shotF-mk.gather)/Math.max(1,mk.release-1-mk.gather));
              const ob=(f,n)=>{const nn=n.normalize(),ff=perp(f,nn)||TV(0,1,0);return basisQ(ff,nn);};
              const qReadyR=ob(TV(.08,.98,-.18),TV(.255,.176,.951));
              const qSetR=ob(TV(.10,.75,-.65),TV(.176,.636,.751));
              const qCurR=TQ().copy(qReadyR).slerp(qSetR,liftK);
              const qReadyL=ob(TV(-.18,.65,.74),TV(-.918,.150,-.366));
              const qSetL=ob(TV(-.12,.98,.16),TV(-.958,-.045,-.283));
              const qCurL=TQ().copy(qReadyL).slerp(qSetL,liftK);
              /* 随科比胸腔朝向做极轻的偏航对齐，让手腕顺着肩膀发力不别扭 */
              let chestYaw=0;
              if(B.Spine2){
                const cf=TV(0,0,1).applyQuaternion(B.Spine2.getWorldQuaternion(TQ()).multiply(restWinv.Spine2));
                chestYaw=clamp(Math.atan2(cf.x,cf.z),-.35,.35);
              }
              if(Math.abs(chestYaw)>.005){
                const yq=TQ().setFromAxisAngle(Yax,chestYaw);
                qCurR.premultiply(yq);qCurL.premultiply(yq);
              }
              const rF=TV(1,0,0).applyQuaternion(qCurR).normalize(),rN=TV(0,1,0).applyQuaternion(qCurR).normalize();
              const lF=TV(1,0,0).applyQuaternion(qCurL).normalize(),lN=TV(0,1,0).applyQuaternion(qCurL).normalize();
              /* 保留科比原片的肘部弯曲面(pole)，再把右投篮手与左辅助手严丝合缝贴到球面上 */
              const rPole=TV().copy(rEl).sub(TV().copy(rSh).add(rWr).multiplyScalar(.5));
              if(rPole.lengthSq()<.01)rPole.set(-.25,-.7,.5);rPole.normalize();
              const lPole=TV().copy(lEl).sub(TV().copy(lSh).add(lWr).multiplyScalar(.5));
              if(lPole.lengthSq()<.01)lPole.set(.55,-.45,.2);lPole.normalize();
              const along=state.ballAlong,lift=br+state.ballLift;
              const rWrist1=TV().copy(tgtBall).addScaledVector(rN,-lift).addScaledVector(rF,-along);
              solveLimb(R.L,rWrist1,rPole);
              shootingWrist(R,rF,rN,SHOT_WRIST_LIMIT);
              const rWrist2=TV().copy(tgtBall).addScaledVector(R.N,-lift).addScaledVector(R.F,-along);
              solveLimb(R.L,rWrist2,rPole);
              shootingWrist(R,rF,rN,SHOT_WRIST_LIMIT);
              setHand(R);
              const exactBall=wpos(R.L.hand).addScaledVector(R.F,along).addScaledVector(R.N,lift);
              if(state.shootingFingerVertices?.length){
                curlFingers("Right",R.L,.16);
                clearShootingFingerSurface(exactBall,R.N,br);
              }else{
                fitFingers("Right",R.L,exactBall,br,.22,null);
              }
              /* 辅助手始终稳贴球的左侧，绝不越过投篮手或掉到球底 */
              if(shotF<mk.release-0.3){
                const lWrist=TV().copy(exactBall).addScaledVector(lN,-(br+.012)).addScaledVector(lF,-.068);
                const rhNow=wpos(R.L.hand);
                if(lWrist.x<rhNow.x+.06)lWrist.x=rhNow.x+.06;
                solveLimb(Lf.L,lWrist,lPole);
                Lf.F.copy(lF);Lf.N.copy(lN);setHand(Lf);
                fitFingers("Left",Lf.L,exactBall,br,.22,off=>{lWrist.add(off);solveLimb(Lf.L,lWrist,lPole);setHand(Lf);});
              }
              if(ballK)ballK.lerp(exactBall,sw);
              else ballK=exactBall;
            }
          }
        }
      }else{
        state.shotW=0;
      }

      /* 热身舞蹈:整身骨骼换成舞蹈的姿势(奔跑移动时自动让位给跑动步态，绝不在跑动时脚底飘移) */
      if(dn&&rw<.95&&!recovery){
        const effW=(dn.w==null?1:dn.w)*(1-rw);
        if(effW>.005)applyDance({q:dn.q,hy:dn.hy,w:effW});
      }
      if(recovery&&rw>.001)applyRun(state.phase,rw,state.armHold);

      /* 摆到 AIBA 球员的位置上。跑动/街舞/专属投篮动作时去掉方块人的额外前倾(动画里自带),只取水平位置和朝向 */
      const kw=Math.max(rw,dw);
      const rotKw=Math.max(kw,sw);
      const fw=TV().copy(Zax).applyQuaternion(_gq),yawQ=TQ().setFromAxisAngle(Yax,Math.atan2(fw.x,fw.z));
      const rq=TQ().copy(_gq).slerp(yawQ,rotKw),rpos=TV().copy(_gp);rpos.y*=1-kw;
      /* 贴地:正常动作按鞋底最低点对齐地板;街舞(含倒立/Freeze)按全身蒙皮极值顶点最低点对齐地板,绝不穿模下沉 */
      root.updateMatrixWorld(true);
      const footRef=footMin()-state.footRest;
      const ours=dw>.001?footRef+(hullMinY()-footRef)*dw:footRef;
      const danceJump=dw>.001&&dn.hy>.02?dn.hy*state.hipY*dw*.35:0;
      /* 腾空高度直接用游戏的起跳高度(一条抛物线),不经过任何平滑,否则离地/触地那两帧的速度会被改掉。
         上升段身体只跟抛物线走:脚在空中绷脚尖、收腿都不该把整个人再顶高一截(以前按"鞋底最低点"对齐,脚尖一绷髋就多涨 0.5 米/秒,提前出手换脚姿时还会抖)。
         下落段再平滑换回按鞋底最低点对齐,保证触地那一刻是脚尖正好碰到地板。 */
      let ref=ours;
      if(air<=.004||dw>.001){state.oursG=null;state.airTop=0;}
      else{
        /* 基准取离地第一帧(腿刚蹬直、脚还是平的);取离地前一帧会把没蹬完的那截算丢 */
        if(state.oursG==null)state.oursG=ours;
        state.airTop=Math.max(state.airTop||0,air);
        {const d=state.airTop>.02?clamp((state.airTop-air)/state.airTop,0,1):0;ref=state.oursG+(ours-state.oursG)*d;}
      }
      const floor=-rpos.y,off=floor+Math.max(0,air)*(1-kw)+danceJump-ref;
      M.position.y+=off;
      plantFrame.compose(rpos,rq,TV(g.scale.x<0?-1:1,1,1));
      if(ballK)_ballWorld.copy(ballK);
      let pelvisDrop=0;
      if(cfg.player&&state.modelId==="nvidia23"){
        M.updateMatrixWorld(true);
        pelvisDrop=plantShotFeet(G.charging,following||atRelease,air,moving||rw>.05||dw>.001,G.charging,!!recovery);
        state.stanceLocked=stanceLocked;state.stanceReleased=shotStanceReleased;state.pelvisDrop=pelvisDrop;
        state.shotRecovery=!!recovery;state.runDirection=recovery?(Number(recovery.direction)||-1):1;
      }
      root.matrix.copy(plantFrame);
      root.updateMatrixWorld(true);

      /* 手里的球挪到这副手上,AIBA 出手从这里读;第一人称的显示球用同一个世界坐标 */
      state.ballWorld=null;state.ballLocal=null;
      if(ballK){_ballWorld.y+=off-pelvisDrop;state.ballWorld=_ballWorld.applyMatrix4(root.matrix);}
      if(ball&&grip&&ball.parent===grip){
        const w=state.ballWorld?TV().copy(state.ballWorld):wpos(R.L.hand);
        state.ballShift=_ballShift.copy(w).sub(TV().setFromMatrixPosition(grip.matrixWorld));
        if(cfg.player&&window.AIBAKobe)AIBAKobe.ballShift=state.ballShift;   // 回放 / 传球读这个字段把球对到画面上的手
        state.ballLocal=(state._ballLocal||(state._ballLocal=new T.Vector3())).copy(w).applyMatrix4(_m.copy(grip.matrixWorld).invert());
        state.ballMoved=true;
      }
    }

    /* ---------- 6. 渲染钩子(零 GC 预分配恢复缓冲) ---------- */
    const hidden=[];   // 这个实例自己藏起来的方块网格
    function hideTree(top,keepA,keepB){
      const walk=o=>{
        if(o===keepA||o===keepB||o.userData.tripo)return;
        if((o.isMesh||o.isLine||o.isPoints)&&o.visible&&o.userData.groundShadowBaseOpacity==null){o.visible=false;hidden.push(o);}
        for(const c of o.children)walk(c);
      };
      for(const c of top.children)walk(c);
    }
    const visibleInScene=o=>{for(;o;o=o.parent){if(!o.visible)return false;if(o.isScene)return true;}return false;};
    const _bp=new T.Vector3(),_pp=new T.Vector3();
    const _shrunkM=[],_shrunkV=new Float32Array(256);let _shrunkN=0;
    const _movedM=[],_movedV=new Float32Array(12);let _movedN=0;
    function shrinkBalls(g,held,fpBall){
      _shrunkN=0;
      const pushS=(m,sx,sy,sz,py)=>{const o=_shrunkN*4;_shrunkM[_shrunkN++]=m;_shrunkV[o]=sx;_shrunkV[o+1]=sy;_shrunkV[o+2]=sz;_shrunkV[o+3]=py;};
      const set=(m,k)=>{if(!m||!m.scale||k>.999)return;pushS(m,m.scale.x,m.scale.y,m.scale.z,NaN);m.scale.multiplyScalar(k);};
      if(held)set(held,BALL_VIS);if(fpBall)set(fpBall,BALL_VIS);
      try{if(typeof passing!=="undefined"&&passing&&passing.mesh&&passing.mesh.visible)set(passing.mesh,BALL_VIS);}catch(e){}
      if(cfg.world)try{
        if(typeof balls!=="undefined"&&balls.length){
          g.getWorldPosition(_pp);
          for(const b of balls){if(!b||!b.mesh||b.mesh===held)continue;
            b.mesh.getWorldPosition(_bp);const d=Math.hypot(_bp.x-_pp.x,_bp.z-_pp.z),t=clamp((d-.8)/3.2,0,1);
            set(b.mesh,BALL_VIS+(1-BALL_VIS)*t*t*(3-2*t));}
        }
      }catch(e){}
      if(cfg.world)try{
        const drop=m=>{if(!m||!m.visible||!m.scale)return;const r0=BALL_R*m.scale.y;pushS(m,m.scale.x,m.scale.y,m.scale.z,m.position.y);m.scale.multiplyScalar(BALL_VIS);m.position.y-=r0*(1-BALL_VIS);};
        if(typeof rackBalls!=="undefined")for(const r of rackBalls)if(r)for(const m of r)drop(m);
        if(typeof deepBalls!=="undefined")for(const m of deepBalls)drop(m);
      }catch(e){}
    }
    function hookRenderer(){
      const svc=window.AIBA&&AIBA.runtime&&AIBA.runtime.service&&AIBA.runtime.service("rendering:core");
      const R=(svc&&svc.renderer)||(typeof renderer!=="undefined"?renderer:null);
      if(!R){setTimeout(hookRenderer,200);return;}
      R.__tripoSet=R.__tripoSet||new Set();if(R.__tripoSet.has(state))return;
      R.__tripoSet.add(state);const orig=R.render.bind(R);
      const oops=e=>{state.lastError=e;state.errors++;if(!state.warned){state.warned=true;console.warn("[tripo] 出错",e);}};
      R.render=function(sc,cam){
        let id=null;try{id=wantId();}catch(e){}
        const on=!!id;
        if(on&&state.root&&state.modelId!==id)unload();
        const root=state.root;
        if(!on||!root){
          if(on)load(id);if(root)root.visible=false;
          /* 换回别的球星:把挪过的球放回 AIBA 手里的原位,不留偏移给方块人 */
          if(!on&&state.ballMoved){state.ballMoved=false;state.ballShift=null;
            const b=ballNow();if(b&&b.parent&&b.parent.name==="ballGrip")b.position.set(0,0,0);
            if(cfg.player&&window.AIBAKobe&&!AIBAKobe.ready)AIBAKobe.ballShift=null;}
          return orig(sc,cam);
        }
        const guy=guyNow();
        if(!guy||!guy.g||!guy.handRoots||!guy.handRoots.length||sc!==sceneNow()){root.visible=false;return orig(sc,cam);}
        if(state.player!==guy||root.parent!==sc){try{attach(guy);}catch(e){oops(e);}}
        if(!state.ready){root.visible=false;return orig(sc,cam);}
        if(cfg.player&&(!state.fpRig||state.fpRig.parent!==sc))state.fpRig=sc.getObjectByName("fpSharedPoseRig")||null;
        const tp=visibleInScene(guy.g),fpOn=cfg.player&&!tp&&!!state.fpRig&&visibleInScene(state.fpRig);
        if(!tp&&!fpOn){root.visible=false;return orig(sc,cam);}
        /* 地板倒影那一遍、斗屏转播那一遍,都沿用主画面算好的骨骼。
           重定向里有按时间走的状态(速度估计、落地缓冲、平滑),同一帧多算一遍会让这些状态乱跳,
           表现为球员每隔几帧抽一下、像几个动作来回切。 */
        const mirror=(sc.scale&&sc.scale.y<0)||state.aux>0;
        const held=ballNow(),fpBall=fpBallNow();
        if(!mirror)try{
          retarget();
          if(state.soleVertices&&typeof syncSkinnedFootShadows==="function")syncSkinnedFootShadows(guy,state);
        }catch(e){oops(e);}
        shrinkBalls(guy.g,held,fpOn?fpBall:null);
        root.visible=true;state.mesh.visible=tp;state.fp.visible=fpOn;
        if(tp)hideTree(guy.g,held,null);
        _movedN=0;
        if(held&&held.parent&&held.parent.name==="ballGrip"&&state.ballLocal){
          const o=_movedN*3;_movedM[_movedN++]=held;_movedV[o]=held.position.x;_movedV[o+1]=held.position.y;_movedV[o+2]=held.position.z;
          held.position.copy(state.ballLocal);
        }
        if(fpOn){
          hideTree(state.fpRig,fpBall,null);
          /* 第一人称的显示球挂在方块手的 ballGrip 上,挪到这副手的掌心 */
          if(fpBall&&fpBall.parent&&state.ballWorld){
            fpBall.parent.updateWorldMatrix(true,false);
            const o=_movedN*3;_movedM[_movedN++]=fpBall;_movedV[o]=fpBall.position.x;_movedV[o+1]=fpBall.position.y;_movedV[o+2]=fpBall.position.z;
            fpBall.position.copy(state.ballWorld).applyMatrix4(_m.copy(fpBall.parent.matrixWorld).invert());
          }
        }
        try{const p=state.ballShift&&passNow();if(p){const e=p.k*p.k*(3-2*p.k);const o=_movedN*3;_movedM[_movedN++]=p.mesh;_movedV[o]=p.mesh.position.x;_movedV[o+1]=p.mesh.position.y;_movedV[o+2]=p.mesh.position.z;p.mesh.position.addScaledVector(state.ballShift,e);}}catch(e){}
        try{return orig(sc,cam);}
        finally{
          for(let i=0;i<hidden.length;i++)hidden[i].visible=true;hidden.length=0;
          for(let i=0;i<_movedN;i++){const o=i*3;_movedM[i].position.set(_movedV[o],_movedV[o+1],_movedV[o+2]);}_movedN=0;
          for(let i=0;i<_shrunkN;i++){const o=i*4,m=_shrunkM[i];m.scale.set(_shrunkV[o],_shrunkV[o+1],_shrunkV[o+2]);if(!Number.isNaN(_shrunkV[o+3]))m.position.y=_shrunkV[o+3];}_shrunkN=0;
          root.visible=false;
        }
      };
    }
    const soleSample=new T.Vector3();
    state.footContact=(guy,side,out)=>{
      const {mesh,soleVertices}=state;
      const indices=soleVertices&&soleVertices[side];
      if(!state.ready||state.player!==guy||state.modelId!==wantId()||!indices?.length)return false;
      let lowest=Infinity;
      out.set(0,0,0);
      for(const index of indices){
        mesh.boneTransform(index,soleSample);
        soleSample.applyMatrix4(mesh.matrixWorld);
        out.add(soleSample);
        lowest=Math.min(lowest,soleSample.y);
      }
      out.multiplyScalar(1/indices.length);
      out.y=lowest;
      return true;
    };
    if(cfg.player)state.heldBallPosition=(guy,out,atRelease=false)=>{
      if(!state.ready||state.player!==guy||state.modelId!==wantId()||!holdingNow(ballNow()))return false;
      // 采本帧的真实掌上球位，沿用渲染的骨架。游戏时钟相同，随后渲染不会再推进一次过渡。
      try{retarget(atRelease);}catch(e){return false;}
      if(!state.ballWorld)return false;
      out.copy(state.ballWorld);
      return true;
    };
    ALL.push(state);
    hookRenderer();
    return state;
  }
  /* 斗屏的实时转播会在同一帧里多渲染一遍主场景:给那一遍打上标记(所有实例一起) */
  (function markAux(){
    const f=window.updJumbotronBroadcast;
    if(typeof f!=="function"||f.__tripoAux)return;
    window.updJumbotronBroadcast=Object.assign(function(){for(const a of ALL)a.aux++;try{return f.apply(this,arguments);}finally{for(const a of ALL)a.aux--;}},{__tripoAux:1});
  })();
  const main=create("player",0);
  main.models=Object.keys(MODELS);   // 开场(boot-shot.js)从这里取可选的写实角色
  window.AIBATripo=main;
  /* 对手:rivals[0..2] 各一个实例,选到写实球星才会去加载模型(其余不花一分钱) */
  window.AIBATripoRivals=[0,1,2].map(i=>create("rival",i));
})();
