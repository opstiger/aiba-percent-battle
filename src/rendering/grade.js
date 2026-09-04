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
  /* 桌面实测这一层多花 0.10ms/帧(721x1148,0.37ms → 0.46ms)。绝对值很小,但手机 GPU
     的填充率大约慢一个数量级,同样的三趟在低端机上会变成 1ms 以上。
     所以:显式 ?quality=low 或内存 ≤2GB 的机器直接不开;?fx=1 可以强制打开。
     粗指针设备保留效果,但模糊链降到 1/8 分辨率(泛光和柔化都不需要细节)。 */
  const COARSE=(()=>{try{return typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches;}catch(e){return false;}})();
  const WEAK=(navigator.deviceMemory||4)<=2||qs.get("quality")==="low";
  const BLUR_SHIFT=3;
  /* 三档,不是开关两档。真正贵的是**全屏趟数**,不是 shader 里的算式:
       完整档  场景→离屏 + 两趟 1/8 模糊 + 合成   (泛光 / 背景柔化 / 调色 / 暗角)
       轻量档  场景→离屏 + 合成                   (只有调色 / 暗角)
       关闭    直出
     调色和暗角是"电影感"的主要来源,泛光和景深是锦上添花 —— 手机上砍掉后两者,
     留住前两者,画面气质基本不掉,却省掉两趟模糊和一整套模糊贴图。
     ?fx=full 可以在手机上强制完整档,?fx=1 等价于 full。 */
  const FX_MODE=(()=>{
    if(FORCED==="0")return "off";
    if(FORCED==="full"||FORCED==="1")return "full";
    if(WEAK)return "off";
    return COARSE?"lite":"full";
  })();
  const LITE=FX_MODE==="lite";

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
      bloomThreshold:0.84,bloomStrength:0.26,
      /* dofNear 16→7:原来 16m 外才开始虚,而球员通常只在 3~8m,
         结果整块背景都落在"完全清晰"区里,景深等于没开。
         现在对焦区贴合球员距离,看台才会真的退到后面。
         强度反而从 .45 降到 .30 —— gameplay 不该开重景深,这层只是补一点
         空间层次,主力交给雾(core.js)和照明分层。 */
      vignette:0.26,dof:0.30,dofNear:7,dofFar:38
    },
    outdoor:{
      contrast:1.06,saturation:1.03,lift:-0.002,
      warmR:1.0,warmG:1.0,warmB:1.0,
      bloomThreshold:0.84,bloomStrength:0.26,
      vignette:0.16,dof:0.26,dofNear:24,dofFar:64
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
      vignette:0.14,dof:0.20,dofNear:22,dofFar:58
    }
  };
  const P={
    enabled:FX_MODE!=="off",
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
    const indoor=(document.documentElement.dataset.scenePreset||"indoor")==="indoor";
    Object.assign(P,indoor?LOOKS.indoor:LOOKS.outdoor);
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

  const compMat=new THREE.ShaderMaterial({
    uniforms:{
      tScene:{value:null},tBlur:{value:null},tDepth:{value:null},
      useDepth:{value:0},camNear:{value:0.1},camFar:{value:120},
      exposure:{value:1},contrast:{value:1},saturation:{value:1},lift:{value:0},
      warm:{value:new THREE.Vector3(1,1,1)},
      bloomThreshold:{value:.7},bloomStrength:{value:.35},
      shadowKeep:{value:.32},toeEnd:{value:.26},
      vigStrength:{value:.3},vigInner:{value:.45},vigOuter:{value:1.1},aspect:{value:1},
      dofStrength:{value:.4},dofNear:{value:16},dofFar:{value:46}
    },
    vertexShader:VERT,
    fragmentShader:`
      uniform sampler2D tScene,tBlur,tDepth;
      uniform float useDepth,camNear,camFar;
      uniform float exposure,contrast,saturation,lift;
      uniform vec3 warm;
      uniform float bloomThreshold,bloomStrength;
      uniform float shadowKeep,toeEnd;
      uniform float vigStrength,vigInner,vigOuter,aspect;
      uniform float dofStrength,dofNear,dofFar;
      varying vec2 vUv;
      float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
      void main(){
        vec3 base=texture2D(tScene,vUv).rgb;
        vec3 blur=texture2D(tBlur,vUv).rgb;

        /* 背景柔化:按真实深度,不是按半径 —— 按半径糊会把边角的主角也糊掉 */
        float coc=0.0;
        if(useDepth>0.5&&dofStrength>0.001){
          float z=texture2D(tDepth,vUv).x*2.0-1.0;
          float lin=2.0*camNear*camFar/(camFar+camNear-z*(camFar-camNear));
          coc=smoothstep(dofNear,dofFar,lin)*dofStrength;
        }
        vec3 col=mix(base,blur,coc);

        col+=max(blur-bloomThreshold,0.0)*bloomStrength;

        col*=exposure;
        /* 对比要带一段 toe。围绕 0.5 线性拉开会把整个暗部推进纯黑 —— 实测顶棚桁架
           就是这么消失的(画面上部近黑 0% → 47%,而灯光本身一点问题都没有)。
           这里按原始亮度调制对比强度:越暗施加得越少,暗部保住层次,
           中间调和高光照常拉开。整体抬黑位(lift)不行,那会连地板一起洗白。 */
        vec3 graded=(col-0.5)*contrast+0.5+lift;
        col=mix(col,graded,mix(shadowKeep,1.0,smoothstep(0.0,toeEnd,luma(col))));
        col=mix(vec3(luma(col)),col,saturation);
        col*=warm;

        vec2 d=(vUv-0.5)*vec2(aspect,1.0);
        col*=1.0-vigStrength*smoothstep(vigInner,vigOuter,length(d)/0.72);

        gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
      }`,
    depthTest:false,depthWrite:false
  });

  let rtScene=null,rtA=null,rtB=null,rtW=0,rtH=0;
  const size=new THREE.Vector2();

  function makeRT(w,h,depth){
    const rt=new THREE.WebGLRenderTarget(w,h,{
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
      format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
      depthBuffer:!!depth,stencilBuffer:false
    });
    /* 关键:sRGB 编码的 RT,场景写进来的像素和写进画布时一模一样 */
    if(THREE.sRGBEncoding)rt.texture.encoding=THREE.sRGBEncoding;
    if(depth&&hasDepth){
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
    disposeRT(rtScene);disposeRT(rtA);disposeRT(rtB);
    rtW=w;rtH=h;
    rtScene=makeRT(w,h,LITE?false:true);
    if(LITE){rtA=rtB=null;return;}
    /* 模糊链跑在 1/8 分辨率上:泛光和柔化都不需要细节,却省掉 63/64 的填充率 */
    const bw=Math.max(2,w>>BLUR_SHIFT),bh=Math.max(2,h>>BLUR_SHIFT);
    rtA=makeRT(bw,bh,false);rtB=makeRT(bw,bh,false);
  }

  function drawPass(mat,target){
    quad.material=mat;
    renderer.setRenderTarget(target||null);
    baseRender(fsScene,fsCam);
  }

  function composite(){
    const u=compMat.uniforms;
    u.tScene.value=rtScene.texture;
    /* 轻量档没有模糊图:把泛光/景深的输入接回场景本身并把强度置零,
       shader 里 max(blur-1.0,0)=0、coc=0,等于只跑调色和暗角那几行。 */
    u.tBlur.value=(rtB||rtScene).texture;
    u.tDepth.value=rtScene.depthTexture||null;
    u.useDepth.value=(!LITE&&hasDepth&&rtScene.depthTexture&&P.dof>0.001)?1:0;
    u.camNear.value=camera.near;u.camFar.value=camera.far;
    u.exposure.value=P.exposure;u.contrast.value=P.contrast;
    u.saturation.value=P.saturation;u.lift.value=P.lift;
    u.warm.value.set(P.warmR,P.warmG,P.warmB);
    u.bloomThreshold.value=LITE?1.0:P.bloomThreshold;u.bloomStrength.value=LITE?0:P.bloomStrength;
    u.shadowKeep.value=P.shadowKeep;u.toeEnd.value=P.toeEnd;
    u.vigStrength.value=P.vignette;u.vigInner.value=P.vignetteInner;u.vigOuter.value=P.vignetteOuter;
    u.aspect.value=rtW/Math.max(1,rtH);
    u.dofStrength.value=P.dof;u.dofNear.value=P.dofNear;u.dofFar.value=P.dofFar;
    drawPass(compMat,null);
  }

  const baseRender=renderer.render.bind(renderer);
  let failed=false;
  renderer.render=function(sc,cam){
    /* 只接管主场景。装备预览等自带 scene/camera 的离屏渲染原样放行。 */
    if(failed||!P.enabled||sc!==scene||cam!==camera)return baseRender(sc,cam);
    try{
      ensureTargets();
      renderer.setRenderTarget(rtScene);
      baseRender(sc,cam);

      if(!LITE){
        const bd=blurMat.uniforms.dir.value,bw=Math.max(2,rtW>>BLUR_SHIFT),bh=Math.max(2,rtH>>BLUR_SHIFT);
        blurMat.uniforms.tDiffuse.value=rtScene.texture;
        bd.set(P.blurSpread/bw,0);drawPass(blurMat,rtA);
        blurMat.uniforms.tDiffuse.value=rtA.texture;
        bd.set(0,P.blurSpread/bh);drawPass(blurMat,rtB);
      }

      composite();
      renderer.setRenderTarget(null);
    }catch(e){
      /* 后期挂了不能连累游戏:退回直出,并且不再重试。 */
      failed=true;
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
    isActive(){return P.enabled&&!failed;},
    hasDepth,coarse:COARSE,weak:WEAK,mode:FX_MODE
  };
  window.AIBAGrade=API;
  window.AIBA.runtime.register("rendering:grade",Object.freeze(API));
})();
