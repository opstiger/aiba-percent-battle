/* Model-only detailing. No animation, camera, lighting, gameplay or random-state writes.
   ?model=classic restores this round's baseline. All authored lengths are metres. */
(function(global){
  "use strict";
  const enabled=new URLSearchParams(location.search).get("model")!=="classic";
  function box(g,w,h,d,x,y,z,m){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;
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
        const size=key==="uv"?2:3,total=geos.reduce((n,g)=>n+g.attributes[key].array.length,0),data=new Float32Array(total);
        let offset=0;geos.forEach(g=>{data.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;});
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

     槽位几何(RACK_SLOTS / SLOT_DX / SLOT_DROP)必须导出去给 props.js 摆球用。
     两边各写一份的话,改了坡度球就会浮在轨道外面 —— 这类"同一组数写两遍"的坑
     这个项目里已经踩过好几次。 */
  const RACK_SLOTS=5,RACK_SLOT_DX=.30,RACK_SLOT_DROP=.042;
  const RACK_BALL_Y=.41;                       // 最中间那格的球心局部高度
  function rackSlotLocal(i){
    const k=(RACK_SLOTS-1)/2;
    return {x:(i-k)*RACK_SLOT_DX,y:RACK_BALL_Y+(k-i)*RACK_SLOT_DROP};
  }
  /* 端面用的方形广告贴图。bannerTex 是 768x144(5.33:1)的长条,
     贴到 0.44x0.52 的端面上会被拉成一坨糊字,所以短边单独画一张。 */
  let rackEndTexCache=null;
  function rackEndTex(){
    if(rackEndTexCache)return rackEndTexCache;
    rackEndTexCache=pixTex(192,192,(g,w,h)=>{
      g.fillStyle="#13213f";g.fillRect(0,0,w,h);
      g.fillStyle="rgba(255,255,255,.05)";
      for(let i=0;i<w;i+=16)g.fillRect(i,0,8,h);
      g.fillStyle="#ffd23f";g.fillRect(0,h*.5-3,w,6);
      g.font="bold 44px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillStyle="#ffd23f";g.fillText("aiBA",w/2,h*.28);
      g.font="bold 26px Orbitron, monospace";g.fillStyle="#f2f6ff";
      g.fillText("3PT",w/2,h*.72);
    },{smooth:true});
    return rackEndTexCache;
  }
  function rack(teamMat){
    const g=new THREE.Group();g.name="detailBallRack";
    const steel=new THREE.MeshLambertMaterial({color:0x59636f});
    const rubber=new THREE.MeshLambertMaterial({color:0x20252b});
    const skirt=new THREE.MeshLambertMaterial({color:0x161c26});
    /* 广告面压光到 0x9aa3b2:它离镜头很近,满亮会在近景抢过主角。 */
    const adLong=typeof bannerTex==="function"
      ?new THREE.MeshBasicMaterial({map:bannerTex("aiBA 3PT CONTEST","#13213f","#ffd23f"),color:0x9aa3b2})
      :new THREE.MeshLambertMaterial({color:0x13213f});
    const adEnd=new THREE.MeshBasicMaterial({map:rackEndTex(),color:0x9aa3b2});

    const hi=rackSlotLocal(0),lo=rackSlotLocal(RACK_SLOTS-1);
    const railDrop=.115;
    /* ---------------- 箱体 ----------------
       上一版是"开放钢架 + 一块挂牌",验收原话是"铁架贴了块纸皮"。
       真实三分大赛的架子是**封闭的带轮广告箱**:四面都是赞助商板,
       上面才是放球的托盘。所以这里先做一个实心箱体,再在四面贴广告。 */
    const BW=1.46,BH=.52,BD=.46,BY=-.10;          // 箱体尺寸与中心高度
    box(g,BW,BH,BD,0,BY,0,skirt);                  // 芯:保证任何缝隙里都不是空的
    // 四面广告板,各自外移 1cm 贴在箱体表面(不共面,避免 z-fighting)
    for(const sz of [1,-1]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(BW*.94,BH*.72),adLong);
      m.position.set(0,BY+.02,sz*(BD/2+.006));
      if(sz<0)m.rotation.y=Math.PI;
      g.add(m);
    }
    for(const sx of [1,-1]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(BD*.86,BH*.72),adEnd);
      m.position.set(sx*(BW/2+.006),BY+.02,0);
      m.rotation.y=sx>0?Math.PI/2:-Math.PI/2;
      g.add(m);
    }
    // 上下收边:队色顶盖 + 深色底裙,箱体因此有"做工"而不是一块平板
    box(g,BW+.05,.055,BD+.05,0,BY+BH/2+.02,0,teamMat);
    box(g,BW+.03,.06,BD+.03,0,BY-BH/2-.015,0,skirt);   // 收薄一点,脚轮才露得出来
    box(g,BW+.06,.018,BD+.06,0,BY+BH/2-.05,0,teamMat);   // 腰线
    // 四角立柱,把箱体框住
    for(const sx of [-1,1])for(const sz of [-1,1])
      box(g,.05,BH+.10,.05,sx*(BW/2-.01),BY,sz*(BD/2-.01),steel);
    /* 脚轮。⚠ 段数不能随便改:圆柱绕 Z 转 90° 之后,只有段数能让某个顶点正好落在
       最低处时,包围盒底才等于 圆心-半径。实测 8/12/16 可以,**10 不行**(最低点只到
       半径的 0.951),换成 10 之后整个架子离地 2.4mm,model-detail 的"架底贴地"直接红。 */
    for(const x of [-.60,.60])for(const z of [-.17,.17]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.045,12),rubber);
      wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.40,z);g.add(wheel);
      box(g,.05,.09,.05,x,-.335,z,steel);
    }
    /* ---------------- 放球托盘 ----------------
       两条倾斜承球轨,倾角必须和 rackSlotLocal 的落差一致,否则球会陷进去或浮起来。 */
    const railA=new THREE.Vector3(hi.x-.10,hi.y-railDrop,0);
    const railB=new THREE.Vector3(lo.x+.10,lo.y-railDrop,0);
    for(const z of [-.14,.14]){
      const a=railA.clone(),b=railB.clone();a.z=b.z=z;
      beam(g,a,b,.05,.05,steel);
    }
    /* 托盘两侧的挡边。高度必须压在**球心以下** —— 第一版抬了 7cm、厚 10cm,
       正好横在球的中段把球挡掉一半(球心 0.326、半径 0.16,挡边落在 0.231~0.331)。
       改成抬 1cm、厚 6cm,落在 0.18~0.24,只挡住球的下缘,球整颗都露出来。 */
    for(const z of [-.205,.205]){
      const a=railA.clone(),b=railB.clone();a.z=b.z=z;a.y+=.01;b.y+=.01;
      beam(g,a,b,.03,.06,teamMat);
    }
    // 低端挡球头
    box(g,.05,.15,.42,lo.x+.19,lo.y-railDrop+.055,0,teamMat);
    for(let i=0;i<RACK_SLOTS;i++){                 // 每格分隔销
      const p=rackSlotLocal(i);
      box(g,.024,.055,.34,p.x-RACK_SLOT_DX/2,p.y-railDrop+.02,0,rubber);
    }
    return batch(g);
  }
  function pedestal(width,height,mat,ballBottom=height-.01){
    const g=new THREE.Group();g.name="detailSingleBallStand";
    const steel=new THREE.MeshLambertMaterial({color:0x414b57});
    box(g,width,.065,width,0,-height/2+.0325,0,steel);
    box(g,.105,height-.11,.105,0,0,0,steel);
    box(g,.20,.28,.13,0,-.02,0,mat);
    box(g,.30,.025,.30,0,ballBottom-height/2-.0125,0,steel);
    for(const x of [-.13,.13])box(g,.035,.035,.30,x,height/2-.0175,0,mat);
    for(const z of [-.13,.13])box(g,.29,.035,.035,0,height/2-.0175,z,mat);
    return batch(g);
  }
  function net(){
    // Knotted diamond weave instead of triangulated wireframe. The existing deformation
    // reads position attributes, so these rope vertices retain the same response path.
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
  function hoopHardware(parent,boardZ,baseZ,dir,frameMat){
    const g=new THREE.Group();g.name="detailHoopHardware";
    const steel=new THREE.MeshLambertMaterial({color:0x46515d}),pad=new THREE.MeshLambertMaterial({color:0x253043});
    // Rear yoke stops behind the existing glass: board centre and rim stay untouched.
    const rear=boardZ-dir*.15;
    for(const x of [-.60,.60]){
      box(g,.055,.60,.06,x,3.53,rear,steel);
      beam(g,new THREE.Vector3(0,3.45,boardZ-dir*.40),new THREE.Vector3(x,3.57,rear),.055,.055,steel);
      box(g,.095,.08,.10,x,3.78,rear,steel);
    }
    box(g,1.27,.055,.055,0,3.30,rear,steel);
    box(g,1.98,.09,.19,0,2.94,boardZ,pad);
    // Mechanical breakaway housing directly behind the original rim connector.
    box(g,.22,.15,.15,0,3.05,boardZ+dir*.12,frameMat);
    box(g,.17,.055,.13,0,3.015,boardZ+dir*.23,steel);
    for(const x of [-.36,.36])box(g,.022,1.50,.025,x,.90,baseZ+dir*.369,steel);
    box(g,.58,.035,.025,0,.40,baseZ+dir*.369,steel);
    parent.add(batch(g));return g;
  }
  /* ---------- 阶段 5：看台分区扶手 ----------
     通道本身已经是 arena.js 用 AISLE_COUNT 切出来的**实体缺口**,这里只在缺口两侧
     立栏杆 —— 不新增任何墙体。计划明确禁止"贯穿看台的长墙"和"贯穿多层的长楼梯墙",
     而扶手随通道一起被 AISLE_SKEW 斜移、每层各自起止,天然不会连成竖直长条。

     入参是已经算好的世界坐标(每条通道一串点,从最低排到最高排),几何在这里生成,
     全部作为 matrix 交给 bakeVoxelMesh 烘成**单个网格** —— 静态器材的预算要压在
     draw call 和阴影提交上,不是压在外形上。 */
  function railParts(lanes,color,postH){
    const parts=[],up=new THREE.Vector3(0,1,0),mm=new THREE.Matrix4(),q=new THREE.Quaternion();
    const c=new THREE.Color(color),ident=new THREE.Quaternion();
    for(const lane of lanes){
      for(let i=0;i<lane.length;i++){
        const p=lane[i];
        mm.compose(new THREE.Vector3(p[0],p[1]+postH/2,p[2]),ident,new THREE.Vector3(.055,postH,.055));
        parts.push({color:c,matrix:mm.clone()});
        if(i+1>=lane.length)continue;
        const n=lane[i+1];
        const a=new THREE.Vector3(p[0],p[1]+postH,p[2]);
        const b=new THREE.Vector3(n[0],n[1]+postH,n[2]);
        const d=b.clone().sub(a),len=d.length();
        if(len<1e-4)continue;
        q.setFromUnitVectors(up,d.normalize());
        mm.compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(.05,len,.05));
        parts.push({color:c,matrix:mm.clone()});
      }
    }
    return parts;
  }

  /* ---------- 阶段 5：记者区 ----------
     底线外那条 2m 宽的地带现在只有篮架底座。真实馆这里坐着摄影记者:矮凳 + 三脚架 +
     机身。全部压在 1.1m 以下 —— 它在篮筐正后方,高一点就会挡住篮圈下沿。
     x 上避开篮架立柱(|x|<1.3)和两侧球架。 */
  function pressRow(z,xs){
    const parts=[],mm=new THREE.Matrix4(),ident=new THREE.Quaternion();
    const stool=new THREE.Color(0x2a3140),steel=new THREE.Color(0x3c4552),body=new THREE.Color(0x14181f);
    const put=(col,w,h,d,x,y,zz)=>{
      mm.compose(new THREE.Vector3(x,y,zz),ident,new THREE.Vector3(w,h,d));
      parts.push({color:col,matrix:mm.clone()});
    };
    for(const x of xs){
      put(stool,.42,.07,.38,x,.40,z);                       // 凳面
      for(const dx of [-.16,.16])for(const dz of [-.14,.14])
        put(steel,.035,.40,.035,x+dx,.20,z+dz);             // 凳腿
      const tz=z-.42;                                        // 三脚架略靠球场一侧
      put(steel,.05,.62,.05,x,.31,tz);
      for(const a of [0,2.1,4.2])
        put(steel,.03,.34,.03,x+Math.cos(a)*.17,.17,tz+Math.sin(a)*.17);
      put(body,.22,.13,.30,x,.68,tz);                        // 机身
      put(steel,.10,.10,.16,x,.68,tz-.20);                   // 镜头
    }
    return parts;
  }

  global.AIBAModelDetail=Object.freeze({enabled,revision:"model-detail-02",profile,rack,pedestal,net,hoopHardware,box,batch,railParts,pressRow,
    RACK_SLOTS,RACK_SLOT_DX,RACK_SLOT_DROP,rackSlotLocal});
})(window);
