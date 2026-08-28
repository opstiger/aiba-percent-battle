/* ---------------- 结果留白 ----------------
   事件出结果和进结算面板之间必须留一段可感知的停顿:蜂鸣器响完、观众反应完、
   球员的庆祝或懊恼做完,玩家才反应过来"我到底打了多少分"。
   结果那一帧就把 HUD 收掉、镜头切回、面板盖上 —— 那是程序在切状态,不是比赛在收尾。

   现状(审计过):
     · 绝杀时刻   —— 早就有这一层(RESULT_REACTION_SECONDS=5.8)
     · 百分大战   —— 胜负都走 4 段胜利运镜
     · 投篮机通关 —— 4.4s 胜利运镜
     · 投篮机失败 —— 0 秒直接弹面板   ← 而没通关才是常态
     · 三分大赛   —— 胜负都是 0 秒     ←
   这里把缺的那一层补成通用件,任何模式都能调。

   两条硬约束:
     1. onDone 必须**恰好**执行一次。留白只是演出,演出出任何岔子都不能把玩家卡在
        没有面板、也没有 HUD 的中间态 —— 所以有超时兜底,且用 done 标志去重。
     2. 随时可跳过。第二次看同一段演出的人不该被按住。 */
(function(global){
  "use strict";

  const S={on:false,timer:0,failsafe:0,done:null,el:null};

  function layer(){
    if(S.el&&S.el.isConnected)return S.el;
    const el=document.createElement("div");
    el.id="resultBeat";
    el.innerHTML='<div class="rbInner"><small></small><b></b><em></em></div>';
    document.body.appendChild(el);
    S.el=el;return el;
  }
  function bars(on){
    const t=document.getElementById("lbT"),b=document.getElementById("lbB");
    if(t)t.style.height=on?"8vh":"0";
    if(b)b.style.height=on?"8vh":"0";
  }
  function finish(){
    if(!S.on)return;
    S.on=false;
    clearTimeout(S.timer);clearTimeout(S.failsafe);
    removeEventListener("pointerdown",skip,{capture:true});
    removeEventListener("keydown",skip,{capture:true});
    bars(false);
    const el=S.el;if(el)el.classList.remove("on");
    const cb=S.done;S.done=null;
    if(cb)try{cb();}catch(e){}
  }
  function skip(e){
    if(!S.on)return;
    if(e&&e.preventDefault)e.preventDefault();
    finish();
  }

  /* opts: {eyebrow, score, unit, note, tone:"good"|"flat"|"bad", seconds, onDone} */
  function play(opts){
    opts=opts||{};
    /* 上一段还没收尾就又来一段:先把上一段收干净(它的 onDone 会被执行),
       否则两段的定时器会互相踩,面板可能弹两次或者一次都不弹。 */
    if(S.on)finish();
    const secs=Math.max(0.8,Math.min(8,opts.seconds||3.2));
    S.on=true;S.done=typeof opts.onDone==="function"?opts.onDone:null;

    const el=layer();
    el.dataset.tone=opts.tone||"flat";
    el.querySelector("small").textContent=opts.eyebrow||"";
    el.querySelector("b").innerHTML=(opts.score==null?"":String(opts.score))+
      (opts.unit?'<i>'+opts.unit+'</i>':"");
    el.querySelector("em").textContent=opts.note||"";
    // 先移除再加,保证重复调用时入场动画会重新播
    el.classList.remove("on");void el.offsetWidth;el.classList.add("on");
    bars(true);

    addEventListener("pointerdown",skip,{capture:true});
    addEventListener("keydown",skip,{capture:true});
    S.timer=setTimeout(finish,secs*1000);
    /* 兜底:万一上面那个定时器被页面挂起/清掉,也一定要把玩家送进结算。 */
    S.failsafe=setTimeout(finish,secs*1000+4000);
    return true;
  }

  global.AIBAResultBeat=Object.freeze({play,skip:finish,active:()=>S.on});
})(window);
