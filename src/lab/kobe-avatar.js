/* Kobe 皮套：把实验室里的科比（src/lab/kobe-core.js）套到 AIBA 玩家骨架上。
   开关：?kobe=e（E 体素卡渲）| ?kobe=d（D 平滑）。不带参数时本文件什么都不做。

   思路：AIBA 的 player 照常创建、照常被动作系统驱动（跑位、取球、蓄力、出手、落地……一行不改），
   只是渲染时把它的方块网格临时藏起来，换成科比跟着骨骼动：
     · 科比网格在站姿下生成一次（Worker 里跑，不卡主线程），做成 SkinnedMesh，
       骨骼 = 身体 17 根 + 每只手 4 指×3 节 + 拇指 2 节
     · 每次 renderer.render 前读 AIBA 节点的世界朝向，套到科比骨架上（骨长用科比自己的）：
         躯干  跟根节点 g（AIBA 躯干本来就是刚性挂在 g 上）
         头    跟 headRoot 的转动
         腿    跟 legs / knees / footRoots 的转动，最后整体上下平移让鞋底贴到 AIBA 的鞋底高度
         手臂  两骨 IK：手腕目标 = AIBA 手腕 + 身高差；手在身体两侧时再按肩宽差外移、
               手在身前（双手持球）时不外移——这样垂手自然、双手扶球又不会穿插
         手/手指/拇指  绝对朝向对齐（两套骨架的手坐标系不同：AIBA 掌心朝局部 -Z，科比掌心朝身体）
     · 手里的球（pBall，挂在 ballGrips[0]）挪到科比手上；AIBA 出手读 ballWorldPos()=pBall 世界坐标，
       所以出手点自动跟着科比的手，判定逻辑不动
   第一人称下 AIBA 会把 player.g 整个隐藏，皮套挂在 g 下面一起隐藏，第一人称手臂仍是 AIBA 原样。 */
