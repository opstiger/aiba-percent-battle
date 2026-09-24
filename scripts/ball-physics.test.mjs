/* 真实篮球物理内核的平衡与正确性门槛。跑：node scripts/ball-physics.test.mjs
   非零退出码 = 不通过。加 --table 打印每个投篮点的分档曲线，--tune 做参数网格搜索。

   为什么不逐档复刻旧判定表：旧系统是"同样输入 → 随机结果"，每一档都能有 65%、30%
   这种比例；物理是"同样输入 → 同样结果"，一档里只在边界附近有过渡。逐档复刻在数学上
   不成立。要保住的是玩家实际体验到的东西：
     1. 甜区内圈（|u|≤.5）命中 ≥ 90%          —— UI 承诺"停在绿色甜区 = 空心"
     2. 期望命中率与旧系统相差 ≤ 6 个百分点    —— 按真实误差分布 u~N(0,σ)，σ=.7 高手 / 1.5 新手
     3. 五个投篮点之间期望命中率差 ≤ 10 个百分点 —— 不能正对篮板就成了打板送分
     4. 远处（|u|>1.8）命中 ≤ 10%              —— 不能乱投靠运气进
   u = 力度误差 / 甜区半宽，与旧判定 a/zone 同一把尺子；旧表见 oldMake()。 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../src/gameplay/ball-physics.js");

const args = new Set(process.argv.slice(2));
/* RIM=firm node scripts/ball-physics.test.mjs 验硬筐档（默认软筐） */
const RIM = process.env.RIM || "soft", TUNING = P.TUNING_PRESETS[RIM];
if (!TUNING) { console.error("未知 RIM 档：" + RIM); process.exit(2); }
const SPOTS = [
  ["弧顶", [0, 2.6, -0.96]],
  ["左底角", [-6.6, 2.6, -5.9]],
  ["右45°", [5.0, 2.6, -2.9]],
  ["深远", [-3.4, 2.7, 0.2]],
  ["中场", [0, 2.8, 3.4]],
];
const tfFor = p0 => 0.78 + Math.hypot(p0[0] - P.GEOM.rim.x, p0[2] - P.GEOM.rim.z) * 0.062;
const UNDER_SAVE = { easy: 0.16, normal: 0.10, hard: 0 };
/* 旧"掷骰子"判定（src/gameplay/shots.js releaseShot）的期望命中率，不含倾斜 */
function oldMake(u, diff) {
  const a = Math.abs(u);
  if (a <= 0.5) return 1;
  if (a > 1.8) return 0;
  const near = a <= 1, rattle = near ? 0.5 : 0.15;
  return rattle + (u > 0 ? 0.15 : UNDER_SAVE[diff]);
}
const pct = x => (x * 100).toFixed(0) + "%";
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let a = r(); if (a < 1e-12) a = 1e-12; return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * r()); }
function shot(p0, u, r, map, tuning) {
  return P.simulate(P.launch(p0, { tf: tfFor(p0), u, lat: (r() * 2 - 1) * 0.035, noise: gauss(r), luck: r(), map, tuning }), { tuning, untilDecided: true, maxT: 4 });
}
/* 按 u~N(0,σ) 抽样的期望命中率：物理 vs 旧表（同一批 u） */
function expected(p0, diff, sigma, n, seed, map, tuning) {
  const r = rng(seed); let phys = 0, old = 0;
  for (let i = 0; i < n; i++) { const u = gauss(r) * sigma; old += oldMake(u, diff); if (shot(p0, u, r, map, tuning).made) phys++; }
  return { phys: phys / n, old: old / n };
}
function bandRate(p0, lo, hi, side, n, seed, map, tuning) {
  const r = rng(seed); let made = 0; const kinds = { swish: 0, rattleIn: 0, bank: 0, rimOut: 0, air: 0 };
  for (let i = 0; i < n; i++) { const a = lo + (hi - lo) * r(), res = shot(p0, side * a, r, map, tuning); kinds[res.kind]++; if (res.made) made++; }
  return { rate: made / n, kinds };
}
/* 一套参数在一个难度下的全部平衡判定 */
function evaluate(diff, map, tuning, n) {
  const fails = [], rows = []; let loss = 0;
  for (const [name, p0] of SPOTS) {
    const row = { name };
    for (const sigma of [0.7, 1.5]) {
      const e = expected(p0, diff, sigma, n, 101 + sigma * 10, map, tuning);
      row["s" + sigma] = e; loss += (e.phys - e.old) ** 2;
      if (Math.abs(e.phys - e.old) > 0.06) fails.push(`[${diff}·${name}] σ=${sigma} 期望命中 ${pct(e.phys)}，旧系统 ${pct(e.old)}（差 >6pp）`);
    }
    for (const side of [1, -1]) {
      const inner = bandRate(p0, 0, 0.5, side, Math.ceil(n / 3), 17, map, tuning).rate;
      if (inner < 0.9) fails.push(`[${diff}·${name}] 甜区内圈${side > 0 ? "过力" : "欠力"}命中 ${pct(inner)} < 90%`);
      const far = bandRate(p0, 1.8, 3, side, Math.ceil(n / 3), 23, map, tuning).rate;
      if (far > 0.1) fails.push(`[${diff}·${name}] 远处${side > 0 ? "过力" : "欠力"}命中 ${pct(far)} > 10%`);
      loss += Math.max(0, 0.9 - inner) ** 2 + Math.max(0, far - 0.1) ** 2;
    }
    rows.push(row);
  }
  const mids = rows.map(r => (r["s0.7"].phys + r["s1.5"].phys) / 2), spread = Math.max(...mids) - Math.min(...mids);
  if (spread > 0.1) fails.push(`[${diff}] 投篮点之间期望命中差 ${pct(spread)} > 10pp（${rows.map((r, i) => r.name + pct(mids[i])).join(" ")}）`);
  loss += Math.max(0, spread - 0.1) ** 2;
  return { fails, rows, loss, spread };
}

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

