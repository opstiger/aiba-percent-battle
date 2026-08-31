/* ---------------- replay system ---------------- */
const REPLAY_PHOTO_DUR=0.32;
const rep={on:false,idx:0,t:0,clip:null,ghost:null,gBlob:null,scoredFx:false};
function startReplay(){
  hidePanel();rep.on=true;rep.idx=0;G.state="replay";
  // 回放先给一个投篮出手合影,所以无论比赛视角如何都显示角色。
  player.g.visible=true;
  passer.g.visible=true;
  $("lbT").style.height="11vh";$("lbB").style.height="11vh";
  $("repUI").style.display="block";
  if(!rep.ghost){
    rep.ghost=new THREE.Mesh(ballGeo,matBall);scene.add(rep.ghost);
    rep.gBlob=new THREE.Mesh(blobGeo,blobMat.clone());rep.gBlob.rotation.x=-Math.PI/2;scene.add(rep.gBlob);
  }
  startClip();
}
function startClip(){
  const h=G.highlights[rep.idx];
  rep.clip=h;rep.t=0;rep.scoredFx=false;
  rep.ghost.visible=true;rep.gBlob.visible=true;
  rep.ghost.material=h.deep?matDeep:(h.money?matGold:matBall);
  rep.end=Math.min(h.rec[h.rec.length-1][0],h.tf+0.4);
  // random broadcast cameras — all positioned in front of the backboard (z > -8) so nothing blocks the view
  const s=h.shooterPos||V3(h.startPos.x,0,h.startPos.z);
  const release=h.p0||h.startPos;
  const dir=HOOP.clone().sub(s);dir.y=0;dir.normalize();
  const perp=V3(dir.z,0,-dir.x);
  const mid=s.clone().lerp(HOOP,0.45);
  const side=Math.random()<0.5?1:-1;
  const photoPos=s.clone().addScaledVector(dir,-2.55).addScaledVector(perp,side*1.65).setY(1.85);
  const photoLook=s.clone().addScaledVector(dir,0.22).setY(1.42).lerp(release.clone(),0.52);
  rep.photoCam={p:photoPos,look:photoLook,n:"出手合影"};
  let p1=mid.clone().addScaledVector(perp,7.5).setY(2.6);
  if(Math.abs(p1.x)>13)p1=mid.clone().addScaledVector(perp,-7.5).setY(2.6);
  const A=[
    {p:p1,n:"侧翼跟拍"},
    {p:s.clone().addScaledVector(dir,-3.2).add(V3(side*1.6,0,0)).setY(3.4),n:"高位跟拍"},
    {p:mid.clone().addScaledVector(perp,4.5*Math.sign(p1.x-mid.x||1)).setY(0.7),n:"地板低机位"}];
  const B=[
    {p:V3(HOOP.x+side*2.1,3.7,HOOP.z+2.7),n:"篮筐特写"},
    {p:V3(side*6.3,2.1,-7.0),n:"底线机位"},
    {p:V3(HOOP.x-side*1.6,4.6,HOOP.z+3.4),n:"高空吊臂"}];
  rep.camA=A[(Math.random()*A.length)|0];
  rep.camB=B[(Math.random()*B.length)|0];
  toast(h.deep?"⚡ 深远三分回放":(h.timeLeft<3?"⏱ 压哨球回放":"💰 关键球回放"),"#ffd23f");
}
function updReplay(dt){
  const h=rep.clip;if(!h)return;
  rep.t+=dt*0.42; // slow-mo
  const photo=rep.t<REPLAY_PHOTO_DUR;
  const t=Math.min(Math.max(0,rep.t-REPLAY_PHOTO_DUR),rep.end);
  // 同步角色姿势:按回放时间映射投篮相位
  if(player.g.visible){
    const ph=photo?0.98:Math.min(1.08,0.92+t/Math.max(0.01,h.tf)*0.18);
    const c=shotCurves(ph);
    const y=poseGuy(player,c,0)+Math.max(0,c.jmp*0.55-c.over*0.55);
    applyHandFollowThroughPose(player,ease01((ph-.94)/.12));
    if(typeof applyShotPoseNoise==="function")
      applyShotPoseNoise(player,Math.min(1,Math.max(0,ph)),h.poseNoiseKey!=null?h.poseNoiseKey:rep.idx);
    const s=h.shooterPos||V3(h.startPos.x,0,h.startPos.z);
    player.g.position.set(s.x,y,s.z);
    player.g.rotation.y=h.shooterFace!=null?h.shooterFace:faceTo(s,HOOP);
    passer.g.visible=false; // 回放期间隐藏传球者避免挡镜头
  }
  // interp position
  let j=1;while(j<h.rec.length&&h.rec[j][0]<t)j++;
  const a=h.rec[Math.max(0,j-1)],b2=h.rec[Math.min(j,h.rec.length-1)];
  const k=b2[0]>a[0]?(t-a[0])/(b2[0]-a[0]):0;
  if(h.p0&&(photo||t<=h.rec[0][0]))rep.ghost.position.copy(h.p0);
  else rep.ghost.position.set(a[1]+(b2[1]-a[1])*k,a[2]+(b2[2]-a[2])*k,a[3]+(b2[3]-a[3])*k);
  rep.ghost.rotation.x-=dt*4;
  rep.gBlob.position.set(rep.ghost.position.x,0.02,rep.ghost.position.z);
  const cut=h.tf*0.6;
  if(photo){
    rig.pos.copy(rep.photoCam.p);rig.pos.y+=Math.sin(rep.t*8)*0.03;
    rig.look.copy(rep.photoCam.look);
    window.AIBASetIcon("repCam","video","机位 0 · "+rep.photoCam.n);
  }else if(t<cut){
    rig.pos.copy(rep.camA.p);rig.pos.x+=Math.sin(rep.t*0.5)*0.5;rig.pos.y+=Math.sin(rep.t*0.7)*0.15;
    window.AIBASetIcon("repCam","video","机位 1 · "+rep.camA.n);
  }else{
    rig.pos.copy(rep.camB.p);rig.pos.y+=Math.sin(rep.t*0.6)*0.12;
    window.AIBASetIcon("repCam","video","机位 2 · "+rep.camB.n);
  }
  if(!photo)rig.look.copy(rep.ghost.position);
  if(!rep.scoredFx&&t>=h.tf*0.98){
    rep.scoredFx=true;pulseNet(1,rep.ball&&rep.ball.netDir);sSwish();cheerSound(true);G.cheer=1;
  }
  if(rep.t>REPLAY_PHOTO_DUR+rep.end+0.35){
    rep.idx++;
    if(rep.idx<G.highlights.length)startClip();
    else finishReplay();
  }
}
function finishReplay(){
  rep.on=false;
  if(rep.ghost){rep.ghost.visible=false;rep.gBlob.visible=false;}
  player.g.visible=false;passer.g.visible=false; // applyCamMode 重置
  $("lbT").style.height="0";$("lbB").style.height="0";
  $("repUI").style.display="none";
  afterRound();
}
function skipReplay(){if(rep.on)finishReplay();}

/* ---------------- AI sim & bracket ---------------- */
function aiProb(r){return clamp(0.36+(r-85)*0.02+DIFFS[G.diff].ai,0.2,0.78);}

window.AIBA.runtime.register("presentation:replay",Object.freeze({
  rep,startReplay,startClip,updReplay,finishReplay,skipReplay,aiProb
}));
