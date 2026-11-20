/* hoop & net */
let netMesh,farNet,hoopRimMat=null,netPulse=0,netPulseAge=99,netPulseDir=0,lastNetPulse=0;
const courtHoopRigs=[];
function setHoopRimTheme(venue){
  if(!hoopRimMat)return;
  if(venue==="lunarCrater"){
    hoopRimMat.color.setHex(0xc8ccd4);
    if(hoopRimMat.isMeshStandardMaterial){
      const lEnv=window.AIBALunarMetal?window.AIBALunarMetal.makeEnvPMREM():null;
      hoopRimMat.roughness=0.22;hoopRimMat.metalness=0.88;
      if(lEnv){hoopRimMat.envMap=lEnv;hoopRimMat.envMapIntensity=1.18;}
    }
    if(netMesh?.material?.color)netMesh.material.color.setHex(0xd8dce4);
    if(farNet?.material?.color)farNet.material.color.setHex(0xd8dce4);
  }else{
    hoopRimMat.color.setHex(0xe04819);
    if(hoopRimMat.isMeshStandardMaterial){
      const env=typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
      hoopRimMat.roughness=0.30;hoopRimMat.metalness=0.26;
      hoopRimMat.envMap=env;hoopRimMat.envMapIntensity=env?0.55:0;
    }
    if(netMesh?.material?.color)netMesh.material.color.setHex(0xecece6);
    if(farNet?.material?.color)farNet.material.color.setHex(0xecece6);
  }
  hoopRimMat.needsUpdate=true;
}
function setPlaceHoops(active,replaceBoard=false){
  if(!active)setHoopRimTheme("indoor");
  const setVisible=child=>{
    if(child.userData.keepOutdoor)return;
    if(active){if(child.userData.indoorVisibility===undefined)child.userData.indoorVisibility=child.visible;child.visible=false;}
    else if(child.userData.indoorVisibility!==undefined){child.visible=child.userData.indoorVisibility;delete child.userData.indoorVisibility;}
  };
  courtHoopRigs.forEach(rig=>{
    rig.children.forEach(setVisible);
    if(!active||replaceBoard)rig.getObjectByName("boardPivot")?.children.forEach(setVisible);
  });
}
const NET_HEIGHT=.45;
const netEase=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function prepareNet(mesh){
  if(!mesh||!mesh.geometry||!mesh.geometry.attributes||!mesh.geometry.attributes.position)return;
  const attr=mesh.geometry.attributes.position;
  mesh.userData.aibaNetBase=new Float32Array(attr.array);
  mesh.userData.aibaNetHeight=NET_HEIGHT;
}
/* 网不是一块整体缩放的方柱：进球时上沿先收紧，下面的网条向下/向侧面拖，
   随后反弹一次再回到原位。保留线框体素风，但让球穿网这一刻有真实的软体响应。 */
