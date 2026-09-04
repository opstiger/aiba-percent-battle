/* ---------------- scene presets ---------------- */
let rainState=null;
function disposeEnvironmentRoot(root){
  const geometries=new Set(),materials=new Set();
  root.traverse(o=>{
    if(o.geometry&&o.geometry.dispose)geometries.add(o.geometry);
    if(o.material){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{if(m)materials.add(m);});
    }
  });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>{if(m.map&&m.map.dispose)m.map.dispose();if(m.dispose)m.dispose();});
  while(root.children.length)root.remove(root.children[0]);
  root.userData={};
}
function buildOutdoorPark(rainy,flower){
  const grassColor=flower?0x626b55:(rainy?0x4d6650:0x5f8b49);
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(90,110),new THREE.MeshLambertMaterial({color:grassColor}));
  grass.rotation.x=-Math.PI/2;grass.position.set(0,-0.07,5);environmentRoot.add(grass);
  environmentRoot.userData.grassMaterial=grass.material;

  const fenceMat=new THREE.MeshLambertMaterial({color:0x89979c});
  const postGeo=new THREE.BoxGeometry(0.09,2.7,0.09);
  const postPos=[];
  for(let z=-10;z<=20;z+=3){postPos.push([-10.2,z],[10.2,z]);}
  for(let x=-8;x<=8;x+=3.2){postPos.push([x,-10],[x,20]);}
  const posts=new THREE.InstancedMesh(postGeo,fenceMat,postPos.length),dummy=new THREE.Object3D();
  postPos.forEach((p,i)=>{dummy.position.set(p[0],1.35,p[1]);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);});
  posts.instanceMatrix.needsUpdate=true;environmentRoot.add(posts);
  [[-10.2,.72,5,.06,.06,30],[10.2,.72,5,.06,.06,30],[-10.2,1.65,5,.06,.06,30],[10.2,1.65,5,.06,.06,30],
   [0,.72,-10,20.4,.06,.06],[0,1.65,-10,20.4,.06,.06],[0,.72,20,20.4,.06,.06],[0,1.65,20,20.4,.06,.06]].forEach(d=>{
    const rail=new THREE.Mesh(new THREE.BoxGeometry(d[3],d[4],d[5]),fenceMat);
    rail.position.set(d[0],d[1],d[2]);environmentRoot.add(rail);
  });

  const treePos=[[-14,-8],[-14,-1],[-14,7],[-14,15],[14,-7],[14,1],[14,9],[14,17],[-8,28],[-2,29],[5,28],[11,27]];
  const trunks=new THREE.InstancedMesh(new THREE.BoxGeometry(.45,2.8,.45),new THREE.MeshLambertMaterial({color:0x72502f}),treePos.length);
  const crowns=new THREE.InstancedMesh(new THREE.BoxGeometry(2.4,2.2,2.4),new THREE.MeshLambertMaterial({color:rainy?0x385d42:0x3f7f3f}),treePos.length);
  treePos.forEach((p,i)=>{
    const s=.82+(i%4)*.08;
    dummy.position.set(p[0],1.4,p[1]);dummy.scale.set(s,s,s);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(p[0],3.35*s,p[1]);dummy.scale.set(s,s,s);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;environmentRoot.add(trunks);environmentRoot.add(crowns);

  const buildingGeo=new THREE.BoxGeometry(1,1,1),buildingMat=new THREE.MeshLambertMaterial({color:rainy?0x596873:0x7e8e99});
  const buildings=new THREE.InstancedMesh(buildingGeo,buildingMat,9);
  for(let i=0;i<9;i++){
    const h=6+(i%4)*2.4,w=4+(i%3)*1.2;
    dummy.position.set(-24+i*6,h/2-0.05,38+(i%2)*3);dummy.scale.set(w,h,5);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);
  }
  buildings.instanceMatrix.needsUpdate=true;environmentRoot.add(buildings);
  if(rainy){
    const cloudGeo=new THREE.BoxGeometry(1,1,1),cloudMat=new THREE.MeshLambertMaterial({color:0x687985});
    const clouds=new THREE.InstancedMesh(cloudGeo,cloudMat,7);
    for(let i=0;i<7;i++){
      const w=5+(i%3)*2.2;
      dummy.position.set(-18+i*6.2,12.5+(i%2)*1.2,18+(i%3)*6);dummy.scale.set(w,1.1,2.8);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate=true;environmentRoot.add(clouds);
  }else{
    const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(2.2,12,8),new THREE.MeshBasicMaterial({color:0xffe08a}));
    sunDisc.position.set(-22,18,34);environmentRoot.add(sunDisc);
  }
}
function buildRainWeather(){
  const W=32,D=COURT.floorMaxZ-COURT.floorMinZ;
  const wet=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshPhongMaterial({
    color:0x8ba0aa,specular:0xd5ecf5,shininess:95,transparent:true,opacity:.13,depthWrite:false
  }));
  wet.rotation.x=-Math.PI/2;wet.position.set(0,.018,(COURT.floorMinZ+COURT.floorMaxZ)/2);weatherRoot.add(wet);

  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const count=mobile?88:150,positions=new Float32Array(count*6);
  const reset=(i,initial)=>{
    const j=i*6,x=rnd(-15,15),y=initial?rnd(.8,19):rnd(11,20),z=rnd(COURT.floorMinZ-5,COURT.floorMaxZ+5),len=rnd(.55,1.05);
    positions[j]=x;positions[j+1]=y;positions[j+2]=z;
    positions[j+3]=x+.12;positions[j+4]=y-len;positions[j+5]=z+.05;
  };
  for(let i=0;i<count;i++)reset(i,true);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xc5deea,transparent:true,opacity:.58,depthWrite:false}));
  lines.frustumCulled=false;weatherRoot.add(lines);
  rainState={positions,geometry,count,reset,speed:mobile?12:15};
}
function writeFlowerInstance(state,layer,index,grow){
  const d=layer.data[index],o=state.dummy,axis=state.axis.set(d.ax,d.ay,d.az).normalize();
  const eased=Math.pow(clamp(grow,0,1),.72),stemScale=Math.max(.001,eased),bloomScale=Math.max(.001,eased);
  state.quat.setFromUnitVectors(state.up,axis);
  o.position.set(d.x+axis.x*d.h*eased*.5,d.y+axis.y*d.h*eased*.5,d.z+axis.z*d.h*eased*.5);
  o.quaternion.copy(state.quat);o.scale.set(d.stem*stemScale,d.h*eased,d.stem*stemScale);o.updateMatrix();layer.stems.setMatrixAt(index,o.matrix);
  o.position.set(d.x+axis.x*d.h*eased,d.y+axis.y*d.h*eased,d.z+axis.z*d.h*eased);
  o.quaternion.copy(state.quat);o.rotateY(d.rot);o.scale.set(d.size*bloomScale,d.size*bloomScale,d.size*bloomScale);o.updateMatrix();layer.petalsA.setMatrixAt(index,o.matrix);
  o.quaternion.copy(state.quat);o.rotateY(d.rot+Math.PI/2);o.scale.set(d.size*bloomScale,d.size*bloomScale*(d.type?1:.7),d.size*bloomScale);o.updateMatrix();layer.petalsB.setMatrixAt(index,o.matrix);
  o.quaternion.copy(state.quat);o.rotateY(d.rot*.5);o.scale.set(d.core*bloomScale,d.core*bloomScale,d.core*bloomScale);o.updateMatrix();layer.centers.setMatrixAt(index,o.matrix);
}
function makeFlowerLayer(state,data,name){
  const total=data.length;
  const stemMat=new THREE.MeshLambertMaterial({color:0xffffff});
  const petalMat=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x5a1d2d,emissiveIntensity:0});
  const coreMat=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x5b390e,emissiveIntensity:0});
  const layer={name,data,total,target:0,stems:new THREE.InstancedMesh(new THREE.BoxGeometry(.052,1,.052),stemMat,total),
    petalsA:new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.075,.31),petalMat,total),
    petalsB:new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.075,.31),petalMat,total),
    centers:new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.105,.12),coreMat,total),stemMat,petalMat,coreMat};
  const meshes=[layer.stems,layer.petalsA,layer.petalsB,layer.centers];
  data.forEach((d,i)=>{
    layer.stems.setColorAt(i,new THREE.Color(state.stemPalette[d.stemColor%state.stemPalette.length]));
    layer.petalsA.setColorAt(i,new THREE.Color(state.flowerPalette[d.color%state.flowerPalette.length]));
    layer.petalsB.setColorAt(i,new THREE.Color(state.flowerPalette[(d.color+(d.type?0:2))%state.flowerPalette.length]));
    layer.centers.setColorAt(i,new THREE.Color(state.corePalette[d.coreColor%state.corePalette.length]));
  });
  meshes.forEach(mesh=>{mesh.count=0;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;environmentRoot.add(mesh);});
  state.bloomMaterials.push(petalMat,coreMat);return layer;
}
function setFlowerLayerTarget(state,layer,target){
  target=clamp(target|0,0,layer.total);if(target<=layer.target)return;
  const old=layer.target;layer.target=target;
  [layer.stems,layer.petalsA,layer.petalsB,layer.centers].forEach(mesh=>{mesh.count=target;});
  for(let i=old;i<target;i++){
    layer.data[i].grow=-Math.min(.62,(i-old)*.024);
    writeFlowerInstance(state,layer,i,0);
  }
  [layer.stems,layer.petalsA,layer.petalsB,layer.centers].forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
}
function updateFlowerLayer(state,layer,dt){
  let changed=false;
  for(let i=0;i<layer.target;i++){
    const d=layer.data[i];if(d.grow>=1)continue;
    d.grow=Math.min(1,d.grow+dt*(1.75+d.speed));
    writeFlowerInstance(state,layer,i,Math.max(0,d.grow));changed=true;
  }
  if(changed)[layer.stems,layer.petalsA,layer.petalsB,layer.centers].forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
}
function buildFlowerCourt(){
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const flowerRng=mulberry32((GAME_SEED^0x46a3b27d)>>>0),frnd=(a,b)=>a+flowerRng()*(b-a),pick=n=>(flowerRng()*n)|0;
  const state={dummy:new THREE.Object3D(),axis:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),quat:new THREE.Quaternion(),
    flowerPalette:[0xff315f,0xff7043,0xffc928,0xfff4d8,0x72d6ff,0x7d68ff,0xd85cff,0xff96bd,0xf4511e,0x8ce15c],
    stemPalette:[0x286b38,0x3d8c47,0x547d35,0x1f5c3a],corePalette:[0xffdf4d,0x6b3518,0xfff2a3],bloomMaterials:[],pulse:0,revealProgress:0,
    grassMat:environmentRoot.userData.grassMaterial,grassStart:new THREE.Color(0x626b55),grassEnd:new THREE.Color(0x4f9c4b)};

  const weedTotal=mobile?96:176,weedGeo=new THREE.BoxGeometry(.032,1,.032),weedMat=new THREE.MeshLambertMaterial({color:0xffffff});
  const weedsA=new THREE.InstancedMesh(weedGeo,weedMat,weedTotal),weedsB=new THREE.InstancedMesh(weedGeo,weedMat,weedTotal),weedDummy=new THREE.Object3D();
  const weedColors=[0x465536,0x68633e,0x73533a,0x365b39];
  for(let i=0;i<weedTotal;i++){
    let x,z;
    if(i<weedTotal*.58){
      if(i%2){x=frnd(-13.2,-7.9);z=frnd(COURT.nearBaseline-3,COURT.farBaseline+5);}
      else{x=frnd(7.9,13.2);z=frnd(COURT.nearBaseline-3,COURT.farBaseline+5);}
    }else{x=frnd(-7.25,7.25);z=frnd(COURT.nearBaseline+.3,COURT.farBaseline-.3);}
    const h=frnd(.1,.34),lean=frnd(-.22,.22),color=new THREE.Color(weedColors[pick(weedColors.length)]);
    weedDummy.position.set(x,h*.5,z);weedDummy.scale.set(1,h,1);weedDummy.rotation.set(lean,frnd(0,Math.PI),lean*.55);weedDummy.updateMatrix();weedsA.setMatrixAt(i,weedDummy.matrix);
    weedDummy.rotation.y+=Math.PI/2;weedDummy.position.x+=frnd(-.06,.06);weedDummy.position.z+=frnd(-.06,.06);weedDummy.scale.y*=frnd(.72,1.05);weedDummy.updateMatrix();weedsB.setMatrixAt(i,weedDummy.matrix);
    weedsA.setColorAt(i,color);weedsB.setColorAt(i,color);
  }
  [weedsA,weedsB].forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;environmentRoot.add(mesh);});

  const groundTotal=mobile?340:720,groundData=[];
  const addGround=(x,z,zone)=>{
    const h=zone===0?frnd(.3,.96):(zone===1?frnd(.2,.7):frnd(.13,.46));
    groundData.push({x,y:.012,z,ax:frnd(-.08,.08),ay:1,az:frnd(-.08,.08),h,size:frnd(.7,1.42),core:frnd(.72,1.12),stem:frnd(.72,1.18),
      rot:frnd(0,Math.PI),type:pick(3),color:pick(state.flowerPalette.length),stemColor:pick(state.stemPalette.length),coreColor:pick(state.corePalette.length),grow:0,speed:frnd(0,.7)});
  };
  const outerCount=Math.floor(groundTotal*.54),edgeCount=Math.floor(groundTotal*.2);
  for(let i=0;i<outerCount;i++){
    let x,z;
    if(i%4===0){x=frnd(-14,14);z=frnd(COURT.farBaseline+.7,COURT.farBaseline+11);}
    else if(i%4===1){x=frnd(-14,-8);z=frnd(COURT.nearBaseline-4,COURT.farBaseline+5);}
    else if(i%4===2){x=frnd(8,14);z=frnd(COURT.nearBaseline-4,COURT.farBaseline+5);}
    else{x=frnd(-14,14);z=frnd(COURT.nearBaseline-8,COURT.nearBaseline-.7);}
    addGround(x,z,0);
  }
  for(let i=0;i<edgeCount;i++){
    let x,z;
    if(i%3===0){x=(i%2?1:-1)*frnd(6.45,7.45);z=frnd(COURT.nearBaseline+.2,COURT.farBaseline-.2);}
    else if(i%3===1){x=frnd(-7.2,7.2);z=frnd(COURT.farBaseline-1.05,COURT.farBaseline-.18);}
    else{x=frnd(-7.2,7.2);z=frnd(COURT.nearBaseline+.18,COURT.nearBaseline+1.05);}
    addGround(x,z,1);
  }
  let guard=0;
  while(groundData.length<groundTotal&&guard++<groundTotal*20){
    const x=frnd(-7.15,7.15),z=frnd(COURT.nearBaseline+.45,COURT.farBaseline-.45);
    const clear=BATTLE_SPOTS.every(spot=>(x-spot.p.x)*(x-spot.p.x)+(z-spot.p.z)*(z-spot.p.z)>.62*.62);
    if(clear)addGround(x,z,2);
  }

  const structureData=[],addStructure=(x,y,z,ax,ay,az,hMin,hMax,sizeMin,sizeMax)=>{
    structureData.push({x,y,z,ax,ay,az,h:frnd(hMin,hMax),size:frnd(sizeMin,sizeMax),core:frnd(.78,1.2),stem:frnd(.72,1.15),rot:frnd(0,Math.PI),
      type:pick(3),color:pick(state.flowerPalette.length),stemColor:pick(state.stemPalette.length),coreColor:pick(state.corePalette.length),grow:0,speed:frnd(.1,.9)});
  };
  const supportCount=mobile?24:44,boardCount=mobile?38:70,rimCount=mobile?22:38;
  for(let i=0;i<supportCount;i++){
    if(i<supportCount*.62){
      const a=frnd(0,Math.PI*2);addStructure(Math.cos(a)*.22,frnd(.15,3.32),-10.2+Math.sin(a)*.22,Math.cos(a)*.7,frnd(.45,.9),Math.sin(a)*.7,.18,.52,.68,1.2);
    }else addStructure(frnd(-.18,.18),3.56,frnd(-10.05,-8.78),frnd(-.35,.35),1,frnd(-.1,.45),.2,.58,.72,1.28);
  }
  for(let i=0;i<boardCount;i++){
    if(i<boardCount*.48)addStructure(frnd(-1.02,1.02),4.08,-8.53,frnd(-.28,.28),1,frnd(.05,.32),.2,.7,.78,1.42);
    else{
      const side=i%2?1:-1;addStructure(side*1.01,frnd(3.02,4.02),-8.53,side*frnd(.55,.95),frnd(.35,.85),frnd(.08,.3),.16,.56,.72,1.32);
    }
  }
  for(let i=0;i<rimCount;i++){
    const a=i/rimCount*Math.PI*2+frnd(-.08,.08),rad=.39;
    addStructure(HOOP.x+Math.cos(a)*rad,HOOP.y+.045,HOOP.z+Math.sin(a)*rad,Math.cos(a)*.58,frnd(.65,1),Math.sin(a)*.58,.14,.38,.68,1.18);
  }
  state.ground=makeFlowerLayer(state,groundData,"ground");state.structure=makeFlowerLayer(state,structureData,"structure");
  state.total=groundData.length+structureData.length;state.weedTotal=weedTotal;state.visible=0;state.structureVisible=0;
  environmentRoot.userData.flowerState=state;
  document.documentElement.dataset.flowerCount="0";document.documentElement.dataset.flowerGround="0";
  document.documentElement.dataset.flowerStructure="0";document.documentElement.dataset.weedCount=String(weedTotal);
}
function buildBeachSunset(){
  const surround=new THREE.Mesh(new THREE.PlaneGeometry(90,46),new THREE.MeshLambertMaterial({color:0x66666a}));
  surround.rotation.x=-Math.PI/2;surround.position.set(0,-.07,5);environmentRoot.add(surround);
  const sand=new THREE.Mesh(new THREE.PlaneGeometry(100,12),new THREE.MeshLambertMaterial({color:0xb98662}));
  sand.rotation.x=-Math.PI/2;sand.position.set(0,-.055,-17.5);environmentRoot.add(sand);
  const oceanMat=new THREE.MeshPhongMaterial({color:0x447c94,specular:0xa9d8dd,shininess:65,transparent:true,opacity:.96});
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(100,36,1,1),oceanMat);
  ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-.16,-39);environmentRoot.add(ocean);

  const waveMat=new THREE.MeshBasicMaterial({color:0xffe4d2,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});
  const waves=[];
  for(let i=0;i<8;i++){
    const wave=new THREE.Mesh(new THREE.PlaneGeometry(20+(i%3)*6,.12),waveMat);
    wave.rotation.x=-Math.PI/2;wave.position.set((i%2?1:-1)*(i%3)*3,-.075,-23-i*3.7);environmentRoot.add(wave);waves.push(wave);
  }
  const sunMat=new THREE.MeshBasicMaterial({color:0xffd477,transparent:true,opacity:1,fog:false});
  const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(2.8,16,10),sunMat);
  sunDisc.position.set(-18,8.5,-48);environmentRoot.add(sunDisc);

  const fenceMat=new THREE.MeshLambertMaterial({color:0x6f7477});
  const fenceGeo=new THREE.BoxGeometry(.1,2.5,.1),fenceDummy=new THREE.Object3D(),fencePos=[];
  for(let z=-9;z<=20;z+=3.2)fencePos.push([-10.2,z],[10.2,z]);
  const fencePosts=new THREE.InstancedMesh(fenceGeo,fenceMat,fencePos.length);
  fencePos.forEach((p,i)=>{fenceDummy.position.set(p[0],1.25,p[1]);fenceDummy.updateMatrix();fencePosts.setMatrixAt(i,fenceDummy.matrix);});
  fencePosts.instanceMatrix.needsUpdate=true;environmentRoot.add(fencePosts);
  [[-10.2,.72,5.5],[10.2,.72,5.5],[-10.2,1.65,5.5],[10.2,1.65,5.5]].forEach(d=>{
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,29),fenceMat);rail.position.set(d[0],d[1],d[2]);environmentRoot.add(rail);
  });

  const palmTrunkGeo=new THREE.BoxGeometry(.32,4.8,.32),palmLeafGeo=new THREE.BoxGeometry(2.5,.12,.42);
  const palmTrunkMat=new THREE.MeshLambertMaterial({color:0x6f4633}),palmLeafMat=new THREE.MeshLambertMaterial({color:0x315c45});
  [[-14,-9],[-14,3],[-14,15],[14,-6],[14,7],[14,17]].forEach((p,pi)=>{
    const palm=new THREE.Group(),trunk=new THREE.Mesh(palmTrunkGeo,palmTrunkMat);trunk.position.y=2.4;palm.add(trunk);
    for(let i=0;i<5;i++){
      const leaf=new THREE.Mesh(palmLeafGeo,palmLeafMat);leaf.position.y=4.75;leaf.rotation.y=i*Math.PI*.4;leaf.rotation.z=(i%2?1:-1)*.09;palm.add(leaf);
    }
    palm.position.set(p[0],0,p[1]);palm.rotation.z=(pi%2?1:-1)*.035;environmentRoot.add(palm);
  });

  const poleGeo=new THREE.BoxGeometry(.13,4,.13),armGeo=new THREE.BoxGeometry(.75,.1,.1),bulbGeo=new THREE.BoxGeometry(.28,.22,.28),glowGeo=new THREE.CircleGeometry(2.6,20);
  const poleMat=new THREE.MeshLambertMaterial({color:0x34373b});
  const bulbMat=new THREE.MeshLambertMaterial({color:0x4b4135,emissive:0xffb85c,emissiveIntensity:0});
  const glowMat=new THREE.MeshBasicMaterial({color:0xffb85c,transparent:true,opacity:0,depthWrite:false});
  const lampPositions=[[-9.15,-7],[9.15,-7],[-9.15,5],[9.15,5],[-9.15,17],[9.15,17]],lampLights=[];
  lampPositions.forEach((p,i)=>{
    const pole=new THREE.Mesh(poleGeo,poleMat);pole.position.set(p[0],2,p[1]);environmentRoot.add(pole);
    const side=p[0]<0?1:-1;
    const arm=new THREE.Mesh(armGeo,poleMat);arm.position.set(p[0]+side*.32,4,p[1]);environmentRoot.add(arm);
    const bulb=new THREE.Mesh(bulbGeo,bulbMat);bulb.position.set(p[0]+side*.63,3.92,p[1]);environmentRoot.add(bulb);
    const glow=new THREE.Mesh(glowGeo,glowMat);glow.rotation.x=-Math.PI/2;glow.position.set(p[0]+side*.63,.025,p[1]);environmentRoot.add(glow);
    if(i===2||i===3){
      const light=new THREE.PointLight(0xffb45d,0,14,2);light.position.copy(bulb.position);environmentRoot.add(light);lampLights.push(light);
    }
  });

  const rockGeo=new THREE.BoxGeometry(1,1,1),rockMat=new THREE.MeshLambertMaterial({color:0x5d5550}),rocks=new THREE.InstancedMesh(rockGeo,rockMat,10),rockDummy=new THREE.Object3D();
  for(let i=0;i<10;i++){
    rockDummy.position.set(-24+i*5.2,-.02,-21.5+(i%2)*.7);rockDummy.scale.set(2+(i%3),.35+(i%2)*.2,1.3);rockDummy.rotation.y=(i%3)*.35;rockDummy.updateMatrix();rocks.setMatrixAt(i,rockDummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate=true;environmentRoot.add(rocks);

  const gullGeo=new THREE.BufferGeometry().setFromPoints([V3(-.34,0,0),V3(0,.13,0),V3(.34,0,0)]);
  const gullMat=new THREE.LineBasicMaterial({color:0xf5ede2,transparent:true,opacity:.82});
  environmentRoot.userData.beachState={ocean,oceanMat,waves,waveMat,sunDisc,sunMat,bulbMat,glowMat,lampLights,
    gullGeo,gullMat,gulls:[],nextGull:6,time:0,tmpSky:new THREE.Color(),tmpFog:new THREE.Color(),
    skyStops:[new THREE.Color(0xf1a05f),new THREE.Color(0xb86792),new THREE.Color(0x39466f),new THREE.Color(0x07111f)],
    fogTint:new THREE.Color(0x607485),oceanStart:new THREE.Color(0x447c94),oceanNight:new THREE.Color(0x102938),
    sunDiscStart:new THREE.Color(0xffd477),sunDiscEnd:new THREE.Color(0xd75d3c),hemiNight:new THREE.Color(0xb6d6ff),
    sunLightStart:new THREE.Color(0xffd5a0),sunLightEnd:new THREE.Color(0x7d91bc)};
}
function smoothRange(a,b,v){
  const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);
}
function colorFromStops(out,stops,progress){
  const scaled=clamp(progress,0,1)*(stops.length-1),i=Math.min(stops.length-2,Math.floor(scaled));
  return out.copy(stops[i]).lerp(stops[i+1],scaled-i);
}
function spawnBeachGulls(state){
  if(!state||state.gulls.length>=3)return;
  const groupCount=Math.min(1+((Math.random()*3)|0),3-state.gulls.length),dir=Math.random()<.5?1:-1;
  for(let i=0;i<groupCount;i++){
    const gull=new THREE.Line(state.gullGeo,state.gullMat);
    gull.position.set(dir>0?-30-i*1.1:30+i*1.1,rnd(9,14)+i*.35,rnd(-45,-28)-i*.8);
    gull.userData={vx:dir*rnd(3.2,4.8),baseY:gull.position.y,time:rnd(0,3)};
    environmentRoot.add(gull);state.gulls.push(gull);
  }
  if(G.state==="diff"||sceneAudioArenaLike())extPlay("gull");
}
function updateBeachSunset(progress,dt){
  const state=environmentRoot.userData.beachState;
  if(!state)return;
  state.time+=dt;
  const finalBoost=state.finalBoost||0;state.finalBoost=Math.max(0,finalBoost-dt*.5);
  colorFromStops(state.tmpSky,state.skyStops,progress);scene.background.copy(state.tmpSky);
  state.tmpFog.copy(state.tmpSky).lerp(state.fogTint,.28);scene.fog.color.copy(state.tmpFog);
  state.sunDisc.position.y=8.5-progress*10.5;
  state.sunDisc.position.x=-18+progress*2.5;
  state.sunMat.opacity=1-smoothRange(.55,.75,progress);
  state.sunMat.color.copy(state.sunDiscStart).lerp(state.sunDiscEnd,smoothRange(.2,.68,progress));
  state.ocean.position.y=-.16+Math.sin(state.time*.65)*.025;
  state.oceanMat.color.copy(state.oceanStart).lerp(state.oceanNight,progress);
  state.waveMat.opacity=.42-progress*.18+finalBoost*.08;
  state.waves.forEach((wave,i)=>{
    wave.position.z+=dt*(.38+i*.018);
    if(wave.position.z>-21)wave.position.z=-51-(i%3)*1.8;
  });
  const lamp=smoothRange(.5,.85,progress);
  state.bulbMat.emissiveIntensity=lamp*2.4+finalBoost*1.2;state.bulbMat.color.setHex(lamp>.2?0xffcf89:0x4b4135);
  state.glowMat.opacity=lamp*.22+finalBoost*.1;state.lampLights.forEach(light=>{light.intensity=lamp*1.45+finalBoost*.75;});
  ambient.intensity=.42-progress*.12+lamp*.08;
  hemi.intensity=.58-progress*.18+lamp*.08;hemi.color.copy(state.tmpSky).lerp(state.hemiNight,.35);
  sun.intensity=.9-progress*.72;sun.color.copy(state.sunLightStart).lerp(state.sunLightEnd,progress);
  state.nextGull-=dt;
  if(progress<.75&&state.nextGull<=0){spawnBeachGulls(state);state.nextGull=rnd(10,20);}
  for(let i=state.gulls.length-1;i>=0;i--){
    const gull=state.gulls[i],d=gull.userData;d.time+=dt;gull.position.x+=d.vx*dt;gull.position.y=d.baseY+Math.sin(d.time*3.2)*.16;gull.rotation.z=Math.sin(d.time*5)*.12;
    if(Math.abs(gull.position.x)>34){environmentRoot.remove(gull);state.gulls.splice(i,1);}
  }
  document.documentElement.dataset.environmentPhase=progress<.25?"golden":(progress<.5?"sunset":(progress<.75?"dusk":"night"));
}
function updateRain(dt){
  if(!rainState||currentWeather!=="rain")return;
  const a=rainState.positions,dx=dt*.9,dy=dt*rainState.speed;
  for(let i=0;i<rainState.count;i++){
    const j=i*6;
    a[j]+=dx;a[j+3]+=dx;a[j+1]-=dy;a[j+4]-=dy;
    if(a[j+1]<0)rainState.reset(i,false);
  }
  rainState.geometry.attributes.position.needsUpdate=true;
}
function updateFlowerCourt(progress,dt){
  const state=environmentRoot.userData.flowerState;
  if(!state)return;
  state.revealProgress=Math.max(state.revealProgress,Math.pow(clamp(progress,0,1),.88));
  const groundT=clamp(state.revealProgress/.96,0,1),structureT=smoothRange(.38,1,state.revealProgress);
  setFlowerLayerTarget(state,state.ground,Math.floor(groundT*state.ground.total));
  setFlowerLayerTarget(state,state.structure,Math.floor(structureT*state.structure.total));
  updateFlowerLayer(state,state.ground,dt);updateFlowerLayer(state,state.structure,dt);
  state.visible=state.ground.target;state.structureVisible=state.structure.target;
  const allVisible=state.visible+state.structureVisible;
  document.documentElement.dataset.flowerCount=String(allVisible);
  document.documentElement.dataset.flowerGround=String(state.visible);
  document.documentElement.dataset.flowerStructure=String(state.structureVisible);
  if(state.grassMat)state.grassMat.color.copy(state.grassStart).lerp(state.grassEnd,state.revealProgress);
  state.pulse=Math.max(0,state.pulse-dt*2.5);
  state.bloomMaterials.forEach((mat,i)=>{mat.emissiveIntensity=state.pulse*(i%2?.55:.32);});
}
function bloomOnScore(points){
  const state=environmentRoot.userData.flowerState;
  if(!state)return;
  const value=Math.max(1,points||3),bump=value>=10?.055:(value>=5?.032:.019);
  state.revealProgress=clamp(state.revealProgress+bump,0,1);state.pulse=1;
}
function weatherAdjustedIdeal(shot,withNoise){
  const mod=WEATHER_SHOT_MODIFIERS[currentWeather]||WEATHER_SHOT_MODIFIERS.none;
  const noise=withNoise&&mod.noiseMax>mod.noiseMin?rnd(mod.noiseMin,mod.noiseMax):0;
  return clamp(shotIdeal(shot)+mod.idealBias+noise,0,99);
}
function applyScenePreset(name,opts){
  opts=opts||{};
  if(!SCENE_PRESETS[name])name="indoor";
  currentScenePreset=name;
  const preset=SCENE_PRESETS[name],outdoor=preset.type==="outdoor",rainy=preset.weather==="rain",flower=preset.progression==="flowerBloom",beach=preset.progression==="sunsetToNight";
  currentWeather=preset.weather;
  indoorRoot.visible=!outdoor;
  rainState=null;
  disposeEnvironmentRoot(environmentRoot);disposeEnvironmentRoot(weatherRoot);if(outdoor&&window.AIBAVisual)environmentRoot.add(AIBAVisual.makeSkyDome(THREE,name,COURT.midZ));
  resetStreetCrowd();
  if(courtFloor){
    if(outdoor&&!courtOutdoorTexture)courtOutdoorTexture=makeCourtTexture("outdoorSunny");
    courtFloor.material.map=outdoor?courtOutdoorTexture:courtIndoorTexture;
    courtFloor.material.color.setHex(rainy?0x9aa7ad:(beach?0xc0a9a0:0xffffff));if(window.AIBAVisual)AIBAVisual.tuneCourt(courtFloor,name);courtFloor.material.needsUpdate=true;
  }
  if(outdoor){
    if(beach){
      scene.background.setHex(0xf1a05f);scene.fog.color.setHex(0xb48272);scene.fog.near=44;scene.fog.far=105;
      ambient.color.setHex(0xffe0c2);ambient.intensity=.4;
      hemi.color.setHex(0xffbd86);hemi.groundColor.setHex(0x51444b);hemi.intensity=.58;
      sun.color.setHex(0xffd5a0);sun.intensity=.9;sun.position.set(-14,15,-8);spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else if(rainy){
      scene.background.setHex(0x657987);scene.fog.color.setHex(0x758690);scene.fog.near=28;scene.fog.far=68;
      ambient.color.setHex(0xdce8ee);ambient.intensity=.32;
      hemi.color.setHex(0x9db6c4);hemi.groundColor.setHex(0x405347);hemi.intensity=.46;
      sun.color.setHex(0xc5d5dc);sun.intensity=.34;sun.position.set(-10,18,10);spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else{
      scene.background.setHex(0x236fa8);scene.fog.color.setHex(0x91b8c5);scene.fog.near=42;scene.fog.far=94;
      ambient.color.setHex(0xeaf3f5);ambient.intensity=.36;
      hemi.color.setHex(0xb7dded);hemi.groundColor.setHex(0x40583b);hemi.intensity=.55;
      sun.color.setHex(0xffe2a3);sun.intensity=.9;sun.position.set(-12,22,14);spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }
    if(beach)buildBeachSunset();
    else{
      buildOutdoorPark(rainy,flower);
      if(rainy)buildRainWeather();
      if(flower)buildFlowerCourt();
    }
    buildStreetCrowd({beach,rainy,flower});
  }else{
    /* 室内是唯一有"主光"的预设,四盏灯的分工见 rendering/core.js 顶部。
       这里必须把 core.js 的默认值逐项重写一遍 —— 切过一次户外场景再切回来,
       灯位/强度全被上面的分支改过了,漏写哪一项,那一项就停在户外的值上。 */
    /* 不用纯黑当背景。顶棚和横幅墙之间那条缝里没有几何体,露出来的就是背景色 ——
       纯黑在那里读作"破洞",带一点蓝的深色才读作"暗处的空气"。 */
    scene.background.setHex(0x0d1220);
    /* 雾色比背景亮一档:远处观众不是"淡入黑洞",而是淡进一层空气。
       near 15 / far 52 —— 主角(3~4m)和篮筐(9m)完全不吃雾,
       看台(13m)刚起雾,横幅墙(20m)约 14%,后场(30m)约 43%。 */
    /* ⚠ 这组才是室内灯光与雾的**权威值**。core.js 里那几盏灯只是初始定义,
       每次切场景都会被这里整体覆盖 —— 改了 core.js 不改这里等于没改
       (v2.20.4 踩过:只改 core.js,实测地面阴影深度纹丝不动,查出来是这里在重置)。 */
    scene.fog.color.setHex(0x141a24);scene.fog.near=12;scene.fog.far=52;
    /* 主光:环境由 5.3:1 改为约 1:1 —— 真实球馆是几十盏顶灯均匀漫射,
       不是一束追光。被遮挡处亮度 = 环境/(环境+主光),1.75 时约 36%(影子死实),
       0.82 时约 58%(读得出遮蔽但看不出方向)。 */
    ambient.color.setHex(0x9fb4d0);ambient.intensity=.58;
    hemi.color.setHex(0x6f86b6);hemi.groundColor.setHex(0x241a12);hemi.intensity=.54;
    sun.color.setHex(0xffdcae);sun.intensity=.30;sun.position.set(6.5,17,5);
    /* spot 从 .82 降到 .30。它已经不再 castShadow(见 core.js),这里降强度是因为
       灯阵 4×.30=1.20 已经承担了主要照明,spot 再保持 .82 会重新变回"单方向主导",
       多方向填亮的效果就没了。它现在只留一点点方向感,让暗面不至于完全平。 */
    spot.color.setHex(0xfff2d8);spot.intensity=.30;spot.distance=42;spot.angle=.68;spot.penumbra=.55;spot.decay=1.1;
    spot.position.set(6.2,11.8,4.2);spot.target.position.set(0,.9,-4.2);spot.target.updateMatrixWorld();
    /* 灯阵恢复。户外分支把强度清成 0 了,切回来必须逐盏写回 ——
       和 spot/ambient 一样,漏写就会停在户外的值上(全黑)。 */
    applyArenaLightMix();
    /* .46→.18。**这里才是 rim 的权威值**(core.js 那份是初始化值,切场景会被本行覆盖,
       两边必须一起改,否则改了 core.js 会看起来"没生效")。
       原因见 core.js 的注释:rim 俯角只有 16°,是掠射角,漫反射余弦仅 0.27 却因
       Fresnel 趋近 1.0 而把镜面反射拉成一条长带 —— 逐灯消融显示它是地板那块
       过曝的**唯一来源**(单独归零即让 16580 个过曝像素塌到 0),
       而压到 .18 的代价是场地均值 −2.5%、角色 P95 完全不变(它是背光,
       过肩机位下相机看到的正面本就吃不到它)。 */
    rim.intensity=.18;rim.position.set(-5,4.5,-15);
    camFill.intensity=0.25;camFill.distance=12;camFill.position.set(0,-.15,1);
    updJumbo();
  }
  document.documentElement.dataset.scenePreset=name;
  document.documentElement.dataset.weather=currentWeather;
  document.documentElement.dataset.progression=preset.progression;
  if(!flower){delete document.documentElement.dataset.flowerCount;delete document.documentElement.dataset.flowerGround;delete document.documentElement.dataset.flowerStructure;delete document.documentElement.dataset.weedCount;}
  if(!beach)delete document.documentElement.dataset.environmentPhase;
  if(opts.persist!==false)try{localStorage.setItem("aiba-scene-preset",name);}catch(e){}
  if(opts.announce){
    let rainHintSeen=false;
    if(rainy){
      try{rainHintSeen=localStorage.getItem("aiba-rain-hint-seen")==="1";}catch(e){}
      if(!rainHintSeen){
        toast("雨天球更重 · 甜区略微上移,出手需要稍加力","#bfe9ff");
        try{localStorage.setItem("aiba-rain-hint-seen","1");}catch(e){}
      }else toast("赛场 · "+preset.name,"#bfe9ff");
    }else toast("赛场 · "+preset.name,beach?"#ffc078":(outdoor?"#8fdfff":"#ffd23f"));
  }
  syncSceneAmbience();
}function resetProgressiveSceneForRun(){if(window.AIBASceneLifecycle)return AIBASceneLifecycle.resetForRun();const preset=SCENE_PRESETS[currentScenePreset];if(preset&&preset.progression!=="none")applyScenePreset(currentScenePreset,{persist:false});}
function getEnvironmentProgress(){
  if(G.state==="boot"||G.state==="menu"||G.state==="diff"||G.state==="intro")return 0;
  if(G.mode==="battle")return clamp(Math.max(G.score||0,G.battleOppScore||0)/BATTLE_TARGET,0,1);
  if(G.mode==="rackrush"&&G.rush)return clamp((G.rush.level+(G.timer<=0?1:1-G.timer/Math.max(1,(RACK_RUSH_LEVELS[G.rush.level]||RACK_RUSH_LEVELS[0]).time)))/RACK_RUSH_LEVELS.length,0,1);
  if(G.mode==="contest")return clamp((G.score||0)/40,0,1);
  return 0;
}
function updateEnvironment(dt){
  const progress=getEnvironmentProgress();
  environmentRoot.userData.progress=progress;
  updateRain(dt);
  updateFlowerCourt(progress,dt);
  updateBeachSunset(progress,dt);
}

window.AIBA.runtime.register("rendering:environments",Object.freeze({
  disposeEnvironmentRoot,buildOutdoorPark,buildRainWeather,buildFlowerCourt,buildBeachSunset,
  updateBeachSunset,updateRain,updateFlowerCourt,bloomOnScore,applyScenePreset,
  resetProgressiveSceneForRun,getEnvironmentProgress,updateEnvironment
}));
