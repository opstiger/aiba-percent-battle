function bannerTex(txt,bg,fg){
  return pixTex(768,144,(g)=>{
    g.fillStyle=bg;g.fillRect(0,0,768,144);
    g.fillStyle="rgba(255,255,255,.06)";
    for(let i=0;i<768;i+=24)g.fillRect(i,0,12,144);
    g.fillStyle=fg;g.font="bold 66px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
    g.fillText(txt,384,75);
  },{smooth:true});
}
/* ---------------- 观众席碗 ----------------
   原来是四面独立的直墙、各 4~5 排、完全对称 —— 那只是把训练馆放大。
   真实 NBA 馆是**分层的圆角矩形碗**:
     courtside  球场边缘的地面层,几乎与场地同高
     lower bowl 主层,围绕球场,坡度缓
     upper bowl 上层,更高更陡;四角把相邻两侧**连起来**,不是四面各自断开
   平面形状用超椭圆 |x/rx|^n+|z/rz|^n=1:n=2 是纯椭圆,n 越大越方。
   取 n=3 得到"边直角圆"的圆角矩形,正是 arena bowl 的形状 ——
   关键是它沿角度连续参数化,所以转角和直边来自同一条曲线,
   不像四面直墙那样在角上留四个缺口。 */
const BOWL_N=3,BOWL_SEG=64;
const SEAT_PITCH=0.56;                // 座位中心距(米)
/* 看台通道。真实馆的通道是**斜的**或者分段错开的,
   绝不会从第一排笔直通到最高一排 —— 那读起来就是一条没做完的缺口。
   AISLE_SKEW 让同一条通道的中心随行号斜移,到第末排刚好错开约半个通道间距,
   于是上下排的通道彼此让开,不会首尾相连成竖直长条。 */
const AISLE_COUNT=6;                  // 每层通道条数
const AISLE_W=0.9;                    // 通道净宽(米),验收要求 0.7~1.0
const AISLE_SKEW=0.55;                // 通道中心随行号的斜向偏移(弧度)≈ 半个通道间距
/* 段与段的重叠系数。box 是直的而看台是弯的,再加上径向有厚度,
   外侧需要的宽度比中心弧长更大(半径 R 处约 1+R 分之一的量级),
   不重叠就会在外沿裂出楔形细缝。所以这个数不能压到 1。 */
const STEP_OVERLAP=1.12;
function bowlPt(a,rx,rz){
  const c=Math.cos(a),s=Math.sin(a);
  return [Math.sign(c)*Math.pow(Math.abs(c),2/BOWL_N)*rx,
          Math.sign(s)*Math.pow(Math.abs(s),2/BOWL_N)*rz];
}
/* 三层。rx/rz 是超椭圆半轴(相对球场中心),y 是该层起止高度。
   上层刻意起得更高更远、排数更多 —— 那是"大馆"的体量来源。 */
/* dim 是这一层的压暗强度。越远越暗:近层几乎保留原色,上层压得更狠 ——
   真实转播里看台是有纵深的一片暗,上层只会比下层更暗,不会一样亮。
   没做这层区分时,加高看台之后中景均值从 36 冲到 68.6,
   "球场亮/看台暗"的分层被自己建出来的看台冲掉了(场地/中景只剩 2.2 倍)。 */
