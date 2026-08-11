(function(global){
  "use strict";

  const cache=new Map();
  const W=300,H=330;
  let liveView=null,detachObserver=null,renderTicket=0,focusTicket=0;
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
    sleeve:{y:1.12,zoom:1.42,pitch:-.02},
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
    if(guy.fingerJoints)guy.fingerJoints.forEach(hand=>hand&&hand.forEach(finger=>finger.rotation.set(-.08,0,0)));
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
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,release*-1.05,.04,k);
    if(guy.fingerJoints&&guy.fingerJoints[0])guy.fingerJoints[0].forEach((finger,index)=>{
      finger.rotation.x=-.08+release*([.12,.30,.42,.18][index]||.12);
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
    blendRotation(guy.handRoots&&guy.handRoots[0],-.18,0,.08+tug*.08,k);
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,0,-.08-tug*.08,k);
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
    blendRotation(guy.handRoots&&guy.handRoots[0],-.18,0,-.10+adjust,k);
    blendRotation(guy.handRoots&&guy.handRoots[1],-.18,0,.10-adjust,k);
    if(guy.legs&&guy.knees&&guy.ankles){
      guy.legs[0].rotation.x-=.022*k;guy.legs[1].rotation.x-=.022*k;
      guy.knees[0].rotation.x+=.052*k;guy.knees[1].rotation.x+=.052*k;
      guy.ankles[0].rotation.x-=.03*k;guy.ankles[1].rotation.x-=.03*k;
    }
  }
  function featuredPose(guy,id){
    idlePose(guy,.7);
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
    idlePose(view.guy,motionTime);
    if(view.reducedMotion){view.slot.dataset.lockerAction="idle";return;}
    if(!view.action&&now>=view.nextActionAt)beginLockerAction(view,now);
    if(!view.action){view.slot.dataset.lockerAction="idle";return;}
    const progress=clamp01((now-view.action.startedAt)/view.action.duration);
    view.slot.dataset.lockerAction=view.action.name;
    if(view.action.name==="wave")wavePose(view.guy,progress,view.action.side);
    else if(view.action.name==="shadowShot")shadowShotPose(view.guy,progress);
    else if(view.action.name==="jersey")jerseyPose(view.guy,progress);
    else if(view.action.name==="headband")headbandPose(view.guy,progress);
    if(progress>=1){
      view.action=null;
      view.nextActionAt=now+1800+Math.random()*1800;
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
    const guy=global.voxelGuy();
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
    liveView.slot.dataset.orbitFocus="full";
    drawLive(liveView);
  }
  function focusLive(part){
    if(!liveView)return;
    const view=liveView,preset=FOCUS_PRESETS[part]||FOCUS_PRESETS.full,ticket=++focusTicket;
    const targetY=(part&&part!=="full"?preset.y*view.bodyH:view.fullLookY);
    const start={y:view.lookAt.y,zoom:view.zoom,pitch:view.pitch},started=performance.now();
    view.focusPart=FOCUS_PRESETS[part]?part:"full";
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
    const width=Math.max(140,Math.round(slot.clientWidth||210));
    const height=Math.max(160,Math.round(slot.clientHeight||220));
    const ctx=buildScene(width,height,false),guy=global.voxelGuy(),star=findStar(id);
    dressPreview(guy,star,true);idlePose(guy);ctx.rig.add(guy.g);
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
    const view={slot,ctx,guy,yaw:0,pitch:0,zoom:1,focusPart:"full",bodyH:Number(body&&body.h)||1,fullLookY:lookY,baseAzimuth:Math.atan2(.18,4.25),baseElevation:Math.asin((1.07-.94)/4.25),lookAt:new THREE.Vector3(0,lookY,0),cleanup:[],resizeObserver:null,
      motionEpoch:now,lastMotionFrame:0,motionRaf:0,reducedMotion:!!(global.matchMedia&&global.matchMedia("(prefers-reduced-motion: reduce)").matches),action:null,actionBag:[],lastAction:"",nextActionAt:now+1200+Math.random()*900};
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
      e.preventDefault();focusTicket++;
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
        view.yaw+=(x-lastTouchX)*.014;view.pitch=clampPitch(view.pitch+(y-lastTouchY)*.012);
        lastTouchX=x;lastTouchY=y;
      }else if(e.touches.length>=2&&pinchDistance>0)view.zoom=clampZoom(pinchZoom*touchDistance(e.touches)/pinchDistance);
      drawLive(view);
    };
    const touchEnd=e=>{
      if(e.touches&&e.touches.length===1){lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;}
      else if(!e.touches||!e.touches.length){pinchDistance=0;pinchZoom=view.zoom;slot.classList.remove("dragging");}
    };
    const wheel=e=>{e.preventDefault();view.zoom=clampZoom(view.zoom*Math.exp(-e.deltaY*.0015));drawLive(view);};
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
