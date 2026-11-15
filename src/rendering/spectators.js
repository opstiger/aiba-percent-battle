/* near-court crowd: active basket side only, varied shapes and behavior */
const nearCourtCrowd={root:null,people:[],reaction:0,miss:0,last:"idle"};
function miniSignTex(txt,bg,fg){
  return pixTex(160,76,(g)=>{
    g.fillStyle=bg;g.fillRect(0,0,160,76);
    g.strokeStyle=fg;g.globalAlpha=.68;g.lineWidth=5;g.strokeRect(5,5,150,66);
    g.globalAlpha=1;g.fillStyle=fg;g.font="bold 28px Orbitron, monospace";
    g.textAlign="center";g.textBaseline="middle";g.fillText(txt,80,39);
  },{smooth:true});
}
function makeNearCourtPerson(parent,cube,cfg,mats){
  const g=new THREE.Group(),skin=mats.skin[cfg.skin%mats.skin.length],hair=mats.hair[cfg.hair%mats.hair.length];
  const shirt=cfg.kind==="cheer"?mats.cheer[cfg.shirt%mats.cheer.length]:mats.shirts[cfg.shirt%mats.shirts.length];
  const pants=cfg.kind==="cheer"?mats.cheerPants:mats.pants[cfg.pants%mats.pants.length],shoe=mats.shoes[cfg.shoe%mats.shoes.length];
  const hype=cfg.kind==="hype"||cfg.kind==="cheer",scale=cfg.scale||1;
  /* 光滑低模人体轮廓：先添加上衣部件以便球队配色动态重染只作用于前 shirtVertCount 个顶点，
     再添加光滑圆柱颈、卵形头与耳部、圆润发冠、骨盆、锥形大腿/小腿与圆润球鞋。 */
  const bodyParts=[
    {shape:"cyl",color:shirt.color,pos:[0,1.02,0],scale:[.36,.28,.23],taperX:1.18,taperZ:1.12},
    {shape:"sphere",color:shirt.color,pos:[-.17,1.10,0],scale:[.14,.13,.16]},
    {shape:"sphere",color:shirt.color,pos:[.17,1.10,0],scale:[.14,.13,.16]},
    {shape:"cyl",color:shirt.color,pos:[0,.80,0],scale:[.33,.22,.22],taperX:.96,taperZ:.96}
  ];
  if(cfg.kind==="cheer")bodyParts.push({shape:"cyl",color:shirt.color,pos:[0,.58,0],scale:[.44,.18,.28],taperX:.72,taperZ:.72});
  const shirtPartCount=bodyParts.length;
  bodyParts.push(
    {shape:"cyl",color:skin.color,pos:[0,1.22,-.01],scale:[.10,.11,.10]},
    {shape:"sphere",color:skin.color,pos:[0,1.40,-.01],scale:[.22,.26,.23],taperX:1.06,taperZ:1.04},
    {shape:"sphere",color:skin.color,pos:[-.11,1.39,-.01],scale:[.038,.06,.035]},
    {shape:"sphere",color:skin.color,pos:[.11,1.39,-.01],scale:[.038,.06,.035]},
    {shape:"dome",color:hair.color,pos:[0,1.43,-.015],scale:[.235,.22,.245]},
    {shape:"sphere",color:hair.color,pos:[0,1.40,.07],scale:[.20,.18,.12]},
    {shape:"sphere",color:pants.color,pos:[0,.65,0],scale:[.34,.16,.21]},
    {shape:"cyl",color:pants.color,pos:[-.10,.48,0],scale:[.15,.30,.155],taperX:1.18,taperZ:1.15},
    {shape:"cyl",color:pants.color,pos:[.10,.48,0],scale:[.15,.30,.155],taperX:1.18,taperZ:1.15},
    {shape:"cyl",color:cfg.kind==="cheer"?skin.color:pants.color,pos:[-.10,.24,.01],scale:[.125,.28,.13],taperX:1.22,taperZ:1.20},
    {shape:"cyl",color:cfg.kind==="cheer"?skin.color:pants.color,pos:[.10,.24,.01],scale:[.125,.28,.13],taperX:1.22,taperZ:1.20},
    {shape:"dome",color:shoe.color,pos:[-.10,.025,-.03],scale:[.145,.11,.24]},
    {shape:"dome",color:shoe.color,pos:[.10,.025,-.03],scale:[.145,.11,.24]},
    {shape:"cyl",color:0xe8edf5,pos:[-.10,.016,-.03],scale:[.15,.03,.25]},
    {shape:"cyl",color:0xe8edf5,pos:[.10,.016,-.03],scale:[.15,.03,.25]}
  );
  const body=bakeOrganicMesh(g,bodyParts);
  const shirtVertCount=body.geometry.userData.partVertCounts?body.geometry.userData.partVertCounts[shirtPartCount-1]:72;
  const armL=makeOrganicLimbMesh(g,skin,-.24,1.11,-.01,.088,.45);
  const armR=makeOrganicLimbMesh(g,skin,.24,1.11,-.01,.088,.45);
  armL.rotation.z=hype?-.42:-.08;armR.rotation.z=hype?.42:.08;
  let phone=null,sign=null,prop=null,pomL=null,pomR=null;
  if(cfg.kind==="filmer"){
    phone=showBox(armR,cube,mats.phone,0,-.44,-.025,.12,.19,.03);
    armR.rotation.x=2.05;armR.rotation.z=-.18;
  }else if(cfg.kind==="heckler"){
    sign=new THREE.Mesh(new THREE.PlaneGeometry(.98,.46),new THREE.MeshBasicMaterial({
      map:mats.signs[cfg.sign%mats.signs.length],transparent:true,side:THREE.DoubleSide
    }));
    sign.position.set(0,1.74,-.28);g.add(sign);
    armL.rotation.set(2.35,0,-.22);armR.rotation.set(2.35,0,.22);
  }else if(cfg.kind==="cheer"){
    const pomGeo=new THREE.SphereGeometry(.12,10,8);
    pomL=new THREE.Mesh(pomGeo,mats.pomA);pomL.position.set(0,-.45,0);armL.add(pomL);
    pomR=new THREE.Mesh(pomGeo,mats.pomB);pomR.position.set(0,-.45,0);armR.add(pomR);
    armL.rotation.z=-2.2;armR.rotation.z=2.2;
  }else if(cfg.kind==="distract"){
    prop=showBox(armR,cube,mats.towel,0,-.56,0,.11,.46,.05);
    armR.rotation.z=2.25;armR.rotation.x=.28;
  }else if(cfg.kind==="player"){
    prop=new THREE.Mesh(new THREE.SphereGeometry(.115,12,10),mats.ball);
    prop.position.set(0,-.45,-.04);armL.add(prop);
    armL.rotation.z=-.38;armL.rotation.x=.42;armR.rotation.z=.18;
  }
  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(scale);
  parent.add(g);
  nearCourtCrowd.people.push({g,body,shirtVertCount,arms:[armL,armR],phone,sign,prop,poms:[pomL,pomR],
    kind:cfg.kind,base:V3(cfg.x,0,cfg.z),baseRot:cfg.rot,axis:cfg.axis||V3(0,0,0),move:cfg.move||0,
    phase:cfg.phase,amp:cfg.amp||1,team:cfg.x>0?1:0,responseStart:-100,responseDuration:0,responseSign:0});
}
const VIP_ARM_MAT=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});

let _cachedSpectatorSitMesh=null;
let _spectatorSitLoading=false;
const _pendingVIPUpgrades=[];
const _coloredSpectatorGeoCache=new Map();
const _spectatorVertexColorMat=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});

function ensureGLTFLoader(cb){
  if(window.THREE&&window.THREE.GLTFLoader)return cb();
  const s=document.createElement("script");
  s.src="vendor/GLTFLoader.r128.js";
  s.onload=cb;
  document.head.appendChild(s);
}

function getColoredSpectatorGeo(cfg){
  const skinHex=recede(cfg.skin||0xedb48a,0.05,0.08);
  const hairHex=cfg.capColor||cfg.hair||0x181412;
  const outfitHex=recede(cfg.outfit||cfg.jersey||0x242a38,0.05,0.10);
  const accentHex=cfg.accent||cfg.pom||outfitHex;
  const pantsHex=recede(cfg.pants||0x161a24,0.05,0.12);
  const shoeHex=cfg.shoe||0xf2f4f8;
  const key=`${skinHex}_${hairHex}_${outfitHex}_${accentHex}_${pantsHex}_${shoeHex}`;
  if(_coloredSpectatorGeoCache.has(key))return _coloredSpectatorGeoCache.get(key);

  const baseGeo=_cachedSpectatorSitMesh.geometry;
  const geo=baseGeo.clone();
  const pos=geo.attributes.position;
  const count=pos.count;
  const colors=new Float32Array(count*3);
  const cSkin=new THREE.Color(skinHex);
  const cHair=new THREE.Color(hairHex);
  const cOutfit=new THREE.Color(outfitHex);
  const cAccent=new THREE.Color(accentHex);
  const cPants=new THREE.Color(pantsHex);
  const cShoe=new THREE.Color(shoeHex);
  const cSole=new THREE.Color(0xf4f6fa);

  for(let i=0;i<count;i++){
    const vx=pos.getX(i),vy=pos.getY(i),vz=pos.getZ(i);
    let c;
    if(vy<0.028){
      c=cSole;
    }else if(vy<0.115){
      c=cShoe;
    }else if(vy<0.50){
      c=cPants;
    }else if(vy<0.66&&vz>0.03&&Math.abs(vx)<0.22){
      // 放在膝前的双手与小臂皮肤
      c=cSkin;
    }else if(vy<0.915){
      c=cOutfit;
    }else if(vy<0.965){
      c=cAccent;
    }else if(vy>=1.185||(vy>=1.04&&vz<-0.055)){
      c=cHair;
    }else{
      c=cSkin;
    }
    colors[i*3]=c.r;
    colors[i*3+1]=c.g;
    colors[i*3+2]=c.b;
  }
  geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
  _coloredSpectatorGeoCache.set(key,geo);
  return geo;
}

function loadSpectatorSitModel(){
  if(_cachedSpectatorSitMesh||_spectatorSitLoading)return;
  _spectatorSitLoading=true;
  ensureGLTFLoader(()=>{
    new THREE.GLTFLoader().load("assets/models/spectator_sit.glb",gltf=>{
      let foundMesh=null;
      gltf.scene.traverse(child=>{
        if(child.isMesh&&!foundMesh)foundMesh=child;
      });
      if(!foundMesh){_spectatorSitLoading=false;return;}
      foundMesh.geometry.computeVertexNormals();
      _cachedSpectatorSitMesh=foundMesh;
      _spectatorSitLoading=false;
      while(_pendingVIPUpgrades.length>0){
        const item=_pendingVIPUpgrades.shift();
        applyModelToVIP(item.person,item.cfg);
      }
    },undefined,err=>{
      console.warn("Failed to load spectator_sit.glb:",err);
      _spectatorSitLoading=false;
    });
  });
}

