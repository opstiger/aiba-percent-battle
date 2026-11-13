/* ---------------- court floor ---------------- */
let courtFloor=null,courtIndoorTexture=null,courtOutdoorTexture=null,courtRoughTexture=null;

/* 地板材质的**唯一权威配置**。必须放在模块顶层:
   buildCourt 和 buildCourtZones 是两个独立函数,写在任何一个内部另一个都拿不到。 */
const FLOOR_PHYS={
  roughness:0.34,          // 木材本体上限;roughnessMap 调制到 0.28~0.34
  metalness:0.0,
  clearcoat:0.46,          // 次世代高光清漆强度
  clearcoatRoughness:0.22,
  envMapIntensity:0.62     // 球馆顶灯与紫金灯带反射强度
};

function courtWoodRng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/* 室内枫木地板：保留低频防摩尔纹基底，加入极柔和的错缝长条枫木色温层次。 */
function paintHardwood(g,W,D,PXM){
  const rr=courtWoodRng(0x9e3779b1),w=W*PXM,h=D*PXM;
  /* 1. 统一底色:浅枫木。 */
  g.fillStyle="#b89267";g.fillRect(0,0,w,h);

  /* 1.5 极低对比度的错缝枫木条色温层次（alpha 控制在 .018~.028，不制造高频边缘，
     但近景能清晰读出长条实木地板的冷暖交替与端头错缝）。 */
  const plankW=0.28*PXM;
  for(let px=0;px<w;px+=plankW){
    let py=-rr()*2.5*PXM;
    while(py<h){
      const plen=(2.4+rr()*2.8)*PXM;
      const tone=rr();
      if(tone<0.42){
        g.fillStyle="rgba(232,202,156,"+(0.014+rr()*0.016).toFixed(3)+")";
        g.fillRect(px,Math.max(0,py),plankW-0.8,Math.min(h-py,plen));
      }else if(tone>0.62){
        g.fillStyle="rgba(112,78,44,"+(0.014+rr()*0.016).toFixed(3)+")";
        g.fillRect(px,Math.max(0,py),plankW-0.8,Math.min(h-py,plen));
      }
      py+=plen;
    }
  }

  /* 2. 低频色斑。整块地板同一个明度会变回"平贴图",用十来团很淡的冷暖斑打散它。 */
  for(let i=0;i<14;i++){
    const cx=rr()*w,cy=rr()*h,r=(3+rr()*9)*PXM,warm=rr()<.55;
    const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,warm?"rgba(214,178,124,.055)":"rgba(118,86,50,.05)");
    gr.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gr;g.fillRect(cx-r,cy-r,r*2,r*2);
  }

  /* 3. 随机木纹。沿球场长边的淡纹路,长度、位置、弧度、深浅全部随机。 */
  for(let i=0;i<185;i++){
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

  /* 4. 接缝:低alpha保持近看有实木拼接感、远看无摩尔纹。 */
  for(let jz=rr()*3*PXM;jz<h;jz+=(3+rr()*2.5)*PXM){
    g.fillStyle="rgba(96,66,38,.045)";g.fillRect(0,jz,w,1.2);
  }
  for(let x=rr()*2*PXM;x<w;x+=(1.8+rr()*1.4)*PXM){
    g.fillStyle="rgba(96,66,38,.05)";g.fillRect(x,0,1.0,h);
  }

  /* 5. 球馆顶灯舞台聚光层次：场地中央与两侧三秒区暖白提亮 */
  const stageGr=g.createRadialGradient(w*0.5,h*0.46,1.5*PXM,w*0.5,h*0.48,13.5*PXM);
  stageGr.addColorStop(0,"rgba(255,242,212,0.09)");
  stageGr.addColorStop(0.65,"rgba(255,232,190,0.04)");
  stageGr.addColorStop(1,"rgba(0,0,0,0)");
  g.fillStyle=stageGr;g.fillRect(0,0,w,h);
}

