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
  function lunar(s,b,{batch}){
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
    const tl=new THREE.TextureLoader();
    const regAlbedo=tl.load("assets/lunar/regolith_albedo.jpg");
    regAlbedo.wrapS=regAlbedo.wrapT=THREE.RepeatWrapping;regAlbedo.repeat.set(14,14);
    if(THREE.sRGBEncoding)regAlbedo.encoding=THREE.sRGBEncoding;
    const regBump=tl.load("assets/lunar/regolith_bump.jpg");
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
    const terrain=new THREE.Mesh(tGeo,new THREE.MeshStandardMaterial({
      map:regAlbedo,bumpMap:regBump,bumpScale:.25,
      roughness:.96,metalness:0,vertexColors:true
    }));
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

    // 2.6 等比例（约 7 米高）阿波罗登月舱 (Apollo Lunar Module) + 从登月舱走向球场的脚印
    const lmPos=[-17.5,-20.5],lmY=terrainY(lmPos[0],lmPos[1]);
    const lm=batch();
    // 下降级八边形金箔隔热层主体
    lm.box(0xd6a026,0,2.25,0,3.2,1.65,3.2,0,0,0);
    lm.box(0xc48b1a,0,2.25,0,3.5,1.45,2.2,0,Math.PI/4,0);
    lm.box(0x282b30,0,1.25,0,1.15,.55,1.15); // 下降发动机喷口底座
    lm.add("cone",0x3a3e45,0,.85,0,1.35,.95,1.35,Math.PI,0,0); // 发动机喷管
    // 四条着陆支架 + 圆形着陆脚垫 + 登月梯
    for(let k=0;k<4;k++){
      const ang=Math.PI/4+k*Math.PI/2,cx=Math.cos(ang),cz=Math.sin(ang);
      lm.box(0x9ca2ac,cx*2.25,1.15,cz*2.25,.15,2.65,.15,0,-ang,-0.62); // 主斜撑直连脚垫
      lm.box(0x888e98,cx*1.95,1.68,cz*1.95,.10,1.45,.10,0,-ang,0.78);  // 上拉杆
      lm.box(0xd4a438,cx*3.0,.08,cz*3.0,.92,.12,.92,0,ang,0);           // 着陆脚垫
      if(k===1){
        for(let r=0;r<6;r++)lm.box(0xbac0ca,cx*2.1,.45+r*.36,cz*2.1,.44,.05,.07,0,ang+Math.PI/2,0);
      }
    }
    // 上升级银灰/炭黑乘员舱
    lm.box(0xb8bec8,0,4.15,0,2.7,1.9,2.5);
    lm.box(0x32363e,0,4.25,.85,2.35,1.5,1.2); // 前部深色隔热面板
    lm.box(0x7c8490,0,4.25,-1.15,2.1,1.45,.85); // 后部设备舱
    // 前部两个三角形舷窗
    lm.box(0x162230,-.52,4.42,1.46,.52,.36,.06,0,0,-.22);
    lm.box(0x162230,.52,4.42,1.46,.52,.36,.06,0,0,.22);
    // 顶部对接舱口与 S 波段抛物面天线
    lm.box(0x9aa0aa,0,5.25,0,1.0,.35,1.0);
    lm.box(0x8c929c,.85,5.65,.2,.08,.9,.08);
    lm.add("cone",0xdce0e6,.85,6.1,.35,1.1,.45,1.1,-1.1,0,0);
    // 两侧姿态控制喷口组 (RCS)
    for(const sx of [-1,1]){
      lm.box(0x464a52,sx*1.58,4.35,.4,.42,.42,.42);
      lm.box(0x8c929c,sx*1.82,4.35,.4,.22,.10,.10);
    }
    const lmGrp=new THREE.Group();
    lmGrp.position.set(lmPos[0],lmY,lmPos[1]);lmGrp.rotation.y=.48;lmGrp.name="lunarLander";
    const lmMesh=lm.finish(lmGrp,"lunarLanderMesh");
    if(lmMesh){lmMesh.castShadow=true;lmMesh.receiveShadow=true;}
    s.root.add(lmGrp);

    // 从登月舱走向场边宇航服的月尘脚印链
    const prints=batch();
    for(let i=0;i<18;i++){
      const t=i/17,px=-15.2+t*5.6+Math.sin(i*.4)*.25,pz=-17.8+t*13.8;
      const side=(i%2?1:-1)*.18,py=terrainY(px+side,pz);
      prints.box(0x484b50,px+side,py+.015,pz,.16,.02,.28,0,.35,0);
    }
    prints.finish(s.root,"lunarBootprints");

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
      vertexShader:`varying vec3 vCol;void main(){vCol=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(220.0/max(1.0,-mv.z),1.2,2.6);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vCol;void main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.05,length(d));if(a<.02)discard;gl_FragColor=vec4(vCol,a*.72);}`
    });
    const stars=new THREE.Points(starGeo,starMat);
    stars.name="lunarStars";stars.renderOrder=-10;stars.frustumCulled=false;s.root.add(stars);

    // 4. 远处挂在漆黑宇宙中的蓝色地球（射线球体公告板：永不拉扁、柔和大气晕、大半阴影）
    const earthTex=new THREE.TextureLoader().load("assets/lunar/earth.jpg");
    earthTex.wrapS=THREE.RepeatWrapping;
    if(THREE.sRGBEncoding)earthTex.encoding=THREE.sRGBEncoding;
    const earthMat=new THREE.ShaderMaterial({
      transparent:true,
      depthWrite:false,
      fog:false,
      uniforms:{
        uMap:{value:earthTex},
        uSunDir:{value:new THREE.Vector3(-0.78,0.28,-0.56).normalize()},
        uTime:{value:0}
      },
      vertexShader:`varying vec2 vUv;
        void main(){
          vUv=uv;
          vec4 mvPos=viewMatrix*modelMatrix*vec4(0.0,0.0,0.0,1.0);
          mvPos.xy+=position.xy;
          gl_Position=projectionMatrix*mvPos;
        }`,
      fragmentShader:`uniform sampler2D uMap;uniform vec3 uSunDir;uniform float uTime;
        varying vec2 vUv;
        void main(){
          vec2 p=(vUv*2.0-1.0)/0.72;
          float r2=dot(p,p);
          float r=sqrt(r2);
          float outerDist=max(0.0,r-1.0);
          float halo=exp(-outerDist*8.5)*smoothstep(1.38,1.0,r);
          vec3 N=vec3(p,sqrt(max(0.0,1.0-r2)));
          vec3 L=normalize(uSunDir);
          float ndl=dot(N,L);
          float lit=smoothstep(-0.18,0.34,ndl);
          float rim=pow(1.0-N.z,2.6);
          if(r>1.0){
            float sunSide=smoothstep(-0.45,0.55,dot(normalize(vec3(p,0.0)),L));
            vec3 haloCol=vec3(0.24,0.62,1.0)*halo*(0.06+0.78*sunSide);
            gl_FragColor=vec4(haloCol,halo*(0.08+0.72*sunSide));
            return;
          }
          float lon=atan(N.x,N.z)/6.2831853+0.5+uTime*0.003;
          float lat=asin(clamp(N.y,-0.999,0.999))/3.14159265+0.5;
          vec3 albedo=texture2D(uMap,vec2(fract(lon),lat)).rgb;
          float edgeFade=smoothstep(1.0,0.96,r);
          // 柔和的海面太阳高光与锐利的瑞利蓝大气边缘散射
          vec3 H=normalize(L+vec3(0.0,0.0,1.0));
          float spec=pow(max(dot(N,H),0.0),28.0)*0.22*lit;
          vec3 atmo=vec3(0.24,0.64,1.0)*pow(1.0-N.z,3.4)*(0.05+0.95*lit)*1.15;
          vec3 surface=albedo*(0.008+1.26*lit)+vec3(0.75,0.88,1.0)*spec+atmo;
          vec3 col=mix(vec3(0.22,0.60,1.0)*(0.05+0.72*lit),surface,edgeFade);
          float alpha=max(edgeFade,halo*0.85);
          gl_FragColor=vec4(col,clamp(alpha,0.0,1.0));
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    earthMat.map=earthTex;
    const earth=new THREE.Mesh(new THREE.PlaneGeometry(16.5,16.5),earthMat);
    earth.position.set(7.5,18.5,-78);earth.name="lunarEarth";earth.frustumCulled=false;
    s.root.add(earth);
    s.wonder={kind:"lunar",earth,suit1,suit2};
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
    const glassMat=new THREE.MeshBasicMaterial({color:0x7eb8f0,transparent:true,opacity:0.17,depthWrite:false,side:THREE.DoubleSide});
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

    // 3. 东京夜景摩天楼群 + 程序化霓虹窗格贴图
    const winCv=document.createElement("canvas");winCv.width=256;winCv.height=512;
    const wg=winCv.getContext("2d");
    wg.fillStyle="#070b14";wg.fillRect(0,0,256,512);
    for(let row=6;row<504;row+=10){
      const floorLit=s.r();
      if(floorLit<.16)continue;
      for(let col=6;col<248;col+=8){
        const lit=s.r();
        if(lit<.44)continue;
        wg.fillStyle=lit>.93?"#7dd3fc":lit>.83?"#fb7185":lit>.62?"#fde68a":"#fff7ed";
        wg.fillRect(col,row,5,6);
      }
    }
    const winTex=new THREE.CanvasTexture(winCv);
    winTex.wrapS=THREE.RepeatWrapping;winTex.wrapT=THREE.RepeatWrapping;
    winTex.repeat.set(1.5,2.2);
    if(THREE.sRGBEncoding)winTex.encoding=THREE.sRGBEncoding;
    const skyMat=new THREE.MeshBasicMaterial({map:winTex,color:0xdbeafe});

    // 暗色都市大地基底（夜色东京街道底面）
    b.box(0x050811,0,-68,0,520,1,520);

    // 围绕四周的摩天大楼（正前方留出开阔走廊给东京铁塔，两侧与远景高低错落耸立于地平线之上）
    const bldCount=s.mobile?52:84;
    const neonCols=[0x38bdf8,0xf43f5e,0xfbbf24,0x22d3ee];
    for(let i=0;i<bldCount;i++){
      let bx,bz,topY;
      if(i<28){
        // 铁塔左右两侧纵深天际线（高出天台地平线 -2m ~ +24m，形成壮观都市峡谷）
        const side=i%2?1:-1;
        bx=side*(30+s.r()*95);
        bz=-24-s.r()*115;
        topY=-2+s.r()*26;
      }else if(i<56){
        // 球场左右侧高楼群
        const side=i%2?1:-1;
        bx=side*(28+s.r()*90);
        bz=-20+s.r()*68;
        topY=-4+s.r()*22;
      }else{
        // 极远景铁塔背景天际线与后方楼群
        bx=(s.r()-.5)*240;
        bz=i<72?(-118-s.r()*48):(34+s.r()*65);
        topY=-6+s.r()*18;
      }
      const bw=10+s.r()*14,bd=10+s.r()*14,bh=topY+68;
      const bm=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),skyMat);
      bm.position.set(bx,-68+bh*.5,bz);
      s.root.add(bm);
      // 楼顶航空灯或霓虹冠饰
      if(topY>4){
        makeBeacon(bx+bw*.38,topY+.4,bz+bd*.38,i*.7,1.45);
        if(i%4===0){
          const nc=neonCols[i%neonCols.length];
          lampGlow.box(nc,bx,topY-.35,bz+bd*.5+.08,bw*.72,.28,.12);
        }
      }
    }
    lampGlow.finish(s.root,"tokyoRooftopFloods",true);

    // 4. 标志性地标：东京铁塔（偏右构图，不被篮筐遮挡，红白钢架 + 暖金/橙红夜间照明 + 展望台 + 塔尖）
    const tx=19.5,tz=-82,tBase=-48;
    const towerGlow=batch();
    const tiers=13,H=86;
    const halfAt=u=>13.0*Math.pow(1-u,1.52)+1.15;
    for(let k=0;k<tiers;k++){
      const u0=k/tiers,u1=(k+1)/tiers,um=(u0+u1)*.5;
      const y0=tBase+u0*H,y1=tBase+u1*H,ym=(y0+y1)*.5;
      const w0=halfAt(u0),w1=halfAt(u1),wm=(w0+w1)*.5;
      const red=k%2===0;
      const col=red?0xeb3f25:0xf3f5f8;
      const segH=(y1-y0)+.25,tilt=Math.atan2(w0-w1,y1-y0);
      // 四根倾斜钢骨主腿
      for(const sx of [-1,1])for(const sz of [-1,1]){
        b.box(col,tx+sx*wm,ym,tz+sz*wm,.48,segH,.48,sz*tilt,0,-sx*tilt);
        // 内侧暖橙夜间投光高亮筋
        towerGlow.box(red?0xff6e30:0xffbe76,tx+sx*(wm-.22),ym,tz+sz*(wm-.22),.2,segH*.94,.2,sz*tilt,0,-sx*tilt);
      }
      // 水平横梁与交叉斜撑
      b.box(col,tx,y1,tz-w1,w1*2,.34,.34);
      b.box(col,tx,y1,tz+w1,w1*2,.34,.34);
      b.box(col,tx-w1,y1,tz,.34,.34,w1*2);
      b.box(col,tx+w1,y1,tz,.34,.34,w1*2);
      if(k<tiers-1){
        const diag=Math.hypot(wm*1.9,y1-y0),ang=Math.atan2(wm*1.9,y1-y0);
        b.box(col,tx,ym,tz+wm,.18,diag,.18,0,0,ang);
        b.box(col,tx,ym,tz+wm,.18,diag,.18,0,0,-ang);
      }
    }
    // 大展望台 (Main Deck) & 特别展望台 (Top Deck)
    const mainY=tBase+52,topY=tBase+71;
    b.box(0x28303e,tx,mainY,tz,8.0,3.2,8.0);
    towerGlow.box(0xffc966,tx,mainY,tz,8.25,1.5,8.25);
    towerGlow.box(0x7dd3fc,tx,mainY+1.0,tz,8.15,.35,8.15);
    b.box(0x28303e,tx,topY,tz,4.2,2.4,4.2);
    towerGlow.box(0xffd27a,tx,topY,tz,4.45,1.0,4.45);
    // 顶部红白避雷针天线 + 塔尖航空红灯
    for(let a=0;a<4;a++){
      const ay=tBase+H+a*5.5+2.75;
      b.box(a%2?0xf3f5f8:0xeb3f25,tx,ay,tz,.55-.08*a,5.6,.55-.08*a);
      towerGlow.box(0xff8c42,tx,ay,tz,.6-.08*a,5.2,.6-.08*a);
    }
    towerGlow.finish(s.root,"tokyoTowerGlow",true);
    makeBeacon(tx,tBase+H+22.4,tz,0,2.1);

    // 5. 首都高架桥 + 流动红白车流光轨
    b.box(0x131822,0,-46.5,-44,240,.8,5.2);
    const traffic=[];
    const tCount=s.mobile?18:32;
    for(let i=0;i<tCount;i++){
      const dir=i%2?1:-1;
      const tm=new THREE.Mesh(
        new THREE.BoxGeometry(1.7,.22,.32),
        new THREE.MeshBasicMaterial({color:dir>0?0xff3b30:0xf8fafc})
      );
      const startX=-115+i*(230/tCount);
      tm.position.set(startX,-45.95,dir>0?-42.8:-45.2);
      s.root.add(tm);
      traffic.push({m:tm,baseX:startX,dir,speed:14+(i%5)*3.2});
    }

    // 6. 远方东京湾与彩虹大桥剪影（左远景）
    b.box(0x061020,-75,-56,-145,140,.4,40);
    b.box(0x1f2a3c,-75,-46,-145,84,.55,1.4);
    for(const pxOff of [-22,22]){
      b.box(0xdbeafe,-75+pxOff,-43,-145,1.1,16,1.1);
    }
    const bridgeGlow=batch();
    bridgeGlow.box(0xe0f2fe,-75,-45.6,-145,84,.25,1.5);
    bridgeGlow.finish(s.root,"tokyoRainbowBridge",true);

    s.wonder={kind:"tokyo",beacons,traffic};
  }
  function build(s,b,helpers){if(s.name==="arcticSnow")arctic(s,b,helpers);else if(s.name==="spanishQuarter")spanish(s,b,helpers);else if(s.name==="lunarCrater")lunar(s,b,helpers);else if(s.name==="tokyoRooftop")tokyo(s,b,helpers);}
  function update(s){
    const w=s.wonder;if(!w)return;
    if(w.kind==="tokyo"){
      const t=s.time;
      w.beacons.forEach(b=>{
        const p=.22+.78*(.5+.5*Math.sin(t*3.1+b.phase));
        b.mat.color.setRGB(1.0*p,.16*p,.12*p);
      });
      w.traffic.forEach(tr=>{
        const span=236;
        tr.m.position.x=((tr.baseX+tr.dir*tr.speed*t+118)%span+span)%span-118;
      });
      return;
    }
    if(w.kind==="lunar"){
      w.earth.material.uniforms.uTime.value=s.time;
      if(w.suit2)w.suit2.visible=(typeof G!=="undefined"&&!!G&&G.mode==="battle");
      return;
    }
    if(w.kind!=="arctic")return;
    w.auroras.forEach(mesh=>{mesh.material.uniforms.time.value=s.time;});
    const a=w.snow.geometry.attributes.position.array;
    for(let i=0;i<w.speed.length;i++){const j=i*3;a[j]=w.base[j]+Math.sin(s.time*.15+i)*.65;a[j+1]=((w.base[j+1]-s.time*w.speed[i])%15+15)%15;a[j+2]=w.base[j+2]+Math.sin(s.time*.1+i*.7)*.25;}
    w.snow.geometry.attributes.position.needsUpdate=true;
  }
  window.AIBAWorldWonders={palettes,build,update};
})();
