/* ---------------- three.js setup ---------------- */
/* 手机上关 MSAA:方块风格本来就没有多少斜边,抗锯齿收益很小,但多重采样是实打实的
   填充率开销——体感模式还要和摄像头推理抢资源,这一项省得最划算。桌面端保持开启。 */
const AA_COARSE_POINTER=(()=>{
  try{
    if(typeof matchMedia!=="function")return false;
    return matchMedia("(pointer:coarse)").matches||Math.min(innerWidth,innerHeight)<700;
  }catch(e){return false;}
})();
const renderer=new THREE.WebGLRenderer({canvas:$("c"),antialias:!AA_COARSE_POINTER,powerPreference:"high-performance"});
renderer.setPixelRatio(1);
if(THREE.sRGBEncoding)renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x05060c);
scene.fog=new THREE.Fog(0x05060c,34,70);
const camera=new THREE.PerspectiveCamera(68,1,0.1,120);
scene.add(camera);
const indoorRoot=new THREE.Group();indoorRoot.name="indoorRoot";
const environmentRoot=new THREE.Group();environmentRoot.name="environmentRoot";
const weatherRoot=new THREE.Group();weatherRoot.name="weatherRoot";
scene.add(indoorRoot);scene.add(environmentRoot);scene.add(weatherRoot);
const rig={pos:V3(0,9,10),look:V3(0,2,-8)};
const camTarget={pos:V3(0,9,10),look:V3(0,2,-8)};
let camSnap=true;
let curSpotRing=null;
const RENDER_QUALITY=(()=>{
  const q=new URLSearchParams(location.search).get("quality")||"auto";
  const hasMatch=typeof matchMedia==="function";
  const coarse=!!(hasMatch&&matchMedia("(pointer:coarse)").matches);
  const reduced=!!(hasMatch&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  const mem=navigator.deviceMemory||4;
  const base=coarse?(mem>=6?1.24:1.12):1.48;
  const max=coarse?(mem>=6?1.42:1.28):1.8;
  const presets={
    low:{scale:.88,min:.78,max:.96,locked:true},
    hd:{scale:base,min:.9,max,locked:true},
    ultra:{scale:coarse?1.48:2,min:1,max:coarse?1.55:2,locked:true}
  };
  const preset=presets[q];
  if(preset)return {mode:q,scale:preset.scale,target:preset.scale,min:preset.min,max:preset.max,locked:preset.locked,low:0,high:0,fps:60,w:1,h:1};
  const start=reduced?Math.min(base,1.05):base;
  return {mode:"auto",scale:start,target:base,min:coarse?.86:.98,max,locked:false,low:0,high:0,fps:60,w:1,h:1};
})();
function renderQualityTarget(){
  let target=RENDER_QUALITY.target;
  if(VISION&&VISION.desired)target-=0.08;
  if(G&&(G.state==="menu"||G.state==="diff"))target-=0.06;
  return clamp(target,RENDER_QUALITY.min,RENDER_QUALITY.max);
}
let lastScanOverlay="";
function updateVisualOverlays(){
  const on=G&&(G.state==="menu"||G.state==="diff"||G.state==="nba-dna");
  const next=on?"menu":"off";
  if(next===lastScanOverlay)return;
  lastScanOverlay=next;
  if(on)document.documentElement.dataset.scanOverlay="menu";
  else delete document.documentElement.dataset.scanOverlay;
}
function applyRenderScale(force){
  const q=RENDER_QUALITY,w=q.w||innerWidth,h=q.h||innerHeight;
  const scale=clamp(q.scale,q.min,q.max);
  const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));
  if(!force&&renderer.domElement.width===rw&&renderer.domElement.height===rh)return;
  q.scale=scale;
  renderer.setSize(rw,rh,false);
  renderer.domElement.style.width=w+"px";renderer.domElement.style.height=h+"px";
  document.documentElement.dataset.renderCrisp=scale<1?"1":"0";
}
function updateRenderQuality(dt){
  const q=RENDER_QUALITY;
  if(q.locked||G.state==="menu"||G.state==="diff")return;
  const fps=1/Math.max(dt,0.001);
  q.fps=q.fps*0.92+fps*0.08;
  const active=G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="pregame";
  if(!active)return;
  const target=renderQualityTarget();
  if(q.fps<43){q.low+=dt;q.high=0;}else if(q.fps>56){q.high+=dt;q.low=0;}else{q.low=Math.max(0,q.low-dt*.5);q.high=Math.max(0,q.high-dt*.5);}
  if(q.low>1.25&&q.scale>q.min+.01){
    q.scale=Math.max(q.min,q.scale-0.08);q.low=0;applyRenderScale(true);
  }else if(q.high>4.5&&q.scale<target-.01){
    q.scale=Math.min(target,q.scale+0.06);q.high=0;applyRenderScale(true);
  }
}
function dampRig(dt,k){
  if(camSnap){rig.pos.copy(camTarget.pos);rig.look.copy(camTarget.look);camSnap=false;return;}
  const a=1-Math.exp(-(k||4.5)*dt);
  rig.pos.lerp(camTarget.pos,a);rig.look.lerp(camTarget.look,a);
}
/* 竖屏必须按 Hor+ 补偿视野。THREE 的 fov 是**垂直**视角，竖屏(aspect≈0.46)时
   垂直 68° 换算出的水平视角只剩 34.5°(横屏是 100°)——贴到面前的防守人会糊满
   半个屏幕，自己的手和球全被挤出画面。
   这里锁定水平视角 BASE_HFOV，竖屏时反解出需要的垂直 fov；横屏维持原来的 68°
   垂直视角不变(取 min，避免宽屏把画面拉得过广)。 */
