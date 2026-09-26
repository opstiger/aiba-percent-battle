/* 05-shots — 分镜 S1–S14 的逐帧绘制。bt = 镜头内的拍数（浮点）。
   CUES 同时驱动画面（震动/推镜/闪白/反相）和声音（07-audio 读 sfx 字段）。 */
"use strict";

const CUES = [
  { b: 1, sfx: ["boom", "bounce"], shake: 30, punch: .07 },
  { b: 2, sfx: ["bounce", "squeak"], shake: 10 },
  { b: 3, sfx: ["bounce"], shake: 6 },
  { b: 3.5, sfx: ["whoosh"] },
  { b: 4, sfx: ["bounceS"] }, { b: 5, sfx: ["bounceS"] },
  { b: 6, sfx: ["catch", "ding"], punch: .03 },
  { b: 7, sfx: ["whooshUp"] },
  { b: 8, sfx: ["boom", "crash", "stab"], shake: 26, punch: .12, invert: 2 },
  { b: 10, sfx: ["stamp", "stab"], shake: 16, punch: .05 },
  { b: 15.5, sfx: ["wipe"] },
  { b: 18, sfx: ["shoot"], shake: 5 },
  { b: 20, sfx: ["swish", "stab"], shake: 12, punch: .05 },
  { b: 22, sfx: ["shoot"], shake: 6 }, { b: 23, sfx: ["shoot"], shake: 6 }, { b: 24, sfx: ["shoot"], shake: 6 }, { b: 25, sfx: ["shoot", "stab"], shake: 8 },
  { b: 26, sfx: ["shoot"], shake: 4 }, { b: 27, sfx: ["shoot"], shake: 4 }, { b: 28, sfx: ["shoot"], shake: 4 },
  { b: 28.5, sfx: ["shoot"], shake: 4 }, { b: 29, sfx: ["shoot"], shake: 4 }, { b: 29.5, sfx: ["shoot"], shake: 4 },
  { b: 30, sfx: ["ignite"], shake: 8 },
  { b: 31.5, sfx: ["fireUp"], punch: .04 },
  { b: 32, sfx: ["whip", "stab"], shake: 12, punch: .05 }, { b: 33, sfx: ["whip", "gull"], shake: 12, punch: .05 },
  { b: 34, sfx: ["whip"], shake: 12, punch: .05 }, { b: 35, sfx: ["whip", "stab"], shake: 12, punch: .05 },
  { b: 36, sfx: ["stomp"], shake: 20, punch: .05 }, { b: 37, sfx: ["slide"], shake: 6 }, { b: 38, sfx: ["snap"], shake: 10 },
  { b: 39, sfx: ["riser"] },
  { b: 40, sfx: ["heart", "hush"] }, { b: 41, sfx: ["heart"] }, { b: 42, sfx: ["heart"] }, { b: 43, sfx: ["heart"] },
  { b: 44, sfx: ["heart"] }, { b: 45, sfx: ["heart"] }, { b: 46, sfx: ["heart", "riser2"] },
  { b: 47, sfx: ["shoot"] },
  { b: 47.9, sfx: ["buzzer"], flash: .5 },
  { b: 48, sfx: ["boom"], shake: 10 },
  { b: 50, sfx: ["swish", "boom", "crash", "roar", "stab"], shake: 40, sdur: 14, punch: .14, invert: 2 },
  { b: 51, sfx: ["yell"], shake: 16, sdur: 10 },
  { b: 56, sfx: ["wipe", "boom"], shake: 10 },
  { b: 58.6, sfx: ["ding"] },
  { b: 60, sfx: ["stamp", "stab"], shake: 14, punch: .05 },
  { b: 64, sfx: ["boom", "stabLong"], shake: 8, punch: .03 },
  { b: 68, sfx: ["bounceS"] }, { b: 68.8, sfx: ["bounceS2"] }, { b: 69.4, sfx: ["bounceS3"] },
];

function withCam(c, fn) { push(); applyCam(c); fn(); flush(); pop(); }
function darkBG(col) { rectA(0, 0, W, H, col, 1); }

/* ========== S1 砸地 0–4 ========== */
const S1 = { b0: 0, vig: 1,
  ball(bt) {
    const G = 820, R = 70;
    if (bt < 1) return { x: 960, y: lrp(-260, G - R, E.inQuad(bt)), sq: bt > .9 ? .8 : 1.15, vy: 1 };
    const hops = [[1, 2, 400], [2, 3, 250], [3, 4.2, 900]];
    for (const [a, b, h] of hops) if (bt < b) {
      const u = (bt - a) / (b - a), y = G - R - h * 4 * u * (1 - u);
      const sq = u < .06 ? .7 : u > .94 ? .8 : 1 + Math.abs(.5 - u) * .2;
      return { x: 960 + (bt - 1) * 40, y, sq, vy: u < .5 ? -1 : 1 };
    }
  },
  cam(bt) { return { x: 960, y: 560 - (bt > 3.5 ? E.inCubic(inv(3.5, 4, bt)) * 1400 : 0), z: 1 + bt * .025 }; },
  gl(bt, f) {
    const G = 820;
    darkBG("#120e0c");
    const c = this.cam(bt);
    withCam(c, () => {
      // 地面聚光
      push(); noStroke();
      for (let i = 0; i < 8; i++) { fill(236, 222, 194, 34); ellipse(960, G + 30, 1500 - i * 150, 300 - i * 26); }
      pop();
      glow(960, G - 300, 700, "#ff9a40", .35);
      boil(1);
      line2(-300, G + 4, 2200, G + 2, 2.4, "#3a2a20", "marker");
      // 冲击：墨花 + 冲击环 + 裂纹
      for (const [k, R] of [[1, 640], [2, 330], [3, 220]]) {
        const d = bt - k;
        if (d < 0) continue;
        splat(960 + (k - 1) * 40, G + 10, R, k * 17, clmp(d * 4), PAL.ink, k === 1 ? 30 : 14);
        if (d < .7) ring(960 + (k - 1) * 40, G, 90 + E.outCubic(d / .7) * R * 1.2, 5 * (1 - d / .7) + .5, PAL.paper, "marker", .22);
        if (k === 1) {
          const r = rng(5);
          for (let i = 0; i < 9; i++) {
            const a = (i / 8 - .5) * Math.PI * .9, l = 200 + r() * 300;
            const pts = [[960, G + 6]];
            for (let s = 1; s <= 4; s++) pts.push([960 + Math.sin(a) * l * s / 4 * E.outExpo(clmp(d * 3)) + (r() - .5) * 30, G + 6 + Math.abs(Math.cos(a)) * 30 * s / 4]);
            poly(pts, 1.4, PAL.ink, "pen", 0);
          }
        }
      }
      // 小方的腿踩进来（拍 2）
      if (bt > 1.75) {
        const u = E.outBack(inv(1.75, 2, bt), 1.2);
        const P = groundPose(pose("dribbleLow", { x: lrp(2200, 1330, u), s: 2.3, face: -1, tails: 0 }), G);
        drawBlox(P, { noBall: true });
      }
      const b = this.ball(bt);
      if (b) {
        if (b.vy > 0 && bt < 1) motionLines(b.x, b.y - 520, b.x, b.y - 60, 14, 120, 3, PAL.paper, 1.4, "marker");
        if (bt > 3.3) motionLines(b.x, b.y + 500, b.x, b.y + 60, 12, 110, 4, PAL.paper, 1.4, "marker");
        drawBall(b.x, b.y, 70, bt * 2.4, 3, b.sq);
      }
    });
    // 甩摇：整屏竖向拖影
    if (bt > 3.5) { const k = inv(3.5, 4, bt); boil(9); motionLines(0, H * 1.2, 0, -H * .2, 0, 0, 1); for (let i = 0; i < 40; i++) { const x = hash(i + 1) * W; line2(x, H * (1 - k) + 200, x, -100, 1 + hash(i + 7) * 4, i % 3 ? "#f6ecd8" : PAL.orange, "marker"); } }
  },
};

