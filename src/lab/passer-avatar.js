/* Qingzi's skinned avatar. Game poses preserve the model's bind lengths and use
   actual palm contacts; pregame choreography still uses its existing pose data. */
(function(global){
  "use strict";

  const MODEL_URL = "assets/models/passer_qingzi.glb";
  const LOADER_URL = "vendor/GLTFLoader.r128.js";

  const THROW_RELEASE_TIME=.34,THROW_DURATION=.72;

  const DANCE_BONES=["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"];

  const state = {
    loading: false,
    ready: false,
    root: null,
    mesh: null,
    bones: {},
    restLocal: {},
    restWorld: {},
    chains: {},
    hipY:.95,
    isThrowing:false,
    released:false,
    throwTime:0,
    rackPose:null,
    ballCenter:null,
    attachedGuy: null,
    reactClip:null,
    reactT:0,
    reactDur:0
  };

  const _vMid = new THREE.Vector3();
  const _qWorld = new THREE.Quaternion();
  const _dq = new THREE.Quaternion();
  const _dc = new THREE.Quaternion();
  const _pq = new THREE.Quaternion();
  const _eul = new THREE.Euler();

  function ensureLoader(cb){
    if(global.THREE && global.THREE.GLTFLoader) return cb();
    const s = document.createElement("script");
    s.src = LOADER_URL;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function loadModel(){
    if(state.loading || state.ready) return;
    state.loading = true;
    ensureLoader(()=>{
      new global.THREE.GLTFLoader().load(MODEL_URL, gltf=>{
        const root = new THREE.Group();
        root.name = "qingziPasserAvatar";
        root.add(gltf.scene);

        let mesh = null;
        const bones = {}, restLocal = {}, restWorld = {};
        const maxAniso = (typeof renderer !== "undefined" && renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy)
          ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
        gltf.scene.traverse(child=>{
          child.frustumCulled = false;
          if(child.isSkinnedMesh && !mesh) mesh = child;
          if(child.isBone){
            const bn = child.name.replace(/^mixamorig:?/, "");
            bones[bn] = child;
          }
          if(child.isMesh){
            child.castShadow = true;
            child.receiveShadow = true;
            if(child.material){
              child.material.roughness = 0.65;
              child.material.metalness = 0.1;
              if(child.material.map){
                child.material.map.anisotropy = maxAniso;
                child.material.map.needsUpdate = true;
              }
            }
          }
        });
        // 记录骨骼初始局部/世界旋转（供舞蹈、投篮与还原传球待机使用）
        gltf.scene.updateMatrixWorld(true);
        for(const bn in bones){
          restLocal[bn] = bones[bn].quaternion.clone();
          restWorld[bn] = bones[bn].getWorldQuaternion(new THREE.Quaternion());
        }
        const hipPos = bones.Hips ? bones.Hips.getWorldPosition(new THREE.Vector3()) : null;
        state.hipY = hipPos && hipPos.y > 0.3 ? hipPos.y : 0.95;
        state.bones = bones;
        state.restLocal = restLocal;
        state.restWorld = restWorld;

        state.root = root;
        state.mesh = mesh;
        for(const side of ["Left","Right"]){
          const arm=bones[side+"Arm"],elbow=bones[side+"ForeArm"],hand=bones[side+"Hand"];
          const thigh=bones[side+"UpLeg"],shin=bones[side+"Leg"],foot=bones[side+"Foot"];
          if(!arm||!elbow||!hand||!thigh||!shin||!foot)continue;
          state.chains[side]={
            arm:bindChain(arm,elbow,hand,v(0,.58,1)),leg:bindChain(thigh,shin,foot,v(0,0,1)),
            palm:bindPalm(side,bones,hand),
            foot:root.worldToLocal(foot.getWorldPosition(new THREE.Vector3()))
          };
        }
        state.ready = true;
        state.loading = false;

        checkAttach();
      }, undefined, err=>{
        console.warn("[passer-avatar] Failed to load qingzi model:", err);
        state.loading = false;
      });
    });
  }

  function isDescendantOf(node, root){
    let p = node;
    while(p){
      if(p === root) return true;
      p = p.parent;
    }
    return false;
  }

  function hideVoxelMeshes(guy){
    if(!guy || !guy.g) return;
    guy.g.traverse(child=>{
      if(child.isMesh && child.name !== "passerBall" && (!state.root || !isDescendantOf(child, state.root))){
        child.visible = false;
      }
    });
  }

  function checkAttach(){
    if(!state.ready || !state.root) return;
    const guy = typeof passer !== "undefined" ? passer : null;
    if(!guy || !guy.g) return;
    if(state.attachedGuy !== guy || state.root.parent !== guy.g){
      if(state.root.parent) state.root.parent.remove(state.root);
      guy.g.add(state.root);
      state.root.position.set(0, 0, 0);
      state.root.rotation.y = 0;
      state.root.scale.set(1, 1, 1);
      state.attachedGuy = guy;
      if(typeof passerBall!=="undefined"&&passerBall)passerBall.name="passerBall";
      hideVoxelMeshes(guy);
    }
  }

  const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const slerpSpace=new THREE.Quaternion();
  const jointFrame=new THREE.Matrix4();
  const localBall=v();
  function flatten(direction,axis){
    return direction.addScaledVector(axis,-direction.dot(axis)).normalize();
  }

  // The hand's local axes differ between sides. Derive the contact frame from
  // the actual knuckles, so palm orientation is independent of Mixamo's roll.
  function frameRotation(forward,normal){
    const across=v().crossVectors(forward,normal).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(jointFrame.makeBasis(across,forward,normal));
  }
  function bindPalm(side,bones,hand){
    const start=hand.getWorldPosition(v());
    const middle=bones[side+"HandMiddle1"].getWorldPosition(v());
    const index=bones[side+"HandIndex1"].getWorldPosition(v());
    const pinky=bones[side+"HandPinky1"].getWorldPosition(v());
    const fingers=middle.clone().sub(start).normalize();
    const normal=v().crossVectors(fingers,index.sub(pinky)).normalize().multiplyScalar(side==="Left"?1:-1);
    const inverseFrame=frameRotation(fingers,normal).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
    const curls=[];
    for(const digit of ["Index","Middle","Ring","Pinky"]){
      for(let i=1;i<=3;i++){
        const key=side+"Hand"+digit+i,bone=bones[key],next=bones[side+"Hand"+digit+(i+1)];
        const localNormal=normal.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
        const axis=v().crossVectors(next.position.clone().normalize(),localNormal).normalize();
        curls.push({key,bone,axis,angle:[.27,.38,.17][i-1]});
      }
    }
    return {inverseFrame,curls};
  }
  function bindChain(start,joint,tip,front){
    const a=start.getWorldPosition(v()),b=joint.getWorldPosition(v()),c=tip.getWorldPosition(v());
    function bindFrame(bone,child){
      const localAxis=child.position.clone().normalize();
      const localFront=front.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      return frameRotation(localAxis,flatten(localFront,localAxis)).invert();
    }
    return {start,joint,tip,a:a.distanceTo(b),b:b.distanceTo(c),
      startFrame:bindFrame(start,joint),jointFrame:bindFrame(joint,tip)};
  }
  function setWorldRotation(bone,q){
    bone.parent.getWorldQuaternion(slerpSpace).invert();
    bone.quaternion.copy(slerpSpace).multiply(q);
    bone.updateMatrixWorld(true);
  }
  function chainPoints(chain,origin,target,pole){
    const along=target.clone().sub(origin);
    const length=THREE.MathUtils.clamp(along.length(),Math.abs(chain.a-chain.b)+.001,chain.a+chain.b-.002);
    along.normalize();
    const bend=flatten(pole.clone(),along);
    const projected=(chain.a*chain.a-chain.b*chain.b+length*length)/(2*length);
    return {
      joint:origin.clone().addScaledVector(along,projected).addScaledVector(bend,Math.sqrt(Math.max(0,chain.a*chain.a-projected*projected))),
      tip:origin.clone().addScaledVector(along,length)
    };
  }
  function poseChain(chain,origin,points,upperFront,lowerFront){
    const upper=points.joint.clone().sub(origin).normalize();
    const lower=points.tip.clone().sub(points.joint).normalize();
    setWorldRotation(chain.start,frameRotation(upper,flatten(upperFront,upper)).multiply(chain.startFrame));
    setWorldRotation(chain.joint,frameRotation(lower,flatten(lowerFront,lower)).multiply(chain.jointFrame));
  }
  function plantedFoot(limb,side,step){
    if(!step)return {
      position:state.attachedGuy.g.localToWorld(limb.foot.clone()),
      rotation:_qWorld.clone()
    };
    const {from,to,yawFrom,yawTo,progress}=step;
    const second=side!==step.lead;
    const start=second ? .51 : 0,end=second?1:.48;
    const phase=THREE.MathUtils.clamp((progress-start)/(end-start),0,1);
    const amount=THREE.MathUtils.smoothstep(phase,0,1);
    const rotation=new THREE.Quaternion().setFromAxisAngle(v(0,1,0),yawFrom);
    const finalRotation=new THREE.Quaternion().setFromAxisAngle(v(0,1,0),yawTo);
    const position=limb.foot.clone().applyQuaternion(rotation).add(from)
      .lerp(limb.foot.clone().applyQuaternion(finalRotation).add(to),amount);
    position.y+=Math.sin(Math.PI*phase)*.085;
    return {position,rotation:rotation.slerp(finalRotation,amount)};
  }
  function poseGrip(center,dip,lean,relax=0,step=null){
    restoreRestPose();
    // Send the hips back as they descend. The torso can lean over a low
    // ball while the knees and shoes remain clear of the front of the rack.
    state.root.position.set(0,-dip,-dip*.68);
    state.root.updateMatrixWorld(true);
    state.root.getWorldQuaternion(_qWorld);
    setBoneCharDelta("Spine",_qChar.setFromEuler(_eul.set(lean*.72,0,0,"XYZ")));
    setBoneCharDelta("Spine1",_qChar.setFromEuler(_eul.set(lean,0,0,"XYZ")));
    const gazeHeight=state.attachedGuy.g.worldToLocal(center.clone()).y;
    const lookDown=THREE.MathUtils.clamp(.18+(1.16-gazeHeight)*.65,.08,.40)*(1-relax);
    setBoneCharDelta("Head",_qChar.setFromEuler(_eul.set(lookDown,0,0,"XYZ")));
    for(const side of ["Left","Right"]){
      const limb=state.chains[side];
      if(!limb)continue;
      const sign=side==="Left"?1:-1;
      const foot=plantedFoot(limb,side,step);
      const kneeFront=v(sign*.095,0,1).applyQuaternion(foot.rotation);
      const hip=limb.leg.start.getWorldPosition(v());
      poseChain(limb.leg,hip,chainPoints(limb.leg,hip,foot.position,kneeFront),kneeFront.clone(),kneeFront.clone());
      setWorldRotation(limb.leg.tip,foot.rotation.multiply(state.restWorld[side+"Foot"]));

      const shoulder=limb.arm.start.getWorldPosition(v());
      const lowSlot=1-THREE.MathUtils.smoothstep(gazeHeight,.86,1.045);
      const radial=v(sign*.94,-.16+lowSlot*.36,-.30).normalize().applyQuaternion(_qWorld);
      const normal=radial.clone().negate().lerp(v(-sign,.10,.19).applyQuaternion(_qWorld),relax).normalize();
      const guide=v(0,.30,1).applyQuaternion(_qWorld);
      const fingers=flatten(guide.clone(),normal);
      const contact=center.clone().addScaledVector(radial,.169);
      const pole=v(sign*.67,-.72,-.25).applyQuaternion(_qWorld);
      const rest=state.attachedGuy.g.localToWorld(v(sign*.224,1.085,.045));
      let points;
      for(let i=0;i<3;i++){
        // Offset the wrist by the measured wrist-to-palm distance. Settle the
        // last direction along the forearm to avoid hinging the wrist sideways.
        const wrist=contact.clone().addScaledVector(fingers,-.058).addScaledVector(normal,-.010).lerp(rest,relax);
        points=chainPoints(limb.arm,shoulder,wrist,pole);
        if(i<2){
          const fore=flatten(points.tip.clone().sub(points.joint),normal);
          fingers.copy(flatten(fore.lerp(guide,.32*(1-relax)),normal));
        }
      }
      const upperFront=points.tip.clone().sub(points.joint);
      const forearmFront=normal.clone().lerp(upperFront.clone().negate().normalize(),.12);
      poseChain(limb.arm,shoulder,points,upperFront,forearmFront);
      setWorldRotation(limb.arm.tip,frameRotation(fingers,normal).multiply(limb.palm.inverseFrame));
      const curl=THREE.MathUtils.lerp(.86,.36,relax);
      for(const digit of limb.palm.curls){
        digit.bone.quaternion.copy(state.restLocal[digit.key]).multiply(_dq.setFromAxisAngle(digit.axis,digit.angle*curl));
      }
    }
    state.ballCenter=relax>.99?null:center;
  }
  function chestPoint(y,z,x=0){
    return state.attachedGuy.g.localToWorld(localBall.set(x,y,z));
  }
  function idleGrip(){
    const t=typeof G!=="undefined"?G.tNow:0;
    const hasBall=!state.attachedGuy.g.userData.rushHelper&&(typeof passerBall==="undefined"||passerBall.visible);
    poseGrip(chestPoint(1.185+.006*Math.sin(t*1.65),.273),hasBall ? .055 : .018,hasBall ? .085 : .027,hasBall?0:1);
  }
  function getBallWorldPos(out){
    if(!state.ready||!state.ballCenter)return null;
    return (out||v()).copy(state.ballCenter);
  }
  function playThrow(){
    if(!state.ready||!state.chains.Left||!state.chains.Right)return;
    state.rackPose=null;
    state.isThrowing=true;state.released=false;state.throwTime=0;
    poseGrip(chestPoint(1.185,.273),.055,.085);
  }
  function markReleased(){state.released=true;}
  function getReleaseDelay(){return state.isThrowing?THROW_RELEASE_TIME:0;}
  function poseThrow(dt){
    state.throwTime+=dt;
    const t=state.throwTime;
    const smooth=THREE.MathUtils.smoothstep;
    if(t>=THROW_DURATION){
      state.isThrowing=false;state.released=false;
      idleGrip();return;
    }
    const wind=smooth(t,0,.13),push=smooth(t,.13,THROW_RELEASE_TIME);
    const settle=smooth(t,.40,THROW_DURATION);
    const y=1.185+.036*wind+.059*push;
    const z=.273-.030*wind+.161*push;
    poseGrip(chestPoint(y,z),.055+.027*wind-.025*push,.085+.11*push,settle);
  }
  function setRackPose(center,relax=0,step=null){
    state.rackPose=center;
    if(center&&state.ready&&state.attachedGuy?.g.visible){
      const dip=THREE.MathUtils.clamp(.062+(1.16-center.y)*.86,.035,.305);
      const reach=state.attachedGuy.g.worldToLocal(center.clone()).z;
      const lean=THREE.MathUtils.clamp(.14+(reach-.26)*1.8+(dip-.06)*1.2,.09,.68);
      poseGrip(center,THREE.MathUtils.lerp(dip,.018,relax),THREE.MathUtils.lerp(lean,.028,relax),relax,step);
    }
  }
  function resetPose(){
    state.rackPose=null;state.isThrowing=false;state.released=false;state.throwTime=0;
    state.ballCenter=null;
  }

  function restoreRestPose(){
    for(const bn in state.bones){
      if(state.restLocal[bn]) state.bones[bn].quaternion.copy(state.restLocal[bn]);
    }
  }

  function applyDance(dn){
    const w = Math.max(0, Math.min(1, dn.w == null ? 1 : dn.w));
    if(w <= 0 || !dn.q || !state.root) return;
    state.root.updateMatrixWorld(true);
    state.root.getWorldQuaternion(_qWorld);
    for(let i = 0; i < DANCE_BONES.length; i++){
      const n = DANCE_BONES[i], bone = state.bones[n], rw = state.restWorld[n];
      if(!bone || !rw || !bone.parent) continue;
      _dq.set(dn.q[i*4], dn.q[i*4+1], dn.q[i*4+2], dn.q[i*4+3]).multiply(rw).premultiply(_qWorld);
      const targetQ = w < 1 ? bone.getWorldQuaternion(_dc).slerp(_dq, w) : _dq;
      bone.parent.getWorldQuaternion(_pq).invert();
      bone.quaternion.copy(_pq).multiply(targetQ);
      bone.updateMatrix();
      bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
    }
    state.root.position.set(0,dn.hy > 0.02 ? dn.hy * state.hipY * w * 0.35 : 0,0);
    state.root.updateMatrixWorld(true);
  }

  const _qChar = new THREE.Quaternion();
  const _qTmp = new THREE.Quaternion();
  const _eul2 = new THREE.Euler();
  const _qOff2 = new THREE.Quaternion();

  function setBoneCharDelta(bn, qCharDelta){
    const bone = state.bones[bn], rw = state.restWorld[bn];
    if(!bone || !rw || !bone.parent) return;
    // 在角色世界空间叠加旋转（避开 Mixamo 骨骼局部轴翻转/T-pose 轴向差异）
    _qTmp.copy(_qWorld).multiply(qCharDelta).multiply(rw);
    bone.parent.getWorldQuaternion(_pq).invert();
    bone.quaternion.copy(_pq).multiply(_qTmp);
    bone.updateMatrix();
    bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
  }

  function applyLimbMotion(guy){
    const B = state.bones;
    if(!B.RightArm || !B.LeftArm || !state.root) return;
    restoreRestPose();
    state.root.position.set(0,0,0);
    state.root.updateMatrixWorld(true);
    state.root.getWorldQuaternion(_qWorld);

    const lArmX = guy.arms && guy.arms[0] ? guy.arms[0].rotation.x : 0;
    const rArmX = guy.arms && guy.arms[1] ? guy.arms[1].rotation.x : 0;
    const lArmZ = guy.arms && guy.arms[0] ? guy.arms[0].rotation.z : 0;
    const rArmZ = guy.arms && guy.arms[1] ? guy.arms[1].rotation.z : 0;
    const lElbX = guy.elbows && guy.elbows[0] ? guy.elbows[0].rotation.x : 0;
    const rElbX = guy.elbows && guy.elbows[1] ? guy.elbows[1].rotation.x : 0;
    const lLegX = guy.legs && guy.legs[0] ? guy.legs[0].rotation.x : 0;
    const rLegX = guy.legs && guy.legs[1] ? guy.legs[1].rotation.x : 0;
    const lKneeX = guy.knees && guy.knees[0] ? guy.knees[0].rotation.x : 0;
    const rKneeX = guy.knees && guy.knees[1] ? guy.knees[1].rotation.x : 0;
    const torsoX = guy.torso ? guy.torso.rotation.x : 0;

    // 1. 躯干轻微前倾/后仰（角色空间 X 轴）
    _eul.set(torsoX * 0.6, 0, 0, "XYZ");
    setBoneCharDelta("Spine1", _qChar.setFromEuler(_eul));

    // 2. 手臂：先从 Mixamo T-pose 水平外展放回自然垂立（左臂绕 Z -1.22，右臂 +1.22），再叠加前后摆臂
    //    注意 AIBA 约定：arms[0].z < 0 为左臂向外张开，arms[1].z > 0 为右臂向外张开
    const lAbduct = -1.22 - lArmZ * 0.85;
    const rAbduct = 1.22 - rArmZ * 0.85;
    _eul.set(lArmX * 0.85, 0, 0, "XYZ");
    _eul2.set(0, 0, lAbduct, "XYZ");
    _qChar.setFromEuler(_eul).multiply(_qOff2.setFromEuler(_eul2));
    setBoneCharDelta("LeftArm", _qChar);

    // 3. 手肘：沿大臂同一平面继续屈肘（保证无论手臂举多高，肘部都朝解剖正确方向弯曲）
    _eul.set(lArmX * 0.85 + lElbX * 0.95 - 0.16, 0, 0, "XYZ");
    _eul2.set(0, 0, lAbduct, "XYZ");
    _qChar.setFromEuler(_eul).multiply(_qOff2.setFromEuler(_eul2));
    setBoneCharDelta("LeftForeArm", _qChar);

    _eul.set(rArmX * 0.85, 0, 0, "XYZ");
    _eul2.set(0, 0, rAbduct, "XYZ");
    _qChar.setFromEuler(_eul).multiply(_qOff2.setFromEuler(_eul2));
    setBoneCharDelta("RightArm", _qChar);

    _eul.set(rArmX * 0.85 + rElbX * 0.95 - 0.16, 0, 0, "XYZ");
    _eul2.set(0, 0, rAbduct, "XYZ");
    _qChar.setFromEuler(_eul).multiply(_qOff2.setFromEuler(_eul2));
    setBoneCharDelta("RightForeArm", _qChar);

    // 4. 腿部：角色空间 X 轴直接对应前后抬腿与屈膝
    const lk = Math.max(0, lKneeX) * 0.85;
    const rk = Math.max(0, rKneeX) * 0.85;
    _eul.set(lLegX * 0.85, 0, 0, "XYZ");
    setBoneCharDelta("LeftUpLeg", _qChar.setFromEuler(_eul));

    _eul.set(rLegX * 0.85, 0, 0, "XYZ");
    setBoneCharDelta("RightUpLeg", _qChar.setFromEuler(_eul));

    _eul.set(lLegX * 0.85 + lk, 0, 0, "XYZ");
    setBoneCharDelta("LeftLeg", _qChar.setFromEuler(_eul));

    _eul.set(rLegX * 0.85 + rk, 0, 0, "XYZ");
    setBoneCharDelta("RightLeg", _qChar.setFromEuler(_eul));

    // 双脚屈膝下蹲时重心微沉，避免踮脚悬空
    const minKnee = Math.min(lk, rk);
    state.root.position.y = minKnee > 0.05 ? -Math.sin(minKnee) * 0.18 : 0;
    state.root.updateMatrixWorld(true);
  }

  function update(dt){
    if(!state.ready){
      if(!state.loading) loadModel();
      return;
    }
    checkAttach();
    if(!state.attachedGuy || !state.attachedGuy.g || !state.attachedGuy.g.visible) return;

    hideVoxelMeshes(state.attachedGuy);

    const guy = state.attachedGuy;
    const dn = guy.pregameDance && guy.pregameDance.q ? guy.pregameDance : null;
    const dw = dn ? Math.max(0, Math.min(1, dn.w == null ? 1 : dn.w)) : 0;
    const gameState = (typeof G !== "undefined" && G && G.state) || "";
    const inShow = gameState === "pregame" || gameState === "wincine" || gameState === "victorycine";

    if(inShow && dn && dw > 0.001){
      state.ballCenter=null;
      if(dw<1)applyLimbMotion(guy);
      else restoreRestPose();
      applyDance(dn);
    }else if(inShow){
      state.ballCenter=null;
      applyLimbMotion(guy);
    }else if(state.rackPose){
      return;
    }else if(state.isThrowing){
      state.reactClip=null;
      poseThrow(dt);
    }else if(state.reactClip && global.AIBADance && AIBADance.ready && (!passerBall || !passerBall.visible)){
      /* 晴子站立在场边且当前未持球时，播放 standing_crowd(standing) 欢呼/点头/遗憾动作，绝不坐下或跳舞 */
      state.reactT += Math.min(0.05, Math.max(0, dt||0.016));
      if(state.reactT >= state.reactDur){
        state.reactClip = null;
        idleGrip();
      }else{
        const fadeIn = Math.min(1, state.reactT / 0.22);
        const fadeOut = Math.min(1, (state.reactDur - state.reactT) / 0.28);
        const w = Math.max(0, Math.min(fadeIn, fadeOut));
        const smp = AIBADance.sample(state.reactClip, state.reactT, false);
        idleGrip();
        if(smp && w > 0.005) applyDance({q:smp.q, hy:0, w});
      }
    }else{
      idleGrip();
    }

    const ball=typeof passerBall!=="undefined"?passerBall:null;
    if(ball?.parent&&ball.visible&&(!state.isThrowing||!state.released)){
      if(state.ballCenter){
        ball.position.copy(ball.parent.worldToLocal(_vMid.copy(state.ballCenter)));
      }else if(inShow&&state.chains.Right){
        const right=state.chains.Right.arm.tip,left=state.chains.Left?.arm.tip;
        right.getWorldPosition(_vMid);
        if(left)_vMid.lerp(left.getWorldPosition(v()),.5);
        ball.position.copy(ball.parent.worldToLocal(_vMid));
      }
    }
  }

  function react(mood){
    const D = global.AIBADance;
    if(!state.ready || state.isThrowing || state.rackPose || !D || !D.ready || typeof D.pickFor !== "function") return;
    const clip = D.pickFor({role:"standing_crowd", posture:"standing", mood:mood||"cheer", skinned:true, avoid:state.reactClip});
    if(!clip || !D.clips[clip]) return;
    state.reactClip = clip;
    state.reactT = 0;
    state.reactDur = Math.min(2.8, Math.max(1.2, D.clips[clip].dur || 2.0));
  }

  const api = Object.freeze({
    playThrow,
    markReleased,
    getReleaseDelay,
    getBallWorldPos,
    setRackPose,
    resetPose,
    react,
    update,
    get state(){ return state; }
  });

  global.AIBAPasserAvatar = api;

  if(typeof document !== "undefined"){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", loadModel);
    }else{
      loadModel();
    }
  }
})(window);
