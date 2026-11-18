/* ---------------- 物理驱动篮筐/篮板/篮网模态音频引擎 ----------------
   借鉴 Codevember 2026 #14 Tension (audio.ts) 的模态谐振合成与程序化房间脉冲混响：
   - 不依赖静态 WAV 采样，按碰撞位置 (x,y,z)、冲量 impulse、球场声学配置实时合成：
     1) 篮筐 rim / rimMake：前框清脆高频泛音 vs 后框 L 型底座低沉弹簧共振 vs 侧框双频微失谐
     2) 篮板 board / connector：职业钢化玻璃谐振 vs 街头亚克力/木板闷响 vs 月球低频传导
     3) 篮网 net / swish：两段式扫频带通尼龙摩擦噪声，按入网速度与偏心度实时变化
   - 启动时用确定性 PRNG 生成立体声房间脉冲响应 (ConvolverNode) + 柔饱和防削波母带链。 */
(function(global){
  "use strict";
  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const HOOP_Z=-8,BOARD_FACE_Z=-8.56,RIM_R=0.30;

  /* 分场地声学与材质配置（HoopPhysicsProfile 音频侧） */
  const PROFILES={
    indoor:{boardMat:"glass",rimBase:348,rimBright:1.0,rimDecay:0.30,boardBody:108,boardRing:1480,roomSec:1.30,roomWet:0.22,lpHz:6200},
    tokyoRooftop:{boardMat:"acrylic",rimBase:368,rimBright:1.08,rimDecay:0.25,boardBody:145,boardRing:680,roomSec:0.34,roomWet:0.10,lpHz:5400},
    street:{boardMat:"acrylic",rimBase:325,rimBright:0.95,rimDecay:0.27,boardBody:155,boardRing:610,roomSec:0.38,roomWet:0.11,lpHz:5200},
    rainyCourt:{boardMat:"acrylic",rimBase:335,rimBright:0.92,rimDecay:0.24,boardBody:150,boardRing:580,roomSec:0.42,roomWet:0.12,lpHz:4800},
    spanishQuarter:{boardMat:"wood",rimBase:318,rimBright:0.88,rimDecay:0.23,boardBody:178,boardRing:410,roomSec:0.46,roomWet:0.13,lpHz:4500},
    flowerCourt:{boardMat:"wood",rimBase:355,rimBright:0.96,rimDecay:0.26,boardBody:168,boardRing:440,roomSec:0.32,roomWet:0.09,lpHz:5000},
    beachSunset:{boardMat:"acrylic",rimBase:350,rimBright:1.02,rimDecay:0.24,boardBody:152,boardRing:620,roomSec:0.28,roomWet:0.08,lpHz:5200},
    arcticSnow:{boardMat:"glass",rimBase:376,rimBright:1.12,rimDecay:0.28,boardBody:124,boardRing:1620,roomSec:0.55,roomWet:0.14,lpHz:5800},
    medCliff:{boardMat:"acrylic",rimBase:344,rimBright:1.0,rimDecay:0.25,boardBody:148,boardRing:640,roomSec:0.48,roomWet:0.12,lpHz:5300},
    lunarCrater:{boardMat:"metal",rimBase:258,rimBright:0.65,rimDecay:0.36,boardBody:86,boardRing:390,roomSec:0.16,roomWet:0.05,lpHz:1900}
  };

  function currentPreset(){
    try{return document.documentElement.dataset.scenePreset||"indoor";}catch(e){return "indoor";}
  }
  function getProfile(preset){
    return PROFILES[preset||currentPreset()]||PROFILES.indoor;
  }

  /* 每个 AudioContext 实例对应一套母带链（柔饱和 + 干湿房间混响） */
  const ctxState=new WeakMap();
  const lastHitTime={rim:0,board:0,net:0};

  function makeSaturationCurve(){
    const n=256,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=(i/127.5)-1;c[i]=Math.tanh(x*1.65);}
    return c;
  }

  /* 借鉴 14 Tension impulse()：确定性 PRNG 生成立体声房间脉冲，早期反射 + 指数变暗尾音 */
  function buildRoomImpulse(ac,seconds){
    const sr=ac.sampleRate,n=Math.max(512,Math.floor(seconds*sr));
    const buf=ac.createBuffer(2,n,sr);
    let seed=12345;
    const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)*2-1;
    const pre=Math.floor(0.014*sr);
    for(let c=0;c<2;c++){
      const d=buf.getChannelData(c);
      let lp=0,lp2=0;
      // 3 条早期离散反射
      const taps=c===0?[0.016,0.031,0.052]:[0.019,0.037,0.061];
      for(let k=0;k<taps.length;k++){
        const idx=Math.min(n-1,Math.floor(taps[k]*sr));
        d[idx]+=0.35/(k+1);
      }
      for(let i=pre;i<n;i++){
        const t=(i-pre)/sr;
        const fc=380+4400*Math.exp(-t*3.2);
        const a=1-Math.exp((-2*Math.PI*fc)/sr);
        lp+=(rnd()-lp)*a;lp2+=(lp-lp2)*a;
        const swell=Math.min(1,t/0.045);
        const env=Math.exp(-t*(3.8/Math.max(0.18,seconds)));
        d[i]+=lp2*swell*env*0.55;
      }
    }
    return buf;
  }

  function ensureBus(ac,targetBus,profile){
    let st=ctxState.get(ac);
    if(!st){
      const input=ac.createGain();
      const dry=ac.createGain();
      const wet=ac.createGain();
      const convolver=ac.createConvolver();
      const shaper=ac.createWaveShaper();
      shaper.curve=makeSaturationCurve();
      shaper.oversample="2x";
      const lp=ac.createBiquadFilter();
      lp.type="lowpass";lp.frequency.value=profile.lpHz||5600;
      const masterGain=ac.createGain();
      masterGain.gain.value=0.92;

      input.connect(dry);
      input.connect(convolver);
      convolver.connect(wet);
      dry.connect(lp);
      wet.connect(lp);
      lp.connect(shaper);
      shaper.connect(masterGain);
      masterGain.connect(targetBus||ac.destination);

      st={input,dry,wet,convolver,lp,masterGain,roomSec:-1,target:targetBus};
      ctxState.set(ac,st);
    }
    if(targetBus&&st.target!==targetBus){
      try{st.masterGain.disconnect();st.masterGain.connect(targetBus);st.target=targetBus;}catch(e){}
    }
    if(Math.abs(st.roomSec-profile.roomSec)>0.05){
      st.convolver.buffer=buildRoomImpulse(ac,profile.roomSec);
      st.roomSec=profile.roomSec;
    }
    st.dry.gain.value=1-profile.roomWet*0.35;
    st.wet.gain.value=profile.roomWet;
    st.lp.frequency.value=profile.lpHz||5600;
    return st.input;
  }

  function noiseBurst(ac,bus,t,dur,type,freqStart,freqEnd,q,gainPeak){
    const len=Math.max(64,Math.floor(ac.sampleRate*dur));
    const buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.35);
    const src=ac.createBufferSource();src.buffer=buf;
    const flt=ac.createBiquadFilter();flt.type=type;
    flt.frequency.setValueAtTime(freqStart,t);
    if(freqEnd&&freqEnd!==freqStart)flt.frequency.exponentialRampToValueAtTime(Math.max(40,freqEnd),t+dur);
    if(q)flt.Q.value=q;
    const g=ac.createGain();
    g.gain.setValueAtTime(Math.max(0.0001,gainPeak),t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(flt);flt.connect(g);g.connect(bus);
    src.start(t);src.stop(t+dur+0.01);
  }

  /* 篮筐模态合成：按杠杆位置 (前框/后框) 与侧向偏移调制频率比例与底座共振 */
  function playRim(ac,bus,impulse,ev,profile,isMake){
    const t=ac.currentTime;
    const fNorm=clamp(impulse/5.5,0.12,1.35);
    const farScale=1+0.42*Math.pow(clamp(fNorm,0,1),1.4); // 借鉴 farFrom(force)
    const z=ev&&Number.isFinite(ev.z)?ev.z:HOOP_Z;
    const x=ev&&Number.isFinite(ev.x)?ev.x:0;
    const lever=clamp((z-BOARD_FACE_Z)/(HOOP_Z-BOARD_FACE_Z+RIM_R),0,1); // 0=后框近铰链, 1=前框远端
    const side=clamp(Math.abs(x)/RIM_R,0,1);

    // 1. 铰链/底座低频机械共振（越靠后框越重）
    const springWeight=(1-lever)*0.75+0.25;
    const springOsc=ac.createOscillator(),springG=ac.createGain();
    springOsc.type="triangle";
    const fSpring=(isMake?178:156)+lever*26;
    springOsc.frequency.setValueAtTime(fSpring*1.06,t);
    springOsc.frequency.exponentialRampToValueAtTime(fSpring,t+0.045);
    const spGain=(0.14+0.12*fNorm)*springWeight;
    springG.gain.setValueAtTime(spGain,t);
    springG.gain.exponentialRampToValueAtTime(0.0008,t+0.14*farScale);
    springOsc.connect(springG);springG.connect(bus);
    springOsc.start(t);springOsc.stop(t+0.18*farScale);

    // 2. 钢圈非谐泛音簇（前框更亮、进框音略暖一点）
    const base=profile.rimBase*(isMake?0.96:1.0)*(0.94+0.12*lever);
    const ratios=[1.0,1.58,2.63,4.18,5.95];
    const bright=profile.rimBright*(0.55+0.55*fNorm)*(0.72+0.36*lever);
    for(let i=0;i<ratios.length;i++){
      if(i>=3&&fNorm<0.25)continue; // 轻擦框不激发高频泛音
      const freq=base*ratios[i]*(0.992+Math.random()*0.016);
      const amp=(0.15/(i*0.85+1))*clamp(fNorm,0.2,1.15)*(i>=2?bright:1);
      const dec=profile.rimDecay*farScale*(1-i*0.14);
      const osc=ac.createOscillator(),g=ac.createGain();
      osc.type="sine";osc.frequency.value=freq;
      g.gain.setValueAtTime(amp,t);
      g.gain.exponentialRampToValueAtTime(0.0008,t+dec);
      osc.connect(g);g.connect(bus);osc.start(t);osc.stop(t+dec+0.02);
      // 侧框撞击加微失谐双模态拍频
      if(i===1&&side>0.4){
        const osc2=ac.createOscillator(),g2=ac.createGain();
        osc2.type="sine";osc2.frequency.value=freq*(1+0.008*side);
        g2.gain.setValueAtTime(amp*0.55,t);
        g2.gain.exponentialRampToValueAtTime(0.0008,t+dec*0.9);
        osc2.connect(g2);g2.connect(bus);osc2.start(t);osc2.stop(t+dec+0.02);
      }
    }
    // 3. 球皮撞铁瞬态敲击
    noiseBurst(ac,bus,t,0.028,"bandpass",1500+900*lever,900,1.6,0.16*fNorm);
  }

  /* 篮板模态合成：区分玻璃/亚克力/木板/金属 */
  function playBoard(ac,bus,impulse,ev,profile){
    const t=ac.currentTime;
    const fNorm=clamp(impulse/6.0,0.15,1.3);
    const x=ev&&Number.isFinite(ev.x)?ev.x:0;
    const edgeFactor=clamp(Math.abs(x)/0.9,0,1); // 越靠近板边，支架共振略高
    const bodyHz=profile.boardBody*(1+edgeFactor*0.1);

    // 1. 篮板体低频共振
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";
    o.frequency.setValueAtTime(bodyHz*1.25,t);
    o.frequency.exponentialRampToValueAtTime(bodyHz*0.85,t+0.09);
    g.gain.setValueAtTime(0.26*fNorm,t);
    g.gain.exponentialRampToValueAtTime(0.0008,t+0.15);
    o.connect(g);g.connect(bus);o.start(t);o.stop(t+0.17);

    // 2. 材质特征泛音（玻璃清脆 vs 木板发闷）
    const rOsc=ac.createOscillator(),rG=ac.createGain();
    rOsc.type="sine";rOsc.frequency.value=profile.boardRing*(0.97+Math.random()*0.06);
    const ringAmp=profile.boardMat==="glass"?0.065*fNorm:0.04*fNorm;
    const ringDec=profile.boardMat==="glass"?0.16:0.08;
    rG.gain.setValueAtTime(ringAmp,t);
    rG.gain.exponentialRampToValueAtTime(0.0008,t+ringDec);
    rOsc.connect(rG);rG.connect(bus);rOsc.start(t);rOsc.stop(t+ringDec+0.02);

    // 3. 拍击噪声层
    const cut=profile.boardMat==="glass"?920:profile.boardMat==="acrylic"?720:460;
    noiseBurst(ac,bus,t,0.055,"lowpass",cut,cut*0.55,0.8,0.28*fNorm);
  }

  /* 篮网 Swish 物理合成：球速越快越短促清脆，擦网偏心越大摩擦声越长 */
  function playNet(ac,bus,impulse,ev){
    const t=ac.currentTime;
    const speed=clamp(impulse||4.2,1.5,9.0);
    const sNorm=clamp((speed-1.5)/6.5,0.15,1.0);
    const offset=ev&&Number.isFinite(ev.offset)?clamp(ev.offset,0,1):0.15;
    const dur1=0.065+0.04*offset+(1-sNorm)*0.03;
    const dur2=dur1*1.15;
    const fHigh=3400+1400*sNorm-500*offset;
    const gain=0.22+0.16*sNorm;

    noiseBurst(ac,bus,t,dur1,"bandpass",fHigh,fHigh*0.52,1.4,gain);
    noiseBurst(ac,bus,t+0.032+0.015*(1-sNorm),dur2,"bandpass",fHigh*0.76,1200,1.2,gain*0.78);
  }

  function trigger(kind,impulse,ev,ac,targetBus){
    if(!ac||ac.state!=="running")return false;
    const now=ac.currentTime;
    const bucket=kind==="rimMake"?"rim":kind;
    if(bucket==="rim"||bucket==="board"||bucket==="net"){
      if(now-(lastHitTime[bucket]||0)<0.016)return true; // 16ms 内重复微碰撞防爆音
      lastHitTime[bucket]=now;
    }
    const profile=getProfile();
    const bus=ensureBus(ac,targetBus,profile);
    if(kind==="rim")playRim(ac,bus,impulse,ev,profile,false);
    else if(kind==="rimMake")playRim(ac,bus,impulse,ev,profile,true);
    else if(kind==="board"||kind==="connector")playBoard(ac,bus,impulse,ev,profile);
    else if(kind==="net"||kind==="swish")playNet(ac,bus,impulse,ev);
    else return false;
    return true;
  }

  global.AIBAHoopAudio=Object.freeze({
    trigger,getProfile,PROFILES
  });
})(typeof window!=="undefined"?window:globalThis);