/* ========== S2 亮相 4–8 ========== */
const S2 = { b0: 4, vig: .7,
  G: 1250, X: 960, S: 1.3,
  P(bt) {
    const G = this.G;
    let P;
    if (bt < 2) {
      const h = Math.abs(Math.sin(Math.PI * bt));          // 0 = 球在地
      P = blendPose(pose("dribbleLow", { turn: .6, face: 1 }), pose("dribbleHigh", { turn: .6 }), h);
      P.aF1 = lrp(30, 55, h); P.aF2 = lrp(20, 70, h);
    } else if (bt < 3) {
      const u = inv(2, 2.18, bt);
      P = blendPose(pose("dribbleHigh", { turn: .6 }), pose("catchChest", { turn: 0, eye: "open" }), E.outBack(u));
      P.turn = lrp(.7, 0, E.outBack(u, 2.5));
      P.brow = -8;
    } else {
      P = blendPose(pose("catchChest"), pose("spinBall"), E.outCubic(inv(3, 3.25, bt)));
      P.spin = bt * 9;
    }
    P.x = this.X; P.s = this.S;
    if (bt > 3.5) P.blink = 0;
    return groundPose(P, G);
  },
  ballFree(bt, P) {
    if (bt >= 2) return null;
    const J = joints(P), hand = J.armF[2], h = Math.abs(Math.sin(Math.PI * bt));
    return [hand[0] + 20, lrp(this.G - 36 * this.S, hand[1] + 40 * this.S, h)];
  },
  cam(bt) {
    const y = track([[0, 1080], [1.8, 800, E.inOutCubic], [3, 780], [3.6, 700, E.inOutCubic], [4, 695]], bt);
    const z = track([[0, 1.55], [1.8, 1.0, E.inOutCubic], [3.05, 1.02], [3.7, 2.3, E.inOutQuint], [4, 4.2, E.inExpo]], bt);
    const x = track([[0, 1000], [1.8, 960], [3.2, 960], [4, 960 - 26]], bt);
    return { x, y, z, r: track([[0, .05], [1.8, 0], [4, -.03]], bt) };
  },
  gl(bt, f) {
    const c = this.cam(bt), P = this.P(bt);
    withCam(c, () => {
      plate("sunset", 960 + (c.x - 960) * .5, 850 + (c.y - 800) * .35);
      boil(2);
      const J = drawBlox(P, { noBall: bt < 2 });
      const b = this.ballFree(bt, P);
      if (b) {
        const sq = b[1] > this.G - 50 ? .78 : 1;
        drawBall(b[0], b[1], 36 * this.S, bt * 4, 3, sq);
        const h = Math.abs(Math.sin(Math.PI * bt));
        if (h < .12) ring(b[0], this.G, 60 + (1 - h / .12) * 30, 2, PAL.paper, "marker", .25);
      }
    });
  },
  ov(ctx, bt, f) {
    if (bt > 2 && bt < 2.8) {
      const P = this.P(bt), J = joints(P), c = this.cam(bt);
      const e = rotP([J.headC[0] + 26 * P.s, J.headC[1] - 8 * P.s], J.headC[0], J.headC[1], J.headAng);
      const [x, y] = toScreen(c, e[0], e[1]);
      const k = inv(2.02, 2.25, bt), out = inv(2.5, 2.8, bt);
      starGlint(ctx, x + 14, y - 16, 70 * E.outBack(k) * (1 - out), 1);
    }
  },
};

