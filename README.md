# aiBA Percent Battle

**English** | [简体中文](README.zh-CN.md)

![aiBA Percent Battle screenshot](assets/readme/hero-court.jpg)

A cyberpunk voxel 3D basketball game that runs entirely in your browser — shoot with your touch screen, or with your **real shooting form** through the webcam. A personal open-source project, iterating fast.

## Play now

- Vercel (auto-deployed): https://aiba-percent-battle.vercel.app/
- GitHub Pages (mirror): https://opstiger.github.io/aiba-percent-battle/

Current version: `v2.19.9`

| Home | Percent Battle | Locker room | Motion control |
|---|---|---|---|
| ![Home screen](assets/readme/home.jpg) | ![Percent Battle](assets/readme/battle.jpg) | ![Locker room](assets/readme/locker.jpg) | ![Motion control](assets/readme/motion.jpg) |

## Highlights

- **Bilingual** — the UI auto-detects your browser language (English / 中文); switch anytime in Settings (⚙) or with `?lang=en` / `?lang=zh` in the URL.
- **Camera shot control** — charge and release by performing an actual shooting motion in front of your webcam (MediaPipe pose tracking, runs locally, no video leaves your device).
- **Race to 100 vs. voxel legends** — head-to-head scoring battles against AI stars, with hero-moment cinematics on game winners.
- **Highlight recorder** — key plays are captured for instant replays and sharing.
- **Global leaderboard** — Rack Rush scores upload to an online ranking (Cloudflare Workers + D1), with anonymous player IDs and an offline queue.
- **Locker room & workshop** — pick a player, wear gear that changes real stats, or build your own voxel baller.
- **Pure static site** — no build step, no framework; clone it and open it.

## Game modes

- **Percent Battle** — you and an AI legend shoot simultaneously; first to 100 points wins. Tap court spots or use arrow keys to relocate.
- **3PT Contest** — a timed classic three-point shootout.
- **Rack Rush** — machine-fed catch-and-shoot: clear 5 stage goals to reach FINAL RUSH. Normal makes score 2, every 5th ball scores 3, and makes in the last 10 seconds earn +1. Scores can enter the global leaderboard.
- **NBA DNA** (experimental) — match a photo of your shooting pose against the legends for an entertainment-style DNA report.
- An **interactive tutorial** onboards new players, including a shadow-practice walkthrough for camera control.

## How to play

- Hold to charge, release to shoot.
- In the pre-game locker room you can wear up to 3 gear pieces (shoes / arm sleeve / headband), but only **one** bonus is active at a time. Bonuses affect shot speed, sweet-zone size, clutch aim, and stamina.
- Watch the stamina bar (bottom-left): continuous shooting drains it to exhaustion, and you must rest until it recovers to 28% before shooting again. Low stamina slows your release and shrinks your aim.
- Choose **camera control** on the difficulty page to shoot with your upper-body motion; the game remembers your last control mode. On phones the camera view is portrait-locked (when Safari returns a 4:3 sensor stream, only the sides are cropped so preview, skeleton and the highlight window stay aligned).
- On mobile browsers, tap the page (or the sound button, top right) once to unlock audio — an autoplay restriction of mobile browsers.
- The back button (top right) returns to the home screen at any time; during a match it asks for pause confirmation first.

## Run locally

No build required — serve the folder statically:

```bash
python3 -m http.server 4174
```

Then open:

```text
http://127.0.0.1:4174/
```

Run the static checks before committing:

```bash
node scripts/check.js
```

## 在浏览器里测试

除非这次测的就是音效，**先跑静音器再动**（工作环境里突然爆音很打断人）：

```js
// 注入脚本的第一件事，必须在 beginLastShot / ensureAudio 之前
await fetch("scripts/silence-browser.js").then(r => r.text()).then(eval);
```

它做四件事：`<audio>` 全部静音并让新建的一出生就静音、语音合成关掉、
断开 WebAudio 的 `connect()`、外加一个 250ms 看门狗压住主增益
（`ensureAudio()` 之后音量会被恢复，只静音一次挡不住）。

关键是**不改控制流** —— 元素照样 `play()`、解码照样进行、`extPlay()` 照样返回 true，
只是听不见，所以被测逻辑不受影响。测完 `window.__unsilence()` 还原。

`scripts/smoke-browser.js`（全模式打完整一局的冒烟）已经内置调用。

## 看外观：viewer + 自动截图

改装备/角色外观时，不要再进游戏、开更衣室、手改 CSS 把试衣镜放大了。

**`viewer.html`** —— 中性背景下单独看一个球员，只加载建模模块，不带游戏逻辑。

