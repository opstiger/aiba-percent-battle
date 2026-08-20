/* 体感控制「影子投篮排练」互动教学
   - 首次点开体感:先弹预告卡(隐私说明+动作预览),确认后才申请摄像头
   - 授权成功后、上场前:全屏放大摄像头画面,用真实手势走完
     双手入框 → 锁定 → 举高蓄力 → 越线出手 四步,完成 2 次有效出手才出师
   - 实战兜底:开赛 8 秒手势没启动,浮出大字提示(仅一次)
   识别层零改动:只订阅 VISION.machine 状态渲染教学 UI。 */
(function(global){
  "use strict";
  const KEY="aiba_vision_tut_v1";
  const GG=()=>{try{return typeof G==="undefined"?null:G;}catch(e){return null;}};
  const VV=()=>{try{return typeof VISION==="undefined"?null:VISION;}catch(e){return null;}};
  let seen={};
  try{seen=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){}
  function mark(k){seen[k]=1;try{localStorage.setItem(KEY,JSON.stringify(seen));}catch(e){}}

  let overlay=null,raf=0,stepIdx=0,reps=0,lastPhase="idle",stepEnterAt=0,startAt=0,closed=false;
  const STEPS=[
    {t:"双手放进下方蓝框",tip:"整个上半身入画,双手自然放在胸前下方区域"},
    {t:"保持别动 · 锁定",tip:"稳住半秒,锁定环走满就进入蓄力"},
    {t:"像投篮一样举高蓄力",tip:"双手匀速上举,力量条跟着涨"},
    {t:"手越过白线——出手!",tip:"越线即出手 · 力量停在 55%-90% 算好球"}
  ];

  /* ---------- 预告卡(授权前) ---------- */
  const origEnable=global.enableVisionControl;
  global.enableVisionControl=function(ev){
    if(!seen.intro&&typeof origEnable==="function"){
      showIntro(ev);
      return;
    }
    return typeof origEnable==="function"?origEnable(ev):undefined;
  };
  function showIntro(ev){
    if(document.getElementById("vtIntro"))return;
    const el=document.createElement("div");
    el.id="vtIntro";
    el.innerHTML='<div class="obCard">'+
      "<small>MOTION CONTROL</small><h1>🎥 用身体投篮</h1>"+
      '<div class="obSteps"><span><b>1</b><i>🙌</i>双手入框锁定</span><span><b>2</b><i>💪</i>举高蓄力</span><span><b>3</b><i>🏀</i>越线出手</span></div>'+
      '<p class="vtPriv">🔒 摄像头画面只在本机识别姿态,不上传、不存储。</p>'+
      '<button class="obBtn gold" id="vtGo">开启摄像头,进入真实球场</button>'+
      '<button class="obBtn" id="vtNo">还是用触屏</button></div>';
    document.body.appendChild(el);
    document.getElementById("vtGo").onclick=()=>{
      mark("intro");el.remove();
      try{
        const enabled=typeof origEnable==="function"?origEnable(ev):null;
        Promise.resolve(enabled).then(()=>{
          const V=VV();
          if(V&&V.enabled&&global.AIBAInteractiveTutorial)global.AIBAInteractiveTutorial.start({skipVisionIntro:true});
        });
      }catch(e){}
    };
    document.getElementById("vtNo").onclick=()=>{el.remove();};
  }

  /* ---------- 影子排练 ---------- */
  function start(force){
    if(overlay)return;
    if(!force&&seen.done)return;
    /* 引导要教的就是怎么看预览,折叠着没法教 —— 先展开。
       (interactive-tutorial 走的是 dataset.tutorial,由 vision.js 自动强制展开;
        这条路径没有那个标记,所以显式展开一次。) */
    if(typeof global.setVisionFold==="function")try{global.setVisionFold(false);}catch(e){}
    if(typeof global.hidePanel==="function"&&force)try{hidePanel();}catch(e){}
    closed=false;stepIdx=0;reps=0;lastPhase="idle";startAt=Date.now();stepEnterAt=Date.now();
    overlay=document.createElement("div");
    overlay.id="vtOverlay";
    overlay.innerHTML=
      '<div class="vtHead"><span>影子投篮排练 · SHADOW SHOT</span><button id="vtSkip" type="button">跳过 ≫</button></div>'+
      '<div class="vtStepsBar">'+STEPS.map((s,i)=>'<i id="vtS'+i+'"></i>').join("")+"</div>"+
      '<canvas id="vtCanvas"></canvas>'+
      '<div class="vtPower"><i id="vtPowerFill"></i><em></em></div>'+
      '<div class="vtStatus"><b id="vtTitle"></b><span id="vtTip"></span><span id="vtReps"></span></div>';
    document.body.appendChild(overlay);
    document.getElementById("vtSkip").onclick=()=>finish(false);
    loop();
  }
  function finish(completed){
    closed=true;cancelAnimationFrame(raf);
    if(!overlay)return;
    if(completed){
      overlay.innerHTML='<div class="obCard"><small>REHEARSAL CLEAR</small><h1>🎉 出师了!</h1>'+
        "<p class='vtPriv'>动作已经完全掌握,上场就是这套流程。</p>"+
        '<button class="obBtn gold" id="vtDone">开打!</button></div>';
      document.getElementById("vtDone").onclick=()=>{overlay.remove();overlay=null;};
    }else{overlay.remove();overlay=null;}
    mark("done");
  }
  function setStep(i){
    if(i!==stepIdx)stepEnterAt=Date.now();
    stepIdx=i;
  }
  function loop(){
    if(closed||!overlay)return;
    raf=requestAnimationFrame(loop);
    const V=VV(),m=V&&V.machine;
    const video=document.getElementById("visionVideo");
    const cv=document.getElementById("vtCanvas");
    if(!m||!cv)return;
    // ---- 画面:镜像视频 + 骨架 + 引导区域 ----
    const ctx=cv.getContext("2d");
    const W=cv.width=cv.clientWidth*(devicePixelRatio||1);
    const H=cv.height=cv.clientHeight*(devicePixelRatio||1);
    ctx.clearRect(0,0,W,H);
    ctx.save();ctx.scale(-1,1);ctx.translate(-W,0);
    if(video&&video.videoWidth){
      const vr=video.videoWidth/video.videoHeight,cr=W/H;
      let dw=W,dh=H,dx=0,dy=0;
      if(vr>cr){dh=H;dw=H*vr;dx=(W-dw)/2;}else{dw=W;dh=W/vr;dy=(H-dh)/2;}
      ctx.drawImage(video,dx,dy,dw,dh);
      const skel=document.getElementById("visionCanvas");
      if(skel&&skel.width)ctx.drawImage(skel,dx,dy,dw,dh);
    }
    ctx.restore();
    // 蓄力框(下方)
    const armed=m.phase==="armed"||m.phase==="charging";
    ctx.strokeStyle=armed?"#7CFC6B":"#70e8ff";
    ctx.setLineDash(armed?[]:[12,9]);ctx.lineWidth=4;
    ctx.strokeRect(W*0.08,H*0.6,W*0.84,H*0.32);
    // 出手线(上方)
    const lineY=(m.releaseLineY||0.32)*H;
    ctx.strokeStyle=m.phase==="charging"?"#fff":"rgba(255,255,255,0.55)";
    ctx.setLineDash(m.phase==="charging"?[]:[14,10]);ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,lineY);ctx.lineTo(W,lineY);ctx.stroke();
    ctx.setLineDash([]);
    // ---- 状态机 → 步骤 ----
    const phase=m.phase;
    if(phase==="armed"&&stepIdx<1)setStep(1);
    if(phase==="charging"&&stepIdx<2)setStep(2);
    if(phase==="charging"&&(m.power||0)>18&&stepIdx<3)setStep(3);
    if(phase==="release"&&lastPhase!=="release"){
      const p=m.power||0;
      if(p>=55&&p<=92){reps++;flashMsg("✅ 好球! 力量 "+Math.round(p)+"%");}
      else flashMsg("再来 · 力量 "+Math.round(p)+"%,越线前控制在 55-90%");
      if(reps>=2){finish(true);return;}
      setStep(0);
    }
    if((phase==="idle"||phase==="cooldown")&&stepIdx>0&&lastPhase!=="release"&&phase!==lastPhase)setStep(0);
    lastPhase=phase;
    // ---- UI 文案 ----
    const title=document.getElementById("vtTitle"),tipEl=document.getElementById("vtTip"),repsEl=document.getElementById("vtReps");
    if(title)title.textContent=STEPS[stepIdx].t;
    if(tipEl&&!tipEl.dataset.flash)tipEl.textContent=STEPS[stepIdx].tip;
    if(repsEl)repsEl.textContent="有效出手 "+reps+" / 2";
    STEPS.forEach((s,i)=>{
      const dot=document.getElementById("vtS"+i);
      if(dot)dot.className=i<stepIdx?"ok":(i===stepIdx?"cur":"");
    });
    const fill=document.getElementById("vtPowerFill");
    if(fill)fill.style.width=(phase==="charging"?Math.min(100,m.power||0):0)+"%";
    // ---- 卡住提示 / 超时降级 ----
    const stuck=Date.now()-stepEnterAt;
    if(stuck>20000&&tipEl&&!tipEl.dataset.flash){
      tipEl.textContent=stepIdx===0?"往后站一点,让整个上半身进入画面":STEPS[stepIdx].tip+"(动作可以慢一点)";
    }
    if(Date.now()-startAt>60000){
      finish(false);
      if(typeof global.toast==="function")toast("体感随时可在难度页再开,先用触屏热热手","#9fd1ff");
    }
  }
  let flashTimer=0;
  function flashMsg(text){
    const tipEl=document.getElementById("vtTip");
    if(!tipEl)return;
    tipEl.textContent=text;tipEl.dataset.flash="1";
    clearTimeout(flashTimer);
    flashTimer=setTimeout(()=>{delete tipEl.dataset.flash;},1600);
  }

  /* ---------- 触发:授权成功后自动进入排练(仅设置阶段) ---------- */
  let coachShownAt=0;
  setInterval(()=>{
    const V=VV(),G=GG();
    if(global.AIBAInteractiveTutorial&&global.AIBAInteractiveTutorial.prefersCourtTutorial)return;
    if(!V||!G)return;
    if(V.enabled&&!seen.done&&!overlay&&(G.state==="diff"||G.state==="menu")){
      const p=document.getElementById("visionPreview");
      if(p&&p.offsetWidth>4)start();
    }
    // 实战兜底:开赛后手势 8 秒没进入 armed,大字提示一次
    if(!seen.coach&&V.enabled&&V.liveControl&&G.canShoot&&/^(round|tiebreak|battle|rackrush)$/.test(G.state)){
      if(!coachShownAt)coachShownAt=Date.now();
      const idle=V.machine&&(V.machine.phase==="idle");
      if(idle&&Date.now()-coachShownAt>8000){
        mark("coach");
        if(typeof global.toast==="function")toast("🙌 双手放进预览窗下方蓝框,启动体感出手","#ffd23f");
      }
      if(!idle)mark("coach");
    }
  },400);

  global.AIBAVisionTutorial={start:function(force){
    if(global.AIBAInteractiveTutorial&&global.AIBAInteractiveTutorial.prefersCourtTutorial){
      return global.AIBAInteractiveTutorial.start({force:!!force});
    }
    return start(force);
  }};
})(window);
