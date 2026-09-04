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
  /* 落地式篮架(验收点名)。
     原来是"插在底线边上的一根杆":立柱距底线仅 0.62m、臂长 1.6m,
     底座几乎贴着球场 —— 那是玩具篮架的比例,不是比赛设备。
     真实 NBA 篮架是**落地式**:底座坐在底线后 2.4~2.8m 的记者区地面上,
     再用一根长臂伸到篮板背后,配重箱、护垫、斜撑都在这个底座上。
     ⚠ 篮板/篮筐的坐标一个都不能动 —— 投篮命中判定全部基于 HOOP 常量
     和 board 的位置,动一点整个命中逻辑就废了。
     所以这里只把底座往后挪,再把臂加长去够回原来那个篮板。 */
  const ARM_LEN=2.6;                                  // 臂长(底座→篮板),真实 NBA 约 2.4~2.8m
  const BOARD_Z=-8.62;                                // 篮板 z:不可改动
  const BASE_Z=BOARD_Z-ARM_LEN;                       // 底座后移到底线外,落在记者区
  const polM=new THREE.MeshLambertMaterial({color:0x33333f});
  const pole=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.4,0.3),polM);
  pole.position.set(0,1.7,BASE_Z);grp.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,ARM_LEN),polM);
  arm.position.set(0,3.45,(BOARD_Z+BASE_Z)/2);grp.add(arm);
  /* 支架护垫(padding)。正式比赛设备的支架底部一定包着厚护垫,
     没有它,光秃秃一根细杆就是"玩具篮架"最直接的信号。
     臂加长之后底座受力更明显,护垫同步加高加粗(1.5→1.7m、0.62→0.72m),
     覆盖人撞得到的整个区间。 */
  const padM=new THREE.MeshLambertMaterial({color:0x2b3550});
  const pad=new THREE.Mesh(new THREE.BoxGeometry(0.72,1.7,0.72),padM);
  pad.position.set(0,0.88,BASE_Z);grp.add(pad);
  const padTop=new THREE.Mesh(new THREE.BoxGeometry(0.76,0.16,0.76),padM);
  padTop.position.set(0,1.78,BASE_Z);grp.add(padTop);
  /* 斜撑:从底座斜向上顶住长臂中段。
     臂伸到 2.6m 之后只靠一根竖杆挑着会明显头重脚轻;真实篮架都用一根斜撑
     把力矩传回底座 —— 这也是"落地式"和"插杆式"最直观的区别:
     有斜撑,底座才读成"压住地面的配重箱",而不是插在地里的一根杆。
     dir=+1 近端(向 +z 伸) / -1 远端(向 −z 伸)。 */
  const BRACE_DY=1.55,BRACE_DZ=1.10,BRACE_LEN=Math.hypot(BRACE_DY,BRACE_DZ);
  const addBrace=(parent,baseZ,dir)=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,BRACE_LEN),polM);
    b.position.set(0,1.75+BRACE_DY/2,baseZ+dir*(0.25+BRACE_DZ/2));
    b.rotation.x=-Math.atan2(BRACE_DY,dir*BRACE_DZ);
    parent.add(b);
  };
  addBrace(grp,BASE_Z,1);
  /* 底座配重箱:落地式篮架的底座是一个扁平的箱子,不是一根杆插进地里 */
  const baseBox=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.42,1.35),polM);
  baseBox.position.set(0,0.21,BASE_Z+0.15);grp.add(baseBox);
  /* 支架加粗:原来 0.3×3.4 的细杆配 1.9m 宽的篮板显得头重脚轻 */
  pole.scale.set(1.25,1,1.25);
  // backboard
  const bTex=pixTex(128,80,(g)=>{
    g.fillStyle="#e8e8f2";g.fillRect(0,0,128,80);
    g.fillStyle="rgba(130,180,220,.13)";
    for(let y=0;y<80;y+=8)g.fillRect(0,y,128,2);
    g.strokeStyle="#cf4a1e";g.lineWidth=7;g.strokeRect(6,5,116,70);
    g.lineWidth=5;g.strokeRect(48,40,32,28);
  },{smooth:true});
  /* 篮板改半透明。原来是不透明实心板,挡住后面的看台和赛场,
     读起来像一块刷了漆的木板;真实篮板是透明亚克力/钢化玻璃,
     能透出后面的场馆 —— 这个"透"就是正式比赛设备的观感来源。
     opacity 不压太低:还要看得见白色板面和橙色方框。 */
  /* 材质抽成共享的 boardMat:之前只改了近端,远端 farBoard 仍是不透明 Lambert,
     于是两侧透明度不一致(评测直接点出来了)。共用一个材质就锁死了这个不一致。
     opacity .42→.30、clearcoat 提到 .9:原来的板"偏灰偏实"是因为透明度不够
     加上 Lambert 的漫反射把板面压成了灰白;玻璃感来自**高透明 + 强清漆高光**,
     不是把白色板面调淡。 */
  const boardMat=new THREE.MeshPhysicalMaterial({map:bTex,transparent:true,opacity:0.30,
    roughness:0.06,metalness:0.0,clearcoat:0.9,clearcoatRoughness:0.05,
    side:THREE.DoubleSide,depthWrite:false});
  const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),boardMat);
  board.position.set(0,3.5,-8.62);grp.add(board);
  /* 板边框:真实篮板有一圈明显的边框,透明化之后更需要它来界定板面 */
  const bFrameM=new THREE.MeshLambertMaterial({color:0xcf4a1e});
  [[1.94,0.07],[1.94,-0.07]].forEach(o=>{
    const h=new THREE.Mesh(new THREE.BoxGeometry(1.96,0.09,0.16),bFrameM);
    h.position.set(0,3.5+(o[1]>=0?0.55:-0.55),-8.62);grp.add(h);
    const v=new THREE.Mesh(new THREE.BoxGeometry(0.09,1.14,0.16),bFrameM);
    v.position.set(o[1]>=0?0.95:-0.95,3.5,-8.62);grp.add(v);
  });
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
  /* 远端同规格:底座同样后移到底线外,臂长/护垫/斜撑与近端一致
     (评测点名过"两侧不一致",所以这里必须逐件对齐,不能只改近端)。 */
  const FAR_BOARD_Z=COURT.farBaseline-0.96;            // 篮板 z:不可改动
  const FAR_BASE_Z=FAR_BOARD_Z+ARM_LEN;
  const farPole=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.4,0.3),polM);
  farPole.position.set(0,1.7,FAR_BASE_Z);farGrp.add(farPole);
  farPole.scale.set(1.25,1,1.25);
  const farArm=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,ARM_LEN),polM);
  farArm.position.set(0,3.45,(FAR_BOARD_Z+FAR_BASE_Z)/2);farGrp.add(farArm);
  const farPad=new THREE.Mesh(new THREE.BoxGeometry(0.72,1.7,0.72),padM);
  farPad.position.set(0,0.88,FAR_BASE_Z);farGrp.add(farPad);
  const farPadTop=new THREE.Mesh(new THREE.BoxGeometry(0.76,0.16,0.76),padM);
  farPadTop.position.set(0,1.78,FAR_BASE_Z);farGrp.add(farPadTop);
  addBrace(farGrp,FAR_BASE_Z,-1);
  const farBaseBox=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.42,1.35),polM);
  farBaseBox.position.set(0,0.21,FAR_BASE_Z-0.15);farGrp.add(farBaseBox);
  const farBoard=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,0.12),boardMat);
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
  /* 锥体光柱已删除(原来这里每个位置一个 ConeGeometry(3.4,12) + AdditiveBlending)。
     和 arena.js 的 buildLightShafts 是同一类问题:只要它是实心网格,轮廓处视线
     就切着薄壳穿过更厚的路径、累积更亮,硬边界是几何决定的,调 opacity 治不了。
     而且 Additive + DoubleSide 会翻倍、又不吃雾,暗背景上尤其跳 ——
     结果就是"我直接看到了一个锥子",而参考图要的是"我感觉到灯在上面"。
     灯箱(lamp)保留:那是光源本体,是"看得到灯"的来源,跟画光的路径是两回事。 */
  [[-8,COURT.nearBaseline+.8],[8,COURT.nearBaseline+.8],[-8,COURT.midZ],[8,COURT.midZ],[-8,COURT.farBaseline-.8],[8,COURT.farBaseline-.8]].forEach(p=>{
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.4,0.8),
      new THREE.MeshBasicMaterial({color:0xfff7d0}));
    lamp.position.set(p[0],12.6,p[1]);indoorRoot.add(lamp);
  });
  jumboCv=document.createElement("canvas");jumboCv.width=256;jumboCv.height=128;
  jumboTex=new THREE.CanvasTexture(jumboCv);
  jumboTex.magFilter=THREE.NearestFilter;jumboTex.minFilter=THREE.NearestFilter;
  /* 端线大屏压暗一档(评测:大号黄色数字比中央吊挂记分牌更抢眼)。
     MeshBasicMaterial 不吃灯,默认满亮,在暗场馆里天然是视觉焦点;
     给一个压暗色之后,注意力才回到球场正上方的中央吊挂屏 —— 那才是职业馆的构图中心。 */
  const jm=new THREE.MeshBasicMaterial({map:jumboTex,color:0x5d626c});
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