/* ========== S3 片名 8–16 ========== */
const S3 = { b0: 8, vig: .5,
  gl(bt, f) {
    const c = { x: 960, y: 540, z: 1 + bt * .016, r: -bt * .004 };
    withCam(c, () => {
      burst("burstO", 640, 520, 1500, bt * 2.2, .3);
      burst("burstT", 1340, 560, 1400, (bt - .08) * 2.2, 1.2);
      burst("burstY", 960, 480, 900, (bt - .15) * 2, 2.1);
      if (bt > 2) burst("burstM", 960, 780, 900, (bt - 2) * 2.5, .6);
      boil(3);
      const ks = bt < 2.5 ? 1 : .5;
      speedLines(960, 470, 420 + bt * 20, 1400, bt < 2.5 ? 64 : 36, 7 + Math.floor(f / 2), PAL.ink, 1.3 * ks);
      // 小方空中 pose
      const u = E.outBack(inv(0, .35, bt), 1.4);
      const P = pose("jumpPose", { x: lrp(-100, 420, u), y: lrp(1300, 690, u) + Math.sin(bt * 1.6) * 14, s: 1.02, spin: bt * 6, tails: bt });
      drawBlox(P);
      motionLines(P.x - 380, P.y + 360, P.x - 120, P.y + 120, 8, 160, 5, PAL.ink, 1);
      // Logo 砸下
      const sc = bt < .3 ? lrp(3.2, 1, E.outQuint(bt / .3)) : 1 + (bt - .3) * .01;
      drawLogo(1030, 400, 330 * sc, 1);
      if (bt > 7.3) burstDots(1030, 400, 900, 12, inv(7.3, 8, bt), PAL.ink, 40);
    });
  },
  ov(ctx, bt, f) {
    if (bt >= 2) {
      const k = inv(2, 2.14, bt), sc = lrp(2.4, 1, E.outQuad(k));
      ctx.save(); ctx.translate(1030, 700); ctx.scale(sc, sc);
      stampBox(ctx, 0, 0, 600, 150, PAL.red, -.035, clmp(k * 3));
      inkText(ctx, "百分大战", 0, 4, { size: 128, font: "Zhi Mang Xing", fill: PAL.white, stroke: false, shadow: "#8a0f1f", rot: -.035, alpha: clmp(k * 3) });
      ctx.restore();
      if (bt > 2.4) inkText(ctx, "P E R C E N T   B A T T L E", 1030, 816, { size: 46, fill: PAL.ink, stroke: false, shadow: PAL.orange, shadowD: 3, alpha: inv(2.4, 2.8, bt) });
    }
    if (bt > 7.45) inkWipe(ctx, inv(7.45, 8, bt), PAL.ink, 3);
  },
};

/* ========== S4 真身投篮 16–20 ========== */
const SHOT_KEYS = [
  [0, pose("crouchSet")], [1.1, pose("setShot"), E.inOutCubic], [1.9, pose("setShot", { torso: 2 })],
  [2, pose("release"), E.outQuint], [2.5, pose("follow")], [4, pose("follow", { mouth: "grin" })]];
const S4 = { b0: 16, vig: .6,
  shooter(bt, x, G, s) {
    let P = Object.assign({}, poseTrack(SHOT_KEYS, bt), { x, s });
    P = groundPose(P, G);
    P.y -= Math.max(0, Math.sin(clmp((bt - 1.85) / 1.1) * Math.PI)) * 70 * s;   // 起跳
    return P;
  },
  gl(bt, f) {
    const c = { x: 960, y: 540, z: 1.02 + bt * .012 };
    withCam(c, () => {
      plate("sunset", 1300, 300, 1);
      boil(4);
      // 右格：小方
      const P = this.shooter(bt, 1420, 1000, 1.0);
      const J = drawBlox(P, { noBall: bt >= 2 });
      if (bt >= 2) {
        const u = (bt - 2) / 1.2, h = J.armF[2];
        const bx = lrp(h[0] + 20, 2150, E.inQuad(u)), by = lrp(h[1] - 50, -300, E.outQuad(u));
        if (u < 1) { motionLines(bx - 300, by + 300, bx - 40, by + 40, 8, 90, 7, PAL.ink, 1); drawBall(bx, by, 36, bt * 8, 3); }
      }
      flush();
      // 左格
      shape([[-100, -100], [1130, -100], [860, 1180], [-100, 1180]], { fill: "#e6ebe8", ink: null });
      shape([[-100, 900], [1000, 900], [920, 1180], [-100, 1180]], { fill: "#d2d8d4", ink: null });
      // 手机支架
      shape([[70, 560], [150, 560], [150, 700], [70, 700]], { fill: "#2a2f45", w: 2.6 });
      line2(110, 700, 60, 930, 2.4); line2(110, 700, 160, 930, 2.4);
      const Hm = drawHumanSketch(this.shooter(bt, 560, 1000, 1.0));
      flush();
      glow(150, 600, 40, PAL.cyan, .8, 4);
      drawPoseSkeleton(Hm, .85);
      boil(5);
      line2(1130, -100, 860, 1180, 9, PAL.ink, "marker");
    });
  },
  ov(ctx, bt) {
    if (bt < .5) inkWipe(ctx, 1 + bt / .5, PAL.ink, 3);
    inkText(ctx, "体感投篮", 330, 120, { size: 76, font: "ZCOOL QingKe HuangYou", fill: PAL.cyan, shadow: PAL.ink, shadowD: 5, strokeW: 10, alpha: inv(.3, .7, bt) });
    inkText(ctx, "真实投篮动作 = 游戏出手", 330, 200, { size: 34, font: "ZCOOL QingKe HuangYou", fill: PAL.ink, stroke: false, shadow: false, alpha: inv(.5, .9, bt) });
  },
};

