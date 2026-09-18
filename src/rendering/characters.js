/* ---------------- voxel characters: player avatar & passer ---------------- */
/* 高精度体素球员:在保留原动画 pivot 偏移(髋0.78/大腿0.34/小腿0.32/肩1.36...)的前提下细分方块 */
const VOXEL_HEAD_SCALE=new URLSearchParams(location.search).get("head")==="classic"?1:.86;
const VOXEL_HEAD_PIVOT_Y=1.45;
const VOXEL_SHOULDER_X=.285;
const VOXEL_HIP_X=.125;
/* 头发的旋转支点高度(headRoot 局部坐标,与发块同一套绝对坐标)。
   ⚠ 原来 hairGrp 直接挂 headRoot,pivot 落在 (0,0,0) —— 那是**脚底**,
     而发块在 y≈1.79,力臂约等于整个身高:
       1.79 × sin(3°) × 0.86(headRoot 缩放) ≈ 8.0 cm
     跑动晃动实测约 3.9°,足已让发冠横移 8cm —— 这就是发根错位/穿头的根因。
   把支点抬到头顶(1.78)后,发块相对支点只剩 ~0.01~0.27m,
   同样角度的横移降到毫米级。 */
const HAIR_PIVOT_Y=1.78;
const CHARACTER_TEXTURE_CACHE=new Map();
/* One closed tank-top shell. Front/back panels share an outline, with sewn side gussets.
   UVs preserve the existing 72-unit jersey artwork and left-handed number mirroring. */
function jerseyPanelGeometry(){
  // 运动人体工学剪裁: 弧形挖肩、收腰微展、下摆自然放量
  const outline=[
    [-.222,-.26],[.222,-.26],[.232,-.14],[.226,-.04],[.228,.08],[.234,.16],[.238,.30],
    [.108,.30],[.085,.20],[0,.155],[-.085,.20],[-.108,.30],
    [-.238,.30],[-.234,.16],[-.228,.08],[-.226,-.04],[-.232,-.14]
  ];
  const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y))),flat=new THREE.ShapeGeometry(shape).toNonIndexed();
  const pos=[],uv=[],groups=[];
  for(const back of [false,true]){
    const start=pos.length/3,a=flat.attributes.position;
    for(let i=0;i<a.count;i+=3)for(const j of back?[0,2,1]:[0,1,2]){
      const x=a.getX(i+j),y=a.getY(i+j),z=(back?-1:1)*(.124+.008*Math.cos(y*5));
      pos.push(x,y,z);uv.push(back?.5-x/.5:.5+x/.5,.5+y/.52);
    }
    groups.push({start,count:pos.length/3-start,materialIndex:back?5:4});
  }
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length],start=pos.length/3;
    for(const [p,back] of [[a,false],[a,true],[b,true],[a,false],[b,true],[b,false]]){
      const z=(back?-1:1)*(.124+.008*Math.cos(p[1]*5));pos.push(p[0],p[1],z);uv.push(back?0:1,(p[1]+.26)/.52);
    }
    groups.push({start,count:6,materialIndex:Math.abs(a[0])>.21&&Math.abs(b[0])>.21?1:0});
  }
  flat.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  groups.forEach(g=>geo.addGroup(g.start,g.count,g.materialIndex));geo.computeVertexNormals();geo.computeBoundingSphere();geo.name='tailoredJerseyPanels';return geo;
}
/* ---------------- 角色接地影 ----------------
   球有 blob 假影,角色一个都没有 —— 人就像贴在地板上,这才是"没有落地感"的直接来源。

   v2.19.9 时这是**唯一**的影子:那会儿场景刻意平光,开 shadowMap 也读不出来(实测
   开关两图平均像素差 1.21/255)。v2.20 重排灯光、有了压过其它所有灯的顶部主光之后,
   真实阴影才终于有东西可投,已经在 core.js 打开。

   两者现在是分工,不是重复:
     真实阴影 —— 有方向、随姿势变形,只在主光锥覆盖的范围内有
     这层软影 —— 降到三成强度当接触遮蔽(AO)用,并且覆盖锥外的角色(替补/传球人)
   开着真实阴影还留满强度的软影,脚下会出现两层黑,所以下面按 SHADOWS 折算。

   影子挂在**场景层**而不是角色下面:角色的 g.position.y 会随呼吸/起伏/起跳变化,
   做成子节点的话影子会跟着飘起来。 */
/* 0.62→0.95。改成顶部灯阵之后,地面投影被拆成几个方向、每盏又压得很低,
   实测地面阴影平均深度只剩 2.4/255 —— 单独看几乎读不出"人站在地上"。
   这正好对应真实球馆的样子:**脚下是一团模糊的圆影,而不是一条有方向的投影**,
   所以落地感主要由这层无方向的软圆斑承担,把它提到接近满强度。
   灯阵那几层极淡的方向影仍然保留,它们负责"光是从上面多个方向来的"这个读感。 */
const GROUND_SHADOW_SCALE=(typeof SHADOWS!=="undefined"&&SHADOWS)?.95:1;
/* 角色自阴影开关。自阴影是最吃 shadow map 分辨率的一项：512 的图上，手臂压在
   躯干上的那条影容易退化成噪点或整片糊黑。真机上用 ?selfshadow=0 单独关掉它
   （地面投影保留），就能一眼看出这一层值不值那点开销。 */
