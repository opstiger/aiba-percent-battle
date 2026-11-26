/* Preview-only choreography. Keep the ball and release clock on the game path. */
const curryPreviewPose = (() => {
  const legs = ["RightUpLeg","RightLeg","RightFoot"];
  const leftLeg = ["LeftUpLeg","LeftLeg","LeftFoot"];
  const guide = ["LeftArm","LeftForeArm","LeftHand"];
  const fixed = new Set([...legs,...guide]);
  const V = value => new THREE.Vector3().fromArray(value);
  const axisX = new THREE.Vector3(1,0,0);
  const axisZ = new THREE.Vector3(0,0,1);
  const axisY = new THREE.Vector3(0,1,0);
  const Q = value => new THREE.Quaternion().fromArray(value).normalize();
  const smooth = t => {const x=clamp(t,0,1);return x*x*(3-2*x);};
  const volume = (frame,start,end) => smooth((frame-start)/(end-start));
  const identity=new THREE.Quaternion();
  const mixed=new THREE.Quaternion();
  let config, bones={}, rig, anchor=73, corrections={}, authored={}, relaxed={};
  let shoeMesh, shoeVertices=[];
  const shoePoint=new THREE.Vector3();
  function setAnchor(next){
    anchor=next===78?78:73;
    corrections=Object.fromEntries(config.editedJoints.filter(name=>!fixed.has(name)).map(name=>[
      name,Q(config.baseline[anchor][name]).invert().multiply(authored[name])
    ]));
  }
  function readRig(){
    if(rig===AIBATripo.root)return;
    rig=AIBATripo.root;
    bones={};
    rig.traverse(b=>{
      if(b.isBone)bones[b.name.replace(/^mixamorig:?/,"")]=b;
    });
    shoeMesh=AIBATripo.mesh;
    shoeVertices=[];
    if(!shoeMesh)return;
    const skinned=shoeMesh.skeleton.bones.map(b=>/(?:Left|Right)(?:Foot|Toe)/.test(b.name));
    const {skinIndex,skinWeight}=shoeMesh.geometry.attributes;
    for(let i=0;i<skinIndex.count;i++){
      let influence=0;
      for(let j=i*4;j<i*4+4;j++)if(skinned[skinIndex.array[j]])influence+=skinWeight.array[j];
      if(influence>.7)shoeVertices.push(i);
    }
  }
  function soleHeight(){
    if(!shoeVertices.length)return 0;
    shoeMesh.updateMatrixWorld(true);
    shoeMesh.skeleton.update();
    let y=Infinity;
    for(const i of shoeVertices)y=Math.min(y,shoeMesh.boneTransform(i,shoePoint).applyMatrix4(shoeMesh.matrixWorld).y);
    return y;
  }
  const position = bone => bone.getWorldPosition(new THREE.Vector3());
  const orientation = bone => bone.getWorldQuaternion(new THREE.Quaternion());
  function putWorldOrientation(bone, target){
    bone.quaternion.copy(orientation(bone.parent).invert().multiply(target));
    bone.updateWorldMatrix(true,true);
  }
  function aimBone(bone, child, target){
    const from=position(child).sub(position(bone)).normalize();
    const to=target.clone().sub(position(bone)).normalize();
    const turn=new THREE.Quaternion().setFromUnitVectors(from,to);
    putWorldOrientation(bone,turn.multiply(orientation(bone)));
  }
  // Reach for a wrist or ankle target without changing either bone length.
  function solveToward(chain,goal,saved,poleGoal=null,tipOrientation=null){
    const [upperBone,lowerBone,tipBone]=chain.map(name=>bones[name]);
    const tip=position(tipBone), tipFacing=tipOrientation||orientation(tipBone);
    const root=position(upperBone), middle=position(lowerBone);
    const upper=root.distanceTo(middle), lower=middle.distanceTo(tip);
    const line=goal.clone().sub(root);
    const distance=clamp(line.length(),Math.abs(upper-lower)+.001,upper+lower-.001);
    line.normalize();
    const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    const pole=(poleGoal||middle).sub(root);
    pole.addScaledVector(line,-pole.dot(line));
    if(pole.lengthSq()<1e-8) {
      pole.set(0,1,0);
      if(Math.abs(line.y)>.98)pole.set(1,0,0);
      pole.addScaledVector(line,-pole.dot(line));
    }
    const knee=root.clone().addScaledVector(line,along).addScaledVector(pole.normalize(),height);
    for(const bone of [upperBone,lowerBone,tipBone])if(!saved.has(bone))saved.set(bone,bone.quaternion.clone());
    aimBone(upperBone,lowerBone,knee);
    aimBone(lowerBone,tipBone,root.addScaledVector(line,distance));
    putWorldOrientation(tipBone,tipFacing);
  }
  function capFoot(saved){
    const hip=position(bones.Hips), goal=position(bones.RightFoot);
    const limit=hip.z+config.rightFootMaxForward;
    if(goal.z<=limit+.0001)return;
    goal.z=limit;
    solveToward(legs,goal,saved);
  }
  function worldYaw(q){
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(q);
    return Math.atan2(forward.x,forward.z);
  }
  function setYaw(name,yaw,weight,saved){
    const bone=bones[name],q=orientation(bone);
    const angle=yaw-worldYaw(q);
    const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
    if(!saved.has(bone))saved.set(bone,bone.quaternion.clone());
    putWorldOrientation(bone,q.premultiply(new THREE.Quaternion().setFromAxisAngle(axisY,turn*weight)));
  }
  function carriedHand(side,data,k){
    const fore=position(bones[side+"Hand"]).sub(position(bones[side+"ForeArm"])).normalize();
    const transported=ref=>new THREE.Quaternion().setFromUnitVectors(V(ref.fore),fore).multiply(Q(ref.q));
    return transported(data.from).slerp(transported(data.to),k);
  }
  function draw(frame){
    Shot.poseFrame=null;
    if(!config||!AIBATripo.root?.visible)return null;
    readRig();
    const charge=config.keys?.charge, landing=config.keys?.landing;
    const recovery=config.continuity?.recovery;
    if(frame<(charge?.start??58)||frame>=(recovery?.end??Math.max(120,landing?.end||0)))return null;
    const saved=new Map(),savedPositions=new Map();
    const chargeActive=charge&&frame>charge.start&&frame<charge.end;
    const held=pBall.visible&&pBall.parent?.name==="ballGrip";
    const originalBall=chargeActive&&held?pBall.position.clone():null;
    const ballOnHand=originalBall?bones.RightHand.worldToLocal(position(pBall)):null;
    function update(name,q,weight=1){
      const b=bones[name];
      if(!b||!weight)return;
      if(!saved.has(b))saved.set(b,b.quaternion.clone());
      b.quaternion.slerp(q,weight);
    }

    // Replace the old airborne leg kick as takeoff starts. Fade into the landing,
    // then keep the forward limit active until the original stance is back under it.
    const legWeight=volume(frame,58,64)*(1-volume(frame,80,90));
    for(const name of legs)update(name,authored[name],legWeight);

    // Once the ball leaves, shoulder rotation carries the guide arm down.
    // The elbow keeps its mild bend instead of chasing a wrist target.
    const guideEntry=volume(frame,63,69);
    for(const name of guide)update(name,authored[name],guideEntry);

    const entry=volume(frame,69,anchor);
    for(const [name,delta] of Object.entries(corrections)){
      const weight=entry*(1-volume(frame,anchor,name==="Hips"?90:102));
      if(!weight)continue;
      if(frame===anchor)update(name,authored[name]);
      else update(name,bones[name].quaternion.clone().multiply(mixed.copy(identity).slerp(delta,weight)));
    }
    rig.updateMatrixWorld(true);
    if(frame>=60&&frame<=113)capFoot(saved);
    if(frame>=69&&frame<=73&&!(frame===73&&anchor===73)){
      solveToward(guide,position(bones.LeftArm).add(V(config.guideAtRelease)),saved);
    }

    function applyKey(key){
      if(!key||frame>=key.end)return;
      for(const [name,pose] of Object.entries(key.joints)){
        const isLower=name==="Hips"||/(UpLeg|Leg|Foot)$/.test(name);
        const start=isLower?key.start:(key.upperStart??key.start);
        const weight=volume(frame,start,key.frame)*(1-volume(frame,key.frame,key.end));
        if(!weight)continue;
        const bone=bones[name];
        if(!bone)continue;
        if(pose.position){
          if(!savedPositions.has(bone))savedPositions.set(bone,bone.position.clone());
          if(frame===key.frame)bone.position.fromArray(pose.position);
          else bone.position.addScaledVector(new THREE.Vector3().fromArray(pose.positionDelta),weight);
        }
        if(pose.quaternion){
          const target=frame===key.frame ? Q(pose.quaternion) :
            bone.quaternion.clone().multiply(mixed.copy(identity).slerp(Q(pose.rotationDelta),weight));
          update(name,target);
        }
      }
    }
    applyKey(charge);
    applyKey(landing);
    const continuity=config.continuity;
    if(continuity&&frame>=99&&frame<126){
      const k=volume(frame,99,126);
      for(const [name,[from,to]] of Object.entries(continuity.rightArmOut)){
        update(name,Q(from).slerp(Q(to),k));
      }
    }
    rig.updateMatrixWorld(true);

    if(continuity&&frame>=continuity.torso.at&&frame<continuity.torso.end){
      const {hips,chest,hold,end}=continuity.torso;
      const feet=[leftLeg,legs].map(chain=>{
        const foot=bones[chain[2]];
        return {chain,at:position(foot),q:orientation(foot),knee:position(bones[chain[1]])};
      });
      // Carry the turned stance into landing, then unwind it once.
      const turn=1-volume(frame,hold,recovery?.square??end);
      setYaw("Hips",hips*turn,1,saved);
      setYaw("Spine2",chest*turn,1,saved);
      for(const foot of feet)solveToward(foot.chain,foot.at,saved,foot.knee,foot.q);
      if(frame<=113)capFoot(saved);
    }
    if(recovery&&frame>73){
      const atRest=volume(frame,99,126);
      const lowering=volume(frame,73,102);
      const arm=authored.LeftArm.clone().slerp(Q(landing.joints.LeftArm.quaternion),lowering)
        .slerp(relaxed.LeftArm,atRest);
      update("LeftArm",arm);
      const forearm=authored.LeftForeArm.clone().slerp(relaxed.LeftForeArm,volume(frame,90,126));
      update("LeftForeArm",forearm);
      update("LeftHand",authored.LeftHand.clone().slerp(relaxed.LeftHand,volume(frame,78,126)));
    }
    if(continuity&&frame>83&&frame<126){
      const bone=bones.RightHand;
      if(!saved.has(bone))saved.set(bone,bone.quaternion.clone());
      const following=carriedHand("Right",continuity.hands.Right,volume(frame,89,126));
      putWorldOrientation(bone,orientation(bone).slerp(following,volume(frame,83,87)));
    }
    if(recovery&&frame>recovery.swingStart){
      const swing=volume(frame,recovery.swingStart,recovery.swingPeak)*(1-volume(frame,recovery.swingPeak,recovery.end));
      for(const side of ["Left","Right"]){
        const name=side+"Arm",arm=bones[name];
        const back=new THREE.Quaternion().setFromAxisAngle(axisX,recovery.swingAngle*swing);
        const chest=orientation(bones.Spine2);
        const target=chest.clone().multiply(back).multiply(chest.invert()).multiply(orientation(arm));
        if(!saved.has(arm))saved.set(arm,arm.quaternion.clone());
        putWorldOrientation(arm,target);
        const elbow=side+"ForeArm";
        const flex=new THREE.Quaternion().setFromAxisAngle(axisZ,(side==="Left"?1:-1)*recovery.elbowAngle*swing);
        update(elbow,bones[elbow].quaternion.clone().multiply(flex));
      }
    }
    if(continuity&&frame>=58&&frame<(recovery?.end??126)){
      const at=position(bones.Head);
      const aim=Math.atan2(HOOP.x-at.x,HOOP.z-at.z);
      setYaw("Head",aim,volume(frame,58,64),saved);
    }
    if(recovery&&frame>recovery.driftStart){
      const hips=bones.Hips, world=position(hips);
      const planted=volume(frame,recovery.driftStart,recovery.plant);
      const settled=volume(frame,recovery.plant,recovery.feet.Right.end);
      const tail=1-volume(frame,recovery.feet.Right.end,recovery.end);
      const feet=[["Left",leftLeg],["Right",legs]].map(([side,chain])=>{
        const ankle=bones[chain[2]], data=recovery.feet[side];
        const step=volume(frame,data.start,data.end);
        const air=Math.sin(Math.PI*step)**2;
        const goal=V(data.planted).lerp(V(data.rest),step);
        goal.y+=data.lift*air;
        const plant=volume(frame,recovery.driftStart,data.plant)*tail;
        const at=position(ankle).lerp(goal,plant);
        const facing=orientation(ankle).slerp(Q(data.facing),plant);
        return {chain,at,facing,side};
      });
      if(!savedPositions.has(hips))savedPositions.set(hips,hips.position.clone());
      const travel=volume(frame,recovery.travelStart,recovery.travelEnd);
      const transfer=volume(frame,recovery.plant,recovery.feet.Left.start+1)
        -2*volume(frame,recovery.feet.Left.start+2,recovery.feet.Right.start+1)
        +volume(frame,recovery.feet.Right.start+3,recovery.feet.Right.end);
      world.z-=recovery.drift*planted*(1-travel);
      world.x=(world.x+recovery.sway*transfer*planted)*tail;
      world.y=THREE.MathUtils.lerp(world.y,recovery.stanceHeight,planted*(1-settled));
      hips.position.copy(hips.parent.worldToLocal(world));
      rig.updateMatrixWorld(true);
      for(const foot of feet){
        const knee=position(bones[foot.chain[1]]);
        const pole=knee.clone().lerp(foot.at.clone().add(V([foot.side==="Left"?-.045:.045,.39,.14])),planted);
        solveToward(foot.chain,foot.at,saved,pole,foot.facing);
      }
    }
    const contact=landing&&frame>landing.start?
      volume(frame,landing.start,landing.start+5)*(1-volume(frame,(recovery?.end??landing.end)-5,recovery?.end??landing.end)):0;
    const sole=(contact||chargeActive)?soleHeight():0;
    const chargeContact=chargeActive?volume(frame,charge.start,charge.frame)*(1-volume(frame,charge.frame,charge.end)):0;
    const floorOffset=contact?-sole*contact:Math.max(0,-sole)*chargeContact;
    if(Math.abs(floorOffset)>.0002){
      const hips=bones.Hips;
      if(!savedPositions.has(hips))savedPositions.set(hips,hips.position.clone());
      const world=position(hips);world.y+=floorOffset;
      hips.position.copy(hips.parent.worldToLocal(world));
      rig.updateMatrixWorld(true);
    }
    if(ballOnHand){
      const world=frame===charge.frame&&charge.ball?new THREE.Vector3().fromArray(charge.ball).add(new THREE.Vector3(0,floorOffset,0)):
        bones.RightHand.localToWorld(ballOnHand);
      pBall.position.copy(pBall.parent.worldToLocal(world));
      pBall.updateMatrixWorld(true);
    }
    const hip=position(bones.Hips),rightFoot=position(bones.RightFoot),leftShoulder=position(bones.LeftArm),leftWrist=position(bones.LeftHand);
    Shot.poseFrame={frame,joints:Object.fromEntries([...saved].map(([b])=>[b.name,b.quaternion.toArray()])),
      rightFootForward:rightFoot.z-hip.z,rightFootY:rightFoot.y,
      leftWristOffset:leftWrist.sub(leftShoulder).toArray()};
    return ()=>{
      for(const [bone,q] of saved)bone.quaternion.copy(q);
      for(const [bone,p] of savedPositions)bone.position.copy(p);
      if(saved.size||savedPositions.size)rig.updateMatrixWorld(true);
      if(originalBall)pBall.position.copy(originalBall);
    };
  }
  return {
    draw,
    init(value){
      config=value;
      authored=Object.fromEntries(config.editedJoints.map(name=>[name,Q(config.joints[name].quaternion)]));
      relaxed=Object.fromEntries(guide.map(name=>[name,Q(config.recoveryGuide[name])]));
      setAnchor(73);
      Shot.setPoseAnchor=next=>{setAnchor(next);drawStage();};
    }
  };
})();
async function startTunerWithCurryPose(enabled){
  try{
    if(enabled){
      const response=await fetch("curry-frame73.json?v=shoulder-step1");
      if(!response.ok)throw new Error("库里动作加载失败");
      curryPreviewPose.init(await response.json());
      Shot.posePreset="curry-latest";
    }
    startShotTuner();
  }catch(error){
    document.body.textContent=error.message;
    parent.postMessage({type:"shotError",from:options.get("slot")},location.origin);
  }
}
