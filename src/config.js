(function(global){
  "use strict";

  const DIFFS=Object.freeze({
    easy:{n:"新秀",zone:11,fill:80,ai:-0.085,hideBar:99,latK:0.012,underSave:0.16,d:"甜区超大 · 前70%显示投篮条 · 最后30%靠手感"},
    normal:{n:"全明星",zone:5.5,fill:95,ai:0,hideBar:1,latK:0.02,underSave:0.10,d:"甜区收窄 · 第2个球架起隐藏投篮条"},
    hard:{n:"名人堂",zone:3.2,fill:110,ai:0.055,hideBar:1,latK:0.028,underSave:0,d:"甜区极窄 · 第2架起盲投 · 手机倾斜更敏感"}
  });

  const RACK_RUSH_LEVELS=Object.freeze([
    {name:"热身启动",time:30,feed:1.35,targets:{easy:18,normal:20,hard:22},bar:"all"},
    {name:"节奏加速",time:35,feed:1.25,targets:{easy:26,normal:30,hard:34},bar:"all"},
    {name:"压力测试",time:40,feed:1.15,targets:{easy:36,normal:42,hard:48},bar:"time10"},
    {name:"火力全开",time:40,feed:1.05,targets:{easy:48,normal:56,hard:64},bar:"shots5"},
    {name:"极限盲投",time:45,feed:.95,targets:{easy:62,normal:72,hard:80},bar:"none"},
    {name:"FINAL RUSH",time:30,feed:.9,targets:null,bar:"none",final:true}
  ]);

  const SCENE_PRESETS=Object.freeze({
    indoor:{name:"室内经典",type:"indoor",weather:"none",progression:"none",desc:"木地板、看台与球馆灯光"},
    outdoorSunny:{name:"晴天街头",type:"outdoor",weather:"sunny",progression:"none",desc:"蓝天、围栏与城市公园"},
    rainyCourt:{name:"雨天街头",type:"outdoor",weather:"rain",progression:"none",desc:"湿润球场、阴云与轻量雨势"},
    flowerCourt:{name:"鲜花球场",type:"outdoor",weather:"sunny",progression:"flowerBloom",desc:"从杂草到花海，每次得分都会永久生长"},
    beachSunset:{name:"西海岸夕阳",type:"outdoor",weather:"sunny",progression:"sunsetToNight",desc:"海边黄昏随比分推进至夜场"}
  });

  const WEATHER_SHOT_MODIFIERS=Object.freeze({
    none:{idealBias:0,noiseMin:0,noiseMax:0},
    sunny:{idealBias:0,noiseMin:0,noiseMax:0},
    rain:{idealBias:3.5,noiseMin:-1,noiseMax:1.5}
  });

  const CLASSIC_LEGENDS=Object.freeze([
    {id:"nova24",n:"N-24 夜航者",t:"VOXEL PRO 原型 · 双层战衣",r:94,col:[0x11151c,0xf4c542],accent:0x6ff3ff,num:24,
     skin:0x8d5524,shoe:0xf0f2ed,headband:false,wrist:0xf4c542,sleeve:0x0a0d12,hair:0x101010,hairStyle:"cornrows",beard:false,
     visualProfile:"voxel-pro-01",body:{h:1.02,w:.98}},
    {id:"curry",n:"斯蒂芬·库里",t:"四届总冠军 · 历史三分王",r:97,col:[0x1d428a,0xffc72c],num:30},
    /* 全表第一个左手球星。hand:"left" 决定四件事:球架摆在哪一侧、取球往哪边转身、
       整副骨架左右镜像(guy.g.scale.x 取负,第一人称 rig 同理)、球衣号码贴图预翻转
       —— 不预翻转的话镜像会把号码照出反字。
       没有这个字段的球星一律按右手处理,所以老球星逐位不变。 */
    {id:"h13",n:"詹姆斯·哈登",t:"三届得分王 · 左手后撤步",r:93,col:[0xce1141,0xf7f7f7],num:13,hand:"left",
     skin:0x8d5524,shoe:0xce1141,headband:false,wrist:0xf7f7f7,sleeve:0x111111,hair:0x14100d,hairStyle:"fade",beard:0x1a120c},
    {id:"thompson",n:"克莱·汤普森",t:"四届总冠军 · 单节37分",r:93,col:[0xffc72c,0x1d428a],num:11},
    {id:"allen",n:"雷·阿伦",t:"两届总冠军 · 致命底角",r:91,col:[0x007a33,0xffffff],num:20},
    {id:"bird",n:"拉里·伯德",t:"三届总冠军 · 三届MVP",r:89,col:[0x007a33,0x111111],num:33},
    {id:"miller",n:"雷吉·米勒",t:"五届全明星 · 关键三分",r:88,col:[0xfdbb30,0x002d62],num:31},
    {id:"lillard",n:"达米安·利拉德",t:"八届全明星 · 超远三分",r:90,col:[0xe03a3e,0x111111],num:0},
    {id:"korver",n:"凯尔·科沃尔",t:"全明星射手 · 接球投篮",r:86,col:[0xc8102e,0x26282a],num:26},
    {id:"stojakovic",n:"佩贾·斯托贾科维奇",t:"两届三分大赛冠军",r:87,col:[0x5a2d81,0x8a8d8f],num:16},
    {id:"ionescu",n:"萨布丽娜·约内斯库",t:"WNBA全明星 · 三分大赛纪录",r:91,col:[0x6eceb2,0x101820],num:20,sex:"f",hairStyle:"ponytail",hair:0x3a2410,skin:0xf4c89c},
    {id:"taurasi",n:"戴安娜·陶乐西",t:"三届WNBA总冠军 · 历史得分王",r:92,col:[0x2b1a4e,0xe56020],num:3,sex:"f",hairStyle:"bun",hair:0x1a1210,skin:0xe8c39a},
    {id:"sue-bird",n:"苏·伯德",t:"四届WNBA总冠军 · 传奇控卫",r:89,col:[0x2c5234,0xffc600],num:10,sex:"f",hairStyle:"ponytail",hair:0x4a2c12,skin:0xf4c89c}
  ]);

  const DEFAULT_SHOT_PROFILE=Object.freeze({speed:1,window:1,arc:1,arcLabel:"标准弧线",label:"标准出手"});
  const SHOT_PROFILES=Object.freeze({
    nova24:{speed:1.02,window:1.04,arc:1.05,arcLabel:"锐角中高弧",label:"节奏快射"},
    curry:{speed:1.13,window:1.1,arc:1.1,arcLabel:"高弧快射",label:"极速出手"},
    thompson:{speed:1.09,window:1.08,arc:.98,arcLabel:"平快定点",label:"快速定点"},
    allen:{speed:1.02,window:1.09,arc:.94,arcLabel:"低平快弧",label:"标准快出手"},
    bird:{speed:.88,window:1.1,arc:1.12,arcLabel:"慢节奏高抛",label:"沉稳高出手"},
    miller:{speed:1,window:1.02,arc:1,arcLabel:"标准弧线",label:"标准出手"},
    lillard:{speed:1.07,window:.98,arc:1.08,arcLabel:"远射高弧",label:"快速远射"},
    korver:{speed:1.1,window:1.12,arc:1.02,arcLabel:"接投快弧",label:"极速接投"},
    stojakovic:{speed:.94,window:1.07,arc:1.11,arcLabel:"舒展高弧",label:"舒展出手"},
    k24:{speed:.89,window:.97,arc:1.06,arcLabel:"后仰中高弧",label:"沉稳后仰"},
    j23:{speed:.84,window:.94,arc:1.13,arcLabel:"滞空高弧",label:"滞空出手"},
    a03:{speed:1.04,window:.99,arc:.96,arcLabel:"低平快拔",label:"快速拔起"},
    v15:{speed:.87,window:.92,arc:1.15,arcLabel:"高点大弧",label:"高点出手"},
    t01:{speed:.92,window:.97,arc:.90,arcLabel:"极低平弧",label:"舒展远射"},
    h13:{speed:.96,window:1.03,arc:1.04,arcLabel:"后撤高弧",label:"左手后撤"},
    ionescu:{speed:1.08,window:1.06,arc:1.05,arcLabel:"高弧快射",label:"快速出手"},
    taurasi:{speed:1,window:1.05,arc:1.03,arcLabel:"标准高弧",label:"冷血出手"},
    "sue-bird":{speed:.99,window:1.04,arc:1,arcLabel:"平稳弧线",label:"节奏出手"}
  });

  /* ---------------- 投篮动作风格 ----------------
     和上面的 SHOT_PROFILES 分开:那张表管**玩法**(甜区/蓄力速度/弧线),这张表只管
     **动作外观**。命中与否由 releaseShot 里的 power 对 ideal 决定,和这里一个字都无关 ——
     所以调这张表不会影响任何人的手感。

     六个量,全部有中性默认值(未列出的球星逐位维持今天的动作):
       kick     出手后空中踢腿幅度倍数(1=今天)
       lean     后仰弧度,正=后仰,随 jmp 淡入
       turn     侧身弧度,正=向非投篮手一侧转开,随 lift 淡入
       release  持球点高度偏移(米)
       setPoint 段式。**正=二段式**(抬球先到位、停一下再起跳),**负=一段式**(抬球和起跳连贯)
       drift    出手后前后位移(米),正=向篮筐
     幅度刻意压小:后仰/侧身都在 6° 以内,出手点 ±5cm,前后 ±8cm。
     目的是"看得出是不同的人",不是"换一套动作"。 */
  const DEFAULT_SHOT_STYLE=Object.freeze({kick:1,lean:0,turn:0,release:0,setPoint:0,drift:0});
  const SHOT_STYLES=Object.freeze({
    /* 踢腿是这套差异里**唯一隔着半个球场都看得出来**的量,所以跨度给到 0.10~1.95(19.5 倍)。
       第一版我把这一项压在 0.20~1.60,而且把麦迪配成了倒数第二小 —— 完全配反了。
       真实特征:麦迪的招牌就是出手后那记大幅甩腿;库里/汤普森是极紧凑的教科书型,
       几乎不踢;科比是大踢腿 + 前跳 + 后仰同时出现。 */
    /* 踢腿最大。麦迪出手后甩腿幅度是全联盟最夸张的之一 */
    t01:{kick:1.95,lean:.05,turn:.05,release:.02,setPoint:-.03,drift:-.02},
    miller:{kick:1.70,lean:.03,turn:.09,release:.01,setPoint:.02,drift:.03},
    /* 大踢腿 + 前跳 + 后仰。前跳和后仰同时出现是他最好认的组合 */
    k24:{kick:1.55,lean:.10,turn:.11,release:.035,setPoint:.05,drift:.09},
    v15:{kick:1.25,lean:0,turn:0,release:.05,setPoint:0,drift:0},
    /* 后撤步:明显向后 + 轻微后仰,踢腿中等 */
    h13:{kick:.80,lean:.06,turn:.05,release:.01,setPoint:-.02,drift:-.09},
    j23:{kick:1.10,lean:.08,turn:.07,release:.045,setPoint:.04,drift:-.05},
    lillard:{kick:.95,lean:.04,turn:0,release:0,setPoint:-.04,drift:-.05},
    a03:{kick:.70,lean:0,turn:.03,release:-.045,setPoint:-.05,drift:.07},
    nova24:{kick:.60,lean:0,turn:0,release:0,setPoint:-.02,drift:0},
    taurasi:{kick:.55,lean:.05,turn:.04,release:0,setPoint:.03,drift:-.02},
    stojakovic:{kick:.50,lean:0,turn:.02,release:.045,setPoint:.02,drift:0},
    ionescu:{kick:.40,lean:0,turn:0,release:.01,setPoint:-.04,drift:0},
    bird:{kick:.35,lean:0,turn:.03,release:.02,setPoint:.06,drift:0},
    korver:{kick:.20,lean:0,turn:0,release:.02,setPoint:-.03,drift:0},
    allen:{kick:.18,lean:0,turn:0,release:.01,setPoint:-.02,drift:0},
    "sue-bird":{kick:.18,lean:0,turn:0,release:-.01,setPoint:-.02,drift:0},
    /* 库里 / 汤普森:几乎不踢腿。两个人是全表最小值,和麦迪拉开一个数量级 */
    curry:{kick:.15,lean:0,turn:.02,release:-.01,setPoint:-.06,drift:.05},
    thompson:{kick:.10,lean:0,turn:0,release:.015,setPoint:0,drift:0}
  });
  /* 惯用手。没写 hand 的一律右手 —— 老球星因此逐位不变。 */
  function shootingHandFor(star){
    return (star&&star.hand==="left")?"left":"right";
  }
  /* 球架摆在**辅助手**那一侧(不是投篮手那一侧):
       右手球员 → 架子在左边   左手球员 → 架子在右边
     因为蓄力时躯干朝辅助手一侧打开,架子放在那边伸手才顺。
     返回值 +1/-1 是沿 props.js 里 perp=(dir.z,0,-dir.x) 的倍数,
     而 perp 指向球员的**左**手边 —— 所以右手球员取 +1。 */
  function rackSideFor(star){return shootingHandFor(star)==="left"?-1:1;}
  /* 绕架习惯。走位是两点直线,而球架沿出手线往站位**后方**伸约 1m,
     正好压在相邻点位的弦上 —— 球员必须在最后一段绕开它。
     绕前(front)= 从靠篮筐那一端抄进去,路径短、显得急;
     绕后(back) = 从远离篮筐那一端兜过去,路径长、显得稳。
     这是个人习惯,和出手动作一样按球星分,没配的一律 front。 */
  const RACK_DETOURS=Object.freeze({
    curry:"front",lillard:"front",a03:"front",ionescu:"front",
    thompson:"front",nova24:"front",taurasi:"front",k24:"front",
    miller:"back",bird:"back",korver:"back",allen:"back",
    "sue-bird":"back",stojakovic:"back",t01:"back",v15:"back",
    j23:"back",h13:"back"
  });
  function rackDetourFor(star){
    const m=RACK_DETOURS[star&&(star.id||star.n)];
    return m==="back"?"back":"front";
  }
  function shotStyleFor(star){
    const raw=SHOT_STYLES[star&&(star.id||star.n)];
    return raw?Object.assign({},DEFAULT_SHOT_STYLE,raw):DEFAULT_SHOT_STYLE;
  }

  /* 体型档案:h=身高缩放 w=横向体格缩放,按真实球员身材粗调
     (库里1.88偏瘦 / 伯德2.06 / 米勒瘦长 / AI 1.83小个 / KD高瘦 / 女性球员整体更小) */
  const DEFAULT_BODY=Object.freeze({h:1,w:1});
  const BODY_PROFILES=Object.freeze({
    nova24:{h:1.02,w:.98},
    curry:{h:.97,w:.96},
    thompson:{h:1.01,w:1.02},
    allen:{h:1,w:.99},
    bird:{h:1.05,w:1.03},
    miller:{h:1.02,w:.92},
    lillard:{h:.97,w:1.04},
    korver:{h:1.02,w:1},
    stojakovic:{h:1.05,w:1.01},
    k24:{h:1.01,w:1},
    j23:{h:1.01,w:1.02},
    a03:{h:.93,w:.94},
    v15:{h:1.01,w:1.03},
    t01:{h:1.07,w:.93},
    ionescu:{h:.94,w:.9},
    taurasi:{h:.95,w:.93},
    "sue-bird":{h:.92,w:.88}
  });
  function bodyProfileFor(star){
    if(star&&star.body)return star.body;
    return BODY_PROFILES[star&&(star.id||star.n)]||DEFAULT_BODY;
  }

  function shotProfileFor(star){
    if(star&&star.shotProfile)return star.shotProfile;
    return SHOT_PROFILES[star&&(star.id||star.n)]||DEFAULT_SHOT_PROFILE;
  }
  function shotFlightTime(baseTf,star,opts){
    const p=shotProfileFor(star);
    const deep=opts&&opts.deep;
    const arc=Number(p.arc)||1;
    const scaled=1+(arc-1)*(deep?0.72:1);
    return baseTf*Math.max(.9,Math.min(1.16,scaled));
  }

  global.AIBA_CONFIG=Object.freeze({
    LEADERBOARD_API:"https://aiba-leaderboard-api.tiger-seeker.workers.dev",
    DIFFS,
    RACK_RUSH_LEVELS,
    SCENE_PRESETS,
    WEATHER_SHOT_MODIFIERS,
    CLASSIC_LEGENDS,
    DEFAULT_SHOT_PROFILE,
    SHOT_PROFILES,
    SHOT_STYLES,
    DEFAULT_SHOT_STYLE,
    DEFAULT_BODY,
    BODY_PROFILES,
    shotProfileFor,
    shotStyleFor,
    shootingHandFor,
    rackSideFor,
    RACK_DETOURS,
    rackDetourFor,
    shotFlightTime,
    bodyProfileFor
  });
})(window);
