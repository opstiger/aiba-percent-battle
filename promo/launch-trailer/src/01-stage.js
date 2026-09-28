/* 01-stage — 接管游戏场景：演员、球、灯、镜头、特效状态重置。
   所有游戏全局（scene/camera/renderer/voxelGuy/poseGuy/…）都来自游戏本体，这里只调用不复制。 */
(function (TR) {
  "use strict";
  const { clamp, lerp } = TR;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const S = TR.S = { actors: {}, balls: [], lights: [], preset: null, spot: null };

  /* ---------- 初始化 ---------- */
  TR.initStage = function () {
    renderer.setPixelRatio(1);
    renderer.setSize(TR.RW, TR.RH, false);
    if (typeof RENDER_QUALITY !== "undefined") RENDER_QUALITY.locked = true;
    camera.aspect = TR.RW / TR.RH;
    // 游戏里自己的演员和第一人称手全部藏起来，由导演接管
    for (const o of [player && player.g, typeof hands !== "undefined" && hands, typeof handBall !== "undefined" && handBall, typeof pBall !== "undefined" && pBall]) if (o) o.visible = false;
    if (typeof rivals !== "undefined" && rivals) rivals.forEach(r => r && r.g && (r.g.visible = false));
    if (typeof OPP !== "undefined" && OPP && OPP.guy && OPP.guy.g) OPP.guy.g.visible = false;

    TR.hideParody();
    // 主角"你"：青色 1 号、红头带、金护腕
    const hero = voxelGuy();
    hero.lefty = false;
    dressGuy(hero, 0x14b8d4, 0x0c1a2a, "1");
    hero.mS.color.setHex(0xc68e62).convertSRGBToLinear();
    hero.mFace.map = faceTex(0xc68e62); hero.mFace.color.setHex(0xffffff); hero.mFace.needsUpdate = true;
    hero.headband.visible = true; hero.headband.material.color.setHex(0xff4040);
    hero.wrists.forEach(w => { w.visible = true; w.material.color.setHex(0xffd23f); });
    setHair(hero, "fade", 0x141414);
    // 游戏自带的体素球鞋（高细节鞋款都带真实品牌的影子，宣传片不用），配色取装备"疾风橙"
    hero.shoes.forEach(s => s.material.color.setHex(0xe8771e).convertSRGBToLinear());
    scene.add(hero.g);
    // AI 传奇 N-24 夜航者（游戏原创球星）
    const legend = voxelGuy();
    applyStarStyle(legend, LEGENDS.find(l => l.id === "nova24") || LEGENDS[0]);
    if (window.AIBABasketballShoes) AIBABasketballShoes.clear(legend);
    legend.shoes.forEach(s => s.material.color.setHex(0x171a20).convertSRGBToLinear());
    scene.add(legend.g);
    // 体感段落的"真人"：灰卫衣普通人
    const human = voxelGuy();
    dressGuy(human, 0x5b6270, 0x2a2f3a, "");
    human.mS.color.setHex(0xe0b48c).convertSRGBToLinear();
    human.mFace.map = faceTex(0xe0b48c); human.mFace.color.setHex(0xffffff); human.mFace.needsUpdate = true;
    human.headband.visible = false; setHair(human, "short", 0x2a1c12);
    scene.add(human.g);
    S.actors = { hero, legend, human };

    // 球池
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(ballGeo, matBall);
      m.visible = false; scene.add(m);
      const sh = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.visible = false; scene.add(sh);
      S.balls.push({ m, sh });
    }
    // 导演自己的顶光
    const spot = new THREE.SpotLight(0xfff1d0, 0, 30, .42, .45, 1.2);
    spot.position.set(0, 12, 0); scene.add(spot); scene.add(spot.target);
    S.spot = spot;
    // 机位侧补光：暗场里保证脸能读出来（跟着相机走）
    const key = new THREE.PointLight(0xcfe8ff, 0, 9, 1.6); scene.add(key); S.key = key;
    // 体感段落的小房间（离球场很远，单独取景）
    const room = new THREE.Group(); room.position.set(60, 0, 60);
    const wallM = new THREE.MeshLambertMaterial({ color: 0x3a4152 }), floorM = new THREE.MeshLambertMaterial({ color: 0x6b5a48 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 5, .2), wallM); wall.position.set(0, 2.5, -2.2); room.add(wall);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, .1, 8), floorM); floor.position.set(0, -.05, 0); room.add(floor);
    const poster = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, .05), new THREE.MeshBasicMaterial({ color: 0xffd23f })); poster.position.set(-1.8, 2.3, -2.08); room.add(poster);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, .9, .5), new THREE.MeshLambertMaterial({ color: 0x23262f })); shelf.position.set(2.1, .45, -1.8); room.add(shelf);
    const lamp = new THREE.PointLight(0xffc98a, 1.2, 9); lamp.position.set(1.5, 2.6, 1); room.add(lamp);
    const fillL = new THREE.PointLight(0x77e7ff, .6, 9); fillL.position.set(-2, 1.8, 2); room.add(fillL);
    scene.add(room); S.room = room;
    // 简化体素球架（RACK RUSH）
    const rack = new THREE.Group(), metal = new THREE.MeshLambertMaterial({ color: 0x39485b }), rail = new THREE.MeshLambertMaterial({ color: 0xffd23f });
    for (const x of [-.55, .55]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.08, .95, .08), metal); post.position.set(x, -.45, 0); rack.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.25, .06, .32), rail); bar.position.set(0, -.08, 0); bar.rotation.z = -.12; rack.add(bar);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(ballGeo, matBall); b.position.set(-.42 + i * .3, .12 - i * .036, 0); rack.add(b); }
    rack.visible = false; scene.add(rack); S.rack = rack;
  };
  /* 游戏里的恶搞广告牌（N1KE AIR / ADI-DASH / MINE-DEW）在宣传片里不出镜；换场景后要重新藏 */
  TR.hideParody = function () {
    if (typeof indoorRoot === "undefined") return;
    // 场边 LED 广告带（24 段，按 RIBBON_ADS 轮换）与一面看台横幅里也有恶搞品牌字样：换成游戏自己的中性广告
    if (!TR._retextured) {
      TR._retextured = true;
      let i = 0;
      const swap = { 1: "PIXEL SPORT", 5: "3PT KING", 6: "aiBA" };
      indoorRoot.children.forEach(o => {
        const g = o.geometry && o.geometry.parameters;
        if (!o.isMesh || !g) return;
        if (Math.abs(g.width - 3.4) < .01 && Math.abs(g.height - .5) < .01) { const t = swap[i % 8]; if (t) { o.material.map = bannerTex(t, "#070c14", "#7ee7ff"); o.material.needsUpdate = true; } i++; }
        if (Math.abs(g.width - 48) < .01 && Math.abs(o.position.x + 27.5) < .1) { o.material.map = bannerTex("RACE TO 100 · 先到 100", "#13213f", "#ffd23f"); o.material.needsUpdate = true; }
      });
    }
    indoorRoot.traverse(o => {
      const g = o.geometry && o.geometry.parameters;
      if (!o.isMesh || !g || Math.abs(g.height - .72) > .01 || Math.abs(o.position.y - .66) > .01) return;
      const p = o.position, hit = (x, z) => Math.abs(p.x - x) < .05 && Math.abs(p.z - z) < .05;
      if (hit(-8.05, COURT.midZ + 4.2) || hit(-8.05, COURT.midZ + 7.5) || hit(-4.6, COURT.farBaseline - .2)) o.visible = false;
    });
  };
  TR.rack = function (p) { S.rack.visible = true; S.rack.position.copy(p); S.rack.rotation.y = .6; };

  /* ---------- 场景切换 + 状态重置（每个镜头开头调用） ---------- */
  TR.resetShot = function (preset, seed) {
    if (TR.LIVE && TR.LIVE.on) TR.liveEnd();
    window.__reseed && window.__reseed(seed);
    if (TR.setVoid) TR.setVoid(false);
    if (typeof G !== "undefined") { G.tNow = 0; G.cheer = 0; G.score = 0; }
    if (preset) applyScenePreset(preset, { silent: true, persist: false });
    S.preset = preset;
    for (let i = 0; i < 4; i++) if (typeof updateEnvironment === "function") updateEnvironment(1 / 30);
    // 记录当前灯光基准亮度
    S.lights = [];
    scene.traverse(o => { if (o.isLight && o !== S.spot && o !== S.key && !(S.room && isChildOf(o, S.room)) && !(S.voidGroup && isChildOf(o, S.voidGroup))) S.lights.push({ o, base: o.intensity }); });
    S.spot.intensity = 0; S.key.intensity = 0;
    // 特效清零
    if (typeof fireLife !== "undefined") { fireLife.fill(0); for (let i = 0; i < fireLife.length; i++) firePos[i * 3 + 1] = -99; if (typeof fireGeoB !== "undefined") fireGeoB.attributes.position.needsUpdate = true; }
    if (typeof confPts !== "undefined") confPts.visible = false;
    if (typeof netMesh !== "undefined" && netMesh) deformNet(netMesh, 0, 99, 0);
    if (typeof crowd !== "undefined" && crowd && crowd.groups) crowd.groups.forEach(g => g.seats.forEach(s => { s.responseStart = -100; s.responseDuration = 0; }));
    for (const b of S.balls) { b.m.visible = false; b.sh.visible = false; }
    for (const k in S.actors) { const a = S.actors[k]; a.g.visible = false; a.g.rotation.set(0, 0, 0); TR.head(a, 0, 0); }
    if (TR.resetStars) TR.resetStars();
    // 游戏的投篮架：每个镜头开头恢复成三分大赛开局的样子（5 颗球满架），镜头之间不串状态
    if (typeof rackStands !== "undefined") {
      rackStands.forEach(st => { if (st) st.visible = true; });
      rackBalls.forEach((bs, i) => { bs.forEach(b => { b.visible = true; }); seatRackBalls(i, 0, false); });
    }
    TR.hideParody();
    TR.lights(1);
  };
  function isChildOf(o, p) { while (o) { if (o === p) return true; o = o.parent; } return false; }

  TR.lights = function (k) { for (const L of S.lights) L.o.intensity = L.base * k; };
  TR.spot = function (x, z, k, y = 11) { S.spot.position.set(x, y, z + .5); S.spot.target.position.set(x, 0, z); S.spot.intensity = k; };

  /* ---------- 每帧推进游戏自带的环境动画 ---------- */
  TR.tick = function (t, dt) {
    if (typeof G !== "undefined") G.tNow = t;
    if (typeof crowd !== "undefined" && crowd) crowd.clock = t;
    try { updateEnvironment(dt); } catch (e) { }
    try { updCrowd(t); } catch (e) { }
    try { updBackcourtShow(t); } catch (e) { }
    try { updStreetCrowd(t, dt); } catch (e) { }
    try { updNearCourtCrowd(t, dt); } catch (e) { }
    try { updFire(dt); } catch (e) { }
    try { updConf(dt); } catch (e) { }
    if (window.AIBABasketballShoes) try { AIBABasketballShoes.updateAll(dt); } catch (e) { }
  };
  TR.cheer = function (points = 3) { try { triggerArenaCrowdReaction("make", points); } catch (e) { } try { triggerNearCourtCrowdReaction && triggerNearCourtCrowdReaction("make", points); } catch (e) { } };

  /* ---------- 姿势 ----------
     非投篮姿势：直接写关节角，符号照游戏（见 ANIMATION_GUIDE）。 */
  const REST = { aR: -.03, aRz: 0, eR: -.09, aL: -.03, aLz: 0, eL: -.09, hR: 0, kR: 0, hL: 0, kL: 0, lean: 0, hx: 0, hy: 0, lift: 0 };
  TR.POSES = {
    stand: {},
    dribbleUp: { aR: -.75, eR: -.9, aL: -.35, eL: -.9, hR: -.5, kR: .85, hL: -.35, kL: .7, lean: -.18 },
    dribbleDown: { aR: -.35, eR: -.25, aL: -.35, eL: -.9, hR: -.55, kR: .95, hL: -.4, kL: .8, lean: -.22 },
    chest: { aR: -.62, eR: -1.25, aRz: -.12, aL: -.62, eL: -1.25, aLz: .12, hR: -.25, kR: .4, hL: -.2, kL: .35, lean: -.05 },
    defend: { aR: -2.75, aRz: -.3, eR: -.25, aL: -2.75, aLz: .3, eL: -.25, hR: -.45, kR: .75, hL: -.45, kL: .75, lean: -.12 },
    guard: { aR: -1.3, aRz: -.9, eR: -.4, aL: -1.3, aLz: .9, eL: -.4, hR: -.55, kR: .9, hL: -.55, kL: .9, lean: -.2 },
    roar: { aR: -2.75, aRz: -.6, eR: -.15, aL: -2.75, aLz: .6, eL: -.15, hR: .1, kR: .15, hL: -.1, kL: .2, lean: .1, hx: -.15 },
    flex: { aR: -1.6, aRz: -1.25, eR: -1.9, aL: -1.6, aLz: 1.25, eL: -1.9, hR: -.2, kR: .3, hL: -.2, kL: .3, lean: .05, hx: -.2 },
    point: { aR: -1.55, aRz: -.1, eR: -.05, aL: -.1, eL: -.3, lean: -.03 },
    spin: { aR: -2.9, eR: -.1, aL: -.3, aLz: -.2, eL: -.5, hx: -.15 },
    lookUp: { aR: -.1, eR: -.2, aL: -.1, eL: -.2, hx: -.3 },
  };
  TR.pose = function (guy, P) {
    P = Object.assign({}, REST, P);
    guy.arms[0].rotation.set(P.aR, 0, P.aRz); guy.elbows[0].rotation.set(P.eR, 0, 0);
    guy.arms[1].rotation.set(P.aL, 0, P.aLz); guy.elbows[1].rotation.set(P.eL, 0, 0);
    const legs = [[P.hR, P.kR], [P.hL, P.kL]];
    let low = Infinity;
    legs.forEach(([h, k], i) => {
      const hip = h - P.lean, ank = -(h + k) * .98;
      guy.legs[i].rotation.set(hip, 0, 0); guy.knees[i].rotation.set(k, 0, 0); guy.ankles[i].rotation.set(ank, 0, 0);
      low = Math.min(low, POSE_STAND_FOOT_Y - poseFootBottomY(hip + P.lean, k, ank));
    });
    guy.g.rotation.x = P.lean;
    TR.head(guy, P.hx, P.hy);
    return low + P.lift;
  };
  /* 头部转动必须绕脖子（y=1.45）转：headRoot 的原点在脚底，
     直接写 rotation.x 会让整颗头绕着脚踝甩出去（"头身分离"）。 */
  /* 头部俯仰/转头：游戏的 headRoot 已经以脖子为支点旋转（characters.js pivotHeadAtNeck），
     这里只写角度；旧版本游戏没有该修正时，退回手动补偿 position。 */
  const NECK = 1.45, _v = new THREE.Vector3(), _e = new THREE.Euler();
  TR.head = function (guy, pitch = 0, yaw = 0) {
    const h = guy.headRoot; if (!h) return;
    h.rotation.set(pitch, yaw, 0);
    if (h.updateMatrix !== THREE.Object3D.prototype.updateMatrix) return;
    if (!h.userData.p0) h.userData.p0 = h.position.clone();
    const p0 = h.userData.p0, s = h.scale.y;
    _v.set(0, NECK * s, 0).applyEuler(_e.set(pitch, yaw, 0));
    h.position.set(p0.x - _v.x, p0.y + NECK * s - _v.y, p0.z - _v.z);
  };
  /* 投篮：游戏原曲线。ph 0→1.2（0.76 起跳，≈0.9 出手） */
  TR.shoot = function (guy, ph) {
    const c = shotCurves(ph, guy.shotStyle);
    TR.head(guy, 0, 0);
    return poseGuy(guy, c, 0) + Math.max(0, c.jmp * .55 - c.over * .55);
  };
  /* 放置：pos=[x,z]，face=朝向角（或朝向点） */
  TR.place = function (guy, x, z, y, face) {
    guy.g.visible = true;
    guy.g.position.set(x, y, z);
    guy.g.rotation.y = typeof face === "number" ? face : Math.atan2(face[0] - x, face[1] - z);
    guy.g.updateMatrixWorld(true);
  };
  TR.faceHoop = (x, z) => Math.atan2(HOOP.x - x, HOOP.z - z);
  TR.world = (obj) => { obj.updateMatrixWorld(true); return obj.getWorldPosition(new THREE.Vector3()); };
  TR.grip = (guy, i = 0) => TR.world(guy.ballGrips[i]);
  TR.hand = (guy, i = 0) => TR.world(guy.handRoots[i]);

  /* ---------- 球 ---------- */
  TR.ball = function (i, p, spin = 0, shadow = true) {
    const b = S.balls[i];
    b.m.visible = true; b.m.position.copy(p); b.m.rotation.set(spin, spin * .6, 0);
    b.sh.visible = shadow; b.sh.position.set(p.x, .012, p.z);
    const s = clamp(1.4 - p.y * .18, .4, 1.3); b.sh.scale.set(s, s, s); b.sh.material.opacity = .35 * s / 1.3;
  };
  TR.hideBall = (i) => { S.balls[i].m.visible = false; S.balls[i].sh.visible = false; };
  /* 抛物线：from → HOOP 上方，u 0..1，峰值高 peak */
  TR.arc = function (from, u, peak = 1.6, to) {
    to = to || new THREE.Vector3(HOOP.x, HOOP.y + .02, HOOP.z);
    const p = from.clone().lerp(to, u);
    p.y += peak * 4 * u * (1 - u);
    return p;
  };
  /* 入网后：从篮筐中心掉下去 */
  TR.drop = (t) => new THREE.Vector3(HOOP.x, HOOP.y - t * 2.6 - t * t * 3, HOOP.z);
  TR.net = function (age, level = 1, dir = 0) { if (typeof netMesh !== "undefined" && netMesh) deformNet(netMesh, age >= 0 ? level : 0, Math.max(0, age), dir); };

  /* ---------- 镜头 ---------- */
  TR.cam = function (pos, look, fov = 40, roll = 0) {
    camera.fov = fov; camera.aspect = TR.RW / TR.RH; camera.updateProjectionMatrix();
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(look[0], look[1], look[2]);
    if (roll) camera.rotateZ(roll);
    camera.updateMatrixWorld(true);
  };
  /* 围绕中心点的极坐标机位 */
  TR.orbit = function (c, ang, dist, h, lookY, fov, roll) {
    TR.cam([c[0] + Math.sin(ang) * dist, h, c[1] + Math.cos(ang) * dist], [c[0], lookY, c[1]], fov, roll);
  };
  /* 希区柯克变焦（dolly zoom）：目标平面上的画面宽度 width 恒定，fov 变化的同时
     沿 dir（目标→机位方向）推拉机位，主体大小不变、背景透视被拉伸/压缩。 */
  TR.vertigo = function (target, dir, fov, width, roll = 0, lookY) {
    const d = width / (2 * Math.tan(fov * Math.PI / 360) * (TR.RW / TR.RH));
    const n = dir.clone().normalize();
    TR.cam([target.x + n.x * d, target.y + n.y * d, target.z + n.z * d], [target.x, lookY ?? target.y, target.z], fov, roll);
  };
  /* 让目标点落在画面横向 sx（-1 左 … 1 右）处：把视线往反方向偏 */
  TR.shiftX = function (target, sx) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const r = new THREE.Vector3().crossVectors(f, camera.up).normalize();
    const d = camera.position.distanceTo(target), w = Math.tan(camera.fov * Math.PI / 360) * d * camera.aspect;
    const look = target.clone().addScaledVector(r, -sx * w);
    camera.lookAt(look); camera.updateMatrixWorld(true);
  };
  /* 3D → 1920×1080 屏幕坐标 */
  TR.project = function (p) {
    const v = p.clone().project(camera);
    return [(v.x + 1) / 2 * TR.W, (1 - v.y) / 2 * TR.H, v.z];
  };
  TR.keyLight = function (k) { S.key.intensity = k; };
  TR.render = function () {
    if (S.key.intensity > 0) { const f = new THREE.Vector3(); camera.getWorldDirection(f); S.key.position.copy(camera.position).addScaledVector(f, .6).add(new THREE.Vector3(0, .8, 0)); }
    if (typeof updGroundShadows === "function") try { updGroundShadows(); } catch (e) { }
    renderer.render(scene, camera);
  };

  /* 热手火焰：在点 p 附近喷 n 粒 */
  TR.fire = function (p, n = 3) { for (let i = 0; i < n; i++) emitFire(p); };
  TR.confetti = function () { startConfetti(); };
})(window.TR = window.TR || {});