const SHADOW_RECEIVE=!(typeof location!=="undefined"&&/(\?|&)selfshadow=0(&|#|$)/.test(location.search));
const GROUND_SHADOWS=[];
let groundShadowGeo=null,groundShadowMat=null;
function groundShadowAssets(){
  if(groundShadowMat)return;
  const c=document.createElement("canvas");c.width=c.height=64;
  const g2=c.getContext("2d");
  const grd=g2.createRadialGradient(32,32,2,32,32,31);
  grd.addColorStop(0,"rgba(0,0,0,0.62)");
  grd.addColorStop(0.55,"rgba(0,0,0,0.28)");
  grd.addColorStop(1,"rgba(0,0,0,0)");
  g2.fillStyle=grd;g2.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(c);
  groundShadowGeo=new THREE.PlaneGeometry(1,1);
  groundShadowMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
}
function attachGroundShadow(o){
  groundShadowAssets();
  /* 几个角色共用同一张软影贴图，但材质必须各自一份：起跳时每个人的
     透明度要按自己的高度衰减，不能再用“只摊大、不变淡”的假反馈。 */
  const m=new THREE.Mesh(groundShadowGeo,groundShadowMat.clone());
  m.material.opacity=groundShadowMat.opacity*GROUND_SHADOW_SCALE;
  m.userData.groundShadowBaseOpacity=m.material.opacity;
  m.rotation.x=-Math.PI/2;m.position.y=0.014;m.renderOrder=-1;
  scene.add(m);
  o.groundShadow=m;GROUND_SHADOWS.push(o);
  return m;
}
/* 把角色的每个网格标成投影体。castShadow 在 three 里**不沿层级继承**,必须逐个网格设。
   装备、发型、胡子都是创建之后才挂上去的,创建时扫一遍盖不全 —— 所以下面每 15 帧
   重扫一次(4 个角色 × 约 40 个节点,一秒 4 次,可以忽略)。 */
function markShadowCasters(o){
  if(!o||!o.g)return;
  let n=0;
  /* castShadow 和 receiveShadow 在 three 里都**不沿层级继承**，必须逐个网格设。
     之前只设了 castShadow：角色只往地面投影，自己不接收任何阴影，
     于是手臂压在躯干上、头压在脖子上、头发压在额头上的暗部一个都没有 ——
     这是"角色像塑料/贴纸"的直接来源，比材质和灯光都更影响体积感。
     补上 receiveShadow 之后角色既投影也接影，多人场景里彼此的影子也会落在对方身上。 */
  o.g.traverse(m=>{if(m.isMesh||m.isInstancedMesh){m.castShadow=true;m.receiveShadow=SHADOW_RECEIVE;n++;}});
  o._shadowNodes=n;
}
let _shadowScanTick=0;
/* 逐帧同步。离地越高影子越摊开、越淡，并沿主光相反方向轻微偏移。 */
function updGroundShadows(){
  if(GROUND_SHADOW_SCALE<1&&(++_shadowScanTick%15===0))
    for(let i=0;i<GROUND_SHADOWS.length;i++)markShadowCasters(GROUND_SHADOWS[i]);
  for(let i=0;i<GROUND_SHADOWS.length;i++){
    const o=GROUND_SHADOWS[i],m=o.groundShadow;
    if(!m)continue;
    if(!o.g||!o.g.visible){m.visible=false;continue;}
    m.visible=true;
    const height=Math.max(0,Number(o.g.position.y)||0);
    const k=1+height*0.85;
    const lightX=typeof sun!=="undefined"&&sun&&Number.isFinite(sun.position.x)?sun.position.x:7;
    const lightZ=typeof sun!=="undefined"&&sun&&Number.isFinite(sun.position.z)?sun.position.z:8;
    const lightLen=Math.hypot(lightX,lightZ)||1;
    const shadowLength=Math.min(.42,height*.12);
    const shadowX=-lightX/lightLen*shadowLength;
    const shadowZ=-lightZ/lightLen*shadowLength;
    m.position.set(o.g.position.x+shadowX,0.014,o.g.position.z+shadowZ);
    /* 影子纵向比横向多拉开一点，配合光源偏移读出“跳起来了”，但仍保持
       体素风的软圆轮廓。 */
    m.scale.set(1.16*k,1.16*(1+height*.98),1);
    const baseOpacity=Number(m.userData.groundShadowBaseOpacity)||.35;
    const fade=Math.max(.18,1-height/3.4);
    m.material.opacity=baseOpacity*(.30+.70*fade);
    m.userData.groundShadowHeight=height;
    m.userData.groundShadowOpacity=m.material.opacity;
    m.userData.groundShadowOffset=[shadowX,shadowZ];
  }
}

function voxelGuy(){
  const detail=window.AIBAModelDetail;
  const detailOn=!!(detail&&detail.enabled);
  const g=new THREE.Group();
  const mS=new THREE.MeshLambertMaterial({color:0xf4c89c});  // 皮肤
  mS.color.convertSRGBToLinear(); // match the sRGB face map, including hands and joint blends
  const mJ=new THREE.MeshLambertMaterial({color:0x2fae4a});  // 球衣
  const mP=new THREE.MeshLambertMaterial({color:0x1c1c1c});  // 短裤/配色
  const mSole=new THREE.MeshLambertMaterial({color:0xf3f3f3});// 鞋底
  const mSock=new THREE.MeshLambertMaterial({color:0xf3f3f3});// 袜/鞋舌
  const mLace=new THREE.MeshLambertMaterial({color:0x1a1a1a});// 鞋带
  const hairMat=new THREE.MeshLambertMaterial({color:0x222222});
  const beardMat=new THREE.MeshLambertMaterial({color:0x222222});
  const mCompTight=new THREE.MeshLambertMaterial({color:0x151821}); // 紧身安全打底裤/高弹压缩面料
  const roundedBoxGeometry=(w,h,d,r,segments)=>{
    const geometry=new THREE.BoxGeometry(w,h,d,segments||3,segments||3,segments||3);
    const position=geometry.attributes.position,innerX=w*.5-r,innerY=h*.5-r,innerZ=d*.5-r;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const qx=Math.max(-innerX,Math.min(innerX,x));
      const qy=Math.max(-innerY,Math.min(innerY,y));
      const qz=Math.max(-innerZ,Math.min(innerZ,z));
      const dx=x-qx,dy=y-qy,dz=z-qz,length=Math.hypot(dx,dy,dz)||1;
      position.setXYZ(i,qx+dx*r/length,qy+dy*r/length,qz+dz*r/length);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();return geometry;
  };
  const mk=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const soft=(w,h,d,m,r,segments)=>new THREE.Mesh(roundedBoxGeometry(w,h,d,r,segments||2),m);
  const add=(p,w,h,d,m,x,y,z)=>{const b=mk(w,h,d,m);b.position.set(x,y,z);p.add(b);return b;};
  const addSoft=(p,w,h,d,m,x,y,z,r,segments)=>{const b=soft(w,h,d,m,r,segments);b.position.set(x,y,z);p.add(b);return b;};
  const round=(p,rx,ry,rz,m,x,y,z)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),m);b.scale.set(rx,ry,rz);b.position.set(x,y,z);p.add(b);return b;};
  // Eight-sided shoe cross-sections; each adjacent ring shares its edge.
  // Coordinates are ankle-local. Heel and toe are separate only at the flex pivot.
  const shoeLoft=sections=>{
    const points=[],indices=[];
    for(const [z,w,bottom,top] of sections){
      const bevel=Math.min(.012,(top-bottom)*.22);
      for(const [x,y] of [[-w+.012,bottom],[-w,bottom+bevel],[-w,top-bevel],[-w+.012,top],[w-.012,top],[w,top-bevel],[w,bottom+bevel],[w-.012,bottom]])points.push(x,y,z);
    }
    for(let j=0;j<sections.length-1;j++)for(let k=0;k<8;k++){
      const a=j*8+k,b=j*8+(k+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);
    }
    for(let k=1;k<7;k++){indices.push(0,k+1,k);const a=(sections.length-1)*8;indices.push(a,a+k,a+k+1);}
    for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
  };
  const legs=[],knees=[],ankles=[],footRoots=[],toeRoots=[],arms=[],elbows=[],upperArms=[],forearms=[],shoes=[],wrists=[],sleeves=[],palms=[],thumbs=[],thumbRoots=[],thumbTips=[],handRoots=[],fingerJoints=[],fingerPipJoints=[],fingerDipJoints=[],ballGrips=[];
  const hipBlends=[],kneeBlends=[],ankleBlends=[],elbowBlends=[],wristBlends=[];
  // ---- 腿 ----
  [-VOXEL_HIP_X,VOXEL_HIP_X].forEach(x=>{
    const lg=new THREE.Group();lg.position.set(x,0.78,0);     // 髋 pivot
    const hipBlend=addSoft(lg,0.208,0.23,0.228,mP,0,-0.075,0,.038,3);
    hipBlend.name="hipBlend";                                 // 髋关节藏在短裤内并与骨盆重叠
    if(detailOn)detail.profile(hipBlend,1.10,0.94,1.08,0.95);  // A字微阔弧度剪裁：裤筒自然向下微展，打破生硬直筒方块
    const sideSign=Math.sign(x||1);
    // 球裤侧边弧形队色条与圆弧V形开叉 (Curved V-notch slit piping)
    const slitTrim=add(lg,0.012,0.155,0.215,mJ,sideSign*0.103,-0.118,0.004);
    slitTrim.name="shortsSideStripe";
    if(detailOn)detail.profile(slitTrim,1.12,0.94,1.08,0.95);
    // 球裤裤脚微展立体滚边 (3D Contoured Hem Roll)
    const hemRoll=addSoft(lg,0.216,0.016,0.236,mJ,0,-0.19,0,.005,2);
    hemRoll.name="shortsHemRoll";
    // 现代篮球标配内外层次：球裤下沿自然微露出一段高弹紧身安全打底裤 (Compression Slider Tights)
    const sliderTight=addSoft(lg,0.168,0.045,0.185,mCompTight,0,-0.208,0,.010,2);
    sliderTight.name="shortsSliderTight";
    addSoft(lg,0.158,0.21,0.175,mS,0,-0.255,0,.018,3);          // 大腿伸入膝关节包
    const kn=new THREE.Group();kn.position.y=-0.34;           // 膝 pivot
    const kneeBlend=addSoft(kn,0.148,0.12,0.158,mS,0,-0.018,0,.025,3);
    kneeBlend.name="kneeBlend";                               // 随小腿转动并包住大腿末端
    // Patella is part of the knee silhouette, never a second protruding pad.
    const calf=addSoft(kn,0.15,0.255,0.165,mS,0,-0.165,0,.018,3);
    calf.name="calf";if(detailOn)detail.profile(calf,.82,1,.88,1);
    addSoft(kn,0.165,0.095,0.18,mSock, 0,-0.295,0.006,.024,2).name="legacySock";// 袜子
    add(kn,0.165,0.009,0.181,mJ, 0,-0.257,0.006).name="legacySock";              // 袜口队色细条
    addSoft(kn,0.166,0.012,0.18,mSock,0,-0.247,0.006,.004,2).name="legacySock"; // 袜口外翻(在小腿上留暗边)
    add(kn,0.165,0.018,0.18,mP, 0,-0.322,0.008).name="legacySock";              // 袜底暗线
    const ank=new THREE.Group();ank.position.y=-0.32;         // 踝 pivot
    /* 脚部拆成 ankle -> foot -> toe：踝关节负责小腿末端的补偿，foot 负责
       整体承重，toe 负责前脚掌蹬地。现有鞋面继续挂在 foot，保留旧外观。 */
    const foot=new THREE.Group();foot.name="footRig";ank.add(foot);
    const toe=new THREE.Group();toe.name="toeJoint";toe.position.set(0,-.105,.045);foot.add(toe);
    addSoft(ank,0.205,0.055,0.27,mSole, 0,-0.085,0.005,.016,2);// 鞋底主体
    round(ank,.103,.028,.09,mSole,0,-.085,.15);               // 收圆的前掌鞋底
    const sh=soft(0.19,0.11,0.23,new THREE.MeshLambertMaterial({color:0xffffff}),.032,3); // 鞋面(可染色,shoes[])
    sh.position.set(0,-0.02,0.015);ank.add(sh);
    round(ank,.094,.043,.085,sh.material,0,-.037,.155);        // 圆润鞋头(随鞋面色)
    addSoft(ank,0.178,0.12,0.10,sh.material,  0,-0.005,-0.115,.024,2); // 鞋跟(随鞋面色)
    add(ank,detailOn?.016:.045,detailOn?.050:.082,detailOn?.14:.185,mLace,detailOn?-.091:-.078,-0.01,0.03);
    add(ank,detailOn?.016:.045,detailOn?.050:.082,detailOn?.14:.185,mLace,detailOn?.091:.078,-0.01,0.03);
    round(ank,.072,.014,.06,mSole,0,-.006,.19);               // 鞋头高光边
    addSoft(ank,0.12,0.10,0.075,mSock, 0,0.03,-0.015,.018,2); // 鞋舌
    add(ank,0.10,0.04,0.11,mLace, 0,0.052,0.04);              // 鞋带
    add(ank,0.12,0.022,0.028,mLace, 0,0.078,0.09);            // 鞋带 2
    add(ank,0.21,0.028,0.25,mSole, 0,-0.052,0.005);           // 中底白条主体
    round(ank,.105,.015,.085,mSole,0,-.052,.15);              // 中底圆头
    /* 把已经生成的鞋部件重新挂到 foot，再把前掌相关部件移进 toe。
       这样不改变原有网格尺寸/材质，只改变旋转支点。位置换算为 toe 的
       parent-local，避免重挂载后出现鞋头跳位。 */
    const shoeParts=ank.children.slice();
    shoeParts.forEach(child=>{if(child!==foot)foot.add(child);});
    const toeParts=[shoeParts[2],shoeParts[4],shoeParts[8],shoeParts[9],shoeParts[10],shoeParts[11],shoeParts[13]];
    toeParts.forEach(child=>{
      if(!child)return;
      child.position.y-=toe.position.y;child.position.z-=toe.position.z;toe.add(child);
    });
    if(detailOn){
      // Replace the two lace slabs, leaving the foot/toe pivots and sole envelope intact.
      [shoeParts[8],shoeParts[10],shoeParts[11]].forEach(m=>{m.parent.remove(m);m.geometry.dispose();});
      const kit=new THREE.Group();kit.name="shoeLaces";kit.position.copy(toe.position).multiplyScalar(-1);toe.add(kit);
      for(let row=0;row<4;row++)for(const sign of [-1,1]){
        const lace=add(kit,.078,.009,.009,mLace,sign*.015,.083-row*.009,-.022+row*.026);
        lace.rotation.y=sign*.45;
      }
      // Replace old overlapping rounded blobs with a continuous, bevelled last.
      const reshape=(mesh,sections)=>{
        const geo=shoeLoft(sections),offset=new THREE.Vector3();
        // Mesh was already reparented into foot or toe; undo its local placement.
        if(mesh.parent===toe)offset.copy(toe.position);
        geo.translate(-mesh.position.x-offset.x,-mesh.position.y-offset.y,-mesh.position.z-offset.z);
        mesh.geometry.dispose();mesh.geometry=geo;mesh.scale.set(1,1,1);
      };
      reshape(shoeParts[1],[[-.135,.071,-.110,-.063],[-.09,.102,-.112,-.063],[.082,.103,-.112,-.063]]);
      reshape(shoeParts[2],[[.062,.103,-.112,-.063],[.17,.102,-.11,-.060],[.226,.077,-.101,-.061],[.24,.046,-.086,-.065]]);
      reshape(shoeParts[3],[[-.14,.067,-.065,.031],[-.09,.087,-.065,.041],[.026,.094,-.065,.044],[.098,.092,-.065,.026]]);
      reshape(shoeParts[4],[[.068,.093,-.065,.036],[.15,.093,-.064,.020],[.206,.076,-.064,-.004],[.225,.052,-.066,-.025]]);
      // The sole has its own thin sidewall; the old second midsole would intersect it.
      [shoeParts[12],shoeParts[13]].forEach(m=>{m.parent.remove(m);m.geometry.dispose();});
      shoeParts[5].scale.set(.95,.82,.75);
      // Heel counter is on the rear foot, never on the independently flexing toe.
      const counter=addSoft(foot,.17,.065,.021,mLace,0,.004,-.161,.006,2);counter.name="heelCounter";
    }
    const ankleBlend=addSoft(ank,0.158,0.13,0.145,mSock,0,0.035,-0.065,.036,3);
    if(detailOn&&new URLSearchParams(location.search).get("craft")!=="classic"){
      const sockKit=new THREE.Group();sockKit.name="sockKnit";ank.add(sockKit);
      for(let col=-2;col<=2;col++)add(sockKit,.006,.048,.006,mSole,col*.023,.055,.007);
      // Baked within a single ankle segment; same extents as the existing sock cuff.
      detail.batch(sockKit);
      const heelKit=new THREE.Group();heelKit.name="heelStitch";foot.add(heelKit);
      for(const side of [-1,1])for(let row=0;row<3;row++)
        add(heelKit,.006,.009,.042,mSole,side*.087,-.02+row*.019,-.119);
      detail.batch(heelKit);
    }
    ankleBlend.name="ankleBlend";                             // 袜筒与球鞋共同包住踝 pivot
    kn.add(ank);lg.add(kn);
    g.add(lg);legs.push(lg);knees.push(kn);ankles.push(ank);shoes.push(sh);
    footRoots.push(foot);toeRoots.push(toe);
    hipBlends.push(hipBlend);kneeBlends.push(kneeBlend);ankleBlends.push(ankleBlend);
  });
  // ---- 盆骨/短裤腰(填补躯干与腿之间) ----
  addSoft(g,0.445,0.16,0.25,mP,0,0.825,0,.025,3);
  // 立体松紧腰头与抽绳 (Elastic Drawstring Waistband)
  const waistband=addSoft(g,0.462,0.038,0.264,mP,0,0.885,0,.010,2);
  waistband.name="shortsWaistband";
  add(g,0.032,0.014,0.018,mLace,0,0.888,0.136); // 抽绳结
  const cordL=add(g,0.007,0.046,0.007,mLace,-0.012,0.862,0.138);cordL.rotation.z=0.08;
  const cordR=add(g,0.007,0.046,0.007,mLace,0.012,0.862,0.138);cordR.rotation.z=-0.08;
  if(!detailOn){
    add(g,0.52,0.05,0.29,mJ,0,0.98,0);
    add(g,0.42,0.035,0.28,mP,0,0.765,0);
  }
  // ---- 躯干 ----
  const bodyF=new THREE.MeshLambertMaterial({color:0xffffff});
  const bodyB=new THREE.MeshLambertMaterial({color:0xffffff});
  const body=new THREE.Mesh(detailOn?jerseyPanelGeometry():roundedBoxGeometry(0.5,0.52,0.27,.048,3),[mJ,detailOn?mP:mJ,mJ,mJ,bodyF,bodyB]);
  body.name="jerseyShell";
  body.position.y=1.13;g.add(body);
  if(detailOn){
    // The chest is visible inside the cut neckline; no floating collar or extra side strips.
    const chest=addSoft(g,.40,.15,.21,mS,0,1.315,0,.018,2);chest.name="jerseyNeckInset";
    // 3D立体领口螺纹包边与挖肩包边 (Physical Ribbed Collar & Armhole Piping)
    const collarTrim=addSoft(g,0.21,0.018,0.232,mP,0,1.375,0,.006,2);collarTrim.name="jerseyCollarTrim";
    for(const side of [-1,1]){
      const armPiping=addSoft(g,0.018,0.044,0.224,mP,side*0.234,1.365,0,.006,2);
      armPiping.name="jerseyArmPiping";
    }
  }else{
    add(g,0.045,0.43,0.21,mP,-0.255,1.13,0);
    add(g,0.045,0.43,0.21,mP, 0.255,1.13,0);
    add(g,0.035,0.40,0.285,mJ,-0.285,1.12,0);
    add(g,0.035,0.40,0.285,mJ, 0.285,1.12,0);
  }
  // The torso owns the neckline; no second rectangular collar block.
  if(!detailOn){
    add(g,0.19,0.05,0.29,mP, -0.105,1.34,0.006);
    add(g,0.19,0.05,0.29,mP,  0.105,1.34,0.006);
  }
  // Armhole piping is narrow and follows the tank silhouette.
  if(!detailOn)for(const side of [-1,1])addSoft(g,.018,.032,.205,mP,side*.224,1.364,0,.006,2);
  // Single cloth hem: no rigid waist slab underneath it.
  /* 下摆单独留一层很薄的布片，跑动时做低幅度二级弹簧；不参与身体/脚底解算，
     站定时回到零，避免把整件球衣当硬板。前后各一片是为了转身时仍能读到摆动。 */
  const jerseyHem=new THREE.Group();jerseyHem.name="jerseyHem";jerseyHem.position.y=.895;
  const jerseyHemFront=addSoft(jerseyHem,.453,.024,.009,mJ,0,0,.134,.004,2);
  const jerseyHemBack=addSoft(jerseyHem,.453,.024,.009,mJ,0,0,-.134,.004,2);
  jerseyHemFront.name="jerseyHemFront";jerseyHemBack.name="jerseyHemBack";g.add(jerseyHem);
  // ---- 脖子 + 头 ----
  const neckBlend=addSoft(g,0.155,0.12,0.155,mS,0,1.445,0,.036,3);
  neckBlend.name="neckBlend";                                // 与躯干和头部轻微重叠
  /* 头部与所有头饰共享同一挂点。以脖子顶端为支点缩放，避免小头版本出现悬空或配件错位。
     URL 加 ?head=classic 可恢复旧比例，用于快速 A/B 对照。 */
  const headRoot=new THREE.Group();
  headRoot.name="headRoot";
  headRoot.position.y=VOXEL_HEAD_PIVOT_Y*(1-VOXEL_HEAD_SCALE);
  headRoot.scale.setScalar(VOXEL_HEAD_SCALE);
  g.add(headRoot);
  const mFace=new THREE.MeshLambertMaterial({color:0xffffff});
  const head=new THREE.Mesh(roundedBoxGeometry(.34,.34,.34,.052,3),[mS,mS,mS,mS,mFace,mS]);
  head.position.y=1.62;headRoot.add(head);
  round(headRoot,.032,.054,.043,mS,-.177,1.605,.01);          // 左耳
  round(headRoot,.032,.054,.043,mS,.177,1.605,.01);           // 右耳
  round(headRoot,.035,.040,.027,mS,0,1.598,.174);             // 鼻
  add(headRoot,0.09,0.026,0.035,hairMat, -0.085,1.67,0.19);   // 立体左眉
  add(headRoot,0.09,0.026,0.035,hairMat,  0.085,1.67,0.19);   // 立体右眉
  add(headRoot,0.055,0.045,0.055,mS, -0.197,1.56,0.032);      // 耳垂
  add(headRoot,0.055,0.045,0.055,mS,  0.197,1.56,0.032);      // 耳垂
  /* 头发分三层,**支点抬到头顶**(见 HAIR_PIVOT_Y 的说明):
       hairBase  贴头皮(发际线/鬓角/后脑包覆/寸头) → 直接挂 headRoot,永不独立晃动
       hairGrp   外层/发梢                        → 经 hairPivot 绕头顶小幅摆
       hairTail  马尾/辫子/长发末端                → 绕头顶摆,幅度最大
     三者都用**同一套绝对坐标**(与原来一致),靠父节点 position 抵消,
     所以 setHair 里每个发块的数值一个都不用改。
     hairBase 不进 hairPivot,因此完全不受晃动影响 —— 发根永远不会漂。 */
  const hairBase=new THREE.Group();hairBase.name="hairBase";headRoot.add(hairBase);
  const hairPivot=new THREE.Group();hairPivot.name="hairPivot";
  hairPivot.position.y=HAIR_PIVOT_Y;headRoot.add(hairPivot);
  const hairGrp=new THREE.Group();
  hairGrp.position.y=-HAIR_PIVOT_Y;hairPivot.add(hairGrp);     // 抵消支点,保持绝对坐标
  const hairTail=new THREE.Group();
  hairTail.position.y=-HAIR_PIVOT_Y;hairPivot.add(hairTail);   // 同样抵消,摆幅另算
  const beardGrp=new THREE.Group();beardGrp.visible=false;headRoot.add(beardGrp); // 胡子
  // Four slim strips read as fabric around the head instead of an opaque slab through the face.
  const headband=new THREE.Group(),headbandMat=new THREE.MeshLambertMaterial({color:0xff4040});
  headband.material=headbandMat;headband.visible=false;
  add(headband,.35,.064,.035,headbandMat,0,1.70,.174);
  add(headband,.35,.064,.035,headbandMat,0,1.70,-.174);
  add(headband,.035,.064,.31,headbandMat,-.174,1.70,0);
  add(headband,.035,.064,.31,headbandMat,.174,1.70,0);
  headRoot.add(headband);
  /* Last Shot 的反应不再只有身体动作，给脸留一个轻量的可控覆盖层。
     默认隐藏，不改现有角色脸贴图；只在反应阶段显示“专注/惊讶/庆祝”眉眼嘴型，
     这样不会把普通站立和跑动状态染成夸张表情。 */
  const expressionInk=new THREE.MeshLambertMaterial({color:0x21150d});
  const faceExpressionRoot=new THREE.Group();faceExpressionRoot.name="faceExpression";faceExpressionRoot.visible=false;
  const expressionBrowL=add(faceExpressionRoot,.09,.018,.026,expressionInk,-.085,1.67,.196);
  const expressionBrowR=add(faceExpressionRoot,.09,.018,.026,expressionInk,.085,1.67,.196);
  const expressionMouth=add(faceExpressionRoot,.095,.018,.026,expressionInk,0,1.555,.196);
  headRoot.add(faceExpressionRoot);
  // ---- 手臂 ----
  [-VOXEL_SHOULDER_X,VOXEL_SHOULDER_X].forEach(x=>{
    const sh2=new THREE.Group();sh2.position.set(x,1.36,0);  // 肩 pivot
    // The upper arm enters the rounded deltoid at its widest section. Their nearly
    // matching cross-sections hide the old square ledge while keeping a voxel forearm.
    const shoulder=new THREE.Mesh(roundedBoxGeometry(.145,.19,.163,.028,3),mS);
    shoulder.name="shoulderBlend";shoulder.position.y=-.052;sh2.add(shoulder);
    const up=new THREE.Mesh(roundedBoxGeometry(.14,.29,.16,.018,3),mS);
    up.name="upperArm";up.position.y=-.165;sh2.add(up);
    if(detailOn)detail.profile(up,.94,1);
    const sl=new THREE.Mesh(roundedBoxGeometry(.148,.285,.168,.02,2),new THREE.MeshLambertMaterial({color:0x111111}));
    sl.position.y=-.19;sl.visible=false;sh2.add(sl);          // 贴身护臂(默认隐藏)
    const el=new THREE.Group();el.position.y=-0.32;          // 肘 pivot
    const elbowBlend=addSoft(el,0.129,0.105,0.147,mS,0,-0.015,0,.023,3);
    elbowBlend.name="elbowBlend";                            // 圆角肘包同时压住大臂和前臂
    const fo=soft(0.125,0.29,0.145,mS,.018,3);fo.position.y=-0.135;el.add(fo); // 前臂伸入肘包
    fo.name="forearm";if(detailOn)detail.profile(fo,.90,1);
    const wr=soft(0.14,0.06,0.155,new THREE.MeshLambertMaterial({color:0xffffff}),.018,2);
    wr.position.y=-0.27;wr.visible=false;el.add(wr);          // 护腕(默认隐藏)
    const handRoot=new THREE.Group();
    handRoot.name="handRig";handRoot.position.set(0,-.29,.01);el.add(handRoot); // 腕部 pivot
    const wristBlend=addSoft(handRoot,.12,.10,.105,mS,0,-.003,0,.032,3);
    wristBlend.name="wristBlend";                             // 随手掌旋转并与前臂交叠
    const palm=new THREE.Mesh(roundedBoxGeometry(.145,.135,.058,.024,3),mS);
    palm.name="palm";palm.position.set(0,-.055,0);handRoot.add(palm);            // 圆角扁矩形手掌
    /* 拇指在两手相对的内侧:投篮手(index 0)的拇指朝辅助手,
       辅助手(index 1)的拇指朝回球心。旧写法把拇指放在两手外侧,
       第一人称看起来就像两只手背同时顶球。 */
    const handSide=x<0?1:-1;
    /* Pose Lab 的手掌原点在 palm center、手指沿 +Y。游戏手模通过绕 local X
       旋转 PI 与之对齐，因此这里也把拇指根与子网格按同一基变换重建。 */
    const thumbRoot=new THREE.Group();
    thumbRoot.name="thumbMcp";
    thumbRoot.position.set(handSide*.075,-.061,-.018);thumbRoot.rotation.z=handSide*.70;handRoot.add(thumbRoot);
    /* 拇指按人类的两节外形拆开：掌指段 + 末节。thumbRoot 本身就是拇指根部
       关节，thumbTipRoot 是 IP 关节；跑步握拳时两节会一起向掌心收。 */
    const thumbProxLength=.045,thumbTipLength=.033;
    const thumb=addSoft(thumbRoot,0.038,thumbProxLength,0.042,mS,0,-thumbProxLength*.5,0,.010,2);
    thumb.name="thumb";
    const thumbTipRoot=new THREE.Group();
    thumbTipRoot.name="thumbIp";thumbTipRoot.position.y=-thumbProxLength;thumbRoot.add(thumbTipRoot);
    addSoft(thumbTipRoot,0.036,thumbTipLength,0.040,mS,0,-thumbTipLength*.5,0,.009,2).name="thumbTip";
    addSoft(thumbTipRoot,0.027,0.018,0.032,mS,0,-.004,0,.007,2).name="thumbJoint";
    thumbRoot.userData.aibaThumbChain={tip:thumbTipRoot};
    const fingerLengths=[.094,.108,.112,.100];
    const fingerRoots=[],pipRoots=[],dipRoots=[];
    [-1.5,-.5,.5,1.5].forEach((i,index)=>{
      const length=fingerLengths[index];
      const fingerRoot=new THREE.Group();
      /* palm center 在 handRoot local y=-.055；此坐标正是 Pose Lab 指根
         [x,+.073,+.015] 经 local-X PI 基变换后的精确位置。 */
      fingerRoot.name="fingerMcp";fingerRoot.position.set(i*.028,-.128,-.015);fingerRoot.rotation.x=-.08;
      /* 三节指骨：MCP(根节点) -> PIP(近端指间) -> DIP(远端指间)。长度沿用旧
         单段手指的总长度，只把弯曲分摊到三节，避免握拳时像一根硬棍折弯。 */
      const proximalLength=length*.44,middleLength=length*.33,distalLength=length-proximalLength-middleLength;
      const proximal=addSoft(fingerRoot,0.022,proximalLength,0.030,mS,0,-proximalLength*.5,0,.008,2);
      proximal.name="finger";
      const pipRoot=new THREE.Group();
      pipRoot.name="fingerPip";pipRoot.position.y=-proximalLength;fingerRoot.add(pipRoot);
      addSoft(pipRoot,0.023,0.018,0.031,mS,0,-.004,0,.007,2).name="fingerPipJoint";
      const middle=addSoft(pipRoot,0.021,middleLength,0.029,mS,0,-middleLength*.5,0,.007,2);
      middle.name="fingerMiddle";
      const dipRoot=new THREE.Group();
      dipRoot.name="fingerDip";dipRoot.position.y=-middleLength;pipRoot.add(dipRoot);
      addSoft(dipRoot,0.022,0.016,0.030,mS,0,-.003,0,.006,2).name="fingerDipJoint";
      const distal=addSoft(dipRoot,0.020,distalLength,0.028,mS,0,-distalLength*.5,0,.007,2);
      distal.name="fingerTip";
      fingerRoot.userData.aibaFingerChain={pip:pipRoot,dip:dipRoot};
      handRoot.add(fingerRoot);fingerRoots.push(fingerRoot);pipRoots.push(pipRoot);dipRoots.push(dipRoot);
    });
    const ballGrip=new THREE.Group();
    /* 持球锚点(= pBall 的父节点,也是物理出手点)。
       v2.19.3 起它属于投篮手 handRig，而不是肘节点的兄弟：蓄力末端球心来自
       3D Pose Lab 的 [-.106,1.8962,.3201]，在用户摆好的掌面四元数下反解为
       handRig 局部 [.012341,-.108954,-.193745]。因此伸肘与压腕期间球会连续随手
       前送，直到 releaseShot 真正读取 pBall 世界坐标后才脱手。 */
    ballGrip.name="ballGrip";ballGrip.position.set(.012341,-.108954,-.193745);handRoot.add(ballGrip);
    sh2.add(el);g.add(sh2);
    arms.push(sh2);elbows.push(el);upperArms.push(up);forearms.push(fo);wrists.push(wr);sleeves.push(sl);palms.push(palm);thumbs.push(thumb);thumbRoots.push(thumbRoot);thumbTips.push(thumbTipRoot);handRoots.push(handRoot);fingerJoints.push(fingerRoots);fingerPipJoints.push(pipRoots);fingerDipJoints.push(dipRoots);ballGrips.push(ballGrip);
    elbowBlends.push(elbowBlend);wristBlends.push(wristBlend);
  });
  const o={g,headRoot,jerseyHem,faceExpression:{root:faceExpressionRoot,brows:[expressionBrowL,expressionBrowR],mouth:expressionMouth},headScale:VOXEL_HEAD_SCALE,baseShoulderX:VOXEL_SHOULDER_X,baseHipX:VOXEL_HIP_X,
    legs,knees,ankles,footRoots,toeRoots,arms,elbows,upperArms,forearms,shoes,wrists,sleeves,palms,thumbs,thumbRoots,thumbTips,handRoots,fingerJoints,fingerPipJoints,fingerDipJoints,ballGrips,
    hipBlends,kneeBlends,ankleBlends,elbowBlends,wristBlends,neckBlend,headband,
    hair:hairGrp,hairGrp,hairMat,beardGrp,beardMat,mJ,mP,mS,bodyF,bodyB,mFace,hairStyle:"short",
    hairPivot,hairBase,hairTail};
  setHair(o,"short");
  attachGroundShadow(o);
  markShadowCasters(o);
  return o;
}
function setFaceExpression(o,mode){
  const fx=o&&o.faceExpression;if(!fx||!fx.root)return false;
  const name=String(mode||"neutral").toLowerCase();
  if(name==="neutral"||name==="none"){
    fx.root.visible=false;
    return true;
  }
  fx.root.visible=true;
  const browY=name==="shock"?.018:(name==="joy"?.006:-.006);
  const browTilt=name==="joy"?.12:(name==="shock"?-.04:-.10);
  fx.brows[0].position.y=1.67+browY;fx.brows[1].position.y=1.67+browY;
  fx.brows[0].rotation.z=browTilt;fx.brows[1].rotation.z=-browTilt;
  const mouth=fx.mouth;
  mouth.position.y=name==="shock"?1.545:1.555;
  mouth.scale.set(name==="shock"?1.18:(name==="joy"?1.25:1),name==="shock"?1.65:1,1);
  return true;
}
/* 发型:清空 hairGrp 重建,所有发块共享 hairMat */
function setHair(o,style,colorHex){
  if(colorHex!=null)o.hairMat.color.setHex(colorHex);
  const m=o.hairMat;
  /* 三层容器。B=贴头皮(永不晃) / S=外层(绕头顶小摆) / T=长发末端(摆幅最大) */
  const B=o.hairBase||o.hairGrp,S=o.hairGrp,T=o.hairTail||o.hairGrp;
  [B,S,T].forEach(G=>{
    while(G.children.length){
      const child=G.children[0];G.remove(child);
      if(child.geometry&&child.geometry.dispose)child.geometry.dispose();
    }
  });
  o.hairStyle=style;
  /* 辅助函数第一个参数是**目标层**,坐标语义与原来完全一致(绝对高度)。 */
  const box=(L,w,h,d,x,y,z,rx,ry,rz)=>{
    const geo=new THREE.BoxGeometry(w,h,d,4,4,4),pos=geo.attributes.position;
    const radius=Math.min(.018,w*.18,h*.18,d*.18);
    for(let i=0;i<pos.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(pos,i);
      const q=new THREE.Vector3(Math.max(-w/2+radius,Math.min(w/2-radius,v.x)),Math.max(-h/2+radius,Math.min(h/2-radius,v.y)),Math.max(-d/2+radius,Math.min(d/2-radius,v.z)));
      v.sub(q).normalize().multiplyScalar(radius).add(q);pos.setXYZ(i,v.x,v.y,v.z);
    }
    geo.computeVertexNormals();const b=new THREE.Mesh(geo,m);b.position.set(x,y,z);b.rotation.set(rx||0,ry||0,rz||0);L.add(b);return b;
  };
  const tuft=(L,rx,ry,rz,x,y,z)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(1,8,5),m);b.scale.set(rx,ry,rz);b.position.set(x,y,z);L.add(b);return b;};
  const lock=(L,r,h,x,y,z,rx,rz)=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(r*.72,r,h,6),m);b.position.set(x,y,z);b.rotation.set(rx||0,0,rz||0);L.add(b);return b;};
  if(style==="bald")return;
  if(style==="croppedCurls"){
    tuft(B,.176,.043,.176,0,1.786,0);
    for(const side of [-1,1])box(B,.035,.105,.255,side*.168,1.729,-.012);
    box(B,.29,.12,.04,0,1.72,-.17);
    for(let x=0;x<4;x++)for(let z=0;z<4;z++){
      const px=(x-1.5)*.078,pz=(z-1.5)*.078;
      tuft(B,.052,.031+.007*((x+z)%2),.052,px,1.81,pz);
    }return;
  }
  if(style==="sidepart"){
    tuft(B,.181,.065,.181,0,1.785,-.008);
    box(B,.32,.23,.055,0,1.675,-.163);
    for(const side of [-1,1])box(B,.045,.16,.27,side*.168,1.70,-.008);
    for(let i=0;i<5;i++)box(S,.085,.045,.29,-.12+i*.055,1.82-i*.008,.025,0,-.13,-.12);
    return;
  }
  if(style==="buzz"){
    /* 寸头整层贴着头皮 → 全部归 B,不参与任何晃动(原来整组晃就会浮起来) */
    tuft(B,.178,.040,.178,0,1.79,0);
    box(B,.30,.15,.045,0,1.70,-.169);
    box(B,.045,.14,.27,-.169,1.71,-.005);box(B,.045,.14,.27,.169,1.71,-.005);
    box(B,.25,.026,.045,0,1.772,.17);return;
  }
  if(style==="afro"){
    // A single scalp-connected silhouette, with small interlocking curls.
    // Older large stacked spheres read as a pile of buns above the forehead.
    tuft(B,.184,.095,.179,0,1.79,-.015);
    tuft(S,.238,.177,.220,0,1.88,-.015);
    for(let ring=0;ring<3;ring++){
      const count=ring===2?7:12,rad=[.21,.18,.105][ring],height=[1.83,1.94,2.015][ring];
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2+ring*.31,scale=.043+.006*Math.sin(i*2.3+ring);
        tuft(S,scale,.045,scale,Math.cos(angle)*rad,height+.008*Math.sin(i*1.7),Math.sin(angle)*rad-.015);
      }
    }
    return;
  }
  if(style==="cornrows"){
    box(B,.30,.12,.044,0,1.73,-.167);
    box(B,.032,.10,.27,-.172,1.74,-.008);box(B,.032,.10,.27,.172,1.74,-.008);
    for(let i=-2;i<=2;i++){
      const x=i*.065,curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(x,1.78,.17),new THREE.Vector3(x,1.91,-.01),new THREE.Vector3(x,1.72,-.18));
      const braid=new THREE.Mesh(new THREE.TubeGeometry(curve,16,.018,5,false),m);B.add(braid);
      for(let k=1;k<7;k++){const v=curve.getPoint(k/7);box(B,.032,.015,.027,v.x,v.y+.012,v.z,0,(k%2?1:-1)*.4,0);}
    }
    lock(T,.020,.19,-.10,1.64,-.195,-.10,-.05);lock(T,.020,.21,.10,1.63,-.195,.08,.05);return;
  }
  if(style==="ponytail"){
    /* 发冠、后脑、侧发、发际线全部贴头皮固定 —— 发根不漂是这一批的核心 */
    tuft(B,.18,.067,.18,0,1.785,0);
    box(B,.30,.21,.055,0,1.68,-.165);
    box(B,.055,.20,.29,-.165,1.69,0);box(B,.055,.20,.29,.165,1.69,0);
    box(B,.28,.038,.05,0,1.765,.17);
    tuft(B,.095,.10,.09,0,1.79,-.235);        // 扎发点(与头皮相连)
    /* 马尾三节 → T,越往下摆得越多 */
    lock(T,.074,.31,0,1.60,-.33,-.22,0);
    lock(T,.063,.27,.025,1.34,-.355,-.18,.08);
    tuft(T,.07,.075,.065,.045,1.18,-.37);return;
  }
  if(style==="bun"){
    tuft(B,.18,.065,.18,0,1.785,0);
    box(B,.30,.21,.055,0,1.68,-.165);
    box(B,.055,.20,.29,-.165,1.69,0);box(B,.055,.20,.29,.165,1.69,0);
    box(B,.28,.038,.05,0,1.765,.17);
    /* 丸子本体在头顶上方 → S,跟着晃但不影响发根 */
    tuft(S,.10,.088,.095,0,1.85,-.17);
    for(let i=0;i<5;i++)lock(S,.016,.13,(i-2)*.03,1.86,-.22,-.3,(i-2)*.15);return;
  }
  if(style==="flattop"){
    box(S,.355,.18,.355,0,1.88,0);box(B,.30,.20,.06,0,1.70,-.165);
    box(S,.34,.035,.34,0,1.99,0);box(B,.065,.20,.30,-.17,1.71,0);box(B,.065,.20,.30,.17,1.71,0);return;
  }
  // 默认 short / fade
  const sideH=style==="fade"?.14:.20,sideY=1.79-sideH*.5;
  tuft(B,.18,.073,.18,0,1.785,-.005);        // 圆润发冠(贴头皮,固定)
  box(B,.30,sideH,.055,0,sideY,-.168);        // 后脑包覆
  box(B,.055,sideH,.29,-.168,sideY,-.005);    // 左侧包覆
  box(B,.055,sideH,.29,.168,sideY,-.005);     // 右侧包覆
  box(B,.29,.025,.036,0,1.778,.169);           // 贴合发际
  // Swept, overlapping locks form one directional crown, with a restrained fringe.
  for(let i=0;i<6;i++){
    const x=-.135+i*.053;
    box(S,.068,.044,.24,x,1.812+(5-i)*.001,.018,-.045,-.08,-.06);
  }
  box(S,.065,.029,.055,-.11,1.78,.169,-.16,0,-.14);

}
/* 胡子:首次开启时构建,之后只切显隐 */
function setBeard(o,on,colorHex,style="full"){
  const G=o.beardGrp;G.visible=!!on;
  if(colorHex!=null)o.beardMat.color.setHex(colorHex).convertSRGBToLinear();
  if(!on)return;
  if(G.userData.style===style&&G.children.length)return;
  for(const child of [...G.children]){child.geometry.dispose();G.remove(child);}G.userData.style=style;
  const box=(w,h,d,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),o.beardMat);b.position.set(x,y,z);G.add(b);};
  box(.12,.018,.014,0,1.579,.177); // restrained upper lip, never across the mouth
  if(style==="moustache")return;
  if(style==="goatee"){
    box(.11,.055,.023,0,1.506,.172);for(const side of [-1,1])box(.022,.06,.018,side*.062,1.535,.177);return;
  }
  const full=style==="full";
  box(full?.28:.27,full?.14:.026,full?.09:.017,0,full?1.475:1.516,full?.162:.175);
  for(const side of [-1,1])box(full?.063:.028,full?.115:.085,full?.055:.015,side*.146,1.551,.167);
}

