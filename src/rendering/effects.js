/* shadow blob */
const blobGeo=new THREE.CircleGeometry(0.18,8);
const blobMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35});

/* particles: fire trail + confetti */
const fireN=90;
const firePos=new Float32Array(fireN*3), fireLife=new Float32Array(fireN);
const fireGeoB=new THREE.BufferGeometry();
fireGeoB.setAttribute("position",new THREE.BufferAttribute(firePos,3));
const firePts=new THREE.Points(fireGeoB,new THREE.PointsMaterial({color:0xff7b1c,size:0.22,transparent:true,opacity:0.9}));
firePts.frustumCulled=false;scene.add(firePts);
let fireIdx=0;
function emitFire(p){
  firePos[fireIdx*3]=p.x+rnd(-.05,.05);firePos[fireIdx*3+1]=p.y+rnd(-.05,.05);firePos[fireIdx*3+2]=p.z+rnd(-.05,.05);
  fireLife[fireIdx]=0.5;fireIdx=(fireIdx+1)%fireN;
}
function updFire(dt){
  let alive=false;
  for(let i=0;i<fireN;i++){
    if(fireLife[i]>0){alive=true;fireLife[i]-=dt;firePos[i*3+1]+=dt*0.7;
      if(fireLife[i]<=0)firePos[i*3+1]=-99;}
  }
  if(alive)fireGeoB.attributes.position.needsUpdate=true;
}
const confN=260;
const confPos=new Float32Array(confN*3),confVel=[];
const confGeo=new THREE.BufferGeometry();
confGeo.setAttribute("position",new THREE.BufferAttribute(confPos,3));
const confPts=new THREE.Points(confGeo,new THREE.PointsMaterial({size:0.18,vertexColors:true}));
const confCol=new Float32Array(confN*3);
confGeo.setAttribute("color",new THREE.BufferAttribute(confCol,3));
confPts.frustumCulled=false;confPts.visible=false;scene.add(confPts);
function startConfetti(){
  confPts.visible=true;
  const cols=[[1,.82,.25],[.3,.9,.4],[.4,.6,1],[1,.4,.4],[1,1,1]];
  for(let i=0;i<confN;i++){
    confPos[i*3]=rnd(-8,8);confPos[i*3+1]=rnd(8,16);confPos[i*3+2]=rnd(-12,2);
    confVel[i]=V3(rnd(-.4,.4),rnd(-2.4,-1.2),rnd(-.4,.4));
    const c=cols[(Math.random()*cols.length)|0];
    confCol[i*3]=c[0];confCol[i*3+1]=c[1];confCol[i*3+2]=c[2];
  }
}
let _confAcc=0;
function updConf(dt){
  if(!confPts.visible)return;
  _confAcc+=dt;if(_confAcc<1/20)return;
  const step=Math.min(.1,_confAcc);_confAcc=0;
  for(let i=0;i<confN;i++){
    confPos[i*3]+=confVel[i].x*step+Math.sin(G.tNow*3+i)*0.01;
    confPos[i*3+1]+=confVel[i].y*step;
    confPos[i*3+2]+=confVel[i].z*step;
    if(confPos[i*3+1]<0.05)confPos[i*3+1]=rnd(10,15);
  }
  confGeo.attributes.position.needsUpdate=true;
}

/* ---------------- tween helper ---------------- */
const tweens=[];
const ease=k=>k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
function tween(dur,fn,done){tweens.push({t:0,dur,fn,done});}
function updTweens(dt){
  for(let i=tweens.length-1;i>=0;i--){
    const w=tweens[i];w.t+=dt;
    const k=Math.min(1,w.t/w.dur);w.fn(ease(k));
    if(k>=1){tweens.splice(i,1);if(w.done)w.done();}
  }
}
function glideTo(p,l,dur,cb){
  const p0=rig.pos.clone(),l0=rig.look.clone(),pt=p.clone(),lt=l.clone();
  G.moving=true;G.glideCam=true;
  tween(dur,k=>{
    rig.pos.lerpVectors(p0,pt,k);
    rig.pos.y+=Math.sin(k*Math.PI)*0.35;
    rig.look.lerpVectors(l0,lt,k);
  },()=>{G.moving=false;G.glideCam=false;if(cb)cb();});
}
function shotEye(shot){
  const base=shotBase(shot);
  const dir=HOOP.clone().sub(base);dir.y=0;dir.normalize();
  return base.clone().addScaledVector(dir,-0.25).setY(EYE);
}