/* ========== S5 空心 20–22 ========== */
const S5 = { b0: 20, vig: .6,
  gl(bt, f) {
    const c = { x: 960, y: 540, z: 1 + bt * .05 };
    withCam(c, () => {
      burst("burstT", 960, 600, 1900, (bt + .1) * 2.5, .4);
      boil(6);
      speedLines(960, 560, 520, 1500, 44, 11 + Math.floor(f / 2), PAL.ink, 1.1);
      const cx = 960, cy = 380, s = 2.5, R = 36 * 2.5 * 1.25;
      hoopBack(cx, cy, s);
      const u = (bt + .25) / 1.15, by = lrp(-260, 1400, E.inQuad(clmp(u)) * .6 + clmp(u) * .4);
      const inNet = by > cy && by < cy + 480;
      const stretch = inNet ? Math.sin(inv(cy, cy + 480, by) * Math.PI) : 0;
      if (by < 1500) {
        if (by < cy + 60) motionLines(cx, by - 600, cx, by - R, 12, R * 1.6, 8, PAL.ink, 1.2);
        drawBall(cx, by, R, bt * 5, 4, by < cy ? 1.12 : 1);
      }
      hoopFront(cx, cy, s, stretch, bt > .4 ? Math.max(0, 1 - (bt - .4)) : 0, f);
      if (bt > .15) burstDots(cx, cy + 420, 700, 21, inv(.15, .7, bt), PAL.ink, 30);
    });
  },
  ov(ctx, bt) {
    if (bt > .08) inkText(ctx, "SWISH!", 1480, 330, { size: 250, fill: PAL.yellow, shadow: PAL.magenta, strokeW: 26, rot: -.14, scale: E.outBack(inv(.08, .3, bt)) });
    if (bt > .6) inkText(ctx, "+3", 470, 720, { size: 200, fill: PAL.orange, shadow: PAL.ink, strokeW: 22, rot: .1, scale: E.outBack(inv(.6, .8, bt)) });
  },
};

/* ========== S6 百分大战 22–26 ========== */
const DUEL_KEYS = (face) => [[0, pose("crouchSet", { face })], [.25, pose("setShot", { face }), E.outCubic], [.35, pose("release", { face }), E.outQuint], [.7, pose("follow", { face })], [1, pose("crouchSet", { face })]];
const S6 = { b0: 22, vig: .7,
  shooter(bt, x, G, s, face, legend) {
    const ph = (bt + .35) % 1;
    let P = Object.assign({}, poseTrack(DUEL_KEYS(face), ph), { x, s, face });
    if (legend) Object.assign(P, { mouth: "tight", brow: 0 });
    P = groundPose(P, G);
    P.y -= Math.max(0, Math.sin(clmp((ph - .2) / .45) * Math.PI)) * 50 * s;
    return { P, ph };
  },
  gl(bt, f) {
    const c = { x: 960, y: 540, z: 1.03 + bt * .02, r: Math.sin(bt * 1.3) * .01 };
    withCam(c, () => {
      plate("cyber", 1400, 520, 1);
      flush();
      shape([[-200, -200], [1150, -200], [800, 1300], [-200, 1300]], { fill: PAL.paper, ink: null });
      burst("burstO", 480, 520, 1300, 1, bt * .3);
      boil(7);
      const a = this.shooter(bt, 470, 990, 1.0, 1, false), b = this.shooter(bt, 1460, 1000, 1.12, -1, true);
      drawBlox(a.P, { noBall: a.ph > .35 && a.ph < .95 });
      const L = drawLegend(b.P);
      const hb = b.ph < .35 || b.ph > .95;
      if (hb) { const bp = ballPos(Object.assign({}, b.P, { ballAt: b.P.ballAt || "set" })); if (bp && b.P.ballAt) drawBall(bp[0], bp[1], 36 * 1.12, 0, 3); }
      for (const [s, dir] of [[a, 1], [b, -1]]) if (s.ph > .35 && s.ph < .8) {
        const u = (s.ph - .35) / .45, J = joints(s.P), h = J.armF[2];
        drawBall(h[0] + dir * u * 300, h[1] - 60 - u * 700, 36 * s.P.s, u * 9, 3);
      }
      // VS 闪电
      boil(8);
      const bolt = [[1150, -100], [1010, 300], [1080, 330], [930, 700], [1000, 720], [820, 1180]];
      poly(bolt, 16, PAL.yellow, "marker", 0);
      poly(bolt, 3, PAL.ink, "pen", 0);
      flush();
      legendGlow(L, 1.12);
    });
  },
  ov(ctx, bt) {
    const A = [64, 70, 76, 82, 88], B = [71, 76, 81, 86, 91];
    const i = clmp(Math.floor(bt), 0, 3), t = E.outCubic(inv(i, i + .3, bt));
    const va = lrp(A[i], A[i + 1], t), vb = lrp(B[i], B[i + 1], t);
    pctBar(ctx, 470, 990, 760, va, PAL.orange, Math.round(va) + "%", false);
    pctBar(ctx, 1450, 990, 760, vb, PAL.cyan, Math.round(vb) + "%", true);
    inkText(ctx, "VS", 975, 520, { size: 190, fill: PAL.white, shadow: PAL.red, strokeW: 22, rot: -.1, scale: 1 + Math.max(0, .15 - (bt % 1)) * 1.2 });
    inkText(ctx, "先到 100 就赢", 960, 70, { size: 58, font: "ZCOOL QingKe HuangYou", fill: PAL.yellow, strokeW: 10, shadow: PAL.ink, alpha: inv(.2, .6, bt) });
  },
};

