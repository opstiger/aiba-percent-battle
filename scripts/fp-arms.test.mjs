/* 第一人称手臂 = 第三人称手臂的镜像。跑:node scripts/fp-arms.test.mjs

   这里守的是"两套资产不同步"这一类问题 —— 玩家原话:
   "第三人称看得出来穿了紫色长袖,第一人称看没有衣袖。"

   三个已经踩过的坑:
     ① 镜像是 buildFpRig 那一刻的深拷贝,pairs 也按当时的遍历顺序固定死了。
        装备是之后才往 player.arms / player.elbows 里加子节点的,永远不会被镜像到。
     ② applySleeve 卸下装备走 early return,只清了装备组,没把 sl/wr 复位,
        于是上一件的袖子带着颜色一直挂在手臂上。
     ③ 第一人称只看得到肘部以下。穿在大臂上的装备如果照常渲染,
        就是一块悬空浮在手边的板子,底下那截前臂还是光的。

   必须无头浏览器:预览标签切后台会冻结 rAF,镜像根本不同步。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch();break;}catch(e){}try{browser=await m.chromium.launch({channel:"chrome"});break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}

let fail=0;
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)fail++;};

const page=await browser.newPage({viewport:{width:420,height:860}});
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`,{waitUntil:"load"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
await page.waitForFunction("typeof G!=='undefined'&&typeof startPractice==='function'",{timeout:20000});

// 进练习并切到第一人称,等镜像建起来
await page.evaluate(async()=>{
  const g=AIBA.runtime.service("legacy");
  AIBAGearEquip("sleeve","");AIBAGearEquip("band","");AIBAGear.applyVisual(g.player);
  startPractice();
  for(let i=0;i<200;i++){if(g.G.canShoot)break;await new Promise(r=>setTimeout(r,50));}
  g.CAM.mode=0;g.applyCamMode&&g.applyCamMode();
  await new Promise(r=>setTimeout(r,900));
});

/* 一开始就抓一份"什么都没穿"的基线。后面每组都可能留下装备,
   拿上一组的结果当基线会把污染当成正常(变异测试里就踩到了)。 */
const pristine=await page.evaluate(()=>{
  const g=AIBA.runtime.service("legacy");
  return {s:(g.player.sleeves||[]).map(m=>!!(m&&m.visible)),
          w:(g.player.wrists||[]).map(m=>!!(m&&m.visible))};
});

console.log("① 镜像会跟着骨架变化重建");
{
  const r=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    const cnt=o=>{let n=0;o.traverse(()=>n++);return n;};
    const mirror=()=>{const rig=g.scene.getObjectByName("fpSharedPoseRig");const c=rig&&rig.getObjectByName("fpShootingArm");return c?cnt(c):null;};
    const before={real:cnt(g.player.arms[0]),mirror:mirror()};
    AIBAGearEquip("sleeve","sleeve-ice");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,700));
    const after={real:cnt(g.player.arms[0]),mirror:mirror()};
    return {before,after};
  });
  // 镜像多出来的 1 个节点是挂进 ballGrip 的 handBall,不是骨架
  const diff=o=>o.mirror===null?null:o.mirror-o.real;
  check(r.after.real>r.before.real,
    "穿上护臂后真实手臂确实多了节点("+r.before.real+" → "+r.after.real+")");
  check(diff(r.before)===diff(r.after)&&diff(r.after)!==null,
    "镜像同步跟上了(真实/镜像差值恒定 "+diff(r.after)+",就是那颗 handBall)");
}

console.log("\n② 第一人称只出现肘部以下,没有悬空装备");
{
  const r=await page.evaluate(()=>{
    const g=AIBA.runtime.service("legacy");
    const rig=g.scene.getObjectByName("fpSharedPoseRig");
    const arm=rig&&rig.getObjectByName("fpShootingArm");
    if(!arm)return {no:true};
    let elbow=arm.getObjectByName("handRig");
    while(elbow&&elbow.parent&&elbow.parent!==arm)elbow=elbow.parent;
    const under=(n,root)=>{for(let p=n;p;p=p.parent)if(p===root)return true;return false;};
    let 肘上可见=0,肘下可见=0;
    arm.traverse(n=>{
      if(!n.isMesh||!n.visible)return;
      if(elbow&&under(n,elbow))肘下可见++;else 肘上可见++;
    });
    return {肘上可见,肘下可见};
  });
  check(!r.no,"镜像存在");
  check(r.肘上可见===0,"肘部以上没有任何网格在第一人称渲染(悬空装备数 "+r.肘上可见+")");
  check(r.肘下可见>0,"肘部以下正常渲染("+r.肘下可见+" 个网格)");
}

