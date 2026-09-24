"use strict";

/* aiBA 触觉反馈:统一震动词表 + 关键时刻接线。
   注意:iOS Safari 不支持 navigator.vibrate,以下只在安卓 Chrome 等支持设备生效。
   词表原则:普通事件轻(6-18ms)、关键时刻长、庆祝有节奏,长短对比才有"手感"。 */

let lastRimHapticAt=0;

function phoneHaptic(pattern){
  try{return !!(navigator.vibrate&&navigator.vibrate(pattern));}
  catch(e){return false;}
}

const HAPTIC_PATTERNS=Object.freeze({
  rim:16,                      // 砸框/砸板轻点(playerRimHaptic 使用)
  clutchMake:[70,50,110],      // 最后时刻命中:长震收尾
  heroShot:[25,40,70],         // 最后一球出手瞬间(英雄运镜开场)
  victory:[50,60,50,60,150],   // 胜利/庆祝短片:节奏渐强
  exhausted:[40,30,50]         // 精力耗尽提示
});

function playerRimHaptic(ball){
  if(!ball||ball.opp||ball.silent||ball.rimHaptic)return false;
  ball.rimHaptic=true;
  const now=(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
  if(now-lastRimHapticAt<120)return false;
  lastRimHapticAt=now;
  return phoneHaptic(HAPTIC_PATTERNS.rim);
}

/* 真实物理球的碰撞震动（PH-3）：时长按冲量，轻擦 6ms、重砸 28ms；同一颗球可以震多次
   （转筐每磕一下都震），但全局 90ms 内只震一次，免得连成一串。 */
let lastImpactHapticAt=0;
function impactHaptic(ball,impulse){
  if(!ball||ball.opp||ball.silent)return false;
  const now=(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
  if(now-lastImpactHapticAt<90)return false;
  lastImpactHapticAt=now;
  const ms=Math.round(Math.max(6,Math.min(28,6+(Number(impulse)||0)*3.2)));
  return phoneHaptic(ms);
}

/* ---- 关键时刻接线:等主脚本和 hero-moments 等模块都加载完再包装全局函数 ---- */
function hapticClutchNow(){
  if(typeof G==="undefined")return false;
  if(G.state==="tiebreak")return true;
  if(G.mode==="battle")return (G.score||0)>=85||(G.battleOppScore||0)>=85;
  if((G.state==="round"||G.state==="rackrush")&&G.running)return G.timer<=10;
  return false;
}
function wireHapticMoments(){
  const wrap=(name,after)=>{
    const orig=window[name];
    if(typeof orig!=="function"||orig.__aibaHaptic)return;
    const fn=function(){
      const r=orig.apply(this,arguments);
      try{after.apply(this,arguments);}catch(e){}
      return r;
    };
    fn.__aibaHaptic=true;
    window[name]=fn;
  };
  // 最后时刻命中 → 长震(覆盖内联的普通短震,vibrate 会取消前一个模式)
  wrap("madeBall",function(b){
    if(b&&!b.opp&&!b.silent&&hapticClutchNow())phoneHaptic(HAPTIC_PATTERNS.clutchMake);
  });
  // 最后一球英雄运镜开场 → 出手瞬间递进震
  wrap("startHero",function(){phoneHaptic(HAPTIC_PATTERNS.heroShot);});
  // 胜利短片 / 冠军庆祝 → 节奏庆祝震
  ["startVictoryCine","startWinCine","startCelebrate"].forEach(name=>{
    wrap(name,function(){phoneHaptic(HAPTIC_PATTERNS.victory);});
  });
  window.AIBAHaptics={patterns:HAPTIC_PATTERNS,phoneHaptic,clutchNow:hapticClutchNow};
}
if(document.readyState==="loading")addEventListener("DOMContentLoaded",wireHapticMoments);
else wireHapticMoments();