const BOWL_TIERS=[
  {rows:2,rx0:10.6,rx1:12.0,rz0:16.8,rz1:18.2,y0:0.35,y1:0.80,seat:1.00,dim:0.46},
  {rows:7,rx0:12.6,rx1:17.0,rz0:18.8,rz1:23.2,y0:1.15,y1:5.40,seat:0.92,dim:0.66},
  {rows:9,rx0:19.6,rx1:26.5,rz0:25.8,rz1:32.5,y0:8.60,y1:16.4,seat:0.80,dim:0.82}
];
function buildStands(){
  const seats=[];
  const stepParts=[];
  /* 0x1b1f2b→0x2b3242。原来太暗,远景里和看台缝隙里的背景黑混成一片,
     看起来像"没有素材的黑色"。真实馆的看台结构体是中性深灰蓝,
     即使暗部也能读得出是材料而不是洞。 */
  const stepColor=new THREE.Color(0x2b3242);
  const up=new THREE.Vector3(0,1,0),mm=new THREE.Matrix4();
  for(let ti=0;ti<BOWL_TIERS.length;ti++){
    const T=BOWL_TIERS[ti];
    for(let r=0;r<T.rows;r++){
      const k=T.rows>1?r/(T.rows-1):0;
      const rx=T.rx0+(T.rx1-T.rx0)*k;
      const rz=T.rz0+(T.rz1-T.rz0)*k;
      const y=T.y0+(T.y1-T.y0)*k;
      const yPrev=r>0?T.y0+(T.y1-T.y0)*((r-1)/(T.rows-1)):0;
      const h=Math.max(0.45,y-yPrev+0.35);
      /* 每行被 AISLE_COUNT 条通道切成同样多的**连续块**。
         不能再用"固定 64 段 + 整段跳过":那样同一个 i 在每一行都被跳过,
         各行的缺口首尾相连,就是验收点名那条从第一排贯穿到最高一排的竖直长条。
         改成块内按角度细分、box 首尾相接(不留缝),块与块之间才是通道。 */
      const skew=T.rows>1?k*AISLE_SKEW:0;
      const sector=Math.PI*2/AISLE_COUNT;
      /* 通道半角。除了净宽本身,还要补偿 STEP_OVERLAP 让相邻 box 多伸出去的那一截,
         否则实际净宽会被吃掉 —— 上层段长大,被吃掉得更多。 */
      const overAng=(Math.PI*2/BOWL_SEG)*(STEP_OVERLAP-1)/2;
      for(let s=0;s<AISLE_COUNT;s++){
        const ac=((s+0.5)/AISLE_COUNT)*Math.PI*2+skew;
        const [cx,cz]=bowlPt(ac,rx,rz);
        const rad=Math.hypot(cx,cz)||1;
        const half=(AISLE_W/2)/rad+overAng;
        const a0=ac-sector/2+half,a1=ac+sector/2-half;
        const span=a1-a0;
        const cnt=Math.max(2,Math.round(span/(Math.PI*2/BOWL_SEG)));
        const segAng=span/cnt;
        for(let j=0;j<cnt;j++){
          const a=a0+segAng*(j+0.5);
          const [x,z]=bowlPt(a,rx,rz);
          const [nx,nz]=bowlPt(a+segAng,rx,rz);
          const arc=Math.hypot(nx-x,nz-z)*STEP_OVERLAP;
          /* ⚠ 轴向:这个旋转把局部 z 转到**切线**、局部 x 转到**径向**,
             所以段长 arc 必须给 z、排深 1.55 给 x。
             旧版写反了(arc 给 x、1.55 给 z),等于拿固定 1.55m 去覆盖
             1.4~2.6m 的段长,中上层每段都裂一道缝;而径向拿到 2m 多的段长
             去覆盖 0.73~0.86m 的排距,看台又叠成一坨实心块。 */
          mm.compose(new THREE.Vector3(x,y-h/2,z),
            new THREE.Quaternion().setFromAxisAngle(up,Math.atan2(nx-x,nz-z)),
            new THREE.Vector3(1.55,h,arc));
          stepParts.push({color:stepColor,matrix:mm.clone()});
          /* 座位沿切线铺开,数量按**弧长**算:外圈段更长,坐同样多的人就会留出大缝,
             那正是"三人一组 + 组间空洞"的来源。按 segLen/SEAT_PITCH 取整,
             每一段的座位间距才一致,看台才是连续铺满的。
             空座只用"个别座位略矮"表现,不挖空位 —— 挖了是洞,不是空座。 */
          const segLen=Math.hypot(nx-x,nz-z)||1;
          const n=Math.max(2,Math.round(segLen/SEAT_PITCH));
          const ux=(nx-x)/segLen,uz=(nz-z)/segLen;
          for(let q=0;q<n;q++){
            const off=(q-(n-1)/2)*SEAT_PITCH;
            /* 位置抖动保留:它打散排列、弱化横向条纹,但不能替代覆盖率 */
            const absent=Math.random()<0.04;                // 极少量空座
            seats.push({x:x+ux*off+rnd(-.10,.10),
              y:y+(absent?0.30:0.42)+rnd(-.05,.05),         // 空座只矮一点点
              z:z+uz*off+rnd(-.10,.10),
              ph:Math.random()*7,amp:absent?0:rnd(.7,1.3),t:ti});
          }
        }
      }
    }
  }
  if(stepParts.length)bakeVoxelMesh(indoorRoot,stepParts);
  // banner walls
  const banners=[["aiBA PERCENT BATTLE","#13213f","#ffd23f"],["MINE-DEW 深远三分区","#0c3a14","#9dff8d"],["像素之夜 PIXEL NIGHT","#3a1240","#ff9df1"]];
  /* 横幅墙外移并**抬高到看台上方**(y 3.6→9.2)。
     原来墙在 y=3.6,比加高后的看台(7.65m)还矮,会被看台整片挡住;
     抬到看台顶之上,四面墙才和看台一起围成一个"碗",
     球场因此读成"嵌在 arena bowl 里"而不是"摆在方盒子中间"。
     宽度同步加大(26→34 / 38→48)以覆盖变长的看台。 */
  const wallDefs=[
    [0,9.2,COURT.nearBaseline-18,0,34],
    [-27.5,9.2,COURT.midZ,Math.PI/2,48],
    [27.5,9.2,COURT.midZ,-Math.PI/2,48],
    [0,9.2,COURT.farBaseline+18,Math.PI,34]
  ];
  wallDefs.forEach((w,i)=>{
    const b=banners[i%banners.length];
    /* 横幅墙用的是 MeshBasicMaterial —— 不吃灯,所以无论球馆多暗它都满亮,
       在原画面里是最抢眼的一块。压光只能靠 color 乘算:留住可读性,交出视觉焦点。 */
    /* 0x555d6e→0x333a45。横幅墙是 MeshBasicMaterial,**不吃灯**,
       球馆再暗它都满亮 —— 抬高看台之后它整片落进中景带,成了看台区域最亮的一块,
       中景均值因此压不下来。压暗之后广告内容仍可读,但不再抢过球场的视觉焦点。 */
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w[4],4),
      new THREE.MeshBasicMaterial({map:bannerTex(b[0],b[1],b[2]),color:0x3d4550}));
    m.position.set(w[0],w[1]+4.5,w[2]);m.rotation.y=w[3];indoorRoot.add(m);
  });
  return seats;
}

/* ---------------- 球馆顶棚 ----------------
   球馆原本没有顶。相机一仰,画面上方就是一片纯黑 —— 实测占画面高度 34%。
   那不是"暗",是"空":没有上边界,光也没有可见来源,首屏运镜只能靠压低视线和收 FOV 硬躲。

   补三层:深色顶面(读得出是个面,不是空洞)+ 桁架梁(给纵深和尺度)+ 悬挂灯箱(让光有来源)。
   全部静态,烘成 2 个网格(结构一个、灯一个),只多 2 个 draw call。
   挂在 indoorRoot 上,室外场景(environments.js 里 indoorRoot.visible=!outdoor)自动不显示。 */
/* 15.4→19.5。看台从 4.25m 加高到 7.65m 之后,原来的顶棚离看台顶只剩 7m 出头,
   仰拍时顶棚压在头上 —— 那是"低顶训练馆"的读感,不是 arena bowl。
   抬高到 19.5 之后,看台顶到顶棚有近 12m 的上部体积,球场才像"嵌在一个碗里"。
   (灯阵固定挂在 11.5m,不跟着 CEIL_Y 走,所以抬高顶棚不影响照明和阴影精度。) */
const CEIL_Y=19.5;
/* ---------------- 职业馆细节 ----------------
   看台分层做好之后,剩下的"小馆感"来自缺少这些只有职业馆才有的元件。
   它们同时也是抬头就能读出"这是大馆"的最强信号:
     · courtside LED 广告带  球场边缘一圈滚动字幕,把比赛面和外围分开
     · suite / club 层        下层与上层之间的包厢圈,看台因此有了"中段"
     · 退役球衣               悬挂在端线上方的一排号码旗
     · 顶棚桁架               开放式钢架,而不是一整块实心顶板
     · 中央吊挂记分牌         球场正上方四面屏 + 从顶棚垂下来的钢架
   全部是静态几何:广告带/记分牌各自合并成很少几个 draw call,
   包厢和桁架走已有的 bakeVoxelMesh 烘焙。 */
