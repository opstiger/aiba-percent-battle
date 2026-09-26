/* main — p5 生命周期、帧调度、对外接口（render.mjs 通过 window.* 调用）。
   ?bake=1   只加载库，供 render.mjs 烘焙水彩贴图
   ?f=123    打开即渲染第 123 帧（手动预览）
   其他      预览播放器（空格播放/暂停，←→ 逐帧） */
"use strict";

const Q = new URLSearchParams(location.search);
const PL = {};                       // 已烘焙贴图 p5.Image
let OUT, OCTX, GLC, JOB = null;

async function setup() {
  GLC = createCanvas(W, H, WEBGL).elt;
  pixelDensity(1);
  brush.scaleBrushes(BRUSH_SCALE);
  noLoop();
  OUT = document.createElement("canvas");
  OUT.width = W; OUT.height = H; OUT.id = "out";
  OCTX = OUT.getContext("2d");
  document.body.appendChild(OUT);
  GLC.style.display = "none";
  await document.fonts.load("100px Bangers");
  await document.fonts.load("100px 'Zhi Mang Xing'", "百分大战先到就是王");
  await document.fonts.load("100px 'ZCOOL QingKe HuangYou'", "免费开玩打开浏览器就能投体感");
  await document.fonts.load("100px 'Permanent Marker'");
  if (!Q.has("bake")) {
    for (const d of PLATE_DEFS) {
      try { PL[d.name] = await loadImage(`.cache/plates/${d.name}.png`); } catch (e) { console.warn("missing plate", d.name); }
    }
  }
  for (const n in PL) if (/^(burst|flame)/.test(n)) PL[n + "_a"] = whiteToAlpha(PL[n]);
  initPost();
  window.READY = true;
  if (Q.has("f")) renderFrame(+Q.get("f"));
  else if (!Q.has("bake") && !navigator.webdriver) startPreview();
}

/* 白底贴图 → 透明底（color-to-alpha），用于暗背景上正常叠加 */
function whiteToAlpha(im) {
  const g = createImage(im.width, im.height);
  im.loadPixels(); g.loadPixels();
  const s = im.pixels, d = g.pixels;
  for (let i = 0; i < s.length; i += 4) {
    const a = 255 - Math.min(s[i], s[i + 1], s[i + 2]);
    d[i + 3] = Math.min(255, a * 1.25);
    for (let c = 0; c < 3; c++) d[i + c] = a ? Math.max(0, Math.min(255, (s[i + c] - (255 - a)) / a * 255)) : 0;
  }
  g.updatePixels();
  return g;
}

function shotAt(f) {
  const b = beatOf(f);
  for (let i = SHOTS.length - 1; i >= 0; i--) if (b >= SHOTS[i].b0) return SHOTS[i];
  return SHOTS[0];
}

function draw() {
  if (JOB == null) return;
  FRAME = JOB;
  const shot = shotAt(JOB), bt = beatOf(JOB) - shot.b0;
  background(PAL.paper);
  push();
  translate(-W / 2, -H / 2);
  brush.noField();
  shot.gl(bt, JOB);
  flush();
  pop();
}

async function renderFrame(f, type = "image/jpeg", q = .93) {
  JOB = f;
  await redraw();
  const shot = shotAt(f);
  composite(f, shot, beatOf(f) - shot.b0);
  return type ? OUT.toDataURL(type, q) : null;
}
window.renderFrame = renderFrame;
window.TOTAL_FRAMES = TOTAL_FRAMES;

/* ---------- 烘焙 ---------- */
window.bakePlate = async function (name) {
  const d = PLATE_DEFS.find(p => p.name === name);
  JOB = null;
  const fb = createFramebuffer({ width: d.w, height: d.h, density: 1, antialias: true });
  fb.begin();
  clear();
  background(d.bg || "#ffffff");
  push();
  translate(-d.w / 2, -d.h / 2);
  brush.load(fb);
  randomSeed(d.seed || 1);
  brush.noField();
  d.draw(d.w, d.h);
  flush();
  brush.load();
  pop();
  fb.end();
  const img = fb.get();
  img.loadPixels();
  const c = document.createElement("canvas");
  c.width = d.w; c.height = d.h;
  const id = new ImageData(new Uint8ClampedArray(img.pixels), d.w, d.h);
  c.getContext("2d").putImageData(id, 0, 0);
  fb.remove();
  return c.toDataURL("image/png");
};
window.plateNames = () => PLATE_DEFS.map(p => p.name);

/* ---------- 预览播放器 ---------- */
function startPreview() {
  let f = 0, playing = false;
  const info = document.createElement("div");
  document.body.prepend(info);
  const show = async () => { await renderFrame(f, null); info.textContent = `frame ${f} / beat ${(f / FPB).toFixed(2)} / ${(f / FPS).toFixed(2)}s`; };
  addEventListener("keydown", e => {
    if (e.key === " ") playing = !playing;
    if (e.key === "ArrowRight") { f = Math.min(TOTAL_FRAMES - 1, f + 1); show(); }
    if (e.key === "ArrowLeft") { f = Math.max(0, f - 1); show(); }
  });
  (async function loop() { if (playing) { f = (f + 1) % TOTAL_FRAMES; await show(); } setTimeout(loop, 10); })();
  show();
}
