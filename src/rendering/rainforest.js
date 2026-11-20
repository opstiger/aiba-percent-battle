/* Tropical rainforest. Geometry and atmosphere belong to the venue root. */
(function(global){
  "use strict";
  const {smoothstep,lerp}=THREE.MathUtils;
  const TAU=Math.PI*2,foregroundLayer=29;
  const light=new THREE.Vector3(-.33,.255,-.91).normalize();
  const leaves=[0x355338,0x4a713c,0x799055,0x5e824c,0x88a258,0x356950,0x305740,0x607c36,0x88996b];
  const shadedLeaves=[0x344539,0x244a3c,0x2e5a4e,0x456b53,0x546d43,0x3f6249];
  const youngLeaves=[0x849e50,0x9ba65d,0x789e4b,0x65954c,0xa5a260,0x929352];
  const fadedLeaves=[0xa18752,0x91683e,0xb1a268,0x8c825a,0xad8560,0x865631,0x746848];
  // Growth habits drawn from Southeast Asian lowland rainforest trees.
  const treeForms=[
    // Ficus stricta / F. benjamina: warm weathered teak & olive-brown bark (no flat cement grey).
    {height:.79,girth:1.32,lean:1.40,fork:.29,spread:1.51,wood:1,branches:9,density:1.22,bend:.83,
      bark:[0x6e5b49,0x7c644c,0x5f5243,0x856d54],leaf:shadedLeaves},
    // Koompassia excelsa: high emergent trunk with warm amber-taupe bark.
    {height:1.34,girth:.57,lean:.47,fork:.75,spread:1.01,wood:2,branches:6,density:.69,bend:.18,
      bark:[0x8c735a,0x7d6852,0x947b60,0x6d614d],leaf:youngLeaves},
    // Pometia pinnata: warm reddish-mahogany and cinnamon bark.
    {height:.75,girth:.94,lean:.92,fork:.35,spread:1.56,wood:0,branches:10,density:1.21,bend:.40,
      bark:[0x8f694e,0x7c5a42,0x6e5645,0x997455],leaf:leaves},
    // Calophyllum macrocarpum: deep damp umber understory hardwood.
    {height:1.07,girth:1.10,lean:1.73,fork:.45,spread:1.17,wood:3,branches:7,density:.87,bend:1.03,
      bark:[0x564638,0x665140,0x735e4a,0x4d4335],leaf:shadedLeaves},
    {height:.71,girth:.87,lean:1.36,fork:.37,spread:.85,wood:4,branches:5,density:0,bend:1.08,
      bark:[0x7e6850,0x6b5a47,0x635443],leaf:null}
  ];
  const pick=(list,r)=>list[Math.floor(r()*list.length)];
  const floorTint=new THREE.Color(0x74845e).convertSRGBToLinear();
  const rockColor=new THREE.Color(0x46564b).convertSRGBToLinear();

  function elevation(x,z){
    const edge=Math.hypot(Math.max(0,Math.abs(x)-9.1),Math.max(0,Math.abs(z-4.5)-15.4));
    const banks=2.1*Math.sin(x*.145+z*.056)+1.6*Math.cos(z*.13-x*.042)+.40*Math.sin(x*.72+z*.28);
    const gorge=-5.8*smoothstep(-z,36,113)*Math.exp(-x*x/2930);
    const slope=smoothstep(edge,10,54);
    const hills=(4.9*Math.sin(z*.041+x*.026)+3.5*Math.cos(x*.067-z*.031))*slope;
    return -.038+smoothstep(edge,0,13)*(banks+gorge)+hills;
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
      // Distant forest shafts + in-court canopy shafts slicing directly across the court, hoop, and player.
      float rays=.87*lobe(q,vec2(-5.4,-13.8),vec2(1.15,4.6))
        +.55*lobe(q,vec2(-3.55,-16.5),vec2(.68,4.8))
        +.77*lobe(q,vec2(6.7,-22.7),vec2(1.39,7.1))
        +.61*lobe(q,vec2(2.22,-19.4),vec2(1.07,4.1))
        +.70*lobe(q,vec2(12.1,-36.9),vec2(2.15,8.2))
        +.54*lobe(q,vec2(-18.2,-40.2),vec2(2.41,6.8))
        +.74*lobe(q,vec2(-2.2,-7.4),vec2(1.35,3.8))
        +.68*lobe(q,vec2(2.8,-4.2),vec2(1.45,4.2))
        +.64*lobe(q,vec2(-1.6,-.8),vec2(1.55,3.9))
        +.58*lobe(q,vec2(3.6,2.4),vec2(1.65,4.4))
        +.52*lobe(q,vec2(-3.8,3.6),vec2(1.50,4.0));
      // Fine dappled canopy sun-streaks filtering through overhead leaves across the whole court volume.
      float courtZone=1.0-smoothstep(9.5,24.0,length(p.xz-vec2(0.0,-2.5)));
      float streaks=pow(max(0.0,sin(q.x*1.85+q.y*.72+forestTime*.14)*cos(q.y*1.42-q.x*1.15-forestTime*.11)),2.0);
      rays+=courtZone*streaks*.44;
      return rays*(1.0-smoothstep(18.0,29.0,p.y));
    }
    float forestClearing(vec3 p){
      float depth=max(0.0,-p.z+6.5);
      float center=p.x+.16*(depth-12.0)-1.2;
      float open=exp(-pow(center/(19.0+depth*.06),2.0));
      return smoothstep(1.5,28.0,depth)*open;
    }
    float leafLight(vec3 p){
      vec2 q=canopyFoot(p);
      float pools=lobe(q,vec2(-2.4,-.8),vec2(5.7,4.6))+
        .72*lobe(q,vec2(4.15,5.9),vec2(7.3,3.8))+.64*lobe(q,vec2(2.1,-11.2),vec2(4.0,5.9))+
        .60*lobe(q,vec2(6.8,28.0),vec2(7.7,10.4))+.58*lobe(q,vec2(-12.1,39.0),vec2(11.0,7.3));
      float fine=sin(q.x*2.97+q.y*2.15)+sin(q.y*3.62-q.x*1.44)+.69*cos(q.x*5.83-q.y*4.94);
      return clamp(.24+pools*(.26+.51*smoothstep(-.62,1.23,fine))+.81*lightShaft(p),.24,1.0);
    }
  `;

  const mossTexture=`
    float mossHash(vec3 p){
      p=fract(p*vec3(.1031,.1030,.0973));
      p+=dot(p,p.yzx+33.33);
      return fract((p.x+p.y)*p.z);
    }
    float mossNoise(vec3 p){
      vec3 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      vec4 x=mix(vec4(mossHash(i),mossHash(i+vec3(0,1,0)),mossHash(i+vec3(0,0,1)),mossHash(i+vec3(0,1,1))),
        vec4(mossHash(i+vec3(1,0,0)),mossHash(i+vec3(1,1,0)),mossHash(i+vec3(1,0,1)),mossHash(i+vec3(1,1,1))),f.x);
      return mix(mix(x.x,x.y,f.y),mix(x.z,x.w,f.y),f.z);
    }
    vec3 mossTint(float damp,float grit){
      vec3 green=mix(vec3(.043,.084,.025),vec3(.159,.181,.047),smoothstep(.22,.61,damp));
      green=mix(green,vec3(.059,.137,.077),smoothstep(.55,.82,damp));
      return green*(.51+.88*grit);
    }
  `;
  function surfaceLight(mat,uniforms,{plant=false,marks=null,moss=false,nearLeaves=false,bark=false}={}){
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const marksUniform=marks?"uniform sampler2D forestMarks,forestMossMap;\n":"";
      if(marks){
        shader.uniforms.forestMarks={value:marks.ink};
        shader.uniforms.forestMossMap={value:marks.moss};
      }
      const fade=nearLeaves?"varying float vLeafOpacity;\n":"";
      const barkVarying=bark?"varying float vBarkForm;\nvarying vec2 vBarkUV;\n":"";
      const shared="varying vec3 vForestWorld;\n"+fade+barkVarying;
      shader.vertexShader=shared+(plant?"uniform float forestTime;\nattribute float leafSway;\n":"")+
        (nearLeaves?"attribute vec4 leafBounds;\n":"")+(bark?"attribute float barkForm;\n":"")+shader.vertexShader.replace(
        "#include <begin_vertex>",`#include <begin_vertex>
          ${bark?"vBarkForm=barkForm;vBarkUV=uv;":""}
          ${plant?`
            float gust=.48+.38*sin(forestTime*.64-position.z*.26+position.x*.13)
              +.20*sin(forestTime*.32+position.z*.11+position.x*.29);
            float flutter=sin(forestTime*(2.2+.13*sin(position.z))+position.x*1.3+position.y*3.1);
            transformed.x+=(gust*.83+flutter*.19)*leafSway;
            transformed.z+=(.55*sin(forestTime*.88+position.x*.31-position.z*.22)+.34*gust)*leafSway;
            transformed.y+=flutter*gust*leafSway*.13;
          `:""}
          vec4 forestVertex=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            forestVertex=instanceMatrix*forestVertex;
          #endif
          vForestWorld=(modelMatrix*forestVertex).xyz;
          ${nearLeaves?`
            vec3 leafCenter=(modelMatrix*vec4(leafBounds.xyz,1.0)).xyz;
            float space=length(cameraPosition-leafCenter)-leafBounds.w;
            vLeafOpacity=smoothstep(.075,.33,space);
          `:""}`);
      shader.fragmentShader=forestLight+(marks||moss?mossTexture:"")+marksUniform+shared+
        shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          ${nearLeaves?`
            // Fade an entire blade as the lens passes it, including in the depth pass.
            vec2 j=mod(floor(gl_FragCoord.xy),4.0);
            float threshold=fract(dot(j,vec2(.5,.75))+.124*floor(j.x*.5)+.063*floor(j.y*.5));
            if(vLeafOpacity<threshold+.001)discard;
          `:""}
          ${marks?`
            vec2 ground=vForestWorld.xz;
            float damp=sin(ground.x*.57+ground.y*.53)*cos(ground.y*.71-ground.x*.51);
            vec2 rotated=mat2(.86,-.51,.51,.86)*ground;
            vec3 mossAlbedo=mapTexelToLinear(texture2D(forestMossMap,rotated*.37)).rgb;
            vec2 clearing=ground-vec2(.32,3.8);
            clearing.x+=.95*sin(ground.y*.32)+.45*cos(ground.y*.86);
            clearing.y+=1.08*sin(ground.x*.51);
            float seam=length(clearing/vec2(9.75,19.8))+damp*.28;
            float carpet=smoothstep(.48,1.18,seam);
            float matMoisture=mossNoise(vec3(ground*.24,.6));
            float broken=mossNoise(vec3(ground*.94,1.7));
            float grit=mossNoise(vec3(ground*17.0,2.5));
            float mossBed=smoothstep(.31,.69,matMoisture*.58+broken*.37+grit*.12);
            float margin=carpet*(.29+.63*mossBed)+(1.0-carpet)*mossBed*.15;
            vec3 living=mossTint(matMoisture,grit)*(.56+.66*max(mossAlbedo.g,mossAlbedo.r));
            diffuseColor.rgb=mix(diffuseColor.rgb,living,clamp(margin,.023,.94));
            diffuseColor.rgb*=mix(vec3(.80,.88,.78),vec3(1.22,1.17,.94),damp*.5+.5);
            vec2 uvLines=vec2(vForestWorld.x/20.0+.5,(22.0-vForestWorld.z)/35.0);
            if(all(greaterThan(uvLines,vec2(0.0)))&&all(lessThan(uvLines,vec2(1.0)))){
              vec4 line=mapTexelToLinear(texture2D(forestMarks,uvLines));
              diffuseColor.rgb=mix(diffuseColor.rgb,line.rgb,line.a*.71);
            }`:""}
          ${bark?`
            float barkGrain=mossNoise(vForestWorld*vec3(12.0,1.8,12.0));
            float split=pow(abs(sin(vBarkUV.x*96.0+mossNoise(vForestWorld*.82)*5.3)),11.0);
            float flakes=mossNoise(vForestWorld*vec3(3.3,6.3,3.3));
            float fineRidges=pow(abs(sin(vBarkUV.x*193.0+flakes*.92)),13.0);
            vec3 baseBark=diffuseColor.rgb;
            // Smooth per-trunk & height organic wood-tone variation (prevents binary two-tone bark).
            float trunkShift=mossNoise(vForestWorld*vec3(.18,.09,.18));
            float baseDamp=1.0-smoothstep(.2,4.8,vForestWorld.y);
            vec3 warmCedar=vec3(.135,.088,.054),oliveBark=vec3(.078,.082,.056),richUmber=vec3(.062,.046,.033);
            vec3 naturalTone=mix(mix(richUmber,warmCedar,smoothstep(.22,.78,trunkShift)),oliveBark,baseDamp*.42);
            float barkType=floor(vBarkForm+.001);
            if(barkType==1.0){
              // Smooth weathered teak/cedar instead of flat pale grey.
              diffuseColor.rgb=mix(baseBark,naturalTone*(.82+barkGrain*.40),.48)*(1.0-split*.16);
            }else if(barkType==2.0){
              diffuseColor.rgb=mix(baseBark,mix(warmCedar,naturalTone,.5),.38)*
                (.80+.28*flakes)*(1.0-split*.18-fineRidges*.09);
            }else if(barkType>2.0){
              float scars=smoothstep(.60,.82,flakes+split*.11);
              diffuseColor.rgb=mix(baseBark*(.72+.42*barkGrain-fineRidges*.15),vec3(.125,.076,.042),scars*.52);
            }else{
              diffuseColor.rgb=mix(baseBark,naturalTone,.28)*(.78+.24*barkGrain+.18*flakes-split*.20);
            }
            // Damp root darkening near humid forest floor.
            diffuseColor.rgb*=1.0-baseDamp*.24;
          `:""}
          ${moss?`
            vec3 site=vForestWorld*vec3(1.22,.77,1.22);
            float moist=mossNoise(site*.67),grain=mossNoise(site*3.9),silt=mossNoise(site*12.5);
            float reach=(1.0-smoothstep(.8,8.2,vForestWorld.y))*.12;
            float mossCover=smoothstep(.62,.83,moist*.67+grain*.34+silt*.14+reach);
            vec3 mossColor=mossTint(moist,silt)*(.60+.54*clamp(diffuseColor.g*3.0,0.0,1.0));
            ${bark?`
              float hasLichen=step(.2,fract(vBarkForm));
              float patches=smoothstep(.70,.85,mossNoise(site*2.9)+silt*.15);
              float below=1.0-smoothstep(1.4,6.1,vForestWorld.y);
              float lichen=hasLichen*patches*below*(1.0-mossCover);
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.169,.181,.151),lichen*.29);
            `:""}
            diffuseColor.rgb=mix(diffuseColor.rgb,mossColor,mossCover*.79);`:""}
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
    mat.customProgramCacheKey=()=>`rainforest:${plant}:${!!marks}:${moss}:${nearLeaves}:${bark}`;
  }

  function meshBuilder(trackLeaves=false,trackBark=false){
    return {p:[],n:[],uv:[],color:[],sway:[],leafBounds:trackLeaves?[]:null,bark:trackBark?[]:null};
  }
  function vertex(out,p,n,u,v,c,sway=0,wood=0){
    out.p.push(p.x,p.y,p.z);out.n.push(n.x,n.y,n.z);out.uv.push(u,v);
    out.color.push(c.r,c.g,c.b);out.sway.push(sway);
    if(out.bark)out.bark.push(wood);
  }
  function geometryFrom(out){
    const geo=new THREE.BufferGeometry();
    for(const [key,source,size] of [["position",out.p,3],["normal",out.n,3],["uv",out.uv,2],["color",out.color,3],["leafSway",out.sway,1]]){
      geo.setAttribute(key,new THREE.Float32BufferAttribute(source,size));
    }
    if(out.leafBounds)geo.setAttribute("leafBounds",new THREE.Float32BufferAttribute(out.leafBounds,4));
    if(out.bark)geo.setAttribute("barkForm",new THREE.Float32BufferAttribute(out.bark,1));
    geo.computeBoundingSphere();
    return geo;
  }
  function finish(root,out,material,name,shadow=false){
    const mesh=new THREE.Mesh(geometryFrom(out),material);mesh.name=name;mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);
    return mesh;
  }

  function limb(out,from,to,radius,r1,tint,bend=0,roots=false,sides=8,shape=null){
    const axis=to.clone().sub(from).normalize(),curve=shape?.curve;
    const length=curve?curve.getLength():from.distanceTo(to),rows=shape?.rows||(roots?6:3);
    const rings=[];
    for(let j=0;j<=rows;j++){
      const t=j/rows,direction=curve?curve.getTangent(t):axis;
      const right=new THREE.Vector3(0,0,1).cross(direction).normalize();
      if(right.lengthSq()<.01)right.set(1,0,0);
      const across=direction.clone().cross(right);
      const center=curve?curve.getPoint(t):from.clone().lerp(to,t).addScaledVector(right,Math.sin(t*Math.PI)*bend);
      const row=[];
      for(let i=0;i<=sides;i++){
        const theta=i/sides*TAU,normal=right.clone().multiplyScalar(Math.cos(theta)).addScaledVector(across,Math.sin(theta));
        const irregular=Math.floor(shape?.wood||0)===1?.56:1;
        const ribs=.88+irregular*(.11*Math.sin(theta*5.0+t*2)+.05*Math.cos(theta*7-t*4));
        const skirt=roots?1+Math.pow(1-t,9)*(.63+.46*Math.cos(theta*4)):1;
        const rad=lerp(radius,r1,t)*ribs*skirt;
        row.push([center.clone().addScaledVector(normal,rad),normal,i/sides*Math.max(1,radius*3),
          t*length*.40,tint,0,shape?.wood||0]);
      }
      rings.push(row);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
      const a=rings[j][i],b=rings[j][i+1],c=rings[j+1][i],d=rings[j+1][i+1];
      for(const item of [a,b,c,b,d,c])vertex(out,...item);
    }
    return rings;
  }
  function blade(out,start,heading,length,width,rise,curve,tint,wind,steps=5,split=false){
    const dir=new THREE.Vector3(Math.cos(heading),0,Math.sin(heading)),across=new THREE.Vector3(-dir.z,0,dir.x);
    const seed=Math.sin(start.x*12.989+start.y*8.136+start.z*19.27+heading*4.51)*16723.2781;
    const q=seed-Math.floor(seed);
    const state=q<.42?0:q<.56?1:q<.72?2:q<.87?3:4;
    const drop=state===1?length*.31:state===4?length*.14:0;
    const warp=(q-.49)*(state===1?.54:.27);
    const rows=[];
    for(let j=0;j<=steps;j++){
      const t=j/steps,spread=width*Math.pow(Math.sin(Math.PI*t),.84)*(.94+Math.cos(t*2.7+q)*.19)
        *(split&&j%2===1?.65:1);
      const center=start.clone().addScaledVector(dir,length*t).addScaledVector(across,length*warp*t*t);
      center.y+=rise*t+curve*Math.sin(t*Math.PI*.91)-drop*t*t;
      const slope=(rise+curve*Math.PI*.91*Math.cos(t*Math.PI*.91)-2*drop*t)/length;
      const row=[];
      for(const side of [-1,0,1]){
        const p=center.clone().addScaledVector(across,spread*side*(1+warp*side*.66));
        p.y-=Math.abs(side)*spread*(.17+q*.22)+side*spread*warp*t;
        const n=new THREE.Vector3(0,1,0).addScaledVector(dir,-slope).addScaledVector(across,.23*side).normalize();
        row.push([p,n,(state+.02+.96*(side+1)*.5)/5,t,tint,wind*t*t]);
      }
      rows.push(row);
    }
    const firstVertex=out.p.length/3;
    for(let j=0;j<steps;j++)for(let i=0;i<2;i++){
      const a=rows[j][i],b=rows[j][i+1],c=rows[j+1][i],d=rows[j+1][i+1];
      for(const item of [a,b,c,b,d,c])vertex(out,...item);
    }
    if(out.leafBounds){
      const mid=rows[Math.floor(steps*.5)][1][0];
      let radius=0;
      for(const row of rows)for(const [point] of row)radius=Math.max(radius,point.distanceTo(mid));
      radius+=Math.abs(wind)*1.15;
      for(let i=firstVertex;i<out.p.length/3;i++)out.leafBounds.push(mid.x,mid.y,mid.z,radius);
    }
  }
  function color(hex){return new THREE.Color(hex).convertSRGBToLinear();}

  function leafTexture(r){
    const w=112,h=256,canvas=document.createElement("canvas");
    canvas.width=w*5;canvas.height=h;
    const g=canvas.getContext("2d");
    for(let state=0;state<5;state++){
      g.save();g.translate(state*w,0);
      g.beginPath();g.rect(0,0,w,h);g.clip();
      const fill=g.createLinearGradient(0,0,w,0);
      fill.addColorStop(0,state===1?"#a2996a":"#919e73");
      fill.addColorStop(.40,"#cdcfab");fill.addColorStop(.50,"#dbdcbb");
      fill.addColorStop(.55,"#aeba8c");fill.addColorStop(1,"#909e73");
      g.fillStyle=fill;g.fillRect(0,0,w,h);
      if(state===4||state===1){
        const scorch=g.createLinearGradient(state===1?w:0,0,w*.42,h);
        scorch.addColorStop(0,state===4?"#b0804b":"#988657");
        scorch.addColorStop(.38,state===4?"rgba(186,136,78,.84)":"rgba(169,150,92,.42)");
        scorch.addColorStop(.79,"rgba(168,140,73,0)");
        g.fillStyle=scorch;g.fillRect(0,0,w,h);
      }
      for(let i=0;i<26;i++)for(const dir of [-1,1]){
        const y=10+i*10+5*r();
        g.beginPath();g.moveTo(w*.5,y);
        g.quadraticCurveTo(w*.5+dir*17,y-8,dir===1?w:0,y-18-r()*14);
        g.lineWidth=.42+r()*.64;g.strokeStyle="rgba(72,94,51,.38)";g.stroke();
      }
      g.strokeStyle="rgba(232,225,177,.78)";g.lineWidth=1.35;
      g.beginPath();g.moveTo(w*.5,h);g.lineTo(w*.5,0);g.stroke();
      for(let i=0;i<146;i++){
        g.fillStyle=i%3?"rgba(62,81,43,.12)":"rgba(243,227,175,.18)";
        g.fillRect(r()*w,r()*h,.55+r()*1.5,.55+r()*1.9);
      }
      if(state===2||state===3||state===4){
        for(let i=0;i<(state===2?22:9);i++){
          const x=w*(.09+r()*.82),y=11+r()*(h-20),radius=1.2+r()*5.0;
          g.fillStyle="rgba(163,128,58,.43)";
          g.beginPath();g.ellipse(x,y,radius*1.38,radius*.85,r()*TAU,0,TAU);g.fill();
          g.fillStyle="rgba(88,64,37,.47)";
          g.beginPath();g.ellipse(x,y,radius*.64,radius*.51,r()*TAU,0,TAU);g.fill();
        }
      }
      if(state===3){
        g.globalCompositeOperation="destination-out";g.fillStyle="#fff";
        for(let i=0;i<6;i++){
          const x=i%2?w:0,y=29+r()*(h-58),bite=5+r()*10;
          g.beginPath();g.ellipse(x,y,bite*1.55,bite,.35*(i%2?1:-1),0,TAU);g.fill();
        }
        for(let i=0;i<4;i++){
          const x=16+r()*(w-32),y=27+r()*(h-55);
          g.beginPath();g.ellipse(x,y,2.5+r()*3.9,2.3+r()*3.8,r()*TAU,0,TAU);g.fill();
        }
      }
      g.restore();
    }
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
    return map;
  }

  function reclaimedBoardTexture(planks,seed){
    const r=mulberry32(seed),w=1024,h=768,cv=document.createElement("canvas");
    cv.width=w;cv.height=h;
    const g=cv.getContext("2d");
    const px=x=>(x+1.09)*w/2.18,py=y=>(4.30-y)*h/1.40;
    const colors=["#6e6551","#998066","#745e49","#8e816a","#a89070","#7c6852","#8c7157","#77644f","#8f775c"];
    g.fillStyle="#746451";g.fillRect(0,0,w,h);
    for(const [plank,{left:x0,right:x1,outline,top}] of planks.entries()){
      const left=px(x0),right=px(x1),span=right-left;
      g.save();g.beginPath();g.rect(left,0,span,h);g.clip();
      const stain=g.createLinearGradient(left,0,right,h);
      stain.addColorStop(0,colors[plank]);stain.addColorStop(.57,colors[plank]);stain.addColorStop(1,"#4d4f3e");
      g.fillStyle=stain;g.fillRect(left,0,span,h);
      const grainBase=left+r()*span,grainY=128+r()*538;
      for(let i=0;i<180;i++){
        let x=left+r()*span,y=-50+r()*(h+50);
        const len=37+r()*610,wiggle=(r()-.5)*14;
        const k=Math.exp(-(((x-grainBase)/(span*.31))**2))*Math.sin((y-grainY)*.017)*(plank%2?11:6);
        g.strokeStyle=i%4===0?"rgba(227,202,153,.19)":"rgba(48,35,27,.20)";
        g.lineWidth=.46+r()*2.0;g.beginPath();g.moveTo(x,y);
        g.bezierCurveTo(x+wiggle+k,y+len*.34,x-wiggle+k*.66,y+len*.65,x+wiggle*.38,y+len);
        g.stroke();
      }
      if(plank%3!==2){
        g.save();g.translate(left+span*(.24+r()*.51),grainY);g.rotate((r()-.5)*.31);
        for(let j=11;j>0;j--){
          g.strokeStyle=j%2?"rgba(52,39,27,.36)":"rgba(194,161,112,.24)";
          g.lineWidth=.9;g.beginPath();g.ellipse(0,0,2+j*1.27,3+j*3.31,.03,0,TAU);g.stroke();
        }
        g.fillStyle="rgba(44,34,25,.60)";g.beginPath();g.ellipse(0,0,2.9,7.3,0,0,TAU);g.fill();
        g.restore();
      }
      const edge=g.createLinearGradient(left,0,left+span,0);
      edge.addColorStop(0,"rgba(38,30,23,.56)");edge.addColorStop(.032,"rgba(234,203,151,.21)");
      edge.addColorStop(.11,"rgba(85,62,42,0)");edge.addColorStop(.88,"rgba(85,62,42,0)");edge.addColorStop(1,"rgba(38,30,23,.63)");
      g.fillStyle=edge;g.fillRect(left,0,span,h);
      g.beginPath();
      outline.forEach(([x,y],i)=>{if(i)g.lineTo(px(x),py(y));else g.moveTo(px(x),py(y));});
      g.closePath();g.clip();
      for(let i=1;i<top.length;i++){
        const [x0,y0]=top[i-1],[x1,y1]=top[i];
        for(let j=0;j<12;j++){
          const t=r(),x=px(lerp(x0,x1,t)),start=py(lerp(y0,y1,t)),length=4+r()*27;
          g.fillStyle=j%3?"rgba(215,184,133,.26)":"rgba(47,35,26,.52)";
          g.beginPath();g.moveTo(x-(.7+r()*2),start-1);
          g.lineTo(x+1.2+r()*2.8,start-1);g.lineTo(x+(r()-.5)*3.5,start+length);g.closePath();g.fill();
        }
        if(y1<y0-.034||y1>y0+.045){
          g.strokeStyle="rgba(224,191,140,.33)";g.lineWidth=3;
          g.beginPath();g.moveTo(px(x0),py(y0)+2);g.lineTo(px(x1),py(y1)+3);g.stroke();
        }
      }
      for(let i=0;i<16;i++){
        const xx=left+r()*span,yy=h*(.85+r()*.15);
        g.strokeStyle=i%3?"rgba(46,34,26,.47)":"rgba(205,172,124,.25)";
        g.lineWidth=.9+r()*1.65;g.beginPath();g.moveTo(xx,yy);
        g.lineTo(xx+(r()-.5)*4,yy-4-r()*22);g.stroke();
      }
      g.restore();
    }
    for(let i=0;i<60;i++){
      const x=r()*w,y=r()*h,rad=11+r()*70,fade=g.createRadialGradient(x,y,1,x,y,rad);
      fade.addColorStop(0,i%3===1?"rgba(109,113,76,.28)":"rgba(41,38,31,.24)");
      fade.addColorStop(1,"rgba(61,57,44,0)");
      g.fillStyle=fade;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    const aim=document.createElement("canvas");aim.width=w;aim.height=h;
    const a=aim.getContext("2d");
    a.strokeStyle="#cfc3a6";a.globalAlpha=.76;a.lineWidth=12;a.lineCap="round";a.lineJoin="round";
    a.beginPath();a.moveTo(px(-.294),py(3.072));a.lineTo(px(-.309),py(3.411));a.lineTo(px(.309),py(3.428));
    a.lineTo(px(.303),py(3.076));a.lineTo(px(-.294),py(3.072));a.stroke();
    a.globalCompositeOperation="destination-out";
    for(let i=0;i<11000;i++){
      const x=px(-.36+r()*.72),y=py(3.01+r()*.47);
      a.globalAlpha=.25+r()*.75;a.fillRect(x,y,.8+r()*4.2,.8+r()*12);
    }
    for(const [x,y,ww,hh] of [[-.31,3.18,9,34],[.16,3.426,29,6],[.308,3.26,10,27],[-.13,3.080,26,7]]){
      a.globalAlpha=.84;a.fillRect(px(x)-ww*.5,py(y)-hh*.5,ww,hh);
    }
    g.drawImage(aim,0,0);
    for(let i=0;i<7600;i++){
      g.fillStyle=i%3?"rgba(50,43,32,.12)":"rgba(238,216,170,.14)";
      g.fillRect(r()*w,r()*h,.3+r()*2,.6+r()*4);
    }
    const map=new THREE.CanvasTexture(cv);map.encoding=THREE.sRGBEncoding;map.anisotropy=5;
    return map;
  }

  function reclaimedHoops(s,uniforms){
    const shape=AIBABallPhysics.RAINFOREST_HOOP,nearPivot=scene.getObjectByName("boardPivot");
    const {planks,face,back,radius,pole,brace,braceRadius}=shape;
    function attach(group,geometry,material,name){
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
      mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      return mesh;
    }
    function tube(group,points,radius,material,name,segments){
      const spline=new THREE.CatmullRomCurve3(points);
      return attach(group,new THREE.TubeGeometry(spline,segments,radius,12,false),material,name);
    }

    const r=mulberry32(240178),w=192,h=512,cv=document.createElement("canvas");cv.width=w;cv.height=h;
    const g=cv.getContext("2d");
    g.fillStyle="#4c5854";g.fillRect(0,0,w,h);
    for(let i=0;i<215;i++){
      const x=r()*w,y=r()*h,rad=3+r()*21;
      const rust=g.createRadialGradient(x,y,0,x,y,rad);
      rust.addColorStop(0,i%4===1?"rgba(45,39,31,.65)":"rgba(125,80,46,.68)");
      rust.addColorStop(.52,"rgba(88,61,42,.28)");rust.addColorStop(1,"rgba(88,61,42,0)");
      g.fillStyle=rust;g.fillRect(x-rad,y-rad,rad*2,rad*2);
    }
    for(let i=0;i<270;i++){
      g.fillStyle=i%3===1?"rgba(167,162,133,.13)":"rgba(29,29,21,.23)";
      g.fillRect(r()*w,r()*h,.3+r()*2.7,2+r()*34);
    }
    const ironTex=new THREE.CanvasTexture(cv);ironTex.encoding=THREE.sRGBEncoding;ironTex.anisotropy=4;
    const iron=new THREE.MeshPhongMaterial({map:ironTex,shininess:13,specular:0x444039});
    const hardware=new THREE.MeshPhongMaterial({color:0x5c5545,shininess:17,specular:0x555551});
    const straps=new THREE.MeshPhongMaterial({color:0x48514a,shininess:8,specular:0x302b24});
    const stoneTex=texture("assets/meadow/alpine-rock.jpg");
    const footing=new THREE.MeshPhongMaterial({color:0x88877a,map:stoneTex,shininess:4});
    surfaceLight(iron,uniforms);surfaceLight(hardware,uniforms);surfaceLight(footing,uniforms,{moss:true});
    for(const dir of [1,-1]){
      const z=dir===1?(back+face)*.5:COURT.farBaseline-.96;
      const fixed=new THREE.Group();fixed.name=dir===1?"rainforestNearSupport":"rainforestFarSupport";
      const panelRig=new THREE.Group(),panel=new THREE.Group();
      panel.name=dir===1?"rainforestNearTimberBoard":"rainforestFarTimberBoard";
      s.root.add(panelRig,fixed);panelRig.add(panel);
      if(dir===1&&nearPivot)panelRig.position.copy(nearPivot.position);
      panel.position.set(0,-panelRig.position.y,z-panelRig.position.z);
      panel.rotation.y=dir===1?0:Math.PI;
      if(dir===1&&nearPivot)s.rainforest.boardMotion={panelRig,nearPivot};
      const map=reclaimedBoardTexture(planks,68179+dir*373);
      const bump=map.clone();bump.encoding=THREE.LinearEncoding;bump.needsUpdate=true;
      const timber=new THREE.MeshPhongMaterial({map,bumpMap:bump,bumpScale:.019,
        shininess:8,specular:0x31291f});
      surfaceLight(timber,uniforms);
      const plankDepth=face-back;
      for(const [j,{outline}] of planks.entries()){
        const cut=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
        const geom=new THREE.ExtrudeGeometry(cut,{depth:plankDepth,bevelEnabled:false,curveSegments:1});
        const p=geom.attributes.position,uv=geom.attributes.uv;
        for(let i=0;i<p.count;i++){
          uv.setXY(i,(p.getX(i)+1.09)/2.18,(p.getY(i)-2.90)/1.40);
        }
        const slab=attach(panel,geom,timber,"reclaimedBoardPlank");
        slab.position.z=-plankDepth*.5;
        slab.userData.plank=j;
      }

      const fasteners=[];
      const patina=mulberry32(740137+dir*263);
      for(const [row,[y,width,angle]] of [[3.18,1.88,-.033],[3.63,1.48,.048]].entries()){
        const strap=attach(panel,new THREE.BoxGeometry(width,.083,.039),straps,"reclaimedRearStrap");
        strap.position.set(.021,y,-.068);strap.rotation.z=angle;
        for(const [i,{left,right}] of planks.entries()){
          const x=lerp(left,right,.26+patina()*.48);
          if(Math.abs(x)>width*.48||(row===1&&i%4===2))continue;
          const height=y+angle*x+(patina()-.5)*.032;
          for(const side of [-1,1]){
            const tint=pick([0x756452,0x9a7653,0x66645a,0x50483b,0xa48b65],patina);
            fasteners.push({x,height,side,tint,roll:patina()*Math.PI});
          }
        }
      }
      const fastenerMat=new THREE.MeshPhongMaterial({color:0xb6aaa0,shininess:14,specular:0x463c32});
      for(const [name,size,thickness,sides,zOffset] of [["oldWashers",.020,.008,10,0],["oldBolts",.012,.014,6,.009]]){
        const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(size,size,thickness,sides),fastenerMat,fasteners.length);
        const stamp=new THREE.Object3D();
        for(const [i,{x,height,side,tint,roll}] of fasteners.entries()){
          stamp.position.set(x,height-3.41,side*((side===1?.067:.09)+zOffset));
          stamp.rotation.set(Math.PI*.5,roll,0);
          stamp.updateMatrix();
          mesh.setMatrixAt(i,stamp.matrix);
          mesh.setColorAt(i,color(tint));
        }
        mesh.name=name;mesh.receiveShadow=true;mesh.position.y=3.41;
        panel.add(mesh);
      }
      const mount=attach(panel,new THREE.BoxGeometry(.23,.205,.06),hardware,"weldedHoopPlate");
      mount.position.set(.022,3.50,-.086);
      const anchor=points=>points.map(([x,y,worldZ])=>new THREE.Vector3(dir*x,y,z+dir*(worldZ-(back+face)*.5)));
      const stem=anchor(pole),stay=anchor(brace);
      tube(fixed,stem,radius,iron,"rainforestCurvedSteelPole",30);
      tube(fixed,stay,braceRadius,iron,"rainforestWeldedBrace",11);
      const bottom=stem[0];
      const base=new THREE.IcosahedronGeometry(.53,1),v=base.attributes.position;
      for(let i=0;i<v.count;i++){
        const x=v.getX(i),y=v.getY(i),zz=v.getZ(i);
        const erosion=.89+.11*Math.sin(x*17+zz*8)+.07*Math.cos(y*30+zz*4);
        v.setXYZ(i,x*erosion,Math.min(.245,y*.51)*erosion,zz*erosion);
      }
      base.computeVertexNormals();
      const pad=attach(fixed,base,footing,"rainforestWeatheredFooting");
      pad.position.set(bottom.x,elevation(bottom.x,bottom.z)+.065,bottom.z);pad.rotation.y=dir*.18;
      for(const x of [-.19,.21])for(const dz of [-.19,.17]){
        const anchor=attach(fixed,new THREE.CylinderGeometry(.033,.037,.075,6),hardware,"rustedGroundAnchor");
        anchor.position.set(bottom.x+x,pad.position.y+.154,bottom.z+dz);
      }
    }
  }

  function marks(){
    const canvas=document.createElement("canvas");canvas.width=960;canvas.height=1536;
    const g=canvas.getContext("2d"),{nearBaseline,farBaseline,halfWidth,midZ}=COURT;
    const r=mulberry32(72601);
    g.scale(canvas.width/20,canvas.height/35);g.translate(10,13);
    g.lineCap="round";g.strokeStyle="#bfb5a0";
    function wornPath(point,length,weight){
      const count=Math.ceil(length/.17);
      let last=point(0);
      for(let i=1;i<=count;i++){
        const pos=point(i/count);
        pos[0]+=(r()-.5)*.026;pos[1]+=(r()-.5)*.029;
        const where=Math.sin(pos[0]*.94+pos[1]*1.05)*Math.cos(pos[0]*.36-pos[1]*.32);
        const used=1-.34*Math.exp(-((pos[1]-3.04)**2)/16)*Math.exp(-(pos[0]**2)/15);
        const exposure=(.59+.38*where)*used;
        if(r()> .055+.14*(1-exposure)){
          const opening=r()<.18?.12+r()*.24:0;
          g.globalAlpha=weight*(.36+r()*.49)*exposure;
          g.lineWidth=.037+r()*.035;
          g.beginPath();
          g.moveTo(lerp(last[0],pos[0],opening),lerp(last[1],pos[1],opening));
          g.lineTo(pos[0],pos[1]);g.stroke();
        }
        last=pos;
      }
    }
    const line=(ax,az,bx,bz,w)=>wornPath(t=>[lerp(ax,bx,t),lerp(az,bz,t)],Math.hypot(bx-ax,bz-az),w);
    function rectangle(x,z,w,d,opacity){
      line(x,z,x+w,z,opacity);line(x+w,z,x+w,z+d,opacity);
      line(x+w,z+d,x,z+d,opacity);line(x,z+d,x,z,opacity);
    }
    const arc=(z,radius,start,end,w)=>wornPath(t=>{
      const a=lerp(start,end,t);return [Math.cos(a)*radius,z+Math.sin(a)*radius];
    },Math.abs(end-start)*radius,w);
    rectangle(-halfWidth,nearBaseline,halfWidth*2,farBaseline-nearBaseline,.94);
    line(-halfWidth,midZ,halfWidth,midZ,.69);
    arc(midZ,1.8,0,TAU,.69);
    for(const [z,base,sign] of [[HOOP.z,nearBaseline,1],[COURT.farHoopZ,farBaseline,-1]]){
      const free=base+sign*5.79,dir=sign===1?0:Math.PI;
      rectangle(-2.45,Math.min(base,free),4.9,5.79,.82);
      arc(free,1.8,dir,dir+Math.PI,.74);
      const radius=7.24,side=6.71,angle=Math.acos(side/radius);
      const join=z+sign*Math.sqrt(radius*radius-side*side);
      arc(z,radius,dir+angle,dir+Math.PI-angle,1.02);
      for(const x of [-side,side])line(x,base,x,join,1.02);
    }
    g.resetTransform();
    const paint=g.getImageData(0,0,canvas.width,canvas.height);
    for(let i=3;i<paint.data.length;i+=4){
      if(!paint.data[i])continue;
      const grit=r();
      paint.data[i]*=grit<.22?.06+r()*.38:.57+r()*.43;
    }
    g.putImageData(paint,0,0);
    const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
    return map;
  }
  function ground(s,uniforms){
    const geo=new THREE.PlaneGeometry(455,545,s.mobile?82:116,s.mobile?96:140);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv,cols=[];
    // Keep about half the terrain grid near the clearing where plants meet the ground.
    function axis(t,inner,min,max){
      const u=(Math.abs(t)-.59)/.41;
      if(u<=0)return t*inner/.59;
      return t<0?lerp(-inner,min,u):lerp(inner,max,u);
    }
    for(let i=0;i<p.count;i++){
      const x=axis(p.getX(i)/227.5,27,-227.5,227.5);
      const z=axis(p.getZ(i)/272.5,33,-355.5,189.5);
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

  function trees(s,uniforms,batch){
    const r=s.r,wood=meshBuilder(false,true),leaf=meshBuilder(),hero=meshBuilder(true);
    const outerWood=meshBuilder(false,true),outerLeaf=meshBuilder();
    const mossyBark=[];
    const barkMat=new THREE.MeshPhongMaterial({map:texture("assets/rainforest/bark.jpg"),vertexColors:true,
      bumpMap:texture("assets/rainforest/bark.jpg"),bumpScale:.20,shininess:7,specular:0x2c281f});
    barkMat.bumpMap.encoding=THREE.LinearEncoding;
    const leafMat=new THREE.MeshPhongMaterial({map:leafTexture(r),vertexColors:true,
      shininess:14,specular:0x24281a,alphaTest:.48,side:THREE.DoubleSide});
    surfaceLight(barkMat,uniforms,{moss:true,bark:true});
    surfaceLight(leafMat,uniforms,{plant:true});
    const closeLeafMat=leafMat.clone();
    closeLeafMat.map=leafMat.map.clone();
    closeLeafMat.map.needsUpdate=true;
    surfaceLight(closeLeafMat,uniforms,{plant:true,nearLeaves:true});

    function plantTree(x,z,h,rad,near,wider,formIndex,outer=false){
      const treeWood=outer?outerWood:wood,treeLeaf=outer?outerLeaf:leaf;
      const form=treeForms[formIndex];
      const candidate=h*form.height;
      const establishedEmergent=form.wood===2&&near&&rad>1.01&&h>30;
      rad*=form.girth;
      if(establishedEmergent)rad=Math.max(rad,candidate*.027);
      h=Math.min(candidate,5.0+31*rad);
      const y=elevation(x,z),base=new THREE.Vector3(x,y,z);
      const mature=smoothstep(rad,.45,1.16);
      const bend=lerp(1.57,.41,mature)*form.bend+.41*(1-mature);
      const lean=(r()-.5)*lerp(7.7,3.5,mature)*form.lean;
      const lightSide=Math.sin(z*.34+x*.87)*h*.109*(1-mature);
      const apex=base.clone().add(new THREE.Vector3(lean+lightSide,h,(r()-.5)*lerp(6.2,2.1,mature)*form.lean));
      const tint=color(pick(form.bark,r));
      const moisture=Math.sin(x*.29+z*.076)*Math.cos(z*.13-x*.18);
      const barkStyle=form.wood+(form.wood!==2&&moisture>.47?.25:0);
      const buttresses=near&&rad>.70;
      const waist=base.clone().lerp(apex,.33).add(new THREE.Vector3(Math.sin(x*1.9)*bend*1.66,0,Math.cos(z*2.3)*bend*1.38));
      const shoulder=base.clone().lerp(apex,.70).add(new THREE.Vector3(-Math.sin(x*1.9+.5)*bend*1.23,0,Math.sin(z*.8+.4)*bend*1.73));
      const stem=new THREE.CatmullRomCurve3([base,waist,shoulder,apex]);
      const trunk=limb(treeWood,base,apex,rad,rad*(form.leaf?.16:.28),tint,0,buttresses,near?12:outer?5:7,
        {curve:stem,wood:barkStyle,rows:near?12:outer?4:7});
      if(buttresses)mossyBark.push({rings:trunk,reach:.23,density:1.65});
      if(buttresses)for(let j=0;j<5;j++){
        const a=TAU*(j+r()*.42)/5,d=rad*(2.4+r()*1.6);
        const foot=new THREE.Vector3(x+Math.cos(a)*d,y+.03,z+Math.sin(a)*d);
        foot.y=elevation(foot.x,foot.z)+.03;
        const root=limb(treeWood,foot,stem.getPoint((1.7+1.7*r())/h),.06+r()*.07,rad*(.30+r()*.17),tint,.10,false,7,
          {wood:barkStyle});
        mossyBark.push({rings:root,reach:1,density:.39});
      }
      const branches=outer?3:near?form.branches:wider?Math.max(4,form.branches-3):4;
      const crownStart=lerp(form.fork*.74,form.fork,mature);
      for(let i=0;i<branches;i++){
        const t=lerp(crownStart,.944,(i+r()*.52)/branches),angle=i*2.399+r()*1.06+x*.22+z*.31;
        const a=stem.getPoint(t);
        const level=(t-crownStart)/(.95-crownStart);
        const envelope=Math.sin(Math.PI*(.17+level*.77));
        const span=(1.8+r()*4.1)*h/25*(.58+.54*envelope)*form.spread;
        const droop=form.wood===3||form.wood===1;
        const end=a.clone().add(new THREE.Vector3(Math.cos(angle)*span,h*((droop?-.035:.01)+r()*.145),Math.sin(angle)*span));
        const elbow=a.clone().lerp(end,.53).add(new THREE.Vector3(Math.sin(angle)*span*.23,span*(droop?.31:.17),-Math.cos(angle)*span*.22));
        const branch=new THREE.CatmullRomCurve3([a,elbow,end]);
        limb(treeWood,a,end,rad*(.14+.13*r()),.025,tint,span*.078,false,near?8:5,
          {curve:near?branch:null,wood:barkStyle,rows:near?7:3});
        if(!form.leaf){
          const spur=a.clone().lerp(end,.59);
          limb(treeWood,spur,spur.clone().add(new THREE.Vector3(.32,span*.48+.33,-.24)),rad*.072,.014,tint,span*.05,false,5);
          continue;
        }
        const bunches=near?3:2;
        for(let j=0;j<bunches;j++){
          const joint=near?branch.getPoint(.53+.21*j):a.clone().lerp(end,.57+.19*j);
          const twigHeading=angle+(j%2?-1:1)*(.83+r()*.60);
          const twigLength=span*(.16+r()*.19);
          const twig=joint.clone().add(new THREE.Vector3(Math.cos(twigHeading)*twigLength,
            span*(.08+r()*.17),Math.sin(twigHeading)*twigLength));
          if(!outer)limb(treeWood,joint,twig,Math.min(.083,rad*.11),.012,tint,.024,false,4);
          const leafCount=Math.max(3,Math.round((near?11:wider?8:outer?4:6)*form.density));
          for(let k=0;k<leafCount;k++){
            const p=joint.clone().lerp(twig,.17+.81*k/(leafCount-1));
            const l=(.78+r()*1.49)*Math.pow(h/22,.72)*(form.wood===2?.68:1.0);
            const heading=twigHeading+(k%2?-1:1)*(.53+r()*1.26);
            blade(treeLeaf,p,heading,l,l*(.18+r()*.13),-.27*l,.12*l,
              color(pick(k%13===11?fadedLeaves:form.leaf,r)).multiplyScalar(.74+r()*.39),.07+r()*.12,near?3:2);
          }
        }
      }
      if(near&&form.wood===1){
        for(let i=0;i<4;i++){
          const u=.30+i*.11,attachment=stem.getPoint(u);
          const heading=i*2.399+x*.37,radius=rad*(.95+r()*.80);
          const foot=base.clone().add(new THREE.Vector3(Math.cos(heading)*radius,0,Math.sin(heading)*radius));
          foot.y=elevation(foot.x,foot.z)-.09;
          const bend=foot.clone().lerp(attachment,.45).add(new THREE.Vector3(Math.cos(heading)*radius*.59,0,Math.sin(heading)*radius*.42));
          const prop=new THREE.CatmullRomCurve3([foot,bend,attachment]);
          const roots=limb(treeWood,foot,attachment,rad*(.22+r()*.16),rad*.16,tint,0,true,8,{curve:prop,rows:11,wood:1});
          mossyBark.push({rings:roots,reach:.38,density:.48});
        }
      }
      return {base,stem,tint};
    }

    const giants=[[-13.5,-12,35,1.26],[13.1,-10,37,1.33],[-13.1,10.2,32,1.00],[14.3,6.7,31,1.02],
      [-15.8,-18,36,1.29],[13.8,-24,37,1.13],[8.2,-25,31,.83],[-5.8,-28.1,35,1.08],
      [1.3,-41,33,.81],[-20,-32,41,1.55],[19.3,-35,38,1.34],[-14,22,36,1.45],[17.7,20,37,1.38],
      [3.7,26.6,29,.89],[-6.2,26.7,32,1.11],[-22,4.8,36,1.32],[22,6.7,40,1.56]];
    const giantForms=[0,3,1,0,3,1,2,0,1,0,3,3,0,2,1,4,0];
    giants.forEach((args,i)=>plantTree(...args,true,true,giantForms[i]));
    const younger=[[-9.3,-16.3,19.7,.43,2],[-6.05,-17.7,24.4,.57,1],[6.31,-15.1,20.3,.55,2],
      [9.6,-19.5,22.4,.74,3],[-11.2,-25.1,27.3,.74,4],[13.9,-15.0,21.7,.47,1],[9.5,13.0,17.4,.57,2]];
    for(const [x,z,h,rad,form] of younger)plantTree(x,z,h,rad,true,true,form);
    for(let layer=0;layer<6;layer++){
      const count=(s.mobile?[13,18,20,24,25,26]:[19,27,33,40,41,43])[layer];
      const distance=[19,31,49,73,114,173][layer],spread=distance*.62+8;
      for(let i=0;i<count;i++){
        const x=(r()-.5)*spread*2,z=-(distance+(r()-.5)*(17+layer*8));
        const opens=(z<-35&&z>-72&&Math.abs(x+10.8)<3.8)||(z>-34&&Math.abs(x)<4.4);
        if(opens)continue;
        if(giants.some(([gx,gz])=>Math.hypot(x-gx,z-gz)<3.4))continue;
        const sample=r(),form=sample<.34?0:sample<.59?1:sample<.81?2:sample<.95?3:4;
        plantTree(x,z,15+25*r()+layer*.66,.27+.61*r(),false,layer<3,form);
      }
    }
    for(const sign of [-1,1])for(let i=0;i<(s.mobile?21:33);i++){
      const x=sign*(16+r()*36),z=-24+r()*67;
      if(giants.some(([gx,gz])=>Math.hypot(x-gx,z-gz)<3.4))continue;
      const sample=r(),form=sample<.28?0:sample<.48?1:sample<.78?2:sample<.94?3:4;
      plantTree(x,z,16+26*r(),.31+.74*r(),false,true,form);
    }

    function understory(out,x,z,sz,variant,flower=false){
      const start=new THREE.Vector3(x,elevation(x,z),z),n=variant===0?5+Math.floor(r()*3):5+Math.floor(r()*4);
      for(let j=0;j<n;j++){
        const a=(j+r()*.52)/n*TAU,l=sz*(.57+.64*r());
        const older=j===0||(j===2&&x*z>0&&variant===0);
        const c=color(pick(older?fadedLeaves:variant===2?shadedLeaves:leaves,r));
        const base=start.clone();base.y+=sz*(.12+r()*.3);
        const tip=base.clone().add(new THREE.Vector3(Math.cos(a)*l*.28,sz*(.12+r()*.34),Math.sin(a)*l*.28));
        limb(out===outerLeaf?outerWood:wood,start,variant===0?base:tip,sz*.021,sz*.011,
          color(0x809351),.037,false,5);
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
    // The foliage stays rooted at the edges of the clearing, including when the camera passes it.
    const frameSites=[[-8.95,-3.2],[8.85,-1.7],[-8.56,2.05],[8.65,2.74],[-10.35,4.8],[9.65,3.5],
      [-9.25,7.1],[9.05,5.1],[-9.95,8.4],[9.75,9.4],[-8.85,12.4],[9.05,13.3],[-9.15,15.7]];
    frameSites.forEach(([x,z],i)=>{
      const scale=i%3===1?1.75:1.32;
      understory(hero,x,z,scale,i%4===0?0:2,i%5===0);
      if(i%2===0)understory(hero,x+.57,z-.32,scale*.81,0,false);
    });
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
        const tone=color(pick(j===1?fadedLeaves:j%2===0?youngLeaves:shadedLeaves,r));
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
    mossTufts(s,leafMat);
    leafLitter(s,leafMat);
    s.rainforest.perches=makePerches(s,leafMat,barkMat,batch);

    const framingTrees=[
      {trunk:[-11.4,10.8,31,1.38,0],branches:[
        {height:5.85,points:[[-8.6,5.2,6.4],[-5.5,4.75,3.46],[-3.94,4.28,1.85],[-3.14,3.91,1.21]]},
        {height:5.34,points:[[-10.2,4.8,5.2],[-9.23,4.31,1.3],[-8.16,4.12,-1.65],[-7.01,3.96,-2.8]]}
      ]},
      {trunk:[11.8,12.1,34,1.47,3],branches:[
        {height:6.45,points:[[8.95,5.75,8.2],[6.22,4.98,5.7],[4.9,4.25,3.03],[4.2,3.89,1.52]]},
        {height:7.02,points:[[8.35,6.4,10.2],[5.42,5.65,8.0],[3.5,5.02,6.25],[2.20,4.67,4.52]]}
      ]}
    ];
    const branchWood=meshBuilder(false,true),branchLeaves=meshBuilder(true);
    for(const {trunk,branches} of framingTrees){
      const [x,z,h,radius,form]=trunk;
      const {base,stem,tint}=plantTree(x,z,h,radius,true,true,form);
      const style=treeForms[form].wood,trunkHeight=stem.getPoint(1).y-base.y;
      for(const {height,points} of branches){
        const joint=stem.getPoint(height/trunkHeight);
        const anchors=[joint,...points.map((p,i)=>new THREE.Vector3(...p)
          .add(new THREE.Vector3((r()-.5)*.84,i%2?.40:-.27,(r()-.5)*1.14)))];
        const curve=new THREE.CatmullRomCurve3(anchors);
        const radiusAt=t=>lerp(radius*.37,.025,Math.pow(t,.77));
        limb(branchWood,joint,anchors[anchors.length-1],radiusAt(0),radiusAt(1),tint,0,false,11,
          {curve,rows:22,wood:style});
        for(let j=0;j<11;j++){
          const t=.23+(j+r()*.56)*.073,origin=curve.getPoint(t),tangent=curve.getTangent(t);
          const heading=Math.atan2(tangent.z,tangent.x),side=j%2?1:-1;
          const angle=heading+side*(.40+r()*1.45);
          const length=lerp(2.23,.66,t)*(.69+r()*.87);
          const lift=(j%3===1?1:-1)*(.20+r()*.56);
          const tip=origin.clone().add(new THREE.Vector3(Math.cos(angle)*length,lift,Math.sin(angle)*length));
          const elbow=origin.clone().lerp(tip,.52);
          elbow.y+=.19+r()*.24;elbow.x+=side*.17;
          const sideBranch=new THREE.CatmullRomCurve3([origin,elbow,tip]);
          limb(branchWood,origin,tip,radiusAt(t)*.48,.012,tint,0,false,7,{curve:sideBranch,rows:8,wood:style});
          for(let fork=0;fork<2+j%2;fork++){
            const socket=sideBranch.getPoint(.39+fork*.24);
            const dir=angle+(fork%2?1:-1)*(.36+r()*.68);
            const reach=.33+r()*.62;
            const end=socket.clone().add(new THREE.Vector3(Math.cos(dir)*reach,(r()-.57)*.55,Math.sin(dir)*reach));
            limb(branchWood,socket,end,.024,.006,tint,.035,false,5,{wood:style});
            const count=3+Math.floor(r()*4);
            for(let k=0;k<count;k++){
              const leafPoint=socket.clone().lerp(end,.24+.72*k/Math.max(1,count-1));
              const direction=dir+(k%2?-1:1)*(.46+r()*.98);
              const size=.20+r()*.48+(t>.78&&k%3===0?.23:0);
              const sag=(r()-.88)*size*(t>.78?1.13:.88);
              const tone=pick(j%7===2||k%7===5?fadedLeaves:j%3===1?youngLeaves:shadedLeaves,r);
              blade(branchLeaves,leafPoint,direction,size,size*(.17+r()*.24),sag,(.10+r()*.18)*size,
                color(tone),.036+r()*.071,6);
            }
          }
        }
      }
    }

    // Carry the woodland across the valley and around the end of the court.
    const outerBands=[
      {rear:true,distances:[27,41,60,86,119,158],span:[18,27,41,58,80,108],count:[13,15,19,23,26,25]},
      {rear:false,sign:-1,distances:[45,59,81,115,151],span:[36,46,60,79,110],count:[17,19,22,26,24]},
      {rear:false,sign:1,distances:[45,59,81,115,151],span:[36,46,60,79,110],count:[17,19,22,26,24]}
    ];
    const treeSites=[];
    for(const {rear,sign,distances,span,count} of outerBands){
      for(let layer=0;layer<distances.length;layer++){
        const n=s.mobile?Math.ceil(count[layer]*.57):count[layer];
        for(let i=0;i<n;i++){
          const across=((i+r())/n*2-1)*span[layer];
          const range=distances[layer]+(r()-.5)*(12+layer*5);
          const x=rear?across:sign*range,z=rear?range:across;
          if(giants.some(([gx,gz])=>Math.hypot(x-gx,z-gz)<4.0)||treeSites.some(([tx,tz])=>Math.hypot(x-tx,z-tz)<2.9))continue;
          treeSites.push([x,z]);
          const form=pick([0,0,1,1,2,2,3,3,4],r),radius=.31+r()*.80,height=14+r()*28;
          plantTree(x,z,height,radius,false,layer===0,form,layer!==0);
          if(layer<3){
            understory(outerLeaf,x+(r()-.5)*5,z+(r()-.5)*5,.90+r()*2.1,1+i%2);
            if(layer===0)understory(outerLeaf,x+1.15,z-1.31,.74+r()*1.44,0);
          }
        }
      }
    }
    const midstory=[
      [-4.3,22.5,15.6], [2.9,23.4,14.6], [-9.3,25.2,17.8], [10.8,24.9,17.0],
      [-.8,30.3,20.2], [6.8,30.4,16.4], [-7.1,34.2,21.8], [3.7,36.8,18.0],
      [-14.0,31.5,18.9], [14.1,32.9,20.6], [-6.2,40.0,20.4], [10.8,42.2,21.4],
      [-15.3,44.7,21.7], [20.4,44.9,18.3], [-26,12.5,21.2], [25.9,17.3,20.6],
      [-25.6,25.0,17.3], [24.6,28.4,19.1], [-33.9,11.5,21.1], [33.9,9.5,19.8]
    ];
    for(const [x,z,h] of midstory){
      plantTree(x,z,h,.37+r()*.17,false,true,2);
      for(let i=0;i<(s.mobile?2:4);i++){
        understory(outerLeaf,x+(r()-.5)*5.7,z+(r()-.5)*4.4,1.0+r()*1.75,i%3);
      }
    }
    for(let i=0;i<(s.mobile?38:71);i++){
      const side=i%3;
      const x=side===0?(r()-.5)*72:(side===1?-1:1)*(30+r()*23);
      const z=side===0?40+r()*46:(r()-.32)*94;
      if(treeSites.some(([tx,tz])=>Math.hypot(x-tx,z-tz)<2.3))continue;
      treeSites.push([x,z]);
      plantTree(x,z,15+r()*12,.29+r()*.26,false,false,2,true);
    }

    // Compact banks of sedges and young ferns at the edges of low camera paths.
    const sedges=meshBuilder(true);
    const bankside=[
      [-7.9,-4.9,1.18],[-8.08,-.26,1.04],[-8.2,3.8,.96],[-8.12,7.35,1.06],[-8.65,11.6,.87],
      [8.06,-5.6,.98],[8.17,-.24,1.12],[8.05,3.55,.94],[8.28,7.7,1.14],[8.7,12.3,.88],
      [-4.75,-11.83,.94],[4.95,-11.7,.82],[-3.62,20.8,1.02],[6.20,19.9,.97]
    ];
    for(const [cx,cz,scale] of bankside){
      for(let patch=0;patch<(s.mobile?15:23);patch++){
        const theta=r()*TAU,spread=Math.sqrt(r())*(.67+r()*.38);
        const x=cx+Math.cos(theta)*spread,z=cz+Math.sin(theta)*spread;
        if(Math.abs(x)<7.65&&z>-10.9&&z<19.5)continue;
        const base=new THREE.Vector3(x,elevation(x,z)-.035,z);
        const kind=patch%5,arch=kind===4?.69:.45,height=scale*(.37+r()*.73);
        for(let j=0;j<5+kind%3;j++){
          const angle=j*2.399+r()*.78;
          const reach=height*(.32+r()*.75);
          const tint=color(pick(kind===1?fadedLeaves:kind===2?youngLeaves:leaves,r));
          blade(sedges,base,angle,reach,reach*(kind===4?.115:.035+r()*.021),
            height*(.24+r()*.58),height*(arch+r()*.23),tint,.07+height*(.16+r()*.13),s.mobile?4:6);
        }
      }
    }
    finish(s.root,sedges,closeLeafMat,"rainforestSedges").layers.enable(foregroundLayer);
    finish(s.root,wood,barkMat,"rainforestButtressTrees",true);
    finish(s.root,leaf,leafMat,"rainforestCanopy");
    finish(s.root,hero,closeLeafMat,"rainforestUnderstory").layers.enable(foregroundLayer);
    finish(s.root,branchWood,barkMat,"rainforestOverhangingBranches",true).layers.enable(foregroundLayer);
    finish(s.root,branchLeaves,closeLeafMat,"rainforestOverhangingLeaves").layers.enable(foregroundLayer);
    finish(s.root,outerWood,barkMat,"rainforestOuterTrunks");
    finish(s.root,outerLeaf,leafMat,"rainforestOuterCanopy");
    forestFloor(s,uniforms,barkMat,mossyBark);
  }

  function forestFloor(s,uniforms,barkMat,mossyBark){
    const r=s.r,wood=meshBuilder(false,true),grain=meshBuilder();
    const treeBrown=color(0x85715a),mossSites=[],rockSites=[],fungusSites=[[],[],[]];
    const mossTones=[0x364833,0x48602e,0x597539,0x7c8042,0x7d934a,0xa89b57,0x3c6953,0x597c5e,0x5d6745];
    const rockTones=[0x979389,0x777c69,0x817d6a,0xa09b82,0x686c68];
    const capTones=[[0xc8ac79,0xd6cbb0,0xb8b49b],[0x9d6545,0xb37c50,0xa28463],[0xaa7651,0xb49d75,0xcead7a]];
    const up=new THREE.Vector3(0,1,0);

    function litterPatch(x,z,span,amount,tone){
      for(let i=0;i<amount;i++){
        const angle=i*2.399+r()*.65,distance=Math.sqrt(r())*span;
        const px=x+Math.cos(angle)*distance,pz=z+Math.sin(angle)*distance;
        const size=.14+r()*.34;
        const worn=Math.abs(px)<7.88&&pz>-9.62&&pz<19.4;
        mossSites.push({p:new THREE.Vector3(px,elevation(px,pz)+.009,pz),n:up,
          sx:size*(.9+r()*.63),sy:size*(worn?.033+r()*.045:.10+r()*.28),sz:size*(.55+r()*.63),
          tint:pick([tone,tone,mossTones[(mossTones.indexOf(tone)+1)%mossTones.length]],r)});
      }
    }
    function barkPoint(rings,t,around){
      const count=rings[0].length-1,row=Math.min(rings.length-2,Math.floor(t*(rings.length-1)));
      const side=Math.min(count-1,Math.floor(around*count));
      const u=around*count-side,v=t*(rings.length-1)-row;
      const a=rings[row][side],b=rings[row][side+1],c=rings[row+1][side],d=rings[row+1][side+1];
      const origin=u+v<=1?a:d;
      const first=u+v<=1?u:1-v,second=u+v<=1?v:1-u;
      const sample=key=>origin[key].clone().multiplyScalar(1-first-second)
        .addScaledVector(b[key],first).addScaledVector(c[key],second);
      return {p:sample(0),n:sample(1).normalize()};
    }
    function brokenEnd(ring,center,axis,hollow){
      const rim=ring.slice(0,-1).map(entry=>entry[0]);
      const bands=[1,.79,.57,.40,.22,0];
      const lift=(p,ratio,i)=>center.clone().lerp(p,ratio)
        .addScaledVector(axis,(hollow?-.23:-.09)*Math.pow(1-ratio,2)+Math.sin(i*2.4)*.058*ratio);
      for(let band=0;band<bands.length-1;band++)for(let i=0;i<rim.length;i++){
        const j=(i+1)%rim.length;
        const tint=color(hollow&&band>=2?0x32271e:[0x9c794f,0xb39466,0x8b6b44,0xa48053,0x7e5d3c][band]);
        tint.multiplyScalar(i===2||i===7?.56:.80+.23*r());
        const a=lift(rim[i],bands[band],i),b=lift(rim[j],bands[band],j);
        const c=lift(rim[i],bands[band+1],i),d=lift(rim[j],bands[band+1],j);
        for(const p of [a,b,c,b,d,c])vertex(grain,p,axis,0,0,tint);
      }
    }

    const fallen=[
      [-10.7,.6,1.72,5.7,.56],[-10.6,5.6,1.39,5.8,.62],[9.8,-3.8,.98,5.2,.47],
      [10.1,7.6,1.38,6.4,.58],[-8.7,-12.9,-2.13,4.5,.48],[3.9,-14.1,-.44,4.2,.49],
      [-6.2,20.8,2.69,4.6,.51],[7.4,22.8,.48,7.0,.64],[-15.5,-18.6,3.0,4.1,.47],
      [15.9,16.8,1.0,6.4,.63],[-14.4,17.7,2.03,6.6,.69],[13.5,-19.2,-1.34,4.6,.55]
    ];
    for(let i=0;i<fallen.length;i++){
      const [x,z,heading,length,radius]=fallen[i],facing=new THREE.Vector3(Math.cos(heading),0,Math.sin(heading));
      const a=new THREE.Vector3(x,elevation(x,z)+radius*.47,z),b=a.clone().addScaledVector(facing,length);
      b.y=elevation(b.x,b.z)+radius*.32;
      const axis=b.clone().sub(a).normalize();
      const rings=limb(wood,a,b,radius,radius*(.53+r()*.27),treeBrown,.17+r()*.23,false,15);
      brokenEnd(rings[0],a,axis.clone().negate(),i%3===0);
      brokenEnd(rings[rings.length-1],b,axis,i%2===0);
      mossyBark.push({rings,reach:1,density:1.7,log:true});
      for(let j=0;j<3;j++){
        const t=.24+j*.22,p=a.clone().lerp(b,t);
        const fork=p.clone().add(new THREE.Vector3(-facing.z*(.43+r()*.9),.33+r()*.64,facing.x*(.43+r()*.8)));
        const forkRings=limb(wood,p,fork,radius*.27,radius*.14,treeBrown,.08,false,7);
        brokenEnd(forkRings[forkRings.length-1],fork,fork.clone().sub(p).normalize(),false);
        litterPatch(p.x+facing.z*.51,p.z-facing.x*.51,1.1,s.mobile?9:18,pick(mossTones,r));
      }
    }
    for(const [x,z,h,radius] of [[-9.6,-4.7,.8,.6],[9.6,4.9,1.36,.63],[-10.6,15.2,1.15,.70],[5.1,24.1,.68,.78],[10.9,-10.8,.99,.46]]){
      const a=new THREE.Vector3(x,elevation(x,z)-.05,z),b=a.clone().add(new THREE.Vector3(.14,h,-.07));
      const rings=limb(wood,a,b,radius,radius*.66,treeBrown,.08,true,13);
      brokenEnd(rings[rings.length-1],b,b.clone().sub(a).normalize(),true);
      mossyBark.push({rings,reach:1,density:.92,log:true});
    }
    finish(s.root,wood,barkMat,"rainforestFallenWood",true);
    const exposed=new THREE.MeshPhongMaterial({vertexColors:true,side:THREE.DoubleSide,shininess:5,specular:0x2a2217});
    surfaceLight(exposed,uniforms);
    finish(s.root,grain,exposed,"rainforestBrokenWood");

    const pockets=[[-7.8,-8.9],[-8.4,-7.2],[-8.6,-4.3],[8.4,-5.6],[-8.6,.85],[8.55,-.8],[-8.74,4.6],[8.8,4.4],
      [-9.64,8.4],[10.5,9],[-10.2,12],[10.4,13.1],[-7.5,20.7],[6.3,21.4],[-4.1,-11.7],[4.4,-12.4],
      [-11.5,-15.7],[12.6,-15.4],[-11.4,21.0],[-3.4,24.5],[3.9,26.4],[11.6,25.9],
      [-18.0,-13],[-20,6.7],[18,6.1],[17.8,-12.5],[15.3,20.3],[-14,18.6],[-5.1,-20.8],[7.7,-20.9],
      [-8.1,2.5],[8.36,3.8],[-8.42,7.6],[8.46,9.28]];
    pockets.forEach(([x,z],i)=>{
      const tone=mossTones[i%mossTones.length];
      litterPatch(x,z,1.10+r()*1.38,s.mobile?20:39,tone);
      const kind=i%7===1?1:0;
      for(let j=0;j<(s.mobile?4:7)+(i%3);j++){
        const a=r()*TAU,d=.65*Math.sqrt(r());
        const px=x+.55+Math.cos(a)*d,pz=z+.15+Math.sin(a)*d;
        if(Math.abs(px)<7.75&&pz>-9.7&&pz<19.5)continue;
        const size=.09+r()*.19;
        fungusSites[kind].push({p:new THREE.Vector3(px,elevation(px,pz)-.013,pz),n:up,
          sx:size*(.84+r()*.24),sy:size*(.69+r()*.72),sz:size,tint:pick(capTones[kind],r)});
      }
      for(let j=0;j<(s.mobile?5:8);j++){
        const a=r()*TAU,d=.3+r()*2.0,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
        if(Math.abs(px)<8.12&&pz>-10.0&&pz<20.0)continue;
        const size=j===0&&i%2===0?.58+r()*.58:.09+r()*.31;
        rockSites.push({p:new THREE.Vector3(px,elevation(px,pz)-size*.06,pz),n:up,
          sx:size*(.81+r()*.70),sy:size*(.29+r()*.39),sz:size*(.6+r()*.65),tint:pick(rockTones,r)});
      }
    });
    for(const [i,{rings,reach,density,log}] of mossyBark.entries()){
      const count=Math.ceil(density*(s.mobile?18:34)),band=r(),tone=mossTones[i%mossTones.length];
      for(let j=0;j<count;j++){
        const t=.018+Math.pow(r(),1.65)*reach*.96,around=(band+(r()-.5)*.51+1)%1;
        const {p,n}=barkPoint(rings,t,around);
        if((log&&n.y<.16)||p.y<elevation(p.x,p.z))continue;
        const size=(log?.105:.062)+r()*(log?.30:.24);
        mossSites.push({p,n,sx:size*(.88+r()*.4),sy:size*(.17+r()*.19),sz:size*(1.1+r()*.64),
          tint:j%6===3?pick(mossTones,r):tone});
      }
      if(log||i%7===0){
        const count=log?6+(i%5):5;
        const face=r(),start=.16+r()*.35;
        for(let j=0;j<count;j++){
          const {p,n}=barkPoint(rings,start+j*(log?.029:.009),(face+j*.035)%1);
          if(n.y<-.20||p.y<elevation(p.x,p.z)+.07)continue;
          const size=.14+r()*.33;
          p.addScaledVector(n,size*.22);
          fungusSites[2].push({p,n:up,sx:size*1.21,sy:size*(.72+r()*.30),sz:size*.83,tint:pick(capTones[2],r)});
        }
      }
    }

    function instances(name,geometry,material,sites){
      const mesh=new THREE.InstancedMesh(geometry,material,sites.length),dummy=new THREE.Object3D();
      const twist=new THREE.Quaternion();
      for(const [i,{p,n,sx,sy,sz,tint}] of sites.entries()){
        dummy.position.copy(p);
        dummy.quaternion.setFromUnitVectors(up,n).multiply(twist.setFromAxisAngle(up,r()*TAU));
        dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
        mesh.setMatrixAt(i,dummy.matrix);
        mesh.setColorAt(i,color(tint));
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.receiveShadow=true;
      mesh.name=name;s.root.add(mesh);
    }
    const closeMoss=new THREE.SphereGeometry(1,8,5);
    const mp=closeMoss.attributes.position;
    const mossColors=[];
    for(let i=0;i<mp.count;i++){
      const x=mp.getX(i),y=mp.getY(i),z=mp.getZ(i),a=Math.atan2(z,x);
      const flake=.9+.11*Math.sin(a*5+y*4)+.075*Math.cos(a*7-y*8);
      mp.setXYZ(i,x*flake,y*flake,z*flake);
      const tint=.70+.19*y+.15*Math.sin(a*6+y*9);
      mossColors.push(tint,tint,tint*.92);
    }
    closeMoss.setAttribute("color",new THREE.Float32BufferAttribute(mossColors,3));
    closeMoss.computeVertexNormals();
    const mossMap=texture("assets/rainforest/moss-litter.jpg");
    const mossMat=new THREE.MeshPhongMaterial({map:mossMap,vertexColors:true,shininess:5,specular:0x182013});
    surfaceLight(mossMat,uniforms);
    instances("rainforestMossCushions",closeMoss,mossMat,mossSites);

    const shape=new THREE.IcosahedronGeometry(1,1),rp=shape.attributes.position,ruv=shape.attributes.uv;
    for(let i=0;i<rp.count;i++){
      const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i);
      const shape=.89+.14*Math.sin(6*x+3*y)+.16*Math.cos(5*z+3*y);
      rp.setXYZ(i,x*shape+.16*y,Math.min(.73,y*shape),z*shape);
      ruv.setXY(i,x*.69+z*.45,y*.82+z*.28);
    }
    shape.computeVertexNormals();
    const stoneMat=new THREE.MeshPhongMaterial({map:texture("assets/meadow/alpine-rock.jpg"),shininess:7,specular:0x292a21,flatShading:true});
    surfaceLight(stoneMat,uniforms,{moss:true});
    instances("rainforestForestFloorStones",shape,stoneMat,rockSites);

    const fungiMat=new THREE.MeshPhongMaterial({vertexColors:true,shininess:15,specular:0x514538,side:THREE.DoubleSide});
    surfaceLight(fungiMat,uniforms);
    const profiles=[
      [[0,0],[.13,0],[.123,.51],[.075,.78],[.14,.83],[.43,.73],[.83,.69],[.87,.73],[.78,.80],[.53,.92],[.26,1],[0,1.025]],
      [[0,0],[.19,0],[.16,.31],[.112,.63],[.30,.64],[.58,.56],[.74,.63],[.69,.80],[.55,.96],[.26,1.05],[0,1.06]],
      [[0,-.035],[.48,-.065],[.89,-.13],[1.0,-.045],[.97,.015],[.82,.075],[.64,.125],[.43,.19],[0,.24]]
    ];
    profiles.forEach((profile,kind)=>{
      const geom=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),s.mobile?10:16);
      const p=geom.attributes.position,colors=[];
      for(let i=0;i<p.count;i++){
        const y=p.getY(i),rad=Math.hypot(p.getX(i),p.getZ(i)),angle=Math.atan2(p.getZ(i),p.getX(i));
        const stripe=.92+.07*Math.cos(angle*7+rad*14),l=s.mobile?10:16;
        const layer=i%profile.length;
        const tint=kind===2?(layer<=2?.96:layer===3?1.22:.58+layer%3*.13):
          layer<=3?1.06:layer<=6?.68+.21*((Math.round(i/profile.length)%2)):(kind===0?.95:1.03);
        const rim=kind===2?.93+.13*Math.sin(angle*5+.6):1+.06*Math.cos(angle*3+y*6);
        p.setXYZ(i,p.getX(i)*rim,y+.036*Math.sin(angle*(l===10?3:5))*rad,p.getZ(i)*rim);
        colors.push(tint*stripe,tint*stripe*(layer<=3?.97:.92),tint*stripe*(layer<=3?.91:.80));
      }
      geom.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geom.computeVertexNormals();
      instances(["rainforestCreamMushrooms","rainforestOchreMushrooms","rainforestShelfFungi"][kind],
        geom,fungiMat,fungusSites[kind]);
    });
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
    const tones=[...leaves,...shadedLeaves,0x947e53,0x7d7748,0xa18d5d].map(color);
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
    bed.count=used;bed.instanceMatrix.needsUpdate=true;bed.instanceColor.needsUpdate=true;
    bed.layers.enable(foregroundLayer);s.root.add(bed);
  }

  function leafLitter(s,material){
    const r=s.r,proto=meshBuilder(),dummy=new THREE.Object3D();
    const white=new THREE.Color(1,1,1);
    blade(proto,new THREE.Vector3(-.34,0,0),0,.69,.18,-.017,.055,white,0,4,true);
    const cap=s.mobile?290:570;
    const bed=new THREE.InstancedMesh(geometryFrom(proto),material,cap);
    const tones=fadedLeaves.map(color);
    bed.name="rainforestDryLeafLitter";bed.receiveShadow=true;bed.frustumCulled=false;
    for(let i=0;i<cap;i++){
      const bank=i%4!==0,side=i%2?1:-1;
      const x=bank?side*(6.6+r()*8.0):(r()-.5)*14.0;
      const z=-15.3+r()*35.5;
      const f=.22+r()*1.06;
      dummy.position.set(x,elevation(x,z)+.018,z);
      dummy.rotation.set((r()-.5)*.33,r()*TAU,(r()-.5)*.40);
      dummy.scale.set(f,f*.45,f);
      dummy.updateMatrix();bed.setMatrixAt(i,dummy.matrix);bed.setColorAt(i,pick(tones,r));
    }
    bed.instanceMatrix.needsUpdate=true;bed.instanceColor.needsUpdate=true;s.root.add(bed);
  }

  function makePerches(s,leafMat,barkMat,batch){
    const r=s.r;
    const sites=[
      [-13.5,-12,6.65,.17,5.5],[13.1,-10,6.1,2.79,5.0],
      [-5.8,-28.1,9.0,.38,4.4],[19.3,-35,8.5,2.99,5.5],
      [-13.1,10.2,6.4,-.29,4.0]
    ].slice(0,s.mobile?3:5);
    return sites.map(([x,z,height,heading,length],index)=>{
      const root=new THREE.Group(),branch=new THREE.Group(),bird=new THREE.Group();
      root.name="rainforestPerch";root.position.set(x,elevation(x,z)+height,z);root.rotation.y=-heading;
      branch.name="rainforestSwayingBranch";
      root.add(branch);branch.add(bird);s.root.add(root);
      const curve=new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-.32,0,0),new THREE.Vector3(length*.57,.23,-.13),
        new THREE.Vector3(length,.60+index*.07,.22)
      );
      const wood=meshBuilder(false,true),leavesOnBranch=meshBuilder();
      let from=curve.getPoint(0);
      const baseTint=color(index%2?0x837468:0x986f51);
      for(let j=1;j<=6;j++){
        const u=j/6,to=curve.getPoint(u);
        limb(wood,from,to,lerp(.30,.035,(j-1)/6),lerp(.30,.035,u),baseTint,.047,false,7);
        from=to;
      }
      for(let j=0;j<8;j++){
        const u=.36+j*.076,a=curve.getPoint(u);
        const side=j%2?1:-1,dir=side*(.65+r()*.92),spread=(.89+r()*.66)*(1-u*.26);
        const tip=a.clone().add(new THREE.Vector3(Math.cos(dir)*spread,.22+r()*.4,Math.sin(dir)*spread));
        limb(wood,a,tip,.046*(1-u)+.017,.012,baseTint,.050,false,5);
        for(let k=0;k<6;k++){
          const p=a.clone().lerp(tip,.42+k*.10),angle=dir+.5*(k%2?-1:1)+r()*.33;
          const len=.28+r()*.48;
          blade(leavesOnBranch,p,angle,len,len*.20,-len*.16,len*.12,
            color(pick(k===4?fadedLeaves:index%2?youngLeaves:shadedLeaves,r)),.041,4);
        }
      }
      finish(branch,wood,barkMat,"rainforestPerchWood");
      finish(branch,leavesOnBranch,leafMat,"rainforestPerchFoliage");
      bird.name="rainforestCanopyBird";
      const shapes=batch(),wings=[];
      const brown=index%2?0x302b23:0x3d3b2c;
      shapes.add("blob",brown,-.017,.069,0,.102,.067,.052,0,0,-.15);
      shapes.add("blob",index%2?0x443832:0x3c4134,.082,.107,0,.044,.043,.038);
      shapes.add("blob",0x5a4b35,.115,.103,0,.025,.010,.012);
      shapes.add("blob",0x302d25,-.148,.047,0,.073,.013,.026,0,0,.16);
      shapes.finish(bird,"rainforestBirdBody");
      for(const side of [-1,1]){
        const wingRoot=new THREE.Group(),wing=batch();
        wingRoot.position.set(-.012,.076,side*.038);
        wing.add("blob",0x35372c,-.019,0,side*.034,.077,.016,.065,0,.11*side,0);
        wing.finish(wingRoot,"rainforestBirdWing");
        bird.add(wingRoot);wings.push(wingRoot);
      }
      const duration=.29+r()*.11,period=18.6+r()*12.2;
      // A few quick hops, a longer pause, and a hop back into the cover.
      const hops=[
        {at:1.6+r()*1.4,from:.33,to:.51},
        {at:4.6+r()*1.6,from:.51,to:.71},
        {at:8.6+r()*2.3,from:.71,to:.48},
        {at:13.2+r()*2.0,from:.48,to:.33}
      ];
      return {branch,bird,wings,curve,duration,period,hops,phase:r()*period};
    });
  }

  function updatePerches(perches,time){
    for(const perch of perches){
      const {branch,bird,wings,curve,duration,period,hops,phase}=perch;
      const t=(time+phase)%period;
      let u=hops[0].from,lift=0,lean=0,turn=0,flutter=0,shake=0;
      for(const {at,from,to} of hops){
        const age=t-at;
        if(age<0)break;
        const p=Math.min(1,age/duration);
        u=lerp(from,to,smoothstep(p,0,1));turn=to>from?0:Math.PI;
        if(age<duration){
          lift=.235*Math.sin(Math.PI*p);
          lean=.14*Math.sin(p*TAU);
          flutter=Math.sin(Math.PI*p)*(.48+.49*Math.abs(Math.sin(age*39)));
        }
        const after=age-duration;
        if(after>=0&&after<1.5)shake+=.043*Math.exp(-after*4.0)*Math.sin(after*19);
      }
      curve.getPoint(u,bird.position);
      bird.position.y+=lift+.053+.005*Math.sin(time*3.7+phase);
      bird.rotation.y=turn;
      bird.rotation.z=lean+.040*Math.sin(time*4.7+phase);
      for(let i=0;i<2;i++)wings[i].rotation.x=(i===0?-1:1)*(.13+flutter*1.1);
      branch.rotation.z=.014*Math.sin(time*1.43+phase)+shake;
      branch.rotation.x=.009*Math.sin(time*.89+phase)+shake*.40;
    }
  }

  function cliffs(s,uniforms,batch){
    const r=s.r,rock=meshBuilder(),v=new THREE.Vector3();
    const proto=new THREE.IcosahedronGeometry(1,2);
    const p=proto.attributes.position;
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const z=-47-i*14.5,x=side*(44+i*8+r()*6),h=4.5+r()*5.5;
      const y=elevation(x,z);
      const shapes=[[x,z,y+h*.21,8+r()*5,h,7+r()*4],[x+side*4,z-4,y+h*.36,6,h*.59,5]];
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
            float layers=.77+.16*sin(p.z*.116+p.x*.19-forestTime*.095)
              +.13*cos(p.x*.312-p.z*.126)+.11*sin(p.y*.68+p.z*.16+forestTime*.11);
            float valley=exp(-max(.0,p.y+1.2)*.11)*layers;
            float basin=exp(-dot((p-vec3(-12.8,1.5,-54.0))/vec3(9.5,4.5,12.5),
                                 (p-vec3(-12.8,1.5,-54.0))/vec3(9.5,4.5,12.5)));
            float window=forestClearing(p);
            float woodland=smoothstep(14.0,54.0,length((p.xz-vec2(0.0,4.5))*vec2(1.0,.79)));
            float glints=.45+.55*sin(p.x*.39+p.z*.29+p.y*.68-forestTime*.16);
            float nearMist=smoothstep(.8,14.0,t)*exp(-max(0.0,p.y-.5)*.20)*.0115;
            // Swirling dusty aerosol suspended right inside the court volume (0..18m).
            float courtDust=(1.0-smoothstep(8.0,22.0,length(p.xz-vec2(0.0,-2.0))))*exp(-max(0.0,p.y-2.2)*.18)*(.55+.45*glints)*.0095;
            float density=.0078+nearMist+courtDust+valley*(.0172+woodland*.0052)+basin*.019+window*.017+
              smoothstep(.20,.80,glints)*exp(-max(0.0,p.y)*.085)*.0056;
            float transmittance=exp(-accumulated*.68);
            accumulated+=density*stride;
            amber+=window*(.42+.58*valley)*stride*.125*transmittance*(.38+.62*angle);
            glow+=lightShaft(p)*(valley*.78+.52)*stride*.265*transmittance*
              smoothstep(.35,3.2,t)*(.54+.46*angle);
          }
          float warm=1.0-exp(-amber);
          float mist=(1.0-exp(-accumulated))*(.61+.32*warm);
          float shaft=(1.0-exp(-glow))*.78;
          float alpha=min(.97,mist+shaft*(1.0-mist));
          vec3 shades=mix(vec3(.455,.508,.414),vec3(.99,.827,.56),clamp(warm*1.23,0.0,1.0));
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
    const r=s.r,dust=s.mobile?560:1380,insects=s.mobile?26:44,nearDust=s.mobile?95:220;
    const p=[],seed=[],scale=[],kind=[];
    for(let i=0;i<dust+insects+nearDust;i++){
      const kindId=i<dust?0:i<dust+insects?1:2;
      const x=kindId===1?(i%2?1:-1)*(4.5+r()*12.4):(r()-.5)*(kindId===2?16:36);
      const height=kindId===0?.35+Math.pow(r(),1.55)*9.6:.45+r()*4.2;
      p.push(x,height,kindId===2?-10+r()*22:-38+r()*64);
      seed.push(r()*TAU);scale.push(.65+r()*1.45);kind.push(kindId);
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
          float t=forestTime*(.46+seed*.10)+seed;
          float breeze=.58+.42*sin(forestTime*.44-position.z*.23+position.x*.19);
          vec3 drift=vec3(sin(t*.91)*1.18+sin(t*2.19)*.21+breeze*.55,
            sin(t*.62+position.y*.27)*.59,cos(t*.65)*1.71+breeze*.32);
          vec3 flight=vec3(1.69*sin(t*1.43)+.48*sin(t*4.42),.79*cos(t*2.23)+.25*sin(t*6.36),1.49*cos(t*1.04));
          insect=step(.5,flyer)*(1.0-step(1.5,flyer));soft=step(1.5,flyer);
          vec3 p=position+mix(drift,flight,insect);
          vec4 view=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*view;
          float depth=-view.z;
          float beam=clamp(lightShaft(p)*2.05+forestClearing(p)*.34,0.0,1.0);
          float pointSize=clamp(size*mix(42.0,48.0,insect)/max(3.6,depth),1.6,mix(7.5,7.8,insect));
          gl_PointSize=mix(pointSize,clamp(size*54.0/max(1.55,depth),5.0,32.0),soft);
          spark=mix(.26+.84*beam,.20+.62*beam,insect)*
            smoothstep(.7,3.0,depth)*(1.0-smoothstep(24.0,45.0,depth))*
            mix(.78+.22*sin(t*2.5),.52+.48*smoothstep(-.75,.73,sin(t*1.95)),insect);
          float near=smoothstep(.55,1.55,depth)*(1.0-smoothstep(6.5,14.0,depth));
          spark=mix(spark,near*(.16+.34*beam)*(.82+.18*sin(t*2.1)),soft);
          flutter=.45+.55*abs(sin(t*32.5+seed));
        }`,
      fragmentShader:`
        varying float spark,insect,flutter,soft;
        void main(){
          vec2 p=gl_PointCoord-.5;
          float dust=exp(-dot(p,p)*12.0)*(1.0-smoothstep(.22,.50,length(p)));
          vec2 uv=vec2(abs(p.x),p.y)-vec2(.14*flutter,-.035);
          float veil=1.0-smoothstep(.08,.61,length(uv*vec2(2.65,2.14)));
          float wings=veil*(.65+.35*flutter);
          vec3 tone=mix(vec3(1.0,.92,.72),vec3(.98,.965,.89),insect);
          float aperture=pow(1.0-smoothstep(.06,.49,length(p)),1.45);
          gl_FragColor=vec4(tone,spark*mix(mix(dust*.72,wings*.60,insect),aperture*.68,soft));
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
      map:leafTexture(r),alphaTest:.48,side:THREE.DoubleSide
    }),s.mobile?9:15);
    mesh.name="rainforestFallingLeaves";mesh.count=0;mesh.frustumCulled=false;mesh.layers.enable(foregroundLayer);
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
    const uniforms={forestSun:{value:light},forestTime:{value:0}};
    const state={uniforms,foregroundLayer,...air(s,uniforms)};
    s.rainforest=state;s.heightAt=elevation;s.menuOrbit=[13.1,17.5,5.6,2.2];
    // The offscreen material has no scene mesh, so the owned sky material disposes it.
    canopySky(s,uniforms);
    s.root.getObjectByName("rainforestCanopySky").material.addEventListener("dispose",()=>state.airMaterial.dispose());
    ground(s,uniforms);cliffs(s,uniforms,batch);trees(s,uniforms,batch);waterfall(s,uniforms);motes(s,uniforms);
    reclaimedHoops(s,uniforms);
    state.falling=fallingLeaves(s);
    updateFalling(state.falling,s.time);
    updatePerches(state.perches,s.time);
    return state;
  }

  function update(s){
    s.rainforest.uniforms.forestTime.value=s.time;
    const board=s.rainforest.boardMotion;
    if(board)board.panelRig.rotation.x=board.nearPivot.rotation.x;
    updateFalling(s.rainforest.falling,s.time);
    updatePerches(s.rainforest.perches,s.time);
  }

  global.AIBARainforest=Object.freeze({build,update,light});
})(window);