const RIBBON_ADS=["aiBA","MINE-DEW","PIXEL SPORT","BLOCKADE","COURT CAM","N1KE AIR","ADI-DASH","3PT KING"];
function mat4At(x,y,z,rot,sx,sy,sz){
  const m=new THREE.Matrix4();
  m.compose(new THREE.Vector3(x,y,z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rot),
    new THREE.Vector3(sx,sy,sz));
  return m;
}
/* 沿碗走一圈的朝向:取角度上前进一小步的切线,让每段广告/包厢正对场内。 */
function bowlFacing(a,rx,rz){
  const [x,z]=bowlPt(a,rx,rz),[nx,nz]=bowlPt(a+0.04,rx,rz);
  return {x,z,rot:Math.atan2(nx-x,nz-z)+(x||z?0:0)};
}
function buildCourtsideRibbon(){
  /* 球场边缘一圈 LED 广告带。真实馆里这一圈是"比赛面"和"外围"的分界线,
     有了它球场才读成一块被围起来的正式比赛区,而不是木地板随便铺到看台脚下。 */
  const SEG=24,rx=9.35,rz=15.6;
  for(let i=0;i<SEG;i++){
    const a=i/SEG*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    const txt=RIBBON_ADS[i%RIBBON_ADS.length];
    const m=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.5),
      new THREE.MeshBasicMaterial({map:bannerTex(txt,"#070c14","#7ee7ff"),
        side:THREE.DoubleSide,color:0x8fa3b8}));
    m.position.set(p.x,0.5,p.z);m.rotation.y=p.rot;
    indoorRoot.add(m);
  }
}
/* 上层栏杆跑马灯(验收点名)。
   场边那圈 LED 广告带(courtside ribbon)在 y=0.5 已经有了,
   但上层栏杆这一圈一直是空的 —— 后侧/高位机位看过去,
   上层就是一条没有任何内容的深灰带,转播感少一半。
   真实馆在这里装的是**窄幅、低亮度**的跑马灯:要能被读到,
   但绝不能变成第二道亮色横墙把注意力从球场抢走。
   所以高度只给 0.42m、亮度压到 0x39424e,并做成**间歇滚动**
   (滚一段停一段)而不是匀速常亮 —— 画面里多一条持续运动的亮线非常抢眼。
   位置取上层看台的前缘(y≈9.15,比上层第一排 8.6 略高、半径略内),
   正是真实馆 upper bowl fascia 的位置。 */
const UPPER_ADS="aiBA   ·   3PT KING   ·   PIXEL SPORT   ·   COURT CAM   ·   ";
let upperRibbonTex=[];
function buildUpperRibbon(){
  const SEG=32,rx=19.0,rz=25.2;
  /* 只做两张贴图(cyan 为主、yellow 点缀),32 段共用 ——
     每段一张的话是 32 张纹理 + 32 次 texture update,没必要。 */
  const mk=(fg)=>{
    const t=bannerTex(UPPER_ADS,"#080d18",fg);
    t.wrapS=THREE.RepeatWrapping;t.repeat.set(5,1);
    return t;
  };
  upperRibbonTex=[mk("#5fd8ff"),mk("#ffd23f")];
  for(let i=0;i<SEG;i++){
    const a=i/SEG*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(4.45,0.42),
      new THREE.MeshBasicMaterial({map:upperRibbonTex[i%5===0?1:0],
        side:THREE.DoubleSide,color:0x39424e}));
    m.position.set(p.x,9.15,p.z);m.rotation.y=p.rot;
    indoorRoot.add(m);
  }
}
/* 跑马灯滚动。由 updCrowd 每帧带进来,不另开一个 tick。 */
function updUpperRibbon(t){
  if(!upperRibbonTex.length)return;
  /* 6 秒一个周期:前 3.2 秒匀速左滚,后 2.8 秒停住。
     停的那一下让它读起来像 LED 字幕机在换屏,而不是一条一直在动的装饰。 */
  const cyc=(t*0.5)%6,run=Math.min(cyc,3.2),off=-run*0.10;
  for(const tx of upperRibbonTex)tx.offset.x=off;
}
function buildSuiteRing(){
  /* 包厢圈。它给看台补上"中段" —— 没有它,下层到上层之间是空的,
     看台读起来就是一整片斜坡;有了这圈带玻璃和内部灯的盒子,
     层次才像真实馆的 club level。位置卡在 lower 顶(5.4m)与 upper 底(8.6m)之间。 */
  /* N 16→32、单盒宽 4.0→4.3。原来 16 个盒子彼此隔开很大,
     从侧面/后侧机位看就是一根根**独立的大柱子**(验收点名"不想要中间那些大柱子")。
     加密到 32 个之后盒子首尾相接、连成一整圈,读起来是"一层连续的包厢带";
     再在每两个之间插一根细分隔柱,让它看起来是一排包厢窗口而不是一堵墙。
     底板和玻璃同时提亮:原来太暗,远景里和背景的黑洞混成一片。 */
  /* 蓝色方柱的来历(验收点名):这里原本每两个包厢之间插一块
     (径向 0.34 / 高 3.1 / 切向 3.5) 的"分隔柱"。它其实不是柱子,
     是一块**切向宽、径向薄**的竖板 —— 3.1m 高从包厢底一直顶到包厢顶,
     在侧面和后侧机位读起来就是一根根蓝色方柱。
     改成:竖向分隔只保留在**玻璃那一层**(高 1.35m、径向收到 0.10),
     那是窗框不是柱子;包厢主体与玻璃去掉偏蓝的冷色,改中性深灰。 */
  const parts=[];
  const N=32,rx=18.7,rz=24.7;
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    parts.push({color:0x2b2e34,matrix:mat4At(p.x,7.0,p.z,p.rot,4.35,3.0,3.4)});      // 包厢体(中性深灰)
    parts.push({color:0x39454f,matrix:mat4At(p.x,7.35,p.z,p.rot,4.45,1.3,3.5)});     // 玻璃(去蓝)
    parts.push({color:0x55483a,matrix:mat4At(p.x,5.5,p.z,p.rot,4.35,0.35,3.3)});     // 底板(暖)
    /* 窗框:只在玻璃高度上做细分隔,不再是贯穿包厢全高的方柱 */
    const d=bowlFacing(a+Math.PI/N,rx,rz);
    parts.push({color:0x22262c,matrix:mat4At(d.x,7.35,d.z,d.rot,0.10,1.35,3.5)});
    /* 栏杆:包厢前沿顶部一道窄横杆。真实 club level 的栏杆是细横线条,
       有了它这圈才读作"一排包厢 + 栏杆",而不是一堵实心墙。 */
    const rl=bowlFacing(a,rx-0.75,rz-0.75);
    parts.push({color:0x39414d,matrix:mat4At(rl.x,8.58,rl.z,rl.rot,0.16,0.16,3.5)});
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"suite"});
}
/* 底线记者席(验收点名)。
   NBA 转播画面里,篮架后方那一排**低坐姿**的摄影记者是标志性元素:
   他们坐在地板上或矮凳上、膝盖架着长焦,整个人压得很低 ——
   所以底线后绝不该是一排站着的人腿挡住镜头。
   之前这一带完全是用站立观众填的,低位机位一压就露馅。
   做成静态几何即可:摄影记者拍摄时基本不动,不需要骨骼动画。
   只铺在篮架**两侧**:正后方留给篮架底座和斜撑,
   真实转播里摄影记者也是分列篮架左右,不会坐在底座正后方挡住球员。 */
