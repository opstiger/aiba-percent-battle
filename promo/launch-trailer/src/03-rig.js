/* 03-rig — 2D 骨骼角色：小方 BLOX（手绘卡通）、零号（体素 AI 传奇）、真人线稿。
   角度约定（度）：四肢为绝对角，0 = 竖直向下，90 = 朝面向方向水平，180 = 竖直向上。
   躯干 torso：0 = 直立，正值 = 向面向方向前倾。 */
"use strict";

const BASE_POSE = {
  x: 0, y: 0, s: 1, face: 1, open: .35,
  torso: 0, head: 0, turn: .3,
  aF1: 10, aF2: 20, aB1: -10, aB2: -5,
  lF1: 8, lF2: 0, lB1: -8, lB2: 0,
  hand: "fist", ballAt: null, spin: 0,
  eye: "open", brow: 0, mouth: "smirk", look: [0, 0], blink: 0,
  sweat: 0, tails: 0,
};

/* 姿势库：只写和 BASE 不同的字段 */
const POSES = {
  stand:  {},
  dribbleHigh: { torso: 12, aF1: 25, aF2: 60, aB1: -30, aB2: 10, lF1: 25, lF2: -8, lB1: -18, lB2: -30, ballAt: null, mouth: "smirk" },
  dribbleLow:  { torso: 22, aF1: 15, aF2: 35, aB1: -40, aB2: 20, lF1: 35, lF2: -15, lB1: -25, lB2: -40, mouth: "tight", brow: -10 },
  catchChest:  { torso: 5, aF1: 35, aF2: 120, aB1: 20, aB2: 110, lF1: 18, lF2: -6, lB1: -14, lB2: -18, ballAt: "chest", open: .75, turn: 0, mouth: "grin" },
  point:       { torso: -6, aF1: 100, aF2: 95, aB1: 15, aB2: 150, open: .8, turn: 0, hand: "point", mouth: "grin", brow: -6 },
  spinBall:    { torso: -4, aF1: 150, aF2: 178, aB1: -20, aB2: 30, open: .8, turn: 0, hand: "finger", ballAt: "finger", mouth: "grin", eye: "open", brow: -8 },
  setShot:     { torso: 6, aF1: 150, aF2: 205, aB1: 140, aB2: 215, lF1: 30, lF2: -20, lB1: 12, lB2: -32, ballAt: "set", mouth: "tight", brow: -12, open: .45 },
  release:     { torso: -2, aF1: 170, aF2: 178, aB1: 150, aB2: 190, lF1: 4, lF2: 6, lB1: -6, lB2: -10, hand: "flick", ballAt: null, mouth: "tight", brow: -12 },
  follow:      { torso: -4, aF1: 172, aF2: 160, aB1: 120, aB2: 150, lF1: 10, lF2: 16, lB1: -14, lB2: -22, hand: "flick", ballAt: null, mouth: "smirk", brow: -6 },
  jumpPose:    { torso: -10, aF1: 165, aF2: 175, aB1: -60, aB2: -20, lF1: 70, lF2: -20, lB1: -20, lB2: -60, ballAt: "hand", open: .7, turn: .1, mouth: "shout", brow: -14, hand: "palm" },
  roar:        { torso: -16, head: -18, aF1: 60, aF2: 25, aB1: -60, aB2: -25, lF1: 18, lF2: 6, lB1: -18, lB2: -6, open: 1, turn: 0, mouth: "shout", eye: "closed", brow: -20, hand: "fist" },
  crouchSet:   { torso: 18, aF1: 60, aF2: 150, aB1: 40, aB2: 140, lF1: 50, lF2: -25, lB1: 30, lB2: -40, ballAt: "chest", mouth: "tight", brow: -16, open: .55 },
  lookUp:      { torso: 4, head: 8, aF1: 12, aF2: 18, aB1: -8, aB2: -4, turn: 0, open: .9, eye: "open", brow: -18, mouth: "tight" },
};
const pose = (name, over) => Object.assign({}, BASE_POSE, POSES[name] || {}, over || {});
function blendPose(a, b, t) { return mixVal(a, b, t); }
/* 关键姿势序列：[[beat, poseObj, ease], ...] */
function poseTrack(keys, beat) { return track(keys, beat); }

