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

  /* ---------- 彗星尾：每条尾迹一张动态三角带 ---------- */
  const trailMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    uniforms:{uRainbow:{value:0},uTime:{value:0}},
    vertexShader:`attribute float aT;attribute float aSide;attribute float aFade;varying float vT;varying float vSide;varying float vFade;
      void main(){vT=aT;vSide=aSide;vFade=aFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uRainbow,uTime;varying float vT;varying float vSide;varying float vFade;
      vec3 ramp(float t){
        vec3 c0=vec3(1.,.98,.9),c1=vec3(1.,.83,.35),c2=vec3(1.,.47,.12),c3=vec3(1.,.24,.5),c4=vec3(.48,.36,1.);
        if(t<.08)return mix(c0,c1,t/.08);if(t<.3)return mix(c1,c2,(t-.08)/.22);
        if(t<.62)return mix(c2,c3,(t-.3)/.32);return mix(c3,c4,(t-.62)/.38);}
      vec3 rainbow(float t){return .55+.45*cos(6.2832*(t*1.3-uTime*.9+vec3(0.,.33,.67)));}
      void main(){
        float edge=1.-vSide*vSide;edge=edge*edge;                  // 横向：中间亮、边缘柔
        float core=exp(-vSide*vSide*18.)*(1.-smoothstep(0.,.35,vT)); // 头部白热细芯
        vec3 c=mix(ramp(vT),rainbow(vT),uRainbow*smoothstep(.05,.3,vT));
        float a=min(1.,pow(1.-vT,1.3)*edge*1.35)*vFade;
        gl_FragColor=vec4(c*a*1.25+vec3(1.,.95,.85)*core*vFade,a);}`
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
    const tr={mesh,pts:[],last:now(),ended:false,fade:1,level:hotLevel()};
    trails.push(tr);return tr;
  }
  const _cam=new T.Vector3(),_tan=new T.Vector3(),_side=new T.Vector3(),_to=new T.Vector3();
  function rebuild(tr,t){
    const g=tr.mesh.geometry,P=g.attributes.position.array,A=g.attributes.aT.array,S=g.attributes.aSide.array,F=g.attributes.aFade.array;
    const pts=tr.pts,n=pts.length;if(n<2){g.setDrawRange(0,0);return;}
    const lvl=tr.level,age=TRAIL_AGE*(1+.22*lvl),W=.19*(1+.16*lvl);   // 头部半宽 ≈ 球半径（.16），尾巴收成尖
    if(typeof camera!=="undefined")camera.getWorldPosition(_cam);
    for(let i=0;i<n;i++){
      const p=pts[n-1-i],k=Math.min(1,(t-p.t)/age);             // 0 = 球头，1 = 尾尖
      const a=pts[Math.max(0,n-2-i)],b=pts[Math.min(n-1,n-i)];
      _tan.set(b.x-a.x,b.y-a.y,b.z-a.z);if(_tan.lengthSq()<1e-8)_tan.set(0,1,0);_tan.normalize();
      _to.set(_cam.x-p.x,_cam.y-p.y,_cam.z-p.z).normalize();
      _side.crossVectors(_tan,_to);if(_side.lengthSq()<1e-8)_side.set(1,0,0);_side.normalize();
      const w=W*Math.pow(1-k,1.5)*(k<.04?.75+6*k:1);              // 头部略收圆，往后收成尖
      for(const sd of [-1,1]){const j=(i*2+(sd>0?1:0));
        P[j*3]=p.x+_side.x*w*sd;P[j*3+1]=p.y+_side.y*w*sd;P[j*3+2]=p.z+_side.z*w*sd;
        A[j]=k;S[j]=sd;F[j]=tr.fade;}
    }
    for(const a of ["position","aT","aSide","aFade"])g.attributes[a].needsUpdate=true;
    g.setDrawRange(0,(n-1)*6);
  }

  /* ---------- 星星：一池点精灵，片元里画四角星 ---------- */
  const STAR_N=220;
  const sPos=new Float32Array(STAR_N*3),sCol=new Float32Array(STAR_N*3),sSize=new Float32Array(STAR_N),sLife=new Float32Array(STAR_N),
    sMax=new Float32Array(STAR_N),sSeed=new Float32Array(STAR_N),sVel=new Float32Array(STAR_N*3);
  const starGeo=new T.BufferGeometry();
  starGeo.setAttribute("position",new T.BufferAttribute(sPos,3));
  starGeo.setAttribute("aCol",new T.BufferAttribute(sCol,3));
  starGeo.setAttribute("aSize",new T.BufferAttribute(sSize,1));
  starGeo.setAttribute("aSeed",new T.BufferAttribute(sSeed,1));
  const starMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uScale:{value:600},uTime:{value:0}},
    vertexShader:`attribute vec3 aCol;attribute float aSize;attribute float aSeed;uniform float uScale;varying vec3 vCol;varying float vSeed;varying float vA;
      void main(){vCol=aCol;vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);vA=step(.0001,aSize);
        gl_PointSize=aSize*uScale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uTime;varying vec3 vCol;varying float vSeed;varying float vA;
      void main(){if(vA<.5)discard;
        vec2 d=gl_PointCoord-.5;float r=vSeed*6.2832+uTime*1.7*(fract(vSeed*7.)-.5);
        float cs=cos(r),sn=sin(r);d=vec2(cs*d.x-sn*d.y,sn*d.x+cs*d.y);vec2 q=abs(d);
        float ray=max(exp(-q.x*38.)*exp(-q.y*7.),exp(-q.y*38.)*exp(-q.x*7.));   // 四角星的十字光芒
        float glow=exp(-dot(d,d)*60.);                                        // 中心亮点
        float tw=.75+.25*sin(uTime*18.+vSeed*40.);                           // 闪烁
        float a=clamp((ray+glow)*tw,0.,1.);if(a<.02)discard;
        gl_FragColor=vec4(mix(vCol,vec3(1.),glow*.6)*a,a);}`
  });
  const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=21;scene.add(stars);
  const PALETTE=[[1,.84,.35],[1,1,1],[.45,.92,1],[1,.5,.78],[.72,.6,1],[1,.66,.25]];
  let sIdx=0;
  function emitStar(p,v,lvl){
    const i=sIdx;sIdx=(sIdx+1)%STAR_N;
    sPos[i*3]=p.x+(Math.random()-.5)*.12;sPos[i*3+1]=p.y+(Math.random()-.5)*.12;sPos[i*3+2]=p.z+(Math.random()-.5)*.12;
    // 往尾后方 + 四周散开一点
    sVel[i*3]=-v.x*.12+(Math.random()-.5)*.55;sVel[i*3+1]=-v.y*.12+(Math.random()-.5)*.55;sVel[i*3+2]=-v.z*.12+(Math.random()-.5)*.55;
    const c=PALETTE[(Math.random()*(lvl>=2?PALETTE.length:4))|0];
    sCol[i*3]=c[0];sCol[i*3+1]=c[1];sCol[i*3+2]=c[2];
    sMax[i]=.45+Math.random()*.4;sLife[i]=sMax[i];sSeed[i]=Math.random();
    sSize[i]=(.12+Math.random()*.1)*(1+.15*lvl);
  }

  /* ---------- 对外接口：沿用 emitFire / updFire ---------- */
  const _v=new T.Vector3();
  function emitFire(p){
    if(!p)return;
    const t=now();
    // 接到最近的一条还在更新的尾迹上（同时有两颗完美球时各走各的）
    let tr=null,best=.9;
    for(const x of trails){if(x.ended)continue;const h=x.pts[x.pts.length-1];if(!h)continue;
      const d=Math.hypot(h.x-p.x,h.y-p.y,h.z-p.z);if(d<best){best=d;tr=x;}}
    if(!tr)tr=makeTrail(p);
    const last=tr.pts[tr.pts.length-1];
    tr.pts.push({x:p.x,y:p.y,z:p.z,t});if(tr.pts.length>MAX_PTS)tr.pts.shift();
    tr.last=t;tr.level=Math.max(tr.level,hotLevel());
    // 星星：每帧 1~2 颗，热手档位越高越多
    if(last){_v.set(p.x-last.x,p.y-last.y,p.z-last.z).multiplyScalar(60);
      const n=1+(Math.random()<.35?1:0)+(Math.random()<.25*tr.level?1:0)+(tr.level>=2?1:0);
      for(let k=0;k<n;k++)emitStar(p,_v,tr.level);}
  }
  emitFire.__aibaHotHand=true;   // 热手模块看到这个标记就不再往里补随机火点
  function updFire(dt){
    dt=Math.max(0,Math.min(.1,dt||0));
    clock+=dt;const t=now();
    const hide=typeof firePts!=="undefined"&&firePts&&firePts.visible===false;   // 画质设置关掉特效时一起隐藏
    trailMat.uniforms.uTime.value=t;starMat.uniforms.uTime.value=t;
    trailMat.uniforms.uRainbow.value=hotLevel()>=3?1:0;
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
      sVel[i*3]*=1-dt*2.2;sVel[i*3+1]=sVel[i*3+1]*(1-dt*2.2)-dt*.15;sVel[i*3+2]*=1-dt*2.2;
      const k=sLife[i]/sMax[i];sSize[i]*=k>.3?1:(1-dt*6);        // 最后三成寿命快速缩没
    }
    stars.visible=!hide;
    if(alive){for(const a of ["position","aSize","aCol","aSeed"])starGeo.attributes[a].needsUpdate=true;}
  }
  global.emitFire=emitFire;
  global.updFire=updFire;
  global.AIBACometTrail={trails,emitFire,updFire};
})(window);
