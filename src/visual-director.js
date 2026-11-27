/* ---------------- gameplay visual direction ---------------- */
(function(global){
  "use strict";

  const SKY_LOOKS=Object.freeze({
    outdoorSunny:{top:0x14588a,horizon:0x66c2d6,lower:0xd6c8b8},
    flowerCourt:{top:0x247eb5,horizon:0xa5cedb,lower:0xc8d7c4},
    rainyCourt:{top:0x304658,horizon:0x788b93,lower:0x596b63},
    beachSunset:{top:0x2b2d6e,horizon:0xf25c66,lower:0xffba68},
    /* 夏末傍晚:上方仍是没退尽的蓝,近地平线才转金 —— 不要一整片橙,
       那是 beachSunset 的日落;湘南要的是"放学时分"而不是"日落时刻"。 */
    shonanCoast:{top:0x3f6f96,horizon:0xf0c489,lower:0xe8d3ab},
    /* 下午 4~5 点的地中海:天顶还很蓝,近地平线泛暖白 —— 不是日落。 */
    medCliff:{top:0x1f6fa8,horizon:0x9fd0e0,lower:0xe7dcc4},
    arcticSnow:{top:0x020911,horizon:0x101f31,lower:0x334859},
    spanishQuarter:{top:0x3c7898,horizon:0xb8c9c0,lower:0xdac8a8},
    lunarCrater:{top:0x000002,horizon:0x020307,lower:0x06070a},
    tokyoRooftop:{top:0x02050d,horizon:0x0b152a,lower:0x050914}
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
      if(mat.isMeshPhysicalMaterial){
        applyArenaFloorFinish(mat);
        if(!mat.roughnessMap)mat.roughnessMap=courtRoughTexture;
        mat.envMap=makeArenaEnvPMREM();
      }else{
        mat.color.setHex(0xb0a798);mat.specular&&mat.specular.setHex(0x8d8574);mat.shininess=38;
        if(!mat.envMap&&typeof makeArenaEnvMap==="function"){mat.envMap=makeArenaEnvMap();}
        mat.reflectivity=0.12;
      }
    }else if(name==="rainyCourt"){
      mat.color.setHex(0xa9b7bb);mat.specular&&mat.specular.setHex(0x9ec7d1);mat.shininess=52;
    }else if(name==="beachSunset"){
      mat.color.setHex(0xc7b0a4);mat.specular&&mat.specular.setHex(0x6c5246);mat.shininess=9;
    }else if(name==="lunarCrater"){
      mat.color.setHex(0xebedf0);mat.specular&&mat.specular.setHex(0x2a2c30);mat.shininess=2;
    }else if(name==="tokyoRooftop"){
      mat.color.setHex(0xd4dce8);mat.specular&&mat.specular.setHex(0x7a94ba);mat.shininess=26;
    }else{
      mat.color.setHex(0xd8e0dc);mat.specular&&mat.specular.setHex(0x384b52);mat.shininess=6;
    }
    mat.needsUpdate=true;
  }

  global.AIBAVisual=Object.freeze({makeSkyDome,tuneCourt});
})(window);
