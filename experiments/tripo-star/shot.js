/* 投篮动作预览 —— 把游戏 src/rendering/motion.js 的投篮曲线搬到 Mixamo 骨架上。
   照搬的部分:shotCurves(蓄力相位→dip/lift/jmp)、poseGuy 的腿/踝/躯干公式、
              poseBallPos 的球心轨迹、shot-motion.js 的出手时序(0.092s 离手,跟随 0.725s)。
   没照搬的部分:游戏里手臂是往它自己骨架的关键帧四元数上混(SHOT_READY_POSE/SHOT_SET_POSE),
              那组数据换了骨架用不了。这里改成:球按游戏轨迹走,双臂用两段骨反解(IK)贴到球上。
   依赖 preview.html 里的全局:THREE scene root bones rest restW side applyPose target dist。 */
(function(){
"use strict";
const GAME_H=1.8, K=1.98/GAME_H;          // 游戏角色约 1.8 单位高,这里按 1.98 米 → 所有游戏长度乘 K
const BALL_R=0.12;                         // 7 号球半径(直径 24cm)。游戏里是 0.16,偏大
const GRAV=9.8;
const T={hold:.4, charge:1.0, post:1.9,    // 持球站定 / 蓄力(相位 0→1) / 出手之后
         extend:.105, relAt:.092, fhold:.24, fade:.38, land:.3,   // 取自 shot-motion.js
         jumpH:.55*K, rimD:4.19, rimH:3.05, flight:1.15};
const TOTAL=T.hold+T.charge+T.post;
const D=r=>r*180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease01=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const mix3=(a,b,k)=>a.clone().lerp(b,k);

// ---- 游戏原式:蓄力相位 → 曲线 ----
function shotCurves(ph){
  const loadIn=ease01(ph/0.32), rise=ease01((ph-0.58)/0.28);
  return {dip:loadIn*(1-rise), lift:ease01((ph-0.28)/0.48), rise, jmp:ease01((ph-0.76)/0.22)};
}
// 时间 → 这一帧的全部驱动量
function sample(t){
  const tc=t-T.hold, ph=clamp(tc/T.charge,0,1), age=tc-T.charge;
  const c=shotCurves(ph);
  let dip=c.dip, lift=c.lift, jmp=c.jmp, jumpY=c.jmp*T.jumpH, land=0, snap=0, rec=0;
  if(age>0){
    const tl=Math.sqrt(2*T.jumpH/GRAV);                       // 顶点即落:从顶点自由落体
    jumpY=Math.max(0,T.jumpH-.5*GRAV*age*age); jmp=jumpY/T.jumpH; dip=0;
    if(age>tl&&age<tl+T.land) land=Math.sin((age-tl)/T.land*Math.PI);
    snap=ease01(age/T.extend);                                // 压腕
    rec=ease01((age-T.extend-T.fhold)/T.fade);                // 收手
  }
  const armLift=age>0?1-rec:lift, armJmp=age>0?1-rec:c.jmp;   // 手臂在跟随期保持出手高度,再收回
  return {ph,age,dip,lift,jmp,jumpY,land,snap,rec,armLift,armJmp,
          phase: tc<0?'持球':age<=0?(ph<.32?'下蹲蓄力':ph<.76?'举球':'起跳'):age<T.relAt?'出手':rec<1?'跟随':'落地收手'};
}
// 游戏原式:腿、踝、躯干(弧度) → 预览页的姿势键(度)
function bodyPose(s,noAir){
  const load=s.dip*(1-s.jmp*.86), land=s.land;
  const hip=.48*load+.24*land-.06*s.jmp;                      // 游戏里是负号=大腿前抬
  const knee=Math.max(0,.98*load+.82*land-.78*s.jmp);
  const hipR=hip+.03*load, hipL=hip-.03*load;                 // legs[0]=右腿在前
  const kneeR=knee*.96, kneeL=knee*1.04;
  const air=noAir?0:-.18*s.jmp+.52*s.jmp*(1-clamp(land,0,1))+.14*land; // 踝背屈 + 空中脚掌下垂 + 落地前掌先着
  return {
    'RightUpLeg.lift':D(hipR),'LeftUpLeg.lift':D(hipL),
    'RightLeg.flex':D(kneeR),'LeftLeg.flex':D(kneeL),
    'RightFoot.pitch':D((hipR-kneeR)*.98+air),'LeftFoot.pitch':D((hipL-kneeL)*.98+air),
    'Spine.bend':D(.175*load-.03*s.jmp+.08*land),             // 蓄力前倾约 10°,起跳略后仰,落地前倾
    'Head.nod':-6*s.armLift,
  };
}
// 游戏原式:球心(游戏角色局部坐标,右手侧为 -x,单位是游戏单位)
function ballLocal(dip,lift,jmp){
  return V(-0.13+0.04*jmp, 0.82+0.23*(1-dip)+0.7*lift+0.52*jmp, 0.34-0.05*lift-0.18*jmp);
}
/* 换骨架的关键:球的位置不能只按身高缩放。游戏角色肩在 (±0.285,1.36)、臂长 0.61;
   这个模型肩更窄更高、手臂更短。所以把球表示成"相对两肩中点的偏移",再按臂长比例缩放,
   挂到这个模型当前的两肩中点上 —— 下蹲、起跳、前倾都自动跟着走。 */
const GAME_SHOULDER=V(0,1.36,0), GAME_ARM=.61;
let armRatio=1;

// ---- 骨架工具 ----
const _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _pq=new THREE.Quaternion(), _m=new THREE.Matrix4();
const wpos=(n,out)=>bones[n].getWorldPosition(out||new THREE.Vector3());
function setWorldQuat(bone,qw){ bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert()).multiply(qw); bone.updateMatrixWorld(true); }
function aim(bone,childName,dir){                    // 把 bone→child 这根骨转到 dir 方向(最短弧)
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
function measure(){                                   // 静止姿势下量一次:骨长、手掌朝向
  applyPose({});
  for(const k in ARM){ const a=ARM[k];
    a.l1=wpos(a.up).distanceTo(wpos(a.fore)); a.l2=wpos(a.fore).distanceTo(wpos(a.hand));
    const f=wpos(a.mid).sub(wpos(a.hand)); a.palm=f.length()*.8; f.normalize();
    const n=orth(V(0,-1,0),f);                        // T-pose 掌心朝下
    a.restBasisInv=basisQ(f,n).invert(); a.curlAxis=new THREE.Vector3().crossVectors(f,n).normalize();
  }
  armRatio=(ARM.R.l1+ARM.R.l2)/GAME_ARM;
}
// 两段骨 IK:肩不动,让手腕到 target,肘朝 pole 方向鼓出去
function solveArm(a,targetW,pole){
  const s=wpos(a.up), d=targetW.clone().sub(s);
  const dist=clamp(d.length(),Math.abs(a.l1-a.l2)+.01,(a.l1+a.l2)*.995), dir=d.normalize();
  const x=(a.l1*a.l1-a.l2*a.l2+dist*dist)/(2*dist), h=Math.sqrt(Math.max(0,a.l1*a.l1-x*x));
  const perp=orth(pole,dir), elbow=s.clone().addScaledVector(dir,x).addScaledVector(perp,h);
  aim(bones[a.up],a.fore,elbow.clone().sub(s).normalize());
  const wrist=s.clone().addScaledVector(dir,dist);
  aim(bones[a.fore],a.hand,wrist.sub(wpos(a.fore)).normalize());
}
function setHand(a,f,n){ setWorldQuat(bones[a.hand], basisQ(f,n).multiply(a.restBasisInv).multiply(restW[a.hand])); }
function curlFingers(a,side,rad){                     // 四指每节同角度弯向掌心
  _q.setFromAxisAngle(a.curlAxis,rad);
  for(const fn of FINGERS) for(let i=1;i<=3;i++){ const n=side+'Hand'+fn+i, b=bones[n]; if(!b) continue;
    b.quaternion.copy(rest[n]).multiply(restW[n].clone().invert()).multiply(_q).multiply(restW[n]); }
}

// ---- 球与篮筐 ----
const ball=new THREE.Group();
ball.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_R,32,20),new THREE.MeshStandardMaterial({color:0xc8632a,roughness:.85})));
const seamM=new THREE.MeshBasicMaterial({color:0x1a1210});
[[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]].forEach(r=>{ const m=new THREE.Mesh(new THREE.TorusGeometry(BALL_R*1.003,.0028,6,48),seamM); m.rotation.set(r[0],r[1],r[2]); ball.add(m); });
const hoop=new THREE.Group();
const rim=new THREE.Mesh(new THREE.TorusGeometry(.2286,.012,8,40),new THREE.MeshStandardMaterial({color:0xe2562a}));
rim.rotation.x=Math.PI/2; rim.position.set(0,T.rimH,T.rimD); hoop.add(rim);
const board=new THREE.Mesh(new THREE.PlaneGeometry(1.83,1.07),new THREE.MeshBasicMaterial({color:0xdde3ee,transparent:true,opacity:.28,side:THREE.DoubleSide}));
board.position.set(0,T.rimH+.38,T.rimD+.2286+.15); hoop.add(board);
ball.visible=false; hoop.visible=false; scene.add(ball); scene.add(hoop);

