# aiBA Percent Battle / aiBA·百分大战

![aiBA Percent Battle screenshot](assets/readme-screenshot.jpg)

一个浏览器里的 3D 篮球投篮小游戏。个人作品，持续迭代中。

在线试玩：

https://opstiger.github.io/aiba-percent-battle/

当前版本：`v1.43-hd-voxel-player`

## 模式

- 百分大战：两人同时开投，先到 100 分获胜。
- 三分挑战：限时单人三分赛。
- RACK RUSH：投篮机连续供球，完成 5 关目标后进入 FINAL RUSH，成绩保存到本地排行榜。

## 操作

- 按住屏幕蓄力，松开投篮。
- 视觉先锋版可在难度页选择“视觉实验”，用上半身投篮动作蓄力与出手。
- 百分大战中，点击场上点位或用左右方向键移动。
- RACK RUSH 中人物固定在弧顶；普通命中 2 分、每第 5 球 3 分，最后 10 秒命中额外加 1 分。
- 手机浏览器需要先点一下页面或右上角声音按钮来解锁音频，这是移动端浏览器的自动播放限制。

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

- `index.html`：当前可玩的入口文件。
- `block-3pt-kingv1.43-hd-voxel-player.html`：当前版本快照，和 `index.html` 保持一致。
- `styles.css`：游戏 HUD、首页、面板和移动端样式。
- `src/assets-manifest.js`：封面角色、音频等资源清单。
- `src/audio.js`：外部音频、合成音效、现场氛围和语音播报。
- `src/vision.js`：摄像头、MediaPipe、视觉投篮识别与预览。
- `scripts/check.js`：提交前静态验收脚本。
- `assets/`：游戏图片、视频和音频资源。
- `vendor/`：随项目带的第三方运行文件，包括 Three.js 与 MediaPipe Tasks Vision。
- `backup/`：本地历史版本归档，不参与发布。
- `docs/`：本地需求与迭代文档，不参与发布。

## 开发方向

项目仍然保持纯静态部署，但已经开始从单 HTML 拆分。后续如果继续扩大，建议继续拆成：

- `src/rendering.js`：Three.js 场景、相机、角色、球场和特效。
- `src/game.js`：主循环、状态机、投篮、比分和模式逻辑。
- `src/modes/`：百分大战、三分挑战、RACK RUSH 的独立模式逻辑。

拆分时优先保持纯静态项目，不急着引入框架；先让代码边界清楚，再考虑构建工具。

## 说明

项目还在快速迭代，所以 README 只保留稳定信息，不维护详细 changelog。具体版本变化以 Git 历史为准。

Three.js 按其 MIT License 使用。项目生成的图片资源默认随本项目使用，除非后续另有说明。
第三方音频的来源与独立许可见 [`assets/aiba-audio/SOURCE.md`](assets/aiba-audio/SOURCE.md)。
视觉模型来源与许可见 [`assets/aiba-vision/SOURCE.md`](assets/aiba-vision/SOURCE.md)。
Orbitron 字体来源与许可见 [`assets/fonts/orbitron/SOURCE.md`](assets/fonts/orbitron/SOURCE.md)。

## License

MIT. See `LICENSE`.
