function bannerTex(txt,bg,fg){
  return pixTex(768,144,(g)=>{
    g.fillStyle=bg;g.fillRect(0,0,768,144);
    g.fillStyle="rgba(255,255,255,.06)";
    for(let i=0;i<768;i+=24)g.fillRect(i,0,12,144);
    g.fillStyle=fg;g.font="bold 66px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
    g.fillText(txt,384,75);
  },{smooth:true});
}
function buildStands(){
  const stepGeo=new THREE.BoxGeometry(1,1,1);
  const stepMat=new THREE.MeshLambertMaterial({color:0x2b2b38});
  const seats=[];
  /* 看台层级是纯静态同色长条,先收集再一次性烘焙成单个网格(原本每层一次 draw call) */
  const stepParts=[];
  function side(cx,cz,len,axis,inward,rows){
    for(let r=0;r<rows;r++){
      const off=(r*1.25+0.6);
      const h=0.85*(r+1);
      if(axis==="x")stepParts.push({color:stepMat.color,pos:[cx,h/2,cz-inward*off],scale:[len,h,1.25]});
      else stepParts.push({color:stepMat.color,pos:[cx-inward*off,h/2,cz],scale:[1.25,h,len]});
      const n=Math.floor(len/1.15);
      for(let s=0;s<n;s++){
        if(Math.random()<0.1)continue;
        const t=-len/2+0.6+s*1.15+rnd(-0.1,0.1);
        const px=axis==="x"?cx+t:cx-inward*off;
        const pz=axis==="x"?cz-inward*off:cz+t;
        seats.push({x:px,y:h+0.42,z:pz,ph:Math.random()*7,amp:rnd(.7,1.3)});
      }
    }
  }
  side(0,COURT.nearBaseline-2,26,"x",1,5);       // active basket end
  side(0,COURT.farBaseline+2,26,"x",-1,4);       // far end
  side(-13.4,COURT.midZ,COURT.length+4,"z",1,5); // left sideline
  side(13.4,COURT.midZ,COURT.length+4,"z",-1,5); // right sideline
  if(stepParts.length)bakeVoxelMesh(indoorRoot,stepParts);
  // banner walls
  const banners=[["aiBA PERCENT BATTLE","#13213f","#ffd23f"],["MINE-DEW 深远三分区","#0c3a14","#9dff8d"],["像素之夜 PIXEL NIGHT","#3a1240","#ff9df1"]];
  const wallDefs=[
    [0,3.6,COURT.nearBaseline-9.4,0,26],
    [-19.5,3.6,COURT.midZ,Math.PI/2,38],
    [19.5,3.6,COURT.midZ,-Math.PI/2,38],
    [0,3.6,COURT.farBaseline+7.5,Math.PI,26]
  ];
  wallDefs.forEach((w,i)=>{
    const b=banners[i%banners.length];
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w[4],4),
      new THREE.MeshBasicMaterial({map:bannerTex(b[0],b[1],b[2])}));
    m.position.set(w[0],w[1]+4.5,w[2]);m.rotation.y=w[3];indoorRoot.add(m);
  });
  return seats;
}

/* ---------------- 球馆顶棚 ----------------
   球馆原本没有顶。相机一仰,画面上方就是一片纯黑 —— 实测占画面高度 34%。
   那不是"暗",是"空":没有上边界,光也没有可见来源,首屏运镜只能靠压低视线和收 FOV 硬躲。

   补三层:深色顶面(读得出是个面,不是空洞)+ 桁架梁(给纵深和尺度)+ 悬挂灯箱(让光有来源)。
   全部静态,烘成 2 个网格(结构一个、灯一个),只多 2 个 draw call。
   挂在 indoorRoot 上,室外场景(environments.js 里 indoorRoot.visible=!outdoor)自动不显示。 */
