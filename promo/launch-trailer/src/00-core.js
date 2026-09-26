/* 00-core — 画布、节拍、缓动、随机数、色板。所有章节共用。 */
"use strict";

const W = 1920, H = 1080;
const FPS = 30, BPM = 150;
const FPB = FPS * 60 / BPM;            // 每拍帧数 = 12
const TOTAL_BEATS = 72;
const TOTAL_FRAMES = TOTAL_BEATS * FPB; // 864 帧 = 28.8s

const PAL = {
  paper: "#f2e8d5", ink: "#17120f", orange: "#ff6a1a", red: "#e8233a",
  cyan: "#19c3d0", magenta: "#ff2e88", yellow: "#ffd23f", night: "#1b1d3a",
  skin: "#f2b184", skinShade: "#d98a5f", white: "#fffaf0", navy: "#232848",
  jersey: "#ff6a1a", jerseyDark: "#c9420c", shorts: "#1f2a5a", shoe: "#f7f3ea",
  steel: "#39405e", court: "#d9a26b",
};

/* ---------- 数学 ---------- */
const clmp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lrp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clmp((x - a) / (b - a));      // 区间归一
const DEG = Math.PI / 180;
const TAU_ = Math.PI * 2;
const lerpAng = lrp;

const E = {
  lin: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inQuint: t => t * t * t * t * t,
  inOutQuint: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU_ / 3)) + 1,
};

/* 衰减震动：t 为触发后经过的帧数 */
function shakeAt(fr, amp, dur = 8, seed = 1) {
  if (fr < 0 || fr > dur) return [0, 0];
  const k = Math.pow(1 - fr / dur, 2);
  return [Math.sin(fr * 2.7 + seed) * amp * k, Math.cos(fr * 3.3 + seed * 1.7) * amp * k];
}

/* ---------- 确定性随机 ---------- */
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

/* ---------- 颜色 ---------- */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = (s) => Math.round(lrp(a >> s & 255, b >> s & 255, t));
  return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}

/* ---------- 关键帧 ----------
   keys: [[beat, value, ease?], ...]；value 可以是数字或同形对象。 */
function track(keys, b) {
  if (b <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (b <= keys[i][0]) {
      const [b0, v0] = keys[i - 1], [b1, v1, ease] = keys[i];
      const t = (ease || E.inOutCubic)(inv(b0, b1, b));
      return mixVal(v0, v1, t);
    }
  }
  return keys[keys.length - 1][1];
}
function mixVal(a, b, t) {
  if (typeof a === "number") return lrp(a, b, t);
  if (a === null || b === null || typeof a !== typeof b || typeof a === "string") return t < .5 ? a : b;
  if (Array.isArray(a)) return a.map((v, i) => mixVal(v, b[i], t));
  const o = {};
  for (const k in a) o[k] = k in b ? mixVal(a[k], b[k], t) : a[k];
  for (const k in b) if (!(k in a)) o[k] = b[k];
  return o;
}

/* 帧 → 拍 */
const beatOf = (f) => f / FPB;
const frameOf = (b) => Math.round(b * FPB);
