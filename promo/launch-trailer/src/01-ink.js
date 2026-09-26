/* 01-ink — p5.brush 包装：墨线、平涂、墨点飞溅、速度线、冲击环、镜头。 */
"use strict";

let FRAME = 0;           // 当前帧号（main.js 写入）

/* 线条抖动：一拍两张，salt 让不同物体抖法不同 */
function boil(salt = 0, step = 2) {
  randomSeed(Math.floor(FRAME / step) * 7919 + salt * 131 + 17);
}

/* 笔刷缩放：1080p 下 built-in 笔刷需要放大 */
const BRUSH_SCALE = 3.2;

/* 刷一层：p5.brush 换色才落笔，层与层之间强制落笔 */
function flush() { brush.flush(); }

/* ---------- 几何 ---------- */
function capsule(x1, y1, r1, x2, y2, r2, seg = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = a + Math.PI / 2 + Math.PI * i / seg;
    pts.push([x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1]);
  }
  for (let i = 0; i <= seg; i++) {
    const t = a - Math.PI / 2 + Math.PI * i / seg;
    pts.push([x2 + Math.cos(t) * r2, y2 + Math.sin(t) * r2]);
  }
  return pts;
}
/* 连续管（手臂/腿）：p0-p1-p2，半径 r0-r1-r2，关节处不断开 */
function tubePts(P, R, seg = 6) {
  const n = P.length, nrm = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    nrm.push([-dy / l, dx / l]);
  }
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) { L.push([P[i][0] + nrm[i][0] * R[i], P[i][1] + nrm[i][1] * R[i]]); Rr.push([P[i][0] - nrm[i][0] * R[i], P[i][1] - nrm[i][1] * R[i]]); }
  const cap = (c, r, from) => { const o = []; for (let k = 1; k < seg; k++) { const t = from + Math.PI * k / seg; o.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]); } return o; };
  const e = n - 1, aEnd = Math.atan2(nrm[e][1], nrm[e][0]), aSt = Math.atan2(-nrm[0][1], -nrm[0][0]);
  return [...L, ...cap(P[e], R[e], aEnd - Math.PI).reverse().map((p, i, arr) => p), ...Rr.reverse(), ...cap(P[0], R[0], aSt - Math.PI).reverse()];
}
function blobPts(cx, cy, rx, ry, n = 14, wob = .12, seed = 1, rot = 0) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const t = rot + TAU_ * i / n, k = 1 + (r() - .5) * 2 * wob;
    pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
  }
  return pts;
}
/* 超椭圆：方块头 */
function squirclePts(cx, cy, w, h, p = 4, n = 28, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = TAU_ * i / n, c = Math.cos(t), s = Math.sin(t);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * w / 2;
    let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * h / 2;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return pts;
}
const rotP = (p, cx, cy, a) => {
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - cx, y = p[1] - cy;
  return [cx + x * c - y * s, cy + x * s + y * c];
};

/* ---------- 画形状 ----------
   opt: { fill, fillA, ink, w, brush, curv, closed, wc }
   wc = 水彩填充（贵，慎用）；默认平涂 wash。 */
function shape(pts, opt = {}) {
  const o = Object.assign({ ink: PAL.ink, w: 1, brush: "pen", curv: 0, closed: true }, opt);
  if (o.fill) {
    brush.noStroke();
    brush.noHatch();
    if (o.wc) {
      brush.fill(o.fill, o.fillA ?? 160);
      brush.fillBleed(o.wc.bleed ?? .15);
      brush.fillTexture(o.wc.tex ?? .4, o.wc.border ?? .35);
    } else brush.wash(o.fill, o.fillA ?? 255);
    brush.beginShape(o.curv);
    for (const p of pts) brush.vertex(p[0], p[1]);
    brush.endShape(CLOSE);
    brush.noWash(); brush.noFill();
  }
  if (o.ink && o.w > 0) {
    brush.set(o.brush, o.ink, o.w);
    brush.noFill(); brush.noWash();
    brush.beginShape(o.curv);
    for (const p of pts) brush.vertex(p[0], p[1]);
    brush.endShape(o.closed ? CLOSE : undefined);
  }
}
function line2(x1, y1, x2, y2, w = 1, col = PAL.ink, b = "pen") {
  brush.set(b, col, w);
  brush.line(x1, y1, x2, y2);
}
function poly(pts, w = 1, col = PAL.ink, b = "pen", curv = .5) {
  brush.set(b, col, w);
  brush.noFill(); brush.noWash();
  brush.beginShape(curv);
  for (const p of pts) brush.vertex(p[0], p[1]);
  brush.endShape();
}
function inkDot(x, y, r, col = PAL.ink) {
  brush.noStroke();
  brush.wash(col, 255);
  brush.circle(x, y, r);
  brush.noWash();
}

