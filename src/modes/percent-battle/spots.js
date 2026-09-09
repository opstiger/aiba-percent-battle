(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy"),battle=global.AIBABattle;
  if(!ctx||!battle)throw new Error("Percent Battle spots require battle state");
  const {
    $,G,BATTLE_TARGET,BATTLE_SPOTS,BATTLE_NORMAL_STOCK,BATTLE_NORMAL_RELOAD,BATTLE_DEEP_RELOAD,
    handBall,pBall,CAM,broadcastSting,gameDjSay,toast,updDotsUI,readyBall,walkTo,curShot,applyCamMode
  }=ctx;
  /* 连中 10 分的上限。命中 10 分必然跨过下一个整十分节点,于是立刻又开一次机会 ——
     不设上限就能一直站在中场刷分。允许连中 2 个,第 3 次节点强制跳过一轮。 */
  const SUPER_STREAK_MAX=2;

  function battleRefreshSpot(index){
    if(G.mode!=="battle"||!G.battleStock||!G.battleReadyAt)return;
    if(index>=0&&index<5&&G.battleStock[index]<=0&&G.tNow>=G.battleReadyAt[index]){
      G.battleStock[index]=BATTLE_NORMAL_STOCK;G.battleReadyAt[index]=0;
    }
  }
  function battleRefreshAll(){for(let i=0;i<BATTLE_SPOTS.length;i++)battleRefreshSpot(i);}
  function battleSpotStatus(index){
    battleRefreshSpot(index);const spot=BATTLE_SPOTS[index];
    if(spot.super)return {ok:(G.superStock||0)>0,label:(G.superStock||0)>0?"开放 · 限投1次":"待10分节点",short:(G.superStock||0)>0?"1":"--"};
    if(index<5){
      const left=G.battleStock?G.battleStock[index]:BATTLE_NORMAL_STOCK;
      const wait=Math.max(0,((G.battleReadyAt&&G.battleReadyAt[index])||0)-G.tNow);
      return {ok:left>0,label:left>0?left+"/"+BATTLE_NORMAL_STOCK:Math.ceil(wait)+"秒恢复",short:left>0?String(left):Math.ceil(wait)+"s"};
    }
    const wait=Math.max(0,((G.battleReadyAt&&G.battleReadyAt[index])||0)-G.tNow);
    return {ok:wait<=0,label:wait<=0?"可投1次":Math.ceil(wait)+"秒恢复",short:wait<=0?"1":Math.ceil(wait)+"s"};
  }
  function battleSpotAvailable(index){return battleSpotStatus(index).ok;}
  /* 认领 10 分机会。**在拿到球的那一刻消耗**,不是在命中的时候。
     旧逻辑是"命中才消耗、打铁不关闭",于是可以站在中场一直投到进为止 —— 这是白送分。
     改成拿球即消耗还解决了另一个投诉:两个人先后出手时,原来前一个进球会把
     后一个人**正在持球/正在出手**的那一投直接取消。现在一次机会只发一颗球,
     谁先认领谁投,另一个人根本不会拿到球,也就不存在"投到一半被取消"。 */
  function battleClaimSuperChance(who){
    if(G.mode!=="battle"||(G.superStock||0)<=0)return 0;
    G.superStock=0;G.superTakenBy=who||"me";
    battle.updBattleUI();updDotsUI();
    return G.superChanceId||0;
  }
  function battleUseSpot(index){
    if(G.mode!=="battle"||!G.battleStock||!G.battleReadyAt)return;
    const spot=BATTLE_SPOTS[index];
    if(spot.super){battleClaimSuperChance("me");return;}
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
    /* ⚠ 这里**不能**再要求 (G.superStock>0)。
       机会现在是"拿球即消耗",命中时 stock 早就是 0 了 —— 留着这个条件会让整个函数
       直接 early return,于是连中计数永远不加,封顶形同虚设(check.js 的 token 断言
       全绿,功能却完全没生效)。去重由 chanceId 那两条负责,已经够了。 */
    if(!chanceId||chanceId!==G.superChanceId||G.superResolvedId===chanceId)return false;
    G.superStock=0;G.superResolvedId=chanceId;
    G.superStreak=(G.superStreak||0)+1;   // 连中计数,由普通得分清零
    battle.updBattleUI();updDotsUI();
    return true;
  }
  /* 任何非 10 分的得分都把连中链打断 —— "连续"指的是中间没有别的球。 */
  function battleNoteNormalScore(){G.superStreak=0;}
  function battleAddSuperChance(who){
    if(G.mode!=="battle"||G.battleOver)return;
    if((G.superStock||0)>=1)return;
    /* 连中封顶。命中 10 分一定会跨过下一个整十分节点,所以这里必须挡一次,
       否则"进 10 分 → 立刻又开 10 分"会无限循环。挡掉的同时把计数清零,
       于是下一个节点恢复正常 —— 效果就是"最多连进 2 个,然后强制停一轮"。 */
    if((G.superStreak||0)>=SUPER_STREAK_MAX){
      G.superStreak=0;
      toast("连中"+SUPER_STREAK_MAX+"个10分 · 本轮中场休息","#9fd1ff");
      return;
    }
    G.superChanceId=(G.superChanceId||0)+1;G.superStock=1;G.superTakenBy=null;
    /* 每次机会换一种球色,让"10分球来了"有第一眼信号 */
    const mats=runtime&&runtime.service("rendering:materials");
    if(mats&&mats.rollSuperBallSkin){
      G.superSkin=mats.rollSuperBallSkin();
      const props=runtime.service("rendering:props");
      const hc=props&&props.getRackBalls&&props.getRackBalls().halfCourt;
      if(hc)hc.material=mats.superBallMaterial(G.superSkin);
    }
    broadcastSting("danger");gameDjSay("中场十分机会出现!","normal",2.2,true);
    toast((who==="opp"?"对手":"你")+"触发中场10分机会!","#ffd23f");battle.updBattleUI();updDotsUI();
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

  Object.assign(battle,{battleRefreshSpot,battleRefreshAll,battleSpotStatus,battleSpotAvailable,battleUseSpot,battleClaimSuperChance,battleConsumeSuperChance,battleNoteNormalScore,battleAddSuperChance,battleCheckSuperMilestones,battleNearestAvailable,battleAutoMoveIfNeeded,updBattleUI,battleSetSpot});
})(window);
