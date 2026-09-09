(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,battle=global.AIBABattle;
  if(!runtime||!battle)throw new Error("Percent Battle module requires AIBA runtime and submodules");
  const required=[
    "startBattle","countdownBattle","battleElapsedMs","formatBattleTime","battleSetSpot","battleUseSpot","battleClaimSuperChance","battleConsumeSuperChance","battleNoteNormalScore",
    "startOppShooter","oppBeginPass","cancelOppPass","oppScore","updBattle","finishBattle","showBattleResult"
  ];
  const missing=required.filter(name=>typeof battle[name]!=="function");
  if(missing.length)throw new Error("Percent Battle module incomplete: "+missing.join(", "));

  Object.assign(global,battle,{OPP:battle.OPP});
  runtime.register("mode:percent-battle",{
    id:"percent-battle",
    enter:battle.startBattle,
    start:battle.startBattle,
    update:battle.updBattle,
    finish:battle.finishBattle,
    exit(){
      const ctx=runtime.service("legacy"),G=ctx&&ctx.G;
      if(!G)return;
      G.running=false;G.canShoot=false;battle.pauseBattleClock();battle.OPP.on=false;battle.cancelOppPass(true);
    },
    api:battle
  });
})(window);