function buildPressRow(){
  const parts=[],mm=new THREE.Matrix4();
  const q=new THREE.Quaternion();
  const push=(x,y,z,sx,sy,sz,c)=>{
    mm.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));
    parts.push({color:c,matrix:mm.clone()});
  };
  /* 深色媒体区:转播里这一片是近黑的,不能再沿用观众的花色 */
  const COAT=[0x181b20,0x14161b,0x1c2026,0x101318];
  /* dir=+1 近端(球场在 +z,相机朝 +z) / -1 远端(球场在 −z)。
     z 取底线外约 3m:再往前会撞上后移到 -11.22 的篮架底座,
     再往后就出地板了(floorMinZ −13 / floorMaxZ 23)。 */
  const rows=[[COURT.nearBaseline-3.0,1],[COURT.farBaseline+3.0,-1]];
  for(let ri=0;ri<rows.length;ri++){
    const bz=rows[ri][0],dir=rows[ri][1];
    for(let side=-1;side<=1;side+=2){
      for(let i=0;i<6;i++){
        const x=side*(2.0+i*0.78)+rnd(-.06,.06);
        const z=bz+rnd(-.10,.10);
        const coat=COAT[(i+ri*3+8)%COAT.length];
        push(x,0.30,z,0.46,0.60,0.42,coat);                 // 坐姿躯干(压得很低)
        push(x,0.72,z,0.24,0.24,0.24,0x8a6a52);             // 头
        push(x,0.63,z+dir*0.26,0.20,0.18,0.32,0x111318);    // 机身
        push(x,0.64,z+dir*0.44,0.12,0.12,0.16,0x0a0c10);    // 镜头
        push(x,0.09,z+dir*0.34,0.44,0.16,0.50,coat);        // 前伸的腿
      }
    }
    /* 媒体区挡板:把记者席和后面的看台在视觉上分开。
       黑色吸光材质是转播的标准做法 —— 不加这一道,
       记者就直接"坐在看台第一排上",媒体区读不出来。 */
    for(let i=0;i<10;i++)push((i-4.5)*1.5,0.55,bz-dir*0.55,1.55,1.10,0.16,0x0d1015);
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"press"});
}
/* 看台顶部以上的**上部围墙**。
   上层看台最高到 16.4m,而横幅墙只到约 11.7m,中间那一圈(16.4m→顶棚 19.5m)
   之前完全没有几何 —— 转播和后侧机位看过去就是一条纯粹的黑色带,
   因为那里露出来的是 scene.background 的深蓝黑,没有任何材质。
   验收说的"走道不能是全黑的吧,看起来像没有素材的黑色"就是这一圈。
   补一圈围墙填掉,颜色取比看台略暗但仍是材料色的深灰蓝。 */
function buildUpperWall(){
  const parts=[];
  const SEGN=44,rx=27.8,rz=33.8;
  const yBot=15.6,yTop=CEIL_Y-0.5,h=yTop-yBot;
  for(let i=0;i<SEGN;i++){
    const a=i/SEGN*Math.PI*2;
    const p=bowlFacing(a,rx,rz);
    parts.push({color:0x1a202b,matrix:mat4At(p.x,(yTop+yBot)/2,p.z,p.rot,4.4,h,1.3)});
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"upperwall"});
}
/* 注意不能叫 jerseyTex —— characters.js 里已有一个(球员球衣号码贴图,签名不同)。
   经典脚本是共享全局作用域,同名 function 会互相覆盖,
   第一次就踩了:buildCeiling 调到的实际是 characters 那个,参数对不上直接抛错,
   初始化中断,后面一连串 'g' 报错全是它引发的连锁反应。 */
function retiredJerseyTex(num){
  return pixTex(64,80,(g)=>{
    g.fillStyle="#12172a";g.fillRect(0,0,64,80);
    g.fillStyle="#e8c65a";g.fillRect(6,8,52,62);
    g.fillStyle="#12172a";g.font="bold 38px Orbitron, monospace";
    g.textAlign="center";g.fillText(num,32,54);
    g.fillStyle="#8d7331";g.fillRect(6,8,52,6);            // 领口
  },{smooth:true});
}
function scoreboardTex(){
  return pixTex(256,128,(g)=>{
    g.fillStyle="#05070d";g.fillRect(0,0,256,128);
    g.fillStyle="#0b1220";g.fillRect(5,5,246,118);
    g.fillStyle="#7ee7ff";g.font="bold 30px Orbitron, monospace";g.textAlign="center";
    g.fillText("aiBA",128,34);
    g.fillStyle="#ffd23f";g.font="bold 34px Orbitron, monospace";
    g.fillText("108 : 96",128,74);
    g.fillStyle="#7CFC6B";g.font="bold 20px Orbitron, monospace";
    g.fillText("Q4  03:47",128,104);
  },{smooth:true});
}
function buildRetiredJerseys(){
  /* 退役球衣。真实馆把它们挂在端线上方的桁架上,是"这支球队有历史"的信号,
     也是顶棚区域里少数几个有内容的元素 —— 没有它,那片空间就是空的暗。 */
  const nums=["24","8","33","21","3","15"],N=nums.length;
  for(let i=0;i<N;i++){
    const x=(i-(N-1)/2)*2.5;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.2),
      /* 压暗一档。Basic 材质不吃灯、默认满亮,之前这排球衣比球场正上方的
         中央吊挂屏还抢眼(评测点名了)。压到 0x6f7889 之后它退回"背景里的历史陈列",
         注意力才回到比赛面和中央记分牌。 */
      new THREE.MeshBasicMaterial({map:retiredJerseyTex(nums[i]),side:THREE.DoubleSide,color:0x6f7889}));
    m.position.set(x,12.4,COURT.nearBaseline-9.5);
    indoorRoot.add(m);
  }
}
function buildCenterHung(){
  /* 中央吊挂记分牌。职业馆抬头最强的识别特征:球场正上方一块四面可见的大屏,
     用钢架从顶棚吊下来。原来只有一个端线 jumbo,仰拍时中央是空的。
     八面环绕而不是四面: court 是圆的,八面从任何机位看过去都不会看到"侧面空白"。 */
  const y=12.8,cz=COURT.midZ,tex=scoreboardTex();
  const N=8,R=3.1;
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(3.7,2.05),
      new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    m.position.set(Math.sin(a)*R,y,cz+Math.cos(a)*R);
    m.rotation.y=a;
    indoorRoot.add(m);
  }
  const capMat=new THREE.MeshLambertMaterial({color:0x151a26});
  [1.0,-1.0].forEach(dy=>{
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(R+0.32,R+0.32,0.4,N),capMat);
    cap.position.set(0,y+dy,cz);indoorRoot.add(cap);
  });
  const parts=[];
  for(let i=0;i<4;i++){                                   // 从顶棚垂下的吊杆
    const a=i/4*Math.PI*2+Math.PI/4;
    const sx=Math.sin(a)*1.5,sz=Math.cos(a)*1.5;
    const h=CEIL_Y-y-1.0;
    parts.push({color:0x1a202b,pos:[sx,(CEIL_Y+y+1.0)/2,cz+sz],scale:[0.18,h,0.18]});
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"hangar"});
}

