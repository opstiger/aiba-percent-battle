const balls=[];
const BALL_FLOOR_PHYSICS=Object.freeze({
  y:.16,
  restitution:[.77,.67,.54],
  horizontalRetention:[.88,.82,.74],
  maxReboundSpeed:5.8,
  minReboundSpeed:1.05,
  maxBounces:3,
  rollDrag:4.6,
  rollLife:.65
});
function resolveFloorBounce(ball){
  const impactSpeed=Math.max(0,-ball.vel.y),bounceNumber=(Number(ball.bounces)||0)+1;
  const index=Math.min(bounceNumber-1,BALL_FLOOR_PHYSICS.restitution.length-1);
  const reboundSpeed=Math.min(BALL_FLOOR_PHYSICS.maxReboundSpeed,impactSpeed*BALL_FLOOR_PHYSICS.restitution[index]);
  const horizontal=BALL_FLOOR_PHYSICS.horizontalRetention[index];
  ball.bounces=bounceNumber;ball.vel.x*=horizontal;ball.vel.z*=horizontal;
  if(bounceNumber>BALL_FLOOR_PHYSICS.maxBounces||reboundSpeed<BALL_FLOOR_PHYSICS.minReboundSpeed){
    ball.vel.y=0;ball.phase="roll";ball.rollT=0;return false;
  }
  ball.vel.y=reboundSpeed;
  if(bounceNumber===1)ball.life=Math.max(Number(ball.life)||0,2.55);
  return true;
}
function battleShot(){
  const sp=BATTLE_SPOTS[G.battleSpot||0];
  return {rack:sp.rack,deep:sp.deep,super:sp.super,money:false,val:sp.val,ball:G.shotIdx%5,label:sp.n,p:sp.p,battle:true,spotIdx:G.battleSpot||0,
    superChanceId:sp.super?(G.battleChargeSuperChanceId||G.superChanceId||0):0};
}
function curShot(){return G.mode==="battle"?battleShot():(G.mode==="rackrush"?rackRushShot():G.seq[G.shotIdx]);}
function shotBase(shot){
  if(!shot)return RACKS[2].p;
  if(shot.super)return HALFCOURT.p;
  if(shot.deep!=null)return DEEPS[shot.deep].p;
  if(shot.p)return shot.p;
  return RACKS[shot.rack].p;
}
function shotMat(shot){
  if(!shot)return matBall;
  return (shot.super||shot.deep!=null)?matDeep:(shot.money?matGold:matBall);
}
function shotIdeal(shot){
  if(shot&&shot.super)return IDEAL_HALF;
  return shot&&shot.deep!=null?IDEAL_DEEP:IDEAL;
}
function isSameShotSpot(a,b){
  if(!a||!b)return false;
  const pa=shotBase(a),pb=shotBase(b);
  return pa.distanceTo(pb)<0.05;
}
function buildSeq(money){
  const s=[];
  for(let r=0;r<5;r++){
    for(let b=0;b<5;b++){
      const m=(r===money)||b===4;
      s.push({rack:r,ball:b,val:m?2:1,money:m,deep:null});
    }
    if(r===1)s.push({deep:0,val:3,money:false,rack:null});
    if(r===2)s.push({deep:1,val:3,money:false,rack:null});
  }
  return s;
}
function setHandBall(){
  const s=curShot();
  if(!s){handBall.visible=false;pBall.visible=false;return;}
  const m=shotMat(s);
  handBall.material=m;pBall.material=m;
  handBall.visible=true;pBall.visible=true;
}
function updPowerUI(){
  const s=curShot();const isDeep=s&&(s.deep!=null||s.super);
  const hide=barHiddenFor(s);
  $("powerWrap").style.display="none";
  if(hide){
    hidePlayerPowerUI();
    if(!G.blindToasted){
      G.blindToasted=true;
      toast(G.diff==="easy"?"新秀挑战升级 · 最后30%隐藏投篮条":(G.mode==="battle"?"前5球热手结束 · 蓄力条隐藏,靠手感出手":(G.mode==="rackrush"?"本关进入手感投篮 · 蓄力条隐藏":"盲投模式!投篮条已隐藏 · 凭手感节奏出手")),"#ffd23f");
    }
    return;
  }
  const ideal=weatherAdjustedIdeal(s,false), zone=playerSweetZone();
  const z=$("pZone"),sw=$("pSweet");
  z.style.bottom=(ideal-zone)+"%";z.style.height=(zone*2)+"%";
  sw.style.bottom=(ideal-zone*0.5)+"%";sw.style.height=zone+"%";
  const powerLabel=s&&s.super?"中场10分 力量↑":(G.mode==="battle"&&s&&s.deep!=null?"彩球5分 力量↑":(isDeep?"深远球 力量↑":"甜区"));
  $("pTag").textContent=currentWeather==="rain"?"雨天加力 · "+powerLabel:powerLabel;
  $("pTag").style.bottom=(ideal-2)+"%";
}
function updDotsUI(){
  const s=curShot(),wrap=$("hudDots");
  if(!s){wrap.innerHTML="";$("hudRackName").textContent="完成!";return;}
  if(G.mode==="battle"){
    const sp=BATTLE_SPOTS[G.battleSpot||0];
    const st=battleSpotStatus(G.battleSpot||0);
    $("hudRackName").textContent=(sp.super?"🔥 ":"🎯 ")+sp.n+" ("+sp.val+"分 · "+st.label+")";
    wrap.innerHTML=BATTLE_SPOTS.map((p,i)=>{
      const sst=battleSpotStatus(i);
      return '<i class="'+(i===G.battleSpot?"gold ":"")+(p.super?"deep":"")+(sst.ok?"":" used")+'"></i>';
    }).join("");
    updBattleUI();
    return;
  }
  if(G.mode==="rackrush"){
    const rush=G.rush,pos=(rush?rush.shotNo:0)%5,next=pos+1;
    if(isRackRushSpeed(rush))$("hudRackName").textContent=next===5?"彩球到位 · 命中4分":"百分竞速 · 下一球3分";
    else $("hudRackName").textContent=(next===5?"花球到位 · 命中3分":"连续供球 · 下一球2分")+(G.timer<=10?" + FINAL BONUS":"");
    let h="";for(let b=0;b<5;b++)h+='<i class="'+(b===4?"gold":"")+(b<pos?" used":"")+'"></i>';
    wrap.innerHTML=h;return;
  }
  if(s.deep!=null){
    $("hudRackName").textContent="⚡ MINE-DEW 深远三分 (3分)";
    wrap.innerHTML='<i class="deep"></i>';return;
  }
  $("hudRackName").textContent=RACKS[s.rack].n+(s.rack===G.moneyRack?" 💰全花球架":"");
  let h="";
  for(let b=0;b<5;b++){
    const gold=(s.rack===G.moneyRack)||b===4;
    h+='<i class="'+(gold?"gold":"")+(b<s.ball?" used":"")+'"></i>';
  }
  wrap.innerHTML=h;
}
function startCharge(){
  if(!G.canShoot||G.charging||G.moving||G.cutAway||G.battleCut)return false;
  if(G.mode==="battle"&&!battleSpotAvailable(G.battleSpot)){
    if(!battleAutoMoveIfNeeded())toast(battleSpotStatus(G.battleSpot).label,"#9fd1ff");
    return false;
  }
  G.charging=true;G.power=0;G.apexed=false;
  const chargeShot=curShot();
  G.battleChargeSuperChanceId=G.mode==="battle"&&chargeShot&&chargeShot.super?(G.superChanceId||0):0;
  if(Math.random()<0.35)shoeSqueak(true);
  if(!G.practice&&G.seq&&G.shotIdx===G.seq.length-1&&G.mode==="contest")playAudioEvent("final_shot");else if(Math.random()<0.28)playerEffort("load");
  return true;
}
function doRelease(){
  if(!G.charging){VISION.ownsCharge=false;return;}
  VISION.ownsCharge=false;
  G.charging=false;
  if(navigator.vibrate)navigator.vibrate(6);
  const power=G.power;$("pFill").style.height="0%";
  hidePlayerPowerUI();
  const shot=curShot(); if(!shot){return;}
  releaseShot(power,shot);
}
function afterPlayerLands(delay,callback){
  const started=performance.now(),minimum=Math.max(0,delay||0);
  const wait=()=>{
    const elapsed=performance.now()-started;
    const airborne=globalThis.AIBAShotPhysics&&AIBAShotPhysics.isAirborne();
    if(elapsed>=minimum&&!airborne){callback();return;}
    setTimeout(wait,32);
  };
  setTimeout(wait,minimum);
}
function releaseShot(power,shot){
  const isBattle=G.mode==="battle";
  const isRush=G.mode==="rackrush";
  const isDeep=shot.deep!=null||shot.super;
  const ideal=weatherAdjustedIdeal(shot,true);
  const zone=playerSweetZone();
  /* r 决定这一球是 swish / rattle / bank / miss —— 全游戏最关键的一次随机,
     走可复现通道(?seed=N 固定)。演出用的随机不动。 */
  const err=power-ideal, a=Math.abs(err), r=aibaRoll();
  // lateral error = device tilt + hand noise
  const tl=tiltDeg()*DIFFS[G.diff].latK;
  const latErr=tl+aibaRollRange(-0.035,0.035);   // 手抖也影响结果,一并可复现
  const al=Math.abs(latErr);
  let outcome;
  if(a<=zone*0.5)outcome="swish";
  else if(a<=zone)outcome=r<0.5?"rattle":(r<0.7?"rattleout":(err>0&&r<0.85?"bank":"rimout"));
  else if(a<=zone*1.8)outcome=r<0.15?"rattle":(r<0.4?"rattleout":(err>0&&r<0.55?"bank":"rimout"));
  else outcome="miss";
  // tilt drags the ball sideways and downgrades the result
  if(outcome!=="miss"){
    if(al>0.3)outcome="miss";
    else if(al>0.2&&outcome!=="rimout")outcome="rimout";
    else if(al>0.12&&outcome==="swish")outcome=r<0.5?"rattle":"rattleout";
    else if(al>0.12&&outcome==="bank")outcome="rattleout";
  }
  // hide rack ball in contest mode; battle mode has infinite balls at each spot.
  if(!isBattle&&!isRush){
    if(shot.deep!=null)deepBalls[shot.deep].visible=false;
    else{const m=rackBalls[shot.rack][shot.ball];if(m)m.visible=false;}
  }
  // spawn from the hands (any camera mode)
  const p0=new THREE.Vector3();ballWorldPos(p0);
  handBall.visible=false;pBall.visible=false;
  const dirH=HOOP.clone().sub(p0);dirH.y=0;const dist=dirH.length();dirH.normalize();
  const perp=V3(dirH.z,0,-dirH.x);
  let depth=0,lat=0;
  if(outcome==="swish"){depth=rnd(-0.03,0.03);lat=clamp(latErr*0.5,-0.06,0.06)+rnd(-0.02,0.02);}
  else if(outcome==="rattle"||outcome==="rattleout"){depth=0.17*Math.sign(err||1);lat=clamp(latErr,-0.12,0.12)+rnd(-0.05,0.05);}
  else if(outcome==="bank"){depth=0.55;lat=clamp(latErr*0.5,-0.1,0.1);}
  else if(outcome==="rimout"){depth=0.27*Math.sign(err||1);lat=clamp(latErr*1.2,-0.2,0.2)+rnd(-0.07,0.07);}
  else{depth=err>0?0.58:clamp(err*0.055,-1.5,-0.55);lat=clamp(latErr*2,-0.9,0.9)+rnd(-0.2,0.2);}
  let T;
  if(outcome==="bank")T=V3(clamp(lat*4,-0.55,0.55)+rnd(-0.08,0.08),3.45+rnd(0,0.25),-8.42);
  else T=HOOP.clone().addScaledVector(dirH,depth).addScaledVector(perp,lat);
  const tf=shotFlightTime(0.78+dist*0.062,G.myStar,shot);
  const v0=V3((T.x-p0.x)/tf,(T.y-p0.y)/tf+4.9*tf,(T.z-p0.z)/tf);
  const mesh=new THREE.Mesh(ballGeo,shotMat(shot));
  mesh.position.copy(p0);scene.add(mesh);
  const blob=new THREE.Mesh(blobGeo,blobMat.clone());
  blob.rotation.x=-Math.PI/2;blob.position.set(p0.x,0.02,p0.z);scene.add(blob);
  const hot=G.streak>=3;
  /* 火焰轨迹只奖励"这一球投得准",不奖励"最近手感好" ——
     所以门槛是出手误差落在甜区内圈(和 outcome==="swish" 同一条线),
     而不是连中数。连中只决定火烧得多旺(hot-hand.js 里按档加粒子)。
     换句话说:完美出手才点火,热手让火更粗。 */
  const perfect=a<=zone*0.5;
  const B={mesh,blob,p0:p0.clone(),v0,tf,t:0,phase:"fly",outcome,vel:new THREE.Vector3(),
    val:shot.val,baseVal:shot.baseVal||shot.val,bonus:shot.bonus||0,money:shot.money,deep:isDeep,super:!!shot.super,rush:isRush,made:false,life:3,bounces:0,
    rec:[],timeLeft:G.timer,hot,perfect,startPos:p0.clone(),shooterPos:P.pos.clone(),shooterFace:P.face,superChanceId:shot.superChanceId||0};
  B.resultClutch=noteResultAttempt(shot);balls.push(B);
  G.lastErr=err;
  // stats
  if(!G.practice&&!isBattle&&!isRush){
    if(isDeep)G.stats.deepT++;
    if(shot.money)G.stats.moneyT++;
  }
  if(isBattle){
    if(shot.super)G.stats.deepT++;
    battleUseSpot(shot.spotIdx);
    G.battleChargeSuperChanceId=0;
    G.shotIdx++;G.canShoot=false;
    afterPlayerLands(260,()=>{
      if(G.state!=="battle"||G.battleOver)return;
      if(!battleAutoMoveIfNeeded())readyBall();
    });
    return;
  }
  if(isRush){
    const rush=G.rush;if(!rush)return;
    rush.attempts++;rush.levelAttempts++;rush.shotNo++;G.shotIdx++;G.canShoot=false;
    const cfg=RACK_RUSH_LEVELS[rush.level],expectedCharge=shotIdeal(shot)/Math.max(1,playerChargeRate());
    const speedFeed=G.diff==="easy"?1.16:(G.diff==="hard"?.96:1.06);
    const feed=isRackRushSpeed(rush)?speedFeed:cfg.feed;
    // 供球节奏 = 蓄力 + 传球飞行 + 这里的间隔；飞行预算跟着 PASS_FLIGHT_RUSH 走。
    const flightBudget=typeof PASS_FLIGHT_RUSH!=="undefined"?PASS_FLIGHT_RUSH.budget:.27;
    const delay=Math.max(60,(feed-expectedCharge-flightBudget)*1000);
    afterPlayerLands(delay,()=>{if(G.state==="rackrush"&&G.running&&!G.buzzed)readyBall();});
    return;
  }
  // hero moment: last ball / buzzer beater / tiebreak
  const isLast=G.shotIdx===G.seq.length-1;
  /* 每日绝杀模式的核心是第一人称看球和全场反应,不切英雄时刻特写。 */
  if(G.mode!=="lastshot"&&!G.practice&&(isLast||G.state==="tiebreak"||(G.state==="round"&&G.timer<=3)))startHero(B);
  // advance
  G.shotIdx++;G.canShoot=false;
  const nxt=curShot();if(nxt){if(G.mode==="contest"&&shot&&nxt.rack!==shot.rack&&shot.rack!==null){if(nxt.rack===G.moneyRack)playAudioEvent("contest_moneyrack");else if(nxt.rack===4)playAudioEvent("contest_finalrack");}const samePos=isSameShotSpot(nxt,shot);afterPlayerLands(samePos?260:200,()=>{if(G.state!=="round"&&G.state!=="tiebreak")return;if(samePos){readyBall();}else{walkTo(nxt,()=>readyBall());}});}
}
function readyBall(){
  if(G.buzzed)return;
  if(G.mode==="battle"&&G.battleOver)return;
  if(!curShot())return;
  if(G.mode==="battle"&&!battleSpotAvailable(G.battleSpot)){
    if(battleAutoMoveIfNeeded())return;
  }
  handBall.visible=false;pBall.visible=false;
  updDotsUI();
  startPass();
}
function playRimImpactSound(b,made){
  if(!b||b.rimSoundPlayed)return false;
  b.rimSoundPlayed=true;
  if(made)sRimMake();else sClank();
  document.documentElement.dataset.lastRimSound=made?"make":"miss";
  return true;
}
function madeShotSound(b){
  if(b&&b.outcome==="rattle")return; // rim-make clip already played at first contact
  if(b&&b.outcome==="bank"){sRimMake();return;}
  sSwish();
}
function madeBall(b){
  b.made=true;
  triggerStreetCrowdReaction("make",b.val);
  if(G.practice){
    netPulse=1;madeShotSound(b);cheerSound(false);G.cheer=Math.min(1,G.cheer+0.4);
    if(navigator.vibrate)navigator.vibrate(18);
    popScore("✔ 命中","#7CFC6B");toast(CHEERS[(Math.random()*CHEERS.length)|0]);
    return;
  }
  noteResultMake(b);if(G.mode==="rackrush"){
    if(!G.rush||G.state!=="rackrush")return;
    const rush=G.rush,cfg=RACK_RUSH_LEVELS[rush.level],target=isRackRushSpeed(rush)?RACK_RUSH_SPEED_TARGET:rackRushTarget(rush.level);
    const prevTotal=rush.total;rush.levelScore+=b.val;rush.total+=b.val;rush.makes++;rush.levelMakes++;if(isRackRushSpeed(rush)){if(prevTotal<25&&rush.total>=25)playAudioEvent("speed100_25");else if(prevTotal<50&&rush.total>=50)playAudioEvent("speed100_50");else if(prevTotal<75&&rush.total>=75)playAudioEvent("speed100_75");else if(prevTotal<90&&rush.total>=90)playAudioEvent("speed100_90");}G.score=rush.total;G.streak++;G.missRun=0;rush.bestStreak=Math.max(rush.bestStreak,G.streak);
    bloomOnScore(b.val);netPulse=1;madeShotSound(b);
    const big=b.money||b.bonus||G.streak>=5;
    cheerSound(big);G.cheer=Math.min(1,G.cheer+(big ? .8 : .45));
    if(navigator.vibrate)navigator.vibrate(big?[16,24,16]:12);
    const label="+"+b.val+(b.bonus?" FINAL":"");
    popScore(label,b.bonus?"#ff5d4d":(b.money?"#ffd23f":"#7CFC6B"));
    const ending=isRackRushSpeed(rush)&&rush.total>=RACK_RUSH_SPEED_TARGET;
    if(ending)beginFinalAudioWindow();
    const momentumSpoke=!ending&&triggerMakeRunVoice();
    if(big&&!momentumSpoke)toast((b.money?"花球! ":"")+(b.bonus?"最后10秒加成 · ":"")+CHEERS[(Math.random()*CHEERS.length)|0],b.bonus?"#ff8d7a":"#ffd23f");
    if(G.streak>=3){$("hudStreak").style.display="block";$("hudStreak").textContent="🔥 x"+G.streak;}
    if(ending){updateRackRushHUD();updJumbo();finishRackRushSpeed();return;}
    if(!cfg.final&&!rush.levelCleared&&rush.levelScore>=target){rush.levelCleared=true;rackRushClearFlash();}
    updateRackRushHUD();updJumbo();return;
  }
  if(G.mode==="battle"){
    if(G.state!=="battle"||G.battleOver)return;
    if(b.super)battleConsumeSuperChance(b);
    const _pm=G.score,_po=G.battleOppScore;
    G.score+=b.val;G.streak++;G.missRun=0;
    bloomOnScore(b.val);
    G.stats.best=Math.max(G.stats.best,G.streak);
    if(b.super)G.stats.deepM++;
    $("scoreNum").textContent=Math.min(G.score,BATTLE_TARGET);
    netPulse=1;madeShotSound(b);
    const special=b.deep&&!b.super;
    const big=b.super||special||G.streak>=5;
    if(big)broadcastSting((b.super||special)?"danger":"score");
    cheerSound(big);G.cheer=Math.min(1,G.cheer+(big?1:0.6));
    if(navigator.vibrate)navigator.vibrate(big?[20,30,20]:18);
    popScore("+"+b.val,b.super?"#ffd23f":(special?"#54e05a":"#7CFC6B"));
    const ending=G.score>=BATTLE_TARGET;
    if(ending)beginFinalAudioWindow();
    const momentumSpoke=!ending&&triggerMakeRunVoice();
    if(!momentumSpoke)toast((b.super?"中场10分! ":(special?"彩球5分! ":""))+CHEERS[(Math.random()*CHEERS.length)|0]+(G.streak>=4?" x"+G.streak:""),b.super?"#ffd23f":(special?"#54e05a":"#7CFC6B"));
    if(!ending&&b.super)gameDjSay("中场超远,十分到手!","special",2.2);
    else if(!ending&&special)gameDjSay("彩球点,五分命中!","special",2.0);
    if(G.streak>=3){$("hudStreak").style.display="block";$("hudStreak").textContent="🔥 x"+G.streak;}
    if(!ending){battleCheckSuperMilestones();battleScoreCallout(_pm,_po);}
    updBattleUI();updJumbo();
    if(ending){finishBattle(true,b);return;}
    checkBattleOvertake(_pm,_po);
    return;
  }
  const prev=G.score;
  G.score+=b.val;G.streak++;G.missRun=0;
  bloomOnScore(b.val);
  G.stats.best=Math.max(G.stats.best,G.streak);
  if(b.money)G.stats.moneyM++;
  if(b.deep)G.stats.deepM++;
  $("scoreNum").textContent=G.score;
  // 反超检测 → 排队特写
  if(G.score>=CUTAWAY_MIN_SCORE){
    G.posted.forEach(p=>{
      if(!p.cut&&prev<=p.score&&G.score>p.score){p.cut=true;G.cutQ.push(p);}
    });
  }
  updTargetUI();
  netPulse=1;madeShotSound(b);
  const big=b.deep||b.val>=2||G.streak>=5;
  if(big)broadcastSting(b.deep?"danger":"score");
  cheerSound(big);G.cheer=Math.min(1,G.cheer+(big?1:0.6));
  if(navigator.vibrate)navigator.vibrate(big?[20,30,20]:18);
  popScore("+"+b.val,b.deep?"#54e05a":(b.money?"#ffd23f":"#7CFC6B"));
  const endingRound=G.seq&&G.shotIdx>=G.seq.length;if(endingRound){beginFinalAudioWindow();if(G.mode==="contest"&&typeof extPlay==="function")extPlay("crowdFinalMake");}
  const momentumSpoke=!endingRound&&triggerMakeRunVoice();
  if(!momentumSpoke)toast((b.deep?"⚡ 深远三分! ":"")+CHEERS[(Math.random()*CHEERS.length)|0]+(G.streak>=4?" 🔥x"+G.streak:""));
  if(!endingRound&&b.deep)gameDjSay("深远三分!","special",2.0);
  if(G.streak>=3){$("hudStreak").style.display="block";$("hudStreak").textContent="🔥 x"+G.streak;}
  updJumbo();
}
function missBall(){
  G.streak=0;$("hudStreak").style.display="none";
  triggerStreetCrowdReaction("miss",0);
  if(G.practice){
    const e=G.lastErr||0;
    toast(e>0?"发力过猛 · 跳过头才松手了":"出手太早 · 等跳到最高点","#ff8d7a");
    return;
  }
  if(G.mode==="battle"){
    if(G.state!=="battle"||G.battleOver)return;
    G.missRun=(G.missRun||0)+1;noteResultMissRun();
    if(Math.random()<0.45)aww();
    if(triggerMissRunVoice()){updBattleUI();return;}
    toast(MISSES[(Math.random()*MISSES.length)|0],"#ff8d7a");
    updBattleUI();
    return;
  }
  if(G.mode==="rackrush"){
    if(!G.rush||G.state!=="rackrush")return;
    G.missRun=(G.missRun||0)+1;noteResultMissRun();if(Math.random()<.35)aww();
    if(triggerMissRunVoice()){updateRackRushHUD();return;}
    if(Math.random()<.35)toast(MISSES[(Math.random()*MISSES.length)|0],"#ff8d7a");
    updateRackRushHUD();return;
  }
  G.missRun=(G.missRun||0)+1;noteResultMissRun();if(G.mode==="contest"&&G.seq&&G.shotIdx>=G.seq.length){if(typeof extPlay==="function")extPlay("crowdFinalMiss");}else{if(Math.random()<0.45)aww();}if(triggerMissRunVoice())return;
  // 连续打铁 → 对手垃圾话
  if(G.missRun>=2&&G.opponents.length&&Math.random()<0.35){
    const o=G.opponents[(Math.random()*G.opponents.length)|0];
    const tt=TALK_TAUNT[(Math.random()*TALK_TAUNT.length)|0];
    toast(o.n+":「"+tt+"」","#ff8d7a");
    rivalSay(o,tt);
  }else if(Math.random()<0.5)toast(MISSES[(Math.random()*MISSES.length)|0],"#ff8d7a");
}
function updBalls(dt){
  for(let i=balls.length-1;i>=0;i--){
    const b=balls[i];b.t+=dt;
    if(b.phase==="fly"){
      const t=Math.min(b.t,b.tf);
      b.mesh.position.set(b.p0.x+b.v0.x*t,b.p0.y+b.v0.y*t-4.9*t*t,b.p0.z+b.v0.z*t);
      b.mesh.rotation.x-=dt*9;b.mesh.rotation.z+=dt*2;
      if(b.t>=b.tf){
        const vy=b.v0.y-9.8*b.tf;
        if(b.outcome==="swish"){
          if(b.opp){
            oppScore(b);b.made=true;
          }else if(b.silent){
            triggerStreetCrowdReaction("make",b.val);
            netPulse=1;sSwish();applause(0.3,1.2);if(Math.random()<0.22)boo(1.2);G.cheer=Math.min(1,G.cheer+0.4);
            show.score+=b.val;$("showScore").textContent=show.score;
            popScore("+"+b.val,b.deep?"#54e05a":(b.money?"#ffd23f":"#7CFC6B"));
            if(typeof announceAIShowResult==="function")announceAIShowResult(b,true);
            b.made=true;
          }else madeBall(b);
          b.phase="fall";
          b.vel.set(b.v0.x*0.12,vy,b.v0.z*0.12);
          b.mesh.position.set(HOOP.x+rnd(-.04,.04),HOOP.y-0.05,HOOP.z+rnd(-.04,.04));
        }else if(b.outcome==="bank"){
          sBoard();b.phase="bankdrop";b.bt=0;
          b.bFrom=b.mesh.position.clone();
        }else if(b.outcome==="rattle"||b.outcome==="rattleout"){
          playerRimHaptic(b);b.rin=b.outcome==="rattle";playRimImpactSound(b,b.rin);b.phase="rattle";b.rt=0;
          b.ra=Math.atan2(b.mesh.position.z-HOOP.z,b.mesh.position.x-HOOP.x);
          b.rdir=Math.random()<.5?1:-1;
        }else if(b.outcome==="rimout"){
          playerRimHaptic(b);playRimImpactSound(b,false);if(b.opp)triggerStreetCrowdReaction("oppMiss",0);else if(b.silent){if(typeof announceAIShowResult==="function")announceAIShowResult(b,false);}else missBall();b.phase="free";
          const d=V3(b.mesh.position.x-HOOP.x,0,b.mesh.position.z-HOOP.z).normalize();
          b.vel.set(d.x*rnd(1.2,2.2)+rnd(-.6,.6),rnd(2.4,3.6),d.z*rnd(1.2,2.2)+rnd(-.6,.6));
        }else{
          if(b.opp)triggerStreetCrowdReaction("oppMiss",0);else if(b.silent){if(typeof announceAIShowResult==="function")announceAIShowResult(b,false);}else missBall();b.phase="free";
          b.vel.set(b.v0.x,vy,b.v0.z);
        }
      }
    }else if(b.phase==="rattle"){
      b.rt+=dt;const k=Math.min(1,b.rt/0.55);
      const sink=b.rin?0.45*k*k:0.18*k;
      const ang=b.ra+b.rt*9*b.rdir,rad=b.rin?0.2*(1-k):0.2;
      b.mesh.position.set(HOOP.x+Math.cos(ang)*rad,HOOP.y+0.08-sink,HOOP.z+Math.sin(ang)*rad);
      b.mesh.rotation.y+=dt*8;
      if(k>=1){
        if(b.rin){madeBall(b);b.phase="fall";b.vel.set(0,-1.6,0);}
        else{
          playerRimHaptic(b);playRimImpactSound(b,false);missBall();toast("😱 涮筐而出!","#ff8d7a");b.phase="free";
          const d=V3(Math.cos(b.ra+b.rt*9*b.rdir),0,Math.sin(b.ra+b.rt*9*b.rdir)).normalize();
          b.vel.set(d.x*rnd(1.4,2.4),rnd(2.0,3.0),d.z*rnd(1.4,2.4));
        }
      }
    }else if(b.phase==="bankdrop"){
      b.bt+=dt;const k=Math.min(1,b.bt/0.38);
      b.mesh.position.set(
        b.bFrom.x+(HOOP.x-b.bFrom.x)*k,
        b.bFrom.y+(HOOP.y-0.05-b.bFrom.y)*(k*k),
        b.bFrom.z+(HOOP.z-b.bFrom.z)*k);
      b.mesh.rotation.x+=dt*6;
      if(k>=1){madeBall(b);toast("🔨 打板入网!","#ffd23f");b.phase="fall";b.vel.set(0,-1.8,0);}
    }else if(b.phase==="roll"){
      const p=b.mesh.position,drag=Math.exp(-BALL_FLOOR_PHYSICS.rollDrag*dt);
      p.x+=b.vel.x*dt;p.z+=b.vel.z*dt;p.y=BALL_FLOOR_PHYSICS.y;
      b.vel.x*=drag;b.vel.z*=drag;b.vel.y=0;
      b.mesh.rotation.x-=b.vel.z*dt*3;b.mesh.rotation.z+=b.vel.x*dt*3;
      b.rollT=(b.rollT||0)+dt;b.life-=dt;
      if(b.life<=0||(b.rollT>=BALL_FLOOR_PHYSICS.rollLife&&Math.hypot(b.vel.x,b.vel.z)<.12)){
        scene.remove(b.mesh);scene.remove(b.blob);
        if(!b.silent)G.shots.push(b);
        balls.splice(i,1);continue;
      }
    }else{ // fall / free
      b.vel.y-=9.8*dt;
      b.mesh.position.addScaledVector(b.vel,dt);
      b.mesh.rotation.x-=b.vel.z*dt*3;b.mesh.rotation.z+=b.vel.x*dt*3;
      const p=b.mesh.position;
      // backboard
      if(b.phase==="free"&&b.vel.z<0&&p.z<-8.5&&p.z>-8.78&&Math.abs(p.x)<0.98&&p.y>2.9&&p.y<4.1){
        p.z=-8.5;b.vel.z*=-0.45;sBoard();
      }
      // floor
      if(p.y<BALL_FLOOR_PHYSICS.y&&b.vel.y<0){
        p.y=BALL_FLOOR_PHYSICS.y;
        if(resolveFloorBounce(b))sBounce();
      }
      b.life-=dt;
      if(b.life<=0){
        scene.remove(b.mesh);scene.remove(b.blob);
        if(!b.silent)G.shots.push(b);
        balls.splice(i,1);continue;
      }
    }
    if(b.perfect&&b.phase==="fly")emitFire(b.mesh.position);
    b.blob.position.set(b.mesh.position.x,0.02,b.mesh.position.z);
    const s=clamp(1.4-b.mesh.position.y*0.12,0.3,1.4);
    b.blob.scale.set(s,s,1);
    if(b.rec.length<240)b.rec.push([b.t,b.mesh.position.x,b.mesh.position.y,b.mesh.position.z]);
  }
}

window.AIBA.runtime.register("gameplay:shots",Object.freeze({
  balls,battleShot,curShot,shotBase,shotMat,shotIdeal,isSameShotSpot,buildSeq,setHandBall,
  updPowerUI,updDotsUI,startCharge,doRelease,releaseShot,readyBall,playRimImpactSound,madeBall,missBall,updBalls
}));
