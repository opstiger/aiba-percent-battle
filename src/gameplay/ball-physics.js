/* ---------------- 真实篮球物理内核 ----------------
   诊断见 docs/诊断记录/20260924-物理与建模诊断.md，计划见 docs/PHYSICS_PLAN-20260924.md。

   旧链路是"出手掷骰子 → 按结果播动画"。这里反过来：玩家误差只决定出手速度，
   结果由球与篮筐/篮板/篮网/地面的碰撞算出来。

   三条硬约束：
   1. 纯函数、无 THREE 依赖：浏览器挂 window.AIBABallPhysics，Node 直接 require，
      平衡门槛测试（scripts/ball-physics.test.mjs）跑的就是这一份代码。
   2. 确定性：固定步长，不读任何随机源。同一出手 → 同一整条轨迹。
      出手瞬间就把整条轨迹预演完（约 1ms），英雄时刻/插播这些"要提前知道结果"
      的演出照常工作，回放直接播录好的轨迹。
   3. 难度只放在出手映射层 launch()；simulate() 永远诚实。

   单位：米、秒。质量归一（冲量即速度增量）。球按薄壳：I = 2/3·m·r²。 */
(function(global){
  "use strict";
  const G=9.8,DT=1/480,SAMPLE_EVERY=4;          // 480Hz 积分，120Hz 记录轨迹
  const SAMPLE_DT=DT*SAMPLE_EVERY,STRIDE=7;      // 每个采样 [t,x,y,z,wx,wy,wz]

  /* 几何与 src/data/game-config.js（HOOP/BALL_RADIUS/RIM_RADIUS）
     和 src/rendering/hoop.js（篮板、连接件、篮架）逐项对齐。
     篮板 1.9×1.1×.12 中心 (0,3.5,−8.62)，外加 .045 边框。 */
  const GEOM=Object.freeze({
    ballR:.16,
    rim:Object.freeze({x:0,y:3.05,z:-8,R:.30,tube:.035}),
    net:Object.freeze({depth:.45,bottomR:.20}),
    boxes:Object.freeze([
      Object.freeze({name:"board",min:[-.995,2.905,-8.68],max:[.995,4.095,-8.56]}),
      Object.freeze({name:"connector",min:[-.06,3.015,-8.58],max:[.06,3.085,-8.30]}),
      Object.freeze({name:"support",min:[-.12,3.33,-11.22],max:[.12,3.57,-8.68]}),   // 长臂
      Object.freeze({name:"support",min:[-.19,0,-11.41],max:[.19,3.4,-11.03]}),      // 立柱
      Object.freeze({name:"support",min:[-.38,0,-11.60],max:[.38,1.86,-10.84]})      // 护垫
    ])
  });

  /* 手感参数。rim 的 e/mu 就是"软筐/硬筐"那一档：
     真实比赛篮筐弹性约 .55；街机游戏普遍做"friendly rim"（更软、更容易滚进）。 */
  /* 室内球馆底线后的媒体区挡板（src/rendering/arena.js：nearBaseline−3.55，高 1.1m，宽 ±7.5m）。 */
  const INDOOR_COLLIDERS=Object.freeze([
    Object.freeze({name:"scenery",min:[-7.5,0,-13.21],max:[7.5,1.1,-13.05],e:.35})
  ]);
  const TUNING_PRESETS=Object.freeze({
    firm:Object.freeze({eRim:.55,muRim:.30,eBoard:.62,muBoard:.25,eSupport:.45,eFloor:.78,muFloor:.45,rollDrag:1.2,backspin:12}),
    soft:Object.freeze({eRim:.32,muRim:.40,eBoard:.58,muBoard:.25,eSupport:.45,eFloor:.78,muFloor:.45,rollDrag:1.2,backspin:12})
  });
  const DEFAULT_TUNING=TUNING_PRESETS.soft;

  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const len3=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);

  /* 一次接触：沿法线 n（指向球心）推出穿透，按冲量更新线速度与角速度。
     接触点相对球心 rc=−r·n；接触点速度 vc=v+ω×rc。
     切向冲量受库仑摩擦 μ·Jn 限制，最多把打滑消到 0（薄壳球系数 1+r²/k² = 2.5）。
     返回法向冲量（m/s），没有压向表面则返回 0。 */
  function resolveContact(s,nx,ny,nz,pen,e,mu){
    const r=GEOM.ballR;
    s.x+=nx*pen;s.y+=ny*pen;s.z+=nz*pen;
    // ω × (−r n)
    const cx=-(s.wy*nz-s.wz*ny)*r,cy=-(s.wz*nx-s.wx*nz)*r,cz=-(s.wx*ny-s.wy*nx)*r;
    const vcx=s.vx+cx,vcy=s.vy+cy,vcz=s.vz+cz;
    const vn=vcx*nx+vcy*ny+vcz*nz;
    if(vn>=0)return 0;
    const eEff=vn>-.25?0:e;                      // 低速视为静接触，不弹，避免抖动
    const jn=-(1+eEff)*vn;
    const tx=vcx-vn*nx,ty=vcy-vn*ny,tz=vcz-vn*nz,slip=len3(tx,ty,tz);
    if(slip>1e-7&&mu>0){
      const jt=Math.min(mu*jn,slip/2.5),ux=tx/slip,uy=ty/slip,uz=tz/slip;
      s.vx-=jt*ux;s.vy-=jt*uy;s.vz-=jt*uz;
      const k=1.5*jt/r;                          // Δω = 1.5·Jt·(n×t̂)/r
      s.wx+=k*(ny*uz-nz*uy);s.wy+=k*(nz*ux-nx*uz);s.wz+=k*(nx*uy-ny*ux);
    }
    s.vx+=jn*nx;s.vy+=jn*ny;s.vz+=jn*nz;
    return jn;
  }

  function contactRim(s,tu){
    const rim=GEOM.rim,r=GEOM.ballR;
    const rx=s.x-rim.x,rz=s.z-rim.z,rh=Math.sqrt(rx*rx+rz*rz);
    if(rh<rim.R-r-rim.tube-.01)return 0;         // 离圈管太远，省掉后面的计算
    const ox=rh>1e-6?rx/rh:1,oz=rh>1e-6?rz/rh:0;
    const qx=rim.x+ox*rim.R,qz=rim.z+oz*rim.R;
    const dx=s.x-qx,dy=s.y-rim.y,dz=s.z-qz,d=len3(dx,dy,dz),reach=r+rim.tube;
    if(d>=reach||d<1e-7)return 0;
    return resolveContact(s,dx/d,dy/d,dz/d,reach-d,tu.eRim,tu.muRim);
  }

  function contactBox(s,box,e,mu){
    const r=GEOM.ballR,mn=box.min,mx=box.max;
    const qx=clamp(s.x,mn[0],mx[0]),qy=clamp(s.y,mn[1],mx[1]),qz=clamp(s.z,mn[2],mx[2]);
    let dx=s.x-qx,dy=s.y-qy,dz=s.z-qz,d=len3(dx,dy,dz);
    if(d>=r)return 0;
    if(d<1e-7){                                   // 球心已进盒子：沿最浅的面推出
      const faces=[[s.x-mn[0],-1,0,0],[mx[0]-s.x,1,0,0],[s.y-mn[1],0,-1,0],[mx[1]-s.y,0,1,0],[s.z-mn[2],0,0,-1],[mx[2]-s.z,0,0,1]];
      faces.sort((a,b)=>a[0]-b[0]);
      const f=faces[0];return resolveContact(s,f[1],f[2],f[3],f[0]+r,e,mu);
    }
    return resolveContact(s,dx/d,dy/d,dz/d,r-d,e,mu);
  }

  /* 篮网：只约束"从上方穿过圈口"的球。锥形——圈口 R，往下 depth 收到 bottomR。
     进网的球被兜住、减速、回中，像真网那样把横向速度吃掉。 */
  function applyNet(s,state){
    const rim=GEOM.rim,net=GEOM.net,r=GEOM.ballR;
    if(!state.entered||state.netDone||s.y>=rim.y)return 0;
    if(s.y<rim.y-net.depth-.08){if(state.made)state.netDone=true;return 0;}   // 出了网底就不再受网约束
    const depth=clamp((rim.y-s.y)/net.depth,0,1),netR=rim.R-(rim.R-net.bottomR)*depth;
    const allow=Math.max(.02,netR-r*.55);
    const rx=s.x-rim.x,rz=s.z-rim.z,h=Math.sqrt(rx*rx+rz*rz);
    let push=0;
    if(h>allow){
      const ox=rx/h,oz=rz/h;
      s.x=rim.x+ox*allow;s.z=rim.z+oz*allow;
      const vr=s.vx*ox+s.vz*oz;
      if(vr>0){s.vx-=1.25*vr*ox;s.vz-=1.25*vr*oz;push=vr;}
    }
    const k=Math.exp(-3*DT);s.vx*=k;s.vz*=k;s.vy*=Math.exp(-1.6*DT);
    s.wx*=Math.exp(-4*DT);s.wy*=Math.exp(-4*DT);s.wz*=Math.exp(-4*DT);
    return push;
  }

  /* 主模拟。init: {p:[x,y,z], v:[x,y,z], w:[x,y,z]}
     opts.untilDecided=true 时判定出结果就停（校准用，省时间）。
     opts.colliders 场景附加的静态盒子 [{name,min,max,e}]，比如室内底线后的媒体区挡板、
       户外围网——篮架以外的东西随场景变化，由调用方按当前场景传入。
     返回：
       kind      swish | rattleIn | bank | rimOut | air
       made      是否进
       decidedT  结果确定的时刻（进：穿过网口下沿；不进：球心落到圈下 .45m）
       events    [{type,t,x,y,z,impulse}]  type: rim/board/connector/support/floor/net/made/decided
       path      Float32Array，每 SAMPLE_DT 一帧 [t,x,y,z,wx,wy,wz]
       endT      轨迹总时长 */
  function simulate(init,opts){
    opts=opts||{};
    const tu=Object.assign({},DEFAULT_TUNING,opts.tuning||{});
    const rim=GEOM.rim,r=GEOM.ballR;
    const s={x:init.p[0],y:init.p[1],z:init.p[2],vx:init.v[0],vy:init.v[1],vz:init.v[2],
      wx:init.w?init.w[0]:0,wy:init.w?init.w[1]:0,wz:init.w?init.w[2]:0};
    const state={entered:false,netDone:false,made:false,decided:false,decidedT:0,madeT:0,rimHits:0,boardHits:0,supportHits:0};
    const events=[],last={},maxT=opts.maxT||6,tail=opts.tail==null?2.4:opts.tail,extra=opts.colliders||null;
    const samples=[];
    const rec=t=>samples.push(t,s.x,s.y,s.z,s.wx,s.wy,s.wz);
    const note=(type,t,imp)=>{
      /* 同一物体 .05s 内的连续接触算一次（滚筐时每步都在接触），冲量取最大 */
      const prev=last[type];
      if(prev&&t-prev.t<.05){prev.t=t;prev.ev.impulse=Math.max(prev.ev.impulse,imp);return false;}
      const ev={type,t,x:s.x,y:s.y,z:s.z,impulse:imp};events.push(ev);last[type]={t,ev};return true;
    };
    let t=0,step=0,prevY=s.y,restT=0,rimRestT=0,wedgeT=0;
    rec(0);
    while(t<maxT){
      step++;t=step*DT;
      // 对恒定重力精确的积分（与解析抛物线逐点一致，校准才对得上）
      s.x+=s.vx*DT;s.y+=s.vy*DT-.5*G*DT*DT;s.z+=s.vz*DT;
      s.vy-=G*DT;

      let imp=contactRim(s,tu);
      if(imp>0){if(note("rim",t,imp))state.rimHits++;}
      for(const box of GEOM.boxes){
        const isBoard=box.name==="board";
        imp=contactBox(s,box,isBoard?tu.eBoard:tu.eSupport,isBoard?tu.muBoard:.3);
        if(imp>0&&note(box.name,t,imp)){if(isBoard)state.boardHits++;else if(box.name==="support")state.supportHits++;}
      }
      if(extra)for(const box of extra){
        imp=contactBox(s,box,box.e==null?.4:box.e,.3);
        if(imp>0)note(box.name||"scenery",t,imp);
      }
      if(s.y<r){
        imp=resolveContact(s,0,1,0,r-s.y,tu.eFloor,tu.muFloor);
        if(imp>.4)note("floor",t,imp);
      }
      if(s.y<=r+.002&&Math.abs(s.vy)<.3){        // 地面滚动阻力
        const k=Math.exp(-tu.rollDrag*DT);s.vx*=k;s.vz*=k;s.wx*=k;s.wy*=k;s.wz*=k;
      }

      /* 进球判定：球心从上往下穿过圈口平面且在圈内 → entered；
         若又从圈内弹回平面之上，撤销 entered（内沿弹出）。 */
      const h=Math.sqrt((s.x-rim.x)*(s.x-rim.x)+(s.z-rim.z)*(s.z-rim.z));
      if(!state.made){
        if(prevY>=rim.y&&s.y<rim.y&&h<rim.R-rim.tube)state.entered=true;
        else if(state.entered&&s.y>=rim.y)state.entered=false;
      }
      const netPush=applyNet(s,state);
      if(netPush>.05)note("net",t,netPush);
      if(!state.made&&state.entered&&s.y<rim.y-.42){
        state.made=true;state.madeT=t;note("made",t,0);
        if(!state.decided){state.decided=true;state.decidedT=t;note("decided",t,0);}
      }
      if(!state.decided&&!state.entered&&s.y<rim.y-.45&&prevY>=rim.y-.45){
        state.decided=true;state.decidedT=t;note("decided",t,0);
      }

      /* 卡在筐上（速度几乎为零地停在圈管上）：真实比赛是争球，这里按球心在圈内/外
         给一个极小的径向推力让它自己滚下去——确定性的，不引入随机。 */
      const onRim=last.rim&&t-last.rim.t<.02,speed=len3(s.vx,s.vy,s.vz);
      rimRestT=onRim&&speed<.25?rimRestT+DT:0;
      if(rimRestT>.25){
        const ox=(s.x-rim.x)/(h||1),oz=(s.z-rim.z)/(h||1),dir=h<rim.R?-1:1;
        s.vx+=ox*dir*.35;s.vz+=oz*dir*.35;rimRestT=0;
      }
      /* 卡在后沿与篮板/连接件之间（真实比赛叫卡球、要跳球）：在篮筐高度附近几乎静止
         超过 .4s，就沿侧向把它推出卡缝，让它从圈外掉下去——不算进，也不会一直挂着。
         实测 24240 次出手里出现 1 次（中场投长，停在 y=3.24, z=−8.33）。 */
      wedgeT=!state.made&&s.y>rim.y-.2&&speed<.15?wedgeT+DT:0;
      if(wedgeT>.4){
        const side=s.x>=rim.x?1:-1;
        s.vx+=side*.9;s.vz+=.25;wedgeT=0;
      }

      if(step%SAMPLE_EVERY===0)rec(t);
      prevY=s.y;
      if(opts.untilDecided&&state.decided)break;
      if(state.decided&&t>state.decidedT+tail)break;
      restT=s.y<=r+.002&&speed<.05?restT+DT:0;
      if(restT>.2)break;
    }
    if(step%SAMPLE_EVERY!==0)rec(t);
    /* 兜底：游戏靠 decided 事件判负（missBall），任何情况下都必须发出 */
    if(!state.decided){state.decided=true;state.decidedT=t;note("decided",t,0);}
    let kind;
    if(state.made)kind=state.boardHits&&events.findIndex(e=>e.type==="board")<events.findIndex(e=>e.type==="made")?"bank":(state.rimHits?"rattleIn":"swish");
    else kind=(state.rimHits||state.boardHits)?"rimOut":"air";
    return {kind,made:state.made,madeT:state.madeT,decidedT:state.decidedT,rimHits:state.rimHits,boardHits:state.boardHits,
      supportHits:state.supportHits,events,path:new Float32Array(samples),endT:t};
  }

  /* 在轨迹上按时间取样（线性插值）。out 可复用避免分配。 */
  function sampleAt(path,t,out){
    out=out||{x:0,y:0,z:0,wx:0,wy:0,wz:0};
    const n=path.length/STRIDE;
    if(!n)return out;
    const f=clamp(t/SAMPLE_DT,0,n-1),i=Math.min(n-2,Math.floor(f)),k=n>1?f-i:0,a=i*STRIDE,b=a+STRIDE;
    if(n===1){out.x=path[1];out.y=path[2];out.z=path[3];out.wx=path[4];out.wy=path[5];out.wz=path[6];return out;}
    out.x=path[a+1]+(path[b+1]-path[a+1])*k;out.y=path[a+2]+(path[b+2]-path[a+2])*k;out.z=path[a+3]+(path[b+3]-path[a+3])*k;
    out.wx=path[a+4]+(path[b+4]-path[a+4])*k;out.wy=path[a+5]+(path[b+5]-path[a+5])*k;out.wz=path[a+6]+(path[b+6]-path[a+6])*k;
    return out;
  }

  /* 瞄准篮筐中心、给定飞行时间的抛物线初速（与旧 releaseShot 同一公式）。 */
  function aimVelocity(p0,tf){
    const rim=GEOM.rim;
    return [(rim.x-p0[0])/tf,(rim.y-p0[1])/tf+.5*G*tf,(rim.z-p0[2])/tf];
  }
  function backspinFor(v,rate){
    const fx=v[0],fz=v[2],fl=Math.sqrt(fx*fx+fz*fz)||1;
    // ω = (forward × up)·rate：球顶朝投手方向转
    return [(-fz/fl)*rate,0,(fx/fl)*rate];
  }

  /* 速度倍率 sc 下，球心下落穿过篮筐平面时，沿投篮方向相对圈心的偏移（米，正=偏长）。
     纯解析：y(t)=y0+vy·t−g·t²/2 的下降根。 */
  function crossOffset(p0,v0,sc){
    const rim=GEOM.rim,vy=v0[1]*sc,dy=p0[1]-rim.y,disc=vy*vy+2*G*dy;
    if(disc<0)return -Infinity;                    // 够不到篮筐高度
    const t=(vy+Math.sqrt(disc))/G;
    const dx=rim.x-p0[0],dz=rim.z-p0[2],dist=Math.sqrt(dx*dx+dz*dz)||1;
    const hx=v0[0]*sc*t,hz=v0[2]*sc*t;
    return (hx*dx+hz*dz)/dist-dist;
  }
  /* 反解：要让球落在圈心前后 depth 米，出手速度要乘多少。偏移随 sc 单调，二分即可。 */
  function scaleForDepth(p0,v0,depth){
    let lo=.7,hi=1.35;
    for(let k=0;k<48;k++){
      const m=(lo+hi)/2;
      if(crossOffset(p0,v0,m)<depth)lo=m;else hi=m;
    }
    return (lo+hi)/2;
  }

  /* 按出手点校准"完美出手"：球心轨迹离圈管最远的那一档速度（解析，不跑碰撞）。
     远投的空心容差只有 ±2cm 量级，扫描步长稍大就会跨过去，所以用最大间隙而不是扫描。
     返回完美出手在篮筐平面的落点偏移 depth0（一般略偏后于圈心，真实篮球也是如此）。 */
  const calCache=new Map();
  function calibrate(p0,tf){
    const key=[p0[0].toFixed(3),p0[1].toFixed(3),p0[2].toFixed(3),tf.toFixed(4)].join("|");
    if(calCache.has(key))return calCache.get(key);
    const v0=aimVelocity(p0,tf),rim=GEOM.rim,reach=GEOM.ballR+rim.tube;
    const clearanceAt=sc=>{
      const v=[v0[0]*sc,v0[1]*sc,v0[2]*sc];
      let best=Infinity,crossH=null,prevY=p0[1];
      for(let t=0;t<3;t+=DT){
        const x=p0[0]+v[0]*t,y=p0[1]+v[1]*t-.5*G*t*t,z=p0[2]+v[2]*t;
        if(crossH===null&&prevY>=rim.y&&y<rim.y)crossH=Math.sqrt((x-rim.x)*(x-rim.x)+(z-rim.z)*(z-rim.z));
        prevY=y;
        if(y<rim.y-.5&&v[1]-G*t<0)break;
        const rx=x-rim.x,rz=z-rim.z,rh=Math.sqrt(rx*rx+rz*rz);
        if(rh>rim.R+.5)continue;
        const ox=rh>1e-6?rx/rh:1,oz=rh>1e-6?rz/rh:0;
        const d=len3(x-(rim.x+ox*rim.R),y-rim.y,z-(rim.z+oz*rim.R))-reach;
        if(d<best)best=d;
      }
      /* 球心必须从圈口内穿过；越过篮筐的轨迹离圈管再远也不算"准" */
      if(crossH===null)return -10;
      const inside=rim.R-rim.tube-crossH;
      return inside<0?inside-1:best;
    };
    let lo=scaleForDepth(p0,v0,-.2),hi=scaleForDepth(p0,v0,.2);
    for(let k=0;k<40;k++){                        // 黄金分割求最大间隙
      const m1=hi-(hi-lo)*.618,m2=lo+(hi-lo)*.618;
      if(clearanceAt(m1)<clearanceAt(m2))lo=m1;else hi=m2;
    }
    const mid=(lo+hi)/2;
    const out=Object.freeze({mid,clearance:clearanceAt(mid),depth0:crossOffset(p0,v0,mid)});
    if(calCache.size>256)calCache.clear();
    calCache.set(key,out);
    return out;
  }

  /* 出手映射层：玩家误差 → 出手速度。难度和辅助全在这里。
     u     力度误差 / 甜区半宽（与旧判定 a/zone 同一把尺子）
     lat   横向误差（旧 latErr 同单位），篮筐处横偏 ≈ lat·latMeters
     noise 可复现随机源给的标准正态数（出手差异），调用方从 aibaRoll 取，模拟器自己不读随机
     luck  可复现随机源给的 [0,1) 均匀数（外圈好运，见 luckP）
     map   {assist, overM, underM, jitterM, latMeters, maxLongM, maxLongStraightM, equalize, underSave}
           assist：甜区内圈（|u|≤.5）误差压缩比——UI 承诺"停在绿色甜区 = 空心"
           overM/underM：甜区外每 1 个 u，球落点在篮筐平面偏长/偏短多少米。
             尺子是"落点离圈心多远"而不是"速度差多少"，所以同样的 u 在每个投篮点
             失误几何一样；速度按距离自动反解，远投的弧线也会随力度真实变化。
             欠力侧更小 = 保护新手（旧 underSave 的物理版）。
           jitterM：出手落点差异（米，1σ）。真人每次出手都不完全一样；它让命中边界附近
             有自然过渡，而且看得见——球确实落在了不同位置，不是暗箱骰子。
             甜区内圈按 assist 同比压缩，不破坏"甜区=空心"。
           maxLongM/maxLongStraightM：投长落点封顶（侧面/正对篮板），见 depthFor()。
           luckP：外圈（1<|u|≤1.8）的"好运"概率。旧判定在这一档有 15~30% 靠运气涮进，
             是它保护新手的方式；纯确定性物理给不出这条尾巴（实测新手分布下命中低 6~9pp）。
             好运时落点被拉到篮筐边缘附近，再由物理真实地涮进或磕出——球确实投得更近了，
             看得见，不是暗改结果。
           equalize：每个投篮点自动均衡（见 equalize()）。
           underSave：旧判定的欠力救球率，均衡的目标曲线用它。 */
  const DEFAULT_MAP=Object.freeze({assist:.12,overM:.38,underM:.18,jitterM:.05,latMeters:.9,maxLongM:1.9,maxLongStraightM:.72,luckP:.25,equalize:true,underSave:.10});
  /* 三档难度（甜区大小已经在 u 里；这里只有欠力保护强弱不同，与旧 config.js DIFFS.underSave 一致）。 */
  const DIFF_MAPS=Object.freeze({
    easy:Object.freeze(Object.assign({},DEFAULT_MAP,{underSave:.16})),
    normal:Object.freeze(Object.assign({},DEFAULT_MAP,{underSave:.10})),
    hard:Object.freeze(Object.assign({},DEFAULT_MAP,{underSave:0,underM:.22}))
  });

  /* 旧"掷骰子"判定的期望命中率（src/gameplay/shots.js releaseShot，不含倾斜）。
     这是平衡的设计目标：物理版每个投篮点在同一误差分布下的期望命中率要等于它。 */
  function designMake(u,underSave){
    const a=Math.abs(u);
    if(a<=.5)return 1;
    if(a>1.8)return 0;
    return (a<=1?.5:.15)+(u>0?.15:underSave);
  }
  function invNorm(p){                            // Acklam 近似，误差 < 1e-8，够用
    const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
    const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
    const c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
    const d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
    const pl=.02425;let q,r;
    if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    q=p-.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  /* 固定的准随机参考样本：一半 u~N(0,.7)（高手）一半 u~N(0,1.5)（新手），出手差异 noise~N(0,1)。
     只用一个 σ 均衡时，物理曲线与旧曲线形状不同，会出现高手偏高、新手偏低。确定性，不读随机源。 */
  const EQ_HALF=24,EQ_N=EQ_HALF*2,EQ_SAMPLES=[];
  for(const sigma of [.7,1.5])for(let i=0;i<EQ_HALF;i++){
    const g=((i+.5)*.6180339887+(sigma>1?.5:0))%1;
    EQ_SAMPLES.push([invNorm((i+.5)/EQ_HALF)*sigma,invNorm(Math.min(.999,Math.max(.001,g))),((i+.5)*.7548776662+(sigma>1?.25:0))%1]);
  }

  function depthFor(p0,cal,map,u,noise,k,luck){
    let a=Math.abs(u);const sign=u<0?-1:1;
    if(a>1&&luck!=null){
      const taper=a<=1.8?1:Math.max(0,1-(a-1.8)/.4);             // 1.8 以外 .4 内收掉
      if(luck<map.luckP*taper)a=.8+.25*(luck/(map.luckP*taper));  // 拉回近圈（.8~1.05）
    }
    const shaped=a<=.5?a*map.assist:.5*map.assist+(a-.5);
    /* 甜区内整段只保留 assist 比例的抖动（中场空心余量不到 1cm，5cm 抖动会把甜区里的球抖出去），
       出了甜区在 .5→1 之间渐变回全量 */
    const jitterK=a<=.5?map.assist:map.assist+(1-map.assist)*Math.min(1,(a-.5)*2);
    const dx0=GEOM.rim.x-p0[0],dz0=GEOM.rim.z-p0[2],facing=Math.abs(dz0)/(Math.sqrt(dx0*dx0+dz0*dz0)||1);
    const straight=Math.pow(clamp((facing-.9)/.1,0,1),2);        // cos25°≈.9 → 0，正对 → 1
    const miss=a>.5?k:1;                                          // 均衡系数只作用在甜区外
    const depth=cal.depth0+sign*shaped*(u<0?map.underM:map.overM)*miss+(Number(noise)||0)*map.jitterM*jitterK;
    /* 投长封顶。正面（straight→1）封在 maxLongStraightM：再远 0.8~1.4m 是"打中小方框直落进筐"
       的口袋，正面投长几乎必进（实测扫描见诊断记录）；侧面封在 maxLongM，再远整颗球
       飞过篮板砸进看台——现实里有，但那是离谱力度，不值得为它把球扔出场馆。 */
    const cap=map.maxLongM+(map.maxLongStraightM-map.maxLongM)*straight;
    return Math.min(depth,cal.depth0+cap);
  }
  function velocityFor(p0,tf,cal,depth,lat,map){
    const aim=aimVelocity(p0,tf);
    const scale=depth===cal.depth0?cal.mid:scaleForDepth(p0,aim,depth);
    const dx=GEOM.rim.x-p0[0],dz=GEOM.rim.z-p0[2],dist=Math.sqrt(dx*dx+dz*dz)||1;
    const ang=(Number(lat)||0)*map.latMeters/dist,c=Math.cos(ang),sn=Math.sin(ang);
    return {v:[(aim[0]*c-aim[2]*sn)*scale,aim[1]*scale,(aim[0]*sn+aim[2]*c)*scale],scale};
  }

  /* 每个投篮点自动均衡：解一个缩放系数 k（乘在甜区外的失误落点上），让这个点在参考误差
     分布下的期望命中率等于旧设计。正面、45°、底角、深远、中场的篮板几何各不相同，
     手调系数顾此失彼（实测弧顶比底角高 15pp、中场投长有撞板口袋），这里一次性解决，
     新球场、新点位也自动公平。物理层照样诚实——k 只改"失误落点离圈心多远"。
     成本约 240 次模拟（桌面 ~60ms），按点位缓存；游戏里在走位途中 prewarm。 */
  const eqCache=new Map();
  function equalize(p0,tf,map,tuning){
    const tu=Object.assign({},DEFAULT_TUNING,tuning||{});
    const key=[p0[0].toFixed(1),p0[1].toFixed(1),p0[2].toFixed(1),tf.toFixed(2),map.overM,map.underM,map.underSave,map.maxLongM,map.maxLongStraightM,map.luckP,map.jitterM,tu.eRim,tu.muRim,tu.eBoard].join("|");
    if(eqCache.has(key))return eqCache.get(key);
    const cal=calibrate(p0,tf);
    let target=0;for(const [u] of EQ_SAMPLES)target+=designMake(u,map.underSave);target/=EQ_N;
    const rate=k=>{
      let made=0;
      for(const [u,noise,luck] of EQ_SAMPLES){
        const {v}=velocityFor(p0,tf,cal,depthFor(p0,cal,map,u,noise,k,luck),0,map);
        if(simulate({p:p0,v,w:backspinFor(v,tu.backspin)},{tuning:tu,untilDecided:true,maxT:4}).made)made++;
      }
      return made/EQ_N;
    };
    let lo=.15,hi=3;                               // k 越大失误越远、命中越低
    for(let i=0;i<6;i++){const m=(lo+hi)/2;if(rate(m)>target)lo=m;else hi=m;}
    const k=(lo+hi)/2;
    if(eqCache.size>128)eqCache.clear();
    eqCache.set(key,k);
    return k;
  }

  function launch(p0,opts){
    opts=opts||{};
    const tu=Object.assign({},DEFAULT_TUNING,opts.tuning||{}),map=Object.assign({},DEFAULT_MAP,opts.map||{});
    const tf=opts.tf,cal=calibrate(p0,tf),u=Number(opts.u)||0;
    const k=map.equalize?equalize(p0,tf,map,tu):1;
    const depth=depthFor(p0,cal,map,u,opts.noise,k,opts.luck==null?null:Number(opts.luck));
    const {v,scale}=velocityFor(p0,tf,cal,depth,opts.lat,map);
    const w=backspinFor(v,opts.backspin==null?tu.backspin:opts.backspin);
    return {p:[p0[0],p0[1],p0[2]],v,w,scale,cal,u,depth,k};
  }
  /* 走位途中先把这个点的校准与均衡算好，出手那一帧就只剩 1 次模拟。 */
  function prewarm(p0,tf,map,tuning){
    const m=Object.assign({},DEFAULT_MAP,map||{});
    calibrate(p0,tf);
    return m.equalize?equalize(p0,tf,m,tuning):1;
  }

  /* 按结果找轨迹（PH-4）。对手命中率、AI 表演脚本、绝杀防守判罚这些地方，"进不进"
     是既有的设计判定（关系到 AI 难度与平衡），不该被物理改掉；但球怎么飞、怎么磕筐应该
     是真的。这里给定 want（要进 / 不进），从 uCenter 附近往外找一条模拟结果恰好符合的
     出手，找到就返回整条轨迹。
       rng       [0,1) 随机源（要复现就传 aibaRoll，纯演出传 Math.random）
       uCenter   从哪个误差附近开始找（默认：要进从 0 附近、不进从 ±1.2 附近）
     不进的球会自然地投短、投长、磕出；进的球有空心、涮进、打板。找不到（极少）就退回
     一个必然的结果：要进用 u=0（零误差必空心，门槛测试保证），不进用 u=−3.5（三不沾）。 */
  function launchForOutcome(p0,opts){
    opts=opts||{};
    const want=!!opts.want,rng=opts.rng||Math.random,tries=opts.maxTries||14;
    const base={tf:opts.tf,map:opts.map,tuning:opts.tuning};
    const simOpts={tuning:opts.tuning,colliders:opts.colliders};
    for(let i=0;i<tries;i++){
      const spread=.35+i*.12,sign=rng()<.5?-1:1;
      let u;
      // 要进时一上来就在 ±0.95 里找：只在甜区中心找的话 94% 是空心，真实比赛很多进球是磕着进的
      if(want)u=(opts.uCenter!=null?opts.uCenter:0)+(rng()*2-1)*Math.min(1.1,.95+i*.05);
      else{
        const c=opts.uCenter!=null?Math.abs(opts.uCenter):1.2;
        u=(opts.uCenter!=null&&opts.uCenter!==0?Math.sign(opts.uCenter):sign)*Math.max(.75,c+(rng()*2-1)*spread);
      }
      const noise=(rng()*2-1)*1.2,lat=(rng()*2-1)*(want?.05:.16);
      const L=launch(p0,Object.assign({},base,{u,lat,noise}));
      const res=simulate(L,simOpts);
      if(res.made===want)return {launch:L,res,u,tries:i+1};
    }
    const L=launch(p0,Object.assign({},base,{u:want?0:-3.5,lat:0,noise:0}));
    return {launch:L,res:simulate(L,simOpts),u:want?0:-3.5,tries:tries,fallback:true};
  }

  /* 物理结果 → 旧 outcome 名（统计、英雄时刻、绝杀判罚、音效分支仍读这个名字）。 */
  function legacyOutcome(res){
    switch(res.kind){
      case "swish":return "swish";
      case "rattleIn":return "rattle";
      case "bank":return "bank";
      case "rimOut":return res.rimHits>=2?"rattleout":"rimout";
      default:return "miss";
    }
  }

  const api=Object.freeze({GEOM,INDOOR_COLLIDERS,TUNING_PRESETS,DEFAULT_TUNING,DEFAULT_MAP,DIFF_MAPS,DT,SAMPLE_DT,STRIDE,
    simulate,sampleAt,aimVelocity,backspinFor,crossOffset,scaleForDepth,calibrate,designMake,equalize,prewarm,launch,launchForOutcome,legacyOutcome});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(global)global.AIBABallPhysics=api;
})(typeof window!=="undefined"?window:globalThis);
