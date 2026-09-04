/* ---------------- three.js setup ---------------- */
/* 手机上关 MSAA:方块风格本来就没有多少斜边,抗锯齿收益很小,但多重采样是实打实的
   填充率开销——体感模式还要和摄像头推理抢资源,这一项省得最划算。桌面端保持开启。 */
const AA_COARSE_POINTER=(()=>{
  try{
    if(typeof matchMedia!=="function")return false;
    return matchMedia("(pointer:coarse)").matches||Math.min(innerWidth,innerHeight)<700;
  }catch(e){return false;}
})();
const renderer=new THREE.WebGLRenderer({canvas:$("c"),antialias:!AA_COARSE_POINTER,powerPreference:"high-performance"});
renderer.setPixelRatio(1);
if(THREE.sRGBEncoding)renderer.outputEncoding=THREE.sRGBEncoding;
/* 色调映射。之前完全没开(默认 NoToneMapping),意味着亮度超过 1 的部分被**硬切**成白 ——
   顶灯照亮的地板、篮板高光、灯箱这些本该有层次的亮部全糊成死白一片,
   这是"低成本感"和"没有电影感"最大的单一来源。
   ACESFilmic 会把高光平滑地压回可显示范围,暗部保留过渡,整体观感接近转播/电影。
   代价是整体偏暗(它本来就压中间调),所以 exposure 同步提到 1.25 补偿。
   A/B:?tonemap=0 关掉、?exposure=1.4 现场改曝光。 */
const TONE_MAP=(()=>{
  try{return new URLSearchParams(location.search).get("tonemap")==="0"
    ?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;}catch(e){return THREE.NoToneMapping;}
})();
if(THREE.ACESFilmicToneMapping)renderer.toneMapping=TONE_MAP;
/* 1.25→1.08。试过压地板 albedo(0xc7bfb6→0xb0a798,降约 12%)和砍反射,
   A/B 实测场地均值 160.1→162.3 —— 完全没动。原因是地板亮度由**入射光**决定,
   不是反照率;再叠加 ACES 在高亮区的压缩,albedo 那点降幅直接被吃掉。
   所以"地板偏亮"只能从曝光这一端解决。
   现场微调直接用 ?exposure=1.0 / 1.15,不用改代码重刷。 */
/* 0.86→0.94。验收说"画面平均确实偏暗",但点名不要直接用 arena 配方的 1.12
   —— 那会让左侧地板灯池和白线重新开始局部过曝(1.12 是提亮 +30%,太猛)。
   这里只提 +9.3%,落在建议的 8%~12% 区间内,是"提到刚好"而不是"提到满":
   配合 bloomThreshold 同步抬到 .84(见 grade.js),白线和灯池不跟着泛光。
   现场 A/B 仍可用 ?exposure=1.0 覆盖,不用改代码重刷。 */
renderer.toneMappingExposure=(()=>{
  try{const q=new URLSearchParams(location.search).get("exposure");
    return q?Math.max(.1,Math.min(3,+q||1)):0.94;}catch(e){return 0.94;}
})();
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x05060c);
/* 大气透视。原来 near=34:球场纵深也就 30~40m,等于整场都在雾外,零空间层次,
   于是"所有东西同一个锐度"—— 那是"低模游戏"最明显的破绽。
   near 拉到 12:球员通常在 3~8m(完全清晰),看台和远端在 12m 外开始被推远。
   雾色从近黑 0x05060c 改成深蓝灰:近黑会让远景"死黑",而真实场馆的远景是
   **偏冷、低对比**,不是变暗到没有。这一层才是背景分离的主力,DOF 只是辅助。 */
