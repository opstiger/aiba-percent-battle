/* ---------------- hero ball camera (最后一球英雄时刻) ---------------- */
const hero={on:false,b:null,t:0,lin:0,perp:null};
function startHero(B){
  hero.on=true;hero.b=B;hero.t=0;hero.lin=0;if(window.AIBARecorder)AIBARecorder.mark("最后一球出手",{postMs:5200});
  const v=V3(B.v0.x,0,B.v0.z).normalize();
  hero.perp=V3(v.z,0,-v.x);
  if(hero.perp.x*B.p0.x>0)hero.perp.negate();
  rig.pos.copy(eyePos());
  $("lbT").style.height="9vh";$("lbB").style.height="9vh";
  $("heroTag").style.display="block";
}
function endHero(){
  if(!hero.on)return;
  hero.on=false;hero.b=null;
  $("lbT").style.height="0";$("lbB").style.height="0";
  $("heroTag").style.display="none";
}
function updHero(dt){
  const b=hero.b;
  if(b&&balls.includes(b)){
    const p=b.mesh.position;
    rig.pos.lerp(V3(p.x+hero.perp.x*3.6,p.y*0.55+1.7,p.z+hero.perp.z*3.6-1.0),Math.min(1,dt*5));
    rig.look.lerp(p,Math.min(1,dt*10));
  }else{
    hero.lin+=dt;
    rig.look.lerp(HOOP,Math.min(1,dt*6));
    if(hero.lin>0.8)endHero();
  }
}

