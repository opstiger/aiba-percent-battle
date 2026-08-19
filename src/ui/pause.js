(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx||!runtime.service("ui:panels"))throw new Error("UI pause requires panels and legacy adapter");
  const {$,G,PAUSE,BATTLE_TARGET,scene,balls,handBall,pBall,passerBall,rep,endHero,leaveArenaAudio,applyCamMode}=ctx;

  function pauseableState(){
    return G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="replay";
  }
  function updatePauseButton(){
    const button=$("pauseBtn");if(!button)return;
    button.classList.toggle("ready",!global.BOOT_GATE_ACTIVE&&(PAUSE.on||pauseableState()));
  }
  function pauseModeLabel(){
    if(G.mode==="battle")return "百分大战";
    if(G.mode==="rackrush")return G.rush&&global.isRackRushSpeed(G.rush)?"百分竞速":"投篮机挑战";
    if(G.practice)return "练习模式";
    return "三分大赛";
  }
  function pauseScoreLine(){
    if(G.mode==="battle")return `你 ${Math.min(G.score||0,BATTLE_TARGET)} : ${Math.min(G.battleOppScore||0,BATTLE_TARGET)} ${G.battleOpp?G.battleOpp.n:"对手"}`;
    if(G.mode==="rackrush"&&G.rush)return `${G.rush.total||0} 分 · ${global.isRackRushSpeed(G.rush)?global.formatRackRushClock(G.rush.elapsed||0):("L"+((G.rush.level||0)+1))}`;
    if(G.practice)return "热身中";
    return `${G.score||0} 分 · ${Math.max(0,G.timer||0).toFixed(1)} 秒`;
  }
  function cancelLiveChargeForPause(){
    if(typeof global.cancelVisionOwnedCharge==="function")global.cancelVisionOwnedCharge();
    if(!G.charging)return;
    G.charging=false;G.power=0;G.apexed=false;$("pFill").style.height="0%";
    if(typeof global.hidePlayerPowerUI==="function")global.hidePlayerPowerUI();
  }
  function renderPauseMenu(){
    global.showPanel(`<div class="pausePanel">
      <div class="pauseMeta">GAME PAUSED</div>
      <h1>${pauseModeLabel()}</h1>
      <div class="card">当前进度：<b style="color:#ffd23f">${pauseScoreLine()}</b><br><span style="color:#9ab">可以继续、重开当前模式，或直接返回首页。</span></div>
      <div class="pauseActions">
        <button class="btn green" data-aiba-icon="play" data-aiba-label="继续比赛" onclick="resumePauseMenu()">继续比赛</button>
        <button class="btn" data-aiba-icon="settings" data-aiba-label="游戏设置" onclick="openPausedSettings()">游戏设置</button>
        <button class="btn gold" data-aiba-icon="rotate-ccw" data-aiba-label="重开当前模式" onclick="restartPausedMode()">重开当前模式</button>
        <button class="btn red" data-aiba-icon="arrow-left" data-aiba-label="返回首页" onclick="returnHomeFromPause()">返回首页</button>
      </div>
    </div>`);
  }
  function openPausedSettings(){
    if(!PAUSE.on||!global.AIBAPerfSettings)return;
    global.AIBAPerfSettings.open(null,{returnToPause:true});
  }
  function openPauseMenu(event){
    if(event){event.preventDefault();event.stopPropagation();}
    if(PAUSE.on||!pauseableState())return;
    PAUSE.on=true;PAUSE.state=G.state;PAUSE.mode=G.mode;PAUSE.wasRunning=G.running;PAUSE.canShoot=G.canShoot;
    PAUSE.rushVariant=G.rush&&G.rush.variant?G.rush.variant:null;PAUSE.practice=!!G.practice;
    cancelLiveChargeForPause();G.running=false;G.canShoot=false;
    if(G.mode==="battle")global.pauseBattleClock();
    updatePauseButton();
    renderPauseMenu();
  }
  function resumePauseMenu(){
    if(!PAUSE.on)return;
    const wasRunning=PAUSE.wasRunning,canShoot=PAUSE.canShoot||G.canShoot;
    PAUSE.on=false;G.running=wasRunning;G.canShoot=canShoot;
    if(G.mode==="battle"&&G.state==="battle"&&!G.battleCut&&!G.battleOver)global.resumeBattleClock();
    global.hidePanel();updatePauseButton();
  }
  function clearLiveObjectsForMenu(options){
    if(G.mode==="lastshot"&&typeof global.exitLastShot==="function")global.exitLastShot();
    if(global.AIBANavigation)global.AIBANavigation.cleanup(options);
    const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    G.charging=false;G.canShoot=false;G.running=false;G.moving=false;G.glideCam=false;G.cutAway=null;G.battleCut=null;
    handBall.visible=false;pBall.visible=false;if(passerBall)passerBall.visible=true;
    if(typeof endHero==="function")endHero();
    if(rep){rep.on=false;if(rep.ghost)rep.ghost.visible=false;if(rep.gBlob)rep.gBlob.visible=false;}
    const winCine=ctx.getWinCine();if(winCine)winCine.on=false;
    $("lbT").style.height="0";$("lbB").style.height="0";$("repUI").style.display="none";$("vsBanner").style.display="none";
    $("battleControls").style.display="none";$("battleScore").style.display="none";$("midBtn").style.display="none";
    $("hud").style.display="none";leaveArenaAudio();applyCamMode();
  }
  function restartPausedMode(){
    if(!PAUSE.on)return;
    const mode=PAUSE.mode,variant=PAUSE.rushVariant||"classic",practice=PAUSE.practice;
    PAUSE.on=false;global.hidePanel();clearLiveObjectsForMenu();updatePauseButton();
    if(mode==="battle"){global.startBattle();return;}
    if(mode==="rackrush"){global.startRackRush(variant);return;}
    if(practice){global.startPractice();return;}
    global.startRound();
  }
  function returnHomeFromPause(){
    if(!PAUSE.on)return;
    PAUSE.on=false;global.hidePanel();clearLiveObjectsForMenu();global.showMenu();updatePauseButton();
  }

  const api=Object.freeze({pauseableState,updatePauseButton,pauseModeLabel,pauseScoreLine,cancelLiveChargeForPause,renderPauseMenu,openPausedSettings,openPauseMenu,resumePauseMenu,clearLiveObjectsForMenu,restartPausedMode,returnHomeFromPause});
  Object.assign(global,api);runtime.register("ui:pause",api);
})(window);