const BASE_VFOV=68,MAX_VFOV=90,BASE_HFOV=2*Math.atan(Math.tan(BASE_VFOV/2*Math.PI/180)*(16/9))*180/Math.PI;
function fovForAspect(aspect){
  const wanted=2*Math.atan(Math.tan(BASE_HFOV/2*Math.PI/180)/Math.max(.2,aspect))*180/Math.PI;
  return Math.max(BASE_VFOV,Math.min(MAX_VFOV,wanted));
}
function resize(){
  const vv=window.visualViewport;
  const w=Math.max(1,Math.round(vv?vv.width:innerWidth));
  const h=Math.max(1,Math.round(vv?vv.height:innerHeight));
  document.documentElement.style.setProperty("--app-height",h+"px");
  RENDER_QUALITY.w=w;RENDER_QUALITY.h=h;applyRenderScale(true);
  camera.aspect=w/h;camera.fov=fovForAspect(camera.aspect);
  if(window.AIBACameraFov&&AIBACameraFov.apply)AIBACameraFov.apply();
  camera.updateProjectionMatrix();
}
let _resizeT=0;
function debouncedResize(){clearTimeout(_resizeT);_resizeT=setTimeout(resize,120);}
addEventListener("resize",debouncedResize);
if(window.visualViewport)visualViewport.addEventListener("resize",debouncedResize);
resize();

const ambient=new THREE.AmbientLight(0xffffff,0.32);scene.add(ambient);
const hemi=new THREE.HemisphereLight(0x99aaff,0x1a1410,0.34);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1cf,0.8);sun.position.set(7,16,8);scene.add(sun);
const spot=new THREE.SpotLight(0xffffff,1.0,60,0.7,0.5);spot.position.set(0,14,-4);
spot.target.position.set(0,0,-6);indoorRoot.add(spot);indoorRoot.add(spot.target);

window.AIBA.runtime.register("rendering:core",Object.freeze({
  renderer,scene,camera,indoorRoot,environmentRoot,weatherRoot,rig,camTarget,RENDER_QUALITY,
  ambient,hemi,sun,spot,renderQualityTarget,updateVisualOverlays,applyRenderScale,updateRenderQuality,dampRig,resize
}));
