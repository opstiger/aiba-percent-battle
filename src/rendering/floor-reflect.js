/* ---------------- 地板反射（M4 场地质感） ----------------
   高级篮球游戏的标志性质感：球员和球倒映在清漆木地板上。地板已经是带清漆层的 PBR
   材质（court.js），但环境图只能反射"灯"，反射不出场上的人。

   做法（平面反射，只反射球员和球）：
     1. 每帧主渲染前，用一台复制主相机投影与位姿的反射相机，把场景沿地面镜像
        （scene.scale.y=-1，Three 会按负行列式自动翻转面的朝向），只渲染第 7 图层
        （球员、球）到半分辨率贴图，背景透明——透明度就是"这里有倒影"的遮罩。
        用单独的相机对象，grade.js 的后期就不会接管这一趟（它只接管主相机）。
     2. 地板 / 三秒区 / 白线 / Logo 的材质按屏幕坐标采样这张贴图，轻度模糊、暖色压暗后
        按遮罩叠上去。三秒区是 .30 半透明色块，自然会透出下面地板的倒影。
   成本：多一趟球员渲染（玩家未烘焙，约数百次 draw call）。只在非触屏且内存 >2GB 的机器
   默认开启；?reflect=1 强制开，?reflect=0 关。只在室内木地板可见时工作。 */
(function(global){
  "use strict";
  const LAYER=7;
  let forced=null;
  try{const q=new URLSearchParams(location.search).get("reflect");if(q==="1"||q==="0")forced=q==="1";}catch(e){}
  const coarse=typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches;
  const enabled=forced!==null?forced:(!coarse&&(navigator.deviceMemory||4)>2);

  const uniforms={
    aibaRefl:{value:null},
    aibaReflRes:{value:new THREE.Vector2(1,1)},
    aibaReflStrength:{value:enabled?.62:0},
    aibaReflTexel:{value:new THREE.Vector2(1,1)}
  };
  /* 采样坐标用本片元在主相机下的投影位置，不用 gl_FragCoord/分辨率：主渲染画进 grade.js
     的后期贴图，那张贴图和画布尺寸不同，按像素换算会把倒影整体缩放偏移（实测倒影离脚一大截）。 */
  const VERT_DECL="\nvarying vec4 aibaReflClip;\n";
  const FRAG_DECL="\nuniform sampler2D aibaRefl;\nuniform vec2 aibaReflRes;\nuniform vec2 aibaReflTexel;\nuniform float aibaReflStrength;\nvarying vec4 aibaReflClip;\n";
  const FRAG_BODY=[
    "{",
    "  vec2 ruv=aibaReflClip.xy/aibaReflClip.w*.5+.5;",
    // 5 点小模糊：清漆面的倒影不是镜面，边缘是虚的
    "  vec4 rf=texture2D(aibaRefl,ruv)*.36",
    "    +texture2D(aibaRefl,ruv+vec2(aibaReflTexel.x*1.6,0.0))*.16+texture2D(aibaRefl,ruv-vec2(aibaReflTexel.x*1.6,0.0))*.16",
    "    +texture2D(aibaRefl,ruv+vec2(0.0,aibaReflTexel.y*2.2))*.16+texture2D(aibaRefl,ruv-vec2(0.0,aibaReflTexel.y*2.2))*.16;",
    "  float ra=clamp(rf.a,0.0,1.0)*aibaReflStrength;",
    // 倒影被木色吃掉一部分：暖色、压暗；同时地板在倒影处略暗（被遮住的是灯的反射）
    "  vec3 tint=rf.rgb/max(rf.a,1e-3)*vec3(1.0,.9,.78)*.62;",
    "  gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.7+tint,ra);",
    "}"
  ].join("\n");
  function inject(shader){
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>","#include <common>"+VERT_DECL)
      .replace("#include <project_vertex>","#include <project_vertex>\naibaReflClip=gl_Position;");
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>","#include <common>"+FRAG_DECL)
      .replace("#include <dithering_fragment>",FRAG_BODY+"\n#include <dithering_fragment>");
  }
  const patchedMats=new Set();
  function patchMaterial(m){
    if(!m||patchedMats.has(m))return;
    if(m.onBeforeCompile&&m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return;
    m.onBeforeCompile=inject;m.customProgramCacheKey=()=>"aibaFloorReflect2";m.needsUpdate=true;
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
    if(typeof scene!=="undefined")scene.traverse(n=>{if(n.isLight)n.layers.enable(LAYER);});
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
    const w=Math.max(2,size.x>>1),h=Math.max(2,size.y>>1);
    if(!rt||rt.width!==w||rt.height!==h){
      if(rt)rt.dispose();
      rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
      uniforms.aibaRefl.value=rt.texture;
    }
    uniforms.aibaReflRes.value.copy(size);
    uniforms.aibaReflTexel.value.set(1/w,1/h);
    return true;
  }

  const camPos=new THREE.Vector3(),hiddenBuf=[];
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
    if(!enabled||!ensure())return;
    // 只在室内木地板看得见时工作；户外球场是别的地面
    if(!courtFloor.visible||(typeof currentScenePreset!=="undefined"&&currentScenePreset!=="indoor")){
      uniforms.aibaReflStrength.value=0;return;
    }
    uniforms.aibaReflStrength.value=.62;
    tagAcc+=Number(dt)||0;if(tagAcc>.5){tagAcc=0;tagAll();}
    // 球每帧补标（新出手的球）
    try{if(typeof balls!=="undefined")for(const b of balls)if(b.mesh)b.mesh.layers.enable(LAYER);}catch(e){}
    camera.updateMatrixWorld();
    reflectCam.projectionMatrix.copy(camera.projectionMatrix);
    reflectCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflectCam.matrix.copy(camera.matrixWorld);          // 渲染前 updateMatrixWorld 会从 matrix 重算，两份都要对
    reflectCam.matrixWorld.copy(camera.matrixWorld);
    reflectCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
    reflectCam.matrixAutoUpdate=false;
    const bg=scene.background,prevTarget=renderer.getRenderTarget(),autoShadow=renderer.shadowMap.autoUpdate;
    const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
    /* 不手动 updateMatrixWorld：渲染器进 render 时自己会刷新（根节点缩放变了会带着整棵树重算），
       主渲染时缩放复原又会再刷一次。手动强刷等于每帧白做两遍全场遍历。 */
    scene.background=null;scene.scale.y=-1;
    renderer.shadowMap.autoUpdate=false;          // 不拿镜像后的场景去更新阴影贴图
    /* 只倒映场内、镜头附近的人：场边替补离镜头远，倒影看不清，却每人要多画一两百次
       （实测整趟反射 +475 次 draw call，大头就在他们）。这一趟里临时藏起来。 */
    const hidden=cullFar();
    renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.clear(true,true,false);
    try{renderer.render(scene,reflectCam);}
    finally{
      for(const g of hidden)g.visible=true;
      scene.scale.y=1;scene.background=bg;
      renderer.shadowMap.autoUpdate=autoShadow;
      renderer.setClearColor(clearColor,clearAlpha);
      renderer.setRenderTarget(prevTarget);
    }
  }

  global.AIBAFloorReflect=Object.freeze({enabled,register,render,uniforms,LAYER});
})(window);
