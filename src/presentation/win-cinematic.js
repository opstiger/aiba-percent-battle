/* ---------------- 英雄时刻:制胜球电影化慢动作 ---------------- */
/* 阶段(墙钟秒): 0出手特写 → 1飞行轨迹 → 2全场沸腾(观众视角) → 3败方惊讶 → 结算 */
const WC_T0=1.3, WC_T1=4.0, WC_T2=5.5, WC_T3=7.4;
const winCine={on:false,win:true,t:0,gold:false,rec:null,recEnd:0,p0:null,
  shooter:null,loser:null,sPos:null,sFace:null,lPos:null,lFace:null,
  ghost:null,gBlob:null,fxCrowd:false,heroStarted:false,ballHitFx:false,camSeed:0,heroType:0};
function poseShock(o,k){
  poseGuy(o,shotCurves(0),0);
  const up=-2.45*k;
  o.arms[0].rotation.x=up;o.arms[1].rotation.x=up;
  o.arms[0].rotation.z=0.45*k;o.arms[1].rotation.z=-0.45*k;
  if(o.elbows){o.elbows[0].rotation.x=-1.25*k;o.elbows[1].rotation.x=-1.25*k;}
  o.g.rotation.x=-0.16*k; // 后仰
  o.legs[0].rotation.x=0.22*k;o.legs[1].rotation.x=0.22*k;
  if(o.knees){o.knees[0].rotation.x=0.42*k;o.knees[1].rotation.x=0.42*k;}
}
function startWinCine(win,ball){
  const w=winCine;
  w.on=true;w.win=win;w.t=0;w.fxCrowd=false;w.heroStarted=false;w.ballHitFx=false;w.camSeed=Math.random()*Math.PI*2;w.heroType=(Math.random()*8)|0;if(window.AIBARecorder)AIBARecorder.mark(win?"百分大战制胜球":"对手破百瞬间",{postMs:(WC_T3+1.2)*1000});
  G.battleResultRecord=saveBattleRecord(makeBattleRecord(win,stopBattleClock()));
  G.battleOver=true;G.running=false;G.canShoot=false;G.charging=false;
  if(typeof cancelOppPass==="function")cancelOppPass(true);
  G.cutAway=null;G.battleCut=null;G.glideCam=false;G.state="wincine";
  endHero();
  // 隐藏比赛 HUD/控件,但保留比分牌与角色
  $("battleControls").style.display="none";$("midBtn").style.display="none";
  $("spotDots").style.display="none";$("edgeArrows").style.display="none";
  if(curSpotRing)curSpotRing.visible=false;
  handBall.visible=false;pBall.visible=false;
  // 把还在场的真实球藏掉,改用回放幽灵球
  balls.forEach(bb=>{bb.mesh.visible=false;bb.blob.visible=false;bb.silent=true;bb.life=Math.min(bb.life,0.02);});
  // 投篮者 / 失败者
  if(win){
    w.shooter=player; w.loser=OPP.guy;
    w.sPos=P.pos.clone(); w.sFace=P.face;
  }else{
    w.shooter=OPP.guy; w.loser=player;
    w.sPos=(OPP.pos||OPP.guy.g.position).clone(); w.sFace=faceTo(w.sPos,HOOP);
  }
  w.lPos=(win?(OPP.pos||OPP.guy.g.position):P.pos).clone();
  w.lFace=faceTo(w.lPos,HOOP);
  if(OPP.guy)OPP.guy.active=true;
  // 制胜球轨迹数据
  w.gold=!!(ball&&ball.super);
  if(ball&&ball.rec&&ball.rec.length>2){w.rec=ball.rec;w.recEnd=ball.rec[ball.rec.length-1][0];w.p0=(ball.p0||V3(w.sPos.x,2.05,w.sPos.z)).clone();}
  else{w.rec=null;w.recEnd=0;w.p0=V3(w.sPos.x,2.05,w.sPos.z);}
  if(!w.ghost){
    w.ghost=new THREE.Mesh(ballGeo,matBall);scene.add(w.ghost);
    w.gBlob=new THREE.Mesh(blobGeo,blobMat.clone());w.gBlob.rotation.x=-Math.PI/2;scene.add(w.gBlob);
  }
  w.ghost.material=w.gold?matGold:matBall;
  w.ghost.visible=true;w.gBlob.visible=true;
  w.ghost.position.copy(w.p0);w.gBlob.position.set(w.p0.x,0.02,w.p0.z);
  // 电影感:黑边 + 字幕
  $("lbT").style.height="11vh";$("lbB").style.height="11vh";
  $("heroTag").style.display="block";window.AIBASetIcon("heroTag","clapperboard","英雄时刻");
  broadcastSting(win?"score":"danger");
}
const _wcGhost=new THREE.Vector3();
function winCineBallAt(recT){
  const w=winCine;
  if(!w.rec){_wcGhost.copy(w.p0);return _wcGhost;}
  const r=w.rec;let j=1;while(j<r.length&&r[j][0]<recT)j++;
  const a=r[Math.max(0,j-1)],b=r[Math.min(j,r.length-1)];
  const k=b[0]>a[0]?(recT-a[0])/(b[0]-a[0]):0;
  _wcGhost.set(a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k,a[3]+(b[3]-a[3])*k);
  return _wcGhost;
}
function updWinCine(dt){
  const w=winCine;if(!w.on)return;
  w.t+=dt;
  const tt=w.t;
  const sdir=HOOP.clone().sub(w.sPos);sdir.y=0;if(sdir.lengthSq()<1e-4)sdir.set(0,0,-1);sdir.normalize();
  const perp=V3(sdir.z,0,-sdir.x);
  const side=w.sPos.x>0?-1:1; // 取靠场内一侧,避免镜头穿到看台外
  // 角色始终可见(此刻 applyCamMode 视为非比赛态会隐藏,故每帧强制)
  hands.visible=false;passer.g.visible=false;if(typeof oppPasser!=="undefined")oppPasser.g.visible=false;
  if(w.shooter)w.shooter.g.visible=true;
  if(w.loser)w.loser.g.visible=true;

  /* ---- 投篮者姿态:出手→跟随动作定格 ---- */
  if(tt<WC_T1){
    let ph=tt<WC_T0?(0.82+0.26*(tt/WC_T0)):1.08;
    const sc=shotCurves(ph);
    const sy=poseGuy(w.shooter,sc,0)+Math.max(0,sc.jmp*0.55-sc.over*0.55);
    applyHandFollowThroughPose(w.shooter,ease01((ph-.94)/.12));
    w.shooter.g.position.set(w.sPos.x,sy,w.sPos.z);
    w.shooter.g.rotation.y=w.sFace;w.shooter.g.rotation.x=0;
  }

  /* ---- 失败者姿态:震惊前保持站立,T2 起慢慢举手后仰 ---- */
  if(tt<WC_T2){
    poseGuy(w.loser,shotCurves(0),0);
    w.loser.g.position.set(w.lPos.x,0,w.lPos.z);
    w.loser.g.rotation.y=w.lFace;w.loser.g.rotation.x=0;
  }else{
    const k=clamp((tt-WC_T2)/0.7,0,1);
    poseShock(w.loser,k);
    w.loser.g.position.set(w.lPos.x,0,w.lPos.z);
    w.loser.g.rotation.y=w.lFace;
  }

  /* ---- 幽灵球轨迹 ---- */
  let ballPos;
  if(tt<WC_T0){
    ballPos=w.rec?winCineBallAt(0):w.p0; w.ghost.visible=true;
  }else if(tt<WC_T1){
    const prog=(tt-WC_T0)/(WC_T1-WC_T0);
    ballPos=winCineBallAt(prog*w.recEnd); w.ghost.visible=true;
    w.ghost.rotation.x-=dt*5;
  }else{
    // 已入网,藏球
    ballPos=HOOP; w.ghost.visible=false;w.gBlob.visible=false;
  }
  if(w.ghost.visible){
    w.ghost.position.copy(ballPos);
    w.gBlob.position.set(ballPos.x,0.02,ballPos.z);
    const bs=clamp(1.4-ballPos.y*0.12,0.3,1.4);w.gBlob.scale.set(bs,bs,1);
  }

  /* ---- 分阶段机位 ---- */
  const hb=Math.sin(tt*7)*0.04; // 轻微手持抖动
  if(tt<WC_T0){
    // 出手特写:站在投篮者与篮筐之间,回看其上半身与出手
    const cp=w.sPos.clone().addScaledVector(sdir,2.5).addScaledVector(perp,side*1.35).setY(2.1);
    rig.pos.set(cp.x,cp.y+hb,cp.z);
    const lk=w.sPos.clone().setY(1.85).lerp(w.p0,0.35);
    rig.look.set(lk.x,lk.y,lk.z);
    window.AIBASetIcon("heroTag","clapperboard","出手特写");
  }else if(tt<WC_T1){
    // 飞行轨迹:侧后方跟拍篮球弧线
    const cp=ballPos.clone().addScaledVector(perp,side*3.2).addScaledVector(sdir,-0.6);
    cp.y=clamp(ballPos.y*0.6+1.4,1.6,5.0);
    cp.x=clamp(cp.x,-12.5,12.5);
    rig.pos.set(cp.x,cp.y+hb,cp.z);
    rig.look.copy(ballPos);
    window.AIBASetIcon("heroTag","clapperboard","空中轨迹");
  }else if(tt<WC_T2){
    // 顺利时刻:命中后先给投篮者一个庆祝段落
    if(!w.heroStarted){startCelebrate(w.shooter,w.heroType);w.heroStarted=true;}
    if(!w.ballHitFx){
      w.ballHitFx=true;
      netPulse=1;sSwish();G.cheer=1;
      if(w.win){cheerSound(true);}else{boo(1.0);}
    }
    updateCelebrate(w.shooter,dt);
    const camPhase=(tt-WC_T1)/(WC_T2-WC_T1);
    const heroFocus=w.shooter.g.position.clone();heroFocus.y=1.55;
    const orbit=V3(perp.x*(2.2+0.45*Math.sin(w.camSeed*1.4)),0,perp.z*(2.2+0.45*Math.sin(w.camSeed*1.4)));
    const cp=(w.camSeed<Math.PI?heroFocus.clone().addScaledVector(sdir,2.0-camPhase*0.5).add(orbit):heroFocus.clone().addScaledVector(sdir,1.65-camPhase*0.3).addScaledVector(perp,side*(2.3+0.2*Math.cos(w.camSeed)))).setY(1.7+Math.sin(camPhase*Math.PI)*0.18+hb);
    rig.pos.set(cp.x,cp.y,cp.z);
    rig.look.set(heroFocus.x,1.55,heroFocus.z);
    window.AIBASetIcon("heroTag","clapperboard",w.win?"顺利时刻":"成功瞬间");
  }else if(tt<WC_T2+0.75){
    // 全场沸腾·观众视角:从篮筐后方看台俯视,人群在前景
    if(!w.fxCrowd){
      w.fxCrowd=true;netPulse=1;G.cheer=1;
      if(w.win){airhorn();cheerSound(true);}else{boo(1.0);}
    }
    updateCelebrate(w.shooter,dt);
    const crowdCp=V3(side*4.5,5.6,HOOP.z-4.6);
    rig.pos.set(crowdCp.x+hb,crowdCp.y,crowdCp.z);
    rig.look.set(w.sPos.x*0.4,2.3,(HOOP.z+w.sPos.z)*0.5);
    window.AIBASetIcon("heroTag","clapperboard",w.win?"全场沸腾":"对手率先破百");
  }else{
    // 败方惊讶:贴近失败者的低机位推镜
    updateCelebrate(w.shooter,dt);
    const ldir=HOOP.clone().sub(w.lPos);ldir.y=0;if(ldir.lengthSq()<1e-4)ldir.set(0,0,-1);ldir.normalize();
    const lperp=V3(ldir.z,0,-ldir.x);
    const push=clamp((tt-(WC_T2+0.75))/1.25,0,1);
    const loserCp=w.lPos.clone().addScaledVector(ldir,2.9-0.7*push).addScaledVector(lperp,side*1.25).setY(1.95);
    rig.pos.set(loserCp.x+hb,loserCp.y,loserCp.z);
    rig.look.set(w.lPos.x,1.55,w.lPos.z);
    window.AIBASetIcon("heroTag","clapperboard","难以置信");
  }

  if(tt>=WC_T3){
    w.on=false;
    if(w.ghost){w.ghost.visible=false;w.gBlob.visible=false;}
    if(w.heroStarted)stopCelebrate(w.shooter);
    $("lbT").style.height="0";$("lbB").style.height="0";$("heroTag").style.display="none";
    showBattleResult(w.win);
  }
}

window.AIBA.runtime.register("presentation:win-cinematic",Object.freeze({
  winCine,poseShock,startWinCine,winCineBallAt,updWinCine
}));
