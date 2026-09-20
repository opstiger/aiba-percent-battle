# v2.27.0 · AIBA RetroHigh

## 本轮实现

基于用户验收的 ShoeLast v0.3 和长斜坡实现正式运行时资产。没有 Nike/Jordan 文本、Swoosh、Wings 或 Jumpman。此前多品牌/Logo预览任务被用户新要求替代；下载但未使用的 Logo 已移除。

默认乔丹使用 classicRedBlackWhite、L=.44；其他角色可通过 ?shoe=retro-high 或 API试穿。已装备的旧鞋仍优先，脱下旧鞋恢复角色默认RetroHigh，不叠两套鞋。不是给所有球员强制统一换鞋。

## 四层职责

|层|文件|职责|
|---|---|---|
|ShoeLast|src/rendering/shoe-last.js|逐点保留已验收 L=1 截面，不读取角色 foot mesh bounding box|
|RetroHighPreset|src/rendering/retro-high.js|杯底分区、上部壳、长脚背坡面、眼片、鞋舌厚边、六排鞋带|
|Colorway|retro-high.js 的 colorways|红白黑、蓝白黑、紫白黑、深红黑四套语义配色|
|CharacterFit|src/rendering/basketball-shoes.js|左右footRig挂载、旧visual显隐/代理、独立anchor接地|

基础鞋楦不变：长1、前掌宽.39、中足.30、后跟.32、鞋头基部.17、脚背峰值.29。高帮模块总高.46，鞋口外宽.30、内宽.264；坡面从 z=.52/y=.16 延至 z=.17/y=.448。默认世界外观由角色根scale继承，不把角色尺度再乘一次。

12个模块按顶点范围留在 userData.shoe.modules：outsole、outsoleEdge、midsole、toeCap、toeBox、mudguard、eyestay、quarterPanel、heelCounter、collar、tongue、laceBlock。基础壳沿高度分割面片；灰模认可的高帮壳保持比例，细节面只微量叠在表面，不放大整鞋。

模块建造分开，渲染时合并为1个Mesh/1个材质：单鞋524 triangles，1个Group+1个Mesh。外侧另有ShoeFitAnchor（3个Object/脚）。左右同配色共享geometry和material；每鞋1 draw call（不含已有袜筒/小腿视觉代理）。MeshStandardMaterial，roughness=.75、metalness=0、顶点色，无纹理。当前使用双面材质，后续可优化壳内面/单面绕序；没有声称达到旧版400面目标。

## 调用

```js
const shoe = createBasketballShoe({
  lastType: 'AcceptedLastV1',
  shoeType: 'RetroHigh',
  collarType: 'TaperedHigh',
  outsoleType: 'Cupsole',
  panelLayout: 'RetroHighPanels',
  colorway: 'classicRedBlackWhite',
  roleScale: 1
});
AIBABasketballShoes.apply(guy, 'RetroHigh', {
  length: .44, colorway: 'classicRedBlackWhite'
});
AIBABasketballShoes.clear(guy);
```

独立创建的root是L=1；角色适配由anchor统一缩放为.44，左右鞋root自身scale=1。角色整体镜像由原root继承，鞋楦左右对称，不再做第二次负缩放。共享缓存资源归系统所有，卸鞋只移除实例，不能自行dispose共享geometry/material。四套配色每套缓存一份，角色切换不重复制造资源。

## 扩展

registerLayout(name, {shoeType, collarType, outsoleType, buildShell, classifyPanel, addDetails}) 注册新的面片布局。buildShell替换上部壳、classifyPanel分配语义颜色区、addDetails添加款式特定部件；工厂统一保留基座/合批/配色流程。布局名不能覆盖已注册缓存，避免旧实例失效。

- RetroLow / LightweightLow：替换低帮壳，降低鞋舌/眼片，保留长宽和收腰基准。
- ModernMid：中帮壳与后跟支撑部件；需要独立验证中底附加模块。
- ChunkyPowerHigh：厚底与后跟叠加模块，不修改共同鞋楦比例。
- 以上仅预留类型，不是本轮已完成的鞋款。非注册组合明确报错，不伪装成能完整变形的参数。

## 角色视觉与接地

保留 ankle → footRig → toeJoint 及所有原始动画；鞋挂载为 footRig → ShoeFitAnchor → right_shoe/left_shoe → mesh。旧鞋和toe visual隐藏，但toeJoint继续接收原动画。鞋本体是整脚刚性资产，不单独跟随toe弯曲。

隐藏 ankleBlend/sockKnit，使用窄踝代理；原calf/crewSock/sockStripe隐藏，复制成下端收窄的视觉代理。上端恢复原宽；卸鞋恢复原显隐，并释放仅由本次创建的代理。标记 shoeFitVisual 防止背景NPC烘焙误吞可恢复代理。膝、腿骨和手部不变。

主循环在动作/相机之后、render之前调用 updateAll。用既有 runFootGroundY 的鞋底参考估计接触：靠地时拟合，离地时渐退；35/s指数平滑，穿地时立即做最低限度矫正。仅移动ShoeFitAnchor，不移动角色、骨骼或改动画。每帧使用复用Vector3和鞋底截面采样；不逐帧新建鞋几何/材质。首次显示时的小幅对齐随平滑收敛。

## 验证

- scripts/check.js：结构检查与v2.27.0入口/快照一致。
- scripts/retrohigh-production.test.mjs：四视图、3尺寸×姿态、四配色；524面/1mesh/1material/模块齐全；240帧跑动到急停、121帧投篮起落；12轮旧鞋/默认鞋切换；骨架矩阵前后一致。
- scripts/model-regress.test.mjs：原有四鞋、护臂、换装、第一人称前臂、扣篮挂框回归。
- scripts/retrohigh-runtime.test.mjs：真实游戏循环第三人称角色自动更新、乔丹默认鞋、哈登左手镜像与女性角色挂载。
- 桌面和390×844触屏模拟均静音。motion.js / shot-motion.js SHA256与修改前一致。

产物 artifacts/retrohigh-production-20260916/review.html；各目录report.json保留数值。跑动到急停最低鞋底采样约+0.77mm；单帧anchor修正变化最大约10.74mm；起跳中段鞋底高于地面约0.46m。指标只覆盖测试路径，不能代替所有模式或真机验收。

仍待：真实手机长时帧率、更多动作组合与极端尺度、极端屈踝鞋口视觉复核、低于400面LOD。部分膝套本身与皮肤交叠是已有装备问题，本轮不改膝部。未提交、未推送。
