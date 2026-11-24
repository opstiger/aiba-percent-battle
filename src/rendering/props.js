/* racks & rack balls */
const rackBalls=[]; const deepBalls=[]; const rackStands=[]; const deepStands=[]; let halfCourtBall=null;
/* 每个架子的世界坐标系(原点 + 横向单位向量)。摆球要用,取球和滚落也要用,
   所以建的时候存下来,不要在三个地方各算一遍。 */
const rackFrames=[];
const rackNextIndex=[];        // 每个架子"下一颗要被拿走的球"的下标
let rackSide=1;                // +1 = 摆在球员右手边, -1 = 左手边
/* ---------------- 球架摆位 ----------------
   原来架子摆在球员**身后** 0.85m —— 那个位置球员根本够不着,只能让球自己飞过来,
   一眼假。真实三分大赛的架子是立在投篮点**旁边**的:球员侧身、双手把球端起来。

   摆哪一侧看惯用手 —— 规则是**架子放在辅助手那一侧**,右手球员在左边、左手球员在右边。
   理由是蓄力时躯干朝辅助手一侧打开(实测:满蓄力下投篮臂前移 +0.097m、辅助臂后撤 -0.097m),
   架子放在已经打开的那一侧,伸手是顺的;放在投篮手一侧就得反向拧回去。

   ⚠ 坐标提醒:`perp=(dir.z,0,-dir.x)` 是球员的**左**手边,不是右手边。
   (面朝 -Z 时 perp=(-1,0,0),而面朝 -Z 的人左手指向 -X。)
   我上一版把它注释成"右手边",结论虽然歪打正着,但注释会把下一个人带沟里。
   验证方法别再推符号了,直接问"架子和哪只手同侧":
     toRack·toGuide = +0.995 / toRack·toShoot = -0.995 → 架子在辅助手一侧。

   坡度朝向:**低端朝篮筐**,长轴顺着球员→篮筐这条线,不是横在身前。
   上一版把长轴摆成横的、低端指回球员胸口,后果是最低那颗球落在离身体中线只有
   0.35m 的地方(还在球员**后方** 0.1m),抬球进口袋时必然扫过躯干 —— 实测最深
   侵入 168mm、38 帧里 33 帧穿模。改成顺着出手线之后,球员站在最低球**后面**,
   伸手方向和抬球方向一致,球一路在体侧外。
   做法:rotation.y=atan2(-dir.z,dir.x) 让局部 +X(最低那一格)指向篮筐。
   顺带一个好处:箱体的长广告面(局部 ±Z)转成了正对球员/镜头那一侧。 */
function currentRackSide(){
  const cfg=window.AIBA_CONFIG;
  return (cfg&&cfg.rackSideFor)?cfg.rackSideFor(typeof G!=="undefined"?G.myStar:null):1;
}
function placeRacks(side){
  rackSide=side<0?-1:1;
  RACKS.forEach((r,ri)=>{
    const stand=rackStands[ri];if(!stand)return;
    const dir=HOOP.clone().sub(r.p);dir.y=0;dir.normalize();
    const perp=V3(dir.z,0,-dir.x);                       // 球员的**左**手边(见上面的坐标提醒)
    /* 横向 0.80m:箱体转成顺出手线之后,它在横向只占 BD/2≈0.23m,
       近侧边缘离球员中线还有 0.57m(躯干半宽 0.25m),站着不会压到。
       后撤 0.27m:低位槽在局部 +X=+0.60,于是最低那颗球正好落在球员**前方**
       0.33m —— 球员站在拿球位后面,这是"拿球转身不穿身体"的关键。
       0.33 与 motion.js 的 rackHoldPointAt 是**配对**的:两端同一个前向偏移,
       中间那条直线才会整段停在躯干前面。改一个就要改另一个。 */
    const base=r.p.clone().addScaledVector(perp,rackSide*0.80).addScaledVector(dir,-0.27);
    stand.position.set(base.x,0.45,base.z);
    stand.rotation.y=Math.atan2(-dir.z,dir.x);           // 局部 +X → 篮筐方向
    const perpEff=dir.clone();                            // 局部 +X 的世界方向
    rackFrames[ri]={base:base.clone(),perp:perpEff};
    seatRackBalls(ri,rackNextIndex[ri]||0,false);
  });
}
const RACK_SLOT_FALLBACK={SLOTS:5,DX:.30,DROP:0,BALL_Y:.41};
function rackSlotSpec(){
  const md=window.AIBAModelDetail;
  return (md&&md.enabled&&md.rackSlotLocal)
    ?{SLOTS:md.RACK_SLOTS,local:md.rackSlotLocal}
    :{SLOTS:RACK_SLOT_FALLBACK.SLOTS,
      local:i=>({x:(i-(RACK_SLOT_FALLBACK.SLOTS-1)/2)*RACK_SLOT_FALLBACK.DX,y:RACK_SLOT_FALLBACK.BALL_Y})};
}
/* 槽位 i 的世界坐标。架子本体挂在 y=0.45,局部 (x,y,0) 换算到世界就是这一行。 */
function rackSlotWorld(ri,i,out){
  const f=rackFrames[ri];if(!f)return null;
  const p=rackSlotSpec().local(i);
  return (out||new THREE.Vector3()).set(
    f.base.x+f.perp.x*p.x, 0.45+p.y, f.base.z+f.perp.z*p.x);
}
/* ---------------- 绕架走位 ----------------
   坡度转成顺出手线之后,箱体从站位往**后方**伸约 1m,正好压在相邻点位的弦上,
   走直线会直接穿过去(实测 5 个点位里 4 段间隙 = 0)。
   这里给走位提供一个**绕行点**:球员照走直线,最后一段从箱体的一端拐进站位。
   绕哪一端是个人习惯,见 config.js 的 rackDetourFor —— front 从靠篮筐那端抄进去,
   back 从远离篮筐那端兜过去。

   ⚠ 只有直线**真的**撞上箱体时才给绕行点。否则从没有架子的那一侧过来的走位
     也会被硬塞一个拐点,看起来像无缘无故绕了个圈。 */
