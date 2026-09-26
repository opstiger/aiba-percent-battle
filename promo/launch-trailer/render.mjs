/* aiBA 百分大战 Launch Trailer 渲染器
   node render.mjs deps            安装依赖到 .deps/（不进仓库）
   node render.mjs bake            烘焙水彩贴图到 .cache/plates/
   node render.mjs stills 0,12,96  渲染单帧到 .cache/stills/
   node render.mjs audio           合成音轨 .cache/audio.wav
   node render.mjs video [-j 4]    渲染全片 + 混音 → out/aiba-launch-trailer.mp4
   node render.mjs serve           本地预览（←→ 逐帧，空格播放）
   node render.mjs all             bake + audio + video */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(ROOT, ".cache"), OUTDIR = path.join(ROOT, "out");
const DEPS = ["p5@2.2.3", "p5.brush@2.2.3", "@fontsource/bangers@5", "@fontsource/permanent-marker@5", "@fontsource/zhi-mang-xing@5", "@fontsource/zcool-qingke-huangyou@5"];
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const args = process.argv.slice(2), cmd = args[0] || "all";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function ensureDeps() {
  if (fs.existsSync(path.join(ROOT, ".deps/node_modules/p5.brush"))) return;
  console.log("installing deps → .deps/");
  execSync(`npm install --prefix .deps --no-save --no-package-lock --legacy-peer-deps ${DEPS.join(" ")}`, { cwd: ROOT, stdio: "inherit" });
}
async function loadPlaywright() {
  try { return (await import("playwright")).chromium; } catch {}
  const g = execSync("npm root -g").toString().trim();
  return (await import(path.join(g, "playwright/index.mjs"))).chromium;
}
function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".mjs": "text/javascript" };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p);
    if (ext === ".frag" || ext === ".vert") {           // p5.brush 源码把 GLSL 当模块 import
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end("export default " + JSON.stringify(fs.readFileSync(p, "utf8")) + ";");
    }
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv)));
}
async function openPage(browser, port, q = "") {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => console.error("[page]", e.message));
  page.on("console", m => { if (process.env.DEBUG || m.type() === "error" || m.type() === "warning") console.error("[console]", m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: +(process.env.READY_TIMEOUT || 120000) });
  return page;
}
const b64 = (d) => Buffer.from(d.split(",")[1], "base64");

async function main() {
  if (cmd === "deps") return ensureDeps();
  ensureDeps();
  if (cmd === "serve") { const srv = await serve(); return console.log(`preview: http://127.0.0.1:${srv.address().port}/index.html`); }
  fs.mkdirSync(CACHE, { recursive: true });
  const chromium = await loadPlaywright();
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  try {
    if (cmd === "bake" || cmd === "all") await bake(browser, port);
    if (cmd === "stills") await stills(browser, port, args[1]);
    if (cmd === "audio" || cmd === "all") await audio(browser, port);
    if (cmd === "video" || cmd === "all") await video(browser, port, +opt("-j", 3));
  } finally { await browser.close(); srv.close(); }
}

async function bake(browser, port) {
  const dir = path.join(CACHE, "plates"); fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, port, "?bake=1");
  const only = opt("--only", null);
  for (const n of await page.evaluate(() => window.plateNames())) {
    if (only && !only.split(",").includes(n)) continue;
    const t = Date.now();
    fs.writeFileSync(path.join(dir, n + ".png"), b64(await page.evaluate(n => window.bakePlate(n), n)));
    console.log(`plate ${n} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  await page.close();
}
async function stills(browser, port, list) {
  const dir = path.join(CACHE, "stills"); fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, port);
  for (const f of list.split(",").map(Number)) {
    const t = Date.now();
    fs.writeFileSync(path.join(dir, `f${String(f).padStart(3, "0")}.jpg`), b64(await page.evaluate(f => window.renderFrame(f, "image/jpeg", .9), f)));
    console.log(`frame ${f} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  await page.close();
}
async function audio(browser, port) {
  const page = await openPage(browser, port, "?bake=1");
  const t = Date.now();
  const d = await page.evaluate(() => window.renderAudio());
  fs.writeFileSync(path.join(CACHE, "audio.wav"), b64(d));
  console.log(`audio ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await page.close();
}
async function video(browser, port, jobs) {
  const dir = path.join(CACHE, "frames"); fs.mkdirSync(dir, { recursive: true });
  const total = await (async () => { const p = await openPage(browser, port, "?bake=1"); const n = await p.evaluate(() => window.TOTAL_FRAMES); await p.close(); return n; })();
  const todo = [];
  for (let f = 0; f < total; f++) if (!fs.existsSync(path.join(dir, `f${String(f).padStart(4, "0")}.jpg`)) || args.includes("--force")) todo.push(f);
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: jobs }, async (_, w) => {
    const page = await openPage(browser, port);
    while (todo.length) {
      const f = todo.shift();
      const d = await page.evaluate(f => window.renderFrame(f, "image/jpeg", .95), f);
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, "0")}.jpg`), b64(d));
      if (++done % 24 === 0) console.log(`${done} frames, ${((Date.now() - t0) / done / 1000 * jobs).toFixed(2)}s/frame/worker, ${todo.length} left`);
    }
    await page.close();
  }));
  fs.mkdirSync(OUTDIR, { recursive: true });
  const out = path.join(OUTDIR, "aiba-launch-trailer.mp4");
  const a = ["-y", "-framerate", "30", "-i", path.join(dir, "f%04d.jpg"), "-i", path.join(CACHE, "audio.wav"),
    "-c:v", "libx264", "-preset", "slow", "-crf", opt("--crf", "20"), "-pix_fmt", "yuv420p", "-tune", "animation",
    "-af", "loudnorm=I=-14:TP=-1.2:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out];
  await new Promise((res, rej) => { const p = spawn(FFMPEG, a, { stdio: "inherit" }); p.on("exit", c => c ? rej(new Error("ffmpeg " + c)) : res()); });
  console.log("→", out, (fs.statSync(out).size / 1e6).toFixed(1) + "MB");
}
main().catch(e => { console.error(e); process.exit(1); });
