/* ---------------- Motion Show:球馆动效层 ----------------
   两件事,同一套配色和节拍:
   1) 球星登场:挂在赛前介绍(热身演示)上 —— 一进演示全馆压暗、打一束追着表演者的聚光灯,半场地板变成 LED 屏(扫描线、号码砸下、名字擦入),
      灯带追光;演示结束前亮灯收场,所以倒计时开始时场馆已经全亮。
   2) 投篮阶段的配合:平时安静;命中后地板上一圈涟漪(每球都有);灯带的光波从篮筐后方缓缓向两侧扫开、逐层向上滚(间隔至少 3 秒,连中 3/6/9 球才再来一次,不密集);
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

  /* ---------- 配色与双人信息:主战球员 + 对手球员 ---------- */
  const C={
    acc:new THREE.Color(0xfdb927),sec:new THREE.Color(0x552583),accCss:"#fdb927",secCss:"#552583",
    num:"8",name:"AIBA",title:"全明星射手",spec:"标准出手",arc:"标准弧线",sweet:"100%",rating:95,bars:[.85,.82,.88],
    hasOpp:false,oppAcc:new THREE.Color(0x00e5ff),oppSec:new THREE.Color(0x1d428a),oppAccCss:"#00e5ff",oppSecCss:"#1d428a",
    oppNum:"1",oppName:"RIVAL",oppTitle:"全明星挑战者",oppSpec:"极速出手",oppArc:"高弧快射",oppSweet:"100%",oppRating:94,oppBars:[.84,.80,.86]
  };
  const sat=c=>{const h={};c.getHSL(h);return h.s*(1-Math.abs(h.l*2-1));};
  function boostColor(colA,colB){
    const a=new THREE.Color(colA!=null?colA:0xfdb927),b=new THREE.Color(colB!=null?colB:0x552583);
    const [acc,sec]=sat(a)>=sat(b)?[a,b]:[b,a];
    const h={};acc.getHSL(h);
    if(h.l<.58||h.s<.7)acc.setHSL(h.h,Math.max(h.s,.82),Math.max(h.l,.62));
    return {acc,sec,accCss:"#"+acc.getHexString(),secCss:"#"+sec.getHexString()};
  }
  function extractStarMeta(s,fallbackNum,fallbackName){
    const prof=(typeof shotProfileFor==="function"&&s)?shotProfileFor(s):((global.AIBA_CONFIG&&global.AIBA_CONFIG.shotProfileFor&&s)?global.AIBA_CONFIG.shotProfileFor(s):{label:"标准出手",arcLabel:"标准弧线",speed:1,arc:1,window:1});
    const num=String(s&&s.num!=null?s.num:fallbackNum);
    const name=String(s&&s.n?s.n:fallbackName).replace(/^\s*\d+\s*号\s*[·•]\s*/,"").toUpperCase();
    const title=String(s&&s.t?s.t:"全明星射手 · 招牌三分");
    const rating=Math.max(80,Math.min(99,Number(s&&s.r)||92));
    const sp=clamp(((prof.speed||1)-.76)*1.85,.28,.96);
    const ar=clamp(((prof.arc||1)-.84)*2.4,.28,.96);
    const wn=clamp((prof.window||1)*.78,.28,.96);
    return {
      num,name,title,rating,
      spec:String(prof.label||"标准出手"),
      arc:String(prof.arcLabel||"标准弧线"),
      sweet:Math.round((prof.window||1)*100)+"%",
      bars:[sp,ar,wn]
    };
  }
  function syncStar(){
    const s=(typeof G!=="undefined"&&G.myStar)||null;
    const opp=(typeof G!=="undefined"&&(G.battleOpp||G.finalist||(G.opponents&&G.opponents[0])))||(typeof PREGAME!=="undefined"&&PREGAME.actors&&PREGAME.actors[1]&&PREGAME.actors[1].star)||null;
    const key=(s?(s.id||s.n)+":"+(s.col||[]).join(","):"-")+"|"+(opp?(opp.id||opp.n)+":"+(opp.col||[]).join(","):"-");
    if(key===C.key)return;C.key=key;
    const c1=boostColor(s&&s.col?s.col[0]:0xfdb927,s&&s.col?s.col[1]:0x552583);
    C.acc.copy(c1.acc);C.sec.copy(c1.sec);C.accCss=c1.accCss;C.secCss=c1.secCss;
    const m1=extractStarMeta(s,"8","AIBA");
    C.num=m1.num;C.name=m1.name;C.title=m1.title;C.rating=m1.rating;C.spec=m1.spec;C.arc=m1.arc;C.sweet=m1.sweet;C.bars=m1.bars;
    if(opp){
      C.hasOpp=true;
      const c2=boostColor(opp.col?opp.col[0]:0x00e5ff,opp.col?opp.col[1]:0x1d428a);
      /* 如果双方主色太接近,把对手主色往青/品红方向偏移,保证同场灯光对比鲜明 */
      if(Math.abs(c2.acc.r-c1.acc.r)+Math.abs(c2.acc.g-c1.acc.g)+Math.abs(c2.acc.b-c1.acc.b)<0.42){
        const h={};c2.acc.getHSL(h);c2.acc.setHSL((h.h+0.42)%1,0.9,0.64);c2.accCss="#"+c2.acc.getHexString();
      }
      C.oppAcc.copy(c2.acc);C.oppSec.copy(c2.sec);C.oppAccCss=c2.accCss;C.oppSecCss=c2.secCss;
      const m2=extractStarMeta(opp,"1","CHALLENGER");
      C.oppNum=m2.num;C.oppName=m2.name;C.oppTitle=m2.title;C.oppRating=m2.rating;C.oppSpec=m2.spec;C.oppArc=m2.arc;C.oppSweet=m2.sweet;C.oppBars=m2.bars;
    }else{
      C.hasOpp=false;
    }
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

  /* ---------- 地板:半场一张画布(移动端自适应采样率 + 空闲零上传 + 错峰刷新) ---------- */
  const IS_MOBILE=(typeof matchMedia==="function"&&matchMedia("(pointer:coarse)").matches)||((typeof navigator!=="undefined"&&navigator.maxTouchPoints>0));
  const FK=IS_MOBILE?1.0:1.5;                                  // 移动端 1.0x (544×512) 省 56% 纹理上传带宽,桌面端保持 1.5x
  const FLOOR_MIN_DT=IS_MOBILE?(1/31):(1/61);                  // 移动端地板画布 30fps 重绘(3D光束/曝光仍为 60fps),桌面端 60fps
  const FW=544,FH=512;                                         // 15.24m × 14.325m,约 35.7 像素/米;画布上方 = 篮筐一侧
  const PX=FW/COURT.width,HOOP_PY=(COURT.nearHoopZ-COURT.nearBaseline)*PX,CXF=FW/2;
  let floor=null,floorFar=null,fg=null,ftex=null,floorDirty=false;
  function makeFloor(){
    const cv=document.createElement("canvas");cv.width=Math.round(FW*FK);cv.height=Math.round(FH*FK);fg=cv.getContext("2d");
    ftex=new THREE.CanvasTexture(cv);ftex.encoding=THREE.sRGBEncoding;ftex.generateMipmaps=false;ftex.minFilter=THREE.LinearFilter;
    const len=COURT.midZ-COURT.nearBaseline;
    floor=new THREE.Mesh(new THREE.PlaneGeometry(COURT.width,len),new THREE.MeshBasicMaterial({map:ftex,transparent:true,depthWrite:false,
      toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,.05,COURT.nearBaseline+len/2);
    floor.name="motionShowFloor";floor.visible=false;floor.renderOrder=20;
    indoorRoot.add(floor);
    /* 另一半场:同一张画布转 180° 铺过去(从对面看台看是正的)。只在登场 / 关键球这种"全场秀"里亮,
       平时的命中涟漪只留在进攻半场,不然每进一球远端也闪,太吵 */
    floorFar=new THREE.Mesh(floor.geometry,floor.material);
    floorFar.rotation.x=-Math.PI/2;floorFar.rotation.z=Math.PI;floorFar.position.set(0,.05,COURT.midZ+len/2);
    floorFar.name="motionShowFloorFar";floorFar.visible=false;floorFar.renderOrder=20;
    indoorRoot.add(floorFar);
  }

  /* ---------- 全馆光束:十束从顶棚打下来的摇头聚光灯(加色半透明圆锥 + 地板光斑),围绕半场与两名球员扫动 ---------- */
  const beams=[];let beamGeo=null;
  function makeBeams(){
    beamGeo=new THREE.CylinderGeometry(.12,.92,1,20,4,true);beamGeo.translate(0,-.5,0);          // 顶点在原点,朝 -Y 张开,长度 1
    const pos=beamGeo.attributes.position,col=new Float32Array(pos.count*3);
    /* 光柱顶部清晰、向地面柔和衰减(0.16..0.62),避免多束体积光在低机位叠加过曝 */
    for(let i=0;i<pos.count;i++){const k=.16+.46*Math.pow(clamp(1+pos.getY(i),0,1),1.3);col[i*3]=col[i*3+1]=col[i*3+2]=k;}
    beamGeo.setAttribute("color",new THREE.BufferAttribute(col,3));
    const N=10,cz=-3.2;
    for(let i=0;i<N;i++){
      const a=i/N*TAU+.31,mat=new THREE.MeshBasicMaterial({vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,opacity:0,
        depthWrite:false,toneMapped:false,side:THREE.DoubleSide,fog:false});
      const m=new THREE.Mesh(beamGeo,mat);m.name="motionShowBeam";m.visible=false;m.frustumCulled=false;m.renderOrder=6;
      /* 挂在主半场上空(x: ±6.5m, y: 13.8m, z: -3.2±5.8m),确保始终在热身与比赛镜头视野内 */
      m.position.set(Math.cos(a)*6.5,13.8,cz+Math.sin(a)*5.8);
      indoorRoot.add(m);
      beams.push({m,mat,a,idx:i,ph:i*2.399,sp:.72+((i*7)%5)*.11,white:i%4===1,opp:i%2===1,hitX:0,hitZ:-3,active:false,css:"#ffffff"});
    }
  }
  const _bd=new THREE.Vector3(),_bu=new THREE.Vector3(0,-1,0),_ba=new THREE.Vector3();
  /* k:整体亮度 0..1;gather:0=各扫各的,1=全部聚到表演者身上;retract:0..1 亮灯瞬间向上快速收回顶棚 */
  function setBeams(k,gather,retract){
    retract=clamp(retract||0,0,1);
    if(k<.01||retract>=.995){
      if(!S.beamsOff){
        for(const B of beams){B.m.visible=false;B.active=false;}
        S.beamsOff=true;
      }
      return;
    }
    S.beamsOff=false;
    const cz=-2.6;
    const spec=S.special;
    for(const B of beams){
      const speedMul=spec?(spec.kind==="super10"?2.2:1.65):1;
      const t=S.t*B.sp*speedMul+B.ph;
      const R=2.2+4.4*(.5+.5*Math.sin(t*.78+B.ph));
      const ang=B.a+Math.sin(t*.92)*1.15;
      _ba.set(Math.cos(ang)*R,0,clamp(cz+Math.sin(ang)*R*.95,COURT.nearBaseline+.8,COURT.midZ-.5));
      if(gather>0){
        const tx=S.sp?S.sp.x:0,tz=S.sp?S.sp.z:-1.2;
        const spread=(1-gather)*1.35;
        _ba.lerp(_bd.set(tx+Math.cos(B.a)*spread,.35*gather,tz+Math.sin(B.a)*spread),gather);
      }
      B.hitX=_ba.x;B.hitZ=_ba.z;B.active=retract<.75;
      _bd.copy(_ba).sub(B.m.position);
      const fullL=_bd.length();_bd.multiplyScalar(1/Math.max(1e-4,fullL));
      /* 亮灯收回动作:retract 0→1 时光束从地面猛然往上抽回顶棚灯架 */
      const L=fullL*(1-.92*retract*retract);
      B.m.quaternion.setFromUnitVectors(_bu,_bd);
      const w=(.78+fullL*.045)*(1-.32*gather)*(1-.45*retract);
      B.m.scale.set(w,L,w);
      /* 十束加色光锥向同一焦点收拢(gather→1)时自动压低单束不透明度,防止十倍叠加把主角烧成纯白过曝 */
      B.mat.opacity=clamp(k*(B.white?.15:.23)*(1-.42*gather)*(1-retract),0,.32);
      if(spec&&spec.kind==="super10"){
        if(B.idx%3===0){B.mat.color.setHex(0xffd740);B.css="#ffd740";}
        else if(B.idx%3===1){B.mat.color.setHex(0x00f0ff);B.css="#00f0ff";}
        else{B.mat.color.setHex(0xff45b8);B.css="#ff45b8";}
      }else if(spec&&spec.kind==="deep5"){
        if(B.idx%2===0){B.mat.color.setHex(0x00eaff);B.css="#00eaff";}
        else{B.mat.color.copy(C.acc);B.css=C.accCss;}
      }else if(B.white){
        B.mat.color.setRGB(1,1,1);B.css="#ffffff";
      }else if(B.opp&&C.hasOpp){
        B.mat.color.copy(C.oppAcc);B.css=C.oppAccCss;
      }else{
        B.mat.color.copy(C.acc);B.css=C.accCss;
      }
      B.m.visible=true;
    }
  }

  /* ---------- 烟花(Pyro)与干冰气柱(Dry Ice):从黑到亮的仪式高潮 + 5分/10分进球狂欢 ---------- */
  function makeSoftParticleTex(soft){
    const c=document.createElement("canvas");c.width=c.height=64;
    const g=c.getContext("2d"),grad=g.createRadialGradient(32,32,0,32,32,32);
    if(soft){
      grad.addColorStop(0,"rgba(255,255,255,0.58)");
      grad.addColorStop(0.45,"rgba(240,248,255,0.24)");
      grad.addColorStop(1,"rgba(220,240,255,0)");
    }else{
      grad.addColorStop(0,"rgba(255,255,255,1)");
      grad.addColorStop(0.35,"rgba(255,245,210,0.6)");
      grad.addColorStop(1,"rgba(255,220,160,0)");
    }
    g.fillStyle=grad;g.fillRect(0,0,64,64);
    const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;return tex;
  }
  let pyroPoints=null,pyroData=null,dryIcePoints=null,dryIceData=null;
  function makeAtmosphereFX(){
    /* 1. 干冰气柱粒子:沿底线与边线喷涌的柔和冷雾（使用径向羽化贴图，告别像素方块） */
    const mistTex=makeSoftParticleTex(true),sparkTex=makeSoftParticleTex(false);
    const DN=120,dPos=new Float32Array(DN*3),dCol=new Float32Array(DN*3);
    dryIceData=[];
    const vents=[[-5.2,-8.9],[-2.6,-8.9],[2.6,-8.9],[5.2,-8.9],[-6.8,-5.2],[6.8,-5.2],[-6.8,-1.5],[6.8,-1.5]];
    for(let i=0;i<DN;i++){
      const v=vents[i%vents.length];
      dryIceData.push({x:v[0],y:0,z:v[1],vx:0,vy:0,vz:0,age:99,life:1.8,vent:v});
      dCol[i*3]=.82;dCol[i*3+1]=.93;dCol[i*3+2]=1.0;
    }
    const dGeo=new THREE.BufferGeometry();
    dGeo.setAttribute("position",new THREE.BufferAttribute(dPos,3));
    dGeo.setAttribute("color",new THREE.BufferAttribute(dCol,3));
    dryIcePoints=new THREE.Points(dGeo,new THREE.PointsMaterial({size:1.15,map:mistTex,sizeAttenuation:true,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false,toneMapped:false,fog:false}));
    dryIcePoints.name="motionShowDryIce";dryIcePoints.visible=false;dryIcePoints.frustumCulled=false;dryIcePoints.renderOrder=7;
    indoorRoot.add(dryIcePoints);

    /* 2. 赛场烟花冷焰火粒子:篮架两侧与半场四角冲天金银花火 */
    const PN=160,pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*3);
    pyroData=[];
    const canons=[[-3.4,-8.4],[-1.6,-8.4],[1.6,-8.4],[3.4,-8.4],[-5.8,-3.5],[5.8,-3.5]];
    for(let i=0;i<PN;i++){
      const c=canons[i%canons.length];
      pyroData.push({x:c[0],y:0,z:c[1],vx:0,vy:0,vz:0,age:99,life:1.4,canon:c,gold:i%3!==0});
    }
    const pGeo=new THREE.BufferGeometry();
    pGeo.setAttribute("position",new THREE.BufferAttribute(pPos,3));
    pGeo.setAttribute("color",new THREE.BufferAttribute(pCol,3));
    pyroPoints=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.28,map:sparkTex,sizeAttenuation:true,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,opacity:.62,depthWrite:false,toneMapped:false,fog:false}));
    pyroPoints.name="motionShowPyro";pyroPoints.visible=false;pyroPoints.frustumCulled=false;pyroPoints.renderOrder=8;
    indoorRoot.add(pyroPoints);
  }
  function triggerAtmosphereBurst(power,mode){
    if(!pyroData||!dryIceData)return;
    const pCol=pyroPoints.geometry.attributes.color.array;
    for(let i=0;i<pyroData.length;i++){
      const p=pyroData[i],c=p.canon;
      p.x=c[0]+(Math.random()-.5)*.28;p.y=.1;p.z=c[1]+(Math.random()-.5)*.28;
      const spread=(.6+Math.random()*1.4)*power;
      const ang=Math.random()*TAU;
      p.vx=Math.cos(ang)*spread;
      p.vy=(5.2+Math.random()*5.6)*power;
      p.vz=Math.sin(ang)*spread+.6;
      p.age=-Math.random()*.28;
      p.life=.95+Math.random()*.85;
      if(mode==="deep5"){
        pCol[i*3]=i%2?0.1:1;pCol[i*3+1]=i%2?0.95:1;pCol[i*3+2]=1;
      }else{
        pCol[i*3]=1;pCol[i*3+1]=p.gold?.84:.96;pCol[i*3+2]=p.gold?.28:.88;
      }
    }
    pyroPoints.geometry.attributes.color.needsUpdate=true;
    pyroPoints.visible=true;
    for(let i=0;i<dryIceData.length;i++){
      const d=dryIceData[i],v=d.vent;
      d.x=v[0]+(Math.random()-.5)*.45;d.y=.08;d.z=v[1]+(Math.random()-.5)*.45;
      const inwardX=-Math.sign(v[0]||1)*(.8+Math.random()*1.5)*power;
      const inwardZ=(v[1]<-7?1.6:.4)*(0.7+Math.random())*power;
      d.vx=inwardX+(Math.random()-.5)*.7;
      d.vy=(.95+Math.random()*1.65)*power;
      d.vz=inwardZ+(Math.random()-.5)*.7;
      d.age=-Math.random()*.35;
      d.life=1.25+Math.random()*1.05;
    }
    dryIcePoints.visible=true;
  }
  function updAtmosphereFX(dt){
    if(pyroPoints&&pyroPoints.visible){
      const pos=pyroPoints.geometry.attributes.position.array;
      let anyP=false;
      for(let i=0;i<pyroData.length;i++){
        const p=pyroData[i];p.age+=dt;
        if(p.age<0){pos[i*3]=p.x;pos[i*3+1]=-10;pos[i*3+2]=p.z;anyP=true;continue;}
        if(p.age<p.life){
          anyP=true;
          p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
          p.vy-=9.2*dt;p.vx*=(1-1.2*dt);p.vz*=(1-1.2*dt);
          if(p.y<.04){p.y=.04;p.vy*=-.28;}
          pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;
        }else{
          pos[i*3+1]=-10;
        }
      }
      pyroPoints.geometry.attributes.position.needsUpdate=true;
      if(!anyP)pyroPoints.visible=false;
    }
    if(dryIcePoints&&dryIcePoints.visible){
      const pos=dryIcePoints.geometry.attributes.position.array;
      let anyD=false,maxAlpha=0;
      for(let i=0;i<dryIceData.length;i++){
        const d=dryIceData[i];d.age+=dt;
        if(d.age<0){pos[i*3]=d.x;pos[i*3+1]=-10;pos[i*3+2]=d.z;anyD=true;continue;}
        if(d.age<d.life){
          anyD=true;
          const u=d.age/d.life;
          maxAlpha=Math.max(maxAlpha,Math.sin(u*Math.PI)*.22);
          d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
          d.vy*=(1-1.8*dt);d.vx*=(1-.9*dt);d.vz*=(1-.9*dt);
          pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;
        }else{
          pos[i*3+1]=-10;
        }
      }
      dryIcePoints.material.opacity=maxAlpha;
      dryIcePoints.geometry.attributes.position.needsUpdate=true;
      if(!anyD)dryIcePoints.visible=false;
    }
  }
  function triggerClimaxCelebration(power,mode){
    triggerAtmosphereBurst(power||1,mode||"climax");
    try{
      if(typeof G!=="undefined")G.cheer=Math.max(G.cheer||0,1.25);
      if(typeof triggerStreetCrowdReaction==="function")triggerStreetCrowdReaction("streak",3);
      if(typeof crowdSwell==="function")crowdSwell(.26,2.1);
      if(typeof broadcastSting==="function")broadcastSting("score");
      if(typeof sSwish==="function"&&mode==="climax")sSwish();
    }catch(e){}
  }

  /* ---------- 看台星海:黑场时观众举起的手机灯,一圈一圈跟着追光亮起来 ---------- */
  let stars=null,starAng=null,starPh=null;
  function makeStars(){
    try{
      if(typeof crowd==="undefined"||!crowd.groups||!crowd.groups.length)return;
      const pts=[];let n=0;
      for(const g of crowd.groups)for(const s of g.seats){if((n++)%7===0&&Number.isFinite(s.x)&&Number.isFinite(s.z))pts.push(s);}
      if(!pts.length)return;
      const M=Math.min(pts.length,1100),pos=new Float32Array(M*3),col=new Float32Array(M*3);starAng=new Float32Array(M);starPh=new Float32Array(M);
      for(let i=0;i<M;i++){const s=pts[Math.floor(i*pts.length/M)];pos[i*3]=s.x;pos[i*3+1]=(s.y||0)+1.05;pos[i*3+2]=s.z;
        starAng[i]=Math.atan2(s.z-COURT.midZ,s.x);starPh[i]=(i*12.9898)%TAU;}
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
      stars=new THREE.Points(geo,new THREE.PointsMaterial({size:.5,sizeAttenuation:true,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,
        depthWrite:false,toneMapped:false,fog:false}));
      stars.name="motionShowStars";stars.visible=false;stars.frustumCulled=false;stars.renderOrder=4;
      indoorRoot.add(stars);
    }catch(e){stars=null;}
  }
  function setStars(k){
    if(!stars){return;}
    if(k<.01){stars.visible=false;return;}
    const col=stars.geometry.attributes.color,arr=col.array,n=starAng.length,sweep=S.t*1.1;
    for(let i=0;i<n;i++){
      const tw=Math.pow(.5+.5*Math.sin(S.t*(2.2+(i%5)*.5)+starPh[i]),3);
      const wv=.35+.65*Math.pow(.5+.5*Math.cos(starAng[i]-sweep),2);                       // 一道亮带绕着看台转
      const v=k*tw*wv,wh=(i%4===0)?1:0;
      arr[i*3]=v*(wh?1:.55+.45*C.acc.r);arr[i*3+1]=v*(wh?.95:.55+.45*C.acc.g);arr[i*3+2]=v*(wh?.85:.55+.45*C.acc.b);
    }
    col.needsUpdate=true;stars.visible=true;
  }

  /* ---------- 追光:一盏真聚光灯(一直在场景里、平时强度 0,所以不会触发着色器重编译) ---------- */
  let spot=null,spotTarget=null;
  function makeSpot(){
    if(typeof scene==="undefined")return;
    spot=new THREE.SpotLight(0xffffff,0,34,.2,.6,1.0);spot.castShadow=false;spot.name="motionShowSpot";
    spotTarget=new THREE.Object3D();spot.target=spotTarget;
    scene.add(spot);scene.add(spotTarget);
  }
  const _sp=new THREE.Vector3();
  function spotFocus(){
    try{
      if(typeof PREGAME==="undefined"||!PREGAME.on)return null;
      const seg=PREGAME.shots[PREGAME.idx];if(!seg)return null;
      const list=seg.group?PREGAME.actors:[seg.actor];_sp.set(0,0,0);
      list.forEach(a=>_sp.add(a.guy.g.position));return _sp.multiplyScalar(1/Math.max(1,list.length));
    }catch(e){return null;}
  }

  /* ---------- 状态 ---------- */
  const S={entDur:4.6,wasPre:false,climaxFired:false,dryIceWarmFired:false,special:null,ripples:[],lastRing:-99,sp:null,spK:0,t:0,heat:0,heatT:0,pulses:[],burst:-1,ent:-1,dim:1,base:null,streak:0,streakT:-1,lastDraw:0,built:false,wasPlay:false,lastEnt:-99,wrote:false,wroteK:1};
  const ENT_DUR=4.6,PULSE=.85,RING_PULSE=2.4,RING_LAG=[0,.42,.84,1.26],BURST=2.2,PLAY={round:1,tiebreak:1,battle:1,rackrush:1,lastshot:1};
  function build(){
    if(S.built)return;S.built=true;
    makeRing(11.8,19.2,.52,3.84,.54,28,RING_LAG[0]);
    makeRing(27.05,34.15,8.52,5.72,.44,36,RING_LAG[1]);
    makeRing(27.10,34.20,12.82,5.74,.34,36,RING_LAG[2]);
    makeRing(27.15,34.25,14.82,5.76,.48,36,RING_LAG[3]);
    makeFloor();
    makeSpot();
    makeBeams();
    makeStars();
    makeAtmosphereFX();
  }
  const active=()=>ON&&indoorRoot.visible!==false&&(!indoorRoot.parent||indoorRoot.parent.visible!==false);

  /* ---------- 事件 ---------- */
  function fire(kind,info){
    if(!ON)return false;
    syncStar();
    if(kind==="make"||kind==="deep5"||kind==="super10"){
      const isSuper=kind==="super10"||!!(info&&(info.super||info.val===10));
      const isDeep=!isSuper&&(kind==="deep5"||!!(info&&(info.deep||info.val===5)));
      if(isSuper){
        /* 10 分超远球:全场特级灯光秀(十束聚光灯 + 四层全彩金流灯带 + 全场地板 JACKPOT 动效 + 烟花干冰齐射,不叠加过曝白闪) */
        S.special={kind:"super10",t:0,dur:2.85,title:"10PT SUPER JACKPOT",sub:"LOGO ULTRA RANGE · +10 PTS"};
        S.burst=-1;
        S.pulses.length=0;
        S.pulses.push({t:0,big:true,mode:"super10"},{t:-.36,big:false,mode:"super10"});
        S.ripples.push({t:0,mode:"super10"},{t:-.22,mode:"super10"});
        S.lastRing=S.t;
        triggerClimaxCelebration(1.0,"super10");
        return true;
      }
      if(isDeep){
        /* 5 分彩球点:专属炫彩电光灯光秀(十束聚光灯扫射 + 双重电青脉冲灯带 + 地板 5PT DEEP 投影 + 烟花干冰) */
        S.special={kind:"deep5",t:0,dur:1.95,title:"5PT DEEP RANGE",sub:"DEEP MONEY SPOT · +5 PTS"};
        S.burst=-1;
        S.pulses.length=0;
        S.pulses.push({t:0,big:true,mode:"deep5"});
        S.ripples.push({t:0,mode:"deep5"},{t:-.18,mode:"deep5"});
        S.lastRing=S.t;
        triggerClimaxCelebration(0.76,"deep5");
        return true;
      }
      S.ripples.push({t:0});if(S.ripples.length>4)S.ripples.shift();        // 地板涟漪:每球都有
      const n=(info&&info.streak)||0;
      /* 灯带光波慢、层次多,所以不能密:距上一次至少 3 秒;连中 3/6/9… 球(或关键球)才在更短间隔里再来一次 */
      const gap=S.t-S.lastRing,mile=n>=3&&n%3===0;
      if(gap>3.2||(mile&&gap>1.4)||(info&&info.clutch)){S.pulses.length=0;S.pulses.push({t:0,big:mile||!!(info&&info.clutch)});S.lastRing=S.t;}
      S.heatT=clamp((n-1)/7,0,1);
      if(n>=3){S.streak=n;S.streakT=0;}
      if(info&&info.clutch)S.burst=0;
    }else if(kind==="miss"){S.heatT=0;}
    else if(kind==="clutch"){S.burst=0;S.pulses.length=0;S.pulses.push({t:0,big:true});S.lastRing=S.t;S.ripples.push({t:0});}
    else if(kind==="entrance"){
      S.ent=0;S.lastEnt=S.t;S.climaxFired=false;S.dryIceWarmFired=false;
      S.pulses.length=0;S.ripples.length=0;S.burst=-1;S.entDur=Math.max(4.6,(info&&info.dur)||4.6);
    }
    else return false;
    return true;
  }

  /* ---------- 每帧 ---------- */
  function setRings(){
    const e=S.ent,b=S.burst,spec=S.special;
    if(S.heat<=.01&&!S.pulses.length&&!spec&&b<0&&e<0){
      if(!S.ringsOff){
        for(const R of rings)R.mesh.visible=false;
        S.ringsOff=true;
      }
      return false;
    }
    S.ringsOff=false;
    let any=false;
    for(const R of rings){
      let on=false;
      for(let i=0;i<R.SEG;i++){
        const d=R.ang[i];let I=0,W=0,cMode=0;
        /* 连中热度:篮筐后方一段持续发亮,越热越宽越亮 */
        if(S.heat>.01)I+=S.heat*.44*Math.exp(-Math.pow(d/(.5+S.heat*.9),2));
        /* 命中光波:从篮筐后方向两侧扫开 */
        for(const p of S.pulses){const u=(p.t-R.lag)/RING_PULSE;if(u<=0||u>=1)continue;
          const front=(1-Math.pow(1-u,1.6))*Math.PI*1.04,amp=(p.big?.92:.72)*sm(u*6)*Math.pow(1-u,1.2);
          I+=amp*Math.exp(-Math.pow((d-front)/.5,2));                                   // 光波头:宽而柔
          if(d<front)I+=amp*.28*Math.exp(-(front-d)/.95);                               // 身后拖一条慢慢暗下去的尾迹
          if(p.mode==="super10")cMode=2;else if(p.mode==="deep5"&&cMode<1)cMode=1;
        }
        /* 5分 / 10分 专属灯带流光狂欢(控制高光饱和度,避免加色冲白) */
        if(spec){
          const su=clamp(spec.t/spec.dur,0,1),sk=Math.sin(su*Math.PI);
          if(spec.kind==="super10"){
            const wave=.5+.5*Math.sin(i/R.SEG*TAU*3-S.t*9.5+R.lag*2);
            I+=.95*sk*(.45+.55*wave);
            W+=.18*sk*Math.pow(wave,3);
            cMode=2;
          }else if(spec.kind==="deep5"){
            const wave=.5+.5*Math.cos(i/R.SEG*TAU*2-S.t*7.2+R.lag*1.6);
            I+=.82*sk*(.4+.6*wave);
            W+=.14*sk*Math.pow(wave,2);
            if(cMode<1)cMode=1;
          }
        }
        /* 关键球:灯带流光脉冲(严格限制白光分量 W,防止灯带变成刺眼白条) */
        if(b>=0&&!spec){const u=b/BURST;if(u>.13){const k=Math.pow(1-(u-.13)/.87,2.2);I+=.88*k;W+=.20*k*k;}}
        /* 登场:先全灭,追光绕场,高潮收回时全场齐闪流光,最后柔和收掉 */
        if(e>=0){
          const left=S.entDur-e;
          if(e>.6&&left>.2){
            const a0=e*2.6,dd=Math.abs(((i/R.SEG*TAU-a0)%TAU+TAU)%TAU-Math.PI);
            I+=.75*Math.exp(-Math.pow((Math.PI-dd)/.48,2))*sm(left/.55);
          }
          if(e>1.0){const k=Math.pow(clamp(1-(e-1.0)/.9,0,1),2);I+=.82*k;W+=.18*k*k;}
          if(left<=1.35&&left>0){
            const ck=Math.sin(clamp((1.35-left)/1.35,0,1)*Math.PI);
            I+=.88*ck;W+=.22*ck*ck;
          }
        }
        I=Math.min(I,1.02);W=Math.min(W,0.22);
        let cr=C.acc.r,cg=C.acc.g,cb=C.acc.b;
        if(cMode===2){
          const h=((i/R.SEG)+S.t*.65)%1;
          cr=h<.5?1:.2;cg=h<.5?.82:.95;cb=h<.5?.18:1;
        }else if(cMode===1){
          cr=.08;cg=.92;cb=1;
        }else if(e>=0&&C.hasOpp&&(i%2===1)){
          cr=C.oppAcc.r;cg=C.oppAcc.g;cb=C.oppAcc.b;
        }
        const r=cr*I+W,g=cg*I+W,bl=cb*I+W,o=i*18;
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
    const Vv=(cx,cy)=>{g.moveTo(cx,cy-Lv/2);g.lineTo(cx+k,cy-Lv/2+k);lineTo(g,cx+k,cy+Lv/2-k);g.lineTo(cx,cy+Lv/2);g.lineTo(cx-k,cy+Lv/2-k);g.lineTo(cx-k,cy-Lv/2+k);g.closePath();};
    const q=(h/2-k)/2;
    if(name==="a")H(-h/2+k);else if(name==="g")H(0);else if(name==="d")H(h/2-k);
    else if(name==="f")Vv(-hw,-q);else if(name==="b")Vv(hw,-q);else if(name==="e")Vv(-hw,q);else if(name==="c")Vv(hw,q);
  }
  function lineTo(g,x,y){g.lineTo(x,y);}
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
  function traceLines(g,pr,alpha,strokeCol){
    if(pr<=0||alpha<=0)return;
    g.save();g.translate(CXF,HOOP_PY);g.lineJoin="round";g.lineCap="round";
    for(const pass of [[7,.2],[2.2,.95]]){
      g.lineWidth=pass[0];g.globalAlpha=alpha*pass[1];g.strokeStyle=pass[0]>3?(strokeCol||C.accCss):"#fff";
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
  /* 绘制单人或双人 Motion Graph 信息卡(投射在地板上) */
  function drawMotionCard(g,M,meta,xCenter,yCenter,scaleX,prog,alpha){
    if(alpha<=.01||prog<=.01)return;
    const k=outExpo(prog);
    g.save();
    g.translate(xCenter,yCenter);
    g.scale(scaleX*(.86+.14*k),(.86+.14*k)*1.38);
    g.globalAlpha=alpha;
    const bw=3.2*M,bh=2.85*M;
    /* 半透明科技感底板 + 斜切边框 */
    g.fillStyle="rgba(6,10,22,0.72)";
    g.strokeStyle=meta.css;
    g.lineWidth=.065*M;
    g.beginPath();
    g.moveTo(-bw/2+.22*M,-bh/2);
    g.lineTo(bw/2,-bh/2);
    g.lineTo(bw/2-.22*M,bh/2);
    g.lineTo(-bw/2,bh/2);
    g.closePath();
    g.fill();
    g.stroke();
    /* 顶部色带标签:角色定位 / 综合评分 */
    g.fillStyle=meta.css;
    g.fillRect(-bw/2+.18*M,-bh/2+.12*M,(bw-.36*M)*k,.34*M);
    text(g,"OVR "+meta.rating+" · "+meta.spec,0,-bh/2+.29*M,.21*M,{plain:true,color:"#050811"});
    /* 号码 + 球员姓名 */
    if(meta.num){
      g.save();
      g.translate(-bw*.29,-.25*M);
      digits(g,meta.num,1.05*M,clamp(prog*1.3,0,1),meta.css,"fill");
      g.restore();
    }
    text(g,meta.name,bw*.11,-.42*M,.34*M,{color:"#ffffff"});
    text(g,meta.arc+" · 甜区 "+meta.sweet,bw*.11,-.04*M,.185*M,{plain:true,color:meta.css});
    /* 三条动态特长能量柱(Motion Graph Bars: 出手速度 / 弹道弧线 / 甜区窗口) */
    const labels=["RELEASE","ARC","SWEET"];
    for(let i=0;i<3;i++){
      const by=.34*M+i*.32*M,barW=(bw-.75*M),fillW=barW*clamp((meta.bars[i]||.8)*outExpo(clamp((prog-.12*i)/.7,0,1)),0,1);
      g.fillStyle="rgba(255,255,255,0.68)";
      g.font="800 "+Math.round(.15*M)+"px "+FONT;g.textAlign="left";g.textBaseline="middle";
      g.fillText(labels[i],-bw/2+.22*M,by);
      const bx=-bw/2+.98*M,bRestW=bw-1.22*M;
      g.fillStyle="rgba(255,255,255,0.14)";
      g.fillRect(bx,by-.07*M,bRestW,.14*M);
      g.fillStyle=meta.css;
      g.fillRect(bx,by-.07*M,bRestW*clamp((meta.bars[i]||.8)*k,0,1),.14*M);
    }
    g.restore();
  }
  function drawFloor(){
    const g=fg,e=S.ent,spec=S.special;let any=false;
    g.setTransform(FK,0,0,FK,0,0);g.globalAlpha=1;g.globalCompositeOperation="source-over";g.clearRect(0,0,FW,FH);
    const tgt=camAngle();
    if(S.phi==null||e<0&&S.streakT<0&&!spec)S.phi=tgt;else S.phi+=(tgt-S.phi)*.08;
    const M=PX;
    if(e>=0){
      any=true;
      const left=S.entDur-e;
      const inK=sm(e/.55);
      /* 收场丝滑过渡:不用硬切矩形 clip(避免一条条黑带跳变),改用径向能量收缩 + 丝滑透明度渐变 */
      const retractK=sm((1.35-left)/1.15);
      const fadeAlpha=inK*(1-sm((1.15-left)/.95));
      if(fadeAlpha>.01){
        const bgGrad=g.createRadialGradient(CXF,HOOP_PY+4.2*M,.5*M,CXF,HOOP_PY+4.2*M,10.5*M);
        bgGrad.addColorStop(0,"rgba(4,7,16,"+(0.82*fadeAlpha).toFixed(3)+")");
        bgGrad.addColorStop(.72,"rgba(3,5,12,"+(0.68*fadeAlpha).toFixed(3)+")");
        bgGrad.addColorStop(1,"rgba(3,5,12,0)");
        g.fillStyle=bgGrad;g.fillRect(0,0,FW,FH);
      }
      /* 场地线动态勾勒 */
      traceLines(g,outExpo((e-.2)/.95),fadeAlpha*(e<1.6?1:.58),C.accCss);
      /* 十束聚光灯在地板上的实时光斑(用柔和队色光晕代替纯白中心,防止十束收拢时地板中心过曝发白) */
      for(const B of beams){
        if(!B.active)continue;
        const bx=CXF+B.hitX*M,by=(B.hitZ-COURT.nearBaseline)*M,br=(1.10-.35*retractK)*M;
        if(by<-br||by>FH+br)continue;
        const bgr=g.createRadialGradient(bx,by,0,bx,by,br);
        bgr.addColorStop(0,B.css+"99");
        bgr.addColorStop(.45,B.css+"33");
        bgr.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=clamp(fadeAlpha*.28*(1-.5*retractK),0,.32);
        g.fillStyle=bgr;g.beginPath();g.arc(bx,by,br,0,TAU);g.fill();
      }
      g.save();g.translate(CXF,HOOP_PY);g.rotate(S.phi);
      /* 动态科技圆环(Motion Graph HUD Ring) */
      if(e>.4&&fadeAlpha>.02){
        const rHud=(3.6-.9*retractK)*M;
        g.save();g.translate(0,4.35*M);g.scale(1,1.35);
        g.strokeStyle=C.accCss;g.lineWidth=.05*M;g.globalAlpha=fadeAlpha*.55;
        g.beginPath();g.arc(0,0,rHud,e*1.4,e*1.4+Math.PI*1.35);g.stroke();
        if(C.hasOpp){
          g.strokeStyle=C.oppAccCss;
          g.beginPath();g.arc(0,0,rHud*.86,-e*1.6,-e*1.6+Math.PI*1.25);g.stroke();
        }
        g.restore();
      }
      /* 阶段 1 (0..3.4s): 主战球员大号数字 + 姓名 + 特长 Motion Graph */
      const p1SoloEnd=C.hasOpp?Math.min(3.4,S.entDur*.36):S.entDur-1.15;
      if(e>.65&&e<p1SoloEnd+.45){
        const a1=sm((e-.65)/.35)*(1-sm((e-p1SoloEnd)/.42))*fadeAlpha;
        const u=clamp((e-.65)/.55,0,1),s=1+.65*(1-outExpo(u)),hN=(C.num.length>1?2.3:2.6)*M;
        g.save();g.translate(0,3.25*M);g.scale(s,s*1.45);
        g.globalAlpha=.85*a1;digits(g,C.num||"8",hN*1.08,1,"#fff","stroke",1.6);
        g.globalAlpha=a1;digits(g,C.num||"8",hN,clamp(u*1.2,0,1),C.accCss,"fill");
        g.restore();
        drawMotionCard(g,M,{num:C.num,name:C.name,title:C.title,spec:C.spec,arc:C.arc,sweet:C.sweet,rating:C.rating,bars:C.bars,css:C.accCss},0,6.05*M,1.08,clamp((e-.95)/.75,0,1),a1);
      }
      /* 阶段 2 (3.4s..6.4s): 对手球员大号数字 + 姓名 + 特长 Motion Graph */
      const p2SoloEnd=Math.min(6.4,S.entDur*.66);
      if(C.hasOpp&&e>p1SoloEnd&&e<p2SoloEnd+.45){
        const a2=sm((e-p1SoloEnd)/.35)*(1-sm((e-p2SoloEnd)/.42))*fadeAlpha;
        const u=clamp((e-p1SoloEnd)/.55,0,1),s=1+.65*(1-outExpo(u)),hN=(C.oppNum.length>1?2.3:2.6)*M;
        g.save();g.translate(0,3.25*M);g.scale(s,s*1.45);
        g.globalAlpha=.85*a2;digits(g,C.oppNum||"1",hN*1.08,1,"#fff","stroke",1.6);
        g.globalAlpha=a2;digits(g,C.oppNum||"1",hN,clamp(u*1.2,0,1),C.oppAccCss,"fill");
        g.restore();
        drawMotionCard(g,M,{num:C.oppNum,name:C.oppName,title:C.oppTitle,spec:C.oppSpec,arc:C.oppArc,sweet:C.oppSweet,rating:C.oppRating,bars:C.oppBars,css:C.oppAccCss},0,6.05*M,1.08,clamp((e-p1SoloEnd-.25)/.75,0,1),a2);
      }
      /* 阶段 3 (6.4s..收场): 双人同屏 VS 对决特长面板 + 收场向中心聚拢收回 */
      if(C.hasOpp&&e>p2SoloEnd-.1){
        const vsIn=sm((e-p2SoloEnd)/.45)*fadeAlpha;
        const collapse=1-.78*retractK;
        const dx=2.15*M*collapse;
        drawMotionCard(g,M,{num:C.num,name:C.name,title:C.title,spec:C.spec,arc:C.arc,sweet:C.sweet,rating:C.rating,bars:C.bars,css:C.accCss},-dx,4.65*M,.82*collapse,clamp((e-p2SoloEnd)/.65,0,1),vsIn);
        drawMotionCard(g,M,{num:C.oppNum,name:C.oppName,title:C.oppTitle,spec:C.oppSpec,arc:C.oppArc,sweet:C.oppSweet,rating:C.oppRating,bars:C.oppBars,css:C.oppAccCss},dx,4.65*M,.82*collapse,clamp((e-p2SoloEnd-.12)/.65,0,1),vsIn);
        g.save();g.translate(0,4.65*M);g.scale(collapse*(1+.18*Math.sin(e*8)),collapse*1.4);
        g.globalAlpha=vsIn;
        text(g,"VS",0,0,.62*M,{stroke:3,color:C.accCss});
        text(g,"VS",0,0,.62*M,{color:"#ffffff"});
        g.restore();
      }
      /* 阶段 4 (最后 1.35s): 亮灯收回瞬间的径向聚能光环与柔和闪光扩散 */
      if(retractK>0){
        const waveR=(.6+retractK*9.5)*M,waveA=Math.sin(retractK*Math.PI);
        g.globalAlpha=waveA*.38;g.strokeStyle="#ffffff";g.lineWidth=(.14*(1-retractK)+.03)*M;
        g.beginPath();g.arc(0,3.8*M,waveR,0,TAU);g.stroke();
        g.globalAlpha=waveA*.42;g.strokeStyle=C.accCss;g.lineWidth=.10*M;
        g.beginPath();g.arc(0,3.8*M,waveR*.78,0,TAU);g.stroke();
      }
      g.restore();
      if(S.sp&&S.spK>.02){const sx=CXF+S.sp.x*PX,sy=(S.sp.z-COURT.nearBaseline)*PX,rr=1.8*PX,gr=g.createRadialGradient(sx,sy,0,sx,sy,rr);
        gr.addColorStop(0,"rgba(255,255,255,.22)");gr.addColorStop(.55,C.accCss+"44");gr.addColorStop(1,"rgba(0,0,0,0)");
        g.globalAlpha=S.spK*.38*fadeAlpha;g.fillStyle=gr;g.fillRect(sx-rr,sy-rr,rr*2,rr*2);g.globalAlpha=1;}
    }else{
      /* 5分 / 10分 专属地板灯光投影秀(控制高光透明度,清晰炫丽但不过曝) */
      if(spec){
        any=true;
        const u=clamp(spec.t/spec.dur,0,1),env=Math.sin(u*Math.PI);
        const is10=spec.kind==="super10";
        const colMain=is10?"#ffd740":"#00f0ff",colSub=is10?"#00f0ff":C.accCss;
        traceLines(g,1,env*(is10?.55:.45),colMain);
        /* 十束聚光灯在地板上的高能扫射光斑 */
        for(const B of beams){
          if(!B.active)continue;
          const bx=CXF+B.hitX*M,by=(B.hitZ-COURT.nearBaseline)*M,br=1.08*M;
          const bgr=g.createRadialGradient(bx,by,0,bx,by,br);
          bgr.addColorStop(0,B.css+"99");bgr.addColorStop(.48,B.css+"33");bgr.addColorStop(1,"rgba(0,0,0,0)");
          g.globalAlpha=env*.26;g.fillStyle=bgr;g.beginPath();g.arc(bx,by,br,0,TAU);g.fill();
        }
        g.save();g.translate(CXF,HOOP_PY);g.rotate(S.phi);
        const numRings=is10?5:3;
        for(let i=0;i<numRings;i++){
          const ru=clamp((u*1.35-i*.14),0,1);if(ru<=0||ru>=1)continue;
          const rr=outExpo(ru)*(is10?11.5:8.8)*M;
          g.globalAlpha=(1-ru)*env*.52;
          g.strokeStyle=i%2===0?colMain:colSub;
          g.lineWidth=(.14*(1-ru)+.035)*M;
          g.beginPath();g.arc(0,3.8*M,rr,0,TAU);g.stroke();
        }
        const scalePop=1+.35*(1-outExpo(clamp(u*3.2,0,1)));
        g.translate(0,4.4*M);g.scale(scalePop,scalePop*1.42);
        g.globalAlpha=env*.82;
        text(g,is10?"+10":"+5",0,-.55*M,is10?1.85*M:1.45*M,{stroke:4,color:colMain});
        text(g,is10?"+10":"+5",0,-.55*M,is10?1.85*M:1.45*M,{color:"#ffffff"});
        text(g,spec.title,0,.48*M,.52*M,{color:colMain});
        text(g,spec.sub,0,.92*M,.24*M,{plain:true,color:"#ffffff"});
        g.restore();
      }
      /* 命中涟漪:以篮筐正下方为圆心(柔和脉冲,不刺眼) */
      for(const p of S.ripples){const u=p.t/PULSE;if(u<=0||u>=1)continue;any=true;
        const r=outExpo(u)*9.2*M;
        const rCol=p.mode==="super10"?"#ffd740":(p.mode==="deep5"?"#00f0ff":C.accCss);
        g.globalAlpha=.48*Math.pow(1-u,1.4);g.strokeStyle=rCol;g.lineWidth=(.045+.18*(1-u))*M;
        g.beginPath();g.arc(CXF,HOOP_PY,r,0,TAU);g.stroke();
        g.globalAlpha=.32*Math.pow(1-u,1.6);g.strokeStyle="#fff";g.lineWidth=.038*M;g.beginPath();g.arc(CXF,HOOP_PY,r+.16*M,0,TAU);g.stroke();
        g.globalAlpha=.26*Math.pow(1-u,2);g.strokeStyle=rCol;g.lineWidth=.05*M;g.beginPath();g.arc(CXF,HOOP_PY,r*.72,0,TAU);g.stroke();}
      /* 连中:禁区里闪一下 ×N */
      if(S.streakT>=0&&S.streakT<1.2){any=true;
        const u=S.streakT/1.2,s=1+.45*(1-outExpo(u*3)),a=(1-sm((u-.6)/.4))*.82,str=String(S.streak),hN=2.1*M;
        g.save();g.translate(CXF,HOOP_PY);g.rotate(S.phi);g.translate(0,3.3*M);g.scale(s,s*1.5);
        g.globalAlpha=a*.5;digits(g,str,hN*1.1,1,"#fff","stroke",1.6);
        g.globalAlpha=a;digits(g,str,hN,clamp(u*4,0,1),C.accCss,"fill");
        /* 乘号 */
        const xo=-(str.length*hN*.64+(str.length-1)*hN*.17)/2-.5*M;
        g.globalAlpha=a;g.strokeStyle="#fff";g.lineWidth=.16*M;g.lineCap="round";g.beginPath();
        g.moveTo(xo-.3*M,-.3*M);g.lineTo(xo+.3*M,.3*M);g.moveTo(xo+.3*M,-.3*M);g.lineTo(xo-.3*M,.3*M);g.stroke();
        g.restore();}
      /* 关键球:场地线整组亮一下(去掉原先整场铺满纯白/队色 fillRect 造成的地板大面积过曝) */
      if(S.burst>=0&&!spec){const u=S.burst/BURST;if(u>.13){any=true;const k=Math.pow(1-(u-.13)/.87,2.4);
        traceLines(g,1,Math.min(.58,k*.85));}}
    }
    g.globalAlpha=1;
    floor.visible=any;if(any)ftex.needsUpdate=true;
    /* 远端半场只在 10分球 或 关键球爆闪时同步亮起,避免赛前文字在远端反向镜像造成一条条黑带错觉 */
    if(floorFar)floorFar.visible=any&&(S.burst>=0||!!(spec&&spec.kind==="super10"));
  }
  /* 追光:黑场期间一束柔和的队色白光罩着当前表演者,随演示的镜头换人;收场段跟着亮灯一起淡出 */
  const _tg=new THREE.Vector3();
  function updSpot(dt){
    if(!spot)return;
    const e=S.ent,focus=spotFocus();
    let k=0;
    if(e>=0&&focus)k=sm(e/.5)*(1-sm((e-(S.entDur-1.05))/.85));
    S.spK+=(k-S.spK)*(1-Math.exp(-10*dt));
    if(focus){
      if(!S.sp)S.sp=new THREE.Vector3().copy(focus);else S.sp.lerp(focus,1-Math.exp(-7*dt));
    }
    if(S.spK<.003){spot.intensity=0;return;}
    spot.color.setRGB(1,1,1).lerp(C.acc,.28);
    spot.position.set(S.sp.x+.9,11,S.sp.z+1.6);spotTarget.position.set(S.sp.x,1.0+S.sp.y*.8,S.sp.z);spotTarget.updateMatrixWorld(true);
    /* 控制聚光灯强度(原为 7.5 导致球衣与脚下地板严重过曝发白),2.6 既凸显主角层次又不过曝 */
    spot.intensity=2.6*S.spK;
  }
  function update(t){
    if(!S.built){if(!active())return;build();syncStar();}
    if(Math.abs(t-S.t)<1e-4)return;
    const dt=clamp(t-S.t,0,.1);S.t=t;
    const live=active();
    if(!live){for(const R of rings)R.mesh.visible=false;S.ringsOff=true;floor.visible=false;if(floorFar)floorFar.visible=false;setBeams(0,0,0);setStars(0);if(pyroPoints)pyroPoints.visible=false;if(dryIcePoints)dryIcePoints.visible=false;if(S.dim!==1&&S.base!=null){S.dim=1;renderer.toneMappingExposure=S.base;S.wrote=false;}S.ent=-1;S.burst=-1;S.special=null;S.pulses.length=0;S.ripples.length=0;if(spot)spot.intensity=0;return;}
    for(const p of S.pulses)p.t+=dt;
    for(const p of S.ripples)p.t+=dt;
    while(S.pulses.length&&S.pulses[0].t>RING_PULSE+RING_LAG[3]+.3)S.pulses.shift();
    while(S.ripples.length&&S.ripples[0].t>PULSE+.3)S.ripples.shift();
    if(S.burst>=0){S.burst+=dt;if(S.burst>BURST)S.burst=-1;}
    if(S.streakT>=0){S.streakT+=dt;if(S.streakT>1.1)S.streakT=-1;}
    if(S.special){S.special.t+=dt;if(S.special.t>S.special.dur)S.special=null;}
    /* 登场挂在赛前介绍(热身演示)上:一进演示就黑场 + 追光,演示结束前丝滑亮灯 + 烟花干冰啦啦队齐鸣 */
    if(typeof G!=="undefined"){
      const pre=G.state==="pregame";
      if(pre&&!S.wasPre&&t-S.lastEnt>6){
        syncStar();S.ent=0;S.lastEnt=t;S.climaxFired=false;S.dryIceWarmFired=false;
        S.pulses.length=0;S.ripples.length=0;
        S.entDur=Math.max(4.6,(typeof PREGAME!=="undefined"&&PREGAME.dur?PREGAME.dur:5.2)-.2);
      }
      if(S.ent>=0&&!pre&&S.ent<S.entDur-1.25)S.ent=S.entDur-1.25;
      S.wasPre=pre;
    }
    if(S.ent>=0){
      S.ent+=dt;
      /* 开场 0.5s 先喷一波柔和干冰烘托气氛 */
      if(!S.dryIceWarmFired&&S.ent>.45){
        S.dryIceWarmFired=true;
        triggerAtmosphereBurst(.55,"warm");
      }
      /* 亮灯收回前 1.15s:触发烟花 + 干冰气柱 + 啦啦队欢呼 + 观众音浪 + 收光回弹 */
      if(!S.climaxFired&&S.ent>=S.entDur-1.15){
        S.climaxFired=true;
        triggerClimaxCelebration(0.88,"climax");
      }
      if(S.ent>S.entDur)S.ent=-1;
    }
    updAtmosphereFX(dt);
    S.heat+=(S.heatT-S.heat)*(1-Math.exp(-(S.heatT>S.heat?3:1.6)*dt));
    /* 场灯曝光:严格抑制高光过曝(上限 ≤ 1.04);5分/10分/关键球略微压暗环境底光(0.86..0.92)以衬托彩灯与光束层次,绝不拉高全屏曝光冲白 */
    let dim=1;
    if(typeof G!=="undefined"&&G.charging)dim=.93;
    if(S.ent>=0){
      const e=S.ent,left=S.entDur-e;
      const darkIn=sm(e/.65);
      const rec=sm((1.25-left)/1.15);
      const bloom=Math.sin(rec*Math.PI)*.04;
      dim=1-.58*darkIn*(1-rec)+bloom;
    }
    if(S.special){
      const su=clamp(S.special.t/S.special.dur,0,1);
      if(S.special.kind==="super10")dim=su<.14?.76:1-.10*Math.sin(su*Math.PI);
      else if(S.special.kind==="deep5")dim=1-.08*Math.sin(su*Math.PI);
    }else if(S.burst>=0){
      const u=S.burst/BURST;dim=u<.13?.68:1+.03*Math.pow(1-(u-.13)/.87,2);
    }
    const rate=S.burst>=0?20:(S.ent>=0?14:8);
    S.dim+=(dim-S.dim)*(1-Math.exp(-rate*dt));
    if(Math.abs(S.dim-1)<.002&&dim===1)S.dim=1;
    /* 曝光:不压暗时不写,并把当前值记成基准(别的系统改了曝光也不会被这里盖回去) */
    if(S.dim===1||S.base==null)S.base=renderer.toneMappingExposure/(S.wrote?S.wroteK:1);
    if(S.dim!==1){renderer.toneMappingExposure=S.base*S.dim;S.wrote=true;S.wroteK=S.dim;}
    else if(S.wrote){renderer.toneMappingExposure=S.base;S.wrote=false;}
    setRings();
    updSpot(dt);
    /* 全馆配合:十束聚光灯 + 看台星海在登场秀、5分球、10分球、关键球中协同联动 */
    {let bk=0,gather=0,retract=0,sk=0;
      if(S.ent>=0){
        const e=S.ent,left=S.entDur-e;
        const inB=sm((e-.15)/.45);
        retract=sm((.85-left)/.75);
        bk=inB*(1-retract*.95)*.82;
        sk=inB*(1-sm((1.15-left)/.95))*.78;
        const g1=sm((e-.7)/.35)*(1-sm((e-1.9)/.65));
        const gEnd=sm((1.35-left)/.55);
        gather=Math.max(g1*.75,gEnd);
      }
      if(S.special){
        const su=clamp(S.special.t/S.special.dur,0,1),sEnv=Math.sin(su*Math.PI);
        bk=Math.max(bk,S.special.kind==="super10"?.68*sEnv:.56*sEnv);
        gather=Math.max(gather,sm((su-.62)/.32));
        retract=Math.max(retract,sm((su-.78)/.22));
        if(S.special.kind==="super10")sk=Math.max(sk,.75*sEnv);
      }
      if(S.burst>=0&&!S.special){const u=S.burst/BURST;if(u>.13)bk=Math.max(bk,.48*Math.pow(1-(u-.13)/.87,1.6));}
      setBeams(bk,gather,retract);setStars(sk);}
    /* 地板画布重绘:平时空闲 0 重绘 0 上传;特效期移动端自适应 30fps 并避开重负载帧,桌面端 60fps */
    const need=S.ent>=0||S.special!=null||S.ripples.length||S.streakT>=0||S.burst>=0;
    if(need){
      const minDt=(S.ent>=0||S.special!=null)?FLOOR_MIN_DT:(1/31);
      const elapsed=t-S.lastDraw;
      const busyFrame=IS_MOBILE&&global.__aibaHeavyFrame===t&&elapsed<(1/18);
      if(elapsed>=minDt&&!busyFrame){
        S.lastDraw=t;
        drawFloor();
        global.__aibaHeavyFrame=t;
      }
    }
    else if(floor.visible){floor.visible=false;if(floorFar)floorFar.visible=false;}
  }

  /* ---------- 挂接:球馆每帧更新 + 进球/失手结算 ---------- */
  if(ON){
    const ur=global.updUpperRibbon;
    if(typeof ur==="function")global.updUpperRibbon=function(t){const r=ur.apply(this,arguments);try{update(t);}catch(e){if(!S.err){S.err=String(e&&e.stack||e);console.warn("[motion-show]",S.err);}}return r;};
    const mb=global.madeBall,xb=global.missBall;
    if(typeof mb==="function")global.madeBall=function(b){const r=mb.apply(this,arguments);
      try{if(b&&!b.opp&&!b.silent){const n=(typeof G!=="undefined"&&G.streak)||0;
        fire("make",{streak:n,val:b.val,deep:!!(b.deep||b.val===5),super:!!(b.super||b.val===10),clutch:!!(b.bonus||(b.money&&n>=3)||(n>=5&&n%5===0)||(typeof G!=="undefined"&&G.mode==="lastshot"))});}}catch(e){}
      return r;};
    if(typeof xb==="function")global.missBall=function(){const r=xb.apply(this,arguments);try{fire("miss");}catch(e){}return r;};
  }
  global.AIBAShow=Object.freeze({fire,entrance:()=>fire("entrance"),update,canvas:()=>fg&&fg.canvas,
    state:()=>({on:ON,built:S.built,ent:S.ent,entDur:S.entDur,spot:+S.spK.toFixed(3),ripples:S.ripples.length,burst:S.burst,special:S.special&&S.special.kind||null,heat:+S.heat.toFixed(3),pulses:S.pulses.length,dim:+S.dim.toFixed(3),
      floor:!!(floor&&floor.visible),rings:rings.map(r=>r.mesh.visible),star:C.key,num:C.num,name:C.name,acc:C.accCss,err:S.err||null})});
})(window);
