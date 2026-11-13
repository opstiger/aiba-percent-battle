/* hoop & net */
let netMesh,farNet,netPulse=0,netPulseAge=99,netPulseDir=0,lastNetPulse=0;
const courtHoopRigs=[];
function setPlaceHoops(active){
  courtHoopRigs.forEach(rig=>rig.children.forEach(child=>{
    if(child.userData.keepOutdoor)return;
    if(active){if(child.userData.indoorVisibility===undefined)child.userData.indoorVisibility=child.visible;child.visible=false;}
    else if(child.userData.indoorVisibility!==undefined){child.visible=child.userData.indoorVisibility;delete child.userData.indoorVisibility;}
  }));
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
function buildHoop(){
  const grp=new THREE.Group();
  const detailOn=!!(window.AIBAModelDetail&&AIBAModelDetail.enabled&&AIBAModelDetail.stdMat);
  const ARM_LEN=2.6;                                  // 臂长(底座→篮板),真实 NBA 约 2.4~2.8m
  const BOARD_Z=-8.62;                                // 篮板 z:不可改动
  const BASE_Z=BOARD_Z-ARM_LEN;                       // 底座后移到底线外,落在记者区
  const polM=detailOn
    ?AIBAModelDetail.stdMat(0x1e2738,0.36,0.52,0.55)
    :new THREE.MeshLambertMaterial({color:0x222a3a});
  const padM=detailOn
    ?AIBAModelDetail.stdMat(0x18243c,0.48,0.12,0.38)
    :new THREE.MeshLambertMaterial({color:0x1e2a44});

  // NBA 级一体化流线型液压悬臂支架（去除篮板背后多余交叉杂杆与斜撑，保持篮网透视纯净）
  const pole=new THREE.Mesh(new THREE.BoxGeometry(0.38,3.35,0.42),polM);
  pole.position.set(0,1.68,BASE_Z);grp.add(pole);

  // 主悬臂梁：直达篮板背面正中
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,ARM_LEN),polM);
  arm.position.set(0,3.48,(BOARD_Z+BASE_Z)/2);grp.add(arm);

  // 底座厚实安全防撞包胶护垫
  const pad=new THREE.Mesh(new THREE.BoxGeometry(0.92,1.75,0.92),padM);
  pad.position.set(0,0.88,BASE_Z);grp.add(pad);
  const padTop=new THREE.Mesh(new THREE.BoxGeometry(0.96,0.18,0.96),padM);
  padTop.position.set(0,1.82,BASE_Z);grp.add(padTop);

  const baseBox=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.44,1.55),polM);
  baseBox.position.set(0,0.22,BASE_Z+0.20);grp.add(baseBox);
  // backboard: NBA 钢化玻璃白色外框 + 橙红投篮内框 + 斜向微反光纹理
  const bTex=pixTex(256,160,(g,w,h)=>{
    g.fillStyle="rgba(224,234,248,0.85)";g.fillRect(0,0,w,h);
    // 钢化玻璃斜向光泽带
    g.fillStyle="rgba(255,255,255,0.18)";
    g.beginPath();g.moveTo(w*0.18,0);g.lineTo(w*0.36,0);g.lineTo(w*0.14,h);g.lineTo(0,h);g.closePath();g.fill();
    g.beginPath();g.moveTo(w*0.62,0);g.lineTo(w*0.72,0);g.lineTo(w*0.50,h);g.lineTo(w*0.40,h);g.closePath();g.fill();
    // NBA 标准白边外框 + 橙红内沿 + 投篮小方框
    g.strokeStyle="#f4f7fc";g.lineWidth=12;g.strokeRect(8,8,w-16,h-16);
    g.strokeStyle="#d9481e";g.lineWidth=6;g.strokeRect(16,16,w-32,h-32);
    g.strokeStyle="#f4f7fc";g.lineWidth=10;g.strokeRect(94,78,68,56);
    g.strokeStyle="#d9481e";g.lineWidth=5;g.strokeRect(94,78,68,56);
  },{smooth:true,mipmaps:true});
  const env=typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
  const boardMat=new THREE.MeshPhysicalMaterial({map:bTex,transparent:true,opacity:0.32,
    roughness:0.05,metalness:0.0,clearcoat:0.95,clearcoatRoughness:0.04,
    envMap:env,envMapIntensity:env?0.65:0,
    side:THREE.DoubleSide,depthWrite:false});
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),boardMat);
  board.position.set(0,3.5,-8.62);grp.add(board);
  const bFrameM=detailOn
    ?AIBAModelDetail.stdMat(0xd6481f,0.32,0.35,0.55)
    :new THREE.MeshLambertMaterial({color:0xcf4a1e});
  const boardParts=[board];
  [[1.94,0.07],[1.94,-0.07]].forEach(o=>{
    const h=new THREE.Mesh(new THREE.BoxGeometry(1.96,0.09,0.16),bFrameM);
    h.position.set(0,3.5+(o[1]>=0?0.55:-0.55),-8.62);grp.add(h);
    const v=new THREE.Mesh(new THREE.BoxGeometry(0.09,1.14,0.16),bFrameM);
    v.position.set(o[1]>=0?0.95:-0.95,3.5,-8.62);grp.add(v);
    boardParts.push(h,v);
  });
  const rimM=hoopDynamicsOn()
    ?new THREE.MeshStandardMaterial({color:0xd6451c,roughness:.34,metalness:.28,envMap:env,envMapIntensity:env?.55:0})
    :new THREE.MeshLambertMaterial({color:0xd6451c});
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
  if(window.AIBAModelDetail?.enabled)AIBAModelDetail.hoopHardware(grp,BOARD_Z,BASE_Z,1,bFrameM);
  scene.add(grp);

  // 远端装饰篮筐：保持与主篮架一致的利落单臂 NBA 造型
  const farGrp=new THREE.Group();
  const FAR_BOARD_Z=COURT.farBaseline-0.96;            // 篮板 z:不可改动
  const FAR_BASE_Z=FAR_BOARD_Z+ARM_LEN;
  const farPole=new THREE.Mesh(new THREE.BoxGeometry(0.38,3.35,0.42),polM);
  farPole.position.set(0,1.68,FAR_BASE_Z);farGrp.add(farPole);
  const farArm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,ARM_LEN),polM);
  farArm.position.set(0,3.48,(FAR_BOARD_Z+FAR_BASE_Z)/2);farGrp.add(farArm);
  const farPad=new THREE.Mesh(new THREE.BoxGeometry(0.92,1.75,0.92),padM);
  farPad.position.set(0,0.88,FAR_BASE_Z);farGrp.add(farPad);
  const farPadTop=new THREE.Mesh(new THREE.BoxGeometry(0.96,0.18,0.96),padM);
  farPadTop.position.set(0,1.82,FAR_BASE_Z);farGrp.add(farPadTop);
  const farBaseBox=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.44,1.55),polM);
  farBaseBox.position.set(0,0.22,FAR_BASE_Z-0.20);farGrp.add(farBaseBox);
  const farBoard=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),boardMat);
  farBoard.position.set(0,3.5,COURT.farBaseline-.96);farGrp.add(farBoard);
  if(window.AIBAModelDetail?.enabled){
    for(const sign of [-1,1]){
      AIBAModelDetail.box(farGrp,1.96,.09,.16,0,3.5+sign*.55,FAR_BOARD_Z,bFrameM);
      AIBAModelDetail.box(farGrp,.09,1.14,.16,sign*.95,3.5,FAR_BOARD_Z,bFrameM);
    }
    AIBAModelDetail.hoopHardware(farGrp,FAR_BOARD_Z,FAR_BASE_Z,-1,bFrameM);
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
let jumboCv,jumboTex;
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
  updJumbo();
}
function updJumbo(){
  if(!jumboCv)return;
  const g=jumboCv.getContext("2d"),w=jumboCv.width,h=jumboCv.height;
  g.fillStyle="#070a12";g.fillRect(0,0,w,h);
  g.fillStyle="rgba(126,231,255,.04)";
  for(let y=0;y<h;y+=6)g.fillRect(0,y,w,2);
  g.strokeStyle="#28364e";g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);
  g.textAlign="center";g.font="bold 34px Orbitron, monospace";
  const battle=G.mode==="battle"&&(G.state==="battle"||G.state==="battleend");
  const rush=G.mode==="rackrush"&&G.rush;
  const titleTxt=battle?"RACE TO 100":(rush?"RACK RUSH":"3PT CONTEST");
  const scoreTxt=battle?Math.min(G.score,BATTLE_TARGET)+" : "+Math.min(G.battleOppScore||0,BATTLE_TARGET):(rush?(G.running?Math.max(0,G.timer).toFixed(0)+'"  '+G.rush.total+" PTS":"READY"):(G.running?G.timer.toFixed(0)+'"  '+G.score+" PTS":"BLOCK KING"));
  const subTxt=battle?"PERCENT BATTLE":(rush?(RACK_RUSH_LEVELS[G.rush.level]||RACK_RUSH_LEVELS[0]).name:(G.running?(G.stage==="final"?"FINAL ROUND":"SEMI-FINAL"):"PIXEL NIGHT"));
  g.fillStyle="#ffd23f";g.fillText(titleTxt,w/2,46);
  g.font="bold 58px Orbitron, monospace";
  g.fillStyle=G.timer<=10&&G.running?"#ff4040":"#7CFC6B";
  g.fillText(scoreTxt,w/2,118);
  g.font="bold 24px Orbitron, monospace";g.fillStyle="#8fd0ff";
  g.fillText(subTxt,w/2,166);
  jumboTex.needsUpdate=true;
  if(G.mode!=="lastshot"&&typeof window.updateCenterScoreboard==="function"){
    window.updateCenterScoreboard({
      title:titleTxt,
      score:scoreTxt,
      clock:subTxt,
      subColor:G.timer<=10&&G.running?"#ff4040":"#7CFC6B"
    });
  }
}


window.AIBA.runtime.register("rendering:hoop",Object.freeze({
  buildHoop,buildAtmos,updJumbo,pulseNet,updateNetPulse,
  getNet:()=>netMesh,
  getJumbotron:()=>({canvas:jumboCv,texture:jumboTex})
}));
