(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime;
  const ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Contest requires AIBA runtime legacy adapter");

  const {
    $,G,DIFFS,TALK_PRE,RACKS,DEEPS,HOOP,GAME_NAME,GAME_SEED,scene,balls,rivals,
    deepBalls,player,P,rig,TILT,V3,seededRandom,buildSeq,benchSetup,startAIShow,stars,
    aiProb,applyStarStyle,resetAudioCueMemory,resetProgressiveSceneForRun,resetRackBalls,
    ensureAudio,music,enterArenaAudio,leaveArenaAudio,broadcastSting,crowdSwell,paSay,
    hidePanel,showPanel,showMenu,faceTo,applyCamMode,shotEye,glideTo,startPreGameShow,
    playPregameCountdownCue,sGo,calibrateTilt,readyBall,toast,sBeep,updTargetUI,
    playAudioEvent,sBuzz,cheerSound,scoreQuoteMarkup,airhorn,djSay,endHero,organCharge,
    startConfetti,startVictoryCine
  }=ctx;

  function beginStage(){
    ensureAudio(false);music(false);
    const names=G.stage==="final"?["YOU",G.finalist]:["YOU",...G.opponents];
    for(let i=names.length-1;i>0;i--){const j=(seededRandom()*(i+1))|0;[names[i],names[j]]=[names[j],names[i]];}
    G.lineup=names;G.lineIdx=0;G.posted=[];G.stageCeremonyDone=false;
    if(G.stage==="semi")G.semiDone=false;else G.finalDone=false;
    benchSetup();
    let html=`<h1 class="title" style="font-size:20px">出手顺序抽签</h1><div class="note">${G.stage==="final"?"决赛":"半决赛"}出场顺序:</div>`;
    names.forEach((who,i)=>{
      const me=who==="YOU";
      html+=`<div class="card" style="${me?"border-color:#3a6":""}"><b style="${me?"color:#9dff8d":""}">${i+1}. ${me?"你 (YOU)":who.n}</b></div>`;
    });
    html+=`<button class="btn gold" onclick="hidePanel();startStageCeremony()">开始 →</button>`;
    showPanel(html);
  }
  function startStageCeremony(){
    if(G.stageCeremonyDone){nextTurn();return;}
    ensureAudio(false);music(false);benchSetup();
    resetAudioCueMemory();resetProgressiveSceneForRun();enterArenaAudio(G.stage==="final"?1.03:.9);
    broadcastSting(G.stage==="final"?"danger":"score");crowdSwell(G.stage==="final"?.16:.1,2);
    if(G.stage==="final")playAudioEvent("contest_finals_start");
    else playAudioEvent("contest_host_intro");
    G.seq=[{rack:2,ball:0,val:1,money:false,deep:null}];G.shotIdx=0;
    const base=RACKS[2].p;P.pos.copy(base);P.face=faceTo(base,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    G.state="cinematic";rig.pos.set(0,11,7);rig.look.copy(HOOP);
    startPreGameShow({mode:"contest"},()=>{
      G.stageCeremonyDone=true;benchSetup();G.state="intro";nextTurn();
    });
  }
  function nextTurn(){
    if(G.lineIdx>=G.lineup.length){stageDone();return;}
    const who=G.lineup[G.lineIdx++];
    if(who==="YOU")preMyTurn();else startAIShow(who,nextTurn);
  }
  function preMyTurn(){
    benchSetup();
    const target=G.posted.length?G.posted.reduce((a,b)=>a.score>b.score?a:b):null;
    let html=`<h1 class="title" style="font-size:20px">🎯 轮到你出手</h1>`;
    if(target){
      html+=`<div class="card">当前最高:<b style="color:#ffd23f">${target.o.n} ${target.score} 分</b><br>
        <span style="color:#ff9d8d;font-size:11px">${target.o.n}:「${TALK_PRE[(Math.random()*TALK_PRE.length)|0]}」</span></div>
        <div class="note">${G.stage==="final"?"超过他就是冠军":"追上他 · 反超有惊喜"}</div>`;
    }else{
      html+=`<div class="note">你率先出手 · 给他们立个标杆<br>${G.stage==="final"?"投出一个让"+G.finalist.n+"绝望的分数":""}</div>`;
    }
    html+=`<button class="btn gold" data-aiba-icon="play" data-aiba-label="上场" onclick="hidePanel();startRound()">上场</button>`;
    showPanel(html);
  }
  function stageDone(){
    if(G.stage==="semi")showBracket();else finalResult(G.finalist.posted);
  }
  function startRound(){
    benchSetup();
    G.contestRoundAdvanced=false;
    $("hud").dataset.mode="contest";
    G.moneyRack=(seededRandom()*5)|0;
    resetAudioCueMemory();resetProgressiveSceneForRun();enterArenaAudio(G.stage==="final"?1.03:.9);
    broadcastSting(G.stage==="final"?"danger":"score");crowdSwell(G.stage==="final"?.16:.1,2);
    G.finalTenTriggered=false;
    if(typeof global.playSFX==="function")global.playSFX("ui_start_game_01");
    G.seq=buildSeq(G.moneyRack);G.shotIdx=0;
    G.score=0;G.streak=0;G.timer=70;G.buzzed=false;G.running=false;
    G.shots=[];G.canShoot=false;G.blindToasted=false;G.cutQ=[];G.cutAway=null;G.missRun=0;G.organed=false;
    G.posted.forEach(post=>post.cut=false);
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    resetRackBalls();
    $("hudTimer").style.display="block";$("scoreNum").textContent="0";$("hudStreak").style.display="none";
    $("hudRound").innerHTML=(G.stage==="final"?"🏆 决 赛":"半决赛")+"<br><span style='color:#778'>"+DIFFS[G.diff].n+"</span>";
    updTargetUI();$("hud").style.display="block";
    const first=G.seq[0],base=first.deep!=null?DEEPS[first.deep].p:RACKS[first.rack].p;
    P.pos.copy(base);P.face=faceTo(base,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    G.state="cinematic";
    const eye=shotEye(first);rig.pos.set(0,11,7);rig.look.copy(HOOP);
    glideTo(eye,HOOP.clone().add(V3(0,.15,0)),1.15,()=>countdown(3));
  }
  function countdown(n){
    if(G.state!=="cinematic")return;
    const el=$("countN");if(n===3&&!G.stageCeremonyDone)playPregameCountdownCue();
    if(n===0){
      el.textContent="GO!";el.style.display="flex";sGo();setTimeout(()=>el.style.display="none",500);
      calibrateTilt();G.state="round";G.running=!G.practice;applyCamMode();readyBall();
      if(!G.practice)setTimeout(organCharge,2400);
      if(G.practice)toast("热身 · 按住蓄力,顶点出手!","#ffd23f");
      else toast("💰 全花球架: "+RACKS[G.moneyRack].n+(TILT.on?" · 保持手机水平":""));
      return;
    }
    el.textContent=n;el.style.display="flex";sBeep();setTimeout(()=>countdown(n-1),750);
  }
  function endRound(){
    G.running=false;
    if(global.AIBARecorder)AIBARecorder.mark(G.stage==="final"?"决赛最后一球":"半决赛最后一球",{postMs:4200});
    leaveArenaAudio();endHero();G.cutQ=[];
    if(G.cutAway){G.cutAway=null;$("vsBanner").style.display="none";}
    applyCamMode();sBuzz();G.cheer=.7;cheerSound(true);
    if(G.stage==="semi")G.semiScore=G.score;else G.finalScore=G.score;
    /* 留白:先别收 HUD、先别弹面板。原来这三件事和蜂鸣器在同一帧发生,
       玩家连最终比分都来不及看,更别说看球员和观众的反应。
       resultbeat 这个状态让镜头继续留在场上(见 game-loop 的相机分支)。 */
    if(typeof transitionState==="function")transitionState("resultbeat","contest-round-result-beat");else G.state="resultbeat";
    const strong=G.score>=20;
    const toPanel=()=>{if(typeof transitionState==="function")transitionState("roundend","contest-round-result-panel");else G.state="roundend";$("hud").style.display="none";showRoundPanel();};
    if(global.AIBAResultBeat)global.AIBAResultBeat.play({
      eyebrow:(G.stage==="final"?"决赛":"半决赛")+"结束",
      score:G.score,unit:"分",
      note:strong?"全场为你鼓掌":"下一轮再来",
      tone:strong?"good":"flat",seconds:3.4,onDone:toPanel});
    else toPanel();
  }
  function showRoundPanel(){
    const made=G.shots.filter(shot=>shot.made).length,highlights=pickHighlights();
    showPanel(`<h1 class="title" style="font-size:22px">⏱ ${G.stage==="final"?"决赛":"半决赛"}结束</h1>
      <div style="font-size:54px;color:#7CFC6B;text-shadow:4px 4px 0 #000;font-weight:bold;margin:8px 0">${G.score} 分</div>
      <div class="card">命中 <b>${made}/${G.shots.length}</b> · 花球 <b>${G.stats.moneyM}</b> · 深远 <b>${G.stats.deepM}</b> · 最高连中 <b class="flame">x${G.stats.best}</b></div>
      ${scoreQuoteMarkup()}${global.AIBARecorder?AIBARecorder.resultMarkup():""}
      ${highlights.length?`<button class="btn gold" onclick="startReplay()">🎬 精彩回放 (${highlights.length})</button>`:""}
      <button class="btn green" onclick="afterRound()">继续 →</button>`);
  }
  function pickHighlights(){
    const made=G.shots.filter(shot=>shot.made&&shot.rec.length>6);
    made.forEach(shot=>{shot.hScore=(shot.deep?5:0)+(shot.timeLeft<3?4:0)+(shot.money?3:1)+(shot.hot?1:0);});
    made.sort((a,b)=>b.hScore-a.hScore);G.highlights=made.slice(0,3);return G.highlights;
  }
  function simAI(opponent){
    const probability=aiProb(opponent.r),money=[0,2,4][(Math.random()*3)|0],events=[];let total=0;
    for(let rack=0;rack<5;rack++){
      let points=0;
      for(let ball=0;ball<5;ball++){
        const value=rack===money||ball===4?2:1;if(Math.random()<probability)points+=value;
      }
      total+=points;events.push({l:"第"+(rack+1)+"架",p:points,max:rack===money?10:6});
      if(rack===1||rack===2){const deep=Math.random()<probability*.82?3:0;total+=deep;events.push({l:"深远球",p:deep,max:3});}
    }
    return {ev:events,total};
  }
  function afterRound(){
    if(G.contestRoundAdvanced)return;
    G.contestRoundAdvanced=true;hidePanel();if(G.stage==="semi")G.semiDone=true;else G.finalDone=true;nextTurn();
  }
  function returnContestHome(){
    G.running=false;G.canShoot=false;G.charging=false;
    if(global.AIBANavigation&&typeof global.AIBANavigation.returnHome==="function")global.AIBANavigation.returnHome();
    else{hidePanel();showMenu();}
  }
  function showBracket(){
    const rows=[{n:"你 (YOU)",s:G.semiScore,me:true},...G.opponents.map(opponent=>({n:opponent.n,s:opponent.posted||0,o:opponent}))];
    rows.sort((a,b)=>b.s-a.s||(a.me?-1:1));
    const myRank=rows.findIndex(row=>row.me),advanced=myRank<2;
    let html='<h1 class="title" style="font-size:20px">半决赛榜单</h1><table class="std">';
    rows.forEach((row,i)=>{html+=`<tr class="${row.me?"me ":""}${i<2?"adv":""}"><td style="width:34px">${i+1}</td><td style="text-align:left">${row.n}${i<2?" · 晋级":""}</td><td style="width:70px">${row.s}分</td></tr>`;});
    html+="</table>"+scoreQuoteMarkup();
    if(advanced){
      G.finalist=rows.find((row,i)=>i<2&&!row.me).o;
      if(!playAudioEvent("contest_advance"))paSay("晋级决赛!",true);
      html+=`<div class="note">🎉 你晋级决赛!对手:<b style="color:#ffd23f">${G.finalist.n}</b></div><button class="btn gold" onclick="goFinal()">进入决赛 🏆</button>`;
    }else{
      playAudioEvent("contest_eliminated");
      html+=`<div class="note">差 ${rows[1].s-G.semiScore+1} 分晋级...观众仍为你欢呼</div>${global.AIBARecorder?AIBARecorder.resultMarkup():""}<button class="btn red" onclick="returnContestHome()">返回首页</button><button class="btn sm" onclick="shareScore(false)">生成战报海报</button>`;
      G.state="eliminated";
    }
    showPanel(html);
  }
  function goFinal(){
    G.stage="final";
    showPanel(`<h1 class="title" style="font-size:22px">🏆 决 赛</h1>
      <div class="card"><b>你</b> #${G.myNum}  VS  <b style="color:#ffd23f">${G.finalist.n}</b> #${G.finalist.num}<br>
      <span style="font-size:11px;color:#9ab">${G.finalist.t} · ${stars(G.finalist.r)}</span><br>
      <span style="color:#ff9d8d;font-size:11px">「${TALK_PRE[(Math.random()*TALK_PRE.length)|0]}」</span></div>
      <div class="note">出手顺序重新抽签 · 决赛分数定冠军</div>
      <button class="btn gold" onclick="hidePanel();beginFinal()">抽签 →</button>`);
  }
  function beginFinal(){
    applyStarStyle(rivals[0],G.finalist);G.opponents=[G.finalist];beginStage();
  }
  function finalResult(aiScore){
    G.aiFinal=aiScore;if(G.finalScore>aiScore)champion();else if(G.finalScore<aiScore)runnerUp();else startTiebreak();
  }
  function startTiebreak(){
    paSay("平分!突然死亡加赛!",true);G.tiebreakN++;
    showPanel(`<h1 class="title" style="font-size:22px">⚖ ${G.finalScore} : ${G.aiFinal} 平分!</h1>
      <div class="note">突然死亡决胜球 · 各投 1 记深远三分<br>你先出手 · 命中且对手打铁即夺冠</div>
      <button class="btn gold" onclick="doTiebreak()">出手决胜球!</button>`);
  }
  function doTiebreak(){
    hidePanel();G.seq=[{deep:Math.random()<.5?0:1,val:3,money:false,rack:null}];
    G.shotIdx=0;G.shots=[];G.buzzed=false;G.running=false;deepBalls.forEach(mesh=>mesh.visible=true);
    $("hud").style.display="block";$("hudTimer").style.display="block";$("hudTimer").textContent="决胜";G.state="tiebreak";
    const point=DEEPS[G.seq[0].deep].p;P.pos.copy(point);P.face=faceTo(point,HOOP);P.walking=false;applyCamMode();
    const eye=shotEye(G.seq[0]);glideTo(eye,HOOP.clone().add(V3(0,.15,0)),1,()=>{readyBall();toast("一球定冠军!","#ffd23f");});
  }
  function tiebreakResolve(){
    endHero();applyCamMode();
    const meMade=G.shots[0]&&G.shots[0].made,aiMade=Math.random()<aiProb(G.finalist.r)*.85;
    $("hud").style.display="none";
    const text=`你 ${meMade?"命中 ✅":"打铁 ❌"} · ${G.finalist.n} ${aiMade?"命中 ✅":"打铁 ❌"}`;
    if(global.AIBARecorder&&(meMade!==aiMade||G.tiebreakN>=3))AIBARecorder.mark("突然死亡决胜",{postMs:5600});
    if(meMade&&!aiMade){toast(text);champion(true);}
    else if(!meMade&&aiMade){toast(text);runnerUp(true);}
    else if(G.tiebreakN>=3){champion(true,"鏖战三轮 险胜!");}
    else showPanel(`<h1 class="title" style="font-size:20px">${text}</h1><div class="note">仍未分胜负 · 再来一球!</div><button class="btn gold" onclick="startTiebreak()">继续决胜</button>`);
  }
  function champion(tiebreak,extra){
    airhorn();setTimeout(airhorn,700);if(!playAudioEvent("contest_champion"))djSay("新科三分王,诞生了!",true);
    startConfetti();G.cheer=1;cheerSound(true);setTimeout(()=>cheerSound(true),1500);
    startVictoryCine({
      hero:player,foil:rivals[0]||null,nextState:"champion",tag:"🏆 冠军时刻",dur:4.6,
      onDone:()=>{leaveArenaAudio();music(true,true);showPanel(`<div style="font-size:64px;animation:blink 1.2s steps(2) infinite">🏆</div>
        <h1 class="title">aiBA 冠军诞生!</h1><h2 class="sub">CYBER COURT CHAMPION</h2>${extra?`<div class="note">${extra}</div>`:""}
        <div class="card">决赛 <b>${G.finalScore}</b> : ${G.aiFinal} 击败 <b>${G.finalist.n}</b>${tiebreak?" (决胜球)":""}<br>
          最高连中 <b class="flame">x${G.stats.best}</b> · 花球 <b>${G.stats.moneyM}/${G.stats.moneyT}</b> · 深远 <b>${G.stats.deepM}/${G.stats.deepT}</b><br>难度:<b>${DIFFS[G.diff].n}</b></div>
        ${scoreQuoteMarkup()}${global.AIBARecorder?AIBARecorder.resultMarkup():""}
        <button class="btn gold" onclick="shareScore(true)">📤 生成战报海报</button><button class="btn green" onclick="returnContestHome()">返回首页</button>`);}
    });
  }
  function runnerUp(tiebreak){
    if(!playAudioEvent("contest_runnerup"))paSay("屈居亚军,虽败犹荣,观众把掌声送给你!",true);G.state="runnerup";
    showPanel(`<div style="font-size:54px">🥈</div><h1 class="title" style="font-size:24px">亚军 · 虽败犹荣</h1>
      <div class="card">决赛 <b>${G.finalScore}</b> : ${G.aiFinal} 不敌 <b>${G.finalist.n}</b>${tiebreak?" (决胜球)":""}<br>
        最高连中 <b class="flame">x${G.stats.best}</b> · 全场为你起立鼓掌</div>
      ${scoreQuoteMarkup()}${global.AIBARecorder?AIBARecorder.resultMarkup():""}
      <button class="btn red" onclick="returnContestHome()">返回首页</button><button class="btn sm" onclick="shareScore(false)">生成战报海报</button>`);
  }
  function shareScore(championResult){
    if(!global.AIBAShare){toast("分享模块未就绪","#ff8d7a");return;}
    AIBAShare.genPoster(championResult,{G,DIFFS,GAME_NAME,GAME_SEED,toast});
  }

  const api={
    beginStage,startStageCeremony,nextTurn,preMyTurn,stageDone,startRound,countdown,endRound,pickHighlights,
    simAI,afterRound,showBracket,goFinal,beginFinal,finalResult,startTiebreak,doTiebreak,
    tiebreakResolve,champion,runnerUp,returnContestHome,shareScore
  };
  Object.assign(global,api);
  runtime.register("mode:contest",Object.freeze({
    id:"contest",
    enter:beginStage,
    start:startRound,
    update:()=>{},
    finish:endRound,
    exit:()=>{G.running=false;G.canShoot=false;G.charging=false;},
    api:Object.freeze(api)
  }));
})(window);