function buildCeiling(){
  /* 顶棚跟着看台一起外扩:看台现在向外延伸到约 ±26.8 / z −26.8~36,
     原来的 X=20.5 / ZA/B 装不下,边缘会露出背景色(读作"破洞")。 */
  const X=28,ZA=COURT.nearBaseline-17,ZB=COURT.farBaseline+19;
  const zSpan=ZB-ZA,zMid=(ZA+ZB)/2;
  const parts=[];
  /* 顶面不用纯黑:纯黑和"没有东西"在画面上是一样的。带一点蓝的深色才读得出是个面。 */
  /* 这几个色号是配合 v2.20 的新灯光重新定的。环境光从 .32 降到 .13 之后,
     朝下的顶面只剩原来 37% 的照度 —— 沿用旧色号,v2.19.9 好不容易补出来的桁架
     会重新黑成一片(实测画面上部近黑面积 28.6% → 57%)。 */
  /* 整体压暗约四成。环境项从 .33 提到 1.12 之后,朝下的顶面被 ambient 大量提亮,
     实测画面上部均值从 46 涨到 75 —— 照明分层(场地亮/顶棚暗)被冲掉了,
     "场地比顶棚"从 2.91 掉到 1.89。参考图的分层很明确:顶棚是暗的中性面,
     亮度全留给场地。压回这一档之后分层恢复到 2.9 左右。
     不能压到纯黑:那样桁架会重新读不出结构,和"没有东西"在画面上是一样的。 */
  /* 再压一档。上一版压到四成后顶棚均值 62.5,仍**亮于中景 54.1** —— 顺序反了:
     真实球馆的亮度序是场地 > 看台 > 顶棚,顶棚该是最暗的那一层。
     (画面顶带里混着自发光灯箱,所以结构色要压得比"看起来够暗"更狠一点,
     均值才拉得下来;灯箱本身保持亮度,那是"看得到灯"的来源。) */
  parts.push({color:0x0b0e16,pos:[0,CEIL_Y,zMid],scale:[X*2,0.5,zSpan]});
  /* 桁架从"几根梁"改成交错网格 + 斜撑。原来只有 9 横 3 纵,仰拍时是一片空板
     加几道线,读起来像仓库顶;真实馆是开放式钢架:主梁、次梁、斜撑三层交叠,
     灯具挂在架子上。这里用同一套烘焙,只多几何不 draw call。 */
  for(let i=0;i<9;i++){                                   // 横向主梁
    const z=ZA+zSpan*(i+0.5)/9;
    parts.push({color:0x1d2330,pos:[0,CEIL_Y-0.85,z],scale:[X*2,0.34,0.5]});
    parts.push({color:0x141922,pos:[0,CEIL_Y-1.32,z],scale:[X*2,0.16,0.22]});
  }
  [-22,-11,0,11,22].forEach(x=>                           // 纵向主梁(加密)
    parts.push({color:0x1d2330,pos:[x,CEIL_Y-0.55,zMid],scale:[0.5,0.30,zSpan]}));
  /* 斜撑:每格一道对角,是"桁架"和"几根横梁"的分界线 */
  for(let i=0;i<8;i++){
    const z0=ZA+zSpan*(i+0.5)/9, z1=ZA+zSpan*(i+1.5)/9;
    const zm=(z0+z1)/2, dz=z1-z0;
    for(let sx=-1;sx<=1;sx+=2){
      const rot=sx*Math.atan2(dz,11);
      parts.push({color:0x171d27,matrix:mat4At(sx*11,CEIL_Y-1.15,zm,rot,0.22,0.18,Math.hypot(dz,22))});
    }
  }
  bakeVoxelMesh(indoorRoot,parts,{materialKey:"ceiling"});

  /* 灯箱自发光。画面里本来就有一道射灯光锥,但看不到灯 —— 补上光源本体,
     顶部那片区域才从"空洞"变成"有内容的暗部"。 */
  const lamps=[],lampPos=[];
  for(let r=0;r<2;r++)for(let i=0;i<7;i++){
    const p=[(r?1:-1)*6.2,CEIL_Y-2.0,ZA+zSpan*(i+0.6)/7];
    lamps.push({color:0xffffff,pos:p,scale:[3.0,0.28,1.5]});
    /* 只有落在打球那半场(z 在底线到中线之间)的灯需要光锥和地面灯池 ——
       后场的灯给不到画面里,做了也只是白烧填充率。实际命中 3 排 × 2 侧 = 6 盏。 */
    if(p[2]>COURT.nearBaseline-1.5&&p[2]<COURT.playMaxZ+1.5)lampPos.push(p);
  }
  bakeVoxelMesh(indoorRoot,lamps,{materialKey:"ceilingLamp",material:{emissive:0xffe6b4}});
  buildLightShafts(lampPos);
  buildFloorLightPools(lampPos);
  /* 职业馆元件统一在这里挂:包厢圈、场边广告带、退役球衣、中央吊挂大屏 */
  buildSuiteRing();
  buildUpperWall();
  buildCourtsideRibbon();
  buildUpperRibbon();
  buildPressRow();
  buildRetiredJerseys();
  buildCenterHung();
}

/* ---------------- 灯光锥 & 地面灯池 ----------------
   球馆里"有空气"这件事,画面上只有一个来源:看得见光走过的路径。
   原来顶上有灯箱、地上有亮度,中间那 13 米什么都没有,所以画面是"两层贴纸"。

   两样东西补这一段,都是加色(Additive)、不写深度、极低不透明度:
     光锥   —— 灯到地板之间的一段可见光柱,给纵深和体积感
     地面灯池 —— 灯正下方地板被照亮的一摊,给"地板是被这几盏灯照亮的"因果关系
   都不是真体积光(那要 raymarch),但方块美术下这层假体积读起来是对的,
   代价是 6 个 draw call + 1 个平面。 */
function shaftGradientTex(){
  return pixTex(4,64,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h);
    gr.addColorStop(0,"rgba(255,238,205,.85)");   // 贴着灯最亮
    gr.addColorStop(.35,"rgba(255,232,192,.34)");
    gr.addColorStop(1,"rgba(255,226,180,0)");     // 落到地面前散掉
    g.clearRect(0,0,w,h);g.fillStyle=gr;g.fillRect(0,0,w,h);
  },{smooth:true});
}
/* 默认关闭。它是实心 CylinderGeometry + AdditiveBlending + DoubleSide + fog:false:
   只要有几何,轮廓处视线就切着锥面穿过更厚的壳、累积更亮,硬边界是**几何决定的**,
   调 opacity 只能让它淡,不能让它不像一只锥子。加上不吃雾、暗背景上又特别跳,
   结果就是"我直接看到了一个 Spotlight Cone 模型",而参考图要的是
   "我能感觉到灯在哪里" —— 那靠地面灯池 + 顶灯发光 + bloom 就够了,不需要画光的路径。
   想对比就加 ?shafts=1。 */
