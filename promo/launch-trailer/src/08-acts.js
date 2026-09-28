/* 08-acts — 动作库：让每个球员都有自己的连续动作（可慢放），球与手严格同步。
   TR.act(guy, name, t, o)：t = 动作内秒数（慢动作 = 传入慢放后的时间）
     o = { x, z, face, target:Vector3|null(球飞向哪里，默认篮筐), ph0: 相位偏移 }
   投篮直接回放游戏本体录制的出手（见 09-clip.js）：关节逐帧取自游戏，球离手前挂在 ballGrip 上，
   离手后走真实重力抛物线。 */
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
  /* 投篮 = 回放游戏本体录下来的出手（09-clip）。动作时间 tt 的约定：
     tt = SHOT.release 是"球离开手"的那一刻（每位球星的蓄力长短不同，按各自 clip 对齐到这里）；
     之前是游戏里的持球 → 下蹲 → 举球 → 起跳 → 松手 → 伸臂送球；之后是压腕、跟随、落地、收手。
     clip 播完后 0.3s 回到持球帧，再接回传、持球等待，period 3.0s。 */
  const SHOT = { release: 1.2, after: .86, toReady: .3, catchIn: .4 };
  SHOT.clipEnd = SHOT.release + SHOT.after;
  SHOT.period = 3.0;
  SHOT.hold = SHOT.period - SHOT.clipEnd - SHOT.toReady - SHOT.catchIn;
  SHOT.charge = SHOT.release - .1;                       // 兼容旧调用：约等于"松手键"时刻
  TR.SHOT = SHOT;
  const G_ACC = 9.8;
  /* 真实重力抛物线：从 p0 出发、tf 秒后到达 tg，返回 s 秒时的位置 */
  TR.arcAt = function (p0, tg, tf, s) {
    const vx = (tg.x - p0.x) / tf, vz = (tg.z - p0.z) / tf, vy = (tg.y - p0.y) / tf + .5 * G_ACC * tf;
    return V(p0.x + vx * s, p0.y + vy * s - .5 * G_ACC * s * s, p0.z + vz * s);
  };
  const clipT = (clip, tt) => tt - SHOT.release + clip.ballT;
  /* 球真正离手的位置：该球员 clip 里最后一帧球还挂在 ballGrip 上时，ballGrip 的世界坐标。 */
  TR.shotRelease = function (guy, x, z, face) {
    const clip = TR.clipOf(guy);
    TR.clipPose(guy, clip, clip.ballT - 1 / clip.fps, x, z, face ?? 0);
    return TR.grip(guy);
  };
  function shootAct(guy, t, o) {
    const T = SHOT, tt = ((t % T.period) + T.period) % T.period, clip = TR.clipOf(guy), face = o.face ?? 0;
    const target = o.target === undefined ? V(HOOP.x, HOOP.y + .02, HOOP.z) : o.target;
    const flightDur = o.flight || 1.05;
    let ball = null, spin = 0, onGrip = false;
    // 飞行中的球（离手之后）
    if (tt >= T.release) {
      const s = tt - T.release;
      if (s < flightDur + .6) {
        const from = TR.shotRelease(guy, o.x, o.z, face);
        if (target) {
          if (s < flightDur) ball = TR.arcAt(from, target, flightDur, s);
          else { const d = s - flightDur; ball = V(target.x, target.y - d * 2.4 - d * d * 3, target.z); }
        } else { const d = fwd(guy); ball = from.clone().addScaledVector(d, s * 6).add(V(0, s * 5.5 - 4.9 * s * s, 0)); }
        spin = -s * 14;
      }
    }
    if (tt < T.clipEnd) {
      onGrip = TR.clipPose(guy, clip, Math.max(0, clipT(clip, tt)), o.x, o.z, face);
    } else if (tt < T.clipEnd + T.toReady) {
      const w = E.inOutCubic((tt - T.clipEnd) / T.toReady);
      TR.clipApply(guy, TR.clipMix(TR.clipSample(clip, clipT(clip, T.clipEnd)), TR.clipSample(clip, 0), w), o.x, o.z, face);
    } else {
      TR.clipPose(guy, clip, 0, o.x, o.z, face);
      const hand = TR.grip(guy), ct = tt - T.clipEnd - T.toReady;
      if (ct < T.catchIn) { const src = hand.clone().addScaledVector(fwd(guy), 4.5); src.y = 1.1; const u = E.outCubic(ct / T.catchIn); ball = src.lerp(hand, u); ball.y += Math.sin(u * Math.PI) * .25; spin = ct * 10; }
      else onGrip = true;
    }
    if (onGrip) ball = TR.grip(guy);                      // 游戏里球就挂在 ballGrip 原点上
    if (ball && !o.noBall) showBall(guy, ball, spin); else TR.hideGuyBall(guy);
    return guy.g.position.y;
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
