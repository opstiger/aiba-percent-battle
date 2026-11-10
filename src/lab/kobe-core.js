/* Kobe 角色核心（共享）：骨架 + SDF 分层建模 + 上色（含脸部像素图）+ 姿势求解 + 体素化 / 平滑网格。
   不碰 DOM，三处共用：
     · experiments/kobe/index.html   实验页，作为普通脚本加载（全局作用域）
     · 实验页 / AIBA 的 Web Worker     importScripts 加载，逐帧烘焙
     · src/lab/kobe-avatar.js         AIBA 里用 new Function 包在闭包里加载，避免和游戏的全局名（clamp、V3…）撞车
   依赖：全局 THREE（r128）。 */
"use strict";
const T=THREE;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};

/* =====================================================================
   1. 骨架（静止姿态 = 世界坐标，角色面朝 +Z，左手 = +X）
   身高 1.98m，8.6 头身；臂展约 2.1m。
   ===================================================================== */
const BN=[],BI={};
function bone(name,parent,head){BI[name]=BN.length;BN.push({name,parent:parent==null?-1:BI[parent],head});}
bone('pelvis',null,[0,1.02,0]);
bone('spine','pelvis',[0,1.12,0]);
bone('chest','spine',[0,1.32,0]);
bone('neck','chest',[0,1.64,-.02]);
bone('head','neck',[0,1.72,-.02]);
for(const [sd,s] of [['L',1],['R',-1]]){
  bone('upperArm'+sd,'chest',[s*.195,1.60,-.01]);
  bone('foreArm'+sd,'upperArm'+sd,[s*.215,1.28,-.02]);
  bone('hand'+sd,'foreArm'+sd,[s*.228,.99,0]);
}
for(const [sd,s] of [['L',1],['R',-1]]){
  bone('thigh'+sd,'pelvis',[s*.095,1.0,0]);
  bone('shin'+sd,'thigh'+sd,[s*.1,.55,.01]);
  bone('foot'+sd,'shin'+sd,[s*.105,.09,-.01]);
}
bone('ball',null,[0,0,0]);
/* 体格（NBA 运动员）：整体加粗 G、左右加宽 W（肩、髋、四肢间距一起宽），手臂 / 腿再额外加粗，
   肌肉块收小并加大融合半径（不要一块块鼓出来）。头不参与。 */
const BUILD0={W:1.03,G:1.05,ARM:1.13,LEG:1.07,MUS:.84,MUSK:1.7},BUILD=Object.assign({},BUILD0);
/* 球星身高：骨架整体纵向 ×HY（头、手只平移不缩放——矮个子的头和手不会跟着变小）。
   原语、裁切面、上色阈值都写在 1.98m 的"设计空间"里，建模后处理统一换算，上色时再换算回来。 */
const BN_HEAD0=BN.map(b=>b.head.slice());
let HY=1,HAND_DY=0,HEAD_DY=0;
function applySkeleton(){
  BN.forEach((b,i)=>{const h=BN_HEAD0[i];b.head=[b.name==='head'||b.name==='neck'?h[0]:h[0]*BUILD.W,h[1]*HY,h[2]];});
  HAND_DY=(HY-1)*BN_HEAD0[BI.handL][1];HEAD_DY=(HY-1)*BN_HEAD0[BI.head][1];
}
applySkeleton();
const NB=BN.length,INV=new Float64Array(NB*12),DM=BN.map(()=>new T.Matrix4());

/* =====================================================================
   2. 原语：椭球 / 圆锥胶囊 / 圆角盒 / 平面裁切
   op: 'u' 平滑并  's' 平滑差  'i' 硬交（裁切）
   ===================================================================== */
function prep(P){
  if(P.t===0){[P.cx,P.cy,P.cz]=P.c;[P.rx,P.ry,P.rz]=P.r;P.bc=P.c;P.br=Math.max(...P.r);}
  else if(P.t===1){
    [P.ax,P.ay,P.az]=P.a;P.bax=P.b[0]-P.a[0];P.bay=P.b[1]-P.a[1];P.baz=P.b[2]-P.a[2];
    P.l2=P.bax*P.bax+P.bay*P.bay+P.baz*P.baz;P.rr=P.r1-P.r2;P.a2=P.l2-P.rr*P.rr;P.il2=1/P.l2;
    P.bc=[(P.a[0]+P.b[0])/2,(P.a[1]+P.b[1])/2,(P.a[2]+P.b[2])/2];P.br=Math.sqrt(P.l2)/2+Math.max(P.r1,P.r2);
  }else if(P.t===2){[P.cx,P.cy,P.cz]=P.c;[P.hx,P.hy,P.hz]=P.h;P.bc=P.c;P.br=Math.hypot(...P.h)+P.rr;}
  else if(P.t===3){const l=Math.hypot(...P.n);[P.nx,P.ny,P.nz]=P.n.map(v=>v/l);}
  if(P.clip)[P.qx,P.qy,P.qz,P.qo]=P.clip;   // 逐原语裁切平面（该原语自己的骨骼空间）
  P.wc=[0,0,0];return P;
}
function primD(P,x,y,z){
  switch(P.t){
    case 0:{
      const X=(x-P.cx)/P.rx,Y=(y-P.cy)/P.ry,Z=(z-P.cz)/P.rz,k0=Math.sqrt(X*X+Y*Y+Z*Z);
      const X2=X/P.rx,Y2=Y/P.ry,Z2=Z/P.rz,k1=Math.sqrt(X2*X2+Y2*Y2+Z2*Z2);
      return k1<1e-9?-Math.min(P.rx,P.ry,P.rz):k0*(k0-1)/k1;
    }
    case 1:{
      const px=x-P.ax,py=y-P.ay,pz=z-P.az,bx=P.bax,by=P.bay,bz=P.baz,l2=P.l2,rr=P.rr,a2=P.a2,il2=P.il2;
      const Y=px*bx+py*by+pz*bz,Z=Y-l2,qx=px*l2-bx*Y,qy=py*l2-by*Y,qz=pz*l2-bz*Y;
      const x2=qx*qx+qy*qy+qz*qz,y2=Y*Y*l2,z2=Z*Z*l2,k=Math.sign(rr)*rr*rr*x2;
      if(Math.sign(Z)*a2*z2>k)return Math.sqrt(x2+z2)*il2-P.r2;
      if(Math.sign(Y)*a2*y2<k)return Math.sqrt(x2+y2)*il2-P.r1;
      return (Math.sqrt(x2*a2*il2)+Y*rr)*il2-P.r1;
    }
    case 2:{
      const qx=Math.abs(x-P.cx)-P.hx+P.rr,qy=Math.abs(y-P.cy)-P.hy+P.rr,qz=Math.abs(z-P.cz)-P.hz+P.rr;
      const mx=Math.max(qx,0),my=Math.max(qy,0),mz=Math.max(qz,0);
      return Math.sqrt(mx*mx+my*my+mz*mz)+Math.min(Math.max(qx,qy,qz),0)-P.rr;
    }
    case 3:return P.nx*x+P.ny*y+P.nz*z-P.off;
  }
}

/* =====================================================================
   3. 配色 & 小工具
   ===================================================================== */
/* 通用色（肤色、发色、球衣配色由球星档案覆盖，见下方 ROSTER） */
const C0={
  skin:0x7d4a31,skinLo:0x693c28,palm:0xa06c55,   // 提亮一档（原 0x6b3e28 在卡渲暗面里接近黑）
  lip:0x4b271e,lipUp:0x3e2019,mouth:0x241009,lid:0x24140d,
  hair:0x65493a,beard:0x2b1c15,brow:0x150e0a,iris:0x160d08,sclera:0x9c8c7d,
  gold:0xf7a912,purple:0x552583,white:0xf1efea,black:0x18181b,
  sole:0x4a2378,ballO:0xc4581d,seam:0x1d1511,tape:0xece7dc,nbaR:0xc8102e,nbaB:0x1d428a
};
const C=Object.assign({},C0);
const MAT={skin:0,cloth:1,satin:2,shoe:3,hair:4,eye:5,ball:6};
function hash3(i,j,k){let h=(i*374761393+j*668265263+k*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;}
function vnoise(x,y,z,f){ // 低频值噪声（皮肤肤色起伏）
  x/=f;y/=f;z/=f;const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),u=x-i,v=y-j,w=z-k;
  const s=t=>t*t*(3-2*t),U=s(u),V=s(v),W=s(w);let r=0;
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)r+=hash3(i+a,j+b,k+c)*(a?U:1-U)*(b?V:1-V)*(c?W:1-W);
  return r;
}
function lerpTab(t,tab){if(t<=tab[0][0])return tab[0][1];for(let i=1;i<tab.length;i++)if(t<=tab[i][0]){const [a,va]=tab[i-1],[b,vb]=tab[i];return va+(vb-va)*(t-a)/(b-a);}return tab[tab.length-1][1];}
const OUT={hex:0,m:0,mul:1};
const set=(hex,m,mul=1)=>{OUT.hex=hex;OUT.m=m;OUT.mul=mul;return OUT;};
let FS=.012; // 当前上色分辨率——细节带宽至少一格，避免粗网格下五官忽有忽无
const band=(v,c,w)=>Math.abs(v-c)<Math.max(w,FS)/2;

/* 贴花：像素数据由主线程用 canvas 画好再装进来（Worker 里没有 DOM） */
let JF=null,JB=null,SW=null;
/* 完全不透明的贴花像素带 PRI 标记：像素字能压住袖口滚边（名字太长时两端描边会落到滚边上）；抗锯齿边缘不带 */
const PRI=1<<24;
function decalFrom(w,h,d){return (u,v)=>{const x=Math.floor(u*w),y=Math.floor(v*h);if(x<0||y<0||x>=w||y>=h)return -1;const i=(y*w+x)*4;if(d[i+3]<128)return -1;return((d[i]<<16)|(d[i+1]<<8)|d[i+2])|(d[i+3]===255?PRI:0);};}
function installDecals(D,id){const o={JF:decalFrom(D.JF.w,D.JF.h,D.JF.d),JB:decalFrom(D.JB.w,D.JB.h,D.JB.d),SW:decalFrom(D.SW.w,D.SW.h,D.SW.d)};
  id=id||D.id||(CH&&CH.id)||'kobe';DECALS[id]=o;if(!CH||CH.id===id){JF=o.JF;JB=o.JB;SW=o.SW;}}

/* =====================================================================
   4. 分层建模：皮肤 / 球衣 / 短裤 / 袜 / 鞋 / 护臂 / 胶布 / 球
   ===================================================================== */
let OPT={sleeve:'black'};
/* 头部比例：五官和上色都在原来的"设计空间"里写，建模时整体放大 HS、再下移 HDY。
   放大支点在下颌附近（HP），所以头往上、往两侧长，不往脖子里长；下移让脖子变短。 */
const HP=[0,1.74,0],HDY=-.036;
/* 头身比变体（OPT.prop = {f, g}）：f 头部放大倍数（相对当前），g 四肢粗细倍数。
   只动头和四肢粗细，不动骨架——AIBA 的动作、IK 目标、球的位置全部照旧可用。
   头部体素网格按 f 等比放大（1.2cm×f），脸部像素图和体素格保持逐格对齐。 */
let HS=1.15,HF=1,LG=1,CELL=.012,HFX=1;   // HFX：头部格子倍率（头身比 × 球星头围）
const headPt=d=>[d[0]*HS,HP[1]+(d[1]-HP[1])*HS+HDY+HEAD_DY,HP[2]+(d[2]-HP[2])*HS];              // 设计 → 静止
const headDesign=(x,y,z)=>[x/HS,HP[1]+(y-HDY-HEAD_DY-HP[1])/HS,HP[2]+(z-HP[2])/HS];              // 静止 → 设计
/* 设计空间的半空间 n·d ≤ o 换到头骨静止空间：返回单位法线 + 偏移（平面原语 / 逐原语裁切都能用） */
function headPlane(n,o){const l=Math.hypot(n[0],n[1],n[2]),m=n.map(v=>v/l);o/=l;
  const nHP=m[0]*HP[0]+m[1]*HP[1]+m[2]*HP[2];return {n:m,off:HS*(o-nHP)+nHP+m[1]*(HDY+HEAD_DY)};}
let EYE_Y=headPt([0,1.866,0])[1];   // 眼睛那一行在静止空间的高度（体素头部网格按它对齐）
function setProp(p){HF=p&&p.f||1;LG=p&&p.g||1;HFX=HF*(CH&&CH.headS||1);HS=1.15*HFX;CELL=.012*HFX;EYE_Y=headPt([0,1.866,0])[1];}
function headXform(P){
  if(P.c)P.c=headPt(P.c);if(P.a)P.a=headPt(P.a);if(P.b&&P.t===1)P.b=headPt(P.b);
  if(P.r)P.r=P.r.map(v=>v*HS);if(P.h)P.h=P.h.map(v=>v*HS);
  for(const k of ['r1','r2','rr','k'])if(P[k]!=null)P[k]*=HS;
  return prep(P);
}
let LAYERS=[];
/* ---------- 手：掌心有弧度 + 四指三节 + 拇指三段 + 自动贴球 ----------
   参考 AIBA motion.js 的手部做法：
   · 手指分 MCP/PIP/DIP 三节，弯曲按 .18/.52/.30 分到三节（FINGER_BEND_PROFILE）；
   · 持球时指缝张开，食指、小指外张最多（SHOOT_FINGER_SPLAY 的思路，幅度按大手放大）；
   · 球落在指根肉垫 + 指腹上，掌心留空（ballGrip 在掌心前方偏指根）；
   · 出手后手指各弯各的：食指最直指向篮筐，中指/无名指收（HAND_FINGER_FOLLOW）。
   掌心弧度来自三块肉垫（大鱼际、小鱼际、指根垫）围出的凹陷，加上指根的横弓（食指、小指的
   指根比中指更靠掌心一侧）。
   静止姿态里（hand 骨骼空间）：指尖朝 -Y，掌心法线 N0=(-s,0,0)，拇指在 +Z 一侧。 */
const FINGER={y:[.893,.888,.891,.898],z:[.029,.0095,-.0095,-.028],arch:[.004,0,.002,.006],
  L:[[.041,.025,.020],[.045,.028,.021],[.042,.027,.020],[.033,.020,.017]],r:[.0104,.0108,.0102,.0091]};   // 科比手大、指节粗
const THUMB={L:[.036,.031,.025],r:[.013,.011,.0092]};
const BEND=[.18,.52,.30],TBEND=[.2,.45,.35];
const HAND_DEF={c:[.35,.42,.5,.56],sp:[.05,.01,-.02,-.06],to:.15,ta:0,tc:.3,grip:0};
let HANDS=null;   // {L,R}：每只手解好的指节角度（主线程算好，Worker 直接用）
function handSpec(h){return Object.assign({},HAND_DEF,h||{});}
function mixHand(a,b,e){const A=handSpec(a),B=handSpec(b),m=(x,y)=>x+(y-x)*e;
  return {c:A.c.map((v,i)=>m(v,B.c[i])),sp:A.sp.map((v,i)=>m(v,B.sp[i])),to:m(A.to,B.to),ta:m(A.ta,B.ta),tc:m(A.tc,B.tc),grip:m(A.grip,B.grip)};}
function chainPts(P0,d0,n0,lens,angs){ // 每节在 (d0,n0) 平面内向 n0 累积弯曲
  const pts=[P0];let th=0,P=P0;
  for(let j=0;j<lens.length;j++){th+=angs[j];const c=Math.cos(th),sn=Math.sin(th);
    P=[P[0]+(d0[0]*c+n0[0]*sn)*lens[j],P[1]+(d0[1]*c+n0[1]*sn)*lens[j],P[2]+(d0[2]*c+n0[2]*sn)*lens[j]];pts.push(P);}
  return pts;
}
/* 逐节弯到"指腹刚好贴住球面"：每节在上一节的基础上找第一个贴球角度；够不着就按自由手型弯 */
function hugAngles(P0,d0,n0,lens,rads,ball,free){
  const out=[];let th=0,P=P0;
  for(let j=0;j<lens.length;j++){
    const R=BALL_R+rads[j]*.8,l=lens[j];
    const g=t=>{const c=Math.cos(t),sn=Math.sin(t);
      const x=P[0]+(d0[0]*c+n0[0]*sn)*l-ball[0],y=P[1]+(d0[1]*c+n0[1]*sn)*l-ball[1],z=P[2]+(d0[2]*c+n0[2]*sn)*l-ball[2];
      return Math.sqrt(x*x+y*y+z*z)-R;};
    const bis=(a,b)=>{let ga=g(a);for(let k=0;k<24;k++){const m=(a+b)/2,gm=g(m);if((gm>0)===(ga>0)){a=m;ga=gm;}else b=m;}return (a+b)/2;};
    let t=null;
    if(g(th)<=0){const lo=th-.6;t=g(lo)>0?bis(lo,th):lo;}      // 已经顶进球里：往回伸直到刚好贴住
    else for(let a=th;a<th+1.5;a+=.08)if(g(a+.08)<=0){t=bis(a,a+.08);break;}
    if(t===null)t=th+free[j];
    t=Math.min(t,th+1.35);out.push(t-th);th=t;
    const c=Math.cos(th),sn=Math.sin(th);P=[P[0]+(d0[0]*c+n0[0]*sn)*l,P[1]+(d0[1]*c+n0[1]*sn)*l,P[2]+(d0[2]*c+n0[2]*sn)*l];
  }
  return out;
}
/* 解一只手：返回四指 + 拇指的起点/方向/各节角度。ball：球心在该手静止空间的坐标（可空） */
function solveHand(s,h,ball){
  h=handSpec(h);const N0=[-s,0,0],res={f:[],t:null};
  const palmC=[s*.226,.93,.004];
  const near=ball&&h.grip>.001&&Math.hypot(ball[0]-palmC[0],ball[1]-palmC[1],ball[2]-palmC[2])<BALL_R+.075;
  for(let i=0;i<4;i++){
    const sp=h.sp[i],d0=[0,-Math.cos(sp),Math.sin(sp)],K=[s*(.232-FINGER.arch[i]),FINGER.y[i],FINGER.z[i]];
    const free=BEND.map(b=>b*h.c[i]);let a=free;
    if(near){const hug=hugAngles(K,d0,N0,FINGER.L[i],[FINGER.r[i],FINGER.r[i]*.92,FINGER.r[i]*.84],ball,free);a=free.map((v,j)=>v+(hug[j]-v)*h.grip);}
    res.f.push({K,d0,a});
  }
  // 拇指：从大鱼际根部出发；ta 外展（离开四指），to 对掌（转向掌心），tc 屈曲
  const B=[s*(.232-.006),.972,.02],a0=.95+h.ta,dT0=[0,-Math.cos(a0),Math.sin(a0)],co=Math.cos(h.to),so=Math.sin(h.to);
  let dT=[dT0[0]*co+N0[0]*so,dT0[1]*co,dT0[2]*co];{const l=Math.hypot(...dT);dT=dT.map(v=>v/l);}
  let nT=[N0[0]-dT[0]*(N0[0]*dT[0]),-dT[1]*(N0[0]*dT[0]),-dT[2]*(N0[0]*dT[0])];{const l=Math.hypot(...nT)||1;nT=nT.map(v=>v/l);}
  const tf=TBEND.map(b=>b*h.tc);let ta=tf;
  if(near){const hug=hugAngles(B,dT,nT,THUMB.L,THUMB.r,ball,tf);ta=tf.map((v,j)=>v+(hug[j]-v)*h.grip*.9);}
  res.t={B,d0:dT,n0:nT,a:ta};
  return res;
}
/* 按当前骨骼矩阵 DM 和球的世界位置，解两只手 */
function computeHands(spec,ballW){
  const out={};
  for(const [sd,s] of [['L',1],['R',-1]]){
    const hs=spec&&spec[sd];let br=null;
    if(ballW&&hs&&hs.grip>0){const v=new T.Vector3(ballW[0],ballW[1],ballW[2]).applyMatrix4(DM[BI['hand'+sd]].clone().invert());br=[v.x/BUILD.W,v.y-HAND_DY,v.z];}
    out[sd]=solveHand(s,hs,br);
  }
  return out;
}
/* 发型外壳：t 外扩厚度；y0/slope 发际线切面；vol 额外的体积块（头顶卷发、刘海） */
/* side：两侧 / 后脑的推剪线（水平切，切线以下只剩寸头上色）；bumps：头顶一圈小卷块，让剪影有起伏；
   braids：地垄辫——每根辫子一条沿头骨从发际线拉到后颈的凸起，逐格对齐头部网格，辫子之间露头皮缝 */
