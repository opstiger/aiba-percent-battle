/* ---------------- 篮筐组动力学（PH-3 接触质感 + M1 篮筐组建模） ----------------
   计划见 docs/PHYSICS_PLAN-20260924.md。

   旧篮网是一次统一的形变脉冲，和球从哪儿进、撞多重无关；篮筐和篮板是焊死的静态块。
   这里把近端篮筐组做成"会动的器材"：
     - 篮筐：圆环 + 连接件 + 12 个挂网钩，以篮板上的铰链为轴。被砸时前沿下压、快速颤回
       （真实比赛用的是可回弹的 breakaway 篮筐）。幅度按碰撞冲量。
     - 篮板：以支撑臂为轴轻微晃动，篮筐跟着一起动。
     - 篮网：Verlet 绳网。菱形网结与原 AIBAModelDetail.net() 完全一致（12 列 × 6 行），
       顶端挂在篮筐挂钩上跟着篮筐颤；任何经过的球（物理球、旧系统的球、回放幽灵球）
       都会把网真实推开、拖拽，再弹回原形。
   碰撞几何（ball-physics.js）是静态的；这里的晃动是厘米级的视觉反馈，不回写物理。

   对外：
     AIBAHoopDynamics.buildNear(grp,{rimMat,boardParts})  由 hoop.js 调用
     AIBAHoopDynamics.impact(type,{x,y,z,impulse})        type: rim / board / connector
     AIBAHoopDynamics.kick(amount,dir)                     兼容旧 pulseNet（过场等）
     AIBAHoopDynamics.update(dt)                           由 hoop.js 的 updateNetPulse 每帧调用 */
