/* aiBA 百分大战 Launch Trailer 渲染器（体素像素版）
   直接启动游戏本体（index.html?trailer=1），冻结游戏循环，由 src/ 里的导演脚本逐帧驱动。

   node render.mjs deps               安装中文字体到 .deps/（不进仓库）
   node render.mjs stills 0,96,600    渲染单帧到 .cache/stills/
   node render.mjs audio              合成音轨 .cache/audio.wav
   node render.mjs video [-j 3]       并行渲染全片 + 混音 → out/aiba-launch-trailer.mp4
   node render.mjs all                audio + video
   环境变量 FFMPEG=/path/to/ffmpeg（需要 libx264） */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const CACHE = path.join(HERE, ".cache"), OUTDIR = path.join(HERE, "out");
const SCRIPTS = ["00-core.js", "01-stage.js", "06-neural.js", "02-shots.js", "03-post.js", "04-audio.js", "07-live.js", "08-acts.js", "05-main.js"];
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const args = process.argv.slice(2), cmd = args[0] || "all";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function ensureDeps() {
  if (fs.existsSync(path.join(HERE, ".deps/node_modules/@fontsource/zcool-qingke-huangyou"))) return;
  console.log("installing font → .deps/");
  execSync("npm install --prefix .deps --no-save --no-package-lock @fontsource/zcool-qingke-huangyou@5", { cwd: HERE, stdio: "inherit" });
}
async function loadPlaywright() {
  try { return (await import("playwright")).chromium; } catch {}
  const g = execSync("npm root -g").toString().trim();
  return (await import(path.join(g, "playwright/index.mjs"))).chromium;
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".json": "application/json", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(REPO, decodeURIComponent(req.url.split("?")[0]));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(req.url.includes("favicon") ? 204 : 404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv)));
}

/* 启动游戏 → 固定随机种子 → 冻结循环 → 注入导演脚本 */
async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", e => console.error("[page]", e.message));
  await page.addInitScript(() => {
    let s = 20260926;
    const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Math.random = next;
    window.__reseed = (n) => { s = (n * 2654435761) >>> 0; };
    window.__freeze = false;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => window.__freeze ? 0 : raf(cb);
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?trailer=1&lang=zh&lsSeed=off`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.AIBATrailer && typeof player !== "undefined" && typeof applyScenePreset === "function", null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__freeze = true; });
  await page.waitForTimeout(200);
  await page.addStyleTag({ url: "/promo/launch-trailer/.deps/node_modules/@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css" });
  for (const s of SCRIPTS) await page.addScriptTag({ url: `/promo/launch-trailer/src/${s}` });
  const info = await page.evaluate(() => TR.boot());
  return { page, info };
}
const b64 = (d) => Buffer.from(d.split(",")[1], "base64");

async function main() {
  if (cmd === "deps") return ensureDeps();
  ensureDeps();
  fs.mkdirSync(CACHE, { recursive: true });
  const chromium = await loadPlaywright();
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  try {
    if (cmd === "stills") await stills(browser, port, args[1]);
    if (cmd === "lab") await lab(browser, port, args[1]);
    if (cmd === "audio" || cmd === "all") await audio(browser, port);
    if (cmd === "video" || cmd === "all") await video(browser, port, +opt("-j", 3));
  } finally { await browser.close(); srv.close(); }
}

async function stills(browser, port, list) {
  const dir = path.join(CACHE, "stills"); fs.mkdirSync(dir, { recursive: true });
  const { page } = await openPage(browser, port);
  for (const f of list.split(",").map(Number)) {
    const t = Date.now();
    fs.writeFileSync(path.join(dir, `f${String(f).padStart(3, "0")}.jpg`), b64(await page.evaluate(f => TR.renderFrame(f, .9), f)));
    console.log(`frame ${f} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  await page.close();
}
/* 实验：在页面里跑一段脚本（文件导出 async (TR)=>result），可返回 {frames:[dataURL]} */
async function lab(browser, port, file) {
  const { page } = await openPage(browser, port);
  const code = fs.readFileSync(file, "utf8");
  const r = await page.evaluate(`(${code})(window.TR)`);
  const dir = path.join(CACHE, "lab"); fs.mkdirSync(dir, { recursive: true });
  (r.frames || []).forEach((d, i) => fs.writeFileSync(path.join(dir, `l${String(i).padStart(3, "0")}.jpg`), b64(d)));
  delete r.frames; console.log(JSON.stringify(r, null, 1));
  await page.close();
}
async function audio(browser, port) {
  const { page } = await openPage(browser, port);
  const t = Date.now();
  fs.writeFileSync(path.join(CACHE, "audio.wav"), b64(await page.evaluate(() => TR.renderAudio())));
  console.log(`audio ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await page.close();
}
/* 以镜头为单位分给各进程：镜头内部顺序渲染，保证有状态特效可复现 */
async function video(browser, port, jobs) {
  const dir = path.join(CACHE, "frames"); fs.mkdirSync(dir, { recursive: true });
  const name = (f) => path.join(dir, `f${String(f).padStart(4, "0")}.jpg`);
  const first = await openPage(browser, port);
  const shots = first.info.shots, total = first.info.frames;
  const queue = shots.map(([a, b]) => [a, b]).filter(([a, b]) => { for (let f = a; f < b; f++) if (!fs.existsSync(name(f)) || args.includes("--force")) return true; return false; })
    .sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  const t0 = Date.now();
  let done = 0;
  const pages = [first.page];
  for (let w = 1; w < jobs; w++) pages.push((await openPage(browser, port)).page);
  await Promise.all(pages.map(async (page) => {
    while (queue.length) {
      const [a, b] = queue.shift();
      for (let f = a; f < b; f++) {
        fs.writeFileSync(name(f), b64(await page.evaluate(f => TR.renderFrame(f, .95), f)));
        if (++done % 48 === 0) console.log(`${done} frames · ${((Date.now() - t0) / done / 1000).toFixed(2)}s/frame`);
      }
    }
    await page.close();
  }));
  fs.mkdirSync(OUTDIR, { recursive: true });
  const out = path.join(OUTDIR, "aiba-launch-trailer.mp4");
  const a = ["-y", "-framerate", "30", "-i", path.join(dir, "f%04d.jpg"), "-i", path.join(CACHE, "audio.wav"),
    "-c:v", "libx264", "-preset", "slow", "-crf", opt("--crf", "22"), "-pix_fmt", "yuv420p", "-tune", "animation",
    "-af", "loudnorm=I=-14:TP=-1.2:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out];
  await new Promise((res, rej) => { const p = spawn(FFMPEG, a, { stdio: ["ignore", "ignore", "inherit"] }); p.on("exit", c => c ? rej(new Error("ffmpeg " + c)) : res()); });
  console.log("→", out, (fs.statSync(out).size / 1e6).toFixed(1) + "MB", `(${total} frames)`);
}
main().catch(e => { console.error(e); process.exit(1); });
