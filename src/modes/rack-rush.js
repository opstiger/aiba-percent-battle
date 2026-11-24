(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime;
  const ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Rack Rush requires AIBA runtime legacy adapter");

  const {
    $,G,DIFFS,RACK_RUSH_LEVELS,RACK_RUSH_RUNS_KEY,RACK_RUSH_SPEED_RUNS_KEY,
    RACK_RUSH_SPEED_TARGET,VISION,RACKS,HOOP,COURT_ATTACK_DIR,GAME_VERSION,GAME_SEED,
    scene,balls,rivals,player,passer,handBall,pBall,hands,confPts,CAM,P,rig,camTarget,
    shotProfileText,playerShotProfile,resetFinalRun,resetAudioCueMemory,resetRackBalls,
    stopCelebrate,ensureAudio,hidePanel,music,resetProgressiveSceneForRun,enterArenaAudio,leaveArenaAudio,
    faceTo,applyCamMode,autoFrameCam,glideTo,startPreGameShow,broadcastSting,paSay,
    playPregameCountdownCue,sGo,calibrateTilt,readyBall,toast,sBeep,updDotsUI,updPowerUI,
    playAudioEvent,crowdSwell,doRelease,sBuzz,startConfetti,cheerSound,airhorn,
    scoreQuoteMarkup,showPanel,startVictoryCine
  }=ctx;

  const props=runtime.service("rendering:props");
  const slotCount=5,defaultSpot=2;
  let lastSpot=defaultSpot,runId=0;
  const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  function normalizeRushSpot(value,fallback=defaultSpot){
    const index=Number(value);
    return value!=null&&value!==""&&Number.isInteger(index)&&RACKS[index]?index:fallback;
  }
  function clearRackRushSupply(){
    const supply=G.rush?.supply;
    if(!supply)return;
    scene.remove(supply.root);
    supply.root.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.ownedSupplyGeometry)mesh.geometry.dispose();});
    supply.materials.forEach(m=>m.dispose());
    G.rush.supply=null;
    global.AIBAPasserAvatar?.resetPose();
    if(passer.g.userData.rushHelper){
      delete passer.g.userData.rushHelper;
      passer.g.position.set(1.75,0,-6.85);
    }
  }
  function prepareRackRushSupply(rush){
    clearRackRushSupply();
    const top=props.rackSlotWorld(rush.spot,0),base=RACKS[rush.spot].p;
    if(!top)return;
    const axis=HOOP.clone().sub(base).setY(0).normalize();
    const outward=v(axis.z,0,-axis.x).multiplyScalar(props.getRackSide());
    const station=top.clone().setY(0).addScaledVector(outward,.36).addScaledVector(axis,-.14);
    const pickup=station.clone().setY(1.005).addScaledVector(axis,-.32);
    const basket=pickup.clone().setY(0).addScaledVector(axis,-.43);
    const root=new THREE.Group();
    root.name="rackRushSupply";
    const frame=new THREE.Group();
    frame.name="rackRushReturnCart";
    frame.position.copy(basket);frame.rotation.y=Math.atan2(-axis.z,axis.x);
    root.add(frame);scene.add(root);
    const theme=props.rackVenuePalette();
    const metal=new THREE.MeshStandardMaterial({color:theme.frame,metalness:.47,roughness:.56});
    const liner=new THREE.MeshStandardMaterial({color:theme.body,metalness:theme.metalness,roughness:.79});
    const wood=(w,h,d,x,y,z,mat=metal)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      m.userData.ownedSupplyGeometry=true;m.position.set(x,y,z);frame.add(m);
      m.castShadow=true;m.receiveShadow=true;return m;
    };
    wood(.87,.045,.68,0,.739,0,liner);
    for(const x of [-.38,.38])for(const z of [-.28,.28])wood(.045,.78,.045,x,.40,z);
    for(const z of [-.31,.31]){
      wood(.90,.037,.035,0,.93,z);
      for(const x of [-.31,-.21,-.11,0,.11,.21,.31])wood(.016,.19,.013,x,.83,z);
    }
    wood(.04,.036,.68,-.42,.925,0);
    wood(.04,.035,.68,.46,.83,0);
    for(const x of [-.36,.36])wood(.095,.075,.70,x,.069,0,liner);
    const entrySide=-props.getRackSide();
    for(const x of [-.22,.08]){
      const guide=wood(.035,.042,.80,x,.403,entrySide*.49);
      guide.rotation.x=entrySide*-.94;
    }
    const supply={root,materials:[metal,liner],axis,station,pickup,top,basket,outward,
      stock:[0,1,2,3,4],spares:[],returns:[],nextBall:6,feed:null,waiting:false,readyIn:null};
    rush.supply=supply;
    const stored=props.getRackBalls().regular[rush.spot];
    for(let i=0;i<slotCount;i++)stored[i].material=shotMaterialForSupply(i+1);
    for(const number of [6,7,8,9,10,11,12,13,15]){
      const mesh=spareBall(number%5===0);
      storeRushSpare(supply,mesh);root.add(mesh);
    }
    passer.g.position.copy(station);passer.g.rotation.y=faceTo(station,pickup);
    passer.g.userData.rushHelper=true;
    passerBall.visible=false;
    global.AIBAPasserAvatar?.resetPose();
  }
  function shotMaterialForSupply(number){return global.AIBARuntimeSupplyMaterial(number%5===0);}
  function spareBall(money){
    const mesh=new THREE.Mesh(pBall.geometry,global.AIBARuntimeSupplyMaterial(money));
    mesh.name="rackRushSpareBall";mesh.userData.money=money;mesh.castShadow=true;
    return mesh;
  }
  function spareLanding(supply,index){
    const tier=Math.floor(index/6),col=index%3,row=Math.floor(index%6/3);
    return supply.basket.clone().addScaledVector(supply.axis,(col-1)*.309+(tier?.085:0))
      .addScaledVector(supply.outward,(row-.5)*.31).setY(.90+tier*.255);
  }
  function freeSpareSlot(supply){
    const occupied=new Set([...supply.spares.map(ball=>ball.userData.cartSlot),
      ...supply.returns.map(entry=>entry.dock).filter(index=>index!=null)]);
    let index=0;
    while(occupied.has(index))index++;
    return index;
  }
  function storeRushSpare(supply,mesh,index=freeSpareSlot(supply)){
    mesh.userData.cartSlot=index;
    mesh.position.copy(spareLanding(supply,index));
    supply.spares.push(mesh);
  }
  function activeRushSupply(ri){
    if(G.mode!=="rackrush"||G.rush?.spot!==ri)return null;
    return G.rush.supply;
  }
  function consumeRackRushBall(ri,index){
    const supply=activeRushSupply(ri);
    if(supply?.stock[0]===index)supply.stock.shift();
  }
  function queueRackRushReturn(shot){
    const rush=G.rush,supply=rush?.supply;
    if(!supply||shot.rushRunId!==rush.id||!G.running||G.state!=="rackrush")return;
    const mesh=spareBall(!!shot.money);
    mesh.material=shot.mesh.material;
    mesh.position.copy(shot.mesh.position);
    mesh.position.y=Math.max(.16,mesh.position.y);
    const from=mesh.position.clone(),release=supply.basket.clone().addScaledVector(supply.outward,.40).addScaledVector(supply.axis,-.30);
    const side=release.clone();
    side.z=from.z<release.z?Math.min(-9.2,from.z):Math.max(release.z+.45,from.z);
    side.y=.16;release.y=.16;
    supply.root.add(mesh);supply.returns.push({mesh,from,side,release,t:0});
  }
  function moveRushReturns(supply,dt){
    for(let i=supply.returns.length-1;i>=0;i--){
      const entry=supply.returns[i],{mesh,from,side,release}=entry;
      entry.t+=dt;
      const k=Math.min(1,entry.t/1.7);
      if(k<.82){
        const u=k/.82;
        mesh.position.copy(from).lerp(side,u*.67).lerp(release,u*u);
        mesh.position.y=THREE.MathUtils.lerp(from.y,.16,Math.min(1,u*4));
      }else{
        if(entry.dock==null)entry.dock=freeSpareSlot(supply);
        const dock=spareLanding(supply,entry.dock);
        mesh.position.copy(release).lerp(dock,THREE.MathUtils.smoothstep(k,.82,1));
      }
      mesh.rotation.x-=dt*8.4;
      if(k<1)continue;
      supply.returns.splice(i,1);storeRushSpare(supply,mesh,entry.dock);
    }
  }
  function tickRackRushSupply(rush,dt){
    const supply=rush.supply;
    if(!supply)return;
    moveRushReturns(supply,dt);
    const avatar=global.AIBAPasserAvatar;
    const smooth=THREE.MathUtils.smoothstep;
    if(supply.retract){
      const move=supply.retract;
      move.t+=dt;
      const k=smooth(move.t,0,.23);
      avatar?.setRackPose(move.from,k);
      if(k<1)return;
      supply.retract=null;
      avatar?.setRackPose(null);
    }
    if(!supply.feed&&supply.stock.length<=3){
      const money=supply.nextBall%5===0;
      const available=supply.spares.filter(ball=>ball.userData.money===money);
      const ball=available.reduce((nearest,option)=>!nearest||
        option.position.distanceToSquared(supply.pickup)<nearest.position.distanceToSquared(supply.pickup)?option:nearest,null);
      if(ball){
        supply.spares.splice(supply.spares.indexOf(ball),1);
        supply.feed={ball,t:0,from:ball.position.clone(),goal:null,
          standFrom:passer.g.position.clone(),yawFrom:passer.g.rotation.y};
      }
    }
    const feed=supply.feed;
    if(!feed)return;
    feed.t+=dt;
    const {ball,from}=feed;
    const nextSlot=props.rackSlotWorld(rush.spot,slotCount-1-supply.stock.length);
    if(!nextSlot)return;
    if(!feed.goal)feed.goal=nextSlot.clone();
    const goal=feed.goal.lerp(nextSlot,Math.min(1,dt*14));
    const pickup=supply.pickup;
    const pickupYaw=faceTo(supply.station,pickup);
    // Stand square to the side of the receiving groove. A lower slot calls
    // for more hip hinge, never for extra arm length.
    const stand=goal.clone().setY(0).addScaledVector(supply.outward,.405);
    const rackYaw=faceTo(stand,goal);
    function moveFeet(from,to,yawFrom,yawTo,progress){
      const ease=smooth(progress,0,1);
      passer.g.position.copy(from).lerp(to,ease);
      const turn=Math.atan2(Math.sin(yawTo-yawFrom),Math.cos(yawTo-yawFrom));
      passer.g.rotation.y=yawFrom+turn*ease;
      return {from,to,yawFrom,yawTo:yawFrom+turn,progress,
        lead:turn<0?"Left":"Right"};
    }
    if(feed.t<.40){
      const returning=smooth(feed.t,0,.27);
      const step=moveFeet(feed.standFrom,supply.station,feed.yawFrom,pickupYaw,returning);
      const tray=smooth(feed.t,.02,.22);
      ball.position.copy(from).lerp(pickup,tray);
      const relax=1-smooth(feed.t,.20,.40);
      avatar?.setRackPose(ball.position,relax,step);
      return;
    }
    const carry=smooth(feed.t,.57,.95);
    const step=moveFeet(supply.station,stand,pickupYaw,rackYaw,carry);
    const center=passer.g.localToWorld(v(0,1.16,.265));
    if(feed.t<.57){
      ball.position.copy(pickup).lerp(center,smooth(feed.t,.40,.57));
    }else{
      const lower=smooth(feed.t,.95,1.22);
      ball.position.copy(center).lerp(goal,lower);
      ball.position.y+=Math.sin(Math.PI*lower)*.045;
    }
    avatar?.setRackPose(ball.position,0,step);
    if(feed.t<1.22||goal.distanceTo(nextSlot)>.022)return;
    // Let the shooter's hands clear the released ball before adding to the queue.
    const grabbing=ctx.getPassing();
    if(grabbing?.pickup&&!grabbing.rackRolled)return;
    const rack=props.getRackBalls().regular[rush.spot];
    const index=rack.findIndex(m=>!m.visible);
    if(index<0)return;
    const slot=rack[index];
    slot.position.copy(nextSlot);slot.material=shotMaterialForSupply(supply.nextBall);
    slot.visible=true;supply.stock.push(index);supply.nextBall++;
    supply.root.remove(ball);supply.feed=null;
    supply.retract={t:0,from:nextSlot.clone()};
    if(supply.waiting&&!ctx.getPassing()&&!G.buzzed){
      supply.waiting=false;readyBall();
    }
  }

  function isRackRushSpeed(thing){
    if(typeof thing==="string")return thing==="speed100";
    return !!thing&&(thing.variant==="speed100"||thing.mode==="rack-rush-speed100");
  }
  function rackRushStorageKey(variant){return isRackRushSpeed(variant)?RACK_RUSH_SPEED_RUNS_KEY:RACK_RUSH_RUNS_KEY;}
  function rackRushTarget(level){
    const cfg=RACK_RUSH_LEVELS[level];
    return cfg&&cfg.targets?cfg.targets[G.diff]:null;
  }
  function rackRushLevelLabel(level){
    const cfg=RACK_RUSH_LEVELS[level];
    return cfg?(cfg.final?"FINAL":("L"+(level+1))):"-";
  }
  function showRackRushIntro(){
    const shared=ctx.getSharedRackRush?.();
    const spot=normalizeRushSpot(shared?.spot,lastSpot);
    const spots=RACKS.map((rack,i)=>`<label class="rushSpot"><input name="rushSpot" type="radio" value="${i}" ${i===spot?"checked":""}><span>${rack.n}</span></label>`).join("");
    const targets=RACK_RUSH_LEVELS.slice(0,5).map((cfg,i)=>"L"+(i+1)+" "+cfg.targets[G.diff]).join(" · ");
    showPanel(`<h1 class="title" style="font-size:22px">RACK RUSH</h1>
      <div class="sub">投篮机挑战 · ${DIFFS[G.diff].n}</div>
      <div class="card"><b>${G.myStar.n}</b> #${G.myNum}<br><span style="color:#9ab;font-size:11px">${shotProfileText(G.myStar)}</span></div>
      <fieldset class="rushSpots"><legend>选投篮点</legend><div>${spots}</div></fieldset>
      <div class="rushModeGrid">
        <button class="rushModeCard" onclick="startRackRushFromPicker('classic')">
          <small>LEVEL RUN</small><b>闯关挑战</b><span>普通 2 分，花球 3 分，逐关达标进入 FINAL RUSH。</span>
        </button>
        <button class="rushModeCard speed" onclick="startRackRushFromPicker('speed100')">
          <small>SPEED 100</small><b>百分竞速</b><span>普通球 3 分，彩球 4 分，先冲到 100 分。</span>
        </button>
      </div>
      <div class="note">闯关晋级线 · ${targets}</div>
      <button class="btn sm" onclick="goDiff('rackrush',true)">返回设置</button>`);
  }
  function startRackRushFromPicker(variant){
    startRackRush(variant,document.querySelector('input[name="rushSpot"]:checked')?.value);
  }
  function resetRackRushState(variant,spot=lastSpot){
    clearRackRushSupply();
    variant=variant==="speed100"?"speed100":"classic";
    resetFinalRun();resetAudioCueMemory();
    G.practice=false;G.battleCut=null;
    G.seq=[];G.shotIdx=0;G.score=0;G.streak=0;G.timer=0;G.running=false;G.buzzed=false;
    G.shots=[];G.canShoot=false;G.blindToasted=false;G.cutQ=[];G.cutAway=null;G.missRun=0;
    G.stats={best:0,moneyM:0,moneyT:0,deepM:0,deepT:0};G.rush={id:++runId,spot,level:0,total:0,levelScore:0,shotNo:0,attempts:0,makes:0,levelAttempts:0,levelMakes:0,
      bestStreak:0,elapsed:0,levels:[],levelCleared:false,finalTen:false,levelEnding:false,uiAcc:0,
      control:VISION.enabled?"vision":"touch",completed:false,variant,target:variant==="speed100"?RACK_RUSH_SPEED_TARGET:null};
    G.rushResultRecord=null;
    balls.slice().forEach(ball=>{scene.remove(ball.mesh);scene.remove(ball.blob);});balls.length=0;
    const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    resetRackBalls();prepareRackRushSupply(G.rush);confPts.visible=false;
    rivals.forEach(rival=>{rival.active=false;rival.g.visible=false;});
    if(player._celeb)stopCelebrate(player);
  }
  function startRackRush(variant,spot){
    if(global.ensurePlayerShoeKit)global.ensurePlayerShoeKit();
    G.mode="rackrush";
    variant=variant==="speed100"?"speed100":"classic";
    lastSpot=normalizeRushSpot(spot,lastSpot);
    ensureAudio(false);hidePanel();music(false);resetProgressiveSceneForRun();resetRackRushState(variant,lastSpot);
    CAM.mode=1;global.AIBASetIcon("camBtn","camera",CAM.names[1]);ctx.setCamSnap(true);
    enterArenaAudio(.86);
    $("hud").dataset.mode="rackrush";$("hud").style.display="block";$("battleControls").style.display="none";$("battleScore").style.display="none";
    $("midBtn").style.display="none";$("hudTimer").style.display="block";$("hudStreak").style.display="none";
    $("scoreNum").textContent="0";$("hudTarget").textContent="";
    const base=RACKS[G.rush.spot].p;
    P.pos.copy(base);P.face=faceTo(base,HOOP);P.walking=false;P.jump=0;P.eyeDip=0;
    player.g.visible=true;passer.g.visible=true;hands.visible=false;
    G.state="rushintro";applyCamMode();
    rig.pos.set(0,8,6);rig.look.copy(HOOP);
    autoFrameCam(camTarget,P.pos,0,COURT_ATTACK_DIR,{marginX:1.44,marginY:1.34,minDist:5.6,maxDist:18});
    glideTo(camTarget.pos.clone(),camTarget.look.clone(),1.25,()=>startPreGameShow({mode:"rackrush"},()=>variant==="speed100"?startRackRushSpeed():startRackRushLevel(0)));
  }
  function startRackRushSpeed(){
    const rush=G.rush;if(!rush)return;
    rush.level=0;rush.levelScore=0;rush.shotNo=0;rush.levelAttempts=0;rush.levelMakes=0;
    rush.levelCleared=true;rush.finalTen=false;rush.levelEnding=false;rush.uiAcc=0;rush.target=RACK_RUSH_SPEED_TARGET;
    G.timer=0;G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;G.blindToasted=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    G.state="rushintro";applyCamMode();updateRackRushHUD();
    const el=$("countN");
    el.innerHTML=`<span style="font-size:30px;text-align:center;line-height:1.35">SPEED 100<br><small style="font-size:16px;color:#fff">百分竞速</small></span>`;
    el.style.display="flex";broadcastSting("score");paSay("百分竞速,先到一百分停止计时!",true);
    setTimeout(()=>{if(G.rush===rush&&G.state==="rushintro")countdownRackRush(3);},900);
  }
  function startRackRushLevel(level){
    const rush=G.rush,cfg=RACK_RUSH_LEVELS[level];if(!rush||!cfg)return;
    if(level!==rush.level){clearRackRushSupply();resetRackBalls();prepareRackRushSupply(rush);}
    rush.level=level;rush.levelScore=0;rush.shotNo=0;rush.levelAttempts=0;rush.levelMakes=0;
    rush.levelCleared=!!cfg.final;rush.finalTen=false;rush.levelEnding=false;rush.uiAcc=0;
    G.timer=cfg.time;G.running=false;G.buzzed=false;G.canShoot=false;G.charging=false;G.power=0;G.blindToasted=false;
    handBall.visible=false;pBall.visible=false;$("pFill").style.height="0%";
    G.state="rushintro";applyCamMode();updateRackRushHUD();
    const el=$("countN");
    el.innerHTML=`<span style="font-size:30px;text-align:center;line-height:1.35">${rackRushLevelLabel(level)}<br><small style="font-size:16px;color:#fff">${cfg.name}</small></span>`;
    el.style.display="flex";broadcastSting(cfg.final?"danger":"score");
    paSay(cfg.final?"FINAL RUSH,最后冲刺!":("第"+(level+1)+"关,"+cfg.name+"。目标"+rackRushTarget(level)+"分。"),true);
    setTimeout(()=>{if(G.rush===rush&&G.state==="rushintro")countdownRackRush(3);},900);
  }
  function countdownRackRush(n){
    const el=$("countN");
    if(!G.rush||G.state!=="rushintro")return;
    if(n===3)playPregameCountdownCue();
    if(n===0){
      el.textContent="GO!";el.style.display="flex";sGo();setTimeout(()=>el.style.display="none",450);
      calibrateTilt();G.state="rackrush";G.running=true;G.buzzed=false;applyCamMode();readyBall();
      if(isRackRushSpeed(G.rush))toast("百分竞速 · 冲到 100 分停表","#ffd23f");
      else toast(RACK_RUSH_LEVELS[G.rush.level].final?"FINAL RUSH · 尽可能多拿分":"达标后不停表 · 继续刷总分","#ffd23f");
      return;
    }
    const rush=G.rush,level=rush.level;
    el.textContent=n;el.style.display="flex";sBeep();
    setTimeout(()=>{if(G.rush===rush&&rush.level===level)countdownRackRush(n-1);},650);
  }
  function rackRushShot(){
    const rush=G.rush;if(!rush)return null;
    const number=rush.shotNo+1,money=number%5===0,finalTen=!isRackRushSpeed(rush)&&G.timer<=10;
    const pick={rack:rush.spot,ball:rush.supply?.stock[0]??null,money,deep:null,p:RACKS[rush.spot].p,rush:true,number};
    if(isRackRushSpeed(rush))return {...pick,val:money?4:3,baseVal:money?4:3,bonus:0};
    return {...pick,val:(money?3:2)+(finalTen?1:0),baseVal:money?3:2,bonus:finalTen?1:0};
  }
  function rackRushBarHidden(){
    const rush=G.rush,cfg=rush&&RACK_RUSH_LEVELS[rush.level];if(!rush||!cfg)return false;
    if(isRackRushSpeed(rush))return rush.shotNo>=3;
    if(cfg.bar==="all")return false;
    if(cfg.bar==="time10")return (cfg.time-G.timer)>=10;
    if(cfg.bar==="shots5")return rush.shotNo>=5;
    return true;
  }
  function updateRackRushHUD(){
    const rush=G.rush;if(!rush)return;
    if(isRackRushSpeed(rush)){
      $("hudRound").innerHTML="RACK RUSH · SPEED 100<br><span style='color:#778'>"+DIFFS[G.diff].n+" · 普通3分 / 彩球4分</span>";
      $("hudTimer").textContent=formatRackRushClock(rush.elapsed);$("hudTimer").className="";$("scoreNum").textContent=rush.total;
      $("hudTarget").textContent="目标 "+Math.min(rush.total,RACK_RUSH_SPEED_TARGET)+" / "+RACK_RUSH_SPEED_TARGET+" · 用时越短排名越高";
      $("hudStreak").style.display=G.streak>=3?"block":"none";if(G.streak>=3)$("hudStreak").textContent="🔥 x"+G.streak;
      updDotsUI();updPowerUI();return;
    }
    const cfg=RACK_RUSH_LEVELS[rush.level],target=rackRushTarget(rush.level);
    $("hudRound").innerHTML=(cfg.final?"FINAL RUSH":("RACK RUSH · L"+(rush.level+1)))+"<br><span style='color:#778'>"+DIFFS[G.diff].n+" · "+cfg.name+"</span>";
    $("hudTimer").textContent=Math.max(0,G.timer).toFixed(1);$("hudTimer").className=G.timer<=10?"low":"";$("scoreNum").textContent=rush.total;
    $("hudTarget").textContent=cfg.final?("本关 "+rush.levelScore+" · 无晋级线"):("本关 "+rush.levelScore+" / "+target+(rush.levelCleared?" · CLEAR":""));
    $("hudStreak").style.display=G.streak>=3?"block":"none";if(G.streak>=3)$("hudStreak").textContent="🔥 x"+G.streak;
    updDotsUI();updPowerUI();
  }
  function rackRushClearFlash(){
    playAudioEvent("rack_clear");const el=$("vsBanner");el.innerHTML="CLEAR<br><span style='font-size:11px;color:#dce8f4'>继续投 · 分数仍计入总分</span>";el.style.display="block";broadcastSting("score");crowdSwell(.35,1.8);
    setTimeout(()=>{if(G.state==="rackrush")el.style.display="none";},1250);
  }
  function updateRackRush(dt){
    const rush=G.rush;if(!rush||G.state!=="rackrush")return;
    if(G.running&&!G.buzzed){
      tickRackRushSupply(rush,dt);
      const supply=rush.supply;
      if(supply?.readyIn!=null){
        supply.readyIn-=dt;
        if(supply.readyIn<=0&&!global.AIBAShotPhysics?.isAirborne()){
          supply.readyIn=null;
          readyBall();
        }
      }
    }
    if(isRackRushSpeed(rush)){
      if(G.running){
        if(rush.total>=88&&global.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm("百分竞速最后三球");rush.elapsed+=dt;G.timer=rush.elapsed;rush.uiAcc+=dt;
        if(rush.uiAcc>=.1){rush.uiAcc=0;updateRackRushHUD();}
      }
      return;
    }
    if(G.running){
      if(G.timer<=12&&global.AIBARecorder&&AIBARecorder.arm)AIBARecorder.arm("RACK RUSH 最后三球");rush.elapsed+=dt;G.timer=Math.max(0,G.timer-dt);rush.uiAcc+=dt;
      if(!rush.finalTen&&G.timer<=10){
        rush.finalTen=true;broadcastSting("danger");crowdSwell(.35,3);toast("FINAL 10 · 命中额外 +1","#ff5d4d");
        if(!playAudioEvent("contest_final10"))paSay("最后十秒,每球加一分!",true);
      }
      const lowBeep=ctx.getLowBeep();if(G.timer<=5&&G.timer>0&&G.tNow-lowBeep>1){ctx.setLowBeep(G.tNow);sBeep();}
      if(rush.uiAcc>=.1){rush.uiAcc=0;updateRackRushHUD();}
      if(G.timer<=0&&!G.buzzed){
        G.buzzed=true;G.running=false;sBuzz();paSay("时间到!",true);
        if(G.charging)doRelease(true);
        else global.AIBAHeroMoments?.onRackRushBuzzer();
        G.canShoot=false;G.charging=false;handBall.visible=false;pBall.visible=false;
        toast("时间到 · 等待最后一球","#ff8d7a");
      }
    }
    if(G.buzzed&&!rush.levelEnding&&!G.charging&&!ctx.getPassing()&&!balls.some(ball=>ball.rush))finishRackRushLevel();
  }
  function finishRackRushLevel(){
    const rush=G.rush;if(!rush||rush.levelEnding)return;
    if(isRackRushSpeed(rush)){finishRackRushSpeed();return;}
    rush.levelEnding=true;G.running=false;G.canShoot=false;G.state="rushbetween";$("vsBanner").style.display="none";
    const cfg=RACK_RUSH_LEVELS[rush.level],target=rackRushTarget(rush.level),passed=cfg.final||rush.levelScore>=target;
    rush.levels.push({level:rush.level+1,name:cfg.name,score:rush.levelScore,target,attempts:rush.levelAttempts,makes:rush.levelMakes,passed});
    if(cfg.final){rush.completed=true;startConfetti();cheerSound(true);setTimeout(()=>finishRackRushRun(true),1100);return;}
    if(!passed){broadcastSting("danger");setTimeout(()=>finishRackRushRun(false),900);return;}
    if(global.AIBARecorder&&AIBARecorder.discard)AIBARecorder.discard();
    const el=$("countN");el.innerHTML=`<span style="font-size:38px;text-align:center;line-height:1.35;color:#7CFC6B">CLEAR<br><small style="font-size:15px;color:#fff">${rush.levelScore} / ${target} · 总分 ${rush.total}</small></span>`;
    el.style.display="flex";cheerSound(true);setTimeout(()=>{el.style.display="none";startRackRushLevel(rush.level+1);},1450);
  }
  function finishRackRushSpeed(){
    const rush=G.rush;if(!rush||rush.levelEnding)return;
    rush.levelEnding=true;rush.completed=true;G.running=false;G.canShoot=false;G.buzzed=true;G.state="rushbetween";$("vsBanner").style.display="none";
    G.charging=false;handBall.visible=false;pBall.visible=false;const passing=ctx.getPassing();if(passing){scene.remove(passing.mesh);ctx.setPassing(null);}
    rush.levels=[{level:1,name:"百分竞速",score:rush.total,target:RACK_RUSH_SPEED_TARGET,attempts:rush.levelAttempts,makes:rush.levelMakes,passed:true}];
    const el=$("countN");el.innerHTML=`<span style="font-size:36px;text-align:center;line-height:1.35;color:#ffd23f">100!<br><small style="font-size:15px;color:#fff">用时 ${formatRackRushClock(rush.elapsed)}</small></span>`;
    const withHero=typeof hero!=="undefined"&&hero.on&&hero.b?.made;
    const celebrate=()=>{
      if(G.rush!==rush||G.state!=="rushbetween")return;
      el.style.display="flex";startConfetti();cheerSound(true);airhorn();broadcastSting("score");
      setTimeout(()=>{
        if(G.rush!==rush||G.state!=="rushbetween")return;
        el.style.display="none";finishRackRushRun(true);
      },withHero?720:950);
    };
    if(withHero)setTimeout(celebrate,580);
    else celebrate();
  }
  function loadRackRushRuns(variant){
    try{const rows=JSON.parse(localStorage.getItem(rackRushStorageKey(variant))||"[]");return Array.isArray(rows)?rows:[];}catch(e){return[];}
  }
  function rackRushAccuracy(record){return record.attempts?record.makes/record.attempts:0;}
  function formatRackRushClock(sec){
    sec=Math.max(0,sec||0);const min=Math.floor(sec/60),rest=sec-min*60;
    return min?min+":"+String(Math.floor(rest)).padStart(2,"0")+"."+Math.floor((rest%1)*10):rest.toFixed(1);
  }
  function makeRackRushRecord(){
    const rush=G.rush,accuracy=rush.attempts?rush.makes/rush.attempts:0,speed=isRackRushSpeed(rush),profile=playerShotProfile();
    const stats=global.summarizeResultStats?global.summarizeResultStats():{};
    return Object.assign({schema:1,version:GAME_VERSION,mode:speed?"rack-rush-speed100":"rack-rush",variant:speed?"speed100":"classic",
      target:speed?RACK_RUSH_SPEED_TARGET:null,total:rush.total,highestLevel:speed?1:rush.level+1,completed:!!rush.completed,
      rackSpot:rush.spot,rackSpotName:RACKS[rush.spot].n,elapsedMs:Math.round(rush.elapsed*1000),attempts:rush.attempts,makes:rush.makes,accuracy,bestStreak:rush.bestStreak,
      levels:rush.levels.slice(),difficulty:G.diff,control:rush.control,playerId:G.myStar&&(G.myStar.id||G.myStar.n),
      playerName:G.myStar&&G.myStar.n,shotSpeed:profile.speed,sweetWindow:profile.window,shotArc:profile.arc,shotArcLabel:profile.arcLabel,
      scene:ctx.getScenePreset(),weather:ctx.getWeather(),seed:GAME_SEED,completedAt:new Date().toISOString()},stats);
  }
  function saveRackRushRecord(record){
    try{const rows=loadRackRushRuns(record.variant);rows.unshift(record);localStorage.setItem(rackRushStorageKey(record.variant),JSON.stringify(rows.slice(0,50)));}catch(e){}
    G.rushResultRecord=record;
    try{global.__aibaLastRackRushRecord=record;global.__aibaRackRushRuns=()=>loadRackRushRuns(record.variant);if(global.AIBALeaderboardUI)AIBALeaderboardUI.submitRecord(record);else if(global.AIBALeaderboard)AIBALeaderboard.submit(record).catch(()=>{});}catch(e){}
    return record;
  }
  function sortRackRushRuns(rows){
    if(rows.some(record=>isRackRushSpeed(record)))return rows.sort((a,b)=>(a.elapsedMs||999999999)-(b.elapsedMs||999999999)||b.total-a.total||rackRushAccuracy(b)-rackRushAccuracy(a)||a.attempts-b.attempts);
    return rows.sort((a,b)=>b.total-a.total||b.highestLevel-a.highestLevel||a.elapsedMs-b.elapsedMs||rackRushAccuracy(b)-rackRushAccuracy(a)||b.bestStreak-a.bestStreak);
  }
  function formatRackRushTime(ms){
    const sec=Math.max(0,Math.floor((ms||0)/1000)),min=Math.floor(sec/60);return min+":"+String(sec%60).padStart(2,"0");
  }
  function rackRushLevelRows(record){
    return record.levels.map(row=>`<tr><td>${row.level<=5?"L"+row.level:"FINAL"} · ${row.name}</td><td>${row.score}${row.target!=null?" / "+row.target:""}</td></tr>`).join("");
  }
  function showRackRushResult(record){
    G.state="rushend";
    leaveArenaAudio();
    const accuracy=Math.round(rackRushAccuracy(record)*100),speed=isRackRushSpeed(record),headline=speed?"百分竞速完成":(record.completed?"FINAL RUSH 完成":"挑战结束");
    if(global.AIBARecorder&&AIBARecorder.result)AIBARecorder.result(record,{title:headline,score:speed?formatRackRushClock(record.elapsedMs/1000):record.total+" PTS",sub:`命中 ${record.makes}/${record.attempts} · 命中率 ${accuracy}%`,postMs:9000});
    showPanel(`${global.AIBAResultHeaderMarkup(record,{headline,score:speed?formatRackRushClock(record.elapsedMs/1000):record.total+" 分",label:speed?"TIME (SECONDS)":"TOTAL POINTS",mode:speed?"100% SPRINT COMPLETE":"RACK RUSH COMPLETE"})}
      <div class="rushMeta">${speed?`<span>${record.total} / ${RACK_RUSH_SPEED_TARGET} 分</span><span>命中 ${record.makes}/${record.attempts}</span><span>命中率 ${accuracy}%</span><span>连中 x${record.bestStreak}</span><span>${DIFFS[record.difficulty].n}</span>`:`<span>最高 ${record.completed?"FINAL":"L"+record.highestLevel}</span><span>命中 ${record.makes}/${record.attempts}</span><span>命中率 ${accuracy}%</span><span>连中 x${record.bestStreak}</span><span>${formatRackRushTime(record.elapsedMs)}</span>`}</div>
      ${global.AIBAResultBadgeMarkup?AIBAResultBadgeMarkup(record):""}<details class="resultDetails"><summary>查看闯关数据 (VIEW DATA)</summary><table class="std rushLevels">${rackRushLevelRows(record)}</table></details>
      ${global.AIBACloudRankMarkup?AIBACloudRankMarkup(record):""}${scoreQuoteMarkup()}${global.AIBARecorder?AIBARecorder.resultMarkup():""}
      <button class="btn gold" onclick="startRackRush('${speed?"speed100":"classic"}',${normalizeRushSpot(record.rackSpot)})">重新挑战</button>
      <button class="btn green" onclick="showOnlineLeaderboardForRecord(G.rushResultRecord)">全球排行榜</button>
      <button class="btn sm" onclick="shareRackRushResult()">分享成绩</button>
      <button class="btn sm" onclick="showMenu()">返回封面</button>`);
  }
  function finishRackRushRun(completed){
    const rush=G.rush;if(!rush)return;rush.completed=!!completed;
    if(global.AIBARecorder)AIBARecorder.mark(isRackRushSpeed(rush)?"百分竞速冲线":"RACK RUSH 最后一球",{postMs:completed?5600:4200});
    G.running=false;G.canShoot=false;applyCamMode();
    /* 收 HUD 推迟到留白结束。通关走胜利运镜(下面 startVictoryCine),
       失败原本是 0 秒直接弹面板 —— 而没通关才是常态,那条路径反而最需要收尾。 */
    if(typeof transitionState==="function")transitionState(completed?"rushend":"resultbeat",completed?"rack-rush-victory":"rack-rush-result-beat");
    else G.state=completed?"rushend":"resultbeat";
    const record=saveRackRushRecord(makeRackRushRecord());
    if(isRackRushSpeed(record)){
      const prev=sortRackRushRuns(loadRackRushRuns("speed100").filter(row=>row.completed&&row.completedAt!==record.completedAt));
      const best=prev[0],rank=sortRackRushRuns(loadRackRushRuns("speed100").filter(row=>row.completed)).findIndex(row=>row.completedAt===record.completedAt)+1;
      if(!best||record.elapsedMs<best.elapsedMs){if(!playAudioEvent("speed100_finish_record"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(record.elapsedMs-best.elapsedMs<=3000){if(!playAudioEvent("speed100_finish_close"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(rank>0&&rank<=3){if(!playAudioEvent("speed100_finish_board"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);}
      else if(!playAudioEvent("speed100_finish"))paSay("百分竞速完成,用时"+formatRackRushClock(record.elapsedMs/1000)+"!",true);
    }else if(completed){airhorn();paSay("RACK RUSH完成,总分"+record.total+"分!",true);}
    else if(!playAudioEvent("rack_fail"))paSay("本次挑战结束,总分"+record.total+"分。",true);
    if(completed){
      $("hud").style.display="none";
      startConfetti();cheerSound(true);G.cheer=1;
      startVictoryCine({hero:player,foil:passer,nextState:"rushend",tag:isRackRushSpeed(record)?"🏁 百分竞速完成":"🏆 RACK RUSH 完成",dur:4.4,onDone:()=>showRackRushResult(record)});
      return;
    }
    /* 失败也要给一拍:蜂鸣器、观众的叹息、球员的懊恼走完再进结算。 */
    const toPanel=()=>{if(typeof transitionState==="function")transitionState("rushend","rack-rush-result-panel");else G.state="rushend";$("hud").style.display="none";showRackRushResult(record);};
    if(global.AIBAResultBeat)global.AIBAResultBeat.play({
      eyebrow:isRackRushSpeed(record)?"百分竞速结束":"本次挑战结束",
      score:isRackRushSpeed(record)?formatRackRushClock(record.elapsedMs/1000):record.total,
      unit:isRackRushSpeed(record)?"":"分",
      note:"再来一次",tone:"bad",seconds:3.0,onDone:toPanel});
    else toPanel();
  }
  function showRackRushLeaderboard(){
    const record=G.rushResultRecord,variant=record?record.variant:(G.rush&&G.rush.variant)||"classic",speed=isRackRushSpeed(variant),control=record?record.control:(VISION.enabled?"vision":"touch");
    const rows=sortRackRushRuns(loadRackRushRuns(variant).filter(row=>row.difficulty===G.diff&&row.control===control)).slice(0,10);
    const body=rows.length?rows.map((row,i)=>speed?
      `<tr class="${record&&row.completedAt===record.completedAt?"me":""}"><td>${i+1}</td><td>${formatRackRushClock(row.elapsedMs/1000)}</td><td>${row.total}</td><td>${Math.round(rackRushAccuracy(row)*100)}%</td><td>${row.makes}/${row.attempts}</td></tr>`:
      `<tr class="${record&&row.completedAt===record.completedAt?"me":""}"><td>${i+1}</td><td>${row.total}</td><td>${row.completed?"FINAL":"L"+row.highestLevel}</td><td>${Math.round(rackRushAccuracy(row)*100)}%</td><td>${formatRackRushTime(row.elapsedMs)}</td></tr>`).join(""):'<tr><td colspan="5">暂无记录</td></tr>';
    showPanel(`<h1 class="title" style="font-size:22px">${speed?"百分竞速排行榜":"RACK RUSH 排行榜"}</h1><div class="note">${DIFFS[G.diff].n} · ${control==="vision"?"体感控制":"触屏控制"} · 本机记录</div>
      <table class="std"><tr>${speed?"<td>#</td><td>用时</td><td>分数</td><td>命中</td><td>出手</td>":"<td>#</td><td>总分</td><td>关卡</td><td>命中</td><td>耗时</td>"}</tr>${body}</table>
      <button class="btn sm" onclick="showRackRushResult(G.rushResultRecord)">返回成绩</button>`);
  }
  async function shareRackRushResult(){
    const record=G.rushResultRecord;if(!record)return;
    const speed=isRackRushSpeed(record);
    const text=speed?`aiBA RACK RUSH · 百分竞速\n${formatRackRushClock(record.elapsedMs/1000)} 达成100分 · 命中率 ${Math.round(rackRushAccuracy(record)*100)}%\n${global.AIBARecordRankText?AIBARecordRankText(record):"全球排名同步中"}`:
      `aiBA RACK RUSH · ${DIFFS[record.difficulty].n}\n${record.total}分 · ${record.completed?"完成 FINAL RUSH":"最高 L"+record.highestLevel} · 命中率 ${Math.round(rackRushAccuracy(record)*100)}%\n${global.AIBARecordRankText?AIBARecordRankText(record):"全球排名同步中"}`;
    let url=location.href;
    try{const nextUrl=new URL(location.href);nextUrl.searchParams.set("mode","rackrush");nextUrl.searchParams.set("diff",record.difficulty);nextUrl.searchParams.set("seed",record.seed);nextUrl.searchParams.set("scene",record.scene);nextUrl.searchParams.set("spot",normalizeRushSpot(record.rackSpot));nextUrl.searchParams.set("star",record.playerId);if(speed)nextUrl.searchParams.set("submode","speed100");else nextUrl.searchParams.delete("submode");url=nextUrl.toString();}catch(e){}
    try{if(navigator.share){await navigator.share({title:speed?"aiBA SPEED 100":"aiBA RACK RUSH",text,url});return;}}catch(e){if(e&&e.name==="AbortError")return;}
    try{await navigator.clipboard.writeText(text+"\n"+url);toast("成绩与挑战链接已复制","#7CFC6B");}catch(e){toast(text,"#ffd23f");}
  }

  const api={
    isRackRushSpeed,rackRushStorageKey,rackRushTarget,rackRushLevelLabel,showRackRushIntro,startRackRushFromPicker,
    activeRushSupply,consumeRackRushBall,clearRackRushSupply,queueRackRushReturn,
    resetRackRushState,startRackRush,startRackRushSpeed,startRackRushLevel,countdownRackRush,
    rackRushShot,rackRushBarHidden,updateRackRushHUD,rackRushClearFlash,updateRackRush,
    finishRackRushLevel,finishRackRushSpeed,loadRackRushRuns,rackRushAccuracy,formatRackRushClock,
    makeRackRushRecord,saveRackRushRecord,sortRackRushRuns,formatRackRushTime,rackRushLevelRows,
    showRackRushResult,finishRackRushRun,showRackRushLeaderboard,shareRackRushResult
  };
  Object.assign(global,api);
  runtime.register("mode:rackrush",Object.freeze({
    id:"rackrush",
    enter:startRackRush,
    start:startRackRush,
    update:updateRackRush,
    finish:finishRackRushRun,
    exit:clearRackRushSupply,
    api:Object.freeze(api)
  }));
})(window);
