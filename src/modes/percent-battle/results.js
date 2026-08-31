(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy"),battle=global.AIBABattle;
  if(!ctx||!battle)throw new Error("Percent Battle results require battle state");
  const {
    $,G,BATTLE_TARGET,DIFFS,scene,balls,handBall,pBall,leaveArenaAudio,applyCamMode,endHero,airhorn,djSay,
    cheerSound,paSay,boo,scoreQuoteMarkup,showPanel,startWinCine
  }=ctx;
  const OPP=battle.OPP;

  function finishBattle(win,ball){
    const winCine=ctx.getWinCine();
    if(G.battleOver||(winCine&&winCine.on))return;
    startWinCine(win,ball);
  }
  function renderBattleResult(win){
    leaveArenaAudio();
    if(typeof transitionState==="function")transitionState("battleend","percent-battle-result-panel");else G.state="battleend";
    OPP.on=false;if(typeof battle.cancelOppPass==="function")battle.cancelOppPass(true);
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    $("spotDots").style.display="none";$("edgeArrows").style.display="none";
    $("battleScore").style.display="none";$("midBtn").style.display="none";
    const spotRing=ctx.getCurSpotRing();if(spotRing)spotRing.visible=false;
    handBall.visible=false;pBall.visible=false;$("battleControls").style.display="none";$("hud").style.display="none";
    endHero();applyCamMode();
    if(win){airhorn();djSay("百分大战,率先破百!",true);cheerSound(true);G.cheer=1;}
    else{paSay(G.battleOpp.n+"率先到达一百分!",true);boo(1.2);}
    const title=win?"百分大战胜利!":"百分大战惜败";
    const record=G.battleResultRecord||battle.makeBattleRecord(win,battle.battleElapsedMs());
    /* 比分只认 record 里冻结的那一份。原来这里重新读实时的 G.score / G.battleOppScore,
       而对手在胜利短片期间还在继续投 —— 同一个结算页上,大标题写 100:97、
       下面的"最终比分"却是 100:92。实测复现过。 */
    const finalScore=`${record.score} : ${record.opponentScore}`;
    if(global.AIBARecorder&&global.AIBARecorder.result){
      global.AIBARecorder.result(record,{title,score:finalScore,
        sub:`百分耗时 ${battle.formatBattleTime(record.elapsedMs)} · ${DIFFS[G.diff].n}`,postMs:9000});
    }
    const header=global.AIBAResultHeaderMarkup(record,{headline:title,score:finalScore,label:"FINAL SCORE",mode:"PERCENT BATTLE"});
    showPanel(`${header}
      ${global.AIBAResultBadgeMarkup?global.AIBAResultBadgeMarkup(record):""}<details class="resultDetails"><summary>查看比赛数据 (VIEW DATA)</summary><div class="card">对手:<b>${G.battleOpp.n}</b><br>
        百分耗时 <b style="color:#ffd23f">${battle.formatBattleTime(record.elapsedMs)}</b> · ${record.control==="vision"?"体感控制":"触屏控制"}<br>
        最高连中 <b class="flame">x${G.stats.best}</b> · 中场10分 <b>${G.stats.deepM}/${G.stats.deepT}</b><br>
        难度:<b>${DIFFS[G.diff].n}</b></div></details>
      ${global.AIBACloudRankMarkup?global.AIBACloudRankMarkup(record):""}${scoreQuoteMarkup()}${global.AIBARecorder?global.AIBARecorder.resultMarkup():""}
      <button class="btn gold" onclick="startBattle()">再战一局</button>
      <button class="btn green" onclick="showOnlineLeaderboardForRecord(G.battleResultRecord)">全球排行榜</button><button class="btn green" onclick="location.reload()">回主菜单</button>`);
  }

  function clearBattleForResultBeat(){
    leaveArenaAudio();
    if(typeof transitionState==="function")transitionState("resultbeat","percent-battle-result-beat");else G.state="resultbeat";
    OPP.on=false;
    if(typeof battle.cancelOppPass==="function")battle.cancelOppPass(true);
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    $("spotDots").style.display="none";$("edgeArrows").style.display="none";
    $("battleScore").style.display="none";$("midBtn").style.display="none";
    const spotRing=ctx.getCurSpotRing();if(spotRing)spotRing.visible=false;
    handBall.visible=false;pBall.visible=false;$("battleControls").style.display="none";$("hud").style.display="none";
    endHero();applyCamMode();
  }
  function showBattleResult(win){
    if(G.state==="resultbeat"&&global.AIBAResultBeat&&global.AIBAResultBeat.active())return;
    const record=G.battleResultRecord||battle.makeBattleRecord(win,battle.battleElapsedMs());
    if(!global.AIBAResultBeat){renderBattleResult(win);return;}
    clearBattleForResultBeat();
    global.AIBAResultBeat.play({
      eyebrow:"PERCENT BATTLE",
      score:record.score+" : "+record.opponentScore,
      tone:win?"good":"bad",
      seconds:2.6,
      note:win?"率先破百 · 全场反应":"对手率先破百 · 重新组织节奏",
      onDone:()=>renderBattleResult(win)
    });
  }
  Object.assign(battle,{finishBattle,showBattleResult});
})(window);