/* ---------------- AI live show: 看对手真实出手 ---------------- */
function genAIRun(o){
  const p=aiProb(o.r),money=(seededRandom()*5)|0;
  const shots=[];let total=0;
  for(let rk=0;rk<5;rk++){
    for(let b=0;b<5;b++){
      const m=(rk===money)||b===4,v=m?2:1,make=seededRandom()<p;
      shots.push({rack:rk,ball:b,deep:null,money:m,val:v,make});
      if(make)total+=v;
    }
    if(rk===1||rk===2){
      const mk=seededRandom()<p*0.82;
      shots.push({rack:null,deep:rk===1?0:1,money:false,val:3,make:mk});
      if(mk)total+=3;
    }
  }
  return {shots,total,money};
}
const show={on:false,o:null,guy:null,q:[],idx:0,t:0,score:0,total:0,moneyRack:0,shotNo:0,streak:0,missRun:0,cb:null,c:shotCurves(0)};
const _showReleasePos=new THREE.Vector3();
function attachShowBall(g){
  if(!g||!g.ball||g._showBallAttached)return;
  g._showBallHome={parent:g.ball.parent,pos:g.ball.position.clone()};
  const parent=g.ballGrips&&g.ballGrips[0]?g.ballGrips[0]:g.elbows[0];
  parent.add(g.ball);
  if(parent===g.elbows[0])g.ball.position.set(0,-0.43,0.12);
  else g.ball.position.set(0,0,0);
  g._showBallAttached=true;
}
function detachShowBall(g){
  if(!g||!g.ball||!g._showBallAttached||!g._showBallHome)return;
  g._showBallHome.parent.add(g.ball);
  g.ball.position.copy(g._showBallHome.pos);
  g.ball.visible=false;
  g._showBallAttached=false;
}
function setAIShowActors(shooter){
  hands.visible=false;handBall.visible=false;pBall.visible=false;
  player.g.visible=false;passer.g.visible=false;
  rivals.forEach(rv=>{rv.g.visible=!!rv.active;});
  if(shooter)shooter.g.visible=true;
}
function startAIShow(o,cb){
  G.state="aishow";enterArenaAudio(0.86);
  const run=genAIRun(o);
  show.on=true;show.o=o;show.cb=cb;show.total=run.total;show.moneyRack=run.money;show.score=0;show.idx=0;show.t=0;show.shotNo=0;show.streak=0;show.missRun=0;
  benchSetup();
  show.guy=rivalFor(o);show.guy.active=true;benchVis();setAIShowActors(show.guy);
  attachShowBall(show.guy);
  // 完整比赛队列:五架各投五球,两记深远球也真实走位并出手。
  const q=[];
  for(let rk=0;rk<5;rk++){
    const rackShots=run.shots.filter(s=>s.rack===rk);
    q.push({type:"move",rack:rk});
    rackShots.forEach(s=>q.push({type:"shot",s}));
    run.shots.filter(s=>s.deep!=null&&((rk===1&&s.deep===0)||(rk===2&&s.deep===1))).forEach(s=>{
      q.push({type:"move",deep:s.deep});q.push({type:"shot",s});
    });
  }
  q.push({type:"end"});
  show.q=q;
  const tgt=myPostedScore();
  $("showName").textContent=o.n+" 出手中";
  $("showScore").textContent="0";
  $("showTgt").textContent=tgt!=null?"目标 "+(tgt+1)+" 分":"";
  $("showUI").style.display="block";
  if(!playAudioEvent("contest_opponent_intro"))paSay("有请,"+o.n+"!",true);
  setTimeout(()=>boo(1.6),900);
  const chase=TALK_CHASE[(Math.random()*TALK_CHASE.length)|0];
  toast(o.n+":「"+chase+"」","#ffd23f");
  setTimeout(()=>rivalSay(o,chase),1600);
  // 起手位置
  const b0=RACKS[0].p;
  show.guy.g.position.copy(b0);show.guy.g.rotation.y=faceTo(b0,HOOP);
  show.guy.pos=b0.clone();
  show.guy.ball.visible=true;show.guy.ball.material=matBall;
  nextShowItem();
}
function myPostedScore(){
  if(G.stage==="semi")return G.semiDone?G.semiScore:null;
  return G.finalDone?G.finalScore:null;
}
function nextShowItem(){
  show.cur=show.q[show.idx++];show.t=0;
  if(!show.cur){finishShow();return;}
  const it=show.cur;
  if(it.type==="move"){
    const to=it.deep!=null?DEEPS[it.deep].p:RACKS[it.rack].p;
    it.from=show.guy.pos.clone();it.to=to.clone();
    it.dur=clamp(it.from.distanceTo(it.to)/3.2,0.68,1.65);
    if(it.rack===show.moneyRack)playAudioEvent("contest_moneyrack");
    else if(it.rack===4)playAudioEvent("contest_finalrack");
  }else if(it.type==="shot"){
    attachShowBall(show.guy);
    show.guy.ball.visible=true;
    show.guy.ball.material=it.s.deep!=null?matDeep:(it.s.money?matGold:matBall);
    const profile=shotProfileFor(G.myStar||show.o),speed=Math.max(.78,Number(profile&&profile.speed)||1);
    show.shotNo++;
    it.loadDur=clamp(1.18/speed,.96,1.38);
    it.totalDur=it.loadDur+(.72+(it.s.ball===0?.14:0));
    if(show.shotNo===23)playAudioEvent("contest_final10");
    if(show.shotNo===27)playAudioEvent("final_shot");
    $("showTgt").textContent=it.s.deep!=null?"深远加分球":("第 "+(it.s.rack+1)+" 架 · "+(it.s.ball+1)+"/5");
  }else if(it.type==="chip"){
    show.score+=it.pts;$("showScore").textContent=show.score;
    popScore("+"+it.pts+" ≫","#9ab");blip(500,0.05,"square",0.05);
  }else if(it.type==="end"){
    $("showTgt").textContent="最终 "+show.total+" 分";
    cheerSound(true);G.cheer=1;
  }
}
function announceAIShowResult(ball,made){
  if(!show.on||!show.o)return;
  if(made){
    show.streak++;show.missRun=0;
    if(ball&&ball.deep){gameDjSay("深远三分!","special",2);return;}
    const pool=show.streak===3?TALK_STREAK_THREE:(show.streak===5?TALK_STREAK_FIVE:(show.streak===8?TALK_STREAK_EIGHT:null));
    if(pool){const cue=pool[(Math.random()*pool.length)|0],text=cue.t||cue;toast(show.o.n+" · "+text,"#ffd23f");gameDjSay(text,"momentum",1.8);}
  }else{
    show.streak=0;show.missRun++;
    const pool=show.missRun===5?TALK_MISS_FIVE:(show.missRun===8?TALK_MISS_EIGHT:null);
    if(pool){const cue=pool[(Math.random()*pool.length)|0],text=cue.t||cue;toast(show.o.n+" · "+text,"#ff8d7a");gameDjSay(text,"momentum",1.8);}
  }
}
function updShow(dt){
  if(!show.on||!show.cur)return;
  show.t+=dt;const it=show.cur,g=show.guy;
  if(it.type==="move"){
    const k=Math.min(1,show.t/(it.dur||0.48));
    g.pos.lerpVectors(it.from,it.to,k);
    g.g.position.copy(g.pos);
    g.g.rotation.y=faceTo(g.pos,HOOP);
    const sw=Math.sin(show.t*16);
    g.legs[0].rotation.x=sw*0.6;g.legs[1].rotation.x=-sw*0.6;
    g.knees[0].rotation.x=Math.max(0,-sw*0.45+0.22);g.knees[1].rotation.x=Math.max(0,sw*0.45+0.22);
    g.ankles[0].rotation.x=-sw*0.22;g.ankles[1].rotation.x=sw*0.22;g.g.rotation.x=0;
    if(k>=1){g.legs[0].rotation.x=0;g.legs[1].rotation.x=0;g.knees[0].rotation.x=0;g.knees[1].rotation.x=0;g.ankles[0].rotation.x=0;g.ankles[1].rotation.x=0;nextShowItem();}
  }else if(it.type==="shot"){
    const ph=Math.min(1.03,show.t/(it.loadDur||0.72)*1.03);
    const c=shotCurves(ph);show.c=c;
    const y=poseGuy(g,c,0)+Math.max(0,c.jmp*0.55-c.over*0.55);
    g.g.position.set(g.pos.x,y,g.pos.z);
    const stance=shotStanceBlend(c,true);
    g.g.rotation.y=faceTo(g.pos,HOOP)+SHOT_STANCE_YAW*stance;
    tuneGuideHandPose(g,c,true);
    applyShotSetPose(g,c,true);
    applyHandFollowThroughPose(g,ease01((ph-.94)/.09));
    if(ph>=1.03&&!it.fired){
      it.fired=true;
      g.g.updateMatrixWorld(true);g.ball.getWorldPosition(_showReleasePos);
      g.ball.visible=false;
      fireSilentBall(g.pos,it.s,_showReleasePos);
    }
    if(show.t>=(it.totalDur||1.02)){
      const rest=shotCurves(0);
      g.g.position.set(g.pos.x,poseGuy(g,rest,0),g.pos.z);
      g.g.rotation.y=faceTo(g.pos,HOOP);
      tuneGuideHandPose(g,rest,false);
      nextShowItem();
    }
  }else if(it.type==="chip"){
    if(show.t>=0.45)nextShowItem();
  }else if(it.type==="end"){
    if(show.t>=1.55)finishShow();
  }
}
function fireSilentBall(base,s,releasePos){
  const p0=releasePos&&Number.isFinite(releasePos.x)?releasePos.clone():base.clone().setY(2.05);
  const dirH=HOOP.clone().sub(p0);dirH.y=0;const dist=dirH.length();dirH.normalize();
  const perp=V3(dirH.z,0,-dirH.x);
  let depth,lat;
  if(s.make){depth=rnd(-0.03,0.03);lat=rnd(-0.04,0.04);}
  else{depth=0.27*(Math.random()<0.5?1:-1);lat=rnd(-0.14,0.14);}
  const T=HOOP.clone().addScaledVector(dirH,depth).addScaledVector(perp,lat);
  const tf=shotFlightTime(0.78+dist*0.062,G.myStar||show.o,s);
  const v0=V3((T.x-p0.x)/tf,(T.y-p0.y)/tf+4.9*tf,(T.z-p0.z)/tf);
  const mesh=new THREE.Mesh(ballGeo,s.deep!=null?matDeep:(s.money?matGold:matBall));
  mesh.position.copy(p0);scene.add(mesh);
  const blob=new THREE.Mesh(blobGeo,blobMat.clone());
  blob.rotation.x=-Math.PI/2;blob.position.set(p0.x,0.02,p0.z);scene.add(blob);
  balls.push({mesh,blob,p0:p0.clone(),v0,tf,t:0,phase:"fly",outcome:s.make?"swish":"rimout",
    vel:new THREE.Vector3(),val:s.val,money:s.money,deep:s.deep!=null,made:false,life:1.4,bounces:0,
    rec:[],timeLeft:0,hot:false,startPos:p0.clone(),silent:true});
}
function updShowCam(){
  const g=show.guy;if(!g)return;
  const d=V3(Math.sin(g.g.rotation.y),0,Math.cos(g.g.rotation.y));
  rig.pos.lerp(V3(g.pos.x-d.x*3.8+1.2,2.5,g.pos.z-d.z*3.8),0.08);
  rig.look.lerp(V3(g.pos.x+d.x*3,1.8,g.pos.z+d.z*3),0.12);
}
function finishShow(){
  if(!show.on)return;
  show.on=false;show.cur=null;G.state="intro";benchVis();
  // 清掉还在飞的演示球
  for(let i=balls.length-1;i>=0;i--){
    if(balls[i].silent){scene.remove(balls[i].mesh);scene.remove(balls[i].blob);balls.splice(i,1);}
  }
  $("showUI").style.display="none";
  const o=show.o;o.posted=show.total;
  G.posted.push({o,score:show.total});
  paSay(o.n+","+show.total+"分!",true);
  // 回到替补席
  detachShowBall(show.guy);benchSetup();benchVis();
  __afterShow=show.cb;show.cb=null;
  showPanel(`<h1 class="title" style="font-size:20px">${o.n} 完赛</h1>
    <div style="font-size:44px;color:#ffd23f;text-shadow:3px 3px 0 #000;font-weight:bold;margin:6px 0">${show.total} 分</div>
    <button class="btn gold" onclick="continueAfterShow()">继续 →</button>`);
}
let __afterShow=null;
function continueAfterShow(){
  hidePanel();
  if(__afterShow){const f=__afterShow;__afterShow=null;f();}
}
function skipShow(){
  if(!show.on)return;
  show.score=show.total;$("showScore").textContent=show.total;
  finishShow();
}
window.announceAIShowResult=announceAIShowResult;