/* ---------- 关节计算 ---------- */
const L = { thigh: 102, shin: 100, torso: 150, neck: 16, up: 84, fore: 80, head: 124 };
function vdir(a, f) { return [Math.sin(a * DEG) * f, Math.cos(a * DEG)]; }

function joints(P) {
  const s = P.s, f = P.face;
  const tv = [Math.sin(P.torso * DEG) * f, -Math.cos(P.torso * DEG)];
  const perp = [-tv[1], tv[0]];                 // 身体横轴（面向右时指向右）
  const hip = [P.x, P.y];
  const add = (p, v, k) => [p[0] + v[0] * k * s, p[1] + v[1] * k * s];
  const sc = add(hip, tv, L.torso * .9);
  const neck = add(hip, tv, L.torso);
  const lat = (k) => k * f;
  const shF = add(sc, perp, lat(lrp(12, 44, P.open))), shB = add(sc, perp, lat(-lrp(30, 44, P.open)));
  const hpF = add(hip, perp, lat(lrp(8, 24, P.open))), hpB = add(hip, perp, lat(-lrp(14, 24, P.open)));
  const limb = (root, a1, a2, l1, l2) => {
    const m = add(root, vdir(a1, f), l1);
    return [root, m, add(m, vdir(a2, f), l2)];
  };
  const armF = limb(shF, P.aF1, P.aF2, L.up, L.fore), armB = limb(shB, P.aB1, P.aB2, L.up, L.fore);
  const legF = limb(hpF, P.lF1, P.lF2, L.thigh, L.shin), legB = limb(hpB, P.lB1, P.lB2, L.thigh, L.shin);
  const headAng = (P.torso + P.head) * DEG * f;
  const headC = add(neck, [Math.sin(headAng), -Math.cos(headAng)], L.neck + L.head * .46);
  return { s, f, tv, perp, hip, neck, sc, shF, shB, hpF, hpB, armF, armB, legF, legB, headC, headAng };
}
/* 让双脚踩在 groundY 上：返回修正后的 y */
function groundPose(P, groundY) {
  const J = joints(P);
  const low = Math.max(J.legF[2][1], J.legB[2][1]) + 22 * P.s;
  return Object.assign({}, P, { y: P.y + (groundY - low) });
}
function ballPos(P, J) {
  J = J || joints(P);
  const s = P.s, br = 36 * s;
  if (P.ballAt === "chest") {
    return [lrp(J.armF[2][0], J.armB[2][0], .5) + J.tv[0] * 4 + 24 * s * P.face * (1 - P.open), lrp(J.armF[2][1], J.armB[2][1], .5) - 6 * s];
  }
  if (P.ballAt === "set" || P.ballAt === "hand") {
    const h = J.armF[2], d = vdir(P.aF2, P.face);
    return [h[0] + d[0] * (br + 10 * s), h[1] + d[1] * (br + 10 * s)];
  }
  if (P.ballAt === "finger") {
    const h = J.armF[2];
    return [h[0], h[1] - br - 30 * s];
  }
  return null;
}

