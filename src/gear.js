/* ---------------- gear loadout + player stats + stamina ---------------- */
(function(global){
  "use strict";

  const LS_KEY="aiba_gear_v1";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  /* 数值口径：speed/aim 是乘区(1+amt)，clutch 只在关键时刻乘到甜区，
     stamina 抬精力上限，cost 降蓄力+出手的精力消耗，recovery 加快恢复 */
  const SLOTS=[
    {id:"shoes",name:"球鞋",en:"SHOES"},
    {id:"sleeve",name:"护腕护肘",en:"SLEEVE"},
    {id:"band",name:"头部装扮",en:"HEAD"}
  ];
  const CATALOG={
    shoes:[
      {id:"shoes-blaze",name:"疾风橙",color:"#e8771e",stat:"speed",amt:.12,desc:"投射蓄力 +12%"},
      {id:"shoes-anchor",name:"稳踏青",color:"#7ee7ff",stat:"aim",amt:.12,desc:"准星甜区 +12%"},
      {id:"shoes-marathon",name:"长跑灰",color:"#9aa7b8",stat:"stamina",amt:.25,desc:"精力上限 +25%"},
      {id:"shoes-spring",name:"回弹紫",color:"#b07ff2",stat:"recovery",amt:.35,desc:"精力恢复 +35%"}
    ],
    sleeve:[
      {id:"sleeve-steady",name:"稳定白",color:"#f2f5fa",stat:"aim",amt:.1,desc:"准星甜区 +10%"},
      {id:"sleeve-ice",name:"冷血黑",color:"#252a36",stat:"clutch",amt:.25,desc:"关键时刻准星 +25%"},
      {id:"sleeve-snap",name:"快弹红",color:"#e03a3e",stat:"speed",amt:.08,desc:"投射蓄力 +8%"},
      {id:"sleeve-saver",name:"节能蓝",color:"#4aa3ff",stat:"cost",amt:.2,desc:"精力消耗 -20%"}
    ],
    band:[
      {id:"band-gold",name:"冷静金",color:"#ffd23f",stat:"clutch",amt:.2,desc:"关键时刻准星 +20%"},
      {id:"band-focus",name:"专注青",color:"#7ee7ff",stat:"aim",amt:.08,desc:"准星甜区 +8%"},
      {id:"band-iron",name:"铁人绿",color:"#69d98c",stat:"stamina",amt:.2,desc:"精力上限 +20%"},
      {id:"band-volt",name:"闪电黄",color:"#f2ef6a",stat:"speed",amt:.1,desc:"投射蓄力 +10%"},
      {id:"head-mask",name:"黑面具",color:"#252a36",mods:{clutch:.22,speed:-.05},desc:"关键准星 +22% / 投速 -5%"},
      {id:"head-cap",name:"棒球帽",color:"#7ee7ff",mods:{stamina:.18,aim:-.04},desc:"精力上限 +18% / 准星 -4%"},
      {id:"head-shades",name:"太阳镜",color:"#111111",mods:{aim:.12,clutch:-.06},desc:"准星 +12% / 关键 -6%"},
      {id:"head-hoodie",name:"连帽衫",color:"#9aa7b8",mods:{recovery:.32,speed:-.08},desc:"恢复 +32% / 投速 -8%"},
      {id:"head-weird",name:"奇葩头套",color:"#ff8df0",mods:{speed:.14,aim:-.08},desc:"投速 +14% / 准星 -8%"}
    ]
  };
  const STAT_NAMES={speed:"投速",aim:"准星",clutch:"关键",stamina:"精力",recovery:"回复",cost:"节能"};

  /* 精力模型：蓄力持续掉，出手一次性掉；连续出手期间不回复，
     停手 REGEN_DELAY 秒后才开始快速恢复（=必须真的休息一下）。
     快节奏约 10-12 连投见底，力竭后回到 28% 解锁 */
  const STA_BASE=100,CHARGE_DRAIN=5.5,SHOT_COST=6.5,REGEN=14,REGEN_DELAY=.9,WAKE_RATIO=.28,TIRED_RATIO=.25;

  let load={shoes:"",sleeve:"",band:"",active:""};
  try{
    const raw=JSON.parse(localStorage.getItem(LS_KEY)||"{}");
    for(const s of SLOTS)if(typeof raw[s.id]==="string"&&CATALOG[s.id].some(i=>i.id===raw[s.id]))load[s.id]=raw[s.id];
    if(typeof raw.active==="string"&&load[raw.active])load.active=raw.active;
  }catch(e){}
  function save(){try{localStorage.setItem(LS_KEY,JSON.stringify(load));}catch(e){}}

  function itemOf(slot){return (CATALOG[slot]||[]).find(i=>i.id===load[slot])||null;}
  function activeItem(){return load.active?itemOf(load.active):null;}
  function activeSummary(){
    const it=activeItem();
    return it?it.name+" · "+it.desc:"";
  }
  function mods(){
    const m={speed:1,aim:1,clutch:0,staminaMax:1,cost:1,recovery:1};
    const it=activeItem();
    if(!it)return m;
    if(it.mods){
      if(it.mods.speed)m.speed+=it.mods.speed;
      if(it.mods.aim)m.aim+=it.mods.aim;
      if(it.mods.clutch)m.clutch+=it.mods.clutch;
      if(it.mods.stamina)m.staminaMax+=it.mods.stamina;
      if(it.mods.cost)m.cost+=it.mods.cost;
      if(it.mods.recovery)m.recovery+=it.mods.recovery;
      m.speed=Math.max(.7,m.speed);
      m.aim=Math.max(.72,m.aim);
      m.cost=Math.max(.55,m.cost);
      return m;
    }
    if(it.stat==="speed")m.speed+=it.amt;
    else if(it.stat==="aim")m.aim+=it.amt;
    else if(it.stat==="clutch")m.clutch=it.amt;
    else if(it.stat==="stamina")m.staminaMax+=it.amt;
    else if(it.stat==="cost")m.cost-=it.amt;
    else if(it.stat==="recovery")m.recovery+=it.amt;
    return m;
  }

  /* ---------------- 关键时刻判定 ---------------- */
  function gameRef(){return typeof G==="undefined"?null:G;}
  /* lastshot 必须算在内。漏掉它会造成两个看不见的问题:
     ① 精力不重置 —— 打完百分大战力竭(v=0)直接进绝杀,fatigueFactor 还按 0.85 算,
        甜区实测从 5.5 掉到 4.675(-15%),而绝杀模式没有精力条,玩家完全看不出来,
        且 regen 也只在 playing 时跑,等于永远缓不过来。这是每日挑战 + 排行榜模式,
        不能带着上一局的疲劳去打。
     ② clutchActive 为 false —— 三件"关键时刻准星"装备在全游戏最关键的一投上失效。 */
  function playing(g){return !!g&&(g.state==="round"||g.state==="tiebreak"||g.state==="battle"||g.state==="rackrush"||g.state==="lastshot");}
  function clutchActive(){
    const g=gameRef();if(!g||!playing(g))return false;
    /* 绝杀时刻整个模式就是关键时刻,不能靠 g.timer 判断 —— 它用的是自己的比赛钟,
       G.timer 是上一个模式留下的旧值。 */
    if(g.state==="lastshot")return true;
    if(g.state==="tiebreak")return true;
    if(g.mode==="battle")return Math.max(g.score||0,g.battleOppScore||0)>=85;
    return !!g.running&&g.timer<=10;
  }

  /* ---------------- 精力引擎 ---------------- */
  const STA={v:STA_BASE,max:STA_BASE,out:false,was:false,lastT:0,toastAt:0,lastUseAt:0};
  const MET={lowMs:0,outCount:0};
  const staProj=()=>new THREE.Vector3();
  let staV=null;
  function staminaRatio(){return STA.max?STA.v/STA.max:1;}
  function fatigueFactor(){
    const r=staminaRatio();
    return r>=TIRED_RATIO?1:.85+.6*r;
  }
  function toastSafe(msg,col){if(typeof global.toast==="function")global.toast(msg,col);}
  function toastThrottled(msg,col){
    const now=performance.now();
    if(now-STA.toastAt<1600)return;
    STA.toastAt=now;toastSafe(msg,col);
  }
  function announceGear(){
    const it=activeItem();
    if(it)setTimeout(()=>toastSafe(it.name+" · 生效 · "+it.desc,it.color),700);
  }

  /* ---------------- HUD ---------------- */
  let hud=null,hudShown=false,hudPct=-1,hudState="",hudChip="";
  function ensureHud(){
    if(hud)return hud;
    hud=document.createElement("div");
    hud.id="staminaWrap";
    hud.innerHTML='<svg class="staRing" viewBox="0 0 64 64" aria-hidden="true"><circle class="staTrack" cx="32" cy="32" r="25" pathLength="100"/><circle id="staArc" class="staArc" cx="32" cy="32" r="25" pathLength="100"/></svg><small>精力 STAMINA</small><div class="staBar"><i id="staFill"></i></div><b id="staChip"></b>';
    document.body.appendChild(hud);
    return hud;
  }
  function positionHud(el,show){
    if(!show)return;
    const firstPerson=typeof CAM!=="undefined"&&CAM.mode===0;
    el.classList.toggle("fp",firstPerson);
    if(firstPerson){
      el.style.left="50%";el.style.top="";el.style.bottom="calc(18px + env(safe-area-inset-bottom,0px))";
      el.style.transform="translateX(-50%)";
      return;
    }
    if(typeof camera==="undefined"||typeof P==="undefined"||typeof THREE==="undefined"){
      el.style.left="10px";el.style.top="";el.style.bottom="calc(12px + env(safe-area-inset-bottom,0px))";
      el.style.transform="none";
      return;
    }
    staV=staV||staProj();
    staV.set(P.pos.x,0.03,P.pos.z).project(camera);
    if(!Number.isFinite(staV.x)||!Number.isFinite(staV.y)||staV.z>1){
      el.classList.add("offscreen");
      return;
    }
    el.classList.remove("offscreen");
    const x=(staV.x*.5+.5)*innerWidth;
    const y=(-staV.y*.5+.5)*innerHeight;
    const scale=clamp(1.04-staV.z*.18,.76,1.02);
    el.style.left=Math.max(38,Math.min(innerWidth-38,x))+"px";
    el.style.top=Math.max(44,Math.min(innerHeight-24,y+6))+"px";
    el.style.bottom="";
    el.style.transform="translate(-50%,-50%) scale("+scale.toFixed(2)+")";
  }
  function updateHud(show){
    const el=ensureHud();
    if(show!==hudShown){hudShown=show;el.classList.toggle("on",show);}
    if(!show)return;
    positionHud(el,show);
    const pct=Math.round(staminaRatio()*100);
    if(pct!==hudPct){
      hudPct=pct;
      const f=document.getElementById("staFill");if(f)f.style.width=pct+"%";
      const arc=document.getElementById("staArc");if(arc)arc.style.strokeDasharray=pct+" 100";
    }
    const r=staminaRatio();
    const state=STA.out?"out":(r<TIRED_RATIO?"low":(r<.5?"warn":"ok"));
    if(state!==hudState){hudState=state;el.dataset.sta=state;}
    const m=mods();
    const chip=STA.out?"力竭恢复中…":(m.clutch>0&&clutchActive()?"CLUTCH 准星 +"+Math.round(m.clutch*100)+"%":(r<TIRED_RATIO?"手臂发沉 · 准星下降":""));
    if(chip!==hudChip){hudChip=chip;const c=document.getElementById("staChip");if(c)c.textContent=chip;}
  }
  function tick(now){
    requestAnimationFrame(tick);
    const g=gameRef();
    const dt=clamp((now-(STA.lastT||now))/1000,0,.1);
    STA.lastT=now;
    if(!g){updateHud(false);return;}
    const active=playing(g);
    if(active&&!STA.was){
      STA.max=STA_BASE*mods().staminaMax;
      STA.v=STA.max;STA.out=false;
      MET.lowMs=0;MET.outCount=0;
      announceGear();
    }
    STA.was=active;
    if(active){
      const m=mods();
      if(g.charging){STA.v=Math.max(0,STA.v-CHARGE_DRAIN*m.cost*dt);STA.lastUseAt=now;}
      else if(now-STA.lastUseAt>=REGEN_DELAY*1000)STA.v=Math.min(STA.max,STA.v+REGEN*m.recovery*dt);
      if(staminaRatio()<TIRED_RATIO)MET.lowMs+=dt*1000;
      if(!STA.out&&STA.v<=.01){STA.out=true;MET.outCount++;toastThrottled("💦 精力耗尽 · 喘口气再投!","#ff8d7a");if(typeof phoneHaptic==="function"&&typeof HAPTIC_PATTERNS!=="undefined")phoneHaptic(HAPTIC_PATTERNS.exhausted);}
      if(STA.out&&STA.v>=STA.max*WAKE_RATIO){STA.out=false;toastThrottled("💪 缓过来了 · 继续!","#7CFC6B");}
    }
    updateHud(active);
  }

  /* ---------------- 球员初始数值 ---------------- */
  function profileOf(star){
    const cfg=global.AIBA_CONFIG||{};
    return (cfg.shotProfileFor?cfg.shotProfileFor(star):null)||cfg.DEFAULT_SHOT_PROFILE||{speed:1,window:1};
  }
  function baseStats(star){
    const p=profileOf(star),r=clamp(Number(star&&star.r)||88,70,99);
    return {
      speed:clamp(Math.round(((p.speed||1)-.7)*170),15,99),
      aim:clamp(Math.round(((p.window||1)-.78)*280),15,99),
      clutch:clamp(Math.round((r-58)*2.1),15,99),
      stamina:72
    };
  }

  /* ---------------- 更衣室 UI ---------------- */
  let lastStar=null;
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function statRow(label,val,bonusText){
    const shown=clamp(Math.round(val),8,99);
    return `<span><b>${esc(label)}</b><i style="--v:${clamp(shown,8,96)}%"></i><em>${shown}${bonusText?` <u>${esc(bonusText)}</u>`:""}</em></span>`;
  }
  function statsMarkup(star){
    const b=baseStats(star),m=mods(),it=activeItem();
    const extra=it&&(it.stat==="recovery"||it.stat==="cost")?it.desc:"";
    return `<div class="gearStats lockerMetrics">
      ${statRow("投速",b.speed*m.speed,m.speed>1?"+"+Math.round((m.speed-1)*100)+"%":"")}
      ${statRow("准星",b.aim*m.aim,m.aim>1?"+"+Math.round((m.aim-1)*100)+"%":"")}
      ${statRow("关键",b.clutch*(1+m.clutch),m.clutch>0?"关键时刻+"+Math.round(m.clutch*100)+"%":"")}
      ${statRow("精力",b.stamina*m.staminaMax,m.staminaMax>1?"+"+Math.round((m.staminaMax-1)*100)+"%":extra)}
    </div>`;
  }
  function chipMarkup(slot,item){
    const on=load[slot]===item.id;
    return `<button class="gearChip ${on?"on":""}" type="button" style="--gc:${item.color}" onclick="AIBAGearEquip('${slot}','${item.id}')" aria-pressed="${on}">
      <span class="gearThumb ${slot}" data-gear-id="${esc(item.id)}" aria-hidden="true"><i></i></span><b>${esc(item.name)}</b><em>${esc(item.desc)}</em></button>`;
  }
  function slotMarkup(slot){
    const it=itemOf(slot.id),isActive=load.active===slot.id&&!!it;
    const state=it?`<button class="gearActive ${isActive?"on":""}" type="button" onclick="AIBAGearActivate('${slot.id}')">${isActive?"✓ 加成生效":"设为生效"}</button>`:`<span class="gearEmpty">未装备</span>`;
    return `<div class="gearSlot ${isActive?"live":""}">
      <div class="gearSlotHead"><small>${esc(slot.en)}</small><b>${esc(slot.name)}</b>${state}</div>
      <div class="gearChips">${CATALOG[slot.id].map(item=>chipMarkup(slot.id,item)).join("")}</div>
    </div>`;
  }
  function sectionMarkup(star){
    if(star!==undefined)lastStar=star||null;
    return `<div id="lockerGear" class="lockerGear">
      <div class="gearHead"><small>GEAR LAB</small><b>装备工坊</b><em>可穿 3 件 · 同时只有 1 件的加成生效，点「设为生效」切换</em></div>
      ${SLOTS.map(slotMarkup).join("")}
      ${statsMarkup(lastStar)}
    </div>`;
  }
  function refreshSection(){
    const el=document.getElementById("lockerGear");
    if(!el)return;
    const workbench=el.closest(".lockerWorkbench"),scrollTop=workbench?workbench.scrollTop:0;
    el.outerHTML=sectionMarkup(lastStar);
    if(workbench){
      workbench.scrollTop=scrollTop;
      requestAnimationFrame(()=>{workbench.scrollTop=scrollTop;});
    }
  }
  function equip(slot,id){
    if(!CATALOG[slot])return;
    if(typeof global.playSFX==="function")global.playSFX("ui_equip_01");
    load[slot]=load[slot]===id?"":id;
    if(load[slot]&&!load.active)load.active=slot;
    if(!load[slot]&&load.active===slot){
      const next=SLOTS.find(s=>load[s.id]);
      load.active=next?next.id:"";
    }
    save();refreshSection();refreshGearPreview(slot);
  }
  function setActive(slot){
    if(!load[slot])return;
    if(typeof global.playSFX==="function")global.playSFX("ui_equip_01");
    load.active=slot;save();refreshSection();
  }
  function onStarPreview(star){
    lastStar=star||null;
    const el=document.querySelector("#lockerGear .gearStats");
    if(el)el.outerHTML=statsMarkup(lastStar);
  }

  /* ---------------- 装备外观:更衣室预览与正式上场共用 ---------------- */
  function colorOf(item,fallback){
    const value=item&&item.color;
    return parseInt(String(value||fallback||"#ffffff").replace("#",""),16)||0xffffff;
  }
  function clearGearHead(guy){
    if(!guy||!guy.gearHeadGroup)return;
    if(guy.gearHeadGroup.parent)guy.gearHeadGroup.parent.remove(guy.gearHeadGroup);
    guy.gearHeadGroup.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      materials.filter(Boolean).forEach(material=>material.dispose&&material.dispose());
    });
    guy.gearHeadGroup=null;
  }
  function gearBox(group,w,h,d,x,y,z,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  function applyGearHead(guy,item){
    if(global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled){
      global.AIBAEquipmentVisuals.applyHead(guy,item,{key:"gearHeadGroup"});return;
    }
    clearGearHead(guy);
    if(guy.customHeadGroup)guy.customHeadGroup.visible=true;
    if(guy.hairGrp)guy.hairGrp.visible=true;
    if(!item)return;
    const color=colorOf(item),id=item.id;
    if(guy.customHeadGroup)guy.customHeadGroup.visible=false;
    if(id.indexOf("band-")===0){
      guy.headband.visible=true;guy.headband.material.color.setHex(color);return;
    }
    guy.headband.visible=false;
    const group=new THREE.Group(),main=new THREE.MeshLambertMaterial({color}),dark=new THREE.MeshLambertMaterial({color:0x050508});
    if(id==="head-mask"){
      gearBox(group,.31,.17,.035,0,1.62,.195,dark);
      gearBox(group,.075,.045,.045,-.07,1.645,.22,main);gearBox(group,.075,.045,.045,.07,1.645,.22,main);
    }else if(id==="head-cap"){
      if(guy.hairGrp)guy.hairGrp.visible=false;
      gearBox(group,.39,.09,.35,0,1.82,0,main);gearBox(group,.34,.045,.24,0,1.755,.2,main);gearBox(group,.24,.035,.24,0,1.74,.32,main);
    }else if(id==="head-shades"){
      gearBox(group,.11,.06,.04,-.078,1.65,.21,dark);gearBox(group,.11,.06,.04,.078,1.65,.21,dark);gearBox(group,.065,.022,.04,0,1.65,.215,dark);
    }else if(id==="head-hoodie"){
      if(guy.hairGrp)guy.hairGrp.visible=false;
      gearBox(group,.46,.14,.43,0,1.84,-.02,main);gearBox(group,.1,.34,.4,-.22,1.63,-.03,main);gearBox(group,.1,.34,.4,.22,1.63,-.03,main);gearBox(group,.45,.35,.1,0,1.64,-.23,main);
    }else{
      if(guy.hairGrp)guy.hairGrp.visible=false;
      gearBox(group,.48,.48,.48,0,1.64,0,main);gearBox(group,.09,.09,.09,-.13,1.7,.25,dark);gearBox(group,.09,.09,.09,.13,1.7,.25,dark);gearBox(group,.25,.05,.045,0,1.55,.26,dark);gearBox(group,.15,.2,.13,-.29,1.77,0,main);gearBox(group,.15,.2,.13,.29,1.77,0,main);
    }
    guy.gearHeadGroup=group;(guy.headRoot||guy.g).add(group);
  }
  function applyVisual(guy){
    if(!guy||!global.THREE||global.AIBA_SUPPRESS_GEAR_VISUAL)return;
    const shoes=itemOf("shoes"),sleeve=itemOf("sleeve"),head=itemOf("band");
    if(global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled){
      global.AIBAEquipmentVisuals.applyShoes(guy,shoes);
      global.AIBAEquipmentVisuals.applySleeve(guy,sleeve);
      global.AIBAEquipmentVisuals.applyHead(guy,head,{key:"gearHeadGroup"});
      return;
    }
    if(shoes)guy.shoes.forEach(shoe=>shoe.material.color.setHex(colorOf(shoes)));
    if(sleeve){
      const color=colorOf(sleeve);
      guy.sleeves.forEach((part,index)=>{part.visible=index===1;part.material.color.setHex(color);});
      guy.wrists.forEach((part,index)=>{part.visible=index===0;part.material.color.setHex(color);});
    }
    applyGearHead(guy,head);
  }
  function appearanceKey(){return [load.shoes||"-",load.sleeve||"-",load.band||"-"].join("|");}
  function refreshGearPreview(part){
    const root=document.getElementById("lockerStage")||document.querySelector(".playerLocker");
    if(root&&global.AIBALockerPreview){
      if(typeof global.AIBALockerPreview.refreshLive==="function")global.AIBALockerPreview.refreshLive(root);
      else global.AIBALockerPreview.render(root);
      requestAnimationFrame(()=>{
        if(global.AIBALockerPreview&&typeof global.AIBALockerPreview.focus==="function")global.AIBALockerPreview.focus(part||"full");
      });
    }
  }

  /* ---------------- 挂钩游戏全局(在主脚本之后加载) ---------------- */
  function isRivalModel(guy){
    if(!guy)return false;
    try{return typeof rivals!=="undefined"&&Array.isArray(rivals)&&rivals.indexOf(guy)>=0;}
    catch(e){return false;}
  }
  function wrapGlobals(){
    const wrap=(name,make)=>{
      const orig=global[name];
      if(typeof orig!=="function"||orig.__aibaGear)return;
      const fn=make(orig);fn.__aibaGear=true;global[name]=fn;
    };
    wrap("playerSweetZone",orig=>function(){
      let z=orig.apply(this,arguments);
      const m=mods();
      z*=m.aim*fatigueFactor();
      if(m.clutch>0&&clutchActive())z*=1+m.clutch;
      return z;
    });
    wrap("playerChargeRate",orig=>function(){
      return orig.apply(this,arguments)*mods().speed*fatigueFactor();
    });
    wrap("startCharge",orig=>function(){
      if(STA.out&&playing(gameRef())){
        toastThrottled("💦 力竭中 · 精力回到 "+Math.round(WAKE_RATIO*100)+"% 才能出手","#ffd23f");
        return false;
      }
      return orig.apply(this,arguments);
    });
    wrap("releaseShot",orig=>function(power,shot){
      if(playing(gameRef())){STA.v=Math.max(0,STA.v-SHOT_COST*mods().cost);STA.lastUseAt=performance.now();}
      return orig.apply(this,arguments);
    });
    /* 只有你自己的模型穿你的装备。applyStarStyle 同样用在电脑身上
       (pregame.js 的 battleOpp、contest.js 的 finalist),不拦住的话电脑会戴着
       你的头饰、穿你的球鞋上场 —— 实测:装黑面具+疾风橙后,对手 gearHeadGroup 也在,
       鞋色同为 #e8771e。绝杀时刻的 9 个人走另一条建模路径,不受影响。 */
    wrap("applyStarStyle",orig=>function(guy,star){
      const result=orig.apply(this,arguments);
      if(!isRivalModel(guy))applyVisual(guy);
      return result;
    });
  }

  global.AIBAGearEquip=equip;
  global.AIBAGearActivate=setActive;
  global.AIBAGear={
    SLOTS,CATALOG,STAT_NAMES,
    get:()=>({...load}),
    mods,activeItem,activeSummary,clutchActive,
    baseStats,sectionMarkup,onStarPreview,applyVisual,appearanceKey,refreshPreview:refreshGearPreview,
    stamina:()=>({v:STA.v,max:STA.max,out:STA.out}),
    staminaMetrics:()=>({lowMs:MET.lowMs,outCount:MET.outCount,ratio:staminaRatio()}),
    _setStamina:v=>{STA.v=clamp(Number(v)||0,0,STA.max);}
  };

  wrapGlobals();
  requestAnimationFrame(tick);
})(window);
