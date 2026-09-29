/* ---------------- 下一代球员模型（实验，不接主链路） ----------------
   用户要求："建模要升 2-3 档，可以先不在主链路弄，但要看到单独的人物建模提升"（2026-09-24）。
   现有 voxelGuy 的上限卡在比例：约 5 头身，腿长写死在落地解算里、球心被 check.js 锁到毫米。
   这里从零搭一个不受那些约束的模型，验证"升档后长什么样"，再决定怎么迁回主链路。

   方向：保留方块/低多边形的风格基因，升级成"高级风格化"——
     比例    约 8 头身 NBA 运动员（身高 1.98m、肩宽 .46、腿长 1.04）
     塑形    不再用长方体拼，四肢躯干都用截面放样（超椭圆截面，介于椭圆和圆角方形之间），
             三角肌 / 肱二头肌 / 前臂 / 股四头肌 / 腓肠肌由截面宽窄变化自然长出来
     头部    球体按区域雕刻：颅骨、眉弓、眼窝、颧骨、下颌、下巴；立体鼻、嵌进眼窝的眼睛、耳朵、嘴唇
     服装    有厚度的背心球衣（贴图做号码 / 队名 / 滚边 / 网眼）、缎面过膝短裤（侧条）、中筒袜
     球鞋    复用游戏里已精修验收的鞋款模块（AIBAShoeStyles），按球星自动选鞋款配色
     材质    PBR：皮肤、网眼球衣、缎面短裤、袜子各自粗糙度，吃环境反射
   骨架：hips → spine(下腰) → chest(胸) → neck → head；肩 → 上臂 → 肘 → 前臂 → 腕 → 手；髋 → 大腿 → 膝 → 小腿 → 踝。
   对外：AIBACharacterNext.build(star) → {root, rig, setPose(name,k), poses, update(dt)} */
