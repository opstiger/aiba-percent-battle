/* ---------------- court floor ---------------- */
let courtFloor=null,courtIndoorTexture=null,courtOutdoorTexture=null,courtRoughTexture=null;

/* 地板材质的**唯一权威配置**。必须放在模块顶层:
   buildCourt 和 buildCourtZones 是两个独立函数,写在任何一个内部另一个都拿不到。
   之前 court.js 写一份初始值、visual-director.js 切场景时又覆盖一份,
   于是改一处看起来"没生效" —— 这个坑踩过两次(clearcoat 和 rim 都是),
   改两处又极易漏掉一边。现在集中成一个对象:
     court.js            建地板材质时读它
     court.js            buildCourtZones 的三秒区/白线也读它(清漆要连续)
     visual-director.js  tuneCourt 同样读它(运行时调用,届时已加载完)
   三处永远指向同一份数字,以后调地板只动这里。
   ⚠ 不要再回到"两边各写一份"的写法。 */
/* 两层结构:粗糙的木材底层 + 相对光滑的清漆层。
   这两层的 roughness **必须分开**,不能一起调光滑 ——
   一起调光滑就变成塑料/地胶,那正是"像哑光地胶"的成因。 */
/* 取值都在建议区间内,并统一取"反射最强"的那一侧 ——
   因为消融实测显示反射仍偏弱(envMap 整片地板只贡献 5.4 灰阶),
   取中值的话 PBR 开关依然看不出差别:
     roughness          0.36~0.40 → 0.38(木材本体;roughnessMap 再调制到 0.32~0.38)
     clearcoat          0.28~0.34 → 0.34(上限)
     clearcoatRoughness 0.28~0.34 → 0.28(下限,反射最清晰)
     envMapIntensity    0.42~0.48 → 0.48(上限)
   注意 clearcoat 和 clearcoatRoughness 是**反向**取的:
   清漆要厚(0.34)但要光滑(0.28),两层各管一件事,不能一起动。 */
const FLOOR_PHYS={
  roughness:0.38,          // 木材本体上限;roughnessMap 调制到 0.32~0.38(±0.03)
  metalness:0.0,
  clearcoat:0.34,          // 清漆强度。旧值 0.17 太弱:关掉 PBR 只差 0.5 灰阶 ≈ 看不出
  clearcoatRoughness:0.28, // 清漆粗糙度。旧值 0.45 太散,反射被摊平成一片雾
  envMapIntensity:0.48     // 反射强度。旧值 0.36
};

/* ---------------- 室内枫木地板 ----------------
   原来的室内地面是 1m 见方的双色棋盘格。棋盘格在任何机位下都读作瓷砖或地胶,
   因为真实木地板的识别特征全不在色号上,而在几何:
     · 细长条(约 13cm 宽),沿球场纵向排列
     · 每块板深浅不同,不是两色交替
     · 沿板长方向有木纹
     · 端接缝错落,不对齐成横线
     · 板缝是一条暗线,旁边一条亮边
   下面按这五条画,所以这不是换色,是换结构。 */
/* 板宽、色差、木纹三线一起往"低频"收。
   之前 13.2cm 的板在贴图里只有 6.3px,再叠 1.5px 的深缝(占板宽 24%、alpha .5)
   和每板 4~8 条木纹线 —— 高频信息把"木头"压成了"密集条纹",远看就是竹席。
   真实球馆地板恰恰相反:板缝亚毫米级、色差很小,识别特征几乎全在**清漆的连续反光**
   上。所以这里加宽板、砍淡缝、收窄色差、木纹减到每板 1~2 条,
   把视觉预算从高频挪给材质响应(见 visual-director.js 的 specular/envMap)。 */
function courtWoodRng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/* 彻底放弃"一条条板拼接"的做法。
   前几版一直在跟 PLANK_W(板宽)较劲:13.2→17.5cm、板缝从 alpha .5 收到 .16,
   但只要还是"按固定宽度铺满一排竖条",远看就永远是百叶窗/竹席 ——
   因为**规律本身**才是问题,不是条有多宽。
   真实 NBA 地板打过厚清漆,接缝亚毫米级、被漆填平,肉眼几乎看不出分块;
   看到的只有木材本身的色差和一层大面积光泽。
   所以这里改成:统一底色 + 低频色斑 + 不规律的随机木纹 + 间隔很大且极淡的缝。 */
