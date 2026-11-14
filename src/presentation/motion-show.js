/* ---------------- Motion Show:球馆动效层 ----------------
   两件事,同一套配色和节拍:
   1) 球星登场(约 4.6 秒):全馆压暗,半场地板变成一块 LED 屏 —— 扫描线、巨大号码砸下、名字擦入,灯带追光,然后亮灯。
   2) 投篮阶段的配合:平时安静;命中后一道队色光波从篮筐后方沿灯带向两侧扫开、地板上一圈涟漪;
      连中时篮筐后方灯带持续升温、禁区里闪一下 ×N;关键球全场一黑再爆亮。失手只把热度熄掉。
   只叠加自己的网格(地板一张、灯带四圈),不改球馆原有物体;没有室内球馆(indoorRoot 不可见)时什么都不做。
   ?show=0 关闭。 */
(function(global){
  "use strict";
  if(typeof THREE==="undefined"||typeof indoorRoot==="undefined"||typeof COURT==="undefined")return;
  const ON=!/[?&]show=0\b/.test(String(global.location&&global.location.search));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const outExpo=t=>t>=1?1:1-Math.pow(2,-10*clamp(t,0,1));
  const TAU=Math.PI*2,HOOP_A=-Math.PI/2;                      // bowlPt 里篮筐后方(z 最小)对应的角度
  const FONT='"Avenir Next Condensed","HelveticaNeue-CondensedBlack","Arial Narrow","PingFang SC",Impact,sans-serif';

  /* ---------- 配色:每个球星两个颜色 + 黑白 ---------- */
  const C={acc:new THREE.Color(0xfdb927),sec:new THREE.Color(0x552583),accCss:"#fdb927",secCss:"#552583",num:"8",name:"AIBA"};
  const sat=c=>{const h={};c.getHSL(h);return h.s*(1-Math.abs(h.l*2-1));};
  function syncStar(){
    const s=(typeof G!=="undefined"&&G.myStar)||null;
    const key=s?(s.id||s.n)+":"+(s.col||[]).join(","):"-";
    if(key===C.key)return;C.key=key;
    const a=new THREE.Color(s&&s.col?s.col[0]:0xfdb927),b=new THREE.Color(s&&s.col?s.col[1]:0x552583);
    /* 更鲜艳的那个当主色(白色球衣的球星,主色取队色而不是白) */
    const [acc,sec]=sat(a)>=sat(b)?[a,b]:[b,a];
    const h={};acc.getHSL(h);if(h.l<.58||h.s<.7)acc.setHSL(h.h,Math.max(h.s,.78),Math.max(h.l,.6));          // 太暗的队色在黑场里发不出光,提到可发光的亮度
    C.acc.copy(acc);C.sec.copy(sec);C.accCss="#"+acc.getHexString();C.secCss="#"+sec.getHexString();
    C.num=String(s&&s.num!=null?s.num:"");
    C.name=String(s&&s.n?s.n:"AIBA").replace(/^\s*\d+\s*号\s*[·•]\s*/,"").toUpperCase();
  }

  /* ---------- 灯带:四圈,各一个合并网格,顶点色驱动 ---------- */
  const rings=[];
  function makeRing(rx,rz,y,w,h,SEG,lag){
    const pos=new Float32Array(SEG*18),col=new Float32Array(SEG*18),ang=new Float32Array(SEG);
    for(let i=0;i<SEG;i++){
      const a=i/SEG*TAU,p=bowlFacing(a,rx,rz),th=p.rot-Math.PI/2;
      const dz=p.z-COURT.midZ,L=Math.hypot(p.x,dz)||1,cx=p.x-p.x/L*.05,cz=p.z-dz/L*.05;      // 往场内收 5cm,压在原灯箱前面
      const tx=Math.cos(th)*w/2,tz=-Math.sin(th)*w/2,y0=y-h/2,y1=y+h/2;
      const q=[[cx-tx,y0,cz-tz],[cx+tx,y0,cz+tz],[cx+tx,y1,cz+tz],[cx-tx,y0,cz-tz],[cx+tx,y1,cz+tz],[cx-tx,y1,cz-tz]];
      for(let k=0;k<6;k++)pos.set(q[k],i*18+k*3);
      let d=Math.abs(a-(HOOP_A+TAU))%TAU;if(d>Math.PI)d=TAU-d;ang[i]=d;                       // 离篮筐后方的角距离
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    geo.setAttribute("color",new THREE.BufferAttribute(col,3));
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,
      depthWrite:false,toneMapped:false,side:THREE.DoubleSide,fog:false}));
    mesh.name="motionShowRing";mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=5;
    indoorRoot.add(mesh);
    rings.push({mesh,col,ang,SEG,lag,attr:geo.attributes.color});
  }

  /* ---------- 地板:半场一张画布 ---------- */
  const FK=1.5;                                                // 画布实际像素 = 逻辑尺寸 × FK
  const FW=544,FH=512;                                         // 15.24m × 14.325m,约 35.7 像素/米;画布上方 = 篮筐一侧
  const PX=FW/COURT.width,HOOP_PY=(COURT.nearHoopZ-COURT.nearBaseline)*PX,CXF=FW/2;
  let floor=null,fg=null,ftex=null,floorDirty=false;
  function makeFloor(){
    const cv=document.createElement("canvas");cv.width=Math.round(FW*FK);cv.height=Math.round(FH*FK);fg=cv.getContext("2d");
    ftex=new THREE.CanvasTexture(cv);ftex.encoding=THREE.sRGBEncoding;ftex.generateMipmaps=false;ftex.minFilter=THREE.LinearFilter;
    const len=COURT.midZ-COURT.nearBaseline;
    floor=new THREE.Mesh(new THREE.PlaneGeometry(COURT.width,len),new THREE.MeshBasicMaterial({map:ftex,transparent:true,depthWrite:false,
      toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,.05,COURT.nearBaseline+len/2);
    floor.name="motionShowFloor";floor.visible=false;floor.renderOrder=20;
    indoorRoot.add(floor);
  }

  /* ---------- 状态 ---------- */
  const S={t:0,heat:0,heatT:0,pulses:[],burst:-1,ent:-1,dim:1,base:null,streak:0,streakT:-1,lastDraw:0,built:false,wasPlay:false,lastEnt:-99,wrote:false,wroteK:1};
  const ENT_DUR=4.6,PULSE=.75,BURST=1.1,PLAY={round:1,tiebreak:1,battle:1,rackrush:1,lastshot:1};
  function build(){
    if(S.built)return;S.built=true;
    makeRing(11.8,19.2,.52,3.84,.54,28,0);
    makeRing(27.05,34.15,8.52,5.72,.44,36,.07);
    makeRing(27.10,34.20,12.82,5.74,.34,36,.12);
    makeRing(27.15,34.25,14.82,5.76,.48,36,.17);
    makeFloor();
  }
  const active=()=>ON&&indoorRoot.visible!==false&&(!indoorRoot.parent||indoorRoot.parent.visible!==false);

  /* ---------- 事件 ---------- */
  function fire(kind,info){
    if(!ON)return false;
    syncStar();
    if(kind==="make"){
      S.pulses.push({t:0});if(S.pulses.length>3)S.pulses.shift();
      const n=(info&&info.streak)||0;
      S.heatT=clamp((n-1)/7,0,1);
      if(n>=3){S.streak=n;S.streakT=0;}
      if(info&&info.clutch)S.burst=0;
    }else if(kind==="miss"){S.heatT=0;}
    else if(kind==="clutch"){S.burst=0;S.pulses.push({t:0});}
    else if(kind==="entrance"){S.ent=0;S.lastEnt=S.t;S.pulses.length=0;S.burst=-1;}
    else return false;
    return true;
  }

  /* ---------- 每帧 ---------- */
  function setRings(){
    let any=false;
    const e=S.ent,b=S.burst;
    for(const R of rings){
      let on=false;
      for(let i=0;i<R.SEG;i++){
        const d=R.ang[i];let I=0,W=0;
        /* 连中热度:篮筐后方一段持续发亮,越热越宽越亮 */
        if(S.heat>.01)I+=S.heat*.55*Math.exp(-Math.pow(d/(.5+S.heat*.9),2));
        /* 命中光波:从篮筐后方向两侧扫开 */
        for(const p of S.pulses){const u=(p.t-R.lag)/PULSE;if(u<=0||u>=1)continue;
          const front=outExpo(u)*Math.PI;I+=1.25*(1-u)*Math.exp(-Math.pow((d-front)/.3,2));}
        /* 关键球:一黑(由曝光负责)再全场爆亮,带白 */
        if(b>=0){const u=b/BURST;if(u>.13){const k=Math.pow(1-(u-.13)/.87,2.2);I+=1.5*k;W+=.9*k*k;}}
        /* 登场:先全灭,追光绕场,号码砸下时齐闪,最后收掉 */
        if(e>=0){
          if(e>.9&&e<3.9){const a0=(e-.9)*3.6,dd=Math.abs(((i/R.SEG*TAU-a0)%TAU+TAU)%TAU-Math.PI);
            I+=.9*Math.exp(-Math.pow((Math.PI-dd)/.45,2))*sm((3.9-e)/.5);}
          if(e>1.0){const k=Math.pow(clamp(1-(e-1.0)/.9,0,1),2);I+=1.3*k;W+=.7*k*k;}
          if(e>2.0&&e<4.2)I+=.22*sm((e-2)/.4)*sm((4.2-e)/.5);
        }
        const r=C.acc.r*I+W,g=C.acc.g*I+W,bl=C.acc.b*I+W,o=i*18;
        for(let k=0;k<6;k++){R.col[o+k*3]=r;R.col[o+k*3+1]=g;R.col[o+k*3+2]=bl;}
        if(I+W>.004)on=true;
      }
      R.mesh.visible=on;if(on){R.attr.needsUpdate=true;any=true;}
    }
    return any;
  }
  function text(g,str,x,y,size,opt){
    g.font=(opt&&opt.plain?"800 ":"italic 900 ")+size+"px "+FONT;g.textAlign="center";g.textBaseline="middle";
    if(opt&&opt.stroke){g.lineWidth=opt.stroke;g.strokeStyle=opt.color;g.strokeText(str,x,y);}
    else{g.fillStyle=opt&&opt.color||"#fff";g.fillText(str,x,y);}
  }
  function spaced(g,str,x,y,size,gap,color){
    g.font="800 "+size+"px "+FONT;g.textBaseline="middle";g.textAlign="left";g.fillStyle=color;
    const ch=[...str];let w=0;const ws=ch.map(c=>{const m=g.measureText(c).width;w+=m+gap;return m;});w-=gap;
    let cx=x-w/2;ch.forEach((c,i)=>{g.fillText(c,cx,y);cx+=ws[i]+gap;});
    return w;
  }
  /* ---------- 数字:自己画的斜体段码(不依赖系统字体,笔画可以一段段点亮) ---------- */
  const SEGMAP={"0":"abcdef","1":"bc","2":"abged","3":"abgcd","4":"fgbc","5":"afgcd","6":"afgedc","7":"abc","8":"abcdefg","9":"abfgcd"};
  const SEG_ORDER="afbgecd";
  function segPath(g,name,w,h){
    const k=h*.1,gp=h*.014,hw=w/2-k,L=w-2*k-2*gp,Lv=h/2-k-2*gp;
    const H=(cy)=>{g.moveTo(-L/2,cy);g.lineTo(-L/2+k,cy-k);g.lineTo(L/2-k,cy-k);g.lineTo(L/2,cy);g.lineTo(L/2-k,cy+k);g.lineTo(-L/2+k,cy+k);g.closePath();};
    const Vv=(cx,cy)=>{g.moveTo(cx,cy-Lv/2);g.lineTo(cx+k,cy-Lv/2+k);g.lineTo(cx+k,cy+Lv/2-k);g.lineTo(cx,cy+Lv/2);g.lineTo(cx-k,cy+Lv/2-k);g.lineTo(cx-k,cy-Lv/2+k);g.closePath();};
    const q=(h/2-k)/2;
    if(name==="a")H(-h/2+k);else if(name==="g")H(0);else if(name==="d")H(h/2-k);
    else if(name==="f")Vv(-hw,-q);else if(name==="b")Vv(hw,-q);else if(name==="e")Vv(-hw,q);else if(name==="c")Vv(hw,q);
  }
  /* prog:0→1 逐段点亮;mode: fill | stroke */
  function digits(g,str,h,prog,color,mode,lw){
    const w=h*.64,gap=h*.17,n=str.length,total=n*w+(n-1)*gap;
    g.save();g.transform(1,0,-.16,1,0,0);
    for(let di=0;di<n;di++){
      const segs=SEGMAP[str[di]];if(!segs)continue;
      g.save();g.translate(-total/2+w/2+di*(w+gap),0);
      for(let si=0;si<SEG_ORDER.length;si++){
        const nm=SEG_ORDER[si];if(segs.indexOf(nm)<0)continue;
        const p=clamp((prog*1.0-(si*.07+di*.06))/.34,0,1);if(p<=0)continue;
        g.beginPath();segPath(g,nm,w,h);
        if(mode==="stroke"){g.lineWidth=lw;g.strokeStyle=color;g.globalAlpha*=p;g.stroke();g.globalAlpha/=p||1;}
        else{g.fillStyle=color;const a0=g.globalAlpha;g.globalAlpha=a0*sm(p*1.6);g.fill();
          if(p<1){g.globalAlpha=a0*(1-p);g.fillStyle="#fff";g.fill();}g.globalAlpha=a0;}
      }
      g.restore();
    }
    g.restore();
  }
  /* 场地线(以篮筐正下方为原点,单位米;+y 朝中场):用来做"线条自己画出来" */
  const LINES=(()=>{
    const arc=(r,a0,a1,n,cy)=>{const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([Math.cos(a)*r,(cy||0)+Math.sin(a)*r]);}return o;};
    const bl=COURT.nearBaseline-COURT.nearHoopZ,ft=bl+5.8,a3=Math.asin(clamp((2.98)/7.24,-1,1));
    return [
      [[-6.6,bl],[-6.6,2.98]].concat(arc(7.24,Math.PI-a3,a3,48)).concat([[6.6,bl]]),          // 三分线
      [[-2.45,bl],[-2.45,ft],[2.45,ft],[2.45,bl]],                                             // 禁区
      arc(1.8,Math.PI,0,28,ft),                                                                // 罚球圈(朝中场的半圆)
      arc(1.25,Math.PI,0,20,0)                                                                 // 合理冲撞区
    ];
  })();
  function traceLines(g,pr,alpha){
    if(pr<=0||alpha<=0)return;
    g.save();g.translate(CXF,HOOP_PY);g.lineJoin="round";g.lineCap="round";
    for(const pass of [[7,.16],[2.2,.95]]){
      g.lineWidth=pass[0];g.globalAlpha=alpha*pass[1];g.strokeStyle=pass[0]>3?C.accCss:"#fff";
      for(let li=0;li<LINES.length;li++){
        const P=LINES[li],lp=clamp(pr*1.25-li*.08,0,1),n=Math.max(2,Math.round(lp*(P.length-1))+1);
        if(lp<=0)continue;
        g.beginPath();for(let i=0;i<n&&i<P.length;i++){const x=P[i][0]*PX,y=P[i][1]*PX;if(i)g.lineTo(x,y);else g.moveTo(x,y);}
        g.stroke();
      }
    }
    g.restore();
  }
  /* 画面朝向:地板上的字要正对镜头读,所以整组内容绕篮筐转到"篮筐→镜头"这条轴上 */
  function camAngle(){
    const cam=typeof camera!=="undefined"?camera:null;if(!cam)return 0;
    const dx=cam.position.x,dz=cam.position.z-COURT.nearHoopZ;
    return clamp(Math.atan2(-dx,Math.max(.5,dz)),-1.05,1.05);
  }
  function drawFloor(){
    const g=fg,e=S.ent;let any=false;
    g.setTransform(FK,0,0,FK,0,0);g.globalAlpha=1;g.globalCompositeOperation="source-over";g.clearRect(0,0,FW,FH);
    const tgt=camAngle();
    if(S.phi==null||e<0&&S.streakT<0)S.phi=tgt;else S.phi+=(tgt-S.phi)*.06;
    const M=PX;
    if(e>=0){
      any=true;
      const inK=sm(e/.5),outK=sm((e-3.75)/.75);
      const cut=FH*(1-outK);                                   // 收场:整块画面朝篮筐方向擦掉
      g.save();g.beginPath();g.rect(0,0,FW,cut);g.clip();
      g.fillStyle="rgba(3,4,9,"+(.93*inK).toFixed(3)+")";g.fillRect(0,0,FW,FH);
      /* 场地线自己画出来,号码落定后退成背景 */
      traceLines(g,outExpo((e-.3)/1.0),e<1.5?1:1-.62*sm((e-1.5)/.5));
      g.save();g.translate(CXF,HOOP_PY);g.rotate(S.phi);
      /* 回声弧:三分线向外一圈圈扩散,和比赛里命中的涟漪是同一种语言(不随镜头转) */
      if(e>.9){
        g.save();g.rotate(-S.phi);g.lineWidth=.08*M;g.strokeStyle=C.accCss;
        for(let i=0;i<5;i++){const ph=((e-.9)*.42+i/5)%1,r=(7.24+ph*7.5)*M;
          g.globalAlpha=.85*sm(ph*5)*(1-ph)*sm((e-.9)/.4)*(1-sm((e-3.5)/.5));
          g.beginPath();g.arc(0,0,r,.12,Math.PI-.12);g.stroke();}
        g.restore();
      }
      /* 速度条:号码砸下的那一秒从身后横向掠过 */
      if(e>.95&&e<2.3){
        for(let i=0;i<6;i++){
          const u=clamp((e-.95-i*.07)/.75,0,1);if(u<=0||u>=1)continue;
          const yy=(1.9+i*.82)*M,wd=(5+i*.7)*M,x=(i%2?1:-1)*(11*M-outExpo(u)*22*M)-wd/2,th=(.2-.02*i)*M;
          g.globalAlpha=.85*Math.sin(u*Math.PI);g.fillStyle=i%3===1?"#fff":C.accCss;
          g.beginPath();g.moveTo(x,yy);g.lineTo(x+wd,yy);g.lineTo(x+wd-th*.8,yy+th);g.lineTo(x-th*.8,yy+th);g.closePath();g.fill();
        }
      }
      /* 号码:逐段点亮,放大砸下,落定后带两层错位描边;纵向拉长 1.5 倍,抵消镜头的透视压缩 */
      if(e>1.0&&C.num){
        const u=(e-1.0)/.5,s=1+.9*(1-outExpo(u)),hN=(C.num.length>1?2.7:3.1)*M;
        g.save();g.translate(0,4.55*M);g.scale(s,s*1.5);
        const set=sm((e-1.5)/.5);
        g.globalAlpha=.5*set;digits(g,C.num,hN*(1+.16*set),1,C.accCss,"stroke",2);
        g.globalAlpha=.85*set;digits(g,C.num,hN*(1+.08*set),1,"#fff","stroke",1.6);
        g.globalAlpha=1;digits(g,C.num,hN,clamp(u*1.15,0,1),C.accCss,"fill");
        g.restore();
      }
      /* 名字:像球衣背面一样压在号码上方,从中心向两侧擦入 */
      if(e>1.9){
        const k=outExpo((e-1.9)/.6),ny=1.3*M,half=5*M*k;
        g.save();g.beginPath();g.rect(-half,ny-1.1*M,half*2,2.2*M);g.clip();
        g.globalAlpha=1;g.translate(0,ny);g.scale(1,1.5);spaced(g,C.name,0,0,.92*M,.36*M,"#fff");
        g.restore();
      }
      g.restore();
      g.restore();
      if(outK>0&&outK<1){g.globalAlpha=.9;g.fillStyle=C.accCss;g.fillRect(0,cut-2,FW,3);}      // 擦除边缘的一条亮线
    }else{
      /* 命中涟漪:以篮筐正下方为圆心 */
      for(const p of S.pulses){const u=p.t/PULSE;if(u<=0||u>=1)continue;any=true;
        const r=outExpo(u)*9.2*M;
        g.globalAlpha=.8*Math.pow(1-u,1.4);g.strokeStyle=C.accCss;g.lineWidth=(.05+.2*(1-u))*M;
        g.beginPath();g.arc(CXF,HOOP_PY,r,0,TAU);g.stroke();
        g.globalAlpha=.9*Math.pow(1-u,1.5);g.strokeStyle="#fff";g.lineWidth=.045*M;g.beginPath();g.arc(CXF,HOOP_PY,r+.16*M,0,TAU);g.stroke();
        g.globalAlpha=.45*Math.pow(1-u,2);g.strokeStyle=C.accCss;g.lineWidth=.06*M;g.beginPath();g.arc(CXF,HOOP_PY,r*.72,0,TAU);g.stroke();}
      /* 连中:禁区里闪一下 ×N */
      if(S.streakT>=0&&S.streakT<1.2){any=true;
        const u=S.streakT/1.2,s=1+.45*(1-outExpo(u*3)),a=1-sm((u-.6)/.4),str=String(S.streak),hN=2.1*M;
        g.save();g.translate(CXF,HOOP_PY);g.rotate(S.phi);g.translate(0,3.3*M);g.scale(s,s*1.5);
        g.globalAlpha=a*.6;digits(g,str,hN*1.1,1,"#fff","stroke",1.6);
        g.globalAlpha=a;digits(g,str,hN,clamp(u*4,0,1),C.accCss,"fill");
        /* 乘号 */
        const xo=-(str.length*hN*.64+(str.length-1)*hN*.17)/2-.5*M;
        g.globalAlpha=a;g.strokeStyle="#fff";g.lineWidth=.16*M;g.lineCap="round";g.beginPath();
        g.moveTo(xo-.3*M,-.3*M);g.lineTo(xo+.3*M,.3*M);g.moveTo(xo+.3*M,-.3*M);g.lineTo(xo-.3*M,.3*M);g.stroke();
        g.restore();}
      /* 关键球:场地线整组亮一下 + 地板闪 */
      if(S.burst>=0){const u=S.burst/BURST;if(u>.13){any=true;const k=Math.pow(1-(u-.13)/.87,2.4);
        g.globalAlpha=.38*k;g.fillStyle=C.accCss;g.fillRect(0,0,FW,FH);g.globalAlpha=.4*k*k;g.fillStyle="#fff";g.fillRect(0,0,FW,FH);
        traceLines(g,1,Math.min(1,k*1.6));}}
    }
    g.globalAlpha=1;
    floor.visible=any;if(any)ftex.needsUpdate=true;
  }
  function update(t){
    if(!S.built){if(!active())return;build();syncStar();}
    const dt=clamp(t-S.t,0,.1);S.t=t;
    const live=active();
    if(!live){for(const R of rings)R.mesh.visible=false;floor.visible=false;if(S.dim!==1&&S.base!=null){S.dim=1;renderer.toneMappingExposure=S.base;S.wrote=false;}S.ent=-1;S.burst=-1;S.pulses.length=0;return;}
    for(const p of S.pulses)p.t+=dt;
    while(S.pulses.length&&S.pulses[0].t>PULSE+.3)S.pulses.shift();
    if(S.burst>=0){S.burst+=dt;if(S.burst>BURST)S.burst=-1;}
    if(S.streakT>=0){S.streakT+=dt;if(S.streakT>1.1)S.streakT=-1;}
    /* 进入比赛(从菜单/过场进到可投篮状态)时自动播一次登场;玩家一按蓄力就立刻收场,不挡第一投 */
    if(typeof G!=="undefined"){
      const st=G.state,play=!!PLAY[st];
      if(play&&!S.wasPlay&&st!=="lastshot"&&t-S.lastEnt>25){syncStar();S.ent=0;S.lastEnt=t;S.pulses.length=0;}
      S.wasPlay=play;
      if(S.ent>=0&&S.ent<3.75&&G.charging)S.ent=3.75;
    }
    if(S.ent>=0){S.ent+=dt;if(S.ent>ENT_DUR)S.ent=-1;}
    S.heat+=(S.heatT-S.heat)*(1-Math.exp(-(S.heatT>S.heat?3:1.6)*dt));
    /* 场灯:登场压到很暗;关键球先一黑再回弹;蓄力时略微压暗,视线收向篮筐 */
    let dim=1;
    if(typeof G!=="undefined"&&G.charging)dim=.93;
    if(S.ent>=0){const e=S.ent;dim=1-.72*sm(e/.45)*(1-sm((e-3.8)/.7));}
    if(S.burst>=0){const u=S.burst/BURST;dim=u<.13?.3:1+.16*Math.pow(1-(u-.13)/.87,2);}
    const rate=S.burst>=0?40:(S.ent>=0?30:7);
    S.dim+=(dim-S.dim)*(1-Math.exp(-rate*dt));
    if(Math.abs(S.dim-1)<.002&&dim===1)S.dim=1;
    /* 曝光:不压暗时不写,并把当前值记成基准(别的系统改了曝光也不会被这里盖回去) */
    if(S.dim===1||S.base==null)S.base=renderer.toneMappingExposure/(S.wrote?S.wroteK:1);
    if(S.dim!==1){renderer.toneMappingExposure=S.base*S.dim;S.wrote=true;S.wroteK=S.dim;}
    else if(S.wrote){renderer.toneMappingExposure=S.base;S.wrote=false;}
    setRings();
    /* 地板画布只在有内容时重画,最多 30 帧/秒 */
    const need=S.ent>=0||S.pulses.length||S.streakT>=0||S.burst>=0;
    if(need){if(t-S.lastDraw>=1/31||S.ent>=0&&t-S.lastDraw>=1/61){S.lastDraw=t;drawFloor();}}
    else if(floor.visible){floor.visible=false;}
  }

  /* ---------- 挂接:球馆每帧更新 + 进球/失手结算 ---------- */
  if(ON){
    const ur=global.updUpperRibbon;
    if(typeof ur==="function")global.updUpperRibbon=function(t){const r=ur.apply(this,arguments);try{update(t);}catch(e){if(!S.err){S.err=String(e&&e.stack||e);console.warn("[motion-show]",S.err);}}return r;};
    const mb=global.madeBall,xb=global.missBall;
    if(typeof mb==="function")global.madeBall=function(b){const r=mb.apply(this,arguments);
      try{if(b&&!b.opp&&!b.silent){const n=(typeof G!=="undefined"&&G.streak)||0;
        fire("make",{streak:n,clutch:!!(b.bonus||(b.money&&n>=3)||(n>=5&&n%5===0)||(typeof G!=="undefined"&&G.mode==="lastshot"))});}}catch(e){}
      return r;};
    if(typeof xb==="function")global.missBall=function(){const r=xb.apply(this,arguments);try{fire("miss");}catch(e){}return r;};
  }
  global.AIBAShow=Object.freeze({fire,entrance:()=>fire("entrance"),update,canvas:()=>fg&&fg.canvas,
    state:()=>({on:ON,built:S.built,ent:S.ent,burst:S.burst,heat:+S.heat.toFixed(3),pulses:S.pulses.length,dim:+S.dim.toFixed(3),
      floor:!!(floor&&floor.visible),rings:rings.map(r=>r.mesh.visible),star:C.key,num:C.num,name:C.name,acc:C.accCss,err:S.err||null})});
})(window);
