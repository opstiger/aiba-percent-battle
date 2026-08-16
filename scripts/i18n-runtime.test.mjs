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
