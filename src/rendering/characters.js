/* ---------------- voxel characters: player avatar & passer ---------------- */
/* 高精度体素球员:在保留原动画 pivot 偏移(髋0.78/大腿0.34/小腿0.32/肩1.36...)的前提下细分方块 */
const VOXEL_HEAD_SCALE=new URLSearchParams(location.search).get("head")==="classic"?1:.86;
const VOXEL_HEAD_PIVOT_Y=1.45;
const VOXEL_SHOULDER_X=.285;
const VOXEL_HIP_X=.125;
const CHARACTER_TEXTURE_CACHE=new Map();
function voxelGuy(){
  const g=new THREE.Group();
  const mS=new THREE.MeshLambertMaterial({color:0xf4c89c});  // 皮肤
  const mJ=new THREE.MeshLambertMaterial({color:0x2fae4a});  // 球衣
  const mP=new THREE.MeshLambertMaterial({color:0x1c1c1c});  // 短裤/配色
  const mSole=new THREE.MeshLambertMaterial({color:0xf3f3f3});// 鞋底
  const mSock=new THREE.MeshLambertMaterial({color:0xf3f3f3});// 袜/鞋舌
  const mLace=new THREE.MeshLambertMaterial({color:0x1a1a1a});// 鞋带
  const hairMat=new THREE.MeshLambertMaterial({color:0x222222});
  const beardMat=new THREE.MeshLambertMaterial({color:0x222222});
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
  const legs=[],knees=[],ankles=[],arms=[],elbows=[],shoes=[],wrists=[],sleeves=[],palms=[],thumbs=[],handRoots=[],fingerJoints=[],ballGrips=[];
  const hipBlends=[],kneeBlends=[],ankleBlends=[],elbowBlends=[],wristBlends=[];
  // ---- 腿 ----
  [-VOXEL_HIP_X,VOXEL_HIP_X].forEach(x=>{
    const lg=new THREE.Group();lg.position.set(x,0.78,0);     // 髋 pivot
    const hipBlend=addSoft(lg,0.205,0.23,0.225,mP,0,-0.075,0,.038,3);
    hipBlend.name="hipBlend";                                 // 髋关节藏在短裤内并与骨盆重叠
    add(lg,0.035,0.16,0.23,mJ,-Math.sign(x||1)*0.103,-0.12,0.004); // 球裤侧边队色条
    add(lg,0.19,0.035,0.225,mJ,0,-0.205,0);                   // 球裤裤脚滚边
    addSoft(lg,0.16,0.18,0.18,mS,0,-0.255,0,.028,2);          // 大腿伸入膝关节包
    const kn=new THREE.Group();kn.position.y=-0.34;           // 膝 pivot
    const kneeBlend=addSoft(kn,0.164,0.145,0.178,mS,0,-0.035,0.004,.052,3);
    kneeBlend.name="kneeBlend";                               // 随小腿转动并包住大腿末端
    const kneeCap=addSoft(kneeBlend,0.105,0.055,0.05,mS,0,0,0.092,.016,2);
    kneeCap.name="kneeCap";
    addSoft(kn,0.15,0.22,0.165,mS,0,-0.18,0,.028,2);          // 小腿上端伸入膝关节包
    addSoft(kn,0.165,0.095,0.18,mSock, 0,-0.295,0.006,.024,2);// 袜子
    add(kn,0.17,0.024,0.185,mJ, 0,-0.252,0.006);              // 袜口队色细条
    add(kn,0.165,0.018,0.18,mP, 0,-0.322,0.008);              // 袜底暗线
    const ank=new THREE.Group();ank.position.y=-0.32;         // 踝 pivot
    addSoft(ank,0.205,0.055,0.27,mSole, 0,-0.085,0.005,.016,2);// 鞋底主体
    round(ank,.103,.028,.09,mSole,0,-.085,.15);               // 收圆的前掌鞋底
    const sh=soft(0.19,0.11,0.23,new THREE.MeshLambertMaterial({color:0xffffff}),.032,3); // 鞋面(可染色,shoes[])
    sh.position.set(0,-0.02,0.015);ank.add(sh);
    round(ank,.094,.043,.085,sh.material,0,-.037,.155);        // 圆润鞋头(随鞋面色)
    addSoft(ank,0.178,0.12,0.10,sh.material,  0,-0.005,-0.115,.024,2); // 鞋跟(随鞋面色)
    add(ank,0.045,0.082,0.185,mLace, -0.078,-0.01,0.03);      // 外侧鞋身暗条
    add(ank,0.045,0.082,0.185,mLace,  0.078,-0.01,0.03);      // 内侧鞋身暗条
    round(ank,.072,.014,.06,mSole,0,-.006,.19);               // 鞋头高光边
    addSoft(ank,0.12,0.10,0.075,mSock, 0,0.03,-0.015,.018,2); // 鞋舌
    add(ank,0.10,0.04,0.11,mLace, 0,0.052,0.04);              // 鞋带
    add(ank,0.12,0.022,0.028,mLace, 0,0.078,0.09);            // 鞋带 2
    add(ank,0.21,0.028,0.25,mSole, 0,-0.052,0.005);           // 中底白条主体
    round(ank,.105,.015,.085,mSole,0,-.052,.15);              // 中底圆头
    const ankleBlend=addSoft(ank,0.158,0.13,0.145,mSock,0,0.035,-0.065,.036,3);
    ankleBlend.name="ankleBlend";                             // 袜筒与球鞋共同包住踝 pivot
    kn.add(ank);lg.add(kn);
    g.add(lg);legs.push(lg);knees.push(kn);ankles.push(ank);shoes.push(sh);
    hipBlends.push(hipBlend);kneeBlends.push(kneeBlend);ankleBlends.push(ankleBlend);
  });
  // ---- 盆骨/短裤腰(填补躯干与腿之间) ----
  addSoft(g,0.50,0.22,0.27,mP,0,0.88,0,.045,3);
  add(g,0.52,0.05,0.29,mJ,0,0.98,0);                         // 提高腰线,拉长腿部视觉比例
  add(g,0.42,0.035,0.28,mP,0,0.765,0);                       // 球裤下摆暗线
  // ---- 躯干 ----
  const bodyF=new THREE.MeshLambertMaterial({color:0xffffff});
  const bodyB=new THREE.MeshLambertMaterial({color:0xffffff});
  const body=new THREE.Mesh(roundedBoxGeometry(0.5,0.52,0.27,.048,3),[mJ,mJ,mJ,mJ,bodyF,bodyB]);
  body.position.y=1.13;g.add(body);
  add(g,0.045,0.43,0.21,mP,-0.255,1.13,0);                    // 左侧条纹(短裤色)
  add(g,0.045,0.43,0.21,mP, 0.255,1.13,0);                    // 右侧条纹
  add(g,0.035,0.40,0.285,mJ,-0.285,1.12,0);                  // 外侧球衣薄边
  add(g,0.035,0.40,0.285,mJ, 0.285,1.12,0);                  // 外侧球衣薄边
  add(g,0.30,0.07,0.21,mJ, 0,1.40,0);                        // 领口
  add(g,0.19,0.05,0.29,mP, -0.105,1.34,0.006);               // V领左边
  add(g,0.19,0.05,0.29,mP,  0.105,1.34,0.006);               // V领右边
  add(g,0.12,0.055,0.215,mP, -0.19,1.385,0);                 // 左肩滚边
  add(g,0.12,0.055,0.215,mP,  0.19,1.385,0);                 // 右肩滚边
  add(g,0.50,0.035,0.29,mP,0,0.88,0);                        // 球衣下摆压线
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
  const hairGrp=new THREE.Group();headRoot.add(hairGrp);      // 头发(按 setHair 重建)
  const beardGrp=new THREE.Group();beardGrp.visible=false;headRoot.add(beardGrp); // 胡子
  // Four slim strips read as fabric around the head instead of an opaque slab through the face.
  const headband=new THREE.Group(),headbandMat=new THREE.MeshLambertMaterial({color:0xff4040});
  headband.material=headbandMat;headband.visible=false;
  add(headband,.35,.064,.035,headbandMat,0,1.70,.174);
  add(headband,.35,.064,.035,headbandMat,0,1.70,-.174);
  add(headband,.035,.064,.31,headbandMat,-.174,1.70,0);
  add(headband,.035,.064,.31,headbandMat,.174,1.70,0);
  headRoot.add(headband);
  // ---- 手臂 ----
  [-VOXEL_SHOULDER_X,VOXEL_SHOULDER_X].forEach(x=>{
    const sh2=new THREE.Group();sh2.position.set(x,1.36,0);  // 肩 pivot
    // The upper arm enters the rounded deltoid at its widest section. Their nearly
    // matching cross-sections hide the old square ledge while keeping a voxel forearm.
    const shoulder=new THREE.Mesh(roundedBoxGeometry(.152,.17,.172,.052,3),mS);
    shoulder.name="shoulderBlend";shoulder.position.y=-.045;sh2.add(shoulder);
    const up=new THREE.Mesh(roundedBoxGeometry(.14,.265,.16,.018,2),mS);
    up.name="upperArm";up.position.y=-.1775;sh2.add(up);
    const sl=new THREE.Mesh(roundedBoxGeometry(.148,.285,.168,.02,2),new THREE.MeshLambertMaterial({color:0x111111}));
    sl.position.y=-.19;sl.visible=false;sh2.add(sl);          // 贴身护臂(默认隐藏)
    const el=new THREE.Group();el.position.y=-0.32;          // 肘 pivot
    const elbowBlend=addSoft(el,0.142,0.135,0.156,mS,0,-0.025,0.004,.044,3);
    elbowBlend.name="elbowBlend";                            // 圆角肘包同时压住大臂和前臂
    const fo=soft(0.125,0.27,0.145,mS,.026,2);fo.position.y=-0.145;el.add(fo); // 前臂伸入肘包
    const wr=soft(0.14,0.06,0.155,new THREE.MeshLambertMaterial({color:0xffffff}),.018,2);
    wr.position.y=-0.27;wr.visible=false;el.add(wr);          // 护腕(默认隐藏)
    const handRoot=new THREE.Group();
    handRoot.name="handRig";handRoot.position.set(0,-.29,.01);el.add(handRoot); // 腕部 pivot
    const wristBlend=addSoft(handRoot,.12,.10,.105,mS,0,-.003,0,.032,3);
    wristBlend.name="wristBlend";                             // 随手掌旋转并与前臂交叠
    const palm=new THREE.Mesh(roundedBoxGeometry(.145,.135,.058,.024,3),mS);
    palm.name="palm";palm.position.set(0,-.055,0);handRoot.add(palm);            // 圆角扁矩形手掌
    const handSide=x<0?-1:1;
    const thumb=addSoft(handRoot,0.038,0.078,0.042,mS,handSide*.074,-.024,.025,.010,2);
    thumb.name="thumb";thumb.rotation.z=-handSide*.70;
    const fingerLengths=[.094,.108,.112,.100];
    const fingerRoots=[];
    [-1.5,-.5,.5,1.5].forEach((i,index)=>{
      const length=fingerLengths[index];
      const fingerRoot=new THREE.Group();
      fingerRoot.name="fingerJoint";fingerRoot.position.set(i*.028,-.108,.026);fingerRoot.rotation.x=-.08;
      const finger=addSoft(fingerRoot,0.022,length,0.03,mS,0,-length*.5,0,.008,2);
      finger.name="finger";handRoot.add(fingerRoot);fingerRoots.push(fingerRoot);
    });
    const ballGrip=new THREE.Group();
    ballGrip.name="ballGrip";ballGrip.position.set(0,-.43,.12);el.add(ballGrip); // 腕前持球锚点不随压腕反转
    sh2.add(el);g.add(sh2);
    arms.push(sh2);elbows.push(el);wrists.push(wr);sleeves.push(sl);palms.push(palm);thumbs.push(thumb);handRoots.push(handRoot);fingerJoints.push(fingerRoots);ballGrips.push(ballGrip);
    elbowBlends.push(elbowBlend);wristBlends.push(wristBlend);
  });
  const o={g,headRoot,headScale:VOXEL_HEAD_SCALE,baseShoulderX:VOXEL_SHOULDER_X,baseHipX:VOXEL_HIP_X,
    legs,knees,ankles,arms,elbows,shoes,wrists,sleeves,palms,thumbs,handRoots,fingerJoints,ballGrips,
    hipBlends,kneeBlends,ankleBlends,elbowBlends,wristBlends,neckBlend,headband,
    hair:hairGrp,hairGrp,hairMat,beardGrp,beardMat,mJ,mP,mS,bodyF,bodyB,mFace,hairStyle:"short"};
  setHair(o,"short");
  return o;
}
/* 发型:清空 hairGrp 重建,所有发块共享 hairMat */
function setHair(o,style,colorHex){
  if(colorHex!=null)o.hairMat.color.setHex(colorHex);
  const G=o.hairGrp,m=o.hairMat;
  while(G.children.length){
    const child=G.children[0];G.remove(child);
    if(child.geometry&&child.geometry.dispose)child.geometry.dispose();
  }
  o.hairStyle=style;
  const box=(w,h,d,x,y,z,rx,ry,rz)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.rotation.set(rx||0,ry||0,rz||0);G.add(b);return b;};
  const tuft=(rx,ry,rz,x,y,z)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(1,8,5),m);b.scale.set(rx,ry,rz);b.position.set(x,y,z);G.add(b);return b;};
  const lock=(r,h,x,y,z,rx,rz)=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(r*.72,r,h,6),m);b.position.set(x,y,z);b.rotation.set(rx||0,0,rz||0);G.add(b);return b;};
  if(style==="bald")return;
  if(style==="buzz"){
    tuft(.178,.040,.178,0,1.79,0);
    box(.30,.15,.045,0,1.70,-.169);
    box(.045,.14,.27,-.169,1.71,-.005);box(.045,.14,.27,.169,1.71,-.005);
    box(.25,.026,.045,0,1.772,.17);return;
  }
  if(style==="afro"){
    tuft(.14,.12,.17,-.15,1.76,-.02);tuft(.14,.12,.17,.15,1.76,-.02);
    tuft(.17,.12,.12,0,1.75,-.15);
    tuft(.23,.18,.23,0,1.91,0);tuft(.19,.13,.19,0,2.055,0);
    tuft(.13,.14,.19,-.205,1.91,0);tuft(.13,.14,.19,.205,1.91,0);
    tuft(.18,.12,.12,0,1.89,.19);tuft(.18,.12,.12,0,1.89,-.19);return;
  }
  if(style==="cornrows"){
    box(.30,.15,.048,0,1.70,-.17);
    box(.048,.14,.27,-.17,1.71,-.01);box(.048,.14,.27,.17,1.71,-.01);
    for(let i=-2;i<=2;i++)box(.048,.062,.38,i*.074,1.805,0);
    for(let i=-2;i<=2;i++)box(.034,.032,.06,i*.074,1.837,.18);
    lock(.026,.25,-.11,1.61,-.21,-.10,-.05);lock(.026,.27,.11,1.60,-.21,.08,.05);return;
  }
  if(style==="ponytail"){
    tuft(.18,.067,.18,0,1.785,0);
    box(.30,.21,.055,0,1.68,-.165);
    box(.055,.20,.29,-.165,1.69,0);box(.055,.20,.29,.165,1.69,0);
    box(.28,.038,.05,0,1.765,.17);
    tuft(.095,.10,.09,0,1.79,-.235);
    lock(.074,.31,0,1.60,-.33,-.22,0);
    lock(.063,.27,.025,1.34,-.355,-.18,.08);
    tuft(.07,.075,.065,.045,1.18,-.37);return;
  }
  if(style==="bun"){
    tuft(.18,.065,.18,0,1.785,0);
    box(.30,.21,.055,0,1.68,-.165);
    box(.055,.20,.29,-.165,1.69,0);box(.055,.20,.29,.165,1.69,0);
    box(.28,.038,.05,0,1.765,.17);
    tuft(.13,.13,.12,0,1.88,-.20);tuft(.085,.075,.08,0,1.98,-.19);return;
  }
  if(style==="flattop"){
    box(.355,.18,.355,0,1.88,0);box(.30,.20,.06,0,1.70,-.165);
    box(.34,.035,.34,0,1.99,0);box(.065,.20,.30,-.17,1.71,0);box(.065,.20,.30,.17,1.71,0);return;
  }
  // 默认 short / fade
  const sideH=style==="fade"?.14:.20,sideY=1.79-sideH*.5;
  tuft(.18,.073,.18,0,1.785,-.005);           // 圆润发冠
  box(.30,sideH,.055,0,sideY,-.168);           // 后脑包覆
  box(.055,sideH,.29,-.168,sideY,-.005);       // 左侧包覆
  box(.055,sideH,.29,.168,sideY,-.005);        // 右侧包覆
  box(.30,.042,.055,0,1.765,.17);              // 前发际
  box(.09,.052,.09,-.11,1.77,.18,-.10,0,-.10);// 前额碎发
  box(.09,.052,.09,.11,1.77,.18,-.10,0,.10);
}
/* 胡子:首次开启时构建,之后只切显隐 */
function setBeard(o,on,colorHex){
  o.beardGrp.visible=!!on;
  if(colorHex!=null)o.beardMat.color.setHex(colorHex);
  const G=o.beardGrp;
  if(!on||G.children.length)return;
  const m=o.beardMat;
  const box=(w,h,d,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);G.add(b);};
  box(0.30,0.07,0.05,0,1.515,0.165);        // 下巴
  box(0.07,0.13,0.05,-0.15,1.555,0.165);    // 左颊
  box(0.07,0.13,0.05, 0.15,1.555,0.165);    // 右颊
  box(0.12,0.045,0.05,0,1.575,0.17);        // 上唇
  box(0.08,0.035,0.052,-0.06,1.542,0.17);   // 下唇左
  box(0.08,0.035,0.052, 0.06,1.542,0.17);   // 下唇右
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
function jerseyTex(base,trim,num,big){
  const key=["jersey",base,trim,num,big?1:0].join(":");
  if(CHARACTER_TEXTURE_CACHE.has(key))return CHARACTER_TEXTURE_CACHE.get(key);
  const c="#"+base.toString(16).padStart(6,"0"),t="#"+trim.toString(16).padStart(6,"0");
  const tex=pixTex(72,72,(g)=>{
    g.fillStyle=c;g.fillRect(0,0,72,72);
    g.fillStyle="rgba(255,255,255,.07)";g.fillRect(0,0,72,5);
    g.fillStyle="rgba(0,0,0,.16)";g.fillRect(0,62,72,10);
    g.fillStyle=t;g.fillRect(0,0,4,72);g.fillRect(68,0,4,72);
    g.fillRect(4,4,64,3);
    if(num===""||num==null)return;
    if(!big){g.fillStyle="rgba(255,255,255,.82)";g.font="bold 7px Orbitron, monospace";g.textAlign="center";g.fillText("aiBA",36,17);}
    g.font="bold "+(big?40:32)+"px Orbitron, monospace";g.textAlign="center";
    g.lineWidth=5;g.strokeStyle="rgba(0,0,0,.85)";
    g.strokeText(num,36,big?53:50);
    g.fillStyle="#fff";g.fillText(num,36,big?53:50);
  });
  CHARACTER_TEXTURE_CACHE.set(key,tex);return tex;
}
function dressGuy(o,jersey,shorts,num){
  o.mJ.color.setHex(jersey);o.mP.color.setHex(shorts);
  o.bodyF.map=jerseyTex(jersey,shorts,num,false);o.bodyF.color.setHex(0xffffff);o.bodyF.needsUpdate=true;
  o.bodyB.map=jerseyTex(jersey,shorts,num,true);o.bodyB.color.setHex(0xffffff);o.bodyB.needsUpdate=true;
}
function applyStarStyle(guy,star){
  randomizeOutfit(guy);
  dressGuy(guy,star.col[0],star.col[1],star.num);
  const body=window.AIBA_CONFIG&&window.AIBA_CONFIG.bodyProfileFor?window.AIBA_CONFIG.bodyProfileFor(star):null;
  const bodyH=body&&Number(body.h)||1,bodyW=body&&Number(body.w)||1;
  guy.g.scale.set(bodyW,bodyH,bodyW);guy.bodyProfile={h:bodyH,w:bodyW};
  if(star.skin!=null){
    guy.mS.color.setHex(star.skin);
    guy.mFace.map=faceTex(star.skin);guy.mFace.color.setHex(0xffffff);guy.mFace.needsUpdate=true;
  }
  if(star.shoe!=null)guy.shoes.forEach(s=>s.material.color.setHex(star.shoe));
  if(star.headband){guy.headband.visible=true;guy.headband.material.color.setHex(star.headband);}
  else guy.headband.visible=false;
  if(star.wrist!=null)guy.wrists.forEach(w=>{w.visible=true;w.material.color.setHex(star.wrist);});
  if(star.sleeve!=null)guy.sleeves.forEach((s,i)=>{s.visible=i===1||star.id==="a03";s.material.color.setHex(star.sleeve);});
  const hc=star.hair!=null?star.hair:0x141414;
  setHair(guy, star.hairStyle||"short", hc);
  setBeard(guy, !!star.beard, (typeof star.beard==="number")?star.beard:hc);
  if(window.AIBAFaceOverlays)AIBAFaceOverlays.apply(guy,star);
}
function randomizeOutfit(o){
  const pick=a=>a[(Math.random()*a.length)|0];
  const SC=[0xff4040,0xffffff,0x111111,0x00d0ff,0xffd23f,0xff8df0,0x7CFC6B];
  const BC=[0xff4040,0xffffff,0x111111,0xffd23f,0x00d0ff,0x9b59ff];
  const SK=[0xf4c89c,0xd9a878,0x9c6b43,0x6b4a2c];
  const skin=pick(SK);o.mS.color.setHex(skin);
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
  const segments=[];
  (function collect(node){
    segments.push(node);
    node.children.forEach(child=>{if(!child.isMesh||child.children.length)collect(child);});
  })(guy.g);
  let removed=0;
  segments.forEach(seg=>{
    const parts=[],drop=[];
    seg.children.forEach(child=>{
      if(!child.isMesh||keep.has(child)||child.children.length)return;
      const mat=child.material,gp=child.geometry&&child.geometry.parameters;
      if(!mat||Array.isArray(mat)||mat.map||mat.transparent)return;   // 贴图/多材质/透明:保持独立
      if(!gp||gp.width==null||gp.height==null||gp.depth==null)return; // 非 Box:跳过
      child.updateMatrix();
      const m=child.matrix.clone().multiply(new THREE.Matrix4().makeScale(gp.width,gp.height,gp.depth));
      parts.push({color:mat.color,matrix:m});
      drop.push(child);
    });
    if(parts.length<2)return;
    drop.forEach(child=>seg.remove(child));
    bakeVoxelMesh(seg,parts);
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
  voxelGuy,setHair,setBeard,faceTex,jerseyTex,dressGuy,applyStarStyle,randomizeOutfit,
  buildCharacters,rivalFor,benchSetup,benchVis,
  getActors:()=>({player,playerBall:pBall,passer,passerBall,oppPasser,oppPasserBall,rivals})
}));
