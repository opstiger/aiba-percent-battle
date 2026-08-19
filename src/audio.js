/* ====== 真人配音: 固定台词优先播放英文 wav, 动态台词走英文合成兜底 ====== */
const VOICE_BASE=(typeof EXT_AUDIO!=="undefined"&&EXT_AUDIO&&EXT_AUDIO.voiceBase)||"assets/aiba-audio/voices/";
/* 语音统一走这里换后缀:scripts/compress-voices.js --apply 把 WAV 转成 MP3 后
   只需要改这一个常量,代码里写死的 ".wav" 会被自动映射过去。 */
const VOICE_EXT=".wav";
const voiceUrl=name=>VOICE_BASE+String(name).replace(/\.wav$/i,VOICE_EXT);
const PREGAME_COUNTDOWN_CLIPS=Object.freeze([
  voiceUrl("pre_countdown_street_03.wav"),
  voiceUrl("pre_countdown_street_04.wav"),
  voiceUrl("pre_countdown_street_07.wav"),
  voiceUrl("pre_countdown_wild_05.wav"),
  voiceUrl("pre_countdown_wild_06.wav"),
  voiceUrl("pre_countdown_wild_08.wav")
]);
const VOICE_CLIPS=Object.freeze({
  "三分线外是我的地盘。":voiceUrl("r_pre_01.wav"),
  "屈居亚军,虽败犹荣,观众把掌声送给你!":voiceUrl("p_08_en.wav"),
  "屈居亚军，虽败犹荣，观众把掌声送给你！":voiceUrl("p_08_en.wav"),
  "FINAL RUSH,最后冲刺!":voiceUrl("p_10_en.wav"),
  "RACK RUSH完成!":voiceUrl("p_12_en.wav"),
  "彩球点,五分命中!":voiceUrl("dj_02_en.wav"),
  "彩球点，五分命中！":voiceUrl("dj_02_en.wav"),
  "深远三分!":voiceUrl("dj_03_en.wav"),
  "手感火热,挡不住了!":voiceUrl("dj_04_en.wav"),
  "手感火热，挡不住了！":voiceUrl("dj_04_en.wav"),
  "中场十分机会出现!":voiceUrl("dj_05_en.wav"),
  "对手中场超远命中!":voiceUrl("dj_06_en.wav"),
  "反超!比分易主!":voiceUrl("p_01_en.wav"),
  "反超！比分易主！":voiceUrl("p_01_en.wav"),
  "反超!你领先了!":voiceUrl("p_02_en.wav"),
  "反超！你领先了！":voiceUrl("p_02_en.wav"),
  "最后十秒,每球加一分!":voiceUrl("p_03_en.wav"),
  "最后十秒，每球加一分！":voiceUrl("p_03_en.wav"),
  "时间到!":voiceUrl("p_04_en.wav"),
  "时间到！":voiceUrl("p_04_en.wav"),
  "百分大战开始!先到一百分获胜!":voiceUrl("p_05_en.wav"),
  "百分大战开始！先到一百分获胜！":voiceUrl("p_05_en.wav"),
  "晋级决赛!":voiceUrl("p_06_en.wav"),
  "晋级决赛！":voiceUrl("p_06_en.wav"),
  "平分!突然死亡加赛!":voiceUrl("p_07_en.wav"),
  "平分！突然死亡加赛！":voiceUrl("p_07_en.wav"),
  "平分!加赛决胜!":voiceUrl("p_07_en.wav"),
  "平分！加赛决胜！":voiceUrl("p_07_en.wav"),
  "百分大战,率先破百!":voiceUrl("dj_07_en.wav"),
  "百分大战，率先破百！":voiceUrl("dj_07_en.wav"),
  "新科三分王,诞生了!":voiceUrl("dj_08_en.wav"),
  "新科三分王，诞生了！":voiceUrl("dj_08_en.wav"),
  "看到没!这就是差距!":voiceUrl("dj_c_01.wav"),
  "看到没！这就是差距！":voiceUrl("dj_c_01.wav"),
  "谁是三分王?!":voiceUrl("dj_c_02.wav"),
  "谁是三分王？！":voiceUrl("dj_c_02.wav"),
  "太轻松了!":voiceUrl("dj_c_03.wav"),
  "太轻松了！":voiceUrl("dj_c_03.wav"),
  "跟我斗?还嫩点!":voiceUrl("dj_c_04.wav"),
  "跟我斗？还嫩点！":voiceUrl("dj_c_04.wav"),
  "这分我拿定了!":voiceUrl("dj_c_05.wav"),
  "这分我拿定了！":voiceUrl("dj_c_05.wav"),
  "感受方块的力量!":voiceUrl("dj_c_06.wav"),
  "感受方块的力量！":voiceUrl("dj_c_06.wav"),
  "今晚我让你两个花球。":voiceUrl("r_pre_02.wav"),
  "方块小子,回家再练十年。":voiceUrl("r_pre_03.wav"),
  "方块小子，回家再练十年。":voiceUrl("r_pre_03.wav"),
  "我闭着眼都比你准。":voiceUrl("r_pre_04.wav"),
  "听到观众在喊谁的名字了吗?":voiceUrl("r_pre_05.wav"),
  "听到观众在喊谁的名字了吗？":voiceUrl("r_pre_05.wav"),
  "希望你的手别抖。":voiceUrl("r_pre_06.wav"),
  "运气球罢了…":voiceUrl("r_ot_01.wav"),
  "运气球罢了...":voiceUrl("r_ot_01.wav"),
  "风!刚才一定有风!":voiceUrl("r_ot_02.wav"),
  "风！刚才一定有风！":voiceUrl("r_ot_02.wav"),
  "裁判!他踩线了吧?!":voiceUrl("r_ot_03.wav"),
  "裁判！他踩线了吧？！":voiceUrl("r_ot_03.wav"),
  "别得意,还没结束。":voiceUrl("r_ot_04.wav"),
  "别得意，还没结束。":voiceUrl("r_ot_04.wav"),
  "……他什么时候变这么准的?":voiceUrl("r_ot_05.wav"),
  "……他什么时候变这么准的？":voiceUrl("r_ot_05.wav"),
  "我热身还没做完而已。":voiceUrl("r_ot_06.wav"),
  "快追啊!":voiceUrl("r_bt_01.wav"),
  "快追啊！":voiceUrl("r_bt_01.wav"),
  "就这点本事?":voiceUrl("r_bt_02.wav"),
  "就这点本事？":voiceUrl("r_bt_02.wav"),
  "我已经看到终点了!":voiceUrl("r_bt_03.wav"),
  "我已经看到终点了！":voiceUrl("r_bt_03.wav"),
  "你还差得远呢!":voiceUrl("r_bt_04.wav"),
  "你还差得远呢！":voiceUrl("r_bt_04.wav"),
  "100分是我的!":voiceUrl("r_bt_05.wav"),
  "100分是我的！":voiceUrl("r_bt_05.wav"),
  "就这?":voiceUrl("r_t_01.wav"),
  "就这？":voiceUrl("r_t_01.wav"),
  "我奶奶都比你稳。":voiceUrl("r_t_02.wav"),
  "手抖了啊兄弟。":voiceUrl("r_t_03.wav"),
  "要不要借你我的发带?":voiceUrl("r_t_04.wav"),
  "要不要借你我的发带？":voiceUrl("r_t_04.wav"),
  "观众都替你尴尬了。":voiceUrl("r_t_05.wav"),
  "看好了,这才叫投篮。":voiceUrl("r_ch_01.wav"),
  "看好了，这才叫投篮。":voiceUrl("r_ch_01.wav"),
  "我会让你知道差距。":voiceUrl("r_ch_02.wav"),
  "记好这个分数。":voiceUrl("r_ch_03.wav"),

  // --- Hot Streak 3 ---
  "连进三个,手感开机了!":voiceUrl("dj_mk3_01_en.wav"),
  "连进三个，手感开机了！":voiceUrl("dj_mk3_01_en.wav"),
  "别眨眼,这节奏要起飞。":voiceUrl("p_mk3_02_en.wav"),
  "别眨眼，这节奏要起飞。":voiceUrl("p_mk3_02_en.wav"),
  "三连中,篮网开始发烫。":voiceUrl("dj_mk3_03_en.wav"),
  "三连中，篮网开始发烫。":voiceUrl("dj_mk3_03_en.wav"),
  "你该叫暂停了。":voiceUrl("r_mk3_04.wav"),

  // --- Hot Streak 5 ---
  "五连中,球馆已经炸了!":voiceUrl("dj_mk5_02_en.wav"),
  "五连中，球馆已经炸了！":voiceUrl("dj_mk5_02_en.wav"),
  "这不是手感,这是自动瞄准!":voiceUrl("r_mk5_03.wav"),
  "这不是手感，这是自动瞄准！":voiceUrl("r_mk5_03.wav"),
  "篮筐在向你招手。":voiceUrl("p_mk5_04_en.wav"),

  // --- Hot Streak 8 ---
  "八连中,全场进入见证模式!":voiceUrl("dj_mk8_01_en.wav"),
  "八连中，全场进入见证模式！":voiceUrl("dj_mk8_01_en.wav"),
  "现在每一次出手都像慢动作。":voiceUrl("p_mk8_02_en.wav"),
  "别投了,这比赛要被你打坏了!":voiceUrl("r_mk8_03.wav"),
  "别投了，这比赛要被你打坏了！":voiceUrl("r_mk8_03.wav"),

  // --- Cold Streak 5 ---
  "五连铁了,篮筐都要报警了。":voiceUrl("r_ms5_01.wav"),
  "五连铁了，篮筐都要报警了。":voiceUrl("r_ms5_01.wav"),
  "深呼吸,下一球找回手感。":voiceUrl("p_ms5_02_en.wav"),
  "深呼吸，下一球找回手感。":voiceUrl("p_ms5_02_en.wav"),
  "今天这篮筐有点不讲理。":voiceUrl("p_ms5_03_en.wav"),
  "别急,节奏回来就有。":voiceUrl("p_ms5_04_en.wav"),
  "别急，节奏回来就有。":voiceUrl("p_ms5_04_en.wav"),
  "方块手感掉线了,重启一下。":voiceUrl("dj_ms5_05_en.wav"),
  "方块手感掉线了，重启一下。":voiceUrl("dj_ms5_05_en.wav"),

  // --- Cold Streak 8 ---
  "八连铁,先把手感从地板上捡起来。":voiceUrl("r_ms8_01.wav"),
  "八连铁，先把手感从地板上捡起来。":voiceUrl("r_ms8_01.wav"),
  "稳住,下一球只看节奏。":voiceUrl("p_ms8_02_en.wav"),
  "稳住，下一球只看节奏。":voiceUrl("p_ms8_02_en.wav"),
  "别和篮筐较劲,用弧线说话。":voiceUrl("p_ms8_03_en.wav"),
  "别和篮筐较劲，用弧线说话。":voiceUrl("p_ms8_03_en.wav")
});
const VOICE_RULES=Object.freeze([
  {re:/欢迎来到 aiBA/i,url:voiceUrl("p_09_en.wav")},
  {re:/最后冲刺/i,url:voiceUrl("p_rack_level_start_06_en.wav")},
  {re:/第1关/i,url:voiceUrl("p_rack_level_start_01_en.wav")},
  {re:/第2关/i,url:voiceUrl("p_rack_level_start_02_en.wav")},
  {re:/第3关/i,url:voiceUrl("p_rack_level_start_03_en.wav")},
  {re:/第4关/i,url:voiceUrl("p_rack_level_start_04_en.wav")},
  {re:/第5关/i,url:voiceUrl("p_rack_level_start_05_en.wav")},
  {re:/第6关/i,url:voiceUrl("p_rack_level_start_06_en.wav")},
  {re:/本次挑战结束/i,url:voiceUrl("p_rack_fail_01_en.wav")},
  {re:/最后五分决胜/i,url:voiceUrl("p_11_en.wav")},
  {re:/RACK RUSH完成/i,url:voiceUrl("p_12_en.wav")},
  {re:/屈居亚军/,url:voiceUrl("p_08_en.wav")},
  {re:/彩球点/,url:voiceUrl("dj_02_en.wav")},
  {re:/深远三分/,url:voiceUrl("dj_03_en.wav")},
  {re:/手感火热/,url:voiceUrl("dj_04_en.wav")},
  {re:/中场十分机会出现/,url:voiceUrl("dj_05_en.wav")},
  {re:/对手中场超远命中/,url:voiceUrl("dj_06_en.wav")},
  {re:/中场超远.*十分到手/,url:voiceUrl("dj_01_en.wav")},
  {re:/反超!比分易主/i,url:voiceUrl("p_01_en.wav")},
  {re:/反超!你领先了/i,url:voiceUrl("p_02_en.wav")},
  {re:/最后十秒.*加一分/i,url:voiceUrl("p_03_en.wav")},
  {re:/时间到/i,url:voiceUrl("p_04_en.wav")},
  {re:/百分大战开始/i,url:voiceUrl("p_05_en.wav")},
  {re:/晋级决赛/i,url:voiceUrl("p_06_en.wav")},
  {re:/平分!突然死亡加赛/i,url:voiceUrl("p_07_en.wav")},
  {re:/平分!加赛决胜/i,url:voiceUrl("p_07_en.wav")},
  {re:/百分大战.*率先破百/i,url:voiceUrl("dj_07_en.wav")},
  {re:/新科三分王/i,url:voiceUrl("dj_08_en.wav")},
  {re:/三分线外是我的地盘/i,url:voiceUrl("r_pre_01.wav")},
  {re:/今晚我让你两个花球/i,url:voiceUrl("r_pre_02.wav")},
  {re:/方块小子.*回家再练十年/i,url:voiceUrl("r_pre_03.wav")},
  {re:/我闭着眼都比你准/i,url:voiceUrl("r_pre_04.wav")},
  {re:/听到观众在喊谁的名字/i,url:voiceUrl("r_pre_05.wav")},
  {re:/希望你的手别抖/i,url:voiceUrl("r_pre_06.wav")},
  {re:/运气球罢了/i,url:voiceUrl("r_ot_01.wav")},
  {re:/风.*刚才一定有风/i,url:voiceUrl("r_ot_02.wav")},
  {re:/裁判.*他踩线了吧/i,url:voiceUrl("r_ot_03.wav")},
  {re:/别得意.*还没结束/i,url:voiceUrl("r_ot_04.wav")},
  {re:/他什么时候变这么准/i,url:voiceUrl("r_ot_05.wav")},
  {re:/我热身还没做完/i,url:voiceUrl("r_ot_06.wav")},
  {re:/快追啊/i,url:voiceUrl("r_bt_01.wav")},
  {re:/就这点本事/i,url:voiceUrl("r_bt_02.wav")},
  {re:/我已经看到终点/i,url:voiceUrl("r_bt_03.wav")},
  {re:/你还差得远/i,url:voiceUrl("r_bt_04.wav")},
  {re:/100分是我的/i,url:voiceUrl("r_bt_05.wav")},
  {re:/就这/i,url:voiceUrl("r_t_01.wav")},
  {re:/我奶奶都比你稳/i,url:voiceUrl("r_t_02.wav")},
  {re:/手抖了啊兄弟/i,url:voiceUrl("r_t_03.wav")},
  {re:/要不要借你.*发带/i,url:voiceUrl("r_t_04.wav")},
  {re:/观众都替你尴尬/i,url:voiceUrl("r_t_05.wav")},
  {re:/看好了.*才叫投篮/i,url:voiceUrl("r_ch_01.wav")},
  {re:/我会让你知道差距/i,url:voiceUrl("r_ch_02.wav")},
  {re:/记好这个分数/i,url:voiceUrl("r_ch_03.wav")}
]);
const EN_SPEECH=Object.freeze({
  "三分线外是我的地盘。":"This is my house! Shiiiet... out of bounds!",
  "今晚我让你两个花球。":"Two money balls for you. Damn, you need 'em.",
  "方块小子,回家再练十年。":"Practice? Hahaha! We talkin' about practice?!",
  "我闭着眼都比你准。":"Blindfolded, baby! Hehehe, watch.",
  "听到观众在喊谁的名字了吗?":"Hear that? MVP! Wohoo!",
  "希望你的手别抖。":"Don't choke! The Mailman is coming...",
  "运气球罢了…":"Wawawa! Pure luck! Lucky bounce!",
  "风!刚才一定有风!":"Brrr! Windy in here! Holy shit!",
  "裁判!他踩线了吧?!":"Ref! He stepped out! Out!",
  "别得意,还没结束。":"Job's not finished! Damn it!",
  "……他什么时候变这么准的?":"No! Holy shit, since when?!",
  "我热身还没做完而已。":"Just warmups. Real game starts now.",
  "看到没!这就是差距!":"You know who I am! Easy money!",
  "谁是三分王?!":"Who's coming in second?!",
  "太轻松了!":"Too easy! BBQ chicken!",
  "跟我斗?还嫩点!":"You thought you was Kobe?! Too small!",
  "这分我拿定了!":"Board man gets paid!",
  "感受方块的力量!":"Voxel power! Welcome to the block party!",
  "快追啊!":"Catch up! Catch up! Wohoo!",
  "就这点本事?":"Soft! You are so soft!",
  "我已经看到终点了!":"Look at the board! Shiiiet!",
  "你还差得远呢!":"Too small! Hahaha, too small!",
  "100分是我的!":"Night night! Put 'em to sleep!",
  "看好了,这才叫投篮。":"Splash! Hehehe, splash!",
  "我会让你知道差距。":"Personally! I took that personally! Damn!",
  "记好这个分数。":"Count the rings! Shiiiet!",
  "反超!比分易主!":"Lead change!",
  "反超!你领先了!":"Lead change! You are in front.",
  "时间到!":"Time is up!",
  "最后十秒,每球加一分!":"Final ten seconds. Every make gets one extra point.",
  "晋级决赛!":"You are going to the final.",
  "平分!突然死亡加赛!":"Tie game. Sudden death.",
  "新科三分王,诞生了!":"A new three point king is crowned.",
  "百分大战,率先破百!":"Percent Battle! First to one hundred.",
  "百分大战开始!先到一百分获胜!":"Percent Battle begins. First to one hundred wins!",
  "就这?":"Pfft! Real soft!",
  "就这？":"Pfft! Real soft!",
  "我奶奶都比你稳。":"My grandma got a better jumper! Hehehe!",
  "手抖了啊兄弟。":"Stop it! Get some help! Damn!",
  "要不要借你我的发带?":"You sweating? Headband?",
  "要不要借你我的发带？":"You sweating? Headband?",
  "观众都替你尴尬了。":"Brick! Westbrick! Holy shit!",
  "连进三个,手感开机了!":"THREE STRAIGHT! The jumper is ONLINE! Haha!",
  "别眨眼,这节奏要起飞.":"Do NOT blink! This rhythm is about to take off!",
  "三连中,篮网开始发烫.":"Three in a row! The net is getting HOT! Oh!",
  "你该叫暂停了.":"Huh! You better call a timeout! For real!",
  "五连中,球馆已经炸了!":"FIVE STRAIGHT! The arena is losing its MINDS! Woo!",
  "这不是手感,这是自动瞄准!":"No! That is NOT touch! That is AUTO AIM! Cheater!",
  "篮筐在向你招手.":"The rim is CALLING your name! Oh my!",
  "八连中,全场进入见证模式!":"EIGHT STRAIGHT! The whole building is WITNESSING greatness!",
  "现在每一次出手都像慢动作.":"Every... single... shot... feels like slow motion now!",
  "别投了,这比赛要被你打坏了!":"STOP SHOOTING! You are about to BREAK THE GAME! No!",
  "五连铁了,篮筐都要报警了.":"Five bricks! Haha, the rim is about to call the POLICE!",
  "深呼吸,下一球找回手感.":"Breathe... Just breathe. Get the touch back on the next one!",
  "今天这篮筐有点不讲理.":"Damn! This rim is acting personal tonight!",
  "别急,节奏回来就有.":"Do NOT rush! Find the rhythm, and it comes right back!",
  "方块手感掉线了,重启一下.":"The voxel touch went offline! Reboot! Reboot! Haha!",
  "八连铁,先把手感从地板上捡起来.":"Eight bricks! Sheesh! Pick your jumper up off the floor!",
  "稳住,下一球只看节奏.":"Stay steady. The next shot is ALL rhythm!",
  "别和篮筐较劲,用弧线说话.":"Do NOT fight the rim! Let the arc do the talking!"
});

