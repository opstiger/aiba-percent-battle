/* hoop & net */
let netMesh,farNet,netPulse=0,netPulseAge=99,netPulseDir=0,lastNetPulse=0;
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
function pulseNet(value,dir){
  const amount=Math.max(0,Math.min(1.4,Number(value)||0));
  if(amount<=0){netPulse=0;netPulseAge=99;netPulseDir=0;return;}
  netPulse=Math.max(netPulse,amount);netPulseAge=0;
  if(Number.isFinite(Number(dir)))netPulseDir=Math.max(-1,Math.min(1,Number(dir)));
}
function updateNetPulse(dt){
  const safeDt=Math.max(0,Math.min(.08,Number(dt)||0));
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
  // stanchion
  const polM=new THREE.MeshLambertMaterial({color:0x33333f});
  const pole=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.4,0.3),polM);
  pole.position.set(0,1.7,-10.2);grp.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,1.6),polM);
  arm.position.set(0,3.45,-9.4);grp.add(arm);
  // backboard
  const bTex=pixTex(128,80,(g)=>{
    g.fillStyle="#e8e8f2";g.fillRect(0,0,128,80);
    g.fillStyle="rgba(130,180,220,.13)";
    for(let y=0;y<80;y+=8)g.fillRect(0,y,128,2);
    g.strokeStyle="#cf4a1e";g.lineWidth=7;g.strokeRect(6,5,116,70);
    g.lineWidth=5;g.strokeRect(48,40,32,28);
  },{smooth:true});
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),
    new THREE.MeshLambertMaterial({map:bTex}));
  board.position.set(0,3.5,-8.62);grp.add(board);
  // blocky rim (octagon of boxes)
  const rimM=new THREE.MeshLambertMaterial({color:0xd6451c});
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const seg=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.07,0.09),rimM);
    seg.position.set(HOOP.x+Math.cos(a)*0.3,HOOP.y,HOOP.z+Math.sin(a)*0.3);
    seg.rotation.y=-a+Math.PI/2;grp.add(seg);
  }
  const conn=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.07,0.32),rimM);
  conn.position.set(0,3.05,-8.42);grp.add(conn);
  // net
  netMesh=new THREE.Mesh(
    new THREE.CylinderGeometry(0.28,0.16,0.45,8,3,true),
    new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:0.75}));
  netMesh.position.set(HOOP.x,HOOP.y-0.26,HOOP.z);grp.add(netMesh);
  prepareNet(netMesh);
  scene.add(grp);

  // 远端装饰篮筐：让场馆在俯拍/回放里真正读成一块全场。
  const farGrp=new THREE.Group();
  const farPole=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.4,0.3),polM);
  farPole.position.set(0,1.7,COURT.farBaseline+.62);farGrp.add(farPole);
  const farArm=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,1.6),polM);
  farArm.position.set(0,3.45,COURT.farBaseline-.18);farGrp.add(farArm);
  const farBoard=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),
    new THREE.MeshLambertMaterial({map:bTex}));
  farBoard.position.set(0,3.5,COURT.farBaseline-.96);farGrp.add(farBoard);
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const seg=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.07,0.09),rimM);
    seg.position.set(Math.cos(a)*.3,HOOP.y,COURT.farHoopZ+Math.sin(a)*.3);
    seg.rotation.y=-a+Math.PI/2;farGrp.add(seg);
  }
  const farConn=new THREE.Mesh(new THREE.BoxGeometry(.12,.07,.32),rimM);
  farConn.position.set(0,HOOP.y,COURT.farHoopZ+.42);farGrp.add(farConn);
  farNet=new THREE.Mesh(
    new THREE.CylinderGeometry(.28,.16,.45,8,3,true),
    new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.6}));
  farNet.position.set(0,HOOP.y-.26,COURT.farHoopZ);farGrp.add(farNet);
  prepareNet(farNet);
  scene.add(farGrp);
}
/* light cones + jumbotron */
let jumboCv,jumboTex;
function buildAtmos(){
  const coneM=new THREE.MeshBasicMaterial({color:0xaaccff,transparent:true,opacity:0.055,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  [[-8,COURT.nearBaseline+.8],[8,COURT.nearBaseline+.8],[-8,COURT.midZ],[8,COURT.midZ],[-8,COURT.farBaseline-.8],[8,COURT.farBaseline-.8]].forEach(p=>{
    const c=new THREE.Mesh(new THREE.ConeGeometry(3.4,12,6,1,true),coneM);
    c.position.set(p[0],6.5,p[1]);indoorRoot.add(c);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.4,0.8),
      new THREE.MeshBasicMaterial({color:0xfff7d0}));
    lamp.position.set(p[0],12.6,p[1]);indoorRoot.add(lamp);
  });
  jumboCv=document.createElement("canvas");jumboCv.width=256;jumboCv.height=128;
  jumboTex=new THREE.CanvasTexture(jumboCv);
  jumboTex.magFilter=THREE.NearestFilter;jumboTex.minFilter=THREE.NearestFilter;
  const jm=new THREE.MeshBasicMaterial({map:jumboTex});
  const dark=new THREE.MeshLambertMaterial({color:0x15151f});
  const jumbo=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.9,3.6),[jm,jm,dark,dark,jm,jm]);
  jumbo.position.set(0,9.5,COURT.midZ);indoorRoot.add(jumbo);
  const hang=new THREE.Mesh(new THREE.BoxGeometry(0.2,3,0.2),dark);
  hang.position.set(0,12,COURT.midZ);indoorRoot.add(hang);
  updJumbo();
}
function updJumbo(){
  if(!jumboCv)return;
  const g=jumboCv.getContext("2d");
  g.fillStyle="#0a0a14";g.fillRect(0,0,256,128);
  g.strokeStyle="#33334a";g.lineWidth=6;g.strokeRect(3,3,250,122);
  g.textAlign="center";g.font="bold 26px Orbitron, monospace";
  const battle=G.mode==="battle"&&(G.state==="battle"||G.state==="battleend");
  const rush=G.mode==="rackrush"&&G.rush;
  g.fillStyle="#ffd23f";g.fillText(battle?"RACE TO 100":(rush?"RACK RUSH":"3PT CONTEST"),128,34);
  g.font="bold 40px Orbitron, monospace";
  g.fillStyle=G.timer<=10&&G.running?"#ff4040":"#7CFC6B";
  g.fillText(battle?Math.min(G.score,BATTLE_TARGET)+"-"+Math.min(G.battleOppScore||0,BATTLE_TARGET):(rush?(G.running?Math.max(0,G.timer).toFixed(0)+'"  '+G.rush.total+"分":"READY"):(G.running?G.timer.toFixed(0)+'"  '+G.score+"分":"BLOCK KING")),128,84);
  g.font="bold 16px Orbitron, monospace";g.fillStyle="#8fd0ff";
  g.fillText(battle?"PERCENT BATTLE":(rush?(RACK_RUSH_LEVELS[G.rush.level]||RACK_RUSH_LEVELS[0]).name:(G.running?(G.stage==="final"?"决赛 FINAL":"半决赛 SEMI"):"PIXEL NIGHT")),128,114);
  jumboTex.needsUpdate=true;
}


window.AIBA.runtime.register("rendering:hoop",Object.freeze({
  buildHoop,buildAtmos,updJumbo,pulseNet,updateNetPulse,
  getNet:()=>netMesh,
  getJumbotron:()=>({canvas:jumboCv,texture:jumboTex})
}));
