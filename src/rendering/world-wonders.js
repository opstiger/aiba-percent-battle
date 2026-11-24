/* P1 environments. Helpers supplied by world-places own batching and disposal.
   No gameplay coordinate changes; all animated resources remain under s.root. */
(()=>{
  const palettes={
    arcticSnow:{ground:"#becbd0",field:"#35464f",key:"#2a3945",line:"#dddeda",shirts:[0x40556a,0xb57351,0x667c76,0xd4c7aa,0x444756,0x864f46,0x6e818d,0xb5b9af]},
    spanishQuarter:{ground:"#a6947b",field:"#ad6248",key:"#944c39",line:"#e9d9af",shirts:[0xe2d6bb,0x8a4638,0x75877e,0xc09d6a,0x3f5665,0xede4ce,0xad7654,0x648690]},
    lunarCrater:{ground:"#717479",field:"#717479",key:"#717479",line:"#cfd3d9",shirts:[0xe6e8ec,0xc7ccd4,0x3b82f6,0x9aa0a8]},
    tokyoRooftop:{ground:"#1d222b",field:"#252c38",key:"#b8382c",line:"#eef2f8",shirts:[0xf4f4f6,0x1e293b,0xe11d48,0x38bdf8,0xf59e0b,0x94a3b8]}
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
  function lunarLander(s,batch,terrain){
    const lander=new THREE.Group();lander.name="lunarLander";
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
    terrain.updateWorldMatrix(true,false);
    const floorY=(x,z)=>{
      ray.set(new THREE.Vector3(x,20,z),down);
      return ray.intersectObject(terrain,false)[0].point.y;
    };
    lander.position.set(-17.5,floorY(-17.5,-20.5),-20.5);
    lander.rotation.y=-.22;
    s.root.add(lander);lander.updateWorldMatrix(true,false);

    const shell=batch(),up=new THREE.Vector3(0,1,0),e=new THREE.Euler(),q=new THREE.Quaternion();
    const point=(x,y,z)=>new THREE.Vector3(x,y,z);
    const beam=(color,a,b,width,depth=width)=>{
      const d=b.clone().sub(a),length=d.length(),mid=a.clone().lerp(b,.5);
      e.setFromQuaternion(q.setFromUnitVectors(up,d.normalize()));
      shell.box(color,mid.x,mid.y,mid.z,width,length,depth,e.x,e.y,e.z);
    };
    // One mesh per surface finish. Explicit facets model the angled skin and the insulation folds.
    const panels=()=>{
      const pos=[],colors=[],c=new THREE.Color();
      const triangle=(a,b,c0,tint)=>{
        c.set(tint).convertSRGBToLinear();
        for(const v of [a,b,c0]){pos.push(v.x,v.y,v.z);colors.push(c.r,c.g,c.b);}
      };
      const quad=(a,b,c,d,tint)=>{triangle(a,b,c,tint);triangle(a,c,d,tint);};
      const finish=(name,params)=>{
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
        geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
        geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,...params}));
        mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;lander.add(mesh);
        return mesh;
      };
      return {triangle,quad,finish};
    };
    const outline=[[1,-.55],[1,.5],[.72,1],[-.72,1],[-1,.5],[-1,-.55],[-.62,-1],[.62,-1]];
    const ring=(y,w,d,z=0)=>outline.map(([x,v])=>point(x*w,y,z+v*d));
    const hull=panels(),rows=[ring(3.09,1.22,1.0),ring(3.70,1.58,1.34,.14),ring(4.62,1.52,1.14,.14),ring(5.16,1.00,.86,-.08)];
    const sides=[0xaab0ae,0x858b8e,0xbfc2b9,0x8e9597,0xaeb5b5,0x656d74,0x545d62,0x7b8488];
    for(let r=0;r<rows.length-1;r++)for(let i=0;i<8;i++){
      const j=(i+1)%8;
      hull.quad(rows[r][i],rows[r+1][i],rows[r+1][j],rows[r][j],r===0?0x535758:sides[i]);
    }
    for(let i=0;i<8;i++)hull.triangle(point(0,5.16,-.08),rows[3][(i+1)%8],rows[3][i],0xbfc4c3);
    const window=panels(),frontZ=y=>1.48-(y-3.70)*(.20/.92);
    for(const side of [-1,1]){
      const outline=[[.18,4.43],[.93,4.36],[.80,3.92]];
      if(side===1)outline.reverse();
      const glazed=(scale,offset,tint)=>window.triangle(...outline.map(([x,y])=>{
        const u=.64+(x-.64)*scale,v=4.23+(y-4.23)*scale;
        return point(side*u,v,frontZ(v)+offset);
      }),tint);
      glazed(1,.014,0x323a3e);glazed(.80,.024,0x71949f);glazed(.60,.030,0x263e4a);
    }
    window.finish("lunarLanderWindows",{roughness:.28,emissive:0x385968,emissiveIntensity:.10});
    hull.finish("lunarLanderCabin",{roughness:.54,metalness:.09,emissive:0x697173,emissiveIntensity:.06});
    shell.box(0x50565a,0,3.53,1.43,.78,.41,.12,-.12);
    shell.box(0xb3a992,0,3.58,1.51,.57,.26,.06,-.12);
    shell.box(0x343b40,.25,3.58,1.56,.07,.07,.07);
    shell.box(0xb5b8b5,0,5.21,-.25,1.0,.18,.97);
    shell.box(0x5d676b,0,5.33,-.25,.69,.09,.66);
    for(const side of [-1,1]){
      shell.box(0x363e45,side*1.61,4.07,.31,.43,.43,.44);
      shell.box(0x89928e,side*1.87,4.05,.31,.27,.09,.12);
      shell.box(0x9ca4a2,side*1.36,4.02,-.81,.25,.63,.42);
    }

    const foil=panels(),lower=ring(1.34,1.54,1.48),upper=ring(3.10,1.72,1.68);
    const cols=s.mobile?9:14,rowsOfFoil=s.mobile?5:8,crease=[0xd1a257,0xd7a756,0xd5a859,0xc99747,0xdbad5d];
    for(let i=0;i<8;i++){
      const j=(i+1)%8,edge=lower[j].clone().sub(lower[i]),normal=point(edge.z,0,-edge.x).normalize();
      const fold=(col,row)=>{
        const u0=col/cols,v0=row/rowsOfFoil,belt=Math.sin(u0*Math.PI)*Math.sin(v0*Math.PI);
        const u=u0+belt*.24*Math.sin(col*1.7+row*1.2+i)/cols;
        const v=v0+belt*.27*Math.cos(col*2.1-row*.83+i)/rowsOfFoil;
        const p=lower[i].clone().lerp(lower[j],u).lerp(upper[i].clone().lerp(upper[j],u),v);
        p.addScaledVector(normal,belt*(.060*Math.sin(col*2.7+row*.83+i)+.042*Math.cos(row*1.6-col*1.4+i)));
        p.y+=belt*.039*Math.cos(col*2.1+row+i);
        return p;
      };
      for(let row=0;row<rowsOfFoil;row++)for(let col=0;col<cols;col++){
        const a=fold(col,row),b=fold(col,row+1),c=fold(col+1,row+1),d=fold(col+1,row);
        foil.quad(a,b,c,d,crease[(i+col+row*3)%crease.length]);
      }
    }
    for(let i=0;i<8;i++)foil.triangle(point(0,3.10,0),upper[(i+1)%8],upper[i],0x96703e);
    foil.finish("lunarLanderFoil",{roughness:.47,metalness:.20,emissive:0x8d571b,emissiveIntensity:.12});
    shell.box(0x494038,0,1.38,0,2.82,.14,2.76);
    shell.add("cone",0x3d4448,0,.95,0,1.35,.76,1.35,Math.PI);

    const padProfile=[[0,-.050],[.40,-.050],[.56,.012],[.56,.074],[.46,.136],[.25,.19],[.12,.17],[0,.17]];
    const padGeometry=new THREE.LatheGeometry(padProfile.map(p=>new THREE.Vector2(...p)),s.mobile?14:22);
    const padPos=padGeometry.getAttribute("position"),padColors=[];
    const dust=new THREE.Color(0x817974).convertSRGBToLinear(),metal=new THREE.Color(0xaf8a51).convertSRGBToLinear(),shade=new THREE.Color();
    for(let i=0;i<padPos.count;i++){
      shade.copy(dust).lerp(metal,THREE.MathUtils.smoothstep(padPos.getY(i),.027,.155));
      padColors.push(shade.r,shade.g,shade.b);
    }
    padGeometry.setAttribute("color",new THREE.Float32BufferAttribute(padColors,3));
    const pads=new THREE.InstancedMesh(padGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.06}),4);
    pads.name="lunarLanderFootpads";pads.castShadow=true;pads.receiveShadow=true;pads.frustumCulled=false;lander.add(pads);
    const padDust=[],matrix=new THREE.Matrix4();
    let ladderExit;
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,dx=Math.sin(a),dz=Math.cos(a);
      const pad=point(dx*3.17,0,dz*3.17),p=lander.localToWorld(pad.clone());
      p.y=floorY(p.x,p.z);
      pad.y=p.y-lander.position.y;
      pads.setMatrixAt(i,matrix.makeTranslation(pad.x,pad.y,pad.z));
      padDust.push([p.x,p.z,.78,.68,i*.74]);
      const joint=point(pad.x,pad.y+.17,pad.z),anchor=point(dx*1.47,2.92,dz*1.47);
      beam(0xa9b2b4,anchor,joint,.123);
      beam(0x757d7b,anchor,anchor.clone().lerp(joint,.53),.19);
      for(const side of [-1,1])beam(0x929995,point(dx*1.49+dz*.6*side,1.70,dz*1.49-dx*.6*side),joint.clone().lerp(anchor,.30),.083);
      if(i===0){
        const foot=point(0,pad.y+.28,pad.z-.05),top=point(0,3.29,1.73);
        for(const side of [-1,1])beam(0xa3aaa6,foot.clone().add(point(side*.25,0,0)),top.clone().add(point(side*.25,0,0)),.055);
        for(let j=0;j<8;j++){
          const step=foot.clone().lerp(top,j/7);
          shell.box(0xbfc4b9,0,step.y,step.z,.50,.065,.072);
        }
        ladderExit=lander.localToWorld(point(.12,0,pad.z+.57));
      }
    }
    pads.instanceMatrix.needsUpdate=true;
    beam(0x929b9d,point(.69,5.16,.38),point(.86,5.84,.48),.071);
    const dish=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.18,.024],[.41,.13],[.60,.29]].map(p=>new THREE.Vector2(...p)),s.mobile?12:18),
      new THREE.MeshStandardMaterial({color:0xc3c7c4,roughness:.61,side:THREE.DoubleSide}));
    dish.name="lunarLanderAntenna";dish.position.set(.86,5.82,.48);dish.rotation.set(.63,0,.31);
    dish.castShadow=true;lander.add(dish);
    const braces=shell.finish(lander,"lunarLanderStructure");braces.castShadow=true;braces.receiveShadow=true;

    const route=new THREE.CubicBezierCurve(
      new THREE.Vector2(ladderExit.x,ladderExit.z),new THREE.Vector2(ladderExit.x+2.6,ladderExit.z+1.3),
      new THREE.Vector2(-13.9,-7.5),new THREE.Vector2(-9.83,-3.78)
    );
    const steps=Math.round(route.getLength()/.68),bootprints=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,p=route.getPointAt(t),forward=route.getTangentAt(t);
      const side=i%2===0?1:-1,offset=side*(.14+.025*Math.cos(i*2.31));
      bootprints.push([p.x+forward.y*offset,p.y-forward.x*offset,Math.atan2(forward.x,forward.y)+side*.12,
        side,.61-.11*t+.12*Math.cos(i*1.46)+.07*Math.sin(i*.68)]);
    }
    return {bootprints,padDust};
  }
  function lunar(s,b,{batch,lunarMarkings}){
    // 1. 不平整的月球沙地与环形山、远景月山
    const craters=[
      [-14,-15,4.2,0.55,0.28],[15,-12,5.4,0.68,0.34],[-18,10,6.2,0.72,0.38],[19,14,4.8,0.6,0.3],
      [-28,-28,11,1.3,0.65],[26,-34,13,1.5,0.72],[4,-32,8.5,0.95,0.48],[-32,4,9.5,1.1,0.55],
      [34,-2,10.5,1.2,0.58],[-22,30,12,1.35,0.62],[24,32,10,1.15,0.52],[0,42,15,1.7,0.8]
    ];
    const smoothstep=(e0,e1,x)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
    const minZ=typeof COURT!=="undefined"?COURT.floorMinZ:-13.5,maxZ=typeof COURT!=="undefined"?COURT.floorMaxZ:22.5;
    const terrainY=(vx,vz)=>{
      const dx=Math.max(0,Math.abs(vx)-10.4);
      const dz=Math.max(0,vz<minZ+2.2?minZ+2.2-vz:(vz>maxZ-2.2?vz-(maxZ-2.2):0));
      const blend=smoothstep(0,6.5,Math.hypot(dx,dz));
      if(blend<=0)return -0.022;
      const wave=Math.sin(vx*.19+vz*.13)*.22+Math.cos(vx*.44-vz*.37)*.11+Math.sin(vx*.88+vz*.76)*.05;
      let cy=0;
      for(let i=0;i<craters.length;i++){
        const [cx,cz,cr,cd,rh]=craters[i],d=Math.hypot(vx-cx,vz-cz)/cr;
        if(d<1.45){
          if(d<1)cy-=cd*(1-d*d);
          const rim=Math.exp(-Math.pow((d-1.02)/.18,2));
          cy+=rh*rim;
        }
      }
      const dist=Math.hypot(vx,vz-4),ang=Math.atan2(vz-4,vx);
      let my=0;
      if(dist>50){
        const t=Math.min(1,(dist-50)/62);
        const p1=1-Math.abs(Math.sin(ang*3.5+.6));
        const p2=1-Math.abs(Math.cos(ang*7.2-1.1));
        const p3=Math.abs(Math.sin(ang*13.0+dist*.08));
        const ridge=p1*.55+p2*.32+p3*.18+.12;
        my=Math.pow(t,1.25)*15*ridge;
      }
      return -0.022+blend*(wave+cy+my);
    };
    // 真实月球风化层反照率与凹凸法线感贴图（无缝平铺，消除塑料感）
    const regAlbedo=loadVenueTexture("assets/lunar/regolith_albedo.jpg");
    regAlbedo.wrapS=regAlbedo.wrapT=THREE.RepeatWrapping;regAlbedo.repeat.set(14,14);
    if(THREE.sRGBEncoding)regAlbedo.encoding=THREE.sRGBEncoding;
    const regBump=loadVenueTexture("assets/lunar/regolith_bump.jpg");
    regBump.wrapS=regBump.wrapT=THREE.RepeatWrapping;regBump.repeat.set(14,14);

    const tGeo=new THREE.PlaneGeometry(230,230,96,96);tGeo.rotateX(-Math.PI/2);
    const tPos=tGeo.attributes.position,tCol=new Float32Array(tPos.count*3),c=new THREE.Color();
    for(let i=0;i<tPos.count;i++){
      const vx=tPos.getX(i),vz=tPos.getZ(i)+4,y=terrainY(vx,vz);
      tPos.setXYZ(i,vx,y,vz);
      const n=Math.sin(vx*.55+vz*.45)*.04+Math.cos(vx*1.1-vz*.9)*.025;
      const shade=Math.max(.68,Math.min(1.0,.92+Math.min(.08,y*.004)+n));
      c.setRGB(shade,shade,shade).convertSRGBToLinear();
      tCol[i*3]=c.r;tCol[i*3+1]=c.g;tCol[i*3+2]=c.b;
    }
    tGeo.setAttribute("color",new THREE.BufferAttribute(tCol,3));
    tGeo.computeVertexNormals();
    const ground=new THREE.MeshStandardMaterial({
      map:regAlbedo,bumpMap:regBump,bumpScale:.25,roughness:.96,metalness:0,vertexColors:true
    });
    const terrain=new THREE.Mesh(tGeo,ground);
    terrain.name="lunarTerrain";terrain.receiveShadow=true;s.root.add(terrain);

    // 2. 月球岩石与前景巨石（投射清晰长影）
    const rocks=batch();
    const heroRocks=[
      [-9.8,-11.5,1.35,.72,1.15,0x6e7177],[-11.4,4.2,1.6,.85,1.3,0x767980],
      [10.6,-6.8,1.45,.78,1.2,0x6b6e74],[11.5,11.8,1.25,.68,1.05,0x74777d],
      [-5.6,-15.2,1.8,.95,1.4,0x696c72],[7.4,-17.5,1.5,.8,1.25,0x777a80]
    ];
    heroRocks.forEach(([x,z,w,h,d,col],idx)=>{
      rocks.add("rock",col,x,terrainY(x,z)+h*.36,z,w,h,d,idx*.2,idx*1.1,idx*.15);
    });
    const rockCount=s.mobile?48:78;
    for(let i=0;i<rockCount;i++){
      const a=s.r()*Math.PI*2,rad=9.2+Math.pow(s.r(),1.2)*38;
      let rx=Math.cos(a)*rad,rz=4+Math.sin(a)*rad;
      if(Math.abs(rx)<8.2&&rz>-11&&rz<20)rx+=(rx<0?-1:1)*8.5;
      const sc=.22+Math.pow(s.r(),2)*1.05,ry=terrainY(rx,rz);
      const col=i%3===0?0x63666c:i%3===1?0x7a7d84:0x6d7076;
      rocks.add("rock",col,rx,ry+sc*.32,rz,sc*(.9+s.r()*.6),sc*(.55+s.r()*.5),sc*(.85+s.r()*.6),s.r()*.4,s.r()*6.28,s.r()*.4);
    }
    // Split slabs poke out of the dust beside three larger blocks. All share the rock batch.
    for(const [x,z,angle] of [[-9.8,-11.5,.38],[10.6,-6.8,-.55],[-5.6,-15.2,1.22]]){
      const y=terrainY(x,z),dx=Math.cos(angle),dz=Math.sin(angle);
      rocks.add("rock",0x999491,x+dx*.52,y+.17,z+dz*.52,1.15,.32,.77,.13,-angle,-.15);
      rocks.add("rock",0x787576,x+dx*.99,y+.07,z+dz*.99,.55,.16,.36,-.12,-angle,.21);
    }
    const rockMesh=rocks.finish(s.root,"lunarRocks");
    if(rockMesh){rockMesh.castShadow=true;rockMesh.receiveShadow=true;}

    // 2.5 场边脱下的宇航服（1人模式1套，双人对战模式2套）
    const makeSuit=(name,x,z,rotY,accentCol)=>{
      const sb=batch(),gy=terrainY(x,z);
      // 靠垫月岩
      sb.add("rock",0x686b72,0,.18,-.22,.78,.36,.52,.1,.4,0);
      // 生命保障背包（靠在石头上）
      sb.box(0xd8dde5,0,.38,-.06,.42,.52,.18,-.42,0,0);
      sb.box(0x3a404a,0,.44,-.02,.28,.22,.20,-.42,0,0);
      sb.box(accentCol,0,.24,-.12,.38,.07,.20,-.42,0,0);
      // 软塌的白色宇航服上身与双袖
      sb.box(0xeef2f7,0,.28,.12,.46,.22,.44,.22,0,0);
      sb.box(0xd4dae2,0,.29,.22,.48,.09,.12,.22,0,0); // 腰带
      sb.box(0xe6ebf2,-.30,.15,.16,.14,.14,.42,.15,.28,.12);
      sb.box(0xe6ebf2,.30,.16,.18,.14,.14,.40,.18,-.32,-.1);
      // 手套
      sb.box(0x8e95a0,-.38,.07,.35,.11,.08,.14,0,.28,0);
      sb.box(0x8e95a0,.38,.07,.36,.11,.08,.14,0,-.32,0);
      // 折放的裤腿与登月靴
      sb.box(0xe4e9f0,-.13,.11,.46,.16,.15,.44,.06,.12,0);
      sb.box(0xe4e9f0,.14,.11,.44,.16,.15,.42,.04,-.18,0);
      sb.box(0x7c828c,-.16,.09,.70,.17,.16,.24,0,.14,0);
      sb.box(0x7c828c,.19,.09,.68,.17,.16,.24,0,-.22,0);
      // 放在一旁的宇航员头盔 + 金色反光面罩
      sb.add("sphere",0xf2f5fa,.48,.19,.12,.20,.19,.20);
      sb.add("sphere",0xd99b26,.49,.19,.22,.15,.13,.13);
      sb.box(0x7c828c,.48,.06,.12,.26,.06,.26);
      const grp=new THREE.Group();
      grp.position.set(x,Math.max(-.01,gy),z);grp.rotation.y=rotY;grp.name=name;
      const mesh=sb.finish(grp,name+"Mesh");
      if(mesh){mesh.castShadow=true;mesh.receiveShadow=true;}
      s.root.add(grp);
      return grp;
    };
    const suit1=makeSuit("lunarSuit1",-9.1,-3.2,1.15,0xd94f30);
    const suit2=makeSuit("lunarSuit2",9.1,-1.6,-1.25,0x2d6fd6);
    suit2.visible=(typeof G!=="undefined"&&G&&G.mode==="battle");

    const details=lunarLander(s,batch,terrain);
    const markingBounds=new THREE.Vector4(-22,-25,32,maxZ+25);
    const markings=lunarMarkings(markingBounds,details,s.mobile);
    // 粉线直接混入主地形的漫反射，吃同一份日光、投影和凹凸，不叠第二块地板。
    ground.onBeforeCompile=shader=>{
      shader.uniforms.lunarMarkings={value:markings};
      shader.uniforms.lunarMarkingBounds={value:markingBounds};
      shader.vertexShader="varying vec2 vLunarGround;\n"+shader.vertexShader.replace(
        "#include <begin_vertex>","#include <begin_vertex>\nvLunarGround = position.xz;"
      );
      shader.fragmentShader=`varying vec2 vLunarGround;
        uniform sampler2D lunarMarkings;
        uniform vec4 lunarMarkingBounds;
        float lunarWear(vec2 point, vec2 center, vec2 extent) {
          return 1.0 - smoothstep(0.24, 1.0, length((point - center) / extent));
        }
      `+shader.fragmentShader.replace("#include <map_fragment>",`
        #include <map_fragment>
        vec2 markUV = vec2((vLunarGround.x - lunarMarkingBounds.x) / lunarMarkingBounds.z, 1.0 - (vLunarGround.y - lunarMarkingBounds.y) / lunarMarkingBounds.w);
        vec4 paint = mapTexelToLinear(texture2D(lunarMarkings, markUV));
        diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb, paint.a);
      `).replace("#include <normal_fragment_maps>",`
        #ifdef USE_BUMPMAP
          // 压实区沿走动和投篮位置错开，以不同形状融回原来的月尘。
          float looseDust = 1.0;
          if (all(greaterThan(markUV, vec2(0.0))) && all(lessThan(markUV, vec2(1.0)))) {
            vec2 wearPoint = vLunarGround + vec2(
              0.48 * sin(vLunarGround.y * 0.64 + vLunarGround.x * 0.19),
              0.55 * cos(vLunarGround.x * 0.71 - vLunarGround.y * 0.14)
            );
            looseDust =
                (1.0 - lunarWear(wearPoint, vec2(-0.85, -2.8), vec2(8.35, 9.4)))
              * (1.0 - lunarWear(wearPoint, vec2(1.35, 4.0), vec2(4.8, 10.6)))
              * (1.0 - lunarWear(wearPoint, vec2(0.95, 13.65), vec2(7.25, 7.15)))
              * (1.0 - lunarWear(wearPoint, vec2(-5.85, -4.95), vec2(3.3, 4.15)))
              * (1.0 - lunarWear(wearPoint, vec2(5.05, -3.45), vec2(3.55, 4.95)));
          }
          float printPress = vLunarGround.x < -9.25 ? smoothstep(0.05, 0.64, paint.a) : 0.0;
          float relief = mix(0.23, 1.0, looseDust) * (1.0 - 0.82 * printPress);
          normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd() * relief, faceDirection);
        #endif
      `);
    };
    ground.addEventListener("dispose",()=>markings.dispose());

    // 3. 阿波罗实拍感漆黑宇宙星空（稀疏、微弱、柔和圆点星光，不抢主画面）
    const starCount=s.mobile?110:190,sPos=new Float32Array(starCount*3),sCol=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){
      const theta=s.r()*Math.PI*2,phi=Math.acos(0.06+s.r()*0.94),R=146;
      sPos[i*3]=R*Math.sin(phi)*Math.cos(theta);
      sPos[i*3+1]=R*Math.cos(phi);
      sPos[i*3+2]=4+R*Math.sin(phi)*Math.sin(theta);
      const bright=Math.pow(s.r(),2.4);
      const b=.14+bright*.62,tint=s.r();
      sCol[i*3]=b*(tint<.2?.84:1);sCol[i*3+1]=b*(tint<.2?.92:1);sCol[i*3+2]=b*(tint>.82?.86:1);
    }
    const starGeo=new THREE.BufferGeometry();
    starGeo.setAttribute("position",new THREE.BufferAttribute(sPos,3));
    starGeo.setAttribute("color",new THREE.BufferAttribute(sCol,3));
    const starMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,vertexColors:true,
      uniforms:{uEclipse:{value:0}},
      vertexShader:`uniform float uEclipse;varying vec3 vCol;void main(){vCol=color*(1.0+uEclipse*0.95);vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp((220.0+uEclipse*95.0)/max(1.0,-mv.z),1.2,3.4);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uEclipse;varying vec3 vCol;void main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.05,length(d));if(a<.02)discard;gl_FragColor=vec4(vCol,a*min(1.0,.72+uEclipse*.28));}`
    });
    const stars=new THREE.Points(starGeo,starMat);
    stars.name="lunarStars";stars.renderOrder=-10;stars.frustumCulled=false;s.root.add(stars);

    // 4. 远处挂在漆黑宇宙中的蓝色地球（支持真实「月面日全食 · 地球红环」演进：地球遮住太阳时，大气折射出炽热红金光环！）
    const earthTex=loadVenueTexture("assets/lunar/earth.jpg");
    earthTex.wrapS=THREE.RepeatWrapping;
    if(THREE.sRGBEncoding)earthTex.encoding=THREE.sRGBEncoding;
    const earthMat=new THREE.ShaderMaterial({
      transparent:true,
      depthWrite:false,
      fog:false,
      uniforms:{
        uMap:{value:earthTex},
        uSunDir:{value:new THREE.Vector3(-0.88,0.31,-0.17).normalize()},
        uTime:{value:0},
        uEclipse:{value:0}
      },
      vertexShader:`varying vec2 vUv;
        void main(){
          vUv=uv;
          vec4 mvPos=viewMatrix*modelMatrix*vec4(0.0,0.0,0.0,1.0);
          mvPos.xy+=position.xy;
          gl_Position=projectionMatrix*mvPos;
        }`,
      fragmentShader:`uniform sampler2D uMap;uniform vec3 uSunDir;uniform float uTime,uEclipse;
        varying vec2 vUv;
        void main(){
          // 扩大外围散射画布比例 (0.50)，让真实光学大气红晕自然衰减至 0，彻底消除硬边！
          vec2 p=(vUv*2.0-1.0)/0.50;
          float r2=dot(p,p);
          float r=sqrt(r2);
          float outerDist=max(0.0,r-1.0);
          float edgeMask=smoothstep(1.98,1.25,r);
          float ang=atan(p.y,p.x);
          // 真实大气层云量与太阳微偏造成的非均匀光学红环（类似 NASA Blue Ghost 月面日全食实拍）
          vec2 limbDir=normalize(p+vec2(1e-4));
          float diamondArc=pow(max(0.0,dot(limbDir,normalize(vec2(-0.72,0.68)))),3.2);
          float cloudMod=0.78+0.22*sin(ang*5.0+uTime*0.18)*cos(ang*9.0-0.7)+0.12*sin(ang*13.0+1.2);
          float limbIntensity=(0.68+0.78*diamondArc)*cloudMod;

          // 3 层物理光学散射：极细白金炽热内大气层 + 柔和深红瑞利折射环 + 宽广柔雾米氏散射外晕
          float thinRim=exp(-pow((r-1.006)/0.024,2.0));
          float midGlow=exp(-outerDist*6.8)*edgeMask;
          float wideBloom=exp(-outerDist*2.4)*edgeMask;
          float blueHalo=exp(-outerDist*7.5)*smoothstep(1.55,1.0,r);

          vec3 L=normalize(uSunDir);
          if(r>1.0){
            float sunSide=smoothstep(-0.45,0.55,dot(normalize(vec3(p,0.0)),L));
            vec3 dayCol=vec3(0.24,0.62,1.0)*blueHalo*(0.06+0.76*sunSide);
            float dayA=blueHalo*(0.08+0.70*sunSide);
            vec3 eclCol=(
              vec3(1.0,0.88,0.62)*thinRim*1.15*diamondArc+
              vec3(1.0,0.34,0.08)*thinRim*1.25+
              vec3(0.88,0.20,0.04)*midGlow*0.72+
              vec3(0.55,0.09,0.02)*wideBloom*0.30
            )*limbIntensity;
            float eclA=clamp((thinRim*0.92+midGlow*0.58+wideBloom*0.24)*limbIntensity,0.0,1.0);
            gl_FragColor=vec4(mix(dayCol,eclCol,uEclipse),mix(dayA,eclA,uEclipse));
            return;
          }
          vec3 N=vec3(p,sqrt(max(0.0,1.0-r2)));
          float ndl=dot(N,L);
          float lit=smoothstep(-0.18,0.34,ndl)*(1.0-uEclipse);
          float lon=atan(N.x,N.z)/6.2831853+0.5+uTime*0.003;
          float lat=asin(clamp(N.y,-0.999,0.999))/3.14159265+0.5;
          vec3 albedo=texture2D(uMap,vec2(fract(lon),lat)).rgb;
          float edgeFade=smoothstep(1.0,0.972,r);
          vec3 H=normalize(L+vec3(0.0,0.0,1.0));
          float spec=pow(max(dot(N,H),0.0),28.0)*0.22*lit;
          vec3 blueAtmo=vec3(0.24,0.64,1.0)*pow(1.0-N.z,3.4)*(0.05+0.95*lit)*1.15;
          // 地球背阳面边缘极其细腻的渐入红铜大气内散射（无硬描边！）
          float innerAtmo=pow(1.0-N.z,6.5)*limbIntensity;
          vec3 redAtmo=(vec3(1.0,0.36,0.09)*innerAtmo*1.35+vec3(1.0,0.84,0.58)*pow(1.0-N.z,12.0)*diamondArc*1.2);
          // 地球黑夜面极其微弱的暗影轮廓
          vec3 nightEarth=albedo*0.018+vec3(0.04,0.012,0.008)*pow(1.0-N.z,2.0);
          vec3 daySurface=albedo*(0.008+1.26*lit)+vec3(0.75,0.88,1.0)*spec+blueAtmo;
          vec3 surface=mix(daySurface,nightEarth+redAtmo,uEclipse);
          vec3 limbEdgeCol=mix(vec3(0.22,0.60,1.0)*(0.05+0.72*lit),(vec3(1.0,0.38,0.10)*1.3+vec3(1.0,0.85,0.55)*diamondArc*0.9)*limbIntensity,uEclipse);
          vec3 col=mix(limbEdgeCol,surface,edgeFade);
          gl_FragColor=vec4(col,1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    earthMat.map=earthTex;
    const earth=new THREE.Mesh(new THREE.PlaneGeometry(25.0,25.0),earthMat);
    earth.position.set(16.5,18.5,-76);earth.name="lunarEarth";earth.frustumCulled=false;
    s.root.add(earth);

    // 5. 阿波罗低角度太阳日冕星芒 + 环形山静电尘埃光束与地平线微光带 (支持月面日全食红环过渡)
    const coronaMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
      uniforms:{uTime:{value:0},uEclipse:{value:0}},
      vertexShader:`varying vec2 vUv;
        void main(){
          vUv=uv;
          vec4 mvPos=viewMatrix*modelMatrix*vec4(0.0,0.0,0.0,1.0);
          mvPos.xy+=position.xy;
          gl_Position=projectionMatrix*mvPos;
        }`,
      fragmentShader:`uniform float uTime,uEclipse;varying vec2 vUv;
        void main(){
          vec2 p=vUv*2.0-1.0;
          float r=length(p);
          if(r>1.0)discard;
          float core=exp(-r*r*46.0);
          float innerHalo=exp(-r*5.4)*0.52;
          float outerCorona=exp(-r*2.4)*smoothstep(1.0,0.14,r)*0.24;
          float ang=atan(p.y,p.x);
          float rays=pow(max(0.0,cos(ang*3.0)),18.0)*exp(-r*3.6)*(0.32+0.05*sin(uTime*1.7));
          float anamorphic=exp(-abs(p.y)*24.0)*exp(-abs(p.x)*2.0)*0.38;
          vec3 col=vec3(1.0,0.99,0.95)*core+vec3(0.96,0.93,0.86)*(innerHalo+rays)+vec3(0.80,0.88,0.98)*(outerCorona+anamorphic);
          float alpha=clamp(core+innerHalo+outerCorona+rays*0.72+anamorphic*0.82,0.0,1.0)*(1.0-uEclipse*0.96);
          gl_FragColor=vec4(col,alpha);
        }`
    });
    const solarCorona=new THREE.Mesh(new THREE.PlaneGeometry(28,28),coronaMat);
    solarCorona.position.set(-34,15.8,-82);solarCorona.name="lunarSolarCorona";solarCorona.frustumCulled=false;
    s.root.add(solarCorona);

    // 环形山脊静电尘埃斜射光带 (Apollo Horizon Glow Dust Light-Shafts)
    const shaftMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{uTime:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float uTime;varying vec2 vUv;
        void main(){
          float rays=0.55+0.45*sin(vUv.x*18.0+vUv.y*6.0+uTime*0.18)*cos(vUv.x*9.0-vUv.y*4.0);
          float edgeX=smoothstep(0.0,0.22,vUv.x)*(1.0-smoothstep(0.76,1.0,vUv.x));
          float edgeY=smoothstep(0.0,0.25,vUv.y)*(1.0-smoothstep(0.68,1.0,vUv.y));
          float a=edgeX*edgeY*rays*0.095;
          vec3 col=mix(vec3(0.82,0.86,0.92),vec3(0.98,0.94,0.86),vUv.y);
          gl_FragColor=vec4(col,a);
        }`
    });
    const lunarShafts=new THREE.Group();lunarShafts.name="lunarSolarShafts";
    for(const [sx,sy,sz,sw,sh,rz] of [[-12,7.5,-34,26,15,-0.52],[-2,6.8,-44,32,16,-0.48],[9,6.2,-52,28,14,-0.44]]){
      const sm=new THREE.Mesh(new THREE.PlaneGeometry(sw,sh),shaftMat);
      sm.position.set(sx,sy,sz);sm.rotation.z=rz;lunarShafts.add(sm);
    }
    s.root.add(lunarShafts);

    // 环形山脊上方的静电悬浮尘埃地平线辉光 (Apollo Electrostatic Horizon Glow & Earthshine Rim)
    const hGlowGeo=new THREE.CylinderGeometry(96,96,24,48,1,true);
    const hGlowMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
      uniforms:{uTime:{value:0},uEclipse:{value:0}},
      vertexShader:`varying vec3 vWPos;varying vec2 vUv;
        void main(){
          vUv=uv;
          vec4 wp=modelMatrix*vec4(position,1.0);
          vWPos=wp.xyz;
          gl_Position=projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader:`uniform float uTime,uEclipse;varying vec3 vWPos;varying vec2 vUv;
        void main(){
          vec3 dir=normalize(vWPos-vec3(0.0,0.0,4.0));
          float sunSide=smoothstep(-0.35,0.95,dot(dir,normalize(vec3(-0.38,0.18,-0.90))));
          float earthSide=smoothstep(-0.25,0.92,dot(dir,normalize(vec3(0.22,0.20,-0.95))));
          float vProfile=smoothstep(0.0,0.26,vUv.y)*exp(-max(0.0,vUv.y-0.22)*3.8);
          float wave=0.82+0.18*sin(dir.x*9.0+dir.z*7.0+uTime*0.22);
          vec3 dayCol=vec3(0.92,0.90,0.84)*sunSide*0.18+vec3(0.36,0.64,1.0)*earthSide*0.12+vec3(0.48,0.52,0.60)*0.04;
          vec3 redCol=vec3(0.92,0.26,0.09)*(0.12+0.24*sunSide+0.16*earthSide);
          vec3 col=mix(dayCol,redCol,uEclipse);
          float a=vProfile*wave*mix(0.04+0.13*sunSide+0.09*earthSide,0.14+0.18*sunSide,uEclipse);
          gl_FragColor=vec4(col,a);
        }`
    });
    const horizonGlow=new THREE.Mesh(hGlowGeo,hGlowMat);
    horizonGlow.position.set(0,8.5,4);horizonGlow.name="lunarHorizonGlow";horizonGlow.frustumCulled=false;
    s.root.add(horizonGlow);

    // 6. 1/6G 月表静电悬浮晶尘微粒 (Electrostatic Levitated Lunar Regolith Dust)
    const dustCount=s.mobile?110:220;
    const dPos=new Float32Array(dustCount*3),dSeed=new Float32Array(dustCount*3);
    for(let i=0;i<dustCount;i++){
      const inCourt=i<dustCount*0.55;
      dPos[i*3]=(s.r()-0.5)*(inCourt?18.5:42.0);
      dPos[i*3+1]=0.14+Math.pow(s.r(),1.35)*(inCourt?3.8:5.4);
      dPos[i*3+2]=(inCourt?-11.5:minZ-6)+s.r()*(inCourt?31.0:48.0);
      dSeed[i*3]=s.r();
      dSeed[i*3+1]=0.55+s.r()*0.95;
      dSeed[i*3+2]=s.r()*6.283185;
    }
    const dustGeo=new THREE.BufferGeometry();
    dustGeo.setAttribute("position",new THREE.BufferAttribute(dPos,3));
    dustGeo.setAttribute("aSeed",new THREE.BufferAttribute(dSeed,3));
    const dustMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,
      uniforms:{
        uTime:{value:0},
        uSunDir:{value:new THREE.Vector3(-22,10,-4).normalize()}
      },
      vertexShader:`attribute vec3 aSeed;
        uniform float uTime;uniform vec3 uSunDir;
        varying float vAlpha;varying float vSparkle;
        void main(){
          // 1/6G 低重力 360° 独立三维静电微幅游弋（绝不同步左右摆动）
          float t=uTime*(0.11+0.07*aSeed.y)+aSeed.x*62.8318;
          float az=aSeed.z;
          vec2 dir=vec2(cos(az),sin(az));
          vec2 perp=vec2(-dir.y,dir.x);
          vec2 drift=dir*(sin(t)*0.48+cos(t*0.61)*0.24)+perp*(cos(t*0.83)*0.36);
          float lift=sin(t*1.15+aSeed.z)*0.22+cos(t*0.52)*0.11;
          vec3 wp=position+vec3(drift.x,lift,drift.y);
          vec4 mv=modelViewMatrix*vec4(wp,1.0);
          float dist=max(1.2,-mv.z);
          gl_PointSize=clamp((32.0+22.0*aSeed.y)/dist,1.5,5.2);
          gl_Position=projectionMatrix*mv;
          vec3 viewDir=normalize(wp-cameraPosition);
          float scatter=pow(clamp(dot(viewDir,-uSunDir)*0.5+0.5,0.0,1.0),2.0);
          float twinkle=0.55+0.45*sin(uTime*(1.6+aSeed.y*1.4)+aSeed.x*47.0);
          vSparkle=scatter*twinkle;
          float distFade=smoothstep(1.0,2.6,dist)*(1.0-smoothstep(22.0,42.0,dist));
          vAlpha=(0.30+0.54*vSparkle)*distFade;
        }`,
      fragmentShader:`varying float vAlpha;varying float vSparkle;
        void main(){
          vec2 d=gl_PointCoord-0.5;
          float r=length(d);
          if(r>0.5)discard;
          float soft=smoothstep(0.5,0.06,r);
          vec3 col=mix(vec3(0.78,0.82,0.88),vec3(1.0,0.98,0.93),vSparkle);
          gl_FragColor=vec4(col,soft*vAlpha);
        }`
    });
    const lunarDust=new THREE.Points(dustGeo,dustMat);
    lunarDust.name="lunarElectrostaticDust";lunarDust.frustumCulled=false;
    s.root.add(lunarDust);

    // 7. 右后方月球科考通信基站 + 太阳能追踪阵列 + 球场四角激光边界定位桩 (Artemis Telemetry Outpost)
    const lEnv=window.AIBALunarMetal?window.AIBALunarMetal.makeEnvPMREM():null;
    const outTi=new THREE.MeshStandardMaterial({color:0x92969e,roughness:0.27,metalness:0.84,envMap:lEnv,envMapIntensity:1.05});
    const outSil=new THREE.MeshStandardMaterial({color:0xd0d4dc,roughness:0.21,metalness:0.90,envMap:lEnv,envMapIntensity:1.20});
    const outGun=new THREE.MeshStandardMaterial({color:0x343840,roughness:0.36,metalness:0.76,envMap:lEnv,envMapIntensity:0.88});
    const outSolar=new THREE.MeshStandardMaterial({color:0x162b4c,roughness:0.20,metalness:0.65,emissive:0x0b1c36,emissiveIntensity:0.35,envMap:lEnv,envMapIntensity:1.1});
    const outGold=new THREE.MeshStandardMaterial({color:0xcf9b3a,roughness:0.34,metalness:0.78,envMap:lEnv,envMapIntensity:0.95});
    const beaconCyan=new THREE.MeshBasicMaterial({color:0x6ce2ff});
    const beaconAmber=new THREE.MeshBasicMaterial({color:0xffad3b});

    const outpost=new THREE.Group();outpost.name="lunarTelemetryOutpost";
    const ox=13.8,oz=-19.8,oy=terrainY(ox,oz);
    outpost.position.set(ox,oy,oz);outpost.rotation.y=0.38;
    const addPart=(geo,mat,x,y,z,rx=0,ry=0,rz=0,parent=outpost)=>{
      const m=new THREE.Mesh(geo,mat);
      m.position.set(x,y,z);if(rx||ry||rz)m.rotation.set(rx,ry,rz);
      m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
    };
    // 基站重型四角登月底盘与隔热设备舱
    addPart(new THREE.BoxGeometry(1.45,0.48,1.25),outGun,0,0.36,0);
    addPart(new THREE.BoxGeometry(1.52,0.08,1.32),outTi,0,0.62,0);
    addPart(new THREE.BoxGeometry(0.95,0.36,0.88),outGold,0,0.82,0);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      addPart(new THREE.CylinderGeometry(0.16,0.20,0.05,12),outGun,sx*0.86,0.025,sz*0.76);
      addPart(new THREE.CylinderGeometry(0.04,0.04,0.38,8),outSil,sx*0.76,0.21,sz*0.66,sz*0.22,0,-sx*0.22);
    }
    // 双翼可倾转深蓝光伏太阳能电池阵列 (Solar Array Wings)
    const solarPivot=new THREE.Group();solarPivot.position.set(0,1.15,0);outpost.add(solarPivot);
    addPart(new THREE.CylinderGeometry(0.07,0.09,0.58,10),outTi,0,-0.1,0,0,0,0,solarPivot);
    for(const sx of [-1,1]){
      addPart(new THREE.BoxGeometry(1.85,0.045,1.08),outTi,sx*1.18,0.12,0,0.38,0,0,solarPivot);
      addPart(new THREE.BoxGeometry(1.76,0.052,0.98),outSolar,sx*1.18,0.13,0,0.38,0,0,solarPivot);
      addPart(new THREE.BoxGeometry(0.04,0.06,1.04),outSil,sx*0.62,0.13,0,0.38,0,0,solarPivot);
      addPart(new THREE.BoxGeometry(0.04,0.06,1.04),outSil,sx*1.18,0.13,0,0.38,0,0,solarPivot);
      addPart(new THREE.BoxGeometry(0.04,0.06,1.04),outSil,sx*1.74,0.13,0,0.38,0,0,solarPivot);
    }
    // 顶部缓慢旋转的 S 波段深空抛物面通信雷达天线
    const dishPivot=new THREE.Group();dishPivot.position.set(0,1.45,0);outpost.add(dishPivot);
    addPart(new THREE.CylinderGeometry(0.055,0.07,0.65,10),outSil,0,0.22,0,0,0,0,dishPivot);
    const dishGeo=new THREE.LatheGeometry([[0,0],[0.22,0.03],[0.52,0.16],[0.78,0.38]].map(p=>new THREE.Vector2(...p)),16);
    addPart(dishGeo,outSil,0,0.62,0.08,0.72,0,0,dishPivot);
    addPart(new THREE.CylinderGeometry(0.025,0.025,0.42,8),outGun,0,0.74,0.24,0.72,0,0,dishPivot);
    addPart(new THREE.SphereGeometry(0.055,8,6),beaconCyan,0,0.88,0.38,0,0,0,dishPivot);
    s.root.add(outpost);

    // 球场外围四角低矮航空激光边界定位信标桩（高仅 0.25m，绝不阻挡跑动与镜头）
    const cornerBeacons=[];
    for(const [cx,cz] of [[-9.25,-10.2],[9.25,-10.2],[-9.25,19.2],[9.25,19.2]]){
      const cy=terrainY(cx,cz);
      const pyl=new THREE.Group();pyl.position.set(cx,cy,cz);
      addPart(new THREE.CylinderGeometry(0.11,0.14,0.04,10),outGun,0,0.02,0,0,0,0,pyl);
      addPart(new THREE.CylinderGeometry(0.045,0.065,0.16,10),outTi,0,0.12,0,0,0,0,pyl);
      const lensMat=beaconCyan.clone();
      addPart(new THREE.SphereGeometry(0.038,8,6),lensMat,0,0.22,0,0,0,0,pyl);
      s.root.add(pyl);
      cornerBeacons.push(lensMat);
    }

    // 8. 自主巡视六轮阿耳忒弥斯月球车 (Autonomous 6-Wheel Artemis Lunar Rover)
    const rover=new THREE.Group();rover.name="lunarAutonomousRover";
    // 车体底盘（拉丝钛灰骨架 + 金色隔热电池舱 + 太阳能后甲板）
    addPart(new THREE.BoxGeometry(1.18,0.22,1.88),outTi,0,0.42,0,0,0,0,rover);
    addPart(new THREE.BoxGeometry(0.92,0.26,0.96),outGold,0,0.58,-0.12,0,0,0,rover);
    addPart(new THREE.BoxGeometry(1.06,0.04,0.78),outSolar,0,0.56,-0.52,-0.12,0,0,rover);
    // 前部立体导航相机桅杆 + 呼吸遥测灯 + 旋转高增益天线
    addPart(new THREE.CylinderGeometry(0.038,0.048,0.68,8),outSil,-0.22,0.86,0.64,0,0,0,rover);
    addPart(new THREE.BoxGeometry(0.28,0.12,0.16),outGun,-0.22,1.22,0.66,0,0,0,rover);
    const roverBeaconMat=beaconAmber.clone();
    addPart(new THREE.SphereGeometry(0.042,8,6),roverBeaconMat,-0.22,1.32,0.68,0,0,0,rover);
    const roverDish=new THREE.Group();roverDish.position.set(0.28,0.72,0.48);rover.add(roverDish);
    addPart(new THREE.CylinderGeometry(0.028,0.035,0.38,8),outSil,0,0.16,0,0,0,0,roverDish);
    addPart(new THREE.LatheGeometry([[0,0],[0.14,0.02],[0.34,0.11],[0.46,0.22]].map(p=>new THREE.Vector2(...p)),12),outSil,0,0.38,0.04,0.65,0,0,roverDish);
    // 6 个钛金属网轮与悬架摇臂
    const roverWheels=[];
    const wheelGeo=new THREE.CylinderGeometry(0.26,0.26,0.17,14);wheelGeo.rotateZ(Math.PI/2);
    const hubGeo=new THREE.CylinderGeometry(0.12,0.12,0.19,10);hubGeo.rotateZ(Math.PI/2);
    for(const sx of [-1,1])for(const wz of [-0.68,0,0.68]){
      addPart(new THREE.BoxGeometry(0.26,0.06,0.08),outGun,sx*0.62,0.34,wz,0,0,-sx*0.25,rover);
      addPart(new THREE.BoxGeometry(0.24,0.04,0.42),outTi,sx*0.74,0.54,wz,0,0,0,rover); // 挡泥板
      const wg=new THREE.Group();wg.position.set(sx*0.76,0.26,wz);rover.add(wg);
      addPart(wheelGeo,outGun,0,0,0,0,0,0,wg);
      addPart(hubGeo,outGold,0,0,0,0,0,0,wg);
      roverWheels.push(wg);
    }
    rover.position.set(6,terrainY(6,-28.5),-28.5);
    s.root.add(rover);

    // 8B. 远处环形山脊上的 SEC-07 月球采矿桁架塔与深空警示信标 (Distant Industrial Lunar Mining Derrick)
    const derrick=new THREE.Group();derrick.name="lunarMiningDerrick";
    const dx=-25,dz=-44,dy=terrainY(dx,dz);
    derrick.position.set(dx,dy,dz);derrick.rotation.y=0.42;
    addPart(new THREE.BoxGeometry(3.8,0.65,3.8),outGun,0,0.32,0,0,0,0,derrick);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      addPart(new THREE.BoxGeometry(0.28,11.5,0.28),outTi,sx*1.15,6.0,sz*1.15,sz*-0.08,0,sx*0.08,derrick);
    }
    for(const ly of [2.6,5.4,8.2,10.8]){
      const w=2.55-ly*0.14;
      addPart(new THREE.BoxGeometry(w,0.20,w),outGun,0,ly,0,0,0,0,derrick);
    }
    // 顶部横向工业吊臂与钻探主轴
    addPart(new THREE.BoxGeometry(6.8,0.42,0.52),outTi,1.2,11.4,0,0,0,0.06,derrick);
    addPart(new THREE.CylinderGeometry(0.14,0.20,10.8,8),outSil,0,5.6,0,0,0,0,derrick);
    const derrickBeaconMat=beaconAmber.clone();
    addPart(new THREE.SphereGeometry(0.26,8,6),derrickBeaconMat,0,12.1,0,0,0,0,derrick);
    s.root.add(derrick);

    // 9. 硬核工业轨道空间站 + 悬吊巨型实时比分大屏 + 偶发微流星 (Orbital Industrial Station & Hanging Live Scoreboard)
    const gateway=new THREE.Group();gateway.name="lunarOrbitalStation";
    // 主工业桁架脊梁 (18m 跨度)
    addPart(new THREE.BoxGeometry(18.5,0.42,0.52),outGun,0,2.55,0,0,0,0,gateway);
    addPart(new THREE.BoxGeometry(18.8,0.16,0.68),outTi,0,2.82,0,0,0,0,gateway);
    for(let k=-8;k<=8;k+=2){
      addPart(new THREE.BoxGeometry(0.18,1.1,0.58),outGun,k,2.55,0,0,0,0.45,gateway);
      addPart(new THREE.BoxGeometry(0.18,1.1,0.58),outGun,k,2.55,0,0,0,-0.45,gateway);
    }
    // 核心加压工业舱段（多节圆柱舱 + 钛银对接环 + 隔热金箔舱）
    addPart(new THREE.CylinderGeometry(1.15,1.15,5.8,14),outTi,-0.4,2.55,0,0,0,Math.PI/2,gateway);
    addPart(new THREE.CylinderGeometry(1.38,1.38,2.4,14),outGun,-1.4,2.55,0,0,0,Math.PI/2,gateway);
    addPart(new THREE.CylinderGeometry(0.88,1.08,3.0,12),outSil,3.8,2.55,0,0,0,Math.PI/2,gateway);
    addPart(new THREE.CylinderGeometry(0.95,0.95,2.2,12),outGold,-4.6,2.55,0,0,0,Math.PI/2,gateway);
    for(const rx of [-5.8,-3.1,-0.2,2.4,5.4]){
      addPart(new THREE.CylinderGeometry(1.28,1.28,0.28,14),outSil,rx,2.55,0,0,0,Math.PI/2,gateway);
    }
    // 顶部深空通信雷达与对接节点塔
    addPart(new THREE.CylinderGeometry(0.52,0.62,2.1,12),outTi,1.4,4.0,0,0,0,0,gateway);
    addPart(new THREE.CylinderGeometry(0.75,0.75,0.24,12),outGun,1.4,5.1,0,0,0,0,gateway);
    addPart(new THREE.CylinderGeometry(0.08,0.12,2.8,8),outSil,-2.4,4.8,0,0,0,0.12,gateway);
    // 左右双层巨型工业太阳能帆板翼
    for(const sx of [-1,1]){
      for(const wx of [6.4,8.6]){
        addPart(new THREE.BoxGeometry(1.75,5.6,0.12),outSolar,sx*wx,2.55,-0.55,0.24,0,0,gateway);
        addPart(new THREE.BoxGeometry(1.85,0.16,0.22),outSil,sx*wx,2.55,-0.55,0.24,0,0,gateway);
      }
      addPart(new THREE.BoxGeometry(0.18,6.2,0.24),outTi,sx*7.5,2.55,-0.55,0.24,0,0,gateway);
    }
    // 悬吊巨型工业实时比分大屏 (14.4m × 4.6m)
    const sbW=14.4,sbH=4.6;
    // 4 根工业钢索/液压吊杆把大屏挂在空间站主桁架下方
    for(const cx of [-5.8,-2.2,2.2,5.8]){
      addPart(new THREE.CylinderGeometry(0.10,0.10,2.3,8),outSil,cx,1.35,0.35,0,0,0,gateway);
    }
    // 重工业金属大屏背箱与防撞边框
    addPart(new THREE.BoxGeometry(sbW+0.8,sbH+0.7,0.72),outGun,0,-1.85,0.05,0,0,0,gateway);
    addPart(new THREE.BoxGeometry(sbW+1.0,0.34,0.88),outTi,0,-1.85+sbH*0.5+0.25,0.10,0,0,0,gateway);
    addPart(new THREE.BoxGeometry(sbW+1.0,0.34,0.88),outTi,0,-1.85-sbH*0.5-0.25,0.10,0,0,0,gateway);
    for(const sx of [-1,1]){
      addPart(new THREE.BoxGeometry(0.36,sbH+0.9,0.88),outTi,sx*(sbW*0.5+0.36),-1.85,0.10,0,0,0,gateway);
    }
    // 实时比分 CanvasTexture（仅分数/倒计时变化时重绘）
    const sbCv=document.createElement("canvas");sbCv.width=768;sbCv.height=256;
    const sbCtx=sbCv.getContext("2d");
    const sbTex=new THREE.CanvasTexture(sbCv);
    sbTex.encoding=THREE.sRGBEncoding;
    const sbMat=new THREE.MeshBasicMaterial({map:sbTex,fog:false});
    const sbMesh=new THREE.Mesh(new THREE.PlaneGeometry(sbW,sbH),sbMat);
    sbMesh.position.set(0,-1.85,0.44);sbMesh.name="lunarOrbitalScoreboard";
    gateway.add(sbMesh);
    const drawOrbitalBoard=(title,leftLbl,leftVal,rightLbl,rightVal,clockStr,accent)=>{
      const w=sbCv.width,h=sbCv.height,g=sbCtx;
      g.fillStyle="#090c11";g.fillRect(0,0,w,h);
      // 工业深空扫描线网格
      g.fillStyle="rgba(120,195,255,0.045)";
      for(let y=0;y<h;y+=6)g.fillRect(0,y,w,2);
      // 顶部工业状态栏与黄黑警示角标
      g.fillStyle="#161c24";g.fillRect(0,0,w,48);
      g.fillStyle="#d89b28";
      for(let i=0;i<5;i++){
        g.beginPath();g.moveTo(14+i*18,48);g.lineTo(24+i*18,48);g.lineTo(36+i*18,0);g.lineTo(26+i*18,0);g.closePath();g.fill();
        g.beginPath();g.moveTo(w-14-i*18,48);g.lineTo(w-24-i*18,48);g.lineTo(w-36-i*18,0);g.lineTo(w-26-i*18,0);g.closePath();g.fill();
      }
      g.fillStyle="#d8e2ee";g.font="bold 22px Orbitron, monospace";g.textAlign="center";g.textBaseline="middle";
      g.fillText(title,w/2,25);
      // 外框发光边线
      g.strokeStyle=accent||"#5ec8ff";g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);
      // 左/右比分与中央时钟槽
      g.fillStyle="#11161f";
      g.fillRect(28,68,236,162);g.fillRect(w-264,68,236,162);
      g.fillRect(284,68,200,162);
      g.strokeStyle="rgba(216,155,40,0.65)";g.lineWidth=2.5;
      g.strokeRect(28,68,236,162);g.strokeRect(w-264,68,236,162);
      g.strokeStyle="rgba(110,210,255,0.55)";g.strokeRect(284,68,200,162);
      // 左栏
      g.fillStyle="#9cb0c6";g.font="bold 22px Orbitron, monospace";g.fillText(leftLbl,146,98);
      g.fillStyle="#ffbd44";g.font="bold 84px Orbitron, monospace";g.fillText(leftVal,146,174);
      // 中栏时钟
      g.fillStyle="#89b8d8";g.font="bold 20px Orbitron, monospace";g.fillText("ORBIT CLOCK",384,98);
      g.fillStyle="#eaf6ff";g.font="bold 54px Orbitron, monospace";g.fillText(clockStr,384,166);
      g.fillStyle="#66d9ff";g.font="bold 16px Orbitron, monospace";g.fillText("SEC-07 LIVE LINK",384,212);
      // 右栏
      g.fillStyle="#9cb0c6";g.font="bold 22px Orbitron, monospace";g.fillText(rightLbl,w-146,98);
      g.fillStyle="#66d9ff";g.font="bold 84px Orbitron, monospace";g.fillText(rightVal,w-146,174);
      sbTex.needsUpdate=true;
    };
    drawOrbitalBoard("ORBITAL STATION // SEC-07 LIVE","PLAYER","00","TARGET","100","60.0","#5ec8ff");
    // 两侧航空航行频闪信标灯
    const gwBeaconMat=beaconCyan.clone();
    const gwAmberMat=beaconAmber.clone();
    addPart(new THREE.SphereGeometry(0.28,8,6),gwBeaconMat,9.2,2.55,0.2,0,0,0,gateway);
    addPart(new THREE.SphereGeometry(0.28,8,6),gwAmberMat,-9.2,2.55,0.2,0,0,0,gateway);
    gateway.position.set(-10,18.2,-64);
    // These rigid parts share a transform. Keep the separately animated joints and board intact.
    gateway.remove(sbMesh);
    for(const group of [outpost,solarPivot,dishPivot,rover,roverDish,derrick,gateway])AIBAModelDetail.batch(group);
    gateway.add(sbMesh);
    s.root.add(gateway);

    // 深空微流星光迹
    const meteorGeo=new THREE.PlaneGeometry(5.5,0.12);
    const meteorMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
      uniforms:{uOpacity:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float uOpacity;varying vec2 vUv;
        void main(){
          float head=smoothstep(0.0,0.92,vUv.x)*(1.0-smoothstep(0.92,1.0,vUv.x));
          float core=1.0-smoothstep(0.0,0.5,abs(vUv.y-0.5));
          gl_FragColor=vec4(0.82,0.92,1.0,head*core*uOpacity);
        }`
    });
    const meteor=new THREE.Mesh(meteorGeo,meteorMat);
    meteor.position.set(-18,46,-98);meteor.rotation.z=-0.38;meteor.visible=false;
    s.root.add(meteor);

    // 10. 随机多形态自然月海晶石簇（六方水晶柱 / 八面体切面晶块 / 十二面体晶洞 / 斜切板状片晶）+ 切面星芒闪光
    const crystalGrp=new THREE.Group();crystalGrp.name="lunarCrystalClusters";
    const crystalMats=[
      new THREE.MeshPhysicalMaterial({color:0x96eeff,emissive:0x2da6dc,emissiveIntensity:0.20,roughness:0.12,metalness:0.22,clearcoat:0.92,envMap:lEnv,envMapIntensity:1.45,flatShading:true}),
      new THREE.MeshPhysicalMaterial({color:0xffe4aa,emissive:0xd48e28,emissiveIntensity:0.18,roughness:0.14,metalness:0.28,clearcoat:0.88,envMap:lEnv,envMapIntensity:1.38,flatShading:true}),
      new THREE.MeshPhysicalMaterial({color:0xd8caff,emissive:0x785ce0,emissiveIntensity:0.18,roughness:0.12,metalness:0.24,clearcoat:0.90,envMap:lEnv,envMapIntensity:1.42,flatShading:true}),
      new THREE.MeshPhysicalMaterial({color:0xdff8f0,emissive:0x4cc4a6,emissiveIntensity:0.18,roughness:0.10,metalness:0.20,clearcoat:0.95,envMap:lEnv,envMapIntensity:1.50,flatShading:true})
    ];
    const crystalBaseMat=new THREE.MeshStandardMaterial({color:0x484c54,roughness:0.92,metalness:0.06,flatShading:true});
    // 5 种差异化真实天然矿物几何（彻底告别单调圆锥！）
    // (1) 六方天然水晶柱（六棱柱身 + 顶部斜切晶尖）
    const makeHexQuartzGeo=()=>{
      const g=new THREE.CylinderGeometry(0.11,0.14,0.62,6,2);
      const pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){
        const y=pos.getY(i);
        if(y>0.28){pos.setX(i,pos.getX(i)*0.18);pos.setZ(i,pos.getZ(i)*0.18);pos.setY(i,0.44);}
        else if(y>0.0){pos.setX(i,pos.getX(i)*1.08);pos.setZ(i,pos.getZ(i)*0.94);}
      }
      g.translate(0,0.28,0);g.computeVertexNormals();return g;
    };
    const hexQuartzGeo=makeHexQuartzGeo();
    // (2) 八面体钻石/萤石原矿晶块
    const octaGeo=new THREE.OctahedronGeometry(0.22,0);
    // (3) 十二面体晶洞原石
    const dodecaGemGeo=new THREE.DodecahedronGeometry(0.20,0);
    // (4) 斜切层状板晶（扁平不规则六角矿物片）
    const bladeGemGeo=new THREE.CylinderGeometry(0.16,0.19,0.52,5,1);
    bladeGemGeo.scale(1.35,1.0,0.34);bladeGemGeo.translate(0,0.24,0);
    // (5) 截顶不规则斜棱晶柱
    const prismGemGeo=new THREE.CylinderGeometry(0.08,0.16,0.56,4,1);
    prismGemGeo.scale(1.18,1.0,0.72);prismGemGeo.translate(0,0.26,0);
    const crystalGeos=[hexQuartzGeo,octaGeo,dodecaGemGeo,bladeGemGeo,prismGemGeo];

    const glintPos=[],glintSeed=[];
    const crystalSpots=[
      [-10.8,-9.2],[10.6,-8.4],[-12.4,-2.6],[11.9,-1.8],[-11.5,4.8],[12.2,5.6],
      [-9.8,13.5],[10.4,14.2],[-5.8,-14.2],[6.4,-13.6],[-16.2,-12.5],[15.8,-11.8],
      [-15.4,2.4],[16.0,3.2]
    ];
    crystalSpots.forEach(([cx,cz],idx)=>{
      const cy=terrainY(cx,cz);
      const cl=new THREE.Group();cl.position.set(cx,cy,cz);
      // 粗糙玄武岩母岩基座
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.36+s.r()*0.30,0),crystalBaseMat);
      rock.scale.set(1.0+s.r()*0.5,0.46+s.r()*0.32,0.95+s.r()*0.45);
      rock.rotation.set(s.r()*2,s.r()*3,s.r()*2);rock.position.y=0.14;cl.add(rock);
      const mat=crystalMats[idx%crystalMats.length];
      const nPieces=3+((idx*5+2)%4);
      for(let k=0;k<nPieces;k++){
        const geo=crystalGeos[(idx*3+k*2)%crystalGeos.length];
        const sh=new THREE.Mesh(geo,k===0?mat:crystalMats[(idx+k)%crystalMats.length]);
        const a=(k/nPieces)*Math.PI*2+s.r()*0.9;
        const sx=0.55+s.r()*1.05,sy=0.52+s.r()*1.25,sz=0.55+s.r()*1.05;
        sh.scale.set(sx,sy,sz);
        const isChunk=(geo===octaGeo||geo===dodecaGemGeo);
        sh.position.set(Math.cos(a)*(0.12+s.r()*0.18),isChunk?(0.24+s.r()*0.18):0.12,Math.sin(a)*(0.12+s.r()*0.18));
        sh.rotation.set((s.r()-0.5)*0.85,s.r()*Math.PI*2,(s.r()-0.5)*0.85);
        cl.add(sh);
        glintPos.push(cx+sh.position.x,cy+sh.position.y+(isChunk?0.12:sy*0.42),cz+sh.position.z);
        glintSeed.push(s.r()*6.283,0.6+s.r()*1.2,(idx+k)%3);
      }
      // Bake the fixed clusters in four spatial sectors, retaining their original materials.
      const sector=(cx>0?1:0)+(cz>0?2:0);
      while(crystalGrp.children.length<=sector)crystalGrp.add(new THREE.Group());
      for(const piece of cl.children.slice()){
        piece.position.add(cl.position);crystalGrp.children[sector].add(piece);
      }
    });
    for(const sector of crystalGrp.children){
      AIBAModelDetail.batch(sector);
      for(const mesh of sector.children){mesh.castShadow=false;mesh.receiveShadow=false;}
    }
    s.root.add(crystalGrp);
    const glintGeo=new THREE.BufferGeometry();
    glintGeo.setAttribute("position",new THREE.Float32BufferAttribute(glintPos,3));
    glintGeo.setAttribute("aSeed",new THREE.Float32BufferAttribute(glintSeed,3));
    const glintMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      uniforms:{uTime:{value:0},uPower:{value:0.35}},
      vertexShader:`attribute vec3 aSeed;uniform float uTime,uPower;varying float vTw,vKind;
        void main(){
          float tw=pow(max(0.0,sin(uTime*(2.0+aSeed.y*1.6)+aSeed.x*9.0)),4.0);
          vTw=(0.16+0.84*tw)*(0.32+0.82*uPower);
          vKind=aSeed.z;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          float dist=max(1.2,-mv.z);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((36.0+52.0*tw)*(0.52+0.62*uPower)/dist,1.8,19.0);
        }`,
      fragmentShader:`varying float vTw,vKind;
        void main(){
          vec2 p=gl_PointCoord*2.0-1.0;
          float r=length(p);if(r>1.0)discard;
          float star=exp(-abs(p.x)*14.0)*exp(-abs(p.y)*3.2)+exp(-abs(p.y)*14.0)*exp(-abs(p.x)*3.2);
          float core=exp(-r*r*18.0);
          vec3 c=vKind<0.5?vec3(0.65,0.96,1.0):(vKind<1.5?vec3(1.0,0.88,0.55):vec3(0.86,0.78,1.0));
          float a=clamp((core+star*0.85)*vTw,0.0,1.0);
          gl_FragColor=vec4(mix(c,vec3(1.0),core*0.6)*a*1.25,a);
        }`
    });
    const crystalGlints=new THREE.Points(glintGeo,glintMat);
    crystalGlints.name="lunarCrystalGlints";crystalGlints.frustumCulled=false;crystalGlints.renderOrder=7;
    s.root.add(crystalGlints);

    // Basalt outcrops and embedded minerals along the perimeter.
    const floatGrp=new THREE.Group();floatGrp.name="lunarOutcrops";
    const floatGeo=new THREE.DodecahedronGeometry(1,0);
    const floatBasaltMat=new THREE.MeshStandardMaterial({color:0x60646c,roughness:0.88,metalness:0.08,flatShading:true});
    const nFloat=s.mobile?12:20;
    for(let i=0;i<nFloat;i++){
      const ang=(i/nFloat)*Math.PI*2+(s.r()-0.5)*0.26;
      const rad=10.6+s.r()*9.2;
      const fx=Math.sin(ang)*rad,fz=-2.5+Math.cos(ang)*rad*1.12;
      const fy0=terrainY(fx,fz);
      const rg=new THREE.Group();
      const sc=0.16+s.r()*0.30;
      const rock=new THREE.Mesh(floatGeo,floatBasaltMat);
      rock.scale.set(sc*(0.8+s.r()*0.5),sc*(0.6+s.r()*0.45),sc*(0.8+s.r()*0.5));
      rock.castShadow=true;rg.add(rock);
      if(i%3===0){
        const gem=new THREE.Mesh(crystalGeos[(i*2)%crystalGeos.length],crystalMats[i%crystalMats.length]);
        gem.scale.setScalar(sc*0.85);gem.position.set(0,sc*0.28,0);gem.rotation.set(0.4,i,0.35);
        rg.add(gem);
      }
      rg.position.set(fx,fy0+sc*0.35,fz);
      floatGrp.add(rg);
    }
    s.root.add(floatGrp);

    const hare=AIBALunarHare.create(),rabbit=hare.group;
    const rx0=-3.6,rz0=-12.7,ry0=terrainY(rx0,rz0);
    // The halo and motes appear only during the encounter.
    const rabHaloMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      uniforms:{uGlow:{value:0.42},uTime:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 mv=viewMatrix*modelMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uGlow,uTime;varying vec2 vUv;void main(){
        vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;
        float core=exp(-r*r*7.5);
        float ring=exp(-pow((r-0.46)*6.0,2.0))*(0.6+0.4*sin(atan(p.y,p.x)*6.0+uTime*2.5));
        float g=(core*0.55+ring*0.32)*(1.-smoothstep(.55,1.,r));
        vec3 col=mix(vec3(0.22,0.84,1.0),vec3(1.0,0.88,0.48),core*0.45);
        gl_FragColor=vec4(col,g*uGlow*0.72);
      }`
    });
    const rabHalo=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.4),rabHaloMat);
    rabHalo.position.set(0,0.58,0);hare.body.add(rabHalo);
    rabbit.position.set(rx0,ry0,rz0);
    rabbit.visible=false;
    s.root.add(rabbit);

    // 8. 卢比兔移动与闪现魔法的 140 颗发光灵粒拖尾 (Blupee Magic Spirit Motes & Blink Burst)
    const bpCount=s.mobile?80:140;
    const bpPos=new Float32Array(bpCount*3),bpData=new Float32Array(bpCount*3);
    const bpItems=[];
    for(let i=0;i<bpCount;i++){
      bpItems.push({x:rx0,y:ry0+0.6,z:rz0,vx:0,vy:0,vz:0,life:0,maxLife:1.3,size:0.85+s.r()*1.35,kind:i%3});
      bpPos[i*3]=rx0;bpPos[i*3+1]=ry0+0.6;bpPos[i*3+2]=rz0;
      bpData[i*3]=0;bpData[i*3+1]=1.0;bpData[i*3+2]=i%3;
    }
    const bpGeo=new THREE.BufferGeometry();
    bpGeo.setAttribute("position",new THREE.BufferAttribute(bpPos,3));
    bpGeo.setAttribute("aData",new THREE.BufferAttribute(bpData,3));
    const bpMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      vertexShader:`attribute vec3 aData;varying float vLife,vKind;
        void main(){
          vLife=aData.x;vKind=aData.z;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(aData.y*105.0/max(1.2,-mv.z),3.2,24.0)*step(0.01,vLife);
        }`,
      fragmentShader:`varying float vLife,vKind;
        void main(){
          if(vLife<0.01)discard;
          vec2 p=gl_PointCoord*2.0-1.0;
          float r=length(p);if(r>1.0)discard;
          // 塞尔达卢比钻石星芒与柔和灵珠结合
          float diamond=exp(-(abs(p.x)*1.3+abs(p.y))*3.6);
          float orb=exp(-r*r*5.5);
          float shape=mix(orb,diamond,step(1.5,vKind));
          vec3 col=vKind<0.5?vec3(0.38,0.95,1.0):(vKind<1.5?vec3(1.0,0.88,0.42):vec3(0.72,0.98,1.0));
          float a=clamp(shape*sin(vLife*3.14159)*1.35,0.0,1.0);
          gl_FragColor=vec4(mix(col,vec3(1.0),orb*0.55)*a,a);
        }`
    });
    const blupeeTrailMesh=new THREE.Points(bpGeo,bpMat);
    blupeeTrailMesh.name="lunarBlupeeSpiritTrail";blupeeTrailMesh.frustumCulled=false;blupeeTrailMesh.renderOrder=8;
    blupeeTrailMesh.visible=false;s.root.add(blupeeTrailMesh);
    const jadeRabbit={
      ...hare,haloMat:rabHaloMat,x:rx0,y0:ry0,z:rz0,yaw:.55,
      state:"hidden",age:0,stateT:0,duration:0,hops:0,earBeat:0,curious:0,
      trail:{mesh:blupeeTrailMesh,geo:bpGeo,pos:bpPos,data:bpData,items:bpItems,cursor:0}
    };

    // Tiny chips share a point draw. Only revealed chips take part in the wake simulation.
    const swarmN=s.mobile?156:224;
    const swPos=new Float32Array(swarmN*3),swShape=new Float32Array(swarmN*4);
    const swWake=new Float32Array(swarmN*4),swBirth=new Float32Array(swarmN);
    const swItems=[];
    for(let i=0;i<swarmN;i++){
      let hx,hy,hz;
      const zone=i%10;
      if(i<3||zone<5){
        const reach=i<3?1.4:6.1;
        const rad=.65+Math.pow(s.r(),1.2)*reach,angle=s.r()*Math.PI*2;
        hx=HOOP.x+Math.cos(angle)*rad;
        hy=HOOP.y+.3+(s.r()-.43)*(i<3?1.35:3.7);
        hz=HOOP.z+Math.sin(angle)*rad*.88;
      }else if(zone<9){
        const along=s.r();
        hz=HOOP.z-.4+along*11.8;
        hx=(s.r()-.5)*(4.0+along*6.5);
        hy=1.15+Math.sin(along*Math.PI)*2.45+(s.r()-.38)*2.15;
      }else{
        const angle=s.r()*Math.PI*2,rad=5.5+s.r()*7.5;
        hx=Math.cos(angle)*rad;
        hz=-2.5+Math.sin(angle)*rad*.92;
        hy=.75+s.r()*3.8;
      }
      const azimuth=s.r()*Math.PI*2,elevation=(s.r()-.5)*1.4;
      const birth=i<3?i*.47:1.8+27*Math.pow((i-2)/(swarmN-3),.79);
      const phase=s.r()*Math.PI*2,rate=.32+s.r()*.48;
      swItems.push({
        hx,hy,hz,birth,phase,rate,dx:0,dy:0,dz:0,vx:0,vy:0,vz:0,
        sx:Math.cos(azimuth)*Math.cos(elevation),sy:Math.sin(elevation),sz:Math.sin(azimuth)*Math.cos(elevation),excited:0
      });
      swPos.set([hx,hy,hz],i*3);
      swShape.set([phase,rate,.62+s.r()*.46,s.r()],i*4);
      swBirth[i]=birth;
    }
    const swGeo=new THREE.BufferGeometry();
    swGeo.setAttribute("position",new THREE.BufferAttribute(swPos,3));
    swGeo.setAttribute("aShape",new THREE.BufferAttribute(swShape,4));
    swGeo.setAttribute("aBirth",new THREE.BufferAttribute(swBirth,1));
    swGeo.setAttribute("aWake",new THREE.BufferAttribute(swWake,4).setUsage(THREE.DynamicDrawUsage));
    swGeo.setDrawRange(0,0);
    const swMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      uniforms:{uClock:{value:0},uAge:{value:0},uBrightness:{value:1},uPixels:{value:1}},
      vertexShader:`attribute vec4 aShape,aWake;attribute float aBirth;
        uniform float uClock,uAge,uBrightness,uPixels;
        varying float vGlow,vSeed;varying vec2 vTurn;
        void main(){
          float phase=aShape.x,rate=aShape.y,tt=uClock*rate+phase;
          float age=uAge-aBirth,fade=smoothstep(0.,1.05,age);
          vec3 drift=vec3(sin(tt*.76)*.32,sin(tt*.98+phase)*.24,cos(tt*.68-phase)*.30);
          vec3 p=position+drift+aWake.xyz;
          p.y=max(.28,p.y)*mix(.72,1.,smoothstep(0.,2.8,age));
          vec4 mv=modelViewMatrix*vec4(p,1.);
          float distance=-mv.z;
          float flicker=.60+.40*sin(uClock*(1.4+rate)+phase*7.);
          vSeed=aShape.w;
          vGlow=fade*uBrightness*(.50+.50*flicker)*smoothstep(.55,1.65,distance);
          vGlow*=1.+min(aWake.w,.75)*.22;
          float angle=phase+sin(tt*.46)*.65;
          vTurn=vec2(cos(angle),sin(angle));
          gl_Position=projectionMatrix*mv;
          // Cap the entire point, including its halo, in CSS pixels even in a near-camera pass.
          gl_PointSize=uPixels*clamp(aShape.z*(1.85+17./max(1.,distance)),1.45,4.8);
        }`,
      fragmentShader:`varying float vGlow,vSeed;varying vec2 vTurn;
        void main(){
          vec2 p=gl_PointCoord*2.-1.;
          vec2 q=vec2(dot(p,vTurn),dot(p,vec2(-vTurn.y,vTurn.x)));
          float radius=dot(p,p);
          float halo=exp(-radius*5.5)*(1.-smoothstep(.48,1.,radius));
          // A sliver biased to one edge, with a chipped tip and a darker broken face.
          float edge=max(abs(q.y+q.x*(vSeed-.45))*(2.1+vSeed),max(q.x*.98-q.y*.44,-q.x*1.32-q.y*.79));
          float chip=(1.-smoothstep(.21,.47,edge))*(.58+.42*smoothstep(-.22,.12,q.x-q.y));
          vec3 tint=mix(vec3(.55,.78,.83),vec3(.83,.74,.61),smoothstep(.69,.93,vSeed));
          gl_FragColor=vec4(tint,vGlow*(halo*.29+chip*.65));
        }`
    });
    const hoopSwarmMesh=new THREE.Points(swGeo,swMat);
    hoopSwarmMesh.name="lunarHoopRegolithDust";hoopSwarmMesh.frustumCulled=false;hoopSwarmMesh.renderOrder=7;
    const particleViewport=new THREE.Vector4();
    hoopSwarmMesh.onBeforeRender=renderer=>{
      renderer.getCurrentViewport(particleViewport);
      swMat.uniforms.uPixels.value=particleViewport.w/Math.max(1,renderer.domElement.clientHeight||particleViewport.w);
    };
    hoopSwarmMesh.visible=false;s.root.add(hoopSwarmMesh);
    const hoopSwarm={mesh:hoopSwarmMesh,geo:swGeo,offsets:swWake,items:swItems,age:0,count:0};

    // 13. 3A 级高精度阿波罗/阿尔忒弥斯舱外宇航员 (3A Articulated EVA Astronauts)
    // 分段式硬壳胸甲、波纹腰环、双氧气瓶 PLSS 背包+通讯鞭状天线、胸前遥测控制盒 (DCM)、双层镀金遮阳头盔+两侧探照灯、折叠肘/膝关节，以及「巡线漫步/驻足勘探/抬头看球/偶发失重高跳」非重复 AI！
    const astroGrp=new THREE.Group();astroGrp.name="lunarHoppingAstronauts";
    const suitWhite=new THREE.MeshStandardMaterial({color:0xf0f3f7,roughness:0.46,metalness:0.10});
    const suitFabric=new THREE.MeshStandardMaterial({color:0xd8dde6,roughness:0.68,metalness:0.08});
    const suitJoint=new THREE.MeshStandardMaterial({color:0x3e444f,roughness:0.55,metalness:0.38});
    const suitRed=new THREE.MeshStandardMaterial({color:0xd93829,roughness:0.42,metalness:0.15});
    const suitBlue=new THREE.MeshStandardMaterial({color:0x2563eb,roughness:0.42,metalness:0.20});
    const visorGold=new THREE.MeshPhysicalMaterial({color:0xf6be4f,roughness:0.09,metalness:0.96,clearcoat:0.9,envMap:lEnv,envMapIntensity:1.55});
    const visorInner=new THREE.MeshStandardMaterial({color:0x151922,roughness:0.25,metalness:0.6});
    const packMat=new THREE.MeshStandardMaterial({color:0xcad0da,roughness:0.38,metalness:0.48});
    const ledCyanMat=new THREE.MeshBasicMaterial({color:0x5ce8ff});
    const ledAmberMat=new THREE.MeshBasicMaterial({color:0xffb838});
    const astronauts=[];
    for(const stripeMat of [suitRed,suitBlue,suitRed]){
      const ag=new THREE.Group();
      const body=new THREE.Group();body.position.y=0.94;ag.add(body);
      // 1. 分段式硬壳胸甲 (HUT) + 指挥官红/蓝肩带 + 波纹腰环 + 髋部裤甲
      const upperTorso=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.24,0.44,14),suitWhite);
      upperTorso.scale.set(1.12,1.0,0.82);upperTorso.position.y=0.14;body.add(upperTorso);
      const shoulderBar=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.68,12),suitWhite);
      shoulderBar.rotation.z=Math.PI*0.5;shoulderBar.position.set(0,0.29,0);body.add(shoulderBar);
      for(const sd of [-1,1]){
        const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.114,0.114,0.08,12),stripeMat);
        stripe.rotation.z=Math.PI*0.5;stripe.position.set(sd*0.24,0.29,0);body.add(stripe);
      }
      const waistBellows=new THREE.Mesh(new THREE.CylinderGeometry(0.23,0.23,0.14,14),suitJoint);
      waistBellows.scale.set(1.06,1.0,0.80);waistBellows.position.y=-0.12;body.add(waistBellows);
      const pelvis=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.22,0.20,12),suitFabric);
      pelvis.scale.set(1.08,1.0,0.82);pelvis.position.y=-0.27;body.add(pelvis);

      // 2. 胸前遥测控制盒 (DCM) + 发光仪表镜片与调压旋钮
      const dcm=new THREE.Group();dcm.position.set(0,0.12,0.21);body.add(dcm);
      dcm.add(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.21,0.11),packMat));
      const dcmScreen=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.08,0.02),visorInner);
      dcmScreen.position.set(-0.04,0.03,0.055);dcm.add(dcmScreen);
      const dcmLed1=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,6),ledCyanMat);
      dcmLed1.position.set(0.08,0.05,0.056);dcm.add(dcmLed1);
      const dcmLed2=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,6),ledAmberMat);
      dcmLed2.position.set(0.08,-0.01,0.056);dcm.add(dcmLed2);
      const patch=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.038,0.015,10),suitBlue);
      patch.rotation.x=Math.PI*0.5;patch.position.set(-0.14,0.24,0.19);body.add(patch);

      // 3. PLSS 生命维持大背包 + 双圆柱高压氧气罐 + 顶部散热格栅 + UHF 鞭状天线
      const plss=new THREE.Group();plss.position.set(0,0.12,-0.25);body.add(plss);
      plss.add(new THREE.Mesh(new THREE.BoxGeometry(0.46,0.62,0.22),packMat));
      const plssTop=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.12,0.25),suitWhite);
      plssTop.position.set(0,0.28,0.01);plss.add(plssTop);
      for(const sx of [-0.13,0.13]){
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(0.082,0.082,0.50,12),suitWhite);
        tank.position.set(sx,-0.02,-0.08);plss.add(tank);
        const cap=new THREE.Mesh(new THREE.SphereGeometry(0.082,10,8),packMat);
        cap.position.set(sx,0.23,-0.08);plss.add(cap);
      }
      const antMast=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.014,0.42,6),packMat);
      antMast.position.set(0.18,0.52,-0.04);plss.add(antMast);
      const antTip=new THREE.Mesh(new THREE.SphereGeometry(0.024,6,6),ledAmberMat);
      antTip.position.set(0.18,0.74,-0.04);plss.add(antTip);

      // 4. 独立可转动颈环与双层面罩头盔 (LEVA Helmet: 白外罩 + 内层黑压差面罩 + 外层曲面真金遮阳罩 + 两侧探照灯)
      const neckRing=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.026,8,16),suitJoint);
      neckRing.rotation.x=Math.PI*0.5;neckRing.position.set(0,0.37,0);body.add(neckRing);
      const head=new THREE.Group();head.position.set(0,0.54,0);body.add(head);
      const outerHood=new THREE.Mesh(new THREE.SphereGeometry(0.245,16,14),suitWhite);
      outerHood.scale.set(0.96,1.02,1.04);head.add(outerHood);
      const innerBubble=new THREE.Mesh(new THREE.SphereGeometry(.236,20,14),visorInner);
      innerBubble.scale.set(.95,.79,.56);innerBubble.position.set(0,.011,.147);head.add(innerBubble);
      const goldShield=new THREE.Mesh(new THREE.SphereGeometry(.224,24,16),visorGold);
      goldShield.scale.set(.96,.75,.56);goldShield.position.set(0,.017,.167);head.add(goldShield);
      const visorBrow=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.045,0.18),suitWhite);
      visorBrow.position.set(0,0.19,0.08);head.add(visorBrow);
      for(const sd of [-1,1]){
        const earPod=new THREE.Mesh(new THREE.CylinderGeometry(0.042,0.042,0.08,10),packMat);
        earPod.rotation.z=Math.PI*0.5;earPod.position.set(sd*0.24,0.02,0.02);head.add(earPod);
        const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.024,6,6),ledCyanMat);
        lamp.position.set(sd*0.24,0.02,0.065);head.add(lamp);
      }

      // 5. 二段关节可动双臂 (上臂 + 波纹肘关节 + 前臂 + 手腕轴承 + 灰色宇航手套)
      const armL=new THREE.Group();armL.position.set(-0.34,0.27,0);body.add(armL);
      const armR=new THREE.Group();armR.position.set(0.34,0.27,0);body.add(armR);
      let foreArmL=null,foreArmR=null;
      for(const [arm,sd] of [[armL,-1],[armR,1]]){
        const shoulderJoint=new THREE.Mesh(new THREE.SphereGeometry(0.105,10,8),suitJoint);
        arm.add(shoulderJoint);
        const upperArm=new THREE.Mesh(new THREE.CylinderGeometry(0.092,0.082,0.28,10),suitWhite);
        upperArm.position.set(sd*0.02,-0.15,0);arm.add(upperArm);
        const foreArm=new THREE.Group();foreArm.position.set(sd*0.03,-0.29,0);arm.add(foreArm);
        if(sd<0)foreArmL=foreArm;else foreArmR=foreArm;
        const elbowJoint=new THREE.Mesh(new THREE.SphereGeometry(0.082,10,8),suitJoint);
        foreArm.add(elbowJoint);
        const lowerArm=new THREE.Mesh(new THREE.CylinderGeometry(0.080,0.072,0.26,10),suitWhite);
        lowerArm.position.set(0,-0.13,0);foreArm.add(lowerArm);
        const wristRing=new THREE.Mesh(new THREE.TorusGeometry(0.068,0.015,6,12),stripeMat);
        wristRing.rotation.x=Math.PI*0.5;wristRing.position.set(0,-0.25,0);foreArm.add(wristRing);
        const glove=new THREE.Mesh(new THREE.SphereGeometry(0.078,10,8),suitJoint);
        glove.scale.set(0.88,1.18,1.02);glove.position.set(0,-0.32,0.02);foreArm.add(glove);
      }

      // 6. 二段关节可动双腿 (大腿 + 指挥官色环 + 波纹膝关节 + 小腿 + 螺纹厚底登月靴)
      const legL=new THREE.Group();legL.position.set(-0.15,-0.34,0);body.add(legL);
      const legR=new THREE.Group();legR.position.set(0.15,-0.34,0);body.add(legR);
      let shinL=null,shinR=null;
      for(const [leg,sd] of [[legL,-1],[legR,1]]){
        const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.112,0.098,0.30,10),suitWhite);
        thigh.position.y=-0.15;leg.add(thigh);
        const thighStripe=new THREE.Mesh(new THREE.CylinderGeometry(0.108,0.105,0.055,10),stripeMat);
        thighStripe.position.y=-0.20;leg.add(thighStripe);
        const shin=new THREE.Group();shin.position.set(0,-0.30,0);leg.add(shin);
        if(sd<0)shinL=shin;else shinR=shin;
        const kneeJoint=new THREE.Mesh(new THREE.SphereGeometry(0.095,10,8),suitJoint);
        shin.add(kneeJoint);
        const calf=new THREE.Mesh(new THREE.CylinderGeometry(0.096,0.088,0.28,10),suitFabric);
        calf.position.y=-0.14;shin.add(calf);
        const bootUpper=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.11,0.29),suitWhite);
        bootUpper.position.set(0,-0.29,0.045);shin.add(bootUpper);
        const bootSole=new THREE.Mesh(new THREE.BoxGeometry(0.195,0.045,0.31),suitJoint);
        bootSole.position.set(0,-0.345,0.048);shin.add(bootSole);
      }

      bindLunarSuit(ag,[body,head,armL,armR,foreArmL,foreArmR,legL,legR,shinL,shinR]);
      ag.visible=false;
      const cameraRig=new THREE.Group();cameraRig.position.set(0,-.35,.045);foreArmR.add(cameraRig);
      addPart(new THREE.BoxGeometry(.235,.16,.112),outGun,0,0,0,0,0,0,cameraRig);
      addPart(new THREE.CylinderGeometry(.062,.073,.115,14),outSil,0,0,.10,Math.PI/2,0,0,cameraRig);
      addPart(new THREE.CylinderGeometry(.052,.052,.012,14),outSolar,0,0,.16,Math.PI/2,0,0,cameraRig);
      const flash=addPart(new THREE.SphereGeometry(.043,8,6),beaconAmber,.081,.058,.063,0,0,0,cameraRig);
      flash.visible=false;cameraRig.visible=false;
      astroGrp.add(ag);
      astronauts.push({
        group:ag,body,head,cameraRig,flash,aim:new THREE.Vector3(),
        armL,armR,foreArmL,foreArmR,
        legL,legR,shinL,shinR,
        mode:"aboard",modeT:0,modeDur:0,curYaw:0,lastPhoto:null,
        stop:0,nextStop:0,patrolSpeed:.76+Math.random()*.22,
        celebrateT:0,leap:0
      });
    }
    s.root.add(astroGrp);

    // 14. 仅保留 1 台精致点缀的工业巡检无人机（放在外围偏高处安静跟球，绝不遮挡篮筐与视线！）
    const droneGrp=new THREE.Group();droneGrp.name="lunarReconDrones";
    const drones=[];
    const droneEyeMat=new THREE.MeshBasicMaterial({color:0x66e8ff});
    const droneHotMat=new THREE.MeshBasicMaterial({color:0xffc444});
    const droneHomes=[[5.2,4.3,-9.6]];
    for(let i=0;i<droneHomes.length;i++){
      const [hx,hy,hz]=droneHomes[i];
      const dg=new THREE.Group();
      const shell=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,10),outGun);dg.add(shell);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.022,6,16),outSil);
      ring.rotation.x=Math.PI/2;dg.add(ring);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),droneEyeMat.clone());
      eye.position.set(0,0,0.15);dg.add(eye);
      dg.position.set(hx,hy+12,hz);dg.visible=false;
      droneGrp.add(dg);
      drones.push({group:dg,eyeMat:eye.material,hx,hy,hz,dx:0,dy:0,dz:0,vx:0,vy:0,vz:0,phase:i*1.37,flashT:0});
    }
    s.root.add(droneGrp);

    // 15. 轨道补给着陆器垂直反推降落 + 采矿塔 1/6G 尘柱 + 日全食篮筐工业补光灯
    const lander=new THREE.Group();lander.name="lunarSupplyLander";
    const lx=5.2,lz=-19.8,ly0=terrainY(lx,lz);
    // Leave the near facet open. The sealed hatch becomes the actual boarding ramp.
    for(const [top,bottom,height,y,mat] of [[1.30,1.48,1.38,1.55,outGold],[1.16,1.30,1.04,2.76,outTi]]){
      addPart(new THREE.CylinderGeometry(top,bottom,height,7,1,true,Math.PI/8,Math.PI*1.75),mat,0,y,0,0,0,0,lander);
    }
    addPart(new THREE.CylinderGeometry(1.46,1.4,.16,8),outGun,0,.85,0,0,Math.PI/8,0,lander);
    addPart(new THREE.CylinderGeometry(1.15,1.19,.14,8),outSil,0,3.28,0,0,Math.PI/8,0,lander);
    addPart(new THREE.BoxGeometry(2.16,2.38,.18),outGun,0,2.06,-.4,0,0,0,lander);
    for(const side of [-1,1]){
      addPart(new THREE.BoxGeometry(.11,2.28,.14),outSil,side*.59,2.04,1.14,0,0,0,lander);
      addPart(new THREE.BoxGeometry(.34,.30,.08),outGun,side*.87,2.64,.94,0,side*.65,0,lander);
      addPart(new THREE.BoxGeometry(.24,.19,.09),outSolar,side*.88,2.64,.97,0,side*.65,0,lander);
    }
    addPart(new THREE.BoxGeometry(1.24,.12,.19),outGold,0,3.17,1.04,0,0,0,lander);
    const hatch=new THREE.Group();hatch.position.set(0,.92,1.26);lander.add(hatch);
    addPart(new THREE.BoxGeometry(1.08,2.28,.11),outTi,0,1.14,0,0,0,0,hatch);
    for(let i=0;i<7;i++)addPart(new THREE.BoxGeometry(.94,.046,.044),outGun,0,.22+i*.30,-.072,0,0,0,hatch);
    for(const side of [-1,1])addPart(new THREE.BoxGeometry(.052,2.25,.13),outGold,side*.526,1.14,0,0,0,0,hatch);
    for(const a of [0.78,2.35,3.92,5.50]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.8,8),outSil);
      leg.position.set(Math.cos(a)*1.45,0.75,Math.sin(a)*1.45);
      leg.rotation.set(-Math.sin(a)*.53,0,Math.cos(a)*.53);
      lander.add(leg);
      addPart(new THREE.CylinderGeometry(0.22,0.28,0.08,10),outGun,Math.cos(a)*1.95,0.04,Math.sin(a)*1.95,0,0,0,lander);
    }
    const flameMat=new THREE.MeshBasicMaterial({color:0x7ad8ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    const flameCone=new THREE.Mesh(new THREE.ConeGeometry(0.65,3.8,12,1,true),flameMat);
    flameCone.position.set(0,-1.1,0);flameCone.rotation.x=Math.PI;lander.add(flameCone);
    const dustRingMat=new THREE.MeshBasicMaterial({color:0xd8ccb8,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
    const dustRing=new THREE.Mesh(new THREE.RingGeometry(1.2,2.8,24),dustRingMat);
    dustRing.rotation.x=-Math.PI/2;dustRing.position.set(lx,ly0+0.12,lz);
    s.root.add(dustRing);
    lander.position.set(lx,ly0+36,lz);lander.visible=false;
    AIBAModelDetail.batch(hatch);
    s.root.add(lander);

    // 采矿塔 1/6G 钻探尘柱
    const plumeMat=new THREE.MeshBasicMaterial({color:0xbec4ce,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
    const derrickPlume=new THREE.Mesh(new THREE.ConeGeometry(2.6,12.5,12,1,true),plumeMat);
    derrickPlume.position.set(-25,terrainY(-25,-44)+6.8,-44);
    s.root.add(derrickPlume);

    // 日全食红月阶段自动点亮的工业篮筐泛光补光灯
    const lunarHoopLight=new THREE.PointLight(0xfff0d4,0,15,1.7);
    lunarHoopLight.name="lunarHoopEclipseLight";
    lunarHoopLight.position.set(HOOP.x,HOOP.y+0.85,HOOP.z+1.1);
    s.root.add(lunarHoopLight);

    s.wonder={
      kind:"lunar",earth,starMat,suit1,suit2,
      solarCorona,shaftMat,horizonGlow,lunarDust,
      dishPivot,solarPivot,cornerBeacons,derrickBeaconMat,
      rover,roverWheels,roverDish,roverBeaconMat,terrainY,
      gateway,gwBeaconMat,gwAmberMat,drawOrbitalBoard,orbitalBoardKey:"",
      meteor,meteorMat,
      // Lunar Living World state (Crimson-Ring Eclipse + Varied Crystals + Floating Rocks + Jade Rabbit + Hopping Astronauts + 1 Drone + Lander)
      progress:0,progressVel:0,targetProgress:0,eclipseAmount:0,stage:"apolloDay",
      crystalMats,glintMat,jadeRabbit,
      hoopSwarm,astronauts,drones,droneHotMat,
      lander,hatch,missionTime:-1,makes:0,contacts:0,hareVisit:Math.random()<.32,landerHome:{x:lx,y:ly0,z:lz},flameMat,dustRing,dustRingMat,
      derrickPlume,plumeMat,lunarHoopLight
    };
  }
  function tokyo(s,b,{batch}){
    // 1. 摩天大楼主体结构（从天台下方延伸至 -68m 深渊）
    b.box(0x161b24,0,-34.25,6,31.6,68.1,38.0);
    // 天台边缘混凝土女儿墙与金属压顶
    const px=15.6,zMin=-12.8,zMax=24.8,zMid=(zMin+zMax)*.5,zLen=zMax-zMin;
    b.box(0x28303d,0,.11,zMin,px*2+.4,.24,.38);
    b.box(0x28303d,0,.11,zMax,px*2+.4,.24,.38);
    b.box(0x28303d,-px,.11,zMid,.38,.24,zLen+.4);
    b.box(0x28303d,px,.11,zMid,.38,.24,zLen+.4);
    // 无框强化玻璃护栏（立柱 + 顶部扶手 + 半透明玻璃板）
    const railH=1.18;
    for(let x=-px;x<=px+.01;x+=3.9){
      b.box(0x3a4454,x,.68,zMin,.07,.96,.07);
      b.box(0x3a4454,x,.68,zMax,.07,.96,.07);
    }
    for(let z=zMin+3.8;z<zMax-.5;z+=3.8){
      b.box(0x3a4454,-px,.68,z,.07,.96,.07);
      b.box(0x3a4454,px,.68,z,.07,.96,.07);
    }
    b.box(0x4c586b,0,railH,zMin,px*2+.16,.055,.09);
    b.box(0x4c586b,0,railH,zMax,px*2+.16,.055,.09);
    b.box(0x4c586b,-px,railH,zMid,.09,.055,zLen+.16);
    b.box(0x4c586b,px,railH,zMid,.09,.055,zLen+.16);
    const glassMat=new THREE.MeshBasicMaterial({color:0x7eb8f0,transparent:true,opacity:0.12,depthWrite:false,side:THREE.DoubleSide});
    const addGlass=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),glassMat);m.position.set(x,y,z);s.root.add(m);};
    addGlass(px*2-.1,.9,0.03,0,.68,zMin);
    addGlass(px*2-.1,.9,0.03,0,.68,zMax);
    addGlass(0.03,.9,zLen-.1,-px,.68,zMid);
    addGlass(0.03,.9,zLen-.1,px,.68,zMid);

    // 2. 四角专业球场夜间 LED 泛光灯柱 + 天台空调外机/通道间
    const lampGlow=batch();
    for(const sx of [-1,1])for(const sz of [1,-1]){
      const lx=sx*13.6,lz=sz<0?-11.2:22.8;
      b.box(0x242b38,lx,3.8,lz,.22,7.6,.22);
      b.box(0x1b202b,lx,7.55,lz,sx*-.45,.18,.65,0,sx*.42,0);
      lampGlow.box(0xfff6e5,lx-sx*.14,7.46,lz,.18,.38,.78,0,sx*.42,0);
    }
    // 场外远端设备间（不遮挡前向铁塔视野）
    b.box(0x232a36,12.6,1.15,21.5,3.4,2.3,3.8);
    b.box(0x313a4a,12.6,2.35,21.5,3.6,.14,4.0);
    lampGlow.box(0x7dd3fc,10.88,1.5,21.5,.04,.5,.9);

    // 四角红色航空警示灯（呼吸闪烁）
    const beacons=[];
    const beaconGeo=new THREE.SphereGeometry(.16,8,6);
    const makeBeacon=(x,y,z,phase,size=1)=>{
      const mat=new THREE.MeshBasicMaterial({color:0xff2820});
      const m=new THREE.Mesh(beaconGeo,mat);m.position.set(x,y,z);m.scale.setScalar(size);
      s.root.add(m);beacons.push({m,mat,phase});
    };
    for(const sx of [-1,1])for(const sz of [-1,1])makeBeacon(sx*(px-.1),1.38,sz<0?zMin:zMax,sx+sz,.95);

    // 3. 100% 程序化东京写实天际线建模（对标实拍夜景光感：钢青玻璃反光外墙 + 冰青/暖金/琥珀五光十色灯带）
    const makeNaturalFacade=(style,seed)=>{
      const cv=document.createElement("canvas");cv.width=512;cv.height=1024;
      const g=cv.getContext("2d"),r=AIBAWorldPlaces.rng(seed);
      // 城市夜空环境光映照下的钢青/石板蓝玻璃幕墙底色（不再一片死黑）
      const bg=g.createLinearGradient(0,0,0,1024);
      if(style==="office"){bg.addColorStop(0,"#1c2d47");bg.addColorStop(0.55,"#16243a");bg.addColorStop(1,"#202b3d");}
      else if(style==="res"){bg.addColorStop(0,"#1c2333");bg.addColorStop(0.6,"#171c29");bg.addColorStop(1,"#26242a");}
      else{bg.addColorStop(0,"#152236");bg.addColorStop(1,"#1d2a3d");}
      g.fillStyle=bg;g.fillRect(0,0,512,1024);

      // 细微幕墙反光层（模拟都市霓虹漫反射）
      g.fillStyle=style==="office"?"rgba(96,165,250,0.08)":"rgba(251,191,36,0.06)";
      for(let y=12;y<1010;y+=28)g.fillRect(8,y,496,2);

      if(style==="office"){
        // 写字楼：约 42% 楼层亮灯，成片冰青/纯白/暖金水平办公灯带 + 核心筒留暗
        const coreX=180+r()*120,coreW=32+r()*36;
        for(let y=16;y<1008;y+=14){
          const floorRoll=r();
          if(floorRoll<0.55)continue;
          const segStart=floorRoll>0.82?12:(r()*180);
          const segEnd=floorRoll>0.82?500:(segStart+120+r()*260);
          const tone=r()>0.42?"#e8f7ff":r()>0.48?"#ffe299":"#93e5ff";
          g.fillStyle=tone;
          for(let x=segStart;x<Math.min(500,segEnd);x+=13){
            if(x>coreX&&x<coreX+coreW)continue;
            if(r()<0.14)continue;
            g.globalAlpha=0.82+r()*0.18;
            g.fillRect(x,y,10,7);
          }
        }
        g.globalAlpha=1;
        g.fillStyle="rgba(165,220,255,0.55)";g.fillRect(10,6,492,4);
      }else if(style==="res"){
        // 塔楼住宅/酒店：暖琥珀/金黄/象牙白错落亮窗（约 34% 亮灯率）+ 底层商业暖光
        for(let y=18;y<1008;y+=15){
          for(let x=12;x<496;x+=16){
            if(r()>0.34)continue;
            g.fillStyle=r()>0.45?"#ffd875":r()>0.5?"#fff3d6":"#ffab5e";
            g.globalAlpha=0.78+r()*0.22;
            g.fillRect(x,y,10,7);
          }
        }
        g.globalAlpha=1;
        g.fillStyle="rgba(255,200,110,0.45)";g.fillRect(0,986,512,38);
      }else{
        // 中景混色楼宇：冷白/青绿/品红点缀（呼应街区五光十色霓虹）
        for(let y=20;y<1004;y+=16){
          if(r()>0.36)continue;
          const col=r()>0.65?"#bae6fd":r()>0.35?"#fde68a":r()>0.5?"#6ee7b7":"#f9a8d4";
          g.fillStyle=col;
          for(let x=16;x<490;x+=17)if(r()<0.55){g.globalAlpha=0.72+r()*0.25;g.fillRect(x,y,11,6);}
        }
        g.globalAlpha=1;
        g.fillStyle="rgba(56,189,248,0.35)";g.fillRect(0,992,512,32);
      }
      const tex=new THREE.CanvasTexture(cv);
      tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
      tex.anisotropy=4;
      if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
      return tex;
    };
    const matOffice=new THREE.MeshBasicMaterial({map:makeNaturalFacade("office",10931)});
    const matRes=new THREE.MeshBasicMaterial({map:makeNaturalFacade("res",20477)});
    const matSil=new THREE.MeshBasicMaterial({map:makeNaturalFacade("sil",30881)});

    // 合并多种几何体生成真实东京大厦外轮廓模板（标准体在 y∈[-0.5, 0.5] 内）
    const mergeGeos=(parts)=>{
      let totVerts=0;
      const nonIdx=parts.map(g=>{
        const ng=g.index?g.toNonIndexed():g;
        totVerts+=ng.attributes.position.count;
        return ng;
      });
      const pos=new Float32Array(totVerts*3),uv=new Float32Array(totVerts*2);
      let offP=0,offU=0;
      nonIdx.forEach(ng=>{
        pos.set(ng.attributes.position.array,offP);
        if(ng.attributes.uv)uv.set(ng.attributes.uv.array,offU);
        offP+=ng.attributes.position.count*3;
        offU+=ng.attributes.position.count*2;
        ng.dispose();
      });
      const out=new THREE.BufferGeometry();
      out.setAttribute("position",new THREE.BufferAttribute(pos,3));
      out.setAttribute("uv",new THREE.BufferAttribute(uv,2));
      out.computeVertexNormals();
      return out;
    };
    // 模板 A：六本木森大厦式退台八角/切角塔楼（底座+中段+退台冠部）
    const geoSetback=(()=>{
      const p1=new THREE.BoxGeometry(1,.42,1);p1.translate(0,-.29,0);
      const p2=new THREE.BoxGeometry(.80,.40,.80);p2.translate(0,.12,0);
      const p3=new THREE.BoxGeometry(.54,.18,.54);p3.translate(0,.41,0);
      return mergeGeos([p1,p2,p3]);
    })();
    // 模板 B：圆柱/切角流线摩天楼（虎之门/品川风格）
    const geoCyl=new THREE.CylinderGeometry(.46,.56,1,10,1);
    // 模板 C：斜切顶面现代玻璃大厦
    const geoSlant=(()=>{
      const g=new THREE.BoxGeometry(1,1,1);
      const p=g.attributes.position;
      for(let i=0;i<p.count;i++){
        if(p.getY(i)>0&&p.getX(i)>0)p.setY(i,0.32);
      }
      return g;
    })();
    // 模板 D：双子/错落组合办公楼
    const geoTwin=(()=>{
      const p1=new THREE.BoxGeometry(.58,1,.92);p1.translate(-.21,0,0);
      const p2=new THREE.BoxGeometry(.52,.78,.82);p2.translate(.22,-.11,.04);
      return mergeGeos([p1,p2]);
    })();

    // 远景深色城市大地基底（1600m x 1600m 东京都心盆地，y=-44m 让 150m~750m 的街区与主干道完整显露于玻璃护栏外）
    const cityGround=new THREE.Mesh(
      new THREE.PlaneGeometry(1600,1600),
      new THREE.MeshBasicMaterial({color:0x02050b})
    );
    cityGround.rotation.x=-Math.PI/2;cityGround.position.set(0,-44,-180);s.root.add(cityGround);

    // 9000 颗超远景城市灯火与主干道街灯点阵（铺展至 760m 地平线）
    const ptCount=s.mobile?4500:9000;
    const ptPos=new Float32Array(ptCount*3),ptCol=new Float32Array(ptCount*3);
    const pal=[[1,.88,.70],[1,.70,.36],[.55,.82,1],[1,.34,.28],[.92,.95,1]];
    for(let i=0;i<ptCount;i++){
      let pxPt,pzPt,pyPt;
      if(i<ptCount*0.35){
        // 沿东西/南北城市主干道网格分布的街灯串（每隔 65m 一条大道）
        const roadIdx=(i%18)-9;
        const along=(s.r()-.5)*1350;
        if(i%2===0){pxPt=roadIdx*68+(s.r()-.5)*4;pzPt=along-160;}
        else{pxPt=along;pzPt=roadIdx*68-160+(s.r()-.5)*4;}
        pyPt=-43.2+s.r()*1.8;
      }else{
        const ang=s.r()*Math.PI*2,rad=110+Math.pow(s.r(),.68)*650;
        pxPt=Math.cos(ang)*rad;
        pzPt=Math.sin(ang)*rad-150;
        pyPt=-43+s.r()*38;
      }
      if(Math.hypot(pxPt,pzPt)<42){pxPt=(i%2?1:-1)*180;pzPt=-180-s.r()*300;}
      ptPos[i*3]=pxPt;ptPos[i*3+1]=pyPt;ptPos[i*3+2]=pzPt;
      const c=pal[i%pal.length];
      ptCol[i*3]=c[0];ptCol[i*3+1]=c[1];ptCol[i*3+2]=c[2];
    }
    const ptGeo=new THREE.BufferGeometry();
    ptGeo.setAttribute("position",new THREE.BufferAttribute(ptPos,3));
    ptGeo.setAttribute("color",new THREE.BufferAttribute(ptCol,3));
    const ptMat=new THREE.PointsMaterial({size:2.3,vertexColors:true,transparent:true,opacity:.95,sizeAttenuation:true});
    s.root.add(new THREE.Points(ptGeo,ptMat));

    // 三层东京核心都市群：2300+ 栋建筑（底层密布街区 + 中高层商务簇群 + 远景天际线，12 组 InstancedMesh 零卡顿合批）
    const totalBld=s.mobile?1300:2300;
    const bGeos=[geoSetback,geoCyl,geoSlant,geoTwin];
    const bMats=[matOffice,matRes,matSil];
    const pools=[];
    const poolMax=Math.ceil(totalBld/7)+16;
    for(let gi=0;gi<bGeos.length;gi++)for(let mi=0;mi<bMats.length;mi++){
      pools.push({inst:new THREE.InstancedMesh(bGeos[gi],bMats[mi],poolMax),count:0,max:poolMax});
    }
    const dummy=new THREE.Object3D();
    const tx=68,tz=-460;
    const clusters=[
      [-135,-210,75,42],[-75,-170,60,34],[140,-240,85,38],[-220,-340,100,45],[220,-360,110,40],[0,-580,180,34]
    ];
    for(let i=0;i<totalBld;i++){
      let bx,bz,bw,bd,bh,rotY=(s.r()-.5)*0.6,gi=i%bGeos.length,mi=i%bMats.length;
      if(i===0){
        // 左侧六本木/麻布台之丘式超高地标主楼
        bx=-118;bz=-250;bw=26;bd=26;bh=112;rotY=0.22;gi=1;mi=0;
      }else if(i<1550){
        // 第 1 层：底层密布街区（1550 栋中低层住宅/商办，避开 68m 间距的城市主干道，形成真实街巷肌理）
        bx=(s.r()-.5)*1150;
        bz=40-s.r()*740;
        if(Math.abs(((bx%68)+68)%68-34)>26||Math.abs(((bz%68)+68)%68-34)>26)continue;
        if(Math.hypot(bx,bz)<48||Math.hypot(bx,bz)>760)continue;
        bw=9+s.r()*14;bd=9+s.r()*14;
        bh=8+s.r()*24;
        mi=s.r()<0.62?2:1; // 大部分为暗剪影与稀疏住宅暖灯
      }else{
        // 第 2 层：中高层商务簇群（750 栋写字楼与退台塔楼，按港区/汐留/品川簇群分布）
        const cl=clusters[i%clusters.length];
        const ang=s.r()*Math.PI*2,rad=s.r()*cl[2];
        bx=cl[0]+Math.cos(ang)*rad+(s.r()-.5)*55;
        bz=cl[1]+Math.sin(ang)*rad+(s.r()-.5)*55;
        if(Math.abs(bx-tx)<32&&Math.abs(bz-tz)<32)continue;
        if(Math.hypot(bx,bz)<58||Math.hypot(bx,bz)>760)continue;
        bw=11+s.r()*16;bd=11+s.r()*16;
        bh=30+s.r()*cl[3]+(s.r()>0.88?28:0);
        mi=s.r()<0.58?0:(s.r()<0.82?1:2);
      }
      const topY=-44+bh;
      dummy.position.set(bx,-44+bh*.5,bz);
      dummy.rotation.set(0,rotY,0);
      dummy.scale.set(bw,bh,bd);
      dummy.updateMatrix();
      const pool=pools[gi*bMats.length+mi];
      if(pool.count<pool.max){
        pool.inst.setMatrixAt(pool.count++,dummy.matrix);
      }
      if(bh>48&&i%5===0)makeBeacon(bx,topY+.8,bz,i*.7,1.8);
    }
    pools.forEach(p=>{
      p.inst.count=p.count;
      p.inst.instanceMatrix.needsUpdate=true;
      if(p.count>0)s.root.add(p.inst);
    });
    lampGlow.finish(s.root,"tokyoRooftopFloods",true);

    // 4. 远景全亮东京铁塔（严格按 333m 实塔比例：底部宽基座 + 内部发光核心筒 + 4面加密桁架，稳重厚实不镂空）
    const tBase=-44,H=138;
    const towerGlow=batch();
    const tiers=16;
    // 真实东京铁塔外轮廓曲线（底部宽展稳重、中段优雅收腰、顶部挺拔）
    const halfAt=u=>24.5*Math.pow(1-u,1.72)+2.2;

    // 4.1 内部发光核心筒与电梯井 + 底部 FootTown 展馆基座（消除镂空骨架感，呈现“由内而外发光”的稳重实体）
    b.box(0x281b18,tx,tBase+9,tz,26,18,26);
    towerGlow.box(0xff8c38,tx,tBase+14,tz,22,4.5,22);
    for(let c=0;c<10;c++){
      const u=(c+.5)/10*0.86;
      const cy=tBase+u*H,cw=halfAt(u)*0.82;
      const coreCol=u>0.46&&u<0.64?0xffe4b5:0xff6a1c;
      towerGlow.box(coreCol,tx,cy,tz,cw,H/10+.6,cw);
    }

    // 4.2 四面加密红白钢骨与双层斜撑桁架（4 个侧面全密布，不再空洞）
    for(let k=0;k<tiers;k++){
      const u0=k/tiers,u1=(k+1)/tiers;
      const y0=tBase+u0*H,y1=tBase+u1*H,ym=(y0+y1)*.5;
      const w0=halfAt(u0),w1=halfAt(u1),wm=(w0+w1)*.5;
      const segH=(y1-y0)+.45,tilt=Math.atan2(w0-w1,y1-y0);
      const glowCol=(k>=7&&k<=9)?0xfff2cf:(k>=10?0xff943d:0xff6418);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        towerGlow.box(glowCol,tx+sx*wm,ym,tz+sz*wm,1.15,segH,1.15,sz*tilt,0,-sx*tilt);
      }
      // 四周水平环梁 + 中间副横梁
      for(const yy of [y1,ym]){
        const ww=yy===y1?w1:wm;
        towerGlow.box(glowCol,tx,yy,tz-ww,ww*2,.72,.72);
        towerGlow.box(glowCol,tx,yy,tz+ww,ww*2,.72,.72);
        towerGlow.box(glowCol,tx-ww,yy,tz,.72,.72,ww*2);
        towerGlow.box(glowCol,tx+ww,yy,tz,.72,.72,ww*2);
      }
      // 四面全覆盖交叉斜撑（前/后/左/右四面都有）
      if(k<tiers-1){
        const diag=Math.hypot(wm*1.92,y1-y0),ang=Math.atan2(wm*1.92,y1-y0);
        for(const sd of [-1,1]){
          towerGlow.box(glowCol,tx,ym,tz+sd*wm,.45,diag,.45,0,0,ang);
          towerGlow.box(glowCol,tx,ym,tz+sd*wm,.45,diag,.45,0,0,-ang);
          towerGlow.box(glowCol,tx+sd*wm,ym,tz,.45,diag,.45,ang,0,0);
          towerGlow.box(glowCol,tx+sd*wm,ym,tz,.45,diag,.45,-ang,0,0);
        }
      }
    }
    // 大展望台 (45% 塔高处) & 特别展望台 (75% 塔高处)
    const mainY=tBase+68,topY=tBase+112;
    b.box(0x242a36,tx,mainY,tz,18.4,6.4,18.4);
    towerGlow.box(0xffe08a,tx,mainY,tz,18.8,2.6,18.8);
    towerGlow.box(0x7dd3fc,tx,mainY+2.4,tz,18.6,1.1,18.6);
    b.box(0x242a36,tx,topY,tz,9.8,4.6,9.8);
    towerGlow.box(0xfff0b3,tx,topY,tz,10.2,2.0,10.2);
    // 顶部避雷针天线（红白相间至 175m 总高）
    for(let a=0;a<4;a++){
      const ay=tBase+H+a*9.2+4.6;
      towerGlow.box(a%2?0xfff3e0:0xff551a,tx,ay,tz,1.35-.18*a,9.4,1.35-.18*a);
    }
    towerGlow.finish(s.root,"tokyoTowerGlow",true);
    makeBeacon(tx,tBase+H+37.5,tz,0,4.2);

    // 铁塔夜间泛光柔光晕（远景尺度 62x130 柔和暖橙空气辉光）
    const haloCv=document.createElement("canvas");haloCv.width=128;haloCv.height=128;
    const hg=haloCv.getContext("2d");
    const hgr=hg.createRadialGradient(64,64,2,64,64,60);
    hgr.addColorStop(0,"rgba(255,115,35,0.28)");
    hgr.addColorStop(0.5,"rgba(255,75,20,0.09)");
    hgr.addColorStop(1,"rgba(255,50,10,0)");
    hg.fillStyle=hgr;hg.fillRect(0,0,128,128);
    const haloTex=new THREE.CanvasTexture(haloCv);
    const haloMat=new THREE.MeshBasicMaterial({map:haloTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    const haloMesh=new THREE.Mesh(new THREE.PlaneGeometry(66,136),haloMat);
    haloMesh.position.set(tx,tBase+68,tz+2);
    s.root.add(haloMesh);

    // 5. 四条首都高架公路（横跨 800m 纵深）+ 220 辆流动红白车流光轨
    const roadDefs=[
      {z:-95,y:-24,rotY:0.06,len:620},
      {z:-195,y:-30,rotY:-0.10,len:780},
      {z:-315,y:-35,rotY:0.12,len:880},
      {z:-410,y:-38,rotY:-0.05,len:920}
    ];
    roadDefs.forEach(rd=>{
      b.box(0x0b0f18,0,rd.y,rd.z,rd.len,.9,6.5,0,rd.rotY,0);
    });
    const tCount=s.mobile?120:220;
    const carGeo=new THREE.BoxGeometry(2.8,.42,.65);
    const instHead=new THREE.InstancedMesh(carGeo,new THREE.MeshBasicMaterial({color:0xfff7ed}),tCount/2);
    const instTail=new THREE.InstancedMesh(carGeo,new THREE.MeshBasicMaterial({color:0xff3b30}),tCount/2);
    const traffic=[];
    for(let i=0;i<tCount;i++){
      const rd=roadDefs[i%roadDefs.length],dir=i%2?1:-1;
      const basePos=(i/tCount-.5)*rd.len;
      traffic.push({rd,dir,basePos,speed:22+(i%7)*3.8,lane:dir>0?1.6:-1.6,isHead:dir<0,idx:(i/2)|0});
    }
    s.root.add(instHead);s.root.add(instTail);

    s.wonder={kind:"tokyo",beacons,traffic,instHead,instTail,dummy};
    update(s);
  }
  const meadow=(()=>{
    const smooth=THREE.MathUtils.smoothstep;
    const linear=hex=>new THREE.Color(hex).convertSRGBToLinear();
    const tau=Math.PI*2;
    const bounds={halfWidth:16,minZ:-13,maxZ:23};

    // Non-periodic 2D value noise & golden-angle fBm shared by terrain, grass cushions & wildflower heights (zero grid/diamond waves).
    function turfHash(ix,iz){
      const k=((Math.imul(ix+131,374761393)^Math.imul(iz+59,668265263))>>>0);
      return (((Math.imul(k^(k>>>13),1274126177))>>>0)%8192)/8191;
    }
    function turfNoise2D(x,z){
      const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
      const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
      const a=turfHash(ix,iz),b=turfHash(ix+1,iz),c=turfHash(ix,iz+1),d=turfHash(ix+1,iz+1);
      return a+(b-a)*ux+(c-a)*uz+(a-b-c+d)*ux*uz;
    }
    function turfFbm(x,z){
      let v=0.54*turfNoise2D(x,z);
      const x1=0.80*x-0.60*z+17.3,z1=0.60*x+0.80*z-11.7;
      v+=0.30*turfNoise2D(x1*2.03,z1*2.03);
      const x2=0.80*x1-0.60*z1-23.1,z2=0.60*x1+0.80*z1+19.4;
      v+=0.16*turfNoise2D(x2*4.07,z2*4.07);
      return v;
    }

    function elevation(x,z){
      const along=z-COURT.midZ,r=Math.hypot(x,along);
      const clearance=Math.hypot(Math.max(0,Math.abs(x)-11.8),Math.max(0,Math.abs(along)-17.6));
      // Subtle 1-3cm natural pasture undulation even across the semi-wild court clearing so it never feels laser-leveled.
      const microUndul=(turfFbm(x*0.085+3.1,z*0.085-4.7)-0.5)*0.042*(1-smooth(clearance,2,14));
      const nA=turfFbm(x*0.026+7.4,z*0.026+2.9)*2-1;
      const nB=turfFbm(x*0.058-13.2,z*0.058+9.6)*2-1;
      const waves=nA*1.35+nB*0.52;
      const folds=smooth(r,22,45)*((turfFbm(x*0.038+31.0,z*0.038-18.0)*2-1)*4.8+(turfFbm(x*0.074-21.0,z*0.074+14.0)*2-1)*2.1);
      const shoulder=8.8*Math.exp(-((x+51)**2/1560+(along+57)**2/5500))
        +11.8*Math.exp(-((x-82)**2/2300+(along+32)**2/8200));
      // The far foot of the meadow drops below the rock layers, outside the tree and flower belts.
      const foothill=smooth(r,126,184);
      return -.025+microUndul+smooth(clearance,0.5,16)*((waves*(1.5+Math.min(r/82,2.3))+shoulder+folds)*(1-foothill)-4.7*foothill);
    }

    function terrainNormalAt(x,z,out){
      const e=0.65;
      const nx=elevation(x-e,z)-elevation(x+e,z);
      const nz=elevation(x,z-e)-elevation(x,z+e);
      return out.set(nx,2*e,nz).normalize();
    }

    function terrainHorizonAt(x,z,y){
      let obstruction=-.38;
      for(const distance of [3,6,10,15,22,32,45,62,82,108]){
        obstruction=Math.max(obstruction,(elevation(x-.49*distance,z+.872*distance)-y-.12)/distance);
      }
      return obstruction;
    }

    function turfWearAt(x,z){
      const wx=x+(turfNoise2D(x*0.42+5.1,z*0.42-2.3)-0.5)*0.95;
      const wz=z+(turfNoise2D(x*0.42-8.4,z*0.42+6.7)-0.5)*0.95;
      const hoopNear=Math.exp(-(((wx)/2.1)**2+((wz+8.2)/2.5)**2));
      const hoopFar=Math.exp(-(((wx)/1.9)**2+((wz-17.7)/2.2)**2))*0.62;
      const arcDist=Math.abs(Math.hypot(wx,wz+9.25)-7.15);
      const arcWear=Math.exp(-(arcDist*arcDist)/0.95)*smooth(wz,-10.5,-1.0)*(0.45+0.55*turfNoise2D(wx*0.55+12,wz*0.55));
      const laneNear=1-smooth(((wx-0.18)/2.55)**2+((wz+5.5)/4.6)**2,0.22,1.18);
      const eastCurve=8.8+(z-13.5)*.46+2.2*Math.sin(z*.16+.5);
      const eastPath=Math.exp(-(((x-eastCurve)/1.05)**2))*smooth(z,10.5,14.5)*(1-smooth(z,48,68));
      const westCurve=-9.2-(z+6.0)*.38+1.8*Math.cos(z*.19);
      const westPath=Math.exp(-(((x-westCurve)/.95)**2))*smooth(-z,3.0,8.5)*(1-smooth(-z,34,52));
      const patch=turfFbm(x*0.22+4.3,z*0.22-7.1);
      const raw=Math.max(hoopNear*0.80,hoopFar*0.65,arcWear*0.64,Math.max(eastPath,westPath)*0.74,laneNear*(0.30+patch*0.42));
      return THREE.MathUtils.clamp(raw*(0.72+patch*0.68),0,0.75);
    }

    function turfHeightAt(x,z){
      // Semi-wild pasture clearing: ragged hand-scythed boundary + undulating tussocks inside & outside the court.
      const warpA=(turfFbm(x*0.17+11.2,z*0.17-5.8)-0.5)*2.9;
      const warpB=(turfFbm(x*0.15-7.4,z*0.15+13.1)-0.5)*3.1;
      const edgeX=Math.max(0,Math.abs(x)+warpA-6.85);
      const edgeZ=Math.max(0,Math.abs(z-COURT.midZ)+warpB-13.4);
      const wildBlend=smooth(Math.hypot(edgeX,edgeZ),0.0,3.6);
      const billow=turfFbm(x*0.13-3.7,z*0.13+8.9);
      const tussock=turfNoise2D(x*0.52+19.1,z*0.52-14.3);
      const wear=turfWearAt(x,z);
      const courtH=(0.082+0.115*billow+0.048*tussock)*(1-wear*0.56);
      const wildH=0.165+0.235*Math.pow(billow,1.15)+0.105*tussock;
      return THREE.MathUtils.lerp(courtH,wildH,wildBlend);
    }

    function courtMarks(){
      const canvas=document.createElement("canvas");canvas.width=1536;canvas.height=1728;
      const g=canvas.getContext("2d"),width=bounds.halfWidth*2,depth=bounds.maxZ-bounds.minZ;
      g.scale(canvas.width/width,canvas.height/depth);g.translate(bounds.halfWidth,-bounds.minZ);
      const {nearBaseline:near,farBaseline:far,halfWidth,midZ}=COURT;
      const line=(x,z,x2,z2)=>{g.beginPath();g.moveTo(x,z);g.lineTo(x2,z2);g.stroke();};
      const circle=(z,r,a=0,b=tau)=>{g.beginPath();g.arc(0,z,r,a,b);g.stroke();};
      // No sharp rectangular turf fill! Only soft, irregular radial wear smudges + hand-dusted pasture lime lines
      // so the court reads as a semi-wild clearing scythed right out of a real Xinjiang grassland.
      for(const [cx,cz,rx,rz,al] of [[0,-5.8,6.8,5.6,.12],[0,14.8,6.4,5.2,.09],[0,midZ,6.6,8.2,.07]]){
        g.save();g.translate(cx,cz);g.scale(rx,rz);
        const rg=g.createRadialGradient(0,0,.1,0,0,1);
        rg.addColorStop(0,`rgba(168,150,92,${al})`);
        rg.addColorStop(.65,`rgba(152,140,84,${(al*.45).toFixed(3)})`);
        rg.addColorStop(1,"rgba(152,140,84,0)");
        g.fillStyle=rg;g.beginPath();g.arc(0,0,1,0,tau);g.fill();g.restore();
      }
      g.strokeStyle="#f2e9cc";g.lineCap="round";
      g.globalAlpha=.74;g.lineWidth=.064;g.setLineDash([1.65,.055,.92,.085,.74,.062]);
      g.strokeRect(-halfWidth,near,COURT.width,far-near);
      line(-halfWidth,midZ,halfWidth,midZ);circle(midZ,1.8);
      for(const [z,baseline,dir] of [[HOOP.z,near,1],[COURT.farHoopZ,far,-1]]){
        const turn=dir===1?0:Math.PI,free=baseline+dir*5.79;
        g.globalAlpha=.66;g.lineWidth=.058;g.setLineDash([1.12,.068,1.42,.055]);
        g.strokeRect(-2.45,Math.min(baseline,free),4.9,5.79);
        circle(free,1.8,turn,turn+Math.PI);
        g.setLineDash([.15,.14]);circle(free,1.8,turn+Math.PI,turn+tau);
        g.setLineDash([.82,.058,1.12,.050]);circle(z,1.22,turn,turn+Math.PI);
        const arcR=7.24,sideX=6.71,angle=Math.acos(sideX/arcR);
        const join=z+dir*Math.sqrt(arcR*arcR-sideX*sideX);
        g.globalAlpha=.85;g.lineWidth=.074;g.setLineDash([1.9,.065,1.45,.058,.82,.048]);
        circle(z,arcR,turn+angle,turn+Math.PI-angle);
        for(const side of [-1,1]){
          line(side*sideX,baseline,side*sideX,join);
          g.globalAlpha=.64;g.lineWidth=.054;
          for(const lane of [2.13,2.44,3.35,4.27]){
            const az=baseline+dir*lane;line(side*2.45,az,side*2.73,az);
          }
          g.globalAlpha=.85;g.lineWidth=.074;
        }
      }
      const map=new THREE.CanvasTexture(canvas);map.name="placeSurface:flowerCourt";
      map.encoding=THREE.sRGBEncoding;map.anisotropy=Math.min(6,renderer.capabilities.getMaxAnisotropy());
      return map;
    }

    function terrainTexture(file){
      const map=loadVenueTexture("assets/meadow/"+file);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.encoding=THREE.sRGBEncoding;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      return map;
    }

    // Shared ground/grass color harmony, 3-tier grass & spruce LODs, hero spruces, and per-layer controls
    // adapted from MIT-licensed references: Long Wind (grass-glsl.js / grass.js), Tiny Planet (flora/wind.ts), and Valley Ride.
    const HERO_SPRUCES=[
      [-22.5,-24.5,11.6],
      [25.5,-19.5,10.4],
      [-26.5,22.5,12.2],
      [27.0,26.0,9.8],
      [-24.0,-5.0,10.8],
      [25.0,3.5,11.2]
    ];

    // 新疆喀拉峻/那拉提雪岭云杉林带实树烘焙阴影贴图 (meadowTreeMap: R=方向性锥形投射长树影, G=林下松针腐殖质与树根接触暗部 AO) + 6 棵近景主云杉精确解析阴影
    const spruceShadowGLSL=`
      uniform sampler2D meadowTreeMap;
      vec2 sampleSpruceForest(vec3 worldPos, vec3 sunDir){
        vec2 p = worldPos.xz;
        vec2 uv = (p - vec2(0.0, 4.745)) / 280.0 + 0.5;
        vec4 baked = texture2D(meadowTreeMap, clamp(uv, 0.002, 0.998));
        vec2 sDir = sunDir.xz / max(0.24, sunDir.y + 0.14);
        float heroCast = 0.0;
        float heroAO = 0.0;
        vec3 h0 = vec3(-22.5, -24.5, 11.6);
        vec3 h1 = vec3(25.5, -19.5, 10.4);
        vec3 h2 = vec3(-26.5, 22.5, 12.2);
        vec3 h3 = vec3(27.0, 26.0, 9.8);
        vec3 h4 = vec3(-24.0, -5.0, 10.8);
        vec3 h5 = vec3(25.0, 3.5, 11.2);
        for(int i=0;i<6;i++){
          vec3 h = i==0?h0:(i==1?h1:(i==2?h2:(i==3?h3:(i==4?h4:h5))));
          vec2 d = p - h.xy;
          heroAO = max(heroAO, exp(-dot(d,d)/(h.z*1.35))*0.82);
          float proj = clamp(dot(d, -sDir)/max(1.0, dot(sDir,sDir)), 0.0, h.z*1.25);
          vec2 closest = h.xy - sDir*proj;
          float coneR = mix(h.z*0.36, 0.45, proj/max(1.0, h.z*1.25));
          float rayDist = length(p - closest);
          float cSh = (1.0 - smoothstep(coneR*0.38, coneR*1.22, rayDist)) * (1.0 - 0.32*(proj/max(1.0, h.z*1.25)));
          heroCast = max(heroCast, cSh*0.80);
        }
        float castShadow = clamp(max(baked.r, heroCast), 0.0, 0.86);
        float forestFloorAO = clamp(max(baked.g, heroAO), 0.0, 0.88);
        return vec2(castShadow, forestFloorAO);
      }
      float spruceCanopyShadow(vec3 worldPos, vec3 sunDir){
        vec2 sf = sampleSpruceForest(worldPos, sunDir);
        return clamp(max(sf.x, sf.y * 0.85), 0.0, 0.86);
      }
    `;

    // Unified ground-to-grass pasture palette, non-periodic organic fBm & lighting (inspired by Long Wind grass-glsl.js, MIT).
    const meadowPaletteGLSL=`
      float meadowHash21(vec2 p){
        p=fract(p*vec2(123.34,456.21));
        p+=dot(p,p+45.32);
        return fract(p.x*p.y);
      }
      float meadowNoise2D(vec2 p){
        vec2 i=floor(p),f=fract(p);
        vec2 u=f*f*(3.0-2.0*f);
        float a=meadowHash21(i),b=meadowHash21(i+vec2(1.0,0.0));
        float c=meadowHash21(i+vec2(0.0,1.0)),d=meadowHash21(i+vec2(1.0,1.0));
        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
      }
      float meadowFbm(vec2 p){
        const mat2 rotG=mat2(0.80,-0.60,0.60,0.80);
        float v=0.54*meadowNoise2D(p);
        p=rotG*p*2.03+vec2(17.3,-11.7);
        v+=0.30*meadowNoise2D(p);
        p=rotG*p*2.01+vec2(-23.1,19.4);
        v+=0.16*meadowNoise2D(p);
        return v;
      }
      vec3 meadowBaseTint(vec2 m){
        float nA=meadowFbm(m*0.036+vec2(4.2,-7.8));
        float nB=meadowFbm(m*0.072+vec2(-13.5,9.1));
        vec3 base=mix(vec3(0.092,0.158,0.042),vec3(0.218,0.328,0.072),clamp(nA*1.12-0.06,0.0,1.0));
        return mix(base,vec3(0.068,0.142,0.052),clamp(nB*0.42,0.0,0.40));
      }
      vec3 meadowGroundAlbedo(vec2 m,vec3 baseCol,float coarse,float macro,float micro,vec2 spruceData,out float wornOut){
        float swaleNoise=meadowFbm(m*0.048+vec2(-8.3,14.6));
        float swaleZone=smoothstep(0.56,0.28,swaleNoise);
        float thatchMask=smoothstep(.09,.24,coarse*.52+macro*.48+(micro-.12)*.34);
        vec3 emeraldSwale=baseCol*vec3(.82,1.00,.74);
        vec3 goldenFescue=baseCol*vec3(1.08,1.05,.82);
        vec3 strawTone=baseCol*vec3(1.26,1.13,.77);
        vec3 col=mix(goldenFescue,emeraldSwale,swaleZone*.56);
        col=mix(col,strawTone,thatchMask*(.68-swaleZone*.24));
        // Semi-wild clearing subtle hand-scythed straw warmth (organic warped boundary, never a sharp box!).
        float warpX=(meadowFbm(m*0.17+vec2(11.2,-5.8))-0.5)*2.9;
        float warpZ=(meadowFbm(m*0.15+vec2(-7.4,13.1))-0.5)*3.1;
        float cEdge=length(vec2(max(0.0,abs(m.x)+warpX-6.85),max(0.0,abs(m.y-4.745)+warpZ-13.4)));
        float scythed=1.0-smoothstep(0.0,3.8,cEdge);
        col=mix(col,col*vec3(1.07,1.03,0.90),scythed*0.32);
        float forestFloorAO=spruceData.y;
        vec3 forestHumus=mix(vec3(.13,.18,.11),vec3(.20,.17,.12),coarse*2.2);
        col=mix(col,forestHumus,forestFloorAO*0.72);
        col*=1.0-forestFloorAO*0.38;
        vec2 w=m+vec2(meadowNoise2D(m*0.42+vec2(5.1,-2.3))-0.5,meadowNoise2D(m*0.42+vec2(-8.4,6.7))-0.5)*0.95;
        float hoopWear=exp(-dot((w-vec2(0.0,-8.2))/vec2(2.1,2.5),(w-vec2(0.0,-8.2))/vec2(2.1,2.5)));
        float farHoopWear=exp(-dot((w-vec2(0.0,17.7))/vec2(1.9,2.2),(w-vec2(0.0,17.7))/vec2(1.9,2.2)))*0.62;
        float arcDist=abs(length(w-vec2(0.0,-9.25))-7.15);
        float arcWear=exp(-arcDist*arcDist/.95)*smoothstep(-10.5,-1.0,w.y)*(.45+.55*meadowNoise2D(w*0.55+vec2(12.0,0.0)));
        float eastCurve=8.8+(m.y-13.5)*.46+2.2*sin(m.y*.16+.5);
        float eastPath=exp(-pow((m.x-eastCurve)/1.05,2.0))*smoothstep(10.5,14.5,m.y)*(1.0-smoothstep(48.0,68.0,m.y));
        float westCurve=-9.2-(m.y+6.0)*.38+1.8*cos(m.y*.19);
        float westPath=exp(-pow((m.x-westCurve)/.95,2.0))*smoothstep(-3.0,-8.5,m.y)*(1.0-smoothstep(-34.0,-52.0,m.y));
        vec2 lane=(w-vec2(.18,-5.5))/vec2(2.55,4.6);
        float shortTurf=1.0-smoothstep(.22,1.18,dot(lane,lane));
        float rawWear=max(max(max(hoopWear*.80,farHoopWear*.65),arcWear*.64),max(eastPath,westPath)*.74);
        rawWear=max(rawWear,shortTurf*(.28+coarse*.72));
        wornOut=clamp(rawWear*(.72+coarse*1.95),0.0,.74);
        vec3 loamSoil=mix(vec3(.20,.17,.11),vec3(.28,.24,.16),clamp((micro-.06)*4.5,0.0,1.0));
        return mix(col,loamSoil,wornOut);
      }
      vec3 meadowSharedLight(vec3 col,vec3 worldPos,float camDist,float facing,float horizonSun,vec2 spruceData){
        float movingLight=sunWindow(worldPos,1.0);
        float treeShadow=max(spruceData.x,spruceData.y*0.78);
        float overcastDapple=mix(.66,1.30,movingLight);
        float sunnyDapple=1.0-.38*(1.0-meadowSky.y)*(1.0-movingLight);
        float cloudShade=mix(overcastDapple,sunnyDapple,meadowSky.x)+movingLight*meadowAir.y*.54;
        float slopeRelief=mix(.68,1.30,smoothstep(-.30,.38,facing));
        cloudShade*=slopeRelief;
        vec3 treeShadowTint=mix(vec3(1.0),vec3(.42,.56,.68),treeShadow*(.62+.38*meadowSky.x*horizonSun));
        cloudShade*=1.0-treeShadow*.48;
        float sideLight=horizonSun*smoothstep(-.12,.34,facing)*(1.0-treeShadow*.88);
        vec3 dusk=mix(vec3(.44,.55,.50),vec3(1.42,1.36,.80),sideLight);
        vec3 overcastTint=mix(vec3(.76,.87,.98),vec3(1.12,1.09,.97),movingLight*smoothstep(-.18,.32,facing)*(1.0-treeShadow*.65));
        col*=cloudShade*treeShadowTint*mix(overcastTint,mix(vec3(1.0),dusk,meadowSky.y),meadowSky.x);
        float hillHaze=smoothstep(26.0,108.0,camDist)*mix(.38,.22,meadowSky.x);
        vec3 hillHazeCol=mix(vec3(.44,.53,.60),vec3(.68,.64,.54),meadowSky.y);
        return mix(col,hillHazeCol,hillHaze);
      }
    `;

    function ground(s){
      const segs=s.mobile?104:160;
      const geo=new THREE.PlaneGeometry(560,560,segs,segs);
      geo.rotateX(-Math.PI/2);
      const p=geo.attributes.position,nrm=geo.attributes.normal,c=[],horizon=[],shade=new THREE.Color(),nTmp=new THREE.Vector3();
      const low=linear(0x546d39),light=linear(0x819c4b),cool=linear(0x486841);
      // Concentrate vertex density organically inside the court & visible slopes (r < 110m -> ~1.35m spacing, zero extra tris).
      const warpCoord=v=>{
        const u=v/280,au=Math.abs(u);
        return Math.sign(u)*280*(0.36*au+0.64*Math.pow(au,1.88));
      };
      for(let i=0;i<p.count;i++){
        const x=warpCoord(p.getX(i)),z=warpCoord(p.getZ(i))+COURT.midZ;
        const y=elevation(x,z);
        p.setXYZ(i,x,y,z);
        terrainNormalAt(x,z,nTmp);
        nrm.setXYZ(i,nTmp.x,nTmp.y,nTmp.z);
        horizon.push(terrainHorizonAt(x,z,y));
        const nA=turfFbm(x*0.036+4.2,z*0.036-7.8);
        const nB=turfFbm(x*0.072-13.5,z*0.072+9.1);
        shade.copy(low).lerp(light,THREE.MathUtils.clamp(nA*1.12-0.06,0,1)).lerp(cool,THREE.MathUtils.clamp(nB*0.42,0,0.40));
        c.push(shade.r,shade.g,shade.b);
      }
      geo.setAttribute("color",new THREE.Float32BufferAttribute(c,3));
      geo.setAttribute("terrainHorizon",new THREE.Float32BufferAttribute(horizon,1));
      const marks=courtMarks();
      s.meadowCourtMarks=marks;
      const mat=new THREE.MeshStandardMaterial({vertexColors:true,map:marks,roughness:.93,metalness:0});
      const grass=terrainTexture("leafy-grass.jpg");
      s.meadowGrassTex=grass;
      mat.addEventListener("dispose",()=>{
        grass.dispose();
        s.meadow.drifts.coverage.dispose();
        if(typeof sun!=="undefined"&&sun)sun.castShadow=true;
        if(typeof renderer!=="undefined"&&renderer)renderer.shadowMap.enabled=true;
        if(window.AIBAGrade?.setEnabled)AIBAGrade.setEnabled(true);
      });
      mat.onBeforeCompile=shader=>{
        shader.uniforms.grassDetail={value:grass};
        shader.uniforms.flowerCover={value:s.meadow.drifts.coverage};
        shader.uniforms.fieldProgress=s.meadow.drifts.bloom;
        Object.assign(shader.uniforms,s.meadow.uniforms);
        const varyings="varying vec3 vMeadowPos,vMeadowNormal;\nvarying float vTerrainHorizon;\n";
        shader.vertexShader="attribute float terrainHorizon;\n"+varyings+shader.vertexShader.replace(
          "#include <begin_vertex>","#include <begin_vertex>\nvMeadowPos=position;vMeadowNormal=normal;vTerrainHorizon=terrainHorizon;"
        );
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+AIBAMeadowCourt.waterGLSL+spruceShadowGLSL+meadowPaletteGLSL+varyings+"uniform sampler2D grassDetail;\nuniform sampler2D flowerCover;\nuniform float fieldProgress;\n"+shader.fragmentShader.replace("#include <map_fragment>",`
          vec2 m = vMeadowPos.xz;
          vec2 uvMarks = vec2(m.x/32.0+0.5, 1.0-(m.y+13.0)/36.0);
          vec4 chalk = mapTexelToLinear(texture2D(map, uvMarks));
          // Domain-warped anti-tiling UV + 2-layer parallax micro-fur offset for velvety turf pile depth (zero grid repetition).
          vec2 uvWarp = vec2(meadowNoise2D(m*0.14+vec2(3.7,-6.2))-0.5, meadowNoise2D(m*0.14+vec2(-11.4,8.9))-0.5)*2.6;
          vec2 mOrg = m + uvWarp;
          mat2 rotA = mat2(0.866,-0.500,0.500,0.866);
          mat2 rotB = mat2(0.588,0.809,-0.809,0.588);
          vec3 viewRay = normalize(cameraPosition - vMeadowPos);
          vec2 furOffset = (viewRay.xz / max(0.32, viewRay.y)) * 0.042;
          vec3 microRoot = mapTexelToLinear(texture2D(grassDetail, (rotA*mOrg)*1.55)).rgb;
          vec3 microTip = mapTexelToLinear(texture2D(grassDetail, (rotB*(mOrg + furOffset))*2.35 + vec2(0.37,0.71))).rgb;
          vec3 blades = mapTexelToLinear(texture2D(grassDetail, (rotA*mOrg)*0.48 + vec2(0.19,0.43))).rgb;
          vec3 patches = mapTexelToLinear(texture2D(grassDetail, mOrg*0.088 + vec2(0.26,0.31))).rgb;
          vec3 macroTex = mapTexelToLinear(texture2D(grassDetail, (rotB*m)*0.024 + vec2(0.61,0.17))).rgb;
          float rootGrain = dot(microRoot,vec3(0.22,0.70,0.08));
          float tipGrain = dot(microTip,vec3(0.22,0.70,0.08));
          float micro = mix(rootGrain, tipGrain, 0.58);
          float fine = dot(blades,vec3(0.22,0.70,0.08));
          float coarse = dot(patches,vec3(0.22,0.70,0.08));
          float macro = dot(macroTex,vec3(0.22,0.70,0.08));
          float meadowLiquid = 0.0;
          float meadowCapillary = 0.0;
        `).replace("#include <color_fragment>",`
          #include <color_fragment>
          float camDist=length(cameraPosition.xz-m);
          float closeGrain=1.0-smoothstep(28.0,115.0,camDist);
          float nearFur=1.0-smoothstep(4.5,20.0,camDist);
          float organicTussock=meadowFbm(m*0.34+vec2(-4.7,9.3));
          float tussockHeight=coarse*0.44+fine*0.30+organicTussock*0.26;
          float tussockAO=mix(0.78,1.18,smoothstep(0.10,0.34,tussockHeight));
          // 3-layer procedural micro-blade fur shell (root cavity -> mid stalk -> sunlit upright grass tips) eliminates flat skin between 3D blades!
          vec2 shellStep=(viewRay.xz/max(0.38,viewRay.y))*0.018;
          float sh0=meadowNoise2D(m*34.0);
          float sh1=meadowNoise2D((m+shellStep*0.55)*38.0+vec2(13.7,5.9));
          float sh2=meadowNoise2D((m+shellStep*1.15)*42.0+vec2(-7.3,19.1));
          float microFur=mix(0.76,1.26,clamp(sh0*0.22+smoothstep(0.36,0.78,sh1)*0.36+smoothstep(0.52,0.88,sh2)*0.52,0.0,1.0));
          float furPile=mix(1.0,mix(0.84,1.22,smoothstep(0.06,0.24,tipGrain*0.72+(tipGrain-rootGrain)*0.65)),closeGrain)*mix(1.0,microFur,nearFur*0.78);
          float bladeDetail=(0.82+coarse*1.48+(fine-.13)*(1.05+0.48*closeGrain)+(organicTussock-.48)*0.18)*tussockAO*furPile;
          diffuseColor.rgb*=bladeDetail*mix(1.22,1.0,meadowSky.x);

          vec2 spruceData=sampleSpruceForest(vMeadowPos,meadowSun);
          float worn=0.0;
          diffuseColor.rgb=meadowGroundAlbedo(m,diffuseColor.rgb,coarse,macro,micro,spruceData,worn);
          float forestFloorAO=spruceData.y;

          // Smooth organic tussock normal (strictly non-periodic fBm gradient, never sine-wave diamonds!).
          float nEps=0.55;
          float hC=meadowFbm(m*0.28),hX=meadowFbm((m+vec2(nEps,0.0))*0.28),hZ=meadowFbm((m+vec2(0.0,nEps))*0.28);
          vec2 softBump=(vec2(hC-hX,hC-hZ)*0.16 + vec2(tipGrain-rootGrain, fine-coarse)*0.18)*(1.0-worn*0.75)*(1.0-smoothstep(24.0,78.0,camDist));
          vec3 macroNormal=normalize(vMeadowNormal);
          vec3 turfNormal=normalize(macroNormal+vec3(softBump.x,0.0,softBump.y));

          // Grazing-angle anisotropic velvet turf backscatter gives plush meadow fur volume.
          vec3 viewDir=normalize(cameraPosition-vMeadowPos);
          float velvet=pow(1.0-max(0.0,dot(viewDir,turfNormal)),2.0)*(.44+.62*clamp(tipGrain*4.4,0.0,1.0))*(1.0-worn*.78)*(1.0-forestFloorAO*.7);
          diffuseColor.rgb+=vec3(.076,.104,.039)*velvet;

          vec2 fromCenter=m-vec2(0.0,4.745);
          vec2 flowersUV=vec2(fromCenter.x,-fromCenter.y)/232.0+0.5;
          vec4 drift=mapTexelToLinear(texture2D(flowerCover,flowersUV));
          float wake=clamp(.095+(length(fromCenter)-16.0)/121.0,.07,.84);
          float flowering=smoothstep(wake+.025,wake+.15,fieldProgress);
          float farCover=smoothstep(6.0,24.0,camDist);
          diffuseColor.rgb=mix(diffuseColor.rgb,drift.rgb*.83,drift.a*flowering*farCover*.68);

          float horizonSun=smoothstep(vTerrainHorizon-.055,vTerrainHorizon+.085,
            meadowSun.y/max(.1,length(meadowSun.xz)));
          float facing=dot(macroNormal,meadowSun)+dot(vec3(softBump.x,0.0,softBump.y),meadowSun)*0.35;
          diffuseColor.rgb=meadowSharedLight(diffuseColor.rgb,vMeadowPos,camDist,facing,horizonSun,spruceData);

          diffuseColor.rgb*=1.0-meadowSky.w*(.18+fine*.22);
          // Hand-dusted lime chalk sits on upper grass blades with organic blade gaps & dirt wear.
          float chalkFiber=clamp(.44+tipGrain*3.2+fine*1.6,0.28,1.0)*(1.0-worn*.28);
          diffuseColor.rgb=mix(diffuseColor.rgb,chalk.rgb,chalk.a*(1.0-meadowSky.w*.29)*chalkFiber*.76);
          if(meadowSky.w>.025&&abs(m.x)<8.7&&abs(m.y-4.8)<15.0){
            float edge=poolShape(m)+.072*sin(m.x*17.0+m.y*11.0)+.089*sin(m.y*21.0-m.x*7.0);
            float liquid=(1.0-smoothstep(.15+meadowSky.w*.65,.39+meadowSky.w*.70,edge))*smoothstep(.045,.63,meadowSky.w);
            float rim=(1.0-smoothstep(.35+meadowSky.w*.68,.62+meadowSky.w*.74,edge))*(1.0-liquid)*smoothstep(.045,.55,meadowSky.w);
            meadowLiquid=liquid;
            meadowCapillary=rim;
            // Capillary damp darkening right outside the puddle edge.
            diffuseColor.rgb*=1.0-rim*.34;
            vec3 eye=normalize(cameraPosition-vMeadowPos);
            float fresnel=pow(1.0-max(0.0,eye.y),4.0);
            float ripples=sin(m.x*82.0+m.y*27.0-meadowClock*5.0)*
                          sin(m.y*71.0-m.x*39.0+meadowClock*6.0);
            vec3 n=normalize(vec3(.022*ripples,1.0,.016*cos(m.x*59.0-m.y*81.0+meadowClock*4.0)));
            float glint=pow(max(0.0,dot(reflect(-meadowSun,n),eye)),28.0);
            vec3 mirror=mix(vec3(.12,.16,.16),vec3(.43,.49,.49),fresnel);
            mirror+=vec3(.46,.39,.24)*glint*meadowSky.x*horizonSun;
            diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.48+mirror*.52,liquid*.89);
          }
        `).replace("#include <roughnessmap_fragment>",`
          #include <roughnessmap_fragment>
          float dryRough=clamp(.95-fine*.08,0.82,0.97);
          float wetRough=clamp(.44+fine*.14,0.34,0.64);
          roughnessFactor=mix(dryRough,wetRough,meadowSky.w);
          roughnessFactor=mix(roughnessFactor,.32,meadowCapillary);
          roughnessFactor=mix(roughnessFactor,.06,meadowLiquid);
        `);
      };
      const mesh=new THREE.Mesh(geo,mat);mesh.name="alpineMeadowGround";mesh.receiveShadow=true;
      s.root.add(mesh);s.meadowGround=mesh;
    }

    function mountainRange(s,far,material){
      const cols=s.mobile?220:400,rows=s.mobile?34:56;
      const radius=far?290:166,depth=far?143:123;
      // Bearing and relief describe a connected skyline. A wide shoulder and an off-centre
      // summit anchor the court-facing massif, with lower ridges continuing around the meadow.
      // Lower the far ring slightly in the front corridor (-0.52..+0.52) so the sculpted hero Bogda golden snow massif commands the skyline cleanly.
      const skyline=far?[
        [-Math.PI,48],[-2.85,59],[-2.62,67],[-2.25,50],[-2.02,62],[-1.75,50],[-1.39,66],
        [-1.05,53],[-.84,61],[-.70,68],[-.58,72],[-.45,56],[-.28,50],
        [-.15,48],[-.04,40],[.08,42],[.23,52],[.38,56],[.54,60],
        [.67,63],[.79,74],[.93,77],[1.12,63],[1.42,72],[1.72,54],[2.04,68],[2.38,54],[2.75,67],[Math.PI,48]
      ]:[
        [-Math.PI,27],[-2.77,35],[-2.37,27],[-2.05,37],[-1.74,29],[-1.38,39],
        [-1.08,25],[-.81,30],[-.63,39],[-.46,30],[-.23,31],[-.02,25],[.18,34],
        [.38,43],[.57,29],[.76,39],[1.05,33],[1.28,41],[1.52,32],[1.84,43],
        [2.10,32],[2.38,39],[2.64,31],[2.93,36],[Math.PI,27]
      ];
      const positions=[],uv=[],indices=[],deposition=[],exposure=[];
      const ridge=[],angle=[];
      let segment=0;
      for(let i=0;i<=cols;i++){
        const a=(i/cols-.5)*tau;
        while(a>skyline[segment+1][0])segment++;
        const [left,low]=skyline[segment],[right,high]=skyline[segment+1];
        const f=(a-left)/(right-left);
        const edge=(far?1:.68)*(1.05*Math.sin(a*93+.2)+.68*Math.sin(a*173-1.4));
        ridge.push(THREE.MathUtils.lerp(low,high,f)+edge);
        angle.push(a);
      }
      for(let row=0;row<=rows;row++)for(let i=0;i<=cols;i++){
        const a=angle[i],t=row/rows;
        const r=radius+t*depth+10*Math.sin(a*4+1)+7*Math.cos(a*9+t*1.8);
        const crest=.52+.046*Math.sin(a*11+.3)+.043*Math.cos(a*21);
        const profile=t<crest?Math.pow(t/crest,1.31):Math.pow((1-t)/(1-crest),1.45);
        // Cuts bend and join as they descend off the crest. Vary their width and depth along the range.
        const flow=a*(far?54:36)+t*13+2.1*Math.sin(a*13+t*3.8);
        const ravine=Math.pow(1-Math.abs(Math.sin(flow)),2);
        const ribs=.030*Math.sin(a*107-t*13+1.4*Math.sin(a*23+t*7))+.017*Math.sin(a*184+t*28);
        const cuts=(.67+.33*Math.sin(a*18+t*8))*(.055-.146*ravine)+ribs;
        const y=-5+ridge[i]*(profile+Math.sin(Math.PI*t)*(cuts+.014*Math.sin(t*31+a*27)));
        positions.push(Math.sin(a)*r,y,COURT.midZ-Math.cos(a)*r);
        uv.push(a*radius/30+t*.28,(t*depth+y*.62)/29);
        deposition.push(ravine);
        if(row<rows&&i<cols){
          const k=row*(cols+1)+i;
          indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
        }
      }
      const geo=new THREE.BufferGeometry();geo.setIndex(indices);
      geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
      const normals=geo.getAttribute("normal");
      for(let i=0;i<normals.count;i++){
        const a=angle[i%(cols+1)],y=positions[i*3+1],ny=normals.getY(i);
        const snowLine=(far?46:34)+6*Math.sin(a*9+.8)+3.5*Math.sin(a*22);
        const alpine=smooth(y,snowLine-22,snowLine+28);
        // Snow settles in bowls and chutes above the tree line. Convex, steep ribs stay exposed even at the summit.
        const retention=alpine*(.29+.49*smooth(ny,.23,.87)+.35*deposition[i]);
        const daylight=.50+.50*Math.max(0,-.39*normals.getX(i)+.74*ny+.55*normals.getZ(i));
        exposure.push(retention,daylight,smooth(y,far?36:34,far?91:62));
      }
      geo.setAttribute("rockExposure",new THREE.Float32BufferAttribute(exposure,3));
      const mesh=new THREE.Mesh(geo,material);
      mesh.name=far?"alpineFarSnowPeaks":"alpineNearRidges";s.root.add(mesh);
    }

    function goldenSnowMassif(s,rock){
      // Monumental Xinjiang Bogda-inspired "日照金山" (Alpenglow Golden Snow Peak) jagged alpine wall.
      // Uses a high-detail ridged-multifractal alpine ridge mesh (not smooth cones!) with authentic Bogda tri-spires,
      // knife-edge granite arêtes, recessed glacial cirques, and a clean open saddle behind the wooden hoop (a = 0)
      // so the hoop silhouette NEVER overlaps the peak while telephoto compression fills the sky with blazing golden snow.
      const cols=s.mobile?76:128,rows=s.mobile?22:34;
      const aMin=-0.68,aMax=0.68;
      // [bearing rad, summit height m] — primary colossal Bogda tri-peak on left (-0.26..-0.14), open sky saddle behind hoop (0.0), east horn (+0.24).
      const skyline=[
        [-0.68,38],[-0.56,52],[-0.44,64],[-0.35,71],[-0.295,86],[-0.255,79],
        [-0.215,96],[-0.182,102],[-0.152,88],[-0.118,75],[-0.075,54],[-0.030,42],
        [0.025,40],[0.085,48],[0.145,62],[0.195,77],[0.242,88],[0.295,74],
        [0.365,68],[0.460,55],[0.570,46],[0.680,36]
      ];
      const positions=[],uvs=[],meta=[],indices=[];
      const ridgeH=[],angles=[];
      let seg=0;
      for(let i=0;i<=cols;i++){
        const u=i/cols,a=THREE.MathUtils.lerp(aMin,aMax,u);
        while(seg<skyline.length-2&&a>skyline[seg+1][0])seg++;
        const [a0,h0]=skyline[seg],[a1,h1]=skyline[seg+1];
        const f=(a-a0)/Math.max(1e-5,a1-a0);
        // Sharp piecewise-linear ridge crest + jagged alpine crag serrations (zero rounded hills!).
        const saw1=1-Math.abs(Math.sin(a*34+0.6));
        const saw2=1-Math.abs(Math.sin(a*73-1.2));
        const crag=(saw1*3.8+saw2*1.9-2.8)*smooth(Math.abs(a),0.05,0.14)*(1-smooth(Math.abs(a),0.45,0.68));
        ridgeH.push(THREE.MathUtils.lerp(h0,h1,f)+crag);
        angles.push(a);
      }
      const rFront=268,rDepth=96;
      for(let row=0;row<=rows;row++){
        const t=row/rows;
        for(let i=0;i<=cols;i++){
          const a=angles[i],peakY=ridgeH[i];
          // Crest sits slightly toward the front-middle so the court-facing wall rises steeply and dramatically.
          const crest=0.58+0.04*Math.sin(a*19+0.4);
          const slope=t<crest?Math.pow(t/crest,1.22):Math.pow((1-t)/(1-crest),1.38);
          // Multi-octave ridged-multifractal granite ribs & glacial couloirs radiating down from the serrated summit!
          const drift=0.12*Math.sin(a*24+t*5.5);
          const r1=1-Math.abs(Math.sin(a*42+t*6.8+drift*9));
          const r2=1-Math.abs(Math.sin(a*88-t*11.5+1.3*Math.sin(a*17+t*4)));
          const r3=1-Math.abs(Math.sin(a*165+t*19.0));
          const ribSharp=Math.pow(r1,1.75)*0.58+Math.pow(r2,1.65)*0.28+Math.pow(r3,1.5)*0.14;
          const cirque=1-ribSharp;
          const wallEnv=Math.sin(Math.PI*t);
          // Project crisp rocky arete buttresses forward toward the court so raking sunlight carves blazing 3D facets!
          const buttress=(ribSharp-0.42)*(s.mobile?14.5:21.5)*wallEnv*(0.55+0.45*smooth(peakY,42,98));
          const r=rFront+t*rDepth-buttress+8.5*Math.sin(a*7+0.8);
          const relief=(ribSharp-0.46)*(s.mobile?0.17:0.22)*wallEnv;
          const edgeTaper=1-smooth(Math.abs(a),0.52,0.68);
          const y=-8+(peakY+8)*(slope+relief)*edgeTaper-8*(1-edgeTaper);
          const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
          positions.push(x,y,z);
          uvs.push(a*9.5+t*0.35,(y+10)/26);
          const alt=smooth(y,26,96);
          // Snow packs deep in glacial cirques & upper ridges, while steep convex granite ribs expose jagged dark rock!
          const snowPocket=THREE.MathUtils.clamp(alt*(0.42+0.68*cirque+0.26*smooth(y,56,94)),0,1);
          const alpenglowMask=smooth(y,38,88);
          meta.push(snowPocket,ribSharp,alt,alpenglowMask);
          if(row<rows&&i<cols){
            const k=row*(cols+1)+i;
            indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
          }
        }
      }

      const geo=new THREE.BufferGeometry();
      geo.setIndex(indices);
      geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
      geo.setAttribute("aPeakMeta",new THREE.Float32BufferAttribute(meta,4));
      geo.computeVertexNormals();

      const mat=new THREE.MeshBasicMaterial({map:rock,side:THREE.DoubleSide,fog:false});
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.vertexShader="attribute vec4 aPeakMeta;\nvarying vec4 vPeakMeta;\nvarying vec3 vPeakNormal,vPeakWorld;\n"+
          shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvPeakMeta=aPeakMeta;vPeakNormal=normal;vPeakWorld=position;");
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+AIBAMeadowWeather.skyGLSL+`
          varying vec4 vPeakMeta;
          varying vec3 vPeakNormal,vPeakWorld;
        `+shader.fragmentShader.replace("#include <map_fragment>",`
          vec3 rockCoarse=mapTexelToLinear(texture2D(map,vUv*0.65)).rgb;
          vec3 rockDetail=mapTexelToLinear(texture2D(map,vUv*1.95+vec2(vUv.y*0.28,0.0))).rgb;
          vec3 rockStrata=mapTexelToLinear(texture2D(map,vec2(vUv.x*2.6,vUv.y*0.72))).rgb;
          vec3 lum=vec3(.22,.70,.08);
          float macroG=dot(rockCoarse,lum),fineG=dot(rockDetail,lum),strataG=dot(rockStrata,lum);
          // Sculpted rock-face micro-normal perturbation creates crisp photographic crags and faceted cliff ridges.
          float hC=macroG*0.55+fineG*0.30+strataG*0.15;
          float hX=dot(mapTexelToLinear(texture2D(map,vUv*1.95+vec2(0.014,0.0))).rgb,lum);
          float hY=dot(mapTexelToLinear(texture2D(map,vUv*1.95+vec2(0.0,0.014))).rgb,lum);
          vec3 nrm=normalize(vPeakNormal+vec3((fineG-hX)*1.65,(fineG-hY)*1.15,(macroG-0.30)*0.45));

          // Authentic Tian Shan rock-and-glacier balance: dark slate/granite cliff strata cutting through luminous alpine snow!
          float steepCliff=1.0-smoothstep(0.16,0.62,nrm.y);
          float snowField=vPeakMeta.x+(macroG-0.28)*0.38+(strataG-0.28)*0.24-vPeakMeta.y*0.26-steepCliff*0.18+smoothstep(0.56,0.92,vPeakMeta.z)*0.38;
          float snowMask=smoothstep(0.22,0.50,snowField);
          vec3 graniteBase=vec3(0.18,0.21,0.27)*(0.45+1.35*macroG+0.55*fineG+0.35*strataG);
          vec3 snowBase=vec3(0.90,0.93,0.97)*(0.80+0.26*hC);
          vec3 surf=mix(graniteBase,snowBase,snowMask);

          // True Xinjiang "日照金山" Alpenglow: sharp raking golden-amber sunlight on left-facing knife ridges vs deep glacial cobalt shadows!
          vec3 sunDir=normalize(meadowSun);
          vec3 alpenSun=normalize(mix(sunDir,normalize(vec3(-0.78,0.20,0.59)),0.48));
          float face=dot(nrm,alpenSun);
          float litCrest=smoothstep(-0.04,0.22,face+(macroG-0.30)*0.16);
          float razorRim=pow(clamp(1.0-abs(face-0.06)*2.4,0.0,1.0),2.0)*vPeakMeta.w;

          // Noble sunlit champagne-gold snow in bright daylight -> blazing molten coral-gold "日照金山" at sunset/golden hour!
          float goldenPhase=clamp(mix(0.32,1.0,meadowSky.y)*(0.50+0.50*meadowSky.x),0.16,1.0);
          vec3 shadowSnow=mix(vec3(0.22,0.36,0.62),vec3(0.15,0.26,0.52),meadowSky.y);
          vec3 shadowRock=mix(vec3(0.08,0.12,0.22),vec3(0.06,0.10,0.20),meadowSky.y);
          vec3 shadedFace=mix(shadowRock,shadowSnow,snowMask)*(0.70+0.40*max(0.0,nrm.y));
          // Subtle sky bounce in shaded snow couloirs keeps glacier detail readable.
          shadedFace+=vec3(0.05,0.09,0.17)*snowMask*(1.0-vPeakMeta.y);

          vec3 dayLit=surf*vec3(1.06,0.99,0.88);
          // Blazing molten gold-to-amber gradient climbing to the summit tip ("日照金山" signature!).
          vec3 goldSnow=mix(vec3(1.32,0.74,0.26),vec3(1.62,0.58,0.15),vPeakMeta.w*0.72+0.28*meadowSky.y);
          vec3 goldRock=vec3(0.68,0.36,0.16)*(0.58+1.05*macroG+0.45*strataG);
          vec3 goldLit=mix(goldRock,goldSnow,snowMask)*(0.86+0.32*fineG);
          goldLit+=vec3(1.25,0.58,0.14)*razorRim*0.54;

          vec3 litFace=mix(dayLit,goldLit,goldenPhase*(0.38+0.62*vPeakMeta.w));
          vec3 col=mix(shadedFace,litFace,litCrest);
          col=mix(col,col*vec3(0.76,0.86,1.05)+vec3(0.015,0.025,0.045),(1.0-meadowSky.x)*0.36*(1.0-vPeakMeta.w*0.42));

          // Delicate low-foot valley mist ("薄云缠脚，金顶破空") tucked below y=34m so the towering golden massif stays 100% unobstructed!
          vec2 cUV=vPeakWorld.xz*1.45+vec2(meadowClock*1.4,-meadowClock*0.55);
          float cA=cloudDensity(cUV*0.55);
          float cB=cloudDensity(cUV*1.55+vec2(vPeakWorld.y*2.0,17.0));
          float lowMist=exp(-pow((vPeakWorld.y-16.0)/11.5,2.0))*smoothstep(40.0,18.0,vPeakWorld.y);
          float mistOpacity=clamp(lowMist*smoothstep(0.36,0.76,cA*0.6+cB*0.4)*mix(0.48,0.22,meadowSky.x),0.0,0.46);
          vec3 mistCol=mix(vec3(0.42,0.50,0.62),mix(vec3(0.92,0.90,0.86),vec3(1.0,0.74,0.46),meadowSky.y),smoothstep(0.24,0.82,cB));

          vec3 path=vPeakWorld-cameraPosition;
          float dist=length(path);
          vec3 ray=path/max(0.001,dist);
          vec3 skyCol=alpineSky(ray,cameraPosition);
          float hazeAmt=smoothstep(210.0,760.0,dist)*mix(0.16,0.08,meadowSky.x)*(1.0-vPeakMeta.w*0.50);
          vec3 rockOut=mix(col*(1.0-meadowStorm.y*0.76),skyCol,hazeAmt);
          diffuseColor.rgb=mix(rockOut,mistCol,mistOpacity);
        `);
      };
      const mesh=new THREE.Mesh(geo,mat);
      mesh.name="alpineGoldenMassif";
      mesh.frustumCulled=false;
      s.root.add(mesh);

      // Delicate golden wind-blown summit banner cloud ("峰顶旗云") streaming off the primary golden peak tip.
      const mainA=-0.182,mainR=316;
      const mx=Math.sin(mainA)*mainR,mz=COURT.midZ-Math.cos(mainA)*mainR;
      const bGeo=new THREE.PlaneGeometry(54,12,12,2);
      const bMat=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
        uniforms:{meadowClock:s.meadow.uniforms.meadowClock,meadowSky:s.meadow.uniforms.meadowSky,meadowStorm:s.meadow.uniforms.meadowStorm},
        vertexShader:`
          uniform float meadowClock;
          varying vec2 vUv;
          void main(){
            vUv=uv;
            vec3 p=position;
            float tail=uv.x;
            p.y+=sin(tail*4.6-meadowClock*1.15)*2.4*tail-tail*tail*4.2;
            p.z+=cos(tail*3.8-meadowClock*0.9)*2.0*tail;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
          }`,
        fragmentShader:`
          uniform float meadowClock;
          uniform vec4 meadowSky;
          uniform vec2 meadowStorm;
          varying vec2 vUv;
          void main(){
            float along=smoothstep(0.0,0.14,vUv.x)*(1.0-smoothstep(0.26,1.0,vUv.x));
            float across=1.0-smoothstep(0.06,0.48,abs(vUv.y-0.5));
            float wisp=0.65+0.35*sin(vUv.x*16.0-meadowClock*1.4+vUv.y*6.0);
            float a=along*across*wisp*mix(0.18,0.34,meadowSky.x)*(1.0-meadowStorm.y*0.8);
            vec3 c=mix(vec3(0.96,0.93,0.88),vec3(1.0,0.68,0.34),clamp(meadowSky.y*0.90+0.20,0.0,1.0));
            gl_FragColor=vec4(c,a);
          }`
      });
      const banner=new THREE.Mesh(bGeo,bMat);
      banner.name="alpineSummitBanner";
      banner.position.set(mx+24,99,mz+6);
      banner.rotation.y=-0.20;
      banner.frustumCulled=false;
      s.root.add(banner);
    }

    function meadowParallaxFence(s){
      // Weathered Xinjiang split-rail timber pasture fence tucked along the outer south-southwest & south-southeast meadow berm.
      // Completely clear of the court, all rack sightlines, and menuOrbit (y = 8m), providing crisp Queenstown-style
      // foreground motion parallax during the low telephoto arrival sweep!
      const p=[],n=[],c=[],idx=[];
      const woodBase=linear(0x6d5c4c),woodLight=linear(0x8f7d68),col=new THREE.Color();
      function addBox(cx,cy,cz,sx,sy,sz,ry,rz,tint){
        const base=p.length/3;
        const hx=sx*0.5,hy=sy*0.5,hz=sz*0.5;
        const corners=[
          [-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],
          [-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]
        ];
        const cyr=Math.cos(ry),syr=Math.sin(ry),czr=Math.cos(rz),szr=Math.sin(rz);
        const faces=[
          [[4,5,6,7],[0,0,1]],[[1,0,3,2],[0,0,-1]],
          [[0,4,7,3],[-1,0,0]],[[5,1,2,6],[1,0,0]],
          [[3,7,6,2],[0,1,0]],[[0,1,5,4],[0,-1,0]]
        ];
        let vOffset=base;
        for(const [f,fn] of faces){
          col.copy(woodBase).lerp(woodLight,tint*(0.72+0.28*Math.max(0,fn[1])));
          const nx1=fn[0]*czr-fn[1]*szr,ny1=fn[0]*szr+fn[1]*czr,nz1=fn[2];
          const rnx=nx1*cyr+nz1*syr,rnz=-nx1*syr+nz1*cyr;
          for(const ci of f){
            const [vx,vy,vz]=corners[ci];
            const x1=vx*czr-vy*szr,y1=vx*szr+vy*czr,z1=vz;
            const rx=x1*cyr+z1*syr,rz2=-x1*syr+z1*cyr;
            p.push(cx+rx,cy+y1,cz+rz2);
            n.push(rnx,ny1,rnz);
            c.push(col.r,col.g,col.b);
          }
          idx.push(vOffset,vOffset+1,vOffset+2,vOffset,vOffset+2,vOffset+3);
          vOffset+=4;
        }
      }
      const segments=[
        // South-southwest berm fence line (2.2–4.0m in front of the Queenstown arrival sweep, completely clear of all sidelines & spectators!).
        [[-13.4,10.9],[-11.2,10.5],[-9.1,10.6],[-7.9,11.1]],
        // South-southeast berm fence line (natural pasture balance).
        [[8.8,14.5],[11.4,13.8],[14.0,13.4]]
      ];
      for(const seg of segments){
        for(let i=0;i<seg.length;i++){
          const [px,pz]=seg[i],py=elevation(px,pz);
          const tilt=(i%2?1:-1)*0.04;
          addBox(px,py+0.44,pz,0.12,0.96,0.12,i*0.5,tilt,0.35+(i%3)*0.22);
          if(i<seg.length-1){
            const [qx,qz]=seg[i+1],qy=elevation(qx,qz);
            const mx=(px+qx)*0.5,mz=(pz+qz)*0.5,my=(py+qy)*0.5;
            const dx=qx-px,dz=qz-pz,len=Math.hypot(dx,dz)+0.16;
            const yaw=-Math.atan2(dz,dx),slope=Math.atan2(qy-py,len);
            addBox(mx,my+0.70,mz,len,0.085,0.06,yaw,slope,0.68);
            addBox(mx,my+0.36,mz,len,0.08,0.055,yaw,slope,0.48);
          }
        }
      }
      const geo=new THREE.BufferGeometry();
      geo.setIndex(idx);
      geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
      geo.setAttribute("normal",new THREE.Float32BufferAttribute(n,3));
      geo.setAttribute("color",new THREE.Float32BufferAttribute(c,3));
      const mat=new THREE.MeshLambertMaterial({vertexColors:true});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.name="meadowParallaxFence";
      mesh.castShadow=!s.mobile;mesh.receiveShadow=true;
      s.root.add(mesh);
    }

    function spruceAtlas(){
      const atlas=document.createElement("canvas");atlas.width=256;atlas.height=256;
      const g=atlas.getContext("2d"),r=mulberry32(0x4f6c835d);
      // Needle region (0..192) uses alpha cutout along the outer bough tips for natural jagged silhouettes.
      // Keep atlas luminance high and neutral so per-instance species colors (golden larch, blue spruce, emerald pine) shine clearly!
      g.clearRect(0,0,192,256);
      g.fillStyle="#c8d1c2";
      g.beginPath();g.moveTo(0,0);g.lineTo(192,0);g.lineTo(192,165);
      for(let x=192;x>=0;x-=8)g.lineTo(x,150+34*Math.sin(x*.09)+r()*36);
      g.closePath();g.fill();
      for(let i=0;i<420;i++){
        const x=r()*190,y=r()*236,len=10+r()*36,direction=i%2?1:-1;
        const bright=i%3===0;
        g.strokeStyle=bright?"rgba(250,253,242,.95)":(i%2?"rgba(122,138,118,.92)":"rgba(188,202,176,.95)");
        g.lineWidth=1.1+r()*2.1;g.beginPath();
        g.moveTo(x,y);g.quadraticCurveTo(x+direction*len*.24,y+len*.42,x+direction*len*.46,y+len);g.stroke();
        for(let j=1;j<6;j++){
          const a=j/6,cx=x+direction*len*.46*a,cy=y+len*a,needle=(1-a*.65)*(3.5+r()*9);
          g.beginPath();g.moveTo(cx-needle,cy+3.5);g.lineTo(cx,cy);g.lineTo(cx+needle,cy+4);g.stroke();
        }
      }
      // Bark strip (192..256) stays fully opaque.
      g.fillStyle="#8e8274";g.fillRect(192,0,64,256);
      for(let i=0;i<165;i++){
        const x=193+r()*63,y=r()*256,h=11+r()*75,shade=i%3?58:188;
        g.strokeStyle=`rgba(${shade},${shade-4},${shade-8},.50)`;g.lineWidth=.6+r()*2.4;
        g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*3,y+h*.68);g.lineTo(x+(r()-.5)*4,y+h);g.stroke();
      }
      const map=new THREE.CanvasTexture(atlas);map.encoding=THREE.sRGBEncoding;
      map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return map;
    }

    function spruceForest(s){
      // 3-tier conifer LOD + hero court-side spruces (inspired by Valley Ride flora hierarchy, MIT).
      const dark=linear(0x4e6352),tipColor=linear(0xc6d4a8),bark=linear(0x6e5a4c),c=new THREE.Color();
      function buildSpruceGeo(tiers,segs,detailed){
        const p=[],colors=[],uv=[];
        function surface(triangle,coords,color){
          for(let i=0;i<3;i++){p.push(...triangle[i]);uv.push(...coords[i]);colors.push(color.r,color.g,color.b);}
        }
        const barkUV=[[.76,.03],[.99,.03],[.76,.95],[.99,.95]];
        const trunkSides=detailed?8:(tiers>=5?5:4);
        const trunkTop=detailed?.94:(tiers>=5?.89:.84);
        if(detailed){
          const point=(k,y,r,flute=0)=>{
            const a=k*tau/trunkSides,rad=r*(1+flute*(.28*Math.cos(a*4)+.12*Math.sin(a*3)));
            return [Math.cos(a)*rad,y,Math.sin(a)*rad];
          };
          for(let j=0;j<trunkSides;j++){
            const r0=point(j,0,.056,1),r1=point(j+1,0,.056,1),k0=point(j,.14,.028,0),k1=point(j+1,.14,.028,0);
            surface([r0,r1,k0],[barkUV[0],barkUV[1],barkUV[2]],bark);
            surface([r1,k1,k0],[barkUV[1],barkUV[3],barkUV[2]],bark);
            const t0=point(j,trunkTop,.008,0),t1=point(j+1,trunkTop,.008,0);
            surface([k0,k1,t0],[barkUV[0],barkUV[1],barkUV[2]],bark);
            surface([k1,t1,t0],[barkUV[1],barkUV[3],barkUV[2]],bark);
          }
          // Four weathered lower dead-branch stubs near base for close foreground silhouette.
          for(let sb=0;sb<4;sb++){
            const a=sb*1.58+.4,sy=.11+sb*.026,dx=Math.cos(a),dz=Math.sin(a),px=-dz*.008,pz=dx*.008;
            surface([[dx*.022+px,sy,dz*.022+pz],[dx*.022-px,sy,dz*.022-pz],[dx*.135,sy-.018,dz*.135]],
              [barkUV[0],barkUV[1],barkUV[2]],bark);
            surface([[dx*.022-px,sy,dz*.022-pz],[dx*.022+px,sy-.012,dz*.022+pz],[dx*.135,sy-.018,dz*.135]],
              [barkUV[1],barkUV[3],barkUV[2]],bark);
          }
        }else{
          for(let j=0;j<trunkSides;j++){
            const point=(k,y,r)=>[Math.cos(k*tau/trunkSides)*r,y,Math.sin(k*tau/trunkSides)*r];
            const a=point(j,0,.028),b=point(j+1,0,.028),m=point(j,trunkTop,.009),n=point(j+1,trunkTop,.009);
            surface([a,b,m],[barkUV[0],barkUV[1],barkUV[2]],bark);
            surface([b,n,m],[barkUV[1],barkUV[3],barkUV[2]],bark);
          }
        }
        const yStart=detailed?.17:(tiers>=5?.14:.12),ySpan=detailed?.72:.68;
        const yStep=ySpan/Math.max(1,tiers-1);
        for(let tier=0;tier<tiers;tier++){
          const tierFrac=tier/Math.max(1,tiers-1);
          const y=yStart+tierFrac*ySpan,width=(detailed?.32:.31)*Math.pow(1-tier/(tiers+0.85),.84),turn=tier*.79;
          const rise=Math.max(detailed?.21:.22,yStep*1.62)*Math.pow(1-tierFrac*.20,.85);
          for(let j=0;j<segs;j++){
            const rim=(k,outer)=>{
              const a=k/segs*tau+turn,gap=.76+.24*Math.sin(k*7.7+tier*2.67)+.11*Math.cos(k*13.1-tier*1.9);
              const r=width*gap*(outer?1:.45);
              return [.009*tier+Math.cos(a)*r,y+(outer?-width*(detailed?.16:.15)+Math.sin(k*9+tier)*(detailed?.046:.040):.12),Math.sin(a)*r];
            };
            const tip=[.012*tier,y+rise,0],a=rim(j,true),b=rim(j+1,true),m=rim(j,false),n=rim(j+1,false);
            const left=.03+(j%3)*.12,right=left+.36;
            const cutV=detailed?.08:.14;
            const t0=[left,cutV],t1=[right,cutV],t2=[left+.035,.64],t3=[right-.03,.66],top=[(left+right)*.5,.92];
            const ao=(detailed?.56:.62)+(detailed?.44:.38)*tierFrac;
            c.copy(dark).lerp(tipColor,.18+.64*(Math.cos(j/segs*tau+turn)*.5+.5)).multiplyScalar(ao);
            surface([m,b,a],[t2,t1,t0],c);surface([m,n,b],[t2,t3,t1],c);surface([tip,n,m],[top,t3,t2],c);
          }
        }
        const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
        geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
        geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
        return geo;
      }
      const heroGeo=buildSpruceGeo(10,s.mobile?10:12,true);
      const midGeo=buildSpruceGeo(6,7,false);
      const farGeo=buildSpruceGeo(4,5,false);
      const mat=new THREE.MeshLambertMaterial({vertexColors:true,map:spruceAtlas(),alphaTest:.42,side:THREE.DoubleSide});
      mat.addEventListener("dispose",()=>{
        if(s.meadow?.uniforms?.meadowTreeMap?.value){
          s.meadow.uniforms.meadowTreeMap.value.dispose();
          s.meadow.uniforms.meadowTreeMap.value=null;
        }
      });
      mat.onBeforeCompile=shader=>{
        shader.uniforms.meadowTime=s.meadow.time;
        shader.uniforms.meadowWind=s.meadow.wind;
        shader.uniforms.meadowSun=s.meadow.uniforms.meadowSun;
        shader.uniforms.meadowSky=s.meadow.uniforms.meadowSky;
        shader.uniforms.meadowPressure=s.meadow.uniforms.meadowPressure;
        shader.vertexShader=AIBAMeadowWeather.windGLSL+"uniform vec4 meadowPressure;\nuniform float meadowTime,meadowWind;\nvarying float vSpruceH;\nvarying vec3 vSpruceWorld,vSpruceCrownN;\n"+
          shader.vertexShader.replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vSpruceH=clamp(position.y,0.0,1.0);
            vec2 root=instanceMatrix[3].xz;
            // Lower trunk stays stiff while upper boughs trail behind passing wind gusts.
            float trunkFlex=pow(vSpruceH,2.2);
            vec3 tw=sampleMeadowWind(root,meadowTime-0.35,meadowWind);
            vec2 tLocal=meadowLocalWind(instanceMatrix,(MEADOW_WIND_DIR*tw.x+MEADOW_WIND_PERP*tw.y)*0.28);
            transformed.xz+=tLocal*trunkFlex;
            ${pressureBend("vSpruceH*vSpruceH*.38")}
            vSpruceWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
            vSpruceCrownN=normalize(mat3(instanceMatrix)*vec3(position.x,.36,position.z));
          `);
        shader.fragmentShader="uniform vec3 meadowSun;\nuniform vec4 meadowSky;\nvarying float vSpruceH;\nvarying vec3 vSpruceWorld,vSpruceCrownN;\n"+
          shader.fragmentShader.replace("#include <dithering_fragment>",`
            // 新疆雪岭云杉深邃立体树冠光影：底部与内层枝叶深暗遮蔽 (crownAO: 0.30 -> 1.24)，向阳侧暖金翠绿与背阴侧深冷松青强烈反差
            float crownAO=mix(.30,1.24,smoothstep(.03,.88,vSpruceH));
            float sunSide=smoothstep(-.42,.48,dot(normalize(vSpruceCrownN),meadowSun));
            vec3 shadeTint=vec3(.52,.66,.82);
            vec3 litTint=mix(vec3(1.26,1.28,1.12),vec3(1.44,1.22,.86),meadowSky.y);
            vec3 crownLight=mix(shadeTint,litTint,sunSide);
            vec3 viewDir=normalize(cameraPosition-vSpruceWorld);
            float rim=pow(clamp(dot(-viewDir,meadowSun),0.0,1.0),2.6)*vSpruceH*(.38+.62*meadowSky.x);
            vec3 rimCol=mix(vec3(.46,.62,.36),vec3(.96,.64,.28),meadowSky.y);
            vec3 col=gl_FragColor.rgb*crownAO*crownLight*(1.0-meadowSky.w*.14)+rimCol*rim*.38;
            // Distance-based alpine aerial perspective separates near hero spruces (22m) from mid (60m) and far (95m) tree belts.
            float treeDist=length(vSpruceWorld-cameraPosition);
            float treeHaze=smoothstep(24.0,112.0,treeDist)*mix(.54,.30,meadowSky.x);
            vec3 hazeCol=mix(vec3(.45,.55,.63),vec3(.72,.66,.55),meadowSky.y);
            gl_FragColor.rgb=mix(col,hazeCol,treeHaze);
            #include <dithering_fragment>
          `);
      };
      const heroMesh=new THREE.InstancedMesh(heroGeo,mat,HERO_SPRUCES.length);
      const midCount=s.mobile?80:150,farCount=s.mobile?228:450;
      const midMesh=new THREE.InstancedMesh(midGeo,mat,midCount);
      const farMesh=new THREE.InstancedMesh(farGeo,mat,farCount);
      const tree=new THREE.Object3D(),tone=new THREE.Color();
      const sprucePalette=[0x4d6e4e,0x5f7d4c,0x45665c,0x6b8550,0x3f5e46,0x738252,0x537349,0x486b55];
      const ridges=[[-1.04,61,17],[-.68,82,23],[.35,67,14],[.71,86,23],[1.59,82,31],[-1.81,78,23],[2.7,88,30],[-2.66,97,32]];
      // 烘焙雪岭云杉的精确地面阴影与林下松针苔藓腐殖质图 (512x512, 覆盖 [-140m, +140m])
      const treeCv=document.createElement("canvas");treeCv.width=512;treeCv.height=512;
      const tg=treeCv.getContext("2d");
      tg.fillStyle="#000000";tg.fillRect(0,0,512,512);
      tg.globalCompositeOperation="lighter";
      const toMapX=wx=>((wx/280)+0.5)*512;
      const toMapY=wz=>(((wz-COURT.midZ)/280)+0.5)*512;
      const scalePx=512/280;
      const paintTreeShadow=(tx,tz,th)=>{
        const cx=toMapX(tx),cy=toMapY(tz);
        const aoR=Math.max(3.5,th*0.64*scalePx);
        const gGrad=tg.createRadialGradient(cx,cy,aoR*0.1,cx,cy,aoR);
        gGrad.addColorStop(0,"rgba(0,185,0,1)");
        gGrad.addColorStop(0.55,"rgba(0,110,0,1)");
        gGrad.addColorStop(1,"rgba(0,0,0,0)");
        tg.fillStyle=gGrad;
        tg.beginPath();tg.arc(cx,cy,aoR,0,tau);tg.fill();
        const shLen=th*1.55*scalePx;
        const ex=cx-0.51*shLen,ey=cy+0.86*shLen;
        const rGrad=tg.createLinearGradient(cx,cy,ex,ey);
        rGrad.addColorStop(0,"rgba(195,0,0,1)");
        rGrad.addColorStop(0.6,"rgba(130,0,0,1)");
        rGrad.addColorStop(1,"rgba(0,0,0,0)");
        tg.fillStyle=rGrad;
        const perpX=0.86*aoR*0.72,perpY=0.51*aoR*0.72;
        tg.beginPath();
        tg.moveTo(cx-perpX,cy-perpY);
        tg.lineTo(cx+perpX,cy+perpY);
        tg.lineTo(ex+perpX*0.18,ey+perpY*0.18);
        tg.lineTo(ex-perpX*0.18,ey-perpY*0.18);
        tg.closePath();tg.fill();
      };
      for(let i=0;i<HERO_SPRUCES.length;i++){
        const [hx,hz,hh]=HERO_SPRUCES[i];
        tree.position.set(hx,elevation(hx,hz)-.07*hh,hz);
        tree.rotation.set((s.r()-.5)*.03,s.r()*tau,(s.r()-.5)*.03);
        tree.scale.set(hh*.78,hh,hh*.78);tree.updateMatrix();
        heroMesh.setMatrixAt(i,tree.matrix);
        tone.set(sprucePalette[i%sprucePalette.length]).convertSRGBToLinear().multiplyScalar(.95+.18*s.r());
        heroMesh.setColorAt(i,tone);
        paintTreeShadow(hx,hz,hh);
      }
      const placeBelts=(mesh,rMin,rMax,seedShift)=>{
        for(let i=0;i<mesh.count;i++){
          const [heading,,width]=ridges[(i+seedShift)%ridges.length];
          const r=THREE.MathUtils.lerp(rMin,rMax,s.r());
          const a=heading+(s.r()+s.r()-1)*(width*1.12)/r;
          const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r,h=4.3+6.8*Math.pow(s.r(),1.4);
          tree.position.set(x,elevation(x,z)-.09*h,z);
          tree.rotation.set((s.r()-.5)*.045,s.r()*tau,(s.r()-.5)*.05);
          tree.scale.set(h*(.68+s.r()*.4),h,h*(.68+s.r()*.4));tree.updateMatrix();
          mesh.setMatrixAt(i,tree.matrix);
          tone.set(sprucePalette[(i*3+seedShift+Math.floor(s.r()*7))%sprucePalette.length]).convertSRGBToLinear().multiplyScalar(.78+.36*s.r());
          mesh.setColorAt(i,tone);
          paintTreeShadow(x,z,h);
        }
      };
      placeBelts(midMesh,32,65,0);
      placeBelts(farMesh,65,115,3);
      const treeMap=new THREE.CanvasTexture(treeCv);
      treeMap.wrapS=treeMap.wrapT=THREE.ClampToEdgeWrapping;
      s.meadow.uniforms.meadowTreeMap.value=treeMap;
      heroMesh.name="alpineHeroSpruces";heroMesh.castShadow=!s.mobile;heroMesh.receiveShadow=false;heroMesh.frustumCulled=false;s.root.add(heroMesh);
      midMesh.name="alpineSpruceBelts";midMesh.frustumCulled=false;s.root.add(midMesh);
      farMesh.name="alpineFarSpruces";farMesh.frustumCulled=false;s.root.add(farMesh);
      s.meadowLayersRefs=s.meadowLayersRefs||{grass:[],trees:[]};
      s.meadowLayersRefs.heroTree=heroMesh;
      s.meadowLayersRefs.trees.push(heroMesh,midMesh,farMesh);
    }

    function meadowFurShells(s){
      // 6-layer 3D GPU Shell-Fur carpet (Shadow of the Colossus / EA FC turf technique) over the semi-wild court & ragged sidelines.
      // Gives true dense velvety short-grass pile (~7,000 curved micro-fibers/m²), real-time hoop/player shadows, and soft chalk dust with ZERO white shark-teeth or needle spikes!
      const layers=s.mobile?5:6;
      const sx=s.mobile?38:56,sz=s.mobile?44:64;
      const width=30.8,depth=36.4,centerZ=COURT.midZ;
      const geo=new THREE.PlaneGeometry(width,depth,sx,sz);
      geo.rotateX(-Math.PI/2);
      const pos=geo.attributes.position,nrm=geo.attributes.normal;
      const furMeta=new Float32Array(pos.count*3),nTmp=new THREE.Vector3();
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),z=pos.getZ(i)+centerZ;
        const y=elevation(x,z);
        pos.setXYZ(i,x,y,z);
        terrainNormalAt(x,z,nTmp);
        nrm.setXYZ(i,nTmp.x,nTmp.y,nTmp.z);
        const hor=terrainHorizonAt(x,z,y);
        const wear=turfWearAt(x,z);
        const rawH=turfHeightAt(x,z);
        // Playable velvety mown court fur (3.0cm worn paint -> 8.2cm rougher court pockets), rising smoothly to 14cm plush base undercoat in sidelines!
        const furH=THREE.MathUtils.clamp(rawH*0.52*(1-wear*0.32),0.026,0.145);
        const edgeX=1-smooth(Math.abs(x),width*0.5-3.4,width*0.5-0.2);
        const edgeZ=1-smooth(Math.abs(z-centerZ),depth*0.5-3.4,depth*0.5-0.2);
        furMeta[i*3]=hor;
        furMeta[i*3+1]=furH;
        furMeta[i*3+2]=edgeX*edgeZ;
      }
      geo.setAttribute("aFurMeta",new THREE.BufferAttribute(furMeta,3));
      const shellFracs=new Float32Array(layers);
      for(let l=0;l<layers;l++)shellFracs[l]=(l+1)/layers;
      geo.setAttribute("aShellFrac",new THREE.InstancedBufferAttribute(shellFracs,1));
      const mat=new THREE.MeshStandardMaterial({
        roughness:.93,metalness:0,transparent:true,depthWrite:false,side:THREE.FrontSide
      });
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.uniforms.meadowTime=s.meadow.time;
        shader.uniforms.meadowWind=s.meadow.wind;
        shader.uniforms.grassDetail={value:s.meadowGrassTex};
        shader.uniforms.courtChalk={value:s.meadowCourtMarks};
        shader.vertexShader=AIBAMeadowWeather.windGLSL+
          "attribute vec3 aFurMeta;\nattribute float aShellFrac;\nuniform float meadowTime,meadowWind;\nuniform vec4 meadowActors,meadowBall,meadowPressure;\nvarying float vShellFrac,vFurHeight,vFurEdge,vFurHorizon,vFurGust;\nvarying vec3 vFurWorld,vFurNormal;\nvarying vec2 vFurWind;\n"+
          shader.vertexShader.replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vFurHorizon=aFurMeta.x;
            vFurHeight=aFurMeta.y;
            vFurEdge=aFurMeta.z;
            vShellFrac=aShellFrac;
            vec2 rootXZ=position.xz;
            vec3 gw=sampleMeadowWind(rootXZ,meadowTime,meadowWind);
            vFurGust=gw.z;
            vec2 windVec=MEADOW_WIND_DIR*gw.x+MEADOW_WIND_PERP*gw.y;
            vFurWind=windVec;
            vec2 pushVec=vec2(0.0);
            float pushDown=0.0;
            vec2 dA=rootXZ-meadowActors.xy;float lA=length(dA);
            if(lA<.85){float wA=pow(1.0-lA/.85,1.6);pushVec+=dA/max(.04,lA)*wA*.40;pushDown=max(pushDown,wA*.65);}
            vec2 dB=rootXZ-meadowActors.zw;float lB=length(dB);
            if(lB<.85){float wB=pow(1.0-lB/.85,1.6);pushVec+=dB/max(.04,lB)*wB*.40;pushDown=max(pushDown,wB*.65);}
            vec2 dC=rootXZ-meadowBall.xy;float lC=length(dC);
            if(lC<.55){float wC=pow(1.0-lC/.55,1.6);pushVec+=dC/max(.04,lC)*wC*.34;pushDown=max(pushDown,wC*.55);}
            if(meadowPressure.w>0.0){
              vec2 deltaP=rootXZ-meadowPressure.xy;float dP=length(deltaP);
              float crestP=meadowPressure.w*(1.0-smoothstep(.55,3.8,abs(dP-meadowPressure.z)));
              pushVec+=(deltaP/max(dP,.05))*crestP*.45;pushDown=max(pushDown,crestP*.50);
            }
            float shY=vFurHeight*vShellFrac*(1.0-pushDown*0.62);
            vec2 horizOff=windVec*(shY*0.62*vShellFrac)+pushVec*(shY*0.65);
            transformed.y+=shY+0.004;
            transformed.xz+=horizOff;
            vFurWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
            vFurNormal=normalize(normal);
          `);
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+spruceShadowGLSL+meadowPaletteGLSL+
          "uniform sampler2D grassDetail;\nuniform sampler2D courtChalk;\nuniform vec2 meadowFurDist;\nvarying float vShellFrac,vFurHeight,vFurEdge,vFurHorizon,vFurGust;\nvarying vec3 vFurWorld,vFurNormal;\nvarying vec2 vFurWind;\n"+
          shader.fragmentShader.replace("#include <color_fragment>",`
            #include <color_fragment>
            vec2 m=vFurWorld.xz;
            float camDist=length(cameraPosition.xz-m);
            float distFade=1.0-smoothstep(meadowFurDist.x,meadowFurDist.y,camDist);
            float fadeMask=vFurEdge*distFade;
            if(fadeMask<0.015)discard;

            // Curved velvety micro-grass fiber field (~7,000 soft tapered micro-blades per m²) sheared subtly along organic tuft curl.
            mat2 rotA=mat2(0.866,-0.500,0.500,0.866);
            mat2 rotB=mat2(0.588,0.809,-0.809,0.588);
            vec2 curlDir=vec2(meadowNoise2D(m*2.4+vec2(4.1,-8.3))-0.5,meadowNoise2D(m*2.4+vec2(-9.2,6.7))-0.5);
            vec2 fCoord=m-curlDir*(vFurHeight*vShellFrac*0.58);
            float clump=meadowNoise2D(fCoord*15.5+vec2(2.3,-5.7));
            float hairA=meadowNoise2D(rotA*fCoord*46.0+vec2(7.1,13.4));
            float hairB=meadowNoise2D(rotB*fCoord*74.0+vec2(-11.3,5.2));
            float fineTip=meadowNoise2D(rotA*fCoord*116.0+vec2(19.7,-4.1));
            float fiberH=clamp(hairA*0.44+hairB*0.36+fineTip*0.20+(clump-0.5)*0.30,0.0,1.0);

            vec2 uvWarp=vec2(meadowNoise2D(m*0.14+vec2(3.7,-6.2))-0.5,meadowNoise2D(m*0.14+vec2(-11.4,8.9))-0.5)*2.6;
            vec2 mOrg=m+uvWarp;
            vec3 bladesTex=sRGBToLinear(texture2D(grassDetail,(rotA*mOrg)*0.48+vec2(0.19,0.43))).rgb;
            vec3 patches=sRGBToLinear(texture2D(grassDetail,mOrg*0.088+vec2(0.26,0.31))).rgb;
            vec3 macroTex=sRGBToLinear(texture2D(grassDetail,(rotB*m)*0.024+vec2(0.61,0.17))).rgb;
            float fine=dot(bladesTex,vec3(0.22,0.70,0.08));
            float coarse=dot(patches,vec3(0.22,0.70,0.08));
            float macro=dot(macroTex,vec3(0.22,0.70,0.08));
            float organicTussock=meadowFbm(m*0.34+vec2(-4.7,9.3));
            float tussockAO=mix(0.80,1.18,smoothstep(0.10,0.34,coarse*0.44+fine*0.30+organicTussock*0.26));
            float bladeDetail=(0.82+coarse*1.48+(fine-.13)*1.45+(organicTussock-.48)*0.18)*tussockAO;

            vec2 spData=sampleSpruceForest(vFurWorld,meadowSun);
            float worn=0.0;
            vec3 baseEst=meadowBaseTint(m)*bladeDetail*mix(1.22,1.0,meadowSky.x);
            vec3 groundCol=meadowGroundAlbedo(m,baseEst,coarse,macro,0.14,spData,worn);

            // Thin fiber density organically over heavily scuffed dirt spots so trampled loam peeks naturally through short grass.
            float thresh=vShellFrac*(0.76+worn*0.28);
            float fiberCov=smoothstep(thresh-0.11,thresh+0.13,fiberH);
            vec3 viewDir=normalize(cameraPosition-vFurWorld);
            float grazeFill=mix(0.66,0.92,pow(1.0-clamp(viewDir.y,0.0,1.0),1.3));
            float furAlpha=fiberCov*grazeFill*(1.0-vShellFrac*0.28)*fadeMask*(1.0-worn*0.42);
            if(furAlpha<0.018)discard;

            float velvet=pow(1.0-max(0.0,dot(viewDir,vFurNormal)),2.0)*(.44+.48*organicTussock)*(1.0-worn*.78)*(1.0-spData.y*.7);
            groundCol+=vec3(.076,.104,.039)*velvet;

            // Plush carpet depth: deeper mossy root shadow on lower shells -> warm sunlit golden-sage velvet tips on top shells!
            vec3 tipTint=mix(vec3(1.06,1.11,0.90),vec3(1.24,1.20,0.84),clamp(organicTussock*0.7+clump*0.45,0.0,1.0));
            vec3 furCol=mix(groundCol*0.78,groundCol*tipTint,smoothstep(0.05,0.95,vShellFrac));
            furCol*=mix(0.92,1.12,fineTip);
            furCol+=groundCol*(vFurGust*0.12*vShellFrac*meadowSky.x);

            float horizonSun=smoothstep(vFurHorizon-.055,vFurHorizon+.085,meadowSun.y/max(.1,length(meadowSun.xz)));
            float facing=dot(vFurNormal,meadowSun);
            vec3 litCol=meadowSharedLight(furCol,vFurWorld,camDist,facing,horizonSun,spData)*(1.0-meadowSky.w*.18);

            // Soft hand-dusted lime chalk sits naturally across the dense short velvet fur (zero white shark teeth!).
            if(abs(m.x)<15.5&&m.y>-12.5&&m.y<22.5){
              vec2 uvMarks=vec2(m.x/32.0+0.5,1.0-(m.y+13.0)/36.0);
              vec4 chalk=sRGBToLinear(texture2D(courtChalk,uvMarks));
              float chalkDust=chalk.a*(1.0-meadowSky.w*.29)*(0.55+0.45*vShellFrac)*(1.0-worn*0.24)*0.78;
              litCol=mix(litCol,chalk.rgb,chalkDust);
            }
            diffuseColor=vec4(litCol,furAlpha);
          `);
      };
      const mesh=new THREE.InstancedMesh(geo,mat,layers);
      const idMat=new THREE.Matrix4();
      for(let l=0;l<layers;l++)mesh.setMatrixAt(l,idMat);
      mesh.instanceMatrix.needsUpdate=true;
      mesh.name="meadowTurfFurShells";mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;mesh.renderOrder=1;
      s.root.add(mesh);
      return mesh;
    }

    function meadowGrass(s){
      // 1) 6-layer 3D GPU Shell-Fur carpet covers the playable semi-wild court & ragged sidelines in plush velvety fur.
      const furShellMesh=meadowFurShells(s);

      // 2) Gracefully curved 3D parabolic grass tufts (adapted from MIT-licensed Long Wind grass.js / grass-glsl.js).
      // Pure unit-scale instance matrices + begin_vertex deformation ensure 100% accurate real-time hoop/player shadow reception!
      function buildCurvedPatchGeo(blades,segs,patchRadius,halfWidth,archMin,archRange){
        const positions=[],normals=[],bladeMeta=[],bladeShape=[],indices=[];
        for(let blade=0;blade<blades;blade++){
          const u1=((blade*0.754877666+0.19)%1)-0.5;
          const u2=((blade*0.569840291+0.63)%1)-0.5;
          // Soft organic mini-clumping inside each patch so grass grows in natural pasture tufts rather than a uniform grid.
          const clumpAng=(blade%3)*2.0944+0.4;
          const ox=u1*patchRadius*1.75+Math.cos(clumpAng)*patchRadius*0.18;
          const oz=u2*patchRadius*1.75+Math.sin(clumpAng)*patchRadius*0.18;
          // Natural 360-degree curved arch with gentle alpine wind bias (zero stiff vertical spikes!).
          const yaw=blade*2.399963+0.53;
          const dirX=0.28*0.8819+0.72*Math.sin(yaw),dirZ=0.28*0.4714+0.72*Math.cos(yaw);
          const dLen=Math.hypot(dirX,dirZ)||1,ux=dirX/dLen,uz=dirZ/dLen;
          const sideX=uz,sideZ=-ux;
          const hScale=0.58+((blade*7)%5)*0.145;
          const arch=archMin+((blade*3)%4)*(archRange/3);
          const shadeVar=((blade*11)%7)/6-0.5;
          const base=positions.length/3;
          if(segs>=3){
            // Smooth 3-segment parabolic arched blade (2+2+2+1 = 7 verts, 5 tris): upright base, graceful drooping tip!
            const rows=[[0.0,1.0],[0.36,0.82],[0.70,0.46],[1.0,0.0]];
            for(let r=0;r<rows.length;r++){
              const [t,wFrac]=rows[r];
              if(wFrac===0){
                positions.push(ox,hScale*t,oz);normals.push(0,1,0);
                bladeMeta.push(t,shadeVar);bladeShape.push(0,0,ux*arch,uz*arch);
              }else{
                for(const sd of [-1,1]){
                  positions.push(ox,hScale*t,oz);normals.push(0,1,0);
                  bladeMeta.push(t,shadeVar);bladeShape.push(sideX*halfWidth*wFrac*sd,sideZ*halfWidth*wFrac*sd,ux*arch,uz*arch);
                }
              }
            }
            indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4,base+4,base+5,base+6);
          }else if(segs===2){
            const rows=[[0.0,1.0],[0.54,0.54],[1.0,0.0]];
            for(let r=0;r<rows.length;r++){
              const [t,wFrac]=rows[r];
              if(wFrac===0){
                positions.push(ox,hScale*t,oz);normals.push(0,1,0);
                bladeMeta.push(t,shadeVar);bladeShape.push(0,0,ux*arch,uz*arch);
              }else{
                for(const sd of [-1,1]){
                  positions.push(ox,hScale*t,oz);normals.push(0,1,0);
                  bladeMeta.push(t,shadeVar);bladeShape.push(sideX*halfWidth*wFrac*sd,sideZ*halfWidth*wFrac*sd,ux*arch,uz*arch);
                }
              }
            }
            indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
          }else{
            for(const sd of [-1,1]){
              positions.push(ox,0,oz);normals.push(0,1,0);
              bladeMeta.push(0,shadeVar);bladeShape.push(sideX*halfWidth*sd,sideZ*halfWidth*sd,ux*arch,uz*arch);
            }
            positions.push(ox,hScale,oz);normals.push(0,1,0);
            bladeMeta.push(1,shadeVar);bladeShape.push(0,0,ux*arch,uz*arch);
            indices.push(base,base+1,base+2);
          }
        }
        const geo=new THREE.BufferGeometry();geo.setIndex(indices);
        geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
        geo.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
        geo.setAttribute("bladeMeta",new THREE.Float32BufferAttribute(bladeMeta,2));
        geo.setAttribute("bladeShape",new THREE.Float32BufferAttribute(bladeShape,4));
        return geo;
      }
      // MeshStandardMaterial + native begin_vertex deformation => 100% real-time shadow reception from hoop, racks & players!
      const mat=new THREE.MeshStandardMaterial({roughness:.92,metalness:0,side:THREE.DoubleSide}),time=s.meadow.time;
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.uniforms.meadowTime=time;
        shader.uniforms.meadowWind=s.meadow.wind;
        shader.uniforms.grassDetail={value:s.meadowGrassTex};
        shader.vertexShader=AIBAMeadowWeather.windGLSL+
          "attribute vec2 bladeMeta;\nattribute vec4 bladeShape;\nattribute vec4 aTerrainInfo;\nuniform float meadowTime,meadowWind;\nuniform vec4 meadowActors,meadowBall,meadowPressure;\nvarying float vBladeH,vBladeVar,vGust,vGrassHorizon;\nvarying vec3 vGrassWorld,vTerrainNormal;\n"+
          shader.vertexShader.replace("#include <beginnormal_vertex>",`
            #include <beginnormal_vertex>
            float tNy=sqrt(max(0.08,1.0-aTerrainInfo.x*aTerrainInfo.x-aTerrainInfo.y*aTerrainInfo.y));
            vTerrainNormal=normalize(vec3(aTerrainInfo.x,tNy,aTerrainInfo.y));
            vGrassHorizon=aTerrainInfo.z;
            objectNormal=vTerrainNormal;
          `).replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vBladeH=bladeMeta.x;
            vBladeVar=bladeMeta.y;
            float bladeHeight=aTerrainInfo.w;
            // instanceMatrix has unit scale (1,1,1), so rotX/rotZ are orthonormal and transformed stays in exact world meters!
            vec2 rotX=instanceMatrix[0].xz;
            vec2 rotZ=instanceMatrix[2].xz;
            vec3 patchCenter=instanceMatrix[3].xyz;
            vec2 dWorldXZ=rotX*position.x+rotZ*position.z;
            vec2 rootXZ=patchCenter.xz+dWorldXZ;
            float slopeDY=-(vTerrainNormal.x*dWorldXZ.x+vTerrainNormal.z*dWorldXZ.y)/max(0.36,vTerrainNormal.y);

            float camDistV=length(cameraPosition.xz-rootXZ);
            float distWiden=1.0+smoothstep(10.0,48.0,camDistV)*1.55;
            vec2 sideLocal=bladeShape.xy*distWiden;
            vec2 archWorld=rotX*bladeShape.z+rotZ*bladeShape.w;

            // Graceful parabolic arch (curves softly sideways toward tip instead of poking straight up like a needle!).
            float flex=vBladeH*vBladeH;
            vec3 gw=sampleMeadowWind(rootXZ,meadowTime,meadowWind);
            vGust=gw.z;
            float windScale=bladeHeight*(0.48+0.34*smoothstep(0.10,0.32,bladeHeight));
            vec2 windWorld=(MEADOW_WIND_DIR*gw.x+MEADOW_WIND_PERP*gw.y)*windScale*flex;
            vec2 archDisp=archWorld*(bladeHeight*flex);

            vec2 pushVec=vec2(0.0);
            float pushDown=0.0;
            vec2 dA=rootXZ-meadowActors.xy;float lA=length(dA);
            if(lA<.88){float wA=pow(1.0-lA/.88,1.6);pushVec+=dA/max(.04,lA)*wA*.46;pushDown=max(pushDown,wA*.55);}
            vec2 dB=rootXZ-meadowActors.zw;float lB=length(dB);
            if(lB<.88){float wB=pow(1.0-lB/.88,1.6);pushVec+=dB/max(.04,lB)*wB*.46;pushDown=max(pushDown,wB*.55);}
            vec2 dC=rootXZ-meadowBall.xy;float lC=length(dC);
            if(lC<.58){float wC=pow(1.0-lC/.58,1.6);pushVec+=dC/max(.04,lC)*wC*.38;pushDown=max(pushDown,wC*.48);}
            if(meadowPressure.w>0.0){
              vec2 deltaP=rootXZ-meadowPressure.xy;float dP=length(deltaP);
              float crestP=meadowPressure.w*(1.0-smoothstep(.55,3.8,abs(dP-meadowPressure.z)));
              pushVec+=(deltaP/max(dP,.05))*crestP*.55;pushDown=max(pushDown,crestP*.45);
            }
            vec2 totalWorldHoriz=archDisp+windWorld+pushVec*(bladeHeight*1.25*vBladeH);
            float rawH=position.y*bladeHeight*(1.0-pushDown*0.58*vBladeH);
            // Parabolic arc-length droop keeps curved grass blades supple and natural.
            float droop=min(rawH*rawH*0.52,dot(totalWorldHoriz,totalWorldHoriz)*0.42);
            float vertH=sqrt(max(0.00002,rawH*rawH-droop));
            vec2 localHoriz=vec2(dot(totalWorldHoriz,rotX),dot(totalWorldHoriz,rotZ));
            transformed=vec3(position.x+sideLocal.x+localHoriz.x,slopeDY+vertH,position.z+sideLocal.y+localHoriz.y);
            vGrassWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
          `);
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+spruceShadowGLSL+meadowPaletteGLSL+
          "uniform sampler2D grassDetail;\nvarying float vBladeH,vBladeVar,vGust,vGrassHorizon;\nvarying vec3 vGrassWorld,vTerrainNormal;\n"+
          shader.fragmentShader.replace("#include <normal_fragment_maps>",`
            #include <normal_fragment_maps>
            // Force BOTH front and back faces of DoubleSide grass blades to use the upward terrain normal (never flipped to -Y!).
            normal=normalize((viewMatrix*vec4(normalize(vTerrainNormal+vec3(0.0,0.28*vBladeH,0.0)),0.0)).xyz);
          `).replace("#include <color_fragment>",`
            #include <color_fragment>
            vec3 instVar=diffuseColor.rgb;
            vec2 m=vGrassWorld.xz;
            float camDist=length(cameraPosition.xz-m);
            float closeGrain=1.0-smoothstep(28.0,115.0,camDist);
            vec2 uvWarp=vec2(meadowNoise2D(m*0.14+vec2(3.7,-6.2))-0.5,meadowNoise2D(m*0.14+vec2(-11.4,8.9))-0.5)*2.6;
            vec2 mOrg=m+uvWarp;
            mat2 rotA=mat2(0.866,-0.500,0.500,0.866);
            mat2 rotB=mat2(0.588,0.809,-0.809,0.588);
            vec3 bladesTex=sRGBToLinear(texture2D(grassDetail,(rotA*mOrg)*0.48+vec2(0.19,0.43))).rgb;
            vec3 patches=sRGBToLinear(texture2D(grassDetail,mOrg*0.088+vec2(0.26,0.31))).rgb;
            vec3 macroTex=sRGBToLinear(texture2D(grassDetail,(rotB*m)*0.024+vec2(0.61,0.17))).rgb;
            float fine=dot(bladesTex,vec3(0.22,0.70,0.08));
            float coarse=dot(patches,vec3(0.22,0.70,0.08));
            float macro=dot(macroTex,vec3(0.22,0.70,0.08));
            float organicTussock=meadowFbm(m*0.34+vec2(-4.7,9.3));
            float tussockHeight=coarse*0.44+fine*0.30+organicTussock*0.26;
            float tussockAO=mix(0.78,1.18,smoothstep(0.10,0.34,tussockHeight));
            float bladeDetail=(0.82+coarse*1.48+(fine-.13)*(1.05+0.48*closeGrain)+(organicTussock-.48)*0.18)*tussockAO;

            vec2 spData=sampleSpruceForest(vGrassWorld,meadowSun);
            float worn=0.0;
            vec3 baseEst=meadowBaseTint(m)*bladeDetail*mix(1.22,1.0,meadowSky.x);
            vec3 groundCol=meadowGroundAlbedo(m,baseEst,coarse,macro,0.14,spData,worn);

            vec3 viewDir=normalize(cameraPosition-vGrassWorld);
            float velvet=pow(1.0-max(0.0,dot(viewDir,vTerrainNormal)),2.0)*(.44+.48*organicTussock)*(1.0-worn*.78)*(1.0-spData.y*.7);
            groundCol+=vec3(.076,.104,.039)*velvet;

            // Soft root-to-tip pasture harmony: roots melt seamlessly into the Shell-Fur undercoat, curved tips warm gently in sunlight!
            vec3 perBladeTint=mix(vec3(0.94,0.98,0.92),vec3(1.10,1.07,0.88),vBladeVar+0.5);
            vec3 tipTint=mix(vec3(1.06,1.10,0.92),vec3(1.22,1.18,0.86),clamp(organicTussock*0.85+coarse*1.4,0.0,1.0))*perBladeTint;
            vec3 bladeCol=mix(groundCol*0.88,groundCol*tipTint*mix(vec3(1.0),instVar,0.28),smoothstep(0.06,0.90,vBladeH));
            bladeCol+=groundCol*(vGust*0.13*vBladeH*meadowSky.x);

            float horizonSun=smoothstep(vGrassHorizon-.055,vGrassHorizon+.085,meadowSun.y/max(.1,length(meadowSun.xz)));
            float facing=dot(vTerrainNormal,meadowSun);
            float farBlend=smoothstep(28.0,64.0,camDist);
            diffuseColor.rgb=meadowSharedLight(mix(bladeCol,groundCol,farBlend),vGrassWorld,camDist,facing,horizonSun,spData)*(1.0-meadowSky.w*.18);
          `).replace("#include <dithering_fragment>",`
            vec3 gView=normalize(cameraPosition-vGrassWorld);
            float farFade=1.0-smoothstep(26.0,64.0,length(cameraPosition.xz-vGrassWorld.xz))*0.75;
            float spSh2=spruceCanopyShadow(vGrassWorld,meadowSun);
            float sss=pow(clamp(dot(-gView,meadowSun),0.0,1.0),2.4)*pow(vBladeH,1.2)*(.28+.72*meadowSky.x)*(1.0-spSh2*.82)*farFade;
            vec3 sssCol=mix(vec3(.70,.86,.30),vec3(1.0,.78,.35),meadowSky.y);
            gl_FragColor.rgb+=sssCol*sss*.34;
            #include <dithering_fragment>
          `);
      };
      const dummy=new THREE.Object3D(),color=new THREE.Color(),nTmp=new THREE.Vector3();
      const tintSwatches=[0xf6f8ee,0xf2f6e6,0xfaf6e2,0xeef3e6,0xf7f2dc,0xf0f5e8];
      const camPads=[
        [-8.27,-5.88,.82],[-9.96,-5.44,.85],[-8.64,-1.35,.78],
        [-6.40,-1.60,.82],[-7.64,-0.36,.85],[-8.67,1.42,.78],
        [0.00,1.05,.82],[0.00,2.80,.85],[-4.95,1.26,.78],
        [6.40,-1.60,.82],[7.64,-0.36,.85],[-1.94,-0.48,.78],
        [8.27,-5.88,.82],[9.96,-5.44,.85],[-1.58,-1.89,.78]
      ];
      if(typeof RACKS!=="undefined"&&typeof HOOP!=="undefined"){
        for(const rk of RACKS){
          const dx=rk.p.x-HOOP.x,dz=rk.p.z-HOOP.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
          for(const d of [2.4,2.95,3.55,4.3])camPads.push([rk.p.x+ux*d,rk.p.z+uz*d,.78]);
        }
      }
      const orbit=s.menuOrbit||[18,20,8,2.2];
      for(let oi=0;oi<24;oi++){
        const oa=oi/24*tau;
        camPads.push([Math.cos(oa)*orbit[0],COURT.midZ+Math.sin(oa)*orbit[1],.78]);
      }
      const makeTerrainAttr=count=>new THREE.InstancedBufferAttribute(new Float32Array(count*4),4);
      const setPatch=(mesh,tAttr,i,x,z,h)=>{
        for(let pass=0;pass<2;pass++){
          for(const [px,pz,rad] of camPads){
            const ddx=x-px,ddz=z-pz,dd=Math.hypot(ddx,ddz);
            if(dd<rad){
              const ux=dd>.001?ddx/dd:Math.cos(i*2.399),uz=dd>.001?ddz/dd:Math.sin(i*2.399);
              x=px+ux*(rad+.16);z=pz+uz*(rad+.16);
            }
          }
        }
        const y=elevation(x,z);
        terrainNormalAt(x,z,nTmp);
        const hor=terrainHorizonAt(x,z,y);
        tAttr.setXYZW(i,nTmp.x,nTmp.z,hor,h);
        dummy.position.set(x,y-.006,z);dummy.rotation.y=s.r()*tau;
        // Pure unit scale (1,1,1): preserves orthonormal instanceMatrix so begin_vertex & shadowmap_vertex match 1:1!
        dummy.scale.set(1,1,1);dummy.updateMatrix();
        mesh.setMatrixAt(i,dummy.matrix);
        mesh.setColorAt(i,color.set(tintSwatches[i%tintSwatches.length]).convertSRGBToLinear().multiplyScalar(.92+.16*s.r()));
      };

      // Tier 0: Gracefully curved 3-seg pasture clumps around the ragged court border + subtle low semi-wild tufts in less-trodden court pockets.
      const nearCount=s.mobile?2800:4400;
      const nearGeo=buildCurvedPatchGeo(s.mobile?9:12,s.mobile?2:3,0.42,0.0115,0.52,0.28);
      const nearTerrain=makeTerrainAttr(nearCount);
      nearGeo.setAttribute("aTerrainInfo",nearTerrain);
      const nearMesh=new THREE.InstancedMesh(nearGeo,mat,nearCount);
      for(let i=0;i<nearCount;i++){
        let x,z,h;
        const slot=i%10;
        if(slot<2){
          // Subtle low, gracefully curved semi-wild tufts in less-trodden court margins/midcourt (keeping the mown paint playable & clean!).
          for(let tries=0;tries<4;tries++){
            x=(s.r()-.5)*14.8;
            z=COURT.nearBaseline+0.4+s.r()*(COURT.farBaseline-COURT.nearBaseline-0.8);
            const inKey=Math.abs(x)<3.1&&(z<-2.6||z>12.2);
            if(!inKey&&turfWearAt(x,z)<0.32)break;
          }
          h=THREE.MathUtils.clamp(turfHeightAt(x,z)*(0.52+s.r()*0.38),0.045,0.105);
        }else if(slot<8){
          // Ragged hand-scythed court border & lush billowing sidelines (curved meadow fescue emerging out of the Shell-Fur undercoat)
          if(i%3===0){
            const side=i%2?1:-1;
            x=side*(6.75+Math.pow(s.r(),1.22)*9.8);
            z=COURT.nearBaseline-4.5+s.r()*(COURT.farBaseline-COURT.nearBaseline+9.5);
          }else{
            x=(s.r()-.5)*30.0;
            z=s.r()<.62?(COURT.nearBaseline-7.2+s.r()*6.9):(COURT.farBaseline-.2+s.r()*8.0);
          }
          h=turfHeightAt(x,z)*(0.80+s.r()*0.46);
        }else{
          const a=(s.r()-.5)*2.6,r=13.5+s.r()*9.5;
          x=Math.sin(a)*r;z=COURT.midZ-Math.cos(a)*r;
          h=turfHeightAt(x,z)*(0.84+s.r()*0.46);
        }
        setPatch(nearMesh,nearTerrain,i,x,z,h);
      }
      nearMesh.name="alpineSwayingGrass";nearMesh.receiveShadow=true;nearMesh.frustumCulled=false;s.root.add(nearMesh);

      // Tier 1: Mid-slope undulating curved meadow clumps biased toward the shooting camera hemisphere.
      const midCount=s.mobile?1800:3800;
      const midGeo=buildCurvedPatchGeo(10,2,0.52,0.015,0.46,0.26);
      const midTerrain=makeTerrainAttr(midCount);
      midGeo.setAttribute("aTerrainInfo",midTerrain);
      const midMesh=new THREE.InstancedMesh(midGeo,mat,midCount);
      for(let i=0;i<midCount;i++){
        const forward=i%10<8;
        const a=forward?(s.r()-.5)*4.3:(Math.PI+(s.r()-.5)*2.0);
        const r=12.0+27*Math.pow(s.r(),1.12);
        let x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        if(Math.abs(x)<7.2&&z>COURT.nearBaseline-.5&&z<COURT.farBaseline+.5)x=Math.sign(x||1)*(7.5+s.r()*6.5);
        const h=turfHeightAt(x,z)*(0.84+s.r()*0.46);
        setPatch(midMesh,midTerrain,i,x,z,h);
      }
      midMesh.name="alpineMidGrass";midMesh.frustumCulled=false;s.root.add(midMesh);

      // Tier 2: Far hillside soft grass tufts breaking up ridge silhouettes and melting seamlessly into ground.
      const farCount=s.mobile?1200:2600;
      const farGeo=buildCurvedPatchGeo(6,1,0.62,0.022,0.42,0.22);
      const farTerrain=makeTerrainAttr(farCount);
      farGeo.setAttribute("aTerrainInfo",farTerrain);
      const farMesh=new THREE.InstancedMesh(farGeo,mat,farCount);
      for(let i=0;i<farCount;i++){
        const forward=i%10<8;
        const a=forward?(s.r()-.5)*4.2:(Math.PI+(s.r()-.5)*2.1);
        const r=32+34*Math.pow(s.r(),1.06);
        const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        const h=turfHeightAt(x,z)*(0.86+s.r()*0.48)*(.58+.42*smooth(r,66,44));
        setPatch(farMesh,farTerrain,i,x,z,h);
      }
      farMesh.name="alpineFarGrass";farMesh.frustumCulled=false;s.root.add(farMesh);
      s.meadowLayersRefs=s.meadowLayersRefs||{grass:[],trees:[]};
      s.meadowLayersRefs.grass.push(furShellMesh,nearMesh,midMesh,farMesh);
      s.meadowWind=time;
    }

    function meadowRocks(s,rockTex){
      const geo=new THREE.IcosahedronGeometry(1,1);
      const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){
        const vx=pos.getX(i),vy=pos.getY(i),vz=pos.getZ(i);
        const n=.76+.24*Math.sin(vx*3.7+vz*2.9)+.14*Math.cos(vy*4.3-vx*2.1);
        pos.setXYZ(i,vx*n,vy*(vy<0?.42:.78)*n,vz*n);
      }
      geo.computeVertexNormals();
      const mat=new THREE.MeshStandardMaterial({map:rockTex,roughness:.90,metalness:.02});
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.vertexShader="varying vec3 vBoulderNormal,vBoulderWorld;\nvarying float vBoulderBaseH;\n"+shader.vertexShader.replace("#include <begin_vertex>",`
          #include <begin_vertex>
          vBoulderNormal=normalize(mat3(instanceMatrix)*normal);
          vBoulderBaseH=clamp((position.y+0.42)/1.20,0.0,1.0);
          vBoulderWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
        `);
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+spruceShadowGLSL+meadowPaletteGLSL+
          "varying vec3 vBoulderNormal,vBoulderWorld;\nvarying float vBoulderBaseH;\n"+
          shader.fragmentShader.replace("#include <color_fragment>",`
            #include <color_fragment>
            // Weathered warm-grey Tian Shan granite with alpine sky-fill on shaded faces, lichen top & turf-blended root skirt.
            float bSunFace=dot(vBoulderNormal,meadowSun);
            vec3 skyFill=vec3(0.085,0.105,0.120)*(1.0-clamp(bSunFace,0.0,1.0));
            vec3 granite=diffuseColor.rgb*vec3(1.52,1.48,1.38)+vec3(0.048,0.046,0.040)+skyFill;
            vec3 turfMatch=meadowBaseTint(vBoulderWorld.xz)*1.24;
            float moss=smoothstep(.38,.80,vBoulderNormal.y);
            vec3 lichenCol=mix(vec3(.28,.38,.17),turfMatch*vec3(1.10,1.12,0.88),.55);
            vec3 rockBody=mix(granite,lichenCol,moss*.64);
            float rootSkirt=1.0-smoothstep(0.0,.30,vBoulderBaseH);
            rockBody=mix(rockBody,turfMatch*.80,rootSkirt*.74);
            vec2 bSp=sampleSpruceForest(vBoulderWorld,meadowSun);
            float bDist=length(cameraPosition.xz-vBoulderWorld.xz);
            diffuseColor.rgb=meadowSharedLight(rockBody,vBoulderWorld,bDist,max(-0.08,bSunFace),1.0,bSp)*(1.0-meadowSky.w*.22);
          `).replace("#include <roughnessmap_fragment>",`
            #include <roughnessmap_fragment>
            roughnessFactor=mix(.92,.48,meadowSky.w);
          `);
      };
      const count=s.mobile?20:38;
      const mesh=new THREE.InstancedMesh(geo,mat,count);
      const dummy=new THREE.Object3D(),tone=new THREE.Color();
      const anchors=[
        [-11.8,-10.5,1.25],[12.4,-9.8,1.05],[-13.5,2.5,1.45],[14.2,6.2,1.15],
        [-12.8,17.8,1.35],[13.0,19.4,1.20],[-18.5,-15.0,2.1],[19.5,-14.0,1.85],
        [-21.0,9.5,2.3],[22.5,14.5,1.95],[0.5,-16.5,1.4],[-6.5,25.5,1.65]
      ];
      for(let i=0;i<count;i++){
        let x,z,sc;
        if(i<anchors.length){
          [x,z,sc]=anchors[i];
        }else{
          const a=s.r()*tau,r=14.5+38*Math.pow(s.r(),1.2);
          x=Math.sin(a)*r;z=COURT.midZ-Math.cos(a)*r;
          if(Math.abs(x)<10.2&&z>-12&&z<22)x=Math.sign(x||1)*11.2;
          sc=.45+s.r()*1.55;
        }
        dummy.position.set(x,elevation(x,z)+sc*.12,z);
        dummy.rotation.set((s.r()-.5)*.28,s.r()*tau,(s.r()-.5)*.28);
        dummy.scale.set(sc*(.9+s.r()*.5),sc*(.48+s.r()*.36),sc*(.85+s.r()*.45));
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        tone.setScalar(.88+.24*s.r());mesh.setColorAt(i,tone);
      }
      mesh.castShadow=!s.mobile;mesh.receiveShadow=true;mesh.name="alpineMossyBoulders";mesh.frustumCulled=false;s.root.add(mesh);
    }

    function meadowShrubs(s){
      const p=[],nrm=[],c=[],hAttr=[];
      const low=linear(0x2f4d28),high=linear(0x6f8b45),col=new THREE.Color();
      const lobes=[[0,.34,0,.44],[-.26,.25,.14,.32],[.25,.28,-.12,.34],[.06,.48,.16,.28],[-.15,.44,-.18,.27],[.20,.18,.22,.24]];
      const unit=new THREE.IcosahedronGeometry(1,0);
      const uPos=unit.attributes.position;
      for(const [lx,ly,lz,lr] of lobes){
        for(let i=0;i<uPos.count;i++){
          const vx=uPos.getX(i),vy=uPos.getY(i),vz=uPos.getZ(i);
          const jag=.82+.24*Math.sin(vx*5.2+vz*4.1+ly*9);
          const x=lx+vx*lr*jag,y=Math.max(0,ly+vy*lr*.85*jag),z=lz+vz*lr*jag;
          p.push(x,y,z);
          const rx=x-lx*.35,ry=y+.22,rz=z-lz*.35,rl=Math.hypot(rx,ry,rz)||1;
          nrm.push(rx/rl,ry/rl,rz/rl);
          const h=THREE.MathUtils.clamp(y/.78,0,1);
          hAttr.push(h);
          col.copy(low).lerp(high,h*(.72+.28*(vy*.5+.5)));
          c.push(col.r,col.g,col.b);
        }
      }
      unit.dispose();
      const geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
      geo.setAttribute("normal",new THREE.Float32BufferAttribute(nrm,3));
      geo.setAttribute("color",new THREE.Float32BufferAttribute(c,3));
      geo.setAttribute("shrubH",new THREE.Float32BufferAttribute(hAttr,1));
      const mat=new THREE.MeshLambertMaterial({vertexColors:true});
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.uniforms.meadowTime=s.meadow.time;
        shader.uniforms.meadowWind=s.meadow.wind;
        shader.vertexShader=AIBAMeadowWeather.windGLSL+"attribute float shrubH;\nuniform float meadowTime,meadowWind;\nvarying float vShrubH;\nvarying vec3 vShrubWorld;\n"+
          shader.vertexShader.replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vShrubH=shrubH;
            vec2 root=instanceMatrix[3].xz;
            vec3 sw=sampleMeadowWind(root,meadowTime-0.18,meadowWind);
            vec2 sLocal=meadowLocalWind(instanceMatrix,(MEADOW_WIND_DIR*sw.x+MEADOW_WIND_PERP*sw.y)*0.48);
            transformed.xz+=sLocal*(shrubH*shrubH);
            vShrubWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
          `);
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+spruceShadowGLSL+meadowPaletteGLSL+
          "varying float vShrubH;\nvarying vec3 vShrubWorld;\n"+
          shader.fragmentShader.replace("#include <color_fragment>",`
            #include <color_fragment>
            vec3 sTurf=meadowBaseTint(vShrubWorld.xz);
            diffuseColor.rgb=mix(sTurf*.85,diffuseColor.rgb,smoothstep(0.0,.35,vShrubH));
            float sCloud=.68+.34*sunWindow(vShrubWorld,1.0);
            float sSp=spruceCanopyShadow(vShrubWorld,meadowSun);
            vec3 sShade=mix(vec3(1.0),vec3(.46,.60,.72),sSp*(.52+.48*meadowSky.x));
            diffuseColor.rgb*=sCloud*sShade*(1.0-meadowSky.w*.18);
          `).replace("#include <dithering_fragment>",`
            vec3 sv=normalize(cameraPosition-vShrubWorld);
            float sSp2=spruceCanopyShadow(vShrubWorld,meadowSun);
            float back=pow(clamp(dot(-sv,meadowSun),0.0,1.0),3.2)*vShrubH*meadowSky.x*(1.0-sSp2*.80);
            vec3 glow=mix(vec3(.42,.56,.20),vec3(.92,.62,.28),meadowSky.y);
            gl_FragColor.rgb+=glow*back*.28;
            #include <dithering_fragment>
          `);
      };
      const count=s.mobile?42:86;
      const mesh=new THREE.InstancedMesh(geo,mat,count);
      const dummy=new THREE.Object3D(),tone=new THREE.Color();
      for(let i=0;i<count;i++){
        const a=s.r()*tau,r=14+52*Math.pow(s.r(),1.25);
        let x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        if(Math.abs(x)<10.6&&z>-12.5&&z<22.5)x=Math.sign(x||1)*(11.4+s.r()*4);
        const sc=.78+s.r()*1.25;
        dummy.position.set(x,elevation(x,z)-.06,z);dummy.rotation.y=s.r()*tau;
        dummy.scale.set(sc*(.95+s.r()*.4),sc*(.72+s.r()*.45),sc*(.95+s.r()*.4));
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        tone.setScalar(.72+.36*s.r());mesh.setColorAt(i,tone);
      }
      mesh.name="alpineShrubs";mesh.frustumCulled=false;s.root.add(mesh);
      s.meadowLayersRefs=s.meadowLayersRefs||{grass:[],trees:[]};
      s.meadowLayersRefs.trees.push(mesh);
    }

    function driftCoverage(instances){
      const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=1024;
      const paint=canvas.getContext("2d"),brushes=new Map(),density=canvas.width/232;
      for(const item of instances){
        let brush=brushes.get(item.tint);
        if(!brush){
          brush=document.createElement("canvas");brush.width=24;brush.height=24;
          const g=brush.getContext("2d"),gradient=g.createRadialGradient(12,12,1,12,12,12);
          const tint=new THREE.Color(item.tint),[r,gc,b]=tint.toArray().map(x=>Math.round(x*255));
          gradient.addColorStop(0,`rgba(${r},${gc},${b},.17)`);
          gradient.addColorStop(.35,`rgba(${r},${gc},${b},.095)`);
          gradient.addColorStop(1,`rgba(${r},${gc},${b},0)`);
          g.fillStyle=gradient;g.fillRect(0,0,24,24);brushes.set(item.tint,brush);
        }
        const u=(item.x+116)*density,v=(item.z-COURT.midZ+116)*density;
        const spread=(.92+item.size*.61)*density;
        paint.drawImage(brush,u-spread,v-spread*.64,spread*2,spread*1.28);
      }
      const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
      return map;
    }

    const meadowPlants=[
      {name:"daisies",tints:[0xf4ead0,0xf9f5df,0xe3e7d5],petals:[0xfff9e2,0xf2eee2,0xffffff]},
      {name:"dandelions",tints:[0xf4c433,0xe9ad24,0xffd958],petals:[0xffc126,0xffdd56,0xffd533]},
      {name:"lavender",tints:[0xa48cc9,0x967db8,0xb6a0d0],petals:[0xad8bd2,0x9980c9,0xbb9cde]},
      {name:"mixed",tints:[0xda8585,0xb980b4,0xc9b877],petals:[0xe99559,0xa29cdd,0xf6a3af]}
    ];

    function driftGeometry(plant,mobile){
      const verts=[],colors=[],stem=linear(0x748e48),leafDark=linear(0x688340),heart=linear(0xeab74a);
      const petals=plant.petals.map(linear);
      const tri=(a,b,c,color)=>{
        verts.push(...a,...b,...c);
        for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
      };
      // Low, turf-matched basal leaves anchor each wildflower clump without creating dark triangular specks.
      for(let l=0;l<3;l++){
        const a=l*tau/3+.4,dx=Math.cos(a),dz=Math.sin(a),px=-dz*.042,pz=dx*.042;
        tri([px,0,pz],[-px,0,-pz],[dx*.15,.085,dz*.15],leafDark);
      }
      const spire=plant.name==="lavender";
      // Lower, compact flower heads nestled inside the lush grass cushions (never towering above the grass!).
      const heads=[[-.165,-.10,.175,.112],[.15,.11,.235,.098],[.045,-.165,.285,.096]];
      for(const [i,[x,z,height,r]] of heads.entries()){
        const h=height*(spire?1.18:1),tip=[x,h,z];
        tri([x*.42,0,z*.47],tip,[x+.016,h,z],stem);
        if(spire){
          // Smaller, interrupted florets keep a lavender silhouette up close.
          for(const [dx,dz] of [[1,0],[0,1]]){
            for(let j=0;j<3;j++){
              const y=h*(.72+j*.14),width=r*(.72-j*.17);
              tri([x-dx*width,y,z-dz*width],[x+dx*width,y+h*.042,z+dz*width],
                [x+dx*width*.24,y+h*.185,z+dz*width*.24],petals[(i+j)%3]);
            }
          }
        }else{
          const steps=mobile?4:6,point=(arc,scale,y)=>[x+Math.sin(arc)*r*scale,h+y,z+Math.cos(arc)*r*scale];
          for(let k=0;k<steps;k++){
            const arc=k*tau/steps+i*.34;
            tri(tip,point(arc-.6,.92,.019),point(arc+.42,1.12,.043),petals[(i+k)%3]);
          }
          tri([x-.029,h+.012,z-.03],[x+.028,h+.016,z-.028],[x,h+.028,z+.032],heart);
        }
        if(plant.name==="mixed")tri([x*.42,0,z*.42],[x-.095,h*.52,z+.095],[x-.030,h*.38,z],stem);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
      return geo;
    }

    function dandelionSeeds(s,weather,dandelions,bloom){
      const p=[],phase=[],starts=[],close=dandelions.filter(d=>d.near);
      const total=s.mobile?280:680;
      for(let i=0;i<total;i++){
        // 50% 分布在球场与近景草坡，50% 从远近蒲公英花丛随风升腾（既有零散漫飞，也有批量大风刮起的气浪！）
        const inNear=i%2===0&&close.length;
        if(inNear&&i%4===0){
          const sx=(s.r()-.5)*21,sz=COURT.midZ+(s.r()-.5)*26;
          p.push(sx,elevation(sx,sz)+.20+s.r()*.68,sz);
          phase.push(s.r(),.82+1.22*s.r());starts.push(s.r()*.16);
        }else{
          const d=inNear?close[(i*23)%close.length]:dandelions[(i*97)%dandelions.length];
          p.push(d.x,elevation(d.x,d.z)+d.size*.37,d.z);
          phase.push(s.r(),.78+1.25*s.r());starts.push(d.when*.42);
        }
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
      geo.setAttribute("travel",new THREE.Float32BufferAttribute(phase,2));
      geo.setAttribute("emerges",new THREE.Float32BufferAttribute(starts,1));
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
        uniforms:{clock:weather.time,wind:weather.wind,bloom},
        vertexShader:AIBAMeadowWeather.windGLSL+`
          attribute vec2 travel;attribute float emerges;
          varying float alpha;
          uniform float clock,wind,bloom;
          void main(){
            vec3 sw=sampleMeadowWind(position.xz,clock,wind);
            float gustEnv=sw.z;
            float isGustBatch=step(0.42,fract(travel.x*7.3));
            float life=fract(travel.x+clock*(.022+.012*travel.y));
            float az=travel.x*62.8318+travel.y*19.0;
            vec2 dir=vec2(cos(az),sin(az));
            vec2 perp=vec2(-dir.y,dir.x);
            float driftDist=life*(2.8+1.8*travel.y);
            float swirl=sin(life*6.283+travel.x*41.0)*(.36+.24*travel.y);
            vec2 gustSweep=(MEADOW_WIND_DIR*(5.5+4.2*travel.y)*gustEnv+MEADOW_WIND_PERP*(sw.y*3.2))*life*isGustBatch;
            float gustLift=life*(1.45*gustEnv*isGustBatch);
            vec2 horiz=dir*driftDist+perp*swirl+gustSweep;
            vec3 p=position+vec3(horiz.x,.16+life*travel.y*2.8+gustLift+.24*sin(life*9.4+travel.x*27.0),horiz.y);
            vec4 mv=modelViewMatrix*vec4(p,1.0);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp(134.0*travel.y/max(7.0,-mv.z),1.9,10.2);
            float emergeFade=.36+.64*smoothstep(emerges,emerges+.22,bloom);
            float gustBoost=mix(1.0,1.25,gustEnv*isGustBatch);
            alpha=clamp(smoothstep(.0,.14,life)*(1.0-smoothstep(.72,1.0,life))*emergeFade*gustBoost,0.0,1.0);
          }
        `,
        fragmentShader:`
          varying float alpha;
          void main(){
            vec2 p=gl_PointCoord*2.0-1.0;
            float r=length(p);
            float puff=1.0-smoothstep(.12,.88,r);
            float crown=exp(-pow(length(p-vec2(0.0,.24))*2.3,2.0));
            float stem=1.0-smoothstep(.04,.17,abs(p.x+.12*p.y));
            float plume=clamp(.48*puff+.42*crown+.26*stem*smoothstep(-.78,.28,p.y)*(1.0-smoothstep(.68,1.0,p.y)),0.0,1.0);
            gl_FragColor=vec4(.99,.975,.90,plume*alpha*.90);
          }
        `});
      const seeds=new THREE.Points(geo,mat);
      seeds.name="alpineDandelionSeeds";seeds.frustumCulled=false;seeds.visible=false;seeds.renderOrder=2;s.root.add(seeds);
      return seeds;
    }

    function distantFlowers(s,weather){
      const gardens=[[-1.22,31,14,0],[-.78,47,18,0],[-.62,74,20,0],[-.91,99,17,0],
        [-.19,44,14,1],[-.28,69,15,1],[.83,56,22,1],[1.58,55,22,1],[-2.11,42,18,1],
        [.31,34,12,2],[.39,66,17,2],[.77,83,21,2],[1.19,97,18,2],[2.73,81,24,2],
        [-1.65,49,19,3],[-.13,94,21,3],[.18,100,18,3],[2.06,46,22,3],[-2.53,87,22,3],[2.78,46,23,3]];
      const all=[],collections=meadowPlants.map(()=>[]);
      const total=s.mobile?13950:26950;
      const add=(kind,x,z,size,when,near=false)=>{
        const tints=meadowPlants[kind].tints;
        const item={x,z,size,near,when,tint:tints[Math.floor(s.r()*tints.length)],yaw:s.r()*tau};
        collections[kind].push(item);
        if(!near)all.push(item);
      };
      for(let i=0;i<total;i++){
        const [heading,rad,width,main]=gardens[i%gardens.length];
        const oval=(s.r()+s.r()-1)*width,r=rad+oval,a=heading+(s.r()+s.r()-1)*width/r;
        const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        if(Math.abs(x)<14.2&&z>COURT.floorMinZ-4&&z<COURT.floorMaxZ+4)continue;
        const kind=s.r()<.94?main:Math.floor(s.r()*meadowPlants.length);
        add(kind,x,z,(.49+.63*s.r())*(1+smooth(r,29,86)*.64),THREE.MathUtils.clamp(.07+(r-16)/121+s.r()*.18,.07,.84));
      }
      const nearCount=s.mobile?420:880;
      for(let i=0;i<nearCount;i++){
        const side=i%2?1:-1;
        // Keep drift clumps nestled inside the lush outer meadow grass (never isolated dark triangles on the court!).
        const x=side*(7.4+s.r()*7.4),z=COURT.nearBaseline-5+s.r()*(COURT.farBaseline-COURT.nearBaseline+11);
        const gh=turfHeightAt(x,z);
        add(i%meadowPlants.length,x,z,gh*(1.35+s.r()*0.85),.085+s.r()*.75,true);
      }
      const bloom={value:0},mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,emissive:0xdcd2a4,emissiveIntensity:.042});
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,weather.uniforms);
        shader.uniforms.meadowTime=weather.time;shader.uniforms.meadowBloom=bloom;shader.uniforms.meadowWind=weather.wind;
        shader.vertexShader=AIBAMeadowWeather.windGLSL+"uniform float meadowTime,meadowBloom,meadowWind;\nuniform vec4 meadowActors,meadowBall,meadowPressure;\nattribute float bloomStart;\nvarying float vPetalH;\nvarying vec3 vPetalWorld;\n"+
          shader.vertexShader.replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vPetalH=clamp(position.y*3.0,0.0,1.0);
            vec2 root=instanceMatrix[3].xz;
            vec3 dw=sampleMeadowWind(root,meadowTime,meadowWind);
            vec2 dLocal=meadowLocalWind(instanceMatrix,(MEADOW_WIND_DIR*dw.x+MEADOW_WIND_PERP*dw.y)*0.85);
            transformed.xz+=dLocal*(position.y*position.y);
            transformed.y-=length(dLocal)*0.12*(position.y*position.y);
            vec2 dA=root-meadowActors.xy;float lA=length(dA);
            if(lA<.85){float wA=pow(1.0-lA/.85,1.5);transformed.xz+=meadowLocalWind(instanceMatrix,dA/max(.04,lA))*wA*.38*vPetalH;transformed.y*=1.0-wA*.40*vPetalH;}
            vec2 dB=root-meadowActors.zw;float lB=length(dB);
            if(lB<.85){float wB=pow(1.0-lB/.85,1.5);transformed.xz+=meadowLocalWind(instanceMatrix,dB/max(.04,lB))*wB*.38*vPetalH;transformed.y*=1.0-wB*.40*vPetalH;}
            vec2 dC=root-meadowBall.xy;float lC=length(dC);
            if(lC<.55){float wC=pow(1.0-lC/.55,1.5);transformed.xz+=meadowLocalWind(instanceMatrix,dC/max(.04,lC))*wC*.32*vPetalH;transformed.y*=1.0-wC*.35*vPetalH;}
            ${pressureBend("vPetalH")}
            transformed*=max(.001,smoothstep(bloomStart,bloomStart+.145,meadowBloom));
            vPetalWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
          `);
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+spruceShadowGLSL+meadowPaletteGLSL+"varying float vPetalH;\nvarying vec3 vPetalWorld;\n"+
          shader.fragmentShader.replace("#include <color_fragment>",`
            #include <color_fragment>
            // Blend lower stems/leaves into the pasture base tint so flower clumps emerge softly from the furry grass.
            vec3 turfMatch=meadowBaseTint(vPetalWorld.xz)*1.22;
            diffuseColor.rgb=mix(turfMatch,diffuseColor.rgb,smoothstep(0.0,.48,vPetalH));
            float baseAO=mix(.84,1.10,smoothstep(0.0,.65,vPetalH));
            float cloudLit=.70+.32*sunWindow(vPetalWorld,1.0);
            float spSh=spruceCanopyShadow(vPetalWorld,meadowSun);
            vec3 shCol=mix(vec3(1.0),vec3(.50,.64,.74),spSh*(.45+.55*meadowSky.x));
            diffuseColor.rgb*=baseAO*cloudLit*shCol*(1.0-meadowSky.w*.18);
          `).replace("#include <dithering_fragment>",`
            vec3 pView=normalize(cameraPosition-vPetalWorld);
            float spSh2=spruceCanopyShadow(vPetalWorld,meadowSun);
            float pBack=pow(clamp(dot(-pView,meadowSun),0.0,1.0),2.6)*vPetalH*(.25+.75*meadowSky.x)*(1.0-spSh2*.75);
            vec3 pGlow=mix(vec3(1.0,.96,.82),vec3(1.0,.74,.40),meadowSky.y);
            gl_FragColor.rgb+=diffuseColor.rgb*pGlow*pBack*.55;
            #include <dithering_fragment>
          `);
      };
      const dummy=new THREE.Object3D(),point=new THREE.Vector3(),beds=[];
      const sectorCount=8;
      collections.forEach((plants,i)=>{
        const plant=meadowPlants[i],sectors=Array.from({length:sectorCount},()=>[]);
        for(const d of plants){
          const angle=Math.atan2(d.x,COURT.midZ-d.z);
          const sector=Math.floor((angle+Math.PI)/tau*sectorCount)%sectorCount;
          sectors[sector].push(d);
        }
        for(const items of sectors){
          if(!items.length)continue;
          items.sort((a,b)=>a.when-b.when);
          const geo=driftGeometry(plant,s.mobile),bounds=new THREE.Box3();
          const mesh=new THREE.InstancedMesh(geo,mat,items.length),targets=[];
          for(const [index,d] of items.entries()){
            dummy.position.set(d.x,elevation(d.x,d.z)-.005,d.z);dummy.rotation.y=d.yaw;
            dummy.scale.set(d.size,d.size,d.size);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
            bounds.expandByPoint(point.set(d.x-d.size,dummy.position.y,d.z-d.size));
            bounds.expandByPoint(point.set(d.x+d.size,dummy.position.y+d.size,d.z+d.size));
            targets.push(d.when);
          }
          // r128 tests this shared local bounding sphere. It has to enclose the sector's instance transforms.
          geo.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());geo.boundingSphere.radius+=1;
          geo.setAttribute("bloomStart",new THREE.InstancedBufferAttribute(new Float32Array(targets),1));
          mesh.name="alpineFlowers:"+plant.name;mesh.frustumCulled=true;mesh.count=0;s.root.add(mesh);
          beds.push({mesh,targets});
        }
      });
      return {beds,bloom,count:0,coverage:driftCoverage(all),
        seeds:dandelionSeeds(s,weather,collections[1].filter(d=>!d.near||Math.abs(d.x)>8),bloom)};
    }

    function parseMeadowLayers(){
      const cfg={base:true,grass:true,trees:true,flowers:true,shadows:true,fx:true};
      try{
        const q=new URLSearchParams(location.search).get("meadowLayers");
        if(q!==null&&q!==""){
          const set=new Set(q.split(",").map(v=>v.trim()).filter(Boolean));
          for(const k of Object.keys(cfg))cfg[k]=set.has(k);
        }
      }catch(e){}
      return cfg;
    }

    function applyMeadowLayers(s){
      if(!s||!s.meadow)return;
      const L=s.meadowLayers||(s.meadowLayers=parseMeadowLayers());
      const baseNames=["alpineMeadowGround","alpineNearRidges","alpineFarSnowPeaks","alpineGoldenMassif","alpineSummitBanner","alpineCloudSky","alpineMossyBoulders","meadowParallaxFence"];
      for(const n of baseNames){
        const o=s.root.getObjectByName(n);
        if(o)o.visible=!!L.base;
      }
      if(s.meadowLayersRefs){
        for(const g of s.meadowLayersRefs.grass)g.visible=!!L.grass;
        for(const t of s.meadowLayersRefs.trees)t.visible=!!L.trees;
        if(s.meadowLayersRefs.heroTree)s.meadowLayersRefs.heroTree.castShadow=!!(L.trees&&L.shadows&&!s.mobile);
      }
      if(s.meadow.drifts?.beds){
        for(const {mesh} of s.meadow.drifts.beds)mesh.visible=!!L.flowers;
      }
      const flState=typeof environmentRoot!=="undefined"&&environmentRoot?.userData?.flowerState;
      if(flState){
        for(const layer of [flState.ambient,flState.ground,flState.structure]){
          if(layer?.meshes)for(const m of layer.meshes)m.visible=!!L.flowers;
        }
      }
      if(typeof sun!=="undefined"&&sun)sun.castShadow=!!L.shadows;
      if(typeof renderer!=="undefined"&&renderer){
        renderer.shadowMap.enabled=!!L.shadows;
        if(L.shadows)renderer.shadowMap.needsUpdate=true;
      }
      s.meadow.fxDisabled=!L.fx;
      if(s.meadow.mountainClouds)s.meadow.mountainClouds.visible=!!L.fx;
      if(s.meadow.fallback)s.meadow.fallback.visible=!!(L.fx&&(!window.AIBAGrade?.isActive?.()));
      if(s.meadow.drifts?.seeds)s.meadow.drifts.seeds.visible=!!(L.fx&&L.flowers);
      if(!L.fx){
        if(s.meadow.rain)s.meadow.rain.visible=false;
        if(s.meadow.bolt)s.meadow.bolt.visible=false;
      }
      if(s.meadow.court){
        for(const pool of [s.meadow.court.petals,s.meadow.court.pollen]){
          if(pool?.mesh)pool.mesh.visible=!!L.fx;
        }
      }
      if(s.meadow.specShadows)s.meadow.specShadows.mesh.visible=!!(L.base&&L.shadows);
      if(window.AIBAGrade?.setEnabled)AIBAGrade.setEnabled(!!L.fx);
    }

    function spectatorShadows(s){
      // Single instanced soft contact shadow pass grounding court-side spectators into the pasture turf (1 draw call, 48 tris max).
      const geo=new THREE.PlaneGeometry(1,1);
      geo.rotateX(-Math.PI/2);
      const mat=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
        uniforms:{meadowSky:s.meadow.uniforms.meadowSky},
        vertexShader:`
          varying vec2 vUv;
          void main(){
            vUv=uv;
            gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
          }`,
        fragmentShader:`
          uniform vec4 meadowSky;
          varying vec2 vUv;
          void main(){
            vec2 p=vUv*2.0-1.0;
            float r=length(p);
            float a=exp(-r*r*3.2)*(1.0-smoothstep(0.62,1.0,r))*mix(0.32,0.50,meadowSky.x);
            gl_FragColor=vec4(0.04,0.07,0.035,a);
          }`
      });
      const mesh=new THREE.InstancedMesh(geo,mat,24);
      mesh.name="meadowSpectatorShadows";mesh.count=0;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      s.root.add(mesh);
      return {mesh,dummy:new THREE.Object3D()};
    }

    function updateMeadow(s,dt){
      const weather=s.meadow,p=weather.flowerProgress;
      const L=s.meadowLayers||(s.meadowLayers=parseMeadowLayers());
      try{
        let px=999,pz=999,ox=999,oz=999,b1x=999,b1z=999,b2x=999,b2z=999;
        if(typeof player!=="undefined"&&player?.g?.visible){px=player.g.position.x;pz=player.g.position.z;}
        if(typeof OPP!=="undefined"&&OPP?.guy?.g?.visible){ox=OPP.guy.g.position.x;oz=OPP.guy.g.position.z;}
        else if(typeof passer!=="undefined"&&passer?.g?.visible){ox=passer.g.position.x;oz=passer.g.position.z;}
        if(typeof balls!=="undefined"&&Array.isArray(balls)){
          for(const b of balls){
            if(b?.mesh?.visible&&b.mesh.position.y<.85){
              if(b1x===999){b1x=b.mesh.position.x;b1z=b.mesh.position.z;}
              else if(b2x===999){b2x=b.mesh.position.x;b2z=b.mesh.position.z;break;}
            }
          }
        }
        weather.uniforms.meadowActors.value.set(px,pz,ox,oz);
        weather.uniforms.meadowBall.value.set(b1x,b1z,b2x,b2z);
      }catch(e){}
      const {rain,clear,gold,flash,blackout}=AIBAMeadowWeather.update(weather,s.time,dt);
      if(weather.court)AIBAMeadowCourt.update(weather.court,s.time,dt,rain,weather.wetness,clear);
      const drifts=weather.drifts;
      drifts.bloom.value=p;
      drifts.count=0;
      for(const {mesh,targets} of drifts.beds){
        if(!L.flowers){mesh.count=0;mesh.visible=false;continue;}
        mesh.visible=true;
        let low=0,high=targets.length;
        while(low<high){
          const middle=(low+high)>>>1;
          if(targets[middle]<p)low=middle+1;else high=middle;
        }
        mesh.count=low;drifts.count+=low*3;
      }
      drifts.seeds.visible=!!(L.fx&&L.flowers&&rain<.42);
      if(weather.specShadows&&L.base&&L.shadows){
        const sh=weather.specShadows,d=sh.dummy,sunV=weather.uniforms.meadowSun.value;
        const offX=-sunV.x*0.18,offZ=-sunV.z*0.18,yaw=Math.atan2(offX,offZ);
        let sc=0;
        if(typeof streetCrowd!=="undefined"&&streetCrowd?.root?.visible!==false&&Array.isArray(streetCrowd?.people)){
          for(let i=0;i<streetCrowd.people.length&&sc<24;i++){
            const g=streetCrowd.people[i]?.g;
            if(!g||!g.visible)continue;
            const x=g.position.x+offX,z=g.position.z+offZ;
            d.position.set(x,elevation(g.position.x,g.position.z)+0.024,z);
            d.rotation.set(0,yaw,0);
            d.scale.set(0.95,1,1.22);
            d.updateMatrix();
            sh.mesh.setMatrixAt(sc++,d.matrix);
          }
        }
        sh.mesh.count=sc;
        if(sc)sh.mesh.instanceMatrix.needsUpdate=true;
      }
      if(weather.livestock){
        const t=s.time;
        for(const a of weather.livestock){
          // Gentle independent grazing head-nodding
          const q=cosmicGroundFX.response(a.x,a.z);
          a.headPivot.rotation.x=.35+.32*Math.sin(t*a.rate+a.phase)-q*.94;
          a.headPivot.rotation.y=q*Math.sign(-a.x)*.52;
          a.root.position.x=a.x+Math.sign(a.x)*q*.49;
          a.root.position.y=a.y+q*(a.cow?.10:.38);
          a.root.rotation.z=-Math.sign(a.x)*q*.12;
        }
      }
      ambient.color.copy(weather.skyColor);
      // Strong directional cloud-break contrast even at opening overcast phase (clear == 0) so terrain, trees & boulders have 3D depth.
      ambient.intensity=(.28-.08*clear-.04*gold)*(1-.82*blackout)+.21*flash;
      hemi.intensity=(.40-.06*rain-.08*gold)*(1-.77*blackout)+.12*flash;
      sun.intensity=(.56+.62*clear+.22*gold)*(1-.88*blackout)+.24*flash;
      // Long shadows, from the same direction the cloud and mountain shaders use.
      sun.position.copy(weather.uniforms.meadowSun.value).multiplyScalar(49);
      sun.color.copy(weather.wetColor).lerp(weather.sunColor,clear).lerp(weather.warmColor,gold);
      const isTele=typeof camera!=="undefined"&&camera&&(camera.userData?.meadowTele||camera.fov<40);
      if(weather.uniforms.meadowFurDist){
        const teleK=isTele?THREE.MathUtils.clamp((44-(camera.fov||28))/20,0,1):0;
        weather.uniforms.meadowFurDist.value.set(18+12*teleK,28.5+17.5*teleK);
      }
      scene.fog.color.copy(weather.coolFog).lerp(weather.clearingFog,clear);
      scene.fog.near=(28+16*clear)+(isTele?16:0);scene.fog.far=(275-45*rain+195*clear)+(isTele?95:0);
      const data=document.documentElement.dataset;
      if(data.environmentPhase!==weather.stage)data.environmentPhase=weather.stage;
      const count=String(drifts.count);
      if(data.flowerMeadow!==count)data.flowerMeadow=count;
    }

    function pastureLivestock(s){
      // Distant alpine grazing sheep (6) & cows (2) on the sunlit meadow hillsides to visually anchor the distant pasture audio.
      const grp=new THREE.Group();grp.name="meadowPastureLivestock";
      const woolMat=new THREE.MeshLambertMaterial({color:0xe8e5dc});
      const darkFaceMat=new THREE.MeshLambertMaterial({color:0x363432});
      const cowBrownMat=new THREE.MeshLambertMaterial({color:0x6b4a34});
      const cowPatchMat=new THREE.MeshLambertMaterial({color:0xebe6db});
      const animals=[];
      const placements=[
        {kind:"sheep",x:34,z:-28,yaw:1.8},{kind:"sheep",x:37.5,z:-25.5,yaw:2.5},{kind:"sheep",x:32,z:-24.5,yaw:0.9},
        {kind:"sheep",x:40.5,z:-30,yaw:-1.2},{kind:"sheep",x:-38,z:-22,yaw:-0.7},{kind:"sheep",x:-34.5,z:-25,yaw:0.4},
        {kind:"cow",x:44,z:-19,yaw:2.2},{kind:"cow",x:-41,z:-17,yaw:-1.1}
      ];
      for(let i=0;i<placements.length;i++){
        const a=placements[i],isCow=a.kind==="cow";
        const root=new THREE.Group();
        const py=elevation(a.x,a.z);
        root.position.set(a.x,py,a.z);root.rotation.y=a.yaw;
        const bodyMat=isCow?cowBrownMat:woolMat;
        const bw=isCow?0.78:0.48,bh=isCow?0.72:0.42,bl=isCow?1.58:0.86,legH=isCow?0.72:0.34;
        const body=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bl),bodyMat);
        body.position.y=legH+bh*0.5;root.add(body);
        if(isCow){
          const patch=new THREE.Mesh(new THREE.BoxGeometry(bw+0.03,bh*0.58,bl*0.42),cowPatchMat);
          patch.position.set(0,legH+bh*0.52,-0.12);root.add(patch);
        }
        for(const lx of [-bw*0.32,bw*0.32])for(const lz of [-bl*0.34,bl*0.34]){
          const leg=new THREE.Mesh(new THREE.BoxGeometry(isCow?0.12:0.08,legH,isCow?0.12:0.08),darkFaceMat);
          leg.position.set(lx,legH*0.5,lz);root.add(leg);
        }
        const headPivot=new THREE.Group();
        headPivot.position.set(0,legH+bh*0.62,bl*0.52);
        const head=new THREE.Mesh(new THREE.BoxGeometry(isCow?0.36:0.24,isCow?0.34:0.22,isCow?0.48:0.30),isCow?cowBrownMat:darkFaceMat);
        head.position.set(0,-0.04,isCow?0.20:0.12);
        headPivot.add(head);root.add(headPivot);
        grp.add(root);
        animals.push({headPivot,root,x:a.x,y:py,z:a.z,cow:isCow,phase:i*1.93,rate:0.38+(i%4)*0.11});
      }
      s.root.add(grp);
      return animals;
    }

    // Instance-local bend follows the passing world-space crest, even on rotated foliage.
    function pressureBend(flex){
      return `if(meadowPressure.w>0.0){
        vec2 delta=root-meadowPressure.xy;
        float d=length(delta);
        float crest=meadowPressure.w*(1.0-smoothstep(.55,3.8,abs(d-meadowPressure.z)));
        vec2 outward=delta/max(d,.05);
        vec2 local=vec2(dot(outward,normalize(instanceMatrix[0].xz)),dot(outward,normalize(instanceMatrix[2].xz)));
        transformed.xz+=local*crest*.58*${flex};
        transformed.y*=1.0-crest*.48*${flex};
      }`;
    }

    function buildMeadow(s){
      s.heightAt=elevation;
      s.turfHeightAt=turfHeightAt;
      s.turfWearAt=turfWearAt;
      s.meadow=AIBAMeadowWeather.build(s);
      s.meadow.spruceShadowGLSL=spruceShadowGLSL;
      s.meadow.meadowPaletteGLSL=meadowPaletteGLSL;
      s.meadow.uniforms.meadowPressure={value:new THREE.Vector4()};
      s.meadow.uniforms.meadowTreeMap={value:null};
      s.meadow.uniforms.meadowFurDist={value:new THREE.Vector2(18.0,28.5)};
      ground(s);
      const rock=terrainTexture("alpine-rock.jpg");
      const mountain=new THREE.MeshBasicMaterial({map:rock,side:THREE.DoubleSide,fog:false});
      mountain.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,s.meadow.uniforms);
        shader.uniforms.peakRock={value:linear(0x596471)};
        shader.uniforms.peakSnow={value:linear(0xd2dde3)};
        shader.uniforms.peakShade={value:linear(0x435b77)};
        shader.uniforms.peakAmber={value:linear(0xff9e46)};
        shader.vertexShader="attribute vec3 rockExposure;\nvarying vec3 vRockExposure,vRockNormal,vRockWorld;\n"+
          shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvRockExposure=rockExposure;vRockNormal=normal;vRockWorld=position;");
        shader.fragmentShader=AIBAMeadowWeather.cloudGLSL+AIBAMeadowWeather.skyGLSL+`
          uniform vec3 peakRock,peakSnow,peakShade,peakAmber;
          varying vec3 vRockExposure,vRockNormal,vRockWorld;
        `+shader.fragmentShader.replace("#include <map_fragment>",`
          vec3 coarse=mapTexelToLinear(texture2D(map,vUv*.46)).rgb;
          vec2 tilted=mat2(.91,-.41,.41,.91)*vUv;
          vec3 surface=mapTexelToLinear(texture2D(map,tilted*1.29)).rgb;
          vec3 flutes=mapTexelToLinear(texture2D(map,vec2(vUv.x*1.63+vUv.y*.26,vUv.y*.35))).rgb;
          vec3 lum=vec3(.22,.70,.08);
          float weathering=dot(coarse,lum),grain=dot(surface,lum),streak=dot(flutes,lum);
          float ice=smoothstep(.31,.53,vRockExposure.x+(weathering-.28)*.42+(streak-.28)*.38+(grain-.28)*.15);
          vec3 stone=peakRock*(.41+1.23*weathering+.60*grain+.40*streak);
          vec3 snow=peakSnow*(.75+.36*weathering+.29*grain+.16*streak);
          vec3 terrain=mix(stone,snow,ice);
          float face=dot(normalize(vRockNormal),meadowSun);
          float light=smoothstep(-.08,.34,face+.15*(weathering-.28))*vRockExposure.z;
          // Preserve strong 3D rock-rib & snow-chute relief even in the opening overcast phase (meadowSky.x == 0).
          float overcastRelief=mix(.58,1.22,smoothstep(-.28,.38,face));
          vec3 day=terrain*vRockExposure.y*mix(overcastRelief*.88,.96,meadowSky.x);
          day=mix(day,day*vec3(.74,.89,1.14)+vec3(.018,.028,.044),(1.0-meadowSky.x)*.48);
          vec3 shadow=terrain*vec3(.35,.46,.69)+peakShade*.22;
          vec3 amber=terrain*vec3(1.14,.59,.32)+peakAmber*(.28+.27*ice+.28*grain);
          vec3 sunset=mix(shadow,amber,light);
          vec3 col=mix(day,sunset,meadowSky.y);
          vec3 path=vRockWorld-cameraPosition;
          float distanceToRock=length(path);
          vec3 ray=path/max(.001,distanceToRock);
          // 3D Domain-Warped Orographic Volumetric Cloud System ("云雾环山 / 随机不同厚度局部体积云挡山"):
          // Multi-scale FBM noise creates localized cloud islands so some peaks/ridges are heavily occluded while adjacent ridges stay clear.
          vec2 cUV=vRockWorld.xz*1.45+vec2(meadowClock*1.9,-meadowClock*.75);
          vec2 cWarp=vec2(cloudDensity(cUV+vec2(37.0,19.0)),cloudDensity(cUV+vec2(-53.0,71.0)))-.48;
          float nMacro=cloudDensity(cUV*.48+cWarp*110.0);
          float nBillow=cloudDensity(cUV*1.35-cWarp*72.0+vec2(vRockWorld.y*2.4,0.0));
          float nWisp=cloudDensity(cUV*3.4+vec2(vRockWorld.y*5.8,meadowClock*2.2));
          float cloudFbm=nMacro*.50+nBillow*.34+nWisp*.16;

          // 1) Mid-Mountain Waist Cloud Belt ("云海缠山腰"): wraps around mid-slopes while leaving summits & lower rock visible.
          float waistAlt=32.0+15.0*sin(vRockWorld.x*.019+meadowClock*.035)+11.0*cos(vRockWorld.z*.023);
          float waistProfile=exp(-pow((vRockWorld.y-waistAlt)/(10.5+9.5*nBillow),2.0));
          float waistCloud=smoothstep(.35,.66,cloudFbm+waistProfile*.34)*waistProfile;

          // 2) Localized High-Altitude Cumulus Masses ("局部厚体积云团挡山头"): thick opaque clouds over random sectors, clear gaps elsewhere.
          float sectorMask=smoothstep(.46,.72,nMacro+.22*nBillow);
          float highProfile=smoothstep(24.0,46.0,vRockWorld.y)*(1.0-smoothstep(84.0,118.0,vRockWorld.y-(nBillow-.45)*26.0));
          float peakCloud=sectorMask*highProfile*smoothstep(.34,.68,cloudFbm*1.32);

          // 3) Ravine & Valley Cloud Tongues ("山谷云舌"): pool inside mountain gorges/chutes rather than a flat horizontal line.
          float valleyTop=6.0+24.0*pow(nMacro,1.35)+15.0*vRockExposure.x+9.0*(nBillow-.4);
          float valleyCloud=smoothstep(valleyTop+8.0,valleyTop-10.0,vRockWorld.y)*(.42+.58*cloudFbm);

          float rawCloud=max(max(waistCloud*1.25,peakCloud*1.35),valleyCloud);
          float weatherDensity=mix(.98,.38,meadowSky.x)*(1.0-meadowSky.y*.22);
          float cloudOpacity=clamp(pow(rawCloud*weatherDensity,1.15),0.0,.985);

          // Cloud-cast shadow on the mountain rock right beneath overhanging cloud belts grounds the clouds in 3D space.
          float cloudAbove=exp(-pow((vRockWorld.y-(waistAlt-11.0))/9.0,2.0))*smoothstep(.38,.66,nMacro)+peakCloud*.65;
          col*=1.0-clamp(cloudAbove*weatherDensity*.44,0.0,.42);

          // Subtle aerial distance haze on clear rock faces (never a heavy flat overlay).
          float distanceHaze=smoothstep(135.0,620.0,distanceToRock)*mix(.26,.16,meadowSky.x);
          vec3 skyCol=alpineSky(ray,cameraPosition);
          vec3 rockOut=mix(col*(1.0-meadowStorm.y*.78),skyCol,distanceHaze);

          // 3D Volumetric Cloud Self-Shading: bright silver/warm upper billow rim, deep slate-blue self-shadowed cloud belly.
          float billowTop=clamp((vRockWorld.y-waistAlt+14.0)/28.0+(nBillow-.46)*.75-(nWisp-.48)*.25,0.0,1.0);
          float coreThickness=smoothstep(.38,.90,cloudOpacity);
          vec3 cloudBelly=mix(vec3(.23,.30,.39),vec3(.38,.46,.54),meadowSky.x)*(1.0-.72*meadowStorm.y);
          vec3 cloudLitTop=mix(vec3(.79,.84,.89),mix(vec3(.96,.95,.90),vec3(1.0,.75,.46),meadowSky.y),meadowSky.x*.75+.25);
          vec3 volumetricCloudCol=mix(cloudBelly,cloudLitTop,smoothstep(.14,.84,billowTop*(1.0-coreThickness*.24)));

          diffuseColor.rgb=mix(rockOut,volumetricCloudCol,cloudOpacity);
        `);
      };
      mountainRange(s,true,mountain);mountainRange(s,false,mountain);
      goldenSnowMassif(s,rock);meadowParallaxFence(s);
      spruceForest(s);meadowGrass(s);meadowRocks(s,rock);meadowShrubs(s);
      s.meadow.specShadows=spectatorShadows(s);
      s.meadow.livestock=pastureLivestock(s);
      s.meadow.drifts=distantFlowers(s,s.meadow);
      s.meadowLayers=parseMeadowLayers();
      updateMeadow(s,0);
      applyMeadowLayers(s);
    }
    const PRESETS={
      base:{base:true,grass:false,trees:false,flowers:false,shadows:false,fx:false},
      grass:{base:true,grass:true,trees:false,flowers:false,shadows:false,fx:false},
      trees:{base:true,grass:true,trees:true,flowers:false,shadows:false,fx:false},
      flowers:{base:true,grass:true,trees:true,flowers:true,shadows:false,fx:false},
      shadows:{base:true,grass:true,trees:true,flowers:true,shadows:true,fx:false},
      full:{base:true,grass:true,trees:true,flowers:true,shadows:true,fx:true}
    };
    const activePlace=()=>typeof environmentRoot!=="undefined"&&environmentRoot?.userData?.placeState?.meadow?environmentRoot.userData.placeState:null;
    window.AIBAFloraLab=Object.freeze({
      getLayers(){const s=activePlace();return s?{...s.meadowLayers}:null;},
      setLayers(cfg){const s=activePlace();if(!s)return null;s.meadowLayers={...(s.meadowLayers||parseMeadowLayers()),...(cfg||{})};applyMeadowLayers(s);return {...s.meadowLayers};},
      preset(name){const p=PRESETS[name];return p?this.setLayers(p):this.getLayers();},
      stats(){
        const s=activePlace();if(!s)return null;
        const countTris=list=>(list||[]).reduce((acc,m)=>acc+(m.visible?m.count*((m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3):0),0);
        return {
          layers:{...s.meadowLayers},
          grassInstances:(s.meadowLayersRefs?.grass||[]).reduce((a,m)=>a+(m.visible?m.count:0),0),
          grassTris:Math.round(countTris(s.meadowLayersRefs?.grass)),
          treeInstances:(s.meadowLayersRefs?.trees||[]).reduce((a,m)=>a+(m.visible?m.count:0),0),
          treeTris:Math.round(countTris(s.meadowLayersRefs?.trees)),
          distantFlowerCount:s.meadow.drifts?.count||0
        };
      }
    });
    return {build:buildMeadow,update:updateMeadow};
  })();
  function build(s,b,helpers){if(s.name==="flowerCourt")meadow.build(s);else if(s.name==="arcticSnow")arctic(s,b,helpers);else if(s.name==="spanishQuarter")spanish(s,b,helpers);else if(s.name==="lunarCrater")lunar(s,b,helpers);else if(s.name==="tokyoRooftop")tokyo(s,b,helpers);}
  const LUNAR_DAY_SUN=new THREE.Color(0xfff8ee),LUNAR_ECL_SUN=new THREE.Color(0xd84624);
  const LUNAR_DAY_AMB=new THREE.Color(0x8a909a),LUNAR_ECL_AMB=new THREE.Color(0x421614);
  const LUNAR_DAY_HEMI=new THREE.Color(0x9ca4b2),LUNAR_ECL_HEMI=new THREE.Color(0x521c18);
  const LUNAR_DAY_FOG=new THREE.Color(0x030408),LUNAR_ECL_FOG=new THREE.Color(0x160506);

  function smoothDampLunar(cur,target,obj,velKey,smoothTime,maxSpeed,dt){
    if(dt<=0)return cur;
    const st=Math.max(0.0001,smoothTime),omega=2/st,x=omega*dt;
    const exp=1/(1+x+0.48*x*x+0.235*x*x*x);
    const maxCh=maxSpeed*st;
    const ch=Math.max(-maxCh,Math.min(maxCh,cur-target));
    const ct=cur-ch;
    const temp=(obj[velKey]+omega*ch)*dt;
    obj[velKey]=(obj[velKey]-omega*temp)*exp;
    let out=ct+(ch+temp)*exp;
    if((target-cur>0)===(out>target)){out=target;obj[velKey]=0;}
    return out;
  }

  function applyLunarHoopImpulse(w,ox,oy,oz,strength,radius){
    if(!w)return;
    const rad=radius||5.2,str=Math.max(0.5,strength||3.6);
    const swarm=w.hoopSwarm;
    if(swarm){
      for(let i=0;i<swarm.count;i++){
        const f=swarm.items[i];
        const px=f.hx+f.dx,py=f.hy+f.dy,pz=f.hz+f.dz;
        const rx=px-ox,ry=py-oy,rz=pz-oz;
        const d2=rx*rx+ry*ry+rz*rz;
        if(d2>rad*rad)continue;
        const d=Math.sqrt(d2);
        const inv=d>0.04?1/d:0;
        const nx=d>0.04?rx*inv:f.sx,ny=d>0.04?ry*inv:f.sy,nz=d>0.04?rz*inv:f.sz;
        const fall=Math.exp(-d/(rad*0.48)),kick=str*fall;
        const cx=ny*f.sz-nz*f.sy,cy=nz*f.sx-nx*f.sz,cz=nx*f.sy-ny*f.sx;
        f.vx+=(nx*0.76+cx*0.58)*kick;
        f.vy+=(ny*0.72+cy*0.52+0.15)*kick;
        f.vz+=(nz*0.76+cz*0.58)*kick;
        f.excited=Math.min(1.45,f.excited+fall*1.12);
      }
    }
    if(w.drones){
      for(const dr of w.drones){
        const rx=(dr.hx+dr.dx)-ox,ry=(dr.hy+dr.dy)-oy,rz=(dr.hz+dr.dz)-oz;
        const d=Math.hypot(rx,ry,rz);
        if(d<5.2&&d>0.05){
          const kick=str*0.42*Math.exp(-d*0.35);
          dr.vx+=(rx/d)*kick;dr.vy+=(ry/d+0.25)*kick;dr.vz+=(rz/d)*kick;
          dr.flashT=1.4;
        }
      }
    }
  }

  function emitBlupeeParticles(jr,x,y,z,count,burstSpeed){
    const tr=jr?.trail;
    if(!tr)return;
    const n=tr.items.length;
    for(let k=0;k<count;k++){
      const idx=tr.cursor%n;tr.cursor=(tr.cursor+1)%n;
      const it=tr.items[idx];
      const ang=(k/Math.max(1,count))*Math.PI*2+Math.sin(k*4.7)*0.5;
      const elev=( (k%5)/4 - 0.3 )*1.2;
      const spd=burstSpeed*(0.55+0.75*((k*7)%11)/10);
      it.x=x+(Math.cos(ang)*0.22);
      it.y=y+0.35+((k%4)*0.12);
      it.z=z+(Math.sin(ang)*0.22);
      it.vx=Math.cos(ang)*spd;
      it.vy=0.45+Math.abs(elev)*spd*0.85;
      it.vz=Math.sin(ang)*spd;
      it.maxLife=0.95+((k*3)%7)*0.16;
      it.life=it.maxLife;
    }
  }

  // A suit part is rigidly attached to one joint. Preserve the original surface and triangle
  // indices; draw the articulated suit once per material instead of once per seam or fitting.
  function bindLunarSuit(root,joints){
    root.updateMatrixWorld(true);
    const byMaterial=new Map(),sources=[];
    const positions=[],normals=[],uvs=[],indices=[],weights=[],jointIndices=[];
    function collect(node,joint){
      const next=joints.indexOf(node);
      if(next!==-1)joint=next;
      if(node.isMesh){
        const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);
        const offset=positions.length/3;
        positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);
        uvs.push(...geo.attributes.uv.array);
        const count=geo.attributes.position.count;
        for(let i=0;i<count;i++){jointIndices.push(joint,0,0,0);weights.push(1,0,0,0);}
        let group=byMaterial.get(node.material);
        if(!group){group=[];byMaterial.set(node.material,group);}
        for(let i=0,n=geo.index?geo.index.count:count;i<n;i++)group.push(offset+(geo.index?geo.index.getX(i):i));
        sources.push(node);geo.dispose();
      }
      for(const child of node.children)collect(child,joint);
    }
    collect(root,0);
    for(const node of sources){node.parent.remove(node);node.geometry.dispose();}
    const skin=new THREE.BufferGeometry();
    skin.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    skin.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3));
    skin.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    skin.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
    skin.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(jointIndices,4));
    const materials=[];
    for(const [mat,group] of byMaterial){
      skin.addGroup(indices.length,group.length,materials.length);
      indices.push(...group);mat.skinning=true;materials.push(mat);
    }
    skin.setIndex(indices);
    skin.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,0),1.9);
    const skeleton=new THREE.Skeleton(joints);
    const suit=new THREE.SkinnedMesh(skin,materials);suit.name="lunarEvaSuit";suit.castShadow=true;suit.receiveShadow=true;
    root.add(suit);suit.bind(skeleton);
    skin.addEventListener("dispose",()=>skeleton.dispose());
  }

  // The three crew members share a hatch, then disperse behind the baseline to watch the game.
  // Solve the glove against the visor or camera grip in torso space. Keep each elbow outboard.
  const wristAim=new THREE.Vector3(),elbowOut=new THREE.Vector3(),boneDir=new THREE.Vector3();
  const wristDir=new THREE.Vector3(),restDir=new THREE.Vector3(),upperQ=new THREE.Quaternion(),localQ=new THREE.Quaternion();
  const gloveOffset=new THREE.Vector3(0,-.32,.02);
  function lunarWrist(arm,fore,x,y,z,side,weight){
    wristAim.set(x,y,z).sub(arm.position);
    const upper=fore.position.length(),lower=gloveOffset.length();
    const d=THREE.MathUtils.clamp(wristAim.length(),.04,upper+lower-.0001);
    wristAim.normalize();
    const along=(upper*upper-lower*lower+d*d)/(2*d);
    elbowOut.set(side,-.26,-.12);
    elbowOut.addScaledVector(wristAim,-elbowOut.dot(wristAim)).normalize();
    boneDir.copy(wristAim).multiplyScalar(along).addScaledVector(elbowOut,Math.sqrt(Math.max(0,upper*upper-along*along)));
    wristDir.copy(wristAim).multiplyScalar(d).sub(boneDir).normalize();
    upperQ.setFromUnitVectors(restDir.copy(fore.position).normalize(),boneDir.normalize());
    wristDir.applyQuaternion(localQ.copy(upperQ).invert());
    localQ.setFromUnitVectors(restDir.copy(gloveOffset).normalize(),wristDir);
    arm.quaternion.slerp(upperQ,weight);fore.quaternion.slerp(localQ,weight);
  }
  // Each crew member can take either direction around a short route off the playing surface.
  const crewRoutes=[
    [[2.5,-14.1],[1.8,-12.2],[3.1,-11.1],[4.0,-13.0]],
    [[8.8,-11.4],[10.3,-10.7],[10.6,-12.4],[9.5,-14.1]],
    [[-3.4,-15.5],[-5.5,-16.5],[-7.9,-16.45],[-7.1,-14.7]]
  ];
  const crewPhotos=["court","portrait","selfie"];
  function updateLunarCrew(w,a,index,mission,t,dt,ball){
    const local=mission-7.65-index*2.48;
    if(local<0)return;
    const smooth=THREE.MathUtils.smoothstep,lerp=THREE.MathUtils.lerp;
    const route=crewRoutes[index],home=w.landerHome;
    const [sx,sz]=route[0];
    a.group.visible=true;
    const walkTime=3+Math.hypot(sx-home.x,sz-home.z-3.35)/1.65;
    const onSite=local-2.8-walkTime;
    let x=home.x,z=home.z,y=home.y,walk=0,stepPhase=0;
    let yaw=0,torso=0,lPitch=0,rPitch=0,lRoll=-.19,rRoll=.19,lElbow=-.4,rElbow=-.4;
    let headPitch=0,headYaw=0,photo=0,salute=0;
    const playerPos=typeof P!=="undefined"&&P.pos?P.pos:HOOP;
    if(local<2.8){
      a.mode="egress";
      const along=local/2.8;
      z+=lerp(.45,3.35,along);
      y=lerp(home.y+.95,w.terrainY(x,z),THREE.MathUtils.clamp((z-home.z-1.26)/2.09,0,1));
      walk=.7;stepPhase=along*Math.PI*5;torso=.14;
    }else if(onSite<0){
      a.mode="approach";
      const u=(local-2.8)/walkTime;
      const ease=smooth(u,0,1);
      x=lerp(home.x,sx,ease);z=lerp(home.z+3.35,sz,ease);
      y=w.terrainY(x,z);yaw=Math.atan2(sx-home.x,sz-home.z-3.35);
      walk=Math.sin(Math.PI*u);stepPhase=ease*walkTime*4.1;torso=.09*walk;
    }else{
      a.celebrateT=Math.max(0,a.celebrateT-dt);
      if(a.mode==="approach"||a.mode==="egress"||a.mode==="aboard"||a.mode==="idleWatch"){
        a.mode="wonder";a.modeT=0;a.modeDur=1.8+Math.random()*1.1;
      }else a.modeT+=dt;
      if(a.modeT>=a.modeDur){
        a.modeT=0;
        if(a.mode==="wonder"){
          a.mode="salute";a.modeDur=1.75+Math.random()*.7;
        }else if(a.mode==="patrol"){
          a.stop=a.nextStop;
          a.mode="watch";a.modeDur=1.8+Math.random()*3.9;
        }else if((a.mode==="watch"||a.mode==="salute")&&Math.random()<(ball ? .3 : .65)){
          a.mode="patrol";
          a.nextStop=(a.stop+(Math.random()<.5?1:-1)+route.length)%route.length;
          const [fromX,fromZ]=route[a.stop],[toX,toZ]=route[a.nextStop];
          a.modeDur=Math.hypot(toX-fromX,toZ-fromZ)/a.patrolSpeed+.52;
        }else if(a.mode==="watch"||a.mode==="salute"){
          const previous=crewPhotos.indexOf(a.lastPhoto);
          const pick=previous<0?Math.floor(Math.random()*crewPhotos.length):previous+1+Math.floor(Math.random()*2);
          a.mode=crewPhotos[pick%crewPhotos.length];
          a.lastPhoto=a.mode;a.modeDur=3.2+Math.random()*1.9;
        }else{
          a.mode="watch";a.modeDur=2.2+Math.random()*3.7;
        }
      }
      const [fromX,fromZ]=route[a.stop];
      x=fromX;z=fromZ;
      const u=a.modeT/a.modeDur;
      const hold=smooth(u,0,.22)*(1-smooth(u,.8,1));
      let travelYaw=0;
      if(a.mode==="patrol"){
        const [toX,toZ]=route[a.nextStop];
        // A tapered gait envelope covers the turn out of a pause and the final weight shift.
        const travel=smooth(u,0,1);
        x=lerp(fromX,toX,travel);z=lerp(fromZ,toZ,travel);
        travelYaw=Math.atan2(toX-fromX,toZ-fromZ);
        walk=smooth(u,.06,.25)*(1-smooth(u,.76,1));
        stepPhase=travel*Math.hypot(toX-fromX,toZ-fromZ)*Math.PI*1.7;
        torso=.085*walk;
      }
      y=w.terrainY(x,z);
      const subject=ball||playerPos;
      const aim=a.aim;
      aim.set(subject.x,ball?subject.y:playerPos.y+1.6,subject.z);
      if(a.mode==="court")aim.set(HOOP.x,HOOP.y,HOOP.z);
      if(a.mode==="portrait")aim.set(playerPos.x,playerPos.y+1.45,playerPos.z);
      yaw=Math.atan2(aim.x-x,aim.z-z);
      headPitch=-Math.atan2(aim.y-y-1.5,Math.max(1,Math.hypot(aim.x-x,aim.z-z)));
      if(a.mode==="patrol"){
        const glance=Math.atan2(Math.sin(yaw-travelYaw),Math.cos(yaw-travelYaw));
        headYaw=THREE.MathUtils.clamp(glance,-.6,.6)*(.5+hold*.5);
        yaw=travelYaw;
      }else if(a.mode==="wonder"){
        torso=-.22*hold;lRoll-=.65*hold;rRoll+=.55*hold;headPitch-=.20*hold;
      }else if(a.mode==="salute"){
        salute=hold;
      }else if(a.mode==="watch"){
        const reaction=Math.sin(Math.PI*Math.min(1,a.celebrateT/1.55));
        const breathing=Math.sin(t*2.3+index*1.67);
        torso=.022*breathing-.16*reaction;lPitch=-.6*reaction;lRoll-=.018*breathing+.65*reaction;
      }else{
        photo=hold;
        if(a.mode==="selfie"){
          // Face away from the hoop so the court is behind the crew member in the photograph.
          yaw=Math.atan2(x-HOOP.x,z-HOOP.z);
          rPitch=-1.72*hold;rElbow=-.40+.25*hold;rRoll=.19+.28*hold;
          lRoll-=1.92*hold;lElbow-=1.12*hold;
          headYaw=.29*hold;headPitch=-.12*hold;
        }else{
          rPitch=-1.76*hold;rElbow-=1.02*hold;rRoll-=.23*hold;
          lPitch=-1.18*hold;lElbow-=.91*hold;lRoll+=.65*hold;
        }
      }
    }
    const stride=Math.sin(stepPhase)*walk;
    const brace=cosmicGroundFX.response(x,z);
    if(a.leap>0){
      a.leap=Math.max(0,a.leap-dt);
      const phase=1-a.leap/2.6;
      y+=4*phase*(1-phase)*2.55;
      lRoll-=Math.sin(phase*Math.PI);rRoll+=Math.sin(phase*Math.PI);
    }
    a.group.position.set(x+Math.sign(x)*.30*brace,y+.10*Math.abs(stride),z);
    const turn=Math.atan2(Math.sin(yaw-a.curYaw),Math.cos(yaw-a.curYaw));
    a.curYaw+=turn*Math.min(1,dt*4.5);a.group.rotation.y=a.curYaw;
    a.body.rotation.set(torso-.42*brace,0,stride*.043);
    a.head.rotation.set(THREE.MathUtils.clamp(headPitch,-.58,.36),headYaw,0);
    a.legL.rotation.x=.54*stride;a.legR.rotation.x=-.54*stride;
    a.shinL.rotation.x=.09+Math.max(0,-stride)*.64;a.shinR.rotation.x=.09+Math.max(0,stride)*.64;
    a.armL.rotation.set(lPitch-.33*stride-1.12*brace,0,lRoll);a.armR.rotation.set(rPitch+.33*stride,0,rRoll);
    a.foreArmL.rotation.set(lElbow,0,0);a.foreArmR.rotation.set(rElbow,0,0);
    if(salute)lunarWrist(a.armR,a.foreArmR,.19,.68,.15,1,salute);
    if(photo&&a.mode!=="selfie"){
      lunarWrist(a.armR,a.foreArmR,.105,.53,.36,1,photo);
      lunarWrist(a.armL,a.foreArmL,-.04,.47,.39,-1,photo);
    }
    a.cameraRig.visible=photo>.03;
    if(a.cameraRig.visible){
      if(a.mode==="selfie")a.head.getWorldPosition(a.aim);
      a.cameraRig.lookAt(a.aim);
      a.flash.visible=a.modeT/a.modeDur>.53&&a.modeT/a.modeDur<.575;
    }
  }

  function activeLunarWonder(){
    const env=(typeof environmentRoot!=="undefined"&&environmentRoot)||window.environmentRoot;
    const w=env?.userData?.placeState?.wonder;
    return (w&&w.kind==="lunar")?w:null;
  }

  function lunarImpulse(x,y,z,strength,kind){
    if(typeof currentScenePreset!=="undefined"&&currentScenePreset!=="lunarCrater")return;
    const w=activeLunarWonder();
    if(!w)return;
    if(kind!=="made")w.contacts++;
    const mult=kind==="made"?1.45:kind==="rim"?1.25:0.98;
    applyLunarHoopImpulse(w,x,y,z,(strength||3.4)*mult,kind==="made"?5.6:4.6);
  }

  function lunarCelebrate(cosmic=false){
    if(typeof currentScenePreset!=="undefined"&&currentScenePreset!=="lunarCrater")return;
    const w=activeLunarWonder();
    if(!w||!w.astronauts)return;
    w.makes++;
    if(w.hareVisit&&w.makes>=3&&w.missionTime>=15&&w.jadeRabbit.state==="hidden")w.jadeRabbit.state="invited";
    for(const a of w.astronauts){
      if(a.group.visible&&a.mode!=="egress"&&a.mode!=="approach"){
        a.celebrateT=1.55;
        if(cosmic)a.leap=2.6;
      }
    }
    if(w.jadeRabbit.group.visible)w.jadeRabbit.curious=1.25;
    if(w.drones)for(const dr of w.drones)dr.flashT=1.8;
  }

  function lunarCrystalMix(){
    if(typeof currentScenePreset!=="undefined"&&currentScenePreset!=="lunarCrater")return 0;
    const w=activeLunarWonder();
    return w?(w.eclipseAmount||0):0;
  }

  function resetLunar(place){
    const w=place?.wonder;
    if(!w||w.kind!=="lunar")return;
    w.progress=0;w.progressVel=0;w.targetProgress=0;w.eclipseAmount=0;w.stage="apolloDay";
    w.makes=0;w.contacts=0;w.missionTime=-1;w.hareVisit=Math.random()<.32;
    const hs=w.hoopSwarm;
    hs.age=0;hs.count=0;hs.mesh.visible=false;hs.geo.setDrawRange(0,0);
    hs.offsets.fill(0);hs.geo.attributes.aWake.needsUpdate=true;
    for(const f of hs.items)f.dx=f.dy=f.dz=f.vx=f.vy=f.vz=f.excited=0;
    for(const a of w.astronauts){
      a.group.visible=a.cameraRig.visible=a.flash.visible=false;
      a.mode="aboard";a.modeT=0;a.celebrateT=0;a.leap=0;a.curYaw=0;a.stop=0;a.nextStop=0;a.lastPhoto=null;
    }
    const jr=w.jadeRabbit;
    jr.group.visible=jr.trail.mesh.visible=false;jr.state="hidden";jr.curious=0;
    jr.trail.cursor=0;
    for(const it of jr.trail.items)it.life=0;
    jr.trail.data.fill(0);jr.trail.geo.attributes.aData.needsUpdate=true;
    if(w.drones)for(const dr of w.drones){dr.dx=dr.dy=dr.dz=dr.vx=dr.vy=dr.vz=dr.flashT=0;}
    update(place,0,0);
  }

  function update(s,dt=0,progress){
    if(s.meadow)meadow.update(s,dt);
    const w=s.wonder;if(!w)return;
    if(w.kind==="tokyo"){
      const t=s.time,d=w.dummy;
      d.scale.set(1,1,1);
      w.beacons.forEach(b=>{
        const p=.22+.78*(.5+.5*Math.sin(t*3.1+b.phase));
        b.mat.color.setRGB(1.0*p,.16*p,.12*p);
      });
      w.traffic.forEach(tr=>{
        const span=tr.rd.len,u=((tr.basePos+tr.dir*tr.speed*t+span*.5)%span+span)%span-span*.5;
        const c=Math.cos(tr.rd.rotY),sn=Math.sin(tr.rd.rotY);
        d.position.set(u*c+tr.lane*sn,tr.rd.y+.55,tr.rd.z-u*sn+tr.lane*c);
        d.rotation.set(0,tr.rd.rotY,0);
        d.updateMatrix();
        if(tr.isHead)w.instHead.setMatrixAt(tr.idx,d.matrix);
        else w.instTail.setMatrixAt(tr.idx,d.matrix);
      });
      w.instHead.instanceMatrix.needsUpdate=true;
      w.instTail.instanceMatrix.needsUpdate=true;
      return;
    }
    if(w.kind==="lunar"){
      const t=s.time,step=Math.min(0.05,Math.max(0,dt||0));
      const isBattle=typeof G!=="undefined"&&!!G&&G.mode==="battle";
      const tgt=Math.max(0,Math.min(1,typeof progress==="number"?progress:w.targetProgress));
      w.targetProgress=tgt;
      w.progress=step>0?smoothDampLunar(w.progress,tgt,w,"progressVel",isBattle?3.2:2.0,isBattle?0.08:0.15,step):tgt;
      const p=w.progress;

      // D. 科学真实的「月面日全食 · 地球红环」演进 (p: 0.42 -> 0.74)
      const eclipse=THREE.MathUtils.smoothstep(p,0.42,0.74);
      w.eclipseAmount=eclipse;
      w.earth.material.uniforms.uTime.value=t;
      w.earth.material.uniforms.uEclipse.value=eclipse;
      // 地球缓缓滑向高空中心偏右，在第三人称与第一人称机位都能与轨道空间站遥相呼应，呈现炽热红环地球！
      w.earth.position.set(THREE.MathUtils.lerp(16.5,24.5,THREE.MathUtils.smoothstep(p,0.28,0.76)),THREE.MathUtils.lerp(18.5,19.2,eclipse),-74);
      if(w.starMat)w.starMat.uniforms.uEclipse.value=eclipse;
      if(w.solarCorona){
        w.solarCorona.material.uniforms.uTime.value=t;
        w.solarCorona.material.uniforms.uEclipse.value=eclipse;
      }
      if(w.shaftMat)w.shaftMat.uniforms.uTime.value=t;
      if(w.horizonGlow){
        w.horizonGlow.material.uniforms.uTime.value=t;
        w.horizonGlow.material.uniforms.uEclipse.value=eclipse;
      }
      if(w.lunarDust)w.lunarDust.material.uniforms.uTime.value=t;
      if(w.suit2)w.suit2.visible=(typeof G!=="undefined"&&!!G&&G.mode==="battle");
      // 月面光照随「地球红环日全食」转为神秘暗血铜红月光，同时篮筐工业泛光灯自动点亮
      if(typeof sun!=="undefined"&&sun){
        sun.color.copy(LUNAR_DAY_SUN).lerp(LUNAR_ECL_SUN,eclipse);
        sun.intensity=THREE.MathUtils.lerp(1.52,0.56,eclipse);
      }
      if(typeof ambient!=="undefined"&&ambient){
        ambient.color.copy(LUNAR_DAY_AMB).lerp(LUNAR_ECL_AMB,eclipse);
        ambient.intensity=THREE.MathUtils.lerp(0.28,0.22,eclipse);
      }
      if(typeof hemi!=="undefined"&&hemi){
        hemi.color.copy(LUNAR_DAY_HEMI).lerp(LUNAR_ECL_HEMI,eclipse);
        hemi.intensity=THREE.MathUtils.lerp(0.32,0.24,eclipse);
      }
      if(typeof scene!=="undefined"&&scene?.fog){
        scene.fog.color.copy(LUNAR_DAY_FOG).lerp(LUNAR_ECL_FOG,eclipse);
      }
      if(w.lunarHoopLight)w.lunarHoopLight.intensity=0.25+eclipse*1.55;

      // B1. 多形态自然矿石晶簇（六方水晶柱/八面体/晶洞/板晶）+ 切面星芒闪光
      const crystalPower=0.18+THREE.MathUtils.smoothstep(p,0.12,0.82)*0.90;
      if(w.crystalMats){
        w.crystalMats.forEach((m,idx)=>{
          m.emissiveIntensity=crystalPower*(0.76+0.28*Math.sin(t*(1.4+idx*0.35)+idx*1.9));
        });
      }
      if(w.glintMat){
        w.glintMat.uniforms.uTime.value=t;
        w.glintMat.uniforms.uPower.value=crystalPower;
      }

      // A rare visitor notices repeated baskets, listens, bounds a short distance and dissolves.
      const jr=w.jadeRabbit;
      if(jr.state==="invited"){
        jr.state="arrive";jr.flank=Math.random()<.5?-1:1;jr.gaze=0;jr.stateT=0;jr.age=0;jr.hops=0;jr.earBeat=0;jr.curious=0;jr.nextBlink=1.3+Math.random()*2;
        jr.bankSide=Math.random()<.5?-1:1;jr.x=jr.bankSide*(3.1+Math.random()*.65);
        jr.z=-10.4-Math.random()*.65;jr.y0=w.terrainY(jr.x,jr.z);
        jr.yaw=Math.atan2(-jr.x,HOOP.z-jr.z)+jr.flank*.85;
        jr.group.visible=jr.trail.mesh.visible=true;
        emitBlupeeParticles(jr,jr.x,jr.y0,jr.z,18,1.2);
      }
      if(jr.group.visible||jr.trail.mesh.visible){
        const dtSim=step;
        jr.stateT+=step;jr.age+=step;jr.curious=Math.max(0,jr.curious-step);
        let lift=0,stretch=0,scale=1,look=0,flight=0,compress=0;
        const listen=()=>{
          jr.state="listen";jr.stateT=0;jr.duration=1.5+Math.random()*3.1;
          jr.earBeat=.25+Math.random()*.6;
        };
        if(jr.state==="arrive"){
          scale=THREE.MathUtils.smoothstep(jr.stateT,0,.86);
          if(jr.stateT>=.86)listen();
        }else if(jr.state==="listen"){
          look=Math.sin(Math.PI*Math.min(1,jr.stateT/jr.duration))*.42;
          const flying=typeof balls!=="undefined"&&balls.length?balls[balls.length-1].mesh:null;
          const focus=flying?.visible?flying.position:(typeof P!=="undefined"&&P.pos?P.pos:HOOP);
          const bearing=Math.atan2(focus.x-jr.x,focus.z-jr.z);
          const delta=Math.atan2(Math.sin(bearing-jr.yaw),Math.cos(bearing-jr.yaw));
          jr.gaze+=(THREE.MathUtils.clamp(delta,-.72,.72)-jr.gaze)*Math.min(1,step*7);
          jr.yaw+=(delta+jr.flank*.68)*Math.min(1,step*2);
          if(jr.stateT>jr.duration&&jr.curious===0){
            jr.stateT=0;
            if(jr.age>12||jr.hops>=3){jr.state="leave";emitBlupeeParticles(jr,jr.x,jr.y0,jr.z,26,1.5);}
            else{
              jr.state="bound";jr.hops++;jr.duration=.64+Math.random()*.24;
              jr.fromX=jr.x;jr.fromZ=jr.z;
              const reach=.85+Math.random()*1.45;
              if(Math.abs(jr.x+jr.flank*reach)>5.8||Math.abs(jr.x+jr.flank*reach)<2.2)jr.flank*=-1;
              jr.toX=jr.x+jr.flank*reach;
              jr.toZ=THREE.MathUtils.clamp(jr.z+(Math.random()-.4)*1.6,-11.45,-10.05);
              jr.takeoffYaw=Math.atan2(jr.toX-jr.x,jr.toZ-jr.z);
            }
          }
        }else if(jr.state==="bound"){
          const u=Math.min(1,jr.stateT/jr.duration);
          flight=THREE.MathUtils.clamp((u-.22)/.64,0,1);
          compress=Math.sin(Math.PI*Math.min(1,u/.22))*.10+Math.sin(Math.PI*Math.max(0,(u-.86)/.14))*.072;
          lift=4*flight*(1-flight)*(.42+.09*jr.hops);
          stretch=lift*.10-compress;
          jr.x=THREE.MathUtils.lerp(jr.fromX,jr.toX,flight);
          jr.z=THREE.MathUtils.lerp(jr.fromZ,jr.toZ,flight);
          jr.yaw+=Math.atan2(Math.sin(jr.takeoffYaw-jr.yaw),Math.cos(jr.takeoffYaw-jr.yaw))*Math.min(1,step*12);
          jr.y0=w.terrainY(jr.x,jr.z);
          if(u>=1){if(Math.random()<.42)jr.flank*=-1;emitBlupeeParticles(jr,jr.x,jr.y0,jr.z,5,.55);listen();}
        }else if(jr.state==="leave"){
          const exit=THREE.MathUtils.clamp(jr.stateT/.7,0,1);
          scale=1-THREE.MathUtils.smoothstep(exit,.25,1);lift=Math.sin(exit*Math.PI)*.62;
          jr.x+=Math.sin(jr.yaw)*step*2.1;jr.z+=Math.cos(jr.yaw)*step*2.1;jr.y0=w.terrainY(jr.x,jr.z);
          if(jr.stateT>=.7){jr.group.visible=false;jr.state="afterglow";jr.stateT=0;}
        }else if(jr.state==="afterglow"&&jr.stateT>2.4){
          jr.trail.mesh.visible=false;jr.state="gone";
        }
        const startled=cosmicGroundFX.response(jr.x,jr.z);
        jr.group.scale.setScalar(1.14*scale);
        jr.group.position.set(jr.x,jr.y0+lift+startled*.6-compress*.5,jr.z);jr.group.rotation.y=jr.yaw;
        const breath=jr.state==="listen"?.012*Math.sin(jr.age*3.4):0;
        jr.body.scale.set(1-stretch*.4,1+stretch+breath,1-stretch*.4);
        const blink=THREE.MathUtils.clamp((jr.age-jr.nextBlink)/.19,0,1);
        for(const eye of jr.eyes)eye.scale.y=1-.94*Math.sin(Math.PI*blink);
        if(blink===1)jr.nextBlink=jr.age+1.9+Math.random()*3.6;
        jr.body.rotation.x=jr.state==="bound"?-.21*Math.sin(flight*Math.PI*2):-.025*look;
        if(jr.state!=="listen")jr.gaze*=Math.exp(-step*6);
        jr.head.rotation.set(-look*.16-jr.curious*.12+compress,jr.gaze+look*.11,jr.flank*look*.14);
        const flick=jr.state==="listen"?Math.exp(-Math.pow((jr.stateT-jr.earBeat)*9,2)):0;
        jr.earL.rotation.set(-.09-lift*.75,look*.25,.16+flick*.36);
        jr.earR.rotation.set(-.40-lift*.52+jr.curious*.16,-look*.34,-.39-look*.20);
        jr.foreL.rotation.x=-lift*(1.04+.56*flight);
        jr.foreR.rotation.x=-lift*(.75+.48*flight);
        jr.hindL.rotation.x=lift*(1.95-3.15*flight);
        jr.hindR.rotation.x=lift*(1.62-2.9*flight);
        jr.tail.rotation.x=lift*.25;
        jr.coat.uniforms.uTuck.value=lift*1.32+compress*2.1;jr.coat.uniforms.uEclipse.value=eclipse;jr.haloMat.uniforms.uTime.value=t;
        jr.haloMat.uniforms.uGlow.value=scale*(.31+.15*eclipse);
        const tr=jr.trail;
        if(tr){
          for(let i=0;i<tr.items.length;i++){
            const it=tr.items[i];
            if(it.life>0){
              it.life=Math.max(0,it.life-dtSim);
              it.vx*=Math.exp(-1.4*dtSim);
              it.vz*=Math.exp(-1.4*dtSim);
              it.vy+=0.18*dtSim; // 神性灵粒在 1/6G 下缓缓轻盈升腾
              it.x+=it.vx*dtSim+Math.sin(t*2.8+i)*0.12*dtSim;
              it.y+=it.vy*dtSim;
              it.z+=it.vz*dtSim+Math.cos(t*2.5+i)*0.12*dtSim;
              tr.pos[i*3]=it.x;tr.pos[i*3+1]=it.y;tr.pos[i*3+2]=it.z;
              tr.data[i*3]=it.life/Math.max(0.1,it.maxLife);
              tr.data[i*3+1]=it.size;
              tr.data[i*3+2]=it.kind;
            }else{
              tr.data[i*3]=0;
            }
          }
          tr.geo.attributes.position.needsUpdate=true;
          tr.geo.attributes.aData.needsUpdate=true;
        }
      }

      // Wake the suspended field on repeated makes or contact with the hoop hardware.
      const swarmAwake=w.makes>=2||w.contacts>=4;
      if(swarmAwake){
        const hs=w.hoopSwarm,dtSim=Math.min(0.05,Math.max(0.001,step||1/60));
        hs.age+=step;
        while(hs.count<hs.items.length&&hs.items[hs.count].birth<=hs.age)hs.count++;
        hs.mesh.visible=hs.age>0;
        hs.geo.setDrawRange(0,hs.count);
        const visAmt=.40+THREE.MathUtils.smoothstep(p,.08,.75)*.17;
        const activeBalls=(typeof balls!=="undefined"&&Array.isArray(balls))?balls:null;
        const bPts=[];
        if(activeBalls){
          for(let bi=0;bi<activeBalls.length;bi++){
            const b=activeBalls[bi],mp=b?.mesh?.position;
            if(mp&&b.mesh.visible&&Math.hypot(mp.x-HOOP.x,mp.y-HOOP.y,mp.z-HOOP.z)<14.8){
              const prevX=typeof b._lunarPrevX==="number"?b._lunarPrevX:mp.x;
              const prevY=typeof b._lunarPrevY==="number"?b._lunarPrevY:mp.y;
              const prevZ=typeof b._lunarPrevZ==="number"?b._lunarPrevZ:mp.z;
              const bvx=THREE.MathUtils.clamp((mp.x-prevX)/dtSim,-24,24);
              const bvy=THREE.MathUtils.clamp((mp.y-prevY)/dtSim,-24,24);
              const bvz=THREE.MathUtils.clamp((mp.z-prevZ)/dtSim,-24,24);
              b._lunarPrevX=mp.x;b._lunarPrevY=mp.y;b._lunarPrevZ=mp.z;
              bPts.push({x:mp.x,y:mp.y,z:mp.z,vx:bvx,vy:bvy,vz:bvz});
            }
          }
        }
        const drag=Math.exp(-2.65*dtSim),springK=0.46;
        const uniforms=hs.mesh.material.uniforms;
        uniforms.uClock.value=t;uniforms.uAge.value=hs.age;uniforms.uBrightness.value=visAmt;
        let offsetsChanged=false;
        for(let i=0;i<hs.count;i++){
          const f=hs.items[i];
          // The widest ambient orbit is .32 m. Reject outside the wake before evaluating trig.
          let nearby=false;
          for(let bi=0;bi<bPts.length;bi++){
            const bp=bPts[bi];
            if(Math.abs(f.hx+f.dx-bp.x)<3.18&&Math.abs(f.hz+f.dz-bp.z)<3.18){
              nearby=true;break;
            }
          }
          if(!nearby&&!f.vx&&!f.vy&&!f.vz&&!f.excited&&!f.dx&&!f.dy&&!f.dz)continue;
          const tt=t*f.rate+f.phase;
          const ix=Math.sin(tt*.76)*.32,iy=Math.sin(tt*.98+f.phase)*.24,iz=Math.cos(tt*.68-f.phase)*.30;
          const rise=.72+.28*THREE.MathUtils.smoothstep(hs.age-f.birth,0,2.8);
          for(let bi=0;bi<bPts.length;bi++){
            const bp=bPts[bi];
            const rx=(f.hx+ix+f.dx)-bp.x,ry=Math.max(.28,f.hy+iy+f.dy)*rise-bp.y,rz=(f.hz+iz+f.dz)-bp.z;
            const d2=rx*rx+ry*ry+rz*rz;
            if(d2<2.85*2.85&&d2>.0004){
              const d=Math.sqrt(d2);
              const fall=Math.exp(-d*0.76),nx=rx/d,ny=ry/d,nz=rz/d;
              const cx=ny*f.sz-nz*f.sy,cy=nz*f.sx-nx*f.sz,cz=nx*f.sy-ny*f.sx;
              const wake=16.5*fall*dtSim;
              // 篮球划过轨迹时既有向外推开的气浪，又有沿篮球飞行方向卷起的 1/6G 涡流尾迹！
              f.vx+=(nx*0.64+cx*0.58+bp.vx*0.045)*wake;
              f.vy+=(ny*0.62+cy*0.52+bp.vy*0.035+0.12)*wake;
              f.vz+=(nz*0.64+cz*0.58+bp.vz*0.045)*wake;
              f.excited=Math.min(1.45,f.excited+fall*dtSim*3.8);
            }
          }
          f.vx=(f.vx-f.dx*springK*dtSim)*drag;
          f.vy=(f.vy-f.dy*springK*dtSim)*drag;
          f.vz=(f.vz-f.dz*springK*dtSim)*drag;
          f.dx+=f.vx*dtSim;f.dy+=f.vy*dtSim;f.dz+=f.vz*dtSim;
          f.excited=Math.max(0,f.excited-dtSim*0.38);
          if(f.excited===0&&Math.abs(f.dx)+Math.abs(f.dy)+Math.abs(f.dz)+Math.abs(f.vx)+Math.abs(f.vy)+Math.abs(f.vz)<.00001){
            f.dx=f.dy=f.dz=f.vx=f.vy=f.vz=0;
          }
          const j=i*4;
          if(f.dx||f.dy||f.dz||f.excited||hs.offsets[j]||hs.offsets[j+1]||hs.offsets[j+2]||hs.offsets[j+3]){
            hs.offsets[j]=f.dx;hs.offsets[j+1]=f.dy;hs.offsets[j+2]=f.dz;hs.offsets[j+3]=f.excited;offsetsChanged=true;
          }
        }
        if(offsetsChanged)hs.geo.attributes.aWake.needsUpdate=true;
      }

      // Start one descent per visit. Its clock keeps running between baskets, including in practice.
      if(w.missionTime<0&&(p>=.24||w.makes>=3))w.missionTime=0;
      if(w.missionTime>=0)w.missionTime+=step;
      const mission=w.missionTime;
      w.lander.visible=mission>=0;
      if(w.lander.visible){
        const landing=THREE.MathUtils.clamp(mission/5.8,0,1);
        const altitude=36*(1-landing)*(1-landing);
        w.lander.position.y=w.landerHome.y+altitude;
        w.flameMat.opacity=landing<1?(.56+.18*Math.sin(t*32))*(1-THREE.MathUtils.smoothstep(landing,.92,1)):0;
        const dust=THREE.MathUtils.smoothstep(landing,.60,.96)*(1-THREE.MathUtils.smoothstep(mission,5.8,8.5));
        w.dustRing.visible=dust>.001;w.dustRingMat.opacity=.43*dust;
        w.dustRing.scale.setScalar(1+3.8*THREE.MathUtils.smoothstep(mission,3.5,8.5));
        w.hatch.rotation.x=1.988*THREE.MathUtils.smoothstep(mission,6,7.65);
      }else{
        w.hatch.rotation.x=0;w.dustRing.visible=false;
      }
      if(mission>=7.65){
        let ball=null;
        if(typeof balls!=="undefined"){
          for(let bi=balls.length-1;bi>=0;bi--){
            if(balls[bi].mesh?.visible){ball=balls[bi].mesh.position;break;}
          }
        }
        w.astronauts.forEach((a,index)=>updateLunarCrew(w,a,index,mission,t,step,ball));
      }

      // C2. 6 台好奇跟球并带阻尼闪避的工业巡检无人机
      if(w.drones){
        const droneIn=THREE.MathUtils.smoothstep(p,0.18,0.44);
        const dtSim=Math.min(0.05,Math.max(0.001,step||1/60));
        const drag=Math.exp(-3.2*dtSim);
        let focusBall=null;
        if(typeof balls!=="undefined"&&Array.isArray(balls)){
          for(let bi=balls.length-1;bi>=0;bi--){
            if(balls[bi]?.mesh?.visible){focusBall=balls[bi].mesh.position;break;}
          }
        }
        for(const dr of w.drones){
          dr.group.visible=droneIn>0.02;
          if(!dr.group.visible)continue;
          dr.vx=(dr.vx-dr.dx*0.95*dtSim)*drag;
          dr.vy=(dr.vy-dr.dy*0.95*dtSim)*drag;
          dr.vz=(dr.vz-dr.dz*0.95*dtSim)*drag;
          dr.dx+=dr.vx*dtSim;dr.dy+=dr.vy*dtSim;dr.dz+=dr.vz*dtSim;
          const dropY=(1-droneIn)*14.0;
          const px=dr.hx+Math.sin(t*0.75+dr.phase)*0.32+dr.dx;
          const py=dr.hy+dropY+Math.sin(t*1.15+dr.phase)*0.22+dr.dy;
          const pz=dr.hz+Math.cos(t*0.65-dr.phase)*0.28+dr.dz;
          dr.group.position.set(px,py,pz);
          if(focusBall)dr.group.lookAt(focusBall.x,focusBall.y,focusBall.z);
          else dr.group.lookAt(HOOP.x,HOOP.y,HOOP.z);
          if(dr.flashT>0){
            dr.flashT=Math.max(0,dr.flashT-dtSim);
            dr.eyeMat.color.setHex(dr.flashT>0.1?0xffc844:0x66e8ff);
          }
        }
      }

      if(w.derrickPlume&&w.plumeMat){
        const plumeOn=THREE.MathUtils.smoothstep(p,0.22,0.45);
        w.plumeMat.opacity=plumeOn*(0.11+0.05*Math.sin(t*1.9));
        w.derrickPlume.scale.set(1+0.12*Math.sin(t*1.2),0.85+0.25*plumeOn,1+0.12*Math.cos(t*1.1));
      }

      // 阶段标记
      const stage=eclipse>0.65?"redEclipse":p>0.38?"landerDescent":p>0.18?"baseAwakening":"apolloDay";
      if(w.stage!==stage){
        w.stage=stage;
        document.documentElement.dataset.environmentPhase=stage;
      }

      // 科考站深空雷达与太阳翼微幅追踪摆动
      if(w.dishPivot)w.dishPivot.rotation.y=Math.sin(t*0.24)*0.65;
      if(w.solarPivot)w.solarPivot.rotation.y=Math.sin(t*0.09)*0.18;
      if(w.cornerBeacons){
        w.cornerBeacons.forEach((m,idx)=>{
          const bp=0.45+0.55*(0.5+0.5*Math.sin(t*2.4+idx*1.57));
          m.color.setRGB((0.32+eclipse*0.58)*bp,(0.82-eclipse*0.44)*bp,(1.0-eclipse*0.65)*bp);
        });
      }
      // 自主巡视六轮月球车沿外围环形山坡道巡航
      if(w.rover&&w.terrainY){
        const u=t*0.055;
        const rx=1.5+Math.sin(u)*11.5;
        const rz=-23.5+Math.cos(u*2.0)*1.8;
        const dx=Math.cos(u)*11.5*0.055;
        const dz=-Math.sin(u*2.0)*3.6*0.055;
        const ry=w.terrainY(rx,rz);
        const ryAhead=w.terrainY(rx+dx*3,rz+dz*3);
        w.rover.position.set(rx,ry,rz);
        w.rover.rotation.y=Math.atan2(dx,dz);
        w.rover.rotation.x=THREE.MathUtils.clamp((ry-ryAhead)*0.45,-0.22,0.22);
        const wheelSpin=t*1.45*(dx>=0?1:-1);
        w.roverWheels.forEach(wg=>{wg.rotation.x=wheelSpin;});
        if(w.roverDish)w.roverDish.rotation.y=Math.sin(t*0.9)*0.75;
        if(w.roverBeaconMat){
          const bp=0.25+0.75*Math.pow(0.5+0.5*Math.sin(t*4.2),2);
          w.roverBeaconMat.color.setRGB(1.0*bp,0.65*bp,0.18*bp);
        }
      }
      if(w.derrickBeaconMat){
        const dp=0.18+0.82*Math.pow(0.5+0.5*Math.sin(t*2.1+0.8),4);
        w.derrickBeaconMat.color.setRGB(1.0*dp,0.52*dp,0.12*dp);
      }
      // 硬核工业轨道空间站沿弧形近月轨道缓慢横越星海 + 实时比分大屏同步 + 偶发流星
      if(w.gateway){
        const gt=((t*0.34+98)%140)/140;
        const orbAng=-0.30+gt*1.42;
        const orbR=66;
        const gx=Math.sin(orbAng)*orbR;
        const gz=-6-Math.cos(orbAng)*orbR;
        w.gateway.position.set(gx,15.6+Math.sin(gt*Math.PI)*2.2,gz);
        // 悬吊巨型比分大屏始终微调朝向球场中心，第三人称/第一人称/各底角均清晰可见
        w.gateway.rotation.y=Math.atan2(-gx,-gz+2)*0.82;
        w.gateway.rotation.z=Math.cos(gt*Math.PI)*0.025;
        w.gateway.rotation.x=0.09+Math.sin(t*0.24)*0.015;
        if(w.gwBeaconMat){
          const gp=0.22+0.78*Math.pow(0.5+0.5*Math.sin(t*4.8),3);
          w.gwBeaconMat.color.setRGB(0.45*gp,0.92*gp,1.0*gp);
        }
        if(w.gwAmberMat){
          const ap=0.22+0.78*Math.pow(0.5+0.5*Math.sin(t*4.8+Math.PI),3);
          w.gwAmberMat.color.setRGB(1.0*ap,0.68*ap,0.18*ap);
        }
        if(w.drawOrbitalBoard&&typeof G!=="undefined"&&G){
          const isBattle=G.mode==="battle";
          const modeTitle=isBattle?"ORBITAL STATION // 100PT BATTLE":G.mode==="contest"?"ORBITAL STATION // 3PT CONTEST":G.mode==="rush"?"ORBITAL STATION // RACK RUSH":"ORBITAL STATION // SEC-07 LIVE";
          const leftLbl="YOU";
          const leftVal=String(Math.max(0,G.score|0)).padStart(2,"0");
          const rightLbl=isBattle?"RIVAL":"STREAK";
          const rightVal=String(Math.max(0,(isBattle?(G.battleOppScore|0):(G.streak|0)))).padStart(2,"0");
          const clk=typeof G.timer==="number"&&isFinite(G.timer)?Math.max(0,G.timer).toFixed(1):"LIVE";
          const key=modeTitle+"|"+leftVal+"|"+rightVal+"|"+clk;
          if(key!==w.orbitalBoardKey){
            w.orbitalBoardKey=key;
            w.drawOrbitalBoard(modeTitle,leftLbl,leftVal,rightLbl,rightVal,clk,eclipse>0.5?"#ff5e36":(isBattle?"#ffbd44":"#5ec8ff"));
          }
        }
      }
      if(w.meteor){
        const cycle=t%13.5;
        if(cycle<0.68){
          const mt=cycle/0.68;
          const idx=Math.floor(t/13.5)%3;
          const sx=idx===0?-28:idx===1?14:-8;
          const sy=idx===0?46:idx===1?52:41;
          w.meteor.visible=true;
          w.meteor.position.set(sx+mt*26,sy-mt*11,-96);
          w.meteorMat.uniforms.uOpacity.value=Math.sin(mt*Math.PI)*0.85;
        }else{
          w.meteor.visible=false;
        }
      }
      return;
    }
    if(w.kind!=="arctic")return;
    w.auroras.forEach(mesh=>{mesh.material.uniforms.time.value=s.time;});
    const a=w.snow.geometry.attributes.position.array;
    for(let i=0;i<w.speed.length;i++){
      const j=i*3,freq=.08+(i%9)*.019,az=i*2.39996;
      const sway=Math.sin(s.time*freq+i*1.71)*.45+Math.cos(s.time*(freq*.67)+i*3.1)*.18;
      a[j]=w.base[j]+Math.cos(az)*sway;
      a[j+1]=((w.base[j+1]-s.time*w.speed[i])%15+15)%15;
      a[j+2]=w.base[j+2]+Math.sin(az)*sway;
    }
    w.snow.geometry.attributes.position.needsUpdate=true;
  }
  window.AIBAWorldWonders={palettes,build,update,lunarImpulse,lunarCelebrate,lunarCrystalMix,resetLunar};
})();
