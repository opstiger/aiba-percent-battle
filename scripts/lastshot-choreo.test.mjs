/* 绝杀时刻编排校验。9 个角色 × 路点，靠眼睛看不出问题，必须算。
   跑：node scripts/lastshot-choreo.test.mjs

   校验的都是"错了会在画面上明显穿帮"的几何约束：
   - 任意两人中心距 >= MIN_GAP(0.98)，否则 squad 的 separate() 会反复推挤、明显穿模
   - 盯你的防守人不能压在你的视线上（观看阶段看持球人、出手阶段看篮筐）
   - 传球那一刻持球人到你的距离要在合理区间，太远传不到、太近就不成立
   - 所有路点在场内
   现有的 ls-tribute-finals 是已验收的基准，新关必须过同一套标准。 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/modes/last-shot/config.js", import.meta.url), "utf8");

/* config.js 是 IIFE 且依赖 runtime，这里喂一个假的 ctx 把它跑起来，
   拿到真正的 CHALLENGES —— 比正则解析可靠。 */
const V3 = (x, y, z) => ({ x, y, z });
const RACKS = [
  { p: V3(-7.2, 0, -6.15), n: "左底角" },
  { p: V3(-5.62, 0, -2.38), n: "左侧 45°" },
  { p: V3(0, 0, -0.05), n: "弧顶" },
  { p: V3(5.62, 0, -2.38), n: "右侧 45°" },
  { p: V3(7.2, 0, -6.15), n: "右底角" },
];
const HOOP = { x: 0, y: 3.05, z: -8 };
const COURT = { halfWidth: 7.62, nearBaseline: -9.58, playMaxZ: 4.245 };

let captured = null;
const fakeWindow = {
  AIBA: { runtime: { service: () => ({ V3, RACKS }), register: (_, api) => { captured = api; } } },
};
new Function("window", src.replace(/\}\)\(window\);\s*$/, "})(arguments[0]);"))(fakeWindow);
const api = captured || fakeWindow.AIBALastShotConfig;
if (!api || !api.CHALLENGES) { console.error("拿不到 CHALLENGES"); process.exit(1); }

let fail = 0;
const check = (ok, msg) => { console.log((ok ? "    PASS  " : "    FAIL  ") + msg); if (!ok) fail++; };

const MIN_GAP = 0.98;            // squad.js 的 separate() 用的就是这个值
const SIGHT_CLEAR = 0.9;         // 防守人到视线的最短距离，低于此就挡画面
const PASS_MIN = 4.0, PASS_MAX = 14.0;

/** 路点按时间线性插值，和 squad.js 的 samplePath 同语义 */
function at(path, t) {
  if (!path || !path.length) return null;
  if (t <= path[0].t) return path[0].p;
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1], b = path[i];
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.p.x + (b.p.x - a.p.x) * k, y: 0, z: a.p.z + (b.p.z - a.p.z) * k };
    }
  }
  return path[path.length - 1].p;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** 点到线段的距离 —— 判断防守人有没有压在视线上 */
