/* 04-props — 道具与场景件：贴图、篮筐、投篮机、观众、Logo 笔画、记分牌、墨刷转场。 */
"use strict";

/* ---------- 贴图 ---------- */
function plate(name, cx, cy, sc = 1, mode = null, alpha = 1) {
  const im = PL[name];
  if (!im) return;
  flush();
  push();
  if (mode) blendMode(mode);
  if (alpha < 1) tint(255, 255 * alpha);
  imageMode(CENTER);
  image(im, cx, cy, im.width * sc, im.height * sc);
  pop();
}
/* 水彩爆炸：白底贴图乘法叠加，p=0..1 扩张 */
function burst(name, cx, cy, size, p, rot = 0, onDark = false) {
  const im = PL[onDark ? name + "_a" : name];
  if (!im || p <= 0) return;
  flush();
  push();
  if (!onDark) blendMode(MULTIPLY);
  translate(cx, cy); rotate(rot);
  imageMode(CENTER);
  const k = E.outExpo(clmp(p)) * size / 1000;
  image(im, 0, 0, 1000 * k, 1000 * k);
  pop();
}
function flame(cx, cy, h, f, seed = 0) {
  const i = (Math.floor(f / 2) + seed) % 3, im = PL["flame" + i + "_a"];
  if (!im) return;
  flush();
  push(); imageMode(CENTER);
  const wob = 1 + Math.sin(f * .9 + seed) * .06;
  image(im, cx, cy - h * .42, h * .75 * wob, h * (2 - wob));
  pop();
}

/* ---------- 篮筐（拆前后两半，球能从中间穿过） ---------- */
function hoopBack(cx, cy, s, opt = {}) {
  const w = 3 * s;
  if (opt.board !== false) {
    shape([[cx - 190 * s, cy - 250 * s], [cx + 190 * s, cy - 250 * s], [cx + 190 * s, cy + 20 * s], [cx - 190 * s, cy + 20 * s]], { fill: PAL.white, fillA: 230, w });
    shape([[cx - 70 * s, cy - 130 * s], [cx + 70 * s, cy - 130 * s], [cx + 70 * s, cy - 10 * s], [cx - 70 * s, cy - 10 * s]], { fill: null, ink: PAL.red, w: w * 1.2, brush: "marker" });
    shape([[cx - 12 * s, cy - 10 * s], [cx + 12 * s, cy - 10 * s], [cx + 12 * s, cy + 20 * s], [cx - 12 * s, cy + 20 * s]], { fill: PAL.steel, w: w * .6 });
  }
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = Math.PI + Math.PI * i / 12; pts.push([cx + Math.cos(t) * 110 * s, cy + 22 * s + Math.sin(t) * 26 * s]); }
  poly(pts, w * 1.6, "#c8321f", "marker", .5);
}
/* stretch: 网被球撑下去的程度 0..1；sway: 左右甩 */
function hoopFront(cx, cy, s, stretch = 0, sway = 0, f = 0) {
  const w = 3 * s, top = cy + 22 * s;
  const N = 9, len = (150 + stretch * 90) * s;
  const col = PAL.white;
  const at = (i, k) => {
    const u = i / (N - 1) * 2 - 1;
    const pinch = lrp(1, .55 - stretch * .15, k);
    const wob = Math.sin(f * .8 + i + k * 3) * sway * 18 * s * k;
    return [cx + u * 110 * s * pinch + wob + sway * 30 * s * k * k, top + Math.sin((u + 1) / 2 * Math.PI) * 24 * s * (1 - k) + len * k];
  };
  // 网线（斜交叉）
  for (let i = 0; i < N; i++) {
    const a = [], b = [];
    for (let k = 0; k <= 4; k++) { a.push(at(clmp(i + k * .5, 0, N - 1), k / 4)); b.push(at(clmp(i - k * .5, 0, N - 1), k / 4)); }
    poly(a, w * .5, col, "pen", .5); poly(b, w * .5, col, "pen", .5);
    poly(a, w * .25, PAL.ink, "pen", .5);
  }
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = Math.PI * i / 12; pts.push([cx + Math.cos(t) * 110 * s, top + Math.sin(t) * 26 * s]); }
  poly(pts, w * 2.2, "#e0421f", "marker", .5);
  poly(pts, w * .6, PAL.ink, "pen", .5);
}

