/* Score-driven weather for the alpine meadow. All meshes and textures belong to the place root. */
(function(global){
  "use strict";
  const {smoothstep:curve,lerp,degToRad}=THREE.MathUtils;
  const stages=[[.93,"golden-peaks"],[.8,"rainbow"],[.65,"cloudbreak"],[.4,"wind-rain"],[.2,"light-rain"],[0,"cloudy"]];

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
    uniform vec3 meadowSun;
    uniform vec2 meadowOpening;
    uniform float meadowClock;
    vec2 cloudUV(vec2 p){return p/620.0+vec2(meadowClock*.0028,-meadowClock*.0012);}
    float cloudDensity(vec2 p){return texture2D(meadowClouds,cloudUV(p)).r;}
    float cloudEdge(){return .29+meadowSky.x*.28-meadowSky.z*.09;}
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
      fragmentShader:cloudGLSL+`
        varying vec3 vRay;
        void main(){
          vec3 ray=normalize(vRay);
          float up=max(0.0,ray.y),haze=pow(1.0-up,4.2);
          vec2 skyAt=ray.xz*(135.0/(.33+up))+cameraPosition.xz*.45;
          vec2 warp=vec2(cloudDensity(skyAt*1.3+vec2(69.0,31.0)),
            cloudDensity(skyAt*1.4+vec2(-51.0,74.0)))-.48;
          skyAt+=warp*42.0;
          float details=cloudDensity(skyAt*2.83+vec2(207.0,108.0));
          float a=cloudDensity(skyAt)*.81+details*.19;
          float litEdge=cloudDensity(skyAt+vec2(-24.0,13.0));
          float edge=cloudEdge();
          float cloud=max(smoothstep(edge-.057,edge+.10,a),(.94-meadowSky.x*.92)*smoothstep(-.09,.08,up));
          if(meadowAir.y>.015&&ray.y>.04){
            vec3 atCloud=cameraPosition+ray*((62.0-cameraPosition.y)/ray.y);
            cloud*=1.0-sunWindow(atCloud,.25)*meadowAir.y*.76;
          }
          float sunSide=pow(max(0.0,dot(ray,meadowSun)),11.0);
          vec3 day=mix(vec3(.075,.205,.36),vec3(.33,.48,.58),haze);
          vec3 dusk=mix(vec3(.025,.075,.100),vec3(.16,.25,.28),haze);
          vec3 sky=mix(day,dusk,meadowSky.w*.14+meadowSky.y*.76);
          sky=mix(sky,vec3(.60,.39,.21),sunSide*meadowSky.x*.48);
          float roll=smoothstep(.16,.73,a+(a-litEdge)*.71);
          vec3 storm=mix(vec3(.103,.139,.186),vec3(.47,.50,.53),roll);
          storm*=1.04-meadowSky.z*.36;
          vec3 open=mix(vec3(.23,.295,.36),vec3(.72,.68,.58),roll);
          open=mix(open,vec3(.63,.39,.22),sunSide*meadowSky.y*.48);
          vec3 col=mix(sky,mix(storm,open,meadowSky.x),cloud);
          float flash=pow(max(0.0,dot(ray,normalize(vec3(-.44,.20,-.91)))),13.0);
          col+=vec3(.54,.66,.88)*meadowAir.w*flash*.54;
          // A primary bow is an angular band centred on the anti-solar direction.
          float angle=acos(clamp(dot(ray,-meadowSun),-1.0,1.0));
          float band=smoothstep(.706,.716,angle)*(1.0-smoothstep(.746,.759,angle));
          vec3 bow=vec3(exp(-pow((angle-.746)*77.0,2.0)),
            exp(-pow((angle-.730)*79.0,2.0)),exp(-pow((angle-.712)*73.0,2.0)));
          col=mix(col,bow*.76+vec3(.20,.21,.26),band*meadowAir.z*smoothstep(-.012,.08,ray.y)*.47);
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
          vec3 cool=mix(vec3(.52,.60,.67),vec3(.46,.57,.65),meadowSky.y);
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
          vec3 cool=vec3(.27,.34,.41),warm=mix(vec3(.83,.66,.42),vec3(.94,.52,.22),meadowSky.y);
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
    for(let i=0;i<(s.mobile?445:1080);i++)d.push((random()-.5)*61,COURT.midZ+(random()-.5)*64,random(),random());
    const geo=new THREE.InstancedBufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,1,0],3));
    geo.setIndex([0,1,2,1,3,2]);
    geo.setAttribute("drop",new THREE.InstancedBufferAttribute(new Float32Array(d),4));
    geo.instanceCount=d.length/4;
    const mat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:w.uniforms,
      vertexShader:`
        attribute vec4 drop; uniform vec4 meadowSky; uniform float meadowClock,meadowWind;
        varying float alpha; varying vec2 streak;
        void main(){
          float height=17.0-mod(drop.w*17.0+meadowClock*(10.0+drop.z*5.0),17.0);
          vec2 slant=vec2(mix(.08,.34,meadowWind),.065);
          vec3 p=vec3(drop.x+slant.x*(17.0-height),height,drop.y+slant.y*(17.0-height));
          p.y-=position.y*(.28+drop.z*.75);
          p.xz+=position.y*slant*.69;
          float d=length(p-cameraPosition);
          alpha=smoothstep(.40,3.0,d)*(1.0-smoothstep(25.0,46.0,d))*smoothstep(.2,1.5,height)
            *step(drop.z,meadowSky.z)*mix(.40,.84,drop.w)*smoothstep(.015,.35,meadowSky.z);
          vec4 v=viewMatrix*vec4(p,1.0);
          v.x+=position.x*(.009+drop.w*.024)*(1.0+meadowSky.z*.34);
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

  function build(s){
    const uniforms={meadowClouds:{value:cloudMap()},meadowSky:{value:new THREE.Vector4()},
      meadowAir:{value:new THREE.Vector4()},meadowSun:{value:new THREE.Vector3()},meadowOpening:{value:new THREE.Vector2()},
      meadowClock:{value:0},meadowWind:{value:0}};
    const w={uniforms,progress:0,flowerProgress:0,score:0,stage:"cloudy",wind:uniforms.meadowWind,
      openAzimuth:s.mobile?-27:-42,
      sunColor:new THREE.Color(0xf0dfcb),skyColor:new THREE.Color(0xc1c9d5),wetColor:new THREE.Color(0xa5baca),
      warmColor:new THREE.Color(0xffc181),coolFog:new THREE.Color(0x879eab),clearingFog:new THREE.Color(0x9aafb7),
      time:uniforms.meadowClock,stormAt:null,thunderAt:null,nextStrike:0,flashAt:-100};
    w.airMaterial=airPass(w);
    buildSky(s,w);
    w.fallback=buildFallback(s,w);
    w.rain=buildRain(s,w);
    return w;
  }

  function reset(w){
    w.score=w.progress=w.flowerProgress=0;
    w.stormAt=w.thunderAt=null;w.nextStrike=0;w.flashAt=-100;
  }

  function update(w,time,dt){
    const score=w.score,rate=1-Math.exp(-Math.max(0,dt)*2.45);
    w.progress=lerp(w.progress,score,rate);
    const p=w.progress;
    const rain=curve(p,.195,.27)*lerp(.41,1,curve(p,.38,.49))*(1-curve(p,.65,.735));
    const clear=curve(p,.643,.832),gold=.24*curve(p,.92,.98)+.76*curve(p,.979,1);
    const wet=curve(p,.20,.53)*(1-.54*curve(p,.775,.999));
    const wind=(.23+.59*rain+.13*clear)*(.82+.18*Math.sin(time*1.55)+.10*Math.sin(time*.63-2));
    const beams=curve(p,.645,.745)*(1-.64*curve(p,.86,.999));
    const rainbow=curve(p,.79,.83)*(1-curve(p,.90,.949));
    const mist=lerp(.63+.33*rain,.27,clear);
    const u=w.uniforms;
    w.time.value=time;w.wind.value=wind;
    if(score>=.4&&score<.65){
      if(w.stormAt===null)w.stormAt=time;
      if(time>=w.stormAt+.58+w.nextStrike*10.3){
        w.flashAt=time;w.thunderAt=time+1.2;w.nextStrike++;
      }
    }else w.stormAt=null;
    if(w.thunderAt!==null&&time>=w.thunderAt){
      w.thunderAt=null;
      if(typeof playMeadowThunder==="function")playMeadowThunder();
    }
    const flashAge=time-w.flashAt;
    const flash=(1-curve(flashAge,.015,.21))*.6+curve(flashAge,.16,.23)*(1-curve(flashAge,.24,.45))*.23;
    u.meadowSky.value.set(clear,gold,rain,wet);u.meadowAir.value.set(mist,beams,rainbow,flash);
    const elevation=degToRad(lerp(14.0+5.8*curve(p,.65,.755),6.5,gold)),angle=degToRad(lerp(-58,w.openAzimuth,clear));
    u.meadowSun.value.set(Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(angle)*Math.cos(elevation));
    const sweep=curve(p,.642,.86);
    u.meadowOpening.value.set(lerp(-42,15,sweep)+Math.sin(time*.26)*2.8,lerp(-63,-24,sweep));
    w.rain.visible=rain>.018;
    w.stage=stages.find(([cut])=>score>=cut)[1];
    return {rain,clear,gold,flash};
  }

  global.AIBAMeadowWeather=Object.freeze({build,reset,update,cloudGLSL});
})(window);
