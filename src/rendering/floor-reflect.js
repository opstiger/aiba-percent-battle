/* ---------------- 地板反射（M4 场地质感） ----------------
   高级篮球游戏的标志性质感：球员和球倒映在清漆木地板上。地板已经是带清漆层的 PBR
   材质（court.js），但环境图只能反射"灯"，反射不出场上的人。

   做法（平面反射，反射场内球员、篮球和演出底层灯带）：
     1. 每帧主渲染前，用一台复制主相机投影与位姿的反射相机，把场景沿地面镜像
        （scene.scale.y=-1，Three 会按负行列式自动翻转面的朝向），只渲染第 7 图层
        到半分辨率贴图，背景透明——透明度就是"这里有倒影"的遮罩。
        用单独的相机对象，grade.js 的后期就不会接管这一趟（它只接管主相机）。
     2. 地板 / 三秒区 / 白线 / Logo 的材质按屏幕坐标采样这张贴图，轻度模糊、暖色压暗后
        按遮罩叠上去。三秒区是 .30 半透明色块，自然会透出下面地板的倒影。
   成本：多一趟球员渲染（玩家未烘焙，约数百次 draw call）。只在非触屏且内存 >2GB 的机器
   默认开启，低画质默认关闭；?reflect=1 强制开，?reflect=0 关。只在室内木地板可见时工作。 */