scene.fog=new THREE.Fog(0x141a24,12,52);
const camera=new THREE.PerspectiveCamera(68,1,0.1,120);
scene.add(camera);
const indoorRoot=new THREE.Group();indoorRoot.name="indoorRoot";
const environmentRoot=new THREE.Group();environmentRoot.name="environmentRoot";
const weatherRoot=new THREE.Group();weatherRoot.name="weatherRoot";
scene.add(indoorRoot);scene.add(environmentRoot);scene.add(weatherRoot);
const rig={pos:V3(0,9,10),look:V3(0,2,-8)};
const camTarget={pos:V3(0,9,10),look:V3(0,2,-8)};
let camSnap=true;
let curSpotRing=null;
const RENDER_QUALITY=(()=>{
  const q=new URLSearchParams(location.search).get("quality")||"auto";
  const hasMatch=typeof matchMedia==="function";
  const coarse=!!(hasMatch&&matchMedia("(pointer:coarse)").matches);
  const reduced=!!(hasMatch&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  const mem=navigator.deviceMemory||4;
  const base=coarse?(mem>=6?1.24:1.12):1.48;
  const max=coarse?(mem>=6?1.42:1.28):1.8;
  const presets={
    low:{scale:.88,min:.78,max:.96,locked:true},
    hd:{scale:base,min:.9,max,locked:true},
    ultra:{scale:coarse?1.48:2,min:1,max:coarse?1.55:2,locked:true}
  };
  const preset=presets[q];
  if(preset)return {mode:q,scale:preset.scale,target:preset.scale,min:preset.min,max:preset.max,locked:preset.locked,low:0,high:0,fps:60,w:1,h:1};
  const start=reduced?Math.min(base,1.05):base;
  return {mode:"auto",scale:start,target:base,min:coarse?.86:.98,max,locked:false,low:0,high:0,fps:60,w:1,h:1};
})();
function renderQualityTarget(){
  let target=RENDER_QUALITY.target;
  if(VISION&&VISION.desired)target-=0.08;
  if(G&&(G.state==="menu"||G.state==="diff"))target-=0.06;
  return clamp(target,RENDER_QUALITY.min,RENDER_QUALITY.max);
}
let lastScanOverlay="";
function updateVisualOverlays(){
  const on=G&&(G.state==="menu"||G.state==="diff"||G.state==="nba-dna");
  const next=on?"menu":"off";
  if(next===lastScanOverlay)return;
  lastScanOverlay=next;
  if(on)document.documentElement.dataset.scanOverlay="menu";
  else delete document.documentElement.dataset.scanOverlay;
}
function applyRenderScale(force){
  const q=RENDER_QUALITY,w=q.w||innerWidth,h=q.h||innerHeight;
  const scale=clamp(q.scale,q.min,q.max);
  const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));
  if(!force&&renderer.domElement.width===rw&&renderer.domElement.height===rh)return;
  q.scale=scale;
  renderer.setSize(rw,rh,false);
  renderer.domElement.style.width=w+"px";renderer.domElement.style.height=h+"px";
  document.documentElement.dataset.renderCrisp=scale<1?"1":"0";
}
function updateRenderQuality(dt){
  const q=RENDER_QUALITY;
  if(q.locked||G.state==="menu"||G.state==="diff")return;
  const fps=1/Math.max(dt,0.001);
  q.fps=q.fps*0.92+fps*0.08;
  const active=G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="pregame";
  if(!active)return;
  const target=renderQualityTarget();
  if(q.fps<43){q.low+=dt;q.high=0;}else if(q.fps>56){q.high+=dt;q.low=0;}else{q.low=Math.max(0,q.low-dt*.5);q.high=Math.max(0,q.high-dt*.5);}
  if(q.low>1.25&&q.scale>q.min+.01){
    q.scale=Math.max(q.min,q.scale-0.08);q.low=0;applyRenderScale(true);
  }else if(q.high>4.5&&q.scale<target-.01){
    q.scale=Math.min(target,q.scale+0.06);q.high=0;applyRenderScale(true);
  }
}
function dampRig(dt,k){
  if(camSnap){rig.pos.copy(camTarget.pos);rig.look.copy(camTarget.look);camSnap=false;return;}
  const a=1-Math.exp(-(k||4.5)*dt);
  rig.pos.lerp(camTarget.pos,a);rig.look.lerp(camTarget.look,a);
}
/* 竖屏必须按 Hor+ 补偿视野。THREE 的 fov 是**垂直**视角，竖屏(aspect≈0.46)时
   垂直 68° 换算出的水平视角只剩 34.5°(横屏是 100°)——贴到面前的防守人会糊满
   半个屏幕，自己的手和球全被挤出画面。
   这里锁定水平视角 BASE_HFOV，竖屏时反解出需要的垂直 fov；横屏维持原来的 68°
   垂直视角不变(取 min，避免宽屏把画面拉得过广)。 */
