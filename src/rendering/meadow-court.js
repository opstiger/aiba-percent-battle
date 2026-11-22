/* The meadow's handmade hoops, standing water and rain-dependent wildlife. */
(function(global){
  "use strict";
  const {clamp,smoothstep,lerp}=THREE.MathUtils;
  const tau=Math.PI*2;
  const pools=[
    [-1.20,-6.8,1.34,.76],[2.13,-4.1,1.22,.55],[-3.4,-1.9,1.20,.74],[.56,.8,1.34,.66],
    [5.8,4.6,1.35,.68],[-5.9,7.7,1.02,.71],[1.8,13.2,1.50,.67],[-.55,17.1,1.09,.81]
  ];
  function poolShape(x,z){
    let nearest=4;
    for(const [cx,cz,rx,rz] of pools)nearest=Math.min(nearest,Math.hypot((x-cx)/rx,(z-cz)/rz));
    return nearest;
  }
  const waterGLSL=`
    float poolShape(vec2 p){
      float edge=4.0;
      ${pools.map(([x,z,rx,rz])=>`edge=min(edge,length((p-vec2(${x.toFixed(2)},${z.toFixed(2)}))/vec2(${rx.toFixed(2)},${rz.toFixed(2)})));`).join("\n")}
      return edge;
    }
  `;

  function woodMap(random){
    const canvas=document.createElement("canvas");canvas.width=768;canvas.height=448;
    const g=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
    const beige=["#856c50","#9d8058","#957b56","#7e674b","#a6875e"];
    g.fillStyle=beige[0];g.fillRect(0,0,w,h);
    for(let row=0;row<5;row++){
      const y=h*row/5,dh=h/5;
      g.fillStyle=beige[row];g.fillRect(0,y,w,dh);
      // Warm sun-bleached top edge & damp lower wood stain per horizontal spruce slab.
      const grad=g.createLinearGradient(0,y,0,y+dh);
      grad.addColorStop(0,"rgba(235,204,158,.14)");
      grad.addColorStop(.75,"rgba(0,0,0,0)");
      grad.addColorStop(1,"rgba(52,40,26,.24)");
      g.fillStyle=grad;g.fillRect(0,y,w,dh);
      for(let i=0;i<185;i++){
        const x=random()*w,yy=y+random()*dh,end=Math.min(w,x+22+random()*340);
        g.strokeStyle=i%4?"rgba(55,36,21,.19)":"rgba(243,212,166,.22)";
        g.lineWidth=.3+random()*1.8;g.beginPath();g.moveTo(x,yy);
        g.bezierCurveTo(lerp(x,end,.30),yy+random()*2.2,lerp(x,end,.60),yy-random()*4.2,end,yy+random()*3.2);g.stroke();
      }
      // Subtle weathered cracks & seam darkening between horizontal slabs.
      g.fillStyle="#3a2e1f";g.fillRect(0,y,w,2+random()*3.5);
      g.fillStyle="rgba(234,198,144,.48)";g.fillRect(0,y+4.5,w,1);
    }
    // Natural spruce knots.
    for(const [x,y,rx,ry] of [[143,88,16,6.5],[611,208,23,7.5],[478,342,13,4.5],[240,266,11,4]]){
      for(let i=0;i<7;i++){
        g.beginPath();g.ellipse(x,y,rx+i*4,ry+i*.85,-.11,0,tau);
        g.lineWidth=1.1;g.strokeStyle=i?"rgba(60,38,21,.24)":"#4e331c";g.stroke();
      }
    }
    // Hand-brushed pasture lime-white aiming box only (leave outer live-edge wood raw and natural).
    g.strokeStyle="#e4d6b0";g.lineWidth=10;g.lineJoin="round";
    g.strokeRect(w*(.5-.31/1.9),h*(1-(3.44-2.95)/1.1),w*.62/1.9,h*.36/1.1);
    // Dry-brush flaking & ball scuffs around the aiming box.
    for(let i=0;i<90;i++){
      const x=34+random()*(w-68),y=random()*h;
      g.fillStyle=i%2?"rgba(88,62,38,.14)":"rgba(232,216,176,.17)";g.fillRect(x,y,1+random()*7,1+random()*14);
    }
    for(let i=0;i<64;i++){
      const x=w*(.50+(random()+random()-1)*.22),y=h*(.67+(random()+random()-1)*.28);
      g.lineWidth=.6+random()*2.5;g.strokeStyle=i%4?"rgba(55,42,31,.42)":"rgba(226,205,154,.62)";
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+3,y-4,x+13+random()*18,y+1+random()*5);g.stroke();
    }
    // Faint alpine moss/dampness along the bottom live-edge.
    const damp=g.createLinearGradient(0,h*.84,0,h);
    damp.addColorStop(0,"rgba(58,76,42,0)");damp.addColorStop(1,"rgba(54,72,38,.36)");
    g.fillStyle=damp;g.fillRect(0,h*.84,w,h*.16);
    // Rust streaks below forged bolt points.
    for(const x of [130,w-130])for(const y of [68,158,248,338,402]){
      const grad=g.createLinearGradient(x,y,x+4,y+44);
      grad.addColorStop(0,"rgba(96,58,34,.75)");grad.addColorStop(1,"rgba(81,48,29,0)");
      g.fillStyle=grad;g.fillRect(x-3,y,6,45);
    }
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const bump=new THREE.CanvasTexture(canvas);bump.encoding=THREE.LinearEncoding;
    return {map,bump};
  }

  function timberLogTexture(random){
    const cv=document.createElement("canvas");cv.width=192;cv.height=512;
    const g=cv.getContext("2d");
    g.fillStyle="#786148";g.fillRect(0,0,192,512);
    for(let i=0;i<240;i++){
      const x=random()*192,y=random()*512,len=20+random()*120;
      g.strokeStyle=i%3?"rgba(52,38,24,.32)":"rgba(196,170,132,.22)";
      g.lineWidth=.8+random()*2.2;g.beginPath();
      g.moveTo(x,y);g.bezierCurveTo(x+(random()-.5)*6,y+len*.35,x+(random()-.5)*6,y+len*.7,x+(random()-.5)*4,y+len);g.stroke();
    }
    // Weathering checks & damp moss staining near base of log.
    const moss=g.createLinearGradient(0,410,0,512);
    moss.addColorStop(0,"rgba(58,78,42,0)");moss.addColorStop(1,"rgba(52,70,36,.58)");
    g.fillStyle=moss;g.fillRect(0,410,192,102);
    const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
    return tex;
  }

  function forgedIronTexture(random){
    const cv=document.createElement("canvas");cv.width=128;cv.height=128;
    const g=cv.getContext("2d");
    g.fillStyle="#353835";g.fillRect(0,0,128,128);
    for(let i=0;i<140;i++){
      const x=random()*128,y=random()*128,rad=2+random()*11;
      const rg=g.createRadialGradient(x,y,0,x,y,rad);
      rg.addColorStop(0,i%3===0?"rgba(128,74,38,.58)":"rgba(24,25,24,.48)");
      rg.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=rg;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
  }

  /* 5 块横向天然活边松木大板（Live-Edge Horizontal Slabs）+ 锻铁角码 + 背面木楞 + 螺栓 */
  function board(s,z,dir,ironMat,logMat){
    const nearPivot=dir>0?scene.getObjectByName("boardPivot"):null;
    const panelRig=new THREE.Group(),panel=new THREE.Group();
    panel.name=dir>0?"meadowNearTimberBoard":"meadowFarTimberBoard";
    s.root.add(panelRig);panelRig.add(panel);
    if(nearPivot)panelRig.position.copy(nearPivot.position);
    panel.position.set(0,2.95-panelRig.position.y,(z-dir*.048)-panelRig.position.z);
    panel.rotation.y=dir>0?0:Math.PI;

    const {map,bump}=woodMap(s.r);
    const material=new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.024,color:0xffffff,roughness:.94,metalness:0});
    // 5 raw, uneven horizontal live-edge spruce slabs: varied widths, rough hand-sawn ends,
    // organic tree-bark top/bottom silhouette, visible dry-wood gaps, and slight Z relief.
    const slabDefs=[
      {y0:-.015,y1:.215,l:-.975,r:1.015,zOff:.005,wobble:.034,tilt:.009},
      {y0:.226,y1:.426,l:-1.022,r:.918,zOff:-.006,wobble:.013,tilt:-.006},
      {y0:.437,y1:.668,l:-.932,r:.992,zOff:.006,wobble:.011,tilt:.005},
      {y0:.680,y1:.882,l:-.998,r:.936,zOff:-.005,wobble:.014,tilt:-.008},
      {y0:.895,y1:1.108,l:-.915,r:.968,zOff:.003,wobble:.038,tilt:.011}
    ];
    for(let row=0;row<slabDefs.length;row++){
      const {y0,y1,l,r:rx,zOff,wobble,tilt}=slabDefs[row];
      const shape=new THREE.Shape(),steps=14;
      const topWave=(u)=>row===4
        ?(Math.sin(u*Math.PI*2.3+.4)*wobble+Math.cos(u*Math.PI*5.7+1.2)*.014-Math.pow(Math.abs(u-.5)*2,2.2)*.028)
        :(Math.sin(u*Math.PI*3.4+row*1.7)*.007+Math.cos(u*Math.PI*7.1+row)*.003);
      const botWave=(u)=>row===0
        ?(Math.sin(u*Math.PI*2.7+1.3)*wobble-Math.cos(u*Math.PI*5.1+.6)*.014+Math.pow(Math.abs(u-.5)*2,2.0)*.018)
        :(Math.sin(u*Math.PI*3.1+row*2.1)*.007-Math.cos(u*Math.PI*6.3+row)*.003);
      const midY=(y0+y1)*.5;
      shape.moveTo(l+(s.r()-.5)*.016,y0+botWave(0));
      for(let k=1;k<=steps;k++){const u=k/steps;shape.lineTo(lerp(l,rx,u),y0+botWave(u));}
      // Rough hand-sawn jagged right end.
      shape.lineTo(rx+(row%2?.020:-.018),lerp(y0,y1,.36));
      shape.lineTo(rx+(row%2?-.010:.014),lerp(y0,y1,.72));
      for(let k=steps;k>=0;k--){const u=k/steps;shape.lineTo(lerp(l,rx,u),y1+topWave(u));}
      // Rough hand-sawn jagged left end.
      shape.lineTo(l+(row%2?-.022:.016),lerp(y0,y1,.68));
      shape.lineTo(l+(row%2?.012:-.014),lerp(y0,y1,.32));
      shape.closePath();
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.082,steps:1,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1});
      const p=geo.attributes.position,uv=geo.attributes.uv;
      for(let i=0;i<p.count;i++)uv.setXY(i,clamp(.5+p.getX(i)/2.04,0,1),clamp(p.getY(i)/1.12,0,1));
      const slab=new THREE.Mesh(geo,material);
      slab.name="meadowHorizontalSlab";slab.position.set(0,0,-.041+zOff);
      slab.rotation.z=tilt;
      slab.castShadow=true;slab.receiveShadow=true;panel.add(slab);
    }

    // Two rear vertical/angled timber battens holding the 5 raw horizontal slabs together.
    for(const [bx,ang] of [[-.64,.035],[.64,-.035]]){
      const batten=new THREE.Mesh(new THREE.BoxGeometry(.105,1.02,.058),logMat);
      batten.position.set(bx,.55,-.072);batten.rotation.z=ang;
      batten.castShadow=true;batten.receiveShadow=true;panel.add(batten);
    }
    // Diagonal timber Z-brace across the back.
    const diag=new THREE.Mesh(new THREE.BoxGeometry(1.38,.082,.042),logMat);
    diag.position.set(0,.55,-.082);diag.rotation.z=.46;
    diag.castShadow=true;diag.receiveShadow=true;panel.add(diag);

    // Forged iron rim mounting flange + triangular gussets behind the hoop neck (no artificial corner frame).
    const flange=new THREE.Mesh(new THREE.BoxGeometry(.25,.22,.028),ironMat);
    flange.position.set(0,.14,.050);panel.add(flange);
    for(const sx of [-1,1]){
      const gusset=new THREE.Mesh(new THREE.BoxGeometry(.024,.12,.09),ironMat);
      gusset.position.set(sx*.082,.11,.085);gusset.rotation.x=.32;panel.add(gusset);
    }

    // 20 instanced forged iron bolt heads & washers anchoring each horizontal slab to the battens.
    const boltGeo=new THREE.CylinderGeometry(.016,.018,.024,6);
    boltGeo.rotateX(Math.PI/2);
    const bolts=new THREE.InstancedMesh(boltGeo,ironMat,20);
    const stamp=new THREE.Object3D();
    let bi=0;
    for(const bx of [-.64,.64]){
      for(let row=0;row<5;row++){
        const by=.11+row*.22;
        for(const side of [-1,1]){
          stamp.position.set(bx+(s.r()-.5)*.018,by+(s.r()-.5)*.014,side>0?.049:-.104);
          stamp.rotation.set(0,0,s.r()*tau);stamp.updateMatrix();
          bolts.setMatrixAt(bi++,stamp.matrix);
        }
      }
    }
    bolts.name="meadowForgedBolts";panel.add(bolts);

    // 12 hand-bent iron wire net-hooks around the underside of the rim (adds close-up artisan detail).
    const rimLocalZ=.56;
    const hookGeo=new THREE.TorusGeometry(.014,.0032,5,8,Math.PI*1.35);
    const hooks=new THREE.InstancedMesh(hookGeo,ironMat,12);
    for(let i=0;i<12;i++){
      const a=i*tau/12+(s.r()-.5)*.06;
      stamp.position.set(Math.cos(a)*.302,.084+(s.r()-.5)*.004,rimLocalZ+Math.sin(a)*.302);
      stamp.rotation.set(Math.PI/2,a,0);stamp.updateMatrix();
      hooks.setMatrixAt(i,stamp.matrix);
    }
    hooks.name="meadowHandBentRimHooks";panel.add(hooks);

    return {material,panelRig,nearPivot};
  }

  function buildHoops(s,supports,batch){
    const base=batch(),drips=[],boards=[],motions=[];
    const logTex=timberLogTexture(s.r);
    const ironTex=forgedIronTexture(s.r);
    const logMat=new THREE.MeshStandardMaterial({map:logTex,roughness:.90,metalness:.02});
    const ironMat=new THREE.MeshStandardMaterial({map:ironTex,color:0x4a4d49,roughness:.74,metalness:.46});
    const ropeMat=new THREE.MeshStandardMaterial({color:0x9e845c,roughness:.95,metalness:.02});
    const axis=new THREE.Vector3(0,1,0);
    function curvedLog(pts,radius,segs,mat=logMat,name="meadowTimberPost"){
      const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,segs,radius,9,false),mat);
      mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;s.root.add(mesh);
      return mesh;
    }
    function rod(r0,r1,from,to,mat=ironMat){
      const start=new THREE.Vector3(...from),tip=new THREE.Vector3(...to),v=tip.clone().sub(start);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,v.length(),8),mat);
      mesh.position.copy(start).lerp(tip,.5);mesh.quaternion.setFromUnitVectors(axis,v.normalize());
      mesh.castShadow=true;mesh.receiveShadow=true;s.root.add(mesh);
    }
    for(const [z,dir] of supports){
      const b=board(s,z,dir,ironMat,logMat);
      boards.push(b.material);
      if(b.nearPivot)motions.push({panelRig:b.panelRig,nearPivot:b.nearPivot});

      const foot=z-dir*1.62;
      // River-stone cairn footing anchoring the A-frame twin spruce logs into the alpine meadow.
      const rockTints=[0x68695e,0x7e7b67,0x5f6356,0x89846f,0x545d4a];
      for(let k=0;k<12;k++){
        const a=k*tau/12+(s.r()-.5)*.28,rad=.22+s.r()*.62;
        const rx=Math.cos(a)*rad*1.25,rz=foot+Math.sin(a)*rad*.72;
        const sc=.24+s.r()*.34;
        base.add("rock",rockTints[k%rockTints.length],rx,s.heightAt(rx,rz)+sc*.22,rz,
          sc*(1.05+s.r()*.45),sc*(.48+s.r()*.32),sc*(.95+s.r()*.4),
          (s.r()-.5)*.3,s.r()*tau,(s.r()-.5)*.3);
      }

      // Twin naturally bowed peeled alpine spruce logs forming an A-frame pasture support.
      for(const side of [-1,1]){
        const gx=side*.62,gy=s.heightAt(gx,foot)-.06;
        curvedLog([
          [gx,gy,foot+dir*.05],
          [side*.46,1.35,foot-dir*.04],
          [side*.24,2.60,foot+dir*.03],
          [side*.10,3.52,foot+dir*.08]
        ],.092,14,logMat,"meadowAFrameSpruceLog");
        // Rear legs spread the support in depth and meet the same upper joint.
        const rearZ=foot-dir*1.30;
        curvedLog([
          [side*.70,s.heightAt(side*.70,rearZ)-.06,rearZ],
          [side*.48,1.32,foot-dir*.83],
          [side*.26,2.60,foot-dir*.32],
          [side*.10,3.52,foot+dir*.08]
        ],.085,14,logMat,"meadowRearSpruceLeg");
        // Side braces connect each leg to the board's rear battens.
        rod(.038,.035,[side*.38,1.90,foot-dir*.08],[side*.64,3.26,z-dir*.12],logMat);
        rod(.035,.033,[side*.58,.75,rearZ+dir*.25],[side*.40,2.18,foot-dir*.18],logMat);
      }
      // Horizontal spruce cross-ties locking the A-frame legs together.
      rod(.058,.054,[-.52,.98,foot],[.52,1.02,foot],logMat);
      rod(.052,.048,[-.34,2.24,foot],[.34,2.20,foot],logMat);

      // Heavy cantilever top timber beam reaching forward to the backboard.
      curvedLog([
        [0,3.50,foot-dir*.32],
        [.015,3.52,foot+dir*.45],
        [0,3.49,z-dir*.10]
      ],.096,10,logMat,"meadowCantileverTimber");

      // Hemp rope / forged iron lashing wraps at the A-frame apex & cross-tie joints.
      for(const [lx,ly,lz,rad] of [[0,3.48,foot+dir*.05,.155],[-.45,1.00,foot,.098],[.45,1.01,foot,.098]]){
        for(let w=0;w<3;w++){
          const wrap=new THREE.Mesh(new THREE.TorusGeometry(rad,.016,6,14),w===1?ironMat:ropeMat);
          wrap.position.set(lx,ly+(w-1)*.032,lz);
          wrap.rotation.set(Math.PI/2+(w-1)*.18,0,(w-1)*.22);
          s.root.add(wrap);
        }
      }

      for(const x of [-.90,-.73,-.37,.20,.58,.89])drips.push({x,y:2.956,z:z+dir*.05});
      const rimZ=dir>0?HOOP.z:COURT.farHoopZ;
      for(const x of [-.24,-.10,.11,.25])drips.push({x,y:HOOP.y-.024,z:rimZ+dir*(.31-Math.abs(x)*.55)});
    }
    base.finish(s.root,"meadowFieldstoneFootings").castShadow=true;
    return {boards,drips,motions};
  }

  function instances(s,name,geometry,color,opacity,limit){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false});
    const mesh=new THREE.InstancedMesh(geometry,mat,limit);
    mesh.name=name;mesh.count=0;mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);s.root.add(mesh);
    return {mesh,limit,items:[]};
  }

  function push(pool,particle){
    if(pool.items.length>=pool.limit)pool.items.shift();
    pool.items.push(particle);
  }

  function buildInsects(s){
    // Keep dragonflies sparse (4 desktop / 2 mobile) so they feel like real wild meadow insects, not a scripted swarm.
    const maxCount=s.mobile?2:4;
    const bodies=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({
      color:0x315548,metalness:.24,roughness:.50
    }),maxCount);
    const shape=new THREE.Shape();
    shape.moveTo(0,0);shape.quadraticCurveTo(.38,-.25,1,-.08);
    shape.quadraticCurveTo(.96,.30,.47,.26);shape.lineTo(0,0);
    const wings=new THREE.InstancedMesh(new THREE.ShapeGeometry(shape,4),new THREE.MeshStandardMaterial({
      color:0xc6dad0,transparent:true,opacity:.52,depthWrite:false,roughness:.26,side:THREE.DoubleSide
    }),bodies.count*4);
    bodies.name="meadowDragonflies";wings.name="meadowDragonflyWings";
    for(const mesh of [bodies,wings]){
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;s.root.add(mesh);
    }
    const centers=[[-2.8,1.4],[3.6,-4.2],[-4.9,-8.6],[5.2,3.4]];
    return {bodies,wings,centers:centers.slice(0,maxCount)};
  }

  function buildPastureProps(s,batch){
    const props=batch(),h=s.heightAt;
    const timber=[0x7d654b,0x6e5841,0x8a7257,0x63503b];
    // Split-rail weathered ranch fence curving along two outer meadow hillsides.
    const fenceLines=[
      [[-15.8,-10.5],[-15.2,-4.8],[-14.9,1.2],[-15.5,7.4],[-16.6,13.6]],
      [[15.2,-9.6],[15.8,-3.5],[16.4,2.8],[15.9,9.2],[16.8,15.0]]
    ];
    for(const line of fenceLines){
      for(let i=0;i<line.length;i++){
        const [x,z]=line[i],y=h(x,z),lean=(s.r()-.5)*.08;
        props.add("cyl",timber[i%timber.length],x,y+.54,z,.065,1.18,.065,lean,s.r()*tau,(s.r()-.5)*.07);
        if(i<line.length-1){
          const [nx,nz]=line[i+1],ny=h(nx,nz),mx=(x+nx)*.5,mz=(z+nz)*.5,my=(y+ny)*.5;
          const dx=nx-x,dz=nz-z,len=Math.hypot(dx,dz)+.18,yaw=Math.atan2(dx,dz);
          const slope=Math.atan2(ny-y,len);
          for(const rh of [.40,.84]){
            props.box(timber[(i+1)%timber.length],mx,my+rh,mz,.058,.082,len,-slope,yaw,(s.r()-.5)*.03);
          }
        }
      }
    }
    // Two rustic split-log benches at the meadow sideline seating spots.
    const benches=[[-11.2,-5.2,Math.PI/2+.12],[5.8,21.6,.08]];
    for(const [bx,bz,rot] of benches){
      const by=h(bx,bz),ca=Math.cos(rot),sa=Math.sin(rot);
      props.box(0x886d4f,bx,by+.42,bz,1.95,.095,.38,0,rot,0);
      for(const off of [-.68,.68]){
        props.add("cyl",0x5f4b38,bx+ca*off,by+.20,bz-sa*off,.12,.42,.12,0,0,0);
      }
    }
    // Weathered canvas court bag and metal water canteen by the main hoop stone footing.
    const bagX=1.42,bagZ=-9.85,bagY=h(bagX,bagZ);
    props.box(0x6e735c,bagX,bagY+.16,bagZ,.54,.27,.28,.04,-.38,.05);
    props.box(0x4b4a3d,bagX+.02,bagY+.30,bagZ,.50,.04,.10,0,-.38,0);
    props.add("cyl",0x9aa3a1,bagX+.38,bagY+.12,bagZ+.12,.048,.24,.048,0,0,.04);
    props.add("cyl",0x343a38,bagX+.38,bagY+.25,bagZ+.12,.030,.04,.030,0,0,.04);
    // Two weathered wooden wind-poles outside the baseline corners.
    const poles=[[-10.6,-11.4],[11.1,-10.9]];
    for(const [px,pz] of poles){
      const py=h(px,pz);
      props.add("cyl",0x6b5641,px,py+1.45,pz,.048,3.05,.048,.02,0,-.02);
    }
    const built=props.finish(s.root,"meadowPastureProps");
    if(built){built.castShadow=true;built.receiveShadow=true;}

    // Fluttering cloth wind-ribbons on the pasture poles (visualizes alpine wind direction & gusts).
    const ribbonGeo=new THREE.PlaneGeometry(.95,.14,12,1);
    ribbonGeo.translate(.475,0,0);
    const ribbonColors=[0xd97a4a,0xe8d9b5,0x5e8fa3,0xc79d4b];
    const ribbonUniforms={meadowClock:s.meadow.time,meadowWind:s.meadow.wind,meadowSky:s.meadow.uniforms.meadowSky};
    const ribbonGroup=new THREE.Group();ribbonGroup.name="meadowWindRibbons";
    poles.forEach(([px,pz],pi)=>{
      const py=h(px,pz);
      for(let ri=0;ri<2;ri++){
        const col=new THREE.Color(ribbonColors[(pi*2+ri)%ribbonColors.length]);
        const mat=new THREE.ShaderMaterial({
          side:THREE.DoubleSide,transparent:false,
          uniforms:{...ribbonUniforms,ribbonColor:{value:col},phase:{value:pi*2.1+ri*1.3}},
          vertexShader:`
            uniform float meadowClock,meadowWind,phase;
            varying vec2 vUv;
            void main(){
              vUv=uv;
              vec3 p=position;
              float flex=uv.x*uv.x;
              float spd=4.2+meadowWind*6.5;
              p.z+=(sin(meadowClock*spd-uv.x*7.5+phase)*.11+cos(meadowClock*spd*1.7-uv.x*12.0+phase)*.04)*flex*(.55+meadowWind*.9);
              p.y-=(1.0-min(1.0,.35+meadowWind*.85))*.18*flex;
              gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
            }`,
          fragmentShader:`
            uniform vec3 ribbonColor;uniform vec4 meadowSky;varying vec2 vUv;
            void main(){
              float shade=(.82+.18*sin(vUv.x*18.0))*(1.0-meadowSky.w*.22);
              gl_FragColor=vec4(ribbonColor*shade,1.0);
              #include <tonemapping_fragment>
              #include <encodings_fragment>
            }`
        });
        const rMesh=new THREE.Mesh(ribbonGeo,mat);
        rMesh.position.set(px,py+2.82-ri*.22,pz);
        rMesh.rotation.y=-.45+ri*.12;
        ribbonGroup.add(rMesh);
      }
    });
    s.root.add(ribbonGroup);
  }

  function buildButterflies(s){
    // Cap butterflies to at most 2 so they stay a subtle, natural accent rather than a swarm.
    const count=2;
    const shape=new THREE.Shape();
    shape.moveTo(0,0);shape.quadraticCurveTo(.45,.45,.95,.28);
    shape.quadraticCurveTo(1.0,-.05,.55,-.20);shape.quadraticCurveTo(.72,-.48,.22,-.52);shape.lineTo(0,0);
    const geo=new THREE.ShapeGeometry(shape,4);
    const mat=new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.55,side:THREE.DoubleSide,emissive:0xffe8b5,emissiveIntensity:.14
    });
    const wings=new THREE.InstancedMesh(geo,mat,count*2);
    const palette=[0xfff2c2,0xf6d57a];
    const c=new THREE.Color();
    for(let i=0;i<count;i++){
      c.set(palette[i%palette.length]).convertSRGBToLinear();
      wings.setColorAt(i*2,c);wings.setColorAt(i*2+1,c);
    }
    wings.instanceColor.needsUpdate=true;
    wings.name="meadowButterflies";wings.count=0;wings.frustumCulled=false;
    wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);s.root.add(wings);
    const homes=[[-5.2,-2.6],[5.4,1.6]];
    return {wings,homes:homes.slice(0,count)};
  }

  function buildPollen(s){
    const count=s.mobile?280:720,pos=[],seed=[];
    for(let i=0;i<count;i++){
      // Concentrate 65% of dust/pollen motes right inside the active court & camera volume.
      // Keep blurred flying midges sparse (~12 on desktop, ~4 on mobile) so they feel occasional & organic.
      const isFly=i%60===7;
      const inCourt=isFly||i%3!==0;
      const spanX=isFly?13:(inCourt?15:28),spanZ=isFly?18:(inCourt?20:36),maxH=isFly?3.1:(inCourt?3.6:5.2);
      pos.push((s.r()-.5)*spanX,(isFly?.75:.18)+s.r()*maxH,COURT.midZ+(s.r()-.5)*spanZ);
      // mote.x = phase seed, mote.y = size/speed, mote.z = 0 (fine dust), 1 (soft foreground bokeh dust), 2 (occasional hover-and-dart blurred insect)
      seed.push(s.r(),.60+s.r()*1.25,isFly?2:(i%5===0?1:0));
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute("mote",new THREE.Float32BufferAttribute(seed,3));
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{clock:s.meadow.time,wind:s.meadow.wind,meadowSky:s.meadow.uniforms.meadowSky},
      vertexShader:`
        attribute vec3 mote;
        uniform float clock,wind;
        uniform vec4 meadowSky;
        varying float vAlpha,vSoft,vFly,vFlutter;
        void main(){
          vFly=step(1.5,mote.z);
          vSoft=step(.5,mote.z)*(1.0-vFly);
          // Independent 360-degree 3D local curl orbit per mote (never multiplying clock by oscillating wind!).
          float t=clock*(.042+.026*fract(mote.x*13.7))+mote.x*62.8318;
          float az=mote.x*62.8318+mote.y*17.3;
          vec2 dir=vec2(cos(az),sin(az));
          vec2 perp=vec2(-dir.y,dir.x);
          vec2 eddy=dir*(sin(t)*.36+cos(t*1.63+mote.y*11.0)*.12)+perp*(cos(t*.79+mote.x*29.0)*.32);
          vec3 p=position;
          vec3 dustPos=p+vec3(
            eddy.x,
            sin(t*.84+mote.x*19.0)*.22+cos(t*.51+mote.y*13.0)*.09,
            eddy.y
          );
          // Aperiodic independent hover-and-dart blurred insects: each insect has a unique irrational speed & warped pause/dart cadence.
          float seedA=fract(mote.x*19.37+mote.y*7.13);
          float seedB=fract(mote.x*37.91-mote.y*11.47);
          float rate=.21+seedA*.49;
          float warped=clock*rate+sin(clock*(.13+seedB*.23)+mote.x*43.0)*.62+cos(clock*(.09+seedA*.17)-mote.y*29.0)*.34+mote.x*53.7;
          float slot=floor(warped);
          float dartWindow=.14+fract(sin(slot*12.9898+mote.x*78.233)*43758.5453)*.18;
          float dart=smoothstep(0.0,dartWindow,fract(warped));
          vec3 h0=vec3(sin(slot*4.13+mote.x*17.3)+cos(slot*1.71+seedB*9.0)*.45,cos(slot*2.73+mote.x*11.9)*.42,cos(slot*3.37-mote.x*13.1)+sin(slot*2.11+seedA*7.0)*.45);
          vec3 h1=vec3(sin((slot+1.0)*4.13+mote.x*17.3)+cos((slot+1.0)*1.71+seedB*9.0)*.45,cos((slot+1.0)*2.73+mote.x*11.9)*.42,cos((slot+1.0)*3.37-mote.x*13.1)+sin((slot+1.0)*2.11+seedA*7.0)*.45);
          vec3 jitter=vec3(sin(clock*(21.0+seedA*14.0)+mote.x*40.0),cos(clock*(25.0+seedB*13.0)+mote.x*25.0),sin(clock*(19.0+seedA*11.0)+seedB*19.0))*.026;
          vec3 flyPos=p+mix(h0,h1,dart)*vec3(1.85,.72,1.75)+jitter;
          p=mix(dustPos,flyPos,vFly);
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*mv;
          float depth=max(1.1,-mv.z);
          float fineSize=clamp(44.0*mote.y/max(3.0,depth),1.8,6.5);
          float bokehSize=clamp(58.0*mote.y/max(1.5,depth),5.5,24.0);
          float flySize=clamp(62.0*mote.y/max(1.35,depth),4.2,19.5);
          gl_PointSize=mix(mix(fineSize,bokehSize,vSoft),flySize,vFly);
          float vis=(.38+.62*smoothstep(.04,.65,meadowSky.x))*(1.0-smoothstep(.10,.36,meadowSky.z));
          float range=mix(
            mix(
              smoothstep(1.0,3.5,depth)*(1.0-smoothstep(20.0,34.0,depth)),
              smoothstep(.6,1.6,depth)*(1.0-smoothstep(6.5,13.5,depth))*.52,
              vSoft),
            smoothstep(.75,1.8,depth)*(1.0-smoothstep(18.0,28.0,depth))*.85,
            vFly);
          vAlpha=vis*(.48+.52*(sin(t*1.15)*.5+.5))*range;
          vFlutter=.45+.55*abs(sin(clock*42.0+mote.x*30.0));
        }`,
      fragmentShader:`
        uniform vec4 meadowSky;
        varying float vAlpha,vSoft,vFly,vFlutter;
        void main(){
          vec2 p=gl_PointCoord*2.0-1.0;
          float r=length(p);
          float fineGlow=exp(-r*r*3.4)*(1.0-smoothstep(.58,1.0,r));
          float bokehDisc=pow(1.0-smoothstep(.06,.98,r),1.35);
          // Soft out-of-focus hovering insect silhouette + rapid blurred wing halo
          vec2 wUv=vec2(abs(p.x)-.24*vFlutter,p.y+.05);
          float wingBlur=exp(-dot(wUv*vec2(1.8,2.6),wUv*vec2(1.8,2.6))*2.4)*(1.0-smoothstep(.55,1.0,r));
          float bodyBlur=exp(-dot(p*vec2(3.6,1.6),p*vec2(3.6,1.6))*3.2);
          float flyShape=clamp(wingBlur*(.62+.38*vFlutter)+bodyBlur*.75,0.0,1.0);
          float glow=mix(mix(fineGlow,bokehDisc,vSoft),flyShape,vFly);
          vec3 col=mix(vec3(.96,.97,.90),vec3(1.0,.80,.46),meadowSky.y*.75+.15*meadowSky.x);
          gl_FragColor=vec4(col,glow*vAlpha*.64);
        }`
    });
    const pts=new THREE.Points(geo,mat);
    pts.name="meadowGoldenPollen";pts.frustumCulled=false;pts.renderOrder=2;s.root.add(pts);
    return pts;
  }

  function buildPetals(s){
    // 3D curved wildflower petal geometry for both backboard impact petal bursts & wind-blown hillside petal waves.
    const limit=s.mobile?160:360;
    const shape=new THREE.Shape();
    shape.moveTo(0,-.068);
    shape.quadraticCurveTo(.064,-.014,.052,.064);
    shape.quadraticCurveTo(0,.088,-.052,.064);
    shape.quadraticCurveTo(-.064,-.014,0,-.068);
    const geo=new THREE.ShapeGeometry(shape,4);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const px=pos.getX(i),py=pos.getY(i);
      pos.setZ(i,(px*px*4.2+py*.28)*.22);
    }
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.46,side:THREE.DoubleSide,emissive:0xffecc8,emissiveIntensity:.32
    });
    const mesh=new THREE.InstancedMesh(geo,mat,limit);
    mesh.name="meadowWindPetals";mesh.count=0;mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const palette=[0xfff8e4,0xffcb3b,0xff8da8,0xc49eff,0xffa65c,0xffe4ec];
    const col=new THREE.Color();
    for(let i=0;i<limit;i++){
      col.set(palette[i%palette.length]).convertSRGBToLinear();
      mesh.setColorAt(i,col);
    }
    mesh.instanceColor.needsUpdate=true;
    s.root.add(mesh);
    return {mesh,limit,items:[],palette,col,spawnAcc:0,gustAcc:0,nextIdx:0};
  }

  function spawnPetal(petals,p){
    if(!petals)return;
    if(petals.items.length>=petals.limit){
      petals.items[petals.nextIdx%petals.limit]=p;
      petals.nextIdx++;
    }else{
      petals.items.push(p);
    }
  }

  function hoopPetalImpact(c,kind,force){
    if(!c||!c.petals)return;
    const flState=(typeof environmentRoot!=="undefined"&&environmentRoot?.userData?.flowerState)||null;
    const bloomAmt=flState?Math.max(.55,flState.visualProgress||0):.85;
    const str=clamp((force||2.8)/3.2,.65,1.65);
    const count=Math.round((kind==="made"?48:kind==="board"?44:36)*bloomAmt*str);
    const r=c.random;
    for(let i=0;i<count;i++){
      // Spawn right along the flower-crowned top & side edges of the near wooden backboard
      const onTop=i%3!==0;
      const sx=onTop?(r()-.5)*1.96:(i%2?1:-1)*(.88+r()*.18);
      const sy=onTop?(3.86+r()*.32):(3.02+r()*1.02);
      const sz=HOOP.z-.28+(r()-.5)*.16;
      const outX=sx*.92+(r()-.5)*1.65;
      const outY=.65+r()*1.85;
      const outZ=.55+r()*1.95;
      spawnPetal(c.petals,{
        x:sx,y:sy,z:sz,
        vx:outX*str,vy:outY*str,vz:outZ*str,
        age:0,life:3.8+r()*2.6,
        size:1.05+r()*.78,
        phase:r()*tau,spin:(2.4+r()*3.8)*(r()<.5?1:-1),flutter:3.6+r()*3.2
      });
    }
  }

  function updatePetals(c,time,dt,rain,clear){
    const pt=c.petals;if(!pt)return;
    const r=c.random,m=c.transform;
    const flState=(typeof environmentRoot!=="undefined"&&environmentRoot?.userData?.flowerState)||null;
    const bloom=flState?Math.max(.35,flState.visualProgress||0):.75;
    const windVal=c.windUniform?c.windUniform.value:.35;
    // Periodic sweeping alpine wind-gust waves ("既有零散飘起，也有批量大风刮起"):
    const gustWave=Math.pow(Math.max(0,Math.sin(time*.37)*Math.cos(time*.23+.9)),2.6);
    const fair=1-smoothstep(rain,.08,.45);
    // 1) Continuous scattered ambient petals lifting off the meadow & court edges
    pt.spawnAcc+=dt*(3.4+clear*3.6)*bloom*fair;
    while(pt.spawnAcc>=1){
      pt.spawnAcc--;
      const nearCourt=r()<.62;
      const x=nearCourt?(r()-.5)*20:(r()-.5)*48;
      const z=COURT.midZ+(nearCourt?(r()-.5)*24:(r()-.5)*50);
      const y=c.heightAt(x,z)+.22+r()*.85;
      spawnPetal(pt,{
        x,y,z,
        vx:.65+windVal*1.55+(r()-.5)*.65,
        vy:.34+r()*.65,
        vz:.28+(r()-.5)*.75,
        age:0,life:4.4+r()*3.0,
        size:.92+r()*.75,
        phase:r()*tau,spin:(1.8+r()*3.0)*(r()<.5?1:-1),flutter:2.8+r()*2.6
      });
    }
    // 2) Batch alpine wind-gust waves sweeping a dense flurry of petals across the hillside & court
    if(gustWave>.14){
      pt.gustAcc+=dt*gustWave*42.0*bloom*fair;
      const gustOriginX=-16+Math.sin(time*.19)*9,gustOriginZ=COURT.midZ-12+Math.cos(time*.17)*9;
      while(pt.gustAcc>=1){
        pt.gustAcc--;
        const x=gustOriginX+(r()-.5)*22,z=gustOriginZ+(r()-.5)*22;
        const y=c.heightAt(x,z)+.18+r()*1.55;
        spawnPetal(pt,{
          x,y,z,
          vx:2.5+windVal*3.4+r()*1.5,
          vy:.72+r()*1.35,
          vz:.92+(r()-.3)*1.05,
          age:0,life:4.0+r()*2.5,
          size:.96+r()*.82,
          phase:r()*tau,spin:(3.0+r()*4.2)*(r()<.5?1:-1),flutter:4.0+r()*3.5
        });
      }
    }
    let count=0;
    const windBreeze=.65+windVal*1.85+gustWave*2.4;
    for(let i=pt.items.length-1;i>=0;i--){
      const p=pt.items[i];p.age+=dt;
      if(p.age>=p.life){pt.items.splice(i,1);continue;}
      const u=p.age/p.life;
      const fl=p.age*p.flutter+p.phase;
      // Aerodynamic petal flutter: gentle terminal fall + lateral gliding sway + wind gust carry
      p.vx+=(windBreeze*.85+Math.sin(fl)*1.15-p.vx*.92)*dt;
      p.vz+=(windBreeze*.28+Math.cos(fl*.83)*1.05-p.vz*.92)*dt;
      p.vy+=(-0.48+.36*Math.sin(fl*1.35)+gustWave*.55-p.vy*1.25)*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const groundY=c.heightAt(p.x,p.z)+.03;
      if(p.y<groundY){p.y=groundY;p.vx*=.85;p.vz*=.85;}
      const fade=smoothstep(u,0,.08)*(1-smoothstep(u,.78,1));
      const sc=p.size*(.35+.65*fade);
      m.position.set(p.x,p.y,p.z);
      m.rotation.set(
        .65*Math.sin(fl)+p.age*p.spin*.45,
        p.age*p.spin+p.phase,
        .78*Math.cos(fl*.92)
      );
      m.scale.setScalar(sc);
      m.updateMatrix();
      pt.mesh.setMatrixAt(count++,m.matrix);
    }
    pt.mesh.count=count;
    if(count||pt.mesh.visible)pt.mesh.instanceMatrix.needsUpdate=true;
  }

  function build(s,supports,batch){
    const {boards,drips,motions}=buildHoops(s,supports,batch);
    buildPastureProps(s,batch);
    const ripple=new THREE.RingGeometry(.88,1,24);ripple.rotateX(-Math.PI/2);
    return {boards,drips,motions,random:s.r,transform:new THREE.Object3D(),heightAt:s.heightAt,wet:0,rain:0,dripClock:0,poolClock:0,
      windUniform:s.meadow.wind,
      drops:instances(s,"meadowHoopDrips",new THREE.SphereGeometry(1,5,4),0xb7cdd1,.73,s.mobile?24:48),
      splash:instances(s,"meadowBallSplash",new THREE.SphereGeometry(1,5,4),0xd5e6e5,.73,s.mobile?68:138),
      rings:instances(s,"meadowWaterRipples",ripple,0xb8c8c6,.43,s.mobile?20:40),
      petals:buildPetals(s),
      insects:buildInsects(s),butterflies:buildButterflies(s),pollen:buildPollen(s)};
  }

  function reset(court){
    court.wet=court.rain=court.dripClock=court.poolClock=0;
    for(const pool of [court.drops,court.splash,court.rings]){
      pool.items.length=0;pool.mesh.count=0;
    }
    if(court.petals){court.petals.items.length=0;court.petals.mesh.count=0;court.petals.spawnAcc=court.petals.gustAcc=0;}
  }

  function ring(c,x,z,radius,life){
    push(c.rings,{x,z,y:c.heightAt(x,z)+.012,radius,life,age:0});
  }

  function ballImpact(c,x,z,force){
    if(!c||c.wet<.055||force<.35||Math.abs(x)>10||z<COURT.nearBaseline-2||z>COURT.farBaseline+2)return;
    const liquid=smoothstep(c.wet,.045,.77)*(.27+.73*(1-smoothstep(poolShape(x,z),.38,1.44)));
    if(liquid<.035)return;
    const kick=clamp(force/9.5,.18,1),size=kick*liquid;
    const r=c.random,count=Math.ceil(4+size*25);
    ring(c,x,z,.13+size*.57,.37+size*.33);
    if(size>.32)ring(c,x,z,.30+size*.78,.53+size*.30);
    for(let i=0;i<count;i++){
      const angle=tau*(i+r())/count,dirX=Math.cos(angle),dirZ=Math.sin(angle),speed=(.36+r()*1.8)*(kick+.29)*(.6+liquid*.7);
      push(c.splash,{x:x+.07*dirX,z:z+.07*dirZ,y:c.heightAt(x,z)+.048,age:0,life:.35+r()*.35,
        vx:dirX*speed,vz:dirZ*speed,vy:(.75+r()*2.9)*(kick+.24)*(.5+liquid*.66),size:(.008+r()*.013)*(.55+liquid*.62)});
    }
  }

  function updateWater(c,dt){
    const r=c.random,m=c.transform;
    c.dripClock+=dt*smoothstep(c.wet,.035,.8)*(2.1+c.rain*11.0);
    while(c.dripClock>=1){
      c.dripClock--;
      const source=c.drips[Math.floor(r()*c.drips.length)];
      push(c.drops,{x:source.x,y:source.y,z:source.z,vx:(r()-.5)*.19,vy:-.27,vz:(r()-.5)*.22,
        age:0,life:1.3,size:.011+r()*.014});
    }
    c.poolClock+=dt*c.rain*smoothstep(c.wet,.09,.67)*15;
    while(c.poolClock>=1){
      c.poolClock--;
      const [x,z,rx,rz]=pools[Math.floor(r()*pools.length)],a=r()*tau,d=Math.sqrt(r())*.63;
      ring(c,x+rx*d*Math.cos(a),z+rz*d*Math.sin(a),.09+r()*.14,.31+r()*.24);
    }
    for(const pool of [c.drops,c.splash,c.rings]){
      let count=0;
      for(let i=pool.items.length-1;i>=0;i--){
        const p=pool.items[i];p.age+=dt;
        if(pool!==c.rings){
          p.vy-=9.8*dt;p.y+=p.vy*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;
          if(p.y<=-.024){
            if(pool===c.drops&&c.wet>.15)ring(c,p.x,p.z,.12+r()*.13,.42);
            p.age=p.life;
          }
        }
        if(p.age>=p.life){pool.items.splice(i,1);continue;}
        const t=p.age/p.life,fade=1-smoothstep(t,.46,1);
        m.position.set(p.x,p.y,p.z);
        if(pool===c.rings){
          const radius=p.radius*(.22+.78*t);
          m.position.y-=.017*(1-fade);m.scale.set(radius,1,radius);
        }else{
          const size=p.size*(.45+.55*fade);
          m.scale.set(size,size*(1+Math.min(2,Math.abs(p.vy)*.30)),size);
        }
        m.rotation.set(0,0,0);m.updateMatrix();pool.mesh.setMatrixAt(count++,m.matrix);
      }
      pool.mesh.count=count;
      if(count)pool.mesh.instanceMatrix.needsUpdate=true;
    }
  }

  function updateInsects(c,time,visibility){
    const {bodies,wings,centers}=c.insects,m=c.transform;
    const count=Math.round(centers.length*visibility);
    bodies.count=count;wings.count=count*4;
    const rates=[.23,.37,.53,.71];
    const offsets=[1.37,7.91,15.43,24.67];
    for(let i=0;i<count;i++){
      const [x,z]=centers[i];
      // Fully desynchronized dragonfly hover-and-dart kinematics: unique irrational rate + aperiodic time warp per insect.
      const rate=rates[i%rates.length];
      const cyc=time*rate+Math.sin(time*(.17+i*.11)+offsets[i%offsets.length])*.68+Math.cos(time*(.11+i*.07)-i*2.3)*.34+offsets[i%offsets.length];
      const slot=Math.floor(cyc),frac=cyc-slot;
      const hash=Math.abs(Math.sin(slot*12.9898+i*78.233)*43758.5453)%1;
      const dartDur=.14+hash*.20;
      const dart=smoothstep(frac,0,dartDur);
      const h0x=Math.sin(slot*3.71+i*2.19)*1.55+Math.cos(slot*1.93-i*1.3)*.45;
      const h0z=Math.cos(slot*2.93+i*2.71)*1.75+Math.sin(slot*1.61+i*2.1)*.45;
      const h0y=Math.sin(slot*2.37+i*1.7)*.44;
      const h1x=Math.sin((slot+1)*3.71+i*2.19)*1.55+Math.cos((slot+1)*1.93-i*1.3)*.45;
      const h1z=Math.cos((slot+1)*2.93+i*2.71)*1.75+Math.sin((slot+1)*1.61+i*2.1)*.45;
      const h1y=Math.sin((slot+1)*2.37+i*1.7)*.44;
      const bx=x+h0x+(h1x-h0x)*dart+.024*Math.sin(time*(21+i*4.3)+i*3.1);
      const bz=z+h0z+(h1z-h0z)*dart+.024*Math.cos(time*(24+i*3.7)+i*2.3);
      const by=(i%2===0?1.22:.88)+h0y+(h1y-h0y)*dart+.020*Math.sin(time*(17+i*3.1)+i);
      const dx=h1x-h0x,dz=h1z-h0z;
      const yaw=Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):i*1.1;
      const zipPitch=frac<dartDur?.24*Math.sin(frac/dartDur*Math.PI):0;
      m.position.set(bx,by,bz);m.rotation.set(zipPitch+.04*Math.cos(time*(7+i*1.9)+i),yaw,0,"YXZ");
      m.scale.set(.028,.027,.132);m.updateMatrix();bodies.setMatrixAt(i,m.matrix);
      for(let j=0;j<4;j++){
        const side=j%2?1:-1;
        m.position.set(bx,by+.011,bz+(j<2?.030:-.037));
        m.rotation.set(-Math.PI/2,yaw+(side<0?Math.PI:0)+side*.20,Math.sin(time*(68+i*7)+j*.4)*.78,"YXZ");
        m.scale.set(.152,.190,1);m.updateMatrix();wings.setMatrixAt(i*4+j,m.matrix);
      }
    }
    if(count){bodies.instanceMatrix.needsUpdate=true;wings.instanceMatrix.needsUpdate=true;}
  }

  function updateButterflies(c,time,visibility){
    if(!c.butterflies)return;
    const {wings,homes}=c.butterflies,m=c.transform;
    const count=Math.round(homes.length*visibility);
    wings.count=count*2;
    for(let i=0;i<count;i++){
      const [hx,hz]=homes[i],t=time*(.55+i*.04)+i*3.7;
      const bx=hx+1.45*Math.sin(t*.72)+.42*Math.cos(t*1.65);
      const bz=hz+1.35*Math.cos(t*.58)+.36*Math.sin(t*1.32);
      const by=c.heightAt(bx,bz)+.52+.26*Math.sin(t*1.9+i)+.12*Math.cos(t*3.1);
      const yaw=Math.atan2(1.45*.72*Math.cos(t*.72),-1.35*.58*Math.sin(t*.58));
      const flap=.22+Math.sin(time*(11.5+i*.7)+i*2.1)*.92;
      for(let side=0;side<2;side++){
        const dir=side?1:-1;
        m.position.set(bx,by,bz);
        m.rotation.set(0,yaw+(dir<0?Math.PI:0),dir*flap,"YXZ");
        m.scale.set(.068,.068,.068);m.updateMatrix();
        wings.setMatrixAt(i*2+side,m.matrix);
      }
    }
    if(count)wings.instanceMatrix.needsUpdate=true;
  }

  function update(c,time,dt,rain,wet,clear){
    c.rain=rain;c.wet=wet;
    for(const mat of c.boards){
      mat.roughness=lerp(.88,.48,wet);
      mat.color.setScalar(lerp(1,.72,wet));
    }
    if(c.motions){
      for(const {panelRig,nearPivot} of c.motions){
        panelRig.rotation.copy(nearPivot.rotation);
      }
    }
    updateWater(c,dt);
    updatePetals(c,time,dt,rain,clear);
    const fair=smoothstep(clear,.13,.67)*(1-smoothstep(rain,.008,.18));
    updateInsects(c,time,fair);
    updateButterflies(c,time,fair);
  }

  function poolLiquidAt(x,z,wet){
    if(wet<.045||Math.abs(x)>10||z<COURT.nearBaseline-2||z>COURT.farBaseline+2)return 0;
    return smoothstep(wet,.045,.77)*(.27+.73*(1-smoothstep(poolShape(x,z),.38,1.44)));
  }

  function triggerHoopPetals(kind,force){
    if(typeof currentScenePreset!=="undefined"&&currentScenePreset!=="flowerCourt")return;
    const env=(typeof environmentRoot!=="undefined"&&environmentRoot)||global.environmentRoot;
    const court=env?.userData?.placeState?.meadow?.court;
    if(court)hoopPetalImpact(court,kind,force);
  }

  global.AIBAMeadowCourt=Object.freeze({build,update,reset,ballImpact,hoopPetalImpact,triggerHoopPetals,poolLiquidAt,waterGLSL});
})(window);
