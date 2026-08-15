/* ---------------- input ---------------- */
function audioGestureUnlock(e){
  if(BOOT_GATE_ACTIVE)return;
  if(e&&e.target&&e.target.id==="muteBtn")return;
  const menuLike=G.state==="menu"||G.state==="diff";
  const arenaLike=G.state==="cinematic"||G.state==="pregame"||G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot"||G.state==="rushintro"||G.state==="rushbetween"||G.state==="victorycine";
  if(!AC||AC.state==="suspended"||(menuLike&&!audioState().menuMusic))ensureAudio(menuLike,true);
  if(arenaLike&&extA.crowd&&extA.crowd.paused)extPlay("crowd");
  if(arenaLike&&extA.crowdCheer&&extA.crowdCheer.paused)extPlay("crowdCheer");
  syncSceneAmbience();
}
function onDown(e){
  if(BOOT_GATE_ACTIVE)return;
  if(PAUSE.on)return;
  if(e.target&&e.target.closest&&e.target.closest("#courtTools"))return;
  if(e.target&&e.target.closest&&e.target.closest("#ov"))return;
  if(e.target&&e.target.closest&&e.target.closest("#visionPreview"))return;
  if(e.target&&e.target.closest&&e.target.closest("#battleControls"))return;
  if(e.target&&e.target.closest&&e.target.closest("#spotDots"))return;
  if(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot"){e.preventDefault();startCharge();}
}
function onUp(e){
  if(BOOT_GATE_ACTIVE)return;
  if(PAUSE.on)return;
  if(e.target&&e.target.closest&&e.target.closest("#courtTools"))return;
  if(e.target&&e.target.closest&&e.target.closest("#ov"))return;
  if(e.target&&e.target.closest&&e.target.closest("#visionPreview"))return;
  if(e.target&&e.target.closest&&e.target.closest("#battleControls"))return;
  if(e.target&&e.target.closest&&e.target.closest("#spotDots"))return;
  if(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot"){doRelease();}
}
["pointerdown","touchstart","touchend","mousedown","click"].forEach(type=>{
  addEventListener(type,audioGestureUnlock,{passive:true,capture:true});
});
addEventListener("pointerdown",onDown,{passive:false});
addEventListener("pointerup",onUp);
addEventListener("keydown",e=>{
  if(BOOT_GATE_ACTIVE){if(!e.repeat)unlockBoot(e);return;}
  if(!e.repeat)audioGestureUnlock();
  if((e.code==="Escape"||e.code==="KeyP")&&!e.repeat){
    if(PAUSE.on)resumePauseMenu();
    else if(pauseableState())openPauseMenu(e);
    return;
  }
  if(PAUSE.on)return;
  if(e.code==="Space"&&!e.repeat)startCharge();
  if(e.code==="KeyC"&&(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot"))cycleCam();
  if(G.state==="battle"&&(e.code==="ArrowLeft"||e.code==="KeyA"))battlePrevSpot();
  if(G.state==="battle"&&(e.code==="ArrowRight"||e.code==="KeyD"))battleNextSpot();
});
addEventListener("keyup",e=>{if(e.code==="Space")doRelease();});
addEventListener("contextmenu",e=>e.preventDefault());

/* ---------------- device tilt (手机左右倾斜影响球路) ---------------- */
const TILT={raw:0,base:0,on:false};
function tiltDeg(){return TILT.on?clamp(TILT.raw-TILT.base,-30,30):0;}
addEventListener("deviceorientation",e=>{
  if(e.gamma==null&&e.beta==null)return;
  const a=(screen.orientation&&screen.orientation.angle!=null)?screen.orientation.angle:(window.orientation||0);
  let g;
  if(a===90)g=e.beta;else if(a===-90||a===270)g=e.beta==null?null:-e.beta;else g=e.gamma;
  if(g==null)return;
  TILT.on=true;TILT.raw=g;
  updTiltUI();
});
function calibrateTilt(){TILT.base=TILT.raw;}
function updTiltUI(){
  const w=$("tiltWrap");if(!w)return;
  const show=TILT.on&&(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot");
  w.style.display=show?"block":"none";
  if(!show)return;
  const d=tiltDeg();
  const dot=$("tiltDot");
  dot.style.left=(50+clamp(d,-25,25)*1.8)+"%";
  dot.style.background=Math.abs(d)<4?"#7CFC6B":(Math.abs(d)<10?"#ffd23f":"#ff5d4d");
}
function askTiltPerm(){
  try{
    if(typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function")
      DeviceOrientationEvent.requestPermission().catch(()=>{});
  }catch(e){}
}


window.AIBA.runtime.register("core:input",Object.freeze({
  TILT,audioGestureUnlock,onDown,onUp,tiltDeg,calibrateTilt,updTiltUI,askTiltPerm
}));