/* 三秒区、罚球圈、中圈独立薄几何，带连续清漆。 */
function buildCourtZones(){
  const Y=0.020;
  const zoneMat=new THREE.MeshPhysicalMaterial({
    color:0x261142,transparent:true,opacity:0.26,
    roughness:0.34,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    clearcoat:FLOOR_PHYS.clearcoat,
    clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
    envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity});
  const lineMat=new THREE.MeshPhysicalMaterial({
    color:0xe8edf2,side:THREE.DoubleSide,
    roughness:0.36,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    clearcoat:FLOOR_PHYS.clearcoat,
    clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
    envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity*0.55});
  const face=(geo,mat,z,sx)=>{
    const m=new THREE.Mesh(geo,mat);
    m.rotation.x=-Math.PI/2;m.position.set(0,Y,z);
    if(sx)m.scale.x=sx;
    m.name=(mat===zoneMat)?"courtZone":(mat===lineMat?"courtLine":"courtMark");
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

    // 场外围边(Apron)：NBA 2K 经典湖人斯台普斯/加密网球馆黄金围边 + 皇室紫铭文 + 外圈径向阴影过渡
    const ax0=u(-COURT.halfWidth),ax1=u(COURT.halfWidth),az0=v(COURT.nearBaseline),az1=v(COURT.farBaseline);
    const bx0=u(-9.4),bx1=u(9.4),bz0=v(COURT.nearBaseline-1.85),bz1=v(COURT.farBaseline+1.85);
    if(outdoor){
      const oax0=u(-7.9),oax1=u(7.9),oaz0=v(COURT.nearBaseline-.32),oaz1=v(COURT.farBaseline+.32);
      g.fillStyle="rgba(20,68,62,.72)";
      g.fillRect(0,0,W*PXM,oaz0);
      g.fillRect(0,oaz1,W*PXM,D*PXM-oaz1);
      g.fillRect(0,oaz0,oax0,oaz1-oaz0);
      g.fillRect(oax1,oaz0,W*PXM-oax1,oaz1-oaz0);
    }else{
      // 黄金围边 (Championship Amber-Gold Apron) 覆盖边线/底线外圈缓冲区，保持通透亮丽的 2K 舞台金
      g.fillStyle="#e09a1e";
      g.fillRect(bx0,bz0,bx1-bx0,az0-bz0);
      g.fillRect(bx0,az1,bx1-bx0,bz1-az1);
      g.fillRect(bx0,az0,ax0-bx0,az1-az0);
      g.fillRect(ax1,az0,bx1-ax1,az1-az0);
      // 黄金围边底线中央微暖提亮（呼应篮架上方顶灯）
      for(const zp of [(az0+bz0)*0.5,(az1+bz1)*0.5]){
        const bg=g.createRadialGradient(u(0),zp,1.0*PXM,u(0),zp,8.5*PXM);
        bg.addColorStop(0,"rgba(255,228,138,0.28)");
        bg.addColorStop(0.6,"rgba(255,210,96,0.08)");
        bg.addColorStop(1,"rgba(18,12,6,0.12)");
        g.fillStyle=bg;
        g.fillRect(bx0,zp-1.2*PXM,bx1-bx0,2.4*PXM);
      }

      // 外圈宽阔球馆深炭黑地坪过渡带 (黄金围边外立刻跌入深色剧场地面)
      g.fillStyle="#070912";
      g.fillRect(0,0,W*PXM,bz0);
      g.fillRect(0,bz1,W*PXM,D*PXM-bz1);
      g.fillRect(0,bz0,bx0,bz1-bz0);
      g.fillRect(bx1,bz0,W*PXM-bx1,bz1-bz0);

      // 黄金围边外侧柔和阴影晕边（仅作用于 bx0..bx1, bz0..bz1 外围，绝不压暗球场与黄金围边本体）
      g.strokeStyle="rgba(3,4,9,0.75)";g.lineWidth=18;
      g.strokeRect(bx0-9,bz0-9,(bx1-bx0)+18,(bz1-bz0)+18);

      // 湖人紫内/外双层饰框
      g.strokeStyle="rgba(44,20,77,0.90)";g.lineWidth=6;
      g.strokeRect(ax0-5,az0-5,(ax1-ax0)+10,(az1-az0)+10);
      g.strokeStyle="rgba(44,20,77,0.72)";g.lineWidth=4;
      g.strokeRect(bx0+3,bz0+3,(bx1-bx0)-6,(bz1-bz0)-6);

      // 底线外侧皇室紫 LAKERS · SHOWTIME 与 CRYPTO · aiBA ARENA 粗体铭文
      g.save();
      g.fillStyle="rgba(44,20,77,0.92)";
      g.font="bold 44px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillText("LAKERS  ·  SHOWTIME",u(0),(az0+bz0)*0.5);
      g.fillText("CRYPTO  ·  aiBA  ARENA",u(0),(az1+bz1)*0.5);
      g.restore();
    }

    // 边线与底线主白框
    g.lineWidth=8;g.strokeStyle="#f4f4f6";
    g.strokeRect(u(-COURT.halfWidth),v(COURT.nearBaseline),COURT.width*PXM,COURT.length*PXM);
    g.strokeStyle="rgba(244,244,246,.85)";g.lineWidth=7;g.lineCap="round";
    g.beginPath();g.moveTo(u(-COURT.halfWidth),v(COURT.midZ));g.lineTo(u(COURT.halfWidth),v(COURT.midZ));g.stroke();
    g.beginPath();g.arc(u(0),v(COURT.midZ),1.8*PXM,0,Math.PI*2);g.stroke();

    const nearFreeThrowZ=COURT.nearBaseline+5.79;
    const farFreeThrowZ=COURT.farBaseline-5.79;
    // 近端三秒区：经典湖人紫金油漆区（外圈湖人金宽框 + 内圈皇室紫涂装）+ 禁区抢位分格线
    g.fillStyle=outdoor?"rgba(23,92,88,.26)":"rgba(52,22,90,.46)";
    g.fillRect(u(-2.45),v(COURT.nearBaseline),4.9*PXM,5.79*PXM);
    if(!outdoor){
      g.strokeStyle="rgba(253,185,39,0.82)";g.lineWidth=9;
      g.strokeRect(u(-2.33),v(COURT.nearBaseline+.12),4.66*PXM,5.55*PXM);
    }
    g.strokeStyle="rgba(242,242,242,.88)";g.lineWidth=7;
    g.strokeRect(u(-2.45),v(COURT.nearBaseline),4.9*PXM,5.79*PXM);
    // 罚球圈下半虚线 + 上半实线
    g.beginPath();g.arc(u(0),v(nearFreeThrowZ),1.8*PXM,0,Math.PI);g.stroke();
    g.save();g.setLineDash([10,10]);
    g.beginPath();g.arc(u(0),v(nearFreeThrowZ),1.8*PXM,Math.PI,Math.PI*2);g.stroke();
    g.restore();
    // 禁区两侧 4 道抢位分格线 (Lane Hash Marks) & 篮下合理冲撞区弧线 (Restricted Area Arc)
    for(const sx of [-1,1]){
      const lx=u(sx*2.45);
      for(const dz of [2.13,2.44,3.35,4.27]){
        const hz=v(COURT.nearBaseline+dz);
        g.beginPath();g.moveTo(lx,hz);g.lineTo(lx+sx*0.28*PXM,hz);g.stroke();
      }
      const rx=u(sx*1.22);
      g.beginPath();g.moveTo(rx,v(COURT.nearBaseline+1.20));g.lineTo(rx,v(HOOP.z));g.stroke();
    }
    g.beginPath();g.arc(u(0),v(HOOP.z),1.22*PXM,0,Math.PI);g.stroke();

    // 近端三分线
    g.strokeStyle="#dce2e8";g.lineWidth=10;g.lineCap="round";
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

    // 远端三秒区与三分线
    g.strokeStyle="rgba(216,221,226,.65)";g.lineWidth=7;g.lineCap="round";
    g.strokeRect(u(-2.45),v(farFreeThrowZ),4.9*PXM,5.79*PXM);
    g.beginPath();g.arc(u(0),v(farFreeThrowZ),1.8*PXM,0,Math.PI*2);g.stroke();
    for(const sx of [-1,1]){
      const lx=u(sx*2.45);
      for(const dz of [2.13,2.44,3.35,4.27]){
        const hz=v(COURT.farBaseline-dz);
        g.beginPath();g.moveTo(lx,hz);g.lineTo(lx+sx*0.28*PXM,hz);g.stroke();
      }
    }
    g.beginPath();g.arc(u(0),v(COURT.farHoopZ),1.22*PXM,Math.PI,Math.PI*2);g.stroke();
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

    // 中圈多层紫金赛会徽标
    g.fillStyle=outdoor?"#176b66":"#2b134d";g.beginPath();g.arc(u(0),v(COURT.midZ),2.18*PXM,0,Math.PI*2);g.fill();
    g.strokeStyle=outdoor?"#f4e7b0":"#fdb927";g.lineWidth=7;g.beginPath();g.arc(u(0),v(COURT.midZ),2.04*PXM,0,Math.PI*2);g.stroke();
    g.fillStyle=outdoor?"#f4e7b0":"#fdb927";g.font="bold 58px Orbitron, monospace";g.textAlign="center";
    g.fillText("aiBA",u(0),v(COURT.midZ-.15));
    g.font="bold 32px Orbitron, monospace";g.fillText("★ SHOWTIME ★",u(0),v(COURT.midZ+.78));

    function spotDecal(x,z,r,fill,line,lw,txt,txtCol,fs){
      g.fillStyle=fill;g.beginPath();g.arc(u(x),v(z),r*PXM,0,7);g.fill();
      if(line){g.strokeStyle=line;g.lineWidth=lw;g.beginPath();g.arc(u(x),v(z),r*PXM,0,7);g.stroke();}
      if(txt){g.fillStyle=txtCol;g.font="bold "+fs+"px Orbitron, monospace";g.textAlign="center";g.fillText(txt,u(x),v(z)+fs*0.36);}
    }
    for(const rk of RACKS)spotDecal(rk.p.x,rk.p.z,0.42,"rgba(124,252,107,0.06)","rgba(150,230,140,0.42)",4,null);
    for(const dp of DEEPS)spotDecal(dp.p.x,dp.p.z,0.46,"rgba(80,190,255,0.07)","rgba(120,205,255,0.45)",4,"5","rgba(190,235,255,0.7)",24);
    spotDecal(HALFCOURT.p.x,HALFCOURT.p.z,0.58,"rgba(255,210,63,0.08)","rgba(255,210,63,0.5)",4,"10","rgba(255,225,130,0.7)",27);
  },{smooth:true,mipmaps:true,anisotropy:16});
}

