(function(global){
  "use strict";

  const IDEAL_KOBE_METRICS={
    elbowAngle:162,
    releaseHeight:1.38,
    armLift:24,
    bodyTilt:8,
    kneeBend:166,
    follow:0.86
  };

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function point(lm,i){return lm&&lm[i]?lm[i]:null;}
  function conf(p){return p?(p.visibility==null?(p.presence==null?1:p.presence):p.visibility):0;}
  function good(p){return !!p&&conf(p)>=.25;}
  function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
  function angle(a,b,c){
    if(!good(a)||!good(b)||!good(c))return null;
    const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
    const lab=Math.hypot(ab.x,ab.y),lcb=Math.hypot(cb.x,cb.y);
    if(lab<1e-5||lcb<1e-5)return null;
    return Math.acos(clamp((ab.x*cb.x+ab.y*cb.y)/(lab*lcb),-1,1))*180/Math.PI;
  }
  function verticalAngle(a,b){
    if(!good(a)||!good(b))return null;
    const vx=b.x-a.x,vy=b.y-a.y;
    return Math.abs(Math.atan2(vx,-vy)*180/Math.PI);
  }
  function pickShotSide(lm){
    const sides=[
      {name:"left",shoulder:point(lm,11),elbow:point(lm,13),wrist:point(lm,15),hip:point(lm,23),knee:point(lm,25),ankle:point(lm,27)},
      {name:"right",shoulder:point(lm,12),elbow:point(lm,14),wrist:point(lm,16),hip:point(lm,24),knee:point(lm,26),ankle:point(lm,28)}
    ];
    sides.forEach(s=>{
      const height=good(s.wrist)?1-s.wrist.y:0;
      const raised=(good(s.wrist)&&good(s.shoulder)&&s.wrist.y<s.shoulder.y)?1:0;
      const visible=[s.shoulder,s.elbow,s.wrist,s.hip,s.knee,s.ankle].reduce((n,p)=>n+(good(p)?1:0),0);
      s.score=height*2+raised+visible*.15;
    });
    return sides[0].score>=sides[1].score?sides[0]:sides[1];
  }
  function poseMetrics(lm){
    if(!lm||!lm.length)return null;
    const side=pickShotSide(lm);
    const ls=point(lm,11),rs=point(lm,12),lh=point(lm,23),rh=point(lm,24);
    const shoulderMid=(good(ls)&&good(rs))?{x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2}:side.shoulder;
    const hipMid=(good(lh)&&good(rh))?{x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2}:side.hip;
    const torso=good(shoulderMid)&&good(hipMid)?Math.max(.06,dist(shoulderMid,hipMid)):.18;
    const elbowAngle=angle(side.shoulder,side.elbow,side.wrist);
    const armLift=verticalAngle(side.shoulder,side.wrist);
    const bodyTilt=verticalAngle(hipMid,shoulderMid);
    const kneeBend=angle(side.hip,side.knee,side.ankle);
    const releaseHeight=good(side.wrist)&&good(side.shoulder)?(side.shoulder.y-side.wrist.y)/torso:0;
    const follow=good(side.wrist)&&good(side.elbow)?clamp((side.elbow.y-side.wrist.y)/torso,.05,1.4)/1.4:0;
    return {
      side:side.name,
      elbowAngle:elbowAngle==null?IDEAL_KOBE_METRICS.elbowAngle:elbowAngle,
      releaseHeight,
      armLift:armLift==null?IDEAL_KOBE_METRICS.armLift:armLift,
      bodyTilt:bodyTilt==null?IDEAL_KOBE_METRICS.bodyTilt:bodyTilt,
      kneeBend:kneeBend==null?IDEAL_KOBE_METRICS.kneeBend:kneeBend,
      follow,
      confidence:[side.shoulder,side.elbow,side.wrist,shoulderMid,hipMid,side.knee,side.ankle].reduce((n,p)=>n+(good(p)?1:0),0)/7
    };
  }
  function metricScore(v,ref,tol){
    return clamp(100-(Math.abs(v-ref)/tol)*100,18,100);
  }
  function band(score){
    const rows=[
      [95,["Kobe 看了都会点头。","这已经不是像了,这是 Mamba 上线。"]],
      [90,["Mamba 已上线。","动作里有很浓的紫金味。"]],
      [85,["有点那个味了。","这张卡可以发出去炫一下。"]],
      [80,["今天球馆最像 Kobe 的人就是你。","Mamba DNA 已经藏不住了。"]],
      [70,["已经不像普通路人了。","继续练,这个动作有基础。"]],
      [60,["再练练,你会越来越像。","球场自信有了,细节还差点。"]],
      [50,["投篮自信有了,动作还差点。","看得出来你想当杀手,身体还没完全同意。"]],
      [40,["Kobe 看了会让你继续加练。","动作有影子,但还需要球馆多收留你几晚。"]],
      [30,["像在打野球。","有篮球灵魂,但 Mamba 信号有点弱。"]],
      [20,["哥们,这是投篮还是挥棒?","这球要是进了,多半是天意。"]],
      [10,["删除照片,重新来。","球场 DNA 暂时离线。"]],
      [0,["这张照片的篮球灵魂太神秘了。"]]
    ];
    const hit=rows.find(r=>score>=r[0])||rows[rows.length-1];
    return hit[1][Math.floor(Math.random()*hit[1].length)];
  }
  function rewards(score){
    const out=[];
    if(score>=70)out.push("Mamba 投篮动作");
    if(score>=85)out.push("黑曼巴篮球皮肤");
    if(score>=95)out.push("传奇光效");
    return out;
  }
  function suggestions(parts){
    const tips=[];
    if(parts.release<78)tips.push("把出手点再抬高一点,让球从更高的位置离手。");
    else tips.push("你的出手点已经比较接近 Kobe。");
    if(parts.elbow<78)tips.push("手肘还有一点外翻,试着让小臂更稳定地指向篮筐。");
    else tips.push("手肘稳定性不错,这会让投篮更像一个完整动作。");
    if(parts.balance<76)tips.push("身体轴线可以再稳一点,减少出手时的左右晃动。");
    if(parts.follow<74)tips.push("投篮结束后保持跟随动作更久一点。");
    if(tips.length<3)tips.push("继续练同一个出手节奏,让动作成为肌肉记忆。");
    return tips.slice(0,3);
  }
  function score(userLm,refLm){
    const ref=poseMetrics(refLm)||IDEAL_KOBE_METRICS;
    const user=poseMetrics(userLm);
    if(!user)return fallbackScore();
    const parts={
      elbow:metricScore(user.elbowAngle,ref.elbowAngle||IDEAL_KOBE_METRICS.elbowAngle,28),
      release:metricScore(user.releaseHeight,ref.releaseHeight||IDEAL_KOBE_METRICS.releaseHeight,.62),
      balance:metricScore(user.bodyTilt,ref.bodyTilt||IDEAL_KOBE_METRICS.bodyTilt,24),
      knee:metricScore(user.kneeBend,ref.kneeBend||IDEAL_KOBE_METRICS.kneeBend,38),
      arm:metricScore(user.armLift,ref.armLift||IDEAL_KOBE_METRICS.armLift,38),
      follow:metricScore(user.follow,ref.follow||IDEAL_KOBE_METRICS.follow,.5)
    };
    const raw=parts.elbow*.30+parts.release*.25+parts.balance*.20+parts.knee*.15+parts.arm*.10;
    const confidence=clamp(user.confidence,.45,1);
    const total=Math.round(clamp(raw*(.92+confidence*.12),18,99));
    return {
      total,
      star:"KOBE BRYANT",
      parts:{
        shooting:Math.round((parts.release*.55+parts.arm*.45)),
        elbow:Math.round(parts.elbow),
        balance:Math.round(parts.balance),
        follow:Math.round((parts.follow*.65+parts.knee*.35))
      },
      line:band(total),
      coach:suggestions({release:parts.release,elbow:parts.elbow,balance:parts.balance,follow:parts.follow}),
      rewards:rewards(total),
      metrics:user,
      engine:"pose"
    };
  }
  function fallbackScore(seed){
    const n=seed||Date.now();
    const total=72+(Math.abs(Math.sin(n))*18|0);
    return {
      total,star:"KOBE BRYANT",
      parts:{shooting:total+5>99?99:total+5,elbow:clamp(total-4,40,96),balance:clamp(total-9,35,92),follow:clamp(total-13,30,90)},
      line:band(total),
      coach:["这张照片的 Mamba 轮廓已经很明显。","出手点可以再抬高一点,让球离手更干净。","投篮结束后保持跟随动作更久一点。"],
      rewards:rewards(total),
      metrics:null,
      engine:"style"
    };
  }

  global.NBADNAScoreEngine={score,fallbackScore,poseMetrics};
})(window);
