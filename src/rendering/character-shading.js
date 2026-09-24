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
    aibaRimColor:{value:new THREE.Color(0xc4dcff)},
    aibaRimStrength:{value:.42},
    aibaSky:{value:.2},
    aibaContact:{value:.26}
  };
  const VERT_DECL="\nvarying vec3 aibaN;\nvarying vec3 aibaV;\nvarying vec3 aibaWN;\nvarying float aibaY;\n";
  const VERT_BODY=[
    "aibaN=normalize(normalMatrix*objectNormal);",
    "aibaV=-mvPosition.xyz;",
    "aibaWN=normalize(mat3(modelMatrix)*objectNormal);",
    "aibaY=(modelMatrix*vec4(transformed,1.0)).y;"
  ].join("\n");
  const FRAG_DECL="\nuniform vec3 aibaRimColor;\nuniform float aibaRimStrength;\nuniform float aibaSky;\nuniform float aibaContact;\n"+VERT_DECL;
  const FRAG_BODY=[
    "{",
    "  vec3 an=normalize(aibaN);vec3 av=normalize(aibaV);",
    "  float up=clamp(aibaWN.y,-1.0,1.0);",
    // 天光遮蔽：顶面 +sky，底面 −sky
    "  float sky=1.0+aibaSky*up;",
    // 接地压暗：0m 处压 contact，.55m 以上不压
    "  float contact=mix(1.0-aibaContact,1.0,smoothstep(0.02,0.55,aibaY));",
    "  gl_FragColor.rgb*=sky*contact;",
    // 轮廓光：菲涅尔，朝下的面减弱（不要在鞋底和下巴下面亮一圈）
    "  float fres=pow(1.0-clamp(dot(an,av),0.0,1.0),2.6);",
    "  gl_FragColor.rgb+=aibaRimColor*fres*aibaRimStrength*(0.55+0.45*max(up,0.0));",
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
  /* 换鞋、戴装备会给角色挂上新材质：定时补一遍。每个角色一两百个网格，半秒一次很便宜。 */
  function sweep(){
    for(const r of refs){const g=canWeak?r.deref():r;if(g&&g.parent)shadeTree(g);}
  }
  if(enabled)setInterval(sweep,500);

  global.AIBACharacterShading=Object.freeze({
    enabled,register,shadeTree,uniforms,
    get patched(){return patched;}
  });
})(window);
