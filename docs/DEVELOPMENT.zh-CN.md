# 开发者笔记（中文）

面向改这个项目的人：静音测试、外观看板、体感调试、复现一局、逐模式体检。
玩家向说明见 [README.md](../README.md) / [README.zh-CN.md](../README.zh-CN.md)。

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

## 体感：把摄像头收成侧边小条

熟练之后不想一直被自己的画面干扰，但仍要用体感——点预览标题栏的 `⌄` 收起，
变成左侧一根 16×96 的小条；点小条展开。偏好存 localStorage，跨局记住。

小条上只留两个信息：**还在不在跟踪**（填充高度）和**当前阶段**（配色，青→黄→绿），
这两个本来就由 `data-phase` 和 `#visionTrackFill` 承载，直接复用。

**收起来不影响体感** —— 摄像头照跑、识别照做。有五种情况会强制展开：
要求转屏、还在启动、启动出错、身体标定中、新手引导接管；跟踪丢失也会。

> ⚠️ 改这块代码时注意：**折叠绝不能对 `#visionVideo` 用 `display:none`**。
> 推理循环靠 `video.currentTime` 往前走判断有没有新帧，一旦 `display:none`，
> 部分浏览器（iOS Safari 尤其）会停止推进解码——画面收起来了、体感也悄悄失灵，
> **而且不报错**。所以折叠是把 `.visionStage` 压成 1×1 + `overflow:hidden`。
> `vision.js` 里另有 1.5 秒看门狗兜底：帧长时间不推进就强制展开并提示。
> `scripts/check.js` 对这两条都有断言（已变异测试）。

**录像**：折叠后 PIP 不再录真人画面，但**保留骨架层**——收起来往往就是不想出镜，
录出去还带脸是隐私意外；而骨架本身说明"这动作是真人做的"，那是 aiBA 区别于
普通手游的地方，不该一起丢掉。

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