// ---- 每帧 ----
let relPos=null, relVel=null;
function pose(t){                                     // 摆好这一帧,返回球在手里时的位置
  const s=sample(t);
  applyPose(bodyPose(s,true));                        // 先按"脚掌放平"求出踩地高度
  const groundY=root.position.y;
  applyPose(bodyPose(s), 0, groundY+s.jumpY);         // 再加上空中脚掌下垂和起跳高度
  const mid=wpos('LeftArm').add(wpos('RightArm')).multiplyScalar(.5);
  const b=ballLocal(s.dip,s.armLift,s.armJmp).sub(GAME_SHOULDER).multiplyScalar(armRatio).add(mid);
  const k=s.armLift, j=s.armJmp, w=s.snap*(1-s.rec);
  // 投篮手(右):胸前在球的右后方 → 置球点托在球下后方 → 出手时掌心朝前上 → 压腕后掌心朝下
  let nS=mix3(mix3(V(.75,.15,.6),V(0,.75,.65),k),V(0,.5,.85),j).normalize();
  let fS=mix3(mix3(V(0,1,.2),V(0,.6,-1),k),V(0,1,-.4),j);
  const R=ARM.R, L=ARM.L;
  const wristS=b.clone().addScaledVector(nS,-BALL_R).addScaledVector(orth(fS,nS),-R.palm);
  nS=mix3(nS,V(0,-1,-.1),w).normalize(); fS=orth(mix3(fS,V(0,-.45,.9),w),nS);
  // 辅助手(左):一直贴在球的左侧,出手后留在原位再随收手放下
  const nG=V(-.95,.05,.3).normalize(), fG=orth(mix3(V(0,1,.1),V(0,.9,-.4),k),nG);
  const wristG=b.clone().addScaledVector(nG,-BALL_R).addScaledVector(fG,-L.palm);
  curlFingers(R,'Right',.22*(1-w*.6)); curlFingers(L,'Left',.22);
  root.updateMatrixWorld(true);
  solveArm(R,wristS,mix3(V(-.6,-.8,-.3),V(-.25,-.5,.85),k));
  solveArm(L,wristG,V(.8,-.7,.1));
  setHand(R,fS,nS); setHand(L,fG,nG);
  // 球跟着投篮手实际到的位置走(够不着时不会悬空)
  const held=wpos(R.hand).addScaledVector(fS,R.palm).addScaledVector(nS,BALL_R);
  return {s,held};
}
function calcRelease(){                               // 离手瞬间的位置与初速度(只算一次)
  const r=pose(T.hold+T.charge+T.relAt);
  relPos=r.held.clone();
  const tgt=V(0,T.rimH,T.rimD), f=T.flight;
  relVel=V((tgt.x-relPos.x)/f,(tgt.y-relPos.y+.5*GRAV*f*f)/f,(tgt.z-relPos.z)/f);
}
const ui={play:document.getElementById('shotPlay'),stop:document.getElementById('shotStop'),
          speed:document.getElementById('shotSpeed'),t:document.getElementById('shotT'),info:document.getElementById('shotInfo')};
