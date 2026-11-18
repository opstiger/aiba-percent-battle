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

  function build(s,supports,batch){
    const {boards,drips}=buildHoops(s,supports,batch);
    const ripple=new THREE.RingGeometry(.88,1,24);ripple.rotateX(-Math.PI/2);
    return {boards,drips,random:s.r,transform:new THREE.Object3D(),heightAt:s.heightAt,wet:0,rain:0,dripClock:0,poolClock:0,
      drops:instances(s,"meadowHoopDrips",new THREE.SphereGeometry(1,5,4),0xb7cdd1,.73,s.mobile?24:48),
      splash:instances(s,"meadowBallSplash",new THREE.SphereGeometry(1,5,4),0xd5e6e5,.73,s.mobile?68:138),
      rings:instances(s,"meadowWaterRipples",ripple,0xb8c8c6,.43,s.mobile?20:40),
      insects:buildInsects(s)};
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

  function update(c,time,dt,rain,wet,clear){
    c.rain=rain;c.wet=wet;
    for(const mat of c.boards){
      mat.roughness=lerp(.86,.49,wet);
      mat.color.setScalar(lerp(1,.72,wet));
    }
    updateWater(c,dt);
    updateInsects(c,time,smoothstep(clear,.13,.67)*(1-smoothstep(rain,.008,.18)));
  }

  global.AIBAMeadowCourt=Object.freeze({build,update,reset,ballImpact,waterGLSL});
})(window);