const SHAFTS_ON=(()=>{try{return /(\?|&)shafts=1(&|#|$)/.test(location.search);}catch(e){return false;}})();
function buildLightShafts(lampPos){
  if(!lampPos.length||!SHAFTS_ON)return;
  const top=CEIL_Y-2.2,height=top;
  const geo=new THREE.CylinderGeometry(1.0,2.8,height,14,1,true);
  /* opacity 只有 .13:光锥一旦"看得清",就不是空气而是一只实心灰锥子 ——
     它的作用是在暗部里给一层几乎察觉不到的方向感,不是当造型元素用。
     双面 + 加色意味着一条光锥前后两层都会叠加,实际亮度是这个数的两倍左右。 */
  const mat=new THREE.MeshBasicMaterial({map:shaftGradientTex(),transparent:true,opacity:.18,
    depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false});
  for(const p of lampPos){
    /* 机位常在 z≈+3 附近,比这更靠后的灯,光锥会整片糊在画面顶上 */
    if(p[2]>1)continue;
    const m=new THREE.Mesh(geo,mat);
    m.position.set(p[0],height/2,p[2]);m.renderOrder=6;indoorRoot.add(m);
  }
}
/* 默认关闭。它是 AdditiveBlending 的地面贴图,**绕过高光直接把颜色加到地板上**,
   所以 opacity 从 .38 降到 .13、再开 fog 都治不了 —— fog 只压远处,
   而白光池出现在**近处**(第一人称下方、跟随左侧、yaw 177 后侧),
   只要这一层还在,那几个机位就永远有一块不属于白线的白。
   真实 SpotLight 的照明加上地板 PBR 已经够了,这一层是叠上去的多余亮度。
   需要氛围(展示镜头/截图)时用 ?pools=1 单独开。 */
const POOLS_ON=(()=>{
  try{return /(\?|&)pools=1(&|#|$)/.test(location.search);}catch(e){return false;}
})();
function buildFloorLightPools(lampPos){
  if(!POOLS_ON)return;
  const W=32,D=COURT.floorMaxZ-COURT.floorMinZ,PX=14;
  const tex=pixTex(Math.round(W*PX),Math.round(D*PX),(g,w,h)=>{
    g.fillStyle="#000";g.fillRect(0,0,w,h);
    const u=x=>(x+W/2)/W*w,v=z=>(z-COURT.floorMinZ)/D*h;
    g.globalCompositeOperation="lighter";
    /* 每盏灯一摊。椭圆:顺着球场纵向拉长一点,像真实条形灯箱在地板上的投影 */
    for(const p of lampPos){
      const cx=u(p[0]),cy=v(p[2]),r=4.6/W*w;
      const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
      gr.addColorStop(0,"rgba(255,236,201,.30)");
      gr.addColorStop(.45,"rgba(255,229,187,.10)");
      gr.addColorStop(1,"rgba(255,226,180,0)");
      g.save();g.translate(cx,cy);g.scale(1,1.35);g.translate(-cx,-cy);
      g.fillStyle=gr;g.fillRect(cx-r,cy-r*1.4,r*2,r*2.8);g.restore();
      /* 灯箱本体在地板上的镜面倒影:很窄、很长。这一道才是"反光",
         上面那摊只是"被照亮"。两者叠起来读作打过蜡的球馆地板;
         只有其中一样,要么像哑光胶地,要么像镜子。 */
      const sr=1.6/W*w;
      const sg=g.createRadialGradient(cx,cy,0,cx,cy,sr);
      sg.addColorStop(0,"rgba(255,246,226,.30)");
      sg.addColorStop(.5,"rgba(255,242,214,.10)");
      sg.addColorStop(1,"rgba(255,240,210,0)");
      g.save();g.translate(cx,cy);g.scale(.5,3.1);g.translate(-cx,-cy);
      g.fillStyle=sg;g.fillRect(cx-sr,cy-sr,sr*2,sr*2);g.restore();
    }
    /* 投篮区一层更大更淡的暖罩,把几摊连起来,免得读成"六个手电筒" */
    const cx=u(0),cy=v(-3),r=15/W*w;
    const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,"rgba(255,231,192,.055)");
    gr.addColorStop(1,"rgba(255,226,180,0)");
    g.fillStyle=gr;g.fillRect(cx-r,cy-r,r*2,r*2);
  },{smooth:true,mipmaps:true});
  /* opacity .38→.13、fog 打开。这一层是 AdditiveBlending 的地面贴图,
     **绕过高光系统直接把颜色加到地板上**,所以不管 SpotLight 怎么调柔,
     白光池都还在 —— 它是叠加出来的,不是照出来的(第一人称/跟随/后侧三个视角
     都能看到的白块就是它,之前一直在调灯,方向错了)。
     压到 .13 之后它只负责"地板被顶灯照亮的那一层暖调",不再自己发白;
     打开 fog 让远端的灯池随距离衰减,避免整片糊成一块亮斑。 */
  const m=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({
    map:tex,transparent:true,opacity:.13,depthWrite:false,blending:THREE.AdditiveBlending,fog:true}));
  m.rotation.x=-Math.PI/2;
  /* 角色接地影在 y=0.014 / renderOrder=-1,灯池必须压在它下面,
     否则加色会把刚做出来的接地影冲掉。 */
  m.position.set(0,.008,(COURT.floorMinZ+COURT.floorMaxZ)/2);m.renderOrder=-2;
  indoorRoot.add(m);
}

/* backcourt show: the far half is atmosphere only, shooting stays on the same half */
const showCrew=[];
function showBox(parent,geo,mat,x,y,z,sx,sy,sz){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);
  return m;
}
/* ---------------- voxel baking: 把一组固定方块烘焙成单个带顶点色的网格 ----------------
   方块风格的角色/道具由几十个纯色 Box 组成,每个都是一次 draw call。凡是彼此不再独立
   运动的部件,都可以在构建期烘焙进同一个几何体,用顶点色保留各自颜色,材质统一为白色
   Lambert(shader 里 diffuse *= vColor,结果与原来逐块着色一致)。
   只接受"位置+缩放"的轴对齐盒子,和 showBox 的语义保持一致。 */
const VOXEL_UNIT_BOX=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const VOXEL_BAKED_MATERIALS=new Map();
function bakedVoxelMaterial(key,opts){
  const id=key||"basic";
  if(VOXEL_BAKED_MATERIALS.has(id))return VOXEL_BAKED_MATERIALS.get(id);
  const m=new THREE.MeshLambertMaterial(Object.assign({color:0xffffff,vertexColors:true},opts||{}));
  VOXEL_BAKED_MATERIALS.set(id,m);
  return m;
}
/* parts: [{color:THREE.Color|number, pos:[x,y,z], scale:[sx,sy,sz]}] 或 [{color, matrix:Matrix4}] */
function bakeVoxelGeometry(parts){
  const src=VOXEL_UNIT_BOX,srcPos=src.getAttribute("position"),srcNorm=src.getAttribute("normal");
  const per=srcPos.count,total=per*parts.length;
  const pos=new Float32Array(total*3),norm=new Float32Array(total*3),col=new Float32Array(total*3);
  const m=new THREE.Matrix4(),nm=new THREE.Matrix3(),v=new THREE.Vector3(),c=new THREE.Color();
  let off=0;
  for(const part of parts){
    if(part.matrix)m.copy(part.matrix);
    else{
      const s=part.scale||[1,1,1],p=part.pos||[0,0,0];
      m.makeScale(s[0],s[1],s[2]);m.setPosition(p[0],p[1],p[2]);
    }
    nm.getNormalMatrix(m);
    if(part.color&&part.color.isColor)c.copy(part.color);else c.set(part.color==null?0xffffff:part.color);
    for(let i=0;i<per;i++){
      const o=(off+i)*3;
      v.fromBufferAttribute(srcPos,i).applyMatrix4(m);
      pos[o]=v.x;pos[o+1]=v.y;pos[o+2]=v.z;
      v.fromBufferAttribute(srcNorm,i).applyMatrix3(nm).normalize();
      norm[o]=v.x;norm[o+1]=v.y;norm[o+2]=v.z;
      col[o]=c.r;col[o+1]=c.g;col[o+2]=c.b;
    }
    off+=per;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("normal",new THREE.BufferAttribute(norm,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  geo.computeBoundingSphere();
  return geo;
}
/* 便捷封装:烘焙并挂到 parent 上,返回单个 Mesh */
function bakeVoxelMesh(parent,parts,opts){
  const mesh=new THREE.Mesh(bakeVoxelGeometry(parts),bakedVoxelMaterial((opts&&opts.materialKey)||"basic",opts&&opts.material));
  if(parent)parent.add(mesh);
  return mesh;
}
function makeAdBoard(txt,bg,fg,x,z,rot,w=2.7){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,0.72),
    new THREE.MeshBasicMaterial({map:bannerTex(txt,bg,fg),side:THREE.DoubleSide,color:0x9aa3b2}));
  m.position.set(x,0.66,z);m.rotation.y=rot;indoorRoot.add(m);
  return m;
}
function makeCheerleader(x,z,jersey,pom){
  const g=new THREE.Group();
  const cube=new THREE.BoxGeometry(1,1,1);
  const skin=new THREE.MeshLambertMaterial({color:0xf4c89c});
  const hair=new THREE.MeshLambertMaterial({color:0x2b1710});
  const shirt=new THREE.MeshLambertMaterial({color:jersey});
  const dark=new THREE.MeshLambertMaterial({color:0x202431});
  const pomMat=new THREE.MeshLambertMaterial({color:pom,emissive:pom,emissiveIntensity:.18});
  showBox(g,cube,shirt,0,0.82,0,0.34,0.62,0.22);
  showBox(g,cube,skin,0,1.32,0,0.26,0.26,0.24);
  showBox(g,cube,hair,0,1.48,-0.02,0.3,0.12,0.26);
  showBox(g,cube,dark,-0.12,0.34,0,0.11,0.5,0.12);
  showBox(g,cube,dark,0.12,0.34,0,0.11,0.5,0.12);
  const leftArm=showBox(g,cube,skin,-0.33,1.0,0,0.09,0.42,0.1);
  const rightArm=showBox(g,cube,skin,0.33,1.0,0,0.09,0.42,0.1);
  const leftPom=showBox(g,cube,pomMat,-0.43,1.24,0,0.22,0.22,0.22);
  const rightPom=showBox(g,cube,pomMat,0.43,1.24,0,0.22,0.22,0.22);
  g.position.set(x,0,z);
  g.rotation.y=x<0?0.35:-0.35;
  indoorRoot.add(g);
  showCrew.push({type:"cheer",g,arms:[leftArm,rightArm],poms:[leftPom,rightPom],phase:Math.random()*7});
}
function makeMascot(x,z){
  const g=new THREE.Group();
  const cube=new THREE.BoxGeometry(1,1,1);
  const orange=new THREE.MeshLambertMaterial({color:0xf28b22});
  const cream=new THREE.MeshLambertMaterial({color:0xffd2a1});
  const dark=new THREE.MeshLambertMaterial({color:0x1e1210});
  showBox(g,cube,orange,0,0.82,0,0.56,0.82,0.42);
  showBox(g,cube,orange,0,1.55,0,0.64,0.54,0.48);
  showBox(g,cube,cream,0,1.45,-0.26,0.42,0.24,0.08);
  showBox(g,cube,dark,-0.18,1.62,-0.3,0.07,0.07,0.04);
  showBox(g,cube,dark,0.18,1.62,-0.3,0.07,0.07,0.04);
  showBox(g,cube,orange,-0.28,1.9,0,0.18,0.18,0.12).rotation.z=0.45;
  showBox(g,cube,orange,0.28,1.9,0,0.18,0.18,0.12).rotation.z=-0.45;
  const stripes=[-0.25,0,0.25].map(px=>showBox(g,cube,dark,px,1.57,-0.33,0.04,0.24,0.03));
  const armL=showBox(g,cube,orange,-0.52,1.15,0,0.15,0.62,0.16);
  const armR=showBox(g,cube,orange,0.52,1.15,0,0.15,0.62,0.16);
  showBox(g,cube,dark,-0.18,0.18,0,0.15,0.34,0.14);
  showBox(g,cube,dark,0.18,0.18,0,0.15,0.34,0.14);
  g.position.set(x,0,z);g.rotation.y=-0.55;indoorRoot.add(g);
  showCrew.push({type:"mascot",g,arms:[armL,armR],stripes,phase:Math.random()*7});
}
function buildBackcourtShow(){
  makeAdBoard("N1KE AIR","#11131a","#f7f7f7",-8.05,COURT.midZ+4.2,Math.PI/2,2.6);
  makeAdBoard("ADI-DASH","#f7f7f7","#11131a",-8.05,COURT.midZ+7.5,Math.PI/2,2.6);
  makeAdBoard("PIXEL SPORT","#182f61","#ffd23f",8.05,COURT.midZ+4.2,-Math.PI/2,2.8);
  makeAdBoard("BLOCKADE","#3b132f","#ffb7ec",8.05,COURT.midZ+7.5,-Math.PI/2,2.8);
  makeAdBoard("MINE-DEW","#0c3a14","#9dff8d",-4.6,COURT.farBaseline-.2,Math.PI,3.0);
  makeAdBoard("COURT CAM","#27212f","#9fd1ff",0,COURT.farBaseline-.2,Math.PI,3.0);
  makeAdBoard("3PT KING","#5b1212","#ffd23f",4.6,COURT.farBaseline-.2,Math.PI,3.0);
  const cheerPos=[[-5.8,COURT.midZ+6.1],[-4.7,COURT.midZ+7.4],[-3.6,COURT.midZ+6.3],[3.6,COURT.midZ+6.3],[4.7,COURT.midZ+7.4],[5.8,COURT.midZ+6.1]];
  cheerPos.forEach((p,i)=>makeCheerleader(p[0],p[1],i%2?0xffc72c:0x1d428a,i%2?0x7CFC6B:0xff4fd8));
  makeMascot(6.35,COURT.midZ+8.2);
}
function updBackcourtShow(t){
  if(!indoorRoot.visible)return;
  showCrew.forEach((c,i)=>{
    const s=Math.sin(t*5+c.phase), c2=Math.cos(t*4.2+c.phase);
    if(c.type==="mascot"){
      c.g.position.y=Math.max(0,s)*0.08;
      c.g.rotation.y=-0.55+Math.sin(t*2+c.phase)*0.08;
      c.arms[0].rotation.z=0.5+Math.sin(t*4+c.phase)*0.35;
      c.arms[1].rotation.z=-0.9+Math.sin(t*5+c.phase)*0.45;
    }else{
      c.g.position.y=Math.max(0,s)*0.05;
      c.g.rotation.y+=(c2*0.0015);
      c.arms[0].rotation.z=-0.75+s*0.55;
      c.arms[1].rotation.z=0.75-s*0.55;
      c.poms[0].position.y=1.24+Math.max(0,s)*0.18;
      c.poms[1].position.y=1.24+Math.max(0,-s)*0.18;
    }
  });
}
/* crowd: grouped instanced meshes (no per-instance color needed) */
const crowd={groups:[],dummy:new THREE.Object3D()};
/* 看台观众退到背景里,靠的不是"调暗一点",而是同时拿掉两样东西:
   饱和度(彩色块最抢眼)和亮度。纯降亮度会变成一堆深色但依然刺眼的色块。
   近场观众(spectators.js)不走这一层 —— 他们是中景,让灯光自己压。 */
function recede(hex,desat,dark){
  const c=new THREE.Color(hex),l=c.r*.299+c.g*.587+c.b*.114;
  c.lerp(new THREE.Color(l,l,l),desat);
  return c.lerp(new THREE.Color(0x131824),dark);
}
/* 服色基色:中性深灰蓝/棕打底,留一个暗紫灰点缀。真实转播里看台是暗的中性块面,
   不是彩色积木墙 —— 原来那套金黄/红/绿/橙就是"糖果色拼盘"的观感来源。 */
const CROWD_BODY=[0x171a21,0x23272f,0x1c2534,0x2f3540,0x3a2f26,0x2a2029];
const CROWD_HEAD=[0xf4c89c,0xd9a066,0x8d5524];
function buildCrowd(seats){
  const bodyGeo=new THREE.BoxGeometry(0.55,0.75,0.4);
  const headGeo=new THREE.BoxGeometry(0.38,0.38,0.38);
  /* 按"层 × 服色"分桶。同层共用该层暗度(BOWL_TIERS[t].dim),层与层之间亮度递减,
     于是看台从近到远自然压深 —— 这是"看台有纵深"的来源,
     也是把中景亮度压回去、保住"球场亮/看台暗"分层的手段。
     组数 = 层数 × 服色数,InstancedMesh 每组一次 draw call,量级仍然很小。 */
  const NT=BOWL_TIERS.length,NC=CROWD_BODY.length;
  const buckets=[];for(let i=0;i<NT*NC;i++)buckets.push([]);
  seats.forEach(s=>{
    const t=(s.t==null?1:s.t);
    buckets[t*NC+((Math.random()*NC)|0)].push(s);
  });
  buckets.forEach((arr,idx)=>{
    if(!arr.length)return;
    const t=Math.floor(idx/NC),c=idx%NC,dim=BOWL_TIERS[t].dim;
    const body=new THREE.InstancedMesh(bodyGeo,
      new THREE.MeshLambertMaterial({color:recede(CROWD_BODY[c],dim,dim*.62)}),arr.length);
    const head=new THREE.InstancedMesh(headGeo,
      new THREE.MeshLambertMaterial({color:recede(CROWD_HEAD[c%3],dim*.8,dim*.66)}),arr.length);
    indoorRoot.add(body);indoorRoot.add(head);
    crowd.groups.push({body,head,seats:arr,tier:t});   // tier 供 updCrowd 降频用
  });
}
/* 座位加密到四千级之后,每帧逐个算矩阵(body+head 两次)会明显吃 CPU,
   所以按层降频 —— 这是本轮唯一有真实性能代价的改动,降频点全部集中在这里,
   真机吃紧时把下面两个 3 / 2 再往上调即可,不用动别处。 */
let _crowdTick=0;
function updCrowd(t){
  if(!indoorRoot.visible)return;
  _crowdTick++;
  /* 上层看台排数最多、离镜头最远 → 每 3 帧更新一次
     全场安静时只剩 sway(幅度 0.035m)→ 再降一半,肉眼分不出 */
  const calm=((typeof G!=="undefined"?G.cheer:0)<.05);
  const d=crowd.dummy;
  for(const g of crowd.groups){
    const tier=(g.tier==null?1:g.tier);
    if(tier>=2&&(_crowdTick%3)!==0)continue;
    if(calm&&(_crowdTick%2)!==0)continue;
    for(let i=0;i<g.seats.length;i++){
      const s=g.seats[i];
      const jump=Math.max(0,Math.sin(t*9+s.ph))*0.4*G.cheer*s.amp;
      const sway=Math.sin(t*1.4+s.ph)*0.035;
      d.position.set(s.x,s.y+jump+sway,s.z);
      d.rotation.y=Math.sin(s.ph)*0.4;
      d.updateMatrix();g.body.setMatrixAt(i,d.matrix);
      d.position.y+=0.58;d.updateMatrix();g.head.setMatrixAt(i,d.matrix);
    }
    g.body.instanceMatrix.needsUpdate=true;
    g.head.instanceMatrix.needsUpdate=true;
  }
  updUpperRibbon(t);
}


window.AIBA.runtime.register("rendering:arena",Object.freeze({
  bannerTex,buildStands,showBox,makeAdBoard,buildBackcourtShow,updBackcourtShow,buildCrowd,updCrowd,
  buildLightShafts,buildFloorLightPools,recede
}));