const HAIR_STYLES={
  cornrows:{t:.003,y0:1.85,slope:.55,braids:true},
  /* 库里 / 哈登：不要贴头皮的外壳（外壳一切就是一道台阶）——头顶的卷发团直接从头皮里长出来，
     两侧 / 后脑是推短的寸头（上色）。卷发团和头骨相交的那一圈就是自然的发际线 */
  curly:{noCap:true,y0:1.868,slope:.5,vol:[{c:[0,1.918,-.014],r:[.079,.048,.088]}],bumps:{n:34,r:.0115,a:1.3}},
  fade:{noCap:true,y0:1.868,slope:.45,vol:[{c:[0,1.93,-.016],r:[.078,.064,.088]}],bumps:{n:40,r:.0135,a:1.25}},
  shaggy:{t:.009,y0:1.857,slope:.42,vol:[{c:[0,1.908,-.016],r:[.085,.062,.097]},{c:[0,1.914,.056],r:[.07,.03,.036],k:.02}]},
  /* 欧文 2016：比哈登的 fade 低一截的短卷顶，两侧同样推短 */
  crop:{noCap:true,y0:1.868,slope:.45,vol:[{c:[0,1.916,-.014],r:[.077,.05,.087]}],bumps:{n:36,r:.0108,a:1.25}},
  /* 东契奇：两侧短、头顶留长往后梳，前额一撮微微立起（不是诺维茨基那种盖额头的刘海） */
  swept:{t:.006,y0:1.876,slope:.52,vol:[{c:[0,1.914,-.018],r:[.083,.058,.095]},{c:[0,1.93,.042],r:[.058,.03,.042],k:.025}]},
};
function buildLayers(){
  setChar(OPT.char);setProp(OPT.prop);
  const hd=Object.assign({face:1,jaw:1,nose:1,lip:1,chin:1,ear:1},CH.hd||{});
  const L=[];
  const layer=(name,prio,color)=>{const o={name,prio,color,prims:[]};L.push(o);return o;};
  const mk=(ly)=>({
    e:(bn,c,r,tag,k=.02,x={})=>ly.prims.push(prep({t:0,bone:BI[bn],c,r,tag,k,op:'u',...x})),
    c:(bn,a,b,r1,r2,tag,k=.02,x={})=>ly.prims.push(prep({t:1,bone:BI[bn],a,b,r1,r2,tag,k,op:'u',...x})),
    b:(bn,c,h,rr,tag,k=.02,x={})=>ly.prims.push(prep({t:2,bone:BI[bn],c,h,rr,tag,k,op:'u',...x})),
    se:(bn,c,r,k=.006)=>{const P=prep({t:0,bone:BI[bn],c,r,k,op:'s'});ly.prims.push(P);return P;},
    pl:(bn,n,off)=>ly.prims.push(prep({t:3,bone:BI[bn],n,off,op:'i'})),
  });

  /* ---------- 皮肤 ---------- */
  const SK=layer('skin',0,skinColor),s0=mk(SK);
  s0.e('chest',[0,1.43,0],[.166,.165,.118],'skin',.032);
  s0.e('spine',[0,1.22,.002],[.146,.14,.102],'skin',.035);               // 腹核心：收平，胸比腰宽（倒三角）
  s0.e('pelvis',[0,1.04,-.005],[.165,.115,.115],'skin',.035);
  for(const s of [1,-1]){
    s0.e('pelvis',[s*.066,.975,-.047],[.076,.086,.064],'skin',.03);
    s0.e('spine',[s*.094,1.20,.002],[.062,.115,.08],'skin',.03);          // 侧腹外斜肌
    s0.e('chest',[s*.072,1.47,.042],[.072,.056,.024],'skin',.025);         // 胸大肌：刚健平整
    s0.e('chest',[s*.115,1.42,-.035],[.07,.14,.075],'skin',.03);          // 背阔肌
    s0.e('chest',[s*.072,1.635,-.022],[.070,.042,.052],'skin',.035);         // 斜方肌
  }
  s0.e('chest',[0,1.56,-.035],[.145,.07,.075],'skin',.03);
  s0.c('chest',[-.16,1.595,-.008],[.16,1.595,-.008],.034,.034,'skin',.028);          // 锁骨带
  s0.c('neck',[0,1.58,-.02],[0,1.78,-.02],.072,.058,'neck',.032);                    // 粗壮运动员颈部
  // 头：圆润饱满鸡蛋头型（头顶平滑圆弧穹顶，下颌方圆稳健）
  s0.e('head',[0,1.868,-.008],[.086,.086,.092],'head',.028);              // 颅骨：饱满圆润鸡蛋穹顶
  s0.e('head',[0,1.852,-.052],[.074,.068,.066],'head',.03);                // 枕骨：后脑往后突，长头型
  s0.e('head',[0,1.828,.014],[.069*hd.face,.071,.078],'head',.026);               // 面部体块：收窄，长脸
  s0.e('head',[0,1.776,.014],[.061*hd.jaw,.042,.066],'head',.022);               // 下颌骨
  s0.e('head',[0,1.758-.006*(hd.chin-1),.048+.01*(hd.chin-1)],[.042*hd.jaw,.026*hd.chin,.034],'head',.020);               // 下巴：宽圆硬朗，自然收弧
  for(const s of [1,-1]){
    s0.e('head',[s*.05*hd.jaw,1.779,-.006],[.019,.026,.032],'head',.014);         // 下颌角：更硬朗
    s0.e('head',[s*.047*hd.face,1.838,.05],[.021,.016,.024],'head',.016);         // 颧骨：高而挺
    // 耳：耳根贴头，耳廓后倾外翘、后缘离开头皮约 1cm；耳轮一圈卷边，耳甲腔外凹，加对耳轮/耳屏/耳垂
    {const E=p=>[s*(.086+(p[0]-.086)*hd.ear),1.855+(p[1]-1.855)*hd.ear,-.01+(p[2]+.01)*hd.ear];
      s0.e('head',E([.087,1.853,-.004]),[.0045,.022,.014],'ear',.006);                    // 耳根（前缘贴头）
      s0.e('head',E([.0915,1.855,-.014]),[.0038,.024,.016],'ear',.003);                   // 耳廓板
      const rim=[[.086,1.879,.004],[.0925,1.887,-.008],[.0975,1.877,-.025],[.0995,1.857,-.032],[.0965,1.836,-.027],[.0925,1.824,-.016]];
      for(let i=0;i<rim.length-1;i++)s0.c('head',E(rim[i]),E(rim[i+1]),.0046,.0042,'ear',.002);   // 耳轮
      s0.e('head',E([.092,1.826,-.012]),[.0048,.0095,.0085],'ear',.003);                  // 耳垂
      s0.e('head',E([.0895,1.848,.007]),[.0042,.0065,.0042],'ear',.003);                  // 耳屏
      s0.se('head',E([.0985,1.852,-.009]),[.0068,.0125,.0098],.003);                       // 耳甲腔（外凹）
      s0.c('head',E([.0945,1.873,-.012]),E([.0955,1.842,-.021]),.0028,.0026,'ear',.002);  // 对耳轮
    }
  }
  s0.e('head',[0,1.880,.074],[.058,.010,.012],'head',.012);               // 眉弓：自然贴合额头，不再夸张前凸
  s0.c('head',[0,1.870,.078],[0,1.826,.098],.008,.011,'head',.01);        // 鼻梁：挺拔秀气
  s0.e('head',[0,1.822,.092],[.0165*hd.nose,.0102,.0122],'head',.008);            // 鼻翼（宽鼻底）
  s0.e('head',[0,1.827,.099],[.0118*Math.sqrt(hd.nose),.0102,.0112],'head',.007);            // 鼻头：略收，不再显得鼻子大
  for(const s of [1,-1])s0.e('head',[s*.016*hd.nose,1.822,.091],[.010,.010,.011],'head',.006); // 鼻翼两侧
  s0.e('head',[0,1.796,.085],[.024,.008*hd.lip,.010*hd.lip],'head',.007);               // 上唇
  s0.e('head',[0,1.785,.082],[.022,.008*hd.lip,.010*hd.lip],'head',.007);               // 下唇
  for(const s of [1,-1])s0.se('head',[s*.033,1.866,.092],[.016,.010,.012],.006);   // 眼窝
  for(const s of [1,-1])s0.e('head',[s*.033,1.866,.076],[.013,.013,.013],'head',.002); // 眼球
  for(const P of SK.prims)if(P.bone===BI.head)headXform(P);                // 头放大 12%、下移 2.8cm
  /* ---------- 头发 / 胡子 / 头带：贴着头骨的外壳层（设计空间里写，同样经 headXform） ----------
     外壳用头骨两块椭球各自外扩 t；发际线是一张斜切面（前高后低），耳朵处挖掉一块。 */
  const headLayer=(name,prio,color,build)=>{const ly=layer(name,prio,color),m=mk(ly),planes=[];
    ly.th=.0035;build(m,(n,o)=>planes.push([n,o]));for(const P of ly.prims)headXform(P);
    for(const [n,o] of planes){const q=headPlane(n,o);ly.prims.push(prep({t:3,bone:BI.head,n:q.n,off:q.off,op:'i'}));}
    return ly;};
  const HAIR=HAIR_STYLES[CH.hair];
  if(HAIR)headLayer('hair',1,hairColor,(m,plane)=>{
    const t=HAIR.t;
    if(!HAIR.noCap){m.e('head',[0,1.868,-.008],[.086+t,.086+t,.092+t],'hair',.02);
      m.e('head',[0,1.852,-.052],[.074+t,.068+t,.066+t],'hair',.02);}
    for(const P of HAIR.vol||[])m.e('head',P.c,P.r,'hair',P.k||.03);
    if(HAIR.bumps&&HAIR.vol){const V=HAIR.vol[0],B=HAIR.bumps;   // 头顶卷块：黄金角螺旋均布在体积块上半球
      for(let i=0;i<B.n;i++){const u=(i+.5)/B.n,a=Math.acos(1-u*(1-Math.cos(B.a))),b=i*2.39996+hash3(i,3,7)*.6,d=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];
        const rr=B.r*(.8+hash3(i,5,1)*.45);m.e('head',[V.c[0]+V.r[0]*d[0]*.93,V.c[1]+V.r[1]*d[1]*.93,V.c[2]+V.r[2]*d[2]*.93],[rr,rr*.85,rr],'hair',.006);}}
    if(HAIR.braids){   // 地垄辫：辫子中心落在头部网格的偶数列（x / CELL），沿头骨外壳从前额拉到后颈
      const cx=CELL/HS;
      for(let m2=-4;m2<=3;m2++){const dx=(2*m2+.5)*cx;if(Math.abs(dx)>.07)continue;
        const k=Math.sqrt(Math.max(.05,1-(dx/.089)**2)),pts=[];
        for(let f=.3;f<=3.75;f+=.23){const y=1.868+.089*k*Math.sin(f),z=-.01+.095*k*Math.cos(f);pts.push([dx,y,z]);}
        for(let i=0;i<pts.length-1;i++)m.c('head',pts[i],pts[i+1],.0058,.0058,'braid',.003);}}
    for(const s of [1,-1])m.se('head',[s*.093,1.853,-.012],[.017,.034,.027],.008);   // 耳朵露出来
    /* 发际线：y ≥ y0 + slope·z。融合完再整体切——逐块切再平滑并，切口处会往下鼓出一厘米多 */
    plane([0,-1,HAIR.slope],-HAIR.y0);
  });
  if(CH.headband!=null)headLayer('band',2,()=>set(CH.headband,MAT.cloth),(m,plane)=>{
    m.e('head',[0,1.868,-.01],[.095,.094,.101],'band',.012);
    m.se('head',[0,1.868,-.01],[.087,.087,.094],.004);
    plane([0,-1,0],-1.893);plane([0,1,0],1.925);
  });
  if(CH.beard==='full')headLayer('beard',1,beardColor,(m,plane)=>{
    m.e('head',[0,1.77,.02],[.075*hd.jaw,.062,.082],'beard',.02);                 // 下颌外一圈，两腮饱满
    m.e('head',[0,1.735,.052],[.057,.058,.05],'beard',.024);                      // 下巴的胡子往下、往前垂
    m.e('head',[0,1.697,.045],[.044,.05,.04],'beard',.024);                       // 再往下垂一截：哈登的胡子比下巴低 7cm 左右
    for(const s of [1,-1])m.c('head',[s*.066*hd.jaw,1.792,-.004],[s*.079,1.846,-.012],.013,.011,'beard',.016);   // 鬓角连到头发
    m.se('head',[0,1.7905,.098],[.021,.0088,.03],.004);                          // 嘴露出来
    plane([0,1,.4],1.845);                                                        // 上沿：前低（唇上须）后高（鬓角）
  });
  // 手臂
  for(const [sd,s] of [['L',1],['R',-1]]){
    const u='upperArm'+sd,f='foreArm'+sd,h='hand'+sd,x={s};
    s0.e(u,[s*.202,1.558,-.012],[.046,.050,.050],'skin',.032,{s,mus:1});            // 三角肌：高度压低至肩带以下，绝不比肩带高
    s0.c(u,[s*.2,1.56,-.01],[s*.215,1.29,-.02],.05,.04,'skin',.025,x);
    s0.e(u,[s*.211,1.44,.014],[.034,.07,.034],'skin',.026,{s,mus:1});            // 肱二头：收小、贴骨，修长线条
    s0.e(u,[s*.216,1.45,-.028],[.037,.08,.034],'skin',.026,{s,mus:1});           // 肱三头
    s0.e(f,[s*.215,1.28,-.022],[.037,.037,.037],'skin',.02,x);           // 肘
    s0.c(f,[s*.215,1.28,-.02],[s*.228,1.0,0],.044,.028,'skin',.02,x);
    s0.e(f,[s*.221,1.21,.002],[.037,.066,.035],'skin',.024,{s,mus:1});           // 肱桡肌
    // 手掌：薄掌骨 + 三块肉垫围出掌心凹陷 + 手背指节棱
    s0.e(h,[s*.229,.984,0],[.017,.02,.029],'hand',.012,x);                      // 腕
    s0.b(h,[s*.232,.938,.002],[.0098,.046,.040],.0085,'hand',.012,x);           // 掌骨板
    s0.e(h,[s*(.232-.0085),.95,.023],[.0105,.03,.019],'palm',.01,x);             // 大鱼际（拇指根）
    s0.e(h,[s*(.232-.0075),.934,-.026],[.0085,.034,.013],'palm',.01,x);          // 小鱼际
    s0.e(h,[s*(.232-.0068),.899,.001],[.0075,.0095,.037],'palm',.008,x);         // 指根肉垫
    s0.e(h,[s*(.232+.0062),.898,.001],[.0062,.0085,.039],'hand',.008,x);         // 手背指节棱
    {const HSD=(HANDS&&HANDS[sd])||solveHand(s,null,null),N0=[-s,0,0];
      for(let i=0;i<4;i++){const F=HSD.f[i],pt=chainPts(F.K,F.d0,N0,FINGER.L[i],F.a),r0=FINGER.r[i];
        const tag=i===0?'finger0':'finger',rr=[r0,r0*.93,r0*.87,r0*.8];
        let th=0;
        for(let j=0;j<3;j++){th+=F.a[j];
          // 每节记住"指腹朝向"：指腹一侧上掌心色，指尖背面上指甲色
          const c=Math.cos(th),sn=Math.sin(th),pn=[-F.d0[0]*sn+N0[0]*c,-F.d0[1]*sn+N0[1]*c,-F.d0[2]*sn+N0[2]*c];
          s0.c(h,pt[j],pt[j+1],rr[j],rr[j+1],tag,j?.0035:.006,{s,pn,pa:pt[j],pb:pt[j+1],tip:j===2,fb:'f'+sd+i+j});}
      }
      const t=HSD.t,tp=chainPts(t.B,t.d0,t.n0,THUMB.L,t.a);
      for(let j=0;j<3;j++)s0.c(h,tp[j],tp[j+1],THUMB.r[j],j<2?THUMB.r[j+1]:THUMB.r[2]*.86,'thumb',j?.004:.009,{s,pn:t.n0,pa:tp[j],pb:tp[j+1],tip:j===2,fb:j?'t'+sd+j:null});
    }
  }
  // 腿
  for(const [sd,s] of [['L',1],['R',-1]]){
    const t='thigh'+sd,n='shin'+sd,f='foot'+sd,x={s};
    s0.c(t,[s*.095,1.0,0],[s*.1,.56,.01],.085,.055,'skin',.03,x);
    s0.e(t,[s*.1,.8,.035],[.07,.16,.058],'skin',.03,{s,mus:1});                  // 股四头
    s0.e(t,[s*.075,.62,.03],[.04,.055,.04],'skin',.02,{s,mus:1});                // 股内侧肌（泪滴）
    s0.e(t,[s*.095,.8,-.04],[.065,.15,.055],'skin',.03,{s,mus:1});               // 腘绳肌
    s0.e(n,[s*.1,.55,.015],[.05,.05,.05],'skin',.02,x);                  // 膝
    s0.e(n,[s*.1,.555,.05],[.028,.032,.018],'skin',.012,x);              // 髌骨
    s0.c(n,[s*.1,.55,.01],[s*.105,.095,-.01],.048,.03,'skin',.02,x);
    s0.e(n,[s*.108,.42,-.035],[.05,.1,.05],'skin',.025,{s,mus:1});               // 腓肠肌外侧
    s0.e(n,[s*.09,.43,-.03],[.045,.09,.045],'skin',.025,{s,mus:1});              // 腓肠肌内侧
    s0.e(f,[s*.105,.09,-.01],[.033,.033,.033],'skin',.02,x);             // 踝
    s0.b(f,[s*.105,.04,.05],[.04,.03,.12],.02,'skin',.02,x);
  }

  /* ---------- 球衣（主场金，紫白滚边） ---------- */
  const JE=layer('jersey',1,jerseyColor),j=mk(JE);
  j.e('chest',[0,1.43,0],[.175,.175,.126],'j',.03);
  for(const s of [1,-1]){
    j.e('chest',[s*.072,1.47,.048],[.082,.062,.032],'j',.03);             // 球衣胸部
    j.e('chest',[s*.118,1.42,-.035],[.08,.15,.085],'j',.03);            // 背阔肌外侧
    j.e('chest',[s*.104,1.625,-.008],[.058,.036,.065],'j',.03);          // 肩带：宽度标准精干（~5.4cm）
    j.e('chest',[s*.108,1.565,.025],[.056,.045,.036],'j',.03);           // 肩带前侧锁骨过渡
  }
  j.e('chest',[0,1.56,-.035],[.155,.08,.085],'j',.03);
  /* 腹部到腰：球衣是从胸口直直垂下来的布，只比胸口略收（倒三角靠肩宽，不靠掐腰）；
     腰带处宽度和短裤顶端接上，不留台阶 */
  j.e('spine',[0,1.22,.002],[.166,.16,.116],'j',.035);
  j.e('pelvis',[0,1.08,-.01],[.172,.11,.132],'j',.04);
  JE.cuts=[j.se('chest',[0,1.71,.028],[.082,.092,.085],.015),j.se('chest',[0,1.71,-.035],[.078,.072,.078],.015),
           j.se('chest',[.238,1.49,-.014],[.094,.175,.145],.012),j.se('chest',[-.238,1.49,-.014],[.094,.175,.145],.012)];   // 袖口开深：NBA 球衣的大袖窿，露出腋下
  for(const P of JE.cuts.slice(2))P.keepR=1;   // 袖口大小不随体格加粗放大（举手时腋下不空） // 袖口：收回到正常深度（下沿约在胸大肌下缘）

  /* ---------- 短裤（缎面，紫色侧条白边） ---------- */
  const SH=layer('shorts',2,shortsColor),h=mk(SH);
  const sw=CH.shortsW||1,hem=CH.hem||.565;
  /* 短裤主体用圆角方盒：腰带处就有 ~.17 的宽度和球衣接上，往下几乎等宽；
     裤管从髋关节下方 7cm 才开始、往下外扩到裤口——篮球短裤的 A 字轮廓，髋部不鼓包 */
  h.b('pelvis',[0,1.0,-.008],[.176*Math.min(sw,1.04),.14,.128],.06,'w',.03);
  for(const [sd,s] of [['L',1],['R',-1]]){
    h.e('pelvis',[s*.066,.955,-.05],[.084,.09,.074],'w',.03,{s});
    /* 裤管口（年代不同长短不同：乔丹齐膝上，艾弗森过膝）。篮球短裤是 A 字：越往裤口越宽、往外撇，
       裤口离大腿外侧 3cm 左右的空——新 AO 下裤管里会暗下去，一看就是宽松的布，不是贴腿的涂层 */
    h.c('thigh'+sd,[s*.098,.93,0],[s*.123,hem-.025,.012],.106*Math.sqrt(sw),.112*sw,'leg',.03,{s,clip:[0,-1,0,-hem]});   // 外扩往外撇，内侧不加宽：两腿之间留缝，不成裙子
    /* 褶：裤腿正面两道、侧后一道浅凹槽（深约 1 格），从胯下斜向裤口散开——布被大腿撑开的走向 */
    for(const [x0,x1,z0,z1,y0,y1] of [[-.035,-.05,.1,.112,.86,hem+.07],[.03,.05,.104,.114,.83,hem+.09],[.078,.1,-.06,-.07,.84,hem+.08]]){
      const a=[s*(.1+x0),y0,z0],b=[s*(.106+x1),y1,z1];
      SH.prims.push(prep({t:1,bone:BI['thigh'+sd],a,b,r1:.0045,r2:.0075,k:.007,op:'s',s}));}
  }
  h.pl('pelvis',[0,1,0],1.112);         // 腰头

  /* ---------- 中筒袜 ---------- */
  const SO=layer('socks',1,sockColor),o=mk(SO);
  for(const [sd,s] of [['L',1],['R',-1]]){
    o.c('shin'+sd,[s*.1,.34,-.005],[s*.105,.09,-.01],.043,.036,'sock',.02,{s,clip:[0,1,0,.31]});
    o.e('shin'+sd,[s*.1,.3,-.03],[.046,.05,.046],'sock',.02,{s,clip:[0,1,0,.31]});
    o.e('foot'+sd,[s*.105,.09,-.01],[.037,.037,.037],'sock',.02,{s});
  }

  /* ---------- 球鞋（Kobe经典低帮，鞋头微翘+倾斜鞋舌+弧形大底） ---------- */
  const SE=layer('shoes',3,shoeColor),e=mk(SE);
  for(const [sd,s] of [['L',1],['R',-1]]){
    const f='foot'+sd,x={s,clip:[0,1,0,.132]};
    // 大底：后跟稳厚微圆弧，前掌上扬微翘弧度 (Toe Spring)
    e.b(f,[s*.105,.016,-.032],[.046,.016,.072],.012,'sole',.01,x);
    e.c(f,[s*.105,.016,.025],[s*.105,.030,.156],.045,.036,'sole',.014,x);
    // 鞋身：后跟包裹收紧弧度
    e.e(f,[s*.105,.066,-.060],[.044,.046,.044],'up',.02,x);
    // 鞋头：前掌微翘圆润流线鞋头
    e.e(f,[s*.105,.038,.146],[.041,.026,.040],'up',.018,x);
    // 鞋舌与鞋背：倾斜 38 度流线坡度（鞋舌到鞋头呈现顺畅下滑弧度）
    e.c(f,[s*.105,.050,.092],[s*.105,.110,-.005],.038,.042,'up',.022,x);
    // 鞋身前掌侧壁弧度
    e.e(f,[s*.105,.044,.075],[.044,.028,.055],'up',.020,x);
  }

  /* ---------- 右臂护套 ---------- */
  const SLV=sleeveSpec();
  if(SLV){
    const SL=layer('sleeve',2,sleeveColor),l=mk(SL),sd=SLV.side,s=sd==='L'?1:-1;
    const cl={clip:[0,1,0,1.475]};
    // 压缩护套：只比皮肤厚 2~3mm；手腕处收口到腕围，不再是一截粗筒
    l.c('upperArm'+sd,[s*.207,1.47,-.012],[s*.215,1.29,-.02],.052,.0425,'sl',.02,cl);
    l.e('upperArm'+sd,[s*.211,1.44,.014],[.0365,.072,.0365],'sl',.024,{...cl,mus:1});
    l.e('upperArm'+sd,[s*.216,1.45,-.028],[.0395,.082,.0365],'sl',.024,{...cl,mus:1});
    l.e('foreArm'+sd,[s*.215,1.28,-.022],[.039,.039,.039],'sl',.02);
    l.c('foreArm'+sd,[s*.215,1.28,-.02],[s*.228,1.0,0],.0465,.0295,'sl',.02,{clip:[0,-1,0,-1.0]});
    l.e('foreArm'+sd,[s*.221,1.21,.002],[.0395,.068,.0375],'sl',.022,{mus:1});
  }
  /* ---------- 右手食指胶布（09-10 赛季骨折） ---------- */
  /* ---------- 标志性配件（档案里一行配置）：护肘 / 小腿套 / 紧身裤 / 紧身衣 / 护膝 ----------
     都是贴着皮肤外扩几毫米的外壳层，写在 1.98m 设计空间里，后处理跟体格、身高一起换算 */
  const solid=c=>()=>set(c,MAT.cloth);
  if(CH.elbowPad){const E=CH.elbowPad,ly=layer('elbowPad',2,solid(E.col)),l=mk(ly);
    for(const sd of E.sides||['L']){const s=sd==='L'?1:-1,u='upperArm'+sd,f='foreArm'+sd;   // 肘关节上下各一截，比护套厚
      l.c(u,[s*.214,1.385,-.016],[s*.215,1.29,-.02],.05,.048,'ep',.02,{clip:[0,1,0,1.385]});
      l.e(f,[s*.215,1.28,-.022],[.046,.046,.046],'ep',.02);
      l.c(f,[s*.215,1.28,-.02],[s*.221,1.175,-.008],.05,.045,'ep',.02,{clip:[0,-1,0,-1.175]});}}
  if(CH.calf){const K2=CH.calf,ly=layer('calf',2,solid(K2.col)),l=mk(ly);
    for(const sd of K2.sides||['L','R']){const s=sd==='L'?1:-1,n='shin'+sd,cl={clip:[0,1,0,.49]};   // 膝下到脚踝，盖过袜口
      l.c(n,[s*.1,.49,.01],[s*.105,.1,-.01],.051,.035,'cs',.02,cl);
      l.e(n,[s*.108,.42,-.035],[.054,.104,.054],'cs',.025,{...cl,mus:1});
      l.e(n,[s*.09,.43,-.03],[.049,.094,.049],'cs',.025,{...cl,mus:1});}}
  if(CH.tights){const TI=CH.tights,ly=layer('tights',1,solid(TI.col)),l=mk(ly),end=TI.end||.42;
    for(const [sd,s] of [['L',1],['R',-1]]){const t='thigh'+sd,n='shin'+sd;   // 短裤下面露出一截，到膝下（end）
      l.c(t,[s*.095,1.0,0],[s*.1,.56,.01],.09,.06,'ti',.03);
      l.e(t,[s*.1,.8,.035],[.074,.164,.062],'ti',.03,{mus:1});l.e(t,[s*.095,.8,-.04],[.069,.154,.059],'ti',.03,{mus:1});
      l.e(t,[s*.075,.62,.03],[.044,.059,.044],'ti',.02,{mus:1});
      l.e(n,[s*.1,.55,.015],[.054,.054,.054],'ti',.02);
      l.c(n,[s*.1,.55,.01],[s*.104,end,0],.052,.046,'ti',.02,{clip:[0,-1,0,-end]});
      l.e(n,[s*.108,.44,-.035],[.054,.09,.054],'ti',.025,{mus:1,clip:[0,-1,0,-end]});}}
  /* 紧身衣：球衣底下，袖口处露出短袖。带 cuff 时袖口一圈滚边——骑士 2016 有袖球衣就是这么拼出来的 */
  if(CH.undershirt){const U=CH.undershirt,ly=layer('undershirt',1,U.cuff?(tag,x,y)=>set(y/HY<1.412?U.cuff:y/HY<1.42&&U.cuff2!=null?U.cuff2:U.col,MAT.cloth):solid(U.col)),l=mk(ly);
    l.e('chest',[0,1.43,0],[.171,.17,.123],'us',.032);l.e('chest',[0,1.56,-.035],[.15,.075,.08],'us',.03);
    for(const s of [1,-1]){const u='upperArm'+(s>0?'L':'R');
      l.e('chest',[s*.118,1.42,-.035],[.075,.145,.08],'us',.03);l.e('chest',[s*.072,1.635,-.022],[.074,.046,.056],'us',.035);
      l.e(u,[s*.202,1.558,-.012],[.05,.054,.054],'us',.03,{mus:1});
      l.c(u,[s*.2,1.56,-.01],[s*.212,1.4,-.016],.056,.05,'us',.025,{clip:[0,-1,0,-1.4]});}}
  if(CH.kneePads){const KP=CH.kneePads,ly=layer('kneePad',2,(tag,x,y)=>set(Math.abs(y/HY-.55)<.012?(KP.band!=null?KP.band:KP.col):KP.col,MAT.cloth)),l=mk(ly);
    for(const [sd,s] of [['L',1],['R',-1]]){const n='shin'+sd,t='thigh'+sd;   // 护膝：膝盖前一块厚垫 + 上下一圈套筒
      l.c(t,[s*.1,.66,.012],[s*.1,.56,.012],.062,.06,'kp',.02,{clip:[0,1,0,.66]});
      l.e(n,[s*.1,.55,.03],[.058,.062,.05],'kp',.02);
      l.c(n,[s*.1,.55,.01],[s*.102,.45,0],.058,.052,'kp',.02,{clip:[0,-1,0,-.45]});}}
  if(CH.tape){const TP=layer('tape',3,()=>set(C.tape,MAT.cloth)),tp=mk(TP);
  const HSD=(HANDS&&HANDS.R)||solveHand(-1,null,null),F=HSD.f[0],pt=chainPts(F.K,F.d0,[1,0,0],FINGER.L[0],F.a);
   tp.c('handR',pt[0],pt[1],FINGER.r[0]+.0022,FINGER.r[0]*.92+.0022,'tape',.004,{fb:'fR00'});}

  /* ---------- 篮球 ---------- */
  const BA=layer('ball',4,ballColor);
  BA.prims.push(prep({t:0,bone:BI.ball,c:[0,0,0],r:[.121,.121,.121],tag:'ball',k:.001,op:'u'}));
  /* 体格后处理：头以外的原语，位置左右 ×W；半径 ×G（手臂、腿再乘各自系数），肌肉块收小、融合加大。
     手掌手指只随骨架左右挪，不加粗；平面裁切不动。头身比变体的四肢加粗 LG 也在这里一起乘。 */
  /* 身高：头、手以外的原语纵向 ×HY（竖直的裁切面、平面一起换算）；手只整体上下平移 */
  {const B=BUILD,ARM=/^(upperArm|foreArm)/,LEGR=/^(thigh|shin)/,LIMB=/^(upperArm|foreArm|thigh|shin|foot)/;
    for(const ly of L)for(const P of ly.prims){
      const bn=BN[P.bone].name;if(bn==='head'||bn==='ball')continue;
      const hand=/^hand/.test(bn),Y=v=>hand?v+HAND_DY:v*HY;
      if(P.t===3){if(!hand&&Math.abs(P.nx)+Math.abs(P.nz)<1e-6)P.off*=HY;continue;}
      if(P.c)P.c=[P.c[0]*B.W,Y(P.c[1]),P.c[2]];if(P.t===1){P.a=[P.a[0]*B.W,Y(P.a[1]),P.a[2]];P.b=[P.b[0]*B.W,Y(P.b[1]),P.b[2]];}
      if(P.pa){P.pa=[P.pa[0]*B.W,Y(P.pa[1]),P.pa[2]];P.pb=[P.pb[0]*B.W,Y(P.pb[1]),P.pb[2]];}
      if(P.clip&&!hand&&P.clip[0]===0&&P.clip[2]===0)P.clip=[0,P.clip[1],0,P.clip[3]*HY];
      if(!hand){if(P.t===0)P.r=[P.r[0],P.r[1]*HY,P.r[2]];else if(P.t===2)P.h=[P.h[0],P.h[1]*HY,P.h[2]];}
      if(hand||P.keepR){prep(P);continue;}
      let f=B.G*(ARM.test(bn)?B.ARM:LEGR.test(bn)?B.LEG:1)*(LIMB.test(bn)?LG:1);const fx=f*B.W;
      let mx=1;if(P.mus){mx=B.MUS;P.k*=B.MUSK;}
      if(P.t===0)P.r=[P.r[0]*fx*mx,P.r[1],P.r[2]*f*mx];
      else if(P.t===1){P.r1*=f;P.r2*=f;}
      else if(P.t===2)P.h=[P.h[0]*fx,P.h[1],P.h[2]*f];
      prep(P);}}
  LAYERS=L;
}

