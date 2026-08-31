/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let jumboAcc=0,lowBeep=0,menuFrameAcc=0,visionAmbienceAcc=0,lastI18nState=null;
function animate(){
  requestAnimationFrame(animate);
  let dt=Math.min(0.05,clock.getDelta());
  updateVisualOverlays();if(window.AIBANavigation)AIBANavigation.sync();
  // 菜单有全屏封面覆盖，15fps 足够保留背景氛围，避免手机开赛前就满负荷。
  if(G.state==="menu"||G.state==="diff"){
    menuFrameAcc+=dt;
    if(menuFrameAcc<1/15)return;
    dt=Math.min(.05,menuFrameAcc);menuFrameAcc=0;
  }
  if(PAUSE.on){
    updatePauseButton();
    camera.position.copy(rig.pos);
    camera.lookAt(rig.look);
    camera.updateMatrixWorld();
    renderer.render(scene,camera);
    return;
  }
  G.tNow+=dt;
  /* 切模式时把 DOM 重扫一遍。观察器只在节点变化那一刻触发，应用自己拼的字符串
     （如 vsBanner 的 "星名 · 已翻译文案"）会停在半中半英上不再变化。 */
  if(G.state!==lastI18nState){
    lastI18nState=G.state;
    if(window.AIBAI18N&&AIBAI18N.refresh)AIBAI18N.refresh();
  }
  updateEnvironment(dt);
  updateSceneAudio(dt);
  updTweens(dt);
  const frozen=!!G.cutAway||!!G.battleCut;
  if(!frozen){updBalls(dt);updPose(dt);updPass(dt);updWalk(dt);}
  /* 角色接地影跟位置走,姿势算完再同步。冻结时也要跑一次,否则暂停/回放里影子会留在原地。 */
  if(typeof updGroundShadows==="function")updGroundShadows();
  if(G.state==="aishow")updShow(dt);
  if(G.state==="battle"&&!G.battleCut)updBattle(dt);
  if(G.state==="rackrush")updateRackRush(dt);
  if(G.state==="lastshot"&&typeof updateLastShot==="function")updateLastShot(dt);
  if(G.state==="pregame")updPreGameShow(dt);
  updFire(dt);
  updConf(dt);
  G.cheer=Math.max(0,G.cheer-dt*0.5);
  visionAmbienceAcc+=dt;
  if(visionAmbienceAcc>=1/12){
    const ambienceDt=visionAmbienceAcc;visionAmbienceAcc=0;
    updCrowd(G.tNow);updBackcourtShow(G.tNow);updNearCourtCrowd(G.tNow,ambienceDt);updStreetCrowd(G.tNow,ambienceDt);
  }
  if(netPulse>0){netPulse-=dt*3;const s=1+netPulse*0.35;netMesh.scale.set(s,1+netPulse*0.5,s);}
  // 反超特写排队
  if(G.state==="round"&&!frozen)tryCutAway();
  if(G.cutAway)updCutAway(dt);
  if(G.battleCut)updBattleCut(dt);
  updatePractice(dt);
  // states
  if(G.state==="round"&&G.running&&!G.practice){
    G.timer-=dt;
    if(G.timer<35&&!G.organed){G.organed=true;organCharge();}if(G.timer<=12&&window.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm(G.stage==="final"?"决赛最后三球":"半决赛最后三球");if(!G.finalTenTriggered&&G.timer<=10&&G.seq&&G.shotIdx<G.seq.length){G.finalTenTriggered=true;playAudioEvent("contest_final10");}
    const tl=$("hudTimer"),tv=Math.max(0,G.timer).toFixed(1);
    if(tl.textContent!==tv)tl.textContent=tv;
    const tc=G.timer<=10?"low":"";if(tl.className!==tc)tl.className=tc;
    if(G.timer<=5&&G.timer>0&&G.tNow-lowBeep>1){lowBeep=G.tNow;sBeep();}
    jumboAcc+=dt;if(jumboAcc>0.5){jumboAcc=0;updJumbo();}
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
      G.state="tiebreak-wait";setTimeout(tiebreakResolve,600);
    }
  }
  if(G.charging){
    G.power=Math.min(100,G.power+playerChargeRate()*dt);
    const _ph=Math.round(G.power)+"%";if($("pFill").style.height!==_ph)$("pFill").style.height=_ph;
  }else hidePlayerPowerUI();
  // cameras
  if(window.AIBACamera&&AIBACamera.isEditing&&AIBACamera.isEditing()){
    AIBACamera.updateEditor(dt);
  }else{
    if(VICTORY_CINE.on&&G.state!=="victorycine")stopVictoryCine();
    if(rep.on)updReplay(dt);
    else if(VICTORY_CINE.on)updVictoryCine(dt);
    else if(winCine.on)updWinCine(dt);
    else if(hero.on)updHero(dt);
    else if(G.cutAway){/* updCutAway 已控制镜头 */}
    else if(G.battleCut){/* updBattleCut 已控制镜头 */}
    else if(G.state==="pregame"){/* updPreGameShow 已控制镜头 */}
    else if(G.state==="aishow")updShowCam();
    else if(["menu","diff","intro","roundend","sim","bracket","champion","runnerup","eliminated","battleend","rushend","lsend"].includes(G.state)){
      const a=G.tNow*0.1;
      rig.pos.set(Math.cos(a)*18,8+Math.sin(G.tNow*0.3)*0.5,COURT.midZ+Math.sin(a)*20);
      rig.look.set(0,2.2,COURT.midZ);
    }
    // 绝杀时刻:观看阶段由模式接管转头镜头,球一到手就交还 updPlayCam,出手镜头与其他模式一致
    else if(G.state==="lastshot"){if(!(typeof updateLastShotCam==="function"&&updateLastShotCam(dt)))updPlayCam(dt);}
    /* resultbeat = 结果留白。必须继续用比赛机位:它如果落进上面那条菜单分支,
       镜头会在蜂鸣器响的同一帧甩回环绕机位 —— 那正是"像程序在切状态"的来源。 */
    else if((G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="bootshot"||G.state==="resultbeat")&&!G.glideCam)updPlayCam(dt);
  }
  updateRenderQuality(dt);
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
