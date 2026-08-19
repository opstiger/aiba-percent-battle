/* 发布前冒烟：每个模式打完整一局，不只是冷启动。
   用法：起本地服务器打开 index.html，控制台粘贴本文件全文。
   check.js 是静态分析，抓不到"跑起来才炸"的问题；这个补那一块。

   已知局限（读结果时要清楚）：
   - 全程约 70 秒。过场用 setTimeout，必须让出事件循环才会推进，快不了。
   - 百分大战常跑满 12000 帧上限才退出，且结束态会串到上一模式（模式间没有硬隔离）。
     它那一行的"0 报错"只代表这段时间没抛异常，不代表打完了一整局。
   - 只验"有没有抛异常 + 状态机走没走到头"，不验画面对不对。观感仍需人眼。 */
(async () => {
  const errs = [];
  addEventListener("error", e => errs.push("error: " + e.message));
  addEventListener("unhandledrejection", e => errs.push("promise: " + e.reason));
  const bl = document.getElementById("bootLoad"); if (bl) bl.style.display = "none";
  if (window.mainGain) mainGain.gain.value = 0;          // 冒烟不需要声音

  /* 后台标签会冻结 rAF，所以手动逐帧驱动，dt 固定 1/60 保证可复现 */
  const step = (n, dt = 1 / 60) => {
    const g = THREE.Clock.prototype.getDelta, r = window.requestAnimationFrame;
    THREE.Clock.prototype.getDelta = () => dt;
    window.requestAnimationFrame = () => 0;
    for (let i = 0; i < n; i++) { try { animate(); } catch (e) { errs.push("animate: " + e.message); } }
    window.requestAnimationFrame = r; THREE.Clock.prototype.getDelta = g;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shoot = (power = 74) => {                        // 蓄到目标力度再松手
    G.charging = true; G.power = 0;
    let k = 0; while (G.power < power && k++ < 400) step(1);
    if (typeof doRelease === "function") doRelease();
  };

  const rows = [];
  /* 各模式开局都会先过入场动画/赛前演出，状态名不止一个。
     统一等到"能投了或已结束"，再进入投篮循环，否则循环会在 cinematic 上空转退出。 */
  const PLAYABLE = /^(round|tiebreak|battle|rackrush|lastshot)$/;
  /* 过场/入场用的是 setTimeout。同步空转帧循环从不让出事件循环，定时器就永远不触发，
     模式会一直卡在 cinematic / rushintro。所以分块步进，块之间 await 一下让计时器跑。 */
  const stepAsync = async (frames, chunk = 30) => {
    for (let done = 0; done < frames; done += chunk) { step(Math.min(chunk, frames - done)); await wait(0); }
  };
  const settle = async (limit = 4000) => {
    let k = 0;
    while (!PLAYABLE.test(G.state) && !/end$/.test(G.state) && k < limit) { await stepAsync(30); k += 30; }
    return k;
  };
  const playUntilEnd = async (limit = 12000) => {
    await settle();
    const started = G.state;
    let k = 0;
    while (G.state === started && k < limit) {
      if (G.canShoot && !G.charging) shoot();
      step(1); k++;
      if (k % 30 === 0) await wait(0);          // 同样要让计时器有机会跑
    }
    return { 起始状态: started, 帧数: k };
  };

  const run = async (name, setup, play) => {
    const before = errs.length;
    const t0 = performance.now();
    let info = {};
    try { setup(); step(60); await wait(120); info = (await play()) || {}; }
    catch (e) { errs.push(name + ": " + e.message); }
    rows.push({
      模式: name, 结束状态: G.state, 打了几帧: info.帧数 ?? "-",
      新增报错: errs.length - before, 耗时ms: Math.round(performance.now() - t0)
    });
  };

  await run("绝杀时刻", () => beginLastShot(true), async () => {
    let g = 0; while (!G.canShoot && g++ < 1200) step(1);
    shoot();
    const S = AIBALastShotSequence.state;   // state 是取状态的函数，不是状态本身
    let k = 0;
    while (G.state === "lastshot" && k++ < 6000) {
      const st = S();
      if (st.phase === "freethrow" && st.ftReady && G.canShoot && !G.charging) shoot(70);
      step(1);
    }
    return { 帧数: k };
  });

  await run("三分大赛", () => goDiff("normal"), async () => {
    if (typeof startRound === "function") startRound();
    return playUntilEnd();
  });
  await run("投篮机", () => startRackRush(), async () => playUntilEnd());
  await run("百分大战", () => startBattle(), async () => playUntilEnd());
  await run("练习", () => startPractice(), async () => {
    await settle();
    let n = 0;
    for (let i = 0; i < 5; i++) { let g = 0; while (!G.canShoot && g++ < 500) { step(1); n++; } shoot(); step(180); n += 180; }
    return { 帧数: n };
  });

  console.table(rows);
  console.log(errs.length ? "❌ 共 " + errs.length + " 条报错：" : "✅ 全模式完整一局无报错");
  errs.slice(0, 12).forEach(e => console.log("   " + e));
  return { rows, errs: errs.slice(0, 12), total: errs.length };
})();
