/* ---------------- 角色材质着色（M2 质感） ----------------
   诊断（docs/诊断记录/20260924-物理与建模诊断.md）：人物在比赛距离下轮廓读得清，
   问题是光照是平的——皮肤、球衣各是一块纯色，没有体积；和同样是方块的密集看台背景
   糊在一起。

   不动全局灯光（core.js 里前人已经实测回退过很多轮），只给角色材质加三项独立着色：
     1. 轮廓光：视线掠过表面时的冷色菲涅尔亮边，把人从看台背景里分出来。
        HY4 验收（docs/HY4-review-20260908.md）指出 r128 的灯光 layers 做不到"只照人"，
        推荐的正是"角色材质中的独立可控轮廓项"。
     2. 天光遮蔽：朝上的面略亮、朝下的面略暗，方块的体积与上下关系就出来了。
     3. 接地压暗：离地越近越暗（小腿、鞋），人不再像贴在地板上。
   做法是 onBeforeCompile 往现有材质里注入几行，材质对象不换——换装代码直接改
   material.color 的地方照常生效。?shade=classic 关闭，做前后对比。

   接线：characters.js 的 voxelGuy() 在返回前 register(g)；这里定时扫描已登记角色，
   给新出现的材质（换鞋、换装备）补上。 */
(function(global){
  "use strict";
  let enabled=true;
  try{enabled=new URLSearchParams(location.search).get("shade")!=="classic";}catch(e){}
  const uniforms={
    aibaRimColor:{value:new THREE.Color(0xffe6bf)},
    aibaRimStrength:{value:.38},
    aibaSunDir:{value:new THREE.Vector3(-.45,.72,.52)},
    aibaGroundColor:{value:new THREE.Color(0x4a5234)},
    aibaAirColor:{value:new THREE.Color(0x96885e)},
    aibaSceneMode:{value:0}, // 0=default/indoor, 1=rainforest, 2=flowerCourt, 3=other outdoor
    aibaWetness:{value:0},
    aibaSky:{value:.20},
    aibaContact:{value:.28}
  };
  const VERT_DECL="\nvarying vec3 aibaN;\nvarying vec3 aibaV;\nvarying vec3 aibaWN;\nvarying vec3 aibaWPos;\nvarying float aibaY;\n";
  const VERT_BODY=[
    "aibaN=normalize(normalMatrix*objectNormal);",
    "aibaV=-mvPosition.xyz;",
    "aibaWN=normalize(mat3(modelMatrix)*objectNormal);",
    "vec4 aibaWP=modelMatrix*vec4(transformed,1.0);",
    "aibaWPos=aibaWP.xyz;",
    "aibaY=aibaWP.y;"
  ].join("\n");
  const FRAG_DECL=[
    "",
    "uniform vec3 aibaRimColor;",
    "uniform float aibaRimStrength;",
    "uniform vec3 aibaSunDir;",
    "uniform vec3 aibaGroundColor;",
    "uniform vec3 aibaAirColor;",
    "uniform float aibaSceneMode;",
    "uniform float aibaWetness;",
    "uniform float aibaSky;",
    "uniform float aibaContact;",
    VERT_DECL
  ].join("\n");
  const FRAG_BODY=[
    "{",
    "  vec3 an=normalize(aibaN);vec3 av=normalize(aibaV);vec3 wn=normalize(aibaWN);",
    "  float up=clamp(wn.y,-1.0,1.0);",
    "  float sunDot=dot(wn,aibaSunDir);",
    // 1. 天光遮蔽 + 地面反弹环境光 (Ground Bounce GI)：朝下的面吸收场地草地/雨林泥土漫反射色
    "  float sky=1.0+aibaSky*up;",
    "  float contact=mix(1.0-aibaContact,1.0,smoothstep(0.02,0.58,aibaY));",
    "  gl_FragColor.rgb*=sky*contact;",
    "  float bounceMask=clamp(-up,0.0,1.0)*(0.35+0.65*(1.0-smoothstep(0.0,1.6,aibaY)));",
    "  gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*(0.65+0.85*aibaGroundColor),bounceMask*0.42);",
    // 2. 次表面散射暖血色 (Subsurface Terminator Warmth)：明暗交界线泛柔和暖红琥珀色，告别死灰塑料感
    "  float terminator=exp(-sunDot*sunDot*7.5)*max(0.0,1.0-abs(up)*0.5);",
    "  gl_FragColor.rgb+=gl_FragColor.rgb*vec3(0.22,0.075,0.025)*terminator;",
    // 3. 森林球场树冠斑驳遮阴 (保留人物清晰度与立体对比，仅做自然林间斑驳光影，不重复叠加浑浊雾色)
    "  float fres=pow(1.0-clamp(dot(an,av),0.0,1.0),2.7);",
    "  float sunSide=smoothstep(-0.25,0.65,sunDot)*(0.45+0.55*max(up,0.0));",
    "  if(aibaSceneMode<0.5){",
    // 3a. NBA 球馆 (indoor)：次世代 2K 顶棚马道聚光灯微高光 + 枫木金地板反弹 + 剧场紫金氛围背光融合
    "    vec3 arenaKey=normalize((viewMatrix*vec4(0.18,0.92,0.34,0.0)).xyz);",
    "    vec3 halfA=normalize(av+arenaKey);",
    "    float athleticSheen=pow(max(0.0,dot(an,halfA)),22.0)*(0.30+0.70*max(0.0,up));",
    "    gl_FragColor.rgb+=vec3(1.0,0.93,0.80)*athleticSheen*0.16;",
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(smoothstep(2.2,18.0,camDist)*0.055,0.01,0.065);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "    gl_FragColor.rgb+=vec3(0.30,0.22,0.48)*fres*(1.0-sunSide)*0.22;",
    "  }else if(aibaSceneMode>0.5&&aibaSceneMode<1.5){",
    "    vec2 q=aibaWPos.xz-aibaWPos.y*vec2(-0.55,0.42);",
    "    float dapple=0.5+0.5*(sin(q.x*1.45+q.y*1.05)*cos(q.y*1.65-q.x*0.92));",
    "    float canopy=mix(0.76,1.04,smoothstep(0.18,0.85,dapple));",
    "    vec3 forestTint=mix(vec3(0.86,0.90,0.74),vec3(1.05,0.97,0.82),smoothstep(0.25,0.82,dapple));",
    "    gl_FragColor.rgb*=forestTint*canopy;",
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(smoothstep(1.5,16.0,camDist)*0.07,0.02,0.08);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "  }else if(aibaSceneMode>1.5&&aibaSceneMode<2.5){",
    // 4. 鲜花草甸高原云影/空气包裹 + 雨天皮肤/球衣湿润高光 (Wet Specular Sheen)
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(0.08+smoothstep(1.0,16.0,camDist)*0.16,0.08,0.24);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "    if(aibaWetness>0.03){",
    "      vec3 halfV=normalize(av+normalize((viewMatrix*vec4(aibaSunDir,0.0)).xyz));",
    "      float wetSpec=pow(max(0.0,dot(an,halfV)),24.0)*(0.35+0.65*max(0.0,up));",
    "      gl_FragColor.rgb=gl_FragColor.rgb*(1.0-aibaWetness*0.14)+aibaRimColor*wetSpec*aibaWetness*0.42;",
    "    }",
    "  }else if(aibaSceneMode>3.5){",
    // 4b. 月球陨石坑 (lunarCrater)：阿波罗高反差真空日照 + 蓝色地球暗部天光补光 (Earthshine) + 腿部月尘包裹
    "    float shadowSide=clamp(-sunDot,0.0,1.0)*(0.42+0.58*max(0.0,up));",
    "    gl_FragColor.rgb+=gl_FragColor.rgb*vec3(0.14,0.28,0.52)*shadowSide+vec3(0.018,0.038,0.075)*shadowSide;",
    "    vec3 halfL=normalize(av+normalize((viewMatrix*vec4(aibaSunDir,0.0)).xyz));",
    "    float solarSpec=pow(max(0.0,dot(an,halfL)),26.0)*max(0.0,sunDot);",
    "    gl_FragColor.rgb+=vec3(0.95,0.97,1.0)*solarSpec*0.18;",
    "    float bootDust=(1.0-smoothstep(0.02,0.68,aibaY))*0.15;",
    "    float camDist=length(aibaV);",
    "    float dustVeil=clamp(bootDust+smoothstep(2.5,18.0,camDist)*0.055,0.0,0.18);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,dustVeil);",
    "    gl_FragColor.rgb+=vec3(0.32,0.62,1.0)*fres*(1.0-sunSide)*0.26;",
    "  }",
    // 5. 方向性太阳逆光轮廓金边 (Directional Sun Rim)：只照亮迎向太阳的一侧边缘，彻底去掉全向假蓝边
    "  gl_FragColor.rgb+=aibaRimColor*fres*aibaRimStrength*sunSide;",
    "}"
  ].join("\n");

  function inject(shader){
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>","#include <common>"+VERT_DECL)
      .replace("#include <project_vertex>","#include <project_vertex>\n"+VERT_BODY);
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>","#include <common>"+FRAG_DECL)
      .replace("#include <dithering_fragment>",FRAG_BODY+"\n#include <dithering_fragment>");
  }
  function shadeable(m){
    return m&&(m.isMeshLambertMaterial||m.isMeshStandardMaterial||m.isMeshPhongMaterial)&&!m.transparent;
  }
  let patched=0;
  function patchMaterial(m){
    if(!shadeable(m)||m.userData.aibaShade)return;
    /* 已经有别人的 onBeforeCompile 就不碰，免得互相覆盖（目前项目里没有） */
    if(m.onBeforeCompile&&m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return;
    m.userData.aibaShade=true;
    m.onBeforeCompile=inject;
    m.customProgramCacheKey=()=>"aibaShade1";
    m.needsUpdate=true;patched++;
  }
  function shadeTree(root){
    if(!enabled||!root)return;
    root.traverse(o=>{
      if(!o.isMesh||o.userData.aibaNoShade)return;
      if(Array.isArray(o.material))o.material.forEach(patchMaterial);else patchMaterial(o.material);
    });
  }

  /* 登记表：弱引用，角色被丢弃（更衣室预览关闭等）后自然释放 */
  const refs=[];
  const canWeak=typeof WeakRef==="function";
  function register(g){
    if(!enabled||!g)return;
    shadeTree(g);
    refs.push(canWeak?new WeakRef(g):g);
    if(refs.length>64)prune();
  }
  function prune(){
    for(let i=refs.length-1;i>=0;i--){
      const g=canWeak?refs[i].deref():refs[i];
      if(!g||(!canWeak&&!g.parent))refs.splice(i,1);
    }
  }
  function syncSceneLight(){
    try{
      const preset=(typeof currentScenePreset==="string"&&currentScenePreset)||document.documentElement.dataset.scenePreset||"indoor";
      if(preset==="rainforest"){
        uniforms.aibaSceneMode.value=1;
        const envRoot=(typeof environmentRoot!=="undefined"&&environmentRoot)||global.environmentRoot;
        const rf=envRoot?.userData?.placeState?.rainforest;
        const cyc=rf?.uniforms?.forestCycle?.value;
        const dusk=cyc?cyc.x:0,night=cyc?cyc.y:0,ff=cyc?cyc.z:0;
        uniforms.aibaRimColor.value.setHex(0xffd488).lerp(new THREE.Color(0xff7e38),dusk).lerp(new THREE.Color(0x88d468),night*(.35+.65*ff));
        uniforms.aibaRimStrength.value=THREE.MathUtils.lerp(.44+.12*dusk,.14+.22*ff,night);
        uniforms.aibaGroundColor.value.setHex(0x525832).lerp(new THREE.Color(0x4a3420),dusk*.7).lerp(new THREE.Color(0x0a1410),night);
        uniforms.aibaAirColor.value.setHex(0x9a895a).lerp(new THREE.Color(0xa85a32),dusk*.8).lerp(new THREE.Color(0x060c10),night);
        uniforms.aibaWetness.value=.15;
      }else if(preset==="flowerCourt"){
        uniforms.aibaSceneMode.value=2;
        const m=global.environmentRoot?.userData?.placeState?.meadow;
        const gold=m?m.uniforms.meadowSky.value.y:0;
        const clear=m?m.uniforms.meadowSky.value.x:.5;
        uniforms.aibaWetness.value=m?m.wetness:0;
        uniforms.aibaRimColor.value.setHex(0xdce8f2).lerp(new THREE.Color(0xffe6ba),clear).lerp(new THREE.Color(0xffb468),gold);
        uniforms.aibaRimStrength.value=.32+.18*clear+.12*gold;
        uniforms.aibaGroundColor.value.setHex(0x5f743e).lerp(new THREE.Color(0x7c743e),gold*.6);
        uniforms.aibaAirColor.value.setHex(0x889ca8).lerp(new THREE.Color(0xd8b888),gold*.75+.2*clear);
      }else if(preset==="lunarCrater"){
        uniforms.aibaSceneMode.value=4;
        uniforms.aibaRimColor.value.setHex(0xf4f8ff);
        uniforms.aibaRimStrength.value=.50;
        uniforms.aibaGroundColor.value.setHex(0x6e737c);
        uniforms.aibaAirColor.value.setHex(0x828a96);
        uniforms.aibaWetness.value=0;
      }else if(preset!=="indoor"){
        uniforms.aibaSceneMode.value=3;
        if(typeof sun!=="undefined"&&sun)uniforms.aibaRimColor.value.copy(sun.color);
        uniforms.aibaRimStrength.value=.36;
        if(typeof hemi!=="undefined"&&hemi)uniforms.aibaGroundColor.value.copy(hemi.groundColor);
        if(typeof scene!=="undefined"&&scene?.fog)uniforms.aibaAirColor.value.copy(scene.fog.color);
        uniforms.aibaWetness.value=preset==="rainyCourt"?.65:0;
      }else{
        uniforms.aibaSceneMode.value=0;
        uniforms.aibaRimColor.value.setHex(0xffe6bd);
        uniforms.aibaRimStrength.value=.36;
        uniforms.aibaGroundColor.value.setHex(0x9a7542);
        uniforms.aibaAirColor.value.setHex(0x362a48);
        uniforms.aibaWetness.value=0;
      }
      if(typeof sun!=="undefined"&&sun&&sun.position.lengthSq()>0.01){
        uniforms.aibaSunDir.value.copy(sun.position).normalize();
      }
    }catch(e){}
  }
  let _sweepTick=0;
  function sweep(){
    syncSceneLight();
    for(const r of refs){const g=canWeak?r.deref():r;if(g&&g.parent)shadeTree(g);}
    // 写实蒙皮皮套 (tripoAvatar / fpSharedPoseRig) 直接挂在 scene 下，必须一并扫描注入场景大气与树冠光影！
    if(typeof scene!=="undefined"&&scene&&scene.children){
      for(const c of scene.children){
        if(c&&(c.name==="tripoAvatar"||c.name==="fpSharedPoseRig"||c.userData?.tripo))shadeTree(c);
      }
    }
    if(typeof matBall!=="undefined"){
      for(const bm of [matBall,typeof matGold!=="undefined"?matGold:null,typeof matDeep!=="undefined"?matDeep:null]){
        if(bm)patchMaterial(bm);
      }
    }
    if(typeof balls!=="undefined"&&Array.isArray(balls)){
      for(const b of balls)if(b&&b.mesh&&b.mesh.material)patchMaterial(b.mesh.material);
    }
    if(typeof pBall!=="undefined"&&pBall?.material)patchMaterial(pBall.material);
    if(typeof handBall!=="undefined"&&handBall?.material)patchMaterial(handBall.material);
  }
  function onBeforeRender(){
    syncSceneLight();
    if((_sweepTick++%10)===0)sweep();
  }
  if(enabled)setInterval(sweep,400);

  global.AIBACharacterShading=Object.freeze({
    enabled,register,shadeTree,patchMaterial,syncSceneLight:onBeforeRender,uniforms,
    get patched(){return patched;}
  });
})(window);