const rackFootprint=[];                     // 每个架子的局部半尺寸,量一次缓存
function rackHalfExtent(ri){
  if(rackFootprint[ri])return rackFootprint[ri];
  const st=rackStands[ri];if(!st)return null;
  st.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(st.matrixWorld).invert();
  const lb=new THREE.Box3();
  st.children.filter(part=>part.visible).forEach(part=>part.traverse(c=>{
    if(!c.isMesh||!c.geometry)return;
    c.updateMatrixWorld(true);
    c.geometry.computeBoundingBox();
    const b=c.geometry.boundingBox.clone();
    b.applyMatrix4(new THREE.Matrix4().copy(inv).multiply(c.matrixWorld));
    lb.union(b);
  }));
  if(lb.isEmpty())return null;
  return (rackFootprint[ri]={minx:lb.min.x,maxx:lb.max.x,minz:lb.min.z,maxz:lb.max.z});
}
/* 世界点到箱体的水平距离。必须在箱体**局部**空间算 —— 用世界轴对齐包围盒
   会把斜放的 1.46×0.46 箱体膨胀到近 1.5×1.5,量出一堆假的"撞上了"。 */
const _dp=new THREE.Vector3();
function rackPointDist(ri,x,z){
  const st=rackStands[ri],e=rackHalfExtent(ri);
  if(!st||!e)return Infinity;
  _dp.set(x,0.45,z);st.worldToLocal(_dp);
  const dx=Math.max(e.minx-_dp.x,0,_dp.x-e.maxx);
  const dz=Math.max(e.minz-_dp.z,0,_dp.z-e.maxz);
  return Math.hypot(dx,dz);
}
function rackSegDist(ri,ax,az,bx,bz){
  let m=Infinity;
  for(let t=0;t<=120;t++){const u=t/120;
    m=Math.min(m,rackPointDist(ri,ax+(bx-ax)*u,az+(bz-az)*u));}
  return m;
}
const RACK_WALK_CLEAR=0.34;                  // 躯干半宽 0.25 + 9cm 余量(搜索取的是最短可行绕行,余量薄了会贴着箱体走)
const RACK_DETOUR_LAT=0.20;                  // 绕行点离出手线的横向偏移
const RACK_DETOUR_STEPS=[0.6,0.9,1.2,1.5,1.8,2.1,2.4];   // 上限 2.4m:再远就不像绕行像跑圈了,超了就换另一侧
/* 返回绕行点(世界坐标)或 null。mode:"front" 从靠篮筐那端绕 / "back" 从远端绕。

   绕行点**不能**放在箱体中心线上:那样从绕行点斜切回站位时正好擦过箱体角
   (实测只剩 8.8cm)。正确的形状是"绕过端头之后贴着出手线进站位" ——
   横向压到 0.20m,最后一段就整段待在箱体的横向带之外。

   往外要走多远取决于上一个点位有多远(斜线越平,越晚才越过端头),
   所以不写死,按 RACK_DETOUR_STEPS 递增搜索,取第一个两段都够开的。
   一个都不成立就返回 null —— 宁可不绕,也不要给一个仍然穿模的假路径。 */
function rackDetourWaypoint(ri,from,mode){
  const st=rackStands[ri],f=rackFrames[ri],e=rackHalfExtent(ri);
  if(!st||!st.visible||!f||!e)return null;
  const to=RACKS[ri]&&RACKS[ri].p;if(!to||!from)return null;
  if(rackSegDist(ri,from.x,from.z,to.x,to.z)>=RACK_WALK_CLEAR)return null;  // 本来就不撞
  const axis=f.perp;                          // 局部 +X 的世界方向 = 指向篮筐
  const lat=V3(axis.z,0,-axis.x).multiplyScalar(rackSide*RACK_DETOUR_LAT);
  const trySide=(sgn)=>{
    for(const d of RACK_DETOUR_STEPS){
      const w=V3(to.x+axis.x*sgn*d+lat.x, 0, to.z+axis.z*sgn*d+lat.z);
      if(rackPointDist(ri,w.x,w.z)<RACK_WALK_CLEAR)continue;
      if(rackSegDist(ri,from.x,from.z,w.x,w.z)<RACK_WALK_CLEAR)continue;
      if(rackSegDist(ri,w.x,w.z,to.x,to.z)<RACK_WALK_CLEAR)continue;
      return w;
    }
    return null;
  };
  const pref=(mode==="back")?-1:1;
  /* 首选那一侧绕不过去就换另一侧 —— 真人也是这样,后面被挡就从前面绕。
     直接返回 null 会退回直线,而那条直线是**确定**穿模的,比绕反了更糟。 */
  return trySide(pref)||trySide(-pref);
}
/* 把"还没被拿走"的球重新落位:下一颗永远排在**最低**那一格,后面的依次往高处排。
   这样视觉顺序和 shot.ball 的逻辑顺序天然一致 —— 花球(第 5 颗)排在最高、最后才拿到,
   和真实三分大赛的钱球位置一样。animate=true 时用补间滚下来,而不是瞬移。 */
