(function(global){
  "use strict";

  const cache=new Map();
  const W=300,H=330;
  let liveView=null,detachObserver=null,renderTicket=0,focusTicket=0;
  const SELF_URL=(document.currentScript&&document.currentScript.src)||global.location.href;
  const TRIPO_MODELS=Object.freeze({
    star8:{file:"star8.glb",yaw:-Math.PI/2},
    star1:{file:"star1.glb",yaw:0},
    star15:{file:"star15.glb",yaw:0},
    star30:{file:"star30.glb",yaw:0},
    star3:{file:"star3.glb",yaw:0},
    star30b:{file:"star30b.glb",yaw:0},
    cat1:{file:"cat1.glb",yaw:0},
    husky:{file:"husky.glb",yaw:0},
    nvidia23:{file:"nvidia23.glb",yaw:0},
    mushroom:{file:"mushroom.glb",yaw:0}
  });
  const DANCE_BONES=["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"];
  const tripoRigCache=new Map();
  const tripoLoading=new Map();
  let gltfLoaderLoading=false,gltfLoaderCallbacks=[];

  function ensureGLTFLoader(cb){
    if(global.THREE&&global.THREE.GLTFLoader){cb();return;}
    gltfLoaderCallbacks.push(cb);
    if(gltfLoaderLoading)return;
    gltfLoaderLoading=true;
    const s=document.createElement("script");
    s.src=new URL("../vendor/GLTFLoader.r128.js",SELF_URL).href;
    s.onload=()=>{
      gltfLoaderLoading=false;
      const list=gltfLoaderCallbacks.splice(0);
      list.forEach(fn=>{try{fn();}catch(e){}});
    };
    s.onerror=()=>{gltfLoaderLoading=false;gltfLoaderCallbacks.length=0;};
    document.head.appendChild(s);
  }

  function buildTripoRig(gltf,id){
    const T=global.THREE,spec=TRIPO_MODELS[id];
    const root=new T.Group();root.name="lockerTripoAvatar";root.__keepCached=true;
    const M=new T.Group();M.rotation.y=spec.yaw||0;root.add(M);M.add(gltf.scene);
    const B={},restL={},restP={},restW={},restPos={};
    let mesh=null;
    gltf.scene.traverse(o=>{
      o.frustumCulled=false;
      if(o.isSkinnedMesh&&!mesh)mesh=o;
      if(o.isBone)B[o.name.replace(/^mixamorig:?/,"")]=o;
    });
    if(!mesh||!B.Hips)throw new Error("Missing SkinnedMesh or Hips in "+spec.file);
    root.updateMatrixWorld(true);
    const skinBox=()=>{
      const bx=new T.Box3(),v=new T.Vector3(),pos=mesh.geometry.attributes.position;
      root.updateMatrixWorld(true);
      if(mesh.skeleton)mesh.skeleton.update();
      for(let i=0;i<pos.count;i++){mesh.boneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);bx.expandByPoint(v);}
      return bx;
    };
    let box=skinBox();
    const rawH=Math.max(1e-6,box.max.y-box.min.y);
    /* 与方块人站立视高(约 1.92m)完全对齐，避免 Armature 带 0.01 缩放的模型(如 23 号老黄 / 77 号蘑菇头)显得偏小 */
    const s=1.92/rawH;
    M.scale.setScalar(s);root.updateMatrixWorld(true);box=skinBox();
    const hp=B.Hips.getWorldPosition(new T.Vector3());
    M.position.set(-hp.x,-box.min.y-0.052,-hp.z);
    root.updateMatrixWorld(true);
    for(const n in B){
      restL[n]=B[n].quaternion.clone();
      restP[n]=B[n].position.clone();
      restW[n]=B[n].getWorldQuaternion(new T.Quaternion());
      restPos[n]=B[n].getWorldPosition(new T.Vector3());
    }
    const FEET=["LeftFoot","RightFoot","LeftToeBase","RightToeBase","LeftToe_End","RightToe_End"];
    const footMinY=()=>{
      let m=Infinity;const v=new T.Vector3();
      for(const fn of FEET){if(B[fn]){B[fn].getWorldPosition(v);if(v.y<m)m=v.y;}}
      return Number.isFinite(m)?m:0;
    };
    const footRest=footMinY();
    let run=null;
    const clip=gltf.animations&&gltf.animations[0];
    if(clip){
      const rot={};let hips=null,t0=Infinity,t1=-Infinity;
      for(const tr of clip.tracks){
        const dot=tr.name.lastIndexOf("."),bn=tr.name.slice(0,dot).replace(/^mixamorig:?/,""),prop=tr.name.slice(dot+1);
        if(!B[bn])continue;
        if(prop==="quaternion"){rot[bn]=tr;t0=Math.min(t0,tr.times[0]);t1=Math.max(t1,tr.times[tr.times.length-1]);}
        else if(prop==="position"&&bn==="Hips")hips=tr;
      }
      if(t1>t0)run={rot,hips,t0,span:t1-t0};
    }
    return {id,root,M,B,restL,restP,restW,restPos,basePos:M.position.clone(),footRest,footMinY,run};
  }

  function resetTripoRig(rig){
    if(!rig)return;
    for(const n in rig.B)rig.B[n].quaternion.copy(rig.restL[n]);
    if(rig.B.Hips&&rig.restP.Hips)rig.B.Hips.position.copy(rig.restP.Hips);
    rig.M.position.copy(rig.basePos);
    rig.root.position.set(0,0,0);
    rig.root.rotation.set(0,-0.16,0);
  }

  /* 选人界面只抽站立/挥手/律动类动作，排除低趴倒立/地板定格(freeze/headspin/break1990)以免卡片人物缩成一团 */
  const LOCKER_FLOOR_CLIPS={freeze:1,freeze2:1,break1990:1,headspin:1};
  function poseTripoRig(rig,time,id,featured){
    if(!rig||!global.THREE)return;
    const T=global.THREE;
    resetTripoRig(rig);
    const D=global.AIBADance;
    if(D&&typeof D.load==="function"&&!D.ready&&!D.loading)D.load();
    const seed=Array.from(String(id||"star8")).reduce((a,c)=>a+c.charCodeAt(0),0);
    if(D&&D.ready&&Array.isArray(D.ids)&&D.ids.length){
      const rawPool=typeof D.list==="function"?D.list({role:"locker",postures:["dance","standing"],moods:["dance","cheer"],skinned:true}):D.ids;
      const uprightPool=(rawPool.length?rawPool:D.ids).filter(cid=>!LOCKER_FLOOR_CLIPS[cid]);
      const pool=uprightPool.length?uprightPool:(rawPool.length?rawPool:D.ids);
      const clipIdx=Math.floor((time*0.24)+seed)%pool.length;
      const clipId=pool[clipIdx];
      const clip=D.clips&&D.clips[clipId];
      if(clip){
        const dur=Math.max(0.5,(clip.n-1)/(clip.fps||15));
        const localT=featured?Math.min(dur*0.45,1.2):((time*0.92)%dur);
        const dn=D.sample(clipId,localT);
        if(dn&&dn.q){
          const w=featured?0.78:0.92;
          const dq=new T.Quaternion(),dc=new T.Quaternion(),pq=new T.Quaternion(),v=new T.Vector3(),sc=new T.Vector3();
          for(let i=0;i<DANCE_BONES.length;i++){
            const n=DANCE_BONES[i],bone=rig.B[n];if(!bone)continue;
            dq.set(dn.q[i*4],dn.q[i*4+1],dn.q[i*4+2],dn.q[i*4+3]).multiply(rig.restW[n]);
            if(w<1){bone.getWorldQuaternion(dc);dc.slerp(dq,w);}else dc.copy(dq);
            bone.parent.getWorldQuaternion(pq);
            bone.quaternion.copy(pq.invert()).multiply(dc);
            bone.updateMatrixWorld(true);
          }
          if(rig.B.Hips&&dn.hy){
            rig.B.Hips.parent.getWorldQuaternion(pq);
            rig.B.Hips.parent.getWorldScale(sc);
            v.set(0,dn.hy*(rig.restPos.Hips?rig.restPos.Hips.y:0.95)*w,0).applyQuaternion(pq.invert());
            if(sc.x>1e-5)v.x/=sc.x;
            if(sc.y>1e-5)v.y/=sc.y;
            if(sc.z>1e-5)v.z/=sc.z;
            rig.B.Hips.position.add(v);
          }
          rig.root.updateMatrixWorld(true);
          /* 重新贴稳底座并把骨盆水平居中，避免动作下蹲或前倾让人物在选人卡片里显得偏矮/偏移 */
          const fDiff=rig.footMinY()-rig.footRest;
          rig.M.position.y-=fDiff;
          if(rig.B.Hips){
            rig.B.Hips.getWorldPosition(v);
            rig.M.position.x-=v.x*0.75;
            rig.M.position.z-=v.z*0.75;
          }
          rig.root.updateMatrixWorld(true);
          return;
        }
      }
    }
    if(rig.run){
      const run=rig.run,phase=((time*0.65)+(seed*0.13))%1,t=run.t0+phase*run.span;
      const sq=[0,0,0,1],cq=new T.Quaternion();
      const w=featured?0.55:0.42;
      for(const bn in run.rot){
        const tr=run.rot[bn],tm=tr.times,n=tm.length;let i=0;while(i<n-2&&tm[i+1]<=t)i++;
        const a=clamp01((t-tm[i])/Math.max(1e-6,tm[i+1]-tm[i]));
        T.Quaternion.slerpFlat(sq,0,tr.values,i*4,tr.values,(i+1)*4,a);
        rig.B[bn].quaternion.slerp(cq.fromArray(sq),w);
      }
      rig.root.rotation.y=-0.18+Math.sin(time*1.2)*0.08;
      rig.root.updateMatrixWorld(true);
    }
  }

  function refreshTripoSlots(id){
    for(const k of [...cache.keys()]){
      if(k.indexOf(id+":")===0)cache.delete(k);
    }
    if(typeof document==="undefined")return;
    const cards=[...document.querySelectorAll(`[data-locker-avatar="${id}"]`)].filter(el=>!el.closest(".lockerStageVisual"));
    if(cards.length){
      const ctx=buildScene();
      cards.forEach(slot=>{
        try{
          const card=slot.closest(".lockerCard");
          const url=renderStar(ctx,id,!!(card&&card.classList.contains("selected")));
          if(url){slot.innerHTML=`<img alt="" src="${url}">`;slot.classList.add("ready");}
        }catch(e){}
      });
      disposeScene(ctx);
    }
    if(liveView&&liveView.starId===id&&liveView.slot&&liveView.slot.isConnected){
      const rig=tripoRigCache.get(id);
      if(rig){
        liveView.tripoRig=rig;
        liveView.guy.g.visible=false;
        if(rig.root.parent!==liveView.ctx.rig)liveView.ctx.rig.add(rig.root);
        rig.root.visible=true;
        poseTripoRig(rig,(performance.now()-liveView.motionEpoch)/1000,id,false);
        drawLive(liveView);
      }
    }
  }

  function ensureTripoRig(id,cb){
    if(!TRIPO_MODELS[id])return;
    if(tripoRigCache.has(id)){if(cb)cb(tripoRigCache.get(id));return;}
    if(tripoLoading.has(id)){if(cb)tripoLoading.get(id).push(cb);return;}
    const list=cb?[cb]:[];
    tripoLoading.set(id,list);
    ensureGLTFLoader(()=>{
      const url=new URL("../assets/models/"+TRIPO_MODELS[id].file,SELF_URL).href;
      new global.THREE.GLTFLoader().load(url,gltf=>{
        try{
          const rig=buildTripoRig(gltf,id);
          tripoRigCache.set(id,rig);
          tripoLoading.delete(id);
          list.forEach(fn=>{try{fn(rig);}catch(e){}});
          refreshTripoSlots(id);
        }catch(e){
          tripoLoading.delete(id);
        }
      },undefined,()=>{tripoLoading.delete(id);});
    });
  }
  const LOCKER_ACTIONS=Object.freeze({
    wave:{duration:4000},
    shadowShot:{duration:4300},
    jersey:{duration:3300},
    headband:{duration:3600}
  });
  const LOCKER_ACTION_NAMES=Object.freeze(Object.keys(LOCKER_ACTIONS));
  const FOCUS_PRESETS=Object.freeze({
    full:{y:.94,zoom:1,pitch:0},
    shoes:{y:.28,zoom:1.52,pitch:.02},
    knee:{y:.60,zoom:1.48,pitch:.01},
    sleeve:{y:1.12,zoom:1.42,pitch:-.02},
    compression:{y:1.16,zoom:1.38,pitch:-.02},
    band:{y:1.60,zoom:1.48,pitch:-.04},
    head:{y:1.60,zoom:1.48,pitch:-.04}
  });

  function starKey(star){return star&&(star.id||star.n)||"";}
  function allStars(){
    const cfg=global.AIBA_CONFIG||{},assets=global.AIBA_ASSETS||{};
    const custom=global.AIBACustomizer&&typeof global.AIBACustomizer.listStars==="function"?global.AIBACustomizer.listStars():[];
    return [...(cfg.CLASSIC_LEGENDS||[]),...(assets.coverStars||[]),...custom];
  }
  function findStar(id){
    if(!id)return null;
    return allStars().find(star=>starKey(star)===id)||null;
  }
  function dressPreview(guy,star,showGear){
    if(!guy)return;
    const previous=global.AIBA_SUPPRESS_GEAR_VISUAL;
    global.AIBA_SUPPRESS_GEAR_VISUAL=showGear===false;
    try{
      if(star&&star.col&&typeof global.applyStarStyle==="function")global.applyStarStyle(guy,star);
      else{
        if(typeof global.randomizeOutfit==="function")global.randomizeOutfit(guy);
        if(typeof global.dressGuy==="function")global.dressGuy(guy,0x202832,0x77e7ff,"?");
        if(global.equipActorShoes)global.equipActorShoes(guy,"random-preview",0x202832);
      }
    }finally{global.AIBA_SUPPRESS_GEAR_VISUAL=previous;}
  }
  function clamp01(value){return Math.max(0,Math.min(1,value));}
  function smooth01(value){value=clamp01(value);return value*value*(3-2*value);}
  function mix(a,b,k){return a+(b-a)*k;}
  function actionEnvelope(progress,enter=.16,leave=.18){
    return smooth01(progress/enter)*smooth01((1-progress)/leave);
  }
  function blendRotation(node,x,y,z,k){
    if(!node)return;
    node.rotation.x=mix(node.rotation.x,x,k);
    node.rotation.y=mix(node.rotation.y,y,k);
    node.rotation.z=mix(node.rotation.z,z,k);
  }
  function idlePose(guy,time=0){
    if(!guy)return;
    const breathe=Math.sin(time*2.05),sway=Math.sin(time*.72),counter=Math.sin(time*.72+Math.PI*.5);
    guy.g.position.set(0,-.06+breathe*.004,0);
    guy.g.rotation.set(.006+breathe*.003,-.18+sway*.015,sway*.008);
    if(guy.arms){
      // x-negative arm needs negative Z and x-positive arm positive Z to hang away
      // from the torso. The old signs pointed both hands inward against the shorts.
      guy.arms[0].rotation.set(-.06+counter*.012,0,-.13+sway*.008);
      guy.arms[1].rotation.set(-.06-counter*.012,0,.13+sway*.008);
    }
    if(guy.elbows){
      guy.elbows[0].rotation.set(-.17+breathe*.012,0,-.012);
      guy.elbows[1].rotation.set(-.17-breathe*.012,0,.012);
    }
    if(guy.handRoots){
      guy.handRoots[0]&&guy.handRoots[0].rotation.set(-.025,0,-.035);
      guy.handRoots[1]&&guy.handRoots[1].rotation.set(-.025,0,.035);
    }
    if(guy.fingerJoints)guy.fingerJoints.forEach((hand,handIndex)=>hand&&hand.forEach((finger,fingerIndex)=>{
      if(typeof setFingerChainPose==="function")setFingerChainPose(finger,-.08,0);
      else finger.rotation.set(-.08,0,0);
    }));
    if(typeof poseThumbJoints==="function")poseThumbJoints(guy,0);
    if(guy.legs&&guy.knees&&guy.ankles){
      const leftHip=-.012+sway*.010,rightHip=-.012-sway*.010;
      const leftKnee=.028-sway*.008,rightKnee=.028+sway*.008;
      guy.legs[0].rotation.set(leftHip,0,-sway*.005);
      guy.legs[1].rotation.set(rightHip,0,-sway*.005);
      guy.knees[0].rotation.set(leftKnee,0,0);
      guy.knees[1].rotation.set(rightKnee,0,0);
      guy.ankles[0].rotation.set(-(leftHip+leftKnee),0,0);
      guy.ankles[1].rotation.set(-(rightHip+rightKnee),0,0);
    }
    if(guy.shoes)guy.shoes.forEach(shoe=>shoe.rotation.set(0,0,0));
  }
  function wavePose(guy,progress,side){
    const k=actionEnvelope(progress),index=side===1?1:0,other=index?0:1,sign=index?1:-1;
    const wave=Math.sin(progress*Math.PI*7)*k*sign;
    guy.g.rotation.y+=sign*.07*k;
    guy.g.rotation.z-=sign*.025*k;
    guy.g.position.z=.018*k;
    blendRotation(guy.arms&&guy.arms[index],-.12,0,sign*2.22,k);
    blendRotation(guy.elbows&&guy.elbows[index],-.68,0,wave*.16,k);
    blendRotation(guy.handRoots&&guy.handRoots[index],-.12,0,wave*.28,k);
    blendRotation(guy.arms&&guy.arms[other],-.15,0,-sign*.18,k);
    blendRotation(guy.elbows&&guy.elbows[other],-.24,0,sign*.02,k);
    if(guy.legs&&guy.knees&&guy.ankles){
      const lead=index,trail=other;
      guy.legs[lead].rotation.x-=.045*k;
      guy.knees[lead].rotation.x+=.075*k;
      guy.ankles[lead].rotation.x-=.03*k;
      guy.legs[trail].rotation.x+=.025*k;
      guy.knees[trail].rotation.x+=.035*k;
      guy.ankles[trail].rotation.x-=.04*k;
    }
  }
  function shadowShotPose(guy,progress){
    const k=actionEnvelope(progress,.12,.2);
    const load=Math.sin(Math.PI*clamp01((progress-.06)/.50))*k;
    const lift=smooth01((progress-.24)/.36)*(1-smooth01((progress-.80)/.20))*k;
    const release=smooth01((progress-.54)/.14)*(1-smooth01((progress-.82)/.18))*k;
    const legX=-.27*load+.035*release,kneeX=.56*load-.05*release,ankleX=-(legX+kneeX)*.94;
    guy.g.position.y+=-.065*load+.018*release;
    guy.g.rotation.x+=.085*load-.035*release;
    guy.g.rotation.y+=.035*k;
    blendRotation(guy.arms&&guy.arms[0],-.18-.72*load-1.68*lift,0,-.10*lift,k);
    blendRotation(guy.arms&&guy.arms[1],-.18-.64*load-1.30*lift,0,.20*lift,k);
    blendRotation(guy.elbows&&guy.elbows[0],-.42-.82*lift+1.02*release,0,0,k);
    blendRotation(guy.elbows&&guy.elbows[1],-.46-.90*lift+.58*release,0,0,k);
    blendRotation(guy.handRoots&&guy.handRoots[0],1.02*release,0,-.04,k);
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,-1.05,.04,k);
    if(guy.fingerJoints&&guy.fingerJoints[0])guy.fingerJoints[0].forEach((finger,index)=>{
      const curl=-.08+release*([.12,.30,.42,.18][index]||.12);
      if(typeof setFingerChainPose==="function")setFingerChainPose(finger,curl,0);
      else finger.rotation.set(curl,0,0);
    });
    if(guy.legs&&guy.knees&&guy.ankles){
      guy.legs[0].rotation.x=mix(guy.legs[0].rotation.x,legX-.012*load,k);
      guy.legs[1].rotation.x=mix(guy.legs[1].rotation.x,legX+.012*load,k);
      guy.knees[0].rotation.x=mix(guy.knees[0].rotation.x,kneeX*.97,k);
      guy.knees[1].rotation.x=mix(guy.knees[1].rotation.x,kneeX*1.03,k);
      guy.ankles[0].rotation.x=mix(guy.ankles[0].rotation.x,ankleX,k);
      guy.ankles[1].rotation.x=mix(guy.ankles[1].rotation.x,ankleX,k);
    }
  }
  function jerseyPose(guy,progress){
    const k=actionEnvelope(progress),tug=(.5+.5*Math.sin(progress*Math.PI*6))*k;
    guy.g.rotation.x+=.045*k;
    guy.g.rotation.y-=.035*k;
    guy.g.rotation.z+=Math.sin(progress*Math.PI*2)*.012*k;
    guy.g.position.y-=.008*tug;
    blendRotation(guy.arms&&guy.arms[0],-.48,0,.54,k);
    blendRotation(guy.arms&&guy.arms[1],-.48,0,-.54,k);
    blendRotation(guy.elbows&&guy.elbows[0],-.98,0,-.08,k);
    blendRotation(guy.elbows&&guy.elbows[1],-.98,0,.08,k);
    blendRotation(guy.handRoots&&guy.handRoots[0],-.18,Math.PI,.08+tug*.08,k);
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,Math.PI,-.08-tug*.08,k);
    if(guy.legs&&guy.knees&&guy.ankles){
      guy.legs[0].rotation.x-=.035*k;guy.knees[0].rotation.x+=.075*k;guy.ankles[0].rotation.x-=.04*k;
      guy.legs[1].rotation.x+=.018*k;guy.knees[1].rotation.x+=.028*k;guy.ankles[1].rotation.x-=.025*k;
    }
  }
  function headbandPose(guy,progress){
    const k=actionEnvelope(progress),adjust=Math.sin(progress*Math.PI*5)*.06*k;
    guy.g.rotation.x-=.018*k;
    guy.g.rotation.y+=.045*k;
    guy.g.rotation.z+=Math.sin(progress*Math.PI*2)*.012*k;
    blendRotation(guy.arms&&guy.arms[0],-.42,0,-1.48,k);
    blendRotation(guy.arms&&guy.arms[1],-.42,0,1.48,k);
    blendRotation(guy.elbows&&guy.elbows[0],-1.22,0,-.08,k);
    blendRotation(guy.elbows&&guy.elbows[1],-1.22,0,.08,k);
    blendRotation(guy.handRoots&&guy.handRoots[0],-.18,Math.PI*.5,-.10+adjust,k);
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,-Math.PI*.5,.10-adjust,k);
    if(guy.legs&&guy.knees&&guy.ankles){
      guy.legs[0].rotation.x-=.022*k;guy.legs[1].rotation.x-=.022*k;
      guy.knees[0].rotation.x+=.052*k;guy.knees[1].rotation.x+=.052*k;
      guy.ankles[0].rotation.x-=.03*k;guy.ankles[1].rotation.x-=.03*k;
    }
  }
  function applyVoxDancePose(guy,time,id,weight){
    const D=global.AIBADance;
    if(D&&typeof D.load==="function"&&!D.ready&&!D.loading)D.load();
    if(!D||!D.ready||!Array.isArray(D.ids)||!D.ids.length||typeof D.applyVox!=="function")return false;
    const voxIds=typeof D.list==="function"
      ?D.list({role:"locker",postures:["dance","standing"],moods:["dance","cheer"],skinned:false})
      :D.ids.filter(k=>D.clips[k]&&D.clips[k].vox_ok);
    const pool=voxIds.length?voxIds:D.ids;
    const seed=Array.from(String(id||"random")).reduce((n,c)=>n+c.charCodeAt(0),0);
    const clipId=pool[Math.floor((time*0.22)+seed)%pool.length];
    const clip=D.clips[clipId];if(!clip)return false;
    const dur=Math.max(0.5,(clip.n-1)/(clip.fps||15));
    const dn=D.sample(clipId,(time*0.9)%dur);
    if(!dn||!dn.vox)return false;
    guy.g.rotation.set(0,-0.18,0);
    guy.g.position.set(0,-0.06,0);
    if(D.applyVox(guy,dn.vox,weight==null?1:weight)){
      guy.g.position.y-=0.06;
      return true;
    }
    return false;
  }
  function featuredPose(guy,id){
    idlePose(guy,.7);
    if(applyVoxDancePose(guy,1.15,id,0.88))return;
    const side=Array.from(id||"random").reduce((n,c)=>n+c.charCodeAt(0),0)%2;
    wavePose(guy,.52,side);
  }
  function refillActionBag(view){
    const bag=LOCKER_ACTION_NAMES.slice();
    for(let i=bag.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1)),tmp=bag[i];bag[i]=bag[j];bag[j]=tmp;
    }
    if(view.lastAction&&bag[0]===view.lastAction)bag.push(bag.shift());
    view.actionBag=bag;
  }
  function beginLockerAction(view,now){
    if(!view.actionBag.length)refillActionBag(view);
    const name=view.actionBag.shift(),spec=LOCKER_ACTIONS[name];
    view.action={name,startedAt:now,duration:spec.duration,side:Math.random()<.5?0:1};
    view.lastAction=name;
  }
  function updateLiveMotion(view,now){
    const motionTime=(now-view.motionEpoch)/1000;
    if(view.tripoRig){
      poseTripoRig(view.tripoRig,view.reducedMotion?0.6:motionTime,view.starId,view.reducedMotion);
      if(view.reducedMotion){view.slot.dataset.lockerAction="idle";return;}
      if(!view.action&&now>=view.nextActionAt)beginLockerAction(view,now);
      if(!view.action){view.slot.dataset.lockerAction="idle";return;}
      const progress=clamp01((now-view.action.startedAt)/view.action.duration);
      view.slot.dataset.lockerAction=view.action.name;
      if(progress>=1){
        view.action=null;
        view.nextActionAt=now+600+Math.random()*600;
        view.slot.dataset.lockerAction="idle";
      }
      return;
    }
    idlePose(view.guy,motionTime);
    if(view.reducedMotion){view.slot.dataset.lockerAction="idle";return;}
    if(!view.action&&now>=view.nextActionAt)beginLockerAction(view,now);
    if(!view.action){
      applyVoxDancePose(view.guy,motionTime,view.starId,0.85);
      view.slot.dataset.lockerAction="idle";
      return;
    }
    const progress=clamp01((now-view.action.startedAt)/view.action.duration);
    view.slot.dataset.lockerAction=view.action.name;
    const env=actionEnvelope(progress,.14,.16);
    if(!applyVoxDancePose(view.guy,motionTime,view.starId,0.35+0.65*env)){
      if(view.action.name==="wave")wavePose(view.guy,progress,view.action.side);
      else if(view.action.name==="shadowShot")shadowShotPose(view.guy,progress);
      else if(view.action.name==="jersey")jerseyPose(view.guy,progress);
      else if(view.action.name==="headband")headbandPose(view.guy,progress);
    }
    if(progress>=1){
      view.action=null;
      view.nextActionAt=now+600+Math.random()*600;
      view.slot.dataset.lockerAction="idle";
    }
  }
  function startLiveMotion(view){
    const tick=now=>{
      if(view!==liveView||!view.slot.isConnected)return;
      view.motionRaf=requestAnimationFrame(tick);
      if(document.hidden||now-view.lastMotionFrame<33)return;
      view.lastMotionFrame=now;
      updateLiveMotion(view,now);
      drawLive(view);
    };
    view.motionRaf=requestAnimationFrame(tick);
  }
  function clearGroup(group){
    while(group.children.length){
      const child=group.children.pop();
      if(child.__keepCached)continue;
      if(child.__shoePreviewGuy&&global.AIBABasketballShoes)global.AIBABasketballShoes.clear(child.__shoePreviewGuy);
      child.traverse&&child.traverse(obj=>{
        if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.filter(Boolean).forEach(mat=>mat.dispose&&mat.dispose());
      });
    }
  }
  function buildScene(width=W,height=H,preserve=true){
    const canvas=document.createElement("canvas");
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,preserveDrawingBuffer:preserve});
    renderer.setPixelRatio(Math.min(global.devicePixelRatio||1,1.5));
    renderer.setSize(width,height,false);
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const rig=new THREE.Group();scene.add(rig);
    const hemi=new THREE.HemisphereLight(0xdff7ff,0x101010,1.25);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xffffff,1.25);key.position.set(2.8,4,3.5);scene.add(key);
    const rim=new THREE.DirectionalLight(0x77e7ff,.82);rim.position.set(-2.5,2.2,-2.6);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(1.42,.055,1.04),new THREE.MeshLambertMaterial({color:0x17202b}));
    floor.position.set(0,-.08,0);scene.add(floor);
    const camera=new THREE.PerspectiveCamera(31,width/height,.1,20);
    camera.position.set(.18,1.07,4.25);
    camera.lookAt(new THREE.Vector3(0,.94,0));
    return {canvas,renderer,scene,rig,camera,floor};
  }
  function disposeScene(ctx){
    if(!ctx)return;
    clearGroup(ctx.rig);
    if(ctx.floor){
      ctx.floor.geometry&&ctx.floor.geometry.dispose();
      ctx.floor.material&&ctx.floor.material.dispose();
    }
    ctx.renderer&&ctx.renderer.dispose();
  }
  function renderStar(ctx,id,featured){
    if(!global.THREE||typeof global.voxelGuy!=="function")return "";
    clearGroup(ctx.rig);
    const star=findStar(id);
    const key=(id||"__random")+":"+(star&&star.updatedAt||0)+(featured?":pose":":stand");
    if(cache.has(key))return cache.get(key);
    if(id&&TRIPO_MODELS[id]){
      const rig=tripoRigCache.get(id);
      if(!rig){
        ensureTripoRig(id);
        return "";
      }
      const prevParent=rig.root.parent;
      poseTripoRig(rig,featured?1.25:0.55,id,true);
      rig.root.visible=true;
      ctx.rig.add(rig.root);
      ctx.renderer.render(ctx.scene,ctx.camera);
      const url=ctx.canvas.toDataURL("image/png");
      ctx.rig.remove(rig.root);
      if(prevParent)prevParent.add(rig.root);
      cache.set(key,url);
      while(cache.size>96)cache.delete(cache.keys().next().value);
      return url;
    }
    const guy=global.voxelGuy();
    guy.g.__shoePreviewGuy=guy;
    dressPreview(guy,star,false);
    if(featured)featuredPose(guy,id);
    else idlePose(guy);
    ctx.rig.add(guy.g);
    ctx.renderer.render(ctx.scene,ctx.camera);
    const url=ctx.canvas.toDataURL("image/png");
    cache.set(key,url);
    while(cache.size>96)cache.delete(cache.keys().next().value);
    return url;
  }
  function clampZoom(value){return Math.max(.72,Math.min(1.62,value));}
  function clampPitch(value){return Math.max(-1.22,Math.min(1.22,value));}
  function drawLive(view){
    if(!view||!view.slot.isConnected)return;
    const radius=4.25/view.zoom,azimuth=view.baseAzimuth-view.yaw,elevation=view.baseElevation+view.pitch;
    view.ctx.camera.position.set(
      view.lookAt.x+Math.sin(azimuth)*Math.cos(elevation)*radius,
      view.lookAt.y+Math.sin(elevation)*radius,
      view.lookAt.z+Math.cos(azimuth)*Math.cos(elevation)*radius
    );
    view.ctx.camera.lookAt(view.lookAt);
    view.slot.dataset.orbitYaw=view.yaw.toFixed(3);
    view.slot.dataset.orbitPitch=view.pitch.toFixed(3);
    view.slot.dataset.orbitZoom=view.zoom.toFixed(3);
    view.ctx.renderer.render(view.ctx.scene,view.ctx.camera);
  }
  function resetLive(){
    if(!liveView)return;
    focusTicket++;
    liveView.yaw=0;liveView.pitch=0;liveView.zoom=1;liveView.lookAt.y=liveView.fullLookY;liveView.focusPart="full";
    liveView.userPosed=false;   // ↺ 是明确的"交还镜头"
    liveView.slot.dataset.orbitFocus="full";
    drawLive(liveView);
  }
  /* 试衣镜自动运镜的两条克制规则(实测反馈:"点击后老是乱跳"):
     ① 槽位没变就不要重新运镜 —— 连着试同一格里的 4 双鞋是最常见的操作,
        每点一下都把镜头重新拉一遍,看着就是抖。
     ② 用户自己拖过/缩放过之后,别再抢镜头 —— 他正对着某个角度看做工,
        点一下装备就被拽回预设机位。想回默认位有右上角的 ↺ 按钮。 */
  function focusLive(part,opts){
    if(!liveView)return;
    const view=liveView,preset=FOCUS_PRESETS[part]||FOCUS_PRESETS.full,ticket=++focusTicket;
    const wanted=FOCUS_PRESETS[part]?part:"full";
    const forced=!!(opts&&opts.force);
    if(!forced&&view.focusPart===wanted)return;      // ① 同槽位:不动
    if(!forced&&view.userPosed)return;               // ② 用户已接管:不动
    const targetY=(part&&part!=="full"?preset.y*view.bodyH:view.fullLookY);
    const start={y:view.lookAt.y,zoom:view.zoom,pitch:view.pitch},started=performance.now();
    view.focusPart=wanted;
    /* 立刻写一次:运镜靠 rAF 推进,标签不该等一帧才更新(后台标签页里 rAF 不跑,
       属性会一直停在旧值)。下面每帧再写是为了动画中途也保持一致。 */
    view.slot.dataset.orbitFocus=wanted;
    const step=now=>{
      if(ticket!==focusTicket||view!==liveView||!view.slot.isConnected)return;
      const raw=Math.min(1,(now-started)/240),k=raw*raw*(3-2*raw);
      view.lookAt.y=start.y+(targetY-start.y)*k;
      view.zoom=start.zoom+(preset.zoom-start.zoom)*k;
      view.pitch=start.pitch+(preset.pitch-start.pitch)*k;
      view.slot.dataset.orbitFocus=view.focusPart;drawLive(view);
      if(raw<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function destroyLive(){
    if(!liveView)return;
    focusTicket++;
    if(liveView.motionRaf)cancelAnimationFrame(liveView.motionRaf);
    liveView.cleanup.forEach(fn=>fn());
    liveView.resizeObserver&&liveView.resizeObserver.disconnect();
    disposeScene(liveView.ctx);
    liveView=null;
  }
  function watchLiveDetach(){
    if(detachObserver||typeof MutationObserver!=="function"||!document.body)return;
    detachObserver=new MutationObserver(()=>{if(liveView&&!liveView.slot.isConnected)destroyLive();});
    detachObserver.observe(document.body,{childList:true,subtree:true});
  }
  function mountLive(slot,id){
    destroyLive();
    if(global.AIBADance&&typeof global.AIBADance.load==="function")global.AIBADance.load();
    const width=Math.max(140,Math.round(slot.clientWidth||210));
    const height=Math.max(160,Math.round(slot.clientHeight||220));
    const ctx=buildScene(width,height,false),guy=global.voxelGuy(),star=findStar(id);
    const isTripo=!!(id&&TRIPO_MODELS[id]);
    let tripoRig=isTripo?(tripoRigCache.get(id)||null):null;
    guy.g.__shoePreviewGuy=guy;
    dressPreview(guy,star,true);idlePose(guy);ctx.rig.add(guy.g);
    if(isTripo){
      /* 非方块人的新角色直接展示 3D 模型,绝不展示方块人代替样式 */
      guy.g.visible=false;
      if(tripoRig){
        poseTripoRig(tripoRig,0,id,false);
        tripoRig.root.visible=true;
        ctx.rig.add(tripoRig.root);
      }else{
        ensureTripoRig(id);
      }
    }
    const canvas=ctx.canvas,translate=global.AIBAI18N&&global.AIBAI18N.t;
    canvas.className="lockerOrbitCanvas";
    canvas.tabIndex=0;
    canvas.setAttribute("role","img");
    canvas.setAttribute("aria-label",translate?translate("可旋转缩放的3D球员预览"):"可旋转缩放的3D球员预览");
    canvas.style.touchAction="none";
    slot.innerHTML="";slot.appendChild(canvas);
    slot.classList.add("ready","interactive");
    const body=star&&global.AIBA_CONFIG&&global.AIBA_CONFIG.bodyProfileFor?global.AIBA_CONFIG.bodyProfileFor(star):{h:1,w:1};
    const lookY=.94*(Number(body&&body.h)||1);
    const now=performance.now();
    const view={slot,ctx,guy,starId:id||"",tripoRig,yaw:0,pitch:0,zoom:1,focusPart:"full",userPosed:false,bodyH:Number(body&&body.h)||1,fullLookY:lookY,baseAzimuth:Math.atan2(.18,4.25),baseElevation:Math.asin((1.07-.94)/4.25),lookAt:new THREE.Vector3(0,lookY,0),cleanup:[],resizeObserver:null,
      motionEpoch:now,lastMotionFrame:0,motionRaf:0,reducedMotion:!!(global.matchMedia&&global.matchMedia("(prefers-reduced-motion: reduce)").matches),action:null,actionBag:[],lastAction:"",nextActionAt:now+350+Math.random()*350};
    liveView=view;
    let mouseDragging=false,lastMouseX=0,lastMouseY=0,pinchDistance=0,pinchZoom=1,lastTouchX=0,lastTouchY=0;
    const touchDistance=touches=>touches.length<2?0:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
    const mouseDown=e=>{
      if(e.button!==0)return;
      e.preventDefault();focusTicket++;mouseDragging=true;lastMouseX=e.clientX;lastMouseY=e.clientY;
      slot.classList.add("dragging");canvas.focus();
    };
    const mouseMove=e=>{
      if(!mouseDragging)return;
      e.preventDefault();focusTicket++;view.userPosed=true;
      view.yaw+=(e.clientX-lastMouseX)*.014;
      view.pitch=clampPitch(view.pitch+(e.clientY-lastMouseY)*.012);
      lastMouseX=e.clientX;lastMouseY=e.clientY;drawLive(view);
    };
    const mouseUp=()=>{mouseDragging=false;slot.classList.remove("dragging");};
    const touchStart=e=>{
      e.preventDefault();
      if(e.touches.length===1){lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;}
      else if(e.touches.length>=2){pinchDistance=touchDistance(e.touches);pinchZoom=view.zoom;}
      slot.classList.add("dragging");canvas.focus();
    };
    const touchMove=e=>{
      e.preventDefault();
      if(e.touches.length===1){
        const x=e.touches[0].clientX,y=e.touches[0].clientY;
        focusTicket++;view.userPosed=true;   // 手机上拖动同样要打断在飞的运镜
        view.yaw+=(x-lastTouchX)*.014;view.pitch=clampPitch(view.pitch+(y-lastTouchY)*.012);
        lastTouchX=x;lastTouchY=y;
      }else if(e.touches.length>=2&&pinchDistance>0){focusTicket++;view.userPosed=true;view.zoom=clampZoom(pinchZoom*touchDistance(e.touches)/pinchDistance);}
      drawLive(view);
    };
    const touchEnd=e=>{
      if(e.touches&&e.touches.length===1){lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;}
      else if(!e.touches||!e.touches.length){pinchDistance=0;pinchZoom=view.zoom;slot.classList.remove("dragging");}
    };
    const wheel=e=>{e.preventDefault();focusTicket++;view.userPosed=true;view.zoom=clampZoom(view.zoom*Math.exp(-e.deltaY*.0015));drawLive(view);};
    const keys=e=>{
      let handled=true;
      if(e.key==="ArrowLeft")view.yaw-=.16;
      else if(e.key==="ArrowRight")view.yaw+=.16;
      else if(e.key==="ArrowUp")view.pitch=clampPitch(view.pitch-.12);
      else if(e.key==="ArrowDown")view.pitch=clampPitch(view.pitch+.12);
      else if(e.key==="+"||e.key==="=")view.zoom=clampZoom(view.zoom*1.08);
      else if(e.key==="-"||e.key==="_")view.zoom=clampZoom(view.zoom/1.08);
      else if(e.key==="0"||e.key==="Home"){view.yaw=0;view.pitch=0;view.zoom=1;view.lookAt.y=view.fullLookY;view.focusPart="full";view.slot.dataset.orbitFocus="full";}
      else handled=false;
      if(handled){e.preventDefault();drawLive(view);}
    };
    const dbl=e=>{e.preventDefault();resetLive();};
    [[slot,"mousedown",mouseDown],[global,"mousemove",mouseMove],[global,"mouseup",mouseUp],[slot,"touchstart",touchStart],[slot,"touchmove",touchMove],[slot,"touchend",touchEnd],[slot,"touchcancel",touchEnd],[canvas,"keydown",keys],[slot,"dblclick",dbl]].forEach(([target,name,fn])=>{
      const opts=name.indexOf("touch")===0?{passive:false}:undefined;
      target.addEventListener(name,fn,opts);view.cleanup.push(()=>target.removeEventListener(name,fn,opts));
    });
    slot.addEventListener("wheel",wheel,{passive:false});view.cleanup.push(()=>slot.removeEventListener("wheel",wheel));
    if(typeof ResizeObserver==="function"){
      view.resizeObserver=new ResizeObserver(()=>{
        if(!slot.isConnected)return;
        const w=Math.max(140,Math.round(slot.clientWidth||210)),h=Math.max(160,Math.round(slot.clientHeight||220));
        ctx.renderer.setSize(w,h,false);ctx.camera.aspect=w/h;ctx.camera.updateProjectionMatrix();drawLive(view);
      });
      view.resizeObserver.observe(slot);
    }
    watchLiveDetach();drawLive(view);startLiveMotion(view);
  }
  function render(root){
    const slots=[...root.querySelectorAll("[data-locker-avatar]")];
    if(!slots.length||!global.THREE){destroyLive();return;}
    const stageSlot=root.querySelector(".lockerStageVisual [data-locker-avatar],.customPreview>[data-locker-avatar]");
    const ticket=++renderTicket;
    requestAnimationFrame(()=>{
      if(ticket!==renderTicket)return;
      const staticSlots=slots.filter(slot=>slot!==stageSlot),ctx=buildScene();
      staticSlots.forEach(slot=>{
        try{
          const card=slot.closest(".lockerCard");
          const url=renderStar(ctx,slot.getAttribute("data-locker-avatar")||"",!!(card&&card.classList.contains("selected")));
          if(url)slot.innerHTML=`<img alt="" src="${url}">`;
          slot.classList.toggle("ready",!!url);
        }catch(e){
          slot.classList.add("failed");
          slot.innerHTML="<i>3D</i><b>OFFLINE</b>";
        }
      });
      disposeScene(ctx);
      if(stageSlot&&stageSlot.isConnected){
        try{mountLive(stageSlot,stageSlot.getAttribute("data-locker-avatar")||"");}
        catch(e){stageSlot.classList.add("failed");stageSlot.innerHTML="<i>3D</i><b>OFFLINE</b>";}
      }else destroyLive();
    });
  }

  function refreshLive(root){
    root=root||document;
    const slot=root.querySelector(".lockerStageVisual [data-locker-avatar],.customPreview>[data-locker-avatar]");
    if(!slot||!global.THREE)return false;
    try{mountLive(slot,slot.getAttribute("data-locker-avatar")||"");return true;}
    catch(e){slot.classList.add("failed");slot.innerHTML="<i>3D</i><b>OFFLINE</b>";return false;}
  }

  global.AIBALockerPreview={render,refreshLive,reset:resetLive,focus:focusLive,destroy:destroyLive};
})(window);
