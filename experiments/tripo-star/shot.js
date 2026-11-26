/* 4 套 NBA 2K 球星投篮包（库里 / 克莱 / 科比 / 布克）+ 原版备份对照（v3）
   设计原则：完整保留原版备份的 5 大优势：
   1) 真屈髋扎地下盘 + 临界阻尼落地弹簧 + 前脚掌先着地
   2) 逐帧二分防穿模贴球手指 (fitFingers) + 胸前自然展肘→举球收肘
   3) 严格离手时序（手腕伸直指尖离手，离手后 tau>0 才压腕鹅颈，单轴干净不侧翻）
   4) 清晰可读的节奏曲线（C2 五次平滑 + 三次贝塞尔连续球路 + 连续抛物线腾空）
   并在此底盘上精准叠加：起跳髋→胸错峰扭转、空中 Sweep & Sway 弯弓、头部锁筐、~47° 自然手腕限幅。 */
(function(){
"use strict";
const BALL_R=0.12;
const GRAV=9.8;
const R=d=>d*Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const s5=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const mix=(a,b,k)=>a+(b-a)*k;
const mix3=(a,b,k)=>a.clone().lerp(b,k);
function bezier3(p0,p1,p2,p3,t){
  const u=1-t, u2=u*u, t2=t*t;
  return V(
    u2*u*p0.x + 3*u2*t*p1.x + 3*u*t2*p2.x + t2*t*p3.x,
    u2*u*p0.y + 3*u2*t*p1.y + 3*u*t2*p2.y + t2*t*p3.y,
    u2*u*p0.z + 3*u2*t*p1.z + 3*u*t2*p2.z + t2*t*p3.z
  );
}

// ---- 5 套投篮包参数（原版备份 + 4 套球星包） ----
const PROFILES={
  legacy:{
    isLegacy:true,
    name:'原版备份 Legacy', desc:'备份前的游戏原投篮曲线（对照基准）',
    hold:.40, loadDur:1.00, jumpH:.55*(1.98/1.8), releaseFrac:1.0,
    snapDur:.105, fhold:.24, fade:.38, landDur:.30,
    rimD:4.19, rimH:3.05, flight:1.15,
    dipDepth:1.0, kneeLoad:56, hipLoad:28, leanLoad:10,
    turnCoilHip:0, turnCoilChest:0, turnPeakHip:0, turnPeakChest:0,
    swayHip:0, swaySpine:-1.7, sweepR:0, sweepL:0, airKnee:0,
    landKnee:47, landHip:14,
    dipPos:V(-.13,-.31,.34), setPos:V(-.13,.39,.29), relPos:V(-.09,.91,.11), guidePeelY:.91
  },
  curry:{
    name:'库里 Curry', desc:'极速一段式 · 额上顶肘 65° 上升期出手',
    hold:.30, loadDur:.36, jumpH:.38, releaseFrac:0.78,
    snapDur:.105, fhold:.24, fade:.34, landDur:.36,
    rimD:4.19, rimH:3.05, flight:1.12,
    dipDepth:1.0, kneeLoad:52, hipLoad:30, leanLoad:11,
    turnCoilHip:6, turnCoilChest:2, turnPeakHip:18, turnPeakChest:25,
    swayHip:-3.5, swaySpine:-5.5, sweepR:16, sweepL:11, airKnee:15,
    landKnee:28, landHip:17,
    dipPos:V(-.10,-.35,.35), setPos:V(-.09,.39,.31), relPos:V(-.06,.75,.34), guidePeelY:.37
  },
  klay:{
    name:'克莱 Klay', desc:'教科书一段式 · 高肘 69° 直线长定格',
    hold:.30, loadDur:.40, jumpH:.46, releaseFrac:0.91,
    snapDur:.115, fhold:.38, fade:.38, landDur:.36,
    rimD:4.19, rimH:3.05, flight:1.15,
    dipDepth:.68, kneeLoad:48, hipLoad:27, leanLoad:10,
    turnCoilHip:5, turnCoilChest:3, turnPeakHip:12, turnPeakChest:17,
    swayHip:-2.5, swaySpine:-4.5, sweepR:12, sweepL:9, airKnee:13,
    landKnee:28, landHip:17,
    dipPos:V(-.10,-.30,.34), setPos:V(-.10,.44,.29), relPos:V(-.06,.80,.31), guidePeelY:.42
  },
  kobe:{
    name:'科比 Kobe', desc:'经典高跳二段式 · 头顶高肘 72° 滞空后仰',
    hold:.30, loadDur:.46, jumpH:.64, releaseFrac:1.04,
    snapDur:.125, fhold:.42, fade:.42, landDur:.42,
    rimD:4.19, rimH:3.05, flight:1.18,
    dipDepth:1.12, kneeLoad:58, hipLoad:34, leanLoad:13,
    turnCoilHip:8, turnCoilChest:3, turnPeakHip:19, turnPeakChest:28,
    swayHip:-5.5, swaySpine:-9.5, sweepR:24, sweepL:16, airKnee:17,
    landKnee:36, landHip:22,
    dipPos:V(-.11,-.38,.35), setPos:V(-.09,.52,.25), relPos:V(-.05,.86,.28), guidePeelY:.48
  },
  booker:{
    name:'布克 Booker', desc:'高弹跳紧凑型 · 额上顶肘 70° 顶点拨指',
    hold:.30, loadDur:.42, jumpH:.58, releaseFrac:0.98,
    snapDur:.110, fhold:.30, fade:.36, landDur:.38,
    rimD:4.19, rimH:3.05, flight:1.15,
    dipDepth:.88, kneeLoad:54, hipLoad:31, leanLoad:11.5,
    turnCoilHip:6, turnCoilChest:2, turnPeakHip:16, turnPeakChest:22,
    swayHip:-4, swaySpine:-7, sweepR:18, sweepL:13, airKnee:15,
    landKnee:34, landHip:20,
    dipPos:V(-.10,-.34,.34), setPos:V(-.10,.46,.28), relPos:V(-.06,.82,.30), guidePeelY:.44
  }
};

let curKey='curry';
const P=()=>PROFILES[curKey];

function timeline(p){
  if(p.isLegacy){
    const tRelease=p.hold+p.loadDur+.092, total=p.hold+p.loadDur+1.9;
    return {v0:Math.sqrt(2*GRAV*p.jumpH),tApex:Math.sqrt(2*p.jumpH/GRAV),tAir:2*Math.sqrt(2*p.jumpH/GRAV),tTakeoff:p.hold+p.loadDur*.76,tRelease,tLand:p.hold+p.loadDur+Math.sqrt(2*p.jumpH/GRAV),total};
  }
  const v0=Math.sqrt(2*GRAV*p.jumpH);
  const tApex=v0/GRAV;
  const tAir=2*tApex;
  const tTakeoff=p.hold+p.loadDur;
  const tRelease=tTakeoff+tApex*p.releaseFrac;
  const tLand=tTakeoff+tAir;
  const total=Math.max(tLand+p.landDur+.32, tRelease+p.snapDur+p.fhold+p.fade+.25);
  return {v0,tApex,tAir,tTakeoff,tRelease,tLand,total};
}

function sample(t){
  const p=P(), tl=timeline(p);
  // 1. 保留原版扎实下蹲蓄力：C2 连续下沉，在起跳离地瞬间顺势蹬伸完毕
  const loadPh=(t-p.hold)/p.loadDur;
  const dip=loadPh<=0?0:(loadPh<1?Math.sin(Math.PI*s5(loadPh)):0);
  // 2. 连续抛物线腾空（零速度断点）
  let jumpY=0, airK=0;
  if(t>tl.tTakeoff && t<tl.tLand){
    const dt=t-tl.tTakeoff;
    jumpY=Math.max(0, tl.v0*dt - 0.5*GRAV*dt*dt);
    airK=clamp(jumpY/p.jumpH,0,1);
  }
  // 3. 保留原版临界阻尼落地弹簧（快速承重吸收冲击，柔和站回，而非机械正弦）
  let land=0;
  if(t>tl.tLand){
    const lt=t-tl.tLand, tauL=p.landDur*0.30;
    land=clamp((lt/tauL)*Math.exp(1-lt/tauL),0,1)*(lt<p.landDur*1.6?1:0);
  }
  // 4. 上肢发力进度 u（0=Hold -> 1=Release 离手点）
  const u=s5((t-p.hold)/(tl.tRelease-p.hold));
  // 5. 严格离手后才压腕（tau > 0 球已飞出）
  const tau=t-tl.tRelease;
  const snap=tau>0?s5(tau/p.snapDur):0;
  const rec=tau>0?s5((tau-p.snapDur-p.fhold)/p.fade):0;
  // 6. 起跳发力链错峰：髋先甩、胸肩 0.06s 后顺势甩入投篮线
  const hipWhip=s5((t-(tl.tTakeoff-.10))/(tl.tRelease-(tl.tTakeoff-.10)+.04));
  const chestWhip=s5((t-(tl.tTakeoff-.02))/(tl.tRelease-(tl.tTakeoff-.02)+.08));
  const turnFade=1-rec*0.65;

  const phase=t<p.hold?'持球 Hold':t<tl.tTakeoff?'蓄力起势 Load':tau<=0?(u<.72?'举球置点 Set':'推球伸腕 Push'):snap<1?'离手压腕 Snap':rec<.8?'空中跟随 Follow':'落地缓冲 Land';
  return {p,tl,t,dip,jumpY,airK,land,u,tau,snap,rec,hipWhip,chestWhip,turnFade,phase};
}

function off(k){ return (window.poseOffsets && Number(window.poseOffsets[k])) || 0; }

// ---- 保留原版真屈髋/前掌先着地 + 叠加起跳扭转与空中 Sweep & Sway ----
function bodyPose(s,noAir){
  const p=s.p, load=s.dip, land=s.land;
  const airSway=noAir?0:s5(s.airK)*(1-land);

  const hipTurn=(mix(p.turnCoilHip, p.turnPeakHip, s.hipWhip))*s.turnFade;
  const chestTurn=(mix(p.turnCoilChest, p.turnPeakChest, s.chestWhip))*s.turnFade;
  const spineTwist=chestTurn-hipTurn;

  const takeoffPush=s.t>s.tl.tTakeoff-.12 && s.t<s.tl.tTakeoff+.08 ? s5(1-Math.abs(s.t-s.tl.tTakeoff)/.12) : 0;
  const hipBase=p.hipLoad*load + p.landHip*land - 6*takeoffPush;
  const kneeBase=Math.max(0, p.kneeLoad*load + p.landKnee*land - 24*takeoffPush);
  const idleKnee=10*(1-clamp(load+s.airK+land,0,1));

  // 右脚微前错位（沿用原版 lead/trail 节奏）+ 空中前扫 Sweep
  const hipR=hipBase + 2.8*load + p.sweepR*airSway;
  const hipL=hipBase - 2.2*load + p.sweepL*airSway;
  const kneeR=kneeBase*.96 + p.airKnee*airSway + idleKnee;
  const kneeL=kneeBase*1.04 + (p.airKnee-2)*airSway + idleKnee;
  // 空中脚掌自然下垂 + 落地前脚掌先承接
  const footAir=noAir?0:(-10*takeoffPush + 28*airSway + 12*land);

  // 真屈髋前倾 + 空中 Sway 微后仰舒展 + 落地前倾缓冲
  const hipsTilt=p.leanLoad*.45*load + p.swayHip*airSway + 6.5*land;
  const spineBend=p.leanLoad*.55*load + p.swaySpine*airSway + 8.5*land;

  return {
    'Hips.tilt':hipsTilt + off('Hips.tilt'),
    'Hips.turn':hipTurn + off('Hips.turn'),
    'Spine.bend':spineBend + off('Spine.bend'),
    'Spine.twist':spineTwist + off('Spine.twist'),
    'Head.nod':-2 - 6*Math.max(s.u*(1-s.rec),airSway) + 4*land + off('Head.nod'),
    'Head.turn':-chestTurn*0.80 + off('Head.turn'),
    'RightUpLeg.lift':hipR + off('RightUpLeg.lift'),
    'LeftUpLeg.lift':hipL + off('LeftUpLeg.lift'),
    'RightLeg.flex':kneeR + off('RightLeg.flex'),
    'LeftLeg.flex':kneeL + off('LeftLeg.flex'),
    'RightFoot.pitch':(hipR-kneeR)*.86 + footAir + off('RightFoot.pitch'),
    'LeftFoot.pitch':(hipL-kneeL)*.86 + footAir + off('LeftFoot.pitch')
  };
}

// ---- 骨架与原版逐帧贴球防穿模手指工具 ----
const _q=new THREE.Quaternion(), _pq=new THREE.Quaternion(), _m=new THREE.Matrix4(), _v=new THREE.Vector3();
const wpos=(n,out)=>bones[n].getWorldPosition(out||new THREE.Vector3());
function setWorldQuat(bone,qw){ bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert()).multiply(qw); bone.updateMatrixWorld(true); }
function aim(bone,childName,dir){
  const a=wpos(bone.name.replace(/^mixamorig:?/,'')), c=wpos(childName);
  const cur=c.sub(a).normalize();
  _q.setFromUnitVectors(cur,dir); bone.getWorldQuaternion(_pq); const qw=_q.clone().multiply(_pq);
  setWorldQuat(bone,qw);
}
function orth(f,n){ return f.clone().addScaledVector(n,-f.dot(n)).normalize(); }
function basisQ(f,n){ const s=new THREE.Vector3().crossVectors(f,n); _m.makeBasis(f,n,s); return new THREE.Quaternion().setFromRotationMatrix(_m); }

const ARM={ R:{up:'RightArm',fore:'RightForeArm',hand:'RightHand',mid:'RightHandMiddle1'},
            L:{up:'LeftArm', fore:'LeftForeArm', hand:'LeftHand', mid:'LeftHandMiddle1'} };
const FINGERS=['Index','Middle','Ring','Pinky'];
const MAX_WRIST_BEND=0.84; // ~48° 自然上限，避免 90° 硬折
const FINGER_CASCADE={Index:0.86,Middle:1.0,Ring:1.14,Pinky:1.28};
const JOINT_WEIGHTS=[0.78,1.18,0.85];

function measure(){
  applyPose({});
  for(const k in ARM){ const a=ARM[k];
    a.l1=wpos(a.up).distanceTo(wpos(a.fore)); a.l2=wpos(a.fore).distanceTo(wpos(a.hand));
    const f=wpos(a.mid).sub(wpos(a.hand)); a.palm=f.length()*.8; f.normalize();
    const n=orth(V(0,-1,0),f);
    a.restBasisInv=basisQ(f,n).invert(); a.curlAxis=new THREE.Vector3().crossVectors(f,n).normalize();
  }
}
function solveArm(a,targetW,pole){
  const s=wpos(a.up), d=targetW.clone().sub(s);
  const dist=clamp(d.length(),Math.abs(a.l1-a.l2)+.01,(a.l1+a.l2)*.985), dir=d.normalize();
  const x=(a.l1*a.l1-a.l2*a.l2+dist*dist)/(2*dist), h=Math.sqrt(Math.max(0,a.l1*a.l1-x*x));
  const perp=orth(pole,dir), elbow=s.clone().addScaledVector(dir,x).addScaledVector(perp,h);
  aim(bones[a.up],a.fore,elbow.clone().sub(s).normalize());
  const wrist=s.clone().addScaledVector(dir,dist);
  aim(bones[a.fore],a.hand,wrist.sub(wpos(a.fore)).normalize());
}
function setHand(a,f,n,pitchDeg){
  const qTgt=basisQ(f,n).multiply(a.restBasisInv).multiply(restW[a.hand]);
  const qLo=bones[a.fore].getWorldQuaternion(new THREE.Quaternion());
  const qNeutral=qLo.multiply(restW[a.fore].clone().invert()).multiply(restW[a.hand]);
  const bend=qNeutral.angleTo(qTgt);
  if(bend>MAX_WRIST_BEND) qNeutral.slerp(qTgt,MAX_WRIST_BEND/bend);
  else qNeutral.copy(qTgt);
  if(pitchDeg){
    const axis=new THREE.Vector3().crossVectors(f,n).normalize();
    qNeutral.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,R(pitchDeg)));
  }
  setWorldQuat(bones[a.hand], qNeutral);
}
function curlFingers(a,side,rad){
  for(const fn of FINGERS){
    const fRad=rad*(FINGER_CASCADE[fn]||1);
    for(let i=1;i<=3;i++){ const n=side+'Hand'+fn+i, b=bones[n]; if(!b) continue;
      _q.setFromAxisAngle(a.curlAxis,fRad*JOINT_WEIGHTS[i-1]);
      b.quaternion.copy(rest[n]).multiply(restW[n].clone().invert()).multiply(_q).multiply(restW[n]); }
  }
  _q.setFromAxisAngle(a.curlAxis,rad*0.52);
  for(let i=2;i<=3;i++){ const n=side+'HandThumb'+i, b=bones[n]; if(!b) continue;
    b.quaternion.copy(rest[n]).multiply(restW[n].clone().invert()).multiply(_q).multiply(restW[n]); }
  if(bones[a.hand]) bones[a.hand].updateMatrixWorld(true);
}
// 移植原版 tripo-avatar.js 的逐帧二分贴球算法：手指刚好贴紧球面，绝不穿模
function clearOfBall(side,c,r){
  let worst=Infinity;
  for(const fn of FINGERS) for(let i=2;i<=4;i++){
    const b=bones[side+'Hand'+fn+i]; if(!b) continue;
    b.getWorldPosition(_v);
    const d=_v.distanceTo(c)-r-0.008;
    if(d<worst) worst=d;
  }
  return worst;
}
function fitFingersToBall(a,side,c,r,rad0){
  curlFingers(a,side,rad0);
  if(clearOfBall(side,c,r)>=-0.002) return;
  curlFingers(a,side,0);
  if(clearOfBall(side,c,r)>=-0.002){
    let lo=0, hi=rad0;
    for(let k=0;k<5;k++){
      const m=(lo+hi)*0.5; curlFingers(a,side,m);
      if(clearOfBall(side,c,r)>=-0.002) lo=m; else hi=m;
    }
    curlFingers(a,side,lo);
  }
}
function applyArmOffsets(sidePrefix,a){
  const rx=off(sidePrefix+'Arm.swing'), ry=off(sidePrefix+'Arm.fwd'), rz=off(sidePrefix+'Arm.raise'), ef=off(sidePrefix+'ForeArm.flex');
  const sgn=sidePrefix==='Left'?1:-1;
  if(rx||ry||rz){
    const q=bones[a.up].getWorldQuaternion(new THREE.Quaternion());
    if(rx) q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),R(-rx)));
    if(ry) q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),R(-ry*sgn)));
    if(rz) q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),R(rz*sgn)));
    setWorldQuat(bones[a.up],q);
  }
  if(ef){
    const q=bones[a.fore].getWorldQuaternion(new THREE.Quaternion());
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),R(-ef*sgn)));
    setWorldQuat(bones[a.fore],q);
  }
}

