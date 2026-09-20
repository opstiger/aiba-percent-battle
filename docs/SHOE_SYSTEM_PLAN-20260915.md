# v2.26.0 鞋基座与球员配件计划

1. 现有坐标：膝盖 y=-0.34，踝 y=-0.32，footRig 原点在踝；鞋底最低约 -0.112，鞋头 z=+0.24，后跟 z=-0.135，宽约 0.206。保留这组包络，不能用现实鞋码套模型。
2. 新建 basketball-shoes.js：参数→独立封闭模块→合并网格及颜色组。A 为正式首版，B/C/D 仅参数草案。每脚独立 root，直接跟 footRig，使用现有脚骨，不新建骨架。
3. A 要求 150–400 三角形（上限500）、9配色区、Standard roughness=.75 metalness=0、无贴图/真实商标。默认乔丹试穿，?shoe=retro-high 可在其他角色上测试。选用旧装备鞋时恢复旧基座，避免叠两双。
4. 球袜按角色数据定义高度/色/条纹；单侧护膝按膝节点；纹身先做已知有纹身球员的简化墨色图案，不宣称复刻真实文字图案。艾弗森右臂单侧袖套。
5. 验收：鞋模块三角面、配色/左右镜像/变体接口、跑跳落地包络、重复装备释放、角色换装、桌面与触屏上脚；输出前/侧/后45度及游戏图。真机性能另列，不能用模拟替代。


## 参考图反馈后的重构（优先于上方初始计划）

用户否定第一轮直筒靴造型并提供黑白红高帮参考。336 面旧方案不作为交付。当前 A 重构为 580 面：连续斜向鞋面、五排阶梯鞋带、黑色前掌包边、白色鞋头和侧片、红色鞋帮/后跟/外底。超过最初 500 面上限，明确作为参考图反馈后的造型优先版本；尚未完成 ≤400 面 LOD，不宣称通过原面数验收。

## 资源与使用

- 源码：src/rendering/basketball-shoes.js；球袜/护具/纹身档案：src/rendering/player-kit.js。
- 预览：artifacts/shoe-system-20260915/review.html；独立资源：Preset_A_RetroHigh.object.json（THREE.ObjectLoader 可读）。截图与导出属于本地 artifacts，不进版本库；源码可重复生成。
- 单只鞋 580 triangles，1 Group + 1 Mesh（2 objects），9 MeshStandardMaterial / 9 material groups；双脚 4 objects、18 materials。材质 roughness=.75，metalness=0，无贴图。贴图只用于球员简化纹身，与鞋无关。
- 根节点 left_shoe / right_shoe 直接挂既有 footRig；geometry 已应用变换，root scale=1 / rotation=0 / position=0。正 Z 为鞋头。左右对称设计无需负缩放镜像。鞋跟随整只脚，不独立绑定鞋尖。
- 默认乔丹上脚 A；?shoe=retro-high 可给其他角色测试。已有装备鞋优先，切换时移除新基座并恢复旧鞋，避免双鞋叠加。切回默认角色外观时再创建 A。

```js
const shoe = AIBABasketballShoes.build('Preset_A_RetroHigh', {
  parameters: {collarHeight: .13, soleThickness: .046, laceRows: 5},
  colors: {heelColor: 0x403b88, collarColor: 0x18191b, outsoleColor: 0x403b88}
});
AIBABasketballShoes.apply(guy, 'Preset_A_RetroHigh');
AIBABasketballShoes.clear(guy);
```

配色区：outsole 红 #B8322B；midsole #D8D7D1；toe/quarter #E8E7E2；heel/accent #B8322B；collar/lace/tongue #18191B。最新配色按参考图由黑外底/白鞋带调整为红外底/黑鞋带。tonguePatch 共用 toeColor，heelTag 用 accentColor。品牌位采用通用矩形，无真实商标。

## 参数与扩展边界

- loft 控制鞋底/鞋头的横截面与倒角，panel 控制侧片闭合多边形，box 仅用于鞋带/后片/徽章。各模块闭合并合并为单网格；这是相交实体组装，不是焊接为一个可打印的水密外壳。
- 已接入：collarHeight、collarThickness、toeRoundness、toeLength、heelWidth、heelHeight、soleThickness、forefootLift、heelLift、tongueHeight、tongueThickness、laceRows（0–5）、laceBlockSize，以及九个颜色区。
- sideOverlayStyle / heelCounterStyle / colorBlockingStyle 目前是预留字段，没有完整分支实现；下一位开发者应把 panel 的轮廓点列提取为模块注册表，实现样式分发，不能声称这些枚举已能完整换型。
- B ModernMid / C LowTopSpeed / D PowerHeavy 是参数草案，未完成各自侧片、鞋口与鞋舌的联动造型验收。尤其低帮不能仅降低 collarHeight，须同步降低 quarter 前缘与鞋舌连接点。下一阶段优先做 C 的独立点列，再做厚中底与后跟模块。
- 先锁定当前造型，再去除不可见内部封口面并合并共面块，建立 ≤400 面远景 LOD；目前不要再通过拉长方体来压面数。

## 球员配件

- 全角色补袜筒；档案区分袜高，伯德双条纹；乔丹、麦迪、卡特配代表性单侧膝套。配件随膝节点，替换旧短袜条纹，避免层层叠加。
- 艾弗森仅解剖右臂袖套（模型索引 0），补前臂覆盖。艾弗森/利拉德密集纹身、科比上臂、库里小面积纹身采用抽象墨线，不复刻真实文字、位置细节或特定赛季全套装备。
- 这些是代表性造型选择，不声称每位球员整个生涯都穿同一种袜/护具。后续应引入赛季套装与照片逐人对照。
- clear 释放几何/材质/纹身贴图；随机装扮清除前一人的配件和鞋，恢复旧袜。

## 验证与待办

scripts/check.js 是结构门禁；scripts/shoe-system.test.mjs 覆盖面数/材质分组/脚绑定/180帧跑动底面/12轮装备切换/单侧护臂/袜筒/纹身/随机外观清理，输出桌面与390×844触屏尺寸图。scripts/model-regress.test.mjs 覆盖原有鞋装备、跑动、第一人称前臂和扣篮结构回归。

仍待：用户对参考图重构的视觉认可、400面LOD、B/C/D完整造型、逐人逐赛季装备核对、真实手机帧率和长时间游玩验收。不能把触屏模拟当成真机通过。主线已有的通道遮挡等历史待办不在本次鞋改动内。
