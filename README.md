# aiBA Percent Battle

**English** | [简体中文](README.zh-CN.md)

![aiBA Percent Battle screenshot](assets/readme/hero-court.jpg)

A cyberpunk voxel 3D basketball game that runs entirely in your browser — shoot with your touch screen, or with your **real shooting form** through the webcam. A personal open-source project, iterating fast.

## Play now

- Vercel (auto-deployed): https://aiba-percent-battle.vercel.app/
- GitHub Pages (mirror): https://opstiger.github.io/aiba-percent-battle/

Current version: `v2.19.6`

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

## Project layout

- `index.html` — the playable entry: a ~200-line modular shell that loads the game from `src/` (cutover completed in v2.0).
- `block-3pt-kingv2.19.6-modular.html` — current versioned snapshot, kept identical to `index.html`.
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
