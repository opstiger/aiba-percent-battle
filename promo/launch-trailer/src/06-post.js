/* 06-post — 2D 合成层：镜头震动、冲击推镜、文字、闪白/反相、纸纹、暗角。 */
"use strict";

let PAPER, VIG;

function initPost() {
  // 静态纸纹：低频斑驳 + 高频颗粒 + 纤维（乘法叠加，白 = 不变）
  PAPER = document.createElement("canvas");
  PAPER.width = W; PAPER.height = H;
  const g = PAPER.getContext("2d"), id = g.createImageData(W, H), d = id.data, r = rng(4242);
  const cw = 48, ch = 28, cells = [];
  for (let i = 0; i < (cw + 1) * (ch + 1); i++) cells.push(r());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = x / W * cw, gy = y / H * ch, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const c = (i, j) => cells[(iy + j) * (cw + 1) + ix + i];
    const low = lrp(lrp(c(0, 0), c(1, 0), fx), lrp(c(0, 1), c(1, 1), fx), fy);
    const v = 255 - low * 14 - r() * 16;
    const i4 = (y * W + x) * 4;
    d[i4] = v; d[i4 + 1] = v - 2; d[i4 + 2] = v - 6; d[i4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.strokeStyle = "rgba(120,100,70,.10)";
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU_, l = 6 + r() * 26;
    g.lineWidth = .6 + r();
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + r() * 6, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  VIG = document.createElement("canvas");
  VIG.width = W; VIG.height = H;
  const v = VIG.getContext("2d"), gr = v.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, "rgba(40,20,10,0)"); gr.addColorStop(1, "rgba(40,20,10,.55)");
  v.fillStyle = gr; v.fillRect(0, 0, W, H);
}

/* ---------- 全局卡点效果 ---------- */
function globalShake(f) {
  let x = 0, y = 0;
  for (const c of CUES) {
    if (!c.shake) continue;
    const s = shakeAt(f - frameOf(c.b), c.shake, c.sdur || 8, c.b * 3);
    x += s[0]; y += s[1];
  }
  return [x, y];
}
function globalPunch(f) {
  let z = 0;
  for (const c of CUES) {
    if (!c.punch) continue;
    const d = f - frameOf(c.b);
    if (d >= 0 && d < 10) z += c.punch * Math.pow(1 - d / 10, 3);
  }
  return z;
}
function flashAt(f) {
  for (const c of CUES) {
    const d = f - frameOf(c.b);
    if (c.invert && d >= 0 && d < c.invert) return { invert: true };
    if (c.flash && d >= 0 && d < 5) return { white: c.flash * Math.pow(1 - d / 5, 2) };
  }
  return null;
}

function composite(f, shot, bt) {
  const ctx = OCTX;
  const [sx, sy] = globalShake(f);
  const z = 1 + globalPunch(f) + (Math.abs(sx) + Math.abs(sy)) / 900;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z) + sx, H / 2 * (1 - z) + sy);
  ctx.drawImage(GLC, 0, 0);
  if (shot.ov) { ctx.save(); shot.ov(ctx, bt, f); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 纸纹 + 暗角
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(PAPER, 0, 0);
  ctx.globalAlpha = shot.vig ?? .8;
  ctx.drawImage(VIG, 0, 0);
  ctx.globalAlpha = 1;
  const fl = flashAt(f);
  if (fl?.invert) { ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); }
  if (fl?.white) { ctx.globalCompositeOperation = "screen"; ctx.fillStyle = `rgba(255,250,235,${fl.white})`; ctx.fillRect(0, 0, W, H); }
  if (shot.fade) { const a = shot.fade(bt); if (a > 0) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = hexA(PAL.paper, a); ctx.fillRect(0, 0, W, H); } }
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- 文字 ----------
   漫画印刷感：粗墨边 + 错位套色阴影 + 每两帧轻微抖动 */
function inkText(ctx, str, x, y, o = {}) {
  const size = o.size || 120, font = o.font || "Bangers";
  const j = rng(Math.floor(FRAME / 2) * 31 + (o.seed || 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot || 0);
  ctx.scale(o.sx ?? o.scale ?? 1, o.sy ?? o.scale ?? 1);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.font = `${o.weight || ""} ${size}px ${font.includes(" ") ? `'${font}'` : font}`;
  ctx.textAlign = o.align || "center";
  ctx.textBaseline = "middle";
  if (o.spacing) ctx.letterSpacing = o.spacing + "px";
  const jx = (j() - .5) * (o.jit ?? 3), jy = (j() - .5) * (o.jit ?? 3);
  ctx.lineJoin = "round";
  if (o.shadow !== false) {
    const sd = o.shadowD ?? size * .06;
    ctx.fillStyle = o.shadow || PAL.cyan;
    ctx.fillText(str, sd + jx, sd + jy);
    if (o.shadow2) { ctx.fillStyle = o.shadow2; ctx.fillText(str, -sd * .6 + jx, sd * 1.4 + jy); }
  }
  if (o.stroke !== false) {
    ctx.strokeStyle = o.stroke || PAL.ink;
    ctx.lineWidth = o.strokeW ?? size * .12;
    ctx.strokeText(str, jx, jy);
  }
  ctx.fillStyle = o.fill || PAL.white;
  ctx.fillText(str, jx * .5, jy * .5);
  ctx.restore();
}
/* 圆角印章框 */
function stampBox(ctx, x, y, w, h, col, rot = 0, alpha = 1) {
  const j = rng(Math.floor(FRAME / 2) * 13);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = i / n, side = Math.floor(t * 4), u = (t * 4) % 1;
    const p = [[-w / 2 + u * w, -h / 2], [w / 2, -h / 2 + u * h], [w / 2 - u * w, h / 2], [-w / 2, h / 2 - u * h]][side];
    ctx.lineTo(p[0] + (j() - .5) * 5, p[1] + (j() - .5) * 5);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
