/* 测试用静音器。除非这次测的就是音效本身，任何在浏览器里跑的测试都先跑它。
   用法：在控制台或注入脚本的最开头 —— 必须在 beginLastShot / ensureAudio /
   任何会出声的调用之前 —— 执行本文件全文。

   为什么不用游戏自己的 toggleMute()：那是个「切换」，
   在已静音状态下调它反而会把声音打开。

   做法是「照常走完所有播放路径，只是听不见」，所以不影响被测逻辑：
   元素照样 play()、AudioContext 照样 running、解码照样进行。 */
(() => {
  const done = [];

  // ① 主增益归零。这一条最关键：AudioContext 被代码 resume() 之后它依然有效。
  try { if (window.mainGain) { mainGain.gain.value = 0; done.push("mainGain=0"); } } catch (e) {}

  // ② 现存的 <audio> 全部静音，并让之后新建的一出生就是静音的。
  try {
    document.querySelectorAll("audio,video").forEach(el => { el.muted = true; el.volume = 0; });
    if (!window.__silencePatched) {
      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
      Object.defineProperty(HTMLMediaElement.prototype, "volume", {
        configurable: true, enumerable: desc && desc.enumerable,
        get() { return 0; }, set() { /* 忽略：测试期间不许调音量 */ }
      });
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { this.muted = true; return origPlay.apply(this, arguments); };
      window.__silencePatched = true;
    }
    done.push("media muted");
  } catch (e) {}

  // ③ 语音合成（解说/播报）单独一条路，不走 WebAudio。
  try {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      if (!window.__speechPatched) { speechSynthesis.speak = () => {}; window.__speechPatched = true; }
      done.push("speech off");
    }
  } catch (e) {}

  /* ④ 周期性重置主增益。ensureAudio() / toggleMute() 之后音量会被恢复，
     只静音一次挡不住 —— 这条 250ms 的看门狗才是真正保险的那一层。
     测完调 window.__unsilence() 可以停掉。 */
  try {
    if (!window.__silenceTimer) {
      window.__silenceTimer = setInterval(() => {
        try { if (window.mainGain) mainGain.gain.value = 0; } catch (e) {}
      }, 250);
      window.__unsilence = () => {
        clearInterval(window.__silenceTimer); window.__silenceTimer = 0;
        if (window.__origAudioConnect) { AudioNode.prototype.connect = window.__origAudioConnect; window.__connectPatched = false; }
      };
      done.push("看门狗 250ms");
    }
  } catch (e) {}

  /* ⑤ WebAudio 那条路。游戏的总线（master / sfxBus / arenaBus）是模块内私有的，
     外部够不到，所以从 AudioNode.connect 下手：不真的连线，声音就到不了输出。
     connect() 按规范返回目标节点以支持链式调用，这里照样返回，不改控制流 ——
     解码、创建 BufferSource、start() 全都照跑，只是听不见。

     ⚠ 必须在 ensureAudio() 之前跑：已经连好的图断不掉（拿不到节点引用）。 */
  try {
    if (!window.__connectPatched && window.AudioNode) {
      const origConnect = AudioNode.prototype.connect;
      // 按规范 connect() 返回目标节点以支持链式调用，这里照返回，只是不真的连
      AudioNode.prototype.connect = function (dest) { return dest; };
      window.__origAudioConnect = origConnect;
      window.__connectPatched = true;
      done.push("WebAudio connect 断开");
    }
  } catch (e) {}

  console.log("🔇 已静音：" + done.join(" · "));
  return { silenced: done };
})();
