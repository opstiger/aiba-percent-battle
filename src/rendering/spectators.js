/* near-court crowd: active basket side only, varied shapes and behavior */
const nearCourtCrowd={root:null,people:[],reaction:0,miss:0,last:"idle"};
function miniSignTex(txt,bg,fg){
  return pixTex(160,76,(g)=>{
    g.fillStyle=bg;g.fillRect(0,0,160,76);
    g.strokeStyle=fg;g.globalAlpha=.68;g.lineWidth=5;g.strokeRect(5,5,150,66);
    g.globalAlpha=1;g.fillStyle=fg;g.font="bold 28px Orbitron, monospace";
    g.textAlign="center";g.textBaseline="middle";g.fillText(txt,80,39);
  },{smooth:true});
}
function makeNearCourtPerson(parent,cube,cfg,mats){
  const g=new THREE.Group(),skin=mats.skin[cfg.skin%mats.skin.length],hair=mats.hair[cfg.hair%mats.hair.length];
  const shirt=cfg.kind==="cheer"?mats.cheer[cfg.shirt%mats.cheer.length]:mats.shirts[cfg.shirt%mats.shirts.length];
  const pants=cfg.kind==="cheer"?mats.cheerPants:mats.pants[cfg.pants%mats.pants.length],shoe=mats.shoes[cfg.shoe%mats.shoes.length];
  const hype=cfg.kind==="hype"||cfg.kind==="cheer",scale=cfg.scale||1;
  /* 躯干/头/帽/腿/鞋原本各自一个 Mesh(且只做 ±5° 的呼吸式微动),烘焙成单个带顶点色的
     身体网格:整体前倾代替各部件微动,手臂与道具仍然独立驱动,观感几乎无差别。 */
  const bodyParts=[
    {color:shirt.color,pos:[0,.9,0],scale:[.42,.72,.25]},
    {color:skin.color,pos:[0,1.48,-.02],scale:[.31,.31,.28]},
    {color:hair.color,pos:[0,1.66,-.03],scale:[.34,.12,.3]},
    {color:pants.color,pos:[-.13,.38,0],scale:[.13,.64,.13]},
    {color:pants.color,pos:[.13,.38,0],scale:[.13,.64,.13]},
    {color:shoe.color,pos:[-.13,.08,-.04],scale:[.18,.11,.24]},
    {color:shoe.color,pos:[.13,.08,-.04],scale:[.18,.11,.24]}
  ];
  if(cfg.kind==="cheer")bodyParts.push({color:shirt.color,pos:[0,.58,0],scale:[.52,.18,.27]});
  const body=bakeVoxelMesh(g,bodyParts);
  const armL=showBox(g,cube,skin,-.34,1.05,-.02,.1,.52,.11);
  const armR=showBox(g,cube,skin,.34,1.05,-.02,.1,.52,.11);
  armL.rotation.z=hype?-.45:-.08;armR.rotation.z=hype?.45:.08;
  let phone=null,sign=null,prop=null,pomL=null,pomR=null;
  if(cfg.kind==="filmer"){
    phone=showBox(g,cube,mats.phone,.42,1.3,-.22,.18,.25,.04);
    armR.rotation.x=-.95;armR.rotation.z=-.28;
  }else if(cfg.kind==="heckler"){
    sign=new THREE.Mesh(new THREE.PlaneGeometry(.98,.46),new THREE.MeshBasicMaterial({
      map:mats.signs[cfg.sign%mats.signs.length],transparent:true,side:THREE.DoubleSide
    }));
    sign.position.set(0,1.74,-.3);g.add(sign);
    armL.rotation.z=-.5;armR.rotation.z=.5;armL.rotation.x=armR.rotation.x=-.35;
  }else if(cfg.kind==="cheer"){
    pomL=showBox(g,cube,mats.pomA,-.47,1.3,-.02,.22,.22,.22);
    pomR=showBox(g,cube,mats.pomB,.47,1.3,-.02,.22,.22,.22);
  }else if(cfg.kind==="distract"){
    prop=showBox(g,cube,mats.towel,.45,1.32,-.04,.12,.62,.08);
    armR.rotation.z=.58;armR.rotation.x=-.28;
  }else if(cfg.kind==="player"){
    prop=showBox(g,cube,mats.ball,-.45,1.05,-.1,.22,.22,.22);
    armL.rotation.z=-.56;armR.rotation.z=.18;
  }
  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(scale);
  parent.add(g);
  nearCourtCrowd.people.push({g,body,arms:[armL,armR],phone,sign,prop,poms:[pomL,pomR],
    kind:cfg.kind,base:V3(cfg.x,0,cfg.z),baseRot:cfg.rot,axis:cfg.axis||V3(0,0,0),move:cfg.move||0,
    phase:cfg.phase,amp:cfg.amp||1});
}
function buildNearCourtCrowd(){
  nearCourtCrowd.root=null;nearCourtCrowd.people.length=0;nearCourtCrowd.reaction=0;nearCourtCrowd.miss=0;
  const root=new THREE.Group();root.name="nearCourtCrowdRoot";scene.add(root);nearCourtCrowd.root=root;
  const cube=new THREE.BoxGeometry(1,1,1),mat=hex=>new THREE.MeshLambertMaterial({color:hex});
  const mats={
    skin:[mat(0xf4c89c),mat(0xd9a066),mat(0x8d5524),mat(0x5f351f)],
    hair:[mat(0x16100d),mat(0x3b2415),mat(0xcaa36a),mat(0x0f1118),mat(0xffffff)],
    /* 配色从"糖果色拼盘"改成中性深色系。原来 9 色里有 5 个高饱和
       (金黄/粉红/浅蓝/紫/纯白),即使过一遍 recede 仍然偏粉偏浅,
       看台读起来像一堆积木而不是观众。
       真实球馆观众的衣服以黑/灰/藏蓝/棕为主,彩色只是零星点缀 ——
       所以这里 6 个中性深色打底,只留暗酒红、暗绿两色点缀,1 个浅灰提亮。
       同时把 recede 从 (.30,.16) 收到 (.18,.08):基础色本来就暗,
       再按原力度压会黑成一团,失去"看得见的人"。
       啦啦队(cheer)保持鲜艳 —— 他们本来就该是画面里的亮色。 */
    shirts:[0x1a1d24,0x2b3038,0x1f2a3a,0x39404d,0x2a2f38,
            0x4a3728,0x3d2b33,0x2f3a2c,0x545b66].map(h=>mat(recede(h,.18,.08))),
    pants:[mat(0x181b24),mat(0x273b59),mat(0x6e727b),mat(0x0d3527),mat(0xffffff),mat(0x2a1d16)],
    shoes:[mat(0xffffff),mat(0x111111),mat(0xff4d6d),mat(0x68e6ff),mat(0xffe36e)],
    cheer:[mat(0xff2f4f),mat(0x21a7ff),mat(0xffc72c),mat(0x7CFC6B)],
    cheerPants:mat(0x10131c),
    phone:mat(0x07131f),
    towel:new THREE.MeshLambertMaterial({color:0xff5bd7,emissive:0xff2aa8,emissiveIntensity:.16}),
    ball:new THREE.MeshLambertMaterial({color:0xf28b22,emissive:0x9a3d00,emissiveIntensity:.08}),
    pomA:new THREE.MeshLambertMaterial({color:0xff4fd8,emissive:0xff4fd8,emissiveIntensity:.2}),
    pomB:new THREE.MeshLambertMaterial({color:0x7CFC6B,emissive:0x7CFC6B,emissiveIntensity:.2}),
    signs:[miniSignTex("MVP","#10131b","#ffd23f"),miniSignTex("BRICK?","#260c12","#ff6b6b"),miniSignTex("LOCK IN","#0c2232","#72dfff"),miniSignTex("AI-BA","#101a13","#7CFC6B")]
  };
  const slots=[
    [-7.2,COURT.nearBaseline-1.55,"filmer"],[-6.05,COURT.nearBaseline-1.7,"hype"],[-4.85,COURT.nearBaseline-1.52,"cheer"],[-3.55,COURT.nearBaseline-1.78,"heckler"],
    [-2.25,COURT.nearBaseline-1.48,"calm"],[-.95,COURT.nearBaseline-1.86,"distract"],[.95,COURT.nearBaseline-1.86,"cheer"],[2.25,COURT.nearBaseline-1.48,"calm"],
    [3.55,COURT.nearBaseline-1.78,"hype"],[4.85,COURT.nearBaseline-1.52,"filmer"],[6.05,COURT.nearBaseline-1.7,"heckler"],[7.2,COURT.nearBaseline-1.55,"player"],
    [-8.88,COURT.nearBaseline+.75,"distract"],[-8.95,COURT.nearBaseline+2.1,"filmer"],[-8.82,COURT.nearBaseline+3.65,"cheer"],[-8.92,COURT.nearBaseline+5.2,"hype"],
    [-8.75,COURT.nearBaseline+6.9,"calm"],[-8.9,COURT.nearBaseline+8.55,"heckler"],[-8.82,COURT.nearBaseline+10.2,"player"],[-8.95,COURT.nearBaseline+11.9,"hype"],
    [8.88,COURT.nearBaseline+.75,"filmer"],[8.95,COURT.nearBaseline+2.1,"cheer"],[8.82,COURT.nearBaseline+3.65,"hype"],[8.92,COURT.nearBaseline+5.2,"heckler"],
    [8.75,COURT.nearBaseline+6.9,"distract"],[8.9,COURT.nearBaseline+8.55,"calm"],[8.82,COURT.nearBaseline+10.2,"filmer"],[8.95,COURT.nearBaseline+11.9,"player"],
    [-7.8,COURT.nearBaseline-.35,"hype"],[7.8,COURT.nearBaseline-.35,"distract"]
  ];
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const max=mobile?12:30;
  slots.slice(0,max).forEach((s,i)=>{
    const pos=V3(s[0]+rnd(-.12,.12),0,s[1]+rnd(-.16,.16));
    const target=Math.abs(pos.x)>8?V3(0,0,Math.min(COURT.playMaxZ,pos.z+.45)):V3(0,0,HOOP.z+.9);
    const side=Math.abs(pos.x)>8,axis=side?V3(0,0,1):V3(1,0,0);
    makeNearCourtPerson(root,cube,{x:pos.x,z:pos.z,rot:faceTo(pos,target),kind:s[2],skin:i%4,hair:(i*2)%5,shirt:(i*3)%9,
      pants:(i+1)%6,shoe:(i*5)%5,sign:i%4,scale:rnd(.86,1.09),phase:rnd(0,Math.PI*2),amp:rnd(.7,1.2),
      axis,move:(s[2]==="hype"||s[2]==="distract"||s[2]==="filmer")?rnd(.08,.22):0},mats);
  });
}
function triggerNearCourtCrowdReaction(kind,points){
  if(!nearCourtCrowd.root)return;
  const big=(points||0)>=5||kind==="final";
  if(kind==="miss"||kind==="oppMiss")nearCourtCrowd.miss=Math.max(nearCourtCrowd.miss,big?.95:.68);
  else nearCourtCrowd.reaction=Math.max(nearCourtCrowd.reaction,big?1:.76);
  nearCourtCrowd.last=kind||"make";
}
function updNearCourtCrowd(t,dt){
  if(!nearCourtCrowd.root)return;
  const hit=nearCourtCrowd.reaction,miss=nearCourtCrowd.miss,base=Math.max(hit*.84,G.cheer*.28),shock=miss*.85;
  nearCourtCrowd.people.forEach((p,i)=>{
    const wave=Math.sin(t*(2.5+p.amp*1.4)+p.phase),pulse=Math.max(0,Math.sin(t*(5.2+p.amp)+p.phase));
    const move=Math.sin(t*.55+p.phase)*p.move;
    p.g.position.set(p.base.x+p.axis.x*move,p.baseY||0,p.base.z+p.axis.z*move);
    p.g.position.y=Math.max(0,wave)*(.025+.13*base)*p.amp;
    p.g.rotation.y=p.baseRot+Math.sin(t*1.25+p.phase)*(.018+.055*base);
    const cheer=base*(.75+.25*Math.sin(p.phase+i)),taunt=shock*(.8+.2*Math.cos(p.phase+i));
    if(p.kind==="filmer"){
      p.arms[0].rotation.z=-.16-.28*cheer+.2*taunt;
      p.arms[1].rotation.x=-.95-.22*cheer;
      p.arms[1].rotation.z=-.28-.2*cheer+.28*taunt;
      if(p.phone)p.phone.position.y=1.3+.11*cheer-.04*taunt;
    }else if(p.kind==="heckler"){
      p.arms[0].rotation.z=-.5-.18*cheer+.34*taunt;
      p.arms[1].rotation.z=.5+.18*cheer-.34*taunt;
      p.arms[0].rotation.x=p.arms[1].rotation.x=-.35-.18*cheer;
      if(p.sign){p.sign.position.y=1.74+.12*taunt+.05*pulse;p.sign.rotation.z=Math.sin(t*4+p.phase)*(.035+.08*taunt);}
    }else if(p.kind==="cheer"){
      p.arms[0].rotation.z=-.72+wave*(.55+.35*cheer);
      p.arms[1].rotation.z=.72-wave*(.55+.35*cheer);
      if(p.poms[0])p.poms[0].position.y=1.3+Math.max(0,wave)*(.18+.16*cheer);
      if(p.poms[1])p.poms[1].position.y=1.3+Math.max(0,-wave)*(.18+.16*cheer);
    }else if(p.kind==="distract"){
      p.arms[0].rotation.z=-.08-.65*cheer+.28*taunt;
      p.arms[1].rotation.z=.55+Math.sin(t*6+p.phase)*(.48+.28*cheer);
      p.arms[1].rotation.x=-.25-.2*cheer;
      if(p.prop){p.prop.rotation.z=Math.sin(t*8+p.phase)*(.55+.35*base);p.prop.position.y=1.32+.15*cheer;}
    }else if(p.kind==="player"){
      p.arms[0].rotation.z=-.52-.36*cheer+.22*taunt;
      p.arms[1].rotation.z=.18+.42*cheer-.18*taunt;
      if(p.prop)p.prop.position.y=1.05+.16*cheer+.04*Math.sin(t*3+p.phase);
    }else{
      p.arms[0].rotation.z=-.1-.55*cheer+.26*taunt;
      p.arms[1].rotation.z=.1+.55*cheer-.26*taunt;
      p.arms[0].rotation.x=-.18*cheer+.12*taunt;
      p.arms[1].rotation.x=-.18*cheer+.12*taunt;
    }
    /* 身体已烘焙成整块:以脚为轴做等效的轻微前倾/后仰(系数减半补偿更长的力臂) */
    if(p.body)p.body.rotation.x=-.012*cheer+.05*taunt;
  });
  nearCourtCrowd.reaction=Math.max(0,nearCourtCrowd.reaction-dt*1.25);
  nearCourtCrowd.miss=Math.max(0,nearCourtCrowd.miss-dt*1.15);
}

