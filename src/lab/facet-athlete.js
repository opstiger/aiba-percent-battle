/* ---------------- 切面运动员 v2（实验，不接主链路） ----------------
   v1 的问题（2026-11-10 用户反馈）：比例夸张（胸宽 .455 / 腰 .30，胸腰比 1.5）不像人；整个人是一次性建出来的，
   换不了球衣、发型、配件、球鞋。v2 只做 24 号，按两条原则重写：

   一、比例按真实人体（1.98m 的 NBA 后卫，穿鞋身高）
     髋关节 1.05m（53%）、膝 .575、肩关节 1.61、肩关节间距 .41、三角肌外缘 .55
     裸身：胸 .385 / 腰 .315（胸腰比 1.22）/ 髋 .36；头高 .255（约 7.8 头身）
     球衣是布，不是皮：从胸口直着垂到腰带，宽度 .375~.40 —— 穿上以后看不到倒三角

   二、身体和穿戴分层，每一层是一个槽位，单独替换
     骨架    只有关节，不带任何网格
     身体    完整的皮肤身体（躯干也有），带 UV；纹身画在皮肤贴图上
     槽位    kit 球衣短裤 / socks / shoes / hair / beard / gear.head / gear.sleeve / gear.wrist / gear.knee /
             gear.compression，对应游戏里 star 记录、AIBAPlayerKit、装备五槽（shoes/sleeve/knee/compression/band）
     贴身件  护臂、护腕、护膝、压缩衣、袜子、头带、络腮胡、寸头都是同一个生成器：
             wrap(身体部位, 起止高度, 外扩量, 颜色) —— 从身体自己的截面取一段往外扩，体格变了自动跟着变
     注册表  HAIR / BEARD / HEADGEAR / SHOES / TATTOO：加新款式 = 注册一个函数，不改 build
     球鞋    内置切面鞋，或直接挂游戏里已验收的 AIBAShoeStyles 品系 + 配色
   用法：
     const a=AIBAFacet.build(AIBAFacet.fromStar(star));   // 或 AIBAFacet.LOOK24
     a.set("hair",{style:"afro"}); a.set("gear.sleeve",{side:"L",color:0x111111}); a.set("gear.sleeve",null);
     a.set("tattoo",{upperArmR:"upper"}); a.set("shoes",{style:"game",family:"AirRunnerPanels",colorway:"approved_AirRunnerPanels_mono"});
   骨架：hips → spine → chest → head；肩 → 肘 → 腕；髋 → 膝 → 踝。角色面朝 +Z，左手 = +X。
   造型仍是低边数切面 + 平直着色、刚性分段、手臂 IK。 */
