/* 逐模式体检用的浏览器内工具箱。用法(在页面里):
     await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);
     await fetch("scripts/mode-audit.js").then(r=>r.text()).then(eval);
   然后用 A.* 驱动各个模式。

   踩过的坑,写在这里免得下次再踩:
   - 这个游戏必须用**真实时间**跑。手动逐帧推进(覆盖 Clock.getDelta + 屏蔽 rAF)会让
     所有基于 performance.now() 的逻辑原地不动,对手状态机会卡死,看起来像 bug。
   - 必须走真实入口 pickDiff(),它才会设置 G.myStar / G.battleOpp / G.opponents。
     直接调 startBattle() 会让 OPP.o 为 null,oppFireBall 抛异常。
   - 中文残留扫描器要先自检:这个游戏的 body 被压成 1px 高,UI 全在 fixed 层,
     天真的可见性过滤会把所有节点都跳过,于是"扫不到"被当成"没有"。 */
(function(global){
"use strict";
const CJK=/[一-鿿]/;
const A={};

A.errors=[];
A.consoleErrors=[];
if(!global.__auditHooked){
  global.__auditHooked=true;
  addEventListener("error",e=>A.errors.push(e.message));
  addEventListener("unhandledrejection",e=>A.errors.push("unhandled: "+(e.reason&&e.reason.message||e.reason)));
  const ce=console.error;
  console.error=function(...a){A.consoleErrors.push(a.map(x=>x&&x.message||String(x)).join(" ").slice(0,200));return ce.apply(this,a);};
}
A.clearErrors=()=>{A.errors.length=0;A.consoleErrors.length=0;};

A.wait=ms=>new Promise(r=>setTimeout(r,ms));
A.waitFor=async(fn,ms=12000,step=200)=>{
  const t0=Date.now();
  while(Date.now()-t0<ms){if(fn())return true;await A.wait(step);}
  return false;
};

/** 只收"真的显示在屏幕上"的中文节点 */
A.scanCN=()=>{
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let n;const out=[];
  while((n=w.nextNode())){
    const v=(n.nodeValue||"").trim();
    if(!v||!CJK.test(v))continue;
    const el=n.parentElement;if(!el)continue;
    if(!el.offsetParent&&getComputedStyle(el).position!=="fixed")continue;
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1)continue;
    if(/^(中文|English)$/.test(v))continue;   // 语言切换按钮本身
    out.push(v.slice(0,48));
  }
  return [...new Set(out)];
};
/** 扫描器自检:塞一个真的可见的哨兵,扫不出来就说明整条链路废了 */
A.selfTest=()=>{
  const d=document.createElement("div");
  d.style.cssText="position:fixed;left:8px;top:8px;width:140px;height:20px;z-index:99999";
  d.textContent="哨兵中文";
  document.body.appendChild(d);
  const ok=A.scanCN().includes("哨兵中文");
  d.remove();
  return ok;
};

A.buttons=()=>[...document.querySelectorAll("button")]
  .filter(b=>b.offsetParent&&b.getBoundingClientRect().width>0)
  .map(b=>({el:b,t:b.textContent.trim().replace(/\s+/g," ")}));
A.click=re=>{
  const hit=A.buttons().find(b=>re.test(b.t));
  if(hit)hit.el.click();
  return hit?hit.t.slice(0,40):null;
};
A.panelText=()=>{const b=document.getElementById("ovBox");return b?b.innerText:"";};

/** 进入某个模式的标准路线:goDiff -> pickDiff(难度) */
A.enter=async(mode,diff="normal")=>{
  A.clearErrors();
  if(typeof exitLastShot==="function"&&G.mode==="lastshot")exitLastShot();
  goDiff(mode);
  await A.wait(400);
  pickDiff(diff);            // 真实入口:设置 myStar / battleOpp / opponents
  await A.wait(700);
  return G.state;
};

/** 把开场演出点过去,直到进入某个状态 */
A.advance=async(targetState,tries=30)=>{
  for(let i=0;i<tries&&G.state!==targetState;i++){
    A.click(/Tip-off|开打|Let's play|START|GO ▶|开始|Skip|跳过|继续|Next|下一/i);
    await A.wait(500);
  }
  return G.state;
};

/* 投一球:按住 holdMs 再松手,走的是和真人一样的 startCharge/doRelease。
   holdMs=null 时自动瞄准理想力度(用 playerChargeRate 反推),用来打"必进球"。 */
A.shoot=async(holdMs)=>{
  if(!G.canShoot)return "canShoot=false,不能投";
  if(holdMs==null){
    const ideal=(typeof shotIdeal==="function"&&G.shot)?shotIdeal(G.shot):58;
    holdMs=Math.max(60,ideal/Math.max(1,playerChargeRate())*1000);
  }
  startCharge();
  await A.wait(holdMs);
  doRelease();
  await A.wait(120);
  return {holdMs:Math.round(holdMs),power:+((G.power)||0).toFixed(1)};
};
/* 连投 n 球,每球之间等到重新可投为止 */
A.rally=async(n,holdMs)=>{
  const out=[];
  for(let i=0;i<n;i++){
    const ok=await A.waitFor(()=>G.canShoot,6000);
    if(!ok){out.push("等不到 canShoot,停在第"+(i+1)+"球");break;}
    out.push(await A.shoot(holdMs));
    await A.wait(900);
  }
  return out;
};

A.snap=()=>({state:G.state,mode:G.mode,running:G.running,score:G.score,
  timer:typeof G.timer==="number"?+G.timer.toFixed(1):G.timer,
  canShoot:G.canShoot,shots:(G.shots||[]).length});

global.A=A;
return A;
})(window);
