(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy"),battle=global.AIBABattle;
  if(!ctx||!battle)throw new Error("Percent Battle spots require battle state");
  const {
    $,G,BATTLE_TARGET,BATTLE_SPOTS,BATTLE_NORMAL_STOCK,BATTLE_NORMAL_RELOAD,BATTLE_DEEP_RELOAD,
    handBall,pBall,CAM,broadcastSting,gameDjSay,toast,updDotsUI,readyBall,walkTo,curShot,applyCamMode
  }=ctx;

  function battleRefreshSpot(index){
    if(G.mode!=="battle"||!G.battleStock||!G.battleReadyAt)return;
    if(index>=0&&index<5&&G.battleStock[index]<=0&&G.tNow>=G.battleReadyAt[index]){
      G.battleStock[index]=BATTLE_NORMAL_STOCK;G.battleReadyAt[index]=0;
    }
  }
  function battleRefreshAll(){for(let i=0;i<BATTLE_SPOTS.length;i++)battleRefreshSpot(i);}
  function battleSpotStatus(index){
    battleRefreshSpot(index);const spot=BATTLE_SPOTS[index];
    if(spot.super)return {ok:(G.superStock||0)>0,label:(G.superStock||0)>0?"开放 · 命中后关闭":"待10分节点",short:(G.superStock||0)>0?"∞":"--"};
    if(index<5){
      const left=G.battleStock?G.battleStock[index]:BATTLE_NORMAL_STOCK;
      const wait=Math.max(0,((G.battleReadyAt&&G.battleReadyAt[index])||0)-G.tNow);
      return {ok:left>0,label:left>0?left+"/"+BATTLE_NORMAL_STOCK:Math.ceil(wait)+"秒恢复",short:left>0?String(left):Math.ceil(wait)+"s"};
    }
    const wait=Math.max(0,((G.battleReadyAt&&G.battleReadyAt[index])||0)-G.tNow);
    return {ok:wait<=0,label:wait<=0?"可投1次":Math.ceil(wait)+"秒恢复",short:wait<=0?"1":Math.ceil(wait)+"s"};
  }
  function battleSpotAvailable(index){return battleSpotStatus(index).ok;}
  function battleUseSpot(index){
    if(G.mode!=="battle"||!G.battleStock||!G.battleReadyAt)return;
    const spot=BATTLE_SPOTS[index];
    if(spot.super)return; // Logo 机会在命中时消耗,出手或打铁不关闭
    if(index<5){
      G.battleStock[index]=Math.max(0,G.battleStock[index]-1);
      if(G.battleStock[index]<=0)G.battleReadyAt[index]=G.tNow+BATTLE_NORMAL_RELOAD;
      return;
    }
    G.battleReadyAt[index]=G.tNow+BATTLE_DEEP_RELOAD;
  }
  function battleConsumeSuperChance(ball){
    if(G.mode!=="battle"||!ball||!ball.super)return false;
    const chanceId=Number(ball.superChanceId)||Number(G.superChanceId)||0;
    if(!chanceId||chanceId!==G.superChanceId||(G.superStock||0)<=0||G.superResolvedId===chanceId)return false;
    G.superStock=0;G.superResolvedId=chanceId;
    battle.updBattleUI();updDotsUI();
    return true;
  }
  function battleAddSuperChance(who){
    if(G.mode!=="battle"||G.battleOver)return;
    if((G.superStock||0)<1){
      G.superChanceId=(G.superChanceId||0)+1;G.superStock=1;
      broadcastSting("danger");gameDjSay("中场十分机会出现!","normal",2.2,true);
      toast((who==="opp"?"对手":"你")+"触发中场10分机会!","#ffd23f");battle.updBattleUI();updDotsUI();
    }
  }
  function battleCheckSuperMilestones(){
    if(G.mode!=="battle")return;
    const me=Math.floor(Math.min(G.score,BATTLE_TARGET)/10),opponent=Math.floor(Math.min(G.battleOppScore||0,BATTLE_TARGET)/10);
    if(me>G.superSeenMe){G.superSeenMe=me;battleAddSuperChance("me");}
    if(opponent>G.superSeenOpp){G.superSeenOpp=opponent;battleAddSuperChance("opp");}
  }
  function battleNearestAvailable(fromIndex){
    battleRefreshAll();const from=BATTLE_SPOTS[fromIndex||0].p;let best=-1,bestDistance=Infinity;
    BATTLE_SPOTS.forEach((spot,index)=>{
      if(!battleSpotAvailable(index))return;
      const distance=from.distanceTo(spot.p)+(spot.super?-.2:0);
      if(distance<bestDistance){bestDistance=distance;best=index;}
    });
    return best;
  }
  function battleAutoMoveIfNeeded(){
    if(G.mode!=="battle"||G.state!=="battle"||G.battleOver)return false;
    if(battleSpotAvailable(G.battleSpot))return false;
    const next=battleNearestAvailable(G.battleSpot);
    if(next<0){toast("所有点位恢复中,稍等一下","#9fd1ff");setTimeout(()=>{if(G.state==="battle"&&!G.battleOver)readyBall();},420);return true;}
    G.battleSpot=next;G.canShoot=false;handBall.visible=false;pBall.visible=false;
    battle.updBattleUI();updDotsUI();walkTo(curShot(),readyBall,{overlapPass:true});return true;
  }
  function updBattleUI(){
    const on=G.mode==="battle"&&(G.state==="battle"||G.state==="cinematic");
    $("battleControls").style.display=on?"flex":"none";$("battleScore").style.display=on?"flex":"none";$("midBtn").style.display=on?"block":"none";
    if(!on)return;
    battleRefreshAll();
    const spot=BATTLE_SPOTS[G.battleSpot||0],opponent=G.battleOpp,status=battleSpotStatus(G.battleSpot||0);
    const me=Math.min(G.score,BATTLE_TARGET),opponentScore=Math.min(G.battleOppScore||0,BATTLE_TARGET);
    $("bsTimer").textContent=battle.formatBattleTime(battle.battleElapsedMs());
    $("battleSpotName").innerHTML=(spot.super?"🔥 ":"")+"<span>"+spot.n+" · "+spot.val+"分</span><br><span id=\"battleOppScore\">"+status.label+"</span>";
    $("bsMeName").textContent="你";$("bsOppName").textContent=opponent?opponent.n:"对手";
    $("bsMeNum").textContent=me;$("bsOppNum").textContent=opponentScore;
    $("bsRaceMe").style.width=(me/BATTLE_TARGET*100)+"%";$("bsRaceOpp").style.width=(opponentScore/BATTLE_TARGET*100)+"%";
    $("bsMe").classList.toggle("lead",me>=opponentScore);$("bsOpp").classList.toggle("lead",opponentScore>me);$("hudTarget").textContent="";
    $("midBtn").classList.toggle("cur",G.battleSpot===7);$("midBtn").textContent=(G.superStock||0)>0?"🔥 中场开放":"🔥 中场待触发";$("midBtn").style.opacity=(G.superStock||0)>0?"1":".55";
  }
  function battleSetSpot(index){
    if(G.mode!=="battle"||G.state!=="battle"||G.battleOver)return;
    if(G.charging||G.moving||ctx.getPassing())return;
    if(!G.canShoot){toast("等球到手再换点","#9fd1ff");return;}
    const count=BATTLE_SPOTS.length,next=(index+count)%count;if(next===G.battleSpot)return;
    if(!battleSpotAvailable(next)){toast(battleSpotStatus(next).label,"#9fd1ff");updBattleUI();updDotsUI();return;}
    G.battleSpot=next;G.canShoot=false;handBall.visible=false;pBall.visible=false;
    const spot=BATTLE_SPOTS[next];
    if(spot.super&&CAM.mode===0){G._preSuperCam=0;CAM.mode=1;global.AIBASetIcon("camBtn","camera",CAM.names[1]);applyCamMode();}
    else if(!spot.super&&G._preSuperCam===0){G._preSuperCam=null;CAM.mode=0;global.AIBASetIcon("camBtn","camera",CAM.names[0]);applyCamMode();}
    updBattleUI();updDotsUI();walkTo(curShot(),readyBall,{overlapPass:true});
  }

  Object.assign(battle,{battleRefreshSpot,battleRefreshAll,battleSpotStatus,battleSpotAvailable,battleUseSpot,battleConsumeSuperChance,battleAddSuperChance,battleCheckSuperMilestones,battleNearestAvailable,battleAutoMoveIfNeeded,updBattleUI,battleSetSpot});
})(window);