function pointToSeg(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const L2 = dx * dx + dz * dz;
  if (L2 < 1e-9) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

for (const cfg of api.CHALLENGES) {
  console.log(`\n── ${cfg.challengeId}  ${cfg.title}`);
  const ch = cfg.choreography, ids = Object.keys(ch);
  const you = cfg.shotSpot.p;
  const T = cfg.liveDur;
  const samples = [];
  for (let t = 0; t <= T + 0.001; t += 0.2) samples.push(+t.toFixed(2));

  // ① 场地边界
  let outOfBounds = 0;
  for (const id of ids) for (const w of ch[id].path) {
    if (Math.abs(w.p.x) > COURT.halfWidth - 0.4 || w.p.z < COURT.nearBaseline + 0.4 || w.p.z > COURT.playMaxZ) outOfBounds++;
  }
  check(outOfBounds === 0, `所有路点在场内（越界 ${outOfBounds} 个）`);

  // ② 互相不穿模（含你本人：你站在 shotSpot 不动）
  let worstGap = 99, worstPair = "", worstT = 0;
  for (const t of samples) {
    const pos = {};
    for (const id of ids) pos[id] = at(ch[id].path, t);
    pos.you = you;
    const keys = Object.keys(pos);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const d = dist(pos[keys[i]], pos[keys[j]]);
      if (d < worstGap) { worstGap = d; worstPair = keys[i] + "/" + keys[j]; worstT = t; }
    }
  }
  console.log(`      最近的一对：${worstPair} 在 t=${worstT}s 相距 ${worstGap.toFixed(2)}m`);
  check(worstGap >= MIN_GAP, `任意两人间距 >= ${MIN_GAP}（最近 ${worstGap.toFixed(2)}）`);

  // ③ 盯你的防守人不能挡视线
  const onBall = ids.find(id => ch[id].marks === "you");
  check(!!onBall, "有一个防守人盯着你（marks:\"you\"）");
  if (onBall) {
    const handlerId = ids.find(id => ch[id].role === "handler");
    let minWatch = 99, minShot = 99;
    for (const t of samples) {
      const d = at(ch[onBall].path, t);
      minWatch = Math.min(minWatch, pointToSeg(d, you, at(ch[handlerId].path, t)));   // 观看阶段：你看持球人
      minShot = Math.min(minShot, pointToSeg(d, you, HOOP));                          // 出手阶段：你看篮筐
    }
    console.log(`      防守人离视线：看持球人 ${minWatch.toFixed(2)}m · 看篮筐 ${minShot.toFixed(2)}m`);
    check(minWatch >= SIGHT_CLEAR, `观看阶段不挡视线（${minWatch.toFixed(2)} >= ${SIGHT_CLEAR}）`);
    check(minShot >= SIGHT_CLEAR, `出手视线不被挡（${minShot.toFixed(2)} >= ${SIGHT_CLEAR}）`);
  }

  // ④ 传球那一刻的距离
  const handlerId = ids.find(id => ch[id].role === "handler");
  const passFrom = at(ch[handlerId].path, cfg.passAt);
  const passLen = dist(passFrom, you);
  console.log(`      传球距离 ${passLen.toFixed(2)}m`);
  check(passLen >= PASS_MIN && passLen <= PASS_MAX, `传球距离在 ${PASS_MIN}~${PASS_MAX}m（实际 ${passLen.toFixed(2)}）`);

  // ⑤ 包夹要成立：传球前持球人身边至少两个防守人
  const near = ids.filter(id => id.startsWith("foe") && dist(at(ch[id].path, cfg.passAt - 0.3), at(ch[handlerId].path, cfg.passAt - 0.3)) < 2.6);
  console.log(`      传球前贴着持球人的防守人：${near.join(",") || "无"}`);
  check(near.length >= 2, `传球前形成包夹（${near.length} 人在 2.6m 内）`);

  // ⑥ 你的出手点必须在三分线外（近筐半径 6.75 是 FIBA 三分线）
  const arc = Math.hypot(you.x - HOOP.x, you.z - HOOP.z);
  check(arc >= 6.75, `出手点在三分线外（距筐 ${arc.toFixed(2)}m）`);

  // ⑦ 文案完整性 —— 缺一条界面就会开天窗
  const text = ["title", "subtitle", "timeoutDialogue", "teammateDialogue", "commentary", "shotSpotName", "homeName", "awayName"];
  const missing = text.filter(k => !cfg[k]) .concat((cfg.introText && cfg.introText.length >= 2) ? [] : ["introText"]);
  check(missing.length === 0, `文案齐全（缺：${missing.join(",") || "无"}）`);
}

console.log(fail ? `\n${fail} 条失败` : `\n${api.CHALLENGES.length} 关全部通过`);
process.exit(fail ? 1 : 0);
