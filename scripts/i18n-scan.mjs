/* 扫出 src/ 里所有会进 UI 的中文串，逐个过 i18n 的 t()，列出英文模式下翻不动的。
   注释里的中文会被剔除（不进 UI）。带 ${} 的模板字符串这里必然"翻不动"——
   它们的运行期形态由 scripts/i18n-runtime.test.mjs 覆盖。
   跑：node scripts/i18n-scan.mjs */
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const src=fs.readFileSync(path.join(root,"src/i18n.js"),"utf8");
// 把 i18n.js 当模块跑起来拿到 t()
/* i18n.js 是 IIFE，直接跑会碰 DOM。这里把它整段包进一个函数，
   喂假的 window/document，再从内部把 t 和 DICT 抛出来。 */
const body=src.replace(/^\/\*[\s\S]*?\*\/\s*/,"");
const wrapped=`
  return (function(global,document,navigator,localStorage){
    var window=global;   // i18n.js 末尾是 })(window)
    var MutationObserver=class{observe(){}disconnect(){}};
    var setTimeout=()=>0, requestAnimationFrame=()=>0, Node={TEXT_NODE:3,ELEMENT_NODE:1};
    var NodeFilter={SHOW_TEXT:4,SHOW_ELEMENT:1,FILTER_ACCEPT:1};
    let __t,__DICT;
    ${body.replace(/global\.AIBAI18N=\{[^}]*\};?/,"__t=t;__DICT=DICT;")}
    return {t:__t,DICT:__DICT};
  })(arguments[0],arguments[1],arguments[2],arguments[3]);
`;
const stub=()=>({style:{},setAttribute(){},appendChild(){},addEventListener(){}});
const fakeDoc={documentElement:{lang:"",setAttribute(){},getAttribute:()=>null,style:{}},addEventListener(){},createElement:stub,
  body:{appendChild(){}},head:{appendChild(){}},querySelectorAll:()=>[],getElementById:()=>null,
  createTreeWalker:()=>({nextNode:()=>null})};
const fakeWin={addEventListener(){},location:{search:"?lang=en",reload(){}},
  MutationObserver:class{observe(){}disconnect(){}},setTimeout(){},requestAnimationFrame(){}};
const api=new Function(wrapped)(fakeWin,fakeDoc,{language:"en"},{getItem:()=>"en",setItem(){}});

const files=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);
  const st=fs.statSync(p);
  if(st.isDirectory()){if(!/node_modules|backup|\.git/.test(p))walk(p);}
  else if(/\.js$/.test(f)&&!/i18n\.js$/.test(f))files.push(p);}})(path.join(root,"src"));

const CJK=/[一-龥]/;
const found=new Map();
for(const f of files){
  let code=fs.readFileSync(f,"utf8");
  // 注释里的中文不会进 UI，先去掉，否则一堆假阳性
  code=code.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/[^\n]*/g,"$1");
  // 只看会进 UI 的：字符串字面量
  const re=/(["'`])((?:[^\\\n]|\\.)*?)\1/g;
  let m;
  while((m=re.exec(code))){
    const s=m[2];
    if(!CJK.test(s))continue;
    if(s.length>60)continue;
    if(!found.has(s))found.set(s,new Set());
    found.get(s).add(path.relative(root,f));
  }
}
const miss=[];
for(const [s,fs_] of found){
  const out=api.t(s);
  if(out===s&&CJK.test(s))miss.push({s,files:[...fs_]});
}
console.log("扫描字符串总数",found.size,"翻不动",miss.length,"\n");
const byFile={};
for(const m of miss)for(const f of m.files){(byFile[f]=byFile[f]||[]).push(m.s);}
for(const f of Object.keys(byFile).sort())
  console.log(`── ${f} (${byFile[f].length})\n   ${byFile[f].slice(0,40).join(" | ")}`);
fs.writeFileSync("/tmp/i18n-missing.json",JSON.stringify(miss.map(m=>m.s),null,0));
