const P={pos:V3(0,0,-0.6),face:0,walking:false,walkT:0,jump:0,eyeDip:0};
function faceTo(from,to){return Math.atan2(to.x-from.x,to.z-from.z);}
const CAM={mode:0,names:["第一人称","球员跟随","转播视角"]};
function cycleCam(){
  CAM.mode=(CAM.mode+1)%3;
  AIBASetIcon("camBtn","camera",CAM.names[CAM.mode]);
  applyCamMode();blip(700,0.05,"square",0.06);
}
function applyCamMode(){
  const inPlay=(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="rushintro"||G.state==="rushbetween"||G.state==="pregame"||G.state==="lastshot");
  hands.visible=CAM.mode===0&&inPlay;
  player.g.visible=CAM.mode!==0&&inPlay;
  passer.g.visible=inPlay;
  oppPasser.g.visible=inPlay&&G.mode==="battle";
  $("camBtn").style.display=inPlay?"block":"none";
  camSnap=true; // 切换机位时下一帧硬切,避免跨场平滑造成大幅扫镜
  benchVis();
}
function eyePos(){
  const d=V3(Math.sin(P.face),0,Math.cos(P.face));
  return V3(P.pos.x-d.x*0.25,
    EYE+P.eyeDip+P.jump+(P.walking?Math.sin(P.walkT*1.1)*0.05:0),
    P.pos.z-d.z*0.25);
}
/* 自适应取景:用球员全身+篮筐/篮板包围点反推相机距离,不再为中场写死镜头 */
const _afCenter=new THREE.Vector3(),_afMin=new THREE.Vector3(),_afMax=new THREE.Vector3();
const _afBack=new THREE.Vector3(),_afForward=new THREE.Vector3(),_afRight=new THREE.Vector3(),_afUp=new THREE.Vector3();
const _afTmp=new THREE.Vector3(),_afPts=[];
function afAdd(x,y,z){_afPts.push(V3(x,y,z));}
function autoFrameCam(rig,pPos,pJump,faceDir,opts){
  opts=opts||{};
  _afPts.length=0;
  const dir=_afTmp.set(faceDir.x,0,faceDir.z);
  if(dir.lengthSq()<0.001)dir.set(0,0,-1);
  dir.normalize();
  const perp=V3(dir.z,0,-dir.x);
  // 固定取景侧:始终取球员朝向篮筐时的同一侧,篮筐稳定停在屏幕同一边,不再左右翻转
  const side=opts.side!=null?opts.side:1;
  const shoeY=Math.max(0,pJump);
  const headY=1.9+pJump;
  const bodyW=0.48,bodyD=0.34;
  // 球员全身包围盒:脚、肩、头都纳入,避免竖屏时人物被左右/上下切掉。
  [-1,1].forEach(a=>[-1,1].forEach(b=>{
    const x=pPos.x+perp.x*a*bodyW+dir.x*b*bodyD;
    const z=pPos.z+perp.z*a*bodyW+dir.z*b*bodyD;
    afAdd(x,shoeY,z);afAdd(x,1.18+pJump,z);afAdd(x,headY,z);
  }));
  // 篮筐 + 篮板的大致包围点。篮板比篮筐更宽更高,必须一起装进画面。
  [-1.12,1.12].forEach(x=>[2.62,3.88].forEach(y=>afAdd(HOOP.x+x,y,HOOP.z-0.48)));
  [-0.46,0.46].forEach(x=>[-0.18,0.18].forEach(z=>afAdd(HOOP.x+x,HOOP.y,HOOP.z+z)));
  _afMin.set(Infinity,Infinity,Infinity);_afMax.set(-Infinity,-Infinity,-Infinity);
  _afPts.forEach(p=>{_afMin.min(p);_afMax.max(p);});
  _afCenter.addVectors(_afMin,_afMax).multiplyScalar(0.5);
  _afCenter.y+=opts.lookLift||0.08;
  // 从球员侧后方斜看,但距离由视锥计算得出。转播视角略高、略侧。
  const sideK=opts.sideK!=null?opts.sideK:(opts.broadcast?0.62:0.44);
  const backK=opts.backK!=null?opts.backK:(opts.broadcast?0.67:0.82);
  const heightK=opts.heightK!=null?opts.heightK:(opts.broadcast?0.34:0.25);
  _afBack.set(-dir.x*backK+perp.x*side*sideK,heightK,-dir.z*backK+perp.z*side*sideK).normalize();
  _afForward.copy(_afBack).negate();
  _afRight.crossVectors(_afForward,V3(0,1,0)).normalize();
  _afUp.crossVectors(_afRight,_afForward).normalize();
  const vFov=camera.fov*Math.PI/180;
  const aspect=camera.aspect||(innerWidth/innerHeight)||1;
  const hFov=2*Math.atan(Math.tan(vFov/2)*aspect);
  const tanH=Math.tan(hFov/2),tanV=Math.tan(vFov/2);
  const marginX=opts.marginX||1.32,marginY=opts.marginY||1.24;
  let dist=0;
  _afPts.forEach(p=>{
    _afTmp.copy(p).sub(_afCenter);
    const x=_afTmp.dot(_afRight),y=_afTmp.dot(_afUp),z=_afTmp.dot(_afForward);
    dist=Math.max(dist,Math.abs(x)*marginX/tanH-z,Math.abs(y)*marginY/tanV-z);
  });
  dist=clamp(dist+(opts.pad==null?.45:opts.pad),opts.minDist||5.2,opts.maxDist||30);
  rig.pos.copy(_afCenter).addScaledVector(_afBack,dist);
  rig.look.copy(_afCenter);
}
let fpLookY=null;
const _fpBall=V3(0,0,0);
// 举球到顶时相机相对眼睛下压的幅度;0.46 让相机落到球心下方约 0.2,刚好仰视球看到手背。
/* 第一人称相机高度。FP_RISE 是"眼睛之上"的抬升量，FP_BALL_DUCK 是举球时的下压量。
   两者必须一起调：举球到位的最终高度 = EYE + FP_RISE - FP_BALL_DUCK，这个值(1.60m)
   是已经调好的投篮取景，不能动。
   FP_RISE 原本 0.28 → 不举球时相机 2.06m，比防守人头顶(1.84m)还高，
   所以投完球对方扑上来只能看到头发、接球时手也被压出画面下缘。
   降到 0.05 后不举球是 1.83m(基本就是眼高)，DUCK 同步 0.46→0.23 保持举球取景不变。 */