/* ---------- 1. 确定性 ---------- */
{
  const p0 = SPOTS[0][1], L = P.launch(p0, { tf: tfFor(p0), u: 1.3, lat: 0.02 });
  const a = P.simulate(L), b = P.simulate(L);
  check(a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]), "同一出手两次模拟轨迹不一致");
}

/* ---------- 2. 几何：不穿篮板、不飞出场馆 ---------- */
{
  const box = P.GEOM.boxes[0], r = P.GEOM.ballR;
  let through = 0, far = 0, total = 0;
  for (const [, p0] of SPOTS) for (let u = -4; u <= 4; u += 0.25) for (const lat of [-0.3, 0, 0.3]) {
    const res = P.simulate(P.launch(p0, { tf: tfFor(p0), u, lat }), { colliders: P.INDOOR_COLLIDERS }); total++;
    const path = res.path;
    for (let i = P.STRIDE; i < path.length; i += P.STRIDE) {
      const x = path[i + 1], y = path[i + 2], z = path[i + 3], pz = path[i - P.STRIDE + 3];
      const inFace = Math.abs(x) < box.max[0] && y > box.min[1] && y < box.max[1];
      if (inFace && pz > box.max[2] && z < box.min[2]) { through++; break; }
      if (inFace && z < box.max[2] + r - 0.03 && z > box.min[2] - r + 0.03) { through++; break; }   // 嵌进板里超过 3cm
    }
    /* 挡板只有 1.1m 高：落地高弹从上方飞过去砸进摄影席是真实的（比赛里常见），
       不允许的是从挡板身上"穿过去" */
    for (let i = P.STRIDE; i < path.length; i += P.STRIDE) {
      const z = path[i + 3], pz = path[i - P.STRIDE + 3], y = path[i + 2], x = path[i + 1];
      if (pz > -13.05 && z < -13.21 && y < 1.1 && Math.abs(x) < 7.5) { far++; break; }
    }
  }
  check(through === 0, `${through}/${total} 条轨迹穿进/穿过篮板`);
  check(far === 0, `${far}/${total} 条轨迹穿过/越过底线后的媒体区挡板`);
}