/* ---------- 投篮机 ---------- */
function rackMachine(x, y, s, f) {
  const w = 3 * s;
  shape([[x - 150 * s, y], [x + 120 * s, y], [x + 120 * s, y - 380 * s], [x - 150 * s, y - 380 * s]], { fill: "#2c3561", w });
  shape([[x - 130 * s, y - 360 * s], [x + 100 * s, y - 360 * s], [x + 100 * s, y - 250 * s], [x - 130 * s, y - 250 * s]], { fill: "#0f1430", w: w * .8 });
  // 滑道
  shape([[x + 100 * s, y - 240 * s], [x + 330 * s, y - 150 * s], [x + 330 * s, y - 120 * s], [x + 100 * s, y - 200 * s]], { fill: PAL.steel, w });
  // 待发球
  for (let i = 0; i < 4; i++) drawBall(x - 90 * s + i * 58 * s, y - 210 * s, 26 * s, i + f * .1, w * .5);
  return [x + 330 * s, y - 170 * s];   // 出球口
}

/* ---------- 观众剪影（前景） ---------- */
function crowdFG(y, f, col = "#120c1e", seed = 3, energy = 1) {
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const x = -60 + i * 132 + r() * 40, ph = r() * TAU_, hop = Math.max(0, Math.sin(f * .45 + ph)) * 60 * energy;
    const by = y - hop, hr = 42 + r() * 16;
    const armUp = energy > .3 && r() < .8;
    if (armUp) {
      const sw = Math.sin(f * .5 + ph) * 18;
      shape(capsule(x - 30, by - 40, 16, x - 70 + sw, by - 200 - hop * .3, 13), { fill: col, ink: null });
      shape(capsule(x + 30, by - 40, 16, x + 60 - sw, by - 190 - hop * .3, 13), { fill: col, ink: null });
    }
    shape(blobPts(x, by - 60, hr, hr * 1.1, 10, .06, 5 + i), { fill: col, ink: null, curv: .6 });
    shape([[x - 90, by + 220], [x - 70, by - 10], [x + 70, by - 10], [x + 90, by + 220]], { fill: col, ink: null, curv: .3 });
  }
}

/* ---------- 彩纸 ---------- */
function confetti(cx, cy, n, t, seed, spread = 900) {
  const r = rng(seed), cols = [PAL.orange, PAL.magenta, PAL.yellow, PAL.cyan, PAL.red];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU_, v = 300 + r() * spread, g = 900;
    const x = cx + Math.cos(a) * v * t + Math.sin(t * 6 + i) * 20, y = cy + Math.sin(a) * v * t * .8 + g * t * t;
    const sz = 8 + r() * 12, rot = t * (4 + r() * 8) + i;
    const c = Math.cos(rot), s = Math.sin(rot) * .5 + .5;
    shape([[x - sz * c, y - sz * .4], [x + sz * c, y - sz * .4 * s], [x + sz * c, y + sz * .4], [x - sz * c, y + sz * .4 * s]], { fill: cols[i % 5], ink: null });
  }
}

