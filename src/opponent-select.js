/* 对手选择：难度页里在"换球员"下面多一条"换对手"。
   只有带球星对手的两个模式有这一项——三分大赛（每局 2~3 名对手，最多指定 3 名）、百分大战（1v1，指定 1 名）。
   投篮机挑战、练习是单人；绝杀时刻的队友 / 防守人是固定配色的方块演员，不是球星。
   没指定满的位置照旧从球星池随机补位；指定了和自己同一个人时，开赛那一刻自动换成随机对手。
   选择按模式分开存 localStorage，抽签本身（seededRandom 的消耗次数）不变，同种子同结果仍然成立。 */
(function(global){
  "use strict";

  const STORAGE_KEY="aiba_opponents_v1";
  const SLOTS=Object.freeze({contest:3,battle:1});
  const RANDOM_LABEL="随机对手";
  let mode="contest";
  let pending=[];

  function esc(v){
    return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function starKey(star){return star&&(star.id||star.n)||"";}
  function hex(v,fallback){
    const n=Number(v==null?fallback:v);
    return "#"+(Number.isFinite(n)?n:0).toString(16).padStart(6,"0").slice(-6);
  }
  function safeArg(v){return JSON.stringify(v||"").replace(/"/g,"&quot;");}
  /* 对手池 = 开赛时 pregame 用的 LEGENDS（经典球星 + 封面球星），不含自定义球员 */
  function pool(){
    const cfg=global.AIBA_CONFIG||{},assets=global.AIBA_ASSETS||{};
    return [...(cfg.CLASSIC_LEGENDS||[]),...(assets.coverStars||[])];
  }
  function findStar(list,id){return list.find(star=>starKey(star)===id)||null;}
  function load(){
    try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return v&&typeof v==="object"?v:{};}catch(e){return {};}
  }
  function saved(m){
    const ids=load()[m],list=pool();
    if(!Array.isArray(ids))return [];
    return ids.filter((id,i)=>findStar(list,id)&&ids.indexOf(id)===i).slice(0,SLOTS[m]||0);
  }
  function save(m,ids){
    try{const all=load();if(ids.length)all[m]=ids;else delete all[m];localStorage.setItem(STORAGE_KEY,JSON.stringify(all));}catch(e){}
  }
  function supports(m){return Object.prototype.hasOwnProperty.call(SLOTS,m);}
  function myLockedId(){
    const me=global.AIBASelectedStar?global.AIBASelectedStar(null,null):null;
    return starKey(me);
  }

  /* pregame 开赛时调：按指定顺序返回对手（list 里的对象），跳过和自己相同的人 */
  function picks(m,list,me){
    if(!supports(m))return [];
    const myKey=starKey(me);
    return saved(m).filter(id=>id!==myKey).map(id=>findStar(list,id)).filter(Boolean);
  }

  function dockMarkup(m){
    if(!supports(m))return "";
    mode=m;
    const list=pool(),max=SLOTS[m],names=saved(m).map(id=>findStar(list,id).n);
    const desc=!names.length?(m==="battle"?"每局从球星池随机抽一位对手":"每局随机抽 2~3 名对手")
      :m==="battle"?"已指定 1v1 对手"
      :names.length<max?`已指定 ${names.length} 名 · 其余随机补位`:"已指定 3 名对手";
    return `<button class="playerSelectDock opponentSelectDock" type="button" onclick="showAIBAOpponentSelect()" aria-label="选择对手">
      <span class="playerSelectBadge">${names.length?"VS":"RND"}</span>
      <span class="playerSelectInfo"><small>OPPONENTS</small><b>${esc(names.length?names.join(" · "):RANDOM_LABEL)}</b><em>${esc(desc)}</em></span>
      <span class="playerSelectAction">换对手 ›</span>
    </button>`;
  }

  function slotsMarkup(){
    const list=pool(),max=SLOTS[mode];let html="";
    for(let i=0;i<max;i++){
      const star=pending[i]?findStar(list,pending[i]):null;
      html+=`<span class="oppSlot ${star?"on":""}"><small>${max>1?"对手 "+(i+1):"对手"}</small><b>${esc(star?star.n:"随机")}</b></span>`;
    }
    return html;
  }
  function cardMarkup(star,myId){
    const id=starKey(star),order=pending.indexOf(id),mine=id===myId,col=star.col||[0x202832,0x77e7ff];
    const cfg=global.AIBA_CONFIG||{},p=cfg.shotProfileFor?cfg.shotProfileFor(star):{};
    return `<button class="oppCard ${order>=0?"on":""} ${mine?"mine":""}" type="button" data-opp="${esc(id)}" style="--jersey:${hex(col[0],0x202832)};--trim:${hex(col[1],0x77e7ff)}"
      onclick="toggleAIBAOpponent(${safeArg(id)})" ${mine?"disabled":""} aria-pressed="${order>=0}">
      <i class="oppOrder">${order>=0?(SLOTS[mode]>1?order+1:"VS"):""}</i>
      <small>#${esc(star.num)} · 三分 ${esc(star.r||88)}</small>
      <b>${esc(star.n)}</b>
      <em>${mine?"你的球员":esc(p.label||"标准出手")}</em>
    </button>`;
  }
  function sync(){
    const myId=myLockedId(),max=SLOTS[mode];
    document.querySelectorAll(".oppCard[data-opp]").forEach(card=>{
      const id=card.getAttribute("data-opp"),order=pending.indexOf(id),on=order>=0;
      card.classList.toggle("on",on);card.setAttribute("aria-pressed",on?"true":"false");
      const badge=card.querySelector(".oppOrder");if(badge)badge.textContent=on?(max>1?String(order+1):"VS"):"";
      card.disabled=id===myId;
    });
    const slots=document.getElementById("oppSlots");if(slots)slots.innerHTML=slotsMarkup();
  }

  function show(m){
    if(supports(m))mode=m;
    pending=saved(mode);
    if(typeof global.showPanel!=="function")return;
    const myId=myLockedId(),max=SLOTS[mode];
    const sub=mode==="battle"?"百分大战 · 选 1 名对手，和你同场竞投":"三分大赛 · 最多选 3 名，没选满的位置随机补位";
    global.showPanel(`<div class="opponentPicker">
      <div class="oppHead"><small>OPPONENTS</small><h1>选择对手</h1><p>${sub}</p></div>
      <div id="oppSlots" class="oppSlots" style="--n:${max}">${slotsMarkup()}</div>
      <div class="oppGrid">${pool().map(star=>cardMarkup(star,myId)).join("")}</div>
      <div class="oppActions">
        <button class="btn" type="button" onclick="confirmAIBAOpponents()">确认对手</button>
        <button class="btn sm" type="button" onclick="clearAIBAOpponents()">全部随机</button>
        <button class="btn sm" type="button" onclick="goDiff(${safeArg(mode)},true)">返回设置</button>
      </div>
    </div>`);
    const box=document.getElementById("ovBox");if(box)box.classList.add("opponentPickerBox");
  }
  function toggle(id){
    if(!id||id===myLockedId())return;
    const max=SLOTS[mode],i=pending.indexOf(id);
    if(i>=0)pending.splice(i,1);
    else if(max===1)pending=[id];
    else if(pending.length<max)pending.push(id);
    else{if(typeof global.toast==="function")global.toast("最多指定 3 名对手","#ffd23f");return;}
    if(typeof global.playSFX==="function")global.playSFX("ui_roster_lock_01",.5);
    sync();
  }
  function clear(){pending=[];sync();}
  function confirm(){
    save(mode,pending.slice());
    if(typeof global.toast==="function")global.toast(pending.length?"对手已锁定":"已切回随机对手",pending.length?"#ff8a6b":"#ffd23f");
    if(typeof global.goDiff==="function")global.goDiff(mode,true);
  }

  const api=Object.freeze({picks,saved,supports,dockMarkup,show});
  global.AIBAOpponentSelect=api;
  global.AIBAOpponentSelectMarkup=dockMarkup;
  global.showAIBAOpponentSelect=show;
  global.toggleAIBAOpponent=toggle;
  global.clearAIBAOpponents=clear;
  global.confirmAIBAOpponents=confirm;
})(window);
