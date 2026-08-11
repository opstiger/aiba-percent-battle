/* ---------------- character visual profiles: optional layered voxel art ---------------- */
(function(global){
  "use strict";

  const PROFILE="voxel-pro-01";
  const textureCache=new Map();

  function hex(value){return "#"+Number(value||0).toString(16).padStart(6,"0").slice(-6);}
  function texture(key,paint){
    if(textureCache.has(key))return textureCache.get(key);
    const tex=pixTex(72,72,paint);
    textureCache.set(key,tex);
    return tex;
  }
  function proFaceTex(skin){
    const key="face:"+skin;
    return texture(key,(c)=>{
      c.fillStyle=hex(skin);c.fillRect(0,0,72,72);
      c.fillStyle="rgba(255,255,255,.08)";c.fillRect(0,0,72,10);
      c.fillStyle="rgba(22,8,4,.12)";c.fillRect(0,50,72,22);
      c.fillStyle="#17120f";c.fillRect(12,22,17,4);c.fillRect(43,21,17,4);
      c.fillStyle="#f4f6ef";c.fillRect(14,29,15,7);c.fillRect(43,29,15,7);
      c.fillStyle="#19120e";c.fillRect(22,29,6,7);c.fillRect(44,29,6,7);
      c.fillStyle="rgba(28,10,4,.22)";c.fillRect(33,35,6,12);
      c.fillStyle="#32120d";c.fillRect(24,55,25,4);
      c.fillStyle="#6ff3ff";c.fillRect(8,42,13,3);c.fillRect(10,45,8,2);
      c.fillStyle="#f4c542";c.fillRect(56,41,5,10);
    });
  }
  function proJerseyTex(star,back){
    const base=star.col[0],trim=star.col[1],accent=star.accent||0x6ff3ff,num=String(star.num||24);
    const key=["jersey",base,trim,accent,num,back?1:0].join(":");
    return texture(key,(c)=>{
      c.fillStyle=hex(base);c.fillRect(0,0,72,72);
      c.fillStyle="rgba(255,255,255,.06)";c.fillRect(0,0,72,5);
      c.fillStyle=hex(trim);c.fillRect(0,0,6,72);c.fillRect(66,0,6,72);
      c.fillStyle="rgba(0,0,0,.22)";c.fillRect(0,61,72,11);
      c.strokeStyle=hex(trim);c.lineWidth=4;c.beginPath();c.moveTo(22,2);c.lineTo(36,15);c.lineTo(50,2);c.stroke();
      c.font="bold "+(back?39:31)+"px Orbitron, monospace";c.textAlign="center";c.textBaseline="middle";
      c.lineWidth=6;c.strokeStyle="#040608";c.strokeText(num,36,back?40:44);
      c.fillStyle="#f4f4ee";c.fillText(num,36,back?40:44);
      c.fillStyle=hex(accent);c.fillRect(back?24:29,back?8:16,back?24:14,3);
    });
  }
  function makeMat(color,opts){return new THREE.MeshLambertMaterial(Object.assign({color},opts||{}));}
  function addBox(parent,w,h,d,mat,x,y,z,rz){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);if(rz)mesh.rotation.z=rz;parent.add(mesh);return mesh;
  }
  function addLayer(record,parent){
    const group=new THREE.Group();parent.add(group);record.groups.push(group);return group;
  }
  function clearProfile(guy){
    const record=guy&&guy._voxelProVisual;
    if(record){
      record.groups.forEach(group=>{
        if(group.parent)group.parent.remove(group);
        group.traverse(obj=>{if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();});
      });
      record.materials.forEach(mat=>mat.dispose&&mat.dispose());
      guy._voxelProVisual=null;
    }
    if(!guy)return;
    if(guy.headRoot){
      const baseHeadScale=guy.headScale||1;
      guy.headRoot.scale.setScalar(baseHeadScale);
      guy.headRoot.position.y=1.45*(1-baseHeadScale);
    }
    if(guy.arms&&guy.arms.length>1){
      const shoulderX=guy.baseShoulderX||.285;
      guy.arms[0].position.x=-shoulderX;guy.arms[1].position.x=shoulderX;
    }
    if(guy.arms)guy.arms.forEach(arm=>{
      if(!arm.children||!arm.children[0])return;
      arm.children[0].material=guy.mS;
      arm.children[0].visible=true;
    });
    if(guy.legs&&guy.legs.length>1){
      const hipX=guy.baseHipX||.125;
      guy.legs[0].position.x=-hipX;guy.legs[1].position.x=hipX;
    }
  }
  function applyProfile(guy,star){
    if(!guy||!star||star.visualProfile!==PROFILE)return;
    const accent=star.accent||0x6ff3ff,trim=star.col[1];
    const dark=makeMat(0x080b11),cloth=makeMat(0x151b24,{transparent:true,opacity:.94}),gold=makeMat(trim),cyan=makeMat(accent,{emissive:accent,emissiveIntensity:.12}),skinInk=makeMat(0x26130e,{transparent:true,opacity:.82});
    const record={groups:[],materials:[dark,cloth,gold,cyan,skinInk]};
    const gear=!global.AIBA_SUPPRESS_GEAR_VISUAL&&global.AIBAGear&&typeof global.AIBAGear.get==="function"?global.AIBAGear.get():{};
    guy._voxelProVisual=record;

    // Keep the smaller head anchored above the neck instead of sinking it into the shoulder line.
    if(guy.headRoot){
      const proHeadScale=(guy.headScale||1)*.94;
      guy.headRoot.scale.setScalar(proHeadScale);
      guy.headRoot.position.y=1.45*(1-proHeadScale)+.05;
    }
    if(guy.arms&&guy.arms.length>1){
      const shoulderX=Math.max(.26,(guy.baseShoulderX||.285)-.008);
      guy.arms[0].position.x=-shoulderX;guy.arms[1].position.x=shoulderX;
    }
    if(guy.legs&&guy.legs.length>1){
      const hipX=guy.baseHipX||.125;
      guy.legs[0].position.x=-hipX;guy.legs[1].position.x=hipX;
    }

    // The shared rig already owns the rounded, deeply overlapped shoulder-to-arm blend.
    // Keep it visible so the prototype uses the same clean joint as the full roster.

    guy.mP.color.setHex(0x10141c);
    guy.bodyF.map=proJerseyTex(star,false);guy.bodyF.color.setHex(0xffffff);guy.bodyF.needsUpdate=true;
    guy.bodyB.map=proJerseyTex(star,true);guy.bodyB.color.setHex(0xffffff);guy.bodyB.needsUpdate=true;
    guy.mFace.map=proFaceTex(star.skin||0x8d5524);guy.mFace.color.setHex(0xffffff);guy.mFace.needsUpdate=true;

    const hoodieEquipped=gear.band==="head-hoodie"||(star.customTop&&star.customTop.id==="hoodie");
    if(!hoodieEquipped){
      // Torso outer layer: one strong trim line and a restrained accent keep the jersey readable at game scale.
      const torso=addLayer(record,guy.g);
      addBox(torso,.43,.17,.025,cloth,0,1.22,.151);
      addBox(torso,.034,.47,.03,gold,-.244,1.10,.154);
      addBox(torso,.034,.47,.03,gold,.244,1.10,.154);
      addBox(torso,.16,.025,.034,gold,-.07,1.36,.16,-.48);
      addBox(torso,.16,.025,.034,gold,.07,1.36,.16,.48);
      addBox(torso,.11,.014,.034,cyan,0,1.285,.163);

      // Narrow front/back straps preserve the tank-top read while exposing the deltoids and neck.
      [-1,1].forEach(side=>{
        [-1,1].forEach(depth=>{
          const z=depth*.151,lean=side*.16;
          addBox(torso,.082,.20,.022,cloth,side*.145,1.325,z,lean);
          addBox(torso,.014,.18,.026,gold,side*.183,1.318,z+depth*.003,lean);
        });
      });
    }

    // Shorts panels stay attached to the thigh pivots, so the layer moves naturally during the jump.
    guy.legs.forEach((leg,index)=>{
      const panel=addLayer(record,leg),side=index===0?-1:1;
      addBox(panel,.145,.16,.025,cloth,0,-.105,.124);
      addBox(panel,.026,.17,.035,gold,side*.086,-.105,.128);
    });

    // Shooting sleeve stripe and guide-arm tattoo create an asymmetric, readable player identity.
    if(!gear.sleeve&&guy.arms&&guy.arms[1]){
      const sleeve=addLayer(record,guy.arms[1]);
      addBox(sleeve,.178,.034,.198,gold,0,-.09,0);
      addBox(sleeve,.184,.018,.204,cyan,0,-.112,0);
    }
    if(guy.elbows&&guy.elbows[0]){
      const tattoo=addLayer(record,guy.elbows[0]);
      addBox(tattoo,.132,.035,.012,skinInk,0,-.11,.079,.28);
      addBox(tattoo,.132,.025,.012,skinInk,0,-.18,.079,-.3);
    }

    // Shoe accents are mounted to the ankle pivots; they keep their position through takeoff and landing.
    if(!gear.shoes)guy.ankles.forEach((ankle,index)=>{
      const shoe=addLayer(record,ankle),side=index===0?-1:1;
      addBox(shoe,.19,.022,.29,dark,0,-.069,.05);
      addBox(shoe,.16,.018,.09,cyan,side*.012,-.078,.178);
      addBox(shoe,.035,.075,.18,gold,side*.096,-.015,.025);
    });

    // A tiny earring is enough to break the generic cube-head silhouette without turning it into a helmet.
    if(guy.headRoot){
      const head=addLayer(record,guy.headRoot);
      addBox(head,.036,.052,.026,cyan,-.19,1.55,.065);
    }
  }

  const original=global.applyStarStyle;
  if(typeof original==="function"&&!original.__aibaVoxelPro){
    const wrapped=function(guy,star){
      clearProfile(guy);
      const result=original.apply(this,arguments);
      applyProfile(guy,star);
      return result;
    };
    wrapped.__aibaVoxelPro=true;
    global.applyStarStyle=wrapped;
  }

  global.AIBACharacterVisuals=Object.freeze({PROFILE,applyProfile,clearProfile});
})(window);