/* ---------- 上色函数（坐标都在静止姿态空间） ---------- */
function skinColor(tag,x,y,z,P){
  if(tag==='head')return headColor(x,y,z);
  if(tag==='ear'){const [dx,dy,dz]=headDesign(x,y,z),q=Math.hypot((Math.abs(dx)-.096)/.008,(dy-1.852)/.014,(dz+.009)/.011);
    return set(C.skin,MAT.skin,q<1?.68:.93);}                                  // 耳甲腔里暗一档
  if(tag==='palm')return set(C.palm,MAT.skin);
  if(tag==='hand'){const inner=P.s*x/BUILD.W<.232-.004;return inner?set(C.palm,MAT.skin):set(C.skin,MAT.skin,.96);}
  if(tag==='finger'||tag==='finger0'||tag==='thumb'){
    // 投影到这一节的轴上，看点在指腹侧还是指背侧
    const ax=P.pb[0]-P.pa[0],ay=P.pb[1]-P.pa[1],az=P.pb[2]-P.pa[2],l2=ax*ax+ay*ay+az*az||1;
    const t=clamp(((x-P.pa[0])*ax+(y-P.pa[1])*ay+(z-P.pa[2])*az)/l2,0,1);
    const side=(x-P.pa[0])*P.pn[0]+(y-P.pa[1])*P.pn[1]+(z-P.pa[2])*P.pn[2];
    if(side>.0045)return set(C.palm,MAT.skin,.97);
    if(P.tip&&t>.45&&side<-.003)return set(mixHex(C.palm,0xc7a192,.5),MAT.skin);            // 指甲
    return set(C.skin,MAT.skin,.95);
  }
  if(tag==='skin'&&P&&/^(upperArm|foreArm)/.test(BN[P.bone].name)&&tattooAt(x,y,z,P.s||1))return set(C.skin,MAT.skin,.52);
  return set(C.skin,MAT.skin);
}
/* ---------- 脸部像素图（1.2cm 专用，逐格手摆） ----------
   14 列 × 22 行，定义在头骨静止空间（头已放大 12%）。列中心 x = ±.006 … ±.078
   （第 0 列是角色右脸 = 画面左侧），第 8 行是眼睛（y = EYE_Y），每行 1.2cm。
   头部单独在自己的局部网格里体素化，网格和这张图逐格对齐——转头、仰头时五官不错位。
   科比是贴头皮的光头寸：头发只比皮肤深一档（H），发际线边缘干脆。
   s 皮 l 受光 d 暗 n 鼻侧 D 深 | H 寸头 B 眉 | W 眼白 w 眼白(内眦压暗) E 瞳
   u 上唇 m 唇缝 p 下唇 | b 胡 | . 回落到程序上色 */
const FACE_KOBE=[
 "HHHHHHHHHHHHHH", //  0 头顶
 "HHHHHHHHHHHHHH", //  1
 "HHHHHHHHHHHHHH", //  2
 "HHHHHHHHHHHHHH", //  3
 "ssHHHHHHHHHHss", //  4 发际线：正面平直，额角圆收
 "sdllllllllllds", //  5 高额头受光
 "dBBBBBllBBBBBd", //  6 眉：浓、平
 "sBdddnllndddBs", //  7 眉尾下压 + 深眼窝阴影
 "sddWEwllwEWdds", //  8 眼：外眼白 · 瞳 · 压暗的内眼白
 "slsddsllsddsls", //  9 下眼睑、颧骨高光起点
 "dllssdlldsslld", // 10 颧骨、鼻梁受光
 "dsdssnllnssdsd", // 11 鼻头、颧下凹
 "dsdsdDnnDdsdsd", // 12 鼻孔、鼻翼沟
 "dsssdsnnsdsssd", // 13 人中、法令纹
 "dssdskbbksdssd", // 14 细唇上须：中间两格实、两端浅
 "dssdkummukdssd", // 15 唇缝两格，嘴角浅胡往下带
 "sssdsppppsdsss", // 16 下唇（和皮肤接近，不再像张嘴）
 "sssssdbbdsssss", // 17 唇下一小撮
 "ssssskbbksssss", // 18 下巴山羊胡：窄
 ".ssssbbbbssss.", // 19 下巴
 "..sssdbbdsss..", // 20 下巴底
 "....dddddd....", // 21 下颌下
];
let FACE=FACE_KOBE,FACE_ON=false;
function faceMap(x,y,z){
  if(!FACE_ON||z<.03)return null;
  const col=Math.floor(x/CELL)+7,row=Math.round((EYE_Y-y)/CELL)+8;
  if(col<0||col>13||row<0||row>=FACE.length)return null;
  switch(FACE[row][col]){
    case 's':return set(C.skin,MAT.skin);case 'l':return set(C.skin,MAT.skin,1.14);case 'd':return set(C.skin,MAT.skin,.8);
    case 'n':return set(C.skin,MAT.skin,.7);case 'D':return set(0x2a140d,MAT.skin);
    case 'H':return set(buzzC(headDesign(x,y,z)[1]),MAT.skin);   // 光头寸：按皮肤材质走（有皮肤的光泽）
    case 'L':return set(C.skin,MAT.skin,1.2);   // 光头头顶高光
    case 'B':if(CH.browProc)return null;return set(C.brow,MAT.hair);   // 科比沿用原来的程序眉
    case 'E':return set(C.iris,MAT.eye);case 'W':return set(C.sclera,MAT.eye,.82);case 'w':return set(C.sclera,MAT.eye,.66);
    case 'm':return set(C.mouth,MAT.skin);case 'p':return set(C.lipLo!=null?C.lipLo:0x57301f,MAT.skin);case 'u':return set(C.lipUp,MAT.skin,.92);   // 下唇压暗：受光后不再像张嘴
    case 'b':return set(C.beard,MAT.hair);case 'k':return set(CH.id==='kobe'?0x4a3024:mixHex(C.beard,C.skin,.45),MAT.hair);
  }
  return null;
}
/* =====================================================================
   3b. 球星档案（ROSTER）：同一套骨架、同一套建模代码，按档案换
       身高 h（骨架纵向倍率）、体格 build、肤色、发型几何（hair）、胡子几何（beard）、
       脸部像素图（face）、球衣 / 短裤 / 鞋袜配色（kit）、字样号码（front/back/num）、护具。
   face 图同科比那张：14 列 × 22 行，逐格对齐头部体素。
     s 皮 l 受光 L 头顶高光 d 暗 n 鼻侧 D 深 | H 寸头 B 眉 | W 眼白 w 眼白暗 E 瞳 | u 上唇 m 唇缝 p 下唇 | b 胡 k 浅胡
   ===================================================================== */