function deformNet(mesh,level,age,dir){
  if(!mesh||!mesh.geometry||!mesh.geometry.attributes||!mesh.geometry.attributes.position)return;
  const attr=mesh.geometry.attributes.position,base=mesh.userData&&mesh.userData.aibaNetBase;
  if(!base||base.length!==attr.array.length)return;
  const attack=netEase(Math.min(1,age/.065));
  const rebound=netEase(Math.max(0,Math.min(1,(age-.09)/.24)));
  const wave=Math.max(0,level)*(age<.09?attack:(.76*(1-rebound)+.18*rebound));
  for(let i=0;i<attr.count;i++){
    const bi=i*3,x=base[bi],y=base[bi+1],z=base[bi+2];
    const lower=Math.max(0,Math.min(1,(.225-y)/NET_HEIGHT));
    const radius=Math.hypot(x,z)||.001;
    const radialX=x/radius,radialZ=z/radius;
    const sag=wave*(.095*lower*lower+.018*lower);
    const side=wave*(Number(dir)||0)*.065*lower;
    attr.setXYZ(i,x+radialX*sag*.38+side,y-sag,z+radialZ*sag*.38-side*.32);
  }
  attr.needsUpdate=true;
  mesh.geometry.computeBoundingSphere();
}
function hoopDynamicsOn(){
  return !!(window.AIBAHoopDynamics&&window.AIBAModelDetail&&AIBAModelDetail.enabled);
}
function pulseNet(value,dir){
  const amount=Math.max(0,Math.min(1.4,Number(value)||0));
  /* 绳网：由球真实推动；这里只给过场/回放/旧系统一个兜底的"甩一下" */
  if(hoopDynamicsOn()&&netMesh&&netMesh.name==="clothNet"){
    if(amount>0)AIBAHoopDynamics.kick(amount,dir);else AIBAHoopDynamics.reset();
    return;
  }
  if(amount<=0){netPulse=0;netPulseAge=99;netPulseDir=0;return;}
  netPulse=Math.max(netPulse,amount);netPulseAge=0;
  if(Number.isFinite(Number(dir)))netPulseDir=Math.max(-1,Math.min(1,Number(dir)));
}
function updateNetPulse(dt){
  const safeDt=Math.max(0,Math.min(.08,Number(dt)||0));
  if(netMesh&&netMesh.name==="clothNet"){
    // 近端：篮筐/篮板弹簧 + 绳网；远端装饰网保持静止（它从来不进球，旧版却跟着近端一起抖）
    AIBAHoopDynamics.update(safeDt);
    return;
  }
  if(netPulse>0){
    if(netPulse>lastNetPulse+.05)netPulseAge=0; /* 兼容仍直接写 netPulse=1 的旧过场调用 */
    netPulseAge+=safeDt;netPulse=Math.max(0,netPulse-safeDt*2.35);
  }else netPulseAge=99;
  deformNet(netMesh,netPulse,netPulseAge,netPulseDir);
  deformNet(farNet,netPulse*.72,netPulseAge,netPulseDir);
  if(netMesh){
    const s=1+netPulse*.04;
    netMesh.scale.set(s,1+netPulse*.06,s);
  }
  if(farNet){
    const s=1+netPulse*.028;
    farNet.scale.set(s,1+netPulse*.04,s);
  }
  lastNetPulse=netPulse;
}
function drawNbaLogoman(g,x,y,w,h){
  const r=Math.max(3,w*0.18);
  g.save();
  // 白色圆角外框
  g.fillStyle="#ffffff";
  g.beginPath();
  g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();g.fill();
  const pad=Math.max(1.5,w*0.06),ix=x+pad,iy=y+pad,iw=w-pad*2,ih=h-pad*2,ir=Math.max(2,r-pad);
  g.beginPath();
  g.moveTo(ix+ir,iy);g.lineTo(ix+iw-ir,iy);g.quadraticCurveTo(ix+iw,iy,ix+iw,iy+ir);
  g.lineTo(ix+iw,iy+ih-ir);g.quadraticCurveTo(ix+iw,iy+ih,ix+iw-ir,iy+ih);
  g.lineTo(ix+ir,iy+ih);g.quadraticCurveTo(ix,iy+ih,ix,iy+ih-ir);
  g.lineTo(ix,iy+ir);g.quadraticCurveTo(ix,iy,ix+ir,iy);g.closePath();g.clip();
  // 左蓝右红底色
  g.fillStyle="#1d428a";g.fillRect(ix,iy,iw*0.54,ih);
  g.fillStyle="#c8102e";g.fillRect(ix+iw*0.54,iy,iw*0.46,ih);
  // 白色运球剪影 (Logoman silhouette)
  g.fillStyle="#ffffff";
  g.beginPath();g.arc(ix+iw*0.56,iy+ih*0.18,iw*0.095,0,Math.PI*2);g.fill();
  g.beginPath();
  g.moveTo(ix+iw*0.44,iy+ih*0.26);
  g.lineTo(ix+iw*0.68,iy+ih*0.28);
  g.lineTo(ix+iw*0.80,iy+ih*0.46);
  g.lineTo(ix+iw*0.64,iy+ih*0.52);
  g.lineTo(ix+iw*0.74,iy+ih*0.88);
  g.lineTo(ix+iw*0.61,iy+ih*0.92);
  g.lineTo(ix+iw*0.49,iy+ih*0.58);
  g.lineTo(ix+iw*0.34,iy+ih*0.84);
  g.lineTo(ix+iw*0.22,iy+ih*0.79);
  g.lineTo(ix+iw*0.36,iy+ih*0.48);
  g.lineTo(ix+iw*0.28,iy+ih*0.38);
  g.closePath();g.fill();
  g.beginPath();g.arc(ix+iw*0.77,iy+ih*0.53,iw*0.105,0,Math.PI*2);g.fill();
  g.fillStyle="#ffffff";
  g.font=`900 ${Math.round(iw*0.28)}px Impact, Arial Black, sans-serif`;
  g.textAlign="left";g.textBaseline="bottom";
  g.fillText("NBA",ix+iw*0.08,iy+ih*0.96);
  g.restore();
}

