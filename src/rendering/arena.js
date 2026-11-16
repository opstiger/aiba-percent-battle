function bannerTex(txt,bg,fg){
  return pixTex(768,144,(g,w,h)=>{
    g.fillStyle=bg;g.fillRect(0,0,w,h);
    // 斜向微弱光带 + LED 灯珠矩阵纹理
    g.fillStyle="rgba(255,255,255,.045)";
    for(let i=-h;i<w;i+=28){
      g.beginPath();g.moveTo(i,h);g.lineTo(i+12,h);g.lineTo(i+12+h*.45,0);g.lineTo(i+h*.45,0);g.closePath();g.fill();
    }
    g.fillStyle="rgba(0,0,0,.18)";
    for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1.4);
    // 金属外框与发光内边线
    g.strokeStyle="rgba(255,255,255,.16)";g.lineWidth=6;g.strokeRect(4,4,w-8,h-8);
    g.strokeStyle=fg;g.globalAlpha=0.42;g.lineWidth=2.5;g.strokeRect(12,12,w-24,h-24);
    g.globalAlpha=0.85;g.fillStyle=fg;
    g.fillRect(18,18,6,h-36);g.fillRect(w-24,18,6,h-36);
    g.globalAlpha=1;
    g.fillStyle=fg;g.font="bold 64px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
    g.fillText(txt,w/2,h/2+2);
  },{smooth:true,mipmaps:true});
}
/* ---------------- 观众席碗 ----------------
   真实 NBA 馆是分层的圆角矩形碗:
     courtside  球场边缘的地面层,几乎与场地同高
     lower bowl 主层,围绕球场,坡度缓
     upper bowl 上层,更高更陡;四角把相邻两侧连起来 */
const BOWL_N=3,BOWL_SEG=64;
const SEAT_PITCH=0.78;                // 座位中心距(米)，适配真实 NBA 大型球馆碗跨度
const AISLE_COUNT=6;                  // 每层通道条数
const AISLE_W=1.05;                   // 通道净宽(米)
const AISLE_SKEW=0.55;                // 通道中心随行号的斜向偏移(弧度)≈ 半个通道间距
const STEP_OVERLAP=1.12;
function bowlPt(a,rx,rz){
  const c=Math.cos(a),s=Math.sin(a);
  return [Math.sign(c)*Math.pow(Math.abs(c),2/BOWL_N)*rx,
          COURT.midZ+Math.sign(s)*Math.pow(Math.abs(s),2/BOWL_N)*rz];
}
/* 参照湖人主场 Crypto.com Arena (Staples Center) 真实比例尺：
   围绕球场中心 (0, COURT.midZ) 展开，留出宽阔的场边缓冲区与媒体席，
   100 层主看台纵深后退至 16.8~26.8m，中段嵌入标志性三层 VIP 豪华包厢墙 (y=8.4~14.8m)，
   300 层高空看台抬升至 15.2~24.2m，彻底消除“小盒子里打球”的局促感。 */
const BOWL_TIERS=[
  {rows:3,rx0:13.5,rx1:15.8,rz0:20.6,rz1:22.9,y0:0.26,y1:0.98,seat:0.94,dim:0.68},
  {rows:10,rx0:16.8,rx1:26.8,rz0:23.9,rz1:33.9,y0:1.40,y1:8.15,seat:0.88,dim:0.78},
  {rows:9,rx0:29.6,rx1:39.2,rz0:36.8,rz1:46.4,y0:15.2,y1:24.2,seat:0.76,dim:0.88}
];
/* NBA 2K "Lights Out" 四级分区光场因子 (0.10..0.85)：
   结合分层径向衰减 + 100层顶部包厢挑檐遮挡 + 沿环形看台的马道光池分布，
   让看台与观众席自然呈现"场边暖亮 → 中排过渡 → 挑檐阴影 → 300层深暗"的剧场质感。 */
function bowlZoneLight(ti,k,a){
  // 沿底线中央(a=0,π)与边线中央(a=±π/2)形成 4 个主聚光灯池，四角通道区(a=±π/4,±3π/4)自然落入暗部
  const poolWave=0.5+0.5*Math.cos(a*4);
  const spotPool=0.38+0.62*Math.pow(poolWave,1.15);
  if(ti===0){
    // 场边 VIP 席：吃满赛场暖色溢光 (0.82 ~ 0.96)
    return Math.max(0.72,Math.min(0.96,(0.94-0.10*k)*(0.82+0.18*poolWave)));
  }
  if(ti===1){
    // 100层看台：前中排在聚光池内明亮通透(0.75~0.92)，向上至包厢挑檐下(k>0.58)及四角区域陡然跌入深暗阴影(0.16~0.28)
    const rowCurve=Math.pow(Math.max(0,1-k*0.88),1.35);
    const balconyShadow=k>0.58?Math.max(0.18,1-(k-0.58)*1.95):1.0;
    return Math.max(0.15,Math.min(0.92,(0.16+0.78*rowCurve*spotPool)*balconyShadow));
  }
  // 300层山顶看台：整体退入深邃剧场暗部 (0.12 ~ 0.24)
  return Math.max(0.11,Math.min(0.24,(0.22-0.09*k)*(0.75+0.25*poolWave)));
}
function buildStands(){
  const seats=[];
  const stepParts=[];
  const baseStepHex=0x383d4b;
  const baseTreadHex=0x262a36;
  const baseFasciaHex=0x222736;
  const baseFasciaLipHex=0x5c4384;
  const baseSeatShellHex=0x2e204f;
  const baseSeatCushionHex=0x3d2b66;
  const up=new THREE.Vector3(0,1,0),mm=new THREE.Matrix4(),qRot=new THREE.Quaternion();
  for(let ti=0;ti<BOWL_TIERS.length;ti++){
    const T=BOWL_TIERS[ti];
    for(let r=0;r<T.rows;r++){
      const k=T.rows>1?r/(T.rows-1):0;
      const rx=T.rx0+(T.rx1-T.rx0)*k;
      const rz=T.rz0+(T.rz1-T.rz0)*k;
      const y=T.y0+(T.y1-T.y0)*k;
      const yPrev=r>0?T.y0+(T.y1-T.y0)*((r-1)/(T.rows-1)):0;
      const h=Math.max(0.45,y-yPrev+0.35);
      const skew=T.rows>1?k*AISLE_SKEW:0;
      const sector=Math.PI*2/AISLE_COUNT;
      const overAng=(Math.PI*2/BOWL_SEG)*(STEP_OVERLAP-1)/2;
      for(let s=0;s<AISLE_COUNT;s++){
        const ac=((s+0.5)/AISLE_COUNT)*Math.PI*2+skew;
        const [cx,cz]=bowlPt(ac,rx,rz);
        const rad=Math.hypot(cx,cz-COURT.midZ)||1;
        const half=(AISLE_W/2)/rad+overAng;
        const a0=ac-sector/2+half,a1=ac+sector/2-half;
        const span=a1-a0;
        const cnt=Math.max(2,Math.round(span/(Math.PI*2/BOWL_SEG)));
        const segAng=span/cnt;
        for(let j=0;j<cnt;j++){
          const a=a0+segAng*(j+0.5);
          const zoneL=bowlZoneLight(ti,k,a);
          const darkF=Math.max(0.05,Math.min(0.84,Math.pow(1.0-zoneL,1.15)*0.86));
          const desatF=Math.max(0.04,Math.min(0.45,(1.0-zoneL)*0.38));
          const stepColor=recede(baseStepHex,desatF*0.8,darkF);
          const treadColor=recede(baseTreadHex,desatF*0.8,darkF);
          const fasciaColor=recede(baseFasciaHex,desatF*0.7,darkF*0.88);
          const fasciaLipColor=recede(baseFasciaLipHex,desatF*0.5,darkF*0.75);
          const seatShellColor=recede(baseSeatShellHex,desatF,darkF);
          const seatCushionColor=recede(baseSeatCushionHex,desatF,darkF);
          const [x,z]=bowlPt(a,rx,rz);
          const [nx,nz]=bowlPt(a+segAng,rx,rz);
          const arc=Math.hypot(nx-x,nz-z)*STEP_OVERLAP;
          const rotY=Math.atan2(nx-x,nz-z);
          qRot.setFromAxisAngle(up,rotY);
          // 混凝土看台阶梯主体（移除 0.05m 薄踏面重叠层并加入微米级奇偶高度错位，彻底消除看台远景 Z-fighting 黑线）
          const yStep=y+((j+r)&1)*0.006;
          mm.compose(new THREE.Vector3(x,yStep-h/2,z),qRot,new THREE.Vector3(1.65,h,arc));
          stepParts.push({color:stepColor,matrix:mm.clone()});

          // 每层第一排前缘：混凝土护栏挡墙 (Fascia Wall) + 顶部紫金压条
          if(r===0&&ti>=1){
            const [fx,fz]=bowlPt(a,rx-0.72,rz-0.72);
            const fh=ti===1?0.68:0.86;
            mm.compose(new THREE.Vector3(fx,y+fh*0.32,fz),qRot,new THREE.Vector3(0.20,fh,arc*1.01));
            stepParts.push({color:fasciaColor,matrix:mm.clone()});
            mm.compose(new THREE.Vector3(fx,y+fh*0.82+0.04,fz),qRot,new THREE.Vector3(0.26,0.08,arc*1.01));
            stepParts.push({color:fasciaLipColor,matrix:mm.clone()});
          }

          const segLen=Math.hypot(nx-x,nz-z)||1;
          const n=Math.max(2,Math.round(segLen/SEAT_PITCH));
          const ux=(nx-x)/segLen,uz=(nz-z)/segLen;
          // 径向朝外的单位向量（相对于球场中心 COURT.midZ）
          const dz=z-COURT.midZ,rLen=Math.hypot(x,dz)||1,outX=x/rLen,outZ=dz/rLen;
          for(let q=0;q<n;q++){
            const off=(q-(n-1)/2)*SEAT_PITCH;
            const sx=x+ux*off,sz=z+uz*off;
            if(ti<2||(q%2===0)){
              mm.compose(new THREE.Vector3(sx,y+0.18,sz),qRot,new THREE.Vector3(0.40,0.08,0.44));
              stepParts.push({color:seatCushionColor,matrix:mm.clone()});
              mm.compose(new THREE.Vector3(sx+outX*0.17,y+0.44,sz+outZ*0.17),qRot,new THREE.Vector3(0.10,0.44,0.44));
              stepParts.push({color:seatShellColor,matrix:mm.clone(),taperX:0.75,taperZ:0.86});
            }
            const absent=Math.random()<0.05;
            seats.push({x:sx+rnd(-.08,.08),
              y:y+(absent?0.30:0.42)+rnd(-.04,.04),
              z:sz+rnd(-.08,.08),
              ph:Math.random()*7,amp:absent?0:rnd(.7,1.3),t:ti,
              zoneLight:zoneL,rowK:k});
          }
        }
      }
    }
  }
  // 四角球员入场通道内嵌隧道口 (Vomitory Tunnels)：平齐嵌入 100 层看台中段，不凸出看台斜面
  for(const ca of [Math.PI*0.23,Math.PI*0.77,Math.PI*1.23,Math.PI*1.77]){
    const p=bowlFacing(ca,21.5,28.6);
    stepParts.push({color:0x05070c,matrix:mat4At(p.x,2.2,p.z,p.rot,1.4,2.1,2.8)});
    stepParts.push({color:0xd49b27,matrix:mat4At(p.x,3.32,p.z,p.rot,1.45,0.10,2.9)});
  }
  if(stepParts.length)bakeVoxelMesh(indoorRoot,stepParts,{materialKey:"standsBowl",standard:true,material:{roughness:0.62,metalness:0.16,envMapIntensity:0.34}});
  // 记者区专业长焦摄像机位（移除看台高空刺眼金属栏杆，保证篮架与球场通透）
  if(window.AIBAModelDetail?.enabled){
    const parts=AIBAModelDetail.pressRow(COURT.nearBaseline-2.65,[-6.2,-4.4,-2.8,2.8,4.4,6.2]);
    const mesh=bakeVoxelMesh(indoorRoot,parts,{materialKey:"arenaFixtures",standard:true,material:{roughness:0.34,metalness:0.58,envMapIntensity:0.52}});
    mesh.name="arenaFixtures";mesh.castShadow=false;mesh.receiveShadow=false;
  }
  // 高空环场巨幅主题横幅
  const banners=[["CRYPTO · aiBA ARENA","#180d2c","#fdb927"],["SHOWTIME · 百分大战","#121c38","#7ee7ff"],["LOS ANGELES · 3PT KING","#24113b","#fdb927"]];
  const wallDefs=[
    [0,17.5,COURT.midZ-45.5,0,46],
    [-39.5,17.5,COURT.midZ,Math.PI/2,64],
    [39.5,17.5,COURT.midZ,-Math.PI/2,64],
    [0,17.5,COURT.midZ+45.5,Math.PI,46]
  ];
  wallDefs.forEach((w,i)=>{
    const b=banners[i%banners.length];
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w[4],4.2),
      new THREE.MeshBasicMaterial({map:bannerTex(b[0],b[1],b[2]),color:0x525c6e}));
    m.position.set(w[0],w[1]+4.2,w[2]);m.rotation.y=w[3];indoorRoot.add(m);
  });
  return seats;
}