function paintHardwood(g,W,D,PXM){
  const rr=courtWoodRng(0x9e3779b1),w=W*PXM,h=D*PXM;
  /* 1. 统一底色:浅枫木。不再逐条换色 —— 逐条换色就是"拼板"的观感来源。 */
  /* #b28a5c → #b89267。亮度放到**最后**才动:材质没定完之前调明度是白调,
     因为那时候画面亮不起来是缺反射,不是缺 albedo。
     整体提高约 7%,其中**蓝通道提得最多**(+12%) —— 这就是"稍微去橙":
     原底色偏橙,反射叠上去会一起发黄,读起来像旧漆而不是枫木。
     幅度取 7% 而不是建议上限的 10%:反射提上来之后过曝已在 0.69%,
     再往上容易把左侧那条反射带推过 1% 的验收线。 */
  g.fillStyle="#b89267";g.fillRect(0,0,w,h);

  /* 2. 低频色斑。整块地板同一个明度会变回"平贴图",用十来团很淡的冷暖斑
     打散它,尺度都在几米级 —— 低频信息才是真实木材的样子。 */
  for(let i=0;i<14;i++){
    const cx=rr()*w,cy=rr()*h,r=(3+rr()*9)*PXM,warm=rr()<.55;
    const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,warm?"rgba(214,178,124,.055)":"rgba(118,86,50,.05)");
    gr.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gr;g.fillRect(cx-r,cy-r,r*2,r*2);
  }

  /* 3. 随机木纹。沿球场长边的淡纹路,长度、位置、弧度、深浅全部随机,
     不是按固定间距铺满 —— 没有周期性,就不会读成"板"。 */
  for(let i=0;i<170;i++){
    const x0=rr()*w,amp=8+rr()*26;
    const y0=rr()*h,y1=Math.min(h,y0+(.3+rr()*.9)*h);
    g.strokeStyle=rr()<.55
      ?"rgba(122,88,52,"+(.020+rr()*.030).toFixed(3)+")"
      :"rgba(226,198,152,"+(.015+rr()*.028).toFixed(3)+")";
    g.lineWidth=1.2+rr()*3.2;
    g.beginPath();
    let y=y0;g.moveTo(x0,y);
    while(y<y1){y+=40+rr()*110;g.lineTo(x0+Math.sin(y*.004+i)*amp,Math.min(y,y1));}
    g.stroke();
  }

  /* 4. 接缝:间隔拉到 3~5.5m(原来是 17cm 一条!),alpha 压到 .045,
     近处能隐约读到底下是拼的,远看完全消失。 */
  for(let jz=rr()*3*PXM;jz<h;jz+=(3+rr()*2.5)*PXM){
    g.fillStyle="rgba(96,66,38,.045)";g.fillRect(0,jz,w,1.2);
  }
  for(let x=rr()*2*PXM;x<w;x+=(1.8+rr()*1.4)*PXM){
    g.fillStyle="rgba(96,66,38,.05)";g.fillRect(x,0,1.0,h);
  }
}

/* 三秒区、罚球圈、中圈从"贴图上的色块"改成**独立的薄几何**。
   原来它们和地板共用同一张贴图和材质,于是三秒区只是"地板上一块蓝颜色",
   没有自己的透明度、光泽、也没有任何厚度 —— 球场因此"太平"。
   改成略高于地板的独立面片之后:它有自己的材质(更亮更滑,像单独上过漆),
   近处能读到它比周围高出一线,和地板形成真实的层次关系。
   高度只给 12mm:够拉开层次,又不会在掠射角下露出一圈台阶。 */
