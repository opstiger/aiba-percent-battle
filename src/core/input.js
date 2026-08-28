/* ---------------- input ---------------- */
function audioGestureUnlock(e){
  if(BOOT_GATE_ACTIVE)return;
  /* 首屏第一投期间由 boot-shot.js 自己在按下那一刻解锁(而且刻意不带菜单音乐,
     要把留白留给刷网声),这里不要抢先把 BGM 放出来。 */
  if(document.documentElement.dataset.bootShot==="1")return;
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
/* 倾角必须是"相对你握住手机那一刻"的量,不是设备的绝对倾角 ——
   否则自然握持的那点倾斜会变成整局挥之不去的横向偏差,玩家的感受就是"莫名其妙投不进"。
   三个缺陷分别修:
     1) 校准原本只取**单帧**(TILT.base=TILT.raw)。撞上一次抖动,零点就歪一整局。
        改成 2 秒窗口的中位数 —— 中位数比均值抗单帧尖峰。
     2) deviceorientation 第一帧就把 on 置真,而校准可能还没发生;
        那段时间用的是 base=0 的**设备绝对倾角**。加 ready 闸,校准完成前不生效。
     3) 一局 70 秒里换握姿是常事,不补偿的话那次换姿就变成后半局的永久偏差。
        base 极慢地朝当前姿势漂移(时间常数 TILT_SETTLE 秒):慢到吃不掉玩家主动的倾斜,
        又足以让握姿变化在十几秒内被消化掉。 */
const TILT_CAL_MS=2000,TILT_CAL_MIN=8,TILT_SETTLE=25;
const TILT={raw:0,base:0,on:false,ready:false,cal:null,lastT:0};
function tiltDeg(){return (TILT.on&&TILT.ready)?clamp(TILT.raw-TILT.base,-30,30):0;}
const tiltNow=()=>(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
addEventListener("deviceorientation",e=>{
  if(e.gamma==null&&e.beta==null)return;
  const a=(screen.orientation&&screen.orientation.angle!=null)?screen.orientation.angle:(window.orientation||0);
  let g;
  if(a===90)g=e.beta;else if(a===-90||a===270)g=e.beta==null?null:-e.beta;else g=e.gamma;
  if(g==null)return;
  TILT.on=true;TILT.raw=g;
  const now=tiltNow();
  if(TILT.cal){
    TILT.cal.push(g);
    /* 窗口是靠事件推进的。校准发出后若很久没有 deviceorientation 事件
       (页面在后台、设备没陀螺仪、用户完全没动),第一个到达的事件会发现窗口早已过期,
       于是拿**一个样本**当中位数 —— 那和原来的单帧校准一样脆。
       样本不够就把窗口顺延:宁可晚一点 ready,也不要拿一帧定零点。 */
    if(now>=TILT.calUntil){
      if(TILT.cal.length>=TILT_CAL_MIN){
        const sorted=TILT.cal.slice().sort((x,y)=>x-y);
        TILT.base=sorted[sorted.length>>1];
        TILT.cal=null;TILT.ready=true;TILT.lastT=now;
      }else TILT.calUntil=now+TILT_CAL_MS;
    }
  }else if(TILT.ready){
    const dt=TILT.lastT?Math.min(.5,(now-TILT.lastT)/1000):0;
    TILT.lastT=now;
    if(dt>0)TILT.base+=(g-TILT.base)*(1-Math.exp(-dt/TILT_SETTLE));
  }
  updTiltUI();
});
function calibrateTilt(){
  TILT.cal=[];TILT.calUntil=tiltNow()+TILT_CAL_MS;TILT.ready=false;
  /* 先用当前值兜个底:这 2 秒里玩家可能已经出手了,那也比 base=0(绝对倾角)强。
     ready 仍然是 false,所以这期间 tiltDeg() 返回 0 —— 宁可不生效,也不要错误生效。 */
  TILT.base=TILT.raw;
}
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