(function(){
  "use strict";
  const QS=new URLSearchParams(location.search);
  let MODE=QS.get("kobe");
  if(MODE==="0"||MODE==="off"||MODE==="none")return;
  if(!MODE)MODE="e";
  /* 球星 → 体素档案（kobe-core.js 的 ROSTER）。玩家选的球星在表里就换成对应的体素角色，不在表里保持 AIBA 原样。
     ?char=jordan 之类可以强制指定。 */
  const STAR_MAP={k24:"kobe",j23:"jordan",a03:"iverson",v15:"carter",allen:"allen",curry:"curry",h13:"harden",t01:"mcgrady",nowitzki:"nowitzki",irving:"irving",durant:"durant",doncic:"doncic"};
  const FORCE=QS.get("char");
  const STYLE=MODE==="d"?"smooth":"vox";
  /* 游戏里用 7 头身：头放大 10.6%、四肢粗 3%（实验室"头身比"那排的 7）。骨架不动，动作、IK、球的位置照旧。
     7.6 是真实比例，可到比赛镜头的距离脸只剩几个像素，认不出谁是谁 */
  const GAME_PROP={f:1.106,g:1.03};
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const CORE_URL=new URL("kobe-core.js",SELF).href;
  const THREE_URL=(document.querySelector('script[src*="three"]')||{}).src;
  const T=THREE;
  const state={K:null,data:null,root:null,bones:null,mesh:null,hull:null,sk:null,player:null,map:null,ready:false,err:null,camSet:false,cache:{},charId:null};
  window.AIBAKobe=state;

  /* ---------- 1. 在闭包里加载共享核心（核心的 clamp/V3/C… 不会污染游戏全局） ---------- */
  const EXPORTS=["BUILD","BN","BI","NB","HB","DM","FINGER","THUMB","solveHand","chainPts","buildDecals","installDecals","frameRot","perp","twoBone","workerJob","setChar","ROSTER","handRest"];
  fetch(CORE_URL,{cache:"no-store"}).then(r=>r.text())   // 核心不在 index.html 的版本号盖章范围内，每次取最新
  .then(src=>{
    state.K=new Function("THREE",src+"\n;return {"+EXPORTS.join(",")+"};")(T);
    const id=wantChar();if(id)buildRest(id);
  }).catch(e=>{state.err=e;console.warn("[kobe] 核心加载失败",e);});

  /* ---------- 2. 科比骨架（站姿，所有骨骼零旋转，手指伸直） ---------- */
  const REST_HAND={c:[0,0,0,0],sp:[.05,.01,-.02,-.06],to:.15,ta:0,tc:0,grip:0};
  function skeletonDef(K){
    const S=[],idx={};
    const add=(name,parent,head,extra)=>{idx[name]=S.length;S.push(Object.assign({name,parent:parent==null?-1:idx[parent],head},extra||{}));};
    const bh=n=>K.BN[K.BI[n]].head.slice();
    for(const [n,p] of [["pelvis",null],["spine","pelvis"],["chest","spine"],["neck","chest"],["head","neck"],
      ["upperArmL","chest"],["foreArmL","upperArmL"],["handL","foreArmL"],["upperArmR","chest"],["foreArmR","upperArmR"],["handR","foreArmR"],
      ["thighL","pelvis"],["shinL","thighL"],["footL","shinL"],["thighR","pelvis"],["shinR","thighR"],["footR","shinR"]])add(n,p,bh(n));
    const hands={};
    for(const [sd,s] of [["L",1],["R",-1]]){
      const H=K.solveHand(s,REST_HAND,null),N0=[-s,0,0];hands[sd]=H;
      const W=K.handRest;   // 手指骨头跟着体格加宽、身高平移（和建模时的手指位置一致）
      for(let i=0;i<4;i++){const F=H.f[i],pt=K.chainPts(F.K,F.d0,N0,K.FINGER.L[i],F.a).map(W);
        for(let j=0;j<3;j++)add("f"+sd+i+j,j?"f"+sd+i+(j-1):"hand"+sd,pt[j],{finger:i,seg:j,side:sd,d0:F.d0});}
      const t=H.t,tp=K.chainPts(t.B,t.d0,t.n0,K.THUMB.L,t.a).map(W);
      add("t"+sd+"1","hand"+sd,tp[1],{thumb:1,side:sd,d0:t.d0,n0:t.n0});
      add("t"+sd+"2","t"+sd+"1",tp[2],{thumb:2,side:sd,d0:t.d0,n0:t.n0});
    }
    return {S,idx,hands};
  }

  /* ---------- 3. 站姿网格：Worker 里生成（带逐顶点归属骨骼） ---------- */
  function wantChar(){
    if(FORCE)return state.K&&state.K.ROSTER[FORCE]?FORCE:null;
    const star=typeof G!=="undefined"&&G?G.myStar:null,id=star&&STAR_MAP[star.id];
    return id||(star?null:"kobe");   // 还没选球星（开场）先按科比烘焙，选定后再换
  }
  /* 每位球星的站姿网格各烘一次（Worker），按球星缓存；骨架定义、蒙皮用的骨头位置也跟着球星走 */
  function buildRest(id){
    const K=state.K,E=state.cache[id]||(state.cache[id]={id});if(E.baking||E.data)return E;E.baking=true;
    K.setChar(id);E.def=skeletonDef(K);E.hy=K.BN[K.BI.pelvis].head[1];E.mirror=!!K.ROSTER[id].mirror;
    const DEC=K.buildDecals((w,h)=>{const c=document.createElement("canvas");c.width=w;c.height=h;return c;},id);
    const owner={};E.def.S.forEach((b,i)=>owner[b.name]=i);
    const dm=new Float64Array(K.NB*16);for(let i=0;i<K.NB;i++)new T.Matrix4().toArray(dm,i*16);
    const BIND={root:[0,0,0],rot:{upperArmL:[0,0,.56],upperArmR:[0,0,-.56],thighL:[0,0,.1],thighR:[0,0,-.1],footL:[0,0,-.1],footR:[0,0,.1]}};
    const job={kind:STYLE==="vox"?"restVox":"restSmooth",id:1,dm,ballOn:false,hands:E.def.hands,opt:{sleeve:"black",char:id,prop:GAME_PROP},owner,s:.0085,pose:BIND};
    const done=data=>{E.data=data;E.baking=false;for(const I of INSTS)tryAttach(I);};
    try{
      const src=`importScripts(${JSON.stringify(THREE_URL)},${JSON.stringify(CORE_URL+"?t="+Date.now())});self.onmessage=e=>{const r=workerJob(e.data);self.postMessage(r.msg,r.transfer);};`;
      const w=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));
      w.onmessage=e=>{if(e.data.id===1){done(e.data.data);w.terminate();}};
      w.onerror=e=>{console.warn("[kobe] Worker 失败，改主线程生成",e);w.terminate();K.installDecals(DEC,id);done(K.workerJob(job).msg.data);};
      w.postMessage({id:-1,decals:DEC,char:id});w.postMessage(job);
    }catch(e){K.installDecals(DEC,id);done(K.workerJob(job).msg.data);}
    return E;
  }

  /* ---------- 4. 蒙皮权重：每个顶点归属一根骨头；靠近关节时和相邻骨头按距离混合 ---------- */
  /* 大腿过渡半径 .2：短裤很宽松，表面离髋关节 12cm 以上，半径太小时屈髋会把骨盆和大腿上的布扯开，
     露出里面的描边外壳（黑块） */
  const JOINT_R={upperArm:.13,foreArm:.045,hand:.045,thigh:.2,shin:.05,foot:.035,head:.04,f:.008,t:.01};
  function jointR(name){for(const k in JOINT_R)if(name.startsWith(k))return JOINT_R[k];return 0;}
  /* 布料（球衣 / 短裤，材质 1、2）不跨"躯干 ↔ 上臂"混合：球衣袖口是开口，肩部的布要留在躯干上，
     否则举手时袖口的布会被扯成一条带子。皮肤（三角肌）照常混合。 */
  const TORSO=new Set(["pelvis","spine","chest","neck"]);
  const noClothBlend=(a,b,m)=>(m===1||m===2)&&(TORSO.has(a)!==TORSO.has(b))&&(a.startsWith("upperArm")||b.startsWith("upperArm"));
  function bindPose(E){
    const K=state.K,S=E.def.S,dmArr=E.data.dm,M=i=>new T.Matrix4().fromArray(dmArr,i*16);
    return S.map(b=>{const base=b.finger!=null||b.thumb?"hand"+b.side:b.name,m=M(K.BI[base]);
      return {pos:new T.Vector3(b.head[0],b.head[1],b.head[2]).applyMatrix4(m),q:new T.Quaternion().setFromRotationMatrix(m)};});
  }
  function skinFor(E,pos,own,scale,mats){
    const S=E.def.S,n=own.length,si=new Uint16Array(n*4),sw=new Float32Array(n*4),BH=E.bind.map(b=>b.pos.toArray());
    const kids=S.map(()=>[]);S.forEach((b,i)=>{if(b.parent>=0)kids[b.parent].push(i);});
    for(let v=0;v<n;v++){
      const b=own[v],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2],B=S[b],m=mats?Math.round(mats[v]):0;let other=b,w=0;
      const r=jointR(B.name)*scale;
      if(B.parent>=0&&r>0&&!noClothBlend(B.name,S[B.parent].name,m)){const d=Math.hypot(x-BH[b][0],y-BH[b][1],z-BH[b][2]);if(d<r){w=.5*(1-d/r);other=B.parent;}}
      if(!w)for(const c of kids[b]){const rc=jointR(S[c].name)*scale;if(!rc||noClothBlend(B.name,S[c].name,m))continue;const H=BH[c],d=Math.hypot(x-H[0],y-H[1],z-H[2]);
        if(d<rc){const wc=.5*(1-d/rc);if(wc>w){w=wc;other=c;}}}
      /* 臀部 / 短裤上半截跟骨盆走：裤管从髋关节就开始、把臀部整个包住，全挂在大腿上的话，
         站立并腿时左右臀部会跟着大腿往里转、互相挤穿，里层的描边外壳翻到表面（臀部两块黑斑）。
         按离髋关节的高度渐变：髋关节上方全跟骨盆，往下 34cm 过渡回大腿。 */
      if(/^thigh/.test(B.name)&&B.parent>=0){const hy=BH[b][1],t=Math.min(1,Math.max(0,(y-(hy-.34))/.34));let wP=t*t*(3-2*t)*.96;
        /* 臀部中缝 / 裆部（离中线 11cm 以内、髋部以下 40cm 内）也跟骨盆：并腿时这一带跟着大腿往里转会越过中线、三角面翻转 */
        if(m===2&&y>hy-.4){const c=Math.min(1,Math.max(0,(.11-Math.abs(x))/.06));wP=Math.max(wP,c*c*(3-2*c)*.9);}
        if(wP>w){w=wP;other=B.parent;}}
      si[v*4]=b;si[v*4+1]=other;sw[v*4]=1-w;sw[v*4+1]=w;
    }
    return [new T.BufferAttribute(si,4),new T.BufferAttribute(sw,4)];
  }
  function geometryFromData(E){
    const d=E.data;
    const g=new T.BufferGeometry();
    if(STYLE==="vox"){
      // 身体和头的各材质桶合成一张网格（头在站姿下的局部坐标就是世界坐标）
      const parts=[];for(const part of [d.body,d.head])for(const k in part.buckets)parts.push(part.buckets[k]);
      let nv=0,ni=0;for(const b of parts){nv+=b.p.length/3;ni+=b.idx.length;}
      const P=new Float32Array(nv*3),N=new Float32Array(nv*3),C=new Float32Array(nv*3),SN=new Float32Array(nv*3),AO=new Float32Array(nv),MT=new Float32Array(nv),OW=new Uint8Array(nv),I=new Uint32Array(ni);
      let ov=0,oi=0;
      for(const b of parts){const m=b.p.length/3;
        P.set(b.p,ov*3);C.set(b.c,ov*3);OW.set(b.bi,ov);MT.set(b.mt,ov);
        for(let i=0;i<m*3;i++){N[ov*3+i]=b.nrm[i]/127;SN[ov*3+i]=b.sn[i]/127;}
        for(let i=0;i<m;i++)AO[ov+i]=b.ao[i]/255;
        for(let i=0;i<b.idx.length;i++)I[oi+i]=b.idx[i]+ov;ov+=m;oi+=b.idx.length;}
      g.setAttribute("position",new T.BufferAttribute(P,3));g.setAttribute("normal",new T.BufferAttribute(N,3));
      g.setAttribute("color",new T.BufferAttribute(C,3));g.setAttribute("sn",new T.BufferAttribute(SN,3));
      g.setAttribute("ao",new T.BufferAttribute(AO,1));g.setAttribute("mat",new T.BufferAttribute(MT,1));g.setIndex(new T.BufferAttribute(I,1));
      const [si,sw]=skinFor(E,P,OW,.7,MT);g.setAttribute("skinIndex",si);g.setAttribute("skinWeight",sw);
      /* 描边宽度按顶点：裤管内侧（裆部、大腿内侧，绑定姿势里离中线 13cm 以内、髋部以下）不外扩。
         两腿间的缝窄于两倍描边宽度时会被描边色填满，站立并腿时看起来像裆部一块黑斑 */
      const HW=new Float32Array(nv);
      for(let v=0;v<nv;v++){const x=Math.abs(P[v*3]),y=P[v*3+1];HW[v]=Math.round(MT[v])===2&&y<(E.hy||1.02)?Math.min(1,Math.max(0,(x-.09)/.05)):1;}
      g.setAttribute("hw",new T.BufferAttribute(HW,1));
    }else{
      const parts=[d.body,d.head];let nv=0,ni=0;for(const b of parts){nv+=b.pos.length/3;ni+=b.idx.length;}
      const P=new Float32Array(nv*3),N=new Float32Array(nv*3),C=new Float32Array(nv*3),OW=new Uint8Array(nv),MT=new Float32Array(nv),I=new Uint32Array(ni);
      let ov=0,oi=0;
      for(const b of parts){const m=b.pos.length/3;P.set(b.pos,ov*3);N.set(b.nrm,ov*3);C.set(b.col,ov*3);OW.set(b.own,ov);MT.set(b.mat,ov);
        for(let i=0;i<b.idx.length;i++)I[oi+i]=b.idx[i]+ov;ov+=m;oi+=b.idx.length;}
      g.setAttribute("position",new T.BufferAttribute(P,3));g.setAttribute("normal",new T.BufferAttribute(N,3));
      g.setAttribute("color",new T.BufferAttribute(C,3));g.setIndex(new T.BufferAttribute(I,1));
      const [si,sw]=skinFor(E,P,OW,1,MT);g.setAttribute("skinIndex",si);g.setAttribute("skinWeight",sw);
    }
    g.computeBoundingSphere();return g;
  }

  /* ---------- 5. 材质：D 走 PBR；E 走卡渲（亮面偏暖、暗面偏紫、轮廓光）+ 反向外壳描边 ---------- */
  const toonU={kD:{value:new T.Vector3(0,1,0)},rD:{value:new T.Vector3(0,.3,-1)},uS:{value:.8},uA:{value:1},uExp:{value:1.0},uAmb:{value:new T.Vector3(.35,.35,.38)}};
  const SKIN_HEAD="#include <common>\n#include <skinning_pars_vertex>\n";
  function toonMaterial(){
    return new T.ShaderMaterial({skinning:true,vertexColors:true,uniforms:toonU,
      vertexShader:SKIN_HEAD+`attribute vec3 sn;attribute float ao,mat;uniform float uS,uA;varying vec3 vN,vC,vV;varying float vM;
      void main(){
        #include <skinbase_vertex>
        vec3 objectNormal=normalize(mix(normal,sn,uS));
        #include <skinnormal_vertex>
        vec3 transformed=vec3(position);
        #include <skinning_vertex>
        vN=normalize(normalMatrix*objectNormal);vC=color/max(ao,.2)*mix(1.,ao,uA);vM=mat;
        vec4 mv=modelViewMatrix*vec4(transformed,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform vec3 kD,rD,uAmb;uniform float uExp;varying vec3 vN,vC,vV;varying float vM;
      void main(){vec3 N=normalize(vN),V=normalize(vV);float k=dot(N,kD);vec3 b=vC*uExp,c;
        bool skin=vM<.5||(vM>3.5&&vM<4.5);   // 皮肤 / 寸头：暗面偏暖（皮下散射），明暗交界一道暖红
        if(skin){
          if(k>.38)c=b*vec3(1.1,1.05,.97);
          else if(k>.1)c=b*vec3(.94,.9,.88);
          else if(k>-.1)c=b*vec3(.9,.7,.62);            // 交界暖红
          else c=b*vec3(.74,.62,.64);
        }else{
          if(k>.38)c=b*vec3(1.08,1.05,.98);else if(k>-.08)c=b*vec3(.88,.86,.88);else c=b*vec3(.62,.58,.66);
        }
        c+=b*uAmb*.55;                  // 场景环境光：暗面不再压成死黑
        float r=pow(1.-max(dot(N,V),0.),2.8)*max(dot(N,rD),0.);
        if(r>.15)c=mix(c,vec3(1.,.96,.9)*max(b*2.0,vec3(.25)),.45);
        if(vM>4.5&&vM<5.5&&k>.5&&dot(reflect(-kD,N),V)>.9)c=vec3(1.);
        gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}`});
  }
  function hullMaterial(){
    return new T.ShaderMaterial({skinning:true,side:T.BackSide,uniforms:{w:{value:.0078}},
      vertexShader:SKIN_HEAD+`attribute vec3 sn;attribute float hw;uniform float w;
      void main(){
        #include <skinbase_vertex>
        vec3 objectNormal=normalize(sn);
        #include <skinnormal_vertex>
        vec3 transformed=vec3(position);
        #include <skinning_vertex>
        vec4 mv=modelViewMatrix*vec4(transformed,1.);
        vec3 n=normalize(normalMatrix*objectNormal);mv.xyz+=n*w*hw*clamp(-mv.z*.14,.8,2.5);   // 保持细腻纤细的漫画描边
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`void main(){gl_FragColor=vec4(.075,.05,.085,1.);}`});
  }

  /* ---------- 6. 挂到 AIBA 角色上 ----------
     每个要换皮的 AIBA 角色一个"实例"：玩家用 state 本身（win-cinematic / replay 读 AIBAKobe.ballShift），
     百分大战的对手另一个。烘好的网格按球星缓存，两个实例是同一个球星时共用一份几何。 */
  const PLAYER_SLOT={
    guy:()=>typeof player!=="undefined"?player:null,
    char:()=>wantChar(),
    ball:()=>typeof pBall!=="undefined"?pBall:null,
    holding:(guy,b)=>!!(b&&b.visible&&b.parent&&b.parent.name==="ballGrip"),
    air:()=>{try{const g=typeof player!=="undefined"?player:null,lift=g&&g.pregameLift>0?g.pregameLift:0;return Math.max(typeof P!=="undefined"&&P?Number(P.jump)||0:0,lift);}catch(e){return 0;}},
    pass:()=>{try{if(typeof passing!=="undefined"&&passing&&passing.mesh){const k=G&&G.passCatch?Number(G.passCatch.progress)||0:0;return {mesh:passing.mesh,k};}}catch(e){}return null;},
  };
  const OPP_FORCE=QS.get("oppchar");
  const OPP_SLOT={
    guy:()=>{try{return typeof G!=="undefined"&&G&&G.mode==="battle"&&typeof OPP!=="undefined"&&OPP&&OPP.guy&&OPP.guy.handRoots?OPP.guy:null;}catch(e){return null;}},
    char:()=>{if(OPP_FORCE)return state.K&&state.K.ROSTER[OPP_FORCE]?OPP_FORCE:null;
      const star=(typeof OPP!=="undefined"&&OPP&&OPP.o)||(typeof G!=="undefined"&&G&&G.battleOpp);return star&&STAR_MAP[star.id]||null;},
    ball:guy=>guy&&guy.ball,
    holding:(guy,b)=>!!(b&&b.visible&&guy.ballGrips&&b.parent===guy.ballGrips[0]),
    air:guy=>Math.max(0,guy.g.position.y),
    pass:()=>{try{const o=OPP.ballOut;if(o&&o.mesh)return {mesh:o.mesh,k:Math.min(1,o.t/o.dur)};}catch(e){}return null;},
  };
  state.slot=PLAYER_SLOT;
  const oppInst={slot:OPP_SLOT,charId:null,ready:false};
  const INSTS=[state,oppInst];
  window.AIBAKobeOpp=oppInst;
  function detach(I){
    if(I.root&&I.root.parent)I.root.parent.remove(I.root);
    I.ready=false;I.charId=null;I.ballShift=null;I.player=null;
  }
  /* 按角色当前的球星挂对应的体素角色：没烘好先烘（这段时间显示 AIBA 原样），不在名单里就卸掉 */
  function tryAttach(I){
    I=I||state;if(!state.K)return;
    const id=I.slot.char(),guy=I.slot.guy();
    if(!id||!guy){if(I.charId)detach(I);return;}
    const E=state.cache[id];
    if(!E||!E.data){buildRest(id);if(I.charId&&I.charId!==id)detach(I);return;}
    if(!guy.g||!guy.handRoots||!guy.handRoots.length)return;
    if(I.charId===id&&I.player===guy&&I.ready)return;
    attach(I,guy,E);
  }
  function attach(I,P,E){
    const K=state.K;I.def=E.def;
    if(!E.bind)E.bind=bindPose(E);
    I.bind=E.bind;I.hy=E.hy;
    if(!E.geo)E.geo=geometryFromData(E);
    I.geo=E.geo;const def=E.def;
    if(I.root&&I.root.parent)I.root.parent.remove(I.root);
    const root=new T.Group();root.name="kobeAvatar";root.userData.kobe=true;
    const bones=def.S.map((b,i)=>{const B=new T.Bone();B.name="kobe_"+b.name;B.position.copy(I.bind[i].pos);B.quaternion.copy(I.bind[i].q);root.add(B);return B;});
    root.updateMatrixWorld(true);
    const sk=new T.Skeleton(bones);
    const mat=STYLE==="vox"?toonMaterial():new T.MeshStandardMaterial({vertexColors:true,skinning:true,roughness:.62,metalness:0});
    const mesh=new T.SkinnedMesh(I.geo,mat);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=STYLE!=="vox";
    root.add(mesh);mesh.bind(sk);
    if(STYLE==="vox"){const hull=new T.SkinnedMesh(I.geo,hullMaterial());hull.frustumCulled=false;root.add(hull);hull.bind(sk);I.hull=hull;}
    root.traverse(o=>{o.userData.kobe=true;});
    P.g.add(root);
    Object.assign(I,{root,bones,mesh,sk,player:P,map:buildMap(I,P),ready:true,charId:E.id,mirror:E.mirror,holdW:undefined,tA:0});
    if(I===state&&!state.camSet&&typeof CAM!=="undefined"&&CAM.mode===0&&typeof setCameraMode==="function"){state.camSet=true;try{setCameraMode(1,{silent:true});}catch(e){}}
  }
  /* AIBA 节点 ↔ 科比骨骼；手/手指/拇指的轴对齐旋转 M（科比局部轴 → AIBA 局部轴） */
  function buildMap(I,P){
    const K=state.K,S=I.def.S,V=a=>new T.Vector3(a[0],a[1],a[2]);
    const armIdx={},legIdx={};
    P.arms.forEach((a,i)=>{armIdx[a.position.x<0?"R":"L"]=i;});
    P.legs.forEach((l,i)=>{legIdx[l.position.x<0?"R":"L"]=i;});
    const toQ=m=>new T.Quaternion().setFromRotationMatrix(m);
    const AIBA_DIR=new T.Vector3(0,-1,0),AIBA_PALM=new T.Vector3(0,0,-1);
    const mHand={},fingers={};
    for(const sd of ["L","R"]){
      const s=sd==="L"?1:-1,h=armIdx[sd];
      mHand[sd]=toQ(K.frameRot(new T.Vector3(0,-1,0),new T.Vector3(-s,0,0),AIBA_DIR,AIBA_PALM));
      // AIBA 手指按离拇指的远近排：最近的是食指
      const tx=P.thumbRoots[h].position.x;
      fingers[sd]=P.fingerJoints[h].map((f,i)=>i).sort((a,b)=>Math.abs(P.fingerJoints[h][a].position.x-tx)-Math.abs(P.fingerJoints[h][b].position.x-tx));
    }
    const m=S.map((b,i)=>{
      const o={i};
      if(b.finger!=null){const h=armIdx[b.side],ai=fingers[b.side][b.finger];
        o.node=[P.fingerJoints,P.fingerPipJoints,P.fingerDipJoints][b.seg][h][ai];
        o.M=toQ(K.frameRot(V(b.d0),new T.Vector3(b.side==="L"?-1:1,0,0),AIBA_DIR,AIBA_PALM));}
      else if(b.thumb){const h=armIdx[b.side];o.node=b.thumb===1?P.thumbRoots[h]:P.thumbTips[h];
        o.M=toQ(K.frameRot(V(b.d0),V(b.n0),AIBA_DIR,AIBA_PALM));}
      return o;
    });
    return {armIdx,legIdx,mHand,m,soleY:aibaSoleY(P)};
  }
  /* AIBA 鞋底在 footRoot 局部坐标里的最低点（量一次） */
  function aibaSoleY(P){
    let mn=0;const box=new T.Box3(),inv=new T.Matrix4();
    P.g.updateMatrixWorld(true);
    const f=P.footRoots[0];inv.copy(f.matrixWorld).invert();
    f.traverse(o=>{if(o.isMesh&&o.geometry){o.geometry.computeBoundingBox();box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);mn=Math.min(mn,box.min.y);}});
    return mn;
  }

  /* ---------- 7. 每次渲染前：重定向 + 球挪到科比手上 ---------- */
  const _m=new T.Matrix4(),_v=new T.Vector3(),_w=new T.Vector3();
  function retarget(I){
    const P=I.player,K=state.K,S=I.def.S,idx=I.def.idx,map=I.map,ball=I.slot.ball(P);
    const g=P.g;g.updateWorldMatrix(true,true);   // 连父级一起刷新：地板倒影那一遍把 scene 翻转过，父级矩阵可能是旧的
    const gInv=_m.copy(g.matrixWorld).invert();
    /* AIBA 按球星体型给 g 做不等比缩放（落地挤压时也会变）。科比这一层反向抵消它，
       从 AIBA 读来的位置一律乘回缩放，换算成真实尺寸 */
    /* 左手球员（哈登）AIBA 把 g 的 x 缩放取负、整身镜像。这里一律在"没镜像的 g 局部空间"里算（缩放取绝对值），
       皮套挂在 g 下面跟着一起镜像；角色本身按右手建模、贴花预翻，镜像后正好是左手、字不反。
       朝向用 g⁻¹·节点世界矩阵 分解，不用世界四元数相乘——带镜像（行列式为负）的矩阵分解出来的四元数不能直接相乘 */
    const Sc=new T.Vector3(Math.abs(g.scale.x),Math.abs(g.scale.y),Math.abs(g.scale.z));
    const loc=n=>new T.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(gInv).multiply(Sc);
    const _rm=new T.Matrix4(),_rp=new T.Vector3(),_rs=new T.Vector3();
    const rot=n=>{const q=new T.Quaternion();_rm.multiplyMatrices(gInv,n.matrixWorld).decompose(_rp,q,_rs);return q;};
    const H=S.map(b=>new T.Vector3(b.head[0],b.head[1],b.head[2]));
    const Q=new Array(S.length),Pp=new Array(S.length);

    /* 蓄力下蹲解算：重心保持在身体中线（库里半蹲：头-髋-脚踝一条垂线，屈膝+屈髋坐臀，躯干不大幅度前倾）
       AIBA 的 g.rotation.x 会在蓄力时绕脚底(0,0,0)前倾（-DIP_LEAN*load 约 10°），
       由于支点在地面，上身(头/胸/髋)会被整条甩到脚尖前方 15~32cm，变成"往前跪"。
       这里对蓄力下蹲进行反向前倾补偿和屈髋坐臀位移：
         1. 髋骨沿身体后方移动（屈髋坐臀 -Z），抵消 g 的前甩并让骨盆后坐 6.5cm；
         2. 躯干脊柱施加反向前倾补偿，使世界空间下的脊柱保持接近竖直（仅留约 2.3° 真实投篮前倾角）；
         3. 如此头、胸、骨盆与脚踝中垂线对齐，膝关节两骨 IK 自然向前送出，与库里投篮半蹲一致。 */
    const air=I.slot.air(P);
    const groundK=Math.max(0,1-Math.min(1,air/0.05));
    const isMoving=!!(P.walking||P.running||(typeof G!=="undefined"&&G&&G.moving));
    const shotLoad=(!isMoving&&P.g&&P.g.userData&&Number(P.g.userData.shotLoad))||0;
    const readyBlend=(!isMoving&&P.g&&P.g.userData&&Number(P.g.userData.shotReadyLowerBlend))||0;
    const kneeBend=Math.max(0,P.knees&&P.knees[0]?P.knees[0].rotation.x:0,P.knees&&P.knees[1]?P.knees[1].rotation.x:0);
    const loadK=groundK*Math.max(0,Math.min(1,shotLoad>0?shotLoad:(readyBlend>0?readyBlend:(isMoving?0:kneeBend/0.95))));
    const tilt=P.g?-P.g.rotation.x:0;

    let pelvisShiftZ=0,pelvisShiftY=0;
    if(loadK>0.001){
      const cosT=Math.cos(tilt),sinT=Math.sin(tilt);
      pelvisShiftZ=(-0.065*loadK - H[idx.pelvis].y*sinT)/Math.max(0.7,cosT);
      pelvisShiftY=-0.035*loadK;
    }

    const chain=(i,q)=>{
      const b=S[i];
      Q[i]=q;
      if(b.parent<0){
        Pp[i]=H[i].clone();
        if(loadK>0.001&&i===idx.pelvis){
          Pp[i].z+=pelvisShiftZ;
          Pp[i].y+=pelvisShiftY;
        }
      }else{
        Pp[i]=Pp[b.parent].clone().add(H[i].clone().sub(H[b.parent]).applyQuaternion(Q[b.parent]));
      }
    };

    /* 躯干：直接读 AIBA 胸腔在这一帧的实际朝向（胸腔叠加层把胸口以上整体绕腰转过的角度，
       jerseyShell 平时是零旋转，所以它的朝向就是那一下转动），再按 骨盆 15% / 腰 53% / 胸 100%
       分到科比的三节脊柱上，脖子回收一部分保持视线。
       在蓄力下蹲时叠加反向俯仰补偿，保持躯干近乎直立。 */
    const shell=P.g.children.find(n=>n.name==="jerseyShell");
    const qT=shell?rot(shell):new T.Quaternion(),I0=new T.Quaternion();
    let qPel=I0.clone().slerp(qT,.15),qSp=I0.clone().slerp(qT,.53),qCh=qT.clone(),qNk=I0.clone().slerp(qT,.72);

    if(loadK>0.001&&tilt>0.02){
      const counterTilt=Math.max(0,tilt-0.04)*loadK;
      const qC_pel=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-counterTilt*0.4);
      const qC_sp=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-counterTilt*0.45);
      const qC_ch=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-counterTilt*0.15);
      qPel.multiply(qC_pel);
      qSp.multiply(qC_sp);
      qCh.multiply(qC_ch);
    }

    chain(idx.pelvis, qPel);
    chain(idx.spine, qSp);
    chain(idx.chest, qCh);
    chain(idx.neck, qNk);
    chain(idx.head, P.headRoot ? rot(P.headRoot) : qNk);

    /* 腿：脚踝跟着 AIBA 脚踝的落点走，再两骨 IK 反解膝盖（膝盖朝向跟 AIBA 的膝）。
       科比腿比 AIBA 长约 1/3，照抄关节角度的话脚会迈出去太远——走路变成大弓步、脚在地上打滑。
       落点一致，长腿自然就是小角度的步子。脚掌朝向照抄 AIBA。 */
    for(const sd of ["L","R"]){const l=map.legIdx[sd],s=sd==="L"?1:-1;
      const it=idx["thigh"+sd],is=idx["shin"+sd],ifo=idx["foot"+sd];
      chain(it,Q[idx.pelvis].clone());
      const hipK=Pp[it].clone(),hipA=loc(P.legs[l]),kneeA=loc(P.knees[l]),ankA=loc(P.ankles[l]);
      const G=ankA.clone();G.x+=s*(H[ifo].x*s-.125);G.y+=H[ifo].y-.12*Sc.y;
      const L1=H[is].distanceTo(H[it]),L2=H[ifo].distanceTo(H[is]);
      /* 朝前方向取 AIBA 大腿 / 小腿自己的前轴，不从膝盖弯曲平面推：腿一伸直那个平面就退化，
         大腿会突然绕自身轴拧 90°（原地小跳每次触地短裤扭成麻花）。膝盖朝向也加上这个前轴兜底 */
      const fwT=new T.Vector3(0,0,1).applyQuaternion(rot(P.legs[l])),fwS=new T.Vector3(0,0,1).applyQuaternion(rot(P.knees[l]));
      const pole=kneeA.clone().sub(hipA.clone().add(ankA).multiplyScalar(.5)).addScaledVector(fwT,.03);
      const k=K.twoBone(hipK,G,L1,L2,[pole.x,pole.y,pole.z]);
      const d1r=H[is].clone().sub(H[it]).normalize(),d2r=H[ifo].clone().sub(H[is]).normalize();
      const d1=k.E.clone().sub(hipK).normalize(),d2=k.G.clone().sub(k.E).normalize(),Z=new T.Vector3(0,0,1);
      const f1=K.perp(fwT,d1)||K.perp(d2.clone().negate(),d1)||Z,f2=K.perp(fwS,d2)||f1;
      Q[it]=new T.Quaternion().setFromRotationMatrix(K.frameRot(d1r,Z,d1,f1));
      Q[is]=new T.Quaternion().setFromRotationMatrix(K.frameRot(d2r,Z,d2,f2));Pp[is]=k.E.clone();
      Q[ifo]=rot(P.footRoots[l]);Pp[ifo]=k.G.clone();}

    /* 手臂：两种目标，按"球在不在手里"平滑切换（0.15s）——
         自由（站立 / 走动 / 随挥）：复制 AIBA 手臂的角度（方向 + 伸展比例），不照搬手的位置。
           科比肩比 AIBA 窄 8cm，照搬位置手就垂进短裤里（"军训站姿" + 穿模）；
           另外手落到髋部高度时保证离身体一段间隙。
         持球：两只手和球整体平移同一个量（两肩偏移的平均，左右抵消后基本只剩身高差），
           AIBA 精调过的双手—球关系（辅助手扶侧面、投篮手托底）原样保留。
       肘的朝向一律跟 AIBA 自己的肘。 */
    const now=performance.now(),dtA=Math.min(.1,Math.max(0,(now-(I.tA||now))/1000));I.tA=now;
    const holding=I.slot.holding(P,ball);
    I.holdW=(I.holdW??(holding?1:0))+((holding?1:0)-(I.holdW??0))*Math.min(1,dtA/.15);
    const hw=I.holdW*I.holdW*(3-2*I.holdW);
    const handTargets={},arm={};
    for(const sd of ["L","R"]){
      const a=map.armIdx[sd],iu=idx["upperArm"+sd];
      const S0=Pp[idx.chest].clone().add(H[iu].clone().sub(H[idx.chest]).applyQuaternion(Q[idx.chest]));   // 科比肩窝（跟着胸腔转）
      arm[sd]={a,S0,Sa:loc(P.arms[a]),Ea:loc(P.elbows[a]),Wa:loc(P.handRoots[a])};
    }
    const holdShift=arm.L.S0.clone().sub(arm.L.Sa).add(arm.R.S0.clone().sub(arm.R.Sa)).multiplyScalar(.5);
    const solveArm=(sd,G,pole)=>{
      const iu=idx["upperArm"+sd],ifo=idx["foreArm"+sd],S0=arm[sd].S0,a=arm[sd].a;
      // 朝前方向取 AIBA 上臂 / 前臂自己的前轴：手臂伸直（出手）时弯曲平面退化，护套不会突然拧转
      const fwU=new T.Vector3(0,0,1).applyQuaternion(rot(P.arms[a])),fwF=new T.Vector3(0,0,1).applyQuaternion(rot(P.elbows[a]));
      const L1=H[ifo].distanceTo(H[iu]),L2=H[idx["hand"+sd]].distanceTo(H[ifo]);
      const k=K.twoBone(S0,G,L1,L2,[pole.x,pole.y,pole.z]);
      const d1r=H[ifo].clone().sub(H[iu]).normalize(),d2r=H[idx["hand"+sd]].clone().sub(H[ifo]).normalize();
      const d1=k.E.clone().sub(S0).normalize(),d2=k.G.clone().sub(k.E).normalize();
      const Z=new T.Vector3(0,0,1),f1=K.perp(fwU,d1)||K.perp(d2,d1)||Z,f2=K.perp(fwF,d2)||f1;
      Q[iu]=new T.Quaternion().setFromRotationMatrix(K.frameRot(d1r,Z,d1,f1));Pp[iu]=S0.clone();
      Q[ifo]=new T.Quaternion().setFromRotationMatrix(K.frameRot(d2r,Z,d2,f2));Pp[ifo]=k.E.clone();
      return k.G;
    };
    const target=(sd,extra)=>{
      const {S0,Sa,Ea,Wa}=arm[sd],s=sd==="L"?1:-1,iu=idx["upperArm"+sd];
      const La=Ea.distanceTo(Sa)+Wa.distanceTo(Ea),Lk=H[idx["foreArm"+sd]].distanceTo(H[iu])+H[idx["hand"+sd]].distanceTo(H[idx["foreArm"+sd]]);
      const free=S0.clone().addScaledVector(Wa.clone().sub(Sa).normalize(),Math.min(.995,Wa.distanceTo(Sa)/La)*Lk);
      /* 手垂在髋部侧面时离开身体：手腕离中线至少 .305。科比的短裤宽松，外沿约 .24，
         手掌内侧再加描边外壳（外扩约 .8cm）要留出余量，否则手的描边会顶穿短裤、背后看是两块手形黑斑。
         手摆到身前 / 身后很远时（跑动摆臂）逐渐不推，否则像叉腰 */
      const low=Math.min(1,Math.max(0,(1.22-free.y)/.2))*Math.max(0,1-Math.abs(free.z)/.28);
      if(low>0&&s*free.x<.305)free.x=s*(s*free.x+(.305-s*free.x)*low);
      const held=Wa.clone().add(holdShift).add(extra||new T.Vector3());
      // 只有在非移动且真正处于持球蓄力/投篮随挥阶段，手抬高时才维持双手相对间距(held)；
      // 跑动、移动或自由状态下一律走 free，杜绝摆臂抬高时插值突跳造成手臂闪动
      const inShotMotion=!isMoving&&(holding||(typeof G!=="undefined"&&G&&(G.charging||G.shooting)));
      const high=inShotMotion?Math.max(0,Math.min(1,(Wa.y-1.15)/0.25)):0;
      const w=Math.max(hw,high);
      return free.lerp(held,w);
    };
    const pole=sd=>{const {Sa,Ea,Wa}=arm[sd];const p=Ea.clone().sub(Sa.clone().add(Wa).multiplyScalar(.5));return p.lengthSq()>1e-6?p:new T.Vector3(sd==="L"?.3:-.3,-.2,-1);};
    // 投篮手先解；球按科比投篮手的掌心放（贴掌心、按球的实际半径），辅助手再按"球相对 AIBA 位置的偏差"跟过去
    const handQ=sd=>{const ifo=idx["foreArm"+sd],qA=rot(P.handRoots[arm[sd].a]).multiply(map.mHand[sd]);
      /* 压腕要是一条弧，不是直角：手相对前臂超过 50° 的部分只取六成，折掉的给手指卷 */
      const rel=Q[ifo].clone().invert().multiply(qA),ang=2*Math.acos(Math.min(1,Math.abs(rel.w)));
      const keep=ang>.87?(.87+(ang-.87)*.6)/ang:1;
      return {q:Q[ifo].clone().multiply(new T.Quaternion().slerp(rel,keep)),qA,curl:ang*(1-keep)*1.15+Math.max(0,ang-1.2)*.25};};
    const GR=solveArm("R",target("R"),pole("R"));
    const hR=handQ("R");Q[idx.handR]=hR.q;Pp[idx.handR]=GR.clone();
    handTargets.R={shift:GR.clone().sub(arm.R.Wa),qA:hR.qA,curl:hR.curl};
    let ballDelta=new T.Vector3(),ballK=null;
    if(holding&&ball){
      const br=.16*Math.max(ball.scale.x,.01);
      /* 掌心 / 指尖方向取 AIBA 手本身的朝向（hR.qA），不用科比放缓过的手（hR.q）：
         放缓依赖前臂扭转，出手前手臂快速伸直时会在一帧里拐一下，球就跟着横跳 11cm */
      const N=new T.Vector3(1,0,0).applyQuaternion(hR.qA),F=new T.Vector3(0,-1,0).applyQuaternion(hR.qA);   // 右手：掌心朝 +X（静止时朝身体），指尖 -Y
      ballK=GR.clone().addScaledVector(N,br+.024).addScaledVector(F,.075);
      const grip=P.ballGrips&&P.ballGrips[arm.R.a];
      if(grip)ballDelta=ballK.clone().sub(loc(grip).add(holdShift));
    }
    let targetL=target("L",ballDelta.clone().multiplyScalar(hw));
    /* 双手防穿模保护：辅助手（L，+X侧）与投篮手（R，-X侧）在持球/随挥时保持安全间距，防止左手越过中线向右（-X方向）穿模 */
    if(hw>0.05||(!isMoving&&holding)){
      // 辅助手必须在投篮手左侧（+X侧），绝不能越过投篮手穿到右边（-X侧）
      if(targetL.x<GR.x+0.06){
        targetL.x=GR.x+0.06;
      }
      const dist=targetL.distanceTo(GR);
      if(dist<0.10){
        const push=targetL.clone().sub(GR);
        if(push.x<0.05)push.x=0.05;
        push.normalize();
        targetL.copy(GR).addScaledVector(push,0.10);
      }
    }
    const GL=solveArm("L",targetL,pole("L"));
    const hL=handQ("L");Q[idx.handL]=hL.q;Pp[idx.handL]=GL.clone();
    handTargets.L={shift:GL.clone().sub(arm.L.Wa),qA:hL.qA,curl:hL.curl};
    // 手指 / 拇指
    const CURL_SHARE=[.2,.5,1];
    for(let i=0;i<S.length;i++){const b=S[i];if(b.finger==null&&!b.thumb)continue;const mm=map.m[i];
      const ht=handTargets[b.side],ih=idx["hand"+b.side];
      // 手指相对 AIBA 手掌的姿态不变，挂到科比（放缓过的）手掌上，再叠加卷指
      const relF=ht.qA.clone().invert().multiply(rot(mm.node).multiply(mm.M));
      const extra=b.finger!=null?ht.curl*CURL_SHARE[b.seg]:0,s=b.side==="L"?1:-1;
      chain(i,Q[ih].clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,-s),extra)).multiply(relF));}
    // 贴地：科比鞋底最低点对齐 AIBA 鞋底最低点
    let ours=9,theirs=9;
    for(const sd of ["L","R"]){
      const f=idx["foot"+sd],s=sd==="L"?1:-1;
      for(const dx of [-.045,.045])for(const z of [-.16,-.05,.06,.14,.2]){const p=new T.Vector3(s*.105+dx,0,z).sub(H[f]).applyQuaternion(Q[f]).add(Pp[f]);ours=Math.min(ours,p.y);}
      const fa=P.footRoots[map.legIdx[sd]];
      for(const dx of [-.08,.08])for(const z of [-.12,.2]){const p=new T.Vector3(dx,map.soleY,z).applyMatrix4(fa.matrixWorld).applyMatrix4(gInv);theirs=Math.min(theirs,p.y*Sc.y);}
    }
    /* 地板（世界 y=0）在科比空间里的高度：root 抵消了 g 的缩放，所以就是 -g.y。
       着地时鞋底直接贴地（AIBA 自己蓄力下蹲时脚会陷进地板几厘米，不照抄）；
       空中跟 AIBA 的鞋底高度走，但永远不低于地板 */
    const floor=-g.position.y;
    const off=(air>.03?Math.max(theirs,floor):floor)-ours;
    for(let i=0;i<S.length;i++){const B=I.bones[i];B.position.copy(Pp[i]);B.position.y+=off;B.quaternion.copy(Q[i]);}
    I.root.scale.set(1/Sc.x,1/Sc.y,1/Sc.z);
    I.root.updateMatrixWorld(true);
    // 手里的球：跟着投篮手（和手腕同样的平移），AIBA 出手从这里读
    if(ball){
      const a=map.armIdx.R,grip=P.ballGrips&&P.ballGrips[a];
      if(grip&&ball.parent===grip){
        const t=(ballK?ballK.clone():loc(grip).add(handTargets.R.shift));t.y+=off;t.divide(Sc);
        _w.copy(t).applyMatrix4(g.matrixWorld);
        I.ballShift=_w.clone().sub(new T.Vector3().setFromMatrixPosition(grip.matrixWorld));
        ball.position.copy(_w.applyMatrix4(_m.copy(grip.matrixWorld).invert()));
      }
    }
  }
  function toonLights(camera){
    if(STYLE!=="vox"||!camera)return;
    let key=state.key;
    if(!key||!key.parent){key=null;let best=-1;
      scene.traverse(o=>{if(o.isDirectionalLight&&o.intensity>best){best=o.intensity;key=o;}});state.key=key;}
    if(!state.ambAt||performance.now()-state.ambAt>2000){state.ambAt=performance.now();   // 场馆可能切换，隔两秒重取
      const amb=new T.Color(0,0,0);scene.traverse(o=>{
        if(o.isHemisphereLight){amb.r+=(o.color.r+o.groundColor.r)*.5*o.intensity;amb.g+=(o.color.g+o.groundColor.g)*.5*o.intensity;amb.b+=(o.color.b+o.groundColor.b)*.5*o.intensity;}
        else if(o.isAmbientLight){amb.r+=o.color.r*o.intensity;amb.g+=o.color.g*o.intensity;amb.b+=o.color.b*o.intensity;}});
      toonU.uAmb.value.set(Math.min(.6,amb.r),Math.min(.6,amb.g),Math.min(.6,amb.b));}
    if(key){_v.setFromMatrixPosition(key.matrixWorld).sub(_w.setFromMatrixPosition(key.target.matrixWorld)).normalize().transformDirection(camera.matrixWorldInverse);toonU.kD.value.copy(_v);}
  }
  /* 渲染时临时藏起 AIBA 自己的方块网格（地面软影、手里的球除外），渲染完原样恢复 */
  const hidden=[];
  function hideAIBA(I){
    const g=I.player.g,ball=I.slot.ball(I.player);
    const walk=o=>{
      if(o.userData.kobe||o===I.root)return;
      if(ball&&o===ball)return;
      if((o.isMesh||o.isLine||o.isPoints)&&o.visible&&o.userData.groundShadowBaseOpacity==null){o.visible=false;hidden.push(o);}
      for(const c of o.children)walk(c);
    };
    for(const c of g.children)walk(c);
  }
  function restoreAIBA(){for(const o of hidden)o.visible=true;hidden.length=0;}
  const visibleInScene=o=>{for(;o;o=o.parent){if(!o.visible)return false;if(o.isScene)return true;}return false;};

  function hookRenderer(){
    const svc=window.AIBA&&AIBA.runtime&&AIBA.runtime.service&&AIBA.runtime.service("rendering:core");
    const R=(svc&&svc.renderer)||(typeof renderer!=="undefined"?renderer:null);
    if(!R||R.__kobe){if(!R)setTimeout(hookRenderer,200);return;}
    R.__kobe=true;const orig=R.render.bind(R);
    R.render=function(sc,cam){
      if(!state.K)return orig(sc,cam);
      const mirror=sc&&sc.scale&&sc.scale.y<0;   // 地板倒影那一遍：沿用正常那一遍算好的骨骼
      const act=[];
      for(const I of INSTS){
        if(!mirror){const guy=I.slot.guy();if(I.slot.char()!==I.charId||guy!==I.player)tryAttach(I);}
        if(I.ready&&I.player&&I.player.g&&visibleInScene(I.player.g))act.push(I);
      }
      if(!act.length)return orig(sc,cam);
      if(!mirror)try{for(const I of act)retarget(I);toonLights(cam);}catch(e){state.lastError=e;state.errors=(state.errors||0)+1;if(!state.warned){state.warned=true;console.warn("[kobe] 重定向出错",e);}}
      for(const I of act)hideAIBA(I);
      // 传来的球原本飞向 AIBA 的手：飞行途中按进度往科比手上靠（只影响这次渲染，渲染完还原）
      const moved=[];
      for(const I of act)try{const p=I.ballShift&&I.slot.pass();if(p){const e=p.k*p.k*(3-2*p.k);moved.push([p.mesh,p.mesh.position.clone()]);p.mesh.position.addScaledVector(I.ballShift,e);}}catch(e){}
      try{return orig(sc,cam);}finally{restoreAIBA();for(const [m,p] of moved)m.position.copy(p);}
    };
  }
  hookRenderer();
})();
