/* ---------------- vision-shot experimental controller ---------------- */
const VISION={
  supported:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),desired:false,enabled:false,loading:false,liveControl:true,
  stream:null,landmarker:null,handLandmarker:null,lastPose:null,lastHands:[],lastPoseAt:0,lastHandAt:0,lastDraw:0,lastVideoTime:-1,raf:0,ownsCharge:false,lastSample:null,inferAvg:0,
  machine:{phase:"align",holdStart:0,chargeStart:0,lastSeen:0,cooldownUntil:0,releaseFlashUntil:0},
  readyArea:{x:.5,bottom:1,w:.88,h:.35},releaseLineY:.32,
  connections:[[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[12,14],[14,16],[16,18],[16,20],[16,22],[11,23],[12,24],[23,24]],
  handConnections:[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
};
function visionGameActive(){return (G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush")&&G.canShoot&&!G.cutAway&&!G.battleCut;}
function resetVisionGesture(sm){sm.phase="align";sm.holdStart=0;sm.chargeStart=0;sm.lastSeen=0;sm.cooldownUntil=0;sm.releaseFlashUntil=0;}
function visionGestureStep(sm,sample,now){
  const event={type:"none",phase:sm.phase,progress:0};
  if(sample.valid)sm.lastSeen=now;
  if(sm.phase==="cooldown"){
    if(now<sm.releaseFlashUntil){event.phase="release";event.progress=1;return event;}
    if(now>=sm.cooldownUntil&&!sample.ready){sm.phase="align";}
    event.phase=sm.phase;return event;
  }
  if(!sample.valid){
    if(sm.phase==="charging"&&now-sm.lastSeen>420){sm.phase="align";event.type="cancel";}
    else if(sm.phase==="hold"){sm.phase="align";sm.holdStart=0;}
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="align"){
    if(sample.ready){sm.phase="hold";sm.holdStart=now;}
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="hold"){
    if(!sample.ready){sm.phase="align";sm.holdStart=0;event.phase=sm.phase;return event;}
    event.progress=clamp((now-sm.holdStart)/300,0,1);
    if(now-sm.holdStart>=300){sm.phase="charging";sm.chargeStart=now;event.type="charge";event.progress=0;}
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="charging"){
    event.progress=clamp((now-sm.chargeStart)/900,0,1);
    if(sample.release){sm.phase="cooldown";sm.cooldownUntil=now+760;sm.releaseFlashUntil=now+260;event.type="release";event.phase="release";event.progress=1;return event;}
    if(now-sm.chargeStart>2300){sm.phase="align";event.type="cancel";event.phase=sm.phase;event.progress=0;}
  }
  return event;
}
function visionConfidence(p){return p?(p.visibility==null?(p.presence==null?1:p.presence):p.visibility):0;}
function visionReadyAreaBounds(area,boost){
  const grow=boost||0,bottom=area.bottom==null?area.y+area.h*.5:area.bottom;
  return {
    left:area.x-area.w*.5-grow,
    right:area.x+area.w*.5+grow,
    top:bottom-area.h-grow*.75,
    bottom:Math.min(1,bottom)
  };
}
function visionPointInReadyArea(p,area,boost){
  if(!p)return false;
  const b=visionReadyAreaBounds(area,boost);
  return p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;
}
function visionPalm(hand){
  const ids=[0,5,9,13,17],valid=ids.map(i=>hand&&hand[i]).filter(Boolean);if(!valid.length)return null;
  return valid.reduce((p,v)=>({x:p.x+v.x/valid.length,y:p.y+v.y/valid.length}),{x:0,y:0});
}
function visionHandLead(hand){
  const tips=[8,12,16,20,4].map(i=>hand&&hand[i]).filter(Boolean);
  return tips.length?tips.reduce((top,p)=>p.y<top.y?p:top):visionPalm(hand);
}
function visionLandmarkSample(lm,handLandmarks,now){
  const poseFresh=now-(VISION.lastPoseAt||0)<450;
  const handFresh=now-(VISION.lastHandAt||0)<(VISION.machine.phase==="charging"?240:460);
  const poseNeeded=[0,11,12,15,16],poseValid=poseFresh&&!!lm&&!poseNeeded.some(i=>!lm[i])&&Math.min(...poseNeeded.map(i=>visionConfidence(lm[i])))>=.4;
  const hands=(handFresh?(handLandmarks||[]):[]).filter(hand=>hand&&hand.length>=21).slice(0,2);
  const palms=hands.map(visionPalm).filter(Boolean);
  const poseWrists=poseValid?[lm[15],lm[16]]:[];
  const readyPoints=palms.length>=2?palms:poseWrists;
  const releasePoints=[...hands.map(visionHandLead).filter(Boolean),...poseWrists];
  const holdBoost=VISION.machine.phase==="hold"?.035:0;
  const ready=readyPoints.length>=2&&readyPoints.slice(0,2).every(p=>visionPointInReadyArea(p,VISION.readyArea,holdBoost));
  const release=releasePoints.some(p=>p&&p.y<=VISION.releaseLineY);
  const sample={valid:poseValid||palms.length>0,ready,release,handCount:hands.length,palms,readyPoints,releasePoints,now};
  VISION.lastSample=sample;return sample;
}
function visionSetUI(phase,label,progress){
  const wrap=$("visionPreview"),state=$("visionState"),fill=$("visionTrackFill");if(!wrap)return;
  wrap.dataset.phase=phase;wrap.dataset.context=(G.state==="menu"||G.state==="diff")?"setup":"game";
  if(state)state.textContent=label;if(fill)fill.style.height=(clamp(progress||0,0,1)*100)+"%";
}
function visionPhaseLabel(step,sample){
  if(step.phase==="hold")return"双手锁定 "+Math.round(step.progress*100)+"%";
  if(step.phase==="charging"){
    const blind=VISION.liveControl&&typeof curShot==="function"&&barHiddenFor(curShot());
    return blind?"任一手越过上方出手线":"蓄力 · "+Math.round((VISION.liveControl&&G.charging?G.power:step.progress*100))+"%";
  }
  if(step.phase==="release")return"越线触发 · 出手";
  if(step.phase==="cooldown")return"动作复位";
  if(sample&&sample.handCount>0)return"双手放入下方蓄力框";
  return"双手放入下方蓄力框";
}
function visionRoundedRect(g,x,y,w,h,r){
  g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);
  g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);
}
function drawVisionReadyArea(g,area,w,h,color,active){
  const b=visionReadyAreaBounds(area,0),line=Math.max(2,w/280);
  const x=b.left*w+line*.5,y=b.top*h+line*.5,rw=(b.right-b.left)*w-line,rh=(b.bottom-b.top)*h-line,r=Math.min(rh*.18,14);
  g.save();g.globalAlpha=active?.12:.04;g.fillStyle=color;visionRoundedRect(g,x,y,rw,rh,r);g.fill();
  g.globalAlpha=active?.92:.45;g.strokeStyle=color;g.lineWidth=line;g.setLineDash(active?[]:[10,8]);visionRoundedRect(g,x,y,rw,rh,r);g.stroke();
  g.restore();
}
function drawVisionReleaseLine(g,lineY,w,h,active){
  const y=lineY*h;
  g.save();g.fillStyle="#ffffff";g.globalAlpha=active?.14:.06;g.fillRect(0,0,w,y);
  g.strokeStyle="#ffffff";g.globalAlpha=active?.96:.62;g.lineWidth=Math.max(2,w/260);g.setLineDash(active?[]:[10,8]);
  g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();g.restore();
}
function drawVisionPose(lm,handLandmarks,sample,phase){
  const cv=$("visionCanvas"),video=$("visionVideo");if(!cv||!video)return;
  const w=video.videoWidth||640,h=video.videoHeight||480;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const g=cv.getContext("2d");g.clearRect(0,0,w,h);if(video.readyState>=2){g.filter="saturate(.72) contrast(1.08) brightness(.78)";g.drawImage(video,0,0,w,h);g.filter="none";}
  drawVisionReleaseLine(g,VISION.releaseLineY,w,h,phase==="charging"||phase==="release");
  drawVisionReadyArea(g,VISION.readyArea,w,h,"#70e8ff",phase==="hold");
  const color=phase==="charging"?"#7CFC6B":(phase==="hold"?"#ffd23f":"#70e8ff");
  g.lineWidth=Math.max(2,w/260);g.strokeStyle=color;g.fillStyle=color;g.globalAlpha=.92;
  if(lm){
    for(const c of VISION.connections){const a=lm[c[0]],b=lm[c[1]];if(!a||!b||visionConfidence(a)<.35||visionConfidence(b)<.35)continue;g.beginPath();g.moveTo(a.x*w,a.y*h);g.lineTo(b.x*w,b.y*h);g.stroke();}
    for(const i of [0,11,12,13,14,15,16,17,18,19,20,21,22]){const p=lm[i];if(!p||visionConfidence(p)<.35)continue;g.beginPath();g.arc(p.x*w,p.y*h,i===15||i===16?5:3,0,Math.PI*2);g.fill();}
  }
  for(const hand of handLandmarks||[]){
    g.strokeStyle="#ffd23f";g.fillStyle="#fff2a3";g.lineWidth=Math.max(2,w/300);g.globalAlpha=.96;
    for(const c of VISION.handConnections){const a=hand[c[0]],b=hand[c[1]];if(!a||!b)continue;g.beginPath();g.moveTo(a.x*w,a.y*h);g.lineTo(b.x*w,b.y*h);g.stroke();}
    for(let i=0;i<hand.length;i++){const p=hand[i],tip=i===4||i===8||i===12||i===16||i===20;g.beginPath();g.arc(p.x*w,p.y*h,tip?4.2:2.4,0,Math.PI*2);g.fill();}
  }
  g.globalAlpha=1;
}
async function loadVisionModel(){
  if(VISION.landmarker&&VISION.handLandmarker)return VISION.landmarker;
  const mp=await import("../vendor/mediapipe/vision_bundle.mjs");
  const files=await mp.FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
  const options={baseOptions:{modelAssetPath:"./assets/aiba-vision/pose_landmarker_lite.task",delegate:"GPU"},runningMode:"VIDEO",numPoses:1,
    minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55,outputSegmentationMasks:false};
  if(!VISION.landmarker){
    try{VISION.landmarker=await mp.PoseLandmarker.createFromOptions(files,options);}
    catch(e){options.baseOptions.delegate="CPU";VISION.landmarker=await mp.PoseLandmarker.createFromOptions(files,options);}
  }
  if(!VISION.handLandmarker){
    const handOptions={baseOptions:{modelAssetPath:"./assets/aiba-vision/hand_landmarker.task",delegate:"CPU"},runningMode:"VIDEO",numHands:2,
      minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.45};
    try{VISION.handLandmarker=await mp.HandLandmarker.createFromOptions(files,handOptions);}
    catch(e){handOptions.baseOptions.delegate="GPU";VISION.handLandmarker=await mp.HandLandmarker.createFromOptions(files,handOptions);}
  }
  return VISION.landmarker;
}
function cancelVisionOwnedCharge(){
  if(!VISION.ownsCharge)return;VISION.ownsCharge=false;
  if(G.charging){G.charging=false;G.power=0;const fill=$("pFill");if(fill)fill.style.height="0%";}
}
function handleVisionGesture(step){
  if(!VISION.liveControl||!visionGameActive())return;
  if(step.type==="charge"){
    VISION.ownsCharge=!!startCharge();
    if(!VISION.ownsCharge)resetVisionGesture(VISION.machine);
  }else if(step.type==="release"&&VISION.ownsCharge){VISION.ownsCharge=false;doRelease();}
  else if(step.type==="cancel")cancelVisionOwnedCharge();
}
function visionCadence(){
  const phase=VISION.machine.phase,setup=G.state==="menu"||G.state==="diff",active=visionGameActive();
  const penalty=VISION.inferAvg>34?1.5:(VISION.inferAvg>23?1.25:1);
  let drawMs,poseMs,handMs,mode;
  if(active&&(phase==="charging"||phase==="hold")){
    drawMs=66;poseMs=phase==="charging"?150:105;handMs=phase==="charging"?66:85;mode="gesture";
  }else if(active){
    drawMs=82;poseMs=82;handMs=180;mode="ready";
  }else if(setup){
    drawMs=100;poseMs=125;handMs=200;mode="setup";
  }else{
    drawMs=125;poseMs=300;handMs=Infinity;mode="idle";
  }
  return {drawMs:drawMs*(penalty>1?1.15:1),poseMs:poseMs*penalty,handMs:Number.isFinite(handMs)?handMs*penalty:Infinity,mode};
}
function visionDetectTask(now,c){
  const poseAge=now-(VISION.lastPoseAt||0),handAge=now-(VISION.lastHandAt||0);
  const poseDue=poseAge>=c.poseMs,handDue=Number.isFinite(c.handMs)&&handAge>=c.handMs;
  if(poseDue&&handDue){
    const gesture=c.mode==="gesture";
    if(gesture)return poseAge>=c.poseMs*1.35?"pose":"hand";
    return handAge>=c.handMs*1.35?"hand":"pose";
  }
  return handDue?"hand":(poseDue?"pose":null);
}
function noteVisionInference(start){
  const cost=performance.now()-start;
  VISION.inferAvg=VISION.inferAvg?VISION.inferAvg*.82+cost*.18:cost;
  document.documentElement.dataset.visionInferenceMs=VISION.inferAvg.toFixed(1);
}
function visionFrame(now){
  if(!VISION.desired)return;VISION.raf=requestAnimationFrame(visionFrame);
  if(!VISION.enabled||!VISION.landmarker)return;
  const video=$("visionVideo");if(!video||video.readyState<2||video.currentTime===VISION.lastVideoTime)return;
  const cadence=visionCadence();if(now-VISION.lastDraw<cadence.drawMs)return;
  VISION.lastDraw=now;VISION.lastVideoTime=video.currentTime;
  const task=visionDetectTask(now,cadence),started=performance.now();
  try{
    if(task==="pose"){
      const result=VISION.landmarker.detectForVideo(video,now);VISION.lastPose=result&&result.landmarks&&result.landmarks[0]?result.landmarks[0]:null;VISION.lastPoseAt=now;
    }else if(task==="hand"&&VISION.handLandmarker){
      const handResult=VISION.handLandmarker.detectForVideo(video,now);VISION.lastHands=handResult&&handResult.landmarks?handResult.landmarks.slice(0,2):[];VISION.lastHandAt=now;
    }
    if(task)noteVisionInference(started);
  }
  catch(e){visionSetUI("error","识别暂时中断",0);return;}
  const sample=visionLandmarkSample(VISION.lastPose,VISION.lastHands,now);
  const canAdvance=G.state==="diff"||G.state==="menu"||visionGameActive();
  if(!canAdvance){resetVisionGesture(VISION.machine);cancelVisionOwnedCharge();}
  const step=canAdvance?visionGestureStep(VISION.machine,sample,now):{type:"none",phase:"align",progress:0};
  handleVisionGesture(step);
  const drawPose=now-(VISION.lastPoseAt||0)<500?VISION.lastPose:null;
  const drawHands=now-(VISION.lastHandAt||0)<500?VISION.lastHands:[];
  drawVisionPose(drawPose,drawHands,sample,step.phase);
  const blindCharge=step.phase==="charging"&&VISION.liveControl&&typeof curShot==="function"&&barHiddenFor(curShot());
  visionSetUI(step.phase,visionPhaseLabel(step,sample),blindCharge?0:step.progress);
  if(visionGameActive()){
    const hint=$("hint");
    if(hint)hint.textContent=step.phase==="hold"?"双手保持在下方蓄力框":(step.phase==="charging"?"任一只手越过上方出手线":(step.phase==="release"?"出手!":"双手进入下方蓄力框 0.3 秒"));
  }
  document.documentElement.dataset.visionPhase=step.phase;
  document.documentElement.dataset.visionReady=sample.ready?"1":"0";
  document.documentElement.dataset.visionHands=String(sample.handCount||0);
  document.documentElement.dataset.visionCadence=cadence.mode;
}
async function enableVisionControl(event){
  if(event){event.stopPropagation();event.preventDefault();}
  if(!VISION.supported){toast("此浏览器不支持摄像头控制","#ff8d7a");return;}
  if(VISION.loading||VISION.enabled)return;
  VISION.desired=true;VISION.loading=true;$("visionPreview").style.display="block";visionSetUI("align","正在启动本地识别",.08);
  try{
    const modelPromise=loadVisionModel();
    const streamPromise=navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}});
    const results=await Promise.all([modelPromise,streamPromise]);VISION.stream=results[1];
    const video=$("visionVideo");video.srcObject=VISION.stream;await video.play();
    VISION.enabled=true;VISION.lastSample=null;VISION.lastPose=null;VISION.lastHands=[];VISION.lastPoseAt=0;VISION.lastHandAt=0;VISION.lastDraw=0;VISION.inferAvg=0;resetVisionGesture(VISION.machine);visionSetUI("align","双手放入下方蓄力框",0);
    cancelAnimationFrame(VISION.raf);VISION.raf=requestAnimationFrame(visionFrame);
    document.documentElement.dataset.visionControl="ready";
    if(G.state==="diff")goDiff(G.mode,true);
  }catch(e){
    VISION.desired=false;VISION.enabled=false;if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());VISION.stream=null;
    $("visionPreview").style.display="block";visionSetUI("error",e&&e.name==="NotAllowedError"?"摄像头权限未开启":"视觉识别启动失败",0);
    document.documentElement.dataset.visionControl="error";toast("视觉投篮未启动 · 已保留触屏控制","#ff8d7a");
  }finally{VISION.loading=false;}
}
function disableVisionControl(event){
  if(event){event.stopPropagation();event.preventDefault();}
  VISION.desired=false;VISION.enabled=false;VISION.loading=false;cancelAnimationFrame(VISION.raf);cancelVisionOwnedCharge();
  if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());VISION.stream=null;const video=$("visionVideo");if(video)video.srcObject=null;
  resetVisionGesture(VISION.machine);VISION.lastSample=null;VISION.lastPose=null;VISION.lastHands=[];VISION.lastPoseAt=0;VISION.lastHandAt=0;VISION.lastDraw=0;VISION.inferAvg=0;$("visionPreview").style.display="none";
  document.documentElement.dataset.visionControl="off";delete document.documentElement.dataset.visionPhase;delete document.documentElement.dataset.visionReady;delete document.documentElement.dataset.visionHands;
  if(G.state==="diff")goDiff(G.mode,true);
}
function visionModeMarkup(){
  const active=VISION.desired||VISION.enabled;
  return `<div class="visionMode"><span class="visionModeLabel"><small>SHOT CONTROL</small><b>投篮控制</b></span>
    <button class="${active?"":"active"}" onclick="disableVisionControl(event)">触屏</button>
    <button class="${active?"active":""}" onclick="enableVisionControl(event)" ${VISION.supported?"":"disabled"}>视觉实验</button></div>`;
}
addEventListener("pagehide",()=>{if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());});