function faceTex(skinHex){
  const key="face:"+skinHex;
  if(CHARACTER_TEXTURE_CACHE.has(key))return CHARACTER_TEXTURE_CACHE.get(key);
  const c="#"+skinHex.toString(16).padStart(6,"0");
  const tex=pixTex(48,48,(g)=>{
    g.fillStyle=c;g.fillRect(0,0,48,48);
    g.fillStyle="rgba(0,0,0,.07)";g.fillRect(0,34,48,14);     // 下颌轻微暗部
    g.fillStyle="#1b120a";g.fillRect(9,16,10,3);g.fillRect(29,16,10,3);   // 眉
    g.fillStyle="#ffffff";g.fillRect(10,21,10,5);g.fillRect(28,21,10,5);   // 眼白
    g.fillStyle="#241308";g.fillRect(15,21,5,5);g.fillRect(33,21,5,5);  // 瞳
    g.fillStyle="rgba(0,0,0,.15)";g.fillRect(23,27,4,7);    // 鼻
    g.fillStyle="rgba(70,25,12,.7)";g.fillRect(17,39,15,3); // 嘴
  });
  CHARACTER_TEXTURE_CACHE.set(key,tex);return tex;
}
/* mirror:给左手球员用的预翻转版本。角色整体做了 scale.x=-1,号码会跟着左右翻,
   "13" 读成反的。先把贴图翻一次,几何再翻一次,最终就是正的。
   贴图缓存的 key 必须带上这个标志,否则左右手球员会互相拿到对方的号码。 */
