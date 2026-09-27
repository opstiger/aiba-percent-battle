/* 08-acts — 动作库：让每个球员都有自己的连续动作（可慢放），球与手严格同步。
   TR.act(guy, name, t, o)：t = 动作内秒数（慢动作 = 传入慢放后的时间）
     o = { x, z, face, target:Vector3|null(球飞向哪里，默认篮筐), ph0: 相位偏移 }
   投篮严格按游戏节奏：蓄力 ph 0→1，**ph = 1.0 松手**（游戏 power 达到 ideal 的那一刻），
   松手瞬间从真实手部 ballGrip 位置起飞；之后是跟随动作 + 落地，再回到接球。 */
(function (TR) {
  "use strict";
  const { clamp, lerp, E } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = TR.POSES;
  const mixP = (a, b, t) => TR.mixVal(Object.assign({}, a), Object.assign({}, b), t);

  /* 每个球员一颗自己的球 */
  function ballOf(guy) {
    if (!guy.tb) { guy.tb = new THREE.Mesh(ballGeo, matBall); guy.tb.visible = false; scene.add(guy.tb); }
    return guy.tb;
  }
  function showBall(guy, p, spin = 0) { const b = ballOf(guy); b.visible = true; b.position.copy(p); b.rotation.set(spin, spin * .6, 0); }
  TR.hideGuyBall = (guy) => { if (guy.tb) guy.tb.visible = false; };

  /* 关节快照与混合（用于投篮收势 → 接球姿势的过渡） */
  function snap(guy) {
    const list = [...guy.arms, ...guy.elbows, ...guy.legs, ...guy.knees, ...guy.ankles, guy.g];
    return list.map(o => o.rotation.clone());
  }
  function applyMix(guy, A, B, w) {
    const list = [...guy.arms, ...guy.elbows, ...guy.legs, ...guy.knees, ...guy.ankles, guy.g];
    list.forEach((o, i) => { if (o === guy.g) { o.rotation.x = lerp(A[i].x, B[i].x, w); return; } o.rotation.set(lerp(A[i].x, B[i].x, w), lerp(A[i].y, B[i].y, w), lerp(A[i].z, B[i].z, w)); });
  }
  const place = (guy, o, y) => TR.place(guy, o.x, o.z, y, o.face ?? 0);
  const fwd = (guy) => V(Math.sin(guy.g.rotation.y), 0, Math.cos(guy.g.rotation.y));

  /* ---------------- 投篮 ---------------- */
  const SHOT = { charge: 1.0, follow: .45, recover: .6, catchIn: .45, hold: .5 };
  SHOT.period = SHOT.charge + SHOT.follow + SHOT.recover + SHOT.catchIn + SHOT.hold;   // 3.0s
  TR.SHOT = SHOT;
  function shootAct(guy, t, o) {
    const T = SHOT, tt = ((t % T.period) + T.period) % T.period;
    let y;
    // 松手点：摆到 ph=1 取手部位置
    const relPos = () => { const yy = TR.shoot(guy, 1); place(guy, o, yy); const g = TR.grip(guy); return V(g.x, g.y + .04, g.z); };
    const target = o.target === undefined ? V(HOOP.x, HOOP.y + .02, HOOP.z) : o.target;
    let ball = null, spin = 0;
    const flightDur = o.flight || 1.05;
    if (tt < T.charge) {
      y = TR.shoot(guy, tt / T.charge); place(guy, o, y);
      const g = TR.grip(guy); ball = V(g.x, g.y + .04, g.z);
    } else {
      const from = relPos();
      const ft = tt - T.charge;
      if (ft < flightDur) {
        const u = ft / flightDur;
        if (target) { const tg = target; ball = from.clone().lerp(tg, u); ball.y += Math.max(1.2, (tg.y - from.y) * .3 + 1.4) * 4 * u * (1 - u) * .75; }
        else { const d = fwd(guy); ball = from.clone().addScaledVector(d, ft * 6).add(V(0, ft * 5.5 - 4.9 * ft * ft, 0)); }
        spin = -ft * 14;
      } else if (target && ft < flightDur + .6) { const d = ft - flightDur; ball = V(target.x, target.y - d * 2.4 - d * d * 3, target.z); }
      if (tt < T.charge + T.follow) {
        y = TR.shoot(guy, 1 + (tt - T.charge) / T.follow * .38); place(guy, o, y);
      } else if (tt < T.charge + T.follow + T.recover) {
        const w = E.inOutCubic((tt - T.charge - T.follow) / T.recover);
        const yA = TR.shoot(guy, 1.38), A = snap(guy);
        const yB = TR.pose(guy, P.chest), B = snap(guy);
        applyMix(guy, A, B, w); y = lerp(yA, yB, w); place(guy, o, y);
      } else {
        y = TR.pose(guy, P.chest); place(guy, o, y);
        // 接回传：球从前方飞回胸口
        const a = TR.grip(guy, 0), b = TR.grip(guy, 1), chest = a.lerp(b, .5);
        const ct = tt - T.charge - T.follow - T.recover;
        if (ct < T.catchIn) { const src = chest.clone().addScaledVector(fwd(guy), 4.5); src.y = 1.1; const u = E.outCubic(ct / T.catchIn); ball = src.lerp(chest, u); ball.y += Math.sin(u * Math.PI) * .25; spin = ct * 10; }
        else ball = chest;
      }
    }
    if (ball && !o.noBall) showBall(guy, ball, spin); else TR.hideGuyBall(guy);
    return y;
  }

  /* ---------------- 运球 / 胯下 / 转球 ---------------- */
  function dribbleAct(guy, t, o) {
    const per = .62, h = Math.abs(Math.sin(Math.PI * t / per));
    const pose = mixP(P.dribbleDown, P.dribbleUp, h);
    pose.hy = Math.sin(t * .8) * .25;
    const y = TR.pose(guy, pose); place(guy, o, y);
    const g = TR.grip(guy);
    showBall(guy, V(g.x, lerp(.16, g.y - .1, h), g.z), t * 6);
    return y;
  }
  function crossAct(guy, t, o) {
    const per = .9, s = Math.sin(t / per * Math.PI * 2);
    const pose = { aR: -.55, eR: -.5, aL: -.55, eL: -.5, aRz: -.2, aLz: .2, hR: -.6, kR: 1.0, hL: -.6, kL: 1.0, lean: -.25, hy: s * .2 };
    const y = TR.pose(guy, pose); place(guy, o, y);
    const a = TR.grip(guy, 0), b = TR.grip(guy, 1), k = (s + 1) / 2;
    const p = a.lerp(b, k); p.y = lerp(.16, p.y, Math.abs(s));
    showBall(guy, p, t * 8);
    return y;
  }
  function spinAct(guy, t, o) {
    const y = TR.pose(guy, Object.assign({}, P.spin, { hy: Math.sin(t * .6) * .2, lift: Math.abs(Math.sin(t * 1.4)) * .02 })); place(guy, o, y);
    const g = TR.grip(guy); showBall(guy, V(g.x, g.y + .2, g.z), t * 12);
    return y;
  }
  /* ---------------- 无球动作 ---------------- */
  function poseAct(fn) {
    return (guy, t, o) => { TR.hideGuyBall(guy); const y = TR.pose(guy, fn(t)); place(guy, o, y); return y; };
  }
  const stretch = poseAct(t => { const s = Math.sin(t * 1.6); return { aR: -1.9, aRz: -.52 * s, aL: -2.45, aLz: .52 * s, eR: -.18, eL: -.18, hR: -.15, kR: .44, hL: -.15, kL: .44, lean: .05 + .14 * Math.max(0, s) }; });
  const chalk = poseAct(t => { const u = (t % 2.4) / 2.4, toss = clamp((u - .45) / .25) * (1 - clamp((u - .8) / .2)); const rub = Math.sin(t * 16) * (1 - toss);
    return { aR: -.9 - toss * 1.65 + rub * .08, aL: -.9 - toss * 1.65 - rub * .08, aRz: -.25 - toss * .45, aLz: .25 + toss * .45, eR: -1.35 + toss * .8, eL: -1.35 + toss * .8, lift: Math.sin(u * Math.PI) * .08, hx: -toss * .25 }; });
  const finger = poseAct(t => ({ aR: -2.15, aRz: -.55, eR: -.55, aL: -.55, eL: -.55, lift: Math.abs(Math.sin(t * 1.3)) * .05, hy: Math.sin(t * .7) * .2 }));
  const wave = poseAct(t => ({ aR: -2.25, aRz: -.25 + Math.sin(t * 8) * .38, eR: -.35, aL: -.5, eL: -.45 }));
  const pump = poseAct(t => { const p = Math.abs(Math.sin(t * 6)); return { aR: -1.55 - p * .55, aL: -1.55 - p * .55, eR: -1.05, eL: -1.05, lift: p * .06, kR: .15 * p, kL: .15 * p }; });
  const roar = poseAct(t => { const p = Math.max(0, Math.sin(t * 3.4)); return Object.assign({}, P.roar, { lift: p * .32, aRz: -.6 - p * .2, aLz: .6 + p * .2, hx: -.12 - p * .08 }); });
  const fist = poseAct(t => { const p = Math.max(0, Math.sin(t * 4.2)); return { aR: -1.4 - p * 1.3, aRz: -.15, eR: -1.6 + p * 1.2, aL: -.4, eL: -1.2, lift: p * .22, kR: .3 * (1 - p), kL: .3 * (1 - p), hx: -.1 * p }; });
  const clap = poseAct(t => { const c = Math.abs(Math.sin(t * 5)); return { aR: -1.25, aL: -1.25, aRz: .15 + c * .35, aLz: -.15 - c * .35, eR: -.6, eL: -.6, lift: c * .03 }; });
  const flex = poseAct(t => Object.assign({}, P.flex, { lift: Math.abs(Math.sin(t * 1.2)) * .03, hy: Math.sin(t * .5) * .25 }));
  const defend = (guy, t, o) => { TR.hideGuyBall(guy); const s = Math.sin(t * 2.2); const y = TR.pose(guy, Object.assign({}, P.guard, { lift: Math.abs(Math.cos(t * 2.2)) * .04 })); const f = o.face ?? 0; TR.place(guy, o.x + Math.cos(f) * s * .5, o.z - Math.sin(f) * s * .5, y, f); return y; };
  const leap = (guy, t, o) => {   // 虚空里的起跳扣篮动作（无篮筐）：持球起跳 → 双手举高 → 下压
    const per = 2.6, u = (t % per) / per, air = Math.sin(clamp((u - .15) / .55) * Math.PI);
    const reach = clamp((u - .15) / .3) * (1 - clamp((u - .62) / .12) * .8);
    const pose = { aR: -.42 - 2.4 * reach, aL: -.42 - 2.2 * reach, eR: -.3 - .5 * reach, eL: -.3 - .5 * reach, hR: -.12 - .3 * air, kR: .18 + .6 * air, hL: .1 + .24 * air, kL: .18 + .5 * air, lift: air * 1.1 };
    const y = TR.pose(guy, pose); place(guy, o, y);
    const g = TR.grip(guy); showBall(guy, V(g.x, g.y + .06, g.z), u * 4);
    return y;
  };

  const ACTS = { shoot: shootAct, dribble: dribbleAct, cross: crossAct, spin: spinAct, stretch, chalk, finger, wave, pump, roar, fist, clap, flex, defend, leap,
    stand: poseAct(t => ({ hy: Math.sin(t * .5) * .2, aR: -.08 + Math.sin(t * 1.3) * .05, aL: -.08 - Math.sin(t * 1.2) * .05 })) };
  TR.ACTS = ACTS;
  TR.act = function (guy, name, t, o) {
    guy.g.visible = true;
    const f = ACTS[name] || ACTS.stand;
    return f(guy, t + (o.ph0 || 0), o);
  };

  /* 每位球星的招牌动作（亮相/群像时用） */
  TR.SIGNATURE = {
    nova24: "spin", curry: "shoot", j23: "shoot", k24: "shoot", a03: "cross", bird: "shoot", h13: "dribble", lillard: "finger",
    allen: "shoot", miller: "clap", thompson: "shoot", ionescu: "dribble", taurasi: "chalk", "sue-bird": "cross",
    korver: "shoot", stojakovic: "stretch", t01: "leap", v15: "leap",
  };
  TR.CELEBRATE = {
    nova24: "flex", curry: "fist", j23: "roar", k24: "fist", a03: "wave", bird: "clap", h13: "pump", lillard: "finger",
    allen: "roar", miller: "clap", thompson: "pump", ionescu: "wave", taurasi: "fist", "sue-bird": "clap",
    korver: "pump", stojakovic: "wave", t01: "roar", v15: "flex",
  };
  /* NBA 75 大（本作 18 人里的 9 位）：多给镜头 */
  TR.TOP75 = ["curry", "j23", "k24", "a03", "bird", "h13", "lillard", "allen", "miller"];

  /* 游戏原生热身单手扣篮（pregameAnimate "dunk"，Air Jordan 风格）。u: 0..1 */
  TR.gameDunk = function (guy, u, base) {
    ballOf(guy); guy.ball = guy.tb;
    PREGAME.dunkStyle = PREGAME_DUNK_STYLE_AIR_JORDAN; PREGAME.actors = []; PREGAME.t = u * 2.6;
    const actor = { guy, base, face: faceTo(base, HOOP), role: "hero" };
    const seg = TR._dunkSeg || (TR._dunkSeg = { seed: 0, dur: 2.6, start: 0 });
    if (u < .01) { for (const k in seg) if (k[0] === "_") delete seg[k]; }
    guy.g.visible = true;
    TR.head(guy, 0, 0);
    pregameAnimate(actor, "dunk", u, seg); pregameSyncBallAfterPose(actor, "dunk", u, seg);
  };
})(window.TR = window.TR || {});
