"use strict";

const G={
  state:"boot",mode:"contest",diff:"normal",stage:"semi",
  opponents:[],finalist:null,
  seq:[],shotIdx:0,moneyRack:2,
  timer:70,running:false,buzzed:false,
  score:0,streak:0,charging:false,power:0,canShoot:false,moving:false,
  shots:[],stats:{best:0,moneyM:0,moneyT:0,deepM:0,deepT:0},
  semiScore:0,finalScore:0,tiebreakN:0,cheer:0,tNow:0,
  battleSpot:2,battleOpp:null,battleOppScore:0,battleNext:1.2,battleOver:false,finalRun:false,
  battleStock:null,battleReadyAt:null,superStock:0,superSeenMe:0,superSeenOpp:0,
  superChanceId:0,superResolvedId:0,battleChargeSuperChanceId:0,
  rush:null,rushResultRecord:null,audioCueLast:null,passCatch:null,
  shotPoseNoiseKey:0,lastTransition:null
};
const PAUSE={on:false,state:null,mode:null,wasRunning:false,canShoot:false,rushVariant:null,practice:false};

/* 状态切换的唯一新入口。
   旧模块仍保留少量兼容性的直接写法；这里用 accessor 把它们也收口到同一条
   transition 记录里。这样不必一次重写所有旧模式，却不会再出现“某个模块悄悄
   改了 state、相机和 HUD 却没有任何痕迹”的黑盒切换。 */
let stateValue=String(G.state||"boot"),stateTransitionId=0;
function transitionState(next,reason){
  const target=String(next||"").trim();
  if(!target)return false;
  const from=stateValue;
  if(from===target)return false;
  stateValue=target;
  G.lastTransition={id:++stateTransitionId,from,to:target,reason:String(reason||""),at:Number(G.tNow)||0};
  return true;
}
Object.defineProperty(G,"state",{
  configurable:false,
  enumerable:true,
  get:()=>stateValue,
  set:next=>{transitionState(next,"direct-assignment");}
});
window.transitionState=transitionState;
window.AIBA.runtime.register("core:state",Object.freeze({G,PAUSE,transition:transitionState,getTransition:()=>G.lastTransition}));
