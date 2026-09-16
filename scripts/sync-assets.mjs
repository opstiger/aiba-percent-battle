/* 把 assets/premium/ 增量同步到 Cloudflare R2。
     node scripts/sync-assets.mjs              # dry-run:只列出要传什么,不动网络
     node scripts/sync-assets.mjs --apply      # 真的上传
     node scripts/sync-assets.mjs --bucket aiba-assets --prefix v1/

   为什么要有它:资源从仓库里搬到 R2 之后,每次改了配音/封面就得同步一次。
   手动一个个传迟早会漏 —— 今天线上那 7 个静默 404 的音效就是"漏了"的后果。

   增量判据是**内容哈希**,不是修改时间:时间戳会被 git checkout、复制、
   备份还原改掉,拿它当判据会反复重传没变的文件(50MB 媒体,每次全量很浪费)。
   本地维护一份 .r2-manifest.json 记录已上传文件的哈希。

   凭据:走 `npx wrangler` 的登录态(npx wrangler login,浏览器 OAuth)。
   本脚本**不读也不存**任何 Access Key —— 密钥不该经过这里。 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d;};
const APPLY=args.includes("--apply");
const SRC=path.join(ROOT,opt("--src","assets/premium"));
const BUCKET=opt("--bucket","aiba-assets");
const PREFIX=opt("--prefix","");
const MANIFEST=path.join(ROOT,".r2-manifest.json");

const MIME={".mp3":"audio/mpeg",".wav":"audio/wav",".mp4":"video/mp4",".webm":"video/webm",
  ".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
  ".glb":"model/gltf-binary",".task":"application/octet-stream",".json":"application/json"};

function walk(dir,base=dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).flatMap(name=>{
    const p=path.join(dir,name);
    const st=fs.statSync(p);
    if(st.isDirectory())return walk(p,base);
    if(name===".DS_Store")return [];
    return [{abs:p,rel:path.relative(base,p).split(path.sep).join("/"),size:st.size}];
  });
}
const sha=f=>crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0,16);

function loadManifest(){
  try{return JSON.parse(fs.readFileSync(MANIFEST,"utf8"));}catch(e){return {};}
}

const files=walk(SRC);
if(!files.length){
  console.error(`源目录里没有文件: ${path.relative(ROOT,SRC)}`);
  console.error("(资源分层还没做的话,先把要上 CDN 的媒体挪进这个目录)");
  process.exit(1);
}
const manifest=loadManifest();
const todo=[],skip=[];
for(const f of files){
  const h=sha(f.abs);
  (manifest[f.rel]===h?skip:todo).push({...f,hash:h});
}

const mb=n=>(n/1048576).toFixed(2)+" MB";
console.log(`源 ${path.relative(ROOT,SRC)}/  →  r2://${BUCKET}/${PREFIX}`);
console.log(`共 ${files.length} 个文件 · 已是最新 ${skip.length} 个 · 需要上传 ${todo.length} 个 (${mb(todo.reduce((a,b)=>a+b.size,0))})`);
if(!todo.length){console.log("没有要传的。");process.exit(0);}
todo.forEach(f=>console.log(`   + ${f.rel}  ${mb(f.size)}`));

if(!APPLY){
  console.log("\n这是 dry-run。确认无误后加 --apply 真正上传。");
  console.log("上传需要先登录:  npx wrangler login");
  process.exit(0);
}

/* 逐个上传。wrangler 没有批量 put,所以只能循环;失败要立刻停,
   否则 manifest 会记上其实没传成功的文件,下次就跳过了 —— 那是最坏的情况:
   本地以为传了,线上 404,而且再也不会重试。 */
let done=0;
for(const f of todo){
  const key=PREFIX+f.rel;
  const ct=MIME[path.extname(f.rel).toLowerCase()]||"application/octet-stream";
  process.stdout.write(`   ↑ ${f.rel} ... `);
  try{
    execFileSync("npx",["--yes","wrangler","r2","object","put",`${BUCKET}/${key}`,
      "--file",f.abs,"--content-type",ct,"--remote"],{cwd:ROOT,stdio:["ignore","pipe","pipe"]});
  }catch(e){
    console.log("失败");
    console.error("\n上传中断:"+String(e.stderr||e.message).split("\n").slice(0,3).join("\n"));
    console.error(`已成功 ${done}/${todo.length};manifest 只记已成功的,重跑会从断点继续。`);
    fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,2));
    process.exit(1);
  }
  manifest[f.rel]=f.hash;done++;
  console.log("ok");
}
fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,2));
console.log(`\n完成:上传 ${done} 个文件。manifest 已更新(${path.relative(ROOT,MANIFEST)})。`);