/* ========== S7 RACK RUSH 26–30 ========== */
const RACK_T = [0, 1, 2, 2.5, 3, 3.5];
const S7 = { b0: 26, vig: .6,
  HOOP: [1640, 380], X: 780, G: 960,
  phase(bt) {
    for (let i = RACK_T.length - 1; i >= 0; i--) {
      const gap = i ? RACK_T[i] - RACK_T[i - 1] : 1;
      if (bt >= RACK_T[i] - gap * .5) return { i, d: (bt - RACK_T[i]) / gap };
    }
    return { i: 0, d: -.5 };
  },
  P(bt) {
    const { d } = this.phase(bt);
    const K = [[-.5, pose("catchChest", { turn: .4 })], [-.25, pose("setShot"), E.outCubic], [-.04, pose("setShot", { torso: 2 })], [0, pose("release"), E.outQuint], [.5, pose("follow")]];
    const P = Object.assign({}, poseTrack(K, d), { x: this.X, s: .95, mouth: bt > 2.3 ? "shout" : "tight" });
    return groundPose(P, this.G);
  },
  gl(bt, f) {
    const c = { x: 940 + bt * 18, y: 560, z: 1.0 + bt * .02 };
    withCam(c, () => {
      burst("burstY", 1100, 450, 1900, 1, .5);
      boil(9);
      shape([[-300, this.G + 10], [2300, this.G], [2300, 1400], [-300, 1400]], { fill: "#e7c48f", ink: PAL.ink, w: 2.4 });
      line2(1640, 380, 1640, 400, 1);
      shape([[1860, 250], [1890, 250], [1890, this.G + 5], [1860, this.G + 5]], { fill: PAL.steel, w: 2.4 });
      shape([[1700, 240], [1880, 240], [1880, 270], [1700, 270]], { fill: PAL.steel, w: 2.4 });
      const [hx, hy] = this.HOOP;
      push(); translate(hx, hy); scale(-1, 1); translate(-hx, -hy);   // 侧视篮板
      pop();
      shape([[1790, 90], [1810, 90], [1810, 420], [1790, 420]], { fill: PAL.white, w: 3 });
      hoopBack(hx, hy, .75, { board: false });
      const out = rackMachine(260, this.G, .95, f);
      const P = this.P(bt), J = drawBlox(P, { noBall: true });
      const { i, d } = this.phase(bt);
      // 供球：出球口 → 胸口
      if (d < 0) {
        const u = clmp((d + .5) / .25), chest = ballPos(Object.assign({}, P, { ballAt: "chest" }), J);
        const tgt = d < -.25 ? chest : ballPos(P, J) || chest;
        const bx = lrp(out[0], tgt[0], E.outCubic(u)), by = lrp(out[1], tgt[1], E.outCubic(u)) - Math.sin(u * Math.PI) * 40;
        drawBall(bx, by, 34, f * .4, 2.6);
      }
      // 空中的球 + 墨线抛物线
      for (let k = 0; k < RACK_T.length; k++) {
        const t = (bt - RACK_T[k]) / .85;
        if (t < 0 || t > 1.25) continue;
        const sx = this.X + 60, sy = this.G - 640, ex = hx, ey = hy + 10, peak = 300;
        const at = (u) => [lrp(sx, ex, u), lrp(sy, ey, u) - peak * 4 * u * (1 - u)];
        const trail = [];
        for (let q = Math.max(0, t - .5); q <= Math.min(1, t); q += .06) trail.push(at(q));
        if (trail.length > 1) poly(trail, 1.4, PAL.ink, "pen", .5);
        const p = t <= 1 ? at(t) : [ex, ey + (t - 1) * 900];
        drawBall(p[0], p[1], 34, t * 8, 2.6);
      }
      const net = RACK_T.some(T => { const t = (bt - T) / .85; return t > 1 && t < 1.25; });
      hoopFront(hx, hy, .75, net ? .8 : 0, net ? .8 : .2, f);
      if (bt > 2.3) motionLines(J.armF[2][0] - 60, J.armF[2][1] + 160, J.armF[2][0], J.armF[2][1], 6, 70, Math.floor(f / 2), PAL.ink, 1);
    });
  },
  ov(ctx, bt) {
    let score = 0;
    RACK_T.forEach((T, k) => { if (bt >= T + .85) score += k === 4 ? 3 : 2; });
    inkText(ctx, "RACK RUSH", 280, 90, { size: 88, fill: PAL.yellow, shadow: PAL.magenta, strokeW: 12, rot: -.04 });
    inkText(ctx, String(score).padStart(2, "0"), 1700, 110, { size: 150, fill: PAL.white, shadow: PAL.orange, strokeW: 16, scale: 1 + Math.max(0, .2 - ((bt - .85) % .5 + .5) % .5) * 1.4 });
    if (bt > 2.4) inkText(ctx, "FINAL RUSH", 1600, 230, { size: 64, fill: PAL.red, shadow: PAL.ink, strokeW: 9, rot: .05, alpha: (Math.floor(bt * 4) % 2) ? 1 : .55 });
  },
};

/* ========== S8 热手 × 世界球场 30–36 ========== */
const WORLDS = ["forest", "coast", "med", "cyber"];
const S8 = { b0: 30, vig: .7,
  gl(bt, f) {
    if (bt < 2) {
      const c = { x: 960, y: 560, z: 1 + bt * .07 };
      withCam(c, () => {
        rectA(-200, -200, 2400, 1500, mixHex(PAL.paper, "#2a0d10", E.inOutCubic(inv(0, 1.6, bt)) * .85));
        burst("burstO", 960, 520, 1700, (bt - .2) * 1.6);
        boil(10);
        if (bt > 1.4) speedLines(960, 500, 460, 1500, 48, 13 + Math.floor(f / 2), PAL.orange, 1.6);
        let P = pose("setShot", { x: 960, s: 1.55, turn: .05, face: 1, eye: bt > .8 ? "fire" : "open", brow: -18, mouth: bt > 1.5 ? "shout" : "tight", tails: bt * 2 });
        P = groundPose(P, 1160);
        P.y += Math.sin(bt * 5) * 4;
        const J = joints(P), bp = ballPos(P, J);
        const fh = E.outBack(inv(.1, .8, bt)) * (bt > 1.5 ? 1.35 : 1);
        if (fh > 0) flame(bp[0], bp[1] + 40, 560 * fh, f, 0);
        drawBlox(P);
        if (fh > 0) { flame(J.armB[2][0], J.armB[2][1] + 30, 260 * fh, f, 1); }
      });
      return;
    }
    const k = Math.min(3, Math.floor(bt - 2)), u = bt - 2 - k;
    const c = { x: 960, y: 560, z: 1.08 + (bt - 2) * .03, r: Math.sin((bt - 2) * .8) * .025 };
    withCam(c, () => {
      plate(WORLDS[k], 960 + lrp(90, -90, u), 560 + (k === 3 ? 20 : 0), 1);
      boil(11 + k);
      let P = pose("release", { x: 960, s: 1.12, face: k % 2 ? -1 : 1, eye: "fire", brow: -16, mouth: "tight", ballAt: "hand", hand: "palm", tails: bt * 2, spin: bt * 6 });
      P = groundPose(P, 1000);
      P.y -= 120 + Math.sin(bt * 2) * 10;
      shape(blobPts(P.x, 1000, 180 - 10, 26, 12, .05, 2), { fill: "#000", fillA: 60, ink: null });
      const J = joints(P), bp = ballPos(P, J);
      flame(bp[0], bp[1] + 30, 420, f, k);
      drawBlox(P);
      if (u < .18) { const q = u / .18; for (let i = 0; i < 26; i++) { const y = hash(i * 3 + k) * H; line2(-200 + q * 400, y, W * (1 - q) + 400, y, 2 + hash(i + k) * 5, i % 2 ? PAL.ink : PAL.white, "marker"); } }
    });
  },
  ov(ctx, bt) {
    if (bt > .9 && bt < 2) inkText(ctx, "HOT HAND", 1500, 250, { size: 130, fill: PAL.yellow, shadow: PAL.red, strokeW: 16, rot: .08, scale: E.outBack(inv(.9, 1.1, bt)) });
    if (bt >= 2) {
      const k = Math.min(3, Math.floor(bt - 2)), names = ["雨林峡谷", "湘南海岸", "地中海半岛", "赛博主场"];
      inkText(ctx, names[k], 250, 980, { size: 64, font: "ZCOOL QingKe HuangYou", fill: PAL.white, shadow: PAL.ink, shadowD: 5, strokeW: 10, align: "left", scale: E.outBack(inv(0, .12, (bt - 2) % 1)) });
    }
  },
};