function jerseyTex(base,trim,num,big,mirror){
  const key=["jersey",base,trim,num,big?1:0,mirror?1:0].join(":");
  if(CHARACTER_TEXTURE_CACHE.has(key))return CHARACTER_TEXTURE_CACHE.get(key);
  const c="#"+base.toString(16).padStart(6,"0"),t="#"+trim.toString(16).padStart(6,"0");
  const craft=new URLSearchParams(location.search).get("craft")!=="classic";
  const tex=pixTex(craft?144:72,craft?144:72,(g)=>{
    if(craft)g.scale(2,2);
    if(mirror){g.translate(72,0);g.scale(-1,1);}
    g.fillStyle=c;g.fillRect(0,0,72,72);
    g.fillStyle="rgba(255,255,255,.07)";g.fillRect(0,0,72,5);
    g.fillStyle="rgba(0,0,0,.05)";g.fillRect(0,65,72,7);
    g.fillStyle=t;g.fillRect(1,3,1,65);g.fillRect(70,3,1,65);
    if(craft){
      g.strokeStyle=t;g.lineWidth=1.3;g.beginPath();g.moveTo(9,0);g.lineTo(20,0);g.lineTo(24,11);g.lineTo(48,11);g.lineTo(52,0);g.lineTo(63,0);g.stroke();
      // Woven mesh, panel seams and stitched hem. Same UVs and mirrored numbers.
      g.fillStyle="rgba(0,0,0,.045)";
      for(let y=9;y<63;y+=3)for(let x=7+(y%2);x<66;x+=3)g.fillRect(x,y,.7,1);
      g.fillStyle="rgba(255,255,255,.10)";
      for(let y=9;y<61;y+=2){g.fillRect(5.5,y,.5,1);g.fillRect(66,y,.5,1);}
      g.fillStyle="rgba(0,0,0,.045)";g.fillRect(7,9,1,50);g.fillRect(64,9,1,50);
      g.fillStyle="rgba(255,255,255,.17)";g.fillRect(11,21,1,38);g.fillRect(60,21,1,38);
      g.fillStyle=t;g.fillRect(6,63,60,1);g.fillStyle="rgba(255,255,255,.3)";
      for(let x=8;x<64;x+=2)g.fillRect(x,65,.8,.5);
      if(!big){
        g.fillStyle="#e9e5d7";g.fillRect(10,11,5,6);g.fillRect(10,58,11,5);
        g.fillStyle="#263638";g.fillRect(11,59,2,3);g.fillRect(14,59,6,.7);g.fillRect(14,61,4,.5);
        g.fillStyle=t;g.fillRect(57,12,4,1);g.fillRect(59,10,4,1);
      }else{
        g.fillStyle=t;g.fillRect(25,11,22,2);g.fillRect(29,15,14,1);
      }
    }
    if(num===""||num==null)return;
    if(!big){g.fillStyle="rgba(255,255,255,.82)";g.font="bold 7px Orbitron, monospace";g.textAlign="center";g.fillText("aiBA",36,17);}
    g.font="bold "+(big?40:32)+"px Orbitron, monospace";g.textAlign="center";
    g.lineWidth=2.5;g.strokeStyle="rgba(0,0,0,.8)";
    g.strokeText(num,36,big?53:50);
    g.fillStyle="#fff";g.fillText(num,36,big?53:50);
  });
  CHARACTER_TEXTURE_CACHE.set(key,tex);return tex;
}
function dressGuy(o,jersey,shorts,num){
  const mir=!!(o&&o.lefty);
  // Canvas jersey maps are sRGB; solid cloth must enter lighting in the same space.
  // Otherwise the hem/sides become pale cyan beside a saturated blue chest.
  o.mJ.color.setHex(jersey).convertSRGBToLinear();o.mP.color.setHex(shorts).convertSRGBToLinear();
  o.bodyF.map=jerseyTex(jersey,shorts,num,false,mir);o.bodyF.color.setHex(0xffffff);o.bodyF.needsUpdate=true;
  o.bodyB.map=jerseyTex(jersey,shorts,num,true,mir);o.bodyB.color.setHex(0xffffff);o.bodyB.needsUpdate=true;
}
function applyStarStyle(guy,star){
  /* lefty 必须在 dressGuy **之前**定好:号码贴图要根据它决定用不用预翻转版本。 */
  guy.lefty=!!(window.AIBA_CONFIG&&window.AIBA_CONFIG.shootingHandFor
    &&window.AIBA_CONFIG.shootingHandFor(star)==="left");
  if(window.AIBABasketballShoes)AIBABasketballShoes.clear(guy);
  // Named players start from a fixed kit, never a random spectator outfit.
  guy.wrists.forEach(w=>{w.visible=false;});guy.sleeves.forEach(w=>{w.visible=false;});
  dressGuy(guy,star.col[0],star.shortsColor!=null?star.shortsColor:star.col[1],star.num);
  const body=window.AIBA_CONFIG&&window.AIBA_CONFIG.bodyProfileFor?window.AIBA_CONFIG.bodyProfileFor(star):null;
  const bodyH=body&&Number(body.h)||1,bodyW=body&&Number(body.w)||1;
  /* ---------------- 左手球员 ----------------
     整体沿局部 X 镜像。为什么可以这么干:three r128 的 renderBufferDirect 会检查
     matrixWorld.determinant()<0 并翻转正面绕序,所以背面剔除和光照都是对的 ——
     我上一轮把这条风险说大了。
     好处是**姿势代码一个字都不用改**:接球、蓄力侧身、出手、跟随、踢腿全部自动反过来,
     体验和右手完全对称。
     代价只有两个,下面各自处理:
       1) 世界偏航角(侧身/风格 turn)要取反 —— 它们在父坐标系里,不吃这个局部镜像
       2) 号码/脸贴图会左右翻(见 dressGuy 里的 lefty 分支) */
  guy.g.scale.set(guy.lefty?-bodyW:bodyW,bodyH,bodyW);guy.bodyProfile={h:bodyH,w:bodyW};
  /* 投篮动作风格挂在角色对象上,而不是每帧去查 G.myStar:
     对手/对位球员也是通过这条路拿到自己的风格,姿势代码因此完全不需要知道
     "谁是玩家" —— 百分大战里两边动作自然就不一样。 */
  guy.shotStyle=window.AIBA_CONFIG&&window.AIBA_CONFIG.shotStyleFor
    ?window.AIBA_CONFIG.shotStyleFor(star):null;
  if(star.skin!=null){
    guy.mS.color.setHex(star.skin).convertSRGBToLinear();
    guy.mFace.map=faceTex(star.skin);guy.mFace.color.setHex(0xffffff);guy.mFace.needsUpdate=true;
  }
  if(star.shoe!=null)guy.shoes.forEach(s=>s.material.color.setHex(star.shoe));
  if(star.headband){guy.headband.visible=true;guy.headband.material.color.setHex(star.headband);}
  else guy.headband.visible=false;
  if(star.wrist!=null)guy.wrists.forEach(w=>{w.visible=true;w.material.color.setHex(star.wrist);});
  if(star.sleeve!=null)guy.sleeves.forEach((s,i)=>{s.visible=i===(star.id==="a03"?0:1);s.material.color.setHex(star.sleeve);});
  const hc=star.hair!=null?star.hair:0x141414;
  setHair(guy, star.hairStyle||"short", hc);
  setBeard(guy, !!star.beard, (typeof star.beard==="number")?star.beard:hc,star.beardStyle||"full");
  if(window.AIBAPlayerKit)AIBAPlayerKit.apply(guy,star);
  /* 每个有名有姓的球星都按分配表拿到自己的品系+配色,袜子同源。
     分配由球员 id 和球衣主色确定，使用已确认的四款鞋和四组配色。
     同队球员可共享配色。没有分配表(旧版/自定义球星)时退回乔丹那双。 */
  const shoeFit=window.AIBAShoeColorways
    ?AIBAShoeColorways.forStar(star,typeof LEGENDS!=="undefined"?LEGENDS:null):null;
  guy.defaultBasketballShoe=shoeFit
    ?{length:.44,colorway:shoeFit.colorway,family:shoeFit.family,sock:shoeFit.sock,sockStripe:shoeFit.sockStripe}
    :((star.id==="j23"||new URLSearchParams(location.search).get("shoe")==="retro-high")?{colorway:"classicRedBlackWhite",length:.44}:null);
  if(window.AIBABasketballShoes&&guy.defaultBasketballShoe)AIBABasketballShoes.apply(guy,"RetroHigh",guy.defaultBasketballShoe);
}
function randomizeOutfit(o){
  o.defaultBasketballShoe=null;
  if(window.AIBABasketballShoes)AIBABasketballShoes.clear(o);
  if(window.AIBAPlayerKit)AIBAPlayerKit.clear(o);
  const pick=a=>a[(Math.random()*a.length)|0];
  const SC=[0xff4040,0xffffff,0x111111,0x00d0ff,0xffd23f,0xff8df0,0x7CFC6B];
  const BC=[0xff4040,0xffffff,0x111111,0xffd23f,0x00d0ff,0x9b59ff];
  const SK=[0xf4c89c,0xd9a878,0x9c6b43,0x6b4a2c];
  const skin=pick(SK);o.mS.color.setHex(skin).convertSRGBToLinear();
  o.mFace.map=faceTex(skin);o.mFace.color.setHex(0xffffff);o.mFace.needsUpdate=true;
  const sc=pick(SC);o.shoes.forEach(s=>s.material.color.setHex(sc));
  o.headband.visible=Math.random()<0.6;o.headband.material.color.setHex(pick(BC));
  o.wrists.forEach(w=>{w.visible=Math.random()<0.5;w.material.color.setHex(pick(BC));});
  o.sleeves.forEach((s,i)=>{s.visible=(i===1&&Math.random()<0.5)||(i===0&&Math.random()<0.12);
    s.material.color.setHex(pick([0x111111,0xeeeeee,0xce1141,0x1d428a]));});
  const hc=pick([0x222222,0x4a2c12,0x101010,0x5c4a1e,0x3a2410]);
  // 随机不出现光头(光头只留给指定明星如卡特),避免库里等被随机成光头
  const HS=["short","short","fade","fade","buzz","afro","cornrows","flattop"];
  setHair(o, pick(HS), hc);
  setBeard(o, Math.random()<0.3, hc);
}
// Non-roster actors use the same shoe assignment, without replacing their face or outfit.
function ensurePlayerShoeKit(){
  const star=(window.AIBASelectedStar&&AIBASelectedStar(LEGENDS,null))||G.myStar||LEGENDS[0];
  if(player&&star){G.myStar=star;G.myNum=star.num;window.applyStarStyle(player,star);}
}
function equipActorShoes(guy,id,jersey){
  if(!window.AIBAShoeColorways||!window.AIBABasketballShoes)return;
  const star={id,col:[jersey,jersey]};
  AIBABasketballShoes.clear(guy);
  if(window.AIBAPlayerKit)AIBAPlayerKit.apply(guy,star);
  guy.defaultBasketballShoe={length:.44,...AIBAShoeColorways.forStar(star)};
  AIBABasketballShoes.apply(guy,"RetroHigh",guy.defaultBasketballShoe);
}
const BENCH=[V3(-9.3,0,-5),V3(-9.3,0,-2.5),V3(-9.3,0,0)];
let player,pBall,passer,passerBall,oppPasser,oppPasserBall,rivals=[];
function buildCharacters(){
  player=voxelGuy();
  player.g.visible=false;scene.add(player.g);
  pBall=new THREE.Mesh(ballGeo,matBall);pBall.visible=false;player.g.add(pBall);
  passer=voxelGuy();
  passer.g.position.set(1.75,0,-6.85);passer.g.visible=false;scene.add(passer.g);
  passerBall=new THREE.Mesh(ballGeo,matBall);
  passerBall.position.set(0,1.12,0.32);passer.g.add(passerBall);
  oppPasser=voxelGuy();
  oppPasser.g.position.set(-1.75,0,-6.85);oppPasser.g.visible=false;scene.add(oppPasser.g);
  oppPasserBall=new THREE.Mesh(ballGeo,matBall);
  oppPasserBall.position.set(0,1.12,0.32);oppPasser.g.add(oppPasserBall);
  for(let i=0;i<3;i++){
    const rv=voxelGuy();rv.g.visible=false;rv.active=false;scene.add(rv.g);
    rv.ball=new THREE.Mesh(ballGeo,matBall);rv.ball.visible=false;rv.g.add(rv.ball);
    rivals.push(rv);
  }
  randomizeOutfit(player);randomizeOutfit(passer);randomizeOutfit(oppPasser);
  dressGuy(passer,0x6a727c,0x333a42,"");
  dressGuy(oppPasser,0x44546b,0x18202d,"");
  /* 递球员配色此后固定不变,按段烘焙掉上百次 draw call(玩家与对手保持全精度) */
  equipActorShoes(player,"player-default",0x202832);
  equipActorShoes(passer,"passer",0x6a727c);
  equipActorShoes(oppPasser,"opp-passer",0x44546b);
  bakeActorSegments(passer);
  bakeActorSegments(oppPasser);
}
/* ---------------- 背景 NPC 降级:按铰接段就地烘焙 ----------------
   方块球员由上百个纯色小方块拼成,每块一次 draw call。对于外观固定、永远不换配色的
   背景角色(递球员),可以把同一个铰接段(髋/膝/踝/肩/肘/躯干…)内的纯色方块烘焙成
   一个带顶点色的网格:段与段之间照常独立旋转,动画完全不受影响。
   带贴图的球衣/脸、以及会被换色或切显隐的装备件(球鞋/护腕/护袖/头带)一律保持独立。 */
