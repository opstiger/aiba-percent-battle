(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx||!runtime.service("ui:panels")||!runtime.service("ui:loading"))throw new Error("UI menu requires panels, loading, and legacy adapter");
  const {G,COVER_STARS,BATTLE_BAR_VISIBLE_SHOTS,RACK_RUSH_SPEED_TARGET,resetFinalRun,ensureAudio}=ctx;

  function showMenu(){
    G.state="menu";resetFinalRun();
    if(ctx.hasAudioContext()){
      ensureAudio(true);
      if(typeof global.playSFX==="function")global.playSFX("ui_mode_whoosh_01",.42);
    }
    const cover=global.BOOT_GATE_ACTIVE&&global.BOOT_COVER?global.BOOT_COVER:COVER_STARS[(Math.random()*COVER_STARS.length)|0];
    const coverVideo=cover.coverVideo?`<video class="coverVideo" muted loop playsinline preload="none" data-src="${cover.coverVideo}" aria-hidden="true" tabindex="-1"></video>`:"";
    global.showCoverPanel(`
      <div class="coverHero" style="background-image:url('${cover.cover}')">
        ${coverVideo}
        <div class="coverMenu"><div>
          <picture class="coverTitleMark">
            <source srcset="assets/aiba-brand/aiba-percent-battle-logo-v3.webp" type="image/webp">
            <img class="coverTitleLogo" src="assets/aiba-brand/aiba-percent-battle-logo-v3.png" width="768" height="425" alt="aiBA Percent Battle">
          </picture>
          <div class="coverSub">对着空气时出手，对着篮筐时杀手</div>
          ${global.AIBAProfileBarMarkup?global.AIBAProfileBarMarkup():""}
          <div class="coverActions schemeA">
            <div class="modeTile rush featured">
              <div class="modeCopy"><div class="modeEyebrow">街机闯关</div><div class="modeName">投篮机挑战</div><div class="modeDesc">连续供球，逐关达标，冲击最高总分。</div></div>
              <div class="modeBtns"><button class="modeInfo" onclick="ensureAudio(true,true);showModeInfo('rackrush')">i</button><button class="modePlay" onclick="ensureAudio(true,true);goDiff('rackrush')"><small>RACK RUSH</small>开始闯关 »</button></div>
            </div>
            <div class="quickModes" aria-label="其他模式">
              <div class="quickMode primary">
                <button class="quickInfo" onclick="ensureAudio(true,true);showModeInfo('battle')" aria-label="百分大战说明">i</button>
                <button class="quickPlay" onclick="ensureAudio(true,true);goDiff('battle')"><small>02 / PERCENT</small><b>百分大战</b><span>先到 100</span></button>
              </div>
              <div class="quickMode">
                <button class="quickInfo" onclick="ensureAudio(true,true);showModeInfo('contest')" aria-label="三分挑战说明">i</button>
                <button class="quickPlay" onclick="ensureAudio(true,true);goDiff('contest')"><small>03 / CLASSIC</small><b>三分大赛</b><span>70 秒挑战</span></button>
              </div>
              <div class="quickMode">
                <button class="quickInfo" onclick="ensureAudio(true,true);showModeInfo('lastshot')" aria-label="绝杀时刻说明">i</button>
                <button class="quickPlay" onclick="ensureAudio(true,true);openLastShot()"><small>04 / DAILY</small><b>绝杀时刻</b><span>每天一次</span></button>
              </div>
            </div>
          </div>${global.AIBALeaderboardHomeMarkup?global.AIBALeaderboardHomeMarkup():""}
        </div></div>
        <div class="coverCredit">aiBA PERCENT BATTLE</div>
      </div>
    `);
    if(!global.BOOT_GATE_ACTIVE)global.scheduleCoverVideo();
  }

  function showModeInfo(mode){
    if(mode==="battle"){
      global.showPanel(`<h1 class="title" style="font-size:22px">百分大战 100</h1>
        <div class="card">两人同时开投,先到 <b>100</b> 分获胜。五个常规点每球 <b>3 分</b>,两个彩球点每球 <b>5 分</b>,中场命中 <b>10 分</b>。</div>
        <div class="card">新秀难度在比赛前 <b>70%</b> 显示投篮条；更高难度只保留前 <b>${BATTLE_BAR_VISIBLE_SHOTS}</b> 球。后程靠出手手感完成比赛。</div>
        <button class="btn green" onclick="ensureAudio(true,true);goDiff('battle')">开始百分大战</button>
        <button class="btn sm" onclick="showMenu()">返回封面</button>`);
      return;
    }
    if(mode==="rackrush"){
      global.showPanel(`<h1 class="title" style="font-size:22px">RACK RUSH · 投篮机挑战</h1>
        <div class="card">进入后先选难度，再选择子模式：<b>闯关挑战</b> 或 <b>百分竞速</b>。</div>
        <div class="card">闯关挑战是逐关达标刷总分；百分竞速是普通球 <b>3 分</b>、彩球 <b>4 分</b>，达成 <b>${RACK_RUSH_SPEED_TARGET}</b> 分立刻停表，比谁更快。</div>
        <button class="btn gold" onclick="ensureAudio(true,true);goDiff('rackrush')">选择投篮机玩法</button>
        <button class="btn sm" onclick="showMenu()">返回封面</button>`);
      return;
    }
    if(mode==="lastshot"){
      global.showPanel(`<h1 class="title" style="font-size:22px">每日挑战 · 绝杀时刻</h1>
        <div class="card">第一人称站在三分线外,先看 5 秒现场:队友持球推进、对手包夹,最后把球分给你。</div>
        <div class="card">比赛钟走完前必须出手。<b>进了算完成,失手当天结束</b>。每天只有 <b>1 次</b>正式机会,另有不计成绩的练习模式。</div>
        <button class="btn red" onclick="ensureAudio(true,true);openLastShot()">进入今日挑战</button>
        <button class="btn sm" onclick="showMenu()">返回封面</button>`);
      return;
    }
    if(mode==="nbadna"){
      global.showPanel(`<h1 class="title" style="font-size:22px">NBA DNA</h1>
        <div class="card"><b>【即将上线】</b><br>投篮姿势分析与 NBA 球星风格匹配正在完善中，当前测试版暂不开放。</div>
        <button class="btn sm" onclick="showMenu()">返回封面</button>`);
      return;
    }
    global.showPanel(`<h1 class="title" style="font-size:22px">三分挑战</h1>
      <div class="card">经典三分赛规则: <b>70 秒</b>, 5 个普通球架,外加 2 个深远点。花球和深远球更值钱。</div>
      <div class="card">按住蓄力,松开出手。新秀难度最后 30% 也会隐藏投篮条，更高难度更早进入手感投篮。</div>
      <button class="btn gold" onclick="ensureAudio(true,true);goDiff('contest')">开始三分挑战</button>
      <button class="btn sm" onclick="showMenu()">返回封面</button>`);
  }

  const api=Object.freeze({showMenu,showModeInfo});
  Object.assign(global,api);runtime.register("ui:menu",api);
})(window);
