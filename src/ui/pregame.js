(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx||!runtime.service("ui:panels")||!runtime.service("ui:setup"))throw new Error("UI pregame requires panels, setup, and legacy adapter");
  const {
    G,VISION,LEGENDS,TALK_PRE,BATTLE_TARGET,BATTLE_BAR_VISIBLE_SHOTS,passer,player,rivals,
    dressGuy,applyStarStyle,seededRandom,stars,shotProfileFor,shotProfileText,getSharedRackRush
  }=ctx;

  function esc(value){
    return String(value==null?"":value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function translate(value){
    return global.AIBAI18N&&global.AIBAI18N.t?global.AIBAI18N.t(value):value;
  }
  function color(value,fallback){
    const n=Number(value==null?fallback:value);
    return "#"+(Number.isFinite(n)?n:fallback).toString(16).padStart(6,"0").slice(-6);
  }
  function metricValue(value){return Math.max(12,Math.min(99,Math.round(value)));}
  function metricRow(label,myValue,opponentValue){
    const me=metricValue(myValue),opp=metricValue(opponentValue);
    return `<div class="battleMetric">
      <span class="battleMetricSide me"><strong>${me}</strong><i><em style="width:${me}%"></em></i></span>
      <b>${esc(label)}</b>
      <span class="battleMetricSide opp"><i><em style="width:${opp}%"></em></i><strong>${opp}</strong></span>
    </div>`;
  }
  function fighterMarkup(star,role,tag){
    const id=star&&(star.id||star.n)||"",profile=shotProfileFor(star)||{},palette=star&&star.col||[0x263b57,0x77e7ff];
    return `<article class="battleFighter ${role}" style="--team:${color(palette[0],0x263b57)};--trim:${color(palette[1],0x77e7ff)}">
      <small>${tag}</small>
      <span class="lockerAvatar" data-locker-avatar="${esc(id)}"><i>3D</i><b>LOADING</b></span>
      <div class="battleFighterName"><b>${esc(star&&star.n||"PLAYER")}</b><span>#${esc(star&&star.num||"0")}</span></div>
      <em>${esc(profile.label||"标准出手")} · ${esc(profile.arcLabel||"标准弧线")}</em>
    </article>`;
  }

  function pickDiff(key){
    G.diff=key;
    global.resetVisionGesture(VISION.machine);global.cancelVisionOwnedCharge();global.askTiltPerm();
    dressGuy(passer,0x6a727c,0x333a42,"");

    const shared=getSharedRackRush();
    const sharedStar=G.mode==="rackrush"&&shared&&shared.star?LEGENDS.find(star=>(star.id||star.n)===shared.star):null;
    const selectedStar=global.AIBASelectedStar?global.AIBASelectedStar(LEGENDS,null):null;
    G.myStar=selectedStar||sharedStar||LEGENDS[(Math.random()*LEGENDS.length)|0];
    G.myNum=G.myStar.num;
    applyStarStyle(player,G.myStar);

    const pool=LEGENDS.filter(star=>star!==G.myStar).map(star=>({...star}));
    for(let i=pool.length-1;i>0;i--){
      const j=(seededRandom()*(i+1))|0;
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }

    if(G.mode==="rackrush"){
      G.opponents=[];global.showRackRushIntro();return;
    }
    if(G.mode==="battle"){
      G.battleOpp=pool[0];G.opponents=[G.battleOpp];applyStarStyle(rivals[0],G.battleOpp);showBattleIntro();return;
    }

    const count=seededRandom()<.5?2:3;
    G.opponents=pool.slice(0,count);
    G.opponents.forEach((opponent,index)=>applyStarStyle(rivals[index],opponent));
    G.stage="semi";G.stats={best:0,moneyM:0,moneyT:0,deepM:0,deepT:0};G.semiDone=false;G.finalDone=false;

    let html=`<h1 class="title" style="font-size:22px">对位介绍</h1>
      <div class="note">今晚的像素之夜 · ${count+1} 人半决赛 · 前 2 名晋级决赛<br>出手顺序随机抽签 · 对手比赛全程直播</div>`;
    G.opponents.forEach(opponent=>{
      /* 连角括号一起翻。只翻里面那句的话,节点会变成「English」 —— 里面没有汉字了,
         DOM 翻译层不会再回来处理,英文界面上就一直挂着一对中文角括号。
         整句走 t() 才会命中 `「(.+)」` 规则,换成英文的 “ ”。 */
      const rawTalk=TALK_PRE[(Math.random()*TALK_PRE.length)|0],talk=translate("「"+rawTalk+"」");
      html+=`<div class="card"><b>${opponent.n}</b> #${opponent.num} <span style="color:#ffb">${stars(opponent.r)}</span><br>
        <span style="color:#9ab;font-size:11px">三分能力 ${opponent.r}</span><br>
        <span style="color:#ff9d8d;font-size:11px">${talk}</span></div>`;
    });
    html+=`<div class="card" style="border-color:#3a6"><b style="color:#9dff8d">你 (YOU)</b> #${G.myNum} ${stars(G.myStar.r||88)}<br>
      <span style="color:#9ab;font-size:11px">${G.myStar.n} · 三分能力 ${G.myStar.r||88}</span><br>
      <span style="color:#9dff8d;font-size:11px">${shotProfileText(G.myStar)}</span></div>
      <button class="btn green" data-aiba-icon="target" data-aiba-label="热身练习 (3球)" onclick="startPractice()">热身练习 (3球)</button>
      <button class="btn gold" data-aiba-icon="play" data-aiba-label="直接开赛 →" onclick="hidePanel();beginStage()">直接开赛 →</button>`;
    global.showPanel(html);
  }

  function showBattleIntro(){
    const opponent=G.battleOpp,rawTalk=TALK_PRE[(Math.random()*TALK_PRE.length)|0],talk=translate(rawTalk);
    const myProfile=shotProfileFor(G.myStar)||{},opponentProfile=shotProfileFor(opponent)||{};
    global.showPanel(`<section class="battleIntro">
      <header class="battleIntroHead"><small>PERCENT BATTLE · MATCHUP</small><h1>先到 ${BATTLE_TARGET} 分获胜</h1></header>
      <div class="battleLineup">
        ${fighterMarkup(G.myStar,"me","YOU")}
        <div class="battleVs"><b>VS</b><span>FIRST TO<br>${BATTLE_TARGET}</span></div>
        ${fighterMarkup(opponent,"opp","RIVAL")}
      </div>
      <div class="battleMetrics">
        ${metricRow("三分能力",G.myStar.r||88,opponent.r||88)}
        ${metricRow("投速",(myProfile.speed||1)*86,(opponentProfile.speed||1)*86)}
        ${metricRow("甜区",(myProfile.window||1)*82,(opponentProfile.window||1)*82)}
      </div>
      <div class="battleRuleChips"><span>常规点 <b>3</b></span><span>彩球点 <b>5</b></span><span>中场 <b>10</b></span><span>篮球可碰撞</span></div>
      <details class="battleRules"><summary>查看完整规则</summary><div>
        <p>两人同时开投，率先达到 ${BATTLE_TARGET} 分获胜。</p>
        <p>点击场上光圈切换投篮点；普通点和彩球点用完后需要恢复。</p>
        <p>${G.diff==="easy"?"前 70% 显示投篮条，最后 30% 靠手感。":`前 ${BATTLE_BAR_VISIBLE_SHOTS} 球显示投篮条，之后靠手感出手。`}</p>
        <p>对手与你同场竞投，空中的篮球可能碰撞改变结果。</p>
      </div></details>
      <div class="battleTalk">“${esc(talk)}”</div>
      <button class="btn gold battleStart" onclick="ensureAudio(false,true);startBattle()">开战!</button>
    </section>`);
    const box=document.getElementById("ovBox");if(box)box.classList.add("battleIntroBox");
    setTimeout(()=>{
      const root=document.querySelector(".battleIntro");
      if(root&&global.AIBALockerPreview)global.AIBALockerPreview.render(root);
    },0);
  }

  const api=Object.freeze({pickDiff,showBattleIntro});
  Object.assign(global,api);runtime.register("ui:pregame",api);
})(window);