const CEIL_Y=15.4;          // 横幅墙顶约 10.1,留出空间,不压迫
function buildCeiling(){
  const X=20.5,ZA=COURT.nearBaseline-10.5,ZB=COURT.farBaseline+8.5;
  const zSpan=ZB-ZA,zMid=(ZA+ZB)/2;
  const parts=[];
  /* 顶面不用纯黑:纯黑和"没有东西"在画面上是一样的。带一点蓝的深色才读得出是个面。 */
  parts.push({color:0x0d111b,pos:[0,CEIL_Y,zMid],scale:[X*2,0.5,zSpan]});
  for(let i=0;i<9;i++){                                   // 横向桁架
    const z=ZA+zSpan*(i+0.5)/9;
    parts.push({color:0x232b3c,pos:[0,CEIL_Y-0.85,z],scale:[X*2,0.34,0.5]});
    parts.push({color:0x1a2130,pos:[0,CEIL_Y-1.32,z],scale:[X*2,0.16,0.22]});
  }
  [-11,0,11].forEach(x=>                                   // 纵向主梁
    parts.push({color:0x232b3c,pos:[x,CEIL_Y-0.55,zMid],scale:[0.5,0.3,zSpan]}));
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"ceiling"});

  /* 灯箱自发光。画面里本来就有一道射灯光锥,但看不到灯 —— 补上光源本体,
     顶部那片区域才从"空洞"变成"有内容的暗部"。 */
  const lamps=[];
  for(let r=0;r<2;r++)for(let i=0;i<7;i++)
    lamps.push({color:0xffffff,pos:[(r?1:-1)*6.2,CEIL_Y-2.0,ZA+zSpan*(i+0.6)/7],scale:[3.0,0.28,1.5]});
  bakeVoxelMesh(indoorRoot,lamps,{materialKey:"ceilingLamp",material:{emissive:0xffe6b4}});
}

/* backcourt show: the far half is atmosphere only, shooting stays on the same half */
const showCrew=[];
function showBox(parent,geo,mat,x,y,z,sx,sy,sz){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);
  return m;
}
/* ---------------- voxel baking: 把一组固定方块烘焙成单个带顶点色的网格 ----------------
   方块风格的角色/道具由几十个纯色 Box 组成,每个都是一次 draw call。凡是彼此不再独立
   运动的部件,都可以在构建期烘焙进同一个几何体,用顶点色保留各自颜色,材质统一为白色
   Lambert(shader 里 diffuse *= vColor,结果与原来逐块着色一致)。
   只接受"位置+缩放"的轴对齐盒子,和 showBox 的语义保持一致。 */
