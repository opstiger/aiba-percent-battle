/* 混音契约回归:暂停压低、离场淡出、语音不叠自己。
   这三条都只活在 audio.js 的闭包里,靠 __aibaAudioState() 暴露的混音实况取证。

   ⚠ 这一条测的就是音效本身,所以刻意不挂 scripts/silence-browser.js:
     那个静音器把 HTMLMediaElement.volume 锁成 0、把 AudioNode.connect 掐断,
     总线不进渲染图,gain 自动化根本不推进,压低和淡出都无从测起。
     静音改由 Chromium 的 --mute-audio 在渲染器出口做,不碰任何 JS 值;
     系统 TTS 不归渲染器管,单独关掉。
   ⚠ headless Chromium 把 JS 定时器节流到约 2Hz(实测 setInterval(30) 在
     520/1066/1574ms 触发),所以淡出斜坡用一条 4 秒的长淡出来采样。 */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd();
const URL_BASE=process.env.AIBA_QA_URL||'http://127.0.0.1:4195';
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio','--autoplay-policy=no-user-gesture-required']});break;}catch{}}
assert(browser);
const errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:900,height:640}});
 /* 这一条测的就是音效本身,所以不能上 silence-browser.js:它把 HTMLMediaElement
    的 volume 锁成 0、把 AudioNode.connect 掐断,总线因此不进渲染图,
    gain 自动化根本不推进 —— 压低和淡出都无从测起。
    静音改由 Chromium 的 --mute-audio 在渲染器出口做,不碰任何 JS 值。
    语音合成走系统 TTS,不归渲染器管,单独关掉。 */
 await ctx.addInitScript(()=>{try{speechSynthesis.speak=()=>{};}catch(e){}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 await page.goto(URL_BASE+'/index.html?intro=0&seed=20260918',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof G!=='undefined'&&window.AIBAAudio&&window.__aibaAudioState,null,{timeout:120000});

 const api=await page.evaluate(()=>({
   hasDuck:typeof AIBAAudio.setPauseAudioDuck==='function',
   state:__aibaAudioState()
 }));
 console.log('导出到位:',api.hasDuck,'初始:',JSON.stringify(api.state));
 assert(api.hasDuck,'setPauseAudioDuck 必须导出');

 // 进入一场,起音频
 await page.evaluate(()=>{goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();});
 await page.waitForTimeout(1200);
 // 音频要用户手势才解锁:用真实点击
 await page.mouse.click(450,600);
 await page.waitForTimeout(1500);
 const live=await page.evaluate(()=>__aibaAudioState());
 console.log('开赛后:',JSON.stringify(live));

 // ---- 暂停压低:不能变成"停" ----
 const paused=await page.evaluate(async()=>{
   PAUSE.on=true;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   await new Promise(r=>setTimeout(r,450));
   return __aibaAudioState();
 });
 console.log('暂停中:',JSON.stringify(paused));
 const resumed=await page.evaluate(async()=>{
   PAUSE.on=false;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   await new Promise(r=>setTimeout(r,450));
   return __aibaAudioState();
 });
 console.log('恢复后:',JSON.stringify(resumed));
 if(live.arenaMusic)assert(paused.arenaMusic,'暂停必须是压低不是停掉场馆乐');
 if(live.crowdPlaying)assert(paused.crowdPlaying,'暂停必须是压低不是停掉人群');
 assert.equal(resumed.arenaMusic,paused.arenaMusic,'恢复不该改变播放状态');
 assert.equal(paused.pauseDuck,true,'暂停时 duck 必须打开');
 assert.equal(resumed.pauseDuck,false,'恢复时 duck 必须关掉');
 if(live.crowdVol!=null){
   assert(paused.crowdVol<live.crowdVol*.6,`暂停时人群音量必须明显下来: ${live.crowdVol} -> ${paused.crowdVol}`);
   assert(Math.abs(resumed.crowdVol-live.crowdVol)<1e-3,`恢复必须回到原音量: ${live.crowdVol} -> ${resumed.crowdVol}`);
 }
 // 音乐/场馆总线用"基准 × 暂停系数",所以拿基准比,而不是拿绝对值比 ——
 // 绝对值里还叠着解说压低,直接比会把两件事混成一件。
 for(const [bus,now,base] of [['music','musicGainNow','musicBase'],['arena','arenaGainNow','arenaBase']]){
   if(live[now]==null)continue;
   assert(Math.abs(paused[now]-paused[base]*.45)<.02,`暂停时 ${bus} 必须是基准的 45%: ${paused[base]} -> ${paused[now]}`);
   assert(Math.abs(resumed[now]-resumed[base])<.02,`恢复后 ${bus} 必须回到基准: ${resumed[base]} -> ${resumed[now]}`);
 }
 console.log('  音乐总线 '+live.musicGainNow+' -> '+paused.musicGainNow+' -> '+resumed.musicGainNow+'  (基准 '+live.musicBase+'/'+paused.musicBase+'/'+resumed.musicBase+')');
 console.log('  场馆总线 '+live.arenaGainNow+' -> '+paused.arenaGainNow+' -> '+resumed.arenaGainNow+'  (基准 '+live.arenaBase+'/'+paused.arenaBase+'/'+resumed.arenaBase+')');

 // 解说压低落在暂停期间,两者必须叠加,而不是后者抹掉前者。
 const compose=await page.evaluate(async()=>{
   const rows={};
   PAUSE.on=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   await new Promise(r=>setTimeout(r,300));rows.pausedOnly=__aibaAudioState();
   duckBroadcast(1400,.62);await new Promise(r=>setTimeout(r,320));rows.pausedPlusVoice=__aibaAudioState();
   PAUSE.on=false;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   await new Promise(r=>setTimeout(r,320));rows.voiceOnly=__aibaAudioState();
   await new Promise(r=>setTimeout(r,1500));rows.clear=__aibaAudioState();
   return rows;
 });
 console.log('  叠加:暂停 '+compose.pausedOnly.musicGainNow+' → +解说 '+compose.pausedPlusVoice.musicGainNow
   +' → 只剩解说 '+compose.voiceOnly.musicGainNow+' → 全清 '+compose.clear.musicGainNow);
 assert(compose.pausedPlusVoice.musicGainNow<compose.pausedOnly.musicGainNow,'暂停中来解说必须更低,而不是被顶回去');
 assert(compose.voiceOnly.musicGainNow>compose.pausedPlusVoice.musicGainNow,'退出暂停只该摘掉暂停那一层');
 assert(Math.abs(compose.voiceOnly.musicGainNow-0.38)<.03,'退出暂停后必须仍保留解说压低 0.38,实际 '+compose.voiceOnly.musicGainNow);
 assert(Math.abs(compose.clear.musicGainNow-0.72)<.03,'解说说完必须完全恢复,实际 '+compose.clear.musicGainNow);
 assert(paused.crowdGainNow<live.crowdGainNow,`暂停时人群总线必须下降: ${live.crowdGainNow} -> ${paused.crowdGainNow}`);
 console.log('  人群音量 '+live.crowdVol+' -> '+paused.crowdVol+' -> '+resumed.crowdVol);
 console.log('  人群总线 '+live.crowdGainNow+' -> '+paused.crowdGainNow+' -> '+resumed.crowdGainNow);
 console.log('  场馆乐   '+live.musicGainNow+' -> '+paused.musicGainNow+' -> '+resumed.musicGainNow);

 /* ---- 淡出 ----
    注意:headless Chromium 把 JS 定时器节流到约 2Hz(实测对照 setInterval(30)
    在 520/1066/1574ms 触发),leaveArenaAudio 的 260ms 淡出会在第一次 tick 就
    直接走完,采不到中间值。所以中间斜坡用一条 4 秒的长淡出来证明,
    真实时长的收尾行为再单独验一遍。 */
 const ramp=await page.evaluate(async()=>{
   const rows=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const from=extA.crowd.volume;
   extStop('crowd',4000);
   for(let i=0;i<3;i++){await wait(560);const st=__aibaAudioState();rows.push({vol:st.crowdVol,playing:st.crowdPlaying,fading:st.fading});}
   extPlay('crowd');                       // 半路重新播放必须取消淡出并还原音量
   await wait(120);
   const after=__aibaAudioState();
   return {from,rows,after};
 });
 console.log('  长淡出 '+ramp.from+' -> '+ramp.rows.map(r=>r.vol).join(' -> ')+'  (重新播放后 '+ramp.after.crowdVol+')');
 assert(ramp.rows.every(r=>r.playing),'淡出途中元素必须还在播');
 assert(ramp.rows.every(r=>r.fading.includes('crowd')),'淡出途中必须挂着 fading 标记');
 for(let i=0;i<ramp.rows.length;i++){
   const prev=i?ramp.rows[i-1].vol:ramp.from;
   assert(ramp.rows[i].vol<prev,`音量必须持续下降: ${prev} -> ${ramp.rows[i].vol}`);
   assert(ramp.rows[i].vol>0,'淡出途中不该已经归零: '+ramp.rows[i].vol);
 }
 assert(!ramp.after.fading.includes('crowd'),'重新播放必须取消未完的淡出');
 assert(Math.abs(ramp.after.crowdVol-ramp.from)<1e-3,'重新播放必须还原音量,否则会变成哑的: '+ramp.after.crowdVol);
 assert(ramp.after.crowdPlaying,'重新播放后必须在播');

 // 真实调用:回菜单离场,淡完必须真停、标记清干净、音量还原。
 const leave=await page.evaluate(async()=>{
   const from=extA.crowd.volume;
   G.state='menu';
   leaveArenaAudio();
   const mid=__aibaAudioState();
   await new Promise(r=>setTimeout(r,1400));
   return {from,mid,end:__aibaAudioState()};
 });
 console.log('  离场 fading='+JSON.stringify(leave.mid.fading)+' -> 结束 playing='+leave.end.crowdPlaying+' vol='+leave.end.crowdVol);
 assert(leave.mid.fading.includes('crowd'),'离场必须走淡出而不是硬停');
 assert(!leave.end.crowdPlaying,'淡完必须真的停下来');
 assert(!leave.end.fading.length,'淡出结束必须清掉 fading 标记');
 assert(Math.abs(leave.end.crowdVol-leave.from)<1e-3,'停下后音量必须还原,下次播放不能是哑的: '+leave.end.crowdVol);

 /* ---- 语音不再自己盖自己 ----
    老代码在"同一条正在放"时 cloneNode() 另开一条:解说会重叠,而且每个克隆都要
    createMediaElementSource,这些节点没人释放。这里连开三次,断言元素和音频节点
    都只有一份,并且每次都从头开始放。 */
 const voice=await page.evaluate(async()=>{
   const u='assets/aiba-audio/voices/dj_01_en.wav';
   let made=0,ok=0;const orig=AudioContext.prototype.createMediaElementSource;
   AudioContext.prototype.createMediaElementSource=function(){made++;const r=orig.apply(this,arguments);ok++;return r;};
   const beforeEls=document.querySelectorAll('audio').length;
   const before=__aibaAudioState().voiceEls;
   for(let i=0;i<3;i++){playVoiceUrl(u,'dj');await new Promise(r=>setTimeout(r,200));}
   const st=__aibaAudioState();
   // 同一条 URL 只能新增一个语音元素;三次调用只能建一个音频节点,且必须建成功。
   const out={made,ok,elements:st.voiceEls-before,routed:true,
     newDomAudio:document.querySelectorAll('audio').length-beforeEls};
   AudioContext.prototype.createMediaElementSource=orig;
   return out;
 });
 console.log('  语音三连:新增元素 '+voice.elements+' 个,新建音频节点 '+voice.made+' 个(成功 '+voice.ok+')');
 assert.equal(voice.elements,1,'同一条语音只能有一个元素,不能 clone');
 assert.equal(voice.made,1,'同一条语音只能建一个 MediaElementSource,实际 '+voice.made);
 assert.equal(voice.ok,1,'这个节点必须真的建成功 —— 抛异常就等于语音绕开了总线');
 assert.equal(voice.newDomAudio,0,'不该往文档里塞新的 audio 元素');

 console.log(errors.length?('错误:\n'+errors.join('\n')):'无页面错误');
 assert.deepEqual(errors.filter(e=>!/favicon|404|Failed to load resource/i.test(e)),[],'不能有页面错误');
 console.log('PASS');
 await ctx.close();
}finally{await browser.close();}