/* ---------- 小方 BLOX ---------- */
function drawLimb(a, b, r1, r2, col, w) {
  shape(capsule(a[0], a[1], r1, b[0], b[1], r2), { fill: col, w, curv: .25 });
}
function drawTube(J3, R3, col, w) { shape(tubePts(J3, R3), { fill: col, w, curv: .35 }); }
function drawShoe(ank, knee, s, f, w, accent = PAL.red) {
  const sd = [ank[0] - knee[0], ank[1] - knee[1]], L0 = Math.hypot(sd[0], sd[1]) || 1;
  const dn = [sd[0] / L0, sd[1] / L0], fw = [-dn[1] * f, dn[0] * f];  // 沿小腿向下 / 脚尖方向
  const fwd = fw[0] * f < 0 ? [-fw[0], -fw[1]] : fw;
  const P = (u, v) => [ank[0] + dn[0] * u * s + fwd[0] * v * s, ank[1] + dn[1] * u * s + fwd[1] * v * s];
  const body = [P(-34, -22), P(-34, 18), P(-6, 22), P(6, 60), P(22, 66), P(30, 58), P(30, -26), P(10, -30)];
  shape(body, { fill: PAL.shoe, w, curv: .3 });
  shape([P(22, -28), P(30, -27), P(30, 64), P(22, 66)], { fill: PAL.ink, w: 0, ink: null });
  shape([P(-4, -18), P(12, 20), P(4, 44), P(-10, 8)], { fill: accent, w: w * .6, curv: .5 });
  shape([P(-38, -24), P(-38, 20), P(-28, 20), P(-28, -24)], { fill: PAL.white, w: w * .7 });
}
function drawHand(p, s, dirAng, f, kind, w) {
  const r = 17 * s;
  if (kind === "point" || kind === "finger") {
    shape(blobPts(p[0], p[1], r, r * .95, 10, .05, 3), { fill: PAL.skin, w, curv: .6 });
    const d = kind === "finger" ? [0, -1] : vdir(dirAng, f);
    shape(capsule(p[0] + d[0] * r * .6, p[1] + d[1] * r * .6, 6.5 * s, p[0] + d[0] * r * 2.2, p[1] + d[1] * r * 2.2, 6 * s, 4), { fill: PAL.skin, w: w * .8 });
    return;
  }
  const k = kind === "palm" || kind === "flick" ? 1.15 : 1;
  shape(blobPts(p[0], p[1], r * k, r * .9 * k, 10, .08, 7), { fill: PAL.skin, w, curv: .6 });
  if (kind === "flick") {
    const d = vdir(dirAng + 55, f);
    shape(capsule(p[0] + d[0] * r * .4, p[1] + d[1] * r * .4, 8 * s, p[0] + d[0] * r * 1.7, p[1] + d[1] * r * 1.7, 6 * s, 4), { fill: PAL.skin, w: w * .8 });
  }
}
function drawBall(x, y, r, rot = 0, w = 1.4, sq = 1) {
  const ry = r * sq, rx = r / Math.sqrt(sq);
  const pts = [];
  for (let i = 0; i < 26; i++) { const t = TAU_ * i / 26; pts.push([x + Math.cos(t) * rx, y + Math.sin(t) * ry]); }
  shape(pts, { fill: PAL.orange, w, curv: .5 });
  // 阴影月牙
  const sh = [];
  for (let i = 0; i <= 12; i++) { const t = -.2 + Math.PI * 1.1 * i / 12; sh.push([x + Math.cos(t) * rx * .96, y + Math.sin(t) * ry * .96]); }
  for (let i = 12; i >= 0; i--) { const t = -.2 + Math.PI * 1.1 * i / 12; sh.push([x + Math.cos(t) * rx * .7 + rx * .12, y + Math.sin(t) * ry * .8 + ry * .1]); }
  shape(sh, { fill: "#d94f10", fillA: 200, ink: null, curv: .5 });
  // 球缝
  brush.set("pen", PAL.ink, w * .75);
  const c = Math.cos(rot), s = Math.sin(rot);
  const R = (u, v) => [x + (u * c - v * s) * rx, y + (u * s + v * c) * ry];
  brush.line(...R(-1, 0), ...R(1, 0));
  brush.line(...R(0, -1), ...R(0, 1));
  const arc = (k) => { brush.beginShape(.6); for (let i = 0; i <= 8; i++) { const t = -1 + 2 * i / 8; brush.vertex(...R(k * (1 - t * t * .55) * .62, t * .95)); } brush.endShape(); };
  brush.noFill(); arc(1); arc(-1);
}
function drawNumber(str, cx, cy, h, w, col = PAL.white) {
  // 手写数字：只要 0 和 1
  let x = cx - (str.length - 1) * h * .33;
  for (const ch of str) {
    if (ch === "1") { line2(x - h * .08, cy - h * .38, x + h * .04, cy - h * .5, w, col, "marker"); line2(x + h * .04, cy - h * .5, x + h * .02, cy + h * .5, w, col, "marker"); }
    else if (ch === "0") ring(x, cy, h * .24, w, col, "marker", 2.05);
    x += h * .66;
  }
}

