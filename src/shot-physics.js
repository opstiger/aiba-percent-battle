/* ---------------- shot jump timing physics ---------------- */
(function(global){
  "use strict";
  const S={t:0,lastCharging:false,apexed:false,late:0,releaseLate:0,airborne:false,justLanded:false,releaseJump:0,lastJump:0,landingImpact:0};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  function params(ideal,rate){
    /* 不同球员/球种的出手节奏要有可读差异；过窄的 clamp 会把所有人
       压成同一拍，超远球也会被迫在同一个时刻离手。 */
    const peak=clamp(ideal/Math.max(1,rate)+.08,.68,1.24);
    // 方块人跳跃高度较低,顶点后的落地时间收至约 .36s,避免空中漂浮。
    const land=peak+.36;
    return {peak,land,auto:land-.07};
  }
  function reset(){
    S.t=0;S.lastCharging=false;S.apexed=false;S.late=0;S.releaseLate=0;S.airborne=false;S.justLanded=false;S.releaseJump=0;S.lastJump=0;S.landingImpact=0;
  }
  function update(opts){
    opts=opts||{};
    const charging=!!opts.charging,paused=charging&&!!opts.paused,dt=Math.max(0,Math.min(.08,opts.dt||0)),ideal=opts.ideal||74,rate=opts.rate||95;
    const p=params(ideal,rate),takeoff=p.peak-.22;
    S.justLanded=false;
    if(charging){
      if(!S.lastCharging){S.t=0;S.releaseLate=0;S.releaseJump=0;S.lastJump=0;S.landingImpact=0;}
      if(!paused)S.t+=dt;
    }else{
      if(S.lastCharging){
        S.airborne=S.t>=takeoff;
        S.releaseLate=S.late;
        // 记录真正出手前一帧的跳跃高度,出手后沿同一条轨迹下落,避免重新从1.0跳高造成闪动。
        S.releaseJump=S.airborne?S.lastJump:0;
      }
      if(S.airborne){
        S.t+=dt;
        if(S.t>=p.land){
          S.landingImpact=clamp((S.lastJump||S.releaseJump||0)/.55,.42,1);
          S.t=0;S.airborne=false;S.justLanded=true;
        }
      }else{
        S.t=Math.max(0,S.t-dt*4);
        S.landingImpact=Math.max(0,S.landingImpact-dt*7);
      }
    }
    S.lastCharging=charging;
    const base=opts.curve||{};
    const resting=S.justLanded||(!charging&&!S.airborne&&S.t===0);
    const fallSpan=Math.max(.12,p.land-p.peak),afterPeak=S.t>p.peak;
    const fallProgress=clamp((S.t-p.peak)/fallSpan,0,1);
    // 顶点后按重力感下落: 初速接近零, 越接近地面下降越快。
    const fall=fallProgress*fallProgress;
    const rise=ease((S.t-takeoff)/Math.max(.12,p.peak-takeoff));
    const liveLate=clamp((S.t-p.peak-.08)/Math.max(.12,p.auto-p.peak-.08),0,1);
    const late=charging?liveLate:S.releaseLate;
    S.late=afterPeak?late:0;
    const launchJump=Math.max(0,S.releaseJump||base.jmp||0);
    const jump=resting?0:(afterPeak?Math.max(0,launchJump*(1-fall)):Math.max(base.jmp||0,rise));
    const curve={
      dip:resting?0:(base.dip||0),
      lift:resting?0:(base.lift||0),
      rise:resting?0:(base.rise||0),
      jmp:jump,
      over:resting?0:(afterPeak?Math.max(base.over||0,late*.85):(base.over||0)),
      late:S.late,
      jumpT:S.t
    };
    const apexCue=charging&&!paused&&!S.apexed&&S.t>=p.peak;
    if(apexCue)S.apexed=true;
    S.lastJump=jump;
    return {curve,jump,late,landingImpact:S.landingImpact,apexCue,autoRelease:charging&&!paused&&S.t>=p.auto,airborne:S.airborne,justLanded:S.justLanded,t:S.t,params:p};
  }
  function releasePower(power,ideal){
    const late=S.late||0;
    if(late<=0)return power;
    const short=10+late*28;
    return Math.max(0,Math.min(power-short,ideal-short*.72));
  }
  function isAirborne(){return S.airborne;}
  // 供诊断用：releasePower 内部读的就是这个值，暴露出来才能区分
  // "力度不够"和"晚出手被扣力度"——扣完之后的 err 符号已经不可信了。
  function lastLate(){return S.late||0;}
  global.AIBAShotPhysics=Object.freeze({reset,update,releasePower,isAirborne,lastLate});
})(window);