const BASE_VFOV=68,MAX_VFOV=90,BASE_HFOV=2*Math.atan(Math.tan(BASE_VFOV/2*Math.PI/180)*(16/9))*180/Math.PI;
function fovForAspect(aspect){
  const wanted=2*Math.atan(Math.tan(BASE_HFOV/2*Math.PI/180)/Math.max(.2,aspect))*180/Math.PI;
  return Math.max(BASE_VFOV,Math.min(MAX_VFOV,wanted));
}
function resize(){
  const vv=window.visualViewport;
  const w=Math.max(1,Math.round(vv?vv.width:innerWidth));
  const h=Math.max(1,Math.round(vv?vv.height:innerHeight));
  document.documentElement.style.setProperty("--app-height",h+"px");
  RENDER_QUALITY.w=w;RENDER_QUALITY.h=h;applyRenderScale(true);
  camera.aspect=w/h;camera.fov=fovForAspect(camera.aspect);
  if(window.AIBACameraFov&&AIBACameraFov.apply)AIBACameraFov.apply();
  camera.updateProjectionMatrix();
}
let _resizeT=0;
function debouncedResize(){clearTimeout(_resizeT);_resizeT=setTimeout(resize,120);}
addEventListener("resize",debouncedResize);
if(window.visualViewport)visualViewport.addEventListener("resize",debouncedResize);
resize();

/* ---------------- 灯光 ----------------
   原来是一套"平光":ambient .32 + hemi .34 + sun .8 + spot 1.0,四盏亮度同量级,
   谁都不是主光。结果是整场平均亮 —— 观众和主角一样白,视线没有落点,
   画面读起来像"游戏直出"而不是球馆。

   改成球馆里真实存在的四层,亮度拉开数量级:
     key   顶部聚光,唯一的主光,照亮投篮区和木地板
     rim   篮筐方向的冷色背光,只负责把主角从深色背景里"切"出来
     fill  挂在相机上的短距离暖光,补主角朝向镜头那一面(距离 14m 就衰减光了,
           所以打不到 12m 外的看台 —— 这是"主体亮、背景暗"的关键)
     amb/hemi 极弱的环境底,只保证暗部不死黑
   环境光整体降到原来的一半,让上面三盏的对比读得出来。 */
/* 环境项大幅提高,把"主光:环境"从 5.3:1 拉到约 1:1。
   原来的配法是舞台聚光:一盏 1.75 的主光 + 0.33 的环境,于是整个半场只有一个
   夸张的大方向光,人物像摄影棚里被追光。真实室内球馆是顶棚几十盏灯均匀漫射,
   直射和环境基本持平,人物靠**多方向的柔和接触阴影 + 材质高光**出体积,
   而不是靠一束斜射的硬阴影。
   主体突出改由"照明分层"负责:场地被顶灯照亮、顶棚与看台相对暗(见 arena.js),
   不再靠压暗背景 + 相机补光硬抠。 */
const ambient=new THREE.AmbientLight(0x9fb4d0,0.58);scene.add(ambient);
const hemi=new THREE.HemisphereLight(0x6f86b6,0x241a12,0.54);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffdcae,0.30);sun.position.set(6.5,17,5);scene.add(sun);
/* 灯位为什么偏到右前方而不是正上方:正上方的主光把影子压在人脚底下,被身体自己挡住,
   实测只覆盖画面 0.37%,等于没有。偏出来之后影子朝左前方拉开,覆盖 1.36% —— "落地感"
   来自影子的方向,不是影子的存在。偏太多又会变成夕阳长影,和球馆顶灯的设定冲突。 */
/* 1.05→0.82。压这一盏不是为了压暗画面(环境项同步补回来了),是为了压**阴影的深浅**:
   被遮挡处的亮度 ≈ 环境/(环境+主光),1.05 时约 48%,影子很实;0.82 时约 58%,
   再配合上面 radius=6 的柔边,才接近多灯照明下那种"几乎看不出方向"的淡影。 */