function drawBlox(P, opt = {}) {
  const J = joints(P), s = P.s, f = P.face, w = (opt.w || 3.4) * s;
  const shade = (c) => mixHex(c, "#3b2a55", .28);
  // 后臂
  drawTube(J.armB, [17 * s, 14 * s, 12 * s], shade(PAL.skin), w);
  shape(capsule(J.armB[2][0] + (J.armB[2][0] - J.armB[1][0]) * .02, J.armB[2][1], 12.5 * s, J.armB[2][0], J.armB[2][1], 12.5 * s), { fill: PAL.red, w: w * .7 });
  drawHand(J.armB[2], s, P.aB2, f, P.hand === "finger" || P.hand === "point" ? "fist" : P.hand, w);
  // 后腿
  drawTube(J.legB, [25 * s, 19 * s, 15 * s], shade(PAL.skin), w);
  drawShoe(J.legB[2], J.legB[1], s, f, w, shade(PAL.red));
  // 短裤
  const hk = (leg, k) => [lrp(leg[0][0], leg[1][0], k), lrp(leg[0][1], leg[1][1], k)];
  const kF = hk(J.legF, .55), kB = hk(J.legB, .55);
  const wa = (k) => [J.hip[0] + J.perp[0] * k * s + J.tv[0] * 22 * s, J.hip[1] + J.perp[1] * k * s + J.tv[1] * 22 * s];
  const shorts = [wa(-40 * f), wa(40 * f), [kF[0] + J.perp[0] * 26 * s * f, kF[1] + 8 * s], [kF[0] - J.perp[0] * 22 * s * f, kF[1] + 10 * s],
    [J.hip[0], J.hip[1] + 14 * s], [kB[0] + J.perp[0] * 22 * s * f, kB[1] + 10 * s], [kB[0] - J.perp[0] * 26 * s * f, kB[1] + 8 * s]];
  shape(shorts, { fill: PAL.shorts, w, curv: .15 });
  // 球衣（背心）
  const T = (u, v) => [J.hip[0] + J.perp[0] * u * s * f + J.tv[0] * v * s, J.hip[1] + J.perp[1] * u * s * f + J.tv[1] * v * s];
  const ow = lrp(34, 50, P.open);
  const jersey = [T(-ow - 4, 18), T(ow + 4, 18), T(ow + 2, 110), T(ow - 6, 140), T(ow * .45, 146), T(0, 124), T(-ow * .45, 146), T(-ow - 2, 140), T(-ow - 4, 110)];
  shape(jersey, { fill: PAL.jersey, w, curv: .12 });
  shape([T(-ow - 4, 18), T(ow + 4, 18), T(ow + 4, 34), T(-ow - 4, 34)], { fill: PAL.jerseyDark, ink: null });
  // 领口描边 + 号码
  poly([T(-ow * .45, 146), T(-ow * .15, 128), T(0, 122), T(ow * .15, 128), T(ow * .45, 146)], w * .8, PAL.white, "marker", .6);
  const nc = T(0, 78);
  drawNumber("100", nc[0] + J.perp[0] * 2, nc[1], 40 * s, 2.2 * s, PAL.navy);
  // 前腿
  drawTube(J.legF, [26 * s, 20 * s, 15 * s], PAL.skin, w);
  // 袜子
  const sk = hk([J.legF[1], J.legF[2]], .78);
  shape(capsule(sk[0], sk[1], 17 * s, J.legF[2][0], J.legF[2][1], 16 * s), { fill: PAL.white, w: w * .7 });
  drawShoe(J.legF[2], J.legF[1], s, f, w);
  // 头
  drawBloxHead(P, J, w);
  // 前臂 + 护腕
  drawTube(J.armF, [18 * s, 15 * s, 12.5 * s], PAL.skin, w);
  const wb = hk([J.armF[1], J.armF[2]], .72);
  shape(capsule(wb[0], wb[1], 15 * s, lrp(wb[0], J.armF[2][0], .6), lrp(wb[1], J.armF[2][1], .6), 14 * s, 5), { fill: PAL.red, w: w * .7 });
  drawHand(J.armF[2], s, P.aF2, f, P.hand, w);
  // 球
  const bp = opt.noBall ? null : ballPos(P, J);
  if (bp) drawBall(bp[0], bp[1], 36 * s, P.spin || 0, w * .8);
  return J;
}

