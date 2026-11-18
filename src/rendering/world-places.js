/* Four places, not four weather skins. All disposable art belongs to environmentRoot.
   Gameplay hoops stay in scene; all randomness here has an independent stream. */
(()=>{
  const enabled=new URLSearchParams(location.search).get("places")!=="classic";
  const palettes={
    outdoorSunny:{ground:"#626369",field:"#343e47",key:"#b95543",line:"#e2d5b4",shirts:[0xe3d4b9,0x344760,0xb95142,0x323239,0x769793,0xe0ab47,0xe5e1d4,0x657293]},
    rainyCourt:{ground:"#545d60",field:"#35565b",key:"#263f48",line:"#bcb99e",shirts:[0xc9ac65,0x384c52,0x9a6857,0x5e6b64,0xb6b9a4,0x313d50,0x826882,0x687b80]},
    flowerCourt:{ground:"#718b49",field:"#757950",key:"#7c7d50",line:"#eee3bf",shirts:[0xe5c79a,0x3b6472,0xa04f36,0x7a7c47,0xc59356,0xeee2c1,0x514b70,0xc26f58]},
    /* 旧但干净的学校水泥外场:灰蓝 + 海盐绿,低饱和(文档 §4 球场设计)。
       刻意不用荧光街头配色。 */
    /* 浅灰蓝 / 海盐蓝 + 米白线(文档 §球场设计),不做荧光街头配色 */
    medCliff:{ground:"#cdc3a8",field:"#7d9aa8",key:"#6b8a99",line:"#f4efe2",shirts:[0xf2ece0,0x2c6ba4,0xd9cdb4,0xb05f3d,0xe8e0cf,0x3f7f9e,0xc63a7a,0xcfc3a8]},
    shonanCoast:{ground:"#9a9e97",field:"#6d8686",key:"#5b7676",line:"#eef0e8",shirts:[0xe8e4d8,0x2f4f6b,0x8fa8b4,0xd9d2bd,0x44606d,0xf0ece0,0x7d9aa2,0xc3ccc4]},
    beachSunset:{ground:"#4d5157",field:"#45494f",key:"#3e4248",line:"#e8e3d5",shirts:[0xdcc6a4,0x7caaaa,0xc07765,0xead7a6,0x4c7583,0xb39a85,0xd6c7c3,0x577368]},
    ...AIBAWorldWonders.palettes
  };
  const clamp01=x=>Math.max(0,Math.min(1,x));
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  // Merge transformed primitives into one colored mesh, including normals. No material groups.
  function batch(){
    const pos=[],nor=[],col=[],matrix=new THREE.Matrix4(),normal=new THREE.Matrix3(),v=new THREE.Vector3(),n=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler(),c=new THREE.Color();
    const cube=new THREE.BoxGeometry(1,1,1).toNonIndexed(),sphere=new THREE.SphereGeometry(1,10,7).toNonIndexed(),cone=new THREE.ConeGeometry(1,1,5).toNonIndexed();
    /* "blob":给树冠叶团用的低模球。10×7 的 sphere 约 126 个三角形,
       雨林一棵树几十个叶团、几十棵树,直接把场景从 11.3 万顶到 27.9 万;
       6×4 约 48 个,在叶团这个尺度上圆度已经足够,省掉三分之二。 */
    const blob=new THREE.SphereGeometry(1,6,4).toNonIndexed();
    // Shared eroded, faceted rock profile: continuous rings replace horizontal stacks of boxes.
    const rock=new THREE.CylinderGeometry(.43,.58,1,9,6,false);
    const rp=rock.attributes.position;
    for(let i=0;i<rp.count;i++){
      const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),a=Math.atan2(z,x);
      const cut=1+.11*Math.sin(a*3+y*7)+.08*Math.cos(a*5-y*11);
      rp.setXYZ(i,x*cut+.07*Math.sin(y*5),y+.025*Math.sin(a*3)*(1-y*y*4),z*cut+.035*Math.cos(y*9));
    }
    rock.computeVertexNormals();const rockFaces=rock.toNonIndexed();rockFaces.computeVertexNormals();rock.dispose();
    function add(shape,color,x,y,z,w,h,d,rx=0,ry=0,rz=0){
      const geo=shape==="rock"?rockFaces:shape==="sphere"?sphere:shape==="blob"?blob:shape==="cone"?cone:cube,p=geo.attributes.position,a=geo.attributes.normal;
      matrix.compose(v.set(x,y,z),q.setFromEuler(e.set(rx,ry,rz)),n.set(w,h,d));normal.getNormalMatrix(matrix);c.set(color).convertSRGBToLinear();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);n.fromBufferAttribute(a,i).applyMatrix3(normal).normalize();pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(c.r,c.g,c.b);}
    }
    return {add,box:(color,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>add("box",color,x,y,z,w,h,d,rx,ry,rz),finish(parent,name,basic=false){
      cube.dispose();sphere.dispose();blob.dispose();cone.dispose();rockFaces.dispose();if(!pos.length)return null;
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3));geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,basic?new THREE.MeshBasicMaterial({vertexColors:true}):new THREE.MeshLambertMaterial({vertexColors:true}));mesh.name=name;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }};
  }
  const hoopSupports=()=>[[-8.62,1],[COURT.farBaseline-.96,-1]];
  function lunarMarkings(bounds,{bootprints,padDust},mobile){
    const cv=document.createElement("canvas");cv.width=mobile?1280:1664;cv.height=mobile?1792:2048;
    const g=cv.getContext("2d"),r=rng(91271);
    const {nearBaseline:near,farBaseline:far}=COURT;
    g.scale(cv.width/bounds.z,cv.height/bounds.w);g.translate(-bounds.x,-bounds.y);
    const line=(x,z,x2,z2)=>{g.beginPath();g.moveTo(x,z);g.lineTo(x2,z2);g.stroke();};
    const arc=(x,z,rad,a=0,b=Math.PI*2)=>{g.beginPath();g.arc(x,z,rad,a,b);g.stroke();};

    // 球员常站的位置只留浅浅的压实磨痕，与基础月尘一起受光。
    for(const {p} of RACKS){
      g.save();
      g.translate(p.x,p.z);
      g.rotate(Math.atan2(p.x,p.z-COURT.nearHoopZ)*.65);
      g.scale(.65,1.04);
      const scuff=g.createRadialGradient(0,0,.04,0,0,1.08);
      scuff.addColorStop(0,"rgba(82,79,77,.19)");
      scuff.addColorStop(.54,"rgba(96,93,92,.10)");
      scuff.addColorStop(1,"rgba(96,93,92,0)");
      g.fillStyle=scuff;g.fillRect(-1.1,-1.1,2.2,2.2);
      g.restore();
    }

    g.strokeStyle=palettes.lunarCrater.line;
    g.globalAlpha=.26;g.lineWidth=.047;
    g.setLineDash([1.24,.12,.78,.09,1.68,.18]);
    g.strokeRect(-COURT.halfWidth,near,COURT.width,COURT.length);
    line(-COURT.halfWidth,COURT.midZ,COURT.halfWidth,COURT.midZ);
    arc(0,COURT.midZ,1.8);
    for(const dir of [1,-1]){
      const base=dir===1?near:far,hz=dir===1?COURT.nearHoopZ:COURT.farHoopZ;
      g.strokeRect(-2.45,dir===1?base:base-5.8,4.9,5.8);
      arc(0,base+dir*5.8,1.8);
      arc(0,hz,1.25,dir===1?0:Math.PI,dir===1?Math.PI:Math.PI*2);
    }

    // 三分弧和两个底角保留更完整的粉线，缺口留给落尘和磨损。
    g.globalAlpha=.43;g.lineWidth=.058;
    g.setLineDash([1.42,.05,.92,.08,1.76,.035]);
    for(const dir of [1,-1]){
      const base=dir===1?near:far,hz=dir===1?COURT.nearHoopZ:COURT.farHoopZ;
      arc(0,hz,6.75,dir===1?.12:Math.PI+.12,dir===1?Math.PI-.12:Math.PI*2-.12);
      for(const side of [-1,1])line(side*6.7,base,side*6.7,hz+dir*.82);
    }

    g.globalCompositeOperation="destination-out";
    for(let i=0;i<180;i++){
      const x=(r()-.5)*16,z=near+r()*(far-near),radius=.12+r()*.42;
      const dust=g.createRadialGradient(x,z,0,x,z,radius);
      dust.addColorStop(0,"rgba(0,0,0,.62)");dust.addColorStop(1,"rgba(0,0,0,0)");
      g.fillStyle=dust;g.globalAlpha=.30+r()*.60;
      g.fillRect(x-radius,z-radius,2*radius,2*radius);
    }
    g.globalCompositeOperation="source-over";g.globalAlpha=1;
    // Accumulated dust surrounds the pad contact points and both hoop anchors.
    const dustPatch=(x,z,width,length,angle,strength)=>{
      g.save();g.translate(x,z);g.rotate(angle);g.scale(width,length);
      const dust=g.createRadialGradient(.08,-.12,.12,0,0,1);
      dust.addColorStop(0,`rgba(127,119,109,${strength})`);
      dust.addColorStop(.56,`rgba(119,113,104,${strength*.67})`);
      dust.addColorStop(1,"rgba(119,113,104,0)");
      g.fillStyle=dust;g.fillRect(-1,-1,2,2);g.restore();
    };
    for(const pad of padDust)dustPatch(...pad,.27);
    for(const [z,dir] of hoopSupports()){
      const base=z-dir*1.55;
      dustPatch(.04,base,.70,.66,.25,.26);
      dustPatch(.25,base+.11,.78,.40,-.45,.13);
    }
    // Impressions use a soft disturbed perimeter, a heel/toe outline and worn ribs.
    for(const [x,z,yaw,side,strength] of bootprints){
      dustPatch(x,z,.17,.27,-yaw,strength*.34);
      g.save();g.translate(x,z);g.rotate(-yaw);g.scale(side,1);
      g.globalAlpha=strength;
      g.beginPath();g.moveTo(-.078,-.181);
      g.bezierCurveTo(-.102,-.14,-.067,-.035,-.089,.059);
      g.bezierCurveTo(-.108,.157,-.072,.205,.024,.206);
      g.bezierCurveTo(.112,.197,.113,.132,.092,.059);
      g.bezierCurveTo(.068,.0,.086,-.092,.078,-.156);
      g.bezierCurveTo(.050,-.203,-.047,-.204,-.078,-.181);g.closePath();
      const sole=g.createLinearGradient(-.084,.12,.105,-.04);
      sole.addColorStop(0,"#77736a");sole.addColorStop(.38,"#454440");sole.addColorStop(1,"#56544f");
      g.fillStyle=sole;g.fill();g.clip();
      g.fillStyle="rgba(169,165,153,.87)";
      for(let rib=0;rib<7;rib++){
        const rz=-.157+rib*.050,cut=rib%3===1?.017:.006;
        g.fillRect(-.101,rz,.101-cut,.024);
        g.fillRect(cut,rz-.005,.111-cut,.022);
      }
      g.restore();
    }
    const map=new THREE.CanvasTexture(cv);map.name="lunarCourtMarkings";
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(THREE.sRGBEncoding)map.encoding=THREE.sRGBEncoding;
    return map;
  }
  function surface(name){
    const cv=document.createElement("canvas");cv.width=1536;cv.height=1728;
    const g=cv.getContext("2d"),p=palettes[name],r=rng(91271),D=COURT.floorMaxZ-COURT.floorMinZ;
    g.scale(cv.width/32,cv.height/D);g.translate(16,-COURT.floorMinZ);g.fillStyle=p.ground;g.fillRect(-16,COURT.floorMinZ,32,D);
    g.fillStyle=p.field;g.fillRect(-COURT.halfWidth,COURT.nearBaseline,COURT.width,COURT.length);
    const near=COURT.nearBaseline,far=COURT.farBaseline;
    g.fillStyle=p.key;g.fillRect(-2.45,near,4.9,5.8);g.fillRect(-2.45,far-5.8,4.9,5.8);
    // Different apron materials: stone courses, city paving, or woven earthen border.
    if(name==="outdoorSunny"){
      g.strokeStyle="#858480";g.lineWidth=.022;
      for(let z=near-3;z<far+4;z+=1.4)for(let side of [-1,1]){
        g.beginPath();g.moveTo(side*8.2,z);g.lineTo(side*16,z);g.stroke();
        for(let x=8.3;x<16;x+=2){g.beginPath();g.moveTo(side*(x+(Math.floor(z*2)%2)*.3),z);g.lineTo(side*(x+(Math.floor(z*2)%2)*.3),z+.65);g.stroke();}
      }
    }
    if(name==="rainyCourt"){
      /* 场外按用途分带重画(计划 §2.2/§2.5):
           7.62~11.0 湿石板缓冲 → 11.0~11.7 侧沟与路缘 → 11.7~13.3 人行道
           → 13.3~16 町屋墙脚(会被建筑压住,画暗)。真实高差由 rainTown 的路缘盒子做。
         旧版是从 8.2 一路铺到 16 的等宽石板格 —— 正是"统一宽边"的来源。 */
      const Z0=COURT.floorMinZ,ZL=COURT.floorMaxZ-COURT.floorMinZ;
      for(const side of [-1,1]){
        const L=(a,c)=>Math.min(side*a,side*c),W=(a,c)=>Math.abs(c-a);
        g.fillStyle="#59615d";g.fillRect(L(7.62,11),Z0,W(7.62,11),ZL);
        g.strokeStyle="#474f4c";g.lineWidth=.05;
        for(let z=Z0;z<Z0+ZL;z+=1.16){g.beginPath();g.moveTo(side*7.62,z);g.lineTo(side*11,z);g.stroke();}
        for(let x=8.75;x<11;x+=1.12){g.beginPath();g.moveTo(side*x,Z0);g.lineTo(side*x,Z0+ZL);g.stroke();}
        g.fillStyle="#2b3538";g.fillRect(L(11,11.7),Z0,W(11,11.7),ZL);
        g.fillStyle="#5f645d";g.fillRect(L(11.7,13.3),Z0,W(11.7,13.3),ZL);
        g.fillStyle="#3a3e3b";g.fillRect(L(13.3,16),Z0,W(13.3,16),ZL);
      }
      /* 积水集中在场边低处与侧沟一线,不是满场均匀撒点 —— 磨损要有成因(§2.5)。 */
      for(let m=0;m<130;m++){
        const side=m%2?1:-1,t=r();
        g.fillStyle=r()<.5?"rgba(36,52,56,.34)":"rgba(58,74,78,.2)";
        g.beginPath();g.ellipse(side*(7.8+t*t*3.2),Z0+r()*ZL,.32+r()*1.5,.2+r()*.66,r()*3.14,0,6.283);g.fill();
      }
      // 三个入口被踩亮:石板磨出一小片浅色
      for(const [ex,ez] of [[-10.2,-11.6],[10.4,-1.4],[-10.2,6.8]])for(let m=0;m<26;m++){
        g.fillStyle="rgba(168,170,158,.16)";
        g.beginPath();g.ellipse(ex+(r()-.5)*2.6,ez+(r()-.5)*3.4,.3+r()*.6,.22+r()*.4,r()*3.14,0,6.283);g.fill();
      }
    }
    g.strokeStyle=p.line;g.lineWidth=name==="beachSunset"?.044:.065;
    g.strokeRect(-COURT.halfWidth,near,COURT.width,COURT.length);g.beginPath();g.moveTo(-COURT.halfWidth,COURT.midZ);g.lineTo(COURT.halfWidth,COURT.midZ);g.stroke();
    const circle=(x,z,r,a=0,b=Math.PI*2)=>{g.beginPath();g.arc(x,z,r,a,b);g.stroke();};
    circle(0,COURT.midZ,1.8);
    [1,-1].forEach(dir=>{const base=dir===1?near:far,hz=dir===1?COURT.nearHoopZ:COURT.farHoopZ;
      g.strokeRect(-2.45,dir===1?base:base-5.8,4.9,5.8);circle(0,base+dir*5.8,1.8);circle(0,hz,1.25,dir===1?0:Math.PI,dir===1?Math.PI:Math.PI*2);
      circle(0,hz,6.75,dir===1?.12:Math.PI+.12,dir===1?Math.PI-.12:Math.PI*2-.12);
      [-1,1].forEach(side=>{g.beginPath();g.moveTo(side*6.7,base);g.lineTo(side*6.7,hz+dir*.82);g.stroke();});
    });
    if(name==="spanishQuarter"){
      /* 老街场外分带:被晒旧的石板缓冲 → 路缘 → 门前步道 → 墙脚。
         计划 §B 的验收之一是"门前铺装不会形成宽阔、无用途的空广场"。 */
      const Z0=COURT.floorMinZ,ZL=COURT.floorMaxZ-COURT.floorMinZ;
      for(const side of [-1,1]){
        const L=(a,c)=>Math.min(side*a,side*c),W=(a,c)=>Math.abs(c-a);
        g.fillStyle="#a29175";g.fillRect(L(7.62,10.8),Z0,W(7.62,10.8),ZL);
        g.strokeStyle="#9b8a6f";g.lineWidth=.05;
        for(let z=Z0;z<Z0+ZL;z+=1.55){g.beginPath();g.moveTo(side*7.62,z);g.lineTo(side*10.8,z);g.stroke();}
        for(let x=9.2;x<10.8;x+=1.5){g.beginPath();g.moveTo(side*x,Z0);g.lineTo(side*x,Z0+ZL);g.stroke();}
        g.fillStyle="#9a8a70";g.fillRect(L(10.8,11.3),Z0,W(10.8,11.3),ZL);
        g.fillStyle="#c0b193";g.fillRect(L(11.3,13.3),Z0,W(11.3,13.3),ZL);
        g.fillStyle="#4d4335";g.fillRect(L(13.3,16),Z0,W(13.3,16),ZL);
      }
      // 磨损有成因(§2.5):门口、树池、拱道口被踩亮;墙脚常年积沙偏暖
      for(const [ex,ez] of [[-10.4,8],[10.4,-2.7],[0,-12.4],[-10.6,-4.6]])for(let m=0;m<30;m++){
        g.fillStyle="rgba(216,203,174,.2)";
        g.beginPath();g.ellipse(ex+(r()-.5)*3.2,ez+(r()-.5)*3.8,.34+r()*.8,.26+r()*.5,r()*3.14,0,6.283);g.fill();
      }
      for(let m=0;m<90;m++){
        const side=m%2?1:-1;
        g.fillStyle="rgba(158,138,104,.2)";
        g.beginPath();g.ellipse(side*(12.2+r()*1.4),Z0+r()*ZL,.3+r()*1.1,.2+r()*.5,r()*3.14,0,6.283);g.fill();
      }
    }
    if(name==="arcticSnow"){
      // Sparse swept remnants at the boundary. The central hard court stays bare.
      g.fillStyle="#d1dde1";
      for(let i=0;i<160;i++){
        const side=i%2?1:-1,x=side*(7.55+r()*.9),z=near+r()*COURT.length;
        g.beginPath();g.ellipse(x,z,.04+r()*.24,.1+r()*.48,0,0,Math.PI*2);g.fill();
      }
      g.strokeStyle="rgba(87,107,118,.15)";g.lineWidth=.025;
      for(let i=0;i<80;i++){const x=(r()-.5)*15,z=near+r()*COURT.length;g.beginPath();g.moveTo(x,z);g.lineTo(x+.5,z+.7);g.stroke();}
    }
    if(name==="spanishQuarter"){
      g.strokeStyle="rgba(84,67,48,.25)";g.lineWidth=.025;
      for(let z=near-3;z<far+4;z+=.48)for(let side of [-1,1]){g.beginPath();g.moveTo(side*8.15,z);g.lineTo(side*16,z);g.stroke();}
      for(let i=0;i<75;i++){g.fillStyle=i%2?"rgba(200,150,105,.13)":"rgba(87,49,36,.09)";g.fillRect((r()-.5)*14,near+r()*COURT.length,.3+r()*.7,.06+r()*.16);}
    }
    // Grain is painted after stripes: the West Coast lines wear with the pavement.
    for(let i=0;i<18000;i++){
      const x=r()*32-16,z=COURT.floorMinZ+r()*D;g.fillStyle=r()>.5?"rgba(255,240,209,.08)":"rgba(28,32,29,.09)";g.fillRect(x,z,.013+r()*.05,.012+r()*.06);
    }
    if(name==="beachSunset"){
      for(let i=0;i<95;i++){const x=r()*29-14.5,z=near+r()*COURT.length;g.fillStyle=`rgba(107,109,99,${.08+r()*.2})`;g.fillRect(x,z,.2+r()*1.3,.1+r()*.8);}
      for(let i=0;i<25;i++){let x=r()*28-14,z=near+r()*COURT.length;g.strokeStyle="rgba(51,56,51,.36)";g.lineWidth=.016;g.beginPath();g.moveTo(x,z);for(let j=0;j<6;j++){x+=(r()-.4)*.45;z+=r()*.4;g.lineTo(x,z);}g.stroke();}
      for(let i=0;i<180;i++){g.fillStyle=p.field;g.fillRect((r()-.5)*15.1,near+r()*COURT.length,.1+r()*.25,.025+r()*.065);}
    }
    if(name==="tokyoRooftop"){
      // 天台混凝土伸缩缝 + 边缘黄黑/红白停机坪警示线 + 夜间微湿反光斑块
      const Z0=COURT.floorMinZ,ZL=COURT.floorMaxZ-COURT.floorMinZ;
      g.strokeStyle="rgba(16,20,28,.55)";g.lineWidth=.035;
      for(let z=Z0;z<Z0+ZL;z+=2.4){
        g.beginPath();g.moveTo(-16,z);g.lineTo(-7.62,z);g.stroke();
        g.beginPath();g.moveTo(7.62,z);g.lineTo(16,z);g.stroke();
      }
      // 场边停机坪虚线框
      g.save();g.strokeStyle="rgba(245,180,60,.42)";g.lineWidth=.09;g.setLineDash([.75,.55]);
      g.strokeRect(-11.8,near-2.4,23.6,COURT.length+4.8);
      g.restore();
    }
    AIBAWorldLife.surface(g,name,p,r);
    const tex=new THREE.CanvasTexture(cv);tex.name=`placeSurface:${name}`;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;return tex;
  }
  function restore(){
    if(courtFloor?.userData.placeTexture){courtFloor.userData.placeTexture.dispose();delete courtFloor.userData.placeTexture;}
    scene.traverse(o=>{if(o.userData.placeHidden!==undefined){o.visible=o.userData.placeHidden;delete o.userData.placeHidden;}});
    setPlaceHoops(false);
  }
  function themeHoops(s,b,faceMarks=b){
    const beach=s.name==="beachSunset",lunar=s.name==="lunarCrater",tokyo=s.name==="tokyoRooftop",wood=s.name==="flowerCourt",rain=s.name==="rainyCourt",color=beach?0x8e969e:lunar?0xeef1f5:tokyo?0x1f2530:wood?0x5c5139:s.name==="arcticSnow"?0x25343e:s.name==="spanishQuarter"?0x635344:rain?0x293a3d:0x526264;
    hoopSupports().forEach(([z,dir])=>{
      const base=z-dir*1.55;
      if(beach){
        // 洛杉矶 Angels Gate 经典大弧度弯曲鹅颈镀锌钢篮架
        const N=12;
        for(let i=0;i<N;i++){
          const t0=i/N,t1=(i+1)/N,tm=(t0+t1)*.5;
          const a0=t0*Math.PI/2,a1=t1*Math.PI/2,am=tm*Math.PI/2;
          const z0=base+dir*1.55*(1-Math.cos(a0)),y0=3.48*Math.sin(a0);
          const z1=base+dir*1.55*(1-Math.cos(a1)),y1=3.48*Math.sin(a1);
          const len=Math.hypot(z1-z0,y1-y0)+.04;
          const thick=.25-.07*tm;
          const ang=Math.atan2(z1-z0,y1-y0);
          b.box(i%2?0x889098:0x969ea6,0,(y0+y1)*.5,(z0+z1)*.5,thick,len,thick,ang,0,0);
        }
        b.box(0x707880,0,.08,base,.52,.16,.52);
        b.box(0xa6b0bc,0,3.5,z,1.9,1.1,.1);
        const ink=0x262c34;
        [-1,1].forEach(a=>{b.box(ink,0,3.5+a*.51,z+dir*.056,1.86,.035,.012);b.box(ink,a*.915,3.5,z+dir*.056,.035,1.05,.012);
          b.box(ink,a*.3,3.25,z+dir*.059,.035,.36,.014);b.box(ink,0,3.25+a*.18,z+dir*.059,.63,.035,.014);});
        b.box(0xc83e2b,0,3.04,z+dir*.09,.24,.09,.12);
        return;
      }
      b.box(color,0,1.75,base,.24,3.5,.24);b.box(color,0,3.46,z-dir*.76,.22,.22,1.55);
      b.box(lunar?0xcfd5de:color,0,2.955,base+dir*.505,.13,1.48,.13,dir*Math.PI/4);b.box(lunar?0xa9a8a6:wood?0x66513b:0x757b76,0,.1,base,.75,.2,.75);
      b.box(lunar?0xdce2ea:tokyo?0x283242:wood?0xad8054:rain?0xc5c1a9:s.name==="spanishQuarter"?0x91988c:0xd6d1b9,0,3.5,z,1.9,1.1,.12);
      for(let j=-2;j<=2;j++)if(wood)b.box(0x694c34,j*.34,3.5,z+dir*.062,.018,1.07,.006);
      const ink=lunar?0xc68059:tokyo?0xff4d32:wood?0xe4cca0:rain?0x704f40:0x384f56;
      const aimInk=lunar?0xf5d18d:ink,aimWidth=lunar?.042:.035;
      for(const a of [-1,1]){
        faceMarks.box(ink,0,3.5+a*.51,z+dir*.066,1.86,.035,.012);
        faceMarks.box(ink,a*.915,3.5,z+dir*.066,.035,1.05,.012);
        faceMarks.box(aimInk,a*.3,3.25,z+dir*.069,aimWidth,.36,.014);
        faceMarks.box(aimInk,0,3.25+a*.18,z+dir*.069,.63,aimWidth,.014);
      }
      for(let x of [-.84,.84])for(let y of [3.04,3.96])b.box(lunar?0x22262e:0x494640,x,y,z+dir*.073,.035,.035,.025);
      if(lunar){
        // NASA 土星五号白黑滚转涂装 + 金色 Kapton 隔热环 + 钛合金连接件
        b.box(0x1b1f26,0,.55,base,.255,.32,.255);
        b.box(0x1b1f26,0,2.15,base,.255,.26,.255);
        b.box(0xd6a026,0,.95,base,.26,.16,.26);
        b.box(0xc83228,0,3.46,z-dir*.35,.23,.23,.18);
        b.box(0x8c94a0,0,3.46,base,.27,.27,.27);
        for(const bx of [-.28,.28])for(const bz of [-.28,.28])b.box(0x282c34,bx,.21,base+bz,.07,.04,.07);
      }
      if(wood)for(let j=0;j<6;j++)b.box(0xc3a976,0,1.3+j*.065,base,.26,.025,.27);
      if(s.name==="spanishQuarter"||s.name==="beachSunset"){
        const rr=rng(s.name==="spanishQuarter"?197:239);
        for(let j=0;j<32;j++){
          const x=(rr()-.5)*1.75,y=3.05+rr()*.94;
          if(Math.abs(x)<.35&&y<3.47)continue;
          b.box(j%3===0?0x6e4f36:s.name==="spanishQuarter"?0xb9794e:0x718e89,x,y,z+dir*.078,.03+rr()*.1,.015+rr()*.055,.008);
        }
        // Tag strokes stay outside the inner target rectangle.
        for(let j=0;j<5;j++)b.box(s.name==="spanishQuarter"?0x99452e:0xbe7864,-.76+j*.11,3.77+Math.sin(j)*.06,z+dir*.084,.045,.21,.009,0,0,.28-j*.13);
      }
    });setPlaceHoops(true);
  }
  function tree(s,b,x,z,style,scale=1){
    const h=(style==="palm"?6.3:style==="bamboo"?4.4:4)*scale;
    b.box(style==="bamboo"?0x6c7750:0x756049,x,h/2,z,.28*scale,h,.3*scale);
    const pivot=new THREE.Group();pivot.position.set(x,h*.85,z);s.root.add(pivot);const leaf=batch();
    if(style==="palm"){
      for(let j=0;j<7;j++){const a=j*Math.PI*2/7;for(let k=0;k<3;k++)leaf.box(k%2?0x557b55:0x3b694c,Math.cos(a)*(k*.65+.45)*scale,.55-k*k*.13,Math.sin(a)*(k*.65+.45)*scale,.7*scale,.1,1.15*scale,.1+k*.18,a+Math.PI/2);}
      leaf.add("sphere",0x64503d,0,.1,0,.3,.26,.3);
    }else if(style==="bamboo"){
      for(let j=0;j<6;j++)leaf.box(j%2?0x71824c:0x405f43,(j%2?1:-1)*.5,j*.3-.5,0,1.3,.08,.35,0,j*.6,(j%2?1:-1)*.3);
      for(let y=.4;y<h;y+=.6)b.box(0x8b9860,x,y,z,.32,.05,.33);
    }else{
      const red=style==="maple",colors=red?[0x975a43,0xb27948,0x73523d]:[0x486c49,0x658451,0x7d995b];
      for(let j=0;j<7;j++){const a=j*2.39;leaf.add("sphere",colors[j%3],Math.cos(a)*.8*scale,(j%3)*.5,Math.sin(a)*.8*scale,(1+s.r()*.35)*scale,.7*scale,(.8+s.r()*.4)*scale);}
    }
    leaf.finish(pivot,`windFoliage:${style}`);s.plants.push({pivot,phase:s.r()*6.28,amp:style==="palm"?.035:.023});
  }
  function lamp(s,b,x,z,h=5){
    b.box(0x3d4b4c,x,h/2,z,.11,h,.11);b.box(0x3d4b4c,x+.45,h,z,1,.09,.14);
    const a=batch();a.box(0xffdaa0,x+.8,h-.08,z,.38,.08,.28);const m=a.finish(s.root,"streetLamp",true);m.material.color.setScalar(.16);s.lights.push({mesh:m,threshold:.48+s.r()*.13});
  }
  function clouds(s){
    const arctic=s.name==="arcticSnow";
    for(let i=0;i<(arctic?2:(s.mobile?6:10));i++){
      const g=new THREE.Group(),b=batch(),rain=s.name==="rainyCourt";g.position.set(-43+s.r()*86,(s.name==="outdoorSunny"?64:rain?16:22)+s.r()*9,-45+s.r()*75);
      for(let j=0;j<7;j++)b.add("sphere",rain?(j%2?0xa9b7ba:0x919fa4):(j%3?0xf5edda:0xdedfd5),(s.r()-.5)*5,(s.r()-.3)*1.1,(s.r()-.5)*2.3,1.7+s.r()*1.5,rain?.65:1+s.r()*.6,1+s.r());
      const cloud=b.finish(g,"organicCloud");if(arctic){cloud.material.color.setHex(0x556a7a);g.position.set(i?52:-47,28+i*5,-54);}
      s.root.add(g);s.clouds.push({g,speed:.15+s.r()*.15});
    }
  }
  function city(s,b){
    b.box(0x8f8e84,0,-.13,4,115,.12,115);
    // Roads are beyond both floor aprons, x=19..27; pedestrians remain inside x=16.
    for(let side of [-1,1]){
      b.box(0x353d43,side*23,-.045,4,9,.06,106);b.box(0x96928a,side*17,.02,4,1.5,.16,106);
      for(let z=-47;z<56;z+=4)b.box(0xc4b883,side*23,.005,z,.07,.012,1.9);
      /* 建筑不能一个模子。原来 7 栋全是同尺寸方盒 + 同一套窗格,
         天际线读起来像复制粘贴。这里按**五种原型**轮换,各自有不同的
         体量、收分、屋顶和立面语言 —— 剪影一变,城市才有城市的样子。 */
      for(let j=0;j<8;j++){
        const z=-40+j*13.5,x=side*(34+s.r()*6),kind=(j+(side>0?2:0))%5;
        const face=x-side*.03;                                   // 朝向球场那一面
        if(kind===0){                                            // ① 玻璃塔:收分三段,顶部机房
          const h=46+s.r()*22,w=8.5+s.r()*2;
          for(let t=0;t<3;t++){const th=h*(.42-t*.09),ty=h*(t*.33),tw=w*(1-t*.16);
            b.box([0x51707e,0x5c7c88,0x466a78][t],x,ty+th/2,z,tw,th,tw*1.05);
            for(let dx=-tw/2+.7;dx<tw/2;dx+=1.35)b.box(0x86b3c2,x+dx,ty+th/2,face-side*(tw*.52),.85,th-1.2,.06);}
          b.box(0x39505a,x,h*.99+1.4,z,3.2,2.8,3.2);b.box(0x2c3d45,x,h*.99+4,z,.24,2.6,.24);
        }else if(kind===1){                                      // ② 红砖老楼:防火梯 + 屋顶水塔
          const h=20+s.r()*10,w=10+s.r()*2.5;
          b.box(0x8a5646,x,h/2,z,w,h,10);
          for(let y=2.6;y<h-1;y+=3.1){
            b.box(0x6d4136,x,y+1.55,z,w+.06,.34,10.06);           // 砖檐
            for(let dx=-w/2+1.2;dx<w/2;dx+=2.2)b.box(0x2f3f47,x+dx,y,face-side*5.03,1.05,1.55,.08);
          }
          for(let y=3.4;y<h-2;y+=3.1){                            // 防火梯
            b.box(0x3d3733,x,y,face-side*5.5,w*.42,.09,1.1);
            b.box(0x3d3733,x-w*.2,y+.55,face-side*6.0,.06,1.1,1.1);
            b.box(0x3d3733,x+w*.2,y+.55,face-side*6.0,.06,1.1,1.1);
          }
          b.add("blob",0x6b6255,x+w*.22,h+1.5,z,1.5,1.7,1.5);     // 木水塔
          b.box(0x4a443b,x+w*.22,h+3.3,z,1.8,.5,1.8);
        }else if(kind===2){                                      // ③ 矮宽商业楼:大招牌带 + 屋顶空调机组
          const h=13+s.r()*5,w=14+s.r()*3;
          b.box(0x9b9484,x,h/2,z,w,h,11);
          for(let y=3.2;y<h-1;y+=3.4)for(let dx=-w/2+1.4;dx<w/2;dx+=2.6)
            b.box(0x3a5460,x+dx,y,face-side*5.53,1.7,1.9,.08);
          b.box(0x2f3a3f,x,h*.62,face-side*5.62,w*.86,1.5,.22);   // 招牌带(无字)
          for(let dx=-w/3;dx<=w/3;dx+=w/3)b.box(0x707a78,x+dx,h+.7,z,2.1,1.4,2.1);
        }else if(kind===3){                                      // ④ 高瘦板楼:阳台阵列
          const h=34+s.r()*16,w=6.5+s.r()*1.6;
          b.box(0x8d9186,x,h/2,z,w,h,9.5);
          for(let y=3;y<h-1;y+=2.7){
            b.box(0xb6bcae,x,y-1.05,face-side*4.9,w,.16,1.5);      // 阳台板
            b.box(0x6a746f,x,y-.45,face-side*5.55,w,.08,.08);      // 栏杆
            for(let dx=-w/2+.9;dx<w/2;dx+=1.8)b.box(0x35505c,x+dx,y,face-side*4.78,1.2,1.6,.07);
          }
          b.box(0x5d6660,x,h+.6,z,w*.9,1.2,9);
        }else{                                                   // ⑤ 带山墙的老公寓:坡屋顶
          const h=17+s.r()*7,w=11+s.r()*2;
          b.box(0xa89a80,x,h/2,z,w,h,10);
          for(let y=3;y<h-1;y+=3.2)for(let dx=-w/2+1.3;dx<w/2;dx+=2.4){
            b.box(0x33454e,x+dx,y,face-side*5.03,1.25,1.7,.08);
            b.box(0x7d6f5b,x+dx,y-1.05,face-side*5.16,1.45,.14,.35);
          }
          for(let t=0;t<4;t++)b.box(0x8a4f3d,x,h+.35+t*.62,z,w*(1-t*.2),.62,10*(1-t*.16));
        }
      }
      for(let z=-16;z<30;z+=12){tree(s,b,side*17,z,"street",.78);lamp(s,b,side*17.3,z+5);}
    }
    /* 场地隔离(§"边界气质":城市 = 铁丝网 + 台阶)。
       街头球场没有围栏很假 —— 球会滚到马路上。这里做经典的 cage court:
       立柱 + 上下横杆走合批(不增 draw call),网面单独一张带透明贴图的 mesh
       (整圈共 1 个 draw call,比用几千根细杆便宜得多,观感也更像网)。
       高度 3.6m,离边线 2.9m —— 不进跑动区,也不会挡住篮筐读数。 */
    const FX=10.5,FZ0=-15.5,FZ1=25.5,FH=3.6;
    for(const sx of [-1,1]){
      for(let z=FZ0;z<=FZ1;z+=2.6)b.box(0x3b444a,sx*FX,FH/2,z,.10,FH,.10);   // 立柱
      for(const y of [FH,FH*.5,.15])b.box(0x4a545a,sx*FX,y,(FZ0+FZ1)/2,.07,.07,FZ1-FZ0);
    }
    for(const [z,w] of [[FZ0,1],[FZ1,1]]){
      for(let x=-FX;x<=FX;x+=2.6)b.box(0x3b444a,x,FH/2,z,.10,FH,.10);
      for(const y of [FH,FH*.5,.15])b.box(0x4a545a,0,y,z,FX*2,.07,.07);
    }
    /* 网面:一张 canvas 画的菱形网,重复平铺 */
    const meshCv=document.createElement("canvas");meshCv.width=meshCv.height=64;
    const mg=meshCv.getContext("2d");mg.strokeStyle="rgba(196,208,214,.85)";mg.lineWidth=3;
    for(let i=-64;i<128;i+=16){mg.beginPath();mg.moveTo(i,0);mg.lineTo(i+64,64);mg.stroke();
      mg.beginPath();mg.moveTo(i,64);mg.lineTo(i+64,0);mg.stroke();}
    const meshTex=new THREE.CanvasTexture(meshCv);
    meshTex.wrapS=meshTex.wrapT=THREE.RepeatWrapping;meshTex.name="cageMesh";
    const cageMat=new THREE.MeshBasicMaterial({map:meshTex,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false});
    const cage=new THREE.Group();
    const panel=(w,h,x,y,z,ry)=>{
      const t=meshTex.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/1.6,h/1.6);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),cageMat.clone());
      m.material.map=t;m.position.set(x,y,z);m.rotation.y=ry;cage.add(m);
    };
    panel(FZ1-FZ0,FH,-FX,FH/2,(FZ0+FZ1)/2,Math.PI/2);
    panel(FZ1-FZ0,FH, FX,FH/2,(FZ0+FZ1)/2,Math.PI/2);
    panel(FX*2,FH,0,FH/2,FZ0,0);panel(FX*2,FH,0,FH/2,FZ1,0);
    cage.name="cityCageFence";s.root.add(cage);s.cage=cage;
    // A distant cross-street closes the skyline in the shooting view without blocking the hoop.
    for(let i=0;i<7;i++){const x=-29+i*10,h=26+s.r()*32;b.box(i%2?0x466578:0x738b94,x,h/2,-48,8,h,8);
      b.box(0x89968f,x,h+.5,-48,6.5,1,6);b.box(0x35464d,x+.7,h+1.7,-48,2,1.5,2);
      for(let y=3;y<h;y+=2.8){b.box(0xb3b9ab,x,y-.9,-43.94,8,.1,.09);for(let dx=-2.7;dx<=2.8;dx+=1.8)b.box((i+Math.round(y))%3?0x829b9e:0xc8c5ac,x+dx,y,-43.88,1.1,1.65,.06);}
      b.box(i%2?0xaf6752:0x386f72,x,2.5,-43.3,7.8,.45,1.5);for(let dx of [-2.5,0,2.5])b.box(0x263d47,x+dx,1.2,-43.8,1.8,2,.12);
    }
    const types=["sedan","bus","sedan","schoolbus","sedan","bus"];
    types.forEach((type,i)=>{
      const g=new THREE.Group(),car=batch(),long=type!=="sedan",len=long?7.4:4.4,h=long?2.5:1.35,color=type==="schoolbus"?0xdfab28:type==="bus"?0xd6d8cc:[0x233540,0x973d36,0xe0d7c4][i%3];
      car.box(color,0,.65,0,1.85,1.05,len);car.box(color,0,long?1.8:1.2,long?0:.1,1.76,long?1.4:.7,long?len-.15:2.4);
      car.box(0x324c58,0,h*.8,long?-len/2-.005:-1.12,1.5,long?.85:.45,.06);
      for(let side of [-1,1]){
        for(let z=long?-2.7:-.6;z<=(long?2.8:.8);z+=long?1.1:1.1)car.box(0x344e58,side*.891,long?1.97:1.4,z,.035,long?.7:.4,long?.82:.9);
        for(let z of [-len*.31,len*.31])car.add("sphere",0x242728,side*.92,.39,z,.15,.37,.37);
        car.box(0xeee1ad,side*.6,.67,-len/2-.03,.32,.16,.04);car.box(0xac4638,side*.6,.68,len/2+.03,.25,.14,.04);
      }
      car.box(type==="schoolbus"?0x3c3830:0x7c8b8e,0,.8,-len/2-.04,1.5,.08,.05);car.finish(g,`vehicle:${type}`);
      const dir=i%2?1:-1;g.position.set((i<3?-1:1)*(dir===1?21:25),0,-40+i*17);g.rotation.y=dir===1?Math.PI:0;s.root.add(g);s.vehicles.push({g,dir,speed:dir===1?4.8:5.6,type});
    });
  }
  /* ---------------- 雨天京都:嵌在町屋之间的社区球场 ----------------
     §2.1 先定空间再放物件。从中线往外分带(m):
       0~7.62 比赛面 → ~11.0 湿石板缓冲 → 11.0~11.7 侧沟 + 路缘
       → 11.7~13.3 抬高的檐下人行道 → 13.4 町屋立面 → ≥21 第二排错落屋顶。
     旧版首排房子甩在 x=±22、中间留 14m 空地,读起来是"广场里摆了几栋独栋",
     这正是计划书 §1 点名的问题。
     ⚠ 菜单环绕机位走 (18cos a, 8, 4.745+20 sin a) 的椭圆、高度只有 8m:
       椭圆内的屋脊必须压在 6.4m 以下,高体量只能放到椭圆外
       (|x|≥20,或 z≤-16.5 —— 椭圆最深只到 z=-15.26),否则菜单镜头会从屋顶里穿过去。 */
  const KY={
    wall:[0xb0a894,0xa2997f,0xbdb49e,0x968d7a,0xb5a993],   // 灰泥 / 土壁
    wood:[0x4a382a,0x553f2d,0x3d2e23,0x5e4632],            // 柱、格子、下見板
    tile:[0x38444a,0x313c42,0x414d52],                     // 瓦
    base:0x4b4943
  };
  /* 局部坐标:立面在 z=0、街在 +z、开间沿 x;rot 只取 0/±90/180,
     所以世界里仍然是轴对齐盒子,不多花三角形。slope>0 = 朝街那侧压低(檐口/屋面)。
     有了它,同一段立面代码能贴到四条街上,不必手写四套世界坐标(计划 §5"轻量布局描述")。
     ⚠ 合批的欧拉序是 XYZ(R=Rx·Ry·Rz),局部 X 轴倾斜没法和 ry 叠加,
       所以这里不给盒子 yaw,而是直接换算尺寸并按朝向选 rx / rz。 */
  function facing(bat,ox,oz,rot){
    const c=Math.round(Math.cos(rot)),sn=Math.round(Math.sin(rot));
    const put=(color,lx,ly,lz,w,h,d,slope=0)=>{
      const wx=ox+lx*c+lz*sn,wz=oz-lx*sn+lz*c;
      if(sn)bat.box(color,wx,ly,wz,d,h,w,0,0,sn>0?-slope:slope);
      else bat.box(color,wx,ly,wz,w,h,d,c>0?slope:-slope,0,0);
    };
    put.at=(lx,lz)=>[ox+lx*c+lz*sn,oz-lx*sn+lz*c];
    return put;
  }
  /* 一间町屋。相邻两间**共墙、不留缝**,所以整排读起来是连续街区而不是一排独栋;
     变化只发生在开间宽度、有没有二层、屋脊高度和瓦色上。 */
  function machiya(put,wput,cx,w,i,h1){
    const two=i%3!==1,D=6.8;
    const eave=(h1||2.82)+(i%2)*.12;
    const wallH=two?eave+1.96:eave+.5,ridge=wallH+(two?1:.72);
    const wall=KY.wall[i%5],wood=KY.wood[i%4],tile=KY.tile[i%3];
    put(wall,cx,wallH/2,-D/2,w,wallH,D);                        // 主体(与邻居共墙)
    put(KY.base,cx,.17,.1,w,.34,.46);                           // 墙脚石:墙和地面之间要有交代
    put(wood,cx,.82,.05,w,1.3,.12);                             // 下見板
    put(wood,cx,eave-.22,.04,w,.2,.14);                         // 一层楣
    const bays=Math.max(2,Math.round(w/1.5));
    for(let k=0;k<=bays;k++)put(wood,cx-w/2+k*w/bays,1.95,.08,.13,1.96,.17);   // 格子竖棂
    for(let k=0;k<3;k++)put(wood,cx,1.42+k*.52,.1,w-.08,.055,.13);
    if(two){
      put(tile,cx,eave+.3,1.04,w+.1,.16,2.2,.17);               // 一层深庇 → 檐下干燥带
      put(wood,cx,eave+.04,2.08,w+.1,.22,.15);
      put(wood,cx,wallH-.12,.04,w,.16,.13);
      for(let k=0;k<2;k++){
        const bx=cx-w*.2+k*w*.4;
        put(0x2b2924,bx,wallH-1.02,.05,w*.26,.8,.1);            // 虫籠窓
        for(let j=0;j<4;j++)put(wall,bx-w*.09+j*w*.06,wallH-1.02,.1,.045,.8,.07);
      }
    }
    // 屋面两坡;平屋没有深庇,直接让主屋面出挑到街上,形成更低的近处屋檐
    const fd=3.4+(two?0:1.9);
    put(tile,cx,ridge-fd*.167,-3.4+fd/2,w+.22,.19,fd,.34);
    put(tile,cx,ridge-.57,-5.1,w+.22,.19,3.5,-.34);
    put(tile,cx,ridge+.02,-3.4,w+.28,.2,.55);                   // 屋脊瓦
    if(i%4===0&&two)wput(0xc79a5c,cx,wallH-1.02,.13,w*.26,.72,.05);   // 少量二层亮灯,不是每间都亮
  }
  /* 沿一条街摆连续町屋:开间不等宽但首尾相接,立面有节奏、没有缝。 */
  function machiyaRun(s,put,wput,x0,x1,seed,h1){
    const span=x1-x0,n=Math.max(1,Math.round(span/3.8)),ws=[];let tot=0;
    for(let i=0;i<n;i++){const t=.72+s.r()*.56;ws.push(t);tot+=t;}
    let x=x0;
    for(let i=0;i<n;i++){const w=span*ws[i]/tot;machiya(put,wput,x+w/2,w,seed+i,h1);x+=w;}
  }
  /* 第二排只做体量:错落的屋脊 + 瓦顶,负责在首排屋顶之上补出厚度。
     不做门窗细节 —— 计划 §2.1 是先定空间,远处细节收益低还费三角形。 */
  function kyBlock(put,x0,x1,h,i){
    const cx=(x0+x1)/2,w=x1-x0,D=8.5,tile=KY.tile[i%3];
    put(KY.wall[i%5],cx,h/2,-D/2,w,h,D);
    put(tile,cx,h+.55,-D*.25,w+.3,.2,D*.5+.5,.36);
    put(tile,cx,h+.55,-D*.75,w+.3,.2,D*.5+.5,-.36);
    put(tile,cx,h+1.12,-D/2,w+.34,.22,.6);
  }
  /* 土塀:院墙也是连续界面的一部分,用来收住不需要建筑的一段街(§2.1)。 */
  function kyWall(put,x0,x1,h){
    const cx=(x0+x1)/2,w=x1-x0;
    put(0x6f6656,cx,h/2,-.3,w,h,.5);
    put(KY.base,cx,.16,-.26,w,.32,.74);
    put(KY.tile[1],cx,h+.09,-.3,w+.26,.15,.95,.14);
  }
  function rainTown(s,b){
    const warm=batch();                                  // 全场暖光合成一张 basic 网格 = 1 个 draw call
    const FACE=13.4,BACK=-16.4,FRONT=27.6;
    b.box(0x4a514d,0,-.14,2,132,.12,140);                // 湿沥青底
    /* ── 场外铺装:侧沟 + 抬高的檐下人行道。
       计划 §2.2 要求消除"统一宽边",而且高差要做成真的,不是画在贴图上。 */
    for(const side of [-1,1]){
      b.box(0x2c3639,side*11.32,-.02,5.6,.62,.1,44);      // 侧沟(常年积水,最暗的一条)
      b.box(0x7c7d74,side*11.75,.05,5.6,.26,.24,44);      // 路缘石
      b.box(0x62675f,side*12.15,.06,5.6,.62,.26,44);      // 人行道:淋得到雨的一半
      b.box(0x77766a,side*12.86,.06,5.6,.86,.26,44);      // 檐下干燥的一半(颜色发灰发浅)
    }
    b.box(0x585f5b,0,-.05,-14.8,29,.1,3.6);               // 球场贴图只画到 z=-13,背街前这段要补
    b.box(0x585f5b,0,-.05,25.4,29,.1,5);
    // ① 背街:篮筐正后方的连续町屋,只留一条 2.7m 窄巷
    const backPut=facing(b,0,BACK,0),backWarm=facing(warm,0,BACK,0);
    machiyaRun(s,backPut,backWarm,-24,.2,0);
    machiyaRun(s,backPut,backWarm,5.8,17.5,9);
    /* 節点 1:巷口的街角小店 —— 全场唯一的暖色锚点,也是"雨里生活还在继续"的落点。 */
    (()=>{
      const x0=.2,x1=3.1,cx=(x0+x1)/2,w=x1-x0;
      backPut(0xa79c85,cx,2.9,-3.4,w,5.8,6.8);
      backPut(0x24211d,cx,1.6,.07,w-.42,3.2,.1);                  // 敞开的店面:先是暗的
      backWarm(0xc59457,cx,2.24,.16,w-.66,1.5,.06);               // 店内只有上半亮:整块刷亮会读成发光墙
      backWarm(0xa8763f,cx,.9,.34,w-.9,.5,.5);                    // 柜台一线
      backWarm(0x6d5230,cx,.02,1.5,w-.3,.05,2.6);                 // 灯光洒到湿地面上的一小片
      backPut(0x8a3f34,cx,2.86,.5,w-.24,.66,1.2);                 // 暖簾
      backPut(KY.tile[0],cx,3.42,1.05,w+.22,.16,2.3,.2);          // 雨棚
      backPut(0x33302a,cx,4.55,.06,w,.86,.18);                    // 招牌
      backPut(0x4a382a,x1-.34,3.62,.42,.1,1.1,.1);
      backWarm(0xd79a55,x1-.34,3.12,.42,.3,.5,.3);                // 灯笼
      backPut(KY.tile[1],cx,5.9,-2.2,w+.26,.19,5,.3);
      backPut(KY.tile[1],cx,5.9,-5.4,w+.26,.19,3.4,-.34);
    })();
    // 窄巷:两侧山墙 + 巷底横向建筑,视线不会一眼穿到世界尽头(计划 §A"巷尾必须有终点")
    b.box(0x574f42,4.45,-.05,-21,2.7,.1,9.2);                     // 巷底石板
    b.box(0x2f3639,4.45,-.02,-21,.5,.08,9.2);                     // 巷心排水沟,接到球场侧沟
    for(const [wx,dir] of [[3.28,1],[5.62,-1]]){
      b.box(0x9d947f,wx,3.1,-21,.34,6.2,9.2);
      b.box(KY.tile[0],wx+dir*.42,6.32,-21,1.1,.18,9.4,0,0,dir*.3);
    }
    // ② 第二排:错落更高的屋顶,压在首排之上补厚度;顺手把巷子封住
    const midPut=facing(b,0,-25.6,0);
    [[-27,-19.4,9.2],[-19.4,-12.3,11],[-12.3,-5.6,8.2],[-5.6,1.3,11.4],[1.3,8.6,8.8],[8.6,18,10.2]]
      .forEach(([a,c,h],i)=>kyBlock(midPut,a,c,h,i));
    /* 巷尾:一扇亮着的门 + 一盏灯。窄而暗,巷子才有纵深;
       整片刷亮会变成"巷底有块发光板",反而把纵深压平。 */
    b.box(0x3b3128,4.45,2.9,-25.5,2.6,.5,.36);
    b.box(0x241f1a,4.45,1.35,-25.48,1.7,2.3,.1);
    warm.box(0xb98a4e,4.45,1.28,-25.42,1.02,1.9,.06);
    warm.box(0xd79a55,3.32,2.35,-25.36,.26,.42,.26);
    warm.box(0x6a5130,4.45,.02,-24.5,1.5,.05,1.9);                // 门口洒到巷底的光
    // ③ 更远的第三排:只给天际线厚度,28~68m 的雾会把它压成剪影
    const farPut=facing(b,0,-35.4,0);
    [[-25,-14.5,12],[-14.5,-3.6,10.4],[-3.6,7.4,13.2],[7.4,17,11]].forEach(([a,c,h],i)=>kyBlock(farPut,a,c,h,i+3));
    /* ④ 两侧首排:立面收到边线外 5.8m,只在入口处断开。
       局部 x 沿街,左排 rot=+90°(局部 x = 世界 -z),右排 rot=-90°(局部 x = 世界 +z)。 */
    const leftPut=facing(b,-FACE,0,Math.PI/2),leftWarm=facing(warm,-FACE,0,Math.PI/2);
    machiyaRun(s,leftPut,leftWarm,-21,-8.4,17);                   // 世界 z 21 → 8.4
    machiyaRun(s,leftPut,leftWarm,-5.2,9.8,21);                   // 世界 z 5.2 → -9.8(主立面)
    machiyaRun(s,leftPut,leftWarm,13.4,16.4,26);                  // 转角回到背街
    kyWall(leftPut,-28,-21,2.15);
    const rightPut=facing(b,FACE,0,-Math.PI/2),rightWarm=facing(warm,FACE,0,-Math.PI/2);
    machiyaRun(s,rightPut,rightWarm,-16.4,-3.2,29);               // 世界 z -16.4 → -3.2
    machiyaRun(s,rightPut,rightWarm,.4,14,34);
    kyWall(rightPut,14,28,2.15);
    // ⑤ 场后端:低矮的背面街区,把菜单环绕的另一半也收住
    const frontPut=facing(b,0,FRONT,Math.PI),frontWarm=facing(warm,0,FRONT,Math.PI);
    machiyaRun(s,frontPut,frontWarm,-16,-3.4,39);
    machiyaRun(s,frontPut,frontWarm,-.6,16,44);
    // 侧后方第二排:高体量只能放在菜单椭圆之外(|x|≥20)
    const leftBack=facing(b,-21.6,0,Math.PI/2),rightBack=facing(b,21.6,0,-Math.PI/2);
    [[-19,-11,7.8],[-11,-3,9.4],[-3,5.4,8.2],[5.4,14,10]].forEach(([a,c,h],i)=>kyBlock(leftBack,a,c,h,i+1));
    [[-17,-9,9.2],[-9,-1,7.6],[-1,7,10.4],[7,15,8.4]].forEach(([a,c,h],i)=>kyBlock(rightBack,a,c,h,i+4));
    /* ⑥ 三个入口:人行道断开成踏步、侧沟上架石板 —— 玩家从哪儿进场是看得见的。 */
    for(const [ex,ez,w] of [[-11.9,-11.6,3.4],[12.1,-1.4,3.4],[-11.9,6.8,3]]){
      const dir=Math.sign(ex);
      b.box(0x7f8078,ex,.09,ez,1.9,.3,w);                         // 过沟石板
      b.box(0x6d6f68,ex-dir*1.5,.05,ez,1.3,.22,w);                // 缓坡踏步
      b.box(0x8a8b82,ex+dir*1.5,.12,ez,1.2,.34,w);
    }
    /* 節点 3:靠墙的自行车与伞架(计划 §A)。全部贴在 +x 人行道内侧,不进跑动区。 */
    for(let i=0;i<5;i++){
      const z=-11.6+i*1.2,x=12.9;
      b.box(0x3b4a52,x,.62,z,.46,.06,1.5);
      for(const dz of [-.56,.56])b.box(0x2b2f33,x,.34,z+dz,.07,.66,.66);
      b.box(0x8d8f8a,x-.06,.96,z-.5,.5,.06,.07);
      b.box(i%2?0x7a4b3c:0x35506a,x,.86,z+.16,.32,.2,.42);
    }
    b.box(0x53483a,13,.5,-4.2,.4,1,.86);                          // 伞架
    for(let i=0;i<6;i++)b.box([0x2f3f52,0x6d4a44,0x3f5a4a][i%3],13+(i%2?-.09:.09),1.16,-4.5+i*.12,.06,1.3,.06,0,0,.12);
    // 自动販売機:雨夜街角最可信的一块暖光
    b.box(0x2b3138,12.86,.9,1.4,.72,1.8,.66);
    warm.box(0xdda765,12.5,1.06,1.4,.06,1.32,.5);
    /* 行灯:两个入口各一盏。s.lights 在雨天由 update() 常亮。 */
    for(const [lx,lz] of [[-11.86,-11.6],[12.16,-1.4]]){
      b.box(0x2f3733,lx,1.75,lz,.14,3.5,.14);
      b.box(0x2f3733,lx,3.44,lz,.36,.16,.36);
      warm.box(0xd9a468,lx,3.06,lz,.3,.5,.3);
    }
    /* 树按团块长在墙角与巷口,不再沿边线等距排一圈(计划 §2.1)。
       都种在立面之后的空档里,树冠从屋顶后面探出来。 */
    /* ⚠ 树必须种在立面的**豁口**里:种到房子后面时只有树冠越过屋脊,
       画面上就是一团悬空的叶子(计划验收明确禁止"物体漂浮")。
       三处豁口:世界 z∈[5.2,8.4] 与 z∈[-13.4,-9.8](左)、z∈[-3.2,0.4](右)。 */
    tree(s,b,-15.2,6.9,"maple",1);tree(s,b,-16.8,7.8,"maple",.82);
    tree(s,b,-15.6,-11.4,"bamboo",.95);tree(s,b,-17,-12.4,"bamboo",.8);
    tree(s,b,15.4,-1.5,"bamboo",.95);tree(s,b,16.7,-2.6,"bamboo",.78);
    // 墙脚植栽:成组靠墙,不撒满
    for(let i=0;i<7;i++){
      const t=i/6,x=-12.9+(i%2)*.16,z=-6.6+t*4.4;
      b.box(0x5d5346,x,.22,z,.5,.44,.5);b.add("blob",0x486b45,x,.6,z,.34,.3,.34);
    }
    const glow=warm.finish(s.root,"kyotoWarmGlow",true);
    if(glow){glow.material.color.setScalar(.9);s.lights.push({mesh:glow,threshold:.5});}
  }
  /* ---------------- 湘南海岸高校球场 ----------------
     ⚠ 2026-09-10 重构:海岸带从"球场左侧(-x)"整体转到**篮筐正后方**,沿 x 横着铺。
     原因是投篮机位顺着球场长轴看 —— 侧面的东西基本进不了画框,上一版把
     防波堤 / 铁道 / 电线杆全摆在 x=-19 一线,玩家真正看到的只有一条灰带。
     现在从球场往 -z 依次是:
       人行道(抬高 .19) → 沿海公路 → 电线杆与架空线 → 铁道 → 低护栏 → 沙滩 → 海
     于是电车**横穿画框**从篮板后面驶过,电线与钢轨也横着切过背景 —— 这是本图的骨架。
     校园压在 +x(校舍 + 铁丝网),-x 是校门、围墙和自行车棚,构成"放学后"的另一半。 */
  function shonan(s,b){
    const R=s.r,M=s.mobile;
    const WALK_Z=-14.4,ROAD_Z=-18,POLE_Z=-21,RAIL_Z=-23.4,GUARD_Z=-26.4,SEA_Y=-.45,SHORE_Z=-40;
    b.box(0x9a9e97,0,-.13,4,170,.12,90);          // 球场与校园地面(只铺到沙滩之前)

    /* ---- 海:直接摆在篮筐后方,水线压在 -44 ---- */
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(620,520),
      new THREE.MeshLambertMaterial({color:0x2f6c8c}));
    sea.rotation.x=-Math.PI/2;sea.position.set(0,SEA_Y,SHORE_Z-258);sea.name="shonanSea";
    s.root.add(sea);s.ocean=sea;
    /* 沙滩:从护栏一路缓降到水线。分几条带做出湿沙/干沙的色差(§2.5 磨损要有成因)。 */
    /* 沙滩几乎和场地同高(只缓降 0.2m)。压得越低反而露得越晚 —— 见护栏那条注释。 */
    for(let i=0;i<5;i++){
      const z0=GUARD_Z-1.4-i*2.4,t=i/4;
      b.box(i%2?0xdcd3ba:0xd5cbb1,0,-.05-t*.05,z0,180,.12,2.5);
    }
    b.box(0xc9bda1,0,-.14,SHORE_Z+4.6,180,.12,9);                     // 中段沙
    b.box(0xbcae92,0,-.22,SHORE_Z+1.2,180,.12,4.4);                   // 湿沙
    /* 浪线:横向长条,update 里整体朝岸推移 */
    const waves=batch();
    for(let i=0;i<(M?10:18);i++)for(let j=0;j<4;j++)
      waves.box(0xbcd8dc,-70+i*16+(j%2)*7,SEA_Y+.06,SHORE_Z-j*13-R()*5,11+R()*10,.02,.11+R()*.16);
    s.wave=waves.finish(s.root,"shonanFoam");
    // 消波块:堆在水线附近的两处,不是连成一条墙
    for(const cx of [-31,26]){
      for(let k=0;k<(M?5:9);k++){
        const px=cx+(R()-.5)*13,pz=SHORE_Z+1.5+(R()-.5)*5,py=-.35+R()*.6;
        for(let t=0;t<3;t++)b.box(0x9a978d,px,py,pz,1.6,.52,.52,R()*3,R()*3,R()*3);
      }
    }

    /* ---- 人行道 + 低栏:球场与公路之间 ---- */
    b.box(0x8f938c,0,.06,WALK_Z,170,.26,1.9);                          // 抬高的人行道
    b.box(0x7c8079,0,.05,WALK_Z-1.05,170,.24,.24);                     // 路缘
    for(let x=-60;x<60;x+=2.4)b.box(0x9aa39c,x,.62,WALK_Z-1.2,.09,.86,.09);   // 护栏立柱
    for(const y of [1.02,.62])b.box(0x9aa39c,0,y,WALK_Z-1.2,170,.07,.07);

    /* ---- 沿海公路(沿 x 横穿画框)---- */
    b.box(0x4a4f52,0,-.04,ROAD_Z,180,.08,5.2);
    for(let x=-72;x<72;x+=5)b.box(0xd8d3bc,x,.012,ROAD_Z,2.1,.012,.10);        // 中线虚线
    for(const dz of [-2.5,2.5])b.box(0xd8d3bc,0,.012,ROAD_Z+dz,180,.012,.12);  // 边线
    b.box(0x8c8f88,0,.03,ROAD_Z+2.85,180,.14,.5);                              // 路肩牙

    /* ---- 铁道:枕木与钢轨都沿 x ---- */
    b.box(0x6b6459,0,.10,RAIL_Z,180,.20,4);                                    // 道砟路基
    for(let x=-86;x<86;x+=.78)b.box(0x554a3d,x,.21,RAIL_Z,.26,.09,2.9);        // 枕木
    for(const dz of [-.72,.72])b.box(0x8e9297,0,.29,RAIL_Z+dz,180,.10,.11);    // 钢轨
    b.box(0x7d817a,0,.32,RAIL_Z+2.6,180,.2,.22);                               // 铁道侧的矮挡

    /* ---- 电线杆 + 架空线(核心锚点):沿 x 排,横着切过背景 ---- */
    const poles=[];
    for(let i=0;i<(M?7:11);i++){
      const x=-72+i*15,h=9.6+R()*1.5;
      b.box(0x8d8577,x,h/2,POLE_Z,.30,h,.30);
      for(const [ay,aw] of [[h-.5,2.6],[h-1.5,2.0]])b.box(0x6f675c,x,ay,POLE_Z,.13,.11,aw);
      for(const [dz,ly] of [[-1.1,.34],[1.1,.34],[0,1.34]])b.box(0x51595c,x,h-ly,POLE_Z+dz,.13,.28,.13);
      poles.push({x,h});
    }
    // One indexed tube per whole span. All cross-sections share vertices, so
    // antialiasing cannot expose gaps between independent rotated sticks.
    const cableGroup=new THREE.Group();cableGroup.name="shonanCables";
    const cableMat=new THREE.MeshLambertMaterial({color:0x2f3438});
    let spanCount=0;
    for(let i=0;i+1<poles.length;i++){
      const a=poles[i],c=poles[i+1];
      for(const [dz,ly] of [[-1.1,.34],[1.1,.34],[0,1.34]]){
        class SagCable extends THREE.Curve{
          getPoint(t,target=new THREE.Vector3()){
            return target.set(a.x+(c.x-a.x)*t,
              a.h+(c.h-a.h)*t-ly-4*.65*t*(1-t),POLE_Z+dz);
          }
        }
        const mesh=new THREE.Mesh(new THREE.TubeGeometry(new SagCable(),32,.045,5,false),cableMat);
        mesh.name="shonanCableSpan";
        mesh.userData.ends=[[a.x,a.h-ly,POLE_Z+dz],[c.x,c.h-ly,POLE_Z+dz]];
        cableGroup.add(mesh);spanCount++;
      }
    }
    cableGroup.userData.spans=spanCount;
    // Shared static material; retain welded tube geometry while merging draws.
    if(window.AIBAModelDetail)AIBAModelDetail.batch(cableGroup);
    s.root.add(cableGroup);
    /* 低护栏:铁道与沙滩之间。⚠ 高度必须压住 —— 投篮机位眼高 2.3m、护栏在 28m 外,
       一道 0.86m 的横杆会把它后面 18m 的沙滩整片挡在视线下方(算式:
       ray_y = 2.3 - d·(2.3-h)/28,地面 y≈-0.1 要到 d≈46m 才露出来)。
       压到 0.6m 之后沙滩从 z≈-35 就开始露,海也早 6m 出现。 */
    for(let x=-70;x<70;x+=2.6)b.box(0x9aa39c,x,.30,GUARD_Z,.09,.60,.09);
    for(const y of [.56,.30])b.box(0x9aa39c,0,y,GUARD_Z,170,.06,.06);

    /* ---- 校舍(边界气质:校园),压在 +x ---- */
    const SCH_X=20;
    /* 校舍在公路的**内陆一侧**(z>-13),否则会压在新的沿海道路/铁道上。
       段位刻意不等距:17.5~26.5 之间留出校门前的空档 —— QA 的 wide 机位 (20,12,24)
       正好落在这里,不然整个画面会被校舍的墙糊死。 */
    const SEGS=M?[-5,10]:[-5,10,34];
    for(let seg=0;seg<SEGS.length;seg++){
      const z=SEGS[seg],h=11.5,w=13;
      b.box(0xcfcabb,SCH_X,h/2,z,w,h,15);
      b.box(0xb6b1a2,SCH_X,h+.35,z,w+.5,.7,15.5);
      for(let f=0;f<3;f++){
        const fy=1.9+f*3.4;
        b.box(0x9aa39c,SCH_X-w/2-.05,fy-.95,z,.12,.18,15);
        b.box(0xdad5c6,SCH_X-w/2-.6,fy-1.5,z,1.3,.18,15);
        for(let dz=-6.2;dz<=6.2;dz+=1.55){
          b.box(0x5b7480,SCH_X-w/2+.02,fy,z+dz,.07,1.5,1.32);
          b.box(0xe6e2d4,SCH_X-w/2+.01,fy+.86,z+dz,.09,.16,1.4);
        }
      }
      if(seg===1){for(let f=0;f<3;f++)b.box(0x8f8a7d,SCH_X-w/2-1.3,1.9+f*3.4,z+7.4,1.5,3.2,.3);}
    }
    b.box(0xb9b3a4,SCH_X-9.5,1.6,20,3.6,3.2,5);                        // 器材间
    b.box(0x7d786c,SCH_X-9.5,3.35,20,4,.35,5.4);
    b.box(0x4e5a52,SCH_X-11.35,1.5,20,.12,2.4,1.6);
    for(let i=0;i<(M?4:7);i++)tree(s,b,SCH_X-10.1+R()*2,-10+i*9+R()*3,i%3?"street":"palm",.85+R()*.3);

    /* ---- -x 一侧:校门 + 围墙 + 自行车棚(计划 §E 的三个节点)---- */
    const GX=-13.4;
    const wallRun=(z0,z1)=>{
      b.box(0xc7c2b2,GX,1.1,(z0+z1)/2,.4,2.2,z1-z0);                   // 校园围墙
      b.box(0x9c9789,GX,2.28,(z0+z1)/2,.62,.16,z1-z0);
      b.box(0x8b8779,GX,.16,(z0+z1)/2,.66,.32,z1-z0);
    };
    wallRun(-13.2,-2.6);wallRun(3.4,15);wallRun(17,27);
    /* 節点 1:校门 —— 两根门柱 + 校名牌 + 敞开的门扇,放学的人从这里出去 */
    for(const dz of [-2.6,3.4]){
      b.box(0xd6d1c0,GX,1.55,dz,.72,3.1,.72);
      b.box(0x9c9789,GX,3.2,dz,.86,.22,.86);
    }
    b.box(0xe4dfcd,GX-.05,2.5,.4,.18,1.05,4.6);                        // 门楣校名牌
    b.box(0x54606a,GX-.02,.9,-1.9,.1,1.8,1.3);                         // 半开的门扇
    b.box(0x54606a,GX-.02,.9,2.7,.1,1.8,1.3);
    for(let k=0;k<4;k++)b.box(0xbdb7a6,GX+1.1+k*.5,.06+k*.05,.4,.5,.16+k*.1,4.4);  // 门内台阶
    /* 節点 2:自行车棚 —— 顶棚 + 两排车,靠着围墙 */
    b.box(0x8f8a7d,GX+2.3,2.28,9.2,3.6,.16,9,0,0,.08);
    for(const dz of [5.2,13.2])for(const dx of [.9,3.7])b.box(0x6f6a5f,GX+dx,1.14,dz,.12,2.28,.12);
    for(let i=0;i<8;i++){
      const z=5.4+i*1.05,x=GX+1.9+(i%2)*1.5;
      b.box(0x3b4a52,x,.62,z,1.5,.06,.46);
      for(const dx of [-.58,.58])b.box(0x2b2f33,x+dx,.34,z,.66,.66,.07);
      b.box(i%2?0x7a4b3c:0x35506a,x-.15,.86,z,.42,.2,.34);
    }
    /* 節点 3:堤边休息点 —— 自动販売機 + 两条长椅(长椅由人群系统摆,上面真的有人坐,
       见 spectators.js 的 benchDefs["shonanCoast"])。 */
    b.box(0x2b3138,-8.4,.95,WALK_Z+.2,.74,1.9,.66);
    // 亮面朝球场(+z),不是朝海 —— 朝海那面玩家永远看不到。
    const warm=batch();warm.box(0xdda765,-8.4,1.1,WALK_Z+.55,.54,1.3,.06);
    const glow=warm.finish(s.root,"shonanVending",true);
    if(glow){glow.material.color.setScalar(.8);s.lights.push({mesh:glow,threshold:.5});}

    /* ---- 铁丝网:校园那一侧与 +z 端,海那侧留给护栏 ---- */
    const FX=10.6,FZ0=-13.2,FZ1=26,FH=4;
    const post=(x,z)=>b.box(0x6c7169,x,FH/2,z,.10,FH,.10);
    for(let z=FZ0;z<=FZ1;z+=2.6)post(FX,z);
    for(const y of [FH,FH*.52,.16])b.box(0x7e837a,FX,y,(FZ0+FZ1)/2,.07,.07,FZ1-FZ0);
    for(let x=-FX;x<=FX;x+=2.6)post(x,FZ1);
    for(const y of [FH,FH*.52,.16])b.box(0x7e837a,0,y,FZ1,FX*2,.07,.07);
    const cv=document.createElement("canvas");cv.width=cv.height=64;
    const g2=cv.getContext("2d");g2.strokeStyle="rgba(214,220,214,.85)";g2.lineWidth=3;
    for(let i=-64;i<128;i+=16){g2.beginPath();g2.moveTo(i,0);g2.lineTo(i+64,64);g2.stroke();
      g2.beginPath();g2.moveTo(i,64);g2.lineTo(i+64,0);g2.stroke();}
    const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.name="shonanMesh";
    const cage=new THREE.Group();
    const panel=(w,h,x,y,z,ry)=>{
      const t=tex.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/1.7,h/1.7);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
        new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:false}));
      m.position.set(x,y,z);m.rotation.y=ry;cage.add(m);
    };
    panel(FZ1-FZ0,FH,FX,FH/2,(FZ0+FZ1)/2,Math.PI/2);
    panel(FX*2,FH,0,FH/2,FZ1,0);
    cage.name="shonanFence";s.root.add(cage);s.cage=cage;

    /* ---- 电车:两节编成,湘南色。车身沿 z 建好之后整体 yaw 90°,于是沿 x 行驶。 ---- */
    const trainG=new THREE.Group();
    const tb=batch(),CAR=17.4,GAP=.7;
    for(let c=0;c<2;c++){
      const z0=c*(CAR+GAP);
      tb.box(0xd8d4c6,0,2.05,z0,2.9,3.0,CAR);
      tb.box(0xe07b28,0,1.42,z0,2.94,1.05,CAR+.02);
      tb.box(0x2f6b3f,0,.72,z0,2.94,.62,CAR+.02);
      tb.box(0x394046,0,.30,z0,2.6,.5,CAR-1.2);
      for(const dz of [-CAR/2+.9,CAR/2-.9])
        for(const dx of [-1.1,1.1])tb.add("blob",0x22262a,dx,.34,z0+dz,.36,.34,.36);
      for(let w=-CAR/2+2.1;w<CAR/2-1.4;w+=2.35)
        for(const dx of [-1.47,1.47])tb.box(0x4a6b78,dx,2.35,z0+w,.04,1.15,1.55);
      tb.box(0x3d5a66,0,2.35,z0-CAR/2-.01,2.2,1.2,.05);
      tb.box(0x9aa0a4,0,3.58,z0,1.5,.16,CAR-3);
      tb.box(0x6d7378,0,3.95,z0+CAR*.28,.9,.62,.10);
    }
    tb.finish(trainG,"shonanTrain");
    trainG.rotation.y=Math.PI/2;                    // 车身长度从 z 转到 x
    trainG.position.set(120,.32,RAIL_Z);trainG.visible=false;s.root.add(trainG);
    /* ⚠ 发车间隔必须构建期预生成:world-places.test.mjs 断言环境动画期间
       Math.random 调用数为 0,在 update 里摇随机数会直接把那条打红。 */
    const gaps=[];for(let i=0;i<6;i++)gaps.push(14+R()*20);
    s.train={g:trainG,axis:"x",t:-(3+R()*7),gaps,gi:0,speed:20,from:118,to:-128,len:CAR*2+GAP};

    /* ---- 远景:江之岛式的小岛压在海平线上,不抢锚点 ---- */
    // 小岛推到画框左侧,别正好压在篮板后面
    b.add("blob",0x6d7f86,-96,2.2,SHORE_Z-96,11,4.4,8);
    b.add("blob",0x5d6f76,-84,1.6,SHORE_Z-88,6,2.6,5);
    b.add("blob",0x50624f,-96,4.6,SHORE_Z-96,6.2,1.8,4.4);
    for(let i=0;i<3;i++)b.add("blob",0x84969a,58+i*38,1.6+i*1.2,SHORE_Z-120-i*30,13+i*7,2.8+i*1.6,8+i*4);
  }
  /* ---------------- 地中海半岛海岸球场 ----------------
     文档 Scene 02。锚点:**蓝海 + 白色建筑**(只此一个,不再加别的奇观)。
     ⚠ 空间安排吸取了湘南的教训:投篮机位顺着球场长轴看,摆在"侧面"的东西
     基本进不了画框。所以海放在**篮筐正后方**(文档允许"主篮筐可朝向海湾或海天线"),
     白色村落压在 +x 与身后,-x 留给石墙与崖边橄榄树。
     边界气质(文档):石墙 + 海崖 + 建筑 —— 没有一段是围栏。 */
  function med(s,b){
    const R=s.r,M=s.mobile;
    /* ⚠ 崖顶视角的几何:站在离崖沿 22m、落差 9.5m 的地方,近处的海全被台地自己
       挡住,屏幕上只剩靠近地平线的一条窄带(约 3.5°),再被雾一洗就完全读成天空。
       解法是把崖沿推近到篮筐后 7m、落差压到 4.5m —— 海带一下张开到约 8°,
       而且最近的海只有 48m,雾吃不掉。 */
    const CLIFF_Z=-15;                    // 崖沿:再往 -z 就是海
    b.box(0xcdc3a8,0,-.13,17,150,.12,66); // 半岛台地(只铺到崖沿这一侧)

    /* ---- 海与海天线(锚点之一)---- */
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(900,700),
      new THREE.MeshLambertMaterial({color:0x1d6b96}));
    sea.rotation.x=-Math.PI/2;sea.position.set(0,-4.5,CLIFF_Z-330);sea.name="medSea";
    s.root.add(sea);s.ocean=sea;
    /* 海面高光带:朝太阳那一侧(-x)拉一片更亮的水,文档要"海面有大面积自然高光" */
    const glint=batch();
    for(let i=0;i<(M?14:26);i++)
      glint.box(0x6fb6cf,-30-R()*90,-4.46,CLIFF_Z-26-i*13-R()*8,20+R()*30,.02,.6+R()*1.6);
    for(let i=0;i<(M?10:18);i++)
      glint.box(0x9fd3e0,-46-R()*80,-4.44,CLIFF_Z-34-i*17-R()*9,14+R()*22,.02,.4+R()*1.0);
    s.wave=glint.finish(s.root,"medGlint");

    /* ---- 海崖:台地边缘垂下去的岩壁 ---- */
    for(let x=-70;x<70;x+=5.4){
      const drop=4+R()*1.6,jut=(R()-.5)*2.4;
      b.box(0xb9ac90,x,-drop/2,CLIFF_Z-1+jut,5.6,drop,4.6,0,(R()-.5)*.12,0);
      b.box(0xa2957c,x,-drop-.6,CLIFF_Z-2.4+jut,5.2,1.6,5.4,(R()-.5)*.2,0,0);
      if(R()<.5)b.add("blob",0x7d8a5f,x+(R()-.5)*3,-.7-R()*1.4,CLIFF_Z-2.6,1.2+R()*1.1,.6,1+R());
    }
    /* 崖沿石墙(边界气质:石墙),不是围栏 —— 断续、有豁口 */
    for(let x=-40;x<40;x+=1.15){
      if(Math.abs(x-6)<3.2)continue;                       // 留一个下海的豁口
      const h=.72+R()*.26;
      b.box(R()<.5?0xd6cbb2:0xc3b79c,x,h/2,CLIFF_Z+.6,1.1,h,.85,0,(R()-.5)*.14,(R()-.5)*.05);
    }

    /* ---- 白色村落(锚点之二):+x 一侧顺坡叠上去 ---- */
    const wallTone=[0xf2ece0,0xe8e0cf,0xdfd6c2,0xf6f1e6];
    const house=(x,y,z,w,h,d,roof)=>{
      b.box(wallTone[(R()*4)|0],x,y+h/2,z,w,h,d);
      if(roof)for(let t=0;t<3;t++)b.box(0xb05f3d,x,y+h+.18+t*.34,z,w*(1-t*.17),.34,d*(1-t*.15));
      else b.box(0xe4dccb,x,y+h+.12,z,w+.24,.24,d+.24);    // 平屋顶女儿墙
      /* 蓝门窗 + 蓝遮阳棚 */
      for(let dz=-d/2+1.1;dz<d/2-.6;dz+=1.9){
        b.box(0x2c6ba4,x-w/2-.04,y+h*.52,z+dz,.07,1.35,.95);
        if(R()<.45)b.box(0x2f7fb8,x-w/2-.5,y+h*.52+.86,z+dz,.95,.09,1.05,-.26);
        if(R()<.4){                                        // 陶罐花盆 + 三角梅
          b.box(0xb9714a,x-w/2-.42,y+h*.52-.72,z+dz,.34,.34,.34);
          b.add("blob",0xc63a7a,x-w/2-.42,y+h*.52-.42,z+dz,.36,.28,.36);
        }
      }
    };
    for(let t=0;t<(M?3:4);t++){                            // 逐级抬高的台地
      /* ⚠ tx 是**朝球场那一面的立面**,不是房子中心。
         原来传的是中心:house(11.8,...) 配上最宽 9.4 的开间,-x 面落在 x≈7.1,
         比边线(7.62)还靠里 —— 右底角架(x=7.2)的球员站在墙里,
         跟随机位 (9.96,2.18,-5.44) 到篮筐的 8 条视线被整堵白墙挡死。
         生产机位包络实测 |x|≤9.96,所以立面定在 11.9;蓝遮阳棚外挑后仍留 0.9m。 */
      const ty=t*2.6,tx=11.9+t*7;
      b.box(0xd8cdb3,tx+3,ty*.5,6,12,ty+.3,64);            // 挡土台
      for(let i=0;i<(M?4:6);i++){
        const z=-16+i*11+R()*4,h=3.4+R()*2.6,w=7+R()*2.4;
        house(tx+w/2,ty,z,w,h,8+R()*2,R()<.7);
      }
      /* 石阶:每级台地之间。t=0 的一组会埋到地面以下,而且会伸进场内,不画。 */
      if(t)for(let k=0;k<7;k++)b.box(0xcfc3a8,tx-4.2-k*.45,ty-k*.36,-2+R()*2,.9,.36,2.6);
    }
    /* 身后也压一排,别让 +z 露空 */
    for(let i=0;i<(M?3:5);i++)house(8+i*8.5,0,29+R()*5,7+R()*2,3.6+R()*2,8,R()<.6);

    /* ---- -x 一侧:矮石墙 + 橄榄树 + 灌木 ---- */
    for(let z=-18;z<32;z+=1.15)b.box(R()<.5?0xd6cbb2:0xc3b79c,-11.4,.42,z,.85,.84,1.1,0,(R()-.5)*.12,0);
    /* 橄榄树。树冠挂到独立 pivot 上做轻微风摆 —— 场景不能完全静止,
       而且 world-places.test.mjs 断言每个场景的 s.plants[0] 必须存在并且会动
       (第一版这里全部塞进静态合批,med 一进测试就是 "reading 'pivot' of undefined")。 */
    for(let i=0;i<(M?5:9);i++){
      const x=-14-R()*9,z=-16+i*6+R()*4,h=2.6+R()*1.5;
      b.box(0x7a6a52,x,h*.5,z,.42+R()*.2,h,.42+R()*.2,(R()-.5)*.1,0,(R()-.5)*.1);
      const pv=new THREE.Group();pv.position.set(x,h+.5,z);s.root.add(pv);
      const lb=batch();
      for(let k=0;k<5;k++){                                 // 橄榄树:灰绿细碎叶团
        const a=R()*6.283,d=1+R()*1.2;
        lb.add("blob",R()<.5?0x8a9b78:0x6f8367,Math.cos(a)*d,R()*1.1,Math.sin(a)*d,
          1+R()*.8,.6+R()*.5,1+R()*.8,(R()-.5)*.8,a,(R()-.5)*.8);
      }
      lb.finish(pv,"medOliveCanopy");
      s.plants.push({pivot:pv,phase:R()*6.28,amp:.026});
    }
    /* 崖边三角梅:更轻的摆幅,贴着石墙 */
    for(let i=0;i<(M?3:6);i++){
      const x=-8+R()*22,z=CLIFF_Z+1.4;
      const pv=new THREE.Group();pv.position.set(x,.85,z);s.root.add(pv);
      const fb=batch();
      for(let k=0;k<4;k++)fb.add("blob",R()<.5?0xc63a7a:0xd9598f,(R()-.5)*.9,R()*.5,(R()-.5)*.6,
        .34+R()*.28,.22+R()*.18,.3+R()*.24);
      fb.finish(pv,"medBougainvillea");
      s.plants.push({pivot:pv,phase:R()*6.28,amp:.05});
    }
    for(let i=0;i<(M?8:16);i++){
      const x=-12-R()*12,z=-18+R()*50;
      b.add("blob",R()<.5?0x8d9a72:0x76855f,x,.32,z,.9+R()*.9,.5,.9+R()*.8);
    }


    /* ---- 伸出的崖角 + 阶梯白村落(计划 §D:"部分组团延伸到篮筐侧后方,进入主要画面")----
       上一轮把白墙按朝场立面重新定位(从压在场里的 x≈7.1 挪到 11.9)之后,
       最近一组房子落到画框右缘之外 —— 主投篮画面里一点白墙都读不到了。
       这里不是把村子搬回来,而是按 §D 让一段崖角从 +x 伸进海里、村落顺坡叠下去。
       ⚠ 只占画框右侧:投篮机位在 z=-16 处右边界 x≈9.6、z=-24 处 12.3,
         所以崖角从 x≈6 起步,海与海天线仍然占住中间和左边(§D 验收:海的可见宽度不退步)。 */
    for(let i=0;i<(M?3:4);i++){
      /* cx 起点必须够靠内:投篮机位在 z=-19 处的右边界只有 x≈10.6,
         从 6.2 起步的话只有第一栋房子擦到画框边。挪到 2.2 之后村落真的进画面,
         同时仍然只占右侧约四分之一,海和海天线保住左边(§D 验收)。 */
      const z0=-17.5-i*7.6,cx=2.2+i*3.2,top=-.1-i*.55;        // 越伸向海里越低
      b.box(0xa2957a,cx+9,top-2.6,z0-3.4,20+i*3,5.2,8.6);      // 崖体
      b.box(0xbfb69c,cx+9,top,z0-3.4,20+i*3,.34,8.6);          // 台顶
      b.box(0xcfc3a8,cx-.4,top+.42,z0-3.4,.5,.85,8.6);         // 台沿矮石墙
      for(let k=0;k<3;k++){
        const hx=cx+2.4+k*4.2,hz=z0-1.4-(k%2)*3.2,hh=2.9+R()*1.8-i*.3;
        b.box([0xf2ede2,0xe7e0d1,0xdcd4c3][(k+i)%3],hx,top+hh/2+.17,hz,3.6,hh,3.8);
        b.box(0xc0554a,hx,top+hh+.42,hz,3.9,.24,4.1);          // 陶土压顶
        b.box(0x2f6ba4,hx-1.86,top+hh*.5,hz,.09,1.15,.85);     // 蓝门窗
        if((k+i)%2===0)b.box(0x2f7fb8,hx-2.3,top+hh*.5+.78,hz,.95,.09,1.05,-.26);
        if((k+i)%3===0){                                        // 墙脚三角梅,成组不散撒
          b.box(0xb9714a,hx-1.9,top+.22,hz+1.5,.36,.44,.36);
          b.add("blob",0xc63a7a,hx-1.9,top+.7,hz+1.5,.42,.3,.4);
        }
      }
      if(i)for(let k=0;k<5;k++)b.box(0xcfc3a8,cx-1.2-k*.5,top+.55-k*.18,z0+1.8,.8,.34,2.4);
    }
    /* ---- 三个节点(§D)。全部压在 x≥11.2 —— 生产机位包络实测 |x|≤9.96。 ---- */
    // ① 蓝门小院:低院墙围出一小块,门是蓝的,门前三级石阶
    b.box(0xe6dfd0,11.7,.72,3.6,.34,1.44,5.4);
    b.box(0xcfc3a8,11.7,1.5,3.6,.5,.14,5.6);
    b.box(0x2f6ba4,11.74,.72,3.6,.09,1.3,1.5);
    b.box(0xe6dfd0,13.8,.72,1.05,4.5,1.44,.34);
    for(let k=0;k<3;k++)b.box(0xc9bda1,12.3+k*.46,.1+k*.06,3.6,.46,.2+k*.12,2.2);
    // ② 葡萄藤架露台:四根柱 + 横梁 + 藤叶,下面两组桌椅
    for(const dx of [11.9,15.3])for(const dz of [-3.6,1.1])b.box(0x7a6a52,dx,1.14,dz,.16,2.28,.16);
    for(const dz of [-3.6,1.1])b.box(0x7a6a52,13.6,2.3,dz,3.7,.14,.16);
    for(let k=0;k<6;k++)b.box(0x6b7a4a,13.6,2.42,-3.5+k*.94,3.9,.1,.5);
    for(let k=0;k<7;k++)b.add("blob",k%2?0x557045:0x6b8a4e,12.2+k*.5,2.58,-3.4+((k*3)%5)*.9,.55,.24,.5);
    for(const [tx,tz] of [[13,-2.4],[14.2,.1]]){
      b.box(0xd8cdb3,tx,.74,tz,.9,.09,.9);b.box(0x8a7a60,tx,.37,tz,.13,.74,.13);
      for(const [ox,oz] of [[-.75,0],[.75,.15]]){
        b.box(0x2f6ba4,tx+ox,.45,tz+oz,.4,.07,.4);b.box(0x2f6ba4,tx+ox,.72,tz+oz-.2,.4,.6,.07);
      }
    }
    // ③ 向海下行的石阶:从场地侧门一路降到岸边路径,给"能走下去"一个交代
    for(let k=0;k<10;k++)b.box(0xcfc3a8,11.4+k*.34,-.06-k*.44,-11.2-k*.95,2,.44,1.25);
    b.box(0xbfb69c,15,-4.3,-21.4,7,.3,4);                       // 岸边平台
    /* ---- 远景帆船 ---- */
    for(let i=0;i<(M?2:4);i++){
      const x=-58+R()*96,z=CLIFF_Z-44-R()*58;
      b.box(0xe9e4d6,x,-4.1,z,3.4,.7,1.3);
      b.box(0xf6f3ea,x,-2.6,z,.10,2.6,.10);
      b.box(0xf9f7f0,x+.5,-2.9,z,1.5,1.9,.06,0,0,-.16);
    }
  }
  function coast(s,b){
    // 1. 洛杉矶 Angels Gate 海岸悬崖球场：篮筐后方紧贴草坡悬崖，直面开阔太平洋
    b.box(0x526932,0,-.06,-13.2,120,.14,5.4); // 球场后方海岸草坡
    b.box(0x3f5425,0,-.32,-16.2,120,.45,2.2); // 草坡崖沿
    b.box(0x8e8670,0,-.95,-18.0,130,1.0,2.8); // 崖壁岩石
    b.box(0x54595e,0,-.12,21,120,.1,24); // 后场沥青外坪

    // 远处 Catalina 岛屿平滑山影（照片左前方海天线上）
    const islGeo=new THREE.BufferGeometry();
    const islPts=[[-72,0],[-58,1.8],[-44,4.2],[-32,4.9],[-20,3.8],[-8,2.6],[8,1.5],[24,.7],[38,0]];
    const iPos=[];
    for(let i=0;i<islPts.length-1;i++){
      const [x0,h0]=islPts[i],[x1,h1]=islPts[i+1];
      iPos.push(x0,-1.4,-118, x1,-1.4,-118, x0,h0-1.4,-118, x1,-1.4,-118, x1,h1-1.4,-118, x0,h0-1.4,-118);
    }
    islGeo.setAttribute("position",new THREE.Float32BufferAttribute(iPos,3));
    const islMesh=new THREE.Mesh(islGeo,new THREE.MeshBasicMaterial({color:0x6e6a7c,side:THREE.DoubleSide,fog:false}));
    islMesh.name="catalinaIsland";s.root.add(islMesh);

    // 2. 真实动态海浪着色器（深邃太平洋蓝 + 夕阳晚霞反射 + 金光带 + 岸边白浪泡沫）
    const oceanGeo=new THREE.PlaneGeometry(260,135,84,48);oceanGeo.rotateX(-Math.PI/2);
    const oceanMat=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},
        uProgress:{value:0},
        uSunPos:{value:new THREE.Vector3(-24,7.5,-92)}
      },
      vertexShader:`uniform float uTime;varying vec3 vWorld;varying float vCrest;
        void main(){
          vec3 p=position;
          float w1=sin(p.z*.28+uTime*1.4+p.x*.05)*.22;
          float w2=cos(p.x*.18-p.z*.19+uTime*1.05)*.14;
          float w3=sin(p.z*.65+uTime*2.1)*.07;
          p.y+=w1+w2+w3;
          vCrest=clamp((w1+w2+.2)/.55,0.,1.);
          vec4 wp=modelMatrix*vec4(p,1.);
          vWorld=wp.xyz;
          gl_Position=projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader:`uniform float uTime;uniform float uProgress;uniform vec3 uSunPos;
        varying vec3 vWorld;varying float vCrest;
        void main(){
          vec3 V=normalize(cameraPosition-vWorld);
          float gx=cos(vWorld.x*.18-vWorld.z*.19+uTime*1.05)*.18*.14+.05*cos(vWorld.z*.28+uTime*1.4+vWorld.x*.05)*.22;
          float gz=.28*cos(vWorld.z*.28+uTime*1.4+vWorld.x*.05)*.22-.19*cos(vWorld.x*.18-vWorld.z*.19+uTime*1.05)*.14+.65*cos(vWorld.z*.65+uTime*2.1)*.07;
          vec3 N=normalize(vec3(-gx,1.0,-gz));
          float fres=pow(1.0-max(dot(N,V),0.0),3.8);
          vec3 deepCol=mix(vec3(.05,.15,.28),vec3(.02,.07,.15),uProgress);
          vec3 skyRef=mix(vec3(.92,.44,.22),vec3(.14,.18,.32),uProgress);
          vec3 col=mix(deepCol,skyRef,fres*.46);
          vec3 L=normalize(uSunPos-vWorld);
          vec3 H=normalize(L+V);
          float glint=pow(max(dot(N,H),0.0),68.0)*(1.0-uProgress*.85);
          col+=vec3(1.0,.76,.40)*glint*1.45;
          // 岸边拍岸白浪泡沫 + 波峰白沫
          float shore=smoothstep(-25.0,-18.0,vWorld.z);
          float surfBand=smoothstep(.52,.96,sin(vWorld.z*.85+uTime*1.75+sin(vWorld.x*.14)));
          float foam=clamp(shore*surfBand*.85+pow(vCrest,3.8)*.28,0.0,1.0);
          col=mix(col,mix(vec3(.94,.89,.84),vec3(.48,.55,.66),uProgress),foam*.75);
          gl_FragColor=vec4(col,1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const ocean=new THREE.Mesh(oceanGeo,oceanMat);
    ocean.position.set(0,-1.25,-84);ocean.name="pacificOcean";s.root.add(ocean);
    s.ocean=ocean;s.oceanShader=oceanMat;s.wave=null;

    // 3. 晚霞火烧云（低空多层橙红/金粉辉光云带）
    const sunsetClouds=new THREE.Group();sunsetClouds.name="sunsetAfterglowClouds";
    const cloudSpecs=[
      [-28,15,-92,38,3.6,0xff8b42,.52],[12,18,-96,46,4.2,0xff6448,.46],
      [-6,11.5,-88,34,2.8,0xffba66,.56],[34,13.5,-90,30,3.0,0xf06858,.44],
      [-44,12,-85,28,2.6,0xffa255,.42],[2,23,-98,54,4.8,0xd95b66,.35]
    ];
    cloudSpecs.forEach(([cx,cy,cz,cw,ch,col,op],idx)=>{
      const cm=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,fog:false,
        uniforms:{uCol:{value:new THREE.Color(col)},uOp:{value:op}},
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform vec3 uCol;uniform float uOp;varying vec2 vUv;
          void main(){
            vec2 p=vUv*2.-1.;float d=dot(vec2(p.x*.85,p.y*1.2),vec2(p.x*.85,p.y*1.2));
            float a=smoothstep(1.,.1,d)*(.6+.4*sin(vUv.x*14.+vUv.y*6.));
            gl_FragColor=vec4(uCol,a*uOp);
          }`
      });
      const m=new THREE.Mesh(new THREE.PlaneGeometry(cw,ch),cm);
      m.position.set(cx,cy,cz);sunsetClouds.add(m);
    });
    s.root.add(sunsetClouds);s.sunsetClouds=sunsetClouds;

    // 4. 海面上冲浪的人（乘浪起伏左右滑行）
    s.surfers=[];
    const surferConfigs=[
      [-20,-28,0xf2ede0,0x22262e,1.0,0.0],
      [-5,-34,0xe66a4c,0x1f2833,0.85,1.8],
      [14,-26,0x4fb0bd,0x2b2420,1.15,3.4],
      [28,-38,0xf2c14e,0x202830,0.9,5.0]
    ];
    surferConfigs.forEach(([sx,sz,boardCol,suitCol,spd,ph])=>{
      const sg=new THREE.Group(),sb=batch();
      sb.box(boardCol,0,0,0,.52,.06,1.85); // 冲浪板
      sb.box(suitCol,0,.38,.05,.24,.52,.18,.15,0,0); // 屈膝半蹲躯干
      sb.add("sphere",0xdfb48c,0,.78,.12,.11,.12,.11); // 头
      sb.box(suitCol,-.26,.5,.05,.38,.09,.09,0,0,-.35); // 展开双臂平衡
      sb.box(suitCol,.26,.5,.05,.38,.09,.09,0,0,.35);
      sb.box(suitCol,-.11,.15,-.12,.11,.34,.12,-.35,0,0);
      sb.box(suitCol,.11,.15,.22,.11,.34,.12,.35,0,0);
      sb.finish(sg,"surferMesh");
      sg.position.set(sx,-1.05,sz);sg.rotation.y=.35;s.root.add(sg);
      s.surfers.push({g:sg,baseX:sx,baseZ:sz,speed:spd,phase:ph});
    });

    // 远侧少量海岸棕榈与零星矮木，绝不遮挡正面海景
    for(const [tx,tz,sc] of [[-19,-14,1.05],[18,-15,.95],[-24,6,1.1],[22,12,1.0]]){
      tree(s,b,tx,tz,"palm",sc);
    }
    for(const [lx,lz] of [[-13,-6],[13,-6],[-13,12],[13,12]])lamp(s,b,lx,lz);

    const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(3.2,20,14),new THREE.MeshBasicMaterial({color:0xffb85c,transparent:true,fog:false}));
    sunDisc.position.set(-24,7.5,-96);s.root.add(sunDisc);s.sunDisc=sunDisc;
    s.nightColors=[0xe87a48,0xb85872,0x39466f,0x101e35].map(c=>new THREE.Color(c));s.skyColor=new THREE.Color();s.fogTint=new THREE.Color(0x607485);s.oceanDay=new THREE.Color(0x163754);s.oceanNight=new THREE.Color(0x0a1628);
    s.sky=s.root.getObjectByName("aibaSkyDome");if(s.sky){s.skyBase=s.sky.geometry.attributes.color.array.slice();s.skyVertex=new THREE.Color();}
    for(let x of [-12,12]){const light=new THREE.PointLight(0xffd2a0,0,23,1.3);light.position.set(x,4.8,0);s.root.add(light);s.realLights.push(light);}
  }
  function makeBirdPool(s){
    // Pool before gameplay starts: no UUID allocation / Math.random in flight updates.
    s.birdPool=[];
    for(let i=0;i<3;i++){
      const g=new THREE.Group(),body=batch();body.add("sphere",s.name==="beachSunset"?0xdedbcb:0x565650,0,0,0,.09,.08,.27);body.finish(g,"birdBody");const wings=[];
      for(let side of [-1,1]){const w=new THREE.Group(),b=batch();b.box(s.name==="beachSunset"?0xd5d4c7:0x4b514e,side*.23,0,0,.48,.045,.18,0,side*.3);b.finish(w,"birdWing");g.add(w);wings.push(w);}
      g.visible=false;s.root.add(g);s.birdPool.push({g,wings,dir:new THREE.Vector3(),age:0,speed:0,phase:0});
    }
  }
  function birds(s,dt){
    if(!s.birdPool)return;
    s.nextBird-=dt;if(s.nextBird<=0&&s.birds.length===0){
      s.nextBird=22+s.r()*26;const a=s.r()*Math.PI*2,count=1+Math.floor(s.r()*3);
      for(let i=0;i<count;i++){
        const b=s.birdPool[i],g=b.g;b.dir.set(Math.cos(a),0,Math.sin(a));b.age=0;b.speed=3.5+s.r()*1.2;b.phase=s.r()*6.28;
        g.position.set(-b.dir.x*52+i,8+s.r()*11,-b.dir.z*52+COURT.midZ+i*1.2);g.rotation.y=Math.atan2(b.dir.x,b.dir.z);g.visible=true;s.birds.push(b);
      }
    }
    for(let i=s.birds.length-1;i>=0;i--){const b=s.birds[i];b.age+=dt;b.g.position.addScaledVector(b.dir,dt*b.speed);b.wings.forEach((w,j)=>w.rotation.z=(j?1:-1)*(.1+Math.sin(b.age*7+b.phase)*.35));if(b.age>31){b.g.visible=false;s.birds.splice(i,1);}}
  }
  function build(root,name){
    const s={root,name,r:rng(72191+Object.keys(palettes).indexOf(name)*173),time:0,mobile:matchMedia("(pointer:coarse)").matches,plants:[],clouds:[],vehicles:[],lights:[],realLights:[],birds:[],nextBird:24};root.userData.placeState=s;
    /* Keep the meadow horizon in the menu's wider orbit. */
    if(name==="flowerCourt")s.menuOrbit=[18,22,7.5,2.5];
    /* 湘南:校舍在 SCH_X=20、宽 13,占住 x 13.5~26.5,默认椭圆的 x=18 直接在楼里面;
       校舍拉远会掉进雾里(作者原注)。改成从校园树冠之上、外走廊之外绕过去:
       x 11.4 卡在校园树(冠顶约 7.3m)与外走廊楼板(x≥12.25)之间,机位抬到 10.4m
       从树冠上方掠过;椭圆拉长到 20,让长轴两端的俯角回到正常。 */
    if(name==="shonanCoast")s.menuOrbit=[11.4,20,10.4,2.6];
    const b=batch(),builder=({outdoorSunny:city,rainyCourt:rainTown,shonanCoast:shonan,medCliff:med,beachSunset:coast})[name];
    if(builder)builder(s,b);else AIBAWorldWonders.build(s,b,{batch,tree,facing,lunarMarkings});
    AIBAWorldLife.build(s,b,{batch,rng});
    if(name==="lunarCrater"){
      const hb=batch(),marks=batch();themeHoops(s,hb,marks);
      const hm=hb.finish(root,`placeHoop:${name}`);
      if(hm){
        if(hm.material&&hm.material.dispose)hm.material.dispose();
        hm.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.45});
        hm.castShadow=true;hm.receiveShadow=true;
      }
      const face=marks.finish(root,"lunarBackboardMarkings");
      face.material.dispose();
      face.material=new THREE.MeshStandardMaterial({
        vertexColors:true,roughness:.7,emissive:0xe6b77f,emissiveIntensity:.15
      });
    }else{
      themeHoops(s,b);
    }
    b.finish(root,`placeArchitecture:${name}`);
    if(name!=="lunarCrater"&&name!=="beachSunset"&&name!=="tokyoRooftop"&&name!=="flowerCourt"){clouds(s);}
    if(name!=="lunarCrater"&&name!=="tokyoRooftop"){makeBirdPool(s);}
    if(name==="outdoorSunny"){scene.fog.near=52;scene.fog.far=145;}
    if(name==="shonanCoast"){scene.fog.near=58;scene.fog.far=190;}
    if(name==="medCliff"){scene.fog.near=95;scene.fog.far=330;}
    if(name==="lunarCrater"){scene.fog.near=160;scene.fog.far=380;}
    if(name==="tokyoRooftop"){scene.fog.near=210;scene.fog.far=820;}
    if(name!=="lunarCrater"&&name!=="flowerCourt"){
      const tex=surface(name),m=courtFloor.material;courtFloor.userData.placeTexture=tex;m.map=tex;m.color.setHex(0xffffff);m.roughnessMap=null;
      /* Rain has a water film; forest soil stays rough, with only a faint damp sheen. */
      m.roughness=name==="rainyCourt"?.62:(name==="tokyoRooftop"?.46:(name==="shonanCoast"?.92:(name==="medCliff"?.88:.95)));
      m.clearcoat=name==="rainyCourt"?.12:(name==="tokyoRooftop"?.22:0);
      if(m.clearcoatRoughness!==undefined)m.clearcoatRoughness=(name==="rainyCourt"||name==="tokyoRooftop")?.24:.5;
      m.envMapIntensity=name==="tokyoRooftop"?.18:.04;m.needsUpdate=true;
    }
    const hidden=["courtZone","courtLine","courtMark","nearCourtCrowdRoot"];
    if(name==="lunarCrater"||name==="flowerCourt")hidden.push("courtFloor");
    scene.traverse(o=>{if(hidden.includes(o.name)){o.userData.placeHidden=o.visible;o.visible=false;}});
    document.documentElement.dataset.worldPlace=name;return s;
  }
  function update(dt,progress){
    const s=environmentRoot.userData.placeState;if(!s)return;s.time+=dt;
    AIBAWorldWonders.update(s);
    s.plants.forEach(p=>{const t=s.time,phase=p.phase;p.pivot.rotation.z=(Math.sin(t*.8+phase)+.32*Math.sin(t*1.73+phase*2))*p.amp;p.pivot.rotation.x=Math.sin(t*.61+phase)*p.amp*.55;});
    if(s.meadowWind)s.meadowWind.value=s.time;
    /* 湘南的浪:整片泡沫缓慢向岸推移,循环 —— 和 beachSunset 的 s.wave 同机制,
       但那边由日落进度驱动,这里只跟时间。 */
    if(s.name==="shonanCoast"&&s.wave)s.wave.position.z=(s.time*.5)%11;
    /* 电车:t<0 是站外等待(不可见),t>=0 开始通过;跑完换下一个预生成的间隔。 */
    if(s.train){
      const tr=s.train;tr.t+=dt;
      if(tr.t<0){if(tr.g.visible)tr.g.visible=false;}
      else{
        // 湘南改版后电车沿 x 横穿画框(axis:"x"),旧的沿 z 走法保留给以后的场地。
        const p=tr.from-tr.t*tr.speed;
        if(p<tr.to){tr.g.visible=false;tr.t=-tr.gaps[tr.gi++%tr.gaps.length];}
        else{tr.g.visible=true;if(tr.axis==="x")tr.g.position.x=p;else tr.g.position.z=p;}
      }
    }
    s.clouds.forEach(c=>{c.g.position.x+=dt*c.speed;if(c.g.position.x>65)c.g.position.x=-65;});
    s.vehicles.forEach(v=>{v.g.position.z+=v.dir*v.speed*dt;if(v.g.position.z>59)v.g.position.z=-55;if(v.g.position.z< -59)v.g.position.z=55;});
    birds(s,dt);
    if(s.name==="beachSunset"){
      const p=clamp01(progress),u=p*3,i=Math.min(2,Math.floor(u));s.skyColor.copy(s.nightColors[i]).lerp(s.nightColors[i+1],u-i);scene.background.copy(s.skyColor);scene.fog.color.copy(s.skyColor).lerp(s.fogTint,.2);
      if(s.sky){const attr=s.sky.geometry.attributes.color;for(let j=0;j<attr.count;j++){const a=j*3,base=s.skyBase;s.skyVertex.setRGB(base[a],base[a+1],base[a+2]).lerp(s.skyColor,clamp01(.18+p*.92));attr.setXYZ(j,s.skyVertex.r,s.skyVertex.g,s.skyVertex.b);}attr.needsUpdate=true;}
      s.sunDisc.position.y=7.5-p*10;s.sunDisc.material.opacity=1-clamp01((p-.48)/.25);
      if(s.oceanShader){s.oceanShader.uniforms.uTime.value=s.time;s.oceanShader.uniforms.uProgress.value=p;}
      if(s.surfers)s.surfers.forEach(sf=>{
        const ph=s.time*sf.speed+sf.phase;
        sf.g.position.x=sf.baseX+Math.sin(ph*.45)*4.2;
        sf.g.position.z=sf.baseZ+Math.cos(ph*.38)*1.8;
        sf.g.position.y=-1.06+Math.sin(sf.g.position.z*.26+s.time*1.35)*.22;
        sf.g.rotation.z=Math.sin(ph*.45)*.22;
        sf.g.rotation.x=Math.cos(ph*.9)*.12;
      });
      let on=0;s.lights.forEach(l=>{const t=clamp01((p-l.threshold)/.07);l.mesh.material.color.setScalar(.12+t*.88);if(t>.5)on++;});s.root.userData.litWindows=on;
      s.realLights.forEach(l=>l.intensity=clamp01((p-.5)/.3)*1.25);ambient.intensity=.36-p*.08;hemi.intensity=.52-p*.15;sun.intensity=1.25-p*.92;sun.color.setHex(p>.6?0x9aa9c4:0xffbe78);
      s.clouds.forEach(c=>c.g.children[0].material.color.copy(s.skyColor).lerp(s.fogTint,.45-p*.25));
      document.documentElement.dataset.environmentPhase=p<.25?"golden":p<.5?"sunset":p<.75?"dusk":"night";
    }else s.lights.forEach(l=>l.mesh.material.color.setScalar(s.name==="rainyCourt"?.9:.18));
  }
  window.AIBAWorldPlaces={enabled,build,update,restore,palettes,rng};
})();
