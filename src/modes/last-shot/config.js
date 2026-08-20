/* ---------------- 每日挑战 · 绝杀时刻 | 关卡配置 ----------------
   PRD 要求关卡不能写死在页面里,这里是配置驱动的 DailyChallengeConfig。
   坐标系与全场一致:进攻方向 -z,己方篮筐在 z=-8,中线在 z≈4.245。
   choreography 里每个角色是一串路点 {t,x,z};t 是回合内秒数,位置按段线性插值。 */
(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx)throw new Error("Last Shot config requires AIBA runtime legacy adapter");
  const {V3,RACKS}=ctx;

  // 出手窗口之前的现场回合时长;传球在 PASS_AT 发生,之后剩余时间就是出手窗口。
  const LIVE_DUR=4.6,PASS_AT=4.6,GAME_CLOCK=7.0;

  function wp(t,x,z){return {t,p:V3(x,0,z)};}

  /* 首关:致敬"总决赛最后一投"的情境——落后 1 分、剩 7 秒、球最后交到三分线外的你手上。
     刻意不使用真实球员姓名、号码、球队配色与 Logo,只复刻情境。 */
  const LAST_SHOT_98={
    challengeId:"ls-tribute-finals",
    title:"THE LAST SHOT",
    subtitle:"总决赛 · 第四节最后 7 秒",
    storyType:"championship",
    scoreHome:85,scoreAway:86,          // 你是主队,落后 1 分
    homeName:"你的球队",awayName:"卫冕冠军",
    gameClock:GAME_CLOCK,
    liveDur:LIVE_DUR,passAt:PASS_AT,
    shotSpot:RACKS[3],                   // 右侧 45°,三分线外
    shotSpotName:"右侧 45°",
    star:{name:"队内核心",jersey:0xc8102e,shorts:0x8f0a1f},
    introText:[
      "总决赛第六场 · 你们客场落后 1 分",
      "全场 7 秒 · 最后一次进攻机会",
      "教练把球交给核心 —— 但对手会包夹他"
    ],
    timeoutDialogue:"教练:球给核心走弱侧,他被包夹就外弹,右侧 45° 你必须敢投。",
    teammateDialogue:"核心:他们会来两个人。球到你手里,别犹豫。",
    commentary:"包夹上来了!球分出来 —— 三分线外有人!",
    commentaryEvent:"lastshot_commentary_finals",
    crowdMood:"away",                    // 客场:嘘声为主
    practiceEnabled:true,
    team:{ally:{jersey:0xf2f4f7,shorts:0xc8102e},foe:{jersey:0x2c3550,shorts:0x151b2b}},
    /* 5v5 编排。ally0 是持球核心,ally1..3 是拉开的队友(你本人是第 5 人)。
       核心走弱侧(球场左路),你在右路 45°——这样第一人称看过去是一条横穿全场的干净视线,
       你自己的防守人不会挡在中间。foe2 在 t≈3.6 过来包夹,这就是球最后会分给你的原因。 */
    choreography:{
      /* 最后 7 秒不是散步。核心持球两次变向突破:先右路试探,crossover 拉回左路加速,
         再变回中路被逼向左侧底角。平均 2.4m/s、变向段峰值近 5m/s,接近真实持球突破;
         squad 的 poseDribble 会按横向位移自动换手。 */
      /* height 是身高倍率(1.0 ≈ 1.95m)。真实阵容不可能一个位置一样高：
         控卫最矮、锋线居中、中锋最高；攻防对位之间也各有高矮差，不是照镜子。 */
      ally0:{role:"handler",height:.94,path:[wp(0,0.2,3.8),wp(0.7,1.5,2.2),wp(1.5,-0.6,0.6),wp(2.3,-2.6,-0.4),wp(3.1,-1.4,-1.9),wp(3.9,-2.8,-3.0),wp(4.6,-2.9,-3.4)]},
      // 无球队友也要动起来:切入再外弹,而不是原地站 4.6 秒
      ally1:{role:"spacer",height:.99,path:[wp(0,-6.4,-4.0),wp(1.6,-7.2,-6.2),wp(3.0,-5.6,-6.8),wp(4.6,-7.1,-6.0)]},
      ally2:{role:"spacer",height:1.04,path:[wp(0,-4.0,1.2),wp(1.7,-5.4,-1.4),wp(3.2,-4.2,-2.6),wp(4.6,-5.2,-0.9)]},
      ally3:{role:"big",height:1.12,path:[wp(0,-0.8,-5.6),wp(1.8,0.6,-6.8),wp(3.2,-0.4,-7.0),wp(4.6,0.6,-6.8)]},
      /* 盯你的人:全程走底线侧,先沉下去协防(所以你才会空位),球分出来才扑回来。
         必须同时躲开两条视线——观看阶段你朝西看核心,出手阶段你朝篮筐:
         走球场中路会正好压在观看视线上把画面挡死(实测只偏 0.34),所以贴底线绕。
         终点取"正前方 1.5、侧向 1.3",偏离观看视线 1.95,有压迫感但两个阶段都不挡。 */
      foe0:{role:"onBall",height:1.02,marks:"you",path:[wp(0,6.2,-4.2),wp(2.6,5.6,-5.4),wp(3.8,5.4,-5.6),wp(4.6,5.45,-4.9),wp(6.2,5.48,-4.36)]},
      /* 包夹要从两侧夹,不是叠在一起:foe1/foe2 各自离核心约 1.1,彼此约 1.6。
         方块球员肩宽约 0.75,任何一对中心距小于 0.95 就会明显穿模。 */
      /* 贴防必须跟着变向走，且始终卡在持球人与篮筐之间。每个路点与 ally0 同刻位置
         相距约 1.05——大于 MIN_GAP(0.98) 才不会被 separate() 反复推开。 */
      foe1:{role:"onHandler",height:.96,marks:"ally0",path:[wp(0,0.5,2.75),wp(0.7,1.35,1.15),wp(1.5,-0.5,-0.45),wp(2.3,-2.5,-1.45),wp(3.1,-1.3,-2.95),wp(3.9,-2.7,-4.05),wp(4.6,-2.8,-4.45)]},
      // help:true = 这是战术包夹，走编排路点；其余对位防守全部交给 squad 的延迟追踪
      foe2:{role:"help",height:1.06,marks:"ally0",help:true,path:[wp(0,-0.2,-4.4),wp(1.8,-1.2,-5.6),wp(2.8,-2.4,-4.9),wp(3.6,-3.85,-4.35),wp(4.6,-4.05,-4.25)]},
      foe3:{role:"wing",height:1.01,marks:"ally1",path:[wp(0,-5.2,-2.6),wp(1.6,-6.4,-5.3),wp(3.0,-4.9,-6.0),wp(4.6,-6.3,-5.2)]},
      foe4:{role:"rim",height:1.14,marks:"ally3",path:[wp(0,-0.45,-6.7),wp(0.8,-0.06,-7.33),wp(1.8,-0.4,-7.5),wp(3.2,-1.4,-7.5),wp(4.6,-0.4,-7.5)]}
    }
  };


  /* 第二关:主场抢七、落后 2 分——必须是三分,两分打平也没用。
     出手点换到弧顶(RACKS[2]),持球人从右路突破被逼到底角,球往回吊到弧顶。
     和首关的最大区别:你在正中间,视线最开阔,但防守人也最容易扑到正面。 */
  const GAME_SEVEN={
    challengeId:"ls-game-seven",
    title:"GAME SEVEN",
    subtitle:"抢七 · 第四节最后 6 秒",
    storyType:"rivalry",
    scoreHome:98,scoreAway:100,          // 落后 2 分:两分打平不够,必须三分
    homeName:"你的球队",awayName:"宿敌",
    gameClock:6.4,
    liveDur:4.2,passAt:4.2,
    shotSpot:RACKS[2],
    shotSpotName:"弧顶",
    star:{name:"队内核心",jersey:0x1d428a,shorts:0x122f61},
    introText:[
      "系列赛 3-3 · 抢七第四节最后 6 秒",
      "落后 2 分 —— 两分打平没用,这一球必须是三分",
      "主场山呼海啸,但对手的包夹只会更凶"
    ],
    timeoutDialogue:"教练:落后两分,别贪两分。核心右路强攻吸包夹,球回弧顶,你敢投就投。",
    teammateDialogue:"核心:他们防的是我。球一出去,你别想别的,直接起。",
    commentary:"两个人扑上去了!球吊回弧顶 —— 有人空位!",
    commentaryEvent:"lastshot_commentary_g7",
    crowdMood:"home",
    practiceEnabled:true,
    team:{ally:{jersey:0xf2f4f7,shorts:0x1d428a},foe:{jersey:0x2b1b3d,shorts:0x1a1028}},
    choreography:{
      // 核心右路强攻到底角,被逼停后回传弧顶
      ally0:{role:"handler",height:.95,path:[wp(0,-0.4,3.2),wp(0.8,1.8,1.6),wp(1.7,3.6,-0.6),wp(2.6,5.0,-2.8),wp(3.4,5.8,-4.6),wp(4.2,5.6,-5.2)]},
      ally1:{role:"spacer",height:1.0,path:[wp(0,-6.0,-3.4),wp(1.5,-6.9,-5.8),wp(2.9,-5.4,-6.4),wp(4.2,-6.8,-5.6)]},
      ally2:{role:"spacer",height:1.03,path:[wp(0,-4.6,0.8),wp(1.6,-5.8,-1.8),wp(3.0,-4.6,-3.0),wp(4.2,-5.6,-1.4)]},
      ally3:{role:"big",height:1.13,path:[wp(0,-1.6,-5.4),wp(1.8,-2.4,-6.9),wp(3.2,-1.4,-7.1),wp(4.2,-2.2,-6.7)]},
      /* 盯你的人:你在弧顶正中,他必须从侧翼过来,不能压在"你->核心"(指向右路)
         和"你->篮筐"(正南)这两条线上。走左侧偏后,两条线都躲开。 */
      foe0:{role:"onBall",height:1.03,marks:"you",path:[wp(0,-2.6,1.6),wp(2.2,-2.9,0.4),wp(3.4,-2.6,-0.6),wp(4.2,-2.2,-1.2),wp(6.0,-1.9,-1.5)]},
      // 贴防跟着右路突破走,始终卡在核心与篮筐之间
      foe1:{role:"onHandler",height:.97,marks:"ally0",path:[wp(0,-0.3,2.2),wp(0.8,1.6,0.6),wp(1.7,3.2,-1.5),wp(2.6,4.4,-3.6),wp(3.4,5.0,-5.3),wp(4.2,4.8,-5.9)]},
      // 战术包夹:从底线侧兜上来,和 foe1 分两侧
      foe2:{role:"help",height:1.07,marks:"ally0",help:true,path:[wp(0,2.2,-5.6),wp(1.6,3.4,-6.2),wp(2.8,4.8,-6.4),wp(3.6,6.2,-6.2),wp(4.2,6.5,-6.0)]},
      foe3:{role:"wing",height:1.02,marks:"ally1",path:[wp(0,-4.9,-2.0),wp(1.6,-6.1,-4.9),wp(3.0,-4.7,-5.6),wp(4.2,-6.0,-4.8)]},
      foe4:{role:"rim",height:1.15,marks:"ally3",path:[wp(0,-1.25,-6.55),wp(1.8,-1.9,-7.9),wp(3.2,-1.0,-8.1),wp(4.2,-1.75,-7.8)]}
    }
  };

  /* 第三关:客场平局、剩 5 秒——进了直接赢,不进就加时。
     出手点换到左底角(RACKS[0]),空间最挤、离边线最近,是最难的一个点。
     持球人这次从弧顶正面强突被夹,球顺势甩到底角。 */
  const CORNER_BURIED={
    challengeId:"ls-corner-buried",
    title:"CORNER BURIED",
    subtitle:"客场 · 平局 · 最后 5 秒",
    storyType:"revenge",
    scoreHome:104,scoreAway:104,         // 平局:进了直接赢
    homeName:"你的球队",awayName:"主场球队",
    gameClock:5.4,
    liveDur:3.6,passAt:3.6,
    shotSpot:RACKS[0],
    shotSpotName:"左底角",
    star:{name:"队内核心",jersey:0x007a33,shorts:0x00521f},
    introText:[
      "客场 · 第四节最后 5 秒 · 分差为零",
      "进了直接带走比赛,不进就是加时",
      "全场都在喊你们的名字 —— 用最难听的那种喊法"
    ],
    timeoutDialogue:"教练:核心正面强突,他们一定收缩。球出来就是底角,那是全场最空的地方。",
    teammateDialogue:"核心:底角，别退到边线外。脚下留一步，我看得见你。",
    commentary:"收缩了!球甩到底角 —— 底角有人!",
    commentaryEvent:"lastshot_commentary_corner",
    crowdMood:"away",
    practiceEnabled:true,
    team:{ally:{jersey:0xf2f4f7,shorts:0x007a33},foe:{jersey:0x3d1f1f,shorts:0x281414}},
    choreography:{
      // 核心从弧顶正面强突禁区,被收缩包夹后甩底角
      ally0:{role:"handler",height:.96,path:[wp(0,0.6,2.6),wp(0.9,0.2,0.4),wp(1.8,-0.8,-1.8),wp(2.7,-2.0,-3.6),wp(3.6,-3.0,-4.6)]},
      ally1:{role:"spacer",height:1.01,path:[wp(0,5.6,-2.2),wp(1.4,6.6,-4.6),wp(2.6,5.4,-5.6),wp(3.6,6.4,-4.4)]},
      ally2:{role:"spacer",height:1.05,path:[wp(0,4.2,1.4),wp(1.5,5.4,-0.8),wp(2.6,4.4,-2.2),wp(3.6,5.2,-0.6)]},
      ally3:{role:"big",height:1.12,path:[wp(0,1.8,-5.2),wp(1.6,2.6,-6.6),wp(2.8,1.6,-7.0),wp(3.6,2.4,-6.6)]},
      /* 盯你的人:你在左底角,"你->核心"指向东北、"你->篮筐"指向东南。
         他从弧顶侧沉下来收缩(所以你才空),走两条线中间偏北的空档。 */
      foe0:{role:"onBall",height:1.04,marks:"you",path:[wp(0,-5.6,-0.4),wp(1.8,-5.9,-1.4),wp(2.8,-5.8,-2.2),wp(3.6,-5.6,-2.8),wp(5.2,-5.5,-3.2)]},
      foe1:{role:"onHandler",height:.98,marks:"ally0",path:[wp(0,0.5,1.55),wp(0.9,0.15,-0.65),wp(1.8,-0.7,-2.85),wp(2.7,-1.85,-4.65),wp(3.6,-2.8,-5.65)]},
      // 收缩包夹:护框的人上来,和 foe1 分两侧夹
      foe2:{role:"help",height:1.08,marks:"ally0",help:true,path:[wp(0,-2.4,-5.8),wp(1.4,-2.8,-5.4),wp(2.4,-3.2,-4.6),wp(3.6,-4.1,-4.1)]},
      foe3:{role:"wing",height:1.03,marks:"ally1",path:[wp(0,4.6,-1.2),wp(1.4,5.6,-3.7),wp(2.6,4.5,-4.8),wp(3.6,5.5,-3.6)]},
      foe4:{role:"rim",height:1.16,marks:"ally3",path:[wp(0,1.5,-6.35),wp(1.6,2.1,-7.75),wp(2.8,1.2,-8.1),wp(3.6,1.9,-7.75)]}
    }
  };

  const CHALLENGES=[LAST_SHOT_98,GAME_SEVEN,CORNER_BURIED];

  /* 每日挑战按 UTC 日期轮转:全球同一天拿到同一关,避免时区导致的关卡不一致。
     MVP 只有一关,取模后恒定;加关后自动开始轮换。 */
  function challengeDateKey(now){
    const d=now?new Date(now):new Date();
    return d.toISOString().slice(0,10);
  }
  function dailyChallenge(now){
    const key=challengeDateKey(now);
    const days=Math.floor(Date.parse(key+"T00:00:00Z")/86400000);
    return CHALLENGES[((days%CHALLENGES.length)+CHALLENGES.length)%CHALLENGES.length];
  }
  function msUntilReset(now){
    const t=now?new Date(now):new Date();
    const next=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()+1);
    return Math.max(0,next-t.getTime());
  }

  /* ---------------- 剧情选择 ----------------
     正式挑战按 PRD 仍然走每日轮转（全球同一天同一关，否则连胜榜没有可比性）。
     玩家选的剧情只作用于练习模式；正式那一次永远是当天那关。
     pickedChallenge() 是"界面上正在展示的那一关"，默认就是今天的。 */
  let picked=null;
  function challengeById(id){return CHALLENGES.find(c=>c.challengeId===id)||null;}
  function pickChallenge(id){picked=challengeById(id);return picked;}
  function pickedChallenge(now){return picked||dailyChallenge(now);}
  /* practice=true 用选中的剧情，false（正式）强制回到当天那关 —— 
     选择器不能成为绕开每日轮转的后门。 */
  function activeChallenge(practice,now){return practice?pickedChallenge(now):dailyChallenge(now);}

  const api=Object.freeze({CHALLENGES,dailyChallenge,challengeDateKey,msUntilReset,
    challengeById,pickChallenge,pickedChallenge,activeChallenge,
    LIVE_DUR,PASS_AT,GAME_CLOCK});
  global.AIBALastShotConfig=api;
  runtime.register("mode:last-shot:config",api);
})(window);