/* ========== S9 装备 36–40 ========== */
const S9 = { b0: 36, vig: .8,
  gl(bt, f) {
    const k = Math.min(3, Math.floor(bt)), u = bt - k;
    const c = { x: 960, y: 540, z: 1 + u * .06 };
    withCam(c, () => {
      if (k === 0) {
        burst("burstY", 960, 560, 1800, 1, .2);
        boil(14);
        const G = 900, drop = E.inCubic(inv(0, .16, u)), y = lrp(-500, G - 70, drop);
        const ank = [960, y], knee = [900, y - 700];
        drawTube([[knee[0], knee[1] - 200], knee, ank], [120, 100, 80], PAL.skin, 6);
        shape(capsule(ank[0] - 40, ank[1] - 60, 90, ank[0], ank[1], 88), { fill: PAL.white, w: 5 });
        drawShoe(ank, knee, 4.2, 1, 7);
        if (u > .16) {
          const d = inv(.16, .9, u);
          for (const s of [-1, 1]) for (let i = 0; i < 4; i++) shape(blobPts(960 + s * (240 + d * 420 + i * 60), G + 20 - i * 30 * d, 70 + d * 60 - i * 10, 50 + d * 30, 10, .2, i + 4 * (s + 2)), { fill: "#c9b79a", fillA: 200 * (1 - d), ink: PAL.ink, w: 2 * (1 - d) + .3, curv: .6 });
          motionLines(960, G - 20, 960, G - 400, 10, 520, 3, PAL.ink, 1.2);
        }
      } else if (k === 1) {
        burst("burstT", 960, 560, 1800, 1, 1.2);
        boil(15);
        drawTube([[-100, 620], [800, 560], [1560, 520]], [120, 105, 95], PAL.skin, 6);
        shape(blobPts(1690, 520, 150, 125, 12, .07, 4), { fill: PAL.skin, w: 6, curv: .6 });
        const bx = lrp(300, 1260, E.outBack(inv(0, .3, u), 1.6));
        shape(capsule(bx - 70, 540, 120, bx + 70, 530, 112, 6), { fill: PAL.red, w: 6 });
        line2(bx - 60, 460, bx + 60, 450, 3, PAL.white, "marker");
        motionLines(bx - 700, 540, bx - 120, 540, 10, 220, 4, PAL.ink, 1.3);
      } else if (k === 2) {
        burst("burstM", 960, 560, 1800, 1, 2.2);
        boil(16);
        const P = pose("lookUp", { s: 3.3, turn: -.5, face: 1, brow: -14, eye: "open", mouth: "tight", tails: u * 30 });
        const J = joints(P), dx = 960 - J.headC[0], dy = 600 - J.headC[1];
        const Q = Object.assign({}, P, { x: P.x + dx, y: P.y + dy });
        drawBloxHead(Q, joints(Q), 7);
        if (u < .5) speedLines(960, 600, 520, 1100, 18, 3, PAL.ink, 2);
      } else {
        rectA(-200, -200, 2400, 1500, mixHex(PAL.paper, "#1b1d3a", E.inCubic(u) * .9));
        boil(17);
        const P = groundPose(pose("lookUp", { x: 960, s: 2.2, turn: 0, eye: u > .5 ? "open" : "squint", brow: -22, head: lrp(20, -4, E.outCubic(u)) }), 1560);
        drawBlox(P, { noBall: true });
      }
    });
  },
  ov(ctx, bt) {
    const k = Math.min(3, Math.floor(bt)), u = bt - k;
    const lab = ["球鞋", "护腕", "头带"][k];
    if (lab) inkText(ctx, lab, 1560, 170, { size: 110, font: "ZCOOL QingKe HuangYou", fill: PAL.white, shadow: PAL.ink, shadowD: 7, strokeW: 14, rot: .06, scale: E.outBack(inv(.05, .2, u)) });
    if (k === 2 && u > .05 && u < .5) inkText(ctx, "SNAP!", 520, 280, { size: 150, fill: PAL.yellow, shadow: PAL.red, strokeW: 16, rot: -.15, scale: E.outBack(inv(.05, .2, u)) });
  },
};