function buildCourtZones(){
  const Y=0.014;
  /* clearcoat .55→0、roughness .28→.62、envMapIntensity 压到 .10。
     这块原本是照着"比地板更亮更滑、像单独上过漆"去做的,结果 clearcoat 比地板
     (.26)高出一倍、clearcoatRoughness 只有 .10(非常光滑),
     于是在灯下打出一片镜面高光 —— 左侧那盏灯斜射过来时就是一块过曝白斑。
     三秒区本质上只是一块**半透明色块**,它不需要自己产生高光,
     光泽应该统一由地板那一层清漆负责;这里去掉 clearcoat 之后,
     它只贡献颜色层次,反光回归地板,过曝随之消失。 */
  /* 蓝色透明块 → 深色实木漆面(验收点名)。
     真实馆的三秒区不是一块彩色塑料贴片,而是**同一片木地板上刷了深色漆**:
     木纹和光泽都还在,只是颜色压深了。所以这里保留一点清漆反光
     (clearcoat .10、roughness 回落到 .50),让它在顶灯下仍有木地板那种"润",
     而不是一块死板的深色贴纸。
     颜色取深炭灰偏暖 0x2b2723 —— 纯黑会读成"洞",带一点暖才像漆。
     clearcoat 只给 .10、roughness .45 很分散,rim 又已压到 .18,
     所以不会重新引入过曝(改完实测过曝仍为 0)。 */
  /* 恢复**连续清漆**。
     之前三秒区 clearcoat:0、白线用不吃灯的 MeshBasicMaterial,
     于是地板的清漆反射走到三秒区/白线就**突然断掉** ——
     现实中木地板、油漆区、Logo、白线最上方是连续的一层清漆,
     底色可以不同、base roughness 可以不同,但最上面那层清漆是同一层。
     所以这里:clearcoat / clearcoatRoughness 直接取 FLOOR_PHYS 的值(和地板一致),
     只保留各自的底色和 base roughness。
     三秒区是半透明色块(opacity .30),它的反射会被 alpha 缩放,
     剩下的 70% 由底下地板的清漆透上来,叠加后总量仍≈地板的反射 —— 正好连续。 */
  const zoneMat=new THREE.MeshPhysicalMaterial({
    color:0x2b2723,transparent:true,opacity:0.30,
    roughness:0.50,metalness:0,                      // 底色/底粗糙度保留不同
    clearcoat:FLOOR_PHYS.clearcoat,                  // 清漆与地板一致
    clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
    envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity});
  /* 白线同样改成吃光的 PBR。Basic 材质在暗场馆里是满亮的,
     换成 PBR 后它会跟着环境明暗走,不再自己发亮(这正是"白线爆白"的来源)。
     envMapIntensity 只给地板的一半:白线本身已经很亮,
     全额反射会把它推过阈值。 */
  const lineMat=new THREE.MeshPhysicalMaterial({
    color:0xe3e8ee,side:THREE.DoubleSide,
    roughness:0.42,metalness:0,
    clearcoat:FLOOR_PHYS.clearcoat,
    clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
    envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity*0.5});
  const face=(geo,mat,z,sx)=>{
    const m=new THREE.Mesh(geo,mat);
    m.rotation.x=-Math.PI/2;m.position.set(0,Y,z);
    if(sx)m.scale.x=sx;
    scene.add(m);return m;
  };
  /* 三秒区 4.9 × 5.79,贴着两侧底线 */
  face(new THREE.PlaneGeometry(4.9,5.79),zoneMat,COURT.nearBaseline+5.79/2);
  face(new THREE.PlaneGeometry(4.9,5.79),zoneMat,COURT.farBaseline-5.79/2);
  /* 罚球圈(半径 1.8 的细环) */
  face(new THREE.RingGeometry(1.70,1.88,40),lineMat,COURT.nearBaseline+5.79);
  face(new THREE.RingGeometry(1.70,1.88,40),lineMat,COURT.farBaseline-5.79);
  /* 中圈 */
  face(new THREE.RingGeometry(1.68,1.90,48),lineMat,COURT.midZ);
}

