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
function poseFootBottomY(hip,knee,ankle){
  const a1=hip,a2=hip+knee,a3=hip+knee+ankle;
  return 0.78
    -0.34*Math.cos(a1)
    -0.32*Math.cos(a2)
    -0.04*Math.cos(a3)
    -0.05*Math.sin(a3)
    -0.065*Math.abs(Math.cos(a3))
    -0.15*Math.abs(Math.sin(a3));
}
const POSE_STAND_FOOT_Y=poseFootBottomY(0,0,0);
const HAND_FINGER_REST=-.08;
const HAND_FINGER_FOLLOW=[.14,.38,Math.PI/6,.16];
const GUIDE_PALM_INWARD_Y=-1.48;
const GUIDE_FINGER_CUP=[.06,.10,.11,.07];
const SHOOT_HAND_BASE={x:0,y:-.29,z:.01};
const SHOOT_HAND_CUP_OFFSET={y:-.045,z:.055};
function poseHandJoints(o,c){
  if(!o||!o.handRoots)return;
  const lift=c&&c.lift||0;
  o.handRoots.forEach((hand,index)=>{
    if(!hand)return;
    if(hand.position)hand.position.set(SHOOT_HAND_BASE.x,SHOOT_HAND_BASE.y,SHOOT_HAND_BASE.z);
    hand.rotation.x=(index===0?.08:0)*lift;
    hand.rotation.y=0;
    hand.rotation.z=(index===0?-.025:0)*lift;
  });
  (o.fingerJoints||[]).forEach(fingers=>fingers.forEach(finger=>{
    finger.rotation.x=HAND_FINGER_REST;finger.rotation.y=0;finger.rotation.z=0;
  }));
}
function poseShootingHandToBall(o,c){
  if(!o||!o.handRoots||!o.handRoots[0])return;
  const curve=c||{},lift=ease01(clamp((curve.lift||0)-.12,0,.68)/.68);
  const jmp=ease01(clamp(((curve.jmp||0)-.28)/.55,0,1));
  const isPlayer=typeof player!=="undefined"&&o===player;
  const hold=isPlayer&&typeof G!=="undefined"&&!G.charging?0:lift*(1-jmp);
  const hand=o.handRoots[0];
  // 球心在肘组局部(0,-.43,.12)。举球时把掌心收进球后侧，出手前随起跳退回基础腕位。
  if(hand.position)hand.position.set(
    SHOOT_HAND_BASE.x,
    SHOOT_HAND_BASE.y+SHOOT_HAND_CUP_OFFSET.y*hold,
    SHOOT_HAND_BASE.z+SHOOT_HAND_CUP_OFFSET.z*hold
  );
  hand.rotation.x=.08*(curve.lift||0)+.10*hold;
  hand.rotation.y=0;
  hand.rotation.z=-.025*(curve.lift||0)-.035*hold;
}
function applyHandFollowThroughPose(o,k){
  if(!o||!o.handRoots||!o.handRoots[0])return;
  const follow=ease01(k||0),shoot=o.handRoots[0];
  // 投篮臂与地面约60度时，腕部正向折回约68度，掌面转向地板。
  shoot.rotation.x+=(1.18-shoot.rotation.x)*follow;
  shoot.rotation.z+=( -.035-shoot.rotation.z)*follow;
  const fingers=o.fingerJoints&&o.fingerJoints[0];
  if(fingers)fingers.forEach((finger,index)=>{
    const bend=HAND_FINGER_FOLLOW[index]||.14;
    finger.rotation.x=HAND_FINGER_REST+bend*follow;
  });
}
function captureShotPose(o){
  if(!o||!o.arms||!o.elbows)return null;
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  return {
    release:{shootX:shoot?shoot.rotation.x:-1.88,shootZ:shoot?shoot.rotation.z:.10,
      shootElX:shootEl?shootEl.rotation.x:-1.28,shootElZ:shootEl?shootEl.rotation.z:0},
    guide:{x:guide?guide.rotation.x:-1.3,z:guide?guide.rotation.z:-.18,elbowX:guideEl?guideEl.rotation.x:-.68}
  };
}
function applyShotSetPose(o,c,active){
  const enabled=active==null?(typeof G!=="undefined"&&G.charging):!!active;
  if(!o||!o.arms||!o.elbows||!enabled)return;
  const curve=c||{},k=ease01(((curve.lift||0)-.68)/.32),planeK=ease01(((curve.lift||0)-.40)/.45);
  if(k<=0&&planeK<=0)return;
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  // 举球终点:投篮大臂接近水平、前臂向上,把伸肘动作留到真正松手后。
  if(shoot){
    shoot.rotation.x=mixN(shoot.rotation.x,-1.88,k);
    // 右手肩轴用正 Z 轻微内收，让肩、肘、腕留在同一投篮平面。
    shoot.rotation.y=mixN(shoot.rotation.y,0,planeK);
    shoot.rotation.z=mixN(shoot.rotation.z,0.10,planeK);
  }
  if(shootEl){
    shootEl.rotation.x=mixN(shootEl.rotation.x,-1.28,k);
    shootEl.rotation.y=mixN(shootEl.rotation.y,0,planeK);
    shootEl.rotation.z=mixN(shootEl.rotation.z,0,planeK);
  }
  if(guide){guide.rotation.x=mixN(guide.rotation.x,-1.92,k);guide.rotation.z=mixN(guide.rotation.z,-0.50,k);}
  if(guideEl)guideEl.rotation.x=mixN(guideEl.rotation.x,-1.42,k);
}
function applyShotFollowThroughPose(o,state,pose){
  if(!o||!o.arms||!o.elbows||!state||!state.active)return;
  const release=pose&&pose.release||{shootX:-1.88,shootZ:.10,shootElX:-1.28,shootElZ:0};
  const guideStart=pose&&pose.guide||{x:-1.3,z:-.18,elbowX:-.68};
  const shoot=o.arms[0],guide=o.arms[1],shootEl=o.elbows[0],guideEl=o.elbows[1];
  // -2.62rad 约等于整条投篮臂与地面成60°,肘部趋近0表示主动伸直。
  const targetShootX=-2.62,targetShootZ=0.06,targetShootElX=-.08,targetShootElZ=0;
  const targetGuideX=Math.min(guideStart.x-.14,-2.06),targetGuideZ=guideStart.z+.14,targetGuideElX=Math.max(guideStart.elbowX,-.62);
  const guideBlend=state.recover;
  const baseShootX=shoot?shoot.rotation.x:targetShootX;
  const baseShootZ=shoot?shoot.rotation.z:targetShootZ;
  const baseShootElX=shootEl?shootEl.rotation.x:targetShootElX;
  const baseShootElZ=shootEl?shootEl.rotation.z:targetShootElZ;
  const baseGuideX=guide?guide.rotation.x:guideStart.x;
  const baseGuideZ=guide?guide.rotation.z:guideStart.z;
  const baseGuideElX=guideEl?guideEl.rotation.x:guideStart.elbowX;
  if(shoot){
    if(guideBlend>0){
      shoot.rotation.x=targetShootX+(baseShootX-targetShootX)*guideBlend;
      shoot.rotation.z=targetShootZ+(baseShootZ-targetShootZ)*guideBlend;
    }else{
      shoot.rotation.x=release.shootX+(targetShootX-release.shootX)*state.extend;
      shoot.rotation.z=release.shootZ+(targetShootZ-release.shootZ)*state.extend;
    }
  }
  if(shootEl){
    if(guideBlend>0){
      shootEl.rotation.x=mixN(targetShootElX,baseShootElX,guideBlend);
      shootEl.rotation.z=mixN(targetShootElZ,baseShootElZ,guideBlend);
    }else{
      shootEl.rotation.x=mixN(release.shootElX,targetShootElX,state.extend);
      shootEl.rotation.z=mixN(release.shootElZ,targetShootElZ,state.extend);
    }
    shootEl.rotation.y=0;
  }
  // 辅助手随顶肘自然打开,接近落地后再沿基线逐步收回。
  if(guide){
    if(guideBlend>0){
      guide.rotation.x=mixN(targetGuideX,baseGuideX,guideBlend);
      guide.rotation.z=mixN(targetGuideZ,baseGuideZ,guideBlend);
    }else{
      guide.rotation.x=mixN(guideStart.x,targetGuideX,state.extend);
      guide.rotation.z=mixN(guideStart.z,targetGuideZ,state.extend);
    }
  }
  if(guideEl){
    if(guideBlend>0)guideEl.rotation.x=mixN(targetGuideElX,baseGuideElX,guideBlend);
    else guideEl.rotation.x=mixN(guideStart.elbowX,targetGuideElX,state.extend);
  }
  applyHandFollowThroughPose(o,state.follow);
}
function poseGuy(o,c,lk){
  poseHandJoints(o,c);
  const sh=o.arms[0],gd=o.arms[1]; // arms[0]=x-0.33=角色右手(面朝篮筐时屏幕右侧) 投篮 / arms[1]=左手 护球
  sh.rotation.x=-0.35-0.25*c.dip-1.55*c.lift-0.9*c.jmp;
  o.elbows[1].rotation.x=-(0.45+1.2*c.lift)*(1-c.jmp*0.92)-0.4*c.over;
  gd.rotation.x=-0.35-0.2*c.dip-1.1*c.lift-0.5*c.jmp+0.55*c.over;
  o.elbows[0].rotation.x=-(0.4+0.85*c.lift)*(1-c.jmp*0.6);
  sh.rotation.z=-0.12*c.lift;gd.rotation.z=0.18*c.lift;
  poseGuidePalmToBall(o,c,false);
  poseShootingHandToBall(o,c);
  // Real-shot leg chain: knees load forward, calves fold back into a V, soles stay planted until takeoff.
  const load=c.dip*(1-c.jmp*0.86);
  const land=lk||0;
  const hipBase=-0.48*load-0.24*land+0.06*c.jmp;
  const kneeBase=Math.max(0,0.98*load+0.82*land-0.78*c.jmp);
  const hipLead=hipBase-0.03*load,hipTrail=hipBase+0.03*load;
  const kneeLead=kneeBase*0.96,kneeTrail=kneeBase*1.04;
  const ankleLead=-(hipLead+kneeLead)*0.98-0.18*c.jmp+0.04*land;
  const ankleTrail=-(hipTrail+kneeTrail)*0.98-0.18*c.jmp+0.04*land;
  o.legs[0].rotation.x=hipLead;
  o.legs[1].rotation.x=hipTrail;
  o.knees[0].rotation.x=kneeLead;
  o.knees[1].rotation.x=kneeTrail;
  o.ankles[0].rotation.x=ankleLead;
  o.ankles[1].rotation.x=ankleTrail;
  o.shoes[0].rotation.x=0;
  o.shoes[1].rotation.x=0;
  // 上身前倾:蓄力约10°(0.17rad),起跳回正并略后仰送球
  o.g.rotation.x=0.12*load - 0.06*c.over - 0.03*c.jmp + 0.08*land;
  const footY=(poseFootBottomY(hipLead,kneeLead,ankleLead)+poseFootBottomY(hipTrail,kneeTrail,ankleTrail))*0.5;
  return POSE_STAND_FOOT_Y-footY;
}
function shotStanceBlend(c,ready){
  return clamp(Math.max(ready?0.72:0,c.dip*.55+c.lift*.85+c.jmp*.35),0,1);
}
function poseGuidePalmToBall(o,c,ready){
  if(!o||!o.handRoots||!o.handRoots[1])return;
  const curve=c||{dip:0,lift:0,jmp:0};
  // Ready already starts at .72: reach the ball-facing pose before the lift begins.
  const cup=ease01(clamp(shotStanceBlend(curve,ready)/.72,0,1));
  const hand=o.handRoots[1];
  hand.rotation.x=.08*cup;
  hand.rotation.y=GUIDE_PALM_INWARD_Y*cup;
  hand.rotation.z=-.05*cup;
  const fingers=o.fingerJoints&&o.fingerJoints[1];
  if(fingers)fingers.forEach((finger,index)=>{
    finger.rotation.x=HAND_FINGER_REST+(GUIDE_FINGER_CUP[index]||.06)*cup;
  });
}
function tuneGuideHandPose(o,c,ready){
  if(!o||!o.arms||!o.elbows)return;
  const k=shotStanceBlend(c,ready);
  const guide=o.arms[1],guideEl=o.elbows[1];
  if(!guide||!guideEl)return;
  guide.rotation.x=-0.48-0.24*c.dip-1.42*c.lift-0.58*c.jmp+0.38*c.over;
  guide.rotation.y=0.08*k;
  guide.rotation.z=-0.18-0.34*c.lift;
  guideEl.rotation.x=-(0.62+0.96*c.lift)*(1-c.jmp*.62)-0.18*c.over;
  guideEl.rotation.z=-0.2*k;
  poseGuidePalmToBall(o,c,ready);
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
    P.walkT+=dt*9;
    const sw=Math.sin(P.walkT);
    player.g.rotation.x=0;
    player.legs[0].rotation.x=sw*0.7;player.legs[1].rotation.x=-sw*0.7;
    player.knees[0].rotation.x=Math.max(0,-sw*0.5+0.25);player.knees[1].rotation.x=Math.max(0,sw*0.5+0.25);
    player.ankles[0].rotation.x=-sw*0.25;player.ankles[1].rotation.x=sw*0.25;
    player.shoes[0].rotation.x=0;player.shoes[1].rotation.x=0;
    player.arms[0].rotation.x=-sw*0.45;player.arms[1].rotation.x=sw*0.45;
    player.elbows[0].rotation.x=-0.4;player.elbows[1].rotation.x=-0.4;
    poseHandJoints(player,shotCurves(0));
  }else{
    player.g.position.y=poseGuy(player,c,lk)+P.jump;
  }
  poseBallPos(pBall.position,c);
}

