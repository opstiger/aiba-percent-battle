/* 新手引导:首次欢迎卡 + 分场景一次性提示(coach marks)+ 帮助入口。
   观察者模式:轮询状态触发,不改核心逻辑;老玩家(有标记)完全无感。 */
(function(global){
  "use strict";
  const KEY="aiba_onboard_v2";
  let seen={};
  try{seen=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){}
  function mark(k){seen[k]=1;try{localStorage.setItem(KEY,JSON.stringify(seen));}catch(e){}}
  const GG=()=>{try{return typeof G==="undefined"?null:G;}catch(e){return null;}};
  const playing=()=>{const g=GG();return g&&/^(round|tiebreak|battle|rackrush)$/.test(g.state);};

  /* ---------- 轻提示气泡 ---------- */
  let tipEl=null,tipTimer=0,tipScene=null;
  /* 提示必须和场景绑定。这些 coach mark 全靠下面那个 350ms 的全局轮询驱动,
     轮询只看 G 上的字段、不知道"现在是哪个场景" —— 于是出现过"首页飘出投篮甜区提示"
     这种乱串(首屏那一投写脏了 G.charging / G.shots,回首页后条件立刻成立)。
     这里记下提示是在哪个 state 弹的,场景一变立刻收掉。 */
  function tip(html,ms){
    if(!tipEl){
      tipEl=document.createElement("div");
      tipEl.id="obTip";
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML=html;
    tipEl.classList.add("on");
    const g=GG();tipScene=g?g.state:null;
    clearTimeout(tipTimer);
    tipTimer=setTimeout(()=>hideTip(),ms||4200);
  }
  function hideTip(){tipScene=null;tipEl&&tipEl.classList.remove("on");}
  /* 延迟弹出的提示要在**真正弹的那一刻**重新确认场景没变。
     否则"进入百分大战 1.4 秒后提示"这种,玩家 1 秒内退出去,提示就落在首页上了。 */
  function tipLater(delay,html,ms){
    const g=GG();const at=g?g.state:null;
    setTimeout(()=>{const n=GG();if(!n||n.state!==at)return;tip(html,ms);},delay);
  }

  /* ---------- 首次欢迎卡 ---------- */
  function showWelcome(){
    if(document.getElementById("obWelcome"))return;
    const el=document.createElement("div");
    el.id="obWelcome";
    el.innerHTML=
      '<div class="obCard">'+
      '<small>WELCOME TO</small><h1>aiBA · 百分大战</h1>'+
      '<div class="obSteps">'+
      '<span><b>1</b><i data-aiba-icon="hand-pointer" data-aiba-label=""></i>按住屏幕蓄力</span>'+
      '<span><b>2</b><i data-aiba-icon="play" data-aiba-label=""></i>松开手出手</span>'+
      '<span><b>3</b><i data-aiba-icon="target" data-aiba-label=""></i>力量停在绿色甜区<br>= 空心三分</span>'+
      "</div>"+
      '<button class="obBtn gold" id="obGoPractice" data-aiba-icon="play" data-aiba-label="进入真实球场互动教学">进入真实球场互动教学</button>'+
      '<button class="obBtn" id="obGoFree">直接开逛</button>'+
      '<button class="obLink" id="obGoHelp">查看完整玩法说明 ›</button>'+
      "</div>";
    document.body.appendChild(el);
    document.getElementById("obGoPractice").onclick=()=>{
      mark("welcome");el.remove();
      try{
        global.ensureAudio&&ensureAudio(true,true);
        if(global.AIBAInteractiveTutorial)global.AIBAInteractiveTutorial.start();
        else{
          global.goDiff("contest",true);global.pickDiff("normal");global.startPractice();
        }
      }catch(e){}
    };
    document.getElementById("obGoFree").onclick=()=>{mark("welcome");el.remove();};
    document.getElementById("obGoHelp").onclick=()=>{mark("welcome");el.remove();showHelp();};
  }

  /* ---------- 帮助页 ---------- */
  let helpReturn="panel";
  function showHelp(returnTo){
    if(typeof global.showPanel!=="function")return;
    helpReturn=returnTo||"panel";
    document.documentElement.dataset.aibaHelp="1";
    global.AIBAPerfSettings&&global.AIBAPerfSettings.syncButton&&global.AIBAPerfSettings.syncButton();
    global.showPanel(
      '<h1 class="title" style="font-size:22px">玩法说明</h1>'+
      '<div class="card"><b>基本操作</b><br>按住屏幕蓄力 → 松开出手,力量条停在绿色甜区就是空心。低精力时出手更难,记得停手休息。</div>'+
      '<div class="card"><b>百分大战</b><br>与 AI 同场对投,先到 100 分获胜。点击场上光圈(或 ←→ 键)换点位;普通点 3 分、彩球点 5 分、中场 LOGO 球 10 分。</div>'+
      '<div class="card"><b>投篮机 RACK RUSH</b><br>弧顶连续供球:闯关挑战逐关达标冲 FINAL RUSH;百分竞速比谁先到 100 分,用时上榜。</div>'+
      '<div class="card"><b>三分大赛</b><br>70 秒投完 5 个球架+2 个深远彩球,花球和深远球分值更高。</div>'+
      '<div class="card"><b>体感控制</b><br>难度页切"体感控制"用摄像头投篮:双手入框锁定 → 举高蓄力 → 越线出手。画面只在本机处理,不上传。</div>'+
      '<button class="btn green" data-aiba-icon="rotate-ccw" data-aiba-label="重看新手引导" onclick="AIBAOnboard.replay()">重看新手引导</button>'+
      '<button class="btn" data-aiba-icon="video" data-aiba-label="真实球场互动教学" onclick="AIBAOnboard.startTutorial()">真实球场互动教学</button>'+
      '<button class="btn gold" data-aiba-icon="arrow-left" data-aiba-label="返回" onclick="AIBAOnboard.closeHelp()">返回</button>'
    );
  }
  function clearHelpState(){
    delete document.documentElement.dataset.aibaHelp;
    global.AIBAPerfSettings&&global.AIBAPerfSettings.syncButton&&global.AIBAPerfSettings.syncButton();
  }
  function closeHelp(){
    clearHelpState();
    if(helpReturn==="settings"&&global.AIBAPerfSettings&&global.AIBAPerfSettings.reopen){global.AIBAPerfSettings.reopen();return;}
    if(typeof global.hidePanel==="function")global.hidePanel();
  }

  /* ---------- 分场景 coach marks(轮询触发,各一次) ---------- */
  /* 首屏那一投已经用互动的方式把"按住蓄力 -> 停在绿色甜区 -> 松手出手"教过一遍了,
     进首页再弹一张讲同样三步的卡片,既重复,又等于在首页前面又立了一层浮层。
     所以:跑过(或主动跳过)开场的人不再自动弹;没跑开场的人 —— 系统开了减少动效、
     省流量模式、或者 ?intro=0 —— 照旧弹,他们确实还没学过。

     只拦**自动弹出**。玩法说明里的"重看新手引导"直接调 showWelcome(),不受影响;
     体感教学也没有被孤立,玩法说明页里有独立入口,难度页选体感控制时也会走 vision-tutorial。 */
  function bootShotTaught(){
    try{return localStorage.getItem("aiba_boot_shot_seen")==="1";}catch(e){return false;}
  }

  let holdShownAt=0;
  function poll(){
    const G=GG();
    if(!G)return;
    if(G.interactiveTutorial)return;
    // 欢迎卡:首次到主菜单
    const bl=document.getElementById("bootLoad");
    if(!seen.welcome&&!bootShotTaught()&&G.state==="menu"&&(!bl||!bl.offsetParent)){
      showWelcome();
    }
    if(document.getElementById("obWelcome")&&G.state!=="menu"){
      document.getElementById("obWelcome").remove();mark("welcome");
    }
    // 场景一变,上一幕留下的提示立刻收掉,不许飘到下一幕
    if(tipScene!==null&&G.state!==tipScene)hideTip();
    // 第一次可出手:按住蓄力提示
    if(!seen.hold&&playing()&&G.canShoot&&!G.charging){
      if(!holdShownAt){holdShownAt=Date.now();tip('<i class="obFinger" data-aiba-icon="hand-pointer" data-aiba-label=""></i> 按住屏幕蓄力 · 松开出手',6000);}
    }
    /* mark 也要带 playing() 闸 —— 少了它,首屏那一投的 startCharge() 会把这个引导
       标记直接消耗掉,而那一投是"点一下自动蓄力",玩家根本没学会按住,
       结果真正第一局反而不提示了。 */
    if(!seen.hold&&playing()&&G.charging){mark("hold");hideTip();}
    // 第一次出手后:甜区提示
    if(!seen.sweet&&seen.hold&&playing()&&G.shots&&(G.shots.length>0||G.shotIdx>0)){
      mark("sweet");tipLater(700,"<i data-aiba-icon='target' data-aiba-label=''></i> 力量条停在<b style='color:#7CFC6B'>绿色甜区</b>就是空心",4200);
    }
    // 首次进各模式
    if(!seen.battle&&G.state==="battle"){mark("battle");tipLater(1400,"<i data-aiba-icon='target' data-aiba-label=''></i> 点击场上光圈移动点位(或 ←→ 键)· 先到 100 分",5200);}
    if(!seen.rush&&G.state==="rackrush"){mark("rush");tipLater(1400,"<i data-aiba-icon='play' data-aiba-label=''></i> 投篮机连续供球 · 跟上节奏连续出手",4600);}
    // 首次力竭
    if(!seen.tired&&global.AIBAGear&&playing()){
      try{if(AIBAGear.stamina().out){mark("tired");tip("😮‍💨 力竭了!停手休息,精力回到 28% 才能继续投",5200);}}catch(e){}
    }
  }
  setInterval(poll,350);

  global.AIBAOnboard={
    help:showHelp,closeHelp,
    startTutorial(){clearHelpState();global.AIBAInteractiveTutorial&&global.AIBAInteractiveTutorial.start();},
    replay(){clearHelpState();delete seen.welcome;delete seen.hold;delete seen.sweet;
      try{localStorage.setItem(KEY,JSON.stringify(seen));}catch(e){}
      if(typeof global.hidePanel==="function")global.hidePanel();
      const g=GG();if(g&&g.state==="menu")showWelcome();
      else if(typeof global.location!=="undefined")location.reload();
    }
  };
})(window);