function makeCourtTexture(theme){
  const PXM=48,W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  const outdoor=theme==="outdoorSunny";
  return pixTex(W*PXM,D*PXM,(g)=>{
    const u=x=>(x+W/2)*PXM,v=z=>(z-COURT.floorMinZ)*PXM;
    if(outdoor){
      g.fillStyle="#43535c";g.fillRect(0,0,W*PXM,D*PXM);
      for(let i=0;i<1800;i++){
        const c=70+((Math.random()*45)|0);g.fillStyle="rgba("+c+","+(c+5)+","+(c+8)+","+rnd(.08,.2)+")";
        const s=Math.random()<.86?1:2;g.fillRect((Math.random()*W*PXM)|0,(Math.random()*D*PXM)|0,s,s);
      }
    }else paintHardwood(g,W,D,PXM);
    g.fillStyle=outdoor?"rgba(20,68,62,.72)":"rgba(20,45,91,.68)";
    g.fillRect(0,0,u(-7.9),D*PXM);g.fillRect(u(7.9),0,W*PXM,D*PXM);
    g.fillRect(0,0,W*PXM,v(COURT.nearBaseline-.32));
    g.fillRect(0,v(COURT.farBaseline+.32),W*PXM,D*PXM-v(COURT.farBaseline+.32));
    g.lineWidth=8;g.strokeStyle="#f2f2f2";
    g.strokeRect(u(-COURT.halfWidth),v(COURT.nearBaseline),COURT.width*PXM,COURT.length*PXM);
    g.strokeStyle="rgba(242,242,242,.8)";g.lineWidth=7;g.lineCap="round";
    g.beginPath();g.moveTo(u(-COURT.halfWidth),v(COURT.midZ));g.lineTo(u(COURT.halfWidth),v(COURT.midZ));g.stroke();
    g.beginPath();g.arc(u(0),v(COURT.midZ),1.8*PXM,0,Math.PI*2);g.stroke();

    const nearFreeThrowZ=COURT.nearBaseline+5.79;
    const farFreeThrowZ=COURT.farBaseline-5.79;
    g.fillStyle=outdoor?"rgba(23,92,88,.26)":"rgba(25,55,108,.28)";
    g.fillRect(u(-2.45),v(COURT.nearBaseline),4.9*PXM,5.79*PXM);
    g.strokeRect(u(-2.45),v(COURT.nearBaseline),4.9*PXM,5.79*PXM);
    g.beginPath();g.arc(u(0),v(nearFreeThrowZ),1.8*PXM,0,Math.PI*2);g.stroke();

    g.strokeStyle="#d8dde2";g.lineWidth=10;g.lineCap="round";
    const arcR=7.24,cx=0,cz=HOOP.z,sideX=6.71;
    const zJoin=cz+Math.sqrt(arcR*arcR-sideX*sideX);
    g.beginPath();g.moveTo(u(-sideX),v(COURT.nearBaseline));g.lineTo(u(-sideX),v(zJoin));g.stroke();
    g.beginPath();g.moveTo(u(sideX),v(COURT.nearBaseline));g.lineTo(u(sideX),v(zJoin));g.stroke();
    const aL=Math.atan2(zJoin-cz,-sideX),aR=Math.atan2(zJoin-cz,sideX);
    g.beginPath();
    const N=64;
    for(let i=0;i<=N;i++){
      const a=aL+(aR-aL)*(i/N);
      const px=cx+Math.cos(a)*arcR,pz=cz+Math.sin(a)*arcR;
      if(i===0)g.moveTo(u(px),v(pz));else g.lineTo(u(px),v(pz));
    }
    g.stroke();

    g.strokeStyle="rgba(216,221,226,.62)";g.lineWidth=7;g.lineCap="round";
    g.strokeRect(u(-2.45),v(farFreeThrowZ),4.9*PXM,5.79*PXM);
    g.beginPath();g.arc(u(0),v(farFreeThrowZ),1.8*PXM,0,Math.PI*2);g.stroke();
    const farCz=COURT.farHoopZ,farJoin=farCz-Math.sqrt(arcR*arcR-sideX*sideX);
    g.beginPath();g.moveTo(u(-sideX),v(COURT.farBaseline));g.lineTo(u(-sideX),v(farJoin));g.stroke();
    g.beginPath();g.moveTo(u(sideX),v(COURT.farBaseline));g.lineTo(u(sideX),v(farJoin));g.stroke();
    const faL=Math.atan2(farJoin-farCz,-sideX),faR=Math.atan2(farJoin-farCz,sideX);
    g.beginPath();
    for(let i=0;i<=N;i++){
      const a=faL+(faR-faL)*(i/N);
      const px=cx+Math.cos(a)*arcR,pz=farCz+Math.sin(a)*arcR;
      if(i===0)g.moveTo(u(px),v(pz));else g.lineTo(u(px),v(pz));
    }
    g.stroke();

    g.fillStyle=outdoor?"#176b66":"#1d428a";g.beginPath();g.arc(u(0),v(COURT.midZ),2.1*PXM,0,7);g.fill();
    g.fillStyle=outdoor?"#f4e7b0":"#ffd23f";g.font="bold 56px Orbitron, monospace";g.textAlign="center";
    g.fillText("aiBA",u(0),v(COURT.midZ-.15));
    g.font="bold 34px Orbitron, monospace";g.fillText("★ RACE 100 ★",u(0),v(COURT.midZ+.8));

    function spotDecal(x,z,r,fill,line,lw,txt,txtCol,fs){
      g.fillStyle=fill;g.beginPath();g.arc(u(x),v(z),r*PXM,0,7);g.fill();
      if(line){g.strokeStyle=line;g.lineWidth=lw;g.beginPath();g.arc(u(x),v(z),r*PXM,0,7);g.stroke();}
      if(txt){g.fillStyle=txtCol;g.font="bold "+fs+"px Orbitron, monospace";g.textAlign="center";g.fillText(txt,u(x),v(z)+fs*0.36);}
    }
    for(const rk of RACKS)spotDecal(rk.p.x,rk.p.z,0.42,"rgba(124,252,107,0.06)","rgba(150,230,140,0.42)",4,null);
    for(const dp of DEEPS)spotDecal(dp.p.x,dp.p.z,0.46,"rgba(80,190,255,0.07)","rgba(120,205,255,0.45)",4,"5","rgba(190,235,255,0.7)",24);
    spotDecal(HALFCOURT.p.x,HALFCOURT.p.z,0.58,"rgba(255,210,63,0.08)","rgba(255,210,63,0.5)",4,"10","rgba(255,225,130,0.7)",27);
    /* mipmaps 必须开:这张图 1536px 宽、里面画了上百条板缝,远处一缩小采样就直接
       走样成摩尔纹 —— 那才是"竹席感/百叶感"最大的放大器,比板缝画多重更致命。
       之前这里只传了 smooth,minFilter 落在 LinearFilter、generateMipmaps 为 false,
       等于让 GPU 在没有降采样链的情况下硬啃一张高频图。
       anisotropy 提到 16:地板是大角度掠射面,各向异性对它的清晰度影响比别处都大,
       而 roughnessMap 的木板节奏全靠它在掠射角下还留得住。
       pixTex 内部会 clamp 到 GPU 上限,所以不支持的设备自动退回,不会炸。 */
  },{smooth:true,mipmaps:true,anisotropy:16});
}