function seatRackBalls(ri,nextIndex,animate){
  const balls=rackBalls[ri];if(!balls)return;
  const spec=rackSlotSpec(),last=spec.SLOTS-1;
  rackNextIndex[ri]=nextIndex;
  const target=new THREE.Vector3();
  const stock=typeof activeRushSupply==="function"?activeRushSupply(ri)?.stock:null;
  for(let b=0;b<balls.length;b++){
    const m=balls[b];if(!m)continue;
    const order=stock?stock.indexOf(b):b-nextIndex;
    if(order<0){m.visible=false;continue;}
    const slot=Math.max(0,last-order);
    rackSlotWorld(ri,slot,target);
    if(!animate){m.position.copy(target);continue;}
    const from=m.position.clone(),to=target.clone();
    const dist=from.distanceTo(to);
    if(dist<0.001)continue;
    const spin=dist/0.16;        // 滚过的弧长 / 球半径 = 转过的弧度
    const r0=m.rotation.x;
    /* 物理重力滚落:球在斜导轨上受重力分量加速向下滚(s ∝ t^2),到挡球器时轻微缓冲就位。
       不再是均匀或减速漂移,体现从静止受重力滚落的加速度。 */
    if(typeof tween==="function")tween(0.24,k=>{
      const kGrav=k<0.82?Math.pow(k/0.82,1.85):1+Math.sin((k-0.82)/0.18*Math.PI)*0.035;
      m.position.lerpVectors(from,to,Math.min(1.035,kGrav));
      m.rotation.x=r0+spin*k;
    },()=>{
      m.position.copy(to);
    });
    else m.position.copy(to);
  }
}
/* 取走最低那一颗。返回它的世界坐标,供球动画用它当起点 —— 球是从架子上拿的,
   起点必须是架上真实的那个位置,不能是球员身上。deferRoll=true 时不立即滚落上方球,
   等球员手接触并抽离底层球时再触发,保证真实物理因果。 */
function takeRackBall(ri,index,out,deferRoll){
  const balls=rackBalls[ri];if(!balls)return null;
  const b=Math.max(0,Math.min(balls.length-1,index|0));
  const m=balls[b];
  const pos=(out||new THREE.Vector3()).copy(m?m.position:rackSlotWorld(ri,rackSlotSpec().SLOTS-1)||new THREE.Vector3());
  pos.rackIndex=ri;
  pos.nextIndex=b+1;
  if(m)m.visible=false;
  if(typeof consumeRackRushBall==="function")consumeRackRushBall(ri,b);
  if(!deferRoll)seatRackBalls(ri,b+1,true);
  return pos;
}
/* 无限球模式(投篮机 / 百分大战)在架子空了之后补满,视觉上永远是一架球。 */
function refillRackBalls(ri){
  const balls=rackBalls[ri];if(!balls)return;
  balls.forEach(m=>{if(m)m.visible=true;});
  seatRackBalls(ri,0,false);
}
const rackThemeNames={
  shonanCoast:{body:0x777863,frame:0x52717a,trim:0xa28760,metalness:.28},
  outdoorSunny:{body:0x526a61,frame:0x434b4f,trim:0xb5a289,metalness:.36},
  lunarCrater:{body:0x7d8796,frame:0xb4becb,trim:0x343c48,metalness:.84},
  rainforest:{body:0x65533c,frame:0x42443b,trim:0x9a8060,metalness:.05},
  flowerCourt:{body:0x9d8059,frame:0x416451,trim:0xb0a383,metalness:.09},
  rainyCourt:{body:0x67635c,frame:0x495550,trim:0x9e8355,metalness:.47},
  beachSunset:{body:0x778789,frame:0x556163,trim:0xc5a772,metalness:.48},
  medCliff:{body:0x88846e,frame:0x6e775c,trim:0xac9063,metalness:.12},
  spanishQuarter:{body:0x867357,frame:0x435858,trim:0xbe8358,metalness:.19},
  arcticSnow:{body:0x7b9cae,frame:0xa2b4be,trim:0xa77346,metalness:.55},
  tokyoRooftop:{body:0x4a545f,frame:0x777988,trim:0xb37e47,metalness:.48}
};
const defaultRackTheme={body:0xe4e8ee,frame:0x9ba6b6,trim:0x274e75,metalness:.44};
function rackVenuePalette(name=currentScenePreset){
  if(name==="indoor")return defaultRackTheme;
  return rackThemeNames[name]||{body:0x7c7564,frame:0x596263,trim:0x9f7850,metalness:.36};
}
function rackWithVenueModel(model,kind,height=0){
  const mount=new THREE.Group();
  mount.userData.rackModel=model;mount.userData.rackKind=kind;mount.userData.rackHeight=height;
  mount.add(model);return mount;
}
let localRackWoodMap;
function localRackWood(){
  if(!localRackWoodMap){
    const random=mulberry32(77982);
    localRackWoodMap=pixTex(256,96,(g,w,h)=>{
      g.fillStyle="#c2b798";g.fillRect(0,0,w,h);
      for(let i=0;i<142;i++){
        const x=random()*w,y=random()*h,len=13+random()*164;
        g.strokeStyle=i%3===0?"rgba(217,192,151,.42)":"rgba(79,65,47,.24)";
        g.lineWidth=.45+random()*1.38;
        g.beginPath();g.moveTo(x,y);
        g.quadraticCurveTo(x+len*.48,y+(random()-.5)*3.5,x+len,y+(random()-.5)*5);g.stroke();
      }
    },{smooth:true,mipmaps:true});
  }
  return localRackWoodMap;
}
/* ---------------- 月球航空级拉丝钛金属 & 磨砂灰反射环境系统 ----------------
   月球天空是 0x010103 的漆黑真空，若高 metalness 材质不挂 envMap，反射项全黑，
   再高级的金属也会退化成灰暗塑料块。这里生成专属的阿波罗高对比度天光+地照+低角度太阳
   PMREM 磨砂环境贴图，以及微米级 CNC 航空拉丝金属纹理与粗糙度贴图。 */
