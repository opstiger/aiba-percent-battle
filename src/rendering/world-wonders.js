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
    earth.position.set(23,19.5,-78);earth.name="lunarEarth";earth.frustumCulled=false;
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

    function elevation(x,z){
      const along=z-COURT.midZ,r=Math.hypot(x,along);
      const clearance=Math.hypot(Math.max(0,Math.abs(x)-13),Math.max(0,Math.abs(along)-19));
      const waves=Math.sin(x*.043+z*.047)+.63*Math.cos(z*.091-x*.037)+.24*Math.sin(x*.183-z*.137);
      const shoulder=8.8*Math.exp(-((x+51)**2/1560+(along+57)**2/5500))
        +11.8*Math.exp(-((x-82)**2/2300+(along+32)**2/8200));
      // The far foot of the meadow drops below the rock layers, outside the tree and flower belts.
      const foothill=smooth(r,126,184);
      return -.025+smooth(clearance,1,16)*((waves*(1.5+Math.min(r/82,2.3))+shoulder)*(1-foothill)-4.7*foothill);
    }

    function courtMarks(){
      const canvas=document.createElement("canvas");canvas.width=1536;canvas.height=1728;
      const g=canvas.getContext("2d"),width=bounds.halfWidth*2,depth=bounds.maxZ-bounds.minZ;
      g.scale(canvas.width/width,canvas.height/depth);g.translate(bounds.halfWidth,-bounds.minZ);
      const {nearBaseline:near,farBaseline:far,halfWidth,midZ}=COURT;
      const line=(x,z,x2,z2)=>{g.beginPath();g.moveTo(x,z);g.lineTo(x2,z2);g.stroke();};
      const circle=(z,r,a=0,b=tau)=>{g.beginPath();g.arc(0,z,r,a,b);g.stroke();};
      g.strokeStyle="#f2e9cc";g.lineCap="round";
      g.globalAlpha=.73;g.lineWidth=.061;g.setLineDash([2.1,.024,1.03,.068,.84,.042]);
      g.strokeRect(-halfWidth,near,COURT.width,far-near);
      line(-halfWidth,midZ,halfWidth,midZ);circle(midZ,1.8);
      for(const [z,baseline,dir] of [[HOOP.z,near,1],[COURT.farHoopZ,far,-1]]){
        const turn=dir===1?0:Math.PI,free=baseline+dir*5.79;
        g.globalAlpha=.65;g.lineWidth=.055;g.setLineDash([1.22,.055,1.6,.040]);
        g.strokeRect(-2.45,Math.min(baseline,free),4.9,5.79);
        circle(free,1.8,turn,turn+Math.PI);
        g.setLineDash([.15,.13]);circle(free,1.8,turn+Math.PI,turn+tau);
        g.setLineDash([.86,.045,1.2,.039]);circle(z,1.22,turn,turn+Math.PI);
        const arcR=7.24,sideX=6.71,angle=Math.acos(sideX/arcR);
        const join=z+dir*Math.sqrt(arcR*arcR-sideX*sideX);
        g.globalAlpha=.84;g.lineWidth=.071;g.setLineDash([2.3,.051,1.8,.043,.89,.036]);
        circle(z,arcR,turn+angle,turn+Math.PI-angle);
        for(const side of [-1,1]){
          line(side*sideX,baseline,side*sideX,join);
          g.globalAlpha=.64;g.lineWidth=.052;
          for(const lane of [2.13,2.44,3.35,4.27]){
            const az=baseline+dir*lane;line(side*2.45,az,side*2.73,az);
          }
          g.globalAlpha=.84;g.lineWidth=.071;
        }
      }
      const map=new THREE.CanvasTexture(canvas);map.name="placeSurface:flowerCourt";
      map.encoding=THREE.sRGBEncoding;map.anisotropy=Math.min(6,renderer.capabilities.getMaxAnisotropy());
      return map;
    }

    function terrainTexture(file){
      const map=new THREE.TextureLoader().load("assets/meadow/"+file);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.encoding=THREE.sRGBEncoding;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      return map;
    }

    function ground(s){
      const geo=new THREE.PlaneGeometry(560,560,s.mobile?100:152,s.mobile?100:152);
      geo.rotateX(-Math.PI/2);
      const p=geo.attributes.position,c=[],shade=new THREE.Color();
      const low=linear(0x546d39),light=linear(0x819c4b),cool=linear(0x486841);
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i)+COURT.midZ;
        p.setXYZ(i,x,elevation(x,z),z);
        const t=.52+.27*Math.sin(x*.045+z*.066)+.15*Math.cos(x*.096-z*.051);
        shade.copy(low).lerp(light,t).lerp(cool,.22+.17*Math.sin(x*.031-z*.089));
        c.push(shade.r,shade.g,shade.b);
      }
      geo.setAttribute("color",new THREE.Float32BufferAttribute(c,3));geo.computeVertexNormals();
      const mat=new THREE.MeshLambertMaterial({vertexColors:true,map:courtMarks()});
      const grass=terrainTexture("leafy-grass.jpg");
      mat.addEventListener("dispose",()=>{
        grass.dispose();
        s.meadow.drifts.coverage.dispose();
      });
      mat.onBeforeCompile=shader=>{
        shader.uniforms.grassDetail={value:grass};
        shader.uniforms.flowerCover={value:s.meadow.drifts.coverage};
        shader.uniforms.fieldProgress=s.meadow.drifts.bloom;
        shader.vertexShader="varying vec2 vMeadowXZ;\n"+shader.vertexShader.replace(
          "#include <begin_vertex>","#include <begin_vertex>\nvMeadowXZ = position.xz;"
        );
        shader.fragmentShader="varying vec2 vMeadowXZ;\nuniform sampler2D grassDetail;\nuniform sampler2D flowerCover;\nuniform float fieldProgress;\n"+shader.fragmentShader.replace("#include <map_fragment>",`
          vec2 m = vMeadowXZ;
          vec2 uvMarks = vec2(m.x/32.0+0.5, 1.0-(m.y+13.0)/36.0);
          vec4 chalk = mapTexelToLinear(texture2D(map, uvMarks));
          vec2 bladesUV = (mat2(0.91,-0.41,0.41,0.91)*m) * 0.48;
          vec3 blades = mapTexelToLinear(texture2D(grassDetail, bladesUV)).rgb;
          vec3 patches = mapTexelToLinear(texture2D(grassDetail, m*0.085+vec2(0.26,0.31))).rgb;
          float fine = dot(blades,vec3(0.22,0.70,0.08));
          float coarse = dot(patches,vec3(0.22,0.70,0.08));
        `).replace("#include <color_fragment>",`
          #include <color_fragment>
          vec2 clearing = abs(vec2((m.x+0.34*sin(m.y*.53))/7.9,(m.y-4.75+0.53*sin(m.x*.58))/14.9));
          float worn = (1.0-smoothstep(0.68,1.31,max(clearing.x,clearing.y))) * (0.48+coarse*.32);
          float closeGrain = 1.0-smoothstep(25.0,115.0,length(cameraPosition.xz-m));
          diffuseColor.rgb *= 0.77 + coarse*1.72 + (fine-.095)*1.16*closeGrain;
          diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.205,0.191,0.111),worn);
          vec2 fromCenter=m-vec2(0.0,4.745);
          vec2 flowersUV=vec2(fromCenter.x,-fromCenter.y)/232.0+0.5;
          vec4 drift=mapTexelToLinear(texture2D(flowerCover,flowersUV));
          float wake=clamp(.095+(length(fromCenter)-16.0)/101.0,.10,.84);
          float flowering=smoothstep(wake+.025,wake+.15,fieldProgress);
          float farCover=smoothstep(6.0,24.0,length(cameraPosition.xz-m));
          diffuseColor.rgb=mix(diffuseColor.rgb,drift.rgb*.79,drift.a*flowering*farCover*.61);
          diffuseColor.rgb = mix(diffuseColor.rgb,chalk.rgb,chalk.a);
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
      const skyline=far?[
        [-Math.PI,48],[-2.85,59],[-2.62,67],[-2.25,50],[-2.02,62],[-1.75,50],[-1.39,66],
        [-1.05,53],[-.84,61],[-.70,70],[-.58,81],[-.49,74],[-.40,82],[-.28,105],
        [-.15,124],[-.076,109],[.018,92],[.13,86],[.23,90],[.34,78],[.54,60],
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
      const normals=geo.getAttribute("normal"),sunward=new THREE.Vector3(-.88,.26,.41).normalize();
      for(let i=0;i<normals.count;i++){
        const a=angle[i%(cols+1)],y=positions[i*3+1],ny=normals.getY(i);
        const snowLine=(far?46:34)+6*Math.sin(a*9+.8)+3.5*Math.sin(a*22);
        const alpine=smooth(y,snowLine-22,snowLine+28);
        // Snow settles in bowls and chutes above the tree line. Convex, steep ribs stay exposed even at the summit.
        const retention=alpine*(.29+.49*smooth(ny,.23,.87)+.35*deposition[i]);
        const sunFace=normals.getX(i)*sunward.x+ny*sunward.y+normals.getZ(i)*sunward.z;
        const daylight=.50+.50*Math.max(0,-.39*normals.getX(i)+.74*ny+.55*normals.getZ(i));
        exposure.push(retention,sunFace,daylight,smooth(y,far?36:34,far?91:62));
      }
      geo.setAttribute("rockExposure",new THREE.Float32BufferAttribute(exposure,4));
      const mesh=new THREE.Mesh(geo,material);
      mesh.name=far?"alpineFarSnowPeaks":"alpineNearRidges";s.root.add(mesh);
    }

    function spruceForest(s){
      const p=[],colors=[],seg=s.mobile?8:11;
      const dark=linear(0x30483c),tipColor=linear(0x5a7250),c=new THREE.Color();
      for(let tier=0;tier<6;tier++){
        const y=.13+tier*.135,width=.26*(1-tier*.142),turn=tier*.63;
        for(let j=0;j<seg;j++){
          const rim=(k,outer)=>{
            const a=k/seg*tau+turn,gap=k%2===0?1:.62;
            const r=width*gap*(.86+.14*Math.cos(k*3.7+tier))*(outer?1:.58);
            return [.019*tier+Math.cos(a)*r,y+(outer?(1-gap)*.12:.123),Math.sin(a)*r];
          };
          const tip=[.021*tier,y+.255,0],a=rim(j,true),b=rim(j+1,true),m=rim(j,false),n=rim(j+1,false);
          p.push(...m,...b,...a,...m,...n,...b,...tip,...n,...m);
          c.copy(dark).lerp(tipColor,.26+.68*(Math.cos(j/seg*tau+turn)*.5+.5));
          for(let k=0;k<9;k++)colors.push(c.r,c.g,c.b);
        }
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
      geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
      const forest=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),s.mobile?295:580);
      const tree=new THREE.Object3D(),tone=new THREE.Color();
      const ridges=[[-1.04,61,17],[-.68,82,23],[.35,67,14],[.71,86,23],[1.59,82,31],[-1.81,78,23],[2.7,88,30],[-2.66,97,32]];
      for(let i=0;i<forest.count;i++){
        const [heading,radius,width]=ridges[i%ridges.length],r=radius+(s.r()-.5)*31;
        const a=heading+(s.r()+s.r()-1)*width/r;
        const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r,h=4.2+6.9*Math.pow(s.r(),1.45);
        tree.position.set(x,elevation(x,z)-.14*h,z);
        tree.rotation.set(0,s.r()*tau,0);
        tree.scale.set(h*(.68+s.r()*.4),h,h*(.68+s.r()*.4));tree.updateMatrix();
        forest.setMatrixAt(i,tree.matrix);
        tone.setScalar(.63+.37*s.r());forest.setColorAt(i,tone);
      }
      forest.name="alpineSpruceBelts";forest.frustumCulled=false;s.root.add(forest);
    }

    function meadowGrass(s){
      const positions=[],indices=[];
      for(let blade=0;blade<4;blade++){
        const a=blade*2.4,dx=Math.sin(a),dz=Math.cos(a),start=positions.length/3;
        for(let row=0;row<=4;row++){
          const t=row/4,h=(.66+blade*.095)*t,lean=.32*t*t,w=.075*Math.pow(1-t,.66);
          for(const side of [-1,1])positions.push(dx*(.035+lean)+dz*w*side,h,dz*(.035+lean)-dx*w*side);
          if(row<4){const k=start+row*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
        }
      }
      const geo=new THREE.BufferGeometry();geo.setIndex(indices);geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
      const mat=new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),time={value:0};
      mat.onBeforeCompile=shader=>{
        shader.uniforms.meadowTime=time;
        shader.vertexShader="uniform float meadowTime;\n"+shader.vertexShader.replace("#include <begin_vertex>",`
          #include <begin_vertex>
          vec2 root = instanceMatrix[3].xz;
          float wind = 0.12*sin(meadowTime*1.55-root.x*.27-root.y*.12)+0.063*sin(meadowTime*2.1+root.y*.65);
          transformed.x += wind * position.y * position.y;
          transformed.z += wind * position.y * position.y * 0.52;
        `);
      };
      const mesh=new THREE.InstancedMesh(geo,mat,s.mobile?270:530),dummy=new THREE.Object3D(),color=new THREE.Color();
      const green=[0x6b8a47,0x778e4d,0x829c55,0x53783e,0xa1aa69];
      for(let i=0;i<mesh.count;i++){
        const a=s.r()*tau,r=9.5+30*Math.pow(s.r(),1.8);
        let x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        if(Math.abs(x)<8.15&&z>-10.1&&z<19.65)x=Math.sign(x)*8.2;
        const h=.095+s.r()*.28;
        dummy.position.set(x,elevation(x,z),z);dummy.rotation.y=s.r()*tau;
        dummy.scale.set(h,h,h);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        mesh.setColorAt(i,color.set(green[i%green.length]).convertSRGBToLinear());
      }
      mesh.name="alpineSwayingGrass";mesh.frustumCulled=false;s.root.add(mesh);
      s.meadowWind=time;
    }

    function meadowWeather(s){
      const phase={value:new THREE.Vector2(0,0)},time={value:0};
      const skyMat=new THREE.ShaderMaterial({
        side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{phase,time},
        vertexShader:`
          varying vec3 vDirection;
          void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
        `,
        fragmentShader:`
          varying vec3 vDirection;
          uniform vec2 phase;
          uniform float time;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){
            vec2 n=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(hash(n),hash(n+vec2(1.0,0.0)),f.x),mix(hash(n+vec2(0.0,1.0)),hash(n+vec2(1.0)),f.x),f.y);
          }
          float clouds(vec2 p){return .56*noise(p)+.30*noise(p*2.1)+.14*noise(p*4.33);}
          void main(){
            vec3 ray=normalize(vDirection);
            float height=max(0.0,ray.y),haze=pow(1.0-height,3.0);
            vec2 p=ray.xz/(0.26+height)*1.25+vec2(time*.026,time*.012);
            float cover=clouds(p+vec2(3.0,13.4));
            float fringe=clouds(p+vec2(-.16,.18)+vec2(3.0,13.4));
            float edge=mix(.41,.705,phase.x);
            float alpha=smoothstep(edge,edge+.117,cover)*smoothstep(-.035,.12,ray.y);
            vec3 blue=mix(vec3(.066,.246,.49),vec3(.46,.66,.78),haze);
            blue=mix(blue,vec3(.39,.51,.59),.38*(1.0-phase.x));
            float glint=pow(max(0.0,dot(ray,normalize(vec3(-.86,.21,.37)))),12.0);
            vec3 evening=mix(vec3(.030,.085,.112),vec3(.105,.205,.245),haze);
            blue=mix(blue,evening,phase.y*.83);
            blue=mix(blue,vec3(.43,.26,.16),phase.y*.25*glint);
            vec3 cloud=mix(vec3(.51,.59,.66),vec3(.93,.94,.92),smoothstep(.45,.7,cover+(cover-fringe)));
            cloud=mix(cloud,cloud*vec3(.70,.73,.80),phase.y*.67);
            cloud=mix(cloud,vec3(.94,.67,.46),phase.y*.20*glint);
            gl_FragColor=vec4(mix(blue,cloud,alpha),1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }
        `
      });
      const sky=new THREE.Mesh(new THREE.SphereGeometry(485,32,20),skyMat);
      sky.name="alpineCloudSky";sky.position.z=COURT.midZ;sky.frustumCulled=false;sky.renderOrder=-990;s.root.add(sky);
      return {phase,time,progress:0,cloudSun:new THREE.Color(0xe4edf0),daySun:new THREE.Color(0xffefcf),
        peakSun:new THREE.Color(0xffc17f),blueFog:new THREE.Color(0xa8c4d0),goldFog:new THREE.Color(0x879cad)};
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
          gradient.addColorStop(0,`rgba(${r},${gc},${b},.43)`);
          gradient.addColorStop(.35,`rgba(${r},${gc},${b},.29)`);
          gradient.addColorStop(1,`rgba(${r},${gc},${b},0)`);
          g.fillStyle=gradient;g.fillRect(0,0,24,24);brushes.set(item.tint,brush);
        }
        const u=(item.x+116)*density,v=(item.z-COURT.midZ+116)*density;
        const spread=(1.45+item.size*.82)*density;
        paint.drawImage(brush,u-spread,v-spread*.64,spread*2,spread*1.28);
      }
      const map=new THREE.CanvasTexture(canvas);map.encoding=THREE.sRGBEncoding;
      return map;
    }

    function distantFlowers(s,weather){
      const verts=[],colors=[],stem=linear(0x4b7036),petal=linear(0xffffff),center=linear(0xebbf48);
      const triangle=(a,b,c,color)=>{
        verts.push(...a,...b,...c);
        for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
      };
      for(const [x,z,h,r] of [[-.23,-.10,.39,.104],[.20,.21,.52,.115],[.06,-.17,.64,.100]]){
        triangle([x*.45,0,z*.40],[x,h,z],[x+.021,h,z],stem);
        const tip=[x,h,z];
        for(let i=0;i<6;i++){
          const arc=i*tau/6,next=(i+1)*tau/6;
          triangle(tip,[x+Math.sin(arc)*r,h+(.28+.19*Math.cos(arc))*r,z+Math.cos(arc)*r],
            [x+Math.sin(next)*r,h+(.28+.19*Math.cos(next))*r,z+Math.cos(next)*r],petal);
        }
        triangle([x-.02,h+.008,z-.017],[x+.022,h+.008,z-.017],[x,h+.015,z+.026],center);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
      const groups=[[-1.15,27,8],[-.61,30,13],[.41,25,11],[.82,43,16],[-.41,49,12],[.26,59,16],
        [.72,77,15],[-.68,74,19],[-1.56,50,16],[1.51,59,24],[2.05,36,19],[-2.05,34,18],[2.70,56,26],[-2.7,58,21],
        [-.18,77,16],[.16,92,17],[-.97,96,20],[.97,96,20],[2.7,92,24],[-2.57,91,24]];
      const instances=[],targets=[],tints=[0xf6e7b0,0xe073a5,0xb993dd,0xffd344,0xf8eeda,0xf598ac],total=s.mobile?2780:5350;
      for(let i=0;i<total;i++){
        const [heading,rad,width]=groups[i%groups.length];
        const r=rad+(s.r()+s.r()-1)*width,a=heading+(s.r()+s.r()-1)*width/r;
        const x=Math.sin(a)*r,z=COURT.midZ-Math.cos(a)*r;
        if(Math.abs(x)<14.2&&z>COURT.floorMinZ-4&&z<COURT.floorMaxZ+4)continue;
        instances.push({x,z,yaw:s.r()*tau,size:(.67+.46*s.r())*(1+smooth(r,29,74)*.54),tint:tints[(i%groups.length+(i%7===0?1:0))%tints.length],
          when:THREE.MathUtils.clamp(.095+(r-16)/101+s.r()*.15,.10,.90)});
      }
      instances.sort((a,b)=>a.when-b.when);
      const mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,emissive:0xdcd2a4,emissiveIntensity:.035});
      const bloom={value:0};
      mat.onBeforeCompile=shader=>{
        shader.uniforms.meadowTime=weather.time;shader.uniforms.meadowBloom=bloom;
        shader.vertexShader="uniform float meadowTime;\nuniform float meadowBloom;\nattribute float bloomStart;\n"+
          shader.vertexShader.replace("#include <begin_vertex>",`
            #include <begin_vertex>
            vec2 root=instanceMatrix[3].xz;
            float wind=sin(meadowTime*1.27-root.x*.23-root.y*.125)*.15;
            transformed.x+=wind*position.y*position.y;
            transformed.z+=wind*.53*position.y*position.y;
            transformed*=max(.001,smoothstep(bloomStart,bloomStart+.095,meadowBloom));
          `);
      };
      const mesh=new THREE.InstancedMesh(geo,mat,instances.length),dummy=new THREE.Object3D(),color=new THREE.Color();
      instances.forEach((d,i)=>{
        dummy.position.set(d.x,elevation(d.x,d.z)-.012,d.z);dummy.rotation.y=d.yaw;
        dummy.scale.set(d.size,d.size,d.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        mesh.setColorAt(i,color.set(d.tint).convertSRGBToLinear());
        targets.push(d.when);
      });
      geo.setAttribute("bloomStart",new THREE.InstancedBufferAttribute(new Float32Array(targets),1));
      mesh.name="alpineWildflowerDrifts";mesh.frustumCulled=false;mesh.count=0;s.root.add(mesh);
      return {mesh,targets,bloom,coverage:driftCoverage(instances)};
    }

    function updateMeadow(s){
      const weather=s.meadow,p=weather.progress;
      const clear=smooth(p,.12,.71),gold=smooth(p,.71,.98);
      weather.phase.value.set(clear,gold);weather.time.value=s.time;
      const drifts=weather.drifts;
      drifts.bloom.value=p;
      while(drifts.mesh.count<drifts.targets.length&&drifts.targets[drifts.mesh.count]<p)drifts.mesh.count++;
      while(drifts.mesh.count>0&&drifts.targets[drifts.mesh.count-1]>=p)drifts.mesh.count--;
      ambient.intensity=.56-.16*clear+.018*gold;
      hemi.intensity=.56-.07*clear;
      sun.intensity=.34+.76*clear-.12*gold;
      sun.position.set(-22-11*gold,32-17*gold,14+6*gold);
      sun.color.copy(weather.cloudSun).lerp(weather.daySun,clear).lerp(weather.peakSun,gold);
      scene.fog.color.copy(weather.blueFog).lerp(weather.goldFog,gold*.57);
      document.documentElement.dataset.environmentPhase=gold>.34?"golden-peaks":clear>.18?"clearing":"cloudy";
      document.documentElement.dataset.flowerMeadow=String(drifts.mesh.count*3);
    }

    function buildMeadow(s){
      s.heightAt=elevation;
      s.meadow=meadowWeather(s);
      ground(s);
      const rock=terrainTexture("alpine-rock.jpg");
      const mountain=new THREE.MeshBasicMaterial({map:rock,side:THREE.DoubleSide});
      mountain.onBeforeCompile=shader=>{
        shader.uniforms.meadowPhase=s.meadow.phase;
        shader.uniforms.peakRock={value:linear(0x596471)};
        shader.uniforms.peakSnow={value:linear(0xd2dde3)};
        shader.uniforms.peakShade={value:linear(0x435b77)};
        shader.uniforms.peakAmber={value:linear(0xff9e46)};
        shader.vertexShader="attribute vec4 rockExposure;\nvarying vec4 vRockExposure;\n"+
          shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvRockExposure=rockExposure;");
        shader.fragmentShader=`uniform vec2 meadowPhase;
          uniform vec3 peakRock,peakSnow,peakShade,peakAmber;
          varying vec4 vRockExposure;
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
          float face=vRockExposure.y;
          float light=smoothstep(.065,.33,face+.15*(weathering-.28))*vRockExposure.w;
          vec3 day=terrain*vRockExposure.z*mix(.9,1.04,meadowPhase.x);
          vec3 shadow=terrain*vec3(.35,.46,.69)+peakShade*.22;
          vec3 amber=terrain*vec3(1.14,.59,.32)+peakAmber*(.28+.27*ice+.28*grain);
          vec3 sunset=mix(shadow,amber,light);
          diffuseColor.rgb=mix(day,sunset,meadowPhase.y);
        `);
      };
      mountainRange(s,true,mountain);mountainRange(s,false,mountain);
      spruceForest(s);meadowGrass(s);
      s.meadow.drifts=distantFlowers(s,s.meadow);
      updateMeadow(s);
    }
    return {build:buildMeadow,update:updateMeadow};
  })();
  function build(s,b,helpers){if(s.name==="flowerCourt")meadow.build(s);else if(s.name==="arcticSnow")arctic(s,b,helpers);else if(s.name==="spanishQuarter")spanish(s,b,helpers);else if(s.name==="lunarCrater")lunar(s,b,helpers);else if(s.name==="tokyoRooftop")tokyo(s,b,helpers);}
  function update(s){
    if(s.meadow)meadow.update(s);
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