function drawBloxHead(P, J, w) {
  const s = P.s, f = P.face, c = J.headC, a = J.headAng, hw = 124 * s, hh = 116 * s;
  const R = (u, v) => rotP([c[0] + u * s, c[1] + v * s], c[0], c[1], a);
  const tn = P.turn * f;                       // 脸朝向偏移
  // 头带飘带（在头后）
  const tb = FRAME * .45 + (P.tails || 0);
  const back = -f;
  const tail = (k) => {
    const pts = [R(back * 58, -18 + k * 12)];
    for (let i = 1; i <= 5; i++) pts.push(R(back * (58 + i * 20), -18 + k * 12 + Math.sin(tb + i * .9 + k) * 7 * i * .6 + i * 4));
    return pts;
  };
  for (const k of [0, 1]) {
    const t = tail(k), pts = t.concat(t.slice().reverse().map((p, i) => [p[0], p[1] + 12 * s * (1 - i / 6)]));
    shape(pts, { fill: PAL.red, w: w * .7, curv: .5 });
  }
  // 耳朵
  const ex = -tn * 46 + (tn >= 0 ? -1 : 1) * 60;
  if (Math.abs(tn) > .05) shape(blobPts(...R(ex, 4), 13 * s, 18 * s, 8, .05, 2, a), { fill: PAL.skinShade, w: w * .8, curv: .6 });
  // 脸
  shape(squirclePts(c[0], c[1], hw, hh, 3.4, 30, a), { fill: PAL.skin, w: w * 1.1, curv: .4 });
  // 下巴阴影
  shape([R(-50, 30), R(50, 30), R(46, 52), R(0, 58), R(-46, 52)], { fill: PAL.skinShade, fillA: 120, ink: null, curv: .6 });
  // 头发尖刺
  const hair = [R(-66, -14)];
  const spikes = [[-70, -70], [-52, -52], [-40, -92], [-18, -62], [2, -102], [18, -64], [40, -96], [48, -58], [72, -76], [66, -22]];
  for (const [u, v] of spikes) hair.push(R(u + tn * 6, v));
  hair.push(R(62, -28));
  shape(hair, { fill: PAL.ink, w: w * .8, curv: 0 });
  // 头带
  shape([R(-66, -38), R(66, -38), R(66, -18), R(-66, -18)], { fill: PAL.red, w: w * .9 });
  // 五官
  const ox = tn * 22, ly = P.look || [0, 0];
  const eyeY = 2;
  const eyes = [[-26 + ox, eyeY, tn > 0 ? .85 : 1], [26 + ox, eyeY, tn < 0 ? .85 : 1]];
  for (const [ux, uy, k] of eyes) drawEye(R(ux, uy), s, k, P, a, w);
  // 眉毛
  const bw = 3.2 * s;
  for (const sgn of [-1, 1]) {
    const bx = sgn * 26 + ox, ang = (P.brow || 0) * DEG * -sgn;
    const p0 = rotP(R(bx - 16, -8), ...R(bx, -8), ang), p1 = rotP(R(bx + 16, -8), ...R(bx, -8), ang);
    line2(p0[0], p0[1] - 6 * s, p1[0], p1[1] - 6 * s, bw, PAL.ink, "marker");
  }
  // 鼻子
  line2(...R(ox * 1.3 + 2, 18), ...R(ox * 1.3 + 8 * f, 26), w * .6);
  // 嘴
  drawMouth(P, R, ox, s, w);
  // 汗
  if (P.sweat > 0) {
    const sp = R(-f * 56, -10 + P.sweat * 30);
    shape(blobPts(sp[0], sp[1], 7 * s, 11 * s, 8, .05, 5), { fill: "#bfe9ff", w: w * .6, curv: .7 });
  }
}
function drawEye(p, s, k, P, a, w) {
  const e = P.eye, ly = P.look || [0, 0];
  const ew = 22 * s * k, eh = 28 * s * (1 - (P.blink || 0) * .9);
  if (e === "closed" || (P.blink || 0) > .85) {
    shape([[p[0] - ew * .9, p[1] + 3 * s], [p[0], p[1] - 9 * s], [p[0] + ew * .9, p[1] + 3 * s], [p[0], p[1] - 4 * s]], { fill: PAL.ink, w: w * .8, curv: .5 });
    return;
  }
  if (e === "squint") {
    shape([[p[0] - ew * .55, p[1]], [p[0] + ew * .55, p[1] - 2 * s], [p[0] + ew * .4, p[1] + 7 * s], [p[0] - ew * .4, p[1] + 7 * s]], { fill: PAL.white, w: w * .8, curv: .5 });
    inkDot(p[0] + (P.look || [0])[0] * 4 * s, p[1] + 3 * s, 9 * s, PAL.ink);
    line2(p[0] - ew * .75, p[1] - 1 * s, p[0] + ew * .75, p[1] - 4 * s, w * 1.3, PAL.ink, "pen");
    return;
  }
  const big = e === "wide" ? 1.15 : 1;
  shape(blobPts(p[0], p[1], ew * .5 * big, eh * .5 * big, 12, .03, 9, a), { fill: PAL.white, w: w * .8, curv: .7 });
  const pr = (e === "wide" ? 6 : 9) * s * k;
  const px = p[0] + ly[0] * 5 * s, py = p[1] + ly[1] * 6 * s + 2 * s;
  if (e === "fire") {
    shape([[px - pr, py + pr], [px - pr * .6, py - pr * 1.2], [px, py - pr * .3], [px + pr * .4, py - pr * 1.8], [px + pr, py + pr]], { fill: PAL.orange, ink: PAL.red, w: w * .5, curv: .5 });
  } else inkDot(px, py, pr * 2, PAL.ink);
  inkDot(px - pr * .35, py - pr * .45, pr * .7, PAL.white);
  if (e === "star") {
    // 星光在 2D 合成层画（见 06-post），这里只标记
  }
}
function drawMouth(P, R, ox, s, w) {
  const m = P.mouth, mx = ox * 1.2;
  if (m === "grin") {
    const o = [R(mx - 24, 36), R(mx + 26, 32), R(mx + 18, 48), R(mx, 53), R(mx - 18, 48)];
    shape(o, { fill: "#7a1c1c", w: w * .9, curv: .5 });
    shape([R(mx - 20, 37), R(mx + 22, 34), R(mx + 18, 41), R(mx - 17, 43)], { fill: PAL.white, ink: null, curv: .4 });
  } else if (m === "shout") {
    const o = [R(mx - 26, 30), R(mx + 26, 30), R(mx + 22, 58), R(mx, 70), R(mx - 22, 58)];
    shape(o, { fill: "#6d1414", w: w, curv: .5 });
    shape([R(mx - 22, 31), R(mx + 22, 31), R(mx + 19, 39), R(mx - 19, 39)], { fill: PAL.white, ink: null });
    shape([R(mx - 12, 60), R(mx + 12, 60), R(mx + 6, 67), R(mx - 6, 67)], { fill: "#e8606b", ink: null, curv: .6 });
  } else if (m === "o") {
    shape(blobPts(...R(mx, 42), 8 * s, 10 * s, 10, .05, 4), { fill: "#6d1414", w: w * .8, curv: .7 });
  } else if (m === "tight") {
    poly([R(mx - 16, 42), R(mx, 40), R(mx + 16, 43)], w * .9, PAL.ink, "pen", .6);
  } else {
    poly([R(mx - 18, 40), R(mx + 4, 44), R(mx + 22, 34)], w * .95, PAL.ink, "pen", .7);
  }
}

