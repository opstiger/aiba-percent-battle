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
  materials.forEach(m=>{
    for(const k of ["map","bumpMap","normalMap","roughnessMap","alphaMap"]){
      if(m[k]&&m[k].dispose)m[k].dispose();
    }
    if(m.dispose)m.dispose();
  });
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
/* Thin petal surfaces are curled across their width and along the tip. */
function flowerPetalGeometry(mobile){
  const positions=[],colors=[],indices=[],uv=[],rows=mobile?7:9,columns=4;
  for(let i=0;i<=rows;i++){
    const t=(1-Math.cos(i/rows*Math.PI))*.5,width=.5*Math.pow(Math.sin(Math.PI*(.045+.955*t)),.52)*(.76+.24*t);
    for(let j=0;j<=columns;j++){
      const u=j/columns*2-1;
      const cup=.20*t*t+.12*u*u*Math.sin(Math.PI*t)+.027*u*t;
      positions.push(width*u*(1+.06*Math.sin(t*8+u)),cup,t);uv.push(j/columns,t);
      const tint=.61+.39*Math.sin(t*Math.PI*.53)-.08*u*u;
      colors.push(tint,tint*.98,tint*.92);
      if(i<rows&&j<columns){
        const k=i*(columns+1)+j,n=k+columns+1;
        indices.push(k,n,k+1,k+1,n,n+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setIndex(indices);
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
}

function flowerVeinTexture(){
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=256;
  const g=canvas.getContext("2d"),tone=g.createLinearGradient(0,255,0,0);
  tone.addColorStop(0,"#bbb2ac");tone.addColorStop(.53,"#f8f4ef");tone.addColorStop(1,"#fffbf7");
  g.fillStyle=tone;g.fillRect(0,0,128,256);
  for(let i=-8;i<=8;i++){
    g.strokeStyle=`rgba(138,123,126,${i%3===0?.23:.13})`;g.lineWidth=i%3===0?1.25:.68;
    g.beginPath();g.moveTo(64+i*.64,254);
    g.bezierCurveTo(64+i*3.2,194,64+i*6.8,100+i*i*.5,64+i*6.35,12+i*i*.66);g.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;return map;
}
const FLOWER_FORMS=[
  {petals:10,length:1,width:.37,lift:.02,center:.32,swatches:[0xf7ecd8,0xfff8e7,0xe9e3cf],pollen:0xe2ae41},
  {petals:5,length:1.12,width:.83,lift:.13,center:.25,swatches:[0xbd6f9c,0xd887a7,0xd794b6],pollen:0xe9c779},
  {petals:5,length:.83,width:.67,lift:.29,center:.30,swatches:[0xf2c63f,0xefb234,0xf8d457],pollen:0xba8233},
  {petals:6,length:.93,width:.63,lift:.09,center:.24,swatches:[0xb49acb,0x9d83b5,0xc3add1],pollen:0xe4c471}
];

function makeFlowerLayer(state,data,name){
  let petalCount=0;
  for(const d of data){d.petalStart=petalCount;petalCount+=d.form.petals;}
  const total=data.length;
  const stems=new THREE.InstancedMesh(state.stemGeo,state.stemMat,total*2);
  const leaves=new THREE.InstancedMesh(state.petalGeo,state.leafMat,total*2);
  const petals=new THREE.InstancedMesh(state.petalGeo,state.petalMat,petalCount);
  const centers=new THREE.InstancedMesh(state.centerGeo,state.coreMat,total);
  const meshes=[stems,leaves,petals,centers],c=new THREE.Color();
  data.forEach((d,i)=>{
    for(let side=0;side<2;side++){
      stems.setColorAt(i*2+side,c.set(d.green).convertSRGBToLinear());
      leaves.setColorAt(i*2+side,c.set(d.green).convertSRGBToLinear().multiplyScalar(side?.86:1.12));
    }
    for(let j=0;j<d.form.petals;j++){
      petals.setColorAt(d.petalStart+j,c.set(d.form.swatches[(d.shade+(j%3===0?1:0))%d.form.swatches.length]).convertSRGBToLinear()
        .multiplyScalar(.89+.11*Math.cos(d.rot+j*3.41)**2));
    }
    centers.setColorAt(i,c.set(d.form.pollen).convertSRGBToLinear());
  });
  for(const mesh of meshes){
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;mesh.name="meadowFlowers:"+name;
    environmentRoot.add(mesh);
  }
  return {name,data,total,target:0,stems,leaves,petals,centers,meshes};
}

function writeFlowerInstance(state,layer,i,grow){
  const d=layer.data[i],o=state.dummy,form=d.form;
  let scale=Math.max(.001,Math.pow(grow,.76));
  const phase=state.time*1.3-d.x*.23-d.z*.125;
  const wind=state.wind||0;
  const gust=(Math.sin(phase)*.105+Math.sin(phase*.62+d.phase)*.053)*(1+wind*1.25);
  const flick=Math.sin(state.time*2.37+d.phase*1.7)*.033;
  // Interactive bending: close-up court wildflowers bend away from player/opponent feet and low rolling balls.
  let pushX=0,pushZ=0,press=0;
  if(layer.name!=="structure"){
    const actors=state.actors;
    if(actors){
      for(let a=0;a<actors.length;a+=3){
        const dx=d.x-actors[a],dz=d.z-actors[a+1],rad=actors[a+2],dist=Math.hypot(dx,dz);
        if(dist<rad){
          const w=Math.pow(1-dist/rad,1.55),inv=1/Math.max(.04,dist);
          pushX+=dx*inv*w*.36;pushZ+=dz*inv*w*.36;press=Math.max(press,w*.48);
        }
      }
    }
  }
  const height=d.h*scale*(1-press*.45);
  const arcX=(gust+flick+.037+.16*wind)*height+pushX,arcZ=(gust*.54-flick*.50+.075*wind)*height+pushZ;
  const at=(p,t)=>p.set(d.x+d.axis.x*height*t+arcX*t*t,d.y+d.axis.y*height*t,d.z+d.axis.z*height*t+arcZ*t*t);
  at(state.root,0);at(state.mid,.5);at(state.tip,1);
  const radius=d.stem*scale;
  for(let part=0;part<2;part++){
    const a=part===0?state.root:state.mid,b=part===0?state.mid:state.tip;
    state.axis.subVectors(b,a);
    o.position.copy(a).lerp(b,.5);
    o.quaternion.setFromUnitVectors(state.up,state.axis.normalize());
    o.scale.set(radius*(part?.7:1),a.distanceTo(b),radius*(part?.7:1));
    o.updateMatrix();layer.stems.setMatrixAt(i*2+part,o.matrix);
    at(o.position,part?.61:.30);
    o.quaternion.identity();o.rotateY(d.rot+part*2.48+gust*.65);o.rotateX(-.39+(part?.2:0)+flick*1.3);
    o.scale.set(d.size*.52*scale,d.size*.52*scale,d.size*(part?1.10:1.32)*scale);
    o.updateMatrix();layer.leaves.setMatrixAt(i*2+part,o.matrix);
  }
  state.axis.set(d.axis.x*.80+d.faceX+gust*.95,d.axis.y*.85+.20,d.axis.z*.80+d.faceZ+flick).normalize();
  state.head.setFromUnitVectors(state.up,state.axis);
  o.position.copy(state.tip);
  for(let j=0;j<form.petals;j++){
    const angle=d.rot+j*Math.PI*2/form.petals+.065*Math.sin(j*4.2+d.phase);
    const flex=.063*Math.sin(state.time*2.7+j*.84+d.phase);
    const length=d.size*scale*form.length*(.91+.09*Math.cos(j*4.2+d.phase)**2);
    o.quaternion.copy(state.head);o.rotateY(angle);o.rotateX(-form.lift+flex);
    o.scale.set(length*form.width,length*(.64+form.lift),length);
    o.updateMatrix();layer.petals.setMatrixAt(d.petalStart+j,o.matrix);
  }
  const center=d.size*scale*form.center;
  o.position.addScaledVector(state.axis,center*.26);
  o.quaternion.copy(state.head);o.scale.set(center*1.72,center*.54,center*1.72);
  o.updateMatrix();layer.centers.setMatrixAt(i,o.matrix);
}

function setFlowerLayerTarget(state,layer,target,born=false){
  target=clamp(target|0,0,layer.total);if(target<=layer.target)return;
  const old=layer.target,last=layer.data[target-1];
  layer.target=target;layer.stems.count=layer.leaves.count=target*2;
  layer.centers.count=target;layer.petals.count=last.petalStart+last.form.petals;
  for(let i=old;i<target;i++){
    layer.data[i].grow=born?1:-Math.min(.60,(i-old)*.022);
    writeFlowerInstance(state,layer,i,born?1:0);
  }
  for(const mesh of layer.meshes)mesh.instanceMatrix.needsUpdate=true;
}
function updateFlowerLayer(state,layer,dt){
  if(!layer.target)return;
  for(let i=0;i<layer.target;i++){
    const d=layer.data[i];d.grow=Math.min(1,d.grow+dt*(1.8+d.speed));
    writeFlowerInstance(state,layer,i,Math.max(0,d.grow));
  }
  for(const mesh of layer.meshes)mesh.instanceMatrix.needsUpdate=true;
}

function buildFlowerCourt(){
  const mobile=matchMedia("(pointer:coarse)").matches||Math.min(innerWidth,innerHeight)<700;
  const rng=mulberry32((GAME_SEED^0x46a3b27d)>>>0),r=(a,b)=>a+rng()*(b-a),pick=list=>list[Math.floor(rng()*list.length)];
  const place=environmentRoot.userData.placeState,heightAt=place?.heightAt||(()=>.012);
  const state={
    dummy:new THREE.Object3D(),root:new THREE.Vector3(),mid:new THREE.Vector3(),tip:new THREE.Vector3(),axis:new THREE.Vector3(),
    up:new THREE.Vector3(0,1,0),head:new THREE.Quaternion(),time:0,elapsed:0,step:mobile?1/27:1/40,
    stemGeo:new THREE.CylinderGeometry(1,1,1,5,1,true),petalGeo:flowerPetalGeometry(mobile),centerGeo:new THREE.SphereGeometry(.5,11,6),
    stemMat:new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),leafMat:new THREE.MeshLambertMaterial({side:THREE.DoubleSide,vertexColors:true}),
    petalMat:new THREE.MeshLambertMaterial({side:THREE.DoubleSide,vertexColors:true,map:flowerVeinTexture(),emissive:0xffd7bc,emissiveIntensity:.038}),
    coreMat:new THREE.MeshLambertMaterial({emissive:0xc29b41,emissiveIntensity:.025}),
    pulse:0,revealProgress:0,visualProgress:0,visualVel:0,visible:0,structureVisible:0,
    weedTotal:place?.root.getObjectByName("alpineSwayingGrass")?.count||0
  };
  if(place?.meadow?.uniforms){
    const addPetalSSS=(mat,strength,warmMix)=>{
      mat.onBeforeCompile=shader=>{
        shader.uniforms.meadowSun=place.meadow.uniforms.meadowSun;
        shader.uniforms.meadowSky=place.meadow.uniforms.meadowSky;
        shader.vertexShader="varying vec3 vFlowerWorld;\n"+shader.vertexShader.replace("#include <begin_vertex>",`
          #include <begin_vertex>
          vec4 fw=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            fw=instanceMatrix*fw;
          #endif
          vFlowerWorld=(modelMatrix*fw).xyz;
        `);
        shader.fragmentShader="uniform vec3 meadowSun;\nuniform vec4 meadowSky;\nvarying vec3 vFlowerWorld;\n"+
          shader.fragmentShader.replace("#include <dithering_fragment>",`
            vec3 fView=normalize(cameraPosition-vFlowerWorld);
            float back=pow(clamp(dot(-fView,meadowSun),0.0,1.0),3.2);
            float sunLit=.25+.75*meadowSky.x;
            vec3 sssCol=mix(vec3(1.0,.96,.84),vec3(1.0,.76,.44),meadowSky.y*${warmMix.toFixed(2)});
            gl_FragColor.rgb+=diffuseColor.rgb*sssCol*back*sunLit*${strength.toFixed(3)};
            #include <dithering_fragment>
          `);
      };
    };
    addPetalSSS(state.petalMat,.46,.85);
    addPetalSSS(state.leafMat,.30,.65);
  }
  const greens=[0x4d733e,0x628d48,0x547e42,0x698e4d];
  const flower=(x,y,z,h,size,form,axis=new THREE.Vector3(r(-.10,.10),1,r(-.11,.11)).normalize())=>({
    x,y,z,h,size,axis,form,stem:r(.0045,.0079),phase:r(0,Math.PI*2),rot:r(0,Math.PI*2),
    faceX:r(-.39,.32),faceZ:r(-.27,.50),shade:Math.floor(rng()*3),green:pick(greens),speed:r(0,.7),grow:0
  });

  // Visible immediately. Clusters leave breaks alongside the play area and steps.
  const ambient=[];
  const clumps=[[-8.35,-6.6,1.7],[7.95,-7.8,1.4],[-8.9,-.6,2.7],[8.15,2.4,2.8],
    [-8.45,9.1,2.6],[9.3,13,2.7],[-5.0,-11.6,1.9],[5.8,-11.9,2.4],[-7.5,20.2,2.2],[5.6,20.4,2.3]];
  for(const [cx,cz,width] of clumps){
    const main=pick(FLOWER_FORMS),count=mobile?12:21;
    for(let i=0;i<count;i++){
      const angle=r(0,Math.PI*2),rad=width*Math.sqrt(rng());
      let x=cx+Math.cos(angle)*rad*.52,z=cz+Math.sin(angle)*rad;
      if(Math.abs(x)<7.86&&z>-10.2&&z<19.75)x=Math.sign(x)*r(7.87,8.24);
      ambient.push(flower(x,heightAt(x,z),z,r(.23,.71),r(.085,.168),rng()<.78?main:pick(FLOWER_FORMS)));
    }
  }
  const ground=[];
  const quantity=mobile?340:720,outer=Math.floor(quantity*.64),edges=Math.floor(quantity*.20);
  for(let i=0;i<quantity;i++){
    // Interleave lawn, sidelines and playing surface while retaining the previous quotas.
    const slot=i*37%quantity,side=i%2?1:-1;
    let x,z,height,size;
    if(slot<outer){
      if(i%4===0){x=r(-14,14);z=r(COURT.farBaseline+.7,COURT.farBaseline+11);}
      else if(i%4===1){x=-r(8,14);z=r(COURT.nearBaseline-4,COURT.farBaseline+5);}
      else if(i%4===2){x=r(8,14);z=r(COURT.nearBaseline-4,COURT.farBaseline+5);}
      else{x=r(-14,14);z=r(COURT.nearBaseline-8,COURT.nearBaseline-.7);}
      height=r(.27,.72);size=r(.08,.16);
    }else if(slot<outer+edges){
      if(i%3===0){
        x=side*r(6.53,7.43);z=r(COURT.nearBaseline+.2,COURT.farBaseline-.25);
      }else{
        const baseline=i%3===1?COURT.farBaseline:COURT.nearBaseline;
        x=r(-7.19,7.19);z=baseline+(i%3===1?-1:1)*r(.17,.99);
      }
      height=r(.16,.52);size=r(.077,.14);
    }else{
      do{
        x=r(-7.15,7.15);z=r(COURT.nearBaseline+.45,COURT.farBaseline-.45);
      }while(BATTLE_SPOTS.some(spot=>Math.hypot(x-spot.p.x,z-spot.p.z)<.62));
      height=r(.13,.38);size=r(.072,.134);
    }
    const form=FLOWER_FORMS[Math.floor((Math.sin(z*.59+x*.54)+1)*1.84)];
    ground.push(flower(x,heightAt(x,z),z,height,size,rng()<.67?form:pick(FLOWER_FORMS)));
  }
  const structure=[];
  const boardCount=mobile?15:27,supportCount=mobile?32:62,rimCount=mobile?6:10;
  const attached=(part,x,y,z,axis,h,size)=>{
    const d=flower(x,y,z,h,size,pick(FLOWER_FORMS),axis.normalize());
    d.part=part;structure.push(d);
  };
  // Follow the left spruce leg, cantilever and board edge as the score rises.
  const boardZ=-8.62,footZ=boardZ-1.62;
  for(let i=0;i<supportCount;i++){
    const t=i/(supportCount-1),angle=t*Math.PI*13;
    const leg=Math.min(t/.73,1),reach=Math.max(0,(t-.73)/.27);
    const x=-.62+.52*leg+.10*reach+.087*Math.cos(angle);
    const z=footZ+.07*leg+reach*1.50+.087*Math.sin(angle);
    attached("support",x,.15+leg*3.36,z,new THREE.Vector3(Math.cos(angle)*.7,.66,Math.sin(angle)*.55),
      r(.13,.28),r(.065,.11));
  }
  for(let i=0;i<boardCount;i++){
    const t=i/(boardCount-1);
    const x=t<.56?-.93:t<.87?r(-.89,-.34):r(.76,.93);
    const y=t<.56?3.03+t/.56*1.01:4.045;
    attached("board",x,y,boardZ-.035,new THREE.Vector3(x*.43,1,.18),r(.12,.28),r(.078,.13));
  }
  for(let i=0;i<rimCount;i++){
    const a=Math.PI+i/(rimCount-1)*Math.PI,dx=Math.cos(a),dz=Math.sin(a);
    attached("rim",HOOP.x+.315*dx,HOOP.y,HOOP.z+.315*dz,
      new THREE.Vector3(dx*.68,-.22,dz*.68),r(.092,.20),r(.052,.088));
  }
  // Small, staggered flower breaks in the grass close to the low sideline sightline.
  const foreground=[[-6.9,-2.9],[-8.4,.1],[8.65,1.15],[8.2,2.30],[7.85,4.45],
    [-7.9,5.9],[7.8,9.4],[-8.4,12.2],[4.85,13.8],[-2.2,18.8]];
  for(const [cx,cz] of foreground){
    const count=mobile?10:16,main=pick(FLOWER_FORMS);
    for(let i=0;i<count;i++){
      const x=cx+(rng()+rng()-1)*1.16,z=cz+(rng()+rng()-1)*1.34;
      if(BATTLE_SPOTS.some(spot=>Math.hypot(x-spot.p.x,z-spot.p.z)<.77))continue;
      ambient.push(flower(x,heightAt(x,z),z,r(.22,.60),r(.08,.14),i%3?main:pick(FLOWER_FORMS)));
    }
  }
  state.ambient=makeFlowerLayer(state,ambient,"ambient");
  state.ground=makeFlowerLayer(state,ground,"ground");
  state.structure=makeFlowerLayer(state,structure,"structure");
  state.total=ground.length+structure.length;
  setFlowerLayerTarget(state,state.ambient,ambient.length,true);
  environmentRoot.userData.flowerState=state;
  document.documentElement.dataset.flowerCount="0";document.documentElement.dataset.flowerGround="0";
  document.documentElement.dataset.flowerStructure="0";document.documentElement.dataset.weedCount=String(state.weedTotal);
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
function smoothDampScalar(current,target,obj,velKey,smoothTime,maxSpeed,dt){
  if(dt<=0)return current;
  const st=Math.max(0.0001,smoothTime),omega=2/st,x=omega*dt;
  const exp=1/(1+x+0.48*x*x+0.235*x*x*x);
  const maxChange=maxSpeed*st;
  const change=clamp(current-target,-maxChange,maxChange);
  const clampedTarget=current-change;
  const temp=(obj[velKey]+omega*change)*dt;
  obj[velKey]=(obj[velKey]-omega*temp)*exp;
  let output=clampedTarget+(change+temp)*exp;
  if((target-current>0)===(output>target)){output=target;obj[velKey]=0;}
  return output;
}
function updateFlowerCourt(progress,dt){
  const state=environmentRoot.userData.flowerState;
  if(!state)return;
  const isBattle=typeof G!=="undefined"&&!!G&&G.mode==="battle";
  state.revealProgress=Math.max(state.revealProgress,Math.pow(clamp(progress,0,1),.88));
  state.visualProgress=smoothDampScalar(state.visualProgress,state.revealProgress,state,"visualVel",isBattle?4.6:2.2,isBattle?.028:.08,dt);
  const meadow=environmentRoot.userData.placeState?.meadow;
  if(meadow){
    meadow.flowerProgress=state.visualProgress;
    meadow.score=clamp(progress,0,1);
    state.wind=meadow.wind.value;
  }
  const groundT=clamp(state.visualProgress/.96,0,1),structureT=smoothRange(.16,.91,state.visualProgress);
  setFlowerLayerTarget(state,state.ground,Math.floor(groundT*state.ground.total));
  setFlowerLayerTarget(state,state.structure,Math.floor(structureT*state.structure.total));
  state.time+=dt;state.elapsed+=dt;
  if(state.elapsed>=state.step){
    const act=state.actors||(state.actors=[]);act.length=0;
    try{
      if(typeof player!=="undefined"&&player?.g?.visible)act.push(player.g.position.x,player.g.position.z,.86);
      if(typeof OPP!=="undefined"&&OPP?.guy?.g?.visible)act.push(OPP.guy.g.position.x,OPP.guy.g.position.z,.86);
      if(typeof passer!=="undefined"&&passer?.g?.visible)act.push(passer.g.position.x,passer.g.position.z,.78);
      if(typeof balls!=="undefined"&&Array.isArray(balls)){
        for(const b of balls)if(b?.mesh?.visible&&b.mesh.position.y<.75)act.push(b.mesh.position.x,b.mesh.position.z,.52);
      }
    }catch(e){}
    for(const layer of [state.ambient,state.ground,state.structure])updateFlowerLayer(state,layer,state.elapsed);
    state.elapsed=0;
  }
  state.visible=state.ground.target;state.structureVisible=state.structure.target;
  const allVisible=state.visible+state.structureVisible;
  document.documentElement.dataset.flowerCount=String(allVisible);
  document.documentElement.dataset.flowerGround=String(state.visible);
  document.documentElement.dataset.flowerStructure=String(state.structureVisible);
  state.pulse=Math.max(0,state.pulse-dt*2.5);
  state.petalMat.emissiveIntensity=.038+state.pulse*.022;
  state.coreMat.emissiveIntensity=.025+state.pulse*.018;
}
function bloomOnScore(points){
  const state=environmentRoot.userData.flowerState;
  if(!state)return;
  const isBattle=typeof G!=="undefined"&&!!G&&G.mode==="battle";
  const value=Math.max(1,points||3),bump=(value>=10?.055:(value>=5?.032:.019))*(isBattle?.22:1);
  state.revealProgress=clamp(state.revealProgress+bump,0,1);state.pulse=1;
}
function meadowBallWetness(){
  return environmentRoot.userData.placeState?.meadow?.ballWetness||0;
}
function splashMeadowBall(x,z,force){
  const court=environmentRoot.userData.placeState?.meadow?.court;
  if(court)AIBAMeadowCourt.ballImpact(court,x,z,force);
}
function weatherAdjustedIdeal(shot,withNoise){
  const mod=WEATHER_SHOT_MODIFIERS[currentWeather]||WEATHER_SHOT_MODIFIERS.none;
  const noise=withNoise&&mod.noiseMax>mod.noiseMin?rnd(mod.noiseMin,mod.noiseMax):0;
  return clamp(shotIdeal(shot)+mod.idealBias+noise,0,99);
}
function applyScenePreset(name,opts){
  opts=opts||{};
  if(!SCENE_PRESETS[name])name="indoor";
  cosmicGroundFX.reset();
  currentScenePreset=name;
  if(typeof camera!=="undefined"&&camera){
    const wantFar=name==="tokyoRooftop"?920:name==="flowerCourt"?630:name==="rainforest"?290:160;
    const wantNear=name==="rainforest"?.065:.28;
    if(camera.far!==wantFar||camera.near!==wantNear){
      camera.far=wantFar;camera.near=wantNear;camera.updateProjectionMatrix();
    }
  }
  if(typeof syncBallVenue==="function")syncBallVenue(name);
  if(typeof applyRackVenue==="function")applyRackVenue(name);
  const rainforest=name==="rainforest";
  const preset=SCENE_PRESETS[name],outdoor=preset.type==="outdoor",rainy=preset.weather==="rain",flower=preset.progression==="flowerBloom",beach=preset.progression==="sunsetToNight";
  currentWeather=preset.weather;
  indoorRoot.visible=!outdoor;
  rainState=null;
  sun.castShadow=false;
  if(window.AIBAWorldPlaces)AIBAWorldPlaces.restore();
  disposeEnvironmentRoot(environmentRoot);disposeEnvironmentRoot(weatherRoot);if(outdoor&&!rainforest&&!flower&&window.AIBAVisual)environmentRoot.add(AIBAVisual.makeSkyDome(THREE,name,COURT.midZ));
  resetStreetCrowd();
  if(courtFloor){
    if(outdoor&&!courtOutdoorTexture)courtOutdoorTexture=makeCourtTexture("outdoorSunny");
    courtFloor.material.map=outdoor?courtOutdoorTexture:courtIndoorTexture;
    courtFloor.material.color.setHex(rainy?0x9aa7ad:(beach?0xc0a9a0:0xffffff));if(window.AIBAVisual)AIBAVisual.tuneCourt(courtFloor,name);courtFloor.material.needsUpdate=true;
  }
  if(outdoor){
    if(beach){
      scene.background.setHex(0xe87a48);scene.fog.color.setHex(0xc97b5f);scene.fog.near=68;scene.fog.far=210;
      ambient.color.setHex(0xffd7b5);ambient.intensity=.36;
      hemi.color.setHex(0xffb47c);hemi.groundColor.setHex(0x463d44);hemi.intensity=.52;
      sun.color.setHex(0xffbe78);sun.intensity=1.25;sun.position.set(-22,8.5,-36);spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else if(rainforest){
      scene.background.setHex(0x737353);scene.fog.color.setHex(0x998c64);scene.fog.near=20;scene.fog.far=139;
      ambient.color.setHex(0xd3d8b8);ambient.intensity=.47;
      hemi.color.setHex(0xdce2bd);hemi.groundColor.setHex(0x4c4f30);hemi.intensity=.61;
      sun.color.setHex(0xffcd79);sun.intensity=1.68;sun.position.copy(AIBARainforest.light).multiplyScalar(45);
      spot.intensity=0;camFill.intensity=.17;
      arenaLights.forEach(l=>{l.intensity=0;});
      if(renderer.shadowMap?.enabled){
        sun.castShadow=true;
        const shadow=sun.shadow;
        shadow.mapSize.setScalar(AA_COARSE_POINTER?1024:2048);
        Object.assign(shadow.camera,{left:-23,right:23,top:26,bottom:-26,near:1,far:105});
        shadow.bias=-.00045;shadow.normalBias=.029;shadow.radius=2.5;shadow.camera.updateProjectionMatrix();
      }
    }else if(flower){
      scene.background.setHex(0x8cbacb);scene.fog.color.setHex(0xa8c4d0);scene.fog.near=64;scene.fog.far=925;
      ambient.color.setHex(0xe5ece9);ambient.intensity=.39;
      hemi.color.setHex(0xc3e1ef);hemi.groundColor.setHex(0x6b7848);hemi.intensity=.50;
      sun.color.setHex(0xffefcf);sun.intensity=1.12;sun.position.set(-22,32,14);
      spot.intensity=0;camFill.intensity=.18;
      arenaLights.forEach(l=>{l.intensity=0;});
      if(renderer.shadowMap?.enabled){
        sun.castShadow=true;sun.shadow.mapSize.setScalar(AA_COARSE_POINTER?1024:2048);
        sun.shadow.camera.left=-21;sun.shadow.camera.right=21;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;
        sun.shadow.camera.near=1;sun.shadow.camera.far=83;
        sun.shadow.bias=-.0005;sun.shadow.normalBias=.027;sun.shadow.radius=1.7;
        sun.shadow.camera.updateProjectionMatrix();
      }
    }else if(name==="arcticSnow"){
      scene.background.setHex(0x081524);scene.fog.color.setHex(0x536c7c);scene.fog.near=48;scene.fog.far=180;
      ambient.color.setHex(0xb8d1e5);ambient.intensity=.44;
      hemi.color.setHex(0x9fbcd5);hemi.groundColor.setHex(0xc3d5da);hemi.intensity=.58;
      sun.color.setHex(0xb9cfe5);sun.intensity=.42;sun.position.set(-14,20,-4);spot.intensity=0;camFill.intensity=.24;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else if(name==="lunarCrater"){
      /* 月球真空（阿波罗实拍质感）：无大气散射、极低环境填光、高反差炽白低角度日光、远山锐利无雾。 */
      scene.background.setHex(0x010103);scene.fog.color.setHex(0x010103);scene.fog.near=260;scene.fog.far=520;
      ambient.color.setHex(0x7d8696);ambient.intensity=.10;
      hemi.color.setHex(0x8c9ab2);hemi.groundColor.setHex(0x121418);hemi.intensity=.12;
      sun.color.setHex(0xfffdf8);sun.intensity=1.88;sun.position.set(-22,10.0,-4);
      spot.intensity=0;camFill.intensity=.10;
      arenaLights.forEach(l=>{l.intensity=0;});
      if(renderer.shadowMap&&renderer.shadowMap.enabled){
        sun.castShadow=true;
        sun.shadow.mapSize.setScalar(AA_COARSE_POINTER?1024:2048);
        sun.shadow.camera.left=-24;sun.shadow.camera.right=24;
        sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;
        sun.shadow.camera.near=1;sun.shadow.camera.far=75;
        sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.03;sun.shadow.radius=1.1;
        sun.shadow.camera.updateProjectionMatrix();
      }
    }else if(name==="tokyoRooftop"){
      /* 东京摩天楼顶夜场：920m 远景视距 + 都市夜色光雾(0x13223d) + 清晰空气透视层次。 */
      scene.background.setHex(0x040916);scene.fog.color.setHex(0x13223d);scene.fog.near=240;scene.fog.far=880;
      ambient.color.setHex(0x8498bd);ambient.intensity=.38;
      hemi.color.setHex(0x6d89bd);hemi.groundColor.setHex(0x23293a);hemi.intensity=.48;
      sun.color.setHex(0xffe8c8);sun.intensity=1.12;sun.position.set(-14,21,8);
      spot.intensity=0;camFill.intensity=.24;
      arenaLights.forEach(l=>{l.intensity=0;});
      if(renderer.shadowMap&&renderer.shadowMap.enabled){
        sun.castShadow=true;
        sun.shadow.mapSize.setScalar(AA_COARSE_POINTER?1024:2048);
        sun.shadow.camera.left=-20;sun.shadow.camera.right=20;
        sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;
        sun.shadow.camera.near=1;sun.shadow.camera.far=70;
        sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.03;sun.shadow.radius=1.4;
        sun.shadow.camera.updateProjectionMatrix();
      }
    }else if(name==="spanishQuarter"){
      scene.background.setHex(0x6093af);scene.fog.color.setHex(0xcdbb9e);scene.fog.near=48;scene.fog.far=135;
      ambient.color.setHex(0xd5dce0);ambient.intensity=.3;
      hemi.color.setHex(0xb8ced8);hemi.groundColor.setHex(0x886e51);hemi.intensity=.45;
      sun.color.setHex(0xffe0aa);sun.intensity=1.35;sun.position.set(-22,24,9);spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else if(name==="medCliff"){
      /* 下午 4~5 点(文档 §灯光):暖金阳光斜射,建筑受光面亮、背光面冷,
         明暗对比要看得出来 —— 所以 sun 给足、ambient 压住,不能靠环境光洗平。 */
      scene.background.setHex(0x2b7fb4);scene.fog.color.setHex(0xcfe0de);scene.fog.near=95;scene.fog.far=330;
      ambient.color.setHex(0xe8eef0);ambient.intensity=.34;
      hemi.color.setHex(0x9fd0e6);hemi.groundColor.setHex(0x9a8f74);hemi.intensity=.48;
      sun.color.setHex(0xffe0ac);sun.intensity=1.25;sun.position.set(-26,17,6);
      spot.intensity=0;camFill.intensity=.2;
      arenaLights.forEach(l=>{l.intensity=0;});
    }else if(name==="shonanCoast"){
      /* 夏末傍晚金色夕阳(文档 §灯光):太阳压得很低并且在**海那一侧**(-x),
         所以校舍受光面暖、朝球场的一面留冷影,明暗有方向。
         不用 beachSunset 那套日落橙 —— 那是"日落时刻",这里要的是"放学时分"。 */
      /* 雾别太厚:第一版 near46/far132 把海、校舍、远山一起洗成奶白,
         "一侧校园一侧海"的对比全没了。拉到 58/190 仍有夏日海雾,但物体读得出。 */
      scene.background.setHex(0x8fb6cd);scene.fog.color.setHex(0xd6cfb6);scene.fog.near=58;scene.fog.far=190;
      ambient.color.setHex(0xf2e6cf);ambient.intensity=.40;
      hemi.color.setHex(0xbcd6e4);hemi.groundColor.setHex(0x6b6a5c);hemi.intensity=.52;
      sun.color.setHex(0xffcf8a);sun.intensity=1.05;sun.position.set(-34,9,-16);
      spot.intensity=0;camFill.intensity=.2;
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
    if(!sun.castShadow&&renderer.shadowMap&&renderer.shadowMap.enabled){
      sun.castShadow=true;
      sun.shadow.mapSize.setScalar(AA_COARSE_POINTER?1024:2048);
      sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;
      sun.shadow.camera.near=1;sun.shadow.camera.far=90;
      sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.028;sun.shadow.radius=1.8;
      sun.shadow.camera.updateProjectionMatrix();
    }
    const place=window.AIBAWorldPlaces&&(AIBAWorldPlaces.enabled||flower||rainforest);
    if(place){
      AIBAWorldPlaces.build(environmentRoot,name);
      if(rainy)buildRainWeather();
      if(flower)buildFlowerCourt();
    }else{
      if(beach)buildBeachSunset();
      else{buildOutdoorPark(rainy,flower);if(rainy)buildRainWeather();if(flower)buildFlowerCourt();}
      if(window.AIBAEnvironmentCraft)AIBAEnvironmentCraft.build(environmentRoot,name);
    }
    if(!rainforest)buildStreetCrowd({beach,rainy,flower,place:place?name:null});
  }else{
    /* 室内是唯一有"主光"的预设,四盏灯的分工见 rendering/core.js 顶部。
       这里必须把 core.js 的默认值逐项重写一遍 —— 切过一次户外场景再切回来,
       灯位/强度全被上面的分支改过了,漏写哪一项,那一项就停在户外的值上。 */
    /* 不用纯黑当背景。顶棚和横幅墙之间那条缝里没有几何体,露出来的就是背景色 ——
       纯黑在那里读作"破洞",带一点蓝的深色才读作"暗处的空气"。 */
    scene.background.setHex(0x05070e);
    scene.fog.color.setHex(0x080a14);scene.fog.near=26;scene.fog.far=96;
    ambient.color.setHex(0x8494b8);ambient.intensity=.36;
    hemi.color.setHex(0x647ab0);hemi.groundColor.setHex(0x1a120d);hemi.intensity=.34;
    sun.color.setHex(0xffe0b2);sun.intensity=.28;sun.position.set(6.5,22,5);
    spot.color.setHex(0xfff2d8);spot.intensity=.42;spot.distance=54;spot.angle=.68;spot.penumbra=.68;spot.decay=1.05;
    spot.position.set(6.2,16.5,4.2);spot.target.position.set(0,.9,-4.2);spot.target.updateMatrixWorld();
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
    /* .05→0。**这里才是 rim 的权威值**(core.js 那份是初始化值,切场景会被本行覆盖)。
       关闭理由见 core.js:它是地板宽幅洗白的唯一来源(16° 掠射角下 Fresnel 主导),
       而对人物几乎无贡献(背光,相机看到的正面吃不到,P95 实测不变)。
       曾试图用 layers 让"rim 只照人物不照地板",实测 RGB 差 0.0000 证明无效(r128
       灯光按相机 layers 收集,无 selective lighting),该方案已撤销。 */
    rim.intensity=0;rim.position.set(-5,4.5,-15);
    camFill.intensity=0.25;camFill.distance=12;camFill.position.set(0,-.15,1);
    updJumbo();
  }
  document.documentElement.dataset.scenePreset=name;
  document.documentElement.dataset.weather=currentWeather;
  document.documentElement.dataset.progression=preset.progression;
  if(!flower){delete document.documentElement.dataset.flowerCount;delete document.documentElement.dataset.flowerGround;delete document.documentElement.dataset.flowerStructure;delete document.documentElement.dataset.flowerMeadow;delete document.documentElement.dataset.weedCount;}
  if(!beach&&!flower)delete document.documentElement.dataset.environmentPhase;
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
}function resetProgressiveSceneForRun(){cosmicGroundFX.reset();if(window.AIBASceneLifecycle)return AIBASceneLifecycle.resetForRun();const preset=SCENE_PRESETS[currentScenePreset];if(preset&&preset.progression!=="none")applyScenePreset(currentScenePreset,{persist:false});}
function getEnvironmentProgress(){
  if(G.state==="boot"||G.state==="menu"||G.state==="diff"||G.state==="intro")return 0;
  const timedVenue=currentScenePreset==="rainforest"||currentScenePreset==="lunarCrater";
  if(G.mode==="battle")return clamp(Math.max(G.score||0,G.battleOppScore||0)/BATTLE_TARGET,0,1);
  if(G.mode==="rackrush"&&G.rush){
    if((currentScenePreset==="flowerCourt"||timedVenue)&&isRackRushSpeed(G.rush))return clamp((G.rush.total||0)/RACK_RUSH_SPEED_TARGET,0,1);
    return clamp((G.rush.level+(G.timer<=0?1:1-G.timer/Math.max(1,(RACK_RUSH_LEVELS[G.rush.level]||RACK_RUSH_LEVELS[0]).time)))/RACK_RUSH_LEVELS.length,0,1);
  }
  if(G.mode==="contest"){
    const scoreP=clamp((G.score||0)/(timedVenue?24:40),0,1);
    if(timedVenue){
      const shotP=(G.seq&&G.seq.length)?clamp((G.shotIdx||0)/G.seq.length,0,1):0;
      const roundDur=Math.max(1,(typeof ROUND_TIME!=="undefined"&&ROUND_TIME)||70);
      const timeP=(typeof G.timer==="number"&&isFinite(G.timer))?clamp(1-G.timer/roundDur,0,1):0;
      return Math.max(scoreP,shotP,timeP);
    }
    return scoreP;
  }
  return timedVenue?clamp((G.score||0)/24,0,1):0;
}
function updateEnvironment(dt){
  const progress=getEnvironmentProgress();
  environmentRoot.userData.progress=progress;
  updateRain(dt);
  updateFlowerCourt(progress,dt);
  updateBeachSunset(progress,dt);
  if(window.AIBAWorldPlaces)AIBAWorldPlaces.update(dt,progress);
}

window.AIBA.runtime.register("rendering:environments",Object.freeze({
  disposeEnvironmentRoot,buildOutdoorPark,buildRainWeather,buildFlowerCourt,buildBeachSunset,
  updateBeachSunset,updateRain,updateFlowerCourt,bloomOnScore,applyScenePreset,
  resetProgressiveSceneForRun,getEnvironmentProgress,updateEnvironment
}));