const EYES=[
 "sddWEwllwEWdds", //  8 眼（麦迪另有半闭的一行，见 faceOf 的 eyes 参数）
 "slsddsllsddsls", //  9
 "dllssdlldsslld"];// 10
const faceOf=(top,brow,mid,low,eyes)=>{const F=[...top,...brow,...(eyes||EYES),...mid,...low];
  if(F.length!==22||F.some(r=>r.length!==14))throw new Error('脸部像素图尺寸不对');return F;};
const BALD_TOP=["LLLLLLLLLLLLLL","lLLLLLLLLLLLLl","llllllllllllll","slllllllllllls","ssllllllllllss","sdllllllllllds"];
const HAIR_TOP=["HHHHHHHHHHHHHH","HHHHHHHHHHHHHH","HHHHHHHHHHHHHH","HHHHHHHHHHHHHH","ssHHHHHHHHHHss","sdllllllllllds"];
const FACES={
  jordan:faceOf(BALD_TOP,
   ["ddBBBBllBBBBdd","sBdddnllndddBs"],
   ["dsdsnnllnnsdsd","dsdsDDnnDDsdsd","dsssdsnnsdsssd"],          // 宽鼻翼
   ["dssdskkkksdssd","dssdsummusdssd","sssdsppppsdsss","sssssdssdsssss","ssssssllssssss",".ssssssssssss.","..sssddddsss..","....dddddd...."]),   // 细唇上须，下巴干净
  iverson:faceOf(HAIR_TOP,
   ["dsBBBsllsBBBsd","ssdddnllndddss"],
   ["dsdssnllnssdsd","dsdsdDnnDdsdsd","dsssdsnnsdsssd"],
   ["dssdkbbbbkdssd","dssbkummukbssd","sssbsppppsbsss","sssbsdbbdsbsss","ssssbbbbbbssss",".sssbbbbbbsss.","..ssskbbksss..","....dddddd...."]),   // 细胡连到下巴的一圈山羊胡
  carter:faceOf(HAIR_TOP,
   ["dBBBBsllsBBBBd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","dsdsDDnnDDsdsd","dsssdsnnsdsssd"],
   ["dssdkbbbbkdssd","dssdkummukdssd","sssdsppppsdsss","sssssdbbdsssss","ssssskbbksssss",".sssssbbsssss.","..sssddddsss..","....dddddd...."]),
  nowitzki:faceOf(HAIR_TOP,
   ["dsBBBBllBBBBsd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","ksdsdDnnDdsdsk","bsssdsnnsdsssb"],          // 窄鼻，满脸短胡从颧下开始
   ["bbssbbbbbbssbb","bbsbkummukbsbb","bbbbsppppsbbbb","bbbbbbbbbbbbbb","bbbbbbbbbbbbbb",".bbbbbbbbbbbb.","..bbbbbbbbbb..","....bbbbbb...."]),
  allen:faceOf(BALD_TOP,
   ["ddBBBBllBBBBdd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","dsdsdDnnDdsdsd","dsssdsnnsdsssd"],
   ["dssdssllssdssd","dssdsummusdssd","sssdsppppsdsss","sssssdssdsssss","ssssssllssssss",".ssssssssssss.","..sssddddsss..","....dddddd...."]),   // 干净无胡
  curry:faceOf(HAIR_TOP,
   ["ddBBBBllBBBBdd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","dsdsdDnnDdsdsd","dsssdsnnsdsssd"],
   ["dssdkkkkkkdssd","dssdkummukdssd","sssdsppppsdsss","ssssskkkksssss","sssskkkkkkssss",".ssskkkkkksss.","..ssskkkksss..","....dddddd...."]),   // 淡胡茬
  mcgrady:faceOf(HAIR_TOP,
   ["dsBBBBllBBBBsd","sdnnnnllnnnnds"],          // 眼皮厚、压得低：招牌的"没睡醒"眼神
   ["dsdssnllnssdsd","dsdsDDnnDDsdsd","dsssdsnnsdsssd"],
   ["dssdkbbbbkdssd","dssdkummukdssd","sssdsppppsdsss","sssssdbbdsssss","sssssbbbbsssss",".sssssbbsssss.","..sssddddsss..","....dddddd...."],
   ["sdswEwllwEwsds","slsddsllsddsls","dllssdlldsslld"]),
  harden:faceOf(HAIR_TOP,
   ["dBBBBBllBBBBBd","sBBddnllnddBBs"],
   ["bsdssnllnssdsb","bbdsdDnnDdsdbb","bbbsbbbbbbsbbb"],          // 大胡子从颧骨下就开始
   ["bbbbbbbbbbbbbb","bbbbbummubbbbb","bbbbbppppbbbbb","bbbbbbbbbbbbbb","bbbbbbbbbbbbbb",".bbbbbbbbbbbb.","..bbbbbbbbbb..","....bbbbbb...."]),
  irving:faceOf(HAIR_TOP,
   ["dBBBBsllsBBBBd","sBdddnllndddBs"],          // 眉浓、眉峰略挑（试过把眉尾抬进第 5 行：和发际线连成一片，额头没了）
   ["dsdssnllnssdsd","ksdsdDnnDdsdsk","bkssdsnnsdsskb"],          // 胡子从颧下开始，但比哈登低、薄
   ["bbsdkbbbbkdsbb","bbsdbummubdsbb","bbbdsppppsdbbb","bbbbbdbbdbbbbb","bbbbbbbbbbbbbb",".bbbbbbbbbbbb.","..kbbbbbbbbk..","....dddddd...."]),   // 修整齐的短络腮胡，唇下留一道皮肤
  durant:faceOf(["HHHHHHHHHHHHHH","HHHHHHHHHHHHHH","HHHHHHHHHHHHHH","sHHHHHHHHHHHHs","ssHHHHHHHHHHss","sdllllllllllds"],   // 发际线两角往后退
   ["dsBBBsllsBBBsd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","dsdsDDnnDDsdsd","dsssdsnnsdsssd"],
   ["dssdkbbbbkdssd","dssdbummubdssd","sssdsppppsdsss","sssssdbbdsssss","kssssbbbbssssk",".bssskbbksssb.","..bbskbbksbb..","....dddddd...."]),   // 细上须 + 山羊胡，一道细线沿下颌连过去
  doncic:faceOf(HAIR_TOP,
   ["dsBBBBllBBBBsd","sBdddnllndddBs"],
   ["dsdssnllnssdsd","ksdsdDnnDdsdsk","kssssdnndssssk"],          // 圆脸，胡茬从颧下就有
   ["kssdkkkkkkdssk","kssdkummukdssk","kksdsppppsdskk","kkkssdkkdssskk","kkkkskkkkskkkk",".kkkkkkkkkkkk.","..kkkkkkkkkk..","....dddddd...."]),   // 满脸短胡茬，唇上唇下略重
};
/* 肤色一族：皮、暗皮、掌心、唇 */
const mixHex=(a,b,t)=>{const c=(h,s)=>(h>>s)&255,m=s=>Math.round(c(a,s)+(c(b,s)-c(a,s))*t);return (m(16)<<16)|(m(8)<<8)|m(0);};
const mulHex=(a,k)=>mixHex(a,0,1-k);
function skinSet(skin,o){return Object.assign({skin,skinLo:mulHex(skin,.84),palm:mixHex(skin,0xe0b09a,.42),
  lip:mixHex(mulHex(skin,.6),0x6a2a22,.25),lipUp:mulHex(skin,.5),mouth:mulHex(skin,.29),lid:mulHex(skin,.29)},o||{});}
