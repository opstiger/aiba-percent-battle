/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let jumboAcc=0,lowBeep=0,menuFrameAcc=0,visionAmbienceAcc=0,lastI18nState=null;
let pausePresentationT=0,pauseAmbienceAcc=0,pauseWasOn=false;
const pauseLook=V3(0,0,0);
function updatePausePresentation(dt){
  if(!pauseWasOn){pauseWasOn=true;pausePresentationT=0;pauseAmbienceAcc=0;}
  const step=Math.min(.05,Math.max(0,Number(dt)||0));
  pausePresentationT+=step;pauseAmbienceAcc+=step;
  /* 暂停只停玩法时钟，不停纯演出层：环境、近场观众和轻微手持感仍然有
     生命力。这里不调用 updPose/updBalls/updWalk，所以不会偷偷推进投篮、传球
     或位移；镜头抖动只写入 camera，不污染 rig，恢复时能无缝回到原取景。 */
  if(typeof updateEnvironment==="function")updateEnvironment(step);
  /* 近场观众离镜头最近，必须跟渲染帧走；远景人群和后场装饰继续节流。 */
  if(typeof updNearCourtCrowd==="function")updNearCourtCrowd(G.tNow+pausePresentationT,step);
  if(pauseAmbienceAcc>=1/12){
    const ambienceDt=pauseAmbienceAcc;pauseAmbienceAcc=0;
    if(typeof updCrowd==="function")updCrowd(G.tNow+pausePresentationT);
    if(typeof updBackcourtShow==="function")updBackcourtShow(G.tNow+pausePresentationT);
    if(typeof updStreetCrowd==="function")updStreetCrowd(G.tNow+pausePresentationT,ambienceDt);
  }
  const sway=Math.sin(pausePresentationT*1.45)*.0045;
  const lift=Math.sin(pausePresentationT*1.12+.8)*.0025;
  camera.position.copy(rig.pos);camera.position.x+=sway;camera.position.y+=lift;
  pauseLook.copy(rig.look);pauseLook.x+=sway*.34;pauseLook.y+=lift*.4;
  camera.lookAt(pauseLook);camera.updateMatrixWorld();
  if(typeof updGroundShadows==="function")updGroundShadows();
  renderer.render(scene,camera);
}
function animate(){
  requestAnimationFrame(animate);
  /* 把真实经过的时间和单帧模拟步长分开：低帧率时物理仍封顶，避免球穿板，
     但蓄力、比赛时钟、供球和演出不能因此变慢，肌肉记忆才不会随设备帧率漂移。 */
  const realDt=Math.min(.25,Math.max(0,clock.getDelta()));
  let dt=Math.min(0.05,realDt);
  G.realDt=realDt;G.simDt=dt;
  updateVisualOverlays();if(window.AIBANavigation)AIBANavigation.sync();
  // 菜单有全屏封面覆盖，15fps 足够保留背景氛围，避免手机开赛前就满负荷。
  if(G.state==="menu"||G.state==="diff"){
    menuFrameAcc+=realDt;
    if(menuFrameAcc<1/15)return;
    dt=Math.min(.05,menuFrameAcc);menuFrameAcc=0;
  }
  if(PAUSE.on){
    updatePauseButton();
    updatePausePresentation(dt);
    return;
  }
  pauseWasOn=false;
  G.tNow+=realDt;
  /* 切模式时把 DOM 重扫一遍。观察器只在节点变化那一刻触发，应用自己拼的字符串
     （如 vsBanner 的 "星名 · 已翻译文案"）会停在半中半英上不再变化。 */
  if(G.state!==lastI18nState){
    lastI18nState=G.state;
    if(window.AIBAI18N&&AIBAI18N.refresh)AIBAI18N.refresh();
  }
  updateEnvironment(realDt);
  updateSceneAudio(realDt);
  updTweens(realDt);
  const frozen=!!G.cutAway||!!G.battleCut;
  if(!frozen){updBalls(dt);updPose(dt);updPass(dt);updWalk(dt);}
  /* 角色接地影跟位置走,姿势算完再同步。冻结时也要跑一次,否则暂停/回放里影子会留在原地。 */
  if(typeof updGroundShadows==="function")updGroundShadows();
  if(G.state==="aishow")updShow(realDt);
  if(G.state==="battle"&&!G.battleCut)updBattle(realDt);
  if(G.state==="rackrush")updateRackRush(realDt);
  if(G.state==="lastshot"&&typeof updateLastShot==="function")updateLastShot(realDt);
  if(G.state==="pregame")updPreGameShow(realDt);
  updFire(dt);
  updConf(dt);
  G.cheer=Math.max(0,G.cheer-realDt*0.5);
  visionAmbienceAcc+=realDt;
  if(visionAmbienceAcc>=1/12){
    const ambienceDt=visionAmbienceAcc;visionAmbienceAcc=0;
    updCrowd(G.tNow);updBackcourtShow(G.tNow);updStreetCrowd(G.tNow,ambienceDt);
  }
  /* 近场观众的欢呼、举牌和身体摆动在 12fps 下会明显卡顿；只把远景留在
     节流分支，近场每帧更新。它不参与玩法和判定。 */
  if(typeof updNearCourtCrowd==="function")updNearCourtCrowd(G.tNow,realDt);
  if(typeof updateNetPulse==="function")updateNetPulse(realDt);
  // 反超特写排队
  if(G.state==="round"&&!frozen)tryCutAway();
  if(G.cutAway)updCutAway(realDt);
  if(G.battleCut)updBattleCut(realDt);
  updatePractice(realDt);
  // states
  if(G.state==="round"&&G.running&&!G.practice){
    G.timer-=realDt;
    if(G.timer<35&&!G.organed){G.organed=true;organCharge();}if(G.timer<=12&&window.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm(G.stage==="final"?"决赛最后三球":"半决赛最后三球");if(!G.finalTenTriggered&&G.timer<=10&&G.seq&&G.shotIdx<G.seq.length){G.finalTenTriggered=true;playAudioEvent("contest_final10");}
    const tl=$("hudTimer"),tv=Math.max(0,G.timer).toFixed(1);
    if(tl.textContent!==tv)tl.textContent=tv;
    const tc=G.timer<=10?"low":"";if(tl.className!==tc)tl.className=tc;
    if(G.timer<=5&&G.timer>0&&G.tNow-lowBeep>1){lowBeep=G.tNow;sBeep();}
    jumboAcc+=realDt;if(jumboAcc>0.5){jumboAcc=0;updJumbo();}
    if(G.timer<=0&&!G.buzzed){
      G.buzzed=true;sBuzz();paSay("时间到!",true);
      if(G.charging)doRelease();
      G.canShoot=false;G.charging=false;handBall.visible=false;
      toast("⏱ 时间到!","#ff8d7a");
    }
    const done=G.buzzed||G.shotIdx>=G.seq.length;
    if(done&&balls.length===0&&!G.charging){endRound();}
  }
  if(G.state==="tiebreak"){
    if(G.shotIdx>=G.seq.length&&balls.length===0&&!G.charging){
      if(typeof transitionState==="function")transitionState("tiebreak-wait","tiebreak-delay");else G.state="tiebreak-wait";
      setTimeout(tiebreakResolve,600);
    }
  }
  if(G.charging){
    /* 蓄力是玩家输入的真实时间，不再使用被物理上限截短的 dt。 */
    G.power=Math.min(100,G.power+playerChargeRate()*realDt);
    const _ph=Math.round(G.power)+"%";if($("pFill").style.height!==_ph)$("pFill").style.height=_ph;
  }else hidePlayerPowerUI();
  // CameraDirector 统一拥有镜头，演出模块只通过它获得本帧写入权。
  // Last Shot 的 updateLastShotCam 失败时仍由 CameraDirector 回退到 updPlayCam(dt)。
  updateCameraDirector(dt);
  updateRenderQuality(realDt);
  if(window.AIBACameraFov&&AIBACameraFov.apply)AIBACameraFov.apply();
  camera.position.copy(rig.pos);
  camera.lookAt(rig.look);
  camera.updateMatrixWorld();
  updatePlayerPowerUI();
  updatePauseButton();
  renderer.render(scene,camera);if(window.AIBARecorder)AIBARecorder.tick({canvas:renderer.domElement});
  updSpotDots();
}


window.animate=animate;
window.AIBA.runtime.register("core:game-loop",Object.freeze({animate,clock}));
