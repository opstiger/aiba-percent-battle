/* 三分大赛 AI 表演的出手动作验收。跑:node scripts/ai-show-shot.test.mjs
   非零退出码 = 验收不通过。

   验两件用户直接点名的事:
     ① 出手后不能僵在最高点。以前 ph=Math.min(1.03,...) 钳死后,那条冻结曲线
        还要喂 poseGuy 整整 totalDur-loadDur(0.72~0.86 秒),人悬在空中不下来,
        到点再瞬间弹回站姿 —— 原话"空中最高点停顿出手,很老的模式了"。
     ② 要按球星风格出手。以前 shotCurves(ph) 不传 style,18 种风格在 AI 身上全丢,
        而 rivals 其实有 shotStyle(applyStarStyle 会写),只是没往下传。

   都用**逐帧采样的实际高度**判定,不看代码字面量(那种守卫在 check.js 里)。
   无头环境的 rAF 节流没保证,必须冻结 rAF + 按 1/60 手动步进,否则采样点会飘。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{
  const c=decodeURIComponent(rq.url.split("?")[0]);
  if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}
  const f=path.join(ROOT,c==="/"?"/index.html":c);
  fs.readFile(f,(e,b)=>{if(e){rs.writeHead(e.code==="EISDIR"?204:404);return rs.end();}
    rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});
});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});

let B=null;
for(const base of [import.meta.url,"/opt/homebrew/lib/node_modules/"].concat(
    (()=>{try{const n=path.join(process.env.HOME||"",".npm/_npx");
      return fs.readdirSync(n).map(d=>path.join(n,d,"node_modules")+"/");}catch(e){return [];}})())){
  for(const pkg of ["playwright","playwright-core"]){
    let m;try{m=createRequire(base)(pkg);}catch(e){continue;}
    try{B=await m.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break;}catch(e){}
  }
  if(B)break;
}
if(!B){console.error("需要 Playwright: npx playwright install chromium");server.close();process.exit(2);}

const ctx=await B.newContext({viewport:{width:1100,height:700},deviceScaleFactor:1});
try{await ctx.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});}catch(e){}
await ctx.addInitScript(()=>{
  let seed=5150;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=fn=>raf(t=>{if(!window.__freeze)fn(t);});
});
const page=await ctx.newPage();
const errs=[];page.on("pageerror",e=>errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?intro=0&quality=hd&seed=5150`,{waitUntil:"load",timeout:60000});
await page.waitForFunction("typeof startAIShow==='function'&&typeof rivals!=='undefined'&&typeof G!=='undefined'",{timeout:30000});

async function runStar(id){
  return await page.evaluate(async({id})=>{
    const loop=window.AIBA.runtime.service("core:game-loop");
    window.__freeze=true;loop.clock.getDelta=()=>1/60;
    const CFG=window.AIBA_CONFIG;
    const pool=(CFG&&CFG.CLASSIC_LEGENDS)||[];
    const star=pool.find(x=>x&&x.id===id)||{id,n:id,col:[0x1d428a,0xffc72c],num:11};
    G.stage="semi";G.opponents=[star];
    window.AIBA.runtime.service("rendering:characters").applyStarStyle(rivals[0],star);
    startAIShow(star,function(){});
    const rows=[];
    let firedAt=-1,itemEnd=-1,maxPh=0,seenTypes={},releaseBallY=null;
    for(let i=0;i<900;i++){
      window.animate();
      /* ⚠ 当前项是 show.cur,不是 show.q[show.idx] —— nextShowItem 里是
         show.cur=show.q[show.idx++],idx 已经越过当前项。读错了会看到一个
         永远 fired=false、ph=undefined 的"下一项",指标全是假的。 */
      const it=show.cur;
      if(!it)break;
      seenTypes[it.type]=(seenTypes[it.type]||0)+1;
      if(it.type!=="shot"){if(firedAt>=0){itemEnd=i;break;}continue;}
      if(typeof it.ph==="number")maxPh=Math.max(maxPh,it.ph);
      const bw=new THREE.Vector3();
      if(show.guy.ball){show.guy.g.updateMatrixWorld(true);show.guy.ball.getWorldPosition(bw);}
      rows.push({i,y:+show.guy.g.position.y.toFixed(4),fired:!!it.fired,t:+show.t.toFixed(3),
        rx:+show.guy.g.rotation.x.toFixed(4),by:+bw.y.toFixed(4),
        yaw:+(show.guy.g.rotation.y-faceTo(show.guy.pos,HOOP)).toFixed(4)});
      if(it.fired&&firedAt<0){firedAt=i;releaseBallY=+bw.y.toFixed(4);}
    }
    return {rows,firedAt,itemEnd,maxPh,seenTypes,releaseBallY,lefty:!!show.guy.lefty,state:G.state,showOn:!!show.on,idx:show.idx,
      style:show.guy.shotStyle?{kick:show.guy.shotStyle.kick,lean:show.guy.shotStyle.lean}:null};
  },{id});
}

const A=await runStar("t01");        // 麦迪:右手
const Bm=await runStar("thompson");  // 汤普森:右手
const H=await runStar("h13");        // 哈登:全表唯一左手 —— 用来验朝向镜像
await ctx.close();await B.close();server.close();

