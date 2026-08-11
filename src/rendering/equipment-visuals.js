/* ---------------- release-grade voxel equipment visuals ---------------- */
(function(global){
  "use strict";

  const enabled=new URLSearchParams(location.search).get("gear")==="classic"?false:true;

  function colorOf(value,fallback){
    if(typeof value==="number")return value;
    return parseInt(String(value||fallback||"#ffffff").replace("#",""),16)||0xffffff;
  }
  function shade(value,factor){
    const c=new THREE.Color(colorOf(value));
    c.multiplyScalar(factor);return c.getHex();
  }
  function material(color,opts){
    const o=Object.assign({color:colorOf(color)},opts||{});
    return new THREE.MeshLambertMaterial(o);
  }
  function box(parent,w,h,d,x,y,z,mat,rx,ry,rz){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.rotation.set(rx||0,ry||0,rz||0);parent.add(mesh);return mesh;
  }
  function roundedBoxGeometry(w,h,d,r,segments){
    const geometry=new THREE.BoxGeometry(w,h,d,segments||3,segments||3,segments||3);
    const position=geometry.attributes.position,innerX=w*.5-r,innerY=h*.5-r,innerZ=d*.5-r;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const qx=Math.max(-innerX,Math.min(innerX,x)),qy=Math.max(-innerY,Math.min(innerY,y)),qz=Math.max(-innerZ,Math.min(innerZ,z));
      const dx=x-qx,dy=y-qy,dz=z-qz,length=Math.hypot(dx,dy,dz)||1;
      position.setXYZ(i,qx+dx*r/length,qy+dy*r/length,qz+dz*r/length);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();return geometry;
  }
  function roundedBox(parent,w,h,d,r,x,y,z,mat){
    const mesh=new THREE.Mesh(roundedBoxGeometry(w,h,d,r,3),mat);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function ellipsoid(parent,rx,ry,rz,x,y,z,mat){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mat);
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function cylinder(parent,rt,rb,h,segments,x,y,z,mat,rx,ry,rz){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments||8),mat);
    mesh.position.set(x,y,z);mesh.rotation.set(rx||0,ry||0,rz||0);parent.add(mesh);return mesh;
  }
  function torus(parent,r,tube,x,y,z,mat,scaleY,rotationZ){
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,5,18,Math.PI*1.2),mat);
    mesh.position.set(x,y,z);mesh.scale.y=scaleY||1;mesh.rotation.z=rotationZ||0;parent.add(mesh);return mesh;
  }
  function disposeGroup(group){
    if(!group)return;
    if(group.parent)group.parent.remove(group);
    const mats=new Set();
    group.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const list=Array.isArray(obj.material)?obj.material:[obj.material];
      list.filter(Boolean).forEach(mat=>mats.add(mat));
    });
    mats.forEach(mat=>mat.dispose&&mat.dispose());
  }
  function disposeUnusedMaterials(groups,materials){
    const used=new Set();
    (Array.isArray(groups)?groups:[groups]).filter(Boolean).forEach(group=>group.traverse(obj=>{
      const list=Array.isArray(obj.material)?obj.material:[obj.material];
      list.filter(Boolean).forEach(mat=>used.add(mat));
    }));
    materials.filter(Boolean).forEach(mat=>{if(!used.has(mat)&&mat.dispose)mat.dispose();});
  }
  function clearKey(guy,key){
    if(!guy)return;
    const wearKey=key+"WearGroups";
    if(guy[wearKey]){
      guy[wearKey].forEach(disposeGroup);
      guy[wearKey]=null;
    }
    if(!guy[key])return;
    if(Array.isArray(guy[key]))guy[key].forEach(disposeGroup);else disposeGroup(guy[key]);
    guy[key]=null;
  }

  function setHairVisible(guy,visible){if(guy&&guy.hairGrp)guy.hairGrp.visible=visible;}
  function setCustomHeadVisible(guy,visible){if(guy&&guy.customHeadGroup)guy.customHeadGroup.visible=visible;}

  function buildMask(group,main,dark){
    box(group,.28,.035,.032,0,1.69,.196,dark);
    box(group,.036,.105,.036,0,1.635,.207,dark);
    box(group,.108,.045,.034,-.088,1.60,.201,dark,0,0,-.17);
    box(group,.108,.045,.034,.088,1.60,.201,dark,0,0,.17);
    box(group,.20,.028,.032,0,1.565,.194,dark);
    box(group,.072,.024,.038,-.073,1.684,.216,main);
    box(group,.072,.024,.038,.073,1.684,.216,main);
    box(group,.028,.055,.285,-.181,1.64,.015,dark);
    box(group,.028,.055,.285,.181,1.64,.015,dark);
  }
  function buildCap(group,main,dark){
    cylinder(group,.205,.22,.135,8,0,1.82,-.015,main);
    box(group,.30,.09,.034,0,1.805,.188,main);
    box(group,.25,.024,.19,0,1.754,.258,main,.055,0,0);
    box(group,.10,.026,.035,0,1.79,-.218,dark);
    box(group,.035,.038,.055,-.052,1.79,-.218,main);
    box(group,.035,.038,.055,.052,1.79,-.218,main);
  }
  function buildShades(group,main,dark){
    const lens=material(main.color?main.color.getHex():0x77e7ff,{transparent:true,opacity:.62,depthWrite:false,emissive:main.color?main.color.getHex():0x77e7ff,emissiveIntensity:.10});
    box(group,.112,.062,.018,-.072,1.65,.206,lens);
    box(group,.112,.062,.018,.072,1.65,.206,lens);
    box(group,.034,.018,.025,0,1.654,.216,dark);
    box(group,.26,.018,.024,0,1.686,.213,dark);
    box(group,.022,.025,.30,-.174,1.66,.058,dark,0,-.035,0);
    box(group,.022,.025,.30,.174,1.66,.058,dark,0,.035,0);
    box(group,.034,.038,.032,-.174,1.665,.194,main);
    box(group,.034,.038,.032,.174,1.665,.194,main);
  }
  function buildHood(group,main,trim){
    // One low-poly shell wraps the smaller head; the shoulder yoke overlaps both hood and torso.
    ellipsoid(group,.195,.215,.175,0,1.60,-.045,main);
    ellipsoid(group,.205,.105,.105,0,1.445,-.125,main);
    ellipsoid(group,.27,.085,.17,0,1.40,-.015,main);
    torus(group,.158,.014,0,1.60,.151,trim,1.10,-Math.PI*.10);
    box(group,.19,.022,.035,-.082,1.432,.16,trim,0,0,-.42);
    box(group,.19,.022,.035,.082,1.432,.16,trim,0,0,.42);
  }
  function buildMascot(group,main,dark){
    // Keep the original comic cube mascot; the shared headRoot scale makes it 14% smaller.
    box(group,.48,.48,.48,0,1.64,0,main);
    box(group,.09,.09,.09,-.13,1.70,.25,dark);
    box(group,.09,.09,.09,.13,1.70,.25,dark);
    box(group,.25,.05,.045,0,1.55,.26,dark);
    box(group,.15,.20,.13,-.29,1.77,0,main);
    box(group,.15,.20,.13,.29,1.77,0,main);
  }
  function buildHoodieWear(guy,key,main,trim,seam){
    const groups=[];
    const torso=new THREE.Group();guy.g.add(torso);groups.push(torso);
    roundedBox(torso,.535,.61,.295,.05,0,1.10,0,main);
    box(torso,.545,.055,.305,0,.82,0,seam);
    box(torso,.33,.135,.026,0,.99,.163,seam);
    box(torso,.27,.095,.029,0,.99,.178,main);
    box(torso,.18,.022,.034,-.08,1.397,.154,trim,0,0,-.45);
    box(torso,.18,.022,.034,.08,1.397,.154,trim,0,0,.45);
    cylinder(torso,.008,.008,.17,6,-.055,1.31,.166,trim);
    cylinder(torso,.008,.008,.17,6,.055,1.31,.166,trim);
    box(torso,.025,.025,.025,-.055,1.22,.166,trim);
    box(torso,.025,.025,.025,.055,1.22,.166,trim);
    (guy.arms||[]).forEach(arm=>{
      const sleeve=new THREE.Group();arm.add(sleeve);groups.push(sleeve);
      roundedBox(sleeve,.166,.18,.186,.06,0,-.045,0,main);
      roundedBox(sleeve,.154,.285,.174,.022,0,-.19,0,main);
      roundedBox(sleeve,.158,.032,.178,.008,0,-.31,0,seam);
    });
    (guy.elbows||[]).forEach(elbow=>{
      const sleeve=new THREE.Group();elbow.add(sleeve);groups.push(sleeve);
      ellipsoid(sleeve,.081,.052,.088,0,-.018,0,main);
      roundedBox(sleeve,.148,.245,.166,.025,0,-.14,0,main);
      roundedBox(sleeve,.153,.048,.172,.012,0,-.272,0,seam);
    });
    guy[key+"WearGroups"]=groups;
  }

  function applyHead(guy,item,opts){
    if(!enabled||!guy)return false;
    opts=opts||{};
    const key=opts.key||"gearHeadGroup";
    clearKey(guy,key);
    if(key==="gearHeadGroup"){
      setCustomHeadVisible(guy,true);setHairVisible(guy,true);
      if(guy.customTopHeadGroup)guy.customTopHeadGroup.visible=true;
      if(guy.headband)guy.headband.visible=false;
    }
    if(!item)return true;
    const id=item.id||"",color=colorOf(item.color||opts.color),accent=colorOf(opts.accent||item.accent||0x77e7ff);
    if(key==="gearHeadGroup"&&(id==="head-hoodie"||id==="hoodie")&&guy.customTopHeadGroup)return true;
    if(id.indexOf("band-")===0||id==="band"){
      if(guy.headband){guy.headband.visible=true;guy.headband.material.color.setHex(color);}
      return true;
    }
    if(key==="gearHeadGroup")setCustomHeadVisible(guy,false);
    const group=new THREE.Group();group.name=key;
    const main=material(color),dark=material(shade(color,.20)),seam=material(shade(color,.64)),trim=material(accent,{emissive:accent,emissiveIntensity:.08});
    if(id==="head-mask"||id==="mask")buildMask(group,trim,dark);
    else if(id==="head-cap"||id==="cap"){setHairVisible(guy,false);buildCap(group,main,dark);}
    else if(id==="head-shades"||id==="shades")buildShades(group,trim,dark);
    else if(id==="head-hoodie"||id==="hoodie"){
      if(!opts.outfitOnly){setHairVisible(guy,false);buildHood(group,main,trim);}
      buildHoodieWear(guy,key,main,trim,seam);
    }
    else {setHairVisible(guy,false);if(key==="gearHeadGroup"&&guy.customTopHeadGroup)guy.customTopHeadGroup.visible=false;buildMascot(group,main,dark);}
    disposeUnusedMaterials([group].concat(guy[key+"WearGroups"]||[]),[main,dark,seam,trim]);
    const parent=(id==="head-hoodie"||id==="hoodie")?guy.g:(guy.headRoot||guy.g);
    parent.add(group);guy[key]=group;return true;
  }

  function applyShoes(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearShoeGroups");
    if(!item)return true;
    const color=colorOf(item.color),id=item.id,groups=[];
    const main=material(color),dark=material(shade(color,.23)),light=material(0xf3f6f6),accent=material(shade(color,1.25),{emissive:color,emissiveIntensity:.06});
    (guy.shoes||[]).forEach(shoe=>shoe.material.color.setHex(color));
    (guy.ankles||[]).forEach((ankle,index)=>{
      const group=new THREE.Group(),side=index===0?-1:1;ankle.add(group);groups.push(group);
      if(id==="shoes-blaze"){
        box(group,.038,.072,.19,side*.096,-.012,.025,accent,0,0,side*.12);
        ellipsoid(group,.064,.014,.055,0,-.004,.17,light);
        box(group,.065,.09,.035,0,.055,-.13,main,0,0,-side*.08);
      }else if(id==="shoes-anchor"){
        box(group,.225,.035,.24,0,-.068,.005,dark);
        ellipsoid(group,.112,.018,.085,0,-.068,.15,dark);
        box(group,.035,.095,.22,side*.104,-.005,.015,main);
        ellipsoid(group,.082,.019,.05,0,-.01,.18,accent);
        box(group,.12,.08,.045,0,.055,-.135,dark);
      }else if(id==="shoes-marathon"){
        box(group,.215,.048,.24,0,-.073,.005,light);
        ellipsoid(group,.107,.025,.085,0,-.073,.15,light);
        cylinder(group,.055,.065,.055,8,0,-.045,-.115,accent,Math.PI/2,0,0);
        box(group,.15,.055,.13,0,.005,.035,main,0,0,side*.04);
        box(group,.032,.05,.18,side*.092,-.005,.035,dark);
      }else{
        box(group,.21,.038,.235,0,-.072,.005,dark);
        ellipsoid(group,.105,.02,.085,0,-.072,.15,dark);
        cylinder(group,.052,.064,.065,8,0,-.035,-.13,accent,Math.PI/2,0,0);
        ellipsoid(group,.072,.016,.052,0,-.01,.18,light);
        box(group,.035,.075,.18,side*.096,-.005,.025,main,0,0,side*.08);
      }
    });
    disposeUnusedMaterials(groups,[main,dark,light,accent]);
    guy.gearShoeGroups=groups;return true;
  }

  function applySleeve(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearSleeveGroups");
    if(!item)return true;
    const id=item.id,color=colorOf(item.color),groups=[];
    const dark=material(shade(color,.28)),accent=material(shade(color,1.24),{emissive:color,emissiveIntensity:.05});
    (guy.sleeves||[]).forEach(part=>{part.visible=false;});
    (guy.wrists||[]).forEach(part=>{part.visible=false;});
    const sleeve=guy.sleeves&&guy.sleeves[0],wrist=guy.wrists&&guy.wrists[0];
    if(id==="sleeve-snap"){
      if(wrist){wrist.visible=true;wrist.material.color.setHex(color);}
      const group=new THREE.Group();guy.elbows[0].add(group);groups.push(group);
      box(group,.142,.018,.158,0,-.242,0,accent);
      box(group,.142,.014,.158,0,-.294,0,dark);
    }else{
      if(sleeve){sleeve.visible=true;sleeve.material.color.setHex(color);}
      const upper=new THREE.Group();guy.arms[0].add(upper);groups.push(upper);
      box(upper,.151,.018,.171,0,-.098,0,id==="sleeve-steady"?dark:accent);
      if(id==="sleeve-ice"){
        const elbow=new THREE.Group();guy.elbows[0].add(elbow);groups.push(elbow);
        ellipsoid(elbow,.076,.045,.085,0,-.012,.025,dark);
      }else if(id==="sleeve-saver"){
        if(wrist){wrist.visible=true;wrist.material.color.setHex(color);}
        box(upper,.018,.20,.174,-.066,-.205,0,accent);
      }
    }
    disposeUnusedMaterials(groups,[dark,accent]);
    guy.gearSleeveGroups=groups;return true;
  }

  global.AIBAEquipmentVisuals=Object.freeze({enabled,applyHead,applyShoes,applySleeve,clearKey});
})(window);
