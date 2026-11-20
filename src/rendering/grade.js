/* ---------------- 画面合成层(后期) ----------------
   在这一层之前,渲染结果是直接写进画布的:没有曝光曲线、没有暗角、没有泛光,
   也没有任何"远近"的表达。方块美术本身没问题,问题是每个像素都以同样的权重
   摆在观众面前 —— 画面没有主次,所以读起来像"游戏直出"而不是一张宣传图。

   这一层做四件事,都很轻:
     1. 泛光   —— 顶灯、地面灯池、球场白线溢出一点光晕,球馆才有"亮度"而不只是"颜色"
     2. 背景柔化 —— 按真实深度把 16m 以外的东西轻微推虚(看台/横幅墙),主角和中景不动
     3. 调色   —— 一点对比、一点饱和、一点暖调,压住原来那种偏灰偏平的直出感
     4. 暗角   —— 四角压暗,视线自然收到画面中心的主角身上

   ── 三个必须知道的实现约束 ──
   · 场景先渲进一张 encoding=sRGB 的离屏贴图。实测这样出来的像素和直接画到画布
     完全一致(96.7/101.2/114.8 对 96.7/101.2/114.8),所以"不开效果"时是像素级无损的。
     反过来如果用默认的线性 RT,暗部会被 8bit 量化压出色带 —— 这个场景很暗,不能这么做。
   · 合成用的是裸 ShaderMaterial,不 include <encodings_fragment>,three 就不会再做一次
     sRGB 编码。调色因此发生在显示空间(sRGB)里,这也是绝大多数游戏调色的做法。
   · 模糊图一张两用:减去阈值是泛光,按深度混合是景深。省掉一整条模糊链。

   开关:URL 加 ?fx=0 关掉整层;控制台 AIBAGrade.set({...}) 可以在线调参(见文件末尾)。 */
