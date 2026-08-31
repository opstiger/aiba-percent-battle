"use strict";

function ensurePregameChalk(){
  if(PREGAME.chalk)return PREGAME.chalk;
  const count=46,pos=new Float32Array(count*3),geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xf4f3e9,size:0.085,transparent:true,opacity:0,depthWrite:false});
  const points=new THREE.Points(geo,mat);
  points.visible=false;points.frustumCulled=false;scene.add(points);
  PREGAME.chalk={count,pos,geo,mat,points};
  return PREGAME.chalk;
}

function hidePregameChalk(){
  if(PREGAME.chalk)PREGAME.chalk.points.visible=false;
}

function updatePregameChalk(actor,u,t){
  const cloud=ensurePregameChalk(),show=smoothRange(.3,.46,u)*(1-smoothRange(.82,.98,u));
  if(show<=0.01){cloud.points.visible=false;return;}
  const root=actor.guy.g.position,spread=0.12+show*0.42,lift=smoothRange(.38,.76,u);
  for(let i=0;i<cloud.count;i++){
    const j=i*3,a=i*2.399+t*(0.45+(i%5)*0.04),r=spread*(0.18+(i%11)/10);
    cloud.pos[j]=root.x+Math.cos(a)*r;
    cloud.pos[j+1]=root.y+1.78+lift*(0.28+(i%9)*0.055)+Math.sin(a*1.7)*0.055;
    cloud.pos[j+2]=root.z+0.02+Math.sin(a)*r*0.72;
  }
  cloud.geo.attributes.position.needsUpdate=true;
  cloud.mat.opacity=0.22+show*0.68;cloud.points.visible=true;
}

function updatePregameWarmupShot(actor,guy,ball,u,seg){
  const releaseAt=.54,landAt=.91;
  // 热身投篮也走完整的起球→出手→下落,不在出手顶点停住。
  const phase=u<releaseAt?ease01(clamp(u/releaseAt,0,1)):
    1-ease01(clamp((u-releaseAt)/(landAt-releaseAt),0,1))*.92;
  const curve=shotCurves(phase);
  guy.g.position.y=poseGuy(guy,curve,0)+Math.max(0,curve.jmp*.55-curve.over*.55);
  if(!ball)return;
  /* 球的父节点/出手时机由 pregameSyncBallAfterPose 统一处理；这里仅负责
     复用正式投篮的身体时间轴，避免在目标姿势尚未平滑完成时提前取球心。 */
  ball.material=actor.role==="hero"?shotMat(curShot()):matBall;
  if(seg)seg._pregameWarmupPhase=phase;
}

function rookieMeterProgress(){
  if(G.mode==="battle")return clamp(Math.max(G.score||0,G.battleOppScore||0)/BATTLE_TARGET,0,1);
  if(G.mode==="rackrush"&&G.rush){
    if(isRackRushSpeed(G.rush))return clamp((G.rush.total||0)/RACK_RUSH_SPEED_TARGET,0,1);
    const level=clamp(G.rush.level||0,0,RACK_RUSH_LEVELS.length-1);
    const cfg=RACK_RUSH_LEVELS[level]||RACK_RUSH_LEVELS[0];
    const within=clamp(1-(G.timer==null?cfg.time:G.timer)/Math.max(1,cfg.time),0,1);
    return clamp((level+within)/RACK_RUSH_LEVELS.length,0,1);
  }
  return G.seq&&G.seq.length?clamp((G.shotIdx||0)/G.seq.length,0,1):0;
}

function barHiddenFor(shot){
  if(!shot||G.practice)return false;
  if(G.diff==="easy")return rookieMeterProgress()>=0.7;
  if(G.mode==="battle")return G.shotIdx>=BATTLE_BAR_VISIBLE_SHOTS;
  if(G.mode==="rackrush")return rackRushBarHidden();
  const rack=(shot.deep!=null||shot.super)?5:shot.rack;
  return rack>=DIFFS[G.diff].hideBar;
}

function mixNumber(a,b,t){return a+(b-a)*t;}

// Low over-the-shoulder player-lock view. Battle mode gradually widens it for deep spots.
function updatePlayerLockCamera(dt){
  const distance=P.pos.distanceTo(HOOP);
  const farMix=(G.mode==="battle"||G.mode==="contest")?clamp((distance-7)/8,0,1):0;
  autoFrameCam(camTarget,P.pos,P.jump,COURT_ATTACK_DIR,{
    marginX:mixNumber(1.12,1.34,farMix),
    marginY:mixNumber(1.12,1.28,farMix),
    minDist:mixNumber(4.8,5.6,farMix),
    maxDist:mixNumber(18,32,farMix),
    pad:mixNumber(.08,.55,farMix),
    lookLift:mixNumber(-.52,.08,farMix),
    sideK:mixNumber(.28,.44,farMix),
    backK:mixNumber(.92,.82,farMix),
    heightK:mixNumber(.2,.25,farMix)
  });
  dampRig(dt,mixNumber(5.5,4.5,farMix));
}
