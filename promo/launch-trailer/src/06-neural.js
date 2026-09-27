/* 06-neural — 「NEURAL COURT」专用：18 位球星名单、全息扫描重建、数字虚空世界。 */
(function (TR) {
  "use strict";
  const { clamp, lerp } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = TR.S;

  /* 重建顺序：N-24 打头（A 段），其余 17 位在 B 段依次出现，最大牌压轴 */
  const ORDER = ["nova24", "curry", "thompson", "h13", "lillard", "ionescu", "taurasi", "sue-bird", "allen", "miller",
    "korver", "stojakovic", "bird", "t01", "v15", "a03", "k24", "j23"];

  const GLOW = new THREE.MeshBasicMaterial({ color: 0xc8fbff });
  const WIRE = new THREE.MeshBasicMaterial({ color: 0x1fb8e8, wireframe: true, transparent: true, opacity: .55, depthWrite: false });
  const WIRE_GOLD = new THREE.MeshBasicMaterial({ color: 0xffc83a, wireframe: true, transparent: true, opacity: .65, depthWrite: false });

  TR.initNeural = function () {
    const cfg = window.AIBA_CONFIG || {};
    S.stars = ORDER.map(id => {
      const data = LEGENDS.find(l => l.id === id);
      const guy = id === "nova24" ? S.actors.legend : voxelGuy();
      if (id !== "nova24") {
        applyStarStyle(guy, data);
        // 高细节球鞋带真实品牌影子，统一换回游戏自带体素鞋
        if (window.AIBABasketballShoes) AIBABasketballShoes.clear(guy);
        guy.shoes.forEach(s => s.material.color.setHex(data.shoe != null ? data.shoe : 0xeeeeea).convertSRGBToLinear());
        scene.add(guy.g);
      }
      const prof = cfg.shotProfileFor ? cfg.shotProfileFor(data) : { arcLabel: "标准弧线", label: "标准出手" };
      return { id, data, guy, name: data.n, num: data.num, ovr: data.r, arc: prof.arcLabel, style: prof.label, col: data.col && data.col[0] };
    });
    for (const g of [S.actors.hero, S.actors.human, ...S.stars.map(s => s.guy)]) prepHolo(g);

    /* ---- 数字虚空 ---- */
    const vg = new THREE.Group(); vg.visible = false;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x03060e }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; vg.add(floor);
    const g1 = new THREE.GridHelper(160, 160, 0x2fd0ff, 0x0e3c52); g1.material.transparent = true; g1.material.opacity = .55; vg.add(g1);
    const g2 = new THREE.GridHelper(160, 32, 0x77e7ff, 0x77e7ff); g2.material.transparent = true; g2.material.opacity = .35; g2.position.y = .002; vg.add(g2);
    S.grids = [g1, g2];
    // 数据光柱
    const pm = new THREE.MeshBasicMaterial({ color: 0x2fd0ff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
    const pmG = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
    const r = TR.rng(404);
    S.pillars = [];
    for (let i = 0; i < 140; i++) {
      const a = r() * Math.PI * 2, d = 12 + r() * 40;
      const m = new THREE.Mesh(new THREE.BoxGeometry(.12 + r() * .2, 1, .12 + r() * .2), r() < .15 ? pmG : pm);
      m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 10);
      m.userData = { h: 2 + r() * 14, ph: r() * 6, sp: .4 + r() * 1.2 };
      vg.add(m); S.pillars.push(m);
    }
    // 扫描环
    S.rings = [];
    for (let i = 0; i < 20; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 40), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.visible = false; vg.add(ring); S.rings.push(ring);
    }
    // 虚空灯光（只在虚空里生效）
    vg.add(new THREE.AmbientLight(0x6f8fb0, .75));
    const k = new THREE.DirectionalLight(0xffffff, .9); k.position.set(3, 8, 10); vg.add(k);
    const rim = new THREE.DirectionalLight(0x40e0ff, 1.4); rim.position.set(-6, 5, -10); vg.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffc83a, .6); rim2.position.set(8, 3, -6); vg.add(rim2);
    scene.add(vg); S.voidGroup = vg;
    S.keep = new Set([vg, S.spot, S.key, S.spot.target, S.rack, ...S.balls.flatMap(b => [b.m, b.sh]), ...[S.actors.hero, S.actors.human, ...S.stars.map(s => s.guy)].map(g => g.g)]);
  };

  /* ---------- 全息 ---------- */
  function prepHolo(guy) {
    const g = guy.g, p0 = g.position.clone(), r0 = g.rotation.clone(), v0 = g.visible;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); TR.pose(guy, {}); g.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new THREE.Vector3();
    guy.holo = [];
    g.traverse(m => {
      if (!m.isMesh) return;
      box.setFromObject(m); box.getCenter(c);
      m.userData.ry = isFinite(c.y) ? c.y : 1; m.userData.m0 = m.material; m.userData.v0 = m.visible;
      guy.holo.push(m);
    });
    g.position.copy(p0); g.rotation.copy(r0); g.visible = v0;
    guy.holoTop = Math.max(...guy.holo.map(m => m.userData.ry));
  }
  /* scan：扫描高度（米，0 = 脚底，≥ 头顶 = 全部实体）；ghost：未扫到部分的线框透明度（0 = 隐藏） */
  TR.holo = function (guy, scan, ghost = .35, gold = false) {
    const sy = guy.g.scale.y || 1;
    for (const m of guy.holo) {
      const y = m.userData.ry * sy;
      if (!m.userData.v0) { m.visible = false; continue; }
      if (y < scan - .04) { m.material = m.userData.m0; m.visible = true; }
      else if (y < scan + .09) { m.material = GLOW; m.visible = true; }
      else if (ghost > 0) { m.material = gold ? WIRE_GOLD : WIRE; m.visible = true; }
      else m.visible = false;
    }
    WIRE.opacity = Math.min(.7, (ghost || .35) * 1.3);
  };
  TR.solid = function (guy) { for (const m of guy.holo) { m.material = m.userData.m0; m.visible = m.userData.v0; } };
  TR.wire = function (guy, gold) { TR.holo(guy, -1, .45, gold); };
  /* 扫描环跟随 */
  let ringIdx = 0;
  TR.ringsReset = function () { ringIdx = 0; for (const r of S.rings) r.visible = false; };
  TR.ring = function (x, y, z, s = 1, a = .9) {
    const r = S.rings[ringIdx++ % S.rings.length];
    r.visible = true; r.position.set(x, y, z); r.scale.setScalar(s); r.material.opacity = a;
  };

  /* ---------- 虚空 ↔ 球馆 ---------- */
  let saved = null, bg0, fog0;
  TR.setVoid = function (on) {
    if (on && !saved) {
      saved = new Map();
      for (const o of scene.children) { saved.set(o, o.visible); if (!S.keep.has(o)) o.visible = false; }
      bg0 = scene.background; fog0 = scene.fog;
      scene.background = new THREE.Color(0x02040a); scene.fog = new THREE.Fog(0x02040a, 14, 70);
      S.voidGroup.visible = true;
    } else if (!on && saved) {
      for (const [o, v] of saved) o.visible = v;
      scene.background = bg0; scene.fog = fog0; saved = null;
      S.voidGroup.visible = false;
    }
  };
  /* 虚空动画：光柱起伏，网格铺开 k（0..1） */
  TR.voidTick = function (t, k = 1) {
    for (const m of S.pillars) {
      const u = m.userData, h = u.h * (.55 + .45 * Math.sin(t * u.sp + u.ph)) * k + .01;
      m.scale.y = h; m.position.y = h / 2;
    }
    for (const g of S.grids) g.scale.setScalar(Math.max(.001, k));
  };

  /* 所有球星隐藏并恢复实体（每个镜头开头） */
  TR.resetStars = function () {
    for (const s of S.stars) { TR.solid(s.guy); s.guy.g.visible = false; s.guy.g.rotation.set(0, 0, 0); s.guy.headRoot.rotation.set(0, 0, 0); }
    for (const g of [S.actors.hero, S.actors.human]) TR.solid(g);
    TR.ringsReset();
  };
  TR.star = (id) => S.stars.find(s => s.id === id);
  TR.clearNear = function (r = 1.4, keep) {
    for (const s of S.stars) { if (s.guy === keep) continue; const p = s.guy.g.position; const d = Math.hypot(p.x - camera.position.x, p.z - camera.position.z); if (d < r) s.guy.g.visible = false; }
  };
})(window.TR = window.TR || {});