/* ---------- 零号：体素 AI 传奇 ---------- */
function boxLimb(a, b, r, col, w, edge) {
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, n = [-d[1] / l * r, d[0] / l * r];
  const pts = [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]];
  shape(pts, { fill: col, w });
  if (edge) line2(pts[0][0], pts[0][1], pts[1][0], pts[1][1], w * .5, edge, "marker");
  shape(capsule(b[0], b[1], r * .9, b[0], b[1], r * .9, 2), { fill: mixHex(col, "#000", .25), w: w * .6 });
}
function drawLegend(P, opt = {}) {
  const J = joints(P), s = P.s, f = P.face, w = (opt.w || 2.6) * s;
  const dk = "#2a2f4a", md = "#3d4468", cy = PAL.cyan;
  boxLimb(J.armB[0], J.armB[1], 18 * s, dk, w); boxLimb(J.armB[1], J.armB[2], 16 * s, dk, w);
  boxLimb(J.legB[0], J.legB[1], 26 * s, dk, w); boxLimb(J.legB[1], J.legB[2], 21 * s, dk, w);
  const foot = (p, col) => shape([[p[0] - 30 * s * f, p[1] - 6 * s], [p[0] + 52 * s * f, p[1] - 6 * s], [p[0] + 52 * s * f, p[1] + 22 * s], [p[0] - 30 * s * f, p[1] + 22 * s]], { fill: col, w });
  foot(J.legB[2], "#1a1d30");
  // 躯干方块
  const T = (u, v) => [J.hip[0] + J.perp[0] * u * s * f + J.tv[0] * v * s, J.hip[1] + J.perp[1] * u * s * f + J.tv[1] * v * s];
  shape([T(-46, 0), T(46, 0), T(56, 150), T(-56, 150)], { fill: md, w });
  shape([T(-40, 10), T(40, 10), T(40, 40), T(-40, 40)], { fill: dk, w: w * .6 });
  line2(...T(-56, 150), ...T(-46, 0), w * .8, cy, "marker");
  // 胸口 0
  const nc = T(0, 92);
  ring(nc[0], nc[1], 12 * s, 1.6 * s, cy, "marker", 1.8);
  boxLimb(J.legF[0], J.legF[1], 27 * s, md, w, cy); boxLimb(J.legF[1], J.legF[2], 22 * s, md, w, cy);
  foot(J.legF[2], "#20243a");
  // 头盔
  const c = J.headC, a = J.headAng;
  const R = (u, v) => rotP([c[0] + u * s, c[1] + v * s], c[0], c[1], a);
  shape([R(-60, -62), R(60, -62), R(64, 58), R(-64, 58)], { fill: md, w: w * 1.1 });
  shape([R(-60, -62), R(60, -62), R(52, -76), R(-52, -76)], { fill: "#555d8a", w: w * .8 });
  shape([R(-52, -14), R(54, -14), R(54, 16), R(-52, 16)], { fill: "#0b0e1c", w: w * .8 });
  boxLimb(J.armF[0], J.armF[1], 19 * s, md, w, cy); boxLimb(J.armF[1], J.armF[2], 17 * s, md, w, cy);
  shape(squirclePts(J.armF[2][0], J.armF[2][1], 40 * s, 40 * s, 6, 16), { fill: dk, w });
  return { J, visor: [R(-50, 0), R(52, 0)], visorC: R(0, 0), a };
}
/* 面罩发光要在 flush 之后用原生绘制叠上去 */
function legendGlow(L, s, k = 1) {
  push();
  blendMode(ADD);
  strokeCap(SQUARE);
  const [p0, p1] = L.visor;
  for (let i = 5; i >= 1; i--) {
    stroke(25, 195, 208, 40 * k);
    strokeWeight(i * 9 * s);
    line(p0[0], p0[1], p1[0], p1[1]);
  }
  stroke(200, 255, 255, 230 * k); strokeWeight(7 * s);
  line(p0[0], p0[1], p1[0], p1[1]);
  pop();
}

