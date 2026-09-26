# aiBA 百分大战 · Launch Trailer

28.8 秒手绘水彩动态漫画宣传片：p5.js 2 + p5.brush 逐帧绘制，声音全部在浏览器里实时合成。

- 分镜：[`STORYBOARD.md`](STORYBOARD.md)
- 动画指南：[`ANIMATION_GUIDE.md`](ANIMATION_GUIDE.md)
- 成片：`aiba-launch-trailer.mp4`（1920×1080 · 30fps · H.264 + AAC）

这个目录是独立的渲染工程，和游戏本体无关，游戏仍然是"无构建、克隆即玩"的纯静态站。
依赖不进仓库，渲染时自动装进 `.deps/`。

## 渲染

需要 Node 18+、全局 `playwright`（或本地可 import）和带 libx264 的 `ffmpeg`。

```bash
node render.mjs deps          # 安装 p5 / p5.brush / 字体到 .deps/
node render.mjs bake          # 烘焙 15 张水彩贴图（约 8 分钟，只需一次）
node render.mjs audio         # 合成音轨
node render.mjs video -j 3    # 3 个页面并行逐帧渲染 → out/aiba-launch-trailer.mp4
node render.mjs stills 96,600 # 只渲染指定帧到 .cache/stills/，调画面用
node render.mjs serve         # 本地预览：←→ 逐帧，空格播放
```

`FFMPEG=/path/to/ffmpeg` 可指定 ffmpeg。帧已渲染过会跳过（断点续渲），`--force` 全部重渲。

## 代码章节

| 文件 | 内容 |
|---|---|
| `src/00-core.js` | 画布、节拍（150 BPM = 12 帧/拍）、缓动、确定性随机、关键帧 |
| `src/01-ink.js` | p5.brush 包装：墨线、平涂、墨点飞溅、速度线、冲击环、镜头 |
| `src/02-bake.js` | 水彩贴图（背景、爆炸、火焰）的烘焙配方 |
| `src/03-rig.js` | 2D 骨骼角色：小方 BLOX、AI 传奇零号、真人线稿 + 姿态骨架 |
| `src/04-props.js` | 篮筐、投篮机、观众、aiBA 笔画字 Logo、记分牌、墨刷转场 |
| `src/05-shots.js` | S1–S14 逐镜头动画 + 卡点表 `CUES`（画面和声音共用） |
| `src/06-post.js` | 2D 合成：震动、冲击推镜、反相冲击帧、文字、纸纹、暗角 |
| `src/07-audio.js` | OfflineAudioContext 合成 BGM + 音效，导出 WAV |
| `render.mjs` | 本地服务 + 无头 Chromium 并行渲染 + ffmpeg 合成 |