const VOXEL_UNIT_BOX=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const VOXEL_BAKED_MATERIALS=new Map();
function bakedVoxelMaterial(key,opts){
  const id=key||"basic";
  if(VOXEL_BAKED_MATERIALS.has(id))return VOXEL_BAKED_MATERIALS.get(id);
  const m=new THREE.MeshLambertMaterial(Object.assign({color:0xffffff,vertexColors:true},opts||{}));
  VOXEL_BAKED_MATERIALS.set(id,m);
  return m;
}
/* parts: [{color:THREE.Color|number, pos:[x,y,z], scale:[sx,sy,sz]}] 或 [{color, matrix:Matrix4}] */
function bakeVoxelGeometry(parts){
  const src=VOXEL_UNIT_BOX,srcPos=src.getAttribute("position"),srcNorm=src.getAttribute("normal");
  const per=srcPos.count,total=per*parts.length;
  const pos=new Float32Array(total*3),norm=new Float32Array(total*3),col=new Float32Array(total*3);
  const m=new THREE.Matrix4(),nm=new THREE.Matrix3(),v=new THREE.Vector3(),c=new THREE.Color();
  let off=0;
  for(const part of parts){
    if(part.matrix)m.copy(part.matrix);
    else{
      const s=part.scale||[1,1,1],p=part.pos||[0,0,0];
      m.makeScale(s[0],s[1],s[2]);m.setPosition(p[0],p[1],p[2]);
    }
    nm.getNormalMatrix(m);
    if(part.color&&part.color.isColor)c.copy(part.color);else c.set(part.color==null?0xffffff:part.color);
    for(let i=0;i<per;i++){
      const o=(off+i)*3;
      v.fromBufferAttribute(srcPos,i).applyMatrix4(m);
      pos[o]=v.x;pos[o+1]=v.y;pos[o+2]=v.z;
      v.fromBufferAttribute(srcNorm,i).applyMatrix3(nm).normalize();
      norm[o]=v.x;norm[o+1]=v.y;norm[o+2]=v.z;
      col[o]=c.r;col[o+1]=c.g;col[o+2]=c.b;
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
/* 便捷封装:烘焙并挂到 parent 上,返回单个 Mesh */
function bakeVoxelMesh(parent,parts,opts){
  const mesh=new THREE.Mesh(bakeVoxelGeometry(parts),bakedVoxelMaterial((opts&&opts.materialKey)||"basic",opts&&opts.material));
  if(parent)parent.add(mesh);
  return mesh;
}
function makeAdBoard(txt,bg,fg,x,z,rot,w=2.7){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,0.72),
    new THREE.MeshBasicMaterial({map:bannerTex(txt,bg,fg),side:THREE.DoubleSide}));
  m.position.set(x,0.66,z);m.rotation.y=rot;indoorRoot.add(m);
  return m;
}
function makeCheerleader(x,z,jersey,pom){
  const g=new THREE.Group();
  const cube=new THREE.BoxGeometry(1,1,1);
  const skin=new THREE.MeshLambertMaterial({color:0xf4c89c});
  const hair=new THREE.MeshLambertMaterial({color:0x2b1710});
  const shirt=new THREE.MeshLambertMaterial({color:jersey});
  const dark=new THREE.MeshLambertMaterial({color:0x202431});
  const pomMat=new THREE.MeshLambertMaterial({color:pom,emissive:pom,emissiveIntensity:.18});
  showBox(g,cube,shirt,0,0.82,0,0.34,0.62,0.22);
  showBox(g,cube,skin,0,1.32,0,0.26,0.26,0.24);
  showBox(g,cube,hair,0,1.48,-0.02,0.3,0.12,0.26);
  showBox(g,cube,dark,-0.12,0.34,0,0.11,0.5,0.12);
  showBox(g,cube,dark,0.12,0.34,0,0.11,0.5,0.12);
  const leftArm=showBox(g,cube,skin,-0.33,1.0,0,0.09,0.42,0.1);
  const rightArm=showBox(g,cube,skin,0.33,1.0,0,0.09,0.42,0.1);
  const leftPom=showBox(g,cube,pomMat,-0.43,1.24,0,0.22,0.22,0.22);
  const rightPom=showBox(g,cube,pomMat,0.43,1.24,0,0.22,0.22,0.22);
  g.position.set(x,0,z);
  g.rotation.y=x<0?0.35:-0.35;
  indoorRoot.add(g);
  showCrew.push({type:"cheer",g,arms:[leftArm,rightArm],poms:[leftPom,rightPom],phase:Math.random()*7});
}
function makeMascot(x,z){
  const g=new THREE.Group();
  const cube=new THREE.BoxGeometry(1,1,1);
  const orange=new THREE.MeshLambertMaterial({color:0xf28b22});
  const cream=new THREE.MeshLambertMaterial({color:0xffd2a1});
  const dark=new THREE.MeshLambertMaterial({color:0x1e1210});
  showBox(g,cube,orange,0,0.82,0,0.56,0.82,0.42);
  showBox(g,cube,orange,0,1.55,0,0.64,0.54,0.48);
  showBox(g,cube,cream,0,1.45,-0.26,0.42,0.24,0.08);
  showBox(g,cube,dark,-0.18,1.62,-0.3,0.07,0.07,0.04);
  showBox(g,cube,dark,0.18,1.62,-0.3,0.07,0.07,0.04);
  showBox(g,cube,orange,-0.28,1.9,0,0.18,0.18,0.12).rotation.z=0.45;
  showBox(g,cube,orange,0.28,1.9,0,0.18,0.18,0.12).rotation.z=-0.45;
  const stripes=[-0.25,0,0.25].map(px=>showBox(g,cube,dark,px,1.57,-0.33,0.04,0.24,0.03));
  const armL=showBox(g,cube,orange,-0.52,1.15,0,0.15,0.62,0.16);
  const armR=showBox(g,cube,orange,0.52,1.15,0,0.15,0.62,0.16);
  showBox(g,cube,dark,-0.18,0.18,0,0.15,0.34,0.14);
  showBox(g,cube,dark,0.18,0.18,0,0.15,0.34,0.14);
  g.position.set(x,0,z);g.rotation.y=-0.55;indoorRoot.add(g);
  showCrew.push({type:"mascot",g,arms:[armL,armR],stripes,phase:Math.random()*7});
}
function buildBackcourtShow(){
  makeAdBoard("N1KE AIR","#11131a","#f7f7f7",-8.05,COURT.midZ+4.2,Math.PI/2,2.6);
  makeAdBoard("ADI-DASH","#f7f7f7","#11131a",-8.05,COURT.midZ+7.5,Math.PI/2,2.6);
  makeAdBoard("PIXEL SPORT","#182f61","#ffd23f",8.05,COURT.midZ+4.2,-Math.PI/2,2.8);
  makeAdBoard("BLOCKADE","#3b132f","#ffb7ec",8.05,COURT.midZ+7.5,-Math.PI/2,2.8);
  makeAdBoard("MINE-DEW","#0c3a14","#9dff8d",-4.6,COURT.farBaseline-.2,Math.PI,3.0);
  makeAdBoard("COURT CAM","#27212f","#9fd1ff",0,COURT.farBaseline-.2,Math.PI,3.0);
  makeAdBoard("3PT KING","#5b1212","#ffd23f",4.6,COURT.farBaseline-.2,Math.PI,3.0);
  const cheerPos=[[-5.8,COURT.midZ+6.1],[-4.7,COURT.midZ+7.4],[-3.6,COURT.midZ+6.3],[3.6,COURT.midZ+6.3],[4.7,COURT.midZ+7.4],[5.8,COURT.midZ+6.1]];
  cheerPos.forEach((p,i)=>makeCheerleader(p[0],p[1],i%2?0xffc72c:0x1d428a,i%2?0x7CFC6B:0xff4fd8));
  makeMascot(6.35,COURT.midZ+8.2);
}
function updBackcourtShow(t){
  if(!indoorRoot.visible)return;
  showCrew.forEach((c,i)=>{
    const s=Math.sin(t*5+c.phase), c2=Math.cos(t*4.2+c.phase);
    if(c.type==="mascot"){
      c.g.position.y=Math.max(0,s)*0.08;
      c.g.rotation.y=-0.55+Math.sin(t*2+c.phase)*0.08;
      c.arms[0].rotation.z=0.5+Math.sin(t*4+c.phase)*0.35;
      c.arms[1].rotation.z=-0.9+Math.sin(t*5+c.phase)*0.45;
    }else{
      c.g.position.y=Math.max(0,s)*0.05;
      c.g.rotation.y+=(c2*0.0015);
      c.arms[0].rotation.z=-0.75+s*0.55;
      c.arms[1].rotation.z=0.75-s*0.55;
      c.poms[0].position.y=1.24+Math.max(0,s)*0.18;
      c.poms[1].position.y=1.24+Math.max(0,-s)*0.18;
    }
  });
}
/* crowd: grouped instanced meshes (no per-instance color needed) */
const crowd={groups:[],dummy:new THREE.Object3D()};
function buildCrowd(seats){
  const bodyCols=[0x1d428a,0xffc72c,0xce1141,0xf5f5f5,0x007a33,0xe56020];
  const headCols=[0xf4c89c,0xd9a066,0x8d5524];
  const bodyGeo=new THREE.BoxGeometry(0.55,0.75,0.4);
  const headGeo=new THREE.BoxGeometry(0.38,0.38,0.38);
  const buckets=bodyCols.map(()=>[]);
  seats.forEach(s=>buckets[(Math.random()*bodyCols.length)|0].push(s));
  buckets.forEach((arr,i)=>{
    if(!arr.length)return;
    const body=new THREE.InstancedMesh(bodyGeo,new THREE.MeshLambertMaterial({color:bodyCols[i]}),arr.length);
    const head=new THREE.InstancedMesh(headGeo,new THREE.MeshLambertMaterial({color:headCols[i%3]}),arr.length);
    indoorRoot.add(body);indoorRoot.add(head);
    crowd.groups.push({body,head,seats:arr});
  });
}
function updCrowd(t){
  if(!indoorRoot.visible)return;
  const d=crowd.dummy;
  for(const g of crowd.groups){
    for(let i=0;i<g.seats.length;i++){
      const s=g.seats[i];
      const jump=Math.max(0,Math.sin(t*9+s.ph))*0.4*G.cheer*s.amp;
      const sway=Math.sin(t*1.4+s.ph)*0.035;
      d.position.set(s.x,s.y+jump+sway,s.z);
      d.rotation.y=Math.sin(s.ph)*0.4;
      d.updateMatrix();g.body.setMatrixAt(i,d.matrix);
      d.position.y+=0.58;d.updateMatrix();g.head.setMatrixAt(i,d.matrix);
    }
    g.body.instanceMatrix.needsUpdate=true;
    g.head.instanceMatrix.needsUpdate=true;
  }
}


window.AIBA.runtime.register("rendering:arena",Object.freeze({
  bannerTex,buildStands,showBox,makeAdBoard,buildBackcourtShow,updBackcourtShow,buildCrowd,updCrowd
}));