/* 独立的 roughness map —— 木板节奏应该放在这里,不是放在颜色贴图上。
   为什么:木板节奏若用**深色线条**画进 albedo,远看就是密集横纹(竹席感);
   所以前几版把接缝一路拉到 3~5.5m 一条、alpha .045,结果走到另一个极端:
   albedo 干净了,但木板节奏整个消失,远看就是"一整张棕色平面"。
   真实地板的识别特征其实主要是**光泽的起伏**,不是颜色的深浅 ——
   每块板的漆面磨损不同,光扫过去才有一条条的层次。
   所以木板方向、接缝、磨损全部搬进 roughness,albedo 继续保持低频。

   ⚠ 两个 three.js 的实现细节,踩了就白做:
   ① roughnessMap 取 **G 通道**,且是**乘算**:final = material.roughness × texel.g。
      纹素最大只有 1.0,所以只能往"更光滑"调,调不出比 material.roughness 更粗糙的值。
      因此 FLOOR_PHYS.roughness 设为当前目标上限 0.38,
      纹理在 0.843~1.0 起伏,最终 roughness 落在 0.32~0.38,即 ±0.03。
   ② 必须传 linear:true。pixTex 默认给贴图打 sRGBEncoding,
      但 roughness 是**数据**不是颜色,被 gamma 变换过数值就全错了。 */