function applyModelToVIP(person,cfg){
  if(!_cachedSpectatorSitMesh||!person.g)return;
  if(person.body)person.body.visible=false;
  if(person.arms){
    // 将挂在旧方块手臂上的相机/饮品/手机移到真实人体胸前手部位置，彻底隐藏旧体素手臂避免“四只手”
    for(const arm of person.arms){
      if(!arm)continue;
      while(arm.children.length>0){
        const ch=arm.children[0];
        arm.remove(ch);
        if(person.kind==="photo"){
          ch.position.set(0,0.96,-0.32);
          ch.rotation.set(0.06,0,0);
          person.g.add(ch);
        }else if(person.poms&&(ch===person.poms[0]||ch===person.poms[1])){
          const side=ch===person.poms[0]?-0.18:0.18;
          ch.position.set(side,0.62,-0.22);
          person.g.add(ch);
        }else{
          ch.position.set(0.10,0.62,-0.22);
          person.g.add(ch);
        }
      }
      arm.visible=false;
    }
  }
  const m=new THREE.Mesh(getColoredSpectatorGeo(cfg),_spectatorVertexColorMat);
  m.name="realSpectatorMesh";
  m.rotation.y=Math.PI;
  m.position.set(0,cfg.seatOffsetY||0,0);

  const idx=cfg.idx||(person.phase?Math.floor(person.phase*10):0);
  const fat=0.94+((idx*7)%5)*0.04;
  const height=0.95+((idx*11)%5)*0.035;
  m.scale.set(fat,height,fat*0.98);

  person.g.add(m);
  person.realMesh=m;
}
function queueSpectatorModelUpgrade(person,cfg){
  if(_cachedSpectatorSitMesh){
    applyModelToVIP(person,cfg);
  }else{
    _pendingVIPUpgrades.push({person,cfg});
    loadSpectatorSitModel();
  }
}
function makeCourtsideVIP(parent,cube,cfg){
  const g=new THREE.Group();
  const s=cfg.scale||1;
  const skinCol=new THREE.Color(recede(cfg.skin,0.06,0.10));
  const hairCol=new THREE.Color(cfg.hair);
  const outfitCol=new THREE.Color(recede(cfg.outfit,0.06,0.12));
  const accentCol=new THREE.Color(cfg.accent);
  const pantsCol=new THREE.Color(recede(cfg.pants||0x161a24,0.06,0.14));
  const shoeCol=new THREE.Color(cfg.shoe||0xf2f4f8);
  const role=cfg.role;
  const pose=cfg.pose||"relaxed";

  // 坐姿腿部姿态分化（chill 翘二郎腿 / intense 前倾蓄力 / relaxed 自然分腿）
  const legs=pose==="chill"?[
    {shape:"cyl",color:pantsCol,pos:[-0.105,0.51,-0.16],scale:[0.155,0.34,0.155],rot:[Math.PI*0.48,0,0],taperX:0.86,taperZ:0.86},
    {shape:"cyl",color:pantsCol,pos:[0.06,0.56,-0.17],scale:[0.15,0.35,0.15],rot:[Math.PI*0.44,-0.28,0],taperX:0.86,taperZ:0.86},
    {shape:"sphere",color:pantsCol,pos:[-0.105,0.49,-0.33],scale:[0.145,0.14,0.145]},
    {shape:"sphere",color:pantsCol,pos:[-0.02,0.54,-0.33],scale:[0.14,0.135,0.14]},
    {shape:"cyl",color:pantsCol,pos:[-0.105,0.27,-0.34],scale:[0.125,0.38,0.13],taperX:1.20,taperZ:1.18},
    {shape:"cyl",color:pantsCol,pos:[-0.06,0.34,-0.38],scale:[0.12,0.36,0.125],rot:[0.18,0,-0.24],taperX:1.20,taperZ:1.18},
    {shape:"dome",color:shoeCol,pos:[-0.105,0.025,-0.38],scale:[0.145,0.115,0.24]},
    {shape:"dome",color:shoeCol,pos:[-0.14,0.14,-0.45],scale:[0.14,0.11,0.23]},
    {shape:"cyl",color:0xf0f4fa,pos:[-0.105,0.016,-0.38],scale:[0.15,0.03,0.25]}
  ]:[
    {shape:"cyl",color:pantsCol,pos:[-0.105,0.51,-0.16],scale:[0.155,0.34,0.155],rot:[Math.PI*0.48,0,0],taperX:0.86,taperZ:0.86},
    {shape:"cyl",color:pantsCol,pos:[0.105,0.51,-0.16],scale:[0.155,0.34,0.155],rot:[Math.PI*0.48,0,0],taperX:0.86,taperZ:0.86},
    {shape:"sphere",color:pantsCol,pos:[-0.105,0.49,-0.33],scale:[0.145,0.14,0.145]},
    {shape:"sphere",color:pantsCol,pos:[0.105,0.49,-0.33],scale:[0.145,0.14,0.145]},
    {shape:"cyl",color:pantsCol,pos:[-0.105,0.27,-0.34],scale:[0.125,0.38,0.13],taperX:1.20,taperZ:1.18},
    {shape:"cyl",color:pantsCol,pos:[0.105,0.27,-0.34],scale:[0.125,0.38,0.13],taperX:1.20,taperZ:1.18},
    {shape:"dome",color:shoeCol,pos:[-0.105,0.025,-0.38],scale:[0.145,0.115,0.24]},
    {shape:"dome",color:shoeCol,pos:[0.105,0.025,-0.38],scale:[0.145,0.115,0.24]},
    {shape:"cyl",color:0xf0f4fa,pos:[-0.105,0.016,-0.38],scale:[0.15,0.03,0.25]},
    {shape:"cyl",color:0xf0f4fa,pos:[0.105,0.016,-0.38],scale:[0.15,0.03,0.25]}
  ];

  // 高精细光滑坐姿身体（对齐 VIP 皮质折椅 y=0.465）
  const parts=[
    {shape:"sphere",color:pantsCol,pos:[0,0.52,0.03],scale:[0.38,0.18,0.28]},
    ...legs,
    {shape:"cyl",color:outfitCol,pos:[0,0.74,0.03],scale:[0.35,0.24,0.24],taperX:1.06,taperZ:1.04},
    {shape:"cyl",color:outfitCol,pos:[0,0.94,0.02],scale:[0.39,0.26,0.25],taperX:1.16,taperZ:1.10},
    {shape:"sphere",color:outfitCol,pos:[0,1.02,0.02],scale:[0.44,0.20,0.26]},
    {shape:"sphere",color:outfitCol,pos:[-0.19,1.05,0.02],scale:[0.15,0.14,0.17]},
    {shape:"sphere",color:outfitCol,pos:[0.19,1.05,0.02],scale:[0.15,0.14,0.17]},
    {shape:"cyl",color:skinCol,pos:[0,1.18,0.01],scale:[0.105,0.11,0.105]},
    {shape:"sphere",color:skinCol,pos:[0,1.35,0.00],scale:[0.225,0.265,0.235],taperX:1.06,taperZ:1.04},
    {shape:"sphere",color:skinCol,pos:[-0.112,1.34,0.00],scale:[0.038,0.06,0.035]},
    {shape:"sphere",color:skinCol,pos:[0.112,1.34,0.00],scale:[0.038,0.06,0.035]},
    {shape:"sphere",color:skinCol,pos:[0,1.33,-0.112],scale:[0.038,0.05,0.04]}
  ];

  if(role==="coach"){
    parts.push(
      {shape:"cyl",color:0xf4f6fa,pos:[0,1.11,-0.04],scale:[0.14,0.11,0.10],taperX:1.25},
      {shape:"cyl",color:accentCol,pos:[0,0.97,-0.115],scale:[0.045,0.22,0.025],taperX:0.75},
      {shape:"dome",color:hairCol,pos:[0,1.38,0.01],scale:[0.235,0.20,0.245]}
    );
  }else if(role==="celeb"){
    parts.push(
      {shape:"cyl",color:accentCol,pos:[0,1.13,0.01],scale:[0.20,0.055,0.18]},
      {shape:"cyl",color:0xf4c44e,pos:[0,1.06,-0.08],scale:[0.16,0.028,0.13],rot:[0.35,0,0]},
      {shape:"box",color:0x0b0e14,pos:[-0.045,1.36,-0.118],scale:[0.075,0.038,0.025]},
      {shape:"box",color:0x0b0e14,pos:[0.045,1.36,-0.118],scale:[0.075,0.038,0.025]},
      {shape:"box",color:0xd8b24c,pos:[0,1.368,-0.118],scale:[0.18,0.012,0.018]},
      {shape:"dome",color:hairCol,pos:[0,1.38,0.01],scale:[0.24,0.22,0.25]}
    );
  }else if(role==="star"){
    parts.push(
      {shape:"sphere",color:outfitCol,pos:[0,1.13,0.06],scale:[0.28,0.12,0.20]},
      {shape:"cyl",color:0xf6c954,pos:[0,1.05,-0.09],scale:[0.18,0.034,0.14],rot:[0.35,0,0]},
      {shape:"dome",color:accentCol,pos:[0,1.39,0.01],scale:[0.245,0.21,0.255]},
      {shape:"cyl",color:accentCol,pos:[0,1.39,-0.11],scale:[0.20,0.026,0.15],rot:[-0.14,0,0],taperX:0.86,taperZ:0.86}
    );
  }else if(role==="fashion"){
    parts.push(
      {shape:"cyl",color:0xf6c954,pos:[0,1.07,-0.08],scale:[0.15,0.024,0.12],rot:[0.32,0,0]},
      {shape:"box",color:0x101218,pos:[-0.045,1.36,-0.118],scale:[0.078,0.042,0.025]},
      {shape:"box",color:0x101218,pos:[0.045,1.36,-0.118],scale:[0.078,0.042,0.025]},
      {shape:"dome",color:hairCol,pos:[0,1.39,0.01],scale:[0.24,0.22,0.25]},
      {shape:"sphere",color:hairCol,pos:[0,1.36,0.15],scale:[0.12,0.24,0.11]}
    );
  }else{
    parts.push(
      {shape:"cyl",color:accentCol,pos:[0,1.13,0.01],scale:[0.19,0.05,0.17]},
      {shape:"dome",color:hairCol,pos:[0,1.38,0.01],scale:[0.235,0.20,0.245]}
    );
    if(role==="official")parts.push({shape:"sphere",color:0x151820,pos:[-0.125,1.34,0.0],scale:[0.045,0.065,0.05]});
  }

  const body=bakeOrganicMesh(g,parts,{standard:role==="celeb"||role==="star"||role==="fashion",material:{roughness:0.46,metalness:0.14,envMapIntensity:0.42}});
  const sleeveColor=role==="celeb"?accentCol.getHex():outfitCol.getHex();
  const armL=makeOrganicLimbMesh(g,VIP_ARM_MAT,-0.23,1.05,0.02,0.092,0.44,{sleeveRatio:0.72,sleeveColor,skinColor:skinCol.getHex()});
  const armR=makeOrganicLimbMesh(g,VIP_ARM_MAT,0.23,1.05,0.02,0.092,0.44,{sleeveRatio:0.72,sleeveColor,skinColor:skinCol.getHex()});
  armL.rotation.set(0.55,0,-0.08);
  armR.rotation.set(0.55,0,0.08);

  let prop=null,phone=null;
  if(role==="coach"){
    const board=new THREE.Group();
    board.position.set(0,-0.43,-0.04);
    showBox(board,cube,new THREE.MeshLambertMaterial({color:0x182030}),0,0,0,0.26,0.02,0.34);
    showBox(board,cube,new THREE.MeshLambertMaterial({color:0xe8edf5}),0,0.012,0,0.22,0.008,0.29);
    armR.add(board);armR.rotation.set(0.95,0,-0.16);prop=board;
  }else if(role==="celeb"||(pose==="chill"&&cfg.phase%2<1)){
    const cup=new THREE.Group();
    cup.position.set(0,-0.43,-0.03);
    cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.038,0.14,10),new THREE.MeshLambertMaterial({color:0xfdb927})));
    armR.add(cup);armR.rotation.set(0.88,0,-0.12);prop=cup;
  }else if(role==="fashion"||(pose==="social"&&cfg.phase%3<1)){
    phone=showBox(armR,cube,new THREE.MeshLambertMaterial({color:0x111520}),0,-0.44,-0.025,0.11,0.18,0.025);
    armR.rotation.set(1.92,0,-0.16);
  }

  const baseY=cfg.y||0;
  const yawOff=cfg.yawOff||0;
  const basePitch=pose==="chill"?-0.08:(pose==="intense"?0.10:(pose==="hyper"?0.05:0));
  const excitement=cfg.excitement!=null?cfg.excitement:(pose==="chill"?0.22:(pose==="hyper"?1.28:(pose==="intense"?0.95:0.55)));
  g.position.set(cfg.x,baseY,cfg.z);g.rotation.y=cfg.rot+yawOff;g.scale.setScalar(s);
  parent.add(g);
  const person={g,body,shirtVertCount:0,arms:[armL,armR],phone,sign:null,prop,poms:[null,null],
    kind:role==="fashion"?"filmer":(role==="coach"?"coach":"vip"),vip:true,seated:true,role,pose,excitement,basePitch,yawOff,
    base:V3(cfg.x,baseY,cfg.z),baseY,baseRot:cfg.rot,axis:V3(0,0,0),move:0,
    phase:cfg.phase,amp:cfg.amp||1,team:cfg.x>0?1:0,responseStart:-100,responseDuration:0,responseSign:0};
  nearCourtCrowd.people.push(person);
  if(_cachedSpectatorSitMesh){
    applyModelToVIP(person,cfg);
  }else{
    _pendingVIPUpgrades.push({person,cfg});
    loadSpectatorSitModel();
  }
}
function makeArenaStaff(parent,cube,cfg){
  const g=new THREE.Group();
  const s=cfg.scale||0.94;
  const role=cfg.staffRole;
  const skinCol=new THREE.Color(recede(cfg.skin||0xda9d6e,0.06,0.10));
  const hairCol=new THREE.Color(cfg.hair||0x181412);
  const topCol=new THREE.Color(role==="waiter"?0xf2f4f8:(role==="security"?0xd8a21e:(role==="sweeper"?0x24344e:cfg.outfit||0x2e2038)));
  const vestCol=new THREE.Color(role==="waiter"?0x141720:(role==="security"?0x161a24:(role==="sweeper"?0x1c2638:cfg.accent||0xfdb927)));
  const pantsCol=new THREE.Color(0x141720);

  const parts=[
    {shape:"cyl",color:vestCol,pos:[0,1.01,0],scale:[0.37,0.28,0.24],taperX:1.16,taperZ:1.10},
    {shape:"cyl",color:topCol,pos:[0,0.80,0],scale:[0.33,0.22,0.22],taperX:0.96,taperZ:0.96},
    {shape:"sphere",color:vestCol,pos:[-0.18,1.08,0],scale:[0.14,0.13,0.16]},
    {shape:"sphere",color:vestCol,pos:[0.18,1.08,0],scale:[0.14,0.13,0.16]},
    {shape:"cyl",color:skinCol,pos:[0,1.21,-0.01],scale:[0.10,0.11,0.10]},
    {shape:"sphere",color:skinCol,pos:[0,1.39,-0.01],scale:[0.22,0.255,0.225],taperX:1.06,taperZ:1.04},
    {shape:"dome",color:hairCol,pos:[0,1.42,-0.015],scale:[0.23,0.21,0.24]},
    {shape:"sphere",color:pantsCol,pos:[0,0.65,0],scale:[0.34,0.16,0.21]}
  ];
  if(role==="security"){
    parts.push(
      {shape:"box",color:0x0b0e14,pos:[-0.045,1.40,-0.115],scale:[0.075,0.036,0.025]},
      {shape:"box",color:0x0b0e14,pos:[0.045,1.40,-0.115],scale:[0.075,0.036,0.025]}
    );
  }
  const body=bakeOrganicMesh(g,parts);
  const legMat=new THREE.MeshLambertMaterial({color:pantsCol});
  const legL=makeOrganicLimbMesh(g,legMat,-0.10,0.60,0,0.115,0.56,{sleeveRatio:0.88,sleeveColor:pantsCol.getHex(),skinColor:0x111318});
  const legR=makeOrganicLimbMesh(g,legMat,0.10,0.60,0,0.115,0.56,{sleeveRatio:0.88,sleeveColor:pantsCol.getHex(),skinColor:0x111318});
  const sleeveHex=role==="waiter"?0xf2f4f8:vestCol.getHex();
  const armL=makeOrganicLimbMesh(g,VIP_ARM_MAT,-0.24,1.08,-0.01,0.088,0.44,{sleeveRatio:0.74,sleeveColor:sleeveHex,skinColor:skinCol.getHex()});
  const armR=makeOrganicLimbMesh(g,VIP_ARM_MAT,0.24,1.08,-0.01,0.088,0.44,{sleeveRatio:0.74,sleeveColor:sleeveHex,skinColor:skinCol.getHex()});

  let prop=null;
  if(role==="waiter"){
    // 银色 VIP 托盘 + 饮品杯
    const tray=new THREE.Group();
    tray.position.set(0,-0.43,-0.14);
    tray.add(new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.18,0.025,14),new THREE.MeshLambertMaterial({color:0xd8dee8})));
    for(const [dx,dz,col] of [[-0.06,-0.05,0xfdb927],[0.07,-0.03,0x7ee7ff],[0.0,0.07,0xd94b64]]){
      const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.028,0.11,8),new THREE.MeshLambertMaterial({color:col}));
      cup.position.set(dx,0.065,dz);tray.add(cup);
    }
    armR.add(tray);armR.rotation.set(1.22,0,0.06);prop=tray;
  }else if(role==="sweeper"){
    // 宽头 NBA 场边推尘拖把
    const mop=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,1.28,8),new THREE.MeshLambertMaterial({color:0xc8d0dc}));
    pole.position.set(0,-0.45,-0.28);pole.rotation.x=0.68;mop.add(pole);
    const head=showBox(mop,cube,new THREE.MeshLambertMaterial({color:0x222c3c}),0,-0.92,-0.68,0.88,0.08,0.18);
    showBox(head,cube,new THREE.MeshLambertMaterial({color:0xe8edf5}),0,-0.035,0,0.92,0.04,0.21);
    g.add(mop);
    armL.rotation.set(0.75,0,-0.12);armR.rotation.set(0.75,0,0.12);
    prop=mop;
  }

  g.position.set(cfg.x,cfg.y||0,cfg.z);g.rotation.y=cfg.rot||0;g.scale.setScalar(s);
  parent.add(g);
  nearCourtCrowd.people.push({g,body,shirtVertCount:0,arms:[armL,armR],legs:[legL,legR],phone:null,sign:null,prop,poms:[null,null],
    kind:role,staff:true,staffRole:role,vip:false,seated:false,
    base:V3(cfg.x,cfg.y||0,cfg.z),baseY:cfg.y||0,baseRot:cfg.rot||0,
    walkAxis:cfg.walkAxis||V3(0,0,1),walkRange:cfg.walkRange||0,walkSpeed:cfg.walkSpeed||0.75,
    phase:cfg.phase||0,amp:cfg.amp||1,team:cfg.x>0?1:0,responseStart:-100,responseDuration:0,responseSign:0});
}
function makeFloorPhotographer(parent,cube,cfg){
  const g=new THREE.Group();
  const s=cfg.scale||0.92;
  const skinCol=new THREE.Color(recede(cfg.skin,0.06,0.10));
  const hairCol=new THREE.Color(cfg.hair);
  const topCol=new THREE.Color(recede(cfg.outfit,0.06,0.12));
  const pantsCol=new THREE.Color(recede(cfg.pants||0x161a24,0.06,0.14));
  const sitStyle=cfg.sitStyle||"cross"; // "cross" 盘腿坐地 / "knees" 曲膝坐地 / "kneel" 单膝跪地

  const legs=sitStyle==="kneel"?[
    {shape:"sphere",color:pantsCol,pos:[0,0.44,0.04],scale:[0.34,0.16,0.24]},
    {shape:"cyl",color:pantsCol,pos:[-0.10,0.26,0.04],scale:[0.14,0.34,0.14],rot:[0.05,0,0]},
    {shape:"cyl",color:pantsCol,pos:[0.10,0.42,-0.12],scale:[0.14,0.32,0.14],rot:[Math.PI*0.44,0,0]},
    {shape:"cyl",color:pantsCol,pos:[0.10,0.21,-0.26],scale:[0.12,0.36,0.12]},
    {shape:"dome",color:0x141720,pos:[-0.10,0.04,0.22],scale:[0.13,0.10,0.20]},
    {shape:"dome",color:0x141720,pos:[0.10,0.02,-0.30],scale:[0.14,0.11,0.22]}
  ]:(sitStyle==="knees"?[
    {shape:"sphere",color:pantsCol,pos:[0,0.13,0.05],scale:[0.36,0.18,0.26]},
    {shape:"cyl",color:pantsCol,pos:[-0.13,0.20,-0.14],scale:[0.145,0.34,0.145],rot:[1.15,0.15,0]},
    {shape:"cyl",color:pantsCol,pos:[0.13,0.20,-0.14],scale:[0.145,0.34,0.145],rot:[1.15,-0.15,0]},
    {shape:"cyl",color:pantsCol,pos:[-0.14,0.15,-0.28],scale:[0.12,0.32,0.12],rot:[-0.35,0,0]},
    {shape:"cyl",color:pantsCol,pos:[0.14,0.15,-0.28],scale:[0.12,0.32,0.12],rot:[-0.35,0,0]},
    {shape:"dome",color:0x181c24,pos:[-0.14,0.02,-0.38],scale:[0.14,0.11,0.22]},
    {shape:"dome",color:0x181c24,pos:[0.14,0.02,-0.38],scale:[0.14,0.11,0.22]}
  ]:[
    // 盘腿坐地
    {shape:"sphere",color:pantsCol,pos:[0,0.12,0.04],scale:[0.38,0.17,0.28]},
    {shape:"cyl",color:pantsCol,pos:[-0.17,0.11,-0.11],scale:[0.14,0.34,0.14],rot:[Math.PI*0.48,-0.62,0]},
    {shape:"cyl",color:pantsCol,pos:[0.17,0.11,-0.11],scale:[0.14,0.34,0.14],rot:[Math.PI*0.48,0.62,0]},
    {shape:"cyl",color:pantsCol,pos:[-0.08,0.09,-0.25],scale:[0.12,0.32,0.12],rot:[Math.PI*0.48,1.15,0]},
    {shape:"cyl",color:pantsCol,pos:[0.08,0.09,-0.25],scale:[0.12,0.32,0.12],rot:[Math.PI*0.48,-1.15,0]},
    {shape:"dome",color:0x181c24,pos:[0.11,0.04,-0.26],scale:[0.13,0.10,0.20]}
  ]);
  const hipY=sitStyle==="kneel"?0.44:0.13;
  const parts=[
    ...legs,
    {shape:"cyl",color:topCol,pos:[0,hipY+0.20,0.03],scale:[0.34,0.24,0.23],taperX:1.08,taperZ:1.05},
    {shape:"cyl",color:topCol,pos:[0,hipY+0.40,0.02],scale:[0.38,0.24,0.24],taperX:1.15,taperZ:1.08},
    {shape:"sphere",color:topCol,pos:[-0.18,hipY+0.48,0.02],scale:[0.14,0.13,0.16]},
    {shape:"sphere",color:topCol,pos:[0.18,hipY+0.48,0.02],scale:[0.14,0.13,0.16]},
    {shape:"cyl",color:skinCol,pos:[0,hipY+0.60,0.01],scale:[0.10,0.10,0.10]},
    {shape:"sphere",color:skinCol,pos:[0,hipY+0.76,0.00],scale:[0.215,0.25,0.225],taperX:1.06,taperZ:1.04},
    {shape:"dome",color:cfg.capColor||hairCol,pos:[0,hipY+0.80,0.01],scale:[0.23,0.20,0.24]},
    // 摄影马甲口袋装饰
    {shape:"box",color:0x10131a,pos:[-0.08,hipY+0.32,-0.10],scale:[0.09,0.12,0.03]},
    {shape:"box",color:0x10131a,pos:[0.08,hipY+0.32,-0.10],scale:[0.09,0.12,0.03]}
  ];
  if(cfg.capColor){
    parts.push({shape:"cyl",color:cfg.capColor,pos:[0,hipY+0.80,0.11],scale:[0.18,0.024,0.14],rot:[0.14,0,0],taperX:0.86,taperZ:0.86});
  }
  const body=bakeOrganicMesh(g,parts);
  const armL=makeOrganicLimbMesh(g,VIP_ARM_MAT,-0.22,hipY+0.48,0.02,0.088,0.42,{sleeveRatio:0.70,sleeveColor:topCol.getHex(),skinColor:skinCol.getHex()});
  const armR=makeOrganicLimbMesh(g,VIP_ARM_MAT,0.22,hipY+0.48,0.02,0.088,0.42,{sleeveRatio:0.70,sleeveColor:topCol.getHex(),skinColor:skinCol.getHex()});

  // 单反相机 + 长焦镜头
  const camGroup=new THREE.Group();
  camGroup.position.set(-0.08,-0.38,-0.10);
  showBox(camGroup,cube,new THREE.MeshLambertMaterial({color:0x12151c}),0,0,0,0.16,0.12,0.12);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.056,0.26,10),new THREE.MeshLambertMaterial({color:cfg.whiteLens?0xe8edf5:0x1e222a}));
  lens.rotation.x=Math.PI/2;lens.position.set(0,0,-0.17);camGroup.add(lens);
  armR.add(camGroup);

  // 底线折叠摄影矮凳
  showBox(g,cube,new THREE.MeshLambertMaterial({color:0x141720}),0,0.18,0.12,0.32,0.36,0.28);

  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(s);
  parent.add(g);
  const person={g,body,shirtVertCount:0,arms:[armL,armR],phone:null,sign:null,prop:camGroup,poms:[null,null],
    kind:"photo",baselineCrew:true,crewRole:"photo",sitStyle,state:cfg.state||"shoot",stateTimer:cfg.phase*1.7,
    base:V3(cfg.x,0,cfg.z),baseY:0,baseRot:cfg.rot,axis:V3(0,0,0),move:0,
    phase:cfg.phase,amp:cfg.amp||1,team:0,responseStart:-100,responseDuration:0,responseSign:0};
  nearCourtCrowd.people.push(person);
  queueSpectatorModelUpgrade(person,cfg);
}
function makeFloorCheerleader(parent,cube,cfg){
  const g=new THREE.Group();
  const s=cfg.scale||0.90;
  const skinCol=new THREE.Color(recede(cfg.skin||0xf4c89c,0.05,0.08));
  const hairCol=new THREE.Color(cfg.hair||0x2b1710);
  const jerseyCol=new THREE.Color(cfg.jersey||0xfdb927);
  const pomCol=cfg.pom||0x4a2178;
  const sitStyle=cfg.sitStyle||"sit"; // "sit" 坐地 / "kneel" 跪坐 / "stand" 站立领舞

  const legs=sitStyle==="stand"?[
    {shape:"cyl",color:skinCol,pos:[-0.095,0.33,0],scale:[0.095,0.46,0.095],taperX:1.25,taperZ:1.22},
    {shape:"cyl",color:skinCol,pos:[0.095,0.33,0],scale:[0.095,0.46,0.095],taperX:1.25,taperZ:1.22},
    {shape:"dome",color:0xffffff,pos:[-0.095,0.02,-0.025],scale:[0.125,0.10,0.21]},
    {shape:"dome",color:0xffffff,pos:[0.095,0.02,-0.025],scale:[0.125,0.10,0.21]}
  ]:(sitStyle==="kneel"?[
    {shape:"cyl",color:skinCol,pos:[-0.10,0.22,0.08],scale:[0.095,0.34,0.095],rot:[1.25,0,0]},
    {shape:"cyl",color:skinCol,pos:[0.10,0.22,0.08],scale:[0.095,0.34,0.095],rot:[1.25,0,0]},
    {shape:"dome",color:0xffffff,pos:[-0.10,0.05,0.24],scale:[0.11,0.09,0.18]},
    {shape:"dome",color:0xffffff,pos:[0.10,0.05,0.24],scale:[0.11,0.09,0.18]}
  ]:[
    // 坐地上（双腿微曲伸向前侧）
    {shape:"sphere",color:0xffffff,pos:[0,0.12,0.04],scale:[0.34,0.16,0.24]},
    {shape:"cyl",color:skinCol,pos:[-0.14,0.11,-0.15],scale:[0.10,0.34,0.10],rot:[Math.PI*0.48,-0.32,0]},
    {shape:"cyl",color:skinCol,pos:[0.14,0.11,-0.15],scale:[0.10,0.34,0.10],rot:[Math.PI*0.48,0.32,0]},
    {shape:"cyl",color:skinCol,pos:[-0.18,0.10,-0.34],scale:[0.09,0.30,0.09],rot:[Math.PI*0.42,0.35,0]},
    {shape:"cyl",color:skinCol,pos:[0.18,0.10,-0.34],scale:[0.09,0.30,0.09],rot:[Math.PI*0.42,-0.35,0]},
    {shape:"dome",color:0xffffff,pos:[-0.11,0.03,-0.45],scale:[0.12,0.09,0.19]},
    {shape:"dome",color:0xffffff,pos:[0.11,0.03,-0.45],scale:[0.12,0.09,0.19]}
  ]);
  const hipY=sitStyle==="stand"?0.60:(sitStyle==="kneel"?0.36:0.13);
  const parts=[
    ...legs,
    {shape:"cyl",color:0xffffff,pos:[0,hipY+0.04,0.01],scale:[0.40,0.20,0.28],taperX:0.66,taperZ:0.66},
    {shape:"cyl",color:jerseyCol,pos:[0,hipY+0.28,0.01],scale:[0.23,0.36,0.17],taperX:1.26,taperZ:1.16},
    {shape:"sphere",color:jerseyCol,pos:[0,hipY+0.39,0.01],scale:[0.30,0.19,0.21]},
    {shape:"cyl",color:skinCol,pos:[0,hipY+0.54,0],scale:[0.095,0.10,0.095]},
    {shape:"sphere",color:skinCol,pos:[0,hipY+0.70,0],scale:[0.21,0.25,0.22],taperX:1.06,taperZ:1.04},
    {shape:"dome",color:hairCol,pos:[0,hipY+0.73,-0.01],scale:[0.225,0.21,0.235]},
    {shape:"sphere",color:hairCol,pos:[0,hipY+0.70,0.14],scale:[0.11,0.24,0.10]}
  ];
  const body=bakeOrganicMesh(g,parts);
  const skinMat=new THREE.MeshLambertMaterial({color:skinCol});
  const armL=makeOrganicLimbMesh(g,skinMat,-0.19,hipY+0.44,0,0.078,0.38);
  const armR=makeOrganicLimbMesh(g,skinMat,0.19,hipY+0.44,0,0.078,0.38);
  const pomGeo=new THREE.SphereGeometry(0.125,10,8);
  const pomMat=new THREE.MeshLambertMaterial({color:pomCol,emissive:pomCol,emissiveIntensity:0.18});
  const pomL=new THREE.Mesh(pomGeo,pomMat);pomL.position.set(0,-0.38,0);armL.add(pomL);
  const pomR=new THREE.Mesh(pomGeo,pomMat);pomR.position.set(0,-0.38,0);armR.add(pomR);

  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(s);
  parent.add(g);
  const person={g,body,shirtVertCount:0,arms:[armL,armR],phone:null,sign:null,prop:null,poms:[pomL,pomR],
    kind:"cheer",baselineCrew:true,crewRole:"cheer",sitStyle,state:cfg.state||(sitStyle==="stand"?"hype":"sit_chill"),stateTimer:cfg.phase*1.5,
    base:V3(cfg.x,0,cfg.z),baseY:0,baseRot:cfg.rot,axis:V3(0,0,0),move:0,
    phase:cfg.phase,amp:cfg.amp||1,team:0,responseStart:-100,responseDuration:0,responseSign:0};
  nearCourtCrowd.people.push(person);
  if(sitStyle!=="stand"){
    queueSpectatorModelUpgrade(person,{...cfg,pants:0xf2f4f8,shoe:0xffffff});
  }
}
function makeBaselineMascot(parent,cube,cfg){
  const g=new THREE.Group();
  const orangeMat=new THREE.MeshLambertMaterial({color:0xf28b22});
  // 坐地上的大熊吉祥物（双腿前伸坐于底线地板，穿紫金球衣背心+头带）
  bakeOrganicMesh(g,[
    {shape:"sphere",color:0xf28b22,pos:[0,0.44,0.02],scale:[0.56,0.68,0.46]},
    {shape:"sphere",color:0xffd2a1,pos:[0,0.42,-0.15],scale:[0.38,0.46,0.22]},
    {shape:"cyl",color:0x4a2178,pos:[0,0.46,0.02],scale:[0.58,0.38,0.48],taperX:0.92,taperZ:0.92},
    {shape:"sphere",color:0xf28b22,pos:[0,1.02,0],scale:[0.58,0.54,0.52]},
    {shape:"sphere",color:0xffd2a1,pos:[0,0.93,-0.23],scale:[0.38,0.23,0.20]},
    {shape:"sphere",color:0x1e1210,pos:[0,0.99,-0.32],scale:[0.10,0.07,0.06]},
    {shape:"sphere",color:0x1e1210,pos:[-0.16,1.10,-0.23],scale:[0.075,0.085,0.05]},
    {shape:"sphere",color:0x1e1210,pos:[0.16,1.10,-0.23],scale:[0.075,0.085,0.05]},
    {shape:"cyl",color:0xfdb927,pos:[0,1.15,0],scale:[0.52,0.07,0.48]},
    {shape:"sphere",color:0xf28b22,pos:[-0.25,1.30,0],scale:[0.17,0.18,0.11],rot:[0,0,0.42]},
    {shape:"sphere",color:0xf28b22,pos:[0.25,1.30,0],scale:[0.17,0.18,0.11],rot:[0,0,-0.42]},
    // 坐姿前伸的双腿
    {shape:"cyl",color:0xf28b22,pos:[-0.22,0.14,-0.28],scale:[0.19,0.46,0.19],rot:[Math.PI*0.48,-0.22,0]},
    {shape:"cyl",color:0xf28b22,pos:[0.22,0.14,-0.28],scale:[0.19,0.46,0.19],rot:[Math.PI*0.48,0.22,0]},
    {shape:"dome",color:0x1e1210,pos:[-0.27,0.04,-0.52],scale:[0.22,0.18,0.24]},
    {shape:"dome",color:0x1e1210,pos:[0.27,0.04,-0.52],scale:[0.22,0.18,0.24]}
  ]);
  const armL=makeOrganicLimbMesh(g,orangeMat,-0.33,0.72,0,0.14,0.52);
  const armR=makeOrganicLimbMesh(g,orangeMat,0.33,0.72,0,0.14,0.52);
  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot||Math.PI;
  parent.add(g);
  nearCourtCrowd.people.push({g,body:null,shirtVertCount:0,arms:[armL,armR],phone:null,sign:null,prop:null,poms:[null,null],
    kind:"mascot",baselineCrew:true,crewRole:"mascot",sitStyle:"sit",state:"chill",stateTimer:0,
    base:V3(cfg.x,0,cfg.z),baseY:0,baseRot:cfg.rot||Math.PI,axis:V3(0,0,0),move:0,
    phase:cfg.phase||0.5,amp:1.15,team:0,responseStart:-100,responseDuration:0,responseSign:0});
}
function makeNiulaiMascot(parent,cube,cfg){
  const g=new THREE.Group();
  const yellowMat=new THREE.MeshLambertMaterial({color:0xebbd4a});
  // 《牛来》主角吉祥物：通体淡黄毛色、低模稚嫩小牛角、标志性呆滞大眼、宽大粉牛鼻、黑蹄，穿紫金吉祥物背心
  bakeOrganicMesh(g,[
    // 坐/蹲姿圆润牛身 + 浅米肚皮 + 紫金球衣背心
    {shape:"sphere",color:0xebbd4a,pos:[0,0.44,0.03],scale:[0.54,0.62,0.48]},
    {shape:"sphere",color:0xf7df9c,pos:[0,0.40,-0.15],scale:[0.34,0.40,0.20]},
    {shape:"cyl",color:0x58278a,pos:[0,0.46,0.02],scale:[0.56,0.34,0.50],taperX:0.92,taperZ:0.92},
    // 略方钝的“手搓感”牛头 + 宽大粉嫩牛嘴鼻套 + 两颗鼻孔
    {shape:"sphere",color:0xebbd4a,pos:[0,0.96,-0.02],scale:[0.52,0.48,0.52]},
    {shape:"sphere",color:0xf0b29e,pos:[0,0.85,-0.25],scale:[0.40,0.24,0.22]},
    {shape:"sphere",color:0x2b1a16,pos:[-0.08,0.87,-0.35],scale:[0.05,0.045,0.04]},
    {shape:"sphere",color:0x2b1a16,pos:[0.08,0.87,-0.35],scale:[0.05,0.045,0.04]},
    // 标志性呆滞直勾勾大眼（大白眼白 + 略微失焦小黑瞳）
    {shape:"sphere",color:0xffffff,pos:[-0.13,1.03,-0.22],scale:[0.13,0.14,0.07]},
    {shape:"sphere",color:0xffffff,pos:[0.13,1.03,-0.22],scale:[0.13,0.14,0.07]},
    {shape:"sphere",color:0x111216,pos:[-0.115,1.035,-0.26],scale:[0.052,0.056,0.04]},
    {shape:"sphere",color:0x111216,pos:[0.145,1.025,-0.26],scale:[0.052,0.056,0.04]},
    // 一对稚嫩简陋的短牛角 + 两侧耷拉小牛耳
    {shape:"cyl",color:0xede4cc,pos:[-0.17,1.24,0.0],scale:[0.10,0.20,0.10],rot:[0.12,0,0.38],taperX:0.28,taperZ:0.28},
    {shape:"cyl",color:0xede4cc,pos:[0.17,1.24,0.0],scale:[0.10,0.20,0.10],rot:[0.12,0,-0.38],taperX:0.28,taperZ:0.28},
    {shape:"sphere",color:0xd8a83c,pos:[-0.28,1.02,0.02],scale:[0.18,0.09,0.10],rot:[0,0,0.45]},
    {shape:"sphere",color:0xd8a83c,pos:[0.28,1.02,0.02],scale:[0.18,0.09,0.10],rot:[0,0,-0.45]},
    // 坐姿前伸的双腿与黑牛蹄
    {shape:"cyl",color:0xebbd4a,pos:[-0.20,0.14,-0.26],scale:[0.17,0.42,0.17],rot:[Math.PI*0.48,-0.20,0]},
    {shape:"cyl",color:0xebbd4a,pos:[0.20,0.14,-0.26],scale:[0.17,0.42,0.17],rot:[Math.PI*0.48,0.20,0]},
    {shape:"cyl",color:0x1e1816,pos:[-0.25,0.05,-0.48],scale:[0.18,0.12,0.18],rot:[Math.PI*0.48,-0.20,0]},
    {shape:"cyl",color:0x1e1816,pos:[0.25,0.05,-0.48],scale:[0.18,0.12,0.18],rot:[Math.PI*0.48,0.20,0]}
  ]);
  const armL=makeOrganicLimbMesh(g,yellowMat,-0.31,0.68,0,0.12,0.46,{sleeveRatio:0.78,sleeveColor:0xebbd4a,skinColor:0x1e1816});
  const armR=makeOrganicLimbMesh(g,yellowMat,0.31,0.68,0,0.12,0.46,{sleeveRatio:0.78,sleeveColor:0xebbd4a,skinColor:0x1e1816});
  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot||Math.PI;
  parent.add(g);
  nearCourtCrowd.people.push({g,body:null,shirtVertCount:0,arms:[armL,armR],phone:null,sign:null,prop:null,poms:[null,null],
    kind:"niulai",baselineCrew:true,crewRole:"niulai",sitStyle:"sit",state:"derpy",stateTimer:0,
    base:V3(cfg.x,0,cfg.z),baseY:0,baseRot:cfg.rot||Math.PI,axis:V3(0,0,0),move:0,
    phase:cfg.phase||1.4,amp:1.1,team:0,responseStart:-100,responseDuration:0,responseSign:0});
}
function buildNearBaselineCrew(root,cube){
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  // 1. 投篮端底线坐地摄影师（大多数盘腿/曲膝坐于底线地板，少数单膝跪地）
  const photoSpots=[
    {x:-6.1,z:COURT.nearBaseline-1.55,sitStyle:"cross",state:"shoot",whiteLens:true,outfit:0x1a1e28,capColor:0x12151e,skin:0xedb48a,hair:0x2c1b10},
    {x:-5.0,z:COURT.nearBaseline-1.85,sitStyle:"knees",state:"review",whiteLens:false,outfit:0x242a38,capColor:0x4a2178,skin:0xb87848,hair:0x16100d},
    {x:-3.9,z:COURT.nearBaseline-1.48,sitStyle:"cross",state:"shoot",whiteLens:true,outfit:0x181c24,capColor:null,skin:0xf6cdab,hair:0x8a6d42},
    {x:-2.7,z:COURT.nearBaseline-1.92,sitStyle:"kneel",state:"shoot",whiteLens:false,outfit:0x2a2434,capColor:0x181a22,skin:0xda9d6e,hair:0x181412},
    {x:-1.8,z:COURT.nearBaseline-1.55,sitStyle:"cross",state:"chill_sit",whiteLens:true,outfit:0x1c2230,capColor:null,skin:0x824b22,hair:0x111216},
    {x:1.8,z:COURT.nearBaseline-1.55,sitStyle:"cross",state:"shoot",whiteLens:true,outfit:0x1b202c,capColor:0x141720,skin:0xf0c294,hair:0x2c1b10},
    {x:2.8,z:COURT.nearBaseline-1.90,sitStyle:"knees",state:"chat",whiteLens:false,outfit:0x282d3a,capColor:null,skin:0xedb48a,hair:0x16100d},
    {x:3.9,z:COURT.nearBaseline-1.50,sitStyle:"cross",state:"review",whiteLens:true,outfit:0x161922,capColor:0xf2ae29,skin:0xb87848,hair:0x16100d},
    {x:5.0,z:COURT.nearBaseline-1.85,sitStyle:"kneel",state:"shoot",whiteLens:false,outfit:0x202634,capColor:null,skin:0xf6cdab,hair:0x3a3e48},
    {x:6.1,z:COURT.nearBaseline-1.55,sitStyle:"cross",state:"chill_sit",whiteLens:true,outfit:0x181c26,capColor:0x181a24,skin:0xda9d6e,hair:0x181412}
  ];
  (mobile?photoSpots.filter((_,i)=>i%2===0):photoSpots).forEach((c,i)=>{
    makeFloorPhotographer(root,cube,{...c,rot:Math.PI+(i%3-1)*0.12,phase:i*0.9+0.3,scale:0.90+(i%3)*0.03});
  });

  // 2. 投篮端底线啦啦队（大部分坐地上，2 位跪姿/站姿领舞）
  const cheerSpots=[
    {x:-8.1,z:COURT.nearBaseline-1.25,sitStyle:"sit",state:"sit_cheer",jersey:0xfdb927,pom:0x4a2178,skin:0xf6cdab,hair:0x2c1b10},
    {x:-7.3,z:COURT.nearBaseline-1.85,sitStyle:"sit",state:"sit_chill",jersey:0x4a2178,pom:0xfdb927,skin:0xedb48a,hair:0x16100d},
    {x:-6.6,z:COURT.nearBaseline-2.15,sitStyle:"kneel",state:"sit_cheer",jersey:0xfdb927,pom:0x4a2178,skin:0xda9d6e,hair:0x181412},
    {x:6.7,z:COURT.nearBaseline-2.05,sitStyle:"sit",state:"sit_cheer",jersey:0x4a2178,pom:0xfdb927,skin:0xf0c294,hair:0x2c1b10},
    {x:7.4,z:COURT.nearBaseline-1.65,sitStyle:"sit",state:"sit_chill",jersey:0xfdb927,pom:0x4a2178,skin:0xb87848,hair:0x16100d},
    {x:8.2,z:COURT.nearBaseline-1.25,sitStyle:"stand",state:"hype",jersey:0x4a2178,pom:0xfdb927,skin:0xf6cdab,hair:0x8a6d42}
  ];
  (mobile?cheerSpots.filter((_,i)=>i%2===0):cheerSpots).forEach((c,i)=>{
    makeFloorCheerleader(root,cube,{...c,rot:Math.PI+(c.x<0?-0.22:0.22),phase:i*1.1+0.6,scale:0.88+(i%2)*0.03});
  });

  // 3. 投篮端底线双吉祥物：左侧大熊吉祥物 + 右侧爆红网络吉祥物《牛来》
  makeBaselineMascot(root,cube,{x:-7.25,z:COURT.nearBaseline-1.15,rot:Math.PI-0.28,phase:0.7});
  makeNiulaiMascot(root,cube,{x:7.15,z:COURT.nearBaseline-1.15,rot:Math.PI+0.28,phase:1.9});
}
function buildCourtsideVIPs(root,cube){
  const scZ=COURT.midZ-2.0;
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const vipProfiles=[
    {role:"star",outfit:0xf2ae29,accent:0x4a2178,pants:0x161922,skin:0xb87848,hair:0x16100d,shoe:0xf8f9fc,scale:0.98,pose:"chill"},
    {role:"celeb",outfit:0x1b202e,accent:0xf2ae29,pants:0x1b2436,skin:0xedb48a,hair:0x2c1b10,shoe:0x181a22,scale:0.94,pose:"social"},
    {role:"fashion",outfit:0x58278a,accent:0xfdb927,pants:0x161822,skin:0xf6cdab,hair:0x16100d,shoe:0xfdb927,scale:0.90,pose:"relaxed"},
    {role:"coach",outfit:0x192130,accent:0xf2ae29,pants:0x192130,skin:0xda9d6e,hair:0x5c606a,shoe:0x14161c,scale:0.95,pose:"intense"},
    {role:"vipfan",outfit:0x1e2230,accent:0xfdb927,pants:0x141720,skin:0xf0c294,hair:0x181412,shoe:0xe8edf5,scale:0.93,pose:"hyper"},
    {role:"star",outfit:0x161a24,accent:0x58278a,pants:0x222634,skin:0x824b22,hair:0x111216,shoe:0x58278a,scale:0.99,pose:"chill"},
    {role:"celeb",outfit:0x2e2038,accent:0xf8bb34,pants:0x141720,skin:0xf6cdab,hair:0x8a6d42,shoe:0xf2f4f8,scale:0.93,pose:"hyper"},
    {role:"fashion",outfit:0xf8bb34,accent:0x181a24,pants:0x181b26,skin:0xedb48a,hair:0x2c1b10,shoe:0x181a24,scale:0.91,pose:"social"},
    {role:"vipfan",outfit:0x58278a,accent:0xfdb927,pants:0x1b2232,skin:0xb87848,hair:0x121010,shoe:0xf2f4f8,scale:0.96,pose:"intense"},
    {role:"coach",outfit:0x222732,accent:0x58278a,pants:0x222732,skin:0xf0c294,hair:0x3a3e48,shoe:0x12141a,scale:0.94,pose:"relaxed"}
  ];
  const vipZ0=COURT.nearBaseline+0.95,vipZ1=COURT.farBaseline-1.85;
  const sideRows=mobile?[
    {dist:9.25,y:0.00,step:1.24,skipScorer:true},
    {dist:10.05,y:0.22,step:1.28,skipScorer:true}
  ]:[
    {dist:9.25,y:0.00,step:0.62,skipScorer:true},
    {dist:10.05,y:0.22,step:0.64,skipScorer:true},
    {dist:10.82,y:0.46,step:0.66,skipScorer:false}
  ];
  let idx=0;
  for(const side of [-1,1]){
    const rot=side>0?Math.PI/2:-Math.PI/2;
    for(const row of sideRows){
      const cx=side*row.dist;
      for(let cz=vipZ0;cz<=vipZ1;cz+=row.step){
        if(row.skipScorer&&side<0&&Math.abs(cz-scZ)<2.95)continue;
        idx++;
        if(idx%17===0)continue; // 偶留零星未入座空位更真实
        const prof=vipProfiles[idx%vipProfiles.length];
        const yawOff=prof.pose==="social"?((idx%2?1:-1)*0.24):((idx%5-2)*0.045);
        makeCourtsideVIP(root,cube,{idx,x:cx,y:row.y,z:cz,rot,yawOff,phase:idx*0.77,amp:0.82+(idx%4)*0.11,...prof});
      }
    }
  }
  // 近端底线 VIP 阶梯席
  const baseVipZ=COURT.nearBaseline-4.45;
  for(const side of [-1,1]){
    for(let x=2.3;x<=8.1;x+=(mobile?1.36:0.68)){
      idx++;
      if(idx%15===0)continue;
      const prof=vipProfiles[idx%vipProfiles.length];
      makeCourtsideVIP(root,cube,{idx,x:side*x,y:0.16,z:baseVipZ,rot:Math.PI,yawOff:(idx%5-2)*0.05,phase:idx*0.83,amp:0.85+(idx%3)*0.12,...prof});
    }
  }
  // 技术台后方 3 位记录员
  for(const dz of [-1.5,0,1.5]){
    makeCourtsideVIP(root,cube,{idx:990+dz,x:-10.42,y:0,z:scZ+dz,rot:-Math.PI/2,role:"official",pose:"intense",excitement:0.35,
      outfit:0x182032,accent:0xfdb927,pants:0x121620,skin:0xedb48a,hair:0x1c1816,shoe:0x14161c,scale:0.90,phase:dz+2.0,amp:0.75});
  }
  // 场边走动与执勤人员：服务员、安保、保洁擦地员、过道走动嘉宾
  const staffConfigs=[
    {staffRole:"waiter",x:8.62,z:COURT.nearBaseline+3.5,rot:Math.PI/2,walkAxis:V3(0,0,1),walkRange:4.2,walkSpeed:0.82,skin:0xedb48a,phase:0.4},
    {staffRole:"waiter",x:-8.62,z:COURT.midZ+2.6,rot:-Math.PI/2,walkAxis:V3(0,0,1),walkRange:3.8,walkSpeed:0.76,skin:0xb87848,phase:2.1},
    {staffRole:"waiter",x:11.35,z:COURT.midZ-1.5,rot:Math.PI/2,walkAxis:V3(0,0,1),walkRange:4.8,walkSpeed:0.90,skin:0xf0c294,phase:1.3},
    {staffRole:"security",x:-8.55,z:COURT.nearBaseline+0.35,rot:-Math.PI*0.75,walkAxis:V3(0,0,1),walkRange:0.65,walkSpeed:0.45,skin:0x824b22,phase:0.8},
    {staffRole:"security",x:8.55,z:COURT.nearBaseline+0.35,rot:Math.PI*0.75,walkAxis:V3(0,0,1),walkRange:0.65,walkSpeed:0.42,skin:0xda9d6e,phase:1.9},
    {staffRole:"security",x:8.65,z:COURT.farBaseline-2.2,rot:Math.PI*0.5,walkAxis:V3(0,0,1),walkRange:0.8,walkSpeed:0.48,skin:0x4e2c16,phase:3.1},
    {staffRole:"sweeper",x:0,z:COURT.nearBaseline-0.65,rot:0,walkAxis:V3(1,0,0),walkRange:3.6,walkSpeed:0.95,skin:0xda9d6e,phase:0.5},
    {staffRole:"sweeper",x:8.52,z:COURT.midZ+0.5,rot:Math.PI/2,walkAxis:V3(0,0,1),walkRange:3.6,walkSpeed:0.88,skin:0xedb48a,phase:2.7},
    {staffRole:"guest",x:-11.35,z:COURT.nearBaseline+4.0,rot:0,walkAxis:V3(0,0,1),walkRange:4.5,walkSpeed:0.92,outfit:0x58278a,accent:0xfdb927,skin:0xf6cdab,phase:1.1},
    {staffRole:"guest",x:0,z:COURT.nearBaseline-5.2,rot:Math.PI/2,walkAxis:V3(1,0,0),walkRange:6.4,walkSpeed:0.86,outfit:0x1b202e,accent:0xf2ae29,skin:0xb87848,phase:3.4}
  ];
  staffConfigs.forEach(sc=>makeArenaStaff(root,cube,sc));
  buildNearBaselineCrew(root,cube);
}
function buildNearCourtCrowd(){
  nearCourtCrowd.root=null;nearCourtCrowd.people.length=0;nearCourtCrowd.reaction=0;nearCourtCrowd.miss=0;
  const root=new THREE.Group();root.name="nearCourtCrowdRoot";scene.add(root);nearCourtCrowd.root=root;
  const cube=new THREE.BoxGeometry(1,1,1),mat=hex=>new THREE.MeshLambertMaterial({color:hex}),dimMat=(hex,desat=0.08,dark=0.14)=>new THREE.MeshLambertMaterial({color:recede(hex,desat,dark)});
  const mats={
    skin:[0xf6cdab,0xedb48a,0xda9d6e,0xb87848,0x824b22,0x4e2c16].map(h=>dimMat(h,0.08,0.14)),
    hair:[mat(0x16100d),mat(0x2c1b10),mat(0x8a6d42),mat(0x0f1118),mat(0x3a3e48)],
    // 场边名流与死忠球迷：置于球场外缘 ~85% 暖色溢光过渡带，自然衔接赛场与看台聚光池
    shirts:[0xf2ae29,0x58278a,0xeef1f7,0x1b202c,0x3a4860,0xf8bb34,0x4b2078,0xe0e5ef,0x252a38].map(h=>dimMat(h,0.08,0.14)),
    pants:[0x141720,0x1d2b42,0x2c303a,0x122620,0x242834,0x221814].map(h=>dimMat(h,0.08,0.18)),
    shoes:[mat(0x88909c),mat(0x111116),mat(0x6e2838),mat(0x2e5870),mat(0x8a7030)],
    cheer:[0xf2ae29,0x58278a,0xf8bb34,0x4b2078].map(h=>dimMat(h,0.08,0.14)),
    cheerPants:mat(0x10131c),
    phone:mat(0x07131f),mouth:mat(0x502c29),
    towel:new THREE.MeshLambertMaterial({color:0xfdb927,emissive:0x8a6010,emissiveIntensity:.15}),
    ball:new THREE.MeshLambertMaterial({color:0xc86d1c,emissive:0x5a2200,emissiveIntensity:.06}),
    pomA:new THREE.MeshLambertMaterial({color:0xfdb927,emissive:0x8a6010,emissiveIntensity:.16}),
    pomB:new THREE.MeshLambertMaterial({color:0x552583,emissive:0x3b195e,emissiveIntensity:.16}),
    signs:[miniSignTex("MVP","#140c24","#fdb927"),miniSignTex("SHOWTIME","#180d2c","#fdb927"),miniSignTex("LOCK IN","#0c1828","#7ee7ff"),miniSignTex("AI-BA","#120d22","#b388ff")]
  };
  /* 场边站立死忠球迷区：位于近端底线后排走廊与四角入口，避免与两侧三排 VIP 席位重叠 */
  const slots=[
    [-8.4,COURT.nearBaseline-5.35,"filmer"],[-7.0,COURT.nearBaseline-5.45,"hype"],[-5.6,COURT.nearBaseline-5.32,"cheer"],[-4.2,COURT.nearBaseline-5.48,"heckler"],
    [-2.8,COURT.nearBaseline-5.30,"calm"],[-1.3,COURT.nearBaseline-5.52,"distract"],[1.3,COURT.nearBaseline-5.52,"cheer"],[2.8,COURT.nearBaseline-5.30,"calm"],
    [4.2,COURT.nearBaseline-5.48,"hype"],[5.6,COURT.nearBaseline-5.32,"filmer"],[7.0,COURT.nearBaseline-5.45,"heckler"],[8.4,COURT.nearBaseline-5.35,"player"],
    [-9.6,COURT.nearBaseline-1.85,"hype"],[9.6,COURT.nearBaseline-1.85,"distract"],
    [-9.9,COURT.nearBaseline-3.3,"cheer"],[9.9,COURT.nearBaseline-3.3,"filmer"]
  ];
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const max=mobile?10:16;
  slots.slice(0,max).forEach((s,i)=>{
    const pos=V3(s[0]+rnd(-.12,.12),0,s[1]+rnd(-.16,.16));
    const target=Math.abs(pos.x)>9.8?V3(0,0,Math.min(COURT.playMaxZ,pos.z+.45)):V3(0,0,HOOP.z+.9);
    const side=Math.abs(pos.x)>9.8,axis=side?V3(0,0,1):V3(1,0,0);
    makeNearCourtPerson(root,cube,{x:pos.x,z:pos.z,rot:faceTo(pos,target)+Math.PI,kind:s[2],skin:i%4,hair:(i*2)%5,shirt:(i*3)%9,
      pants:(i+1)%6,shoe:(i*5)%5,sign:i%4,scale:rnd(.82,.96),phase:rnd(0,Math.PI*2),amp:rnd(.7,1.2),
      axis,move:(s[2]==="hype"||s[2]==="distract"||s[2]==="filmer")?rnd(.08,.22):0},mats);
  });
  buildCourtsideVIPs(root,cube);
}
function triggerNearCourtCrowdReaction(kind,points){
  if(!nearCourtCrowd.root)return;
  const big=(points||0)>=5||kind==="final";
  if(kind==="miss"||kind==="oppMiss")nearCourtCrowd.miss=Math.max(nearCourtCrowd.miss,big?.95:.68);
  else nearCourtCrowd.reaction=Math.max(nearCourtCrowd.reaction,big?1:.76);
  nearCourtCrowd.last=kind||"make";
  const scorer=kind==="oppMake"||kind==="oppMiss"?1:0,miss=kind==="miss"||kind==="oppMiss";
  nearCourtCrowd.people.forEach((p,i)=>{
    p.responseStart=crowd.clock+.05+(Math.sin(p.phase*17+i)+1)*.25;
    p.responseDuration=2.0+p.amp;
    p.responseLinger=2.6+p.amp*1.2;
    p.responseSign=(p.team===scorer?1:-.42)*(miss?-.6:1);
  });
}
function updNearCourtCrowd(t,dt){
  if(!nearCourtCrowd.root)return;
  const hit=nearCourtCrowd.reaction,miss=nearCourtCrowd.miss,base=Math.max(hit*.84,G.cheer*.28),shock=miss*.85;
  nearCourtCrowd.people.forEach((p,i)=>{
    const wave=Math.sin(t*(2.5+p.amp*1.4)+p.phase),pulse=Math.max(0,Math.sin(t*(5.2+p.amp)+p.phase));
    const age=t-p.responseStart;
    let react=0;
    if(age>=0){
      if(age<p.responseDuration){
        react=Math.sin(age/p.responseDuration*Math.PI)*p.responseSign;
      }else if(age<p.responseDuration+(p.responseLinger||2.5)){
        const lingerProgress=(age-p.responseDuration)/(p.responseLinger||2.5);
        react=Math.cos(lingerProgress*Math.PI*0.5)*0.32*p.responseSign;
      }
    }
    if(p.staff){
      const sp=p.walkSpeed||0.75,rng=p.walkRange||0;
      const u=t*sp*0.35+p.phase;
      const ping=Math.sin(u);
      const vel=Math.cos(u);
      const walking=Math.abs(vel)>0.18&&rng>0;
      const off=ping*rng;
      p.g.position.set(p.base.x+p.walkAxis.x*off,p.baseY,p.base.z+p.walkAxis.z*off);
      const stride=walking?Math.sin(t*6.2+p.phase)*0.42:0;
      if(p.legs){p.legs[0].rotation.x=stride;p.legs[1].rotation.x=-stride;}
      if(p.staffRole==="security"){
        p.g.rotation.y=p.baseRot+Math.sin(t*0.8+p.phase)*0.45;
        p.arms[0].rotation.set(0.12,0,-0.08);p.arms[1].rotation.set(0.12,0,0.08);
      }else{
        const dirSign=vel>=0?1:-1;
        const moveYaw=Math.abs(p.walkAxis.x)>0.5?(dirSign>0?-Math.PI/2:Math.PI/2):(dirSign>0?Math.PI:0);
        p.g.rotation.y=rng>0.9?moveYaw:p.baseRot;
        if(p.staffRole==="waiter"){
          p.arms[0].rotation.set(-stride*0.5,0,-0.08);
          p.arms[1].rotation.set(1.22+Math.sin(t*3.2)*0.03,0,0.06);
        }else if(p.staffRole==="sweeper"){
          const sweep=Math.sin(t*4.5+p.phase)*0.12;
          p.arms[0].rotation.set(0.75+sweep,0,-0.12);
          p.arms[1].rotation.set(0.75-sweep,0,0.12);
        }else{
          p.arms[0].rotation.set(-stride*0.7,0,-0.08);
          p.arms[1].rotation.set(stride*0.7,0,0.08);
        }
      }
      return;
    }
    const move=p.seated?0:Math.sin(t*.55+p.phase)*p.move;
    p.g.position.set(p.base.x+p.axis.x*move,p.baseY||0,p.base.z+p.axis.z*move);
    const cheer=Math.max(0,react),taunt=Math.max(0,-react);
    if(p.baselineCrew){
      // 随机周期性切换动作状态（拍照/回看/聊天/休息/挥舞花球）
      p.stateTimer=(p.stateTimer||0)+dt;
      if(p.stateTimer>5.5+(p.phase%4.5)){
        p.stateTimer=0;
        const pool=p.crewRole==="photo"?["shoot","review","chill_sit","chat"]:(p.crewRole==="cheer"?["sit_cheer","sit_chill","hype"]:["chill","wave"]);
        p.state=pool[(Math.floor(t*13+i))%pool.length];
      }
      if(p.crewRole==="photo"){
        const st=cheer>0.25?"shoot":p.state;
        const pan=Math.sin(t*1.1+p.phase)*(st==="shoot"?0.20:(st==="chat"?0.32:0.06));
        p.g.rotation.y=p.baseRot+pan;
        if(st==="shoot"){
          p.arms[0].rotation.set(1.38+0.12*cheer,0,0.22);
          p.arms[1].rotation.set(1.48+0.12*cheer,0,-0.22);
          if(p.body)p.body.rotation.x=0.10;
        }else if(st==="review"){
          p.arms[0].rotation.set(0.85,0,0.16);
          p.arms[1].rotation.set(0.92,0,-0.18);
          if(p.body)p.body.rotation.x=0.16;
        }else if(st==="chat"){
          p.arms[0].rotation.set(0.55+Math.sin(t*3+p.phase)*0.18,0,-0.15);
          p.arms[1].rotation.set(0.55,0,0.12);
          if(p.body)p.body.rotation.x=-0.04;
        }else{
          p.arms[0].rotation.set(0.45,0,-0.10);
          p.arms[1].rotation.set(0.48,0,0.10);
          if(p.body)p.body.rotation.x=-0.05;
        }
      }else if(p.crewRole==="cheer"){
        const active=p.state==="hype"||p.state==="sit_cheer"||cheer>0.2;
        const w=Math.sin(t*(active?6.4:1.8)+p.phase);
        p.g.position.y=p.sitStyle==="stand"?Math.max(0,w)*(0.04+0.12*cheer):(cheer>0.4&&p.sitStyle==="kneel"?0.16*cheer:0);
        p.g.rotation.y=p.baseRot+Math.sin(t*1.4+p.phase)*(active?0.14:0.05);
        if(active){
          p.arms[0].rotation.set(0.65+0.95*cheer,0,-1.85+w*(0.42+0.25*cheer));
          p.arms[1].rotation.set(0.65+0.95*cheer,0,1.85-w*(0.42+0.25*cheer));
        }else{
          p.arms[0].rotation.set(0.55,0,-0.28+w*0.08);
          p.arms[1].rotation.set(0.55,0,0.28-w*0.08);
        }
        if(p.body)p.body.rotation.x=active?0.04:-0.05;
      }else if(p.crewRole==="mascot"){
        const hype=cheer>0.22||p.state==="wave";
        const bounce=Math.max(0,Math.sin(t*(hype?7.2:2.6)+p.phase));
        p.g.position.y=bounce*(hype?0.18*Math.max(0.4,cheer):0.03);
        p.g.rotation.y=p.baseRot+Math.sin(t*1.8+p.phase)*(hype?0.24:0.08);
        p.arms[0].rotation.set(0.35+0.4*cheer,0,-0.55-Math.sin(t*(hype?6.5:2.4)+p.phase)*(hype?0.65:0.18));
        p.arms[1].rotation.set(0.35+0.4*cheer,0,0.65+Math.sin(t*(hype?7.2:2.8)+p.phase)*(hype?0.75:0.22));
      }else if(p.crewRole==="niulai"){
        // 《牛来》专属“手搓低模”呆萌动作：平时呆滞微晃+偶发一顿一顿弹跳，进球激动甩蹄，投丢发抖
        const hype=cheer>0.20,scared=taunt>0.22;
        const stepT=Math.floor(t*4.5)/4.5; // 轻微帧率阶梯感致敬《牛来》魔性动画节奏
        const hop=Math.max(0,Math.sin(stepT*(hype?8.0:2.2)+p.phase));
        p.g.position.y=hop*(hype?0.20*Math.max(0.45,cheer):0.025);
        p.g.rotation.y=p.baseRot+Math.sin(stepT*1.6+p.phase)*(hype?0.26:0.07)+(scared?Math.sin(t*22)*0.08:0);
        p.arms[0].rotation.set(0.45+0.55*cheer,0,-0.45-Math.sin(stepT*(hype?7.0:2.0)+p.phase)*(hype?0.85:0.14));
        p.arms[1].rotation.set(0.45+0.55*cheer,0,0.45+Math.sin(stepT*(hype?7.0:2.0)+p.phase)*(hype?0.85:0.14));
      }
      return;
    }
    if(p.vip){
      const exc=p.excitement!=null?p.excitement:0.6;
      const ec=cheer*exc,et=taunt*exc;
      const stand=p.pose==="hyper"?Math.min(1,Math.max(0,ec*0.95+base*0.25)):0;
      p.g.position.y=(p.baseY||0)+(p.pose==="hyper"?stand*0.28:Math.max(0,ec)*0.035);
      p.g.rotation.y=p.baseRot+(p.yawOff||0)*(1-0.6*ec)+Math.sin(t*(p.pose==="chill"?0.6:1.3)+p.phase)*(p.pose==="chill"?0.012:0.032+0.045*ec);
      if(p.pose==="chill"){
        p.arms[0].rotation.set(0.32+0.15*ec,0,-0.14);
        p.arms[1].rotation.set(p.prop?0.85+0.12*ec:0.42+0.18*ec,0,0.12);
      }else if(p.pose==="hyper"){
        const jumpWave=Math.sin(t*7.2+p.phase)*0.32*(0.35+ec);
        p.arms[0].rotation.set(0.75+1.65*ec+jumpWave,0,-0.25-0.35*ec);
        p.arms[1].rotation.set(0.75+1.65*ec-jumpWave,0,0.25+0.35*ec);
      }else if(p.role==="fashion"||p.phone){
        p.arms[0].rotation.set(0.45+0.35*ec,0,-0.12-0.3*ec);
        p.arms[1].rotation.set(1.92+0.20*ec,0,-0.16-0.12*ec);
      }else if(p.role==="coach"){
        p.arms[0].rotation.set(0.55+0.55*ec,0,-0.10-0.25*ec);
        p.arms[1].rotation.set(0.95+0.25*Math.sin(t*2.4+p.phase)*0.25+0.35*ec,0,-0.16);
      }else if(p.pose==="social"){
        p.arms[0].rotation.set(0.52+0.35*ec+Math.sin(t*2.1+p.phase)*0.12,0,-0.14);
        p.arms[1].rotation.set(p.prop?0.88:0.62+0.4*ec,0,0.12);
      }else{
        const clap=Math.sin(t*4.8+p.phase)*0.16*(0.25+ec);
        p.arms[0].rotation.set(0.65+0.72*ec,0,-0.18+clap);
        p.arms[1].rotation.set(0.65+0.72*ec,0,0.18-clap);
      }
      if(p.body)p.body.rotation.x=(p.basePitch||0)+0.05*ec-0.04*et;
      if(p.realMesh)p.realMesh.rotation.x=(p.basePitch||0)+0.05*ec-0.04*et;
      return;
    }
    p.g.position.y=Math.max(0,wave)*(.012+.19*Math.max(0,react))*p.amp;
    p.g.rotation.y=p.baseRot+Math.sin(t*1.25+p.phase)*(.018+.055*base);
    if(!p.vip&&p.teamKey!==crowd.teamKey){
      if(p.kind==="hype"||p.kind==="heckler"||p.kind==="player"||(i%3===0&&p.kind!=="cheer")){
        const colors=p.body.geometry.attributes.color,c=new THREE.Color(recede(crowdTeams()[p.team],.32,.38)).convertSRGBToLinear();
        for(let j=0;j<Math.min(p.shirtVertCount||72,colors.count);j++)colors.setXYZ(j,c.r,c.g,c.b);
        colors.needsUpdate=true;
      }
      p.teamKey=crowd.teamKey;
    }
    if(p.kind==="filmer"){
      p.arms[0].rotation.z=-.14-.24*cheer+.18*taunt;
      p.arms[1].rotation.x=2.02+.18*cheer;
      p.arms[1].rotation.z=-.18-.12*cheer+.16*taunt;
      if(p.phone&&p.phone.parent===p.g)p.phone.position.y=1.3+.11*cheer-.04*taunt;
    }else if(p.kind==="heckler"){
      p.arms[0].rotation.z=-.22-.16*cheer+.22*taunt;
      p.arms[1].rotation.z=.22+.16*cheer-.22*taunt;
      p.arms[0].rotation.x=p.arms[1].rotation.x=2.30+.16*cheer;
      if(p.sign){p.sign.position.y=1.74+.12*taunt+.05*pulse;p.sign.rotation.z=Math.sin(t*4+p.phase)*(.035+.08*taunt);}
    }else if(p.kind==="cheer"){
      p.arms[0].rotation.z=-2.20+wave*(.45+.28*cheer);
      p.arms[1].rotation.z=2.20-wave*(.45+.28*cheer);
      if(p.poms[0]&&p.poms[0].parent===p.g)p.poms[0].position.y=1.3+Math.max(0,wave)*(.18+.16*cheer);
      if(p.poms[1]&&p.poms[1].parent===p.g)p.poms[1].position.y=1.3+Math.max(0,-wave)*(.18+.16*cheer);
    }else if(p.kind==="distract"){
      p.arms[0].rotation.z=-.08-.65*cheer+.28*taunt;
      p.arms[1].rotation.z=2.15+Math.sin(t*6+p.phase)*(.42+.24*cheer);
      p.arms[1].rotation.x=.25+.18*cheer;
      if(p.prop){
        p.prop.rotation.z=Math.sin(t*8+p.phase)*(.38+.24*base);
        if(p.prop.parent===p.g)p.prop.position.y=1.32+.15*cheer;
      }
    }else if(p.kind==="player"){
      p.arms[0].rotation.z=-.38-.26*cheer+.16*taunt;
      p.arms[1].rotation.z=.18+.42*cheer-.18*taunt;
      if(p.prop&&p.prop.parent===p.g)p.prop.position.y=1.05+.16*cheer+.04*Math.sin(t*3+p.phase);
    }else{
      p.arms[0].rotation.z=-.1-.68*cheer+.26*taunt;
      p.arms[1].rotation.z=.1+.68*cheer-.26*taunt;
      p.arms[0].rotation.x=.22*cheer-.10*taunt;
      p.arms[1].rotation.x=.22*cheer-.10*taunt;
    }
    /* 身体已烘焙成整块:以脚为轴做等效的轻微前倾/后仰(系数减半补偿更长的力臂) */
    if(p.body)p.body.rotation.x=-.012*cheer+.05*taunt;
  });
  nearCourtCrowd.reaction=Math.max(0,nearCourtCrowd.reaction-dt*1.25);
  nearCourtCrowd.miss=Math.max(0,nearCourtCrowd.miss-dt*1.15);
}