const Shot=window.Shot={active:false,playing:false,t:0,T,TOTAL,sample,
  init(){ measure(); calcRelease(); applyPose(); },
  start(){ if(!relPos) this.init(); this.active=true; ball.visible=hoop.visible=true; target.set(0,1.5,1.6); if(dist<8) dist=9.5; },
  stop(){ this.active=this.playing=false; ball.visible=hoop.visible=false; target.set(0,.95,0); if(dist>6) dist=4.6; ui.play.textContent='▶ 播放投篮'; ui.info.textContent=''; },
  setT(t){ this.t=clamp(t,0,TOTAL); this.render(); },
  tick(dt){ if(this.playing){ this.t+=dt*(+ui.speed.value||1); if(this.t>=TOTAL) this.t=0; ui.t.value=this.t/TOTAL*1000; } this.render(); },
  render(){
    const {s,held}=pose(this.t), tau=s.age-T.relAt;
    if(tau<0){ ball.visible=true; ball.position.copy(held); ball.rotation.set(0,0,0); }
    else{
      ball.position.set(relPos.x+relVel.x*tau, relPos.y+relVel.y*tau-.5*GRAV*tau*tau, relPos.z+relVel.z*tau);
      ball.rotation.x=-tau*11;                        // 后旋
      ball.visible=ball.position.y>BALL_R;
    }
    ui.info.textContent=`${s.phase} · 相位 ${s.ph.toFixed(2)}\n下蹲 ${s.dip.toFixed(2)} 举球 ${s.lift.toFixed(2)} 起跳 ${s.jmp.toFixed(2)}`;
    this.last={s,held};
  }};
ui.play.onclick=()=>{ if(!Shot.active) Shot.start(); Shot.playing=!Shot.playing; ui.play.textContent=Shot.playing?'❚❚ 暂停':'▶ 播放投篮'; };
ui.stop.onclick=()=>Shot.stop();
ui.t.oninput=()=>{ if(!Shot.active) Shot.start(); Shot.playing=false; ui.play.textContent='▶ 播放投篮'; Shot.setT(ui.t.value/1000*TOTAL); };
if(window.__ready) Shot.init();
})();
