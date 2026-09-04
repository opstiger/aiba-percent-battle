/* ---------------- gameplay visual direction ---------------- */
(function(global){
  "use strict";

  const SKY_LOOKS=Object.freeze({
    outdoorSunny:{top:0x1e6091,horizon:0x7fb8c9,lower:0xc4d2c3},
    flowerCourt:{top:0x2779a2,horizon:0x8bc6cc,lower:0xc9d8c3},
    rainyCourt:{top:0x304658,horizon:0x788b93,lower:0x596b63},
    beachSunset:{top:0x443a61,horizon:0xe38862,lower:0xf2bd86}
  });

  function makeSkyDome(THREE,name,centerZ){
    const look=SKY_LOOKS[name]||SKY_LOOKS.outdoorSunny;
    const radius=86,geo=new THREE.SphereGeometry(radius,20,12),pos=geo.getAttribute("position");
    const colors=new Float32Array(pos.count*3),top=new THREE.Color(look.top),horizon=new THREE.Color(look.horizon),lower=new THREE.Color(look.lower),c=new THREE.Color();
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i)/radius;
      if(y>=0)c.copy(horizon).lerp(top,Math.min(1,Math.pow(y*1.8,.72)));
      else c.copy(horizon).lerp(lower,Math.min(1,-y*3.2));
      colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
    }
    geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false});
    const mesh=new THREE.Mesh(geo,mat);mesh.name="aibaSkyDome";mesh.position.set(0,0,centerZ||0);mesh.renderOrder=-1000;mesh.frustumCulled=false;
    return mesh;
  }

  function tuneCourt(court,name){
    if(!court||!court.material)return;
    const mat=court.material;
    if(name==="indoor"){
      /* 室内是唯一有顶灯的场景:暖色已经画进木纹贴图,这里不再用 color 染色,
         只留 specular/shininess 做打蜡地板的光泽。
         specular 原本是暗棕 0x7a6448 —— 那是"高光的颜色",用暗色等于让高光发暗,
         地板于是又亮又脏。改成暖白 0xfff2dc,shininess 40→78 收出一道清漆光带。
         envMap 是"润"的来源(清漆映出顶灯),只在缺失时挂,避免每次切场景重生成。 */
      /* shininess 78→42、specular 略降。"局部烧白"更可能来自这里而不是灯:
         shininess 78 的 Phong 高光又小又集中,四盏顶灯在地面各打出一个亮点,
         读起来就是"某块地板被手电筒照白"。降到 42 之后高光面积摊开、
         边缘变柔,更接近打蜡地板那种"大面积、受控的 broad highlight"。
         (v2.20 试过 22,那时糊成一整片等于没有;42 仍在"读得出光带"的区间内。)
         等换 MeshPhysicalMaterial 之后改用 roughness/clearcoat 精确控制,这里只是过渡。 */
      /* 材质可能是 Phong 也可能是 Physical(见 court.js 的 ?pbr 开关),
         两套参数名完全不同,必须分开处理:
           Phong     → color / specular / shininess / reflectivity
           Physical  → roughness / metalness / clearcoat / envMapIntensity
         而且 Physical 的 color 要保持白 —— 木色已经在贴图里了,
         再乘一个暗色等于给地板额外压暗一遍(PBR 的有效 albedo 来自 map × color)。
         tuneCourt 每次切场景都跑,所以这里必须把该管的都显式写一遍,
         否则切一次户外再切回来就会停在户外的数值上。 */
      if(mat.isMeshPhysicalMaterial){
        /* PBR 的 color 是乘在 map 上的,保持白等于把 Phong 时代
           0xb0a798(约 0.69 倍)那道压暗整个丢掉 —— 换材质后地板从 150 冲到 182,
           根因在这里,不是灯也不是环境强度(降灯阵实测只动了 0.6)。
           所以 PBR 同样要给一个压暗色,只是比 Phong 略亮一点,
           留给 clearcoat 那层清漆高光一点余量。 */
        mat.color.setHex(0xada594);
        /* ⚠ 从这里往下全部只读 FLOOR_PHYS —— court.js 里的**唯一权威配置**。
           之前这里是"权威值"、court.js 那份是"初始值",两边各写一份,
           于是改 court.js 会被这里悄悄覆盖回去(clearcoat 和 rim 都栽过)。
           现在两份合并成一份,这里只负责在切场景时把值**重新应用**上去
           (不重新应用的话,切一次户外再切回来会停在户外的数值上)。
           本文件比 court.js 先加载,但 tuneCourt 只在运行时被调用,
           那时 FLOOR_PHYS 一定已定义;typeof 保护是为了防止将来调整加载顺序时炸掉。 */
        const FP=(typeof FLOOR_PHYS!=="undefined")?FLOOR_PHYS
                 :{roughness:0.40,metalness:0,clearcoat:0.30,clearcoatRoughness:0.30,envMapIntensity:0.45};
        mat.roughness=FP.roughness;mat.metalness=FP.metalness;
        mat.clearcoat=FP.clearcoat;mat.clearcoatRoughness=FP.clearcoatRoughness;
        /* roughnessMap 也要在切回来时补上 —— 它和 clearcoat 一样会被户外分支清掉 */
        if(!mat.roughnessMap&&typeof courtRoughTexture!=="undefined")mat.roughnessMap=courtRoughTexture;
        if(typeof makeArenaEnvPMREM==="function")mat.envMap=makeArenaEnvPMREM();
        else if(typeof makeArenaEnvMap==="function")mat.envMap=makeArenaEnvMap();
        mat.envMapIntensity=FP.envMapIntensity;
      }else{
        mat.color.setHex(0xb0a798);mat.specular&&mat.specular.setHex(0x8d8574);mat.shininess=38;
        if(!mat.envMap&&typeof makeArenaEnvMap==="function"){mat.envMap=makeArenaEnvMap();}
        mat.reflectivity=0.12;
      }
    }else if(name==="rainyCourt"){
      mat.color.setHex(0xa9b7bb);mat.specular&&mat.specular.setHex(0x9ec7d1);mat.shininess=52;
    }else if(name==="beachSunset"){
      mat.color.setHex(0xc7b0a4);mat.specular&&mat.specular.setHex(0x6c5246);mat.shininess=9;
    }else{
      mat.color.setHex(0xd8e0dc);mat.specular&&mat.specular.setHex(0x384b52);mat.shininess=6;
    }
    mat.needsUpdate=true;
  }

  global.AIBAVisual=Object.freeze({makeSkyDome,tuneCourt});
})(window);