/* ---------------- 反超对手 → 3秒特写 ---------------- */
function tryCutAway(){
  if(!G.cutQ||!G.cutQ.length)return;
  if(G.cutAway||G.charging||hero.on||G.state!=="round")return;
  const p=G.cutQ.shift();
  G.cutAway={p,t:0};G.running=false;
  hands.visible=false;
  const rv=rivalFor(p.o);
  const line=TALK_OVERTAKEN[(Math.random()*TALK_OVERTAKEN.length)|0];
  airhorn();paSay("反超!比分易主!",true);
  setTimeout(()=>boo(1.8),700);
  setTimeout(()=>rivalSay(p.o,line,"sad"),1400);
  $("vsBanner").innerHTML=`🔥 反超 <b>${p.o.n}</b>!<br><span style="font-size:12px;color:#ffb">${p.o.n}:「${line}」</span>`;
  $("vsBanner").style.display="block";
  cheerSound(true);G.cheer=1;
  if(navigator.vibrate)navigator.vibrate([15,40,25]);
  // 沮丧动作:抱头→摊手
  tween(0.45,k=>{rv.arms.forEach(a=>a.rotation.x=-0.3-k*2.6);rv.elbows.forEach(e=>e.rotation.x=-0.3-k*1.6);});
  setTimeout(()=>{tween(0.7,k=>{
    rv.arms.forEach(a=>a.rotation.x=-2.9+k*3.35);rv.elbows.forEach(e=>e.rotation.x=-1.9+k*1.7);
    rv.legs.forEach(l=>l.rotation.x=k*0.5);rv.knees.forEach(kn=>kn.rotation.x=k*0.55);rv.g.rotation.x=k*0.16;
  });},1050);
}
function updCutAway(dt){
  const c=G.cutAway;if(!c)return;
  c.t+=dt;
  const rv=rivalFor(c.p.o);
  const d=V3(Math.sin(rv.g.rotation.y),0,Math.cos(rv.g.rotation.y));
  const pp=V3(d.z,0,-d.x); // 3/4 侧机位
  rig.pos.lerp(V3(rv.g.position.x+d.x*1.9+pp.x*0.8,1.5,rv.g.position.z+d.z*1.9+pp.z*0.8),Math.min(1,dt*8));
  rig.look.lerp(V3(rv.g.position.x,1.42,rv.g.position.z),Math.min(1,dt*10));
  rv.g.rotation.y+=Math.sin(c.t*9)*0.004;
  if(c.t>=3){
    G.cutAway=null;$("vsBanner").style.display="none";
    G.running=true;applyCamMode();updTargetUI();
    toast("继续!守住领先","#7CFC6B");
  }
}
function updTargetUI(){
  const el=$("hudTarget");
  if(G.mode==="battle"){
    updBattleUI();
    return;
  }
  const ahead=G.posted.filter(p=>p.score>=G.score);
  if(!G.posted.length){el.textContent="";return;}
  if(!ahead.length){el.textContent="🥇 暂列第一";el.style.color="#7CFC6B";return;}
  const next=ahead.reduce((a,b)=>a.score<b.score?a:b);
  el.textContent="🎯 目标 "+(next.score+1)+" ("+next.o.n+")";el.style.color="#ffd23f";
}