/* 球衣配色：jersey 主色 / trimA 外滚边 / trimB 内滚边 / text 胸前字 / num 号码（S 结尾是描边色） */
const ROSTER={
  kobe:{id:'kobe',n:'科比 · 2009-10 湖人主场金',front:'LAKERS',back:'BRYANT',num:'24',h:1,
    build:{},skinC:skinSet(0x7d4a31,{skinLo:0x693c28,palm:0xa06c55,lip:0x4b271e,lipUp:0x3e2019,mouth:0x241009,lid:0x24140d,
      hair:0x65493a,beard:0x2b1c15,brow:0x150e0a}),
    face:FACE_KOBE,browProc:true,hair:'kobe',beardSide:0,jawStubble:true,tape:true,
    kit:{jersey:0xf7a912,trimA:0x552583,trimB:0xf1efea,text:0x552583,textS:0xf1efea,num:0x552583,numS:0xf1efea,
      shorts:0xf7a912,sStripe:0x552583,sEdge:0xf1efea,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf7a912,shoeAcc:0x552583,shoeMid:0xf1efea,sole:0x4a2378,lace:0xf1efea,shoeLogo:'swoosh',logoC:0x552583},
    hem:.565},
  jordan:{id:'jordan',n:'乔丹 · 1997-98 公牛客场红',front:'CHICAGO',back:'JORDAN',num:'23',h:1,
    build:{W:1.04,G:1.06,ARM:1.12,LEG:1.07},skinC:skinSet(0x6b3e29,{hair:0x5d3a28,beard:0x1d130e,brow:0x120b08}),
    face:FACES.jordan,hair:'bald',beardSide:0,jawStubble:false,hd:{nose:1.18,lip:1.1,jaw:1.04,ear:1.08},
    elbowPad:{col:0x121214,sides:['L']},   // 左肘黑色护肘
    kit:{jersey:0xce1141,trimA:0x121214,trimB:0xf1efea,text:0x121214,textS:0xf1efea,num:0x121214,numS:0xf1efea,
      shorts:0xce1141,sStripe:0x121214,sEdge:0xf1efea,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0x141416,shoeAcc:0x141416,shoeMid:0xf1efea,sole:0xc8102e,lace:0x141416,shoeLogo:'none',logoC:0xc8102e},
    hem:.6,shortsW:1.02},
  /* 1997-2009 76 人主场白：黑色号码红边（NBA.com 球衣史）；SIXERS 字样 i 上一颗银星红边、第二个 S 下一颗拖着蓝银尾巴的篮球，
     V 领尖上一颗星（sportslogos 对这套的描述） */
  iverson:{id:'iverson',n:'艾弗森 · 2000-01 76人主场白',front:'SIXERS',back:'IVERSON',num:'3',h:.925,decor:'sixers',collarStar:[0xd0a73c,0x121214],
    build:{W:.95,G:.93,ARM:1.02,LEG:1,MUS:.8},skinC:skinSet(0x7a4630,{hair:0x1b1411,beard:0x1b1411,brow:0x120b08}),
    face:FACES.iverson,hair:'cornrows',headband:0xf4f2ec,beardSide:0,jawStubble:true,headS:.97,hd:{jaw:.94,face:.96,nose:1.05},
    sleeve:{side:'R',col:0xf4f2ec,cuff:0xf4f2ec,full:true},tattoo:true,
    kit:{jersey:0xf4f2ec,trimA:0x121214,trimB:0xc8102e,text:0x121214,textS:0xd0a73c,textShadow:true,num:0x121214,numS:0xc8102e,name:0x121214,nameS:0xc8102e,
      shorts:0xf4f2ec,sStripe:0x121214,sEdge:0xc8102e,sock:0xf1efea,sockBand:0x121214,
      shoe:0xf1efea,shoeAcc:0x121214,shoeMid:0xf1efea,sole:0xc8102e,lace:0xf1efea,shoeLogo:'vector',logoC:0xc8102e},
    hem:.46,shortsW:1.12},
  /* 1999-2003 猛龙客场紫：胸前白色 TORONTO 红边（ESPN 对复刻版的描述），两侧黑色侧片（带红滚边、爪痕锯齿），
     短裤同款侧片。1995-99 那套才是恐龙大图 + 锯齿细条纹 + RAPTORS 字样 */
  carter:{id:'carter',n:'卡特 · 1999-00 猛龙客场紫',front:'TORONTO',back:'CARTER',num:'15',h:1,
    build:{W:1.03,G:1.04,ARM:1.12,LEG:1.08},skinC:skinSet(0x6a3d28,{hair:0x2e211a,beard:0x1a110d,brow:0x120b08}),
    face:FACES.carter,hair:'kobe',beardSide:0,jawStubble:true,hd:{nose:1.12,chin:1.05},
    kit:{jersey:0x5f2e94,trimA:0x121214,trimB:0xc8102e,text:0xf1efea,textS:0xc8102e,textShadow:true,num:0xf1efea,numS:0xc8102e,numS2:0x121214,
      side:{col:0x121214,pipe:0xc8102e,zig:true},
      shorts:0x5f2e94,sStripe:0x121214,sEdge:0xc8102e,sZig:true,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf1efea,shoeAcc:0x121214,shoeMid:0xf1efea,sole:0x121214,lace:0xf1efea,shoeLogo:'swoosh',logoC:0x121214},
    hem:.54,shortsW:1.06},
  nowitzki:{id:'nowitzki',n:'诺维茨基 · 2010-11 小牛客场蓝',front:'DALLAS',back:'NOWITZKI',num:'41',h:1.075,
    build:{W:.99,G:.96,ARM:1.04,LEG:1.01,MUS:.78},skinC:skinSet(0xd2a283,{hair:0x9b7a4f,beard:0x7d5e3c,brow:0x6b5236,iris:0x3e5a73,sclera:0xa99e94}),
    face:FACES.nowitzki,hair:'shaggy',beardSide:1.815,jawStubble:true,hd:{face:.97,jaw:.98,nose:.9,lip:.8,chin:1.12},
    kit:{jersey:0x0b5cad,trimA:0x0c2340,trimB:0xb8c4ca,text:0xf1efea,textS:0x0c2340,num:0xf1efea,numS:0x0c2340,numS2:0xb8c4ca,
      shorts:0x0b5cad,sStripe:0x0c2340,sEdge:0xb8c4ca,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf1efea,shoeAcc:0x0b5cad,shoeMid:0xf1efea,sole:0x0c2340,lace:0xf1efea,shoeLogo:'swoosh',logoC:0x0b5cad},
    hem:.55,shortsW:1.04},
  allen:{id:'allen',n:'雷·阿伦 · 2007-08 凯尔特人客场绿',front:'BOSTON',back:'ALLEN',num:'20',h:.99,
    build:{W:1.01,G:1.02,ARM:1.08,LEG:1.05},skinC:skinSet(0x8a5838,{hair:0x6b442c,beard:0x2a1b13,brow:0x160e0a}),
    face:FACES.allen,hair:'bald',beardSide:0,jawStubble:false,hd:{jaw:.98,nose:1.06},
    sleeve:{side:'L',col:0xf1efea,cuff:0xf1efea,full:true},   // 护袖
    kit:{jersey:0x007a33,trimA:0xf1efea,trimB:0x121214,text:0xf1efea,textS:0x121214,num:0xf1efea,numS:0x121214,
      shorts:0x007a33,sStripe:0xf1efea,sEdge:0x121214,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf1efea,shoeAcc:0x007a33,shoeMid:0xf1efea,sole:0x007a33,lace:0xf1efea,shoeLogo:'swoosh',logoC:0x007a33},
    hem:.55,shortsW:1.04},
  curry:{id:'curry',n:'库里 · 2015-16 勇士客场蓝',front:'GOLDEN/STATE',back:'CURRY',num:'30',h:.95,
    build:{W:.97,G:.95,ARM:1.03,LEG:1,MUS:.8},skinC:skinSet(0xa87552,{hair:0x231a15,beard:0x2a1f18,brow:0x1a120d}),
    face:FACES.curry,hair:'curly',beardSide:0,jawStubble:false,headS:.98,hd:{face:.97,jaw:.95,nose:.96,chin:.95},
    kneePads:{col:0x121214,band:0x2a2a30},   // 双护膝
    kit:{jersey:0x1d428a,trimA:0xffc72c,trimB:0x1d428a,text:0xffc72c,textS:0x1d428a,num:0xffc72c,numS:0x1d428a,
      shorts:0x1d428a,sStripe:0xffc72c,sEdge:0x1d428a,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0x1d428a,shoeAcc:0xffc72c,shoeMid:0xf1efea,sole:0xffc72c,lace:0xf1efea,shoeLogo:'none',logoC:0xffc72c},
    hem:.6,shortsW:1},
  /* 麦迪 2002-03 魔术客场蓝：蓝底上一层暗蓝星星纹，黑色侧片带银色滚边（SportsLogos / Bleacher Report 对这套的描述）；
     客场字样按城市名 ORLANDO 画、号码白字黑边——这两项没找到逐字资料。阿迪 T-Mac 2 白蓝三道杠。
     2.03m、臂长腿长、偏瘦；招牌的困倦眼。护套按 AIBA 原设定戴在左臂 */
  mcgrady:{id:'mcgrady',n:'麦迪 · 2002-03 魔术客场蓝',front:'ORLANDO',back:'MCGRADY',num:'1',h:1.03,
    build:{W:.98,G:.96,ARM:1.05,LEG:1.03,MUS:.8},skinC:skinSet(0x714530,{hair:0x2a1d16,beard:0x1c130e,brow:0x120b08}),
    face:FACES.mcgrady,hair:'kobe',beardSide:0,jawStubble:true,hd:{nose:1.1,lip:1.1,face:.98},
    sleeve:{side:'L',col:0x121214,cuff:0x121214,full:true},calf:{col:0x121214,sides:['L','R']},
    kit:{jersey:0x0077c0,trimA:0x121214,trimB:0xc4ced4,text:0xf1efea,textS:0x121214,num:0xf1efea,numS:0x121214,numS2:0xc4ced4,
      pattern:'stars',patC:0x0569ab,side:{col:0x121214,pipe:0xc4ced4},
      shorts:0x0077c0,sStripe:0x121214,sEdge:0xc4ced4,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf1efea,shoeAcc:0x0077c0,shoeMid:0xf1efea,sole:0x0077c0,lace:0xf1efea,shoeLogo:'stripes',logoC:0x0077c0},
    hem:.55,shortsW:1.08},
  harden:{id:'harden',n:'哈登 · 2017-18 火箭客场红（左手）',front:'ROCKETS',back:'HARDEN',num:'13',h:.99,mirror:true,
    build:{W:1.05,G:1.08,ARM:1.14,LEG:1.1,MUS:.8},skinC:skinSet(0x7a4b31,{hair:0x1b1410,beard:0x1b1410,brow:0x110b08}),
    face:FACES.harden,hair:'fade',beard:'full',beardSide:1.84,jawStubble:true,hd:{face:1.03,jaw:1.06,nose:1.12},
    sleeve:{side:'L',col:0x121214,cuff:0x121214,full:true},tattoo:true,tights:{col:0x121214,end:.4},
    kit:{jersey:0xce1141,trimA:0xf1efea,trimB:0x121214,text:0xf1efea,textS:0x121214,num:0xf1efea,numS:0x121214,numS2:0xb0b5b9,
      shorts:0xce1141,sStripe:0xf1efea,sEdge:0x121214,sock:0x121214,sockBand:0x121214,
      shoe:0xce1141,shoeAcc:0xf1efea,shoeMid:0xf1efea,sole:0xf1efea,lace:0xce1141,shoeLogo:'stripes',logoC:0xf1efea},
    hem:.6,shortsW:1.02},
  /* 欧文 2015-16 骑士黑色有袖客场（2016 总决赛 G5、G7 穿的那套）：胸口大号酒红 C 金边、酒红号码金边、背后金色名字，
     领口 / 短裤酒红金滚边（cavshistory 对这套的描述）。袖子用紧身衣层拼，袖口酒红 + 金。
     G7 绝杀库里那记三分脚上是 Kyrie 2 黑金。1.88m，比库里结实一点 */
  irving:{id:'irving',n:'欧文 · 2015-16 骑士黑色有袖（总决赛 G7）',front:'',back:'IRVING',num:'2',h:.95,decor:'cavsC',
    build:{W:.98,G:.97,ARM:1.05,LEG:1.03,MUS:.82},skinC:skinSet(0x93603f,{hair:0x1a1310,beard:0x1a1310,brow:0x110b08}),
    face:FACES.irving,hair:'crop',beardSide:1.83,jawStubble:true,headS:.98,hd:{face:.98,jaw:1.02,nose:1.06,chin:1.02},
    undershirt:{col:0x141416,cuff:0x6f263d,cuff2:0xffb81c},
    kit:{jersey:0x141416,trimA:0x6f263d,trimB:0xffb81c,text:0xffb81c,textS:0x6f263d,num:0x6f263d,numS:0xffb81c,name:0xffb81c,nameS:0x6f263d,
      shorts:0x141416,sStripe:0x6f263d,sEdge:0xffb81c,sock:0x141416,sockBand:0x141416,
      shoe:0x141416,shoeAcc:0xc9a54a,shoeMid:0xc9a54a,sole:0x141416,lace:0x141416,shoeLogo:'swoosh',logoC:0xc9a54a},
    hem:.55,shortsW:1.04},
  /* 杜兰特 2013-14 雷霆客场蓝（MVP 赛季）：胸前白色 OKLAHOMA CITY 两行、白色号码深蓝边，
     深蓝 + 日落橙滚边（2013 年 11 月一件同款客场的拍卖描述：字样白 / 蓝 / 深蓝三层）。
     2.11m、手长腿长、全联盟最细的那种身板；短裤长过膝 */
  durant:{id:'durant',n:'杜兰特 · 2013-14 雷霆客场蓝（MVP 赛季）',front:'OKLAHOMA/CITY',back:'DURANT',num:'35',h:1.065,
    build:{W:.95,G:.9,ARM:.98,LEG:.96,MUS:.72},skinC:skinSet(0x6c412d,{hair:0x1d1511,beard:0x1d1511,brow:0x110b08}),
    face:FACES.durant,hair:'kobe',beardSide:0,jawStubble:true,headS:.94,hd:{face:.9,jaw:.89,nose:1.08,lip:1.05,chin:1.16,ear:1.08},   // 招牌：窄长脸、长下巴、头小
    kit:{jersey:0x007ac1,trimA:0x002d62,trimB:0xef3b24,text:0xf1efea,textS:0x002d62,num:0xf1efea,numS:0x002d62,
      shorts:0x007ac1,sStripe:0x002d62,sEdge:0xef3b24,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0xf1efea,shoeAcc:0x007ac1,shoeMid:0xf1efea,sole:0x002d62,lace:0xf1efea,shoeLogo:'swoosh',logoC:0x007ac1},
    hem:.5,shortsW:1.04},
  /* 东契奇 2025-26 湖人紫色宣言版：胸前金色 LAKERS 白边、金色 77 白边，金白滚边（零售商对 25-26 这件的描述）。
     2.01m，壮、不显肌肉；两侧短、头顶往后梳的棕发，满脸短胡茬。签名鞋 Jordan Luka（侧标不画） */
  doncic:{id:'doncic',n:'东契奇 · 2025-26 湖人紫色宣言版',front:'LAKERS',back:'DONCIC',num:'77',h:1.015,
    build:{W:1.04,G:1.06,ARM:1.07,LEG:1.08,MUS:.72},skinC:skinSet(0xd6a887,{hair:0x5a3c27,beard:0x5e4230,brow:0x4a3220,iris:0x5b4632,sclera:0xa99e94,lipUp:0xa06f5c,mouth:0x6a3a2e,lipLo:0xb27a66}),   // 浅肤色的唇不能用深棕，不然像张着嘴
    face:FACES.doncic,hair:'swept',beardSide:1.8,jawStubble:true,headS:1.03,hd:{face:1.1,jaw:1.12,nose:1.02,lip:.9,chin:.95},   // 招牌：圆脸、宽下颌
    kit:{jersey:0x552583,trimA:0xfdb927,trimB:0xf1efea,text:0xfdb927,textS:0xf1efea,num:0xfdb927,numS:0xf1efea,
      shorts:0x552583,sStripe:0xfdb927,sEdge:0xf1efea,sock:0xf1efea,sockBand:0xf1efea,
      shoe:0x552583,shoeAcc:0xfdb927,shoeMid:0xf1efea,sole:0xf1efea,lace:0xfdb927,shoeLogo:'none',logoC:0xfdb927},
    hem:.53,shortsW:1.06},
};
const ROSTER_IDS=Object.keys(ROSTER);
const DECALS={};let CH=null;
function setChar(id){
  const c=ROSTER[id]||ROSTER.kobe;if(CH===c)return c;CH=c;
  for(const k in BUILD)delete BUILD[k];Object.assign(BUILD,BUILD0,c.build||{});
  HY=c.h||1;applySkeleton();
  for(const k in C)delete C[k];Object.assign(C,C0,c.skinC||{});
  if(c.skinC&&c.skinC.hair==null)C.hair=mulHex(C.skin,.8);
  FACE=c.face||FACE_KOBE;
  const d=DECALS[c.id];if(d){JF=d.JF;JB=d.JB;SW=d.SW;}
  return c;
}
setChar('kobe');
/* 手部静止坐标（设计 → 当前球星）：左右随体格加宽，上下随身高平移。AIBA 皮套建手指骨头时用 */
const handRest=p=>[p[0]*BUILD.W,p[1]+HAND_DY,p[2]];
/* 寸头 / 推短的颜色：卷发团底下的两侧推得很短，露头皮，比头发本色浅一半 */
/* 推短是渐变的：越往下越短、越露头皮（y 为设计空间高度） */
const buzzC=y=>{if(CH.hair!=='curly'&&CH.hair!=='fade'&&CH.hair!=='crop')return C.hair;const t=clamp(((y||1.86)-1.79)/.12,0,1);return mixHex(C.skin,C.hair,.3+.5*t*t);};
function headColor(x,y,z){
  {const fm=faceMap(x,y,z);if(fm)return fm;}
  [x,y,z]=headDesign(x,y,z);
  const ax=Math.abs(x);
  // 1. 寸头（经典圆寸造型）：发际线平直规整，额角微圆，后脑自然收于颈后
  // 颅骨顶部全覆盖头发，告别秃顶与奇形怪状发际。光头（乔丹、雷·阿伦）跳过；有发型外壳的人这里只露出鬓角和后颈
  if(CH.hair==='bald'){}
  else if(z > .015){
    // 前额与鬓角
    let hl = 1.906 - .006 * Math.min(1, Math.pow(ax / .042, 2));
    if(ax > .042) hl -= (ax - .042) * 1.5; // 额角微后移折角
    if(y > hl) return set(buzzC(y), MAT.hair, FS<.01?.97+hash3(Math.floor(x/.0022),Math.floor(y/.0022),Math.floor(z/.0022))*.06:1);
    // 耳前垂直鬓角 (薄而利落)
    if(ax > .062 && ax < .078 && z > -.018 && z < .020 && y > 1.832) return set(buzzC(y), MAT.hair);
  } else {
    // 后脑勺发际线：从耳后平缓包裹至颈后 (y: 1.865 -> 1.785)
    const t = Math.max(0, Math.min(1, (-z) / .088));
    const hl = 1.865 - .080 * t;
    if(y > hl) return set(buzzC(y), MAT.hair, FS<.01?.97+hash3(Math.floor(x/.0022),Math.floor(y/.0022),Math.floor(z/.0022))*.06:1);
  }

  // 2. 胡须：科比标志性的精致圈胡（上唇胡 + 下唇中垂须 + 下巴胡），面颊两侧干净无胡
  if(CH.id==='kobe'&&FS>=.01&&z > .055){
    // 唇上须（八字胡）：紧贴上唇上方，绝不蔓延到脸颊
    if(ax < .024 && y >= 1.802 && y <= 1.814) return set(C.beard, MAT.hair);
    // 唇下垂须 (soul patch)
    if(ax < .011 && y >= 1.764 && y < 1.778) return set(C.beard, MAT.hair);
    // 下巴圈胡 (goatee)：规整收于下巴中央区，两颊完全保留干净肤色
    if(ax < .028 && y < 1.764 && z > .042) return set(C.beard, MAT.hair);
  }
  // 下颌骨底沿极淡短茬 (仅底面，正面不可见)
  if(CH.jawStubble&&y < 1.748 && ax < .045 && z > -.01) return set(C.beard, MAT.hair);
  // 络腮胡的两侧（诺维茨基、哈登）：下颌两侧、耳前，往前越低
  if(CH.beardSide&&y>1.7&&z>-.035&&ax>.034&&y<CH.beardSide-.3*Math.max(0,z))return set(C.beard,MAT.hair,.88+hash3(Math.floor(x/.005),Math.floor(y/.005),Math.floor(z/.005))*.25);

  // 3. 面部五官细节（眉、眼、唇）
  if(z > .052){
    const ey = y - 1.866, ex = ax - .033;
    if(FS >= .01){ // 粗体素分辨率
      if(FS < .016 && ax > .012 && ax < .058 && band(ey, .0235, FS)) return set(C.brow, MAT.hair);
      if(band(ey, -.001, FS) && Math.abs(ex) < FS * 1.5){
        if(Math.abs(ex) < FS * .55) return set(C.iris, MAT.eye);
        return FS < .016 && ex > 0 ? set(C.sclera, MAT.eye, .85) : set(C.skin, MAT.skin, .72);
      }
    } else { // 平滑/高模：逐区域手绘（D 平滑、C 像素化都走这里）
      const grain=(q,sc)=>hash3(Math.floor(x/sc)+q,Math.floor(y/sc),Math.floor(z/sc));
      // 眉：粗、平，眉头略方、眉尾收细；边缘按毛发颗粒羽化
      const bx=(ax-.011)/.048;
      if(bx>=0&&bx<=1){
        const cy=.0158+.0028*Math.sin(bx*Math.PI*.85)-.0022*bx*bx,th=.0033*(1-.45*bx)+.0006,d=Math.abs(ey-cy);
        if(d<th&&(d<th*.62||grain(0,.0016)>.35))return set(C.brow,MAT.hair,.88+grain(3,.0012)*.25);
      }
      // 眼：杏仁形睁眼范围（外眼角略高），睫毛线，深眼窝
      const w=.0148,q=1-(ex/w)*(ex/w);
      if(q>0){
        const up=.0043*Math.pow(q,.6)+.0007*(ex/w),lo=-.0033*Math.pow(q,.75)+.0005*(ex/w);
        if(ey>=up&&ey<up+.0017+.0008*(ex>0?ex/w:0))return set(C.lid,MAT.hair);            // 上睫毛线，外侧略粗
        if(ey<up&&ey>lo){
          const r=Math.hypot(ex+.0006,ey-.0004);
          if(r<.0058)return set(r<.0025?0x080403:C.iris,MAT.eye);                           // 虹膜 + 瞳孔
          return set(0x8f8173,MAT.eye,1-.3*Math.abs(ex/w));                                 // 眼白，眼角更暗
        }
        if(ey>=up+.0017&&ey<up+.0085)return set(C.skin,MAT.skin,.8);                       // 上眼睑压在深眼窝里
        if(ey<=lo&&ey>lo-.0045)return set(C.skin,MAT.skin,.86);                            // 下眼睑
      }
      if(Math.abs(ex)<.02&&ey<-.006&&ey>-.017)return set(C.skin,MAT.skin,.92);              // 眼袋阴影
      // 鼻孔、鼻翼沟、法令纹
      if(Math.hypot((ax-.0095)/.0056,(y-1.8185)/.0027)<1&&z>.084)return set(0x2a140d,MAT.skin);
      if(Math.hypot((ax-.0185)/.0022,(y-1.822)/.006)<1&&z>.08)return set(C.skin,MAT.skin,.78);
      {const t=clamp((1.818-y)/.03,0,1),fx=.021+.009*t;if(y<1.818&&y>1.786&&Math.abs(ax-fx)<.0016&&z>.066)return set(C.skin,MAT.skin,.86);}
      // 唇：上唇带唇峰，下唇更饱满、中间受光；嘴角略下沉
      const mx=ax/.0235;
      if(mx<1&&z>.07){
        const my=1.7915-.0014*mx*mx;
        if(Math.abs(y-my)<.00105)return set(C.mouth,MAT.skin);
        const upTop=my+.0062*(1-.55*mx*mx)+.0011*Math.cos(mx*Math.PI*2.2)*(1-mx);
        if(y>my&&y<upTop)return set(C.lipUp,MAT.skin);
        const loBot=my-.0088*Math.sqrt(Math.max(0,1-mx*mx*.92));
        if(y<my&&y>loBot)return set(C.lip,MAT.skin,mx<.45&&y<my-.0028&&y>my-.0062?1.18:1);
      }
      // 胡须：唇上须 / 唇下须 / 山羊胡，边缘做胡茬颗粒
      const stub=g=>grain(7,.0014)<g;
      if(CH.id==='kobe'){
      {const m2=Math.min(1,ax/.0235),lipTop=1.7915-.0014*m2*m2+.0062*(1-.55*m2*m2)+.0011*Math.cos(m2*Math.PI*2.2)*(1-m2);
        if(ax<.027&&y>lipTop+.0006&&y<lipTop+.0062-.0022*m2&&z>.07&&(ax<.021||stub(.55)))return set(C.beard,MAT.hair,.9+grain(9,.001)*.25);}
      {const t=clamp((1.8-y)/.036,0,1),cx=.0262+.003*t;                                   // 嘴角下连：圈胡
        if(y<1.8&&y>1.764&&Math.abs(ax-cx)<.0022&&z>.066&&stub(.45))return set(C.beard,MAT.hair,1.25+grain(9,.001)*.25);}   // 嘴角只留淡淡胡茬
      if(ax<.0115&&y>=1.7635&&y<1.778&&z>.07&&(ax<.008||stub(.5)))return set(C.beard,MAT.hair,.9+grain(9,.001)*.25);
      if(ax<.02&&y<1.764&&y>1.738&&z>.04&&(ax<.015||stub(.5)))return set(C.beard,MAT.hair,.9+grain(9,.001)*.25);   // 下巴山羊胡：窄
      }
    }
    // 嘴唇（体素分辨率回落）
    if(FS>=.01&&ax < .024 && band(y, 1.7915, .004) && z > .070) return set(C.mouth, MAT.skin); // 唇缝
    if(FS>=.01&&ax < .025 && y > 1.778 && y < 1.802 && z > .070) return FS >= .01 ? set(C.skin, MAT.skin, .8) : y > 1.791 ? set(C.lipUp, MAT.skin) : set(C.lip, MAT.skin);
    // 鼻底阴影
    if(FS>=.01&&y > 1.812 && y < 1.822 && ax > .007 && ax < .018 && z > .085) return set(C.skin, MAT.skin, .7);
  }
  return set(C.skin, MAT.skin);
}
function jerseyColor(tag,x,y,z){
  const K=CH.kit;
  const cuts=LAYERS_BY.jersey.cuts,dN=Math.min(primD(cuts[0],x,y,z),primD(cuts[1],x,y,z)),dA=Math.min(primD(cuts[2],x,y,z),primD(cuts[3],x,y,z));
  if(dN<.016)return set(K.trimA,MAT.cloth);   // 领口
  if(dN<.025)return set(K.trimB,MAT.cloth);
  let c=-1;
  if(y/HY>1.2&&y/HY<1.7&&Math.abs(x)<.25*BUILD.W){
    const front=z>0,u=((front?x:-x)/BUILD.W+.25)/.5,v=(1.7-y/HY)/.5;c=(front?JF:JB)(u,v);   // 贴花按加宽前的比例摆
    if(c>=0&&(c&PRI))return set(c&0xffffff,MAT.cloth);
  }
  if(dA<.016)return set(K.trimA,MAT.cloth);   // 袖口
  if(dA<.025)return set(K.trimB,MAT.cloth);
  y/=HY;
  if(K.side&&Math.abs(x)/BUILD.W>.11){   // 侧片：腋下到下摆，边缘锯齿（爪痕），外面一道滚边
    const zig=K.side.zig?.011*Math.abs(((y/.045)%2+2)%2-1):0,dz=Math.abs(z+.005),e=.046+zig;
    if(dz<e)return set(K.side.col,MAT.cloth);
    if(dz<e+.011)return set(K.side.pipe,MAT.cloth);
  }
  if(c>=0)return set(c&0xffffff,MAT.cloth);
  if(K.pattern==='stars'&&starAt(x/BUILD.W,y))return set(K.patC,MAT.cloth);
  return set(K.jersey,MAT.cloth);
}
function shortsColor(tag,x,y,z,P){
  const K=CH.kit,hem=CH.hem||.565;
  x/=BUILD.W;y/=HY;   // 侧条 / 队标按加宽前、1.98m 的坐标画
  if(y>1.074)return band(y,1.093,.008)?set(K.trimB,MAT.satin):set(K.trimA,MAT.satin);
  const s=P&&P.s||Math.sign(x)||1;
  if(tag==='leg'){
    if(y<hem+.023)return set(K.trimA,MAT.satin);
    if(y<hem+.033)return set(K.trimB,MAT.satin);
  }
  const dx=s*(x-s*.1);
  if(dx>.03||Math.abs(x)>.15){                  // 外侧竖条
    const dz=Math.abs(z-.005),zig=K.sZig?.012+.011*Math.abs(((y/.045)%2+2)%2-1):0;
    if(dz<.022+zig)return set(K.sStripe,MAT.satin);
    if(dz<.031+zig)return set(K.sEdge,MAT.satin);
  }
  if(s===1&&z>0){const r=Math.hypot(x-.125,y-Math.max(.76,hem+.195));if(r<.03)return set(K.sStripe,MAT.satin);if(r<.038)return set(K.sEdge,MAT.satin);}
  if(K.pattern==='stars'&&starAt(x,y))return set(K.patC,MAT.satin);
  return set(K.shorts,MAT.satin);
}
/* 暗纹星星：8 格一个，隔行错开半个；每颗是 1 格中心 + 上下左右 4 格的十字（1.2cm 格子里能读成星星的最小形状） */
function starAt(x,y){const N=8,i=Math.floor(x/.012),j=Math.floor(y/.012),J=Math.floor(j/N),sh=(J&1)*N/2,I=Math.floor((i+sh)/N);
  const di=(i+sh)-I*N-N/2,dj=j-J*N-N/2;return Math.abs(di)+Math.abs(dj)<=1;}