/* ---------------- passer & pass ---------------- */
let passing=null;
function startPass(){
  const s=curShot();if(!s||G.buzzed)return;
  passer.g.rotation.y=faceTo(passer.g.position,P.pos);
  passerBall.visible=false;
  const from=V3(passer.g.position.x,1.25,passer.g.position.z);
  const catchP=eyePos();catchP.y-=0.3;
  const dur=G.mode==="rackrush"?clamp(.16+from.distanceTo(catchP)*.018,.22,.32):clamp(0.3+from.distanceTo(catchP)*0.045,0.4,0.75);
  const mesh=new THREE.Mesh(ballGeo,shotMat(s));
  mesh.position.copy(from);scene.add(mesh);
  passing={mesh,from,to:catchP,t:0,dur};
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
  p.mesh.rotation.x-=dt*10;
  if(k>=1){
    scene.remove(p.mesh);passing=null;passerBall.visible=true;
    if(G.buzzed||!curShot())return;
    sBounce();
    if(navigator.vibrate)navigator.vibrate(8);
    G.canShoot=true;setHandBall();updPowerUI();updDotsUI();
  }
}

/* ---------------- walking between racks ---------------- */
let walk=null;
function walkTo(shot,cb){
  const base=shotBase(shot);
  const from=P.pos.clone(),to=base.clone();
  const dur=clamp(from.distanceTo(to)/3.4,0.5,1.7);
  P.walking=true;G.moving=true;P.walkT=0;
  walk={from,to,t:0,dur,fMove:faceTo(from,to),f1:faceTo(to,HOOP),cb,step:0};
}
function updWalk(dt){
  if(!walk)return;
  walk.t+=dt;const k=Math.min(1,walk.t/walk.dur);
  P.pos.lerpVectors(walk.from,walk.to,k);
  const tgt=k<0.75?walk.fMove:walk.f1;
  let d=tgt-P.face;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  P.face+=d*Math.min(1,dt*8);
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
    const cb=walk.cb;walk=null;if(cb)cb();
  }
}


window.AIBA.runtime.register("rendering:motion",Object.freeze({
  ease01,shotCurves,poseFootBottomY,poseHandJoints,poseShootingHandToBall,poseGuidePalmToBall,applyHandFollowThroughPose,captureShotPose,applyShotSetPose,applyShotFollowThroughPose,poseGuy,poseBallPos,shotStanceBlend,tuneGuideHandPose,updPose,
  startPass,updPass,walkTo,updWalk,
  getState:()=>({poseK,landT,passing,walk})
}));