/* ---------- Logo：aiBA 笔画字（管状笔画 + 墨边 + 套色阴影） ---------- */
const GLYPHS = {
  a: { adv: .78, strokes: [
    (() => { const p = []; for (let i = 0; i <= 12; i++) { const t = -.25 * Math.PI - TAU_ * .92 * i / 12; p.push([.32 + Math.cos(t) * .27, -.3 + Math.sin(t) * .3]); } return p; })(),
    [[.6, -.62], [.6, -.2], [.64, 0]]] },
  i: { adv: .36, strokes: [[[.12, -.6], [.1, -.25], [.12, 0]]], dot: [.12, -.86] },
  B: { adv: .86, strokes: [[[0, -1], [0, -.5], [0, 0]], [[0, -1], [.36, -1.02], [.56, -.86], [.48, -.6], [.1, -.54]], [[.1, -.54], [.52, -.54], [.7, -.3], [.56, -.04], [0, 0]]] },
  A: { adv: .86, strokes: [[[-.02, 0], [.2, -.55], [.37, -1.02]], [[.37, -1.02], [.55, -.5], [.78, 0]], [[.12, -.36], [.64, -.38]]] },
};
/* 画 "aiBA"。p: 0..1 书写进度（按笔画顺序）；返回整体宽度 */
function drawLogo(cx, cy, size, p = 1, opt = {}) {
  const text = "aiBA", slant = .16;
  let total = 0;
  for (const ch of text) total += GLYPHS[ch].adv;
  const all = [];
  let x0 = -total / 2;
  for (const ch of text) {
    const g = GLYPHS[ch];
    for (const st of g.strokes) all.push({ pts: st.map(([x, y]) => [cx + (x0 + x - y * slant) * size, cy + (y + .5) * size]), dot: false });
    if (g.dot) all.push({ pts: [[cx + (x0 + g.dot[0] - g.dot[1] * slant) * size, cy + (g.dot[1] + .5) * size]], dot: true });
    x0 += g.adv;
  }
  const r = size * (opt.thick || .085), n = all.length;
  const layers = [[opt.shadow || PAL.cyan, size * .05, null], [opt.fill || PAL.white, 0, PAL.ink]];
  for (const [col, off, ink] of layers) {
    all.forEach((st, i) => {
      const k = clmp(p * n - i);
      if (k <= 0) return;
      if (st.dot) {
        const [x, y] = st.pts[0];
        shape(blobPts(x + off, y + off, r * 1.25 * E.outBack(k), r * 1.25 * E.outBack(k), 10, .08, 3), { fill: col, ink, w: 3.2 * size / 300, curv: .6 });
        return;
      }
      const pts = resample(st.pts, k);
      const R = pts.map((_, j) => r * (0.85 + .3 * Math.sin(j / (pts.length - 1) * Math.PI)));
      shape(tubePts(pts.map(q => [q[0] + off, q[1] + off]), R), { fill: col, ink, w: 3.6 * size / 300, curv: .5 });
    });
  }
}
/* 按弧长截取折线前 k 比例，并加密 */
function resample(pts, k, n = 12) {
  const seg = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
  const out = [], target = L * k;
  for (let j = 0; j <= n; j++) {
    let d = target * j / n, i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? clmp(d / seg[i]) : 0;
    out.push([lrp(pts[i][0], pts[i + 1][0], t), lrp(pts[i][1], pts[i + 1][1], t)]);
  }
  return out;
}