function analyse(r,name){
  const rows=r.rows;
  if(!rows.length)return {name,err:"没采到出手帧"};
  const rest=rows[0].y;
  const peak=Math.max(...rows.map(x=>x.y));
  const post=rows.filter(x=>x.fired);
  const tail=post.length?post[post.length-1].y:null;
  /* 悬停判定:出手之后剩余帧里,高度还停在峰值附近的比例。
     旧实现是曲线冻结 → 出手后几乎每一帧都贴着峰值。 */
  const thr=rest+(peak-rest)*0.7;
  const hang=post.length?post.filter(x=>x.y>=thr).length/post.length:1;
  /* ⚠ 不能用 max(|rx|):躯干角是 -DIP_LEAN*load-0.06*over-0.03*jmp+0.08*land,
     绝对值峰值被**蓄力**那一项主导,而 style.lean 是乘 c.jmp 只在离地后叠加的,
     所以要取**跳到最高那一帧**的 rx —— 那里 jmp≈1,lean 完整体现。 */
  const apex=rows.reduce((p,q)=>q.y>p.y?q:p,rows[0]);
  const rxPeak=apex.rx||0,yawApex=apex.yaw||0;
  return {name,rest:+rest.toFixed(3),peak:+peak.toFixed(3),tail:tail!=null?+tail.toFixed(3):null,
    postFrames:post.length,hangRatio:+hang.toFixed(3),rxPeak:+rxPeak.toFixed(4),
    releaseBallY:r.releaseBallY,yawApex:+yawApex.toFixed(4),lefty:r.lefty,style:r.style};
}
const a=analyse(A,"麦迪 t01"),b=analyse(Bm,"汤普森 thompson"),h=analyse(H,"哈登 h13(左手)");
console.log(JSON.stringify(a)+"\n"+JSON.stringify(b)+"\n");
console.log("[diag] t01 "+JSON.stringify({firedAt:A.firedAt,maxPh:A.maxPh,types:A.seenTypes,state:A.state,on:A.showOn,idx:A.idx,n:A.rows.length}));
console.log("[diag] thompson "+JSON.stringify({firedAt:Bm.firedAt,maxPh:Bm.maxPh,types:Bm.seenTypes,state:Bm.state,on:Bm.showOn,idx:Bm.idx,n:Bm.rows.length}));
if(A.rows.length)console.log(JSON.stringify(h));
console.log("[diag] t01 tail rows "+JSON.stringify(A.rows.slice(-4)));

let bad=false;
const say=(ok,txt)=>{console.log((ok?"  PASS  ":"  FAIL  ")+txt);if(!ok)bad=true;};
say(!a.err&&!b.err,"两位球星都采到了出手帧");
say(a.postFrames>=12&&b.postFrames>=12,"出手后的采样帧够多(否则悬停比例没意义)");
/* ① 不能僵在最高点 */
say(a.hangRatio<=0.45,"麦迪出手后不再僵在最高点(贴峰帧占比 "+a.hangRatio+",要求 ≤0.45)");
say(b.hangRatio<=0.45,"汤普森出手后不再僵在最高点(贴峰帧占比 "+b.hangRatio+",要求 ≤0.45)");
say(a.tail!=null&&a.peak-a.rest>0.02&&(a.tail-a.rest)<(a.peak-a.rest)*0.5,
  "麦迪这一拍结束时已经落回来(末帧 "+a.tail+" vs 峰值 "+a.peak+" 起始 "+a.rest+")");
/* ② 要吃球星风格 —— 先证明两人的 style 真的不同,否则下一条是空断言 */
say(!!a.style&&!!b.style&&a.style.kick!==b.style.kick,
  "两位球星的 shotStyle 确实不同(麦迪 kick="+(a.style&&a.style.kick)+" 汤普森 kick="+(b.style&&b.style.kick)+")");
/* ⚠ 这两条要分清各自在测什么,否则会写出空断言:
   · 躯干后仰(lean)由 poseGuy 直接读 o.shotStyle 施加,**改动之前就已经生效** ——
     它只是防回退的守卫,不能用来证明"style 传给了 shotCurves"。
     (实测把 cinematics.js 换回旧版,这条照样绿。)
   · 真正由 shotCurves(ph,style) 驱动的是出手时机与举球高度(release/setPoint),
     所以用**出手瞬间的球心世界高度**来验。麦迪 release=.02/setPoint=-.03,
     汤普森 release=.015/setPoint=0。
   kick 不能用:它由 applyReleaseFeetPose 消费,而两条 AI 路径都不走那一步(见下方说明)。 */
say(Math.abs(a.rxPeak-b.rxPeak)>0.004,
  "[既有行为守卫] 最高点躯干角按 lean 区分(麦迪 "+a.rxPeak+" vs 汤普森 "+b.rxPeak+")");
/* 出手瞬间球心高度**不能**用来验"style 传进了 shotCurves":setPoint 改的是 lift 的
   时机,到 ph=1.03 时两边都已饱和,实测改动前后都是同一个差值(0.1159 vs 0.1161),
   那是 poseGuy 直接读 o.shotStyle 的结果,不是本次改动。写在这里免得下一个人再上当。
   本次改动里真正可观测的是**朝向**:旧代码是 +SHOT_STANCE_YAW*stance,
   既没有左手镜像也没有 style.turn,所以哈登这种左手球星会朝错边侧身。 */
say(h.lefty===true,"哈登确实被认成左手球星(不成立则下一条是空断言)");
say(a.yawApex>0&&h.yawApex<0,
  "【本次改动】左手球星侧身方向已镜像(麦迪最高点 yaw "+a.yawApex+" > 0,哈登 "+h.yawApex+" < 0)");

if(errs.length)console.log("\n⚠ 页面报错: "+errs.slice(0,2).join(" | "));
console.log("");
if(bad){console.log("❌ 验收不通过");process.exit(1);}
console.log("✅ 三分大赛 AI 出手动作已与玩家同管线");
process.exit(0);
