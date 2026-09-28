/* 00-core — 节拍、缓动、确定性随机、关键帧。
   这些脚本注入到游戏页面里运行，游戏有大量同名全局（clamp/lerp…），
   所以全部挂在 window.TR 命名空间下，不声明任何顶层全局。 */
(function (TR) {
  "use strict";
  const W = 1920, H = 1080, RW = 960, RH = 540;           // 输出分辨率 / 3D 像素分辨率（×2）
  const FPS = 30, BPM = 150, FPB = FPS * 60 / BPM;          // 12 帧/拍
  const TOTAL_BEATS = 128, TOTAL_FRAMES = TOTAL_BEATS * FPB; // 1536 帧 = 51.2s

  const PAL = {
    gold: "#ffd23f", cyan: "#77e7ff", green: "#7CFC6B", red: "#ff4040", salmon: "#ff8d7a",
    ink: "#04050a", panel: "rgba(10,14,24,.88)", edge: "#283750", white: "#eef7ff", dim: "#8ea3b8",
  };

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const TAU = Math.PI * 2;

  const E = {
    lin: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outQuint: t => 1 - Math.pow(1 - t, 5),
    inOutQuint: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
    outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
    outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  };

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (n) => rng(n)();

  /* 关键帧：[[beat, value, ease?], ...]，value 可为数字/数组/对象 */
  function mixVal(a, b, t) {
    if (typeof a === "number") return lerp(a, b, t);
    if (a === null || b === null || typeof a !== typeof b || typeof a === "string") return t < .5 ? a : b;
    if (Array.isArray(a)) return a.map((v, i) => mixVal(v, b[i], t));
    const o = {};
    for (const k in a) o[k] = k in b ? mixVal(a[k], b[k], t) : a[k];
    for (const k in b) if (!(k in a)) o[k] = b[k];
    return o;
  }
  function track(keys, b) {
    if (b <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (b <= keys[i][0]) {
        const [b0, v0] = keys[i - 1], [b1, v1, ease] = keys[i];
        return mixVal(v0, v1, (ease || E.inOutCubic)(inv(b0, b1, b)));
      }
    }
    return keys[keys.length - 1][1];
  }
  function shakeAt(fr, amp, dur = 8, seed = 1) {
    if (fr < 0 || fr > dur) return [0, 0];
    const k = Math.pow(1 - fr / dur, 2);
    return [Math.sin(fr * 2.7 + seed) * amp * k, Math.cos(fr * 3.3 + seed * 1.7) * amp * k];
  }

  Object.assign(TR, { W, H, RW, RH, FPS, BPM, FPB, TOTAL_BEATS, TOTAL_FRAMES, PAL, clamp, lerp, inv, TAU, E, rng, hash, mixVal, track, shakeAt,
    beatOf: f => f / FPB, frameOf: b => Math.round(b * FPB) });
})(window.TR = window.TR || {});
