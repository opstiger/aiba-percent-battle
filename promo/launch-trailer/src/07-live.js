/* 07-live — 直接跑游戏本体的「绝杀时刻」模式（练习关 THE LAST SHOT）。
   做法：把游戏时钟换成固定步长，每帧手动调一次游戏自己的 animate()；
   球到手后像玩家一样按住蓄力、到理想力度松手（与 src/trailer-capture.js 的 chargeAndRelease 同一逻辑）。
   第一人称视角、5v5 跑位、包夹、传球、防守封盖、蜂鸣、结果反应——全部是游戏原生逻辑。 */
(function (TR) {
  "use strict";
  const L = TR.LIVE = { on: false, dt: 1 / 30, log: [], t: 0, holdStart: -1 };
  let getDelta0 = null;

  TR.liveStart = function (opts = {}) {
    if (L.on) TR.liveEnd();
    L.on = true; L.t = 0; L.log = []; L.holdStart = -1; L.lastPhase = null;
    L.delay = opts.delay ?? .22;       // 接球后多久开始蓄力（秒）
    if (!getDelta0) getDelta0 = clock.getDelta.bind(clock);
    clock.getDelta = () => L.dt;
    if (window.AIBALastShotConfig) AIBALastShotConfig.pickChallenge(opts.challenge || "ls-tribute-finals");
    G.myStar = LEGENDS.find(l => l.id === (opts.me || "curry")) || G.myStar;
    applyStarStyle(player, G.myStar);
    window.beginLastShot(true);
    // 持球核心换成传奇球星（默认科比），其余队友/对手也换上传奇造型
    const sq = AIBALastShotSquad.squad;
    if (sq && opts.cast) for (const id in opts.cast) {
      const a = sq.actors[id], star = LEGENDS.find(l => l.id === opts.cast[id]);
      if (!a || !star) continue;
      const hs = a.guy.g.scale.y;
      applyStarStyle(a.guy, star);
      if (window.AIBABasketballShoes) AIBABasketballShoes.clear(a.guy);
      a.guy.g.scale.set(a.guy.g.scale.x < 0 ? -hs : hs, hs, hs);
    }
    // 跳过开场说明（游戏里玩家也可以点"跳过"）
    const pre = Math.round((opts.skip ?? 1.8) / L.dt);
    for (let i = 0; i < pre; i++) TR.liveStep(true);
  };

  TR.liveStep = function (silent) {
    const LS = AIBALastShotSequence.state();
    L.t += L.dt;
    // 自动出手：接球 → 停顿 → 蓄力 → 理想力度松手
    if (G.canShoot && !LS.released && !G.charging) {
      if (L.holdStart < 0) L.holdStart = L.t;
      if (L.t - L.holdStart >= L.delay) startCharge();
    }
    if (G.charging) {
      const ideal = shotIdeal(curShot());
      if (G.power >= ideal) doRelease();
    }
    try { animate(); } catch (e) { L.log.push("ERR " + e.message); }
    if (LS.phase !== L.lastPhase) { L.log.push(L.t.toFixed(2) + " " + LS.phase); L.lastPhase = LS.phase; }
    return LS;
  };

  TR.liveEnd = function () {
    if (!L.on) return;
    try { exitLastShot(); } catch (e) { }
    if (getDelta0) clock.getDelta = getDelta0;
    G.state = "menu";
    L.on = false;
    for (const o of [player && player.g, hands, handBall, pBall]) if (o) o.visible = false;
  };
})(window.TR = window.TR || {});
