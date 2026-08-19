/* ---------------- 每日挑战 · 绝杀时刻 | 入口、每日闸门与结算 ----------------
   MVP 为纯前端:每日一次的闸门与 streak 都记在本地。
   本地闸门挡得住误触和刷新,挡不住清缓存/换设备——正式榜单必须等服务端版本(见 docs)。
   为了不让"刷新页面重来"变成免费重试,机会在开赛那一刻就被消耗,而不是等出结果。 */
(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  const cfgApi=global.AIBALastShotConfig,seq=global.AIBALastShotSequence,squadApi=global.AIBALastShotSquad;
  if(!runtime||!ctx||!cfgApi||!seq||!squadApi)throw new Error("Last Shot mode requires runtime, config, squad and sequence");
  const {G,showPanel,hidePanel,showMenu,applyCamMode,startConfetti,cheerSound,airhorn,boo,paSay,toast}=ctx;

  const KEY="aiba.lastshot.v1";

  function read(){
    try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}
  }
  function write(s){
    try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}
  }
  function store(){
    const s=read()||{};
    return {lastDate:s.lastDate||"",pending:!!s.pending,lastResult:s.lastResult||"",
      streak:s.streak|0,streakDate:s.streakDate||"",bestStreak:s.bestStreak|0,
      totalWins:s.totalWins|0,totalPlayed:s.totalPlayed|0};
  }
  function today(){return cfgApi.challengeDateKey();}
  function yesterdayOf(key){
    const d=Date.parse(key+"T00:00:00Z")-86400000;
    return new Date(d).toISOString().slice(0,10);
  }
  function usedToday(){
    const s=store();return s.lastDate===today();
  }
  /* 开赛即消耗:先落盘 pending,页面被刷掉也算今天用过了。 */
  function consumeAttempt(){
    const s=store();
    s.lastDate=today();s.pending=true;s.lastResult="";s.totalPlayed++;
    write(s);
  }
  /* 上一次是 pending 说明玩家中途离开,按失败结算,并断掉 streak。 */
  function settlePending(){
    const s=store();
    if(!s.pending)return s;
    s.pending=false;s.lastResult="abandon";s.streak=0;write(s);
    return s;
  }
  function recordResult(made){
    const s=store();
    s.pending=false;s.lastResult=made?"made":"miss";
    if(made){
      // 连续:只有昨天也成功才接上,否则从 1 开始
      s.streak=s.streakDate===yesterdayOf(today())?(s.streak|0)+1:1;
      s.streakDate=today();
      s.bestStreak=Math.max(s.bestStreak|0,s.streak);
      s.totalWins=(s.totalWins|0)+1;
    }else{
      s.streak=0;s.streakDate="";
    }
    write(s);
    return s;
  }

  function resetLabel(){
    const ms=cfgApi.msUntilReset(),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);
    return h>0?`${h} 小时 ${m} 分`:`${m} 分`;
  }

  /* ---------------- 入口面板 ---------------- */
  /* 剧情选择器。正式挑战仍是当天那关（PRD 要求全球同一天一致），
     所以选中非今日剧情时只开放练习模式，并在按钮上写清楚。 */
  function pickStory(id){
    if(cfgApi.pickChallenge)cfgApi.pickChallenge(id);
    openLastShot();
  }
  function storyPicker(cfg){
    const list=cfgApi.CHALLENGES||[];
    if(list.length<2)return "";
    const today=cfgApi.dailyChallenge();
    return `<div class="card" style="text-align:left">
      <div style="font-size:11px;color:#9ab;margin-bottom:6px">选择剧情 · 今日正式挑战固定为 <b>${today.title}</b></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${list.map(c=>{
        const on=c.challengeId===cfg.challengeId;
        const isToday=c.challengeId===today.challengeId;
        return `<button class="btn sm" style="flex:1;min-width:92px;${on?"border-color:#ffd23f;color:#ffd23f":""}"
          onclick="AIBALastShot.pickStory('${c.challengeId}')">${c.title}${isToday?" ·今日":""}</button>`;
      }).join("")}</div></div>`;
  }

  function openLastShot(){
    settlePending();
    const cfg=(cfgApi.pickedChallenge?cfgApi.pickedChallenge():cfgApi.dailyChallenge()),s=store(),used=usedToday();
    const today=cfgApi.dailyChallenge();
    const isToday=cfg.challengeId===today.challengeId;
    G.mode="lastshot";G.state="diff";
    const story=cfg.introText.map(t=>`<div>${t}</div>`).join("");
    showPanel(`<h1 class="title" style="font-size:24px">${cfg.title}</h1>
      <div class="sub">${cfg.subtitle}</div>
      <div class="card" style="text-align:left;line-height:1.7">${story}</div>
      <div class="card"><b>${cfg.homeName} ${cfg.scoreHome} : ${cfg.scoreAway} ${cfg.awayName}</b>
        <br><span style="color:#9ab;font-size:11px">比赛钟 ${cfg.gameClock.toFixed(1)} 秒 · 你在${cfg.shotSpotName}三分线外</span></div>
      <div class="card" style="text-align:left;color:#cdd6e3;font-size:12px;line-height:1.7">
        <b>${cfg.timeoutDialogue}</b><br>${cfg.teammateDialogue}</div>
      <div class="card">连续绝杀 <b class="flame">${s.streak}</b> 天 · 最佳 <b>${s.bestStreak}</b> 天
        <br><span style="color:#9ab;font-size:11px">${used?`今日机会已用完 · ${resetLabel()}后刷新`:"今日还有 1 次正式机会"}</span></div>
      ${storyPicker(cfg)}
      ${typeof global.visionModeMarkup==="function"?global.visionModeMarkup():""}
      ${used||!isToday?"":`<button class="btn red" onclick="hidePanel();beginLastShot(false)">开始今日挑战 · 仅此一次</button>`}
      ${!used&&!isToday?`<div class="card" style="font-size:11px;color:#9ab">这不是今日剧情 —— 正式挑战只能打 <b>${today.title}</b>，这一关可以随便练。</div>`:""}
      ${cfg.practiceEnabled?`<button class="btn sm" onclick="hidePanel();beginLastShot(true)">练习模式 · 不计成绩</button>`:""}
      <button class="btn sm" onclick="exitLastShot();showMenu()">返回封面</button>`);
  }

  /* ---------------- 结算 ---------------- */
  /* 没进的时候告诉玩家该怎么调，而不是只说一句"偏了"。
     err = 力度 - 理想力度：负=蓄力不足(出手太早)，正=蓄力过头(出手太晚)。
     zone 是当前难度的甜区半宽，误差落在甜区内说明手感没问题，是被干扰吃掉的。 */
  function missAdvice(reason,diag){
    if(reason==="timeout")return{t:"没能在比赛钟走完前出手",d:"接球就投——这一攻只有两秒出手窗口，犹豫等于放弃。"};
    /* 罚球刚好追平：不是打铁,是进加时,别用"最后一投偏出"糊弄过去 */
    if(reason==="overtime")return{t:"追平了,但比赛还没结束",d:"这一攻拿到的分刚好抹平分差——进加时。要直接带走比赛,还差一分。"};
    if(!diag)return{t:"最后一投偏出",d:"再找找出手节奏。"};
    const err=diag.err||0,zone=Math.max(1,diag.zone||8),contest=diag.contest||0,late=diag.late||0;
    /* 过了投篮条顶点还没松手，系统会按"晚出手"扣力度(shot-physics.js releasePower)，
       err 是扣减之后的数，符号已经不能反映真实原因——蓄太久也可能被扣成 err<0，
       看起来像"蓄力不足"。late>0 就是这个惩罚被触发的原始信号，必须优先判断，
       不能再用 err 的正负简单分蓄力多/少。 */
    if(late>.02){
      if(late>=.6)return{t:"蓄力严重超时 · 出手太晚",d:"几乎按到系统自动出手的临界点，力度被大幅扣减——不是没蓄够，是等太久了。顶点那下轻微震动/提示音一出现就立刻松手。"};
      if(late>=.25)return{t:"蓄力过了顶点 · 出手偏晚",d:"按住的时间超过了最佳点，力度被明显扣减。顶点提示一出现就松手，别等它往下掉。"};
      return{t:"出手略晚 · 刚过顶点",d:"蓄力其实到位了，只是松手慢了一点点被扣了力度。反应再快一丝就稳了。"};
    }
    const inZone=Math.abs(err)<=zone;
    if(inZone&&contest>=.55)
      return{t:"出手时机没问题 · 被封盖了",d:"力度是对的，但你等太久让防守人扑到了正面。下次接球就投，别给他起跳的时间。"};
    if(inZone&&contest>=.38)
      return{t:"出手时机没问题 · 被干扰影响",d:"力度落在甜区内，是防守人的手影响了手感。早零点几秒出手就能空位投。"};
    if(inZone)
      return{t:"力度在甜区 · 差一点点",d:"这一投手感没问题，运气差一口气。保持这个节奏。"};
    if(err<-zone*2)
      return{t:"蓄力严重不足 · 出手太早",d:`力度差了约 ${Math.abs(err).toFixed(0)} 点。按住再多停半拍，等投篮条涨进绿色甜区再松手。`};
    if(err<0)
      return{t:"蓄力偏少 · 出手略早",d:`差约 ${Math.abs(err).toFixed(0)} 点就进甜区了。再多按一点点。`};
    if(err>zone*2)
      return{t:"蓄力过头 · 出手太晚",d:`力度多了约 ${err.toFixed(0)} 点。看到投篮条进绿色就松手，别等它涨满。`};
    return{t:"蓄力偏多 · 出手略晚",d:`多了约 ${err.toFixed(0)} 点。松手再早一丝。`};
  }
  // 正式挑战一天只有一次，结束后引导去别的模式继续练
  function practiceCta(){
    return `<div class="note" style="margin-top:10px">今天的正式机会用完了，去别的模式接着练手感</div>
      <button class="btn" onclick="hidePanel();exitLastShot();goDiff('rackrush')">投篮机挑战 · 练出手节奏</button>
      <button class="btn sm" onclick="hidePanel();exitLastShot();goDiff('battle')">百分大战 · 练对抗</button>
      <button class="btn sm" onclick="hidePanel();exitLastShot();goDiff('contest')">三分大赛 · 练稳定性</button>`;
  }
  /* pts = 这一攻真正拿到的分(含罚球)。原来结果页自己按 `made?3:0` 重算比分,
     罚球完全没算进去:and-one 拿 4 分只显示 +3;三罚中 2(打平进加时)显示成没得分;
     平局关三罚中 1 明明赢了却显示 +3。比分必须用真实得分。 */
  function showResult(cfg,made,reason,practice,diag,pts){
    G.state="lsend";applyCamMode();
    squadApi.show(false);
    if(made){startConfetti&&startConfetti();cheerSound&&cheerSound(true);airhorn&&airhorn();}
    else if(typeof boo==="function")boo();

    if(practice){
      showPanel(`<h1 class="title" style="font-size:22px">${made?"练习绝杀命中":"练习未命中"}</h1>
        <div class="sub">练习模式 · 不计成绩</div>
        ${made?`<div class="card">就是这个感觉。正式挑战每天只有一次。</div>`
          :(()=>{const a=missAdvice(reason,diag);
            return `<div class="card" style="text-align:left"><b style="color:#ffd23f">${a.t}</b><br>
              <span style="color:#cdd6e3;font-size:12px;line-height:1.7">${a.d}</span></div>`;})()}
        <button class="btn gold" onclick="hidePanel();beginLastShot(true)">再练一次</button>
        <button class="btn sm" onclick="hidePanel();openLastShot()">返回挑战说明</button>
        <button class="btn sm" onclick="exitLastShot();showMenu()">返回封面</button>`);
      return;
    }

    const s=recordResult(made);
    const gained=typeof pts==="number"?pts:(made?3:0);
    const finalHome=cfg.scoreHome+gained;
    const won=!!made;   // 胜负只有一个来源:sequence 的 shotSucceeded()
    paSay(made?"进了!比赛结束!":"没进,比赛结束。",true);
    showPanel(`<h1 class="title" style="font-size:24px">${made?"绝杀命中":"绝杀失手"}</h1>
      <div class="sub">${cfg.title} · ${today()}</div>
      <div class="card"><b>${cfg.homeName} ${finalHome} : ${cfg.scoreAway} ${cfg.awayName}</b>
        <br><span style="color:${won?"#7CFC6B":(reason==="overtime"?"#ffd23f":"#ff8d7a")};font-size:12px">${won?"你完成了绝杀":(reason==="timeout"?"比赛钟走完,没能出手":(reason==="overtime"?"追平了 · 比赛进入加时":"最后一投偏出"))}</span></div>
      <div class="card">连续绝杀 <b class="flame">${s.streak}</b> 天 · 最佳 <b>${s.bestStreak}</b> 天
        <br><span style="color:#9ab;font-size:11px">累计完成 ${s.totalWins} / ${s.totalPlayed} 次</span></div>
      ${made?"":(()=>{const a=missAdvice(reason,diag);
        return `<div class="card" style="text-align:left"><b style="color:#ffd23f">${a.t}</b><br>
          <span style="color:#cdd6e3;font-size:12px;line-height:1.7">${a.d}</span></div>`;})()}
      <div class="note">今日机会已用完 · ${resetLabel()}后刷新下一关</div>
      ${cfg.practiceEnabled?`<button class="btn gold" onclick="hidePanel();beginLastShot(true)">练习模式 · 不计成绩</button>`:""}
      ${practiceCta()}
      <button class="btn sm" onclick="exitLastShot();showMenu()">返回封面</button>`);
  }

  /* 正式挑战在开赛那一刻消耗机会;练习不消耗。 */
  function onBegin(practice){
    if(practice)return true;
    if(usedToday()){toast("今日机会已用完","#ff8d7a");openLastShot();return false;}
    consumeAttempt();
    return true;
  }

  global.AIBALastShotResult=Object.freeze({show:showResult});
  const api=Object.freeze({openLastShot,showResult,onBegin,store,usedToday,resetLabel,settlePending,pickStory});
  // 包装 sequence 导出的 beginLastShot,把每日闸门挂在开赛之前(项目既定的 wrap 全局函数模式)
  const rawBegin=global.beginLastShot;
  global.beginLastShot=function(practice){
    if(!onBegin(practice))return;
    rawBegin(practice);
  };
  Object.assign(global,{openLastShot});
  // 面板按钮的 onclick 走全局名，剧情选择器要能被点到
  global.AIBALastShot=api;
  runtime.register("mode:last-shot",{
    id:"last-shot",
    enter:openLastShot,
    start:seq.beginLastShot,
    update:seq.updateLastShot,
    finish:seq.finish,
    exit:seq.exitLastShot,
    api
  });
})(window);
