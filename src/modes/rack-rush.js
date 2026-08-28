(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime;
  const ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Rack Rush requires AIBA runtime legacy adapter");

  const {
    $,G,DIFFS,RACK_RUSH_LEVELS,RACK_RUSH_RUNS_KEY,RACK_RUSH_SPEED_RUNS_KEY,
    RACK_RUSH_SPEED_TARGET,VISION,RACKS,HOOP,COURT_ATTACK_DIR,GAME_VERSION,GAME_SEED,
    scene,balls,rivals,player,passer,handBall,pBall,hands,confPts,CAM,P,rig,camTarget,
    shotProfileText,playerShotProfile,resetFinalRun,resetAudioCueMemory,resetRackBalls,
    stopCelebrate,ensureAudio,hidePanel,music,resetProgressiveSceneForRun,enterArenaAudio,leaveArenaAudio,
    faceTo,applyCamMode,autoFrameCam,glideTo,startPreGameShow,broadcastSting,paSay,
    playPregameCountdownCue,sGo,calibrateTilt,readyBall,toast,sBeep,updDotsUI,updPowerUI,
    playAudioEvent,crowdSwell,doRelease,sBuzz,startConfetti,cheerSound,airhorn,
    scoreQuoteMarkup,showPanel,startVictoryCine
  }=ctx;

  function isRackRushSpeed(thing){
    if(typeof thing==="string")return thing==="speed100";
    return !!thing&&(thing.variant==="speed100"||thing.mode==="rack-rush-speed100");
  }
  function rackRushStorageKey(variant){return isRackRushSpeed(variant)?RACK_RUSH_SPEED_RUNS_KEY:RACK_RUSH_RUNS_KEY;}
  function rackRushTarget(level){
    const cfg=RACK_RUSH_LEVELS[level];
    return cfg&&cfg.targets?cfg.targets[G.diff]:null;
  }
  function rackRushLevelLabel(level){
    const cfg=RACK_RUSH_LEVELS[level];
    return cfg?(cfg.final?"FINAL":("L"+(level+1))):"-";
  }
  function showRackRushIntro(){
    const targets=RACK_RUSH_LEVELS.slice(0,5).map((cfg,i)=>"L"+(i+1)+" "+cfg.targets[G.diff]).join(" · ");
    showPanel(`<h1 class="title" style="font-size:22px">RACK RUSH</h1>
      <div class="sub">投篮机挑战 · ${DIFFS[G.diff].n}</div>
      <div class="card"><b>${G.myStar.n}</b> #${G.myNum}<br><span style="color:#9ab;font-size:11px">${shotProfileText(G.myStar)}</span></div>
      <div class="rushModeGrid">
        <button class="rushModeCard" onclick="startRackRush('classic')">
          <small>LEVEL RUN</small><b>闯关挑战</b><span>固定弧顶连续供球。普通 2 分，花球 3 分，逐关达标进入 FINAL RUSH。</span>
        </button>
        <button class="rushModeCard speed" onclick="startRackRush('speed100')">
          <small>SPEED 100</small><b>百分竞速</b><span>普通命中 3 分，彩球 4 分。先冲到 100 分，停表排时间榜。</span>
        </button>
      </div>
      <div class="note">闯关晋级线 · ${targets}<br>百分竞速排行榜按用时越短排名越高。</div>
      <button class="btn sm" onclick="goDiff('rackrush',true)">返回设置</button>`);
  }
  function resetRackRushState(variant){
    variant=variant==="speed100"?"speed100":"classic";
    resetFinalRun();resetAudioCueMemory();
    G.practice=false;G.battleCut=null;
    G.seq=[];G.shotIdx=0;G.score=0;G.streak=0;G.timer=0;G.running=false;G.buzzed=false;
    G.shots=[];G.canShoot=false;G.blindToasted=false;G.cutQ=[];G.cutAway=null;G.missRun=0;
    G.stats={best:0,moneyM:0,moneyT:0,deepM:0,deepT:0};G.rush={level:0,total:0,levelScore:0,shotNo:0,attempts:0,makes:0,levelAttempts:0,levelMakes:0,
      bestStreak:0,elapsed:0,levels:[],levelCleared:false,finalTen:false,levelEnding:false,uiAcc:0,
      control:VISION.enabled?"vision":"touch",completed:false,variant,target:variant==="speed100"?RACK_RUSH_SPEED_TARGET:null};
    G.rushResultRecord=null;
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    resetRackBalls();confPts.visible=false;
    rivals.forEach(rival=>{rival.active=false;rival.g.visible=false;});
    if(player._celeb)stopCelebrate(player);
  }
  function startRackRush(variant){
    variant=variant==="speed100"?"speed100":"classic";
    ensureAudio(false);hidePanel();music(false);resetProgressiveSceneForRun();resetRackRushState(variant);
    CAM.mode=1;global.AIBASetIcon("camBtn","camera",CAM.names[1]);ctx.setCamSnap(true);
    enterArenaAudio(.86);
    $("hud").dataset.mode="rackrush";$("hud").style.display="block";$("battleControls").style.display="none";$("battleScore").style.display="none";
    $("midBtn").style.display="none";$("hudTimer").style.display="block";$("hudStreak").style.display="none";
    $("scoreNum").textContent="0";$("hudTarget").textContent="";
    const base=RACKS[2].p;
    P.pos.copy(base);P.face=faceTo(base,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    player.g.visible=true;passer.g.visible=true;hands.visible=false;
    G.state="rushintro";applyCamMode();
    rig.pos.set(0,8,6);rig.look.copy(HOOP);
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.44,marginY:1.34,minDist:5.6,maxDist:18});
    glideTo(camTarget.pos.clone(),camTarget.look.clone(),1.25,()=>startPreGameShow({mode:"rackrush"},()=>variant==="speed100"?startRackRushSpeed():startRackRushLevel(0)));
  }
  function startRackRushSpeed(){
    const rush=G.rush;if(!rush)return;
    rush.level=0;rush.levelScore=0;rush.shotNo=0;rush.levelAttempts=0;rush.levelMakes=0;
    rush.levelCleared=true;rush.finalTen=false;rush.levelEnding=false;rush.uiAcc=0;rush.target=RACK_RUSH_SPEED_TARGET;
    G.timer=0;G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;G.blindToasted=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    G.state="rushintro";applyCamMode();updateRackRushHUD();
    const el=$("countN");
    el.innerHTML=`<span style="font-size:30px;text-align:center;line-height:1.35">SPEED 100<br><small style="font-size:16px;color:#fff">百分竞速</small></span>`;
    el.style.display="flex";broadcastSting("score");paSay("百分竞速,先到一百分停止计时!",true);
    setTimeout(()=>{if(G.rush===rush&&G.state==="rushintro")countdownRackRush(3);},900);
  }
  function startRackRushLevel(level){
    const rush=G.rush,cfg=RACK_RUSH_LEVELS[level];if(!rush||!cfg)return;
    rush.level=level;rush.levelScore=0;rush.shotNo=0;rush.levelAttempts=0;rush.levelMakes=0;
    rush.levelCleared=!!cfg.final;rush.finalTen=false;rush.levelEnding=false;rush.uiAcc=0;
    G.timer=cfg.time;G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;G.blindToasted=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    G.state="rushintro";applyCamMode();updateRackRushHUD();
    const el=$("countN");
    el.innerHTML=`<span style="font-size:30px;text-align:center;line-height:1.35">${rackRushLevelLabel(level)}<br><small style="font-size:16px;color:#fff">${cfg.name}</small></span>`;
    el.style.display="flex";broadcastSting(cfg.final?"danger":"score");
    paSay(cfg.final?"FINAL RUSH,最后冲刺!":("第"+(level+1)+"关,"+cfg.name+"。目标"+rackRushTarget(level)+"分。"),true);
    setTimeout(()=>{if(G.rush===rush&&G.state==="rushintro")countdownRackRush(3);},900);
  }
  function countdownRackRush(n){
    const el=$("countN");
    if(!G.rush||G.state!=="rushintro")return;
    if(n===3)playPregameCountdownCue();
    if(n===0){
      el.textContent="GO!";el.style.display="flex";sGo();setTimeout(()=>el.style.display="none",450);
      calibrateTilt();G.state="rackrush";G.running=true;G.buzzed=false;applyCamMode();readyBall();
      if(isRackRushSpeed(G.rush))toast("百分竞速 · 冲到 100 分停表","#ffd23f");
      else toast(RACK_RUSH_LEVELS[G.rush.level].final?"FINAL RUSH · 尽可能多拿分":"达标后不停表 · 继续刷总分","#ffd23f");
      return;
    }
    el.textContent=n;el.style.display="flex";sBeep();setTimeout(()=>countdownRackRush(n-1),650);
  }
  function rackRushShot(){
    const rush=G.rush;if(!rush)return null;
    const number=rush.shotNo+1,money=number%5===0,finalTen=!isRackRushSpeed(rush)&&G.timer<=10;
    if(isRackRushSpeed(rush))return {rack:2,ball:(number-1)%5,val:money?4:3,baseVal:money?4:3,bonus:0,money,deep:null,p:RACKS[2].p,rush:true,number};
    return {rack:2,ball:(number-1)%5,val:(money?3:2)+(finalTen?1:0),baseVal:money?3:2,bonus:finalTen?1:0,money,deep:null,p:RACKS[2].p,rush:true,number};
  }
  function rackRushBarHidden(){
    const rush=G.rush,cfg=rush&&RACK_RUSH_LEVELS[rush.level];if(!rush||!cfg)return false;
    if(isRackRushSpeed(rush))return rush.shotNo>=3;
    if(cfg.bar==="all")return false;
    if(cfg.bar==="time10")return (cfg.time-G.timer)>=10;
    if(cfg.bar==="shots5")return rush.shotNo>=5;
    return true;
  }
  function updateRackRushHUD(){
    const rush=G.rush;if(!rush)return;
    if(isRackRushSpeed(rush)){
      $("hudRound").innerHTML="RACK RUSH · SPEED 100<br><span style='color:#778'>"+DIFFS[G.diff].n+" · 普通3分 / 彩球4分</span>";
      $("hudTimer").textContent=formatRackRushClock(rush.elapsed);$("hudTimer").className="";$("scoreNum").textContent=rush.total;
      $("hudTarget").textContent="目标 "+Math.min(rush.total,RACK_RUSH_SPEED_TARGET)+" / "+RACK_RUSH_SPEED_TARGET+" · 用时越短排名越高";
      $("hudStreak").style.display=G.streak>=3?"block":"none";if(G.streak>=3)$("hudStreak").textContent="🔥 x"+G.streak;
      updDotsUI();updPowerUI();return;
    }
    const cfg=RACK_RUSH_LEVELS[rush.level],target=rackRushTarget(rush.level);
    $("hudRound").innerHTML=(cfg.final?"FINAL RUSH":("RACK RUSH · L"+(rush.level+1)))+"<br><span style='color:#778'>"+DIFFS[G.diff].n+" · "+cfg.name+"</span>";
    $("hudTimer").textContent=Math.max(0,G.timer).toFixed(1);$("hudTimer").className=G.timer<=10?"low":"";$("scoreNum").textContent=rush.total;
    $("hudTarget").textContent=cfg.final?("本关 "+rush.levelScore+" · 无晋级线"):("本关 "+rush.levelScore+" / "+target+(rush.levelCleared?" · CLEAR":""));
    $("hudStreak").style.display=G.streak>=3?"block":"none";if(G.streak>=3)$("hudStreak").textContent="🔥 x"+G.streak;
    updDotsUI();updPowerUI();
  }
  function rackRushClearFlash(){
    playAudioEvent("rack_clear");const el=$("vsBanner");el.innerHTML="CLEAR<br><span style='font-size:11px;color:#dce8f4'>继续投 · 分数仍计入总分</span>";el.style.display="block";broadcastSting("score");crowdSwell(.35,1.8);
    setTimeout(()=>{if(G.state==="rackrush")el.style.display="none";},1250);
  }
  function updateRackRush(dt){
    const rush=G.rush;if(!rush||G.state!=="rackrush")return;
    if(isRackRushSpeed(rush)){
      if(G.running){
        if(rush.total>=88&&global.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm("百分竞速最后三球");rush.elapsed+=dt;G.timer=rush.elapsed;rush.uiAcc+=dt;
        if(rush.uiAcc>=.1){rush.uiAcc=0;updateRackRushHUD();}
      }
      return;
    }
    if(G.running){
      if(G.timer<=12&&global.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm("RACK RUSH 最后三球");rush.elapsed+=dt;G.timer=Math.max(0,G.timer-dt);rush.uiAcc+=dt;
      if(!rush.finalTen&&G.timer<=10){
        rush.finalTen=true;broadcastSting("danger");crowdSwell(.35,3);toast("FINAL 10 · 命中额外 +1","#ff5d4d");
        if(!playAudioEvent("contest_final10"))paSay("最后十秒,每球加一分!",true);
      }
      const lowBeep=ctx.getLowBeep();if(G.timer<=5&&G.timer>0&&G.tNow-lowBeep>1){ctx.setLowBeep(G.tNow);sBeep();}
      if(rush.uiAcc>=.1){rush.uiAcc=0;updateRackRushHUD();}
      if(G.timer<=0&&!G.buzzed){
        G.buzzed=true;G.running=false;sBuzz();paSay("时间到!",true);
        if(G.charging)doRelease();G.canShoot=false;G.charging=false;handBall.visible=false;pBall.visible=false;
        toast("时间到 · 等待最后一球","#ff8d7a");
      }
    }
    if(G.buzzed&&!rush.levelEnding&&!G.charging&&!ctx.getPassing()&&!balls.some(ball=>ball.rush))finishRackRushLevel();
  }
  function finishRackRushLevel(){
    const rush=G.rush;if(!rush||rush.levelEnding)return;
    if(isRackRushSpeed(rush)){finishRackRushSpeed();return;}
    rush.levelEnding=true;G.running=false;G.canShoot=false;G.state="rushbetween";$("vsBanner").style.display="none";
    const cfg=RACK_RUSH_LEVELS[rush.level],target=rackRushTarget(rush.level),passed=cfg.final||rush.levelScore>=target;
    rush.levels.push({level:rush.level+1,name:cfg.name,score:rush.levelScore,target,attempts:rush.levelAttempts,makes:rush.levelMakes,passed});
    if(cfg.final){rush.completed=true;startConfetti();cheerSound(true);setTimeout(()=>finishRackRushRun(true),1100);return;}
    if(!passed){broadcastSting("danger");setTimeout(()=>finishRackRushRun(false),900);return;}
    if(global.AIBARecorder&&AIBARecorder.discard)AIBARecorder.discard();
    const el=$("countN");el.innerHTML=`<span style="font-size:38px;text-align:center;line-height:1.35;color:#7CFC6B">CLEAR<br><small style="font-size:15px;color:#fff">${rush.levelScore} / ${target} · 总分 ${rush.total}</small></span>`;
    el.style.display="flex";cheerSound(true);setTimeout(()=>{el.style.display="none";startRackRushLevel(rush.level+1);},1450);
  }
  function finishRackRushSpeed(){
    const rush=G.rush;if(!rush||rush.levelEnding)return;
    rush.levelEnding=true;rush.completed=true;G.running=false;G.canShoot=false;G.buzzed=true;G.state="rushbetween";$("vsBanner").style.display="none";
    G.charging=false;handBall.visible=false;pBall.visible=false;const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    rush.levels=[{level:1,name:"百分竞速",score:rush.total,target:RACK_RUSH_SPEED_TARGET,attempts:rush.levelAttempts,makes:rush.levelMakes,passed:true}];
    const el=$("countN");el.innerHTML=`<span style="font-size:36px;text-align:center;line-height:1.35;color:#ffd23f">100!<br><small style="font-size:15px;color:#fff">用时 ${formatRackRushClock(rush.elapsed)}</small></span>`;
    el.style.display="flex";startConfetti();cheerSound(true);airhorn();broadcastSting("score");setTimeout(()=>{el.style.display="none";finishRackRushRun(true);},950);
  }
  function loadRackRushRuns(variant){
    try{const rows=JSON.parse(localStorage.getItem(rackRushStorageKey(variant))||"[]");return Array.isArray(rows)?rows:[];}catch(e){return[];}
  }
  function rackRushAccuracy(record){return record.attempts?record.makes/record.attempts:0;}
  function formatRackRushClock(sec){
    sec=Math.max(0,sec||0);const min=Math.floor(sec/60),rest=sec-min*60;
    return min?min+":"+String(Math.floor(rest)).padStart(2,"0")+"."+Math.floor((rest%1)*10):rest.toFixed(1);
  }
  function makeRackRushRecord(){
    const rush=G.rush,accuracy=rush.attempts?rush.makes/rush.attempts:0,speed=isRackRushSpeed(rush),profile=playerShotProfile();
    const stats=global.summarizeResultStats?global.summarizeResultStats():{};
    return Object.assign({schema:1,version:GAME_VERSION,mode:speed?"rack-rush-speed100":"rack-rush",variant:speed?"speed100":"classic",
      target:speed?RACK_RUSH_SPEED_TARGET:null,total:rush.total,highestLevel:speed?1:rush.level+1,completed:!!rush.completed,
      elapsedMs:Math.round(rush.elapsed*1000),attempts:rush.attempts,makes:rush.makes,accuracy,bestStreak:rush.bestStreak,
      levels:rush.levels.slice(),difficulty:G.diff,control:rush.control,playerId:G.myStar&&(G.myStar.id||G.myStar.n),
      playerName:G.myStar&&G.myStar.n,shotSpeed:profile.speed,sweetWindow:profile.window,shotArc:profile.arc,shotArcLabel:profile.arcLabel,
      scene:ctx.getScenePreset(),weather:ctx.getWeather(),seed:GAME_SEED,completedAt:new Date().toISOString()},stats);
  }
  function saveRackRushRecord(record){
    try{const rows=loadRackRushRuns(record.variant);rows.unshift(record);localStorage.setItem(rackRushStorageKey(record.variant),JSON.stringify(rows.slice(0,50)));}catch(e){}
    G.rushResultRecord=record;
    try{global.__aibaLastRackRushRecord=record;global.__aibaRackRushRuns=()=>loadRackRushRuns(record.variant);if(global.AIBALeaderboardUI)AIBALeaderboardUI.submitRecord(record);else if(global.AIBALeaderboard)AIBALeaderboard.submit(record).catch(()=>{});}catch(e){}
    return record;
  }
  function sortRackRushRuns(rows){
    if(rows.some(record=>isRackRushSpeed(record)))return rows.sort((a,b)=>(a.elapsedMs||999999999)-(b.elapsedMs||999999999)||b.total-a.total||rackRushAccuracy(b)-rackRushAccuracy(a)||a.attempts-b.attempts);
    return rows.sort((a,b)=>b.total-a.total||b.highestLevel-a.highestLevel||a.elapsedMs-b.elapsedMs||rackRushAccuracy(b)-rackRushAccuracy(a)||b.bestStreak-a.bestStreak);
  }
  function formatRackRushTime(ms){
    const sec=Math.max(0,Math.floor((ms||0)/1000)),min=Math.floor(sec/60);return min+":"+String(sec%60).padStart(2,"0");
  }
  function rackRushLevelRows(record){
    return record.levels.map(row=>`<tr><td>${row.level<=5?"L"+row.level:"FINAL"} · ${row.name}</td><td>${row.score}${row.target!=null?" / "+row.target:""}</td></tr>`).join("");
  }
  function showRackRushResult(record){
    G.state="rushend";
    leaveArenaAudio();
    const accuracy=Math.round(rackRushAccuracy(record)*100),speed=isRackRushSpeed(record),headline=speed?"百分竞速完成":(record.completed?"FINAL RUSH 完成":"挑战结束");
    if(global.AIBARecorder&&AIBARecorder.result)AIBARecorder.result(record,{title:headline,score:speed?formatRackRushClock(record.elapsedMs/1000):record.total+" PTS",sub:`命中 ${record.makes}/${record.attempts} · 命中率 ${accuracy}%`,postMs:9000});
    showPanel(`${global.AIBAResultHeaderMarkup(record,{headline,score:speed?formatRackRushClock(record.elapsedMs/1000):record.total+" 分",label:speed?"TIME (SECONDS)":"TOTAL POINTS",mode:speed?"100% SPRINT COMPLETE":"RACK RUSH COMPLETE"})}
      <div class="rushMeta">${speed?`<span>${record.total} / ${RACK_RUSH_SPEED_TARGET} 分</span><span>命中 ${record.makes}/${record.attempts}</span><span>命中率 ${accuracy}%</span><span>连中 x${record.bestStreak}</span><span>${DIFFS[record.difficulty].n}</span>`:`<span>最高 ${record.completed?"FINAL":"L"+record.highestLevel}</span><span>命中 ${record.makes}/${record.attempts}</span><span>命中率 ${accuracy}%</span><span>连中 x${record.bestStreak}</span><span>${formatRackRushTime(record.elapsedMs)}</span>`}</div>
      ${global.AIBAResultBadgeMarkup?AIBAResultBadgeMarkup(record):""}<details class="resultDetails"><summary>查看闯关数据 (VIEW DATA)</summary><table class="std rushLevels">${rackRushLevelRows(record)}</table></details>
      ${global.AIBACloudRankMarkup?AIBACloudRankMarkup(record):""}${scoreQuoteMarkup()}${global.AIBARecorder?AIBARecorder.resultMarkup():""}
      <button class="btn gold" onclick="startRackRush('${speed?"speed100":"classic"}')">重新挑战</button>
      <button class="btn green" onclick="showOnlineLeaderboardForRecord(G.rushResultRecord)">全球排行榜</button>
      <button class="btn sm" onclick="shareRackRushResult()">分享成绩</button>
      <button class="btn sm" onclick="showMenu()">返回封面</button>`);
  }
  function finishRackRushRun(completed){
    const rush=G.rush;if(!rush)return;rush.completed=!!completed;
    if(global.AIBARecorder)AIBARecorder.mark(isRackRushSpeed(rush)?"百分竞速冲线":"RACK RUSH 最后一球",{postMs:completed?5600:4200});
    G.running=false;G.canShoot=false;applyCamMode();
    /* 收 HUD 推迟到留白结束。通关走胜利运镜(下面 startVictoryCine),
       失败原本是 0 秒直接弹面板 —— 而没通关才是常态,那条路径反而最需要收尾。 */
    G.state=completed?"rushend":"resultbeat";
    const record=saveRackRushRecord(makeRackRushRecord());
    if(isRackRushSpeed(record)){
      const prev=sortRackRushRuns(loadRackRushRuns("speed100").filter(row=>row.completed&&row.completedAt!==record.completedAt));
      const best=prev[0],rank=sortRackRushRuns(loadRackRushRuns("speed100").filter(row=>row.completed)).findIndex(row=>row.completedAt===record.completedAt)+1;
      if(!best||record.elapsedMs<best.elapsedMs){if(!playAudioEvent("speed100_finish_record"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(record.elapsedMs-best.elapsedMs<=3000){if(!playAudioEvent("speed100_finish_close"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(rank>0&&rank<=3){if(!playAudioEvent("speed100_finish_board"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(!playAudioEvent("speed100_finish"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);
    }else if(completed){airhorn();paSay("RACK RUSH完成,总分"+record.total+"分!",true);}
    else if(!playAudioEvent("rack_fail"))paSay("本次挑战结束,总分"+record.total+"分。",true);
    if(completed){
      $("hud").style.display="none";
      startConfetti();cheerSound(true);G.cheer=1;
      startVictoryCine({hero:player,foil:passer,nextState:"rushend",tag:isRackRushSpeed(record)?"🏁 百分竞速完成":"🏆 RACK RUSH 完成",dur:4.4,onDone:()=>showRackRushResult(record)});
      return;
    }
    /* 失败也要给一拍:蜂鸣器、观众的叹息、球员的懊恼走完再进结算。 */
    const toPanel=()=>{G.state="rushend";$("hud").style.display="none";showRackRushResult(record);};
    if(global.AIBAResultBeat)global.AIBAResultBeat.play({
      eyebrow:isRackRushSpeed(record)?"百分竞速结束":"本次挑战结束",
      score:isRackRushSpeed(record)?formatRackRushClock(record.elapsedMs/1000):record.total,
      unit:isRackRushSpeed(record)?"":"分",
      note:"再来一次",tone:"bad",seconds:3.0,onDone:toPanel});
    else toPanel();
  }
  function showRackRushLeaderboard(){
    const record=G.rushResultRecord,variant=record?record.variant:(G.rush&&G.rush.variant)||"classic",speed=isRackRushSpeed(variant),control=record?record.control:(VISION.enabled?"vision":"touch");
    const rows=sortRackRushRuns(loadRackRushRuns(variant).filter(row=>row.difficulty===G.diff&&row.control===control)).slice(0,10);
    const body=rows.length?rows.map((row,i)=>speed?
      `<tr class="${record&&row.completedAt===record.completedAt?"me":""}"><td>${i+1}</td><td>${formatRackRushClock(row.elapsedMs/1000)}</td><td>${row.total}</td><td>${Math.round(rackRushAccuracy(row)*100)}%</td><td>${row.makes}/${row.attempts}</td></tr>`:
      `<tr class="${record&&row.completedAt===record.completedAt?"me":""}"><td>${i+1}</td><td>${row.total}</td><td>${row.completed?"FINAL":"L"+row.highestLevel}</td><td>${Math.round(rackRushAccuracy(row)*100)}%</td><td>${formatRackRushTime(row.elapsedMs)}</td></tr>`).join(""):'<tr><td colspan="5">暂无记录</td></tr>';
    showPanel(`<h1 class="title" style="font-size:22px">${speed?"百分竞速排行榜":"RACK RUSH 排行榜"}</h1><div class="note">${DIFFS[G.diff].n} · ${control==="vision"?"体感控制":"触屏控制"} · 本机记录</div>
      <table class="std"><tr>${speed?"<td>#</td><td>用时</td><td>分数</td><td>命中</td><td>出手</td>":"<td>#</td><td>总分</td><td>关卡</td><td>命中</td><td>耗时</td>"}</tr>${body}</table>
      <button class="btn sm" onclick="showRackRushResult(G.rushResultRecord)">返回成绩</button>`);
  }
  async function shareRackRushResult(){
    const record=G.rushResultRecord;if(!record)return;
    const speed=isRackRushSpeed(record);
    const text=speed?`aiBA RACK RUSH · 百分竞速\n${formatRackRushClock(record.elapsedMs/1000)} 达成100分 · 命中率 ${Math.round(rackRushAccuracy(record)*100)}%\n${global.AIBARecordRankText?AIBARecordRankText(record):"全球排名同步中"}`:
      `aiBA RACK RUSH · ${DIFFS[record.difficulty].n}\n${record.total}分 · ${record.completed?"完成 FINAL RUSH":"最高 L"+record.highestLevel} · 命中率 ${Math.round(rackRushAccuracy(record)*100)}%\n${global.AIBARecordRankText?AIBARecordRankText(record):"全球排名同步中"}`;
    let url=location.href;
    try{const nextUrl=new URL(location.href);nextUrl.searchParams.set("mode","rackrush");nextUrl.searchParams.set("diff",record.difficulty);nextUrl.searchParams.set("seed",record.seed);nextUrl.searchParams.set("scene",record.scene);nextUrl.searchParams.set("star",record.playerId);if(speed)nextUrl.searchParams.set("submode","speed100");else nextUrl.searchParams.delete("submode");url=nextUrl.toString();}catch(e){}
    try{if(navigator.share){await navigator.share({title:speed?"aiBA SPEED 100":"aiBA RACK RUSH",text,url});return;}}catch(e){if(e&&e.name==="AbortError")return;}
    try{await navigator.clipboard.writeText(text+"\n"+url);toast("成绩与挑战链接已复制","#7CFC6B");}catch(e){toast(text,"#ffd23f");}
  }

  const api={
    isRackRushSpeed,rackRushStorageKey,rackRushTarget,rackRushLevelLabel,showRackRushIntro,
    resetRackRushState,startRackRush,startRackRushSpeed,startRackRushLevel,countdownRackRush,
    rackRushShot,rackRushBarHidden,updateRackRushHUD,rackRushClearFlash,updateRackRush,
    finishRackRushLevel,finishRackRushSpeed,loadRackRushRuns,rackRushAccuracy,formatRackRushClock,
    makeRackRushRecord,saveRackRushRecord,sortRackRushRuns,formatRackRushTime,rackRushLevelRows,
    showRackRushResult,finishRackRushRun,showRackRushLeaderboard,shareRackRushResult
  };
  Object.assign(global,api);
  runtime.register("mode:rackrush",Object.freeze({
    id:"rackrush",
    enter:startRackRush,
    start:startRackRush,
    update:updateRackRush,
    finish:finishRackRushRun,
    exit:()=>resetRackRushState(G.rush&&G.rush.variant),
    api:Object.freeze(api)
  }));
})(window);
