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
    resetRackBalls,resetFinalRun,resetAudioCueMemory,enterArenaAudio,leaveArenaAudio,stopCelebrate,rivals,
    toast,paSay,sBeep,sGo,sBounce,sBuzz,broadcastSting,whistle,calibrateTilt,updPowerUI,updDotsUI,
    doRelease,boo,crowdSwell,playAudioEvent
  }=ctx;

  const LS={
    on:false,t:0,phase:"idle",cfg:null,practice:false,
    passed:false,released:false,resolved:false,pass:null,
    lookYaw:0,timedOut:false,shotMade:false,callStyle:"both_target",
    introT:0,introDur:14.0,introBall:null,introCut:-1,reactionT:0,reactionStarted:false,
    stageIdx:0,tmacHome:0,tmacAway:0,interlude:null,interludeT:0,interludeBall:null,interludeAwayDone:false
  };

  function isMultiStage(){return !!(LS.cfg&&LS.cfg.multiStage&&Array.isArray(LS.cfg.stages));}
  function currentStage(){return isMultiStage()?(LS.cfg.stages[LS.stageIdx]||null):null;}
  function stageClock(){const st=currentStage();return st?st.clockStart:(LS.cfg?LS.cfg.gameClock:7.0);}
  function stagePassAt(){const st=currentStage();return st?st.passAt:(LS.cfg?LS.cfg.passAt:4.6);}

  function state(){return LS;}

  /* ---------------- HUD ---------------- */
  /* 比分 HUD 走类名而不是内联样式:窄屏(375px 竖屏)的 #hudRound 被 styles.css
     锁成 88px 宽,内联字号媒体查询管不着,单行队名会被挤成七八行,还会压到
     下面的 #hudTarget("练习模式 · 不计成绩")上,两层文字叠在一起读不了。
     桌面保留单行大比分,窄屏由 CSS 拆回短行 —— 88px 这个尺寸本来就是为它定的。 */
  function updScoreHUD(homeScore, awayScore){
    const cfg = LS.cfg;
    if(!cfg)return;
    const diff = awayScore - homeScore;
    const statusText = diff > 0 ? `落后 ${diff} 分` : (diff === 0 ? "平分 · 绝杀一投" : "反超领先！");
    const statusColor = diff > 0 ? "#ff8d7a" : (diff === 0 ? "#ffd23f" : "#7CFC6B");
    const box=$("hudRound");
    box.classList.add("lsScore");
    box.innerHTML=`<div class="lsScoreBox">`
      +`<div class="lsScoreLine">`
      +`<span class="lsHome">${cfg.homeName}</span> <b class="lsNum">${homeScore}</b>`
      +` <span class="lsSep">:</span> `
      +`<b class="lsNum away">${awayScore}</b> <span class="lsAway">${cfg.awayName}</span>`
      +`</div>`
      +`<div class="lsScoreStatus" style="color:${statusColor}">★ ${statusText} ★</div>`
      +`</div>`;
  }

  function hudSetup(cfg){
    const hud=$("hud");
    hud.dataset.mode="lastshot";hud.style.display="block";
    $("battleControls").style.display="none";$("battleScore").style.display="none";
    $("midBtn").style.display="none";$("hudStreak").style.display="none";
    $("scoreNum").textContent=cfg.scoreHome;
    $("hudTimer").style.display="block";
    updScoreHUD(cfg.scoreHome, cfg.scoreAway);
    $("hudTarget").textContent=LS.practice?"练习模式 · 不计成绩":"每日挑战 · 仅此一次";
    updClock(cfg.gameClock);
  }
  function updClock(v){
    const el=$("hudTimer"),txt=Math.max(0,v).toFixed(1);
    if(el.textContent!==txt)el.textContent=txt;
    const cls=v<=3?"low":"";
    if(el.className!==cls)el.className=cls;
  }

  function cleanupIntroProps(){
    const ov=document.getElementById("lsIntroOverlay");
    if(ov)ov.remove();
    if(LS.introBall){
      scene.remove(LS.introBall);
      LS.introBall=null;
    }
    if(LS.interludeBall){
      scene.remove(LS.interludeBall);
      LS.interludeBall=null;
    }
    if(passer&&passer.g)passer.g.visible=false;
  }

  function hideLastShotHud(){
    const scoreBox=$("hudRound");if(scoreBox)scoreBox.classList.remove("lsScore");
    const hud=$("hud");
    if(hud){hud.dataset.mode="";hud.style.display="none";}
    const skipBtn=document.getElementById("lsSkipBtn");
    if(skipBtn)skipBtn.remove();
    cleanupIntroProps();
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
    if(cfg.playerNum!=null)G.myNum=cfg.playerNum;
    else if(G.myNum==null)G.myNum=23;
    G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;
    G.moving=false;G.glideCam=false;G.blindToasted=false;
    G.passCatch=null;
    G.seq=[{rack:3,ball:0,val:3,money:false,deep:null,p:cfg.shotSpot.p,lastShot:true}];
    balls.slice().forEach(b=>{scene.remove(b.mesh);scene.remove(b.blob);});balls.length=0;
    const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    resetRackBalls();confPts.visible=false;
    rivals.forEach(rv=>{rv.active=false;rv.g.visible=false;});
    if(player._celeb)stopCelebrate(player);
    const CALL_STYLES=["both_target","both_clap","single_wave"];
    cleanupIntroProps();
    Object.assign(LS,{on:true,t:0,phase:"intro",cfg,practice:!!practice,
      passed:false,released:false,resolved:false,pass:null,lookYaw:0,timedOut:false,shooting:false,
      shotMade:false,callStyle:CALL_STYLES[(Math.random()*CALL_STYLES.length)|0],
      offball:cfg.offball?global.AIBAOffball.create():null,holdT:0,contestTriggered:false,diag:null,_beat:null,
      cutFrom:null,cutDur:0,introT:0,introDur:14.0,introBall:null,introCut:-1,
      reactionT:0,reactionStarted:false,reactionDuration:0,finishMade:false,finishReason:"shot",
      celeb:null,madeAt:null,buzzAt:null,boardStarted:false,buzzed:false,foul:null,foulCallT:0,
      board:null,ftReady:false,ftBall:null,ftWait:0,ftIntro:0,
      stageIdx:0,tmacHome:cfg.scoreHome||0,tmacAway:cfg.scoreAway||0,
      interlude:null,interludeT:0,interludeBall:null,interludeAwayDone:false});
  }

  function ensureIntroOverlay(){
    let ov=document.getElementById("lsIntroOverlay");
    if(ov)return ov;
    ov=document.createElement("div");
    ov.id="lsIntroOverlay";
    ov.style.cssText="position:fixed;left:0;right:0;bottom:24px;z-index:99990;display:flex;flex-direction:column;align-items:center;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;padding:0 16px;";
    ov.innerHTML=`
      <div id="lsIntroCard" style="max-width:680px;width:100%;background:linear-gradient(135deg,rgba(12,16,28,0.92),rgba(24,30,48,0.88));border:1px solid rgba(255,210,63,0.55);border-left:5px solid #ffd23f;border-radius:12px;padding:12px 18px;box-shadow:0 10px 32px rgba(0,0,0,0.65);backdrop-filter:blur(6px);transition:transform 0.2s ease,border-color 0.2s ease;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px;">
          <span id="lsIntroTag" style="display:inline-block;background:#ff3b30;color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;padding:2px 8px;border-radius:4px;text-transform:uppercase;">HIGHLIGHT REPLAY</span>
          <span id="lsIntroClock" style="color:#ffd23f;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;">Q4 · 关键回合混剪</span>
        </div>
        <div id="lsIntroSpeaker" style="color:#9ec5ff;font-size:12px;font-weight:700;margin-bottom:3px;display:none;"></div>
        <div id="lsIntroLine" style="color:#ffffff;font-size:16px;font-weight:800;line-height:1.45;text-shadow:0 2px 8px rgba(0,0,0,0.8);"></div>
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }

  function setIntroOverlay(tag,tagBg,clockTxt,speaker,line,accentColor,emph){
    ensureIntroOverlay();
    const card=document.getElementById("lsIntroCard");
    const tagEl=document.getElementById("lsIntroTag");
    const clockEl=document.getElementById("lsIntroClock");
    const spkEl=document.getElementById("lsIntroSpeaker");
    const lineEl=document.getElementById("lsIntroLine");
    if(tagEl){tagEl.textContent=tag;tagEl.style.background=tagBg||"#ff3b30";}
    if(clockEl)clockEl.textContent=clockTxt||"";
    if(spkEl){
      if(speaker){spkEl.style.display="block";spkEl.textContent=speaker;}
      else spkEl.style.display="none";
    }
    if(lineEl){
      lineEl.textContent=line||"";
      lineEl.style.color=emph?"#ffd23f":"#ffffff";
      lineEl.style.fontSize=emph?"19px":"15px";
    }
    if(card){
      card.style.borderLeftColor=accentColor||"#ffd23f";
      card.style.transform=emph?"scale(1.03)":"scale(1)";
    }
  }

  function poseCoachGuy(guy,t,mode){
    if(!guy||!guy.g)return;
    if(guy.ballGrips)guy.ballGrips.forEach(bg=>bg&&bg.children&&bg.children.forEach(c=>{c.visible=false;}));
    const w=Math.sin(t*6.5);
    if(guy.legs){guy.legs[0].rotation.set(0,0,0);guy.legs[1].rotation.set(0,0,0);}
    if(guy.knees){guy.knees[0].rotation.x=0.14;guy.knees[1].rotation.x=0.14;}
    if(guy.torso){guy.torso.rotation.x=mode==="point"?0.12:0.06;guy.torso.rotation.y=w*0.08;}
    if(guy.arms&&guy.elbows){
      if(mode==="point"){
        // 直指镜头（我们）：“投进那该死的三分！”
        guy.arms[0].rotation.set(-1.48+w*0.05,0,0.08);
        guy.elbows[0].rotation.set(-0.18,0,0);
        guy.arms[1].rotation.set(-1.12-w*0.06,0,-0.25);
        guy.elbows[1].rotation.set(-0.85,0,0);
      }else{
        // 比划战术板手势
        guy.arms[0].rotation.set(-1.25+w*0.28,0,0.22);
        guy.elbows[0].rotation.set(-0.72+w*0.2,0,0);
        guy.arms[1].rotation.set(-1.05-w*0.24,0,-0.22);
        guy.elbows[1].rotation.set(-0.88-w*0.18,0,0);
      }
      if(squadApi.guardArms)squadApi.guardArms(guy);
    }
    guy.g.updateMatrixWorld(true);
  }

  function updateIntroScene(dt){
    const cfg=LS.cfg;if(!cfg)return;
    const t=LS.introT;
    const sq=squadApi.squad;
    const actors=sq&&sq.actors?sq.actors:null;
    if(!LS.introBall){
      LS.introBall=new THREE.Mesh(ballGeo,matBall);
      scene.add(LS.introBall);
    }
    const ball=LS.introBall;

    // 阶段切镜音效与事件触发
    const cutIdx=t<1.5?0:(t<3.0?1:(t<4.5?2:(t<8.0?3:(t<9.8?4:(t<11.2?5:(t<13.0?6:7))))));
    if(cutIdx!==LS.introCut){
      LS.introCut=cutIdx;
      if(cutIdx===0||cutIdx===1){
        if(typeof sBounce==="function")sBounce();
      }else if(cutIdx===2){
        if(typeof whistle==="function")whistle();
        if(typeof broadcastSting==="function")broadcastSting("danger");
      }else if(cutIdx===3){
        // 恢复实时比分显示
        updScoreHUD(cfg.scoreHome,cfg.scoreAway);
        if(global.updateCenterScoreboard){
          const diff=cfg.scoreAway-cfg.scoreHome;
          global.updateCenterScoreboard({
            title:cfg.title||"THE LAST SHOT",
            score:`${cfg.scoreHome} : ${cfg.scoreAway}`,
            clock:`Q4  00:0${cfg.gameClock.toFixed(1)}`,
            subColor:diff>0?"#ff8d7a":"#ffd23f"
          });
        }
      }else if(cutIdx===6){
        if(typeof crowdSwell==="function")crowdSwell(0.75,2.2);
        if(typeof sBeep==="function")sBeep(880,0.14);
      }
    }

    if(t<4.5){
      /* ========= 第一幕 (0.0s - 4.5s): 比赛精彩混剪 · 双方攻防回放 ========= */
      if(passer&&passer.g)passer.g.visible=false;
      squadApi.setHandlerBall(false);
      if(t<1.5){
        // 镜头 1 (0.0 - 1.5s): 我方核心突破急停跳投命中精彩回放
        const u=clamp(t/1.5,0,1);
        const prevHome=Math.max(0,cfg.scoreHome-2),prevAway=Math.max(0,cfg.scoreAway-2);
        setIntroOverlay(
          "HIGHLIGHT · 比赛混剪 1/3","#e63946",
          `Q4 00:38.4 · ${cfg.homeName} ${u>0.78?cfg.scoreHome:prevHome} : ${prevAway} ${cfg.awayName}`,
          `${cfg.homeName} · 关键追分回合`,
          `我方核心持球强突撕裂防线，迎着扑防果断拔起跳投得手！`,
          "#4dabf7",false
        );
        if(actors){
          const a0=actors.ally0,d0=actors.def0,a1=actors.ally1,d1=actors.def1;
          if(a0){
            a0.pos.set(-2.6+u*1.4,0,3.8-u*1.7);
            a0.face=faceTo(a0.pos,HOOP);
            const jumpY=u>0.35&&u<0.82?Math.sin((u-0.35)/0.47*Math.PI)*0.55:0;
            a0.guy.g.position.set(a0.pos.x,jumpY,a0.pos.z);
            a0.guy.g.rotation.y=a0.face;
            if(a0.guy.arms){
              const shootK=u>0.32?1:0;
              a0.guy.arms[0].rotation.set(shootK?-2.35:-0.8,0,0.1);
              a0.guy.arms[1].rotation.set(shootK?-2.25:-0.6,0,-0.1);
            }
            a0.guy.g.updateMatrixWorld(true);
          }
          if(d0){
            d0.pos.set(-1.8+u*1.1,0,2.7-u*1.3);
            d0.face=faceTo(d0.pos,a0?a0.pos:HOOP);
            const blkY=u>0.42&&u<0.86?Math.sin((u-0.42)/0.44*Math.PI)*0.42:0;
            d0.guy.g.position.set(d0.pos.x,blkY,d0.pos.z);
            d0.guy.g.rotation.y=d0.face;
            if(d0.guy.arms){d0.guy.arms[0].rotation.set(-2.5,0,0.12);d0.guy.arms[1].rotation.set(-2.4,0,-0.12);}
            d0.guy.g.updateMatrixWorld(true);
          }
          if(a1){a1.guy.g.position.set(3.8-u*0.6,0,2.5);a1.guy.g.rotation.y=faceTo(a1.guy.g.position,HOOP);}
          if(d1){d1.guy.g.position.set(2.9-u*0.5,0,2.0);d1.guy.g.rotation.y=faceTo(d1.guy.g.position,HOOP);}
        }
        ball.visible=true;
        if(u<0.42){
          const k=u/0.42;
          ball.position.set(-2.4+k*0.6,1.1+Math.abs(Math.sin(k*Math.PI*2))*0.35,3.6-k*0.8);
        }else{
          const k=clamp((u-0.42)/0.46,0,1);
          const sx=-1.8,sz=2.8;
          ball.position.set(sx+(HOOP.x-sx)*k,2.35+(HOOP.y-2.35)*k+Math.sin(k*Math.PI)*1.55,sz+(HOOP.z-sz)*k);
          if(u>0.88)ball.position.y=HOOP.y-(u-0.88)*3.8;
        }
      }else if(t<3.0){
        // 镜头 2 (1.5 - 3.0s): 对手王牌强硬反击得分，再次将我们逼入绝境
        const u=clamp((t-1.5)/1.5,0,1);
        setIntroOverlay(
          "HIGHLIGHT · 比赛混剪 2/3","#ff6b35",
          `Q4 00:16.2 · ${cfg.homeName} ${cfg.scoreHome} : ${u>0.78?cfg.scoreAway:Math.max(0,cfg.scoreAway-2)} ${cfg.awayName}`,
          `${cfg.awayName} · 王牌强硬回应`,
          `对手头号球星顶着双人封盖后仰命中，将比分改写为 ${cfg.scoreHome} : ${cfg.scoreAway}！`,
          "#ff6b35",false
        );
        if(actors){
          const d0=actors.def0,a0=actors.ally0,a1=actors.ally1;
          if(d0){
            d0.pos.set(2.8-u*0.9,0,3.5-u*1.2);
            d0.face=faceTo(d0.pos,HOOP);
            const jumpY=u>0.36&&u<0.84?Math.sin((u-0.36)/0.48*Math.PI)*0.58:0;
            d0.guy.g.position.set(d0.pos.x,jumpY,d0.pos.z);
            d0.guy.g.rotation.y=d0.face;
            if(d0.guy.arms){
              d0.guy.arms[0].rotation.set(u>0.34?-2.45:-0.9,0,0.1);
              d0.guy.arms[1].rotation.set(u>0.34?-2.35:-0.7,0,-0.1);
            }
            d0.guy.g.updateMatrixWorld(true);
          }
          if(a0){
            a0.pos.set(2.0-u*0.7,0,2.5-u*0.9);
            a0.face=faceTo(a0.pos,d0?d0.pos:HOOP);
            const blkY=u>0.42&&u<0.86?Math.sin((u-0.42)/0.44*Math.PI)*0.44:0;
            a0.guy.g.position.set(a0.pos.x,blkY,a0.pos.z);
            a0.guy.g.rotation.y=a0.face;
            if(a0.guy.arms){a0.guy.arms[0].rotation.set(-2.5,0,0.14);a0.guy.arms[1].rotation.set(-2.4,0,-0.14);}
            a0.guy.g.updateMatrixWorld(true);
          }
          if(a1){
            a1.guy.g.position.set(1.2-u*0.3,0,2.8-u*0.7);
            a1.guy.g.rotation.y=faceTo(a1.guy.g.position,d0?d0.pos:HOOP);
          }
        }
        ball.visible=true;
        if(u<0.42){
          const k=u/0.42;
          ball.position.set(2.6-k*0.4,1.1+Math.abs(Math.sin(k*Math.PI*2))*0.35,3.3-k*0.6);
        }else{
          const k=clamp((u-0.42)/0.46,0,1);
          const sx=2.1,sz=2.5;
          ball.position.set(sx+(HOOP.x-sx)*k,2.4+(HOOP.y-2.4)*k+Math.sin(k*Math.PI)*1.65,sz+(HOOP.z-sz)*k);
          if(u>0.88)ball.position.y=HOOP.y-(u-0.88)*3.8;
        }
      }else{
        // 镜头 3 (3.0 - 4.5s): 全场紧逼攻防博弈 & 主教练果断叫停比赛
        const u=clamp((t-3.0)/1.5,0,1);
        squadApi.place(u*0.9);
        squadApi.setHandlerBall(true);
        ball.visible=false;
        setIntroOverlay(
          "TIMEOUT · 比赛混剪 3/3","#ffd23f",
          `Q4 00:0${cfg.gameClock.toFixed(1)} · 暂停哨响`,
          `现场切入 · 白热化全场紧逼`,
          `双方陷入窒息肉搏，比赛仅剩 ${cfg.gameClock.toFixed(1)} 秒，主教练果断请求最后一次暂停！`,
          "#ffd23f",false
        );
      }
      return;
    }

    if(t<8.0){
      /* ========= 第二幕 (4.5s - 8.0s): 切入球场当前情况 + 比分转播大屏停留 ========= */
      ball.visible=false;
      if(passer&&passer.g)passer.g.visible=false;
      squadApi.place(0);
      squadApi.setHandlerBall(true);
      const diff=cfg.scoreAway-cfg.scoreHome;
      const diffTxt=diff>0?`落后 ${diff} 分`:(diff===0?"双方战平":"领先");
      setIntroOverlay(
        "LIVE BROADCAST · 赛况转播","#ff3b30",
        `${cfg.homeName} ${cfg.scoreHome} : ${cfg.scoreAway} ${cfg.awayName} · Q4 00:0${cfg.gameClock.toFixed(1)}`,
        `${cfg.title} · ${cfg.subtitle}（${diffTxt}）`,
        cfg.story||`比赛还剩最后 ${cfg.gameClock.toFixed(1)} 秒，全场两万名观众屏住呼吸，等待决胜一攻！`,
        "#ff3b30",false
      );
      return;
    }

    if(t<13.0){
      /* ========= 第三幕 (8.0s - 13.0s): 教练席战术布置 + “投进那该死的三分！” ========= */
      ball.visible=false;
      squadApi.setHandlerBall(false);
      // 边线教练席区域坐标 (x ≈ -5.8, z ≈ 2.2)
      const coachPos=V3(-6.20,0,2.20);
      const playerHuddlePos=V3(-4.55,0,2.20);
      if(passer&&passer.g){
        passer.g.visible=true;
        passer.g.position.copy(coachPos);
        passer.g.rotation.y=faceTo(coachPos,playerHuddlePos);
        poseCoachGuy(passer,t,t>=11.2?"point":"board");
      }
      if(actors){
        const huddleSlots=[
          {id:"ally0",x:-5.92,z:1.52},
          {id:"ally1",x:-5.92,z:2.88},
          {id:"ally2",x:-5.52,z:0.95},
          {id:"ally3",x:-5.52,z:3.45}
        ];
        huddleSlots.forEach((s,idx)=>{
          const a=actors[s.id];if(!a)return;
          a.pos.set(s.x,0,s.z);
          const lookTarget=t>=9.8?playerHuddlePos:coachPos;
          a.face=faceTo(a.pos,lookTarget);
          a.guy.g.position.set(s.x,0,s.z);
          a.guy.g.rotation.y=a.face;
          if(idx===0&&t>=9.8){
            poseCoachGuy(a.guy,t+0.8,t>=11.2?"point":"board");
          }else if(a.guy.arms&&a.guy.elbows){
            a.guy.arms[0].rotation.set(-0.35,0,0.12);
            a.guy.elbows[0].rotation.set(-0.45,0,0);
            a.guy.arms[1].rotation.set(-0.35,0,-0.12);
            a.guy.elbows[1].rotation.set(-0.45,0,0);
            if(squadApi.guardArms)squadApi.guardArms(a.guy);
            a.guy.g.updateMatrixWorld(true);
          }
        });
      }
      if(player&&player.g){
        player.g.visible=false;
      }
      if(t<9.8){
        setIntroOverlay(
          "COACH HUDDLE · 教练席战术布置","#2b8a3e",
          `暂停时间 · 剩余 ${cfg.gameClock.toFixed(1)} 秒`,
          "主教练 · 战术板布置",
          `“${cfg.timeoutDialogue||"听着！对方一定会疯抢包夹持球人，弱侧外线会出现唯一一次空位机会！"}”`,
          "#51cf66",false
        );
      }else if(t<11.2){
        setIntroOverlay(
          "COACH HUDDLE · 核心球员沟通","#1971c2",
          `暂停时间 · 剩余 ${cfg.gameClock.toFixed(1)} 秒`,
          "球队核心 · 决胜配合",
          `“${cfg.teammateDialogue||"只要他们包夹过来，我第一时间把球分给你，千万别犹豫！"}”`,
          "#4dabf7",false
        );
      }else{
        setIntroOverlay(
          "FINAL ORDER · 决胜死命令","#d90429",
          `全员登场 · 决战最后 ${cfg.gameClock.toFixed(1)} 秒`,
          "主教练 & 球队核心（直视着你）",
          "“别管那些复杂的战术了——跑出空位，接球，投进那该死的三分！！”",
          "#ffd23f",true
        );
      }
      return;
    }

    /* ========= 第四幕 (13.0s - 14.0s): 走出教练席登场落位 · 决胜时刻开始 ========= */
    ball.visible=false;
    if(passer&&passer.g)passer.g.visible=false;
    squadApi.place(0);
    squadApi.setHandlerBall(true);
    P.pos.copy(LS.cutFrom||LS.spot);
    const handler=squadApi.handler();
    P.face=faceTo(P.pos,LS.offball?HOOP:(handler?handler.pos:HOOP));
    LS.lookYaw=P.face;
    if(player&&player.g){
      player.g.visible=(CAM.mode!==0);
      player.g.position.set(P.pos.x,0,P.pos.z);
      player.g.rotation.y=P.face;
      player.g.updateMatrixWorld(true);
    }
    setIntroOverlay(
      "CLUTCH TIME · 决胜时刻","#ffd23f",
      `Q4 00:0${cfg.gameClock.toFixed(1)} · 准备接球出手`,
      "全员落位 · 裁判准备鸣哨",
      "牢记使命：盯紧持球核心，接球果断投进那记绝杀三分！",
      "#ffd23f",true
    );
  }

  function finishIntro(){
    if(!LS.on||LS.phase!=="intro")return;
    LS.phase="live";
    LS.t=0;
    const skipBtn=document.getElementById("lsSkipBtn");
    if(skipBtn)skipBtn.remove();
    cleanupIntroProps();
    squadApi.place(0);
    squadApi.setHandlerBall(true);
    P.pos.copy(LS.cutFrom||LS.spot);
    const handler=squadApi.handler();
    P.face=faceTo(P.pos,LS.offball?HOOP:(handler?handler.pos:HOOP));
    LS.lookYaw=P.face;
    if(player&&player.g){
      player.g.visible=(CAM.mode!==0);
      player.g.position.set(P.pos.x,0,P.pos.z);
      player.g.rotation.y=P.face;
      player.g.updateMatrixWorld(true);
    }
    if(typeof whistle==="function")whistle();
    if(typeof sGo==="function")sGo();
    toast(LS.offball?"站稳放低双手，准备跑位":"看球 · 球会分到你手上","#ffd23f");
  }
  function skipIntro(){
    if(LS.phase==="intro")finishIntro();
  }

  function beginLastShot(practice){
    if(global.AIBABootShot){
      if(typeof global.AIBABootShot.abort==="function")global.AIBABootShot.abort();
      else if(typeof global.AIBABootShot.skip==="function")global.AIBABootShot.skip();
    }
    if(global.ensurePlayerShoeKit)global.ensurePlayerShoeKit();
    const base=cfgApi.activeChallenge?cfgApi.activeChallenge(!!practice):cfgApi.dailyChallenge();
    /* 跑位变奏：正式挑战按日期+关卡固定(全球同一天同一套)，练习每次换一套。
       ?lsSeed=N 锁定某一套变奏，?lsSeed=off 用原始手写路点，便于复现与录制。 */
    const qs=new URLSearchParams(location.search).get("lsSeed");
    const off=qs==="off"||!cfgApi.withVariation;
    const seed=qs!=null&&qs!==""&&!off?Number(qs):(practice&&!off?(Math.random()*4294967296)>>>0:null);
    const cfg=off?base:cfgApi.withVariation(base,{seed});
    ensureAudio(false);hidePanel();music(false);resetProgressiveSceneForRun();
    resetState(cfg,practice);
    squadApi.build(cfg);
    squadApi.place(0);
    squadApi.show(true);
    squadApi.setHandlerBall(true);
    // 配置切入起点与战术跑位，或默认直接站定投篮点
    const spot=cfg.shotSpot.p;
    LS.spot=spot.clone();
    if(cfg.playerCut){
      LS.cutFrom=cfg.playerCut.from.clone();
      LS.cutDur=cfg.playerCut.arriveT||3.0;
      P.pos.copy(LS.cutFrom);
      P.walking=true;
    }else{
      LS.cutFrom=spot.clone();
      LS.cutDur=0;
      P.pos.copy(spot);
      P.walking=false;
    }
    const handler=squadApi.handler();
    P.face=faceTo(P.pos,LS.offball?HOOP:(handler?handler.pos:HOOP));
    if(player&&player.g){
      player.g.position.set(P.pos.x,0,P.pos.z);
      player.g.rotation.y=P.face;
    }
    P.jump=0;P.eyeDip=0;
    LS.footT=0;
    if(LS.offball)VISION.faceAim=0;
    LS.lookYaw=P.face;
    CAM.mode=cfg.offball?1:0;if(global.AIBASetIcon)global.AIBASetIcon("camBtn","camera",CAM.names[CAM.mode]);
    ctx.setCamSnap(true);
    hudSetup(cfg);
    G.state="lastshot";G.running=true;
    enterArenaAudio(.92);
    applyCamMode();
    passer.g.visible=false;oppPasser.g.visible=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    calibrateTilt();
    broadcastSting("danger");

    // 动态同步球场中央吊挂大屏比分特写
    if(global.updateCenterScoreboard){
      const diff=cfg.scoreAway-cfg.scoreHome;
      global.updateCenterScoreboard({
        title:cfg.title||"THE LAST SHOT",
        score:`${cfg.scoreHome} : ${cfg.scoreAway}`,
        clock:`Q4  00:0${cfg.gameClock.toFixed(1)}`,
        subColor:diff>0?"#ff8d7a":"#ffd23f"
      });
    }

    if(cfg.offball){
      G.seq[0].p=LS.spot.clone();
      finishIntro();
      return;
    }
    // 悬浮跳过特写小按钮
    const oldSkip=document.getElementById("lsSkipBtn");
    if(oldSkip)oldSkip.remove();
    const skipBtn=document.createElement("button");
    skipBtn.id="lsSkipBtn";
    skipBtn.textContent="跳过特写 ▸";
    skipBtn.style.cssText="position:fixed;top:18px;right:18px;z-index:99999;background:rgba(20,25,35,0.85);color:#ffd23f;border:1px solid rgba(255,210,63,0.6);border-radius:16px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);box-shadow:0 2px 10px rgba(0,0,0,0.5);";
    skipBtn.onclick=skipIntro;
    document.body.appendChild(skipBtn);
    updateIntroScene(0);

    if(cfg.crowdMood==="away"&&typeof boo==="function")boo();
    if(cfg.commentaryEvent==="lastshot_commentary_finals")playAudioEvent("lastshot_commentary_finals");
    else if(cfg.commentaryEvent==="lastshot_commentary_g7")playAudioEvent("lastshot_commentary_g7");
    else if(cfg.commentaryEvent==="lastshot_commentary_corner")playAudioEvent("lastshot_commentary_corner");
    else if(typeof playAudioEvent==="function")playAudioEvent("lastshot_commentary");
    else paSay(cfg.commentary,true);
  }

  /* ---------------- 传球:核心把球分给你 ---------------- */
  function startHandlerPass(intercepted=false){
    const handler=squadApi.handler();if(!handler)return;
    squadApi.setHandlerBall(false);
    const from=V3(handler.pos.x,1.28,handler.pos.z);
    // 接球点用第一人称视线略下方,和共用 startPass 的手感保持一致
    const to=intercepted?squadApi.actorHand("foe0"):global.eyePos();
    if(!intercepted)to.y-=0.3;
    const mesh=new THREE.Mesh(ballGeo,matBall);
    mesh.position.copy(from);scene.add(mesh);
    const dur=clamp(0.26+from.distanceTo(to)*0.032,0.34,0.6);
    LS.pass={mesh,from,to,t:0,dur,intercepted};
    if(intercepted)G.passCatch=null;
    else G.passCatch={active:true,progress:0,target:to.clone()};
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
    if(p.intercepted)p.to.copy(squadApi.actorHand("foe0"));
    p.mesh.position.lerpVectors(p.from,p.to,k);
    p.mesh.position.y+=Math.sin(k*Math.PI)*0.5;
    if(G.passCatch){G.passCatch.active=k<1;G.passCatch.progress=k;G.passCatch.target.copy(p.mesh.position);}
    p.mesh.rotation.x-=dt*11;
    if(k>=1){
      scene.remove(p.mesh);LS.pass=null;
      if(p.intercepted){
        squadApi.setActorBall("foe0",true);
        G.running=false;
        offballHint("传球被断");
        startResultReaction(false,"intercepted",1.2);
        return;
      }
      if(G.passCatch){
        G.passCatch.active=true;G.passCatch.settling=true;G.passCatch.settle=0;G.passCatch.progress=1;
      }
      sBounce();
      if(navigator.vibrate)navigator.vibrate(8);
      // 交接:从这一刻起完全走共用的投篮生命周期
      if(LS.offball){
        if(typeof resetVisionGesture==="function"&&typeof VISION!=="undefined"&&VISION?.machine)resetVisionGesture(VISION.machine);
        if(typeof VISION!=="undefined"&&VISION)VISION.faceAim=0;
      }
      G.canShoot=true;
      if(typeof global.setHandBall==="function")global.setHandBall();
      updPowerUI();updDotsUI();
      LS.phase="shoot";
      if(LS.offball){
        const wide=LS.offball.passQuality==="wide";
        offballHint(wide?"大空位接球 · 转头瞄篮，放低双手蓄力":"接稳 · 防守扑上来了，速瞄出手");
        toast(wide?"大空位接球 · 瞄篮出手!":"勉强接球 · 快出手!",wide?"#7CFC6B":"#ffd23f");
      }else{
        toast("出手!","#ff5d4d");
      }
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
  const CELEBRATE_DELAY=.2,BUZZER_DELAY=.2;
  const RESULT_REACTION_SECONDS=5.8,TIMEOUT_REACTION_SECONDS=4.6;
  const FOUL_CALL_MAKE_SECONDS=2.8,FOUL_CALL_SHOTS_SECONDS=4.2;
  const FT_INTRO_SECONDS=1.15,FT_BETWEEN_SECONDS=1.15,FT_FINAL_HOLD_SECONDS=1.65;
  function applyContest(){
    if(!squadApi.contestLevel)return false;
    const level=squadApi.contestLevel(P.pos);
    const b=balls.length?balls[balls.length-1]:null;
    /* 真实物理球（phase "path"）：判罚逻辑不变，改判时重新找一条真实轨迹（见下面各分支） */
    const phys=!!(b&&b.physics&&b.phase==="path"&&typeof forcePhysicsOutcome==="function");
    if(!b||(b.phase!=="fly"&&!phys))return false;
    /* 分两档，对应"降低手感"和"直接封盖"：
         · level ≥ .72 —— 他跳起来了而且贴在正面：直接封盖
         · level ≥ .38 —— 手举在你脸前：按概率把好结果降级，甜区手感被吃掉
       正常节奏出手时他还在两米开外，level 为 0，完全不受影响。 */
    /* 极小概率吹犯规：贴防越紧越容易打手。球进了算 3+1，没进就是三罚。
       球落定后先保留现场判罚反应，再由玩家逐次完成罚球。 */
    const foulDist=squadApi.defenderDistance?squadApi.defenderDistance(P.pos):99;
    const st=currentStage();
    const forceAndOne=!!(st&&st.foulType==="andOne");
    const noRandomFoul=!!LS.offball||!!(st&&st.foulType==="none");
    const willMakeShot=b.outcome==="swish"||b.outcome==="rattle"||b.outcome==="bank";
    if(forceAndOne&&willMakeShot){
      LS.foul={andOne:true,shots:1,made:0,taken:0};
      if(typeof playAudioEvent==="function")playAudioEvent("lastshot_foul_whistle");
      else if(whistle)whistle();
      crowdSwell&&crowdSwell(.28,1.2);
      toast("🙌 #23 德文·布朗打手犯规 · 3+1！","#7CFC6B");
      return true;
    }
    if(!noRandomFoul&&!forceAndOne)if(foulDist<=FOUL_RANGE&&aibaRoll()<FOUL_CHANCE){   // 犯规是结果判定,要能复现
      /* 罚球必须由你自己投，不能拿概率算掉——那是这一攻最关键的几下。
         这里只记账，等球落定后进入罚球阶段。 */
      const willMake=willMakeShot;
      LS.foul={andOne:willMake,shots:willMake?1:3,made:0,taken:0};
      if(typeof playAudioEvent==="function")playAudioEvent("lastshot_foul_whistle");
      else if(whistle)whistle();
      crowdSwell&&crowdSwell(.28,1.2);
      if(willMake){
        toast("🙌 打手犯规 · 3+1！","#7CFC6B");
      }else if(phys){
        // 被打手：出手被打短——从明显欠力的一侧找一条不进的真实轨迹
        forcePhysicsOutcome(b,false,-1.6);b.made=false;
        toast("🙌 投篮犯规 · 三次罚球","#ffd23f");
      }else{
        b.outcome="miss";b.made=false;
        b.v0.multiplyScalar(.62);b.tf=Math.max(.4,b.tf*.7);
        toast("🙌 投篮犯规 · 三次罚球","#ffd23f");
      }
      return true;
    }
    if(level>=.72&&phys){
      /* 封盖：球被手真实地拍飞——出手速度大幅削弱、侧向打偏，从出手点重新模拟。
         万一被拍飞的球还是进了（极少），再加一档力度削弱。 */
      const side=(Math.random()<.5?-1:1)*1.5;
      for(let k=0;k<3;k++){
        const f=.44-k*.08;
        const sp=b.simP0||b.p0;
        resimPhysicsBall(b,[sp.x,sp.y,sp.z],[b.v0.x*f+side,b.v0.y*f*.52,b.v0.z*f],[0,0,0],0);
        if(!b.willMake)break;
      }
      if(b.willMake)forcePhysicsOutcome(b,false,-3);
      b.made=false;LS.blocked=true;
      toast("🚫 被封盖","#ff8d7a");
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
      if(next&&phys){
        /* 降一档：空心→擦着进（仍进），其余→不进。在原误差同侧往外推一点重新找轨迹，
           球看起来是"手感被吃掉"而不是突然拐弯。 */
        const u=Number(b.launchU)||0,side=u<0?-1:1;
        const stillIn=next==="rattle";
        forcePhysicsOutcome(b,stillIn,stillIn?side*.85:side*Math.max(1.1,Math.abs(u)+.8));
        if(!stillIn)b.made=false;
        LS.contested=true;
        toast("✋ 被干扰 · 手感受影响","#ffd23f");
        return true;
      }
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

  function startTmacInterlude(){
    const st=currentStage();
    if(!st||!st.interlude)return false;
    const il=st.interlude;
    LS.phase="interlude";
    LS.interlude=il;
    LS.interludeT=0;
    LS.interludeAwayDone=false;
    LS.celeb=null;setCelebrateView(false);
    G.canShoot=false;G.charging=false;
    if(!LS.interludeBall){
      LS.interludeBall=new THREE.Mesh(ballGeo,matBall);
      scene.add(LS.interludeBall);
    }
    LS.interludeBall.visible=true;
    setIntroOverlay(il.tag,"#d90429",`Q4 00:${il.clockEnd.toFixed(1)} · 剧情演绎`,il.speaker,il.line,"#ffd23f",true);
    if(il.type==="steal"){
      if(typeof whistle==="function")whistle();
      if(typeof broadcastSting==="function")broadcastSting("danger");
    }
    return true;
  }

  function updateTmacInterlude(dt){
    const il=LS.interlude;if(!il)return;
    LS.interludeT+=dt;
    const u=clamp(LS.interludeT/Math.max(0.1,il.dur),0,1);
    const sq=squadApi.squad,actors=sq&&sq.actors?sq.actors:null;
    const ball=LS.interludeBall;
    if(il.awayPts&&!LS.interludeAwayDone&&u>=0.62){
      LS.interludeAwayDone=true;
      LS.tmacAway+=il.awayPts;
      updScoreHUD(LS.tmacHome,LS.tmacAway);
      if(global.updateCenterScoreboard){
        global.updateCenterScoreboard({
          title:LS.cfg.title,
          score:`${LS.tmacHome} : ${LS.tmacAway}`,
          clock:`Q4  00:${il.clockEnd.toFixed(1)}`,
          subColor:"#ff8d7a"
        });
      }
      if(typeof sBeep==="function")sBeep(660,0.12);
      toast(`马刺罚球 +${il.awayPts} (${LS.tmacHome}:${LS.tmacAway})`,"#ff8d7a");
    }
    if(il.type==="buzzer_win"&&!LS.interludeAwayDone&&u>=0.68){
      LS.interludeAwayDone=true;
      if(typeof sBuzz==="function")sBuzz();
      if(typeof cheerSound==="function")cheerSound(true);
      crowdSwell&&crowdSwell(1.0,5.0);
    }
    if(actors&&ball){
      if(il.type==="foe_ft"){
        const shooter=actors.foe1||actors.foe2;
        if(shooter){
          shooter.pos.set(0,0,HOOP.z+4.6);
          shooter.face=faceTo(shooter.pos,HOOP);
          shooter.guy.g.position.set(shooter.pos.x,0,shooter.pos.z);
          shooter.guy.g.rotation.y=shooter.face;
        }
        const arc=u<0.35?0:clamp((u-0.35)/0.32,0,1);
        const start=V3(0,2.1,HOOP.z+4.4);
        const end=V3(HOOP.x,HOOP.y-0.1,HOOP.z);
        ball.position.lerpVectors(start,end,arc);
        ball.position.y+=Math.sin(arc*Math.PI)*1.2;
      }else if(il.type==="steal"){
        // #23 德文·布朗滑倒丢球，#1 麦迪抢断推进
        const brown=actors.foe1,wes=actors.ally2;
        if(brown){
          const bx=-0.8+u*1.2,bz=2.8-u*0.8;
          brown.pos.set(bx,0,bz);
          brown.guy.g.position.set(bx,u>0.38&&u<0.75?-0.12:0,bz);
          brown.guy.g.rotation.x=u>0.38?0.42:0;
        }
        if(wes){
          wes.pos.set(0.9-u*0.5,0,2.2);
          wes.guy.g.position.set(wes.pos.x,0,wes.pos.z);
        }
        const stealK=clamp((u-0.38)/0.62,0,1);
        const loose=V3(-0.6,0.22,2.6);
        const wing=V3(-3.6,1.15,-0.5);
        ball.position.lerpVectors(loose,wing,stealK);
        if(stealK>0)ball.position.y=0.22+Math.abs(Math.sin(stealK*Math.PI*3))*0.65;
      }else if(il.type==="buzzer_win"){
        const parker=actors.foe3;
        if(parker){
          parker.pos.set(1.6,0,2.4);
          parker.guy.g.position.set(1.6,u<0.35?Math.sin(u/0.35*Math.PI)*0.45:0,2.4);
          parker.guy.g.rotation.y=faceTo(parker.pos,HOOP);
        }
        const heaveK=clamp((u-0.18)/0.52,0,1);
        const start=V3(1.6,2.2,2.4),rimMiss=V3(HOOP.x+0.42,HOOP.y+0.25,HOOP.z+0.28);
        ball.position.lerpVectors(start,rimMiss,heaveK);
        ball.position.y+=Math.sin(heaveK*Math.PI)*2.2;
      }
    }
    if(LS.interludeT>=il.dur){
      if(ball)ball.visible=false;
      cleanupIntroProps();
      if(il.type==="buzzer_win"){
        finish(true,"shot");
      }else{
        startNextTmacStage();
      }
    }
  }

  function startNextTmacStage(){
    LS.stageIdx++;
    const st=currentStage();
    if(!st){finish(true,"shot");return;}
    LS.phase="live";LS.t=0;
    LS.passed=false;LS.released=false;LS.timedOut=false;LS.shooting=false;
    LS.shotMade=false;LS.foul=null;LS.foulCallT=0;LS.board=null;LS.boardStarted=false;
    LS.reactionStarted=false;LS.reactionT=0;LS.madeAt=null;LS.buzzAt=null;
    LS.holdT=0;LS.contestTriggered=false;LS.contested=false;LS.blocked=false;LS._beat=null;
    balls.slice().forEach(b=>{scene.remove(b.mesh);scene.remove(b.blob);});balls.length=0;
    LS.cfg.shotSpot=st.shotSpot;
    LS.cfg.shotSpotName=st.shotSpotName;
    LS.cfg.liveDur=st.liveDur;
    LS.cfg.passAt=st.passAt;
    LS.cfg.selfDribble=!!st.selfDribble;
    LS.cfg.gameClock=st.clockStart;
    LS.cfg.playerCut=st.playerCut;
    G.seq=[{rack:3,ball:0,val:3,money:false,deep:null,p:st.shotSpot.p,lastShot:true}];
    G.shotIdx=0;G.shots=[];G.canShoot=false;G.charging=false;G.power=0;G.running=true;
    LS.spot=st.shotSpot.p.clone();
    if(st.playerCut){
      LS.cutFrom=st.playerCut.from.clone();
      LS.cutDur=st.playerCut.arriveT||2.0;
      P.pos.copy(LS.cutFrom);P.walking=true;
    }else{
      LS.cutFrom=LS.spot.clone();LS.cutDur=0;P.pos.copy(LS.spot);P.walking=false;
    }
    squadApi.place(0);
    if(st.selfDribble){
      LS.passed=true;
      squadApi.setHandlerBall(false);
      if(!LS.dribbleBall){
        LS.dribbleBall=new THREE.Mesh(ballGeo,matBall);
        scene.add(LS.dribbleBall);
      }
      LS.dribbleBall.visible=true;
      P.face=faceTo(P.pos,LS.spot);
    }else{
      if(LS.dribbleBall)LS.dribbleBall.visible=false;
      squadApi.setHandlerBall(true);
      const handler=squadApi.handler();
      P.face=faceTo(P.pos,LS.offball?HOOP:(handler?handler.pos:HOOP));
    }
    LS.lookYaw=P.face;
    if(player&&player.g){
      player.g.visible=(CAM.mode!==0);
      player.g.position.set(P.pos.x,0,P.pos.z);
      player.g.rotation.y=P.face;
      player.g.updateMatrixWorld(true);
    }
    ctx.setCamSnap(true);
    updScoreHUD(LS.tmacHome,LS.tmacAway);
    updClock(st.clockStart);
    if(global.updateCenterScoreboard){
      global.updateCenterScoreboard({
        title:LS.cfg.title,
        score:`${LS.tmacHome} : ${LS.tmacAway}`,
        clock:`Q4  00:${st.clockStart.toFixed(1)}`,
        subColor:"#ffd23f"
      });
    }
    if(typeof whistle==="function")whistle();
    toast(`🔥 ${st.title}`,"#ffd23f");
  }

  function startResultReaction(made,reason,seconds){
    if(LS.reactionStarted)return false;
    if(isMultiStage()){
      const st=currentStage();
      const stageMade=st&&st.foulType==="andOne"
        ?!!(LS.foul&&LS.foul.andOne&&LS.foul.made>=1)
        :!!LS.shotMade;
      if(stageMade&&st){
        LS.tmacHome+=possessionPoints();
        updScoreHUD(LS.tmacHome,LS.tmacAway);
        if(startTmacInterlude())return true;
      }
      made=false;
    }
    LS.phase="reaction";LS.reactionT=0;LS.reactionStarted=true;
    LS.reactionDuration=seconds||RESULT_REACTION_SECONDS;
    LS.finishMade=!!made;LS.finishReason=reason||"shot";
    squadApi.startReaction(!!made,P.pos);
    startPlayerCelebrate(!!made);
    return true;
  }
  function advanceResultReaction(dt){
    if(LS.resolved||!LS.reactionStarted)return;
    LS.reactionT+=dt;
    if(LS.reactionT>=LS.reactionDuration&&!G.charging)finish(LS.finishMade,LS.finishReason);
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
        LS.putback={mesh,from:from.clone(),to:miss,v0:miss.clone().sub(from),t:0,dur:.34+Math.random()*.12};
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
      spinBall(p,dt,1);
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
  function startFoulCall(){
    const f=LS.foul;if(!f||LS.phase==="foulcall")return;
    LS.phase="foulcall";LS.foulCallT=0;LS.reactionT=0;
    G.canShoot=false;G.charging=false;
    if(squadApi.startFoulReaction)squadApi.startFoulReaction(!!f.andOne,P.pos);
    else squadApi.startReaction(!!f.andOne,P.pos);
    startPlayerCelebrate(!!f.andOne);
    broadcastSting(f.andOne?"score":"danger");
    crowdSwell&&crowdSwell(f.andOne?.82:.46,f.andOne?2.4:1.8);
    setTimeout(()=>{
      if(!LS.on||LS.phase!=="foulcall"||typeof playAudioEvent!=="function")return;
      if(f.andOne)playAudioEvent("lastshot_andone");
      else playAudioEvent("lastshot_freethrow");
    },360);
  }
  function updateFoulCall(dt){
    const f=LS.foul;if(!f)return;
    LS.foulCallT+=dt;
    squadApi.updatePostShot(dt,null,P.pos,null);
    updatePlayerCelebrate(dt);
    passer.g.visible=false;oppPasser.g.visible=false;
    const hold=f.andOne?FOUL_CALL_MAKE_SECONDS:FOUL_CALL_SHOTS_SECONDS;
    if(LS.foulCallT>=hold)beginFreeThrows();
  }
  function beginFreeThrows(){
    const f=LS.foul;if(!f||LS.phase==="freethrow")return;
    LS.phase="freethrow";LS.ftReady=false;LS.ftIntro=FT_INTRO_SECONDS;LS.ftWait=0;
    LS.celeb=null;setCelebrateView(false);G.canShoot=false;
    // 站上罚球线，正对篮筐
    const spot=V3(HOOP.x,0,HOOP.z+FT_LINE_Z);
    P.pos.copy(spot);LS.spot=spot.clone();
    P.face=faceTo(spot,HOOP);LS.lookYaw=P.face;
    P.jump=0;P.eyeDip=0;
    balls.slice().forEach(b=>{scene.remove(b.mesh);scene.remove(b.blob);});balls.length=0;
    if(LS.putback){scene.remove(LS.putback.mesh);LS.putback=null;}
    squadApi.lineUpForFreeThrow(spot);
    toast(f.andOne?"站上罚球线 · 加罚一次":"站上罚球线 · 三次罚球","#ffd23f");
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
    if(LS.ftIntro>0){
      LS.ftIntro=Math.max(0,LS.ftIntro-dt);
      if(LS.ftIntro===0)nextFreeThrow();
      return;
    }
    const b=balls.length?balls[balls.length-1]:null;
    // 出手了：等球落定再记账
    if(LS.ftReady&&G.shotIdx>0){LS.ftReady=false;LS.ftBall=b;}
    if(!LS.ftReady&&LS.ftBall){
      if(ballSettled(LS.ftBall)){
        const made=!!LS.ftBall.made;
        if(made){
          f.made++;
          const hBase=isMultiStage()?LS.tmacHome:LS.cfg.scoreHome;
          const aBase=isMultiStage()?LS.tmacAway:LS.cfg.scoreAway;
          updScoreHUD(hBase+possessionPoints(),aBase);
        }
        f.taken++;LS.ftBall=null;LS.ftWait=0;
        toast(made?"罚球命中":"罚球偏出",made?"#7CFC6B":"#ff8d7a");
        crowdSwell&&crowdSwell(made?.3:.12,made?1.1:.7);
      }
    }else if(!LS.ftReady&&!LS.ftBall){
      /* 罚完最后一球必须收尾。原来这个分支带 f.taken<f.shots 条件，
         最后一罚落定后两个分支都不成立——整个模式永远卡在罚球阶段，没有后续。 */
      LS.ftWait=(LS.ftWait||0)+dt;
      const hold=f.taken<f.shots?FT_BETWEEN_SECONDS:FT_FINAL_HOLD_SECONDS;
      if(LS.ftWait>=hold){
        LS.ftWait=0;
        if(f.taken<f.shots)nextFreeThrow();
        else finishFreeThrows();
      }
    }
  }
  function finishFreeThrows(){
    const f=LS.foul;
    G.canShoot=false;
    const pts=possessionPoints(),won=shotSucceeded();
    toast("罚球 "+f.made+"/"+f.shots+" · 本攻共 "+pts+" 分",won?"#7CFC6B":"#ff8d7a");
    startResultReaction(won,won?"shot":(isOvertime()?"overtime":"shot"),RESULT_REACTION_SECONDS);
    if(typeof playAudioEvent==="function"){
      if(won)playAudioEvent("lastshot_make");
      else playAudioEvent("lastshot_miss");
    }
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
    // 弹筐入网(rattle且rin)或打板入网(bankdrop)仍在进球进程中，绝不能算已落定！
    if(ball.phase==="fly"||ball.phase==="bankdrop")return false;
    // 真实物理球：进 / 不进在 decidedAt 那一刻就定了（进球在穿过网口下沿时）
    if(ball.phase==="path")return ball.t>=(ball.decidedAt||ball.endT||0);
    if(ball.phase==="rattle"&&ball.rin)return false;
    return !!(ball.made||ball.bounces>0||ball.phase==="roll"||(ball.phase==="fall"&&!ball.made)||ball.phase==="free");
  }
  function gazeTarget(ball){
    if(!ball||!ball.mesh)return null;
    // 真实物理球（phase "path"）到筐之前同样算在空中
    const physFlying=ball.phase==="path"&&ball.t<ball.tf;
    if(ball.made||ball.rimSoundPlayed||ball.bounces>0||(ball.phase!=="fly"&&!physFlying)||ballSettled(ball))return null;
    return ball.mesh.position;
  }

  /* ---------------- 帧更新 ---------------- */
  function waitingForCall(){return LS.on&&!!LS.offball&&LS.phase==="live"&&!LS.passed;}
  function offballHint(text){
    if(LS.offball.hint===text)return;
    LS.offball.hint=text;
    $("hudTarget").textContent=text;
  }
  // Translucent overhead reach-zone overlay ("透明伸手触达的画面区域") + crisp 3-2-1-GO countdown badge
  function ensureOffballOverlay(){
    let zone=document.getElementById("offballCallZone");
    if(!zone){
      zone=document.createElement("div");
      zone.id="offballCallZone";
      zone.style.cssText="position:fixed;top:0;left:0;right:0;height:19vh;max-height:150px;pointer-events:none;z-index:26;display:none;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:12px;border-bottom:2px dashed rgba(92,255,168,.88);background:linear-gradient(180deg,rgba(48,245,148,.24) 0%,rgba(48,245,148,.07) 100%);backdrop-filter:blur(2px);transition:opacity .15s,background .15s,border-color .15s;";
      zone.innerHTML=`<div id="offballCallLabel" style="font:700 15px/1.2 system-ui,sans-serif;color:#d8ffea;text-shadow:0 2px 10px rgba(0,0,0,.75);letter-spacing:.5px">▲ 已摆脱空位 · 双手举过肩伸入上方区域要球 ▲</div>`;
      document.body.appendChild(zone);
    }
    let cd=document.getElementById("offballCountdown");
    if(!cd){
      cd=document.createElement("div");
      cd.id="offballCountdown";
      cd.style.cssText="position:fixed;top:36%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:28;display:none;padding:12px 28px;border-radius:18px;background:rgba(10,16,28,.62);border:1.5px solid rgba(255,210,63,.78);color:#ffd23f;font:900 44px/1.1 Orbitron,system-ui,sans-serif;text-shadow:0 4px 18px rgba(0,0,0,.8);letter-spacing:2px;text-align:center;";
      document.body.appendChild(cd);
    }
    return {zone,cd};
  }
  function hideOffballOverlays(){
    const z=document.getElementById("offballCallZone");if(z)z.style.display="none";
    const c=document.getElementById("offballCountdown");if(c)c.style.display="none";
  }
  function syncOffballOverlays(play){
    if(!LS.on||!play||LS.passed||LS.phase!=="live"){hideOffballOverlays();return;}
    const {zone,cd}=ensureOffballOverlay();
    if(play.neutralFrames<2){
      zone.style.display="none";
      cd.style.display="block";
      cd.style.fontSize="18px";cd.style.color="#70e8ff";cd.style.borderColor="rgba(112,232,255,.72)";
      cd.textContent="正对镜头 · 放低双手站稳";
      return;
    }
    if(play.countdown>0){
      zone.style.display="none";
      const n=Math.ceil(play.countdown/0.8);
      cd.style.display="block";
      cd.style.fontSize="52px";cd.style.color="#ffd23f";cd.style.borderColor="rgba(255,210,63,.85)";
      cd.innerHTML=`${n}<div style="font:600 13px/1.3 system-ui,sans-serif;color:#dce8ff;margin-top:4px;letter-spacing:0">准备左右横移摆脱</div>`;
      return;
    }
    if(play.goFlash>0){
      cd.style.display="block";
      cd.style.fontSize="36px";cd.style.color="#7CFC6B";cd.style.borderColor="rgba(124,252,107,.85)";
      cd.textContent="GO! 开始跑位!";
    }else{
      cd.style.display="none";
    }
    if(play.openNow){
      const raised=play.raisedAt!==null;
      const wide=play.openQuality==="wide";
      zone.style.display="flex";
      zone.style.background=raised
        ?"linear-gradient(180deg,rgba(255,214,64,.36) 0%,rgba(255,214,64,.10) 100%)"
        :(wide?"linear-gradient(180deg,rgba(62,255,156,.26) 0%,rgba(62,255,156,.07) 100%)"
          :"linear-gradient(180deg,rgba(104,232,255,.20) 0%,rgba(104,232,255,.05) 100%)");
      zone.style.borderBottomColor=raised?"rgba(255,224,96,.95)":(wide?"rgba(92,255,168,.92)":"rgba(112,232,255,.82)");
      const lbl=document.getElementById("offballCallLabel");
      if(lbl){
        lbl.style.color=raised?"#fff5b8":(wide?"#d8ffea":"#dcf7ff");
        lbl.textContent=raised?"✋ 要球中 · 传球即将发出!"
          :(wide?`▲ 大空位 ${play.openGap.toFixed(1)}m · 双手伸入上方透明区要球 ▲`
            :`▲ 拉开空当 ${play.openGap.toFixed(1)}m · 举手伸入此区要球 ▲`);
      }
    }else{
      zone.style.display="none";
    }
  }
  function updateLastShot(dt){
    if(!LS.on)return;
    if(G.state!=="lastshot"){
      hideLastShotHud();
      LS.on=false;
      return;
    }
    const cfg=LS.cfg;

    // 开局混剪、比分特写、教练席战术布置与运镜阶段
    if(LS.phase==="intro"){
      LS.introT+=dt;
      updateIntroScene(dt);
      updClock(cfg.gameClock);
      if(LS.introT>=LS.introDur)finishIntro();
      return;
    }

    // 剧情演绎阶段（麦迪时刻防守犯规/对手罚球/关键抢断/压哨绝杀）
    if(LS.phase==="interlude"){updateTmacInterlude(dt);return;}

    // 犯规判罚先留在现场，让球员和观众完成反应，再走向罚球线。
    if(LS.phase==="foulcall"){updateFoulCall(dt);return;}
    // 罚球阶段：比赛钟停表，只跑罚球流程
    if(LS.phase==="freethrow"){updateFreeThrows(dt);return;}
    // 没能出手时没有飞行球，但仍要完整播放全场反应，而不是继续跑进攻战术。
    if(LS.phase==="reaction"&&!LS.released){
      updatePlayerCelebrate(dt);squadApi.updatePostShot(dt,null,P.pos,null);
      passer.g.visible=false;oppPasser.g.visible=false;
      advanceResultReaction(dt);return;
    }
    // 出手之后比赛钟继续走——球在空中时间照跑，这才是真实的最后一攻。
    if(waitingForCall()){
      const play=LS.offball,actors=squadApi.squad.actors;
      if(!global.AIBAOffball.track(play,global.visionOffballSample())){
        P.walking=false;
        updateBodyState(dt);
        passer.g.visible=false;oppPasser.g.visible=false;
        offballHint(play.neutralFrames<2?"正对镜头，放低双手站稳":"回到镜头内 · 比赛钟暂停");
        syncOffballOverlays(play);
        return;
      }
      // Crisp 3-2-1-GO opening countdown before the 12s clock & 5v5 motion start!
      if(play.countdown>0){
        const prevTick=Math.ceil(play.countdown/0.8);
        play.countdown=Math.max(0,play.countdown-dt);
        const curTick=Math.ceil(play.countdown/0.8);
        if(curTick!==play.countdownTick&&curTick>0){
          play.countdownTick=curTick;
          if(typeof sTick==="function")sTick();
        }
        if(play.countdown<=0){
          play.started=true;play.goFlash=.68;
          if(typeof whistle==="function")whistle();
          if(typeof sGo==="function")sGo();
          toast("🏀 开始跑位 · 横移摆脱防守!","#7CFC6B");
        }
        P.walking=false;
        updateBodyState(dt);
        squadApi.update(0,dt,P.pos,{passing:false,inHand:false,chargeT:0,offball:play});
        passer.g.visible=false;oppPasser.g.visible=false;
        updClock(cfg.gameClock);
        offballHint(play.countdown>0?`准备 · ${Math.max(1,curTick)} 秒后开球`:"GO! 开始跑位!");
        syncOffballOverlays(play);
        return;
      }
      if(play.goFlash>0)play.goFlash=Math.max(0,play.goFlash-dt);
      global.AIBAOffball.move(play,P.pos,LS.spot,HOOP,dt,LS.t);
      G.seq[0].p.copy(P.pos);
      global.AIBAOffball.readDefense(play,LS.t,actors.foe0.pos,actors.ally2.pos,P.pos);
    }
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
        startFoulCall();return;
      }
      if(activeBall&&activeBall.made){
        if(!LS.shotMade){
          LS.shotMade=true;
          const hBase=isMultiStage()?LS.tmacHome:cfg.scoreHome;
          const aBase=isMultiStage()?LS.tmacAway:cfg.scoreAway;
          const newHome=hBase+possessionPoints();
          updScoreHUD(newHome,aBase);
          if(global.updateCenterScoreboard){
            const diff=aBase-newHome;
            global.updateCenterScoreboard({
              title:cfg.title||"THE LAST SHOT",
              score:`${newHome} : ${aBase}`,
              clock:isMultiStage()?`Q4  00:${Math.max(0,clock).toFixed(1)}`:`Q4  00:00.0`,
              subColor:diff<=0?"#7CFC6B":"#ffd23f"
            });
          }
          crowdSwell&&crowdSwell(1.0,5.0);
          if(typeof cheerSound==="function")cheerSound(true);
        }
        if(!LS.reactionStarted){
          if(LS.madeAt==null)LS.madeAt=LS.t;
          if(LS.t-LS.madeAt>=CELEBRATE_DELAY){
            startResultReaction(true,"shot",RESULT_REACTION_SECONDS);
            if(typeof playAudioEvent==="function")playAudioEvent("lastshot_make");
          }
        }
      }
      // 球已经打铁落定：进入抢篮板，不是庆祝
      if(!LS.reactionStarted&&activeBall&&ballSettled(activeBall)&&!activeBall.made&&!LS.boardStarted){
        LS.boardStarted=true;LS.board=squadApi.startRebound(activeBall.mesh.position);
        crowdSwell&&crowdSwell(0.35,2.5);
      }
      updateRebound(dt,activeBall);
      /* 时间走完，但球还在空中：不能直接判负。真实规则是出手在结束前、球进了就算，
         所以这里等球落定，交给 D1(进球) / D2(打铁) 去响应。 */
      if(!LS.reactionStarted&&clock<=0&&(!activeBall||ballSettled(activeBall))){
        if(LS.buzzAt==null)LS.buzzAt=LS.t;
        if(LS.t-LS.buzzAt>=BUZZER_DELAY){
          if(activeBall&&activeBall.made)LS.shotMade=true;
          const _m=shotSucceeded();
          startResultReaction(_m,_m?"shot":(isOvertime()?"overtime":"shot"),RESULT_REACTION_SECONDS);
          if(typeof playAudioEvent==="function"){
            if(_m)playAudioEvent("lastshot_make");
            else playAudioEvent("lastshot_miss");
          }
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
      squadApi.update(LS.t,dt,P.pos,{passing:!!LS.pass,inHand:G.canShoot&&!LS.released,chargeT:LS.holdT||0,offball:LS.offball});
    }
    // 共用递球员在本模式全程不出现(applyCamMode 会按 inPlay 打开它们)
    passer.g.visible=false;oppPasser.g.visible=false;

    if(cfg.selfDribble&&!LS.released&&!G.canShoot){
      const cd=LS.cutDur||0;
      if(LS.t<cd){
        if(LS.dribbleBall){
          LS.dribbleBall.visible=true;
          const fx=Math.sin(P.face),fz=Math.cos(P.face),rx=fz,rz=-fx;
          const bounce=Math.abs(Math.sin(LS.t*10.5));
          LS.dribbleBall.position.set(P.pos.x+fx*0.42+rx*0.24,0.16+bounce*0.52,P.pos.z+fz*0.42+rz*0.24);
          LS.dribbleBall.rotation.x-=dt*12;
        }
      }else if(LS.phase==="live"){
        if(LS.dribbleBall)LS.dribbleBall.visible=false;
        const wantHoop=faceTo(P.pos,HOOP);LS.lookYaw=wantHoop;P.face=wantHoop;
        if(player&&player.g){player.g.rotation.y=P.face;player.g.updateMatrixWorld(true);}
        G.canShoot=true;
        if(typeof global.setHandBall==="function")global.setHandBall();
        updPowerUI();updDotsUI();
        LS.phase="shoot";
        toast("急停拔起 · 出手!","#ffd23f");
      }
    }
    if(waitingForCall()&&clock>0){
      const guard=squadApi.squad.actors.foe0;
      const play=LS.offball;
      const read=global.AIBAOffball.passRead(squadApi.handler().pos,P.pos,guard.pos);
      play.openNow=!read.cut;
      play.openQuality=read.quality;
      play.openGap=read.gap;
      if(play.screen?.planted&&!play.screenToasted){
        play.screenToasted=true;
        toast("🧱 队友无球掩护到位 · 贴着绕出去!","#70e8ff");
      }
      const gapStr=read.gap.toFixed(1)+"m";
      if(read.quality==="wide")offballHint(`大空位 ${gapStr} · 双手举过肩要球`);
      else if(read.quality==="tight")offballHint(`拉开半步 ${gapStr} · 可举手要球`);
      else if(guard.onBallPhase==="screen")offballHint("掩护挂住防守人 · 快绕出去要球");
      else if(guard.onBallPhase==="glance")offballHint("他在看别人 · 快加速横移");
      else offballHint(`贴防 ${gapStr} · 左右急停摆脱`);
      if(play.call){
        play.call=false;
        play.passQuality=read.quality;
        play.passGap=read.gap;
        startHandlerPass(read.cut);
        offballHint(read.cut?"传球路线被封 · 危险!":"球传过来了 · 立刻转头瞄准!");
        hideOffballOverlays();
      }else{
        syncOffballOverlays(play);
      }
    }else if(!LS.offball&&!LS.passed&&LS.t>=cfg.passAt)startHandlerPass();
    else if(LS.offball)hideOffballOverlays();
    if(LS.pass)updHandlerPass(dt);
    // Keep the bright high-clarity aim arc updating immediately during pass flight & catch!
    if(LS.offball&&global.AIBAVisionAim?.updateArc)global.AIBAVisionAim.updateArc();
    if(LS.phase==="reaction"&&!LS.released)return;

    if(!LS.released&&G.shotIdx>0){
      LS.released=true;LS.phase="flight";G.running=false;
      const wantHoop=faceTo(P.pos,HOOP);LS.lookYaw=wantHoop;P.face=wantHoop;
      if(player&&player.g){player.g.rotation.y=P.face;player.g.updateMatrixWorld(true);}
      squadApi.startPostShot();
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
      if(G.charging)doRelease(true);
      if(!G.charging&&G.shotIdx===0){
        if(LS.offball&&LS.pass){scene.remove(LS.pass.mesh);LS.pass=null;G.passCatch=null;}
        G.canShoot=false;handBall.visible=false;pBall.visible=false;
        LS.buzzed=true;sBuzz();toast("⏱ 终场蜂鸣 · 没能出手","#ff8d7a");
        broadcastSting("danger");crowdSwell&&crowdSwell(.52,2.2);
        if(typeof playAudioEvent==="function")playAudioEvent("lastshot_timeout");
        if(LS.offball)startResultReaction(false,"offball-timeout",1.2);
        else startResultReaction(false,"timeout",TIMEOUT_REACTION_SECONDS);
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
      startResultReaction(made,made?"shot":(isOvertime()?"overtime":"shot"),RESULT_REACTION_SECONDS);
    }
    if(!LS.resolved&&LS.reactionStarted){
      advanceResultReaction(dt);
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
     2) 身体 —— 原地轻微节奏 + 左右走动，脚底始终留在地面，不把庆祝做成离地跳跃；
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
    // 投篮起跳的 P.jump 不能带进胜利/结果庆祝，否则第三人称会看到整个人悬空。
    P.jump=0;
  }
  function updatePlayerCelebrate(dt){
    const c=LS.celeb;if(!c)return;
    c.t+=dt;
    // 保留 hop 计时供节奏变化使用，但庆祝根节点不再离地。
    if(c.made){
      if(c.hop>0)c.hop=Math.max(0,c.hop-dt/HOP_SECONDS);
      else{c.hopGap-=dt;if(c.hopGap<=0){c.hop=1;c.hopGap=.5+Math.random()*.9;}}
    }
    const hopY=0;
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
    if(player&&player.g)player.g.rotation.y=P.face;
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
  const _holdQ=new THREE.Quaternion(),_holdE=new THREE.Euler();
  function holdRot(node,x,y,z,k){
    _holdQ.setFromEuler(_holdE.set(x,y,z));
    if(k>=1)node.quaternion.copy(_holdQ);else node.quaternion.slerp(_holdQ,k);
  }
  function updateBodyState(dt){
    if(!LS.on||!LS.spot)return;
    if(LS.phase==="reaction")return;
    if(LS.released||LS.phase==="flight"){
      // 出手与飞行阶段：始终确保身体与朝向正对篮筐，绝不侧身/背身投篮
      const wantHoop=faceTo(P.pos,HOOP);
      LS.lookYaw=wantHoop;
      P.face=wantHoop;
      if(player&&player.g){
        player.g.rotation.y=P.face;
        player.g.updateMatrixWorld(true);
      }
      // 出手后飞行阶段：保持压腕跟随动作（Follow-through Hold）与向前专注凝视
      /* 出手那一刻手臂还在 shot-motion 的跟随里(伸展→定格→收手)，这里直接写死
         会让持球点一帧从 2.59 掉到 2.26。改成跟随收手时才渐入定格姿势，之前全交给跟随，
         和普通模式同一套出手动作。 */
      const motionApi=global.AIBAShotMotion;
      const k=motionApi&&motionApi.followRecover?motionApi.followRecover():1;
      if(!LS.reactionStarted&&k>0&&player&&player.arms&&player.elbows){
        const guy=player;
        holdRot(guy.arms[0],-2.38,0,-0.12,k);
        holdRot(guy.elbows[0],-0.25,0,0,k);
        if(guy.handRoots)holdRot(guy.handRoots[0],0.95,0,-0.06,k);
        holdRot(guy.arms[1],-2.15,0,0.28,k);
        holdRot(guy.elbows[1],-0.48,0,0,k);
        if(guy.handRoots)holdRot(guy.handRoots[1],-0.15,Math.PI*0.5,0.12,k);
        if(squadApi.guardArms)squadApi.guardArms(guy);
        if(global.AIBAShotMotion&&global.AIBAShotMotion.syncFp)global.AIBAShotMotion.syncFp();
      }
      return;
    }
    /* 蓄力起跳到球真正离手(松手后约 0.09s)这一段，身体高度和手臂归投篮动作(updPose)管。
       以前这里每帧把 g.y 按回 0(人在地上、只有手举着)；松手后 canShoot 已关、LS.released
       还没到，又被当成"等传球"摆出张手要球 —— 持球点 1.83→1.39 再一下跳回 2.26。 */
    LS.shooting=G.charging||(!!LS.shooting&&!G.canShoot&&!LS.released);
    const handler=squadApi.handler();
    /* 球一到手就必须朝篮筐——传球飞行结束后 LS.pass 会被清空，如果这里还退回
       "看持球人"，身体会转回左路的核心，投篮手直接被甩出画面左侧(实测腕 NDC
       x=-1.27、球 -1.50，全部出画)。squared up 之后只认篮筐。 */
    const inHand=G.canShoot&&!LS.released;
    const dribbling=!!(LS.cfg&&LS.cfg.selfDribble&&!inHand&&!LS.shooting);
    const target=(inHand||!handler)?V3(HOOP.x,HOOP.y+0.15,HOOP.z)
      :(dribbling?(LS.t<(LS.cutDur||0)*0.78?LS.spot:V3(HOOP.x,HOOP.y+0.15,HOOP.z)):V3(handler.pos.x,1.5,handler.pos.z));
    if(LS.pass){
      /* 球一出手就开始把视线摆向篮筐,接到球时已经squared up。
         这一段不能等球落地才转:扑防的人正是这零点几秒里横穿视线的,
         盯着传球人会被他整个挡死,而且现实里球传给你时你也该看筐。 */
      const k=clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1);
      const e=k*k*(3-2*k);
      target.lerp(V3(HOOP.x,HOOP.y+0.15,HOOP.z),e);
    }
    if(LS.offball&&!inHand&&!LS.pass)target.lerp(HOOP,.78);
    const want=faceTo(P.pos,target);
    let d=want-LS.lookYaw;while(d>Math.PI)d-=6.283185307;while(d<-Math.PI)d+=6.283185307;
    // 传球途中与接球出手时迅速转向正对篮筐（squared up），绝不侧身/背身投篮
    LS.lookYaw+=d*Math.min(1,dt*((inHand||G.charging)?26:(LS.pass?16:4.5)));

    LS.footT=(LS.footT||0)+dt;
    const cutDur=LS.cutDur||0;
    const isCutting=cutDur>0.05&&LS.t<cutDur;
    if(LS.offball){
      P.walking=waitingForCall()&&LS.offball.walking;
    }else if(isCutting){
      const cutP=clamp(LS.t/cutDur,0,1);
      // 三次平滑曲线切入
      const cutEase=cutP*cutP*(3-2*cutP);
      const from=LS.cutFrom||LS.spot;
      const dx=LS.spot.x-from.x,dz=LS.spot.z-from.z;
      const dist=Math.hypot(dx,dz)||1;
      // 沿外侧微弧线绕掩护切出，增加真实战术跑位曲线感
      const perpX=-dz/dist,perpZ=dx/dist;
      const outward=(perpX*LS.spot.x+perpZ*LS.spot.z)>0?1:-1;
      const arch=Math.sin(cutP*Math.PI)*0.32*outward;
      P.pos.x=from.x+dx*cutEase+perpX*arch;
      P.pos.z=from.z+dz*cutEase+perpZ*arch;
      P.walking=(cutP<0.95);
    }else{
      P.walking=false;
      LS.settle=(inHand||LS.shooting||LS.passed)?0:(LS.pass?1-clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1):1);
      const sway=Math.sin(LS.footT*1.15)*0.12*LS.settle;
      const drift=Math.sin(LS.footT*0.74+1.7)*0.06*LS.settle;
      const side=V3(Math.cos(LS.lookYaw),0,-Math.sin(LS.lookYaw));
      P.pos.x=LS.spot.x+side.x*sway+Math.sin(LS.lookYaw)*drift;
      P.pos.z=LS.spot.z+side.z*sway+Math.cos(LS.lookYaw)*drift;
    }
    // 第三人称模型必须朝着你实际在看的方向，否则两个视角是两个人
    P.face=LS.lookYaw;
    if(player&&player.g){
      if(inHand||LS.shooting){
        player.g.position.x=P.pos.x;
        player.g.position.z=P.pos.z;
        player.g.rotation.y=P.face;
      }else{
        player.g.position.set(P.pos.x,0,P.pos.z);
        player.g.rotation.y=P.face;
      }
      player.g.updateMatrixWorld(true);
    }

    // 张手要球靶心手势与接球呼叫（Target Hands & Ball Calling）
    // 接球等待期间保持双手前伸张开做靶心，面向持球核心
    if(waitingForCall()&&!P.walking){
      const raised=LS.offball.raisedAt!==null;
      const lift=raised?1:0;
      LS.offball.armLift+=(lift-LS.offball.armLift)*(1-Math.exp(-16*dt));
      const k=LS.offball.armLift;
      player.arms.forEach((arm,i)=>{
        arm.rotation.set(-.18-2.35*k,0,(i?1:-1)*(.08+.12*k));
        player.elbows[i].rotation.set(-.45-.2*k,0,0);
      });
      player.g.updateMatrixWorld(true);
      global.AIBAShotMotion?.syncFp?.();
    }
    const readyStart=cutDur>0.05?Math.max(0,cutDur-0.9):0;
    const readyK=clamp((LS.t-readyStart)/0.7,0,1);
    const passCatchActive=G.passCatch&&G.passCatch.active;
    if(!LS.offball&&!inHand&&!LS.shooting&&!LS.pass&&!passCatchActive&&readyK>0.02&&player&&player.arms&&player.elbows){
      const guy=player;
      if(guy.knees){
        guy.knees[0].rotation.x=0.28*readyK;
        guy.knees[1].rotation.x=0.28*readyK;
      }
      guy.g.position.y=-0.04*readyK;

      const style=LS.callStyle||"both_target";
      if(style==="both_clap"){
        // 鼓掌拍手要球：掌心相对，节奏合掌
        const clapCycle=Math.sin(LS.t*9.6);
        const clapK=Math.max(0,clapCycle)*readyK;
        const armInward=0.16+0.12*clapK;
        guy.arms[0].rotation.set(-1.35+0.04*clapK,0,armInward*readyK);
        guy.elbows[0].rotation.set(-0.68+0.08*clapK,0,0);
        guy.arms[1].rotation.set(-1.35+0.04*clapK,0,-armInward*readyK);
        guy.elbows[1].rotation.set(-0.68+0.08*clapK,0,0);
        if(guy.handRoots){
          guy.handRoots[0].rotation.set(-0.15*readyK,-Math.PI*0.5,(-0.10+0.06*clapK)*readyK);
          guy.handRoots[1].rotation.set(-0.15*readyK,Math.PI*0.5,(0.10-0.06*clapK)*readyK);
        }
      }else if(style==="single_wave"){
        // 单手高举挥动要球，另一手在前护持迎球
        const waveCycle=Math.sin(LS.t*7.5)*readyK;
        guy.arms[0].rotation.set(-1.82+0.15*waveCycle,0,-0.18*readyK);
        guy.elbows[0].rotation.set(-0.52+0.08*waveCycle,0,0);
        if(guy.handRoots){
          guy.handRoots[0].rotation.set(0,-Math.PI*0.5,waveCycle*0.28*readyK);
        }
        guy.arms[1].rotation.set(-1.32,0,-0.20*readyK);
        guy.elbows[1].rotation.set(-0.68,0,0);
        if(guy.handRoots){
          guy.handRoots[1].rotation.set(-0.20*readyK,Math.PI*0.5,0.10*readyK);
        }
      }else{
        // 默认双手张开靶心（both_target）：掌心相对，虎口朝上迎球
        const pulse=Math.sin(LS.t*5.2)*0.035*readyK;
        const armX=-1.35+pulse;
        const elbX=-0.65-pulse*0.5;
        guy.arms[0].rotation.set(armX,0,0.18*readyK);
        guy.elbows[0].rotation.set(elbX,0,0);
        guy.arms[1].rotation.set(armX,0,-0.18*readyK);
        guy.elbows[1].rotation.set(elbX,0,0);
        if(guy.handRoots){
          guy.handRoots[0].rotation.set(-0.20*readyK,-Math.PI*0.5,-0.10*readyK);
          guy.handRoots[1].rotation.set(-0.20*readyK,Math.PI*0.5,0.10*readyK);
        }
      }
      if(guy.fingerJoints){
        guy.fingerJoints.forEach((fingers,handIdx)=>{
          fingers.forEach((f,idx)=>{
            f.rotation.x=0.15*readyK;
            f.rotation.z=(handIdx===0?1:-1)*(idx-1.5)*0.12*readyK;
          });
        });
      }
      if(squadApi.guardArms)squadApi.guardArms(guy);
      if(global.AIBAShotMotion&&global.AIBAShotMotion.syncFp)global.AIBAShotMotion.syncFp();
    }
  }
  function updateLastShotCam(dt){
    if(LS.on&&LS.celeb&&updateCelebrateCam())return true;
    if(!LS.on||LS.phase==="shoot"||LS.phase==="flight"||LS.released)return false;
    if(LS.offball&&LS.phase==="live"&&CAM.mode===1){
      // Snappy agile camera tracking so fast cuts feel crisp without sluggish swimming.
      const guard=squadApi.squad.actors.foe0.pos;
      const x=P.pos.x*.82+guard.x*.18;
      rig.pos.lerp(camTarget.pos.set(x+.55,2.85,P.pos.z+4.40),1-Math.exp(-15*dt));
      rig.look.lerp(camTarget.look.set(x*.66,1.62,HOOP.z+2.5),1-Math.exp(-16*dt));
      return true;
    }
    if(CAM.mode!==0)return false;   // 玩家手动切了机位就别抢镜头
    const handler=squadApi.handler();if(!handler)return false;
    const target=V3(handler.pos.x,1.5,handler.pos.z);
    if(LS.pass){
      const k=clamp(LS.pass.t/Math.max(1e-3,LS.pass.dur),0,1);
      const e=k*k*(3-2*k);
      target.lerp(V3(HOOP.x,HOOP.y+0.15,HOOP.z),e);
    }
    // 跑位时高步频起伏，站定后呼吸起伏
    const bob=P.walking?Math.sin(LS.t*11.0)*0.032:Math.sin((LS.footT||0)*2.30)*0.015*(LS.settle==null?1:LS.settle);
    const eye=V3(P.pos.x,1.78+P.eyeDip+bob,P.pos.z);
    const dir=V3(Math.sin(LS.lookYaw),0,Math.cos(LS.lookYaw));
    if(LS.offball){
      // First-person off-ball view sits cleanly at eye height, framing defender, screener, handler, and hoop!
      rig.pos.set(eye.x+dir.x*0.08,eye.y+(typeof FP_RISE==="number"?FP_RISE:0.05),eye.z+dir.z*0.08);
      target.lerp(HOOP,.76);
      rig.look.copy(target);
    }else{
      rig.pos.set(eye.x-dir.x*0.85,eye.y+(typeof FP_RISE==="number"?FP_RISE:0.05),eye.z-dir.z*0.85);
      rig.look.copy(target);
    }

    if(LS.phase==="interlude"&&LS.interlude){
      const il=LS.interlude,u=clamp(LS.interludeT/Math.max(0.1,il.dur),0,1);
      if(il.type==="foe_ft"){
        rig.pos.set(-3.4+u*0.8,2.25,-2.6);
        rig.look.set(0,2.35,HOOP.z+1.8);
      }else if(il.type==="steal"){
        rig.pos.set(-3.8+u*1.2,2.65,4.6-u*2.4);
        rig.look.set(-1.2,1.15,2.0-u*1.5);
      }else{
        rig.pos.set(3.2-u*1.0,2.85,1.2-u*2.8);
        rig.look.set(HOOP.x,HOOP.y,HOOP.z+1.0);
      }
      if(typeof hands!=="undefined"&&hands)hands.visible=false;
      return true;
    }

    if(LS.phase==="intro"){
      const t=LS.introT;
      const cz=typeof COURT!=="undefined"&&COURT.midZ!=null?COURT.midZ:4.745;
      const sq=squadApi.squad,actors=sq&&sq.actors?sq.actors:null;
      const fpPos=rig.pos.clone();
      const fpLook=target.clone();
      if(t<1.5){
        // 混剪镜头 1: 低机位动态跟拍我方突破跳投
        const u=clamp(t/1.5,0,1);
        const a0=actors&&actors.ally0;
        rig.pos.set(-5.2+u*1.8,1.55+u*0.45,5.2-u*1.6);
        rig.look.set(a0?a0.pos.x:-1.5,1.45+u*0.8,a0?a0.pos.z:2.2);
        if(u>0.55)rig.look.lerp(V3(HOOP.x,HOOP.y,HOOP.z),(u-0.55)/0.45);
      }else if(t<3.0){
        // 混剪镜头 2: 侧翼转播机位跟拍对手王牌强投得分
        const u=clamp((t-1.5)/1.5,0,1);
        const d0=actors&&actors.def0;
        rig.pos.set(5.4-u*1.4,1.75+u*0.35,4.8-u*1.5);
        rig.look.set(d0?d0.pos.x:1.8,1.5+u*0.8,d0?d0.pos.z:2.4);
        if(u>0.55)rig.look.lerp(V3(HOOP.x,HOOP.y,HOOP.z),(u-0.55)/0.45);
      }else if(t<4.5){
        // 混剪镜头 3: 中场摇臂跟拍双方紧逼对抗与暂停哨响
        const u=clamp((t-3.0)/1.5,0,1);
        rig.pos.set(-3.2+u*2.4,3.2-u*0.6,7.8-u*1.4);
        rig.look.set(handler.pos.x*0.7,1.35,handler.pos.z*0.8);
      }else if(t<5.4){
        // 第二幕 A (4.5 - 5.4s): 切入球场当前情况全景摇镜并抬升至中央大屏
        const u=clamp((t-4.5)/0.9,0,1);
        const ease=u*u*(3-2*u);
        const courtCam=V3(0,4.8,cz+6.8);
        const courtLook=V3(0,1.6,2.2);
        const boardCam=V3(0,11.6,cz-7.6);
        const boardLook=V3(0,12.6,cz);
        rig.pos.lerpVectors(courtCam,boardCam,ease);
        rig.look.lerpVectors(courtLook,boardLook,ease);
      }else if(t<8.0){
        // 第二幕 B (5.4 - 8.0s): 比分转播大屏停留特写 (停留 2.6 秒读清比分与局势)
        const u=clamp((t-5.4)/2.6,0,1);
        rig.pos.set(Math.sin(u*Math.PI)*0.35,11.6,cz-7.6+u*0.35);
        rig.look.set(0,12.6,cz);
      }else if(t<9.8){
        // 第三幕 A (8.0 - 9.8s): 教练席战术布置 — 镜头对准边线主教练与围拢球员
        const u=clamp((t-8.0)/1.8,0,1);
        rig.pos.set(-4.35-u*0.18,1.62,2.45-u*0.25);
        rig.look.set(-6.15,1.48,2.20);
      }else if(t<11.2){
        // 第三幕 B (9.8 - 11.2s): 镜头微移对准核心队友与主教练同框讲解
        const u=clamp((t-9.8)/1.4,0,1);
        rig.pos.set(-4.45,1.60,2.20-u*0.18);
        rig.look.set(-6.00,1.48,1.82);
      }else if(t<13.0){
        // 第三幕 C (11.2 - 13.0s): 推镜近景特写！教练与核心直视镜头：“投进那该死的三分！！”
        const u=clamp((t-11.2)/1.8,0,1);
        const ease=u*u*(3-2*u);
        rig.pos.set(-4.48-ease*0.32,1.58,2.08-ease*0.08);
        rig.look.set(-6.05,1.50,1.90);
      }else{
        // 第四幕 (13.0 - 14.0s): 从教练席平滑切入玩家第一人称决胜视角
        const u=clamp((t-13.0)/1.0,0,1);
        const ease=u*u*(3-2*u);
        const benchExitCam=V3(-4.5,2.2,2.2);
        const benchExitLook=V3(0,1.5,2.2);
        rig.pos.lerpVectors(benchExitCam,fpPos,ease);
        rig.look.lerpVectors(benchExitLook,fpLook,ease);
      }
      if(typeof hands!=="undefined"&&hands)hands.visible=(t>=13.85);
      return true;
    }
    return true;
  }

  /* ---------------- 结算 ---------------- */
  /* 赢下这一攻需要的分数 = 分差 + 1，不能写死。三关的分差不一样：
       THE LAST SHOT   落后 1 → 要 2 分
       GAME SEVEN      落后 2 → 要 3 分（三罚中 2 只是打平，进加时，不算赢）
       CORNER BURIED   平局   → 要 1 分（三罚中 1 就赢了）
     原来写死 `pts>=2`，在后两关都会判错。 */
  function pointsToWin(){const c=LS.cfg;return (c.scoreAway-c.scoreHome)+1;}
  /* 所有出手点都在三分线外（scripts/lastshot-choreo.test.mjs 断言距筐 >=6.75m），
     所以命中就是 3 分；and-one 是"球进 + 加罚一次"。 */
  const SHOT_PTS=3;
  function possessionPoints(){
    const foul=LS.foul;
    if(foul)return (foul.andOne?SHOT_PTS:0)+(foul.made||0);
    const made=LS.shotMade||(G.shots.length?!!G.shots[G.shots.length-1].made:(G.score>0));
    return made?SHOT_PTS:0;
  }
  function shotSucceeded(){
    if(isMultiStage())return LS.stageIdx>=3&&LS.tmacHome>LS.tmacAway;
    return possessionPoints()>=pointsToWin();
  }
  /* 刚好追平 = 进加时，既不是赢也不是普通打铁，结果页要分开说 */
  function isOvertime(){const p=possessionPoints();return p>0&&p===pointsToWin()-1;}
  function finish(made,reason){
    if(LS.resolved)return;
    hideOffballOverlays();
    if(LS.offball)squadApi.setActorBall("foe0",false);
    setCelebrateView(false);
    hideLastShotHud();
    LS.resolved=true;LS.on=false;LS.phase="done";
    G.running=false;G.canShoot=false;G.passCatch=null;
    // 比赛结束延后淡出球馆音频，保证出比分与卡片期间欢呼与环境音平滑连贯
    setTimeout(()=>{
      if(G.state!=="lastshot"&&!LS.on)leaveArenaAudio();
    },4800);
    /* 结算收口音。延后一拍是因为出手瞬间的 lastshot_make/miss 还在响,
       两条叠在一起就成了互相盖住的噪音。刚好追平走加时那一档。 */
    if(typeof playAudioEvent==="function"){
      const ot=isOvertime();
      setTimeout(()=>{
        try{
          /* 三个 id 都要以字面量出现 —— check.js 靠 playAudioEvent("<id>") 判断
             事件表里的条目有没有真正的触发点,写成三元就绕过去了。 */
          if(ot)playAudioEvent("lastshot_overtime");
          else if(made)playAudioEvent("lastshot_result_make");
          else playAudioEvent("lastshot_result_miss");
        }catch(e){}
      },900);
    }
    if(global.AIBALastShotResult)global.AIBALastShotResult.show(LS.cfg,made,reason,LS.practice,LS.diag||null,possessionPoints());
  }

  function exitLastShot(){
    hideOffballOverlays();
    if(LS.offball){squadApi.setActorBall("foe0",false);P.walking=false;}
    leaveArenaAudio();
    setCelebrateView(false);   // 还原第一人称，否则手没了、身体一直显着
    LS.on=false;LS.phase="idle";G.running=false;G.canShoot=false;G.passCatch=null;
    if(LS.pass){scene.remove(LS.pass.mesh);LS.pass=null;}
    squadApi.dispose();
    hideLastShotHud();
  }

  /* 胜负判定单独导出,方便对着三关的分差跑结果矩阵(见 scripts/lastshot-outcome.test.mjs) */
  const outcome=Object.freeze({pointsToWin,possessionPoints,shotSucceeded,isOvertime});
  /* hideHud 必须导出:index.js 是另一个 IIFE,直接写 hideLastShotHud() 会 ReferenceError,
   而它正好在 showResult 里 beat.play() 之前,一崩整个结算演出就被跳过。 */
  const api=Object.freeze({waitingForCall,beginLastShot,updateLastShot,updateLastShotCam,exitLastShot,finish,state,outcome,hideHud:hideLastShotHud});
  Object.assign(global,{updateLastShot,updateLastShotCam,beginLastShot,exitLastShot});
  global.AIBALastShotSequence=api;
  runtime.register("mode:last-shot:sequence",api);
})(window);