let lunarEnvMap=null,lunarEnvRT=null,lunarBrushedMap=null,lunarBrushedRoughMap=null,lunarRackBadgeMap=null,lunarRackHazardMap=null;
function makeLunarEnvMap(){
  if(lunarEnvMap)return lunarEnvMap;
  const w=512,h=256,cv=document.createElement("canvas");
  cv.width=w;cv.height=h;
  const g=cv.getContext("2d");
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,"#14171d");      // 天顶：中性深空炭灰
  gr.addColorStop(0.30,"#2c3038");   // 高空：高级钛灰微光过渡
  gr.addColorStop(0.47,"#b8bcc4");   // 地平线：阿波罗银白金属拉丝主反射带
  gr.addColorStop(0.55,"#787c84");   // 近地平线：磨砂枪灰环形山脊反光
  gr.addColorStop(1,"#3a3d42");      // 下半球：月表风化层中性灰漫反射
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  // 地球方向柔和冷银蓝微光点缀（控制在低饱和，不把钛金属染蓝）
  const eg=g.createRadialGradient(w*0.68,h*0.24,6,w*0.68,h*0.24,w*0.20);
  eg.addColorStop(0,"rgba(205,225,248,0.55)");
  eg.addColorStop(0.5,"rgba(150,175,205,0.22)");
  eg.addColorStop(1,"rgba(0,0,0,0)");
  g.fillStyle=eg;g.fillRect(w*0.44,0,w*0.48,h*0.46);
  // 低角度太阳方向高强度铂金银白高光带 (Apollo Solar Anisotropic Highlight)
  const sg=g.createRadialGradient(w*0.24,h*0.44,4,w*0.24,h*0.44,w*0.28);
  sg.addColorStop(0,"rgba(255,253,248,1.0)");
  sg.addColorStop(0.32,"rgba(242,243,246,0.88)");
  sg.addColorStop(0.65,"rgba(188,192,198,0.42)");
  sg.addColorStop(1,"rgba(0,0,0,0)");
  g.fillStyle=sg;g.fillRect(0,h*0.14,w*0.56,h*0.58);
  // 环向航空拉丝软高光条带（保证任何朝向的金属倒角都有细腻磨砂反光）
  for(let i=0;i<7;i++){
    const y0=h*(0.34+i*0.030);
    g.fillStyle=i%2===0?"rgba(240,242,245,0.26)":"rgba(52,55,60,0.24)";
    g.fillRect(0,y0,w,h*0.015);
  }
  lunarEnvMap=new THREE.CanvasTexture(cv);
  lunarEnvMap.mapping=THREE.EquirectangularReflectionMapping;
  if(THREE.sRGBEncoding)lunarEnvMap.encoding=THREE.sRGBEncoding;
  return lunarEnvMap;
}
function makeLunarEnvPMREM(){
  if(lunarEnvRT)return lunarEnvRT.texture;
  try{
    const pm=new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    lunarEnvRT=pm.fromEquirectangular(makeLunarEnvMap());
    pm.dispose();
    return lunarEnvRT.texture;
  }catch(e){
    return makeLunarEnvMap();
  }
}
function makeLunarBrushedTex(){
  if(lunarBrushedMap)return lunarBrushedMap;
  const random=mulberry32(90417);
  lunarBrushedMap=pixTex(512,256,(g,w,h)=>{
    // 高级中性太空钛灰磨砂基底（去蓝偏色，纯正航空钛银灰）
    const bg=g.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,"#d6d8dc");bg.addColorStop(0.45,"#c6c9cf");bg.addColorStop(0.75,"#dcdfe4");bg.addColorStop(1,"#bfc2c8");
    g.fillStyle=bg;g.fillRect(0,0,w,h);
    // 微喷砂磨砂底噪 (Bead-blasted matte micro-grain)
    for(let i=0;i<2400;i++){
      const x=(random()*w)|0,y=(random()*h)|0,v=random()>0.5?246:138;
      g.fillStyle=`rgba(${v},${v},${v+2},${(0.03+random()*0.05).toFixed(3)})`;
      g.fillRect(x,y,2,1);
    }
    // CNC 精密水平拉丝发丝纹 (Anisotropic brushed titanium hairlines)
    for(let i=0;i<680;i++){
      const x=random()*w,y=random()*h,len=35+random()*240;
      const bright=random()>0.45;
      g.strokeStyle=bright
        ?`rgba(252,253,255,${(0.07+random()*0.12).toFixed(3)})`
        :`rgba(58,60,65,${(0.05+random()*0.09).toFixed(3)})`;
      g.lineWidth=0.5+random()*1.15;
      g.beginPath();g.moveTo(x,y);g.lineTo(Math.min(w,x+len),y+(random()-0.5)*0.6);g.stroke();
    }
    // 航空蒙皮浅接缝与精密沉头铆钉
    g.strokeStyle="rgba(64,66,72,0.22)";g.lineWidth=1.2;
    g.strokeRect(4,4,w-8,h-8);
    g.beginPath();g.moveTo(w*0.5,4);g.lineTo(w*0.5,h-4);g.stroke();
    g.fillStyle="rgba(76,78,84,0.35)";
    for(const rx of [14,w*0.5-10,w*0.5+10,w-14])for(const ry of [14,h-14]){
      g.beginPath();g.arc(rx,ry,2.4,0,Math.PI*2);g.fill();
    }
  },{smooth:true,mipmaps:true});
  lunarBrushedMap.wrapS=lunarBrushedMap.wrapT=THREE.RepeatWrapping;
  return lunarBrushedMap;
}
function makeLunarBrushedRoughTex(){
  if(lunarBrushedRoughMap)return lunarBrushedRoughMap;
  const random=mulberry32(90419);
  lunarBrushedRoughMap=pixTex(256,128,(g,w,h)=>{
    g.fillStyle="rgb(172,172,172)";g.fillRect(0,0,w,h);
    for(let i=0;i<360;i++){
      const x=random()*w,y=random()*h,len=25+random()*140;
      const v=Math.round(132+random()*84);
      g.strokeStyle=`rgba(${v},${v},${v},0.35)`;
      g.lineWidth=0.6+random()*1.3;
      g.beginPath();g.moveTo(x,y);g.lineTo(Math.min(w,x+len),y);g.stroke();
    }
  },{smooth:true,mipmaps:true,linear:true});
  lunarBrushedRoughMap.wrapS=lunarBrushedRoughMap.wrapT=THREE.RepeatWrapping;
  return lunarBrushedRoughMap;
}
function makeLunarRackHazardTex(){
  if(lunarRackHazardMap)return lunarRackHazardMap;
  const random=mulberry32(90433);
  lunarRackHazardMap=pixTex(256,64,(g,w,h)=>{
    g.fillStyle="#c99322";g.fillRect(0,0,w,h);
    g.fillStyle="#1c1e22";
    for(let x=-h;x<w+h;x+=36){
      g.beginPath();g.moveTo(x,h);g.lineTo(x+18,h);g.lineTo(x+18+h,0);g.lineTo(x+h,0);g.closePath();g.fill();
    }
    // 工业刮痕与月尘磨损
    for(let i=0;i<260;i++){
      g.fillStyle=i%3===0?"rgba(170,174,180,0.22)":"rgba(24,26,30,0.24)";
      g.fillRect(random()*w,random()*h,2+random()*9,1+random()*2);
    }
  },{smooth:true,mipmaps:true});
  lunarRackHazardMap.wrapS=lunarRackHazardMap.wrapT=THREE.RepeatWrapping;
  return lunarRackHazardMap;
}
function makeLunarRackBadgeTex(){
  if(lunarRackBadgeMap)return lunarRackBadgeMap;
  const random=mulberry32(90441);
  lunarRackBadgeMap=pixTex(512,128,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,w,h);
    gr.addColorStop(0,"#222428");gr.addColorStop(0.5,"#30333a");gr.addColorStop(1,"#1c1e22");
    g.fillStyle=gr;g.fillRect(0,0,w,h);
    // 顶部/底部重工业黄黑斜纹警示条
    g.fillStyle="#c99322";g.fillRect(0,0,w,12);g.fillRect(0,h-12,w,12);
    g.fillStyle="#181a1e";
    for(let x=-16;x<w+16;x+=24){
      g.beginPath();g.moveTo(x,12);g.lineTo(x+11,12);g.lineTo(x+21,0);g.lineTo(x+10,0);g.closePath();g.fill();
      g.beginPath();g.moveTo(x,h);g.lineTo(x+11,h);g.lineTo(x+21,h-12);g.lineTo(x+10,h-12);g.closePath();g.fill();
    }
    // 工业刮痕与钢板铆钉
    for(let i=0;i<220;i++){
      g.fillStyle=i%2===0?"rgba(220,224,230,0.06)":"rgba(12,14,16,0.18)";
      g.fillRect(random()*w,12+random()*(h-24),4+random()*22,1);
    }
    g.strokeStyle="#767c86";g.lineWidth=3;g.strokeRect(6,15,w-12,h-30);
    g.fillStyle="#8a909a";
    for(const rx of [18,w-18])for(const ry of [26,h-26]){
      g.beginPath();g.arc(rx,ry,4,0,Math.PI*2);g.fill();
    }
    g.fillStyle="#eef0f4";g.font="bold 31px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
    g.fillText("SEC-07  //  HEAVY RIG-04",w/2,h*0.44);
    g.fillStyle="#d8a23e";g.font="bold 15px Orbitron, monospace";
    g.fillText("LUNAR INDUSTRIAL BALL RACK  ·  0.166G",w/2,h*0.74);
  },{smooth:true,mipmaps:true});
  return lunarRackBadgeMap;
}
window.AIBALunarMetal=Object.freeze({
  makeEnvPMREM:makeLunarEnvPMREM,
  makeBrushedTex:makeLunarBrushedTex,
  makeBrushedRoughTex:makeLunarBrushedRoughTex,
  makeRackBadgeTex:makeLunarRackBadgeTex
});

