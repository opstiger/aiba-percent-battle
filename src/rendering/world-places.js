/* Four places, not four weather skins. All disposable art belongs to environmentRoot.
   Gameplay hoops stay in scene; all randomness here has an independent stream. */
(()=>{
  const enabled=new URLSearchParams(location.search).get("places")!=="classic";
  const palettes={
    outdoorSunny:{ground:"#626369",field:"#343e47",key:"#b95543",line:"#e2d5b4",shirts:[0xe3d4b9,0x344760,0xb95142,0x323239,0x769793,0xe0ab47,0xe5e1d4,0x657293]},
    rainyCourt:{ground:"#545d60",field:"#35565b",key:"#263f48",line:"#bcb99e",shirts:[0xc9ac65,0x384c52,0x9a6857,0x5e6b64,0xb6b9a4,0x313d50,0x826882,0x687b80]},
    // Jungle soil and worn hand-marked arc are painted by world-life, not a PU slab.
    flowerCourt:{ground:"#2f3a33",field:"#33513f",key:"#27402f",line:"#eef1e6",shirts:[0xe5c79a,0x3b6472,0xa04f36,0x7a7c47,0xc59356,0xeee2c1,0x514b70,0xc26f58]},
    /* 旧但干净的学校水泥外场:灰蓝 + 海盐绿,低饱和(文档 §4 球场设计)。
       刻意不用荧光街头配色。 */
    /* 浅灰蓝 / 海盐蓝 + 米白线(文档 §球场设计),不做荧光街头配色 */
    medCliff:{ground:"#cdc3a8",field:"#7d9aa8",key:"#6b8a99",line:"#f4efe2",shirts:[0xf2ece0,0x2c6ba4,0xd9cdb4,0xb05f3d,0xe8e0cf,0x3f7f9e,0xc63a7a,0xcfc3a8]},
    shonanCoast:{ground:"#9a9e97",field:"#6d8686",key:"#5b7676",line:"#eef0e8",shirts:[0xe8e4d8,0x2f4f6b,0x8fa8b4,0xd9d2bd,0x44606d,0xf0ece0,0x7d9aa2,0xc3ccc4]},
    beachSunset:{ground:"#9a998c",field:"#92978e",key:"#747f7a",line:"#c9c4a9",shirts:[0xdcc6a4,0x7caaaa,0xc07765,0xead7a6,0x4c7583,0xb39a85,0xd6c7c3,0x577368]},
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
    AIBAWorldLife.surface(g,name,p,r);
    const tex=new THREE.CanvasTexture(cv);tex.name=`placeSurface:${name}`;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;return tex;
  }
  function restore(){
    if(courtFloor?.userData.placeTexture){courtFloor.userData.placeTexture.dispose();delete courtFloor.userData.placeTexture;}
    scene.traverse(o=>{if(o.userData.placeHidden!==undefined){o.visible=o.userData.placeHidden;delete o.userData.placeHidden;}});
    setPlaceHoops(false);
  }
  function themeHoops(s,b){
    const wood=s.name==="flowerCourt",rain=s.name==="rainyCourt",color=wood?0x5c5139:s.name==="arcticSnow"?0x25343e:s.name==="spanishQuarter"?0x635344:rain?0x293a3d:0x526264;
    [[-8.62,1],[COURT.farBaseline-.96,-1]].forEach(([z,dir])=>{
      const base=z-dir*1.55;
      b.box(color,0,1.75,base,.24,3.5,.24);b.box(color,0,3.46,z-dir*.76,.22,.22,1.55);
      b.box(color,0,2.9,base+dir*.45,.14,1.45,.14,-dir*.6);b.box(wood?0x66513b:0x757b76,0,.1,base,.75,.2,.75);
      b.box(wood?0xad8054:rain?0xc5c1a9:s.name==="spanishQuarter"?0x91988c:0xd6d1b9,0,3.5,z,1.9,1.1,.12);
      for(let j=-2;j<=2;j++)if(wood)b.box(0x694c34,j*.34,3.5,z+dir*.062,.018,1.07,.006);
      const ink=wood?0xe4cca0:rain?0x704f40:0x384f56;
      [-1,1].forEach(a=>{b.box(ink,0,3.5+a*.51,z+dir*.066,1.86,.035,.012);b.box(ink,a*.915,3.5,z+dir*.066,.035,1.05,.012);
        b.box(ink,a*.3,3.25,z+dir*.069,.035,.36,.014);b.box(ink,0,3.25+a*.18,z+dir*.069,.63,.035,.014);});
      for(let x of [-.84,.84])for(let y of [3.04,3.96])b.box(0x494640,x,y,z+dir*.073,.035,.035,.025);
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
    /* 峡谷是谷底视角,天空只剩崖顶一线 —— 云给少、给高,
       否则那几团卡通云会直接坐在崖顶,把"被森林包裹"的封闭感破掉。 */
    const canyon=s.name==="flowerCourt",arctic=s.name==="arcticSnow";
    for(let i=0;i<(arctic?2:canyon?(s.mobile?2:3):(s.mobile?6:10));i++){
      const g=new THREE.Group(),b=batch(),rain=s.name==="rainyCourt";g.position.set(-43+s.r()*86,(s.name==="outdoorSunny"?64:rain?16:canyon?74:22)+s.r()*9,-45+s.r()*75);
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
  /* 某点到该场地菜单环绕椭圆的水平距离(米)。
     ⚠ 别指望"随机摆出来的东西刚好不在轨道上":只要上游改了一次 R() 的调用次数,
     整条随机序列就会平移,原本让开的树会重新长回轨道里 —— 瀑布换成水材质那一次
     就是这样把雨林的菜单机位重新埋进树冠的。凡是可能长到机位高度的东西都要显式判。 */
  function menuOrbitGap(s,x,z){
    const o=s.menuOrbit||[18,20],a=Math.atan2((z-COURT.midZ)/o[1],x/o[0]);
    return Math.hypot(x-Math.cos(a)*o[0],z-COURT.midZ-Math.sin(a)*o[1]);
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
  /* 立体花 —— 原来的写法是"细杆 + 压扁的球 + 方块叶",读起来就是几个方块,
     不像花。这里按 type 给不同形态,关键是**有弧度和层次**,不是一片平板:
       bud       花骨朵:锥形苞 + 萼片
       sunflower 向日葵:大花盘 + 放射上翘花瓣
       daisy     雏菊:小花盘 + 更细的瓣
       rafflesia 霸王花:倒扣喇叭 + 花心
       grass     草叶:几片斜伸的细叶                                        */
  const PETAL=[0xffd54a,0xff8a65,0xfff0d0,0xe86a9a,0xb388ff,0xff6f61,0xffe082,0xf48fb1];
  function flower3d(a,R,dx,dz,h,type){
    if(type==="grass"){
      for(let k=0;k<3;k++){
        const ang=R()*6.283,len=.4+R()*.4;
        a.box(0x5d8a4a,dx+Math.cos(ang)*.07,h*.5,dz+Math.sin(ang)*.07,.05,len,.022,0,ang,(R()-.5)*.6);
      }
      return;
    }
    a.box(0x4a6b42,dx,h*.5,dz,.028,h,.028);                     // 茎
    if(type==="bud"){                                            // 花骨朵
      a.add("cone",PETAL[(R()*PETAL.length)|0],dx,h+.14,dz,.08,.28,.08);
      a.box(0x4a6b42,dx,h+.04,dz,.14,.05,.14);return;
    }
    if(type==="rafflesia"){                                      // 霸王花
      a.add("cone",0xc2453f,dx,h+.18,dz,.26,.22,.26,Math.PI,0,0);
      a.add("sphere",0x6d1f2a,dx,h+.24,dz,.11,.07,.11);return;
    }
    const big=type==="sunflower",n=big?9:7,pr=big?.2:.135;
    a.add("sphere",big?0x5a4326:0xf2c14e,dx,h,dz,pr,.05,pr);    // 花盘
    const pc=PETAL[(R()*PETAL.length)|0];
    for(let k=0;k<n;k++){                                        // 放射花瓣,略上翘
      const ang=k*6.283/n+R()*.25;
      a.box(pc,dx+Math.cos(ang)*pr*.92,h+.02,dz+Math.sin(ang)*pr*.92,big?.18:.14,.035,.08,-.4,ang,0);
    }
  }
  /* ---------------- 热带雨林峡谷球场 ----------------
     构图目标(按需求 §12):玩家 → 球场 → 篮筐 → 峡谷 → 瀑布。
     篮筐在 (0,3.05,-8),玩家从 z≈-6~0 朝 -z 出手,所以:
       · ±x 与 +z 三面用崖壁+密林**围死**,不留天际线;
       · -z 方向**开一条通道**,崖壁在 z<-34 向外张开成 V,
         远景瀑布落在通道尽头,成为唯一的亮部与视觉中心。
     植被按到球场的距离分四层(§2/§3),越远越暗越灰,配合雾拉开空气纵深(§9)。
     全部走 b.box/b.add 合批 —— 加块数不加 draw call,只加三角形。 */
  const CANYON={
    /* 叶色谱:深绿/黄绿/墨绿/少量枯叶棕(§10)。刻意不给"塑料绿"。 */
    leaf:[0x2f5138,0x3c6b41,0x4a7d45,0x5b8c46,0x6d9a4a,0x27432f,0x1f3a2b,0x7d8f43],
    dead:[0x7a6b3e,0x6b5733,0x8a7746],
    bark:[0x4a3d31,0x554639,0x3d332a,0x5f5044],
    rock:[0x4a534d,0x3f4842,0x565f57,0x37403b],
    moss:[0x365c3a,0x406b40,0x2c4d31]
  };
  function village(s,b){
    const R=s.r,M=s.mobile;
    const pick=a=>a[(R()*a.length)|0];
    /* 谷底:向 -z 铺很远,通道尽头才是瀑布潭 */
    b.box(0x3b4238,0,-.12,-14,150,.12,190);

    /* ---- 巨型叶片(§2 前景 / §12 framing)----
       一片"叶"= 一把压扁的长方体呈扇形排开,再整体倾斜。
       比球形叶簇更像龟背竹/芭蕉,也不会读成蘑菇。 */
    const bigLeaf=(bb,x,y,z,scale,yaw,tilt,tone)=>{
      const n=5+((R()*3)|0);
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-.5)*1.15,len=(.85+R()*.65)*scale;
        bb.box(tone!==undefined?tone:pick(CANYON.leaf),
          x+Math.sin(yaw+a)*len*.5,y+Math.cos(a*1.6)*scale*.16,z+Math.cos(yaw+a)*len*.5,
          len,.055*scale,(.30+R()*.22)*scale,
          tilt+(R()-.5)*.22,yaw+a,(R()-.5)*.3);
      }
      /* 叶柄 */
      bb.box(0x4d6b3e,x,y-scale*.28,z,.07*scale,scale*.62,.07*scale,tilt*.4,yaw,0);
    };
    /* 蕨:一丛细长羽片 */
    const fern=(bb,x,y,z,sc)=>{
      for(let i=0;i<7;i++){const a=i*.92+R();
        bb.box(pick(CANYON.leaf),x+Math.sin(a)*.34*sc,y+.22*sc,z+Math.cos(a)*.34*sc,
          .13*sc,.06*sc,(.8+R()*.5)*sc,-.5-R()*.4,a,0);}
    };
    /* 雨林乔木。⚠ 叶团**不要用 box**:用户原话"树也是方块叶子很奇怪" ——
       立方体在任何角度都露出三条硬边和一个尖角,一眼就是积木。
       改用压扁的**球体**当叶团(有机块面、边缘是圆的),再加几片薄长条当外缘叶尖,
       两者都走同一个合批,draw call 一点没多。
       palm=true 时换成棕榈:细高干 + 顶部一圈放射状长叶(§3 要求的高大棕榈)。 */
    const canopy=(bb,x,z,h,rad,dim,palm)=>{
      const bark=pick(CANYON.bark);
      const tint=t=>dim?mix(t,0x63756e,.5):t;
      if(palm){
        const lean=(R()-.5)*.09;
        for(let seg=0;seg<6;seg++){                                  // 分段主干,带一点弯
          const sy=h*(seg+.5)/6;
          bb.box(tint(bark),x+lean*sy,sy,z,.30-seg*.022,h/6*1.06,.30-seg*.022,0,0,lean);
        }
        const fronds=7+((R()*3)|0);
        for(let f=0;f<fronds;f++){
          const a=f*6.283/fronds+R()*.3,droop=-.30-R()*.45;
          for(let k=0;k<3;k++){
            const d=(k*.8+.7)*rad*.62;
            bb.box(tint(pick(CANYON.leaf)),
              x+lean*h+Math.cos(a)*d,h-k*k*.16*rad,z+Math.sin(a)*d,
              rad*.62,.07,rad*(.34-k*.06),droop+k*.14,a,(R()-.5)*.2);
          }
        }
        bb.add("blob",tint(0x5a4a38),x+lean*h,h+.06,z,.32,.28,.32);
        return;
      }
      bb.box(tint(bark),x,h*.5,z,.42+R()*.3,h,.42+R()*.3,(R()-.5)*.03,0,(R()-.5)*.03);
      for(let i=0;i<4;i++){const a=R()*6.283;                       // 板根
        bb.box(tint(bark),x+Math.cos(a)*.5,.35,z+Math.sin(a)*.5,.26,.75,.9,.35,a,0);}
      const layers=3+((R()*3)|0);
      for(let L=0;L<layers;L++){
        const ly=h*(.55+L*.16)+R()*.5,lr=rad*(1-L*.13);
        for(let k=0;k<5+((R()*4)|0);k++){
          const a=R()*6.283,d=lr*(.35+R()*.75);
          const tone=tint(R()<.07?pick(CANYON.dead):pick(CANYON.leaf));
          const w=(1.1+R()*1.5)*rad*.42;
          bb.add("blob",tone,
            x+Math.cos(a)*d,ly+(R()-.5)*1.1,z+Math.sin(a)*d,
            w,(.34+R()*.5),w*(.8+R()*.4),
            (R()-.5)*.9,a,(R()-.5)*.9);
          /* 外缘薄叶尖:打断球体的圆轮廓,免得整棵读成一堆气球 */
          if(R()<.5)bb.box(tone,
            x+Math.cos(a)*d*1.28,ly+(R()-.5)*.9,z+Math.sin(a)*d*1.28,
            w*1.15,.055,w*.34,(R()-.5)*.8,a+(R()-.5)*.5,(R()-.5)*.8);
        }
      }
    };
    /* 两色混合,用于远景整体压灰(§9 空气透视) */
    function mix(a,c,t){
      const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,cr=(c>>16)&255,cg=(c>>8)&255,cb=c&255;
      return (((ar+(cr-ar)*t)|0)<<16)|(((ag+(cg-ag)*t)|0)<<8)|((ab+(cb-ab)*t)|0);
    }

    /* ---- 峡谷崖壁(§4)----
       side: -1/+1 = 左右;back = 身后。-z 不建,留出通道。
       岩壁 50~70% 被藤蔓/苔藓/蕨覆盖,不裸露。 */
    const cliffCol=(bb,x,z,baseW,topY,depth)=>{
      const steps=6;
      for(let i=0;i<steps;i++){
        const y0=i*topY/steps,hh=topY/steps*1.25,w=baseW*(1-i*.09);
        const stone=pick(CANYON.rock),xx=x+(R()-.5)*1.8,zz=z+(R()-.5)*2.4,rx=(R()-.5)*.05,ry=(R()-.5)*.2,rz=(R()-.5)*.06;
        // Consume the old random stream, but build a single eroded column instead of six slabs.
        if(i===0)bb.add("rock",stone,xx,topY*.51,zz,baseW,topY*1.08,depth,rx,ry,rz);
        /* 覆盖层:苔藓块 + 垂落藤蔓 + 岩缝蕨 */
        if(R()<.82){bb.add("rock",pick(CANYON.moss),x+(R()-.5)*w*.6,y0+hh*.62,z+(R()-.5)*2.2,w*(.4+R()*.5),hh*(.35+R()*.4),depth*.14);}
        if(R()<.7){const vl=2.5+R()*5;bb.box(pick(CANYON.leaf),x+(R()-.5)*w*.7,y0+hh-vl*.5,z+(R()-.5)*2,.16+R()*.2,vl,.16);}
        if(R()<.55)fern(bb,x+(R()-.5)*w*.6,y0+hh*.9,z+(R()-.5)*2,.9+R()*.7);
      }
    };
    for(const side of [-1,1]){
      /* 近段:紧贴球场两侧,把左右视野封死 */
      for(let z=-30;z<=34;z+=7.5)cliffCol(b,side*(26+R()*4),z,13,30+R()*16,11);
      /* 通道段:向 -z 逐渐外扩成 V,把视线导向瀑布 */
      for(let i=0;i<(M?5:6);i++){
        const z=-38-i*11,x=side*(30+i*5.5+R()*3);
        cliffCol(b,x,z,15,34+i*4+R()*10,13);
      }
    }
    /* 身后崖壁:把 +z 也封住,减少天空(§4) */
    for(let x=-34;x<=34;x+=8)cliffCol(b,x+(R()-.5)*3,38+R()*4,14,30+R()*14,12);

    /* ---- 远景瀑布(§5)----
       通道尽头。连续:顶部主瀑 → 谷底水潭。
       位置沿"相机→篮筐"的视轴延长线偏一点,使它在画面里紧邻篮板上方而不重叠。 */
    /* 距离取 §5 允许区间(50~150m)的近端:相机在 z≈+1.5,z=-64 约 66m。
       第一版放在 -86(≈89m),在 near34/far150 的雾里被吃掉 47%,
       水幕和它背后的暗崖差不到一档,探针说"在屏幕上"但肉眼一片都看不到。 */
    const WF={x:-13,z:-64,top:38,pool:2.2};
    /* 瀑布所在的崖体。这一段是整张图唯一的亮部,必须**先把背景压暗**再谈水色:
       实测第一版水体已经在正确的屏幕位置(篮板上方偏右),但 86m 处被雾吃掉 68%,
       而它背后的崖壁又是浅灰岩色 —— 白水叠在灰岩上,等于没画。
       所以这里侧翼崖体单独用深色,并给一整面加宽加高的暗背板当剪影底。 */
    const darkRock=[0x232e2e,0x1c2726,0x2a3634];
    const cliffDark=(bb,x,z,baseW,topY,depth)=>{
      for(let i=0;i<6;i++){
        const y0=i*topY/6,hh=topY/6*1.25,w=baseW*(1-i*.09);
        const tone=darkRock[(R()*3)|0],xx=x+(R()-.5)*1.8,zz=z+(R()-.5)*2.4,rot=(R()-.5)*.2;
        if(i===0)bb.add("rock",tone,xx,topY*.51,zz-3,baseW,topY*1.08,depth,0,rot,0);
        if(R()<.7)bb.add("rock",0x25412c,x+(R()-.5)*w*.6,y0+hh*.62,z+(R()-.5)*2.2,w*(.4+R()*.5),hh*(.4+R()*.4),depth*.14);
      }
    };
    for(let i=-3;i<=3;i++)cliffDark(b,WF.x+i*15+(R()-.5)*4,WF.z-7+(R()-.5)*6,18,50+R()*20,16);
    b.add("rock",0x182223,WF.x,WF.top*.55,WF.z-2,34,WF.top*1.15,8);
    // Continuous fall: no projecting mid-cliff shelf cutting through the water.
    b.box(0x2b4547,WF.x,WF.pool*.5,WF.z+16,26,WF.pool,14);            // 水潭
    /* ⚠ 必须站在暗背板**前面**。背板是 b.box(...,WF.z-1,34,...,8),深度 8,
       z 跨 WF.z-5 ~ WF.z+3。第一版把水组放在 WF.z+1.2 —— 整片水幕埋在不透明
       背板内部,一个像素都出不来;而水雾因为自带 +3/+13 的 z 偏移刚好在板前,
       所以画面上"只有雾没有水",看起来像水根本没建出来。 */
    const wf=new THREE.Group();wf.position.set(WF.x,0,WF.z+5.5);
    /* ---- 水体:一整片流动的水,不是一排方块 ----
       旧版是"3 条静止竖带 + 5 股 ×3 段循环平移的长方体"。在 86m 外看过去,
       柱与柱之间的缝比柱本身还显眼,读起来是几道白色雨丝,不是瀑布;
       而且 18 个 clone 材质 = 18 个 draw call。
       现在换成**真的水材质**:一张 ShaderMaterial 水幕,
         · 三层不同频率、不同下落速度的竖向拉伸噪声 → 水股与速度差(§5 明确要求);
         · 中心厚两侧薄、顶端从岩唇翻出、底部炸成白沫;
         · 顶点着色器让水幕越往下越宽并带极慢横摆,轮廓不是一块死板;
         · fog:false —— 瀑布是 §9 明度阶梯的白端,吃雾就没有端点了。
       连续水幕一张,落水白沫一张,合计 2 个 draw call。 */
    const WATER_VS=`varying vec2 vUv;uniform float time;uniform float sway;
      void main(){vUv=uv;vec3 p=position;float d=1.0-uv.y;
        p.x*=1.0+d*0.17;
        p.x+=sin(uv.y*3.1+time*0.5)*sway*d;
        p.z+=sin(uv.y*5.0+time*0.7)*0.3*d;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
    const WATER_FS=`varying vec2 vUv;uniform float time;uniform float speed;uniform vec3 tint;uniform float alpha;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
                   mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
      void main(){
        float y=vUv.y;
        // Flight-time coordinate: t=(sqrt(v0*v0+2*g*d)-v0)/g.
        // A constant phase moves down with v=sqrt(v0*v0+2*g*d), not a slow UV scroll.
        float distance=(1.0-y)*35.8;
        float flight=(sqrt(9.0+19.62*distance)-3.0)/9.81;
        float flow=flight-time*speed;
        float s1=vnoise(vec2(vUv.x*13.0,flow*2.8));
        float s2=vnoise(vec2(vUv.x*31.0+13.0,flow*6.0));
        float s3=vnoise(vec2(vUv.x*61.0+41.0,flow*10.0));
        float streak=smoothstep(0.10,0.88,0.40*s1+0.34*s2+0.26*s3);
        float edge=smoothstep(0.0,0.13,vUv.x)*(1.0-smoothstep(0.87,1.0,vUv.x));
        float lip=1.0-smoothstep(0.985,1.0,y);
        float foam=1.0-smoothstep(0.0,0.10,y);
        vec3 col=mix(tint*0.70,vec3(1.0),streak);
        col=mix(col,vec3(1.0),foam*0.8);
        float a=(edge*lip*(0.40+0.52*streak)+foam*edge*0.45)*alpha;
        gl_FragColor=vec4(col,clamp(a,0.0,1.0));
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`;
    const waterMats=[];
    const curtain=(cx,base,height,width,speed,alpha,sway,splash)=>{
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
        uniforms:{time:{value:0},speed:{value:speed},sway:{value:sway},alpha:{value:alpha},
                  tint:{value:new THREE.Color(0xcfeef2).convertSRGBToLinear()}},
        vertexShader:WATER_VS,fragmentShader:WATER_FS});
      const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height,10,20),mat);
      m.position.set(cx,base+height*.5,-.4);m.name="canyonWaterfall";m.frustumCulled=false;wf.add(m);
      waterMats.push(mat);
      // Impact spray belongs only at the bottom of the continuous drop.
      if(!splash)return;
      const sp=new THREE.Mesh(new THREE.PlaneGeometry(width*1.1,height*.14,8,4),mat.clone());
      sp.material.uniforms.alpha.value=alpha*.42;sp.material.uniforms.speed.value=speed*1.7;
      sp.position.set(cx,base+height*.035,.9);sp.name="canyonWaterSplash";sp.frustumCulled=false;wf.add(sp);
      waterMats.push(sp.material);
    };
    curtain(0,WF.pool,WF.top-WF.pool,13,1.0,.95,.22,true); // Single continuous drop to the pool
    s.root.add(wf);s.waterfall=waterMats;
    // Low, diffuse spray at the pool; never an opaque band halfway up the fall.
    const mistG=new THREE.Group();mistG.position.set(WF.x,0,WF.z+7);
    const mb=batch();
    for(let i=0;i<(M?9:16);i++){
      const y=WF.pool+.2+R()*1.8,r=1.2+R()*1.5;
      mb.add("sphere",0xf4fcfb,(R()-.5)*13,y,(R()-.5)*7+12,r,r*(.72+R()*.34),r*(.85+R()*.3));
    }
    const mist=mb.finish(mistG,"canyonMist");
    if(mist){mist.material.transparent=true;mist.material.opacity=.075;mist.material.depthWrite=false;mist.material.fog=false;}
    s.root.add(mistG);s.mist={g:mistG,mesh:mist};

    /* ---- 中景森林(§3):3~5 层深度,越远越灰 ---- */
    const ringCount=M?[13,16,14,11]:[16,20,18,14];
    const rings=[{r0:15,r1:23,h:[7,11],rad:[2.2,3.2],dim:false},
                 {r0:23,r1:33,h:[10,16],rad:[2.8,4.2],dim:false},
                 {r0:33,r1:46,h:[14,22],rad:[3.4,5],dim:true},
                 {r0:46,r1:64,h:[18,28],rad:[4,6],dim:true}];
    rings.forEach((ring,ri)=>{
      for(let i=0;i<ringCount[ri];i++){
        const a=R()*6.283,rad=ring.r0+R()*(ring.r1-ring.r0);
        const x=Math.cos(a)*rad,z=Math.sin(a)*rad*.85-6;
        /* 视觉通道(§1):必须沿**真实视线**留空,不能拍脑袋取个 x 区间。
           投篮机位在 (3.8,2.3,1.5),瀑布在 (-15,37,-85),这条线在
           z=-20 处 x≈+0.1、z=-60 处 x≈-9.6 —— 第一版按 x≈-5.25 固定中心
           开走廊,结果中景环带的树正好戳在视线上,把 15×30m 的水幕整片挡死
           (探针显示水幕在屏幕 (747,187) 且 onScreen,但画面上一片都看不到)。
           走廊半宽随距离张开,远处才留得出瀑布两侧的轮廓。 */
        if(z<-12){
          const t=(1.5-z)/65.5,cx=3.8-16.8*t,halfW=9+t*7;
          if(Math.abs(x-cx)<halfW)continue;
        }
        if(Math.abs(x)<11&&z>-14&&z<24)continue;                    // 不侵占球场
        let h=ring.h[0]+R()*(ring.h[1]-ring.h[0]),tx=x,tz=z;
        const gap=menuOrbitGap(s,tx,tz);
        if(gap<ring.rad[1]*2.4){
          /* 落在菜单环绕带上的树改成"高干高冠":树冠底(h*0.55)抬到机位以上,
             只剩树干经过机位高度;树干再压在轨道上的,沿径向推开。 */
          h=Math.max(h,17+R()*4);
          if(gap<1.6){const push=1+(Math.hypot(tx,tz)<14?-.22:.22);tx*=push;tz=(tz+6)*push-6;}
        }
        canopy(b,tx,tz,h,ring.rad[0]+R()*(ring.rad[1]-ring.rad[0]),ring.dim,R()<.26);
      }
    });

    /* 走廊**两侧**的远景树影:填住谷底不让崖面裸露(§13)。
       ⚠ 必须放在视锥**外**。第一版是 cx+(R()-.5)*22 —— 以视线 x 为中心只抖 ±11m,
       等于直接种在视线上;射线在 22.8m 处高度已到 12.9m,一棵 13m 的树就把
       整片水幕挡死(射线探针:placeArchitecture 命中距离 22.8m)。
       现在按 |x-cx| ∈ [15,29] 分居两侧,既补满谷底又不进通道。 */
    for(let i=0;i<(M?12:16);i++){
      const t=.25+R()*.75,z=1.5-t*65.5,cx=3.8-16.8*t;
      const side=i%2?1:-1,off=15+R()*14;
      canopy(b,cx+side*off,z,7+R()*9,2.8+R()*2,true);
    }
    /* ---- 近景灌木/蕨/苔藓(§2):填满球场到崖壁的过渡带 ----
       ⚠ 侵入判定必须按每株的**实际外扩半径**,不能只判圆心。
       原来写的是 `if(Math.abs(x)<9.4) continue`,但巨叶的叶片长度可到 1.5×scale
       (scale 最大 2.6 → 外扩 3.9m),灌木叶团也能外扩 1.9m —— 于是种在 |x|=9.5 的
       一株巨叶实际长到了 x≈-7.5,正好把 45° 架的跟随机位 (-7.64, 2.18, -0.36)
       埋在叶子里,连投篮抛物线前半段一起挡掉。
       扩展后的 world-wonders-camera.test.mjs 就是拿这条抓出来的。
       生产机位实测包络是 |x|≤9.96 / z∈[-5.9,2.8],所以出手点一带留到 10.9m;
       底线以外仍按球场边线放行,免得整圈植被被推远、过渡带变秃。 */
    const near=M?104:140;
    const intrudes=(x,z,spread)=>{
      if(z<-14.5||z>24)return false;
      return Math.abs(x)-spread<((z>-7.5&&z<5.5)?10.9:9.6);
    };
    for(let i=0;i<near;i++){
      const a=R()*6.283,rad=10+R()*16,x=Math.cos(a)*rad,z=Math.sin(a)*rad*.9-4;
      const k=R();
      if(k<.42){const sc=1.1+R()*1.1;if(intrudes(x,z,1.05*sc))continue;fern(b,x,.2+R()*.4,z,sc);}
      else if(k<.72){const h=.6+R()*1.5;                            // 灌木:压扁的叶团,不是圆球
        if(intrudes(x,z,1.9))continue;
        for(let j=0;j<4;j++)b.box(pick(CANYON.leaf),x+(R()-.5)*1.3,h*(.4+R()*.7),z+(R()-.5)*1.3,
          1+R()*1.5,.3+R()*.35,1+R()*1.5,(R()-.5)*.5,R()*3,(R()-.5)*.5);}
      else if(k<.88){const sc=1.5+R()*1.1;if(intrudes(x,z,1.55*sc))continue;
        bigLeaf(b,x,.7+R()*1.1,z,sc,R()*6.283,-.5-R()*.5);}
      else{const rr=.9+R()*1.2;if(intrudes(x,z,rr))continue;
        b.add("blob",pick(CANYON.moss),x,.12,z,rr,.2,rr);}          // 苔藓斑
    }
    /* 地表杂草与落叶,压低天空以外的裸地 */
    for(let i=0;i<(M?88:120);i++){
      const x=(R()-.5)*70,z=-30+R()*70;
      if(Math.abs(x)<9.2&&z>-13.2&&z<22.8)continue;
      b.box(R()<.12?pick(CANYON.dead):pick(CANYON.leaf),x,.1+R()*.25,z,.2+R()*.5,.25+R()*.5,.2+R()*.5,(R()-.5)*.6,R()*3,(R()-.5)*.6);
    }

    /* ---- 前景巨叶(§2/§12/§13)----
       球场左右两侧紧邻处的大叶,进入镜头边缘形成天然 framing 与遮挡纵深。
       只在 |x|>9.2 且高度压在 4.2m 以下 —— 不侵入投篮与人物活动区。
       其中一部分挂到风摆 pivot 上(§11:只让少量大叶片轻摆)。 */
    const windLeaves=M?4:7;
    for(let i=0;i<(M?26:34);i++){
      const side=i%2?1:-1,z=-12+R()*26;
      const sc=1.9+R()*1.9,y=.9+R()*2.1;
      /* ⚠ 叶扇必须**朝外**开。bigLeaf 的叶片从中心沿 yaw 铺开、单片长度可到 1.5×scale,
         yaw 随机时叶尖会伸进场内 4~5m:底角架的跟随机位 (-9.96, 2.18, -5.44)
         直接被埋进叶子里,连球员头部都射不到。
         锁死 yaw≈±90° 之后内侧只剩叶柄和叶背,外扩全部落在场外;
         再按机位包络(|x|≤9.96)给出手点一带留到 11.3m。 */
      const yaw=side*Math.PI/2+(R()-.5)*.5;
      const x=side*(((z>-7.5&&z<5.5)?11.3:10)+R()*4.6);
      if(i<windLeaves){
        const g=new THREE.Group();g.position.set(x,y,z);
        const lb=batch();bigLeaf(lb,0,0,0,sc,yaw,-.55-R()*.5);
        lb.finish(g,"canyonWindLeaf");s.root.add(g);
        s.plants.push({pivot:g,phase:R()*6.28,amp:.055});
      }else{
        bigLeaf(b,x,y,z,sc,yaw,-.5-R()*.55);
      }
    }
    /* 藤蔓:从高处垂下,进一步遮挡镜头上缘 */
    for(let i=0;i<(M?15:20);i++){
      // 藤蔓也要让开机位包络:原来 |x| 起点 10m,垂到底时几乎贴着 45° 架的跟随机位。
      const side=i%2?1:-1,x=side*(11.2+R()*8),z=-16+R()*30,top=7+R()*9,len=3+R()*7;
      if(menuOrbitGap(s,x,z)<1.9)continue;      // 垂到菜单机位高度的藤会把整屏糊住
      b.box(pick(CANYON.leaf),x,top-len*.5,z,.13+R()*.12,len,.13+R()*.12,(R()-.5)*.12,0,(R()-.5)*.12);
      for(let k=0;k<3;k++)b.box(pick(CANYON.leaf),x+(R()-.5)*.6,top-len*(.3+k*.22),z+(R()-.5)*.6,.5+R()*.5,.09,.3+R()*.3,(R()-.5)*.5,R()*3,(R()-.5)*.5);
    }
    /* 苔石:球场外圈散布,兼作视觉边界(§13 用岩石+植物藏住地图边界) */
    for(let i=0;i<(M?20:26);i++){
      const a=R()*6.283,rad=13+R()*20,x=Math.cos(a)*rad,z=Math.sin(a)*rad*.9-5;
      const w=1+R()*2.6;
      if(Math.abs(x)-w<((z>-7.5&&z<5.5)?10.9:9.6)&&z>-14.5&&z<24)continue;
      b.add("blob",pick(CANYON.rock),x,w*.28,z,w,w*.55,w*.9,(R()-.5)*.3,R()*3,(R()-.5)*.3);
      if(R()<.7)b.add("blob",pick(CANYON.moss),x,w*.5,z,w*.8,w*.2,w*.7);
    }
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
    const windowBatches=Array.from({length:6},()=>batch());
    b.box(0xc6b487,0,-.12,-21,110,.1,18);b.box(0x878c7f,0,-.12,21,110,.1,25);
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(130,70),new THREE.MeshLambertMaterial({color:0x4d8794}));ocean.rotation.x=-Math.PI/2;ocean.position.set(0,-.2,-63);ocean.name="pacificOcean";s.root.add(ocean);s.ocean=ocean;
    const waves=batch();for(let i=0;i<10;i++)for(let j=0;j<7;j++)waves.box(0xb7ccc1,-50+j*16+(i%2)*4,.01,-29-i*4.6,8+s.r()*5,.018,.1+s.r()*.15);s.wave=waves.finish(s.root,"pacificFoam");
    // A public promenade, with unrestricted gaps on every side of the court.
    b.box(0xb6ad98,0,-.045,-15.4,110,.04,3.1);for(let x=-54;x<55;x+=2)b.box(0x827e70,x,-.02,-15.4,.025,.012,3.1);
    for(let side of [-1,1])for(let i=0;i<3;i++){
      const x=side*(23+i*12),z=8+i*7,h=8+(i%2)*4;
      b.box(i%2?0xbab5a2:0xd0bc9d,x,h/2,z,9,h,13);
      for(let y=2;y<h;y+=2.5){
        b.box(0xe1cfad,x,y-.85,z-7,9.5,.2,2.1);b.box(0x858c7f,x,y-.35,z-7.9,9,.1,.1);
        for(let dx=-3;dx<=3;dx+=2){
          b.box(0x48616a,x+dx,y,z-6.54,1.3,1.6,.09);
          if(s.r()>.25)windowBatches[Math.floor(s.r()*6)].box(0xffd39a,x+dx,y,z-6.6,1.12,1.42,.04);
        }
      }
      b.box(0xc89b79,x,h+.35,z,9.3,.65,13.3);
      // Side balconies face the court too: windows must work from both shooting ends.
      for(let y=2;y<h;y+=2.5)for(let dz of [-4,-1,2,5]){
        b.box(0x3e6471,x-side*4.54,y,z+dz,.09,1.65,1.7);b.box(0xcec1a5,x-side*5.1,y-.9,z+dz,1.3,.16,2.4);
        b.box(0x7e8e87,x-side*5.7,y-.35,z+dz,.1,.09,2.3);
        if(s.r()>.25)windowBatches[Math.floor(s.r()*6)].box(0xffc477,x-side*4.61,y,z+dz,.04,1.45,1.5);
      }
    }
    /* 度假区密度。原来两侧各 3 栋、再往后什么都没有,岸线读起来是荒地不是度假村。
       这里补三层:① 后排中高层酒店(错落,不与前排对齐);② 贴地的白色小别墅群;
       ③ 沿街棕榈与矮花坛。全部走同一个合批,只增三角形不增 draw call。 */
    for(let side of [-1,1]){
      // ① 后排酒店:高度与进深都错开,避免和前排连成一堵墙
      for(let i=0;i<4;i++){
        const x=side*(30+i*13+s.r()*4),z=-6+i*13+s.r()*5,h=11+((i+ (side>0?1:0))%3)*5.5;
        const wall=[0xd8cdb4,0xc9bda4,0xe2d8c2,0xbfb49c][i%4];
        b.box(wall,x,h/2,z,11+s.r()*3,h,12);
        b.box(0xb8845f,x,h+.4,z,11.6,.8,12.6);                    // 陶土檐口
        for(let y=2.4;y<h-1;y+=2.6)for(let dz=-4.5;dz<=4.5;dz+=2.2){
          b.box(0x3f6470,x-side*5.56,y,z+dz,.08,1.5,1.5);
          if(s.r()>.35)windowBatches[Math.floor(s.r()*6)].box(0xffd39a,x-side*5.62,y,z+dz,.04,1.3,1.3);
          b.box(0xd9cdb0,x-side*6.05,y-.85,z+dz,1.1,.14,2.0);      // 小阳台
        }
      }
      // ② 白色小别墅:贴地、坡顶、成组
      for(let i=0;i<5;i++){
        const x=side*(27+s.r()*20),z=26+i*8+s.r()*4,h=4.2+s.r()*1.6,w=6+s.r()*2.4;
        b.box(0xe6ddc9,x,h/2,z,w,h,7);
        for(let t=0;t<3;t++)b.box(0xa9603f,x,h+.28+t*.42,z,w*(1-t*.22),.42,7*(1-t*.2));
        for(let dz=-2;dz<=2;dz+=2)b.box(0x3f6470,x-side*(w/2+.04),1.9,z+dz,.07,1.2,1.1);
        b.box(0x8fa07d,x+side*(w/2+1.2),.5,z,1.6,1,1.6);           // 门口绿植
      }
      // ③ 沿街棕榈 + 矮花坛
      for(let i=0;i<6;i++){
        const x=side*(17.5+s.r()*2),z=-14+i*9+s.r()*3;
        tree(s,b,x,z,"palm",.95+s.r()*.35);
        b.box(0xcabd9f,x,.22,z+2.4,2.2,.44,1.4);
        b.box(0x6f8a5c,x,.5,z+2.4,1.9,.3,1.1);
      }
    }
    /* ---- 步道街区(计划 §C:"建筑沿步道拐进左右画面,不把酒店全部放在镜头之外")----
       原来两侧酒店都在 z=+8~22,也就是**投篮机位背后**;画面里只剩
       球场 → 大片沙滩 → 远处酒店 三段互不相干的东西。
       这里沿 -x 补一条连续的低层街边(冲浪店 / 餐饮 / 酒店裙房),从玩家身后一路
       拐到画框左侧,再在步道尽头转角收住;面海方向(正后方)一点不动,留给落日和海天线。
       ⚠ 立面压在 x=-13.6:生产机位包络实测 |x|≤9.96,再留净空。 */
    (()=>{
      const FX=-13.6,warm=batch();
      const unit=(z0,w,kind,i)=>{
        const cz=z0+w/2,wall=[0xe4d9c0,0xd6c8a8,0xcbbb9c,0xe9e0cb][i%4];
        const h=kind==="terrace"?6.4:4.6;
        b.box(wall,FX-3.2,h/2,cz,6.4,h,w);                     // 主体(共墙,连成一条街)
        b.box(0x9c8f74,FX-3.2,h+.22,cz,6.8,.34,w+.3);          // 女儿墙
        b.box(0x8d8270,FX+.02,.3,cz,.28,.6,w);                 // 墙裙
        b.box(0x2b2620,FX+.03,1.5,cz,.1,2.6,w-1.4);            // 敞开的店面
        warm.box(0xd8a869,FX+.09,1.9,cz,.05,1.5,w-1.9);        // 店内暖光
        b.box([0xc06a52,0x4f7f86,0xcf9b52][i%3],FX+1.2,2.95,cz,2.6,.16,w-.5,0,0,-.2);  // 遮阳棚
        for(let k=0;k<Math.ceil(w/1.1);k++)
          b.box(k%2?0xe9e2d0:[0xc06a52,0x4f7f86,0xcf9b52][i%3],FX+2.4,2.66,cz-w/2+.55+k*1.1,.5,.34,.9);
        if(kind==="terrace"){                                   // 二层露台 + 栏杆 + 串灯
          b.box(0xd8cfb6,FX+.9,4.3,cz,2.6,.18,w-.4);
          for(let k=0;k<Math.ceil(w/.9);k++)b.box(0x6f7a72,FX+2.05,4.9,cz-w/2+.45+k*.9,.06,1.1,.06);
          b.box(0x6f7a72,FX+2.05,5.44,cz,.07,.07,w-.3);
          for(let k=0;k<Math.ceil(w/1.3);k++)warm.box(0xffcf8e,FX+2.05,5.3,cz-w/2+.65+k*1.3,.14,.14,.14);
          for(const dz of [-w*.28,w*.28]){                      // 露台上的桌椅
            b.box(0xb9ac90,FX+.9,4.86,cz+dz,.8,.08,.8);
            b.box(0x8a7d64,FX+.9,4.58,cz+dz,.11,.56,.11);
          }
        }else{
          for(let y=3.5;y<h;y+=1.6)for(let k=0;k<Math.ceil(w/2.2);k++){
            b.box(0x3f5d66,FX+.04,y,cz-w/2+1.1+k*2.2,.08,1.1,1.3);
            warm.box(0xe7b878,FX+.1,y,cz-w/2+1.1+k*2.2,.05,.95,1.15);
          }
        }
      };
      let z=20.5;const kinds=["shop","terrace","shop","shop","terrace","shop"];
      for(let i=0;i<kinds.length;i++){const w=5.4+(i%3)*1.6;unit(z-w,w,kinds[i],i);z-=w;}
      /* 转角:街到步道尽头折向 +z,后面还有一段墙和屋顶 —— 不是一刀切断。 */
      b.box(0xdcd0b4,-19.4,2.5,z-2.6,12,5,5.2);
      b.box(0x9c8f74,-19.4,5.22,z-2.6,12.4,.34,5.6);
      b.box(0x2b2620,-19.4,1.5,z-.1,7,2.6,.12);
      warm.box(0xd8a869,-19.4,1.9,z-.04,5.6,1.5,.06);
      b.box(0x4f7f86,-19.4,3.05,z+1.1,11,.16,2.6,-.2);
      /* ---- 三个节点(§C)---- */
      // ① 棕榈树下的座椅:步道上,朝海
      tree(s,b,-10.9,-14.6,"palm",1.05);
      b.box(0x8d7f66,-10.6,.4,-12.6,1.7,.12,.5);
      b.box(0x8d7f66,-10.6,.68,-12.3,1.7,.5,.12);
      for(const dx of [-.7,.7])b.box(0x6f6553,-10.6+dx,.2,-12.6,.12,.4,.4);
      // ② 冲浪店门前:板架 + 自行车
      for(let k=0;k<5;k++)b.box([0xe8e2d2,0xd45f4a,0x3f7f8c,0xe9b955,0xdcd5c2][k],
        -12.5,1.15,-6.4+k*.46,.12,2.1,.4,0,0,-.14);
      b.box(0x7a6f5b,-12.5,2.25,-5.5,.5,.14,2.9);
      for(let i=0;i<3;i++){
        const bz=-8.6-i*1.2;
        b.box(0x3b4a52,-12.2,.62,bz,.46,.06,1.5);
        for(const dz of [-.56,.56])b.box(0x2b2f33,-12.2,.34,bz+dz,.07,.66,.66);
        b.box(i%2?0xd45f4a:0x3f7f8c,-12.2,.86,bz+.16,.32,.2,.42);
      }
      // ③ 沙滩边缘的浅坡与积沙:场地到步道之间不再是一条硬边(§C"少量积沙、磨损台阶")
      for(let k=0;k<4;k++)b.box(0xcabb96,-2+k*0,-.03-k*.02,-17.6-k*1.4,80-k*6,.1,1.5);
      for(let k=0;k<3;k++)b.box(0xd7c9a4,-9.4,.06+k*.06,-14.2-k*.5,3.6,.16+k*.1,.5);
      const glow=warm.finish(s.root,"boardwalkGlow",true);
      if(glow){glow.material.polygonOffset=true;glow.material.polygonOffsetFactor=-1;glow.material.polygonOffsetUnits=-4;
        glow.material.color.setScalar(.12);s.lights.push({mesh:glow,threshold:.4});}
    })();
    windowBatches.forEach((b,i)=>{const mesh=b.finish(s.root,`hotelWindowGroup:${i}`,true);if(mesh){
      // The desktop grading RT uses 16-bit depth. Keep lit panes ahead of their
      // dark backing at oblique, distant views without disabling occlusion.
      mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-1;mesh.material.polygonOffsetUnits=-4;
      mesh.material.color.setScalar(.12);s.lights.push({mesh,threshold:.45+i*.08});
    }});
    for(let i=0;i<10;i++){const x=-41+i*9;if(Math.abs(x)>5)tree(s,b,x,-17.8,"palm",.85+(i%3)*.13);}
    for(let side of [-1,1])for(let z=-9;z<=21;z+=10)lamp(s,b,side*14,z);
    // Lifeguard hut and beach steps, deliberately off the shooting axis.
    b.box(0xb0c4bc,-19,2.1,-24,3.8,2.6,3);b.box(0x618d99,-19,3.5,-24,4.5,.24,3.8);
    for(let dx of [-1.5,1.5])b.box(0x81745d,-19+dx,.8,-24,.18,1.6,.18);
    for(let j=0;j<5;j++)b.box(0xc0ae8e,-19,.15+j*.16,-20.4-j*.32,1.6,.25,.4);
    const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(2.1,16,10),new THREE.MeshBasicMaterial({color:0xffcc83,transparent:true}));sunDisc.position.set(-18,8.5,-57);s.root.add(sunDisc);s.sunDisc=sunDisc;
    s.nightColors=[0xf1a05f,0xb86792,0x39466f,0x101e35].map(c=>new THREE.Color(c));s.skyColor=new THREE.Color();s.fogTint=new THREE.Color(0x607485);s.oceanDay=new THREE.Color(0x4d8794);s.oceanNight=new THREE.Color(0x203c52);
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
    /* 菜单环绕椭圆的场地覆盖(camera.js 读 placeState.menuOrbit)。
       雨林是谷底封闭空间,默认 18×20/y=8 的椭圆正好落在第一层树冠里,
       菜单会被一团叶子糊满 —— 收到球场周围的空地上绕。 */
    if(name==="flowerCourt")s.menuOrbit=[12.6,15.4,6.2,2.4];
    /* 湘南:校舍在 SCH_X=20、宽 13,占住 x 13.5~26.5,默认椭圆的 x=18 直接在楼里面;
       校舍拉远会掉进雾里(作者原注)。改成从校园树冠之上、外走廊之外绕过去:
       x 11.4 卡在校园树(冠顶约 7.3m)与外走廊楼板(x≥12.25)之间,机位抬到 10.4m
       从树冠上方掠过;椭圆拉长到 20,让长轴两端的俯角回到正常。 */
    if(name==="shonanCoast")s.menuOrbit=[11.4,20,10.4,2.6];
    const b=batch(),builder=({outdoorSunny:city,rainyCourt:rainTown,flowerCourt:village,shonanCoast:shonan,medCliff:med,beachSunset:coast})[name];
    if(builder)builder(s,b);else AIBAWorldWonders.build(s,b,{batch,tree,facing});
    AIBAWorldLife.build(s,b,{batch,rng});
    themeHoops(s,b);b.finish(root,`placeArchitecture:${name}`);clouds(s);makeBirdPool(s);
    if(name==="outdoorSunny"){scene.fog.near=52;scene.fog.far=145;}
    if(name==="shonanCoast"){scene.fog.near=58;scene.fog.far=190;}
    if(name==="medCliff"){scene.fog.near=95;scene.fog.far=330;}
    if(name==="flowerCourt"){
      /* 峡谷顶部开口漏下的**自然天光**,不是人工灯。
         谷底照度低于露天,但必须读得出"光是从上方开口下来的":所以抬高太阳的
         y(俯角变大、更接近垂直),环境光与半球光压低,雾调成湿润的冷绿 ——
         峡谷的纵深和湿气才出得来。各场景预设都会重设这几个光,不会泄漏到室内。 */
      /* 雾拉远:瀑布在 86m,near40/far108 会把它吃掉 68%,唯一的亮部就糊没了。
         far 拉到 150 后约 40%,既保留空气纵深又让瀑布读得出来(§9)。 */
      scene.fog.near=34;scene.fog.far=150;
      if(scene.fog.color)scene.fog.color.setHex(0x93a89b);
      ambient.color.setHex(0xd8e6dc);ambient.intensity=.38;
      hemi.color.setHex(0xbcd0c4);hemi.groundColor.setHex(0x3c4a42);hemi.intensity=.5;
      sun.color.setHex(0xfff4dd);sun.intensity=1.15;sun.position.set(-6,26,-4);
    }
    /* Rain has a water film; forest soil stays rough, with only a faint damp sheen. */
    const tex=surface(name),m=courtFloor.material;courtFloor.userData.placeTexture=tex;m.map=tex;m.color.setHex(0xffffff);m.roughnessMap=null;
    /* 湘南是旧水泥外场:干、亚光、几乎不反光(文档"偏旧但干净") */
    m.roughness=name==="rainyCourt"?.62:(name==="flowerCourt"?.91:(name==="shonanCoast"?.92:(name==="medCliff"?.88:.95)));
    m.clearcoat=name==="rainyCourt"?.12:(name==="flowerCourt"?.06:0);
    if(m.clearcoatRoughness!==undefined)m.clearcoatRoughness=(name==="rainyCourt"||name==="flowerCourt")?.22:.5;
    m.envMapIntensity=.04;m.needsUpdate=true;
    scene.traverse(o=>{if(["courtZone","courtLine","courtMark","nearCourtCrowdRoot"].includes(o.name)){o.userData.placeHidden=o.visible;o.visible=false;}});
    document.documentElement.dataset.worldPlace=name;return s;
  }
  function update(dt,progress){
    const s=environmentRoot.userData.placeState;if(!s)return;s.time+=dt;
    AIBAWorldWonders.update(s);
    s.plants.forEach(p=>{const t=s.time,phase=p.phase;p.pivot.rotation.z=(Math.sin(t*.8+phase)+.32*Math.sin(t*1.73+phase*2))*p.amp;p.pivot.rotation.x=Math.sin(t*.61+phase)*p.amp*.55;});
    // Advect a continuous curtain in flight-time coordinates; gravity stretches the falling streaks.
    if(s.waterfall)s.waterfall.forEach(m=>{if(m.uniforms&&m.uniforms.time)m.uniforms.time.value=s.time;});
    /* 水雾:整团缓慢起伏 + 轻微横移。只读 s.time,不碰 Math.random —— 
       world-places.test.mjs 断言环境动画消耗的玩法随机数必须是 0。 */
    if(s.mist&&s.mist.g){
      const t=s.time;
      s.mist.g.position.y=Math.sin(t*.23)*.9+Math.sin(t*.37)*.4;
      s.mist.g.scale.setScalar(1+Math.sin(t*.19)*.09);
      if(s.mist.mesh)s.mist.mesh.material.opacity=.24+.09*(Math.sin(t*.31)*.5+.5);
    }
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
      s.sunDisc.position.y=8.5-p*11;s.sunDisc.material.opacity=1-clamp01((p-.48)/.25);s.ocean.material.color.copy(s.oceanDay).lerp(s.oceanNight,p);s.wave.position.z=(s.time*.32)%4.6;
      let on=0;s.lights.forEach(l=>{const t=clamp01((p-l.threshold)/.07);l.mesh.material.color.setScalar(.12+t*.88);if(t>.5)on++;});s.root.userData.litWindows=on;
      s.realLights.forEach(l=>l.intensity=clamp01((p-.5)/.3)*1.25);ambient.intensity=.4-p*.08;hemi.intensity=.58-p*.15;sun.intensity=.9-p*.72;sun.color.setHex(p>.6?0x9aa9c4:0xffd5a0);
      s.clouds.forEach(c=>c.g.children[0].material.color.copy(s.skyColor).lerp(s.fogTint,.45-p*.25));
      document.documentElement.dataset.environmentPhase=p<.25?"golden":p<.5?"sunset":p<.75?"dusk":"night";
    }else s.lights.forEach(l=>l.mesh.material.color.setScalar(s.name==="rainyCourt"?.9:.18));
  }
  window.AIBAWorldPlaces={enabled,build,update,restore,palettes,rng};
})();