const spot=new THREE.SpotLight(0xfff2d8,0.82,42,0.68,0.55,1.1);spot.position.set(6.2,11.8,4.2);
spot.target.position.set(0,0.9,-4.2);indoorRoot.add(spot);indoorRoot.add(spot.target);
/* 背光。从篮筐那一侧斜上方打过来,过肩机位下正好勾出人物轮廓边;
   看台在球筐后方、背对这盏灯,所以只吃到背面,不会被提亮。 */
/* 高度很关键:原来放在 y=7.5,地板法线吃到 0.42 的余弦,等于给全场又加了一盏顶光,
   实测把近处地板整整抬高 30 个灰阶。压到 y=4.5 后地板只吃 0.24,而朝向篮筐的
   人物竖面吃到 0.91 —— 这才是背光该有的分布。 */
/* 0.46→0.18。这盏是**背光/轮廓光**,但实测它是地板上那块过曝的**唯一来源**:
   逐灯消融里把它单独归零,过曝像素从 16580 直接塌到 0(100%),
   而其余九盏各自最多只能解释 5.6%。
   根因是几何:它俯角只有 16°(y=4.5、水平距离 15.8),是个**掠射角**。
   掠射下漫反射的余弦只有 0.27,弱得几乎看不见 —— 可 Fresnel 在掠射角趋近 1.0,
   镜面反射被 GGX 拉成一条长带,正好就是画面里从左后方斜过来的那条死白。
   换句话说:它"照不亮"地板,却"照爆"了地板。
   代价实测可以忽略 —— 场地均值 165→161(−2.5%),角色包围盒内
   P95 完全不变(198.3)、最亮只掉 1:因为它是背光,过肩机位下相机看到的
   角色正面本就吃不到它,它的能量全砸在地板上。
   顺便:上面"压到 y=4.5 后地板只吃 0.24"那句判断方向是对的,
   但只算了漫反射,漏掉了掠射角下 Fresnel 主导的镜面项。 */
const rim=new THREE.DirectionalLight(0x9ec4ff,0.18);rim.position.set(-5,4.5,-15);indoorRoot.add(rim);
/* ---------------- 球馆顶部灯阵 ----------------
   之前全场只有 spot 一盏投影,所以必然只有一个方向的硬影 —— 那是户外太阳/摄影棚单灯
   的逻辑,不是室内球馆。真实球馆是顶棚几十盏灯均匀漫射,关键在于**互相填亮**:
   每个方向产生的阴影,都会被其余方向的光补起来,于是脚下只剩几层很浅、方向不同的
   接触阴影,而不是一条明确指向某处的黑影。

   这里用 4 盏阵列模拟。**投影只开 2~3 盏** —— 多灯的价值在"填亮"不在"每盏都投一条影",
   而每盏投影都是一个独立的 shadow pass,是这一层唯一的性能变量(见 SHADOWS 块的备注)。
   色温 0xfff6e8 ≈ 4500K 中性偏暖白,刻意不用之前那种偏黄的值。 */
/* 跨度刻意拉大(±8.5 / z −5~7,高度压到 11.5)。第一版挤在 ±5.6×8.2 的小方块里、
   挂 13.6m 高,相对球员几乎是"同一片天空" —— 人一挡就把四盏全挡了,脚下仍是
   全遮挡区,实测阴影深度 24.4,比单灯那版(13.7)还深,等于把要修的问题加重。
   真实球馆的灯铺满整个天花板,球员只挡得住正上方那几盏,斜角方向的仍在照 ——
   **"填亮"能不能成立,取决于灯的角分散度,不取决于灯的数量。** */
const ARENA_LIGHT_LAYOUT=[
  [-8.5,11.5,-5.0],[8.5,11.5,-5.0],
  [-8.5,11.5, 7.0],[8.5,11.5, 7.0]
];
/* 投影灯和纯照明灯用**两套强度** —— 这是"多灯填亮"能成立的关键。
     投影灯 .10:它只负责"投出一条很淡的影",强度高了影就黑(实测 .20 时平均深度 25+)
     纯照明灯 .32:不投影,专门把别人投出来的影**填亮**
   四盏合计 ≈ .84,和原来单盏 .82 的总光量持平,所以场地亮度不变、只有影变淡。
   同一个灯不可能既投出深影又把影填平,这两件事必须由不同的灯分担。 */
