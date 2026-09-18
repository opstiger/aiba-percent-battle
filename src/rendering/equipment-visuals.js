/* ---------------- release-grade voxel equipment visuals ---------------- */
(function(global){
  "use strict";

  const craft=new URLSearchParams(location.search).get("craft")!=="classic";
  const enabled=new URLSearchParams(location.search).get("gear")==="classic"?false:true;

  function colorOf(value,fallback){
    if(typeof value==="number")return value;
    return parseInt(String(value||fallback||"#ffffff").replace("#",""),16)||0xffffff;
  }
  function shade(value,factor){
    const c=new THREE.Color(colorOf(value));
    c.multiplyScalar(factor);return c.getHex();
  }
  function material(color,opts){
    const o=Object.assign({color:colorOf(color)},opts||{});
    return new THREE.MeshLambertMaterial(o);
  }
  function box(parent,w,h,d,x,y,z,mat,rx,ry,rz){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.rotation.set(rx||0,ry||0,rz||0);parent.add(mesh);return mesh;
  }
  function roundedBoxGeometry(w,h,d,r,segments){
    const geometry=new THREE.BoxGeometry(w,h,d,segments||3,segments||3,segments||3);
    const position=geometry.attributes.position,innerX=w*.5-r,innerY=h*.5-r,innerZ=d*.5-r;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const qx=Math.max(-innerX,Math.min(innerX,x)),qy=Math.max(-innerY,Math.min(innerY,y)),qz=Math.max(-innerZ,Math.min(innerZ,z));
      const dx=x-qx,dy=y-qy,dz=z-qz,length=Math.hypot(dx,dy,dz)||1;
      position.setXYZ(i,qx+dx*r/length,qy+dy*r/length,qz+dz*r/length);
    }
    position.needsUpdate=true;geometry.computeVertexNormals();return geometry;
  }
  function roundedBox(parent,w,h,d,r,x,y,z,mat,rx,ry,rz){
    const mesh=new THREE.Mesh(roundedBoxGeometry(w,h,d,r,3),mat);
    mesh.position.set(x,y,z);mesh.rotation.set(rx||0,ry||0,rz||0);parent.add(mesh);return mesh;
  }
  function ellipsoid(parent,rx,ry,rz,x,y,z,mat){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mat);
    mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function cylinder(parent,rt,rb,h,segments,x,y,z,mat,rx,ry,rz){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments||8),mat);
    mesh.position.set(x,y,z);mesh.rotation.set(rx||0,ry||0,rz||0);parent.add(mesh);return mesh;
  }
  function torus(parent,r,tube,x,y,z,mat,scaleY,rotationZ){
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,5,18,Math.PI*1.2),mat);
    mesh.position.set(x,y,z);mesh.scale.y=scaleY||1;mesh.rotation.z=rotationZ||0;parent.add(mesh);return mesh;
  }
  function disposeGroup(group){
    if(!group)return;
    if(group.parent)group.parent.remove(group);
    const mats=new Set();
    group.traverse(obj=>{
      if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
      const list=Array.isArray(obj.material)?obj.material:[obj.material];
      list.filter(Boolean).forEach(mat=>mats.add(mat));
    });
    mats.forEach(mat=>mat.dispose&&mat.dispose());
  }
  function disposeUnusedMaterials(groups,materials){
    const used=new Set();
    (Array.isArray(groups)?groups:[groups]).filter(Boolean).forEach(group=>group.traverse(obj=>{
      const list=Array.isArray(obj.material)?obj.material:[obj.material];
      list.filter(Boolean).forEach(mat=>used.add(mat));
    }));
    materials.filter(Boolean).forEach(mat=>{if(!used.has(mat)&&mat.dispose)mat.dispose();});
  }
  function clearKey(guy,key){
    if(!guy)return;
    if(key==="gearHeadGroup"||key==="customHeadGroup"){
      setBeardVisible(guy,true);
    }
    const hiddenKey=key+"HiddenKit";
    if(guy[hiddenKey]){
      guy[hiddenKey].forEach(mesh=>{mesh.visible=true;});
      guy[hiddenKey]=null;
    }
    const wearKey=key+"WearGroups";
    if(guy[wearKey]){
      guy[wearKey].forEach(disposeGroup);
      guy[wearKey]=null;
    }
    if(!guy[key])return;
    if(Array.isArray(guy[key]))guy[key].forEach(disposeGroup);else disposeGroup(guy[key]);
    guy[key]=null;
  }

  function setHairVisible(guy,visible){if(guy)for(const group of new Set([guy.hairBase,guy.hairGrp,guy.hairTail]))if(group)group.visible=visible;}
  function setCustomHeadVisible(guy,visible){if(guy&&guy.customHeadGroup)guy.customHeadGroup.visible=visible;}
  function setBeardVisible(guy,visible){
    if(!guy||!guy.beardGrp)return;
    if(visible===false){
      if(guy.beardGrp.visible){
        guy._beardHiddenByGear=true;
        guy.beardGrp.visible=false;
      }
    }else{
      if(guy._beardHiddenByGear){
        guy.beardGrp.visible=true;
        guy._beardHiddenByGear=false;
      }
    }
  }

  /* 全脸面具:无缝覆盖整个脸部(额头、眉骨、眼周、鼻梁、脸颊、口唇、下巴及下颚底)
     彻底告别原来仅遮住眼鼻的半脸/眼罩感,打造全包围战术篮球全脸面罩。
     main 是高光装饰色(accent,如青色冷光线条),dark 是暗黑碳纤维面罩本体材质。 */
  function buildMask(group,main,dark){
    // 1. 全脸连续无缝主装甲底壳(Forehead to Chin Baseplates - 100%覆盖脸部皮肤，零露肉缝隙)
    // 额头至眉骨基板
    roundedBox(group,.346,.095,.046,.010,0,1.738,.190,dark);
    // 额头中央装甲加强脊与冷光标
    box(group,.048,.082,.052,0,1.740,.200,dark);
    box(group,.120,.012,.054,0,1.755,.204,main);

    // 2. 眉骨与战术眼眶护甲
    box(group,.330,.028,.048,0,1.692,.210,dark); // 眉弓突出护檐
    // 战术眼眶包边与锐角棱边(留出深凹眼窝，内部封闭)
    box(group,.094,.016,.044,-.080,1.672,.218,main,0,0,.06); // 左上眼眶
    box(group,.094,.016,.044,.080,1.672,.218,main,0,0,-.06);  // 右上眼眶
    box(group,.094,.016,.044,-.080,1.622,.218,dark,0,0,-.04); // 左下眼眶
    box(group,.094,.016,.044,.080,1.622,.218,dark,0,0,.04);  // 右下眼眶
    // 深邃哑光护目镜视窗(遮挡内部眼球皮肤)
    const visorMat=material(0x0e1014);
    roundedBox(group,.088,.036,.018,.004,-.080,1.647,.216,visorMat);
    roundedBox(group,.088,.036,.018,.004,.080,1.647,.216,visorMat);

    // 3. 立体隆起全包裹鼻梁装甲:彻底包覆鼻梁与鼻头
    roundedBox(group,.046,.108,.060,.008,0,1.628,.228,dark);   // 鼻梁正中立体脊
    box(group,.046,.095,.048,-.038,1.628,.216,dark,0,.20,0);  // 左鼻翼侧面
    box(group,.046,.095,.048,.038,1.628,.216,dark,0,-.20,0);   // 右鼻翼侧面

    // 4. 全包裹脸颊与下颌装甲基板:严密覆盖两侧脸颊并向下收拢
    roundedBox(group,.340,.092,.050,.010,0,1.605,.198,dark);   // 中面部基底整板
    roundedBox(group,.096,.088,.044,.010,-.118,1.572,.212,dark,0,.14,-.06); // 左颊棱角护板
    roundedBox(group,.096,.088,.044,.010,.118,1.572,.212,dark,0,-.14,.06);  // 右颊棱角护板
    roundedBox(group,.092,.080,.046,.010,-.128,1.498,.208,dark,0,.16,-.10); // 左下颌护板
    roundedBox(group,.092,.080,.046,.010,.128,1.498,.208,dark,0,-.16,.10);  // 右下颌护板

    // 5. 口部全封闭装甲与战术排气格栅:彻底封闭遮挡嘴唇与人中
    roundedBox(group,.318,.110,.054,.012,0,1.510,.210,dark);   // 下半脸密封基板
    roundedBox(group,.184,.068,.052,.010,0,1.545,.232,dark);   // 口部主护盾
    box(group,.014,.056,.056,0,1.545,.242,main);               // 中央纵向透气装饰线
    box(group,.116,.008,.054,0,1.560,.240,dark);               // 上横向透气格栅
    box(group,.102,.008,.054,0,1.530,.240,dark);               // 下横向透气格栅

    // 6. 下巴全包裹护托与下颚底部兜底:遮挡整张脸的最底端与下巴下缘
    roundedBox(group,.170,.058,.056,.012,0,1.468,.228,dark);   // 下巴主护罩
    box(group,.076,.016,.058,0,1.472,.238,main);               // 下巴折角高光
    roundedBox(group,.260,.042,.096,.010,0,1.432,.168,dark,-.20,0,0); // 下颚底部全兜底(从下方完全封死下巴)

    // 7. 头部侧面包裹与双层束紧固定带(防止侧面露肉)
    box(group,.036,.310,.130,-.172,1.605,.125,dark);           // 左侧脸颊侧板
    box(group,.036,.310,.130,.172,1.605,.125,dark);            // 右侧脸颊侧板
    box(group,.028,.036,.260,-.180,1.662,.045,dark);           // 上侧固定带(左)
    box(group,.028,.036,.260,.180,1.662,.045,dark);            // 上侧固定带(右)
    box(group,.026,.032,.230,-.178,1.512,.065,dark,.05,0,-.06);// 下颌固定带(左)
    box(group,.026,.032,.230,.178,1.512,.065,dark,.05,0,.06); // 下颌固定带(右)
  }
  /* 帽冠要贴着头,不能比脑袋宽。头是 0.34 方块(半宽 .17),
     原来帽冠半径 .205~.22 明显宽出一圈,侧面看能看到帽檐底下透空,
     整顶帽子像悬在头顶的桶。收到 .178~.196 刚好扣住,
     帽檐压到帽冠下沿前方,后扣收进帽冠半径内不再支棱在外面。 */
  function buildCap(group,main,dark){
    cylinder(group,.178,.196,.145,8,0,1.812,-.012,main);   // 帽冠:下沿 1.74,埋进头顶 1.79
    box(group,.275,.085,.032,0,1.800,.170,main);           // 前片
    box(group,.245,.024,.195,0,1.745,.245,main,.06,0,0);   // 帽檐:压在下沿前方,略下倾
    box(group,.095,.026,.032,0,1.782,-.186,dark);          // 后扣
    box(group,.034,.036,.05,-.05,1.782,-.186,main);
    box(group,.034,.036,.05,.05,1.782,-.186,main);
    if(craft){
      // Crown seams and an inset brim underside, keeping the approved cap envelope.
      box(group,.012,.087,.034,0,1.8,.190,dark);
      box(group,.218,.005,.14,0,1.733,.249,dark,.06,0,0);
      box(group,.042,.018,.035,0,1.891,-.012,dark);
      for(const side of [-1,1])box(group,.015,.014,.023,side*.155,1.815,.096,dark);
    }
  }
  /* 潮流立体粗框墨镜:
     彻底告别旧版"两片扁平浅灰贴纸贴在脸上"的廉价感。
     采用深黑粗框板材(粗顶梁、立体下眼眶、宽外翼、双中梁结构)、
     纯黑高光偏光镜片(完全遮挡面部眼块，晶莹深黑光泽)、
     金属铰链与延伸至耳后的完整3D立体镜腿与耳挂。 */
  function buildShades(group,main,dark){
    // 粗黑板材镜框材质(质感石墨深灰黑)
    const frameMat=material(0x181a20);
    // 深邃纯黑偏光镜片(纯黑哑光/深曜石质感，绝不反白光爆光)
    const lensMat=material(0x050608);
    // 镜框金属铰链铆钉(银白金属质感)
    const pinMat=new THREE.MeshLambertMaterial({color:0xdfe3e8});

    // 1. 粗实立体顶梁 (Top Brow Bar - 突出面部悬空立体感)
    roundedBox(group,.326,.026,.044,.006,0,1.676,.230,frameMat);
    // 顶梁立体倒角护檐
    box(group,.310,.010,.042,0,1.686,.226,frameMat,-.10,0,0);
    // 标志性立体双梁结构(Double Bridge)
    box(group,.050,.010,.040,0,1.684,.232,frameMat);
    roundedBox(group,.038,.026,.038,.006,0,1.650,.232,frameMat);

    // 2. 鼻托内衬(稳固贴合鼻部)
    box(group,.014,.026,.026,-.026,1.632,.218,frameMat,0,0,-.18);
    box(group,.014,.026,.026,.026,1.632,.218,frameMat,0,0,.18);

    // 3. 完整的立体下眼眶粗框 (Bottom Rims - 粗框质感，彻底消除纸片感)
    roundedBox(group,.116,.018,.038,.005,-.080,1.612,.228,frameMat,0,0,.03);
    roundedBox(group,.116,.018,.038,.005,.080,1.612,.228,frameMat,0,0,-.03);

    // 4. 外展侧翼边框与外眼角铰链台 (Outer Rims & Hinges)
    roundedBox(group,.028,.060,.040,.006,-.142,1.644,.228,frameMat,0,-.08,-.03);
    roundedBox(group,.028,.060,.040,.006,.142,1.644,.228,frameMat,0,.08,.03);
    box(group,.016,.050,.036,-.024,1.646,.228,frameMat);
    box(group,.016,.050,.036,.024,1.646,.228,frameMat);

    // 5. 镜框外角金属铆钉 (Silver Rivet Pins)
    box(group,.010,.008,.016,-.148,1.670,.238,pinMat);
    box(group,.010,.008,.016,.148,1.670,.238,pinMat);

    // 6. 纯黑高光偏光镜片 (Deep Glossy Polarized Lenses - 嵌在粗框内)
    roundedBox(group,.100,.048,.020,.005,-.080,1.645,.227,lensMat,0,-.03,0);
    roundedBox(group,.100,.048,.020,.005,.080,1.645,.227,lensMat,0,.03,0);

    // 7. 延伸到耳后的完整立体镜腿与耳挂 (Temples & Ear Hooks)
    box(group,.026,.024,.048,-.160,1.666,.208,frameMat,0,-.06,0);
    box(group,.026,.024,.048,.160,1.666,.208,frameMat,0,.06,0);
    box(group,.020,.022,.250,-.178,1.664,.072,frameMat);
    box(group,.020,.022,.250,.178,1.664,.072,frameMat);
    box(group,.018,.038,.058,-.178,1.636,-.056,frameMat,-.25,0,0);
    box(group,.018,.038,.058,.178,1.636,-.056,frameMat,-.25,0,0);
  }
  /* 帽子和帽衫身要分开挂:
       帽壳 -> headRoot,跟着头转(原来整组挂在 guy.g,转头时脸转了帽子不动);
       肩轭和抽绳 -> 身体,它们本来就该待在肩膀上。
     headRoot 带 0.86 缩放和 y 偏移,所以帽壳用的是头部局部坐标:
       local = (world - 1.45*(1-0.86)) / 0.86 = (world - 0.203) / 0.86
     尺寸同样要除以 0.86,再放大一圈当作布料余量 —— 贴着头皮的壳子看着像头盔,
     不像帽子。 */
  /* 尺寸对着真实脑袋来:头是 0.34 的圆角方块,中心 y=1.62,半径 0.17(头部局部坐标)。
     帽壳取 1.2 倍头(0.205)当布料余量 —— 之前写 0.256 是 1.5 倍,侧面看就是脑后
     顶了个大气球。中心往后挪 0.055,让壳子前沿(-.055+.212=.157)刚好落在
     脸前面(0.17)之后,脸露出来、后脑被罩住。 */
  /* 帽子做成"顶+两侧+后背"四片壳,而不是一个实心椭球。
     椭球无论怎么调都会和脑袋这个方盒子相交 —— 侧面看就是一道斜边切过脸颊。
     四片壳只包住头的上/后/两侧,前面自然留出脸,永远不会切到脸。
     坐标是头部局部坐标:头 = 0.34 的方块,中心 y=1.62,半径 0.17。 */
  function buildHoodShell(group,main,trim){
    roundedBox(group,.395,.092,.395,.045,0,1.800,-.020,main);   // 顶:压在头顶(1.79)上,别悬空
    roundedBox(group,.072,.300,.350,.032,-.206,1.632,-.028,main);  // 左侧片
    roundedBox(group,.072,.300,.350,.032,.206,1.632,-.028,main);   // 右侧片
    roundedBox(group,.395,.320,.080,.04,0,1.636,-.208,main);   // 后片
    ellipsoid(group,.196,.112,.100,0,1.474,-.140,main);        // 后颈堆布
    // 开口滚边:贴在两侧片的前沿,不要用悬在脸前面的圆环
    roundedBox(group,.030,.300,.045,.014,-.206,1.632,.140,trim);
    roundedBox(group,.030,.300,.045,.014,.206,1.632,.140,trim);
    roundedBox(group,.400,.036,.045,.016,0,1.788,.128,trim);   // 额前帽檐滚边
  }
  function buildHoodYoke(group,main,trim){
    ellipsoid(group,.205,.105,.105,0,1.445,-.125,main);
    ellipsoid(group,.27,.085,.17,0,1.40,-.015,main);
    box(group,.19,.022,.035,-.082,1.432,.16,trim,0,0,-.42);
    box(group,.19,.022,.035,.082,1.432,.16,trim,0,0,.42);
  }
  function buildMascot(group,main,dark){
    // Keep the original comic cube mascot; the shared headRoot scale makes it 14% smaller.
    box(group,.48,.48,.48,0,1.64,0,main);
    box(group,.09,.09,.09,-.13,1.70,.25,dark);
    box(group,.09,.09,.09,.13,1.70,.25,dark);
    box(group,.25,.05,.045,0,1.55,.26,dark);
    box(group,.15,.20,.13,-.29,1.77,0,main);
    box(group,.15,.20,.13,.29,1.77,0,main);
  }
  function buildHoodieWear(guy,key,main,trim,seam){
    const groups=[];
    const torso=new THREE.Group();guy.g.add(torso);groups.push(torso);
    roundedBox(torso,.535,.61,.295,.05,0,1.10,0,main);
    box(torso,.545,.055,.305,0,.82,0,seam);
    box(torso,.33,.135,.026,0,.99,.163,seam);
    box(torso,.27,.095,.029,0,.99,.178,main);
    box(torso,.18,.022,.034,-.08,1.397,.154,trim,0,0,-.45);
    box(torso,.18,.022,.034,.08,1.397,.154,trim,0,0,.45);
    cylinder(torso,.008,.008,.17,6,-.055,1.31,.166,trim);
    cylinder(torso,.008,.008,.17,6,.055,1.31,.166,trim);
    box(torso,.025,.025,.025,-.055,1.22,.166,trim);
    box(torso,.025,.025,.025,.055,1.22,.166,trim);
    (guy.arms||[]).forEach(arm=>{
      const sleeve=new THREE.Group();arm.add(sleeve);groups.push(sleeve);
      roundedBox(sleeve,.157,.18,.178,.028,0,-.045,0,main);
      roundedBox(sleeve,.154,.285,.174,.022,0,-.19,0,main);
      roundedBox(sleeve,.158,.032,.178,.008,0,-.31,0,seam);
    });
    (guy.elbows||[]).forEach(elbow=>{
      const sleeve=new THREE.Group();elbow.add(sleeve);groups.push(sleeve);
      roundedBox(sleeve,.146,.108,.165,.024,0,-.018,0,main);
      roundedBox(sleeve,.148,.245,.166,.025,0,-.14,0,main);
      roundedBox(sleeve,.153,.048,.172,.012,0,-.272,0,seam);
    });
    guy[key+"WearGroups"]=groups;
    hideKitUnderHoodie(guy,key);
  }

  /* 穿上连帽衫要把里面的球衣收掉,否则会从壳子里穿出来。
     躯干壳是 roundedBox(.535,.61,.295) 挂在 y=1.10,半宽只有 .2675;
     而球衣的侧条在 x=±.255(外沿 .275)、外侧薄边在 x=±.285(外沿 .305),
     两者都比壳子宽,直接从袖子和躯干中间露出来 —— 画面上那两道紫条和黄条就是它们。
     按"材质属于球衣/球裤 + 落在躯干高度带"筛,短裤(y≈.88 及以下)保持可见,
     否则会变成光腿。被收掉的网格记在 <key>HiddenKit 上,脱下时由 clearKey 还原。 */
  /* 下沿分两档:
       普通球衣件从 .95 往上收(再往下就是短裤本体,收了会变光腿);
       但**薄条**要多收一段到 .86 —— 短裤上沿那条 0.5×0.035×0.29 的滚边,
       半深 .145,和连帽衫外壳的半深 .1475 只差 2.5mm,两个平面几乎重合,
       直接 z-fighting,在下摆位置闪出一道黄条。短裤本体半深 .135,差 1.25cm,不受影响。 */
  const KIT_HIDE_BOTTOM=.95,KIT_TRIM_BOTTOM=.86,KIT_TRIM_MAX_H=.06,KIT_HIDE_TOP=1.45;
  function hideKitUnderHoodie(guy,key){
    const mats=[guy.mJ,guy.mP,guy.bodyF,guy.bodyB].filter(Boolean);
    if(!mats.length||!guy.g)return;
    const hidden=[];
    (guy.g.children||[]).forEach(child=>{
      if(!child.isMesh||!child.visible)return;
      const y=child.position.y;
      const par=child.geometry&&child.geometry.parameters;
      const thin=par&&par.height&&par.height<=KIT_TRIM_MAX_H;
      if(y<(thin?KIT_TRIM_BOTTOM:KIT_HIDE_BOTTOM)||y>KIT_HIDE_TOP)return;
      const list=Array.isArray(child.material)?child.material:[child.material];
      if(!list.some(m=>mats.indexOf(m)>=0))return;
      child.visible=false;hidden.push(child);
    });
    // The garment replaces covered skin, so bent elbows cannot flash pale slivers.
    const covered=[guy.g.getObjectByName("jerseyNeckInset"),...(guy.upperArms||[]),...(guy.forearms||[]),...(guy.elbowBlends||[]),...(guy.arms||[]).map(a=>a.getObjectByName("shoulderBlend"))];
    for(const mesh of covered)if(mesh?.visible){mesh.visible=false;hidden.push(mesh);}
    if(guy.jerseyHem?.visible){guy.jerseyHem.visible=false;hidden.push(guy.jerseyHem);}
    guy[key+"HiddenKit"]=hidden;
  }

  function applyHead(guy,item,opts){
    if(!enabled||!guy)return false;
    opts=opts||{};
    const key=opts.key||"gearHeadGroup";
    clearKey(guy,key);
    if(key==="gearHeadGroup"){
      setCustomHeadVisible(guy,true);setHairVisible(guy,true);setBeardVisible(guy,true);
      if(guy.customTopHeadGroup)guy.customTopHeadGroup.visible=true;
      if(guy.headband)guy.headband.visible=false;
    }
    if(!item)return true;
    const id=item.id||"",color=colorOf(item.color||opts.color),accent=colorOf(opts.accent||item.accent||0x77e7ff);
    if(key==="gearHeadGroup"&&(id==="head-hoodie"||id==="hoodie")&&guy.customTopHeadGroup)return true;
    if(id.indexOf("band-")===0||id==="band"){
      if(guy.headband){guy.headband.visible=true;guy.headband.material.color.setHex(color);}
      return true;
    }
    if(key==="gearHeadGroup")setCustomHeadVisible(guy,false);
    const group=new THREE.Group();group.name=key;
    const main=material(color),dark=material(shade(color,.20)),seam=material(shade(color,.64)),trim=material(accent,{emissive:accent,emissiveIntensity:.08});
    if(id==="head-mask"||id==="mask"){setBeardVisible(guy,false);buildMask(group,main,dark);}
    else if(id==="head-cap"||id==="cap"){setHairVisible(guy,false);buildCap(group,main,dark);}
    else if(id==="head-shades"||id==="shades")buildShades(group,main,dark);
    else if(id==="head-hoodie"||id==="hoodie"){
      if(!opts.outfitOnly){setHairVisible(guy,false);buildHoodYoke(group,main,trim);}
      buildHoodieWear(guy,key,main,trim,seam);   // 内部会写 guy[key+"WearGroups"],帽壳要在它之后挂
      if(!opts.outfitOnly){
        const hoodHead=new THREE.Group();hoodHead.name=key+"Hood";
        buildHoodShell(hoodHead,main,trim);
        (guy.headRoot||guy.g).add(hoodHead);
        (guy[key+"WearGroups"]=guy[key+"WearGroups"]||[]).push(hoodHead);
      }
    }
    else {setHairVisible(guy,false);if(key==="gearHeadGroup"&&guy.customTopHeadGroup)guy.customTopHeadGroup.visible=false;buildMascot(group,main,dark);}
    disposeUnusedMaterials([group].concat(guy[key+"WearGroups"]||[]),[main,dark,seam,trim]);
    const parent=(id==="head-hoodie"||id==="hoodie")?guy.g:(guy.headRoot||guy.g);
    parent.add(group);guy[key]=group;return true;
  }

  function applyShoes(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearShoeGroups");
    // Performance items retain their gameplay stats; the approved player shoe is
    // the visual source for both saved equipment and newly selected equipment.
    if(global.AIBABasketballShoes&&guy.defaultBasketballShoe){
      global.AIBABasketballShoes.apply(guy,"RetroHigh",guy.defaultBasketballShoe);return true;
    }
    if(!item){if(global.AIBABasketballShoes&&guy.defaultBasketballShoe)global.AIBABasketballShoes.apply(guy,"RetroHigh",guy.defaultBasketballShoe);return true;}
    if(global.AIBABasketballShoes)global.AIBABasketballShoes.clear(guy);
    const color=colorOf(item.color),id=item.id,groups=[];
    const main=material(color),dark=material(shade(color,.23)),light=material(0xf3f6f6),accent=material(shade(color,1.25),{emissive:color,emissiveIntensity:.06});
    (guy.shoes||[]).forEach(shoe=>shoe.material.color.setHex(color));
    (guy.ankles||[]).forEach((ankle,index)=>{
      const group=new THREE.Group(),side=index===0?-1:1;
      const articulated=!!(global.AIBAModelDetail?.enabled&&guy.footRoots?.[index]&&guy.toeRoots?.[index]);
      (articulated?guy.footRoots[index]:ankle).add(group);groups.push(group);
      if(articulated){
        // A performance kit modifies panels of the existing shoe, not its sole envelope.
        // All four identities share the base last and retain independent toe articulation.
        for(const face of [-1,1]){
          roundedBox(group,.011,.041,.115,.004,face*.098,-.005,-.033,dark);
          box(group,.012,.012,.072,face*.104,.006,.006,accent,0,0,face*.16);
        }
        if(id==="shoes-anchor"){
          roundedBox(group,.18,.067,.038,.009,0,.009,-.139,main);
          for(const face of [-1,1])box(group,.013,.061,.075,face*.099,.014,-.092,main,0,0,face*.09);
        }else if(id==="shoes-marathon"){
          for(const face of [-1,1])ellipsoid(group,.008,.016,.037,face*.104,-.059,-.078,accent);
          box(group,.069,.028,.012,0,.057,-.139,main,-.12);
        }else if(id==="shoes-blaze"){
          for(const face of [-1,1])box(group,.012,.021,.139,face*.104,.003,.012,accent,.22,0,face*.14);
          box(group,.055,.035,.012,0,.064,-.139,main,-.16);
        }else{
          for(const face of [-1,1]){
            roundedBox(group,.012,.035,.07,.004,face*.104,-.042,-.09,dark);
            box(group,.014,.012,.053,face*.109,-.039,-.09,accent);
          }
          box(group,.06,.034,.012,0,.061,-.139,main,-.12);
        }
      }else{
      if(id==="shoes-blaze"){
        box(group,.038,.072,.19,side*.096,-.012,.025,accent,0,0,side*.12);
        ellipsoid(group,.064,.014,.055,0,-.004,.17,light);
        box(group,.065,.09,.035,0,.055,-.13,main,0,0,-side*.08);
      }else if(id==="shoes-anchor"){
        box(group,.225,.035,.24,0,-.068,.005,dark);
        ellipsoid(group,.112,.018,.085,0,-.068,.15,dark);
        box(group,.035,.095,.22,side*.104,-.005,.015,main);
        ellipsoid(group,.082,.019,.05,0,-.01,.18,accent);
        box(group,.12,.08,.045,0,.055,-.135,dark);
      }else if(id==="shoes-marathon"){
        box(group,.215,.048,.24,0,-.073,.005,light);
        ellipsoid(group,.107,.025,.085,0,-.073,.15,light);
        cylinder(group,.055,.065,.055,8,0,-.045,-.115,accent,Math.PI/2,0,0);
        box(group,.15,.055,.13,0,.005,.035,main,0,0,side*.04);
        box(group,.032,.05,.18,side*.092,-.005,.035,dark);
      }else{
        box(group,.21,.038,.235,0,-.072,.005,dark);
        ellipsoid(group,.105,.02,.085,0,-.072,.15,dark);
        cylinder(group,.052,.064,.065,8,0,-.035,-.13,accent,Math.PI/2,0,0);
        ellipsoid(group,.072,.016,.052,0,-.01,.18,light);
        box(group,.035,.075,.18,side*.096,-.005,.025,main,0,0,side*.08);
      }
      }
      if(craft){
        const stitching=new THREE.Group();stitching.name="equipmentStitching";group.add(stitching);
        // Inset heel eyelets and a split side panel differentiate performance footwear.
        for(const face of [-1,1]){
          box(stitching,.008,.038,.087,face*.099,.004,-.088,dark);
          for(let j=0;j<3;j++)box(stitching,.009,.006,.013,face*.104,.025,-.12+j*.027,light);
          for(let j=0;j<3;j++)box(stitching,.006,.008,.024,face*.099,-.014,.012+j*.033,accent);
        }
        box(stitching,.09,.012,.012,0,.053,-.145,light);
        if(global.AIBAModelDetail)AIBAModelDetail.batch(stitching);
      }
      if(articulated){
        group.children.forEach(mesh=>{
          if(!mesh.isMesh)return;
          const p=mesh.geometry.parameters;
          // Keep the four equipment identities, but their overlays should read as
          // thin reinforcing panels, not a second complete shoe over the base shoe.
          if(p.width&&p.width<.05&&p.depth>.14){mesh.scale.x=.65;mesh.scale.y=.65;}
          if(p.width>.20&&mesh.position.y<-.06)mesh.scale.y=.45;
          if(!p.width&&mesh.position.z>=.14)mesh.scale.y*=.65;
        });
        const toe=guy.toeRoots[index],toeKit=new THREE.Group();toeKit.name="shoeToeEquipment";
        toeKit.position.copy(toe.position).multiplyScalar(-1);toe.add(toeKit);groups.push(toeKit);
        // Fine toe reinforcement follows the forefoot, rather than a second cap.
        for(const face of [-1,1])box(toeKit,.006,.010,.042,face*.086,.009,.152,main,0,face*.16);
        // Only front-cap pieces move with toe flexion. Midsole and heel remain on foot.
        group.children.slice().filter(m=>m.position.z>=.14).forEach(m=>toeKit.add(m));
      }
    });
    disposeUnusedMaterials(groups,[main,dark,light,accent]);
    guy.gearShoeGroups=groups;return true;
  }

  /* 护臂/护腕是角色身上**本来就有**的网格(characters.js 建的 sl / wr),
     装备只是把它们打开并改色。所以卸下时必须还原成"没有装备时的样子",
     而不是一律隐藏 —— 有些球星自带袖子/护腕,一刀切会把人家的特征抹掉。
     第一次改动之前先把原始状态记下来。 */
  function rememberSleeveBase(guy){
    if(guy._sleeveBase)return;
    const snap=list=>(list||[]).map(m=>m?{v:!!m.visible,c:m.material?m.material.color.getHex():null}:null);
    guy._sleeveBase={sleeves:snap(guy.sleeves),wrists:snap(guy.wrists)};
  }
  function restoreSleeveBase(guy){
    const base=guy._sleeveBase;if(!base)return;
    const put=(list,saved)=>(list||[]).forEach((m,i)=>{
      const s=saved&&saved[i];if(!m||!s)return;
      m.visible=s.v;if(s.c!=null&&m.material)m.material.color.setHex(s.c);
    });
    put(guy.sleeves,base.sleeves);put(guy.wrists,base.wrists);
  }
  function applySleeve(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearSleeveGroups");
    /* 复位必须在 `if(!item)` 之前。原来这两行在下面的分支里,脱下装备走的是
       上面那条 early return —— 于是 sl 带着上一件的颜色一直挂在手臂上,
       第一人称低头就看到一截跟身上颜色对不上的深色块。 */
    rememberSleeveBase(guy);
    restoreSleeveBase(guy);
    if(!item)return true;
    const id=item.id,color=colorOf(item.color),groups=[];
    const dark=material(shade(color,.28)),accent=material(shade(color,1.24),{emissive:color,emissiveIntensity:.05}),main=material(color);
    (guy.sleeves||[]).forEach(part=>{part.visible=false;});
    (guy.wrists||[]).forEach(part=>{part.visible=false;});
    const sleeve=guy.sleeves&&guy.sleeves[0],wrist=guy.wrists&&guy.wrists[0];
    if(id==="sleeve-snap"){
      if(wrist){wrist.visible=true;wrist.material.color.setHex(color);}
      const group=new THREE.Group();guy.elbows[0].add(group);groups.push(group);
      box(group,.142,.018,.158,0,-.242,0,accent);
      box(group,.142,.014,.158,0,-.294,0,dark);
    }else if(id==="sleeve-wrist-terry"){
      // 加厚毛圈吸汗护腕 (Plush Terrycloth Sweatband)
      (guy.wrists||[]).forEach((w,idx)=>{
        if(w){w.visible=true;w.material.color.setHex(color);}
        const group=new THREE.Group();guy.elbows[idx].add(group);groups.push(group);
        roundedBox(group,.148,.076,.164,.022,0,-.27,0,main);
        box(group,.150,.012,.166,0,-.27,0,accent); // 中间运动条纹
      });
    }else if(id==="sleeve-wrist-bands"){
      // 潮流双圈硅胶能量手环 (Dual Silicone Energy Bands)
      (guy.wrists||[]).forEach((w,idx)=>{
        const group=new THREE.Group();guy.elbows[idx].add(group);groups.push(group);
        box(group,.145,.015,.160,0,-.254,0,main);
        box(group,.145,.015,.160,0,-.286,0,accent);
      });
    }else{
      if(sleeve){sleeve.visible=true;sleeve.material.color.setHex(color);}
      const upper=new THREE.Group();guy.arms[0].add(upper);groups.push(upper);
      box(upper,.151,.018,.171,0,-.098,0,id==="sleeve-steady"?dark:accent);
      /* 护臂必须**往下盖到前臂**。只做大臂的话,第三人称看得见衣袖、
         第一人称(只看得到肘部以下)还是光胳膊 —— 同一件装备两个视角对不上。
         尺寸沿用长袖球衣那段的肘部件:.148 宽包得住 .125 的前臂,不会穿模。 */
      const fore=new THREE.Group();guy.elbows[0].add(fore);groups.push(fore);
      ellipsoid(fore,.081,.052,.088,0,-.018,0,main);
      roundedBox(fore,.148,.245,.166,.025,0,-.14,0,main);
      roundedBox(fore,.153,.048,.172,.012,0,-.272,0,id==="sleeve-steady"?dark:accent);
      if(id==="sleeve-hex"){
        // 肘部六边形蜂窝防撞垫 (Hexagonal Elbow Shock Pad)
        const elbow=new THREE.Group();guy.elbows[0].add(elbow);groups.push(elbow);
        roundedBox(elbow,.082,.082,.026,.008,0,-.018,.086,dark);
        box(elbow,.064,.064,.028,0,-.018,.088,accent);
      }else if(id==="sleeve-ice"){
        const elbow=new THREE.Group();guy.elbows[0].add(elbow);groups.push(elbow);
        ellipsoid(elbow,.076,.045,.085,0,-.012,.025,dark);
      }else if(id==="sleeve-saver"){
        if(wrist){wrist.visible=true;wrist.material.color.setHex(color);}
        box(upper,.018,.20,.174,-.066,-.205,0,accent);
      }
    }
    disposeUnusedMaterials(groups,[dark,accent,main]);
    guy.gearSleeveGroups=groups;return true;
  }

  /* ---------------- 护膝与加压腿套系统 ---------------- */
  function applyKnee(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearKneeGroups");
    if(!item)return true;
    const id=item.id,color=colorOf(item.color),groups=[];
    const dark=material(shade(color,.22)),accent=material(shade(color,1.25),{emissive:color,emissiveIntensity:.06}),main=material(color);
    const knees=guy.knees||[];
    const targetIndices=id.includes("single")?[1]:[0,1];
    targetIndices.forEach(idx=>{
      const kn=knees[idx];if(!kn)return;
      const group=new THREE.Group();kn.add(group);groups.push(group);
      if(id.includes("hex")){
        // 经典蜂窝防撞护膝 (Hexagonal Honeycomb Knee Pad)
        // 髌骨弹性基底套
        roundedBox(group,.156,.138,.168,.022,0,-.016,0,main);
        // 立体凸起的六边形防撞蜂窝护甲块 (Hex Honeycomb Cushion)
        roundedBox(group,.088,.096,.026,.008,0,-.016,.092,dark);
        box(group,.072,.076,.028,0,-.016,.094,accent);
        // 上下双圈防滑加压螺纹
        box(group,.158,.016,.170,0,.050,0,accent);
        box(group,.156,.016,.168,0,-.082,0,dark);
      }else if(id.includes("sleeve")){
        // 全腿加压长款护膝/腿套 (Full Leg Compression Sleeve)
        roundedBox(group,.155,.290,.168,.022,0,-.098,0,main);
        box(group,.158,.018,.171,0,.045,0,dark); // 顶端防滑硅胶带
        box(group,.153,.018,.166,0,-.240,0,accent); // 下端收口弹力带
        box(group,.014,.180,.170,idx===0?-.078:.078,-.098,0,accent); // 侧边速度线条
      }else{
        // 战术加压髌骨带 (Dual Patellar Tendon Straps)
        roundedBox(group,.158,.026,.172,.006,0,-.072,.004,main);
        box(group,.028,.018,.016,0,-.072,.095,accent); // 加压金属卡扣
      }
    });
    disposeUnusedMaterials(groups,[dark,accent,main]);
    guy.gearKneeGroups=groups;return true;
  }

  /* ---------------- 压缩衣与紧身内搭系统 (Compression Undershirts) ---------------- */
  function applyCompression(guy,item){
    if(!enabled||!guy)return false;
    clearKey(guy,"gearCompressionGroups");
    if(!item)return true;
    const id=item.id,color=colorOf(item.color),groups=[];
    const dark=material(shade(color,.25)),seam=material(shade(color,1.20),{emissive:color,emissiveIntensity:.05}),main=material(color);

    // 1. 躯干与领口紧身层 (Neckline & Torso Baselayer)
    const torso=new THREE.Group();guy.g.add(torso);groups.push(torso);
    // 领口高弹压缩圈 (在球衣深V/圆领内侧自然露出高领)
    roundedBox(torso,.232,.082,.216,.016,0,1.345,0,main);
    box(torso,.234,.012,.218,0,1.385,0,seam); // 领口加固包边
    // 侧翼与两肋人体工学压胶拼缝 (Flank compression panels)
    box(torso,.012,.24,.222,-.215,1.15,0,seam);
    box(torso,.012,.24,.222,.215,1.15,0,seam);

    if(id.includes("hex")){
      // 蜂窝防撞胸骨与两肋缓冲甲 (Hex Armor rib & sternum padding)
      box(torso,.075,.14,.022,0,1.24,.124,dark);
      for(const side of [-1,1]){
        box(torso,.022,.12,.095,side*.19,1.16,.02,dark);
        box(torso,.024,.09,.075,side*.192,1.16,.02,seam);
      }
    }

    // 2. 袖部紧身层 (Sleeves)
    if(!id.includes("tank")){
      // 短袖 / 长袖压缩套 (从肩头紧紧包覆至大臂)
      (guy.arms||[]).forEach(arm=>{
        const slv=new THREE.Group();arm.add(slv);groups.push(slv);
        roundedBox(slv,.146,.180,.166,.020,0,-.115,0,main);
        box(slv,.148,.016,.168,0,-.205,0,seam); // 袖口弹力收口带
      });
      if(id.includes("long")){
        // 长袖压缩衣：延伸覆盖整个前臂
        (guy.elbows||[]).forEach(elb=>{
          const slv=new THREE.Group();elb.add(slv);groups.push(slv);
          roundedBox(slv,.134,.225,.154,.020,0,-.135,0,main);
          box(slv,.136,.016,.156,0,-.246,0,seam);
        });
      }
    }

    disposeUnusedMaterials(groups,[dark,seam,main]);
    guy.gearCompressionGroups=groups;return true;
  }

  global.AIBAEquipmentVisuals=Object.freeze({enabled,applyHead,applyShoes,applySleeve,applyKnee,applyCompression,clearKey});
})(window);