console.log("\n③ 护臂盖到前臂,两个视角看到的是同一件");
{
  const r=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    /* 必须用 sleeve-steady:sleeve-ice 本来就自带一个肘部小件,
       拿它测的话"删掉前臂那一段"也照样通过(变异测试里就是这么漏掉的)。 */
    AIBAGearEquip("sleeve","");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,300));
    AIBAGearEquip("sleeve","sleeve-steady");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,500));
    let 件数=0,最低点=0;
    (g.player.gearSleeveGroups||[]).forEach(grp=>{
      let onElbow=false;
      for(let p=grp;p;p=p.parent)if(p===g.player.elbows[0])onElbow=true;
      if(!onElbow)return;
      grp.traverse(n=>{if(n.isMesh){件数++;最低点=Math.min(最低点,n.position.y);}});
    });
    return {件数,最低点:+最低点.toFixed(3)};
  });
  check(r.件数>=2,
    "稳定白在前臂上有实体("+r.件数+" 个网格)—— 只做大臂的话第一人称还是光胳膊");
  check(r.最低点<=-0.2,
    "袖子一直盖到接近腕部(最低 y="+r.最低点+")");
}

console.log("\n④ 卸下装备要还原成原样,不留上一件的袖子");
{
  const r=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    const st=()=>({s:(g.player.sleeves||[]).map(m=>!!(m&&m.visible)),
                   w:(g.player.wrists||[]).map(m=>!!(m&&m.visible))});
    AIBAGearEquip("sleeve","sleeve-ice");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,350));
    const worn=st();
    AIBAGearEquip("sleeve","sleeve-ice");AIBAGear.applyVisual(g.player);   // 再点一次 = 脱下
    await new Promise(r=>setTimeout(r,350));
    return {worn,off:st(),组数:(g.player.gearSleeveGroups||[]).length};
  });
  check(JSON.stringify(r.worn)!==JSON.stringify(pristine),"穿上时确实改变了外观");
  check(JSON.stringify(r.off)===JSON.stringify(pristine),
    "脱下后精确还原到最初状态(期望 "+JSON.stringify(pristine)+",实际 "+JSON.stringify(r.off)+")");
  check(r.组数===0,"脱下后装备组已清空");
}

console.log("\n⑤ 连帽衫的长袖在第一人称看得见");
{
  const r=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    const cam=AIBA.runtime.service("rendering:core").camera;
    const skinHex="#"+(g.player.mSkin?g.player.mSkin.color.getHexString():"");
    const scan=()=>{
      const rig=g.scene.getObjectByName("fpSharedPoseRig");const v=new THREE.Vector3();
      const cols={};if(!rig)return cols;
      rig.traverse(n=>{
        if(!n.isMesh||!n.visible)return;
        n.getWorldPosition(v);v.project(cam);
        if(Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z<1){
          const c=n.material&&n.material.color?"#"+n.material.color.getHexString():"?";
          cols[c]=(cols[c]||0)+1;
        }
      });return cols;
    };
    AIBAGearEquip("band","");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,700));
    const bare=scan();
    AIBAGearEquip("band","head-hoodie");AIBAGear.applyVisual(g.player);
    await new Promise(r=>setTimeout(r,700));
    const hood=scan();
    return {bare:Object.keys(bare).length,hood:Object.keys(hood).length,
            新增颜色:Object.keys(hood).filter(c=>!bare[c])};
  });
  check(r.新增颜色.length>0,
    "穿上连帽衫后第一人称画面里出现了新的材质("+r.新增颜色.join(",")+")");
}

check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
await browser.close();server.close();
console.log(fail?`\n${fail} 条失败`:"\n第一人称手臂验证通过");
process.exit(fail?1:0);
