/* 03-post — 2D 合成：×3 像素放大、马赛克转场、扫描线、卡点震动/反相，
   以及游戏 UI 语言的 HUD（黑底面板 + Orbitron + 3px 硬投影 + 像素大字 + 金色方块粒子）。 */
(function (TR) {
  "use strict";
  const { W, H, RW, RH, PAL, clamp, lerp, inv, E, rng } = TR;
  const PX = W / RW;                 // 3
  const FONT = "Orbitron, 'Courier New', monospace";
  const CN = "'ZCOOL QingKe HuangYou', 'PingFang SC', 'Noto Sans CJK SC', sans-serif";
  let OUT, CTX, SCAN, VIG, TMP, TMPX, LOGO;
  const PASS = {};

  TR.initPost = async function () {
    OUT = document.createElement("canvas"); OUT.width = W; OUT.height = H; CTX = OUT.getContext("2d");
    TMP = document.createElement("canvas"); TMPX = TMP.getContext("2d");
    SCAN = document.createElement("canvas"); SCAN.width = W; SCAN.height = H;
    const s = SCAN.getContext("2d"); s.fillStyle = "rgba(0,0,0,.2)";
    for (let y = 2; y < H; y += PX) s.fillRect(0, y, W, 1);
    VIG = document.createElement("canvas"); VIG.width = W; VIG.height = H;
    const v = VIG.getContext("2d"), g = v.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, H * 1.02);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.62)"); v.fillStyle = g; v.fillRect(0, 0, W, H);
    LOGO = new Image(); LOGO.src = "/assets/aiba-brand/aiba-percent-battle-logo-v3.png";
    await LOGO.decode();
    TR.OUT = OUT;
  };

  /* ---------- 渲染通道 ---------- */
  TR.copyPass = function (name) {
    const c = PASS[name] || (PASS[name] = Object.assign(document.createElement("canvas"), { width: RW, height: RH }));
    c.getContext("2d").drawImage(renderer.domElement, 0, 0, RW, RH);
  };
  TR.drawPass = function (ctx, name, dx = 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(name ? PASS[name] : renderer.domElement, 0, 0, RW, RH, dx, 0, W, H);
  };

  /* ---------- 卡点 ---------- */
  function cueFx(f) {
    let sx = 0, sy = 0, z = 0, inv_ = false, flash = null;
    for (const c of TR.CUES) {
      const d = f - TR.frameOf(c.b);
      if (c.shake) { const s = TR.shakeAt(d, c.shake, c.sdur || 8, c.b * 3); sx += s[0]; sy += s[1]; }
      if (c.punch && d >= 0 && d < 10) z += c.punch * Math.pow(1 - d / 10, 3);
      if (c.invert && d >= 0 && d < c.invert) inv_ = true;
      if (c.flash && d >= 0 && d < 5) flash = { a: c.flash * Math.pow(1 - d / 5, 2), col: c.flashCol || "255,244,210" };
    }
    // 像素对齐：震动按 3px 步进，保持方块边缘干净
    return { sx: Math.round(sx / PX) * PX, sy: Math.round(sy / PX) * PX, z, inv: inv_, flash };
  }

  TR.composite = function (f, shot, bt) {
    const ctx = CTX, fx = cueFx(f);
    TR.mosaicK = TR.mosaicK || 1; TR.fadeBlack = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, H);
    const z = 1 + fx.z + (Math.abs(fx.sx) + Math.abs(fx.sy)) / 1400;
    ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z) + fx.sx, H / 2 * (1 - z) + fx.sy);
    if (shot.compose) shot.compose(ctx, bt, f); else TR.drawPass(ctx, null);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(SCAN, 0, 0);
    ctx.drawImage(VIG, 0, 0);
    ctx.save();
    ctx.translate(fx.sx * .5, fx.sy * .5);
    if (shot.ov) shot.ov(ctx, bt, f);
    ctx.restore();
    if (TR.mosaicK > 1) mosaic(ctx, TR.mosaicK);
    if (fx.inv) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
    if (fx.flash) { ctx.globalCompositeOperation = "screen"; ctx.fillStyle = `rgba(${fx.flash.col},${fx.flash.a})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
    if (TR.fadeBlack > 0) { ctx.fillStyle = `rgba(4,5,10,${TR.fadeBlack})`; ctx.fillRect(0, 0, W, H); }
    return OUT;
  };
  function mosaic(ctx, k) {
    const w = Math.max(1, Math.round(W / (PX * k))), h = Math.max(1, Math.round(H / (PX * k)));
    TMP.width = w; TMP.height = h;
    TMPX.imageSmoothingEnabled = true; TMPX.drawImage(OUT, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(TMP, 0, 0, w, h, 0, 0, W, H);
  }

  /* ---------- 文字 ---------- */
  function txt(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 900} ${o.size || 40}px ${o.font || FONT}`;
    ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
    if (o.spacing) ctx.letterSpacing = o.spacing + "px";
    ctx.globalAlpha = o.alpha ?? 1;
    const d = o.shadow ?? 3;
    if (d) { ctx.fillStyle = "#000"; ctx.fillText(s, x + d, y + d); }
    ctx.fillStyle = o.color || PAL.white; ctx.fillText(s, x, y);
    ctx.restore();
  }
  TR.txt = txt;
  /* 像素大字：先在 1/4 尺寸画，再最近邻放大 → 方块边缘 */
  const BIG = document.createElement("canvas"), BIGX = BIG.getContext("2d");
  TR.bigText = function (ctx, s, x, y, size, color, rot = 0, sc = 1, shadowCol = "#000", font = FONT) {
    if (sc <= 0) return;
    const k = 4, fs = size / k;
    BIGX.font = `900 ${fs}px ${font}`;
    const tw = Math.ceil(BIGX.measureText(s).width) + 8, th = Math.ceil(fs * 1.5) + 8;
    BIG.width = tw; BIG.height = th;
    BIGX.font = `900 ${fs}px ${font}`; BIGX.textBaseline = "middle"; BIGX.textAlign = "center";
    BIGX.fillStyle = "#000"; BIGX.fillText(s, tw / 2 + 1.5, th / 2 + 1.5);
    BIGX.fillStyle = shadowCol; BIGX.fillText(s, tw / 2 + .75, th / 2 + .75);
    BIGX.fillStyle = color; BIGX.fillText(s, tw / 2, th / 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(BIG, -tw * k / 2, -th * k / 2, tw * k, th * k);
    ctx.restore();
  };
  function panel(ctx, x, y, w, h, o = {}) {
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = o.fill || PAL.panel;
    ctx.strokeStyle = o.edge || PAL.edge; ctx.lineWidth = o.lw || 3;
    const r = o.r ?? 8;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
    if (o.accent) { ctx.fillStyle = o.accent; ctx.fillRect(x, y + r, 6, h - r * 2); }
    ctx.restore();
  }
  TR.panel = panel;

  /* ---------- 像素粒子 ---------- */
  const snap = v => Math.round(v / PX) * PX;
  TR.goldBurst = function (ctx, x, y, t, scale = 1, seed = 1, n = 70) {
    const r = rng(seed * 97), cols = [PAL.gold, PAL.gold, "#fff3b0", PAL.white, PAL.cyan];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, v = (240 + r() * 760) * scale, s = PX * (1 + Math.floor(r() * 4));
      const px = x + Math.cos(a) * v * E.outCubic(t), py = y + Math.sin(a) * v * E.outCubic(t) + 520 * t * t * scale;
      const al = 1 - t;
      if (al <= 0) continue;
      ctx.globalAlpha = al; ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(snap(px), snap(py), s, s);
    }
    ctx.globalAlpha = 1;
  };
  /* 贴地冲击环：一圈方块 */
  TR.pixelRing = function (ctx, x, y, t, scale = 1, seed = 1) {
    const r = rng(seed), n = 56, R = (60 + 820 * E.outCubic(t)) * scale;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * .05, s = PX * (1 + (i % 3));
      ctx.globalAlpha = (1 - t) * (.6 + r() * .4); ctx.fillStyle = i % 4 ? PAL.gold : PAL.white;
      ctx.fillRect(snap(x + Math.cos(a) * R), snap(y + Math.sin(a) * R * .22), s, s);
    }
    ctx.globalAlpha = 1;
  };
  TR.sparkle = function (ctx, x, y, t, s) {
    const k = Math.sin(t * Math.PI) * s;
    ctx.fillStyle = PAL.white;
    for (let i = -3; i <= 3; i++) { const w = (4 - Math.abs(i)) * PX; ctx.fillRect(snap(x - w / 2), snap(y + i * k / 6), w, PX); ctx.fillRect(snap(x + i * k / 6), snap(y - w / 2), PX, w); }
  };
  /* 甩镜横线 */
  TR.streaks = function (ctx, t, vertical) {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const p = r() * (vertical ? W : H), l = 200 + r() * 700, w = PX * (1 + Math.floor(r() * 3));
      ctx.globalAlpha = (1 - Math.abs(t - .5) * 2) * .8; ctx.fillStyle = i % 3 ? "#fff" : PAL.cyan;
      if (vertical) ctx.fillRect(snap(p), snap(H * (1 - t) - l / 2 + r() * 300), w, l);
      else ctx.fillRect(snap(W * t - l / 2 + r() * 300), snap(p), l, w);
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- Logo（游戏原版 PNG）+ 高光扫过 ---------- */
  const LG = document.createElement("canvas"), LGX = LG.getContext("2d");
  TR.logo = function (ctx, x, y, w, alpha = 1, shine) {
    const h = w * LOGO.height / LOGO.width;
    LG.width = LOGO.width; LG.height = LOGO.height;
    LGX.drawImage(LOGO, 0, 0);
    if (shine != null) {
      LGX.globalCompositeOperation = "source-atop";
      const sx = lerp(-300, LOGO.width + 300, shine), g = LGX.createLinearGradient(sx - 120, 0, sx + 120, LOGO.height * .4);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,240,.85)"); g.addColorStop(1, "rgba(255,255,255,0)");
      LGX.fillStyle = g; LGX.fillRect(0, 0, LOGO.width, LOGO.height);
      LGX.globalCompositeOperation = "source-over";
    }
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(LG, x - w / 2, y - h / 2, w, h);
    ctx.restore();
  };

  /* ---------- HUD 组件 ---------- */
  TR.tagPanel = function (ctx, x, y, en, cn, sc = 1, s = 1) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * s, sc * s);
    panel(ctx, -330, -62, 660, 124, { accent: PAL.gold });
    txt(ctx, en, 0, -20, { size: 44, color: PAL.gold, spacing: 6 });
    txt(ctx, cn, 0, 32, { size: 34, font: CN, weight: 400, color: PAL.white });
    ctx.restore();
  };
  TR.placeTag = function (ctx, name, sc) {
    ctx.save(); ctx.translate(90, 960); ctx.scale(sc, sc);
    panel(ctx, 0, -46, 470, 92, { accent: PAL.cyan });
    txt(ctx, "WORLD COURT", 30, -18, { size: 20, color: PAL.cyan, align: "left", spacing: 4 });
    txt(ctx, name, 30, 20, { size: 40, font: CN, weight: 400, align: "left" });
    ctx.restore();
  };
  TR.battleHud = function (ctx, a, b, bt) {
    const x = W / 2, y = 90;
    panel(ctx, x - 520, y - 52, 1040, 150);
    txt(ctx, "你", x - 450, y - 8, { size: 44, font: CN, weight: 400, color: PAL.cyan });
    txt(ctx, "N-24", x + 440, y - 8, { size: 40, color: PAL.salmon });
    txt(ctx, String(a), x - 260, y - 6, { size: 76, color: PAL.gold });
    txt(ctx, String(b), x + 260, y - 6, { size: 76, color: PAL.salmon });
    txt(ctx, "VS", x, y - 6, { size: 44, color: PAL.white });
    // 百分进度条
    for (const [v, col, dir] of [[a, PAL.cyan, -1], [b, PAL.salmon, 1]]) {
      const w = 440 * v / 100, bx = dir < 0 ? x - 30 - w : x + 30;
      ctx.fillStyle = "#1a2233"; ctx.fillRect(dir < 0 ? x - 470 : x + 30, y + 58, 440, 18);
      ctx.fillStyle = col; ctx.fillRect(snap(bx), y + 58, snap(w), 18);
    }
    txt(ctx, "PERCENT BATTLE · 先到 100", x, y + 132, { size: 26, color: PAL.dim, font: FONT, spacing: 4 });
  };
  TR.rackHud = function (ctx, score, bt) {
    panel(ctx, 60, 50, 420, 120, { accent: PAL.green });
    txt(ctx, "RACK RUSH", 90, 88, { size: 40, color: PAL.green, align: "left", spacing: 3 });
    txt(ctx, "投篮机挑战", 92, 134, { size: 30, font: CN, weight: 400, align: "left", color: PAL.white });
    const pop = 1 + Math.max(0, .2 - (((bt - .85) % .5) + .5) % .5) * 1.4;
    TR.bigText(ctx, String(score).padStart(2, "0"), W - 200, 110, 150, PAL.green, 0, pop);
    if (bt > 2.4 && Math.floor(bt * 4) % 2) TR.bigText(ctx, "FINAL RUSH", W - 300, 240, 64, PAL.red, 0, 1);
  };
  TR.gearCard = function (ctx, g, sc) {
    if (sc <= 0) return;
    const [slot, name, desc, col] = g;
    ctx.save(); ctx.translate(W - 560, 720); ctx.scale(sc, sc);
    panel(ctx, 0, 0, 500, 230, { accent: PAL.gold });
    txt(ctx, "GEAR LAB · " + slot, 34, 40, { size: 22, color: PAL.gold, align: "left", spacing: 4 });
    ctx.fillStyle = col; ctx.fillRect(34, 76, 60, 60); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(34, 76, 60, 60);
    txt(ctx, name, 114, 106, { size: 44, font: CN, weight: 400, align: "left" });
    txt(ctx, desc, 34, 176, { size: 32, font: CN, weight: 400, align: "left", color: PAL.green });
    panel(ctx, 330, 22, 140, 38, { fill: PAL.gold, edge: PAL.gold, r: 4 });
    txt(ctx, "EQUIPPED", 400, 42, { size: 18, color: "#191c22", shadow: 0 });
    ctx.restore();
  };
  TR.clutchHud = function (ctx, a, b, clock, bt, sc = 1, win = false) {
    ctx.save(); ctx.translate(W / 2, 96); ctx.scale(sc, sc);
    panel(ctx, -360, -62, 720, 150, { edge: win ? PAL.gold : PAL.edge, lw: win ? 5 : 3 });
    txt(ctx, "你", -290, -24, { size: 30, font: CN, weight: 400, color: PAL.cyan });
    txt(ctx, "N-24", 290, -24, { size: 28, color: PAL.salmon });
    txt(ctx, String(a), -220, 22, { size: 84, color: win ? PAL.gold : PAL.white });
    txt(ctx, String(b), 220, 22, { size: 84, color: PAL.salmon });
    const blink = clock > 0 && clock < 2 && Math.floor(bt * 6) % 2;
    txt(ctx, clock <= 0 ? "0.0" : clock.toFixed(1), 0, 18, { size: 70, color: blink ? "#7a1a1a" : PAL.red });
    txt(ctx, "LAST SHOT", 0, -40, { size: 20, color: PAL.dim, spacing: 5 });
    ctx.restore();
  };
  TR.heartPulse = function (ctx, d) {
    if (d > .35) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H);
    g.addColorStop(0, "rgba(255,64,64,0)"); g.addColorStop(1, `rgba(255,64,64,${.42 * (1 - d / .35)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  TR.letterbox = function (ctx, h) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); };
  TR.slogan = function (ctx, x, y, s, sc) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    panel(ctx, -400, -58, 800, 116, { accent: PAL.gold, edge: PAL.gold });
    txt(ctx, s, 0, 4, { size: 64, font: CN, weight: 400, color: PAL.gold });
    ctx.restore();
  };
  TR.cta = function (ctx, x, y, a) {
    txt(ctx, "免费开玩 · 打开浏览器就能投", x, y, { size: 50, font: CN, weight: 400, alpha: a });
    txt(ctx, "aiba-percent-battle.vercel.app", x, y + 70, { size: 32, color: PAL.cyan, alpha: inv(.3, 1, a) * a, spacing: 2 });
  };
  TR.splitLine = function (ctx, x0, y0, x1, y1) {
    ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  };
  TR.camHud = function (ctx, bt) {
    const m = 60;
    ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 6;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [980, m, -1, 1], [m, H - m, 1, -1], [830, H - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + dy * 60); ctx.lineTo(x, y); ctx.lineTo(x + dx * 60, y); ctx.stroke();
    }
    ctx.restore();
    if (Math.floor(bt * 3) % 2 === 0) { ctx.fillStyle = PAL.red; ctx.fillRect(96, 96, 24, 24); }
    txt(ctx, "REC  CAM 01", 138, 110, { size: 28, align: "left", shadow: 2 });
    txt(ctx, "POSE TRACKING · LIVE", 100, H - 100, { size: 22, align: "left", color: PAL.cyan, shadow: 2, spacing: 3 });
  };
  /* 姿态骨架：投影到屏幕（在 A 通道渲染时调用） */
  TR.skeleton = function (g) {
    const P = (o, y = 0) => { o.updateMatrixWorld(true); return TR.project(o.localToWorld(new THREE.Vector3(0, y, 0))); };
    const head = P(g.headRoot, 1.62);
    const pts = {
      head, shR: P(g.arms[0]), shL: P(g.arms[1]), elR: P(g.elbows[0]), elL: P(g.elbows[1]), haR: P(g.handRoots[0]), haL: P(g.handRoots[1]),
      hiR: P(g.legs[0]), hiL: P(g.legs[1]), knR: P(g.knees[0]), knL: P(g.knees[1]), anR: P(g.ankles[0]), anL: P(g.ankles[1]),
    };
    return pts;
  };
  TR.drawSkeleton = function (ctx, s, dx = 0) {
    if (!s) return;
    const L = [["shR", "elR"], ["elR", "haR"], ["shL", "elL"], ["elL", "haL"], ["shR", "shL"], ["shR", "hiR"], ["shL", "hiL"], ["hiR", "hiL"], ["hiR", "knR"], ["knR", "anR"], ["hiL", "knL"], ["knL", "anL"]];
    ctx.save(); ctx.translate(dx, 0); ctx.lineCap = "square";
    const neck = [(s.shR[0] + s.shL[0]) / 2, (s.shR[1] + s.shL[1]) / 2];
    ctx.strokeStyle = "rgba(119,231,255,.35)"; ctx.lineWidth = 18;
    for (const [a, b] of L) { ctx.beginPath(); ctx.moveTo(s[a][0], s[a][1]); ctx.lineTo(s[b][0], s[b][1]); ctx.stroke(); }
    ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 6;
    for (const [a, b] of L) { ctx.beginPath(); ctx.moveTo(s[a][0], s[a][1]); ctx.lineTo(s[b][0], s[b][1]); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(s.head[0], s.head[1]); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const k in s) ctx.fillRect(snap(s[k][0] - 6), snap(s[k][1] - 6), 12, 12);
    ctx.restore();
  };
})(window.TR = window.TR || {});
