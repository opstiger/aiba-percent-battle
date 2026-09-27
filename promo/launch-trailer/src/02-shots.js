/* 02-shots —「NEURAL COURT」分镜 A–H（见 STORYBOARD.md）。bt = 镜头内拍数。
   frame(bt,f)：摆演员/球/镜头（顺序调用，推进有状态特效）
   passes(bt,f)：可选多次渲染；compose(ctx,bt)：可选自定义合成；ov(ctx,bt,f)：HUD
   CUES：画面卡点 + 音效，共用一张表。 */
(function (TR) {
  "use strict";
  const { clamp, lerp, inv, E, track, PAL } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = () => TR.S.actors;
  const P = TR.POSES;
  const mixP = (a, b, t) => TR.mixVal(Object.assign({}, a), Object.assign({}, b), t);
  const ST = (id) => TR.star(id);
  const CC = [0, 4.745];

  /* ---------------- 卡点表 ---------------- */
  const C = [];
  const cue = (b, sfx, o = {}) => C.push(Object.assign({ b, sfx }, o));
  for (let i = 0; i < 26; i++) cue(i * .125 + .25, ["type"]);                   // 打字
  cue(2, ["sweep"], { shake: 6 }); cue(4, ["blip"]); cue(8, ["zapBig", "boom"], { shake: 18, punch: .06, flash: .25, flashCol: "120,230,255" });
  cue(14, ["blip"]); cue(15.5, ["whoosh"]);
  for (let k = 0; k < 17; k++) cue(16 + k * .8 - .2, ["zap"], { shake: 4 });
  cue(30, ["boom", "crash"], { shake: 16, punch: .06, flash: .5, flashCol: "200,245,255" });
  cue(31, ["riserShort"]);
  cue(32, ["boom", "crash", "stab"], { shake: 30, punch: .12, invert: 2, chroma: 10 });
  cue(33, ["roarShort"]); cue(36, ["blip", "stab"], { shake: 10, punch: .04 });
  cue(44, ["shoot"], { shake: 6, chroma: 4 }); cue(46, ["pixel"]);
  for (let i = 0; i < 14; i++) cue(46.5 + i * .25, ["tick"]);
  cue(50, ["lock", "stab"], { shake: 14, punch: .06, chroma: 8 });
  cue(52, ["zapBig"], { shake: 8 }); cue(54, ["stab"], { shake: 12, punch: .05, chroma: 6 });
  for (let b = 56; b < 64; b++) cue(b, ["shoot", ...(b % 2 ? ["blip"] : [])], { shake: 7, chroma: b % 2 ? 0 : 5 });
  for (let b = 64; b < 68; b += .5) cue(b, ["shoot"], { shake: 4 });
  for (let b = 68; b < 72; b++) cue(b, ["whip", "stab"], { shake: 12, punch: .05, chroma: 6 });
  cue(72, ["heart", "hush"]); for (let b = 73; b < 83; b++) cue(b, ["heart"]);
  cue(80, ["riser2"]); cue(83, ["shoot"]); cue(83.9, ["buzzer"], { flash: .5, flashCol: "255,60,60" });
  cue(84, ["boom"], { shake: 10 });
  cue(86, ["swish", "boom", "crash", "roar", "stab"], { shake: 42, sdur: 14, punch: .15, invert: 2, chroma: 14 });
  cue(88, ["yell"], { shake: 14 });
  for (let i = 0; i < 8; i++) cue(96 + i * .5, ["whip"], { shake: 6, chroma: 5 });
  cue(100, ["boom", "stab"], { shake: 16, punch: .06 });
  cue(104, ["pixel", "boom"], { shake: 10 }); cue(104.4, ["ding"]);
  cue(108, ["blip", "stab"], { shake: 10, punch: .04 });
  for (let i = 0; i < 6; i++) cue(112 + i * .5, ["blip"]);
  cue(112, ["boom", "stabLong"], { shake: 8, punch: .03 });
  cue(116, ["blip"]);
  cue(120, ["bounceS"]); cue(120.8, ["bounceS2"]); cue(121.4, ["bounceS3"]);
  TR.CUES = C;

  /* 姿势花样：亮相时每人不同 */
  const POSE_SET = [P.chest, P.spin, P.point, P.flex, "shot", P.stand, P.roar];
  function heroPose(guy, i, t = 0, ball = 0) {
    const kind = POSE_SET[i % POSE_SET.length];
    if (kind === "shot") return { y: TR.shoot(guy, .58), ball: "grip" };
    const y = TR.pose(guy, Object.assign({}, kind, { hy: Math.sin(t * .7 + i) * .12 }));
    return { y, ball: kind === P.chest ? "chest" : kind === P.spin ? "spin" : null };
  }
  function ballFor(guy, how, bi, spin) {
    if (!how) return TR.hideBall(bi);
    if (how === "chest") { const a = TR.grip(guy, 0), b = TR.grip(guy, 1), p = a.lerp(b, .5); p.z += 0; TR.ball(bi, p, 0); return; }
    const g = TR.grip(guy); TR.ball(bi, V(g.x, g.y + (how === "spin" ? .2 : .05), g.z), spin, false);
  }
  /* 阵列：18 人三排 */
  function formation(cx, cz, face, spread = 1.9, depth = 2.2) {
    return TR.S.stars.map((s, i) => {
      const row = Math.floor(i / 6), col = i % 6;
      return [cx + (col - 2.5) * spread + (row % 2) * spread * .5, cz - row * depth];
    });
  }

  /* ========== A · BOOT 0–16 ========== */
  const A0 = { b0: 0, preset: "indoor", seed: 101, void: true,
    frame(bt, f) {
      const n = ST("nova24").guy;
      TR.voidTick(f / 30, E.outCubic(inv(2, 4.5, bt)));
      if (bt >= 8) {
        const top = n.holoTop * (n.g.scale.y || 1) + .12, scan = lerp(0, top, E.inOutCubic(inv(8, 11.2, bt)));
        const look = bt < 13.4 ? { hx: .28, hy: .5 } : { hx: lerp(.28, 0, E.outBack(inv(13.4, 13.8, bt))), hy: lerp(.5, 0, E.outBack(inv(13.4, 13.8, bt))) };
        const pose = bt < 14 ? Object.assign({}, P.stand, look) : Object.assign({}, P.spin, { hx: -.05 });
        TR.place(n, 0, -2, TR.pose(n, pose), 0);
        TR.holo(n, scan, .4);
        if (scan < top) TR.ring(0, scan, -2, 1.3 + Math.sin(bt * 9) * .03);
        if (bt >= 14) ballFor(n, "spin", 0, bt * 9);
      }
      if (bt < 8) TR.cam([Math.sin(bt * .3) * .6, lerp(3.2, 1.4, E.inOutCubic(bt / 8)), lerp(12, 4.5, E.inOutCubic(bt / 8))], [0, .8, -2], 50, .02);
      else {
        const u = inv(8, 16, bt);
        TR.orbit([0, -2], lerp(.95, -.35, E.inOutCubic(u)), lerp(3.6, 2.5, u), lerp(.35, 1.15, u), lerp(1.1, 1.6, u), 42, lerp(.05, -.02, u));
      }
      this.box = TR.boxOf(n);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .35);
      TR.terminal(ctx, bt, [["> aiBA NEURAL COURT // BOOT", 0], ["> loading voxel engine ........ OK", 1.2], ["> pose model: 33 landmarks ..... OK", 2.4], ["> RECONSTRUCTING LEGENDS", 3.6]]);
      if (bt >= 4 && bt < 8.5) TR.progress(ctx, E.inOutCubic(inv(4, 8, bt)), 1 - inv(8, 8.5, bt));
      if (bt >= 8) TR.brackets(ctx, this.box, bt < 11.2 ? PAL.cyan : PAL.gold, bt < 11.2 ? "SCANNING " + Math.round(inv(8, 11.2, bt) * 100) + "%" : "RECONSTRUCTED");
      if (bt >= 11) TR.starCard(ctx, ST("nova24"), 1260, 520, E.outBack(inv(11, 11.4, bt)), "AI ORIGINAL");
    },
  };

  /* ========== B1 · ROSTER 长廊 16–30 ========== */
  const B1 = { b0: 16, preset: "indoor", seed: 102, void: true,
    zOf: (k) => -4 - k * 3.2, xOf: (k) => (k % 2 ? 1.75 : -1.75),
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const camZ = 1.8 - 4 * bt;
      this.cards = [];
      const others = TR.S.stars.slice(1);
      others.forEach((s, k) => {
        const T = k * .8, z = this.zOf(k), x = this.xOf(k), g = s.guy;
        if (bt < T - .35 || z > camZ + 1.2) { g.g.visible = false; return; }
        const hp = heroPose(g, k, bt);
        TR.place(g, x, z, hp.y, Math.atan2(-x * .6, 5));
        ballFor(g, hp.ball, k % 5, bt * 8);
        if (!hp.ball) TR.hideBall(k % 5);
        const top = g.holoTop * (g.g.scale.y || 1) + .12, scan = lerp(0, top, E.inOutCubic(inv(T - .35, T + .45, bt)));
        TR.holo(g, scan, .45);
        if (scan < top) TR.ring(x, scan, z, 1.25);
        if (bt >= T && bt < T + .8) this.cards.push({ s, k, box: TR.boxOf(g), a: E.outBack(inv(T, T + .2, bt)) * (1 - inv(T + .68, T + .8, bt)) });
      });
      for (let i = 0; i < 5; i++) { const any = others.some((s, k) => k % 5 === i && s.guy.g.visible && heroPoseNeedsBall(k)); if (!any) TR.hideBall(i); }
      TR.cam([Math.sin(bt * .9) * .25, 1.55, camZ], [Math.sin(bt * .9) * .1, 1.3, camZ - 9], 56, Math.sin(bt * .6) * .025);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .25);
      for (const c of this.cards) if (c.box && c.box.on) {
        const right = c.k % 2 === 1;                     // 右侧球员：名片放在他左边（朝画面中心）
        const x = clamp(right ? c.box.x0 - 24 : c.box.x1 + 24, right ? 470 : 40, right ? TR.W - 40 : TR.W - 470);
        const y = clamp(c.box.y0 + (c.box.y1 - c.box.y0) * .38, 160, TR.H - 160);
        TR.brackets(ctx, c.box, PAL.cyan, null);
        TR.starCard(ctx, c.s, x, y, c.a, null, right ? "right" : "left", .95);
      }
      TR.counter(ctx, Math.min(18, 1 + Math.floor(clamp(bt / .8 + 1, 0, 17))), bt);
    },
  };
  function heroPoseNeedsBall(k) { const kind = POSE_SET[k % POSE_SET.length]; return kind === P.chest || kind === P.spin || kind === "shot"; }

  /* ========== B2 · 全员阵列 30–32 ========== */
  const B2 = { b0: 30, preset: "indoor", seed: 103, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const pos = formation(0, -4, 0);
      TR.S.stars.forEach((s, i) => { const hp = heroPose(s.guy, i, bt); TR.place(s.guy, pos[i][0], pos[i][1], hp.y, Math.atan2(-pos[i][0], 16 - pos[i][1])); TR.holo(s.guy, lerp(-.2, 2.4, E.outCubic(inv(0, .6, bt)) + (i % 6) * 0) , .5); });
      for (let i = 0; i < 6; i++) TR.hideBall(i);
      const u = E.inOutCubic(bt / 2);
      TR.cam([0, lerp(1.2, 4.2, u), lerp(2.2, 6.5, u)], [0, lerp(1.5, 1.0, u), -6], 56, 0);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .25);
      TR.lowerThird(ctx, "18 LEGENDS · RECONSTRUCTED BY AI", "18 位传奇 · 由 AI 重建", E.outBack(inv(.9, 1.2, bt)));
    },
  };

  /* ========== C · TITLE 32–40（虚空翻成真实球馆） ========== */
  const C0 = { b0: 32, preset: "indoor", seed: 104,
    frame(bt, f) {
      TR.lights(lerp(1.5, 1, inv(0, .6, bt)));
      if (bt < .05) TR.cheer(5);
      const pos = formation(0, 3.6, 0, 1.7, 1.6);
      TR.S.stars.forEach((s, i) => { const hp = heroPose(s.guy, i + 3, bt); TR.place(s.guy, pos[i][0], pos[i][1], hp.y + (i % 3 === 0 ? Math.max(0, Math.sin(bt * 3 + i)) * .12 : 0), Math.atan2(-pos[i][0] * .5, 14 - pos[i][1])); });
      const u = E.outCubic(bt / 8);
      TR.cam([Math.sin(bt * .25) * 1.2, lerp(1.2, 2.2, u), lerp(12.5, 10.5, u)], [0, lerp(2.6, 2.2, u), 1.5], 48, -.02);
    },
    ov(ctx, bt) {
      const sc = bt < .3 ? lerp(3, 1, E.outQuint(bt / .3)) : 1 + (bt - .3) * .006;
      TR.logo(ctx, TR.W / 2, 250, 760 * sc, 1, [[.4, 1.3], [5, 5.9]].map(([a, b]) => inv(a, b, bt)).find(x => x > 0 && x < 1));
      if (bt < 1.6) TR.goldBurst(ctx, TR.W / 2, 250, bt / 1.6, 1.1, 3);
      if (bt >= 4) TR.lowerThird(ctx, "AI LEGENDS · RACE TO 100", "和 AI 传奇 · 同场决战 100 分", E.outBack(inv(4, 4.2, bt)), PAL.gold);
    },
  };

  /* ========== D1 · 体感投篮 40–46 ========== */
  const D1 = { b0: 40, preset: "indoor", seed: 105,
    ph: (bt) => bt < 4 ? lerp(.05, .9, E.inOutCubic(bt / 4)) : Math.min(1.25, .9 + (bt - 4) * .3),
    frame(bt) {
      const { hero, human } = A();
      const ph = this.ph(bt);
      TR.place(hero, 0, -.6, TR.shoot(hero, ph), Math.PI);
      if (ph < .9) { const g = TR.grip(hero); TR.ball(0, V(g.x, g.y + .05, g.z - .06), 0); this.rel = null; }
      else { const from = this.rel || (this.rel = TR.grip(hero).clone()), u = inv(4, 5.5, bt); TR.ball(0, u < 1 ? TR.arc(from, u, 1.5) : TR.drop(bt - 5.5), u * 8); TR.net(u >= 1 ? (bt - 5.5) * .4 : -1); }
      TR.place(human, 60, 60.3, TR.shoot(human, ph), 0);
    },
    passes(bt) {
      TR.cam([60.15, 1.25, 63.4], [60, 1.25, 60.2], 44); TR.render(); TR.copyPass("A");
      this.skel = TR.skeleton(A().human);
      TR.orbit([0, -.6], Math.PI + .75 - bt * .04, 4.4, 1.3, 1.5, 38); TR.shiftX(V(0, 1.5, -.6), .42); TR.render(); TR.copyPass("B");
    },
    compose(ctx, bt) {
      TR.drawPass(ctx, "B");
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1020, 0); ctx.lineTo(880, TR.H); ctx.lineTo(0, TR.H); ctx.closePath(); ctx.clip();
      TR.drawPass(ctx, "A", -300); TR.drawSkeleton(ctx, this.skel, -300, true); TR.camHud(ctx, bt);
      ctx.restore();
      TR.splitLine(ctx, 1020, 0, 880, TR.H);
    },
    ov(ctx, bt) {
      TR.mosaicK = bt < .3 ? Math.round(lerp(20, 1, E.outCubic(bt / .3))) : 1;
      TR.featureTag(ctx, 1500, 120, "AI MOTION SHOT", "体感投篮 · 真实动作出手", E.outBack(inv(.3, .5, bt)));
      TR.metric(ctx, 120, 950, "POSE CONF", (0.93 + Math.sin(bt * 5) * .03 + .02).toFixed(2), PAL.green);
      TR.metric(ctx, 420, 950, "LATENCY", Math.round(16 + Math.sin(bt * 7) * 3) + "ms", PAL.cyan);
    },
  };

  /* ========== D2 · NBA DNA 46–52 ========== */
  const DNA_IDS = ["curry", "j23", "k24", "t01", "bird", "lillard"];
  const DNA_SCORE = [84, 88, 91, 79, 76, 82];
  const D2 = { b0: 46, preset: "indoor", seed: 106, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const ph = .55 + Math.sin(bt * 2.2) * .12;
      DNA_IDS.forEach((id, i) => {
        const g = ST(id).guy, x = (i - 2.5) * 1.9;
        TR.place(g, x, -3, TR.shoot(g, ph), 0);
        const lock = bt >= 4 && id === "k24";
        if (lock) TR.solid(g); else TR.wire(g, false);
        TR.hideBall(i);
      });
      TR.cam([Math.sin(bt * .4) * .4, 1.35, lerp(3.4, 2.9, bt / 6)], [0, 1.25, -3], 64, 0);
      this.boxes = DNA_IDS.map(id => TR.boxOf(ST(id).guy));
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .2);
      TR.featureTag(ctx, TR.W / 2, 110, "NBA DNA", "你的投篮姿势 · 和传奇比对", E.outBack(inv(0, .2, bt)));
      DNA_IDS.forEach((id, i) => {
        const b = this.boxes[i]; if (!b || !b.on) return;
        const lock = bt >= 4, win = id === "k24";
        const v = lock ? DNA_SCORE[i] : Math.round(40 + 55 * TR.hash(Math.floor(bt * 8) * 31 + i));
        TR.brackets(ctx, b, lock && win ? PAL.gold : lock ? "#3a5566" : PAL.cyan, null);
        TR.txt(ctx, v + "%", (b.x0 + b.x1) / 2, b.y1 + 34, { size: lock && win ? 44 : 30, color: lock && win ? PAL.gold : lock ? PAL.dim : PAL.cyan });
      });
      if (bt >= 4) TR.dnaResult(ctx, ST("k24"), E.outBack(inv(4, 4.25, bt)));
      TR.dnaInset(ctx, bt);
    },
  };

  /* ========== D3 · VS AI LEGENDS 52–56 ========== */
  const D3 = { b0: 52, preset: "indoor", seed: 107, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const { hero } = A();
      TR.place(hero, 0, -1, TR.pose(hero, bt < 2 ? P.stand : P.point), 0);
      const top = hero.holoTop + .12; TR.holo(hero, lerp(0, top, E.inOutCubic(inv(0, 1.6, bt))), .45);
      if (bt < 1.6) TR.ring(0, lerp(0, top, E.inOutCubic(inv(0, 1.6, bt))), -1, 1.3);
      ["curry", "lillard", "h13", "thompson", "ionescu", "t01", "a03", "j23"].forEach((id, i) => {
        const g = ST(id).guy, a = -1.1 + i * .31, x = Math.sin(a) * 6, z = -1 - Math.cos(a) * 6;
        TR.place(g, x, z, TR.pose(g, P.stand), Math.atan2(-x, -1 - z)); TR.wire(g, bt > 2);
      });
      TR.orbit([0, -1], lerp(.3, -.3, bt / 4), lerp(3.4, 2.6, bt / 4), .9, 1.4, 50, 0);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .3);
      if (bt >= 2) TR.bigText(ctx, "YOU  VS  AI", TR.W / 2, 880, 150, PAL.white, 0, E.outBack(inv(2, 2.2, bt)), PAL.cyan);
      if (bt >= 1.6) TR.lowerThirdSmall(ctx, "PLAYER 1 · 你", E.outBack(inv(1.6, 1.8, bt)));
    },
  };

  /* ========== E1 · 百分大战：一拍换一位 AI 对手 56–64 ========== */
  const RIVALS = ["curry", "lillard", "h13", "thompson", "ionescu", "t01", "a03", "j23"];
  const E1 = { b0: 56, preset: "indoor", seed: 108,
    frame(bt) {
      const { hero } = A();
      const k = clamp(Math.floor(bt + .8), 0, 7), opp = ST(RIVALS[Math.min(7, Math.floor(bt))]);
      const u = (bt + .8) % 1, ph = u * 1.15;
      TR.S.stars.forEach(s => { if (s !== opp) s.guy.g.visible = false; });
      this.arcs = [];
      for (const [g, x, z, bi] of [[hero, 2.5, .1, 0], [opp.guy, -2.5, .1, 2]]) {
        TR.place(g, x, z, TR.shoot(g, ph), TR.faceHoop(x, z));
        if (ph < .9) { const gp = TR.grip(g); TR.ball(bi + (k % 2), V(gp.x, gp.y + .05, gp.z), 0); } else TR.hideBall(bi + (k % 2));
        const prev = bi + ((k + 1) % 2), since = bt - (k - 1) - .0;
        const from = V(x * .92, 2.85, z - .35);
        if (k >= 1 && since >= 0 && since < 1) { TR.ball(prev, TR.arc(from, clamp(since / .95), 1.9), since * 8); }
        else TR.hideBall(prev);
        // 弹道预测：从出手点到篮筐
        const pts = []; for (let q = 0; q <= 1.0001; q += .08) pts.push(TR.project(TR.arc(from, q, 1.9)));
        this.arcs.push({ pts, t: since, col: bi ? PAL.salmon : PAL.cyan, label: bi ? opp.arc : "YOU" });
      }
      TR.cam([Math.sin(bt * .7) * .4, 1.05, -3.6 - bt * .08], [0, 1.9, .3], 64, Math.sin(bt * 1.3) * .02);
      this.opp = opp;
    },
    ov(ctx, bt) {
      for (const a of this.arcs) if (a.t >= 0 && a.t < 1.2) TR.predArc(ctx, a.pts, a.col, a.t, a.label);
      const i = clamp(Math.floor(bt), 0, 7), t = E.outCubic(inv(i, i + .3, bt));
      const Y = [60, 64, 68, 72, 76, 80, 84, 88, 91], O = [66, 70, 73, 77, 80, 84, 87, 90, 93];
      TR.battleHud(ctx, Math.round(lerp(Y[i], Y[i + 1], t)), Math.round(lerp(O[i], O[i + 1], t)), bt, this.opp);
      TR.oppCard(ctx, this.opp, E.outBack(inv(i, i + .15, bt)));
    },
  };

  /* ========== E2 · RACK RUSH 64–68 ========== */
  const RT = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5];
  const E2 = { b0: 64, preset: "indoor", seed: 109, X: 4.55, Z: -1.1,
    frame(bt, f) {
      const { hero } = A();
      let i = 0; for (let k = 0; k < RT.length; k++) if (bt >= RT[k] - .28) i = k;
      const d = (bt - RT[i]) / .5;
      const ph = d < -.55 ? .1 : d < 0 ? lerp(.2, .9, E.inOutCubic((d + .55) / .55)) : Math.min(1.2, .9 + d * .9);
      TR.place(hero, this.X, this.Z, TR.shoot(hero, ph), TR.faceHoop(this.X, this.Z));
      const rack = V(this.X + .95, .9, this.Z - .7);
      if (d < 0) { const g = TR.grip(hero), u = clamp((d + .55) / .3); TR.ball(5, rack.clone().lerp(V(g.x, g.y + .05, g.z), E.outCubic(u)), f * .3); } else TR.hideBall(5);
      this.score = 0;
      RT.forEach((T, k) => {
        const t = (bt - T) / .7;
        if (t >= 1) this.score += k === 4 ? 3 : 2;
        if (t < 0 || t > 1.35) { TR.hideBall(k % 5); return; }
        TR.ball(k % 5, t <= 1 ? TR.arc(V(this.X - .12, 2.9, this.Z - .3), t, 1.4) : TR.drop((t - 1) * .5), t * 8);
      });
      const age = Math.min(...RT.map(T => { const t = (bt - T) / .7; return t >= 1 ? (t - 1) * .5 : 99; }));
      TR.net(age < 1 ? age : -1, .9, -.3);
      TR.rack(rack);
      TR.cam([9.2 - bt * .4, 2.1, 3.1], [2.4 - bt * .12, 2.0, -4.2], 50);
    },
    ov(ctx, bt) { TR.rackHud(ctx, this.score, bt); },
  };

  /* ========== E3 · 世界球场 68–72：每拍一个场景、一位球星 ========== */
  const WORLDS = [["flowerCourt", "峡谷雨林", "taurasi"], ["shonanCoast", "湘南海岸", "korver"], ["medCliff", "地中海半岛", "stojakovic"], ["beachSunset", "西海岸 · 夕阳", "miller"]];
  const E3 = { b0: 68, preset: "flowerCourt", seed: 110,
    frame(bt) {
      const k = Math.min(3, Math.floor(bt)), w = WORLDS[k];
      if (TR.S.preset !== w[0]) { applyScenePreset(w[0], { silent: true, persist: false }); TR.S.preset = w[0]; for (let i = 0; i < 3; i++) updateEnvironment(1 / 30); }
      TR.S.stars.forEach(s => { s.guy.g.visible = false; });
      const g = ST(w[2]).guy, u = bt - k;
      const ph = lerp(.55, 1.05, E.inOutCubic(u));
      TR.place(g, 0, -.5, TR.shoot(g, ph), Math.PI);
      const gp = TR.grip(g);
      if (ph < .9) TR.ball(0, V(gp.x, gp.y + .05, gp.z - .05), 0); else TR.ball(0, TR.arc(V(gp.x, gp.y, gp.z), (ph - .9) * 1.2, 1.4), u * 6);
      TR.orbit([0, -.5], Math.PI - 1.1 + bt * .55, 3.4, .8, 1.9, 46, .03);
      this.star = ST(w[2]);
    },
    ov(ctx, bt) {
      const k = Math.min(3, Math.floor(bt)), u = bt - k;
      TR.placeTag(ctx, WORLDS[k][1], E.outBack(inv(0, .12, u)), this.star);
      if (u < .12) TR.streaks(ctx, u / .12, 0);
    },
  };

  /* ========== F · 绝杀 72–88 ========== */
  const duo = (heroPose_, legPose, legLift = 0) => {
    const { hero } = A(), legend = ST("nova24").guy;
    const yh = typeof heroPose_ === "number" ? TR.shoot(hero, heroPose_) : TR.pose(hero, heroPose_);
    TR.place(hero, 0, -.6, yh, Math.PI);
    TR.place(legend, .1, -1.75, TR.pose(legend, Object.assign({}, legPose, { lift: legLift })), [0, -.6]);
  };
  /* 其余 16 位在场边一字排开 */
  function sideline(bt) {
    TR.S.stars.slice(1).forEach((s, i) => {
      const g = s.guy, x = -7.2, z = -6.5 + i * .82;
      TR.place(g, x, z, TR.pose(g, Object.assign({}, i % 3 === 0 ? P.chest : P.stand, { hx: .05, hy: Math.sin(bt * .5 + i) * .1 })), Math.PI / 2 + (z + .8) * -.06);
    });
  }
  const F1 = { b0: 72, preset: "indoor", seed: 111,
    frame(bt) {
      TR.lights(.3); TR.spot(0, -1.1, 5.2, 9); TR.keyLight(1.2);
      duo(mixP(P.chest, P.chest, 0), P.guard); sideline(bt);
      const { hero } = A(), a = TR.grip(hero, 0), b = TR.grip(hero, 1), ball = a.clone().lerp(b, .5); ball.z -= .06; TR.ball(0, ball, 0);
      const t = E.inOutCubic(bt / 8);
      if (bt < 4) TR.cam([lerp(3.4, 2.8, t), .75, lerp(1.6, 1.1, t)], [-2.6, 1.3, -1.4], 52, .03);
      else TR.cam([lerp(-2.4, -1.9, t), .55, lerp(-.9, -1.1, t)], [0, 1.5, -1.15], 48, .04);
    },
    ov(ctx, bt) {
      TR.clutchHud(ctx, 97, 99, 3 - bt / 8 * 1.5, bt);
      TR.heartPulse(ctx, bt % 1);
      if (bt < 4) TR.lowerThirdSmall(ctx, "16 LEGENDS WATCHING", E.outBack(inv(.5, .7, bt)));
    },
  };
  const F2 = { b0: 80, preset: "indoor", seed: 112,
    frame(bt) {
      TR.lights(.24); TR.spot(0, -1.1, 5.5, 9); TR.keyLight(1.3);
      const ph = bt < 3 ? lerp(.12, .9, E.inOutCubic(bt / 3)) : .9 + (bt - 3) * .25;
      duo(ph, P.defend, Math.sin(clamp((bt - 1.2) / 2.6) * Math.PI) * .6); sideline(bt + 8);
      const { hero } = A();
      if (bt < 3) { const g = TR.grip(hero); TR.ball(0, V(g.x, g.y + .05, g.z - .06), 0); this.rel = null; }
      else { const from = this.rel || (this.rel = TR.grip(hero).clone()); TR.ball(0, TR.arc(from, (bt - 3) * .09, 2.2), (bt - 3) * 2); }
      const c = [0, -1], k = E.inOutQuint(inv(3, 3.9, bt)), ang = lerp(-2.7, .45, E.inOutCubic(clamp(bt / 3.2)));
      const pos = [c[0] + Math.sin(ang) * lerp(3.4, 2.8, bt / 4), lerp(.5, 1.5, bt / 4), c[1] + Math.cos(ang) * lerp(3.4, 2.8, bt / 4)];
      const bp = TR.S.balls[0].m.position;
      TR.cam(pos, [lerp(0, bp.x, k), lerp(1.9, bp.y, k), lerp(c[1], bp.z, k)], lerp(46, 14, k), lerp(-.05, .03, bt / 4));
      this.bp = TR.project(bp);
    },
    ov(ctx, bt) {
      TR.clutchHud(ctx, 97, 99, Math.max(0, 1.5 - bt / 3.9 * 1.5), bt, .85);
      TR.letterbox(ctx, 90);
      const p = bt < 3 ? lerp(12, 71, E.inCubic(bt / 3)) : lerp(71, 99.7, E.outCubic(inv(3, 3.6, bt)));
      TR.probability(ctx, p, bt);
    },
  };
  const F3 = { b0: 84, preset: "indoor", seed: 113,
    frame(bt) {
      const { hero } = A(), from = V(.05, 3.05, -1.15);
      TR.lights(bt < 2 ? .3 : lerp(1.5, 1, inv(2, 2.6, bt))); TR.spot(0, -1, bt < 2 ? 2.5 : 0, 9); TR.keyLight(bt < 2 ? 1 : 0);
      duo(1.2, P.stand); ST("nova24").guy.headRoot.rotation.x = .3; sideline(bt + 12);
      const u = clamp(bt / 2), p = bt <= 2 ? TR.arc(from, E.inOutCubic(u) * .5 + u * .5, 2.3) : TR.drop((bt - 2) * .55);
      TR.ball(0, p, bt * 2, bt > 2);
      TR.net(bt >= 2 ? (bt - 2) * .55 : -1, 1.3, 0);
      if (bt >= 2 && !this.boom) { this.boom = true; TR.cheer(5); TR.confetti(); }
      if (bt < 1.7) { const ah = TR.arc(from, Math.min(1, E.inOutCubic(u) * .5 + u * .5 + .12), 2.3); TR.cam([p.x - .7, p.y + .35, p.z + 1.7], [ah.x, ah.y, ah.z], 52, -.05 + u * .08); }
      else { const k = E.inOutCubic(inv(1.7, 2.1, bt)); TR.cam([lerp(p.x - .7, 1.6, k), lerp(p.y + .35, 1.8, k), lerp(p.z + 1.7, HOOP.z + 4.2, k)], [0, HOOP.y - .2, HOOP.z], 50, 0); }
      this.rim = TR.project(V(HOOP.x, HOOP.y, HOOP.z));
    },
    ov(ctx, bt) {
      const s = bt >= 2.05 ? 100 : 97;
      TR.clutchHud(ctx, s, 99, 0, bt, bt >= 2.05 ? lerp(1.25, 1, E.outCubic(inv(2.05, 2.4, bt))) : .85, s === 100);
      if (bt > 2) { TR.goldBurst(ctx, this.rim[0], this.rim[1], inv(2, 3.4, bt), 1.6, 9); TR.bigText(ctx, "100!", 560, 720, 300, PAL.gold, -.08, E.outBack(inv(2.08, 2.3, bt)), "#ff4040"); }
    },
  };

  /* ========== G1 · 全员庆祝 88–96 ========== */
  const CELE = TR.CELE = [];
  function celebrate(bt) {
    const { hero } = A();
    TR.place(hero, 0, -1, TR.pose(hero, Object.assign({}, P.roar, { lift: Math.max(0, Math.sin(bt * 3.1)) * .25 })), 0);
    TR.S.stars.forEach((s, i) => {
      const ring = i < 7 ? 1.9 : 3.3, n = i < 7 ? 7 : 11, j = i < 7 ? i : i - 7;
      const a = j / n * Math.PI * 2 + (i < 7 ? .3 : 0), x = Math.sin(a) * ring, z = -1 + Math.cos(a) * ring;
      const kind = [P.roar, P.flex, P.roar, P.point, P.roar, P.spin][i % 6];
      const lift = Math.max(0, Math.sin(bt * 3.1 + i * 1.3)) * .3;
      TR.place(s.guy, x, z, TR.pose(s.guy, Object.assign({}, kind, { lift })), Math.atan2(-x, -1 - z) + Math.PI + Math.sin(bt + i) * .3);
    });
  }
  const G1 = { b0: 88, preset: "indoor", seed: 114,
    frame(bt, f) {
      TR.lights(1.1);
      if (bt < .05) { TR.cheer(5); TR.confetti(); }
      celebrate(bt);
      for (let i = 0; i < 6; i++) TR.hideBall(i);
      const a = .4 + bt * .45;
      TR.orbit([0, -1], a, lerp(8.5, 5.2, E.inOutCubic(bt / 8)), lerp(4.2, 1.1, E.inOutCubic(bt / 8)), 1.3, 50, .03);
      TR.clearNear(1.6);
    },
    ov(ctx, bt) { TR.clutchHud(ctx, 100, 99, 0, bt, .8, true); },
  };
  /* ========== G2 · 面部快切 96–100 ========== */
  const FACES = ["j23", "k24", "curry", "a03", "t01", "ionescu", "v15", "nova24"];
  const G2 = { b0: 96, preset: "indoor", seed: 115,
    frame(bt) {
      TR.lights(1.1);
      celebrate(bt + 8);
      const i = Math.min(7, Math.floor(bt * 2)), s = ST(FACES[i]), g = s.guy;
      g.g.updateMatrixWorld(true);
      const head = g.headRoot.localToWorld(V(0, 1.6, 0)), fwd = V(Math.sin(g.g.rotation.y), 0, Math.cos(g.g.rotation.y));
      const u = bt * 2 - i;
      const cp = head.clone().addScaledVector(fwd, lerp(1.25, 1.0, u)); cp.y += .02;
      const side = V(fwd.z, 0, -fwd.x); cp.addScaledVector(side, (i % 2 ? .3 : -.3));
      TR.cam([cp.x, cp.y, cp.z], [head.x, head.y, head.z], 38, (i % 2 ? .04 : -.04));
      TR.clearNear(1.1, g);
      this.s = s; this.u = u;
    },
    ov(ctx, bt) {
      TR.faceTag(ctx, this.s, E.outBack(clamp(this.u / .3)));
    },
  };
  /* ========== G3 · 英雄镜头 100–104 ========== */
  const G3 = { b0: 100, preset: "indoor", seed: 116,
    frame(bt) {
      TR.lights(1.1);
      celebrate(bt + 12);
      TR.orbit([0, -1], .1 + bt * .12, lerp(2.8, 2.2, bt / 4), lerp(.35, .7, bt / 4), 1.7, 50, .04 - bt * .01);
      TR.clearNear(2.4);
    },
    ov(ctx, bt) {
      TR.bigText(ctx, "BUZZER BEATER", TR.W / 2, 930, 100, PAL.white, 0, E.outBack(inv(.05, .3, bt)), PAL.gold);
      TR.mosaicK = bt > 3.5 ? Math.round(lerp(1, 22, E.inCubic(inv(3.5, 4, bt)))) : 1;
    },
  };

  /* ========== H · 结尾 104–128 ========== */
  const H0 = { b0: 104, preset: "indoor", seed: 117, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const pos = formation(0, -7, 0, 2.1, 2.4);
      TR.S.stars.forEach((s, i) => { TR.place(s.guy, pos[i][0], pos[i][1], TR.pose(s.guy, POSE_SET[i % 7] === "shot" ? P.stand : POSE_SET[i % 7]), Math.atan2(-pos[i][0], 16 - pos[i][1])); TR.wire(s.guy, s.id === "nova24"); });
      const { hero } = A();
      TR.place(hero, 2.2, 1.2, TR.pose(hero, P.spin), -.4);
      const g = TR.grip(hero); TR.ball(0, V(g.x, g.y + .2, g.z), bt * 9, false);
      const b = this.endBall(bt);
      if (b) TR.ball(1, b, b.x / .16); else TR.hideBall(1);
      TR.orbit([.5, -1], -.25 + Math.sin(bt * .08) * .2, 9.5, 1.6, 2.4, 44, 0);
      TR.shiftX(V(.5, 2.4, -1), -.25);
    },
    endBall(bt) {
      const t = bt - 16;
      if (t < 0) return null;
      const G = .16, keys = [[0, -2.4], [.4, -1.4], [1.2, -.9], [1.8, -.6], [2.2, -.45]];
      const x = t < 2.2 ? track(keys.map(k => [k[0], k[1], E.lin]), t) : -.45 + (1 - Math.exp(-(t - 2.2) * 2)) * .2;
      let y = G;
      if (t < .4) y = lerp(2, G, E.inQuad(t / .4)); else if (t < 1.2) { const u = (t - .4) / .8; y = G + .7 * 4 * u * (1 - u); } else if (t < 1.8) { const u = (t - 1.2) / .6; y = G + .3 * 4 * u * (1 - u); }
      return V(x, y, 3.5);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .2);
      TR.mosaicK = bt < .3 ? Math.round(lerp(22, 1, E.outCubic(bt / .3))) : 1;
      TR.logo(ctx, 640, 300, 820 * (bt < .35 ? lerp(2.4, 1, E.outQuint(inv(0, .35, bt))) : 1), 1, [[.4, 1.3], [12.2, 13.1]].map(([a, b]) => inv(a, b, bt)).find(x => x > 0 && x < 1));
      if (bt < 1.6) TR.goldBurst(ctx, 640, 300, bt / 1.6, 1, 11);
      if (bt >= 4) TR.slogan(ctx, 640, 620, "先到 100，就是王。", E.outBack(inv(4, 4.15, bt)));
      if (bt >= 8) TR.chips(ctx, 640, 760, ["AI 体感投篮", "NBA DNA", "百分大战", "RACK RUSH", "世界球场", "全球排行榜"], bt - 8);
      if (bt >= 12) TR.cta(ctx, 640, 920, inv(12, 12.5, bt));
      TR.fadeBlack = E.inOutCubic(inv(22, 24, bt));
    },
  };

  TR.SHOTS = [A0, B1, B2, C0, D1, D2, D3, E1, E2, E3, F1, F2, F3, G1, G2, G3, H0];
  TR.shotAt = function (f) { const b = TR.beatOf(f); for (let i = TR.SHOTS.length - 1; i >= 0; i--) if (b >= TR.SHOTS[i].b0) return TR.SHOTS[i]; return TR.SHOTS[0]; };
  TR.SHOTS.forEach((s, i) => { s.f0 = TR.frameOf(s.b0); s.f1 = i + 1 < TR.SHOTS.length ? TR.frameOf(TR.SHOTS[i + 1].b0) : TR.TOTAL_FRAMES; });
})(window.TR = window.TR || {});