/* ---------------- 音频引擎 v3 (菜单BGM + 球馆现场 + DJ/转播 + 投篮手感) ---------------- */
let AC=null,master=null,crowdBus=null,crowdGain=null,musicBus=null,arenaBus=null,broadcastBus=null,playerBus=null,sfxBus=null,outputComp=null,recordDest=null;
let musicTimer=null,arenaTimer=null,ambTimer=null,duckTimer=null,mediaDuckTimer=null,mediaDuckUntil=0;
const CROWD_BASE=0.16;
const EXT_DEFAULT_VOLUME=Object.freeze({
  bgm:.58,crowd:.25,crowdCheer:.23,rain:.19,ocean:.17,gull:.26,
  applause:.5,boo:.42,buzzer:.86,startWhistle:.72,shoeSqueak:.62,
  bounce:.72,bounce2:.72,bounceSequence:.52,swish:.92,swish2:.92,swish3:.92,clank:.86,clank2:.86,rimMake:.9,
  crowdFinalMake:.88,crowdFinalMiss:.88
});
const EXT_MEDIA_GAIN=Object.freeze({
  clank:1.5,clank2:1.35,rimMake:1.12
});
let crowdHeat=0;
const VOICE_CHAIN_PROFILES=Object.freeze({
  pa:{hp:210,lp:5200,presF:1650,presGain:3.2,direct:.94,delay:.13,feedback:.16,delayGain:.11,revSec:.82,decay:2.2,reverbGain:.18,comp:-18},
  player:{hp:145,lp:7200,presF:2400,presGain:1.4,direct:.82,delay:.055,feedback:.08,delayGain:.045,revSec:.5,decay:1.5,reverbGain:.065,comp:-20}
});
let MUTED=false;
let AUDIO_READY=false,AUDIO_PRIMED=false;
let sceneAudioTick=0;
const extA={};
const audioIssueLogAt=Object.create(null),mediaRetryAt=Object.create(null);
function noteAudioIssue(scope,error){
  try{
    const message=String(error&&error.message||error||"blocked").slice(0,96);
    document.documentElement.dataset.audioIssue=scope+":"+message;
    const now=Date.now();if(now-(audioIssueLogAt[scope]||0)>5000){audioIssueLogAt[scope]=now;console.warn("[aiBA audio] "+scope,message);}
  }catch(e){}
}
function mediaBusForKey(k){
  if(k==="bgm")return musicBus||master;
  if(k==="crowd"||k==="crowdCheer")return arenaBus||master;
  return sfxBus||arenaBus||master;
}
function routeExternalMediaElement(k,a){
  if(!AC||AC.state!=="running"||!a||a._aibaExtSource)return false;
  try{
    a._aibaExtSource=AC.createMediaElementSource(a);
    const gain=EXT_MEDIA_GAIN[k]||1;
    if(gain!==1){a._aibaExtGain=AC.createGain();a._aibaExtGain.gain.value=gain;a._aibaExtSource.connect(a._aibaExtGain);a._aibaExtGain.connect(mediaBusForKey(k));}
    else a._aibaExtSource.connect(mediaBusForKey(k));
    return true;
  }catch(e){return false;}
}
function ensureAudioCaptureDestination(){
  if(!AC)return null;
  try{
    if(!recordDest){recordDest=AC.createMediaStreamDestination();if(outputComp)outputComp.connect(recordDest);}
    return recordDest.stream;
  }catch(e){return null;}
}
function syncAudioDebug(){
  try{
    const s=audioState(),r=document.documentElement;
    r.dataset.audioContext=s.state;
    r.dataset.audioReady=s.ready?"1":"0";
    r.dataset.audioPrimed=s.primed?"1":"0";
    r.dataset.audioMuted=s.muted?"1":"0";
    r.dataset.audioMenu=s.menuMusic?"1":"0";
    r.dataset.audioArena=s.arenaMusic?"1":"0";
    r.dataset.audioBgmExternal=s.bgmExternal?"1":"0";
    r.dataset.audioBgmPlaying=s.bgmPlaying?"1":"0";
    r.dataset.audioCrowdExternal=s.crowdExternal?"1":"0";
    r.dataset.audioCrowdPlaying=s.crowdPlaying?"1":"0";
    r.dataset.audioCrowdCheerPlaying=s.crowdCheerPlaying?"1":"0";
    r.dataset.audioRainPlaying=s.rainPlaying?"1":"0";
    r.dataset.audioOceanPlaying=s.oceanPlaying?"1":"0";
    r.dataset.audioGullReady=s.gullReady?"1":"0";
    const b=$("muteBtn");
    if(b){
      if(window.AIBASetIcon)AIBASetIcon(b,s.muted?"volume-x":(s.ready?"volume-2":"volume-1"),s.muted?"开启声音":(s.ready?"静音":"启动声音"));
      b.classList.toggle("needsAudio",!s.muted&&!s.ready);
    }
  }catch(e){}
}
/* 这几个音轨由启动加载器用 fetch() 拉取(进度条需要真实进度),拿到后把 blob 直接
   喂给对应元素。要点有两条:
   1. 这里不给它们赋 src,否则同一个文件会被 <audio> 和 fetch 各下载一遍;
   2. 但也绝不能反过来改成"等 <audio> 自己加载完"——移动端在用户交互前根本不会
      预加载媒体,那样启动会一直等到超时(v2.12 的启动变慢就是这么来的)。 */
