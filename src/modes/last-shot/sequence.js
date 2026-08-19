/* ---------------- 每日挑战 · 绝杀时刻 | 回合时间线 ----------------
   时间线(回合内秒数 t,比赛钟 = cfg.gameClock - t):
     0.00        现场恢复比赛,5v5 按编排跑位,你以第一人称站在三分线外看着核心持球推进
     ~3.6        协防过来包夹核心(这就是球会分给你的原因)
     cfg.passAt  核心分球给你 —— 球在空中约 0.5 秒
     落地        G.canShoot=true,出手窗口开始,比赛钟走完即失败
   镜头只在"观看阶段"被本模式接管;球一到手就交还 updPlayCam,
   保证出手时的镜头与其他模式逐帧一致,不影响投篮手感。 */
(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  const cfgApi=global.AIBALastShotConfig,squadApi=global.AIBALastShotSquad;
  if(!runtime||!ctx||!cfgApi||!squadApi)throw new Error("Last Shot sequence requires runtime, config and squad");
  const {
    $,G,V3,clamp,scene,balls,player,passer,oppPasser,handBall,pBall,hands,confPts,CAM,P,rig,camTarget,LEGENDS,
    HOOP,ballGeo,matBall,faceTo,applyCamMode,ensureAudio,hidePanel,music,resetProgressiveSceneForRun,
    resetRackBalls,resetFinalRun,resetAudioCueMemory,enterArenaAudio,stopCelebrate,rivals,
    toast,paSay,sBeep,sGo,sBounce,sBuzz,broadcastSting,calibrateTilt,updPowerUI,updDotsUI,
    doRelease,boo,crowdSwell,playAudioEvent
  }=ctx;

  const LS={
    on:false,t:0,phase:"idle",cfg:null,practice:false,
    passed:false,released:false,resolved:false,pass:null,
    lookYaw:0,timedOut:false,reactionT:0,reactionStarted:false
  };

  function state(){return LS;}

  /* ---------------- HUD ---------------- */
  function hudSetup(cfg){
    const hud=$("hud");
    hud.dataset.mode="lastshot";hud.style.display="block";
    $("battleControls").style.display="none";$("battleScore").style.display="none";
    $("midBtn").style.display="none";$("hudStreak").style.display="none";
    $("scoreNum").textContent=cfg.scoreHome;
    $("hudTimer").style.display="block";
    // 窄屏(375px 竖屏)放不下完整队名,拆成短行,否则会折行成乱码样
    $("hudRound").innerHTML=`<b>${cfg.scoreHome} : ${cfg.scoreAway}</b>`
      +`<br><span style='font-size:9px;color:#8894a6'>${cfg.homeName} / ${cfg.awayName}</span>`
      +`<br><span style='color:#ff8d7a'>落后 ${cfg.scoreAway-cfg.scoreHome} 分</span>`;
    $("hudTarget").textContent=LS.practice?"练习模式 · 不计成绩":"每日挑战 · 仅此一次";
    updClock(cfg.gameClock);
  }
  function updClock(v){
    const el=$("hudTimer"),txt=Math.max(0,v).toFixed(1);
    if(el.textContent!==txt)el.textContent=txt;
    const cls=v<=3?"low":"";
    if(el.className!==cls)el.className=cls;
  }

  /* ---------------- 进场 ---------------- */
  function resetState(cfg,practice){
    resetFinalRun();resetAudioCueMemory();
    G.practice=false;G.battleCut=null;G.cutAway=null;G.cutQ=[];
    G.mode="lastshot";G.diff=G.diff||"normal";
    G.score=0;G.streak=0;G.missRun=0;G.shotIdx=0;G.shots=[];
    G.stats={best:0,moneyM:0,moneyT:0,deepM:0,deepT:0};
    /* 本模式不走 goDiff/pregame,这些字段得自己兜底:
       命中路径要读 G.posted(反超检测与目标 UI),打铁路径要读 G.opponents(垃圾话),
       出手弧线要读 G.myStar。缺任何一个都会在球落地那一刻抛异常。 */
    G.posted=[];G.opponents=[];
    if(!G.myStar)G.myStar=LEGENDS[0];
    if(G.myNum==null)G.myNum=23;
    G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;
    G.moving=false;G.glideCam=false;G.blindToasted=false;
    G.passCatch=null;
    // 单球赛制:一次出手就是全部。deep=null 走常规三分弧线。
    G.seq=[{rack:3,ball:0,val:3,money:false,deep:null,p:cfg.shotSpot.p,lastShot:true}];
    balls.slice().forEach(b=>{scene.remove(b.mesh);scene.remove(b.blob);});balls.length=0;
    const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    resetRackBalls();confPts.visible=false;
    rivals.forEach(rv=>{rv.active=false;rv.g.visible=false;});
    if(player._celeb)stopCelebrate(player);
    Object.assign(LS,{on:true,t:0,phase:"live",cfg,practice:!!practice,
      passed:false,released:false,resolved:false,pass:null,lookYaw:0,timedOut:false,
      reactionT:0,reactionStarted:false,celeb:null,madeAt:null,buzzAt:null,boardStarted:false,buzzed:false,foul:null,board:null,ftReady:false,ftBall:null,ftWait:0});
  }

  function beginLastShot(practice){
    const cfg=cfgApi.dailyChallenge();
    ensureAudio(false);hidePanel();music(false);resetProgressiveSceneForRun();
    resetState(cfg,practice);
    squadApi.build(cfg);
    squadApi.place(0);
    squadApi.show(true);
    squadApi.startPostShot();
    squadApi.setHandlerBall(true);
    // 你站在配置的三分线外投篮点,面向篮筐
    const spot=cfg.shotSpot.p;
    P.pos.copy(spot);P.face=faceTo(spot,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    LS.spot=spot.clone();LS.footT=0;   // 碎步围绕这个基准点游走，出手前必须收回来
    LS.lookYaw=P.face;
    // 强制第一人称:这是模式的核心体验,不允许切镜头
    CAM.mode=0;if(global.AIBASetIcon)global.AIBASetIcon("camBtn","camera",CAM.names[0]);
    ctx.setCamSnap(true);
    enterArenaAudio(.92);
    hudSetup(cfg);
    G.state="lastshot";G.running=true;
    applyCamMode();
    // 本模式自己管递球员,隐藏共用的两个背景递球角色
    passer.g.visible=false;oppPasser.g.visible=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    calibrateTilt();
    broadcastSting("danger");
    if(cfg.crowdMood==="away"&&typeof boo==="function")boo();
    paSay(cfg.commentary,true);
    toast("看球 · 球会分到你手上","#ffd23f");
  }

  /* ---------------- 传球:核心把球分给你 ---------------- */
  function startHandlerPass(){
    const handler=squadApi.handler();if(!handler)return;
    squadApi.setHandlerBall(false);
    const from=V3(handler.pos.x,1.28,handler.pos.z);
    // 接球点用第一人称视线略下方,和共用 startPass 的手感保持一致
    const to=global.eyePos();to.y-=0.3;
    const mesh=new THREE.Mesh(ballGeo,matBall);
    mesh.position.copy(from);scene.add(mesh);
    const dur=clamp(0.26+from.distanceTo(to)*0.032,0.34,0.6);
    LS.pass={mesh,from,to,t:0,dur};
    G.passCatch={active:true,progress:0,target:to.clone()};
    LS.passed=true;
    // 核心的传球动作
    const guy=handler.guy;
    guy.arms.forEach(a=>{a.rotation.x=-1.5;a.rotation.z=0;});
    guy.elbows.forEach(e=>{e.rotation.x=-0.9;});
    handler.passing=0;
    if(typeof playAudioEvent==="function")playAudioEvent("final_shot");
    crowdSwell&&crowdSwell(0.7);
  }
  function updHandlerPass(dt){
    const p=LS.pass;if(!p)return;
    p.t+=dt;const k=Math.min(1,p.t/p.dur);
    p.mesh.position.lerpVectors(p.from,p.to,k);
    p.mesh.position.y+=Math.sin(k*Math.PI)*0.5;
    if(G.passCatch){G.passCatch.active=k<1;G.passCatch.progress=k;G.passCatch.target.copy(p.mesh.position);}
    p.mesh.rotation.x-=dt*11;
    if(k>=1){
      scene.remove(p.mesh);LS.pass=null;
      if(G.passCatch){
        G.passCatch.active=true;G.passCatch.settling=true;G.passCatch.settle=0;G.passCatch.progress=1;
      }
      sBounce();
      if(navigator.vibrate)navigator.vibrate(8);
      // 交接:从这一刻起完全走共用的投篮生命周期
      G.canShoot=true;
      if(typeof global.setHandBall==="function")global.setHandBall();
      updPowerUI();updDotsUI();
      LS.phase="shoot";
      toast("出手!","#ff5d4d");
    }
  }

  /* 出手瞬间结算封盖。球的飞行是解析式 p0+v0·t-4.9t²、结果由 outcome 分支决定，
     所以既要削弱轨迹也要改 outcome，否则球被打飞了还会判进。 */
  /* 犯规概率。v2.19.5 起用上线值 FOUL_CHANCE_LIVE(1/3)；本地压测可临时切回 FOUL_CHANCE_TEST。
     注意判定门槛用的是"最近防守人距离"，不是 contestLevel——后者在 1.9m 之外
     恒为 0，拿它当门槛等于果断出手永远不可能被犯规(实测连打 10 盘一次都不触发)。
     FOUL_RANGE 3.4m 刚好覆盖正常节奏出手时防守人还在 2.9m 外的情形。 */
  const FOUL_CHANCE_TEST=.5,FOUL_CHANCE_LIVE=.33;
  const FOUL_CHANCE=FOUL_CHANCE_LIVE,FOUL_RANGE=3.4;
  const FT_RATE=.76,CELEBRATE_DELAY=.2,BUZZER_DELAY=.2;
  function applyContest(){
    if(!squadApi.contestLevel)return false;
    const level=squadApi.contestLevel(P.pos);
    const b=balls.length?balls[balls.length-1]:null;
    if(!b||b.phase!=="fly")return false;
    /* 分两档，对应"降低手感"和"直接封盖"：
         · level ≥ .72 —— 他跳起来了而且贴在正面：直接封盖
         · level ≥ .38 —— 手举在你脸前：按概率把好结果降级，甜区手感被吃掉
       正常节奏出手时他还在两米开外，level 为 0，完全不受影响。 */
    /* 极小概率吹犯规：贴防越紧越容易打手。球进了算 3+1，没进就是三罚。
       绝杀模式不做罚球交互(7 秒定生死，插一段交互会毁掉节奏)，按 76% 命中自动结算。 */
    const foulDist=squadApi.defenderDistance?squadApi.defenderDistance(P.pos):99;
    if(foulDist<=FOUL_RANGE&&Math.random()<FOUL_CHANCE){
      /* 罚球必须由你自己投，不能拿概率算掉——那是这一攻最关键的几下。
         这里只记账，等球落定后进入罚球阶段。 */
      const willMake=b.outcome==="swish"||b.outcome==="rattle"||b.outcome==="bank";
      LS.foul={andOne:willMake,shots:willMake?1:3,made:0,taken:0};
      if(willMake){
        toast("🙌 打手犯规 · 3+1！","#7CFC6B");
      }else{
        b.outcome="miss";b.made=false;
        b.v0.multiplyScalar(.62);b.tf=Math.max(.4,b.tf*.7);
        toast("🙌 投篮犯规 · 三次罚球","#ffd23f");
      }
      return true;
    }
    if(level>=.72){
      b.outcome="miss";b.made=false;
      b.v0.multiplyScalar(.44);b.v0.y*=.52;
      b.v0.x+=(Math.random()<.5?-1:1)*1.5;
      b.tf=Math.max(.4,b.tf*.6);
      LS.blocked=true;
      toast("🚫 被封盖","#ff8d7a");
      return true;
    }
    if(level>=.38&&Math.random()<level){
      const drop={swish:"rattle",rattle:"rattleout",bank:"rattleout",rimout:"miss"};
      const next=drop[b.outcome];
      if(next){
        b.outcome=next;
        if(next==="miss"||next==="rattleout")b.made=false;
        LS.contested=true;
        toast("✋ 被干扰 · 手感受影响","#ffd23f");
        return true;
      }
    }
    return false;
  }

  /* 抢下篮板之后的球权处理：
       · 防守方抢到(约 72%) —— 收球后转身把球外传给队友，进攻结束；
       · 我方抢到 —— 落地立刻补篮(或空中点拨)，但**一定不会进**：
         这是绝杀模式，胜负只能由你那一投决定，补篮进球会抢走整个叙事。 */
  const PUTBACK_DELAY=.28;
  function updateRebound(dt,activeBall){
    const rb=LS.board;if(!rb||!rb.active||!rb.secured)return;
    rb.securedAt=(rb.securedAt||0)+dt;
    if(!rb.ballTaken){
      rb.ballTaken=true;
      // 原来的球收走，改由抢到球的人抱着
      if(activeBall){scene.remove(activeBall.mesh);scene.remove(activeBall.blob);
        const i=balls.indexOf(activeBall);if(i>=0)balls.splice(i,1);}
      squadApi.setActorBall(rb.winner,true);
      toast(rb.ally?"🔥 前场篮板!":"🛡 防守篮板","#9fd1ff");
    }
    if(rb.ally&&!rb.putbackDone&&rb.securedAt>=PUTBACK_DELAY){
      rb.putbackDone=true;
      squadApi.startPutback(rb.winner);
      // 补篮球：必定打铁弹出，绝不落进
      const from=squadApi.actorHand(rb.winner);
      if(from){
        const mesh=new THREE.Mesh(ballGeo,matBall);
        mesh.position.copy(from);scene.add(mesh);
        const miss=V3(HOOP.x+(Math.random()<.5?-1:1)*(.42+Math.random()*.3),HOOP.y+.18,HOOP.z+.34);
        LS.putback={mesh,from:from.clone(),to:miss,t:0,dur:.34+Math.random()*.12};
        squadApi.setActorBall(rb.winner,false);
      }
    }
    if(!rb.ally&&!rb.outletDone&&rb.securedAt>=PUTBACK_DELAY+.25){
      rb.outletDone=true;squadApi.startOutlet(rb.winner);
    }
    if(LS.putback){
      const p=LS.putback;p.t+=dt;const k=Math.min(1,p.t/p.dur);
      p.mesh.position.lerpVectors(p.from,p.to,k);
      p.mesh.position.y+=Math.sin(k*Math.PI)*.55;
      p.mesh.rotation.x-=dt*12;
      if(k>=1){
        // 打在框上弹开，落地后移除——不会有任何得分
        p.mesh.position.y=Math.max(.2,p.mesh.position.y-dt*2);
        if(p.t>p.dur+.7){scene.remove(p.mesh);LS.putback=null;}
      }
    }
  }
  /* ---------------- 罚球 ----------------
     被吹犯规后由你自己站上罚球线一罚一罚投。罚球期间比赛钟停表(真实规则如此)，
     防守人退到禁区两侧不干扰。 */
  const FT_LINE_Z=4.6;
  function beginFreeThrows(){
    const f=LS.foul;if(!f||LS.phase==="freethrow")return;
    LS.phase="freethrow";LS.ftReady=false;
    // 站上罚球线，正对篮筐
    const spot=V3(HOOP.x,0,HOOP.z+FT_LINE_Z);
    P.pos.copy(spot);LS.spot=spot.clone();
    P.face=faceTo(spot,HOOP);LS.lookYaw=P.face;
    P.jump=0;P.eyeDip=0;
    balls.slice().forEach(b=>{scene.remove(b.mesh);scene.remove(b.blob);});balls.length=0;
    if(LS.putback){scene.remove(LS.putback.mesh);LS.putback=null;}
    squadApi.lineUpForFreeThrow(spot);
    paSay(f.andOne?"加罚一次":"三次罚球",true);
    nextFreeThrow();
  }
  function nextFreeThrow(){
    const f=LS.foul;
    if(f.taken>=f.shots){finishFreeThrows();return;}
    G.shotIdx=0;G.shots=[];
    G.seq=[{rack:3,ball:0,val:1,money:false,deep:null,p:LS.spot.clone(),freeThrow:true}];
    G.canShoot=true;G.charging=false;G.power=0;G.buzzed=false;
    if(typeof global.setHandBall==="function")global.setHandBall();
    updPowerUI();updDotsUI();
    LS.ftReady=true;
    toast("罚球 "+(f.taken+1)+" / "+f.shots,"#ffd23f");
  }
  function updateFreeThrows(dt){
    const f=LS.foul;if(!f||LS.phase!=="freethrow")return;
    squadApi.updatePostShot(dt,null,P.pos,null);
    const b=balls.length?balls[balls.length-1]:null;
    // 出手了：等球落定再记账
    if(LS.ftReady&&G.shotIdx>0){LS.ftReady=false;LS.ftBall=b;}
    if(!LS.ftReady&&LS.ftBall){
      if(ballSettled(LS.ftBall)){
        if(LS.ftBall.made)f.made++;
        f.taken++;LS.ftBall=null;LS.ftWait=0;
      }
    }else if(!LS.ftReady&&!LS.ftBall){
      /* 罚完最后一球必须收尾。原来这个分支带 f.taken<f.shots 条件，
         最后一罚落定后两个分支都不成立——整个模式永远卡在罚球阶段，没有后续。 */
      LS.ftWait=(LS.ftWait||0)+dt;
      if(LS.ftWait>=.6){
        LS.ftWait=0;
        if(f.taken<f.shots)nextFreeThrow();
        else finishFreeThrows();
      }
    }
  }
  function finishFreeThrows(){
    const f=LS.foul;
    G.canShoot=false;
    LS.phase="reaction";
    const pts=(f.andOne?3:0)+f.made;
    toast("罚球 "+f.made+"/"+f.shots+" · 本攻共 "+pts+" 分",pts>=2?"#7CFC6B":"#ff8d7a");
    squadApi.startReaction(pts>=2,P.pos);LS.reactionStarted=true;startPlayerCelebrate(pts>=2);
  }
  /* 全场只在球飞向篮筐的这一段用眼睛跟球。一旦进网、砸框、开始弹跳，或者球已经
     掉到篮筐高度以下(空气球)，结果就已经定了——再跟下去就是十个人跟着球在地上
     上下点头。这时返回 null，poseWatcher 会平滑把目光收回篮筐。 */
  /* 结果已定：进网 / 触框 / 开始弹跳 / 抛物线飞完。
     绝不能用"球低于篮筐高度"——出手点才 2.1m、篮筐 3.05m，球一离手就满足，
     结果就是你刚出手全场已经开始庆祝了。 */
  const MAKE_OUTCOMES={swish:true,rattle:true,bank:true};
  function ballSettled(ball){
    if(!ball||!ball.mesh)return false;
    return !!(ball.made||ball.rimSoundPlayed||ball.bounces>0||ball.phase!=="fly");
  }
  function gazeTarget(ball){
    if(!ball||!ball.mesh)return null;
    if(ballSettled(ball))return null;
    return ball.mesh.position;
  }

  /* ---------------- 帧更新 ---------------- */
  function updateLastShot(dt){
    if(!LS.on||G.state!=="lastshot")return;
    const cfg=LS.cfg;
    // 罚球阶段：比赛钟停表，只跑罚球流程
    if(LS.phase==="freethrow"){updateFreeThrows(dt);return;}
    // 出手之后比赛钟继续走——球在空中时间照跑，这才是真实的最后一攻。
    LS.t+=dt;
    updateBodyState(dt);
    updatePlayerCelebrate(dt);
    const clock=cfg.gameClock-LS.t;
    updClock(clock);

    // 不夹到 liveDur:路点走完的人自然停住。出手后切换为全场转身追球姿势。
    const activeBall=balls.length?balls[balls.length-1]:null;
    if(LS.released){
      squadApi.updatePostShot(dt,gazeTarget(activeBall),P.pos,
        activeBall&&activeBall.mesh?activeBall.mesh.position:null);
      /* 结果一定下来就立刻反应，不要等球在地上弹三下。判据和视线收回是同一套：
         进网 / 触框 / 开始弹跳 / 掉到篮筐高度以下。之前只在 made 时才即时反应，
         打铁要等球从 balls 里消失，中间几秒全场就那么僵着——很不连贯。 */
      /* 庆祝只有两个启动点：
           1) 球真的进框了 —— 进球后 0.5 秒开始庆祝；
           2) 没进而且时间走完了 —— 我方懊恼、对方庆祝。
         球没进但时间还有，那是抢篮板的混战，谁也不该在这时候庆祝。 */
      // 有犯规：等这一球落定就去罚球线，不进入常规反应
      if(LS.foul&&!LS.reactionStarted&&(!activeBall||ballSettled(activeBall))){
        beginFreeThrows();return;
      }
      if(!LS.reactionStarted&&activeBall&&activeBall.made){
        if(LS.madeAt==null)LS.madeAt=LS.t;
        if(LS.t-LS.madeAt>=CELEBRATE_DELAY){
          squadApi.startReaction(true,P.pos);LS.reactionStarted=true;LS.phase="reaction";startPlayerCelebrate(true);
        }
      }
      // 球已经打铁落定：进入抢篮板，不是庆祝
      if(!LS.reactionStarted&&activeBall&&ballSettled(activeBall)&&!activeBall.made&&!LS.boardStarted){
        LS.boardStarted=true;LS.board=squadApi.startRebound(activeBall.mesh.position);
      }
      updateRebound(dt,activeBall);
      /* 时间走完，但球还在空中：不能直接判负。真实规则是出手在结束前、球进了就算，
         所以这里等球落定，交给 D1(进球) / D2(打铁) 去响应。 */
      if(!LS.reactionStarted&&clock<=0&&(!activeBall||ballSettled(activeBall))){
        if(LS.buzzAt==null)LS.buzzAt=LS.t;
        if(LS.t-LS.buzzAt>=BUZZER_DELAY){
          const _m=shotSucceeded();squadApi.startReaction(_m,P.pos);LS.reactionStarted=true;LS.phase="reaction";startPlayerCelebrate(_m);
        }
      }
    }else{
      /* 把攻防阶段告诉 squad：球一传出，盯你的防守人才开始 closeout；
         球到手后开始计时，拖太久他会起跳封盖。 */
      if(G.canShoot&&!LS.released)LS.holdT=(LS.holdT||0)+dt;
      /* 你一起跳，防守人就跟着起跳(他自己隔 0.08–0.28s 的视觉反应)。
         用 P.jump 而不是秒表：起跳到出手只有 0.19 秒，任何时间阈值都等不到。 */
      if(!LS.contestTriggered&&P.jump>.04&&G.charging){
        LS.contestTriggered=true;
        if(squadApi.triggerContest)squadApi.triggerContest(P.pos);
      }
      squadApi.update(LS.t,dt,P.pos,{passing:!!LS.pass,inHand:G.canShoot&&!LS.released,chargeT:LS.holdT||0});
    }
    // 共用递球员在本模式全程不出现(applyCamMode 会按 inPlay 打开它们)
    passer.g.visible=false;oppPasser.g.visible=false;

    if(!LS.passed&&LS.t>=cfg.passAt)startHandlerPass();
    if(LS.pass)updHandlerPass(dt);

    if(!LS.released&&G.shotIdx>0){
      LS.released=true;LS.phase="flight";G.running=false;
      /* 记下这一投的诊断数据，供结算时告诉玩家"下次该怎么调"。
         err = 实际力度 - 理想力度；contest = 出手瞬间的干扰强度。 */
      const shot=G.seq&&G.seq[0];
      LS.diag={
        err:typeof G.lastErr==="number"?G.lastErr:0,
        zone:typeof playerSweetZone==="function"?playerSweetZone():8,
        contest:squadApi.contestLevel?squadApi.contestLevel(P.pos):0,
        holdT:LS.holdT||0,
        // 过了顶点还没松手，err 会被物理系统按晚出手扣力度、符号变得不可信；
        // late 是扣减前记的原始信号，诊断必须先看它。
        late:typeof G.lastReleaseLate==="number"?G.lastReleaseLate:0
      };
      applyContest();
      if(LS.diag)LS.diag.err=typeof G.lastErr==="number"?G.lastErr:LS.diag.err;
    }
    // 超时:球到手了但没出手,或者根本没敢出手
    if(!LS.released&&!LS.timedOut&&clock<=0){
      LS.timedOut=true;G.buzzed=true;G.running=false;
      if(G.charging)doRelease();
      if(!G.charging&&G.shotIdx===0){
        G.canShoot=false;handBall.visible=false;pBall.visible=false;
        sBuzz();toast("⏱ 没能出手","#ff8d7a");
        finish(false,"timeout");
        return;
      }
    }
    // 最后 5 秒每秒一响，出手后时钟还在走也继续响到 0
    if(clock<=5&&clock>0){
      const beat=Math.ceil(clock);
      if(LS._beat!==beat){LS._beat=beat;sBeep();}
    }
    if(clock<=0&&!LS.buzzed){LS.buzzed=true;sBuzz();}
    // 不立刻切英雄时刻:球落定后保留一段静默观察窗口,让全场反应完成。
    // 兜底：球已被移除但反应还没起（正常情况 ballSettled 早就触发了）
    if(LS.released&&!LS.resolved&&!LS.reactionStarted&&!G.charging&&!activeBall){
      const made=shotSucceeded();
      squadApi.startReaction(made,P.pos);LS.reactionStarted=true;LS.phase="reaction";startPlayerCelebrate(made);
    }
    if(LS.released&&!LS.resolved&&LS.reactionStarted){
      LS.reactionT+=dt;
      if(LS.reactionT>=3.6&&!G.charging){
        const made=shotSucceeded();
        finish(made,"shot");
      }
    }
  }

  /* ---------------- 观看阶段镜头 ----------------
     只在球到手之前生效:第一人称原地转头盯着持球核心。
     球一到手就 return false,把镜头完全交还给 updPlayCam。 */
  /* 身体状态(站位/朝向/碎步)必须每帧更新，且与镜头模式无关。
     以前这段写在 updateLastShotCam 里，而那个函数在非第一人称直接 return false——
     切到第三人称就会看到你的球员钉在原地、脸永远朝着篮筐，和第一人称完全对不上。
     现在这里只算身体状态，镜头函数只负责读。 */
  /* ---------------- 你自己的庆祝 ----------------
     第一人称下"你"只剩两条手臂和一颗镜头，所以庆祝必须靠三样东西表达：
       1) 手臂 —— 挥拳 / 双手高举 / 单手挥手，三选一，幅度与频率每局随机；
          姿势写完照样过 squad 的 guardArms，绝不允许出现单臂斜前方伸直；
       2) 身体 —— 原地小跳 + 左右走动，通过 P.jump / P.pos 反映到镜头的起伏位移；
       3) 队友 —— 冲过来庆祝的人真的跑到你身边时才触发一次推搡冲击，
          镜头侧向被撞开再缓和回正(不是定时器假装的晃动)。
     没进球时走另一套：双手抱头、不跳、镜头几乎不动。 */
  const CELEB_STYLES=["fist","both","wave"];
  const HOP_SECONDS=.44,BUMP_RANGE=1.62,CELEB_BACK=1.42;
  function startPlayerCelebrate(made){
    LS.celeb={
      made:!!made,t:0,
      style:made?CELEB_STYLES[(Math.random()*CELEB_STYLES.length)|0]:"sag",
      amp:.82+Math.random()*.42,rate:.86+Math.random()*.42,phase:Math.random()*6.283185,
      hop:0,hopGap:.18+Math.random()*.4,
      walkRate:.62+Math.random()*.5,walkDir:Math.random()<.5?-1:1,
      bump:0,bumpDir:0,bumped:{}
    };
  }
  function updatePlayerCelebrate(dt){
    const c=LS.celeb;if(!c)return;
    c.t+=dt;
    // 小跳：hop 从 1 线性衰减到 0，sin(π·hop) 就是一次完整的起落
    if(c.made){
      if(c.hop>0)c.hop=Math.max(0,c.hop-dt/HOP_SECONDS);
      else{c.hopGap-=dt;if(c.hopGap<=0){c.hop=1;c.hopGap=.5+Math.random()*.9;}}
    }
    const hopY=c.hop>0?Math.sin(c.hop*Math.PI)*.30:0;
    // 队友撞上来：每人只撞一次，触发条件是他真的挤到 BUMP_RANGE 以内
    const mate=squadApi.nearestMate?squadApi.nearestMate(P.pos):null;
    if(c.made&&mate&&mate.dist<BUMP_RANGE&&!c.bumped[mate.id]){
      c.bumped[mate.id]=1;c.bump=1;c.bumpDir=Math.random()<.5?-1:1;
      if(navigator.vibrate)navigator.vibrate(22);
    }
    c.bump=Math.max(0,c.bump-dt*1.8);

    const guy=player;
    if(guy&&guy.arms&&guy.elbows){
      const w=Math.sin(c.t*6.6*c.rate+c.phase),w2=Math.sin(c.t*6.6*c.rate+c.phase+2.3);
      /* 必须用 rotation.set 写满三个轴：投篮链路会在肩上留下 rotation.y(实测出手后
         辅助手残留 y=0.48)，只改 x/z 的话那截残留会一直挂着，两只手在画面里
         一高一低、一个朝上一个朝右，完全不像"举起双手"。手腕同理，用 poseHandJoints
         拉回中立帧，否则还保持着压腕的投篮手型。 */
      const setArm=(i,x,z,el)=>{
        guy.arms[i].rotation.set(x,0,z);
        guy.elbows[i].rotation.set(el,0,0);
      };
      if(c.style==="fist"){
        // 握拳下拉：肘大幅弯曲、手臂留在体侧，天然避开敏感区间
        setArm(0,-.86+.36*w*c.amp,-.30,-1.76+.42*w);
        setArm(1,-.34,.22,-.88);
      }else if(c.style==="both"){
        // 双手高举：接近垂直，左右各 30° 以内挥动，肘保持自然弯曲
        setArm(0,-2.84+.12*w,-.30-.20*w*c.amp,-.56-.24*Math.abs(w));
        setArm(1,-2.84+.12*w2,.30+.20*w2*c.amp,-.56-.24*Math.abs(w2));
      }else if(c.style==="wave"){
        setArm(0,-2.76+.10*w,-.34-.20*w*c.amp,-.60-.26*Math.abs(w));
        setArm(1,-.32+.12*w2,.20,-.84);
      }else{
        /* 没进：双手抱头。肘必须大幅弯(-1.6)，否则手落在身体两侧、上臂在第一人称
           又是隐藏的，画面里就只剩左右下角两坨断开的方块——实测手的 NDC 停在
           (±0.54,-0.17)。弯到位后手抬到头侧(世界高 1.77m)，NDC(±0.52,+0.08)。 */
        const sag=Math.sin(c.t*1.5+c.phase)*.06;
        setArm(0,-2.30+sag,-.20,-1.60);
        setArm(1,-2.30-sag,.20,-1.60);
      }
      if(typeof poseHandJoints==="function")poseHandJoints(guy,{lift:0,dip:0,rise:0,jmp:0,over:0});
      // 起跳时收腿，落地才伸直——不然是"直着腿飘起来"
      if(guy.knees){guy.knees[0].rotation.x=.42*hopY/.30;guy.knees[1].rotation.x=.36*hopY/.30;}
      if(squadApi.guardArms)squadApi.guardArms(guy);
      // 第三人称球员姿势已经改完，把同一组肩肘腕镜像给第一人称
      if(global.AIBAShotMotion&&global.AIBAShotMotion.syncFp)global.AIBAShotMotion.syncFp();
    }

    // 走动：绕投篮点小范围游走，第一人称看到的就是"人在动"
    const side=V3(Math.cos(LS.lookYaw),0,-Math.sin(LS.lookYaw));
    const sway=Math.sin(c.t*c.walkRate+c.phase)*(c.made?.34:.06)*c.walkDir;
    const push=c.bump*c.bumpDir*.26;
    P.pos.x=LS.spot.x+side.x*(sway+push);
    P.pos.z=LS.spot.z+side.z*(sway+push);
    P.jump=hopY;
    P.eyeDip=c.made?0:-.05;
    P.face=LS.lookYaw+(c.made?Math.sin(c.t*.85+c.phase)*.12:.02)+c.bump*c.bumpDir*.20;
  }
  /* 庆祝阶段自己接管第一人称镜头：共用的 updPlayCam 会把视线死锁在篮筐上，
     庆祝时人是转着头蹦的，锁筐等于站着不动只有手在抖。 */
  /* ---------------- 庆祝镜头：切过肩第三人称 ----------------
     第一人称下"你"只有两条镜像出来的手臂，肩和上臂是刻意隐藏的
     （FP_HIDDEN_PARTS，因为相机在眼后 0.85m 时肩块会糊住画面底部）。
     庆祝时相机后拉，那截藏掉的部分就露馅了 —— 两只手悬在空中没有身体。

     而庆祝本来就是"看别人"的镜头：队友推搡、对手挑衅、全场反应，
     第一人称反而全看不到。所以这几秒切到过肩第三人称：
     身体显出来、手接回身上，顺带把周围的反应一起框进画面。
     出手瞬间仍然是第一人称，手感取景不受影响。 */
  const CELEB_BACK_3P=2.6, CELEB_SIDE=0.95, CELEB_HEIGHT=1.95;
  function setCelebrateView(on){
    /* applyCamMode() 只在切机位时跑，这里直接改可见性即可。
       hands 关掉后 animFpRig 会自动收起第一人称镜像骨架。 */
    if(typeof hands!=="undefined"&&hands)hands.visible=on?false:(CAM.mode===0);
    if(player&&player.g)player.g.visible=on?true:(CAM.mode!==0);
  }
  function updateCelebrateCam(){
    const c=LS.celeb;if(!c||CAM.mode!==0)return false;
    setCelebrateView(true);
    const yaw=P.face;
    const dir=V3(Math.sin(yaw),0,Math.cos(yaw));      // 身体朝向
    const right=V3(Math.cos(yaw),0,-Math.sin(yaw));   // 身体右侧
    const bob=c.made?Math.sin(c.t*3.4+c.phase)*.03:0;
    const kick=c.bump*c.bumpDir;                       // 被撞那一下的侧向冲击
    // 过肩：退到身后偏一侧，略高于头顶，看向自己的上半身
    rig.pos.set(
      P.pos.x-dir.x*CELEB_BACK_3P+right.x*(CELEB_SIDE+kick*.35),
      CELEB_HEIGHT+P.jump*.35+bob,
      P.pos.z-dir.z*CELEB_BACK_3P+right.z*(CELEB_SIDE+kick*.35)
    );
    rig.look.set(
      P.pos.x+dir.x*.45+right.x*kick*.25,
      1.45+P.jump*.55+(c.made?Math.sin(c.t*1.1+c.phase)*.06:-.12),
      P.pos.z+dir.z*.45+right.z*kick*.25
    );
    return true;
  }
  function updateBodyState(dt){
    if(!LS.on||!LS.spot)return;
    if(LS.released||LS.phase==="flight"||LS.phase==="reaction")return;
    const handler=squadApi.handler();
    /* 球一到手就必须朝篮筐——传球飞行结束后 LS.pass 会被清空，如果这里还退回
       "看持球人"，身体会转回左路的核心，投篮手直接被甩出画面左侧(实测腕 NDC
       x=-1.27、球 -1.50，全部出画)。squared up 之后只认篮筐。 */
    const inHand=G.canShoot&&!LS.released;
    const target=(inHand||!handler)?V3(HOOP.x,HOOP.y+0.15,HOOP.z)
      :V3(handler.pos.x,1.5,handler.pos.z);
    if(LS.pass){
      /* 球一出手就开始把视线摆向篮筐,接到球时已经squared up。
         这一段不能等球落地才转:扑防的人正是这零点几秒里横穿视线的,
         盯着传球人会被他整个挡死,而且现实里球传给你时你也该看筐。 */
      const k=clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1);
      const e=k*k*(3-2*k);
      target.lerp(V3(HOOP.x,HOOP.y+0.15,HOOP.z),e);
    }
    const want=faceTo(P.pos,target);
    let d=want-LS.lookYaw;while(d>Math.PI)d-=6.283185307;while(d<-Math.PI)d+=6.283185307;
    // 传球途中要跟上插值,不能再用慢平滑,否则接到球那一刻会硬切
    LS.lookYaw+=d*Math.min(1,dt*(LS.pass?14:4.5));
    /* 等球的时候你不是一根木桩：小碎步左右调整找空位。幅度必须小(位置 ±0.18m)——
       够有"人在动"的呼吸感，又不至于让你觉得瞄准点在飘。
       球一进入传球段就收住，出手时脚下必须是稳的。 */
    LS.footT=(LS.footT||0)+dt;
    LS.settle=LS.pass?1-clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1):1;
    const sway=Math.sin(LS.footT*1.15)*0.18*LS.settle;
    const drift=Math.sin(LS.footT*0.74+1.7)*0.10*LS.settle;
    const side=V3(Math.cos(LS.lookYaw),0,-Math.sin(LS.lookYaw));
    P.pos.x=LS.spot.x+side.x*sway+Math.sin(LS.lookYaw)*drift;
    P.pos.z=LS.spot.z+side.z*sway+Math.cos(LS.lookYaw)*drift;
    // 第三人称模型必须朝着你实际在看的方向，否则两个视角是两个人
    P.face=LS.lookYaw;
  }
  function updateLastShotCam(dt){
    if(LS.on&&LS.celeb&&updateCelebrateCam())return true;
    if(!LS.on||LS.phase==="shoot"||LS.phase==="flight"||LS.released)return false;
    if(CAM.mode!==0)return false;   // 玩家手动切了机位就别抢镜头
    const handler=squadApi.handler();if(!handler)return false;
    const target=V3(handler.pos.x,1.5,handler.pos.z);
    if(LS.pass){
      const k=clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1);
      const e=k*k*(3-2*k);
      target.lerp(V3(HOOP.x,HOOP.y+0.15,HOOP.z),e);
    }
    // 双脚交替落地的上下起伏，频率是碎步的两倍
    const bob=Math.sin((LS.footT||0)*2.30)*0.015*(LS.settle==null?1:LS.settle);
    const eye=V3(P.pos.x,1.78+P.eyeDip+bob,P.pos.z);
    const dir=V3(Math.sin(LS.lookYaw),0,Math.cos(LS.lookYaw));
    /* 抬升量与共用第一人称保持一致(camera.js FP_RISE)。原本写死 +0.28 会让观看阶段的
       相机站到 2.06m——比防守人头顶还高，接球时双手被压出画面下缘。 */
    rig.pos.set(eye.x-dir.x*0.85,eye.y+(typeof FP_RISE==="number"?FP_RISE:0.05),eye.z-dir.z*0.85);
    rig.look.copy(target);
    return true;
  }

  /* ---------------- 结算 ---------------- */
  /* 你落后 1 分，所以"赢"= 这一攻至少拿 2 分。带罚球时要把罚中的分算进去：
     3+1 命中即赢；三罚至少中 2 个才赢。 */
  function shotSucceeded(){
    const base=G.shots.length?!!G.shots[G.shots.length-1].made:(G.score>0);
    const foul=LS.foul;
    if(!foul)return base;
    const pts=(foul.andOne?3:0)+(foul.made||0);
    return pts>=2;
  }
  function finish(made,reason){
    if(LS.resolved)return;
    setCelebrateView(false);
    LS.resolved=true;LS.on=false;LS.phase="done";
    G.running=false;G.canShoot=false;G.passCatch=null;
    if(global.AIBALastShotResult)global.AIBALastShotResult.show(LS.cfg,made,reason,LS.practice,LS.diag||null);
  }

  function exitLastShot(){
    setCelebrateView(false);   // 还原第一人称，否则手没了、身体一直显着
    LS.on=false;LS.phase="idle";G.running=false;G.canShoot=false;G.passCatch=null;
    if(LS.pass){scene.remove(LS.pass.mesh);LS.pass=null;}
    squadApi.dispose();
    const hud=$("hud");if(hud)hud.dataset.mode="";
  }

  const api=Object.freeze({beginLastShot,updateLastShot,updateLastShotCam,exitLastShot,finish,state});
  Object.assign(global,{updateLastShot,updateLastShotCam,beginLastShot,exitLastShot});
  global.AIBALastShotSequence=api;
  runtime.register("mode:last-shot:sequence",api);
})(window);
