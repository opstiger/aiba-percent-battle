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
      float cloud=max(smoothstep(edge-.057,edge+.10,a),(.94-meadowSky.x*.92)*smoothstep(-.09,.08,up));
      if(meadowAir.y>.015&&ray.y>.04){
        vec3 atCloud=eye+ray*((62.0-eye.y)/ray.y);
        cloud*=1.0-sunWindow(atCloud,.25)*meadowAir.y*.76;
      }
      float sunCos=max(0.0,dot(ray,meadowSun));
      float sunSide=pow(sunCos,11.0);
      float mieHalo=pow(sunCos,6.0)*.24+pow(sunCos,48.0)*.42;
      float sunDisc=smoothstep(.9986,.9996,sunCos);
      vec3 day=mix(vec3(.075,.205,.36),vec3(.33,.48,.58),haze);
      vec3 dusk=mix(vec3(.025,.075,.100),vec3(.16,.25,.28),haze);
      vec3 sky=mix(day,dusk,meadowSky.w*.14+meadowSky.y*.76);
      sky=mix(sky,vec3(.60,.39,.21),sunSide*meadowSky.x*.48);
      vec3 sunGlowCol=mix(vec3(1.0,.90,.72),vec3(1.0,.66,.34),meadowSky.y);
      sky+=sunGlowCol*(mieHalo*.34+sunDisc*.85)*meadowSky.x*(1.0-cloud*.72);
      float roll=smoothstep(.16,.73,a+(a-litEdge)*.71);
      vec3 storm=mix(vec3(.103,.139,.186),vec3(.47,.50,.53),roll);
      storm*=1.04-meadowSky.z*.36;
      vec3 open=mix(vec3(.23,.295,.36),vec3(.72,.68,.58),roll);
      open=mix(open,vec3(.63,.39,.22),sunSide*meadowSky.y*.48);
      vec3 col=mix(sky,mix(storm,open,meadowSky.x),cloud);
      col+=sunGlowCol*pow(sunCos,18.0)*cloud*(1.0-roll)*.22*meadowSky.x;
      float flash=pow(max(0.0,dot(ray,normalize(vec3(-.44,.20,-.91)))),13.0);
      float bank=0.0;
      for(int i=0;i<3;i++){
        float stepDistance=112.0+float(i)*87.0;
        vec3 p=eye+ray*stepDistance;
        float billow=cloudDensity(p.xz*.87+vec2(float(i)*91.0,p.y*3.3));
        float height=1.0-smoothstep(42.0,153.0,p.y+27.0*(billow-.45));
        bank+=height*(.48+.52*billow);
      }
      float veil=(1.0-exp(-bank*meadowStorm.x*1.73))*.92;
      col=mix(col,mix(vec3(.25,.325,.41),vec3(.53,.57,.60),a),veil);
      col=mix(col,col*vec3(.075,.103,.185)+vec3(.006,.010,.025),meadowStorm.y*.91);
      col+=vec3(.58,.70,.98)*meadowAir.w*flash*.81;
      // A primary bow is an angular band centred on the anti-solar direction.
      if(meadowAir.z>.003){
        float angle=acos(clamp(dot(ray,-meadowSun),-1.0,1.0));
        float band=exp(-pow((angle-.728)*57.0,2.0));
        // Uneven rain and passing low cloud hide parts of the arc.
        float tail=cloudDensity(ray.xz*530.0+vec2(ray.y*930.0,46.0));
        float rainVeil=smoothstep(.401,.535,tail)*(1.0-.86*smoothstep(.56,.86,cloud));
        vec3 spectrum=vec3(exp(-pow((angle-.739)*111.0,2.0)),
          exp(-pow((angle-.726)*151.0,2.0)),exp(-pow((angle-.713)*112.0,2.0)));
        float strength=rainVeil*band*meadowAir.z*smoothstep(.002,.072,ray.y);
        col+=strength*(vec3(.032,.034,.037)+spectrum*vec3(.065,.042,.058));
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
          float end=min(196.0,viewDepth/max(.13,-view.z));
          float stepSize=max(0.0,end-15.0)/7.0;
          float mist=0.0,beam=0.0;
          for(int i=0;i<7;i++){
            vec3 p=eye+ray*(15.0+(float(i)+.54)*stepSize);
            float dist=length(p.xz-vec2(0.0,4.745));
            float field=smoothstep(24.0,55.0,dist)*(1.0-smoothstep(144.0,198.0,dist));
            float stratum=exp(-pow((p.y-4.1-1.7*sin(p.x*.035+p.z*.033))*.105,2.0));
            float pockets=.44+.56*cloudDensity(p.xz*2.7+vec2(meadowClock*2.0,33.0));
            mist+=field*stratum*pockets;
            float air=exp(-abs(p.y-16.0)*.029)*field*smoothstep(-1.0,4.0,p.y);
            if(meadowAir.y>.01)beam+=air*sunWindow(p,.17);
          }
          float veil=1.0-exp(-stepSize*mist*meadowAir.x*.012);
          float light=1.0-exp(-stepSize*beam*meadowAir.y*.029);
          if(meadowAir.y>.01){
            float throughGap=shaft(beamFromA,beamToA,.047,viewDepth)+.66*shaft(beamFromB,beamToB,.037,viewDepth);
            light=min(1.0,light+throughGap*meadowAir.y*(.52-.32*meadowSky.y)*(1.0-.54*meadowAir.z));
          }
          vec3 cool=mix(vec3(.52,.60,.67),vec3(.46,.57,.65),meadowSky.y)*(1.0-.75*meadowStorm.y);
          vec3 warm=mix(vec3(1.0,.91,.72),vec3(1.0,.75,.44),meadowSky.y);
          float opacity=min(.71,veil+light*.82);
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

  function build(s){
    const uniforms={meadowClouds:{value:cloudMap()},meadowSky:{value:new THREE.Vector4()},
      meadowAir:{value:new THREE.Vector4()},meadowStorm:{value:new THREE.Vector2()},meadowSun:{value:new THREE.Vector3()},meadowOpening:{value:new THREE.Vector2()},
      meadowClock:{value:0},meadowWind:{value:0}};
    const w={uniforms,progress:0,progressVel:0,sunProgress:0,sunProgressVel:0,flowerProgress:0,score:0,stage:"cloudy",wind:uniforms.meadowWind,
      wetness:0,ballWetness:0,previousRain:0,
      sunColor:new THREE.Color(0xffe7c5),skyColor:new THREE.Color(0xc1c9d5),wetColor:new THREE.Color(0xa5baca),
      warmColor:new THREE.Color(0xffb06b),coolFog:new THREE.Color(0x879eab),clearingFog:new THREE.Color(0x9aafb7),
      time:uniforms.meadowClock,stormAt:null,thunderAt:null,nextStrike:0,flashAt:-100};
    w.airMaterial=airPass(w);
    buildSky(s,w);
    w.fallback=buildFallback(s,w);
    w.rain=buildRain(s,w);w.bolt=buildLightning(s,w);
    return w;
  }

  function reset(w){
    w.score=w.progress=w.progressVel=w.sunProgress=w.sunProgressVel=w.flowerProgress=0;
    w.wetness=w.ballWetness=w.previousRain=0;
    if(w.court)AIBAMeadowCourt.reset(w.court);
    w.stormAt=w.thunderAt=null;w.nextStrike=0;w.flashAt=-100;
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
    if(p>=.366&&p<.573){
      if(w.stormAt===null)w.stormAt=time;
      const strikeAt=w.stormAt+1.0+w.nextStrike*10.3;
      anticipation=curve(time,strikeAt-.53,strikeAt-.20);
      if(time>=strikeAt){
        w.flashAt=time;w.thunderAt=time+1.12;w.nextStrike++;
        w.bolt.position.x=w.nextStrike%2===1?14:-20;
      }
    }else w.stormAt=null;
    if(w.thunderAt!==null&&time>=w.thunderAt){
      w.thunderAt=null;
      if(typeof playMeadowThunder==="function")playMeadowThunder();
    }
    const age=time-w.flashAt;
    const blackout=Math.max(anticipation,(1-curve(age,.12,.91))*.94);
    const flash=(1-curve(age,.045,.31))*1.32;
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
