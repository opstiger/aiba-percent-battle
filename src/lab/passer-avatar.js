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

  const state = {
    loading: false,
    ready: false,
    root: null,
    mesh: null,
    mixer: null,
    throwAction: null,
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
        const maxAniso = (typeof renderer !== "undefined" && renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy)
          ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
        gltf.scene.traverse(child=>{
          if(child.isSkinnedMesh && !mesh) mesh = child;
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

  function update(dt){
    if(!state.ready){
      if(!state.loading) loadModel();
      return;
    }
    checkAttach();
    if(!state.attachedGuy || !state.attachedGuy.g || !state.attachedGuy.g.visible) return;

    hideVoxelMeshes(state.attachedGuy);

    if(state.mixer){
      if(state.isThrowing){
        state.throwTime += dt;
        state.mixer.update(dt);
        if(state.throwTime >= state.throwDuration){
          state.isThrowing = false;
          state.released = false;
          state.throwAction.time = 0.033;
          state.mixer.update(0);
          state.throwAction.paused = true;
        }
      }else{
        const t = (typeof G !== "undefined" && G.tNow) || 0;
        const breath = Math.sin(t * 1.8) * 0.02;
        state.root.position.y = breath * 0.5;
      }
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
