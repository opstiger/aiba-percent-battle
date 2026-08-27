# aiBA·百分大战

[English](README.md) | **简体中文**

![aiBA 百分大战 截图](assets/readme/hero-court.jpg)

一个完全跑在浏览器里的赛博朋克方块风 3D 篮球游戏——可以按屏幕投篮，也可以对着摄像头**用真实投篮动作**出手。个人开源作品，持续快速迭代中。

## 在线试玩

- Vercel 自动部署：https://aiba-percent-battle.vercel.app/
- GitHub Pages 备用：https://opstiger.github.io/aiba-percent-battle/

当前版本：`v2.12`

| 首页 | 百分大战 | 更衣室 | 体感控制 |
|---|---|---|---|
| ![首页](assets/readme/home.jpg) | ![百分大战](assets/readme/battle.jpg) | ![更衣室](assets/readme/locker.jpg) | ![体感控制](assets/readme/motion.jpg) |

## 亮点

- **中英双语** —— 界面按浏览器语言自动切换（中文 / English），也可在设置（⚙）里随时切换，或用 URL 参数 `?lang=en` / `?lang=zh`。
- **体感投篮** —— 对着摄像头做真实投篮动作完成蓄力和出手（MediaPipe 姿态识别，全部本地运行，视频不会离开你的设备）。
- **百分竞速对战** —— 与方块球星同场竞速先到 100 分，制胜球带英雄时刻运镜。
- **精彩录屏** —— 关键球自动截取，即时回放、方便分享。
- **全球排行榜** —— RACK RUSH 成绩在线上榜（Cloudflare Workers + D1），匿名玩家 ID + 离线补交队列。
- **更衣室与工坊** —— 选球员、穿改变真实数值的装备，或自建你的方块球员。
- **纯静态站点** —— 无构建、无框架，克隆即可运行。

## 模式

- **百分大战** —— 你和 AI 球星同时开投，先到 100 分获胜。点击场上点位或用左右方向键移动。
- **三分挑战** —— 限时单人三分赛。
- **RACK RUSH** —— 投篮机连续供球，完成 5 关目标后进入 FINAL RUSH；普通命中 2 分、每第 5 球 3 分、最后 10 秒命中额外 +1，成绩可进入全球排行榜。
- **NBA DNA**（实验功能）—— 上传投篮姿势照片，与球星姿势做娱乐化匹配。
- **新手互动教程** —— 引导新玩家上手，含体感控制的影子练习教学。

## 操作

- 按住屏幕蓄力，松开投篮。
- 赛前更衣室可穿 3 件装备（球鞋 / 护腕护肘 / 头带），但同时只有 **1 件**的加成生效；加成覆盖投射速度、准星甜区、关键时刻准星和精力。
- 比赛中左下角有精力条：连续出手会耗尽精力进入力竭，必须停手休息回到 28% 才能继续投；低精力时出手变慢、准星变差。
- 难度页可选择**体感控制**，用上半身投篮动作蓄力与出手；游戏会记住上次使用的操作模式。手机体感模式锁定竖屏摄像头画幅（Safari 返回 4:3 传感器流时只裁左右两侧，预览、骨架和精彩录屏小窗保持一致）。
- 手机浏览器需要先点一下页面或右上角声音按钮来解锁音频，这是移动端浏览器的自动播放限制。
- 进入模式后可用右上角返回按钮随时回到首页；比赛进行中会先打开暂停确认。

## 本地运行

不需要构建，直接启动静态服务：

```bash
python3 -m http.server 4174
```

然后打开：

```text
http://127.0.0.1:4174/
```

提交前可跑一次静态检查：

```bash
node scripts/check.js
```

## 项目结构

- `index.html`：正式入口——约 200 行的模块化外壳，游戏全部从 `src/` 加载（v2.0 完成切换）。
- `block-3pt-kingv2.12-modular.html`：当前版本快照，和 `index.html` 保持一致。
- `styles.css`：游戏 HUD、首页、面板和移动端样式。
- `src/`：游戏本体，已完全模块化：
  - `core/` 运行时、状态与迁移桥接 · `modes/` 百分大战、RACK RUSH、三分赛、练习 · `rendering/` Three.js 场景核心 · `ui/` 菜单、面板、赛前流程 · `gameplay/`、`presentation/`、`services/`、`data/` 支撑层
  - 顶层功能模块：`vision.js`（摄像头 + MediaPipe）、`audio.js`、`gear.js`、`recorder.js`、`share.js`、`leaderboard-api.js` / `leaderboard-ui.js`、`hero-moments.js`、`hot-hand.js`、`perf.js` / `perf-settings.js`、`nba-dna/` 等。
- `legacy.html`：切换前的旧引擎冻结版（v1.96），可用 `?engine=legacy` 访问，保留一个版本作为回滚通道。
- `cloudflare/leaderboard/`：排行榜 API 的 schema 与源码（Cloudflare Worker + D1）。
- `assets/`：图片、视频、音频、字体与视觉模型。`vendor/`：随项目携带的第三方运行文件（Three.js、MediaPipe Tasks Vision）。
- `backup/`：本地历史版本归档，不参与发布。`docs/`：架构说明与重构计划见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 说明

项目还在快速迭代，README 只保留稳定信息，不维护详细 changelog，具体版本变化以 Git 历史为准。

Three.js 按其 MIT License 使用。第三方音频、视觉模型与 Orbitron 字体的来源和独立许可见：[`assets/aiba-audio/SOURCE.md`](assets/aiba-audio/SOURCE.md)、[`assets/aiba-vision/SOURCE.md`](assets/aiba-vision/SOURCE.md)、[`assets/fonts/orbitron/SOURCE.md`](assets/fonts/orbitron/SOURCE.md)。

## License

**源码**是 MIT，见 `LICENSE`。

**素材不是。** `assets/` 下的配音、音乐、封面图与视频、Logo 与品牌图全部保留权利
——它们随仓库发布只是为了让项目能构建和运行，不等于授权复用。
**「aiBA」及其 Logo 属于商标，不在 MIT 授权范围内。**

具体边界见 [`NOTICE`](NOTICE)。如果你要 fork：请保留 `LICENSE` 和 `NOTICE`，
换成你自己的素材，不要用 aiBA 的名字发布。