// ---- 球与篮筐 ----
const ball=new THREE.Group();
ball.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_R,32,20),new THREE.MeshStandardMaterial({color:0xc8632a,roughness:.85})));
const seamM=new THREE.MeshBasicMaterial({color:0x1a1210});
[[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]].forEach(r=>{ const m=new THREE.Mesh(new THREE.TorusGeometry(BALL_R*1.003,.0028,6,48),seamM); m.rotation.set(r[0],r[1],r[2]); ball.add(m); });
const hoop=new THREE.Group();
const rim=new THREE.Mesh(new THREE.TorusGeometry(.2286,.012,8,40),new THREE.MeshStandardMaterial({color:0xe2562a}));
rim.rotation.x=Math.PI/2; rim.position.set(0,3.05,4.19); hoop.add(rim);
const board=new THREE.Mesh(new THREE.PlaneGeometry(1.83,1.07),new THREE.MeshBasicMaterial({color:0xdde3ee,transparent:true,opacity:.28,side:THREE.DoubleSide}));
board.position.set(0,3.05+.38,4.19+.2286+.15); hoop.add(board);
ball.visible=false; hoop.visible=false; scene.add(ball); scene.add(hoop);

// ---- 原版备份游戏曲线 ----
const LEG_SHOULDER=V(0,1.36,0), LEG_ARM=.61;
const legEase=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function poseLegacy(t){
  const p=PROFILES.legacy, T={hold:p.hold,charge:p.loadDur,post:1.9,extend:p.snapDur,relAt:.092,fhold:p.fhold,fade:p.fade,land:p.landDur,jumpH:p.jumpH};
  const tc=t-T.hold, ph=clamp(tc/T.charge,0,1), age=tc-T.charge;
  const loadIn=legEase(ph/0.32), rise=legEase((ph-0.58)/0.28);
  const c={dip:loadIn*(1-rise), lift:legEase((ph-0.28)/0.48), rise, jmp:legEase((ph-0.76)/0.22)};
  let dip=c.dip, lift=c.lift, jmp=c.jmp, jumpY=c.jmp*T.jumpH, land=0, snap=0, rec=0;
  if(age>0){
    const tl=Math.sqrt(2*T.jumpH/GRAV);
    jumpY=Math.max(0,T.jumpH-.5*GRAV*age*age); jmp=jumpY/T.jumpH; dip=0;
    if(age>tl&&age<tl+T.land) land=Math.sin((age-tl)/T.land*Math.PI);
    snap=legEase(age/T.extend);
    rec=legEase((age-T.extend-T.fhold)/T.fade);
  }
  const armLift=age>0?1-rec:lift, armJmp=age>0?1-rec:c.jmp;
  const phase=tc<0?'持球 Hold':age<=0?(ph<.32?'下蹲蓄力 Load':ph<.76?'举球 Lift':'起跳 Jump'):age<T.relAt?'出手 Release':rec<1?'跟随 Follow':'落地 Land';
  const bp=(noAir)=>{
    const ld=dip*(1-jmp*.86), hip=.48*ld+.24*land-.06*jmp, knee=Math.max(0,.98*ld+.82*land-.78*jmp);
    const hipR=hip+.03*ld, hipL=hip-.03*ld, kneeR=knee*.96, kneeL=knee*1.04;
    const air=noAir?0:-.18*jmp+.52*jmp*(1-clamp(land,0,1))+.14*land;
    const D=r=>r*180/Math.PI;
    return {
      'Hips.tilt':off('Hips.tilt'), 'Hips.turn':off('Hips.turn'),
      'RightUpLeg.lift':D(hipR)+off('RightUpLeg.lift'), 'LeftUpLeg.lift':D(hipL)+off('LeftUpLeg.lift'),
      'RightLeg.flex':D(kneeR)+off('RightLeg.flex'), 'LeftLeg.flex':D(kneeL)+off('LeftLeg.flex'),
      'RightFoot.pitch':D((hipR-kneeR)*.98+air)+off('RightFoot.pitch'), 'LeftFoot.pitch':D((hipL-kneeL)*.98+air)+off('LeftFoot.pitch'),
      'Spine.bend':D(.175*ld-.03*jmp+.08*land)+off('Spine.bend'), 'Spine.twist':off('Spine.twist'),
      'Head.nod':-6*armLift+off('Head.nod'), 'Head.turn':off('Head.turn')
    };
  };
  applyPose(bp(true)); const groundY=root.position.y; applyPose(bp(false),0,groundY+jumpY);
  const mid=wpos('LeftArm').add(wpos('RightArm')).multiplyScalar(.5);
  const armRatio=(ARM.R.l1+ARM.R.l2)/LEG_ARM;
  const b=V(-0.13+0.04*armJmp, 0.82+0.23*(1-dip)+0.7*armLift+0.52*armJmp, 0.34-0.05*armLift-0.18*armJmp).sub(LEG_SHOULDER).multiplyScalar(armRatio).add(mid);
  const k=armLift, j=armJmp, w=snap*(1-rec);
  let nS=mix3(mix3(V(.75,.15,.6),V(0,.75,.65),k),V(0,.5,.85),j).normalize();
  let fS=mix3(mix3(V(0,1,.2),V(0,.6,-1),k),V(0,1,-.4),j);
  const wristS=b.clone().addScaledVector(nS,-BALL_R).addScaledVector(orth(fS,nS),-ARM.R.palm);
  nS=mix3(nS,V(0,-1,-.1),w).normalize(); fS=orth(mix3(fS,V(0,-.45,.9),w),nS);
  const nG=V(-.95,.05,.3).normalize(), fG=orth(mix3(V(0,1,.1),V(0,.9,-.4),k),nG);
  const wristG=b.clone().addScaledVector(nG,-BALL_R).addScaledVector(fG,-ARM.L.palm);
  curlFingers(ARM.R,'Right',clamp(.22*(1-w*.6)+R(off('RightHand.curl')),0,1.3));
  curlFingers(ARM.L,'Left',clamp(.22+R(off('LeftHand.curl')),0,1.3));
  root.updateMatrixWorld(true);
  solveArm(ARM.R,wristS,mix3(V(-.6,-.8,-.3),V(-.25,-.5,.85),k));
  solveArm(ARM.L,wristG,V(.8,-.7,.1));
  applyArmOffsets('Right',ARM.R); applyArmOffsets('Left',ARM.L);
  setHand(ARM.R,fS,nS,off('RightHand.pitch')); setHand(ARM.L,fG,nG,off('LeftHand.pitch'));
  const held=wpos(ARM.R.hand).addScaledVector(fS,ARM.R.palm).addScaledVector(nS,BALL_R);
  return {s:{p,t,jumpY,snap,tau:age-T.relAt,phase},held};
}

