(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime;
  const ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Percent Battle state requires AIBA runtime legacy adapter");

  const {
    $,G,DIFFS,BATTLE_TARGET,BATTLE_SPOTS,BATTLE_NORMAL_STOCK,VISION,GAME_VERSION,GAME_SEED,
    COURT_ATTACK_DIR,HOOP,scene,balls,rivals,player,passer,oppPasser,oppPasserBall,handBall,pBall,hands,CAM,P,rig,
    camTarget,playerShotProfile,resetFinalRun,resetAudioCueMemory,resetRackBalls,stopCelebrate,
    ensureAudio,hidePanel,music,resetProgressiveSceneForRun,benchSetup,enterArenaAudio,
    curShot,shotBase,faceTo,applyCamMode,autoFrameCam,glideTo,startPreGameShow,stopVictoryCine,
    playPregameCountdownCue,sGo,calibrateTilt,readyBall,toast,sBeep,paSay
  }=ctx;
  const BATTLE_RUNS_KEY="aiba-battle-runs-v1";
  const battle=global.AIBABattle||{};
  const OPP=battle.OPP||{on:false,o:null,guy:null,spotIdx:2,phase:"idle",t:0,pos:null,nextPos:null,curve:null,ballOut:null,spotShots:0,coolUntil:null,forceMove:false};
  battle.OPP=OPP;
  global.AIBABattle=battle;
  global.OPP=OPP;

  function startBattleClock(){G.battleClock={startedAt:performance.now(),pausedAt:0,pausedMs:0,finishedMs:null};}
  function pauseBattleClock(){
    const clock=G.battleClock;if(!clock||clock.pausedAt||clock.finishedMs!=null)return;clock.pausedAt=performance.now();
  }
  function resumeBattleClock(){
    const clock=G.battleClock;if(!clock||!clock.pausedAt||clock.finishedMs!=null)return;
    clock.pausedMs+=performance.now()-clock.pausedAt;clock.pausedAt=0;
  }
  function battleElapsedMs(){
    const clock=G.battleClock;if(!clock)return 0;if(clock.finishedMs!=null)return clock.finishedMs;
    const end=clock.pausedAt||performance.now();return Math.max(0,end-clock.startedAt-clock.pausedMs);
  }
  function stopBattleClock(){
    const clock=G.battleClock;if(!clock)return 0;clock.finishedMs=battleElapsedMs();clock.pausedAt=0;return clock.finishedMs;
  }
  function formatBattleTime(ms){
    const tenths=Math.max(0,Math.floor((ms||0)/100)),minutes=Math.floor(tenths/600),seconds=Math.floor(tenths/10)%60,tenth=tenths%10;
    return minutes+":"+String(seconds).padStart(2,"0")+"."+tenth;
  }
  function loadBattleRuns(){
    try{const rows=JSON.parse(localStorage.getItem(BATTLE_RUNS_KEY)||"[]");return Array.isArray(rows)?rows:[];}catch(e){return[];}
  }
  function makeBattleRecord(win,elapsedMs){
    const profile=playerShotProfile(),attempts=G.stats&&G.stats.attempts||0,makes=G.stats&&G.stats.makes||0,accuracy=attempts?makes/attempts:0;
    const stats=global.summarizeResultStats?global.summarizeResultStats():{};
    return Object.assign({schema:1,version:GAME_VERSION,mode:"percent-battle",target:BATTLE_TARGET,elapsedMs:Math.round(elapsedMs),won:!!win,
      eligible:!!win&&G.score>=BATTLE_TARGET,score:Math.min(G.score,BATTLE_TARGET),opponentScore:Math.min(G.battleOppScore||0,BATTLE_TARGET),attempts,makes,accuracy,
      playerId:G.myStar&&(G.myStar.id||G.myStar.n),playerName:G.myStar&&G.myStar.n,opponentId:G.battleOpp&&(G.battleOpp.id||G.battleOpp.n),opponentName:G.battleOpp&&G.battleOpp.n,
      difficulty:G.diff,control:G.battleControl||"touch",scene:ctx.getScenePreset(),weather:ctx.getWeather(),seed:GAME_SEED,
      shotSpeed:profile.speed,sweetWindow:profile.window,shotArc:profile.arc,shotArcLabel:profile.arcLabel,bestStreak:G.stats&&G.stats.best,
      deepMakes:G.stats&&G.stats.deepM,deepAttempts:G.stats&&G.stats.deepT,completedAt:new Date().toISOString()},stats);
  }
  function saveBattleRecord(record){
    try{const runs=loadBattleRuns();runs.unshift(record);localStorage.setItem(BATTLE_RUNS_KEY,JSON.stringify(runs.slice(0,50)));localStorage.setItem("aiba-battle-last-v1",JSON.stringify(record));}catch(e){}
    try{global.__aibaLastBattleRecord=record;global.__aibaBattleRuns=loadBattleRuns;if(global.AIBALeaderboardUI)AIBALeaderboardUI.submitRecord(record);else if(global.AIBALeaderboard)AIBALeaderboard.submit(record).catch(()=>{});}catch(e){}
    return record;
  }
  function resetBattleState(){
    stopVictoryCine();
    resetFinalRun();resetAudioCueMemory();
    G.seq=[];G.shotIdx=0;G.score=0;G.streak=0;G.timer=0;G.buzzed=false;G.running=false;
    G.shots=[];G.canShoot=false;G.blindToasted=false;G.cutQ=[];G.cutAway=null;G.missRun=0;G.posted=[];
    G.battleSpot=2;G.battleOppScore=0;G.battleNext=1.15;G.battleOver=false;
    G.battleStock=[5,5,5,5,5,1,1,0];G.battleReadyAt=Array(BATTLE_SPOTS.length).fill(0);
    G.superStock=0;G.superSeenMe=0;G.superSeenOpp=0;G.superChanceId=0;G.superResolvedId=0;
    G.superStreak=0;G.superTakenBy=null;G.superSkin=0;G.battleChargeSuperChanceId=0;G._battleUiAcc=0;
    G.battleCalls={};G.battleScoreEvents=0;G.battleCutCount=0;G.battleLastCutAt=-1e9;G.battleLastCutEvent=-1e9;G.battleCutLockUntil=0;
    G.battleClock=null;G.battleResultRecord=null;G.battleControl=VISION.enabled?"vision":"touch";
    G.stats={best:0,moneyM:0,moneyT:0,deepM:0,deepT:0};
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    if(typeof battle.cancelOppPass==="function")battle.cancelOppPass();
    OPP.on=false;OPP.fired=false;OPP.spotShots=0;OPP.coolUntil=null;OPP.forceMove=false;G.battleCut=null;
    oppPasser.g.visible=false;oppPasserBall.visible=true;
    if(player._celeb)stopCelebrate(player);resetRackBalls();
  }
  function startBattle(){
    if(global.ensurePlayerShoeKit)global.ensurePlayerShoeKit();
    G.mode="battle";
    ensureAudio(false);hidePanel();music(false);resetProgressiveSceneForRun();benchSetup();ctx.refreshBench();resetBattleState();
    CAM.mode=1;global.AIBASetIcon("camBtn","camera",CAM.names[1]);G._preSuperCam=null;ctx.setCamSnap(true);
    enterArenaAudio(1);$("scoreNum").textContent="0";$("hudStreak").style.display="none";
    $("hudTimer").style.display="none";$("bsTimer").textContent="0:00.0";$("hudTimer").className="";
    $("hudRound").innerHTML="百分大战<br><span style='color:#778'>"+DIFFS[G.diff].n+" · 净计时</span>";
    $("hud").dataset.mode="battle";$("hud").style.display="block";$("battleControls").style.display="flex";battle.updBattleUI();
    const first=curShot(),base=shotBase(first);
    P.pos.copy(base);P.face=faceTo(base,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    player.g.visible=true;passer.g.visible=true;oppPasser.g.visible=true;oppPasserBall.visible=true;hands.visible=false;G.state="cinematic";
    rig.pos.set(0,11,7);rig.look.copy(HOOP);paSay("百分大战开始!先到一百分获胜!",true);
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.48,marginY:1.36,minDist:5.8,maxDist:32});
    glideTo(camTarget.pos.clone(),camTarget.look.clone(),1.4,()=>startPreGameShow({mode:"battle"},()=>countdownBattle(3)));
  }
  function countdownBattle(n){
    if(G.state!=="cinematic")return;
    const el=$("countN");if(n===3)playPregameCountdownCue();
    if(n===0){
      el.textContent="GO!";el.style.display="flex";sGo();setTimeout(()=>el.style.display="none",500);
      calibrateTilt();G.state="battle";G.running=true;startBattleClock();applyCamMode();readyBall();battle.startOppShooter();toast("百分大战!先到100分","#ffd23f");return;
    }
    el.textContent=n;el.style.display="flex";sBeep();setTimeout(()=>countdownBattle(n-1),750);
  }

  Object.assign(battle,{startBattleClock,pauseBattleClock,resumeBattleClock,battleElapsedMs,stopBattleClock,formatBattleTime,loadBattleRuns,makeBattleRecord,saveBattleRecord,resetBattleState,startBattle,countdownBattle});
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)pauseBattleClock();else if(G.state==="battle"&&!G.battleCut&&!G.battleOver)resumeBattleClock();
  });
})(window);
