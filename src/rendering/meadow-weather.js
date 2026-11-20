/* Score-driven weather for the alpine meadow. All meshes and textures belong to the place root. */
(function(global){
  "use strict";
  const {smoothstep:curve,lerp,degToRad,clamp}=THREE.MathUtils;
  const stages=[[.90,"golden-peaks"],[.64,"rainbow"],[.55,"cloudbreak"],[.36,"wind-rain"],[.18,"light-rain"],[0,"cloudy"]];

  // June 20, Kalajun (42°57′30″ N, 82°22′35″ E), UTC+8.
  // NOAA solar-position samples: [clock minutes, elevation, azimuth from north].
  const sunPath=[
    [1185,24.01,280.39],[1200,21.32,282.72],[1215,18.66,285.03],
    [1230,16.03,287.35],[1245,13.42,289.68],[1260,10.86,292.02],
    [1275,8.34,294.39],[1290,5.86,296.80],[1305,3.44,299.25]
  ];
  const courtNorth=325; // True bearing of the +Z axis, looking away from the main hoop.
  function smoothDamp(current,target,state,velKey,smoothTime,maxSpeed,dt){
    if(dt<=0)return current;
    const st=Math.max(0.0001,smoothTime),omega=2/st,x=omega*dt;
    const exp=1/(1+x+0.48*x*x+0.235*x*x*x);
    let change=current-target;
    const maxChange=maxSpeed*st;
    change=clamp(change,-maxChange,maxChange);
    const clampedTarget=current-change;
    const temp=(state[velKey]+omega*change)*dt;
    state[velKey]=(state[velKey]-omega*temp)*exp;
    let output=clampedTarget+(change+temp)*exp;
    if((target-current>0)===(output>target)){output=target;state[velKey]=0;}
    return output;
  }

  function moveSun(w,p){
    const minute=1185+34*curve(p,.08,.63)+86*curve(p,.60,1);
    const i=Math.min(sunPath.length-2,Math.floor((minute-1185)/15));
    const [start,a0,b0]=sunPath[i], [end,a1,b1]=sunPath[i+1], t=(minute-start)/(end-start);
    const elevation=degToRad(lerp(a0,a1,t)),angle=degToRad(lerp(b0,b1,t)-courtNorth);
    w.sunMinute=minute;
    w.uniforms.meadowSun.value.set(Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(angle)*Math.cos(elevation));
  }

  function cloudMap(){
    const size=128,data=new Uint8Array(size*size*4);
    const hash=(x,y)=>((Math.imul(x+71,374761393)^Math.imul(y+23,668265263))>>>0);
    const grain=(x,y)=>{
      const k=hash(x,y);
      return ((Math.imul(k^(k>>>13),1274126177)>>>0)%4096)/4095;
    };
    const layer=(x,y,n)=>{
      const u=(x%size)*n/size,v=(y%size)*n/size,ix=Math.floor(u),iy=Math.floor(v);
      const a=curve(u-ix,0,1),b=curve(v-iy,0,1);
      return lerp(lerp(grain(ix,iy),grain((ix+1)%n,iy),a),lerp(grain(ix,(iy+1)%n),grain((ix+1)%n,(iy+1)%n),a),b);
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4,g=(.56*layer(x,y,5)+.28*layer(x+size/4,y,10)+.16*layer(x,y+size/2,21));
      data[i]=data[i+1]=data[i+2]=Math.round(g*255);data[i+3]=255;
    }
    const map=new THREE.DataTexture(data,size,size);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;map.needsUpdate=true;
    return map;
  }

  // Sky and ground use the same moving cloud field. Rays sample openings above their world-space position.
  const cloudGLSL=`
    uniform sampler2D meadowClouds;
    uniform vec4 meadowSky;   // clearing, gold, rain, wetness
    uniform vec4 meadowAir;   // valley mist, light shafts, rainbow, lightning
    uniform vec2 meadowStorm; // mountain cloud density, lightning blackout
    uniform vec3 meadowSun;
    uniform vec2 meadowOpening;
    uniform float meadowClock;
    vec2 cloudUV(vec2 p){return p/620.0+vec2(meadowClock*.0028,-meadowClock*.0012);}
    float cloudDensity(vec2 p){return texture2D(meadowClouds,cloudUV(p)).r;}
    float cloudEdge(){return .29+meadowSky.x*.205-meadowSky.z*.081;}
    float sunWindow(vec3 p,float broad){
      vec2 slant=meadowSun.xz/max(.085,meadowSun.y);
      vec2 floorPos=p.xz-p.y*slant;
      float cover=smoothstep(cloudEdge()-.04,cloudEdge()+.05,cloudDensity(floorPos+slant*62.0));
      vec2 axis=normalize(meadowSun.xz),across=vec2(-axis.y,axis.x);
      vec2 delta=floorPos-meadowOpening;
      float x=dot(delta,across),y=dot(delta,axis);
      float wide=exp(-x*x/690.0-y*y/10400.0);
      float slot=exp(-pow((x-1.0)*.14,2.0))+.62*exp(-pow((x-24.0)*.20,2.0))+.57*exp(-pow((x+17.0)*.23,2.0));
      float opening=slot*exp(-y*y/9980.0);
      return clamp(max(.72*(1.0-cover)*wide*broad,opening*(.52+.41*(1.0-cover))),0.0,1.0);
    }
  `;
  // Both the dome and the mountain extinction sample the same distant cloud layers.
  const skyGLSL=`
    vec3 alpineSky(vec3 ray,vec3 eye){
      float up=max(0.0,ray.y),haze=pow(1.0-up,4.2);
      vec2 skyAt=ray.xz*(135.0/(.33+up))+eye.xz*.45;
      vec2 warp=vec2(cloudDensity(skyAt*1.3+vec2(69.0,31.0)),
        cloudDensity(skyAt*1.4+vec2(-51.0,74.0)))-.48;
      skyAt+=warp*42.0;
      float details=cloudDensity(skyAt*2.83+vec2(207.0,108.0));
      float a=cloudDensity(skyAt)*.81+details*.19;
      float litEdge=cloudDensity(skyAt+vec2(-24.0,13.0));
      float edge=cloudEdge();
      // Preserve 3D cloud gaps and layered sky depth even in the opening overcast phase (meadowSky.x == 0).
      float baseCover=(.68-meadowSky.x*.64)*smoothstep(-.09,.08,up)*(.55+.45*a);
      float cloud=max(smoothstep(edge-.065,edge+.11,a),baseCover);
      float openBeam=max(meadowAir.y,.36*(1.0-meadowSky.z));
      if(openBeam>.015&&ray.y>.04){
        vec3 atCloud=eye+ray*((62.0-eye.y)/ray.y);
        cloud*=1.0-sunWindow(atCloud,.32)*openBeam*.78;
      }
      float sunCos=max(0.0,dot(ray,meadowSun));
      float sunSide=pow(sunCos,8.0);
      float mieHalo=pow(sunCos,5.0)*.26+pow(sunCos,38.0)*.44;
      float sunDisc=smoothstep(.9986,.9996,sunCos);
      vec3 day=mix(vec3(.075,.215,.38),vec3(.34,.50,.62),haze);
      vec3 dusk=mix(vec3(.025,.075,.100),vec3(.16,.25,.28),haze);
      vec3 sky=mix(day,dusk,meadowSky.w*.14+meadowSky.y*.76);
      float sunPresence=.38+.62*meadowSky.x;
      sky=mix(sky,vec3(.62,.42,.24),sunSide*sunPresence*.48);
      vec3 sunGlowCol=mix(vec3(.96,.92,.82),vec3(1.0,.66,.34),meadowSky.y);
      sky+=sunGlowCol*(mieHalo*.36+sunDisc*.85*meadowSky.x)*sunPresence*(1.0-cloud*.68);
      float roll=smoothstep(.14,.74,a+(a-litEdge)*.85);
      // High-contrast 3D cloud undersides vs silver-lit cloud tops even at progress=0.
      vec3 storm=mix(vec3(.12,.17,.24),vec3(.64,.69,.74),roll);
      storm+=vec3(.22,.20,.16)*pow(sunCos,6.0)*(1.0-roll)*(.45+.55*(1.0-meadowSky.z));
      storm*=1.04-meadowSky.z*.32;
      vec3 open=mix(vec3(.23,.295,.36),vec3(.76,.72,.62),roll);
      open=mix(open,vec3(.63,.39,.22),sunSide*meadowSky.y*.48);
      vec3 col=mix(sky,mix(storm,open,meadowSky.x),cloud);
      col+=sunGlowCol*pow(sunCos,14.0)*cloud*(1.0-roll)*.34*sunPresence;
      float flash=pow(max(0.0,dot(ray,normalize(vec3(-.44,.20,-.91)))),13.0);
      float bank=0.0;
      for(int i=0;i<3;i++){
        float stepDistance=112.0+float(i)*87.0;
        vec3 p=vec3(0.0,2.0,4.745)+ray*stepDistance;
        float billow=cloudDensity(p.xz*.87+vec2(float(i)*91.0,p.y*3.3));
        float height=1.0-smoothstep(42.0,153.0,p.y+27.0*(billow-.45));
        bank+=height*(.48+.52*billow);
      }
      // Keep horizon cloud bank localized near the mountain bases so it never flattens the entire sky dome.
      float horizonBand=1.0-smoothstep(.02,.28,up);
      float veil=(1.0-exp(-bank*meadowStorm.x*.85))*.42*horizonBand;
      col=mix(col,mix(vec3(.24,.32,.42),vec3(.58,.63,.68),a),veil);
      col=mix(col,col*vec3(.075,.103,.185)+vec3(.006,.010,.025),meadowStorm.y*.91);
      col+=vec3(.58,.70,.98)*meadowAir.w*flash*.81;
      // A primary bow is a continuous angular arc centred on the anti-solar direction;
      // passing clouds and valley mist softly blur and dim sections without breaking the arc.
      if(meadowAir.z>.003){
        float angle=acos(clamp(dot(ray,-meadowSun),-1.0,1.0));
        float mistPatch=cloudDensity(ray.xz*260.0+vec2(ray.y*420.0,46.0));
        float blurAmt=clamp(smoothstep(.35,.88,cloud)*.72+veil*.58+(1.0-mistPatch)*.32,0.0,1.0);
        // Mist widens and diffuses the spectral bands rather than cutting the bow into pieces.
        float spread=mix(1.0,.46,blurAmt);
        float band=exp(-pow((angle-.728)*54.0*spread,2.0));
        vec3 spectrum=vec3(
          exp(-pow((angle-.740)*108.0*spread,2.0)),
          exp(-pow((angle-.726)*144.0*spread,2.0)),
          exp(-pow((angle-.712)*108.0*spread,2.0)));
        float hazeFade=mix(1.0,.28,blurAmt);
        float strength=hazeFade*band*meadowAir.z*smoothstep(-.012,.062,ray.y);
        col+=strength*(vec3(.028,.031,.035)+spectrum*vec3(.070,.046,.062));
      }
      return col;
    }
  `;

  const airVertex=`
    varying vec2 vUv;
    varying vec3 beamFromA,beamToA,beamFromB,beamToB;
    uniform mat4 airViewProjection;
    uniform vec3 meadowSun;
    uniform vec2 meadowOpening;
    vec3 projected(vec4 clip){return vec3(clip.xy/max(.1,clip.w)*.5+.5,clip.w);}
    void beam(vec3 foot,out vec3 from,out vec3 to){
      vec4 bottom=airViewProjection*vec4(foot,1.0);
      vec4 slope=airViewProjection*vec4(meadowSun,0.0);
      float span=clamp((bottom.w-8.0)/max(.01,-slope.w),4.0,88.0);
      from=projected(bottom);to=projected(bottom+slope*span);
    }
    void main(){
      vec2 axis=normalize(meadowSun.xz),across=vec2(-axis.y,axis.x);
      vec2 a=meadowOpening+across,b=meadowOpening-across*17.0-axis*19.0;
      beam(vec3(a.x,3.0,a.y),beamFromA,beamToA);
      beam(vec3(b.x,5.0,b.y),beamFromB,beamToB);
      vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);
    }`;

  function buildSky(s,w){
    const mat=new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,uniforms:w.uniforms,
      vertexShader:`varying vec3 vRay; void main(){vRay=(modelMatrix*vec4(position,1.0)).xyz-cameraPosition;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:cloudGLSL+skyGLSL+`
        varying vec3 vRay;
        void main(){
          vec3 ray=normalize(vRay);
          vec3 col=alpineSky(ray,cameraPosition);
          gl_FragColor=vec4(col,1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const sky=new THREE.Mesh(new THREE.SphereGeometry(485,40,24),mat);
    sky.name="alpineCloudSky";sky.position.z=COURT.midZ;sky.frustumCulled=false;sky.renderOrder=-990;s.root.add(sky);
    mat.addEventListener("dispose",()=>{
      w.uniforms.meadowClouds.value.dispose();
      w.airMaterial.dispose();
    });
  }

  function airPass(w){
    const uniforms={...w.uniforms,sceneDepth:{value:null},invProjection:{value:new THREE.Matrix4()},
      cameraWorld:{value:new THREE.Matrix4()},airViewProjection:{value:new THREE.Matrix4()},
      cameraClip:{value:new THREE.Vector2()},airAspect:{value:1}};
    return new THREE.ShaderMaterial({
      uniforms,vertexShader:airVertex,depthTest:false,depthWrite:false,
      fragmentShader:cloudGLSL+`
        varying vec2 vUv;
        varying vec3 beamFromA,beamToA,beamFromB,beamToB;
        uniform sampler2D sceneDepth;
        uniform mat4 invProjection,cameraWorld;
        uniform vec2 cameraClip;
        uniform float airAspect;
        float shaft(vec3 a,vec3 b,float width,float depth){
          if(a.z<19.0||b.z<3.0)return 0.0;
          vec2 metric=vec2(airAspect,1.0),axis=(b.xy-a.xy)*metric;
          vec2 p=(vUv-a.xy)*metric;
          float t=dot(p,axis)/max(.001,dot(axis,axis));
          float u=clamp(t,0.0,1.0);
          float edge=length(p-axis*u)/mix(width,width*.48,u);
          float slice=1.0/mix(1.0/a.z,1.0/b.z,u);
          float opaque=smoothstep(slice-7.0,slice+4.0,depth);
          return exp(-edge*edge*1.63)*smoothstep(-.07,.11,t)*(1.0-smoothstep(.59,1.04,t))*opaque;
        }
        void main(){
          float z=texture2D(sceneDepth,vUv).r;
          float viewDepth=(cameraClip.x*cameraClip.y)/mix(cameraClip.y,cameraClip.x,z);
          vec3 view=normalize((invProjection*vec4(vUv*2.0-1.0,1.0,1.0)).xyz);
          vec3 ray=(cameraWorld*vec4(view,0.0)).xyz;
          vec3 eye=cameraWorld[3].xyz;
          // Stop ray-marching strictly at the true surface depth (never march virtual fog behind close spectators or hills!).
          float end=min(176.0,viewDepth/max(.13,-view.z));
          float startD=18.0;
          float stepSize=max(0.0,end-startD)/8.0;
          float mist=0.0,beam=0.0;
          for(int i=0;i<8;i++){
            float t=startD+(float(i)+.48)*stepSize;
            vec3 p=eye+ray*t;
            float dist=length(p.xz-vec2(0.0,4.745));
            // Keep valley mist strictly in the outer valley & foothills (36m..190m), never smearing across the court or spectators.
            float valleyRing=smoothstep(34.0,76.0,dist)*(1.0-smoothstep(148.0,198.0,dist));
            float stratum=exp(-pow((p.y-5.2-1.7*sin(p.x*.035+p.z*.033))*.095,2.0));
            float pockets=.44+.56*cloudDensity(p.xz*2.7+vec2(meadowClock*1.4,33.0));
            mist+=valleyRing*stratum*pockets;
            float air=exp(-abs(p.y-9.5)*.038)*valleyRing*smoothstep(0.0,3.5,p.y);
            if(meadowAir.y>.01)beam+=air*sunWindow(p,.26)*meadowAir.y;
          }
          float veil=1.0-exp(-stepSize*mist*meadowAir.x*.013);
          float shaftA=shaft(beamFromA,beamToA,.24,end);
          float shaftB=shaft(beamFromB,beamToB,.31,end);
          float light=min(1.0,(1.0-exp(-stepSize*beam*.045))+(shaftA+.82*shaftB)*meadowAir.y*.42)*(1.0-.72*meadowAir.z);
          vec3 cool=mix(vec3(.42,.51,.59),vec3(.54,.62,.69),meadowSky.x)*(1.0-.75*meadowStorm.y);
          vec3 warm=mix(vec3(1.0,.91,.72),vec3(1.0,.74,.42),meadowSky.y);
          float opacity=min(.62,veil+light*.82);
          vec3 col=(cool*veil+warm*light*.82)/max(.001,veil+light*.82);
          gl_FragColor=vec4(col,opacity);
        }`
    });
  }

  function buildFallback(s,w){
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:w.uniforms,
      vertexShader:`varying vec2 vUv; varying vec3 world; void main(){vUv=uv;world=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);}`,
      fragmentShader:cloudGLSL+`
        varying vec2 vUv; varying vec3 world;
        void main(){
          float border=smoothstep(0.0,.22,vUv.x)*(1.0-smoothstep(.78,1.0,vUv.x));
          border*=smoothstep(0.0,.13,vUv.y)*(1.0-smoothstep(.64,1.0,vUv.y));
          float wisps=cloudDensity(world.xz*2.5+vec2(vUv.y*67.0,meadowClock*1.6));
          float mist=exp(-pow((vUv.y-.28)*3.8,2.0))*(.46+.54*wisps)*meadowAir.x*.57;
          float shaft=sunWindow(world,.14)*meadowAir.y*exp(-pow((vUv.y-.50)*2.25,2.0))*.81;
          vec3 cool=vec3(.27,.34,.41)*(1.0-.75*meadowStorm.y),warm=mix(vec3(.83,.66,.42),vec3(.94,.52,.22),meadowSky.y);
          gl_FragColor=vec4(mix(cool,warm,shaft/max(.001,mist+shaft)),border*(mist+shaft));
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const group=new THREE.Group(),geo=new THREE.PlaneGeometry(142,31);
    group.name="meadowAtmosphereFallback";s.root.add(group);
    for(const [x,y,z,rotation] of [[-12,12,-70,.06],[-12,12,-111,.06],[-66,12,10,1.54],[68,12,8,-1.53],[0,12,73,Math.PI]]){
      const layer=new THREE.Mesh(geo,mat);layer.position.set(x,y,z);layer.rotation.y=rotation;layer.renderOrder=2;
      group.add(layer);
    }
    return group;
  }

  function buildRain(s,w){
    const d=[];
    // Weather particles have their own deterministic stream so they never move existing flower or tree placements.
    let seed=20261118;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<(s.mobile?980:2360);i++)d.push((random()-.5)*61,COURT.midZ+(random()-.5)*64,random(),random());
    const geo=new THREE.InstancedBufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));
    geo.setIndex([0,1,2,1,3,2]);
    geo.setAttribute("drop",new THREE.InstancedBufferAttribute(new Float32Array(d),4));
    geo.instanceCount=d.length/4;
    const mat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:w.uniforms,
      vertexShader:`
        attribute vec4 drop; uniform vec4 meadowSky; uniform float meadowClock,meadowWind;
        varying float alpha; varying vec2 streak;
        uniform vec4 meadowAir;
        void main(){
          float meadowStormFlash=meadowAir.w;
          float height=17.0-mod(drop.w*17.0+meadowClock*(10.0+drop.z*5.0),17.0);
          vec2 slant=vec2(mix(.055,.49,min(1.0,meadowWind)),.085);
          vec3 p=vec3(drop.x+slant.x*(17.0-height),height,drop.y+slant.y*(17.0-height));
          p.y-=position.y*(.33+drop.z*.94);
          p.xz+=position.y*slant*.69;
          float d=length(p-cameraPosition);
          alpha=smoothstep(.40,3.0,d)*(1.0-smoothstep(25.0,46.0,d))*smoothstep(.2,1.5,height)
            *step(drop.z,meadowSky.z)*mix(.43,.96,drop.w)*(1.0+.37*meadowStormFlash)*smoothstep(.015,.35,meadowSky.z);
          vec4 v=viewMatrix*vec4(p,1.0);
          v.x+=position.x*(.009+drop.w*.023)*(1.0+meadowSky.z*.59);
          streak=position.xy;
          gl_Position=projectionMatrix*v;
        }`,
      fragmentShader:`varying float alpha; varying vec2 streak;
        void main(){
          float shine=(1.0-smoothstep(.23,1.0,abs(streak.x)))*smoothstep(0.0,.26,streak.y)*(1.0-smoothstep(.52,1.0,streak.y));
          gl_FragColor=vec4(.64,.75,.84,alpha*shine*.93);
        }`
    });
    const rain=new THREE.Mesh(geo,mat);rain.name="alpineRain";rain.frustumCulled=false;rain.renderOrder=3;s.root.add(rain);
    return rain;
  }

  function buildLightning(s,w){
    const p=[],tapers=[];
    const branch=(points,width)=>{
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
        const spread=width*(1-i/points.length*.79),vx=-dy/len*spread,vy=dx/len*spread;
        const u=[a[0]-vx,a[1]-vy,a[2]],v=[a[0]+vx,a[1]+vy,a[2]];
        const x=[b[0]-vx,b[1]-vy,b[2]],y=[b[0]+vx,b[1]+vy,b[2]];
        p.push(...u,...v,...x,...v,...y,...x);
        tapers.push(-1,1,-1,1,1,-1);
      }
    };
    const main=[[0,48,0],[3,38,0],[-2,34,0],[4,29,0],[1,24,0],[5,21,0],[2,16,0],[4,14,0],[0,9,0],[2,4,0],[1,0,0]];
    branch(main,1.85);
    branch([main[2],[-9,29,0],[-11,25,0],[-16,24,0],[-17,20,0],[-22,18,0]],.86);
    branch([main[3],[10,29,0],[13,25,0],[12,21,0],[17,19,0],[19,15,0]],.99);
    branch([main[6],[-5,13,0],[-7,8,0],[-11,6,0]],.63);
    branch([[13,25,0],[18,26,0],[21,24,0],[26,23,0]],.58);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
    geometry.setAttribute("edge",new THREE.Float32BufferAttribute(tapers,1));
    const material=new THREE.ShaderMaterial({
      uniforms:w.uniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`
        attribute float edge; varying float across;
        void main(){across=edge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
      `,
      fragmentShader:`
        uniform vec4 meadowAir; varying float across;
        void main(){
          float core=exp(-pow(across*7.0,2.0)),glow=exp(-pow(across*2.4,2.0));
          vec3 light=mix(vec3(.38,.53,1.0),vec3(.94,.985,1.0),core);
          gl_FragColor=vec4(light,min(1.0,(.91*core+.29*glow)*meadowAir.w));
        }
      `
    });
    const bolt=new THREE.Mesh(geometry,material);
    bolt.name="alpineForkLightning";bolt.frustumCulled=false;bolt.visible=false;
    bolt.position.set(14,11,-128);bolt.renderOrder=4;s.root.add(bolt);
    return bolt;
  }

  function buildMountainClouds(s,w){
    // 3 continuous 360-degree closed volumetric cloud rings at staggered depths (128m, 188m, 248m).
    // Closed rings have ZERO vertical polygon edges/seams, while hardware Z-testing makes clouds
    // physically weave in front of and behind the near mountain ridges (166m) and far snow peaks (290m).
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,uniforms:w.uniforms,
      vertexShader:`
        attribute vec2 ringMeta;
        varying vec2 vUv,vMeta;
        varying vec3 vWorld;
        void main(){
          vUv=uv;vMeta=ringMeta;
          vWorld=(modelMatrix*vec4(position,1.0)).xyz;
          gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
        }`,
      fragmentShader:cloudGLSL+`
        varying vec2 vUv,vMeta;
        varying vec3 vWorld;
        void main(){
          // Strict zero-alpha envelope at top & bottom of ring (vUv.y == 0 and vUv.y == 1) guarantees zero hard edges.
          float edgeFade=smoothstep(0.0,.28,vUv.y)*(1.0-smoothstep(.70,1.0,vUv.y));
          if(edgeFade<.005)discard;
          vec2 wUV=vWorld.xz*1.45+vec2(meadowClock*(1.6+vMeta.x*.7)+vMeta.x*113.0,-meadowClock*.75);
          vec2 warp=vec2(cloudDensity(wUV+vec2(31.0,53.0)),cloudDensity(wUV+vec2(-47.0,19.0)))-.48;
          // Multi-scale FBM: nMacro creates localized cloud islands & clear gaps around the 360 horizon; nBillow & nWisp sculpt cumulus lobes.
          float nMacro=cloudDensity(wUV*.52+warp*95.0);
          float nBillow=cloudDensity(wUV*1.45-warp*60.0+vec2(vWorld.y*2.4,0.0));
          float nWisp=cloudDensity(wUV*3.4+vec2(0.0,vWorld.y*5.2));
          float fbm=nMacro*.50+nBillow*.34+nWisp*.16;
          // Undulating cumulus top & bottom contours inside the safe envelope
          float yNorm=vUv.y*2.0-1.0;
          float billowShape=smoothstep(-.82,-.12,yNorm+(nBillow-.46)*.55)*(1.0-smoothstep(.08,.82,yNorm-(fbm-.46)*.75));
          float shape=edgeFade*billowShape;
          // Localized islands of varying thickness: some sectors are clear (density=0), others have wispy mist or thick opaque cloud cores.
          float thresh=mix(.26,.46,meadowSky.x*(1.0-meadowSky.z));
          float raw=fbm*shape*1.65;
          float density=smoothstep(thresh,thresh+.34,raw);
          if(density<.008)discard;
          // 3D volumetric internal billow shading: bright silver/warm upper rim, deep slate-blue self-shadowed belly.
          float topGrad=clamp((yNorm+.38)*.72+(nBillow-.46)*.60-(nWisp-.48)*.22,0.0,1.0);
          float sunFacing=.5+.5*dot(normalize(vec3(vWorld.x,0.0,vWorld.z)),meadowSun);
          vec3 bellyCol=mix(vec3(.24,.31,.40),vec3(.38,.46,.54),meadowSky.x)*(1.0-.72*meadowStorm.y);
          vec3 topCol=mix(vec3(.80,.85,.90),mix(vec3(.96,.95,.90),vec3(1.0,.76,.48),meadowSky.y),meadowSky.x*.75+.25);
          topCol+=vec3(.16,.13,.08)*sunFacing*topGrad*(.4+.6*meadowSky.x);
          float coreThick=smoothstep(.35,.90,density);
          vec3 cloudCol=mix(bellyCol,topCol,smoothstep(.12,.84,topGrad*(1.0-coreThick*.24)));
          float weatherVis=mix(.95,.42,meadowSky.x)*(1.0-meadowSky.y*.22);
          float alpha=clamp(pow(density,1.15)*weatherVis*vMeta.y,0.0,.94);
          gl_FragColor=vec4(cloudCol,alpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    // 3 concentric 360-degree undulating cloud rings:
    // Ring 0 (r=132m, y=8..44m): in front of & intersecting the near mountain ridges (166m)
    // Ring 1 (r=194m, y=20..68m): right between the near ridges (166m) and far snow peaks (290m)
    // Ring 2 (r=252m, y=34..96m): wrapping around the mid-upper waist of the far snow peaks (290m)
    const rings=[
      [132,8,44,.86,0.17],
      [194,20,68,.94,0.53],
      [252,34,96,.96,0.89]
    ];
    const positions=[],uvs=[],metas=[],indices=[];
    let vOffset=0;
    const cols=144,rows=8;
    rings.forEach(([baseR,yMin,yMax,op,seed])=>{
      for(let iy=0;iy<=rows;iy++){
        const ty=iy/rows;
        for(let ix=0;ix<=cols;ix++){
          const tx=ix/cols,a=(tx-.5)*Math.PI*2;
          const waveR=baseR+14*Math.sin(a*3+seed*6.28)+9*Math.cos(a*5-seed*4.1);
          const waveY=lerp(yMin,yMax,ty)+6*Math.sin(a*4+seed*5.1)+4*Math.cos(a*7-ty*2.2);
          positions.push(Math.sin(a)*waveR,waveY,COURT.midZ-Math.cos(a)*waveR);
          uvs.push(tx,ty);
          metas.push(seed,op);
          if(iy<rows&&ix<cols){
            const k=vOffset+iy*(cols+1)+ix;
            indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
          }
        }
      }
      vOffset+=(cols+1)*(rows+1);
    });
    const geo=new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    geo.setAttribute("ringMeta",new THREE.Float32BufferAttribute(metas,2));
    const mesh=new THREE.Mesh(geo,mat);
    mesh.name="alpineOrographicClouds";mesh.frustumCulled=false;mesh.renderOrder=1;
    s.root.add(mesh);
    return mesh;
  }

  function build(s){
    const uniforms={meadowClouds:{value:cloudMap()},meadowSky:{value:new THREE.Vector4()},
      meadowAir:{value:new THREE.Vector4()},meadowStorm:{value:new THREE.Vector2()},meadowSun:{value:new THREE.Vector3()},meadowOpening:{value:new THREE.Vector2()},
      meadowActors:{value:new THREE.Vector4(999,999,999,999)},meadowBall:{value:new THREE.Vector4(999,999,999,999)},
      meadowClock:{value:0},meadowWind:{value:0}};
    const w={uniforms,progress:0,progressVel:0,sunProgress:0,sunProgressVel:0,flowerProgress:0,score:0,stage:"cloudy",wind:uniforms.meadowWind,
      wetness:0,ballWetness:0,previousRain:0,
      sunColor:new THREE.Color(0xffe7c5),skyColor:new THREE.Color(0xc1c9d5),wetColor:new THREE.Color(0xa5baca),
      warmColor:new THREE.Color(0xffb06b),coolFog:new THREE.Color(0x879eab),clearingFog:new THREE.Color(0x9aafb7),
      time:uniforms.meadowClock,stormAt:null,thunderAt:null,thunderOpts:null,nextStrike:0,nextStrikeAt:null,
      flashAt:-100,strikePower:1.2,strikeDur:0.32,strikePulses:1};
    w.airMaterial=airPass(w);
    buildSky(s,w);
    w.mountainClouds=buildMountainClouds(s,w);
    w.fallback=buildFallback(s,w);
    w.rain=buildRain(s,w);w.bolt=buildLightning(s,w);
    return w;
  }

  function strikeHash(n,salt){
    const v=Math.sin(n*127.1+salt*311.7)*43758.5453123;
    return v-Math.floor(v);
  }

  function reset(w){
    w.score=w.progress=w.progressVel=w.sunProgress=w.sunProgressVel=w.flowerProgress=0;
    w.wetness=w.ballWetness=w.previousRain=0;
    if(w.court)AIBAMeadowCourt.reset(w.court);
    w.stormAt=w.thunderAt=w.thunderOpts=w.nextStrikeAt=null;
    w.nextStrike=0;w.flashAt=-100;w.strikePower=1.2;w.strikeDur=0.32;w.strikePulses=1;
  }

  function update(w,time,dt){
    const score=w.score,step=Math.max(0,dt);
    // Critically damped spring (SmoothDamp) gives atmospheric inertia without staircase jumps per basket.
    const isBattle=typeof G!=="undefined"&&!!G&&G.mode==="battle";
    w.progress=smoothDamp(w.progress,score,w,"progressVel",isBattle?6.2:3.6,isBattle?.020:.036,step);
    w.sunProgress=smoothDamp(w.sunProgress,score,w,"sunProgressVel",isBattle?8.5:4.8,isBattle?.015:.028,step);
    const p=w.progress;
    const rain=curve(p,.17,.24)*lerp(.42,1,curve(p,.33,.43))*(1-curve(p,.525,.635));
    const clear=curve(p,.53,.795),gold=curve(p,.767,.907);
    // Water collects with rainfall, then drains with time even at a fixed score.
    const fall=lerp(w.previousRain,rain,.5);
    const evaporation=(.056+.12*clear)*(1-fall);
    w.wetness=clamp(w.wetness+step*(fall*.35*(1-w.wetness)-evaporation*w.wetness),0,1);
    w.ballWetness=lerp(w.ballWetness,Math.max(rain,w.wetness*.71),1-Math.exp(-step*(rain>.03?1.45:.55)));
    w.previousRain=rain;
    const wet=w.wetness;
    const wind=(.23+.69*rain+.15*clear)*(.84+.18*Math.sin(time*1.55)+.10*Math.sin(time*.63-2));
    const beams=curve(p,.53,.637)*(1-.68*curve(p,.72,.93));
    const rainbow=curve(p,.575,.654)*(1-curve(p,.735,.838));
    const mist=lerp(.77+.32*rain,.29,clear);
    const bank=1-curve(p,.48,.78);
    const u=w.uniforms;
    w.time.value=time;w.wind.value=wind;
    let anticipation=0;
    // Extended thunderstorm phase (p ∈ [0.22, 0.64]) with irregular intervals, varied intensities, durations & multi-flicker restrikes.
    if(p>=.22&&p<.64){
      if(w.stormAt===null){
        w.stormAt=time;
        w.nextStrikeAt=time+.75+strikeHash(w.nextStrike+1,1.3)*1.65;
      }
      const strikeAt=w.nextStrikeAt;
      anticipation=curve(time,strikeAt-.48,strikeAt-.14)*Math.min(1,w.strikePower*.72);
      if(time>=strikeAt){
        const idx=++w.nextStrike;
        const hGap=strikeHash(idx,2.1),hPow=strikeHash(idx,4.7),hDur=strikeHash(idx,7.3);
        const hPos=strikeHash(idx,11.9),hDist=strikeHash(idx,15.1),hPulse=strikeHash(idx,19.7);
        const peakStorm=1-Math.min(1,Math.abs(p-.42)/.24);
        w.flashAt=time;
        w.strikePower=lerp(.62,1.95,Math.pow(hPow,.82))*(.78+.28*peakStorm);
        w.strikeDur=lerp(.15,.78,Math.pow(hDur,1.15));
        w.strikePulses=hPulse>.66?3:(hPulse>.28?2:1);
        const dist=lerp(.12,1.0,hDist);
        const boltX=lerp(-52,48,hPos);
        w.bolt.position.set(boltX,lerp(8.5,16.5,strikeHash(idx,23.3)),-128);
        w.bolt.scale.set((hPos>.5?1:-1)*lerp(.72,1.34,hPow),lerp(.78,1.28,hDur),1);
        w.thunderAt=time+lerp(.30,2.25,dist);
        w.thunderOpts={power:w.strikePower,distance:dist,pan:clamp(boltX/56,-.78,.78)};
        // Irregular gap: 2.6s..8.4s (more active at storm peak, occasional rapid follow-up)
        const minGap=lerp(3.6,2.4,peakStorm),maxGap=lerp(8.8,6.2,peakStorm);
        w.nextStrikeAt=time+lerp(minGap,maxGap,Math.pow(hGap,1.1));
      }
    }else{
      w.stormAt=null;w.nextStrikeAt=null;
    }
    if(w.thunderAt!==null&&time>=w.thunderAt){
      const opts=w.thunderOpts;
      w.thunderAt=null;w.thunderOpts=null;
      if(typeof playMeadowThunder==="function")playMeadowThunder(opts);
    }
    const age=time-w.flashAt,dur=w.strikeDur||.32,pow=w.strikePower||1.2;
    let env=0;
    if(age>=0&&age<dur*1.35){
      const uAge=age/dur;
      const primary=(1-curve(uAge,.08,.78))*Math.exp(-uAge*1.35);
      const restrike2=w.strikePulses>=2?Math.exp(-Math.pow((uAge-.42)/.11,2))*.88:0;
      const restrike3=w.strikePulses>=3?Math.exp(-Math.pow((uAge-.76)/.13,2))*.64:0;
      env=clamp(primary+restrike2+restrike3,0,1.25);
    }
    const blackout=Math.max(anticipation,(1-curve(age,.10,dur*1.85+.35))*.92*Math.min(1,pow*.75));
    const flash=env*pow;
    u.meadowSky.value.set(clear,gold,rain,wet);
    u.meadowAir.value.set(mist,beams,rainbow,flash);
    u.meadowStorm.value.set(bank,blackout);
    moveSun(w,w.sunProgress);
    const sweep=curve(w.sunProgress,.53,.745);
    u.meadowOpening.value.set(lerp(-42,15,sweep)+Math.sin(time*.26)*2.8,lerp(-63,-24,sweep));
    w.rain.visible=rain>.018;w.bolt.visible=flash>.035;
    w.stage=stages.find(([cut])=>score>=cut)[1];
    return {rain,clear,gold,flash,blackout};
  }

  global.AIBAMeadowWeather=Object.freeze({build,reset,update,cloudGLSL,skyGLSL});
})(window);