const CEIL_Y=28.5;
const RIBBON_ADS=["CRYPTO · aiBA","SHOWTIME","LAKERS GOLD","PIXEL SPORT","COURT CAM","N1KE AIR","ADI-DASH","3PT KING"];
function mat4At(x,y,z,rot,sx,sy,sz){
  const m=new THREE.Matrix4();
  m.compose(new THREE.Vector3(x,y,z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rot),
    new THREE.Vector3(sx,sy,sz));
  return m;
}
function bowlFacing(a,rx,rz){
  const [x,z]=bowlPt(a,rx,rz),[nx,nz]=bowlPt(a+0.04,rx,rz);
  return {x,z,rot:Math.atan2(nx-x,nz-z)+(x||z?0:0)};
}
function buildCourtsideRibbon(){
  /* 球场外围 360° 立体 LED 广告灯箱：向场外大幅后退至 rx=11.8, rz=19.2，
     留出超过 4.2m 的真实 NBA 场边缓冲区，彻底消除压迫局促感。 */
  const SEG=28,rx=11.8,rz=19.2;
  const cabParts=[];
  for(let i=0;i<SEG;i++){
    const a=i/SEG*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    const txt=RIBBON_ADS[i%RIBBON_ADS.length];
    const isGold=i%2===0;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(3.84,0.54),
      new THREE.MeshBasicMaterial({map:bannerTex(txt,isGold?"#160b28":"#080d18",isGold?"#fdb927":"#7ee7ff"),
        side:THREE.DoubleSide,color:0xd8e4f2}));
    m.position.set(p.x,0.52,p.z);m.rotation.y=p.rot-Math.PI/2;
    indoorRoot.add(m);

    // 立体机箱背壳与顶部紫金防撞条（沿法线向场外退 0.12m）
    const dz=p.z-COURT.midZ,rLen=Math.hypot(p.x,dz)||1,ox=p.x/rLen,oz=dz/rLen;
    const bx=p.x+ox*0.12,bz=p.z+oz*0.12;
    cabParts.push({color:0x121520,matrix:mat4At(bx,0.50,bz,p.rot,0.22,0.56,3.92)});
    cabParts.push({color:0x3b1e5e,matrix:mat4At(bx,0.81,bz,p.rot,0.26,0.08,3.94),taperX:0.82});
    cabParts.push({color:0x0c0e16,matrix:mat4At(bx,0.06,bz,p.rot,0.30,0.12,3.94)});
    for(const off of [-1.2,0,1.2]){
      const sx=bx+Math.cos(p.rot)*off*0.2+ox*0.14;
      const sz=bz-Math.sin(p.rot)*off*0.2+oz*0.14;
      cabParts.push({color:0x222836,matrix:mat4At(sx,0.30,sz,p.rot,0.20,0.52,0.09),taperX:0.35});
    }
  }
  // 场边技术台（Scorer's Table）：沿左侧边线平行布置（rot=0，sx为径向厚度0.78，sz为沿边线长度5.4）
  const scX=-9.85,scZ=COURT.midZ-2.0;
  cabParts.push({color:0x151926,matrix:mat4At(scX,0.44,scZ,0,0.78,0.86,5.4)});
  cabParts.push({color:0x381c5a,matrix:mat4At(scX,0.89,scZ,0,0.86,0.08,5.5),taperX:0.88});
  for(const dz of [-1.8,-0.6,0.6,1.8]){
    cabParts.push({color:0x0d1118,matrix:mat4At(scX+0.06,1.06,scZ+dz,0,0.06,0.28,0.44),taperX:0.75});
    cabParts.push({color:0x7ee7ff,matrix:mat4At(scX+0.10,1.06,scZ+dz,0,0.02,0.22,0.38)});
  }
  const scScreen=new THREE.Mesh(new THREE.PlaneGeometry(5.2,0.72),
    new THREE.MeshBasicMaterial({map:bannerTex("aiBA OFFICIAL SCORER · SHOWTIME","#180c2c","#fdb927"),side:THREE.FrontSide,color:0xd8e4f2}));
  scScreen.position.set(scX+0.40,0.44,scZ);scScreen.rotation.y=Math.PI/2;
  indoorRoot.add(scScreen);

  // 两侧及近端底线场边 3 排阶梯式 VIP 名人席（紧密排布，含 2/3 排紫金地毯阶梯地台）
  const pushChair=(cx,cy,cz,rotY)=>{
    const c=Math.cos(rotY),s=Math.sin(rotY);
    const ox=s*0.18,oz=c*0.18;
    cabParts.push({color:0x24143b,matrix:mat4At(cx,cy+0.42,cz,rotY,0.44,0.08,0.46)});
    cabParts.push({color:0x1d1030,matrix:mat4At(cx+ox,cy+0.70,cz+oz,rotY,0.44,0.50,0.09),taperZ:0.74});
    cabParts.push({color:0xfdb927,matrix:mat4At(cx+ox,cy+0.96,cz+oz,rotY,0.42,0.042,0.095)});
    for(const dx of [-0.18,0.18]){
      cabParts.push({color:0x323a4a,matrix:mat4At(cx+c*dx,cy+0.21,cz-s*dx,rotY,0.04,0.42,0.42)});
    }
  };
  const vipZ0=COURT.nearBaseline+0.95,vipZ1=COURT.farBaseline-1.85;
  const sideRows=[
    {dist:9.25,y:0.00,step:0.62,skipScorer:true},
    {dist:10.05,y:0.22,step:0.64,skipScorer:true},
    {dist:10.82,y:0.46,step:0.66,skipScorer:false}
  ];
  for(const side of [-1,1]){
    // 2/3 排阶梯式 VIP 紫金地毯地台
    const deckLen=vipZ1-vipZ0+0.8,deckMid=(vipZ0+vipZ1)*0.5;
    cabParts.push({color:0x161222,matrix:mat4At(side*10.05,0.11,deckMid,0,0.78,0.22,deckLen)});
    cabParts.push({color:0xfdb927,matrix:mat4At(side*9.66,0.215,deckMid,0,0.03,0.02,deckLen)});
    cabParts.push({color:0x141020,matrix:mat4At(side*10.82,0.23,deckMid,0,0.82,0.46,deckLen)});
    cabParts.push({color:0x58278a,matrix:mat4At(side*10.41,0.455,deckMid,0,0.03,0.025,deckLen)});
    const rot=side>0?Math.PI/2:-Math.PI/2;
    for(const row of sideRows){
      const cx=side*row.dist;
      for(let cz=vipZ0;cz<=vipZ1;cz+=row.step){
        if(row.skipScorer&&side<0&&Math.abs(cz-scZ)<2.95)continue;
        pushChair(cx,row.y,cz,rot);
      }
    }
  }
  // 近端底线两侧 VIP 阶梯席（位于摄影记者区后方，朝向 +Z 球场）
  const baseVipZ=COURT.nearBaseline-4.45;
  for(const side of [-1,1]){
    cabParts.push({color:0x161222,matrix:mat4At(side*5.2,0.08,baseVipZ,0,6.6,0.16,0.84)});
    cabParts.push({color:0xfdb927,matrix:mat4At(side*5.2,0.155,baseVipZ+0.42,0,6.6,0.02,0.03)});
    for(let x=2.3;x<=8.1;x+=0.68){
      pushChair(side*x,0.16,baseVipZ,Math.PI);
    }
  }
  bakeVoxelMesh(indoorRoot,cabParts,{materialKey:"ledCabinets",standard:true,material:{roughness:0.34,metalness:0.42,envMapIntensity:0.56}});
}
/* 360° 环馆三层紫金 LED 跑马灯带（严格对齐 Crypto.com Arena 三层豪华包厢的前沿挑檐 rx=26.75, rz=33.85） */
const UPPER_ADS="CRYPTO · aiBA ARENA   ★   LOS ANGELES SHOWTIME   ★   3PT KING   ★   PERCENT BATTLE   ★   ";
let upperRibbonTex=[];
function buildUpperRibbon(){
  const SEG=36;
  const mk=(bg,fg)=>{
    const t=bannerTex(UPPER_ADS,bg,fg);
    t.wrapS=THREE.RepeatWrapping;t.repeat.set(5,1);
    return t;
  };
  upperRibbonTex=[mk("#220d3d","#fdb927"),mk("#0b1730","#7ee7ff")];
  const rings=[
    {y:8.52,rx:27.05,rz:34.15,w:5.72,h:0.44,col:0xeef4fc},
    {y:12.82,rx:27.10,rz:34.20,w:5.74,h:0.34,col:0xd4e2f4},
    {y:14.82,rx:27.15,rz:34.25,w:5.76,h:0.48,col:0xe8f0fa}
  ];
  for(let ri=0;ri<rings.length;ri++){
    const R=rings[ri];
    for(let i=0;i<SEG;i++){
      const a=i/SEG*Math.PI*2;
      const p=bowlFacing(a,R.rx,R.rz);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(R.w,R.h),
        new THREE.MeshBasicMaterial({map:upperRibbonTex[(i+ri)%2],
          side:THREE.DoubleSide,color:R.col}));
      m.position.set(p.x,R.y,p.z);m.rotation.y=p.rot-Math.PI/2;
      freezeStaticMesh(m);
      indoorRoot.add(m);
    }
  }
}
function updUpperRibbon(t){
  if(!upperRibbonTex.length)return;
  const cyc=(t*0.5)%6,run=Math.min(cyc,3.2),off=-run*0.10;
  for(const tx of upperRibbonTex)tx.offset.x=off;
}
function buildSuiteRing(){
  const parts=[],glassParts=[],glowParts=[];
  const N=36,rx=28.0,rz=35.1;
  const levels=[8.95,11.05,13.15];
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    const rear=bowlFacing(a,rx+1.55,rz+1.55);
    const glowBack=bowlFacing(a,rx+0.68,rz+0.68);
    const front=bowlFacing(a,rx-0.75,rz-0.75);
    const d=bowlFacing(a+Math.PI/N,rx,rz);
    // 贯穿三层包厢的后方深色背墙（退至 rx+1.55，与 rx+0.68 暖光内壁拉开 0.87m 净距，彻底消除 Z-fighting 斜向黑条纹）
    parts.push({color:0x121520,matrix:mat4At(rear.x,11.6,rear.z,p.rot,0.36,6.6,5.65)});
    parts.push({color:0x0e111a,matrix:mat4At(d.x,11.6,d.z,d.rot,1.85,6.6,0.28)});
    for(let li=0;li<levels.length;li++){
      const ly=levels[li];
      // 每层包厢水平挑檐地板与前缘紫金饰条
      parts.push({color:0x181426,matrix:mat4At(p.x,ly-0.22,p.z,p.rot,1.75,0.32,5.62)});
      parts.push({color:0xfdb927,matrix:mat4At(front.x,ly-0.05,front.z,p.rot,0.14,0.06,5.60)});
      // 包厢内部暖金琥珀色背墙与发光吊顶（独立位于 rx+0.68，切向宽度收至 4.85m 避免弯角相邻重叠）
      glowParts.push({color:0xe89b38,matrix:mat4At(glowBack.x,ly+0.58,glowBack.z,p.rot,0.26,1.12,4.85)});
      glowParts.push({color:0xf5c46e,matrix:mat4At(p.x,ly+1.24,p.z,p.rot,1.28,0.14,4.85)});
      // 包厢前缘半高透明反光玻璃栏板
      glassParts.push({color:0x4a6080,matrix:mat4At(front.x,ly+0.28,front.z,p.rot,0.08,0.56,5.10)});
    }
    // 顶层包厢上沿封顶挑檐
    parts.push({color:0x181426,matrix:mat4At(p.x,14.72,p.z,p.rot,1.85,0.36,5.66)});
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"suite",standard:true,material:{roughness:0.42,metalness:0.28,envMapIntensity:0.48}});
  bakeVoxelMesh(indoorRoot,glowParts,{materialKey:"suiteGlow",material:{emissive:0xff9824,emissiveIntensity:0.52}});
  const glassMesh=bakeVoxelMesh(indoorRoot,glassParts,{materialKey:"suiteGlass",standard:true,material:{roughness:0.10,metalness:0.35,envMapIntensity:0.95,transparent:true,opacity:0.48}});
  glassMesh.name="suiteGlass";
}
/* 底线摄影记者席：随扩建后的宽阔底线后移至 nearBaseline-3.9m，不再挤压篮架空间 */
function buildPressRow(){
  const personParts=[],barrierParts=[],mm=new THREE.Matrix4();
  const q=new THREE.Quaternion(),eul=new THREE.Euler();
  const pVec=new THREE.Vector3(),sVec=new THREE.Vector3();
  const pushPerson=(shape,x,y,z,sx,sy,sz,c,tx,tz,rx=0)=>{
    q.setFromEuler(eul.set(rx,0,0));
    mm.compose(pVec.set(x,y,z),q,sVec.set(sx,sy,sz));
    personParts.push({shape,color:c,matrix:mm.clone(),taperX:tx,taperZ:tz});
  };
  const pushBarrier=(x,y,z,sx,sy,sz,c,tx,tz)=>{
    q.identity();
    mm.compose(pVec.set(x,y,z),q,sVec.set(sx,sy,sz));
    barrierParts.push({color:c,matrix:mm.clone(),taperX:tx,taperZ:tz});
  };
  const COAT=[0x181c26,0x141720,0x1c222e,0x161922];
  const VEST=[0x252d3e,0x1e2636,0x2c223e];
  const SKIN=[0xd9a066,0xf0c294,0x8d5524];
  const HAIR=[0x181512,0x2f2016,0x1e222c];
  const rows=[[COURT.nearBaseline-3.9,1],[COURT.farBaseline+3.9,-1]];
  for(let ri=0;ri<rows.length;ri++){
    const bz=rows[ri][0],dir=rows[ri][1];
    for(let side=-1;side<=1;side+=2){
      for(let i=0;i<7;i++){
        const x=side*(2.2+i*0.86)+rnd(-.05,.05);
        const z=bz+rnd(-.08,.08);
        // 近端底线已升级为真实 3D 观众/摄影师模型（spectator_sit.glb），跳过旧胶囊假人但保留 rnd 调用次数以维持随机种子一致
        if(ri===0)continue;
        const coat=COAT[(i+ri*3)%COAT.length];
        const vest=VEST[(i+ri)%VEST.length];
        const skin=SKIN[(i+ri*2)%SKIN.length];
        const hair=HAIR[(i+ri)%HAIR.length];
        pushPerson("sphere",x,0.14,z,0.34,0.18,0.30,0x161a22);
        pushPerson("cyl",x,0.35,z,0.34,0.40,0.26,coat,1.15,1.10);
        pushPerson("sphere",x,0.46,z,0.42,0.24,0.29,vest);
        pushPerson("cyl",x,0.63,z,0.10,0.10,0.10,skin);
        pushPerson("sphere",x,0.75,z,0.21,0.23,0.22,skin,1.06,1.04);
        pushPerson("dome",x,0.78,z-dir*0.01,0.225,0.19,0.235,hair);
        pushPerson("cyl",x-0.11,0.12,z+dir*0.24,0.135,0.38,0.135,0x12151e,0.88,0.88,dir*Math.PI*0.48);
        pushPerson("cyl",x+0.11,0.12,z+dir*0.24,0.135,0.38,0.135,0x12151e,0.88,0.88,dir*Math.PI*0.48);
        pushPerson("cyl",x-0.19,0.52,z+dir*0.10,0.10,0.28,0.10,coat,0.86,0.86,dir*-0.72);
        pushPerson("cyl",x+0.19,0.52,z+dir*0.10,0.10,0.28,0.10,coat,0.86,0.86,dir*-0.72);
        pushPerson("box",x,0.65,z+dir*0.24,0.18,0.14,0.18,0x0f1218,0.92,0.92);
        pushPerson("cyl",x,0.65,z+dir*0.41,0.115,0.22,0.115,0xc8d0dc,1.0,1.0,Math.PI*0.5);
        pushPerson("cyl",x,0.65,z+dir*0.54,0.135,0.09,0.135,0x0a0d12,1.08,1.08,Math.PI*0.5);
      }
    }
    /* 媒体区软包挡板 + 紫金防撞护条 */
    for(let i=0;i<12;i++){
      const bx=(i-5.5)*1.55,bzz=bz-dir*0.58;
      pushBarrier(bx,0.52,bzz,1.58,1.02,0.18,0x0d1018);
      pushBarrier(bx,1.06,bzz,1.60,0.09,0.22,0x341954,0.85,0.82);
    }
  }
  bakeOrganicMesh(indoorRoot,personParts,{materialKey:"pressPeople",standard:true,material:{roughness:0.58,metalness:0.12,envMapIntensity:0.32}});
  bakeVoxelMesh(indoorRoot,barrierParts,{materialKey:"press",standard:true,material:{roughness:0.48,metalness:0.18,envMapIntensity:0.35}});
}
/* 300 层看台顶部以上的环场深色建筑高墙 */
function buildUpperWall(){
  const parts=[];
  const SEGN=48,rx=40.4,rz=47.6;
  const yBot=23.6,yTop=CEIL_Y-0.4,h=yTop-yBot;
  for(let i=0;i<SEGN;i++){
    const a=i/SEGN*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    parts.push({color:0x10131d,matrix:mat4At(p.x,(yTop+yBot)/2,p.z,p.rot,6.2,h,1.5)});
    parts.push({color:0x26173e,matrix:mat4At(p.x,yBot+0.28,p.z,p.rot,6.25,0.38,1.56)});
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"upperwall"});
}
/* 湖人主场风格总冠军锦旗与退役传奇球衣贴图：经典紫金配色 */
function retiredJerseyTex(num,idx){
  const isChamp=idx%3===0;
  return pixTex(192,288,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h);
    if(isChamp){
      gr.addColorStop(0,"#f5b526");gr.addColorStop(0.55,"#e09c18");gr.addColorStop(1,"#b8790c");
    }else{
      gr.addColorStop(0,"#2c144d");gr.addColorStop(0.55,"#1e0d38");gr.addColorStop(1,"#120724");
    }
    g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.strokeStyle=isChamp?"#2c144d":"#fdb927";g.lineWidth=8;g.strokeRect(10,10,w-20,h-24);
    g.strokeStyle=isChamp?"rgba(44,20,77,0.45)":"rgba(253,185,39,0.45)";g.lineWidth=3;g.strokeRect(20,20,w-40,h-44);
    g.fillStyle=isChamp?"#2c144d":"#fdb927";g.fillRect(18,18,w-36,38);
    g.fillStyle=isChamp?"#fdb927":"#1e0d38";g.font="bold 19px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
    g.fillText(isChamp?"WORLD CHAMPIONS":"SHOWTIME LEGEND",w/2,38);
    // 中央紫金球衣底版与V领剪裁
    g.fillStyle=isChamp?"#2c144d":"#fdb927";
    g.beginPath();
    g.moveTo(42,68);g.lineTo(72,68);g.lineTo(w/2,92);g.lineTo(w-72,68);g.lineTo(w-42,68);
    g.lineTo(w-32,110);g.lineTo(w-32,226);g.lineTo(32,226);g.lineTo(32,110);
    g.closePath();g.fill();
    g.strokeStyle=isChamp?"#fdb927":"#2c144d";g.lineWidth=5;g.stroke();
    g.fillStyle=isChamp?"#fdb927":"#1e0d38";g.font="bold 92px Orbitron, monospace";
    g.fillText(num,w/2,162);
    g.fillStyle=isChamp?"#2c144d":"#fdb927";g.font="bold 18px Orbitron, monospace";
    g.fillText("★  LOS ANGELES  ★",w/2,248);
    for(let x=14;x<w-14;x+=10)g.fillRect(x,h-12,6,10);
  },{smooth:true,mipmaps:true});
}
let centerScoreboardTex=null,lastScoreboardKey="";
function drawScoreboard(g,w,h,data){
  const d=data||{};
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,"#050811");gr.addColorStop(0.5,"#0b1324");gr.addColorStop(1,"#05070e");
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  // LED 扫描线底纹
  g.fillStyle="rgba(126,231,255,0.035)";
  for(let y=0;y<h;y+=6)g.fillRect(0,y,w,2);
  // 金属外框 + 赛会蓝金内框
  g.strokeStyle="#263854";g.lineWidth=10;g.strokeRect(8,8,w-16,h-16);
  g.strokeStyle="#ffd23f";g.lineWidth=3;g.strokeRect(18,18,w-36,h-36);
  // 顶部赛事横眉
  g.fillStyle="#11203d";g.fillRect(22,22,w-44,54);
  g.fillStyle="#7ee7ff";g.font="bold 34px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
  g.fillText(d.title||"aiBA CLUTCH ARENA",w/2,50);
  // 左右主客队装饰侧翼色块
  g.fillStyle="rgba(255,210,63,0.14)";g.fillRect(26,86,74,116);
  g.fillStyle="rgba(126,231,255,0.14)";g.fillRect(w-100,86,74,116);
  g.fillStyle="#ffd23f";g.fillRect(26,86,8,116);
  g.fillStyle="#7ee7ff";g.fillRect(w-34,86,8,116);
  // 中央大比分
  g.fillStyle="#ffd23f";g.font="bold 72px Orbitron, monospace";
  g.fillText(d.score||"108 : 96",w/2,148);
  // 底部计时与节次栏
  g.fillStyle="#080e1a";g.fillRect(110,206,w-220,38);
  g.strokeStyle="#2b4266";g.lineWidth=2;g.strokeRect(110,206,w-220,38);
  g.fillStyle=d.subColor||"#7CFC6B";g.font="bold 30px Orbitron, monospace";
  g.fillText(d.clock||"Q4  03:47",w/2,226);
}
function scoreboardTex(){
  if(!centerScoreboardTex){
    lastScoreboardKey="";
    centerScoreboardTex=pixTex(512,256,(g,w,h)=>drawScoreboard(g,w,h),{smooth:true,mipmaps:true});
  }
  return centerScoreboardTex;
}
let lastCenterScore="",lastCenterClock="";
function updateCenterScoreboard(data){
  if(!centerScoreboardTex||!centerScoreboardTex.image)return;
  const d=data||{};
  if(d.score)lastCenterScore=d.score;
  if(d.clock)lastCenterClock=d.clock;
  const key=(d.title||"")+"|"+(d.score||"")+"|"+(d.clock||"")+"|"+(d.subColor||"");
  if(key&&key===lastScoreboardKey)return;
  lastScoreboardKey=key;
  const cv=centerScoreboardTex.image,g=cv.getContext("2d");
  drawScoreboard(g,cv.width,cv.height,data);
  centerScoreboardTex.needsUpdate=true;
  if(jumboOverlayTex&&jumboOverlayTex.image){
    const ocv=jumboOverlayTex.image,og=ocv.getContext("2d");
    drawJumboOverlay(og,ocv.width,ocv.height,jumboCamMode||"COURT CAM",lastCenterScore||"108 : 96",lastCenterClock||"LIVE HD");
    jumboOverlayTex.needsUpdate=true;
  }
  if(typeof G!=="undefined")window.__aibaHeavyFrame=G.tNow;
}
window.updateCenterScoreboard=updateCenterScoreboard;
function buildRetiredJerseys(){
  /* 对照 Crypto.com Arena 实拍：湖人总冠军锦旗与退役球衣并非挂在顶棚正中，
     而是以双排矩阵整齐悬挂于端线高层包厢/看台立面 (y=12.6m & y=15.4m, z=nearBaseline-16.2m)，
     在主比赛机位中直接呈现在篮筐上方的高空背景墙上！ */
  const row1=["8","24","32","33","34","42","44","22"],N=row1.length;
  const z=COURT.nearBaseline-16.2,y=13.2;
  const rodParts=[];
  const spacing=2.65,totalW=(N-1)*spacing+2.6;
  rodParts.push({color:0x4a5568,pos:[0,y+1.38,z],scale:[totalW,0.10,0.10]});
  for(let i=0;i<N;i++){
    const x=(i-(N-1)/2)*spacing;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.96,2.56),
      new THREE.MeshBasicMaterial({map:retiredJerseyTex(row1[i],i),side:THREE.DoubleSide,color:0xd8e0ee}));
    m.position.set(x,y,z);
    freezeStaticMesh(m);
    indoorRoot.add(m);
    rodParts.push({color:0xfdb927,pos:[x,y+1.32,z],scale:[2.04,0.06,0.07]});
    rodParts.push({color:0x384252,pos:[x,y-1.32,z],scale:[2.00,0.045,0.055]});
    const cableH=CEIL_Y-1.0-(y+1.38);
    for(const dx of [-0.82,0.82]){
      rodParts.push({color:0x2b3342,pos:[x+dx,y+1.38+cableH/2,z],scale:[0.035,cableH,0.035]});
    }
  }
  bakeVoxelMesh(indoorRoot,rodParts,{materialKey:"bannerRig",standard:true,material:{roughness:0.35,metalness:0.65,envMapIntensity:0.50}});
}
let jumboRT=null,jumboCam=null,jumboRoot=null,jumboOverlayTex=null,jumboCamMode="",jumboFrame=0,jumboLastT=-1;
function drawJumboOverlay(g,w,h,camLabel,scoreTxt,clockTxt){
  g.clearRect(0,0,w,h);
  // 左上角 LIVE 直播角标
  g.fillStyle="rgba(180,24,38,0.92)";g.fillRect(14,12,78,24);
  g.fillStyle="#ffffff";g.beginPath();g.arc(28,24,4.5,0,Math.PI*2);g.fill();
  g.font="bold 14px Orbitron, monospace";g.textAlign="left";g.textBaseline="middle";
  g.fillText("LIVE",38,24);
  // 右上角机位标签（赛场直播 / 名人席 / 观众席 / 球星特写）
  g.fillStyle="rgba(12,16,28,0.84)";g.fillRect(w-178,12,164,24);
  g.strokeStyle="rgba(253,185,39,0.75)";g.lineWidth=1.5;g.strokeRect(w-178,12,164,24);
  g.fillStyle="#fdb927";g.font="bold 12px Orbitron, monospace";g.textAlign="center";
  g.fillText(camLabel||"COURT CAM",w-96,24);
  // 底部 NBA 转播比分条 (Lower-Third Score Bug)
  g.fillStyle="rgba(10,13,22,0.88)";g.fillRect(0,h-42,w,42);
  g.fillStyle="#58278a";g.fillRect(0,h-42,118,42);
  g.fillStyle="#fdb927";g.fillRect(118,h-42,4,42);
  g.fillStyle="#ffffff";g.font="bold 16px Orbitron, monospace";g.textAlign="center";
  g.fillText("LAKERS",59,h-21);
  g.fillStyle="#fdb927";g.font="bold 22px Orbitron, monospace";
  g.fillText(scoreTxt||"108 : 96",w*0.5,h-21);
  g.fillStyle="#7ee7ff";g.font="bold 15px Orbitron, monospace";g.textAlign="right";
  g.fillText(clockTxt||"Q4  03:47",w-16,h-21);
}
function getJumboOverlayTex(){
  if(!jumboOverlayTex){
    jumboOverlayTex=pixTex(512,256,(g,w,h)=>drawJumboOverlay(g,w,h,"COURT CAM","108 : 96","Q4  03:47"),{smooth:true});
  }
  return jumboOverlayTex;
}
const IS_COARSE_JUMBO=(typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches)||((typeof navigator!=="undefined"&&navigator.maxTouchPoints>0));
function updJumbotronBroadcast(t){
  if(IS_COARSE_JUMBO)return;
  if(!jumboRoot||!indoorRoot||!indoorRoot.visible||typeof renderer==="undefined"||!renderer)return;
  /* 投篮蓄力关键帧或地板灯光秀高潮期间,暂停头顶副屏二次全场景重绘,把 100% 算力留给手感与主视角 */
  if(typeof G!=="undefined"&&(G.charging||G.state==="pregame"))return;
  if(!jumboRT){
    const rtw=IS_COARSE_JUMBO?240:320,rth=IS_COARSE_JUMBO?144:192;
    jumboRT=new THREE.WebGLRenderTarget(rtw,rth,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    jumboCam=new THREE.PerspectiveCamera(46,rtw/rth,0.5,90);
    for(const ch of jumboRoot.children){
      if(ch.userData&&ch.userData.isLiveFeed){ch.material.map=jumboRT.texture;ch.material.needsUpdate=true;}
    }
  }
  jumboFrame++;
  const minInterval=IS_COARSE_JUMBO?0.36:0.12;
  if(jumboFrame<4||(t-jumboLastT>=0&&t-jumboLastT<minInterval))return;
  if(IS_COARSE_JUMBO&&window.__aibaHeavyFrame===t)return;
  jumboLastT=t;
  window.__aibaHeavyFrame=t;
  // 每 3.8 秒自动切换真实直播机位：赛场直播 / 球星特写 / 名人VIP席 / 观众席
  const slot=Math.floor(t/3.8)%4;
  const labels=["COURT LIVE","STAR CLOSE-UP","COURTSIDE VIP","FAN CROWD CAM"];
  const label=labels[slot];
  if(slot===0){
    // 赛场直播机位（投篮弧顶望向篮筐）
    jumboCam.position.set(Math.sin(t*0.25)*2.2,3.4,COURT.midZ-0.8);
    jumboCam.lookAt(0,2.2,HOOP.z);
  }else if(slot===1){
    // 球星 / 射手 / 底线吉祥物特写机位
    const px=(typeof G!=="undefined"&&G.player&&G.player.group)?G.player.group.position.x:0;
    const pz=(typeof G!=="undefined"&&G.player&&G.player.group)?G.player.group.position.z:0;
    jumboCam.position.set(px+Math.sin(t*0.5)*1.8,1.9,pz-2.8);
    jumboCam.lookAt(px,1.35,pz);
  }else if(slot===2){
    // 场边三排名人 VIP 席特写巡航
    const sweepZ=COURT.midZ-2.5+Math.sin(t*0.35)*3.5;
    jumboCam.position.set(4.5,1.8,sweepZ);
    jumboCam.lookAt(9.8,1.0,sweepZ-0.8);
  }else{
    // 看台观众席欢呼扫拍
    jumboCam.position.set(-4.0,3.2,COURT.midZ);
    jumboCam.lookAt(-18.5,4.2,COURT.midZ+Math.sin(t*0.3)*6.0);
  }
  if(jumboCamMode!==label){
    jumboCamMode=label;
    if(jumboOverlayTex&&jumboOverlayTex.image){
      const cv=jumboOverlayTex.image,g=cv.getContext("2d");
      const isLS=typeof G!=="undefined"&&G.mode==="lastshot"&&lastCenterScore;
      const sc=isLS?lastCenterScore:((typeof G!=="undefined"&&G.score!=null)?(G.score+" : "+(G.oppScore||0)):"108 : 96");
      const clk=isLS&&lastCenterClock?lastCenterClock:"LIVE HD";
      drawJumboOverlay(g,cv.width,cv.height,label,sc,clk);
      jumboOverlayTex.needsUpdate=true;
    }
  }
  const prevVis=jumboRoot.visible;
  const prevShadowAuto=renderer.shadowMap?renderer.shadowMap.autoUpdate:false;
  jumboRoot.visible=false;
  if(renderer.shadowMap)renderer.shadowMap.autoUpdate=false;
  const prevTarget=renderer.getRenderTarget();
  renderer.setRenderTarget(jumboRT);
  renderer.render(scene,jumboCam);
  renderer.setRenderTarget(prevTarget);
  if(renderer.shadowMap)renderer.shadowMap.autoUpdate=prevShadowAuto;
  jumboRoot.visible=prevVis;
}
function buildCenterHung(){
  /* 中央吊挂巨型斗屏（Crypto.com Arena 级 Jumbotron）：悬吊于 y=12.2m（高于三分抛物线，且在主转播视角顶部清晰可见），
     四面主转播巨幕实时播放球场/VIP席/观众席/球星特写，四角斜屏同步显示实时比分与计时！ */
  const y=12.2,cz=COURT.midZ,scoreTex=scoreboardTex(),ovTex=getJumboOverlayTex();
  const N=8,R=4.25;
  const parts=[];
  const root=new THREE.Group();root.name="centerHungScoreboard";indoorRoot.add(root);
  jumboRoot=root;jumboFrame=0;jumboLastT=-1;jumboCamMode="";
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2;
    const isMain=(i%2===0); // 四正方向为宽幅直播屏，四角为比分数据屏
    const sx=Math.sin(a)*R,sz=cz+Math.cos(a)*R;
    const w=isMain?3.65:2.95,h=isMain?2.55:2.45;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({map:isMain?(jumboRT?jumboRT.texture:scoreTex):scoreTex,side:THREE.DoubleSide}));
    m.position.set(sx,y,sz);
    m.rotation.y=a;
    if(isMain)m.userData.isLiveFeed=true;
    root.add(m);
    if(isMain){
      const ov=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
        new THREE.MeshBasicMaterial({map:ovTex,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
      ov.position.set(Math.sin(a)*(R+0.03),y,cz+Math.cos(a)*(R+0.03));
      ov.rotation.y=a;
      root.add(ov);
    }
    const bx=Math.sin(a)*(R-0.15),bz=cz+Math.cos(a)*(R-0.15);
    parts.push({color:0x121622,matrix:mat4At(bx,y,bz,a,w+0.12,2.76,0.24)});
    parts.push({color:0xfdb927,matrix:mat4At(sx,y+1.36,sz,a,w+0.10,0.07,0.10)});
    parts.push({color:0x7c3aed,matrix:mat4At(sx,y-1.36,sz,a,w+0.10,0.07,0.10)});
    const ca=a+Math.PI/N;
    parts.push({color:0x252d3e,matrix:mat4At(Math.sin(ca)*(R+0.05),y,cz+Math.cos(ca)*(R+0.05),ca,0.20,2.88,0.20)});
  }
  const env=typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
  const capMat=new THREE.MeshStandardMaterial({color:0x161b28,roughness:0.34,metalness:0.64,envMap:env,envMapIntensity:env?0.58:0});
  [1.56,-1.56].forEach(dy=>{
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(R+0.46,R+0.36,0.44,N*2),capMat);
    cap.position.set(0,y+dy,cz);root.add(cap);
  });
  if(upperRibbonTex&&upperRibbonTex.length){
    const haloGeo=new THREE.CylinderGeometry(R+0.50,R+0.50,0.42,28,1,true);
    const haloMatTop=new THREE.MeshBasicMaterial({map:upperRibbonTex[0],side:THREE.DoubleSide,color:0xa8b4c8});
    const haloMatBot=new THREE.MeshBasicMaterial({map:upperRibbonTex[1],side:THREE.DoubleSide,color:0x92a2b8});
    const topHalo=new THREE.Mesh(haloGeo,haloMatTop);topHalo.position.set(0,y+1.88,cz);root.add(topHalo);
    const botHalo=new THREE.Mesh(haloGeo,haloMatBot);botHalo.position.set(0,y-1.88,cz);root.add(botHalo);
  }
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2+Math.PI/4;
    const sx=Math.sin(a)*2.25,sz=Math.cos(a)*2.25;
    const h=CEIL_Y-y-1.6;
    const midY=(CEIL_Y+y+1.6)/2;
    parts.push({color:0x1e2534,pos:[sx,midY,cz+sz],scale:[0.24,h,0.24]});
  }
  for(const hy of [y+3.0,y+5.8,y+8.6]){
    parts.push({color:0x181f2c,pos:[0,hy,cz-2.25],scale:[4.5,0.12,0.12]});
    parts.push({color:0x181f2c,pos:[0,hy,cz+2.25],scale:[4.5,0.12,0.12]});
    parts.push({color:0x181f2c,pos:[-2.25,hy,cz],scale:[0.12,0.12,4.5]});
    parts.push({color:0x181f2c,pos:[2.25,hy,cz],scale:[0.12,0.12,4.5]});
  }
  bakeVoxelMesh(root,parts,{materialKey:"hangar",standard:true,material:{roughness:0.36,metalness:0.58,envMapIntensity:0.50}});
}

