(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Practice requires AIBA runtime legacy adapter");
  const {
    $,G,RACKS,HOOP,scene,balls,P,rig,V3,ensureAudio,leaveArenaAudio,hidePanel,music,resetProgressiveSceneForRun,
    resetRackBalls,faceTo,glideTo,shotEye,applyCamMode,readyBall,toast,showPanel
  }=ctx;

  function startPractice(){
    ensureAudio(false);leaveArenaAudio();hidePanel();music(false);resetProgressiveSceneForRun();
    G.practice=true;G.moneyRack=(Math.random()*5)|0;
    G.seq=[0,1,2].map(ball=>({rack:2,ball,val:1,money:false,deep:null}));
    G.shotIdx=0;G.shots=[];G.score=0;G.streak=0;G.timer=0;G.running=false;G.buzzed=false;
    G.canShoot=false;G.blindToasted=false;G.cutQ=[];
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    resetRackBalls();
    $("hud").dataset.mode="practice";$("scoreNum").textContent="-";$("hudStreak").style.display="none";
    $("hudTimer").style.display="block";$("hudTimer").textContent="热身";$("hudTimer").className="";
    $("hudRound").innerHTML="练习模式<br><span style='color:#778'>无计时 · 无计分</span>";
    $("hudTarget").textContent="";$("hud").style.display="block";
    const start=RACKS[2].p;
    P.pos.copy(start);P.face=faceTo(start,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    G.state="cinematic";rig.pos.set(0,9,6);rig.look.copy(HOOP);
    glideTo(shotEye(G.seq[0]),HOOP.clone().add(V3(0,0.15,0)),1.4,()=>{
      G.state="round";applyCamMode();readyBall();toast("热身 · 按住蓄力,顶点出手!","#ffd23f");
    });
  }
  function endPractice(){
    G.state="roundend";
    leaveArenaAudio();
    G.practice=false;$("hud").style.display="none";applyCamMode();
    const made=G.shots.filter(shot=>shot.made).length;
    showPanel(`<h1 class="title" style="font-size:20px">热身结束 · ${made}/3</h1>
      <div class="note">${made>=2?"手感不错,上场吧!":"找到节奏了吗?顶点出手是关键"}</div>
      <button class="btn gold" onclick="hidePanel();beginStage()">开始比赛 →</button>
      <button class="btn sm" onclick="startPractice()">再来 3 球</button>`);
  }
  function updatePractice(){
    if(G.practice&&G.state==="round"&&G.shotIdx>=G.seq.length&&balls.length===0&&!G.charging&&!ctx.getPassing())endPractice();
  }
  function exitPractice(){
    leaveArenaAudio();
    G.practice=false;G.running=false;G.canShoot=false;
  }

  const api=Object.freeze({startPractice,endPractice,updatePractice,exitPractice});
  Object.assign(global,api);
  runtime.register("mode:practice",Object.freeze({id:"practice",enter:startPractice,start:startPractice,update:updatePractice,finish:endPractice,exit:exitPractice,api}));
})(window);
