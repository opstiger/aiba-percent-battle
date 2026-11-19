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
    indoor:{boardMat:"glass",rimBase:348,rimBright:1.0,rimDecay:0.28,boardBody:108,boardRing:1480,roomSec:1.25,roomWet:0.20,lpHz:6400,poleHz:96,valleyEcho:0},
    tokyoRooftop:{boardMat:"acrylic",rimBase:368,rimBright:1.08,rimDecay:0.23,boardBody:145,boardRing:680,roomSec:0.34,roomWet:0.10,lpHz:5600,poleHz:116,valleyEcho:0},
    street:{boardMat:"acrylic",rimBase:325,rimBright:0.95,rimDecay:0.25,boardBody:155,boardRing:610,roomSec:0.38,roomWet:0.11,lpHz:5400,poleHz:112,valleyEcho:0},
    outdoorSunny:{boardMat:"acrylic",rimBase:330,rimBright:0.96,rimDecay:0.24,boardBody:152,boardRing:600,roomSec:0.35,roomWet:0.09,lpHz:5400,poleHz:112,valleyEcho:0},
    rainyCourt:{boardMat:"acrylic",rimBase:335,rimBright:0.90,rimDecay:0.22,boardBody:150,boardRing:560,roomSec:0.42,roomWet:0.11,lpHz:4800,poleHz:110,valleyEcho:0},
    spanishQuarter:{boardMat:"wood",rimBase:318,rimBright:0.88,rimDecay:0.22,boardBody:172,boardRing:390,roomSec:0.46,roomWet:0.13,lpHz:4600,poleHz:108,valleyEcho:0},
    flowerCourt:{boardMat:"wood",rimBase:352,rimBright:0.94,rimDecay:0.24,boardBody:158,boardRing:410,roomSec:0.36,roomWet:0.08,lpHz:5200,poleHz:122,valleyEcho:0.14},
    rainforest:{boardMat:"wood",rimBase:336,rimBright:0.86,rimDecay:0.22,boardBody:146,boardRing:360,roomSec:0.44,roomWet:0.12,lpHz:4400,poleHz:118,valleyEcho:0.08},
    beachSunset:{boardMat:"acrylic",rimBase:350,rimBright:1.0,rimDecay:0.22,boardBody:152,boardRing:620,roomSec:0.26,roomWet:0.07,lpHz:5300,poleHz:116,valleyEcho:0},
    arcticSnow:{boardMat:"glass",rimBase:376,rimBright:1.10,rimDecay:0.26,boardBody:124,boardRing:1620,roomSec:0.55,roomWet:0.14,lpHz:5800,poleHz:104,valleyEcho:0.10},
    medCliff:{boardMat:"acrylic",rimBase:344,rimBright:0.98,rimDecay:0.23,boardBody:148,boardRing:640,roomSec:0.46,roomWet:0.11,lpHz:5300,poleHz:114,valleyEcho:0.12},
    lunarCrater:{boardMat:"metal",rimBase:258,rimBright:0.65,rimDecay:0.34,boardBody:86,boardRing:390,roomSec:0.16,roomWet:0.05,lpHz:1900,poleHz:78,valleyEcho:0}
  };

  function currentPreset(){
    try{return document.documentElement.dataset.scenePreset||"indoor";}catch(e){return "indoor";}
  }
  function getProfile(preset){
    return PROFILES[preset||currentPreset()]||PROFILES.indoor;
  }
  function currentWetness(){
    try{
      const m=global.environmentRoot?.userData?.placeState?.meadow;
      if(m)return clamp(m.wetness||0,0,1);
      if(currentPreset()==="rainyCourt")return 0.72;
    }catch(e){}
    return 0;
  }

  /* 每个 AudioContext 实例对应一套母带链（柔饱和 + 干湿房间混响） */
  const ctxState=new WeakMap();
  const lastHitTime={rim:0,board:0,net:0};
  const variantCursor={rim:0,swish:0};

  function makeSaturationCurve(){
    const n=256,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=(i/127.5)-1;c[i]=Math.tanh(x*1.65);}
    return c;
  }

  /* 借鉴 14 Tension impulse()：确定性 PRNG 生成立体声房间脉冲，含开阔山谷远反射 */
  function buildRoomImpulse(ac,seconds,valleyEcho){
    const sr=ac.sampleRate,dur=Math.max(seconds,valleyEcho>0?0.42:seconds);
    const n=Math.max(512,Math.floor(dur*sr));
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
        d[idx]+=0.32/(k+1);
      }
      for(let i=pre;i<n;i++){
        const t=(i-pre)/sr;
        const fc=380+4400*Math.exp(-t*3.2);
        const a=1-Math.exp((-2*Math.PI*fc)/sr);
        lp+=(rnd()-lp)*a;lp2+=(lp-lp2)*a;
        const swell=Math.min(1,t/0.045);
        const env=Math.exp(-t*(3.8/Math.max(0.18,seconds)));
        d[i]+=lp2*swell*env*0.52;
      }
      // 远山山谷微弱低通回声（195~245ms），仅户外高原/悬崖场地启用
      if(valleyEcho>0){
        const echoStart=Math.floor((c===0?0.195:0.228)*sr);
        const echoLen=Math.min(n-echoStart,Math.floor(0.16*sr));
        let vlp=0;
        for(let i=0;i<echoLen;i++){
          const u=i/Math.max(1,echoLen);
          vlp+=(rnd()-vlp)*0.08;
          d[echoStart+i]+=vlp*Math.sin(Math.PI*u)*valleyEcho*0.65;
        }
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

      st={input,dry,wet,convolver,lp,masterGain,roomKey:"",target:targetBus};
      ctxState.set(ac,st);
    }
    if(targetBus&&st.target!==targetBus){
      try{st.masterGain.disconnect();st.masterGain.connect(targetBus);st.target=targetBus;}catch(e){}
    }
    const rKey=profile.roomSec.toFixed(2)+":"+(profile.valleyEcho||0).toFixed(2);
    if(st.roomKey!==rKey){
      st.convolver.buffer=buildRoomImpulse(ac,profile.roomSec,profile.valleyEcho||0);
      st.roomKey=rKey;
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

  function playSampleLayer(ac,bus,buffer,t,gainPeak,rate,lpHz,hpHz,maxDur){
    if(!buffer)return false;
    try{
      const src=ac.createBufferSource();
      src.buffer=buffer;
      src.playbackRate.setValueAtTime(clamp(rate||1,0.68,1.42),t);
      let node=src;
      if(hpHz>20){
        const hp=ac.createBiquadFilter();hp.type="highpass";hp.frequency.setValueAtTime(hpHz,t);
        node.connect(hp);node=hp;
      }
      if(lpHz>200){
        const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.setValueAtTime(lpHz,t);
        node.connect(lp);node=lp;
      }
      const g=ac.createGain();
      g.gain.setValueAtTime(Math.max(0.0001,gainPeak),t);
      if(maxDur&&maxDur<buffer.duration){
        g.gain.setValueAtTime(Math.max(0.0001,gainPeak),t+Math.max(0.02,maxDur-0.06));
        g.gain.exponentialRampToValueAtTime(0.0008,t+maxDur);
      }
      node.connect(g);g.connect(bus);
      src.start(t);
      if(maxDur&&maxDur<buffer.duration)src.stop(t+maxDur+0.02);
      return true;
    }catch(e){return false;}
  }

  /* 篮筐混合引擎：真实录制打铁采样主干 + 按撞击次数(hitIndex)/杠杆位置/冲量动态变调 + 物理钢管共振 */
  function playRim(ac,bus,impulse,ev,profile,isMake,samples){
    const t=ac.currentTime;
    const hitIdx=ev&&Number.isFinite(ev.hitIndex)?Math.max(0,ev.hitIndex):0;
    const fNorm=clamp(impulse/5.5,0.10,1.40);
    const repeatDecay=Math.pow(0.78,Math.min(hitIdx,4)); // 连续砸框每次自然变轻、变脆、变短
    const z=ev&&Number.isFinite(ev.z)?ev.z:HOOP_Z;
    const x=ev&&Number.isFinite(ev.x)?ev.x:0;
    const lever=clamp((z-BOARD_FACE_Z)/(HOOP_Z-BOARD_FACE_Z+RIM_R),0,1); // 0=后框近铰链, 1=前框远端
    const side=clamp(Math.abs(x)/RIM_R,0,1);
    const wet=currentWetness();

    // 1. 真实录音主干（轮换不同采样 + 按撞击次数/前中后位置/力度实时变调与滤波）
    let usedSample=false;
    if(samples){
      const pool=isMake&&hitIdx===0?["rimMake","clank","clank2"]:["clank","clank2"];
      const pickKey=pool[(variantCursor.rim++)%pool.length];
      const buf=samples[pickKey]||samples.clank||samples.clank2||samples.rimMake;
      if(buf){
        // 第1撞偏沉实，后续轻弹偏高偏轻；前框偏脆，后框偏沉
        const baseRate=(isMake&&hitIdx===0?0.97:0.93)+lever*0.09+Math.min(hitIdx,3)*0.075+(fNorm-0.6)*0.05+(Math.random()-0.5)*0.05;
        const cutHz=clamp((2200+2800*fNorm+800*lever)*(1-wet*0.18)*(hitIdx>0?0.85:1),1400,6200);
        const sGain=clamp((0.36+0.62*fNorm)*repeatDecay,0.10,1.08);
        const maxDur=hitIdx>=2?0.22:(hitIdx===1?0.34:0);
        usedSample=playSampleLayer(ac,bus,buf,t,sGain,baseRate,cutHz,90,maxDur);
      }
    }

    // 2. 户外空心钢管立柱低频嗡鸣 + 铰链底座共振（仅第1~2撞明显，消除单薄电子感）
    const poleWeight=(1-lever)*0.65+0.35;
    const poleOsc=ac.createOscillator(),poleG=ac.createGain();
    poleOsc.type="triangle";
    const fPole=(profile.poleHz||112)*(0.96+lever*0.08+hitIdx*0.04);
    poleOsc.frequency.setValueAtTime(fPole*1.12,t);
    poleOsc.frequency.exponentialRampToValueAtTime(fPole,t+0.022); // 真实受击形变瞬态滑落
    const pGain=(usedSample?0.10:0.20)*clamp(fNorm,0.18,1.25)*poleWeight*repeatDecay;
    poleG.gain.setValueAtTime(pGain,t);
    poleG.gain.exponentialRampToValueAtTime(0.0008,t+0.13*(1+0.25*fNorm));
    poleOsc.connect(poleG);poleG.connect(bus);
    poleOsc.start(t);poleOsc.stop(t+0.18);

    // 3. 轻量金属模态着色（有采样时仅作20%位置着色；无采样时自动兜底；带12ms音高滑落去"编钟感"）
    const modalMix=usedSample?0.22:0.95;
    const base=profile.rimBase*(isMake?0.96:1.0)*(0.94+0.11*lever)*(1+Math.min(hitIdx,3)*0.045);
    const ratios=[1.0,1.58,2.63,4.18];
    const bright=profile.rimBright*(0.50+0.50*fNorm)*(0.75+0.32*lever)*(1-wet*0.14);
    for(let i=0;i<ratios.length;i++){
      if(i>=2&&fNorm<0.32)continue;
      const freq=base*ratios[i]*(0.99+Math.random()*0.02);
      const amp=(0.13/(i*0.95+1))*clamp(fNorm,0.15,1.15)*(i>=2?bright:1)*modalMix*repeatDecay;
      const dec=profile.rimDecay*(0.75+0.35*fNorm)*(1-i*0.16)*(hitIdx>0?0.72:1);
      const osc=ac.createOscillator(),g=ac.createGain();
      osc.type="sine";
      osc.frequency.setValueAtTime(freq*1.035,t);
      osc.frequency.exponentialRampToValueAtTime(freq,t+0.014);
      g.gain.setValueAtTime(Math.max(0.0001,amp),t);
      g.gain.exponentialRampToValueAtTime(0.0008,t+Math.max(0.04,dec));
      osc.connect(g);g.connect(bus);osc.start(t);osc.stop(t+Math.max(0.06,dec+0.02));
      if(i===1&&side>0.45){
        const osc2=ac.createOscillator(),g2=ac.createGain();
        osc2.type="sine";osc2.frequency.value=freq*(1+0.009*side);
        g2.gain.setValueAtTime(Math.max(0.0001,amp*0.45),t);
        g2.gain.exponentialRampToValueAtTime(0.0008,t+Math.max(0.04,dec*0.85));
        osc2.connect(g2);g2.connect(bus);osc2.start(t);osc2.stop(t+Math.max(0.06,dec+0.02));
      }
    }

    // 4. 球皮撞铁瞬态 + 重砸时延迟篮网铁钩微叮当
    noiseBurst(ac,bus,t,0.022,"bandpass",1600+900*lever+hitIdx*260,850,1.7,(usedSample?0.07:0.16)*fNorm*repeatDecay);
    if(fNorm>0.58&&hitIdx===0){
      noiseBurst(ac,bus,t+0.036,0.018,"bandpass",4200,3100,4.5,0.026*fNorm);
      noiseBurst(ac,bus,t+0.064,0.014,"bandpass",4900,3600,5.0,0.018*fNorm);
    }
  }

  /* 篮板模态合成：区分真实玻璃/亚克力/户外旧木板（联动雨淋湿润度变沉） */
  function playBoard(ac,bus,impulse,ev,profile){
    const t=ac.currentTime;
    const fNorm=clamp(impulse/6.0,0.14,1.35);
    const x=ev&&Number.isFinite(ev.x)?ev.x:0;
    const edgeFactor=clamp(Math.abs(x)/0.9,0,1);
    const wet=currentWetness();
    const wetDamp=profile.boardMat==="wood"?(1-wet*0.18):1;
    const bodyHz=profile.boardBody*(1+edgeFactor*0.10)*wetDamp;

    // 1. 主腔体低频共振
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";
    o.frequency.setValueAtTime(bodyHz*1.28,t);
    o.frequency.exponentialRampToValueAtTime(bodyHz*0.82,t+0.085);
    g.gain.setValueAtTime(0.27*fNorm,t);
    g.gain.exponentialRampToValueAtTime(0.0008,t+(profile.boardMat==="wood"?0.12*wetDamp:0.16));
    o.connect(g);g.connect(bus);o.start(t);o.stop(t+0.18);

    // 2. 木板双模态木箱闷响（户外旧木板特征）
    if(profile.boardMat==="wood"){
      const o2=ac.createOscillator(),g2=ac.createGain();
      o2.type="triangle";
      o2.frequency.setValueAtTime(bodyHz*1.58,t);
      o2.frequency.exponentialRampToValueAtTime(bodyHz*1.32,t+0.055);
      g2.gain.setValueAtTime(0.11*fNorm,t);
      g2.gain.exponentialRampToValueAtTime(0.0008,t+0.08*wetDamp);
      o2.connect(g2);g2.connect(bus);o2.start(t);o2.stop(t+0.10);
      // 球皮拍木面中频"啪嗒"瞬态
      noiseBurst(ac,bus,t,0.022,"bandpass",760*wetDamp,420,1.3,0.22*fNorm);
    }

    // 3. 材质特征泛音（玻璃清脆 vs 木板发闷）
    const rOsc=ac.createOscillator(),rG=ac.createGain();
    rOsc.type="sine";rOsc.frequency.value=profile.boardRing*wetDamp*(0.97+Math.random()*0.06);
    const ringAmp=profile.boardMat==="glass"?0.065*fNorm:0.035*fNorm;
    const ringDec=profile.boardMat==="glass"?0.16:0.07*wetDamp;
    rG.gain.setValueAtTime(ringAmp,t);
    rG.gain.exponentialRampToValueAtTime(0.0008,t+ringDec);
    rOsc.connect(rG);rG.connect(bus);rOsc.start(t);rOsc.stop(t+ringDec+0.02);

    // 4. 拍击噪声层
    const cut=(profile.boardMat==="glass"?960:profile.boardMat==="acrylic"?740:440)*wetDamp;
    noiseBurst(ac,bus,t,0.050,"lowpass",cut,cut*0.52,0.8,0.26*fNorm);
  }

  /* 篮网 Swish 混合物理引擎：区分空心爽脆刷网 vs 砸框慢掉极轻尼龙擦网，并联动雨天湿网变沉 */
  function playNet(ac,bus,impulse,ev,profile,samples){
    const t=ac.currentTime;
    const style=(ev&&ev.netStyle)||"swish";
    const speed=clamp(impulse||4.6,1.2,9.5);
    const sNorm=clamp((speed-1.5)/6.0,0.12,1.0);
    const offset=ev&&Number.isFinite(ev.offset)?clamp(ev.offset,0,1):0.15;
    const wet=currentWetness();

    // 砸框弹跳后慢悠悠掉进篮网：绝对不播高速刷网声，只播极轻柔的低速尼龙网摩擦声
    if(style==="brush"){
      const bCut=(1350-wet*380)*(0.85+0.3*sNorm);
      noiseBurst(ac,bus,t,0.085,"bandpass",bCut,bCut*0.55,1.1,0.085+0.045*sNorm);
      noiseBurst(ac,bus,t+0.042,0.075,"bandpass",bCut*0.72,580,1.0,0.055);
      return;
    }

    // 空心 / 干净擦板 / 高速擦框入网：真实录音 swish 采样主干 + 速度/湿润度滤波调制
    const isSoft=style==="softSwish";
    let usedSample=false;
    if(samples){
      const pool=["swish","swish2","swish3"];
      const key=pool[(variantCursor.swish++)%pool.length];
      const buf=samples[key]||samples.swish||samples.swish2||samples.swish3;
      if(buf){
        const rate=(isSoft?0.88:0.93)+sNorm*0.20+(Math.random()-0.5)*0.05;
        const cutHz=clamp((isSoft?3200:5800)*(1-wet*0.36),1900,6800);
        const sGain=(isSoft?0.44:0.84)*(0.78+0.32*sNorm);
        usedSample=playSampleLayer(ac,bus,buf,t,sGain,rate,cutHz,240,0);
      }
    }

    // 轻量尼龙摩擦风声补充（有采样时仅作速度空气感点缀；雨天湿网加重中低频甩水感）
    const synthMix=usedSample?(isSoft?0.18:0.26):1.0;
    const dur1=0.060+0.035*offset+(1-sNorm)*0.025;
    const dur2=dur1*1.12;
    const fHigh=(3300+1400*sNorm-450*offset)*(1-wet*0.34);
    const gain=(0.20+0.15*sNorm)*synthMix;
    noiseBurst(ac,bus,t,dur1,"bandpass",fHigh,fHigh*0.52,1.3,gain);
    noiseBurst(ac,bus,t+0.030+0.014*(1-sNorm),dur2,"bandpass",fHigh*0.74,1150,1.2,gain*0.75);
    if(wet>0.22&&!isSoft){
      // 雨天湿润尼龙网甩水低频"噗唰"感
      noiseBurst(ac,bus,t+0.012,0.065,"bandpass",980,520,1.1,0.09*wet*sNorm);
    }
  }

  function trigger(kind,impulse,ev,ac,targetBus,samples){
    if(!ac||ac.state!=="running")return false;
    const now=ac.currentTime;
    const bucket=kind==="rimMake"?"rim":kind;
    if(bucket==="rim"||bucket==="board"||bucket==="net"){
      if(now-(lastHitTime[bucket]||0)<0.016)return true; // 16ms 内重复微碰撞防爆音
      lastHitTime[bucket]=now;
    }
    const profile=getProfile();
    const bus=ensureBus(ac,targetBus,profile);
    if(kind==="rim")playRim(ac,bus,impulse,ev,profile,false,samples);
    else if(kind==="rimMake")playRim(ac,bus,impulse,ev,profile,true,samples);
    else if(kind==="board"||kind==="connector")playBoard(ac,bus,impulse,ev,profile);
    else if(kind==="net"||kind==="swish")playNet(ac,bus,impulse,ev,profile,samples);
    else return false;
    return true;
  }

  global.AIBAHoopAudio=Object.freeze({
    trigger,getProfile,PROFILES
  });
})(typeof window!=="undefined"?window:globalThis);