(function(global){
  "use strict";
  const T=global.THREE;
  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

  /* ---------- 截面放样 ----------
     sections: [{y,w,d,cx,cz,n}]，沿局部 Y 排列（可升可降）；w/d 是全宽 / 全厚，
     n 是超椭圆指数（2 = 椭圆，4 ≈ 圆角方形）。seg 为截面点数。
     v 坐标沿长度 0→1，u 坐标绕一圈 0→1，u=.75 在正前方（+z），u=.25 在正后方。 */
  function loft(sections,opts){
    opts=opts||{};
    const seg=opts.seg||24,cap=opts.cap!==false;
    const pos=[],uv=[],idx=[];
    const S=sections.length;
    let total=0;const acc=[0];
    for(let i=1;i<S;i++){total+=Math.abs(sections[i].y-sections[i-1].y);acc.push(total);}
    for(let i=0;i<S;i++){
      const s=sections[i],n=s.n||opts.n||2.6,e=2/n;
      for(let k=0;k<=seg;k++){
        const a=k/seg*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
        const x=(s.w/2)*Math.sign(c)*Math.pow(Math.abs(c),e)+(s.cx||0);
        const z=(s.d/2)*Math.sign(sn)*Math.pow(Math.abs(sn),e)+(s.cz||0);
        // u 取反：否则从正面看贴图是镜像的（角度从 +x 经 +z 转到 -x，正面上 u 从右往左增）
        pos.push(x,s.y,z);uv.push(1-k/seg,total?acc[i]/total:0);
      }
    }
    for(let i=0;i<S-1;i++)for(let k=0;k<seg;k++){
      const a=i*(seg+1)+k,b=a+1,c=a+seg+1,d=c+1;
      // 让法线朝外：截面沿 +y 排列时 (a,c,b)
      const up=sections[i+1].y>sections[i].y;
      if(up){idx.push(a,c,b,b,c,d);}else{idx.push(a,b,c,b,d,c);}
    }
    if(cap){
      for(const [row,top] of [[0,false],[S-1,true]]){
        const s=sections[row],center=pos.length/3;
        pos.push(s.cx||0,s.y,s.cz||0);uv.push(.5,row?1:0);
        const up=S>1&&(sections[S-1].y>sections[0].y);
        const outward=top?up:!up;
        for(let k=0;k<seg;k++){
          const a=row*(seg+1)+k,b=a+1;
          if(outward)idx.push(center,b,a);else idx.push(center,a,b);
        }
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    return g;
  }
  /* 英雄比例：截面按 kw（宽）/ kd（厚）整体放粗。高级风格化运动员会有意夸张肩臂与腿，
     首版按真实比例做出来像瘦长的人体模特，放在方块球馆里显得单薄。 */
  /* 头骨尺寸与五官组缩放：头发 / 胡子壳在五官组里建，必须按两者之比贴回头骨，
     否则头骨放大后发壳整个埋进头皮（首版 Ionescu / Curry 看着像光头）。 */
  const SKULL=[.094,.14,.117],FACE_K=1.13;
  const onSkull=m=>{m.scale.set(SKULL[0]/FACE_K,SKULL[1]/FACE_K,SKULL[2]/FACE_K);return m;};
  function thick(sections,kw,kd){return sections.map(s=>Object.assign({},s,{w:s.w*kw,d:s.d*(kd==null?kw:kd),cz:(s.cz||0)*(kd==null?kw:kd)}));}
  function mesh(geo,mat,name){const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;if(name)m.name=name;return m;}
  function group(name,parent,x,y,z){const g=new T.Group();g.name=name;g.position.set(x||0,y||0,z||0);if(parent)parent.add(g);return g;}

  /* ---------- 贴图 ---------- */
  function canvasTex(w,h,draw){
    const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);
    const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;return t;
  }
  const hex=c=>"#"+("000000"+(c>>>0).toString(16)).slice(-6);
  function shade(c,k){
    const r=((c>>16)&255)*k,g=((c>>8)&255)*k,b=(c&255)*k;
    return (clamp(r,0,255)<<16)|(clamp(g,0,255)<<8)|clamp(b,0,255);
  }
  /* 头部肤色贴图（球面 uv：u=.25 正前、v=1 头顶）：眼窝 / 鼻翼阴影、颧骨一点血色、嘴周，
     胡茬直接画在皮肤上——半透明外壳做胡茬会在边界切出一条硬线（首版像贴了块胶布）。 */
  function skullTexture(star){
    const skinC=star.skin||0xa06a48;
    return canvasTex(512,256,(g,W,H)=>{
      g.fillStyle=hex(skinC);g.fillRect(0,0,W,H);
      const P=(u,v)=>[u*W,(1-v)*H];
      const blob=(u,v,ru,rv,color,alpha)=>{
        const [x,y]=P(u,v);g.save();g.translate(x,y);g.scale(1,rv/ru*W/H*.5);
        const r=ru*W,gr=g.createRadialGradient(0,0,0,0,0,r);
        const c=hex(color);gr.addColorStop(0,c);gr.addColorStop(1,c+"00");
        g.globalAlpha=alpha;g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.restore();
      };
      // 眼窝
      for(const s of [-1,1])blob(.25+s*.068,.53,.05,.05,shade(skinC,.62),.55);
      // 颧骨血色
      for(const s of [-1,1])blob(.25+s*.1,.45,.06,.05,0xc0503a,.12);
      // 鼻下 / 嘴角阴影
      blob(.25,.37,.035,.03,shade(skinC,.7),.35);
      // 胡茬
      const beard=star.beard&&star.beardStyle!=="none"?star.beardStyle:null;
      if(beard==="stubble"||beard==="full"){
        const a=beard==="full"?.9:.42,[,y0]=P(0,.47),[,y1]=P(0,.33);
        const gr=g.createLinearGradient(0,y0,0,y1);const c=hex(star.beard);gr.addColorStop(0,c+"00");gr.addColorStop(1,c);
        g.globalAlpha=a;g.fillStyle=gr;g.fillRect(.04*W,y0,.42*W,H-y0);
        // 往后脖子方向淡出
        g.globalAlpha=1;g.globalCompositeOperation="destination-over";g.globalCompositeOperation="source-over";
        // 嘴唇周围留一圈
        g.globalAlpha=.9;blob(.25,.355,.03,.028,skinC,1);
      }
      if(beard==="goatee"){blob(.25,.3,.035,.05,star.beard,.8);blob(.25,.37,.04,.015,star.beard,.6);}
      g.globalAlpha=1;
    });
  }
  /* 球衣贴图：u 绕躯干一圈（.75 正前 / .25 正后），v 自下而上。
     网眼织纹 + 侧片 + 下摆 / 挖肩 / 领口滚边 + 前胸队名与号码 + 背后大号码 */
  function jerseyTexture(star){
    const base=star.col[0],trim=star.col[1],num=String(star.num==null?"0":star.num);
    return canvasTex(1024,512,(g,W,H)=>{
      g.fillStyle=hex(base);g.fillRect(0,0,W,H);
      // 网眼织纹
      g.fillStyle=hex(shade(base,.86));
      for(let y=4;y<H;y+=7)for(let x=(y/7|0)%2*3.5;x<W;x+=7){g.fillRect(x,y,2.2,2.2);}
      // 侧片（u=0 / .5 两侧）
      g.fillStyle=hex(trim);
      for(const u of [0,.5,1]){g.fillRect(u*W-18,0,36,H);}
      g.fillStyle=hex(base);for(const u of [0,.5,1]){g.fillRect(u*W-12,0,24,H);}
      g.fillStyle=hex(shade(base,.78));for(const u of [0,.5,1]){g.fillRect(u*W-9,0,18,H);}
      // 下摆滚边（v=0 在底部 → canvas 底部）
      g.fillStyle=hex(trim);g.fillRect(0,H-22,W,14);
      // 顶部滚边（挖肩 / 领口）
      g.fillRect(0,0,W,16);
      // V 领由几何切出来（见 vNeck），顶部滚边自然沿开口走，不再画假的 V
      // 文字
      const outline=(txt,x,y,size,fill,stroke,lw)=>{
        g.font="900 "+size+"px 'Arial Black','Helvetica Neue',Arial,sans-serif";g.textAlign="center";g.textBaseline="middle";
        g.lineJoin="round";g.lineWidth=lw;g.strokeStyle=hex(stroke);g.strokeText(txt,x,y);g.fillStyle=hex(fill);g.fillText(txt,x,y);
      };
      const light=((base>>16&255)*.3+(base>>8&255)*.59+(base&255)*.11)>150;
      const numFill=light?trim:0xffffff,numStroke=light?0xffffff:trim;
      outline("aiBA",.75*W,H*.36,54,numFill,numStroke,8);
      outline(num,.75*W,H*.62,170,numFill,numStroke,14);
      outline(num,.25*W,H*.52,230,numFill,numStroke,16);
      outline((star.last||"").toUpperCase(),.25*W,H*.2,46,numFill,numStroke,6);
    });
  }
  function shortsTexture(star){
    const base=star.shortsColor!=null?star.shortsColor:star.col[0],trim=star.col[1];
    return canvasTex(512,256,(g,W,H)=>{
      g.fillStyle=hex(base);g.fillRect(0,0,W,H);
      // 缎面的细纵纹
      g.fillStyle="rgba(255,255,255,.035)";for(let x=0;x<W;x+=6)g.fillRect(x,0,2,H);
      // 外侧侧条：右腿外侧 u=0，左腿外侧 u=.5 —— 两处都画，内侧被另一条腿挡着看不见
      for(const u of [0,.5,1]){g.fillStyle=hex(trim);g.fillRect(u*W-20,0,40,H);g.fillStyle=hex(shade(trim,.7));g.fillRect(u*W-4,0,8,H);}
      // 裤口滚边
      g.fillStyle=hex(trim);g.fillRect(0,0,W,12);
    });
  }
  function sockTexture(stripe){
    return canvasTex(256,128,(g,W,H)=>{
      g.fillStyle="#f2f2ee";g.fillRect(0,0,W,H);
      g.fillStyle="rgba(0,0,0,.06)";for(let y=0;y<H;y+=4)g.fillRect(0,y,W,1.4);
      g.fillStyle=hex(stripe);g.fillRect(0,8,W,10);g.fillRect(0,24,W,6);
    });
  }

  /* ---------- 头部雕刻 ---------- */
  function headGeometry(){
    const g=new T.SphereGeometry(1,40,32),p=g.attributes.position,v=new T.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);
      let {x,y,z}=v;
      // 下颌收窄 + 下巴前探
      if(y<0){const t=smooth(-y/.95);x*=lerp(1,.62,t);z*=lerp(1,.86,t);if(z>0)z+=.10*t*smooth((z)/.9);}
      // 颧骨：面部两侧、眼睛下方略外扩
      if(Math.abs(x)>.5&&z>.2&&y>-.35&&y<.1)x*=1.045;
      // 眉弓：前额下缘前突
      if(z>.55&&y>.05&&y<.32)z+=.07*smooth(1-Math.abs(y-.18)/.14);
      // 眼窝：眉弓下方凹进
      if(z>.6&&y>-.12&&y<.1&&Math.abs(x)>.18&&Math.abs(x)<.62)z-=.06*smooth(1-Math.abs(y+.01)/.11)*smooth(1-Math.abs(Math.abs(x)-.4)/.22);
      // 面部整体略平
      if(z>0)z*=.93;
      // 后脑勺
      if(z<0&&y>-.2)z*=1.08;
      // 头顶略平、太阳穴收
      if(y>.6)y=lerp(y,.6+(y-.6)*.8,1);
      if(y>.2&&Math.abs(x)>.7)x*=.97;
      p.setXYZ(i,x,y,z);
    }
    g.computeVertexNormals();
    return g;
  }

  /* 真 V 领：把球衣上缘前片按 V 形往下压，露出胸口皮肤；uv 不动，顶部滚边就跟着开口走。
     后领口只浅浅下挖。 */
  function vNeck(g,y0,y1,secs){
    const p=g.attributes.position;
    // 截面在某高度的宽 / 厚（线性插值）：压下去的顶点要换成那个高度上球衣的围度，否则会陷进胸口皮肤
    const dims=y=>{for(let i=1;i<secs.length;i++){const a=secs[i-1],b=secs[i];if(y<=b.y){const t=clamp((y-a.y)/(b.y-a.y),0,1);return [lerp(a.w,b.w,t),lerp(a.d,b.d,t)];}}const l=secs[secs.length-1];return [l.w,l.d];};
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      if(y<=y0)continue;
      const f=smooth((y-y0)/(y1-y0));
      const front=z>0?smooth(z/.09):0,back=z<0?smooth(-z/.09):0;
      const v=Math.max(0,1-Math.abs(x)/.12);
      const dip=.1*Math.pow(v,.9)*front+.025*smooth(1-Math.abs(x)/.1)*back;
      const ny=y-dip*f,[w0,d0]=dims(y),[w1,d1]=dims(ny);
      p.setXYZ(i,x*w1/w0,ny,z*d1/d0+(front>0?.004*v*f:0));
    }
    g.computeVertexNormals();return g;
  }

  /* ---------- 材质 ---------- */
  function std(color,rough,extra){
    const m=new T.MeshStandardMaterial(Object.assign({color,roughness:rough,metalness:0},extra||{}));
    /* r128 里十六进制颜色按线性值处理，输出又做 sRGB → 深肤色会被提成石膏白（首版实测）。
       和游戏里一样先转线性。 */
    m.color.convertSRGBToLinear();
    if(m.map)m.map.encoding=T.sRGBEncoding;
    return m;
  }

  /* ---------- 构建 ---------- */
  function build(star,opts){
    opts=opts||{};
    const female=star.sex==="f";
    const S=female?.9:1;                       // 女球员整体缩放
    const skin=std(star.skin||0xa06a48,.58,{envMapIntensity:.55});
    const skinDark=std(shade(star.skin||0xa06a48,.72),.62);
    const lip=std(shade(star.skin||0xa06a48,.66),.45);
    const hairMat=std(star.hair||0x161210,.72);
    const jerseyTex=jerseyTexture(star);
    const jersey=std(0xffffff,.64,{map:jerseyTex,envMapIntensity:.5});
    const shortsTex=shortsTexture(star);
    const shorts=std(0xffffff,.34,{map:shortsTex,envMapIntensity:1.0});
    const sockStripe=star.col[1];
    const sock=std(0xffffff,.92,{map:sockTexture(sockStripe)});
    const white=std(0xf4f4f0,.35);
    const ink=std(0x141416,.35);
    const irisMat=std(0x3a2416,.3);
    const sclera=std(0xe6ddd2,.4);

    const root=new T.Group();root.name="characterNext";
    const rig={};
    const hipsY=1.02;
    const hips=group("hips",root,0,hipsY,0);rig.hips=hips;
    // 下腰（骨盆 → 腰）
    const spine=group("spine",hips);rig.spine=spine;
    spine.add(mesh(loft([
      {y:-.06,w:.3,d:.2},{y:-.02,w:.345,d:.23},{y:.10,w:.315,d:.21},{y:.24,w:.305,d:.205}
    ]),skin,"pelvis"));
    // 胸（腰 → 肩）
    const chest=group("chest",spine,0,.24,0);rig.chest=chest;
    const torsoSections=[
      {y:-.04,w:.305,d:.205},{y:.06,w:.33,d:.225},{y:.16,w:.37,d:.245},{y:.25,w:.41,d:.26},
      {y:.32,w:.43,d:.255},{y:.36,w:.41,d:.24},{y:.40,w:.33,d:.215},{y:.435,w:.25,d:.18},{y:.455,w:.15,d:.13}
    ];
    chest.add(mesh(loft(torsoSections),skin,"chestSkin"));
    /* 球衣：沿躯干外扩一层，一直包到肩顶和脖子根；背心的挖肩由三角肌外露表现。
       首版单独做了肩带 / 斜方肌 / 深色内衬，叠在一起乱成一团，还从开口透出内衬，已去掉。 */
    const jerseySections=[
      {y:-.30,w:.345,d:.235},{y:-.18,w:.35,d:.24},{y:-.04,w:.323,d:.223},{y:.06,w:.345,d:.24},
      {y:.16,w:.385,d:.26},{y:.25,w:.425,d:.272},{y:.32,w:.445,d:.268},{y:.365,w:.425,d:.252},
      {y:.385,w:.39,d:.24},{y:.40,w:.35,d:.228},{y:.415,w:.32,d:.217},{y:.43,w:.29,d:.205}
    ];
    const jerseyMesh=mesh(vNeck(loft(jerseySections,{cap:false,seg:72}),.30,.43,jerseySections),jersey,"jersey");chest.add(jerseyMesh);
    // 脖子 + 头
    const neck=group("neck",chest,0,.43,-.008);rig.neck=neck;
    // 运动员的粗颈：短、底部带斜方肌的坡
    neck.add(mesh(loft([{y:-.03,w:.21,d:.17},{y:.0,w:.18,d:.158},{y:.04,w:.18,d:.16},{y:.09,w:.165,d:.15,cz:-.004},{y:.14,w:.15,d:.138,cz:-.012},{y:.19,w:.11,d:.11,cz:-.016}],{seg:28}),skin,"neckMesh"));
    // 喉结 / 下颌下的阴影面
    const head=group("head",neck,0,.045,.016);rig.head=head;head.scale.setScalar(1.12);
    const skull=mesh(headGeometry(),std(0xffffff,.58,{map:skullTexture(star),envMapIntensity:.55}),"skull");
    skull.scale.set(SKULL[0],SKULL[1],SKULL[2]);skull.position.set(0,.13,.008);head.add(skull);
    const face=group("face",head,0,.13,.008);face.scale.setScalar(FACE_K);   // 五官跟着头一起放大
    // 鼻子：鼻梁 → 鼻头（低多边形楔形）
    const nose=mesh(loft([{y:.035,w:.018,d:.014,cz:.089},{y:.0,w:.026,d:.03,cz:.098},{y:-.028,w:.036,d:.036,cz:.104},{y:-.038,w:.038,d:.03,cz:.1}],{seg:12,n:2.2}),skin,"nose");
    nose.scale.set(.88,.92,.82);nose.position.z=.012;face.add(nose);
    // 眼睛：眼白 + 虹膜 + 高光，嵌在眼窝里；上眼睑一条深色线
    for(const sx of [-1,1]){
      const eye=group("eye",face,sx*.034,.012,.079);
      const eyeball=mesh(new T.SphereGeometry(1,16,12),sclera,"sclera");eyeball.scale.set(.0172,.0096,.0092);eye.add(eyeball);
      const iris=mesh(new T.SphereGeometry(1,14,10),irisMat,"iris");iris.scale.set(.0078,.0078,.0035);iris.position.set(0,-.0005,.0068);eye.add(iris);
      const pupil=mesh(new T.SphereGeometry(1,10,8),ink,"pupil");pupil.scale.set(.0036,.0036,.002);pupil.position.set(0,-.0005,.0096);eye.add(pupil);
      const lid=mesh(new T.BoxGeometry(.036,.0045,.012),skinDark,"lid");lid.position.set(0,.0085,.002);lid.rotation.z=sx*.08;eye.add(lid);
      // 眉毛
      const brow=mesh(new T.BoxGeometry(.034,.0075,.012),hairMat,"brow");
      brow.position.set(sx*.036,.036,.086);brow.rotation.z=-sx*.13;face.add(brow);
      // 耳朵
      const ear=mesh(new T.SphereGeometry(1,14,10),skin,"ear");ear.scale.set(.011,.029,.02);ear.position.set(sx*.08,.004,-.008);ear.rotation.y=sx*.25;face.add(ear);
    }
    // 嘴唇
    const upper=mesh(new T.SphereGeometry(1,16,8),lip,"upperLip");upper.scale.set(.021,.0048,.0065);upper.position.set(0,-.052,.085);face.add(upper);
    const lower=mesh(new T.SphereGeometry(1,16,8),lip,"lowerLip");lower.scale.set(.019,.0058,.007);lower.position.set(0,-.061,.083);face.add(lower);
    buildHair(face,star,hairMat,skinDark);
    // 手臂
    rig.arms=[];
    for(const sx of [-1,1]){
      const shoulder=group(sx<0?"shoulderR":"shoulderL",chest,sx*.225,.345,-.005);
      // 三角肌
      /* 三角肌 + 上臂一次放样：两块分开做时交线锯齿明显（首版肩下一圈毛边）。
         三角肌帽 → 肱二头 / 三头肌腹（前后鼓）→ 肘上收。 */
      shoulder.add(mesh(loft([{y:.088,w:.04,d:.04},{y:.075,w:.11,d:.108},{y:.05,w:.16,d:.155},{y:.0,w:.185,d:.175},{y:-.06,w:.178,d:.168},
        {y:-.12,w:.152,d:.158,cz:.003},{y:-.18,w:.15,d:.165,cz:.007},{y:-.25,w:.13,d:.14,cz:.004},{y:-.31,w:.108,d:.114},{y:-.345,w:.104,d:.108}],{seg:32,n:2.15}),skin,"upperArm"));
      const elbow=group("elbow",shoulder,0,-.325,0);
      elbow.add(mesh(new T.SphereGeometry(.056,16,12),skin,"elbowCap"));
      // 前臂：靠肘粗、向腕收
      elbow.add(mesh(loft(thick([{y:.02,w:.085,d:.085},{y:-.05,w:.1,d:.092},{y:-.12,w:.094,d:.084},{y:-.21,w:.072,d:.064},{y:-.27,w:.062,d:.05}],1.24),{n:2.2}),skin,"forearm"));
      const wrist=group("wrist",elbow,0,-.275,0);
      const hand=buildHand(wrist,skin,sx);hand.scale.setScalar(1.2);
      rig.arms.push({shoulder,elbow,wrist,hand,side:sx});
    }
    // 短裤腰头（绕骨盆一圈）
    hips.add(mesh(loft([{y:.02,w:.37,d:.255},{y:.1,w:.365,d:.25},{y:.13,w:.36,d:.245}],{seg:40}),shorts,"waistband"));
    // 裆部收成窄底藏在两条裤管之间（直筒往下吊会像一块兜布）
    hips.add(mesh(loft([{y:-.13,w:.1,d:.15},{y:-.08,w:.3,d:.235},{y:-.02,w:.385,d:.258},{y:.03,w:.372,d:.255}],{seg:40,cap:false}),shorts,"shortsSeat"));
    // 腿
    rig.legs=[];
    for(const sx of [-1,1]){
      const thigh=group(sx<0?"thighR":"thighL",hips,sx*.105,0,0);
      // 大腿：股四头肌前鼓，向膝收
      thigh.add(mesh(loft(thick([{y:.02,w:.17,d:.18},{y:-.08,w:.185,d:.2,cz:.006},{y:-.22,w:.17,d:.185,cz:.01},{y:-.36,w:.135,d:.145},{y:-.48,w:.112,d:.118}],1.12),{n:2.2}),skin,"thigh"));
      // 短裤腿：宽松过膝、外侧外扩
      thigh.add(mesh(loft([{y:.06,w:.23,d:.25,cx:sx*.012},{y:-.06,w:.235,d:.255,cx:sx*.018},{y:-.24,w:.245,d:.255,cx:sx*.022},{y:-.4,w:.255,d:.25,cx:sx*.024}],{seg:36}),shorts,"shortsLeg"));
      const knee=group("knee",thigh,0,-.495,0);
      const kneeCap=mesh(new T.SphereGeometry(1,16,12),skin,"kneeCap");kneeCap.scale.set(.066,.062,.07);knee.add(kneeCap);
      // 小腿：腓肠肌上后鼓，向踝收
      knee.add(mesh(loft(thick([{y:.02,w:.11,d:.115},{y:-.06,w:.118,d:.135,cz:-.014},{y:-.15,w:.112,d:.132,cz:-.014},{y:-.28,w:.084,d:.09,cz:-.004},{y:-.42,w:.068,d:.072},{y:-.47,w:.064,d:.068}],1.18),{n:2.15}),skin,"shin"));
      // 中筒袜
      knee.add(mesh(loft(thick([{y:-.26,w:.096,d:.104,cz:-.004},{y:-.36,w:.084,d:.09},{y:-.46,w:.08,d:.086},{y:-.5,w:.082,d:.09}],1.2),{seg:28,cap:false}),sock,"sock"));
      const ankle=group("ankle",knee,0,-.47,0);
      const shoe=buildShoe(ankle,star,sx);
      rig.legs.push({thigh,knee,ankle,shoe,side:sx});
    }
    root.scale.setScalar(S);
    if(female){rig.chest.scale.set(.93,1,.95);}
    const api={root,rig,star};
    api.setPose=(name,k)=>setPose(api,name,k==null?1:k);
    api.holdBall=(mode,r)=>holdBall(api,mode,r);
    api.poses=Object.keys(POSES);
    return api;
  }

  /* 手：手掌 + 四指并排（分节的方块手套）+ 拇指，自然微屈 */
  function buildHand(wrist,skin,sx){
    const hand=group("hand",wrist);
    hand.add(mesh(loft([{y:.01,w:.064,d:.04},{y:-.04,w:.084,d:.036},{y:-.085,w:.08,d:.03}],{seg:16,n:3.2}),skin,"palm"));
    const fingers=group("fingers",hand,0,-.085,0);
    const lens=[.07,.08,.078,.064];
    for(let i=0;i<4;i++){
      const f=group("finger",fingers,(i-1.5)*.0195,0,.002);
      f.rotation.x=-.18;
      f.add(mesh(loft([{y:.005,w:.018,d:.022},{y:-lens[i]*.5,w:.0175,d:.02},{y:-lens[i],w:.015,d:.017}],{seg:10,n:3}),skin,"finger"));
    }
    const thumb=group("thumb",hand,-sx*.038,-.03,.012);
    thumb.rotation.set(-.4,0,sx*.75);
    thumb.add(mesh(loft([{y:.0,w:.024,d:.024},{y:-.035,w:.022,d:.021},{y:-.06,w:.018,d:.017}],{seg:10,n:3}),skin,"thumb"));
    return hand;
  }

  /* 发型：在头骨外扩一层，按发际线裁；按球星数据的 hairStyle 生成 */
  function buildHair(face,star,hairMat,skinDark){
    const style=star.hairStyle||"short";
    if(style==="bald")return;
    const src=headGeometry(),p=src.attributes.position,keep=[];
    const hairline=(x,y,z)=>{
      // 前额发际线高、两鬓低、后脑低；连续过渡（分段写法在太阳穴处出现方形缺口）
      const side=lerp(-.35,.1,smooth((z+.45)/.3));
      return lerp(side,.42-.12*Math.abs(x),smooth((z-.12)/.3));
    };
    const lift=style==="croppedCurls"?1.075:style==="sidepart"||style==="short"?1.06:1.028;
    const v=new T.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);
      const {x,y,z}=v,hl=hairline(x,y,z);
      // 发际线处 5cm 渐变带：硬切会顺着网格走出锯齿（首版刘海像剪出来的方块）
      const band=smooth((y-hl)/.1+.5);
      let k=.985;
      if(band>0){
        k=lift;
        if(style==="croppedCurls")k+=.022*Math.sin(x*37)*Math.sin(y*31)*Math.sin(z*29);
        if(style==="sidepart"&&y>.5)k+=.03*smooth((y-.5)/.4)*(x>-.2?1:.6);
        if(style==="fade"&&y<.45)k=lerp(1.004,lift,smooth((y-.1)/.35));
        k=lerp(.985,k,band);
      }
      p.setXYZ(i,x*k,y*k,z*k);
    }
    src.computeVertexNormals();
    const cap=mesh(src,style==="fade"||style==="buzz"?std(star.hair||0x161210,.9):hairMat,"hair");
    onSkull(cap);face.add(cap);
    if(style==="cornrows"){
      for(let i=-3;i<=3;i++){
        const row=mesh(new T.TorusGeometry(.102,.0045,6,40,Math.PI*1.05),hairMat,"cornrow");
        row.rotation.set(0,Math.PI/2,Math.PI*.02);row.position.set(i*.018,.03,-.01);row.scale.set(1,1.2,.95);face.add(row);
      }
    }
    if(style==="ponytail"||style==="bun"){
      const tie=group("tie",face,0,.06,-.104);
      if(style==="bun"){tie.add(mesh(new T.SphereGeometry(.038,16,12),hairMat,"bun"));}
      else{
        tie.rotation.x=.5;
        tie.add(mesh(loft([{y:0,w:.05,d:.05},{y:-.06,w:.058,d:.05},{y:-.16,w:.04,d:.035},{y:-.22,w:.02,d:.02}],{seg:14}),hairMat,"ponytail"));
      }
    }
    // 胡子
    const beard=star.beardStyle||"none";
    if(star.beard&&beard!=="none"&&beard!=="stubble"){
      const bg=headGeometry(),bp=bg.attributes.position;
      for(let i=0;i<bp.count;i++){
        v.fromBufferAttribute(bp,i);
        // 下颌区域做软边；嘴周留空
        const mouth=smooth(1-Math.abs(v.y+.48)/.2)*smooth(1-Math.abs(v.x)/.32)*smooth((v.z-.45)/.15);
        const jaw=smooth((-.2-v.y)/.12)*smooth((v.z+.2)/.15)*(1-mouth);
        const tgt=beard==="full"?1.05:beard==="goatee"?(Math.abs(v.x)<.35&&v.z>.3?1.04:.98):1.012;
        const k=lerp(.98,tgt,jaw);
        bp.setXYZ(i,v.x*k,v.y*k,v.z*k);
      }
      bg.computeVertexNormals();
      const bm=mesh(bg,beard==="stubble"?std(star.beard,.95,{transparent:true,opacity:.3,depthWrite:false}):std(star.beard,.85),"beard");
      onSkull(bm);face.add(bm);
    }
  }

  /* 球鞋：复用游戏里验收过的鞋款模块，按球星选鞋款配色，缩放到 30cm 脚长 */
  function buildShoe(ankle,star,sx){
    const holder=group("shoe",ankle,0,-.045,.035);
    try{
      const cw=global.AIBAShoeColorways&&AIBAShoeColorways.forStar(star);
      // 与 basketball-shoes.js 同一分流：扩展鞋款走 AIBAShoeStyles，内置 RetroHigh 走 createBasketballShoe
      const known=cw&&global.AIBAShoeStyles&&AIBAShoeStyles.families.includes(cw.family);
      const shoe=known?AIBAShoeStyles.build(cw.family,{colorway:cw.colorway}):
        (global.AIBARetroHigh?AIBARetroHigh.createBasketballShoe(cw?{colorway:cw.colorway}:{}):null);
      if(shoe){
        const box=new T.Box3().setFromObject(shoe),size=box.getSize(new T.Vector3());
        const k=.345/Math.max(size.z,1e-3);   // 风格化球员鞋要比真实比例大一号才压得住画面
        shoe.scale.setScalar(k);
        box.setFromObject(shoe);
        shoe.position.set(-(box.min.x+box.max.x)/2,-box.min.y-.03,-(box.min.z+box.max.z)/2+.03);
        shoe.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
        holder.add(shoe);return shoe;
      }
    }catch(e){console.warn("[character-next] shoe",e);}
    const fallback=mesh(loft([{y:-.03,w:.1,d:.3},{y:.05,w:.105,d:.28}]),std(0xf2f2f2,.4),"shoeFallback");
    holder.add(fallback);return fallback;
  }

  /* ---------- 姿势 ----------
     关节角（弧度）。上臂 / 大腿沿 -Y 挂，绕 x 取负 = 往前抬。
     arms[0] 是右臂（投篮手，位于 -x），arms[1] 左臂（辅助手）。 */
  const POSES={
    stand:{hips:{y:0},spine:{x:.02},chest:{x:-.02},neck:{x:.02},
      arms:[{s:[.05,0,-.1],e:[-.18,0,0],w:[0,0,.05]},{s:[.05,0,.1],e:[-.18,0,0],w:[0,0,-.05]}],
      legs:[{h:[.02,0,-.03],k:[.05,0,0],a:[-.04,0,0]},{h:[.02,0,.03],k:[.05,0,0],a:[-.04,0,0]}]},
    threat:{hips:{y:-.1},spine:{x:.12},chest:{x:.14},neck:{x:-.18},
      arms:[{s:[-.55,.2,-.35],e:[-1.35,0,0],w:[.1,0,.1]},{s:[-.7,-.3,.3],e:[-1.15,0,0],w:[0,0,-.3]}],
      legs:[{h:[-.62,0,-.12],k:[1.05,0,0],a:[-.42,0,0]},{h:[-.5,0,.12],k:[.95,0,0],a:[-.42,0,0]}],ball:"hip"},
    set:{hips:{y:-.05},spine:{x:.02},chest:{x:-.05},neck:{x:-.02},
      arms:[{s:[-2.25,-.1,-.2],e:[-1.75,0,0],w:[1.2,0,0]},{s:[-2.1,.45,.35],e:[-1.35,0,0],w:[.1,0,-.9]}],
      legs:[{h:[-.3,0,-.05],k:[.55,0,0],a:[-.22,0,0]},{h:[-.25,0,.05],k:[.5,0,0],a:[-.22,0,0]}],ball:"set"},
    release:{hips:{y:.22},spine:{x:-.02},chest:{x:-.08},neck:{x:-.2},
      arms:[{s:[-2.75,-.05,-.12],e:[-.08,0,0],w:[1.25,0,0]},{s:[-2.35,.35,.3],e:[-.55,0,0],w:[.2,0,-.6]}],
      legs:[{h:[.05,0,-.04],k:[.12,0,0],a:[.55,0,0]},{h:[.18,0,.04],k:[.3,0,0],a:[.5,0,0]}],ball:"release"},
    hold:{hips:{y:0},spine:{x:.03},chest:{x:-.02},neck:{x:-.22},
      arms:[{s:[-2.7,-.05,-.12],e:[-.12,0,0],w:[1.5,0,0]},{s:[-2.2,.3,.3],e:[-.4,0,0],w:[.2,0,-.5]}],
      legs:[{h:[-.12,0,-.04],k:[.25,0,0],a:[-.1,0,0]},{h:[-.1,0,.04],k:[.22,0,0],a:[-.1,0,0]}],ball:"gone",ik:"follow"}
  };
  function setPose(api,name,k){
    const P=POSES[name]||POSES.stand,R=api.rig;
    const apply=(node,e,base)=>{node.rotation.set(lerp(0,e[0],k),lerp(0,e[1],k),lerp(0,e[2],k));};
    R.hips.position.y=1.02+(P.hips.y||0)*k;
    R.spine.rotation.set((P.spine.x||0)*k,0,0);
    R.chest.rotation.set((P.chest.x||0)*k,0,0);
    R.neck.rotation.set((P.neck.x||0)*k,0,0);
    R.arms.forEach((a,i)=>{const p=P.arms[i];apply(a.shoulder,p.s);apply(a.elbow,p.e);apply(a.wrist,p.w);});
    R.legs.forEach((l,i)=>{const p=P.legs[i];apply(l.thigh,p.h);apply(l.knee,p.k);apply(l.ankle,p.a);});
    api.ballMode=P.ball||"none";api.ikMode=P.ik||null;
  }

  /* 两段式手臂 IK：肩 → 肘 → 腕到达世界坐标 target，肘朝 pole 方向弯；
     finger / palm 给定时再把手掌摆成指尖朝 finger、掌心朝 palm（手的本地系：指尖 -y，掌心 +z）。
     用欧拉角硬凑持球姿势，球总会穿进头或悬在两手之间（首版举球姿势球压在头顶上）。 */
  const _v=()=>new T.Vector3(),_q=()=>new T.Quaternion();
  function aimLocal(node,dirWorld){
    // 让 node 的本地 -y 指向 dirWorld
    const pq=_q();node.parent.getWorldQuaternion(pq);
    const d=dirWorld.clone().normalize().applyQuaternion(pq.invert());
    node.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),d);node.updateMatrixWorld(true);
  }
  function reach(api,i,target,pole,finger,palm){
    const a=api.rig.arms[i];
    a.shoulder.rotation.set(0,0,0);a.elbow.rotation.set(0,0,0);a.wrist.rotation.set(0,0,0);
    api.root.updateMatrixWorld(true);
    const S=a.shoulder.getWorldPosition(_v()),E0=a.elbow.getWorldPosition(_v()),W0=a.wrist.getWorldPosition(_v());
    const L1=S.distanceTo(E0),L2=E0.distanceTo(W0);
    const toT=target.clone().sub(S);let d=clamp(toT.length(),Math.abs(L1-L2)+1e-3,L1+L2-1e-3);
    const dir=toT.normalize();
    // 余弦定理求肩角，肘点在 dir 与 pole 张成的平面内
    const cosA=clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1),sinA=Math.sqrt(1-cosA*cosA);
    const pv=pole.clone().sub(S);pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
    const E=S.clone().add(dir.clone().multiplyScalar(cosA*L1)).add(pv.multiplyScalar(sinA*L1));
    aimLocal(a.shoulder,E.clone().sub(S));
    const Wt=S.clone().add(dir.clone().multiplyScalar(d));
    aimLocal(a.elbow,Wt.sub(E));
    if(finger&&palm){
      const y=finger.clone().normalize().negate(),z=palm.clone().normalize();
      z.sub(y.clone().multiplyScalar(z.dot(y))).normalize();
      const x=_v().crossVectors(y,z);
      const wq=_q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
      const pq=_q();a.wrist.parent.getWorldQuaternion(pq);
      a.wrist.quaternion.copy(pq.invert().multiply(wq));a.wrist.updateMatrixWorld(true);
    }
  }
  /* 持球姿势：球心按身体朝向放，双手用 IK 贴到球面上 */
  function holdBall(api,mode,r){
    const root=api.root;root.updateMatrixWorld(true);
    const head=api.rig.head.getWorldPosition(_v()),chest=api.rig.chest.getWorldPosition(_v());
    const fwd=new T.Vector3(0,0,1).transformDirection(root.matrixWorld),up=new T.Vector3(0,1,0),side=_v().crossVectors(up,fwd);  // side = 身体左侧
    let C;
    if(mode==="set"){
      C=head.clone().addScaledVector(up,.25).addScaledVector(fwd,.2).addScaledVector(side,-.07);
      // 投篮手（arms[0]，右）托在球下后方，指尖朝上后；辅助手（左）贴球侧面
      reach(api,0,C.clone().addScaledVector(up,-r*.95).addScaledVector(fwd,-r*.35).addScaledVector(side,-.02),
        C.clone().addScaledVector(up,-.6).addScaledVector(side,-.35).addScaledVector(fwd,.15),
        up.clone().addScaledVector(fwd,-.55),up.clone().addScaledVector(fwd,.35));
      reach(api,1,C.clone().addScaledVector(side,r*1.08).addScaledVector(up,-.05),
        C.clone().addScaledVector(up,-.5).addScaledVector(side,.5),
        up.clone().addScaledVector(fwd,.2),side.clone().negate());
    }else if(mode==="hip"){
      C=chest.clone().addScaledVector(up,-.22).addScaledVector(fwd,.24).addScaledVector(side,-.12);
      reach(api,0,C.clone().addScaledVector(fwd,-r*.9).addScaledVector(up,.02),
        C.clone().addScaledVector(fwd,-.5).addScaledVector(side,-.3),
        fwd.clone().addScaledVector(up,-.2),fwd.clone());
      reach(api,1,C.clone().addScaledVector(fwd,r*.4).addScaledVector(up,r*.95),
        C.clone().addScaledVector(side,.5).addScaledVector(up,.1),
        fwd.clone().addScaledVector(side,-.4),up.clone().negate());
    }else if(mode==="follow"){
      // 随挥定格：投篮臂向前上方伸直、手腕下压成"鹅颈"；辅助手竖在头侧、掌心朝内
      const sR=api.rig.arms[0].shoulder.getWorldPosition(_v()),sL=api.rig.arms[1].shoulder.getWorldPosition(_v());
      reach(api,0,sR.clone().addScaledVector(up,.47).addScaledVector(fwd,.34).addScaledVector(side,.06),
        sR.clone().addScaledVector(fwd,-.3).addScaledVector(side,-.3),
        fwd.clone().addScaledVector(up,-.85),up.clone().negate().addScaledVector(fwd,-.3));
      reach(api,1,sL.clone().addScaledVector(up,.42).addScaledVector(fwd,.2).addScaledVector(side,-.04),
        sL.clone().addScaledVector(side,.5).addScaledVector(up,-.2),
        up.clone().addScaledVector(fwd,.15),side.clone().negate());
    }
    return C?root.worldToLocal(C):null;
  }

  global.AIBACharacterNext=Object.freeze({build,loft,POSES,headGeometry});
})(window);
