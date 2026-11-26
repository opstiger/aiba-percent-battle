/* Joint editor for a frozen frame of the actual skinned game avatar. */
const gameJoints = (() => {
  const joints = {
    Hips:"髋", Spine2:"胸", Neck:"颈", Head:"头",
    RightArm:"右肩", RightForeArm:"右肘", RightHand:"右腕",
    LeftArm:"左肩", LeftForeArm:"左肘", LeftHand:"左腕",
    RightUpLeg:"右髋", RightLeg:"右膝", RightFoot:"右踝",
    LeftUpLeg:"左髋", LeftLeg:"左膝", LeftFoot:"左踝"
  };
  const chains = {};
  for(const side of ["Right","Left"]){
    const arm = [side+"Arm",side+"ForeArm",side+"Hand"];
    const leg = [side+"UpLeg",side+"Leg",side+"Foot"];
    for(const chain of [arm,leg]) {
      chains[chain[1]]=chain;
      chains[chain[2]]=chain;
    }
  }

  const overlay = document.createElement("div");
  overlay.className = "joint-overlay";
  overlay.hidden = true;
  const tools = document.createElement("div");
  tools.className = "joint-tools";
  tools.innerHTML = '<select aria-label="选择关节"></select><button type="button">拖位置</button><button type="button">旋转</button><button type="button">恢复此帧</button><button type="button">复制姿势</button><span aria-live="polite"></span>';
  overlay.appendChild(tools);
  document.body.appendChild(overlay);
  const [select,moveButton,rotateButton,resetButton,copyButton,status] = tools.children;
  const markers = {};
  for(const [name,label] of Object.entries(joints)){
    select.appendChild(new Option(label,name));
    const button = document.createElement("button");
    button.className = "joint-point";
    button.type = "button";
    button.dataset.joint = name;
    button.textContent = label;
    button.setAttribute("aria-label",label+"关节");
    button.onpointerdown = event => begin(event,name);
    overlay.appendChild(button);
    markers[name] = button;
  }

  let selected = "RightHand", mode = "move", visible = false, drag = null;
  let rig = null, bones = {}, lastFrame = -1, baseline = {}, shotBall = null;
  const posedFrames = new Map();
  const plane = new THREE.Plane();
  const ray = new THREE.Raycaster();
  const position = b => b.getWorldPosition(new THREE.Vector3());
  const rotation = b => b.getWorldQuaternion(new THREE.Quaternion());
  const delta = (a,b) => a.clone().sub(b);
  const own = obj => ({position:obj.position.toArray(),quaternion:obj.quaternion.toArray()});
  function worldRotate(b,q){
    b.quaternion.copy(rotation(b.parent).invert().multiply(q));
    b.updateWorldMatrix(true,true);
  }
  function pointBone(b,child,direction){
    const current = delta(position(child),position(b)).normalize();
    if(direction.lengthSq()<1e-8||current.lengthSq()<1e-8)return;
    const change=new THREE.Quaternion().setFromUnitVectors(current,direction.normalize());
    worldRotate(b,change.multiply(rotation(b)));
  }
  function solveChain(chain,target,poleTarget){
    const [upper,lower,end] = chain.map(name=>bones[name]);
    const base=position(upper), mid=position(lower), tip=position(end);
    const l1=base.distanceTo(mid),l2=mid.distanceTo(tip);
    if(l1<1e-4||l2<1e-4)return;
    const axis=delta(target,base);
    const length=clamp(axis.length(),Math.abs(l1-l2)+.002,l1+l2-.002);
    if(axis.lengthSq()<1e-8)axis.copy(delta(tip,base));
    axis.normalize();
    const along=(l1*l1-l2*l2+length*length)/(2*length);
    const height=Math.sqrt(Math.max(0,l1*l1-along*along));
    const bend=delta(poleTarget,base);
    bend.addScaledVector(axis,-bend.dot(axis));
    if(bend.lengthSq()<1e-8){
      bend.copy(delta(mid,base));
      bend.addScaledVector(axis,-bend.dot(axis));
    }
    if(bend.lengthSq()<1e-8){
      bend.set(0,0,1).applyQuaternion(camera.quaternion);
      bend.addScaledVector(axis,-bend.dot(axis));
    }
    const elbow=base.clone().addScaledVector(axis,along).addScaledVector(bend.normalize(),height);
    pointBone(upper,lower,delta(elbow,base));
    pointBone(lower,end,delta(base.clone().addScaledVector(axis,length),position(lower)));
  }
  function aimNext(b,target){
    const child = b.children.find(n=>n.isBone);
    if(child)pointBone(b,child,delta(target,position(b)));
  }
  function refresh(){
    select.value=selected;
    moveButton.setAttribute("aria-pressed",String(mode==="move"));
    rotateButton.setAttribute("aria-pressed",String(mode==="rotate"));
    for(const [name,button] of Object.entries(markers))button.classList.toggle("selected",name===selected);
  }
  select.onchange = ()=>{selected=select.value;refresh();};
  moveButton.onclick = ()=>{mode="move";refresh();};
  rotateButton.onclick = ()=>{mode="rotate";refresh();};
  resetButton.onclick = ()=>{
    posedFrames.delete(lastFrame);
    status.textContent="已恢复";
    drawStage();
  };
  function cursorPoint(event,center){
    const rect=canvas.getBoundingClientRect();
    const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),center);
    ray.setFromCamera(ndc,camera);
    return ray.ray.intersectPlane(plane,new THREE.Vector3());
  }
  function begin(event,name){
    if(event.button!==0||!bones[name])return;
    event.preventDefault();
    event.stopPropagation();
    selected=name;
    refresh();
    parent.postMessage({type:"poseDrag",from:options.get("slot")},location.origin);
    // A base pose can be drawn as a temporary overlay. Capture what the user sees.
    const displayed=baseline[name];
    if(!displayed)return;
    const center=new THREE.Vector3().fromArray(displayed.worldPosition), cursor=cursorPoint(event,center);
    if(!cursor)return;
    const startPose=baseline;
    drag={name,center,cursor,x:event.clientX,y:event.clientY,startPose,frame:lastFrame,
      rotate:mode==="rotate"||event.shiftKey||name==="Head",previous:new Map(posedFrames.get(lastFrame) || [])};
    event.currentTarget.setPointerCapture(event.pointerId);
    status.textContent="";
  }
  overlay.addEventListener("pointermove",event=>{
    if(!drag||drag.frame!==lastFrame)return;
    const {name,center,cursor,x,y,startPose,previous}=drag;
    for(const [key,data] of Object.entries(startPose)){
      bones[key].position.fromArray(data.position);
      bones[key].quaternion.fromArray(data.quaternion);
    }
    rig.updateMatrixWorld(true);
    const bone=bones[name];
    const changed=[];
    if(drag.rotate){
      const qx=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),(event.clientY-y)*.012);
      const qy=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),(event.clientX-x)*.012);
      worldRotate(bone,qy.multiply(qx).multiply(rotation(bone)));
      changed.push(name);
    }else{
      const point=cursorPoint(event,center);
      if(!point)return;
      const target=delta(point,cursor).add(center);
      if(name==="Hips"){
        bone.position.copy(bone.parent.worldToLocal(target.clone()));
        changed.push(name);
      }else if(chains[name]){
        const [upper,lower,end]=chains[name];
        solveChain(chains[name],name===end?target:position(bones[end]),name===lower?target:position(bones[lower]));
        changed.push(upper,lower);
      }else{
        // Pull the next segment around the joint as an FK handle.
        const child=bone.children.find(n=>n.isBone);
        if(child)aimNext(bone,position(child).add(delta(target,center)));
        changed.push(name);
      }
    }
    rig.updateMatrixWorld(true);
    const edit = new Map(previous);
    for(const key of changed)edit.set(key,own(bones[key]));
    posedFrames.set(lastFrame,edit);
    drawStage();
  });
  for(const eventName of ["pointerup","pointercancel","lostpointercapture"])
    overlay.addEventListener(eventName,()=>{drag=null;});

  function readBones(){
    const next=window.AIBATripo?.root;
    if(!next||next===rig)return;
    rig=next; bones={};
    rig.traverse(node=>{
      if(!node.isBone)return;
      const name=node.name.replace(/^mixamorig:?/,"");
      if(joints[name])bones[name]=node;
    });
  }

  function draw(nextFrame){
    readBones();
    if(!rig||!rig.visible)return ()=>{};
    const edits=posedFrames.get(nextFrame);
    lastFrame=nextFrame;
    const held=pBall.visible&&pBall.parent?.name==="ballGrip";
    const rightHand=bones.RightHand;
    let oldBall, localBall;
    if(held&&rightHand&&edits?.size){
      localBall=rightHand.worldToLocal(position(pBall));
      oldBall=pBall.position.clone();
    }
    if(edits?.size){
      for(const [name,pose] of edits){
        const b=bones[name];
        if(!b)continue;
        b.position.fromArray(pose.position);
        b.quaternion.fromArray(pose.quaternion);
      }
      rig.updateMatrixWorld(true);
    }
    if(oldBall){
      pBall.position.copy(pBall.parent.worldToLocal(rightHand.localToWorld(localBall)));
      pBall.updateMatrixWorld(true);
    }
    if(visible){
      for(const [name,marker] of Object.entries(markers)){
        const bone=bones[name];
        marker.hidden=!bone;
        if(!bone)continue;
        const p=position(bone).project(camera);
        marker.style.left=(50+p.x*50)+"%";
        marker.style.top=(50-p.y*50)+"%";
      }
      baseline=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{
        ...own(b),worldPosition:position(b).toArray(),worldQuaternion:rotation(b).toArray()
      }]));
      shotBall=held?position(pBall).toArray():flyingBall.visible?position(flyingBall).toArray():null;
    }
    return ()=>{if(oldBall)pBall.position.copy(oldBall);};
  }
  copyButton.onclick = async ()=>{
    const data=JSON.stringify({schema:"aiba-game-joint-pose/1",player:playerId,posePreset:Shot.posePreset,frame:lastFrame,time:lastFrame*MODEL_STEP,
      phase:Shot.last?.s.phase,ball:shotBall,joints:baseline},null,2);
    try{
      await navigator.clipboard.writeText(data);
      status.textContent="已复制";
    }catch(e){
      const link=document.createElement("a"), url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
      link.href=url;link.download=playerId+"-frame-"+lastFrame+".json";link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent="已下载";
    }
  };
  refresh();
  return {draw,setVisible(v){if(visible===v)return; visible=v;overlay.hidden=!v;drawStage();}};
})();
window.Shot.setJointEdit = value => gameJoints.setVisible(value);
