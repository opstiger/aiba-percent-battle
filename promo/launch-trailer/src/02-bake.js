/* 02-bake — 用 p5.brush 水彩 fill 预烘焙的大面积贴图。
   水彩 fill 单次要几秒，逐帧画不起；烘焙一次存 PNG，逐帧只做位移缩放。
   白底的贴图（bursts / flames）逐帧用 MULTIPLY 叠加，白色自然消失。 */
"use strict";

/* 水彩一笔：多边形 + 晕染 */
function wc(pts, col, a = 150, bleed = .2, tex = .45, border = .4, curv = .5) {
  brush.noStroke();
  brush.fill(col, a);
  brush.fillBleed(bleed);
  brush.fillTexture(tex, border);
  brush.beginShape(curv);
  for (const p of pts) brush.vertex(p[0], p[1]);
  brush.endShape(CLOSE);
  brush.noFill();
}
const wcRect = (x, y, w, h, col, a, bleed = .12) => wc([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col, a, bleed, .5, .3, 0);
const wcBlob = (cx, cy, rx, ry, col, a, seed, wob = .25) => wc(blobPts(cx, cy, rx, ry, 12, wob, seed), col, a, .25);
function washRect(x, y, w, h, col, a = 255) { brush.noStroke(); brush.wash(col, a); brush.rect(x, y, w, h); brush.noWash(); }

/* 城市剪影 */
function skyline(y0, h, col, seed, w) {
  const r = rng(seed), pts = [[0, y0 + 40]];
  let x = 0;
  while (x < w) {
    const bw = 60 + r() * 140, bh = h * (.3 + r() * .7);
    pts.push([x, y0 - bh], [x + bw, y0 - bh]);
    if (r() < .3) pts.push([x + bw * .5, y0 - bh - 40 - r() * 60]);
    x += bw;
  }
  pts.push([w, y0 + 40]);
  wc(pts, col, 190, .08, .3, .5, 0);
}

const PLATE_DEFS = [
  { name: "sunset", w: 2200, h: 1700, seed: 11, bg: "#f6ecd8", draw(w, h) {
    // 天空：上紫 → 橙 → 地平线黄
    washRect(0, 0, w, h * .62, "#f7d9a8");
    wcRect(-40, -40, w + 80, 420, "#8c4a9e", 150);
    wcRect(-40, 250, w + 80, 380, "#f25a5a", 140);
    wcRect(-40, 520, w + 80, 380, "#ff8a3d", 150);
    wcRect(-40, 780, w + 80, 260, "#ffc857", 150);
    wcBlob(w * .62, 880, 250, 250, "#ffe7a0", 200, 3, .05);
    flush(); push(); noStroke(); fill(255, 246, 214, 235); circle(w * .62, 880, 300); pop();
    skyline(1060, 330, "#5a2d6e", 21, w);
    skyline(1060, 330, "#5a2d6e", 21, w);
    skyline(1090, 200, "#3a1f4f", 22, w);
    // 地面（沥青球场）
    wcRect(-40, 1060, w + 80, h - 1040, "#6a5a8c", 200, .05);
    wcRect(-40, 1180, w + 80, h - 1160, "#4b3f6e", 170, .05);
    // 球场白线
    brush.set("marker", "#f6ecd8", 3);
    brush.line(-20, 1260, w + 20, 1240);
    brush.set("pen", "#f6ecd8", 2.5);
    brush.line(w * .2, 1500, w * .35, 1120);
    // 铁丝网
    brush.set("pen", "#2a1638", 1.2);
    for (let x = -300; x < w + 300; x += 46) { brush.line(x, 700, x + 300, 1060); brush.line(x + 300, 700, x, 1060); }
    brush.set("marker", "#2a1638", 3);
    brush.line(0, 700, w, 700);
    for (let x = 0; x < w; x += 330) brush.line(x, 690, x, 1070);
  } },
  { name: "arena", w: 2400, h: 1400, seed: 12, bg: "#2a2c52", draw(w, h) {
    wcRect(-40, -40, w + 80, 700, "#14163a", 230);
    wcRect(-40, 300, w + 80, 500, "#2b2160", 180);
    // 看台人群：一排排小点
    const r = rng(7);
    for (let row = 0; row < 12; row++) {
      const y = 330 + row * 42, cols = ["#5b3f8a", "#c2447a", "#3a4f9a", "#e0a13c", "#1f8f9a"];
      brush.noStroke();
      for (let x = -20; x < w + 20; x += 22 + r() * 10) {
        brush.wash(cols[(r() * cols.length) | 0], 150 + r() * 80);
        brush.circle(x, y + r() * 12, 9 + r() * 5);
      }
      brush.noWash();
    }
    // 灯光柱
    for (const x of [300, 900, 1500, 2100]) wc([[x - 30, -40], [x + 30, -40], [x + 260, 900], [x - 260, 900]], "#fff4c9", 40, .1, .2, .1, 0);
    // 木地板
    wcRect(-40, 820, w + 80, h - 800, "#c8864a", 210, .05);
    wcRect(-40, 1000, w + 80, h - 980, "#b0703c", 150, .05);
    brush.set("pen", "#7a4522", 1.2);
    for (let i = -20; i < 40; i++) brush.line(w / 2 + i * 60, 820, w / 2 + i * 160, h);
    brush.set("marker", "#f6ecd8", 3);
    brush.noFill();
    brush.beginShape(.6);
    for (let i = 0; i <= 20; i++) { const t = Math.PI * i / 20; brush.vertex(w / 2 + Math.cos(t) * 900, 1000 + Math.sin(t) * 260); }
    brush.endShape();
  } },
  { name: "forest", w: 2100, h: 1200, seed: 13, bg: "#eef3de", draw(w, h) {
    wcRect(-40, -40, w + 80, 700, "#b9e0c4", 170);
    const r = rng(5);
    // 峡谷岩壁
    wc([[-40, 0], [520, 0], [620, 400], [480, 800], [-40, 900]], "#8a6b4a", 200, .1);
    wc([[w + 40, 0], [w - 560, 0], [w - 660, 420], [w - 480, 820], [w + 40, 920]], "#7a5c3f", 200, .1);
    for (let i = 0; i < 14; i++) wcBlob(r() * w, 120 + r() * 500, 120 + r() * 160, 80 + r() * 90, ["#2f8f5b", "#1f6f4a", "#5bb56a"][i % 3], 150, 40 + i);
    // 瀑布
    wc([[w * .47, 0], [w * .53, 0], [w * .56, 800], [w * .44, 800]], "#e8fbff", 200, .05, .2, .2, 0);
    wcRect(-40, 780, w + 80, h - 760, "#6f8a4c", 200, .06);
    wcRect(-40, 900, w + 80, h - 880, "#8aa05a", 160, .06);
  } },
  { name: "coast", w: 2100, h: 1200, seed: 14, bg: "#eaf6fb", draw(w, h) {
    wcRect(-40, -40, w + 80, 520, "#8fd3f0", 170);
    wcRect(-40, 300, w + 80, 260, "#ffd6a5", 110);
    wcBlob(w * .3, 360, 120, 120, "#fff1b8", 220, 8, .05);
    // 远山（江之岛）
    wc([[w * .55, 560], [w * .68, 430], [w * .8, 470], [w * .9, 560]], "#5f8fa8", 190, .1);
    // 海
    wcRect(-40, 540, w + 80, 260, "#1f8fbf", 190, .08);
    wcRect(-40, 640, w + 80, 180, "#23a6c9", 150, .08);
    brush.set("marker", "#ffffff", 2.5);
    for (let i = 0; i < 9; i++) { const y = 580 + i * 26; brush.line(100 + i * 173 % 900, y, 400 + i * 173 % 900, y + 4); }
    // 沙滩球场
    wcRect(-40, 790, w + 80, h - 770, "#f0cf8f", 210, .06);
    wcRect(-40, 900, w + 80, h - 880, "#e3b86e", 150, .06);
  } },
  { name: "med", w: 2100, h: 1200, seed: 15, bg: "#f5f7fb", draw(w, h) {
    wcRect(-40, -40, w + 80, 600, "#7cc2ff", 160);
    wcRect(-40, 420, w + 80, 220, "#2a7fd4", 170, .06);
    const r = rng(9);
    // 白房子蓝顶
    for (let i = 0; i < 16; i++) {
      const x = r() * w, y = 480 + r() * 260, bw = 90 + r() * 110, bh = 70 + r() * 80;
      washRect(x, y, bw, bh, "#fffdf6");
      brush.set("pen", "#8aa0b8", 1); brush.noFill(); brush.rect(x, y, bw, bh);
      if (r() < .45) wcBlob(x + bw / 2, y, bw * .4, bw * .32, "#1e5fbf", 210, 60 + i, .05);
      washRect(x + bw * .3, y + bh * .4, bw * .16, bh * .3, "#274b7a");
    }
    wcBlob(w * .15, 300, 90, 90, "#ffe36e", 200, 3, .05);
    // 陶土色球场
    wcRect(-40, 800, w + 80, h - 780, "#e08a5a", 210, .06);
    wcRect(-40, 920, w + 80, h - 900, "#cc7040", 150, .06);
  } },
  { name: "cyber", w: 2100, h: 1200, seed: 16, bg: "#1a1030", draw(w, h) {
    wcRect(-40, -40, w + 80, 900, "#2a1450", 220);
    wcRect(-40, 400, w + 80, 420, "#5a1d6e", 170);
    const r = rng(10);
    for (let i = 0; i < 22; i++) {
      const x = r() * w, bw = 60 + r() * 120, bh = 200 + r() * 500;
      washRect(x, 800 - bh, bw, bh, "#140a26");
      for (let k = 0; k < 8; k++) washRect(x + 10 + r() * (bw - 20), 800 - bh + 20 + r() * (bh - 40), 12, 6, r() < .5 ? "#ff2e88" : "#19c3d0", 220);
    }
    wcRect(-40, 790, w + 80, h - 770, "#221040", 230, .05);
    brush.set("marker", "#ff2e88", 2.5);
    for (let i = -10; i < 30; i++) brush.line(w / 2 + i * 70, 800, w / 2 + i * 200, h);
    brush.set("marker", "#19c3d0", 2.5);
    for (let k = 0; k < 6; k++) { const y = 800 + k * k * 12; brush.line(-20, y, w + 20, y); }
  } },
  { name: "paperbloom", w: 1920, h: 1080, seed: 17, bg: "#f6ecd8", draw(w, h) {
    wcBlob(260, 900, 520, 360, "#ffb36b", 120, 1, .3);
    wcBlob(1700, 180, 480, 320, "#8ee0e8", 110, 2, .3);
    wcBlob(1640, 960, 300, 200, "#ff9ac4", 90, 3, .3);
    wcBlob(200, 150, 260, 180, "#ffe08a", 110, 4, .3);
  } },
];
/* 白底爆炸与火焰 */
const BURSTS = [["burstO", "#ff6a1a", "#ffb03a"], ["burstT", "#19c3d0", "#7fe3ea"], ["burstM", "#ff2e88", "#ff8fc0"], ["burstY", "#ffd23f", "#ff9a3a"]];
BURSTS.forEach(([name, c1, c2], i) => PLATE_DEFS.push({ name, w: 1000, h: 1000, seed: 30 + i, bg: "#ffffff", draw(w, h) {
  const r = rng(90 + i);
  wc(blobPts(500, 500, 330, 300, 18, .35, 5 + i), c1, 200, .3, .5, .6);
  wc(blobPts(500, 500, 200, 190, 14, .3, 9 + i), c2, 170, .25);
  for (let k = 0; k < 9; k++) { const a = r() * TAU_, d = 330 + r() * 120; wcBlob(500 + Math.cos(a) * d, 500 + Math.sin(a) * d, 30 + r() * 50, 25 + r() * 40, c1, 190, 50 + k); }
} }));
for (let i = 0; i < 3; i++) PLATE_DEFS.push({ name: "flame" + i, w: 600, h: 800, seed: 60 + i, bg: "#ffffff", draw(w, h) {
  const tongue = (cx, base, hgt, wid, sd, col, a) => {
    const r = rng(sd), pts = [[cx - wid, base]];
    for (let k = 1; k < 6; k++) pts.push([cx - wid * (1 - k / 6) + (r() - .5) * 40, base - hgt * k / 6 * (.9 + r() * .2)]);
    pts.push([cx + (r() - .5) * 60, base - hgt]);
    for (let k = 5; k >= 1; k--) pts.push([cx + wid * (1 - k / 6) + (r() - .5) * 40, base - hgt * k / 6 * (.9 + r() * .2)]);
    pts.push([cx + wid, base]); pts.push([cx, base + wid * .6]);
    wc(pts, col, a, .2, .4, .5, .5);
  };
  tongue(300, 700, 620, 230, 70 + i, "#ff3b1f", 190);
  tongue(260 + i * 20, 700, 470, 170, 80 + i, "#ff8a1f", 200);
  tongue(300, 700, 300, 110, 90 + i, "#ffd23f", 220);
} });
