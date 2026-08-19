import fs from "node:fs";
const src=fs.readFileSync("src/i18n.js","utf8");
const body=src.replace(/^\/\*[\s\S]*?\*\/\s*/,"");
const wrapped=`return (function(global,document,navigator,localStorage){
  var window=global;
  var MutationObserver=class{observe(){}disconnect(){}};
  var setTimeout=()=>0,requestAnimationFrame=()=>0;
  let __t;
  ${body.replace(/global\.AIBAI18N=\{[^}]*\};?/,"__t=t;")}
  return {t:__t};
})(arguments[0],arguments[1],arguments[2],arguments[3]);`;
const stub=()=>({style:{},setAttribute(){},appendChild(){},addEventListener(){}});
const doc={documentElement:{lang:"",setAttribute(){},getAttribute:()=>null,style:{}},addEventListener(){},
  createElement:stub,body:{appendChild(){}},head:{appendChild(){}},querySelectorAll:()=>[],
  getElementById:()=>null,createTreeWalker:()=>({nextNode:()=>null})};
const {t}=new Function(wrapped)({addEventListener(){},location:{search:"?lang=en",reload(){}}},doc,
  {language:"en"},{getItem:()=>"en",setItem(){}});

// 这些是运行期真正渲染出来的字符串（模板已插值）
const runtime=[
  // 绝杀时刻（v2.19.6）
  "2 小时 15 分","45 分","今日机会已用完 · 2 小时 15 分后刷新",
  "力度差了约 12 点。按住再多停半拍，等投篮条涨进绿色甜区再松手。",
  "差约 5 点就进甜区了。再多按一点点。",
  "力度多了约 9 点。看到投篮条进绿色就松手，别等它涨满。",
  "多了约 4 点。松手再早一丝。",
  "就是这个感觉。正式挑战每天只有一次。",
  "罚球 2 / 3","罚球 2/3 · 本攻共 3 分","落后 1 分",
  "每日挑战 · 绝杀时刻","绝杀时刻","每天一次","看球 · 球会分到你手上",
  "进了!比赛结束!","绝杀命中","🙌 投篮犯规 · 三次罚球","⏱ 没能出手",
  "出手时机没问题 · 被封盖了","蓄力偏少 · 出手略早","总决赛 · 第四节最后 7 秒",
  // 现场解说（v2.19.7）
  "三连中,篮网开始发烫.","五连铁了,篮筐都要报警了.","双方打平","你暂时领先","最后五分决胜",
  // 投篮机 / 三分大赛：拼接出来的整句
  "第 3 关,彩球架。目标 42 分。","第 2 架","本次挑战结束,总分 88 分。",
  "FINAL RUSH,最后冲刺!","🎯 轮到你出手",
  // 表头（HTML 里的文本节点会被逐个翻译）
  "用时","分数","命中","出手","总分","关卡","耗时","暂无记录","暂无全球记录",
  "全球排行榜读取失败,稍后再试。","三分大赛云端榜稍后接入",
  // 捏人工坊
  "黑","棕","金","高马尾","发髻","快","稳","弧","杀",
  "速+12%","准-5%","弧+8%","N-24 夜航者 已载入工坊",
  // 新手引导 / 难度
  "直接开逛","查看完整玩法说明 ›","玩法说明","选择难度",
  "百分大战中,难度会影响你的甜区宽度和对手命中节奏。",
  "前 5 球显示投篮条，之后靠手感出手。",
  // 模式副标题 / 暂停
  "练习模式","无计时 · 无计分","36 分 · 12.4 秒",
  // 角色与装备
  "N-24 夜航者","锐角中高弧","节奏快射","未装备",
  // 接球手型
  "双手","投篮手抬高","辅助手抬高",
  // 体感教学（vision-tutorial）
  "🎥 用身体投篮","🔒 摄像头画面只在本机识别姿态,不上传、不存储。",
  "开启摄像头,进入真实球场","还是用触屏","动作已经完全掌握,上场就是这套流程。","开打!",
  // 投篮机关卡名
  "热身启动","节奏加速","压力测试","火力全开","极限盲投","百分竞速",
];
let bad=0;
const CJK=/[一-龥]/;
for(const s of runtime){
  const o=t(s);
  const ok=!CJK.test(o);
  if(!ok)bad++;
  console.log((ok?"  ✅ ":"  ❌ ")+s.slice(0,34).padEnd(36)+" -> "+o.slice(0,58));
}
console.log(bad?`\n${bad} 条仍未翻译`:"\n运行期文案全部覆盖");
process.exit(bad?1:0);
