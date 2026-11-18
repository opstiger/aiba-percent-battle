/* ---------------- 3D 传球员 (赤木晴子) ----------------
   将传球员从原先的方块人替换为写实/动漫 3D 模型 (assets/models/passer_qingzi.glb)。
   Mixamo 65 根骨骼绑骨，身穿湘北 10 号球衣与 Jordan 1 芝加哥球鞋，自带双手大力传球动画。
   - 待机时：双手置于胸腹前托球，呼吸微动。
   - 传球时：执行 Mixamo Throw 动作双手推球送出，与篮球飞行物理完全对齐。
   - 投完球后：平滑回到待机接球姿态。
   - 自动隐藏 passer.g 原先的方块体网格。
*/
(function(global){
  "use strict";

  const MODEL_URL = "assets/models/passer_qingzi.glb";
  const LOADER_URL = "vendor/GLTFLoader.r128.js";

  const THROW_START_TIME = 0.20;
  const THROW_RELEASE_TIME = 0.765;
  const THROW_TIME_SCALE = 2.0;

  const DANCE_BONES=["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"];

  const state = {
    loading: false,
    ready: false,
    root: null,
    mesh: null,
    mixer: null,
    throwAction: null,
    bones: {},
    restLocal: {},
    restWorld: {},
    hipY: 0.95,
    rHand: null,
    rPalm: null,
    lHand: null,
    isThrowing: false,
    released: false,
    throwTime: 0,
    throwDuration: 0,
    releaseDelay: (THROW_RELEASE_TIME - THROW_START_TIME) / THROW_TIME_SCALE,
    attachedGuy: null
  };

  const _vR = new THREE.Vector3();
  const _vL = new THREE.Vector3();
  const _vMid = new THREE.Vector3();
  const _vFwd = new THREE.Vector3();
  const _qWorld = new THREE.Quaternion();
  const _dq = new THREE.Quaternion();
  const _dc = new THREE.Quaternion();
  const _pq = new THREE.Quaternion();
  const _eul = new THREE.Euler();
  const _qOff = new THREE.Quaternion();

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

        let rHand = gltf.scene.getObjectByName("mixamorigRightHand") || gltf.scene.getObjectByName("mixamorig:RightHand");
        let rPalm = gltf.scene.getObjectByName("mixamorigRightHandMiddle1") || gltf.scene.getObjectByName("mixamorig:RightHandMiddle1");
        let lHand = gltf.scene.getObjectByName("mixamorigLeftHand") || gltf.scene.getObjectByName("mixamorig:LeftHand");
        if(!rHand || !lHand || !rPalm){
          gltf.scene.traverse(c=>{
            if(!rHand && /RightHand$/.test(c.name)) rHand = c;
            if(!rPalm && /RightHandMiddle1$/.test(c.name)) rPalm = c;
            if(!lHand && /LeftHand$/.test(c.name)) lHand = c;
          });
        }

        let mixer = null;
        let throwAction = null;
        let dur = 1.4;
        if(gltf.animations && gltf.animations.length > 0){
          mixer = new THREE.AnimationMixer(gltf.scene);
          throwAction = mixer.clipAction(gltf.animations[0]);
          throwAction.loop = THREE.LoopOnce;
          throwAction.clampWhenFinished = true;
          throwAction.timeScale = THROW_TIME_SCALE;
          dur = Math.max(0.2, (gltf.animations[0].duration - THROW_START_TIME) / THROW_TIME_SCALE);
          // 初始停在第 1 帧持球预备姿态
          throwAction.play();
          mixer.update(0.033);
          throwAction.paused = true;
        }

        state.root = root;
        state.mesh = mesh;
        state.mixer = mixer;
        state.throwAction = throwAction;
        state.rHand = rHand;
        state.rPalm = rPalm || rHand;
        state.lHand = lHand;
        state.throwDuration = dur;
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
      hideVoxelMeshes(guy);
    }
  }

  const _vPalm = new THREE.Vector3();
  const _vRight = new THREE.Vector3();

  function getBallWorldPos(out){
    if(!state.ready || !state.root || !state.rHand || !state.lHand) return null;
    state.root.updateMatrixWorld(true);
    state.rHand.getWorldPosition(_vR);
    state.lHand.getWorldPosition(_vL);
    const target = out || new THREE.Vector3();
    target.addVectors(_vR, _vL).multiplyScalar(0.5);
    state.root.getWorldQuaternion(_qWorld);
    _vFwd.set(0, 0.02, 0.07).applyQuaternion(_qWorld);
    target.add(_vFwd);

    if(state.isThrowing){
      const blend = Math.min(1, Math.max(0, state.throwTime / 0.12));
      if(state.rPalm){
        state.rPalm.getWorldPosition(_vPalm);
        _vRight.addVectors(_vR, _vPalm).multiplyScalar(0.5);
      }else{
        _vRight.copy(_vR);
      }
      _vFwd.set(0, 0.04, 0.09).applyQuaternion(_qWorld);
      _vRight.add(_vFwd);
      target.lerp(_vRight, blend);
    }
    return target;
  }

  function playThrow(){
    if(!state.ready || !state.throwAction) return;
    state.isThrowing = true;
    state.released = false;
    state.throwTime = 0;
    state.throwAction.reset();
    state.throwAction.time = THROW_START_TIME;
    state.throwAction.timeScale = THROW_TIME_SCALE;
    state.throwAction.paused = false;
    state.throwAction.play();
    if(state.mixer){
      state.mixer.update(0);
      if(state.root) state.root.updateMatrixWorld(true);
    }
  }

  function markReleased(){
    state.released = true;
  }

  function getReleaseDelay(){
    return state.ready && state.throwAction ? state.releaseDelay : 0;
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
    for(let i = 0; i < DANCE_BONES.length; i++){
      const n = DANCE_BONES[i], bone = state.bones[n], rw = state.restWorld[n];
      if(!bone || !rw || !bone.parent) continue;
      _dq.set(dn.q[i*4], dn.q[i*4+1], dn.q[i*4+2], dn.q[i*4+3]).multiply(rw);
      const targetQ = w < 1 ? bone.getWorldQuaternion(_dc).slerp(_dq, w) : _dq;
      bone.parent.getWorldQuaternion(_pq).invert();
      bone.quaternion.copy(_pq).multiply(targetQ);
      bone.updateMatrix();
      bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
    }
    state.root.position.y = dn.hy > 0.02 ? dn.hy * state.hipY * w * 0.35 : 0;
    state.root.updateMatrixWorld(true);
  }

  function applyLimbMotion(guy){
    const B = state.bones, RL = state.restLocal;
    if(!B.RightArm || !B.LeftArm) return;
    restoreRestPose();
    const rotBone = (bn, rx, ry, rz)=>{
      const b = B[bn], r0 = RL[bn];
      if(!b || !r0) return;
      _eul.set(rx || 0, ry || 0, rz || 0, "XYZ");
      _qOff.setFromEuler(_eul);
      b.quaternion.copy(r0).multiply(_qOff);
    };
    const lArmX = guy.arms && guy.arms[0] ? guy.arms[0].rotation.x : 0;
    const rArmX = guy.arms && guy.arms[1] ? guy.arms[1].rotation.x : 0;
    const lElbX = guy.elbows && guy.elbows[0] ? guy.elbows[0].rotation.x : 0;
    const rElbX = guy.elbows && guy.elbows[1] ? guy.elbows[1].rotation.x : 0;
    const lLegX = guy.legs && guy.legs[0] ? guy.legs[0].rotation.x : 0;
    const rLegX = guy.legs && guy.legs[1] ? guy.legs[1].rotation.x : 0;
    const lKneeX = guy.knees && guy.knees[0] ? guy.knees[0].rotation.x : 0;
    const rKneeX = guy.knees && guy.knees[1] ? guy.knees[1].rotation.x : 0;
    const torsoX = guy.torso ? guy.torso.rotation.x : 0;
    // Mixamo T-pose 手臂水平外展，从初始抱球姿叠加动作增量
    rotBone("Spine1", torsoX * 0.5, 0, 0);
    rotBone("LeftArm", (lArmX + 0.5) * 0.85, 0, 0);
    rotBone("RightArm", (rArmX + 0.5) * 0.85, 0, 0);
    rotBone("LeftForeArm", lElbX * 0.55, 0, 0);
    rotBone("RightForeArm", rElbX * 0.55, 0, 0);
    rotBone("LeftUpLeg", -lLegX * 0.85, 0, 0);
    rotBone("RightUpLeg", -rLegX * 0.85, 0, 0);
    rotBone("LeftLeg", Math.max(0, lKneeX) * 0.85, 0, 0);
    rotBone("RightLeg", Math.max(0, rKneeX) * 0.85, 0, 0);
    state.root.position.y = 0;
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

    if(dn && dw > 0.001){
      applyDance(dn);
    }else if(state.isThrowing && state.mixer){
      state.throwTime += dt;
      state.mixer.update(dt);
      if(state.throwTime >= state.throwDuration){
        state.isThrowing = false;
        state.released = false;
        state.throwAction.time = 0.033;
        state.mixer.update(0);
        state.throwAction.paused = true;
      }
    }else if(inShow){
      applyLimbMotion(guy);
    }else if(state.mixer){
      state.throwAction.time = 0.033;
      state.mixer.update(0);
      state.throwAction.paused = true;
      const t = (typeof G !== "undefined" && G.tNow) || 0;
      const breath = Math.sin(t * 1.8) * 0.02;
      state.root.position.y = breath * 0.5;
    }

    // 手部持球点对齐（待机及推球蓄力出手前，球始终紧贴双手掌心）
    const ball = typeof passerBall !== "undefined" ? passerBall : null;
    if(ball && (!state.isThrowing || !state.released)){
      if(state.rHand && state.lHand && ball.parent && getBallWorldPos(_vMid)){
        ball.parent.updateMatrixWorld(true);
        ball.parent.worldToLocal(_vMid);
        ball.position.copy(_vMid);
        ball.updateMatrixWorld(true);
      }
    }
  }

  const api = Object.freeze({
    playThrow,
    markReleased,
    getReleaseDelay,
    getBallWorldPos,
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