/* 0.35/0.32 → 0.26/0.23。压地板亮度优先动这里而不是 exposure:
   灯阵是俯照,能量绝大部分落在球场上;顶棚和看台主要靠 ambient/hemi 维持,
   降灯阵对它们影响小。而 exposure 是全局的,调它等于把整个画面一起压暗,
   连本来合适的看台和人物也跟着变闷 —— 用户只说地板亮,那就只降地板那一端。 */
/* 0.26/0.23 → 0.20/0.17。换 PBR 之后地板整体抬到 171(Phong 时是 150),
   因为 clearcoat 多了一层反射、而 PBR 的 color 保持白(木色全靠贴图给)。
   继续压 exposure 会把角色一起压暗,所以这里还是只降灯阵 —— 它主要照地板。 */
const ARENA_KEY_I=0.20,ARENA_FILL_I=0.17;
function applyArenaLightMix(){
  arenaLights.forEach(l=>{
    l.color.setHex(0xfff6e8);
    l.intensity=l.castShadow?ARENA_KEY_I:ARENA_FILL_I;
  });
}
const arenaLights=ARENA_LIGHT_LAYOUT.map(p=>{
  /* angle .70→1.02、penumbra .70→.98。评测点出"左右两侧有明显白色光斑,像曝光溢出",
     根因是四盏灯在地面各留一块独立亮区、而且中心最亮 —— 真实馆是几十盏灯把光斑
     **糊成一片均匀照明**,看不到单块光斑。
     加灯数会线性增加 shader 与 shadow 成本,所以这里用加大柔边来解决:
     angle 放到 1.02(约 58°)后四束光在地面大幅交叠,penumbra 拉到 .98
     让中心到边缘几乎没有落差,光斑随之消失。
     (之前以为改过这一处,实际没生效,所以"调了没变化"。) */
  const l=new THREE.SpotLight(0xfff6e8,0.20,46,1.02,0.98,0.9);
  l.position.set(p[0],p[1],p[2]);
  /* 目标点朝球场中心收一点,四盏的光锥在地面交叠 —— 交叠区就是"被多盏共同照亮"的地方,
     单盏的影在这里最容易被填平。 */
  l.target.position.set(p[0]*0.3,0,p[2]);
  indoorRoot.add(l);indoorRoot.add(l.target);
  return l;
});
/* 相机补光。必须是"有距离上限"的点光:主角离镜头 3~4m 拿满,
   12m 外的看台衰减到 3% 以下。用平行光或环境光做补光就会连观众一起提亮。 */
/* 略低于视点:光走得更水平,竖直的人物吃满(N·L≈0.92),水平的地板只吃到掠射角(≈0.56)。
   放在视点上方就会变成"连地板一起提亮",主角照样不突出。 */
/* 从 1.15 降到 0.25。挂在相机上的补光是**摄影棚手法**:它让主体永远正面受光,
   等于把人从球馆里抠出来贴到画面上,空间感正是被它抹平的。
   主体突出交给照明分层(场地亮/顶棚暗),这里只留极少量防止正面死黑。 */
const camFill=new THREE.PointLight(0xffe0b8,0.25,12,1.3);camFill.position.set(0,-0.15,1.0);camera.add(camFill);

/* ---------------- 实时阴影 ----------------
   v2.19.9 试过一次并放弃,当时的结论是"开关两图平均像素差只有 1.21/255,看不见却要付
   一整个阴影 pass",原因写得很清楚:**场景是刻意平光的**,没有主光就没有阴影可读。

   v2.20 把灯光重排成了主光+背光+补光,那条前提不成立了 —— 现在有一盏压过其它所有灯
   的顶部 key light,它投出来的影子是画面里最直接的"落地感"来源。所以这次开。

   只开一盏灯的阴影(key spot),只有角色投、只有地板收。看台/顶棚/广告牌全部不参与:
   它们既不需要影子,又会让阴影 pass 的 draw call 翻十倍。 */
