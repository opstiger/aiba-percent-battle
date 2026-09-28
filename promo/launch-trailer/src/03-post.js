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
    let sx = 0, sy = 0, z = 0, inv_ = false, flash = null, chroma = 0;
    for (const c of TR.CUES) {
      const d = f - TR.frameOf(c.b);
      if (c.shake) { const s = TR.shakeAt(d, c.shake, c.sdur || 8, c.b * 3); sx += s[0]; sy += s[1]; }
      if (c.punch && d >= 0 && d < 10) z += c.punch * Math.pow(1 - d / 10, 3);
      if (c.invert && d >= 0 && d < c.invert) inv_ = true;
      if (c.flash && d >= 0 && d < 5) flash = { a: c.flash * Math.pow(1 - d / 5, 2), col: c.flashCol || "255,244,210" };
      if (c.chroma && d >= 0 && d < 6) chroma = Math.max(chroma, c.chroma * (1 - d / 6));
    }
    // 像素对齐：震动按 3px 步进，保持方块边缘干净
    return { sx: Math.round(sx / PX) * PX, sy: Math.round(sy / PX) * PX, z, inv: inv_, flash, chroma };
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
    bloom(ctx);
    if (fx.chroma > .5) chromaSplit(ctx, fx.chroma);
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
  /* 柔光：1/4 尺寸模糊后 screen 叠回 */
  const BL = document.createElement("canvas"), BLX = BL.getContext("2d");
  function bloom(ctx) {
    BL.width = W / 4; BL.height = H / 4;
    BLX.filter = "blur(6px) brightness(1.1)"; BLX.drawImage(OUT, 0, 0, W / 4, H / 4); BLX.filter = "none";
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = .38; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(BL, 0, 0, W, H); ctx.restore();
  }
  /* 色差分离：红/青两路错位 */
  const CH = document.createElement("canvas"), CHX = CH.getContext("2d");
  function chromaSplit(ctx, d) {
    CH.width = W; CH.height = H;
    for (const [col, dx] of [["#ff0000", d], ["#00ffff", -d]]) {
      CHX.globalCompositeOperation = "source-over"; CHX.drawImage(OUT, 0, 0);
      CHX.globalCompositeOperation = "multiply"; CHX.fillStyle = col; CHX.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = "lighten"; ctx.globalAlpha = .55; ctx.drawImage(CH, dx, 0); ctx.restore();
    }
  }
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
  TR.placeTag = function (ctx, name, sc, star) {
    ctx.save(); ctx.translate(90, 950); ctx.scale(sc, sc);
    panel(ctx, 0, -56, 560, 112, { accent: PAL.cyan });
    txt(ctx, "WORLD COURT · " + name, 30, -24, { size: 24, color: PAL.cyan, align: "left", spacing: 2, font: CN, weight: 400 });
    if (star) txt(ctx, star.name + "  #" + star.num, 30, 20, { size: 40, font: CN, weight: 400, align: "left" });
    ctx.restore();
  };
  TR.battleHud = function (ctx, a, b, bt, opp, myName) {
    const x = W / 2, y = 90;
    panel(ctx, x - 520, y - 52, 1040, 150);
    txt(ctx, myName ? "你·" + myName : "你", x - 430, y - 8, { size: 34, font: CN, weight: 400, color: PAL.cyan });
    txt(ctx, opp ? "AI·" + opp.name.split("·").pop() : "N-24", x + 420, y - 8, { size: 32, font: CN, weight: 400, color: PAL.salmon });
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

  /* ================= NEURAL COURT：科技 HUD ================= */
  const MONO = "Orbitron, monospace";
  /* 角色在屏幕上的包围框 */
  TR.boxOf = function (guy) {
    if (!guy.g.visible) return null;
    guy.g.updateMatrixWorld(true);
    const pts = [guy.headRoot.localToWorld(new THREE.Vector3(0, 1.95, 0)), guy.g.localToWorld(new THREE.Vector3(0, 0, 0)),
      guy.arms[0].localToWorld(new THREE.Vector3(0, 0, 0)), guy.arms[1].localToWorld(new THREE.Vector3(0, 0, 0))].map(p => TR.project(p));
    if (pts.some(p => p[2] > 1 || p[2] < -1)) return { on: false };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const hw = Math.max(w * .6, h * .22);
    const b = { x0: cx - hw, x1: cx + hw, y0: Math.min(...ys) - h * .04, y1: Math.max(...ys) + h * .02 };
    b.on = b.x1 > 0 && b.x0 < W && b.y1 > 0 && b.y0 < H && h > 30;
    return b;
  };
  TR.brackets = function (ctx, b, col, label) {
    if (!b || !b.on) return;
    const L = Math.min(40, (b.x1 - b.x0) * .25);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3;
    for (const [x, y, dx, dy] of [[b.x0, b.y0, 1, 1], [b.x1, b.y0, -1, 1], [b.x0, b.y1, 1, -1], [b.x1, b.y1, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke();
    }
    ctx.restore();
    if (label) txt(ctx, label, b.x0, b.y0 - 18, { size: 18, color: col, align: "left", shadow: 2, spacing: 3 });
  };
  /* 两侧数据雨 */
  TR.dataRain = function (ctx, bt, a = .3) {
    ctx.save(); ctx.font = `600 14px ${MONO}`; ctx.fillStyle = PAL.cyan;
    const r = rng(77);
    for (let c = 0; c < 10; c++) {
      const x = c < 5 ? 24 + c * 34 : W - 24 - (c - 5) * 34, sp = 40 + r() * 80, off = r() * 1000;
      for (let i = 0; i < 26; i++) {
        const y = ((i * 42 + bt * sp * 4 + off) % (H + 60)) - 30;
        ctx.globalAlpha = a * (.25 + .75 * ((i * 7 + c) % 5) / 5);
        ctx.fillText(((Math.floor(bt * 6) * 13 + i * 7 + c * 31) % 256).toString(16).toUpperCase().padStart(2, "0"), x, y);
      }
    }
    ctx.restore();
  };
  TR.terminal = function (ctx, bt, lines) {
    let y = 130;
    for (const [s, t0] of lines) {
      const n = Math.floor(Math.max(0, bt - t0) * 26);
      if (n <= 0) break;
      const show = s.slice(0, n), done = n >= s.length;
      txt(ctx, show + (!done && Math.floor(bt * 6) % 2 ? "█" : ""), 110, y, { size: 30, color: s.includes("RECON") ? PAL.gold : PAL.cyan, align: "left", weight: 600, shadow: 0 });
      y += 52;
    }
  };
  TR.progress = function (ctx, p, a = 1) {
    ctx.save(); ctx.globalAlpha = a;
    const x = W / 2 - 400, y = H - 170;
    ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 2; ctx.strokeRect(x, y, 800, 26);
    const n = Math.floor(p * 40);
    ctx.fillStyle = PAL.cyan; for (let i = 0; i < n; i++) ctx.fillRect(x + 4 + i * 19.8, y + 4, 15, 18);
    txt(ctx, "RECONSTRUCTING LEGENDS  " + Math.round(p * 100) + "%", W / 2, y - 30, { size: 24, color: PAL.cyan, spacing: 4, shadow: 0 });
    ctx.restore();
  };
  /* 球星名片：真实姓名 / 号码 / OVR / 游戏里的弧线与出手风格 */
  TR.starCard = function (ctx, s, x, y, sc, tag, align = "left", k = 1) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * k, sc * k);
    const w = 440, x0 = align === "left" ? 0 : -w;
    panel(ctx, x0, -95, w, 190, { accent: PAL.cyan, fill: "rgba(4,10,20,.78)", edge: "#1f5a73" });
    txt(ctx, "#" + s.num, x0 + w - 24, -58, { size: 46, color: PAL.gold, align: "right", shadow: 0 });
    txt(ctx, tag || "LEGEND · OVR " + s.ovr, x0 + 26, -62, { size: 16, color: PAL.cyan, align: "left", spacing: 3, shadow: 0 });
    txt(ctx, s.name, x0 + 26, -18, { size: 38, font: CN, weight: 400, align: "left" });
    txt(ctx, "ARC", x0 + 26, 32, { size: 14, color: PAL.dim, align: "left", shadow: 0 });
    txt(ctx, s.arc, x0 + 80, 32, { size: 24, font: CN, weight: 400, color: PAL.cyan, align: "left", shadow: 0 });
    txt(ctx, "STYLE", x0 + 26, 70, { size: 14, color: PAL.dim, align: "left", shadow: 0 });
    txt(ctx, s.style, x0 + 100, 70, { size: 24, font: CN, weight: 400, color: PAL.green, align: "left", shadow: 0 });
    // OVR 条
    ctx.fillStyle = "#12324a"; ctx.fillRect(x0 + 250, 60, 160, 10);
    ctx.fillStyle = PAL.gold; ctx.fillRect(x0 + 250, 60, 160 * (s.ovr - 60) / 40, 10);
    txt(ctx, "OVR " + s.ovr, x0 + 250, 38, { size: 18, color: PAL.gold, align: "left", shadow: 0 });
    ctx.restore();
  };
  TR.counter = function (ctx, n, bt) {
    panel(ctx, W / 2 - 200, 40, 400, 70, { fill: "rgba(4,10,20,.7)", edge: "#1f5a73" });
    txt(ctx, "LEGENDS  " + String(n).padStart(2, "0") + " / 18", W / 2, 76, { size: 30, color: PAL.cyan, spacing: 3, shadow: 0 });
  };
  TR.lowerThird = function (ctx, en, cn, sc, col = PAL.cyan) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(W / 2, H - 150); ctx.scale(sc, sc);
    panel(ctx, -520, -64, 1040, 128, { accent: col, fill: "rgba(4,10,20,.8)" });
    txt(ctx, en, 0, -22, { size: 30, color: col, spacing: 5 });
    txt(ctx, cn, 0, 28, { size: 44, font: CN, weight: 400 });
    ctx.restore();
  };
  TR.lowerThirdSmall = function (ctx, s, sc) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(120, H - 120); ctx.scale(sc, sc);
    panel(ctx, 0, -34, 560, 68, { accent: PAL.cyan, fill: "rgba(4,10,20,.8)" });
    txt(ctx, s, 28, 0, { size: 28, font: CN, weight: 400, align: "left", color: PAL.white });
    ctx.restore();
  };
  TR.featureTag = function (ctx, x, y, en, cn, sc) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    panel(ctx, -330, -64, 660, 128, { accent: PAL.gold, fill: "rgba(4,10,20,.82)" });
    txt(ctx, en, 0, -22, { size: 40, color: PAL.gold, spacing: 5 });
    txt(ctx, cn, 0, 30, { size: 34, font: CN, weight: 400 });
    ctx.restore();
  };
  TR.metric = function (ctx, x, y, k, v, col) {
    panel(ctx, x, y - 44, 270, 88, { fill: "rgba(4,10,20,.8)", edge: "#1f5a73" });
    txt(ctx, k, x + 20, y - 18, { size: 16, color: PAL.dim, align: "left", shadow: 0, spacing: 3 });
    txt(ctx, v, x + 20, y + 18, { size: 34, color: col, align: "left", shadow: 0 });
  };
  TR.dnaResult = function (ctx, s, sc) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(W - 520, H - 250); ctx.scale(sc, sc);
    panel(ctx, 0, 0, 470, 200, { accent: PAL.gold, edge: PAL.gold, fill: "rgba(20,14,0,.85)" });
    txt(ctx, "DNA MATCH", 28, 36, { size: 20, color: PAL.gold, align: "left", spacing: 4, shadow: 0 });
    txt(ctx, "91%", 440, 60, { size: 64, color: PAL.gold, align: "right" });
    txt(ctx, s.name, 28, 92, { size: 38, font: CN, weight: 400, align: "left" });
    txt(ctx, "ELBOW 162°   RELEASE 1.38   FOLLOW 0.86", 28, 150, { size: 16, color: PAL.cyan, align: "left", shadow: 0, spacing: 1 });
    ctx.restore();
  };
  /* 左下角：你的姿态骨架（MediaPipe 风格） */
  TR.dnaInset = function (ctx, bt) {
    const x = 70, y = 230, w = 330, h = 360;
    panel(ctx, x, y, w, h, { fill: "rgba(4,10,20,.82)", edge: "#1f5a73" });
    txt(ctx, "YOUR POSE", x + 20, y + 30, { size: 18, color: PAL.cyan, align: "left", shadow: 0, spacing: 4 });
    const k = Math.sin(bt * 2.2) * 6, cx = x + 170, cy = y + 60;
    const J = { head: [0, 20], nk: [0, 50], sR: [28, 58], sL: [-28, 58], eR: [44, 20 - k], wR: [30, -20 - k], eL: [-40, 30 - k], wL: [-10, -6 - k], hR: [18, 160], hL: [-18, 160], kR: [26, 222], kL: [-22, 222], aR: [22, 285], aL: [-20, 285] };
    const L = [["nk", "head"], ["sR", "sL"], ["sR", "eR"], ["eR", "wR"], ["sL", "eL"], ["eL", "wL"], ["sR", "hR"], ["sL", "hL"], ["hR", "hL"], ["hR", "kR"], ["kR", "aR"], ["hL", "kL"], ["kL", "aL"]];
    ctx.save(); ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 4;
    for (const [a, b] of L) { ctx.beginPath(); ctx.moveTo(cx + J[a][0], cy + J[a][1]); ctx.lineTo(cx + J[b][0], cy + J[b][1]); ctx.stroke(); }
    ctx.fillStyle = "#fff"; for (const k2 in J) ctx.fillRect(cx + J[k2][0] - 5, cy + J[k2][1] - 5, 10, 10);
    ctx.restore();
    txt(ctx, "33 LANDMARKS · LOCAL", x + 20, y + h - 24, { size: 14, color: PAL.dim, align: "left", shadow: 0, spacing: 2 });
  };
  /* 弹道预测虚线 */
  TR.predArc = function (ctx, pts, col, t, label) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([12, 12]); ctx.lineDashOffset = -t * 60;
    ctx.globalAlpha = .85 * (1 - clamp((t - .9) / .3));
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.restore();
    const m = pts[Math.floor(pts.length * .45)];
    if (m && label) txt(ctx, label, m[0], m[1] - 30, { size: 22, color: col, font: CN, weight: 400, shadow: 2 });
  };
  TR.oppCard = function (ctx, s, sc) {
    if (!s || sc <= 0) return;
    ctx.save(); ctx.translate(90, H - 200); ctx.scale(sc, sc);
    panel(ctx, 0, 0, 520, 130, { accent: PAL.salmon, fill: "rgba(4,10,20,.85)" });
    txt(ctx, "AI OPPONENT · OVR " + s.ovr, 28, 30, { size: 16, color: PAL.salmon, align: "left", shadow: 0, spacing: 3 });
    txt(ctx, s.name, 28, 80, { size: 40, font: CN, weight: 400, align: "left" });
    txt(ctx, "#" + s.num, 492, 76, { size: 44, color: PAL.gold, align: "right", shadow: 0 });
    ctx.restore();
  };
  TR.probability = function (ctx, p, bt) {
    const x = W - 520, y = H - 300;
    panel(ctx, x, y, 440, 170, { fill: "rgba(4,10,20,.82)", edge: p > 90 ? PAL.green : "#1f5a73" });
    txt(ctx, "MAKE PROBABILITY", x + 24, y + 32, { size: 18, color: PAL.dim, align: "left", shadow: 0, spacing: 3 });
    txt(ctx, p.toFixed(1) + "%", x + 24, y + 96, { size: 70, color: p > 90 ? PAL.green : PAL.cyan, align: "left" });
    ctx.fillStyle = "#12324a"; ctx.fillRect(x + 24, y + 140, 392, 10);
    ctx.fillStyle = p > 90 ? PAL.green : PAL.cyan; ctx.fillRect(x + 24, y + 140, 392 * p / 100, 10);
  };
  TR.faceTag = function (ctx, s, sc) {
    if (!s || sc <= 0) return;
    ctx.save(); ctx.translate(120, H - 190); ctx.scale(sc, sc);
    panel(ctx, 0, 0, 620, 120, { accent: PAL.gold, fill: "rgba(4,10,20,.8)" });
    txt(ctx, s.name, 30, 60, { size: 50, font: CN, weight: 400, align: "left" });
    txt(ctx, "#" + s.num, 590, 60, { size: 52, color: PAL.gold, align: "right" });
    ctx.restore();
  };
  TR.slowTag = function (ctx, k, label) {
    const x = TR.W - 330, y = TR.H - 150;
    panel(ctx, x, y, 270, 58, { fill: "rgba(4,10,20,.75)", edge: "#1f5a73" });
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(x + 30, y + 29, 8, 0, Math.PI * 2); ctx.fill();
    txt(ctx, label || ("SLOW-MO " + k.toFixed(2) + "×"), x + 50, y + 30, { size: 22, color: PAL.white, align: "left", shadow: 0, spacing: 2 });
  };
  TR.pointerTag = function (ctx, x, y, label, num) {
    ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y - 70); ctx.lineTo(x + 90, y - 70); ctx.stroke(); ctx.restore();
    panel(ctx, x + 90, y - 110, 440, 80, { accent: PAL.gold, fill: "rgba(4,10,20,.85)" });
    txt(ctx, label, x + 116, y - 70, { size: 28, font: CN, weight: 400, align: "left" });
    if (num) txt(ctx, num, x + 510, y - 70, { size: 30, color: PAL.gold, align: "right", shadow: 0 });
  };
  /* 绝杀时刻 HUD：照游戏 lsScoreBox 的样式 */
  TR.lastShotHud = function (ctx, home, away, clock, bt, won) {
    const x = TR.W / 2, y = 70;
    panel(ctx, x - 380, y - 44, 760, 120, { fill: "rgba(10,14,24,.88)", edge: won ? PAL.gold : "#283750", lw: won ? 5 : 3 });
    txt(ctx, "你的球队", x - 330, y - 6, { size: 28, font: CN, weight: 400, color: "#7ee7ff", align: "left", shadow: 0 });
    txt(ctx, String(home), x - 90, y - 4, { size: 54, color: PAL.gold, shadow: 0 });
    txt(ctx, ":", x, y - 4, { size: 36, color: "#55667e", shadow: 0 });
    txt(ctx, String(away), x + 90, y - 4, { size: 54, color: PAL.salmon, shadow: 0 });
    txt(ctx, "卫冕冠军", x + 330, y - 6, { size: 28, font: CN, weight: 400, color: "#cdd6e3", align: "right", shadow: 0 });
    const diff = away - home, st = diff > 0 ? "★ 落后 " + diff + " 分 ★" : diff === 0 ? "★ 平分 · 绝杀一投 ★" : "★ 反超领先！★";
    txt(ctx, st, x, y + 50, { size: 22, font: CN, weight: 400, color: diff > 0 ? PAL.salmon : diff === 0 ? PAL.gold : PAL.green, shadow: 0 });
    const low = clock <= 3, blink = low && clock > 0 && Math.floor(bt * 5) % 2;
    txt(ctx, clock.toFixed(1), x, y + 124, { size: 58, color: low ? (blink ? "#7a1a1a" : "#ff4040") : PAL.gold });
  };
  TR.chips = function (ctx, x, y, list, t) {
    const w = 250, gap = 16, total = list.length * w + (list.length - 1) * gap;
    list.forEach((s, i) => {
      const k = clamp((t - i * .5) / .3);
      if (k <= 0) return;
      const cx = x - total / 2 + i * (w + gap) + w / 2;
      const row = i < 3 ? 0 : 1, rx = x - (3 * w + 2 * gap) / 2 + (i % 3) * (w + gap) + w / 2;
      ctx.save(); ctx.translate(rx, y + row * 76); ctx.scale(E.outBack(k), E.outBack(k));
      panel(ctx, -w / 2, -30, w, 60, { fill: "rgba(4,10,20,.85)", edge: PAL.cyan, r: 30 });
      txt(ctx, s, 0, 2, { size: 26, font: CN, weight: 400, color: PAL.white, shadow: 0 });
      ctx.restore();
    });
  };
})(window.TR = window.TR || {});