/* ========== S10 最后 3 秒 40–44 ========== */
function clockStr(t) { return t <= 0 ? "0.0" : t.toFixed(1); }
const S10 = { b0: 40, vig: 1.2,
  gl(bt, f) {
    const c = { x: 960, y: 640, z: 1 + E.inOutCubic(bt / 4) * .16, r: .02 };
    withCam(c, () => {
      plate("arena", 960, 700, 1);
      boil(18);
      shape(blobPts(1300, 1105, 300, 30, 12, .05, 3), { fill: "#000", fillA: 90, ink: null });
      let L = pose("stand", { x: lrp(1400, 1260, E.inOutCubic(bt / 4)), s: 1.4, face: -1, open: .8, aF1: 75, aF2: 110, aB1: -75, aB2: -110, lF1: 22, lF2: -4, lB1: -22, lB2: 4, torso: 10 });
      L = groundPose(L, 1110);
      L.y += Math.sin(bt * Math.PI) * 6;
      let P = pose("crouchSet", { x: lrp(720, 620, E.outCubic(bt / 4)), s: .95, turn: .3, sweat: (bt % 1), eye: "open", brow: -20, look: [.6, -.2] });
      P = groundPose(P, 1080);
      drawBlox(P);
      const Lg = drawLegend(L);
      flush();
      legendGlow(Lg, 1.4, .8 + Math.sin(f * .4) * .2);
    });
  },
  ov(ctx, bt, f) {
    scoreboard(ctx, 960, 118, 97, 99, clockStr(3 - bt / 4 * 1.5));
    const d = bt % 1;
    if (d < .35) { ctx.save(); const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H); g.addColorStop(0, "rgba(232,35,58,0)"); g.addColorStop(1, `rgba(232,35,58,${.45 * (1 - d / .35)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
};

/* ========== S11 起跳 44–48 ========== */
const S11 = { b0: 44, vig: 1.1,
  P(bt) {
    const K = [[0, pose("crouchSet")], [1.6, pose("setShot"), E.inOutCubic], [2.95, pose("setShot", { torso: -4 })], [3.05, pose("release"), E.outQuint], [4, pose("follow")]];
    let P = Object.assign({}, poseTrack(K, bt), { x: 760, s: 1.05, brow: -22, mouth: "tight", tails: bt * .6 });
    P = groundPose(P, 1080);
    P.y -= E.outCubic(inv(1, 3.2, bt)) * 190 - E.inQuad(inv(3.3, 4, bt)) * 20;
    return P;
  },
  cam(bt, P) {
    const base = { x: lrp(900, 1000, bt / 4), y: lrp(650, 560, bt / 4), z: lrp(1.12, 1.3, bt / 4), r: lrp(-.05, .03, bt / 4) };
    if (bt < 3) return base;
    const J = joints(P), h = J.armF[2], k = E.inOutQuint(inv(3, 3.9, bt));
    return { x: lrp(base.x, h[0] + 60, k), y: lrp(base.y, h[1] - 60, k), z: lrp(base.z, 2.4, k), r: lrp(base.r, -.02, k) };
  },
  gl(bt, f) {
    const P = this.P(bt), c = this.cam(bt, P);
    withCam(c, () => {
      plate("arena", 960, 700, 1);
      boil(19);
      let L = pose("release", { x: 1130, s: 1.4, face: -1, aF1: 165, aF2: 165, aB1: 130, aB2: 150, lF1: 30, lF2: -10, lB1: -10, lB2: -30, torso: -14 });
      L = groundPose(L, 1110);
      L.y -= E.outCubic(inv(1.3, 3.4, bt)) * 220;
      const Lg = drawLegend(L);
      const J = drawBlox(P, { noBall: bt >= 3.05 });
      if (bt >= 3.05) {
        const u = bt - 3.05, h = J.armF[2];
        motionLines(h[0] - 10, h[1] + 30, h[0] + 60 + u * 180, h[1] - 90 - u * 220, 6, 50, 2, PAL.white, 1.2, "marker");
        drawBall(h[0] + 60 + u * 180, h[1] - 90 - u * 220, 36 * 1.05, u * 3, 3);
      }
      flush();
      legendGlow(Lg, 1.4);
    });
  },
  ov(ctx, bt) {
    halftone(ctx, .16);
    panelFrame(ctx, 34, 14);
    const t = Math.max(0, 1.5 - bt / 3.9 * 1.5);
    scoreboard(ctx, 960, 130, 97, 99, clockStr(t), { scale: .8, clockCol: t <= 0 ? "#ff4040" : PAL.red });
    if (bt > 3.9) { ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = `rgba(255,40,60,${.5 * (1 - inv(3.9, 4, bt))})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
};

/* ========== S12 爆发 48–56 ========== */
const S12 = { b0: 48, vig: .9,
  HOOP: [1850, 440],
  ball(bt) {
    const u = clmp(bt / 2), [hx, hy] = this.HOOP;
    if (bt <= 2) return [lrp(760, hx, u), lrp(520, hy + 22, u) - 420 * 4 * u * (1 - u)];
    return [hx, hy + 22 + (bt - 2) * 700];
  },
  gl(bt, f) {
    if (bt < 3) {
      const b = this.ball(Math.min(bt, 2)), [hx, hy] = this.HOOP;
      const follow = bt < 1.6 ? 1 : 1 - E.inOutCubic(inv(1.6, 2, bt));
      const c = { x: lrp(hx - 40, b[0] + 120, follow), y: lrp(hy + 120, b[1] + 40, follow), z: lrp(1.25, 1.7, follow) + (bt > 2 ? (bt - 2) * .06 : 0), r: follow * -.04 };
      darkBG("#1a1b3c");
      withCam(c, () => {
        plate("arena", 1300, 640, 1.45);
        if (bt > 2) { const e = bt - 2; burst("burstO", hx, hy + 60, 2600, e * 1.3, 0, true); burst("burstM", hx - 300, hy - 100, 1800, (e - .05) * 1.4, 1, true); burst("burstY", hx + 200, hy + 200, 1500, (e - .1) * 1.5, 2, true); }
        boil(20);
        if (bt > 2) speedLines(hx, hy + 60, 300, 1500, 56, 17 + Math.floor(f / 2), PAL.ink, 1.6);
        hoopBack(hx, hy, 1.2);
        const bb = this.ball(bt);
        if (bt < 2) {
          const tr = [];
          for (let q = Math.max(0, bt - .7); q <= bt; q += .05) tr.push(this.ball(q));
          if (tr.length > 1) { poly(tr, 6, PAL.white, "marker", .5); poly(tr, 1.4, PAL.ink, "pen", .5); }
        }
        if (bb[1] < hy + 700) drawBall(bb[0], bb[1], 44, bt * 2.2, 3);
        const st = bt > 2 && bt < 2.6 ? Math.sin(inv(2, 2.6, bt) * Math.PI) : 0;
        hoopFront(hx, hy, 1.2, st, bt > 2 ? Math.max(0, 1.4 - (bt - 2)) : 0, f);
        if (bt > 2) { confetti(hx, hy + 60, 70, (bt - 2) * .9, 5, 1400); burstDots(hx, hy + 60, 1200, 31, inv(2, 2.8, bt), PAL.ink, 40); }
      });
      return;
    }
    const u = bt - 3;
    const c = { x: 960, y: 560, z: 1.02 + u * .02 };
    withCam(c, () => {
      plate("arena", 960, 560, 1.1);
      burst("burstO", 960, 440, 2000, 1, .3, true);
      burst("burstM", 400, 300, 1100, 1, 1.4, true);
      burst("burstY", 1500, 360, 1100, 1, 2.4, true);
      boil(21);
      speedLines(960, 400, 440, 1500, 60, 23 + Math.floor(f / 2), PAL.ink, 1.8);
      const P = groundPose(pose("roar", { x: 960, s: 2.1, tails: bt * 3, eye: u > 1.8 && u < 2.1 ? "open" : "closed" }), 1480);
      P.y += Math.sin(u * 7) * 6;
      drawBlox(P, { noBall: true });
      confetti(960, -300, 90, .4 + u * .25, 9, 900);
      crowdFG(1150, f, "#130d20", 3, 1);
    });
  },
  ov(ctx, bt) {
    if (bt > 2.05) {
      const k = E.outBack(inv(2.05, 2.3, bt));
      scoreboard(ctx, 960, 118, 100, 99, "0.0", { scale: k * (bt < 3 ? 1 : .8) });
    } else scoreboard(ctx, 960, 118, 97, 99, "0.0", { scale: .8 });
    if (bt > 2.1 && bt < 3) inkText(ctx, "100!", 700, 760, { size: 300, fill: PAL.yellow, shadow: PAL.magenta, strokeW: 30, rot: -.1, scale: E.outBack(inv(2.1, 2.3, bt)) });
    if (bt > 7.45) inkWipe(ctx, inv(7.45, 8, bt), PAL.ink, 5);
  },
};

/* ========== S13–14 结尾卡 56–72 ========== */
const S13 = { b0: 56, vig: .45,
  endBall(bt) {
    // 拍 68 从左下弹进，三次落地后滚停
    const t = bt - 11.6;
    if (t < 0) return null;
    const G = 1000, R = 40, keys = [[0, -120, 700], [.4, 180, G - R], [1.2, 300, G - R], [1.8, 350, G - R], [2.2, 370, G - R]];
    const x = t < 2.2 ? track(keys.map(k => [k[0], k[1], E.lin]), t) : 370 + (1 - Math.exp(-(t - 2.2) * 2)) * 40;
    let y = G - R;
    if (t < .4) y = lrp(700, G - R, E.inQuad(t / .4));
    else if (t < 1.2) { const u = (t - .4) / .8; y = G - R - 160 * 4 * u * (1 - u); }
    else if (t < 1.8) { const u = (t - 1.2) / .6; y = G - R - 70 * 4 * u * (1 - u); }
    return { x, y, rot: x / R };
  },
  gl(bt, f) {
    const c = { x: 960, y: 540, z: 1 + bt * .004 };
    withCam(c, () => {
      plate("paperbloom", 960, 540, 1);
      boil(22);
      drawLogo(930, 300, 320, clmp((bt - .5) / 2.1), { shadow: PAL.orange });
      const P = groundPose(pose("spinBall", { x: 1640, s: .82, turn: -.15, blink: bt > 5 && bt < 5.25 ? 1 : 0, spin: bt * 9, tails: bt }), 1010);
      P.y += Math.sin(bt * Math.PI / 2) * 5;
      if (bt > 1) drawBlox(Object.assign(P, { x: lrp(2300, 1640, E.outBack(inv(1, 1.6, bt))) }));
      const b = this.endBall(bt);
      if (b) { shape(blobPts(b.x, 1002, 38, 8, 10, .05, 1), { fill: "#000", fillA: 50, ink: null }); drawBall(b.x, b.y, 40, b.rot, 2.4); }
    });
  },
  ov(ctx, bt) {
    if (bt < .6) inkWipe(ctx, 1 + bt / .6, PAL.ink, 5);
    if (bt > 2.5) {
      const k = inv(2.5, 3.2, bt);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 560 + k * 900, H); ctx.clip();
      inkText(ctx, "百分大战", 930, 560, { size: 170, font: "Zhi Mang Xing", fill: PAL.red, shadow: PAL.ink, shadowD: 6, stroke: false });
      ctx.restore();
    }
    if (bt >= 4) {
      const k = inv(4, 4.12, bt), sc = lrp(2, 1, E.outQuad(k));
      ctx.save(); ctx.translate(930, 730); ctx.scale(sc, sc);
      stampBox(ctx, 0, 0, 760, 128, PAL.ink, .02, clmp(k * 3));
      inkText(ctx, "先到 100，就是王。", 0, 4, { size: 88, font: "Zhi Mang Xing", fill: PAL.yellow, stroke: false, shadow: PAL.red, shadowD: 4, rot: .02, alpha: clmp(k * 3) });
      ctx.restore();
    }
    if (bt >= 8) {
      const a = inv(8, 8.5, bt), y = lrp(900, 880, E.outCubic(a));
      inkText(ctx, "免费开玩 · 打开浏览器就能投", 930, y, { size: 58, font: "ZCOOL QingKe HuangYou", fill: PAL.ink, stroke: false, shadow: PAL.orange, shadowD: 3, alpha: a });
      inkText(ctx, "aiba-percent-battle.vercel.app", 930, y + 78, { size: 40, font: "Permanent Marker", fill: PAL.navy, stroke: false, shadow: false, alpha: inv(8.4, 8.9, bt) });
    }
  },
  fade(bt) { return E.inOutCubic(inv(15.2, 16, bt)) * .85; },
};

const SHOTS = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13];
