/* ---------------- 首屏第一投 ----------------
   首次进入游戏时,不再用一块模态遮罩把人挡在外面,而是直接给一个第一人称的弧顶三分:
   点一下 -> 投篮条自动涨进甜区 -> 自动出手 -> 镜头跟球 -> 空心入网 -> 瞬间切黑 -> 首页。

   它同时解决三件事:
     1. 浏览器要一次用户手势才能解锁音频。这个手势现在有了正当理由 —— 投这一球,
        而不是"请点击以继续"。
     2. 第一声是玩家自己造成的刷网,而不是 BGM 淡入。
     3. 顺手教会了核心动词(蓄力 -> 甜区 -> 出手),不需要额外教程。

   几条设计上的硬约束,改的时候别破坏:
   - **不作弊**:甜区不移动。做法是出手瞬间把 G.power 直接设成 ideal,
     shots.js 的判定是 `if(|power-ideal| <= zone*0.5) outcome="swish"`,
     所以 a=0 必定空心入网 —— 走的是完整真实物理管线,不是特效假动画。
   - **手机倾斜要归零**:lateral 误差 al>0.3 会把 swish 降级成 miss,
     玩家手机拿歪了首屏就翻车。
   - **绝不能卡死**:不点也会在 BOOT_SHOT_IDLE_MS 后自动投,任何一步出错都直接进首页。
   - **只在首次**:第二次以后直接首页,老玩家不该每次都被收仪式税。 */