(function(global){
  "use strict";
  const T=global.THREE;
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

  /* 骨长（米，穿鞋）。hipY 是髋关节离地高度 */
  const B={hipY:1.05,spine:.10,chest:.18,shX:.222,shY:.28,neck:.425,upArm:.345,foreArm:.29,thigh:.475,shin:.465,ankle:.11,hipX:.09};
  const HEAD_S=.95,HEAD_SZ=1.04,SHOE_S=1.05,BALL_R=.12;
  const PALM_Y=.095,PALM_Z=.02;   // 掌心相对手腕：沿手指方向 9.5cm、掌面离骨轴 2cm

  /* ---------- 颜色（顶点色，线性空间） ---------- */
  const _cc=new Map();
  function C(hex){let c=_cc.get(hex);if(!c){c=new T.Color(hex).convertSRGBToLinear();_cc.set(hex,c);}return c;}
  function mix(a,b,t){const ch=sh=>Math.round((a>>sh&255)+((b>>sh&255)-(a>>sh&255))*t);return ch(16)<<16|ch(8)<<8|ch(0);}
  function mul(hex,k){const r=(hex>>16&255)*k,g=(hex>>8&255)*k,b=(hex&255)*k;return (clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);}
  const lum=hex=>((hex>>16&255)*.299+(hex>>8&255)*.587+(hex&255)*.114)/255;
  const MAT=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.74,metalness:0});
  const MAT_GLOSS=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.42,metalness:0});
  /* 场馆主光从背后上方来，球员正面（脸）在暗面里会压成死黑。给切面材质加一点底光：按自己颜色的 FILL 自发光，
     暗面保住肤色和五官，亮面几乎不变（体素皮套的卡渲着色器也有同样的环境光补偿） */
  const FILL=.12;
  function lift(m){
    m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\n\ttotalEmissiveRadiance+=diffuseColor.rgb*"+FILL.toFixed(3)+";");};
    return m;
  }
  lift(MAT);lift(MAT_GLOSS);

  /* ---------- 截面 ----------
     N 边形，超椭圆采样（n=2 椭圆，越大越方）。相位保证正前方（+Z）一定是一个平面而不是一条棱。
     d 为数字 = 总厚度；为 [前, 后] = 前后半厚分开给。 */
  const phaseOf=N=>{const step=Math.PI*2/N;let p=(Math.PI/2-step/2)%step;if(p<0)p+=step;return p;};
  function ring(N,n,y,w,d,o){
    o=o||{};
    const step=Math.PI*2/N,phase=phaseOf(N);
    const e=2/n,df=Array.isArray(d)?d[0]:d/2,db=Array.isArray(d)?d[1]:d/2,pts=[];
    for(let k=0;k<N;k++){
      const a=phase+k*step,c=Math.cos(a),s=Math.sin(a);
      pts.push([(w/2)*Math.sign(c)*Math.pow(Math.abs(c),e)+(o.cx||0),(s>0?df:db)*Math.sign(s)*Math.pow(Math.abs(s),e)+(o.cz||0)]);
    }
    return {y,pts,c:o.c,s:o.s==null?1:o.s};
  }
  /* ---------- 放样 ----------
     rings 自下而上（y 递增）。ring.c 是"这一圈到上一圈之间那一段"的颜色，没写就沿用下面一段，按段硬切。
     opt.face(mx,mz,i,k) 按面覆盖颜色；opt.warp(x,y,z) 逐顶点变形（鞋头上翘、发际线）。
     UV：u 绕一圈 0→1（从相位角起逆时针），v 沿高度 0→1 —— 皮肤纹身和以后的布料贴图都用它。 */
  function loft(rings,opt){
    opt=opt||{};
    const N=rings[0].pts.length,pos=[],col=[],uv=[],W=opt.warp;
    const y0=rings[0].y,yh=(rings[rings.length-1].y-y0)||1;
    const put=(p,y,c,s,u)=>{
      uv.push(u,(y-y0)/yh);
      if(W){const r=W(p[0],y,p[1]);pos.push(r[0],r[1],r[2]);}else pos.push(p[0],y,p[1]);
      col.push(c.r*s,c.g*s,c.b*s);
    };
    let band=rings[0].c;
    for(let i=0;i<rings.length-1;i++){
      const a=rings[i],b=rings[i+1];
      if(a.c!=null)band=a.c;
      for(let k=0;k<N;k++){
        const k2=(k+1)%N,mx=(a.pts[k][0]+a.pts[k2][0])/2,mz=(a.pts[k][1]+a.pts[k2][1])/2,u0=k/N,u1=(k+1)/N;
        let hex=band;
        if(opt.face){const f=opt.face(mx,mz,i,k);if(f!=null)hex=f;}
        const c=C(hex);
        const A=[a.pts[k],a.y,a.s,u0],Bq=[a.pts[k2],a.y,a.s,u1],Cq=[b.pts[k2],b.y,b.s,u1],D=[b.pts[k],b.y,b.s,u0];
        const tris=mx>1e-6?[A,Cq,Bq,A,D,Cq]:[A,D,Bq,Bq,D,Cq];
        for(const v of tris)put(v[0],v[1],c,v[2],v[3]);
      }
    }
    const cap=(r,top,hex)=>{
      let ox=0,oz=0;for(const p of r.pts){ox+=p[0];oz+=p[1];}
      const O=[ox/N,oz/N],c=C(hex);
      for(let k=0;k<N;k++){
        const p=r.pts[k],q=r.pts[(k+1)%N];
        if(top){put(O,r.y,c,r.s,.5);put(q,r.y,c,r.s,.5);put(p,r.y,c,r.s,.5);}
        else{put(O,r.y,c,r.s,.5);put(p,r.y,c,r.s,.5);put(q,r.y,c,r.s,.5);}
      }
    };
    if(opt.capB!==false)cap(rings[0],false,opt.capB!=null?opt.capB:rings[0].c);
    if(opt.capT!==false)cap(rings[rings.length-1],true,opt.capT!=null?opt.capT:band);
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
    g.setAttribute("color",new T.Float32BufferAttribute(col,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    g.computeVertexNormals();
    return bake(g);
  }
  /* ---------- 切面明暗 ----------
     低模好不好看全在"每个面的明暗不一样"。球馆的灯是从背后上方来的，正面一片平光，面与面分不开。
     所以把一层造型光直接烘进顶点色：每个三角面按自己的朝向（朝上、朝前的亮，朝下的暗）乘一个系数，再加一点点逐面的随机深浅。
     它跟着部位一起转，任何灯光下肌肉、布料的折面都读得出来。只处理非索引几何（放样 / 开口壳 / 三角片） */
  const BAKE_L=[.3,.8,.52],BAKE_K=.13,BAKE_J=.05;
  function bake(g){
    const P=g.attributes.position.array,Cc=g.attributes.color.array;
    for(let i=0;i<P.length;i+=9){
      const ux=P[i+3]-P[i],uy=P[i+4]-P[i+1],uz=P[i+5]-P[i+2],vx=P[i+6]-P[i],vy=P[i+7]-P[i+1],vz=P[i+8]-P[i+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(l<1e-12)continue;nx/=l;ny/=l;nz/=l;
      const cx=Math.abs(P[i]+P[i+3]+P[i+6]),cy=P[i+1]+P[i+4]+P[i+7],cz=P[i+2]+P[i+5]+P[i+8];
      const h=Math.sin(cx*127.1+cy*311.7+cz*74.7)*43758.5453,j=(h-Math.floor(h)-.5)*BAKE_J;
      const k=.9+BAKE_K*(nx*BAKE_L[0]+ny*BAKE_L[1]+nz*BAKE_L[2])+j;
      for(let q=0;q<9;q++)Cc[i+q]*=k;
    }
    return g;
  }
  function tint(g,hex){
    const c=C(hex),n=g.attributes.position.count,a=new Float32Array(n*3);
    for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}
    g.setAttribute("color",new T.BufferAttribute(a,3));return g;
  }
  function mesh(geo,mat){const m=new T.Mesh(geo,mat||MAT);m.castShadow=true;m.receiveShadow=true;return m;}
  function box(w,h,d,hex){return mesh(tint(new T.BoxGeometry(w,h,d),hex));}
  function tri(pts,hex){
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pts.flat(),3));
    g.computeVertexNormals();return mesh(bake(tint(g,hex)));
  }
  /* ---------- 开口壳 ----------
     布料用：每一行是截面超椭圆（指数 n）上从角度 a0 到 a1 的一段弧，分 K 段；相邻两行缝成面。
     角度 0 = 正侧面（+X），π/2 = 正前（+Z），-π/2 = 正后。每行 {y,w,df,db,a0,a1[,cx,cz,s]}，a0==a1 的地方这一片收成一个点。
     mir = 左右镜像。和 loft 的区别：不闭合、每行的起止角可以不同 —— 领口、袖窿这种斜着切的边就是靠它切出来的。
     o.zig：隔行把采样点错开半格，行与行之间缝成一圈三角形（菱形折面，布料的样子）；两端的点不动，所以和旁边的镶边还是严丝合缝。
     o.fold：错开的那些点隔一个往外鼓 fold（半径的比例）—— 布料的褶。 */
  function shell(n){
    const pos=[],col=[],e=2/n;
    const pt=(r,t,mir,f)=>{const a=r.a0+(r.a1-r.a0)*t,c=Math.cos(a),s=Math.sin(a),k=1+(f||0);
      return [(mir?-1:1)*(r.w/2)*k*Math.sign(c)*Math.pow(Math.abs(c),e)+(r.cx||0),r.y,(s>0?r.df:r.db)*k*Math.sign(s)*Math.pow(Math.abs(s),e)+(r.cz||0),r.s==null?1:r.s];};
    const tri3=(c,flip,A,Bq,Cq)=>{for(const p of flip?[A,Cq,Bq]:[A,Bq,Cq]){pos.push(p[0],p[1],p[2]);col.push(c.r*p[3],c.g*p[3],c.b*p[3]);}};
    return {
      add(rows,K,hex,mir,o){
        o=o||{};const c=C(hex),fold=o.fold||0;
        /* 一行的点：直行 K+1 个；错行 K+2 个（两端 + 中间 K 个半格点） */
        const line=(r,odd)=>{const q=[];
          if(!odd)for(let k=0;k<=K;k++)q.push(pt(r,k/K,mir));
          else{q.push(pt(r,0,mir));for(let k=0;k<K;k++)q.push(pt(r,(k+.5)/K,mir,k%2?0:fold));q.push(pt(r,1,mir));}
          return q;};
        for(let i=0;i<rows.length-1;i++){
          const a=rows[i],b=rows[i+1],da=a.a1-a.a0,db=b.a1-b.a0;
          if(Math.abs(da)<1e-5&&Math.abs(db)<1e-5)continue;
          const flip=(da+db<0)!==!!mir;
          if(!o.zig){
            const A=line(a,false),Bq=line(b,false);
            for(let k=0;k<K;k++){tri3(c,flip,A[k],Bq[k+1],A[k+1]);tri3(c,flip,A[k],Bq[k],Bq[k+1]);}
          }else if(i%2===0){   // 下直上错
            const Pp=line(a,false),Q=line(b,true);
            for(let k=0;k<K;k++)tri3(c,flip,Pp[k],Q[k+1],Pp[k+1]);
            for(let j=0;j<=K;j++)tri3(c,flip,Pp[j],Q[j],Q[j+1]);
          }else{               // 下错上直
            const Q=line(a,true),Pp=line(b,false);
            for(let j=0;j<=K;j++)tri3(c,flip,Q[j],Pp[j],Q[j+1]);
            for(let k=0;k<K;k++)tri3(c,flip,Q[k+1],Pp[k],Pp[k+1]);
          }
        }
        return this;
      },
      /* 朝下的封口（裤脚往里看是暗的，不是透的） */
      cap(r,hex,mir){
        const c=C(hex),N=16,O=[r.cx||0,r.y,r.cz||0,1],rr=Object.assign({},r,{a0:0,a1:Math.PI*2,s:1});
        for(let k=0;k<N;k++)tri3(c,!!mir,O,pt(rr,k/N,mir),pt(rr,(k+1)/N,mir));
        return this;
      },
      mesh(){
        const g=new T.BufferGeometry();
        g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("color",new T.Float32BufferAttribute(col,3));
        g.computeVertexNormals();return mesh(bake(g));
      }
    };
  }

  /* ---------- 身体截面表（1.98m 设计空间） ----------
     每行 [y, 宽, 厚 或 [前,后], cx, cz, b, s]。y 以各自关节为原点。
       b  这一圈有多少是肌腹（0 = 关节 / 骨点，1 = 肌肉最鼓的地方）。体格里的 muscle 只放大 b 的部分，所以调肌肉量不会把关节也撑粗
       s  明暗（默认 1）。肌肉之间的沟压暗一点，平直着色下就读成线条
     所有贴身件、球衣、短裤都从这张表取截面，所以它是唯一的"身材真相"。
     基准体型：1.98m / 96kg 的得分后卫 —— 肩宽（三角肌外缘 .56）、背阔到腰收窄（胸 .405 → 腰 .30）、
     臂展 2.10、大腿有股四头肌和膝上的内侧头、小腿肚位置高、脚踝细。 */
  const SPEC={
    pelvis:()=>[[-.13,.17,.16],[-.05,.365,[.11,.146]],[.03,.37,[.115,.14]],[.10,.342,[.113,.118]]],
    abdomen:()=>[[-.02,.335,[.113,.113]],[.06,.318,[.109,.105]],[.13,.336,[.113,.107]],[.19,.36,[.12,.11]]],
    /* 胸：胸肌最鼓在 .11~.16，上背 .11~.25 是一片平缓的面（不单独鼓一圈），往肩线逐圈收 */
    chest:()=>[[-.02,.358,[.119,.109]],[.05,.382,[.13,.115],0,0,.3],[.11,.408,[.141,.121],0,0,.5],[.16,.425,[.145,.125],0,0,.6],
               [.21,.434,[.136,.125],0,0,.3],[.245,.438,[.123,.122]],[.27,.438,[.108,.116]]],
    /* 斜方肌 → 脖子。底圈和胸腔上沿同尺寸（一个连续的面，肩关节就在它两端）；
       往上收到颈根（离地 1.705），真人照片里颈根只比下颌角低 5~6cm —— 再低脖子就显长。脖子宽 = 头宽的八成多（运动员的粗脖子） */
    neck:()=>[[.27,.438,[.108,.116]],[.30,.36,[.094,.108],0,0,.5],[.33,.268,[.082,.098],0,0,.5],[.355,.19,[.074,.088]],[.375,.148,[.07,.078],0,.004],[.44,.134,[.066,.064],0,.012]],
    /* 上臂：肘 → 肱三头肌腱 → 肱二 / 肱三肌腹 → 三角肌止点（沟）→ 三角肌 → 肩顶。
       肩顶是以肩关节为球心的半球（半径 6cm）：手臂怎么抬，肩头的轮廓都是圆的，不会翻出一个平的截面 */
    upperArm:sd=>[[-.345,.092,.096,0,0,0,.95],[-.29,.097,.107,0,-.004],[-.20,.121,.14,0,.006,.9],[-.135,.112,.127,0,.002,.3,.93],
                  [-.06,.134,.158,sd*.004,-.004,1],[0,.13,.146,0,-.004,.6],[.028,.112,.124,-sd*.005,-.004],[.047,.078,.086,-sd*.012,-.004],[.057,.034,.038,-sd*.018,-.004]],
    forearm:()=>[[-.29,.064,.05],[-.23,.07,.058],[-.13,.098,.09,0,0,.6],[-.06,.111,.105,0,.004,1],[0,.1,.103,0,0,0,.95],[.028,.09,.095]],
    /* 大腿：膝 → 膝上收窄 → 股内侧头 → 股四头肌腹 → 大腿根 */
    thigh:()=>[[-.475,.132,.138,0,.012],[-.435,.13,.136,0,.009],[-.36,.162,.175,0,.014,.7],[-.24,.197,.214,0,.012,1],[-.10,.212,.227,0,0,.6],[.03,.192,.203]],
    /* 小腿：踝 → 跟腱 → 比目鱼肌 → 腓肠肌（高位小腿肚，往后鼓）→ 膝下 */
    shin:()=>[[-.465,.076,.084],[-.40,.074,.086,0,-.004],[-.31,.094,.106,0,-.012,.4],[-.21,.124,.143,0,-.022,.8],[-.12,.138,.157,0,-.022,1],[-.045,.12,.129,0,-.004],[.03,.13,.137,0,.012]],
    /* 头：下巴 → 下颌角 → 嘴 → 颧 → 眼 → 眉弓 → 额 → 颅顶三圈（圆顶，剃光头也成立）。
       F = look.face：long 脸长（颧骨以上）、jawLen 下半张脸长、jaw 下颌宽、chin 下巴宽、cheek 颧宽 */
    head:F=>{
      F=F||{};const jw=F.jaw||1,ch=F.chin||1,ck=F.cheek||1,fy=y=>faceY(F,y);
      return [[-.034,.078*ch,[.04,.03],0,.044],[.016,.14*jw,[.088,.064],0,.014],[.06,.166*(jw*.5+.5),[.099,.084],0,.008],[.106,.19*ck,[.101,.102],0,.004],
              [.142,.19,[.092,.11]],[.168,.194,[.106,.113]],[.212,.188,[.098,.113],0,-.002],[.244,.168,[.078,.102],0,-.008],[.266,.13,[.052,.078],0,-.013],[.281,.07,[.026,.04],0,-.017]]
        .map(r=>{r[0]=fy(r[0]);return r;});
    }
  };
  /* 头部高度的统一换算：先整体压到 94.5%（头高 26cm），再按脸的参数拉长上半 / 下半张脸。头的截面和五官、发型都走它 */
  const HEAD_K=.945;
  const faceY=(F,y)=>{F=F||{};y*=HEAD_K;const a=.106*HEAD_K,b=.06*HEAD_K;return y>a?a+(y-a)*(F.long||1):(y<b?b+(y-b)*(F.jawLen||1):y);};
  const NSIDE={pelvis:10,abdomen:10,chest:10,neck:10,upperArm:10,forearm:10,thigh:10,shin:10,head:8};
  const NPOW={pelvis:2.45,abdomen:2.3,chest:2.3,neck:2.3,upperArm:2.2,forearm:2.2,thigh:2.25,shin:2.25,head:2.6};
  /* 体格参数 → 哪些部位。build.{shoulder,chest,waist,hip,arm,leg} 是各部位围度倍数，muscle 是肌肉量 */
  const GIRTH={pelvis:"hip",abdomen:"waist",chest:"chest",upperArm:"arm",forearm:"arm",thigh:"leg",shin:"leg"};
  const LIMB={upperArm:"arm",forearm:"arm",thigh:"leg",shin:"leg"};   // 骨长跟着 prop.arm / prop.leg 变的部位
  const lerpD=(a,b,t)=>{const A=Array.isArray(a)?a:[a/2,a/2],Bd=Array.isArray(b)?b:[b/2,b/2];return [A[0]+(Bd[0]-A[0])*t,A[1]+(Bd[1]-A[1])*t];};
  /* 从截面表里取 [y0,y1] 这一段（两端插值），整圈外扩 grow */
  function sub(rows,y0,y1,grow){
    grow=grow||0;y0=Math.max(y0,rows[0][0]);y1=Math.min(y1,rows[rows.length-1][0]);
    const at=y=>{
      let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
      const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1),d=lerpD(a[2],b[2],t);
      const L=(i,dv)=>{const p=a[i]==null?dv:a[i],q=b[i]==null?dv:b[i];return p+(q-p)*t;};
      return [y,a[1]+(b[1]-a[1])*t+grow*2,[d[0]+grow,d[1]+grow],L(3,0),L(4,0),L(5,0),L(6,1)];
    };
    const out=[at(y0)];
    for(const r of rows)if(r[0]>y0+1e-4&&r[0]<y1-1e-4)out.push(at(r[0]));
    out.push(at(y1));return out;
  }

  /* ---------- 号码 / 字样 ---------- */
  function numberTex(num,fill,stroke,word){
    const c=document.createElement("canvas");c.width=c.height=256;
    const g=c.getContext("2d");
    g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";
    const css=h=>"#"+h.toString(16).padStart(6,"0");
    if(word){
      g.font="italic 900 66px 'Arial Black',Impact,'Helvetica Neue',Arial,sans-serif";
      g.lineWidth=9;g.strokeStyle=css(stroke);g.strokeText(word,128,48);
      g.fillStyle=css(fill);g.fillText(word,128,48);
    }
    g.font="900 "+(word?138:200)+"px 'Arial Black',Impact,'Helvetica Neue',Arial,sans-serif";
    const y=word?170:136;
    g.lineWidth=16;g.strokeStyle=css(stroke);g.strokeText(String(num),128,y);
    g.fillStyle=css(fill);g.fillText(String(num),128,y);
    const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;
  }
  /* 小徽章：圆角盾 + 一个字母。aiBA 自己的标，不仿任何真实联盟 / 品牌 */
  function patchTex(bg,ink,ch){
    const c=document.createElement("canvas");c.width=c.height=64;const g=c.getContext("2d"),css=h=>"#"+h.toString(16).padStart(6,"0");
    g.fillStyle=css(bg);g.beginPath();g.moveTo(10,6);g.lineTo(54,6);g.lineTo(54,38);g.lineTo(32,60);g.lineTo(10,38);g.closePath();g.fill();
    g.lineWidth=3;g.strokeStyle="#f2efe6";g.stroke();
    g.fillStyle=css(ink);g.font="900 34px 'Arial Black',Impact,Arial,sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(ch,32,27);
    const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;
  }
  const zAtN=(r,x,n)=>r.df*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/(r.w/2),n)),1/n);
  function decal(tex,w,h){
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,transparent:true,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    m.receiveShadow=true;return m;
  }

  /* ---------- 球 ---------- */
  function makeBall(){
    const g=new T.Group();
    g.add(mesh(new T.IcosahedronGeometry(BALL_R,2),new T.MeshStandardMaterial({color:new T.Color(0xd8611c).convertSRGBToLinear(),flatShading:true,roughness:.62})));
    const seam=new T.MeshStandardMaterial({color:0x140c08,roughness:.8});
    for(const r of [[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]]){
      const t=new T.Mesh(new T.TorusGeometry(BALL_R*1.004,.0035,4,28),seam);t.rotation.set(r[0],r[1],r[2]);g.add(t);
    }
    return g;
  }

  /* =====================================================================
     注册表：每个款式是一个函数。ctx = {look, wrapHead(y0,y1,grow,color,opt), frontZ, box, mesh, loft, ring, tint, mul}
     返回 Object3D 或数组；挂到哪由槽位决定。新款式在这里注册，不改 build。
     ===================================================================== */
  /* 发际线：前额高、鬓角到耳上、后脑到后颈。头皮类发型共用，换发型发际线不跳 */
  /* rec = 前额发际线后移量：正中往上退 rec，两鬓退得更多（M 形） */
  const hairline=(x,z,rec)=>{
    if(z<0)return .15+Math.max(z,-.11)/.11*.055;
    const f=smooth(z/.09);
    return .15+(.068+rec)*f+rec*.9*f*smooth((Math.abs(x)-.035)/.04);
  };
  /* 发际线以下的顶点提到发际线上，同时贴回那个高度的头骨截面 —— 只提高度的话，眉弓那一圈（更宽更靠前）会在额头上伸出一圈帽檐 */
  const scalp=(ctx,grow,color,extra,rec)=>ctx.wrapHead(.09,.5,grow,color,{warp:(x,y,z)=>{
    const h=ctx.fy(hairline(x,z,rec||0));if(y<h){const q=ctx.snap(x,y,z,h,grow);x=q[0];z=q[1];y=h;}
    return extra?extra(x,y,z):[x,y,z];
  }});
  const HAIR={
    bald:()=>null,
    /* 剃光：贴头皮的一层青茬，颜色是肤色里掺发色，发际线高、两鬓后移 */
    shaved:()=>null,
    buzz:(ctx,o)=>scalp(ctx,.004,o.color),
    short:(ctx,o)=>scalp(ctx,.008,o.color),
    fade:(ctx,o)=>[scalp(ctx,.003,mul(o.color,1.5)),ctx.wrapHead(ctx.fy(.20),.5,.012,o.color)],
    flattop:(ctx,o)=>scalp(ctx,.008,o.color,(x,y,z)=>y>ctx.fy(.225)?[x*1.2,ctx.fy(.3),z*1.15-.004]:[x,y,z]),
    croppedCurls:(ctx,o)=>scalp(ctx,.011,o.color,(x,y,z)=>{const k=1+.05*Math.sin(x*90+y*70)*Math.cos(z*80);return [x*k,y,z*k];}),
    afro:(ctx,o)=>{const a=ctx.mesh(ctx.tint(new T.IcosahedronGeometry(.15,1),o.color));a.position.set(0,ctx.fy(.215),-.028);a.scale.set(1.04,.9,1);return [scalp(ctx,.004,o.color),a];},
    sidepart:(ctx,o)=>scalp(ctx,.013,o.color,(x,y,z)=>y>ctx.fy(.2)?[x+.012,y+.01,z+(z>0?.008:0)]:[x,y,z]),
    ponytail:(ctx,o)=>{
      const t=new T.Group();t.position.set(0,ctx.fy(.2),-.1);t.rotation.x=.45;
      t.add(ctx.mesh(ctx.loft([ring(6,2.4,-.2,.028,.028,{c:o.color}),ring(6,2.4,-.1,.05,.044),ring(6,2.4,0,.04,.04)])));
      return [scalp(ctx,.008,o.color),t];
    },
    bun:(ctx,o)=>{const b=ctx.mesh(ctx.tint(new T.IcosahedronGeometry(.05,1),o.color));b.position.set(0,ctx.fy(.215),-.112);return [scalp(ctx,.008,o.color),b];},
    cornrows:(ctx,o)=>{
      const out=[scalp(ctx,.003,o.color)];
      for(let i=-2;i<=2;i++){const b=ctx.box(.016,.012,.17,mul(o.color,1.8));b.position.set(i*.032,ctx.fy(.266)-i*i*.006,-.03);b.rotation.x=.2;out.push(b);}
      return out;
    }
  };
  /* 画在头皮上的发型：不建几何，身体那一层按这个强度把头皮的面染成"肤色掺发色" */
  const HAIR_PAINT={shaved:.3};
  /* 画在脸上的胡子：下巴 ~ 嘴这两段的正面和侧面染成"肤色掺胡色" */
  const BEARD_PAINT={stubble:.3};
  const BEARD={
    none:()=>null,
    goatee:(ctx,o)=>{
      const g=new T.Group();g.position.set(0,0,ctx.frontZ(0)-.012);
      g.add(ctx.mesh(ctx.loft([ring(6,2.6,-.045,.05,.03,{c:o.color}),ring(6,2.6,0,.078,.04),ring(6,2.6,.034,.058,.022)])));
      return g;
    },
    moustache:(ctx,o)=>{const b=ctx.box(.056,.012,.008,o.color);b.position.set(0,.066,ctx.frontZ(.066)+.002);return b;},
    /* 薄胡茬：上唇一线、下巴一小片，颜色淡。贴着脸，不鼓出来 */
    circle:(ctx,o)=>{
      const c=mix(ctx.look.body.skin,o.color,.5),out=[],y=ctx.fy;
      const m=ctx.box(.05,.005,.004,c);m.position.set(0,y(.064),ctx.frontZ(y(.066))+.001);out.push(m);
      const yc=y(-.004),g=new T.Group();g.position.set(0,yc,ctx.frontZ(yc)-.012);
      g.add(ctx.mesh(ctx.loft([ring(6,2.6,-.028,.04,.02,{c}),ring(6,2.6,0,.058,.027),ring(6,2.6,.026,.048,.018)])));
      out.push(g);return out;
    },
    /* 胡茬：下颌那一片是画的（见 BEARD_PAINT），这里只加上唇一线 */
    stubble:(ctx,o)=>{const m=ctx.box(.048,.005,.004,mix(ctx.look.body.skin,o.color,.42));m.position.set(0,ctx.fy(.066),ctx.frontZ(ctx.fy(.066))+.001);return m;},
    /* 络腮胡：下半张脸包一层（后脑那半圈缩进头里）+ 上唇 + 下巴往下的一团。len 越大留得越长 */
    full:(ctx,o)=>{
      const len=o.len||1,y=ctx.fy,out=[ctx.wrapHead(y(-.05),y(.04),.006,o.color,{warp:(x,yy,z)=>z<-.02?[x*.8,yy,z*.8]:[x,yy,z]})];
      const m=ctx.box(.056,.01,.007,o.color);m.position.set(0,y(.067),ctx.frontZ(y(.067))+.002);out.push(m);
      const yc=y(-.03),g=new T.Group(),d=.028+.04*len;g.position.set(0,yc,ctx.frontZ(yc)-.034);
      g.add(ctx.mesh(ctx.loft([ring(6,2.6,-d,.05+.016*len,.04+.01*len,{c:o.color}),ring(6,2.6,-d*.45,.086+.016*len,.062+.01*len),ring(6,2.6,.022,.1,.064)])));
      out.push(g);return out;
    }
  };
  const HEADGEAR={
    band:(ctx,o)=>ctx.wrapHead(ctx.fy(.176),ctx.fy(.208),.005,o.color==null?0xf1efe9:o.color)
  };
  /* 纹身图样：画在一张"白底 = 原肤色"的画布上，墨色乘在皮肤上。
     W 绕肢体一圈，H 沿长度（上 = 近心端）；cx 是肢体外侧在画布上的 x。图样是原创抽象纹，不复刻真人纹身 */
  const INK="rgba(34,28,24,.72)";
  const TATTOO={
    upper:(g,W,H,cx)=>{
      g.strokeStyle=INK;g.lineWidth=5;g.lineJoin="round";
      for(let i=0;i<5;i++){const y=H*.36+i*H*.085;g.beginPath();g.moveTo(cx-44,y);g.lineTo(cx-18,y+12);g.lineTo(cx+10,y-2);g.lineTo(cx+44,y+12);g.stroke();
        if(i%2===0){g.beginPath();g.arc(cx,y+8,15,0,Math.PI*1.6);g.stroke();}}
    },
    band:(g,W,H)=>{g.fillStyle=INK;g.fillRect(-W,H*.48,W*3,H*.045);g.fillRect(-W,H*.56,W*3,H*.02);
      for(let x=-W;x<W*2;x+=24){g.beginPath();g.moveTo(x,H*.60);g.lineTo(x+12,H*.66);g.lineTo(x+24,H*.60);g.closePath();g.fill();}},
    small:(g,W,H,cx)=>{g.strokeStyle=INK;g.lineWidth=5;g.beginPath();g.arc(cx,H*.4,16,0,Math.PI*1.7);g.moveTo(cx-18,H*.5);g.lineTo(cx,H*.56);g.lineTo(cx+18,H*.5);g.stroke();},
    dense:(g,W,H,cx)=>{
      g.strokeStyle=INK;g.lineWidth=4;g.lineJoin="round";
      for(let i=0;i<12;i++){const y=H*.08+i*H*.075;g.beginPath();for(let x=-W;x<=W*2;x+=32)g.lineTo(x,y+((x/32|0)%2?10:-4));g.stroke();
        if(i%3===0){g.beginPath();g.arc(cx,y+10,14,0,Math.PI*2);g.stroke();}}
    }
  };
  function tattooMat(art,sd,N){
    const W=256,H=256,c=document.createElement("canvas");c.width=W;c.height=H;
    const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,W,H);
    /* 外侧：左臂 +X（0°），右臂 -X（180°）。u = (角度 - 相位) / 360° */
    const ph=phaseOf(N)/(Math.PI*2);let u=((sd>0?0:.5)-ph)%1;if(u<0)u+=1;
    const fn=typeof art==="function"?art:TATTOO[art];
    if(fn)for(const off of [-W,0,W]){g.save();g.translate(off,0);fn(g,W,H,u*W);g.restore();}
    const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.wrapS=T.RepeatWrapping;
    const m=lift(MAT.clone());m.map=t;m.userData.own=true;return m;
  }

  /* 内置切面鞋：鞋底轮廓挤出 + 鞋面逐圈往后收；鞋头上翘、鞋领前低后高 */
  function facetShoe(sd,o){
    const base=[[.058,.02],[.062,.12],[.052,.20],[.025,.255],[-.02,.262],[-.05,.22],[-.058,.12],[-.05,0],[-.042,-.07],[-.015,-.095],[.02,-.095],[.048,-.06]];
    const tf=fn=>{let p=base.map(([x,z])=>fn(x,z));if(sd<0)p=p.map(([x,z])=>[-x,z]).reverse();return p;};
    const rings=[
      {y:0,   pts:tf((x,z)=>[x*.92,z>0?z*.97:z*.94]),c:o.outsole,s:1},
      {y:.012,pts:tf((x,z)=>[x,z]),c:o.sole,s:1},
      {y:.05, pts:tf((x,z)=>[x*.98,z*.985]),c:o.main,s:1},
      {y:.078,pts:tf((x,z)=>[x*.93,z>.1?.1+(z-.1)*.80:z*.97]),c:o.main,s:1},
      {y:.108,pts:tf((x,z)=>[x*.84,z>0?z*.52:z*.94]),c:o.main,s:1},
      {y:.142,pts:tf((x,z)=>[x*.76,z>0?z*.27:z*.88]),c:o.accent,s:1},
      {y:.182,pts:tf((x,z)=>[x*.70,z>0?z*.20:z*.80]),s:1}
    ];
    const m=mesh(loft(rings,{capT:0x0c0c0e,capB:o.outsole,face:(mx,mz,i)=>{
      if(i===2&&mz>.19)return o.sole;                            // 鞋头壳
      if(i===3&&mz>.02&&mz<.15&&Math.abs(mx)>.04)return o.accent; // 侧面色块
      if((i===3||i===4)&&mz<-.07)return o.accent;                 // 后跟提拉片
      return null;
    },warp:(x,y,z)=>{
      const low=Math.max(0,1-y/.11);
      if(z>.14)y+=(z-.14)*(z-.14)*2.2*low;
      if(z<-.05)y+=(-.05-z)*.28*low;
      if(y>.12)y+=-z*.32*Math.min(1,(y-.12)/.04);
      return [x,y,z];
    }}),MAT_GLOSS);
    m.scale.setScalar(SHOE_S);m.position.y=-B.ankle;return m;
  }
  const SHOES={
    facet:(sd,o)=>facetShoe(sd,Object.assign({main:0x1b1c20,accent:0xf2b632,sole:0xf3f1ea,outsole:0x2a2a2e},o)),
    /* 游戏里已验收的鞋款：品系 + 配色原样用，这里只做尺寸和落地对齐 */
    game:(sd,o)=>{
      if(!global.AIBAShoeStyles||!global.AIBARetroHigh)return null;
      const known=AIBAShoeStyles.families.includes(o.family);
      const shoe=known?AIBAShoeStyles.build(o.family,{colorway:o.colorway}):AIBARetroHigh.createBasketballShoe(o.colorway?{colorway:o.colorway}:{});
      const bx=new T.Box3().setFromObject(shoe),size=bx.getSize(V());
      shoe.scale.setScalar(.345/size.z);bx.setFromObject(shoe);
      shoe.position.set(-(bx.min.x+bx.max.x)/2,-B.ankle-bx.min.y,-bx.min.z-.098);
      shoe.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
      shoe.userData.foreign=true;   // 材质 / 几何归鞋模块管，换鞋时不替它 dispose
      return shoe;
    }
  };

  /* =====================================================================
     建人
     ===================================================================== */
  const LOOK24={
    id:"k24",
    /* h 身高、w 整体胖瘦；build 各部位围度和肌肉量；prop 骨架比例（臂长 / 腿长 / 肩宽 / 头大小） */
    body:{h:1,w:1,skin:0x94613f,
      build:{shoulder:1,chest:1,waist:1,hip:1,arm:1,leg:1,muscle:1},
      prop:{arm:1,leg:1,shoulder:1,head:1}},
    /* 脸：long 脸长、jawLen 下半脸长、jaw 下颌宽、chin 下巴宽、cheek 颧宽、nose 鼻宽、lips 唇厚、brow 眉内端压低的角度、ear 耳朵大小 */
    face:{long:1.03,jawLen:1.05,jaw:1.04,chin:1.08,cheek:1,nose:1.2,lips:1.2,brow:.11,ear:1},
    kit:{jersey:0x111111,trim:0xf1c641,shorts:0x111111,num:24,word:"aiBA",hem:-.42},
    hair:{style:"shaved",color:0x201812},
    beard:{style:"circle",color:0x201812},
    socks:{h:.19,color:0xf0eee7,stripe:0x111111,stripes:1},
    shoes:{style:"facet",main:0x1b1c20,accent:0xf1c641,sole:0xf3f1ea,outsole:0x2a2a2e},
    gear:{head:null,sleeve:null,wrist:null,knee:null,compression:null},
    tattoo:{upperArmR:"upper"}
  };
  const clone=o=>JSON.parse(JSON.stringify(o));

  function build(lookIn){
    const look=clone(LOOK24);
    for(const k in (lookIn||{}))look[k]=lookIn[k]&&typeof lookIn[k]==="object"&&!Array.isArray(lookIn[k])?Object.assign({},look[k],lookIn[k]):lookIn[k];
    const root=new T.Group(),rig=new T.Group();root.add(rig);
    const j={};
    const grp=(p,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};

    /* ---- 骨架：只有关节 ---- */
    j.hips=grp(rig,0,B.hipY,0);j.spine=grp(j.hips,0,B.spine,0);j.chest=grp(j.spine,0,B.chest,0);j.head=grp(j.chest,0,B.neck,.012);   // 头略微前探，下巴压在脖子前面
    const headRoot=new T.Group();headRoot.scale.set(HEAD_S,HEAD_S,HEAD_S*HEAD_SZ);j.head.add(headRoot);   // 头部挂点（发型 / 胡子 / 头饰）
    j.feet=[];
    for(const [k,sd] of [["L",1],["R",-1]]){
      j["sh"+k]=grp(j.chest,sd*B.shX,B.shY,0);j["el"+k]=grp(j["sh"+k],0,-B.upArm,0);j["wr"+k]=grp(j["el"+k],0,-B.foreArm,0);
      j["leg"+k]=grp(j.hips,sd*B.hipX,0,0);j["kn"+k]=grp(j["leg"+k],0,-B.thigh,0);j["an"+k]=grp(j["kn"+k],0,-B.shin,0);
      j.feet.push(grp(j["an"+k],0,-B.ankle,-.095*SHOE_S),grp(j["an"+k],0,-B.ankle,.262*SHOE_S));
    }
    /* 骨架比例（look.body.prop）→ 关节位置。Bk 是这个人自己的骨长表，皮套重定向时读它 */
    let Bk=B;
    function layout(){
      const p=look.body.prop||{},a=p.arm||1,l=p.leg||1;
      Bk=Object.assign({},B,{upArm:B.upArm*a,foreArm:B.foreArm*a,thigh:B.thigh*l,shin:B.shin*l,shX:B.shX*(p.shoulder||1)});
      Bk.hipY=Bk.thigh+Bk.shin+Bk.ankle;
      j.hips.position.set(0,Bk.hipY,0);
      const hs=HEAD_S*(p.head||1);headRoot.scale.set(hs,hs,hs*HEAD_SZ);
      for(const [k,sd] of [["L",1],["R",-1]]){
        j["sh"+k].position.set(sd*Bk.shX,Bk.shY,0);j["el"+k].position.set(0,-Bk.upArm,0);j["wr"+k].position.set(0,-Bk.foreArm,0);
        j["kn"+k].position.set(0,-Bk.thigh,0);j["an"+k].position.set(0,-Bk.shin,0);
      }
    }
    /* 身体部位 → 挂在哪个关节、左右号。贴身件按这个名字找 */
    const PART={pelvis:[j.hips,0],abdomen:[j.spine,0],chest:[j.chest,0],neck:[j.chest,0]};
    for(const [k,sd] of [["L",1],["R",-1]]){PART["upperArm"+k]=[j["sh"+k],sd];PART["forearm"+k]=[j["el"+k],sd];PART["thigh"+k]=[j["leg"+k],sd];PART["shin"+k]=[j["kn"+k],sd];}
    const baseOf=name=>SPEC[name]?name:name.slice(0,-1);
    const lenOf=base=>{const p=look.body.prop||{};return LIMB[base]?(p[LIMB[base]]||1):1;};
    const ly=(base,y)=>y<0?y*lenOf(base):y;   // 肢体骨长变了，截面的 y 跟着拉（关节以上那一小截不拉）
    const rowsOf=name=>{const base=baseOf(name);return SPEC[base](PART[name]?PART[name][1]:0).map(r=>{r=r.slice();r[0]=ly(base,r[0]);return r;});};
    /* 截面表的一行 → 按体格缩放后的真实尺寸。胖瘦 w 和各部位围度乘宽厚；muscle 只放大肌腹（r[5]）；
       肩宽只加宽胸上半截和斜方肌的"宽"，不加厚。头不跟体格变 */
    const dims=(r,base,headPart)=>{
      const bd=look.body.build||{},pr=look.body.prop||{};
      const gOf=n=>bd[n]||1,mixG=(a,b,t)=>gOf(a)+(gOf(b)-gOf(a))*clamp(t,0,1);
      const g=base==="pelvis"?mixG("hip","waist",(r[0]-.03)/.07):base==="abdomen"?mixG("waist","chest",(r[0]-.06)/.13)
        :base==="neck"?mixG("chest","neck",(r[0]-.30)/.055):GIRTH[base]?gOf(GIRTH[base]):1;
      const k=headPart?1:(look.body.w||1)*g*(1+((bd.muscle||1)-1)*(r[5]||0));
      let kw=k;if(!headPart&&((base==="chest"&&r[0]>=.17)||(base==="neck"&&r[0]<.32)))kw*=(bd.shoulder||1)*(pr.shoulder||1);
      const d=Array.isArray(r[2])?r[2]:[r[2]/2,r[2]/2];
      return {y:r[0],w:r[1]*kw,df:d[0]*k,db:d[1]*k,cx:r[3]||0,cz:r[4]||0,s:r[6]==null?1:r[6]};
    };
    const toRings=(rows,base,color,headPart)=>rows.map((r,i)=>{const d=dims(r,base,headPart);
      return ring(NSIDE[base],NPOW[base],d.y,d.w,[d.df,d.db],{cx:d.cx,cz:d.cz,s:d.s,c:i?undefined:color});});
    /* 身体在某个部位、某个高度的真实截面尺寸（球衣短裤按它留松量） */
    const bodyAt=(name,y)=>{const base=baseOf(name),yy=ly(base,y);return dims(sub(rowsOf(name),yy,yy,0)[0],base);};
    /* 贴身件：从身体部位的截面里取一段往外扩 */
    function wrap(name,y0,y1,grow,color,opt){
      const base=baseOf(name);
      return mesh(loft(toRings(sub(rowsOf(name),ly(base,y0),ly(base,y1),grow),base,color),opt));
    }
    let headRows,headRings;
    const fy=y=>faceY(look.face,y);   // 五官 / 发型在头上的高度
    function headSetup(){headRows=SPEC.head(look.face);headRings=toRings(headRows,"head",0,true);}
    headSetup();
    const frontZ=y=>{   // 正脸那个面在高度 y 处的 z（头部局部）
      for(let i=0;i<headRings.length-1;i++)if(y<=headRings[i+1].y){const t=clamp((y-headRings[i].y)/(headRings[i+1].y-headRings[i].y),0,1);return headRings[i].pts[1][1]+(headRings[i+1].pts[1][1]-headRings[i].pts[1][1])*t;}
      return headRings[headRings.length-1].pts[1][1];
    };
    /* 头骨在高度 y 的截面尺寸；snap 把 (x,z) 从高度 y0 的截面换算到高度 y1 的截面上（都带外扩 g） */
    const headAt=y=>{let i=0;while(i<headRows.length-2&&y>headRows[i+1][0])i++;const a=headRows[i],b=headRows[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1),d=lerpD(a[2],b[2],t);
      return {w:a[1]+(b[1]-a[1])*t,df:d[0],db:d[1],cz:(a[4]||0)+((b[4]||0)-(a[4]||0))*t};};
    const snap=(x,y0,z,y1,g)=>{const a=headAt(y0),b=headAt(y1),dz=z-a.cz;
      return [x*(b.w+g*2)/(a.w+g*2),b.cz+dz*(dz>0?(b.df+g)/(a.df+g):(b.db+g)/(a.db+g))];};
    const ctx={look,ring,loft,mesh,box,tint,mul,mix,frontZ,fy,snap,
      wrapHead:(y0,y1,grow,color,opt)=>mesh(loft(toRings(sub(headRows,y0,y1,grow),"head",color,true),opt))};

    /* ---- 槽位：每个槽位记下自己挂出去的东西，换的时候只拆自己的 ---- */
    const slots={};
    const drop=o=>{o.traverse(m=>{if(!m.isMesh)return;m.geometry.dispose();const mt=m.material;if(mt&&mt!==MAT&&mt!==MAT_GLOSS){if(mt.map)mt.map.dispose();mt.dispose();}});};
    function clear(name){for(const o of slots[name]||[]){if(o.parent)o.parent.remove(o);if(!o.userData.foreign)drop(o);}slots[name]=[];}
    function put(name,parent,obj){if(!obj)return null;for(const o of Array.isArray(obj)?obj:[obj])if(o){parent.add(o);slots[name].push(o);}return obj;}
    const sides=s=>s==="LR"?["L","R"]:s==="L"||s==="R"?[s]:[];

    const SLOT={
      /* 身体：完整皮肤（躯干也有，所以以后做无袖 / 露腰 / 赤膊都不用改身体）。纹身 = 换那一段的材质 */
      body(){
        const sk=look.body.skin,tat=look.tattoo||{};
        for(const name in PART){
          const [joint,sd]=PART[name],base=baseOf(name);
          const mat=tat[name]?tattooMat(tat[name],sd||1,NSIDE[base]):MAT;
          put("body",joint,mesh(loft(toRings(rowsOf(name),base,sk)),mat));
        }
        /* 头 + 五官 */
        /* 头皮上色（剃光的青茬）。头的截面自下而上：0 下巴 1 下颌 2 嘴 3 颧 4 眼 5 眉 6 额 7~9 颅顶。
           额头以上全染；眉 ~ 额这一段只染侧面和后面（正面三个面是额头，两鬓自然后移）；再往下只染后脑 */
        const hp=HAIR_PAINT[look.hair&&look.hair.style]||0,hc=hp?mix(sk,look.hair.color==null?0x201812:look.hair.color,hp):sk;
        const bd0=look.beard||{},bp=BEARD_PAINT[bd0.style]||0,bc=bp?mix(sk,bd0.color==null?0x201812:bd0.color,bp):sk;
        put("body",headRoot,mesh(loft(toRings(headRows,"head",sk,true),{capT:hc,capB:bc,face:(mx,mz,i)=>
          hp&&(i>=6||((i===5||i===4)&&mz<.03)||(i===3&&mz<-.03)||(i===2&&mz<-.06))?hc:(bp&&i<=1&&mz>-.03?bc:null)})));
        const F=look.face||{},dark=0x1a110c,browC=look.hair&&look.hair.color!=null?look.hair.color:0x201812;
        const nz=F.nose||1,lp=F.lips||1,bt=F.brow==null?.08:F.brow,er=F.ear||1,yE=fy(.146),yB=fy(.168);
        for(const sd of [1,-1]){
          const eye=box(.028,.01,.006,0xd9d1c4);eye.position.set(sd*.034,yE,frontZ(yE));
          const pup=box(.012,.01,.008,dark);pup.position.set(sd*.031,yE,frontZ(yE)+.001);
          /* 眉：内端低、外端高（bt 是角度）。反过来就是八字愁眉 */
          const brow=box(.042,.009,.008,browC);brow.position.set(sd*.034,yB-.002,frontZ(yB)-.001);brow.rotation.z=sd*bt;
          const ear=box(.02*er,.054*er,.03*er,mul(sk,.93));ear.position.set(sd*(.095+.007*er),fy(.128),-.012);ear.rotation.y=-sd*.25;
          put("body",headRoot,[eye,pup,brow,ear]);
        }
        /* 嘴：唇线 + 上唇 + 下唇（lips 越大越厚） */
        const yM=fy(.052);
        const line=box(.056*(.85+.15*lp),.004,.006,mul(sk,.5));line.position.set(0,yM,frontZ(yM)+.001);
        const upLip=box(.05*(.85+.15*lp),.005*lp,.006,mul(sk,.8));upLip.position.set(0,yM+.0025+.0025*lp,frontZ(yM+.005)+.0006);
        const lowLip=box(.045*(.8+.2*lp),.008*lp,.007,mix(mul(sk,.88),0x8a3f3a,.28));lowLip.position.set(0,yM-.0025-.004*lp,frontZ(yM-.008)+.0006);
        put("body",headRoot,[line,upLip,lowLip]);
        /* 鼻：鼻梁到鼻尖一个棱锥，nose 越大鼻翼越宽 */
        const yn0=fy(.088),yn1=fy(.164),nw=.025*nz,tw=nw*.42,zb=frontZ(yn0)-.003,z1=frontZ(yn1)-.004,zt=zb+.024+.003*nz,yt=yn0+.005;
        const br=[0,yn1,z1],tL=[-tw,yt,zt],tR=[tw,yt,zt],nl=[-nw,yn0,zb],nr=[nw,yn0,zb],bs=[0,yn0-.002,zb+.004];
        put("body",headRoot,tri([br,tL,tR, br,tR,nr, br,nl,tL, tR,bs,nr, tL,nl,bs, tL,bs,tR],mul(sk,.96)));
        /* 手：掌 + 四根两节手指 + 两节拇指，往掌心弯、微微张开 */
        for(const [k,sd] of [["L",1],["R",-1]]){
          const hand=new T.Group();
          const rh=(y,w,d,o)=>ring(6,4,y,w,d,o),rf=(y,w,d)=>ring(4,5,y,w,d,{c:sk});
          hand.add(mesh(loft([rh(-.10,.096,.028,{cz:-.003,c:sk}),rh(-.04,.092,.036),rh(0,.06,.04)])));
          const digit=(x,y,z,len,w,rx,rz,curl)=>{
            const a=new T.Group();a.position.set(x,y,z);a.rotation.set(rx,0,rz);hand.add(a);
            a.add(mesh(loft([rf(-len*.55,w*.92,w*.9),rf(.004,w,w)])));
            const b=new T.Group();b.position.y=-len*.55;b.rotation.x=curl;a.add(b);
            b.add(mesh(loft([rf(-len*.45,w*.78,w*.74),rf(.003,w*.92,w*.9)])));
          };
          [.092,.102,.094,.076].forEach((len,i)=>{const x=-sd*(.0355-i*.0237);digit(x,-.097,-.003,len,.0235,.16,x*3.6,.34);});
          digit(-sd*.047,-.03,-.008,.078,.03,.32,-sd*.72,.3);
          hand.scale.setScalar(1.12);
          put("body",j["wr"+k],hand);
        }
      },
      /* 球衣 + 短裤。
         球衣上半是四片开口壳（前左 / 前右 / 后左 / 后右），每片 = 身体截面外扩后的超椭圆上的一段弧：
           靠中线那一头被领口曲线切掉（前 V 领、后圆领），靠侧面那一头被袖窿曲线切掉；
           切口上各贴一条镶边；腋下到下摆是一块侧片，侧片和大身之间一条滚边。布料下面就是完整的身体，领口和袖窿里露出来的是真的皮肤。
         下半（腰关节上）垂到腰头外面。短裤 = 裙筒（胯上）+ 两条 A 字裤管，外侧同样是侧片 + 滚边，腰头和裤脚一圈点缀色。
         大身的布都是错行缝的三角折面（zig），带一点褶。 */
      kit(){
        const K=look.kit,m=look.body.w||1,J=K.jersey,TR=K.trim,SH=K.shorts==null?J:K.shorts;
        const PANEL=K.panel===undefined?TR:K.panel;                                 // 侧片颜色，null = 不要侧片
        const PIPE=K.pipe===undefined?(lum(J)>.72?mul(TR,.55):0xf2efe6):K.pipe;     // 滚边
        const AC=SH===TR?(J===SH?mul(SH,.72):J):TR;   // 短裤上的点缀色（腰头 / 裤脚）：短裤本身就是镶边色时改用球衣色
        const SP=PANEL==null?null:(SH===PANEL?AC:PANEL);
        const n=NPOW.chest,H=Math.PI/2,TOPY=.27,CL={zig:true,fold:.012};
        const lin=(Tb,y)=>{if(y<=Tb[0][0])return Tb[0][1];for(let i=1;i<Tb.length;i++)if(y<=Tb[i][0]){const a=Tb[i-1],b=Tb[i];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);}return Tb[Tb.length-1][1];};
        /* 胸关节坐标里高度 y 的球衣截面：身体 + 松量（下摆 2cm，往肩上收到 0.9cm） */
        const row=y=>{const d=y>=TOPY?bodyAt("neck",y):bodyAt("chest",Math.max(y,-.02)),t=clamp((y+.03)/.24,0,1),gw=.02-.011*t,gd=.02-.012*t;
          return {y,w:d.w+gw*2,df:d.df+gd,db:d.db+gd};};
        const ang=(r,x)=>Math.acos(Math.pow(clamp(x/(r.w/2),0,1),n/2));   // 截面上横坐标 x 对应的角度（0 = 正侧面，π/2 = 正中线）
        const zAt=(r,x)=>r.df*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/(r.w/2),n)),1/n);   // 截面正面在横坐标 x 处的 z
        /* 领口：正面看是一条从胸口正中（apex）往上、往外走到肩顶（YT）的曲线。p=1 直边 V，越小底越圆 */
        const YT=.338,XT=row(YT).w/2,apexF=.296-(K.vneck==null?.06:K.vneck),apexB=.31,dF=.018,dB=.013;
        const cut=(y,apex,p)=>y<=apex?0:XT*Math.pow(clamp((y-apex)/(YT-apex),0,1),p);
        /* 袖窿：截面半宽的百分之多少以外被挖掉。腋下 5cm 起，胸前最深，过肩顶合上 */
        const AH0=.125,tA=.014,dA=.085,dS=PANEL==null?0:.56,dP=PANEL==null?0:.045;
        const AHT=[[AH0,1],[.16,.95],[.20,.83],[.245,.75],[.27,.765],[.295,.91],[.31,1]];
        const aA=y=>Math.acos(Math.pow(lin(AHT,y),n/2));
        const aO=y=>y<AH0-tA||y>=.31?0:Math.max(aA(y),aA(y+tA*.9))+dA*smooth((y-(AH0-tA))/tA)*(1-smooth((y-.298)/.012));
        const ys=[-.03,.04,AH0-tA,AH0,.16,.20,apexF-dF,apexF,.245,.27,.285,apexB-dB,.298,apexB,.324,.332,YT]
          .filter(y=>y<=YT).sort((a,b)=>a-b).filter((y,i,a)=>!i||y-a[i-1]>.0035);
        const up=shell(n);
        for(const mir of [false,true])for(const fb of [1,-1]){
          const apex=fb>0?apexF:apexB,d=fb>0?dF:dB,p=fb>0?.92:.6;
          const seg=fn=>ys.map(y=>{const r=row(y),a=fn(r,y);r.a0=fb*a[0];r.a1=fb*a[1];return r;});
          const pan=y=>Math.max(aO(y),y<AH0?dS:0),side=y=>Math.max(aO(y),y<AH0?dS+dP:0);
          const nI=(r,y)=>Math.max(ang(r,cut(y,apex,p)),aO(y)),nO=(r,y)=>Math.max(ang(r,cut(y+d,apex,p)),side(y));
          up.add(seg((r,y)=>[nO(r,y),side(y)]),3,J,mir,CL);             // 大身
          up.add(seg((r,y)=>[nI(r,y),nO(r,y)]),1,TR,mir);               // 领口镶边
          up.add(seg((r,y)=>[aO(y),aA(y)]),1,TR,mir);                   // 袖窿镶边
          if(dS){up.add(seg((r,y)=>[side(y),pan(y)]),1,PIPE,mir);up.add(seg((r,y)=>[pan(y),aO(y)]),2,PANEL,mir);}   // 滚边 + 侧片
        }
        put("kit",j.chest,up.mesh());
        /* 球衣下半：从胸口垂到腰头外面（腰头在髋关节上方 0~6cm），腰上几乎不收 */
        const c0=bodyAt("chest",-.02),W0=c0.w+.04,F0=c0.df+.02,B0=c0.db+.02;
        const wb=bodyAt("pelvis",.06),wbK=y=>clamp((.06-y)/.11,0,1);   // 下摆要罩在腰头外面：越往下越不能比腰头小
        const hang=y=>{const d=bodyAt("abdomen",y),t=.15*clamp((.19-y)/.12,0,1),half=(fit,h)=>fit>=h?fit:h+(fit-h)*t,k=wbK(y);
          return {y,w:Math.max(half(d.w+.03,W0),(wb.w+.064)*k),df:Math.max(half(d.df+.016,F0),(wb.df+.032)*k),db:Math.max(half(d.db+.016,B0),(wb.db+.032)*k),s:y<0?.9:1};};
        const low=shell(NPOW.abdomen),hy=[-.056,.025,.11,.19];
        for(const mir of [false,true])for(const fb of [1,-1]){
          const P=(a0,a1)=>hy.map(y=>Object.assign(hang(y),{a0:fb*a0,a1:fb*a1}));
          low.add(P(H,dS+dP),3,J,mir,CL);
          if(dS){low.add(P(dS+dP,dS),1,PIPE,mir);low.add(P(dS,0),2,PANEL,mir);}
        }
        put("kit",j.spine,low.mesh());
        /* 裤管：A 字，裤脚比大腿宽出一大圈；hem 是裤脚离髋关节的高度（-.36 膝上一掌，-.42 到膝盖上沿） */
        const hem=K.hem==null?-.36:K.hem,lk=lenOf("thigh"),aL=SP==null?0:.85,aP=SP==null?0:.07;
        let reach=0,front=0,back=0;
        for(const [k,sd] of [["L",1],["R",-1]]){
          const tr=y=>{const f=clamp((-.02-y)/(-.02-hem),0,1),w0=.214+.05*f,gw=.022+.014*f,d=bodyAt("thigh"+k,y),w=Math.max(d.w+gw*2,w0*m),dd=Math.max(d.df+d.db+gw*2,(w0+.012)*m);
            return {y:y*lk,w,df:dd/2,db:dd/2,cx:sd*.02,cz:.004,s:.92+.08*f};};
          const h2=hem+.022,rows=[hem,h2,h2+(-.02-h2)*.3,h2+(-.02-h2)*.62,-.02].map(tr),sh=shell(2.5),mir=sd<0;
          const P=(rs,a0,a1)=>rs.map(r=>Object.assign({},r,{a0,a1}));
          sh.add(P(rows.slice(0,2),-Math.PI,Math.PI),12,AC,mir);    // 裤脚一圈
          const rs=rows.slice(1);
          sh.add(P(rs,aL+aP,Math.PI),3,SH,mir,{zig:true,fold:.025}).add(P(rs,-aL-aP,-Math.PI),3,SH,mir,{zig:true,fold:.025});
          if(aL){sh.add(P(rs,aL+aP,aL),1,PIPE,mir).add(P(rs,-aL-aP,-aL),1,PIPE,mir).add(P(rs,-aL,aL),2,SP,mir);}
          sh.cap(rows[0],0x0b0b0d,mir);
          put("kit",j["leg"+k],sh.mesh());
          const top=rows[rows.length-1];reach=Math.max(reach,B.hipX+.02+top.w/2);front=Math.max(front,top.df+.004);back=Math.max(back,top.db-.004);
          if(sd>0){   // 左裤腿上的小徽章
            const r=rows[1],em=decal(patchTex(SP==null?TR:SP,SH,"A"),.05,.05);em.position.set(r.cx-.028,r.y+.055,r.cz+zAtN(r,-.028,2.5)+.004);put("kit",j["leg"+k],em);
          }
        }
        /* 裙筒：腰头 → 裆，整圈比两条裤管都大 */
        const pv=y=>bodyAt("pelvis",y),p0=pv(-.05),W=Math.max(p0.w+.04,reach*2+.012),DF=Math.max(p0.df+.018,front+.006),DB=Math.max(p0.db+.016,back+.006);
        const w1=pv(0),w2=pv(.06),R4=(y,w,df,db,s)=>({y,w,df,db,s});
        const skR=[R4(-.15,W,DF,DB,.9),R4(-.07,W,DF,DB,.96),R4(-.006,w1.w+.04,w1.df+.022,w1.db+.022,1)];
        const wbR=[R4(-.006,w1.w+.04,w1.df+.022,w1.db+.022,1),R4(.004,w1.w+.046,w1.df+.025,w1.db+.025,1),R4(.06,w2.w+.046,w2.df+.023,w2.db+.023,1)];
        const skirt=shell(NPOW.pelvis),qS=SP==null?0:.56,qP=SP==null?0:.045;
        for(const mir of [false,true])for(const fb of [1,-1]){
          const P=(rs,a0,a1)=>rs.map(r=>Object.assign({},r,{a0:fb*a0,a1:fb*a1}));
          skirt.add(P(skR,H,qS+qP),3,SH,mir,{zig:true,fold:.01});
          if(qS){skirt.add(P(skR,qS+qP,qS),1,PIPE,mir);skirt.add(P(skR,qS,0),2,SP,mir);}
          skirt.add(P(wbR,H,0),5,AC,mir);
        }
        skirt.cap(Object.assign({},skR[0]),mul(SH,.55),false);
        put("kit",j.hips,skirt.mesh());
        /* 号码、字标、胸口小徽章 */
        const fill=K.numColor!=null?K.numColor:(lum(J)<.45?0xf2efe6:0x17181c),stroke=K.numStroke!=null?K.numStroke:TR;
        const nf=decal(numberTex(K.num,fill,stroke,K.word),.17*m,.17*m);
        nf.position.set(0,.1,Math.max(row(.03).df,row(.1).df,row(.17).df)+.004);put("kit",j.chest,nf);
        const nb=decal(numberTex(K.num,fill,stroke,null),.22*m,.22*m);nb.position.set(0,.12,-Math.max(row(.02).db,row(.12).db,row(.22).db)-.004);nb.rotation.y=Math.PI;put("kit",j.chest,nb);
        const pr=row(.222),px=.082*m,badge=decal(patchTex(TR,J,"A"),.03,.03);badge.position.set(px,.222,zAt(pr,px)+.005);badge.rotation.y=.42;put("kit",j.chest,badge);
      },
      socks(){
        const s=look.socks;if(!s||!(s.h>0))return;
        for(const k of ["L","R"]){
          /* s.h = 袜口离踝关节的高度（.19 ≈ 小腿中段的中筒袜；鞋领会盖住下面 8cm 左右） */
          put("socks",j["kn"+k],wrap("shin"+k,-.465,-.465+s.h,.005,s.color));
          for(let i=0;i<(s.stripe!=null?(s.stripes||1):0);i++){const y=-.465+s.h-.022-i*.02;put("socks",j["kn"+k],wrap("shin"+k,y-.006,y+.006,.0065,s.stripe));}
        }
      },
      shoes(){
        const s=look.shoes||{style:"facet"};
        for(const [k,sd] of [["L",1],["R",-1]]){
          let o=null;try{o=(SHOES[s.style]||SHOES.facet)(sd,s);}catch(e){console.warn("[facet] shoes",e);}
          put("shoes",j["an"+k],o||SHOES.facet(sd,{}));
        }
      },
      hair(){const h=look.hair||{};put("hair",headRoot,(HAIR[h.style]||HAIR.buzz)(ctx,{color:h.color==null?0x201812:h.color}));},
      beard(){const b=look.beard||{};put("beard",headRoot,(BEARD[b.style]||BEARD.none)(ctx,{color:b.color==null?(look.hair&&look.hair.color)||0x201812:b.color,len:b.len}));},
      "gear.head"(){const g=look.gear.head;if(g)put("gear.head",headRoot,(HEADGEAR[g.kind||"band"]||HEADGEAR.band)(ctx,g));},
      /* 护臂：上臂中段到手腕。kind:"elbow" 只包肘 */
      "gear.sleeve"(){
        const g=look.gear.sleeve;if(!g)return;
        for(const k of sides(g.side)){
          const elbow=g.kind==="elbow";
          put("gear.sleeve",j["sh"+k],wrap("upperArm"+k,-.345,elbow?-.26:-.15,.004,g.color));
          put("gear.sleeve",j["el"+k],wrap("forearm"+k,elbow?-.09:-.266,.028,.004,g.color));
        }
      },
      "gear.wrist"(){const g=look.gear.wrist;if(g)for(const k of sides(g.side))put("gear.wrist",j["el"+k],wrap("forearm"+k,-.28,-.228,.008,g.color));},
      /* 护膝：kind "pad" 短护膝 / "sleeve" 长腿套（大腿中段到小腿中段） */
      "gear.knee"(){
        const g=look.gear.knee;if(!g)return;
        for(const k of sides(g.side)){
          const long=g.kind==="sleeve";
          put("gear.knee",j["leg"+k],wrap("thigh"+k,-.475,long?-.30:-.40,.006,g.color));
          put("gear.knee",j["kn"+k],wrap("shin"+k,long?-.25:-.085,.03,.006,g.color));
        }
      },
      /* 压缩内搭：球衣下面露出来的短袖 */
      "gear.compression"(){const g=look.gear.compression;if(g)for(const k of ["L","R"])put("gear.compression",j["sh"+k],wrap("upperArm"+k,-.14,.057,.004,g.color));}
    };
    const ORDER=["body","kit","socks","shoes","hair","beard","gear.head","gear.sleeve","gear.wrist","gear.knee","gear.compression"];
    function rebuild(name){
      if(!name){layout();headSetup();ORDER.forEach(rebuild);rig.scale.setScalar(look.body.h||1);return;}
      clear(name);SLOT[name]();
    }
    /* 换装。path = 槽位名（"hair" / "kit" / "gear.sleeve" / "tattoo" / "body"…）；value 合并进去，null = 卸下。
       tattoo 是整张表替换（{部位: 图样}）。body / face 会整个人重建（比例、截面、五官都跟着变）。 */
    function set(path,value){
      const [a,b]=path.split(".");
      if(path==="tattoo")look.tattoo=value||{};
      else{
        const cur=b?look[a][b]:look[a],next=value==null?null:Object.assign({},cur||{},value);
        if(b)look[a][b]=next;else look[a]=next;
      }
      if(path==="body"||path==="face"){rebuild();if(last)apply(last);}
      else if(path==="tattoo")rebuild("body");
      else if(path==="hair"){rebuild("hair");rebuild("body");rebuild("beard");}   // 眉毛、胡子默认跟发色
      else if(path==="beard"){rebuild("beard");rebuild("body");}                  // 胡茬是画在脸上的
      else rebuild(path);
      return api;
    }

    const ball=makeBall();rig.add(ball);

    /* ---------- 姿势求解 ---------- */
    const qP=new T.Quaternion(),qW=new T.Quaternion(),mB=new T.Matrix4(),vx=V(),vy=V(),vz=V(),tmp=V();
    /* 让 obj 的 -Y 指向 down、-Z 尽量指向 back（世界方向）；parentQ 是父节点世界朝向 */
    function aim(obj,down,back,parentQ){
      vy.copy(down).normalize().negate();
      vz.copy(back).addScaledVector(vy,-back.dot(vy));
      if(vz.lengthSq()<1e-8)vz.set(0,0,1).addScaledVector(vy,-vy.z);
      vz.normalize().negate();
      vx.crossVectors(vy,vz);
      qW.setFromRotationMatrix(mB.makeBasis(vx,vy,vz));
      obj.quaternion.copy(qP.copy(parentQ).invert()).multiply(qW);
      return qW.clone();
    }
    function solveArm(k,A){
      const sh=j["sh"+k],el=j["el"+k],wr=j["wr"+k],sc=rig.scale.x;
      const cq=j.chest.getWorldQuaternion(new T.Quaternion());
      const W=j.chest.localToWorld(V(A.w[0],A.w[1],A.w[2]));
      const dir=l=>V(l[0],l[1],l[2]).normalize().applyQuaternion(cq);
      const pole=dir(A.pole),f=dir(A.f),p=dir(A.p);
      const Sp=sh.getWorldPosition(V()),a=Bk.upArm*sc,b=Bk.foreArm*sc;
      const to=W.clone().sub(Sp);let d=to.length();to.normalize();
      d=clamp(d,Math.abs(a-b)+.004,a+b-.004);
      const cosA=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),sinA=Math.sqrt(1-cosA*cosA);
      const perp=pole.clone().addScaledVector(to,-pole.dot(to));
      if(perp.lengthSq()<1e-8)perp.set(0,0,-1).addScaledVector(to,to.z);
      perp.normalize();
      const E=Sp.clone().addScaledVector(to,a*cosA).addScaledVector(perp,a*sinA);
      const Wc=Sp.clone().addScaledVector(to,d);
      const q1=aim(sh,tmp.copy(E).sub(Sp),perp,cq);          // 上臂背面（肘尖）朝 pole
      const q2=aim(el,tmp.copy(Wc).sub(E),p,q1);              // 前臂的扭转跟手掌走
      aim(wr,f,p,q2);
    }
    const fill=P=>{   // 没写踝角 = 脚掌放平
      const o=Object.assign({},P);
      if(o.anL==null)o.anL=-(o.legL[0]+o.knL);
      if(o.anR==null)o.anR=-(o.legR[0]+o.knR);
      return o;
    };
    let last=null;
    function apply(P){
      last=P;P=fill(P);
      const e=(o,a)=>o.rotation.set(a[0]||0,a[1]||0,a[2]||0);
      e(j.hips,P.hips||[0,0,0]);e(j.spine,P.spine||[0,0,0]);e(j.chest,P.chest||[0,0,0]);e(j.head,P.head||[0,0,0]);
      e(j.legL,P.legL);e(j.legR,P.legR);
      j.knL.rotation.set(P.knL,0,0);j.knR.rotation.set(P.knR,0,0);
      j.anL.rotation.set(P.anL,0,0);j.anR.rotation.set(P.anR,0,0);
      /* 落地：四个鞋底点里最低的那个贴地，再加腾空高度 */
      rig.position.y=0;root.updateMatrixWorld(true);
      let lo=Infinity;
      for(const f of j.feet){const y=root.worldToLocal(f.getWorldPosition(tmp)).y;if(y<lo)lo=y;}
      rig.position.y=-lo+(P.air||0);
      root.updateMatrixWorld(true);
      solveArm("L",P.armL);solveArm("R",P.armR);
      root.updateMatrixWorld(true);
      if(P.ball){ball.visible=true;ball.position.copy(rig.worldToLocal(j.chest.localToWorld(V(P.ball[0],P.ball[1],P.ball[2]))));}
      else ball.visible=false;
    }

    /* ---------- 投篮循环：站 → 下沉 → 举球 → 出手（起跳后、最高点前）→ 随挥落地 → 回站姿 ---------- */
    const KEYS=[[0,"stand"],[.5,"dip"],[.8,"set"],[.97,"relAnim"],[1.34,"follow"],[2.1,"follow"],[2.8,"stand"],[3.2,"stand"]];
    const T_REL=.97,T_UP=.82,T_DOWN=1.34,JUMP=.46,LOOP=3.2;
    function poseAt(t){
      let i=0;while(i<KEYS.length-2&&t>=KEYS[i+1][0])i++;
      const a=KEYS[i],b=KEYS[i+1];
      const P=lerpPose(POSES[a[1]],POSES[b[1]],smooth((t-a[0])/(b[0]-a[0])));
      const u=(t-T_UP)/(T_DOWN-T_UP);P.air=u>0&&u<1?4*JUMP*u*(1-u):0;
      return P;
    }
    const p0=V();
    function shot(time){
      const t=((time%LOOP)+LOOP)%LOOP;
      if(t>=T_REL&&t<2.8){
        /* 球挂在 rig 下面，rig 会随起跳上下移动 —— 出手点先换到 root 坐标再算抛物线 */
        apply(poseAt(T_REL));p0.copy(ball.position).multiplyScalar(rig.scale.x).add(rig.position);
        const dt=t-T_REL,P=poseAt(t);P.ball=null;apply(P);
        ball.visible=dt<1.25;
        ball.position.set(p0.x+.25*dt,p0.y+5.6*dt-4.9*dt*dt,p0.z+4.4*dt).sub(rig.position).divideScalar(rig.scale.x);
        ball.rotation.x=-dt*9;
      }else{ball.rotation.x=0;apply(poseAt(t));}
    }
    /* 整个人卸掉时释放自己建的几何 / 贴图（共用材质和游戏鞋模块的东西不动） */
    function dispose(){ORDER.forEach(clear);ball.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});}
    const api={root,rig,joints:j,ball,apply,shot,set,rebuild,look,slots,dispose,get B(){return Bk;},
      get tris(){let n=0;root.traverse(o=>{if(o.isMesh){const g=o.geometry;n+=(g.index?g.index.count:g.attributes.position.count)/3;}});return Math.round(n);}};
    rebuild();apply(POSES.stand);
    return api;
  }

  /* ---------- 姿势表 ----------
     躯干 / 腿：欧拉角（x 负 = 往前摆，膝 x 正 = 屈膝，踝不写 = 脚掌放平）。
     手臂：IK。w 手腕、pole 肘尖朝向、f 手指方向、p 掌心朝向，全部是胸骨局部坐标 —— 身体前倾时手跟着走。
     ball：球心（胸骨局部）。grip() 由"球在哪、手掌从哪边贴上去"反推手腕位置。 */
  function grip(Bc,P,F,pole){
    const p=V(P[0],P[1],P[2]).normalize(),f=V(F[0],F[1],F[2]);f.addScaledVector(p,-f.dot(p)).normalize();
    const w=V(Bc[0],Bc[1],Bc[2]).addScaledVector(p,-(BALL_R+PALM_Z)).addScaledVector(f,-PALM_Y);
    return {w:w.toArray(),f:f.toArray(),p:p.toArray(),pole};
  }
  const hang=sd=>({w:[sd*.265,-.325,.04],f:[sd*.05,-1,.12],p:[-sd,0,0],pole:[sd*.3,0,-1]});
  const POSES={};
  {
    let b=[-.275,-.25,.06];
    POSES.stand={
      spine:[.035,0,0],chest:[-.07,0,0],head:[.04,0,0],
      legL:[-.06,.14,.05],knL:.11,legR:[-.03,-.14,-.05],knR:.07,
      armL:hang(1),armR:grip(b,[1,.2,.05],[0,-.45,.9],[-.6,.1,-1]),ball:b
    };
    b=[-.09,-.06,.27];
    POSES.hold={
      spine:[.18,0,0],chest:[.10,0,0],head:[-.2,0,0],
      legL:[-.50,.14,.07],knL:.95,legR:[-.44,-.14,-.07],knR:.9,
      armR:grip(b,[.3,.3,.9],[0,.9,-.3],[-.7,-.7,-.1]),armL:grip(b,[-1,.1,.2],[0,.55,.85],[.7,-.7,-.1]),ball:b
    };
    b=[-.11,-.20,.27];
    POSES.dip={
      spine:[.27,0,0],chest:[.10,0,0],head:[-.30,0,0],
      legL:[-.64,.16,.08],knL:1.14,legR:[-.58,-.16,-.08],knR:1.06,
      armR:grip(b,[.3,.25,.92],[0,.85,-.3],[-.7,-.6,-.3]),armL:grip(b,[-1,.1,.2],[0,.4,.9],[.7,-.6,-.3]),ball:b
    };
    b=[-.08,.73,.17];
    POSES.set={
      spine:[.04,0,0],chest:[-.05,0,0],head:[-.04,0,0],
      legL:[-.30,.10,.05],knL:.6,legR:[-.26,-.10,-.05],knR:.55,
      armR:grip(b,[0,.75,.66],[0,.66,-.75],[-.3,-.2,1]),armL:grip(b,[-1,0,.1],[0,.8,-.5],[.8,-.5,.3]),ball:b
    };
    const relR={w:[-.19,.87,.17],f:[0,-.45,.9],p:[0,-.9,-.45],pole:[-.3,0,1]};
    POSES.release={
      spine:[-.05,0,0],chest:[-.05,0,0],head:[-.12,0,0],
      legL:[.06,.06,.03],knL:.16,anL:.30,legR:[-.10,-.06,-.03],knR:.42,anR:.22,
      armR:relR,armL:{w:[.12,.68,.20],f:[0,1,.15],p:[-1,0,.05],pole:[.8,-.4,.3]},
      ball:[-.19,1.19,.54],air:.46
    };
    POSES.relAnim=Object.assign({},POSES.release,{ball:[-.19,1.04,.27],air:0,
      armR:{w:[-.19,.85,.13],f:[0,.75,.66],p:[0,.66,-.75],pole:[-.3,0,1]}});
    POSES.follow={
      spine:[.05,0,0],chest:[0,0,0],head:[-.1,0,0],
      legL:[-.22,.10,.05],knL:.42,legR:[-.18,-.10,-.05],knR:.36,
      armR:{w:[-.19,.85,.21],f:[0,-.55,.84],p:[0,-.84,-.55],pole:[-.3,0,1]},
      armL:{w:[.24,.30,.20],f:[.1,.5,.85],p:[-1,0,.1],pole:[.8,-.5,-.2]},ball:null
    };
  }
  function lerpPose(a,b,t){
    const fa=Object.assign({},a),fb=Object.assign({},b);
    for(const P of [fa,fb]){if(P.anL==null)P.anL=-(P.legL[0]+P.knL);if(P.anR==null)P.anR=-(P.legR[0]+P.knR);}
    const L=(x,y)=>{
      if(typeof x==="number")return x+(y-x)*t;
      if(Array.isArray(x))return x.map((v,i)=>v+(y[i]-v)*t);
      const o={};for(const k in x)o[k]=L(x[k],y[k]);return o;
    };
    const o={};
    for(const k of ["spine","chest","head","legL","legR","knL","knR","anL","anR","armL","armR"])o[k]=L(fa[k]||[0,0,0],fb[k]||[0,0,0]);
    o.air=(fa.air||0)+((fb.air||0)-(fa.air||0))*t;
    o.ball=fa.ball&&fb.ball?L(fa.ball,fb.ball):(t<.5?fa.ball:fb.ball)||null;
    return o;
  }

  /* ---------- 游戏 star 记录 → look ----------
     字段对应：col / shortsColor / num → kit；skin + bodyProfileFor → body；hair / hairStyle / beard / beardStyle；
     headband / wrist / sleeve → gear；AIBAPlayerKit.profiles → 袜长、护膝、纹身档位；AIBAShoeColorways.forStar → 球鞋品系配色。
     游戏里纹身挂 0 号手臂、护臂挂 1 号手臂（a03 相反），这里 0 = 右、1 = 左。 */
  /* 游戏的 star 记录里没有的外貌（体型、脸、切面模型自己的发型款式）放这里：一位球星一行，只写和基模不一样的地方。
       build  各部位围度 shoulder / chest / waist / hip / arm / leg / neck 和肌肉量 muscle（整体胖瘦、身高已经在游戏的体格档案里）
       prop   骨架比例：arm 臂长、leg 腿长、shoulder 肩宽、head 头大小
       face   long 脸长、jawLen 下半脸长、jaw 下颌宽、chin 下巴宽、cheek 颧宽、nose 鼻宽、lips 唇厚、brow 眉内端压低的角度、ear 耳朵
       skin / hair / beard  覆盖游戏记录；hem 裤脚高度（-.27 八十年代短裤 … -.45 过膝）
     没写的球星用中性默认值（NEUTRAL）。 */
  const NEUTRAL={build:{shoulder:1,chest:1,waist:1,hip:1,arm:1,leg:1,neck:1,muscle:1},prop:{arm:1,leg:1,shoulder:1,head:1},
    face:{long:1,jawLen:1,jaw:1,chin:1,cheek:1,nose:1,lips:1,brow:.08,ear:1},hem:-.36};
  /* 女球员共用的体型：肩窄、手臂和脖子细、髋略宽、肌肉线条收敛；脸小一圈、下颌下巴收 */
  const WOMAN={build:{shoulder:.9,chest:.93,waist:.95,hip:1.03,arm:.86,leg:.96,neck:.86,muscle:.72},prop:{shoulder:.9,head:1.03},
    face:{jaw:.92,chin:.88,cheek:.98,nose:.82,lips:1.05,brow:.02,ear:.9},hem:-.34};
  const TUNE={
    k24:{skin:LOOK24.body.skin,build:LOOK24.body.build,prop:LOOK24.body.prop,face:LOOK24.face,hair:"shaved",beard:"circle",hem:LOOK24.kit.hem},
    j23:{build:{shoulder:1.03,arm:1.02,muscle:1.08},prop:{arm:1.01},face:{jawLen:1.02,jaw:1.04,chin:1.05,nose:1.2,lips:1.15,brow:.1,ear:1.1},hem:-.33},
    a03:{build:{shoulder:.97,arm:.96,muscle:.97},prop:{arm:1.02},face:{long:.98,jaw:.98,chin:.98,nose:1.15,lips:1.15,brow:.1},hem:-.45},
    v15:{build:{shoulder:1.03,chest:1.03,arm:1.05,muscle:1.12},face:{jaw:1.06,chin:1.08,nose:1.2,lips:1.15,brow:.09},beard:"circle",hem:-.42},
    t01:{build:{arm:.98,muscle:.98},prop:{arm:1.05,leg:1.02},face:{long:1.04,jawLen:1.03,jaw:.98,nose:1.15,lips:1.2,brow:.03},hem:-.44},
    allen:{build:{arm:.98},face:{nose:1.1,lips:1.1,brow:.07},hair:"shaved",hem:-.42},
    curry:{build:{shoulder:.97,arm:.95,muscle:.94},face:{jaw:.96,chin:.95,cheek:.98,brow:.05},hem:-.4},
    thompson:{face:{jaw:1.02,long:1.02,brow:.05},hem:-.4},
    h13:{build:{chest:1.04,waist:1.08,hip:1.04,arm:1.05,leg:1.04},face:{jaw:1.05,nose:1.15,lips:1.1,brow:.07},beard:{style:"full",len:1.9},hem:-.4},
    durant:{build:{shoulder:.99,arm:.96,leg:.97,muscle:.93},prop:{arm:1.07,leg:1.03},face:{long:1.04,jawLen:1.04,jaw:.97,nose:1.15,lips:1.15,brow:.07},hem:-.4},
    doncic:{build:{chest:1.03,waist:1.1,hip:1.05,arm:1.04,leg:1.05,muscle:.9},face:{jaw:1.08,chin:1.05,cheek:1.04,lips:.95,brow:.06},hem:-.4},
    nowitzki:{build:{waist:1.02,arm:.96,leg:.97,muscle:.9},prop:{arm:1.02,leg:1.03},face:{long:1.05,jawLen:1.05,chin:1.05,nose:1.05,lips:.9,brow:.05},hem:-.42},
    irving:{build:{shoulder:.98,arm:.97},face:{nose:1.1,lips:1.1,brow:.08},beard:{style:"full",len:.9},hem:-.4},
    lillard:{build:{shoulder:1.02,chest:1.02,arm:1.03,muscle:1.06},face:{jaw:1.03,nose:1.15,lips:1.15,brow:.08},hem:-.4},
    bird:{build:{waist:1.03,arm:.96,muscle:.86},face:{long:1.03,jaw:1.02,chin:1.05,nose:1.1,lips:.85,brow:.05},beard:"moustache",hem:-.27},
    miller:{build:{shoulder:.98,arm:.95,muscle:.9},prop:{arm:1.03},face:{long:1.05,jaw:.96,chin:.95,nose:1.1,lips:1.1,brow:.06,ear:1.3},hem:-.32},
    korver:{build:{muscle:.95},face:{jaw:1.03,chin:1.03,lips:.9,brow:.05},hem:-.4},
    stojakovic:{build:{arm:.97,muscle:.93},prop:{arm:1.01},face:{long:1.03,nose:1.05,lips:.9,brow:.05},hem:-.42},
    nova24:{build:{muscle:1.04},face:{nose:1.1,lips:1.1,brow:.1},hem:-.4},
    ionescu:WOMAN,taurasi:WOMAN,"sue-bird":WOMAN
  };
  function fromStar(star){
    const kp=(global.AIBAPlayerKit&&AIBAPlayerKit.profiles[star.id])||{};
    const cw=global.AIBAShoeColorways?AIBAShoeColorways.forStar(star):null;
    const bp=global.AIBA_CONFIG&&AIBA_CONFIG.bodyProfileFor?AIBA_CONFIG.bodyProfileFor(star):null;
    const tn=TUNE[star.id]||{},h=bp&&Number(bp.h)||1;
    /* 身高是整个人等比放大的，头不该跟着一起大：高个子头按比例缩回来一些、矮个子放回去 */
    const prop=Object.assign({},NEUTRAL.prop,tn.prop);prop.head=(prop.head||1)*Math.pow(1/h,.6);
    const tb=tn.beard==null?{}:typeof tn.beard==="object"?tn.beard:{style:tn.beard};
    const hairC=star.hair!=null?star.hair:0x141414,slvSide=star.id==="a03"?"R":"L";
    const tat=kp.tattoo==="dense"?{upperArmL:"dense",upperArmR:"dense",forearmL:"dense",forearmR:"dense"}:kp.tattoo==="upper"?{upperArmR:"upper"}:kp.tattoo==="small"?{forearmR:"small"}:{};
    return {
      id:star.id,
      body:{h:bp&&Number(bp.h)||1,w:bp&&Number(bp.w)||1,skin:tn.skin!=null?tn.skin:(star.skin!=null?star.skin:0xa87550),
        build:Object.assign({},NEUTRAL.build,tn.build),prop},
      face:Object.assign({},NEUTRAL.face,tn.face),
      kit:{jersey:star.col[0],trim:star.col[1],shorts:star.shortsColor!=null?star.shortsColor:star.col[1],num:star.num,word:"aiBA",hem:tn.hem!=null?tn.hem:NEUTRAL.hem},
      hair:{style:tn.hair||(HAIR[star.hairStyle]?star.hairStyle:"short"),color:hairC},
      beard:Object.assign({style:star.beard?(star.beardStyle||"full"):"none",color:typeof star.beard==="number"?star.beard:hairC},tb),
      socks:{h:kp.sock||.17,color:cw&&cw.sock!=null?cw.sock:0xe8e7e2,stripe:cw&&cw.sockStripe!=null?cw.sockStripe:star.col[0],stripes:kp.stripes||1},
      shoes:cw?{style:"game",family:cw.family,colorway:cw.colorway}:{style:"facet",main:star.shoe!=null?star.shoe:0x1b1c20},
      gear:{
        head:star.headband?{kind:"band",color:star.headband}:null,
        sleeve:star.sleeve!=null?{side:slvSide,color:star.sleeve}:null,
        wrist:star.wrist!=null?{side:"LR",color:star.wrist}:null,
        knee:kp.knee!=null?{side:kp.knee?"L":"R",kind:"pad",color:kp.kneeColor||0x202127}:null,
        compression:null
      },
      tattoo:tat
    };
  }

  global.AIBAFacet={build,fromStar,TUNE,LOOK24,POSES,HAIR,BEARD,HEADGEAR,SHOES,TATTOO,SPEC,B,makeBall};
})(window);