/* ---------- 特效 ---------- */

/* 墨点飞溅：p = 0..1 扩散进度 */
function splat(cx, cy, R, seed, p = 1, col = PAL.ink, drops = 22) {
  const r = rng(seed), e = E.outExpo(p);
  const rb = rng(seed + 9), core = [];
  for (let i = 0; i < 22; i++) { const t = TAU_ * i / 22, k = i % 2 ? .35 + rb() * .2 : .75 + rb() * .5; core.push([cx + Math.cos(t) * R * .26 * k * (.5 + .5 * e), cy + Math.sin(t) * R * .1 * k * (.5 + .5 * e)]); }
  shape(core, { fill: col, ink: null, curv: .4 });
  for (let i = 0; i < drops; i++) {
    const a = (r() - .5) * Math.PI * 1.15 - Math.PI / 2 + (r() < .5 ? 0 : 0),
      a2 = r() < .5 ? a : Math.PI - a - Math.PI;
    const ang = r() < .5 ? a : a2;
    const d = R * (.35 + r() * .9) * e, s = (4 + r() * 18) * (1 - p * .25);
    const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d * .55;
    inkDot(x, y, s, col);
    if (r() < .5) line2(cx + Math.cos(ang) * d * .35, cy + Math.sin(ang) * d * .2, x, y, 1.2 + r() * 1.5, col, "marker");
  }
}
/* 放射墨点（全向） */
function burstDots(cx, cy, R, seed, p, col = PAL.ink, n = 26) {
  const r = rng(seed), e = E.outCubic(p);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU_, d = R * (.4 + r() * .8) * e, s = (5 + r() * 16) * (1 - p * .6);
    if (s > 1) inkDot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, col);
  }
}
/* 放射速度线 */
function speedLines(cx, cy, r0, r1, n, seed, col = PAL.ink, w = 1.2, b = "marker") {
  const r = rng(seed);
  brush.set(b, col, w);
  for (let i = 0; i < n; i++) {
    const a = TAU_ * i / n + r() * .12, k0 = r0 * (1 + r() * .5), k1 = r1 * (.8 + r() * .4);
    brush.set(b, col, w * (.5 + r()));
    brush.line(cx + Math.cos(a) * k0, cy + Math.sin(a) * k0, cx + Math.cos(a) * k1, cy + Math.sin(a) * k1);
  }
}
/* 平行速度线（运动方向） */
function motionLines(x0, y0, x1, y1, n, spread, seed, col = PAL.ink, w = 1, b = "pen") {
  const r = rng(seed), a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  for (let i = 0; i < n; i++) {
    const o = (r() - .5) * spread, s = r() * .35, e = .65 + r() * .35;
    brush.set(b, col, w * (.5 + r()));
    brush.line(lrp(x0, x1, s) + nx * o, lrp(y0, y1, s) + ny * o, lrp(x0, x1, e) + nx * o, lrp(y0, y1, e) + ny * o);
  }
}
function ring(cx, cy, rad, w, col = PAL.ink, b = "marker", sy = 1) {
  brush.set(b, col, w);
  brush.noFill(); brush.noWash();
  brush.beginShape(.5);
  for (let i = 0; i < 24; i++) {
    const t = TAU_ * i / 24;
    brush.vertex(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad * sy);
  }
  brush.endShape(CLOSE);
}

/* ---------- 原生 p5：发光、半透明块（不走笔刷） ---------- */
function glow(x, y, r, col, a = 1, layers = 6) {
  push();
  blendMode(ADD);
  noStroke();
  const c = color(col);
  for (let i = layers; i >= 1; i--) {
    c.setAlpha(255 * a * .09 * (layers - i + 1) / layers);
    fill(c);
    circle(x, y, r * i / layers * 2);
  }
  pop();
}
function rectA(x, y, w, h, col, a = 1) {
  push(); noStroke(); const c = color(col); c.setAlpha(255 * a); fill(c); rect(x, y, w, h); pop();
}

/* ---------- 镜头 ----------
   cam = { x, y, z, r }：世界坐标 (x,y) 放在画面中心，缩放 z，旋转 r */
function applyCam(c) {
  translate(W / 2, H / 2);
  if (c.r) rotate(c.r);
  scale(c.z || 1);
  translate(-c.x, -c.y);
}
