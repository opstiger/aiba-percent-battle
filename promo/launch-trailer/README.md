# aiBA 百分大战 · Launch Trailer（体素像素版）

28.8 秒宣传片，画面**直接由游戏本体渲染**：真实球馆、观众、世界球场、体素球员和投篮动作，
3D 以 640×360 渲染后 ×3 最近邻放大，HUD 沿用游戏 UI 语言。声音全部实时合成。

- 分镜：[`STORYBOARD.md`](STORYBOARD.md)
- 动画指南：[`ANIMATION_GUIDE.md`](ANIMATION_GUIDE.md)
- 成片：`aiba-launch-trailer.mp4`（1920×1080 · 30fps · H.264 + AAC · -14 LUFS）

这个目录是独立的渲染工程，不影响游戏"无构建、克隆即玩"。唯一的外部依赖是中文字体，渲染时装进被忽略的 `.deps/`。

## 渲染

需要 Node 18+、Playwright（全局或本地）和带 libx264 的 `ffmpeg`。

```bash
node render.mjs audio            # 合成音轨 → .cache/audio.wav
node render.mjs video -j 3       # 3 个游戏实例按镜头并行渲染 → out/aiba-launch-trailer.mp4
node render.mjs stills 96,600    # 只渲染指定帧 → .cache/stills/
```

`FFMPEG=/path/to/ffmpeg` 指定 ffmpeg；`--crf 26` 调码率；已渲染的帧会跳过，`--force` 全部重渲。

## 工作方式

1. 无头 Chromium 打开 `index.html?trailer=1`，启动前把 `Math.random` 换成固定种子。
2. 启动后冻结游戏的 `requestAnimationFrame`，注入 `src/` 里的导演脚本，逐帧摆姿势、推进观众/火焰/彩带/球网、渲染。
3. 按镜头分配给渲染进程，每个镜头从首帧顺序模拟，结果可复现。

| 文件 | 内容 |
|---|---|
| `src/00-core.js` | 节拍（150 BPM = 12 帧/拍）、缓动、确定性随机、关键帧 |
| `src/01-stage.js` | 接管游戏场景：主角 / N-24 / 体感真人、球、灯、镜头、姿势 |
| `src/02-shots.js` | S1–S13 逐镜头动画 + 卡点表 `CUES`（画面和声音共用） |
| `src/03-post.js` | 像素放大、马赛克转场、扫描线、HUD、金色像素粒子、Logo 高光 |
| `src/04-audio.js` | OfflineAudioContext 合成 BGM（含 8-bit 方波琶音）+ 音效 |
| `src/05-main.js` | 导演主循环 |
| `render.mjs` | 本地服务 + 并行渲染 + ffmpeg 合成 |

游戏里的恶搞广告牌（N1KE AIR 等）和带真实品牌影子的高细节球鞋在宣传片里不出镜。
