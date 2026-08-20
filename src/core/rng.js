/* ---------------- 判定用随机数(可复现) ----------------
   借鉴 Pallet Town 3D 的做法:凡是影响结果的随机,都要能复现。

   **只有"决定输赢的那几下"走这里**:
     - 玩家出手结果(swish / rattle / bank / miss)
     - 出手时的手抖横向偏差
     - 绝杀时刻的犯规判定
     - 电脑对手的命中判定
   演出用的随机(欢呼台词、镜头抖动、观众反应、球滚动方向)**继续用 Math.random()** ——
   那些每次不一样才对,固定了反而假。

   为什么要有它:排查 bug 时"复现不了"是最贵的。这轮就踩过两次 ——
   为了逼出绝杀犯规,只能临时 monkey-patch `Math.random=()=>0.01`;
   而那个 whistle 崩溃因为无法稳定复现,最后只能加守卫止血、没查到根因。

   用法:
     aibaRoll()            -> [0,1),等价于 Math.random()
     aibaRollRange(a,b)    -> [a,b)
     AIBARandom.seed()     -> 当前种子(没固定时返回 null)
     AIBARandom.reseed(n)  -> 重新播种,测试里用来跑同一局两遍
   地址栏 ?seed=12345 固定种子;不带 seed 就用时间播种,正常游玩照样每局不同。 */
(function(global){
"use strict";

/* mulberry32:32 位状态,分布够用,实现只有几行,不需要引第三方。 */
function mulberry32(a){
  return function(){
    a=(a+0x6D2B79F5)|0;
    let t=a;
    t=Math.imul(t^(t>>>15),1|t);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

let fixedSeed=null;
try{
  const q=new URLSearchParams(global.location?global.location.search:"").get("seed");
  if(q!==null&&q!==""&&!isNaN(+q))fixedSeed=(+q)>>>0;
}catch(e){}

/* 没固定种子时也走同一条通道,只是种子来自时间 ——
   这样"是否可复现"只有一个开关,不会出现两套代码路径。 */
let seed=fixedSeed!==null?fixedSeed:(Date.now()>>>0);
let next=mulberry32(seed);
let count=0;

function roll(){count++;return next();}
function rollRange(min,max){return min+roll()*(max-min);}
function reseed(n){
  seed=(n>>>0);next=mulberry32(seed);count=0;
  return seed;
}

const api={
  roll,rollRange,reseed,
  seed:()=>fixedSeed!==null?seed:null,   // 只有明确固定过才算"可复现"
  currentSeed:()=>seed,
  rolls:()=>count,
  isFixed:()=>fixedSeed!==null
};

global.aibaRoll=roll;
global.aibaRollRange=rollRange;
global.AIBARandom=api;
if(global.AIBA&&global.AIBA.runtime&&global.AIBA.runtime.register)
  global.AIBA.runtime.register("core:rng",Object.freeze(api));
if(fixedSeed!==null&&global.console)console.log("[aiBA] 判定随机数已固定种子 seed="+seed);
})(window);
