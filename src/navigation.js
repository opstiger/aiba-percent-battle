(function(global){
  "use strict";

  function $(id){return document.getElementById(id);}

  function sync(){
    const button=$("homeBtn");
    if(!button)return;
    const arena=/^(cinematic|pregame|aishow|round|tiebreak|battle|rackrush|rushintro|rushbetween|replay|victorycine|wincine|lastshot)$/.test(G.state);
    const visible=!global.BOOT_GATE_ACTIVE&&G.state!=="boot"&&G.state!=="menu"&&!arena;
    button.classList.toggle("ready",visible);
    button.setAttribute("aria-hidden",visible?"false":"true");
    if(global.AIBAPerfSettings&&global.AIBAPerfSettings.syncButton)global.AIBAPerfSettings.syncButton();
  }

  function cancelPregame(){
    if(!PREGAME.on)return;
    PREGAME.snaps.forEach(pregameRestoreGuy);
    PREGAME.on=false;PREGAME.t=0;PREGAME.idx=0;PREGAME.shots=[];PREGAME.actors=[];PREGAME.snaps=[];PREGAME.cb=null;
  }

  function cleanup(options){
    cancelPregame();
    tweens.length=0;
    if(typeof stopVictoryCine==="function")stopVictoryCine();
    else if(typeof VICTORY_CINE!=="undefined")VICTORY_CINE.on=false;
    if(typeof winCine!=="undefined")winCine.on=false;
    if(typeof AIBARecorder!=="undefined"&&AIBARecorder.cancel)AIBARecorder.cancel();
    if(!(options&&options.preserveVision)&&typeof suspendVisionControl==="function")suspendVisionControl();
    const count=$("countN"),show=$("showUI");
    if(count)count.style.display="none";
    if(show)show.style.display="none";
  }

  function returnHome(){
    PAUSE.on=false;
    global.hidePanel();
    clearLiveObjectsForMenu();
    showMenu();
    updatePauseButton();
    sync();
  }

  function requestHome(event){
    if(event){event.preventDefault();event.stopPropagation();}
    if(global.BOOT_GATE_ACTIVE||G.state==="menu")return;
    if(PAUSE.on){returnHomeFromPause();sync();return;}
    if(pauseableState()){openPauseMenu(event);sync();return;}
    returnHome();
  }

  function consumeBootEvent(event){
    event.preventDefault();event.stopPropagation();
    if(event.stopImmediatePropagation)event.stopImmediatePropagation();
  }

  function wireBootGate(){
    const gate=$("bootLoad");
    if(!gate)return;
    gate.removeEventListener("pointerdown",global.unlockBoot);
    gate.addEventListener("pointerup",event=>{
      consumeBootEvent(event);
      global.unlockBoot(event);
      sync();
    },{passive:false});
    gate.addEventListener("click",consumeBootEvent,{passive:false});
  }

  function wirePanelSync(){
    const panel=global.showPanel,cover=global.showCoverPanel;
    if(typeof panel!=="function"||typeof cover!=="function")return;
    global.showPanel=function(html){const result=panel(html);sync();return result;};
    global.showCoverPanel=function(html){const result=cover(html);sync();return result;};
  }

  function boot(){
    const button=document.createElement("button");
    button.id="homeBtn";button.type="button";button.textContent="返回首页";
    if(global.AIBASetIcon)global.AIBASetIcon(button,"arrow-left","返回首页");
    button.title="返回首页";button.setAttribute("aria-label","返回首页");button.setAttribute("aria-hidden","true");
    button.addEventListener("pointerdown",event=>event.stopPropagation());
    button.addEventListener("click",requestHome);
    document.body.appendChild(button);
    wirePanelSync();wireBootGate();sync();
  }

  global.AIBANavigation=Object.freeze({sync,cleanup,requestHome,returnHome});
  boot();
})(window);