/* ---------- 2D 合成层用的件 ---------- */
/* 墨刷横扫转场：p 0..1，前沿带毛边；dir=1 从左到右盖满，p>1 部分从左往右露出 */
function inkWipe(ctx, p, col = PAL.ink, seed = 1) {
  if (p <= 0 || p >= 2) return;
  const r = rng(seed), lead = p <= 1 ? E.inOutCubic(p) : 1, tail = p > 1 ? E.inOutCubic(p - 1) : 0;
  const x1 = lrp(-300, W + 300, lead), x0 = lrp(-300, W + 300, tail);
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  const rows = 18;
  ctx.moveTo(x0, -20);
  for (let i = 0; i <= rows; i++) { const y = -20 + (H + 40) * i / rows; ctx.lineTo(x1 + Math.sin(i * 1.7 + seed) * 60 + (r() - .5) * 50 - (p <= 1 ? 0 : 0), y); }
  for (let i = rows; i >= 0; i--) { const y = -20 + (H + 40) * i / rows; ctx.lineTo(x0 - (p > 1 ? Math.sin(i * 1.3) * 60 + (r() - .5) * 50 : 300), y); }
  ctx.closePath(); ctx.fill();
  // 飞白：前沿拖出的细丝
  ctx.strokeStyle = col; ctx.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const y = r() * H, l = 80 + r() * 260;
    ctx.lineWidth = 2 + r() * 7;
    ctx.beginPath(); ctx.moveTo(x1 - 20, y); ctx.lineTo(x1 + l * (p <= 1 ? 1 : .2), y + (r() - .5) * 20); ctx.stroke();
  }
  ctx.restore();
}
/* 四角星光 */
function starGlint(ctx, x, y, s, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.fillStyle = PAL.yellow; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .22 : s, t = i * Math.PI / 4 - Math.PI / 2; ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, s * .12, 0, TAU_); ctx.fill();
  ctx.restore();
}
/* 记分牌 */
function scoreboard(ctx, x, y, a, b, clock, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(o.scale || 1, o.scale || 1);
  const j = rng(Math.floor(FRAME / 2) * 5);
  ctx.fillStyle = "#0b0a14"; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-330 + j() * 4, -70); ctx.lineTo(330, -72 + j() * 4); ctx.lineTo(334, 78); ctx.lineTo(-334, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
  inkText(ctx, String(a), -210, 6, { size: 110, fill: PAL.orange, shadow: false, strokeW: 0, stroke: false, jit: 2 });
  inkText(ctx, String(b), 210, 6, { size: 110, fill: PAL.cyan, shadow: false, stroke: false, jit: 2 });
  inkText(ctx, clock, 0, 8, { size: 76, fill: o.clockCol || PAL.red, shadow: false, stroke: false, jit: 1, font: "Bangers" });
  if (o.labels !== false) {
    inkText(ctx, "BLOX", -210, -92, { size: 40, fill: PAL.white, shadow: PAL.orange, strokeW: 6 });
    inkText(ctx, "LEGEND 0", 210, -92, { size: 40, fill: PAL.white, shadow: PAL.cyan, strokeW: 6 });
  }
  ctx.restore();
}
/* 百分比能量条 */
function pctBar(ctx, x, y, w, v, col, label, flipDir) {
  const j = rng(Math.floor(FRAME / 2) * 3 + x);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(15,12,20,.85)"; ctx.fillRect(-w / 2, -26, w, 52);
  ctx.fillStyle = col;
  const fw = w * v / 100;
  if (flipDir) ctx.fillRect(w / 2 - fw, -26, fw, 52); else ctx.fillRect(-w / 2, -26, fw, 52);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 7; ctx.strokeRect(-w / 2 + j() * 3, -26, w, 52);
  ctx.restore();
  inkText(ctx, label, x + (flipDir ? w / 2 - 70 : -w / 2 + 70), y - 70, { size: 84, fill: col, strokeW: 10, shadow: PAL.ink });
}
/* 网点阴影 */
let HALF;
function halftone(ctx, a = .25, col = "#1b1d3a") {
  if (!HALF) {
    HALF = document.createElement("canvas"); HALF.width = 24; HALF.height = 24;
    const g = HALF.getContext("2d"); g.fillStyle = "#000"; g.beginPath(); g.arc(12, 12, 5, 0, TAU_); g.fill();
  }
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "multiply";
  const grd = ctx.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = ctx.createPattern(HALF, "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
/* 漫画格边框 */
function panelFrame(ctx, inset = 30, wline = 14) {
  ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = wline;
  const j = rng(Math.floor(FRAME / 2) * 9);
  ctx.beginPath(); ctx.moveTo(inset + j() * 4, inset); ctx.lineTo(W - inset, inset + j() * 4); ctx.lineTo(W - inset - j() * 4, H - inset); ctx.lineTo(inset, H - inset - j() * 4); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(0, 0, W, inset - wline / 2); ctx.fillRect(0, H - inset + wline / 2, W, inset); ctx.fillRect(0, 0, inset - wline / 2, H); ctx.fillRect(W - inset + wline / 2, 0, inset, H);
  ctx.restore();
}
/* 世界坐标 → 屏幕（给 2D 层定位用） */
function toScreen(c, x, y) {
  const dx = (x - c.x) * (c.z || 1), dy = (y - c.y) * (c.z || 1), r = c.r || 0;
  return [W / 2 + dx * Math.cos(r) - dy * Math.sin(r), H / 2 + dx * Math.sin(r) + dy * Math.cos(r)];
}
