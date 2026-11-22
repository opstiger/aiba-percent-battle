/* ---------------- 完美出手尾迹：彗星 + 彩色星星 ----------------
   原来的火焰是每帧在球心丢一个纯橙色方块点（effects.js 的 emitFire / firePts），
   没有粗细、没有渐变、没有发光，看起来是一串橙色像素块。这里换成：
     彗星尾  朝向镜头的飘带，头部和球一样粗、往后收成细尖尾；
             颜色 白热核心 → 金 → 橙 → 玫红 → 紫，加法混合、边缘柔和
     星星    沿途洒出四角星（金 / 白 / 青 / 粉 / 淡紫），闪烁着飘散、缩小
     热手    连中档位越高彗星越粗越长、星星越多；ON FIRE（3 档）尾巴变彩虹
   接口不变：shots.js 仍每帧调 emitFire(球心)，game-loop 仍调 updFire(dt)，
   这里只替换这两个全局函数的实现。标记 __aibaHotHand，热手模块不再往里补随机点。
   画质设置关掉 firePts 时这里一起隐藏。 */
(function(global){
  "use strict";
  if(typeof THREE==="undefined"||typeof scene==="undefined")return;
  const T=THREE;
  const MAX_PTS=90,TRAIL_AGE=.6,IDLE_END=.09;
  const hotLevel=()=>{try{return global.AIBAHotHand?global.AIBAHotHand.level():0;}catch(e){return 0;}};
  /* 用游戏时钟（updFire 按 dt 累加），不用墙钟：暂停时尾迹定住，掉帧时粗细也不乱 */
  let clock=0;const now=()=>clock;

  /* ---------- 彗星尾：柔和低亮度的渐隐飘带（头尾双向平滑收尖，绝不硬切） ---------- */
  const trailMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{uRainbow:{value:0},uFirefly:{value:0},uTime:{value:0}},
    vertexShader:`attribute float aT;attribute float aSide;attribute float aFade;varying float vT;varying float vSide;varying float vFade;
      void main(){vT=aT;vSide=aSide;vFade=aFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uRainbow,uFirefly,uTime;varying float vT;varying float vSide;varying float vFade;
      vec3 ramp(float t){
        vec3 c0=vec3(1.,.94,.76),c1=vec3(1.,.76,.34),c2=vec3(1.,.48,.22),c3=vec3(.96,.32,.58),c4=vec3(.48,.42,1.);
        if(t<.12)return mix(c0,c1,t/.12);if(t<.36)return mix(c1,c2,(t-.12)/.24);
        if(t<.68)return mix(c2,c3,(t-.36)/.32);return mix(c3,c4,(t-.68)/.32);}
      vec3 fireflyRamp(float t){
        vec3 f0=vec3(1.,1.,.84),f1=vec3(.88,1.,.36),f2=vec3(.46,.92,.28),f3=vec3(.14,.52,.22);
        if(t<.18)return mix(f0,f1,t/.18);if(t<.55)return mix(f1,f2,(t-.18)/.37);
        return mix(f2,f3,(t-.55)/.45);
      }
      vec3 rainbow(float t){return .55+.45*cos(6.2832*(t*1.3-uTime*.9+vec3(0.,.33,.67)));}
      void main(){
        float edge=1.-vSide*vSide;edge=edge*edge*edge;             // 横向更柔和
        float headIn=smoothstep(0.,.14,vT);                        // 头部渐入，避免平头硬切
        float tailOut=pow(1.-vT,1.85);                             // 尾部平滑渐隐
        vec3 cometCol=mix(ramp(vT),rainbow(vT),uRainbow*smoothstep(.08,.35,vT));
        float ffWave=.82+.18*sin(vT*18.-uTime*6.5);
        vec3 c=mix(cometCol,fireflyRamp(vT)*ffWave,uFirefly);
        float a=clamp(headIn*tailOut*edge*mix(.46,.54,uFirefly),0.,1.)*vFade;
        gl_FragColor=vec4(c*a*mix(.85,1.05,uFirefly),a);}`
  });
  const trails=[];
  function makeTrail(p){
    const g=new T.BufferGeometry(),n=MAX_PTS*2;
    g.setAttribute("position",new T.BufferAttribute(new Float32Array(n*3),3));
    g.setAttribute("aT",new T.BufferAttribute(new Float32Array(n),1));
    g.setAttribute("aSide",new T.BufferAttribute(new Float32Array(n),1));
    g.setAttribute("aFade",new T.BufferAttribute(new Float32Array(n),1));
    const idx=[];for(let i=0;i<MAX_PTS-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
    g.setIndex(idx);g.setDrawRange(0,0);
    const mesh=new T.Mesh(g,trailMat);mesh.frustumCulled=false;mesh.renderOrder=20;scene.add(mesh);
    const tr={mesh,pts:[],last:now(),ended:false,fade:1,level:hotLevel(),starAcc:0};
    trails.push(tr);return tr;
  }
  const _cam=new T.Vector3(),_tan=new T.Vector3(),_side=new T.Vector3(),_to=new T.Vector3();
  function rebuild(tr,t){
    const g=tr.mesh.geometry,P=g.attributes.position.array,A=g.attributes.aT.array,S=g.attributes.aSide.array,F=g.attributes.aFade.array;
    const pts=tr.pts,n=pts.length;if(n<2){g.setDrawRange(0,0);return;}
    const lvl=tr.level,age=TRAIL_AGE*(1+.18*lvl),W=.13*(1+.12*lvl);
    if(typeof camera!=="undefined")camera.getWorldPosition(_cam);
    for(let i=0;i<n;i++){
      const p=pts[n-1-i],u=i/(n-1),k=Math.max(u,Math.min(1,(t-p.t)/age)); // 0=球头，1=尾尖（无论轨迹多短尾尖必收成 0）
      const a=pts[Math.max(0,n-2-i)],b=pts[Math.min(n-1,n-i)];
      _tan.set(b.x-a.x,b.y-a.y,b.z-a.z);if(_tan.lengthSq()<1e-8)_tan.set(0,1,0);_tan.normalize();
      _to.set(_cam.x-p.x,_cam.y-p.y,_cam.z-p.z).normalize();
      _side.crossVectors(_tan,_to);if(_side.lengthSq()<1e-8)_side.set(1,0,0);_side.normalize();
      const headTaper=u<.12?u/.12:1;
      const w=W*Math.pow(1-k,1.6)*(.25+.75*headTaper);
      for(const sd of [-1,1]){const j=(i*2+(sd>0?1:0));
        P[j*3]=p.x+_side.x*w*sd;P[j*3+1]=p.y+_side.y*w*sd;P[j*3+2]=p.z+_side.z*w*sd;
        A[j]=k;S[j]=sd;F[j]=tr.fade;}
    }
    for(const a of ["position","aT","aSide","aFade"])g.attributes[a].needsUpdate=true;
    g.setDrawRange(0,(n-1)*6);
  }

  /* ---------- 五角星颗粒：分散、大小错落、柔和闪烁 ---------- */
  const STAR_N=160;
  const sPos=new Float32Array(STAR_N*3),sCol=new Float32Array(STAR_N*3),sSize=new Float32Array(STAR_N),sLife=new Float32Array(STAR_N),
    sMax=new Float32Array(STAR_N),sSeed=new Float32Array(STAR_N),sVel=new Float32Array(STAR_N*3);
  const starGeo=new T.BufferGeometry();
  starGeo.setAttribute("position",new T.BufferAttribute(sPos,3));
  starGeo.setAttribute("aCol",new T.BufferAttribute(sCol,3));
  starGeo.setAttribute("aSize",new T.BufferAttribute(sSize,1));
  starGeo.setAttribute("aSeed",new T.BufferAttribute(sSeed,1));
  const starMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uScale:{value:600},uFirefly:{value:0},uTime:{value:0}},
    vertexShader:`attribute vec3 aCol;attribute float aSize;attribute float aSeed;uniform float uScale;varying vec3 vCol;varying float vSeed;varying float vA;
      void main(){vCol=aCol;vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);vA=step(.0001,aSize);
        gl_PointSize=aSize*uScale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uTime,uFirefly;varying vec3 vCol;varying float vSeed;varying float vA;
      float sdStar5(vec2 p,float r,float rf){
        const vec2 k1=vec2(.809016994375,-.587785252292);
        const vec2 k2=vec2(-k1.x,k1.y);
        p.x=abs(p.x);
        p-=2.*max(dot(k1,p),0.)*k1;
        p-=2.*max(dot(k2,p),0.)*k2;
        p.x=abs(p.x);p.y-=r;
        vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0.,1.);
        float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);
        return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);
      }
      void main(){if(vA<.5)discard;
        vec2 d=gl_PointCoord-.5;
        float r2=dot(d,d);
        float rot=vSeed*6.2832+uTime*2.1*(fract(vSeed*7.)-.5);
        float cs=cos(rot),sn=sin(rot);vec2 dr=vec2(cs*d.x-sn*d.y,sn*d.x+cs*d.y);
        float sd=sdStar5(dr,.42,.44);
        float starShape=smoothstep(.035,-.025,sd);
        float halo=exp(-r2*22.)*.28;
        float tw=.72+.28*sin(uTime*12.+vSeed*40.);
        float starA=clamp((starShape*.82+halo)*tw,0.,1.);
        vec3 starC=mix(vCol,vec3(1.),starShape*.25);
        // 深夜萤火虫尾迹粒子：柔和双层生物发光圆球 + 呼吸闪烁
        float ffCore=exp(-r2*48.);
        float ffHalo=exp(-r2*12.)*.62;
        float ffPulse=.48+.52*sin(uTime*(5.5+fract(vSeed*9.)*4.)+vSeed*37.);
        float ffA=clamp((ffCore+ffHalo)*ffPulse,0.,1.);
        vec3 ffC=mix(mix(vec3(.78,1.,.28),vec3(1.,.90,.36),fract(vSeed*5.3)),vec3(1.,1.,.88),ffCore*.72);
        float a=mix(starA,ffA,uFirefly);
        if(a<.02)discard;
        vec3 c=mix(starC,ffC,uFirefly);
        gl_FragColor=vec4(c*a*mix(1.,1.2,uFirefly),a);}`
  });
  const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=21;scene.add(stars);
  const PALETTE=[[1,.86,.38],[1,.98,.9],[.52,.9,1],[1,.58,.8],[.75,.65,1],[1,.7,.32]];
  let sIdx=0;
  function emitStar(p,v,lvl){
    const i=sIdx;sIdx=(sIdx+1)%STAR_N;
    const spread=.26;
    sPos[i*3]=p.x+(Math.random()-.5)*spread;sPos[i*3+1]=p.y+(Math.random()-.5)*spread;sPos[i*3+2]=p.z+(Math.random()-.5)*spread;
    // 分散飘散，不挤成一团
    sVel[i*3]=-v.x*.08+(Math.random()-.5)*.95;sVel[i*3+1]=-v.y*.08+(Math.random()-.5)*.85+.18;sVel[i*3+2]=-v.z*.08+(Math.random()-.5)*.95;
    const c=PALETTE[(Math.random()*(lvl>=2?PALETTE.length:4))|0];
    sCol[i*3]=c[0];sCol[i*3+1]=c[1];sCol[i*3+2]=c[2];
    sMax[i]=.55+Math.random()*.45;sLife[i]=sMax[i];sSeed[i]=Math.random();
    // 大小错落：小星尘 ~0.11、中星 ~0.18、大五角星 ~0.28
    const tier=Math.random();
    const baseSize=tier<.55?.11+Math.random()*.05:(tier<.88?.17+Math.random()*.06:.25+Math.random()*.07);
    sSize[i]=baseSize*(1+.1*lvl);
  }

  /* ---------- 对外接口：沿用 emitFire / updFire ---------- */
  const _v=new T.Vector3();
  function emitFire(p,owner=null){
    if(!p)return;
    const t=now();
    // 接到最近的一条还在更新的尾迹上（同时有两颗完美球时各走各的）
    let tr=null,best=.9;
    for(const x of trails){if(x.ended)continue;
      if(owner&&x.owner===owner){tr=x;break;}
      if(owner||x.owner)continue;const h=x.pts[x.pts.length-1];if(!h)continue;
      const d=Math.hypot(h.x-p.x,h.y-p.y,h.z-p.z);if(d<best){best=d;tr=x;}}
    if(!tr){tr=makeTrail(p);tr.owner=owner;}
    const last=tr.pts[tr.pts.length-1];
    if(owner&&last){
      const dx=p.x-last.x,dy=p.y-last.y,dz=p.z-last.z,dist=Math.hypot(dx,dy,dz);
      // Keep the same sweet-spot ribbon at rocket speeds, with a readable length.
      const steps=Math.min(12,Math.ceil(Math.min(dist,4.5)/.45));
      for(let j=steps-1;j>0;j--){
        const u=1-j/steps*Math.min(1,4.5/dist);
        tr.pts.push({x:last.x+dx*u,y:last.y+dy*u,z:last.z+dz*u,t:last.t+(t-last.t)*u});
      }
      while(tr.pts.length&&Math.hypot(p.x-tr.pts[0].x,p.y-tr.pts[0].y,p.z-tr.pts[0].z)>4.5)tr.pts.shift();
    }
    tr.pts.push({x:p.x,y:p.y,z:p.z,t});if(tr.pts.length>MAX_PTS)tr.pts.splice(0,tr.pts.length-MAX_PTS);
    tr.last=t;tr.level=Math.max(tr.level,hotLevel());
    // 分散五角星：按节奏稀疏洒出，不密集堆叠
    if(last){
      _v.set(p.x-last.x,p.y-last.y,p.z-last.z).multiplyScalar(60);
      if(owner)_v.clampLength(0,18);
      tr.starAcc+=(.42+.14*tr.level);
      if(tr.starAcc>=1){tr.starAcc-=1;emitStar(p,_v,tr.level);}
    }
  }
  emitFire.__aibaHotHand=true;   // 热手模块看到这个标记就不再往里补随机火点
  function updFire(dt){
    dt=Math.max(0,Math.min(.1,dt||0));
    clock+=dt;const t=now();
    const hide=typeof firePts!=="undefined"&&firePts&&firePts.visible===false;   // 画质设置关掉特效时一起隐藏
    const ffMix=(global.AIBARainforest&&typeof global.AIBARainforest.fireflyTrailMix==="function")?global.AIBARainforest.fireflyTrailMix():0;
    trailMat.uniforms.uTime.value=t;starMat.uniforms.uTime.value=t;
    trailMat.uniforms.uRainbow.value=hotLevel()>=3?1:0;
    trailMat.uniforms.uFirefly.value=ffMix;starMat.uniforms.uFirefly.value=ffMix;
    if(typeof renderer!=="undefined"&&renderer.getSize){const s=renderer.getSize(new T.Vector2());starMat.uniforms.uScale.value=s.y*renderer.getPixelRatio()*.5;}
    for(let i=trails.length-1;i>=0;i--){
      const tr=trails[i];
      if(!tr.ended&&t-tr.last>IDLE_END)tr.ended=true;
      // 尾迹停止更新后：尾巴继续往球头方向收掉，同时整体淡出
      const age=TRAIL_AGE*(1+.22*tr.level);
      while(tr.pts.length&&t-tr.pts[0].t>age)tr.pts.shift();
      if(tr.ended)tr.fade=Math.max(0,tr.fade-dt/.25);
      tr.mesh.visible=!hide;
      if(tr.ended&&(tr.pts.length<2||tr.fade<=0)){scene.remove(tr.mesh);tr.mesh.geometry.dispose();trails.splice(i,1);continue;}
      rebuild(tr,t);
    }
    let alive=false;
    for(let i=0;i<STAR_N;i++){
      if(sLife[i]<=0)continue;alive=true;
      sLife[i]-=dt;
      if(sLife[i]<=0){sSize[i]=0;continue;}
      sPos[i*3]+=sVel[i*3]*dt;sPos[i*3+1]+=sVel[i*3+1]*dt;sPos[i*3+2]+=sVel[i*3+2]*dt;
      if(ffMix>.25){
        // 萤火虫尾迹颗粒带轻柔上升悬浮与游弋阻尼，不像火星那样直直下坠
        const ph=sSeed[i]*25+t*3.8;
        sVel[i*3]=(sVel[i*3]+Math.sin(ph)*1.1*dt)*(1-dt*2.8);
        sVel[i*3+1]=(sVel[i*3+1]+(.38+Math.cos(ph*1.3)*.7)*dt)*(1-dt*2.6);
        sVel[i*3+2]=(sVel[i*3+2]+Math.cos(ph*.9)*1.1*dt)*(1-dt*2.8);
      }else{
        sVel[i*3]*=1-dt*2.2;sVel[i*3+1]=sVel[i*3+1]*(1-dt*2.2)-dt*.15;sVel[i*3+2]*=1-dt*2.2;
      }
      const k=sLife[i]/sMax[i];sSize[i]*=k>.3?1:(1-dt*6);        // 最后三成寿命快速缩没
    }
    stars.visible=!hide;
    if(alive){for(const a of ["position","aSize","aCol","aSeed"])starGeo.attributes[a].needsUpdate=true;}
  }
  global.emitFire=emitFire;
  global.updFire=updFire;
  global.AIBACometTrail={trails,emitFire,updFire};
})(window);