(function(global){
  "use strict";
  const LAYER=7;
  const query=new URLSearchParams(location.search);
  const forced=query.get("reflect");
  const coarse=typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches;
  const enabled=forced==="1"||(forced!=="0"&&!coarse&&(navigator.deviceMemory||4)>2&&query.get("quality")!=="low");

  /* 倒影强度：开启 HDRI 高光地板时提升至 NBA 2K 广播级清漆倒影（清晰映出球员双腿与篮球），?hdri=0 保持原版 0.38。 */
  const _hdriOn=!(typeof location!=="undefined"&&/(\?|&)hdri=0(&|#|$)/.test(location.search));
  const STRENGTH=_hdriOn?.62:.38;
  const uniforms={
    aibaRefl:{value:null},
    aibaReflStrength:{value:enabled?STRENGTH:0},
    aibaReflTexel:{value:new THREE.Vector2(1,1)}
  };
  /* 采样坐标用本片元在主相机下的投影位置，不用 gl_FragCoord/分辨率：主渲染画进 grade.js
     的后期贴图，那张贴图和画布尺寸不同，按像素换算会把倒影整体缩放偏移（实测倒影离脚一大截）。 */
  const VERT_DECL=`
    varying vec4 aibaReflClip;
    varying vec3 aibaReflRay,aibaReflGrain;
  `;
  const VERT_BODY=`
    aibaReflClip=gl_Position;
    aibaReflRay=cameraPosition-(modelMatrix*vec4(transformed,1.0)).xyz;
    // Project the wood grain along the local Y axis of the court plane.
    aibaReflGrain=(projectionMatrix*modelViewMatrix*vec4(0.0,1.0,0.0,0.0)).xyw;
  `;
  const FRAG_DECL=`
    uniform sampler2D aibaRefl;
    uniform vec2 aibaReflTexel;
    uniform float aibaReflStrength;
    ${VERT_DECL}
  `;
  const FRAG_BODY=`
    if(aibaReflStrength>0.0){
      vec2 ndc=aibaReflClip.xy/aibaReflClip.w;
      vec2 ruv=ndc*.5+.5;
      float rough=.38;
      #ifdef USE_CLEARCOAT_ROUGHNESSMAP
        rough=texture2D(clearcoatRoughnessMap,vUv).g;
      #endif
      vec2 along=(aibaReflGrain.xy-ndc*aibaReflGrain.z)/aibaReflTexel;
      along*=inversesqrt(max(dot(along,along),.001));
      vec2 across=vec2(-along.y,along.x);
      along*=mix(1.15,3.65,rough)*aibaReflTexel;
      across*=mix(.75,1.75,rough)*aibaReflTexel;
      vec4 rf=texture2D(aibaRefl,ruv)*.40
        +(texture2D(aibaRefl,ruv+along)+texture2D(aibaRefl,ruv-along))*.16
        +(texture2D(aibaRefl,ruv+across)+texture2D(aibaRefl,ruv-across))*.14;
      float grazing=1.0-clamp(abs(normalize(aibaReflRay).y),0.0,1.0);
      float varnish=mix(1.15,.69,rough)*mix(.55,1.12,grazing*grazing);
      float opacity=clamp(rf.a*aibaReflStrength*varnish,0.0,.82);
      vec3 reflection=rf.rgb/max(rf.a,.001)*vec3(1.0,.95,.88)*${_hdriOn?".81":".64"};
      gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.64+reflection,opacity);
    }
  `;
  const patchedMats=new WeakSet();
  function patchMaterial(m){
    if(!m||patchedMats.has(m))return;
    const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader
        .replace("#include <common>","#include <common>\n"+VERT_DECL)
        .replace("#include <project_vertex>","#include <project_vertex>\n"+VERT_BODY);
      shader.fragmentShader=shader.fragmentShader
        .replace("#include <common>","#include <common>\n"+FRAG_DECL)
        .replace("#include <dithering_fragment>",FRAG_BODY+"\n#include <dithering_fragment>");
    };
    m.customProgramCacheKey=()=>key+":aibaFloorReflect3";
    m.needsUpdate=true;
    patchedMats.add(m);
  }

  /* 反射对象：登记的球员（接地影除外）+ 场上的球 */
  const actors=[];
  const canWeak=typeof WeakRef==="function";
  function register(o){
    if(!enabled||!o||!o.g)return;
    actors.push(canWeak?new WeakRef(o):o);
  }
  function tagActor(o){
    o.g.traverse(n=>{if(n.isMesh)n.layers.enable(LAYER);});
    if(o.groundShadow)o.groundShadow.traverse(n=>n.layers.disable(LAYER));
  }
  let tagAcc=0;
  function tagAll(){
    for(let i=actors.length-1;i>=0;i--){
      const o=canWeak?actors[i].deref():actors[i];
      if(!o){actors.splice(i,1);continue;}
      tagActor(o);
    }
    /* 写实蒙皮球星(tripoAvatar)与传球手晴子(qingziPasserAvatar)直接挂在 scene 下，必须同样开启第 7 反射图层，
       否则 NBA 亮面木地板上完全没有写实球员的鞋底/双腿倒影，人物会显得“贴在地板上”。 */
    if(typeof scene!=="undefined"){
      scene.traverse(n=>{if(n.isLight)n.layers.enable(LAYER);});
      for(const c of scene.children){
        if(c&&(c.name==="tripoAvatar"||c.name==="qingziPasserAvatar"||c.userData?.tripo)){
          c.traverse(m=>{if(m.isMesh)m.layers.enable(LAYER);});
        }
      }
    }
  }

  let rt=null,reflectCam=null,ready=false;
  const size=new THREE.Vector2();
  function ensure(){
    if(typeof renderer==="undefined"||typeof scene==="undefined"||typeof camera==="undefined")return false;
    if(!ready){
      if(typeof courtFloor==="undefined"||!courtFloor)return false;
      patchMaterial(courtFloor.material);
      scene.traverse(n=>{if(n.isMesh&&(n.name==="courtZone"||n.name==="courtLine"||n.name==="courtMark"))patchMaterial(n.material);});
      reflectCam=new THREE.PerspectiveCamera();reflectCam.layers.set(LAYER);
      ready=true;tagAll();
    }
    renderer.getDrawingBufferSize(size);
    const shift=coarse?2:1;
    const w=Math.max(2,size.x>>shift),h=Math.max(2,size.y>>shift);
    if(!rt||rt.width!==w||rt.height!==h){
      if(rt)rt.dispose();
      rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
      rt.texture.encoding=renderer.outputEncoding;
      uniforms.aibaRefl.value=rt.texture;
      uniforms.aibaReflTexel.value.set(1/w,1/h);
    }
    return true;
  }

  const camPos=new THREE.Vector3(),clearColor=new THREE.Color(),hiddenBuf=[];
  function cullFar(){
    hiddenBuf.length=0;
    camera.getWorldPosition(camPos);
    for(const r of actors){
      const o=canWeak?r.deref():r;
      if(!o||!o.g.visible)continue;
      const p=o.g.position,offCourt=Math.abs(p.x)>8.1||p.z<-10.2||p.z>19.7;
      if(offCourt||camPos.distanceTo(p)>18){o.g.visible=false;hiddenBuf.push(o.g);}
    }
    return hiddenBuf;
  }
  function render(dt){
    if(!enabled)return;
    if(!courtFloor?.visible||currentScenePreset!=="indoor"){
      uniforms.aibaReflStrength.value=0;return;
    }
    if(!ensure())return;
    uniforms.aibaReflStrength.value=STRENGTH;
    tagAcc+=Number(dt)||0;if(tagAcc>.5){tagAcc=0;tagAll();}
    // 球与新加载的写实蒙皮球星每帧确保已入第 7 反射层
    try{
      if(typeof balls!=="undefined")for(const b of balls)if(b.mesh)b.mesh.layers.enable(LAYER);
      if(window.AIBATripo&&AIBATripo.ready&&AIBATripo.root&&!AIBATripo.root.userData._reflTagged){
        AIBATripo.root.traverse(m=>{if(m.isMesh)m.layers.enable(LAYER);});
        AIBATripo.root.userData._reflTagged=true;
      }
    }catch(e){}
    camera.updateMatrixWorld();
    reflectCam.projectionMatrix.copy(camera.projectionMatrix);
    reflectCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflectCam.matrix.copy(camera.matrixWorld);          // 渲染前 updateMatrixWorld 会从 matrix 重算，两份都要对
    reflectCam.matrixWorld.copy(camera.matrixWorld);
    reflectCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
    reflectCam.matrixAutoUpdate=false;
    const bg=scene.background,prevTarget=renderer.getRenderTarget(),autoShadow=renderer.shadowMap.autoUpdate;
    renderer.getClearColor(clearColor);
    const clearAlpha=renderer.getClearAlpha(),prevY=scene.scale.y;
    const characterY=global.AIBACharacterShading?.uniforms.aibaWorldYSign;
    /* 不手动 updateMatrixWorld：渲染器进 render 时自己会刷新（根节点缩放变了会带着整棵树重算），
       主渲染时缩放复原又会再刷一次。手动强刷等于每帧白做两遍全场遍历。 */
    scene.background=null;scene.scale.y=-prevY;
    if(characterY)characterY.value=-1;
    renderer.shadowMap.autoUpdate=false;          // 不拿镜像后的场景去更新阴影贴图
    /* 只倒映场内、镜头附近的人：场边替补离镜头远，倒影看不清，却每人要多画一两百次
       （实测整趟反射 +475 次 draw call，大头就在他们）。这一趟里临时藏起来。 */
    const hidden=cullFar();
    try{
      renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);
      renderer.render(scene,reflectCam);
    }
    finally{
      for(const g of hidden)g.visible=true;
      scene.scale.y=prevY;scene.background=bg;
      if(characterY)characterY.value=1;
      renderer.shadowMap.autoUpdate=autoShadow;
      renderer.setClearColor(clearColor,clearAlpha);
      renderer.setRenderTarget(prevTarget);
    }
  }

  global.AIBAFloorReflect=Object.freeze({enabled,register,render,uniforms,LAYER});
})(window);