(function(global){
  "use strict";
  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const RIM={R:.30,tube:.035};                  // 与 ball-physics.js GEOM.rim 一致
  const BOARD_FACE_Z=-8.56,BOARD_ARM_Y=3.45,BOARD_BACK_Z=-8.68;

  /* 阻尼弹簧：a 角度（弧度），v 角速度。f 频率 Hz，zeta 阻尼比。 */
  function spring(f,zeta){return {a:0,v:0,w:2*Math.PI*f,z:zeta};}
  function stepSpring(s,dt){
    // 半隐式欧拉，dt 已被切成 ≤ 1/240
    const acc=-s.w*s.w*s.a-2*s.z*s.w*s.v;
    s.v+=acc*dt;s.a+=s.v*dt;
    if(Math.abs(s.a)<1e-5&&Math.abs(s.v)<1e-4){s.a=0;s.v=0;}
  }

  const state={
    built:false,hoop:null,
    boardPivot:null,rimPivot:null,
    rimPitch:spring(9,.14),rimRoll:spring(11,.16),boardPitch:spring(5.5,.09),
    net:null,lastContactT:-9,clock:0
  };

  /* ---------- 篮筐（圆环 + 连接件 + 挂网钩） ---------- */
  function buildRimMeshes(parent,center,dir,mat){
    // parent 的原点就是铰链；center 是篮筐中心相对铰链的偏移
    const ring=new THREE.Mesh(new THREE.TorusGeometry(RIM.R,RIM.tube,8,32),mat);
    ring.rotation.x=Math.PI/2;ring.position.copy(center);ring.name="rimRing";
    ring.castShadow=true;parent.add(ring);
    // 连接件：从圈后沿伸到铰链（篮板面）
    const back=center.z-dir*RIM.R,len=Math.abs(back),conn=new THREE.Mesh(new THREE.BoxGeometry(.12,.06,len+.02),mat);
    conn.position.set(center.x,center.y-.005,back/2);conn.name="rimConnector";parent.add(conn);
    // 连接件下方的斜撑片（真实篮筐有一块三角加强板）
    const gusset=new THREE.Mesh(new THREE.BoxGeometry(.05,.09,len*.7),mat);
    gusset.position.set(center.x,center.y-.06,back*.4);gusset.rotation.x=dir*.35;parent.add(gusset);
    // 12 个挂网钩：圈管下方的小环，网就挂在这里
    const hookGeo=new THREE.BoxGeometry(.022,.035,.022);
    const hooks=[];
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2,h=new THREE.Mesh(hookGeo,mat);
      h.position.set(center.x+Math.cos(a)*(RIM.R-.004),center.y-RIM.tube-.012,center.z+Math.sin(a)*(RIM.R-.004));
      parent.add(h);hooks.push(h);
    }
    return {ring,conn,hooks};
  }

  /* ---------- Verlet 绳网 ---------- */
  const NET={cols:12,rows:6,topR:.285,botR:.17,depth:.46,rope:.0065};
  function buildNet(mesh){
    const cols=NET.cols,rows=NET.rows,n=cols*(rows+1);
    const pos=new Float32Array(n*3),prev=new Float32Array(n*3),rest=new Float32Array(n*3);
    const idx=(r,i)=>r*cols+((i%cols)+cols)%cols;
    for(let r=0;r<=rows;r++)for(let i=0;i<cols;i++){
      const t=r/rows,a=(i+(r%2)*.5)/cols*Math.PI*2,rad=NET.topR+(NET.botR-NET.topR)*Math.pow(t,.85);
      const k=idx(r,i)*3;
      // rest：相对篮筐中心的局部坐标（篮筐坐标系）
      rest[k]=Math.cos(a)*rad;rest[k+1]=-NET.depth*t-RIM.tube-.02;rest[k+2]=Math.sin(a)*rad;
    }
    const links=[],rings=[];
    for(let r=0;r<rows;r++)for(let i=0;i<cols;i++){
      // 菱形网结：与 model-detail.js net() 同一拓扑
      for(const j of (r%2===0?[i-1,i]:[i,i+1]))links.push([idx(r,i),idx(r+1,j)]);
    }
    for(let r=1;r<=rows;r++)for(let i=0;i<cols;i++)rings.push([idx(r,i),idx(r,i+1)]);
    const restLen=(pair)=>{const a=pair[0]*3,b=pair[1]*3;return Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2]);};
    const linkLen=Float32Array.from(links.map(restLen)),ringLen=Float32Array.from(rings.map(restLen));
    // 渲染：每段绳子两片互相垂直的窄条（任何机位都看得见），8 顶点 / 4 三角
    const segs=links.length,geo=new THREE.BufferGeometry();
    const vtx=new Float32Array(segs*8*3),index=[];
    for(let s=0;s<segs;s++){const o=s*8;index.push(o,o+1,o+2,o+2,o+1,o+3,o+4,o+5,o+6,o+6,o+5,o+7);}
    geo.setAttribute("position",new THREE.BufferAttribute(vtx,3));
    geo.setIndex(index);
    const net={mesh,geo,vtx,pos,prev,rest,restWorld:new Float32Array(n*3),links,rings,linkLen,ringLen,idx,n,acc:0,ready:false};
    return net;
  }

  const tmpV=new THREE.Vector3(),tmpM=new THREE.Matrix4();
  /* 篮筐坐标系 → 世界。rimPivot 的世界矩阵含篮板晃动与篮筐下压。 */
  function rimToWorld(out,x,y,z){
    tmpV.set(x,y,z).add(state.rimCenterLocal).applyMatrix4(state.rimPivot.matrixWorld);
    out[0]=tmpV.x;out[1]=tmpV.y;out[2]=tmpV.z;
  }
  const w3=[0,0,0];
  function resetNet(net){
    state.rimPivot.updateMatrixWorld(true);
    for(let p=0;p<net.n;p++){
      const k=p*3;rimToWorld(w3,net.rest[k],net.rest[k+1],net.rest[k+2]);
      net.pos[k]=net.prev[k]=w3[0];net.pos[k+1]=net.prev[k+1]=w3[1];net.pos[k+2]=net.prev[k+2]=w3[2];
    }
    net.ready=true;
  }

  /* 附近的球：场上所有球 + 回放幽灵球。返回 [x,y,z,vx,vy,vz] 列表（速度按上一帧位置估算）。 */
  const lastBallPos=new WeakMap(),ballBuf=[];
  function gatherBalls(dt){
    ballBuf.length=0;
    const h=state.hoop,consider=mesh=>{
      if(!mesh||!mesh.visible)return;
      const p=mesh.getWorldPosition?mesh.getWorldPosition(tmpV):mesh.position;
      const dx=p.x-h.x,dy=p.y-(h.y-.25),dz=p.z-h.z;
      const last=lastBallPos.get(mesh);
      lastBallPos.set(mesh,[p.x,p.y,p.z]);
      if(dx*dx+dy*dy+dz*dz>1.1)return;
      const inv=dt>0?1/dt:0;
      ballBuf.push([p.x,p.y,p.z,last?(p.x-last[0])*inv:0,last?(p.y-last[1])*inv:0,last?(p.z-last[2])*inv:0]);
    };
    try{if(typeof balls!=="undefined")for(const b of balls)consider(b.mesh);}catch(e){}
    try{if(typeof rep!=="undefined"&&rep&&rep.on&&rep.ghost)consider(rep.ghost);}catch(e){}
    return ballBuf;
  }

  const SUB=1/120,BALL_R=.16;
  /* 休眠：没有球靠近、篮筐篮板也静止时，网已经停在挂好的形状上，整段模拟直接跳过。
     这也让"原状"有精确定义（残余晃动 < .2mm 就吸附到静止形状，复位测试要求 1e-6）。 */
  function springsQuiet(){
    return state.rimPitch.a===0&&state.rimPitch.v===0&&state.rimRoll.a===0&&state.rimRoll.v===0&&state.boardPitch.a===0&&state.boardPitch.v===0;
  }
  function simulateNet(net,dt){
    if(!net.ready)resetNet(net);
    const list=gatherBalls(dt);
    if(net.asleep&&!list.length&&springsQuiet())return;
    net.asleep=false;
    net.acc=Math.min(net.acc+dt,SUB*4);
    const pos=net.pos,prev=net.prev,rest=net.rest,cols=NET.cols;
    while(net.acc>=SUB){
      net.acc-=SUB;
      // 顶排钉在挂网钩上（跟着篮筐一起动）
      for(let i=0;i<cols;i++){
        const k=i*3;rimToWorld(w3,rest[k],rest[k+1],rest[k+2]);
        prev[k]=pos[k];prev[k+1]=pos[k+1];prev[k+2]=pos[k+2];
        pos[k]=w3[0];pos[k+1]=w3[1];pos[k+2]=w3[2];
      }
      // 积分 + 形状记忆（尼龙网有挺度，会回到锥形）
      const rw=net.restWorld;
      for(let p=cols;p<net.n;p++){
        const k=p*3;
        rimToWorld(w3,rest[k],rest[k+1],rest[k+2]);
        rw[k]=w3[0];rw[k+1]=w3[1];rw[k+2]=w3[2];
        const vx=(pos[k]-prev[k])*.975,vy=(pos[k+1]-prev[k+1])*.975,vz=(pos[k+2]-prev[k+2])*.975;
        const mem=55*SUB*SUB;
        prev[k]=pos[k];prev[k+1]=pos[k+1];prev[k+2]=pos[k+2];
        pos[k]+=vx+(w3[0]-pos[k])*mem;
        /* 不加常量重力：rest 形状本身就是"挂好的网"，重力已经折进去了。
           这样静止时严格等于 rest，复位（pulseNet(0)）才有明确的"原状"可回；
           下垂与回弹由球的拖拽和形状记忆表现。 */
        pos[k+1]+=vy+(w3[1]-pos[k+1])*mem;
        pos[k+2]+=vz+(w3[2]-pos[k+2])*mem;
      }
      // 球：把网结推到球面外，并带一部分球速（摩擦拖拽）
      for(const b of list){
        const rr=BALL_R+NET.rope*1.6;
        for(let p=cols;p<net.n;p++){
          const k=p*3,dx=pos[k]-b[0],dy=pos[k+1]-b[1],dz=pos[k+2]-b[2],d2=dx*dx+dy*dy+dz*dz;
          if(d2>=rr*rr||d2<1e-10)continue;
          const d=Math.sqrt(d2),push=(rr-d)/d;
          pos[k]+=dx*push;pos[k+1]+=dy*push;pos[k+2]+=dz*push;
          /* 摩擦只往下、往外带：磕筐弹起的球若把网往上拽，网会整张翻到篮筐上面挂着
             （截帧实测出现过）。现实里网几乎只会被球往下拉。 */
          const drag=.55,bvy=Math.min(0,b[4]);
          prev[k]+=(pos[k]-prev[k]-b[3]*SUB)*drag;
          prev[k+1]+=(pos[k+1]-prev[k+1]-bvy*SUB)*drag;
          prev[k+2]+=(pos[k+2]-prev[k+2]-b[5]*SUB)*drag;
          state.lastContactT=state.clock;
        }
      }
      // 绳子：只限最大长度（绳子能松不能拉长）；横向软弹簧保持网口张开
      for(let it=0;it<4;it++){
        for(let l=0;l<net.links.length;l++){
          const a=net.links[l][0]*3,b=net.links[l][1]*3;
          const dx=pos[b]-pos[a],dy=pos[b+1]-pos[a+1],dz=pos[b+2]-pos[a+2],d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-9;
          const L=net.linkLen[l];if(d<=L)continue;
          const c=(d-L)/d,pa=net.links[l][0]<cols?0:.5,pb=net.links[l][0]<cols?1:.5;
          pos[a]+=dx*c*pa;pos[a+1]+=dy*c*pa;pos[a+2]+=dz*c*pa;
          pos[b]-=dx*c*pb;pos[b+1]-=dy*c*pb;pos[b+2]-=dz*c*pb;
        }
        for(let l=0;l<net.rings.length;l++){
          const a=net.rings[l][0]*3,b=net.rings[l][1]*3;
          const dx=pos[b]-pos[a],dy=pos[b+1]-pos[a+1],dz=pos[b+2]-pos[a+2],d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-9;
          const c=(d-net.ringLen[l])/d*.12;
          pos[a]+=dx*c;pos[a+1]+=dy*c;pos[a+2]+=dz*c;
          pos[b]-=dx*c;pos[b+1]-=dy*c;pos[b+2]-=dz*c;
        }
      }
      // 防翻：网结最多比静止位置高 6cm，再高就把向上的速度吃掉
      for(let p=cols;p<net.n;p++){
        const k=p*3,cap=rw[k+1]+.06;
        if(pos[k+1]>cap){pos[k+1]=cap;if(prev[k+1]<pos[k+1])prev[k+1]=pos[k+1];}
      }
    }
    // 入睡：离静止形状和速度都足够小，就精确吸附回去
    if(!list.length&&springsQuiet()){
      const rw=net.restWorld;let dev=0;
      for(let p=cols;p<net.n;p++){
        const k=p*3;
        dev=Math.max(dev,Math.abs(pos[k]-rw[k]),Math.abs(pos[k+1]-rw[k+1]),Math.abs(pos[k+2]-rw[k+2]),
          Math.abs(pos[k]-prev[k]),Math.abs(pos[k+1]-prev[k+1]),Math.abs(pos[k+2]-prev[k+2]));
      }
      if(dev<2e-4){resetNet(net);net.asleep=true;}
    }
    writeNetGeometry(net);
  }

  function writeNetGeometry(net){
    const pos=net.pos,v=net.vtx,mp=net.mesh.position,w=NET.rope;
    for(let s=0;s<net.links.length;s++){
      const a=net.links[s][0]*3,b=net.links[s][1]*3;
      const ax=pos[a]-mp.x,ay=pos[a+1]-mp.y,az=pos[a+2]-mp.z,bx=pos[b]-mp.x,by=pos[b+1]-mp.y,bz=pos[b+2]-mp.z;
      let dx=bx-ax,dy=by-ay,dz=bz-az;const dl=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;dx/=dl;dy/=dl;dz/=dl;
      // p1 = d × up（水平），p2 = d × p1
      let p1x=-dz,p1y=0,p1z=dx;const l1=Math.sqrt(p1x*p1x+p1z*p1z)||1;p1x/=l1;p1z/=l1;
      const p2x=dy*p1z-dz*p1y,p2y=dz*p1x-dx*p1z,p2z=dx*p1y-dy*p1x;
      const o=s*24;
      const put=(i,x,y,z)=>{v[o+i*3]=x;v[o+i*3+1]=y;v[o+i*3+2]=z;};
      put(0,ax-p1x*w,ay-p1y*w,az-p1z*w);put(1,ax+p1x*w,ay+p1y*w,az+p1z*w);
      put(2,bx-p1x*w,by-p1y*w,bz-p1z*w);put(3,bx+p1x*w,by+p1y*w,bz+p1z*w);
      put(4,ax-p2x*w,ay-p2y*w,az-p2z*w);put(5,ax+p2x*w,ay+p2y*w,az+p2z*w);
      put(6,bx-p2x*w,by-p2y*w,bz-p2z*w);put(7,bx+p2x*w,by+p2y*w,bz+p2z*w);
    }
    net.geo.attributes.position.needsUpdate=true;
    // 自己写的顶点没有法线，受光材质会整片发黑；~1000 顶点，每帧重算很便宜
    net.geo.computeVertexNormals();
  }

  /* ---------- 构建（hoop.js 调用） ---------- */
  function buildNear(grp,opts){
    opts=opts||{};
    const hoop=opts.hoop,dir=-1;                 // 近端篮板在 −z
    state.hoop=hoop;
    // 篮板支点：支撑臂末端（篮板背后上方）
    const boardPivot=new THREE.Group();boardPivot.name="boardPivot";
    boardPivot.position.set(hoop.x,BOARD_ARM_Y,BOARD_BACK_Z);grp.add(boardPivot);
    (opts.boardParts||[]).forEach(o=>{
      if(!o)return;
      o.position.sub(boardPivot.position);boardPivot.add(o);
    });
    // 篮筐铰链：篮板面上、篮筐高度
    const rimPivot=new THREE.Group();rimPivot.name="rimPivot";rimPivot.userData.keepOutdoor=true;
    rimPivot.position.set(hoop.x-boardPivot.position.x,hoop.y-boardPivot.position.y,BOARD_FACE_Z-boardPivot.position.z);
    boardPivot.add(rimPivot);
    boardPivot.userData.keepOutdoor=true;
    state.rimCenterLocal=new THREE.Vector3(0,0,hoop.z-BOARD_FACE_Z);
    buildRimMeshes(rimPivot,state.rimCenterLocal,dir,opts.rimMat);
    state.boardPivot=boardPivot;state.rimPivot=rimPivot;
    // 篮网网格：位置与旧 netMesh 相同（测试和取景代码读 netMesh.position）
    const mat=new THREE.MeshLambertMaterial({color:0xecece6,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(new THREE.BufferGeometry(),mat);
    mesh.position.set(hoop.x,hoop.y-.26,hoop.z);mesh.name="clothNet";mesh.frustumCulled=false;
    mesh.userData.keepOutdoor=true;
    const net=buildNet(mesh);mesh.geometry.dispose();mesh.geometry=net.geo;
    grp.add(mesh);
    state.net=net;state.built=true;
    grp.updateMatrixWorld(true);resetNet(net);writeNetGeometry(net);
    return {mesh,rimPivot,boardPivot};
  }

  /* ---------- 冲击 ---------- */
  function impact(type,e){
    if(!state.built||!e)return;
    const J=clamp(Number(e.impulse)||2.5,0,12),h=state.hoop;
    if(type==="rim"){
      // 前沿（离铰链远）砸得越靠前，下压越多；侧面砸带一点侧倾
      const lever=clamp((e.z-BOARD_FACE_Z)/(h.z-BOARD_FACE_Z+RIM.R),0,1);
      const side=clamp((e.x-h.x)/RIM.R,-1,1);
      state.rimPitch.v+=J*.4*(.25+.75*lever);
      state.rimRoll.v+=J*.28*side;
      if(state.net)nudgeNet(J*.004);
    }else if(type==="board"||type==="connector"){
      // 球打在支点（支撑臂）下方的板面上，板的下半部往后倒 = 绕 x 轴正转
      state.boardPitch.v+=J*.05;
      state.rimPitch.v+=J*.12;
    }
  }
  /* 篮筐一颤，网也跟着抖一下（顶排已经跟着动，这里给下面几排一点随动速度） */
  function nudgeNet(amount){
    const net=state.net;if(!net||!net.ready)return;
    net.asleep=false;
    for(let p=NET.cols;p<net.n;p++){const k=p*3;net.prev[k+1]+=amount*(1+(p/NET.cols|0)*.25);}
  }
  /* 兼容旧 pulseNet：过场、回放、旧系统进球仍会调用。刚被真实球碰过就不再额外抖，免得双响。 */
  function kick(amount,dir){
    const net=state.net;if(!net||!net.ready)return false;
    if(state.clock-state.lastContactT<.35)return false;
    const a=clamp(Number(amount)||0,0,1.4),d=clamp(Number(dir)||0,-1,1);
    net.asleep=false;
    for(let p=NET.cols;p<net.n;p++){
      const k=p*3,row=(p/NET.cols|0)/NET.rows;
      const dx=net.pos[k]-state.hoop.x,dz=net.pos[k+2]-state.hoop.z,r=Math.hypot(dx,dz)||1;
      // 往下拽 + 往外鼓 + 按方向偏一点（与旧 deformNet 同一套视觉语言，但由绳网自己弹回）
      net.prev[k+1]+=a*.022*row;
      net.prev[k]-=a*.006*row*dx/r+a*d*.006*row;
      net.prev[k+2]-=a*.006*row*dz/r;
    }
    return true;
  }

  /* 复位：篮筐/篮板弹簧归零，网回到挂好的原状（旧 pulseNet(0) 语义） */
  function reset(){
    if(!state.built)return;
    for(const s of [state.rimPitch,state.rimRoll,state.boardPitch]){s.a=0;s.v=0;}
    state.rimPivot.rotation.set(0,0,0);state.boardPivot.rotation.x=0;
    state.boardPivot.updateMatrixWorld(true);
    if(state.net){state.net.acc=0;resetNet(state.net);state.net.asleep=true;writeNetGeometry(state.net);}
  }
  function update(dt){
    if(!state.built)return;
    const safe=clamp(Number(dt)||0,0,.05);
    state.clock+=safe;
    // 弹簧按 ≤1/240 切片，帧率不同结果一致
    let left=safe;
    while(left>1e-6){
      const h=Math.min(left,1/240);
      stepSpring(state.rimPitch,h);stepSpring(state.rimRoll,h);stepSpring(state.boardPitch,h);
      left-=h;
    }
    const rp=clamp(state.rimPitch.a,-.02,.09),rr=clamp(state.rimRoll.a,-.05,.05),bp=clamp(state.boardPitch.a,-.03,.03);
    state.rimPivot.rotation.set(rp,0,rr);
    state.boardPivot.rotation.x=bp;
    state.boardPivot.updateMatrixWorld(true);
    if(state.net&&state.net.mesh.visible!==false&&safe>0)simulateNet(state.net,safe);
  }

  /* 远端装饰篮筐：同一套圆环篮筐外观，静态（不接冲击、不跑绳网）。 */
  function buildStaticRim(grp,hoop,boardFaceZ,dir,mat){
    const hinge=new THREE.Group();hinge.name="staticRim";hinge.userData.keepOutdoor=true;
    hinge.position.set(hoop.x,hoop.y,boardFaceZ);grp.add(hinge);
    buildRimMeshes(hinge,new THREE.Vector3(0,0,hoop.z-boardFaceZ),dir,mat);
    return hinge;
  }
  global.AIBAHoopDynamics=Object.freeze({
    buildNear,buildStaticRim,impact,kick,reset,update,
    get state(){return state;},
    netConfig:NET
  });
})(window);
