/* ---------------- vertical highlight recorder ---------------- */
(function(global){
  "use strict";
  const MOBILE=(()=>{
    try{return matchMedia("(pointer:coarse)").matches||Math.min(innerWidth,innerHeight)<700;}
    catch(e){return false;}
  })();
  const W=MOBILE?540:720,H=MOBILE?960:1280,POST_MS=6200,RESULT_HOLD_MS=5200,FPS=MOBILE?15:24;
  const MAX_CLIP_MS=18000,MIN_RESULT_MS=4800,RANK_HOLD_MS=1800;
  const VIDEO_BPS=MOBILE?1800000:3600000;
  const state={
    canvas:null,ctx:null,stream:null,rec:null,chunks:[],lastBlob:null,lastUrl:"",
    lastDraw:0,capturing:false,armed:false,saveWhenReady:false,lastLabel:"精彩时刻",startedAt:0,stopTimer:0,canvasTrack:null,audioTracks:[],resultCard:null,resultAt:0,stopAt:0
  };
  function supported(){
    return !!(global.MediaRecorder&&HTMLCanvasElement.prototype.captureStream);
  }
  function mimeType(){
    const types=[
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1.42001f,mp4a.40.2",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    return types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||"";
  }
  function wantsMp4(){
    return /mp4/i.test(mimeType());
  }
  function canvas(){
    if(state.canvas)return state.canvas;
    const c=document.createElement("canvas");c.width=W;c.height=H;c.style.display="none";c.setAttribute("aria-hidden","true");
    document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d");return c;
  }
  function gameActive(){
    try{return ["round","tiebreak","battle","rackrush","wincine","victorycine","replay"].includes(G.state)||state.capturing;}catch(e){return state.capturing;}
  }
  function gameLabel(){
    try{
      if(G.mode==="battle")return "PERCENT BATTLE";
      if(G.mode==="rackrush")return G.rush&&G.rush.variant==="speed100"?"SPEED 100":"RACK RUSH";
      return G.stage==="final"?"FINAL":"THREE POINT";
    }catch(e){return "aiBA HIGHLIGHT";}
  }
  function scoreText(){
    try{
      if(G.mode==="battle")return Math.min(G.score||0,100)+" : "+Math.min(G.battleOppScore||0,100);
      if(G.mode==="rackrush"){
        if(G.rush&&G.rush.variant==="speed100")return (G.rush.total||0)+" / 100";
        return String(G.rush?G.rush.total||0:G.score||0);
      }
      return (G.score||G.finalScore||G.semiScore||0)+" PTS";
    }catch(e){return "";}
  }
  function playerText(){
    try{
      const p=global.AIBAIdentity&&global.AIBAIdentity.publicProfile&&global.AIBAIdentity.publicProfile();
      if(p&&p.has_nickname&&p.display_name)return p.display_name;
    }catch(e){}
    return "aiBA PLAYER";
  }
  function rankText(){
    try{return global.__aibaLastCloudRankText||"";}catch(e){return "";}
  }
  function drawCover(ctx,img,x,y,w,h,mirror){
    const sw=img.videoWidth||img.naturalWidth||img.width,sh=img.videoHeight||img.naturalHeight||img.height;
    if(!sw||!sh)return;
    const s=Math.max(w/sw,h/sh),dw=sw*s,dh=sh*s,dx=(w-dw)*.5,dy=(h-dh)*.5;
    ctx.save();
    if(mirror){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(img,dx,dy,dw,dh);}
    else ctx.drawImage(img,x+dx,y+dy,dw,dh);
    ctx.restore();
  }
  function drawContain(ctx,img,x,y,w,h,mirror){
    const sw=img.videoWidth||img.naturalWidth||img.width,sh=img.videoHeight||img.naturalHeight||img.height;
    if(!sw||!sh)return;
    const s=Math.min(w/sw,h/sh),dw=sw*s,dh=sh*s,dx=(w-dw)*.5,dy=(h-dh)*.5;
    ctx.save();
    if(mirror){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(img,dx,dy,dw,dh);}
    else ctx.drawImage(img,x+dx,y+dy,dw,dh);
    ctx.restore();
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  }
  function timeText(ms){
    try{
      if(typeof formatBattleTime==="function"&&(ms||0)>=60000)return formatBattleTime(ms);
      if(typeof formatRackRushClock==="function")return formatRackRushClock((ms||0)/1000);
    }catch(e){}
    return ((ms||0)/1000).toFixed(1)+"s";
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function metricScore(record){
    if(global.AIBAResultMetricsFor){
      const m=global.AIBAResultMetricsFor(record);
      if(m&&Number.isFinite(m.score))return m.score;
    }
    const attempts=Number(record&&record.attempts)||0,makes=Number(record&&record.makes)||0;
    const accuracy=attempts?clamp(makes/attempts*100,0,100):0;
    const streak=clamp((Number(record&&record.bestStreak)||Number(record&&record.best_streak)||0)*14,0,100);
    const elapsed=Number(record&&record.elapsedMs)||Number(record&&record.elapsed_ms)||0;
    const total=Number(record&&record.total)||Number(record&&record.score)||0;
    const pace=elapsed&&attempts?clamp(attempts/(elapsed/60000)*6,24,100):60;
    const diff=record&&record.difficulty==="hard"?92:(record&&record.difficulty==="normal"?76:58);
    let clutch=clamp(total,30,100);
    if(record&&record.mode==="percent-battle")clutch=record.won?88:58;
    if(record&&(record.variant==="speed100"||record.mode==="rack-rush-speed100"))clutch=clamp(112-((elapsed/1000)-85)*.36,38,100);
    return clamp(Math.round(accuracy*.34+streak*.17+pace*.16+clutch*.23+diff*.1),0,100);
  }
  function tierForScore(score){
    if(score>=92)return {accent:"#ffd700",dim:"#9f8300",soft:"rgba(255,215,0,.22)",text:"#fff0a8",stamp:"LEGENDARY / 传奇"};
    if(score>=84)return {accent:"#d9e1e7",dim:"#7e8b92",soft:"rgba(217,225,231,.18)",text:"#f2f6f8",stamp:"SILVER / 精英"};
    if(score>=74)return {accent:"#c78945",dim:"#7b4e24",soft:"rgba(199,137,69,.2)",text:"#ffd9aa",stamp:"BRONZE / 稳定"};
    if(score>=64)return {accent:"#b96f38",dim:"#61351a",soft:"rgba(185,111,56,.18)",text:"#ffc49a",stamp:"COPPER / 热手"};
    if(score>=52)return {accent:"#7fd6e8",dim:"#336575",soft:"rgba(127,214,232,.16)",text:"#d6f7ff",stamp:"STEEL / 新兵"};
    if(score>=38)return {accent:"#8e969d",dim:"#41474c",soft:"rgba(142,150,157,.17)",text:"#d9dddf",stamp:"SLATE / 加练"};
    return {accent:"#666b70",dim:"#2d3034",soft:"rgba(120,126,132,.13)",text:"#c7cacc",stamp:"灰色地带"};
  }
  function cardFromRecord(record,opts){
    opts=opts||{};record=record||{};
    const battle=record.mode==="percent-battle",speed=record.variant==="speed100"||record.mode==="rack-rush-speed100";
    const dna=metricScore(record),tier=tierForScore(dna);
    const title=opts.title||(battle?(record.won?"PERCENT BATTLE WON":"PERCENT BATTLE"):(speed?"SPEED 100 COMPLETE":"RACK RUSH COMPLETE"));
    const score=opts.score||(battle?((record.score||0)+" : "+(record.opponentScore||0)):(speed?timeText(record.elapsedMs||record.elapsed_ms):((record.total==null?record.score:record.total)||0)+" PTS"));
    const makes=record.makes!=null&&record.attempts!=null?record.makes+"/"+record.attempts:"";
    const sub=opts.sub||(battle?("TIME "+timeText(record.elapsedMs||record.elapsed_ms)):(makes?("MAKES "+makes):"FINAL SCORE"));
    const statA=battle?"OPPONENT "+(record.opponentName||"CPU"):(speed?"TARGET 100":"TOTAL SCORE");
    const statB=battle?("STREAK x"+(record.bestStreak||record.best_streak||0)):(record.bestStreak!=null?"STREAK x"+record.bestStreak:"GLOBAL RUN");
    return {title,score,sub,statA,statB,tier,dna,mode:battle?"PERCENT BATTLE":(speed?"SPEED 100":"RACK RUSH")};
  }
  function fitText(ctx,text,x,y,max,size,min){
    let s=size;ctx.font="900 "+s+"px Orbitron, monospace";
    while(s>min&&ctx.measureText(text).width>max){s-=2;ctx.font="900 "+s+"px Orbitron, monospace";}
    ctx.fillText(text,x,y);
  }
  function drawResultCard(ctx){
    if(!state.resultCard)return;
    const age=performance.now()-state.resultAt;
    if(age>RESULT_HOLD_MS+900){state.resultCard=null;return;}
    const fadeIn=Math.min(1,age/650),fadeOut=age>RESULT_HOLD_MS?Math.max(0,1-(age-RESULT_HOLD_MS)/900):1,alpha=fadeIn*fadeOut;
    const c=state.resultCard,t=c.tier,x=54,y=400,w=W-108,h=390;
    ctx.save();ctx.globalAlpha=alpha;
    ctx.fillStyle="rgba(0,0,0,.46)";ctx.fillRect(0,0,W,H);
    ctx.translate(0,Math.max(0,24*(1-fadeIn)));
    const grd=ctx.createLinearGradient(x,y,x+w,y+h);grd.addColorStop(0,t.soft);grd.addColorStop(.42,"rgba(18,20,20,.96)");grd.addColorStop(1,"rgba(11,12,12,.98)");
    ctx.fillStyle=grd;ctx.fillRect(x,y,w,h);
    ctx.strokeStyle="rgba(0,0,0,.95)";ctx.lineWidth=8;ctx.strokeRect(x,y,w,h);
    ctx.strokeStyle=t.accent;ctx.lineWidth=2;ctx.strokeRect(x+10,y+10,w-20,h-20);
    [[x+22,y+22,28,0,0,28],[x+w-50,y+22,28,0,28,28],[x+22,y+h-50,28,28,0,28],[x+w-50,y+h-50,28,28,28,28]].forEach(a=>{ctx.beginPath();ctx.moveTo(a[0],a[1]+a[5]);ctx.lineTo(a[0],a[1]);ctx.lineTo(a[0]+a[4],a[1]);ctx.stroke();});
    ctx.fillStyle=t.accent;ctx.font="900 18px Orbitron, monospace";ctx.fillText(c.mode,x+32,y+52);
    ctx.fillStyle="#fff";fitText(ctx,c.title,x+32,y+112,w-64,40,24);
    ctx.save();ctx.translate(x+54,y+145);ctx.rotate(0.16);ctx.strokeStyle=t.accent;ctx.lineWidth=5;ctx.fillStyle="rgba(18,20,20,.58)";ctx.fillRect(0,0,w-108,52);ctx.strokeRect(0,0,w-108,52);ctx.fillStyle=t.accent;fitText(ctx,t.stamp,18,36,w-140,30,18);ctx.restore();
    ctx.fillStyle=t.accent;ctx.font="900 74px Orbitron, monospace";ctx.fillText(c.score,x+32,y+206);
    ctx.shadowColor=t.accent;ctx.shadowBlur=18;ctx.fillText(c.score,x+32,y+206);ctx.shadowBlur=0;
    ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="800 20px Orbitron, monospace";ctx.fillText(c.sub,x+30,y+230);
    ctx.fillStyle="rgba(255,255,255,.08)";roundRect(ctx,x+28,y+258,w-56,72,10);ctx.fill();
    ctx.fillStyle="#dce8f4";ctx.font="800 17px Orbitron, monospace";ctx.fillText(c.statA,x+48,y+287);
    ctx.fillStyle=t.accent;ctx.fillText(c.statB,x+48,y+317);
    const rt=rankText();ctx.fillStyle=rt?t.accent:"#9ab2c5";ctx.font="900 22px Orbitron, monospace";ctx.fillText(rt||"GLOBAL RANK PENDING",x+30,y+360);
    ctx.restore();
  }
  function drawHud(ctx){
    ctx.save();
    const grd=ctx.createLinearGradient(0,0,0,260);grd.addColorStop(0,"rgba(3,6,14,.72)");grd.addColorStop(1,"rgba(3,6,14,0)");
    ctx.fillStyle=grd;ctx.fillRect(0,0,W,300);
    ctx.fillStyle="#7ee7ff";ctx.font="700 22px Orbitron, monospace";ctx.letterSpacing="0px";ctx.fillText("aiBA HIGHLIGHT",34,54);
    ctx.fillStyle="#ffd23f";ctx.font="900 58px Orbitron, monospace";ctx.fillText(scoreText(),34,118);
    ctx.fillStyle="rgba(255,255,255,.88)";ctx.font="700 20px Orbitron, monospace";ctx.fillText(gameLabel(),34,154);
    ctx.fillStyle="rgba(255,255,255,.65)";ctx.font="700 16px Orbitron, monospace";ctx.fillText(state.lastLabel||"LAST SHOT",34,184);
    ctx.fillStyle="rgba(255,255,255,.82)";ctx.font="700 15px Orbitron, monospace";ctx.fillText(playerText(),34,210);
    const rt=rankText();if(rt){ctx.fillStyle="#7CFC6B";ctx.font="900 17px Orbitron, monospace";ctx.fillText(rt,34,236);}
    ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillRect(0,H-136,W,136);
    ctx.fillStyle="#fff";ctx.font="900 36px Orbitron, monospace";ctx.fillText("PULL UP. LOCK IN. SHARE IT.",34,H-78);
    ctx.fillStyle="#9ab2c5";ctx.font="700 16px Orbitron, monospace";ctx.fillText("opstiger.github.io/aiba-percent-battle",34,H-44);
    ctx.restore();
  }
  function drawVisionPip(ctx){
    const v=document.getElementById("visionVideo");
    if(!v||v.readyState<2||!v.videoWidth)return;
    const frame=global.AIBAVisionFrame&&global.AIBAVisionFrame.descriptor?global.AIBAVisionFrame.descriptor():null;
    const vw=(frame&&frame.width)||v.videoWidth,vh=(frame&&frame.height)||v.videoHeight,portrait=frame?!!frame.portrait:vh>vw;
    const displayAspect=(frame&&frame.displayAspect)||(vw/vh);
    let w=portrait?(MOBILE?142:170):196,h=Math.round(w/displayAspect),maxH=portrait?(MOBILE?254:304):160;
    if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
    const resultVisible=!!state.resultCard,x=resultVisible?W-w-30:30,y=resultVisible?68:H-154-h;
    ctx.save();ctx.fillStyle="rgba(0,0,0,.62)";roundRect(ctx,x-7,y-28,w+14,h+35,8);ctx.fill();
    ctx.strokeStyle="#70e8ff";ctx.lineWidth=3;roundRect(ctx,x-7,y-28,w+14,h+35,8);ctx.stroke();
    /* 玩家把预览折叠起来时,录像里也不放真人画面 —— 收起来往往就是不想出镜,
       录出去还带脸是隐私意外。但**保留骨架层**:骨架本身就说明"这动作是真人做的",
       那是 aiBA 区别于普通手游的地方,不该一起丢掉。(设计里的方案 C) */
    const folded=!!(global.AIBAVisionFold&&global.AIBAVisionFold.isActive&&global.AIBAVisionFold.isActive());
    ctx.fillStyle="#70e8ff";ctx.font="700 13px Orbitron, monospace";
    ctx.fillText(folded?"LOCAL POSE · 骨架":"LOCAL POSE",x,y-9);
    ctx.beginPath();roundRect(ctx,x,y,w,h,6);ctx.clip();ctx.fillStyle="#050912";ctx.fillRect(x,y,w,h);
    if(!folded)drawContain(ctx,v,x,y,w,h,true);
    const overlay=document.getElementById("visionCanvas");
    if(overlay&&overlay.width){ctx.globalAlpha=folded?1:.78;drawContain(ctx,overlay,x,y,w,h,true);ctx.globalAlpha=1;}
    ctx.restore();
  }
  function draw(ctxObj){
    const c=canvas(),ctx=state.ctx,source=(ctxObj&&ctxObj.canvas)||document.getElementById("c");
    if(!source)return;
    ctx.fillStyle="#05060c";ctx.fillRect(0,0,W,H);
    ctx.save();drawCover(ctx,source,0,0,W,H);ctx.restore();
    ctx.fillStyle="rgba(3,6,12,.2)";ctx.fillRect(0,0,W,H);
    for(let y=0;y<H;y+=6){ctx.fillStyle="rgba(255,255,255,.025)";ctx.fillRect(0,y,W,1);}
    drawHud(ctx);drawVisionPip(ctx);drawResultCard(ctx);
    return c;
  }
  function updateStatus(txt){
    const el=document.getElementById("clipStatus");if(el)el.textContent=txt||statusText();
    const btn=document.getElementById("clipSaveBtn");if(btn)btn.disabled=!supported();
  }
  function statusText(){
    if(!supported())return "当前浏览器不支持录制";
    if(state.capturing)return state.armed?"最后回合预录中...":"精彩视频生成中...";
    if(state.lastBlob)return /mp4/i.test(state.lastBlob.type)?"精彩MP4已就绪":"精彩视频已就绪(WebM)";
    return "命中关键球后自动生成";
  }
  function audioTracks(){
    try{
      const s=global.AIBAAudioCaptureStream&&global.AIBAAudioCaptureStream();
      return s?[...s.getAudioTracks()].filter(t=>t.readyState==="live"):[];
    }catch(e){return [];}
  }
  function freshStream(){
    const c=canvas(),stream=c.captureStream(FPS);
    state.canvasTrack=stream.getVideoTracks()[0]||null;
    state.audioTracks=audioTracks();
    state.audioTracks.forEach(t=>{try{stream.addTrack(t);}catch(e){}});
    return stream;
  }
  function onData(e){
    if(!e.data||!e.data.size)return;
    state.chunks.push(e.data);
  }
  function tick(ctxObj){
    if(!supported()||!state.capturing)return;
    const now=performance.now();
    if(now-state.lastDraw<1000/FPS)return;
    state.lastDraw=now;draw(ctxObj);
  }
  function startRecording(label,opts){
    opts=opts||{};state.lastLabel=label||state.lastLabel||"精彩时刻";state.lastBlob=null;clearTimeout(state.stopTimer);state.stopAt=0;
    draw({canvas:document.getElementById("c")});
    state.chunks=[];state.stream=freshStream();
    const mt=mimeType(),optsRec={videoBitsPerSecond:VIDEO_BPS,audioBitsPerSecond:MOBILE?128000:192000};if(mt)optsRec.mimeType=mt;
    state.rec=new MediaRecorder(state.stream,optsRec);
    state.rec.ondataavailable=onData;
    state.rec.onstop=finalizeClip;
    state.rec.onerror=()=>{state.capturing=false;state.armed=false;updateStatus("精彩视频生成失败");};
    state.rec.start(250);
    state.capturing=true;state.armed=!!opts.armed;state.startedAt=performance.now();
    const fmt=/mp4/i.test(mt)?"MP4":"WebM";
    updateStatus(state.audioTracks.length?`精彩${fmt}${state.armed?"预录中":"生成中"}...含现场音频`:`精彩${fmt}${state.armed?"预录中":"生成中"}...音频未接入`);
  }
  function arm(label){
    if(!supported())return false;
    if(state.capturing)return true;
    try{startRecording(label||"最后回合预录",{armed:true});return true;}catch(e){state.capturing=false;state.armed=false;updateStatus("精彩视频预录失败");return false;}
  }
  function scheduleStop(ms,minHold,capToTarget){
    if(!state.capturing)return false;
    const now=performance.now(),age=Math.max(0,now-state.startedAt),minimum=Math.max(0,minHold||0);
    let delay=Math.max(1200,ms||POST_MS);
    if(capToTarget)delay=Math.min(delay,Math.max(minimum,MAX_CLIP_MS-age));
    if(minimum)delay=Math.max(minimum,delay);
    clearTimeout(state.stopTimer);state.stopAt=now+delay;state.stopTimer=setTimeout(stopRecording,delay);
    return true;
  }
  function mark(label,opts){
    if(!supported())return false;
    opts=opts||{};state.lastLabel=label||"精彩时刻";state.lastBlob=null;
    if(state.capturing){state.armed=false;scheduleStop(opts.postMs||POST_MS,0);updateStatus("最后三球已捕捉,继续录制庆祝...");return true;}
    try{
      startRecording(state.lastLabel,{armed:false});
      scheduleStop(opts.postMs||POST_MS,0);
      return true;
    }catch(e){state.capturing=false;state.armed=false;updateStatus("精彩视频生成失败");return false;}
  }
  function extend(ms){
    if(!state.capturing)return false;
    scheduleStop(ms||POST_MS,0);
    updateStatus("正在录制庆祝和成绩卡...");
    return true;
  }
  function result(record,opts){
    state.resultCard=cardFromRecord(record,opts);
    state.resultAt=performance.now();
    if(!state.capturing)return false;
    scheduleStop(Math.min((opts&&opts.postMs)||RESULT_HOLD_MS+1000,RESULT_HOLD_MS+1000),MIN_RESULT_MS,true);
    updateStatus("正在录制庆祝、成绩卡和全球排名...");
    return true;
  }
  function rankUpdated(){
    if(!state.capturing||!state.resultCard)return false;
    const now=performance.now(),remaining=Math.max(0,state.stopAt-now);
    if(remaining<RANK_HOLD_MS)scheduleStop(RANK_HOLD_MS,RANK_HOLD_MS);
    return true;
  }
  function stopRecording(){
    try{if(state.rec&&state.rec.state==="recording")state.rec.requestData();}catch(e){}
    try{if(state.rec&&state.rec.state!=="inactive")state.rec.stop();}catch(e){finalizeClip();}
  }
  function cancel(){
    clearTimeout(state.stopTimer);state.stopTimer=0;state.stopAt=0;state.capturing=false;state.armed=false;state.saveWhenReady=false;
    const rec=state.rec;state.rec=null;
    if(rec){rec.ondataavailable=null;rec.onstop=null;rec.onerror=null;try{if(rec.state!=="inactive")rec.stop();}catch(e){}}
    try{if(state.canvasTrack)state.canvasTrack.stop();}catch(e){}
    state.stream=null;state.canvasTrack=null;state.audioTracks=[];state.chunks=[];state.resultCard=null;state.resultAt=0;
    updateStatus("精彩录制已取消");
    return true;
  }
  function discard(){
    cancel();
    if(state.lastUrl){try{URL.revokeObjectURL(state.lastUrl);}catch(e){}}
    state.lastBlob=null;state.lastUrl="";state.lastLabel="精彩时刻";
    updateStatus(statusText());
    return true;
  }
  function finalizeClip(){
    if(!state.capturing&&!state.rec)return;
    state.capturing=false;state.armed=false;
    const parts=state.chunks.filter(Boolean);
    if(!parts.length){updateStatus("暂无可保存片段");return;}
    const recType=(state.rec&&state.rec.mimeType)||(parts[0]&&parts[0].type)||mimeType()||"video/webm";
    state.lastBlob=new Blob(parts,{type:recType});
    if(state.lastUrl)URL.revokeObjectURL(state.lastUrl);
    state.lastUrl=URL.createObjectURL(state.lastBlob);
    try{if(state.canvasTrack)state.canvasTrack.stop();}catch(e){}
    state.stream=null;state.rec=null;state.canvasTrack=null;state.audioTracks=[];state.chunks=[];state.stopAt=0;
    updateStatus(statusText());
    try{if(typeof toast==="function")toast(/mp4/i.test(state.lastBlob.type)?"精彩MP4已生成":"精彩视频已生成(WebM)","#7CFC6B");}catch(e){}
    if(state.saveWhenReady){state.saveWhenReady=false;save();}
  }
  function filename(){
    let seed="highlight";try{seed=GAME_SEED||seed;}catch(e){}
    const ext=state.lastBlob&&/mp4/i.test(state.lastBlob.type)?"mp4":"webm";
    return "aiba-"+seed+"-"+Date.now()+"."+ext;
  }
  function save(){
    if(!supported()){try{toast("当前浏览器不支持录制","#ff8d7a");}catch(e){}return false;}
    if(!state.lastBlob){state.saveWhenReady=true;updateStatus("生成完成后自动保存");try{toast("精彩视频还在生成,稍等一下","#ffd23f");}catch(e){}return false;}
    if(typeof global.playSFX==="function")global.playSFX("ui_save_video_01");
    const a=document.createElement("a");a.href=state.lastUrl||URL.createObjectURL(state.lastBlob);a.download=filename();
    document.body.appendChild(a);a.click();a.remove();
    try{toast("精彩视频已保存","#7CFC6B");}catch(e){}
    return true;
  }
  function resultMarkup(){
    if(!supported())return "";
    return `<div class="clipExport"><button id="clipSaveBtn" class="btn sm" onclick="AIBARecorder.save()">🎞 保存MP4视频</button><small id="clipStatus">${wantsMp4()?statusText():"当前浏览器不支持MP4录制,将降级WebM"}</small></div>`;
  }
  global.AIBARecorder=Object.freeze({tick,arm,mark,result,rankUpdated,save,cancel,discard,resultMarkup,statusText,supported,capturing:()=>state.capturing,debug:()=>({capturing:state.capturing,armed:state.armed,hasClip:!!state.lastBlob,chunkCount:state.chunks.length,startedAt:state.startedAt,stopAt:state.stopAt})});
})(window);
