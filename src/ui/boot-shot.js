/* ---------------- 首屏第一投 ----------------
   首次进入游戏时,不再用一块模态遮罩把人挡在外面,而是直接放一段可交互的开场:
   低机位广角空镜拍篮筐 -> 人物从画面右后方走进来 -> 镜头升起落到过肩位 ->
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
   - **只在首次**:第二次以后直接首页,老玩家不该每次都被收仪式税。

   调试参数:`?new=1` 清掉全部新手引导标记并强制跑一次(最常用);
            `?intro=1` 只强制跑这一段;`?intro=0` 强制跳过。 */
(function(global){
"use strict";

const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
if(!runtime||!ctx)return;

const SEEN_KEY="aiba_boot_shot_seen";
const IDLE_MS=10000;       // 隔 10 秒没操作才自动投 —— 先把机会留给玩家自己按
const FLIGHT_TIMEOUT=4200; // 球飞太久(异常)也要收场
const BLACK_HOLD=140;      // 切黑之后停多久再揭开首页
const BLACK_FADE=380;
/* ---------- 开场运镜 ----------
   低机位 + 仰角 + 广角:开局是一段空镜,只有篮筐和看台;人物从画面右后方走进来,
   镜头一边缓慢升起一边落到过肩位,人物站定后才出现投篮条。

   坐标参考:篮筐 (0,3.05,-8)、弧顶 (0,0,-0.05),玩家朝 -z。
   相机 z 始终大于人物路径的 z —— 一旦相机跑到人物前面,"走进画面"就变成"从背后穿出去"。
   改数值之前先跑 node scripts/boot-shot.frames.mjs 拍几帧看构图。 */
/* 入场点在**镜头右后方** —— 相机看不到的地方。人物朝篮筐迈步,顺势从画面右下角切进来,
   全程背对镜头、正面朝筐。

   为什么必须"贴着镜头旁边走过去"而不是从侧面平移进来:竖屏的横向视野半角只有约 19°,
   在过肩距离(2.6m)上画面宽度只有 ±0.8m。任何超过这个量的侧向入场,在走完 80% 之前
   都还在框外,等他终于进画面时早就站定了。只有从镜头近旁经过,才看得到入画的过程 ——
   而且近距离经过时人物很大,正好是英雄首次入境的观感。 */
const ENTRY=[1.75,0,4.30];
const WALK_DUR=3.2;        /* 自己控时长。1.9s 走 4.5m ≈ 2.4 m/s,那是快步不是入场;
                              英雄踱步应该在 1.4 m/s 量级。步幅会跟着速度自动变小(见 poseRunCycle)。 */
const CINE=[
  /* 侧后方低机位。视线压在 2.0 附近而不是直接怼篮筐(y=3.05):球馆没有顶,
     相机一仰画面上半部就是纯黑。仰角的观感来自机位贴地,不是把镜头抬起来。
     机位从中线缓慢右移,人物从右边切进来后落到画面左侧 —— 一次横向交错。 */
  {t:0.00,pos:[-0.25,0.60,3.45],look:[0,2.05,-8],fov:71},  // 空镜:贴地仰拍篮筐
  {t:1.05,pos:[-0.18,0.68,3.38],look:[0,2.12,-8],fov:71},  // 几乎不动,人物此时起步
  {t:2.90,pos:[ 0.10,0.98,3.02],look:[0,2.45,-8],fov:69},  // 人物贴着镜头右侧切进画面
  {t:4.30,pos:[ 0.55,1.30,2.68],look:[0,2.95,-8],fov:66}   // 落定:右肩后方
];
const WALK_AT=1.05;        // 空镜多久后人物起步
const CINE_END=CINE[CINE.length-1].t;
const WALK_TIMEOUT=4.0;   // 走位万一卡住,到点强制就位
const CATCH_TIMEOUT=2.2;  // 传球没到手的兜底

const S={on:false,phase:"idle",ball:null,idleTimer:0,flightTimer:0,raf:0,
  savedCam:0,savedTilt:null,savedHud:undefined,savedFov:0,fovRaf:0,onDone:null,
  cineT:0,cineLast:0,cineRaf:0,fov:CINE[0].fov,walkStarted:false,walkDone:false,
  pendingFire:false,savedGlide:false,savedBody:null,walkK:0,walkStep:-1};

const clamp01=v=>v<0?0:(v>1?1:v);
const nowMs=()=>(global.performance&&performance.now)?performance.now():Date.now();

function q(name){try{return new URLSearchParams(location.search).get(name);}catch(e){return null;}}
function seen(){try{return localStorage.getItem(SEEN_KEY)==="1";}catch(e){return false;}}
function markSeen(){try{localStorage.setItem(SEEN_KEY,"1");}catch(e){}}

/* ?new=1:把所有"看过了"的标记清掉,整个当成全新玩家 —— 调试首次进入用。
   必须在模块加载时(而不是 shouldRun 里)就清:onboarding.js / vision-tutorial.js
   都是在自己的 IIFE 里一次性读 localStorage 的,等到 shouldRun 被调用时它们早读完了。
   index.html 里 boot-shot.js(183) 在 onboarding.js(205) 之前,所以这里清来得及。

   只清引导类标记。成绩、球员身份、场景偏好属于玩家数据,不该被一个调试参数抹掉 —— 
   要连数据一起重置的话得是另一个明确的开关。 */
const FIRST_RUN_KEYS=["aiba_boot_shot_seen","aiba_onboard_v2","aiba_vision_tut_v1","aiba-rain-hint-seen"];
function resetFirstRun(){
  let cleared=0;
  try{FIRST_RUN_KEYS.forEach(k=>{if(localStorage.getItem(k)!==null){localStorage.removeItem(k);cleared++;}});}catch(e){}
  return cleared;
}
if(q("new")==="1"){
  const n=resetFirstRun();
  try{console.info("[aiBA] ?new=1 已重置 "+n+" 个新手引导标记,本次按首次进入运行");}catch(e){}
}

/* ?new=1 / ?intro=1 强制跑(调试/截图用),?intro=0 强制跳过 */
function shouldRun(){
  const forced=q("intro");
  if(forced==="1")return true;
  if(forced==="0")return false;          // 显式关掉优先级最高
  if(q("new")==="1")return true;         // 连"省流量/减动效"也一起绕过,调试就是要看见
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

  /* 第三人称:applyCamMode 里 `player.g.visible=CAM.mode!==0`,
     用第一人称的话人物模型整个不渲染,"人物走进画面"就无从谈起。
     镜头本身不走 CAM.mode 的取景逻辑(已被 glideCam 接管),这里只为了让身体可见。 */
  S.savedCam=ctx.CAM.mode;ctx.CAM.mode=1;
  if(typeof ctx.applyCamMode==="function")ctx.applyCamMode();
  /* 开场那一秒要的是**空镜**。applyCamMode 刚把人物模型打开了,这里再关掉,
     等他起步的那一帧才显形 —— 一个 5 米外、出现即移动的小人几乎察觉不到,
     但让他提前站在画面里,"人物走进画面"这件事就不成立了。 */
  try{S.savedBody=ctx.player.g.visible;ctx.player.g.visible=false;}catch(e){}
  setRackProps(false);

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

  /* 人物先站到画面外,等运镜走到点再走进来 */
  ctx.P.pos.set(ENTRY[0],ENTRY[1],ENTRY[2]);
  /* 面向**篮筐**,不是面向要走去的位置 —— 差了 13.8°,而且一开始就朝错方向,
     "始终面向篮筐"这条就从第一帧开始破了。 */
  ctx.P.face=ctx.faceTo(ctx.P.pos,ctx.HOOP);
  ctx.P.walking=false;

  /* 接管镜头:game-loop 里 bootshot 那条分支带 `&&!G.glideCam`,
     置上之后 updPlayCam 就不再写 rig,整段运镜归这里管。
     出手后 hero.on 的优先级更高(在同一条 if 链的更前面),会自动接走跟球镜头。 */
  S.savedGlide=!!G.glideCam;
  G.glideCam=true;
  G.canShoot=false;
  S.phase="cine";S.cineT=0;S.cineLast=0;S.walkStarted=false;S.walkDone=false;S.pendingFire=false;
  setHint("");
  updCine();

  /* 运镜期间也接管点击:早点的人不该被无视 —— 记下来,人一站定立刻出手。 */
  addEventListener("pointerdown",onPress,{capture:true});
  addEventListener("keydown",onPress,{capture:true});
  return true;
}

/* ---------- 运镜 ---------- */
function cineSample(t){
  let i=0;
  while(i<CINE.length-2&&t>=CINE[i+1].t)i++;
  const a=CINE[i],b=CINE[i+1]||a;
  const span=Math.max(1e-4,b.t-a.t);
  let k=clamp01((t-a.t)/span);
  k=k*k*(3-2*k);                       // smoothstep:关键帧之间不出折角
  const mix=(u,v)=>u+(v-u)*k;
  return {
    px:mix(a.pos[0],b.pos[0]),py:mix(a.pos[1],b.pos[1]),pz:mix(a.pos[2],b.pos[2]),
    lx:mix(a.look[0],b.look[0]),ly:mix(a.look[1],b.look[1]),lz:mix(a.look[2],b.look[2]),
    fov:mix(a.fov,b.fov)
  };
}
function updCine(){
  S.cineRaf=0;
  if(!S.on||S.phase==="flying"||S.phase==="done")return;   // 出手后交给 hero 跟球
  /* 按帧累计,而不是墙钟。start() 之后主线程还要建场景/编译着色器,实测能卡住 2.3 秒;
     用 nowMs()-起点 的话第一帧渲染出来时 t 已经 2.3,整段运镜直接闪到终点,等于没有。
     单帧封顶 50ms —— 卡多久都只吃掉一帧的进度,该看到的画面一帧不少。 */
  const n=nowMs();
  const dtFrame=S.cineLast?Math.min(0.05,(n-S.cineLast)/1000):0;
  S.cineT+=dtFrame;
  S.cineLast=n;
  const t=S.cineT;
  const f=cineSample(Math.min(t,CINE_END));
  /* 站定后加一点极轻的呼吸位移,免得画面死住像张静帧 */
  const idle=t>CINE_END?(t-CINE_END):0;
  try{
    ctx.rig.pos.set(f.px+Math.sin(idle*0.55)*0.035,f.py+Math.sin(idle*0.42)*0.022,f.pz);
    ctx.rig.look.set(f.lx,f.ly,f.lz);
  }catch(e){}
  S.fov=f.fov;

  if(!S.walkStarted&&t>=WALK_AT)beginWalkIn();
  if(S.walkStarted&&!S.walkDone){
    updWalkIn(dtFrame);
    if(t>WALK_AT+WALK_TIMEOUT)onWalkDone();   // 兜底,绝不卡在半路
  }
  /* 球是传过来的:readyBall -> startPass -> 接住那一帧 motion.js 才置 canShoot 并显形。
     镜头落定就直接放开投篮权的话,球还在空中人已经能出手了 —— 画面上是空手投篮。
     所以要等真的接到球;传球万一没走完,CATCH_TIMEOUT 之后强行塞到手里,绝不卡住。 */
  if(S.walkDone&&S.phase==="cine"&&t>=CINE_END&&(ctx.G.canShoot||t>CINE_END+CATCH_TIMEOUT))armShot();

  S.cineRaf=requestAnimationFrame(updCine);
}
/* 不能用 walkTo:它先朝**移动方向**走,最后 25% 才转向篮筐 —— 人物会先正脸对着镜头
   走一段再掉头,和"始终面向篮筐"正相反。这里自己插值位移,每帧把 P.face 锁回篮筐;
   腿部循环不依赖 walkTo,motion.js 的 poseGuy 里是 `if(P.walking)P.walkT+=dt*9`,
   只要把 P.walking 置上就会摆腿。 */
function beginWalkIn(){
  S.walkStarted=true;S.walkK=0;S.walkStep=-1;
  try{ctx.player.g.visible=true;}catch(e){}
  try{
    ctx.P.pos.set(ENTRY[0],ENTRY[1],ENTRY[2]);
    ctx.P.face=ctx.faceTo(ctx.P.pos,ctx.HOOP);
    ctx.P.walking=true;ctx.P.walkT=0;
    ctx.G.moving=true;                 // 走位期间不许出手(startCharge 自己会挡)
  }catch(e){}
}
function updWalkIn(dt){
  if(!S.walkStarted||S.walkDone)return;
  S.walkK=Math.min(1,S.walkK+dt/WALK_DUR);
  const k=S.walkK,e=k*k*(3-2*k);       // 起步收步都软一点,不要匀速滑行
  try{
    const spot=ctx.RACKS[2].p;
    ctx.P.pos.set(ENTRY[0]+(spot.x-ENTRY[0])*e,0,ENTRY[2]+(spot.z-ENTRY[2])*e);
    ctx.P.face=ctx.faceTo(ctx.P.pos,ctx.HOOP);   // 每帧锁回篮筐:全程背对镜头
    const step=(k*WALK_DUR*3.1)|0;
    if(step!==S.walkStep){
      S.walkStep=step;
      if(Math.random()<0.6&&typeof global.shoeSqueak==="function")global.shoeSqueak(false);
    }
  }catch(e){}
  if(k>=1)onWalkDone();
}
function onWalkDone(){
  if(S.walkDone)return;
  S.walkDone=true;
  try{
    const spot=ctx.RACKS[2].p;
    ctx.P.pos.copy(spot);ctx.P.face=ctx.faceTo(spot,ctx.HOOP);
    ctx.P.walking=false;ctx.G.moving=false;
    /* 腿部姿态要显式归零 —— 这是 motion.js 的 updWalk 收尾干的活,
       走位既然由这里接管,不抄过来人就会定格在半屈腿上。 */
    const pl=ctx.player;
    ["legs","knees","ankles","shoes"].forEach(part=>{
      if(pl&&pl[part]){pl[part][0].rotation.x=0;pl[part][1].rotation.x=0;}
    });
    if(pl&&pl.g)pl.g.rotation.x=0;
  }catch(e){}
  try{ctx.readyBall();}catch(e){}   // 球到手,但还不能投 —— 等镜头落定
}
/* 镜头落定 + 人已就位 = 把球权交给玩家 */
function armShot(){
  if(S.phase!=="cine")return;
  S.phase="idle";
  if(!ctx.G.canShoot){                       // 兜底:传球没到,直接把球塞到手里
    ctx.G.canShoot=true;
    try{global.setHandBall();}catch(e){}
  }
  setHint("点击投出这一球");
  S.idleTimer=setTimeout(()=>fire("auto"),IDLE_MS);
  if(S.pendingFire){S.pendingFire=false;fire("tap");}
}

/* fov 每帧会被别处改回去(fovForAspect 在竖屏下钳到 90),所以整段仪式期间逐帧钉住。
   收场时 cleanup 会把原值还回去。 */
function pinFov(){
  if(!S.on)return;
  try{
    if(Math.abs(camera.fov-S.fov)>0.01){camera.fov=S.fov;camera.updateProjectionMatrix();}
  }catch(e){}
  S.fovRaf=requestAnimationFrame(pinFov);
}

/* 开场机位是从弧顶后拉出来的,正好会穿过那里的备用球架 —— 三颗篮球贴着镜头
   把画面下半部堵死(实测)。整段开场用不到备用球(玩家手上那颗是 handBall),
   所以直接收掉,收场时用 resetRackBalls() 按当前模式重新推导可见性。 */
function setRackProps(on){
  try{
    const props=runtime.service("rendering:props");
    if(!props||!props.getRackBalls)return;
    const r=props.getRackBalls();
    r.regular.forEach(row=>row.forEach(m=>{if(m)m.visible=on;}));
    r.deep.forEach(m=>{if(m)m.visible=on;});
    r.regularStands.forEach(st=>{if(st)st.visible=on;});
    r.deepStands.forEach(st=>{if(st)st.visible=on;});
  }catch(e){}
}

/* 首屏的音频落点都走这里:事件没登记就是 false,不报错、不发请求。 */
function playBootEvent(id){
  try{if(typeof global.playAudioEvent==="function")global.playAudioEvent(id);}catch(e){}
}
function bootVoice(kind){
  if(kind==="taunt")playBootEvent("boot_taunt");
  else playBootEvent("boot_hype");
}

function onPress(e){
  if(!S.on)return;
  if(S.phase!=="idle"&&S.phase!=="cine")return;
  if(e&&e.target&&e.target.closest&&e.target.closest("#bootShotSkip"))return;  // 跳过按钮自己处理
  if(e&&e.preventDefault)e.preventDefault();
  if(S.phase==="cine"){
    /* 还在运镜就点了:记下来,并且把时间轴快进到人物起步那一刻 ——
       不让急性子干等空镜,但也不能凭空跳过走位(那会看到人瞬移)。 */
    S.pendingFire=true;
    if(S.cineT<WALK_AT)S.cineT=WALK_AT;
    return;
  }
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

  /* 开场氛围。这些事件现在还没有音频文件,AUDIO_EVENTS 里查不到就 return false,
     是安全的空转 —— 音频到位后只需在 src/audio.js 登记一次就活了。
     清单见 docs/需求迭代/音频配音需求表-v3-情绪重做.md 的 Part B。
     注意 id 必须写成字面量:check.js 靠字面量匹配触发点。 */
  bootVoice(Math.random()<0.5?"taunt":"hype");

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
    playBootEvent("vox_effort");
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
    playBootEvent("crowd_boot_hush");   // 垫在球飞行下面,音量要低于刷网
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
  if(S.cineRaf)cancelAnimationFrame(S.cineRaf);
  removeEventListener("pointerdown",onPress,{capture:true});
  removeEventListener("keydown",onPress,{capture:true});

  /* 刷网必须是听得最清楚的那一下,所以欢呼要晚一拍进来,别盖住它。 */
  if(reason==="made"){
    setTimeout(()=>{playBootEvent("crowd_boot_pop");},150);
    setTimeout(()=>{playBootEvent("boot_reaction");},320);
  }

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
  if(S.cineRaf){cancelAnimationFrame(S.cineRaf);S.cineRaf=0;}
  /* 把镜头还给 updPlayCam,否则回到首页之后没人写 rig,画面会定在过肩机位 */
  try{ctx.G.glideCam=S.savedGlide;ctx.G.moving=false;}catch(e){}
  try{ctx.P.walking=false;}catch(e){}
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
  try{ctx.resetRackBalls();}catch(e){}
  try{if(typeof ctx.applyCamMode==="function")ctx.applyCamMode();}catch(e){}
  /* 开场把人物模型藏起来过(跳过按钮可能在他起步之前就按下)。这里还原成进来之前的值,
     而且必须放在 applyCamMode **之后** —— applyCamMode 按 CAM.mode 和 G.state 推导可见性,
     此刻 G.state 还是 bootshot,它会把刚还原的值又算回 false。 */
  try{if(S.savedBody!==null){ctx.player.g.visible=S.savedBody;S.savedBody=null;}}catch(e){}
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

global.AIBABootShot=Object.freeze({shouldRun,start,skip,resetFirstRun,
  /* t = 运镜真实经过秒数。取景检查台(scripts/boot-shot.frames.mjs)靠它对齐时间轴 ——
     外面用 Date.now() 自己计时会把"页面加载完"当成起点,实测偏了 2.4 秒。 */
  state:()=>({on:S.on,phase:S.phase,t:S.cineT})});
global.skipBootShot=skip;
runtime.register("ui:boot-shot",global.AIBABootShot);
})(window);