/* ---------------- 百分大战:反超特写 + 庆祝/沮丧慢动作 ---------------- */
function battleCutaway(byMe,key){
  // byMe=true 你反超对手(庆祝你) / false 对手反超你(切对手张扬+对骂)
  pauseBattleClock();
  G.battleCut={t:0,byMe,key};G.running=false;
  hands.visible=false;$("spotDots").style.display="none";$("edgeArrows").style.display="none";
  airhorn();if(key){setTimeout(airhorn,650);}
  if(byMe){
    paSay("反超!你领先了!",true);
    const line=TALK_CELEBRATE[(Math.random()*TALK_CELEBRATE.length)|0];
    $("vsBanner").innerHTML=`🎉 你反超了!${key?'<br><span style="font-size:13px;color:#ffd23f">🔥 关键得分!</span>':''}<br><span style="font-size:12px;color:#9dff8d">你:「${line}」</span>`;
    $("vsBanner").style.display="block";
    cheerSound(true);G.cheer=1;
    setTimeout(()=>djSay(line),500);
    startCelebrate(player,(Math.random()*8)|0);
  }else{
    paSay(G.battleOpp.n+"反超了!",true);
    const taunt=TALK_BATTLE_TAUNT[(Math.random()*TALK_BATTLE_TAUNT.length)|0];
    $("vsBanner").innerHTML=`😤 ${G.battleOpp.n} 反超!<br><span style="font-size:12px;color:#ffb">${G.battleOpp.n}:「${taunt}」</span>`;
    $("vsBanner").style.display="block";
    boo(2.0);
    setTimeout(()=>rivalSay(G.battleOpp,taunt,"taunt"),600);
    startCelebrate(OPP.guy,(Math.random()*8)|0);
  }
  if(navigator.vibrate)navigator.vibrate(key?[20,50,20,50]:[15,40,25]);
}
function startCelebrate(o,type){
  if(!o||!o.g)return;
  o._celeb={
    t:0,
    type,
    baseX:o.g.rotation.x,
    baseY:o.g.rotation.y,
    baseZ:o.g.rotation.z,
    basePosY:o.g.position.y
  };
}
function updateCelebrate(o,dt){
  const c=o._celeb;if(!c)return;
  c.t+=dt;const t=c.t;
  o.g.rotation.x=c.baseX;
  o.g.rotation.y=c.baseY;
  o.g.rotation.z=c.baseZ;
  o.g.position.y=c.basePosY;
  if(c.type===0){ // 双臂振举欢呼 + 蹦跳
    const pump=Math.abs(Math.sin(t*6));
    o.arms.forEach(a=>a.rotation.x=-2.6-pump*0.4);o.elbows.forEach(e=>e.rotation.x=-0.3);
    o.g.position.y=c.basePosY+Math.abs(Math.sin(t*5))*0.18;
  }else if(c.type===1){ // 捶胸
    const beat=Math.sin(t*9);
    o.arms[0].rotation.x=-1.5-Math.max(0,beat)*0.6;o.arms[1].rotation.x=-1.5-Math.max(0,-beat)*0.6;
    o.elbows.forEach(e=>e.rotation.x=-1.9);o.g.position.y=c.basePosY;
  }else if(c.type===2){ // 三分手势 + 转身
    o.arms.forEach(a=>a.rotation.x=-1.9);o.elbows.forEach(e=>e.rotation.x=-1.2);
    o.g.rotation.y=c.baseY+t*2.2;o.g.position.y=c.basePosY+Math.abs(Math.sin(t*4))*0.1;
  }else if(c.type===3){ // 单臂指天 + 小跳
    o.arms[0].rotation.x=-2.55;o.arms[0].rotation.z=0.2;
    o.arms[1].rotation.x=-0.55;o.arms[1].rotation.z=-0.1;
    o.elbows[0].rotation.x=-0.2;o.elbows[1].rotation.x=-0.8;
    o.g.position.y=c.basePosY+Math.abs(Math.sin(t*7))*0.12;
  }else if(c.type===4){ // 头顶击掌 / 庆祝拍手
    const clap=Math.abs(Math.sin(t*10));
    o.arms[0].rotation.x=-2.1-clap*0.2;o.arms[1].rotation.x=-2.1-clap*0.2;
    o.arms[0].rotation.z=0.3;o.arms[1].rotation.z=-0.3;
    o.elbows.forEach(e=>e.rotation.x=-0.5-clap*0.6);
    o.g.position.y=c.basePosY+clap*0.08;
  }else if(c.type===5){ // 张开双臂拥抱全场
    const open=0.85+Math.sin(t*5)*0.12;
    o.arms[0].rotation.x=-1.8;o.arms[1].rotation.x=-1.8;
    o.arms[0].rotation.z=-0.55*open;o.arms[1].rotation.z=0.55*open;
    o.elbows.forEach(e=>e.rotation.x=-0.8);
    o.g.position.y=c.basePosY+Math.abs(Math.sin(t*3.5))*0.07;
  }else if(c.type===6){ // 摇手指 / no-no
    o.arms[0].rotation.x=-2.2;o.arms[0].rotation.z=-0.22+Math.sin(t*8)*0.18;
    o.arms[1].rotation.x=-0.45;o.arms[1].rotation.z=0.18;
    o.elbows[0].rotation.x=-0.55;o.elbows[1].rotation.x=-0.8;
    o.g.rotation.y=c.baseY+Math.sin(t*4.2)*0.18;
    o.g.position.y=c.basePosY+Math.abs(Math.sin(t*6))*0.05;
  }else{ // 低头定格 / 深呼吸
    o.arms[0].rotation.x=-1.15;o.arms[1].rotation.x=-1.15;
    o.elbows.forEach(e=>e.rotation.x=-0.45);
    o.g.rotation.y=c.baseY+Math.sin(t*2.8)*0.12;
    o.g.position.y=c.basePosY+Math.abs(Math.sin(t*2.8))*0.04;
  }
}
function stopCelebrate(o){
  if(!o._celeb)return;
  const c=o._celeb;
  if(o.g){
    o.g.rotation.x=c.baseX||0;
    o.g.rotation.y=c.baseY||0;
    o.g.rotation.z=c.baseZ||0;
  }
  o.arms.forEach(a=>a.rotation.x=-0.3);o.elbows.forEach(e=>e.rotation.x=-0.3);
  if(o.g)o.g.position.y=c.basePosY||0;
  o._celeb=null;
}
const VICTORY_CINE={on:false,t:0,dur:4.8,hero:null,foil:null,heroType:0,foilType:0,camSeed:0,nextState:"champion",cb:null,tag:"🏆 胜利庆祝",phase:""};
function setVictoryTag(v,phase,label){
  if(v.phase===phase)return;
  v.phase=phase;
  const el=$("heroTag");if(!el)return;
  if(typeof window.AIBASetIcon==="function")window.AIBASetIcon(el,"clapperboard",label);
  else el.textContent=label;
}
function stopVictoryCine(){
  const v=VICTORY_CINE;
  v.on=false;v.t=0;v.phase="";
  if(v.hero&&v.hero._celeb)stopCelebrate(v.hero);
  if(v.foil&&v.foil._celeb)stopCelebrate(v.foil);
  v.hero=null;v.foil=null;v.cb=null;
  const top=$("lbT"),bottom=$("lbB"),tag=$("heroTag");
  if(top)top.style.height="0";
  if(bottom)bottom.style.height="0";
  if(tag)tag.style.display="none";
}
function victoryFocus(hero,foil){
  const hp=(hero&&hero.g?hero.g.position:P.pos).clone();
  const fp=(foil&&foil.g?foil.g.position:hp.clone().add(V3(-1.8,0,-0.2))).clone();
  const focus=hp.clone().add(fp).multiplyScalar(0.5);
  focus.y=1.3;
  return {hp,fp,focus};
}
function startVictoryCine(opts){
  opts=opts||{};
  stopVictoryCine();
  const v=VICTORY_CINE;
  v.on=true;v.t=0;v.dur=opts.dur||4.8;v.hero=opts.hero||player;v.foil=opts.foil||null;
  v.heroType=opts.heroType!=null?opts.heroType:((Math.random()*8)|0);
  v.foilType=opts.foilType!=null?opts.foilType:((Math.random()*3)|0);
  v.camSeed=Math.random()*Math.PI*2;v.nextState=opts.nextState||"champion";v.cb=opts.onDone||null;
  v.tag=opts.tag||"🏆 胜利庆祝";
  endHero();hidePanel();
  enterArenaAudio(opts.audioIntensity||0.92);
  G.state="victorycine";G.running=false;G.canShoot=false;G.charging=false;G.buzzed=true;G.cutAway=null;G.battleCut=null;G.glideCam=false;G.moving=false;
  $("hud").style.display="none";$("battleControls").style.display="none";$("midBtn").style.display="none";
  $("spotDots").style.display="none";$("edgeArrows").style.display="none";
  if(curSpotRing)curSpotRing.visible=false;
  handBall.visible=false;pBall.visible=false;
  applyCamMode();
  if(v.hero&&v.hero.g){stopCelebrate(v.hero);v.hero.g.visible=true;startCelebrate(v.hero,v.heroType);}
  if(v.foil&&v.foil.g){v.foil.g.visible=true;stopCelebrate(v.foil);}
  $("lbT").style.height="10vh";$("lbB").style.height="10vh";
  $("heroTag").style.display="block";setVictoryTag(v,"opening",v.tag);
}
function updVictoryCine(dt){
  const v=VICTORY_CINE;if(!v.on)return;
  if(G.state!=="victorycine"){stopVictoryCine();return;}
  v.t+=dt;
  const {hp,fp,focus}=victoryFocus(v.hero,v.foil);
  if(v.hero)updateCelebrate(v.hero,dt);
  const dir=HOOP.clone().sub(focus);dir.y=0;if(dir.lengthSq()<1e-4)dir.set(0,0,-1);dir.normalize();
  const perp=V3(dir.z,0,-dir.x);
  const side=Math.sin(v.camSeed)>=0?1:-1;
  const hb=Math.sin(v.t*6.3)*0.04;
  const p=clamp(v.t/Math.max(0.01,v.dur),0,1);
  let cp,lk;
  if(p<0.22){
    const q=p/0.22;
    cp=hp.clone().addScaledVector(dir,2.15-0.25*q).addScaledVector(perp,side*(1.18+0.2*Math.sin(v.camSeed))).setY(1.62+q*0.24+hb);
    lk=hp.clone().setY(1.55);
    setVictoryTag(v,"hero","顺利时刻");
  }else if(p<0.5){
    const q=(p-0.22)/0.28;
    cp=focus.clone().addScaledVector(dir,1.95-0.6*q).addScaledVector(perp,side*(2.5+0.7*Math.sin(v.camSeed*1.7))).setY(1.78+Math.sin(q*Math.PI)*0.12+hb);
    lk=hp.clone().lerp(fp,0.18).setY(1.6);
    setVictoryTag(v,"celebrate","胜利庆祝");
  }else if(p<0.78){
    const q=(p-0.5)/0.28;
    cp=focus.clone().addScaledVector(perp,side*(3.35+0.5*Math.cos(v.camSeed))).addScaledVector(dir,-0.45+q*0.35).setY(2.45+Math.sin(q*Math.PI)*0.22);
    lk=focus.clone().setY(1.95);
    setVictoryTag(v,"crowd","全场欢呼");
  }else{
    const q=(p-0.78)/0.22;
    cp=hp.clone().addScaledVector(dir,1.68-0.52*q).addScaledVector(perp,side*(0.8+0.22*Math.sin(v.camSeed*1.2))).setY(2.0+Math.sin(q*Math.PI)*0.08+hb);
    lk=hp.clone().setY(1.55);
    setVictoryTag(v,"freeze","定格");
  }
  cp.x=clamp(cp.x,-COURT.halfWidth+0.9,COURT.halfWidth-0.9);
  cp.z=clamp(cp.z,COURT.nearBaseline+0.9,COURT.playMaxZ-0.55);
  rig.pos.lerp(cp,Math.min(1,dt*4.6));
  rig.look.lerp(lk,Math.min(1,dt*7.8));
  if(v.t>=v.dur){
    const nextState=v.nextState||"champion",cb=v.cb;
    stopVictoryCine();
    G.state=nextState;
    applyCamMode();
    if(cb)cb();
  }
}

window.AIBA.runtime.register("presentation:cinematics",Object.freeze({
  hero,show,VICTORY_CINE,startHero,endHero,updHero,startAIShow,updShow,updShowCam,finishShow,
  continueAfterShow,skipShow,tryCutAway,updCutAway,updTargetUI,battleCutaway,
  startCelebrate,updateCelebrate,stopCelebrate,startVictoryCine,stopVictoryCine,updVictoryCine
}));