const FP_RISE=0.05,FP_BALL_DUCK=0.23;
function updPlayCam(dt){
  dt=dt||0.016;
  const d=V3(Math.sin(P.face),0,Math.cos(P.face));
  // 百分大战按站位动态取景,中场这种极端距离也要把人物+篮筐一起框住。
  const isBattle=G.mode==="battle";
  const isRush=G.mode==="rackrush";
  const isContest=G.mode==="contest";
  if(CAM.mode===0){
    // 第一人称:略微后拉抬高(身体网格在本视角隐藏,不会入画);
    // 球出手后镜头随球高度平滑抬升,保证高弧线在空中全程可见
    const e=eyePos();
    /* 举球到位时相机要让回到球下方。原本恒定 +0.28 会让眼线高过球心(实测相机 2.51 / 球 2.34),
       变成低头看自己的手:投篮手在球的后下方,于是整只手被球挡死,永远看不到手背。
       真实投篮里球是过额头的,眼睛仰视球、从球下缘看到手背和手指。
       这里按球心相对眼睛的高度平滑下压:球在腰间时完全不变(保持原取景),
       球升到眼睛附近才压下去,避免影响非举球阶段的手感。 */
    let fpRise=FP_RISE;
    if(typeof pBall!=="undefined"&&pBall&&(G.canShoot||G.charging)){
      pBall.getWorldPosition(_fpBall);
      const rel=_fpBall.y-e.y;
      /* 原曲线只在球快到眼睛高度时才介入(rel>-0.25)，导致刚接到球、球还在腰腹
         高度(rel≈-0.63)时相机完全不下压，投篮手被压在画面下缘外。
         区间放宽到 rel∈[-0.95, 0.14]：持球时已下压约 29%，举球到位仍是满值，
         保证最终高度精确落回 1.60m 的既有投篮取景。 */
      fpRise-=clamp((rel+0.95)/1.09,0,1)*FP_BALL_DUCK;
    }
    rig.pos.set(e.x-d.x*0.85,e.y+fpRise,e.z-d.z*0.85);
    let fpTarget=HOOP.y+0.15;
    if(typeof balls!=="undefined"&&balls.length){
      const fb=balls[balls.length-1];
      if(fb&&fb.phase==="fly"&&fb.mesh)fpTarget=Math.max(fpTarget,HOOP.y+0.15+(fb.mesh.position.y-HOOP.y)*0.5);
    }
    fpLookY=fpLookY==null?fpTarget:fpLookY+(fpTarget-fpLookY)*Math.min(1,dt*7);
    rig.look.set(HOOP.x,fpLookY,HOOP.z);
    camSnap=true;
  }else if(CAM.mode===1){
    if(isBattle||isRush||isContest){
      // 投篮机同款低位越肩球员锁定镜头；百分大战会随距离平滑拉远。
      updatePlayerLockCamera(dt);
    }else{
      camTarget.pos.set(P.pos.x-d.x*2.85,2.18+P.jump*0.4,P.pos.z-d.z*2.85);
      camTarget.look.set(P.pos.x+d.x*2.45,1.66+P.jump*0.5,P.pos.z+d.z*2.45);
      dampRig(dt,6);
    }
  }else{
    if(isBattle){
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.46,marginY:1.34,minDist:6,maxDist:34,lookLift:0.18,pad:.62});
      dampRig(dt,4.5);
    }else if(isRush){
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.24,marginY:1.2,minDist:5.4,maxDist:20,lookLift:-.12,pad:.3});
      dampRig(dt,5.2);
    }else{
      // 三分大赛/练习转播视角:自适应取景,深远彩球点也能框住球员+篮筐全程
      autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{broadcast:true,marginX:1.4,marginY:1.3,minDist:7.5,maxDist:30,lookLift:0.2,pad:.8,heightK:.52});
      dampRig(dt,5);
    }
  }
}
function ballWorldPos(out){
  // Camera mode is presentation only. Shot physics always starts at the real
  // player skeleton's ball grip so first/third person produce the same shot.
  pBall.getWorldPosition(out);
  return out;
}


window.AIBA.runtime.register("rendering:camera",Object.freeze({
  P,CAM,faceTo,cycleCam,applyCamMode,eyePos,autoFrameCam,updPlayCam,ballWorldPos
}));