function buildVenueEquipment(root,name,theme){
  const moon=name==="lunarCrater",timber=name==="rainforest"||name==="flowerCourt";
  const skin=new THREE.Group();skin.name="rackVenue:"+name;
  if(moon){
    const env=makeLunarEnvPMREM(),bTex=makeLunarBrushedTex(),rTex=makeLunarBrushedRoughTex();
    // 高级航空拉丝钛灰（主装甲与结构梁：纯正高级中性灰 + 细腻磨砂金属反光）
    const tiBrushed=new THREE.MeshPhysicalMaterial({
      color:0x9498a0,map:bTex,roughnessMap:rTex,bumpMap:bTex,bumpScale:0.006,
      roughness:0.27,metalness:0.84,clearcoat:0.24,clearcoatRoughness:0.32,
      envMap:env,envMapIntensity:1.06
    });
    // 精密 CNC 阳极氧化亮银钛（导轨、液压活塞杆、倒角防撞护条）
    const tiSilver=new THREE.MeshPhysicalMaterial({
      color:0xd2d6de,map:bTex,roughnessMap:rTex,bumpMap:bTex,bumpScale:0.004,
      roughness:0.20,metalness:0.90,clearcoat:0.30,clearcoatRoughness:0.24,
      envMap:env,envMapIntensity:1.22
    });
    // 磨砂深枪灰航空合金（内胆机箱、减震筒、登月脚盘基座）
    const gunmetal=new THREE.MeshStandardMaterial({
      color:0x363940,roughnessMap:rTex,bumpMap:bTex,bumpScale:0.005,
      roughness:0.36,metalness:0.76,envMap:env,envMapIntensity:0.90
    });
    // 钛金/钨钢精密紧固件点缀色
    const tiChampagne=new THREE.MeshStandardMaterial({
      color:0xb8a688,roughness:0.26,metalness:0.85,envMap:env,envMapIntensity:0.98
    });
    // 硬核工业黄黑警示装甲材质 + 外露铜质液压管线
    const hazardMat=new THREE.MeshStandardMaterial({
      map:makeLunarRackHazardTex(),roughness:0.56,metalness:0.28,envMap:env,envMapIntensity:0.55
    });
    const copperPipe=new THREE.MeshStandardMaterial({
      color:0xa86438,roughness:0.34,metalness:0.84,envMap:env,envMapIntensity:0.92
    });
    const badgeMat=new THREE.MeshStandardMaterial({
      map:makeLunarRackBadgeTex(),roughness:0.38,metalness:0.58,envMap:env,envMapIntensity:0.72
    });
    const box=(w,h,d,x,y,z,mat=tiBrushed)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;skin.add(mesh);return mesh;
    };
    const rod=(x,y,z,rTop,rBot,height,seg=12,mat=tiSilver)=>{
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,height,seg),mat);
      mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;skin.add(mesh);return mesh;
    };
    const bolt=(x,y,z)=>rod(x,y,z,.017,.017,.026,8,tiChampagne);
    if(root.userData.rackKind==="rack"){
      // 1. 四角航天液压减震支腿 + 圆盘形防沉降登月足垫（底面精确落在 y=-0.45）
      for(const x of [-.57,.57])for(const z of [-.16,.16]){
        rod(x,-.432,z,.062,.082,.036,12,gunmetal);         // 碟形登月足垫
        rod(x,-.405,z,.042,.054,.022,12,tiChampagne);      // 钛金球铰锁紧环
        rod(x,-.315,z,.044,.044,.16,12,gunmetal);          // 下段磨砂枪灰减震外筒
        const railY=.41-x*.14-.12;
        const upH=Math.max(.12,railY+.235);
        rod(x,-.235+upH*.5,z,.031,.031,upH,10,tiSilver);   // 上段精密亮银液压立柱
        box(.086,.058,.082,x,railY-.01,z,tiBrushed);       // 顶部导轨承力耳座
        bolt(x,railY+.028,z);
      }
      // 前后横向加强龙门横梁 + 工业防撞警示护杠 + 外露铜质液压管线
      for(const x of [-.57,.57]){
        box(.065,.048,.34,x,-.24,0,gunmetal);
        box(.042,.032,.36,x,-.24,0,tiSilver);
        box(.078,.052,.37,x,-.375,0,hazardMat);
      }
      // 机箱底部贯穿式外露双铜液压管
      for(const pz of [-.11,.11]){
        const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,1.18,8),copperPipe);
        pipe.rotation.z=Math.PI/2;pipe.position.set(0,-.215,pz);pipe.castShadow=true;skin.add(pipe);
      }
      // 2. 硬核工业切角重钢中心设备舱（黄黑防撞护边 + 铆接装甲肋 + 无遮挡工业铭牌）
      box(1.24,.235,.325,0,-.055,0,gunmetal);              // 深枪灰内胆核心
      box(1.30,.038,.368,0,.068,0,tiBrushed);              // 顶部拉丝钛灰装甲盖板
      box(1.28,.034,.358,0,-.172,0,tiBrushed);             // 底部拉丝钛灰托盘护底
      box(1.32,.016,.376,0,.088,0,tiSilver);               // 上沿 CNC 亮银倒角压条
      box(1.26,.016,.366,0,-.152,0,tiSilver);              // 下沿 CNC 亮银倒角压条
      // 两侧工业铭牌面板（加强肋移至两端 x=±0.50，保证中央铭牌文字 100% 无遮挡）
      for(const sz of [-1,1]){
        const plate=new THREE.Mesh(new THREE.PlaneGeometry(.82,.175),badgeMat);
        plate.position.set(-.01,-.052,sz*.166);
        if(sz<0)plate.rotation.y=Math.PI;
        skin.add(plate);
        for(const rx of [-.52,.50]){
          const rib=box(.052,.205,.028,rx,-.052,sz*.168,gunmetal);
          rib.rotation.z=-.18;
          box(.022,.195,.034,rx,-.052,sz*.170,tiSilver).rotation.z=-.18;
        }
        for(const bx of [-.56,-.44,.44,.56])bolt(bx,.068,sz*.168);
      }
      // 两端重工业黄黑防撞护杠与折叠钢索握把
      for(const sx of [-1,1]){
        box(.044,.195,.30,sx*.638,-.052,0,hazardMat);
        box(.028,.028,.28,sx*.676,.025,0,tiSilver);
        for(const sz of [-.11,.11])box(.038,.026,.026,sx*.656,.025,sz,gunmetal);
      }
      // 3. 双层拉丝银钛斜向承球主导轨 + 侧翼镂空减重护板
      for(const z of [-.142,.142]){
        const mainRail=box(1.42,.048,.052,0,.41-.112,z,tiSilver);
        mainRail.rotation.z=-.139;
        const sideWing=box(1.45,.040,.032,0,.342,z*1.32,tiBrushed);
        sideWing.rotation.z=-.139;
        const underTrim=box(1.38,.018,.044,0,.252,z*1.12,gunmetal);
        underTrim.rotation.z=-.139;
        // 导轨与机箱之间的 CNC 竖向支撑立柱（置于两端与内缩中柱，不挡侧面铭牌）
        for(const kx of [-.44,.44]){
          const topY=.285-kx*.14,h=Math.max(.04,topY-.075);
          box(.038,h,.036,kx,.075+h*.5,z,gunmetal);
          box(.022,h*.75,.042,kx,.075+h*.5,z,tiSilver);
        }
      }
      // 5 个球位下方的钨钢防滑定位横梁
      for(let i=0;i<5;i++){
        const sx=(i-2)*.30-.15,sy=.41-(i-2)*.042-.105;
        box(.026,.038,.31,sx,sy,0,gunmetal);
        box(.014,.042,.26,sx,sy+.004,0,tiChampagne);
      }
      // 低端重型拉丝钛金属液压挡球器
      box(.052,.148,.39,.765,.248,0,tiSilver);
      box(.032,.118,.35,.742,.250,0,gunmetal);
      box(.018,.045,.37,.778,.265,0,tiChampagne);
    }else{
      // 超远 5 分球座 & 中圈 10 分球座：航天四爪液压升降立柱座
      const h=root.userData.rackHeight,y=-h/2;
      const mid=root.userData.rackKind==="middle",foot=mid?.33:.245;
      // 底层重型碟形登月基座 + 四向斜撑爪
      rod(0,y+.035,0,foot*.82,foot,.07,16,gunmetal);
      rod(0,y+.085,0,foot*.58,foot*.76,.045,16,tiBrushed);
      for(const s of [-1,1])for(const z of [-1,1]){
        const leg=box(.048,.075,foot*.62,s*foot*.44,y+.065,z*foot*.44,tiSilver);
        leg.rotation.y=Math.atan2(s,z);
        bolt(s*foot*.64,y+.072,z*foot*.64);
      }
      // 同轴双层拉丝钛灰+亮银液压立柱、黄黑工业法兰环与外露铜液压管
      rod(0,y+h*.36,0,mid?.132:.102,mid?.144:.112,h*.54,16,tiBrushed);
      rod(0,y+h*.64,0,mid?.098:.076,mid?.098:.076,h*.56,16,tiSilver);
      for(const [idx,ry] of [.24,.54,.80].entries()){
        rod(0,y+h*ry,0,mid?.152:.124,mid?.152:.124,.044,16,idx===1?hazardMat:gunmetal);
        rod(0,y+h*ry,0,mid?.158:.129,mid?.158:.129,.014,16,tiChampagne);
      }
      for(const px of [-1,1]){
        rod(px*(mid?.142:.112),y+h*.48,0,.013,.013,h*.62,8,copperPipe);
      }
      // 顶部精密承球盘与四爪航空机械卡座
      rod(0,y+h-.032,0,mid?.222:.178,mid?.155:.125,.058,16,tiBrushed);
      rod(0,y+h-.002,0,mid?.185:.148,mid?.185:.148,.016,16,gunmetal);
      for(const x of [-.132,.132])for(const z of [-.132,.132]){
        rod(x,y+h+.012,z,.022,.028,.054,10,tiSilver);
        bolt(x,y+h+.040,z);
      }
    }
    return AIBAModelDetail.batchFixedHardware(skin);
  }
  const frame=new THREE.MeshStandardMaterial({color:theme.frame,roughness:moon?.36:.71,metalness:theme.metalness});
  const body=new THREE.MeshStandardMaterial({color:theme.body,roughness:moon?.38:.81,metalness:theme.metalness});
  const trim=new THREE.MeshStandardMaterial({color:theme.trim,roughness:.64,metalness:moon?.5:.12});
  if(timber){body.map=localRackWood();trim.map=body.map;}
  const box=(w,h,d,x,y,z,mat=body)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;skin.add(mesh);return mesh;
  };
  const rod=(x,y,z,rad,height,mat=frame)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad*1.16,height,moon?8:9),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;skin.add(mesh);return mesh;
  };
  const bolt=(x,y,z)=>rod(x,y,z,.018,.025,trim);
  if(root.userData.rackKind==="rack"){
    for(const x of [-.57,.57])for(const z of [-.16,.16]){
      rod(x,-.37,z,moon?.063:.045,.16);
      box(timber?.18:.15,.05,.13,x+z*.08,-.423,z,moon?frame:trim);
      const railY=.41-x*.14-.12;
      box(moon?.083:.070,railY+.34,.071,x,(railY-.34)*.5,z,moon?body:frame);
      bolt(x,railY+.03,z);
    }
    for(const z of [-.145,.145]){
      const beam=box(1.39,timber?.063:.047,.057,0,.41-.113,z,frame);
      beam.rotation.z=-.139;
      const guard=box(1.44,.042,.058,0,.335,z*1.31,trim);
      guard.rotation.z=-.139;
    }
    box(.043,.13,.38,.77,.246,0,moon?trim:body);
    if(timber){
      for(const [i,y] of [.131,.028,-.085].entries()){
        const plank=box(1.32-i*.05,.087,.052,i%2?.022:-.025,y,.211,i===1?trim:body);
        plank.rotation.z=(i-1)*.024;
      }
      for(const x of [-.54,.54])box(.053,.31,.06,x,.026,.222,frame).rotation.z=x*.11;
    }else{
      box(1.28,.245,.353,0,-.047,0,body);
      if(moon){
        for(const x of [-.46,-.20,.08,.32,.53]){
          box(.058,.158,.013,x,-.009,.183,frame).rotation.z=-.22;
        }
        for(const x of [-.60,.60])for(const z of [-.17,.17])bolt(x,.091,z);
        box(.71,.023,.347,0,-.15,0,trim);
      }
    }
  }else{
    const h=root.userData.rackHeight,y=-h/2;
    const mid=root.userData.rackKind==="middle",foot=mid?.33:.243;
    rod(0,y+.07,0,foot,.14,moon?frame:body);
    if(timber){
      for(const s of [-1,1])for(const z of [-1,1]){
        const post=box(.095,h-.19,.10,s*.106,y+h*.50,z*.103,s===z?body:trim);
        post.rotation.x=z*.074;post.rotation.z=s*.063;
      }
      box(.33,.092,.32,0,y+h-.04,0,frame);
    }else{
      rod(0,y+h*.51,0,mid?.127:.096,h-.18,body);
      for(const ry of [.25,.61,.82])rod(0,y+h*ry,0,mid?.147:.122,.041,trim);
      rod(0,y+h-.026,0,mid?.214:.172,.054,frame);
      if(moon)for(const s of [-1,1])for(const z of [-1,1])bolt(s*foot*.60,y+.145,z*foot*.60);
    }
    for(const x of [-.131,.131])for(const z of [-.131,.131])rod(x,y+h+.009,z,.025,.051,trim);
  }
  return skin;
}
function applyRackVenue(name){
  for(const root of [...rackStands,...deepStands,halfCourtBall?.ped]){
    if(!root?.userData.rackModel||root.userData.rackVenue===name)continue;
    const old=root.userData.venueSkin;
    if(old){
      root.remove(old);
      const mats=new Set();
      old.traverse(o=>{if(o.isMesh){o.geometry.dispose();mats.add(o.material);}});
      mats.forEach(m=>m.dispose());
    }
    root.userData.rackModel.visible=name==="indoor";
    root.userData.venueSkin=name==="indoor"?null:buildVenueEquipment(root,name,rackVenuePalette(name));
    if(root.userData.venueSkin)root.add(root.userData.venueSkin);
    root.userData.rackVenue=name;
  }
  rackFootprint.length=0;
}

