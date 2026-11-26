/* The stage drives a single practice shot through the production pose and jump loop.
   Only the court, scoring and the flight display are supplied by this preview. */
const gameStorage = window.localStorage;
const localStorage = {getItem:key => key==="aiba_motion_v2"?null:gameStorage.getItem(key)};
const options = new URLSearchParams(location.search);
const playerId = options.get("player") === "star30" ? "star30" : "star1";
const star = AIBA_CONFIG.CLASSIC_LEGENDS.find(entry => entry.id === playerId);
const LEGENDS = AIBA_CONFIG.CLASSIC_LEGENDS;
const V3 = (x,y,z) => new THREE.Vector3(x,y,z);
const clamp = (v,a,b) => Math.max(a,Math.min(v,b));
const scene = new THREE.Scene();
const HOOP = V3(0,3.05,6.75);
const G = {state:"round", mode:"contest", practice:true, tNow:0, canShoot:true, charging:false, moving:false, myStar:star, power:0};
const P = {pos:V3(), face:0, jump:0, walking:false};
const IDEAL = 74;
const regularShot = {};
const curShot = () => regularShot;
const weatherAdjustedIdeal = () => IDEAL;
const playerChargeRate = () => AIBA_CONFIG.DIFFS.normal.fill * (AIBA_CONFIG.shotProfileFor(star).speed || 1);
const blip = () => {};
const doRelease = () => { G.charging = false; window.releaseShot(G.power, regularShot); };

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
scene.background = new THREE.Color(0x141a28);
scene.add(new THREE.HemisphereLight(0xffffff,0x334466,1.25));
const key = new THREE.DirectionalLight(0xffffff,1.15);
key.position.set(2.5,5,3.5);
scene.add(key);
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.8,48),
  new THREE.MeshStandardMaterial({color:0x59677d,roughness:.9})
);
floor.rotation.x = -Math.PI/2;
scene.add(floor);

let flyingBall;
function initShotPlayer(){
  document.body.appendChild(renderer.domElement);
  player = voxelGuy();
  applyStarStyle(player, star);
  scene.add(player.g);
  pBall = new THREE.Mesh(ballGeo,matBall);
  scene.add(pBall);
  flyingBall = new THREE.Mesh(ballGeo,matBall);
  flyingBall.visible = false;
  scene.add(flyingBall);
}
const releaseOrigin = V3(), launchVelocity = V3();
let flightStart = null;
window.releaseShot = () => {
  if(!AIBATripo.heldBallPosition(player, releaseOrigin)) {
    player.ballGrips[0].getWorldPosition(releaseOrigin);
  }
  flightStart = G.tNow;
  pBall.visible = false;
  const travel = 1.12;
  launchVelocity.copy(HOOP).sub(releaseOrigin).multiplyScalar(1/travel);
  launchVelocity.y += 4.9*travel;
  return true;
};

