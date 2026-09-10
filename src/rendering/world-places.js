/* Four places, not four weather skins. All disposable art belongs to environmentRoot.
   Gameplay hoops stay in scene; all randomness here has an independent stream. */
(()=>{
  const enabled=new URLSearchParams(location.search).get("places")!=="classic";
  const palettes={
    outdoorSunny:{ground:"#626369",field:"#343e47",key:"#b95543",line:"#e2d5b4",shirts:[0xe3d4b9,0x344760,0xb95142,0x323239,0x769793,0xe0ab47,0xe5e1d4,0x657293]},
    rainyCourt:{ground:"#545d60",field:"#35565b",key:"#263f48",line:"#bcb99e",shirts:[0xc9ac65,0x384c52,0x9a6857,0x5e6b64,0xb6b9a4,0x313d50,0x826882,0x687b80]},
    /* 鲜花场从"赭土村落"改成"热带峡谷石铺地":底色换成被雨水泡旧的湿石灰绿,
       青苔与积水痕由 surface() 单独画上去。原赭土 #a07752 那套已被判定太土。
       线色改米白 —— 灰石底上原来的暖黄线会糊掉。 */
    /* §6:户外硬质 PU 场,主色深森林绿/深灰绿,白线。原来是灰石板(旧村落遗留),
       在满屏绿色里读成一块水泥地,和"从雨林中切出来的球场"对不上。 */
    flowerCourt:{ground:"#2f3a33",field:"#33513f",key:"#27402f",line:"#eef1e6",shirts:[0xe5c79a,0x3b6472,0xa04f36,0x7a7c47,0xc59356,0xeee2c1,0x514b70,0xc26f58]},
    /* 旧但干净的学校水泥外场:灰蓝 + 海盐绿,低饱和(文档 §4 球场设计)。
       刻意不用荧光街头配色。 */
    /* 浅灰蓝 / 海盐蓝 + 米白线(文档 §球场设计),不做荧光街头配色 */
    medCliff:{ground:"#cdc3a8",field:"#7d9aa8",key:"#6b8a99",line:"#f4efe2",shirts:[0xf2ece0,0x2c6ba4,0xd9cdb4,0xb05f3d,0xe8e0cf,0x3f7f9e,0xc63a7a,0xcfc3a8]},
    shonanCoast:{ground:"#9a9e97",field:"#6d8686",key:"#5b7676",line:"#eef0e8",shirts:[0xe8e4d8,0x2f4f6b,0x8fa8b4,0xd9d2bd,0x44606d,0xf0ece0,0x7d9aa2,0xc3ccc4]},
    beachSunset:{ground:"#9a998c",field:"#92978e",key:"#747f7a",line:"#c9c4a9",shirts:[0xdcc6a4,0x7caaaa,0xc07765,0xead7a6,0x4c7583,0xb39a85,0xd6c7c3,0x577368]}
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
    function add(shape,color,x,y,z,w,h,d,rx=0,ry=0,rz=0){
      const geo=shape==="sphere"?sphere:shape==="blob"?blob:shape==="cone"?cone:cube,p=geo.attributes.position,a=geo.attributes.normal;
      matrix.compose(v.set(x,y,z),q.setFromEuler(e.set(rx,ry,rz)),n.set(w,h,d));normal.getNormalMatrix(matrix);c.set(color).convertSRGBToLinear();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);n.fromBufferAttribute(a,i).applyMatrix3(normal).normalize();pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(c.r,c.g,c.b);}
    }
    return {add,box:(color,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>add("box",color,x,y,z,w,h,d,rx,ry,rz),finish(parent,name,basic=false){
      cube.dispose();sphere.dispose();blob.dispose();cone.dispose();if(!pos.length)return null;
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
    if(name==="rainyCourt"||name==="outdoorSunny"){
      g.strokeStyle=name==="rainyCourt"?"#72766e":"#858480";g.lineWidth=.022;
      for(let z=near-3;z<far+4;z+=name==="rainyCourt"?.65:1.4)for(let side of [-1,1]){
        g.beginPath();g.moveTo(side*8.2,z);g.lineTo(side*16,z);g.stroke();
        for(let x=8.3;x<16;x+=name==="rainyCourt"?1:2){g.beginPath();g.moveTo(side*(x+(Math.floor(z*2)%2)*.3),z);g.lineTo(side*(x+(Math.floor(z*2)%2)*.3),z+.65);g.stroke();}
      }
    }
    if(name==="flowerCourt"){
      /* 峡谷石铺地:不规则石块 + 深缝 + 青苔 + 积水痕。
         原来这里画的是"手绘几何织纹"(菱形编织 + 中圈放射三角),配赭土底色
         读起来就是乡村土场 —— 已被判定"太土"。改成热带峡谷里被雨水泡旧的
         石铺:灰绿湿石、缝里长青苔、低洼处留暗色积水痕(配合材质反光读成湿)。 */
      const TONE=["#5d675e","#6a7369","#525c54","#77807a","#4b554e"];
      /* 四边形带随机抖动:整齐的砖块会立刻读成"人造地砖",
         峡谷里的石头该是乱砌的,所以每条边都抖一点。 */
      const stone=(cx,cz,w,tone)=>{
        const j=()=>(r()-.5)*w*.26;
        g.fillStyle=tone;g.beginPath();
        g.moveTo(cx-w/2+j(),cz-w/2+j());g.lineTo(cx+w/2+j(),cz-w/2+j());
        g.lineTo(cx+w/2+j(),cz+w/2+j());g.lineTo(cx-w/2+j(),cz+w/2+j());
        g.closePath();g.fill();
      };
      /* 场内:细密石板、缝窄,保证球感和线仍然读得清 */
      /* 场内改成**微颗粒 PU**(§6:户外硬质场,不是石铺;之前的 0.62m 石板格
         在满屏绿色里读成人造地砖)。做法是底色铺满 + 细密颗粒噪点,
         颗粒尺度压到 4~9cm —— 远看是亚光胶面,近看有骨料感,不会盖住白线。
         场外的乱砌湿石保留:那本来就该是谷底地面,正好和场内分出材质边界。 */
      g.fillStyle=p.field;g.fillRect(-COURT.halfWidth,near,COURT.width,far-near);
      for(let m=0;m<9000;m++){
        const x=-COURT.halfWidth+r()*COURT.width,z=near+r()*(far-near);
        const k=r();
        g.fillStyle=k<.34?"rgba(28,44,34,.30)":k<.68?"rgba(96,128,102,.22)":"rgba(58,86,66,.26)";
        g.beginPath();g.ellipse(x,z,.02+r()*.025,.018+r()*.022,r()*3.14,0,6.283);g.fill();
      }
      /* 极轻的辊涂条痕,避免颗粒看起来是均匀噪声 */
      for(let z=near;z<far;z+=.34){
        g.strokeStyle=(Math.round(z*3)%2)?"rgba(40,62,48,.10)":"rgba(88,116,94,.08)";
        g.lineWidth=.13;g.beginPath();g.moveTo(-COURT.halfWidth,z);g.lineTo(COURT.halfWidth,z);g.stroke();
      }
      /* 场外:更大更乱的块石 */
      for(let sd of [-1,1])for(let z=near-3;z<far+3;z+=1.1)
        for(let d=0;d<7;d++)stone(sd*(8.5+d*1.1+((Math.floor(z)%2)?.3:0)),z+(d%2)*.3,1.04,TONE[(r()*TONE.length)|0]);
      /* 青苔:沿缝与场边生长。场内刻意稀疏,否则会干扰读线和判断落点。 */
      for(let m=0;m<300;m++){
        const x=(r()-.5)*31,z=near-3+r()*(far-near+6);
        if(Math.abs(x)<COURT.halfWidth&&z>near&&z<far&&r()<.72)continue;
        g.fillStyle=r()<.5?"rgba(74,107,71,.32)":"rgba(96,129,80,.24)";
        g.beginPath();g.ellipse(x,z,.18+r()*.44,.12+r()*.3,r()*3.14,0,6.283);g.fill();
      }
      /* 积水暗痕 */
      for(let m=0;m<76;m++){
        const x=(r()-.5)*31,z=near-3+r()*(far-near+6);
        g.fillStyle=r()<.5?"rgba(34,48,54,.28)":"rgba(52,68,72,.18)";
        g.beginPath();g.ellipse(x,z,.5+r()*1.6,.3+r()*.9,r()*3.14,0,6.283);g.fill();
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
    // Grain is painted after stripes: the West Coast lines wear with the pavement.
    for(let i=0;i<18000;i++){
      const x=r()*32-16,z=COURT.floorMinZ+r()*D;g.fillStyle=r()>.5?"rgba(255,240,209,.08)":"rgba(28,32,29,.09)";g.fillRect(x,z,.013+r()*.05,.012+r()*.06);
    }
    if(name==="beachSunset"){
      for(let i=0;i<95;i++){const x=r()*29-14.5,z=near+r()*COURT.length;g.fillStyle=`rgba(107,109,99,${.08+r()*.2})`;g.fillRect(x,z,.2+r()*1.3,.1+r()*.8);}
      for(let i=0;i<25;i++){let x=r()*28-14,z=near+r()*COURT.length;g.strokeStyle="rgba(51,56,51,.36)";g.lineWidth=.016;g.beginPath();g.moveTo(x,z);for(let j=0;j<6;j++){x+=(r()-.4)*.45;z+=r()*.4;g.lineTo(x,z);}g.stroke();}
      for(let i=0;i<180;i++){g.fillStyle=p.field;g.fillRect((r()-.5)*15.1,near+r()*COURT.length,.1+r()*.25,.025+r()*.065);}
    }
    const tex=new THREE.CanvasTexture(cv);tex.name=`placeSurface:${name}`;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;return tex;
  }
  function restore(){
    if(courtFloor?.userData.placeTexture){courtFloor.userData.placeTexture.dispose();delete courtFloor.userData.placeTexture;}
    scene.traverse(o=>{if(o.userData.placeHidden!==undefined){o.visible=o.userData.placeHidden;delete o.userData.placeHidden;}});
    setPlaceHoops(false);
  }
  function themeHoops(s,b){
    /* 峡谷雨林要的是"专业篮球设施",不是废墟木架(§7):
       深灰支架 + 玻璃篮板 + 白描边,底座少量苔藓做环境融合。
       原来 flowerCourt 走的是木架木板(旧"赭土村落"遗留),读起来像野球场。 */
    const canyon=s.name==="flowerCourt";
    if(canyon){
      [[-8.62,1],[COURT.farBaseline-.96,-1]].forEach(([z,dir])=>{
        const base=z-dir*1.55,steel=0x2b3230;
        b.box(steel,0,1.75,base,.24,3.5,.24);b.box(steel,0,3.46,z-dir*.76,.22,.22,1.55);
        b.box(steel,0,2.9,base+dir*.45,.14,1.45,.14,-dir*.6);
        b.box(0x333c38,0,.1,base,.8,.2,.8);
        b.box(0x3a5c3e,0,.19,base,.86,.08,.86);                    // 底座苔藓
        b.box(0xdae8ea,0,3.5,z,1.9,1.1,.1);                        // 玻璃板
        [-1,1].forEach(a=>{
          b.box(0x2b3230,0,3.5+a*.55,z+dir*.055,1.96,.07,.11);      // 上下边框
          b.box(0x2b3230,a*.95,3.5,z+dir*.055,.07,1.17,.11);        // 左右边框
          b.box(0xf2f6f6,a*.3,3.25,z+dir*.058,.035,.36,.014);       // 内框白线
          b.box(0xf2f6f6,0,3.25+a*.18,z+dir*.058,.63,.035,.014);
        });
      });
      setPlaceHoops(true);return;
    }
    const wood=false,rain=s.name==="rainyCourt",color=rain?0x293a3d:0x526264;
    [[-8.62,1],[COURT.farBaseline-.96,-1]].forEach(([z,dir])=>{
      const base=z-dir*1.55;
      b.box(color,0,1.75,base,.24,3.5,.24);b.box(color,0,3.46,z-dir*.76,.22,.22,1.55);
      b.box(color,0,2.9,base+dir*.45,.14,1.45,.14,-dir*.6);b.box(wood?0x66513b:0x757b76,0,.1,base,.75,.2,.75);
      b.box(wood?0xad8054:rain?0xc5c1a9:0xd6d1b9,0,3.5,z,1.9,1.1,.12);
      for(let j=-2;j<=2;j++)if(wood)b.box(0x694c34,j*.34,3.5,z+dir*.062,.018,1.07,.006);
      const ink=wood?0xe4cca0:rain?0x704f40:0x384f56;
      [-1,1].forEach(a=>{b.box(ink,0,3.5+a*.51,z+dir*.066,1.86,.035,.012);b.box(ink,a*.915,3.5,z+dir*.066,.035,1.05,.012);
        b.box(ink,a*.3,3.25,z+dir*.069,.035,.36,.014);b.box(ink,0,3.25+a*.18,z+dir*.069,.63,.035,.014);});
      for(let x of [-.84,.84])for(let y of [3.04,3.96])b.box(0x494640,x,y,z+dir*.073,.035,.035,.025);
      if(wood)for(let j=0;j<6;j++)b.box(0xc3a976,0,1.3+j*.065,base,.26,.025,.27);
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
    const canyon=s.name==="flowerCourt";
    for(let i=0;i<(canyon?(s.mobile?2:3):(s.mobile?6:10));i++){
      const g=new THREE.Group(),b=batch(),rain=s.name==="rainyCourt";g.position.set(-43+s.r()*86,(s.name==="outdoorSunny"?64:rain?16:canyon?74:22)+s.r()*9,-45+s.r()*75);
      for(let j=0;j<7;j++)b.add("sphere",rain?(j%2?0xa9b7ba:0x919fa4):(j%3?0xf5edda:0xdedfd5),(s.r()-.5)*5,(s.r()-.3)*1.1,(s.r()-.5)*2.3,1.7+s.r()*1.5,rain?.65:1+s.r()*.6,1+s.r());
      b.finish(g,"organicCloud");s.root.add(g);s.clouds.push({g,speed:.15+s.r()*.15});
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
  function rainTown(s,b){
    b.box(0x56605b,0,-.14,4,100,.12,106);
    for(let side of [-1,1])for(let i=0;i<7;i++){
      const x=side*(22+(i%2)*2),z=-28+i*10,h=4.2+(i%3)*.5;
      b.box(0x51463c,x,h/2,z,8,h,7);b.box(0x9b927c,x,h*.62,z-3.54,7,h*.52,.09);
      for(let dx=-3.5;dx<=3.5;dx+=1)b.box(0x433e35,x+dx,h*.55,z-3.64,.11,h*.85,.12);
      for(let sideRoof of [-1,1])b.box(0x3c4a4c,x+sideRoof*2.2,h+.25,z,5,.2,9,0,0,-sideRoof*.32);
      for(let k=0;k<12;k++)b.box(0x63706a,x-4.2+k*.75,h-.48,z-4.55,.5,.18,.32);
      b.box(0x353e3c,x,h+1.1,z,.3,.25,9.2);b.box(0x322d27,x,.17,z-4.1,9,.3,1.7);
      const a=batch();for(let dx of [-2,1.9])a.box(0xd3a567,x+dx,2,z-3.69,1.4,1.6,.04);a.finish(s.root,"rainWarmWindows",true);
      for(let dx of [-2.5,2.5]){b.box(0x784d39,x+dx,2.5,z-4.6,.08,.7,.08);b.add("sphere",0xe7b86c,x+dx,2.1,z-4.6,.22,.36,.22);}
    }
    for(let i=0;i<10;i++)tree(s,b,(i%2?1:-1)*(15.5+(i%3)), -12+i*4.5,i%3?"bamboo":"maple",.85+(i%3)*.1);
    for(let i=0;i<5;i++){const x=-24+i*12;b.box(0x665b4c,x,2.6,-30,9,5.2,6);for(let dir of [-1,1])b.box(0x3c4c4f,x+dir*2.6,5.5,-30,5.8,.2,8,0,0,-dir*.3);
      b.box(0xa09279,x,3.8,-26.95,8.5,1.8,.1);b.box(0x312c26,x,1.45,-26.93,1.3,2.8,.12);
      for(let dx of [-3,-1.7,1.7,3]){b.box(0xbd9c69,x+dx,2,-26.86,.95,1.5,.06);for(let k=-2;k<=2;k++)b.box(0x493d30,x+dx+k*.16,2,-26.8,.045,1.6,.05);}
      b.box(0x4b4140,x,3.05,-26.65,9.4,.12,1.2,.1);for(let dx of [-4.25,0,4.25])b.box(0x40372e,x+dx,2.5,-26.75,.12,5,.16);
      const a=batch();a.box(0xf0b963,x+3.7,2.7,-26.2,.26,.5,.26);a.finish(s.root,"rainLantern",true);
    }
    // Small drainage channel and low stone edging, no park cage.
    for(let side of [-1,1]){b.box(0x304b50,side*15.4,-.02,4,.35,.05,35);for(let z=-12;z<24;z+=.9)b.box(0x777971,side*15.8,.13,z,.4,.26,.8);}
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
        bb.box(pick(CANYON.rock),x+(R()-.5)*1.8,y0+hh*.5,z+(R()-.5)*2.4,w,hh,depth,(R()-.5)*.05,(R()-.5)*.2,(R()-.5)*.06);
        /* 覆盖层:苔藓块 + 垂落藤蔓 + 岩缝蕨 */
        if(R()<.82){bb.box(pick(CANYON.moss),x+(R()-.5)*w*.6,y0+hh*.62,z+(R()-.5)*2.2,w*(.4+R()*.5),hh*(.35+R()*.4),depth*.14);}
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
       通道尽头。两级:顶部主瀑 → 岩台 → 次级瀑 → 水潭。
       位置沿"相机→篮筐"的视轴延长线偏一点,使它在画面里紧邻篮板上方而不重叠。 */
    /* 距离取 §5 允许区间(50~150m)的近端:相机在 z≈+1.5,z=-64 约 66m。
       第一版放在 -86(≈89m),在 near34/far150 的雾里被吃掉 47%,
       水幕和它背后的暗崖差不到一档,探针说"在屏幕上"但肉眼一片都看不到。 */
    const WF={x:-13,z:-64,top:38,ledge:17,pool:2.2};
    /* 瀑布所在的崖体。这一段是整张图唯一的亮部,必须**先把背景压暗**再谈水色:
       实测第一版水体已经在正确的屏幕位置(篮板上方偏右),但 86m 处被雾吃掉 68%,
       而它背后的崖壁又是浅灰岩色 —— 白水叠在灰岩上,等于没画。
       所以这里侧翼崖体单独用深色,并给一整面加宽加高的暗背板当剪影底。 */
    const darkRock=[0x232e2e,0x1c2726,0x2a3634];
    const cliffDark=(bb,x,z,baseW,topY,depth)=>{
      for(let i=0;i<6;i++){
        const y0=i*topY/6,hh=topY/6*1.25,w=baseW*(1-i*.09);
        bb.box(darkRock[(R()*3)|0],x+(R()-.5)*1.8,y0+hh*.5,z+(R()-.5)*2.4,w,hh,depth,0,(R()-.5)*.2,0);
        if(R()<.7)bb.box(0x25412c,x+(R()-.5)*w*.6,y0+hh*.62,z+(R()-.5)*2.2,w*(.4+R()*.5),hh*(.4+R()*.4),depth*.14);
      }
    };
    for(let i=-3;i<=3;i++)cliffDark(b,WF.x+i*15+(R()-.5)*4,WF.z-7+(R()-.5)*6,18,50+R()*20,16);
    b.box(0x182223,WF.x,WF.top*.55,WF.z-1,34,WF.top*1.15,8);          // 剪影暗背板(加宽加高)
    b.box(0x22302f,WF.x,WF.ledge,WF.z+3.2,22,2.6,7);                  // 中段岩台
    b.box(0x2b4547,WF.x,WF.pool*.5,WF.z+16,26,WF.pool,14);            // 水潭
    /* ⚠ 必须站在暗背板**前面**。背板是 b.box(...,WF.z-1,34,...,8),深度 8,
       z 跨 WF.z-5 ~ WF.z+3。第一版把水组放在 WF.z+1.2 —— 整片水幕埋在不透明
       背板内部,一个像素都出不来;而水雾因为自带 +3/+13 的 z 偏移刚好在板前,
       所以画面上"只有雾没有水",看起来像水根本没建出来。 */
    const wf=new THREE.Group();wf.position.set(WF.x,0,WF.z+5.5);
    /* 水体:半透明,叠三段循环下落 → 读成连续水流而不是一整块平移。
       两级各自一组,速度不同,形成"速度差"(§5)。 */
    /* 水体提到近白并加不透明度:它要在 68% 的雾里仍然是画面最亮的一块。
       用 Basic 而不是 Lambert —— 谷底主光很弱,受光材质会把水压成灰色。 */
    /* fog:false —— §9 的明度阶梯是"近景饱和 → 中景深绿 → 远景灰绿+雾 → 瀑布白色",
       瀑布是这条阶梯的**白端**,吃雾就没有端点了。只有水体不吃雾,
       水雾和崖壁照常吃,远近关系仍然由它们拉开。 */
    const waterMat=new THREE.MeshBasicMaterial({color:0xf4fdfd,transparent:true,opacity:.85,depthWrite:false,fog:false});
    const jetGeo=new THREE.BoxGeometry(1,10,.5);
    const jets=[];
    /* 一股一股的细柱远看是**雨丝**不是瀑布 —— 柱与柱之间的缝在 86m 处比柱本身还显眼。
       真实的做法是分两件事:
         · 静止的**水幕**给体量(一整片,不动,略暗一点);
         · 细柱在水幕**前面**循环下落,只负责动感和速度差。
       这样既有连续的白色块面,又保留"水在流"的读数。 */
    const sheetGeo=new THREE.BoxGeometry(1,1,.4);
    /* §5 明确要求"不要纯白贴图,需要有透明度、速度差、明暗变化和水流层次"。
       所以水幕拆成 3 条竖带、各自不同的不透明度与冷暖偏移(边缘偏暗偏青、
       中心最亮),水柱再逐股改速度 —— 单一材质的一整块白板是最要避免的结果。 */
    const tier=(cx,base,height,count,wide,sheetW)=>{
      const bands=3;
      for(let i=0;i<bands;i++){
        const t=(i+.5)/bands,edge=Math.abs(t-.5)*2;                 // 0=中心 1=边缘
        const sheet=new THREE.Mesh(sheetGeo,waterMat.clone());
        sheet.material.opacity=.34+(1-edge)*.30;
        sheet.material.color.setHex(edge>.6?0xb9d6da:edge>.3?0xd9edee:0xf4fdfd);
        sheet.scale.set(sheetW/bands*1.04,height*(1-edge*.06),1);
        sheet.position.set(cx+(t-.5)*sheetW,base+height*.5,-.5-i*.05);wf.add(sheet);
      }
      for(let j=0;j<count;j++){
        const segs=[],jx=cx+(j-(count-1)/2)*(sheetW/count)+(R()-.5)*.6;
        const m0=waterMat.clone();m0.opacity=.55+R()*.35;
        for(let k=0;k<3;k++){
          const m=new THREE.Mesh(jetGeo,m0);
          m.scale.set(wide*(.7+R()*.6),height/16,1);
          m.position.set(jx,base,.5+(R()-.5)*.6);wf.add(m);segs.push(m);
        }
        jets.push({segs,x:jx,h:height,base});
      }
    };
    tier(0,WF.ledge,WF.top-WF.ledge,M?3:5,2.6,15);        // 主瀑:15m 宽水幕
    tier(3.5,WF.pool,WF.ledge-WF.pool,M?2:4,2.1,10);      // 次级瀑:偏右、略窄
    s.root.add(wf);s.waterfall=jets;
    /* 水雾(§5/§9):底部与岩台各一团,缓慢起伏。单独一个 batch = 1 draw call。 */
    const mistG=new THREE.Group();mistG.position.set(WF.x,0,WF.z+7);
    const mb=batch();
    for(let i=0;i<(M?9:16);i++){
      /* 雾团压在岩台下缘与水潭上方,横向铺开但不抬到水柱中段 ——
         盖住水柱等于把唯一的亮部又糊回去。 */
      /* 雾团要小、要低、要贴着落水点。第一版给到 4~9m 半径又抬到半空,
         远看就是几团灰云挂在崖前,反而把水柱糊掉。 */
      const at=R()<.45?0:1,y=at?WF.ledge-2+R()*1.6:WF.pool+.6+R()*2.6;
      mb.add("sphere",0xdcecea,(R()-.5)*16,y,(R()-.5)*7+(at?3:13),2.2+R()*2.6,.9+R()*1.1,2+R()*2.2);
    }
    const mist=mb.finish(mistG,"canyonMist");
    if(mist){mist.material.transparent=true;mist.material.opacity=.2;mist.material.depthWrite=false;}
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
        canopy(b,x,z,ring.h[0]+R()*(ring.h[1]-ring.h[0]),ring.rad[0]+R()*(ring.rad[1]-ring.rad[0]),ring.dim,R()<.26);
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
    /* ---- 近景灌木/蕨/苔藓(§2):填满球场到崖壁的过渡带 ---- */
    const near=M?104:140;
    for(let i=0;i<near;i++){
      const a=R()*6.283,rad=10+R()*16,x=Math.cos(a)*rad,z=Math.sin(a)*rad*.9-4;
      if(Math.abs(x)<9.4&&z>-13.5&&z<23)continue;                   // 让开比赛区
      const k=R();
      if(k<.42)fern(b,x,.2+R()*.4,z,1.1+R()*1.1);
      else if(k<.72){const h=.6+R()*1.5;                            // 灌木:压扁的叶团,不是圆球
        for(let j=0;j<4;j++)b.box(pick(CANYON.leaf),x+(R()-.5)*1.3,h*(.4+R()*.7),z+(R()-.5)*1.3,
          1+R()*1.5,.3+R()*.35,1+R()*1.5,(R()-.5)*.5,R()*3,(R()-.5)*.5);}
      else if(k<.88)bigLeaf(b,x,.7+R()*1.1,z,1.5+R()*1.1,R()*6.283,-.5-R()*.5);
      else b.add("blob",pick(CANYON.moss),x,.12,z,.9+R()*1.2,.2,.9+R()*1.2);   // 苔藓斑
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
      const side=i%2?1:-1,x=side*(9.4+R()*5.4),z=-12+R()*26;
      const sc=1.9+R()*1.9,y=.9+R()*2.1;
      if(i<windLeaves){
        const g=new THREE.Group();g.position.set(x,y,z);
        const lb=batch();bigLeaf(lb,0,0,0,sc,R()*6.283,-.55-R()*.5);
        lb.finish(g,"canyonWindLeaf");s.root.add(g);
        s.plants.push({pivot:g,phase:R()*6.28,amp:.055});
      }else{
        bigLeaf(b,x,y,z,sc,R()*6.283,-.5-R()*.55);
      }
    }
    /* 藤蔓:从高处垂下,进一步遮挡镜头上缘 */
    for(let i=0;i<(M?15:20);i++){
      const side=i%2?1:-1,x=side*(10+R()*9),z=-16+R()*30,top=7+R()*9,len=3+R()*7;
      b.box(pick(CANYON.leaf),x,top-len*.5,z,.13+R()*.12,len,.13+R()*.12,(R()-.5)*.12,0,(R()-.5)*.12);
      for(let k=0;k<3;k++)b.box(pick(CANYON.leaf),x+(R()-.5)*.6,top-len*(.3+k*.22),z+(R()-.5)*.6,.5+R()*.5,.09,.3+R()*.3,(R()-.5)*.5,R()*3,(R()-.5)*.5);
    }
    /* 苔石:球场外圈散布,兼作视觉边界(§13 用岩石+植物藏住地图边界) */
    for(let i=0;i<(M?20:26);i++){
      const a=R()*6.283,rad=13+R()*20,x=Math.cos(a)*rad,z=Math.sin(a)*rad*.9-5;
      if(Math.abs(x)<9.6&&z>-13.5&&z<23)continue;
      const w=1+R()*2.6;
      b.add("blob",pick(CANYON.rock),x,w*.28,z,w,w*.55,w*.9,(R()-.5)*.3,R()*3,(R()-.5)*.3);
      if(R()<.7)b.add("blob",pick(CANYON.moss),x,w*.5,z,w*.8,w*.2,w*.7);
    }
  }
  /* ---------------- 湘南海岸高校球场 ----------------
     文档 Scene 04。构图:玩家 → 水泥外场 → 篮架 → 防波堤/沿海道路 → 海平线,
     校舍与铁丝网压在 +x 一侧,电线杆与架空线沿 -x 的海岸线向 -z 退去。
     锚点只有一个:**海岸 + 电线杆/沿海线**(文档"每张地图只能有一个核心视觉锚点")。
     边界气质:铁丝网 + 校园 + 防波堤 —— 三者都不是"围栏一圈",而是各占一侧。 */
  function shonan(s,b){
    const R=s.r,M=s.mobile;
    /* 海岸线整体拉近。投篮机位是顺着球场长轴看的,放在 x=-24 的"侧面"元素
       只会落在画框外 —— 第一版就是这样,海一格都进不了画面。
       -19 让防波堤与沿海道路贴着球场左缘,海才真的参与构图。 */
    const SEA_X=-19;                       // 防波堤外缘:再往 -x 就是海
    b.box(0x9a9e97,0,-.13,4,150,.12,150);  // 场地与校园地面

    /* ---- 海(§一侧大海)---- */
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(150,190),
      new THREE.MeshLambertMaterial({color:0x2c6280}));   // 更深的海蓝,不然在雾里读不出
    /* 海面沉到 -1.5:护岸外侧本来就比路面低。第一版海在 -0.35、堤顶却到 2.62,
       而投篮机位在 y=2.3 —— 整片海被自己的防波堤挡死,画面上只剩一条灰白带。 */
    sea.rotation.x=-Math.PI/2;sea.position.set(SEA_X-78,-1.5,-10);sea.name="shonanSea";
    s.root.add(sea);s.ocean=sea;
    /* 篮筐之后再补一片海:海湾在 -z 绕过去,于是顺着球场长轴看出去,
       篮筐上方就是海平线 —— 侧面的海只能进画框边缘,这一片才是"看得见的海"。 */
    const bay=new THREE.Mesh(new THREE.PlaneGeometry(210,120),
      new THREE.MeshLambertMaterial({color:0x2c6280}));
    bay.rotation.x=-Math.PI/2;bay.position.set(-30,-1.52,-108);bay.name="shonanBay";s.root.add(bay);
    /* 浪线:横向长条,合批;update 里整体缓慢推移 */
    const waves=batch();
    for(let i=0;i<(M?9:16);i++)for(let j=0;j<5;j++)
      waves.box(0xa9c8cd,SEA_X-8-j*17-R()*6,-1.43,-70+i*11+(j%2)*5,10+R()*9,.02,.10+R()*.14);
    s.wave=waves.finish(s.root,"shonanFoam");

    /* ---- 防波堤 + 消波块(边界气质:防波堤)---- */
    for(let z=-78;z<52;z+=6.2){
      b.box(0xb0aca0,SEA_X,.55,z,3.2,1.5,6.3);                     // 混凝土堤身(压低,别挡住海)
      b.box(0x8e8a80,SEA_X,1.36,z,3.6,.30,6.5);                    // 堤顶压顶
      /* 四脚消波块:三块交叠的斜方体,读起来就是 tetrapod 堆 */
      for(let k=0;k<2;k++){
        const cx=SEA_X-2.6-R()*3.4,cy=-.6+R()*.7,cz=z+(R()-.5)*5;
        for(let t=0;t<3;t++)b.box(0x9a978d,cx,cy,cz,1.5,.5,.5,R()*3,R()*3,R()*3);
      }
    }
    /* ---- 沿海道路 ---- */
    /* 左侧从海往球场依次:防波堤(-20.6~-17.4) → 铁道(-17.1~-13.7) →
       公路(-13.1~-8.5) → 电线杆(-9.2)。第一版铁道压在防波堤上,车体会穿堤。 */
    b.box(0x4a4f52,SEA_X+8.2,-.05,-12,4.6,.07,150);
    for(let z=-72;z<58;z+=5)b.box(0xd8d3bc,SEA_X+8.2,.005,z,.10,.012,2.1);
    b.box(0x8c8f88,SEA_X+10.4,.03,-12,1.1,.14,150);                 // 人行道牙

    /* ---- 沿海电车轨道(文档 §远景:沿海电车轨道 / §动态:偶尔驶过的小电车)---- */
    const RAIL_X=SEA_X+3.6;
    b.box(0x6b6459,RAIL_X,.10,-12,3.4,.20,150);                      // 道砟路基
    for(let z=-74;z<60;z+=.78)b.box(0x554a3d,RAIL_X,.21,z,2.5,.09,.26);   // 枕木
    for(const dx of [-.62,.62])b.box(0x8e9297,RAIL_X+dx,.29,-12,.11,.10,150); // 钢轨

    /* ---- 电线杆 + 架空线(核心锚点之二)---- */
    const poles=[];
    for(let i=0;i<(M?6:9);i++){
      const z=6-i*15,x=SEA_X+9.8,h=9.5+R()*1.4;
      b.box(0x8d8577,x,h/2,z,.30,h,.30);                            // 混凝土杆
      for(const [ay,aw] of [[h-.5,2.6],[h-1.5,2.0]])                // 横担
        b.box(0x6f675c,x,ay,z,aw,.11,.13);
      for(const dx of [-1.1,0,1.1])b.box(0x51595c,x+dx,h-.34,z,.13,.28,.13);
      poles.push({x,z,h});
    }
    /* 架空线:相邻杆之间用几段折线近似悬链,中间下垂 */
    for(let i=0;i+1<poles.length;i++){
      const a=poles[i],c=poles[i+1],SEG=4;
      for(const [dx,ly] of [[-1.1,.34],[0,.34],[1.1,.34],[0,1.34]]){
        for(let k=0;k<SEG;k++){
          const t0=k/SEG,t1=(k+1)/SEG,sag=q=>Math.sin(q*Math.PI)*.55;
          const z0=a.z+(c.z-a.z)*t0,z1=a.z+(c.z-a.z)*t1;
          const y0=a.h-ly-sag(t0),y1=c.h-ly-sag(t1);
          b.box(0x2f3438,a.x+dx,(y0+y1)/2,(z0+z1)/2,.05,.05,Math.abs(z1-z0)*1.02,
            Math.atan2(y1-y0,z1-z0),0,0);
        }
      }
    }

    /* ---- 校舍(边界气质:校园)---- */
    const SCH_X=20;   // 27 太远,在雾里读不出来;拉到 20 让校舍真正参与构图
    for(let seg=0;seg<(M?3:4);seg++){
      const z=-20+seg*17,h=11.5,w=13;
      b.box(0xcfcabb,SCH_X,h/2,z,w,h,15);                           // 主体
      b.box(0xb6b1a2,SCH_X,h+.35,z,w+.5,.7,15.5);                   // 女儿墙
      for(let f=0;f<3;f++){
        const fy=1.9+f*3.4;
        b.box(0x9aa39c,SCH_X-w/2-.05,fy-.95,z,.12,.18,15);          // 外走廊栏板
        b.box(0xdad5c6,SCH_X-w/2-.6,fy-1.5,z,1.3,.18,15);           // 外走廊楼板
        for(let dz=-6.2;dz<=6.2;dz+=1.55){                           // 横向长窗
          b.box(0x5b7480,SCH_X-w/2+.02,fy,z+dz,.07,1.5,1.32);
          b.box(0xe6e2d4,SCH_X-w/2+.01,fy+.86,z+dz,.09,.16,1.4);
        }
      }
      if(seg===1){for(let f=0;f<3;f++)b.box(0x8f8a7d,SCH_X-w/2-1.3,1.9+f*3.4,z+7.4,1.5,3.2,.3);}  // 楼梯间
    }
    b.box(0xb9b3a4,SCH_X-9.5,1.6,20,3.6,3.2,5);                      // 器材间
    b.box(0x7d786c,SCH_X-9.5,3.35,20,4,.35,5.4);
    b.box(0x4e5a52,SCH_X-11.35,1.5,20,.12,2.4,1.6);
    for(let i=0;i<(M?4:7);i++)tree(s,b,SCH_X-13.5+R()*3,-24+i*9+R()*3,i%3?"street":"palm",.85+R()*.3);

    /* ---- 铁丝网:只在校园一侧与两端,海那侧留给防波堤 ---- */
    const FX=10.6,FZ0=-15.5,FZ1=26,FH=4.0;
    const post=(x,z)=>b.box(0x6c7169,x,FH/2,z,.10,FH,.10);
    for(let z=FZ0;z<=FZ1;z+=2.6)post(FX,z);
    for(const y of [FH,FH*.52,.16])b.box(0x7e837a,FX,y,(FZ0+FZ1)/2,.07,.07,FZ1-FZ0);
    for(const z of [FZ0,FZ1]){
      for(let x=-FX;x<=FX;x+=2.6)post(x,z);
      for(const y of [FH,FH*.52,.16])b.box(0x7e837a,0,y,z,FX*2,.07,.07);
    }
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
    panel(FX*2,FH,0,FH/2,FZ0,0);panel(FX*2,FH,0,FH/2,FZ1,0);
    cage.name="shonanFence";s.root.add(cage);s.cage=cage;

    /* ---- 电车:两节编成,湘南色(JR 的橘+绿)。间隔发车,不是连续跑 ---- */
    const trainG=new THREE.Group();
    const tb=batch(),CAR=17.4,GAP=.7;
    for(let c=0;c<2;c++){
      const z0=c*(CAR+GAP);
      tb.box(0xd8d4c6,0,2.05,z0,2.9,3.0,CAR);                        // 车体上段(米白)
      tb.box(0xe07b28,0,1.42,z0,2.94,1.05,CAR+.02);                  // 湘南橘
      tb.box(0x2f6b3f,0,.72,z0,2.94,.62,CAR+.02);                    // 湘南绿
      tb.box(0x394046,0,.30,z0,2.6,.5,CAR-1.2);                      // 底架
      for(const dz of [-CAR/2+.9,CAR/2-.9])                          // 转向架
        for(const dx of [-1.1,1.1])tb.add("blob",0x22262a,dx,.34,z0+dz,.36,.34,.36);
      for(let w=-CAR/2+2.1;w<CAR/2-1.4;w+=2.35)                      // 侧窗
        for(const dx of [-1.47,1.47])tb.box(0x4a6b78,dx,2.35,z0+w,.04,1.15,1.55);
      tb.box(0x3d5a66,0,2.35,z0-CAR/2-.01,2.2,1.2,.05);              // 端面窗
      tb.box(0x9aa0a4,0,3.58,z0,1.5,.16,CAR-3);                      // 车顶设备
      tb.box(0x6d7378,0,3.95,z0+CAR*.28,.9,.62,.10);                 // 受电弓
    }
    tb.finish(trainG,"shonanTrain");
    trainG.position.set(RAIL_X,0,120);trainG.visible=false;s.root.add(trainG);
    /* ⚠ 发车间隔必须**构建期**预生成:world-places.test.mjs 断言环境动画期间
       Math.random 调用数为 0,在 update 里摇随机数会直接把那条测试打红。 */
    const gaps=[];for(let i=0;i<6;i++)gaps.push(16+R()*22);
    s.train={g:trainG,t:-(4+R()*8),gaps,gi:0,speed:19,from:118,to:-132,len:CAR*2+GAP};

    /* ---- 远景:小岛与远山(压在海平线上,不抢锚点)---- */
    for(let i=0;i<3;i++){
      const x=SEA_X-30-i*26,z=-64-i*14,h=5+i*3.5;
      b.add("blob",0x6d7f86,x,h*.4,z,10+i*5,h,7+i*3);
      b.add("blob",0x5d6f76,x+6,h*.3,z+5,6,h*.6,5);
    }
    b.add("blob",0x7c8b8a,SEA_X-30,1.6,-34,5.5,2.4,4);               // 近处小岛
    b.add("blob",0x50624f,SEA_X-30,2.9,-34,3.4,1.1,2.6);
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
      const ty=t*2.6,tx=11.8+t*7;   // 15 太远进不了画框;拉到 11.8 让白墙参与构图
      b.box(0xd8cdb3,tx+3,ty*.5,6,12,ty+.3,64);            // 挡土台
      for(let i=0;i<(M?4:6);i++){
        const z=-16+i*11+R()*4,h=3.4+R()*2.6;
        house(tx,ty,z,7+R()*2.4,h,8+R()*2,R()<.7);
      }
      /* 石阶:每级台地之间 */
      for(let k=0;k<7;k++)b.box(0xcfc3a8,tx-5.4-k*.5,ty-k*.36,-2+R()*2,.9,.36,2.6);
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
    const b=batch();({outdoorSunny:city,rainyCourt:rainTown,flowerCourt:village,shonanCoast:shonan,medCliff:med,beachSunset:coast})[name](s,b);themeHoops(s,b);b.finish(root,`placeArchitecture:${name}`);clouds(s);makeBirdPool(s);
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
    /* 地面材质:雨天与峡谷都该是"湿"的,需要水膜反光;晴天街头/海边是干的水泥旧涂层。
       峡谷 clearcoat 给得比雨天更高 —— 石缝积水在顶部天光下形成明显的湿润高光,
       这正是"湿漉漉"的观感来源。但 envMapIntensity 仍压到 .04:反射只靠这一层薄水膜,
       不走环境贴图,避免重新引入此前那种大面积洗白过曝。 */
    const tex=surface(name),m=courtFloor.material;courtFloor.userData.placeTexture=tex;m.map=tex;m.color.setHex(0xffffff);m.roughnessMap=null;
    /* 湘南是旧水泥外场:干、亚光、几乎不反光(文档"偏旧但干净") */
    m.roughness=name==="rainyCourt"?.62:(name==="flowerCourt"?.55:(name==="shonanCoast"?.92:(name==="medCliff"?.88:.95)));
    m.clearcoat=name==="rainyCourt"?.12:(name==="flowerCourt"?.38:0);
    if(m.clearcoatRoughness!==undefined)m.clearcoatRoughness=(name==="rainyCourt"||name==="flowerCourt")?.22:.5;
    m.envMapIntensity=.04;m.needsUpdate=true;
    scene.traverse(o=>{if(["courtZone","courtLine","courtMark","nearCourtCrowdRoot"].includes(o.name)){o.userData.placeHidden=o.visible;o.visible=false;}});
    document.documentElement.dataset.worldPlace=name;return s;
  }
  function update(dt,progress){
    const s=environmentRoot.userData.placeState;if(!s)return;s.time+=dt;
    s.plants.forEach(p=>{const t=s.time,phase=p.phase;p.pivot.rotation.z=(Math.sin(t*.8+phase)+.32*Math.sin(t*1.73+phase*2))*p.amp;p.pivot.rotation.x=Math.sin(t*.61+phase)*p.amp*.55;});
    /* 瀑布:每股的 3 段等距循环下落。段高 6 大于间距(h/3),首尾始终重叠,
       所以读起来是一股连续的水柱,不会看出"一整块在上下平移"。 */
    /* ⚠ 必须叠上 jt.base:峡谷瀑布是**两级**的,主瀑从岩台(y=22)落到崖顶(y=52),
       次级瀑才从水潭(y=2.2)起。漏掉 base 会把主瀑整条画到地面 0~30 处,
       被水潭和崖体挡死 —— 画面上只剩次级瀑的几道细线,看起来像"瀑布没做出来"。 */
    if(s.waterfall)s.waterfall.forEach((jt,j)=>{
      const off=(s.time*(2.2+j*.34))%1;
      jt.segs.forEach((m,k)=>{m.position.y=(jt.base||0)+jt.h*(1-((k/jt.segs.length+off)%1));});
    });
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
        const z=tr.from-tr.t*tr.speed;
        if(z<tr.to){tr.g.visible=false;tr.t=-tr.gaps[tr.gi++%tr.gaps.length];}
        else{tr.g.visible=true;tr.g.position.z=z;}
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