// ---- 4 套球星投篮包每帧求解 ----
let relPos=null, relVel=null;
function pose(t){
  if(curKey==='legacy') return poseLegacy(t);
  const s=sample(t), p=s.p;
  applyPose(bodyPose(s,true));
  const groundY=root.position.y;
  applyPose(bodyPose(s,false), 0, groundY+s.jumpY);
  const sL=wpos('LeftArm'), sR=wpos('RightArm'), mid=sL.clone().add(sR).multiplyScalar(.5);

  // C2 连续三次贝塞尔球路
  const holdPos=V(-.08,-.30,.34);
  const bRel=bezier3(holdPos, p.dipPos, p.setPos, p.relPos, s.u);
  const b=mid.clone().add(bRel);

  const u=s.u, w=s.snap*(1-s.rec), rec=s.rec, holding=s.tau<=0;
  const R_arm=ARM.R, L_arm=ARM.L;

  // 严格离手前手腕从 ~45° 平滑伸直到 0°(掌心朝前上)，球沿掌心滚上指尖单调上升
  const straightK=s5((u-0.68)/0.32);
  let nS=mix3(mix3(V(.42,.42,.80).normalize(),V(0,.78,.62).normalize(),s5(u/0.72)), V(0,.42,.91).normalize(), straightK).normalize();
  let fS=orth(mix3(mix3(V(0,.88,.45).normalize(),V(0,.62,-.78).normalize(),s5(u/0.72)), V(0,.91,-.41).normalize(), straightK), nS);

  const rollUp=s5((u-0.72)/0.28);
  let wristS=b.clone().addScaledVector(nS,-BALL_R).addScaledVector(fS,-R_arm.palm - 0.085*rollUp);

  // 离手之后(tau > 0)手腕才开始单轴下压鹅颈
  if(w>1e-4){
    nS=mix3(nS, V(0,-.78,.62), w).normalize();
    fS=orth(mix3(fS, V(0,-.62,.78), w), nS);
  }
  if(rec>1e-3){
    const relaxR=mid.clone().add(V(-.24,-.44,.16));
    wristS=mix3(wristS,relaxR,rec);
    nS=mix3(nS,V(.92,-.25,.28),rec).normalize();
    fS=orth(mix3(fS,V(0,-.96,.26),rec),nS);
  }

  // 辅助手：Set 点前紧贴球侧（防越界不穿投篮手），Set 点后原地平滑脱离
  const peel=s5((u-0.68)/0.28);
  const guideBall=mid.clone().add(bezier3(holdPos, p.dipPos, p.setPos, p.setPos, Math.min(u,0.78)));
  const nG=mix3(V(-.92,.08,.36),V(-.96,.05,.24),peel).normalize();
  const fG=orth(mix3(mix3(V(0,.95,.28),V(0,.90,-.35),s5(u/0.72)),V(0,.95,.22),peel),nG);
  let wristG=guideBall.clone().addScaledVector(nG,-BALL_R-.02-.05*peel).addScaledVector(fG,-L_arm.palm);
  wristG.y=Math.min(wristG.y, mid.y + p.guidePeelY - .06*peel);
  if(wristG.x < wristS.x + 0.06) wristG.x = wristS.x + 0.06; // 原版防越界约束
  if(rec>1e-3){
    const relaxL=mid.clone().add(V(.24,-.44,.16));
    wristG=mix3(wristG,relaxL,rec);
  }

  // 移植原版 tripo-avatar.js 胸前自然外张展肘 → 举球过肩平滑收正到球下
  const flR=0.85*(1-rec)*clamp((sR.y+.02-wristS.y)/.32,0,1);
  const flL=0.85*(1-rec)*clamp((sL.y+.02-wristG.y)/.32,0,1);
  const poleR=mix3(V(-.52,-.82,-.24),V(-.16,-.58,.80),s5(u/0.75)*(1-rec)).add(V(-flR,0,-.22*flR));
  const poleL=mix3(V(.72,-.68,.12),V(.62,-.75,.22),peel).add(V(flL,0,-.22*flL));

  root.updateMatrixWorld(true);
  solveArm(R_arm,wristS,poleR);
  solveArm(L_arm,wristG,poleL);
  applyArmOffsets('Right',R_arm);
  applyArmOffsets('Left',L_arm);
  setHand(R_arm,fS,nS,off('RightHand.pitch'));
  setHand(L_arm,fG,nG,off('LeftHand.pitch'));

  const held=wpos(R_arm.hand).addScaledVector(fS, R_arm.palm + 0.085*rollUp).addScaledVector(nS, BALL_R + 0.012*rollUp);

  // 持球段使用原版二分防穿模贴球拟合；离手后切回自然梯次随挥曲度
  const rCurl=clamp(.32 + .20*w - .10*rec + R(off('RightHand.curl')), 0, 1.3);
  const lCurl=clamp(.30 - .08*peel + R(off('LeftHand.curl')), 0, 1.3);
  if(holding && !off('RightHand.curl')){
    fitFingersToBall(R_arm,'Right',held,BALL_R,rCurl);
    if(peel<0.35 && !off('LeftHand.curl')) fitFingersToBall(L_arm,'Left',held,BALL_R,lCurl);
    else curlFingers(L_arm,'Left',lCurl);
  }else{
    curlFingers(R_arm,'Right',rCurl);
    curlFingers(L_arm,'Left',lCurl);
  }

  return {s,held};
}

