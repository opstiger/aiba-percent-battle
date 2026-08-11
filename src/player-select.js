(function(global){
  "use strict";

  const STORAGE_KEY="aiba_selected_star_v1";
  const RANDOM_LABEL="随机上场";
  let activeMode="contest";
  let pendingId="";

  function esc(v){
    return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function starKey(star){return star&&(star.id||star.n)||"";}
  function allStars(list){
    const custom=global.AIBACustomizer&&typeof global.AIBACustomizer.listStars==="function"?global.AIBACustomizer.listStars():[];
    if(Array.isArray(list)&&list.length)return [...list,...custom.filter(star=>!list.some(item=>starKey(item)===starKey(star)))];
    const cfg=global.AIBA_CONFIG||{},assets=global.AIBA_ASSETS||{};
    return [...(cfg.CLASSIC_LEGENDS||[]),...(assets.coverStars||[]),...custom];
  }
  function profileFor(star){
    const cfg=global.AIBA_CONFIG||{};
    return cfg.shotProfileFor?cfg.shotProfileFor(star):((cfg.SHOT_PROFILES||{})[starKey(star)]||cfg.DEFAULT_SHOT_PROFILE||{speed:1,window:1,label:"标准出手",arcLabel:"标准弧线"});
  }
  function selectedId(){
    try{return localStorage.getItem(STORAGE_KEY)||"";}catch(e){return "";}
  }
  function saveSelectedId(id){
    try{
      if(id)localStorage.setItem(STORAGE_KEY,id);
      else localStorage.removeItem(STORAGE_KEY);
    }catch(e){}
  }
  function findStar(list,id){
    if(!id)return null;
    return allStars(list).find(star=>starKey(star)===id)||null;
  }
  function selectedStar(list,fallback){
    return findStar(list,selectedId())||fallback||null;
  }
  function setMode(mode){
    if(mode==="battle"||mode==="rackrush"||mode==="contest")activeMode=mode;
  }
  function modeArg(){
    return JSON.stringify(activeMode).replace(/"/g,"&quot;");
  }
  function safeArg(v){
    return JSON.stringify(v||"").replace(/"/g,"&quot;");
  }
  function hex(v,fallback){
    const n=Number(v==null?fallback:v);
    return "#"+(Number.isFinite(n)?n:0).toString(16).padStart(6,"0").slice(-6);
  }
  function swatches(star){
    const col=star&&star.col||[0x222222,0xdddddd];
    return `<i style="--c:#${Number(col[0]||0).toString(16).padStart(6,"0")}"></i><i style="--c:#${Number(col[1]||0xffffff).toString(16).padStart(6,"0")}"></i>`;
  }
  function rating(star){
    const r=Math.max(0,Math.min(99,Number(star&&star.r)||88));
    return "★".repeat(Math.round(r/20)).padEnd(5,"☆");
  }
  function profileText(star){
    const p=profileFor(star);
    return `${p.label||"标准出手"} · ${p.arcLabel||"标准弧线"} · 甜区 ${Math.round((p.window||1)*100)}%`;
  }
  function stat(label,value,copy){
    const pct=Math.max(8,Math.min(96,Math.round(value)));
    return `<span><b>${esc(label)}</b><i style="--v:${pct}%"></i><em>${esc(copy)}</em></span>`;
  }
  function cardStyle(star){
    const col=star&&star.col||[0x202832,0x77e7ff],jersey=hex(col[0],0x202832),trim=hex(col[1],0x77e7ff);
    return `--jersey:${jersey};--trim:${trim}`;
  }
  function avatarSlot(id){
    return `<span class="lockerAvatar" data-locker-avatar="${esc(id||"")}"><i>3D</i><b>LOADING</b></span>`;
  }
  function metrics(star){
    const p=profileFor(star);
    return `<div class="lockerMetrics">
      ${stat("出手",((p.speed||1)-.78)*190,p.label||"标准出手")}
      ${stat("弧线",((p.arc||1)-.86)*260,p.arcLabel||"标准弧线")}
      ${stat("甜区",(p.window||1)*74,`窗口 ${Math.round((p.window||1)*100)}%`)}
    </div>`;
  }
  function randomCard(current){
    const star={col:[0x202832,0x77e7ff],num:"?"};
    return `<button class="lockerCard lockerRandom ${current?"":"selected"}" type="button" data-aiba-player="" style="${cardStyle(star)}" onclick="previewAIBAPlayer('')" aria-pressed="${current?"false":"true"}">
      <span class="lockerPlate"><small>LOCKER</small><b>RND</b></span>
      ${avatarSlot("")}
      <span class="lockerCardCopy"><small>EVERY GAME</small><b>${RANDOM_LABEL}</b><em>每局从球星池抽选，保留一点赛前未知感。</em></span>
      <span class="lockerRibbon">SHUFFLE</span>
    </button>`;
  }
  function choiceButton(star,current){
    const id=starKey(star),p=profileFor(star),isOn=id===current;
    return `<button class="lockerCard ${isOn?"selected":""}" type="button" data-aiba-player="${esc(id)}" style="${cardStyle(star)}" onclick="previewAIBAPlayer(${safeArg(id)})" aria-pressed="${isOn}">
      <span class="lockerPlate"><small>${esc((p.label||"SHOOTER").toUpperCase())}</small><b>#${esc(star.num)}</b></span>
      ${avatarSlot(id)}
      <span class="lockerCardCopy"><small>${esc(rating(star))}</small><b>${esc(star.n)}</b><em>${esc(star.t||"街球场走出的方块新星")}</em></span>
      <span class="lockerRibbon">${esc(p.arcLabel||"标准弧线")}</span>
    </button>`;
  }
  function currentMarkup(id){
    const star=findStar(allStars(),id);
    if(!star)return `<div class="lockerCurrentMain"><small>NEXT STARTER</small><b>${RANDOM_LABEL}</b><em>确认后，每局开赛会从完整球员池随机抽一个角色。</em></div>
      <div class="lockerCurrentMeta"><span>未知出手</span><span>未知弧线</span><span>随机甜区</span></div>`;
    const p=profileFor(star);
    return `<div class="lockerCurrentMain"><small>NEXT STARTER</small><b>${esc(star.n)} <i>#${esc(star.num)}</i></b><em>${esc(star.t||"街球场走出的方块新星")}</em></div>
      ${metrics(star)}
      <div class="lockerCurrentMeta"><span>${esc(p.label||"标准出手")}</span><span>${esc(p.arcLabel||"标准弧线")}</span><span>甜区 ${Math.round((p.window||1)*100)}%</span></div>`;
  }
  function stageMarkup(id){
    const star=findStar(allStars(),id);
    return `<div id="lockerStage" class="lockerStage" style="${cardStyle(star)}">
      <div class="lockerStageVisual">${avatarSlot(id||"")}<button class="lockerViewReset" type="button" data-aiba-icon="rotate-ccw" data-aiba-label="重置视角" onclick="event.preventDefault();event.stopPropagation();AIBALockerPreview.reset()" aria-label="重置视角"></button><span>360 FIT CAM</span></div>
      <div id="lockerCurrent" class="lockerStageCurrent">${currentMarkup(id||"")}</div>
    </div>`;
  }
  function setCardState(id){
    const workbench=document.querySelector(".lockerWorkbench"),scrollTop=workbench?workbench.scrollTop:0;
    const cards=[...document.querySelectorAll(".lockerCard[data-aiba-player]")];
    cards.forEach(card=>{
      const on=card.getAttribute("data-aiba-player")===(id||"");
      card.classList.toggle("selected",on);
      card.setAttribute("aria-pressed",on?"true":"false");
    });
    const stage=document.getElementById("lockerStage");
    if(stage)stage.outerHTML=stageMarkup(id||"");
    else{
      const current=document.getElementById("lockerCurrent");
      if(current)current.innerHTML=currentMarkup(id||"");
    }
    hydrateAvatars();
    if(workbench){
      workbench.scrollTop=scrollTop;
      requestAnimationFrame(()=>{workbench.scrollTop=scrollTop;});
    }
  }
  function scrollCardIntoView(id){
    const card=[...document.querySelectorAll(".lockerCard[data-aiba-player]")].find(el=>el.getAttribute("data-aiba-player")===(id||""));
    const deck=card&&card.closest(".lockerDeck");if(!card||!deck)return;
    const left=Math.max(0,card.offsetLeft-(deck.clientWidth-card.offsetWidth)*.5);
    if(deck.scrollTo)deck.scrollTo({left,behavior:"smooth"});
    else deck.scrollLeft=left;
  }
  function hydrateAvatars(){
    const root=document.querySelector(".playerLocker");
    if(!root)return;
    if(global.AIBALockerPreview&&typeof global.AIBALockerPreview.render==="function")global.AIBALockerPreview.render(root);
    else setTimeout(hydrateAvatars,80);
  }
  function selectMarkup(list,mode){
    setMode(mode);
    const stars=allStars(list),current=selectedId(),star=findStar(stars,current);
    const p=star?profileFor(star):null;
    const gear=global.AIBAGear?global.AIBAGear.activeSummary():"";
    const desc=(star?(p.label||"标准出手")+" · "+(p.arcLabel||"标准弧线"):"每局从球星池随机抽选")+(gear?" · "+gear:"");
    return `<button class="playerSelectDock" type="button" onclick="showAIBAPlayerSelect()" aria-label="选择球员">
      <span class="playerSelectBadge">${star?("#"+esc(star.num)):"RND"}</span>
      <span class="playerSelectInfo"><small>PLAYER LOCKER</small><b>${star?esc(star.n):RANDOM_LABEL}</b><em>${esc(desc)}</em></span>
      <span class="playerSelectAction">换球员 ›</span>
    </button>`;
  }
  function showPanelForSelect(mode){
    setMode(mode);
    const stars=allStars(),current=selectedId();
    pendingId=current;
    if(typeof global.showPanel!=="function")return;
    const gearSection=global.AIBAGear?global.AIBAGear.sectionMarkup(findStar(stars,current)):"";
    const motionSection=global.AIBAMotion?global.AIBAMotion.toggleMarkup():"";
    global.showPanel(`<div class="playerLocker">
      <div class="lockerHead"><small>PLAYER LOCKER</small><h1>赛前更衣室</h1><p>横划挑选阵容，当前球员与装备会在试衣镜中实时呈现。</p></div>
      ${stageMarkup(current)}
      <div class="lockerWorkbench">
        <div class="lockerDeck" aria-label="横向选择球员">${global.AIBACustomizer?global.AIBACustomizer.cardMarkup(current):""}${randomCard(current)}${stars.filter(star=>starKey(star)!=="custom-player").map(star=>choiceButton(star,current)).join("")}</div>
        ${gearSection}
        ${motionSection}
      </div>
      <div class="lockerActions">
        <button class="btn" type="button" onclick="confirmAIBAPlayer()">确认上场</button>
        <button class="btn sm" type="button" onclick="goDiff(${modeArg()},true)">返回设置</button>
      </div>
    </div>`);
    const box=document.getElementById("ovBox");
    if(box)box.classList.add("playerLockerBox");
    setTimeout(()=>{scrollCardIntoView(current);hydrateAvatars();},0);
  }
  function preview(id){
    pendingId=id||"";
    setCardState(pendingId);
    scrollCardIntoView(pendingId);
    if(global.AIBAGear)global.AIBAGear.onStarPreview(findStar(allStars(),pendingId));
  }
  function choose(id){
    saveSelectedId(id||"");
    pendingId=id||"";
    if(typeof global.toast==="function")global.toast(id?"球员已锁定":"已切回随机上场",id?"#7CFC6B":"#ffd23f");
  }
  function confirm(){
    choose(pendingId);
    if(typeof global.playSFX==="function")global.playSFX("ui_roster_lock_01");
    if(typeof global.goDiff==="function")global.goDiff(activeMode,true);
  }

  global.AIBASelectedStar=selectedStar;
  global.AIBAPlayerSelectMarkup=selectMarkup;
  global.showAIBAPlayerSelect=showPanelForSelect;
  global.previewAIBAPlayer=preview;
  global.confirmAIBAPlayer=confirm;
  global.chooseAIBAPlayer=choose;
})(window);