const EXT_BOOT_KEYS=["bgm","crowd","crowdCheer","rain","ocean","gull"];
function extHydrate(k,objectUrl){
  const a=extA[k];if(!a||!objectUrl)return false;
  try{a.src=objectUrl;a.load();return true;}catch(e){return false;}
}
function extEnsureSrc(k){
  const a=extA[k];if(!a||a.getAttribute("src"))return false;
  try{a.src=EXT_AUDIO[k];a.load();return true;}catch(e){return false;}
}
const GAMEPLAY_SFX_KEYS=["startWhistle","buzzer","shoeSqueak","bounce","bounce2","bounceSequence","swish","swish2","swish3","clank","clank2","rimMake","applause","boo"];
const decodedGameplaySfx=Object.create(null),decodedGameplaySfxLoads=Object.create(null);
function syncGameplaySfxDebug(){
  try{
    const root=document.documentElement;
    root.dataset.audioSfxExpected=String(GAMEPLAY_SFX_KEYS.length);
    root.dataset.audioSfxRequested=String(Object.keys(decodedGameplaySfxLoads).length);
    root.dataset.audioSfxDecoded=String(Object.keys(decodedGameplaySfx).length);
  }catch(e){}
}
function decodeGameplaySfx(k){
  if(!AC||!EXT_AUDIO[k]||GAMEPLAY_SFX_KEYS.indexOf(k)<0)return null;
  if(decodedGameplaySfx[k])return Promise.resolve(decodedGameplaySfx[k]);
  if(decodedGameplaySfxLoads[k])return decodedGameplaySfxLoads[k];
  decodedGameplaySfxLoads[k]=fetch(EXT_AUDIO[k],{cache:"force-cache"})
    .then(response=>{if(!response.ok)throw new Error("HTTP "+response.status);return response.arrayBuffer();})
    .then(data=>new Promise((resolve,reject)=>{
      let settled=false;
      const done=buffer=>{if(settled)return;settled=true;resolve(buffer);};
      const fail=error=>{if(settled)return;settled=true;reject(error);};
      try{
        const result=AC.decodeAudioData(data,done,fail);
        if(result&&result.then)result.then(done,fail);
      }catch(error){fail(error);}
    }))
    .then(buffer=>{decodedGameplaySfx[k]=buffer;syncGameplaySfxDebug();return buffer;})
    .catch(error=>{
      /* 解码失败必须把 in-flight 标记清掉。extPlay 里有一条
         "正在解码就先别用 <audio>" 的短路，标记不清的话这个音效会永远静音，
         再也回不到 <audio> 兜底。 */
      delete decodedGameplaySfxLoads[k];
      noteAudioIssue("sfx-decode-"+k,error);syncGameplaySfxDebug();return null;
    });
  syncGameplaySfxDebug();
  return decodedGameplaySfxLoads[k];
}
function playDecodedGameplaySfx(k,maxMs){
  const buffer=decodedGameplaySfx[k];
  if(!buffer||!AC||AC.state!=="running"||MUTED)return false;
  try{
    const source=AC.createBufferSource(),gain=AC.createGain();
    source.buffer=buffer;
    gain.gain.value=(EXT_DEFAULT_VOLUME[k]||.85)*(EXT_MEDIA_GAIN[k]||1);
    source.connect(gain);gain.connect(mediaBusForKey(k));
    source.start();
    if(maxMs>0)source.stop(AC.currentTime+Math.min(buffer.duration,maxMs/1000));
    try{
      const root=document.documentElement;
      root.dataset.audioSfxLast=k;
      root.dataset.audioSfxPlays=String((Number(root.dataset.audioSfxPlays)||0)+1);
    }catch(e){}
    return true;
  }catch(error){noteAudioIssue("sfx-buffer-"+k,error);return false;}
}
function prewarmGameplaySfx(){
  syncGameplaySfxDebug();
  for(const k of GAMEPLAY_SFX_KEYS){
    /* 只预热 WebAudio 那一路。以前这里还会 extEnsureSrc + a.load()，
       等于把同一个文件再用 <audio> 下一遍。真要播而解码没成时，
       extPlay 会自己懒赋 src。 */
    decodeGameplaySfx(k);
  }
}
try{
  window.__aibaGameplaySfxState=()=>({
    expected:GAMEPLAY_SFX_KEYS.length,
    decoded:Object.keys(decodedGameplaySfx).length,
    requested:Object.keys(decodedGameplaySfxLoads).length,
    context:AC?AC.state:"none",
    issue:document.documentElement.dataset.audioIssue||""
  });
}catch(e){}
function extInit(){
  if(Object.keys(extA).length)return;
  for(const k in EXT_AUDIO){
    const u=EXT_AUDIO[k];if(!u)continue;
    try{
      /* 先配好 preload/loop 再赋 src:构造函数传 URL 会立刻开始下载。
         同源资源不需要 crossOrigin,带上反而会让 <audio> 走 CORS 模式。 */
      const a=new Audio();
      const looped=k==="bgm"||k==="crowd"||k==="crowdCheer"||k==="rain"||k==="ocean";
      a.preload="auto";a.loop=looped;
      /* 启动音轨等 blob；游戏音效走 WebAudio 解码(decodeGameplaySfx 会自己 fetch)，
         这里再赋一次 src 就是同一个文件下载两遍 —— 实测 crowd-boo-01 和
         bounce-sequence-indoor-01 各被拉了两次，约 325KB 白付。
         解码失败时 extPlay 会懒赋 src 兜底，所以这里不赋不影响出声。 */
      const lazySrc=EXT_BOOT_KEYS.indexOf(k)>=0||GAMEPLAY_SFX_KEYS.indexOf(k)>=0;
      if(!lazySrc)a.src=u;
      a.volume=EXT_DEFAULT_VOLUME[k]||0.85;
      a.onerror=()=>{delete extA[k];};
      extA[k]=a;
      routeExternalMediaElement(k,a);
    }catch(e){}
  }
}
/* 一次性音效(篮网/篮筐等)的副本池:直接 cloneNode() 每响一次就要重新走一遍资源加载,
   投篮密集时既浪费请求又容易赶不上出声。这里按 key 缓存少量副本循环复用。 */