/* ---------- 真人线稿（体感投篮） ---------- */
function drawHumanSketch(P, col = "#2a2520") {
  const J = joints(P), s = P.s, w = 1.6 * s;
  const cap = (a, b, r1, r2) => shape(capsule(a[0], a[1], r1, b[0], b[1], r2), { fill: "#b9bfc2", ink: col, w, brush: "pen", curv: .3 });
  cap(J.armB[0], J.armB[1], 22 * s, 18 * s); cap(J.armB[1], J.armB[2], 18 * s, 14 * s);
  cap(J.legB[0], J.legB[1], 28 * s, 22 * s); cap(J.legB[1], J.legB[2], 22 * s, 16 * s);
  const T = (u, v) => [J.hip[0] + J.perp[0] * u * s + J.tv[0] * v * s, J.hip[1] + J.perp[1] * u * s + J.tv[1] * v * s];
  shape([T(-52, -6), T(52, -6), T(58, 120), T(40, 150), T(-40, 150), T(-58, 120)], { fill: "#8e979c", ink: col, w: w * 1.2, brush: "pen", curv: .3 });
  line2(...T(-10, 150), ...T(-14, 110), w, col, "pen"); line2(...T(10, 150), ...T(14, 110), w, col, "pen");
  cap(J.legF[0], J.legF[1], 28 * s, 22 * s); cap(J.legF[1], J.legF[2], 22 * s, 16 * s);
  shape(blobPts(J.headC[0], J.headC[1], 48 * s, 56 * s, 14, .04, 11), { fill: "#cfd4d6", ink: col, w: w * 1.2, brush: "pen", curv: .6 });
  // 兜帽
  poly([[J.headC[0] - 58 * s, J.headC[1] + 30 * s], [J.headC[0] - 62 * s, J.headC[1] - 20 * s], [J.headC[0] - 30 * s, J.headC[1] - 66 * s], [J.headC[0] + 30 * s, J.headC[1] - 66 * s], [J.headC[0] + 60 * s, J.headC[1] - 18 * s]], w * 1.2, col, "pen", .6);
  cap(J.armF[0], J.armF[1], 22 * s, 18 * s); cap(J.armF[1], J.armF[2], 18 * s, 14 * s);
  return J;
}
/* 姿态骨架（原生发光线） */
function drawPoseSkeleton(J, k = 1) {
  const segs = [[J.shF, J.armF[1]], [J.armF[1], J.armF[2]], [J.shB, J.armB[1]], [J.armB[1], J.armB[2]], [J.shF, J.shB],
    [J.hpF, J.legF[1]], [J.legF[1], J.legF[2]], [J.hpB, J.legB[1]], [J.legB[1], J.legB[2]], [J.hpF, J.hpB], [J.shF, J.hpF], [J.shB, J.hpB], [J.neck, J.headC]];
  push(); blendMode(ADD);
  for (const [a, b] of segs) {
    stroke(25, 195, 208, 60 * k); strokeWeight(14); line(a[0], a[1], b[0], b[1]);
    stroke(160, 250, 255, 230 * k); strokeWeight(4); line(a[0], a[1], b[0], b[1]);
  }
  noStroke();
  const pts = [J.shF, J.shB, J.armF[1], J.armF[2], J.armB[1], J.armB[2], J.hpF, J.hpB, J.legF[1], J.legF[2], J.legB[1], J.legB[2], J.headC];
  for (const p of pts) { fill(25, 195, 208, 80 * k); circle(p[0], p[1], 26); fill(230, 255, 255, 255 * k); circle(p[0], p[1], 10); }
  pop();
}
