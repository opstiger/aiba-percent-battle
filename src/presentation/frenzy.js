/* ---------------- Frenzy:全场狂热层 + 赛后互动 ----------------
   一、连中越多球馆越疯(在原有欢呼之上再加三级,原来连中 10 球和连中 3 球是同一种兴奋):
       1 级「沸腾」 连中 5 球:看台全员起立(对手球迷也跟着跳),看台举起跟这名球员有关的海报
       2 级「疯狂」 连中 7 球:场边球迷离座沿边线蹦跑、有人挥衣服,看台往下撒彩纸,场角喷干冰
       3 级「人山人海」连中 10 球:看台一浪接一浪的人浪,更多人冲到场边、有人瘫坐在地上抱头,干冰连喷,顶棚光束扫场
       失手一球全部退回去。
   二、比赛结束不再傻站着:球员按结果随机做一段情绪(开心:握拳跳、张臂、跳舞、对着镜头秀肌肉/指镜头;
       一般:鼓掌致意、挥手;失落:撑膝盖、抱头、蹲下、低头),摄影师跑到面前拍他;
       球迷按比分冲进来 —— 赢了围成一圈蹦,平了过来击掌,输了两个人走过来拍拍肩。
   只叠加自己的物体(球迷、海报、彩纸、干冰),不改球馆原有物体;没有室内球馆时什么都不做。
   ?frenzy=0 关闭。 */