/* 独立的 roughness map —— 木板节奏放在粗糙度起伏里。 */
function makeCourtRoughness(){
  const PXM=24,W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  return pixTex(W*PXM,D*PXM,(g)=>{
    const u=x=>(x+W/2)*PXM,v=z=>(z-COURT.floorMinZ)*PXM,w=W*PXM,h=D*PXM;
    g.fillStyle="#ffffff";g.fillRect(0,0,w,h);
    const rr=courtWoodRng(0x5bf03635);
    const BW=0.28;
    for(let x=-W/2;x<W/2;x+=BW){
      const gv=Math.round(215+rr()*40);
      g.fillStyle="rgb("+gv+","+gv+","+gv+")";
      g.fillRect(u(x),0,BW*PXM,h);
      g.fillStyle="rgba(255,255,255,.55)";
      g.fillRect(u(x+BW)-1.2,0,1.2,h);
    }
    for(let i=0;i<90;i++){
      const x=u(-W/2+rr()*W),y=v(COURT.floorMinZ+rr()*D);
      g.fillStyle="rgba(255,255,255,.30)";
      g.fillRect(x,y,(0.5+rr()*1.2)*PXM,1.1);
    }
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

let arenaEnvMap=null;
function makeArenaEnvMap(){
  if(arenaEnvMap)return arenaEnvMap;
  const w=512,h=256,cv=document.createElement("canvas");
  cv.width=w;cv.height=h;
  const g=cv.getContext("2d");
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,"#1c1a2e");      // 天顶:深邃紫黑剧场穹顶
  gr.addColorStop(.28,"#241f38");
  gr.addColorStop(.52,"#181428");    // 地平线:暗调看台与包厢带
  gr.addColorStop(1,"#0b0912");      // 底:地板自身方向
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  // 中央巨型斗屏 (Jumbotron) 暖金与电光青反射光团
  const jg=g.createRadialGradient(w*0.5,h*0.14,4,w*0.5,h*0.14,w*0.18);
  jg.addColorStop(0,"rgba(255,222,128,0.85)");
  jg.addColorStop(0.45,"rgba(126,231,255,0.38)");
  jg.addColorStop(1,"rgba(0,0,0,0)");
  g.fillStyle=jg;g.fillRect(w*0.3,0,w*0.4,h*0.32);
  // 顶棚环形马道高功率体育馆 LED 矩阵灯带
  const ROWS=4,PER=9;
  for(let r=0;r<ROWS;r++){
    const y0=h*(0.042+r*0.072),lh=h*0.044;
    for(let i=0;i<PER;i++){
      const x0=(i+0.12)/PER*w,lw=(w/PER)*0.76;
      const lg=g.createLinearGradient(0,y0,0,y0+lh);
      lg.addColorStop(0,"rgba(255,252,240,1)");
      lg.addColorStop(.5,"rgba(255,242,212,.92)");
      lg.addColorStop(1,"rgba(253,185,39,.48)");
      g.fillStyle=lg;g.fillRect(x0,y0,lw,lh);
    }
    g.fillStyle="rgba(8,9,16,.92)";
    g.fillRect(0,y0+lh,w,h*0.018);
  }
  // 环馆双层紫金 LED 跑马灯带与 VIP 包厢暖光带（在清漆木地板远端投出次世代彩色微光）
  const r1=g.createLinearGradient(0,h*0.42,0,h*0.49);
  r1.addColorStop(0,"rgba(138,68,225,0)");
  r1.addColorStop(0.5,"rgba(253,185,39,0.46)");
  r1.addColorStop(1,"rgba(138,68,225,0)");
  g.fillStyle=r1;g.fillRect(0,h*0.42,w,h*0.07);
  arenaEnvMap=new THREE.CanvasTexture(cv);
  arenaEnvMap.mapping=THREE.EquirectangularReflectionMapping;
  if(THREE.sRGBEncoding)arenaEnvMap.encoding=THREE.sRGBEncoding;
  return arenaEnvMap;
}

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
    return makeArenaEnvMap();
  }
}

