/* ---------------- hero moments: 投篮机的最后一球特写 ----------------
   三分大赛(contest)在生成球后处理特写;以下是两种投篮机模式的判定:
   - 投篮机闯关:FINAL RUSH 哨响后，只跟最后一颗预计命中的球
   - 百分竞速:预计命中且分值足以破百，入网前保持比赛原速
   在实际生成球时判断,覆盖新版动作的延迟出手和经典动作的即时出手。 */
(function(global){
  "use strict";

  function shouldHero(B){
    if(typeof G==="undefined"||G.practice||typeof hero==="undefined"||hero.on)return false;
    if(G.mode!=="rackrush"||G.state!=="rackrush"||!G.rush||!B||B.opp||B.cosmic||B.made||!heroPredictedMake(B))return false;
    if(isRackRushSpeed(G.rush)){
      const score=G.rush.total||0;
      return G.running&&score<RACK_RUSH_SPEED_TARGET&&Number.isFinite(B.val)&&B.val>0&&score+B.val>=RACK_RUSH_SPEED_TARGET;
    }
    const cfg=RACK_RUSH_LEVELS[G.rush.level]||{};
    return !!cfg.final&&G.buzzed;
  }

  function onRackRushBallSpawn(ball){
    if(shouldHero(ball))startHero(ball,isRackRushSpeed(G.rush)?"speed":"terminal");
  }

  function onRackRushBuzzer(){
    const ball=balls.slice().reverse().find(b=>b.rushRunId===G.rush?.id&&!b.made);
    if(ball)onRackRushBallSpawn(ball);
  }

  function onSpeedFinish(ball){
    if(hero.on&&hero.b!==ball)endHero();
    if(!hero.on&&!ball.cosmic)startHero(ball,"speed");
  }

  ["startVictoryCine","startWinCine","startCelebrate"].forEach(name=>{
    const orig=global[name];
    if(typeof orig!=="function"||orig.__aibaHero)return;
    const wrapped=function(){
      try{if(typeof endHero==="function")endHero();}catch(e){}
      return orig.apply(this,arguments);
    };
    wrapped.__aibaHero=true;
    global[name]=wrapped;
  });

  global.AIBAHeroMoments={shouldHero,onRackRushBallSpawn,onRackRushBuzzer,onSpeedFinish};
})(window);
