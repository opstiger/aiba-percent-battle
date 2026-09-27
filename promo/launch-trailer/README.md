# aiBA 百分大战 · Launch Trailer ——「NEURAL COURT」

51.2 秒宣传片：AI 在数字虚空里把 18 位传奇球星逐块体素重建出来，然后和你同场决战 100 分。
画面**直接由游戏本体渲染**：真实球馆、观众、世界球场、18 位体素球星和各自的投篮动作；
3D 以 960×540 渲染后 ×2 放大，叠加科技 HUD。声音全部实时合成。

- 分镜：[`STORYBOARD.md`](STORYBOARD.md)
- 动画指南：[`ANIMATION_GUIDE.md`](ANIMATION_GUIDE.md)
- 成片：`aiba-launch-trailer.mp4`（1920×1080 · 30fps · 51.2s · H.264 + AAC · -14 LUFS）

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
| `src/01-stage.js` | 接管游戏场景：主角 / 体感真人、球、灯、镜头、姿势 |
| `src/06-neural.js` | 18 位球星名单、全息扫描重建、数字虚空世界 |
| `src/07-live.js` | 直接跑游戏本体的「绝杀时刻」模式（固定步长 + 自动蓄力出手） |
| `src/08-acts.js` | 动作库：每位球星的招牌/庆祝动作、慢动作、严格同步的投篮出手、游戏原生热身扣篮 |
| `src/02-shots.js` | A–H 八段 16 个镜头 + 卡点表 `CUES`（画面和声音共用） |
| `src/03-post.js` | 放大、bloom、色差、马赛克、扫描线；科技 HUD（名片、追踪框、DNA、弹道预测、概率表） |
| `src/04-audio.js` | OfflineAudioContext 合成 BGM（含 8-bit 方波琶音）+ 音效 |
| `src/05-main.js` | 导演主循环 |
| `render.mjs` | 本地服务 + 并行渲染 + ffmpeg 合成 |

游戏里的恶搞品牌字样（场边广告牌、LED 广告带、看台横幅里的 N1KE AIR / ADI-DASH / MINE-DEW）在宣传片里换成游戏自己的中性广告；带真实品牌影子的高细节球鞋不出镜。