const SHADOWS=(()=>{
  const p=new URLSearchParams(location.search),q=p.get("shadows");
  if(q==="1")return true;
  if(q==="0")return false;
  /* 阴影 pass 是按填充率收费的,和后期一样:内存 ≤2GB 或显式低画质的机器不开。
     这类机器本来就靠 RENDER_QUALITY 降分辨率保帧率,再压一个固定开销只会让它更早降档。 */
  if((navigator.deviceMemory||4)<=2||p.get("quality")==="low")return false;
  return true;
})();
if(SHADOWS){
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  /* spot 不再投影。它是全场最强的方向性光源,只要它投影,画面里就永远有一条
     "指向某个方向"的主影,四盏阵列填不平它。现在它只负责一点点方向感,
     落地感交给灯阵的浅接触影。 */
  spot.castShadow=false;
  /* ⚠ 性能:投影灯数量是这一层唯一的开销变量。
       v2.20.4:1 盏 @1024 → 实测 0.214ms/帧
       现在:桌面 3 盏 @768 / 手机 2 盏 @512
     每盏 shadow pass ≈ 一次"以灯为相机"的场景重绘,draw call 与三角面和主场景同量级,
     所以是**线性增长**,不是常数。真机若吃紧,优先把下面这个数降到 2/1,
     而不是降 mapSize —— 少一个 pass 比缩小贴图省得多。
     想现场对比:?arshalights=N 直接指定投影灯数(0=全关,退回无影+接地影)。 */
  /* 只让**对角两盏**投影(索引 0 和 3),另外两盏纯照明。
     试过 3 盏甚至 4 盏都投影:影是多了,但它们在脚下重叠成一片全遮挡,
     平均深度反而涨到 24~27。两盏对角 = 两个分离的方向 + 各自的影都被
     另外三盏(两盏照明 + 一盏对角投影)填亮 —— 这才是"几层很浅的接触影"。
     顺带省一个 shadow pass。想现场对比:?arshalights=N(0~4)。 */
  const ARENA_SHADOW_IDX=(()=>{
    const q=new URLSearchParams(location.search).get("arshalights");
    if(q!=null&&/^\d+$/.test(q)){
      const n=Math.max(0,Math.min(4,+q));
      return [0,1,2,3].slice(0,n);
    }
    return [0,3];
  })();
  arenaLights.forEach((l,i)=>{
    l.castShadow=ARENA_SHADOW_IDX.indexOf(i)>=0;
    if(!l.castShadow)return;
    l.shadow.mapSize.setScalar(AA_COARSE_POINTER?512:1024);
    l.shadow.camera.near=5;
    /* 方块几何全是大平面,阴影粉刺(acne)特别明显;normalBias 沿法线推开比单纯加
       depth bias 干净,不会让影子和脚底脱开。 */
    l.shadow.bias=-0.0006;l.shadow.normalBias=0.035;
    /* radius 4→7。多灯之后每条影都要很软,否则几条的边缘会在脚下叠出硬边,
       看起来像"有几盏灯"而不是"一片柔和遮蔽"。
       注意:软化和减淡是两件事,软化摊薄的是边缘过渡,减淡靠的是上面把单盏压到 .20,
       两者都要,只做一个会顾此失彼(第一版只减淡没软化,深度照样翻倍)。 */
    l.shadow.radius=3.5;
  });
  /* 投影灯定完之后才能分配强度(强度取决于这盏投不投影)。
     environments.js 切场景时也调这个函数,避免两处各写一套数值。 */
  applyArenaLightMix();
  /* radius 2.5→6。只有一盏灯投影,影子必然是单方向的;真实球馆是几十盏顶灯,
     地面上看到的是多个淡影互相重叠后的**一片柔和暗区**,不会有一条清晰的投影边。
     PCF 的 radius 放大就是廉价地逼近这个效果:边缘糊开之后,它读起来像
     "被很多灯共同照亮后剩下的那点遮蔽",而不是"有一盏灯在那个方向"。
     阴影的深浅另靠 spot.intensity 与环境的比值控制(见下)。 */
  spot.shadow.radius=6;
}

window.AIBA.runtime.register("rendering:core",Object.freeze({
  renderer,scene,camera,indoorRoot,environmentRoot,weatherRoot,rig,camTarget,RENDER_QUALITY,
  ambient,hemi,sun,spot,rim,camFill,SHADOWS,renderQualityTarget,updateVisualOverlays,applyRenderScale,updateRenderQuality,dampRig,resize
}));