function buildCeiling(){
  const X=41,ZA=COURT.midZ-48,ZB=COURT.midZ+48;
  const zSpan=ZB-ZA,zMid=COURT.midZ;
  const parts=[];
  /* 高空深邃剧场穹顶 (y=28.5m)：守住“场地亮 > 看台暗 > 穹顶深邃”的斯台普斯剧场灯光比，
     同时用大跨度空间钢桁架、双环高空马道与高功率体育馆矩阵灯箱塑造宏伟空间感。 */
  parts.push({color:0x070910,pos:[0,CEIL_Y,zMid],scale:[X*2,0.6,zSpan]});
  for(let i=0;i<11;i++){
    const z=ZA+zSpan*(i+0.5)/11;
    parts.push({color:0x161b26,pos:[0,CEIL_Y-0.95,z],scale:[X*2,0.42,0.58]});
    parts.push({color:0x10141d,pos:[0,CEIL_Y-1.62,z],scale:[X*2,0.20,0.30]});
    for(let x=-32;x<=32;x+=8){
      parts.push({color:0x131822,pos:[x,CEIL_Y-1.28,z],scale:[0.16,0.62,0.18]});
    }
  }
  [-32,-16,0,16,32].forEach(x=>
    parts.push({color:0x161b26,pos:[x,CEIL_Y-0.62,zMid],scale:[0.58,0.36,zSpan]}));
  // 双环高空灯光检修猫道 (Lighting Catwalks)
  [-14.2,-7.4,7.4,14.2].forEach(x=>{
    parts.push({color:0x131824,pos:[x,CEIL_Y-1.85,zMid],scale:[1.65,0.12,zSpan*0.84]});
  });
  for(let i=0;i<10;i++){
    const z0=ZA+zSpan*(i+0.5)/11, z1=ZA+zSpan*(i+1.5)/11;
    const zm=(z0+z1)/2, dz=z1-z0;
    for(let sx=-1;sx<=1;sx+=2){
      const rot=sx*Math.atan2(dz,16);
      parts.push({color:0x131822,matrix:mat4At(sx*16,CEIL_Y-1.25,zm,rot,0.26,0.20,Math.hypot(dz,32))});
    }
  }
  /* 高空矩阵投光灯组 + 舞台级体积光束点位 */
  const lamps=[],lampPos=[];
  for(const xRow of [-14.2,-7.4,7.4,14.2]){
    const cnt=Math.abs(xRow)<10?9:7;
    for(let i=0;i<cnt;i++){
      const z=COURT.nearBaseline-6+(COURT.length+12)*(i+0.5)/cnt;
      const p=[xRow,CEIL_Y-2.15,z];
      parts.push({color:0x181f2c,pos:[p[0],p[1]+0.22,p[2]],scale:[3.1,0.24,1.65],taperX:0.84,taperZ:0.84});
      lamps.push({color:0xffffff,pos:p,scale:[2.85,0.24,1.45]});
      if(Math.abs(xRow)<10&&z>COURT.nearBaseline-3.0&&z<COURT.playMaxZ+4.5)lampPos.push(p);
    }
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"ceiling"});
  bakeVoxelMesh(indoorRoot,lamps,{materialKey:"ceilingLamp",material:{emissive:0xffe6b4}});
  buildLightShafts(lampPos);
  buildFloorLightPools(lampPos);
  buildUpperRibbon();
  buildSuiteRing();
  buildUpperWall();
  buildCourtsideRibbon();
  buildPressRow();
  buildRetiredJerseys();
  buildCenterHung();
}