const camera = new THREE.PerspectiveCamera(36,1,.05,50);
let cameraPose = {yaw:Math.PI/2,pitch:.10,dist:4.5,ty:1.35,tz:.25};
let dryRun = false;
const nativeRender = renderer.render.bind(renderer);
renderer.render = (...args) => {
  if(dryRun)return;
  const restorePose = typeof curryPreviewPose!=="undefined" ? curryPreviewPose.draw(frame) : null;
  try {
    const restoreEdit = typeof gameJoints!=="undefined" ? gameJoints.draw(frame) : null;
    try { nativeRender(...args); }
    finally { if(restoreEdit)restoreEdit(); }
  } finally { if(restorePose)restorePose(); }
};
function drawStage(){
  const {yaw,pitch,dist,ty,tz} = cameraPose;
  camera.position.set(dist*Math.sin(yaw)*Math.cos(pitch), ty+dist*Math.sin(pitch), tz+dist*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(0,ty,tz);
  renderer.render(scene,camera);
}
function resizeStage(){
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect = innerWidth/Math.max(1,innerHeight);
  camera.updateProjectionMatrix();
  drawStage();
}
addEventListener("resize",resizeStage);
window.setCam = (yaw,pitch,dist,ty,tz) => {
  cameraPose = {yaw,pitch,dist,ty,tz};
  drawStage();
};
const canvas = renderer.domElement;
const sendCamera = () => {
  if(parent!==window) parent.postMessage({type:"cam",from:options.get("slot"),cam:cameraPose},location.origin);
};
let pointer = null;
canvas.addEventListener("pointerdown",e=>{
  pointer = {x:e.clientX,y:e.clientY};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup",()=>{pointer=null;});
canvas.addEventListener("pointercancel",()=>{pointer=null;});
canvas.addEventListener("pointermove",e=>{
  if(!pointer) return;
  cameraPose.yaw -= (e.clientX-pointer.x)*.008;
  cameraPose.pitch = clamp(cameraPose.pitch+(e.clientY-pointer.y)*.008,-.5,1.2);
  pointer = {x:e.clientX,y:e.clientY};
  drawStage();
  sendCamera();
});
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  cameraPose.dist = clamp(cameraPose.dist*(1+e.deltaY*.001),1.5,12);
  drawStage();
  sendCamera();
},{passive:false});

const BASE_KEYS = ["releaseArmAngle","releaseElbowFlex","kick","followHold","lean","turn"];
const SKIN_KEYS = ["ballAlong","ballLift","holdCurl","elbowOut","crouchExtra","landGain","landTau"];
const MODEL_STEP = 1/60;
const HOLD_TIME = .28, TOTAL = 2.6;
let defaults, params, frame = 0, target = 0, dirty = true;
function applyTunerParams(){
  for(const k of BASE_KEYS) player.shotStyle[k] = params[k];
  for(const k of SKIN_KEYS) AIBATripo[k] = params[k];
  // A zero setting drops the alternate kick clip entirely for this preview.
  const mode = params.kick === 0 ? "game" : "release-feet";
  if(AIBAShotAnimation.getMode() !== mode) AIBAShotAnimation.setMode(mode);
}
function rewindPreview(){
  // Consume any pending release and finish the old follow-through before restarting.
  G.charging = false;
  dryRun = true;
  try {
    for(let i=0;i<24;i++) updPose(.08);
  } finally {
    dryRun = false;
  }
  AIBAShotPhysics.reset();
  AIBAShotMotion.resetShotCycle();
  poseK = landT = 0;
  const skin = window.AIBATripo;
  Object.assign(skin,{tA:0,holdW:1,armHold:1,guideOff:null,airPrev:0,airVel:0,landT:null,landV:0,oursG:null,airTop:0});
  Object.assign(G,{tNow:0,canShoot:true,charging:false,power:0,apexed:false});
  P.jump = 0;
  pBall.visible = true;
  flyingBall.visible = false;
  flightStart = null;
  frame = 0;
  applyTunerParams();
  updPose(0);
}
function advancePreview(){
  G.tNow = ++frame * MODEL_STEP;
  if(G.tNow >= HOLD_TIME && G.canShoot) G.charging = true;
  if(G.charging){
    if(G.power >= IDEAL*params.releasePower/100) doRelease();
    else G.power += playerChargeRate()*MODEL_STEP;
  }
  updPose(MODEL_STEP);
  if(flightStart !== null){
    const t = G.tNow - flightStart;
    flyingBall.position.copy(releaseOrigin).addScaledVector(launchVelocity,t);
    flyingBall.position.y -= 4.9*t*t;
    flyingBall.visible = flyingBall.position.y>.14 && t<1.25;
  }
}
function renderPreview(){
  const frameTarget = Math.round(target*TOTAL/MODEL_STEP);
  if(dirty || frameTarget < frame){ rewindPreview(); dirty = false; }
  dryRun = true;
  try {
    while(frame < frameTarget){ advancePreview(); drawStage(); }
  } finally {
    dryRun = false;
  }
  const s = AIBAMotion.stats();
  const phase = G.charging ? (P.jump>.02?"举球起跳":"蓄力") : s.pendingRelease ? "推球离手" :
    P.jump>.002 ? "空中随挥" : s.followActive ? "落地收手" : flightStart!==null ? "恢复站姿" : "持球";
  Shot.last = {s:{phase,jumpY:Math.max(0,P.jump),snap:flightStart===null?0:clamp((G.tNow-flightStart)/.10,0,1)}};
  drawStage();
}
const Shot = window.Shot = {
  style:playerId, PROFILES:{},
  setNormT(t){ target=clamp(t,0,1); if(window.__ready)renderPreview(); },
  updateParam(key,value){ params[key]=value; dirty=true; },
  resetParams(){ Object.assign(params,defaults); dirty=true; }
};
function startShotTuner(){
  resizeStage();
  function load(){
    if(AIBATripo.failed) {
      document.body.textContent = "球员模型加载失败";
      parent.postMessage({type:"shotError",from:options.get("slot")},location.origin);
      return;
    }
    if(!AIBATripo.ready){ drawStage(); requestAnimationFrame(load); return; }
    defaults = {releasePower:100};
    for(const k of BASE_KEYS) defaults[k] = player.shotStyle[k];
    for(const k of SKIN_KEYS) defaults[k] = AIBATripo[k];
    params = Shot.PROFILES[playerId] = {...defaults};
    window.__ready = true;
    renderPreview();
  }
  load();
}
