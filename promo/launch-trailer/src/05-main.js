/* 05-main — 导演主循环。render.mjs 通过 window.TR 调用：
   TR.boot()          接管游戏场景（一次）
   TR.renderFrame(f)  渲染第 f 帧，返回 JPEG dataURL
   TR.renderAudio()   合成音轨
   同一镜头内必须顺序渲染：有状态的特效（火焰、彩带、观众、球网）从镜头首帧开始模拟。 */
(function (TR) {
  "use strict";
  let cur = null, simF = -1;

  TR.boot = async function () {
    TR.initStage();
    TR.initNeural();
    await TR.initPost();
    await document.fonts.load("40px 'ZCOOL QingKe HuangYou'", "先到就是王免费开玩打开浏览器投体感");
    await document.fonts.load("900 40px Orbitron", "RACE 100");
    return { frames: TR.TOTAL_FRAMES, shots: TR.SHOTS.map(s => [s.f0, s.f1]) };
  };

  TR.renderFrame = function (f, q = .93) {
    const shot = TR.shotAt(f);
    if (shot !== cur || f <= simF) {
      TR.resetShot(shot.preset, shot.seed);
      if (shot.void) TR.setVoid(true);
      for (const k of ["rel", "boom"]) shot[k] = null;
      cur = shot; simF = shot.f0 - 1;
    }
    let bt = 0;
    for (let g = simF + 1; g <= f; g++) {
      bt = TR.beatOf(g) - shot.b0;
      TR.mosaicK = 1;
      TR.S.rack.visible = false;
      TR.ringsReset();
      shot.frame(bt, g);
      TR.tick(g / TR.FPS, 1 / TR.FPS);
    }
    simF = f;
    if (shot.passes) shot.passes(bt, f); else TR.render();
    TR.composite(f, shot, bt);
    return q ? TR.OUT.toDataURL("image/jpeg", q) : null;
  };
})(window.TR = window.TR || {});