const extPool={};
const EXT_POOL_MAX=4;
function extOneShot(k,a){
  const pool=extPool[k]||(extPool[k]=[]);
  let el=pool.find(x=>x.paused||x.ended);
  if(!el&&pool.length<EXT_POOL_MAX){
    el=a.cloneNode();el.volume=a.volume;el.preload="auto";pool.push(el);
  }
  if(!el){el=pool[0];try{el.pause();}catch(e){}}
  try{el.currentTime=0;}catch(e){}
  return el;
}
function extPlay(k,maxMs){
  if(MUTED)return false;
  if(playDecodedGameplaySfx(k,maxMs))return true;
  if(decodedGameplaySfxLoads[k]&&!decodedGameplaySfx[k])return false;
  const a=extA[k];if(!a)return false;
  extEnsureSrc(k);   // 启动预热没跑到时的兜底:真要播了就直接用普通 URL
  if(Date.now()<(mediaRetryAt[k]||0))return false;
  /* 一次性音效还没缓冲好就交回合成音兜底,否则这一下会完全没声音 */
  if(!a.loop&&k!=="gull"&&a.readyState<2)return false;
  try{
    routeExternalMediaElement(k,a);
    const playSafe=x=>{const p=x.play();if(p&&p.then)p.then(()=>{mediaRetryAt[k]=0;delete document.documentElement.dataset.audioIssue;syncAudioDebug();}).catch(e=>{mediaRetryAt[k]=Date.now()+2500;noteAudioIssue("media-play",e);syncAudioDebug();});};
    if(a.loop){if(a.paused)playSafe(a);}
    else if(k==="gull"){a.currentTime=0;playSafe(a);}
    else{
      const c=extOneShot(k,a);routeExternalMediaElement(k,c);playSafe(c);
      if(maxMs>0){
        const token=(c._aibaPlayToken||0)+1;c._aibaPlayToken=token;
        setTimeout(()=>{if(c._aibaPlayToken===token)try{c.pause();c.currentTime=0;}catch(e){}},maxMs);
      }
    }
  }catch(e){return false}
  return true;
}
const extVariantLast=Object.create(null);
function extPlayVariant(group,keys){
  const available=keys.filter(k=>extA[k]);
  if(!available.length)return false;
  let choices=available.filter(k=>k!==extVariantLast[group]);
  if(!choices.length)choices=available;
  const start=(Math.random()*choices.length)|0;
  for(let i=0;i<choices.length;i++){
    const key=choices[(start+i)%choices.length];
    if(extPlay(key)){extVariantLast[group]=key;return true;}
  }
  return false;
}
function extStop(k){const a=extA[k];if(a)try{a.pause()}catch(e){}}
extInit();
function sceneAudioArenaLike(){
  return G.state==="cinematic"||G.state==="round"||G.state==="roundend"||G.state==="aishow"||G.state==="tiebreak"||G.state==="battle"||G.state==="battleend"||G.state==="rackrush"||G.state==="rushintro"||G.state==="rushbetween"||G.state==="rushend"||G.state==="wincine"||G.state==="victorycine"||G.state==="replay";
}
function externalMediaDuckActive(){
  return Date.now()<mediaDuckUntil;
}
function applyExternalMediaMix(){
  const duck=externalMediaDuckActive(),arenaLike=sceneAudioArenaLike();
  const heat=Math.max(0,Math.min(1,crowdHeat||0));
  if(extA.bgm)extA.bgm.volume=EXT_DEFAULT_VOLUME.bgm*(duck?0.58:1);
  if(extA.crowd)extA.crowd.volume=(G.finalRun?0.34:EXT_DEFAULT_VOLUME.crowd)*(1+heat*.42)*(duck?0.72:1);
  if(extA.crowdCheer)extA.crowdCheer.volume=(G.finalRun?0.31:EXT_DEFAULT_VOLUME.crowdCheer)*(1+heat*.62)*(duck?0.7:1);
  if(extA.rain)extA.rain.volume=(arenaLike?0.2:0.11)*(duck?0.82:1);
  if(extA.ocean)extA.ocean.volume=(G.finalRun?0.24:(arenaLike?0.18:0.1))*(duck?0.82:1);
}
function setCrowdHeat(level){
  crowdHeat=Math.max(0,Math.min(1,Number(level)||0));
  if(crowdBus&&AC){
    const t=AC.currentTime,base=extA.crowd?0.035:CROWD_BASE;
    crowdBus.gain.cancelScheduledValues(t);
    crowdBus.gain.setTargetAtTime(base+crowdHeat*(extA.crowd?0.035:0.075),t,0.55);
  }
  applyExternalMediaMix();
}
function syncSceneAmbience(){
  const arenaLike=sceneAudioArenaLike(),allowed=G.state==="diff"||arenaLike;
  applyExternalMediaMix();
  if(!AC||MUTED||AC.state==="suspended"||!allowed){extStop("rain");extStop("ocean");syncAudioDebug();return;}
  const rainy=currentWeather==="rain",beach=currentScenePreset==="beachSunset";
  applyExternalMediaMix();
  if(rainy)extPlay("rain");else extStop("rain");
  if(beach)extPlay("ocean");else extStop("ocean");
  syncAudioDebug();
}
function updateSceneAudio(dt){
  sceneAudioTick-=dt;
  if(sceneAudioTick<=0){sceneAudioTick=.55;syncSceneAmbience();}
}
function voiceRoleForText(t,u,role){
  if(role)return role;
  const file=String(u||"").split("/").pop()||"";
  if(/^r_/.test(file)||/rival|taunt|ch_/.test(file))return "player";
  if(/^dj_/.test(file)||/countdown|mk|ms/.test(file))return "dj";
  return "pa";
}
function voiceBusForRole(role){
  return role==="player"||role==="rival"||role==="taunt"||role==="angry"||role==="sad"?(playerBus||master):(broadcastBus||master);
}
function routeVoiceElement(a,role){
  if(!AC||!a)return false;
  try{
    const bus=voiceBusForRole(role);
    if(!a._aibaVoiceSource)a._aibaVoiceSource=AC.createMediaElementSource(a);
    if(a._aibaVoiceRole!==role){
      try{a._aibaVoiceSource.disconnect();}catch(e){}
      a._aibaVoiceSource.connect(bus);
      a._aibaVoiceRole=role;
    }
    return true;
  }catch(e){return false;}
}
function voiceDuckForRole(role){
  if(role==="player"||role==="rival"||role==="taunt"||role==="angry"||role==="sad")return {ms:1450,depth:.72};
  if(role==="dj")return {ms:2100,depth:.58};
  return {ms:2300,depth:.56};
}
function makeArenaImpulse(sec,decay){
  if(!AC)return null;
  const key=sec+":"+decay+":"+AC.sampleRate;
  makeArenaImpulse.cache=makeArenaImpulse.cache||Object.create(null);
  if(makeArenaImpulse.cache[key])return makeArenaImpulse.cache[key];
  const len=Math.max(1,Math.floor(AC.sampleRate*sec));
  const b=AC.createBuffer(2,len,AC.sampleRate);
  for(let ch=0;ch<2;ch++){
    const d=b.getChannelData(ch);
    for(let i=0;i<len;i++){
      const tail=Math.pow(1-i/len,decay);
      const early=i<AC.sampleRate*.045?(1-i/(AC.sampleRate*.045))*.55:0;
      d[i]=(Math.random()*2-1)*tail*.24+(Math.random()*2-1)*early*.18;
    }
  }
  makeArenaImpulse.cache[key]=b;
  return b;
}
function connectArenaVoiceChain(input,profileName){
  if(!AC||!input||!master)return;
  const p=VOICE_CHAIN_PROFILES[profileName]||VOICE_CHAIN_PROFILES.pa;
  const hp=AC.createBiquadFilter();hp.type="highpass";hp.frequency.value=p.hp;
  const lp=AC.createBiquadFilter();lp.type="lowpass";lp.frequency.value=p.lp;
  const pres=AC.createBiquadFilter();pres.type="peaking";pres.frequency.value=p.presF;pres.Q.value=.9;pres.gain.value=p.presGain;
  const comp=AC.createDynamicsCompressor();
  comp.threshold.value=p.comp;comp.knee.value=16;comp.ratio.value=3.2;comp.attack.value=.003;comp.release.value=.18;
  const direct=AC.createGain();direct.gain.value=p.direct;
  input.connect(hp);hp.connect(lp);lp.connect(pres);pres.connect(comp);comp.connect(direct);direct.connect(master);
  const delay=AC.createDelay(.8);delay.delayTime.value=p.delay;
  const fb=AC.createGain();fb.gain.value=p.feedback;
  const dg=AC.createGain();dg.gain.value=p.delayGain;
  comp.connect(delay);delay.connect(fb);fb.connect(delay);delay.connect(dg);dg.connect(master);
  const impulse=makeArenaImpulse(p.revSec,p.decay);
  if(impulse){
    const con=AC.createConvolver();con.buffer=impulse;
    const rg=AC.createGain();rg.gain.value=p.reverbGain;
    comp.connect(con);con.connect(rg);rg.connect(master);
  }
}
function voiceMicTransient(role){
  if(!AC||MUTED)return;
  const bus=voiceBusForRole(role);
  if(role==="player"||role==="rival"||role==="taunt"||role==="angry"||role==="sad"){
    noiseBus(bus,.015,.012,1800,6200);
    return;
  }
  noiseBus(bus,.025,.022,1200,6800);
  setTimeout(()=>blipBus(bus,role==="dj"?880:620,.035,"square",.012,role==="dj"?1040:520),12);
}
function playVoiceUrl(u,role,opt){
  if(!u||MUTED)return false;
  try{
    opt=opt||{};audioInit();
    if(!playClip.cache[u]){const a=new Audio();a.preload="auto";a.src=u;playClip.cache[u]=a;}
    const base=playClip.cache[u],a=base.paused&&base.currentTime===0?base:base.cloneNode();
    a.crossOrigin="anonymous";
    const routed=routeVoiceElement(a,role);
    a.volume=opt.volume==null?(routed?0.92:0.78):opt.volume;
    a.currentTime=0;
    voiceMicTransient(role);
    const p=a.play();if(p&&p.catch)p.catch(e=>noteAudioIssue("voice-play",e));
    const duck=voiceDuckForRole(role);
    duckBroadcast(opt.duckMs||duck.ms,opt.duckDepth||duck.depth);
  }catch(e){return false}
  return true;
}
function playClip(t,role){
  const u=voiceClipFor(t);if(!u||MUTED)return false;
  return playVoiceUrl(u,voiceRoleForText(t,u,role));
}
playClip.cache=Object.create(null);
let pregameCountdownClipLast=-1;
function playPregameCountdownCue(){
  if(MUTED)return false;
  try{
    if(typeof G !== "undefined" && G.mode === "contest"){
      const ok=typeof playAudioEvent==="function"?playAudioEvent("contest_start",{role:"pa",volume:.98,duckMs:4600,duckDepth:.5}):false;
      crowdSwell(.12, 2.2);
      return ok;
    }
    if(!PREGAME_COUNTDOWN_CLIPS.length)return false;
    const pool=PREGAME_COUNTDOWN_CLIPS;
    let idx=(Math.random()*pool.length)|0;
    if(pool.length>1&&idx===pregameCountdownClipLast)idx=(idx+1+(Math.random()*(pool.length-1)|0))%pool.length;
    pregameCountdownClipLast=idx;
    const u=pool[idx];
    playVoiceUrl(u,"pa",{volume:.96,duckMs:4200,duckDepth:.52});
    crowdSwell(.08,2.2);
    return true;
  }catch(e){return false}
}
function voiceClipFor(t){
  if(!t)return "";
  if(VOICE_CLIPS[t])return VOICE_CLIPS[t];
  for(const rule of VOICE_RULES){if(rule.re.test(t))return rule.url;}
  return "";
}
function preloadVoiceClips(){
  const eventUrls=typeof AUDIO_EVENTS==="undefined"?[]:Object.values(AUDIO_EVENTS).flat().map(n=>voiceUrl(n+".wav"));
  const sfxUrls=["ui_mode_whoosh_01","ui_start_game_01","ui_roster_lock_01","ui_equip_01","ui_leaderboard_open_01","ui_save_video_01"].map(n=>voiceUrl(n+".wav"));
  const urls=Object.values(VOICE_CLIPS).concat(VOICE_RULES.map(r=>r.url),PREGAME_COUNTDOWN_CLIPS,eventUrls,sfxUrls);
  urls.forEach(u=>{
    if(!u||playClip.cache[u])return;
    try{const a=new Audio();a.preload="auto";a.src=u;playClip.cache[u]=a;}catch(e){}
  });
}
const rnd2=(a,b)=>a+Math.random()*(b-a);
function audioInit(){
  if(AC){
    try{if(AC.state==="suspended")AC.resume();}catch(e){}
    AUDIO_READY=AC.state==="running";syncAudioDebug();
    return;
  }
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    AC.onstatechange=()=>{AUDIO_READY=AC&&AC.state==="running";syncAudioDebug();};
    // 总线: master → 压缩器(粘合) → 输出
    const comp=AC.createDynamicsCompressor();
    comp.threshold.value=-14;comp.ratio.value=3.5;comp.attack.value=0.004;comp.release.value=0.22;
    master=AC.createGain();master.gain.value=0.95;outputComp=comp;
    master.connect(comp);comp.connect(AC.destination);ensureAudioCaptureDestination();
    musicBus=AC.createGain();musicBus.gain.value=0.72;musicBus.connect(master);
    arenaBus=AC.createGain();arenaBus.gain.value=0.9;arenaBus.connect(master);
    broadcastBus=AC.createGain();broadcastBus.gain.value=0.95;connectArenaVoiceChain(broadcastBus,"pa");
    playerBus=AC.createGain();playerBus.gain.value=0.72;connectArenaVoiceChain(playerBus,"player");
    sfxBus=AC.createGain();sfxBus.gain.value=0.95;sfxBus.connect(master);
    AUDIO_READY=AC.state==="running";syncAudioDebug();
    primeAudio(true);
    try{if(AC.state==="suspended")AC.resume();}catch(e){}
    // ---- 观众环境床:三层共振峰人声噪声(远/中/近) + 低频轰鸣 ----
    crowdBus=AC.createGain();crowdGain=crowdBus; // 兼容旧名
    crowdBus.gain.value=CROWD_BASE;crowdBus.connect(arenaBus);
    const nbuf=mkNoiseBuf(3);
    [[420,0.7,0.5,0.09],[950,1.1,0.8,0.07],[2100,1.4,1.3,0.035]].forEach(([f,q,lfoHz,lfoAmt],i)=>{
      const src=AC.createBufferSource();src.buffer=nbuf;src.loop=true;
      const bp=AC.createBiquadFilter();bp.type="bandpass";bp.frequency.value=f;bp.Q.value=q;
      const g=AC.createGain();g.gain.value=0.5;
      const pan=AC.createStereoPanner?AC.createStereoPanner():null;
      const lfo=AC.createOscillator();lfo.frequency.value=lfoHz*rnd2(0.7,1.3);
      const lg=AC.createGain();lg.gain.value=lfoAmt*8;
      lfo.connect(lg);lg.connect(g.gain);lfo.start();
      src.connect(bp);bp.connect(g);
      if(pan){pan.pan.value=(i-1)*0.5;g.connect(pan);pan.connect(crowdBus);}
      else g.connect(crowdBus);
      src.start();
    });
    const rum=AC.createBufferSource();rum.buffer=nbuf;rum.loop=true;
    const lpf=AC.createBiquadFilter();lpf.type="lowpass";lpf.frequency.value=170;
    const rg=AC.createGain();rg.gain.value=0.5;
    rum.connect(lpf);lpf.connect(rg);rg.connect(crowdBus);rum.start();
    extInit();
    document.documentElement.dataset.audioVoices="on-demand";
    if(extA.crowd||extA.crowdCheer)crowdBus.gain.value=0.035;
    syncSceneAmbience();
    // ---- 随机现场事件:人浪/零星掌声/口哨/远处喊叫 ----
    ambTimer=setInterval(()=>{
      if(!AC||MUTED)return;
      const r=Math.random();
      if(r<0.30)crowdSwell(rnd2(0.06,0.14));
      else if(r<0.50)applause(0.25,rnd2(1.0,1.8));
      else if(r<0.62)whistle();
      else if(r<0.74)shout(rnd2(0.06,0.12));
    },4600);
    initVoice();
    try{if(AC.state==="suspended")AC.resume();}catch(e){}
    AUDIO_READY=AC.state==="running";syncAudioDebug();
  }catch(e){noteAudioIssue("init",e);syncAudioDebug();}
}
function primeAudio(force){
  if(!AC||MUTED)return;
  if(AUDIO_PRIMED&&!force)return;
  AUDIO_PRIMED=true;
  try{
    const t=AC.currentTime;
    const o=AC.createOscillator();
    const g=AC.createGain();
    o.type="sine";o.frequency.value=880;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.00001,t+0.04);
    o.connect(g);g.connect(master||AC.destination);
    o.start(t);o.stop(t+0.05);
  }catch(e){}
}
function audioState(){
  return {hasContext:!!AC,state:AC?AC.state:"none",ready:AUDIO_READY,primed:AUDIO_PRIMED,muted:MUTED,
    menuMusic:!!musicTimer||!!(extA.bgm&&!extA.bgm.paused),arenaMusic:!!arenaTimer,crowd:!!crowdBus,
    bgmExternal:!!extA.bgm,bgmPlaying:!!(extA.bgm&&!extA.bgm.paused),crowdExternal:!!(extA.crowd||extA.crowdCheer),
    crowdPlaying:!!(extA.crowd&&!extA.crowd.paused),crowdCheerPlaying:!!(extA.crowdCheer&&!extA.crowdCheer.paused),
    rainPlaying:!!(extA.rain&&!extA.rain.paused),oceanPlaying:!!(extA.ocean&&!extA.ocean.paused),gullReady:!!extA.gull};
}
try{window.__aibaAudioState=audioState;}catch(e){}
try{window.AIBAAudioCaptureStream=()=>ensureAudioCaptureDestination();}catch(e){}
function ensureAudio(menuMusic,forcePrime){
  if(MUTED)return false;
  if(menuMusic&&extA.bgm&&extA.bgm.paused)extPlay("bgm");
  audioInit();
  if(!AC)return false;
  prewarmGameplaySfx();
  primeAudio(!!forcePrime);
  const startMenu=()=>{
    AUDIO_READY=AC&&AC.state==="running";
    if(AUDIO_READY)for(const k in extA)routeExternalMediaElement(k,extA[k]);
    if(menuMusic&&!audioState().menuMusic&&(G.state==="menu"||G.state==="diff"))music(true,false);
    syncSceneAmbience();
    syncAudioDebug();
  };
  try{
    if(AC.state==="suspended"){
      if(menuMusic&&extA.bgm&&extA.bgm.paused)extPlay("bgm");
      const r=AC.resume();
      if(r&&r.then)r.then(()=>{delete document.documentElement.dataset.audioIssue;startMenu();}).catch(e=>{noteAudioIssue("resume",e);syncAudioDebug();});
      else startMenu();
    }else startMenu();
  }catch(e){noteAudioIssue("ensure",e);syncAudioDebug();}
  return true;
}
function mkNoiseBuf(sec){
  const len=AC.sampleRate*sec,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  let l=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;l=(l+0.03*w)/1.03;d[i]=l*3.6;}
  return b;
}
function crowdSwell(amt,dur){
  if(!crowdBus)return;
  const t=AC.currentTime,b=(extA.crowd?0.04:CROWD_BASE)+Math.max(0,Math.min(1,crowdHeat||0))*(extA.crowd?0.03:0.06);
  crowdBus.gain.cancelScheduledValues(t);
  crowdBus.gain.setValueAtTime(crowdBus.gain.value,t);
  crowdBus.gain.linearRampToValueAtTime(b+amt,t+0.5);
  crowdBus.gain.exponentialRampToValueAtTime(b,t+(dur||2.4));
}
try{window.AIBAAudio=Object.assign(window.AIBAAudio||{},{setCrowdHeat,crowdSwell});}catch(e){}
/* ---- 掌声:几十个去相关的真实拍手颗粒 ---- */
function applause(vol,dur,n){
  if(!AC||MUTED)return;
  if(extA.applause&&vol>0.4&&extPlay("applause"))return;
  dur=dur||2.4;n=n||Math.floor(dur*38);
  const t0=AC.currentTime;
  for(let i=0;i<n;i++){
    const u=i/n;
    const env=Math.min(1,u*5)*Math.pow(1-u,1.4);          // 起势→衰减
    if(Math.random()>env*1.25)continue;
    clapOne(t0+u*dur+rnd2(0,0.03),(vol||0.5)*rnd2(0.5,1)*env);
  }
}
function clapOne(at,v){
  const d=0.012+Math.random()*0.01;
  const n=AC.createBufferSource(),len=Math.ceil(AC.sampleRate*d),b=AC.createBuffer(1,len,AC.sampleRate),dd=b.getChannelData(0);
  for(let i=0;i<len;i++)dd[i]=(Math.random()*2-1)*(1-i/len);
  n.buffer=b;
  const bp=AC.createBiquadFilter();bp.type="bandpass";bp.frequency.value=rnd2(2000,3400);bp.Q.value=1.4;
  const g=AC.createGain();g.gain.value=v;
  const pan=AC.createStereoPanner?AC.createStereoPanner():null;
  n.connect(bp);bp.connect(g);
  if(pan){pan.pan.value=rnd2(-0.8,0.8);g.connect(pan);pan.connect(master);}
  else g.connect(master);
  n.start(at);
}
/* ---- 人声合成:单个喊叫 / 嘘声 / 惋惜 ---- */
function voiceBurst(at,f0,dur,vol,fall,pan){
  const o=AC.createOscillator();o.type="sawtooth";
  o.frequency.setValueAtTime(f0,at);
  o.frequency.exponentialRampToValueAtTime(Math.max(40,f0*(fall||0.8)),at+dur);
  const f1=AC.createBiquadFilter();f1.type="bandpass";f1.frequency.value=rnd2(550,850);f1.Q.value=2.5;
  const f2=AC.createBiquadFilter();f2.type="bandpass";f2.frequency.value=rnd2(1100,1700);f2.Q.value=3;
  const g=AC.createGain();
  g.gain.setValueAtTime(0.0001,at);
  g.gain.exponentialRampToValueAtTime(vol,at+0.04);
  g.gain.exponentialRampToValueAtTime(0.001,at+dur);
  const mix=AC.createGain();mix.gain.value=1;
  o.connect(f1);o.connect(f2);f1.connect(mix);f2.connect(mix);mix.connect(g);
  const p=AC.createStereoPanner?AC.createStereoPanner():null;
  if(p){p.pan.value=pan!=null?pan:rnd2(-0.7,0.7);g.connect(p);p.connect(master);}
  else g.connect(master);
  o.start(at);o.stop(at+dur+0.05);
}
function shout(vol){ // 远处兴奋喊叫
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  voiceBurst(t,rnd2(160,260),rnd2(0.25,0.5),vol||0.1,1.25);
}
function crowdRoar(big){ // 多人齐喊
  if(!AC||MUTED)return;
  const t=AC.currentTime,n=big?14:7;
  for(let i=0;i<n;i++)voiceBurst(t+rnd2(0,0.25),rnd2(140,300),rnd2(0.3,0.7),rnd2(0.05,0.12),rnd2(1.1,1.4));
}
function boo(dur){ // 起哄嘘声
  if(!AC||MUTED)return;
  if(extA.boo&&extPlay("boo",Math.max(900,(dur||2)*1000)))return;
  const t=AC.currentTime;dur=dur||2.0;
  for(let i=0;i<8;i++){
    const f0=rnd2(95,150);
    const o=AC.createOscillator();o.type="sawtooth";
    o.frequency.setValueAtTime(f0,t);
    o.frequency.linearRampToValueAtTime(f0*0.88,t+dur);
    const lp2=AC.createBiquadFilter();lp2.type="lowpass";lp2.frequency.value=520;
    const bp=AC.createBiquadFilter();bp.type="bandpass";bp.frequency.value=rnd2(300,420);bp.Q.value=2;
    const g=AC.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(rnd2(0.03,0.06),t+rnd2(0.2,0.5));
    g.gain.linearRampToValueAtTime(0.0001,t+dur);
    const p=AC.createStereoPanner?AC.createStereoPanner():null;
    o.connect(lp2);lp2.connect(bp);bp.connect(g);
    if(p){p.pan.value=rnd2(-0.8,0.8);g.connect(p);p.connect(master);}else g.connect(master);
    o.start(t);o.stop(t+dur+0.1);
  }
}
function aww(){ // 全场惋惜 "噢——"
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  for(let i=0;i<9;i++)voiceBurst(t+rnd2(0,0.12),rnd2(200,330),rnd2(0.5,0.9),rnd2(0.035,0.07),0.62);
}
function whistle(){
  if(!AC||MUTED)return;
  const t=AC.currentTime,f=rnd2(2100,2700);
  const o=AC.createOscillator();o.type="sine";
  o.frequency.setValueAtTime(f,t);
  o.frequency.linearRampToValueAtTime(f*1.12,t+0.18);
  o.frequency.linearRampToValueAtTime(f*0.9,t+0.45);
  const vib=AC.createOscillator();vib.frequency.value=7;
  const vg=AC.createGain();vg.gain.value=60;vib.connect(vg);vg.connect(o.frequency);vib.start(t);
  const g=AC.createGain();
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.05,t+0.05);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.55);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+0.6);vib.stop(t+0.6);
}
function airhorn(){
  if(extPlay("horn"))return;
  if(!AC||MUTED)return;
  [0,0.17,0.34].forEach((d,k)=>{
    const t=AC.currentTime+d,dur=k<2?0.15:0.55;
    [466,470,474,938].forEach(f=>{
      const o=AC.createOscillator();o.type="sawtooth";o.frequency.value=f;
      const g=AC.createGain();
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.07,t+0.015);
      g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
    });
  });
}
function organCharge(){ // 球馆风琴 "Charge!"
  if(!AC||MUTED)return;
  const seq=[[392,0.16],[523,0.16],[659,0.16],[784,0.16],[659,0.16],[784,0.5]];
  let t=AC.currentTime;
  seq.forEach(([f,d])=>{
    [1,2,3].forEach(h=>{
      const o=AC.createOscillator();o.type=h===1?"square":"triangle";o.frequency.value=f*h;
      const g=AC.createGain();
      g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.05/h,t+0.02);
      g.gain.setValueAtTime(0.05/h,t+d*0.8);g.gain.exponentialRampToValueAtTime(0.001,t+d);
      o.connect(g);g.connect(master);o.start(t);o.stop(t+d+0.05);
    });
    t+=d;
  });
  setTimeout(()=>crowdRoar(true),seq.reduce((a,s)=>a+s[1],0)*1000);
}
/* ---- 基础合成器(供旧调用) ---- */
function blip(freq,dur,type,vol,slide){
  if(!AC||MUTED)return;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type=type||"square";o.frequency.value=freq;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),AC.currentTime+dur);
  g.gain.setValueAtTime(vol||0.12,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur);
  o.connect(g);g.connect(sfxBus||master);o.start();o.stop(AC.currentTime+dur+0.02);
}
function noiseHit(dur,vol,hp){
  if(!AC||MUTED)return;
  const n=AC.createBufferSource(),len=AC.sampleRate*dur,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  n.buffer=b;
  const f=AC.createBiquadFilter();f.type="highpass";f.frequency.value=hp||2000;
  const g=AC.createGain();g.gain.value=vol||0.2;
  n.connect(f);f.connect(g);g.connect(sfxBus||master);n.start();
}
function blipBus(bus,freq,dur,type,vol,slide){
  if(!AC||MUTED)return;
  const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;
  o.type=type||"square";o.frequency.value=freq;
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
  g.gain.setValueAtTime(vol||0.12,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(bus||sfxBus||master);o.start(t);o.stop(t+dur+0.02);
}
const noiseBusCache=new Map();
function noiseBusBuffer(dur){
  const len=Math.max(1,Math.round(AC.sampleRate*dur)),key=AC.sampleRate+":"+len;
  if(noiseBusCache.has(key))return noiseBusCache.get(key);
  const b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  noiseBusCache.set(key,b);return b;
}
function noiseBus(bus,dur,vol,hp,lp){
  if(!AC||MUTED)return;
  const n=AC.createBufferSource();n.buffer=noiseBusBuffer(dur);
  const hi=AC.createBiquadFilter();hi.type="highpass";hi.frequency.value=hp||1200;
  const lo=AC.createBiquadFilter();lo.type="lowpass";lo.frequency.value=lp||9000;
  const g=AC.createGain();g.gain.value=vol||0.1;
  n.connect(hi);hi.connect(lo);lo.connect(g);g.connect(bus||sfxBus||master);n.start();
}
function rampGain(g,v,d){
  if(!AC||!g)return;
  const t=AC.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(0.0001,g.gain.value),t);
  g.gain.linearRampToValueAtTime(v,t+(d||0.18));
}
function duckBroadcast(dur,depth){
  if(!AC||MUTED)return;
  dur=dur||1600;
  clearTimeout(duckTimer);
  clearTimeout(mediaDuckTimer);
  mediaDuckUntil=Math.max(mediaDuckUntil,Date.now()+dur+160);
  rampGain(musicBus,0.38,0.12);
  rampGain(arenaBus,depth||0.62,0.12);
  applyExternalMediaMix();
  duckTimer=setTimeout(()=>{
    rampGain(musicBus,0.72,0.35);
    rampGain(arenaBus,0.9,0.35);
  },dur);
  mediaDuckTimer=setTimeout(()=>{
    mediaDuckUntil=0;
    applyExternalMediaMix();
  },dur+220);
}
function broadcastSting(kind){
  if(!AC||MUTED)return;
  const bus=broadcastBus||master;
  if(kind==="score"){
    blipBus(bus,784,0.08,"square",0.045,1046);
    setTimeout(()=>blipBus(bus,1175,0.11,"square",0.05,880),80);
    return;
  }
  if(kind==="danger"){
    [196,233,277].forEach((f,i)=>setTimeout(()=>blipBus(bus,f,0.18,"sawtooth",0.045,120),i*90));
    return;
  }
  blipBus(bus,523,0.1,"triangle",0.04,784);
}
function arenaMusic(on,intensity){
  if(arenaTimer){clearInterval(arenaTimer);arenaTimer=null;}
  if(!on||!AC){syncAudioDebug();return;}
  intensity=intensity||0.75;
  let i=0;
  const beat=()=>{
    if(MUTED)return;
    const bus=musicBus||master;
    if(i%4===0)blipBus(bus,55,0.16,"triangle",0.08*intensity,38);
    if(i%8===2)noiseBus(bus,0.045,0.045*intensity,1800,5200);
    if(i%2===0)noiseBus(bus,0.018,0.018*intensity,6500,11000);
    if(i%16===0)[147,220,294].forEach(f=>blipBus(bus,f,0.55,"triangle",0.012*intensity));
    i++;
  };
  beat();
  arenaTimer=setInterval(beat,185);
  syncAudioDebug();
}
function enterArenaAudio(intensity){
  ensureAudio(false);
  if(!AC)return;
  prewarmGameplaySfx();
  music(false);
  arenaMusic(true,intensity||0.8);
  if(extA.crowd)extPlay("crowd");
  if(extA.crowdCheer)extPlay("crowdCheer");
  crowdSwell(0.08,1.8);
  syncSceneAmbience();
}
function leaveArenaAudio(){
  arenaMusic(false);
  extStop("crowd");
  extStop("crowdCheer");
  extStop("rain");
  extStop("ocean");
  syncAudioDebug();
}
let shoeSqueakAt=0;
function shoeSqueak(strong){
  if(!AC||MUTED)return;
  if(extA.shoeSqueak){
    const now=Date.now(),cooldown=strong?900:1700;
    if(now-shoeSqueakAt<cooldown)return;
    if(extPlay("shoeSqueak",strong?1100:1900)){shoeSqueakAt=now;return;}
  }
  const t=AC.currentTime;
  const o=AC.createOscillator();o.type="sine";
  o.frequency.setValueAtTime(rnd2(1600,2300),t);
  o.frequency.linearRampToValueAtTime(rnd2(2400,3300),t+0.08);
  const g=AC.createGain();
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(strong?0.055:0.03,t+0.018);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.16);
  o.connect(g);g.connect(playerBus||sfxBus||master);o.start(t);o.stop(t+0.18);
}
function playerEffort(){
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  voiceBurst(t,rnd2(95,135),0.12,0.028,0.78,rnd2(-0.18,0.18));
}
/* ---- 篮球音效 v2 ---- */
function sBounce(kind){
  if(kind==="sequence"&&extPlay("bounceSequence"))return;
  if(extPlayVariant("bounce",["bounce","bounce2"]))return;
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  const o=AC.createOscillator();o.type="sine";          // 皮球低频"咚"
  o.frequency.setValueAtTime(rnd2(82,95),t);
  o.frequency.exponentialRampToValueAtTime(46,t+0.11);
  const g=AC.createGain();
  g.gain.setValueAtTime(0.34,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.13);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+0.15);
  const n=AC.createBufferSource(),len=AC.sampleRate*0.03,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  n.buffer=b;
  const bp=AC.createBiquadFilter();bp.type="bandpass";bp.frequency.value=620;bp.Q.value=1.2;
  const g2=AC.createGain();g2.gain.value=0.16;
  n.connect(bp);bp.connect(g2);g2.connect(master);n.start(t);
}
function sSwish(){
  if(extPlayVariant("swish",["swish","swish2","swish3"]))return;
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  for(let i=0;i<3;i++){                                  // 网绳三段摩擦
    const n=AC.createBufferSource(),len=AC.sampleRate*0.07,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
    for(let j=0;j<len;j++)d[j]=(Math.random()*2-1)*(1-j/len);
    n.buffer=b;
    const hpf=AC.createBiquadFilter();hpf.type="highpass";hpf.frequency.value=2600;
    const lpf=AC.createBiquadFilter();lpf.type="lowpass";
    lpf.frequency.setValueAtTime(7000-i*1400,t+i*0.045);
    const g=AC.createGain();g.gain.value=0.27*(1-i*0.22);
    n.connect(hpf);hpf.connect(lpf);lpf.connect(g);g.connect(master);
    n.start(t+i*0.045);
  }
}
function sClank(){ // 铁框:非谐金属泛音
  if(extPlayVariant("clank",["clank","clank2"]))return;
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  [317,476,833,1276].forEach((f,i)=>{
    const o=AC.createOscillator();o.type="sine";o.frequency.value=f*rnd2(0.99,1.01);
    const g=AC.createGain();
    g.gain.setValueAtTime(0.16/(i*0.9+1),t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.3-i*0.05);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+0.35);
  });
  noiseHit(0.025,0.14,2500);
}
function sRimMake(){
  if(extPlay("rimMake"))return;
  sClank();
}
function sBoard(){ // 篮板:木质闷响
  if(!AC||MUTED)return;
  const t=AC.currentTime;
  const o=AC.createOscillator();o.type="sine";o.frequency.value=185;
  const g=AC.createGain();g.gain.setValueAtTime(0.24,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+0.14);
  const n=AC.createBufferSource(),len=AC.sampleRate*0.05,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  n.buffer=b;
  const lpf=AC.createBiquadFilter();lpf.type="lowpass";lpf.frequency.value=480;
  const g2=AC.createGain();g2.gain.value=0.3;
  n.connect(lpf);lpf.connect(g2);g2.connect(master);n.start(t);
}
function sBuzz(){
  if(extPlay("buzzer")){if(navigator.vibrate)navigator.vibrate([40,40,40]);return;}
  if(!AC||MUTED){if(navigator.vibrate)navigator.vibrate([40,40,40]);return;}
  const t=AC.currentTime,dur=1.15;
  const sh=AC.createWaveShaper();
  const curve=new Float32Array(256);
  for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*3);}
  sh.curve=curve;
  const g=AC.createGain();g.gain.setValueAtTime(0.16,t);
  g.gain.setValueAtTime(0.16,t+dur-0.08);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  sh.connect(g);g.connect(master);
  [149,151,298].forEach(f=>{
    const o=AC.createOscillator();o.type="sawtooth";o.frequency.value=f;
    o.connect(sh);o.start(t);o.stop(t+dur);
  });
  if(navigator.vibrate)navigator.vibrate([40,40,40]);
}
const sBeep=()=>blip(880,0.1,"square",0.1);
const sGo=()=>{if(!extPlay("startWhistle"))blip(1320,0.3,"square",0.14);};
function cheerSound(big){
  if(!AC||MUTED)return;
  crowdSwell(big?0.42:0.2,big?2.8:1.5);
  applause(big?0.6:0.3,big?2.6:1.4);
  crowdRoar(big);
  if(big&&Math.random()<0.6)whistle();
}
/* ---- BGM v2: 鼓组+贝斯+和声垫+琶音 ---- */
function music(on,fast){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  arenaMusic(false);
  if(extA.bgm){on?extPlay("bgm"):extStop("bgm");syncAudioDebug();return;}
  if(!on||!AC){syncAudioDebug();return;}
  const bass=[82,82,110,82,98,82,110,123];
  const mel=[330,392,440,523,440,392,659,523];
  const chord=[[165,196,247],[165,196,247],[147,196,220],[131,165,196]];
  let i=0;
  const beat=()=>{
    if(MUTED)return;
    blipBus(musicBus||master,bass[i%8],0.18,"triangle",0.11);
    if(i%4===0){const t=AC.currentTime;          // 底鼓
      const o=AC.createOscillator();o.frequency.setValueAtTime(120,t);
      o.frequency.exponentialRampToValueAtTime(45,t+0.09);
      const g=AC.createGain();g.gain.setValueAtTime(0.3,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      o.connect(g);g.connect(musicBus||master);o.start(t);o.stop(t+0.12);}
    if(i%4===2)noiseBus(musicBus||master,0.07,0.09,1600,9000);          // 军鼓
    noiseBus(musicBus||master,0.022,i%2?0.05:0.028,7000,12000);           // 镲
    if(i%2===0)blipBus(musicBus||master,mel[(i/2)%8]*(fast?1.5:1),0.13,"square",0.05);
    if(i%8===0)chord[(i/8)%4].forEach(f=>blipBus(musicBus||master,f*(fast?1.5:1),0.5,"triangle",0.018));
    i++;
  };
  beat();
  musicTimer=setInterval(beat,fast?150:210);
  syncAudioDebug();
}
/* ---- 语音:情绪化播报 ---- */
const SPK={voice:null,last:0,queue:[],timer:0,speaking:false};
const EMO={
  pa:   {pitch:0.82,rate:1.02,jit:0.05,pre:[]},
  hype: {pitch:1.18,rate:1.12,jit:0.12,pre:["Wow! ","Big shot! ","Unbelievable! "]},
  taunt:{pitch:1.05,rate:1.08,jit:0.1, pre:["Ha! ","Hey! "]},
  angry:{pitch:0.82,rate:1.08,jit:0.08,pre:["Come on! "]},
  sad:  {pitch:0.72,rate:0.88,jit:0.06,pre:["Oh no. ","No. "]}
};
function initVoice(){
  if(!window.speechSynthesis)return;
  const pick=()=>{
    const vs=speechSynthesis.getVoices();
    SPK.voice=vs.find(v=>/en[-_]US/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
  };
  pick();speechSynthesis.onvoiceschanged=pick;
}
function speechTextEn(txt){
  let s=String(txt||"").replace(/，/g,",").replace(/。/g,".").replace(/！/g,"!").replace(/？/g,"?");
  if(EN_SPEECH[s])return EN_SPEECH[s];
  let m=s.match(/^有请,?(.+?)(?:,(\d+)号)?(?:!|$)/);
  if(m)return "Now entering, "+m[1]+(m[2]?", number "+m[2]:"")+"!";
  m=s.match(/^(.+),(\d+)分!$/);
  if(m)return m[1]+", "+m[2]+" points!";
  m=s.match(/现在(\d+)比(\d+)/);
  if(m){
    const lead=s.includes("双方打平")?"We are tied.":(s.includes("你暂时领先")?"You are in front.":(s.includes("暂时领先")?"Your opponent is in front.":""));
    if(s.includes("最后五分决胜"))return "Final five points. Score is "+m[1]+" to "+m[2]+". Every shot matters.";
    if(s.includes("九十分关口"))return "Ninety point checkpoint. Score is "+m[1]+" to "+m[2]+". "+lead;
    if(s.includes("最后冲刺"))return "Final run. Score is "+m[1]+" to "+m[2]+". Every shot matters.";
    return "Score update. It is "+m[1]+" to "+m[2]+". "+lead;
  }
  m=s.match(/^(.+)反超了!$/);
  if(m)return m[1]+" takes the lead!";
  m=s.match(/^(.+)率先到达一百分!$/);
  if(m)return m[1]+" reaches one hundred first!";
  m=s.match(/^第(\d+)关,(.+).目标(\d+)分.$/);
  if(m)return "Level "+m[1]+", "+m[2]+". Target score, "+m[3]+".";
  m=s.match(/^RACK RUSH完成,总分(\d+)分!$/);
  if(m)return "Rack Rush complete. Total score, "+m[1]+"!";
  m=s.match(/^本次挑战结束,总分(\d+)分.$/);
  if(m)return "Challenge over. Total score, "+m[1]+".";
  if(/[一-龥]/.test(s))return "The crowd is getting loud.";
  return s;
}
function speechLiveGame(){return G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush";}
function speechInputCritical(){return speechLiveGame()&&(G.canShoot||G.charging||G.moving||VISION.machine.phase==="hold"||VISION.machine.phase==="charging");}
function scheduleSpeechFlush(delay){
  clearTimeout(SPK.timer);SPK.timer=setTimeout(flushSpeechQueue,delay==null?120:delay);
}
function speakQueued(item){
  try{
    if(!window.speechSynthesis||MUTED){SPK.speaking=false;return;}
    const txt=item.txt,opt=item.opt||{};
    const now=Date.now();
    if(!opt.pri&&now-SPK.last<2600){scheduleSpeechFlush(120);return;}
    SPK.last=now;
    if(opt.pri&&!speechLiveGame())speechSynthesis.cancel();
    if(opt.pri||opt.emo==="pa"||opt.emo==="hype"){
      voiceMicTransient(opt.emo==="hype"?"dj":(opt.emo||"pa"));
      duckBroadcast(opt.pri?2200:1400,opt.emo==="hype"?.58:.62);
    }
    const e=EMO[opt.emo]||{pitch:opt.pitch||1,rate:opt.rate||1.08,jit:0.06,pre:[]};
    let full=speechTextEn(txt);
    if(e.pre.length&&Math.random()<0.65)full=e.pre[(Math.random()*e.pre.length)|0]+full;
    const u=new SpeechSynthesisUtterance(full);
    if(SPK.voice)u.voice=SPK.voice;
    u.lang="en-US";u.volume=opt.volume==null ? .86 : opt.volume;
    const basePitch=opt.pitch!=null?opt.pitch:e.pitch;
    const baseRate=opt.rate!=null?opt.rate:e.rate;
    u.pitch=Math.max(0.1,Math.min(2,basePitch+(Math.random()*2-1)*e.jit));
    u.rate=Math.max(0.5,Math.min(2,baseRate*(full.includes("!")?1.08:1)));
    SPK.speaking=true;
    const done=()=>{SPK.speaking=false;scheduleSpeechFlush(90);};
    u.onend=done;u.onerror=done;speechSynthesis.speak(u);
  }catch(e2){SPK.speaking=false;scheduleSpeechFlush(120);}
}
function flushSpeechQueue(){
  if(MUTED||!window.speechSynthesis){SPK.queue.length=0;SPK.speaking=false;return;}
  if(SPK.speaking||!SPK.queue.length)return;
  const item=SPK.queue[0];
  if(speechInputCritical()&&Date.now()-item.at<5000){scheduleSpeechFlush(140);return;}
  SPK.queue.shift();speakQueued(item);
}
function say(txt,opt){
  if(!window.speechSynthesis||MUTED)return;
  opt=opt||{};
  if(!opt.pri&&SPK.queue.some(q=>q.txt===txt))return;
  if(opt.pri)SPK.queue=SPK.queue.filter(q=>q.opt&&q.opt.pri);
  SPK.queue.push({txt,opt,at:Date.now()});
  if(SPK.queue.length>4)SPK.queue.splice(0,SPK.queue.length-4);
  scheduleSpeechFlush(speechInputCritical()?140:20);
}
const paSay=(t,pri)=>{if(!playClip(t,"pa"))say(t,{emo:"pa",pri});};
const djSay=(t,pri)=>{if(!playClip(t,"dj"))say(t,{emo:"hype",pri});};
function rivalSay(o,t,emo){
  if(playClip(t,emo||"player"))return;
  say(t,{emo:emo||"taunt",pitch:(EMO[emo||"taunt"].pitch)*(0.85+((o.num||7)%5)*0.09)});
}
function toggleMute(){
  const menuLike=G.state==="menu"||G.state==="diff";
  const arenaLike=G.state==="cinematic"||G.state==="round"||G.state==="aishow"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="rushintro"||G.state==="rushbetween";
  try{
    const s=audioState();
    const needsStart=MUTED||!AC||AC.state==="suspended"||(menuLike&&!s.menuMusic)||
      (arenaLike&&(!arenaTimer||(extA.crowd&&extA.crowd.paused)||(extA.crowdCheer&&extA.crowdCheer.paused)));
    if(needsStart){
      MUTED=false;if(window.AIBASetIcon)AIBASetIcon("muteBtn","volume-2","静音");
      ensureAudio(menuLike,true);
      if(arenaLike&&!arenaTimer)enterArenaAudio(0.85);
      if(extA.crowd&&arenaLike)extPlay("crowd");
      if(extA.crowdCheer&&arenaLike)extPlay("crowdCheer");
      syncSceneAmbience();
      syncAudioDebug();
      return;
    }
    MUTED=true;if(window.AIBASetIcon)AIBASetIcon("muteBtn","volume-x","开启声音");
    if(AC)AC.suspend();
    if(window.speechSynthesis&&MUTED)speechSynthesis.cancel();
    if(MUTED){clearTimeout(SPK.timer);SPK.queue.length=0;SPK.speaking=false;}
    if(MUTED){extStop("bgm");extStop("crowd");extStop("crowdCheer");extStop("rain");extStop("ocean");extStop("gull");}
    syncAudioDebug();
  }catch(e){}
}

const AUDIO_EVENTS = {
  contest_start: ["p_contest_start_01_en", "p_contest_start_02_en", "p_contest_start_03_en"],
  contest_opponent_intro: ["r_contest_intro_01_en", "r_contest_intro_02_en", "r_contest_intro_03_en"],
  contest_host_intro: ["p_contest_intro_04_en", "p_contest_intro_05_en"],
  contest_moneyrack: ["dj_contest_moneyrack_01_en", "dj_contest_moneyrack_02_en", "dj_contest_moneyrack_03_en"],
  contest_finalrack: ["p_contest_finalrack_01_en", "p_contest_finalrack_02_en", "p_contest_finalrack_03_en"],
  contest_final10: ["p_contest_final10_01_en", "p_contest_final10_02_en", "p_contest_final10_03_en", "p_contest_final10_04_en"],
  contest_advance: ["p_contest_advance_01_en", "p_contest_advance_02_en"],
  contest_eliminated: ["p_contest_advance_03_en", "p_contest_advance_04_en"],
  contest_finals_start: ["p_contest_advance_05_en", "p_contest_advance_06_en"],
  contest_champion: ["dj_contest_champion_01_en", "dj_contest_champion_02_en"],
  contest_runnerup: ["dj_contest_champion_03_en", "dj_contest_champion_04_en"],
  rack_clear: ["dj_rack_clear_01_en", "dj_rack_clear_02_en", "dj_rack_clear_03_en", "dj_rack_clear_04_en"],
  rack_fail: ["p_rack_fail_01_en", "p_rack_fail_02_en", "p_rack_fail_03_en", "p_rack_fail_04_en"],
  speed100_25: ["p_speed100_25_01_en", "p_speed100_25_02_en"],
  speed100_50: ["p_speed100_50_01_en", "p_speed100_50_02_en"],
  speed100_75: ["p_speed100_75_01_en", "p_speed100_75_02_en"],
  speed100_90: ["p_speed100_90_01_en", "p_speed100_90_02_en"],
  speed100_finish_record: ["dj_speed100_finish_01_en"],
  speed100_finish_board: ["dj_speed100_finish_02_en"],
  speed100_finish: ["dj_speed100_finish_03_en", "dj_speed100_finish_04_en"],
  speed100_finish_close: ["dj_speed100_finish_05_en"],
  final_shot: ["dj_final_shot_01_en", "dj_final_shot_02_en", "dj_final_shot_03_en", "dj_final_shot_04_en", "dj_final_shot_05_en"],
  dna_intro: ["dna_intro_01_en", "dna_intro_02_en", "dna_intro_03_en"],
  dna_scan: ["dna_scan_01_en", "dna_scan_02_en", "dna_scan_03_en", "dna_scan_04_en"],
  dna_metric_elbow: ["dna_metric_elbow_01_en", "dna_metric_elbow_02_en"],
  dna_metric_balance: ["dna_metric_balance_01_en", "dna_metric_balance_02_en"],
  dna_metric_release: ["dna_metric_release_01_en", "dna_metric_release_02_en"],
  dna_metric_follow: ["dna_metric_follow_01_en", "dna_metric_follow_02_en"],
  dna_result_legend: ["dna_result_legend_01_en", "dna_result_legend_02_en"],
  dna_result_elite: ["dna_result_legend_03_en", "dna_result_legend_04_en"],
  dna_result_solid: ["dna_result_legend_05_en", "dna_result_legend_06_en"],
  dna_result_brick: ["dna_result_legend_07_en", "dna_result_legend_08_en"],
  pose_ready: ["p_pose_ready_01_en", "p_pose_ready_02_en", "p_pose_ready_03_en"],
  pose_lost: ["p_pose_lost_01_en", "p_pose_lost_02_en", "p_pose_lost_03_en"]
};

function playSFX(name, vol){
  if(MUTED) return;
  const u = VOICE_BASE + name + ".wav";
  try {
    audioInit();
    if (!playClip.cache[u]) {
      const a = new Audio(); a.preload = "auto"; a.src = u;
      playClip.cache[u] = a;
    }
    const base = playClip.cache[u], a = base.paused && base.currentTime === 0 ? base : base.cloneNode();
    a.crossOrigin = "anonymous";
    if (AC && a) {
      if (!a._aibaSfxSource) a._aibaSfxSource = AC.createMediaElementSource(a);
      try{a._aibaSfxSource.disconnect();}catch(e){}
      a._aibaSfxSource.connect(sfxBus || master);
    }
    a.onended=()=>{try{if(a._aibaSfxSource)a._aibaSfxSource.disconnect();}catch(e){};a.onended=null;};
    a.volume = vol == null ? 0.95 : vol;
    a.currentTime = 0;
    const p = a.play(); if (p && p.catch) p.catch(()=>{});
  } catch (e) {}
}

function playAudioEvent(eventId, opt) {
  if (MUTED) return false;
  opt = opt || {};
  const pool = AUDIO_EVENTS[eventId];
  if (!pool || !pool.length) return false;
  const name = pool[Math.floor(Math.random() * pool.length)];
  if(/^sfx_|^ui_/.test(name))return playSFX(name,opt.volume);
  const url = voiceUrl(name + ".wav");
  const role = voiceRoleForText("", url, opt.role);
  return playVoiceUrl(url, role, opt);
}

window.playSFX = playSFX;
window.playAudioEvent = playAudioEvent;