/* ---------------- shooting & balls ---------------- */

window.AIBA.runtime.register("rendering:effects",Object.freeze({
  blobGeo,blobMat,firePts,confPts,emitFire,updFire,startConfetti,updConf,
  tween,updTweens,glideTo,shotEye
}));


// The last beat of a cosmic shot is timed from its first simulated floor contact.
// Both live play and replay sample the same little set of reusable props.
const cosmicGroundFX=(()=>{
  let group,wave,dust,print,flecks,bowl,cracks,restingBall,vegetation;
  let activeProfile;
  let liveImpact=null,sampling=false;
  const pitCut={value:new THREE.Vector3()},pitShape={value:new THREE.Vector3(1,1,0)};
  const patchedGround=new WeakSet();
  const duration=5.6,speed=34,reach=48;
  let frontAge=-Infinity;
  const people=[];
  const count=48,pose=new THREE.Object3D();
  function layer(file,ring=false){
    const map=new THREE.TextureLoader().load("assets/effects/"+file);
    map.encoding=THREE.sRGBEncoding;
    const mat=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,
      polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false});
    const geo=ring?new THREE.RingGeometry(.47,1,72,6):new THREE.PlaneGeometry(1,1);
    if(ring){
      const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),angle=Math.atan2(y,x);
        const ridge=Math.exp(-(((Math.hypot(x,y)-.72)/.11)**2));
        pos.setZ(i,ridge*(.8+.25*Math.sin(5*angle)+.20*Math.sin(9*angle+.4)));
      }
      geo.computeBoundingSphere();
    }
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=-Math.PI/2;group.add(mesh);return mesh;
  }
  // radius, X/Z proportions, edge roughness, depth, fracture pattern and debris colors.
  const groundProfiles={
    indoor:{radius:.43,x:1.27,z:.83,rough:.28,depth:.19,count:5,length:.69,inside:0x32241f,edge:0x825f40,grain:true},
    flowerCourt:{radius:.45,x:1.06,z:.90,rough:.37,depth:.21,count:4,length:.29,inside:0x422e20,edge:0x856b3f},
    rainforest:{radius:.43,x:.93,z:1.11,rough:.36,depth:.22,count:4,length:.36,inside:0x32281e,edge:0x6c593b},
    lunarCrater:{radius:.46,x:1.13,z:.91,rough:.32,depth:.22,count:6,length:.53,inside:0x464142,edge:0x706760},
    spanishQuarter:{radius:.44,x:1.12,z:.91,rough:.34,depth:.19,count:5,length:.41,inside:0x583629,edge:0xad7152},
    arcticSnow:{radius:.43,x:1.06,z:.95,rough:.23,depth:.18,count:6,length:.66,inside:0x556e7b,edge:0xb8cad1},
    rainyCourt:{radius:.42,x:1.12,z:.92,rough:.28,depth:.18,count:5,length:.48,inside:0x363233,edge:0x777176},
    hardCourt:{radius:.43,x:1.10,z:.91,rough:.24,depth:.18,count:6,length:.48,inside:0x444344,edge:0x8b8682}
  };
  function rimRadius(a,g){
    return g.radius*(1+g.rough*(.56*Math.sin(a*3+.25)+.30*Math.sin(a*7-1.1)+.26*Math.sin(a*11+.48)));
  }
  function createBowl(g){
    const segments=64,positions=[],colors=[],indices=[],uv=[];
    const rings=[.001,.32,.66,.86,.98,1.13];
    const inner=new THREE.Color(g.inside).convertSRGBToLinear();
    const lip=new THREE.Color(g.edge).convertSRGBToLinear();
    const tint=new THREE.Color();
    for(let r=0;r<rings.length;r++){
      const u=rings[r];
      for(let i=0;i<segments;i++){
        const a=i*2*Math.PI/segments,radius=rimRadius(a,g)*u;
        const chips=.55+.31*Math.sin(a*9+.7)+.15*Math.sin(a*21);
        const y=r===rings.length-1?-.022:
          -g.depth*(1-u**3)+.051*chips*u**4+.014*Math.sin(a*13+r*2.6)*Math.sin(u*Math.PI);
        const x=Math.cos(a)*radius*g.x,z=Math.sin(a)*radius*g.z;
        positions.push(x,y,z);
        uv.push(.5+x/230,.5-z/230);
        tint.copy(inner).lerp(lip,Math.min(1,u**2)*(.70+.30*chips));
        tint.multiplyScalar(.91+.09*Math.sin(a*17+r*.71)+.08*Math.sin(a*6-r*3.1));
        colors.push(tint.r,tint.g,tint.b);
        if(!r)continue;
        const j=r*segments+i,k=r*segments+(i+1)%segments;
        indices.push(j-segments,k-segments,j,j,k-segments,k);
      }
    }
    if(g.grain){
      // Torn strips of floorboard retain paint on top and expose wood at the break.
      const paint=new THREE.Color(0x473554).convertSRGBToLinear();
      for(let i=0;i<7;i++){
        const a=(i<4?1:-1)*(Math.PI*.30+(i%4)*.41);
        const x=Math.cos(a)*rimRadius(a,g)*g.x,z=Math.sin(a)*rimRadius(a,g)*g.z;
        const sign=Math.sign(z),width=.026+(i%3)*.014,length=.10+(i%3)*.037;
        const start=positions.length/3;
        positions.push(x-width,.005,z+.025*sign,x+width,.005,z+.033*sign,
          x+.43*width,.044,z-.52*length*sign,x-.23*width,-.032,z-length*sign);
        for(const c of [paint,paint,lip,inner])colors.push(c.r,c.g,c.b);
        uv.push(0,0,0,0,0,0,0,0);
        if(sign>0)indices.push(start,start+1,start+2,start,start+2,start+3);
        else indices.push(start,start+2,start+1,start,start+3,start+2);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    return geo;
  }
  function createCracks(g){
    const positions=[],colors=[];
    // Offset the path at each step and fade the thinner tips into the surface.
    const dark=new THREE.Color(g.inside).multiplyScalar(.24).convertSRGBToLinear();
    const exposed=new THREE.Color(g.edge).multiplyScalar(.78).convertSRGBToLinear();
    let state=5319;
    function random(){
      state=(Math.imul(1664525,state)+1013904223)>>>0;
      return state/4294967296;
    }
    function strip(points,width){
      for(let i=0;i<points.length;i++){
        const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(i+1,points.length-1)];
        const dx=next[0]-prev[0],dz=next[1]-prev[1];
        const w=width*(.04+.96*(1-i/(points.length-1))**.72)/Math.hypot(dx,dz);
        // One lit edge next to a broader, dark opening.
        positions.push(p[0]-dz*w,.004,p[1]+dx*w,p[0],.006,p[1],
          p[0]+dz*w*.38,.009,p[1]-dx*w*.38);
        const alpha=1-i/(points.length-1);
        colors.push(dark.r,dark.g,dark.b,alpha,dark.r,dark.g,dark.b,alpha,
          exposed.r,exposed.g,exposed.b,alpha*.68);
      }
    }
    const indices=[];
    function seam(points,width){
      const start=positions.length/3;
      strip(points,width);
      for(let i=0;i<points.length-1;i++){
        const n=start+i*3;
        indices.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);
      }
    }
    for(let i=0;i<g.count;i++){
      const a=g.grain?(i%2?Math.PI*.52:Math.PI*1.49)+(random()-.5)*.39:
        i*2*Math.PI/g.count+(random()-.5)*.68;
      const radius=rimRadius(a,g),len=g.length*(.46+random()*.54);
      const points=[];
      for(let j=0;j<=6;j++){
        const u=j/6,r=radius*.92+u*len;
        const jitter=j?(random()-.5)*(g.grain?.095:.21)*Math.sin(u*2.4):0;
        points.push([Math.cos(a)*r*g.x+jitter*Math.sin(a),Math.sin(a)*r*g.z-jitter*Math.cos(a)]);
      }
      const width=(g.grain?.010:.021)*(.72+random()*.56);
      seam(points,width);
      if(i%3!==1){
        const p=points[2],fork=a+(i%2?-1:1)*(.43+random()*.45);
        seam([p,[p[0]+Math.cos(fork)*len*.26,p[1]+Math.sin(fork)*len*.26],
          [p[0]+Math.cos(fork+.24)*len*.59,p[1]+Math.sin(fork+.24)*len*.59]],width*.60);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,4));
    geo.setIndex(indices);
    return geo;
  }
  function cutFloor(material,worldPosition){
    if(!material||patchedGround.has(material))return;
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey.call(material);
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      shader.uniforms.cosmicPit=pitCut;
      shader.uniforms.cosmicPitShape=pitShape;
      if(!worldPosition){
        shader.vertexShader="varying vec2 pitWorld;\n"+shader.vertexShader.replace("#include <project_vertex>",
          "pitWorld=(modelMatrix*vec4(transformed,1.0)).xz;\n#include <project_vertex>");
      }
      const varying=worldPosition?"":"varying vec2 pitWorld;\n";
      shader.fragmentShader=varying+"uniform vec3 cosmicPit, cosmicPitShape;\n"+shader.fragmentShader.replace("#include <clipping_planes_fragment>",`
        #include <clipping_planes_fragment>
        if(cosmicPit.z>0.0){
          vec2 delta=(${worldPosition||"pitWorld"}-cosmicPit.xy)/cosmicPitShape.xy;
          float radius=length(delta);
          if(radius<cosmicPit.z*1.5){
            float a=atan(delta.y,delta.x);
            float edge=1.0+cosmicPitShape.z*(.56*sin(a*3.0+.25)+.30*sin(a*7.0-1.1)+.26*sin(a*11.0+.48));
            if(radius<cosmicPit.z*edge)discard;
          }
        }`);
    };
    material.customProgramCacheKey=()=>key+":cosmicPitShaped";
    material.needsUpdate=true;patchedGround.add(material);
  }
  function prepare(venue){
    if(!group){
      group=new THREE.Group();group.name="cosmicFloorPressure";
      print=layer("pressure-print.png");wave=layer("pressure-wave.png",true);
      cutFloor(print.material);
      print.renderOrder=2;wave.renderOrder=3;
      dust=wave.clone();dust.material=wave.material.clone();dust.renderOrder=2;group.add(dust);
      bowl=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96}));
      bowl.name="cosmicCrater";bowl.receiveShadow=true;
      cracks=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({
        vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide
      }));
      cracks.name="cosmicCracks";cracks.renderOrder=1;
      group.add(bowl,cracks);
      restingBall=new THREE.Mesh(ballGeo,matBall);restingBall.name="cosmicRestingBall";
      restingBall.castShadow=true;group.add(restingBall);
      flecks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(1,0),
        new THREE.MeshBasicMaterial({transparent:true,depthWrite:false}),count);
      flecks.frustumCulled=false;flecks.renderOrder=4;group.add(flecks);
    }
    const colors=venue==="flowerCourt"?[0xd3bd82,0xefd9ab,0xb39a79]:venue==="rainforest"?[0x9d955c,0xaa7d4b,0x77764b]:
      venue==="lunarCrater"?[0xa7a9ac,0xd0c8bb,0x928d89]:[0xc9bea9,0xe2d7bf,0xb3a68e];
    const tint=new THREE.Color();
    for(let i=0;i<count;i++)flecks.setColorAt(i,tint.setHex(colors[i%3]));
    flecks.instanceColor.needsUpdate=true;
    const place=environmentRoot.userData.placeState;
    const terrain={lunarCrater:"lunarTerrain",flowerCourt:"alpineMeadowGround",rainforest:"rainforestCourtGround"}[venue];
    const floor=terrain?environmentRoot.getObjectByName(terrain)?.material:courtFloor?.material;
    cutFloor(floor);
    const regolith=venue==="lunarCrater"?floor?.bumpMap||null:null;
    if(bowl.material.bumpMap!==regolith){
      bowl.material.bumpMap=regolith;
      bowl.material.bumpScale=.11;
      bowl.material.needsUpdate=true;
    }
    if(venue==="flowerCourt"){
      cutFloor(environmentRoot.getObjectByName("meadowTurfFurShells")?.material,"vFurWorld.xz");
      cutFloor(environmentRoot.getObjectByName("alpineSwayingGrass")?.material,"vGrassWorld.xz");
    }
    scene.traverse(o=>{
      if(o.isMesh&&(o.name==="courtZone"||o.name==="courtLine"||o.name==="courtMark"))cutFloor(o.material);
    });
    const profile=groundProfiles[venue]||groundProfiles.hardCourt;
    if(profile!==activeProfile){
      activeProfile=profile;
      bowl.geometry.dispose();bowl.geometry=createBowl(profile);
      cracks.geometry.dispose();cracks.geometry=createCracks(profile);
      pitShape.value.set(profile.x,profile.z,profile.rough);
    }
    vegetation=place?.meadow?.uniforms.meadowPressure.value||place?.rainforest?.uniforms.forestPressure.value;
    people.length=0;
    const crowd=venue==="indoor"?nearCourtCrowd:streetCrowd;
    for(const person of crowd.people){
      people.push({person,weight:0,instMatrix:person.realInst?new THREE.Matrix4():null});
    }
    group.visible=false;
    pitCut.value.z=0;
    scene.add(group);
    sampling=true;
  }
  function land(impact,mesh){
    // Retain the latest impact in this round, separately from replay playback.
    liveImpact={impact,mesh,venue:currentScenePreset,age:0};
  }
  function draw(age,impact,venue,mesh){
    frontAge=age;
    group.visible=!!impact&&age>-1.15;
    if(!group.visible){if(vegetation)vegetation.w=0;pitCut.value.z=0;return;}
    const place=environmentRoot.userData.placeState;
    const ground=place?.heightAt||place?.wonder?.terrainY;
    const y=ground?ground(impact.x,impact.z):0;
    group.position.set(impact.x,y+.013,impact.z);
    const sunk=THREE.MathUtils.smoothstep(age,-.015,.085);
    const landed=age>=0;
    pitCut.value.set(impact.x,impact.z,landed?activeProfile.radius:0);
    bowl.visible=cracks.visible=restingBall.visible=landed;
    if(landed){
      bowl.scale.y=.12+.88*sunk;
      cracks.material.opacity=.45+.55*sunk;
      restingBall.material=mesh.material;
      restingBall.quaternion.copy(mesh.quaternion);
      restingBall.position.set(0,AIBABallPhysics.GEOM.ballR-(activeProfile.depth-.021)*sunk,0);
    }
    const before=age<0,phase=clamp(before?(age+1.15)/1.15:age*speed/reach,0,1);
    const radius=before?.4+6.8*phase:.35+reach*phase;
    const strength=before?.76*Math.sin(Math.PI*phase):1-THREE.MathUtils.smoothstep(phase,.48,1);
    wave.scale.set(radius/.72,radius/.72,before?.18:.18+1.40*Math.min(1,age*4));
    wave.position.y=before?.10+.16*(1-phase):.12+.45*phase;
    wave.material.opacity=before?strength:strength*THREE.MathUtils.smoothstep(age,0,.055);
    wave.visible=wave.material.opacity>.01;
    if(vegetation)vegetation.set(impact.x,impact.z,radius,before?strength:(1-.55*phase)*(1-THREE.MathUtils.smoothstep(age,reach/speed,duration)));
    const dissipate=1-THREE.MathUtils.smoothstep(age,.65,duration);
    dust.visible=landed&&age<duration;
    if(dust.visible){
      const drift=THREE.MathUtils.smoothstep(age,0,duration);
      const size=4.6+13*drift;
      dust.scale.set(size,size,.38+.72*drift);
      dust.position.y=.11+.38*drift;
      dust.rotation.z=age*.10;
      dust.material.opacity=.92*THREE.MathUtils.smoothstep(age,0,.22)*dissipate;
    }
    const compression=THREE.MathUtils.smoothstep(age,-.88,-.035);
    print.visible=compression>0;print.scale.setScalar(4.85*(.77+.23*compression));
    print.material.opacity=(.70*compression+.30*sunk)*(venue==="indoor"?.54:1.15);
    flecks.visible=age>=0&&age<1.15;
    if(!flecks.visible)return;
    for(let i=0;i<count;i++){
      const a=i*2.39996,spread=(i*37%23)/23;
      const phase=Math.min(1,age/(.50+.65*spread));
      const r=activeProfile.radius*(.65+spread*.49)+(1-(1-phase)**2)*(2.30+spread*4.30);
      pose.position.set(Math.cos(a)*r,.036+4*phase*(1-phase)*(.24+.74*spread),Math.sin(a)*r);
      pose.rotation.set(3*phase+a,a*.2,2*phase-a);
      const size=(.053+.058*spread)*(1-phase*phase);
      pose.scale.set(size*1.5,size*.45,size*.7);pose.updateMatrix();
      flecks.setMatrixAt(i,pose.matrix);
    }
    flecks.instanceMatrix.needsUpdate=true;
  }
  function tick(dt){
    if(!liveImpact)return;
    const impact=liveImpact;
    if(impact.age>=duration)return;
    impact.age=Math.min(duration,impact.age+dt);
    if(!sampling)draw(impact.age,impact.impact,impact.venue,impact.mesh);
  }
  function endView(){
    sampling=false;
    if(liveImpact){
      draw(liveImpact.age,liveImpact.impact,liveImpact.venue,liveImpact.mesh);
    }else{
      frontAge=-Infinity;
      if(vegetation)vegetation.w=0;
      pitCut.value.z=0;
      if(group)group.visible=false;
    }
  }
  // Sample the travelling front in world metres. A subject reacts only after it arrives.
  function response(x,z){
    if(frontAge<0||frontAge>=reach/speed+.63)return 0;
    const d=Math.hypot(x-group.position.x,z-group.position.z),t=frontAge-d/speed;
    if(t<=0||t>=.63||d>reach)return 0;
    return THREE.MathUtils.smoothstep(t,0,.085)*(1-THREE.MathUtils.smoothstep(t,.12,.63))*(1-.45*d/reach);
  }
  // Render-only offsets let drinking, walking and cheering resume in their current pose.
  function reacting(){return frontAge>=0&&frontAge<reach/speed+.63;}
  function braceCrowd(){
    if(!reacting())return;
    for(const entry of people){
      const p=entry.person,g=p.g,w=response(g.position.x,g.position.z);
      if(!w)continue;
      const l=p.arms[0],r=p.arms[1];
      entry.weight=w;entry.tilt=g.rotation.z;entry.squat=g.scale.y;
      entry.left=l.rotation.x;entry.right=r.rotation.x;
      g.rotation.z-=Math.sign(g.position.x-group.position.x)*w*.30;
      g.scale.y*=1-.19*w;
      l.rotation.x=THREE.MathUtils.lerp(entry.left,2.34,w);
      r.rotation.x=THREE.MathUtils.lerp(entry.right,2.10,w);
      if(p.realInst){
        const {inst,index}=p.realInst;inst.getMatrixAt(index,entry.instMatrix);
        pose.scale.set(1,1-.19*w,1);
        _specMatParent.compose(g.position,g.quaternion,pose.scale);
        _specMatOut.multiplyMatrices(_specMatParent,p.realSpec.localMat);
        inst.setMatrixAt(index,_specMatOut);inst.instanceMatrix.needsUpdate=true;
      }
    }
  }
  function releaseCrowd(){
    for(const entry of people){
      if(!entry.weight)continue;
      const p=entry.person;
      p.g.rotation.z=entry.tilt;p.g.scale.y=entry.squat;
      p.arms[0].rotation.x=entry.left;p.arms[1].rotation.x=entry.right;
      if(p.realInst){
        p.realInst.inst.setMatrixAt(p.realInst.index,entry.instMatrix);p.realInst.inst.instanceMatrix.needsUpdate=true;
      }
      entry.weight=0;
    }
  }
  function reset(){
    liveImpact=null;
    endView();
    people.length=0;vegetation=null;
    if(group?.parent)group.parent.remove(group);
  }
  return {prepare,sample:draw,land,tick,endView,reset,response,reacting,braceCrowd,releaseCrowd};
})();
