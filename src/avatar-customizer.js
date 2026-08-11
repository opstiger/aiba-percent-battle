/* ---------------- custom voxel player builder ---------------- */
(function(global){
  "use strict";

  const LS_KEY="aiba_custom_player_v1";
  const CUSTOM_ID="custom-player";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hex=n=>"#"+Number(n||0).toString(16).padStart(6,"0").slice(-6);
  const fromHex=v=>parseInt(String(v||"#ffffff").replace("#",""),16)||0xffffff;

  /* 球衣配色:取自 NBA 官方品牌色值(球队 style guide 公开色),质感优先 */
  const PALETTES=Object.freeze({
    jersey:[
      {id:"laker",name:"湖人紫金",a:0x552583,b:0xfdb927},
      {id:"celtic",name:"凯尔特人绿",a:0x007a33,b:0xede8d5},
      {id:"bull",name:"公牛红黑",a:0xce1141,b:0x101010},
      {id:"warrior",name:"勇士蓝金",a:0x1d428a,b:0xffc72c},
      {id:"heat",name:"热火酒红",a:0x98002e,b:0xf9a01b},
      {id:"knick",name:"尼克斯蓝橙",a:0x006bb6,b:0xf58426},
      {id:"spur",name:"马刺黑银",a:0x14161c,b:0xc4ced4},
      {id:"sun",name:"太阳紫橙",a:0x1d1160,b:0xe56020}
    ],
    skin:[
      {id:"light",name:"浅肤",v:0xf4c89c},
      {id:"tan",name:"小麦",v:0xd9a878},
      {id:"brown",name:"深棕",v:0x9c6b43},
      {id:"dark",name:"黑棕",v:0x6b4a2c}
    ],
    hair:[
      {id:"black",name:"黑",v:0x101010},
      {id:"brown",name:"棕",v:0x4a2c12},
      {id:"gold",name:"金",v:0xd4a83a},
      {id:"grey",name:"灰白",v:0xb9bdc4}
    ]
  });

  /* 上衣款式:球衣背心 / 连帽衫(帽子戴头上) / 套头卫衣(帽子垂背后),都用球衣配色 */
  const TOPS=Object.freeze([
    {id:"vest",name:"球衣背心",copy:"经典无袖,露臂最利落"},
    {id:"hoodie",name:"连帽衫",copy:"帽子戴头上,街头训练感"},
    {id:"sweater",name:"套头卫衣",copy:"长袖+垂帽,冷天加练风"}
  ]);

  const HAIRS=Object.freeze([
    {id:"short",name:"短发"},
    {id:"fade",name:"渐变寸头"},
    {id:"buzz",name:"板寸"},
    {id:"afro",name:"爆炸头"},
    {id:"cornrows",name:"脏辫"},
    {id:"ponytail",name:"高马尾"},
    {id:"bun",name:"发髻"},
    {id:"flattop",name:"平头"}
  ]);

  const STYLES=Object.freeze([
    {id:"speed",name:"快射型",tag:"快",profile:{speed:1.14,window:.94,arc:.99,arcLabel:"平快急停",label:"极速出手"},copy:"出手最快,甜区更窄"},
    {id:"steady",name:"稳定型",tag:"稳",profile:{speed:.98,window:1.1,arc:1.01,arcLabel:"标准稳弧",label:"稳定出手"},copy:"甜区更宽,节奏普通"},
    {id:"high",name:"高弧型",tag:"弧",profile:{speed:.92,window:1.03,arc:1.14,arcLabel:"高弧慢射",label:"舒展高出手"},copy:"弧线漂亮,起手偏慢"},
    {id:"clutch",name:"关键型",tag:"杀",profile:{speed:.96,window:.99,arc:1.06,arcLabel:"关键中高弧",label:"关键出手"},copy:"关键更强,常规一般"}
  ]);

  const HEADS=Object.freeze([
    {id:"band",name:"头带",tag:"BAL",mods:{window:.02},copy:"准星小增益,无明显短板"},
    {id:"mask",name:"面具",tag:"MSK",mods:{window:-.03,speed:-.02,r:4},copy:"关键气场强,视野略窄"},
    {id:"cap",name:"帽子",tag:"CAP",mods:{speed:-.03,window:.02,r:1},copy:"稳定一点,出手慢一点"},
    {id:"shades",name:"太阳镜",tag:"SUN",mods:{window:.04,speed:-.04,r:2},copy:"看起来冷,起手略慢"},
    {id:"mascot",name:"奇葩头套",tag:"FUN",mods:{speed:.06,window:-.08,r:-1},copy:"移动感强,准星明显变窄"}
  ]);

  /* 球鞋/护腕等装备类外观归 gear 装备模块统一叠加,这里只留固定默认值 */
  const GEAR_DEFAULTS=Object.freeze({shoe:0xffffff});

  const defaults=Object.freeze({
    name:"自建球员",num:"88",jersey:"laker",skin:"tan",hair:"short",hairColor:"black",
    top:"vest",head:"band",style:"steady",updatedAt:0
  });
  let state=load();

  function opt(list,id){return list.find(i=>i.id===id)||list[0];}
  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(LS_KEY)||"{}");
      // 旧档迁移:连帽衫从"头部造型"移到"上衣款式";装备类字段废弃
      if(raw.head==="hoodie"){raw.head="band";if(!raw.top)raw.top="hoodie";}
      delete raw.shoe;delete raw.wrist;delete raw.sleeve;
      return {...defaults,...raw};
    }
    catch(e){return {...defaults};}
  }
  function persist(){
    state.updatedAt=Date.now();
    try{localStorage.setItem(LS_KEY,JSON.stringify(state));}catch(e){}
  }
  function profile(){
    const base={...opt(STYLES,state.style).profile};
    const mods=opt(HEADS,state.head).mods||{};
    base.speed=clamp((base.speed||1)+(mods.speed||0),.82,1.2);
    base.window=clamp((base.window||1)+(mods.window||0),.86,1.14);
    base.arc=clamp((base.arc||1)+(mods.arc||0),.92,1.18);
    return base;
  }
  function rating(){
    const p=profile(),head=opt(HEADS,state.head),style=opt(STYLES,state.style);
    return Math.round(clamp(84+(p.window-1)*36+(p.speed-1)*22+(head.mods.r||0)+(style.id==="clutch"?3:0),80,94));
  }
  function customStar(){
    const jersey=opt(PALETTES.jersey,state.jersey),skin=opt(PALETTES.skin,state.skin),hair=opt(PALETTES.hair,state.hairColor);
    const head=opt(HEADS,state.head),style=opt(STYLES,state.style),top=opt(TOPS,state.top);
    return {
      id:CUSTOM_ID,custom:true,cover:true,n:(state.name||defaults.name).slice(0,10),t:`自建球员 · ${style.name} · ${top.id==="vest"?head.name:top.name}`,
      r:rating(),col:[jersey.a,jersey.b],num:String(state.num||"88").replace(/[^\d]/g,"").slice(0,2)||"88",
      skin:skin.v,shoe:GEAR_DEFAULTS.shoe,hair:hair.v,hairStyle:state.hair,beard:false,
      headband:state.head==="band"&&state.top==="vest"?jersey.b:false,
      customHead:{id:state.head,color:jersey.b},customTop:{id:state.top,a:jersey.a,b:jersey.b},
      shotProfile:profile(),updatedAt:state.updatedAt||0
    };
  }
  function listStars(){return [customStar()];}

  function cardMarkup(current){
    const star=customStar(),on=current===CUSTOM_ID,p=star.shotProfile;
    return `<button class="lockerCard customLockerCard ${on?"selected":""}" type="button" data-aiba-player="${CUSTOM_ID}" style="--jersey:${hex(star.col[0])};--trim:${hex(star.col[1])}" onclick="AIBACustomizerOpen(event)" aria-pressed="${on}">
      <span class="lockerPlate"><small>CUSTOM</small><b>#${esc(star.num)}</b></span>
      <span class="lockerAvatar" data-locker-avatar="${CUSTOM_ID}"><i>3D</i><b>BUILD</b></span>
      <span class="lockerCardCopy"><small>${esc(opt(STYLES,state.style).name.toUpperCase())}</small><b>${esc(star.n)}</b><em>${esc(opt(HEADS,state.head).name)} · ${esc(p.label)} · 甜区 ${Math.round(p.window*100)}%</em></span>
      <span class="lockerRibbon">编辑角色</span>
    </button>`;
  }

  function chips(list,field){
    return list.map(item=>{
      const value=item.id||item.name,on=state[field]===value;
      const color=item.v!=null?` style="--cc:${hex(item.v)}"`:"";
      return `<button class="customChip ${esc(field)} ${on?"on":""}" type="button" data-custom-id="${esc(value)}"${color} onclick="AIBACustomizerPick('${field}','${esc(value)}')"><i></i><b>${esc(item.name)}</b>${item.copy?`<em>${esc(item.copy)}</em>`:""}</button>`;
    }).join("");
  }
  function jerseyChips(){
    return PALETTES.jersey.map(item=>{
      const on=state.jersey===item.id;
      return `<button class="customChip jersey ${on?"on":""}" type="button" style="--ca:${hex(item.a)};--cb:${hex(item.b)}" onclick="AIBACustomizerPick('jersey','${item.id}')"><i></i><b>${esc(item.name)}</b></button>`;
    }).join("");
  }
  function styleChips(){
    return STYLES.map(item=>{
      const p=item.profile,on=state.style===item.id;
      return `<button class="customChip style ${on?"on":""}" type="button" onclick="AIBACustomizerPick('style','${item.id}')"><i>${esc(item.tag)}</i><b>${esc(item.name)}</b><em>${esc(item.copy)} · 速${Math.round(p.speed*100)} / 准${Math.round(p.window*100)}</em></button>`;
    }).join("");
  }
  function headChips(){
    return HEADS.map(item=>{
      const on=state.head===item.id,m=item.mods||{};
      const stat=[m.speed?`速${m.speed>0?"+":""}${Math.round(m.speed*100)}%`:"",m.window?`准${m.window>0?"+":""}${Math.round(m.window*100)}%`:"",m.arc?`弧+${Math.round(m.arc*100)}%`:""].filter(Boolean).join(" / ")||"均衡";
      return `<button class="customChip head ${on?"on":""}" type="button" data-custom-id="${esc(item.id)}" onclick="AIBACustomizerPick('head','${item.id}')"><i>${esc(item.tag)}</i><b>${esc(item.name)}</b><em>${esc(stat)} · ${esc(item.copy)}</em></button>`;
    }).join("");
  }
  function statsMarkup(){
    const p=profile(),star=customStar();
    const rows=[
      ["投速",Math.round(p.speed*100),p.label],
      ["准星",Math.round(p.window*100),"甜区窗口"],
      ["弧线",Math.round(p.arc*100),p.arcLabel],
      ["总评",star.r,star.t]
    ];
    return `<div class="customStats">${rows.map(r=>`<span><b>${r[0]}</b><i style="--v:${clamp(r[1]-40,8,96)}%"></i><em>${esc(r[1])} · ${esc(r[2])}</em></span>`).join("")}</div>`;
  }

  function open(ev,opts){
    if(ev&&ev.stopPropagation)ev.stopPropagation();
    opts=opts||{};
    if(typeof global.showPanel!=="function")return;
    const star=customStar();
    global.showPanel(`<div class="avatarCustomizer">
      <div class="customHead"><small>CUSTOM PLAYER</small><h1>自建球员工坊</h1><p>每个选择都有长板和短板，角色更有个性，但不会把数值拉爆。</p></div>
      <div class="customBody">
        <aside class="customPreview"><span class="lockerAvatar ready" data-locker-avatar="${CUSTOM_ID}"><i>3D</i><b>BUILD</b></span><button class="lockerViewReset" type="button" data-aiba-icon="rotate-ccw" data-aiba-label="重置视角" onclick="event.preventDefault();event.stopPropagation();AIBALockerPreview.reset()" aria-label="重置视角"></button>${statsMarkup()}</aside>
        <section class="customForm">
          <label class="customField"><span>昵称</span><input value="${esc(state.name)}" maxlength="10" oninput="AIBACustomizerSet('name',this.value)"></label>
          <label class="customField"><span>号码</span><input value="${esc(state.num)}" maxlength="2" inputmode="numeric" oninput="AIBACustomizerSet('num',this.value)"></label>
          <div class="customGroup"><b>球衣配色</b><div class="customGrid">${jerseyChips()}</div></div>
          <div class="customGroup"><b>上衣款式</b><div class="customGrid two">${chips(TOPS,"top")}</div></div>
          <div class="customGroup"><b>投篮模板</b><div class="customGrid two">${styleChips()}</div></div>
          <div class="customGroup"><b>头部造型</b><div class="customGrid two">${headChips()}</div></div>
          <div class="customGroup"><b>肤色</b><div class="customGrid">${chips(PALETTES.skin,"skin")}</div></div>
          <div class="customGroup"><b>发型</b><div class="customGrid">${chips(HAIRS,"hair")}</div></div>
          <div class="customGroup"><b>发色</b><div class="customGrid">${chips(PALETTES.hair,"hairColor")}</div></div>
          <p class="customNote">球鞋 / 护腕 / 头带等装备外观由「装备工坊」统一提供加成与配色，这里不再单独设置。</p>
        </section>
      </div>
      <div class="customActions"><button class="btn" type="button" onclick="AIBACustomizerSaveUse()">保存并上场</button><button class="btn sm" type="button" onclick="AIBACustomizerReset()">恢复默认</button><button class="btn sm" type="button" onclick="showAIBAPlayerSelect()">返回</button></div>
    </div>`);
    const box=document.getElementById("ovBox");
    if(box)box.classList.add("playerLockerBox","avatarCustomizerBox");
    hydratePreview();
    if(Number.isFinite(opts.scrollTop)){
      const form=document.querySelector(".customForm");
      if(form){
        form.scrollTop=opts.scrollTop;
        requestAnimationFrame(()=>{form.scrollTop=opts.scrollTop;});
      }
    }
    if(!opts.quiet&&typeof global.toast==="function")global.toast(`${star.n} 已载入工坊`,"#77e7ff");
  }
  function hydratePreview(){
    const root=document.querySelector(".avatarCustomizer");
    if(root&&global.AIBALockerPreview)global.AIBALockerPreview.render(root);
  }
  function pick(field,value){
    const form=document.querySelector(".customForm"),scrollTop=form?form.scrollTop:0;
    state[field]=value;
    persist();
    open(null,{scrollTop,quiet:true});
  }
  function set(field,value){
    if(field==="num")value=String(value).replace(/[^\d]/g,"").slice(0,2);
    if(field==="name")value=String(value).slice(0,10);
    state[field]=value;
  }
  function saveUse(){
    persist();
    if(typeof global.chooseAIBAPlayer==="function")global.chooseAIBAPlayer(CUSTOM_ID);
    if(typeof global.showAIBAPlayerSelect==="function")global.showAIBAPlayerSelect();
    if(typeof global.previewAIBAPlayer==="function")setTimeout(()=>global.previewAIBAPlayer(CUSTOM_ID),0);
    if(typeof global.toast==="function")global.toast("自建球员已锁定上场","#7CFC6B");
  }
  function reset(){
    const form=document.querySelector(".customForm"),scrollTop=form?form.scrollTop:0;
    state={...defaults,updatedAt:Date.now()};
    persist();
    open(null,{scrollTop,quiet:true});
  }

  function clearCustomHead(guy){
    if(global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled){
      global.AIBAEquipmentVisuals.clearKey(guy,"customHeadGroup");return;
    }
    if(!guy||!guy.customHeadGroup)return;
    if(guy.customHeadGroup.parent)guy.customHeadGroup.parent.remove(guy.customHeadGroup);
    guy.customHeadGroup.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.filter(Boolean).forEach(mat=>mat.dispose&&mat.dispose());
    });
    guy.customHeadGroup=null;
  }
  function addBox(group,w,h,d,x,y,z,mat){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  function applyCustomHead(guy,star){
    if(!global.THREE||!guy||!star||!star.customHead)return;
    clearCustomHead(guy);
    const head=star.customHead.id,color=star.customHead.color||0xffffff;
    if(head==="band")return;
    if(global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled){
      const id=head==="mascot"?"head-weird":"head-"+head;
      global.AIBAEquipmentVisuals.applyHead(guy,{id,color},{key:"customHeadGroup",color,accent:star.col&&star.col[0]});
      return;
    }
    const group=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color}),dark=new THREE.MeshLambertMaterial({color:0x050508});
    if(head==="mask"){
      addBox(group,.3,.16,.025,0,1.62,.19,dark);addBox(group,.07,.04,.03,-.065,1.645,.21,mat);addBox(group,.07,.04,.03,.065,1.645,.21,mat);
    }else if(head==="cap"){
      addBox(group,.38,.08,.34,0,1.81,0,mat);addBox(group,.3,.035,.22,0,1.755,.19,mat);addBox(group,.22,.03,.22,0,1.74,.3,mat);
    }else if(head==="shades"){
      addBox(group,.105,.055,.035,-.075,1.65,.205,dark);addBox(group,.105,.055,.035,.075,1.65,.205,dark);addBox(group,.06,.02,.035,0,1.65,.21,dark);
    }else if(head==="mascot"){
      addBox(group,.46,.46,.46,0,1.63,0,mat);addBox(group,.08,.08,.08,-.12,1.69,.24,dark);addBox(group,.08,.08,.08,.12,1.69,.24,dark);addBox(group,.24,.045,.04,0,1.55,.25,dark);addBox(group,.14,.18,.12,-.28,1.75,0,mat);addBox(group,.14,.18,.12,.28,1.75,0,mat);
    }
    guy.customHeadGroup=group;
    (guy.headRoot||guy.g).add(group);
  }
  function clearCustomTopHead(guy){
    if(global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled){
      global.AIBAEquipmentVisuals.clearKey(guy,"customTopHeadGroup");return;
    }
    if(!guy||!guy.customTopHeadGroup)return;
    if(guy.customTopHeadGroup.parent)guy.customTopHeadGroup.parent.remove(guy.customTopHeadGroup);
    guy.customTopHeadGroup.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.filter(Boolean).forEach(mat=>mat.dispose&&mat.dispose());
    });
    guy.customTopHeadGroup=null;
  }
  function clearCustomTop(guy){
    clearCustomTopHead(guy);
    if(!guy||!guy.customTopGroup)return;
    guy.g.remove(guy.customTopGroup);
    guy.customTopGroup.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      mats.filter(Boolean).forEach(mat=>mat.dispose&&mat.dispose());
    });
    guy.customTopGroup=null;
  }
  function applyCustomTop(guy,star){
    if(!global.THREE||!guy||!star||!star.customTop)return;
    clearCustomTop(guy);
    const top=star.customTop.id;
    const modern=global.AIBAEquipmentVisuals&&global.AIBAEquipmentVisuals.enabled;
    if(top==="hoodie"&&modern){
      if(guy.sleeves)guy.sleeves.forEach(s=>{s.visible=false;});
      global.AIBAEquipmentVisuals.applyHead(
        guy,
        {id:"hoodie",color:star.customTop.a,accent:star.customTop.b},
        {key:"customTopHeadGroup",color:star.customTop.a,accent:star.customTop.b,outfitOnly:!!(star.customHead&&star.customHead.id==="mascot")}
      );
      return;
    }
    // 长袖:连帽衫/套头卫衣把两条袖套全部点亮并用球衣主色
    if(guy.sleeves)guy.sleeves.forEach(s=>{
      s.visible=top!=="vest";
      if(top!=="vest")s.material.color.setHex(star.customTop.a);
    });
    if(top==="vest")return;
    const main=new THREE.MeshLambertMaterial({color:star.customTop.a}),trim=new THREE.MeshLambertMaterial({color:star.customTop.b});
    const group=new THREE.Group();
    if(top==="hoodie"&&(!star.customHead||star.customHead.id!=="mascot")){
      // 经典兜底帽兜
      const headGroup=new THREE.Group();
      addBox(headGroup,.44,.13,.42,0,1.85,-.02,main);
      addBox(headGroup,.095,.32,.4,-.215,1.63,-.03,main);
      addBox(headGroup,.095,.32,.4,.215,1.63,-.03,main);
      addBox(headGroup,.44,.34,.095,0,1.64,-.225,main);
      addBox(headGroup,.4,.07,.06,0,1.78,.185,trim);
      guy.customTopHeadGroup=headGroup;(guy.headRoot||guy.g).add(headGroup);
      addBox(group,.47,.055,.29,0,1.405,-.03,main); // 贴合肩颈的下摆
      addBox(group,.23,.018,.30,0,1.43,.01,trim);    // 领口细滚边
    }else{
      // 套头卫衣:帽子垂在背后 + 领口
      addBox(group,.42,.13,.14,0,1.43,-.21,main);
      addBox(group,.32,.11,.11,0,1.32,-.25,main);
      addBox(group,.4,.06,.3,0,1.45,.01,trim);
    }
    guy.customTopGroup=group;
    guy.g.add(group);
  }
  function applyStyle(guy,star){
    if(!star||!star.custom)return;
    applyCustomHead(guy,star);
    applyCustomTop(guy,star);
    // 装备类外观交给 gear 模块,这里保持确定的默认:护腕隐藏
    if(guy.wrists)guy.wrists.forEach(w=>{w.visible=false;});
    if(global.AIBAGear&&typeof global.AIBAGear.applyVisual==="function")global.AIBAGear.applyVisual(guy);
  }
  function patchApplyStarStyle(){
    const orig=global.applyStarStyle;
    if(typeof orig!=="function"||orig.__aibaCustom)return;
    const fn=function(guy,star){
      orig.apply(this,arguments);
      applyStyle(guy,star);
    };
    fn.__aibaCustom=true;
    global.applyStarStyle=fn;
  }

  global.AIBACustomizer={CUSTOM_ID,customStar,listStars,cardMarkup,open,pick,set,saveUse,reset,applyStyle};
  global.AIBACustomizerOpen=open;
  global.AIBACustomizerPick=pick;
  global.AIBACustomizerSet=set;
  global.AIBACustomizerSaveUse=saveUse;
  global.AIBACustomizerReset=reset;
  patchApplyStarStyle();
})(window);
