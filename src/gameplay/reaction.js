/* ---------------- 球员放松 / 反应动作层 ----------------
   站定时人不该是一尊雕像:偶尔转头看看,进球点头握拳,失手摇头捂脸。
   这一层只叠加在"完全没有投篮动作"的站姿上 —— 蓄力/举球/起跳/跟随/接球/走路任何一项介入就退出,
   所以 check.js 锁到毫米级的出手帧不受影响。
   只写 headRoot 和两臂/两肘的角度,方块人和所有写实皮套(tripo-avatar 读这些骨头)自动一起得到。
   ?react=0 关闭。 */
(function(global){
  "use strict";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  /* 先快速起来、停一会、再收回:a=起来结束的位置,b=开始收回的位置 */
  const bump=(u,a,b)=>sm(u/a)*(1-sm((u-b)/(1-b)));
  const CH=["hx","hy","hz","sx","sz","se","gx","gz","ge"];   // 头(俯仰/偏转/侧倾) + 投篮手(肩x/肩z/肘) + 辅助手
  const ZERO=()=>{const o={};for(const k of CH)o[k]=0;return o;};
  /* 目标值(=动画想去的位置),实际值按指数逼近,所以出入场都是平滑的 */
  const CLIPS={
    nod:{dur:.85,f(u){const e=bump(u,.22,.55);return {hx:.3*e,hy:.06*e};}},
    fist:{dur:.9,f(u){const e=bump(u,.2,.5),p=1+.1*Math.sin(u*18)*e;return {hx:.14*e,sx:-1.75*e*p,se:-1.3*e*p,sz:-.3*e};}},
    shrug:{dur:1.0,f(u){const e=bump(u,.25,.55);return {hx:-.05*e,hz:.14*e,sz:-.65*e,gz:.65*e,se:-.7*e,ge:-.7*e};}},
    shake:{dur:.95,f(u){const e=bump(u,.15,.6);return {hx:.24*e,hy:.42*Math.sin(u*Math.PI*4)*e};}},
    handhead:{dur:1.0,f(u){const e=bump(u,.25,.55);return {hx:.14*e,gx:-1.95*e,ge:-2.6*e,gz:-.35*e};}},
    slump:{dur:1.0,f(u){const e=bump(u,.3,.55);return {hx:.5*e,hy:-.2*e};}}
  };
  const R={
    enabled:!/[?&]react=0\b/.test(String(global.location&&global.location.search)),
    clip:null,name:null,t:0,pending:null,
    cur:ZERO(),
    idle:{next:2.5,t:0,dur:0,yaw:0,pitch:0},
    wrote:false,count:0,last:null
  };
  const pick=list=>{let s=0;for(const [,w] of list)s+=w;let r=Math.random()*s;for(const [n,w] of list){r-=w;if(r<=0)return n;}return list[0][0];};
  function trigger(kind,info){
    if(!R.enabled)return false;
    const G=global.G||{},streak=G.streak||0,off=Math.abs(G.lastErr||0)>.25;
    let name;
    if(kind==="make")name=pick(streak>=3?[["shrug",3],["fist",3],["nod",1]]:[["nod",4],["fist",2],["shrug",streak>=2?1:0]]);
    else if(kind==="miss")name=pick(off?[["handhead",3],["slump",3],["shake",1]]:[["shake",4],["handhead",2],["slump",1]]);
    else return false;
    if(info&&CLIPS[info.name])name=info.name;   // 调试/测试可指定动画
    R.pending={name,age:0};R.last=kind;
    return true;
  }
  function cancel(){R.clip=null;R.name=null;R.pending=null;}
  /* mode: "on" 站定可写 | "decay" 出手中,快速回正 | "off" 走路等别人管头,只清状态不写 */
  function apply(o,dt,mode,ballInHand){
    if(!R.enabled||!o||!o.headRoot||!o.arms||!o.elbows)return;
    dt=clamp(+dt||0,0,.1);R.mode=mode;
    const tgt=ZERO();
    if(mode==="off"){
      cancel();for(const k of CH)R.cur[k]=0;R.wrote=false;return;
    }
    if(mode==="on"){
      if(R.pending){
        R.pending.age+=dt;
        if(!R.clip){R.clip=CLIPS[R.pending.name];R.name=R.pending.name;R.t=0;R.pending=null;R.count++;}
        else if(R.pending.age>1.2)R.pending=null;
      }
      if(R.clip){
        R.t+=dt;const u=R.t/R.clip.dur;
        if(u>=1){R.clip=null;R.name=null;R.idle.next=2+Math.random()*2;R.idle.dur=0;}
        else Object.assign(tgt,R.clip.f(u));
      }else{
        /* 待机:隔几秒随机看一眼别处/低头看看手,不重复同一个方向 */
        const I=R.idle;
        if(I.dur>0){I.t+=dt;if(I.t>=I.dur){I.dur=0;I.next=2.5+Math.random()*3.5;}else{tgt.hy=I.yaw;tgt.hx=I.pitch;}}
        else{I.next-=dt;if(I.next<=0){
          const dir=Math.random()<.5?-1:1;
          I.t=0;I.dur=.8+Math.random()*.9;
          if(Math.random()<.3){I.yaw=0;I.pitch=.28;}                                   // 低头看手/看球
          else{I.yaw=dir*(.3+Math.random()*.3)*(Math.sign(I.yaw)===dir?.5:1);I.pitch=(Math.random()-.5)*.14;}
        }}
      }
    }else{
      /* decay:玩家按下出手 —— 动画立即作废,身体从当前值快速回正 */
      R.clip=null;R.name=null;R.pending=null;R.idle.dur=0;
    }
    /* 手里有球时手臂不动(球是挂在手上的),只留头 */
    if(ballInHand)for(const k of ["sx","sz","se","gx","gz","ge"])tgt[k]=0;
    const rate=mode==="decay"?16:(R.clip?11:5);
    const a=1-Math.exp(-rate*dt);
    let mag=0;
    for(const k of CH){R.cur[k]+=(tgt[k]-R.cur[k])*a;mag+=Math.abs(R.cur[k]);}
    if(mag<.002&&!R.wrote)return;
    const c=R.cur;
    o.headRoot.rotation.set(c.hx,c.hy,c.hz);
    R.wrote=mag>=.002;
    if(!R.wrote){o.headRoot.rotation.set(0,0,0);return;}
    const sh=o.arms[0],gd=o.arms[1],se=o.elbows[1],ge=o.elbows[0];
    sh.rotation.x+=c.sx;sh.rotation.z+=c.sz;se.rotation.x+=c.se;
    gd.rotation.x+=c.gx;gd.rotation.z+=c.gz;ge.rotation.x+=c.ge;
  }
  /* 结果事件:包装全局的进球/失手结算,不改它们的内部 */
  function wrap(){
    const mb=global.madeBall,xb=global.missBall;
    if(typeof mb==="function"&&!mb.__react)
      global.madeBall=Object.assign(function(b){const r=mb.apply(this,arguments);try{if(b&&!b.opp&&!b.silent)trigger("make");}catch(e){}return r;},{__react:1});
    if(typeof xb==="function"&&!xb.__react)
      global.missBall=Object.assign(function(){const r=xb.apply(this,arguments);try{trigger("miss");}catch(e){}return r;},{__react:1});
  }
  wrap();
  global.AIBAReaction=Object.freeze({apply,trigger,cancel,
    get enabled(){return R.enabled;},set enabled(v){R.enabled=!!v;if(!v)cancel();},
    state:()=>({mode:R.mode,enabled:R.enabled,name:R.name,t:+R.t.toFixed(2),pending:R.pending&&R.pending.name,count:R.count,last:R.last,wrote:R.wrote,cur:Object.assign({},R.cur)}),
    clips:Object.keys(CLIPS)});
})(window);
