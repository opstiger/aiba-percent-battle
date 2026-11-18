/* Tropical canyon. Generated geometry and atmosphere belong to the venue root. */
(function(global){
  "use strict";
  const {smoothstep,lerp}=THREE.MathUtils;
  const TAU=Math.PI*2;
  const light=new THREE.Vector3(-.33,.255,-.91).normalize();
  const leaves=[0x4b7840,0x59854a,0x375c36,0x3a6841,0x728e48,0x377251,0x315d3a,0x7b9148];
  const bark=[0x9d9587,0x857d69,0xa09b84,0x7c8572,0x899471];
  const pick=(list,r)=>list[Math.floor(r()*list.length)];
  const floorTint=new THREE.Color(0x74845e).convertSRGBToLinear();
  const rockColor=new THREE.Color(0x46564b).convertSRGBToLinear();

  function elevation(x,z){
    const edge=Math.hypot(Math.max(0,Math.abs(x)-9.1),Math.max(0,Math.abs(z-4.5)-15.4));
    const banks=2.1*Math.sin(x*.145+z*.056)+1.6*Math.cos(z*.13-x*.042)+.40*Math.sin(x*.72+z*.28);
    const gorge=-5.8*smoothstep(-z,36,113)*Math.exp(-x*x/2930);
    return -.038+smoothstep(edge,0,13)*(banks+gorge);
  }

  function texture(file){
    const tex=new THREE.TextureLoader().load(file);
    tex.encoding=THREE.sRGBEncoding;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=Math.min(6,renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  // Exact same openings light the foliage, the clearing and the air between them.
  const forestLight=`
    uniform vec3 forestSun;
    uniform float forestTime;
    vec2 canopyFoot(vec3 p){return p.xz-p.y*forestSun.xz/forestSun.y;}
    float lobe(vec2 p,vec2 origin,vec2 spread){
      vec2 d=(p-origin)/spread;
      return exp(-dot(d,d));
    }
    float lightShaft(vec3 p){
      vec2 q=canopyFoot(p);
      float ripples=.18*sin(q.y*.53+forestTime*.25)+.125*cos(q.x*.59-forestTime*.19);
      q.x+=ripples;
      float rays=.87*lobe(q,vec2(-5.4,-13.8),vec2(1.15,4.6))
        +.55*lobe(q,vec2(-3.55,-16.5),vec2(.68,4.8))
        +.77*lobe(q,vec2(6.7,-22.7),vec2(1.39,7.1))
        +.61*lobe(q,vec2(2.22,-19.4),vec2(1.07,4.1))
        +.70*lobe(q,vec2(12.1,-36.9),vec2(2.15,8.2))
        +.54*lobe(q,vec2(-18.2,-40.2),vec2(2.41,6.8));
      return rays*(1.0-smoothstep(18.0,29.0,p.y));
    }
    float forestClearing(vec3 p){
      float depth=max(0.0,-p.z);
      float center=p.x+.18*(depth-16.0)-2.0;
      float open=exp(-pow(center/(21.0+depth*.06),2.0));
      return smoothstep(10.0,41.0,depth)*open;
    }
    float leafLight(vec3 p){
      vec2 q=canopyFoot(p);
      float pools=lobe(q,vec2(-2.4,-.8),vec2(5.7,4.6))+
        .72*lobe(q,vec2(4.15,5.9),vec2(7.3,3.8))+.64*lobe(q,vec2(2.1,-11.2),vec2(4.0,5.9));
      float fine=sin(q.x*2.97+q.y*2.15)+sin(q.y*3.62-q.x*1.44)+.69*cos(q.x*5.83-q.y*4.94);
      return clamp(.24+pools*(.26+.51*smoothstep(-.62,1.23,fine))+.81*lightShaft(p),.24,1.0);
    }
  `;

  function surfaceLight(mat,uniforms,{plant=false,marks=null,moss=false,guard=plant}={}){
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const marksUniform=marks?"uniform sampler2D forestMarks,forestMossMap;\n":"";
      if(marks){
        shader.uniforms.forestMarks={value:marks.ink};
        shader.uniforms.forestMossMap={value:marks.moss};
      }
      const shared="varying vec3 vForestWorld,vForestView;\n";
      shader.vertexShader=shared+(plant?"uniform float forestTime;\nattribute float leafSway;\n":"")+shader.vertexShader.replace(
        "#include <begin_vertex>",`#include <begin_vertex>
          ${plant?"transformed.x+=sin(forestTime*1.29+position.z*.40+position.y*.26)*leafSway; transformed.z+=cos(forestTime*.89+position.x*.26)*leafSway*.54;":""}
          vec4 forestVertex=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            forestVertex=instanceMatrix*forestVertex;
          #endif
          vForestWorld=(modelMatrix*forestVertex).xyz;
          vForestView=(modelViewMatrix*forestVertex).xyz;`);
      shader.fragmentShader=forestLight+marksUniform+shared+(guard?
        "uniform vec4 subjectScreen, hoopScreen, ballScreen; uniform vec2 leafViewport;\n":"")+
        shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          ${marks?`
            vec2 ground=vForestWorld.xz;
            float damp=sin(ground.x*.57+ground.y*.53)*cos(ground.y*.71-ground.x*.51);
            vec2 rotated=mat2(.86,-.51,.51,.86)*ground;
            vec3 mossAlbedo=mapTexelToLinear(texture2D(forestMossMap,rotated*.37)).rgb;
            float border=max(abs(ground.x)-6.8,abs(ground.y-4.8)-13.1);
            float carpet=smoothstep(-2.3,2.0,border+damp*1.48);
            diffuseColor.rgb=mix(diffuseColor.rgb,mossAlbedo*vec3(.25,.43,.15),
              clamp(.94*carpet+.12*damp,.10,.97));
            diffuseColor.rgb*=mix(vec3(.77,.85,.78),vec3(1.30,1.25,.94),damp*.5+.5);
            vec2 uvLines=vec2(vForestWorld.x/20.0+.5,(22.0-vForestWorld.z)/35.0);
            if(all(greaterThan(uvLines,vec2(0.0)))&&all(lessThan(uvLines,vec2(1.0)))){
              vec4 line=mapTexelToLinear(texture2D(forestMarks,uvLines));
              diffuseColor.rgb=mix(diffuseColor.rgb,line.rgb,line.a*.71);
            }`:""}
          ${moss?`
            float relief=sin(vForestWorld.y*2.8+vForestWorld.x*3.2)*sin(vForestWorld.z*2.4-vForestWorld.y*1.14);
            float mossCover=(1.0-smoothstep(.2,4.7,vForestWorld.y))*smoothstep(-.20,.76,relief);
            diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.65,1.27,.61),mossCover*.58);`:""}
          ${guard?`
            // Near foliage can frame the viewport. Keep the live shooter, rim and ball clear.
            if(-vForestView.z<7.0){
              vec2 ndc=(gl_FragCoord.xy/leafViewport)*2.0-1.0;
              float d=-vForestView.z;
              vec2 p=ndc*vec2(leafViewport.x/leafViewport.y,1.0);
              float nearGate=1.0-smoothstep(4.3,7.0,d);
              float corridor=smoothstep(.58,.83,abs(ndc.x));
              float v=smoothstep(.14,.28,length(p-subjectScreen.xy));
              float h=smoothstep(.13,.23,length(p-hoopScreen.xy));
              float b=smoothstep(.115,.225,length(p-ballScreen.xy));
              v=mix(1.0,v,subjectScreen.w*step(d-.12,subjectScreen.z));
              h=mix(1.0,h,hoopScreen.w*step(d-.12,hoopScreen.z));
              b=mix(1.0,b,ballScreen.w*step(d-.09,ballScreen.z));
              float show=mix(v*h*b,min(corridor,v*h*b),nearGate);
              float contour=.39+.11*sin(vForestWorld.y*11.6+vForestWorld.x*9.3)*
                cos(vForestWorld.z*8.3-vForestWorld.y*7.1);
              if(show<contour)discard;
            }`:""}
        `).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
          float daylight=leafLight(vForestWorld);
          reflectedLight.directDiffuse*=daylight;
          reflectedLight.directSpecular*=daylight;
          ${plant?`
            float beam=lightShaft(vForestWorld);
            vec3 lightView=normalize((viewMatrix*vec4(forestSun,0.0)).xyz);
            float transmittance=.31+.69*pow(max(0.0,dot(normal,-lightView)),.72);
            float forwardLight=pow(max(0.0,dot(normalize(vForestWorld-cameraPosition),forestSun)),3.8);
            float transmission=(beam*.78+forestClearing(vForestWorld)*forwardLight*.51)*transmittance;
            totalEmissiveRadiance+=diffuseColor.rgb*vec3(.81,.66,.29)*beam
              +vec3(.49,.278,.055)*transmission;
          `:""}`);
    };
    mat.customProgramCacheKey=()=>`rainforest:${plant}:${!!marks}:${moss}:${guard}`;
  }

  function meshBuilder(){
    return {p:[],n:[],uv:[],color:[],sway:[]};
  }
  function vertex(out,p,n,u,v,c,sway=0){
    out.p.push(p.x,p.y,p.z);out.n.push(n.x,n.y,n.z);out.uv.push(u,v);
    out.color.push(c.r,c.g,c.b);out.sway.push(sway);
  }
  function geometryFrom(out){
    const geo=new THREE.BufferGeometry();
    for(const [key,source,size] of [["position",out.p,3],["normal",out.n,3],["uv",out.uv,2],["color",out.color,3],["leafSway",out.sway,1]]){
      geo.setAttribute(key,new THREE.Float32BufferAttribute(source,size));
    }
    geo.computeBoundingSphere();
    return geo;
  }
  function finish(root,out,material,name,shadow=false){
    const mesh=new THREE.Mesh(geometryFrom(out),material);mesh.name=name;mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  }

  function limb(out,from,to,radius,r1,tint,bend=0,roots=false,sides=8){
    const axis=to.clone().sub(from).normalize(),right=new THREE.Vector3(0,0,1).cross(axis).normalize();
    if(right.lengthSq()<.01)right.set(1,0,0);
    const across=axis.clone().cross(right),length=from.distanceTo(to),rows=roots?6:3;
    const rings=[];
    for(let j=0;j<=rows;j++){
      const t=j/rows,center=from.clone().lerp(to,t).addScaledVector(right,Math.sin(t*Math.PI)*bend);
      const row=[];
      for(let i=0;i<=sides;i++){
        const theta=i/sides*TAU,normal=right.clone().multiplyScalar(Math.cos(theta)).addScaledVector(across,Math.sin(theta));
        const ribs=.88+.11*Math.sin(theta*5.0+t*2)+.05*Math.cos(theta*7-t*4);
        const skirt=roots?1+Math.pow(1-t,9)*(.63+.46*Math.cos(theta*4)):1;
        const rad=lerp(radius,r1,t)*ribs*skirt;
        row.push([center.clone().addScaledVector(normal,rad),normal,i/sides*Math.max(1,radius*3),
          t*length*.40,tint,0]);
      }
      rings.push(row);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
      const a=rings[j][i],b=rings[j][i+1],c=rings[j+1][i],d=rings[j+1][i+1];
      for(const item of [a,b,c,b,d,c])vertex(out,...item);
    }
  }
  function blade(out,start,heading,length,width,rise,curve,tint,wind,steps=5,split=false){
    const dir=new THREE.Vector3(Math.cos(heading),0,Math.sin(heading)),across=new THREE.Vector3(-dir.z,0,dir.x);
    const rows=[];
    for(let j=0;j<=steps;j++){
      const t=j/steps,spread=width*Math.pow(Math.sin(Math.PI*t),.80)*(.92+Math.cos(t*2.1)*.16)
        *(split&&j%2===1?.65:1);
      const center=start.clone().addScaledVector(dir,length*t);
      center.y+=rise*t+curve*Math.sin(t*Math.PI*.91);
      const slope=(rise+curve*Math.PI*.91*Math.cos(t*Math.PI*.91))/length;
      const row=[];
      for(const side of [-1,0,1]){
        const p=center.clone().addScaledVector(across,spread*side);
        p.y-=Math.abs(side)*spread*.21;
        const n=new THREE.Vector3(0,1,0).addScaledVector(dir,-slope).addScaledVector(across,.23*side).normalize();
        row.push([p,n,(side+1)*.5,t,tint,wind*t*t]);
      }
      rows.push(row);
    }
    for(let j=0;j<steps;j++)for(let i=0;i<2;i++){
      const a=rows[j][i],b=rows[j][i+1],c=rows[j+1][i],d=rows[j+1][i+1];
      for(const item of [a,b,c,b,d,c])vertex(out,...item);
    }
  }
  function color(hex){return new THREE.Color(hex).convertSRGBToLinear();}

  function leafTexture(r){
    const canvas=document.createElement("canvas");canvas.width=96;canvas.height=224;
    const g=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
    const a=g.createLinearGradient(0,0,w,0);
    a.addColorStop(0,"#88986d");a.addColorStop(.21,"#c4ca9e");a.addColorStop(.48,"#dadeb8");
    a.addColorStop(.515,"#b6bf94");a.addColorStop(.74,"#cbd1ad");a.addColorStop(1,"#8c9b73");
    g.fillStyle=a;g.fillRect(0,0,w,h);
    for(let i=0;i<25;i++)for(const dir of [-1,1]){
      const y=12+i*8.1+3*r();
      g.beginPath();g.moveTo(w*.5,y);g.quadraticCurveTo(w*.5+dir*15,y-8,dir===1?w:0,y-24);
      g.lineWidth=.55+r()*.6;g.strokeStyle="rgba(72,95,51,.36)";g.stroke();
    }
    g.strokeStyle="rgba(232,225,175,.88)";g.lineWidth=1.65;g.beginPath();g.moveTo(w*.5,h);g.lineTo(w*.5,0);g.stroke();
    for(let i=0;i<126;i++){
      g.fillStyle=i%3?"rgba(63,83,47,.12)":"rgba(243,228,177,.20)";
      g.fillRect(r()*w,r()*h,.5+r()*1.5,.6+r()*1.8);
    }
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
    return map;
  }

  function marks(){
    const canvas=document.createElement("canvas");canvas.width=960;canvas.height=1536;
    const g=canvas.getContext("2d"),{nearBaseline,farBaseline,halfWidth,midZ}=COURT;
    g.scale(canvas.width/20,canvas.height/35);g.translate(10,13);
    g.lineCap="round";g.lineWidth=.061;g.strokeStyle="#d2cdb2";
    g.setLineDash([.89,.041,1.64,.096,.46,.049]);
    g.globalAlpha=.62;g.strokeRect(-halfWidth,nearBaseline,halfWidth*2,farBaseline-nearBaseline);
    g.beginPath();g.moveTo(-halfWidth,midZ);g.lineTo(halfWidth,midZ);g.stroke();
    g.beginPath();g.arc(0,midZ,1.8,0,TAU);g.stroke();
    for(const [z,base,sign] of [[HOOP.z,nearBaseline,1],[COURT.farHoopZ,farBaseline,-1]]){
      const free=base+sign*5.79,dir=sign===1?0:Math.PI;
      g.globalAlpha=.55;g.strokeRect(-2.45,Math.min(base,free),4.9,5.79);
      g.beginPath();g.arc(0,free,1.8,dir,dir+Math.PI);g.stroke();
      g.globalAlpha=.85;g.lineWidth=.072;
      const radius=7.24,side=6.71,angle=Math.acos(side/radius);
      const join=z+sign*Math.sqrt(radius*radius-side*side);
      g.beginPath();g.arc(0,z,radius,dir+angle,dir+Math.PI-angle);g.stroke();
      for(const x of [-side,side]){g.beginPath();g.moveTo(x,base);g.lineTo(x,join);g.stroke();}
    }
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
    return map;
  }
  function ground(s,uniforms){
    const geo=new THREE.PlaneGeometry(455,545,s.mobile?82:116,s.mobile?96:140);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv,cols=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i)-83;
      p.setXYZ(i,x,elevation(x,z),z);
      uv.setXY(i,x*.28,z*.28);
      const shade=.78+.13*Math.sin(x*.19+z*.28)+.09*Math.cos(x*.34-z*.28);
      cols.push(floorTint.r*shade,floorTint.g*shade,floorTint.b*shade);
    }
    geo.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));geo.computeVertexNormals();
    const floor=new THREE.MeshPhongMaterial({color:0xf8f4df,vertexColors:true,map:texture("assets/rainforest/forest-floor.jpg"),shininess:7,specular:0x262b1d});
    const ink=marks(),moss=texture("assets/rainforest/moss-litter.jpg");
    floor.addEventListener("dispose",()=>{ink.dispose();moss.dispose();});
    surfaceLight(floor,uniforms,{marks:{ink,moss}});
    const mesh=new THREE.Mesh(geo,floor);mesh.name="rainforestCourtGround";mesh.receiveShadow=true;s.root.add(mesh);
  }

  function trees(s,uniforms){
    const r=s.r,wood=meshBuilder(),leaf=meshBuilder(),hero=meshBuilder(),vines=meshBuilder();
    const barkMat=new THREE.MeshPhongMaterial({map:texture("assets/rainforest/bark.jpg"),vertexColors:true,
      bumpMap:texture("assets/rainforest/bark.jpg"),bumpScale:.20,shininess:7,specular:0x2c281f});
    barkMat.bumpMap.encoding=THREE.LinearEncoding;
    const leafMat=new THREE.MeshPhongMaterial({map:leafTexture(r),vertexColors:true,
      shininess:19,specular:0x262a17,side:THREE.DoubleSide});
    const vineMat=new THREE.MeshPhongMaterial({vertexColors:true,shininess:7,specular:0x253924});
    surfaceLight(vineMat,uniforms,{guard:true});
    surfaceLight(barkMat,uniforms,{moss:true});
    surfaceLight(leafMat,uniforms,{plant:true});

    function plantTree(x,z,h,rad,near,wider){
      const y=elevation(x,z),base=new THREE.Vector3(x,y,z);
      const lean=(r()-.5)*(near?5.3:6.5),apex=base.clone().add(new THREE.Vector3(lean,h,(r()-.5)*4));
      const tint=color(pick(bark,r));
      limb(wood,base,apex,rad,rad*.18,tint,lean*.38,near,near?10:7);
      if(near)for(let j=0;j<5;j++){
        const a=TAU*(j+r()*.42)/5,d=rad*(2.4+r()*1.6);
        const foot=new THREE.Vector3(x+Math.cos(a)*d,y+.03,z+Math.sin(a)*d);
        foot.y=elevation(foot.x,foot.z)+.03;
        limb(wood,foot,base.clone().add(new THREE.Vector3(0,1.7+1.7*r(),0)),.09,rad*.40,tint,.10,false,6);
      }
      const branches=near?9:wider?6:4;
      for(let i=0;i<branches;i++){
        const t=.56+i/(branches-1)*.383,angle=i*2.399+r()*.64;
        const a=base.clone().lerp(apex,t);
        const span=(1.8+r()*4.1)*h/25*(1.21-i*.039);
        const end=a.clone().add(new THREE.Vector3(Math.cos(angle)*span,h*(.06+r()*.105),Math.sin(angle)*span));
        limb(wood,a,end,rad*(.19+.05*r()),.027,tint,span*.067,false,near?6:5);
        const bunches=near?3:2;
        for(let j=0;j<bunches;j++){
          const center=a.clone().lerp(end,.63+.18*j);
          center.y+=.32+r()*1.08;
          const leafCount=near?11:wider?8:6;
          for(let k=0;k<leafCount;k++){
            const p=center.clone().add(new THREE.Vector3((r()-.5)*span*.60,(r()-.5)*span*.27,(r()-.5)*span*.60));
            const l=(.94+r()*1.55)*Math.pow(h/22,.74);
            blade(leaf,p,k*2.39+r(),l,l*(.18+r()*.13),-.27*l,.12*l,
              color(pick(leaves,r)).multiplyScalar(.78+r()*.38),.07+r()*.12,near?3:2);
          }
        }
      }
    }

    const giants=[[-13.5,-12,35,1.26],[13.1,-10,37,1.33],[-13.1,10.2,32,1.00],[14.3,6.7,31,1.02],
      [-15.8,-18,36,1.29],[13.8,-24,37,1.13],[8.2,-25,31,.83],[-5.8,-28.1,35,1.08],
      [1.3,-41,33,.81],[-20,-32,41,1.55],[19.3,-35,38,1.34],[-14,22,36,1.45],[17.7,20,37,1.38],
      [3.7,26.6,29,.89],[-6.2,26.7,32,1.11],[-22,4.8,36,1.32],[22,6.7,40,1.56]];
    for(const args of giants)plantTree(...args,true,true);
    for(let layer=0;layer<6;layer++){
      const count=(s.mobile?[13,18,20,24,25,26]:[19,27,33,40,41,43])[layer];
      const distance=[19,31,49,73,114,173][layer],spread=distance*.62+8;
      for(let i=0;i<count;i++){
        const x=(r()-.5)*spread*2,z=-(distance+(r()-.5)*(17+layer*8));
        const opens=(z<-35&&z>-72&&Math.abs(x+10.8)<3.8)||(z>-34&&Math.abs(x)<4.4);
        if(opens)continue;
        if(giants.some(([gx,gz])=>Math.hypot(x-gx,z-gz)<3.4))continue;
        plantTree(x,z,19+18*r()+layer*.6,.32+.42*r(),false,layer<3);
      }
    }
    for(const sign of [-1,1])for(let i=0;i<(s.mobile?21:33);i++){
      const x=sign*(16+r()*36),z=-24+r()*67;
      if(giants.some(([gx,gz])=>Math.hypot(x-gx,z-gz)<3.4))continue;
      plantTree(x,z,17+20*r(),.34+.67*r(),false,true);
    }

    function understory(out,x,z,sz,variant,flower=false){
      const start=new THREE.Vector3(x,elevation(x,z),z),n=variant===0?5+Math.floor(r()*3):5+Math.floor(r()*4);
      for(let j=0;j<n;j++){
        const a=(j+r()*.52)/n*TAU,l=sz*(.57+.64*r()),c=color(pick(leaves,r));
        const base=start.clone();base.y+=sz*(.12+r()*.3);
        const stem=base.clone().lerp(start,.6);stem.x+=.06;
        const tip=base.clone().add(new THREE.Vector3(Math.cos(a)*l*.28,sz*(.12+r()*.34),Math.sin(a)*l*.28));
        limb(wood,stem,tip,sz*.019,sz*.011,color(0x809351),.037,false,5);
        if(variant===0){
          blade(out,base,a,l,l*.026,-.13*l,l*.36,c,.14*sz,5);
          for(let k=1;k<8;k++)for(const sign of [-1,1]){
            const t=k/9,p=base.clone().add(new THREE.Vector3(Math.cos(a)*l*t,Math.sin(t*Math.PI*.91)*l*.36-.13*l*t,Math.sin(a)*l*t));
            const fan=l*(.13+.18*Math.sin(t*Math.PI))*(.8+r()*.22);
            blade(out,p,a+sign*(1.12-.51*t),fan,fan*.19,-fan*.21,fan*.16,c,.06*sz,2);
          }
        }else{
          blade(out,tip,a,l,l*(.17+.13*r()),l*(-.11+r()*.24),.25*l,c,.19*sz,6,variant===2);
        }
      }
      if(flower){
        const end=start.clone();end.y+=sz*.58;
        limb(wood,start,end,sz*.014,sz*.009,color(0x526a35),.12,false,5);
        const flowerTones=[0xa54d2c,0xb66034,0xc17c3b,0xa9452d];
        for(let i=0;i<5;i++){
          const p=end.clone();p.y+=i*.092*sz;
          blade(out,p,i%2===0?.7:3.84,sz*(.27-.025*i),sz*.064,.11*sz,.085*sz,
            color(flowerTones[i%flowerTones.length]),.065*sz,5);
        }
      }
    }
    const banks=[[-10.6,-7,1.7],[10.1,-3.5,2.1],[-8.6,2.3,1.75],[9.2,2.4,1.72],
      [-11.8,9,2.6],[11.3,9.2,2.9],[-10,15.1,2.1],[-7.9,19,1.8],[8.6,19,2.1],
      [-4.5,-13.1,1.74],[5,-12.5,1.86],[0,-15.2,1.45],[-11,-22,2.9],[7.9,-26.9,2.4]];
    banks.forEach(([x,z,sz],i)=>{
      for(let j=0;j<6;j++)understory(hero,x+(r()-.5)*3.4,z+(r()-.5)*3.3,sz*(.38+r()*.69),(i+j)%3,j===1&&i%3===0);
    });
    for(let i=0;i<(s.mobile?75:123);i++){
      const z=-55+r()*79,sign=r()<.5?-1:1,x=sign*(10.9+r()*23);
      understory(leaf,x,z,.56+r()*2.24,i%3,i%14===0);
    }
    // Rooted saplings around the playing area let nearby blades enter the sides of follow and
    // broadcast shots. The screen clearance in the leaf material protects the ball and rim.
    const frameSites=[[-7.93,-3.2],[8.13,-1.7],[-6.3,2.05],[5.54,2.74],[-3.8,4.8],[2.85,3.5],
      [-8.8,7.1],[8.5,5.1],[-3.2,8.4],[3.75,9.4],[-7.9,12.4],[8.2,13.3],[-5.1,15.7]];
    frameSites.forEach(([x,z],i)=>{
      const scale=i%3===1?1.75:1.32;
      understory(hero,x,z,scale,i%4===0?0:2,i%5===0);
      if(i%2===0)understory(hero,x+.57,z-.32,scale*.81,0,false);
    });
    const lianas=[[-3.63,1.22,2.14],[-1.43,1.44,2.55],[2.15,-1.03,2.38],
      [-6.78,.02,2.32],[-3.63,-3.97,2.73],[1.02,-3.33,2.39],[4.63,1.28,2.38],
      [-9.95,4.3,3.42],[11.16,4.65,3.54],[-10.6,11.45,4.82],[9.75,10.7,4.58]];
    for(const [x,z,low] of lianas){
      const drop=17+7*r(),swing=.49+r()*.23;
      let prev=new THREE.Vector3(x+swing,low+drop,z);
      for(let j=1;j<=14;j++){
        const t=j/14,next=new THREE.Vector3(x+swing*Math.cos(t*4.6),low+drop*Math.pow(1-t,1.36),z+.29*Math.sin(t*7.9));
        limb(vines,prev,next,.023-.015*t,.022-.015*t,color(0x43543c),.055,false,4);
        if(j>8||j%2===0){
          const center=next.clone().lerp(prev,.18);
          for(let k=0;k<2;k++){
            const angle=j*2.39+k*2.83,l=(.51+r()*.69)*(j>11?1.22:1);
            blade(hero,center,angle,l,l*(.24+r()*.14),-.36*l,l*.16,color(pick(leaves,r)),.10,5);
          }
        }
        prev=next;
      }
    }
    // A low fern layer overlaps wide alocasia and upright palms behind the sidelines.
    // Openings break up the undergrowth and leave the playable grass and shooting approach clear.
    const groups=[[-9.7,-7.7,1.8],[-9.8,-3.2,1.7],[-10.0,4.0,2.8],[-11.0,8.4,2.6],[-9.5,15.4,2.1],
      [9.8,-9.4,2.3],[10.0,-5.0,1.9],[9.5,.4,2.65],[11.7,6.1,2.2],[10.3,13.5,2.1],
      [-7.2,-13.2,2.35],[-4.0,-15.2,1.8],[4.7,-14.1,2.3],[7.5,-16.2,2.6],
      [-7.3,19.6,1.7],[5.8,20.3,1.75],[-11.3,-19.8,2.9],[12.4,-20.0,2.8],
      [-17.6,-27.6,2.7],[-7.5,-30.7,2.5],[9.5,-31.0,2.6],[14.7,-39.4,2.55]];
    for(const [cx,cz,scale] of groups){
      for(let j=0;j<(s.mobile?5:8);j++){
        const x=cx+(r()+r()-1)*3.45,z=cz+(r()+r()-1)*3.0;
        if(Math.abs(x)<9.35&&z>-11.8&&z<19.5)continue;
        const foreground=Math.abs(z-3)<19&&Math.abs(x)<15;
        const size=scale*(j<3?.42+r()*.28:.75+r()*.51);
        understory(foreground?hero:leaf,x,z,size,j<2?0:j%2+1,j===4&&r()<.29);
      }
    }

    const palms=[[-12.4,1.4,3.4],[13.3,3.0,4.0],[-11.45,11.4,3.25],[13.2,-8.2,3.4],
      [-8.9,-17.8,4.6],[7.6,-18.9,5.0],[-10.2,-27.8,4.9],[15.4,-28.5,5.3]];
    for(const [x,z,height] of palms){
      const base=new THREE.Vector3(x,elevation(x,z),z);
      const crown=base.clone().add(new THREE.Vector3((r()-.5)*.8,height,(r()-.5)*.68));
      limb(wood,base,crown,height*.051,height*.015,color(0x68714b),.23,false,7);
      for(let j=0;j<6;j++){
        const direction=j*TAU/6+r()*.3,length=height*(.36+r()*.20);
        const a=crown.clone().add(new THREE.Vector3((r()-.5)*.28,r()*.22,(r()-.5)*.28));
        const spread=direction+.62;
        for(let lane=-3;lane<=3;lane++){
          const angle=spread+lane*.168;
          blade(hero,a,angle,length*(1-Math.abs(lane)*.08),length*(.051+r()*.015),-length*.47,length*.28,
            color(pick(leaves,r)),.14,5);
        }
      }
    }
    // Tall arching ferns hold the light under the canopy. Leaves grow from the frond, in pairs.
    const towerFerns=[[-10.1,-8.5,3.6],[10.9,-8.4,3.3],[-7.3,-14.0,3.7],[7.2,-14.5,4.5],
      [-11.2,-19.9,4.7],[11.0,-24.2,5.0],[-3.6,-23.9,3.1],[-13.6,4.5,3.5],[14.2,5.8,3.5]];
    for(const [x,z,size] of towerFerns){
      const origin=new THREE.Vector3(x,elevation(x,z)+.035,z);
      for(let j=0;j<5;j++){
        const a=(j+r()*.43)*TAU/5,l=size*(.65+r()*.38),rise=l*(.70+r()*.39);
        const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
        const point=t=>{
          const p=origin.clone().addScaledVector(dir,l*t);
          p.y+=Math.sin(t*2.39)*rise;
          return p;
        };
        let from=origin.clone();
        for(let k=1;k<=7;k++){
          const to=point(k/7);
          limb(wood,from,to,.023*(1-k/9),.012*(1-k/9),color(0x8a9651),.025,false,4);
          from=to;
        }
        const tone=color(pick([0x7b9143,0x607e40,0x78944c,0x4f7840,0x799b4a],r));
        const pairs=s.mobile?10:14;
        for(let k=1;k<=pairs;k++){
          const t=k/(pairs+1),start=point(t);
          for(const side of [-1,1]){
            const length=l*(.085+.235*Math.pow(Math.sin(t*Math.PI),.75))*(.90+r()*.19);
            blade(hero,start,a+side*(1.18-.78*t),length,length*(.105+.05*r()),
              -.28*length,length*.19,tone,.09+size*.036,4);
          }
        }
      }
    }
    finish(s.root,wood,barkMat,"rainforestButtressTrees",true);
    finish(s.root,leaf,leafMat,"rainforestCanopy");
    finish(s.root,hero,leafMat,"rainforestForegroundLeaves");
    finish(s.root,vines,vineMat,"rainforestHangingLianas");
    mossTufts(s,leafMat);
  }

  function mossTufts(s,material){
    const r=s.r,proto=meshBuilder(),dummy=new THREE.Object3D();
    const white=new THREE.Color(1,1,1),origin=new THREE.Vector3();
    for(let i=0;i<4;i++){
      const a=i*2.39,len=.38+r()*.45;
      blade(proto,origin,a,len,.064+r()*.033,.19+r()*.18,.087,white,.041,2);
    }
    const capacity=s.mobile?1550:3360;
    const bed=new THREE.InstancedMesh(geometryFrom(proto),material,capacity);
    bed.name="rainforestMossTufts";bed.frustumCulled=false;bed.receiveShadow=true;
    const closeBeds=[[-9.3,-8.1,3.1],[9.2,-5.5,2.9],[-9.4,.8,3.1],[9.6,3.5,3.5],[-11.4,11,4],
      [11.4,13.8,3.1],[-7.9,-13.3,3.6],[-3.5,-14.2,3.4],[4.8,-14.6,3.4],[9.8,-18.3,4.5],
      [-13.9,-20.0,4.4],[3.4,-21.9,3.6],[-12.2,20.8,3.5],[9.8,22.2,3.2]];
    const tones=[0x6b8643,0x83974b,0x3e6137,0x577940,0x66843a,0x7d8944,0x68844b].map(color);
    let used=0;
    for(let i=0;i<capacity;i++){
      const [cx,cz,reach]=closeBeds[i%closeBeds.length];
      const theta=r()*TAU,span=Math.sqrt(r())*reach;
      const x=cx+Math.cos(theta)*span,z=cz+Math.sin(theta)*span;
      if(Math.abs(x)<8.1&&z>-10.92&&z<19.8)continue;
      const f=.21+r()*.64;
      dummy.position.set(x,elevation(x,z)-.015,z);
      dummy.rotation.set((r()-.5)*.70,r()*TAU,(r()-.5)*.6);
      dummy.scale.set(f,f*(.62+r()*.55),f);
      dummy.updateMatrix();bed.setMatrixAt(used,dummy.matrix);bed.setColorAt(used++,pick(tones,r));
    }
    bed.count=used;bed.instanceMatrix.needsUpdate=true;bed.instanceColor.needsUpdate=true;s.root.add(bed);
  }

  function cliffs(s,uniforms,batch){
    const r=s.r,rock=meshBuilder(),v=new THREE.Vector3();
    const proto=new THREE.IcosahedronGeometry(1,2);
    const p=proto.attributes.position;
    for(const side of [-1,1])for(let i=0;i<10;i++){
      const z=23-i*13.4,x=side*(30+i*1.85+r()*7),h=16+r()*20;
      const shapes=[[x,z,h*.52,11+r()*5,h,12+r()*4],[x+side*4,z-5,h*.79,9,h*.72,9]];
      for(const [cx,cz,cy,w,ry,rz] of shapes){
        for(let j=0;j<p.count;j+=3){
          const triangle=[];
          for(let k=0;k<3;k++){
            v.fromBufferAttribute(p,j+k);
            const warp=1+.15*Math.sin(v.x*10+v.y*7)+.09*Math.cos(v.z*17-v.y*8);
            const point=new THREE.Vector3(cx+w*v.x*warp,cy+ry*v.y*(.71+.29*warp),cz+rz*v.z*warp);
            triangle.push(point);
          }
          const n=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
          for(const point of triangle)vertex(rock,point,n,(point.x*.19+point.z*.12),point.y*.19,rockColor);
        }
      }
    }
    proto.dispose();
    const mat=new THREE.MeshPhongMaterial({vertexColors:true,map:texture("assets/meadow/alpine-rock.jpg"),shininess:5,specular:0x17231c});
    surfaceLight(mat,uniforms,{moss:true});finish(s.root,rock,mat,"rainforestErodedGorge");
    const rocks=batch();
    const spot=[[-7.4,-15],[8.9,-11],[-11.2,2.3],[12.1,5.7],[-12,-7],[-10.1,20.1],[7.1,21.4]];
    spot.forEach(([x,z],i)=>rocks.add("rock",i%2?0x505a43:0x4b5248,x,elevation(x,z)+.1,z,1.3+r()*2,.44+r()*.66,1.6+r(),.19,r()*TAU,.2));
    const groundRocks=rocks.finish(s.root,"rainforestMossStone");groundRocks.castShadow=true;
  }

  function waterfall(s,uniforms){
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:uniforms.forestTime}]),fog:true,
      vertexShader:`
        varying vec2 tex;
        uniform float time;
        #include <fog_pars_vertex>
        void main(){
          tex=uv;vec3 p=position;p.x*=1.0+.26*pow(1.0-uv.y,3.0);
          p.x+=.19*sin(uv.y*11.0+time*.9)*(1.0-uv.y);
          vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`
        varying vec2 tex;
        uniform float time;
        #include <fog_pars_fragment>
        void main(){
          float fall=sqrt(max(.03,1.0-tex.y))*4.7-time*2.85;
          float run=sin(tex.x*119.0+sin(fall*7.9))+sin(tex.x*188.0-fall*4.4)*.43+
            .31*cos(fall*9.8+tex.x*23.0);
          float streak=smoothstep(-.87,1.0,run),edge=smoothstep(.012,.18,tex.x)*(1.0-smoothstep(.79,.99,tex.x));
          float foam=(1.0-smoothstep(.005,.14,tex.y))*(.63+.37*streak);
          vec3 col=mix(vec3(.34,.47,.44),vec3(.81,.89,.83),streak*.70+foam*.22);
          gl_FragColor=vec4(col,edge*(.29+.43*streak+.24*foam));
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <fog_fragment>
        }`});
    mat.uniforms.time=uniforms.forestTime;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.40,17.5,9,19),mat);
    mesh.name="rainforestWaterfall";mesh.position.set(-12.8,7.45,-56.3);mesh.rotation.y=.20;
    s.root.add(mesh);
    const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshLambertMaterial({color:0x263b31,flatShading:true}));
    stone.position.set(-13.45,8,-60);stone.scale.set(7.6,14.4,3.6);s.root.add(stone);
    const water=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshPhongMaterial({
      color:0x3d6863,shininess:23,specular:0x495952,transparent:true,opacity:.77
    }));
    water.name="rainforestFallsPool";water.rotation.x=-Math.PI/2;water.position.set(-12.5,-.58,-54.1);water.scale.set(6.3,4.6,1);s.root.add(water);
  }

  function canopySky(s,uniforms){
    const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms,
      vertexShader:`varying vec3 ray;void main(){ray=(modelMatrix*vec4(position,1.0)).xyz-cameraPosition;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec3 ray;uniform vec3 forestSun;
        void main(){
          vec3 d=normalize(ray);
          vec3 horizon=vec3(.23,.25,.16),sky=vec3(.21,.285,.255);
          vec3 c=mix(horizon,sky,smoothstep(.015,.69,d.y));
          float toward=max(0.0,dot(d,forestSun));
          c+=vec3(.84,.54,.17)*pow(toward,4.2)+vec3(.48,.25,.06)*pow(toward,34.0);
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`});
    const dome=new THREE.Mesh(new THREE.SphereGeometry(237,31,16),mat);
    dome.name="rainforestCanopySky";dome.position.z=-12;dome.renderOrder=-990;dome.frustumCulled=false;s.root.add(dome);
  }

  function air(s,uniforms){
    const rayUniforms={...uniforms,sceneDepth:{value:null},invProjection:{value:new THREE.Matrix4()},
      cameraWorld:{value:new THREE.Matrix4()}};
    const material=new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,uniforms:rayUniforms,
      defines:{STEPS:s.mobile?8:13},
      vertexShader:`varying vec2 tex;void main(){tex=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:forestLight+`
        uniform sampler2D sceneDepth;
        uniform mat4 invProjection,cameraWorld;
        varying vec2 tex;
        void main(){
          float z=texture2D(sceneDepth,tex).r;
          vec4 a=invProjection*vec4(tex*2.0-1.0,z*2.0-1.0,1.0);
          vec3 direction=(cameraWorld*vec4(normalize(a.xyz/a.w),0.0)).xyz;
          vec3 origin=cameraWorld[3].xyz;
          float depth=min(137.0,length(a.xyz/a.w));
          float jitter=.27+.48*fract(dot(gl_FragCoord.xy,vec2(.75487766,.56984029)));
          float accumulated=0.0,glow=0.0,amber=0.0;
          float toward=max(.0,dot(direction,forestSun));
          float angle=pow(toward,3.45);
          for(int i=0;i<STEPS;i++){
            float f=float(i)/float(STEPS),n=float(i+1)/float(STEPS);
            float lo=depth*f*(.58+.42*f),hi=depth*n*(.58+.42*n);
            float stride=hi-lo,t=mix(lo,hi,jitter);
            vec3 p=origin+direction*t;
            float layers=.72+.17*sin(p.z*.116+p.x*.19-forestTime*.11)+.11*cos(p.x*.312-p.z*.126);
            float valley=exp(-max(.0,p.y+1.2)*.11)*layers;
            float basin=exp(-dot((p-vec3(-12.8,1.5,-54.0))/vec3(9.5,4.5,12.5),
                                 (p-vec3(-12.8,1.5,-54.0))/vec3(9.5,4.5,12.5)));
            float onCourt=1.0-smoothstep(7.0,18.0,abs(p.x));
            float window=forestClearing(p);
            float density=(.0042+valley*.014+basin*.017+window*.017)*
              (1.0-onCourt*.68*(1.0-smoothstep(11.0,28.0,-p.z)));
            float transmittance=exp(-accumulated*.73);
            accumulated+=density*stride;
            amber+=window*(.35+.65*valley)*stride*.103*transmittance*(.33+.67*angle);
            glow+=lightShaft(p)*(valley*.65+.38)*stride*.179*transmittance*
              smoothstep(2.0,10.0,t)*(.47+.53*angle);
          }
          float warm=1.0-exp(-amber);
          float mist=(1.0-exp(-accumulated))*(.56+.39*warm);
          float shaft=(1.0-exp(-glow))*.78;
          float alpha=min(.97,mist+shaft*(1.0-mist));
          vec3 shades=mix(vec3(.41,.46,.35),vec3(1.0,.808,.47),clamp(warm*1.30,0.0,1.0));
          vec3 sun=vec3(1.0,.82,.53);
          vec3 rgb=(shades*mist+sun*shaft*(1.0-mist))/max(.001,alpha);
          gl_FragColor=vec4(rgb,alpha);
        }`});
    const fallback=new THREE.Group();fallback.name="rainforestAirFallback";
    const beamMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,fog:false,
      uniforms,vertexShader:`varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec2 tex;uniform float forestTime;
        void main(){float width=.98-abs(tex.x-.5)*2.0;
          float fall=sin(tex.y*3.14159);
          float a=pow(max(0.0,width),2.3)*fall*.25*(.93+.07*cos(tex.y*17.0-forestTime*.47));
          gl_FragColor=vec4(1.0,.81,.51,a);
        }`});
    for(const [x,z,w] of [[-5.4,-13.8,3.0],[-3.55,-16.5,2.0],[6.7,-22.7,4.3],[12.1,-36.9,4.6]]){
      const from=new THREE.Vector3(x,.5,z),span=32;
      for(const roll of [0,Math.PI/2]){
        const beam=new THREE.Mesh(new THREE.PlaneGeometry(w,span),beamMat);
        beam.position.copy(from).addScaledVector(light,span*.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),light);beam.rotateY(roll);
        beam.renderOrder=5;fallback.add(beam);
      }
    }
    s.root.add(fallback);
    return {airMaterial:material,fallback};
  }

  function motes(s,uniforms){
    const r=s.r,dust=s.mobile?130:245,insects=s.mobile?17:32,nearDust=s.mobile?11:21;
    const p=[],seed=[],scale=[],kind=[];
    for(let i=0;i<dust+insects+nearDust;i++){
      const kindId=i<dust?0:i<dust+insects?1:2;
      const x=kindId===1?(i%2?1:-1)*(4.5+r()*12.4):(r()-.5)*(kindId===2?22:36);
      const height=kindId===0?.6+r()*12:.8+r()*5.0;
      p.push(x,height,kindId===2?-9+r()*20:-36+r()*59);
      seed.push(r()*TAU);scale.push(.6+r()*1.3);kind.push(kindId);
    }
    const geo=new THREE.BufferGeometry();
    for(const [name,values,axes] of [["position",p,3],["seed",seed,1],["size",scale,1],["flyer",kind,1]]){
      geo.setAttribute(name,new THREE.Float32BufferAttribute(values,axes));
    }
    const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
      vertexShader:forestLight+`
        attribute float seed,size,flyer;
        varying float spark,insect,flutter,soft;
        void main(){
          float t=forestTime*(.51+seed*.11)+seed;
          vec3 drift=vec3(sin(t*1.27)*1.24+sin(t*2.9)*.21,sin(t*.82)*.51,cos(t*.73)*1.55);
          vec3 flight=vec3(1.69*sin(t*1.43)+.48*sin(t*4.42),.79*cos(t*2.23)+.25*sin(t*6.36),1.49*cos(t*1.04));
          insect=step(.5,flyer)*(1.0-step(1.5,flyer));soft=step(1.5,flyer);
          vec3 p=position+mix(drift,flight,insect);
          vec4 view=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*view;
          float depth=-view.z;
          float beam=clamp(lightShaft(p)*1.97+forestClearing(p)*.24,0.0,1.0);
          float pointSize=clamp(size*mix(25.0,46.0,insect)/max(4.6,depth),1.0,mix(4.0,7.0,insect));
          gl_PointSize=mix(pointSize,clamp(size*47.0/max(1.65,depth),7.0,29.0),soft);
          spark=mix(.069+.93*beam,.15+.66*beam,insect)*
            smoothstep(1.4,4.4,depth)*(1.0-smoothstep(23.0,43.0,depth))*
            mix(.72+.28*sin(t*3.11),.52+.48*smoothstep(-.75,.73,sin(t*1.95)),insect);
          float sides=smoothstep(.34,.83,abs(gl_Position.x/max(.12,gl_Position.w)));
          float near=smoothstep(.65,1.85,depth)*(1.0-smoothstep(5.8,9.8,depth));
          spark=mix(spark,near*sides*(.14+.23*beam)*(.8+.2*sin(t*2.3)),soft);
          flutter=.45+.55*abs(sin(t*32.5+seed));
        }`,
      fragmentShader:`
        varying float spark,insect,flutter,soft;
        void main(){
          vec2 p=gl_PointCoord-.5;
          float dust=1.0-smoothstep(.045,.48,length(p));
          vec2 uv=vec2(abs(p.x),p.y)-vec2(.14*flutter,-.035);
          float veil=1.0-smoothstep(.08,.61,length(uv*vec2(2.65,2.14)));
          float wings=veil*(.65+.35*flutter);
          vec3 tone=mix(vec3(1.0,.90,.68),vec3(.98,.965,.89),insect);
          float aperture=(1.0-smoothstep(.37,.49,length(p)))*(.63+.37*smoothstep(.19,.40,length(p)));
          gl_FragColor=vec4(tone,spark*mix(mix(dust*.60,wings*.60,insect),aperture*.76,soft));
        }`});
    const mesh=new THREE.Points(geo,mat);mesh.name="rainforestBacklitMotes";mesh.frustumCulled=false;mesh.renderOrder=3;s.root.add(mesh);
  }

  function fallingLeaves(s){
    const r=s.r,temp=meshBuilder();
    blade(temp,new THREE.Vector3(-.55,0,0),0,1.1,.26,-.13,.12,color(0xd9bb70),0,6,true);
    const geo=new THREE.BufferGeometry();
    for(const [name,values,size] of [["position",temp.p,3],["normal",temp.n,3],["uv",temp.uv,2]]){
      geo.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
    }
    const mesh=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({
      map:leafTexture(r),side:THREE.DoubleSide
    }),s.mobile?9:15);
    mesh.name="rainforestFallingLeaves";mesh.count=0;mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const items=[];
    for(let i=0;i<mesh.instanceMatrix.count;i++){
      const x=(i%2?1:-1)*(4.1+r()*11),z=-21.0+r()*34;
      const drop=4.2+r()*10.8,period=16.6+i*.45+r()*11.8;
      items.push({x,z,drop,period,phase:r()*period,spin:(r()-.5)*4.7,duration:4.4+r()*3.8,size:.19+r()*.26,
        tint:color(pick([0xa08749,0x987745,0x858e47,0xb29156,0x6b7744],r))});
    }
    s.root.add(mesh);
    return {mesh,items,dummy:new THREE.Object3D()};
  }

  function updateFalling(state,t){
    const {mesh,items,dummy}=state;
    let count=0;
    for(const d of items){
      const age=(t+d.phase)%d.period;
      if(age>=d.duration)continue;
      const step=age/d.duration,swirl=age*1.67+d.phase;
      const x=d.x+.12*age+.66*Math.sin(swirl),z=d.z+.19*age+.52*Math.cos(swirl*.72);
      const y=elevation(x,z)+.10+d.drop*(1-Math.pow(step,1.21));
      dummy.position.set(x,y,z);
      dummy.rotation.set(.42+Math.sin(swirl*1.52)*1.29,age*d.spin+d.phase,.64*Math.sin(swirl*.92));
      const scale=d.size*(1-smoothstep(step,.88,1)*.76);
      dummy.scale.setScalar(scale);dummy.updateMatrix();
      mesh.setMatrixAt(count,dummy.matrix);mesh.setColorAt(count++,d.tint);
    }
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }

  function build(s,batch){
    const blank=()=>({value:new THREE.Vector4(9,9,0,0)});
    const uniforms={forestSun:{value:light},forestTime:{value:0},leafViewport:{value:new THREE.Vector2(1,1)},
      subjectScreen:blank(),hoopScreen:blank(),ballScreen:blank()};
    const state={uniforms,...air(s,uniforms)};
    s.rainforest=state;s.heightAt=elevation;s.menuOrbit=[13.1,17.5,5.6,2.2];
    // The offscreen material has no scene mesh, so the owned sky material disposes it.
    canopySky(s,uniforms);
    s.root.getObjectByName("rainforestCanopySky").material.addEventListener("dispose",()=>state.airMaterial.dispose());
    ground(s,uniforms);cliffs(s,uniforms,batch);trees(s,uniforms);waterfall(s,uniforms);motes(s,uniforms);
    state.falling=fallingLeaves(s);
    updateFalling(state.falling,s.time);
    return state;
  }

  function update(s){
    s.rainforest.uniforms.forestTime.value=s.time;
    updateFalling(s.rainforest.falling,s.time);
  }

  const cameraSpace=new THREE.Vector3(),screenPoint=new THREE.Vector3(),ballPoint=new THREE.Vector3(),subjectPoint=new THREE.Vector3();
  function track(out,point,camera){
    cameraSpace.copy(point).applyMatrix4(camera.matrixWorldInverse);
    screenPoint.copy(point).project(camera);
    out.set(screenPoint.x*camera.aspect,screenPoint.y,-cameraSpace.z,cameraSpace.z<-.18?1:0);
  }
  function trackCamera(forest,camera,width,height){
    const u=forest.uniforms;
    u.leafViewport.value.set(width,height);
    track(u.hoopScreen.value,HOOP,camera);
    if(player?.g?.visible){
      subjectPoint.copy(player.g.position);subjectPoint.y+=1.12;
      track(u.subjectScreen.value,subjectPoint,camera);
    }else u.subjectScreen.value.w=0;
    const active=balls.length?balls[balls.length-1].mesh:null;
    const held=camera.userData.firstPerson?handBall:pBall;
    const ball=(G.canShoot||G.charging)&&held?.visible?held:active;
    if(ball&&ball.visible){ball.getWorldPosition(ballPoint);track(u.ballScreen.value,ballPoint,camera);}
    else u.ballScreen.value.w=0;
  }

  global.AIBARainforest=Object.freeze({build,update,trackCamera,light});
})(window);