function calcRelease(){
  const p=P(), tl=timeline(p);
  const r=pose(tl.tRelease);
  relPos=r.held.clone();
  const tgt=V(0,p.rimH,p.rimD), f=p.flight;
  relVel=V((tgt.x-relPos.x)/f,(tgt.y-relPos.y+.5*GRAV*f*f)/f,(tgt.z-relPos.z)/f);
}

const ui={
  play:document.getElementById('shotPlay'), stop:document.getElementById('shotStop'),
  speed:document.getElementById('shotSpeed'), style:document.getElementById('shotStyle'),
  copy:document.getElementById('shotCopy'), resetOff:document.getElementById('shotResetOff'),
  t:document.getElementById('shotT'), info:document.getElementById('shotInfo')
};
const Shot=window.Shot={
  active:false, playing:false, t:0, PROFILES, timeline,
  get TOTAL(){ return timeline(P()).total; },
  get style(){ return curKey; },
  setStyle(k){
    if(!PROFILES[k]) return;
    curKey=k;
    if(ui.style) ui.style.value=k;
    if(window.__ready){ calcRelease(); if(this.active){ this.render(); } }
  },
  updateParam(key, val){
    const p=P();
    if(key.includes('.')){ const [obj,prop]=key.split('.'); if(p[obj]) p[obj][prop]=val; }
    else p[key]=val;
    if(window.__ready){ calcRelease(); if(this.active) this.render(); }
  },
  setNormT(u01){ this.setT(clamp(u01,0,1)*this.TOTAL); },
  sample,
  init(){
    const qStyle=new URLSearchParams(location.search).get('style');
    if(qStyle&&PROFILES[qStyle]){ curKey=qStyle; if(ui.style) ui.style.value=qStyle; }
    measure(); calcRelease(); applyPose();
    if(new URLSearchParams(location.search).get('embed')==='1'){ this.start(); this.playing=false; this.setT(0); }
  },
  start(){ if(!relPos) this.init(); this.active=true; ball.visible=hoop.visible=true; target.set(0,1.45,1.4); if(dist<8) dist=9.0; },
  stop(){ this.active=this.playing=false; ball.visible=hoop.visible=false; target.set(0,.95,0); if(dist>6) dist=4.6; ui.play.textContent='▶ 播放投篮'; ui.info.textContent=''; },
  setT(t){ this.t=clamp(t,0,this.TOTAL); this.render(); },
  tick(dt){ if(this.playing){ this.t+=dt*(+ui.speed.value||1); if(this.t>=this.TOTAL) this.t=0; ui.t.value=this.t/this.TOTAL*1000; } this.render(); },
  render(){
    const {s,held}=pose(this.t), p=s.p, tau=s.tau;
    if(tau<=0){ ball.visible=true; ball.position.copy(held); ball.rotation.set(0,0,0); }
    else{
      ball.position.set(relPos.x+relVel.x*tau, relPos.y+relVel.y*tau-.5*GRAV*tau*tau, relPos.z+relVel.z*tau);
      ball.rotation.x=-tau*11;
      ball.visible=ball.position.y>BALL_R;
    }
    ui.info.textContent=`${p.name} (${p.desc})\n${s.phase} · t=${this.t.toFixed(2)}s · 跳高 ${s.jumpY.toFixed(2)}m · 压腕 ${(s.snap*100)|0}%`;
    this.last={s,held};
  }
};
ui.play.onclick=()=>{ if(!Shot.active) Shot.start(); Shot.playing=!Shot.playing; ui.play.textContent=Shot.playing?'❚❚ 暂停':'▶ 播放投篮'; };
ui.stop.onclick=()=>Shot.stop();
ui.t.oninput=()=>{ if(!Shot.active) Shot.start(); Shot.playing=false; ui.play.textContent='▶ 播放投篮'; Shot.setT(ui.t.value/1000*Shot.TOTAL); };
if(ui.style) ui.style.onchange=()=>{ Shot.setStyle(ui.style.value); if(!Shot.active){ Shot.start(); Shot.playing=true; ui.play.textContent='❚❚ 暂停'; } };
if(ui.resetOff) ui.resetOff.onclick=()=>{ if(window.resetPoseOffsets) window.resetPoseOffsets(); };
if(ui.copy) ui.copy.onclick=()=>{
  const diffs={};
  if(window.poseOffsets) for(const k in window.poseOffsets) if(window.poseOffsets[k]) diffs[k]=window.poseOffsets[k];
  const payload=JSON.stringify({style:curKey, t:+Shot.t.toFixed(3), phase:Shot.last&&Shot.last.s.phase, offsets:diffs});
  if(navigator.clipboard) navigator.clipboard.writeText(payload).catch(()=>{});
  ui.info.textContent='已复制微调参数:\n'+payload;
};
if(window.__ready) Shot.init();
})();