/* outdoor street crowd: lightweight people around fences, benches and park edges */
const streetCrowd={root:null,people:[],reaction:0,miss:0,last:"idle"};
function resetStreetCrowd(){
  streetCrowd.root=null;
  streetCrowd.people.length=0;
  streetCrowd.reaction=0;streetCrowd.miss=0;streetCrowd.last="idle";
}
function makeStreetBench(parent,cube,mat,x,z,rot,y){
  const g=new THREE.Group();
  const seat=showBox(g,cube,mat,0,.36,0,1.45,.18,.42);
  const back=showBox(g,cube,mat,0,.72,.22,1.45,.55,.12);
  showBox(g,cube,mat,-.58,.17,-.12,.12,.34,.12);
  showBox(g,cube,mat,.58,.17,-.12,.12,.34,.12);
  seat.castShadow=back.castShadow=false;
  g.position.set(x,y||0,z);g.rotation.y=rot;parent.add(g);
  return g;
}
function makeStreetPerson(parent,cube,cfg,materials){
  const g=new THREE.Group(),skin=materials.skin[cfg.skin%materials.skin.length],hair=materials.hair[cfg.hair%materials.hair.length];
  const school=cfg.place==="shonanCoast",girl=school&&cfg.index%2===1;
  const shirt=school?materials.shirts[cfg.index%4===0?1:0]:cfg.place==="beachSunset"&&cfg.index%4===0?skin:materials.shirts[cfg.shirt%materials.shirts.length],pants=school?materials.pants[0]:materials.pants[cfg.pants%materials.pants.length];
  const shoe=materials.shoes[cfg.shoe%materials.shoes.length],phone=materials.phone,ballMat=materials.ball;
  const seated=cfg.kind==="bench",scale=cfg.scale||1,coast=cfg.place==="beachSunset",rain=cfg.place==="rainyCourt",village=cfg.place==="flowerCourt",winter=cfg.place==="arcticSnow",spanish=cfg.place==="spanishQuarter";
  const bodyY=seated?.76:.92,headY=seated?1.22:1.48;
  const shoulderX=(rain||winter?.48:coast?.36:.42)/2+.025,shoulderY=seated?1.0:1.22;
  /* 与近场观众同样处理:躯干/头/帽/腿/脚烘焙成单块身体,坐姿的腿脚固定角度直接烘进
     几何体;原本 ±5° 的呼吸式微动改为整体轻微前倾。手臂/手机/球仍独立驱动。 */
  const legY=seated?.34:.38,legZ=seated?-.2:0,legH=seated?.42:.64;
  const bodyMat=(pos,scale,rotX)=>new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0],pos[1],pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX||0,0,0)),
    new THREE.Vector3(scale[0],scale[1],scale[2]));
  const body=bakeVoxelMesh(g,[
    {color:shirt.color,matrix:bodyMat([0,bodyY-(rain||winter?.06:0),0],[rain||winter?.48:coast?.36:.42,seated?.55:rain||winter?.9:.72,winter?.33:.25])},
    {color:skin.color,matrix:bodyMat([0,headY,-.02],[.31,.31,.28])},
    {color:hair.color,matrix:bodyMat([0,headY+.18,-.03],[.34,.12,.3])},
    {color:skin.color,matrix:bodyMat([0,headY-.18,-.02],[.11,.11,.12])},
    {color:(coast||girl?skin:pants).color,matrix:bodyMat([-.13,legY,legZ],[.13,legH,.13],seated?1.15:0)},
    {color:(coast||girl?skin:pants).color,matrix:bodyMat([.13,legY,legZ],[.13,legH,.13],seated?1.15:0)},
    {color:shoe.color,matrix:bodyMat([-.13,.08,seated?-.44:-.04],[.18,.11,.24],seated?.25:0)},
    {color:shoe.color,matrix:bodyMat([.13,.08,seated?-.44:-.04],[.18,.11,.24],seated?.25:0)},
    {color:phone.color,matrix:bodyMat([-.069,headY+.015,-.168],[.035,.034,.013])},
    {color:phone.color,matrix:bodyMat([.069,headY+.015,-.168],[.035,.034,.013])},
    {color:skin.color,matrix:bodyMat([0,headY-.047,-.175],[.039,.047,.036])}
  ]);
  // Rotate at the shoulder rather than the middle of a floating arm.
  const armAt=side=>{const rig=new THREE.Group();rig.position.set(side*shoulderX,shoulderY,-.02);g.add(rig);showBox(rig,cube,skin,0,-.22,0,.1,.48,.11);return rig;};
  const armL=armAt(-1),armR=armAt(1);
  armL.rotation.z=seated?-.22:-.08;armR.rotation.z=seated?.22:.08;
  let phoneMesh=null,ball=null,life=null;
  const drinking=coast&&(cfg.kind==="quiet"||cfg.kind==="bench");
  if(cfg.kind==="filmer"||(cfg.kind==="quiet"&&!drinking)){
    phoneMesh=showBox(armR,cube,phone,0,-.43,-.055,.13,.20,.035);
    armR.rotation.x=-.9;armR.rotation.z=-.35;
  }else if(cfg.kind==="player"){
    ball=showBox(armL,cube,ballMat,0,-.43,-.11,.22,.22,.22);
    armL.rotation.z=-.55;
  }
  if(cfg.place){
    if(school){
      const uniformParts=[],piece=(color,x,y,z,w,h,d)=>uniformParts.push({color,matrix:bodyMat([x,y,z],[w,h,d])});
      const navy=materials.pants[0].color,white=materials.shirts[0].color,accent=materials.shirts[2].color;
      piece(navy,0,1.21,-.145,.28,.11,.025);piece(white,0,1.24,-.164,.2,.035,.015);
      piece(accent,0,1.1,-.153,.044,.2,.026);
      if(girl){piece(navy,0,.59,0,.49,.29,.29);piece(hair.color,0,1.42,.12,.33,.34,.11);}
      for(const side of [-1,1]){piece(white,side*.13,.21,-.005,.145,.24,.145);piece(navy,side*.13,.07,-.04,.19,.1,.25);}
      if(cfg.index%5===0){piece(navy,0,.98,.19,.32,.38,.13);for(const side of [-1,1])piece(navy,side*.145,1.1,-.14,.035,.28,.02);}
      bakeVoxelMesh(g,uniformParts).name=girl?"schoolUniformSkirt":"schoolUniformTrousers";
    }
    if(winter){
      const trim=materials.shirts[(cfg.shirt+2)%8];
      showBox(g,cube,shirt,0,headY+.17,-.02,.36,.17,.32);
      showBox(g,cube,trim,0,headY+.09,-.025,.38,.06,.34);
      showBox(g,cube,trim,0,1.28,-.025,.43,.12,.34);showBox(g,cube,trim,.13,1.08,-.19,.11,.3,.055);
      for(let side of [-1,1]){showBox(g,cube,shirt,side*.31,1.04,0,.18,.43,.27);showBox(g,cube,pants,side*.34,.82,-.02,.13,.15,.15);showBox(g,cube,pants,side*.13,.14,-.04,.2,.21,.25);}
    }
    if(spanish){
      for(let side of [-1,1])showBox(g,cube,materials.shirts[5],side*.285,1.11,0,.17,.07,.27);
      showBox(g,cube,materials.shirts[5],0,1.22,-.15,.05,.18,.018);
      if(cfg.index%4===0)showBox(g,cube,pants,0,headY+.19,-.035,.4,.075,.33);
    }
    // Sleeves and a contrasting hem read as local casual clothes, not team uniforms.
    if(!coast)for(let side of [-1,1])showBox(g,cube,shirt,side*.285,seated?.88:rain?1.04:1.16,0,.16,rain?.42:.2,.26);
    showBox(g,cube,pants,0,seated?.52:.61,-.005,.43,.065,.26);
    if(village){
      for(let j=0;j<4;j++)for(let y of [.76,.9])showBox(g,cube,materials.shirts[(cfg.shirt+3)%8],-.15+j*.1,y,-.134,.06,.045,.015);
      if(cfg.index%3===0){showBox(g,cube,materials.shirts[0],0,headY+.22,-.02,.53,.06,.45);showBox(g,cube,materials.shirts[0],0,headY+.27,-.02,.33,.13,.31);}
    }
    if(coast){
      const details=[],piece=(c,x,y,z,w,h,d)=>details.push({color:c,matrix:bodyMat([x,y,z],[w,h,d])});
      if(cfg.index%3===0){
        const gold=new THREE.Color(0xd6b65b);for(let j=0;j<7;j++)piece(gold,-.12+j*.04,1.2-Math.sin(j/6*Math.PI)*.13,-.148,.044,.032,.018);
      }
      if(details.length)bakeVoxelMesh(g,details).name="beachAccessories";
      for(let side of [-1,1])showBox(g,cube,pants,side*.13,seated?.4:.54,seated?-.19:0,.17,.27,.19);
      if(cfg.index%3===0){showBox(g,cube,materials.shirts[3],0,headY+.23,-.07,.5,.05,.48);showBox(g,cube,materials.shirts[3],0,headY+.28,-.03,.31,.12,.3);}
      if(cfg.index%2===0)for(let side of [-1,1])showBox(g,cube,phone,side*.08,headY+.025,-.167,.12,.06,.025);
    }
    if(cfg.place==="outdoorSunny"&&cfg.index%4===0){
      showBox(g,cube,shirt,0,headY+.22,-.03,.35,.09,.32);showBox(g,cube,shirt,0,headY+.17,-.22,.32,.035,.2);
      showBox(g,cube,pants,0,.98,.21,.3,.38,.15);
    }
    if(rain&&cfg.index%3!==1&&cfg.kind!=="bench"){
      showBox(g,cube,phone,.4,1.58,-.08,.025,.95,.025);
      const umbrella=new THREE.Mesh(new THREE.ConeGeometry(.64,.24,8),shirt);umbrella.position.set(.35,2.09,-.04);g.add(umbrella);
    }
  }
  if(drinking){
    armR.visible=false;
    const upper=showBox(g,cube,skin,0,0,0,.105,1,.115),lower=showBox(g,cube,skin,0,0,0,.10,1,.11);
    const cup=new THREE.Group();cup.name="heldDrink";g.add(cup);
    showBox(cup,cube,materials.shirts[3],0,0,0,.17,.18,.16);
    showBox(cup,cube,materials.shirts[0],.012,.165,.025,.019,.21,.019);
    const hand=showBox(cup,cube,skin,.10,-.02,0,.075,.1,.085);
    const mouth=showBox(g,cube,materials.mouth,0,headY-.08,-.171,.043,.016,.008);
    life={type:"drink",cup,hand,upper,lower,mouth,mouthHeight:mouth.scale.y,headY,shoulder:V3(shoulderX,shoulderY,-.02),rest:V3(.4,seated?.85:1.02,-.17),phase:cfg.phase,amount:0};
  }
  /* cfg.y:场地有了真实高差(抬高的人行道、台阶、露台)之后,
     观众必须站在那个面上,不能一律钉在 y=0 —— 否则脚会陷进人行道里。 */
  g.position.set(cfg.x,cfg.y||0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(scale);
  parent.add(g);
  streetCrowd.people.push({g,body,arms:[armL,armR],phone:phoneMesh,ball,life,kind:cfg.kind,
    baseY:g.position.y,baseRot:cfg.rot,phase:cfg.phase,amp:cfg.amp||1});
}
function buildStreetCrowd(opts){
  resetStreetCrowd();
  const place=opts&&opts.place,localRandom=place?AIBAWorldPlaces.rng(831771+Object.keys(AIBAWorldPlaces.palettes).indexOf(place)*97):null;
  const srnd=(a,b)=>localRandom?a+localRandom()*(b-a):rnd(a,b);
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const root=new THREE.Group();root.name="streetCrowdRoot";environmentRoot.add(root);streetCrowd.root=root;
  const cube=new THREE.BoxGeometry(1,1,1);
  const mat=hex=>new THREE.MeshLambertMaterial({color:hex});
  const materials={
    skin:[mat(0xf4c89c),mat(0xd9a066),mat(0x8d5524),mat(0x5f351f)],
    hair:[mat(0x1b1210),mat(0x3a2518),mat(0xe7d9a8),mat(0x101018)],
    shirts:[mat(0xffc72c),mat(0x1d428a),mat(0xce1141),mat(0x007a33),mat(0xffffff),mat(0x212734),mat(0xff6b5b),mat(0x63d7ff)],
    pants:[mat(0x181b24),mat(0x273b59),mat(0x6e727b),mat(0x0d3527),mat(0xffffff)],
    shoes:[mat(0xffffff),mat(0x111111),mat(0xff4d6d),mat(0x68e6ff)],
    phone:mat(0x07131f),mouth:mat(0x502c29),
    ball:new THREE.MeshLambertMaterial({color:0xf28b22,emissive:0x9a3d00,emissiveIntensity:.08}),
    /* 长椅材质跟着场地走:老街是石凳,雨巷是深色木凳,不再一律蓝漆铁椅。 */
    bench:mat(opts&&opts.beach?0x6d5341:place==="spanishQuarter"?0xb3a488:place==="rainyCourt"?0x4a3a2c:0x27506a)
  };
  if(place){materials.shirts.forEach(m=>m.dispose());materials.shirts=(place==="shonanCoast"?[0xe7e7d8,0x26394f,0x88403f,0xd7dbd3,0xe1e3d7,0x24374b,0xededdf,0x353e50]:AIBAWorldPlaces.palettes[place].shirts).map(mat);root.userData.place=place;root.userData.random=localRandom;root.userData.clock=0;}
  const benchDefs=place==="arcticSnow"?[[11.5,9,-Math.PI/2]]:place==="shonanCoast"?[]:place==="rainyCourt"?[[-12.55,-4.4,Math.PI/2,.19],[-12.55,-2.5,Math.PI/2,.19]]:place==="spanishQuarter"?[[-12.35,-7,Math.PI/2,.19],[-12.35,-2.2,Math.PI/2,.19]]:opts&&opts.beach?[[-11.7,-4.8,Math.PI/2],[11.7,3.2,-Math.PI/2],[-6.2,21.8,Math.PI]]:[[-11.4,-5.2,Math.PI/2],[11.4,-1.5,-Math.PI/2],[-5.8,21.6,Math.PI],[5.8,21.6,Math.PI]];
  benchDefs.forEach(b=>makeStreetBench(root,cube,materials.bench,b[0],b[1],b[2],b[3]||0));
  let spots=[
    [-11.45,-8.1,"filmer"],[-11.35,-5.4,"bench"],[-11.55,-2.4,"fan"],[-11.45,1.2,"fan"],[-11.5,4.6,"player"],[-11.4,8.1,"filmer"],[-11.55,12.2,"fan"],[-11.35,16.4,"bench"],
    [11.45,-7.2,"fan"],[11.35,-3.1,"player"],[11.5,.6,"filmer"],[11.45,4.2,"fan"],[11.55,8.7,"bench"],[11.35,13.4,"fan"],[11.45,17.8,"filmer"],
    [-8.1,22.0,"fan"],[-5.4,22.35,"bench"],[-2.4,22.05,"filmer"],[.6,22.28,"fan"],[3.4,22.05,"player"],[6.2,22.35,"bench"],[8.6,22.0,"fan"],
    [-14.2,2.6,"passer"],[14.3,6.8,"passer"],[-15.0,14.4,"fan"],[15.2,15.6,"fan"]
  ];
  if(place){
    const layouts={
      arcticSnow:[[-7.9,-11.5,"fan"],[6.4,-12.2,"filmer"],[11.5,9,"bench"],[-11.6,5.4,"quiet"],[10.8,-3,"player"],[12.8,15.3,"passer"]],
      /* 老街:邻居坐在树下石凳、咖啡店门口站着人、拱道口有人穿过、阳台上有人探头
         (阳台的人在 world-wonders 里)。人群跟着节点走,不沿边线排队(计划 §2.4/§B)。 */
      spanishQuarter:[[-12.35,-7,"bench"],[-12.35,-2.2,"bench"],[-12.3,-5,"quiet",.19],[-12.4,.6,"fan",.19],
        [-12.3,5,"player",.19],[-12.4,11.4,"fan",.19],[-12.3,16.2,"quiet",.19],[-15.4,8,"passer"],
        [12.4,-7.4,"fan",.19],[12.35,-3.8,"filmer",.19],[12.4,2.4,"player",.19],[12.3,9.6,"fan",.19],[12.4,14.8,"quiet",.19],
        [-2.6,-13.4,"fan"],[1.2,-13.8,"filmer"],[3.4,-13.2,"quiet"],[15.4,-2.7,"passer"],[4.05,-19.8,"passer"]],
      outdoorSunny:[[-7.5,-11.4,"filmer"],[-6.4,-11.7,"fan"],[-4.2,-12,"player"],[4.7,-11.8,"fan"],[6,-12.1,"filmer"],[8,-11.5,"fan"],[-10.3,-4,"fan"],[-11.3,-5.3,"bench"],[11,-6,"player"],[12,-4.8,"fan"],[-10.6,2,"filmer"],[11.6,1.5,"quiet"],[-12,8,"fan"],[11,8.5,"fan"],[-11,15,"filmer"],[11,16,"player"],[-6,21.8,"bench"],[5.8,21.8,"bench"],[8,22,"fan"],[-14.2,2.6,"passer"],[14.3,6.8,"passer"],[14.3,13,"passer"],[-13.7,11,"quiet"],[3,22,"filmer"]],
      /* 雨巷:人集中在能避雨的地方 —— 檐下人行道(抬高 0.19)、小店门口、自行车棚,
         巷子里只有一个撑伞走过的人。不沿边线均匀排队(计划 §2.4)。 */
      rainyCourt:[[-12.55,-4.4,"bench"],[-12.55,-2.5,"bench"],[-12.5,-6.5,"fan",.19],[-12.45,-8.6,"quiet",.19],
        [-12.5,-.4,"filmer",.19],[-11.7,-11.5,"passer"],[-12.5,10.2,"fan",.19],[-12.4,14.8,"quiet",.19],
        [12.5,-8.8,"player",.19],[12.55,-6.2,"fan",.19],[12.45,3.6,"quiet",.19],[12.5,8.2,"fan",.19],[12.6,16.4,"passer",.19],
        [-3.4,-14.5,"fan"],[1.5,-14.4,"filmer"],[4.5,-20.4,"passer"]],
      flowerCourt:[[-7.8,-11.6,"fan"],[-6.3,-12,"player"],[-4.5,-12.2,"fan"],[5.9,-12,"quiet"],[7,-11.5,"fan"],[-10,-3,"player"],[-11.2,-5.2,"bench"],[10.2,-1.5,"fan"],[11.1,-.4,"fan"],[-10.7,7,"quiet"],[-11.8,8.1,"fan"],[10.6,9.3,"player"],[-10.1,15.4,"filmer"],[11,16.5,"fan"],[-5.8,21.6,"bench"],[5.8,21.6,"bench"],[-14,11,"passer"],[14,14,"passer"]],
      /* 校园那侧(+x)靠铁丝网站着看,海那侧(-x)只有零星路过的人 —— 
         人群分布本身也在讲"一侧校园一侧海"。 */
      /* 村落那侧(+x)沿石阶站着看,崖边(-x)只有零星倚墙的人 —— 崖沿不站人。 */
      medCliff:[[9.9,-8.2,"fan"],[10.3,-3.6,"quiet"],[10.1,1.4,"fan"],[10.4,6.2,"filmer"],[10,11.5,"player"],
        [-10.4,-4.8,"quiet"],[-10.8,3.2,"passer"],[-10.2,11,"fan"],
        [-4.4,-15.8,"filmer"],[3.2,-16.2,"fan"],[-2.6,26.8,"quiet"],[5.4,27.2,"passer"],[8.2,20.4,"fan"]],
      /* 湘南改版后海岸带在篮筐后方:人集中在朝海的人行道(抬高 .19)、校门口和自行车棚,
         两条长椅朝海坐着看电车经过。+z 端超过铁丝网(z=26)的位置收回来。 */
      shonanCoast:[[9.4,-9.5,"fan"],[9.6,-5.2,"player"],[9.3,-1,"quiet"],[9.7,3.4,"fan"],[9.4,7.8,"filmer"],[9.6,12,"fan"],
        [-9.8,-6.4,"quiet"],[-10.2,1.2,"passer"],[-9.9,8.6,"fan"],
        [-5.6,-13.98,"bench"],[-3.3,-13.98,"bench"],
        [-7.6,-14.3,"fan",.19],[4.8,-14.3,"filmer",.19],[1.4,-14.3,"quiet",.19],
        [-11.5,.4,"passer"],[-11.3,9.6,"player"],[-1.5,23.6,"quiet"],[3.6,23.8,"fan"]],
      beachSunset:[[-8.9,-13.6,"passer"],[-7.7,-13.4,"passer"],[-5.2,-12.7,"player"],[5.9,-13,"filmer"],[7.2,-13.5,"quiet"],[-11.8,-4.8,"bench"],[-12.5,-3.4,"quiet"],[11,-1,"fan"],[12.2,-.3,"player"],[11.7,3.2,"bench"],[-13,7,"passer"],[-14.2,8,"passer"],[12.4,11,"quiet"],[11.4,12,"fan"],[-10.8,16,"filmer"],[-6.2,21.8,"bench"],[6.4,22,"quiet"],[13.9,17,"passer"],[14.7,18,"passer"]]
    };spots=layouts[place];
    if(place==="shonanCoast"){
      spots=[];
      // Dense, staggered students wrap the playing half; retain full mobile rows.
      // The baseline front row occasionally steps over the painted boundary.
      for(let row=0;row<3;row++){
        for(let i=0;i<27;i++){
          const x=-7.9+i*.61+(row%2)*.25;
          const z=-9.65-row*.65+.22*Math.sin(i*1.8+row);
          spots.push([x,z,i%9===0?"filmer":i%6===0?"quiet":"fan"]);
        }
        for(const side of [-1,1])for(let i=0;i<(mobile?16:20);i++){
          spots.push([side*(9.5+row*.6+.13*Math.sin(i*1.7+row)),-8.8+i*.65+(row%2)*.3,i%9===0?"filmer":i%5===0?"quiet":"fan"]);
        }
      }
    }
    if(place==="beachSunset")spots.push([-9.6,-15.8,"quiet"],[-11.6,-15.9,"quiet"],[-8,-15.7,"fan"],[10.5,-17,"quiet"]);
  }
  const max=place?(place==="shonanCoast"?spots.length:mobile?Math.ceil(spots.length*.75):spots.length):(mobile?16:26),center=V3(0,0,COURT.midZ);
  let seatedIndex=0;
  spots.slice(0,max).forEach((s,i)=>{
    const tight=place==="shonanCoast",jitterX=srnd(tight?-.12:-.45,tight?.12:.45),jitterZ=srnd(tight?-.12:-.55,tight?.12:.55),pos=V3(s[0]+jitterX,s[3]||0,s[1]+jitterZ);
    let kind=s[2],rot=faceTo(pos,place==="shonanCoast"?V3(0,0,-4):center)+Math.PI;
    if(place&&kind==="bench"){
      const seat=benchDefs[seatedIndex++];if(seat){pos.set(seat[0],seat[3]||0,seat[1]);rot=seat[2];}else kind="fan";
    }
    makeStreetPerson(root,cube,{x:pos.x,y:pos.y,z:pos.z,rot,kind,place,index:i,skin:i%4,hair:(i*2)%4,shirt:(i*3+(opts&&opts.rainy?1:0))%8,
      pants:(i+2)%5,shoe:(i*5)%4,scale:srnd(.86,1.08),phase:srnd(0,Math.PI*2),amp:srnd(.72,1.2)},materials);
    if(place){const p=streetCrowd.people[streetCrowd.people.length-1],hype=kind==="fan"&&(place==="outdoorSunny"?i%2===1:place==="flowerCourt"?i%3===1:i%7===0);
      p.interest=kind==="passer"?0:kind==="quiet"?.08:hype?.98:kind==="bench"?.25:.55;
      p.energy=hype?1:.25+localRandom()*.35;p.pendingAt=Infinity;p.response=0;p.responseSign=1;p.origin=pos.clone();p.baseY=pos.y;}
  });
  // Pair adjacent quiet viewers. They face one another briefly and return to the game.
  const paired=new Set();
  streetCrowd.people.forEach((p,i)=>{
    if(p.life||paired.has(i)||!['quiet','fan'].includes(p.kind))return;
    const j=streetCrowd.people.findIndex((q,j)=>j>i&&!q.life&&!paired.has(j)&&['quiet','fan'].includes(q.kind)&&p.g.position.distanceTo(q.g.position)<2.3);
    if(j<0)return;const q=streetCrowd.people[j];paired.add(i);paired.add(j);
    for(const [person,partner,turn] of [[p,q,0],[q,p,1]]){
      const mouth=showBox(person.g,cube,materials.mouth,0,1.4,-.173,.047,.014,.009);
      person.chat={partner,mouth,mouthHeight:mouth.scale.y,turn,phase:i*.73,amount:0};
    }
  });
}
function updateStreetLife(p,t){
  if(p.life){
    const l=p.life,u=(t+l.phase*2)%15,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
    const amount=u<2?smooth(u/2):u<3.6?1:u<5.5?1-smooth((u-3.6)/1.9):0;l.amount=amount;
    const target=V3(.01,l.headY-.35,-.21),center=l.rest.clone().lerp(target,amount);l.cup.position.copy(center);
    l.mouth.scale.y=l.mouthHeight*(1+amount*.55);
    const wrist=center.clone().add(V3(.1,-.02,0)),axis=wrist.clone().sub(l.shoulder),d=axis.length();axis.normalize();
    const pole=V3(1,-1,0).addScaledVector(axis,-V3(1,-1,0).dot(axis)).normalize();
    const elbow=l.shoulder.clone().add(wrist).multiplyScalar(.5).addScaledVector(pole,Math.sqrt(Math.max(0,.29*.29-d*d/4)));
    for(const [mesh,a,b] of [[l.upper,l.shoulder,elbow],[l.lower,elbow,wrist]]){
      const v=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=v.length();mesh.quaternion.setFromUnitVectors(V3(0,1,0),v.normalize());
    }
    // The cup has priority over an event; its owner stays grounded and does not teleport the prop.
    p.g.position.y=p.origin.y;p.body.rotation.x=0;
  }
  if(p.chat){
    const c=p.chat,u=(t+c.phase)%18,active=u>5&&u<11&&!p.response;
    const envelope=active?Math.min(1,u-5,11-u):0;c.amount=envelope;
    let angle=faceTo(p.g.position,c.partner.g.position)+Math.PI-p.baseRot;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    p.g.rotation.y=p.baseRot+angle*envelope*.72;
    const speaking=active&&((u<8?0:1)===c.turn);
    c.mouth.scale.y=c.mouthHeight*(speaking?1+Math.max(0,Math.sin(t*12+c.phase))*1.1:1);
    if(speaking){p.arms[0].rotation.x=-.35-.14*Math.sin(t*3);p.arms[0].rotation.z=-.22-.15*Math.sin(t*2);}
  }
}
function triggerStreetCrowdReaction(kind,points){
  triggerArenaCrowdReaction(kind,points);
  triggerNearCourtCrowdReaction(kind,points);
  if(!streetCrowd.root||(SCENE_PRESETS[currentScenePreset]||{}).type!=="outdoor")return;
  const big=(points||0)>=5||kind==="final";
  if(streetCrowd.root.userData.place){
    const state=streetCrowd.root.userData,random=state.random;
    streetCrowd.people.forEach(p=>{if(random()<p.interest){p.pendingAt=state.clock+.08+random()*.85;p.pendingStrength=(big?1:.65)*p.energy;p.responseSign=(kind==="miss"||kind==="oppMiss")?-1:1;}});
    streetCrowd.last=kind||"make";return;
  }
  if(kind==="miss"||kind==="oppMiss")streetCrowd.miss=Math.max(streetCrowd.miss,big?.9:.62);
  else streetCrowd.reaction=Math.max(streetCrowd.reaction,big?1:.72);
  streetCrowd.last=kind||"make";
}
function updStreetCrowd(t,dt){
  if(!streetCrowd.root)return;
  if(streetCrowd.root.userData.place){
    const state=streetCrowd.root.userData;state.clock+=dt;
    streetCrowd.people.forEach(p=>{
      if(state.clock>=p.pendingAt){p.response=Math.max(p.response,p.pendingStrength);p.pendingAt=Infinity;}
      p.response=Math.max(0,p.response-dt*.38);const wave=Math.sin(state.clock*(3+p.amp)+p.phase),cheer=p.response*Math.max(0,p.responseSign),shock=p.response*Math.max(0,-p.responseSign);
      const active=p.interest>.9,base=active?.08*(.5+.5*Math.sin(state.clock*.7+p.phase)):0;
      p.g.position.copy(p.origin);p.g.position.y=p.origin.y+(p.kind==="bench"?0:Math.max(0,wave)*(base+cheer*.16));
      p.g.rotation.y=p.baseRot+Math.sin(state.clock*.6+p.phase)*.025;
      p.arms[0].rotation.set(-.12*cheer,-0,-.08-.8*(cheer+base)+.22*shock);
      p.arms[1].rotation.set(-.12*cheer,0,.08+.8*(cheer+base)-.22*shock);
      if(p.kind==="filmer"||p.kind==="quiet"){p.arms[1].rotation.x=p.kind==="quiet"?1.1:1.5;p.arms[1].rotation.z=-.35;if(p.phone&&p.phone.parent===p.g)p.phone.position.y=(p.kind==="quiet"?1.05:1.23)+cheer*.04;}
      if(p.kind==="player"){p.arms[0].rotation.z=-.55;if(p.ball&&p.ball.parent===p.g)p.ball.position.y=1.04;}
      if(p.kind==="passer"){
        // Stroll along the apron, with pauses; never enter the active court.
        const phase=state.clock*.12+p.phase;p.g.position.z=p.origin.z+Math.sin(phase)*3;p.g.rotation.y=Math.cos(phase)>0?Math.PI:0;
        p.arms[0].rotation.x=Math.sin(state.clock*3+p.phase)*.15;p.arms[1].rotation.x=-p.arms[0].rotation.x;
      }
      if(p.body)p.body.rotation.x=-cheer*.025+shock*.035;
      updateStreetLife(p,state.clock);
    });return;
  }
  const hit=streetCrowd.reaction,miss=streetCrowd.miss,base=Math.max(hit*.8,G.cheer*.22),shock=miss*.8;
  streetCrowd.people.forEach((p,i)=>{
    const s=Math.sin(t*(3.2+p.amp*1.8)+p.phase),bounce=Math.max(0,s)*(.08+.16*base)*p.amp;
    p.g.position.y=p.baseY+bounce+(p.kind==="passer"?Math.sin(t*.75+p.phase)*.03:0);
    p.g.rotation.y=p.baseRot+Math.sin(t*1.6+p.phase)*(.025+.055*base);
    const cheer=base*(.7+.3*Math.sin(p.phase+i)),missPose=shock*(.85+.15*Math.cos(p.phase));
    if(p.kind==="filmer"){
      p.arms[0].rotation.z=-.2-.45*cheer+.32*missPose;
      p.arms[1].rotation.x=-.9-.35*cheer;
      p.arms[1].rotation.z=-.35-.38*cheer+.45*missPose;
      if(p.phone&&p.phone.parent===p.g)p.phone.position.y=1.23+.18*cheer-.05*missPose;
    }else if(p.kind==="player"){
      p.arms[0].rotation.z=-.55-.55*cheer+.35*missPose;
      p.arms[1].rotation.z=.12+.5*cheer-.3*missPose;
      if(p.ball&&p.ball.parent===p.g)p.ball.position.y=1.04+.22*cheer;
    }else{
      p.arms[0].rotation.z=-.12-.85*cheer+.45*missPose;
      p.arms[1].rotation.z=.12+.85*cheer-.45*missPose;
      p.arms[0].rotation.x=-.25*cheer+.18*missPose;
      p.arms[1].rotation.x=-.25*cheer+.18*missPose;
    }
    /* 身体已烘焙成整块:以脚为轴做等效的轻微前倾(系数减半补偿更长的力臂) */
    if(p.body)p.body.rotation.x=p.kind==="bench"?(-.03-.05*cheer+.06*missPose):0;
  });
  streetCrowd.reaction=Math.max(0,streetCrowd.reaction-dt*1.35);
  streetCrowd.miss=Math.max(0,streetCrowd.miss-dt*1.2);
}


window.AIBA.runtime.register("rendering:spectators",Object.freeze({
  buildNearCourtCrowd,triggerNearCourtCrowdReaction,updNearCourtCrowd,
  resetStreetCrowd,buildStreetCrowd,triggerStreetCrowdReaction,updStreetCrowd
}));