function sockColor(tag,x,y){
  const K=CH.kit;y/=HY;
  if(y>.278&&y<.3)return set(K.sockBand,MAT.cloth,band(y,.289,.006)?.86:1);
  return set(K.sock,MAT.cloth);
}
function shoeColor(tag,x,y,z,P){
  const K=CH.kit;x/=BUILD.W;y/=HY;
  const s=P.s,lx=s*(x-s*.105);
  const soleY = z > .02 ? .011 + .018 * Math.min(1, Math.max(0, (z - .02) / .135)) : .011;
  if(y < soleY) return set(K.sole, MAT.shoe);
  if(y < soleY + .024) return set(K.shoeMid, MAT.shoe);
  if(y > .116 && z < .02) return set(K.shoeAcc, MAT.shoe);               // 鞋领内衬
  if(z < -.056 && y < .098) return set(K.shoeAcc, MAT.shoe);              // 后跟稳定片
  if(Math.abs(lx) > .022){const c=SW((z+.11)/.32,(.16-y)/.16);if(c>=0)return set(c&0xffffff,MAT.shoe);}
  if(Math.abs(lx) < .017 && y > .086 && z > -.01 && z < .12)           // 鞋带区
    return set(Math.floor((z+.01)/Math.max(.016,FS))%2?K.lace:K.shoe,MAT.shoe,.97);
  return set(K.shoe,MAT.shoe);
}
/* 护套：科比按实验页开关（黑 / 白 / 无）；其他人按档案 */
function sleeveSpec(){
  if(CH.id==='kobe'){const o=OPT.sleeve||'black';return o==='none'?null:{side:'R',col:o==='white'?C0.white:C0.black,cuff:o==='white'?C0.purple:C0.white};}
  return CH.sleeve||null;
}
function sleeveColor(tag,x,y){
  const S=sleeveSpec()||{col:C0.black,cuff:C0.white};y/=HY;
  if(y>1.459)return set(S.cuff,MAT.cloth);
  return set(S.col,MAT.cloth);
}
/* 发型上色：头部格子逐列（x / CELL）对齐，辫子、卷发颗粒都落在整格上，不会半格闪烁 */
function hairColor(tag,x,y,z){
  const [dx,dy]=headDesign(x,y,z),col=Math.floor(x/CELL),g=hash3(Math.floor(x/.006)+11,Math.floor(y/.006),Math.floor(z/.006));
  switch(CH.hair){
    case 'cornrows':{   // 地垄辫：辫子（凸起）一节深一节亮出编织节；辫子之间的外壳是发缝，露头皮
      const knot=((Math.floor(z/CELL)+Math.floor(y/CELL))&1)?1.35:.85,braid=()=>set(C.hair,MAT.hair,knot*(.95+g*.1)),part=()=>set(mixHex(C.skin,C.hair,.35),MAT.skin,.8);
      if(tag==='braid')return braid();
      if(Math.abs(dx)<.072)return (col&1)?part():braid();          // 头顶：前后走向，一列辫子一列发缝
      return (Math.floor(y/CELL)&1)?part():braid();}                // 两侧：辫子顺着往后脑走，横向一行一行
    case 'curly':return set(C.hair,MAT.hair,.8+g*.42);     // 卷发：颗粒明暗
    case 'fade':return set(C.hair,MAT.hair,.82+g*.36);
    case 'crop':return set(C.hair,MAT.hair,.84+g*.32);
    case 'swept':{const st=hash3(Math.floor(x/.004),9,Math.floor((z-dy*.6)/.02));return set(C.hair,MAT.hair,.84+st*.3+(dy>1.935?.1:0));}   // 往后梳：条纹顺着前后方向，头顶受光
    case 'shaggy':{const st=hash3(Math.floor(x/.005),7,Math.floor(z/.018));return set(C.hair,MAT.hair,.82+st*.34+(dy>1.93?.08:0));}   // 顺发丝方向的条纹
  }
  return set(C.hair,MAT.hair);
}
function beardColor(tag,x,y,z){const g=hash3(Math.floor(x/.005)+3,Math.floor(y/.005),Math.floor(z/.005));return set(C.beard,MAT.hair,.85+g*.32);}
/* 纹身：前臂、上臂外侧一片片深色（艾弗森、哈登） */
function tattooAt(x,y,z,s){
  if(!CH.tattoo)return false;
  const yy=y/HY;if(yy<1.02||yy>1.55)return false;
  const n=vnoise(x*1.3+s*.37,y,z*1.3,.022);return n>.6&&n<.74||n>.8;
}
function ballColor(tag,x,y,z){
  const e=BALL_INV;const lx=e[0]*x+e[4]*y+e[8]*z,ly=e[1]*x+e[5]*y+e[9]*z,lz=e[2]*x+e[6]*y+e[10]*z; // 球内部朝向
  const l=Math.hypot(lx,ly,lz)||1,nx=lx/l,ny=ly/l,nz=lz/l,w=Math.max(.045,FS*.42/.121);
  if(Math.abs(nx)<w||Math.abs(ny)<w||Math.abs(Math.abs(nz)-(.62+.3*nx*nx-.2*ny*ny))<w)return set(C.seam,MAT.ball);
  return set(C.ballO,MAT.ball);
}
let LAYERS_BY={},LAYERS_PRIO=[],BALL_INV=[1,0,0,0,0,1,0,0,0,0,1,0];

/* =====================================================================
   5. 姿势：躯干 FK + 四肢两骨 IK
   动作阶段参考 AIBA 的 T台投篮包（src/data/tstage-motion-pack.js 的关节世界坐标 +
   motion.js 的持球/置球点/随挥注释），按科比 1.98m 的比例重新摆，不复刻四元数：
     准备 ready_pose1   球在体前、屈膝下沉、投篮侧脚在前
     置球 shot_high     球在额头前上方，投篮手掌托在球下、手腕后折，辅助手贴球侧
     出手 shot_release  投篮臂几乎伸直；AIBA 的规矩是"球先离手、再压腕"
     随挥 release_keep_land  落地缓冲，投篮手停在高处鹅颈压腕，辅助手放下
   持球姿势先定球，再把掌心贴到球面上反解手臂——所以手一定贴球。
   ===================================================================== */
const BALL_R=.121;
const V3=a=>new T.Vector3(a[0],a[1],a[2]);
const nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
function perp(v,d){const r=v.clone(),k=r.dot(d);r.addScaledVector(d,-k);const l=r.length();return l<1e-4?null:r.multiplyScalar(1/l);}
function frameRot(a0,b0,a1,b1){ // 旋转 R：R·a0=a1，且 b0 的垂直分量转到 b1 的垂直分量
  const m=(a,b)=>{a=a.clone().normalize();b=perp(b,a)||perp(new T.Vector3(1,0,0),a);return new T.Matrix4().makeBasis(a,b,new T.Vector3().crossVectors(a,b));};
  return m(a1,b1).multiply(m(a0,b0).transpose());
}
function twoBone(S,G,L1,L2,pole){
  const d=G.clone().sub(S),dir=d.clone().normalize();let dl=clamp(d.length(),Math.abs(L1-L2)+1e-4,L1+L2-1e-4);
  const a=(L1*L1-L2*L2+dl*dl)/(2*dl),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const p=perp(V3(pole),dir)||perp(new T.Vector3(0,0,1),dir);
  return {E:S.clone().addScaledVector(dir,a).addScaledVector(p,h),G:S.clone().addScaledVector(dir,dl)};
}
const Z3=new T.Vector3(0,0,1);
const POSES={
  idle:{name:'站立',ground:true,root:[0,0,0],hand:{L:{c:[.4,.5,.6,.68],sp:[.04,.01,-.02,-.05],tc:.35},R:{c:[.32,.42,.52,.6],sp:[.04,.01,-.02,-.05],tc:.3}},rot:{
    pelvis:[0,.12,.015],spine:[.02,-.04,0],chest:[.02,-.06,-.012],neck:[.02,0,0],head:[-.03,.1,0],
    upperArmL:[.06,0,.1],foreArmL:[-.28,0,0],handL:[0,-.1,0],
    upperArmR:[.02,0,-.09],foreArmR:[-.22,0,0],handR:[0,.1,0],
    thighL:[-.05,.08,.07],shinL:[.1,0,0],footL:[-.05,-.12,-.085],
    thighR:[.03,-.04,-.03],shinR:[.03,0,0],footR:[-.06,.05,.045]}},
  // 持球准备（库里式半蹲：屈膝+屈髋坐臀，躯干保持基本直立，头-髋-脚踝在一条垂线上）
  hold:{name:'持球准备',root:[0,-.12,-.065],ball:[-.1,1.0,.28],
    hand:{R:{sp:[.22,.07,-.08,-.22],to:.3,ta:.3,tc:.25,grip:1},L:{sp:[.16,.05,-.06,-.17],to:.2,ta:.4,tc:.2,grip:.95}},
    rot:{pelvis:[.04,.25,0],spine:[.03,-.02,0],chest:[0,-.08,0],neck:[-.02,0,0],head:[-.05,-.14,0]},
    ik:{armR:{on:'ball',u:[-.4,-.05,-.92],f:[.05,1,.2],pole:[-.6,-.4,-.6]},
        armL:{on:'ball',u:[.92,.1,.25],f:[0,.9,.45],pole:[.7,-.5,-.2]},
        legR:{ankle:[-.16,.09,.10],pole:[-.2,0,1],foot:[-.12,0,1]},
        legL:{ankle:[.17,.09,-.05],pole:[.35,0,1],foot:[.35,0,1]}}},
  // 置球点（AIBA shot_high）：球压在指根和指腹上，掌心留空、手腕后折；辅助手只扶侧面
  set:{name:'置球点',root:[0,-.03,0],ball:[-.1,2.07,.24],
    hand:{R:{sp:[.2,.06,-.07,-.2],to:.25,ta:.35,tc:.2,grip:1},L:{sp:[.12,.04,-.05,-.14],to:.15,ta:.45,tc:.15,grip:.9}},
    rot:{pelvis:[0,.22,0],spine:[-.02,0,0],chest:[-.03,-.1,0],neck:[0,0,0],head:[-.12,-.12,0]},
    ik:{armR:{on:'ball',u:[-.1,-1,-.28],f:[0,.25,-1],pole:[-.15,-.3,1]},
        armL:{on:'ball',u:[1,.05,-.05],f:[0,1,.15],pole:[.8,-.4,.2]},
        legR:{ankle:[-.14,.09,.08],pole:[-.1,0,1],foot:[-.1,0,1]},
        legL:{ankle:[.15,.09,-.03],pole:[.25,0,1],foot:[.3,0,1]}}},
  // 出手瞬间：球还压在指腹上，手腕尚未压下（AIBA：球先离手、再压腕）
  fade:{name:'后仰出手',root:[0,.34,-.06],
    hand:{R:{c:[.1,.12,.16,.2],sp:[.12,.04,-.05,-.13],to:.2,ta:.3,tc:.15,grip:.85},L:{c:[.1,.12,.16,.22],sp:[.1,.03,-.04,-.1],ta:.4,tc:.15}},
    rot:{pelvis:[-.18,.22,0],spine:[-.14,0,0],chest:[-.12,-.08,0],neck:[.2,0,0],head:[.14,-.1,0]},
    ik:{armR:{wrist:(c,S,L)=>S.clone().addScaledVector(V3(nrm([-.03,1,.42])),L-.012),F:[0,.28,1],N:[0,1,-.3],pole:[0,0,1]},
        armL:{wrist:(c,S,L)=>S.clone().addScaledVector(V3(nrm([-.28,1,.3])),L-.05),F:[-.1,1,.25],N:[-1,0,0],pole:[1,0,.3]},
        legR:{rel:[-.005,-.8,.07],pole:[0,0,1],foot:[0,-.75,1]},
        legL:{rel:[.01,-.7,.2],pole:[0,0,1],foot:[0,-.6,1]}},
    // 球还压在指腹上，刚要离手：手掌坐标系里掌心侧 + 指根处
    ball:c=>c.P('handR',[-.218+BALL_R+.012,.872+HAND_DY,.004])},
  catch:{name:'接球',root:[0,-.03,0],ball:[-.03,1.4,.6],
    hand:{R:{sp:[.2,.06,-.07,-.2],to:.35,ta:.3,tc:.2,grip:1},L:{sp:[.2,.06,-.07,-.2],to:.35,ta:.3,tc:.2,grip:1}},
    rot:{pelvis:[.03,.18,0],spine:[.04,0,0],chest:[.02,-.08,0],neck:[-.02,0,0],head:[-.06,-.1,0]},
    ik:{armR:{on:'ball',u:[-.85,.05,-.5],f:[0,1,.3],pole:[-.7,-.7,0]},
        armL:{on:'ball',u:[.85,.05,-.5],f:[0,1,.3],pole:[.7,-.7,0]},
        legR:{ankle:[-.15,.09,.08],pole:[-.15,0,1],foot:[-.12,0,1]},
        legL:{ankle:[.16,.09,-.04],pole:[.3,0,1],foot:[.3,0,1]}}},
  // 压腕：出手后约 0.1s 才翻腕——掌心朝地、指尖指向篮筐，手指各弯各的
  snap:{name:'压腕（天鹅颈）',root:[0,.24,-.05],
    hand:{R:{c:[.2,.42,.62,.5],sp:[.03,0,-.03,-.07],to:.1,ta:.05,tc:.35},L:{c:[.12,.14,.2,.26],sp:[.1,.03,-.04,-.1],ta:.4,tc:.15}},
    rot:{pelvis:[-.17,.22,0],spine:[-.13,0,0],chest:[-.11,-.08,0],neck:[.18,0,0],head:[.12,-.1,0]},
    ik:{armR:{wrist:(c,S,L)=>S.clone().addScaledVector(V3(nrm([-.03,1,.4])),L-.012),F:[0,-.74,.67],N:[0,-.67,-.74],pole:[0,0,1]},
        armL:{wrist:(c,S,L)=>S.clone().addScaledVector(V3(nrm([-.4,1,.3])),L-.06),F:[-.15,1,.3],N:[-1,0,.1],pole:[1,0,.3]},
        legR:{rel:[-.005,-.82,.06],pole:[0,0,1],foot:[0,-.7,1]},
        legL:{rel:[.01,-.74,.17],pole:[0,0,1],foot:[0,-.6,1]}}},
  follow:{name:'随挥落地',root:[0,-.08,0],
    hand:{R:{c:[.2,.45,.66,.55],sp:[.03,0,-.03,-.07],to:.1,ta:.05,tc:.35},L:{c:[.35,.45,.55,.62],sp:[.04,.01,-.02,-.05],tc:.3}},
    rot:{pelvis:[.06,.16,0],spine:[.02,0,0],chest:[-.02,-.06,0],neck:[0,0,0],head:[-.1,-.1,0]},
    ik:{armR:{wrist:(c,S,L)=>S.clone().addScaledVector(V3(nrm([-.03,1,.36])),L-.014),F:[0,-.76,.65],N:[0,-.65,-.76],pole:[0,0,1]},
        armL:{wrist:(c,S)=>S.clone().add(V3([.075,-.52,.13])),F:[0,-1,.2],N:[-1,0,.1],pole:[0,-.2,-1]},
        legR:{ankle:[-.14,.09,.06],pole:[-.15,0,1],foot:[-.12,0,1]},
        legL:{ankle:[.16,.09,-.02],pole:[.3,0,1],foot:[.3,0,1]}}},
};
function chainIK(W,kind,sd,spec,ballPos,ctx){
  const s=sd==='L'?1:-1,arm=kind==='arm',rh=i=>V3(BN[i].head);
  const [ia,ib,ic]=(arm?['upperArm','foreArm','hand']:['thigh','shin','foot']).map(n=>BI[n+sd]);
  const S=new T.Vector3().setFromMatrixPosition(W[ia]),L1=rh(ib).distanceTo(rh(ia)),L2=rh(ic).distanceTo(rh(ib));
  let G,endRot;
  if(arm){
    let F,N;
    if(spec.on==='ball'){const u=V3(nrm(spec.u));N=u.clone().negate();F=perp(V3(spec.f),N);
      G=ballPos.clone().addScaledVector(u,BALL_R+.014).addScaledVector(F,-.08);}   // 接触点在指根肉垫，掌心和掌根留空
    else{G=typeof spec.wrist==='function'?spec.wrist(ctx,S,L1+L2):V3(spec.wrist);F=V3(nrm(spec.F));N=perp(V3(spec.N),F);}
    endRot=frameRot(new T.Vector3(0,-1,0),new T.Vector3(-s,0,0),F,N);
  }else{
    G=spec.rel?S.clone().add(V3(spec.rel)):V3(spec.ankle);
    const f=V3(nrm(spec.foot));endRot=frameRot(Z3,new T.Vector3(0,1,0),f,perp(new T.Vector3(0,1,0),f)||new T.Vector3(0,1,0));
  }
  const k=twoBone(S,G,L1,L2,spec.pole||[0,0,1]);
  const d1r=rh(ib).sub(rh(ia)).normalize(),d2r=rh(ic).sub(rh(ib)).normalize();
  const d1=k.E.clone().sub(S).normalize(),d2=k.G.clone().sub(k.E).normalize();
  const poleF=perp(V3(spec.pole||[0,0,1]),d1);
  const f1=(arm?perp(d2,d1):perp(d2.clone().negate(),d1))||poleF;
  const f2=(arm?perp(d1.clone().negate(),d2):perp(d1,d2))||f1;
  W[ia]=frameRot(d1r,Z3,d1,f1).setPosition(S);
  W[ib]=frameRot(d2r,Z3,d2,f2).setPosition(k.E);
  W[ic]=endRot.setPosition(k.G);
}
/* 求一个姿势：返回每根骨头的关节世界矩阵 W（把"相对关节的静止坐标"变到世界）和球心 */
function solvePose(P){
  const W=[],E=new T.Euler(),R=new T.Matrix4(),ik=P.ik||{};
  const rh=i=>V3(BN[i].head);
  const ctx={P:(bn,p)=>{const i=BI[bn];return V3(p).sub(rh(i)).applyMatrix4(W[i]);}};
  const ballPos=Array.isArray(P.ball)?V3(P.ball):null;
  const run=root=>{
    W.length=0;
    for(let i=0;i<NB;i++){
      const b=BN[i];if(b.name==='ball'||W[i])continue;
      const r=P.rot[b.name]||[0,0,0];E.set(r[0],r[1],r[2],'XYZ');R.makeRotationFromEuler(E);
      const hp=b.parent<0?[0,0,0]:BN[b.parent].head,off=b.parent<0?root:[0,0,0];
      const Lm=new T.Matrix4().makeTranslation(b.head[0]-hp[0]+off[0],b.head[1]-hp[1]+off[1],b.head[2]-hp[2]+off[2]).multiply(R);
      W[i]=b.parent<0?Lm:W[b.parent].clone().multiply(Lm);
      const m=b.name.match(/^(upperArm|thigh)(L|R)$/);
      if(m){const kind=m[1]==='thigh'?'leg':'arm',key=kind+m[2];if(ik[key])chainIK(W,kind,m[2],ik[key],ballPos,ctx);}
    }
  };
  const root=P.root.slice();run(root);
  if(P.ground){ // 纯 FK 姿势：鞋底最低点落在 y=0
    let mn=9;for(const sd of ['L','R'])for(const dx of [-.045,.045])for(const z of [-.1,-.02,.07,.19]){
      const s=sd==='L'?1:-1,fi=BI['foot'+sd],v=new T.Vector3(s*.105+dx,0,z).sub(rh(fi)).applyMatrix4(W[fi]);mn=Math.min(mn,v.y);}
    root[1]-=mn;run(root);
  }
  return {W,ball:typeof P.ball==='function'?P.ball(ctx):ballPos};
}
function dmFromW(W,i){return W[i].clone().multiply(new T.Matrix4().makeTranslation(-BN[i].head[0],-BN[i].head[1],-BN[i].head[2]));}
const BALL_BASE=new T.Euler(.5,.9,.2);
function finalizePose(ballOn){
  const bi=BI.ball;
  for(let i=0;i<NB;i++){const inv=DM[i].clone().invert().elements;const o=i*12;
    INV[o]=inv[0];INV[o+1]=inv[1];INV[o+2]=inv[2];INV[o+3]=inv[4];INV[o+4]=inv[5];INV[o+5]=inv[6];
    INV[o+6]=inv[8];INV[o+7]=inv[9];INV[o+8]=inv[10];INV[o+9]=inv[12];INV[o+10]=inv[13];INV[o+11]=inv[14];}
  BALL_INV=DM[bi].clone().extractRotation(DM[bi]).invert().elements;
  for(const ly of LAYERS){
    let mn=[9,9,9],mx=[-9,-9,-9];ly.has=false;
    for(const p of ly.prims){if(p.t===3)continue;const v=new T.Vector3(...p.bc).applyMatrix4(DM[p.bone]);p.wc=[v.x,v.y,v.z];
      if(p.op!=='u')continue;ly.has=true;for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],p.wc[a]-p.br);mx[a]=Math.max(mx[a],p.wc[a]+p.br);}}
    if(!ballOn&&ly.name==='ball')ly.has=false;
    ly.wc=mn.map((v,a)=>(v+mx[a])/2);ly.wr=Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])/2;ly.mn=mn;ly.mx=mx;
  }
  LAYERS_BY={};for(const ly of LAYERS)LAYERS_BY[ly.name]=ly;
  LAYERS_PRIO=LAYERS.slice().sort((a,b)=>b.prio-a.prio);
}
function applyPose(P){
  setChar(OPT.char);
  const S=solvePose(P),bi=BI.ball;
  for(let i=0;i<NB;i++)if(S.W[i])DM[i].copy(dmFromW(S.W,i));
  if(S.ball)DM[bi].makeRotationFromEuler(BALL_BASE).setPosition(S.ball);else DM[bi].makeTranslation(0,-50,0);
  HANDS=computeHands(P.hand,S.ball?S.ball.toArray():null);buildLayers();
  finalizePose(!!S.ball);
  return (bn,p)=>new T.Vector3(...p).applyMatrix4(DM[BI[bn]]).toArray();
}
function setDM(arr,ballOn){for(let i=0;i<NB;i++)DM[i].fromArray(arr,i*16);finalizePose(ballOn);}

