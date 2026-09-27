/* 02-shots —「NEURAL COURT」v4 分镜（见 STORYBOARD.md）。bt = 镜头内拍数，1 拍 = 0.4s。
   frame(bt,f)：摆演员/球/镜头；passes：可选多次渲染；compose：可选自定义合成；ov：HUD。
   原则：没有静止的人。每个人都在做自己的动作，群像里谁都不和谁同步；投篮一律 ph=1.0 松手。 */
(function (TR) {
  "use strict";
  const { clamp, lerp, inv, E, track, PAL } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = TR.POSES;
  const ST = (id) => TR.star(id);
  const SEC = 0.4;                                  // 1 拍 = 0.4 秒
  const HOOPV = () => V(HOOP.x, HOOP.y + .02, HOOP.z);
  const phase = (id) => (TR.hash(id.length * 97 + id.charCodeAt(0) * 13) * 3);   // 每人固定的动作相位

  /* ---------------- 卡点表 ---------------- */
  const C = [];
  const cue = (b, sfx, o = {}) => C.push(Object.assign({ b, sfx }, o));
  for (let i = 0; i < 26; i++) cue(i * .125 + .25, ["type"]);
  cue(2, ["sweep"], { shake: 6 }); cue(4, ["blip"]); cue(8, ["zapBig", "boom"], { shake: 18, punch: .06, flash: .25, flashCol: "120,230,255" });
  cue(15.5, ["whoosh"]);
  const ROSTER = [["thompson", .5], ["ionescu", .5], ["taurasi", .5], ["sue-bird", .5], ["korver", .5], ["stojakovic", .5], ["t01", .5], ["v15", .5],
    ["miller", 1], ["allen", 1], ["lillard", 1], ["h13", 1], ["bird", 1], ["a03", 1], ["k24", 1], ["j23", 1], ["curry", 1]];
  let acc = 0; for (const r of ROSTER) { r.push(acc); cue(16 + acc - .15, [r[1] > .5 ? "zapBig" : "zap"], { shake: r[1] > .5 ? 8 : 4, chroma: r[1] > .5 ? 4 : 0 }); acc += r[1]; }
  cue(29, ["boom", "crash"], { shake: 16, punch: .06, flash: .5, flashCol: "200,245,255" });
  cue(32, ["boom", "crash", "stab"], { shake: 30, punch: .12, invert: 2, chroma: 10 });
  cue(33, ["roarShort"]); cue(34, ["blip", "stab"], { shake: 8 });
  cue(36, ["whoosh"]); cue(37.6, ["boom", "stab"], { shake: 22, punch: .08, chroma: 8 });
  cue(44, ["shoot"], { shake: 6, chroma: 4 }); cue(46, ["pixel"]);
  for (let i = 0; i < 14; i++) cue(46.5 + i * .25, ["tick"]);
  cue(50, ["lock", "stab"], { shake: 14, punch: .06, chroma: 8 });
  for (let i = 0; i < 8; i++) cue(52 + i * .5, ["whip"], { shake: 5, chroma: 4 });
  for (let k = 0; k < 5; k++) { cue(56 + 2 * k + .5, ["shoot"], { shake: 6 }); cue(56 + 2 * k + 1.5, ["shoot", "blip"], { shake: 6, chroma: 4 }); }
  cue(67.6, ["shoot"], { chroma: 6 }); cue(69, ["swish", "boom", "crash", "stab", "roarShort"], { shake: 30, punch: .1, invert: 2, chroma: 12 });
  for (let b = 70; b < 74; b++) cue(b, ["whip", "stab"], { shake: 10, punch: .04, chroma: 5 });
  cue(74, ["heart", "hush"]); for (let b = 75; b < 86; b++) cue(b, ["heart"]);
  cue(82.5, ["catch"]); cue(86.5, ["shoot"]); cue(88.5, ["buzzer"], { flash: .45, flashCol: "255,60,60" });
  cue(90, ["swish", "boom", "crash", "roar", "stab"], { shake: 42, sdur: 14, punch: .15, invert: 2, chroma: 14 });
  cue(92, ["yell"], { shake: 14 });
  for (let i = 0; i < 8; i++) cue(98 + i * .5, ["whip"], { shake: 6, chroma: 5 });
  cue(102, ["boom", "stab"], { shake: 16, punch: .06 });
  cue(104, ["pixel", "boom"], { shake: 10 }); cue(104.4, ["ding"]);
  cue(108, ["blip", "stab"], { shake: 10, punch: .04 });
  for (let i = 0; i < 6; i++) cue(112 + i * .5, ["blip"]);
  cue(112, ["boom", "stabLong"], { shake: 8, punch: .03 });
  cue(116, ["blip"]);
  cue(120, ["bounceS"]); cue(120.8, ["bounceS2"]); cue(121.4, ["bounceS3"]);
  TR.CUES = C;

  function formation(cx, cz, spread = 1.9, depth = 2.2) {
    return TR.S.stars.map((s, i) => { const row = Math.floor(i / 6), col = i % 6; return [cx + (col - 2.5) * spread + (row % 2) * spread * .5, cz - row * depth]; });
  }
  /* 让一位球员按"招牌动作"在 (x,z) 动起来；slow = 慢放倍率 */
  function sig(s, bt, x, z, face, slow = 1, target = null, act) {
    return TR.act(s.guy, act || TR.SIGNATURE[s.id], bt * SEC * slow, { x, z, face, target, ph0: phase(s.id) });
  }
  /* 投篮时机控制：rel = 松手所在拍；返回动作时间（秒），<0 表示还没开始蓄力 */
  const shotT = (bt, rel, slow = 1) => (bt - rel) * SEC * slow + TR.SHOT.charge;

  /* ========== A · BOOT 0–16 ========== */
  const A0 = { b0: 0, preset: "indoor", seed: 101, void: true,
    frame(bt, f) {
      const s = ST("nova24"), n = s.guy;
      TR.voidTick(f / 30, E.outCubic(inv(2, 4.5, bt)));
      if (bt >= 8) {
        const top = n.holoTop * (n.g.scale.y || 1) + .12, scan = lerp(0, top, E.inOutCubic(inv(8, 11.2, bt)));
        TR.act(n, bt < 11.5 ? "stand" : "dribble", (bt - 8) * SEC * .45, { x: 0, z: -2, face: 0 });
        if (bt < 11.5) TR.hideGuyBall(n);
        TR.holo(n, scan, .4);
        if (scan < top) TR.ring(0, scan, -2, 1.3 + Math.sin(bt * 9) * .03);
      }
      if (bt < 8) TR.cam([Math.sin(bt * .3) * .6, lerp(3.2, 1.4, E.inOutCubic(bt / 8)), lerp(12, 4.5, E.inOutCubic(bt / 8))], [0, .8, -2], 50, .02);
      else { const u = inv(8, 16, bt); TR.orbit([0, -2], lerp(.95, -.35, E.inOutCubic(u)), lerp(3.6, 2.5, u), lerp(.35, 1.0, u), lerp(1.1, 1.3, u), 42, lerp(.05, -.02, u)); }
      this.box = TR.boxOf(n);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .35);
      TR.terminal(ctx, bt, [["> aiBA NEURAL COURT // BOOT", 0], ["> loading voxel engine ........ OK", 1.2], ["> pose model: 33 landmarks ..... OK", 2.4], ["> RECONSTRUCTING LEGENDS", 3.6]]);
      if (bt >= 4 && bt < 8.5) TR.progress(ctx, E.inOutCubic(inv(4, 8, bt)), 1 - inv(8, 8.5, bt));
      if (bt >= 8) TR.brackets(ctx, this.box, bt < 11.2 ? PAL.cyan : PAL.gold, bt < 11.2 ? "SCANNING " + Math.round(inv(8, 11.2, bt) * 100) + "%" : "RECONSTRUCTED");
      if (bt >= 11.5) { TR.starCard(ctx, ST("nova24"), 1260, 520, E.outBack(inv(11.5, 11.9, bt)), "AI ORIGINAL"); TR.slowTag(ctx, .45); }
    },
  };

  /* ========== B1 · ROSTER 长廊 16–29：普通球星半拍，75 大一拍 ========== */
  const B1 = { b0: 16, preset: "indoor", seed: 102, void: true,
    zOf: (T) => -3.7 - 4 * T,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const camZ = 1.8 - 4 * bt;
      this.cards = [];
      ROSTER.forEach(([id, dur, T], k) => {
        const s = ST(id), g = s.guy, z = this.zOf(T) - (dur > .5 ? 1 : 0), x = (k % 2 ? 1.75 : -1.75);
        if (bt < T - .35 || z > camZ + 1.2) { g.g.visible = false; TR.hideGuyBall(g); return; }
        sig(s, bt - T + .35, x, z, Math.atan2(-x * .6, 5), .4);
        const top = g.holoTop * (g.g.scale.y || 1) + .12, scan = lerp(0, top, E.inOutCubic(inv(T - .35, T + (dur > .5 ? .5 : .3), bt)));
        TR.holo(g, scan, .45);
        if (scan < top) TR.ring(x, scan, z, 1.25);
        if (bt >= T && bt < T + dur) this.cards.push({ s, k, box: TR.boxOf(g), a: E.outBack(inv(T, T + .18, bt)) * (1 - inv(T + dur - .1, T + dur, bt)), big: dur > .5 });
      });
      TR.cam([Math.sin(bt * .9) * .25, 1.55, camZ], [Math.sin(bt * .9) * .1, 1.3, camZ - 9], 56, Math.sin(bt * .6) * .025);
    },
    ov(ctx, bt) {
      TR.dataRain(ctx, bt, .25);
      for (const c of this.cards) if (c.box && c.box.on) {
        const right = c.k % 2 === 1;
        const x = clamp(right ? c.box.x0 - 24 : c.box.x1 + 24, right ? 470 : 40, right ? TR.W - 40 : TR.W - 470);
        const y = clamp(c.box.y0 + (c.box.y1 - c.box.y0) * .38, 160, TR.H - 160);
        TR.brackets(ctx, c.box, c.big ? PAL.gold : PAL.cyan, c.big ? "NBA 75 GREATEST" : null);
        TR.starCard(ctx, c.s, x, y, c.a, c.big ? "NBA 75 · OVR " + c.s.ovr : null, right ? "right" : "left", c.big ? 1.05 : .85);
      }
      TR.counter(ctx, Math.min(18, 1 + this.cards.reduce((m, c) => Math.max(m, c.k + 1), 0)), bt);
      TR.slowTag(ctx, .4);
    },
  };

  /* ========== B2 · 全员阵列 29–32（各自慢动作） ========== */
  const B2 = { b0: 29, preset: "indoor", seed: 103, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const pos = formation(0, -4);
      TR.S.stars.forEach((s, i) => sig(s, bt + 6, pos[i][0], pos[i][1], Math.atan2(-pos[i][0], 16 - pos[i][1]), .5));
      const u = E.inOutCubic(bt / 3);
      TR.cam([0, lerp(1.2, 4.2, u), lerp(2.2, 7.5, u)], [0, lerp(1.5, 1.0, u), -6], 56, 0);
    },
    ov(ctx, bt) { TR.dataRain(ctx, bt, .25); TR.lowerThird(ctx, "18 LEGENDS · RECONSTRUCTED BY AI", "18 位传奇 · 由 AI 重建", E.outBack(inv(.6, .9, bt))); TR.slowTag(ctx, .5); },
  };

  /* ========== C1 · TITLE 32–36：虚空翻成球馆，全员热身各练各的 ========== */
  const WARM = [["curry", 2.6, -.3], ["j23", -2.8, 1.4], ["k24", 4.6, -2.6], ["a03", -.8, 3.4], ["bird", -5.4, -2.2], ["h13", 1.6, 2.8], ["lillard", 3.6, 1.2], ["allen", -6.4, -5.4], ["miller", 6.2, -5.2],
    ["nova24", 0, 1.2], ["thompson", -3.8, -.4], ["ionescu", 5.4, 3.4], ["taurasi", -5.2, 2.6], ["sue-bird", 2.2, 4.4], ["korver", 7, -1.6], ["stojakovic", -1.4, 5.2], ["t01", -4.4, 4.6], ["v15", 4.4, -.6]];
  function warmup(bt, slow = 1) {
    WARM.forEach(([id, x, z]) => { const s = ST(id); const act = TR.SIGNATURE[id] === "leap" ? "shoot" : TR.SIGNATURE[id]; sig(s, bt, x, z, act === "shoot" ? TR.faceHoop(x, z) : Math.atan2(-x * .3, 12 - z), slow, act === "shoot" ? HOOPV() : null, act); });
  }
  const C1 = { b0: 32, preset: "indoor", seed: 104,
    frame(bt) {
      TR.lights(lerp(1.5, 1, inv(0, .6, bt)));
      if (bt < .05) TR.cheer(5);
      warmup(bt, .8);
      const u = E.outCubic(bt / 4);
      TR.cam([lerp(-3, 1.5, u), lerp(1.4, 3.2, u), lerp(13, 11, u)], [0, 2, -1], 50, -.02);
      TR.clearNear(1.5);
    },
    ov(ctx, bt) {
      const sc = bt < .3 ? lerp(3, 1, E.outQuint(bt / .3)) : 1 + (bt - .3) * .006;
      TR.logo(ctx, TR.W / 2, 250, 760 * sc, 1, inv(.4, 1.3, bt) > 0 && inv(.4, 1.3, bt) < 1 ? inv(.4, 1.3, bt) : undefined);
      if (bt < 1.6) TR.goldBurst(ctx, TR.W / 2, 250, bt / 1.6, 1.1, 3);
      if (bt >= 2) TR.lowerThird(ctx, "AI LEGENDS · RACE TO 100", "和 AI 传奇 · 同场决战 100 分", E.outBack(inv(2, 2.2, bt)), PAL.gold);
    },
  };
  /* ========== C2 · 热身单手扣篮 36–40（游戏原生动作，乔丹） ========== */
  const C2 = { b0: 36, preset: "indoor", seed: 105,
    frame(bt) {
      TR.lights(1);
      const u = track([[0, 0], [1.2, .34, E.inOutCubic], [2.8, .56, E.lin], [4, .98, E.inOutCubic]], bt);   // 起跳到扣篮那一段慢放
      const j = ST("j23");
      TR.gameDunk(j.guy, u, V(.5, 0, HOOP.z + 4.4));
      [["curry", -3.2, -2.4], ["k24", 3.4, -3], ["a03", -1.8, -4.6]].forEach(([id, x, z]) => sig(ST(id), bt + 5, x, z, TR.faceHoop(x, z), 1, HOOPV(), "shoot"));
      const k = E.inOutCubic(bt / 4);
      TR.cam([lerp(-2.6, -1.9, k), lerp(2.2, 2.9, k), lerp(HOOP.z + 4.6, HOOP.z + 3.6, k)], [lerp(.4, .1, k), lerp(2.2, 2.9, k), HOOP.z + 1.2], 52, -.03);
      TR.clearNear(1.2, j.guy);
    },
    ov(ctx, bt) {
      TR.featureTag(ctx, 1480, 120, "WARM-UP DUNK", "热身 · 单手扣篮", E.outBack(inv(.2, .4, bt)));
      TR.faceTag(ctx, ST("j23"), E.outBack(inv(.4, .6, bt)));
      if (bt > 1.2 && bt < 2.8) TR.slowTag(ctx, .35);
    },
  };

  /* ========== D1 · 体感投篮 40–46：你的动作 → 库里同步出手 ========== */
  const D1 = { b0: 40, preset: "indoor", seed: 106,
    frame(bt) {
      const { human } = TR.S.actors, c = ST("curry");
      const t = shotT(bt, 4, .75);
      TR.act(c.guy, "shoot", Math.max(0, t), { x: 0, z: -.6, face: Math.PI, target: HOOPV() });
      TR.act(human, "shoot", Math.max(0, t), { x: 60, z: 60.3, face: 0, noBall: true });
      TR.hideGuyBall(human);
    },
    passes(bt) {
      TR.cam([60.15, 1.25, 63.4], [60, 1.25, 60.2], 44); TR.render(); TR.copyPass("A");
      this.skel = TR.skeleton(TR.S.actors.human);
      TR.orbit([0, -.6], Math.PI + .75 - bt * .04, 4.4, 1.3, 1.5, 38); TR.shiftX(V(0, 1.5, -.6), .42); TR.render(); TR.copyPass("B");
    },
    compose(ctx, bt) {
      TR.drawPass(ctx, "B");
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1020, 0); ctx.lineTo(880, TR.H); ctx.lineTo(0, TR.H); ctx.closePath(); ctx.clip();
      TR.drawPass(ctx, "A", -300); TR.drawSkeleton(ctx, this.skel, -300); TR.camHud(ctx, bt);
      ctx.restore();
      TR.splitLine(ctx, 1020, 0, 880, TR.H);
    },
    ov(ctx, bt) {
      TR.mosaicK = bt < .3 ? Math.round(lerp(20, 1, E.outCubic(bt / .3))) : 1;
      TR.featureTag(ctx, 1500, 120, "AI MOTION SHOT", "体感投篮 · 真实动作出手", E.outBack(inv(.3, .5, bt)));
      TR.metric(ctx, 120, 950, "POSE CONF", (0.95 + Math.sin(bt * 5) * .02).toFixed(2), PAL.green);
      TR.metric(ctx, 420, 950, "LATENCY", Math.round(16 + Math.sin(bt * 7) * 3) + "ms", PAL.cyan);
    },
  };

  /* ========== D2 · NBA DNA 46–52：6 位传奇各自的投篮慢动作 ========== */
  const DNA_IDS = ["curry", "j23", "k24", "bird", "allen", "lillard"], DNA_SCORE = [84, 88, 91, 76, 82, 79];
  const D2 = { b0: 46, preset: "indoor", seed: 107, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      DNA_IDS.forEach((id, i) => {
        const s = ST(id), x = (i - 2.5) * 1.9;
        TR.act(s.guy, "shoot", (bt * SEC * .45 + i * .37) % 2.2, { x, z: -3, face: 0, target: null });
        if (bt >= 4 && id === "k24") TR.solid(s.guy); else TR.wire(s.guy, false);
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
      TR.slowTag(ctx, .45);
    },
  };

  /* ========== D3 · 传奇特写 52–56：球衣号码 / 出手 / 球鞋 / 面部，每半拍一张 ========== */
  const DETAILS = [["j23", "jersey", "#23"], ["k24", "release", "RELEASE · 出手"], ["curry", "shoes", "SNEAKERS · 球鞋"], ["a03", "face", ""],
    ["bird", "release", "RELEASE · 出手"], ["h13", "jersey", "#13"], ["allen", "shoes", "SNEAKERS · 球鞋"], ["lillard", "face", ""]];
  const D3 = { b0: 52, preset: "indoor", seed: 108,
    frame(bt) {
      TR.lights(.9);
      const i = Math.min(7, Math.floor(bt * 2)), u = bt * 2 - i, [id, kind] = DETAILS[i], s = ST(id), g = s.guy;
      TR.S.stars.forEach(o => { if (o !== s) { o.guy.g.visible = false; TR.hideGuyBall(o.guy); } });
      const x = 0, z = -.6;
      if (kind === "release") TR.act(g, "shoot", .82 + u * .35, { x, z, face: Math.PI, target: HOOPV() });          // 出手前后 0.35 秒，慢放到半拍
      else if (kind === "shoes") TR.act(g, "dribble", u * .5 + i, { x, z, face: 0 });
      else if (kind === "face") TR.act(g, TR.SIGNATURE[id] === "cross" ? "cross" : "spin", u * .6 + i, { x, z, face: 0 });
      else TR.act(g, "stand", u * .5 + i, { x, z, face: 0 });
      g.g.updateMatrixWorld(true);
      const side = i % 2 ? 1 : -1;
      if (kind === "jersey") { const c = g.g.localToWorld(V(0, 1.18, 0)); TR.cam([c.x + side * .35, c.y + .05, c.z + lerp(1.05, .85, u)], [c.x, c.y, c.z], 40, side * .04); }
      else if (kind === "face") { const h = g.headRoot.localToWorld(V(0, 1.62, 0)); TR.cam([h.x + side * .3, h.y + .02, h.z + lerp(.95, .8, u)], [h.x, h.y, h.z], 38, side * .04); }
      else if (kind === "shoes") { const a = TR.world(g.ankles[0]); TR.cam([a.x + side * .55, .18, a.z + .6], [a.x, .1, a.z], 42, side * .05); }
      else { const hnd = TR.hand(g, 0); TR.cam([hnd.x + side * .7, hnd.y - .15, hnd.z + .9], [hnd.x, hnd.y + .1, hnd.z - .3], 40, side * .04); }
      this.i = i; this.u = u;
    },
    ov(ctx, bt) {
      const [id, kind, cap] = DETAILS[this.i], s = ST(id);
      TR.faceTag(ctx, s, E.outBack(clamp(this.u / .3)));
      if (cap) TR.txt(ctx, cap, 130, TR.H - 240, { size: 30, color: PAL.gold, align: "left", spacing: 3 });
      TR.slowTag(ctx, .25);
    },
  };

  /* ========== E1 · 百分大战：你（库里）vs AI 传奇，你来我往 56–66 ========== */
  const DUEL = [["j23", [5.62, -2.38], [-3.7, .95]], ["k24", [3.7, .95], [-5.62, -2.38]], ["h13", [0, -.05], [-7.2, -6.15]], ["lillard", [7.2, -6.15], [-3.7, .95]], ["bird", [-3.7, .95], [5.62, -2.38]]];
  const FLY = 2.0;                                  // 球飞行 2 拍（0.8s）
  const EVENTS = []; DUEL.forEach(([oid, mySpot, opSpot], k) => { EVENTS.push({ who: "curry", spot: mySpot, rel: 2 * k + .5, k }); EVENTS.push({ who: oid, spot: opSpot, rel: 2 * k + 1.5, k }); });
  const E1 = { b0: 56, preset: "indoor", seed: 109,
    setup() { this.cache = {}; },
    relPos(e) {           // 该球员在这个点位 ph=1 时的手部位置（松手点）
      if (this.cache[e.rel]) return this.cache[e.rel];
      const g = ST(e.who).guy, y = TR.shoot(g, 1); TR.place(g, e.spot[0], e.spot[1], y, TR.faceHoop(...e.spot));
      const p = TR.grip(g); return (this.cache[e.rel] = V(p.x, p.y + .04, p.z));
    },
    frame(bt) {
      TR.lights(1);
      const k = Math.min(4, Math.floor(bt / 2)), lb = bt - 2 * k, [oid] = DUEL[k];
      const me = ST("curry"), op = ST(oid);
      TR.S.stars.forEach(o => { if (o !== me && o !== op) { o.guy.g.visible = false; TR.hideGuyBall(o.guy); } });
      const evMe = EVENTS[2 * k], evOp = EVENTS[2 * k + 1];
      EVENTS.forEach(e => this.relPos(e));
      for (const [s, e, idle] of [[me, evMe, 0], [op, evOp, 1]]) {
        const t = shotT(bt, e.rel), face = TR.faceHoop(...e.spot);
        if (t < 0) TR.act(s.guy, "dribble", bt * SEC + idle, { x: e.spot[0], z: e.spot[1], face });
        else TR.act(s.guy, "shoot", Math.min(t, 2.1), { x: e.spot[0], z: e.spot[1], face, noBall: t >= TR.SHOT.charge });
        if (t >= TR.SHOT.charge) TR.hideGuyBall(s.guy);
      }
      // 空中的球：每一投独立，跨剪辑继续飞
      let slot = 0, netAge = 99;
      this.scoreY = 0; this.scoreO = 0;
      EVENTS.forEach(e => {
        const d = bt - e.rel;
        if (d >= FLY) { if (e.who === "curry") this.scoreY++; else this.scoreO++; netAge = Math.min(netAge, (d - FLY) * SEC); }
        if (d < 0 || d > FLY + 1) return;
        const u = Math.min(1, d / FLY), from = this.cache[e.rel];
        const p = u < 1 ? from.clone().lerp(HOOPV(), u).add(V(0, 1.5 * 4 * u * (1 - u), 0)) : TR.drop((d - FLY) * SEC);
        if (slot < 6) TR.ball(slot++, p, d * 4);
      });
      for (; slot < 6; slot++) TR.hideBall(slot);
      TR.net(netAge < 1 ? netAge : -1, 1, 0);
      // 机位：你出手时从你身后越肩；对手出手时切到对手正侧
      // 机位一律放在场内（朝中圈方向偏移），场边观众不会挡镜头
      const mine = lb < 1.05, e = mine ? evMe : evOp;
      const toC = V(-e.spot[0], 0, 3.2 - e.spot[1]).normalize(), side = V(toC.z, 0, -toC.x);
      const cp = V(e.spot[0], 0, e.spot[1]).addScaledVector(toC, mine ? 2.9 : 3.6).addScaledVector(side, mine ? .9 : -1.3);
      cp.x = clamp(cp.x, -6.6, 6.6); cp.z = clamp(cp.z, -7, 6);
      TR.cam([cp.x, mine ? 1.9 : 1.15, cp.z], [lerp(e.spot[0], HOOP.x, .3), mine ? 2.3 : 1.7, lerp(e.spot[1], HOOP.z, .3)], mine ? 50 : 46, mine ? .03 : -.03);
      this.k = k; this.lb = lb; this.op = op;
    },
    ov(ctx, bt) {
      const y = 75 + 3 * this.scoreY, o = 77 + [0, 3, 5, 8, 11, 14][this.scoreO];
      TR.battleHud(ctx, y, o, bt, this.op, "库里");
      TR.oppCard(ctx, this.op, E.outBack(clamp(this.lb / .3)));
      TR.txt(ctx, this.lb < 1.05 ? "YOUR SHOT · 你出手" : "AI ANSWERS · AI 回应", TR.W - 120, TR.H - 120, { size: 30, color: this.lb < 1.05 ? PAL.cyan : PAL.salmon, align: "right", spacing: 3, font: "'ZCOOL QingKe HuangYou', Orbitron" });
    },
  };

  /* ========== E2 · 最后一球：库里中场 LOGO 超远 10 分 66–70 ========== */
  const LOGO = [0, 4.245];
  const E2 = { b0: 66, preset: "indoor", seed: 110,
    frame(bt) {
      TR.lights(1);
      const me = ST("curry"), op = ST("bird");
      TR.S.stars.forEach(o => { if (o !== me && o !== op) { o.guy.g.visible = false; TR.hideGuyBall(o.guy); } });
      // 慢放：1.6 拍蓄力（0.5×），松手在 67.6；球飞 1.4 拍，69 入网
      const t = bt < 1.6 ? shotT(bt, 1.6, .5) * 1 : TR.SHOT.charge + (bt - 1.6) * SEC * .8;
      const tt = bt < 1.6 ? (bt / 1.6) * TR.SHOT.charge : t;
      TR.act(me.guy, "shoot", Math.min(tt, 1.45), { x: LOGO[0], z: LOGO[1], face: Math.PI, target: null, noBall: true });
      TR.hideGuyBall(me.guy);
      if (!this.rel || bt < .05) { const y = TR.shoot(me.guy, 1); TR.place(me.guy, LOGO[0], LOGO[1], y, Math.PI); const g = TR.grip(me.guy); this.rel = V(g.x, g.y + .04, g.z); TR.act(me.guy, "shoot", Math.min(tt, 1.45), { x: LOGO[0], z: LOGO[1], face: Math.PI, noBall: true }); TR.hideGuyBall(me.guy); }
      if (bt >= 3.1) TR.act(me.guy, "fist", (bt - 3.1) * SEC, { x: LOGO[0], z: LOGO[1], face: Math.PI + .6 });
      TR.act(op.guy, "stand", bt * SEC, { x: 2.6, z: 1.8, face: [0, 4.245].length && Math.atan2(-2.6, 2.4) });
      let ball;
      if (bt < 1.6) { const g = TR.grip(me.guy); ball = V(g.x, g.y + .04, g.z); }
      else if (bt < 3) { const u = E.inOutQuad((bt - 1.6) / 1.4); ball = this.rel.clone().lerp(HOOPV(), u); ball.y += 3.4 * 4 * u * (1 - u); }
      else ball = TR.drop((bt - 3) * .6);
      TR.ball(0, ball, bt * 3, true);
      TR.net(bt >= 3 ? (bt - 3) * .6 : -1, 1.3, 0);
      if (bt >= 3 && !this.boom) { this.boom = true; TR.cheer(5); TR.confetti(); }
      if (bt < 1.6) TR.orbit(LOGO, Math.PI + 2.4 - bt * .5, 3.2, .55, 1.8, 46, .04);
      else if (bt < 2.7) { const u = inv(1.6, 2.7, bt); TR.cam([ball.x + .8, ball.y + .3, ball.z + 2.2], [lerp(ball.x, HOOP.x, .5), lerp(ball.y, HOOP.y, .3), lerp(ball.z, HOOP.z, .6)], 50, -.04); }
      else TR.cam([1.5, 2.0, HOOP.z + 4.4], [0, HOOP.y - .3, HOOP.z], 50, 0);
      this.rim = TR.project(HOOPV());
    },
    ov(ctx, bt) {
      TR.battleHud(ctx, bt >= 3 ? 100 : 90, 91, bt, ST("bird"), "库里");
      if (bt < 1.6) { TR.featureTag(ctx, 420, 900, "HALF-COURT LOGO SHOT", "中场 LOGO 超远 · 一球 10 分", E.outBack(inv(0, .2, bt))); TR.slowTag(ctx, .5); }
      if (bt >= 3) { TR.goldBurst(ctx, this.rim[0], this.rim[1], inv(3, 4, bt), 1.5, 21); TR.bigText(ctx, "100!", 560, 720, 300, PAL.gold, -.08, E.outBack(inv(3.02, 3.25, bt)), "#ff4040"); TR.bigText(ctx, "+10", 1400, 420, 150, PAL.green, .08, E.outBack(inv(3.05, 3.25, bt))); }
    },
  };

  /* ========== E3 · RACK RUSH + 世界球场 70–74 ========== */
  const WORLDS = [["indoor", "RACK RUSH · 投篮机", "allen"], ["flowerCourt", "峡谷雨林", "a03"], ["shonanCoast", "湘南海岸", "miller"], ["medCliff", "地中海半岛", "lillard"]];
  const E3 = { b0: 70, preset: "indoor", seed: 111,
    frame(bt) {
      const k = Math.min(3, Math.floor(bt)), w = WORLDS[k], u = bt - k;
      if (TR.S.preset !== w[0]) { applyScenePreset(w[0], { silent: true, persist: false }); TR.S.preset = w[0]; for (let i = 0; i < 3; i++) updateEnvironment(1 / 30); TR.hideParody(); }
      TR.S.stars.forEach(o => { o.guy.g.visible = false; TR.hideGuyBall(o.guy); });
      const s = ST(w[2]);
      const spot = k === 0 ? [4.55, -1.1] : [0, -.5];
      TR.act(s.guy, "shoot", shotT(u, .45), { x: spot[0], z: spot[1], face: TR.faceHoop(...spot), target: HOOPV() });
      if (k === 0) { TR.rack(V(5.5, .9, -1.8)); TR.cam([8.6, 2.1, 3], [2.6, 2, -4.2], 50); }
      else TR.orbit(spot, Math.PI - 1.1 + bt * .5, 3.4, .8, 1.9, 46, .03);
      this.star = s;
    },
    ov(ctx, bt) {
      const k = Math.min(3, Math.floor(bt)), u = bt - k;
      TR.placeTag(ctx, WORLDS[k][1], E.outBack(inv(0, .12, u)), this.star);
      if (u < .12) TR.streaks(ctx, u / .12, 0);
    },
  };

  /* ========== F · 绝杀时刻 74–92：直接跑游戏本体模式（第一人称） ========== */
  const F0 = { b0: 74, preset: "indoor", seed: 1, live: true,
    setup() { TR.liveStart({ skip: 3.0, cast: { ally0: "k24", ally1: "j23", ally2: "a03", ally3: "bird", foe0: "nova24", foe1: "h13", foe2: "lillard", foe3: "allen", foe4: "miller" } }); TR.hideParody(); },
    frame(bt) { this.LS = TR.liveStep(); TR.hideParody(); },
    ov(ctx, bt) {
      const LS = this.LS || {}, cfg = LS.cfg || { scoreHome: 85, scoreAway: 86, gameClock: 7 };
      const clock = Math.max(0, cfg.gameClock - (LS.t || 0));
      const made = bt >= 16;
      TR.lastShotHud(ctx, made ? cfg.scoreHome + 3 : cfg.scoreHome, cfg.scoreAway, clock, bt);
      if (bt < 2.2) TR.featureTag(ctx, TR.W / 2, 520, "THE LAST SHOT", "每日挑战 · 绝杀时刻", E.outBack(inv(0, .2, bt)) * (1 - inv(1.9, 2.2, bt)));
      if (bt > 2 && bt < 8.5) { const sq = AIBALastShotSquad.squad, a = sq && sq.actors.ally0; if (a && a.guy.g.visible) { a.guy.g.updateMatrixWorld(true); const p = TR.project(a.guy.g.localToWorld(V(0, 2.25, 0))); if (p[2] < 1) TR.pointerTag(ctx, p[0], p[1], "科比·布莱恩特 · 持球核心", "#24"); } }
      if (bt > 8.5 && bt < 12.5) TR.txt(ctx, "FIRST-PERSON · 接球 → 出手", TR.W / 2, TR.H - 120, { size: 32, color: PAL.cyan, spacing: 4 });
      if (made) TR.bigText(ctx, "绝杀!", TR.W / 2, 560, 260, PAL.gold, -.05, E.outBack(inv(16, 16.25, bt)), "#ff4040", "'ZCOOL QingKe HuangYou'");
    },
  };

  /* ========== G · 全员庆祝 92–98 / 面部快切 98–102 / 英雄镜头 102–104 ========== */
  function celebrate(bt) {
    TR.S.stars.forEach((s, i) => {
      const ring = i < 7 ? 1.9 : 3.4, n = i < 7 ? 7 : 11, j = i < 7 ? i : i - 7;
      const a = j / n * Math.PI * 2 + (i < 7 ? .3 : 0), x = s.id === "curry" ? 0 : Math.sin(a) * ring, z = s.id === "curry" ? -1 : -1 + Math.cos(a) * ring;
      TR.act(s.guy, TR.CELEBRATE[s.id], bt * SEC, { x, z, face: Math.atan2(-x, -1 - z) + Math.PI + Math.sin(i) * .4, ph0: phase(s.id) });
    });
  }
  const G1 = { b0: 92, preset: "indoor", seed: 112,
    frame(bt) {
      TR.lights(1.1);
      if (bt < .05) { TR.cheer(5); TR.confetti(); }
      celebrate(bt);
      TR.orbit([0, -1], .4 + bt * .6, lerp(8.5, 5.2, E.inOutCubic(bt / 6)), lerp(4.2, 1.1, E.inOutCubic(bt / 6)), 1.3, 50, .03);
      TR.clearNear(1.6);
    },
    ov(ctx, bt) { TR.lastShotHud(ctx, 88, 86, 0, 20, true); },
  };
  const FACES = ["j23", "k24", "curry", "a03", "bird", "h13", "lillard", "allen"];
  const G2 = { b0: 98, preset: "indoor", seed: 113,
    frame(bt) {
      TR.lights(1.1);
      celebrate(bt + 15);
      const i = Math.min(7, Math.floor(bt * 2)), s = ST(FACES[i]), g = s.guy;
      g.g.updateMatrixWorld(true);
      const head = g.headRoot.localToWorld(V(0, 1.62, 0)), fwd = V(Math.sin(g.g.rotation.y), 0, Math.cos(g.g.rotation.y));
      const u = bt * 2 - i;
      const cp = head.clone().addScaledVector(fwd, lerp(1.25, 1.0, u)); cp.y += .02;
      cp.addScaledVector(V(fwd.z, 0, -fwd.x), (i % 2 ? .3 : -.3));
      TR.cam([cp.x, cp.y, cp.z], [head.x, head.y, head.z], 38, (i % 2 ? .04 : -.04));
      TR.clearNear(1.1, g);
      this.s = s; this.u = u;
    },
    ov(ctx) { TR.faceTag(ctx, this.s, E.outBack(clamp(this.u / .3))); },
  };
  const G3 = { b0: 102, preset: "indoor", seed: 114,
    frame(bt) {
      TR.lights(1.1);
      celebrate(bt + 25);
      TR.orbit([0, -1], .1 + bt * .12, lerp(2.8, 2.2, bt / 2), lerp(.35, .7, bt / 2), 1.7, 50, .04 - bt * .01);
      TR.clearNear(2.4, ST("curry").guy);
    },
    ov(ctx, bt) {
      TR.bigText(ctx, "BUZZER BEATER", TR.W / 2, 930, 100, PAL.white, 0, E.outBack(inv(.05, .3, bt)), PAL.gold);
      TR.mosaicK = bt > 1.5 ? Math.round(lerp(1, 22, E.inCubic(inv(1.5, 2, bt)))) : 1;
    },
  };

  /* ========== H · 结尾 104–128 ========== */
  const H0 = { b0: 104, preset: "indoor", seed: 115, void: true,
    frame(bt, f) {
      TR.voidTick(f / 30, 1);
      const pos = formation(0, -7, 2.1, 2.4);
      TR.S.stars.forEach((s, i) => { if (s.id === "curry") return; sig(s, bt + 3, pos[i][0], pos[i][1], Math.atan2(-pos[i][0], 16 - pos[i][1]), .35); TR.holo(s.guy, 1.2 + Math.sin(bt * .4 + i) * .5, .5, s.id === "nova24"); });
      const c = ST("curry");
      TR.act(c.guy, "spin", bt * SEC, { x: 2.2, z: 1.2, face: -.4 });
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
      const sh = inv(.4, 1.3, bt) > 0 && inv(.4, 1.3, bt) < 1 ? inv(.4, 1.3, bt) : inv(12.2, 13.1, bt) > 0 && inv(12.2, 13.1, bt) < 1 ? inv(12.2, 13.1, bt) : undefined;
      TR.logo(ctx, 640, 300, 820 * (bt < .35 ? lerp(2.4, 1, E.outQuint(inv(0, .35, bt))) : 1), 1, sh);
      if (bt < 1.6) TR.goldBurst(ctx, 640, 300, bt / 1.6, 1, 11);
      if (bt >= 4) TR.slogan(ctx, 640, 620, "先到 100，就是王。", E.outBack(inv(4, 4.15, bt)));
      if (bt >= 8) TR.chips(ctx, 640, 760, ["AI 体感投篮", "NBA DNA", "百分大战", "RACK RUSH", "世界球场", "全球排行榜"], bt - 8);
      if (bt >= 12) TR.cta(ctx, 640, 920, inv(12, 12.5, bt));
      TR.fadeBlack = E.inOutCubic(inv(22, 24, bt));
    },
  };

  TR.SHOTS = [A0, B1, B2, C1, C2, D1, D2, D3, E1, E2, E3, F0, G1, G2, G3, H0];
  TR.shotAt = function (f) { const b = TR.beatOf(f); for (let i = TR.SHOTS.length - 1; i >= 0; i--) if (b >= TR.SHOTS[i].b0) return TR.SHOTS[i]; return TR.SHOTS[0]; };
  TR.SHOTS.forEach((s, i) => { s.f0 = TR.frameOf(s.b0); s.f1 = i + 1 < TR.SHOTS.length ? TR.frameOf(TR.SHOTS[i + 1].b0) : TR.TOTAL_FRAMES; });
})(window.TR = window.TR || {});
