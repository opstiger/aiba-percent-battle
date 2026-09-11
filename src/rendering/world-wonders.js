/* P1 environments. Helpers supplied by world-places own batching and disposal.
   No gameplay coordinate changes; all animated resources remain under s.root. */
(()=>{
  const palettes={
    arcticSnow:{ground:"#becbd0",field:"#35464f",key:"#2a3945",line:"#dddeda",shirts:[0x40556a,0xb57351,0x667c76,0xd4c7aa,0x444756,0x864f46,0x6e818d,0xb5b9af]},
    spanishQuarter:{ground:"#a6947b",field:"#ad6248",key:"#944c39",line:"#e9d9af",shirts:[0xe2d6bb,0x8a4638,0x75877e,0xc09d6a,0x3f5665,0xede4ce,0xad7654,0x648690]}
  };
  function arctic(s,b,{batch}){
    // A real vertical separation prevents the grading RT's 16-bit depth from
    // interleaving the snow sheet with the playable plane in elevated views.
    b.box(0xbbcbd3,0,-.4,0,220,.25,210);
    // A dark, swept playing rectangle sits in deep snow. No ice physics.
    for(let side of [-1,1])for(let i=0;i<18;i++){
      const z=-16+i*2.7,x=side*(9.6+s.r()*2.1);b.add("blob",i%2?0xc6d7df:0xa3bbc9,x,.05+s.r()*.12,z,1.7+s.r(),.23+s.r()*.4,1.5+s.r());
    }
    for(let i=0;i<15;i++)b.add("blob",0xc4d2d6,-19+i*2.8,.15,-15.6-s.r()*3,2.1,.3+s.r()*.25,1.5);
    b.box(0x728f9d,0,-.045,-43,85,.06,43); // frozen lake, behind the near hoop
    for(let i=0;i<22;i++)b.box(0x8ba8b4,-36+s.r()*72,-.007,-24-s.r()*38,4+s.r()*12,.012,.04+s.r()*.07,0,s.r());
    // Sparse foreground trees and an irregular, low distant treeline keep the sky open.
    const pine=(x,z,h,dynamic=false)=>{
      const crown=dynamic?batch():b,pivot=dynamic?new THREE.Group():null;
      b.box(0x494d4a,x,h*.4,z,.22,h*.8,.23);
      if(pivot){pivot.position.set(x,h*.22,z);s.root.add(pivot);}
      for(let k=0;k<4;k++){
        const r=h*(.2-k*.031),y=h*(.3+k*.17);
        crown.add("cone",k%2?0x354e4d:0x293d3e,pivot?0:x,pivot?y-h*.22:y,pivot?0:z,r,h*.38,r,0,k*.6);
        // One exposed snowy tip; stacked white cones intersect the next green
        // tier and make distracting triangular slivers in distant views.
        if(k===3)crown.add("cone",0xb0c8d1,pivot?0:x,(pivot?y-h*.22:y)+h*.13,pivot?0:z,r*.8,h*.18,r*.8,0,k*.6);
      }
      if(pivot){crown.finish(pivot,"snowPineCanopy");s.plants.push({pivot,phase:s.r()*6,amp:.009});}
    };
    for(let i=0;i<(s.mobile?34:56);i++)pine(-70+i*(s.mobile?4.2:2.6),-68-s.r()*14,3+s.r()*6);
    for(let side of [-1,1])for(let i=0;i<4;i++)pine(side*(17+s.r()*7),-12+i*12,4+s.r()*3,i===1);
    // One small shelter at the side, not a village or stadium.
    b.box(0x67564b,17,1.5,11,5,3,4);
    for(let dir of [-1,1]){b.box(0x58616a,17+dir*1.4,3.35,11,3.3,.18,5.3,0,0,-dir*.36);b.box(0xc9d8dc,17+dir*1.4,3.49,11,3.3,.13,5.4,0,0,-dir*.36);}
    b.box(0x313b40,14.46,1.15,11,.12,2.3,1.1);
    const warm=batch();warm.box(0xe0b77b,14.38,1.9,12.2,.045,.65,.7);warm.finish(s.root,"snowShelterWindow",true);
    const auroras=[];
    for(let i=0;i<2;i++){
      const geo=new THREE.PlaneGeometry(123,20,64,10);
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{time:{value:0},phase:{value:i*2.3},tint:{value:new THREE.Color(i?0x5689a0:0x64d9a0).convertSRGBToLinear()}},
        vertexShader:`varying vec2 vUv;uniform float time;uniform float phase;
          void main(){vUv=uv;vec3 p=position;
            p.y+=sin(uv.x*8.0+phase+time*.09)*3.1+sin(uv.x*17.0-time*.06)*1.1;
            p.z+=sin(uv.x*10.0+phase+time*.07)*5.0;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
        fragmentShader:`varying vec2 vUv;uniform float time;uniform float phase;uniform vec3 tint;
          void main(){float fibers=.72+.28*sin(vUv.x*330.0+sin(vUv.x*29.0+time*.11)*3.0);
            float edge=smoothstep(0.0,.12,vUv.x)*(1.0-smoothstep(.82,1.0,vUv.x));
            float veil=smoothstep(0.0,.09,vUv.y)*exp(-vUv.y*3.7);
            float pulse=.77+.15*sin(vUv.x*7.0+time*.14+phase);
            vec3 color=mix(tint,vec3(.24,.13,.29),smoothstep(.25,.95,vUv.y));
            gl_FragColor=vec4(color*1.35,edge*veil*fibers*pulse*.75);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`});
      const mesh=new THREE.Mesh(geo,mat);mesh.position.set(i?12:-7,22+i*9,-61-i*12);mesh.name="auroraCurtain";mesh.frustumCulled=false;s.root.add(mesh);auroras.push(mesh);
    }
    const count=s.mobile?64:112,positions=new Float32Array(count*3),base=new Float32Array(count*3),speed=new Float32Array(count);
    for(let i=0;i<count;i++){base[i*3]=(s.r()-.5)*36;base[i*3+1]=s.r()*15;base[i*3+2]=-17+s.r()*45;speed[i]=.28+s.r()*.28;}
    positions.set(base);const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
    const snow=new THREE.Points(geo,new THREE.PointsMaterial({color:0xc9dde7,size:.042,transparent:true,opacity:.55,depthWrite:false}));snow.name="lightSnowfall";snow.frustumCulled=false;s.root.add(snow);
    s.wonder={kind:"arctic",auroras,snow,base,speed};
  }
  /* ---------------- 西班牙老街:从老街建筑里留出来的一块球场 ----------------
     计划 §B:把原来 12 栋各自独立的房子重组成不规则 U 形街区、局部共墙;
     首层前移到边线外约 5.6m,三四层向后错开到 |x|≥20 —— 既是"近低远高"的错层,
     也避开菜单环绕机位 (18cos a, 8, 4.745+20 sin a) 那圈只有 8m 高的椭圆:
     椭圆内的屋脊必须压在 6.4m 以下,否则菜单转到侧面会直接从屋顶里穿过去。
     旧版每栋四面全裸、楼间空隙直通天空,读起来是"广场里的独立展品"而不是老街。 */
  const ES={
    wall:[0xcbb083,0xd9cbaf,0xb28362,0xe2d7bb,0xbe9a70,0xc7a878],
    tile:[0xb0563a,0x9c4a34,0xc06a45],
    shut:[0x4d6659,0x6b5236,0x59493a,0x4a5b66],
    iron:0x39403c,
    plinth:0x9b8b72,
    dark:0x2f2b26
  };
  /* 一个开间。相邻开间共墙,楼层数、墙色、百叶窗颜色、阳台有无按住户变化,
     不是同一套立面复制粘贴(计划 §B"窗户开合和阳台物品按住户变化")。 */
  function casa(s,put,wput,cx,w,i,floors){
    const D=7.4,g=3.25,f=2.6,wallH=g+floors*f,wall=ES.wall[i%6],tile=ES.tile[i%3],shut=ES.shut[i%4];
    put(wall,cx,wallH/2,-D/2,w,wallH,D);                        // 主体(与邻居共墙)
    put(ES.plinth,cx,.42,.09,w,.84,.2);                          // 墙裙:墙和铺装之间要有交代
    put(ES.plinth,cx,.1,.3,w,.2,.66);
    // 一层:门洞 + 一扇朝街的窗;门洞用两级退台做出拱的味道,不上真圆拱
    put(ES.dark,cx-w*.18,1.28,.07,1.24,2.56,.14);
    put(wall,cx-w*.18,2.62,.1,1.02,.16,.16);
    put(ES.shut[(i+1)%4],cx-w*.18,1.2,.13,1.06,2.4,.07);
    if(w>3.6){
      put(ES.dark,cx+w*.24,1.72,.07,1.16,1.32,.12);
      for(let k=0;k<4;k++)put(ES.iron,cx+w*.24-.48+k*.32,1.72,.14,.045,1.28,.05);
      put(ES.plinth,cx+w*.24,1,.18,1.34,.14,.34);
    }
    put(ES.plinth,cx,g-.08,.1,w,.18,.24);                        // 层间线脚
    for(let fl=0;fl<floors;fl++){
      const y=g+fl*f+f*.5,open=(i+fl)%5!==2;                     // 少数住户关着百叶
      put(ES.dark,cx,y,.07,w*.42,1.62,.12);
      put(open?ES.dark:shut,cx,y,.13,w*.36,1.5,.05);
      for(const sd of [-1,1]){
        put(shut,cx+sd*(w*.24),y,.16,w*.14,1.58,.1);             // 百叶窗扇
        for(let k=0;k<6;k++)put(ES.plinth,cx+sd*(w*.24),y-.62+k*.24,.22,w*.12,.045,.05);
      }
      if(fl===0||((i+fl)%3===0)){                                // 阳台:不是每层每户都有
        put(ES.plinth,cx,y-.86,.5,w*.66,.16,1.05);
        for(let k=0;k<7;k++)put(ES.iron,cx-w*.2+k*(w*.4/6),y-.42,.98,.045,.78,.05);
        put(ES.iron,cx,y-.05,.98,w*.42,.05,.06);
        if((i+fl)%2===0){                                        // 有人种花,有人堆杂物
          put(0xa5613f,cx+w*.16,y-.62,.62,.24,.24,.24);
          put(0x537154,cx+w*.16,y-.4,.62,.34,.22,.28);
          put((i%2)?0xc4667a:0xdb8a5e,cx+w*.16,y-.28,.62,.2,.12,.18);
        }else put(ES.shut[(i+2)%4],cx-w*.14,y-.62,.6,.5,.26,.34);
      }
      if((i+fl)%4===1)wput(0xc99a5e,cx,y,.15,w*.34,1.44,.04);    // 零星亮着的窗
    }
    // 檐口 + 出挑到街上的瓦顶;瓦条只做朝街这一面
    put(ES.plinth,cx,wallH+.1,.16,w+.16,.2,.38);
    put(tile,cx,wallH+.42,-D*.28,w+.34,.2,D*.56+1.3,.2);
    put(tile,cx,wallH+.42,-D*.76,w+.34,.2,D*.5+.4,-.2);
    /* ⚠ 瓦条必须压在屋面板上:第一版给的是 lz=1.0/进深 2.1,比屋面前沿多伸出 1.4m,
       从菜单环绕(y=8,几乎贴着屋脊飞过)看过去就是一排悬空的橘色木条。 */
    for(let k=0;k<Math.ceil(w/.42);k++)put(tile===0xb0563a?0xc06a45:0xb0563a,cx-w/2+.21+k*.42,wallH+.5,-1.6,.24,.14,4.4,.2);
    put(tile,cx,wallH+.62,-D/2,w+.36,.18,.5);
  }
  /* 连续一段老街:开间不等宽但首尾相接,层数按组团起伏。 */
  function casaRun(s,put,wput,x0,x1,seed,floors){
    const span=x1-x0,n=Math.max(1,Math.round(span/4.2)),ws=[];let tot=0;
    for(let i=0;i<n;i++){const t=.74+s.r()*.52;ws.push(t);tot+=t;}
    let x=x0;
    for(let i=0;i<n;i++){
      const w=span*ws[i]/tot,fl=Array.isArray(floors)?floors[(seed+i)%floors.length]:floors;
      casa(s,put,wput,x+w/2,w,seed+i,fl);x+=w;
    }
  }
  /* 拱道:开口只在一层,楼照常从上面跨过去 —— 计划 §B 要求"出口后还有一段墙和屋顶",
     所以不是把一段楼拿掉,而是把它架起来;方拱分两级退台,和体素风一致。 */
  function archway(s,put,x0,x1,i,floors){
    const w=x1-x0,cx=(x0+x1)/2,D=7.4,g=3.25,f=2.6,wallH=g+floors*f,wall=ES.wall[i%6],tile=ES.tile[i%3];
    put(wall,cx,(wallH+g)/2,-D/2,w,wallH-g,D);
    for(const sd of [-1,1])put(wall,cx+sd*(w/2-.42),g/2,-D/2,.84,g,D);      // 两侧墩
    put(wall,cx,g-.28,-D/2,w-1.68,.56,D);                                    // 拱腹一级
    put(wall,cx,g-.72,-D/2,w-2.5,.32,D);                                     // 拱腹二级
    put(ES.plinth,cx,g-.02,.12,w,.2,.26);
    for(let fl=0;fl<floors;fl++){
      const y=g+fl*f+f*.5;
      put(ES.dark,cx,y,.07,w*.3,1.5,.12);
      put(ES.shut[(i+fl)%4],cx,y,.14,w*.26,1.4,.06);
    }
    put(ES.plinth,cx,wallH+.1,.16,w+.16,.2,.38);
    put(tile,cx,wallH+.42,-D*.28,w+.34,.2,D*.56+1.3,.2);
    put(tile,cx,wallH+.42,-D*.76,w+.34,.2,D*.5+.4,-.2);
    put(tile,cx,wallH+.62,-D/2,w+.36,.18,.5);
    put(0x241f1b,cx,1.5,-D/2,w-1.9,3,D-.4);                                  // 洞里是暗的,读得出"能走过去"
  }
  /* 后排组团:只做体量与瓦顶,负责在首排屋顶之上叠出老街的第二、第三层高度。 */
  function esBlock(put,x0,x1,h,i){
    const cx=(x0+x1)/2,w=x1-x0,D=9.5,tile=ES.tile[i%3];
    put(ES.wall[i%6],cx,h/2,-D/2,w,h,D);
    for(let fl=0;fl<Math.floor((h-1.6)/2.7);fl++)for(let k=0;k<Math.max(1,Math.round(w/3.4));k++){
      const bx=cx-w/2+w*(k+.5)/Math.max(1,Math.round(w/3.4));
      put(ES.dark,bx,2.2+fl*2.7,.06,1.05,1.42,.1);
      put(ES.shut[(i+fl+k)%4],bx,2.2+fl*2.7,.12,.92,1.3,.05);
    }
    put(tile,cx,h+.42,-D*.26,w+.34,.2,D*.52+.9,.2);
    put(tile,cx,h+.42,-D*.76,w+.34,.2,D*.5+.5,-.2);
    put(tile,cx,h+.62,-D/2,w+.38,.18,.5);
  }
  function spanish(s,b,{batch,tree,facing}){
    const warm=batch(),FACE=13.2,BACK=-16.6,FRONT=27.4;
    b.box(0x8d7d66,0,-.4,2,130,.15,138);                        // 干燥的土色底
    /* 场外分带(计划 §2.2):7.62~10.8 老混凝土/石板缓冲 → 10.8~11.3 路缘
       → 11.3~13.2 抬高 0.19 的门前步道 → 13.2 立面。不再是一整片空广场。 */
    for(const side of [-1,1]){
      b.box(0x8f8067,side*11.05,.03,5.4,.5,.24,44);              // 路缘
      b.box(0xb5a58a,side*12.3,.06,5.4,2,.26,44);                // 门前步道
    }
    b.box(0xa4947b,0,-.05,-14.9,30,.1,3.8);                     // 球场贴图只到 z=-13
    b.box(0xa4947b,0,-.05,25.2,30,.1,4.6);
    // ① 背街:篮筐正后方的连续立面,中间留一条向上的台阶巷
    const backPut=facing(b,0,BACK,0),backWarm=facing(warm,0,BACK,0);
    casaRun(s,backPut,backWarm,-23,-.4,0,[1,1,0]);
    casaRun(s,backPut,backWarm,5.6,16.4,11,[1,0,1]);
    /* 節点 2:转角小咖啡店 —— 在巷口拐角,门前有遮阳棚和两组桌椅。 */
    (()=>{
      const x0=-.4,x1=2.5,cx=(x0+x1)/2,w=x1-x0;
      backPut(0xd9cbaf,cx,2.9,-3.7,w,5.85,7.4);
      backPut(ES.dark,cx,1.5,.07,w-.55,3,.13);
      backWarm(0xc99a5e,cx,2.1,.15,w-.8,1.6,.06);
      backWarm(0x8a6a3f,cx,.02,1.6,w-.2,.05,2.8);                // 灯光洒到铺装上
      backPut(0x8d5a44,cx,3.36,1.15,w+.3,.16,2.5,.22);           // 遮阳棚
      for(let k=0;k<5;k++)backPut(k%2?0xe4dcc6:0x8d5a44,cx-w/2+.35+k*.6,3.24,2.32,.52,.22,.14);
      backPut(0x59493a,cx,4.35,.08,w,.72,.16);                   // 招牌
      backPut(ES.plinth,cx,5.9,.16,w+.16,.2,.38);
      backPut(ES.tile[0],cx,6.22,-2,w+.34,.2,5.4,.2);
      backPut(ES.tile[0],cx,6.22,-5.6,w+.34,.2,4.2,-.2);
      backPut(ES.tile[0],cx,6.42,-3.7,w+.36,.18,.5);
      for(const [tx,tz] of [[-1.1,2.9],[1.9,3.3]]){              // 门前桌椅
        backPut(0x6b5236,tx,.72,tz,.86,.08,.86);
        backPut(0x6b5236,tx,.36,tz,.12,.72,.12);
        for(const [ox,oz] of [[-.78,0],[.78,.2]]){
          backPut(0x4d6659,tx+ox,.46,tz+oz,.42,.07,.42);
          backPut(0x4d6659,tx+ox,.74,tz+oz-.2,.42,.62,.07);
        }
      }
    })();
    /* 台阶巷:向 -z 一路抬高,尽头是拱门和更高的一段墙 —— 视线有终点,不会一眼穿到世界尽头。 */
    /* 台阶巷:巷子里没有直射光,石头要压暗一档,否则从球场看过去是一大片发白的楼梯。 */
    for(let k=0;k<10;k++)b.box(k%2?0x8b7f69:0x968a73,4.05,.05+k*.15,-17.4-k*1.02,2.7,.32+k*.3,1.02);
    for(const [wx,dir] of [[2.42,1],[5.68,-1]]){
      b.box(0xc5aa80,wx,4.6,-22,.5,9.2,11.4);
      b.box(ES.tile[1],wx+dir*.55,9.35,-22,1.3,.18,11.6,0,0,dir*.24);
    }
    /* 巷尾:拱门 + 一盏灯。暖光必须画在暗龛的**前面**,否则被龛体自己挡住,
       画面上只剩一块黑板子。 */
    b.box(0x241f1b,4.05,4.5,-27.4,2.4,4.4,1.2);                 // 巷尾拱门
    b.box(0xc5aa80,4.05,7,-27.3,3.6,.8,1.5);
    warm.box(0xb1854c,4.05,3.6,-26.74,1.2,2.2,.06);
    warm.box(0xd0a05e,2.98,5.1,-26.7,.24,.4,.24);
    // ② 后排组团:老街的第二、第三层高度,在首排瓦顶之上叠出来
    const midPut=facing(b,0,-26.4,0);
    [[-24,-16.4,11.4],[-16.4,-9,13.6],[-9,-2.4,10.2],[6.2,13,12.8],[13,20,10.6]]
      .forEach(([a,c,h],i)=>esBlock(midPut,a,c,h,i));
    const farPut=facing(b,0,-37,0);
    [[-22,-12,15],[-12,-1,17.5],[-1,9,14],[9,19,16.5]].forEach(([a,c,h],i)=>esBlock(farPut,a,c,h,i+3));
    /* ③ 两侧首排:立面收到边线外 5.6m,只有两处开口,而且都是"从楼下面穿过去"。 */
    const leftPut=facing(b,-FACE,0,Math.PI/2),leftWarm=facing(warm,-FACE,0,Math.PI/2);
    casaRun(s,leftPut,leftWarm,-20,-9.6,17,[1,0,1]);            // 世界 z 20 → 9.6
    archway(s,leftPut,-9.6,-6.4,23,1);                           // 世界 z 9.6 → 6.4:拱道
    casaRun(s,leftPut,leftWarm,-6.4,8.2,24,[1,1,0]);             // 主立面
    casaRun(s,leftPut,leftWarm,11.4,16.6,31,[0,1]);
    const rightPut=facing(b,FACE,0,-Math.PI/2),rightWarm=facing(warm,FACE,0,-Math.PI/2);
    casaRun(s,rightPut,rightWarm,-16.6,-4.2,35,[1,0,1]);
    archway(s,rightPut,-4.2,-1.2,41,1);
    casaRun(s,rightPut,rightWarm,-1.2,12,42,[0,1,1]);
    // ④ 场后端:低一档的背面街区,收住菜单环绕的另一半
    const frontPut=facing(b,0,FRONT,Math.PI),frontWarm=facing(warm,0,FRONT,Math.PI);
    casaRun(s,frontPut,frontWarm,-15,-2.6,47,[0,1]);
    casaRun(s,frontPut,frontWarm,1.4,15,52,[1,0]);
    // 侧后方组团:高体量只能放在菜单椭圆之外(|x|≥20)
    const leftBack=facing(b,-21.2,0,Math.PI/2),rightBack=facing(b,21.2,0,-Math.PI/2);
    [[-18,-9.5,11],[-9.5,-1,13.4],[-1,7,10.4],[7,15,12.2]].forEach(([a,c,h],i)=>esBlock(leftBack,a,c,h,i+1));
    [[-15,-6.5,12.6],[-6.5,2,10.2],[2,10,13.8],[10,17,11]].forEach(([a,c,h],i)=>esBlock(rightBack,a,c,h,i+4));
    /* ⑤ 拱道下的通道地面 + 台阶巷入口的踏步 —— 玩家从哪儿进场是看得见的。 */
    for(const [ax,az,dir] of [[-15.5,8,-1],[15.5,-2.7,1]]){
      for(let k=0;k<4;k++)b.box(0xb0a289,ax+dir*k*.9,.07+k*.12,az,.9,.14+k*.24,3);
      b.box(0x8f8065,ax+dir*3.2,.5,az,2.6,1,3.2);
    }
    b.box(0xb0a289,0,.05,-14.6,7,.1,4.4);                       // 巷口前的平台
    /* 節点 1:老树 + 石凳。树种在步道外侧的树池里,离球场 11.6m,不进跑动区和镜头路径。 */
    tree(s,b,-12.1,-4.6,"street",1.2);
    b.box(0x8f8065,-12.1,.17,-4.6,2,.34,2);                     // 树池:石凳由人群系统摆在两侧
    b.box(0x6f6250,-12.1,.36,-4.6,1.4,.2,1.4);
    tree(s,b,12.6,6.4,"street",1.05);
    b.box(0x8f8065,12.6,.17,6.4,1.8,.34,1.8);
    /* 節点 3:通往住家的短阶 —— 三级石阶接到 +x 那侧的一户门口。 */
    for(let k=0;k<3;k++)b.box(0xc0b193,12.05+k*.36,.1+k*.16,2.4,.36,.2+k*.32,2.1);
    b.box(0xa3927a,12.5,.62,1.25,1.5,1.24,.24);
    b.box(0xa3927a,12.5,.62,3.55,1.5,1.24,.24);
    // 花盆成组靠墙,不是每扇窗配一盆(计划 §B)
    for(const [px,pz,n] of [[-12.7,1.2,4],[-12.7,-8.6,3],[12.75,-6.6,4],[12.75,10.4,3]])
      for(let k=0;k<n;k++){
        const z=pz+k*.62,scale=.8+((k*7)%3)*.14;
        b.box(0xa5613f,px,.19+.3*scale,z,.42*scale,.6*scale,.42*scale);
        b.add("blob",0x537154,px,.52+.34*scale,z,.34*scale,.3*scale,.34*scale);
        b.add("blob",k%2?0xc4667a:0xdb8a5e,px,.7+.34*scale,z,.16*scale,.14*scale,.16*scale);
      }
    /* 晾衣跨过两条侧巷与拱道 —— 计划 §B。s.plants 里的风摆枢轴也靠它们提供。 */
    for(const [lx,ly,lz,along] of [[-13.9,5.2,8,"z"],[13.9,5.2,-2.7,"z"],[4.05,6.4,-19.5,"x"],[-13.9,5.6,-3.4,"z"],[13.9,5.4,6.2,"z"]]){
      const wash=new THREE.Group();wash.position.set(lx,ly,lz);s.root.add(wash);const cloth=batch();
      const L=3.2;
      cloth.box(0x6b6152,0,0,0,along==="x"?L:.03,.03,along==="x"?.03:L);
      for(let j=0;j<4;j++){
        const o=-L*.32+j*(L*.21);
        cloth.box([0xd8ccb0,0x9caab0,0xc08a66,0x6c8880][j],along==="x"?o:0,-.36,along==="x"?0:o,.56,.72,.04);
      }
      cloth.finish(wash,"hangingLaundry");s.plants.push({pivot:wash,phase:s.r()*6,amp:.03});
    }
    // 阳台上偶尔看一眼的居民(计划 §B"观众来自不同高度")
    for(const [ox,oy,oz,rot] of [[-13.05,6.35,3.2,Math.PI/2],[13.05,9,-9.4,-Math.PI/2],[-1.4,6.3,-16.05,0]]){
      b.box(0xb09277,ox,oy+.34,oz,.3,.42,.3,0,rot,0);
      b.box(0xddd0b6,ox,oy,oz,.4,.44,.26,0,rot,0);
    }
    const glow=warm.finish(s.root,"quarterWarmGlow",true);
    if(glow){glow.material.color.setScalar(.55);s.lights.push({mesh:glow,threshold:.5});}
    s.wonder={kind:"spanish"};
  }
  function build(s,b,helpers){if(s.name==="arcticSnow")arctic(s,b,helpers);else if(s.name==="spanishQuarter")spanish(s,b,helpers);}
  function update(s){
    const w=s.wonder;if(w?.kind!=="arctic")return;
    w.auroras.forEach(mesh=>{mesh.material.uniforms.time.value=s.time;});
    const a=w.snow.geometry.attributes.position.array;
    for(let i=0;i<w.speed.length;i++){const j=i*3;a[j]=w.base[j]+Math.sin(s.time*.15+i)*.65;a[j+1]=((w.base[j+1]-s.time*w.speed[i])%15+15)%15;a[j+2]=w.base[j+2]+Math.sin(s.time*.1+i*.7)*.25;}
    w.snow.geometry.attributes.position.needsUpdate=true;
  }
  window.AIBAWorldWonders={palettes,build,update};
})();