function bakeActorSegments(guy){
  if(!guy||!guy.g||guy.__segmentsBaked)return 0;
  const keep=new Set();
  [guy.shoes,guy.wrists,guy.sleeves].forEach(arr=>(arr||[]).forEach(m=>m&&keep.add(m)));
  if(guy.headband)keep.add(guy.headband);
  if(guy.jerseyHem){
    keep.add(guy.jerseyHem);
    guy.jerseyHem.children.forEach(m=>m&&keep.add(m));
  }
  if(guy.faceExpression){
    if(guy.faceExpression.root)keep.add(guy.faceExpression.root);
    (guy.faceExpression.brows||[]).forEach(m=>m&&keep.add(m));
    if(guy.faceExpression.mouth)keep.add(guy.faceExpression.mouth);
  }
  const segments=[];
  (function collect(node){
    segments.push(node);
    node.children.forEach(child=>{if(!child.isMesh||child.children.length)collect(child);});
  })(guy.g);
  let removed=0;
  segments.forEach(seg=>{
    const parts=[];
    seg.children.forEach(child=>{
      if(!child.isMesh||child.userData.shoeFitVisual||keep.has(child)||child.children.length||!child.visible)return;
      const mat=child.material;
      if(!mat||Array.isArray(mat)||mat.map||mat.transparent||mat.emissive?.getHex())return;
      child.updateMatrix();parts.push(child);
    });
    if(parts.length<2)return;
    const positions=[],normals=[],colors=[];
    parts.forEach(child=>{
      const geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geo.applyMatrix4(child.matrix);
      const p=geo.attributes.position,n=geo.attributes.normal,c=child.material.color;
      for(let i=0;i<p.count;i++){
        positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b);
      }
      geo.dispose();seg.remove(child);child.geometry.dispose();
    });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
    geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));
    mesh.name="actorShapedSegment";mesh.castShadow=true;mesh.receiveShadow=SHADOW_RECEIVE;seg.add(mesh);
    removed+=parts.length-1;
  });
  guy.__segmentsBaked=true;
  return removed;
}
function rivalFor(o){const i=G.opponents.indexOf(o);return rivals[i>=0?i:0];}
function benchSetup(){
  rivals.forEach((rv,i)=>{
    const o=G.stage==="final"?(i===0?G.finalist:null):G.opponents[i];
    rv.active=!!o;rv.o=o;
    if(!o)return;
    rv.g.position.copy(BENCH[i]);
    rv.g.rotation.y=faceTo(BENCH[i],V3(0,0,-4));
    rv.arms.forEach(a=>a.rotation.x=-0.3);rv.elbows.forEach(e=>e.rotation.x=-0.3);
    rv.legs.forEach(l=>l.rotation.x=0);
    rv.knees.forEach(k=>k.rotation.x=0);
    rv.ankles.forEach(a=>a.rotation.x=0);
    rv.shoes.forEach(s=>s.rotation.x=0);
    rv.g.rotation.x=0;
    rv.ball.visible=false;
  });
  benchVis();
}
function benchVis(){
  const act=(G.state==="round"||G.state==="tiebreak"||G.state==="aishow"||G.state==="battle"||G.state==="pregame"||G.state==="victorycine");
  rivals.forEach(rv=>{rv.g.visible=act&&rv.active;});
}

/* player world state */

window.AIBA.runtime.register("rendering:characters",Object.freeze({
  voxelGuy,setHair,setBeard,faceTex,jerseyTex,dressGuy,applyStarStyle,randomizeOutfit,setFaceExpression,bakeActorSegments,
  buildCharacters,rivalFor,benchSetup,benchVis,updGroundShadows,
  getActors:()=>({player,playerBall:pBall,passer,passerBall,oppPasser,oppPasserBall,rivals})
}));
