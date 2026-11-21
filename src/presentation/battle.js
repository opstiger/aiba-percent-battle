function updBattleCut(dt){
  const c=G.battleCut;if(!c)return;
  c.t+=dt;
  const hero=c.byMe?player:OPP.guy;
  updateCelebrate(hero,dt);
  const fy=hero.g.rotation.y;
  const d=V3(Math.sin(fy),0,Math.cos(fy));
  const pp=V3(d.z,0,-d.x);
  rig.pos.lerp(V3(hero.g.position.x+d.x*2.4+pp.x*1.2,1.3,hero.g.position.z+d.z*2.4+pp.z*1.2),Math.min(1,dt*7));
  rig.look.lerp(V3(hero.g.position.x,1.5,hero.g.position.z),Math.min(1,dt*9));
  if(c.t>=3){
    stopCelebrate(hero);
    G.battleCut=null;$("vsBanner").style.display="none";
    resumeBattleClock();G.running=true;applyCamMode();updBattleUI();
    toast(c.byMe?"继续!扩大领先":"别慌,追回来!",c.byMe?"#7CFC6B":"#ffd23f");
  }
}
function checkBattleOvertake(prevMe,prevOpp){
  G.battleScoreEvents=(G.battleScoreEvents||0)+1;
  if(G.battleCut||G.battleOver)return;
  const meLeads=G.score>G.battleOppScore,oppLeads=G.battleOppScore>G.score;
  const fromTie=(meLeads&&prevMe===prevOpp)||(oppLeads&&prevOpp===prevMe);
  const byMe=meLeads&&prevMe<prevOpp?true:(oppLeads&&prevOpp<prevMe?false:null);
  const hint=()=>toast((meLeads?"你":"对手")+"取得领先 · "+G.score+" : "+G.battleOppScore,meLeads?"#7CFC6B":"#ffd23f");
  if(fromTie){hint();return;}
  if(byMe===null)return;
  const top=Math.max(G.score,G.battleOppScore),margin=Math.abs(G.score-G.battleOppScore);
  const elapsed=G.tNow-(G.battleLastCutAt==null?-1e9:G.battleLastCutAt);
  const scoreGap=G.battleScoreEvents-(G.battleLastCutEvent==null?-1e9:G.battleLastCutEvent);
  const cutCount=G.battleCutCount||0;
  const locked=G.tNow<(G.battleCutLockUntil||0);
  const reserveFinal=cutCount>=2&&top<90;
  if(cosmicShotInFlight()||top<CUTAWAY_MIN_SCORE||margin<3||elapsed<BATTLE_CUT_COOLDOWN||scoreGap<BATTLE_CUT_MIN_SCORE_EVENTS||cutCount>=BATTLE_CUT_MAX||locked||reserveFinal){hint();return;}
  G.battleCutCount=cutCount+1;G.battleLastCutAt=G.tNow;G.battleLastCutEvent=G.battleScoreEvents;
  const key=top>=BATTLE_TARGET-15||(byMe?G.score-prevMe:G.battleOppScore-prevOpp)>=10;
  battleCutaway(byMe,key);
}
function resetFinalRun(){
  G.finalRun=false;
  const el=$("finalRun");if(el)el.classList.remove("show");
  delete document.documentElement.dataset.finalRun;
  syncSceneAmbience();
}
function triggerFinalRun(me,op){
  if(G.finalRun||G.mode!=="battle"||G.battleOver)return;
  G.finalRun=true;document.documentElement.dataset.finalRun="1";
  const el=$("finalRun");
  if(el){el.classList.remove("show");void el.offsetWidth;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
  const beach=environmentRoot.userData.beachState;if(beach)beach.finalBoost=1;
  syncSceneAmbience();airhorn();broadcastSting("danger");crowdSwell(.48,3.2);applause(.65,2.8);
  gamePaSay("FINAL RUN,最后冲刺。现在"+me+"比"+op+"。一球都不能松。","score",2.2,true);
  toast("FINAL RUN · "+me+" : "+op,"#ffd23f");
}
function battleScoreCallout(prevMe,prevOpp){
  if(G.mode!=="battle"||G.battleOver)return;
  if(!G.battleCalls)G.battleCalls={};
  const me=Math.min(G.score,BATTLE_TARGET),op=Math.min(G.battleOppScore||0,BATTLE_TARGET);
  const prevMax=Math.max(prevMe||0,prevOpp||0),nowMax=Math.max(me,op);
  const marks=[20,50,80,90];
  for(const m of marks){
    if(!G.battleCalls[m]&&prevMax<m&&nowMax>=m){
      G.battleCalls[m]=true;
      G.battleCutLockUntil=G.tNow+4;
      if(m===90){
        triggerFinalRun(me,op);
        if(nowMax>=95&&!G.battleCalls.final5){
          G.battleCalls.final5=true;
          setTimeout(()=>{broadcastSting("danger");if(gamePaSay("最后五分决胜,"+me+"比"+op+"。一球都不能松。","score",2.8,true))toast("最后5分! "+me+" : "+op,"#ffd23f");},2450);
        }
        return;
      }
      broadcastSting(m>=80?"danger":"score");
      const lead=me>op?"你暂时领先。":op>me?G.battleOpp.n+"暂时领先。":"双方打平。";
      const tension=m>=90?"九十分关口,下一球都可能改变比赛。":m>=80?"进入最后冲刺阶段。":m>=50?"比赛过半,节奏开始加速。":"第一段比分播报。";
      gamePaSay(tension+"现在"+me+"比"+op+"。"+lead,"score",2.6,true);
      toast("比分播报 "+me+" : "+op,"#9fd1ff");
      return;
    }
  }
  if(!G.battleCalls.final5&&prevMax<95&&nowMax>=95){
    G.battleCalls.final5=true;
    G.battleCutLockUntil=G.tNow+4;
    broadcastSting("danger");
    gamePaSay("最后五分决胜,"+me+"比"+op+"。一球都不能松。","score",2.8,true);
    toast("最后5分! "+me+" : "+op,"#ffd23f");
  }
}

window.AIBA.runtime.register("presentation:battle",Object.freeze({
  updBattleCut,checkBattleOvertake,resetFinalRun,triggerFinalRun,battleScoreCallout
}));