function drawUsaFlagDecal(g,x,y,w,h){
  g.save();
  g.fillStyle="#ffffff";g.fillRect(x-2,y-2,w+4,h+4);
  const stripes=13,sh=h/stripes;
  for(let i=0;i<stripes;i++){
    g.fillStyle=(i%2===0)?"#c8102e":"#ffffff";
    g.fillRect(x,y+i*sh,w,sh+0.4);
  }
  const cw=w*0.44,ch=sh*7;
  g.fillStyle="#1d428a";g.fillRect(x,y,cw,ch);
  g.fillStyle="#ffffff";
  for(let r=0;r<4;r++){
    for(let c=0;c<5;c++){
      g.fillRect(x+cw*(0.12+c*0.19),y+ch*(0.14+r*0.23),1.8,1.8);
    }
  }
  g.restore();
}

function buildHoop(){
  const grp=new THREE.Group();
  const detailOn=!!(window.AIBAModelDetail&&AIBAModelDetail.enabled&&AIBAModelDetail.stdMat);
  const ARM_LEN=1.68;                                 // NBA 折叠悬臂水平跨度(立柱中心→篮板),形成约 34° 标志性斜伸大臂
  const BOARD_Z=-8.62;                                // 篮板 z:不可改动
  const BASE_Z=BOARD_Z-ARM_LEN;                       // 底座落在底线外缓冲区
  const polM=detailOn
    ?AIBAModelDetail.stdMat(0x181b22,0.38,0.48,0.52)
    :new THREE.MeshLambertMaterial({color:0x1b1e26});
  const padM=detailOn
    ?AIBAModelDetail.stdMat(0x12141a,0.52,0.08,0.32)
    :new THREE.MeshLambertMaterial({color:0x151820});

  if(!detailOn){
    // 经典模式兜底：同样采用低立柱 + 斜伸大臂轮廓
    const pole=new THREE.Mesh(new THREE.BoxGeometry(0.36,1.45,0.40),polM);
    pole.position.set(0,1.32,BASE_Z);grp.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.24,1.95),polM);
    arm.position.set(0,2.46,(BOARD_Z+BASE_Z)/2);arm.rotation.x=-0.56;grp.add(arm);
    const pad=new THREE.Mesh(new THREE.BoxGeometry(0.68,1.38,0.56),padM);
    pad.position.set(0,1.36,BASE_Z+0.18);grp.add(pad);
    const baseBox=new THREE.Mesh(new THREE.BoxGeometry(1.06,0.66,1.58),padM);
    baseBox.position.set(0,0.33,BASE_Z-0.12);grp.add(baseBox);
  }

  // backboard: 复刻 NBA 官方钢化玻璃篮板（银白窄边框 + 纯白投篮内框 + 顶部金属角码 + 左下 NBA 标 + 右下美国国旗）
  const bTex=pixTex(512,320,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.fillStyle="rgba(220,234,248,0.22)";g.fillRect(0,0,w,h);
    // 钢化玻璃细腻斜向光泽带
    g.fillStyle="rgba(255,255,255,0.14)";
    g.beginPath();g.moveTo(w*0.20,0);g.lineTo(w*0.36,0);g.lineTo(w*0.14,h);g.lineTo(0,h);g.closePath();g.fill();
    g.beginPath();g.moveTo(w*0.60,0);g.lineTo(w*0.70,0);g.lineTo(w*0.48,h);g.lineTo(w*0.38,h);g.closePath();g.fill();
    // 玻璃内左上、右上黑色 L 型金属加强角码
    g.fillStyle="#1e232c";
    g.fillRect(18,18,52,12);g.fillRect(18,18,12,44);
    g.beginPath();g.moveTo(30,30);g.lineTo(54,30);g.lineTo(30,50);g.closePath();g.fill();
    g.fillRect(w-70,18,52,12);g.fillRect(w-30,18,12,44);
    g.beginPath();g.moveTo(w-30,30);g.lineTo(w-54,30);g.lineTo(w-30,50);g.closePath();g.fill();
    // NBA 标准纯白外框线 + 纯白投篮靶框（无杂乱橙色内框）
    g.strokeStyle="#ffffff";g.lineWidth=12;g.strokeRect(12,12,w-24,h-24);
    g.strokeStyle="#ffffff";g.lineWidth=14;g.strokeRect(186,154,140,112);
    // 左下角 NBA Logoman 官方标志 & 右下角美国国旗贴标
    drawNbaLogoman(g,30,206,36,78);
    drawUsaFlagDecal(g,w-92,238,56,36);
  },{smooth:true,mipmaps:true});
  const env=typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
  const boardMat=new THREE.MeshPhysicalMaterial({map:bTex,transparent:true,opacity:0.94,
    roughness:0.05,metalness:0.0,clearcoat:0.95,clearcoatRoughness:0.04,
    envMap:env,envMapIntensity:env?0.55:0,
    side:THREE.FrontSide,depthWrite:false});
  const glassEdgeMat=new THREE.MeshPhysicalMaterial({color:0xdbe8f8,transparent:true,opacity:0.18,
    roughness:0.05,metalness:0.0,clearcoat:0.95,clearcoatRoughness:0.04,
    envMap:env,envMapIntensity:env?0.45:0,
    side:THREE.FrontSide,depthWrite:false});
  const board=new THREE.Mesh(
    new THREE.BoxGeometry(1.9,1.1,0.06),
    [glassEdgeMat,glassEdgeMat,glassEdgeMat,glassEdgeMat,boardMat,glassEdgeMat]
  );
  board.position.set(0,3.5,-8.62);grp.add(board);
  // 篮板外框：拉丝银铝金属窄边框（Brushed Silver Aluminum）
  const bFrameM=detailOn
    ?AIBAModelDetail.stdMat(0xe4eaf4,0.22,0.72,0.75)
    :new THREE.MeshLambertMaterial({color:0xe0e6f0});
  const boardParts=[board];
  [[1.94,0.06],[1.94,-0.06]].forEach(o=>{
    const h=new THREE.Mesh(new THREE.BoxGeometry(1.94,0.055,0.085),bFrameM);
    h.position.set(0,3.5+(o[1]>=0?0.55:-0.55),-8.62);grp.add(h);
    const v=new THREE.Mesh(new THREE.BoxGeometry(0.055,1.14,0.085),bFrameM);
    v.position.set(o[1]>=0?0.95:-0.95,3.5,-8.62);grp.add(v);
    boardParts.push(h,v);
  });
  const rimM=hoopDynamicsOn()
    ?new THREE.MeshStandardMaterial({color:0xe04819,roughness:.30,metalness:.26,envMap:env,envMapIntensity:env?.55:0})
    :new THREE.MeshLambertMaterial({color:0xe04819});
  hoopRimMat=rimM;
  if(window.AIBAModelDetail?.enabled)AIBAModelDetail.hoopHardware(grp,BOARD_Z,BASE_Z,1,rimM,boardParts);
  if(hoopDynamicsOn()){
    netMesh=AIBAHoopDynamics.buildNear(grp,{hoop:HOOP,rimMat:rimM,boardParts}).mesh;
  }else{
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const seg=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.07,0.09),rimM);
      seg.position.set(HOOP.x+Math.cos(a)*0.3,HOOP.y,HOOP.z+Math.sin(a)*0.3);
      seg.userData.keepOutdoor=true;seg.rotation.y=-a+Math.PI/2;grp.add(seg);
    }
    const conn=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.07,0.32),rimM);
    conn.userData.keepOutdoor=true;conn.position.set(0,3.05,-8.42);grp.add(conn);
    netMesh=window.AIBAModelDetail?.enabled?AIBAModelDetail.net():new THREE.Mesh(
      new THREE.CylinderGeometry(0.28,0.16,0.45,8,3,true),
      new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:0.75}));
    netMesh.position.set(HOOP.x,HOOP.y-0.26,HOOP.z);grp.add(netMesh);
    netMesh.userData.keepOutdoor=true;prepareNet(netMesh);
  }
  scene.add(grp);

  // 远端装饰篮筐：保持与主篮架一致的 NBA 斜臂银框黑垫造型
  const farGrp=new THREE.Group();
  const FAR_BOARD_Z=COURT.farBaseline-0.96;            // 篮板 z:不可改动
  const FAR_BASE_Z=FAR_BOARD_Z+ARM_LEN;
  if(!detailOn){
    const farPole=new THREE.Mesh(new THREE.BoxGeometry(0.36,1.45,0.40),polM);
    farPole.position.set(0,1.32,FAR_BASE_Z);farGrp.add(farPole);
    const farArm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.24,1.95),polM);
    farArm.position.set(0,2.46,(FAR_BOARD_Z+FAR_BASE_Z)/2);farArm.rotation.x=0.56;farGrp.add(farArm);
    const farPad=new THREE.Mesh(new THREE.BoxGeometry(0.68,1.38,0.56),padM);
    farPad.position.set(0,1.36,FAR_BASE_Z-0.18);farGrp.add(farPad);
    const farBaseBox=new THREE.Mesh(new THREE.BoxGeometry(1.06,0.66,1.58),padM);
    farBaseBox.position.set(0,0.33,FAR_BASE_Z+0.12);farGrp.add(farBaseBox);
  }
  const farBoard=new THREE.Mesh(
    new THREE.BoxGeometry(1.9,1.1,0.06),
    [glassEdgeMat,glassEdgeMat,glassEdgeMat,glassEdgeMat,glassEdgeMat,boardMat]
  );
  farBoard.position.set(0,3.5,COURT.farBaseline-.96);farGrp.add(farBoard);
  if(window.AIBAModelDetail?.enabled){
    for(const sign of [-1,1]){
      AIBAModelDetail.box(farGrp,1.94,.055,.085,0,3.5+sign*.55,FAR_BOARD_Z,bFrameM);
      AIBAModelDetail.box(farGrp,.055,1.14,.085,sign*.95,3.5,FAR_BOARD_Z,bFrameM);
    }
    AIBAModelDetail.hoopHardware(farGrp,FAR_BOARD_Z,FAR_BASE_Z,-1,rimM);
  }
  if(hoopDynamicsOn()){
    AIBAHoopDynamics.buildStaticRim(farGrp,V3(0,HOOP.y,COURT.farHoopZ),FAR_BOARD_Z-.06,1,rimM);
  }else{
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const seg=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.07,0.09),rimM);
      seg.position.set(Math.cos(a)*.3,HOOP.y,COURT.farHoopZ+Math.sin(a)*.3);
      seg.userData.keepOutdoor=true;seg.rotation.y=-a+Math.PI/2;farGrp.add(seg);
    }
    const farConn=new THREE.Mesh(new THREE.BoxGeometry(.12,.07,.32),rimM);
    farConn.userData.keepOutdoor=true;farConn.position.set(0,HOOP.y,COURT.farHoopZ+.42);farGrp.add(farConn);
  }
  farNet=window.AIBAModelDetail?.enabled?AIBAModelDetail.net():new THREE.Mesh(
    new THREE.CylinderGeometry(.28,.16,.45,8,3,true),
    new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.6}));
  farNet.position.set(0,HOOP.y-.26,COURT.farHoopZ);farGrp.add(farNet);
  farNet.userData.keepOutdoor=true;prepareNet(farNet);
  scene.add(farGrp);
  grp.name="nearHoopRig";farGrp.name="farHoopRig";courtHoopRigs.push(grp,farGrp);
}
/* light cones + jumbotron lower pod */
let jumboCv,jumboTex,lastJumboKey="";
function buildAtmos(){
  [[-9.5,COURT.nearBaseline+.8],[9.5,COURT.nearBaseline+.8],[-9.5,COURT.midZ],[9.5,COURT.midZ],[-9.5,COURT.farBaseline-.8],[9.5,COURT.farBaseline-.8]].forEach(p=>{
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.4,0.9),
      new THREE.MeshBasicMaterial({color:0xfff7d0}));
    lamp.position.set(p[0],25.8,p[1]);indoorRoot.add(lamp);
  });
  jumboCv=document.createElement("canvas");jumboCv.width=512;jumboCv.height=192;
  jumboTex=new THREE.CanvasTexture(jumboCv);
  jumboTex.magFilter=THREE.LinearFilter;jumboTex.minFilter=THREE.LinearFilter;
  /* 与 arena.js 的中央八面巨幕(y=16.4)整合为一体式斗屏的下层副屏环舱(y=13.85) */
  const jm=new THREE.MeshBasicMaterial({map:jumboTex,color:0x768294});
  const dark=new THREE.MeshLambertMaterial({color:0x121620});
  const jumbo=new THREE.Mesh(new THREE.BoxGeometry(4.2,1.08,4.2),[jm,jm,dark,dark,jm,jm]);
  jumbo.position.set(0,13.85,COURT.midZ);indoorRoot.add(jumbo);
  const hang=new THREE.Mesh(new THREE.BoxGeometry(0.42,2.6,0.42),dark);
  hang.position.set(0,15.1,COURT.midZ);indoorRoot.add(hang);
  lastJumboKey="";
  updJumbo();
}
function updJumbo(){
  if(!jumboCv)return;
  const battle=G.mode==="battle"&&(G.state==="battle"||G.state==="battleend");
  const rush=G.mode==="rackrush"&&G.rush;
  const titleTxt=battle?"RACE TO 100":(rush?"RACK RUSH":"3PT CONTEST");
  const scoreTxt=battle?Math.min(G.score,BATTLE_TARGET)+" : "+Math.min(G.battleOppScore||0,BATTLE_TARGET):(rush?(G.running?Math.max(0,G.timer).toFixed(0)+'"  '+G.rush.total+" PTS":"READY"):(G.running?G.timer.toFixed(0)+'"  '+G.score+" PTS":"BLOCK KING"));
  const subTxt=battle?"PERCENT BATTLE":(rush?(RACK_RUSH_LEVELS[G.rush.level]||RACK_RUSH_LEVELS[0]).name:(G.running?(G.stage==="final"?"FINAL ROUND":"SEMI-FINAL"):"PIXEL NIGHT"));
  const subColor=G.timer<=10&&G.running?"#ff4040":"#7CFC6B";
  const key=titleTxt+"|"+scoreTxt+"|"+subTxt+"|"+subColor+"|"+G.mode;
  if(key===lastJumboKey)return;
  lastJumboKey=key;
  const g=jumboCv.getContext("2d"),w=jumboCv.width,h=jumboCv.height;
  g.fillStyle="#070a12";g.fillRect(0,0,w,h);
  g.fillStyle="rgba(126,231,255,.04)";
  for(let y=0;y<h;y+=6)g.fillRect(0,y,w,2);
  g.strokeStyle="#28364e";g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);
  g.textAlign="center";g.font="bold 34px Orbitron, monospace";
  g.fillStyle="#ffd23f";g.fillText(titleTxt,w/2,46);
  g.font="bold 58px Orbitron, monospace";
  g.fillStyle=subColor;
  g.fillText(scoreTxt,w/2,118);
  g.font="bold 24px Orbitron, monospace";g.fillStyle="#8fd0ff";
  g.fillText(subTxt,w/2,166);
  jumboTex.needsUpdate=true;
  if(typeof G!=="undefined")window.__aibaHeavyFrame=G.tNow;
  if(G.mode!=="lastshot"&&typeof window.updateCenterScoreboard==="function"){
    window.updateCenterScoreboard({
      title:titleTxt,
      score:scoreTxt,
      clock:subTxt,
      subColor
    });
  }
}


window.AIBA.runtime.register("rendering:hoop",Object.freeze({
  buildHoop,buildAtmos,updJumbo,pulseNet,updateNetPulse,
  getNet:()=>netMesh,
  getJumbotron:()=>({canvas:jumboCv,texture:jumboTex})
}));