(function(global){
"use strict";

const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
if(!runtime||!ctx)return;

const SEEN_KEY="aiba_boot_shot_seen";
const IDLE_MS=6000;        // 不点就自动投,绝不卡死在首屏
const FLIGHT_TIMEOUT=4200; // 球飞太久(异常)也要收场
const BLACK_HOLD=140;      // 切黑之后停多久再揭开首页
const BLACK_FADE=380;
const BOOT_FOV=62;         // 首屏专用垂直视角,比竖屏默认的 90° 紧得多

const S={on:false,phase:"idle",ball:null,idleTimer:0,flightTimer:0,raf:0,
  savedCam:0,savedTilt:null,savedHud:undefined,savedFov:0,fovRaf:0,onDone:null};

function q(name){try{return new URLSearchParams(location.search).get(name);}catch(e){return null;}}
function seen(){try{return localStorage.getItem(SEEN_KEY)==="1";}catch(e){return false;}}
function markSeen(){try{localStorage.setItem(SEEN_KEY,"1");}catch(e){}}

/* ?intro=1 强制跑(调试/截图用),?intro=0 强制跳过 */
function shouldRun(){
  const forced=q("intro");
  if(forced==="1")return true;
  if(forced==="0")return false;
  if(seen())return false;
  try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return false;}catch(e){}
  const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(c&&(c.saveData||/^(slow-)?2g$/.test(c.effectiveType||"")))return false;
  return true;
}

function layer(){return document.getElementById("bootShot");}
function setHint(text,cls){
  const el=document.getElementById("bootShotHint");
  if(!el)return;
  el.textContent=text;
  el.className="bootShotHint"+(cls?" "+cls:"");
}

/* ---------- 进入 ---------- */
function start(onDone){
  if(S.on)return false;
  S.on=true;S.phase="idle";S.onDone=onDone||null;
  const el=layer();if(el)el.classList.add("on");
  document.documentElement.dataset.bootShot="1";

  const G=ctx.G;
  /* curShot() 在非 battle/rackrush 时读 G.seq[G.shotIdx],给它一颗弧顶球 */
  G.mode="";G.seq=[{rack:2,ball:0,val:3,money:false,deep:null}];G.shotIdx=0;
  /* practice=true 有一个关键作用:barHiddenFor() 第一行就是 `if(!shot||G.practice)return false`,
     否则弧顶(rack=2)会撞上难度的 hideBar 阈值被判成"盲投",投篮条直接不显示 ——
     那就违背了"首屏要看见投篮条涨进甜区"的设计。 */
  G.state="bootshot";G.practice=true;G.running=false;G.buzzed=false;
  G.score=0;G.streak=0;G.shots=[];G.power=0;G.charging=false;
  /* 进球会一路走到 madeBall -> updTargetUI,那里读 G.posted.filter;
     不铺全这些数组,首屏一进球就抛 TypeError(实测抓到过)。 */
  G.posted=[];G.opponents=[];G.cutQ=[];G.missRun=0;G.cheer=0;G.shotIdx=0;

  const spot=ctx.RACKS[2].p;                    // 弧顶:正对篮筐,第一人称最好懂
  ctx.P.pos.copy(spot);ctx.P.face=ctx.faceTo(spot,ctx.HOOP);
  ctx.P.walking=false;ctx.P.jump=0;ctx.P.eyeDip=0;

  S.savedCam=ctx.CAM.mode;ctx.CAM.mode=0;       // 第一人称
  if(typeof ctx.applyCamMode==="function")ctx.applyCamMode();

  /* 竖屏下 fovForAspect 会被钳到 MAX_VFOV=90°,画面上方留出一大片空黑
     (球馆没有顶)。正常比赛里无所谓,但这是**第一屏**,空一半很难看。
     这里单独收紧到 BOOT_FOV,让篮筐和人群填满画面,收场时原样还原。 */
  /* camera 是 core.js 顶层的 const —— 顶层 const **不会**挂到 window 上,
     写 global.camera 拿到的是 undefined(之前 window.G 也踩过同一个坑)。
     必须裸引用。 */
  try{S.savedFov=camera.fov;}catch(e){}
  pinFov();   // 只设一次会被每帧的 resize/渲染质量逻辑改回 90,得逐帧钉住

  /* 手机拿歪会把 swish 降级成 miss,首屏必须归零 */
  if(global.TILT){S.savedTilt=global.TILT.on;global.TILT.on=false;}

  /* showMenu() 在启动时就把菜单面板铺上了(#ov),不收起来的话首屏看到的是首页,
     根本看不到球场。收场时再 showMenu() 揭回来。 */
  try{ctx.hidePanel();}catch(e){}

  /* 投篮条 #playerPower 是 position:absolute 挂在 #hud 里的,#hud 不显示它就
     参与不了布局(实测量到 0×0)。所以要把 #hud 放出来,但只留投篮条 ——
     比分/计时/球架那些首屏不该出现。用 data-boot-shot 让 CSS 去关,
     免得在这里逐个记 style 再逐个还原。 */
  const hud=document.getElementById("hud");
  if(hud){S.savedHud=hud.style.display;hud.style.display="block";}

  try{ctx.readyBall();}catch(e){}
  G.canShoot=true;

  setHint("点击投出这一球");
  S.idleTimer=setTimeout(()=>fire("auto"),IDLE_MS);
  addEventListener("pointerdown",onPress,{capture:true});
  addEventListener("keydown",onPress,{capture:true});
  return true;
}

/* fov 每帧会被别处改回去(fovForAspect 在竖屏下钳到 90),所以整段仪式期间逐帧钉住。
   收场时 cleanup 会把原值还回去。 */
function pinFov(){
  if(!S.on)return;
  try{
    if(Math.abs(camera.fov-BOOT_FOV)>0.01){camera.fov=BOOT_FOV;camera.updateProjectionMatrix();}
  }catch(e){}
  S.fovRaf=requestAnimationFrame(pinFov);
}

function onPress(e){
  if(!S.on||S.phase!=="idle")return;
  if(e&&e.target&&e.target.closest&&e.target.closest("#bootShotSkip"))return;  // 跳过按钮自己处理
  if(e&&e.preventDefault)e.preventDefault();
  fire("tap");
}

/* ---------- 出手 ---------- */
function fire(){
  if(!S.on||S.phase!=="idle")return;
  S.phase="charging";
  clearTimeout(S.idleTimer);
  removeEventListener("pointerdown",onPress,{capture:true});
  removeEventListener("keydown",onPress,{capture:true});

  /* 解锁音频,但**不要**带菜单音乐 —— 这一段要留白,
     让刷网成为玩家听到的第一个声音,音乐等切到首页再进。 */
  try{ctx.ensureAudio(false,true);}catch(e){}

  setHint("蓄力…","charging");
  try{global.startCharge();}catch(e){}
  S.raf=requestAnimationFrame(watchCharge);
}

/* 投篮条自己会涨(game-loop 里 G.power += playerChargeRate()*dt),
   这里只负责在涨到甜区时替换成精确的 ideal 再松手。 */
function watchCharge(){
  if(!S.on||S.phase!=="charging")return;
  const G=ctx.G;
  let ideal=74;
  try{ideal=global.weatherAdjustedIdeal(global.curShot(),true);}catch(e){}
  if(G.power>=ideal-1){
    G.power=ideal;                    // a=|power-ideal|=0 -> 必定 swish
    S.phase="flying";
    setHint("");
    try{global.doRelease();}catch(e){}
    S.flightTimer=setTimeout(()=>finish("timeout"),FLIGHT_TIMEOUT);
    S.raf=requestAnimationFrame(watchFlight);
    return;
  }
  S.raf=requestAnimationFrame(watchCharge);
}

/* 球是异步生成的(releaseShot -> afterPlayerLands),要轮询等它出现,
   拿到之后交给 startHero 跟拍 —— 那套运镜现成的,不用新写。 */
function watchFlight(){
  if(!S.on||S.phase!=="flying")return;
  const balls=ctx.balls;
  if(!S.ball&&balls&&balls.length){
    S.ball=balls[balls.length-1];
    try{if(typeof global.startHero==="function")global.startHero(S.ball);}catch(e){}
  }
  if(S.ball&&S.ball.made){finish("made");return;}
  S.raf=requestAnimationFrame(watchFlight);
}

/* ---------- 收场:瞬间切黑 -> 揭开首页 ---------- */
function finish(reason){
  if(!S.on||S.phase==="done")return;
  S.phase="done";
  clearTimeout(S.idleTimer);clearTimeout(S.flightTimer);
  if(S.raf)cancelAnimationFrame(S.raf);
  if(S.fovRaf)cancelAnimationFrame(S.fovRaf);
  removeEventListener("pointerdown",onPress,{capture:true});
  removeEventListener("keydown",onPress,{capture:true});

  const black=document.getElementById("bootShotBlack");
  if(black)black.classList.add("on");    // 瞬间切黑(首页本来就是暗色,过渡不跳)

  setTimeout(()=>{
    cleanup();
    /* 首页早就在后面渲染好了,这里只需要把它揭出来 */
    try{global.showMenu();}catch(e){}
    try{ctx.ensureAudio(true,true);}catch(e){}   // 现在才让菜单音乐进来
    try{if(typeof global.startCoverVideo==="function")global.startCoverVideo();}catch(e){}
    if(black){
      black.style.transition="opacity "+BLACK_FADE+"ms ease";
      requestAnimationFrame(()=>black.classList.remove("on"));
      setTimeout(()=>{black.style.transition="";},BLACK_FADE+60);
    }
    markSeen();
    if(S.onDone)try{S.onDone(reason);}catch(e){}
  },BLACK_HOLD);
}

function cleanup(){
  S.on=false;S.ball=null;
  const el=layer();if(el)el.classList.remove("on");
  const hud=document.getElementById("hud");
  if(hud&&S.savedHud!==undefined){hud.style.display=S.savedHud;S.savedHud=undefined;}
  delete document.documentElement.dataset.bootShot;
  const G=ctx.G;
  G.charging=false;G.canShoot=false;G.power=0;G.running=false;G.practice=false;
  try{if(typeof global.hidePlayerPowerUI==="function")global.hidePlayerPowerUI();}catch(e){}
  try{if(typeof global.endHero==="function")global.endHero();}catch(e){}
  /* 清掉首屏这颗球,别带进首页 */
  try{
    const balls=ctx.balls;
    while(balls&&balls.length){const b=balls.pop();ctx.scene.remove(b.mesh);ctx.scene.remove(b.blob);}
  }catch(e){}
  try{
    if(S.savedFov){camera.fov=S.savedFov;camera.updateProjectionMatrix();S.savedFov=0;}
  }catch(e){}
  ctx.CAM.mode=S.savedCam;
  try{if(typeof ctx.applyCamMode==="function")ctx.applyCamMode();}catch(e){}
  if(global.TILT&&S.savedTilt!==null){global.TILT.on=S.savedTilt;S.savedTilt=null;}
  G.state="menu";
}

/* 跳过:任何时候都能走,直接进首页 */
function skip(event){
  if(event){event.stopPropagation();event.preventDefault();}
  if(!S.on)return;
  try{ctx.ensureAudio(false,true);}catch(e){}   // 跳过也算一次手势,顺手解锁
  finish("skip");
}

global.AIBABootShot=Object.freeze({shouldRun,start,skip,
  state:()=>({on:S.on,phase:S.phase})});
global.skipBootShot=skip;
runtime.register("ui:boot-shot",global.AIBABootShot);
})(window);
