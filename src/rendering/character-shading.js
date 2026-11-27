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
    aibaFillColor:{value:new THREE.Color()},
    aibaFillDir:{value:new THREE.Vector3()},
    aibaFillStrength:{value:0},
    aibaWorldYSign:{value:1},
    aibaSunDir:{value:new THREE.Vector3(-.45,.72,.52)},
    aibaGroundColor:{value:new THREE.Color(0x4a5234)},
    aibaAirColor:{value:new THREE.Color(0x96885e)},
    aibaSceneMode:{value:0}, // 0=default/indoor, 1=rainforest, 2=flowerCourt, 3=other outdoor
    aibaWetness:{value:0},
    aibaSky:{value:.20},
    aibaContact:{value:.28}
  };
  const colorScratch=new THREE.Color();
  const directionScratch=new THREE.Vector3();
  const VERT_DECL="\nvarying vec3 aibaN;\nvarying vec3 aibaV;\nvarying vec3 aibaWN;\nvarying vec3 aibaWPos;\nvarying float aibaY;\n";
  const VERT_BODY=[
    "aibaN=normalize(normalMatrix*objectNormal);",
    "aibaV=-mvPosition.xyz;",
    "aibaWN=normalize(mat3(modelMatrix)*objectNormal);aibaWN.y*=aibaWorldYSign;",
    "vec4 aibaWP=modelMatrix*vec4(transformed,1.0);",
    "aibaWPos=vec3(aibaWP.x,aibaWP.y*aibaWorldYSign,aibaWP.z);",
    "aibaY=aibaWPos.y;"
  ].join("\n");
  const FRAG_DECL=[
    "",
    "uniform vec3 aibaRimColor;",
    "uniform float aibaRimStrength;",
    "uniform vec3 aibaFillColor,aibaFillDir;",
    "uniform float aibaFillStrength;",
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
    // 1. 天光遮蔽 + 紧贴鞋底缝隙的接触压暗(soleAO) + 地面反弹环境光 (Ground Bounce GI)
    "  float sky=1.0+aibaSky*up;",
    "  float contact=mix(1.0-aibaContact,1.0,smoothstep(0.04,0.52,aibaY));",
    "  float soleAO=mix(0.48,1.0,smoothstep(0.0,0.11,aibaY));",
    "  gl_FragColor.rgb*=sky*contact*soleAO;",
    "  float lowH=1.0-smoothstep(0.0,1.25,aibaY);",
    "  float bounceMask=(0.28+0.72*clamp(-up,0.0,1.0))*lowH;",
    "  gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*(0.56+0.98*aibaGroundColor),bounceMask*0.56);",
    // 2. 次表面散射暖血色 (Subsurface Terminator Warmth)：明暗交界线泛柔和暖红琥珀色，告别死灰塑料感
    "  float terminator=exp(-sunDot*sunDot*7.5)*max(0.0,1.0-abs(up)*0.5);",
    "  gl_FragColor.rgb+=gl_FragColor.rgb*vec3(0.20,0.070,0.022)*terminator;",
    "  float fres=pow(1.0-clamp(dot(an,av),0.0,1.0),2.6);",
    "  float sunSide=smoothstep(-0.25,0.65,sunDot)*(0.45+0.55*max(up,0.0));",
    "  if(aibaSceneMode<0.5){",
    // 3a. NBA 球馆 (indoor)：顶棚马道聚光灯微高光 + 暖枫木地板金光上扬反弹 + 紫金场边灯带双色轮廓融合
    "    vec3 arenaKey=normalize((viewMatrix*vec4(0.18,0.92,0.34,0.0)).xyz);",
    "    vec3 halfA=normalize(av+arenaKey);",
    "    float athleticSheen=pow(max(0.0,dot(an,halfA)),20.0)*(0.35+0.65*max(0.0,up));",
    "    gl_FragColor.rgb+=vec3(1.0,0.92,0.76)*athleticSheen*0.22;",
    "    float floorUp=clamp(-up,0.0,1.0)*lowH;",
    "    gl_FragColor.rgb+=vec3(0.24,0.16,0.07)*floorUp*0.55;",
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(smoothstep(2.2,18.0,camDist)*0.05,0.01,0.06);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "    #ifndef AIBA_ACTOR",
    "    float purpleSide=clamp(-wn.x*0.5+0.5,0.0,1.0);",
    "    gl_FragColor.rgb+=mix(vec3(0.42,0.22,0.72),vec3(0.75,0.54,0.18),purpleSide)*fres*(1.0-sunSide)*0.30;",
    "    #endif",
    "  }else if(aibaSceneMode>0.5&&aibaSceneMode<1.5){",
    // 3b. 热带深林 (rainforest)：真实树冠斑驳光影 + 浓绿苔藓上反光 + 潮湿叶隙暖金边 + 环境色调统一
    "    vec2 q=aibaWPos.xz-aibaWPos.y*vec2(-0.52,0.40);",
    "    float dapple=0.5+0.5*(sin(q.x*1.55+q.y*1.12)*cos(q.y*1.75-q.x*0.98));",
    "    float canopy=mix(0.52,1.12,smoothstep(0.16,0.84,dapple));",
    "    vec3 forestTint=mix(vec3(0.64,0.80,0.54),vec3(1.08,0.96,0.74),smoothstep(0.22,0.82,dapple));",
    "    gl_FragColor.rgb*=forestTint*canopy;",
    "    float mossWrap=1.0-smoothstep(0.0,0.16,aibaY);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.14,0.18,0.08),mossWrap*0.36);",
    "    float mossBounce=(1.0-smoothstep(0.0,0.95,aibaY))*(0.35+0.65*clamp(-up,0.0,1.0));",
    "    gl_FragColor.rgb+=vec3(0.08,0.13,0.04)*mossBounce;",
    "    vec3 halfR=normalize(av+normalize((viewMatrix*vec4(aibaSunDir,0.0)).xyz));",
    "    float humidSheen=pow(max(0.0,dot(an,halfR)),24.0)*(0.30+0.70*max(0.0,up))*smoothstep(0.35,0.85,dapple);",
    "    gl_FragColor.rgb+=vec3(1.0,0.88,0.62)*humidSheen*0.20;",
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(smoothstep(1.5,16.0,camDist)*0.10,0.03,0.11);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "    #ifndef AIBA_ACTOR",
    "    gl_FragColor.rgb+=vec3(0.24,0.36,0.14)*fres*(1.0-sunSide)*0.24;",
    "    #endif",
    "  }else if(aibaSceneMode>1.5&&aibaSceneMode<2.5){",
    // 4. 鲜花草甸 (flowerCourt)：草根贴鞋绿影包裹 + 高原草地绿金上反光 + 背阴冷蓝天光反差
    "    float grassFoot=1.0-smoothstep(0.0,0.13,aibaY);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.18,0.28,0.10),grassFoot*0.38);",
    "    float grassBounce=(1.0-smoothstep(0.0,1.05,aibaY))*(0.40+0.60*clamp(-up,0.0,1.0));",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(0.84,1.04,0.72)+vec3(0.05,0.10,0.03),grassBounce*0.38);",
    "    float coolShadow=clamp(-sunDot,0.0,1.0)*(0.38+0.62*max(0.0,up));",
    "    gl_FragColor.rgb+=vec3(0.05,0.11,0.20)*coolShadow;",
    "    float camDist=length(aibaV);",
    "    float airVeil=clamp(0.06+smoothstep(1.0,16.0,camDist)*0.14,0.06,0.21);",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,aibaAirColor,airVeil);",
    "    if(aibaWetness>0.03){",
    "      vec3 halfV=normalize(av+normalize((viewMatrix*vec4(aibaSunDir,0.0)).xyz));",
    "      float wetSpec=pow(max(0.0,dot(an,halfV)),24.0)*(0.35+0.65*max(0.0,up));",
    "      gl_FragColor.rgb=gl_FragColor.rgb*(1.0-aibaWetness*0.14)+aibaRimColor*wetSpec*aibaWetness*0.42;",
    "    }",
    "  }else if(aibaSceneMode>3.5){",
    // 4b. 月球陨石坑 (lunarCrater)：阿波罗真空炽白直射 + 右上角真实地球方向冷蓝反照光(Earthshine) + 鞋底月尘包裹
    "    vec3 earthDir=normalize(vec3(0.46,0.38,-0.80));",
    "    float earthDot=max(0.0,dot(wn,earthDir));",
    "    float shadowSide=clamp(-sunDot*0.75+0.25,0.0,1.0);",
    "    gl_FragColor.rgb+=gl_FragColor.rgb*vec3(0.16,0.38,0.76)*earthDot*shadowSide+vec3(0.022,0.065,0.145)*earthDot*shadowSide;",
    "    vec3 halfL=normalize(av+normalize((viewMatrix*vec4(aibaSunDir,0.0)).xyz));",
    "    float solarSpec=pow(max(0.0,dot(an,halfL)),26.0)*max(0.0,sunDot);",
    "    gl_FragColor.rgb+=vec3(0.98,0.99,1.0)*solarSpec*0.24;",
    "    float bootDust=(1.0-smoothstep(0.02,0.36,aibaY))*0.24;",
    "    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.36,0.38,0.42),bootDust);",
    "    #ifndef AIBA_ACTOR",
    "    gl_FragColor.rgb+=vec3(0.28,0.62,1.0)*fres*earthDot*0.42;",
    "    #endif",
    "  }",
    // 5. 方向性主光逆光轮廓金边 (Directional Sun Rim)
    "  gl_FragColor.rgb+=aibaRimColor*fres*aibaRimStrength*sunSide;",
    "  #ifdef AIBA_ACTOR",
    "  float fill=smoothstep(-0.10,0.76,dot(wn,aibaFillDir));",
    "  float aboveSole=smoothstep(0.025,0.32,aibaY);",
    "  gl_FragColor.rgb+=aibaFillColor*fres*fill*aibaFillStrength*aboveSole;",
    "  #endif",
    "}"
  ].join("\n");

  // Skinned heroes already have material-specific highlights. Add only the
  // venue response here, in linear light, before the scene tone map and fog.
  const HERO_FRAG_BODY=`
{
  vec3 worldNormal=normalize(aibaWN);
  vec3 viewNormal=normalize(aibaN);
  #ifdef DOUBLE_SIDED
    float faceSign=gl_FrontFacing?1.0:-1.0;
    worldNormal*=faceSign;
    viewNormal*=faceSign;
  #endif
  float up=worldNormal.y;
  float sunDot=dot(worldNormal,aibaSunDir);
  float bounce=(1.0-smoothstep(0.04,1.15,aibaY)) * (0.18+0.82*max(0.0,-up));
  vec3 groundLight=aibaGroundColor*aibaGroundColor;
  gl_FragColor.rgb+=diffuseColor.rgb*groundLight*bounce*0.15;
  if(aibaSceneMode>0.5&&aibaSceneMode<1.5){
    vec2 q=aibaWPos.xz-aibaWPos.y*vec2(-0.52,0.40);
    float dapple=0.5+0.5*sin(q.x*1.55+q.y*1.12)*cos(q.y*1.75-q.x*0.98);
    float openSky=smoothstep(0.16,0.84,dapple);
    vec3 canopy=mix(vec3(0.54,0.66,0.45),vec3(0.99,0.95,0.83),openSky);
    float lightSide=smoothstep(-0.65,0.50,sunDot);
    gl_FragColor.rgb*=canopy*mix(0.75,1.03,lightSide);
  }else if(aibaSceneMode>1.5&&aibaSceneMode<2.5){
    float shadowSide=max(0.0,-sunDot);
    gl_FragColor.rgb+=diffuseColor.rgb*vec3(0.024,0.042,0.084)*shadowSide;
    gl_FragColor.rgb*=1.0-aibaWetness*0.08;
  }else if(aibaSceneMode>3.5){
    float earthLight=max(0.0,dot(worldNormal,vec3(0.46,0.38,-0.80)));
    gl_FragColor.rgb+=diffuseColor.rgb*vec3(0.025,0.060,0.14)*earthLight;
  }
  float contact=smoothstep(0.015,0.20,aibaY);
  gl_FragColor.rgb*=mix(0.84,1.0,contact);
  float facing=clamp(dot(viewNormal,normalize(aibaV)),0.0,1.0);
  float rim=1.0-facing;
  float keySide=smoothstep(-0.20,0.72,sunDot);
  vec3 keyColor=aibaRimColor*aibaRimColor;
  if(aibaFillStrength>0.0){
    float fillSide=smoothstep(-0.10,0.76,dot(worldNormal,aibaFillDir));
    vec3 fillColor=aibaFillColor*aibaFillColor;
    vec3 edge=keyColor*aibaRimStrength*keySide*0.40+fillColor*aibaFillStrength*fillSide;
    gl_FragColor.rgb+=edge*rim*rim*rim*contact;
    // Use the normal map and existing skin, fabric and shoe roughness.
    // Grazing fabric is broader and dimmer than the specular on smooth trim.
    vec3 keyView=mat3(viewMatrix)*aibaSunDir;
    vec3 halfDir=normalize(normalize(aibaV)+keyView);
    float surfaceRoughness=clamp(roughnessFactor,0.0,1.0);
    float sheen=pow(max(0.0,dot(normal,halfDir)),mix(42.0,9.0,surfaceRoughness));
    float sheenStrength=mix(0.13,0.035,surfaceRoughness);
    gl_FragColor.rgb+=keyColor*sheen*sheenStrength*keySide*aibaRimStrength*contact;
  }else{
    gl_FragColor.rgb+=keyColor*rim*rim*rim*aibaRimStrength*keySide*0.21;
  }
}
`;

  function inject(shader){
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>","#include <common>\nuniform float aibaWorldYSign;"+VERT_DECL)
      .replace("#include <project_vertex>","#include <project_vertex>\n"+VERT_BODY);
    const hero=this.userData.aibaLinearCharacter;
    const actor=this.userData.aibaShadeActor;
    const insertion=hero?"#include <tonemapping_fragment>":"#include <dithering_fragment>";
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>","#include <common>"+(actor?"\n#define AIBA_ACTOR":"")+FRAG_DECL)
      .replace(insertion,(hero?HERO_FRAG_BODY:FRAG_BODY)+"\n"+insertion);
  }
  function shadeable(m){
    return m&&(m.isMeshLambertMaterial||m.isMeshStandardMaterial||m.isMeshPhongMaterial)&&!m.transparent;
  }
  let patched=0;
  const patchedMaterials=new WeakSet();
  /* 分球场 PMREM 环境光贴图（IBL）：默认首帧秒出轻量程序渐变，随后异步无缝替换为 Colab Cycles 烘焙的 360° 全景 HDRI
     （支持 ?hdri=0 一键切回纯程序渐变做前后对比）。每帧 0 额外开销，人物/篮球/篮筐立刻吃进真实场景反射光！ */
  const _hdriEnabled=!(typeof location!=="undefined"&&/(\?|&)hdri=0(&|#|$)/.test(location.search));
  const _venueEnvCache=new Map();
  const _venueHdriLoading=new Set();
  const _venueHdriPaths={
    indoor:"assets/hdri/indoor.hdr",
    flowerCourt:"assets/hdri/flowerCourt.hdr",
    lunarCrater:"assets/hdri/lunarCrater.hdr",
    rainforest:"assets/hdri/rainforest.hdr"
  };
  let _pmremGen=null;
  let _activeEnvKey=null,_activeEnvTex=null,_activeEnvInt=0.45;
  const _pbrMats=new Set();

  function _commitVenueHdri(key,tex){
    const envTex=_pmremGen.fromEquirectangular(tex).texture;
    tex.dispose();
    _venueEnvCache.set(key,envTex);
    window.AIBA_HDRI_STATUS=Object.assign(window.AIBA_HDRI_STATUS||{},{[key]:true});
    if(_activeEnvKey===key){
      _activeEnvTex=envTex;
      _pbrMats.forEach(applyVenueEnv);
      if(typeof window.AIBA_SYNC_COURT_HDRI==="function")window.AIBA_SYNC_COURT_HDRI(key,envTex);
    }
  }

  function _kickLoadVenueHdri(key){
    if(!_hdriEnabled||_venueHdriLoading.has(key)||!_venueHdriPaths[key])return;
    if(!_pmremGen)return;
    _venueHdriLoading.add(key);
    try{
      if(typeof window.AIBA_LOAD_HDR==="function"){
        window.AIBA_LOAD_HDR(_venueHdriPaths[key],tex=>{
          try{_commitVenueHdri(key,tex);}catch(e){}
        },()=>{
          if(typeof THREE.TextureLoader==="function"){
            new THREE.TextureLoader().load(_venueHdriPaths[key].replace(/\.hdr$/,".webp"),tex=>{
              try{if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;_commitVenueHdri(key,tex);}catch(e){}
            },undefined,()=>{});
          }
        });
      }
    }catch(e){}
  }

  function getVenueEnv(preset){
    const key=(preset==="flowerCourt"||preset==="lunarCrater"||preset==="rainforest"||preset==="indoor")?preset:"indoor";
    if(_venueEnvCache.has(key)){
      _kickLoadVenueHdri(key);
      return _venueEnvCache.get(key);
    }
    if(typeof renderer==="undefined"||!renderer||typeof THREE.PMREMGenerator!=="function")return null;
    try{
      if(!_pmremGen){
        _pmremGen=new THREE.PMREMGenerator(renderer);
        _pmremGen.compileEquirectangularShader();
      }
      const c=document.createElement("canvas");c.width=128;c.height=64;
      const g=c.getContext("2d");
      const grad=g.createLinearGradient(0,0,0,64);
      if(key==="flowerCourt"){
        grad.addColorStop(0.00,"#5b9bd5");
        grad.addColorStop(0.45,"#cfe6f5");
        grad.addColorStop(0.54,"#88a45c");
        grad.addColorStop(1.00,"#445e28");
        g.fillStyle=grad;g.fillRect(0,0,128,64);
        const sg=g.createRadialGradient(34,18,1,34,18,18);
        sg.addColorStop(0,"rgba(255,248,220,1)");sg.addColorStop(1,"rgba(255,240,200,0)");
        g.fillStyle=sg;g.fillRect(0,0,128,64);
      }else if(key==="lunarCrater"){
        grad.addColorStop(0.00,"#04060c");
        grad.addColorStop(0.48,"#080c16");
        grad.addColorStop(0.55,"#2a2e38");
        grad.addColorStop(1.00,"#14161c");
        g.fillStyle=grad;g.fillRect(0,0,128,64);
        /* 炽白太阳点光源 + 右上方蓝色地球反照球 */
        const sunG=g.createRadialGradient(26,24,1,26,24,12);
        sunG.addColorStop(0,"rgba(255,255,248,1)");sunG.addColorStop(1,"rgba(255,250,235,0)");
        g.fillStyle=sunG;g.fillRect(0,0,128,64);
        const earthG=g.createRadialGradient(92,20,2,92,20,22);
        earthG.addColorStop(0,"rgba(90,165,255,0.95)");earthG.addColorStop(1,"rgba(40,95,200,0)");
        g.fillStyle=earthG;g.fillRect(0,0,128,64);
      }else if(key==="rainforest"){
        grad.addColorStop(0.00,"#3b5224");
        grad.addColorStop(0.42,"#74884a");
        grad.addColorStop(0.55,"#36401a");
        grad.addColorStop(1.00,"#1a220c");
        g.fillStyle=grad;g.fillRect(0,0,128,64);
        /* 树冠间隙洒下的暖金光斑 */
        for(const [sx,sy,sr] of [[32,14,14],[76,12,12],[104,18,10]]){
          const rg=g.createRadialGradient(sx,sy,1,sx,sy,sr);
          rg.addColorStop(0,"rgba(255,222,145,0.92)");rg.addColorStop(1,"rgba(255,200,110,0)");
          g.fillStyle=rg;g.fillRect(0,0,128,64);
        }
      }else{
        /* NBA 球馆：深暗顶棚 + 四组暖金马道聚光灯 + 紫金环场灯带 + 暖枫木地板反弹 */
        grad.addColorStop(0.00,"#141828");
        grad.addColorStop(0.40,"#362856");
        grad.addColorStop(0.52,"#8a683a");
        grad.addColorStop(1.00,"#5a3f20");
        g.fillStyle=grad;g.fillRect(0,0,128,64);
        for(const sx of [20,52,84,112]){
          const lg=g.createRadialGradient(sx,12,1,sx,12,13);
          lg.addColorStop(0,"rgba(255,244,218,1)");lg.addColorStop(1,"rgba(255,230,180,0)");
          g.fillStyle=lg;g.fillRect(0,0,128,64);
        }
      }
      const srcTex=new THREE.CanvasTexture(c);
      srcTex.encoding=THREE.sRGBEncoding;
      const envTex=_pmremGen.fromEquirectangular(srcTex).texture;
      srcTex.dispose();
      _venueEnvCache.set(key,envTex);
      _kickLoadVenueHdri(key);
      return envTex;
    }catch(e){return null;}
  }

  function applyVenueEnv(m){
    if(!m||!m.isMeshStandardMaterial||!_activeEnvTex)return;
    if(m.envMap!==_activeEnvTex||Math.abs((m.envMapIntensity||0)-_activeEnvInt)>0.02){
      m.envMap=_activeEnvTex;
      m.envMapIntensity=_activeEnvInt;
      m.needsUpdate=true;
    }
  }

  function patchMaterial(m,actor=false){
    if(!shadeable(m))return;
    if(m.isMeshStandardMaterial){_pbrMats.add(m);applyVenueEnv(m);}
    if(patchedMaterials.has(m))return;
    /* 已经有别人的 onBeforeCompile 就不碰，免得互相覆盖（目前项目里没有） */
    if(m.onBeforeCompile&&m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return;
    patchedMaterials.add(m);
    m.userData.aibaShadeActor=actor;
    m.onBeforeCompile=inject;
    m.customProgramCacheKey=()=>m.userData.aibaLinearCharacter?"aibaShadeLinearHero2":actor?"aibaShadeActor4":"aibaShade4";
    m.needsUpdate=true;patched++;
  }
  function shadeTree(root){
    if(!enabled||!root)return;
    root.traverse(o=>{
      if(!o.isMesh||o.userData.aibaNoShade)return;
      if(Array.isArray(o.material))o.material.forEach(m=>patchMaterial(m,true));
      else patchMaterial(o.material,true);
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
      const places=((typeof environmentRoot!=="undefined"&&environmentRoot)||global.environmentRoot)?.userData?.placeState;
      const fill=uniforms.aibaFillColor.value,fillDir=uniforms.aibaFillDir.value;
      const fillStrength=uniforms.aibaFillStrength;
      if(preset==="rainforest"){
        uniforms.aibaSceneMode.value=1;
        const rf=places?.rainforest;
        const cyc=rf?.uniforms?.forestCycle?.value;
        const dusk=cyc?cyc.x:0,night=cyc?cyc.y:0,ff=cyc?cyc.z:0;
        uniforms.aibaRimColor.value.setHex(0xffd488).lerp(colorScratch.setHex(0xff7e38),dusk).lerp(colorScratch.setHex(0x88d468),night*(.35+.65*ff));
        uniforms.aibaRimStrength.value=THREE.MathUtils.lerp(.52+.12*dusk,.14+.22*ff,night);
        fill.setHex(0x83bda4).lerp(colorScratch.setHex(0x457d83),night);
        fillDir.set(.64,.52,.57);
        fillStrength.value=THREE.MathUtils.lerp(.24,.07+.07*ff,night);
        uniforms.aibaGroundColor.value.setHex(0x3f4c1c).lerp(colorScratch.setHex(0x4a3420),dusk*.7).lerp(colorScratch.setHex(0x0a1410),night);
        uniforms.aibaAirColor.value.setHex(0x888450).lerp(colorScratch.setHex(0xa85a32),dusk*.8).lerp(colorScratch.setHex(0x060c10),night);
        uniforms.aibaContact.value=.38;
        uniforms.aibaWetness.value=.15;
      }else if(preset==="flowerCourt"){
        uniforms.aibaSceneMode.value=2;
        const m=places?.meadow;
        const gold=m?m.uniforms.meadowSky.value.y:0;
        const clear=m?m.uniforms.meadowSky.value.x:.5;
        uniforms.aibaWetness.value=m?m.wetness:0;
        uniforms.aibaRimColor.value.setHex(0xe8f0f6).lerp(colorScratch.setHex(0xffe6b2),clear).lerp(colorScratch.setHex(0xffb468),gold);
        uniforms.aibaRimStrength.value=.38+.18*clear+.12*gold;
        fill.setHex(0x8bb8e0).lerp(colorScratch.setHex(0x8ea8e0),gold);
        fillDir.set(.64,.63,-.44);
        fillStrength.value=.18+.08*clear+.04*gold;
        const storm=1-(m?.uniforms.meadowSky.value.z??0)*.45;
        uniforms.aibaRimStrength.value*=storm;
        fillStrength.value*=storm;
        uniforms.aibaGroundColor.value.setHex(0x648834).lerp(colorScratch.setHex(0x847e3c),gold*.6);
        uniforms.aibaAirColor.value.setHex(0x889ca8).lerp(colorScratch.setHex(0xd8b888),gold*.75+.2*clear);
        uniforms.aibaContact.value=.36;
      }else if(preset==="lunarCrater"){
        uniforms.aibaSceneMode.value=4;
        const lw=places?.wonder;
        const ecl=(lw&&lw.kind==="lunar")?(lw.eclipseAmount||0):0;
        uniforms.aibaRimColor.value.setHex(0xf6f9ff).lerp(colorScratch.setHex(0xff6a3c),ecl*.82);
        uniforms.aibaRimStrength.value=.58-.14*ecl;
        fill.setHex(0x72baff).lerp(colorScratch.setHex(0xd87868),ecl);
        if(lw?.earth)fillDir.copy(lw.earth.position).normalize();
        else fillDir.set(.46,.38,-.80).normalize();
        fillStrength.value=.34-.17*ecl;
        uniforms.aibaGroundColor.value.setHex(0x5c626e).lerp(colorScratch.setHex(0x5a241a),ecl*.85);
        uniforms.aibaAirColor.value.setHex(0x707886).lerp(colorScratch.setHex(0x521c16),ecl*.85);
        uniforms.aibaContact.value=.36;
        uniforms.aibaWetness.value=0;
      }else if(preset!=="indoor"){
        uniforms.aibaSceneMode.value=3;
        fillStrength.value=0;
        if(typeof sun!=="undefined"&&sun)uniforms.aibaRimColor.value.copy(sun.color);
        uniforms.aibaRimStrength.value=.36;
        if(typeof hemi!=="undefined"&&hemi)uniforms.aibaGroundColor.value.copy(hemi.groundColor);
        if(typeof scene!=="undefined"&&scene?.fog)uniforms.aibaAirColor.value.copy(scene.fog.color);
        uniforms.aibaContact.value=.32;
        uniforms.aibaWetness.value=preset==="rainyCourt"?.65:0;
      }else{
        uniforms.aibaSceneMode.value=0;
        uniforms.aibaRimColor.value.setHex(0xffe4b4);
        uniforms.aibaRimStrength.value=.49;
        fill.setHex(0x9b97ff);
        fillDir.set(-.78,.38,-.50);
        const stageLight=global.AIBAShow?.rimLight;
        const stage=stageLight?.strength||0;
        if(stage>.001)fill.lerp(stageLight.color,stage*.65);
        fillStrength.value=.32+stage*.25;
        uniforms.aibaGroundColor.value.setHex(0xc49454);
        uniforms.aibaAirColor.value.setHex(0x362a48);
        uniforms.aibaContact.value=.36;
        uniforms.aibaWetness.value=0;
      }
      if(typeof sun!=="undefined"&&sun&&sun.position.lengthSq()>0.01){
        directionScratch.copy(sun.position);
        if(sun.target)directionScratch.sub(sun.target.position);
        uniforms.aibaSunDir.value.copy(directionScratch).normalize();
      }
      /* 切换球场时同步更新所有写实 PBR 角色/篮球/篮筐的 PMREM 环境反射贴图（IBL）；真浮点 HDR 亮度高，按场地精准定标防过曝 */
      const envKey=(preset==="flowerCourt"||preset==="lunarCrater"||preset==="rainforest"||preset==="indoor")?preset:"indoor";
      const envInt=_hdriEnabled
        ?(preset==="lunarCrater"?0.58:(preset==="rainforest"?0.46:(preset==="flowerCourt"?0.055:0.34)))
        :(preset==="lunarCrater"?0.62:(preset==="rainforest"?0.52:(preset==="flowerCourt"?0.58:0.54)));
      if(_activeEnvKey!==envKey||!_activeEnvTex){
        const tex=getVenueEnv(envKey);
        if(tex){
          _activeEnvKey=envKey;_activeEnvTex=tex;_activeEnvInt=envInt;
          _pbrMats.forEach(applyVenueEnv);
          if(typeof window.AIBA_SYNC_COURT_HDRI==="function")window.AIBA_SYNC_COURT_HDRI(envKey,tex);
        }
      }
    }catch(e){}
  }
  let _sweepTick=0;
  function sweep(){
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
    if(enabled&&(_sweepTick++%10)===0)sweep();
  }
  if(enabled)setInterval(sweep,400);

  global.AIBACharacterShading=Object.freeze({
    enabled,register,shadeTree,patchMaterial,syncSceneLight:onBeforeRender,uniforms,
    get patched(){return patched;}
  });
})(window);