/* ---------------- 次世代体积光束 (Volumetric Spotlight Cones) & 地面黄金灯池 ---------------- */
function shaftGradientTex(){
  return pixTex(8,128,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h);
    gr.addColorStop(0,"rgba(255,242,210,.82)");
    gr.addColorStop(.38,"rgba(255,228,176,.34)");
    gr.addColorStop(.76,"rgba(212,175,255,.10)");
    gr.addColorStop(1,"rgba(255,220,168,0)");
    g.clearRect(0,0,w,h);g.fillStyle=gr;g.fillRect(0,0,w,h);
  },{smooth:true});
}
/* 默认开启次世代球馆顶灯体积光束与地面灯池（可用 ?shafts=0 / ?pools=0 手动关闭） */
const SHAFTS_ON=(()=>{try{return !/(\?|&)shafts=0(&|#|$)/.test(location.search);}catch(e){return true;}})();
function buildLightShafts(lampPos){
  if(!lampPos.length||!SHAFTS_ON)return;
  const height=20.5;
  const geo=new THREE.CylinderGeometry(0.85,4.2,height,16,1,true);
  const mat=new THREE.MeshBasicMaterial({map:shaftGradientTex(),transparent:true,opacity:.115,
    depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false});
  for(const p of lampPos){
    const m=new THREE.Mesh(geo,mat);
    // 光锥下沉至 y=2.0~22.5m 区间并微向球场中心聚拢，使主比赛机位清晰可见剧场级丁达尔光束
    const tiltX=p[0]>0?0.11:-0.11;
    m.position.set(p[0]*0.86,height/2+2.0,p[2]);
    m.rotation.z=tiltX;
    m.renderOrder=6;freezeStaticMesh(m);indoorRoot.add(m);
  }
}
const POOLS_ON=(()=>{
  try{return !/(\?|&)pools=0(&|#|$)/.test(location.search);}catch(e){return true;}
})();
function buildFloorLightPools(lampPos){
  if(!POOLS_ON)return;
  const W=32,D=COURT.floorMaxZ-COURT.floorMinZ,PX=14;
  const tex=pixTex(Math.round(W*PX),Math.round(D*PX),(g,w,h)=>{
    g.fillStyle="#000";g.fillRect(0,0,w,h);
    const u=x=>(x+W/2)/W*w,v=z=>(z-COURT.floorMinZ)/D*h;
    g.globalCompositeOperation="lighter";
    for(const p of lampPos){
      const cx=u(p[0]*0.78),cy=v(p[2]),r=5.4/W*w;
      const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
      gr.addColorStop(0,"rgba(255,238,200,.32)");
      gr.addColorStop(.48,"rgba(255,224,172,.12)");
      gr.addColorStop(1,"rgba(255,216,158,0)");
      g.save();g.translate(cx,cy);g.scale(1,1.45);g.translate(-cx,-cy);
      g.fillStyle=gr;g.fillRect(cx-r,cy-r*1.5,r*2,r*3.0);g.restore();
      // 模拟实拍照片中清漆地板反射顶棚灯阵的高光亮斑条
      const sr=1.5/W*w;
      const sg=g.createRadialGradient(cx,cy,0,cx,cy,sr);
      sg.addColorStop(0,"rgba(255,250,235,.34)");
      sg.addColorStop(.5,"rgba(253,185,39,.12)");
      sg.addColorStop(1,"rgba(255,240,210,0)");
      g.save();g.translate(cx,cy);g.scale(.48,3.2);g.translate(-cx,-cy);
      g.fillStyle=sg;g.fillRect(cx-sr,cy-sr,sr*2,sr*2);g.restore();
    }
    const cx=u(0),cy=v(-2.8),r=15/W*w;
    const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,"rgba(255,228,176,.10)");
    gr.addColorStop(1,"rgba(255,220,164,0)");
    g.fillStyle=gr;g.fillRect(cx-r,cy-r,r*2,r*2);
  },{smooth:true,mipmaps:true});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({
    map:tex,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending,fog:true}));
  m.rotation.x=-Math.PI/2;
  m.position.set(0,.008,(COURT.floorMinZ+COURT.floorMaxZ)/2);m.renderOrder=-2;
  indoorRoot.add(m);
}

/* backcourt show: the far half is atmosphere only, shooting stays on the same half */
const showCrew=[];
function showBox(parent,geo,mat,x,y,z,sx,sy,sz){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);
  return m;
}
/* ---------------- voxel/facet baking: 把一组固定部件烘焙成单个带切面明暗与顶点色的网格 ----------------
   支持可选的 taperX / taperZ / shearZ（切面斜棱柱）以及按真实三角面法线计算的微妙明暗对比，
   让看台、护栏、器材、观众身体在不同朝向的面上自然拉开立体层次，且零额外 draw call。 */
const VOXEL_UNIT_BOX=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const VOXEL_BAKED_MATERIALS=new Map();
function bakedVoxelMaterial(key,opts,standard){
  const id=(key||"basic")+(standard?":std":"");
  if(VOXEL_BAKED_MATERIALS.has(id))return VOXEL_BAKED_MATERIALS.get(id);
  let m;
  if(standard){
    const env=typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
    m=new THREE.MeshStandardMaterial(Object.assign({
      color:0xffffff,vertexColors:true,roughness:0.5,metalness:0.2,
      envMap:env,envMapIntensity:env?0.45:0
    },opts||{}));
  }else{
    m=new THREE.MeshLambertMaterial(Object.assign({color:0xffffff,vertexColors:true},opts||{}));
  }
  VOXEL_BAKED_MATERIALS.set(id,m);
  return m;
}
/* parts: [{color:THREE.Color|number, pos:[x,y,z], scale:[sx,sy,sz], taperX?, taperZ?, shearZ?}] 或 [{color, matrix:Matrix4}] */
function bakeVoxelGeometry(parts){
  const src=VOXEL_UNIT_BOX,srcPos=src.getAttribute("position");
  const per=srcPos.count,total=per*parts.length;
  const pos=new Float32Array(total*3),norm=new Float32Array(total*3),col=new Float32Array(total*3);
  const m=new THREE.Matrix4(),v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
  const e1=new THREE.Vector3(),e2=new THREE.Vector3(),fn=new THREE.Vector3(),c=new THREE.Color();
  let off=0;
  for(const part of parts){
    if(part.matrix)m.copy(part.matrix);
    else{
      const s=part.scale||[1,1,1],p=part.pos||[0,0,0];
      m.makeScale(s[0],s[1],s[2]);m.setPosition(p[0],p[1],p[2]);
    }
    if(part.color&&part.color.isColor)c.copy(part.color);else c.set(part.color==null?0xffffff:part.color);
    const tx=part.taperX==null?1:part.taperX;
    const tz=part.taperZ==null?1:part.taperZ;
    const sh=part.shearZ||0;
    const readV=(idx,out)=>{
      out.fromBufferAttribute(srcPos,idx);
      if(out.y>0&&(tx!==1||tz!==1||sh!==0)){
        out.x*=tx;out.z=out.z*tz+sh;
      }
      return out.applyMatrix4(m);
    };
    for(let i=0;i<per;i+=3){
      readV(i,v0);readV(i+1,v1);readV(i+2,v2);
      e1.subVectors(v1,v0);e2.subVectors(v2,v0);
      fn.crossVectors(e1,e2).normalize();
      // 微妙的切面方向性明暗调制（顶面略亮、底面略压、侧面前后自然分离）
      const shade=part.noShade?1.0:(0.95+0.075*(fn.x*0.25+fn.y*0.78+fn.z*0.42));
      const cr=Math.min(1,c.r*shade),cg=Math.min(1,c.g*shade),cb=Math.min(1,c.b*shade);
      const o0=(off+i)*3,o1=o0+3,o2=o0+6;
      pos[o0]=v0.x;pos[o0+1]=v0.y;pos[o0+2]=v0.z;
      pos[o1]=v1.x;pos[o1+1]=v1.y;pos[o1+2]=v1.z;
      pos[o2]=v2.x;pos[o2+1]=v2.y;pos[o2+2]=v2.z;
      norm[o0]=norm[o1]=norm[o2]=fn.x;
      norm[o0+1]=norm[o1+1]=norm[o2+1]=fn.y;
      norm[o0+2]=norm[o1+2]=norm[o2+2]=fn.z;
      col[o0]=col[o1]=col[o2]=cr;
      col[o0+1]=col[o1+1]=col[o2+1]=cg;
      col[o0+2]=col[o1+2]=col[o2+2]=cb;
    }
    off+=per;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("normal",new THREE.BufferAttribute(norm,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  geo.computeBoundingSphere();
  return geo;
}
/* 便捷封装:烘焙并挂到 parent 上,返回单个 Mesh(静态建筑网格冻结 matrixAutoUpdate,省去每帧矩阵重算) */
function freezeStaticMesh(m){
  if(!m)return m;
  m.updateMatrix();
  m.matrixAutoUpdate=false;
  return m;
}
function bakeVoxelMesh(parent,parts,opts){
  const mesh=new THREE.Mesh(bakeVoxelGeometry(parts),bakedVoxelMaterial((opts&&opts.materialKey)||"basic",opts&&opts.material,!!(opts&&opts.standard)));
  freezeStaticMesh(mesh);
  if(parent)parent.add(mesh);
  return mesh;
}
/* ---------------- smooth organic human baking: 光滑低模人形几何烘焙 ----------------
   与建筑硬表面使用的 bakeVoxelGeometry 分离，专用于看台观众、场边球迷、记者、啦啦队等人体模型：
   使用光滑顶点法线的 sphere / dome / cyl 原语合并为单几何体，带自然轮廓收腰与皮肤/织物柔光调制。 */
const ORGANIC_PRIMS_HI={
  sphere:new THREE.SphereGeometry(0.5,12,10).toNonIndexed(),
  dome:new THREE.SphereGeometry(0.5,12,6,0,Math.PI*2,0,Math.PI*0.58).toNonIndexed(),
  cyl:new THREE.CylinderGeometry(0.5,0.5,1,12,1).toNonIndexed(),
  box:VOXEL_UNIT_BOX
};
const ORGANIC_PRIMS_LO={
  sphere:new THREE.SphereGeometry(0.5,8,6).toNonIndexed(),
  dome:new THREE.SphereGeometry(0.5,8,5,0,Math.PI*2,0,Math.PI*0.58).toNonIndexed(),
  cyl:new THREE.CylinderGeometry(0.5,0.5,1,8,1).toNonIndexed(),
  box:VOXEL_UNIT_BOX
};
function bakeOrganicGeometry(parts,lowPoly){
  const bank=lowPoly?ORGANIC_PRIMS_LO:ORGANIC_PRIMS_HI;
  let total=0;
  for(const part of parts)total+=(bank[part.shape||"sphere"]||bank.sphere).getAttribute("position").count;
  const pos=new Float32Array(total*3),norm=new Float32Array(total*3),col=new Float32Array(total*3);
  const m=new THREE.Matrix4(),nm=new THREE.Matrix3(),q=new THREE.Quaternion(),eul=new THREE.Euler();
  const sVec=new THREE.Vector3(),pVec=new THREE.Vector3();
  const v=new THREE.Vector3(),vn=new THREE.Vector3(),c=new THREE.Color();
  const partVertCounts=[];
  let off=0;
  for(const part of parts){
    const src=bank[part.shape||"sphere"]||bank.sphere;
    const srcPos=src.getAttribute("position"),srcNorm=src.getAttribute("normal"),per=srcPos.count;
    if(part.matrix)m.copy(part.matrix);
    else{
      const s=part.scale||[1,1,1],p=part.pos||[0,0,0],r=part.rot;
      if(r)q.setFromEuler(eul.set(r[0]||0,r[1]||0,r[2]||0));else q.identity();
      m.compose(pVec.set(p[0],p[1],p[2]),q,sVec.set(s[0],s[1],s[2]));
    }
    nm.getNormalMatrix(m);
    if(part.color&&part.color.isColor)c.copy(part.color);else c.set(part.color==null?0xffffff:part.color);
    const tx=part.taperX==null?1:part.taperX,tz=part.taperZ==null?1:part.taperZ,sh=part.shearZ||0;
    for(let i=0;i<per;i++){
      v.fromBufferAttribute(srcPos,i);
      const localY=v.y;
      if(tx!==1||tz!==1||sh!==0){
        const u=localY+0.5;
        v.x*=1+(tx-1)*u;
        v.z=v.z*(1+(tz-1)*u)+sh*u;
      }
      v.applyMatrix4(m);
      vn.fromBufferAttribute(srcNorm,i).applyMatrix3(nm).normalize();
      const shade=part.noShade?1.0:(0.93+0.075*(vn.x*0.22+vn.y*0.72+vn.z*0.42)+0.035*localY);
      const o=(off+i)*3;
      pos[o]=v.x;pos[o+1]=v.y;pos[o+2]=v.z;
      norm[o]=vn.x;norm[o+1]=vn.y;norm[o+2]=vn.z;
      col[o]=Math.min(1,c.r*shade);
      col[o+1]=Math.min(1,c.g*shade);
      col[o+2]=Math.min(1,c.b*shade);
    }
    off+=per;
    partVertCounts.push(off);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("normal",new THREE.BufferAttribute(norm,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  geo.userData.partVertCounts=partVertCounts;
  geo.computeBoundingSphere();
  return geo;
}
function bakeOrganicMesh(parent,parts,opts){
  const geo=bakeOrganicGeometry(parts,!!(opts&&opts.lowPoly));
  const mat=bakedVoxelMaterial((opts&&opts.materialKey)||"organic",opts&&opts.material,!!(opts&&opts.standard));
  const mesh=new THREE.Mesh(geo,mat);
  if(parent)parent.add(mesh);
  return mesh;
}
const ORGANIC_LIMB_CACHE=new Map();
function makeOrganicLimbGeo(radius,length,sleeveRatio,sleeveCol,skinCol){
  const sr=sleeveRatio||0;
  const parts=[];
  if(sr>0.02){
    const slLen=length*sr,skinLen=length*(1-sr);
    parts.push({shape:"sphere",color:sleeveCol==null?0xffffff:sleeveCol,pos:[0,0,0],scale:[radius*1.08,radius*1.08,radius*1.08]});
    parts.push({shape:"cyl",color:sleeveCol==null?0xffffff:sleeveCol,pos:[0,-slLen*0.5,0],scale:[radius*0.92,slLen,radius*0.92],taperX:1.10,taperZ:1.10});
    parts.push({shape:"cyl",color:skinCol==null?0xffffff:skinCol,pos:[0,-slLen-skinLen*0.5,0],scale:[radius*0.72,skinLen,radius*0.72],taperX:1.25,taperZ:1.25});
    parts.push({shape:"sphere",color:skinCol==null?0xffffff:skinCol,pos:[0,-length,0],scale:[radius*0.78,radius*0.86,radius*0.78]});
  }else{
    parts.push({shape:"sphere",color:0xffffff,pos:[0,0,0],scale:[radius*1.05,radius*1.05,radius*1.05]});
    parts.push({shape:"cyl",color:0xffffff,pos:[0,-length*0.5,0],scale:[radius*0.78,length,radius*0.78],taperX:1.28,taperZ:1.28});
    parts.push({shape:"sphere",color:0xf6eee8,pos:[0,-length,0],scale:[radius*0.78,radius*0.88,radius*0.78]});
  }
  return bakeOrganicGeometry(parts,false);
}
function makeOrganicLimbMesh(parent,mat,x,y,z,radius,length,opts){
  const sr=(opts&&opts.sleeveRatio)||0;
  const sc=opts&&opts.sleeveColor!=null?opts.sleeveColor:0xffffff;
  const kc=opts&&opts.skinColor!=null?opts.skinColor:0xffffff;
  const key=`${radius.toFixed(3)}:${length.toFixed(3)}:${sr.toFixed(2)}:${sc}:${kc}`;
  let geo=ORGANIC_LIMB_CACHE.get(key);
  if(!geo){geo=makeOrganicLimbGeo(radius,length,sr,sc,kc);ORGANIC_LIMB_CACHE.set(key,geo);}
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,y,z);
  if(parent)parent.add(mesh);
  return mesh;
}
function makeAdBoard(txt,bg,fg,x,z,rot,w=2.7){
  /* 独立场边广告牌：正面单向发光面 + 立体深色金属机箱与顶部缓冲条，彻底解决背面反字穿帮 */
  const g=new THREE.Group();
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(w,0.68),
    new THREE.MeshBasicMaterial({map:bannerTex(txt,bg,fg),side:THREE.FrontSide,color:0x9aa3b2}));
  scr.position.set(0,0,0.095);g.add(scr);
  bakeVoxelMesh(g,[
    {color:0x151a24,pos:[0,0,0],scale:[w+0.08,0.72,0.18]},
    {color:0x1f2e4a,pos:[0,0.38,0],scale:[w+0.10,0.07,0.22],taperZ:0.82},
    {color:0x0f131b,pos:[-w*0.38,-0.22,-0.12],scale:[0.10,0.52,0.22],taperZ:0.4},
    {color:0x0f131b,pos:[w*0.38,-0.22,-0.12],scale:[0.10,0.52,0.22],taperZ:0.4}
  ],{materialKey:"ledCabinets",standard:true,material:{roughness:0.38,metalness:0.36,envMapIntensity:0.48}});
  g.position.set(x,0.60,z);g.rotation.y=rot;indoorRoot.add(g);
  return g;
}
function makeCheerleader(x,z,jersey,pom){
  const g=new THREE.Group();
  const skin=new THREE.MeshLambertMaterial({color:0xf4c89c});
  const pomMat=new THREE.MeshLambertMaterial({color:pom,emissive:pom,emissiveIntensity:.18});
  bakeOrganicMesh(g,[
    {shape:"cyl",color:jersey,pos:[0,0.92,0],scale:[0.23,0.40,0.17],taperX:1.28,taperZ:1.18},
    {shape:"sphere",color:jersey,pos:[0,1.02,0],scale:[0.30,0.20,0.21]},
    {shape:"cyl",color:0xffffff,pos:[0,0.62,0],scale:[0.42,0.22,0.30],taperX:0.64,taperZ:0.64},
    {shape:"cyl",color:0xf4c89c,pos:[0,1.18,0],scale:[0.095,0.10,0.095]},
    {shape:"sphere",color:0xf4c89c,pos:[0,1.34,0],scale:[0.21,0.25,0.22],taperX:1.06,taperZ:1.04},
    {shape:"dome",color:0x2b1710,pos:[0,1.37,-0.01],scale:[0.225,0.21,0.235]},
    {shape:"sphere",color:0x2b1710,pos:[0,1.34,0.14],scale:[0.11,0.24,0.10]},
    {shape:"cyl",color:0xf4c89c,pos:[-0.095,0.33,0],scale:[0.092,0.46,0.095],taperX:1.30,taperZ:1.25},
    {shape:"cyl",color:0xf4c89c,pos:[0.095,0.33,0],scale:[0.092,0.46,0.095],taperX:1.30,taperZ:1.25},
    {shape:"dome",color:0xffffff,pos:[-0.095,0.02,-0.025],scale:[0.125,0.10,0.21]},
    {shape:"dome",color:0xffffff,pos:[0.095,0.02,-0.025],scale:[0.125,0.10,0.21]}
  ]);
  const leftArm=makeOrganicLimbMesh(g,skin,-0.19,1.09,0,0.078,0.39);
  const rightArm=makeOrganicLimbMesh(g,skin,0.19,1.09,0,0.078,0.39);
  const pomGeo=new THREE.SphereGeometry(0.125,10,8);
  const leftPom=new THREE.Mesh(pomGeo,pomMat);leftPom.position.set(-0.36,1.24,0);g.add(leftPom);
  const rightPom=new THREE.Mesh(pomGeo,pomMat);rightPom.position.set(0.36,1.24,0);g.add(rightPom);
  g.position.set(x,0,z);
  g.rotation.y=x<0?0.35:-0.35;
  indoorRoot.add(g);
  showCrew.push({type:"cheer",g,arms:[leftArm,rightArm],poms:[leftPom,rightPom],phase:Math.random()*7});
}
function makeMascot(x,z){
  const g=new THREE.Group();
  const orangeMat=new THREE.MeshLambertMaterial({color:0xf28b22});
  bakeOrganicMesh(g,[
    {shape:"sphere",color:0xf28b22,pos:[0,0.82,0],scale:[0.56,0.84,0.46]},
    {shape:"sphere",color:0xffd2a1,pos:[0,0.80,-0.16],scale:[0.38,0.56,0.22]},
    {shape:"sphere",color:0xf28b22,pos:[0,1.52,0],scale:[0.60,0.56,0.54]},
    {shape:"sphere",color:0xffd2a1,pos:[0,1.43,-0.24],scale:[0.38,0.24,0.20]},
    {shape:"sphere",color:0x1e1210,pos:[0,1.49,-0.33],scale:[0.10,0.07,0.06]},
    {shape:"sphere",color:0x1e1210,pos:[-0.16,1.60,-0.24],scale:[0.075,0.085,0.05]},
    {shape:"sphere",color:0x1e1210,pos:[0.16,1.60,-0.24],scale:[0.075,0.085,0.05]},
    {shape:"sphere",color:0xf28b22,pos:[-0.25,1.82,0],scale:[0.17,0.18,0.11],rot:[0,0,0.42]},
    {shape:"sphere",color:0xf28b22,pos:[0.25,1.82,0],scale:[0.17,0.18,0.11],rot:[0,0,-0.42]},
    {shape:"cyl",color:0x1e1210,pos:[-0.17,0.20,0],scale:[0.16,0.40,0.16],taperX:1.12,taperZ:1.12},
    {shape:"cyl",color:0x1e1210,pos:[0.17,0.20,0],scale:[0.16,0.40,0.16],taperX:1.12,taperZ:1.12},
    {shape:"dome",color:0xf28b22,pos:[-0.17,0.01,-0.04],scale:[0.20,0.13,0.28]},
    {shape:"dome",color:0xf28b22,pos:[0.17,0.01,-0.04],scale:[0.20,0.13,0.28]}
  ]);
  const armL=makeOrganicLimbMesh(g,orangeMat,-0.33,1.12,0,0.14,0.56);
  const armR=makeOrganicLimbMesh(g,orangeMat,0.33,1.12,0,0.14,0.56);
  g.position.set(x,0,z);g.rotation.y=-0.55;indoorRoot.add(g);
  showCrew.push({type:"mascot",g,arms:[armL,armR],phase:Math.random()*7});
}
function buildBackcourtShow(){
  makeAdBoard("N1KE AIR","#11131a","#f7f7f7",-11.55,COURT.midZ+5.2,Math.PI/2,2.8);
  makeAdBoard("ADI-DASH","#f7f7f7","#11131a",-11.55,COURT.midZ+9.0,Math.PI/2,2.8);
  makeAdBoard("PIXEL SPORT","#1c1032","#fdb927",11.55,COURT.midZ+5.2,-Math.PI/2,2.8);
  makeAdBoard("SHOWTIME","#2a1245","#fdb927",11.55,COURT.midZ+9.0,-Math.PI/2,2.8);
  makeAdBoard("MINE-DEW","#0c3a14","#9dff8d",-5.2,COURT.farBaseline+2.2,Math.PI,3.2);
  makeAdBoard("COURT CAM","#1c1230","#7ee7ff",0,COURT.farBaseline+2.2,Math.PI,3.2);
  makeAdBoard("3PT KING","#38124a","#fdb927",5.2,COURT.farBaseline+2.2,Math.PI,3.2);
  const cheerPos=[[-6.2,COURT.midZ+6.6],[-5.0,COURT.midZ+8.0],[-3.8,COURT.midZ+6.8],[3.8,COURT.midZ+6.8],[5.0,COURT.midZ+8.0],[6.2,COURT.midZ+6.6]];
  cheerPos.forEach((p,i)=>makeCheerleader(p[0],p[1],i%2?0xfdb927:0x4a2178,i%2?0xfdb927:0xb388ff));
  makeMascot(6.8,COURT.midZ+8.6);
}
function updBackcourtShow(t){
  if(!indoorRoot.visible)return;
  updJumbotronBroadcast(t);
  showCrew.forEach((c,i)=>{
    const s=Math.sin(t*5+c.phase), c2=Math.cos(t*4.2+c.phase);
    if(c.type==="mascot"){
      c.g.position.y=Math.max(0,s)*0.08;
      c.g.rotation.y=-0.55+Math.sin(t*2+c.phase)*0.08;
      c.arms[0].rotation.z=-0.85-Math.sin(t*4+c.phase)*0.40;
      c.arms[1].rotation.z=1.75+Math.sin(t*5+c.phase)*0.50;
    }else{
      c.g.position.y=Math.max(0,s)*0.05;
      c.g.rotation.y+=(c2*0.0015);
      c.arms[0].rotation.z=-2.25+s*0.42;
      c.arms[1].rotation.z=2.25-s*0.42;
      c.poms[0].position.set(-0.19+0.39*Math.sin(c.arms[0].rotation.z),1.09-0.39*Math.cos(c.arms[0].rotation.z),0);
      c.poms[1].position.set(0.19+0.39*Math.sin(c.arms[1].rotation.z),1.09-0.39*Math.cos(c.arms[1].rotation.z),0);
    }
  });
}
/* Crowd: 对照洛杉矶湖人主场实拍照片打造的次世代真实球迷系统：
   1. 真实球衣/便装配色比例（35% 标志性湖人金、26% 皇家紫、18% 星期日主场白、14% 街头黑卫衣、7% 牛仔/灰/客队）
   2. 真实人类看台行为生态（专注看球、侧身与邻座热聊交谈、有节奏击掌鼓掌、举手机录像、休闲抱臂、喝饮品）
   3. 消除进球后集体瞬间静止：平滑余温衰减与多相渐变过渡（兴奋余温持续2.5~5秒，交替鼓掌喝彩，自然回归日常坐姿）
   4. 体态尺寸各异（0.88~1.12 比例身材差异）与棒球帽/卫衣/无袖球衣多重造型。 */
const crowd={groups:[],dummy:new THREE.Object3D(),clock:0,teamKey:"",event:0,teamPanels:[],flashes:null,flashData:[]};
function crowdTeams(){
  const home=G.myStar?.col||[0xf0b72c,0x263f85],away=G.battleOpp?.col||G.opponents?.[0]?.col||[0xc24446,0xe6dbce];
  return [home[0],away[0]===home[0]?away[1]:away[0]];
}

// 湖人主场真实球衣与观众便服光谱（对照 NBA 2K Crypto.com Arena 实拍分布）
const LAKERS_GOLDS=[0xf2ae29,0xf8bb34,0xe09b20,0xf5b42c,0xe8a425];
const LAKERS_PURPLES=[0x58278a,0x4b2078,0x642e9c,0x3f1966,0x522380];
const CROWD_WHITES=[0xeef1f7,0xe0e5ef,0xf4f6fb,0xd4dbe8];
const CROWD_BLACKS=[0x141722,0x1c202e,0x232838,0x181b26];
const CROWD_CASUAL=[0x38465c,0x4e5b70,0x5c4033,0x6e2b32,0x2e4a44];
const SKIN_TONES=[0xf6cdab,0xedb48a,0xda9d6e,0xb87848,0x824b22,0x4e2c16];
const CAP_COLORS=[0xf2ae29,0x58278a,0xeef1f7,0x1a1d28];

function pickLakersFanColor(seed,teamColors){
  const roll=seed%100;
  if(roll<22)return LAKERS_GOLDS[seed%LAKERS_GOLDS.length];
  if(roll<42)return LAKERS_PURPLES[seed%LAKERS_PURPLES.length];
  if(roll<64)return CROWD_WHITES[seed%CROWD_WHITES.length];
  if(roll<88)return CROWD_BLACKS[seed%CROWD_BLACKS.length];
  return CROWD_CASUAL[seed%CROWD_CASUAL.length];
}

function syncCrowdTeams(){
  const colors=crowdTeams(),key=colors.join(":");if(crowd.teamKey===key)return;
  crowd.teamKey=key;
  crowd.teamPanels.forEach(p=>p.mesh.material.color.setHex(colors[p.team]).convertSRGBToLinear());
  const warmCol=new THREE.Color(0xffe4b5);
  for(const group of crowd.groups){
    const tier=group.tier||0;
    group.seats.forEach((s,i)=>{
      const zl=s.zoneLight??(tier===0?0.88:(tier===1?0.58:0.18));
      const dark=Math.max(0.04,Math.min(0.80,Math.pow(1.0-zl,1.22)*0.84));
      const desat=Math.max(0.04,Math.min(0.42,(1.0-zl)*0.36));
      const warmBoost=Math.max(0,(zl-0.55)*0.18);
      const cShirt=recede(s.shirtColor,desat,dark);
      if(warmBoost>0)cShirt.lerp(warmCol,warmBoost);
      cShirt.convertSRGBToLinear();
      const cHead=recede(s.skinColor,desat*0.75,dark*0.88).convertSRGBToLinear();
      const cArm=recede(s.isJersey?s.skinColor:s.shirtColor,desat*0.80,dark*0.90).convertSRGBToLinear();
      group.body.setColorAt(i,cShirt);
      group.head.setColorAt(i,cHead);
      group.arms.setColorAt(i*2,cArm);
      group.arms.setColorAt(i*2+1,cArm);
    });
    if(group.body.instanceColor)group.body.instanceColor.needsUpdate=true;
    if(group.head.instanceColor)group.head.instanceColor.needsUpdate=true;
    if(group.arms.instanceColor)group.arms.instanceColor.needsUpdate=true;
  }
}

function triggerArenaCrowdReaction(kind,points){
  if(!indoorRoot.visible)return;
  crowd.event++;const opponent=kind==="oppMake"||kind==="oppMiss",miss=kind==="miss"||kind==="oppMiss",winner=opponent?1:0;
  for(const group of crowd.groups)for(const s of group.seats){
    const fraction=(Math.sin(s.ph*91.7+crowd.event*12.3)*43758.5453)%1,u=Math.abs(fraction);
    const supports=s.team===winner,neutral=s.team<0;
    s.responseSign=neutral?(miss?-.15:.35):(supports?(miss?-.65:1):(miss?.4:-.4));
    // 错落触发：让 18000 名观众形成波浪式递进欢呼，绝非千人一面的机器人同步
    s.responseStart=crowd.clock+0.04+u*0.55;
    s.responseDuration=1.7+u*1.5;            // 爆发式欢呼峰值时长
    s.responseLinger=2.5+u*2.8;              // 进球后平滑余温（持续2.5~5.3秒），彻底消除突然静止
    s.responsePower=((points||0)>=5?1:.80)*(.55+s.amp*.45)*(neutral?.45:1);
  }
}

function recede(hex,desat,dark){
  const c=new THREE.Color(hex),l=c.r*.299+c.g*.587+c.b*.114;
  c.lerp(new THREE.Color(l,l,l),desat);
  return c.lerp(new THREE.Color(0x0b0d17),dark);
}

const CROWD_BODY=[0x12151e,0x191d28,0x1c172c,0x222734,0x241d2e,0x161c28];
const CROWD_HEAD=[0xd8ad82,0xc49060,0x7d4b22];

// 无袖球衣/短袖 T 恤体态几何体（Lathe 光滑解剖学轮廓：臀-腰-胸-斜肩-领口 + 坐姿大腿）
function bakeLatheCrowdGeo(rings,segments,scaleZ,extraParts){
  const pts=rings.map(r=>new THREE.Vector2(Math.max(0.0005,r[0]),r[1]));
  let lathe=new THREE.LatheGeometry(pts,segments);
  lathe.scale(1,1,scaleZ==null?1:scaleZ);
  lathe.computeVertexNormals();
  lathe=lathe.toNonIndexed();
  const lPos=lathe.getAttribute("position"),lNorm=lathe.getAttribute("normal"),lCount=lPos.count;
  const colArr=new Float32Array(lCount*3),c=new THREE.Color();
  const pickCol=y=>{
    for(let k=rings.length-1;k>=0;k--){
      if(y>=rings[k][1]-1e-4)return rings[k][2];
    }
    return rings[0][2];
  };
  for(let i=0;i<lCount;i++){
    const vy=lPos.getY(i),nx=lNorm.getX(i),ny=lNorm.getY(i),nz=lNorm.getZ(i);
    c.setHex(pickCol(vy));
    const shade=0.93+0.075*(nx*0.22+ny*0.72+nz*0.42);
    colArr[i*3]=Math.min(1,c.r*shade);
    colArr[i*3+1]=Math.min(1,c.g*shade);
    colArr[i*3+2]=Math.min(1,c.b*shade);
  }
  if(!extraParts||!extraParts.length){
    lathe.setAttribute("color",new THREE.BufferAttribute(colArr,3));
    return lathe;
  }
  const exGeo=bakeOrganicGeometry(extraParts,true);
  const ePos=exGeo.getAttribute("position"),eNorm=exGeo.getAttribute("normal"),eCol=exGeo.getAttribute("color"),eCount=ePos.count;
  const tot=lCount+eCount;
  const pos=new Float32Array(tot*3),norm=new Float32Array(tot*3),col=new Float32Array(tot*3);
  pos.set(lPos.array,0);pos.set(ePos.array,lCount*3);
  norm.set(lNorm.array,0);norm.set(eNorm.array,lCount*3);
  col.set(colArr,0);col.set(eCol.array,lCount*3);
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(norm,3));
  out.setAttribute("color",new THREE.BufferAttribute(col,3));
  out.computeBoundingSphere();
  return out;
}
function makeJerseyBodyGeo(){
  return bakeLatheCrowdGeo([
    [0.001,-0.17,0x343a48],
    [0.19,-0.15,0x343a48],
    [0.17,-0.02,0xffffff],
    [0.215,0.20,0xffffff],
    [0.088,0.30,0x484f60],
    [0.001,0.31,0x484f60]
  ],5,0.66,[
    {shape:"cyl",color:0x343a48,pos:[-0.105,-0.13,0.11],scale:[0.13,0.24,0.13],rot:[1.30,0,0],taperX:0.86,taperZ:0.86},
    {shape:"cyl",color:0x343a48,pos:[0.105,-0.13,0.11],scale:[0.13,0.24,0.13],rot:[1.30,0,0],taperX:0.86,taperZ:0.86}
  ]);
}
// 连帽卫衣/休闲夹克体态几何体（略宽圆润肩线与连帽兜）
function makeHoodieBodyGeo(){
  return bakeLatheCrowdGeo([
    [0.001,-0.17,0x2e3442],
    [0.20,-0.15,0x2e3442],
    [0.195,-0.02,0xffffff],
    [0.235,0.20,0xd8dde8],
    [0.125,0.32,0xd8dde8],
    [0.001,0.33,0xd8dde8]
  ],5,0.70,[
    {shape:"cyl",color:0x2e3442,pos:[-0.105,-0.13,0.11],scale:[0.135,0.24,0.135],rot:[1.30,0,0],taperX:0.88,taperZ:0.88},
    {shape:"cyl",color:0x2e3442,pos:[0.105,-0.13,0.11],scale:[0.135,0.24,0.135],rot:[1.30,0,0],taperX:0.88,taperZ:0.88}
  ]);
}
// 自然发型光滑头部（含脖颈、下颌收窄、卵形颅骨与圆润发冠）
function makeFacetCrowdHeadGeo(){
  return bakeLatheCrowdGeo([
    [0.001,-0.16,0xffffff],
    [0.050,-0.12,0xffffff],
    [0.108,0.00,0xffffff],
    [0.112,0.06,0x221c18],
    [0.001,0.135,0x221c18]
  ],5,1.06);
}
// 佩戴鸭舌帽光滑头部
function makeCapCrowdHeadGeo(){
  return bakeLatheCrowdGeo([
    [0.001,-0.16,0xffffff],
    [0.050,-0.12,0xffffff],
    [0.108,0.00,0xffffff],
    [0.120,0.055,0x2b3040],
    [0.001,0.145,0x2b3040]
  ],5,1.06,[
    {shape:"cyl",color:0x222634,pos:[0,0.045,0.11],scale:[0.19,0.024,0.14],rot:[0.14,0,0],taperX:0.86,taperZ:0.86}
  ]);
}

function buildCrowd(seats){
  const jerseyGeo=makeJerseyBodyGeo();
  const hoodieGeo=makeHoodieBodyGeo();
  const headGeo=makeFacetCrowdHeadGeo();
  const capGeo=makeCapCrowdHeadGeo();
  const armGeo=bakeLatheCrowdGeo([
    [0.001,0.03,0xffffff],
    [0.052,-0.12,0xffffff],
    [0.035,-0.33,0xf5ede6],
    [0.001,-0.40,0xf5ede6]
  ],4,1.0);

  const NT=BOWL_TIERS.length,NC=CROWD_BODY.length;
  const buckets=[];for(let i=0;i<NT*NC;i++)buckets.push([]);

  seats.forEach((s,i)=>{
    const t=(s.t==null?1:s.t);
    s.team=i%9===0?-1:(s.x>0?i%6===0?0:1:i%6===0?1:0);
    s.responseStart=-100;s.responseDuration=0;s.responseLinger=0;s.responsePower=0;s.responseSign=0;

    // 独立身材尺寸与造型（0.88~1.12 比例高矮胖瘦差异）
    s.scaleX=0.88+((i*17)%8)*0.032;
    s.scaleY=0.90+((i*23)%7)*0.032;
    s.scaleZ=0.88+((i*31)%8)*0.032;
    s.isJersey=(i%3!==0);
    s.hasCap=(i%4===0);
    s.skinColor=SKIN_TONES[(i*11)%SKIN_TONES.length];
    s.shirtColor=pickLakersFanColor(i*13+t*7);
    s.capColor=CAP_COLORS[(i*5)%CAP_COLORS.length];

    // 6 大真实看台人类行为角色分配
    // 0: 专注看球 (25%)  1: 邻座热聊交谈 (20%)  2: 有节奏鼓掌 (18%)
    // 3: 举手机拍摄 (15%) 4: 抱胸休闲坐姿 (14%) 5: 喝饮品润喉 (8%)
    const rMod=(i*7)%100;
    s.role=rMod<25?0:(rMod<45?1:(rMod<63?2:(rMod<78?3:(rMod<92?4:5))));
    s.talkDir=(i%2===0?1:-1);

    buckets[t*NC+((Math.random()*NC)|0)].push(s);
  });

  buckets.forEach((arr,idx)=>{
    if(!arr.length)return;
    const t=Math.floor(idx/NC);
    const useHoodie=(idx%2===1);
    const useCap=(idx%3===0);
    const bGeo=useHoodie?hoodieGeo:jerseyGeo;
    const hGeo=useCap?capGeo:headGeo;

    const body=new THREE.InstancedMesh(bGeo,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),arr.length);
    const head=new THREE.InstancedMesh(hGeo,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),arr.length);
    const arms=new THREE.InstancedMesh(armGeo,new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),arr.length*2);

    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.frustumCulled=head.frustumCulled=arms.frustumCulled=false;

    indoorRoot.add(body);indoorRoot.add(head);indoorRoot.add(arms);
    crowd.groups.push({body,head,arms,seats:arr,tier:t});
  });

  crowd.teamKey="";syncCrowdTeams();

  for(const side of [-1,1])for(let j=0;j<4;j++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.4,.52,.08),new THREE.MeshLambertMaterial({color:crowdTeams()[side>0?1:0]}));
    mesh.material.color.convertSRGBToLinear();
    mesh.position.set(side*(5.2+j*2.65),8.35,COURT.midZ-34.1);mesh.name="teamSupporterBanner";indoorRoot.add(mesh);crowd.teamPanels.push({mesh,team:side>0?1:0});
  }

  // 暗调看台星光手机屏幕与相机闪光点阵
  const flashSeats=seats.filter((s,i)=>s.t>=1&&(i%19===0)).slice(0,150);
  if(flashSeats.length){
    const fGeo=new THREE.PlaneGeometry(0.22,0.22);
    const fMat=new THREE.MeshBasicMaterial({color:0xfff4d2,side:THREE.DoubleSide,transparent:true,opacity:0.88,blending:THREE.AdditiveBlending,depthWrite:false});
    const flashes=new THREE.InstancedMesh(fGeo,fMat,flashSeats.length);
    flashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flashes.frustumCulled=false;
    indoorRoot.add(flashes);
    crowd.flashes=flashes;
    crowd.flashData=flashSeats;
  }
  AIBACrowdLife.build();
}

let _crowdTick=0;
function updCrowd(t){
  if(!indoorRoot.visible)return;
  crowd.clock=t;syncCrowdTeams();
  AIBACrowdLife.update(t);
  _crowdTick++;
  const d=crowd.dummy;

  for(let gi=0;gi<crowd.groups.length;gi++){
    const g=crowd.groups[gi];
    const tier=(g.tier==null?1:g.tier);
    if(IS_COARSE_JUMBO){if((_crowdTick+gi)%3!==0)continue;}
    else if(tier>=2&&(_crowdTick%3)!==0)continue;

    for(let i=0;i<g.seats.length;i++){
      const s=g.seats[i];
      const age=t-s.responseStart;

      // 进球庆祝两阶段平滑包络：爆发欢呼 → 余温渐退（消除突然静止）
      let cheer=0,disappoint=0,linger=0;
      if(age>=0){
        if(age<s.responseDuration){
          // 阶段一：进球瞬间爆发起立欢呼
          const frac=age/s.responseDuration;
          const burst=Math.sin(Math.PI*frac);
          if(s.responseSign>0) cheer=burst*s.responsePower;
          else disappoint=burst*s.responsePower;
        }else if(age<s.responseDuration+s.responseLinger){
          // 阶段二：余温渐退期（持续平滑衰减，伴随持续鼓掌交谈缓缓落座）
          const lingerFrac=(age-s.responseDuration)/s.responseLinger;
          const decay=Math.cos(lingerFrac*Math.PI*0.5);
          linger=decay*s.responsePower;
          if(s.responseSign>0){
            cheer=decay*0.32*s.responsePower;
          }else{
            disappoint=decay*0.22*s.responsePower;
          }
        }
      }

      // 躯干跳跃与重心微动
      const jump=Math.max(0,Math.sin(t*(6.5+s.amp*2)+s.ph))*0.30*cheer;
      const breath=Math.sin(t*(0.9+s.amp*0.3)+s.ph)*0.016;
      const posY=s.y+jump+breath;

      // 根据 6 种正常看台行为计算基础姿态（常态下充满生命力，永不静止）
      let torsoPitch=0,torsoYaw=Math.sin(s.ph)*0.15,torsoRoll=0;
      let armL_x=0,armL_z=-0.12,armR_x=0,armR_z=0.12;
      let headYaw=0,headPitch=0;

      if(s.role===0){
        // 0: 专注看球（身体前倾 8°，头部微微随球场转动）
        torsoPitch=0.10+Math.sin(t*0.4+s.ph)*0.03;
        headYaw=Math.sin(t*0.5+s.ph)*0.16;
        armL_x=-0.35;armL_z=-0.15;armR_x=-0.35;armR_z=0.15;
      }else if(s.role===1){
        // 1: 邻座热聊（周期性侧身转向邻座交流并点头）
        const talkWave=Math.sin(t*0.35+s.ph);
        if(talkWave>0.1){
          const turnAmt=(talkWave-0.1)*s.talkDir*0.35;
          torsoYaw+=turnAmt;headYaw+=turnAmt*1.4;
          headPitch=Math.sin(t*3.0)*0.08;
          if(s.talkDir>0){armR_z=0.38+Math.sin(t*2.2)*0.12;armR_x=-0.25;}
          else{armL_z=-0.38-Math.sin(t*2.2)*0.12;armL_x=-0.25;}
        }
      }else if(s.role===2){
        // 2: 有节奏鼓掌（双臂胸前有节奏合拍击掌）
        const clapRate=4.2+s.amp*0.6;
        const clapWave=Math.sin(t*clapRate+s.ph);
        armL_x=-0.58;armR_x=-0.58;
        armL_z=-0.42+clapWave*0.14;armR_z=0.42-clapWave*0.14;
        headPitch=Math.max(0,clapWave)*0.04;
      }else if(s.role===3){
        // 3: 举手机录像（右手举起手机朝向球场拍摄）
        armR_x=-0.94+Math.sin(t*0.6+s.ph)*0.03;
        armR_z=-0.22;
        armL_x=-0.15;armL_z=-0.10;
        headPitch=-0.08;
      }else if(s.role===4){
        // 4: 抱胸休闲坐姿（双臂交叉在胸前，呼吸微晃）
        armL_x=-0.44;armL_z=-0.34;
        armR_x=-0.44;armR_z=0.34;
        torsoPitch=-0.06;
      }else{
        // 5: 喝饮品润喉（每隔数秒单手抬杯喝水）
        const sipCycle=(t*0.25+s.ph)%6;
        if(sipCycle<1.8){
          const sipProgress=Math.sin(sipCycle/1.8*Math.PI);
          armR_x=-1.10*sipProgress;armR_z=-0.16*sipProgress;
          headPitch=-0.15*sipProgress;
        }else{
          armR_x=-0.22;armR_z=0.15;armL_x=-0.22;armL_z=-0.15;
        }
      }

      // 叠加进球庆祝（或叹息）动态与余温
      if(cheer>0.02||linger>0.02){
        const activeCheer=Math.max(cheer,linger*0.55);
        // 双臂高举欢呼
        const cheerArmAngle=0.15+activeCheer*(1.75+0.18*Math.sin(t*8+s.ph));
        armL_z=-cheerArmAngle;armR_z=cheerArmAngle;
        armL_x=-activeCheer*0.35;armR_x=-activeCheer*0.35;
        torsoPitch-=activeCheer*0.12;
        headPitch-=activeCheer*0.22;
        // 余温期如果还带有击掌兴奋，穿插激动拍手
        if(linger>0.15){
          const clapW=Math.sin(t*5.5+s.ph);
          armL_z=Math.min(armL_z,-0.35+clapW*0.15);
          armR_z=Math.max(armR_z,0.35-clapW*0.15);
        }
      }else if(disappoint>0.02){
        // 遗憾抱头/叹息垂肩
        torsoPitch+=disappoint*0.22;
        headPitch+=disappoint*0.32;
        armL_x=-disappoint*0.75;armR_x=-disappoint*0.75;
        armL_z=-0.38-disappoint*0.25;armR_z=0.38+disappoint*0.25;
      }

      // 设置身体、头部与手臂矩阵（应用个人尺寸比例）
      const sx=s.scaleX,sy=s.scaleY,sz=s.scaleZ;

      // 1. 身体
      d.position.set(s.x,posY,s.z);
      d.rotation.set(torsoPitch,torsoYaw,torsoRoll);
      d.scale.set(sx,sy,sz);
      d.updateMatrix();
      g.body.setMatrixAt(i,d.matrix);

      // 2. 头部
      d.position.set(s.x,posY+0.52*sy,s.z);
      d.rotation.set(torsoPitch+headPitch,torsoYaw+headYaw,torsoRoll);
      d.scale.set(sx,sy,sz);
      d.updateMatrix();
      g.head.setMatrixAt(i,d.matrix);

      // 3. 手臂
      d.scale.set(sx,sy,sz);
      // 左臂
      d.position.set(s.x-0.26*sx,posY+0.25*sy,s.z);
      d.rotation.set(armL_x,torsoYaw,armL_z);
      d.updateMatrix();
      g.arms.setMatrixAt(i*2,d.matrix);
      // 右臂
      d.position.set(s.x+0.26*sx,posY+0.25*sy,s.z);
      d.rotation.set(armR_x,torsoYaw,armR_z);
      d.updateMatrix();
      g.arms.setMatrixAt(i*2+1,d.matrix);
    }

    g.body.instanceMatrix.needsUpdate=true;
    g.head.instanceMatrix.needsUpdate=true;
    g.arms.instanceMatrix.needsUpdate=true;
  }

  // 暗调看台手机星光微闪
  if(crowd.flashes&&(_crowdTick%2===0)){
    const fd=crowd.flashData;
    for(let i=0;i<fd.length;i++){
      const s=fd[i];
      const pulse=Math.sin(t*(3.2+(i%5)*1.1)+s.ph*13.7);
      const burst=pulse>0.92?1.8:(pulse>0.45?0.65:0.18);
      d.position.set(s.x,s.y+0.56,s.z);
      d.rotation.set(0,Math.atan2(-s.x,COURT.midZ-s.z),t*0.8+i);
      d.scale.setScalar(burst);
      d.updateMatrix();
      crowd.flashes.setMatrixAt(i,d.matrix);
    }
    d.scale.setScalar(1);
    crowd.flashes.instanceMatrix.needsUpdate=true;
  }
  updUpperRibbon(t);
}

window.AIBA.runtime.register("rendering:arena",Object.freeze({
  bannerTex,buildStands,showBox,makeAdBoard,buildBackcourtShow,updBackcourtShow,buildCrowd,updCrowd,
  buildLightShafts,buildFloorLightPools,recede,updateCenterScoreboard
}));
