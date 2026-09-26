/* 02-shots — 分镜 S1–S13。bt = 镜头内拍数（浮点）。
   frame(bt,f)：摆演员/球/镜头（每帧都会被顺序调用，用于推进有状态的特效）
   passes(bt,f)：可选，多次渲染（分屏），否则主循环 render 一次
   ov(ctx,bt,f)：2D HUD 层
   CUES 同时驱动画面卡点（震动/推镜/反相）与音效。 */
(function (TR) {
  "use strict";
  const { clamp, lerp, inv, E, track, hash, PAL } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = () => TR.S.actors;
  const mixP = (a, b, t) => TR.mixVal(Object.assign({}, a), Object.assign({}, b), t);
  const P = TR.POSES;

  TR.CUES = [
    { b: 1, sfx: ["boom", "bounce", "clunk"], shake: 30, punch: .07, flash: .35 },
    { b: 2, sfx: ["bounce", "clunk", "squeak"], shake: 10, flash: .2 },
    { b: 3, sfx: ["bounce", "clunk"], shake: 6, flash: .2 },
    { b: 3.5, sfx: ["whoosh"] },
    { b: 4, sfx: ["bounceS"] }, { b: 5, sfx: ["bounceS"] },
    { b: 6, sfx: ["catch", "ding"], punch: .03 },
    { b: 7, sfx: ["whooshUp"] },
    { b: 8, sfx: ["boom", "crash", "stab"], shake: 26, punch: .12, invert: 2 },
    { b: 10, sfx: ["blip", "stab"], shake: 10, punch: .04 },
    { b: 15.5, sfx: ["pixel"] },
    { b: 18, sfx: ["shoot"], shake: 5 },
    { b: 20, sfx: ["swish", "stab"], shake: 12, punch: .05 },
    { b: 22, sfx: ["shoot"], shake: 6 }, { b: 23, sfx: ["shoot", "blip"], shake: 6 }, { b: 24, sfx: ["shoot", "blip"], shake: 6 }, { b: 25, sfx: ["shoot", "stab"], shake: 8 },
    { b: 26, sfx: ["shoot"], shake: 4 }, { b: 27, sfx: ["shoot"], shake: 4 }, { b: 28, sfx: ["shoot"], shake: 4 },
    { b: 28.5, sfx: ["shoot"], shake: 4 }, { b: 29, sfx: ["shoot"], shake: 4 }, { b: 29.5, sfx: ["shoot"], shake: 4 },
    { b: 30, sfx: ["ignite"], shake: 8 },
    { b: 31.5, sfx: ["fireUp"], punch: .04 },
    { b: 32, sfx: ["whip", "stab"], shake: 12, punch: .05 }, { b: 33, sfx: ["whip", "gull"], shake: 12, punch: .05 },
    { b: 34, sfx: ["whip"], shake: 12, punch: .05 }, { b: 35, sfx: ["whip", "stab"], shake: 12, punch: .05 },
    { b: 36, sfx: ["equip"], shake: 10, punch: .04 }, { b: 37, sfx: ["equip"], shake: 8, punch: .03 }, { b: 38, sfx: ["equip"], shake: 8, punch: .03 },
    { b: 39, sfx: ["riser", "clunkOff"] },
    { b: 40, sfx: ["heart", "hush"] }, { b: 41, sfx: ["heart"] }, { b: 42, sfx: ["heart"] }, { b: 43, sfx: ["heart"] },
    { b: 44, sfx: ["heart"] }, { b: 45, sfx: ["heart"] }, { b: 46, sfx: ["heart", "riser2"] },
    { b: 47, sfx: ["shoot"] },
    { b: 47.9, sfx: ["buzzer"], flash: .5, flashCol: "255,60,60" },
    { b: 48, sfx: ["boom"], shake: 10 },
    { b: 50, sfx: ["swish", "boom", "crash", "roar", "stab"], shake: 40, sdur: 14, punch: .14, invert: 2 },
    { b: 51, sfx: ["yell"], shake: 16, sdur: 10 },
    { b: 56, sfx: ["pixel", "boom"], shake: 10 },
    { b: 57, sfx: ["ding"], punch: .03 },
    { b: 60, sfx: ["blip", "stab"], shake: 12, punch: .05 },
    { b: 64, sfx: ["boom", "stabLong"], shake: 8, punch: .03 },
    { b: 68, sfx: ["bounceS"] }, { b: 68.8, sfx: ["bounceS2"] }, { b: 69.4, sfx: ["bounceS3"] },
  ];

  const CENTER = [0, 4.745];
  const shotPh = (bt, rel) => clamp(rel);  // 占位

  /* ========== S1 LIGHTS ON 0–4 ========== */
  const S1 = { b0: 0, preset: "indoor", seed: 11,
    ballAt(bt) {
      const [x, z] = CENTER, R = .16;
      if (bt < 1) return V(x, lerp(9, R, E.inQuad(bt)), z);
      const hops = [[1, 2, 1.7], [2, 3, 1.0], [3, 3.5, .8]];
      for (const [a, b, h] of hops) if (bt < b) { const u = (bt - a) / (b - a), uu = b === 3.5 ? u * .5 : u; return V(x + (bt - 1) * .08, R + h * 4 * uu * (1 - uu), z); }
      return null;
    },
    frame(bt, f) {
      const { hero } = A();
      const lk = bt < 1 ? .05 : bt < 2 ? .4 : bt < 3 ? .7 : 1;
      TR.lights(lk);
      TR.spot(CENTER[0], CENTER[1], bt < 1 ? 3.2 : 1.2);
      const b = this.ballAt(bt);
      // 主角的腿（拍 2 踩进来）
      if (bt > 1.7) {
        const u = E.outBack(inv(1.7, 2, bt), 1.2);
        const pose = bt < 3.3 ? P.dribbleDown : mixP(P.dribbleDown, P.dribbleUp, inv(3.3, 3.5, bt));
        const x = lerp(2.4, .55, u), z = CENTER[1] + .35;
        const y = TR.pose(hero, pose);
        TR.place(hero, x, z, y, Math.PI * 1.25);
      }
      if (b) TR.ball(0, b, bt * 3);
      else { const g = TR.grip(hero); TR.ball(0, g, bt * 3); }
      // 镜头：贴地仰拍，拍 3.5 后急速上甩
      const up = E.inCubic(inv(3.5, 4, bt));
      TR.cam([.9 - bt * .06, .22 + up * 1.6, CENTER[1] + 3.1 - bt * .12], [0, .7 + up * 5, CENTER[1]], 52 + up * 8);
      this.imp = TR.project(V(CENTER[0], .02, CENTER[1]));
    },
    ov(ctx, bt, f) {
      for (const k of [1, 2, 3]) if (bt >= k && bt < k + .9) TR.pixelRing(ctx, this.imp[0], this.imp[1], (bt - k) / .9, k === 1 ? 1 : .55, k * 7);
      if (bt > 3.5) TR.streaks(ctx, inv(3.5, 4, bt), 1);
    },
  };

  /* ========== S2 REVEAL 4–8 ========== */
  const S2 = { b0: 4, preset: "indoor", seed: 12,
    frame(bt, f) {
      const { hero } = A();
      TR.lights(.85); TR.spot(0, CENTER[1], 1.5);
      const [cx, cz] = CENTER;
      let pose, ball;
      if (bt < 2) {
        const h = Math.abs(Math.sin(Math.PI * bt));
        pose = mixP(P.dribbleDown, P.dribbleUp, h);
        pose.hy = .55; pose.hx = .18;
      } else if (bt < 3) {
        const u = E.outBack(inv(2, 2.15, bt));
        pose = mixP(P.dribbleUp, P.chest, u);
        pose.hy = lerp(.55, 0, u); pose.hx = lerp(.18, 0, u);
      } else {
        pose = mixP(P.chest, P.chest, 0);
      }
      const y = TR.pose(hero, pose);
      TR.place(hero, cx, cz, y, 0);
      if (bt < 2) {
        const h = Math.abs(Math.sin(Math.PI * bt)), g = TR.grip(hero);
        ball = V(g.x, lerp(.16, g.y - .12, h), g.z + .05);
      } else {
        const a = TR.grip(hero, 0), b = TR.grip(hero, 1);
        ball = a.clone().lerp(b, .5); ball.z += .06;
      }
      TR.ball(0, ball, bt * 4);
      const ang = track([[0, 1.5], [2, .15, E.inOutCubic], [4, -.05]], bt);
      const dist = track([[0, 2.6], [2, 3.3], [3, 3.3], [3.8, .95, E.inOutQuint], [4, .8]], bt);
      const h = track([[0, .25], [2, 1.35], [3, 1.45], [3.8, 1.66, E.inOutQuint], [4, 1.68]], bt);
      const ly = track([[0, .3], [2, 1.2], [3, 1.3], [3.8, 1.66, E.inOutQuint], [4, 1.68]], bt);
      TR.orbit([cx, cz], ang, dist, h, ly, bt > 3 ? lerp(40, 30, inv(3, 3.8, bt)) : 40, track([[0, .06], [2, 0]], bt));
      this.bounce = TR.project(V(ball.x, .02, ball.z));
      this.hy = ball.y;
    },
    ov(ctx, bt) {
      if (bt < 2 && this.hy < .3) TR.pixelRing(ctx, this.bounce[0], this.bounce[1], .4, .35, 4);
      if (bt > 2 && bt < 2.6) TR.sparkle(ctx, TR.W * .56, TR.H * .38, inv(2, 2.6, bt), 90);
    },
  };

  /* ========== S3 TITLE 8–16 ========== */
  const S3 = { b0: 8, preset: "indoor", seed: 13,
    frame(bt, f) {
      const { hero } = A();
      TR.lights(.4); TR.spot(0, -.5, 3.8, 10); TR.keyLight(.8);
      const ph = .88 + Math.sin(bt * .8) * .01;
      const y = TR.shoot(hero, ph) + .15 + Math.sin(bt * 1.2) * .03;
      TR.place(hero, 0, -.5, y, Math.PI);
      const g = TR.grip(hero);
      TR.ball(0, V(g.x, g.y + .12, g.z - .05), bt * 2, false);
      const dist = bt < .6 ? lerp(1.2, 3.9, E.outExpo(bt / .6)) : 3.9 + (bt - .6) * .08;
      const ang = Math.PI + .3 - bt * .06;
      TR.orbit([0, -.5], ang, dist, .3, 2.45, 52, -.03);
      TR.shiftX(V(0, 1.7, -.5), .35);
      TR.mosaicK = bt > 7.5 ? Math.round(lerp(1, 24, E.inCubic(inv(7.5, 8, bt)))) : 1;
    },
    ov(ctx, bt, f) {
      const sc = bt < .3 ? lerp(3, 1, E.outQuint(bt / .3)) : 1 + (bt - .3) * .006;
      TR.logo(ctx, TR.W / 2, 250, 700 * sc, bt < .3 ? 1 : 1, [[.4, 1.3], [4.2, 5.1]].map(([a, b]) => inv(a, b, bt)).find(x => x > 0 && x < 1));
      if (bt < 1.6) TR.goldBurst(ctx, TR.W / 2, 250, bt / 1.6, 1, 3);
      if (bt >= 2) TR.tagPanel(ctx, 480, 900, "RACE TO 100", "先到 100 就赢", E.outBack(inv(2, 2.15, bt)), .85);
    },
  };

  /* ========== S4 REAL FORM 16–20 ========== */
  const S4 = { b0: 16, preset: "indoor", seed: 14,
    ph: (bt) => bt < 2 ? lerp(.05, .9, E.inOutCubic(bt / 2)) : Math.min(1.25, .9 + (bt - 2) * .45),
    frame(bt, f) {
      const { hero, human } = A();
      TR.lights(1);
      const ph = this.ph(bt);
      const yh = TR.shoot(hero, ph);
      TR.place(hero, 0, -.6, yh, Math.PI);
      if (ph < .9) { const g = TR.grip(hero); TR.ball(0, V(g.x, g.y + .05, g.z - .06), 0); }
      else {
        const u = inv(2, 3.3, bt), from = this.rel || (this.rel = TR.grip(hero).clone());
        if (u < 1) TR.ball(0, TR.arc(from, u, 1.5), u * 8); else TR.ball(0, TR.drop(bt - 3.3), 0);
        TR.net(u >= 1 ? (bt - 3.3) * .4 : -1);
      }
      if (bt < .02) this.rel = null;
      const yu = TR.shoot(human, ph);
      TR.place(human, 60, 60.3, yu, 0);
    },
    passes(bt, f) {
      // A：房间里的摄像头视角
      TR.cam([60.15, 1.25, 63.4], [60, 1.25, 60.2], 44);
      TR.render();
      TR.copyPass("A");
      this.skel = TR.skeleton(A().human);
      // B：球馆里的主角
      TR.orbit([0, -.6], Math.PI + .75 - bt * .05, 4.4, 1.3, 1.5, 38);
      TR.shiftX(V(0, 1.5, -.6), .42);
      TR.render();
      TR.copyPass("B");
    },
    compose(ctx, bt) {
      TR.drawPass(ctx, "B");
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1020, 0); ctx.lineTo(880, TR.H); ctx.lineTo(0, TR.H); ctx.closePath(); ctx.clip();
      TR.drawPass(ctx, "A", -300);
      TR.drawSkeleton(ctx, this.skel, -300);
      TR.camHud(ctx, bt);
      ctx.restore();
      TR.splitLine(ctx, 1020, 0, 880, TR.H);
    },
    ov(ctx, bt) {
      if (bt < .35) TR.mosaicK = Math.round(lerp(24, 1, E.outCubic(bt / .35))); else TR.mosaicK = 1;
      TR.tagPanel(ctx, 1480, 110, "MOTION SHOT", "体感投篮 · 真实动作出手", E.outBack(inv(.2, .4, bt)), .8);
    },
  };

  /* ========== S5 SWISH 20–22 ========== */
  const S5 = { b0: 20, preset: "indoor", seed: 15,
    frame(bt) {
      TR.lights(1);
      const tRim = .08;
      let p;
      if (bt < tRim) p = V(HOOP.x + .05, lerp(4.2, HOOP.y + .02, bt / tRim), HOOP.z + .25 * (1 - bt / tRim));
      else p = TR.drop((bt - tRim) * .42);
      if (p.y > -1) TR.ball(0, p, bt * 5, false);
      TR.net((bt - tRim) * .42, 1.2, .2);
      TR.cam([.55, 1.45, HOOP.z + 1.15], [0, HOOP.y + .15, HOOP.z], 64, .08 - bt * .02);
      this.rim = TR.project(V(HOOP.x, HOOP.y, HOOP.z));
    },
    ov(ctx, bt) {
      if (bt > .08) { TR.goldBurst(ctx, this.rim[0], this.rim[1], inv(.08, 1.2, bt), .9, 5); TR.bigText(ctx, "SWISH!", 1440, 300, 190, PAL.gold, -.12, E.outBack(inv(.08, .25, bt))); }
      if (bt > .5) TR.bigText(ctx, "+3", 470, 760, 170, PAL.green, .1, E.outBack(inv(.5, .65, bt)));
    },
  };

  /* ========== S6 百分大战 22–26 ========== */
  const S6 = { b0: 22, preset: "indoor", seed: 16,
    cyc: (bt) => ((bt + .8) % 1),
    frame(bt) {
      const { hero, legend } = A();
      TR.lights(1);
      const u = this.cyc(bt), ph = u * 1.15, k = Math.floor(bt + .8);
      const pos = [[hero, 2.5, .1, 0], [legend, -2.5, .1, 2]];
      for (const [g, x, z, bi] of pos) {
        const y = TR.shoot(g, ph);
        TR.place(g, x, z, y, TR.faceHoop(x, z));
        if (ph < .9) { const gp = TR.grip(g); TR.ball(bi + (k % 2), V(gp.x, gp.y + .05, gp.z), 0); }
        else TR.hideBall(bi + (k % 2));
        // 上一球在空中
        const prev = bi + ((k + 1) % 2), since = bt - (k - 1);
        if (k >= 1 && since < 1) { const from = V(x * .92, 2.85, z - .35); TR.ball(prev, TR.arc(from, clamp(since / .95), 1.9), since * 8); }
        else if (k < 1 || since >= 1) TR.hideBall(prev);
      }
      TR.cam([Math.sin(bt * .7) * .4, 1.05, -3.6 - bt * .15], [0, 1.9, .3], 64, Math.sin(bt * 1.3) * .02);
    },
    ov(ctx, bt) {
      const A_ = [64, 70, 76, 82, 88], B_ = [71, 76, 81, 86, 91];
      const i = clamp(Math.floor(bt), 0, 3), t = E.outCubic(inv(i, i + .3, bt));
      TR.battleHud(ctx, Math.round(lerp(A_[i], A_[i + 1], t)), Math.round(lerp(B_[i], B_[i + 1], t)), bt);
    },
  };

  /* ========== S7 RACK RUSH 26–30 ========== */
  const RT = [0, 1, 2, 2.5, 3, 3.5];
  const S7 = { b0: 26, preset: "indoor", seed: 17, X: 4.55, Z: -1.1,
    frame(bt, f) {
      const { hero } = A();
      TR.lights(1);
      // 当前处在哪一球的周期
      let i = 0;
      for (let k = 0; k < RT.length; k++) if (bt >= RT[k] - (k ? (RT[k] - RT[k - 1]) * .55 : .55)) i = k;
      const gap = i ? RT[i] - RT[i - 1] : 1, d = (bt - RT[i]) / gap;
      const ph = d < -.55 ? .05 : d < 0 ? lerp(.15, .9, E.inOutCubic((d + .55) / .55)) : Math.min(1.2, .9 + d * .9);
      const y = TR.shoot(hero, ph);
      TR.place(hero, this.X, this.Z, y, TR.faceHoop(this.X, this.Z));
      const rack = V(this.X + .95, .9, this.Z - .7);
      if (d < 0) {
        const g = TR.grip(hero), u = clamp((d + .55) / .3);
        TR.ball(5, rack.clone().lerp(V(g.x, g.y + .05, g.z), E.outCubic(u)), f * .3);
      } else TR.hideBall(5);
      this.score = 0;
      RT.forEach((T, k) => {
        const t = (bt - T) / .85;
        if (bt >= T + .85) this.score += k === 4 ? 3 : 2;
        if (t < 0 || t > 1.35) { TR.hideBall(k % 5); return; }
        const from = V(this.X - .12, 2.9, this.Z - .3);
        TR.ball(k % 5, t <= 1 ? TR.arc(from, t, 1.4) : TR.drop((t - 1) * .5), t * 8);
      });
      const netAge = Math.min(...RT.map(T => { const t = (bt - T) / .85; return t >= 1 ? (t - 1) * .5 : 99; }));
      TR.net(netAge < 1 ? netAge : -1, .9, -.3);
      // 置球架（简化体素架）
      TR.rack(rack);
      TR.cam([9.2 - bt * .35, 2.1, 3.1], [2.4 - bt * .1, 2.0, -4.2], 50);
    },
    ov(ctx, bt) { TR.rackHud(ctx, this.score, bt); },
  };

  /* ========== S8 热手 × 世界 30–36 ========== */
  const WORLDS = [["flowerCourt", "峡谷雨林"], ["shonanCoast", "湘南海岸"], ["medCliff", "地中海半岛"], ["beachSunset", "西海岸 · 夕阳"]];
  const S8 = { b0: 30, preset: "indoor", seed: 18,
    frame(bt, f) {
      const { hero } = A();
      if (bt < 2) {
        TR.lights(lerp(1, .45, inv(0, 1.5, bt))); TR.spot(0, -.5, lerp(0, 2.5, inv(0, 1.2, bt)), 9);
        const y = TR.shoot(hero, .6 + Math.sin(bt * 4) * .01);
        TR.place(hero, 0, -.5, y, Math.PI);
        const g = TR.grip(hero);
        const ball = V(g.x, g.y + .05, g.z - .05);
        TR.ball(0, ball, 0);
        const k = inv(.1, 1, bt) * (bt > 1.5 ? 2 : 1);
        if (k > 0) { TR.fire(ball, Math.ceil(3 * k)); TR.fire(TR.hand(hero, 1), Math.ceil(2 * k)); TR.fire(TR.hand(hero, 0), Math.ceil(2 * k)); }
        TR.orbit([0, -.5], Math.PI + .1, lerp(2.6, 1.7, E.inOutCubic(bt / 2)), 1.6, 1.85, 42, .02);
        return;
      }
      const k = Math.min(3, Math.floor(bt - 2));
      if (TR.S.preset !== WORLDS[k][0]) { applyScenePreset(WORLDS[k][0], { silent: true, persist: false }); TR.S.preset = WORLDS[k][0]; for (let i = 0; i < 3; i++) updateEnvironment(1 / 30); }
      const y = TR.shoot(hero, .9) + .1 + Math.sin(bt * 2) * .02;
      TR.place(hero, 0, -.5, y, Math.PI);
      const g = TR.grip(hero), ball = V(g.x, g.y + .14, g.z - .05);
      TR.ball(0, ball, bt * 3, false);
      TR.fire(ball, 3); TR.fire(TR.hand(hero, 0), 2);
      TR.orbit([0, -.5], Math.PI - 1.1 + (bt - 2) * .55, 3.3, .75, 1.9, 46, .03);
    },
    ov(ctx, bt) {
      if (bt > .9 && bt < 2) TR.bigText(ctx, "HOT HAND", 1450, 250, 130, PAL.gold, .06, E.outBack(inv(.9, 1.1, bt)), "#ff4040");
      if (bt >= 2) { const k = Math.min(3, Math.floor(bt - 2)); TR.placeTag(ctx, WORLDS[k][1], E.outBack(inv(0, .12, (bt - 2) % 1))); if ((bt - 2) % 1 < .12) TR.streaks(ctx, ((bt - 2) % 1) / .12, 0); }
    },
  };

  /* ========== S9 更衣室 36–40 ========== */
  const GEAR = [
    ["SHOES", "疾风橙", "投射蓄力 +12%", "#e8771e"],
    ["SLEEVE", "冷血黑护臂", "关键时刻准星 +25%", "#252a36"],
    ["HEAD", "冷静金", "关键时刻准星 +20%", "#ffd23f"],
  ];
  const S9 = { b0: 36, preset: "indoor", seed: 19,
    frame(bt) {
      const { hero } = A();
      const k = Math.min(3, Math.floor(bt)), u = bt - k;
      TR.lights(k < 3 ? .55 : lerp(.55, .08, E.inCubic(u))); TR.spot(0, -.5, 2.6, 9);
      const pose = k === 1 ? P.point : k === 3 ? mixP(P.stand, P.lookUp, E.outCubic(u)) : P.stand;
      const y = TR.pose(hero, pose);
      TR.place(hero, 0, -.5, y, 0);
      TR.hideBall(0);
      if (k === 0) { const s = TR.world(hero.ankles[0]); TR.orbit([s.x, s.z], .9 - u * .8, .75, .22, .12, 38, .05); }
      else if (k === 1) { const w = TR.world(hero.handRoots[0]); TR.orbit([w.x, w.z], 1.2 + u * .6, .8, w.y + .12, w.y, 36, -.05); }
      else if (k === 2) { const h = TR.world(hero.headRoot); TR.orbit([0, -.5], .6 - u * 1.1, .85, 1.72, 1.7, 36, 0); }
      else TR.orbit([0, -.5], -.05, lerp(2.4, 1.8, u), 1.2, 1.55, 40, 0);
    },
    ov(ctx, bt) {
      const k = Math.min(3, Math.floor(bt)), u = bt - k;
      if (k < 3) TR.gearCard(ctx, GEAR[k], E.outBack(inv(.03, .18, u)));
    },
  };

  /* ========== S10 最后 3 秒 40–44 ========== */
  const duo = (bt, heroPose, legPose, legLift = 0) => {
    const { hero, legend } = A();
    const yh = typeof heroPose === "number" ? TR.shoot(hero, heroPose) : TR.pose(hero, heroPose);
    TR.place(hero, 0, -.6, yh, Math.PI);
    const yl = TR.pose(legend, Object.assign({}, legPose, { lift: legLift }));
    TR.place(legend, .1, -1.75, yl, [0, -.6]);
  };
  const S10 = { b0: 40, preset: "indoor", seed: 20,
    frame(bt) {
      TR.lights(.2); TR.spot(0, -1.1, 5, 9); TR.keyLight(1.3);
      duo(bt, mixP(P.chest, P.chest, 0), P.guard);
      const a = TR.grip(A().hero, 0), b = TR.grip(A().hero, 1), ball = a.clone().lerp(b, .5); ball.z -= .06;
      TR.ball(0, ball, 0);
      const t = E.inOutCubic(bt / 4);
      TR.cam([lerp(-3.6, -2.7, t), lerp(.5, .65, t), lerp(-.7, -1.0, t)], [0, 1.5, -1.15], 48, .04);
    },
    ov(ctx, bt) { TR.clutchHud(ctx, 97, 99, 3 - bt / 4 * 1.5, bt); TR.heartPulse(ctx, bt % 1); },
  };

  /* ========== S11 子弹时间 44–48 ========== */
  const S11 = { b0: 44, preset: "indoor", seed: 21,
    frame(bt) {
      TR.lights(.24); TR.spot(0, -1.1, 5.5, 9); TR.keyLight(1.3);
      const ph = bt < 3 ? lerp(.12, .9, E.inOutCubic(bt / 3)) : .9 + (bt - 3) * .25;
      const lift = Math.sin(clamp((bt - 1.2) / 2.6) * Math.PI) * .6;
      duo(bt, ph, P.defend, lift);
      const { hero } = A();
      if (bt < 3) { const g = TR.grip(hero); TR.ball(0, V(g.x, g.y + .05, g.z - .06), 0); this.rel = null; }
      else { const from = this.rel || (this.rel = TR.grip(hero).clone()); TR.ball(0, TR.arc(from, (bt - 3) * .09, 2.2), (bt - 3) * 2); }
      const c = [0, -1], k = E.inOutQuint(inv(3, 3.9, bt));
      const ang = lerp(-2.7, .45, E.inOutCubic(clamp(bt / 3.2)));
      const pos = [c[0] + Math.sin(ang) * lerp(3.4, 2.8, bt / 4), lerp(.5, 1.5, bt / 4), c[1] + Math.cos(ang) * lerp(3.4, 2.8, bt / 4)];
      const bp = TR.S.balls[0].m.position;
      const look = [lerp(0, bp.x, k), lerp(1.9, bp.y, k), lerp(c[1], bp.z, k)];
      TR.cam(pos, look, lerp(46, 14, k), lerp(-.05, .03, bt / 4));
    },
    ov(ctx, bt) {
      TR.clutchHud(ctx, 97, 99, Math.max(0, 1.5 - bt / 3.9 * 1.5), bt, .85);
      TR.letterbox(ctx, 90);
    },
  };

  /* ========== S12 爆发 48–56 ========== */
  const S12 = { b0: 48, preset: "indoor", seed: 22,
    frame(bt, f) {
      const { hero, legend } = A();
      const from = V(.05, 3.05, -1.15);
      if (bt < 3) {
        TR.lights(bt < 2 ? .3 : lerp(1.4, 1, inv(2, 2.6, bt))); TR.spot(0, -1, bt < 2 ? 2.5 : 0, 9); TR.keyLight(bt < 2 ? 1 : 0);
        duo(bt, 1.2, P.stand);
        legend.headRoot.rotation.x = .3;
        const u = clamp(bt / 2);
        const p = bt <= 2 ? TR.arc(from, E.inOutCubic(u) * .5 + u * .5, 2.3) : TR.drop((bt - 2) * .55);
        TR.ball(0, p, bt * 2, bt > 2);
        TR.net(bt >= 2 ? (bt - 2) * .55 : -1, 1.3, 0);
        if (bt >= 2 && !this.boom) { this.boom = true; TR.cheer(5); TR.confetti(); }
        if (bt < 1.7) {
          const ahead = TR.arc(from, Math.min(1, E.inOutCubic(u) * .5 + u * .5 + .12), 2.3);
          TR.cam([p.x - .7, p.y + .35, p.z + 1.7], [ahead.x, ahead.y, ahead.z], 52, -.05 + u * .08);
        } else {
          const k = E.inOutCubic(inv(1.7, 2.1, bt));
          TR.cam([lerp(p.x - .7, 1.6, k), lerp(p.y + .35, 1.8, k), lerp(p.z + 1.7, HOOP.z + 4.2, k)], [0, HOOP.y - .2, HOOP.z], lerp(52, 50, k), 0);
        }
        this.rim = TR.project(V(HOOP.x, HOOP.y, HOOP.z));
        return;
      }
      if (bt < 3.02) this.boom = false;
      TR.lights(1.1);
      const u = bt - 3;
      const y = TR.pose(hero, Object.assign({}, P.roar, { lift: Math.max(0, Math.sin(u * 2.4)) * .12 }));
      TR.place(hero, 0, -.6, y, .35);
      const yl = TR.pose(legend, Object.assign({}, P.stand, { hx: .35 }));
      TR.place(legend, 1.8, -2.4, yl, [0, -.6]);
      TR.hideBall(0);
      TR.orbit([0, -.6], .35 + u * .22, lerp(3.2, 2.3, E.outCubic(u / 5)), lerp(.35, .8, u / 5), 1.65, 50, .04 - u * .01);
    },
    ov(ctx, bt) {
      const s = bt >= 2.05 ? 100 : 97;
      TR.clutchHud(ctx, s, 99, 0, bt, bt >= 2.05 ? lerp(1.25, 1, E.outCubic(inv(2.05, 2.4, bt))) : .85, s === 100);
      if (bt > 2 && bt < 3.4) { TR.goldBurst(ctx, this.rim[0], this.rim[1], inv(2, 3.4, bt), 1.6, 9); TR.bigText(ctx, "100!", 560, 720, 300, PAL.gold, -.08, E.outBack(inv(2.08, 2.3, bt)), "#ff4040"); }
      if (bt > 3) TR.bigText(ctx, "BUZZER BEATER", TR.W / 2, 930, 96, PAL.white, 0, E.outBack(inv(3.05, 3.3, bt)), PAL.gold);
      TR.mosaicK = bt > 7.5 ? Math.round(lerp(1, 24, E.inCubic(inv(7.5, 8, bt)))) : 1;
    },
  };

  /* ========== S13 结尾 56–72 ========== */
  const S13 = { b0: 56, preset: "indoor", seed: 23,
    endBall(bt) {
      const t = bt - 11.6;
      if (t < 0) return null;
      const G = .16, keys = [[0, -3.2], [.4, -2.0], [1.2, -1.4], [1.8, -1.1], [2.2, -.95]];
      const x = t < 2.2 ? track(keys.map(k => [k[0], k[1], E.lin]), t) : -.95 + (1 - Math.exp(-(t - 2.2) * 2)) * .2;
      let y = G;
      if (t < .4) y = lerp(1.8, G, E.inQuad(t / .4));
      else if (t < 1.2) { const u = (t - .4) / .8; y = G + .7 * 4 * u * (1 - u); }
      else if (t < 1.8) { const u = (t - 1.2) / .6; y = G + .3 * 4 * u * (1 - u); }
      return V(x, y, CENTER[1] + 1.2);
    },
    frame(bt) {
      const { hero } = A();
      TR.lights(.16); TR.spot(1.3, CENTER[1], 4.5, 9); TR.keyLight(.9);
      const y = TR.pose(hero, P.spin);
      TR.place(hero, 1.3, CENTER[1], y, -.35);
      const g = TR.grip(hero);
      TR.ball(0, V(g.x, g.y + .2, g.z), bt * 9, false);
      const b = this.endBall(bt);
      if (b) TR.ball(1, b, b.x / .16); else TR.hideBall(1);
      TR.orbit([1.3, CENTER[1]], -.35 + Math.sin(bt * .15) * .15, 4.2, 1.0, 1.9, 44, 0);
      camera.position.x -= 1.1; camera.lookAt(0.2, 1.9, CENTER[1]); camera.updateMatrixWorld(true);
    },
    ov(ctx, bt) {
      if (bt < .35) TR.mosaicK = Math.round(lerp(24, 1, E.outCubic(bt / .35))); else TR.mosaicK = 1;
      if (bt > .9) TR.logo(ctx, 700, 330, 900 * (bt < 1.2 ? lerp(2.4, 1, E.outQuint(inv(.9, 1.2, bt))) : 1), 1, [[1.3, 2.2], [8.2, 9.1]].map(([a, b]) => inv(a, b, bt)).find(x => x > 0 && x < 1));
      if (bt > .9 && bt < 2.5) TR.goldBurst(ctx, 700, 330, inv(.9, 2.5, bt), 1, 11);
      if (bt >= 4) TR.slogan(ctx, 700, 660, "先到 100，就是王。", E.outBack(inv(4, 4.15, bt)));
      if (bt >= 8) TR.cta(ctx, 700, 830, inv(8, 8.5, bt));
      TR.fadeBlack = E.inOutCubic(inv(14.8, 16, bt));
    },
  };

  TR.SHOTS = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13];
  TR.shotAt = function (f) { const b = TR.beatOf(f); for (let i = TR.SHOTS.length - 1; i >= 0; i--) if (b >= TR.SHOTS[i].b0) return TR.SHOTS[i]; return TR.SHOTS[0]; };
  TR.SHOTS.forEach((s, i) => { s.f0 = TR.frameOf(s.b0); s.f1 = i + 1 < TR.SHOTS.length ? TR.frameOf(TR.SHOTS[i + 1].b0) : TR.TOTAL_FRAMES; });
})(window.TR = window.TR || {});
