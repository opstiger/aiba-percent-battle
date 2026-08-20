(function(global){
  "use strict";

  const runtime=global.AIBA&&global.AIBA.runtime,ctx=runtime&&runtime.service("legacy");
  if(!runtime||!ctx||!runtime.service("ui:panels"))throw new Error("UI loading requires panels and legacy adapter");
  const {$,clamp,COVER_STARS,EXT_AUDIO,ensureAudio}=ctx;
  let coverVideoTimer=null,bootFailed=0;
  global.BOOT_GATE_ACTIVE=true;global.BOOT_READY=false;global.BOOT_COVER=null;

  function setBootProgress(done,total,finished,count){
    const percent=Math.round(clamp(done/Math.max(1,total),0,1)*100);
    $("bootBar").style.width=percent+"%";$("bootPercent").textContent=percent+"%";$("bootFile").textContent=finished+"/"+count+" 核心资源";
  }
  /* 音频同样用 fetch() 预热(移动端在用户交互前不会预加载 <audio>,等元素就绪会
     一直卡到超时),但拿到的数据不能白扔:直接转成 object URL 喂给音轨,这样
     <audio> 不会再为同一个文件发第二次请求。 */
  async function preloadBootAsset(asset,total,state){
    let ok=true;
    try{
      const controller=typeof AbortController!=="undefined"?new AbortController():null;
      const timer=controller?setTimeout(()=>controller.abort(),12000):null;
      const response=await fetch(asset.url,{cache:"force-cache",signal:controller?controller.signal:undefined});
      if(timer)clearTimeout(timer);if(!response.ok)throw new Error("HTTP "+response.status);
      if(asset.media&&typeof extHydrate==="function"){
        const blob=await response.blob();
        if(!extHydrate(asset.media,URL.createObjectURL(blob)))throw new Error("hydrate failed");
      }else{
        await response.arrayBuffer();
      }
    }catch(error){
      ok=false;bootFailed++;
      // 预热失败时退回普通 URL,音频照常可用,只是少了进度条上的准确度
      if(asset.media&&typeof extEnsureSrc==="function")extEnsureSrc(asset.media);
    }
    state.done+=asset.weight;state.finished++;setBootProgress(state.done,total,state.finished,state.count);return ok;
  }
  async function ensureUIFontReady(){
    if(!document.fonts||!document.fonts.load)return;
    try{await Promise.race([document.fonts.load("700 16px Orbitron"),new Promise(resolve=>setTimeout(resolve,1000))]);}catch(error){}
  }
  /* 启动之后的后台补拉。不计进度、不阻塞任何流程，失败也只是回到
     "真要播时由 extPlay 懒赋 src"的老路，不影响出声。 */
  function prefetchDeferredAudio(list){
    if(!list||!list.length)return;
    const idle=global.requestIdleCallback||(fn=>setTimeout(fn,1500));
    idle(()=>{
      list.forEach(asset=>{
        if(!asset.url)return;
        fetch(asset.url,{cache:"force-cache"})
          .then(r=>r.ok?r.blob():null)
          .then(blob=>{
            if(blob&&typeof extHydrate==="function")extHydrate(asset.media,URL.createObjectURL(blob));
          })
          .catch(()=>{});
      });
    });
  }
  async function bootGame(){
    global.BOOT_COVER=COVER_STARS[(Math.random()*COVER_STARS.length)|0];
    $("bootLoad").addEventListener("pointerdown",unlockBoot,{passive:false});global.showMenu();
    /* 天气/环境音(rain 731KB + ocean + gull ≈ 796KB)不进启动清单：
       它们是场景条件音 —— rain 只在下雨天气播、ocean 只在海滩场景播 ——
       却占了首屏音频的一大块。移出后在启动完成后的空闲时间后台补拉，
       等真的进到下雨场景时已经就绪，不会退化成"第一次没声"。 */
    const assets=[
      {url:global.BOOT_COVER.cover,weight:100000},{url:"assets/fonts/orbitron/Orbitron-VariableFont_wght.ttf",weight:38576},
      {media:"bgm",url:EXT_AUDIO.bgm,weight:807227},{media:"crowd",url:EXT_AUDIO.crowd,weight:1119164},
      {media:"crowdCheer",url:EXT_AUDIO.crowdCheer,weight:300975}
    ];
    const deferred=[
      {media:"rain",url:EXT_AUDIO.rain},{media:"ocean",url:EXT_AUDIO.ocean},{media:"gull",url:EXT_AUDIO.gull}
    ];
    const usable=assets.filter(asset=>asset.url),total=usable.reduce((sum,asset)=>sum+asset.weight,0);
    const state={done:0,finished:0,count:usable.length};$("bootStatus").textContent="正在同步画面与球馆声音";
    await Promise.all([Promise.all(usable.map(asset=>preloadBootAsset(asset,total,state))),new Promise(resolve=>setTimeout(resolve,1100))]);
    await ensureUIFontReady();setBootProgress(total,total,usable.length,usable.length);global.BOOT_READY=true;
    const gate=$("bootLoad");gate.classList.add("ready");gate.setAttribute("aria-busy","false");
    $("bootStatus").textContent=bootFailed?"基础资源就绪":"赛场资源就绪";document.documentElement.dataset.bootReady="1";
    prefetchDeferredAudio(deferred);
  }
  function unlockBoot(event){
    if(!global.BOOT_GATE_ACTIVE)return false;
    if(event&&event.preventDefault)event.preventDefault();if(!global.BOOT_READY)return true;
    global.BOOT_GATE_ACTIVE=false;
    const gate=$("bootLoad");gate.classList.add("leaving");gate.setAttribute("aria-hidden","true");document.documentElement.dataset.bootStarted="1";
    /* 首次进入走"第一屏投一球":音频由 boot-shot 在按下那一刻解锁(不带菜单音乐,
       把留白留给刷网),封面视频等切黑之后再起。分享链接直接进模式时不做这套仪式。 */
    const shared0=ctx.getSharedRackRush();
    const intro=!shared0&&global.AIBABootShot&&global.AIBABootShot.shouldRun&&global.AIBABootShot.shouldRun();
    if(!intro){ensureAudio(true,true);startCoverVideo();}
    setTimeout(()=>{
      gate.style.display="none";
      if(intro){global.AIBABootShot.start();return;}
      const shared=ctx.getSharedRackRush();
      if(shared&&!shared.opened){shared.opened=true;ctx.G.mode="rackrush";ctx.pickDiff(shared.diff);}
    },460);return true;
  }
  function stopCoverVideo(){
    clearTimeout(coverVideoTimer);coverVideoTimer=null;const video=document.querySelector(".coverVideo");
    if(video){try{video.classList.remove("ready");video.closest(".coverHero")?.classList.remove("video-active");video.pause();video.removeAttribute("src");video.load();}catch(error){}}
  }
  function startCoverVideo(){
    const video=document.querySelector(".coverVideo");if(!video||!video.dataset.src)return;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(matchMedia("(prefers-reduced-motion: reduce)").matches||(connection&&(connection.saveData||/^(slow-)?2g$/.test(connection.effectiveType||""))))return;
    let failed=false;
    const fallback=()=>{failed=true;clearTimeout(coverVideoTimer);coverVideoTimer=null;try{video.classList.remove("ready");video.closest(".coverHero")?.classList.remove("video-active");video.pause();video.removeAttribute("src");video.load();}catch(error){}};
    const reveal=()=>{if(failed)return;clearTimeout(coverVideoTimer);coverVideoTimer=null;video.classList.add("ready");video.closest(".coverHero")?.classList.add("video-active");};
    video.addEventListener("playing",reveal,{once:true});video.addEventListener("error",fallback,{once:true});video.src=video.dataset.src;video.load();
    try{const promise=video.play();if(promise&&promise.catch)promise.catch(fallback);}catch(error){fallback();return;}
    coverVideoTimer=setTimeout(()=>{if(video.readyState<2)fallback();},3500);
  }
  function scheduleCoverVideo(){
    if(global.BOOT_GATE_ACTIVE)return;
    coverVideoTimer=setTimeout(()=>{coverVideoTimer=null;if("requestIdleCallback" in global)requestIdleCallback(startCoverVideo,{timeout:1600});else startCoverVideo();},900);
  }

  const api=Object.freeze({setBootProgress,preloadBootAsset,ensureUIFontReady,bootGame,unlockBoot,stopCoverVideo,startCoverVideo,scheduleCoverVideo});
  Object.assign(global,api);runtime.register("ui:loading",api);
})(window);
