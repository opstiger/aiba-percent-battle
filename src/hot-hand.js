/* ---------------- hot hand visualizer: crowd heat + player-side HUD + 火焰加粗 ----------------
   注意:火焰**不是**这里点着的。点火的条件是"这一球出手完美"(shots.js 里的 b.perfect),
   连中只负责让已经烧起来的火更粗(patchFire 按档补粒子)。改门槛去 shots.js。 */
(function(global){
  "use strict";

  const state={streak:0,level:0,targetHeat:0,heat:0,sentHeat:-1,lastToast:0,lastSwell:0,firePatched:false};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const levelFor=s=>s>=8?3:(s>=5?2:(s>=3?1:0));
  const heatFor=l=>l===3?1:(l===2?.68:(l===1?.34:0));
  const playing=()=>typeof G!=="undefined"&&(G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush");

  let hud=null,proj=null,lastT=0;
  function ensureHud(){
    if(hud)return hud;
    hud=document.createElement("div");
    hud.id="hotHandWrap";
    hud.innerHTML="<i></i><span>HOT HAND</span>";
    document.body.appendChild(hud);
    return hud;
  }

  function crowdSet(level){
    state.targetHeat=heatFor(level);
    if(global.AIBAAudio&&typeof global.AIBAAudio.setCrowdHeat==="function"){global.AIBAAudio.setCrowdHeat(state.heat);state.sentHeat=state.heat;}
  }
  function crowdKick(level){
    const now=(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
    if(now-state.lastSwell<900)return;
    state.lastSwell=now;
    if(typeof crowdSwell==="function")crowdSwell(.07+level*.07,1.8+level*.55);
    if(level>=2&&typeof applause==="function")applianceSafe(()=>applause(.22+level*.08,1.5+level*.35));
  }
  function applianceSafe(fn){try{fn();}catch(e){}}

  function setLevel(level,streak,reason){
    level=clamp(level,0,3);
    const prev=state.level;
    state.level=level;state.streak=streak||0;
    crowdSet(level);
    try{document.documentElement.dataset.hotHand=String(level);}catch(e){}
    if(level>prev&&level>0){
      const now=(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
      if(now-state.lastToast>1600&&typeof toast==="function"){
        state.lastToast=now;
        const text=level===1?"🔥 手感升温":(level===2?"🔥 热手模式":"🔥🔥 全场沸腾");
        toast(text+" · 连中 x"+state.streak,level>=2?"#ffd23f":"#ff9c3d");
      }
      crowdKick(level);
      if(typeof phoneHaptic==="function")phoneHaptic(level>=2?[12,24,18]:10);
    }else if(level===0&&prev>0){
      crowdKick(0);
    }
  }
  function syncFromGame(force){
    if(typeof G==="undefined")return;
    const s=G.streak||0,l=levelFor(s);
    if(force||s!==state.streak||l!==state.level)setLevel(l,s,"sync");
  }

  function tagLastShotHot(){
    try{
      if(typeof balls==="undefined"||!balls.length)return;
      const b=balls[balls.length-1];
      if(!b||b.opp||b.silent)return;
      syncFromGame(false);
      if(state.level>0){
        b.hot=true;
        b.hotLevel=state.level;
      }
    }catch(e){}
  }

  function patchFire(){
    if(state.firePatched)return;
    const orig=global.emitFire;
    if(typeof orig!=="function"||orig.__aibaHotHand)return;
    const fn=function(p){
      orig.apply(this,arguments);
      const n=state.level;
      if(n<=1)return;
      for(let i=1;i<n;i++){
        const q=p&&p.clone?p.clone():{x:p.x,y:p.y,z:p.z};
        q.x+=(Math.random()-.5)*(.08+.04*i);
        q.y+=(Math.random()-.5)*(.05+.03*i);
        q.z+=(Math.random()-.5)*(.08+.04*i);
        orig(q);
      }
    };
    fn.__aibaHotHand=true;
    global.emitFire=fn;
    state.firePatched=true;
  }

  function projectHud(){
    const el=ensureHud();
    const show=playing()&&state.level>0;
    el.classList.toggle("on",show);
    if(!show)return;
    el.dataset.level=String(state.level);
    el.querySelector("span").textContent=(state.level>=3?"ON FIRE":"HOT HAND")+" x"+state.streak;
    const fp=typeof CAM!=="undefined"&&CAM.mode===0;
    el.classList.toggle("fp",fp);
    if(fp)return;
    if(typeof camera==="undefined"||typeof P==="undefined"||typeof THREE==="undefined")return;
    proj=proj||new THREE.Vector3();
    proj.set(P.pos.x,0.55,P.pos.z).project(camera);
    if(!Number.isFinite(proj.x)||!Number.isFinite(proj.y)||proj.z>1){el.classList.remove("on");return;}
    const x=(proj.x*.5+.5)*innerWidth;
    const y=(-proj.y*.5+.5)*innerHeight;
    el.style.left=clamp(x,42,innerWidth-42)+"px";
    el.style.top=clamp(y+4,70,innerHeight-72)+"px";
  }

  function tick(t){
    requestAnimationFrame(tick);
    patchFire();
    const dt=clamp(((t||0)-(lastT||t||0))/1000,0,.1);lastT=t||0;
    syncFromGame(false);
    const rate=state.targetHeat>state.heat?2.6:.85;
    state.heat+=((state.targetHeat||0)-state.heat)*clamp(dt*rate,0,1);
    if(global.AIBAAudio&&typeof global.AIBAAudio.setCrowdHeat==="function"&&Math.abs(state.heat-state.sentHeat)>.018){
      global.AIBAAudio.setCrowdHeat(state.heat);
      state.sentHeat=state.heat;
    }
    projectHud();
  }

  function wrap(name,after,reset){
    const orig=global[name];
    if(typeof orig!=="function"||orig.__aibaHotHand)return;
    const fn=function(){
      if(reset)setLevel(0,0,"reset");
      const r=orig.apply(this,arguments);
      try{after&&after.apply(this,arguments);}catch(e){}
      return r;
    };
    fn.__aibaHotHand=true;
    global[name]=fn;
  }

  wrap("releaseShot",tagLastShotHot,false);
  wrap("madeBall",function(b){syncFromGame(true);if(b&&!b.opp&&!b.silent)crowdKick(state.level);},false);
  wrap("missBall",function(){syncFromGame(true);},false);
  ["startRound","startBattle","startRackRush","startPractice","doTiebreak"].forEach(name=>wrap(name,null,true));

  global.AIBAHotHand={
    state,
    level:()=>state.level,
    isHot:()=>state.level>0,
    sync:()=>syncFromGame(true),
    shotHeat:tagLastShotHot,
    crowdKick
  };
  requestAnimationFrame(tick);
})(window);