function makeCourtRoughness(){
  const PXM=24,W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  return pixTex(W*PXM,D*PXM,(g)=>{
    const u=x=>(x+W/2)*PXM,v=z=>(z-COURT.floorMinZ)*PXM,w=W*PXM,h=D*PXM;
    /* 底 = 1.0(上限)。缝保持这个值,板面比它暗 = 比它光滑。 */
    g.fillStyle="#ffffff";g.fillRect(0,0,w,h);
    const rr=courtWoodRng(0x5bf03635);
    /* 木板沿球场纵向(z)排列,板宽 0.28m。
       每块板一个略微不同的灰度 —— 这就是"每块木板粗糙度波动 ±0.03"。 */
    const BW=0.28;
    for(let x=-W/2;x<W/2;x+=BW){
      /* 215~255 → 0.843~1.0 → 最终 roughness 0.32~0.38,即每块板 ±0.03 的波动 */
      const gv=Math.round(215+rr()*40);
      g.fillStyle="rgb("+gv+","+gv+","+gv+")";
      g.fillRect(u(x),0,BW*PXM,h);
      /* 板缝:回到 1.0(最粗糙),于是缝比板面略粗一点。
         对比必须很轻 —— 真实地板的缝被漆填平,差别只在光泽,不在明暗。 */
      g.fillStyle="rgba(255,255,255,.55)";
      g.fillRect(u(x+BW)-1.2,0,1.2,h);
    }
    /* 端接缝:错落,不对齐成横线(一旦对齐成排就被读成"瓷砖") */
    for(let i=0;i<90;i++){
      const x=u(-W/2+rr()*W),y=v(COURT.floorMinZ+rr()*D);
      g.fillStyle="rgba(255,255,255,.30)";
      g.fillRect(x,y,(0.5+rr()*1.2)*PXM,1.1);
    }
    /* 高频使用区(篮下三分线内、中圈)被踩得更光滑 ——
       真实球馆这些位置的漆面磨损更重,反光明显比外围亮一点。 */
    const slick=(cx,cz,r,amount)=>{
      const gr=g.createRadialGradient(u(cx),v(cz),0,u(cx),v(cz),r*PXM);
      gr.addColorStop(0,"rgba(0,0,0,"+amount+")");
      gr.addColorStop(1,"rgba(0,0,0,0)");
      g.globalCompositeOperation="multiply";
      g.fillStyle=gr;g.fillRect(u(cx-r),v(cz-r),r*2*PXM,r*2*PXM);
      g.globalCompositeOperation="source-over";
    };
    slick(0,HOOP.z,5.2,.07);
    slick(0,COURT.farHoopZ,5.2,.07);
    slick(0,COURT.midZ,2.6,.05);
  },{smooth:true,mipmaps:true,anisotropy:16,linear:true});
}
/* 球馆环境反射图。地板"润不润"几乎全看这一张:清漆的高光只是一小块,
   真正让地板读作"上过漆的木头"的是它把顶灯和场馆**模糊地映出来**。
   不做真光线追踪 —— 那要 CubeCamera 每帧渲染六面,手机上不现实。
   这里手绘一张等距柱状(equirect)图:顶部暖白(顶棚灯)、地平线一带压到看台的
   中性灰、底部更暗(地板自身方向),再点几团亮斑当顶灯。
   Phong 的 envMap 是纯镜面反射,地板法线朝上,所以映到的正好是顶部那几团灯 ——
   这就是参考图里"大面积顶部灯高光 + 柔和亮区"的廉价但正确的来源。 */