/* outdoor street crowd: lightweight people around fences, benches and park edges */
const streetCrowd={root:null,people:[],reaction:0,miss:0,last:"idle"};
function resetStreetCrowd(){
  streetCrowd.root=null;
  streetCrowd.people.length=0;
  streetCrowd.reaction=0;streetCrowd.miss=0;streetCrowd.last="idle";
}
function makeStreetBench(parent,cube,mat,x,z,rot){
  const g=new THREE.Group();
  const seat=showBox(g,cube,mat,0,.36,0,1.45,.18,.42);
  const back=showBox(g,cube,mat,0,.72,.22,1.45,.55,.12);
  showBox(g,cube,mat,-.58,.17,-.12,.12,.34,.12);
  showBox(g,cube,mat,.58,.17,-.12,.12,.34,.12);
  seat.castShadow=back.castShadow=false;
  g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);
  return g;
}
function makeStreetPerson(parent,cube,cfg,materials){
  const g=new THREE.Group(),skin=materials.skin[cfg.skin%materials.skin.length],hair=materials.hair[cfg.hair%materials.hair.length];
  const shirt=materials.shirts[cfg.shirt%materials.shirts.length],pants=materials.pants[cfg.pants%materials.pants.length];
  const shoe=materials.shoes[cfg.shoe%materials.shoes.length],phone=materials.phone,ballMat=materials.ball;
  const seated=cfg.kind==="bench",scale=cfg.scale||1,coast=cfg.place==="beachSunset",rain=cfg.place==="rainyCourt",village=cfg.place==="flowerCourt";
  const bodyY=seated?.76:.92,headY=seated?1.22:1.48;
  /* 与近场观众同样处理:躯干/头/帽/腿/脚烘焙成单块身体,坐姿的腿脚固定角度直接烘进
     几何体;原本 ±5° 的呼吸式微动改为整体轻微前倾。手臂/手机/球仍独立驱动。 */
  const legY=seated?.34:.38,legZ=seated?-.2:0,legH=seated?.42:.64;
  const bodyMat=(pos,scale,rotX)=>new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0],pos[1],pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX||0,0,0)),
    new THREE.Vector3(scale[0],scale[1],scale[2]));
  const body=bakeVoxelMesh(g,[
    {color:shirt.color,matrix:bodyMat([0,bodyY-(rain?.06:0),0],[rain?.48:coast?.36:.42,seated?.55:rain?.9:.72,.25])},
    {color:skin.color,matrix:bodyMat([0,headY,-.02],[.31,.31,.28])},
    {color:hair.color,matrix:bodyMat([0,headY+.18,-.03],[.34,.12,.3])},
    {color:(coast?skin:pants).color,matrix:bodyMat([-.13,legY,legZ],[.13,legH,.13],seated?1.15:0)},
    {color:(coast?skin:pants).color,matrix:bodyMat([.13,legY,legZ],[.13,legH,.13],seated?1.15:0)},
    {color:shoe.color,matrix:bodyMat([-.13,.08,seated?-.44:-.04],[.18,.11,.24],seated?.25:0)},
    {color:shoe.color,matrix:bodyMat([.13,.08,seated?-.44:-.04],[.18,.11,.24],seated?.25:0)}
  ]);
  const armL=showBox(g,cube,skin,-.34,1.02,-.02,.1,.48,.11);
  const armR=showBox(g,cube,skin,.34,1.02,-.02,.1,.48,.11);
  armL.rotation.z=seated?-.22:-.08;armR.rotation.z=seated?.22:.08;
  let phoneMesh=null,ball=null;
  if(cfg.kind==="filmer"||cfg.kind==="quiet"){
    phoneMesh=showBox(g,cube,phone,.43,1.23,-.2,.16,.23,.035);
    armR.rotation.x=-.9;armR.rotation.z=-.35;
  }else if(cfg.kind==="player"){
    ball=showBox(g,cube,ballMat,-.43,1.04,-.12,.22,.22,.22);
    armL.rotation.z=-.55;
  }
  if(cfg.place){
    // Sleeves and a contrasting hem read as local casual clothes, not team uniforms.
    if(!coast)for(let side of [-1,1])showBox(g,cube,shirt,side*.285,seated?.88:rain?1.04:1.16,0,.16,rain?.42:.2,.26);
    showBox(g,cube,pants,0,seated?.52:.61,-.005,.43,.065,.26);
    if(village){
      for(let j=0;j<4;j++)for(let y of [.76,.9])showBox(g,cube,materials.shirts[(cfg.shirt+3)%8],-.15+j*.1,y,-.134,.06,.045,.015);
      if(cfg.index%3===0){showBox(g,cube,materials.shirts[0],0,headY+.22,-.02,.53,.06,.45);showBox(g,cube,materials.shirts[0],0,headY+.27,-.02,.33,.13,.31);}
    }
    if(coast){
      for(let side of [-1,1])showBox(g,cube,pants,side*.13,seated?.4:.54,seated?-.19:0,.17,.27,.19);
      if(cfg.index%3===0){showBox(g,cube,materials.shirts[3],0,headY+.23,-.07,.5,.05,.48);showBox(g,cube,materials.shirts[3],0,headY+.28,-.03,.31,.12,.3);}
      if(cfg.index%2===0)for(let side of [-1,1])showBox(g,cube,phone,side*.08,headY+.025,-.167,.12,.06,.025);
    }
    if(cfg.place==="outdoorSunny"&&cfg.index%4===0){
      showBox(g,cube,shirt,0,headY+.22,-.03,.35,.09,.32);showBox(g,cube,shirt,0,headY+.17,-.22,.32,.035,.2);
      showBox(g,cube,pants,0,.98,.21,.3,.38,.15);
    }
    if(rain&&cfg.index%3!==1&&cfg.kind!=="bench"){
      showBox(g,cube,phone,.4,1.58,-.08,.025,.95,.025);
      const umbrella=new THREE.Mesh(new THREE.ConeGeometry(.64,.24,8),shirt);umbrella.position.set(.35,2.09,-.04);g.add(umbrella);
    }
  }
  g.position.set(cfg.x,0,cfg.z);g.rotation.y=cfg.rot;g.scale.setScalar(scale);
  parent.add(g);
  streetCrowd.people.push({g,body,arms:[armL,armR],phone:phoneMesh,ball,kind:cfg.kind,
    baseY:g.position.y,baseRot:cfg.rot,phase:cfg.phase,amp:cfg.amp||1});
}
function buildStreetCrowd(opts){
  resetStreetCrowd();
  const place=opts&&opts.place,localRandom=place?AIBAWorldPlaces.rng(831771+Object.keys(AIBAWorldPlaces.palettes).indexOf(place)*97):null;
  const srnd=(a,b)=>localRandom?a+localRandom()*(b-a):rnd(a,b);
  const mobile=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||Math.min(innerWidth,innerHeight)<700;
  const root=new THREE.Group();root.name="streetCrowdRoot";environmentRoot.add(root);streetCrowd.root=root;
  const cube=new THREE.BoxGeometry(1,1,1);
  const mat=hex=>new THREE.MeshLambertMaterial({color:hex});
  const materials={
    skin:[mat(0xf4c89c),mat(0xd9a066),mat(0x8d5524),mat(0x5f351f)],
    hair:[mat(0x1b1210),mat(0x3a2518),mat(0xe7d9a8),mat(0x101018)],
    shirts:[mat(0xffc72c),mat(0x1d428a),mat(0xce1141),mat(0x007a33),mat(0xffffff),mat(0x212734),mat(0xff6b5b),mat(0x63d7ff)],
    pants:[mat(0x181b24),mat(0x273b59),mat(0x6e727b),mat(0x0d3527),mat(0xffffff)],
    shoes:[mat(0xffffff),mat(0x111111),mat(0xff4d6d),mat(0x68e6ff)],
    phone:mat(0x07131f),
    ball:new THREE.MeshLambertMaterial({color:0xf28b22,emissive:0x9a3d00,emissiveIntensity:.08}),
    bench:mat(opts&&opts.beach?0x6d5341:0x27506a)
  };
  if(place){materials.shirts.forEach(m=>m.dispose());materials.shirts=AIBAWorldPlaces.palettes[place].shirts.map(mat);root.userData.place=place;root.userData.random=localRandom;root.userData.clock=0;}
  const benchDefs=opts&&opts.beach?[[-11.7,-4.8,Math.PI/2],[11.7,3.2,-Math.PI/2],[-6.2,21.8,Math.PI]]:[[-11.4,-5.2,Math.PI/2],[11.4,-1.5,-Math.PI/2],[-5.8,21.6,Math.PI],[5.8,21.6,Math.PI]];
  benchDefs.forEach(b=>makeStreetBench(root,cube,materials.bench,b[0],b[1],b[2]));
  let spots=[
    [-11.45,-8.1,"filmer"],[-11.35,-5.4,"bench"],[-11.55,-2.4,"fan"],[-11.45,1.2,"fan"],[-11.5,4.6,"player"],[-11.4,8.1,"filmer"],[-11.55,12.2,"fan"],[-11.35,16.4,"bench"],
    [11.45,-7.2,"fan"],[11.35,-3.1,"player"],[11.5,.6,"filmer"],[11.45,4.2,"fan"],[11.55,8.7,"bench"],[11.35,13.4,"fan"],[11.45,17.8,"filmer"],
    [-8.1,22.0,"fan"],[-5.4,22.35,"bench"],[-2.4,22.05,"filmer"],[.6,22.28,"fan"],[3.4,22.05,"player"],[6.2,22.35,"bench"],[8.6,22.0,"fan"],
    [-14.2,2.6,"passer"],[14.3,6.8,"passer"],[-15.0,14.4,"fan"],[15.2,15.6,"fan"]
  ];
  if(place){
    const layouts={
      outdoorSunny:[[-7.5,-11.4,"filmer"],[-6.4,-11.7,"fan"],[-4.2,-12,"player"],[4.7,-11.8,"fan"],[6,-12.1,"filmer"],[8,-11.5,"fan"],[-10.3,-4,"fan"],[-11.3,-5.3,"bench"],[11,-6,"player"],[12,-4.8,"fan"],[-10.6,2,"filmer"],[11.6,1.5,"quiet"],[-12,8,"fan"],[11,8.5,"fan"],[-11,15,"filmer"],[11,16,"player"],[-6,21.8,"bench"],[5.8,21.8,"bench"],[8,22,"fan"],[-14.2,2.6,"passer"],[14.3,6.8,"passer"],[14.3,13,"passer"],[-13.7,11,"quiet"],[3,22,"filmer"]],
      rainyCourt:[[-8.6,-12.5,"quiet"],[-7.2,-12.8,"fan"],[7.8,-12.6,"filmer"],[9,-12.8,"quiet"],[-12.9,-4.8,"bench"],[-13.8,-3.6,"quiet"],[13.2,2,"fan"],[14.1,3.2,"quiet"],[-12.5,13.4,"fan"],[12.6,14.3,"filmer"],[-5.8,21.6,"bench"],[14.6,10,"passer"]],
      flowerCourt:[[-7.8,-11.6,"fan"],[-6.3,-12,"player"],[-4.5,-12.2,"fan"],[5.9,-12,"quiet"],[7,-11.5,"fan"],[-10,-3,"player"],[-11.2,-5.2,"bench"],[10.2,-1.5,"fan"],[11.1,-.4,"fan"],[-10.7,7,"quiet"],[-11.8,8.1,"fan"],[10.6,9.3,"player"],[-10.1,15.4,"filmer"],[11,16.5,"fan"],[-5.8,21.6,"bench"],[5.8,21.6,"bench"],[-14,11,"passer"],[14,14,"passer"]],
      /* 校园那侧(+x)靠铁丝网站着看,海那侧(-x)只有零星路过的人 —— 
         人群分布本身也在讲"一侧校园一侧海"。 */
      /* 村落那侧(+x)沿石阶站着看,崖边(-x)只有零星倚墙的人 —— 崖沿不站人。 */
      medCliff:[[9.9,-8.2,"fan"],[10.3,-3.6,"quiet"],[10.1,1.4,"fan"],[10.4,6.2,"filmer"],[10,11.5,"player"],
        [-10.4,-4.8,"quiet"],[-10.8,3.2,"passer"],[-10.2,11,"fan"],
        [-4.4,-15.8,"filmer"],[3.2,-16.2,"fan"],[-2.6,26.8,"quiet"],[5.4,27.2,"passer"],[8.2,20.4,"fan"]],
      shonanCoast:[[9.4,-9.5,"fan"],[9.6,-5.2,"player"],[9.3,-1,"quiet"],[9.7,3.4,"fan"],[9.4,7.8,"filmer"],
        [9.6,12,"fan"],[-9.8,-6.4,"passer"],[-10.2,1.2,"quiet"],[-9.9,8.6,"passer"],
        [-6.2,-14.2,"fan"],[4.8,-14.4,"filmer"],[-1.5,27.4,"quiet"],[3.6,27.6,"fan"]],
      beachSunset:[[-8.9,-13.6,"passer"],[-7.7,-13.4,"passer"],[-5.2,-12.7,"player"],[5.9,-13,"filmer"],[7.2,-13.5,"quiet"],[-11.8,-4.8,"bench"],[-12.5,-3.4,"quiet"],[11,-1,"fan"],[12.2,-.3,"player"],[11.7,3.2,"bench"],[-13,7,"passer"],[-14.2,8,"passer"],[12.4,11,"quiet"],[11.4,12,"fan"],[-10.8,16,"filmer"],[-6.2,21.8,"bench"],[6.4,22,"quiet"],[13.9,17,"passer"],[14.7,18,"passer"]]
    };spots=layouts[place];
  }
  const max=place?(mobile?Math.ceil(spots.length*.75):spots.length):(mobile?16:26),center=V3(0,0,COURT.midZ);
  let seatedIndex=0;
  spots.slice(0,max).forEach((s,i)=>{
    const jitterX=srnd(-.45,.45),jitterZ=srnd(-.55,.55),pos=V3(s[0]+jitterX,0,s[1]+jitterZ);
    let kind=s[2],rot=faceTo(pos,center);
    if(place&&kind==="bench"){
      const seat=benchDefs[seatedIndex++];if(seat){pos.set(seat[0],0,seat[1]);rot=seat[2];}else kind="fan";
    }
    makeStreetPerson(root,cube,{x:pos.x,z:pos.z,rot,kind,place,index:i,skin:i%4,hair:(i*2)%4,shirt:(i*3+(opts&&opts.rainy?1:0))%8,
      pants:(i+2)%5,shoe:(i*5)%4,scale:srnd(.86,1.08),phase:srnd(0,Math.PI*2),amp:srnd(.72,1.2)},materials);
    if(place){const p=streetCrowd.people[streetCrowd.people.length-1],hype=kind==="fan"&&(place==="outdoorSunny"?i%2===1:place==="flowerCourt"?i%3===1:i%7===0);
      p.interest=kind==="passer"?0:kind==="quiet"?.08:hype?.98:kind==="bench"?.25:.55;
      p.energy=hype?1:.25+localRandom()*.35;p.pendingAt=Infinity;p.response=0;p.responseSign=1;p.origin=pos.clone();p.baseY=0;}
  });
}
function triggerStreetCrowdReaction(kind,points){
  triggerNearCourtCrowdReaction(kind,points);
  if(!streetCrowd.root||(SCENE_PRESETS[currentScenePreset]||{}).type!=="outdoor")return;
  const big=(points||0)>=5||kind==="final";
  if(streetCrowd.root.userData.place){
    const state=streetCrowd.root.userData,random=state.random;
    streetCrowd.people.forEach(p=>{if(random()<p.interest){p.pendingAt=state.clock+.08+random()*.85;p.pendingStrength=(big?1:.65)*p.energy;p.responseSign=(kind==="miss"||kind==="oppMiss")?-1:1;}});
    streetCrowd.last=kind||"make";return;
  }
  if(kind==="miss"||kind==="oppMiss")streetCrowd.miss=Math.max(streetCrowd.miss,big?.9:.62);
  else streetCrowd.reaction=Math.max(streetCrowd.reaction,big?1:.72);
  streetCrowd.last=kind||"make";
}
function updStreetCrowd(t,dt){
  if(!streetCrowd.root)return;
  if(streetCrowd.root.userData.place){
    const state=streetCrowd.root.userData;state.clock+=dt;
    streetCrowd.people.forEach(p=>{
      if(state.clock>=p.pendingAt){p.response=Math.max(p.response,p.pendingStrength);p.pendingAt=Infinity;}
      p.response=Math.max(0,p.response-dt*.38);const wave=Math.sin(state.clock*(3+p.amp)+p.phase),cheer=p.response*Math.max(0,p.responseSign),shock=p.response*Math.max(0,-p.responseSign);
      const active=p.interest>.9,base=active?.08*(.5+.5*Math.sin(state.clock*.7+p.phase)):0;
      p.g.position.copy(p.origin);p.g.position.y=p.kind==="bench"?0:Math.max(0,wave)*(base+cheer*.16);
      p.g.rotation.y=p.baseRot+Math.sin(state.clock*.6+p.phase)*.025;
      p.arms[0].rotation.set(-.12*cheer,-0,-.08-.8*(cheer+base)+.22*shock);
      p.arms[1].rotation.set(-.12*cheer,0,.08+.8*(cheer+base)-.22*shock);
      if(p.kind==="filmer"||p.kind==="quiet"){p.arms[1].rotation.x=p.kind==="quiet"?-.5:-.9;p.arms[1].rotation.z=-.35;if(p.phone)p.phone.position.y=(p.kind==="quiet"?1.05:1.23)+cheer*.04;}
      if(p.kind==="player"){p.arms[0].rotation.z=-.55;if(p.ball)p.ball.position.y=1.04;}
      if(p.kind==="passer"){
        // Stroll along the apron, with pauses; never enter the active court.
        const phase=state.clock*.12+p.phase;p.g.position.z=p.origin.z+Math.sin(phase)*3;p.g.rotation.y=Math.cos(phase)>0?Math.PI:0;
        p.arms[0].rotation.x=Math.sin(state.clock*3+p.phase)*.15;p.arms[1].rotation.x=-p.arms[0].rotation.x;
      }
      if(p.body)p.body.rotation.x=-cheer*.025+shock*.035;
    });return;
  }
  const hit=streetCrowd.reaction,miss=streetCrowd.miss,base=Math.max(hit*.8,G.cheer*.22),shock=miss*.8;
  streetCrowd.people.forEach((p,i)=>{
    const s=Math.sin(t*(3.2+p.amp*1.8)+p.phase),bounce=Math.max(0,s)*(.08+.16*base)*p.amp;
    p.g.position.y=p.baseY+bounce+(p.kind==="passer"?Math.sin(t*.75+p.phase)*.03:0);
    p.g.rotation.y=p.baseRot+Math.sin(t*1.6+p.phase)*(.025+.055*base);
    const cheer=base*(.7+.3*Math.sin(p.phase+i)),missPose=shock*(.85+.15*Math.cos(p.phase));
    if(p.kind==="filmer"){
      p.arms[0].rotation.z=-.2-.45*cheer+.32*missPose;
      p.arms[1].rotation.x=-.9-.35*cheer;
      p.arms[1].rotation.z=-.35-.38*cheer+.45*missPose;
      if(p.phone)p.phone.position.y=1.23+.18*cheer-.05*missPose;
    }else if(p.kind==="player"){
      p.arms[0].rotation.z=-.55-.55*cheer+.35*missPose;
      p.arms[1].rotation.z=.12+.5*cheer-.3*missPose;
      if(p.ball)p.ball.position.y=1.04+.22*cheer;
    }else{
      p.arms[0].rotation.z=-.12-.85*cheer+.45*missPose;
      p.arms[1].rotation.z=.12+.85*cheer-.45*missPose;
      p.arms[0].rotation.x=-.25*cheer+.18*missPose;
      p.arms[1].rotation.x=-.25*cheer+.18*missPose;
    }
    /* 身体已烘焙成整块:以脚为轴做等效的轻微前倾(系数减半补偿更长的力臂) */
    if(p.body)p.body.rotation.x=p.kind==="bench"?(-.03-.05*cheer+.06*missPose):0;
  });
  streetCrowd.reaction=Math.max(0,streetCrowd.reaction-dt*1.35);
  streetCrowd.miss=Math.max(0,streetCrowd.miss-dt*1.2);
}


window.AIBA.runtime.register("rendering:spectators",Object.freeze({
  buildNearCourtCrowd,triggerNearCourtCrowdReaction,updNearCourtCrowd,
  resetStreetCrowd,buildStreetCrowd,triggerStreetCrowdReaction,updStreetCrowd
}));