/* =====================================================================
   6. 场求值（层次逻辑：外层衣物绝对包裹与遮蔽底层肉体）
   ===================================================================== */
const BP=new Float64Array(NB*3),BS=new Int32Array(NB);let STAMP=1;
function rest(b){ // 当前采样点在骨骼 b 静止空间里的坐标（按采样点缓存）
  if(BS[b]!==STAMP){const o=b*12,e=INV,x=_x,y=_y,z=_z;
    BP[b*3]=e[o]*x+e[o+3]*y+e[o+6]*z+e[o+9];BP[b*3+1]=e[o+1]*x+e[o+4]*y+e[o+7]*z+e[o+10];BP[b*3+2]=e[o+2]*x+e[o+5]*y+e[o+8]*z+e[o+11];BS[b]=STAMP;}
}
let _x=0,_y=0,_z=0,_bestP=null,_bestD=9;
let PF=null,CM=null,OWNER=null;   // OWNER：{骨骼名→蒙皮骨序号}，站姿烘焙时给，逐顶点记下归属骨骼
const ownerOf=P=>OWNER?(OWNER[(P&&P.fb)||(P?BN[P.bone].name:'pelvis')]??0):0;   // PF: 原语过滤；CM: 局部网格 → 世界 的矩阵（头部网格用）
function layerD(ly,track){
  let d=1e9;const x=_x,y=_y,z=_z;
  for(const P of ly.prims){
    if(PF!==null&&!PF(P))continue;
    let lb=-9;
    if(P.t!==3){const dx=x-P.wc[0],dy=y-P.wc[1],dz=z-P.wc[2];lb=Math.sqrt(dx*dx+dy*dy+dz*dz)-P.br;}
    if(P.op==='u'){
      if(lb>=d+P.k&&!track)continue;
      if(track&&lb>=d+P.k&&lb>=_bestD)continue;
      rest(P.bone);const b=P.bone*3;let di=primD(P,BP[b],BP[b+1],BP[b+2]);
      if(P.clip)di=Math.max(di,P.qx*BP[b]+P.qy*BP[b+1]+P.qz*BP[b+2]-P.qo);
      if(track&&di<_bestD){_bestD=di;_bestP=P;}
      d=smin(d,di,P.k);
    }else if(P.op==='s'){
      if(lb>=P.k)continue;rest(P.bone);const b=P.bone*3,di=primD(P,BP[b],BP[b+1],BP[b+2]);
      const h=Math.max(P.k-Math.abs(d+di),0)/P.k;d=Math.max(d,-di)+h*h*P.k*.25;   // 平滑差集
    }else{rest(P.bone);const b=P.bone*3;d=Math.max(d,primD(P,BP[b],BP[b+1],BP[b+2]));}
  }
  return d;
}
function field(x,y,z){
  _x=x;_y=y;_z=z;STAMP++;let dSkin=1e9,dOuter=1e9;
  for(const ly of LAYERS){
    if(!ly.has)continue;
    const dx=x-ly.wc[0],dy=y-ly.wc[1],dz=z-ly.wc[2],lb=Math.sqrt(dx*dx+dy*dy+dz*dz)-ly.wr;
    if(lb>.14||lb>=(ly.prio===0?dSkin:dOuter))continue;
    const d=layerD(ly,false);
    if(ly.prio===0){if(d<dSkin)dSkin=d;}
    else{if(d<dOuter)dOuter=d;}
  }
  // 几何层次逻辑：当外层衣物存在并包裹身体时，底层皮肤几何被约束在衣物内侧 2mm，杜绝任何物理穿模
  if(dOuter<0.006)dSkin=Math.max(dSkin,dOuter+0.002);
  return Math.min(dSkin,dOuter);
}
const INFO={layer:null,prim:null,x:0,y:0,z:0};
function info(x,y,z){ // 该点归哪一层、哪块原语、静止空间坐标
  _x=x;_y=y;_z=z;STAMP++;
  // 层次逻辑：外层优先（Layer Stacking）。按 prio 从高到低降序检查
  // 如果一个点位于外层衣物（球鞋、短裤、护套、球衣等）表面或浅层（d <= 0.009），则无条件属于该外层衣物
  for(const ly of LAYERS_PRIO){
    if(!ly.has||ly.prio===0)continue;
    const dx=x-ly.wc[0],dy=y-ly.wc[1],dz=z-ly.wc[2],lb=Math.sqrt(dx*dx+dy*dy+dz*dz)-ly.wr;
    if(lb>0.04)continue;
    _bestD=9;_bestP=null;const d=layerD(ly,true);
    if(d<=(ly.th!=null?ly.th:0.009)){   // 贴头层（头发、胡子、头带）收紧：不然发际线往下多吃一格
      INFO.layer=ly;INFO.prim=_bestP;
      if(_bestP){rest(_bestP.bone);INFO.x=BP[_bestP.bone*3];INFO.y=BP[_bestP.bone*3+1];INFO.z=BP[_bestP.bone*3+2];}
      return INFO;
    }
  }
  // 没有任何外层衣物包裹该点（如面部、颈部、手臂等裸露区域），才归属底层皮肤
  const skin=LAYERS_BY.skin;
  if(skin&&skin.has){
    _bestD=9;_bestP=null;layerD(skin,true);
    INFO.layer=skin;INFO.prim=_bestP;
    if(_bestP){rest(_bestP.bone);INFO.x=BP[_bestP.bone*3];INFO.y=BP[_bestP.bone*3+1];INFO.z=BP[_bestP.bone*3+2];}
    return INFO;
  }
  INFO.layer=null;INFO.prim=null;
  return INFO;
}
function colorAt(x,y,z){
  const I=info(x,y,z);if(!I.layer)return set(C.skin,0);
  return I.layer.color(I.prim.tag,I.x,I.y,I.z,I.prim);
}
function fL(x,y,z){if(CM===null)return field(x,y,z);const e=CM;return field(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);}
function cL(x,y,z){if(CM===null)return colorAt(x,y,z);const e=CM;return colorAt(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);}
/* 窄带采样：粗块中心离表面远就整块填同一值，近才逐点求值 */
function sampleGrid(o,s,n){
  const [nx,ny,nz]=n,f=new Float32Array(nx*ny*nz),B=4,bandW=B*s*.9+.022;
  for(let bz=0;bz<nz;bz+=B)for(let by=0;by<ny;by+=B)for(let bx=0;bx<nx;bx+=B){
    const ex=Math.min(bx+B,nx),ey=Math.min(by+B,ny),ez=Math.min(bz+B,nz);
    const dc=fL(o[0]+(bx+ex-1)/2*s,o[1]+(by+ey-1)/2*s,o[2]+(bz+ez-1)/2*s);
    const near=Math.abs(dc)<bandW;
    for(let k=bz;k<ez;k++)for(let j=by;j<ey;j++)for(let i=bx;i<ex;i++)
      f[i+nx*(j+ny*k)]=near?fL(o[0]+i*s,o[1]+j*s,o[2]+k*s):dc;
  }
  return f;
}
function bounds(){
  let mn=[9,9,9],mx=[-9,-9,-9];
  for(const ly of LAYERS){if(!ly.has)continue;for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],ly.mn[a]);mx[a]=Math.max(mx[a],ly.mx[a]);}}
  mn[1]=Math.max(mn[1],-.05);return {mn,mx};
}

/* =====================================================================
   7a. 体素网格化：只出外露面；逐顶点 AO（三邻格法）+ 逐面半球遮蔽
   ===================================================================== */

/* sRGB → 线性：手写公式，不经过 THREE.Color（新版 three 的 setHex 会自动做色彩管理，再转一次就偏暗） */
const s2l=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
function linRGB(hex,mul){return [s2l(((hex>>16)&255)/255)*mul,s2l(((hex>>8)&255)/255)*mul,s2l((hex&255)/255)*mul];}
function voxelize(s,o,n,M,filter,face){
  FS=s;PF=filter||null;CM=M?M.elements.slice():null;FACE_ON=!!face;
  const f=sampleGrid(o,s,n),[nx,ny,nz]=n;
  const occ=new Uint8Array(nx*ny*nz);for(let i=0;i<f.length;i++)occ[i]=f[i]<0?1:0;
  const at=(i,j,k)=>i<0||j<0||k<0||i>=nx||j>=ny||k>=nz?0:occ[i+nx*(j+ny*k)];
  /* 清理锯齿：只连着 ≤1 个邻格的孤立方块（尖刺）去掉；被 ≥5 个邻格包住的空格（小坑）填上。
     曲面体素化最常见的"毛边"就是这两种单格噪点。 */
  {const n6=(i,j,k)=>at(i+1,j,k)+at(i-1,j,k)+at(i,j+1,k)+at(i,j-1,k)+at(i,j,k+1)+at(i,j,k-1),rm=[],add=[];
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const id=i+nx*(j+ny*k),c=n6(i,j,k);
      if(occ[id]&&c<=1)rm.push(id);else if(!occ[id]&&c>=5)add.push(id);}
    for(const id of rm)occ[id]=0;for(const id of add)occ[id]=1;}
  const DIR=[[1,0,0,[0,1,0],[0,0,1]],[-1,0,0,[0,0,1],[0,1,0]],[0,1,0,[0,0,1],[1,0,0]],[0,-1,0,[1,0,0],[0,0,1]],[0,0,1,[1,0,0],[0,1,0]],[0,0,-1,[0,1,0],[1,0,0]]];
  const AOV=[.66,.79,.91,1];
  const buckets={};let count=0,faces=0;
  /* 平滑 AO：沿 SDF 梯度往外走 5 步，在已经采好的场网格上三线性插值，看场值比"空旷时应有的距离"小多少。
     腋下、领口、裤管口、胯下这种 5~12cm 尺度的褶皱自然变暗；比原来的"数邻格"半球遮蔽平滑，
     不会在光滑曲面上出一圈圈台阶（那套开满就是等高线，所以以前只敢开 18%）。
     不额外求场：只读 f，烘焙几乎不变慢。 */
  const FG=(a,b,c)=>a<0||b<0||c<0||a>=nx||b>=ny||c>=nz?.1:f[a+nx*(b+ny*c)];
  const FT=(x,y,z)=>{
    if(x<0||y<0||z<0||x>nx-1||y>ny-1||z>nz-1)return .1;
    const i0=Math.floor(x),j0=Math.floor(y),k0=Math.floor(z),u=x-i0,v=y-j0,w=z-k0;
    let r=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)r+=FG(i0+a,j0+b,k0+c)*(a?u:1-u)*(b?v:1-v)*(c?w:1-w);
    return r;};
  const AO_H=[.014,.032,.056,.086,.12],AO_K=4.5,aoGrid=new Float32Array(nx*ny*nz).fill(-1);
  const aoAt=(i,j,k)=>{
    const id=i+nx*(j+ny*k);if(aoGrid[id]>=0)return aoGrid[id];
    let gx=FG(i+1,j,k)-FG(i-1,j,k),gy=FG(i,j+1,k)-FG(i,j-1,k),gz=FG(i,j,k+1)-FG(i,j,k-1);const l=Math.hypot(gx,gy,gz)||1;gx/=l;gy/=l;gz/=l;
    const f0=f[id];let occl=0,wt=1;
    for(const h of AO_H){const t=h/s,d=FT(i+gx*t,j+gy*t,k+gz*t);occl+=wt*Math.max(0,f0+h-d);wt*=.75;}
    return aoGrid[id]=clamp(1-AO_K*occl,.25,1);};
  /* 角点 AO = 这个角点周围同一平面内（自己 + 两侧 + 对角）实心格 AO 的平均：明暗沿角点插值，看不出格子 */
  const aoCorner=(i,j,k,U,V,a,b)=>{let sum=0,n=0;
    for(const [p,q] of [[0,0],[a,0],[0,b],[a,b]]){const x=i+p*U[0]+q*V[0],y=j+p*U[1]+q*V[1],z=k+p*U[2]+q*V[2];if(at(x,y,z)){sum+=aoAt(x,y,z);n++;}}
    return n?sum/n:1;};
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if(!occ[i+nx*(j+ny*k)])continue;
    let exposed=false;for(const d of DIR)if(!at(i+d[0],j+d[1],k+d[2])){exposed=true;break;}
    if(!exposed)continue;count++;
    const cx=o[0]+i*s,cy=o[1]+j*s,cz=o[2]+k*s,C0=cL(cx,cy,cz);
    let mul=C0.mul;const h=hash3(i,j,k)-.5;
    if(C0.m===MAT.skin)mul*=1+(vnoise(cx,cy,cz,.05)-.5)*.07+h*.018;
    else if(C0.m===MAT.cloth)mul*=1+h*.025;
    else if(C0.m===MAT.hair)mul*=1+h*.05;
    else if(C0.m===MAT.ball)mul*=1+h*.1;
    else mul*=1+h*.025;
    const rgb=linRGB(C0.hex,mul);
    const own=ownerOf(INFO.prim);
    const bk=buckets[C0.m]||(buckets[C0.m]={p:[],nrm:[],c:[],mt:[],sn:[],ao:[],bi:[],idx:[]});
    // 平滑法线（SDF 梯度）：给 E 版卡渲用，方块外形不变、明暗带不再被台阶切碎
    /* 平滑法线按"角点"算：同一个角点被相邻几个面共用时，法线完全一致——
       卡渲明暗分界沿角点插值（不再跟着方块台阶走锯齿），描边外壳沿法线外推也不会裂开 */
    const F=(a,b,c)=>a<0||b<0||c<0||a>=nx||b>=ny||c>=nz?.05:f[a+nx*(b+ny*c)];
    const cornerN=(sx,sy,sz)=>{const x0=Math.min(i,i+sx),x1=x0+1,y0=Math.min(j,j+sy),y1=y0+1,z0=Math.min(k,k+sz),z1=z0+1;
      let gx=0,gy=0,gz=0;
      for(const y of [y0,y1])for(const z of [z0,z1])gx+=F(x1,y,z)-F(x0,y,z);
      for(const x of [x0,x1])for(const z of [z0,z1])gy+=F(x,y1,z)-F(x,y0,z);
      for(const x of [x0,x1])for(const y of [y0,y1])gz+=F(x,y,z1)-F(x,y,z0);
      const l=Math.hypot(gx,gy,gz)||1;return [gx/l,gy/l,gz/l];};
    for(let di=0;di<6;di++){
      const [dx,dy,dz,U,V]=DIR[di];if(at(i+dx,j+dy,k+dz))continue;faces++;
      const skinLike=C0.m===MAT.skin||C0.m===MAT.hair;   // 皮肤有次表面散射，遮蔽浅一点
      const base=bk.p.length/3,ao=[];
      for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        const pi=i+dx,pj=j+dy,pk=k+dz;
        const s1=at(pi+a*U[0],pj+a*U[1],pk+a*U[2]),s2=at(pi+b*V[0],pj+b*V[1],pk+b*V[2]),cc=at(pi+a*U[0]+b*V[0],pj+a*U[1]+b*V[1],pk+a*U[2]+b*V[2]);
        const lv=s1&&s2?0:3-(s1+s2+cc);ao.push(lv);
        bk.p.push(cx+(dx+a*U[0]+b*V[0])*s/2,cy+(dy+a*U[1]+b*V[1])*s/2,cz+(dz+a*U[2]+b*V[2])*s/2);
        bk.nrm.push(dx,dy,dz);bk.mt.push(C0.m);bk.sn.push(...cornerN(dx+a*U[0]+b*V[0],dy+a*U[1]+b*V[1],dz+a*U[2]+b*V[2]));bk.bi.push(own);
        /* 体素棱边的小暗角只留一半（保住方块感又不脏），大尺度遮蔽走平滑 AO */
        const big=aoCorner(i,j,k,U,V,a,b),m=(1-(1-AOV[lv])*.5)*(skinLike?1-(1-big)*.8:big);bk.ao.push(m);bk.c.push(rgb[0]*m,rgb[1]*m,rgb[2]*m);
      }
      if(ao[0]+ao[2]>=ao[1]+ao[3])bk.idx.push(base,base+1,base+2,base,base+2,base+3);
      else bk.idx.push(base+1,base+2,base+3,base+1,base+3,base);
    }
  }
  PF=null;CM=null;FACE_ON=false;
  const out={};
  for(const m in buckets){const b=buckets[m];out[m]={p:new Float32Array(b.p),c:new Float32Array(b.c),idx:new Uint32Array(b.idx),
    nrm:Int8Array.from(b.nrm,v=>v*127),sn:Int8Array.from(b.sn,v=>Math.round(v*127)),mt:Uint8Array.from(b.mt),ao:Uint8Array.from(b.ao,v=>Math.round(v*255)),bi:Uint8Array.from(b.bi)};}
  return {buckets:out,count,faces};
}
const HB=BI.head;
/* 身体：世界网格（格界对齐地面和 x=0），不含头 */
function voxelBody(s){
  const {mn,mx}=bounds();
  const lo=mn.map(v=>Math.floor(v/s)*s),hi=mx.map(v=>Math.ceil(v/s)*s);lo[1]=Math.max(lo[1],0);
  const n=[0,1,2].map(a=>Math.round((hi[a]-lo[a])/s));
  return voxelize(s,lo.map(v=>v+s/2),n,null,P=>P.bone!==HB,false);
}
/* 头：头骨自己的静止空间网格。x 格界对称，眼睛那一行正好落在格中心 */
function voxelHead(s0){
  const s=s0*HF,face=Math.abs(s0-.012)<1e-6;   // 头部格子随头放大，脸部像素图逐格对齐
  let mn=[9,9,9],mx=[-9,-9,-9];
  for(const ly of LAYERS)for(const P of ly.prims)if(P.bone===HB&&P.op==='u')for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],P.bc[a]-P.br);mx[a]=Math.max(mx[a],P.bc[a]+P.br);}
  const X=Math.ceil(Math.max(-mn[0],mx[0])/s)+1,j0=Math.ceil((EYE_Y-mn[1])/s)+1,j1=Math.ceil((mx[1]-EYE_Y)/s)+1;
  const z0=Math.floor(mn[2]/s)-1,z1=Math.ceil(mx[2]/s)+1;
  return voxelize(s,[-X*s+s/2,EYE_Y-j0*s,z0*s+s/2],[2*X,j0+j1+1,z1-z0],DM[HB],P=>P.bone===HB,face);
}
/* ---------- 平滑网格：Surface Nets，纯数组输出（主线程和 Worker 共用） ----------
   filter/M/bb 与 voxelize 同义：头部单独在头骨局部空间用更细的网格（五官细节 1~2mm，7.5mm 网格会糊）。
   法线取顶点所在格子 8 个角点的差分——不再每个顶点额外求 6 次场，D 版逐帧烘焙才跑得动。 */
