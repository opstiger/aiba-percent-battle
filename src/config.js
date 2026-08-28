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
    ionescu:{speed:1.08,window:1.06,arc:1.05,arcLabel:"高弧快射",label:"快速出手"},
    taurasi:{speed:1,window:1.05,arc:1.03,arcLabel:"标准高弧",label:"冷血出手"},
    "sue-bird":{speed:.99,window:1.04,arc:1,arcLabel:"平稳弧线",label:"节奏出手"}
  });

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
    DEFAULT_BODY,
    BODY_PROFILES,
    shotProfileFor,
    shotFlightTime,
    bodyProfileFor
  });
})(window);