/* ---------- 2b. 每颗球都必须结算 ----------
   游戏靠 decided 事件判负（missBall）。曾有中场投长卡在后沿与连接件之间、6 秒都没掉下来，
   那颗球永远不结算，投篮机会一直"等待最后一球"。低出手点（第一人称/矮个）也一并覆盖。 */
{
  const spots = SPOTS.map(s => s[1]).concat([[-7.0, 1.9, -6.0], [0, 1.87, -0.96], [5.4, 2.2, -2.3]]);
  let n = 0, unsettled = 0, late = 0;
  for (const p0 of spots) for (let u = -6; u <= 4; u += 0.2) for (const lat of [-0.4, 0, 0.4]) for (const noise of [-1.5, 0, 1.5]) {
    const res = P.simulate(P.launch(p0, { tf: tfFor(p0), u, lat, noise, luck: 0.5 }), { colliders: P.INDOOR_COLLIDERS }); n++;
    const d = res.events.find(e => e.type === "decided");
    if (!d) unsettled++; else if (d.t > 5) late++;
  }
  check(unsettled === 0, `${unsettled}/${n} 颗球没有 decided 事件（游戏里永远不结算）`);
  check(late === 0, `${late}/${n} 颗球超过 5 秒才结算`);
}

/* ---------- 2c. 按结果找轨迹 ----------
   对手 / AI 表演 / 绝杀防守保留原有的进不进判定，只让轨迹是真的。要求：结果必须对得上，
   且绝大多数不用退回兜底（兜底的球样子单调：要进必空心、不进必三不沾）。 */
{
  const r = rng(99); let n = 0, wrong = 0, fallback = 0;
  for (const [, p0] of SPOTS) for (const want of [true, false]) for (let i = 0; i < 30; i++) {
    const out = P.launchForOutcome(p0, { tf: tfFor(p0), want, rng: r, colliders: P.INDOOR_COLLIDERS }); n++;
    if (out.res.made !== want) wrong++;
    if (out.fallback) fallback++;
  }
  check(wrong === 0, `按结果找轨迹：${wrong}/${n} 次结果对不上`);
  check(fallback / n < 0.03, `按结果找轨迹：${fallback}/${n} 次退回兜底（应 < 3%）`);
}

/* ---------- 3. 每个点的零误差都是空心 ---------- */
for (const [name, p0] of SPOTS) {
  const res = P.simulate(P.launch(p0, { tf: tfFor(p0), u: 0 }));
  check(res.kind === "swish", `${name} 零误差不是空心（${res.kind}）`);
}

/* ---------- 4. 平衡 ---------- */
if (args.has("--tune")) {
  const grid = [];
  for (const overM of [0.3, 0.38, 0.46]) for (const underM of [0.14, 0.18, 0.22]) for (const jitterM of [0.03, 0.05, 0.08]) for (const eBoard of [0.58, 0.7])
    grid.push({ map: Object.assign({}, P.DEFAULT_MAP, { overM, underM, jitterM }), tuning: { eBoard } });
  for (const diff of ["easy", "normal", "hard"]) {
    const ranked = grid.map(g => ({ g, loss: evaluate(diff, g.map, g.tuning, 160).loss })).sort((a, b) => a.loss - b.loss).slice(0, 3);
    ranked.forEach(({ g, loss }) => console.log(`${diff}: overM=${g.map.overM} underM=${g.map.underM} jitterM=${g.map.jitterM} eBoard=${g.tuning.eBoard} loss=${loss.toFixed(4)}`));
  }
}
for (const diff of ["easy", "normal", "hard"]) {
  const { fails, rows, spread } = evaluate(diff, P.DIFF_MAPS[diff], TUNING, 400);
  failures.push(...fails);
  if (args.has("--table")) {
    console.log(`\n== ${diff} · ${RIM} ==  投篮点间差 ${pct(spread)}`);
    console.log("投篮点   σ=.7 物理/旧    σ=1.5 物理/旧");
    rows.forEach(r => console.log(`${r.name.padEnd(4, "　")}   ${pct(r["s0.7"].phys).padStart(4)}/${pct(r["s0.7"].old).padStart(4)}     ${pct(r["s1.5"].phys).padStart(4)}/${pct(r["s1.5"].old).padStart(4)}`));
  }
}

if (failures.length) {
  console.log(`\n❌ ball-physics 未通过 ${failures.length} 项：`);
  failures.slice(0, 40).forEach(f => console.log("  - " + f));
  process.exit(1);
}
console.log(`✅ ball-physics（${RIM}）：确定性、几何、零误差空心、三难度×五点平衡全部通过`);
