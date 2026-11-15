/* Model-only detailing. No animation, camera, lighting, gameplay or random-state writes.
   ?model=classic restores this round's baseline. All authored lengths are metres. */
(function(global){
  "use strict";
  const enabled=new URLSearchParams(location.search).get("model")!=="classic";
  function envTex(){
    return typeof makeArenaEnvPMREM==="function"?makeArenaEnvPMREM():null;
  }
  function stdMat(hex,roughness,metalness,envIntensity,extra){
    const env=envTex();
    return new THREE.MeshStandardMaterial(Object.assign({
      color:hex,
      roughness:roughness==null?0.45:roughness,
      metalness:metalness==null?0.15:metalness,
      envMap:env,
      envMapIntensity:env?(envIntensity==null?0.55:envIntensity):0
    },extra||{}));
  }
  function box(g,w,h,d,x,y,z,m){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;
  }
  /* 切面斜棱柱：顶面可按 tx/tz 缩放并沿 Z 轴偏移 shearZ（用于斜面护垫、梯形机箱、斜撑壳体），
     生成后自动重算面法线，与 batch() 无缝合并。 */
  function prism(g,w,h,d,x,y,z,m,tx,tz,shearZ){
    const geom=new THREE.BoxGeometry(w,h,d).toNonIndexed();
    const p=geom.attributes.position;
    const sx=tx==null?1:tx,sz=tz==null?1:tz,sh=shearZ||0;
    for(let i=0;i<p.count;i++){
      const vy=p.getY(i);
      if(vy>0){
        p.setX(i,p.getX(i)*sx);
        p.setZ(i,p.getZ(i)*sz+sh);
      }
    }
    p.needsUpdate=true;
    geom.computeVertexNormals();
    const o=new THREE.Mesh(geom,m);
    o.position.set(x,y,z);
    g.add(o);
    return o;
  }
  function beam(g,a,b,width,depth,m){
    const delta=b.clone().sub(a),o=box(g,width,delta.length(),depth,0,0,0,m);
    o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
  }
  /* Keep actual profile vertices when static pieces are merged, unlike box rebaking.
     One draw per material; deliberately only used on non-animated groups we own. */
  function batch(g){
    const buckets=new Map();
    g.children.slice().forEach(o=>{
      if(!o.isMesh||o.children.length||Array.isArray(o.material))return;
      o.updateMatrix();let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);
      const list=buckets.get(o.material)||[];list.push(geo);buckets.set(o.material,list);
      g.remove(o);o.geometry.dispose();
    });
    buckets.forEach((geos,mat)=>{
      const result=new THREE.BufferGeometry();
      for(const key of ["position","normal","uv"]){
        const size=key==="uv"?2:3,total=geos.reduce((n,g)=>n+(g.attributes[key]?g.attributes[key].array.length:0),0);
        if(!total)continue;
        const data=new Float32Array(total);
        let offset=0;geos.forEach(g=>{if(g.attributes[key]){data.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}});
        result.setAttribute(key,new THREE.BufferAttribute(data,size));
      }
      geos.forEach(g=>g.dispose());result.computeBoundingSphere();
      const mesh=new THREE.Mesh(result,mat);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
    });return g;
  }
  function profile(mesh,bottom,top,depthBottom=bottom,depthTop=top){
    if(!enabled)return mesh;
    const geom=mesh.geometry,p=geom.attributes.position,h=geom.parameters.height;
    for(let i=0;i<p.count;i++){
      const t=Math.max(0,Math.min(1,p.getY(i)/h+.5));
      p.setXYZ(i,p.getX(i)*(bottom+(top-bottom)*t),p.getY(i),p.getZ(i)*(depthBottom+(depthTop-depthBottom)*t));
    }
    p.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingBox();geom.computeBoundingSphere();
    geom.userData.aibaProfile=true;return mesh;
  }
  /* ---------------- 三分大赛球架 ----------------
     坡度不是装饰,是真实器材的功能件:球员抽走最低那颗,后面的靠重力自己滚下来补位,
     全程不用回头找球。平托盘做不到这件事 —— 拿走一颗就留一个洞。

     槽位几何(RACK_SLOTS / SLOT_DX / SLOT_DROP)必须导出去给 props.js 摆球用。 */
  const RACK_SLOTS=5,RACK_SLOT_DX=.30,RACK_SLOT_DROP=.042;
  const RACK_BALL_Y=.41;                       // 最中间那格的球心局部高度
  function rackSlotLocal(i){
    const k=(RACK_SLOTS-1)/2;
    return {x:(i-k)*RACK_SLOT_DX,y:RACK_BALL_Y+(k-i)*RACK_SLOT_DROP};
  }
  /* 端面与长边的高精度赛事涂装贴图：带金属包边、斜向赛会饰条与 LED 像素纹理 */
  let rackEndTexCache=null,rackLongTexCache=null;
  function rackEndTex(){
    if(rackEndTexCache)return rackEndTexCache;
    rackEndTexCache=pixTex(192,192,(g,w,h)=>{
      const gr=g.createLinearGradient(0,0,0,h);
      gr.addColorStop(0,"#0d182e");gr.addColorStop(0.5,"#132342");gr.addColorStop(1,"#091120");
      g.fillStyle=gr;g.fillRect(0,0,w,h);
      g.fillStyle="rgba(255,255,255,.04)";
      for(let y=0;y<h;y+=6)g.fillRect(0,y,w,2);
      g.strokeStyle="#2e4d82";g.lineWidth=6;g.strokeRect(6,6,w-12,h-12);
      g.fillStyle="#ffd23f";g.fillRect(14,h*.52-3,w-28,5);
      g.fillStyle="#5fd8ff";g.fillRect(14,h*.52+5,w-28,2);
      g.font="bold 46px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillStyle="#ffd23f";g.fillText("aiBA",w/2,h*.30);
      g.font="bold 26px Orbitron, monospace";g.fillStyle="#f2f6ff";
      g.fillText("3PT PRO",w/2,h*.73);
    },{smooth:true,mipmaps:true});
    return rackEndTexCache;
  }
  function rackLongTex(){
    if(rackLongTexCache)return rackLongTexCache;
    rackLongTexCache=pixTex(512,160,(g,w,h)=>{
      const gr=g.createLinearGradient(0,0,w,h);
      gr.addColorStop(0,"#0a1324");gr.addColorStop(0.5,"#15274a");gr.addColorStop(1,"#0c162b");
      g.fillStyle=gr;g.fillRect(0,0,w,h);
      g.fillStyle="rgba(126,231,255,.05)";
      for(let i=-h;i<w;i+=28){
        g.beginPath();g.moveTo(i,h);g.lineTo(i+14,h);g.lineTo(i+14+h*.55,0);g.lineTo(i+h*.55,0);g.closePath();g.fill();
      }
      g.strokeStyle="#2b4a7f";g.lineWidth=6;g.strokeRect(5,5,w-10,h-10);
      g.fillStyle="#ffd23f";g.fillRect(16,14,w-32,4);g.fillRect(16,h-18,w-32,4);
      g.fillStyle="#ffd23f";g.font="bold 44px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillText("aiBA  3PT CONTEST",w/2,h*.45);
      g.fillStyle="#8fd8ff";g.font="bold 18px Orbitron, monospace";
      g.fillText("OFFICIAL SHOOTING RACK  ·  CHAMPIONSHIP SERIES",w/2,h*.78);
    },{smooth:true,mipmaps:true});
    return rackLongTexCache;
  }
  function rack(teamMat){
    const g=new THREE.Group();g.name="detailBallRack";
    const baseHex=(teamMat&&teamMat.color)?teamMat.color.getHex():0x2255aa;
    const steel=stdMat(0x8c98a8,0.25,0.78,0.70);
    const darkSteel=stdMat(0x28303d,0.38,0.58,0.50);
    const rubber=stdMat(0x181c22,0.76,0.08,0.20);
    const skirt=stdMat(0x111722,0.44,0.28,0.42);
    const coat=stdMat(baseHex,0.32,0.22,0.55);
    const adLong=new THREE.MeshBasicMaterial({map:rackLongTex(),color:0xa6b2c2});
    const adEnd=new THREE.MeshBasicMaterial({map:rackEndTex(),color:0xa6b2c2});

    const hi=rackSlotLocal(0),lo=rackSlotLocal(RACK_SLOTS-1);
    const railDrop=.115;
    const BW=1.46,BH=.52,BD=.46,BY=-.10;          // 箱体尺寸与中心高度
    box(g,BW,BH,BD,0,BY,0,skirt);                  // 芯:保证任何缝隙里都不是空的
    // 四面广告板,各自外移 6mm 贴在箱体表面(不共面,避免 z-fighting)
    for(const sz of [1,-1]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(BW*.92,BH*.74),adLong);
      m.position.set(0,BY+.015,sz*(BD/2+.006));
      if(sz<0)m.rotation.y=Math.PI;
      g.add(m);
    }
    for(const sx of [1,-1]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(BD*.84,BH*.74),adEnd);
      m.position.set(sx*(BW/2+.006),BY+.015,0);
      m.rotation.y=sx>0?Math.PI/2:-Math.PI/2;
      g.add(m);
    }
    // 上下收边:烤漆队色顶盖 + 金属压条 + 深色底裙
    box(g,BW+.045,.052,BD+.045,0,BY+BH/2+.02,0,coat);
    box(g,BW+.052,.016,BD+.052,0,BY+BH/2-.01,0,steel);
    box(g,BW+.03,.056,BD+.03,0,BY-BH/2-.014,0,darkSteel);
    box(g,BW+.055,.018,BD+.055,0,BY+BH/2-.052,0,coat);
    // 四角倒角防撞立柱 + 两端推车扶手
    for(const sx of [-1,1])for(const sz of [-1,1]){
      box(g,.052,BH+.10,.052,sx*(BW/2-.008),BY,sz*(BD/2-.008),darkSteel);
      box(g,.032,BH*.68,.032,sx*(BW/2+.014),BY+.01,sz*(BD/2+.014),steel);
    }
    for(const sx of [-1,1]){
      box(g,.026,.026,BD*.56,sx*(BW/2+.025),BY+BH/2+.01,0,steel);
    }
    /* 脚轮：段数 12 保证包围盒底精确等于 圆心(-.40)-半径(.05) = -.45，世界 min.y = 0 */
    for(const x of [-.60,.60])for(const z of [-.17,.17]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.045,12),rubber);
      wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.40,z);g.add(wheel);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,.048,8),steel);
      hub.rotation.z=Math.PI/2;hub.position.set(x,-.40,z);g.add(hub);
      box(g,.054,.088,.054,x,-.335,z,steel);
    }
    /* 放球托盘：双金属承球导轨 + 烤漆护翼 */
    const railA=new THREE.Vector3(hi.x-.10,hi.y-railDrop,0);
    const railB=new THREE.Vector3(lo.x+.10,lo.y-railDrop,0);
    for(const z of [-.14,.14]){
      const a=railA.clone(),b=railB.clone();a.z=b.z=z;
      beam(g,a,b,.046,.046,steel);
    }
    for(const z of [-.195,.195]){
      const a=railA.clone(),b=railB.clone();a.z=b.z=z;a.y+=.01;b.y+=.01;
      beam(g,a,b,.028,.058,coat);
    }
    // 导轨立柱支撑脚
    for(const kx of [-.52,0,.52])for(const z of [-.14,.14]){
      const ty=hi.y-railDrop+(lo.y-hi.y)*((kx+.60)/1.20);
      const topY=BY+BH/2+.045,h=Math.max(.03,ty-topY);
      box(g,.032,h,.032,kx,topY+h/2,z,darkSteel);
    }
    // 低端缓冲挡球头 + 橡胶防撞垫
    box(g,.05,.15,.42,lo.x+.19,lo.y-railDrop+.055,0,coat);
    box(g,.022,.11,.36,lo.x+.162,lo.y-railDrop+.06,0,rubber);
    for(let i=0;i<RACK_SLOTS;i++){
      const p=rackSlotLocal(i);
      box(g,.024,.052,.34,p.x-RACK_SLOT_DX/2,p.y-railDrop+.018,0,rubber);
    }
    return batch(g);
  }
  function pedestal(width,height,mat,ballBottom=height-.01){
    const g=new THREE.Group();g.name="detailSingleBallStand";
    const baseHex=(mat&&mat.color)?mat.color.getHex():0x1f7a28;
    const steel=stdMat(0x3a4350,0.30,0.72,0.60);
    const chrome=stdMat(0x9aa6b5,0.22,0.82,0.70);
    const accent=stdMat(baseHex,0.32,0.24,0.55);
    const rubber=stdMat(0x161a20,0.75,0.10,0.20);
    // 阶梯式配重底座（最低点严格在 -height/2）
    box(g,width,.055,width,0,-height/2+.0275,0,steel);
    prism(g,width*.88,.045,width*.88,0,-height/2+.0775,0,accent,0.76,0.76,0);
    // 主立柱 + 镀铬内芯 + 队色护套
    box(g,.12,height-.16,.12,0,-.01,0,steel);
    box(g,.085,height-.12,.085,0,.01,0,chrome);
    prism(g,.21,.34,.15,0,-.02,0,accent,0.88,0.88,0);
    // 顶部托盘与四角承球爪
    const topY=ballBottom-height/2-.0125;
    box(g,.31,.026,.31,0,topY,0,steel);
    box(g,.24,.016,.24,0,topY+.016,0,rubber);
    for(const x of [-.13,.13])box(g,.036,.038,.30,x,height/2-.019,0,accent);
    for(const z of [-.13,.13])box(g,.29,.038,.036,0,height/2-.019,z,accent);
    return batch(g);
  }
  function net(){
    const g=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0xecece6});
    const count=12,rows=5;
    const point=(row,i)=>{
      const t=row/rows,a=(i+(row%2)*.5)/count*Math.PI*2,r=.28-(.28-.16)*t;
      return new THREE.Vector3(Math.cos(a)*r,.225-.45*t,Math.sin(a)*r);
    };
    for(let row=0;row<rows;row++)for(let i=0;i<count;i++){
      const a=point(row,i);
      for(const j of [i,i+(row%2?1:-1)])beam(g,a,point(row+1,j),.006,.006,mat);
    }
    batch(g);const mesh=g.children[0];g.remove(mesh);mesh.name="diamondRopeNet";return mesh;
  }
  /* 24 秒进攻计时器 + 比赛钟双层 LED 贴图 */
  let shotClockTexCache=null,stanchionLogoTexCache=null;
  function shotClockTex(){
    if(shotClockTexCache)return shotClockTexCache;
    shotClockTexCache=pixTex(256,256,(g,w,h)=>{
      g.fillStyle="#06080d";g.fillRect(0,0,w,h);
      g.strokeStyle="#283242";g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);
      // 上栏：比赛计时器 (Game Clock)
      g.fillStyle="#0c1018";g.fillRect(16,16,w-32,62);
      g.strokeStyle="#3d495c";g.lineWidth=3;g.strokeRect(16,16,w-32,62);
      g.fillStyle="#ffd23f";g.font="bold 38px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillText("01:14.2",w/2,48);
      // 下栏：24 秒红字大屏
      g.fillStyle="#0d0608";g.fillRect(16,86,w-32,154);
      g.strokeStyle="#ff3328";g.lineWidth=4;g.strokeRect(18,88,w-36,150);
      // LED 点阵底纹
      g.fillStyle="rgba(255,60,40,.06)";
      for(let y=92;y<234;y+=6)g.fillRect(22,y,w-44,2);
      g.fillStyle="#ff382e";g.font="bold 118px Orbitron, monospace";
      g.fillText("24",w/2,168);
    },{smooth:true,mipmaps:true});
    return shotClockTexCache;
  }
  function stanchionLogoTex(){
    if(stanchionLogoTexCache)return stanchionLogoTexCache;
    stanchionLogoTexCache=pixTex(256,512,(g,w,h)=>{
      g.clearRect(0,0,w,h);
      const pad=18,bw=w-pad*2,bh=h-pad*2,r=38;
      const rr=(x,y,rw,rh,rad)=>{
        g.beginPath();
        g.moveTo(x+rad,y);
        g.lineTo(x+rw-rad,y);g.quadraticCurveTo(x+rw,y,x+rw,y+rad);
        g.lineTo(x+rw,y+rh-rad);g.quadraticCurveTo(x+rw,y+rh,x+rw-rad,y+rh);
        g.lineTo(x+rad,y+rh);g.quadraticCurveTo(x,y+rh,x,y+rh-rad);
        g.lineTo(x,y+rad);g.quadraticCurveTo(x,y,x+rad,y);
        g.closePath();
      };
      // 外层纯白圆角描边
      g.fillStyle="#ffffff";
      rr(pad,pad,bw,bh,r);
      g.fill();
      // 内层红蓝双色底（左蓝 #1d428a，右红 #c8102e）
      const inPad=11,ix=pad+inPad,iy=pad+inPad,iw=bw-inPad*2,ih=bh-inPad*2,ir=Math.max(16,r-inPad);
      g.save();
      rr(ix,iy,iw,ih,ir);
      g.clip();
      g.fillStyle="#1d428a";
      g.fillRect(ix,iy,iw*0.53,ih);
      g.fillStyle="#c8102e";
      g.fillRect(ix+iw*0.53,iy,iw*0.47,ih);
      // 白色运球球员剪影（Logoman）
      g.fillStyle="#ffffff";
      // 头部
      g.beginPath();
      g.arc(ix+iw*0.57,iy+ih*0.16,iw*0.078,0,Math.PI*2);
      g.fill();
      // 躯干与左倾动态肩背、双腿剪影
      g.beginPath();
      g.moveTo(ix+iw*0.45,iy+ih*0.23);
      g.quadraticCurveTo(ix+iw*0.67,iy+ih*0.22,ix+iw*0.75,iy+ih*0.37);
      g.quadraticCurveTo(ix+iw*0.80,iy+ih*0.46,ix+iw*0.73,iy+ih*0.52);
      g.quadraticCurveTo(ix+iw*0.64,iy+ih*0.44,ix+iw*0.59,iy+ih*0.50);
      g.lineTo(ix+iw*0.71,iy+ih*0.77);
      g.lineTo(ix+iw*0.60,iy+ih*0.81);
      g.lineTo(ix+iw*0.50,iy+ih*0.58);
      g.lineTo(ix+iw*0.36,iy+ih*0.88);
      g.lineTo(ix+iw*0.25,iy+ih*0.84);
      g.lineTo(ix+iw*0.41,iy+ih*0.51);
      g.quadraticCurveTo(ix+iw*0.31,iy+ih*0.39,ix+iw*0.45,iy+ih*0.23);
      g.closePath();
      g.fill();
      // 右侧运球篮球圆点
      g.beginPath();
      g.arc(ix+iw*0.75,iy+ih*0.57,iw*0.088,0,Math.PI*2);
      g.fill();
      // 左下角白色粗体 NBA 字样
      g.fillStyle="#ffffff";
      g.font="900 "+Math.round(ih*0.19)+"px Impact, Arial Black, sans-serif";
      g.textAlign="left";
      g.textBaseline="alphabetic";
      g.fillText("NBA",ix+iw*0.08,iy+ih*0.93);
      g.restore();
    },{smooth:true,mipmaps:true});
    return stanchionLogoTexCache;
  }
  function hoopHardware(parent,boardZ,baseZ,dir,frameMat){
    const g=new THREE.Group();g.name="detailHoopHardware";
    // 对照 NBA Spalding Arena Renegade 实物黑灰哑光配色
    const blackPad=stdMat(0x13151a,0.52,0.06,0.32);
    const blackBase=stdMat(0x181b22,0.46,0.14,0.36);
    const darkSteel=stdMat(0x1f242d,0.38,0.55,0.48);
    const steel=stdMat(0x363f4e,0.32,0.68,0.58);
    const chrome=stdMat(0xd6deea,0.18,0.88,0.82);
    const ledFrame=new THREE.MeshBasicMaterial({color:0xffaa2b});

    // 1. 篮板下沿与两侧下包角：加厚哑光黑 U 型防撞软包护垫（严格复刻参考图底部黑边与左右圆角上翻护耳）
    box(g,1.98,.11,.13,0,2.93,boardZ,blackPad);
    box(g,1.94,.035,.14,0,2.87,boardZ,blackBase);
    for(const sx of [-1,1]){
      box(g,.095,.44,.13,sx*.955,3.14,boardZ,blackPad);
      prism(g,.095,.07,.13,sx*.955,3.395,boardZ,blackPad,0.65,0.85,0);
      // 篮板玻璃内侧左上/右上角深灰金属 L 型加固角码（3D 实体层）
      box(g,.16,.038,.06,sx*.82,3.97,boardZ-dir*.02,darkSteel);
      box(g,.038,.14,.06,sx*.88,3.91,boardZ-dir*.02,darkSteel);
    }
    // 篮板内沿纤细计时灯带
    box(g,1.80,.015,.018,0,3.99,boardZ-dir*.04,ledFrame);
    for(const sx of [-1,1])box(g,.015,.96,.018,sx*.90,3.50,boardZ-dir*.04,ledFrame);

    // 2. 篮板背部中央单中柱脊梁 + 斜向加强筋（彻底取消横跨玻璃左右翼的横杆，保证玻璃两侧通透纯净）
    const spineZ=boardZ-dir*.11;
    box(g,.32,.13,.10,0,3.04,boardZ-dir*.08,darkSteel);      // 篮筐后方承力底座块
    box(g,.16,1.02,.11,0,3.50,spineZ,darkSteel);             // 中央垂直主脊柱（y=2.99..4.01）
    beam(g,
      new THREE.Vector3(-0.08,3.06,boardZ-dir*.09),
      new THREE.Vector3(0.02,3.98,spineZ),
      .12,.08,steel
    );                                                       // 靶框后方标志性斜向支撑梁
    beam(g,
      new THREE.Vector3(0,3.52,boardZ-dir*.26),
      new THREE.Vector3(0,3.98,spineZ),
      .14,.09,darkSteel
    );                                                       // 背部上端斜撑臂

    // 3. 斜伸双层主大臂（从立柱顶部 y=1.88 斜向上 34° 伸至篮板底部中央 y=3.02，复刻 NBA 折叠悬臂结构）
    beam(g,
      new THREE.Vector3(0,1.84,baseZ+dir*.08),
      new THREE.Vector3(0,3.02,boardZ-dir*.12),
      .25,.20,darkSteel
    );
    // 主大臂下方的平行副拉杆（双连杆机构）
    beam(g,
      new THREE.Vector3(0,1.62,baseZ+dir*.14),
      new THREE.Vector3(0,2.90,boardZ-dir*.16),
      .14,.08,steel
    );
    // 篮板底部中央与大臂交汇处的水平托盘座
    box(g,.28,.10,.34,0,2.98,boardZ-dir*.20,darkSteel);

    // 4. 阶梯式哑光黑配重底座 + 梯形收窄立柱护垫（复刻参考图下半部分三段式黑色护垫与后延配重箱）
    // 4a. 底部全宽橡胶防撞群边（y=0..0.06）
    box(g,1.04,.06,1.76,0,.03,baseZ-dir*.18,blackPad);
    // 4b. 前段主梯形底座箱（y=0.06..0.68，向上收窄）
    prism(g,1.02,.62,.94,0,.37,baseZ+dir*.20,blackBase,0.78,0.82,-dir*.05);
    // 4c. 后段阶梯斜顶配重延伸箱（y=0.06..0.58，向篮板反方向延伸并带斜切顶盖）
    prism(g,.96,.52,.84,0,.32,baseZ-dir*.62,blackBase,0.84,0.86,dir*.10);
    // 底座侧面竖向拼缝装饰条
    for(const sx of [-1,1]){
      box(g,.025,.56,.03,sx*.46,.32,baseZ-dir*.22,blackPad);
    }
    // 4d. 立柱正面三段式黑色防撞护垫（下段梯形收腰 y=0.68..1.14 + 中段垂直 NBA 标志柱面 y=1.14..1.88 + 上段斜切顶罩 y=1.88..2.04）
    prism(g,.68,.46,.42,0,.91,baseZ+dir*.18,blackPad,0.68,0.86,-dir*.03);
    box(g,.462,.74,.36,0,1.51,baseZ+dir*.15,blackPad);
    prism(g,.462,.16,.36,0,1.96,baseZ+dir*.15,blackPad,0.82,0.72,-dir*.04);
    // 4e. 护垫后方双侧深灰钢制立柱槽钢与铰接轴销（y=0.68..2.14）
    for(const sx of [-1,1]){
      box(g,.085,1.46,.22,sx*.15,1.41,baseZ-dir*.05,darkSteel);
    }
    box(g,.38,.12,.20,0,2.08,baseZ-dir*.04,darkSteel);
    box(g,.42,.04,.04,0,1.84,baseZ+dir*.04,chrome);
    box(g,.40,.035,.035,0,1.42,baseZ-dir*.14,chrome);

    // 5. 篮板正上方：24 秒进攻计时器塔（Shot Clock Tower，由中央脊柱向上延伸）
    const scZ=boardZ-dir*.14;
    box(g,.14,.42,.11,0,4.18,scZ,darkSteel);                // 计时器底部支架底座
    box(g,.64,.58,.20,0,4.62,scZ,darkSteel);                // 计时器主机箱
    prism(g,.70,.07,.26,0,4.94,scZ,steel,0.92,0.88,0);      // 顶部遮光檐
    box(g,.66,.035,.22,0,4.99,scZ,ledFrame);                // 顶部蜂鸣红黄灯条
    batch(g);

    // 6. 独立贴图面片（24秒双面 LED 屏 + 立柱正面官方 NBA Logoman 垂直徽标）
    const scMat=new THREE.MeshBasicMaterial({map:shotClockTex(),color:0xd8e0ea});
    for(const f of [1,-1]){
      const scr=new THREE.Mesh(new THREE.PlaneGeometry(.56,.50),scMat);
      scr.position.set(0,4.62,scZ+f*.104);
      if(f<0)scr.rotation.y=Math.PI;
      g.add(scr);
    }
    const logoMat=new THREE.MeshBasicMaterial({map:stanchionLogoTex(),transparent:true,color:0xf2f6fc});
    const padFace=new THREE.Mesh(new THREE.PlaneGeometry(.22,.44),logoMat);
    padFace.position.set(0,1.50,baseZ+dir*.334);
    padFace.rotation.y=dir>0?0:Math.PI;
    g.add(padFace);

    parent.add(g);return g;
  }
  /* ---------- 阶段 5：看台分区双层扶手 ---------- */
  function railParts(lanes,color,postH){
    const parts=[],up=new THREE.Vector3(0,1,0),mm=new THREE.Matrix4(),q=new THREE.Quaternion();
    const c=new THREE.Color(color),cDark=new THREE.Color(color).multiplyScalar(0.68),ident=new THREE.Quaternion();
    for(const lane of lanes){
      for(let i=0;i<lane.length;i++){
        const p=lane[i];
        mm.compose(new THREE.Vector3(p[0],p[1]+postH/2,p[2]),ident,new THREE.Vector3(.055,postH,.055));
        parts.push({color:cDark,matrix:mm.clone()});
        // 底座法兰盘
        mm.compose(new THREE.Vector3(p[0],p[1]+.02,p[2]),ident,new THREE.Vector3(.11,.04,.11));
        parts.push({color:cDark,matrix:mm.clone()});
        if(i+1>=lane.length)continue;
        const n=lane[i+1];
        for(const [hFrac,thick,col] of [[1.0,.052,c],[0.54,.036,cDark]]){
          const a=new THREE.Vector3(p[0],p[1]+postH*hFrac,p[2]);
          const b=new THREE.Vector3(n[0],n[1]+postH*hFrac,n[2]);
          const d=b.clone().sub(a),len=d.length();
          if(len<1e-4)continue;
          q.setFromUnitVectors(up,d.normalize());
          mm.compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(thick,len,thick));
          parts.push({color:col,matrix:mm.clone()});
        }
      }
    }
    return parts;
  }

  /* ---------- 阶段 5：记者区专业长焦摄像机位 ---------- */
  function pressRow(z,xs){
    const parts=[],mm=new THREE.Matrix4(),ident=new THREE.Quaternion();
    const stool=new THREE.Color(0x252c3a),steel=new THREE.Color(0x4b5668),body=new THREE.Color(0x12161d),hood=new THREE.Color(0x0b0e13),accent=new THREE.Color(0xc89d3c);
    const put=(col,w,h,d,x,y,zz,tx,tz)=>{
      mm.compose(new THREE.Vector3(x,y,zz),ident,new THREE.Vector3(w,h,d));
      parts.push({color:col,matrix:mm.clone(),taperX:tx,taperZ:tz});
    };
    for(const x of xs){
      put(stool,.44,.075,.40,x,.40,z,0.92,0.92);            // 软垫折凳面
      for(const dx of [-.16,.16])for(const dz of [-.14,.14])
        put(steel,.035,.40,.035,x+dx,.20,z+dz);             // 凳腿
      const tz=z-.42;                                        // 三脚架略靠球场一侧
      put(steel,.055,.62,.055,x,.31,tz);
      for(const a of [0,2.1,4.2])
        put(steel,.032,.36,.032,x+Math.cos(a)*.18,.18,tz+Math.sin(a)*.18);
      put(body,.24,.15,.32,x,.69,tz,0.90,0.94);             // 广播级摄像机机身
      put(accent,.25,.025,.28,x,.62,tz);                    // 快装板金边
      put(steel,.12,.12,.18,x,.69,tz-.22);                  // 长焦白炮镜身
      put(hood,.15,.14,.10,x,.69,tz-.34,1.18,1.0);          // 遮光斗(Matte Box)
    }
    return parts;
  }

  global.AIBAModelDetail=Object.freeze({enabled,revision:"model-detail-03",profile,rack,pedestal,net,hoopHardware,box,prism,batch,railParts,pressRow,stdMat,
    RACK_SLOTS,RACK_SLOT_DX,RACK_SLOT_DROP,rackSlotLocal});
})(window);