```
viewer.html?band=head-hoodie&angle=side&focus=head
viewer.html?sheet=band&angle=three-quarter   # 整槽一字排开，一张看完
```

`angle` = front / three-quarter / side / back，`focus` = full / head / torso / feet，
`bg` = neutral / white / dark，三个装备槽用 `band=` `shoes=` `sleeve=` 指定。
状态会写进地址栏，可以直接把链接贴给别人。右上角实时显示 draw call 和三角面。

**`tools/capture.mjs`** —— 固定视口/机位/取景的无头截图台，自带静态服务器：

```bash
node tools/capture.mjs                 # 拍全套(约 49 张)到 captures/
node tools/capture.mjs --filter 连帽衫  # 只拍某一件
node tools/capture.mjs --bench         # 顺带记 draw call / 三角面 / 单帧耗时
node tools/capture.mjs --out captures/before   # 改动前先存一份，改完对比
```

**为什么值得**：正面看正常、换个机位就露馅的问题非常多。连帽衫和棒球帽各三处做工
缺陷（帽子比脑袋宽一圈、椭球切过脸颊、下摆 2.5mm z-fighting 闪黄条）全是这么查出来的。
`captures/` 不进版本库（一次约 7MB）。

## 复现一局：`?seed=N`

**决定输赢的随机**（出手结果、手抖偏差、绝杀犯规、对手命中）走 `src/core/rng.js`，
地址栏加 `?seed=12345` 就能把一局钉死重放：同样的操作必得同样的结果。
不带 `seed` 时用时间播种，正常游玩照样每局不同 —— 只有一条代码路径。

演出用的随机（欢呼台词、镜头抖动、观众反应）**继续用 `Math.random()`**，
那些每次不一样才对。

```bash
node scripts/rng-determinism.test.mjs   # 验证同种子逐球一致(无头浏览器跑)
```

> 必须用无头浏览器：预览标签页一旦切到后台，`requestAnimationFrame` 就冻结，
> 开场演出走不完、永远进不到可投篮状态（实测 1.5 秒只推进 0.08 秒）。

## 逐模式体检

`scripts/mode-audit.js` 是浏览器里的工具箱：带哨兵自检的中文残留扫描、
走真实入口进各模式、按住/松手投篮。用法和注意事项写在文件头部注释里，
两条前提必须遵守——**必须用真实时间跑**（手动逐帧会让 `performance.now()` 相关逻辑卡死），
**必须走 `pickDiff` 真实入口**（直接 `startBattle()` 会让 `OPP.o` 为 null）。

## Project layout

- `viewer.html` — 中性背景下单独看角色/装备的看板（见上文「看外观」）。
- `tools/capture.mjs` — 固定机位自动截图台；产物在 `captures/`（不进版本库）。
- `index.html` — the playable entry: a ~200-line modular shell that loads the game from `src/` (cutover completed in v2.0).
- `block-3pt-kingv2.19.9-modular.html` — current versioned snapshot, kept identical to `index.html`.
- `styles.css` — HUD, home screen, panels and mobile styles.
- `src/` — the game itself, fully modular:
  - `core/` runtime, state and the migration bridge · `modes/` Percent Battle, Rack Rush, contest, practice · `rendering/` Three.js scene core · `ui/` menus, panels, pre-game flow · `gameplay/`, `presentation/`, `services/`, `data/` supporting layers
  - feature modules at the top level: `vision.js` (camera + MediaPipe), `audio.js`, `gear.js`, `recorder.js`, `share.js`, `leaderboard-api.js` / `leaderboard-ui.js`, `hero-moments.js`, `hot-hand.js`, `perf.js` / `perf-settings.js`, `nba-dna/`, and more.
- `legacy.html` — frozen pre-cutover engine (v1.96). Reachable via `?engine=legacy` for one release as a rollback path.
- `cloudflare/leaderboard/` — schema and source for the leaderboard API (Cloudflare Worker + D1).
- `assets/` — images, video, audio, fonts and vision models. `vendor/` — bundled third-party runtimes (Three.js, MediaPipe Tasks Vision).
- `backup/` — local archive of past versions (not published). `docs/` — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture notes and refactor plan.

## Notes

The project iterates quickly, so the README keeps only stable information — no changelog is maintained here; git history is the source of truth.

Three.js is used under its MIT license. Sources and licenses for third-party audio, vision models and the Orbitron font: [`assets/aiba-audio/SOURCE.md`](assets/aiba-audio/SOURCE.md), [`assets/aiba-vision/SOURCE.md`](assets/aiba-vision/SOURCE.md), [`assets/fonts/orbitron/SOURCE.md`](assets/fonts/orbitron/SOURCE.md).

## License

MIT. See `LICENSE`.