function buildCourt(){
  const W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  courtIndoorTexture=makeCourtTexture("indoor");
  courtRoughTexture=makeCourtRoughness();
  const usePBR=!(typeof location!=="undefined"&&/(\?|&)pbr=0(&|#|$)/.test(location.search));
  courtFloor=new THREE.Mesh(new THREE.PlaneGeometry(W,D),usePBR
    ? new THREE.MeshPhysicalMaterial({
        map:courtIndoorTexture,
        roughnessMap:courtRoughTexture,
        roughness:FLOOR_PHYS.roughness,metalness:FLOOR_PHYS.metalness,
        clearcoat:FLOOR_PHYS.clearcoat,
        clearcoatRoughness:FLOOR_PHYS.clearcoatRoughness,
        envMap:makeArenaEnvPMREM(),envMapIntensity:FLOOR_PHYS.envMapIntensity})
    : new THREE.MeshPhongMaterial({
        map:courtIndoorTexture,color:0xb0a798,specular:0x8d8574,shininess:38,
        envMap:makeArenaEnvMap(),reflectivity:0.12}));
  courtFloor.receiveShadow=true;
  courtFloor.name="courtFloor";
  courtFloor.rotation.x=-Math.PI/2;
  courtFloor.position.set(0,0,(COURT.floorMinZ+COURT.floorMaxZ)/2);
  scene.add(courtFloor);
  // 大型 NBA 球馆外围深炭黑防滑地坪：仅在 courtFloor (W×D) 四周外围拼接 4 块不重叠地面，
  // 彻底消除 courtFloor 下方大平面重叠导致的远景 Z-fighting 横向黑线！
  if(typeof indoorRoot!=="undefined"&&indoorRoot){
    const subMat=new THREE.MeshStandardMaterial({
      color:0x070912,roughness:0.78,metalness:0.08,
      polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2
    });
    const cz=(COURT.floorMinZ+COURT.floorMaxZ)/2;
    const outerW=68,outerD=88;
    const sideW=(outerW-W)/2+0.08;
    const endD=(outerD-D)/2+0.08;
    const slabs=[
      [-(W+sideW)/2+0.04,cz,sideW,outerD],
      [(W+sideW)/2-0.04,cz,sideW,outerD],
      [0,COURT.floorMinZ-endD/2+0.04,W+0.08,endD],
      [0,COURT.floorMaxZ+endD/2-0.04,W+0.08,endD]
    ];
    slabs.forEach((s,idx)=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(s[2],s[3]),subMat);
      m.rotation.x=-Math.PI/2;
      m.position.set(s[0],-0.025,s[1]);
      m.receiveShadow=true;
      if(idx===0)m.name="arenaSubFloor";
      indoorRoot.add(m);
    });
  }
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