(function(global){
  "use strict";
  if(typeof THREE==="undefined"||typeof indoorRoot==="undefined"||typeof COURT==="undefined")return;
  const ON=!/[?&]frenzy=0\b/.test(String(global.location&&global.location.search));
  if(!ON){global.AIBAFrenzy=Object.freeze({state:()=>({on:false})});return;}
  const T=THREE,TAU=Math.PI*2;
  const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sm=t=>{t=cl(t,0,1);return t*t*(3-2*t);};
  const rn=(a,b)=>a+Math.random()*(b-a);
  const pickOf=a=>a[(Math.random()*a.length)|0];
  const angLerp=(a,b,k)=>{let d=b-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return a+d*k;};
  const LEVEL_AT=[5,7,10],NAMES=["","全场沸腾","球馆疯了","人山人海"];
  const SUSTAIN=[0,.3,.5,.75],POWER=[1,1.35,1.7,2.1];
  const S={t:0,level:0,force:0,ex:0,pulse:0,built:false,lvK:0,nextWave:0,nextNear:0,jetT:-9,post:null,err:null,lastState:""};
  const active=()=>indoorRoot.visible!==false&&(!indoorRoot.parent||indoorRoot.parent.visible!==false);
  const level=()=>Math.max(S.level,S.force);

  /* ---------- 配色 ---------- */
  const C={key:"",a:new T.Color(0xfdb927),b:new T.Color(0x552583),num:"8",name:"AIBA"};
  function syncStar(){
    const s=(typeof G!=="undefined"&&G.myStar)||null,key=s?(s.id||s.n)+":"+(s.col||[]).join(","):"-";
    if(key===C.key)return false;C.key=key;
    C.a.setHex(s&&s.col?s.col[0]:0xfdb927);C.b.setHex(s&&s.col?s.col[1]:0x552583);
    C.num=String(s&&s.num!=null?s.num:"");
    C.name=String(s&&s.n?s.n:"AIBA").replace(/^\s*\d+\s*号\s*[·•]\s*/,"").replace(/[((].*$/,"").trim().slice(0,8);
    return true;
  }

  /* ---------- 看台海报:三种图案,各一个实例网格 ---------- */
  const posters=[];let posterSeats=[];
  const FONT='"Avenir Next Condensed","HelveticaNeue-CondensedBlack","Arial Narrow","PingFang SC",Impact,sans-serif';
  function drawPoster(g,kind){
    const a="#"+C.a.getHexString(),b="#"+C.b.getHexString();
    g.fillStyle=kind===1?"#f7f4ea":(kind===2?b:a);g.fillRect(0,0,128,160);
    g.strokeStyle=kind===1?a:"#fff";g.lineWidth=8;g.strokeRect(4,4,120,152);
    g.textAlign="center";g.textBaseline="middle";
    if(kind===0){g.fillStyle="#fff";g.font="italic 900 92px "+FONT;g.fillText(C.num||"1",64,74);g.font="800 22px "+FONT;g.fillText(C.name,64,136);}
    else if(kind===1){g.fillStyle=a;g.font="italic 900 46px "+FONT;g.fillText("MVP",64,50);g.fillStyle="#15171d";g.font="800 26px "+FONT;g.fillText(C.name,64,98);g.fillStyle=b;g.font="900 26px "+FONT;g.fillText("#"+(C.num||"1"),64,134);}
    else{g.fillStyle="#fff";g.font="900 30px "+FONT;g.fillText("神准!",64,44);g.fillStyle=a;g.font="italic 900 60px "+FONT;g.fillText("🔥",64,96);g.fillStyle="#fff";g.font="800 20px "+FONT;g.fillText(C.name,64,140);}
  }
  function paintPosters(){for(let k=0;k<posters.length;k++){drawPoster(posters[k].g,k);posters[k].tex.needsUpdate=true;}}
  function makePosters(){
    try{
      if(typeof crowd==="undefined"||!crowd.groups||!crowd.groups.length)return;
      const all=[];let n=0;
      for(const gr of crowd.groups){if((gr.tier||0)>1)continue;for(const s of gr.seats){if((n++)%9===4&&Number.isFinite(s.x)&&Number.isFinite(s.z))all.push(s);}}
      const M=Math.min(all.length,186);if(!M)return;
      posterSeats=[];for(let i=0;i<M;i++){const s=all[Math.floor(i*all.length/M)];posterSeats.push({x:s.x,y:(s.y||0)+1.72,z:s.z,ph:(i*7.31)%TAU,rot:Math.atan2(-s.x,COURT.midZ-s.z),rank:(i*37)%M});}
      const geo=new T.PlaneGeometry(.95,1.18),per=Math.ceil(M/3);
      for(let k=0;k<3;k++){
        const cv=document.createElement("canvas");cv.width=128;cv.height=160;const g=cv.getContext("2d");
        const tex=new T.CanvasTexture(cv);tex.encoding=T.sRGBEncoding;
        const m=new T.InstancedMesh(geo,new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,fog:false}),per);
        m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.visible=false;m.name="frenzyPosters";indoorRoot.add(m);
        posters.push({m,g,tex,per});
      }
      paintPosters();
    }catch(e){posters.length=0;}
  }
  const _d=new T.Object3D();
  function updPosters(){
    if(!posters.length)return;
    const lv=level(),show=lv>=1?(lv===1?.3:(lv===2?.6:1)):0,M=posterSeats.length;
    S.posterK=(S.posterK||0)+(show-(S.posterK||0))*.08;
    if(S.posterK<.01){for(const p of posters)p.m.visible=false;return;}
    const wave=S.ex;
    for(let k=0;k<3;k++){
      const P=posters[k];
      for(let j=0;j<P.per;j++){
        const s=posterSeats[k*P.per+j];
        if(!s){_d.scale.setScalar(0);_d.updateMatrix();P.m.setMatrixAt(j,_d.matrix);continue;}
        const up=cl((S.posterK*M-s.rank)/12,0,1);                                 // 级别越高举起来的越多,一张张冒出来
        _d.position.set(s.x,s.y-.9*(1-up)+Math.abs(Math.sin(S.t*5+s.ph))*.16*wave,s.z);
        _d.rotation.set(-.18,s.rot,Math.sin(S.t*4.2+s.ph)*.22*(.4+wave));
        _d.scale.setScalar(up);_d.updateMatrix();P.m.setMatrixAt(j,_d.matrix);
      }
      P.m.instanceMatrix.needsUpdate=true;P.m.visible=true;
    }
  }

  /* ---------- 看台撒下来的彩纸 ---------- */
  let bits=null,bitV=null,bitLife=null;const BITS=460;
  function makeBits(){
    const pos=new Float32Array(BITS*3),col=new Float32Array(BITS*3);bitV=new Float32Array(BITS*3);bitLife=new Float32Array(BITS);
    for(let i=0;i<BITS;i++)pos[i*3+1]=-50;
    const geo=new T.BufferGeometry();geo.setAttribute("position",new T.BufferAttribute(pos,3));geo.setAttribute("color",new T.BufferAttribute(col,3));
    bits=new T.Points(geo,new T.PointsMaterial({size:.17,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.95,depthWrite:false,fog:false}));
    bits.frustumCulled=false;bits.visible=false;bits.name="frenzyBits";indoorRoot.add(bits);
  }
  function updBits(dt){
    if(!bits)return;
    const lv=level(),rate=lv>=3?1:(lv===2?.5:0),pos=bits.geometry.attributes.position.array,col=bits.geometry.attributes.color.array;
    let alive=0,spawn=Math.round(rate*S.ex*BITS*dt*.9);
    for(let i=0;i<BITS;i++){
      if(bitLife[i]>0){
        bitLife[i]-=dt;alive++;
        bitV[i*3+1]-=5.2*dt;bitV[i*3]*=1-.6*dt;bitV[i*3+2]*=1-.6*dt;
        if(bitV[i*3+1]<-1.6)bitV[i*3+1]=-1.6;                                      // 纸片飘落,不是自由落体
        pos[i*3]+=(bitV[i*3]+Math.sin(S.t*6+i)*.5)*dt;pos[i*3+1]+=bitV[i*3+1]*dt;pos[i*3+2]+=(bitV[i*3+2]+Math.cos(S.t*5+i*1.7)*.5)*dt;
        if(pos[i*3+1]<.03||bitLife[i]<=0){bitLife[i]=0;pos[i*3+1]=-50;}
      }else if(spawn>0){
        spawn--;alive++;
        const a=Math.random()*TAU,rx=10.6+Math.random()*3,rz=17+Math.random()*4,x=Math.cos(a)*rx,z=COURT.midZ+Math.sin(a)*rz;
        pos[i*3]=x;pos[i*3+1]=2.2+Math.random()*4.5;pos[i*3+2]=z;
        const sp=1.5+Math.random()*3;bitV[i*3]=-Math.cos(a)*sp;bitV[i*3+1]=2.5+Math.random()*3.5;bitV[i*3+2]=-Math.sin(a)*sp*1.3;
        bitLife[i]=2.6+Math.random()*1.6;
        const r=Math.random(),c=r<.4?C.a:(r<.65?C.b:null);
        col[i*3]=c?c.r:1;col[i*3+1]=c?c.g:(r<.85?1:.85);col[i*3+2]=c?c.b:(r<.85?1:.3);
      }
    }
    bits.visible=alive>0;
    if(alive>0){bits.geometry.attributes.position.needsUpdate=true;bits.geometry.attributes.color.needsUpdate=true;}
  }

  /* ---------- 场角干冰喷雾 ---------- */
  const jets=[];
  function makeJets(){
    const cv=document.createElement("canvas");cv.width=64;cv.height=256;const g=cv.getContext("2d");
    const gr=g.createLinearGradient(0,256,0,0);gr.addColorStop(0,"rgba(255,255,255,.95)");gr.addColorStop(.35,"rgba(240,248,255,.6)");gr.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=gr;g.fillRect(0,0,64,256);
    g.globalCompositeOperation="destination-in";
    const gx=g.createLinearGradient(0,0,64,0);gx.addColorStop(0,"rgba(0,0,0,0)");gx.addColorStop(.5,"rgba(0,0,0,1)");gx.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=gx;g.fillRect(0,0,64,256);
    const tex=new T.CanvasTexture(cv);
    const hw=COURT.halfWidth+1.05,spots=[[-hw,COURT.nearBaseline-.2],[hw,COURT.nearBaseline-.2],[-hw,COURT.midZ],[hw,COURT.midZ],[-3.4,COURT.nearBaseline-1.5],[3.4,COURT.nearBaseline-1.5]];
    spots.forEach((p,i)=>{
      const sp=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,fog:false}));
      sp.center.set(.5,0);sp.position.set(p[0],.05,p[1]);sp.visible=false;sp.name="frenzyJet";indoorRoot.add(sp);
      jets.push({sp,lag:(i%2)*.12+Math.floor(i/2)*.18});
    });
  }
  function updJets(){
    const age=S.t-S.jetT;
    for(const J of jets){
      const a=age-J.lag;
      if(a<0||a>1.9){J.sp.visible=false;continue;}
      const rise=1-Math.pow(1-cl(a/.28,0,1),3),fade=1-sm((a-.7)/1.2);
      J.sp.scale.set(1.5+a*1.3,5.6*rise+a*.8,1);J.sp.material.opacity=.8*fade;J.sp.visible=true;
    }
  }

  /* ---------- 场边球迷(带腿,能跑):平时藏在座位后面,2 级以上冲到边线;赛后冲进场 ---------- */
  const fans=[];let camGuy=null,fanRoot=null;
  function makeFan(i,opt){
    if(typeof makeArenaStaff!=="function"||typeof nearCourtCrowd==="undefined")return null;
    const n0=nearCourtCrowd.people.length;
    const skins=[0xf6cdab,0xedb48a,0xda9d6e,0xb87848,0x824b22],hairs=[0x16100d,0x2c1b10,0x8a6d42,0x0f1118];
    makeArenaStaff(fanRoot,null,{staffRole:opt&&opt.role||"fan",x:0,z:0,rot:0,scale:rn(.9,1.02),skin:skins[i%skins.length],hair:hairs[i%hairs.length],
      outfit:opt&&opt.outfit!=null?opt.outfit:(i%3===0?C.b.getHex():C.a.getHex()),accent:opt&&opt.accent!=null?opt.accent:(i%3===1?0xf4f4f0:(i%3===0?C.a.getHex():C.b.getHex()))});
    const p=nearCourtCrowd.people[n0];
    if(!p)return null;
    nearCourtCrowd.people.splice(n0,1);                                                 // 归我管,不进场边工作人员的自动巡逻
    p.g.visible=false;
    return {g:p.g,arms:p.arms,legs:p.legs,body:p.body,i,ph:rn(0,TAU),k:0,x:0,z:0,rot:0,home:null,cloth:null,mode:"hide",sp:rn(3.2,4.2)};
  }
  function makeFans(){
    if(typeof scene==="undefined")return;
    fanRoot=new T.Group();fanRoot.name="frenzyFans";scene.add(fanRoot);
    const hw=COURT.halfWidth;
    for(let i=0;i<14;i++){
      const f=makeFan(i);if(!f)return;
      const side=i%2?1:-1,z=COURT.nearBaseline+1.6+(Math.floor(i/2)/6)*(COURT.playMaxZ-COURT.nearBaseline-2.4);
      f.side=side;f.home=new T.Vector3(side*(hw+2.5),0,z);f.x=f.home.x;f.z=f.home.z;
      f.role=i<10?"run":(i<12?"shirt":"sit");
      if(f.role==="shirt"){
        const c=new T.Mesh(new T.PlaneGeometry(.62,.44),new T.MeshLambertMaterial({color:i%2?0xf4f4f0:C.a.getHex(),side:T.DoubleSide}));
        c.position.set(0,-.62,0);f.arms[1].add(c);f.cloth=c;
      }
      fans.push(f);
    }
    /* 摄影师:深色马甲,右肩扛一台摄像机 */
    camGuy=makeFan(20,{outfit:0x20242e,accent:0x3a4150});
    if(camGuy){
      const body=new T.Mesh(new T.BoxGeometry(.2,.2,.42),new T.MeshLambertMaterial({color:0x15171d}));body.position.set(.2,1.36,-.12);camGuy.g.add(body);
      const lens=new T.Mesh(new T.CylinderGeometry(.07,.085,.16,10),new T.MeshLambertMaterial({color:0x2d3340}));lens.rotation.x=Math.PI/2;lens.position.set(.2,1.36,-.4);camGuy.g.add(lens);
      const led=new T.Mesh(new T.SphereGeometry(.022,6,5),new T.MeshBasicMaterial({color:0xff2b2b}));led.position.set(.2,1.48,-.3);camGuy.g.add(led);
      camGuy.home=new T.Vector3(COURT.halfWidth+2.3,0,COURT.nearBaseline+2.2);camGuy.x=camGuy.home.x;camGuy.z=camGuy.home.z;camGuy.role="cam";camGuy.sp=5;
    }
  }
  /* 朝目标点移动;返回这一帧的速度(m/s) */
  function moveFan(f,tx,tz,speed,dt){
    const dx=tx-f.x,dz=tz-f.z,d=Math.hypot(dx,dz);
    if(d<.04){return 0;}
    const st=Math.min(d,speed*dt);f.x+=dx/d*st;f.z+=dz/d*st;
    f.rot=angLerp(f.rot,Math.atan2(dx,dz)+Math.PI,1-Math.exp(-12*dt));
    return st/Math.max(dt,1e-4);
  }
  function faceFan(f,tx,tz,dt){f.rot=angLerp(f.rot,Math.atan2(tx-f.x,tz-f.z)+Math.PI,1-Math.exp(-8*dt));}
  /* 姿势:v=移动速度;kind=cheer 举手蹦 / shirt 挥衣服 / sit 瘫坐抱头 / clap 鼓掌 / five 击掌 / pat 拍肩 / film 扛机拍摄 / bow 膜拜 */
  function poseFan(f,v,kind,dt,amp){
    const t=S.t,run=cl(v/2.5,0,1),stride=Math.sin(t*(9+f.sp)+f.ph)*.75*run;
    let y=0,pitch=0;
    f.legs[0].rotation.set(stride,0,0);f.legs[1].rotation.set(-stride,0,0);
    const A=f.arms,hop=Math.abs(Math.sin(t*(6.2+f.i%3*.5)+f.ph));
    amp=amp==null?1:amp;
    if(kind==="sit"&&run<.2){
      /* 瘫坐:腿向前伸平,身体落到地上往后仰,双手抱头 */
      f.legs[0].rotation.set(1.42,0,-.12);f.legs[1].rotation.set(1.42,0,.12);
      y=-.5;pitch=-.22+Math.sin(t*1.3+f.ph)*.05;
      A[0].rotation.set(2.75,0,.42);A[1].rotation.set(2.75,0,-.42);
    }else if(kind==="shirt"){
      y=hop*.2*amp;A[0].rotation.set(2.2+hop*.3,0,-.3);
      A[1].rotation.set(2.75,0,Math.sin(t*9+f.ph)*.55);
      if(f.cloth){f.cloth.rotation.set(Math.sin(t*9+f.ph)*.9,t*7,Math.cos(t*9+f.ph)*.7);}
    }else if(kind==="clap"){
      const c=Math.sin(t*9+f.ph)*.16;A[0].rotation.set(1.25,0,.26+c);A[1].rotation.set(1.25,0,-.26-c);y=hop*.03;
    }else if(kind==="five"){
      A[1].rotation.set(2.5+Math.sin(t*5+f.ph)*.12,0,-.1);A[0].rotation.set(.3,0,-.12);y=hop*.1*amp;
    }else if(kind==="pat"){
      A[1].rotation.set(1.35+Math.sin(t*3+f.ph)*.1,0,-.2);A[0].rotation.set(.1,0,-.08);pitch=.08;
    }else if(kind==="film"){
      A[1].rotation.set(1.9,0,-.5);A[0].rotation.set(1.7,0,.55);pitch=.1;y=-.1;
      f.legs[0].rotation.x+=.5*(1-run);f.legs[1].rotation.x+=-.35*(1-run);
    }else if(kind==="bow"){
      const b=.5+.5*Math.sin(t*4+f.ph);pitch=.2+.7*b;A[0].rotation.set(2.6-.9*b,0,-.2);A[1].rotation.set(2.6-.9*b,0,.2);
    }else{
      y=hop*(.14+.2*amp);
      const w=Math.sin(t*7.5+f.ph)*.3;A[0].rotation.set(2.5+w,0,-.35);A[1].rotation.set(2.5-w,0,.35);
    }
    f.g.position.set(f.x,y+(run>.2?Math.abs(Math.sin(t*(9+f.sp)+f.ph))*.05:0),f.z);
    f.g.rotation.set(pitch,f.rot,0);
  }
  function updFans(dt){
    if(!fans.length)return;
    const lv=level(),post=S.post,hw=COURT.halfWidth;
    const all=camGuy?fans.concat([camGuy]):fans;
    for(const f of all){
      let want=false,tx=f.home.x,tz=f.home.z,kind="cheer",sp=f.sp,amp=S.ex;
      if(post&&f.slot){
        want=true;const sl=f.slot;tx=post.px+sl.dx;tz=post.pz+sl.dz;kind=sl.kind;sp=sl.sp;amp=1;
      }else if(!post||!post.fans){
        if(f.role==="run"&&(lv>=3||(lv===2&&f.i<6))){
          want=true;tx=f.side*(hw+.85);
          const zA=COURT.nearBaseline+1.2,zB=COURT.playMaxZ-.4,mid=(zA+zB)/2;
          tz=mid+Math.sin(S.t*.55+f.ph)*(zB-zA)/2;
        }else if(f.role==="shirt"&&lv>=2){want=true;tx=f.side*(hw+.95);kind="shirt";}
        else if(f.role==="sit"&&lv>=3){want=true;tx=f.side*(hw+.9);kind="sit";}
      }
      f.k+=((want?1:0)-f.k)*(1-Math.exp(-(want?6:3)*dt));
      const atHome=Math.hypot(f.x-f.home.x,f.z-f.home.z)<.15;
      if(!want&&atHome&&f.k<.05){if(f.g.visible)f.g.visible=false;continue;}
      const v=moveFan(f,tx,tz,want?sp:5,dt);
      if(v<.3){
        if(post&&f.slot)faceFan(f,post.px,post.pz,dt);
        else faceFan(f,0,COURT.midZ-6,dt);
      }
      poseFan(f,v,want?kind:"cheer",dt,amp);
      f.g.scale.setScalar(Math.max(.001,Math.min(1,f.k*2.2))*(f.g.userData.s0||(f.g.userData.s0=f.g.scale.x)));
      f.g.visible=true;
    }
  }

  /* ---------- 看台人群:加倍 + 人浪 ---------- */
  function boostStands(lv,waveK){
    try{
      if(typeof crowd==="undefined"||!crowd.groups)return;
      const pw=POWER[lv];
      for(const gr of crowd.groups)for(const s of gr.seats){
        const u=Math.abs((Math.sin(s.ph*91.7+S.t*3.1)*43758.5453)%1);
        const ang=(Math.atan2(s.z-COURT.midZ,s.x)+Math.PI)/TAU;
        s.responseSign=1;
        s.responseStart=crowd.clock+(waveK?ang*1.6:.04+u*.5);                           // 3 级:按绕场角度依次起立 = 人浪
        s.responseDuration=1.5+u*1.2+lv*.25;
        s.responseLinger=2.6+u*2+lv*.6;
        s.responsePower=pw*(.6+(s.amp||.5)*.4);
      }
    }catch(e){}
  }

  /* ---------- 等级 ---------- */
  function setLevel(lv,why){
    lv=cl(lv|0,0,3);
    if(lv===S.level)return;
    const up=lv>S.level;S.level=lv;
    if(up&&lv>0){
      S.pulse=1;
      try{
        if(typeof toast==="function"&&why!=="quiet")toast((lv===3?"🌊 ":(lv===2?"🤯 ":"🔥 "))+NAMES[lv]+"!",lv===3?"#ff6a3d":"#ffd23f");
        if(typeof cheerSound==="function")cheerSound(true);
        if(lv>=2&&typeof applause==="function")applause(.5,2.4);
        if(lv>=3){if(typeof airhorn==="function")airhorn();setTimeout(()=>{try{cheerSound(true);}catch(e){}},700);}
      }catch(e){}
    }
  }
  function onMake(n){
    if(!active())return;
    const lv=n>=LEVEL_AT[2]?3:(n>=LEVEL_AT[1]?2:(n>=LEVEL_AT[0]?1:0));
    setLevel(lv);
    if(lv>0){
      S.pulse=1;boostStands(lv,lv>=3);S.nextWave=S.t+2.4;
      if(lv>=2)S.jetT=S.t;
      try{if(lv>=2&&typeof cheerSound==="function")cheerSound(true);}catch(e){}
    }
  }
  function onMiss(){if(S.level>0)setLevel(0);}

  /* ================= 赛后:球员情绪 + 冲场互动 ================= */
  const EMO={
    good:["mixamo","mixamo","dance","fistjump","spread","camflex","pointcam"],
    flat:["mixamo","mixamo","clap","wavecam","spread"],
    bad:["mixamo","mixamo","knees","headhands","squat","slump"]
  };
  const CAM_EMO={camflex:1,pointcam:1,wavecam:1};
  function startPost(tone,secs,opts){
    if(!active()||typeof player==="undefined"||typeof P==="undefined")return;
    opts=opts||{};
    let emo=opts.emo||pickOf(EMO[tone]||EMO.flat);
    if((emo==="dance"||emo==="mixamo")&&!(global.AIBADance&&AIBADance.ready&&AIBADance.ids.length))emo=tone==="bad"?"headhands":tone==="flat"?"clap":"fistjump";
    const post=S.post={t:0,dur:secs,tone,emo,px:P.pos.x,pz:P.pos.z,face:P.face,cam:!!opts.cam,fans:true,clip:null,clipT:0,skinned:false,camSide:Math.random()<.5?-1:1,seed:Math.random()*TAU};
    if(emo==="dance"){
      try{post.skinned=typeof pregameSkinned==="function"&&pregameSkinned(player);post.clip=AIBADance.pick(post.skinned);
        if(post.clip)post.clipT=rn(0,Math.max(0,AIBADance.clips[post.clip].dur-secs-.2));else post.emo="fistjump";}catch(e){post.emo="fistjump";}
    }else if(emo==="mixamo"){
      try{
        post.skinned=typeof pregameSkinned==="function"&&pregameSkinned(player);
        const mood=tone==="good"?"cheer":tone==="bad"?"miss":"idle";
        /* 赛后站立球员只调用 role:"player", posture:"standing" 的对应情绪动作 */
        post.clip=typeof AIBADance.pickFor==="function"
          ?AIBADance.pickFor({role:"player",posture:"standing",mood,skinned:post.skinned})
          :null;
        if(post.clip)post.clipT=0;
        else post.emo=tone==="bad"?"headhands":tone==="flat"?"clap":"fistjump";
      }catch(e){post.emo=tone==="bad"?"headhands":tone==="flat"?"clap":"fistjump";}
    }
    /* 冲场:按结果决定来多少人、干什么。站位以球员为圆心,留出"球员→镜头"那一侧不挡脸 */
    const fx=Math.sin(P.face),fz=Math.cos(P.face);                                    // 球员面朝的方向(朝篮筐)
    const n=tone==="good"?8:(tone==="flat"?3:2);
    fans.forEach(f=>{f.slot=null;});
    for(let i=0;i<n&&i<fans.length;i++){
      const f=fans[i];let a,r,kind,sp;
      if(tone==="good"){a=P.face+Math.PI+(i-(n-1)/2)*.52;r=1.55+(i%2)*.55;kind=i===3?"bow":(i%4===1?"five":"cheer");sp=rn(5.6,7);}
      else if(tone==="flat"){a=P.face+Math.PI+(i-1)*.9;r=1.25+(i%2)*.3;kind=i===0?"five":"clap";sp=rn(3.6,4.4);}
      else{a=P.face+(i?-1:1)*1.75;r=i?1.5:.62;kind=i?"clap":"pat";sp=rn(1.7,2.1);}
      f.slot={dx:Math.sin(a)*r,dz:Math.cos(a)*r,kind,sp};
    }
    /* 摄影师:跑到球员正前方两米多,蹲低扛机 */
    /* 摄影师站在和转播镜头相反的那一侧斜前方,不挡镜头 */
    if(camGuy){const ca=P.face-post.camSide*.95;camGuy.slot={dx:Math.sin(ca)*2.1,dz:Math.cos(ca)*2.1,kind:"film",sp:tone==="bad"?3.2:6};}
    if(tone==="good"){S.force=opts.force||2;S.pulse=1;S.jetT=S.t+.25;boostStands(S.force,S.force>=3);}
  }
  function endPost(){
    if(!S.post)return;
    S.post=null;S.force=0;
    fans.forEach(f=>{f.slot=null;f.k=0;f.x=f.home.x;f.z=f.home.z;f.g.visible=false;});
    if(camGuy){camGuy.slot=null;camGuy.k=0;camGuy.x=camGuy.home.x;camGuy.z=camGuy.home.z;camGuy.g.visible=false;}
    try{if(typeof player!=="undefined"){player.pregameLift=0;player.pregameDance=null;}}catch(e){}
  }
  /* 把球员摆成情绪动作(在 updPose 之后叠加;从当前站姿平滑过渡过去) */
  function posePlayer(dt){
    const post=S.post,guy=typeof player!=="undefined"?player:null;
    if(!post||!guy||!guy.g||!guy.arms||typeof pregamePoseSnapshot!=="function"||typeof pregameNeutral!=="function")return;
    const w=sm(post.t/.45),t=post.t,emo=post.emo;
    const from=pregamePoseSnapshot(guy);
    const camYaw=camGuy&&camGuy.g.visible?Math.atan2(camGuy.x-post.px,camGuy.z-post.pz):post.face+Math.PI;
    let yaw=post.face,lift=0,rootY=0;
    pregameNeutral(guy);
    const A=guy.arms,E=guy.elbows,L=guy.legs,K=guy.knees,H=guy.headRoot;
    guy.pregameDance=null;
    if(emo==="fistjump"){
      const j=Math.abs(Math.sin(t*5.2));lift=j*.3;
      A[0].rotation.set(-2.45-j*.35,0,-.1);E[0].rotation.x=-.75+j*.4;A[1].rotation.set(-1.1,0,.2);E[1].rotation.x=-1.5;
      K.forEach(k=>k.rotation.x=.3*(1-j));L.forEach(l=>l.rotation.x=-.15*(1-j));
      if(H)H.rotation.x=-.2;yaw=angLerp(post.face,camYaw,.6);
    }else if(emo==="spread"){
      const o=.9+Math.sin(t*4)*.1;A[0].rotation.set(-1.75,0,-.62*o);A[1].rotation.set(-1.75,0,.62*o);E.forEach(e=>e.rotation.x=-.45);
      if(H)H.rotation.x=-.28;yaw=post.face+Math.PI*sm(t/1.2)+Math.sin(t*1.1)*.5;
    }else if(emo==="camflex"){
      const p=Math.sin(t*6)*.08;A[0].rotation.set(-1.45,0,-.78);A[1].rotation.set(-1.45,0,.78);E.forEach(e=>e.rotation.x=-2.05+p);
      lift=Math.abs(Math.sin(t*3))*.05;if(H)H.rotation.x=.1+Math.sin(t*6)*.1;yaw=camYaw;guy.g.rotation.x=.08;
    }else if(emo==="pointcam"){
      A[0].rotation.set(-1.52+Math.sin(t*7)*.06,0,-.05);E[0].rotation.x=-.08;A[1].rotation.set(.12,0,.5);E[1].rotation.x=-1.25;
      if(H)H.rotation.x=.08+Math.sin(t*3.5)*.12;yaw=camYaw;guy.g.rotation.x=.12;
    }else if(emo==="wavecam"){
      A[0].rotation.set(-2.3,0,-.25+Math.sin(t*8)*.38);E[0].rotation.x=-.35;A[1].rotation.set(-.4,0,.1);E[1].rotation.x=-.4;yaw=camYaw;
    }else if(emo==="clap"){
      const c=Math.abs(Math.sin(t*7));A[0].rotation.set(-2.25,0,.28-c*.2);A[1].rotation.set(-2.25,0,-.28+c*.2);E.forEach(e=>e.rotation.x=-.55-c*.4);
      yaw=post.face+Math.PI*sm(t/1.4);if(H)H.rotation.x=-.15;
    }else if(emo==="knees"){
      const br=Math.sin(t*3.4)*.03;guy.g.rotation.x=.62+br;A.forEach(a=>a.rotation.set(-.95,0,0));E.forEach(e=>e.rotation.x=-.12);
      L.forEach(l=>l.rotation.x=-.42);K.forEach(k=>k.rotation.x=.5);if(H)H.rotation.x=.38;rootY=-.04;
    }else if(emo==="headhands"){
      A[0].rotation.set(-2.72,0,.5);A[1].rotation.set(-2.72,0,-.5);E.forEach(e=>e.rotation.x=-2.1);
      if(H){H.rotation.x=-.3;H.rotation.y=Math.sin(t*1.6)*.2;}guy.g.rotation.x=-.06;yaw=post.face+Math.sin(t*.9)*.35;
    }else if(emo==="squat"){
      const d=sm(t/.7);L.forEach(l=>l.rotation.x=-1.3*d);K.forEach(k=>k.rotation.x=2.3*d);guy.g.rotation.x=.3*d;
      A[0].rotation.set(-1.0,0,-.12);A[1].rotation.set(-1.0,0,.12);E.forEach(e=>e.rotation.x=-.7);if(H)H.rotation.x=.42*d;
      if(typeof poseFootBottomY==="function"&&typeof POSE_STAND_FOOT_Y!=="undefined")rootY=POSE_STAND_FOOT_Y-poseFootBottomY(L[0].rotation.x,K[0].rotation.x,0);
    }else if(emo==="slump"){
      A.forEach(a=>a.rotation.set(.04,0,0));E.forEach(e=>e.rotation.x=-.05);guy.g.rotation.x=.16;
      if(H){H.rotation.x=.46;H.rotation.y=Math.sin(t*3.2)*.3*(1-sm((t-1.6)/.6));}
      yaw=post.face+sm(t/2.2)*1.2;
    }else if((emo==="dance"||emo==="mixamo")&&post.clip){
      const smp=AIBADance.sample(post.clip,post.clipT+t,emo==="mixamo");
      if(smp){
        if(post.skinned)guy.pregameDance={q:smp.q,hy:smp.hy,w};
        else{guy.g.rotation.y=post.face;AIBADance.applyVox(guy,smp.vox,1);}
      }
    }
    if(!((emo==="dance"||emo==="mixamo")&&!post.skinned)){
      guy.g.rotation.order="XYZ";guy.g.rotation.y=yaw;guy.g.rotation.z=0;
      guy.g.position.y=rootY+lift;
    }
    /* 过渡:关节从 updPose 的站姿混到情绪动作 */
    if(w<1&&typeof pregameBlendRotations==="function"){
      for(const key of ["arms","elbows","legs","knees","ankles"])pregameBlendRotations(guy[key],from[key],w);
      guy.g.position.y=from.pos.y+(guy.g.position.y-from.pos.y)*w;
      guy.g.rotation.x=from.rot.x+(guy.g.rotation.x-from.rot.x)*w;
      guy.g.rotation.y=angLerp(from.rot.y,guy.g.rotation.y,w);
      if(H&&from.head){H.rotation.x=from.head.x+(H.rotation.x-from.head.x)*w;H.rotation.y=from.head.y+(H.rotation.y-from.head.y)*w;}
    }
    guy.pregameLift=Math.max(0,guy.g.position.y-.02);
    guy.g.visible=true;
    try{if(typeof hands!=="undefined")hands.visible=false;if(typeof pBall!=="undefined")pBall.visible=false;if(typeof handBall!=="undefined")handBall.visible=false;}catch(e){}
  }
  /* 赛后镜头:先在球员斜前方慢慢推近(看得到冲进来的人),对镜头的动作再切到摄影师肩上的机位 */
  const _cp=new T.Vector3(),_cl=new T.Vector3(),_rp=new T.Vector3(),_rl=new T.Vector3();
  function postCamera(dt){
    const post=S.post;if(!post||!post.cam||typeof rig==="undefined")return;
    const u=cl(post.t/post.dur,0,1),fx=Math.sin(post.face),fz=Math.cos(post.face),sx=fz*post.camSide,sz=-fx*post.camSide;
    const lens=CAM_EMO[post.emo]&&camGuy&&camGuy.g.visible&&u>.5&&Math.hypot(camGuy.x-(post.px+camGuy.slot.dx),camGuy.z-(post.pz+camGuy.slot.dz))<.4;
    if(lens){
      /* 摄影师镜头的视角:从他的机器前面(往球员方向挪 .55)看过去,别把自己的脑袋和机身拍进去 */
      const dx=post.px-camGuy.x,dz=post.pz-camGuy.z,d=Math.hypot(dx,dz)||1;
      _cp.set(camGuy.x+dx/d*.55,1.34,camGuy.z+dz/d*.55);_cl.set(post.px,1.45,post.pz);
      if(!post.lens){post.lens=true;_rp.copy(_cp);_rl.copy(_cl);rig.pos.copy(_rp);rig.look.copy(_rl);return;}
    }else{
      const r=3.5-.9*sm(u*1.4),side=1.5+Math.sin(post.seed+u*1.4)*.5;
      _cp.set(post.px+fx*r+sx*side,1.5+.35*u,post.pz+fz*r+sz*side);_cl.set(post.px,1.15,post.pz);
      if(!post.camInit){post.camInit=true;_rp.copy(_cp);_rl.copy(_cl);rig.pos.copy(_rp);rig.look.copy(_rl);return;}
    }
    /* 自己记一份机位再整份写回 rig:常规跟随镜头在这之前也往 rig 里插值,两边一起拉会停在中间 */
    _rp.lerp(_cp,1-Math.exp(-3.2*dt));_rl.lerp(_cl,1-Math.exp(-6*dt));
    rig.pos.copy(_rp);rig.look.copy(_rl);
  }

  /* ---------- 每帧 ---------- */
  function build(){
    if(S.built)return;S.built=true;syncStar();
    makePosters();makeBits();makeJets();makeFans();
  }
  function update(dt){
    if(!S.built){if(!active())return;build();}
    S.t+=dt;
    if(syncStar())paintPosters();
    const st=typeof G!=="undefined"?G.state:"";
    /* 赛后收尾:离开结算留白 / 胜利运镜就把人都收回去 */
    if(S.post){
      S.post.t+=dt;
      if(st!=="resultbeat"&&st!=="victorycine"){const camOwned=S.post.cam;endPost();if(camOwned&&typeof applyCamMode==="function")try{applyCamMode();}catch(e){}}
    }
    /* 胜利运镜:球员是主角时全场直接拉到 3 级 + 冲场 */
    if(st==="victorycine"&&S.lastState!=="victorycine"&&typeof VICTORY_CINE!=="undefined"&&VICTORY_CINE.on){
      const mine=VICTORY_CINE.hero===player;
      startPost(mine?"good":"bad",VICTORY_CINE.dur||4.6,{cam:false,force:mine?3:0,emo:mine&&global.AIBADance&&AIBADance.ready&&typeof pregameSkinned==="function"&&pregameSkinned(player)&&Math.random()<.5?"dance":"none"});
    }
    /* 换场 / 回菜单:等级清零 */
    if(st!==S.lastState){if(st==="menu"||st==="diff"||st==="pregame"){S.level=0;S.force=0;S.pulse=0;}S.lastState=st;}
    if(!active()){S.level=0;S.force=0;}
    const lv=level();
    S.pulse=Math.max(0,S.pulse-dt*.28);
    const tgt=lv>0?Math.max(SUSTAIN[lv],S.pulse):0;
    S.ex+=(tgt-S.ex)*(1-Math.exp(-(tgt>S.ex?8:1.6)*dt));
    if(lv>=2&&S.t>S.nextWave){S.nextWave=S.t+(lv>=3?2.3:3.4);boostStands(lv,lv>=3);if(lv>=3)S.jetT=S.t;}
    if(lv>=1&&S.t>S.nextNear){S.nextNear=S.t+2.2;try{if(typeof triggerNearCourtCrowdReaction==="function")triggerNearCourtCrowdReaction("make",5);}catch(e){}}
    updPosters();updBits(dt);updJets();updFans(dt);
  }

  /* ---------- 挂接 ---------- */
  const guard=(fn)=>function(){try{return fn.apply(this,arguments);}catch(e){if(!S.err){S.err=String(e&&e.stack||e);console.warn("[frenzy]",S.err);}}};
  const mb=global.madeBall,xb=global.missBall;
  if(typeof mb==="function")global.madeBall=function(b){const r=mb.apply(this,arguments);
    guard(()=>{if(b&&!b.opp&&!b.silent)onMake((typeof G!=="undefined"&&G.streak)||0);})();return r;};
  if(typeof xb==="function")global.missBall=function(){const r=xb.apply(this,arguments);guard(onMiss)();return r;};
  /* 姿势:updPose 之后叠加赛后情绪 */
  const up=global.updPose;
  if(typeof up==="function")global.updPose=function(dt){const r=up.apply(this,arguments);guard(()=>{if(S.post&&S.post.emo!=="none")posePlayer(dt);})();return r;};
  /* 每帧更新 + 赛后镜头:跟在镜头调度之后 */
  const cd=global.updateCameraDirector;
  if(typeof cd==="function")global.updateCameraDirector=function(dt){const r=cd.apply(this,arguments);
    guard(()=>{update(typeof G!=="undefined"&&G.realDt?Math.min(.1,G.realDt):(dt||.016));if(S.post&&S.post.cam)postCamera(dt||.016);})();return r;};
  /* 结算留白:带上球员情绪和冲场;时间加长到够人跑过来(随时可点屏幕跳过) */
  const RB=global.AIBAResultBeat;
  if(RB&&typeof RB.play==="function"){
    global.AIBAResultBeat=Object.freeze(Object.assign({},RB,{play(opts){
      opts=Object.assign({},opts||{});
      const ok=typeof G!=="undefined"&&G.mode!=="lastshot"&&active();
      if(ok)opts.seconds=Math.max(Number(opts.seconds)||3.2,5.4);
      const r=RB.play(opts);
      if(ok)guard(()=>startPost(opts.tone==="good"?"good":(opts.tone==="bad"?"bad":"flat"),opts.seconds,{cam:true}))();
      return r;
    }}));
  }
  global.AIBAFrenzy=Object.freeze({
    setLevel:(n)=>{setLevel(n,"quiet");if(n>0){S.pulse=1;boostStands(cl(n,1,3),n>=3);if(n>=2)S.jetT=S.t;}},
    make:onMake,miss:onMiss,post:(tone,secs,opts)=>startPost(tone||"good",secs||5.4,Object.assign({cam:true},opts||{})),endPost,
    state:()=>({on:true,built:S.built,level:S.level,force:S.force,ex:+S.ex.toFixed(3),posters:posterSeats.length,posterK:+(S.posterK||0).toFixed(2),
      fans:fans.filter(f=>f.g.visible).length,fanTotal:fans.length,bits:!!(bits&&bits.visible),jets:jets.filter(j=>j.sp.visible).length,
      post:S.post?{emo:S.post.emo,tone:S.post.tone,t:+S.post.t.toFixed(2)}:null,err:S.err})
  });
})(window);
