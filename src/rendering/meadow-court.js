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
    const beige=["#80694f","#9d8057","#a08860","#88724f","#a7875f"];
    g.fillStyle=beige[0];g.fillRect(0,0,w,h);
    for(let row=0;row<5;row++){
      const y=h*row/5,dh=h/5;
      g.fillStyle=beige[row];g.fillRect(0,y,w,dh);
      for(let i=0;i<160;i++){
        const x=random()*w,yy=y+random()*dh,end=Math.min(w,x+18+random()*335);
        g.strokeStyle=i%4?"rgba(60,39,24,.16)":"rgba(243,210,163,.21)";
        g.lineWidth=.28+random()*1.7;g.beginPath();g.moveTo(x,yy);
        g.bezierCurveTo(lerp(x,end,.30),yy+random()*2,lerp(x,end,.60),yy-random()*4,end,yy+random()*3);g.stroke();
      }
      g.fillStyle="#433726";g.fillRect(0,y,w,1+random()*4);
      g.fillStyle="rgba(234,198,144,.58)";g.fillRect(0,y+4,w,1);
    }
    for(const [x,y,rx,ry] of [[143,97,15,6],[611,210,22,7],[478,347,12,4]]){
      for(let i=0;i<7;i++){
        g.beginPath();g.ellipse(x,y,rx+i*4,ry+i*.8,-.13,0,tau);
        g.lineWidth=1;g.strokeStyle=i?"rgba(64,40,23,.22)":"#5b3d24";g.stroke();
      }
    }
    for(let i=0;i<32;i++){
      const x=30+random()*(w-60),y=25+random()*(h-42);
      g.beginPath();g.moveTo(x,y);g.lineTo(x+4+random()*28,y+(random()-.5)*10);
      g.lineWidth=.6+random()*2;g.strokeStyle=i%3?"rgba(245,224,179,.55)":"rgba(58,42,28,.68)";g.stroke();
    }
    g.strokeStyle="#e6d8b2";g.lineWidth=11;g.lineJoin="round";
    g.beginPath();g.moveTo(43,41);g.lineTo(701,33);g.lineTo(733,51);g.lineTo(727,400);
    g.lineTo(42,409);g.lineTo(36,59);g.closePath();g.stroke();
    g.strokeRect(w*(.5-.31/1.9),h*(1-(3.44-2.95)/1.1),w*.62/1.9,h*.36/1.1);
    for(let i=0;i<83;i++){
      const x=32+random()*(w-64),y=random()*h;
      g.fillStyle=i%2?"rgba(94,66,41,.11)":"rgba(232,216,176,.16)";g.fillRect(x,y,1+random()*6,1+random()*13);
    }
    // Ball scuffs collect around the aim box, and exposed grain follows the edge of chipped paint.
    for(let i=0;i<57;i++){
      const x=w*(.50+(random()+random()-1)*.22),y=h*(.67+(random()+random()-1)*.28);
      g.lineWidth=.5+random()*2.4;g.strokeStyle=i%4?"rgba(58,46,34,.39)":"rgba(226,205,154,.64)";
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+3,y-4,x+13+random()*18,y+1+random()*5);g.stroke();
    }
    for(let i=0;i<64;i++){
      const edge=i%4,x=edge===0?39+random()*8:edge===1?720+random()*10:54+random()*655;
      const y=edge===2?37+random()*6:edge===3?403+random()*8:53+random()*348;
      g.fillStyle=i%2?"rgba(85,62,36,.45)":"rgba(167,135,84,.59)";
      g.fillRect(x,y,.7+random()*6,1+random()*2.4);
    }
    // Rust and runoff sit below the fasteners that anchor each board.
    for(const x of [78,w-88])for(const y of [75,h-65]){
      const grad=g.createLinearGradient(x,y,x+5,y+62);
      grad.addColorStop(0,"#634128");grad.addColorStop(1,"rgba(81,48,29,0)");
      g.fillStyle=grad;g.fillRect(x-3,y,7,63);
      g.beginPath();g.arc(x,y,6.5,0,tau);g.fillStyle="#555954";g.fill();
      g.fillStyle="#aaa395";g.fillRect(x-3,y-3,4,2);
    }
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return map;
  }

  function board(s,z,dir){
    const outline=[[-.94,.10],[-.95,.99],[-.88,1.078],[-.66,1.10],[-.18,1.091],[.11,1.10],
      [.57,1.081],[.88,1.077],[.943,1.011],[.949,.55],[.936,.31],[.947,.11],[.89,.017],
      [.58,.001],[.15,.016],[-.03,.006],[-.55,.003],[-.894,.023]];
    const shape=new THREE.Shape();
    outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.094,steps:1,bevelEnabled:true,bevelSize:.010,bevelThickness:.010,bevelSegments:1});
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,clamp(.5+p.getX(i)/1.92,0,1),clamp(p.getY(i)/1.12,0,1));
    const material=new THREE.MeshStandardMaterial({map:woodMap(s.r),color:0xffffff,roughness:.86});
    const mesh=new THREE.Mesh(geo,material);mesh.name="meadowWeatheredBackboard";
    mesh.position.set(0,2.95,z-dir*.046);mesh.rotation.y=dir>0?0:Math.PI;
    mesh.castShadow=true;mesh.receiveShadow=true;s.root.add(mesh);
    return material;
  }

  function buildHoops(s,supports,batch){
    const base=batch(),drips=[],boards=[];
    const steel=new THREE.MeshStandardMaterial({color:0x384c43,roughness:.76,metalness:.32});
    const band=new THREE.MeshStandardMaterial({color:0x8c6d4a,roughness:.78,metalness:.30});
    const axis=new THREE.Vector3(0,1,0);
    function tube(r0,r1,from,to,mat=steel){
      const start=new THREE.Vector3(...from),tip=new THREE.Vector3(...to),v=tip.clone().sub(start);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,v.length(),8),mat);
      mesh.position.copy(start).lerp(tip,.5);mesh.quaternion.setFromUnitVectors(axis,v.normalize());
      mesh.castShadow=true;mesh.receiveShadow=true;s.root.add(mesh);
    }
    for(const [z,dir] of supports){
      boards.push(board(s,z,dir));
      const foot=z-dir*1.55;
      base.add("rock",0x66675c,-.071,.073,foot,.97,.25,.79,0,.48,.075);
      base.add("rock",0x827e66,.22,.074,foot+.20,.43,.18,.59,.14,.82,-.09);
      base.add("rock",0x706e5b,-.29,.048,foot-.23,.49,.17,.52,0,1.1,-.11);
      tube(.145,.105,[0,.17,foot],[0,3.46,foot]);
      tube(.107,.081,[0,3.46,foot],[0,3.46,z-dir*.061]);
      tube(.055,.046,[-.05,2.40,foot],[-.21,3.39,z-dir*.16]);
      tube(.039,.037,[.074,2.60,foot],[.24,3.35,z-dir*.12]);
      tube(.132,.131,[0,.35,foot],[0,.47,foot],band);
      tube(.117,.117,[0,2.66,foot],[0,2.74,foot],band);
      for(const x of [-.90,-.73,-.37,.20,.58,.89])drips.push({x,y:2.956,z:z+dir*.05});
      const rimZ=dir>0?HOOP.z:COURT.farHoopZ;
      for(const x of [-.24,-.10,.11,.25])drips.push({x,y:HOOP.y-.024,z:rimZ+dir*(.31-Math.abs(x)*.55)});
    }
    base.finish(s.root,"meadowFieldstoneFootings").castShadow=true;
    return {boards,drips};
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
    const bodies=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({
      color:0x315548,metalness:.24,roughness:.50
    }),s.mobile?4:8);
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
    const centers=[[-7.3,-2.5],[7.5,5.1],[-5.3,8.5],[5.8,-5.7],[-10,2.2],[9,14],[-8.9,14],[2.1,17.7]];
    return {bodies,wings,centers:centers.slice(0,s.mobile?4:8)};
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
    const count=s.mobile?4:8;
    const shape=new THREE.Shape();
    shape.moveTo(0,0);shape.quadraticCurveTo(.45,.45,.95,.28);
    shape.quadraticCurveTo(1.0,-.05,.55,-.20);shape.quadraticCurveTo(.72,-.48,.22,-.52);shape.lineTo(0,0);
    const geo=new THREE.ShapeGeometry(shape,4);
    const mat=new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.55,side:THREE.DoubleSide,emissive:0xffe8b5,emissiveIntensity:.14
    });
    const wings=new THREE.InstancedMesh(geo,mat,count*2);
    const palette=[0xfff2c2,0xf6d57a,0xd8ecfa,0xf7e4b6];
    const c=new THREE.Color();
    for(let i=0;i<count;i++){
      c.set(palette[i%palette.length]).convertSRGBToLinear();
      wings.setColorAt(i*2,c);wings.setColorAt(i*2+1,c);
    }
    wings.instanceColor.needsUpdate=true;
    wings.name="meadowButterflies";wings.count=0;wings.frustumCulled=false;
    wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);s.root.add(wings);
    const homes=[[-8.6,-4.2],[8.8,1.8],[-9.1,7.5],[9.4,11.6],[-6.8,-10.2],[7.2,18.4],[-10.8,14.2],[10.4,-6.5]];
    return {wings,homes:homes.slice(0,count)};
  }

  function buildPollen(s){
    const count=s.mobile?55:135,pos=[],seed=[];
    for(let i=0;i<count;i++){
      pos.push((s.r()-.5)*28,.35+s.r()*3.4,COURT.midZ+(s.r()-.5)*34);
      seed.push(s.r(),.6+s.r()*.9);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute("mote",new THREE.Float32BufferAttribute(seed,2));
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{clock:s.meadow.time,wind:s.meadow.wind,meadowSky:s.meadow.uniforms.meadowSky},
      vertexShader:`
        attribute vec2 mote;
        uniform float clock,wind;
        uniform vec4 meadowSky;
        varying float vAlpha;
        void main(){
          float t=clock*(.22+.12*mote.y)+mote.x*62.8;
          vec3 p=position;
          p.x+=sin(t)*.9+mod(clock*(.35+.5*wind)+mote.x*28.0,28.0)-14.0;
          p.y+=sin(t*1.3+mote.x*19.0)*.28;
          p.z+=cos(t*.85)*.8;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(34.0*mote.y/max(4.0,-mv.z),1.4,4.8);
          float vis=smoothstep(.20,.72,meadowSky.x)*(1.0-smoothstep(.04,.22,meadowSky.z));
          vAlpha=vis*(.35+.65*sin(t*2.1)*.5+.5)*smoothstep(1.5,5.0,-mv.z)*(1.0-smoothstep(22.0,36.0,-mv.z));
        }`,
      fragmentShader:`
        uniform vec4 meadowSky;
        varying float vAlpha;
        void main(){
          float r=length(gl_PointCoord*2.0-1.0);
          float glow=exp(-r*r*3.8)*(1.0-smoothstep(.65,1.0,r));
          vec3 col=mix(vec3(1.0,.96,.82),vec3(1.0,.76,.42),meadowSky.y);
          gl_FragColor=vec4(col,glow*vAlpha*.52);
        }`
    });
    const pts=new THREE.Points(geo,mat);
    pts.name="meadowGoldenPollen";pts.frustumCulled=false;pts.renderOrder=2;s.root.add(pts);
    return pts;
  }

  function build(s,supports,batch){
    const {boards,drips}=buildHoops(s,supports,batch);
    buildPastureProps(s,batch);
    const ripple=new THREE.RingGeometry(.88,1,24);ripple.rotateX(-Math.PI/2);
    return {boards,drips,random:s.r,transform:new THREE.Object3D(),heightAt:s.heightAt,wet:0,rain:0,dripClock:0,poolClock:0,
      drops:instances(s,"meadowHoopDrips",new THREE.SphereGeometry(1,5,4),0xb7cdd1,.73,s.mobile?24:48),
      splash:instances(s,"meadowBallSplash",new THREE.SphereGeometry(1,5,4),0xd5e6e5,.73,s.mobile?68:138),
      rings:instances(s,"meadowWaterRipples",ripple,0xb8c8c6,.43,s.mobile?20:40),
      insects:buildInsects(s),butterflies:buildButterflies(s),pollen:buildPollen(s)};
  }

  function reset(court){
    court.wet=court.rain=court.dripClock=court.poolClock=0;
    for(const pool of [court.drops,court.splash,court.rings]){
      pool.items.length=0;pool.mesh.count=0;
    }
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
    for(let i=0;i<count;i++){
      const [x,z]=centers[i],t=time*(.86+i*.033)+i*2.9;
      const dash=t*.88+Math.sin(t*1.55)*.30;
      const bx=x+1.12*Math.sin(dash)+.26*Math.cos(t*2.4),bz=z+1.45*Math.cos(t*.67);
      const by=.61+.25*Math.sin(t*1.19+i)+.13*Math.cos(t*2.3);
      const yaw=Math.atan2(Math.cos(dash)*1.12,-.97*Math.sin(t*.67));
      m.position.set(bx,by,bz);m.rotation.set(.08*Math.cos(t*1.7),yaw,0,"YXZ");
      m.scale.set(.028,.027,.129);m.updateMatrix();bodies.setMatrixAt(i,m.matrix);
      for(let j=0;j<4;j++){
        const side=j%2?1:-1;
        m.position.set(bx,by+.011,bz+(j<2?.030:-.037));
        m.rotation.set(-Math.PI/2,yaw+(side<0?Math.PI:0)+side*.20,Math.sin(t*67+j*.4)*.73,"YXZ");
        m.scale.set(.147,.185,1);m.updateMatrix();wings.setMatrixAt(i*4+j,m.matrix);
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
      mat.roughness=lerp(.86,.49,wet);
      mat.color.setScalar(lerp(1,.72,wet));
    }
    updateWater(c,dt);
    const fair=smoothstep(clear,.13,.67)*(1-smoothstep(rain,.008,.18));
    updateInsects(c,time,fair);
    updateButterflies(c,time,fair);
  }

  global.AIBAMeadowCourt=Object.freeze({build,update,reset,ballImpact,waterGLSL});
})(window);
