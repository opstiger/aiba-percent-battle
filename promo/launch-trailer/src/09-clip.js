/* 09-clip — 投篮动作直接取自游戏本体。
   录制（node render.mjs clips）：普通模式开一局，第三人称下让游戏的 player 换上某位球星的
   造型与出手风格，按住蓄力、在理想力度松手，以 120fps 逐帧记录游戏自己的姿势链
   （updPoseV2 → poseGuy → applyShotSetPose → 出手跟随 applyShotFollowThroughPose →
   release-feet 下肢）写进骨架的每一个关节，以及球什么时候离开 ballGrip。
   回放：把同一组关节值原样写到宣传片里的球星身上；球在离手前永远挂在该球员的 ballGrip 上，
   离手后按重力抛物线飞向目标——人和球的关系与游戏逐帧一致。 */
(function (TR) {
  "use strict";
  const RIG_KEYS = ["legs", "knees", "ankles", "footRoots", "toeRoots", "arms", "elbows", "upperArms", "forearms", "shoes", "wrists", "sleeves",
    "palms", "thumbs", "thumbRoots", "thumbTips", "handRoots", "fingerJoints", "fingerPipJoints", "fingerDipJoints", "ballGrips",
    "hipBlends", "kneeBlends", "ankleBlends", "elbowBlends", "wristBlends", "neckBlend", "headRoot", "jerseyHem", "hairPivot", "hairTail"];
  function collect(v, out) {
    if (!v) return;
    if (v.isObject3D) { out.push(v); return; }
    if (Array.isArray(v)) v.forEach(x => collect(x, out));
  }
  TR.rigNodes = function (guy) {
    if (guy.__rig) return guy.__rig;
    const out = []; RIG_KEYS.forEach(k => collect(guy[k], out));
    return (guy.__rig = out);
  };
  const r4 = (x) => Math.round(x * 10000) / 10000;

  /* ---------------- 录制（只在 clips 命令里用） ---------------- */
  TR.recordClips = async function (ids, fps = 60) {
    const R = renderer.render; renderer.render = () => {};
    const g0 = clock.getDelta.bind(clock); let DT = 1 / 30; clock.getDelta = () => DT;
    const pump = async (cond, ms = 60000) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) { DT = 1 / 30; animate(); await new Promise(r => setTimeout(r, 4)); } return cond(); };
    const ready = () => G.state === "round" && G.canShoot && !G.charging && !G.moving && !P.walking && !(G.passCatch && G.passCatch.active);
    goDiff("normal", true); pickDiff("normal"); G.posted = []; hidePanel(); startRound();
    const clips = {}, rig = TR.rigNodes(player), grip = player.ballGrips[0];
    for (const id of ids) {
      const star = LEGENDS.find(l => l.id === id); if (!star) continue;
      if (!(await pump(ready))) { clips[id] = { error: "not ready: " + G.state }; continue; }
      applyStarStyle(player, star); delete player.__rig;
      const nodes = TR.rigNodes(player);
      for (let i = 0; i < 24; i++) animate();
      DT = 1 / 120;
      const face = P.face, px = P.pos.x, pz = P.pos.z, cs = Math.cos(-face), sn = Math.sin(-face);
      const frames = [], step = Math.round(120 / fps);
      let t = 0, relT = null, ballT = null, i = 0;
      startCharge();
      while (i < 600) {
        if (G.charging && G.power >= weatherAdjustedIdeal(curShot(), true)) { G.power = weatherAdjustedIdeal(curShot(), true); doRelease(); relT = t; }
        animate(); t += DT; i++;
        const onGrip = pBall.visible && pBall.parent === grip;
        if (relT != null && ballT == null && !onGrip) ballT = t;
        if (i % step === 0) {
          const gp = player.g.position, dx = gp.x - px, dz = gp.z - pz;
          const root = [r4(dx * cs + dz * sn), r4(gp.y), r4(-dx * sn + dz * cs), r4(player.g.rotation.x), r4(player.g.rotation.y - face), r4(player.g.rotation.z)];
          const n = nodes.map(o => [r4(o.position.x), r4(o.position.y), r4(o.position.z), r4(o.quaternion.x), r4(o.quaternion.y), r4(o.quaternion.z), r4(o.quaternion.w), r4(o.scale.x), r4(o.scale.y), r4(o.scale.z)]);
          frames.push({ t: r4(t), root, n, on: onGrip });
        }
        if (relT != null && t > relT + .95) break;
      }
      clips[id] = { fps, relT: r4(relT), ballT: r4(ballT), len: r4(t), nodeCount: nodes.length, frames };
    }
    clock.getDelta = g0; renderer.render = R;
    return clips;
  };

  /* ---------------- 回放 ---------------- */
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  TR.CLIPS = window.__SHOTCLIPS || null;
  TR.clipOf = (guy) => {
    const C = TR.CLIPS; if (!C) return null;
    const id = guy.__starId || (TR.S && TR.S.stars && (TR.S.stars.find(s => s.guy === guy) || {}).id);
    if (id) guy.__starId = id;
    return (id && C[id] && !C[id].error) ? C[id] : C.curry;
  };
  /* clip 在 t 秒处的插值样本（关节数组 + 根节点 + 球是否在手上） */
  TR.clipSample = function (clip, t) {
    const F = clip.frames, fps = clip.fps;
    const u = Math.max(0, Math.min(F.length - 1.0001, t * fps - 1));
    const i = Math.floor(u), k = u - i, A = F[i], B = F[Math.min(F.length - 1, i + 1)];
    return TR.clipMix({ n: A.n, root: A.root, on: A.on }, { n: B.n, root: B.root, on: B.on }, k);
  };
  TR.clipMix = function (A, B, k) {
    if (k <= 0) return A; if (k >= 1) return B;
    const n = A.n.map((a, j) => {
      const b = B.n[j];
      _qa.set(a[3], a[4], a[5], a[6]); _qb.set(b[3], b[4], b[5], b[6]); _qa.slerp(_qb, k);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, _qa.x, _qa.y, _qa.z, _qa.w,
        a[7] + (b[7] - a[7]) * k, a[8] + (b[8] - a[8]) * k, a[9] + (b[9] - a[9]) * k];
    });
    const root = A.root.map((v, j) => v + (B.root[j] - v) * k);
    return { n, root, on: k < .5 ? A.on : B.on };
  };
  /* 把样本写到 guy 上，并放到 (x,z) 朝 face。 */
  TR.clipApply = function (guy, S, x, z, face) {
    const nodes = TR.rigNodes(guy), m = Math.min(nodes.length, S.n.length);
    for (let j = 0; j < m; j++) {
      const a = S.n[j], o = nodes[j];
      o.position.set(a[0], a[1], a[2]); o.quaternion.set(a[3], a[4], a[5], a[6]); o.scale.set(a[7], a[8], a[9]);
    }
    const r = S.root, c = Math.cos(face), s = Math.sin(face);
    guy.g.visible = true;
    guy.g.position.set(x + r[0] * c + r[2] * s, r[1], z - r[0] * s + r[2] * c);
    guy.g.rotation.set(r[3], face + r[4], r[5]);
    guy.g.updateMatrixWorld(true);
    return S.on;
  };
  TR.clipPose = (guy, clip, t, x, z, face) => TR.clipApply(guy, TR.clipSample(clip, t), x, z, face);
})(window.TR = window.TR || {});