function buildRacks(){
  const standM=new THREE.MeshLambertMaterial({color:0x2255aa});
  RACKS.forEach((r,ri)=>{
    const stand=rackWithVenueModel(window.AIBAModelDetail?.enabled?AIBAModelDetail.rack(standM):
      new THREE.Mesh(new THREE.BoxGeometry(1.5,0.55,0.5),standM),"rack");
    scene.add(stand);rackStands[ri]=stand;
    rackBalls[ri]=[];
    for(let b=0;b<5;b++){
      const mat=b===4?matGold:matBall;
      const m=new THREE.Mesh(ballGeo,mat);
      m.rotation.set(rnd(0,1),rnd(0,1),0);
      scene.add(m);rackBalls[ri].push(m);
    }
  });
  placeRacks(currentRackSide());
  DEEPS.forEach((d,i)=>{
    const pedMat=new THREE.MeshLambertMaterial({color:0x1f7a28});
    const ped=rackWithVenueModel(window.AIBAModelDetail?.enabled?AIBAModelDetail.pedestal(.45,.9,pedMat):
      new THREE.Mesh(new THREE.BoxGeometry(0.45,0.9,0.45),pedMat),"deep",.9);
    const dir=HOOP.clone().sub(d.p);dir.y=0;dir.normalize();
    const base=d.p.clone().addScaledVector(dir,-0.8);
    ped.position.set(base.x,0.45,base.z);scene.add(ped);deepStands[i]=ped;
    const m=new THREE.Mesh(ballGeo,matDeep);
    m.position.set(base.x,1.05,base.z);scene.add(m);
    deepBalls[i]=m;
  });
  const hdir=HOOP.clone().sub(HALFCOURT.p);hdir.y=0;hdir.normalize();
  const hbase=HALFCOURT.p.clone().addScaledVector(hdir,-0.8);
  const hpedMat=new THREE.MeshLambertMaterial({color:0x1f7a28});
  const hped=rackWithVenueModel(window.AIBAModelDetail?.enabled?AIBAModelDetail.pedestal(.62,1,hpedMat,1):
    new THREE.Mesh(new THREE.BoxGeometry(0.62,1.0,0.62),hpedMat),"middle",1);
  hped.position.set(hbase.x,0.5,hbase.z);hped.visible=false;scene.add(hped);
  halfCourtBall=new THREE.Mesh(ballGeo,matDeep);
  halfCourtBall.position.set(hbase.x,1.16,hbase.z);halfCourtBall.visible=false;scene.add(halfCourtBall);
  halfCourtBall.ped=hped;
}
function resetRackBalls(){
  const single=G.mode==="rackrush"?G.rush?.spot??2:G.practice?2:null;
  const course=single===null&&G.mode!=="battle"&&G.mode!=="lastshot";
  rackStands.forEach((stand,i)=>{stand.visible=course||i===single;});
  deepStands.forEach(stand=>{stand.visible=course;});
  placeRacks(currentRackSide());
  rackBalls.forEach((row,i)=>{
    row.forEach((m,b)=>{
      m.visible=rackStands[i].visible&&(!G.practice||b<3);
      m.material=!G.practice&&(b===4||(G.mode==="contest"&&i===G.moneyRack))?matGold:matBall;
    });
    if(rackStands[i].visible)seatRackBalls(i,0,false);
  });
  deepBalls.forEach(m=>{m.visible=course;});
  if(halfCourtBall){halfCourtBall.visible=false;halfCourtBall.ped.visible=false;}
}