(function(){
  "use strict";
  const RT_SVC=window.AIBA&&window.AIBA.runtime&&window.AIBA.runtime.service("rendering:core");
  if(!RT_SVC||typeof THREE==="undefined")return;
  const renderer=RT_SVC.renderer,scene=RT_SVC.scene,camera=RT_SVC.camera;

  const qs=new URLSearchParams(location.search);
  const FORCED=qs.get("fx");
  const COARSE=(()=>{try{return typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches;}catch(e){return false;}})();
  const WEAK=(navigator.deviceMemory||4)<=2||qs.get("quality")==="low";
  const BLUR_SHIFT=3;
  // Mobile uses the depth-aware lens and venue atmosphere without the full color and bloom chain.
  const FX_MODE=FORCED==="0"?"off":FORCED==="full"||FORCED==="1"||(!WEAK&&!COARSE)?"full":"off";
  const FULL=FX_MODE==="full";

  /* 调参入口。想更亮/更暗、更虚/更实,改这里就够了,不用碰 shader。

     两套配方,不是一套。室内是唯一有顶灯和"暗部"的场景,能吃得下强对比和深暗角;
     户外的天空是一整片没有纹理的渐变,同样的暗角会在天上画出一道看得见的椭圆边
     —— 那不是电影感,那是穿帮。所以户外整体减半。 */
  const LOOKS={
    indoor:{
      contrast:1.16,saturation:1.06,lift:-0.006,
      warmR:1.012,warmG:1.0,warmB:0.980,
      /* 0.80→0.84(验收要求 bloom 阈值至少 .84)。
         阈值越低越多东西发光:0.80 时球场白线已经在吃泛光,
         再叠加这次 +9.3% 的曝光提升,白线会整条发光、灯池边缘也会起晕。
         抬到 .84 正好把白线和灯池挡在阈值下面 —— 亮度提上去,泛光不跟着走。 */
      /* strength 0.26→0.22(验收要求 ≤0.22)。
         六机位消融显示 bloom 是白斑的**放大器**:同一块清漆高光,
         开后期时最大连通块 28414,关掉后期只剩 3585 —— 差 8 倍。
         阈值已抬到 .84,白线本身进不来;这里再把强度压一档,
         让清漆高光"发光"但不"糊成一块白板"。 */
      bloomThreshold:0.84,bloomStrength:0.22,
      vignette:0.26,dof:0.39,dofNear:12,dofFar:39
    },
    outdoor:{
      contrast:1.06,saturation:1.03,lift:-0.002,
      warmR:1.0,warmG:1.0,warmB:1.0,
      bloomThreshold:0.84,bloomStrength:0.26,
      vignette:0.16,dof:0.39,dofNear:19,dofFar:59
    },
    rainforest:{
      contrast:1.038,saturation:1.03,lift:.003,
      warmR:1.021,warmG:1.003,warmB:.96,
      bloomThreshold:.79,bloomStrength:.25,
      vignette:.13,dof:.42,dofNear:15,dofFar:49
    },
    /* 真实球馆/转播观感。和 indoor 是**相反**的两个方向,不是强弱之分:
         indoor —— 舞台聚光:压暗角、拉对比,把主体从暗背景里抠出来。
                   v2.20 实主角/观众亮度比 2.5,那是舞台灯的比例。
         arena  —— 球馆照明:整体提亮、对比压平、暗角几乎去掉,
                   看台和广告板重新有细节,接近转播机位看到的样子。
       哪个更好是审美选择,不是技术对错,所以两个都留着:?look=arena 切。 */
    arena:{
      exposure:1.12,
      /* contrast 1.04→1.14、lift 由正转负。原来为了"去舞台感"把对比压得太狠,
         结果是整幅发灰、主体也跟着糊 —— 那不是真实球馆,那是没调色的 RAW。
         真实转播画面的对比只比电影感略低一点,暗部依然要压得住。
         所以这里只退到 1.14(indoor 是 1.16),把"平"还回去,
         同时保留 arena 的低饱和、弱暗角、中性色温 —— 那些才是区分两种影调的地方。 */
      contrast:1.14,saturation:1.02,lift:-0.003,
      warmR:1.0,warmG:1.0,warmB:1.0,
      bloomThreshold:0.84,bloomStrength:0.22,
      vignette:0.14,dof:0.35,dofNear:20,dofFar:58
    }
  };
  const P={
    enabled:FORCED!=="0",
    exposure:1.0,        // 总体曝光
    contrast:1.16,       // 对比,>1 拉开明暗
    saturation:1.06,     // 饱和,>1 更艳(不要超过 1.15,方块色本来就纯)
    lift:-0.006,         // 黑位,负值压黑
    shadowKeep:0.32,     // 暗部保留多少对比(0=暗部完全不加对比,1=线性)
    toeEnd:0.26,         // toe 作用到多亮为止
    warmR:1.012,warmG:1.0,warmB:0.980,   // 暖调:抬红压蓝
    bloomThreshold:0.74, // 泛光阈值,越低越多东西发光(压到 .68 以下球场白线会整条发光)
    bloomStrength:0.40,  // 泛光强度
    vignette:0.40,       // 暗角深度
    /* 起点压到 .28:落点靠中心,衰减跨度更长,边界才不会在平坦的大面积上"画出一道线" */
    vignetteInner:0.28,  // 暗角起点(0=中心)
    vignetteOuter:1.16,  // 暗角终点
    dof:0.45,            // 背景柔化强度(0 关闭)
    dofNear:16,          // 米:比这近的完全清晰
    dofFar:46,           // 米:比这远的柔化拉满
    blurSpread:1.0       // 模糊半径倍率
  };
  let lookLocked=false;  // 手动 AIBAGrade.set() 之后就不再被场景切换覆盖
  /* ?look=arena / ?look=indoor / ?look=outdoor 强制指定影调,用于现场 A/B。
     必须在 lookLocked 判断**之前**处理:手动 AIBAGrade.set() 之后锁住是为了
     不让切场景时覆盖手调值,但 URL 是明确的外部指令,优先级更高。 */
  const LOOK_FORCE=(()=>{
    try{return new URLSearchParams(location.search).get("look")||"";}catch(e){return "";}
  })();
  function applyLook(){
    if(LOOK_FORCE&&LOOKS[LOOK_FORCE]){Object.assign(P,LOOKS[LOOK_FORCE]);return;}
    if(lookLocked)return;
    const sceneLook=document.documentElement.dataset.scenePreset||"indoor";
    Object.assign(P,LOOKS[sceneLook]||LOOKS.outdoor);
  }

  const hasDepth=!!(renderer.capabilities.isWebGL2||renderer.extensions.has("WEBGL_depth_texture"));

  const quadGeo=new THREE.PlaneGeometry(2,2);
  const fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const fsScene=new THREE.Scene();
  const quad=new THREE.Mesh(quadGeo,null);
  quad.frustumCulled=false;fsScene.add(quad);

  const VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;

  /* 5 抽样高斯(等价 9 抽样,靠线性采样合并),分横竖两遍 */
  const blurMat=new THREE.ShaderMaterial({
    uniforms:{tDiffuse:{value:null},dir:{value:new THREE.Vector2()}},
    vertexShader:VERT,
    fragmentShader:`
      uniform sampler2D tDiffuse;uniform vec2 dir;varying vec2 vUv;
      void main(){
        vec4 s=texture2D(tDiffuse,vUv)*0.227027;
        s+=texture2D(tDiffuse,vUv+dir*1.3846154)*0.3162162;
        s+=texture2D(tDiffuse,vUv-dir*1.3846154)*0.3162162;
        s+=texture2D(tDiffuse,vUv+dir*3.2307692)*0.0702703;
        s+=texture2D(tDiffuse,vUv-dir*3.2307692)*0.0702703;
        gl_FragColor=s;
      }`,
    depthTest:false,depthWrite:false
  });

  const focusMat=new THREE.ShaderMaterial({
    uniforms:{
      tScene:{value:null},tDepth:{value:null},tFoliage:{value:null},camNear:{value:0.1},camFar:{value:160},
      clearRange:{value:new THREE.Vector2()},radius:{value:new THREE.Vector2()},foreground:{value:0}
    },
    vertexShader:VERT,
    fragmentShader:`
      uniform sampler2D tScene,tDepth,tFoliage;
      uniform float camNear,camFar;
      uniform vec2 clearRange,radius;
      uniform float foreground;
      varying vec2 vUv;
      float linearDepth(float z){return camNear*camFar/mix(camFar,camNear,z);}
      float depthAt(vec2 uv){return linearDepth(texture2D(tDepth,uv).r);}
      float plantAt(vec2 uv,float depth){
        float leaves=linearDepth(texture2D(tFoliage,uv).r);
        return (1.0-smoothstep(.010+depth*.008,.036+depth*.025,abs(leaves-depth)))*
          (1.0-step(camFar*.97,leaves));
      }
      float lensRadius(float depth){
        float focus=1.0/clearRange.y;
        float radius=clamp((1.0/max(camNear,depth)-focus)/(1.0/clearRange.x-focus),0.0,1.0);
        return pow(radius,.73);
      }
      vec4 scatterNear(float depth){
        float leaf=plantAt(vUv,depth);
        float center=leaf*lensRadius(depth);
        // Player, ball and other near opaque surfaces retain their original color and edges.
        if(leaf<.007&&depth<clearRange.y)return vec4(0.0);
        vec3 source=texture2D(tScene,vUv).rgb,nearSum=source*center*.65,farSum=vec3(0.0);
        float nearWeight=center*.65,farWeight=0.0;
        for(int i=0;i<18;i++){
          float angle=float(i)*2.399963;
          float ring=sqrt((float(i)+.55)/18.0);
          float dst=ring*mix(.48,1.0,center);
          vec2 uv=vUv+vec2(cos(angle),sin(angle))*radius*dst;
          float tap=depthAt(uv),tapLeaf=plantAt(uv,tap),tapSize=lensRadius(tap);
          float kernel=1.0-smoothstep(tapSize*.60,tapSize+.075,dst);
          float front=1.0-smoothstep(depth+.08,depth+.34,tap);
          float weight=tapLeaf*tapSize*kernel*mix(front,1.0,leaf);
          float background=(1.0-tapLeaf)*smoothstep(depth-.1,depth+.05,tap);
          vec3 c=texture2D(tScene,uv).rgb;
          nearSum+=c*weight;nearWeight+=weight;
          farSum+=c*background;farWeight+=background;
        }
        float coverage=clamp(nearWeight/(2.0+8.0*center),0.0,1.0);
        float amount=max(center*.98,smoothstep(0.0,.57,coverage)*.57);
        if(amount<.001)return vec4(0.0);
        vec3 background=mix(source,farSum/max(.001,farWeight),center*smoothstep(.15,1.9,farWeight));
        vec3 color=mix(background,nearSum/max(.001,nearWeight),max(coverage,center*.69));
        return vec4(color*amount,amount);
      }
      void main(){
        float depth=depthAt(vUv),blur=smoothstep(clearRange.x,clearRange.y,depth);
        if(foreground>1.5){gl_FragColor=scatterNear(depth);return;}
        float mask=smoothstep(clearRange.x-1.6,clearRange.x+2.4,depth);
        if(foreground>.5)blur=mask=1.0-smoothstep(clearRange.x,clearRange.y,depth);
        if(mask<.002){gl_FragColor=vec4(0.0);return;}
        vec3 color=texture2D(tScene,vUv).rgb*.85;
        float weight=.85;
        float reject=max(clearRange.x-.8,depth-max(2.5,depth*.16));
        vec2 spread=radius*mix(.35,1.0,blur);
        for(int i=0;i<18;i++){
          float angle=float(i)*2.399963;
          float r=sqrt((float(i)+.55)/18.0);
          vec2 uv=vUv+vec2(cos(angle),sin(angle))*spread*r;
          float tap=depthAt(uv);
          // Strict bilateral depth rejection prevents foreground silhouettes or dark trees from bleeding into sky.
          float w=foreground>.5?1.0-smoothstep(clearRange.x,clearRange.y,tap):
            smoothstep(reject-1.0,reject+1.5,tap)*(1.0-smoothstep(depth*1.25+6.0,depth*1.65+18.0,tap)*.82);
          color+=texture2D(tScene,uv).rgb*w;
          weight+=w;
        }
        // Premultiply coverage so bilinear upsampling can't drag a sharply focused foreground into the blur.
        gl_FragColor=vec4(color/weight*mask,mask);
      }`,
    depthTest:false,depthWrite:false
  });

  const compMat=new THREE.ShaderMaterial({
    uniforms:{
      tScene:{value:null},tBlur:{value:null},tDepth:{value:null},tFocus:{value:null},
      tVenueAir:{value:null},useVenueAir:{value:0},airStart:{value:15},airEnd:{value:30},
      tFoliage:{value:null},forestGrade:{value:0},meadowGrade:{value:0},meadowGold:{value:0},gradeTime:{value:0},
      texelSize:{value:new THREE.Vector2(1/1280,1/720)},sunScreen:{value:new THREE.Vector3(.5,.2,0)},
      useDepth:{value:0},camNear:{value:0.1},camFar:{value:120},
      exposure:{value:1},contrast:{value:1},saturation:{value:1},lift:{value:0},
      warm:{value:new THREE.Vector3(1,1,1)},
      bloomThreshold:{value:.7},bloomStrength:{value:.35},
      shadowKeep:{value:.32},toeEnd:{value:.26},
      vigStrength:{value:.3},vigInner:{value:.45},vigOuter:{value:1.1},aspect:{value:1},
      dofStrength:{value:.4},dofNear:{value:16},dofFar:{value:46},dofForeground:{value:0},dofNearCoverage:{value:0}
    },
    vertexShader:VERT,
    fragmentShader:`
      uniform sampler2D tScene,tBlur,tDepth,tFocus,tVenueAir,tFoliage;
      uniform float forestGrade,meadowGrade,meadowGold,gradeTime;
      uniform vec2 texelSize;
      uniform vec3 sunScreen;
      uniform float useDepth,useVenueAir,airStart,airEnd,camNear,camFar;
      uniform float exposure,contrast,saturation,lift;
      uniform vec3 warm;
      uniform float bloomThreshold,bloomStrength;
      uniform float shadowKeep,toeEnd;
      uniform float vigStrength,vigInner,vigOuter,aspect;
      uniform float dofStrength,dofNear,dofFar,dofForeground,dofNearCoverage;
      varying vec2 vUv;
      float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
      float linearDepthAt(vec2 uv){
        float z=texture2D(tDepth,uv).x*2.0-1.0;
        return 2.0*camNear*camFar/(camFar+camNear-z*(camFar-camNear));
      }
      void main(){
        // Subtle 35mm cinema lens radial chromatic aberration at outer frame edges.
        vec2 fromCenter=vUv-0.5;
        float edgeDist=length(fromCenter);
        vec2 caOffset=fromCenter*smoothstep(.32,.72,edgeDist)*texelSize*1.35*(forestGrade>.5||meadowGrade>.5?1.0:.35);
        vec3 base=vec3(
          texture2D(tScene,vUv+caOffset).r,
          texture2D(tScene,vUv).g,
          texture2D(tScene,vUv-caOffset).b
        );
        vec3 blur=texture2D(tBlur,vUv).rgb;

        /* 背景柔化:按真实深度,不是按半径 —— 按半径糊会把边角的主角也糊掉 */
        float coc=0.0;
        float lin=0.0;
        if(useDepth>0.5||useVenueAir>0.5){
          lin=linearDepthAt(vUv);
          float blurAmount=smoothstep(dofNear,dofFar,lin);
          coc=mix(blurAmount,1.0-blurAmount,clamp(dofForeground,0.0,1.0))*dofStrength*useDepth;
        }
        vec3 col=base;
        if(coc>.001||dofNearCoverage>.5){
          vec4 lens=texture2D(tFocus,vUv);
          float amount=coc;
          if(dofNearCoverage>.5){
            float plantZ=texture2D(tFoliage,vUv).r;
            float plant=camNear*camFar/mix(camFar,camNear,plantZ);
            float visible=1.0-smoothstep(.015+lin*.008,.064+lin*.026,abs(plant-lin));
            // Restrict foreground bokeh strictly to near foliage (< dofFar) so it never bleeds onto the hoop or pole.
            float nearOnly=1.0-smoothstep(dofFar-.35,dofFar+.25,lin);
            amount=dofStrength*visible*nearOnly;
          }
          col=mix(base,lens.rgb/max(.001,lens.a),lens.a*amount);
        }

        // Screen-Space Micro-SSAO (Depth Cavity & Contact Shadow): grounds shoes on turf, balls on rack, boulders & planks.
        if((useDepth>0.5||useVenueAir>0.5)&&lin>0.3&&lin<32.0){
          vec2 step1=texelSize*2.4,step2=texelSize*5.8;
          float dL=linearDepthAt(vUv-vec2(step1.x,0.0)),dR=linearDepthAt(vUv+vec2(step1.x,0.0));
          float dU=linearDepthAt(vUv-vec2(0.0,step1.y)),dD=linearDepthAt(vUv+vec2(0.0,step1.y));
          float dU2=linearDepthAt(vUv-vec2(0.0,step2.y)),dD2=linearDepthAt(vUv+vec2(0.0,step2.y));
          float occ=0.0;
          float tol=.008+lin*.012,cap=.32+lin*.04;
          occ+=smoothstep(tol,tol+.08,lin-dL)*(1.0-smoothstep(cap,cap*1.8,lin-dL));
          occ+=smoothstep(tol,tol+.08,lin-dR)*(1.0-smoothstep(cap,cap*1.8,lin-dR));
          occ+=smoothstep(tol,tol+.08,lin-dU)*(1.0-smoothstep(cap,cap*1.8,lin-dU));
          occ+=smoothstep(tol,tol+.08,lin-dD)*(1.0-smoothstep(cap,cap*1.8,lin-dD));
          occ+=.65*smoothstep(tol*1.4,tol+.14,lin-dD2)*(1.0-smoothstep(cap*1.2,cap*2.2,lin-dD2));
          occ+=.45*smoothstep(tol*1.4,tol+.14,lin-dU2)*(1.0-smoothstep(cap*1.2,cap*2.2,lin-dU2));
          float aoFade=1.0-smoothstep(18.0,32.0,lin);
          float ao=clamp(occ*.095*aoFade,0.0,.32);
          col*=1.0-ao;
        }

        col+=max(blur-bloomThreshold,0.0)*bloomStrength;
        if(useVenueAir>0.5){
          // 4-tap tent filter prevents 4x4 block jaggedness along distant tree-to-sky depth discontinuities.
          vec2 airOff=texelSize*1.25;
          vec4 air=(
            texture2D(tVenueAir,vUv+vec2(-airOff.x,-airOff.y))+
            texture2D(tVenueAir,vUv+vec2( airOff.x,-airOff.y))+
            texture2D(tVenueAir,vUv+vec2(-airOff.x, airOff.y))+
            texture2D(tVenueAir,vUv+vec2( airOff.x, airOff.y))
          )*.25;
          float minAir=forestGrade>.5?.18:0.0;
          float airWeight=mix(minAir,1.0,smoothstep(airStart,airEnd,lin));
          col=mix(col,air.rgb,air.a*airWeight);
        }

        col*=exposure;
        /* 对比要带一段 toe。围绕 0.5 线性拉开会把整个暗部推进纯黑 —— 实测顶棚桁架
           就是这么消失的(画面上部近黑 0% → 47%,而灯光本身一点问题都没有)。
           这里按原始亮度调制对比强度:越暗施加得越少,暗部保住层次,
           中间调和高光照常拉开。整体抬黑位(lift)不行,那会连地板一起洗白。 */
        vec3 graded=(col-0.5)*contrast+0.5+lift;
        col=mix(col,graded,mix(shadowKeep,1.0,smoothstep(0.0,toeEnd,luma(col))));
        col=mix(vec3(luma(col)),col,saturation);
        col*=warm;
        // Unified Filmic LUT + Gamut Harmony + Micro-Grain so characters, balls, hoops & landscape share ONE camera lens.
        if(forestGrade>.5||meadowGrade>.5){
          float lum=luma(col);
          float cMax=max(col.r,max(col.g,col.b)),cMin=min(col.r,min(col.g,col.b));
          float sat=(cMax-cMin)/max(.001,cMax);
          // Soft gamut compression tames overly-vivid digital primaries (bright jerseys/hats/balls) into filmic harmony.
          float overSat=smoothstep(.42,.92,sat);
          col=mix(col,mix(vec3(lum),col,.80),overSat*(forestGrade>.5?.52:.38));
          float shade=1.0-smoothstep(.04,.44,lum);
          float mid=smoothstep(.10,.45,lum)*(1.0-smoothstep(.55,.92,lum));
          float sun=smoothstep(.30,.88,lum);
          if(forestGrade>.5){
            // Rainforest CineStill Emerald-Amber LUT + subtle humid near-air integration.
            float nearHaze=smoothstep(2.0,24.0,lin)*.065;
            col=mix(col,vec3(.58,.58,.41),nearHaze);
            // Optical light-wrap: warm sunlit canopy/mist bleeds softly around dark foreground silhouettes (player/hoop).
            float wrapMask=clamp(luma(blur)-lum,0.0,1.0)*smoothstep(1.0,16.0,lin);
            col+=blur*vec3(.30,.25,.14)*wrapMask;
            vec3 cooled=col*(1.0-.08*shade)+vec3(.006,.018,.014)*shade;
            vec3 midTint=cooled*mix(vec3(1.0),vec3(1.018,1.006,.932),mid*.64);
            vec3 warmed=midTint*mix(vec3(1.0),vec3(1.058,1.012,.912),sun);
            col=mix(warmed,warmed/(.90+.18*max(0.0,lum)),sun*.44);
          }else{
            // Tian Shan Alpine Meadow Kodak-Natural LUT + in-court atmospheric light-wrap & aerial veiling glare.
            float alpineHaze=smoothstep(1.4,32.0,lin)*.095;
            vec3 hazeTone=mix(vec3(.58,.65,.70),vec3(.84,.72,.56),meadowGold);
            col=mix(col,hazeTone,alpineHaze);
            // Optical light-wrap: bright sky & Tyndall mist wraps softly around player shoulders, ball rack & timber hoop.
            float wrapMask=clamp(luma(blur)-lum,0.0,1.0)*smoothstep(1.0,18.0,lin);
            col+=blur*mix(vec3(.20,.22,.24),vec3(.32,.23,.13),meadowGold)*wrapMask;
            vec3 shadowTint=mix(vec3(-.004,.005,.014),vec3(.008,.003,-.003),meadowGold);
            vec3 hiTint=mix(vec3(1.028,1.008,.962),vec3(1.075,1.005,.900),meadowGold);
            vec3 midWarm=mix(vec3(1.006,1.002,.982),vec3(1.040,1.002,.936),meadowGold);
            vec3 toned=col+shadowTint*shade;
            toned*=mix(vec3(1.0),midWarm,mid*.58);
            toned*=mix(vec3(1.0),hiTint,sun*.75);
            // Soft filmic highlight roll-off + warm optical halation glow.
            col=mix(toned,toned/(.92+.15*max(0.0,lum)),sun*.38);
            col+=max(blur-.56,0.0)*mix(vec3(.11,.10,.08),vec3(.18,.12,.06),meadowGold);
          }
          // Warm Anamorphic Sun Lens Glare when camera looks toward the sun or sunlit canopy.
          if(sunScreen.z>0.01){
            vec2 sunDelta=(vUv-sunScreen.xy)*vec2(aspect,1.0);
            float radialGlow=exp(-dot(sunDelta,sunDelta)*2.2);
            float anamorphicStreak=exp(-abs(sunDelta.y)*14.0)*exp(-abs(sunDelta.x)*1.6);
            vec3 glareCol=forestGrade>.5?vec3(1.0,.82,.46):mix(vec3(.95,.92,.82),vec3(1.0,.74,.38),meadowGold);
            col+=glareCol*(radialGlow*.095+anamorphicStreak*.065)*sunScreen.z;
          }
          // Subtle 35mm monochrome micro-grain removes sterile digital CG cleanliness.
          float gHash=fract(sin(dot(gl_FragCoord.xy+vec2(gradeTime*43.1,gradeTime*19.7),vec2(12.9898,78.233)))*43758.5453);
          col+=(gHash-.5)*.020*(.45+.55*mid);
        }

        vec2 d=(vUv-0.5)*vec2(aspect,1.0);
        col*=1.0-vigStrength*smoothstep(vigInner,vigOuter,length(d)/0.72);

        gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
      }`,
    depthTest:false,depthWrite:false
  });

  let rtScene=null,rtA=null,rtB=null,rtAir=null,rtFocus=null,rtFoliage=null,rtW=0,rtH=0;
  let focusActive=false;
  const focusDirection=new THREE.Vector3(),focusOffset=new THREE.Vector3();
  const focus={near:0,far:0,strength:0,foreground:false};
  const foregroundRange=new THREE.Vector2();
  const size=new THREE.Vector2();

  // The main render target always has a Z-buffer, independently of whether we read its depth texture.
  function makeRT(w,h,opts){
    const wantDepthTex=!!(opts&&opts.depthTexture);
    const rt=new THREE.WebGLRenderTarget(w,h,{
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
      format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
      depthBuffer:!!(opts&&opts.depthBuffer),stencilBuffer:false
    });
    /* 关键:sRGB 编码的 RT,场景写进来的像素和写进画布时一模一样 */
    if(THREE.sRGBEncoding)rt.texture.encoding=THREE.sRGBEncoding;
    if(wantDepthTex&&hasDepth){
      rt.depthTexture=new THREE.DepthTexture(w,h);
      rt.depthTexture.type=THREE.UnsignedShortType;
    }
    return rt;
  }
  function disposeRT(rt){
    if(!rt)return;
    if(rt.depthTexture&&rt.depthTexture.dispose)rt.depthTexture.dispose();
    rt.dispose();
  }
  function ensureTargets(){
    renderer.getDrawingBufferSize(size);
    const w=Math.max(2,size.x|0),h=Math.max(2,size.y|0);
    if(w===rtW&&h===rtH&&rtScene)return;
    disposeRT(rtScene);disposeRT(rtA);disposeRT(rtB);disposeRT(rtAir);disposeRT(rtFocus);disposeRT(rtFoliage);
    rtAir=rtFocus=rtFoliage=null;
    rtW=w;rtH=h;
    rtScene=makeRT(w,h,{depthBuffer:true,depthTexture:hasDepth});
    if(!FULL){rtA=rtB=null;return;}
    /* 模糊链跑在 1/8 分辨率上:泛光和柔化都不需要细节,却省掉 63/64 的填充率。
       这两张只画全屏四边形,不需要任何深度。 */
    const bw=Math.max(2,w>>BLUR_SHIFT),bh=Math.max(2,h>>BLUR_SHIFT);
    rtA=makeRT(bw,bh,{depthBuffer:false,depthTexture:false});
    rtB=makeRT(bw,bh,{depthBuffer:false,depthTexture:false});
  }

  function drawPass(mat,target){
    quad.material=mat;
    renderer.setRenderTarget(target||null);
    baseRender(fsScene,fsCam);
  }

  function drawVenueAir(weather){
    if(!rtAir){
      // Half-res air pass on desktop (1/4 on coarse mobile) keeps distant tree silhouettes crisp and free of blocky halos.
      const shift=COARSE?2:1;
      rtAir=makeRT(Math.max(2,rtW>>shift),Math.max(2,rtH>>shift),{depthBuffer:false});
      rtAir.texture.encoding=THREE.LinearEncoding;
    }
    const mat=weather.airMaterial,u=mat.uniforms;
    u.sceneDepth.value=rtScene.depthTexture;
    u.invProjection.value.copy(camera.projectionMatrixInverse);
    u.cameraWorld.value.copy(camera.matrixWorld);
    if(u.airViewProjection){
      u.airViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      u.cameraClip.value.set(camera.near,camera.far);
      u.airAspect.value=camera.aspect;
    }
    drawPass(mat,rtAir);
    u.sceneDepth.value=null;
    return rtAir.texture;
  }

  function lowMeadowFocus(weather){
    if(!weather?.court||camera.userData.firstPerson||camera.position.y>2.25)return 0;
    const height=camera.position.y-weather.court.heightAt(camera.position.x,camera.position.z);
    if(height<.08||height>=1.24)return 0;
    camera.getWorldDirection(focusDirection);
    if(Math.abs(focusDirection.y)>.48)return 0;
    const hoop=focusOffset.copy(HOOP).sub(camera.position).dot(focusDirection);
    if(hoop<1.2)return 0;
    focusOffset.copy(player.g.position);
    focusOffset.y+=1.05;
    const playerDepth=player.g.visible?focusOffset.sub(camera.position).dot(focusDirection):0;
    const protectedDepth=playerDepth>.35?Math.min(hoop,playerDepth):hoop;
    const end=Math.min(3.65,protectedDepth-.63);
    if(end<.66)return 0;
    foregroundRange.set(Math.min(1.04,end*.43),end);
    return .93*(1-THREE.MathUtils.smoothstep(height,.55,1.24));
  }

  function drawFoliageDepth(forest){
    if(!rtFoliage)rtFoliage=makeRT(Math.max(2,rtW>>1),Math.max(2,rtH>>1),{depthBuffer:true,depthTexture:true});
    const mask=camera.layers.mask,background=scene.background,shadows=renderer.shadowMap.autoUpdate;
    try{
      camera.layers.set(forest.foregroundLayer);
      scene.background=null;
      renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(rtFoliage);
      renderer.clear(false,true,false);
      baseRender(scene,camera);
    }finally{
      camera.layers.mask=mask;
      scene.background=background;
      renderer.shadowMap.autoUpdate=shadows;
    }
    return rtFoliage.depthTexture;
  }

  function drawFocus(weather,foreground,forest,foliage){
    if(!rtFocus){
      const fShift=COARSE?2:1;
      rtFocus=makeRT(Math.max(2,rtW>>fShift),Math.max(2,rtH>>fShift),{depthBuffer:false});
      rtFocus.texture.encoding=THREE.LinearEncoding;
    }
    const meadow=weather&&!lookLocked;
    const isFP=camera.userData.firstPerson===true;
    focus.foreground=!isFP&&foreground>.001;
    if(focus.foreground){
      focus.near=forest ? .34 : foregroundRange.x;
      focus.far=forest ? 4.15 : foregroundRange.y;
      focus.strength=foreground*(COARSE?.87:1);
    }else{
      camera.getWorldDirection(focusDirection);
      const rimDepth=focusOffset.copy(HOOP).sub(camera.position).dot(focusDirection);
      if(isFP){
        // In First-Person, keep the entire court, hoop, backboard & courtside spectators (< rimDepth+5.2m) tack-sharp,
        // then smoothly defocus the distant hills, forest belts & mountain backdrop behind them.
        focus.near=Math.max(13.5,Math.max(0,rimDepth)+5.2);
        focus.far=focus.near+(meadow?24:18);
        focus.strength=(COARSE?.72:.84);
      }else{
        focus.near=Math.max(P.dofNear,Math.max(0,rimDepth)+11,meadow?22:16);
        focus.far=Math.max(P.dofFar,focus.near+(meadow?48:38));
        focus.strength=(meadow?.48:P.dof)*(COARSE?.83:1);
      }
    }
    const u=focusMat.uniforms,pixels=focus.foreground?(forest?39:34):isFP?19.5:(meadow?12.5:9.5);
    u.foreground.value=focus.foreground?(forest?2:1):0;
    const scale=rtH/Math.max(1,renderer.domElement.clientHeight);
    u.tScene.value=rtScene.texture;u.tDepth.value=rtScene.depthTexture;
    u.tFoliage.value=foliage;
    u.camNear.value=camera.near;u.camFar.value=camera.far;
    u.clearRange.value.set(focus.near,focus.far);
    u.radius.value.set(pixels*scale/rtW,pixels*scale/rtH);
    drawPass(focusMat,rtFocus);
    return rtFocus.texture;
  }

  function composite(air,lens,forest,foliage,weather){
    const u=compMat.uniforms;
    u.tVenueAir.value=air;u.useVenueAir.value=air?1:0;
    u.forestGrade.value=forest&&!lookLocked?1:0;
    u.meadowGrade.value=weather&&!lookLocked?1:0;
    u.meadowGold.value=weather?weather.uniforms.meadowSky.value.y:0;
    u.gradeTime.value=(performance.now()%100000)*.001;
    u.tFoliage.value=foliage;
    u.texelSize.value.set(1/Math.max(2,rtW),1/Math.max(2,rtH));
    if(typeof sun!=="undefined"&&sun){
      focusOffset.copy(sun.position).normalize();
      camera.getWorldDirection(focusDirection);
      const facing=THREE.MathUtils.clamp((focusDirection.dot(focusOffset)+.15)/.85,0,1);
      focusOffset.multiplyScalar(120).add(camera.position).project(camera);
      u.sunScreen.value.set(focusOffset.x*.5+.5,focusOffset.y*.5+.5,facing);
    }else u.sunScreen.value.set(.5,.2,0);
    // In rainforest, volumetric Tyndall shafts fill the court; in flowerCourt, valley mist starts behind the court (18..36m) so spectators stay crisp.
    u.airStart.value=forest?0:18;u.airEnd.value=forest?1.4:36;
    u.tScene.value=rtScene.texture;u.tBlur.value=(rtB||rtScene).texture;
    u.tDepth.value=rtScene.depthTexture||null;
    u.tFocus.value=lens;u.useDepth.value=lens?1:0;
    u.camNear.value=camera.near;u.camFar.value=camera.far;
    u.exposure.value=FULL?P.exposure:1;u.contrast.value=FULL?P.contrast:1;
    u.saturation.value=FULL?P.saturation:1;u.lift.value=FULL?P.lift:0;
    u.warm.value.set(FULL?P.warmR:1,FULL?P.warmG:1,FULL?P.warmB:1);
    u.bloomThreshold.value=FULL?P.bloomThreshold:1;u.bloomStrength.value=FULL?P.bloomStrength:0;
    u.shadowKeep.value=P.shadowKeep;u.toeEnd.value=P.toeEnd;
    u.vigStrength.value=FULL?P.vignette:0;u.vigInner.value=P.vignetteInner;u.vigOuter.value=P.vignetteOuter;
    u.aspect.value=rtW/Math.max(1,rtH);
    u.dofStrength.value=lens?focus.strength:0;u.dofNear.value=focus.near;u.dofFar.value=focus.far;
    u.dofForeground.value=focus.foreground?1:0;
    u.dofNearCoverage.value=lens&&focus.foreground&&forest?1:0;
    drawPass(compMat,null);
  }

  const baseRender=renderer.render.bind(renderer);
  let failed=false;
  renderer.render=function(sc,cam){
    /* 只接管主场景。装备预览等自带 scene/camera 的离屏渲染原样放行。 */
    if(sc!==scene||cam!==camera)return baseRender(sc,cam);
    const place=RT_SVC.environmentRoot.userData.placeState;
    const weather=place?.meadow,forest=place?.rainforest,atmosphere=forest||weather;
    const foreground=hasDepth&&P.dof>.001?(forest?.94:lowMeadowFocus(weather)):0;
    const wantsFocus=hasDepth&&P.dof>.001&&(camera.userData.firstPerson===true||foreground>.001);
    focusActive=false;
    if(failed||!P.enabled||(!FULL&&!wantsFocus&&!(forest&&hasDepth))){
      if(atmosphere)atmosphere.fallback.visible=true;
      if(rtAir){disposeRT(rtAir);rtAir=null;}
      if(rtFoliage){disposeRT(rtFoliage);rtFoliage=null;}
      return baseRender(sc,cam);
    }
    try{
      ensureTargets();
      const useAir=!!(atmosphere&&rtScene.depthTexture&&(forest||(!COARSE&&!WEAK)));
      if(atmosphere)atmosphere.fallback.visible=!useAir;
      if(!useAir&&rtAir){disposeRT(rtAir);rtAir=null;}
      if(window.AIBACharacterShading?.syncSceneLight)window.AIBACharacterShading.syncSceneLight();
      renderer.setRenderTarget(rtScene);
      baseRender(sc,cam);

      if(FULL){
        const bd=blurMat.uniforms.dir.value,bw=Math.max(2,rtW>>BLUR_SHIFT),bh=Math.max(2,rtH>>BLUR_SHIFT);
        blurMat.uniforms.tDiffuse.value=rtScene.texture;
        bd.set(P.blurSpread/bw,0);drawPass(blurMat,rtA);
        blurMat.uniforms.tDiffuse.value=rtA.texture;
        bd.set(0,P.blurSpread/bh);drawPass(blurMat,rtB);
      }

      const air=useAir?drawVenueAir(atmosphere):null;
      const foliage=forest&&wantsFocus?drawFoliageDepth(forest):null;
      if(!foliage&&rtFoliage){disposeRT(rtFoliage);rtFoliage=null;}
      const lens=wantsFocus&&rtScene.depthTexture?drawFocus(weather,foreground,forest,foliage):null;
      focusActive=!!lens;
      composite(air,lens,forest,foliage,weather);
      renderer.setRenderTarget(null);
    }catch(e){
      /* 后期挂了不能连累游戏:退回直出,并且不再重试。 */
      failed=true;focusActive=false;
      if(atmosphere)atmosphere.fallback.visible=true;
      try{renderer.setRenderTarget(null);}catch(e2){}
      if(window.console&&console.warn)console.warn("[AIBAGrade] post pass disabled:",e);
      baseRender(sc,cam);
    }
  };

  /* 场景切换时换配方。applyScenePreset 是 environments.js 的顶层函数声明,
     所以挂在 window 上,可以在这里包一层;它自己不知道有后期这一层的存在。 */
  if(typeof window.applyScenePreset==="function"){
    const origPreset=window.applyScenePreset;
    window.applyScenePreset=function(){
      const r=origPreset.apply(this,arguments);
      applyLook();
      return r;
    };
  }
  applyLook();

  const API={
    params:P,LOOKS,
    /* AIBAGrade.set({contrast:1.2,vignette:.5}) —— 立即生效,方便对着画面调。
       调过之后场景切换不再覆盖(否则换个场景就把你手调的值冲掉了);
       AIBAGrade.unlock() 交还给场景配方。 */
    set(patch){lookLocked=true;Object.assign(P,patch||{});return Object.assign({},P);},
    unlock(){lookLocked=false;applyLook();return Object.assign({},P);},
    get(){return Object.assign({},P);},
    setEnabled(on){P.enabled=!!on;},
    isActive(){return P.enabled&&!failed&&(FULL||focusActive);},
    focusInfo(){return focusActive?{...focus,vegetationOnly:!!rtFoliage}:null;},
    hasDepth,coarse:COARSE,weak:WEAK,mode:FX_MODE,
    /* 给回归测试用:场景 RT 到底有没有 Z-buffer。
       没有的话整场就没有遮挡判定 —— 这条只在 pointer:coarse 的 lite 档翻过车,
       桌面走 full 档永远是 true,所以断言必须在**手机上下文**里跑才有意义。 */
    rtInfo(){return rtScene?{
      w:rtW,h:rtH,
      depthBuffer:!!rtScene.depthBuffer,
      depthTexture:!!rtScene.depthTexture
    }:null;}
  };
  window.AIBAGrade=API;
  window.AIBA.runtime.register("rendering:grade",Object.freeze(API));
})();