function smoothData(s,filter,M,bb){
  FS=M?.003:.006;PF=filter||null;CM=M?M.elements.slice():null;const {mn,mx}=bb||bounds();
  const o=mn.map(v=>v-2*s),n=[0,1,2].map(a=>Math.ceil((mx[a]-mn[a])/s)+5);
  const f=sampleGrid(o,s,n),[nx,ny,nz]=n,id=(i,j,k)=>i+nx*(j+ny*k);
  const cell=new Int32Array(nx*ny*nz).fill(-1),pos=[],gr=[];
  const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const g=new Float32Array(8);
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
    let m=0;for(let c=0;c<8;c++){g[c]=f[id(i+(c&1),j+((c>>1)&1),k+((c>>2)&1))];if(g[c]<0)m|=1<<c;}
    if(m===0||m===255)continue;
    let vx=0,vy=0,vz=0,cnt=0;
    for(const [a,b] of E){if((g[a]<0)===(g[b]<0))continue;const t=g[a]/(g[a]-g[b]);
      vx+=(a&1)+((b&1)-(a&1))*t;vy+=((a>>1)&1)+(((b>>1)&1)-((a>>1)&1))*t;vz+=((a>>2)&1)+(((b>>2)&1)-((a>>2)&1))*t;cnt++;}
    cell[id(i,j,k)]=pos.length/3;pos.push(o[0]+(i+vx/cnt)*s,o[1]+(j+vy/cnt)*s,o[2]+(k+vz/cnt)*s);
    gr.push(g[1]-g[0]+g[3]-g[2]+g[5]-g[4]+g[7]-g[6],g[2]-g[0]+g[3]-g[1]+g[6]-g[4]+g[7]-g[5],g[4]-g[0]+g[5]-g[1]+g[6]-g[2]+g[7]-g[3]);
  }
  const idx=[];
  const quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;flip?idx.push(a,d,c,a,c,b):idx.push(a,b,c,a,c,d);};
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
    const v0=f[id(i,j,k)]<0;
    if(j>0&&k>0&&(f[id(i+1,j,k)]<0)!==v0)quad(cell[id(i,j,k)],cell[id(i,j-1,k)],cell[id(i,j-1,k-1)],cell[id(i,j,k-1)],!v0);
    if(i>0&&k>0&&(f[id(i,j+1,k)]<0)!==v0)quad(cell[id(i,j,k)],cell[id(i,j,k-1)],cell[id(i-1,j,k-1)],cell[id(i-1,j,k)],!v0);
    if(i>0&&j>0&&(f[id(i,j,k+1)]<0)!==v0)quad(cell[id(i,j,k)],cell[id(i-1,j,k)],cell[id(i-1,j-1,k)],cell[id(i,j-1,k)],!v0);
  }
  const nv=pos.length/3,P=new Float32Array(pos),nrm=new Float32Array(nv*3),col=new Float32Array(nv*3),rgh=new Float32Array(nv),mat=new Float32Array(nv),own=new Uint8Array(nv);
  const mR=[.62,.86,.36,.48,.95,.12,.72];
  for(let v=0;v<nv;v++){
    const x=P[v*3],y=P[v*3+1],z=P[v*3+2],gx=gr[v*3],gy=gr[v*3+1],gz=gr[v*3+2],l=Math.hypot(gx,gy,gz)||1;
    nrm[v*3]=gx/l;nrm[v*3+1]=gy/l;nrm[v*3+2]=gz/l;
    const C0=cL(x-gx/l*.002,y-gy/l*.002,z-gz/l*.002);let mul=C0.mul;
    if(C0.m===MAT.skin)mul*=1+(vnoise(x,y,z,.035)-.5)*.1;
    const rgb=linRGB(C0.hex,mul);col[v*3]=rgb[0];col[v*3+1]=rgb[1];col[v*3+2]=rgb[2];mat[v]=C0.m;rgh[v]=mR[C0.m]||.62;own[v]=ownerOf(INFO.prim);
  }
  const I=new Uint32Array(idx);
  // 三角形朝向校正：几何法线与 SDF 梯度反向就翻
  for(let t=0;t<I.length;t+=3){const a=I[t],b=I[t+1],c=I[t+2];
    const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],wx=P[c*3]-P[a*3],wy=P[c*3+1]-P[a*3+1],wz=P[c*3+2]-P[a*3+2];
    const cx=uy*wz-uz*wy,cy=uz*wx-ux*wz,cz=ux*wy-uy*wx;
    if(cx*(nrm[a*3]+nrm[b*3]+nrm[c*3])+cy*(nrm[a*3+1]+nrm[b*3+1]+nrm[c*3+1])+cz*(nrm[a*3+2]+nrm[b*3+2]+nrm[c*3+2])<0){I[t+1]=c;I[t+2]=b;}}
  PF=null;CM=null;
  return {pos:P,nrm,col,mat,rgh,own,idx:I,tris:I.length/3};
}
function headBoundsCore(){
  const mn=[9,9,9],mx=[-9,-9,-9];
  for(const ly of LAYERS)for(const P of ly.prims)if(P.bone===HB&&P.op==='u')for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],P.bc[a]-P.br);mx[a]=Math.max(mx[a],P.bc[a]+P.br);}
  return {mn,mx};
}
/* Worker 入口：主线程给骨骼矩阵，这里出一帧身体的体素网格 */
function workerJob(job){
  if(job.decals){installDecals(job.decals,job.char);return {msg:{id:job.id},transfer:[]};}
  OPT=job.opt;HANDS=job.hands;buildLayers();setDM(job.dm,job.ballOn);
  if(job.kind==='restVox'||job.kind==='restSmooth'){   // 绑定姿势整人（AIBA 皮套用）：身体 + 头，带逐顶点归属骨骼
    // A 字站姿：四肢离开躯干，否则网格会把垂着的手臂和身体连成一片，一抬手就被拉成带子
    if(job.pose){applyPose(job.pose);HANDS=job.hands;buildLayers();finalizePose(false);}
    OWNER=job.owner;let out,tr=[];
    if(job.kind==='restVox'){const body=voxelBody(.012),head=voxelHead(.012);out={body,head};
      for(const d of [body,head])for(const k in d.buckets){const b=d.buckets[k];for(const a of ['p','nrm','c','mt','sn','ao','bi','idx'])tr.push(b[a].buffer);}}
    else{const body=smoothData(job.s||.0085,P=>P.bone!==HB),head=smoothData(.0025,P=>P.bone===HB,DM[HB],headBoundsCore());out={body,head};
      for(const d of [body,head])for(const a of ['pos','nrm','col','mat','rgh','own','idx'])tr.push(d[a].buffer);}
    out.dm=new Float64Array(NB*16);for(let i=0;i<NB;i++)DM[i].toArray(out.dm,i*16);
    OWNER=null;return {msg:{id:job.id,data:out},transfer:tr};
  }
  if(job.kind==='smooth'){const d=smoothData(job.s,P=>P.bone!==HB);return {msg:{id:job.id,data:d},transfer:[d.pos.buffer,d.nrm.buffer,d.col.buffer,d.mat.buffer,d.rgh.buffer,d.idx.buffer]};}
  const data=voxelBody(job.s),tr=[];
  for(const k in data.buckets){const b=data.buckets[k];for(const a of ['p','nrm','c','mt','sn','ao','idx'])tr.push(b[a].buffer);}
  return {msg:{id:job.id,data},transfer:tr};
}

/* 贴花绘制：调用方传 canvas 工厂（主线程用 document.createElement，别处可用 OffscreenCanvas） */
/* 像素字体：胸前字样 / 背后名字逐格对齐体素（1.2cm 一格）。矢量字缩到二十几格宽必然糊，
   直接按格画：字 5 格高，笔画 1 格，字间 1 格，外面一圈 1 格描边。 */
const PIXFONT={
  A:[".#.","#.#","###","#.#","#.#"],B:["##.","#.#","##.","#.#","##."],C:[".##","#..","#..","#..",".##"],D:["##.","#.#","#.#","#.#","##."],
  E:["###","#..","##.","#..","###"],F:["###","#..","##.","#..","#.."],G:[".##","#..","#.#","#.#",".##"],H:["#.#","#.#","###","#.#","#.#"],
  I:["#","#","#","#","#"],J:["..#","..#","..#","#.#",".#."],K:["#.#","#.#","##.","#.#","#.#"],L:["#..","#..","#..","#..","###"],
  M:["#...#","##.##","#.#.#","#...#","#...#"],N:["#..#","##.#","#.##","#..#","#..#"],O:["###","#.#","#.#","#.#","###"],
  P:["##.","#.#","##.","#..","#.."],R:["##.","#.#","##.","#.#","#.#"],S:[".##","#..",".#.","..#","##."],T:["###",".#.",".#.",".#.",".#."],
  U:["#.#","#.#","#.#","#.#","###"],V:["#.#","#.#","#.#","#.#",".#."],W:["#...#","#...#","#.#.#","##.##","#...#"],
  X:["#.#","#.#",".#.","#.#","#.#"],Y:["#.#","#.#",".#.",".#.",".#."],Z:["###","..#",".#.","#..","###"]," ":["","","","",""]};
function buildDecals(mkCanvas,id){
  if(id||!CH)setChar(id||OPT.char);
  const decalData=(w,h,draw)=>{const cv=mkCanvas(w,h);const g=cv.getContext('2d');draw(g);return {w,h,d:g.getImageData(0,0,w,h).data};};
  const hexCss=h=>'#'+h.toString(16).padStart(6,'0');
  const FONT="Impact,'Haettenschweiler','Arial Narrow Bold','Arial Black',sans-serif";
  function arcText(g,txt,cx,cy,R,size,spread,sx){
    g.font=`${size}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';
    const n=txt.length,pos=[];
    for(const pass of ['stroke','fill'])for(let i=0;i<n;i++){
      const a=(i-(n-1)/2)*spread,px=cx+Math.sin(a)*R,py=cy+R-Math.cos(a)*R;if(pass==='fill')pos.push({x:px,y:py,a});
      g.save();g.translate(px,py);g.rotate(a);g.scale(sx,1);
      if(pass==='stroke')g.strokeText(txt[i],0,0);else g.fillText(txt[i],0,0);g.restore();}
    return pos;
  }
  function numText(g,txt,cx,cy,size,sx){
    g.font=`${size}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';
    g.save();g.translate(cx,cy);g.scale(sx,1);g.strokeText(txt,0,0);g.fillText(txt,0,0);g.restore();
  }
  // 球衣贴花：x∈[-.25,.25]，y∈[1.20,1.70]，1600px/m 超清贴花。左手球员整身镜像，贴花预先左右翻过来
  const K=CH.kit,mirror=(g,w)=>{if(CH.mirror){g.translate(w,0);g.scale(-1,1);}};
  const fitArc=(txt,base)=>{const n=txt.length,size=Math.min(base,base*6.4/Math.max(n,1));return {size,spread:.105*size/128*1.02};};
  const numDraw=(g,txt,cx,cy,size,sx,lw)=>{
    g.lineJoin='round';
    if(K.numS2!=null){g.strokeStyle=hexCss(K.numS2);g.lineWidth=lw*1.9;g.fillStyle=hexCss(K.num);
      g.font=`${size}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.save();g.translate(cx,cy);g.scale(sx,1);g.strokeText(txt,0,0);g.restore();}
    g.strokeStyle=hexCss(K.numS);g.fillStyle=hexCss(K.num);g.lineWidth=lw;numText(g,txt,cx,cy,size,sx);};
  const DEC={id:CH.id};
  const star=(g,x,y,r,fill,stroke,rot=0)=>{g.beginPath();for(let k=0;k<10;k++){const a=rot-Math.PI/2+k*Math.PI/5,rr=k&1?r*.45:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}
    g.closePath();g.fillStyle=hexCss(fill);g.fill();if(stroke!=null){g.lineWidth=Math.max(3,r*.22);g.strokeStyle=hexCss(stroke);g.stroke();}};
  const arcWord=(g,txt,cy,R,base,lw,fill,stroke,stroke2,spreadK,sx=.9)=>{const a=fitArc(txt,base);
    if(stroke2!=null){g.strokeStyle=hexCss(stroke2);g.fillStyle=hexCss(stroke2);g.lineWidth=lw*1.9*a.size/base;arcText(g,txt,400,cy,R,a.size,a.spread*spreadK,sx);}
    g.strokeStyle=hexCss(stroke);g.fillStyle=hexCss(fill);g.lineWidth=lw*a.size/base;return {a,pos:arcText(g,txt,400,cy,R,a.size,a.spread*spreadK,sx)};};
  /* 逐格字：cx 格界（x=0 是格界）、topY 设计空间的顶边高度、arc 两端下沉格数。
     画布 800px = .5m：一格宽 1600·s/W、高 1600·s/HY，格界和 voxelBody 的世界网格一致（站姿 / 绑定姿势下严格对齐） */
  const glyph=(c,narrow)=>narrow&&c==='W'?["#.#","#.#","#.#","###","#.#"]:narrow&&c==='M'?["#.#","###","###","#.#","#.#"]:(PIXFONT[c]||PIXFONT[' ']);
  const wordCells=(txt,narrow,tight)=>{let n=0;for(const c of txt.toUpperCase())n+=(glyph(c,narrow)[0].length||1)+(tight?0:1);return n+(tight?2:1);};   // 含字间距和两侧描边
  /* tight：字间不留空（超长名字），相邻字母一深一浅区分 */
  const pixWord=(g,txt,topY,arc,fill,stroke,extra,narrow,tight)=>{
    const s=.012,cw=1600*s/BUILD.W,ch=1600*s/HY,cols=[],shade=mixHex(fill,stroke,.4);let li=0;
    for(const c of txt.toUpperCase()){const G=glyph(c,narrow),w=G[0].length||1;if(cols.length&&!tight)cols.push(null);const tone=tight&&(li++&1)?shade:fill;
      for(let x=0;x<w;x++)cols.push({px:G.map(r=>r[x]==='#'),tone});}
    const W=cols.length,c0=-Math.floor(W/2),j0=Math.round(topY*HY/s),on=new Set();
    const toneAt=new Map();cols.forEach((col,i)=>{if(!col)return;const t=(i+.5-W/2)/(W/2),dy=Math.round(arc*t*t);col.px.forEach((b,r)=>{if(b){const key=(c0+i)+','+(r+dy);on.add(key);toneAt.set(key,col.tone);}});});
    const cell=(k,r,col)=>{const y=(1.7-(j0-r)*s/HY)*1600;g.fillStyle=hexCss(col);g.fillRect(400+k*cw-.5,y-.5,cw+1,ch+1);};
    /* 描边：默认一圈 1 格；K.textShadow 时只落右下一格（细边的观感，1.2cm 一格时整圈描边会连成一块色带） */
    const nb=K.textShadow?[[1,0],[0,1],[1,1]]:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const out=new Set();for(const key of on){const [k,r]=key.split(',').map(Number);for(const [a,b] of nb){const n=(k+a)+','+(r+b);if(!on.has(n))out.add(n);}}
    if(extra!=null){const out2=new Set();for(const key of out){const [k,r]=key.split(',').map(Number);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const n=(k+a)+','+(r+b);if(!on.has(n)&&!out.has(n))out2.add(n);}}
      for(const key of out2){const [k,r]=key.split(',').map(Number);cell(k,r,extra);}}
    for(const key of out){const [k,r]=key.split(',').map(Number);cell(k,r,stroke);}
    for(const key of on){const [k,r]=key.split(',').map(Number);cell(k,r,toneAt.get(key));}
    const letters=[];let i=0;for(const c of txt.toUpperCase()){const w=glyph(c,narrow)[0].length||1,t=(i+w/2-W/2)/(W/2);
      letters.push({k:c0+i,w,dy:Math.round(arc*t*t)});i+=w+(tight?0:1);}
    return {letters,cell};};
  /* 排版：胸前一行最多约 27 格（两侧是袖口滚边）。放不下就把字放到胸口下沿（躯干最宽处），号码下移缩小到腹部——
     真实球衣也是字在胸、号码在腹；"GOLDEN/STATE" 这种用 / 分两行 */
  /* 胸前没有字样（front 为空，比如骑士有袖球衣是一个大 C）时号码照样下移到腹部；
     窄字体还放不下（OKLAHOMA）就字间不留空 */
  const lines=CH.front?CH.front.split('/'):[],narrowF=lines.some(l=>wordCells(l)>27),tightF=lines.some(l=>wordCells(l,narrowF)>27),
    low=!lines.length||lines.length>1||tightF;
  const backLim=Math.round(26-(1.03-BUILD.W)*50),backNarrow=wordCells(CH.back)>backLim,backTight=wordCells(CH.back,backNarrow)>backLim,backLow=backTight;
  DEC.JF=decalData(800,800,g=>{mirror(g,800);g.lineJoin='round';
    let L0=null;lines.forEach((l,i)=>{const r=pixWord(g,l,low?(lines.length>1?1.535-i*.075:1.45):1.6,low?(i?0:1):2,K.text,K.textS,K.textS2,narrowF,tightF&&wordCells(l,narrowF)>27);if(!i)L0=r;});
    if(CH.decor==='cavsC'){   // 骑士 2015-16 有袖球衣：胸口正中一个大号酒红 C、金边（cavshistory 对这套的描述），开口朝右
      const C_=(a,w,c)=>{g.lineCap='butt';g.beginPath();g.arc(400,300,108,a,Math.PI*2-a);g.strokeStyle=hexCss(c);g.lineWidth=w;g.stroke();};
      C_(.7,78,K.trimB);C_(.84,46,K.trimA);}   // 金边比酒红多出一截弧，C 的两个端口也有金边
    if(CH.decor==='sixers'&&L0&&L0.letters.length===6){   // i 上一颗银星（红边），第二个 S 下一颗篮球拖着蓝银尾巴——逐格画
      const I=L0.letters[1],S=L0.letters[5],cell=L0.cell;
      for(const [a,b,c] of [[0,-3,0xc9ced3],[-1,-3,0xc8102e],[1,-3,0xc8102e],[0,-4,0xc8102e],[0,-2,0xc8102e]])cell(I.k+a,I.dy+b,c);
      const by=S.dy+6,bk=S.k+1;
      for(let k=L0.letters[1].k;k<bk-1;k++)cell(k,by+(k<L0.letters[3].k?1:0),0x1d428a);
      for(let k=L0.letters[2].k;k<bk-1;k++)cell(k,by+1+(k<L0.letters[4].k?1:0),0xc9ced3);
      for(const [a,b] of [[0,0],[1,0],[0,1],[1,1],[-1,0],[-1,1],[0,-1],[0,2]])cell(bk+a,by+b,a===0&&b>=0&&b<=1?0x121214:0xe06a1f);
    }
    if(CH.collarStar)star(g,400,182,17,CH.collarStar[0],CH.collarStar[1]);
    if(low)numDraw(g,CH.num,400,700,190,CH.num.length>1?.92:1,15);else numDraw(g,CH.num,400,488,264,CH.num.length>1?.92:1,18);});
  DEC.JB=decalData(800,800,g=>{mirror(g,800);g.lineJoin='round';
    pixWord(g,CH.back,backLow?1.535:1.63,1,K.name!=null?K.name:K.text,K.nameS!=null?K.nameS:K.textS,K.textS2,backNarrow,backTight);
    if(backLow)numDraw(g,CH.num,400,600,370,CH.num.length>1?.80:.95,20);else numDraw(g,CH.num,400,524,456,CH.num.length>1?.80:.95,22);
    g.fillStyle=hexCss(C.nbaB);g.fillRect(376,44,24,48);g.fillStyle=hexCss(C.nbaR);g.fillRect(400,44,24,48);g.fillStyle=hexCss(C.white);g.fillRect(394,60,12,24);});
  // 鞋侧标：z∈[-.11,.21]，y∈[0,.16]。swoosh 勾 / stripes 三道杠 / vector 一道斜杠 / none
  DEC.SW=decalData(200,100,g=>{mirror(g,200);g.fillStyle=hexCss(K.logoC);
    if(K.shoeLogo==='swoosh'){g.beginPath();g.moveTo(22,30);g.quadraticCurveTo(92,70,134,76);
      g.quadraticCurveTo(166,79,162,52);g.quadraticCurveTo(152,66,130,65);g.quadraticCurveTo(88,62,22,30);g.fill();}
    else if(K.shoeLogo==='stripes'){for(let k=0;k<3;k++){const x0=62+k*17;g.beginPath();g.moveTo(x0,34);g.lineTo(x0+9,34);g.lineTo(x0+23,80);g.lineTo(x0+14,80);g.closePath();g.fill();}}
    else if(K.shoeLogo==='vector'){g.beginPath();g.moveTo(40,62);g.lineTo(150,44);g.lineTo(152,54);g.lineTo(44,70);g.closePath();g.fill();}});
  return DEC;
}
