#!/usr/bin/env node
"use strict";
/* 缓存版本号按文件内容自动生成：index.html 里每个本地 src/*.js 与 styles.css 的
   ?v= 都写成该文件内容的 sha1 前 8 位。改了哪个文件，哪个文件的 v 就自动变；
   没改的文件 v 不动，浏览器缓存照常命中。

   用法：
     node scripts/stamp-versions.js          重写 index.html，并同步当前发版快照
     node scripts/stamp-versions.js --check  只检查，有过期的 v 就列出来并退出 1

   发版快照(block-3pt-kingv*-modular.html)不在这里写死：盖章前与 index.html
   逐字节相同的那份就是当前快照，盖完一起更新。check.js 会校验两份仍然一致。 */

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const root=path.resolve(__dirname,"..");
const ENTRY="index.html";
/* 需要带 v 的本地资源：游戏自己的脚本和样式。vendor/ 文件名里已带版本，字体不走 v。 */
const STAMPED=/^(src\/.+\.js|styles\.css)$/;
const REF=/(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+)(?:\?v=[^"]*)?(")/g;

function hashFor(rel){
  return crypto.createHash("sha1").update(fs.readFileSync(path.join(root,rel))).digest("hex").slice(0,8);
}

/* 返回 {html, refs:[{rel, v, want}]}；v 是原来的值(没有则为 null)。 */
function stamp(html){
  const refs=[];
  const out=html.replace(REF,(all,head,rel,tail)=>{
    if(!STAMPED.test(rel)||!fs.existsSync(path.join(root,rel)))return all;
    const m=all.match(/\?v=([^"]*)"/);
    const want=hashFor(rel);
    refs.push({rel,v:m?m[1]:null,want});
    return head+rel+"?v="+want+tail;
  });
  return {html:out,refs};
}

function snapshotsOf(html){
  return fs.readdirSync(root)
    .filter(f=>/^block-3pt-kingv.*-modular\.html$/.test(f))
    .filter(f=>fs.readFileSync(path.join(root,f),"utf8")===html);
}

if(require.main===module){
  const checkOnly=process.argv.includes("--check");
  const before=fs.readFileSync(path.join(root,ENTRY),"utf8");
  const {html,refs}=stamp(before);
  const stale=refs.filter(r=>r.v!==r.want);
  if(checkOnly){
    stale.forEach(r=>console.error(`stale ?v= ${r.rel}: ${r.v} -> ${r.want}`));
    if(stale.length){console.error(`${stale.length} stale cache version(s); run node scripts/stamp-versions.js`);process.exit(1);}
    console.log(`versions ok: ${refs.length} refs`);
    process.exit(0);
  }
  const snaps=snapshotsOf(before);
  fs.writeFileSync(path.join(root,ENTRY),html);
  snaps.forEach(f=>fs.writeFileSync(path.join(root,f),html));
  stale.forEach(r=>console.log(`${r.rel}: ${r.v} -> ${r.want}`));
  console.log(`stamped ${stale.length}/${refs.length} refs in ${[ENTRY].concat(snaps).join(", ")}`);
  if(!snaps.length)console.warn("warning: no release snapshot matched index.html before stamping; sync it by hand");
}

module.exports={hashFor,stamp,STAMPED};
