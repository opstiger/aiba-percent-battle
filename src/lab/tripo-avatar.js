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
    star30:{file:"star30.glb",yaw:0}
  };
  const QS=new URLSearchParams(location.search),FORCE=QS.get("tripo")==="1";
  if(QS.get("tripo")==="0")return;
  const T=THREE;
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const urlOf=id=>new URL("../../assets/models/"+MODELS[id].file,SELF).href;
  const URL_LOADER=new URL("../../vendor/GLTFLoader.r128.js",SELF).href;
  const HEIGHT=1.84;                 // 游戏单位。AIBA 方块人约 1.8
  const BALL_R=.16,BALL_VIS=.78;     // 游戏球半径 0.16 偏大;手里的球只在画面上缩到 0.78(和切面皮套一致),不碰物理
  const state={ballAlong:.07,ballLift:.015,holdCurl:.32,elbowOut:.9,crouchExtra:.1,landGain:.9,landTau:.11,landV:0,landT:null,ready:false,loading:false,failed:false,errors:0,lastError:null,ballShift:null,runW:0,phase:0,holdW:0,armHold:0};
  state.models=Object.keys(MODELS);   // 开场(boot-shot.js)从这里取可选的写实角色
  window.AIBATripo=state;

  /* AIBATripo.off=true:临时看回方块人,对照用 */
  /* 当前该换皮的球星 id(没有就是 null) */
  const wantId=()=>{if(state.off)return null;try{const id=typeof G!=="undefined"&&!!G&&!!G.myStar&&G.myStar.id;if(id&&MODELS[id])return id;}catch(e){}return FORCE?"star8":null;};
  const guyNow=()=>typeof player!=="undefined"?player:null;
  const ballNow=()=>typeof pBall!=="undefined"?pBall:null;
  const fpBallNow=()=>typeof handBall!=="undefined"?handBall:null;
  const sceneNow=()=>typeof scene!=="undefined"?scene:null;
  const holdingNow=b=>!!(b&&b.visible&&b.parent&&b.parent.name==="ballGrip");
  const airNow=()=>{try{return typeof P!=="undefined"&&P?Number(P.jump)||0:0;}catch(e){return 0;}};
  const movingNow=guy=>{try{return !!(guy.walking||guy.running||(typeof P!=="undefined"&&P&&P.walking)||(typeof G!=="undefined"&&G&&G.moving));}catch(e){return false;}};
  const catchNow=()=>{try{return !!(G.passCatch&&G.passCatch.active)||Number(G.pickupReach)>0;}catch(e){return false;}};
  const passNow=()=>{try{if(typeof passing!=="undefined"&&passing&&passing.mesh){const k=G&&G.passCatch?Number(G.passCatch.progress)||0:0;return {mesh:passing.mesh,k};}}catch(e){}return null;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const V=(x,y,z)=>new T.Vector3(x,y,z);

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
     重定向期间 root.matrix 是单位阵,所以骨骼的"世界坐标"就是角色自己的空间:面朝 +Z、头顶 +Y、左手 +X、真实尺寸。 */
  const B={},restL={},restP={},restW={},restWinv={},restPos={};
  const _q=new T.Quaternion(),_pq=new T.Quaternion(),_m=new T.Matrix4(),_v=new T.Vector3();
  const wpos=(n,out)=>B[n].getWorldPosition(out||new T.Vector3());
  function setW(bone,qw){bone.parent.getWorldQuaternion(_pq);bone.quaternion.copy(_pq.invert()).multiply(qw);bone.updateMatrixWorld(true);}
  const perp=(v,d)=>{const p=v.clone().addScaledVector(d,-v.dot(d));return p.lengthSq()>1e-8?p.normalize():null;};
  function aim(name,child,dir){
    const cur=wpos(child).sub(wpos(name)).normalize();
    _q.setFromUnitVectors(cur,dir);const qw=_q.clone().multiply(B[name].getWorldQuaternion(new T.Quaternion()));setW(B[name],qw);
  }
  const basisQ=(f,n)=>{const s=new T.Vector3().crossVectors(f,n);return new T.Quaternion().setFromRotationMatrix(_m.makeBasis(f,n,s));};
  const signedAngle=(a,b,axis)=>Math.atan2(axis.dot(new T.Vector3().crossVectors(a,b)),a.dot(b));
  /* 两骨 IK。bend:静止姿势下这个关节弯起来时末端摆向哪边(手臂 +Z,腿 -Z)——用来把上段骨头拧到弯折面上 */
  function solveLimb(L,target,pole){
    const s=wpos(L.up),d=target.clone().sub(s);let dist=d.length();
    if(dist<1e-6){d.set(0,-1,0);dist=1e-6;}else d.multiplyScalar(1/dist);
    dist=clamp(dist,Math.abs(L.l1-L.l2)+.004,(L.l1+L.l2)*.998);
    const x=(L.l1*L.l1-L.l2*L.l2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,L.l1*L.l1-x*x));
    const p=perp(pole,d)||perp(V(0,0,1),d)||V(1,0,0);
    const elbow=s.clone().addScaledVector(d,x).addScaledVector(p,h),wrist=s.clone().addScaledVector(d,dist);
    const d1=elbow.clone().sub(s).normalize();
    aim(L.up,L.fore,d1);
    const wantB=perp(wrist.clone().sub(elbow),d1);
    if(wantB&&h>.015){
      const q=B[L.up].getWorldQuaternion(new T.Quaternion());
      const cur=perp(L.bend.clone().applyQuaternion(q.clone().multiply(restWinv[L.up])),d1);
      if(cur){const ang=signedAngle(cur,wantB,d1)*clamp(h/(.22*L.l1),0,1);setW(B[L.up],new T.Quaternion().setFromAxisAngle(d1,ang).multiply(q));}
    }
    aim(L.fore,L.hand,wrist.clone().sub(wpos(L.fore)).normalize());
    return wrist;
  }
  const LIMB={};
  const FINGERS=["Index","Middle","Ring","Pinky"],FEET=["LeftFoot","RightFoot","LeftToeBase","RightToeBase","LeftToe_End","RightToe_End"];
  const footMin=()=>{let m=Infinity;for(const n of FEET)if(B[n]){wpos(n,_v);if(_v.y<m)m=_v.y;}return m;};
  function resetPose(){for(const n in B){B[n].quaternion.copy(restL[n]);}B.Hips.position.copy(restP.Hips);}
  function curlFingers(sideName,L,rad){
    _q.setFromAxisAngle(L.curlAxis,rad);
    for(const fn of FINGERS)for(let i=1;i<=3;i++){const n=sideName+"Hand"+fn+i,b=B[n];if(!b)continue;
      b.quaternion.copy(restL[n]).multiply(restWinv[n]).multiply(_q).multiply(restW[n]);}
  }

  /* 手指不能插进球里。量的是食/中/无名/小指和拇指的第 2~4 节骨点到球心的距离(骨点在手指中心线上,
     指肚贴球时骨点会在球面里 ~1cm,所以留 REST 的余量)。先少握一点(二分),伸直了还是插进去就把手整体往外推(只推辅助手;
     投篮手的手掌是贴着球定的,伸直了也插进去就保持伸直)。 */
  const FNAMES={Left:[],Right:[]};
  for(const sd of ["Left","Right"]){for(const f of FINGERS)for(let i=2;i<=4;i++)FNAMES[sd].push(sd+"Hand"+f+i);for(let i=2;i<=4;i++)FNAMES[sd].push(sd+"HandThumb"+i);}
  const _fv=new T.Vector3();
  function clearOf(side,c,r){
    let w=1e9,p=null;
    for(const n of FNAMES[side]){const b=B[n];if(!b)continue;b.getWorldPosition(_fv);const d=_fv.distanceTo(c)-r;if(d<w){w=d;if(!p)p=new T.Vector3();p.copy(_fv);}}
    return {w,p};
  }
  function fitFingers(side,L,c,r,rad0,push){
    const REST=.012;
    for(let it=0;it<4;it++){
      curlFingers(side,L,rad0);let o=clearOf(side,c,r);if(o.w>=-REST)return;
      curlFingers(side,L,0);o=clearOf(side,c,r);
      if(o.w>=-REST){let lo=0,hi=rad0;for(let k=0;k<7;k++){const m=(lo+hi)/2;curlFingers(side,L,m);if(clearOf(side,c,r).w>=-REST)lo=m;else hi=m;}curlFingers(side,L,lo);return;}
      if(!push||!o.p)return;
      push(o.p.clone().sub(c).normalize().multiplyScalar(-(o.w+REST)*1.1));
    }
  }

  /* ---------- 3. 建模型:缩放、量静止姿势、切第一人称用的前臂网格、读 run 动画 ---------- */
  /* 换了球星:丢掉上一个模型留下的全部骨骼表,下次渲染再按新球星加载 */
  function unload(){
    if(state.root&&state.root.parent)state.root.parent.remove(state.root);
    for(const o of [B,restL,restP,restW,restWinv,restPos,LIMB])for(const k in o)delete o[k];
    Object.assign(state,{root:null,M:null,mesh:null,fp:null,run:null,ready:false,player:null,modelId:null,failed:false,ballMoved:false,guideOff:null,oursG:null,airTop:0,landT:null,landV:0,airPrev:0,airVel:0});
  }
  function build(gltf,id){
    const root=new T.Group();root.name="tripoAvatar";root.matrixAutoUpdate=false;root.visible=false;
    const M=new T.Group();M.rotation.y=MODELS[id].yaw;root.add(M);M.add(gltf.scene);
    let mesh=null;
    gltf.scene.traverse(o=>{o.frustumCulled=false;o.userData.tripo=true;if(o.isSkinnedMesh&&!mesh)mesh=o;if(o.isBone)B[o.name.replace(/^mixamorig:?/,"")]=o;});
    if(!mesh||!B.Hips)throw new Error(MODELS[id].file+" 里没有蒙皮网格或骨骼");
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
    for(const n in B){restL[n]=B[n].quaternion.clone();restP[n]=B[n].position.clone();restW[n]=B[n].getWorldQuaternion(new T.Quaternion());restWinv[n]=restW[n].clone().invert();restPos[n]=wpos(n);}
    for(const [k,side] of [["R","Right"],["L","Left"]]){
      const a=LIMB["arm"+k]={up:side+"Arm",fore:side+"ForeArm",hand:side+"Hand",bend:V(0,0,1)};
      a.l1=restPos[a.up].distanceTo(restPos[a.fore]);a.l2=restPos[a.fore].distanceTo(restPos[a.hand]);
      const f=restPos[side+"HandMiddle1"].clone().sub(restPos[a.hand]);a.palm=f.length()*.8;f.normalize();
      const n=perp(V(0,-1,0),f);   // T-pose 掌心朝下
      a.restBasisInv=basisQ(f,n).invert();a.curlAxis=new T.Vector3().crossVectors(f,n).normalize();
      const l=LIMB["leg"+k]={up:side+"UpLeg",fore:side+"Leg",hand:side+"Foot",bend:V(0,0,-1)};
      l.l1=restPos[l.up].distanceTo(restPos[l.fore]);l.l2=restPos[l.fore].distanceTo(restPos[l.hand]);
    }
    /* 第一人称网格:只留主要受前臂/手/手指骨影响的三角面,和主网格共用同一副骨骼 */
    const geo=mesh.geometry,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,names=mesh.skeleton.bones.map(b=>b.name);
    const keep=new Uint8Array(si.count);
    for(let v=0;v<si.count;v++){let bi=0,bw=-1;for(let k=0;k<4;k++){const w=sw.array[v*4+k];if(w>bw){bw=w;bi=si.array[v*4+k];}}keep[v]=/(ForeArm|Hand)/.test(names[bi]||"")?1:0;}
    const src=geo.index.array,out=[];
    for(let i=0;i<src.length;i+=3)if(keep[src[i]]&&keep[src[i+1]]&&keep[src[i+2]])out.push(src[i],src[i+1],src[i+2]);
    const g2=geo.clone();g2.setIndex(new T.BufferAttribute(new src.constructor(out),1));
    const fp=new T.SkinnedMesh(g2,mesh.material);fp.name="tripoFpArms";fp.frustumCulled=false;fp.userData.tripo=true;
    fp.position.copy(mesh.position);fp.quaternion.copy(mesh.quaternion);fp.scale.copy(mesh.scale);
    mesh.parent.add(fp);fp.bind(mesh.skeleton,mesh.bindMatrix);fp.visible=false;
    Object.assign(state,{root,M,mesh,fp,modelId:id,base:M.position.clone(),scale:s,footRest:footMin(),hipY:restPos.Hips.y});
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
      for(let i=0;i<=N;i++){resetPose();applyRun(i/N,1,0);state.root.updateMatrixWorld(true);L.push(wpos("LeftToeBase"));R.push(wpos("RightToeBase"));}
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
    Object.assign(state,{player:guy,armIdx,legIdx,soleY,ready:true,tA:0,prevX:null,prevZ:null,holdW:0,runW:0,armHold:0});
    return true;
  }

  /* ---------- 5. 每次渲染前:重定向 ---------- */
  const _gInv=new T.Matrix4(),_rm=new T.Matrix4(),_rp=new T.Vector3(),_rs=new T.Vector3(),_gp=new T.Vector3(),_gq=new T.Quaternion(),_gs=new T.Vector3();
  const I0=new T.Quaternion(),Xax=V(1,0,0);
  function retarget(){
    const guy=state.player,g=guy.g,ball=ballNow(),root=state.root,M=state.M;
    g.updateWorldMatrix(true,true);
    const gInv=_gInv.copy(g.matrixWorld).invert();
    const Sc=V(Math.abs(g.scale.x),Math.abs(g.scale.y),Math.abs(g.scale.z));   // AIBA 的体型缩放 / 落地挤压,读位置时乘回真实尺寸
    const loc=n=>new T.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(gInv).multiply(Sc);
    const rot=n=>{const q=new T.Quaternion();_rm.multiplyMatrices(gInv,n.matrixWorld).decompose(_rp,q,_rs);return q;};
    /* 用游戏时钟:慢动作、暂停、回放时过渡和相位跟着游戏走,不跟墙上时间走 */
    let now=performance.now();try{if(typeof G!=="undefined"&&G&&Number.isFinite(G.tNow))now=G.tNow*1000;}catch(e){}
    const dt=Math.min(.1,Math.max(0,(now-(state.tA||now))/1000));state.tA=now;
    const moving=movingNow(guy),holding=holdingNow(ball),air=airNow();
    const ease=(cur,to,tau)=>cur+(to-cur)*Math.min(1,dt/tau);
    state.runW=state.run?ease(state.runW,moving?1:0,.14):0;
    state.holdW=ease(state.holdW,holding?1:0,.15);
    state.armHold=ease(state.armHold,(holding||catchNow())?1:0,.12);
    const rw=state.runW*state.runW*(3-2*state.runW),hw=state.holdW*state.holdW*(3-2*state.holdW);

    /* 跑动相位:按这一帧实际走过的距离推进,一个循环对应 run.stride 这么远 */
    g.matrixWorld.decompose(_gp,_gq,_gs);
    if(state.prevX!=null&&state.run){const d=Math.hypot(_gp.x-state.prevX,_gp.z-state.prevZ);if(d<1.5)state.phase+=d/state.run.stride;}
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
    if(state.landT!=null&&!moving)squat+=state.landGain*state.landV*state.landT*Math.exp(-state.landT/state.landTau)*groundK;
    state.squat=squat=Math.min(squat,.24);
    root.updateMatrixWorld(true);

    /* 躯干:读 AIBA 胸腔和头这一帧的朝向,分到 骨盆 / 腰 / 胸 / 颈 / 头 */
    if(!state.shell||state.shell.parent!==g)state.shell=g.children.find(n=>n.name==="jerseyShell")||null;
    const qT=state.shell?rot(state.shell):new T.Quaternion();
    const qPel=I0.clone().slerp(qT,.15),qSp=I0.clone().slerp(qT,.53),qCh=qT.clone();
    if(loadK>.001&&tilt>.02){
      const ct=Math.max(0,tilt-.04)*loadK,ax=k=>new T.Quaternion().setFromAxisAngle(Xax,-ct*k);
      qPel.multiply(ax(.4));qSp.multiply(ax(.45));qCh.multiply(ax(.15));
    }
    const qH=guy.headRoot?rot(guy.headRoot):qCh.clone();
    const put=(n,q)=>{if(B[n])setW(B[n],q.clone().multiply(restW[n]));};
    put("Hips",qPel);put("Spine",qSp);put("Spine1",qSp.clone().slerp(qCh,.5));put("Spine2",qCh);
    put("Neck",qCh.clone().slerp(qH,.5));put("Head",qH);

    /* 腿:脚踝跟着 AIBA 脚踝的落点走(挪到这副骨架自己的胯宽和踝高上),反解膝盖;脚掌朝向照抄 */
    const Zf=()=>V(0,0,1);
    for(const [sd,s,side] of [["L",1,"Left"],["R",-1,"Right"]]){
      const l=state.legIdx[sd],L=LIMB["leg"+sd];
      const hipA=loc(guy.legs[l]),kneeA=loc(guy.knees[l]),ankA=loc(guy.ankles[l]),rf=restPos[side+"Foot"];
      const tg=ankA.clone();tg.x+=rf.x-s*.125;tg.y+=rf.y-.12*Sc.y;tg.y+=squat;
      const fwT=Zf().applyQuaternion(rot(guy.legs[l]));
      const pole=kneeA.clone().sub(hipA.clone().add(ankA).multiplyScalar(.5)).addScaledVector(fwT,.03);
      solveLimb(L,tg,pole);
      put(side+"Foot",rot(guy.footRoots[l]));
    }

    /* 手臂:复制 AIBA 手臂的方向和伸展比例(不照搬位置:肩宽、臂长都不一样) */
    const arm={};
    for(const [sd,side] of [["R","Right"],["L","Left"]]){
      const a=state.armIdx[sd],L=LIMB["arm"+sd];
      const S0=wpos(L.up),Sa=loc(guy.arms[a]),Ea=loc(guy.elbows[a]),Wa=loc(guy.handRoots[a]),qA=rot(guy.handRoots[a]);
      const La=Ea.distanceTo(Sa)+Wa.distanceTo(Ea),Lk=L.l1+L.l2,s=sd==="L"?1:-1;
      const free=S0.clone().addScaledVector(Wa.clone().sub(Sa).normalize(),Math.min(.995,Wa.distanceTo(Sa)/La)*Lk);
      const low=clamp((1.22-free.y)/.2,0,1)*Math.max(0,1-Math.abs(free.z)/.28);       // 垂手时别插进短裤
      if(low>0&&s*free.x<.25)free.x=s*(s*free.x+(.25-s*free.x)*low);
      let pole=Ea.clone().sub(Sa.clone().add(Wa).multiplyScalar(.5));if(pole.lengthSq()<1e-6)pole=V(s*.3,-.2,-1);
      /* 持球时肘部放松外张:方块人的肘是贴着身体夹住的,真人抱球时两肘自然离开躯干。
         手举过肩(举球、出手)时逐渐收回,投篮手的肘要回到球的正下方。 */
      {const fl=state.elbowOut*hw*clamp((S0.y+.02-free.y)/.3,0,1);if(fl>.001)pole.normalize().add(V(s*fl,0,-.25*fl));}
      arm[sd]={a,L,side,S0,Sa,Ea,Wa,qA,free,pole,
        N:V(0,0,-1).applyQuaternion(qA),F:V(0,-1,0).applyQuaternion(qA)};   // AIBA 的手:手指 -Y、掌心 -Z
    }
    const setHand=A=>setW(B[A.L.hand],basisQ(A.F,A.N).multiply(A.L.restBasisInv).multiply(restW[A.L.hand]));
    curlFingers("Right",LIMB.armR,.2+.3*rw*(1-state.armHold)+state.holdCurl*hw);curlFingers("Left",LIMB.armL,.2+.3*rw*(1-state.armHold)+state.holdCurl*hw);
    root.updateMatrixWorld(true);
    const R=arm.R,Lf=arm.L;
    solveLimb(R.L,R.free,R.pole);setHand(R);
    /* 球:贴在投篮手掌心。辅助手按 AIBA 里"手腕相对球心"的关系摆到这颗球旁边 */
    let ballK=null,ballR=0;
    const grip=guy.ballGrips&&guy.ballGrips[R.a];
    /* 出手瞬间:手腕已经压下去了,球要从指尖滚出去,不能还停在掌心 */
    let roll=0;try{const st=window.AIBAMotion&&AIBAMotion.stats&&AIBAMotion.stats();if(st&&st.pendingRelease&&st.followActive)roll=clamp(st.followAge/.092,0,1);}catch(e){}
    if(holding&&ball){
      const br=BALL_R*Math.max(ball.scale.x,.01);ballR=br;
      /* 球心相对手腕的向量直接取自 AIBA 那只手(方块手里球本来就在掌心),手的朝向已经抄过来了 */
      /* 这只手比方块手小,AIBA 手腕到球心的距离照搬会让球悬在掌心外面:只保留侧向偏移,沿指向/掌心法向按这只手的尺寸重新定 */
      const rel0=grip?loc(grip).sub(R.Wa):new T.Vector3();
      const side=rel0.clone().addScaledVector(R.F,-rel0.dot(R.F)).addScaledVector(R.N,-rel0.dot(R.N)).multiplyScalar(.4);
      ballK=wpos(R.L.hand).add(side).addScaledVector(R.F,state.ballAlong+.11*roll*roll).addScaledVector(R.N,br+state.ballLift+.01*roll);
    }
    const tL=Lf.free.clone();
    if(ballK&&grip){
      const rel=Lf.Wa.clone().sub(loc(grip)).multiplyScalar(.86);
      const tg=ballK.clone().add(rel);state.guideOff=tg.clone().sub(Lf.free);
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
      fitFingers("Right",R.L,ballK,ballR,rad0,null);
      fitFingers("Left",Lf.L,ballK,ballR,rad0,off=>{tL.add(off);solveLimb(Lf.L,tL,Lf.pole);setHand(Lf);});
    }

    /* 跑动:换成模型自带的 run 动画 */
    if(rw>.001){applyRun(state.phase,rw,state.armHold);}

    /* 摆到 AIBA 球员的位置上。跑动时不要 AIBA 那套身体起伏和侧倾(动画里自带),只取水平位置和朝向 */
    const fw=Zf().applyQuaternion(_gq),yawQ=new T.Quaternion().setFromAxisAngle(V(0,1,0),Math.atan2(fw.x,fw.z));
    const rq=_gq.clone().slerp(yawQ,rw),rpos=_gp.clone();rpos.y*=1-rw;
    /* 贴地:鞋底最低点对齐地板;腾空时跟 AIBA 的鞋底高度走,但不低于地板 */
    root.updateMatrixWorld(true);
    const ours=footMin()-state.footRest;
    /* 腾空高度直接用游戏的起跳高度(一条抛物线),不经过任何平滑,否则离地/触地那两帧的速度会被改掉。
       上升段身体只跟抛物线走:脚在空中绷脚尖、收腿都不该把整个人再顶高一截(以前按"鞋底最低点"对齐,脚尖一绷髋就多涨 0.5 米/秒,提前出手换脚姿时还会抖)。
       下落段再平滑换回按鞋底最低点对齐,保证触地那一刻是脚尖正好碰到地板。 */
    let ref=ours;
    if(air<=.004){state.oursG=null;state.airTop=0;}
    else{
      /* 基准取离地第一帧(腿刚蹬直、脚还是平的);取离地前一帧会把没蹬完的那截算丢 */
      if(state.oursG==null)state.oursG=ours;
      state.airTop=Math.max(state.airTop||0,air);
      {const d=state.airTop>.02?clamp((state.airTop-air)/state.airTop,0,1):0;ref=state.oursG+(ours-state.oursG)*d;}
    }
    const floor=-rpos.y,off=floor+Math.max(0,air)*(1-rw)-ref;
    M.position.y+=off;
    root.matrix.compose(rpos,rq,V(g.scale.x<0?-1:1,1,1));
    root.updateMatrixWorld(true);

    /* 手里的球挪到这副手上,AIBA 出手从这里读;第一人称的显示球用同一个世界坐标 */
    state.ballWorld=null;
    if(ballK){ballK.y+=off;state.ballWorld=ballK.applyMatrix4(root.matrix);}
    if(ball&&grip&&ball.parent===grip){
      const w=state.ballWorld?state.ballWorld.clone():wpos(R.L.hand);
      state.ballShift=w.clone().sub(new T.Vector3().setFromMatrixPosition(grip.matrixWorld));
      if(window.AIBAKobe)AIBAKobe.ballShift=state.ballShift;   // 回放 / 传球读这个字段把球对到画面上的手
      ball.position.copy(w.applyMatrix4(_m.copy(grip.matrixWorld).invert()));state.ballMoved=true;
    }
  }

  /* ---------- 6. 渲染钩子 ---------- */
  const hidden=[];
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
  function shrinkBalls(g,held,fpBall){
    const out=[];
    const set=(m,k)=>{if(!m||!m.scale||k>.999)return;out.push([m,m.scale.clone()]);m.scale.multiplyScalar(k);};
    if(held)set(held,BALL_VIS);if(fpBall)set(fpBall,BALL_VIS);
    try{
      if(typeof balls!=="undefined"&&balls.length){
        g.getWorldPosition(_pp);
        for(const b of balls){if(!b||!b.mesh||b.mesh===held)continue;
          b.mesh.getWorldPosition(_bp);const d=Math.hypot(_bp.x-_pp.x,_bp.z-_pp.z),t=clamp((d-.8)/3.2,0,1);
          set(b.mesh,BALL_VIS+(1-BALL_VIS)*t*t*(3-2*t));}
      }
    }catch(e){}
    try{
      const drop=m=>{if(!m||!m.visible||!m.scale)return;const r0=BALL_R*m.scale.y;out.push([m,m.scale.clone(),m.position.y]);m.scale.multiplyScalar(BALL_VIS);m.position.y-=r0*(1-BALL_VIS);};
      if(typeof rackBalls!=="undefined")for(const r of rackBalls)if(r)for(const m of r)drop(m);
      if(typeof deepBalls!=="undefined")for(const m of deepBalls)drop(m);
    }catch(e){}
    return out;
  }
  function hookRenderer(){
    const svc=window.AIBA&&AIBA.runtime&&AIBA.runtime.service&&AIBA.runtime.service("rendering:core");
    const R=(svc&&svc.renderer)||(typeof renderer!=="undefined"?renderer:null);
    if(!R||R.__tripo){if(!R)setTimeout(hookRenderer,200);return;}
    R.__tripo=true;const orig=R.render.bind(R);
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
          if(window.AIBAKobe&&!AIBAKobe.ready)AIBAKobe.ballShift=null;}
        return orig(sc,cam);
      }
      const guy=guyNow();
      if(!guy||!guy.g||!guy.handRoots||!guy.handRoots.length||sc!==sceneNow()){root.visible=false;return orig(sc,cam);}
      if(state.player!==guy||root.parent!==sc){try{attach(guy);}catch(e){oops(e);}}
      if(!state.ready){root.visible=false;return orig(sc,cam);}
      if(!state.fpRig||state.fpRig.parent!==sc)state.fpRig=sc.getObjectByName("fpSharedPoseRig")||null;
      const tp=visibleInScene(guy.g),fpOn=!tp&&!!state.fpRig&&visibleInScene(state.fpRig);
      if(!tp&&!fpOn){root.visible=false;return orig(sc,cam);}
      const mirror=sc.scale&&sc.scale.y<0;   // 地板倒影那一遍沿用正常那一遍算好的骨骼
      const held=ballNow(),fpBall=fpBallNow();
      const shrunk=shrinkBalls(guy.g,held,fpOn?fpBall:null);
      if(!mirror)try{retarget();}catch(e){oops(e);}
      root.visible=true;state.mesh.visible=tp;state.fp.visible=fpOn;
      if(tp)hideTree(guy.g,held,null);
      let moved=[];
      if(fpOn){
        hideTree(state.fpRig,fpBall,null);
        /* 第一人称的显示球挂在方块手的 ballGrip 上,挪到这副手的掌心 */
        if(fpBall&&fpBall.parent&&state.ballWorld){
          fpBall.parent.updateWorldMatrix(true,false);
          moved.push([fpBall,fpBall.position.clone()]);
          fpBall.position.copy(state.ballWorld).applyMatrix4(_m.copy(fpBall.parent.matrixWorld).invert());
        }
      }
      try{const p=state.ballShift&&passNow();if(p){const e=p.k*p.k*(3-2*p.k);moved.push([p.mesh,p.mesh.position.clone()]);p.mesh.position.addScaledVector(state.ballShift,e);}}catch(e){}
      try{return orig(sc,cam);}
      finally{
        for(const o of hidden)o.visible=true;hidden.length=0;
        for(const m of moved)m[0].position.copy(m[1]);
        for(const r of shrunk){r[0].scale.copy(r[1]);if(r[2]!=null)r[0].position.y=r[2];}
        root.visible=false;
      }
    };
  }
  hookRenderer();
})();