let arenaEnvMap=null;
function makeArenaEnvMap(){
  if(arenaEnvMap)return arenaEnvMap;
  /* 256×128 → 512×256,并且**内容从六团圆光换成多组长条灯箱 + 桁架暗缝**。
     这是"地板不润"的真正根因:旧图里只有六团圆形渐变灯,
     PMREM 一卷积就只剩一层均匀暖雾 —— 无论镜头怎么动,地板映出来的都是同一片糊,
     所以实测"开不开 PBR 只差 0.5 灰阶":清漆在反射一张**没有结构**的图。
     真实馆顶棚是一排排**长条灯箱**,灯箱之间是深色桁架;
     地板映出的是"长条柔光被暗缝切断",那才是转播里那种断续的条形反光。
     等距柱状图里 x=经度、y 越小越接近天顶 —— 地板法线朝上,反射的正是这一带。 */
  const w=512,h=256,cv=document.createElement("canvas");
  cv.width=w;cv.height=h;
  const g=cv.getContext("2d");
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,"#3c3d45");      // 天顶:顶棚结构
  gr.addColorStop(.30,"#2b2c33");
  gr.addColorStop(.58,"#20222a");    // 地平线:看台
  gr.addColorStop(1,"#0f1116");      // 底:地板自身方向
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  /* 长条灯箱:3 排 × 每排 8 个,沿经度方向铺开。
     单个灯箱做成**横向长条**(宽 >> 高),反射到地板上才是"条"而不是"点"。 */
  /* 3 排 8 个 → 4 排 9 个,并且灯箱本身提到接近纯白:
     第一版把 alpha 压在 .88/.70/.26,实测 PBR 开关只差 3 灰阶 ——
     反射内容太暗太稀,PMREM 卷积完又被摊薄一次,地板上几乎读不出灯的形状。
     真实顶棚灯箱在反光里是**接近纯白的高光条**,暗的是它们之间的桁架,
     所以这里让灯箱亮到顶,靠桁架的暗缝去形成"断续长条"的节奏。 */
  const ROWS=4,PER=9;
  for(let r=0;r<ROWS;r++){
    const y0=h*(0.028+r*0.078),lh=h*0.052;
    for(let i=0;i<PER;i++){
      const x0=(i+0.09)/PER*w,lw=(w/PER)*0.82;
      const lg=g.createLinearGradient(0,y0,0,y0+lh);
      lg.addColorStop(0,"rgba(255,251,238,1)");
      lg.addColorStop(.5,"rgba(255,245,222,.94)");
      lg.addColorStop(1,"rgba(242,229,203,.54)");
      g.fillStyle=lg;g.fillRect(x0,y0,lw,lh);
    }
    /* 桁架:每排灯箱下方压一道深色横梁,把反射**切断**。
       没有这道缝,长条会连成一条连续的亮带,读起来还是"一片糊";
       有了它才是"断续的长条",低机位能认出灯组形状又看不到清晰镜像。 */
    g.fillStyle="rgba(9,11,15,.92)";
    g.fillRect(0,y0+lh,w,h*0.020);
  }
  arenaEnvMap=new THREE.CanvasTexture(cv);
  arenaEnvMap.mapping=THREE.EquirectangularReflectionMapping;
  if(THREE.sRGBEncoding)arenaEnvMap.encoding=THREE.sRGBEncoding;
  return arenaEnvMap;
}
/* 用 PMREM 把上面那张等距柱状图卷积成**带 roughness 分级**的环境贴图。
   直接用 equirect 当 envMap 时,所有粗糙度都反射同一张清晰图,
   所以地板要么像镜子、要么完全没有反射,中间没有过渡 ——
   这正是之前"反射很严重"和"不润"同时存在的矛盾来源。
   PMREM 会预生成一串模糊等级,roughness 越高取越模糊的那级,
   于是 clearcoat(很光滑)和木头本体(较粗糙)能同时有各自的反射。
   r128 自带 PMREMGenerator,已确认可用。 */
let arenaEnvRT=null;
function makeArenaEnvPMREM(){
  if(arenaEnvRT)return arenaEnvRT.texture;
  try{
    const pm=new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    arenaEnvRT=pm.fromEquirectangular(makeArenaEnvMap());
    pm.dispose();
    return arenaEnvRT.texture;
  }catch(e){
    return makeArenaEnvMap();          // 失败就退回原图,不让整个场景起不来
  }
}

