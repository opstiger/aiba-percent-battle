/* ---------------- shot jump timing physics ---------------- */
(function(global){
  "use strict";
  const S={t:0,lastCharging:false,lateStartPower:null,apexed:false,late:0,releaseLate:0,airborne:false,justLanded:false,releaseJump:0,releaseRise:0,lastJump:0,lastLaunch:0,landingImpact:0};
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
    S.t=0;S.lastCharging=false;S.lateStartPower=null;S.apexed=false;S.late=0;S.releaseLate=0;S.airborne=false;S.justLanded=false;S.releaseJump=0;S.releaseRise=0;S.lastJump=0;S.lastLaunch=0;S.landingImpact=0;
  }
  function update(opts){
    opts=opts||{};
    const charging=!!opts.charging,paused=charging&&!!opts.paused,dt=Math.max(0,Math.min(.08,opts.dt||0)),ideal=opts.ideal||74,rate=opts.rate||95;
    /* opts.flow={push}:真实弹道版起跳(只有个别球星启用)。
       腾空段是一条完整的抛物线:离地时刻 = 顶点 − 下落时长,离地瞬间速度最大、一路减速到顶点,再对称地加速落下(上下同一个重力)。
       离地前 push 秒是蹬地:腿从蹲到底加速蹬直,蹬直那一刻正好离地;再往前是下蹲,蹲到底立刻反向,不停顿。
       甜区时刻 p.peak、晚出手判定、自动出手都不变。
       flow.air:上升(=下落)时长,决定滞空;flow.lag:身体顶点比 p.peak 晚多少 —— 真人是刚离地、还在上升时出手,
       不是飘到最高点才出手,所以把身体的顶点往后挪,甜区就落在上升段里。 */
    const flow=opts.flow?opts.flow:null;
    const p=params(ideal,rate);
    const apex=p.peak+(flow?Math.max(0,Number(flow.lag)||0):0);
    const airT=flow&&Number(flow.air)>0?Math.max(.12,Number(flow.air)):Math.max(.12,p.land-p.peak);
    const land=flow?apex+airT:p.land;
    const takeoff=flow?Math.max(.14,apex-airT):p.peak-.22;
    const pushT=flow?Math.min(Math.max(.08,Number(flow.push)||.18),takeoff-.06):0,pushAt=takeoff-pushT;
    const riseOf=t=>{const u=clamp((t-takeoff)/Math.max(.12,apex-takeoff),0,1);return flow?1-(1-u)*(1-u):ease(u);};
    S.justLanded=false;
    if(charging){
      if(!S.lastCharging){S.lateStartPower=null;S.topJump=0;S.t=0;S.releaseLate=0;S.releaseJump=0;S.releaseRise=0;S.lastJump=0;S.lastLaunch=0;S.landingImpact=0;}
      if(!paused)S.t+=dt;
    }else{
      if(S.lastCharging){
        /* 真实弹道版:已经开始蹬地就收不住了 —— 蹬地途中松手也把这一跳跳完,不然人会蹬到一半缩回去 */
        S.airborne=S.t>=(flow?pushAt:takeoff);
        S.releaseLate=S.late;
        // 记录真正出手前一帧的跳跃高度,出手后沿同一条轨迹下落,避免重新从1.0跳高造成闪动。
        // 顶点后松手要记下落前的起跳高度(lastLaunch)：lastJump 已乘过 (1-fall)，再乘一次会塌一截。
        S.releaseJump=S.airborne?(S.t>apex?S.lastLaunch:S.lastJump):0;
        S.releaseRise=S.airborne?riseOf(S.t):0;
      }
      if(S.airborne){
        S.t+=dt;
        if(S.t>=land){
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
    const fallSpan=Math.max(.12,land-apex),afterPeak=S.t>p.peak,afterApex=S.t>apex;
    const fallProgress=clamp((S.t-apex)/fallSpan,0,1);
    // 顶点后按重力感下落: 初速接近零, 越接近地面下降越快。
    const fall=fallProgress*fallProgress;
    const rise=riseOf(S.t);
    const liveLate=clamp((S.t-p.peak-.08)/Math.max(.12,p.auto-p.peak-.08),0,1);
    const late=charging?liveLate:S.releaseLate;
    S.late=afterPeak?late:0;
    if(charging&&S.late>0&&S.lateStartPower===null){
      S.lateStartPower=Number.isFinite(opts.power)?opts.power:S.t*rate;
    }
    /* 连贯版:顶点前出手后身体会继续升到顶点,下落要从**实际到过的高度**开始,不能跳回出手那一刻的高度 */
    const launchJump=Math.max(0,S.releaseJump||base.jmp||0,flow&&!charging?(S.topJump||0):0);
    /* 顶点前松手：蓄力时 base.jmp 按力度走(理想力度就到 1)，常常比按时间走的 rise 先到顶；
       松手后 poseK 快速回落、base.jmp 跟着塌，只剩 rise，身体会先掉 10cm 再弹回。
       空中未过顶点时把 rise 从"出手时的值→1"重映射到"出手高度→1"：从出手高度继续上升、
       顶点正好到 1，再接 launchJump 的下落，全程连续单调。 */
    let ascent=flow?rise:Math.max(base.jmp||0,rise);
    if(S.airborne&&!charging){
      const r0=S.releaseRise,j0=S.releaseJump;
      ascent=r0>=.999?j0:j0+(1-j0)*clamp((rise-r0)/(1-r0),0,1);
      S.topJump=Math.max(S.topJump||0,ascent);
    }
    const jump=resting?0:(afterApex?Math.max(0,launchJump*(1-fall)):ascent);
    S.lastLaunch=launchJump;
    /* 真实弹道版:下蹲和蹬腿按时间走(和离地时刻对齐),不按力度条走。蹬伸用 u^pow(pow≈3.8) —— 越蹬越快,蹬直时速度最大,直接交给腾空 */
    let dipV=base.dip||0,riseV=base.rise||0,liftV=base.lift||0;
    if(flow){
      /* 举球也按时间走:蹲到底前一点开始,蹬地前半段就举到额头,后半段留给伸臂 */
      if(charging||S.airborne)liftV=ease((S.t-(pushAt-.10))/.28);
      const u=clamp((S.t-pushAt)/pushT,0,1);
      riseV=Math.pow(u,Number(flow.pow)||2.4);
      /* 下蹲先慢后快:按下去人先微微一沉,临到蹬地前才快速蹲到底(真人是 0.1~0.3 秒的一下快蹲) */
      dipV=ease(Math.pow(clamp(S.t/Math.max(.08,pushAt),0,1),1.5))*(1-riseV);
    }
    const curve={
      dip:resting?0:dipV,
      lift:resting?0:liftV,
      rise:resting?0:riseV,
      jmp:jump,
      over:resting?0:(afterPeak?Math.max(base.over||0,late*.85):(base.over||0)),
      late:S.late,
      jumpT:S.t
    };
    const apexCue=charging&&!paused&&!S.apexed&&S.t>=p.peak;
    if(apexCue)S.apexed=true;
    S.lastJump=jump;
    return {curve,jump,late,landingImpact:S.landingImpact,apexCue,autoRelease:charging&&!paused&&S.t>=Math.max(p.auto,100/Math.max(1,rate)+.09),airborne:S.airborne,offGround:S.airborne&&S.t>=takeoff,justLanded:S.justLanded,t:S.t,params:p};
  }
  function releasePower(power,ideal){
    if(!S.late||S.lateStartPower===null)return power;
    // 下落后新增的蓄力打折；已蓄的力度保留。越接近满条，折扣越小。
    const start=Math.max(ideal,S.lateStartPower);
    if(power<=start||start>=100)return power;
    const extra=power-start,remaining=(100-power)/(100-start);
    return power-.7*extra*remaining*remaining;
  }
  function isAirborne(){return S.airborne;}
  // 供诊断用：releasePower 内部读的就是这个值，暴露出来才能区分
  // "力度不够"和"晚出手被扣力度"——扣完之后的 err 符号已经不可信了。
  function lastLate(){return S.late||0;}
  global.AIBAShotPhysics=Object.freeze({reset,update,releasePower,isAirborne,lastLate});
})(window);
