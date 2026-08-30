const PREGAME={
  on:false,t:0,idx:0,dur:0,shots:[],actors:[],snaps:[],prevState:null,cb:null,chalk:null,poseCache:new Map()
};
const PREGAME_ACTIONS=["shoot","stretch","dunk","chalk","hang","finger","huddle","wave","pump"];
const PREGAME_CAMS=["orbit","push","low","overhead","freeze","follow","pan","pull"];
const pregamePick=a=>a[(Math.random()*a.length)|0];
const PREGAME_LABELS={
  shoot:"投篮热身",stretch:"拉伸热身",dunk:"空切扣篮",chalk:"撒镁粉",hang:"挂框定格",
  finger:"对镜头摇手指",huddle:"拥抱打气",wave:"向镜头致意",pump:"赛前加油"
};
function pregameBallFor(guy){
  if(guy===player)return pBall;
  if(guy===passer)return passerBall;
  return guy&&guy.ball?guy.ball:null;
}
function pregameRotSnap(list){return list?list.map(x=>x.rotation.clone()):[];}
function pregameRotRestore(list,rots){if(!list||!rots)return;list.forEach((x,i)=>{if(rots[i])x.rotation.copy(rots[i]);});}
function pregameSnapGuy(guy){
  const ball=pregameBallFor(guy);
  return {guy,pos:guy.g.position.clone(),rot:guy.g.rotation.clone(),visible:guy.g.visible,
    active:guy.active,celeb:guy._celeb||null,ballVisible:ball?ball.visible:false,
    ballPos:ball?ball.position.clone():null,ballMat:ball?ball.material:null,
    arms:pregameRotSnap(guy.arms),elbows:pregameRotSnap(guy.elbows),legs:pregameRotSnap(guy.legs),
    knees:pregameRotSnap(guy.knees),ankles:pregameRotSnap(guy.ankles),shoes:pregameRotSnap(guy.shoes)};
}
function pregameRestoreGuy(s){
  const guy=s.guy,ball=pregameBallFor(guy);
  guy.g.position.copy(s.pos);guy.g.rotation.copy(s.rot);guy.g.visible=s.visible;guy._celeb=s.celeb;
  if(s.active!==undefined)guy.active=s.active;
  if(ball){ball.visible=s.ballVisible;if(s.ballPos)ball.position.copy(s.ballPos);if(s.ballMat)ball.material=s.ballMat;}
  pregameRotRestore(guy.arms,s.arms);pregameRotRestore(guy.elbows,s.elbows);pregameRotRestore(guy.legs,s.legs);
  pregameRotRestore(guy.knees,s.knees);pregameRotRestore(guy.ankles,s.ankles);pregameRotRestore(guy.shoes,s.shoes);
}
function pregameNeutral(guy){
  guy.g.rotation.x=0;guy.g.position.y=0;
  /* 无球站定也使用主比赛的自然下垂基线：上臂接近垂直，肘部只留约 5° 松弛弯曲。
     预热的投篮/挥手动作随后会显式覆盖它，避免把接球姿势带进日常站姿。 */
  guy.arms.forEach(a=>a.rotation.set(-.03,0,0));
  guy.elbows.forEach(e=>e.rotation.set(-Math.PI/36,0,0));
  (guy.handRoots||[]).forEach((hand,index)=>{hand.rotation.set(0,index===0?-Math.PI*.5:Math.PI*.5,0);});
  guy.legs.forEach(l=>l.rotation.set(0,0,0));
  guy.knees.forEach(k=>k.rotation.set(0,0,0));
  guy.ankles.forEach(a=>a.rotation.set(0,0,0));
  guy.shoes.forEach(s=>s.rotation.set(0,0,0));
}
function pregamePoseSnapshot(guy){
  return {
    pos:guy.g.position.clone(),rot:guy.g.rotation.clone(),
    arms:pregameRotSnap(guy.arms),elbows:pregameRotSnap(guy.elbows),legs:pregameRotSnap(guy.legs),
    knees:pregameRotSnap(guy.knees),ankles:pregameRotSnap(guy.ankles),shoes:pregameRotSnap(guy.shoes)
  };
}
function pregameAngleLerp(a,b,k){
  let d=b-a;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return a+d*k;
}
function pregameBlendRotations(list,from,k){
  list.forEach((part,i)=>{
    const prev=from[i];if(!prev)return;
    part.rotation.x=prev.x+(part.rotation.x-prev.x)*k;
    part.rotation.y=prev.y+(part.rotation.y-prev.y)*k;
    part.rotation.z=prev.z+(part.rotation.z-prev.z)*k;
  });
}
function pregameSmoothPose(guy,dt){
  if(!guy||!guy.g||!guy.g.position||!guy.g.rotation)return;
  const target=pregamePoseSnapshot(guy),prev=PREGAME.poseCache.get(guy);
  if(!prev){PREGAME.poseCache.set(guy,target);return;}
  const k=1-Math.exp(-Math.max(0,dt)*18);
  guy.g.position.lerpVectors(prev.pos,target.pos,k);
  guy.g.rotation.x=prev.rot.x+(target.rot.x-prev.rot.x)*k;
  guy.g.rotation.y=pregameAngleLerp(prev.rot.y,target.rot.y,k);
  guy.g.rotation.z=prev.rot.z+(target.rot.z-prev.rot.z)*k;
  pregameBlendRotations(guy.arms,prev.arms,k);pregameBlendRotations(guy.elbows,prev.elbows,k);
  pregameBlendRotations(guy.legs,prev.legs,k);pregameBlendRotations(guy.knees,prev.knees,k);
  pregameBlendRotations(guy.ankles,prev.ankles,k);pregameBlendRotations(guy.shoes,prev.shoes,k);
  PREGAME.poseCache.set(guy,pregamePoseSnapshot(guy));
}
function pregameClampPos(v){
  v.x=clamp(v.x,-COURT.halfWidth+0.9,COURT.halfWidth-0.9);
  v.z=clamp(v.z,COURT.nearBaseline+1.0,COURT.playMaxZ-0.7);
  return v;
}
function pregameSideBase(heroPos,side){
  const x=heroPos.x+(heroPos.x>0?-2.8:2.8)*(side||1);
  const z=heroPos.z+1.15;
  return pregameClampPos(V3(x,0,z));
}
function pregameBuildActors(opts){
  const heroName=G.myStar&&G.myStar.n?G.myStar.n:"YOU";
  const actors=[{guy:player,name:heroName,role:"hero",base:P.pos.clone(),face:P.face}];
  let other=null;
  if(opts.mode==="battle"&&G.battleOpp&&rivals[0]){
    other={guy:rivals[0],name:G.battleOpp.n||"对手",role:"opponent"};
  }else{
    const rv=rivals.find(x=>x.active);
    if(rv&&rv!==actors[0].guy)other={guy:rv,name:rv.o&&rv.o.n?rv.o.n:"挑战者",role:"opponent"};
    else if(passer)other={guy:passer,name:"训练搭档",role:"teammate"};
  }
  if(other){
    other.base=pregameSideBase(actors[0].base,1);
    other.face=faceTo(other.base,HOOP);
    if(other.guy.active!==undefined)other.guy.active=true;
    actors.push(other);
  }
  actors.forEach(a=>{a.base=pregameClampPos(a.base.clone());a.face=faceTo(a.base,HOOP);});
  return actors;
}
function pregameBuildShots(opts){
  const shots=[],actors=PREGAME.actors;
  const wanted=opts.mode==="battle"?5.8:(opts.mode==="rackrush"?5.0:5.2);
  let t=0,i=0,lastAction="";
  while(t<wanted){
    const actor=actors[i%actors.length]||actors[0];
    let action;
    if(i===0)action="shoot";
    else if(i===1)action=pregamePick(["chalk","hang","dunk"]);
    else action=pregamePick(PREGAME_ACTIONS);
    if(action===lastAction)action=pregamePick(PREGAME_ACTIONS);
    if(action==="huddle"&&actors.length<2)action="pump";
    if((action==="dunk"||action==="hang")&&opts.mode==="contest"&&Math.random()<0.45)action="shoot";
    const dur=rnd(1.15,1.65),cam=pregamePick(PREGAME_CAMS);
    shots.push({start:t,dur,actor,action,cam,side:Math.random()<0.5?-1:1,seed:rnd(0,Math.PI*2),group:action==="huddle"});
    t+=dur;i++;lastAction=action;
  }
  return shots;
}
function pregameCaption(seg){
  const el=$("vsBanner"),mode=G.mode==="battle"?"PERCENT BATTLE":(G.mode==="rackrush"?"RACK RUSH":"3PT CONTEST");
  const name=seg.group?"TEAM":seg.actor.name;
  el.innerHTML=`<span style="font-size:11px;color:#7feaff;letter-spacing:2px">${mode} / PREGAME</span><br>${name} · ${PREGAME_LABELS[seg.action]||"赛前热身"}`;
  el.style.display="block";
}
function pregamePlace(actor,pos,face){
  const guy=actor.guy;
  guy.g.visible=true;guy.g.position.set(pos.x,0,pos.z);guy.g.rotation.set(0,face,0);
}
function pregameActionBase(actor,action,u){
  const base=actor.base.clone();
  if(action==="huddle"&&PREGAME.actors.length>1){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other){
      const mid=actor.base.clone().lerp(other.base,0.5);
      base.copy(mid);base.x+=(actor.role==="hero"?-0.42:0.42);
    }
  }
  if(action==="dunk"||action==="hang"){
    const rimSpot=V3(action==="hang"?0:(actor.role==="opponent"?0.16:-0.16),0,HOOP.z+(action==="hang"?0.34:0.52));
    const approachEnd=action==="hang"?.34:.44;
    base.lerp(rimSpot,ease01(clamp(u/approachEnd,0,1)));
  }
  return pregameClampPos(base);
}
function pregameIdle(actor,t){
  const guy=actor.guy,ball=pregameBallFor(guy);
  pregamePlace(actor,actor.base,actor.face);pregameNeutral(guy);
  guy.g.position.y=Math.abs(Math.sin(t*3.1+(actor.role==="hero"?0:1.4)))*0.025;
  guy.arms[0].rotation.x=-0.48+Math.sin(t*2.5)*0.12;
  guy.arms[1].rotation.x=-0.48-Math.sin(t*2.3)*0.12;
  if(ball)ball.visible=false;
}
function pregameAnimate(actor,action,u,seg){
  const guy=actor.guy,ball=pregameBallFor(guy),t=PREGAME.t+seg.seed;
  const base=pregameActionBase(actor,action,u);
  let face=faceTo(base,HOOP);
  if(action==="finger"||action==="wave")face=faceTo(base,rig.pos);
  if(action==="huddle"){
    const other=PREGAME.actors.find(a=>a!==actor);
    if(other)face=faceTo(base,other.guy.g.position);
  }
  pregamePlace(actor,base,face);pregameNeutral(guy);
  if(ball)ball.visible=false;
  if(action==="shoot"){
    updatePregameWarmupShot(actor,guy,ball,u);
  }else if(action==="stretch"){
    const sway=Math.sin(u*Math.PI*2);
    guy.g.rotation.x=0.05+0.14*Math.max(0,sway);
    guy.arms[0].rotation.x=-1.9;guy.arms[1].rotation.x=-2.45;
    guy.arms[0].rotation.z=0.52*sway;guy.arms[1].rotation.z=-0.52*sway;
    guy.elbows.forEach(e=>e.rotation.x=-0.18);
    guy.legs.forEach(l=>l.rotation.x=-0.15);guy.knees.forEach(k=>k.rotation.x=0.44);
  }else if(action==="dunk"||action==="hang"){
    // 扣篮用连续抛物线,挂框只保留很短的接触,避免在篮筐处硬停。
    const dunkArc=Math.sin(ease01(clamp((u-.06)/.78,0,1))*Math.PI);
    const hangRise=smoothRange(.1,.32,u),hangRelease=smoothRange(.48,.7,u);
    const hang=hangRise*(1-hangRelease),air=action==="hang"?hang:dunkArc;
    const gripRise=Math.max(0.98,HOOP.y-2.01+0.015);
    guy.g.position.y=0.08+air*gripRise;
    const reach=action==="hang"?hangRise*(1-hangRelease*.8):dunkArc*(1-hangRelease*.35);
    const armReach=action==="hang"?2.72:2.38;
    guy.arms.forEach(a=>a.rotation.x=-0.42-armReach*reach);
    guy.elbows.forEach(e=>e.rotation.x=-0.3-0.48*reach);
    guy.legs[0].rotation.x=-0.12-0.3*air;guy.legs[1].rotation.x=0.1+0.24*air;
    guy.knees.forEach(k=>k.rotation.x=0.18+0.54*air);
    if(ball){ball.visible=action==="dunk"?u<.54:false;ball.material=matBall;ball.position.set(-0.12,1.52+0.08*reach,0.18);}
  }else if(action==="chalk"){
    const toss=smoothRange(.42,.72,u),rub=Math.sin(t*16)*(1-toss);
    guy.arms[0].rotation.x=-0.9-toss*1.65+rub*0.08;guy.arms[1].rotation.x=-0.9-toss*1.65-rub*0.08;
    guy.arms[0].rotation.z=-0.25-toss*0.45;guy.arms[1].rotation.z=0.25+toss*0.45;
    guy.elbows.forEach(e=>e.rotation.x=-1.35+toss*0.8);
    guy.g.position.y=Math.max(0,Math.sin(u*Math.PI))*0.08;
    updatePregameChalk(actor,u,t);
  }else if(action==="finger"){
    guy.arms[0].rotation.x=-2.15;guy.arms[0].rotation.z=-0.55;guy.elbows[0].rotation.x=-0.55;
    guy.arms[1].rotation.x=-0.55;guy.elbows[1].rotation.x=-0.55;
    guy.g.position.y=Math.sin(u*Math.PI)*0.05;
  }else if(action==="huddle"){
    const pump=Math.abs(Math.sin(t*6));
    guy.arms.forEach(a=>a.rotation.x=-1.55-pump*0.55);guy.elbows.forEach(e=>e.rotation.x=-1.05);
    guy.g.position.y=pump*0.06;
  }else if(action==="wave"){
    guy.arms[0].rotation.x=-2.25;guy.arms[0].rotation.z=-0.25+Math.sin(t*8)*0.38;guy.elbows[0].rotation.x=-0.35;
    guy.arms[1].rotation.x=-0.5;guy.elbows[1].rotation.x=-0.45;
  }else{
    const pump=Math.abs(Math.sin(t*7));
    guy.arms.forEach(a=>a.rotation.x=-1.9-pump*0.75);guy.elbows.forEach(e=>e.rotation.x=-0.75);
    guy.g.position.y=pump*0.12;guy.knees.forEach(k=>k.rotation.x=0.25*pump);
  }
}
function pregameFocus(seg){
  const out=V3(0,0,0),list=seg.group?PREGAME.actors:[seg.actor];
  list.forEach(a=>out.add(a.guy.g.position));out.multiplyScalar(1/Math.max(1,list.length));
  if(seg.action==="dunk"||seg.action==="hang"){
    out.x=(out.x+HOOP.x)*0.5;out.z=(out.z+HOOP.z)*0.5;out.y=2.18;
  }else out.y=1.18;
  return out;
}
function pregameUpdateCamera(seg,u,dt){
  const focus=pregameFocus(seg),actor=seg.actor,guy=actor.guy;
  const face=guy.g.rotation.y||faceTo(actor.base,HOOP);
  const f=V3(Math.sin(face),0,Math.cos(face)),side=V3(f.z,0,-f.x).multiplyScalar(seg.side||1);
  const dest=V3(),look=focus.clone();look.y+=seg.action==="dunk"||seg.action==="hang"?0.45:0.18;
  if(seg.cam==="orbit"){
    const a=seg.seed+u*1.35,r=2.65+Math.sin(u*Math.PI)*0.45;
    dest.set(focus.x+Math.sin(a)*r,1.35+u*0.55,focus.z+Math.cos(a)*r);
  }else if(seg.cam==="push"){
    dest.copy(focus).addScaledVector(f,3.7-u*1.55).addScaledVector(side,0.85).setY(1.05+u*0.82);
  }else if(seg.cam==="low"){
    dest.copy(focus).addScaledVector(f,2.35).addScaledVector(side,0.9+u*0.3).setY(0.62+u*0.28);
  }else if(seg.cam==="overhead"){
    dest.copy(focus).addScaledVector(f,1.35).addScaledVector(side,1.65).setY(4.35-u*0.5);
    look.y=1.05;
  }else if(seg.cam==="follow"){
    dest.copy(focus).addScaledVector(f,2.35+Math.sin(u*Math.PI)*0.55).addScaledVector(side,0.75).setY(1.45);
  }else if(seg.cam==="pan"){
    dest.copy(focus).addScaledVector(f,2.45).addScaledVector(side,-1.55+u*3.1).setY(1.28);
  }else if(seg.cam==="pull"){
    dest.copy(focus).addScaledVector(f,1.75+u*2.05).addScaledVector(side,0.75).setY(1.25+u*0.45);
  }else{
    dest.copy(focus).addScaledVector(f,2.15).addScaledVector(side,1.05).setY(1.22+Math.sin(u*Math.PI)*0.12);
  }
  if(PREGAME.t<0.08||seg._justStarted){rig.pos.copy(dest);rig.look.copy(look);seg._justStarted=false;return;}
  rig.pos.lerp(dest,Math.min(1,dt*5.8));
  rig.look.lerp(look,Math.min(1,dt*7.5));
}
function startPreGameShow(opts,done){
  opts=opts||{};
  PREGAME.prevState=G.state;PREGAME.cb=done;PREGAME.t=0;PREGAME.idx=0;PREGAME.on=true;
  PREGAME.poseCache.clear();
  PREGAME.actors=pregameBuildActors(opts);
  const seen=new Set();
  PREGAME.snaps=PREGAME.actors.filter(a=>{if(seen.has(a.guy))return false;seen.add(a.guy);return true;}).map(a=>pregameSnapGuy(a.guy));
  PREGAME.shots=pregameBuildShots(opts);PREGAME.dur=PREGAME.shots.reduce((m,s)=>Math.max(m,s.start+s.dur),0);
  G.state="pregame";G.running=false;G.canShoot=false;G.charging=false;G.power=0;G.glideCam=false;G.moving=false;
  if(passing){scene.remove(passing.mesh);passing=null;passerBall.visible=true;}
  handBall.visible=false;pBall.visible=false;hands.visible=false;
  applyCamMode();
  player.g.visible=true;passer.g.visible=true;PREGAME.actors.forEach(a=>{a.guy.g.visible=true;if(a.guy.active!==undefined)a.guy.active=true;});
  if(PREGAME.shots[0]){PREGAME.shots[0]._justStarted=true;pregameCaption(PREGAME.shots[0]);}
}
function pregameReadyCameraTarget(){
  const shot=curShot();
  if(G.mode==="battle"){
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.48,marginY:1.36,minDist:5.8,maxDist:32});
    return {pos:camTarget.pos.clone(),look:camTarget.look.clone()};
  }
  if(G.mode==="rackrush"){
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.44,marginY:1.34,minDist:5.6,maxDist:18});
    return {pos:camTarget.pos.clone(),look:camTarget.look.clone()};
  }
  return {pos:shotEye(shot),look:HOOP.clone().add(V3(0,0.15,0))};
}
function finishPreGameShow(){
  const cb=PREGAME.cb,prev=PREGAME.prevState;
  PREGAME.snaps.forEach(pregameRestoreGuy);
  PREGAME.on=false;PREGAME.t=0;PREGAME.idx=0;PREGAME.shots=[];PREGAME.actors=[];PREGAME.snaps=[];PREGAME.cb=null;PREGAME.poseCache.clear();hidePregameChalk();
  $("vsBanner").style.display="none";
  P.jump=0;P.eyeDip=0;P.walking=false;G.state=prev;G.moving=false;G.glideCam=false;
  const ready=pregameReadyCameraTarget();
  glideTo(ready.pos,ready.look,0.75,()=>{if(cb)cb();});
}
function updPreGameShow(dt){
  if(!PREGAME.on)return;
  PREGAME.t+=dt;
  if(PREGAME.t>=PREGAME.dur){finishPreGameShow();return;}
  while(PREGAME.idx<PREGAME.shots.length-1&&PREGAME.t>PREGAME.shots[PREGAME.idx].start+PREGAME.shots[PREGAME.idx].dur){
    PREGAME.idx++;PREGAME.shots[PREGAME.idx]._justStarted=true;pregameCaption(PREGAME.shots[PREGAME.idx]);
  }
  const seg=PREGAME.shots[PREGAME.idx];if(!seg)return;
  const u=clamp((PREGAME.t-seg.start)/seg.dur,0,1);
  hidePregameChalk();
  PREGAME.actors.forEach(a=>{
    if(seg.group||a===seg.actor)pregameAnimate(a,seg.action,u,seg);
    else pregameIdle(a,PREGAME.t);
    pregameSmoothPose(a.guy,dt);
  });
  pregameUpdateCamera(seg,u,dt);
}

window.AIBA.runtime.register("presentation:pregame",Object.freeze({
  PREGAME,startPreGameShow,pregameReadyCameraTarget,finishPreGameShow,updPreGameShow
}));