function buildCourt(){
  const W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  courtIndoorTexture=makeCourtTexture("indoor");
  courtRoughTexture=makeCourtRoughness();
  /* 暖色不再靠 color 去染贴图(那样只是整体偏色),暖度画进木纹本身;
     color 留白、specular/shininess 负责"打过蜡的球馆地板"那层光泽。
     真正的权威值在 visual-director.js 的 tuneCourt —— 切场景时会覆盖这里。 */
  /* specular 从暗棕 0x7a6448 改成暖白:Phong 的 specular 是**高光的颜色**,
     清漆反射的是灯光,高光就该是白/暖白。用暗棕等于让高光斑"发暗",
     读起来是脏和哑光,不是润 —— 这是"亮但不润"的头号原因。
     reflectivity 压在 .3 以内:envMap 是纯镜面,再高地板就成镜子了。 */
  /* 地板换 MeshPhysicalMaterial。这是"地板真实感"的根本解,不是调参:
     Phong 只有一个 specular+shininess,木头本体和表面清漆共用一套高光,
     于是要么清漆不明显、要么整块发亮 —— 真实地板恰恰是**两层**:
       木头本体  较粗糙,漫反射为主
       清漆层    很光滑,单独产生一层干净的高光
     clearcoat 就是在模拟这层清漆,它可以和 base 的 roughness 各设各的。
      ?pbr=0 可退回 Phong 做 A/B。 */
  const usePBR=!(typeof location!=="undefined"&&/(\?|&)pbr=0(&|#|$)/.test(location.search));
  courtFloor=new THREE.Mesh(new THREE.PlaneGeometry(W,D),usePBR
    ? new THREE.MeshPhysicalMaterial({
        map:courtIndoorTexture,
        roughnessMap:courtRoughTexture,   // 木板级粗糙度起伏,见 makeCourtRoughness
        /* 全部取自 FLOOR_PHYS(唯一权威配置)。
           旧值 clearcoat .17 / clearcoatRoughness .45 / envMapIntensity .36
           的问题是"有参数但看不出来":关掉 PBR 时木色只从 116.6 变到 116.1,
           差 0.5 灰阶 —— 说明清漆层对画面的贡献基本为零。
           根因是 clearcoat 太弱、clearcoatRoughness 太散(反射被摊平成一团雾),
           再叠加一张只有六团圆光的环境图,PMREM 卷积完只剩均匀暖雾。
           所以这里把清漆加厚(.30)、收紧(.30)、并把反射提上来(.45),
           同时环境图重做为长条灯箱 —— 两者是一套,缺一个都不会"润"。 */
        roughness:FLOOR_PHYS.roughness,metalness:FLOOR_PHYS.metalness,
        clearcoat:FLOOR_PHYS.clearcoat,
        clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
        envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity})
    : new THREE.MeshPhongMaterial({
        map:courtIndoorTexture,color:0xb0a798,specular:0x8d8574,shininess:38,
        envMap:makeArenaEnvMap(),reflectivity:0.12}));
  courtFloor.receiveShadow=true;
  courtFloor.rotation.x=-Math.PI/2;
  courtFloor.position.set(0,0,(COURT.floorMinZ+COURT.floorMaxZ)/2);
  scene.add(courtFloor);
  buildCourtZones();
  const ringTex=pixTex(128,128,(g)=>{
    g.clearRect(0,0,128,128);
    g.strokeStyle="#fff";g.lineWidth=11;g.beginPath();g.arc(64,64,50,0,Math.PI*2);g.stroke();
    g.globalAlpha=0.45;g.lineWidth=4;g.beginPath();g.arc(64,64,38,0,Math.PI*2);g.stroke();
  });
  ringTex.magFilter=THREE.LinearFilter;ringTex.minFilter=THREE.LinearFilter;
  curSpotRing=new THREE.Mesh(new THREE.CircleGeometry(0.7,40),
    new THREE.MeshBasicMaterial({map:ringTex,color:0xffd23f,transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false}));
  curSpotRing.rotation.x=-Math.PI/2;curSpotRing.position.y=0.03;curSpotRing.visible=false;scene.add(curSpotRing);
}

window.AIBA.runtime.register("rendering:court",Object.freeze({
  makeCourtTexture,buildCourt,paintHardwood,
  getFloor:()=>courtFloor,
  getTextures:()=>({indoor:courtIndoorTexture,outdoor:courtOutdoorTexture})
}));
