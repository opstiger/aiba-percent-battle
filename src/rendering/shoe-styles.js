/* Three additional shoe families on the accepted L=1 last.
 * Silhouette, collar height, throat length and panel breakup are the only things
 * that differ — forefoot .39 / midfoot .30 / heel .32 / toe base .17 / instep .29
 * stay untouched, so every family fits the same ShoeFitAnchor and the same
 * proportions that were already signed off.
 *
 * GRAPHICS ARE SURFACE-CONFORMING, NOT BOLTED-ON BOXES.
 * The last's cross-section is an octagon whose side wall is vertical only between
 * y = bottom+.025 and y = roof*.63; above that it folds inward toward the instep.
 * The first pass applied stripes and marks as axis-aligned boxes, which crossed
 * that fold: below it they sank into the wall, above it they hung in the air, so
 * every one showed a different random fraction of itself and the shoe read as a
 * mess of shards. Everything decorative is now generated from the same section
 * data as the last, riding the surface a fixed .004 proud of it. That also costs
 * 2 triangles per band instead of 12 per box.
 *
 * All marks here are original geometry. They deliberately do not reproduce any
 * real manufacturer's trademark; each family just needs its own readable signature.
 */
(()=>{
 if(!window.AIBARetroHigh||!window.AIBAShoeLast)throw Error('shoe-styles.js must load after retro-high.js');
 const SEC=AIBAShoeLast.sections;
 const PROUD=.004;

 // Interpolated cross-section of the accepted last at any z.
 function secAt(z){
  if(z<=SEC[0][0])return {w:SEC[0][1],b:SEC[0][2],h:SEC[0][3]};
  for(let i=0;i<SEC.length-1;i++){const a=SEC[i],c=SEC[i+1];
   if(z>=a[0]&&z<=c[0]){const t=(z-a[0])/(c[0]-a[0]);
    return {w:a[1]+t*(c[1]-a[1]),b:a[2]+t*(c[2]-a[2]),h:a[3]+t*(c[3]-a[3])};}}
  const L=SEC[SEC.length-1];return {w:L[1],b:L[2],h:L[3]};
 }
 const roofY=z=>secAt(z).h;
 const halfW=z=>secAt(z).w/2;
 /* A point on the vertical side facet. v=0 sits at the sole break, v=1 where the
    wall folds in toward the instep. Keeping graphics inside v∈[0,1] is exactly what
    stops them being half-buried and half-floating. */
 function facet(z,v,side){
  const s=secAt(z),lo=s.b+.025,mid=s.h*.63,r=s.w/2;
  if(v<=1)return [side*(r+PROUD),lo+v*(mid-lo),z];
  /* v>1 顺着"肩部"那道折线继续往鞋面上包。侧壁只有 .16 左右高,图案到此为止
     就会在鞋腰上留一条空白带 —— 三个品系第一眼"中间是空的"就是这么来的。 */
  const t=Math.min(1,v-1);
  return [side*(r*(1-.33*t)+PROUD),mid+t*(s.h-mid),z];
 }
 // A raked band on the side wall. Winding is flipped per side so lighting stays right.
 function wallBand(push,name,side,{z0,z1,v0,v1,vw,seg=4}){
  for(let i=0;i<seg;i++){
   const t0=i/seg,t1=(i+1)/seg;
   const za=z0+(z1-z0)*t0,zb=z0+(z1-z0)*t1;
   const va=v0+(v1-v0)*t0,vb=v0+(v1-v0)*t1;
   const A=facet(za,va-vw/2,side),B=facet(za,va+vw/2,side);
   const C=facet(zb,vb+vw/2,side),D=facet(zb,vb-vw/2,side);
   if(side>0){push(name,[A,B,C]);push(name,[A,C,D]);}
   else{push(name,[A,C,B]);push(name,[A,D,C]);}
  }
 }
 // A disc on the side wall, for badge-style marks.
 function wallDisc(push,name,side,{z,v,rz,rv,seg=8}){
  const c=facet(z,v,side);
  for(let i=0;i<seg;i++){
   const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
   const p0=facet(z+Math.cos(a0)*rz,v+Math.sin(a0)*rv,side);
   const p1=facet(z+Math.cos(a1)*rz,v+Math.sin(a1)*rv,side);
   if(side>0)push(name,[c,p0,p1]);else push(name,[c,p1,p0]);
  }
 }
 // A rung across the instep roof — lace rows, toe ribs, anything that spans the top.
 function roofBand(push,name,{z0,z1,k=.60}){
  const s0=secAt(z0),s1=secAt(z1);
  const A=[-k*s0.w/2,s0.h+PROUD,z0],B=[k*s0.w/2,s0.h+PROUD,z0];
  const C=[k*s1.w/2,s1.h+PROUD,z1],D=[-k*s1.w/2,s1.h+PROUD,z1];
  push(name,[A,B,C]);push(name,[A,C,D]);
 }
 // Lace rungs riding the instep: evenly spaced, each one a flat band on the roof.
 function instepLaces(push,{from,to,rows,k=.60,thick=.020,name='laceBlock'}){
  for(let i=0;i<rows;i++){const t=rows>1?i/(rows-1):0,z=from+(to-from)*t;
   roofBand(push,name,{z0:z-thick/2,z1:z+thick/2,k:k-.03*t});}
 }
 /* 眼片。鞋带横档贴在鞋面顶部,正侧面看几乎正对边缘,只剩一排虚线。
    真鞋的鞋带区在侧面能看见的是眼片,所以沿鞋面两侧的肩线各补一条。 */
 function eyestay(push,side,{from,to,v=1.28,vw=.24,seg=4,name='eyestay'}){
  wallBand(push,name,side,{z0:from,z1:to,v0:v,v1:v,vw,seg});
 }
 /* Lace rungs on a high-top throat ramp, which climbs above the last and therefore
    cannot be read off the section table. Flat quads on the ramp plane, not boxes. */
 function rampLaces(push,{z0,y0,z1,y1,rows,width,thick=.020,name='laceBlock'}){
  const dz=z1-z0,dy=y1-y0,len=Math.hypot(dz,dy),uz=dz/len,uy=dy/len;
  for(let i=0;i<rows;i++){const t=rows>1?i/(rows-1):0;
   const cz=z0+dz*t,cy=y0+dy*t,hw=(width-.016*t)/2;
   const az=cz-uz*thick/2,ay=cy-uy*thick/2,bz=cz+uz*thick/2,by=cy+uy*thick/2;
   push(name,[[-hw,ay,az],[hw,ay,az],[hw,by,bz]]);
   push(name,[[-hw,ay,az],[hw,by,bz],[-hw,by,bz]]);}
 }
 /* High-top families show mostly SHELL, not last: the last's vertical facet tops out
    around y=.18, so anything drawn with facet() lands in the bottom third of a boot.
    These place graphics on the collar shell's outer wall instead. `lift` stacks a
    second graphic clear of the first so coplanar faces cannot z-fight. */
 /* 壳在平面上不是一面直墙:8 点轮廓在前后两端收到 .7 倍宽。只按高度算 x,
    band 到了端头就会飘在壳外,顶端还会冲出鞋帮口变成尖刺。这里把平面收窄
    和鞋帮口的上限一起算进去。 */
 function shellHalfW(spec,z,w){
  const zb=-spec.backOuter,zf=spec.frontOuter,zb65=-.65*spec.backOuter,zf65=.65*spec.frontOuter;
  if(z<=zb)return .7*w;
  if(z<zb65)return w*(.7+.3*(z-zb)/(zb65-zb));
  if(z<=zf65)return w;
  if(z<zf)return w*(1-.3*(z-zf65)/(zf-zf65));
  return .7*w;
 }
 function shellFacet(spec,y,z,side,lift=0){
  const yc=Math.max(spec.bottom,Math.min(spec.top-.012,y));
  const t=(yc-spec.bottom)/(spec.top-spec.bottom);
  const flare=spec.topFlare!==undefined?spec.topFlare:.94;
  const w=spec.outerW*(1+(flare-1)*t);
  return [side*(shellHalfW(spec,z,w)+PROUD+lift),yc,z];
 }
 function shellBand(push,name,side,spec,{z0,z1,y0,y1,h,seg=2,lift=0}){
  /* 厚度必须沿带子的法向加,不能只沿 Y:带子一陡,Y 方向的 h 在垂直方向上
     就趋近于零,三道斜带会变成三根尖刺。 */
  const dz=z1-z0,dy=y1-y0,len=Math.hypot(dz,dy)||1,nz=-dy/len*h/2,ny=dz/len*h/2;
  for(let i=0;i<seg;i++){
   const t0=i/seg,t1=(i+1)/seg;
   const za=z0+dz*t0,zb=z0+dz*t1,ya=y0+dy*t0,yb=y0+dy*t1;
   const A=shellFacet(spec,ya-ny,za-nz,side,lift),B=shellFacet(spec,ya+ny,za+nz,side,lift);
   const C=shellFacet(spec,yb+ny,zb+nz,side,lift),D=shellFacet(spec,yb-ny,zb-nz,side,lift);
   if(side>0){push(name,[A,B,C]);push(name,[A,C,D]);}
   else{push(name,[A,C,B]);push(name,[A,D,C]);}
  }
 }
 function shellDisc(push,name,side,spec,{z,y,rz,ry,seg=8,lift=0}){
  const c=shellFacet(spec,y,z,side,lift);
  for(let i=0;i<seg;i++){
   const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
   const p0=shellFacet(spec,y+Math.sin(a0)*ry,z+Math.cos(a0)*rz,side,lift);
   const p1=shellFacet(spec,y+Math.sin(a1)*ry,z+Math.cos(a1)*rz,side,lift);
   if(side>0)push(name,[c,p0,p1]);else push(name,[c,p1,p0]);
  }
 }
 /* Collar wall: outer face up, across the crown, inner face down — same four-ring
    topology the accepted RetroHigh collar uses, only the numbers change.
    frontOuter is what actually separates a high-top from a mid or a low: it sets
    how far forward the throat wall reaches before the lacing takes over. */
 function shell({top,bottom=.215,outerW,innerW,frontOuter,frontInner,backOuter,backInner,dip=.012,frontDrop=.055,topFlare=.94}){
  const rings=[{w:outerW,d:backOuter,front:frontOuter,y:bottom},{w:outerW*topFlare,d:backOuter*.74,front:frontInner,y:top},
               {w:innerW,d:backInner*.89,front:frontInner*.89,y:top},{w:innerW*1.045,d:backInner,front:frontOuter*.95,y:bottom}];
  const v=[],ix=[];
  for(const r of rings)for(const [x,z]of [[-.7,-1],[-1,-.65],[-1,.65],[-.7,1],[.7,1],[1,.65],[1,-.65],[.7,-1]])
   v.push(x*r.w,r.y-(z>0?(r.y>=top?dip:frontDrop*z):0),z*(z>0?r.front:r.d));
  for(let j=0;j<4;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=((j+1)%4)*8+(i+1)%8,d=((j+1)%4)*8+i;ix.push(a,b,d,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);
  const flat=g.toNonIndexed();g.dispose();return flat;
 }

 /* ---------------- StripeMid ----------------
    中帮。短鞋口 + 贝壳头横棱 + 侧墙三道斜带。
    标识:三道渐长斜杠(原创,非任何厂商标记),放在侧墙后段的平面上,不塞进后跟凹面。 */
 const STRIPE_SHELL={top:.330,bottom:.165,outerW:.164,innerW:.133,frontOuter:.36,frontInner:.185,backOuter:.235,backInner:.214,frontDrop:.042};
 const stripeMid={
  shoeType:'StripeMid',collarType:'ShellMid',outsoleType:'Cupsole',
  shellSpec:STRIPE_SHELL,
  buildShell:()=>shell(STRIPE_SHELL),
  classifyPanel({isCollar,center,defaultPanel}){
   if(isCollar)return center[1]>.295?'collar':center[2]>.145&&Math.abs(center[0])<.115?'tongue':center[2]<-.12?'heelCounter':'quarterPanel';
   if(defaultPanel==='toeBox'||defaultPanel==='toeCap'||defaultPanel==='mudguard')return center[2]>.585?'shellToe':'toeBox';
   return defaultPanel;
  },
  addDetails({push}){
   for(const side of [-1,1]){
    /* 斜带从鞋腰一直包到肩部(v>1),不再只占侧壁下半截。 */
    /* 三道斜带画在鞋帮壳的侧面板上。鞋楦的竖直侧壁在中足只有 ~.11 世界单位高,
       画什么都是细线;壳的侧面板(y .165~.330)才是整只鞋最大的一块可视面。 */
    for(let i=0;i<3;i++){const z=.205-i*.100;
     shellBand(push,'stripePanel',side,STRIPE_SHELL,{z0:z,z1:z-.100,y0:.178,y1:.266,h:.054,seg:2});}
    /* 这个品系的标识就是三道斜带本身。原来在后跟又加了两道斜杠,不但和第三条
       带子撞在一起,也让侧面同时出现两套语言。删掉,只留一套。 */
   }
   for(let i=0;i<3;i++)roofBand(push,'shellToe',{z0:.700-i*.048,z1:.678-i*.048,k:.58});
   for(const side of [-1,1]){
    eyestay(push,side,{from:.455,to:.065});
    // 后跟拉环:删掉撞车的斜杠标识后这里是一整片空白。
    shellBand(push,'eyestay',side,STRIPE_SHELL,{z0:-.205,z1:-.130,y0:.292,y1:.292,h:.026,seg:1});
   }
   instepLaces(push,{from:.44,to:.075,rows:5});
  }
 };

 /* ---------------- CanvasHigh ----------------
    薄壳高帮。橡胶包头 + 一圈围条 + 侧面圆形贴片。标识:圆盘上一道折线(原创)。 */
 const CANVAS_SHELL={top:.440,bottom:.195,topFlare:1.02,outerW:.146,innerW:.130,frontOuter:.455,frontInner:.160,backOuter:.216,backInner:.201,dip:.008,frontDrop:.046};
 const canvasHigh={
  shoeType:'CanvasHigh',collarType:'CanvasHigh',outsoleType:'Vulcanized',
  shellSpec:CANVAS_SHELL,
  buildShell:()=>shell(CANVAS_SHELL),
  classifyPanel({isCollar,center,defaultPanel}){
   if(isCollar)return center[1]>.355?'collar':center[2]>.135&&Math.abs(center[0])<.106?'tongue':center[2]<-.12?'heelCounter':'quarterPanel';
   // Vulcanised build: the foxing band and the toe bumper are colour regions on the
   // existing surface, so they wrap the shape exactly instead of sitting on it.
   if(defaultPanel==='midsole')return 'foxingTape';
   if(defaultPanel==='toeCap')return 'toeBumper';
   if(defaultPanel==='toeBox'||defaultPanel==='mudguard')return center[2]>.545?'toeBumper':'quarterPanel';
   return defaultPanel;
  },
  addDetails({push}){
   for(const side of [-1,1]){
    /* 中底整条已经被 classifyPanel 归成 foxingTape 了,再画一条围条只会和它重叠打架。
       这里只在围条正上方补一道细的深色压边,让"硫化围条"这个结构读得出来。 */
    wallBand(push,'toeBumper',side,{z0:-.215,z1:.690,v0:.17,v1:.17,vw:.07,seg:8});
    /* 徽标必须画在鞋帮壳上:高帮的可视侧面几乎都是壳,鞋楦侧壁只到 y≈.18。
       折线多抬一层 PROUD,避免和圆盘共面闪烁。 */
    shellDisc(push,'sidePatch',side,CANVAS_SHELL,{z:.070,y:.318,rz:.072,ry:.058,seg:8});
    /* 圆盘里放一道粗斜杠。原来是折线,和 AirRunner 的箭头撞成同一个符号了 ——
       四个品系必须各有各的语言:三道斜带 / 圆盘斜杠 / 折角箭头。 */
    shellBand(push,'brandMark',side,CANVAS_SHELL,{z0:.028,z1:.112,y0:.284,y1:.352,h:.026,seg:1,lift:PROUD});
   }
   // 后跟竖向压条 + 上沿拉环:rear45 下后跟原来是一整片空白。
   /* shellBand 沿 (z,y) 走向铺带,z0===z1 会退化成零面积,画不了竖条。
      后跟用两道横带:上沿拉环 + 下方一道压边,比一条竖条更像鞋的结构。 */
   for(const side of [-1,1]){
    shellBand(push,'brandMark',side,CANVAS_SHELL,{z0:-.185,z1:-.085,y0:.398,y1:.398,h:.022,seg:1});
    shellBand(push,'heelCounter',side,CANVAS_SHELL,{z0:-.205,z1:-.045,y0:.276,y1:.276,h:.070,seg:1});
   }
   for(let i=0;i<3;i++)roofBand(push,'toeBumper',{z0:.715-i*.040,z1:.692-i*.040,k:.60});
   for(const side of [-1,1])eyestay(push,side,{from:.470,to:.180,v:1.22,vw:.22,seg:3});
   rampLaces(push,{z0:.475,y0:.168,z1:.205,y1:.402,rows:6,width:.158});
  }
 };

 /* ---------------- AirRunner ----------------
    低帮缓震。敞口低鞋帮 + 中底气窗 + 后跟稳定片。标识:双折角箭头(原创)。 */
 const AIR_SHELL={top:.243,bottom:.140,outerW:.172,innerW:.142,frontOuter:.30,frontInner:.175,backOuter:.246,backInner:.224,dip:.008,frontDrop:.030};
 const airRunner={
  shoeType:'AirRunner',collarType:'RunnerLow',outsoleType:'CushionedLow',
  shellSpec:AIR_SHELL,
  buildShell:()=>shell(AIR_SHELL),
  classifyPanel({isCollar,center,defaultPanel}){
   if(isCollar)return center[1]>.215?'collar':center[2]>.14&&Math.abs(center[0])<.118?'tongue':center[2]<-.12?'heelClip':'quarterPanel';
   // The window is a band in the middle of the midsole, not the whole sidewall.
   if(defaultPanel==='midsole')return Math.abs(center[0])>.126&&center[2]>-.15&&center[2]<.24?'airWindow':'midsole';
   if(defaultPanel==='heelCounter')return 'heelClip';
   if(defaultPanel==='toeCap'||defaultPanel==='toeBox')return 'toeBox';
   return defaultPanel;
  },
  addDetails({push}){
   for(const side of [-1,1]){
    // Chamber dividers across the window band, low on the wall.
    for(let i=0;i<3;i++){const z=-.09+i*.115;
     wallBand(push,'midsole',side,{z0:z,z1:z-.034,v0:.05,v1:.05,vw:.26,seg:1});}
    wallBand(push,'heelClip',side,{z0:-.240,z1:-.060,v0:.28,v1:.86,vw:.42,seg:3});
    /* 箭头画在壳上,理由同 StripeMid 的斜带。收到侧面板的一半宽度以内 ——
       第一版整条横跨侧面,像贴了个三倍尺寸的 logo。
       两段在顶点各多走 .012 互相压住,否则法向加厚会在夹角处留一个缺口。 */
    /* 两臂必须同 dz / 同 |dy| 才对称;顶点各多走 .012 互相压住,避免法向加厚留缺口。 */
    shellBand(push,'brandMark',side,AIR_SHELL,{z0:.132,z1:.014,y0:.164,y1:.216,h:.030,seg:2});
    shellBand(push,'brandMark',side,AIR_SHELL,{z0:.038,z1:-.080,y0:.216,y1:.164,h:.030,seg:2});
   }
   // 后跟拉环:rear45 下后跟原来是一整片空白。
   for(const side of [-1,1])shellBand(push,'brandMark',side,AIR_SHELL,{z0:-.215,z1:-.140,y0:.206,y1:.206,h:.024,seg:1});
   for(const side of [-1,1])eyestay(push,side,{from:.415,to:.025,v:1.24,vw:.24});
   instepLaces(push,{from:.40,to:.035,rows:5,k:.62});
  }
 };

 const families=Object.freeze({StripeMidPanels:stripeMid,CanvasHighPanels:canvasHigh,AirRunnerPanels:airRunner});
 for(const [name,def]of Object.entries(families))if(!AIBARetroHigh.layouts[name])AIBARetroHigh.registerLayout(name,def);

 /* Grey study values. Review renders read structure from value alone, so the
    approval is about silhouette and panel breakup, not about colour. */
 const grey=Object.freeze({outsole:.30,outsoleEdge:.36,midsole:.78,foxingTape:.84,airWindow:.50,
  toeBox:.62,toeCap:.46,toeBumper:.42,shellToe:.50,mudguard:.44,quarterPanel:.68,stripePanel:.36,
  sidePatch:.86,heelCounter:.42,heelClip:.36,collar:.46,tongue:.40,eyestay:.34,laceBlock:.28,brandMark:.20});

 function build(family,options={}){
  const def=families[family];if(!def)throw Error('Unknown shoe family '+family);
  return AIBARetroHigh.createBasketballShoe({...options,panelLayout:family,
   shoeType:def.shoeType,collarType:def.collarType,outsoleType:def.outsoleType});
 }
 /* Repaint a built shoe into the grey study without touching any production colorway.
    userData.shoe.modules carries each panel's vertex range, so this stays exact. */
 function greyStudy(root,{flat=false}={}){
  const mesh=root.getObjectByName('base_basketball_shoe');if(!mesh)throw Error('no shoe mesh');
  const geo=mesh.geometry.clone(),col=geo.attributes.color;
  for(const m of root.userData.shoe.modules){
   const value=flat?.62:(grey[m.name]!==undefined?grey[m.name]:.55);
   const c=new THREE.Color(value,value,value).convertSRGBToLinear();
   for(let i=m.start;i<m.start+m.count;i++)col.setXYZ(i,c.r,c.g,c.b);
  }
  col.needsUpdate=true;
  mesh.geometry=geo;
  mesh.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide});
  return root;
 }
 window.AIBAShoeStyles=Object.freeze({families:Object.keys(families),build,greyStudy,grey,PROUD,
  secAt,facet,wallBand,wallDisc,roofBand,shell,roofY,halfW});
})();