/* first-person hands + held ball */
const hands=new THREE.Group();
let handBall;
function buildHands(){
  const skin=new THREE.MeshLambertMaterial({color:0xf4c89c});
  const sleeve=new THREE.MeshLambertMaterial({color:0x1d428a});
  [[-0.22,1],[0.22,-1]].forEach(s=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.13,0.42),sleeve);
    arm.position.set(s[0],-0.06,0.16);arm.rotation.y=s[1]*0.25;hands.add(arm);
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.16),skin);
    h.position.set(s[0]*0.85,-0.04,-0.07);hands.add(h);
    const thumb=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.09,0.055),skin);
    thumb.position.set(s[0]*0.85+s[1]*0.08,-0.03,-0.04);thumb.rotation.z=s[1]*0.18;hands.add(thumb);
    for(let i=0;i<4;i++){
      const f=new THREE.Mesh(new THREE.BoxGeometry(0.026,0.08,0.045),skin);
      f.position.set(s[0]*0.85+(i-1.5)*0.032,-0.12,-0.105);hands.add(f);
    }
  });
  handBall=new THREE.Mesh(ballGeo,matBall);
  handBall.position.set(0,0.08,-0.12);
  hands.add(handBall);
  hands.position.set(0,-0.5,-0.62);
  camera.add(hands);
  if(window.AIBACharacterShading?.register)window.AIBACharacterShading.register(hands);
}


window.AIBA.runtime.register("rendering:props",Object.freeze({
  buildRacks,resetRackBalls,buildHands,placeRacks,currentRackSide,rackSlotWorld,applyRackVenue,rackVenuePalette,
  rackDetourWaypoint,rackPointDist,rackSegDist,
  getRackSide:()=>rackSide,seatRackBalls,takeRackBall,refillRackBalls,
  getRackBalls:()=>({regular:rackBalls,deep:deepBalls,regularStands:rackStands,deepStands,halfCourt:halfCourtBall}),
  getHands:()=>({group:hands,ball:handBall})
}));
