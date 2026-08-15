/* ---------------- motion-shot controller ---------------- */
const VISION_CONTROL_STORAGE="aiba_shot_control_v1";
const VISION_INFERENCE_MAX_PIXELS=288*512;
function visionPointerCoarse(){
  try{return matchMedia("(pointer:coarse)").matches;}catch(e){return false;}
}
function visionMobileDevice(){
  let mobileUA=false;
  try{mobileUA=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");}catch(e){}
  return visionPointerCoarse()||mobileUA;
}
function visionWantsPortrait(){return visionMobileDevice()&&innerHeight>=innerWidth;}
function visionCaptureConstraints(){
  return {facingMode:{ideal:"user"},width:{ideal:480,max:640},height:{ideal:360,max:480},resizeMode:{ideal:"none"},frameRate:{ideal:18,max:24}};
}
function visionRecordCaptureSettings(stream){
  const track=stream&&stream.getVideoTracks&&stream.getVideoTracks()[0];
  if(!track)return;
  try{if("contentHint" in track)track.contentHint="motion";}catch(e){}
  try{
    const s=track.getSettings?track.getSettings():{};
    document.documentElement.dataset.visionCapture=(s.width||0)+"x"+(s.height||0)+":"+(s.resizeMode||"native");
  }catch(e){}
}
function loadVisionControlPreference(){
  try{return localStorage.getItem(VISION_CONTROL_STORAGE)==="vision"?"vision":"touch";}catch(e){return "touch";}
}
let VISION_CONTROL_PREFERENCE=loadVisionControlPreference();
let visionPreferenceQueued=false;
function saveVisionControlPreference(value){
  VISION_CONTROL_PREFERENCE=value==="vision"?"vision":"touch";
  try{localStorage.setItem(VISION_CONTROL_STORAGE,VISION_CONTROL_PREFERENCE);}catch(e){}
}
/* 能自动恢复体感的入口状态。原来只认 "diff"(难度选择界面)，
   而绝杀时刻是从主菜单直接进 "lastshot" 的——整个模式永远等不到体感启动。 */
const VISION_AUTO_STATES={diff:true,lastshot:true};
function visionCanAutoStart(){
  return VISION_CONTROL_PREFERENCE==="vision"&&VISION.supported
    &&!VISION.desired&&!VISION.enabled&&!VISION.loading&&!!VISION_AUTO_STATES[G.state];
}
function restoreVisionControlPreference(){
  if(!visionCanAutoStart()||visionPreferenceQueued)return;
  visionPreferenceQueued=true;
  setTimeout(()=>{
    visionPreferenceQueued=false;
    if(visionCanAutoStart())enableVisionControl();
  },0);
}
const VISION={
  supported:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),desired:false,enabled:false,loading:false,liveControl:true,
  stream:null,landmarker:null,modelPromise:null,lastPose:null,lastHands:[],lastPoseAt:0,lastHandAt:0,lastDraw:0,lastVideoTime:-1,raf:0,ownsCharge:false,lastSample:null,inferAvg:0,
  machine:{phase:"idle",holdStart:0,chargeStart:0,lastSeen:0,cooldownUntil:0,releaseFlashUntil:0,chargeBaseY:0,releaseLineY:.32,power:0,lastPowerAt:0},
  body:{samples:[],startedAt:0,ready:false,noseY:.23,shoulderY:.39,hipY:.66,centerX:.5,shoulderW:.22,bodyH:.27,releaseLineY:.32,hipVisible:false,lastAt:0},
  tracking:{left:null,right:null,prevLeft:null,prevRight:null,lastValidAt:0,lastAnyAt:0},
  dock:{name:"",stance:"",lockedUntil:0},
  readyArea:{x:.5,bottom:1,w:.88,h:.35},releaseLineY:.32,
  frame:{width:0,height:0,aspect:9/16,sourcePortrait:true,displayAspect:9/16,portrait:true,cropPortrait:false,requestedPortrait:false,inferCanvas:null,inferCtx:null,inferWidth:0,inferHeight:0},orientationBlocked:false,
  connections:[[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[12,14],[14,16],[16,18],[16,20],[16,22],[11,23],[12,24],[23,24]],
  handConnections:[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
};
const VISION_READY_HOLD_MS=120;
const VISION_RELEASE_LOST_MS=140;
/* “看不到你”语音提示:必须连续丢失这么久才播,避免出手瞬间手腕出画就被念一次 */
const VISION_LOST_PROMPT_MS=2000;
const VISION_LOST_COOLDOWN_MS=9000;
const _visionDockPoint=typeof THREE!=="undefined"?new THREE.Vector3():null;
function visionSyncFrameGeometry(video){
  if(!video)return VISION.frame;
  const w=video.videoWidth||0,h=video.videoHeight||0;if(!w||!h)return VISION.frame;
  const frame=VISION.frame,pixels=w*h,scale=Math.min(1,Math.sqrt(VISION_INFERENCE_MAX_PIXELS/pixels));
  const sourceAspect=w/h,sourcePortrait=h>w,displayPortrait=frame.requestedPortrait||sourcePortrait;
  frame.width=w;frame.height=h;frame.aspect=sourceAspect;frame.sourcePortrait=sourcePortrait;frame.portrait=displayPortrait;
  frame.displayAspect=displayPortrait?9/16:sourceAspect;frame.cropPortrait=false;
  frame.inferWidth=Math.max(2,Math.round(w*scale/2)*2);frame.inferHeight=Math.max(2,Math.round(h*scale/2)*2);
  const stage=video.closest&&video.closest(".visionStage"),preview=$("visionPreview");
  if(stage)stage.style.setProperty("--vision-aspect",displayPortrait?"9 / 16":w+" / "+h);
  if(preview){preview.dataset.orientation=displayPortrait?"portrait":"landscape";preview.dataset.crop="none";preview.dataset.sourceOrientation=sourcePortrait?"portrait":"landscape";}
  document.documentElement.dataset.visionFrame=w+"x"+h;
  return frame;
}
function visionInferenceSource(video){
  const frame=visionSyncFrameGeometry(video),pixels=frame.width*frame.height;
  if(!pixels||pixels<=VISION_INFERENCE_MAX_PIXELS)return video;
  const w=frame.inferWidth,h=frame.inferHeight;
  if(!frame.inferCanvas){frame.inferCanvas=document.createElement("canvas");frame.inferCtx=frame.inferCanvas.getContext("2d",{alpha:false});}
  if(frame.inferCanvas.width!==w||frame.inferCanvas.height!==h){frame.inferCanvas.width=w;frame.inferCanvas.height=h;}
  frame.inferCtx.drawImage(video,0,0,w,h);frame.inferWidth=w;frame.inferHeight=h;
  return frame.inferCanvas;
}
function visionOrientationInvalid(){return visionPointerCoarse()&&innerWidth>innerHeight;}
window.AIBAVisionFrame=Object.freeze({descriptor:()=>({width:VISION.frame.width,height:VISION.frame.height,aspect:VISION.frame.aspect,sourcePortrait:VISION.frame.sourcePortrait,displayAspect:VISION.frame.displayAspect,portrait:VISION.frame.portrait,cropPortrait:VISION.frame.cropPortrait,requestedPortrait:VISION.frame.requestedPortrait,mirrored:true,inferWidth:VISION.frame.inferWidth,inferHeight:VISION.frame.inferHeight})});
function visionLostPromptActive(){
  if(typeof PAUSE!=="undefined"&&PAUSE.on)return false;
  if(G.cutAway||G.battleCut)return false;
  if(G.state==="round")return !G.practice&&G.running&&!G.buzzed;
  if(G.state==="tiebreak")return !G.buzzed&&(G.canShoot||G.charging||G.shotIdx>0);
  if(G.state==="battle")return G.running&&!G.battleOver;
  if(G.state==="rackrush")return G.running&&!G.buzzed;
  if(G.state==="lastshot")return G.running&&!G.buzzed;
  return false;
}
function visionGameActive(){return (G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot")&&G.canShoot&&!G.cutAway&&!G.battleCut;}
function resetVisionGesture(sm){
  sm.phase="idle";sm.holdStart=0;sm.chargeStart=0;sm.lastSeen=0;sm.cooldownUntil=0;sm.releaseFlashUntil=0;
  sm.chargeBaseY=0;sm.releaseLineY=VISION.releaseLineY;sm.power=0;sm.lastPowerAt=0;
}
function visionResetTracking(resetBody){
  VISION.tracking={left:null,right:null,prevLeft:null,prevRight:null,lastValidAt:0,lastAnyAt:0};
  if(resetBody){
    VISION.body={samples:[],startedAt:0,ready:false,noseY:.23,shoulderY:.39,hipY:.66,centerX:.5,shoulderW:.22,bodyH:.27,releaseLineY:.32,hipVisible:false,lastAt:0};
    VISION.releaseLineY=.32;
  }
}
function visionUpdateChargePower(sm,sample,now){
  if(!sm.chargeStart)return sm.power||0;
  sm.power=clamp((typeof G!=="undefined"&&G.charging)?G.power:(sm.power||0),0,100);
  sm.lastPowerAt=now;
  return sm.power||0;
}
function visionGestureStep(sm,sample,now){
  const event={type:"none",phase:sm.phase,progress:0,power:sm.power||0};
  if(sample.hasHands)sm.lastSeen=now;
  if(sm.phase==="cooldown"){
    if(now<sm.releaseFlashUntil){event.phase="release";event.progress=1;return event;}
    if(now>=sm.cooldownUntil&&!sample.readyHold){sm.phase="idle";}
    event.phase=sm.phase;return event;
  }
  if(!sample.valid){
    const lostMs=sample.lostMs==null?9999:sample.lostMs;
    if(sm.phase==="charging"){
      if(lostMs>VISION_RELEASE_LOST_MS){
        sm.phase="cooldown";sm.cooldownUntil=now+400;sm.releaseFlashUntil=now+220;
        event.type="release";event.auto=true;event.phase="release";event.progress=1;event.power=sm.power||0;return event;
      }
      event.phase=sm.phase;event.progress=clamp((sm.power||0)/100,0,1);event.power=sm.power||0;return event;
    }
    if(sm.phase==="armed"&&lostMs>250){sm.phase="idle";sm.holdStart=0;}
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="idle"){
    if(sample.readyEnter){sm.phase="armed";sm.holdStart=now;}
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="armed"){
    if(!sample.readyHold){sm.phase="idle";sm.holdStart=0;event.phase=sm.phase;return event;}
    event.progress=clamp((now-sm.holdStart)/VISION_READY_HOLD_MS,0,1);
    if(now-sm.holdStart>=VISION_READY_HOLD_MS){
      sm.phase="charging";sm.chargeStart=now;sm.lastPowerAt=now;sm.power=0;
      sm.chargeBaseY=sample.readyY||sample.liftY||VISION.body.hipY;sm.releaseLineY=sample.releaseLineY||VISION.releaseLineY;
      event.type="charge";event.progress=0;event.power=0;
    }
    event.phase=sm.phase;return event;
  }
  if(sm.phase==="charging"){
    const power=visionUpdateChargePower(sm,sample,now);
    event.power=power;event.progress=clamp(power/100,0,1);
    if(sample.release){
      sm.phase="cooldown";sm.cooldownUntil=now+400;sm.releaseFlashUntil=now+220;
      event.type="release";event.phase="release";event.progress=1;event.power=power;return event;
    }
    if(now-sm.chargeStart>2600){
      sm.phase="cooldown";sm.cooldownUntil=now+400;sm.releaseFlashUntil=now+220;
      event.type="release";event.auto=true;event.phase="release";event.progress=1;event.power=power;return event;
    }
  }
  return event;
}
function visionConfidence(p){return p?(p.visibility==null?(p.presence==null?1:p.presence):p.visibility):0;}
function visionMedian(vals){
  vals=vals.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!vals.length)return 0;
  const m=vals.length>>1;
  return vals.length%2?vals[m]:(vals[m-1]+vals[m])*.5;
}
function visionGoodPoint(lm,i,min){
  const p=lm&&lm[i];return p&&visionConfidence(p)>=(min==null ? .35 : min)?p:null;
}
function visionBodyCandidate(lm){
  const nose=visionGoodPoint(lm,0,.3),sL=visionGoodPoint(lm,11,.32),sR=visionGoodPoint(lm,12,.32),hL=visionGoodPoint(lm,23,.28),hR=visionGoodPoint(lm,24,.28);
  if(!sL||!sR)return null;
  const hipVisible=!!(hL&&hR);
  const shoulderY=(sL.y+sR.y)*.5,hipY=hipVisible?(hL.y+hR.y)*.5:null,centerX=hipVisible?(sL.x+sR.x+hL.x+hR.x)*.25:(sL.x+sR.x)*.5;
  const headSpan=nose?Math.max(.08,shoulderY-nose.y):.14;
  const estHipY=clamp(shoulderY+headSpan*1.75,.58,.88);
  const yHip=hipVisible?hipY:estHipY;
  const shoulderW=Math.abs(sL.x-sR.x),hipW=hipVisible?Math.abs(hL.x-hR.x):shoulderW*.92,bodyH=clamp(yHip-shoulderY,.16,.5);
  const noseY=nose?nose.y:clamp(shoulderY-bodyH*.58,0,1);
  const releaseLineY=clamp(noseY+(shoulderY-noseY)*.6,.08,shoulderY-bodyH*.08);
  return {noseY,shoulderY,hipY:yHip,centerX,shoulderW:Math.max(shoulderW,hipW*.85,.12),bodyH,releaseLineY,hipVisible};
}
function visionUpdateBodyCalib(lm,now){
  const b=VISION.body,raw=visionBodyCandidate(lm);
  if(!b.startedAt)b.startedAt=now;
  if(raw){
    b.samples.push({t:now,...raw});
    b.samples=b.samples.filter(s=>now-s.t<=2200).slice(-48);
    const med={};
    for(const k of ["noseY","shoulderY","hipY","centerX","shoulderW","bodyH","releaseLineY"])med[k]=visionMedian(b.samples.map(s=>s[k]));
    const a=b.ready?.16:1;
    for(const k of Object.keys(med))b[k]=b[k]*(1-a)+med[k]*a;
    b.hipVisible=b.samples.slice(-8).some(s=>s.hipVisible);
    b.ready=b.samples.length>=2;
    b.lastAt=now;
  }
  return b;
}
function visionReadyAreaBounds(area,boost){
  if(area&&area.left!=null){
    return {
      left:clamp(area.left-(boost||0),0,1),
      right:clamp(area.right+(boost||0),0,1),
      top:clamp(area.top-(boost||0)*.75,0,1),
      bottom:clamp(area.bottom,0,1)
    };
  }
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
function visionDynamicReadyArea(body){
  const xHalf=clamp(body.shoulderW*2.15,.32,.49);
  const top=body.hipVisible?body.hipY-body.bodyH*.03:Math.max(.6,body.shoulderY+body.bodyH*.45);
  return {left:body.centerX-xHalf,right:body.centerX+xHalf,top:clamp(top,.54,.88),bottom:1};
}
function visionInBodyReady(p,body,armed){
  if(!p)return false;
  const boost=armed?.055:.025;
  if(visionPointInReadyArea(p,VISION.readyArea,boost))return true;
  const top=body.hipVisible?(armed?body.hipY-body.bodyH*.08:body.hipY-body.bodyH*.03):(armed?Math.max(.54,body.shoulderY+body.bodyH*.36):Math.max(.6,body.shoulderY+body.bodyH*.45));
  const area=visionDynamicReadyArea(body),b=visionReadyAreaBounds(area,0);
  return p.x>=b.left&&p.x<=b.right&&p.y>=top&&p.y<=b.bottom;
}
function visionTrackWrists(lm,now){
  const tr=VISION.tracking,alpha=.4,raw={left:visionGoodPoint(lm,15,.32),right:visionGoodPoint(lm,16,.32)};
  let count=0;
  for(const side of ["left","right"]){
    const p=raw[side];
    if(!p)continue;
    count++;
    const prev=tr[side];
    tr["prev"+(side==="left"?"Left":"Right")]=prev?{...prev}:null;
    tr[side]=prev?{x:prev.x*(1-alpha)+p.x*alpha,y:prev.y*(1-alpha)+p.y*alpha,t:now,raw:p}:{x:p.x,y:p.y,t:now,raw:p};
  }
  if(count){tr.lastValidAt=now;tr.lastAnyAt=now;}
  const fresh=side=>{
    const p=tr[side];if(!p||now-p.t>=330)return null;
    return {...p,current:now-p.t<85,age:now-p.t};
  };
  return {left:fresh("left"),right:fresh("right"),count};
}
function visionWristCrossedRelease(side,line,now){
  const tr=VISION.tracking,p=tr[side],prev=tr["prev"+(side==="left"?"Left":"Right")];
  if(!p)return false;
  const raw=p.raw||p,prevRaw=prev&&(prev.raw||prev);
  if(raw&&raw.y<=line)return true;
  if(prevRaw&&prevRaw.y>line&&raw&&raw.y<=line)return true;
  if(p.y<=line)return true;
  if(!prev)return false;
  const dt=Math.max(16,p.t-prev.t),vy=(p.y-prev.y)/dt;
  const crossed=prev.y>line&&p.y<=line;
  const projected=p.y+vy*Math.min(90,dt*1.5);
  return crossed||(prev.y>line&&p.y<prev.y-.012&&projected<=line);
}
function visionLandmarkSample(lm,handLandmarks,now){
  const poseFresh=now-(VISION.lastPoseAt||0)<450;
  const body=visionUpdateBodyCalib(poseFresh?lm:null,now),tracked=poseFresh?visionTrackWrists(lm,now):{left:null,right:null,count:0};
  const currentLeft=tracked.left&&tracked.left.current?tracked.left:null,currentRight=tracked.right&&tracked.right.current?tracked.right:null;
  const wrists=[tracked.left,tracked.right].filter(Boolean),currentWrists=[currentLeft,currentRight].filter(Boolean),hasHands=currentWrists.length>0,lostMs=hasHands?0:now-(VISION.tracking.lastValidAt||0);
  const armed=VISION.machine.phase==="armed"||VISION.machine.phase==="charging";
  const readyEnter=!!(currentLeft&&currentRight&&visionInBodyReady(currentLeft,body,false)&&visionInBodyReady(currentRight,body,false));
  const readyHold=!!(currentLeft&&currentRight&&visionInBodyReady(currentLeft,body,true)&&visionInBodyReady(currentRight,body,true));
  const releaseLine=VISION.releaseLineY;
  const release=!!((currentLeft&&visionWristCrossedRelease("left",releaseLine,now))||(currentRight&&visionWristCrossedRelease("right",releaseLine,now)));
  const liftSource=currentWrists.length?currentWrists:wrists;
  const liftY=liftSource.length?liftSource.reduce((m,p)=>Math.min(m,p.y),1):null;
  const readyY=currentLeft&&currentRight?(currentLeft.y+currentRight.y)*.5:liftY;
  const upperReady=poseFresh&&!!lm&&visionGoodPoint(lm,11,.32)&&visionGoodPoint(lm,12,.32);
  const valid=(body.ready||upperReady)&&(hasHands||((VISION.machine.phase==="charging"||VISION.machine.phase==="armed")&&lostMs<VISION_RELEASE_LOST_MS));
  const sample={valid,hasHands,ready:readyEnter,readyEnter,readyHold,release,handCount:wrists.length,palms:[],readyPoints:wrists,releasePoints:wrists,
    liftY,readyY,lostMs,body,readyArea:visionDynamicReadyArea(body),releaseLineY:releaseLine,now};
  VISION.lastSample=sample;return sample;
}
function visionClampPx(v,min,max){return Math.max(min,Math.min(max,v));}
function visionClearPreviewDock(wrap){
  if(!wrap)return;
  delete wrap.dataset.dock;
  wrap.style.removeProperty("--vision-x");wrap.style.removeProperty("--vision-y");
  VISION.dock.name="";VISION.dock.stance="";VISION.dock.lockedUntil=0;
  delete document.documentElement.dataset.visionDock;
}
function visionLivePlayState(){return G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="lastshot";}
function visionPreviewPlayState(){return visionLivePlayState()||G.state==="pregame"||G.state==="rushintro"||G.state==="rushbetween";}
function visionSyncPreviewVisibility(wrap){
  if(!wrap)return;
  wrap.style.display=(VISION.desired&&(visionPreviewPlayState()||VISION.orientationBlocked))?"block":"none";
}
function visionDockStanceKey(){
  const x=P&&P.pos?Math.round(P.pos.x*10):0,z=P&&P.pos?Math.round(P.pos.z*10):0;
  const mode=typeof CAM!=="undefined"&&CAM?CAM.mode:"";
  const spot=G.mode==="battle"?(G.battleSpot||0):"";
  return [G.mode,G.state,spot,mode,x,z,innerWidth,innerHeight].join(":");
}
function visionPlayerScreenRect(){
  if(!_visionDockPoint||typeof P==="undefined"||!P||!P.pos||typeof camera==="undefined"||!camera)return null;
  const W=innerWidth,H=innerHeight,jump=P.jump||0;
  const pts=[
    [P.pos.x,P.pos.y||0,P.pos.z],
    [P.pos.x,1.05+jump,P.pos.z],
    [P.pos.x,1.96+jump,P.pos.z],
    [P.pos.x-.5,.86+jump,P.pos.z],
    [P.pos.x+.5,.86+jump,P.pos.z]
  ];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,seen=0;
  for(const p of pts){
    _visionDockPoint.set(p[0],p[1],p[2]).project(camera);
    if(!Number.isFinite(_visionDockPoint.x)||!Number.isFinite(_visionDockPoint.y)||_visionDockPoint.z>1)continue;
    const x=(_visionDockPoint.x*.5+.5)*W,y=(-_visionDockPoint.y*.5+.5)*H;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);seen++;
  }
  if(!seen)return null;
  const mobile=innerWidth<=600,padX=mobile?46:62,padTop=mobile?42:56,padBottom=mobile?58:72;
  minX=visionClampPx(minX-padX,0,W);maxX=visionClampPx(maxX+padX,0,W);
  minY=visionClampPx(minY-padTop,0,H);maxY=visionClampPx(maxY+padBottom,0,H);
  return {left:minX,top:minY,right:maxX,bottom:maxY,cx:(minX+maxX)*.5,cy:(minY+maxY)*.5};
}
function visionOverlapArea(a,b){
  const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
  const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return w*h;
}
function visionPreviewCandidates(wrap){
  const W=innerWidth,H=innerHeight,box=wrap.getBoundingClientRect();
  const w=box.width||142,h=box.height||300,m=10,mobile=innerWidth<=600;
  const left=m,right=Math.max(m,W-w-m),midTop=visionClampPx((H-h)*.5,m,Math.max(m,H-h-m));
  const lowBottom=mobile?8:18,lowTop=visionClampPx(H-h-lowBottom,m,Math.max(m,H-h-m));
  const make=(name,x,y,side,zone)=>({name,side,zone,rect:{left:x,top:y,right:x+w,bottom:y+h,cx:x+w*.5,cy:y+h*.5}});
  return mobile?[
    make("left-low",left,lowTop,"left","low"),
    make("right-low",right,lowTop,"right","low")
  ]:[
    make("left-mid",left,midTop,"left","mid"),
    make("right-mid",right,midTop,"right","mid"),
    make("left-low",left,lowTop,"left","low"),
    make("right-low",right,lowTop,"right","low")
  ];
}
function visionDockScore(candidate,player,current,preferred){
  let score=visionOverlapArea(candidate.rect,player)*3;
  const W=innerWidth,H=innerHeight;
  if(candidate.name===current)score-=6200;
  if(candidate.name===preferred)score-=2400;
  if(player.cx<W*.42&&candidate.side==="left")score+=32000*(1-player.cx/(W*.42));
  if(player.cx>W*.58&&candidate.side==="right")score+=32000*((player.cx-W*.58)/(W*.42));
  if(player.cy>H*.58&&candidate.zone==="low")score+=9000*((player.cy-H*.58)/(H*.42));
  return score;
}
function visionUpdatePreviewDock(now){
  const wrap=$("visionPreview");if(!wrap)return;
  visionSyncPreviewVisibility(wrap);
  const setup=G.state==="menu"||G.state==="diff";
  if(setup||!visionPreviewPlayState()){visionClearPreviewDock(wrap);return;}
  const stance=visionDockStanceKey(),current=wrap.dataset.dock||"";
  if(current&&VISION.dock.stance===stance)return;
  const playerRect=visionPlayerScreenRect();
  if(!playerRect){
    if(!current)visionClearPreviewDock(wrap);
    return;
  }
  const candidates=visionPreviewCandidates(wrap),preferred=innerWidth<=600?"left-low":"left-mid";
  let best=candidates[0],bestScore=Infinity;
  for(const candidate of candidates){
    const score=visionDockScore(candidate,playerRect,current,preferred);
    if(score<bestScore){best=candidate;bestScore=score;}
  }
  if(current&&best.name!==current&&now<VISION.dock.lockedUntil)return;
  wrap.dataset.dock=best.name;
  wrap.style.setProperty("--vision-x",Math.round(best.rect.left)+"px");
  wrap.style.setProperty("--vision-y",Math.round(best.rect.top)+"px");
  VISION.dock.name=best.name;VISION.dock.stance=stance;
  if(best.name!==current)VISION.dock.lockedUntil=now+360;
  document.documentElement.dataset.visionDock=best.name;
}
function visionSetUI(phase,label,progress){
  const wrap=$("visionPreview"),state=$("visionState"),fill=$("visionTrackFill");if(!wrap)return;
  wrap.dataset.phase=phase;wrap.dataset.context=(G.state==="menu"||G.state==="diff")?"setup":"game";
  visionUpdatePreviewDock(performance.now());
  if(state)state.textContent=label;if(fill)fill.style.height=(clamp(progress||0,0,1)*100)+"%";
}
function visionPhaseLabel(step,sample){
  if(sample&&sample.body&&!sample.body.ready)return"身体标定中";
  if(step.phase==="armed")return"双手锁定 "+Math.round(step.progress*100)+"%";
  if(step.phase==="charging"){
    const blind=VISION.liveControl&&typeof curShot==="function"&&barHiddenFor(curShot());
    const p=Math.round((VISION.liveControl&&G.charging?G.power:(step.power||step.progress*100)));
    return blind?"任一手越过上方出手线":"蓄力 · "+p+"%";
  }
  if(step.phase==="release")return"越线触发 · 出手";
  if(step.phase==="cooldown")return"动作复位";
  if(sample&&!sample.hasHands&&sample.lostMs>2000)return"回到画面中";
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
  const frame=visionSyncFrameGeometry(video),w=frame.inferWidth||288,h=frame.inferHeight||512;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const g=cv.getContext("2d");g.clearRect(0,0,w,h);
  drawVisionReleaseLine(g,(sample&&sample.releaseLineY)||VISION.releaseLineY,w,h,phase==="charging"||phase==="release");
  drawVisionReadyArea(g,(sample&&sample.readyArea)||VISION.readyArea,w,h,"#70e8ff",phase==="armed");
  const color=phase==="charging"?"#7CFC6B":(phase==="armed"?"#ffd23f":"#70e8ff");
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
  if(VISION.landmarker)return VISION.landmarker;
  if(VISION.modelPromise)return VISION.modelPromise;
  VISION.modelPromise=(async()=>{
  const mp=await import("../vendor/mediapipe/vision_bundle.mjs");
  const files=await mp.FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
  const options={baseOptions:{modelAssetPath:"./assets/aiba-vision/pose_landmarker_lite.task",delegate:"GPU"},runningMode:"VIDEO",numPoses:1,
    minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55,outputSegmentationMasks:false};
  if(!VISION.landmarker){
    try{VISION.landmarker=await mp.PoseLandmarker.createFromOptions(files,options);}
    catch(e){options.baseOptions.delegate="CPU";VISION.landmarker=await mp.PoseLandmarker.createFromOptions(files,options);}
  }
  return VISION.landmarker;
  })();
  try{return await VISION.modelPromise;}
  finally{VISION.modelPromise=null;}
}
function prewarmVisionControl(reason){
  if(!VISION.supported||VISION.landmarker||VISION.loading||!VISION.desired)return;
  const run=()=>loadVisionModel().catch(()=>{});
  if("requestIdleCallback" in window)requestIdleCallback(run,{timeout:1200});
  else setTimeout(run,80);
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
  }else if(step.type==="release"&&VISION.ownsCharge){
    const tutorial=window.AIBAInteractiveTutorial;
    if(tutorial&&tutorial.isActive&&tutorial.isActive()&&tutorial.acceptVisionRelease&&!tutorial.acceptVisionRelease(step)){
      const sm=VISION.machine,now=performance.now();
      sm.phase="charging";sm.chargeStart=now;sm.lastPowerAt=now;sm.power=G.power;
      sm.cooldownUntil=0;sm.releaseFlashUntil=0;
      return;
    }
    VISION.ownsCharge=false;doRelease();
  }
  else if(step.type==="cancel")cancelVisionOwnedCharge();
}
function syncVisionOwnedPower(step){
  if(!VISION.ownsCharge||!G.charging||!step||step.phase!=="charging")return;
  const fill=$("pFill");if(fill)fill.style.height=Math.round(G.power)+"%";
}
function visionCadence(){
  const phase=VISION.machine.phase,setup=G.state==="menu"||G.state==="diff",active=visionGameActive();
  const penalty=VISION.inferAvg>34?1.5:(VISION.inferAvg>23?1.25:1);
  let drawMs,poseMs,mode;
  if(active&&phase==="charging"){
    drawMs=82;poseMs=46;mode="gesture";
  }else if(active&&phase==="armed"){
    drawMs=88;poseMs=54;mode="gesture";
  }else if(active){
    drawMs=132;poseMs=118;mode="ready";
  }else if(setup){
    drawMs=170;poseMs=240;mode="setup";
  }else{
    drawMs=220;poseMs=420;mode="idle";
  }
  return {drawMs:drawMs*(penalty>1?1.15:1),poseMs:poseMs*penalty,mode};
}
function visionDetectTask(now,c){
  return now-(VISION.lastPoseAt||0)>=c.poseMs?"pose":null;
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
  if(visionOrientationInvalid()){
    if(!VISION.orientationBlocked){VISION.orientationBlocked=true;resetVisionGesture(VISION.machine);cancelVisionOwnedCharge();visionResetTracking(true);}
    if(now-(VISION.lastDraw||0)>240){VISION.lastDraw=now;drawVisionPose(VISION.lastPose,[],VISION.lastSample,"idle");visionSetUI("align","请保持手机竖屏",0);}
    return;
  }
  if(VISION.orientationBlocked){VISION.orientationBlocked=false;VISION.lastVideoTime=-1;visionResetTracking(true);resetVisionGesture(VISION.machine);}
  const cadence=visionCadence(),task=visionDetectTask(now,cadence),shouldDraw=now-(VISION.lastDraw||0)>=cadence.drawMs;
  if(!task&&!shouldDraw)return;
  VISION.lastVideoTime=video.currentTime;
  const started=performance.now();
  try{
    if(task==="pose"){
      const result=VISION.landmarker.detectForVideo(visionInferenceSource(video),now);VISION.lastPose=result&&result.landmarks&&result.landmarks[0]?result.landmarks[0]:null;VISION.lastPoseAt=now;
    }
    if(task)noteVisionInference(started);
  }
  catch(e){visionSetUI("error","识别暂时中断",0);return;}
  const sample=visionLandmarkSample(VISION.lastPose,VISION.lastHands,now);
  const canAdvance=G.state==="diff"||G.state==="menu"||visionGameActive();
  if(!canAdvance){resetVisionGesture(VISION.machine);cancelVisionOwnedCharge();}
  const step=canAdvance?visionGestureStep(VISION.machine,sample,now):{type:"none",phase:"idle",progress:0};
  handleVisionGesture(step);
  syncVisionOwnedPower(step);
  /* 提示只看 sample.valid(真的追踪不到人),不能看 sample.ready —— 后者是“双手在
     蓄力框内”,每次抬手出手都会变 false,会导致每投一球就被提示一次。
     并且只在正式比赛 GO 之后到结束之前启用。模式选择、赛前倒计时、练习教学、
     暂停和比赛结束阶段都只做识别预热,不播人体丢失提示。 */
  const lostPromptActive=visionLostPromptActive();
  if(!lostPromptActive){
    VISION._lostPromptWindow=false;
    VISION._lostSince=0;
    VISION._lostPrompted=false;
  }else if(VISION.enabled&&sample){
    if(!VISION._lostPromptWindow){
      VISION._lostPromptWindow=true;VISION._lostSince=sample.valid?0:now;
      VISION._lostPrompted=false;VISION._lastLostTime=0;
    }
    if(sample.valid){
      if(VISION._lostPrompted&&now-(VISION._lastReadyTime||0)>VISION_LOST_PROMPT_MS){
        if(typeof playAudioEvent==="function")playAudioEvent("pose_ready");
        VISION._lastReadyTime=now;
      }
      VISION._lostSince=0;VISION._lostPrompted=false;
    }else{
      if(!VISION._lostSince)VISION._lostSince=now;
      if(!VISION._lostPrompted&&now-VISION._lostSince>=VISION_LOST_PROMPT_MS&&
         now-(VISION._lastLostTime||0)>VISION_LOST_COOLDOWN_MS){
        if(typeof playAudioEvent==="function")playAudioEvent("pose_lost");
        VISION._lastLostTime=now;VISION._lostPrompted=true;
      }
    }
  }
  if(shouldDraw){
    VISION.lastDraw=now;
    const drawPose=now-(VISION.lastPoseAt||0)<500?VISION.lastPose:null;
    const drawHands=[];
    drawVisionPose(drawPose,drawHands,sample,step.phase);
    const blindCharge=step.phase==="charging"&&VISION.liveControl&&typeof curShot==="function"&&barHiddenFor(curShot());
    visionSetUI(step.phase,visionPhaseLabel(step,sample),blindCharge?0:step.progress);
    if(visionGameActive()){
      const hint=$("hint");
      if(hint)hint.textContent=step.phase==="armed"?"双手保持在髋线下方":(step.phase==="charging"?"任一只手快速越过上方出手线":(step.phase==="release"?"出手!":"双手进入下方蓄力区 0.12 秒"));
    }
    document.documentElement.dataset.visionPhase=step.phase;
    document.documentElement.dataset.visionReady=sample.ready?"1":"0";
    document.documentElement.dataset.visionHands=String(sample.handCount||0);
    document.documentElement.dataset.visionCadence=cadence.mode;
  }
}
/* 切换控制模式后要刷新当前这张面板。不能一律走 goDiff——绝杀时刻的开始界面
   也把 G.state 设成 "diff"，直接 goDiff 会把玩家踢到通用难度界面(看起来就是
   "选了体感却跳到三分大赛去了")。按模式分流，各自重渲染自己的面板。 */
function refreshControlPanel(){
  if(G.state!=="diff")return;
  if(G.mode==="lastshot"&&typeof openLastShot==="function"){openLastShot();return;}
  if(typeof goDiff==="function")goDiff(G.mode,true);
}
async function enableVisionControl(event){
  if(event){event.stopPropagation();event.preventDefault();}
  if(!VISION.supported){toast("此浏览器不支持体感控制","#ff8d7a");return;}
  if(VISION.loading||VISION.enabled)return;
  saveVisionControlPreference("vision");
  VISION.desired=true;VISION.loading=true;visionSyncPreviewVisibility($("visionPreview"));visionSetUI("align","正在启动本地识别",.08);
  try{
    const modelPromise=loadVisionModel();
    VISION.frame.requestedPortrait=visionWantsPortrait();document.documentElement.dataset.visionRequested=VISION.frame.requestedPortrait?"portrait":"landscape";
    const streamPromise=navigator.mediaDevices.getUserMedia({audio:false,video:visionCaptureConstraints()});
    const results=await Promise.all([modelPromise,streamPromise]);VISION.stream=results[1];visionRecordCaptureSettings(VISION.stream);
    const video=$("visionVideo");video.srcObject=VISION.stream;await video.play();visionSyncFrameGeometry(video);
    VISION.enabled=true;VISION.lastSample=null;VISION.lastPose=null;VISION.lastHands=[];VISION.lastPoseAt=0;VISION.lastHandAt=0;VISION.lastDraw=0;VISION.lastVideoTime=-1;VISION.inferAvg=0;visionResetTracking(true);resetVisionGesture(VISION.machine);visionSetUI("idle","双手放入下方蓄力框",0);
    cancelAnimationFrame(VISION.raf);VISION.raf=requestAnimationFrame(visionFrame);
    document.documentElement.dataset.visionControl="ready";
    refreshControlPanel();
  }catch(e){
    VISION.desired=false;VISION.enabled=false;if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());VISION.stream=null;
    visionSyncPreviewVisibility($("visionPreview"));visionSetUI("error",e&&e.name==="NotAllowedError"?"摄像头权限未开启":"体感识别启动失败",0);
    document.documentElement.dataset.visionControl="error";toast("体感控制未启动 · 已保留触屏控制","#ff8d7a");
  }finally{VISION.loading=false;}
}
function disableVisionControl(event){
  if(event){event.stopPropagation();event.preventDefault();}
  saveVisionControlPreference("touch");
  suspendVisionControl();
  refreshControlPanel();
}
function suspendVisionControl(){
  VISION.desired=false;VISION.enabled=false;VISION.loading=false;cancelAnimationFrame(VISION.raf);cancelVisionOwnedCharge();
  if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());VISION.stream=null;const video=$("visionVideo");if(video)video.srcObject=null;
  visionResetTracking(true);resetVisionGesture(VISION.machine);VISION.lastSample=null;VISION.lastPose=null;VISION.lastHands=[];VISION.lastPoseAt=0;VISION.lastHandAt=0;VISION.lastDraw=0;VISION.lastVideoTime=-1;VISION.inferAvg=0;$("visionPreview").style.display="none";
  VISION.orientationBlocked=false;document.documentElement.dataset.visionControl="off";delete document.documentElement.dataset.visionPhase;delete document.documentElement.dataset.visionReady;delete document.documentElement.dataset.visionHands;delete document.documentElement.dataset.visionFrame;
}
function visionModeMarkup(){
  const active=VISION.desired||VISION.enabled;
  restoreVisionControlPreference();
  return `<div class="visionMode"><span class="visionModeLabel"><small>CONTROL MODE</small><b>操作模式</b></span>
    <button class="${active?"":"active"}" onclick="disableVisionControl(event)"><span>触屏控制</span></button>
    <button class="${active?"active":""}" onclick="enableVisionControl(event)" ${VISION.supported?"":"disabled"}><span>体感控制</span><em class="controlRecommend">推荐</em></button></div>`;
}
addEventListener("pagehide",()=>{if(VISION.stream)VISION.stream.getTracks().forEach(t=>t.stop());});
addEventListener("orientationchange",()=>{if(!VISION.enabled)return;setTimeout(()=>{VISION.lastVideoTime=-1;visionResetTracking(true);resetVisionGesture(VISION.machine);visionSyncFrameGeometry($("visionVideo"));},220);});
