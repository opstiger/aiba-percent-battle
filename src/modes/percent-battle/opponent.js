(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy"),battle=global.AIBABattle;
  if(!ctx||!battle)throw new Error("Percent Battle opponent requires battle state");
  const {
    G,BATTLE_TARGET,BATTLE_SPOTS,OPP_SPOT_EMPTY_WAIT,COURT,HOOP,P,V3,clamp,faceTo,rivals,
    matGold,matDeep,matBall,shotProfileFor,DIFFS,aiProb,rnd,shotFlightTime,ballGeo,scene,blobGeo,blobMat,
    balls,oppPasser,oppPasserBall,triggerStreetCrowdReaction,bloomOnScore,beginFinalAudioWindow,broadcastSting,toast,boo,gameDjSay,
    sBounce,sSwish,battleScoreCallout,updJumbo,checkBattleOvertake,ease01,shotCurves,SHOT_STANCE_YAW,shotStanceBlend,tuneGuideHandPose,
    poseGuy,poseBallPos,applyShotSetPose,captureShotPose,applyHandFollowThroughPose,checkBallCollisions
  }=ctx;
  const OPP=battle.OPP;
  const OPP_MIN_SEP=1.58;

  function mirrorSpot(p){
    if(Math.abs(p.x)<0.6)return V3(p.x+1.9,p.y,p.z);
    return V3(-p.x,p.y,p.z);
  }
  function battlePlayerPos(){
    const spot=BATTLE_SPOTS[G.battleSpot||0];
    if(G.mode==="battle"&&spot)return spot.p;
    return P&&P.pos?P.pos:null;
  }
  function avoidPlayerOverlap(pos){
    const playerPos=battlePlayerPos();if(!playerPos)return pos;
    const clampCourt=candidate=>{
      candidate.x=clamp(candidate.x,-COURT.halfWidth+.55,COURT.halfWidth-.55);
      candidate.z=clamp(candidate.z,COURT.nearBaseline+.55,COURT.playMaxZ);
      return candidate;
    };
    clampCourt(pos);
    const dx=pos.x-playerPos.x,dz=pos.z-playerPos.z,d=Math.hypot(dx,dz);
    if(d>=OPP_MIN_SEP)return pos;
    const original=pos.clone(),toHoop=HOOP.clone().sub(original);toHoop.y=0;
    if(toHoop.lengthSq()<0.0001)toHoop.set(0,0,-1);
    toHoop.normalize();
    const side=V3(toHoop.z,0,-toHoop.x).normalize();
    const away=V3(dx,0,dz);
    if(away.lengthSq()<0.0001)away.copy(side).multiplyScalar(original.x>=0?1:-1);
    else away.normalize();
    const candidates=[away,side,side.clone().negate(),toHoop,toHoop.clone().negate()].map(direction=>
      clampCourt(original.clone().addScaledVector(direction,OPP_MIN_SEP+.34))
    );
    candidates.sort((a,b)=>{
      const ad=a.distanceTo(playerPos),bd=b.distanceTo(playerPos);
      const aSafe=ad>=OPP_MIN_SEP,bSafe=bd>=OPP_MIN_SEP;
      if(aSafe!==bSafe)return aSafe?-1:1;
      if(aSafe)return a.distanceTo(original)-b.distanceTo(original);
      return bd-ad;
    });
    if(candidates[0])pos.copy(candidates[0]);
    return pos;
  }
  function resetOppPasserPose(){
    if(!oppPasser)return;
    oppPasser.arms.forEach(arm=>arm.rotation.x=0);
    oppPasser.elbows.forEach(elbow=>elbow.rotation.x=0);
    oppPasser.g.rotation.x=0;
  }
  function attachOppBall(){
    const guy=OPP.guy;if(!guy||!guy.ball)return;
    const parent=guy.ballGrips&&guy.ballGrips[0]?guy.ballGrips[0]:guy.elbows&&guy.elbows[0];
    if(!parent)return;
    if(guy.ball.parent!==parent)parent.add(guy.ball);
    if(guy.ballGrips&&guy.ballGrips[0]===parent)guy.ball.position.set(0,0,0);
    else guy.ball.position.set(0,-.43,.12);
    guy.ball.rotation.set(0,0,0);
    OPP.ballAttached=true;
  }
  function cancelOppPass(hidePasser){
    if(OPP.ballOut&&OPP.ballOut.mesh)scene.remove(OPP.ballOut.mesh);
    OPP.ballOut=null;OPP.possessionSuperChanceId=0;
    if(OPP.guy&&OPP.guy.ball)OPP.guy.ball.visible=false;
    if(oppPasserBall)oppPasserBall.visible=true;
    resetOppPasserPose();
    if(oppPasser)oppPasser.g.visible=!hidePasser&&G.mode==="battle"&&!G.battleOver;
  }
  function oppRepositionForPlayer(){
    if(!OPP.on||!OPP.pos||G.mode!=="battle"||G.battleOver)return false;
    OPP.playerSpotSeen=G.battleSpot||0;
    const safe=oppSpotPos(OPP.spotIdx);
    if(OPP.pos.distanceTo(safe)<0.08)return false;
    cancelOppPass(false);
    OPP.fired=false;OPP.from=OPP.pos.clone();OPP.to=safe;OPP.phase="walk";OPP.t=0;
    return true;
  }
  function oppSpotPos(index){
    const i=index;
    const sp=BATTLE_SPOTS[i];if(!sp)return V3(0,0,0);
    // 确定性双槽位:玩家永远站点位圈上,对手站固定副槽位;与玩家位置无关,任何点位都不重叠。
    // 底角/中场等贴边点位依次尝试 外侧→左右侧向→内侧,取钳制后仍保持 0.9m 间距的第一个槽位。
    const out=V3(sp.p.x-HOOP.x,0,sp.p.z-HOOP.z);if(out.lengthSq()<0.01)out.set(0,0,1);out.normalize();
    const side=V3(out.z,0,-out.x),ss=sp.p.x>=-0.01?1:-1;
    const cands=[[out,0.95,side,ss*0.5],[out,0.95,side,-ss*0.5],[side,ss*1.1,out,0],[side,-ss*1.1,out,0],[out,-0.95,side,ss*0.5]];
    let best=null,bestD=-1;
    for(const c of cands){
      const pos=sp.p.clone().addScaledVector(c[0],c[1]).addScaledVector(c[2],c[3]);
      pos.x=clamp(pos.x,-COURT.halfWidth+.55,COURT.halfWidth-.55);
      pos.z=clamp(pos.z,COURT.nearBaseline+.55,COURT.playMaxZ);
      const d=pos.distanceTo(sp.p);
      if(d>=0.9)return pos;
      if(d>bestD){bestD=d;best=pos;}
    }
    return best;
  }
  function oppSpotQuota(index){
    const spot=BATTLE_SPOTS[index];
    if(spot.super)return 1;
    if(spot.deep!=null)return 2;
    return 5;
  }
  function oppSpotCooldown(index){
    const spot=BATTLE_SPOTS[index];
    if(spot.super)return 7.2;
    if(spot.deep!=null)return 3.4;
    return 2.1;
  }
  function oppSpotReady(index){return !OPP.coolUntil||G.tNow>=(OPP.coolUntil[index]||0);}
  function oppMarkSpotUse(){
    OPP.spotShots=(OPP.spotShots||0)+1;OPP.forceMove=false;
    if(OPP.spotShots>=oppSpotQuota(OPP.spotIdx)){
      if(!OPP.coolUntil)OPP.coolUntil=Array(BATTLE_SPOTS.length).fill(0);
      OPP.coolUntil[OPP.spotIdx]=G.tNow+oppSpotCooldown(OPP.spotIdx);OPP.forceMove=true;
    }
  }
  function oppBeginPass(){
    const spot=BATTLE_SPOTS[OPP.spotIdx],guy=OPP.guy;
    if(!spot||!guy)return;
    if(spot.super&&(G.superStock||0)<=0){OPP.forceMove=true;oppPickSpot();return;}
    cancelOppPass(false);
    OPP.possessionSuperChanceId=spot.super?(G.superChanceId||0):0;
    guy.ball.visible=false;oppPasser.g.visible=true;
    oppPasser.g.rotation.y=faceTo(oppPasser.g.position,OPP.pos);
    oppPasserBall.visible=false;
    const from=V3(oppPasser.g.position.x,1.25,oppPasser.g.position.z);
    const to=OPP.pos.clone();to.y=1.38;
    const mesh=new global.THREE.Mesh(ballGeo,spot.super?matGold:(spot.deep!=null?matDeep:matBall));
    mesh.position.copy(from);scene.add(mesh);
    OPP.ballOut={mesh,from,to,t:0,dur:clamp(.3+from.distanceTo(to)*.045,.42,.78)};
    OPP.phase="receive";OPP.t=0;OPP.fired=false;
    oppPasser.arms.forEach(arm=>arm.rotation.x=-1.5);
    oppPasser.elbows.forEach(elbow=>elbow.rotation.x=-.9);
  }
  function oppBeginLoad(){
    const spot=BATTLE_SPOTS[OPP.spotIdx],guy=OPP.guy;
    attachOppBall();
    guy.ball.visible=true;guy.ball.material=spot.super?matGold:(spot.deep!=null?matDeep:matBall);
    OPP.phase="load";OPP.t=0;OPP.fired=false;OPP.shotPose=null;
    OPP.shootDur=clamp((0.9-DIFFS[G.diff].ai*0.5)/shotProfileFor(G.myStar||OPP.o).speed,0.5,1.08);
  }
  function oppFollowThroughPose(guy,k){
    if(!guy||!guy.arms||!guy.elbows||k<=0)return;
    const hold=clamp(k,0,1);
    const shoot=guy.arms[0],guide=guy.arms[1],shootEl=guy.elbows[0],guideEl=guy.elbows[1];
    if(shoot){shoot.rotation.x=Math.min(shoot.rotation.x,-2.25-0.22*hold);shoot.rotation.z-=0.06*hold;}
    if(shootEl)shootEl.rotation.x=Math.min(shootEl.rotation.x,-0.8-0.22*hold);
    if(guide){guide.rotation.x=Math.min(guide.rotation.x,-1.28-0.14*hold);guide.rotation.z+=0.1*hold;}
    if(guideEl)guideEl.rotation.x=Math.min(guideEl.rotation.x,-0.66-0.14*hold);
    if(applyHandFollowThroughPose)applyHandFollowThroughPose(guy,hold);
  }
  function startOppShooter(){
    OPP.on=true;OPP.o=G.battleOpp;OPP.guy=rivals[0];OPP.guy.active=true;
    OPP.spotIdx=4;OPP.phase="walk";OPP.t=0;OPP.spotShots=0;
    OPP.coolUntil=Array(BATTLE_SPOTS.length).fill(0);OPP.forceMove=false;
    OPP.playerSpotSeen=G.battleSpot||0;
    const start=oppSpotPos(OPP.spotIdx);
    OPP.guy.g.position.copy(start);OPP.guy.g.rotation.y=faceTo(start,HOOP);
    OPP.pos=start.clone();OPP.from=start.clone();OPP.to=start.clone();
    OPP.guy.ball.visible=false;OPP.guy.ball.material=matBall;oppPasser.g.visible=true;oppPasserBall.visible=true;ctx.refreshBench();
  }
  function oppPickSpot(){
    const current=OPP.spotIdx,needsBig=G.battleOppScore+10>=BATTLE_TARGET||G.battleOppScore+15<G.score;
    const base=oppSpotPos(current);
    const candidates=BATTLE_SPOTS.map((spot,index)=>({
      i:index,sp:spot,dist:base.distanceTo(oppSpotPos(index))-(spot.deep!=null?0.1:0)-(spot.super?0.18:0)+Math.random()*0.18
    })).filter(candidate=>candidate.i!==current&&oppSpotReady(candidate.i)&&(candidate.i!==7||(G.superStock||0)>0));
    if(!candidates.length){
      OPP.phase="cool";OPP.t=0;OPP.coolDur=OPP_SPOT_EMPTY_WAIT;OPP.forceMove=true;return;
    }
    candidates.sort((a,b)=>a.dist-b.dist);
    const superOpen=candidates.find(candidate=>candidate.i===7);
    let index=(needsBig&&superOpen&&Math.random()<0.36)?7:candidates[0].i;
    if(index!==7&&candidates[1]&&Math.random()<0.16)index=candidates[1].i;
    cancelOppPass(false);
    OPP.spotIdx=index;OPP.spotShots=0;OPP.forceMove=false;
    OPP.from=OPP.pos.clone();OPP.to=oppSpotPos(index);OPP.phase="walk";OPP.t=0;
  }
  function oppFireBall(){
    const spot=BATTLE_SPOTS[OPP.spotIdx],base=(OPP.pos||oppSpotPos(OPP.spotIdx)).clone(),opponent=OPP.o,guy=OPP.guy;
    const probability=aiProb(opponent.r);
    const chance=spot.super?clamp(probability*0.22+0.03,0.08,0.22):clamp(probability*0.58+0.1,0.28,0.6);
    const made=Math.random()<chance;
    const start=new global.THREE.Vector3();
    if(guy&&guy.g&&guy.ball){guy.g.updateMatrixWorld(true);guy.ball.getWorldPosition(start);}
    else{start.copy(base);start.y=2.05;}
    const direction=HOOP.clone().sub(start);direction.y=0;const distance=direction.length();direction.normalize();
    const perpendicular=V3(direction.z,0,-direction.x);
    let depth,lateral;
    if(made){depth=rnd(-0.03,0.03);lateral=rnd(-0.04,0.04);}
    else{depth=0.27*(Math.random()<0.5?1:-1);lateral=rnd(-0.14,0.14);}
    const target=HOOP.clone().addScaledVector(direction,depth).addScaledVector(perpendicular,lateral);
    const flightTime=shotFlightTime(0.78+distance*0.062,G.myStar||opponent,spot);
    const velocity=V3((target.x-start.x)/flightTime,(target.y-start.y)/flightTime+4.9*flightTime,(target.z-start.z)/flightTime);
    OPP.shotPose=captureShotPose?captureShotPose(OPP.guy):null;
    const mesh=new global.THREE.Mesh(ballGeo,spot.super?matGold:(spot.deep!=null?matDeep:matBall));
    mesh.position.copy(start);scene.add(mesh);
    const blob=new global.THREE.Mesh(blobGeo,blobMat.clone());blob.rotation.x=-Math.PI/2;blob.position.set(start.x,0.02,start.z);scene.add(blob);
    balls.push({mesh,blob,p0:start.clone(),v0:velocity,tf:flightTime,t:0,phase:"fly",outcome:made?"swish":"rimout",
      vel:new global.THREE.Vector3(),val:spot.val,money:false,deep:spot.deep!=null,super:!!spot.super,made:false,life:1.6,bounces:0,
      rec:[],timeLeft:0,hot:false,startPos:start.clone(),silent:true,opp:true,sp:spot,collided:false,superChanceId:OPP.possessionSuperChanceId||0});
    OPP.guy.ball.visible=false;
  }
  function oppScore(ball){
    if(ball.super)battle.battleConsumeSuperChance(ball);
    const previousMe=G.score,previousOpponent=G.battleOppScore;
    G.battleOppScore+=ball.val;triggerStreetCrowdReaction("oppMake",ball.val);bloomOnScore(ball.val);
    const ending=G.battleOppScore>=BATTLE_TARGET;if(ending)beginFinalAudioWindow();
    if(!ending&&ball.super){broadcastSting("danger");toast(OPP.o.n+" 命中中场10分!","#ff8d7a");boo(1.1);gameDjSay("对手中场超远命中!","special",2.2);}
    else if(!ending&&ball.deep){broadcastSting("danger");toast(OPP.o.n+" 命中彩球5分!","#72dfff");}
    else if(!ending&&Math.random()<0.3)toast(OPP.o.n+" +"+ball.val,"#9fd1ff");
    ctx.setNetPulse(1);sSwish();
    if(!ending){battle.battleCheckSuperMilestones();battleScoreCallout(previousMe,previousOpponent);}
    battle.updBattleUI();updJumbo();
    if(ending){battle.finishBattle(false,ball);return;}
    checkBattleOvertake(previousMe,previousOpponent);
  }
  function updOppShooter(dt){
    if(!OPP.on||G.battleOver)return;
    const guy=OPP.guy;OPP.t+=dt;
    if(OPP.phase==="walk"){
      const duration=clamp(OPP.from.distanceTo(OPP.to)/3.4,0.35,1.6),progress=Math.min(1,OPP.t/duration);
      OPP.pos.lerpVectors(OPP.from,OPP.to,progress);guy.g.position.copy(OPP.pos);guy.g.rotation.y=faceTo(OPP.pos,HOOP);
      const swing=Math.sin(OPP.t*15);
      guy.legs[0].rotation.x=swing*0.55;guy.legs[1].rotation.x=-swing*0.55;
      guy.knees[0].rotation.x=Math.max(0,-swing*0.4+0.2);guy.knees[1].rotation.x=Math.max(0,swing*0.4+0.2);
      guy.ankles[0].rotation.x=-swing*0.2;guy.ankles[1].rotation.x=swing*0.2;
      if(progress>=1){
        guy.legs.forEach(leg=>leg.rotation.x=0);guy.knees.forEach(knee=>knee.rotation.x=0);guy.ankles.forEach(ankle=>ankle.rotation.x=0);oppBeginPass();
      }
    }else if(OPP.phase==="receive"){
      const pass=OPP.ballOut;
      if(!pass){oppBeginLoad();return;}
      pass.t+=dt;const k=Math.min(1,pass.t/pass.dur);
      pass.mesh.position.lerpVectors(pass.from,pass.to,k);
      pass.mesh.position.y+=Math.sin(k*Math.PI)*.65;pass.mesh.rotation.x-=dt*10;
      oppPasser.arms.forEach(arm=>arm.rotation.x=-1.5+k*1.15);
      oppPasser.elbows.forEach(elbow=>elbow.rotation.x=-.9+k*.8);
      if(k>=1){
        scene.remove(pass.mesh);OPP.ballOut=null;oppPasserBall.visible=true;resetOppPasserPose();
        sBounce();oppBeginLoad();
      }
    }else if(OPP.phase==="load"){
      const phase=Math.min(1.05,OPP.t/OPP.shootDur*1.05),curve=shotCurves(phase);
      const groundLift=poseGuy(guy,curve,0);
      const stance=shotStanceBlend(curve,true);
      guy.g.position.set(OPP.pos.x,groundLift+Math.max(0,curve.jmp*0.55-curve.over*0.28),OPP.pos.z);
      guy.g.rotation.y=faceTo(OPP.pos,HOOP)+SHOT_STANCE_YAW*stance;
      // poseGuy 内部已由 applyShotSetPose 统一写入与玩家相同的松手前姿势。
      if(phase>=1.02&&!OPP.fired){OPP.fired=true;oppFireBall();OPP.phase="land";OPP.t=0;}
    }else if(OPP.phase==="land"){
      const progress=Math.min(1,OPP.t/.36),settle=progress*progress;
      const curve=shotCurves(1.02*(1-settle));
      const landing=progress>.72?Math.sin((progress-.72)/.28*Math.PI)*.12:0;
      const poseY=poseGuy(guy,curve,landing);
      const jump=Math.max(0,curve.jmp*0.55-curve.over*0.28);
      guy.g.position.set(OPP.pos.x,poseY+jump,OPP.pos.z);
      guy.g.rotation.y=faceTo(OPP.pos,HOOP)+SHOT_STANCE_YAW*shotStanceBlend(curve,false);
      const extend=ease01(OPP.t/.105),recover=ease01((OPP.t-.105-.24)/.38);
      const followState={active:OPP.t<.105+.24+.38,extend,follow:extend*(1-recover),recover};
      if(global.AIBAShotMotion&&OPP.shotPose)global.AIBAShotMotion.applyFollowThroughPose(guy,followState,OPP.shotPose);
      else oppFollowThroughPose(guy,followState.follow);
      if(progress>=1){
        OPP.fired=false;OPP.shotPose=null;poseGuy(guy,shotCurves(0),0);guy.g.position.set(OPP.pos.x,0,OPP.pos.z);guy.g.rotation.x=0;
        oppMarkSpotUse();OPP.phase="cool";OPP.t=0;
        const baseCool=clamp(0.5-(OPP.o.r-85)*0.01,0.25,0.55)+rnd(0,0.2);OPP.coolDur=OPP.forceMove?Math.max(0.2,baseCool*0.55):baseCool;
      }
    }else if(OPP.phase==="cool"&&OPP.t>=OPP.coolDur){
      if(!OPP.forceMove&&oppSpotReady(OPP.spotIdx)&&OPP.spotShots<oppSpotQuota(OPP.spotIdx))oppBeginPass();
      else oppPickSpot();
    }
  }
  function updBattle(dt){
    if(G.mode!=="battle"||G.state!=="battle"||G.battleOver)return;
    if(OPP.on&&OPP.playerSpotSeen!==(G.battleSpot||0))oppRepositionForPlayer();
    G._battleUiAcc=(G._battleUiAcc||0)+dt;
    if(G._battleUiAcc>0.25){G._battleUiAcc=0;battle.updBattleUI();ctx.updDotsUI();}
    if(Math.max(G.score||0,G.battleOppScore||0)>=85&&global.AIBARecorder&&global.AIBARecorder.arm)global.AIBARecorder.arm("百分大战最后三球");
    updOppShooter(dt);checkBallCollisions();
    let jumboAcc=ctx.getJumboAcc()+dt;if(jumboAcc>0.5){jumboAcc=0;updJumbo();}ctx.setJumboAcc(jumboAcc);
  }

  Object.assign(battle,{mirrorSpot,battlePlayerPos,avoidPlayerOverlap,oppSpotPos,oppRepositionForPlayer,oppSpotQuota,oppSpotCooldown,oppSpotReady,oppMarkSpotUse,cancelOppPass,oppBeginPass,oppBeginLoad,startOppShooter,oppPickSpot,oppFireBall,oppScore,updOppShooter,updBattle});
})(window);
