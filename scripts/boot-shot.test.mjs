/* 首屏第一投的端到端验证。跑:node scripts/boot-shot.test.mjs
   必须用无头浏览器:预览标签页切后台就冻结 rAF,球永远飞不完。

   验的是几条"错了首屏就翻车"的性质:
     - 点一下之后真的投出了球,而且**必定空心入网**(不能有任何失败可能)
     - 甜区没有被移动(不作弊):出手力度 == ideal
     - 音频在按下那一刻解锁,但菜单音乐**不能**提前进来(要把留白留给刷网)
     - 不点也会自动投,绝不卡死
     - 跳过随时可用
     - 只在首次跑,第二次直接进首页 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",
  ".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
function serve(){
  return new Promise(res=>{
    const s=http.createServer((rq,rs)=>{
      const clean=decodeURIComponent(rq.url.split("?")[0]);
      if(clean==="/favicon.ico"){rs.writeHead(204);return rs.end();}
      const f=path.join(ROOT,clean==="/"?"/index.html":clean);
      if(!f.startsWith(ROOT)){rs.writeHead(403);return rs.end();}
      fs.readFile(f,(e,b)=>{
        if(e){rs.writeHead(404);return rs.end();}
        rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});
        rs.end(b);
      });
    });
    s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));
  });
}
function mods(){
  const out=[],seen=new Set();
  const push=b=>{for(const p of ["playwright","playwright-core"]){
    try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};
  push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");
  try{const n=path.join(process.env.HOME||"","/.npm/_npx");
    for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}
  return out;
}
async function launch(){
  for(const m of mods()){
    try{return await m.chromium.launch();}catch(e){}
    try{return await m.chromium.launch({channel:"chrome"});}catch(e){}
  }
  console.error("需要 Playwright: npm i -g playwright && npx playwright install chromium");
  process.exit(2);
}

const {s:server,port}=await serve();
const browser=await launch();
let fail=0;
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)fail++;};

async function fresh(extra){
  const page=await browser.newPage({viewport:{width:420,height:860}});
  const errs=[];
  page.on("pageerror",e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=1${extra||""}`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);  // 非音频测试一律静音
  });
  return {page,errs};
}
/* 加载遮罩已经取消:页面一开就是首屏投篮,不需要先点任何门。 */
async function toIntro(page){
  await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:20000});
}

console.log("① 点一下 -> 必定空心入网");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  /* 开场是一段运镜:人物先从篮下走出来,站定接到球才轮到玩家。
     所以要等 phase 走到 idle 再按,直接按只会被记成 pendingFire。 */
  await page.waitForFunction("AIBABootShot.state().phase==='idle'",{timeout:20000});
  const before=await page.evaluate(()=>({state:G.state,cam:CAM.mode,
    spot:[+P.pos.x.toFixed(2),+P.pos.z.toFixed(2)],
    /* player / pBall 是顶层 const —— **不在 window 上**。写 window.pBall 拿到 undefined,
       断言就会永远是 false(G / camera 都踩过同一个坑)。只能走 runtime 服务。 */
    hasBall:(()=>{const g=AIBA.runtime.service("legacy");return !!(g.pBall&&g.pBall.visible);})(),
    bodyShown:(()=>{const g=AIBA.runtime.service("legacy");return !!(g.player&&g.player.g.visible);})(),
    menuMusic:!!(window.audioState&&audioState().menuMusic)}));
  // 记录出手力度和 ideal,验证"甜区没被移动"
  await page.evaluate(()=>{
    window.__rel=null;const o=window.doRelease;
    window.doRelease=function(){window.__rel={power:G.power,ideal:weatherAdjustedIdeal(curShot(),true)};return o.apply(this,arguments);};
  });
  await page.evaluate(()=>dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})));
  const musicDuringFlight=await page.evaluate(async()=>{
    await new Promise(r=>setTimeout(r,260));
    return !!(window.audioState&&audioState().menuMusic);
  });
  await page.waitForFunction("window.AIBABootShot.state().on===false",{timeout:12000});
  const after=await page.evaluate(()=>({state:G.state,cam:CAM.mode,balls:balls.length,
    rel:window.__rel,made:(G.shots||[]).length?!!G.shots[G.shots.length-1].made:null,
    seen:localStorage.getItem("aiba_boot_shot_seen")}));
  check(before.state==="bootshot","按下前处于 bootshot 状态");
  check(before.cam!==0,"第三人称机位(第一人称的话人物模型不渲染,走不进画面)");
  check(before.bodyShown,"人物模型已经显形");
  check(before.hasBall,"球已经在手上(空手投篮就穿帮了)");
  check(Math.abs(before.spot[0])<0.2&&Math.abs(before.spot[1])<0.3,"运镜结束时已走到弧顶 ("+before.spot.join(",")+")");
  check(!before.menuMusic,"仪式开始时菜单音乐没有提前进来");
  check(!musicDuringFlight,"球飞行途中菜单音乐仍未进来(留白给刷网)");
  check(!!after.rel,"真的调用了出手");
  check(after.rel&&Math.abs(after.rel.power-after.rel.ideal)<0.01,
    "出手力度 == ideal,甜区没被移动"+(after.rel?` (${after.rel.power} vs ${after.rel.ideal})`:""));
  check(after.state==="menu","收场后回到首页状态");
  check(after.balls===0,"首屏那颗球已清理,没带进首页");
  check(after.seen==="1","已标记看过,第二次不再跑");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n② 不点也会自动投,不卡死(但要等满 10 秒)");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  /* 两次采样:8 秒时必须还在等玩家,12 秒时必须已经自己投了。
     只测后一半的话,阈值被人改回 3 秒也照样绿。 */
  await page.waitForFunction("AIBABootShot.state().phase==='idle'",{timeout:20000});
  const auto=await page.evaluate(async()=>{
    await new Promise(r=>setTimeout(r,8000));
    const at8={on:AIBABootShot.state().on,phase:AIBABootShot.state().phase};
    await new Promise(r=>setTimeout(r,4200));
    const at12={on:AIBABootShot.state().on,phase:AIBABootShot.state().phase};
    return {at8,at12};
  });
  check(auto.at8.phase==="idle","8 秒还没到点,机会仍然留给玩家(phase="+auto.at8.phase+")");
  check(auto.at12.on===false||auto.at12.phase!=="idle","12 秒时已自动投出(phase="+auto.at12.phase+")");
  check(!errs.length,"零报错");
  await page.close();
}

console.log("\n③ 跳过随时可用");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  await page.evaluate(()=>skipBootShot());
  await page.waitForFunction("window.AIBABootShot.state().on===false",{timeout:6000});
  const st=await page.evaluate(()=>({state:G.state,seen:localStorage.getItem("aiba_boot_shot_seen"),
    bodyShown:(()=>{const g=AIBA.runtime.service("legacy");return !!(g.player&&g.player.g.visible);})(),
    glide:!!G.glideCam}));
  check(st.state==="menu","跳过后进首页");
  const later=await page.evaluate(async()=>{
    startPractice();
    for(let i=0;i<160;i++){if(G.canShoot)break;await new Promise(r=>setTimeout(r,50));}
    return {canShoot:G.canShoot};
  });
  check(later.canShoot,"跳过后能正常开一局练习");
  check(st.glide===false,"跳过后镜头控制权还给了 updPlayCam");
  check(st.seen==="1","跳过也算看过");
  check(!errs.length,"零报错");
  await page.close();
}

console.log("\n④ 加载遮罩不再挡路");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  const gate=await page.evaluate(()=>{
    const g=document.getElementById("bootLoad");
    const cs=g?getComputedStyle(g):null;const r=g?g.getBoundingClientRect():null;
    return {slim:!!(g&&g.classList.contains("slim")),
      h:r?Math.round(r.height):null,
      pe:cs?cs.pointerEvents:null,
      gateActive:window.BOOT_GATE_ACTIVE};
  });
  check(gate.slim===true,"加载指示已降级成细条");
  check(gate.h!==null&&gate.h<=6,"细条高度 "+gate.h+"px(不再是全屏面板)");
  check(gate.pe==="none","细条不拦截点击");
  check(gate.gateActive===false,"BOOT_GATE_ACTIVE 一开始就是 false");
  check(!errs.length,"零报错");
  await page.close();
}

console.log("\n⑥ 开场运镜:空镜 -> 从右侧入画 -> 落到过肩位");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  /* 按 state().t(运镜自己的帧时间)采样,不用墙钟 —— 页面加载会卡住主线程好几秒,
     用墙钟会以为运镜早就结束了。 */
  const series=await page.evaluate(async()=>{
    const out=[];
    for(let i=0;i<40;i++){
      const st=AIBABootShot.state();
      const g=AIBA.runtime.service("legacy");
      const cam=AIBA.runtime.service("rendering:core").camera;
      /* 不能用 project() 算屏幕位置:人物走到相机平面附近时 w 趋近 0,
         NDC 会炸成几十倍的假值(实测报出过 sx=3112%),断言就变成永远为真。
         改用相机空间:local.x 的正负就是左右,-local.z 是深度,深度太小直接判为"贴脸/背后"。 */
      const loc=cam.worldToLocal(new THREE.Vector3(g.P.pos.x,1.15,g.P.pos.z));
      const depth=-loc.z;
      const halfW=Math.tan(cam.fov*Math.PI/360)*cam.aspect;
      const sx=depth>0.35?50+50*(loc.x/depth)/halfW:null;
      /* 朝向偏差:P.face 和"正对篮筐"的夹角。全程必须贴近 0。 */
      let d=g.P.face-g.faceTo(g.P.pos,g.HOOP);
      while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
      out.push({t:+st.t.toFixed(2),phase:st.phase,
        cam:[+cam.position.x.toFixed(2),+cam.position.y.toFixed(2),+cam.position.z.toFixed(2)],
        fov:+cam.fov.toFixed(1),
        body:!!(g.player&&g.player.g&&g.player.g.visible),
        p:[+g.P.pos.x.toFixed(2),+g.P.pos.z.toFixed(2)],
        faceErrDeg:+Math.abs(d*180/Math.PI).toFixed(1),
        depth:+depth.toFixed(2), side:loc.x>0?"右":"左",
        sx:sx===null?null:+sx.toFixed(0),
        walking:!!g.P.walking,glide:!!G.glideCam});
      if(st.phase!=="cine"&&i>6)break;
      await new Promise(r=>setTimeout(r,120));
    }
    return out;
  });
  const early=series.filter(s=>s.t<1.0);
  const walking=series.filter(s=>s.walking);
  const settled=series[series.length-1];
  const camPath=series.slice(1).reduce((sum,s,i)=>{
    const a=series[i].cam,b=s.cam;
    return sum+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);},0);

  check(early.length>0&&early.every(s=>!s.body),
    "空镜阶段人物不渲染("+early.length+" 次采样全部未显形)");
  check(walking.length>=3,"抓到了走位过程("+walking.length+" 帧在走)");
  check(walking.every(s=>s.body),"走位全程人物是渲染着的");
  /* 这是这次返工的核心诉求:主角**始终**面向篮筐,不许先正脸对镜头再掉头。
     用 walkTo 的话最后 25% 之前朝向偏差会有 90° 以上,这条必然红。 */
  const worstFace=Math.max(...series.map(s=>s.faceErrDeg));
  check(worstFace<12,"全程面向篮筐(最大朝向偏差 "+worstFace+"°)");
  /* 入画方向:先出现在画面右半边,最后落到左半边 —— 一次横穿。 */
  const shown=series.filter(s=>s.body&&s.sx!==null);
  const firstShown=shown[0];
  check(!!firstShown&&firstShown.side==="右"&&firstShown.sx>55,
    "第一次出现在画面右侧("+(firstShown?firstShown.side+"侧 sx="+firstShown.sx+"%":"无")+")");
  check(settled.sx!==null&&settled.sx<40,"落定时在画面左侧(sx="+settled.sx+"%)");
  check(camPath>1.0,"镜头真的在动,累计位移 "+camPath.toFixed(2)+"m");
  check(Math.max(...series.map(s=>s.cam[1]))-Math.min(...series.map(s=>s.cam[1]))>0.4,
    "机位真的升起了");
  const fovs=series.map(s=>s.fov);
  check(Math.max(...fovs)-Math.min(...fovs)>2,"fov 有推近变化("+Math.min(...fovs)+"→"+Math.max(...fovs)+")");
  check(settled.cam[2]>settled.p[1]+1.4,
    "落定时机位在人物后方 "+(settled.cam[2]-settled.p[1]).toFixed(2)+"m(过肩位)");
  check(settled.cam[1]<1.9,"落定机位低于视平线 y="+settled.cam[1]+"(仰角)");
  /* 位置类断言抓不到"没接管镜头":updCine 每帧照写 rig,updPlayCam 也在写,
     打架的表现是**抖动**而不是位置错,采样点看不出来。所以直接盯住这面旗子。 */
  check(series.filter(s=>s.phase==="cine").every(s=>s.glide),
    "整段运镜期间 glideCam 一直握在手里");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n⑤ 第二次进入不再跑仪式");
{
  const page=await browser.newPage({viewport:{width:420,height:860}});
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:"load"});
  await page.evaluate(()=>{try{localStorage.setItem("aiba_boot_shot_seen","1");}catch(e){}});
  const run=await page.evaluate(()=>window.AIBABootShot?AIBABootShot.shouldRun():"没加载");
  check(run===false,"看过之后 shouldRun() 返回 false");
  await page.close();
}

console.log("\n⑦ ?new=1 当成全新玩家");
{
  const page=await browser.newPage({viewport:{width:420,height:860}});
  const errs=[];page.on("pageerror",e=>errs.push(e.message));
  // 先把"全都看过了"的状态写进去
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`,{waitUntil:"load"});
  await page.evaluate(()=>{try{
    localStorage.setItem("aiba_boot_shot_seen","1");
    localStorage.setItem("aiba_onboard_v2",JSON.stringify({welcome:1,hold:1}));
    localStorage.setItem("aiba_vision_tut_v1","1");
    localStorage.setItem("aiba-scene-preset","night");   // 玩家偏好,不该被清掉
  }catch(e){}});
  const before=await page.evaluate(()=>window.AIBABootShot?AIBABootShot.shouldRun():"没加载");
  check(before===false,"标记齐全时正常路径不跑仪式");

  await page.goto(`http://127.0.0.1:${port}/index.html?new=1`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);
  });
  const after=await page.evaluate(()=>({
    on:!!(window.AIBABootShot&&AIBABootShot.state().on),
    bootSeen:localStorage.getItem("aiba_boot_shot_seen"),
    onboard:localStorage.getItem("aiba_onboard_v2"),
    visionTut:localStorage.getItem("aiba_vision_tut_v1"),
    scene:localStorage.getItem("aiba-scene-preset")}));
  check(after.on===true,"?new=1 时仪式照跑");
  check(after.bootSeen===null,"首屏『看过』标记被清掉");
  check(after.onboard===null,"新手欢迎卡的标记也被清掉(否则它不会再出现)");
  check(after.visionTut===null,"体感教学标记也被清掉");
  /* 这条是防止手滑把清理范围扩大到玩家数据上 */
  check(after.scene==="night","场景偏好没被动(?new=1 只清引导标记,不碰玩家数据)");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n⑧ 首页不再叠第二层浮层(新手欢迎卡)");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  await page.waitForFunction("AIBABootShot.state().phase==='idle'",{timeout:20000});
  await page.evaluate(()=>dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})));
  await page.waitForFunction("AIBABootShot.state().on===false",{timeout:12000});
  // 欢迎卡是 setInterval(poll,350) 弹的,要给它足够多轮机会,不能只等一轮
  const after=await page.evaluate(async()=>{
    await new Promise(r=>setTimeout(r,1600));
    return {state:G.state,card:!!document.getElementById("obWelcome"),
      bootSeen:localStorage.getItem("aiba_boot_shot_seen")};
  });
  check(after.state==="menu","开场结束后在首页");
  check(after.bootSeen==="1","开场已标记看过");
  check(after.card===false,"投完球进首页,没有再弹欢迎卡");
  // 手动"重看新手引导"必须还能用 —— 只该拦自动弹出
  const replay=await page.evaluate(async()=>{
    AIBAOnboard.replay();
    await new Promise(r=>setTimeout(r,300));
    return !!document.getElementById("obWelcome");
  });
  check(replay===true,"玩法说明里的『重看新手引导』仍然能手动调出来");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n⑨ 没跑开场的人仍然要有欢迎卡兜底");
{
  const page=await browser.newPage({viewport:{width:420,height:860}});
  const errs=[];page.on("pageerror",e=>errs.push(e.message));
  /* ?intro=0 模拟"开场被跳过"的那类玩家(系统开了减少动效 / 省流量 / 2G)。
     他们没被教过按住蓄力那三步,卡片必须照常出现,否则等于把新手引导整个删了。 */
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`,{waitUntil:"load"});
  await page.evaluate(()=>{try{localStorage.clear();}catch(e){}});
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=0`,{waitUntil:"load"});
  await page.evaluate(async()=>{
    await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);
  });
  const got=await page.evaluate(async()=>{
    for(let i=0;i<40;i++){
      if(document.getElementById("obWelcome"))return {card:true,state:G.state};
      await new Promise(r=>setTimeout(r,200));
    }
    return {card:false,state:G.state,bootSeen:localStorage.getItem("aiba_boot_shot_seen")};
  });
  check(got.card===true,"没跑开场时欢迎卡照常出现(state="+got.state+")");
  check(!errs.length,"零报错"+(errs.length?": "+errs[0]:""));
  await page.close();
}

console.log("\n⑩ 引导提示必须跟场景绑定,不许串到首页");
{
  const {page,errs}=await fresh();
  await toIntro(page);
  await page.waitForFunction("AIBABootShot.state().phase==='idle'",{timeout:20000});
  await page.evaluate(()=>dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})));
  await page.waitForFunction("AIBABootShot.state().on===false",{timeout:12000});
  /* 这些 coach mark 由一个 350ms 的全局轮询驱动,条件只看 G 上的字段,
     不看"现在是哪个场景"。首屏那一投会写脏 G.charging / G.shots,
     于是回到首页后"甜区提示"的条件立刻成立 —— 提示就飘在首页的模式卡上面。 */
  const onMenu=await page.evaluate(async()=>{
    for(let i=0;i<12;i++){                  // 轮询 350ms 一轮,多给几轮机会
      await new Promise(r=>setTimeout(r,300));
      const el=document.getElementById("obTip");
      if(el&&el.classList.contains("on"))
        return {tip:true,text:(el.textContent||"").trim().slice(0,40),state:G.state};
    }
    let ob={};try{ob=JSON.parse(localStorage.getItem("aiba_onboard_v2")||"{}");}catch(e){}
    return {tip:false,state:G.state,marks:ob};
  });
  check(onMenu.tip===false,
    "首页没有飘出投篮提示"+(onMenu.tip?"(弹了:「"+onMenu.text+"」)":""));
  /* 开场那一投是"点一下自动蓄力",玩家并没有学会按住蓄力。
     如果这一投把 hold 这个引导标记消耗掉了,真正第一局就再也不会提示了。 */
  const marks=await page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem("aiba_onboard_v2")||"{}");}catch(e){return {};}
  });
  check(!marks.hold,"开场那一投没有把『按住蓄力』的引导标记消耗掉");
  check(!marks.sweet,"开场那一投没有把『绿色甜区』的引导标记消耗掉");
  /* 错误检查只覆盖到这里为止。下面那段会强行把 G.state 摆成 "battle",
     游戏循环里的庆祝动画更新器会去读一个没初始化的百分大战对象并抛 null ——
     那是这种测法的副作用,不是产品问题(resetBattleState 只有 startBattle 会调,
     这里根本没调到)。踩过一次同类的假警报,不再把它算进"零报错"。 */
  check(!errs.length,"真实流程零报错"+(errs.length?": "+errs[0]:""));

  /* 反向验证:加了场景闸之后,真正在场上时提示必须照常出现 ——
     否则我不是修好了乱串,而是把新手引导整个关掉了。
     onboarding 的轮询只读 G.state / G.canShoot / G.charging 这三个字段,
     所以直接摆出这三个字段就是对它最准确的测法。battleCut 置上是为了让
     game-loop 跳过 updBattle,避免去碰百分大战那一整套没初始化的状态。 */
  const inGame=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    g.G.battleCut=true;g.G.state="battle";g.G.canShoot=true;g.G.charging=false;
    for(let i=0;i<14;i++){
      await new Promise(r=>setTimeout(r,300));
      const el=document.getElementById("obTip");
      if(el&&el.classList.contains("on"))return {tip:true,text:(el.textContent||"").trim().slice(0,30)};
    }
    return {tip:false};
  });
  check(inGame.tip===true,"真正在场上时『按住蓄力』提示照常出现"+(inGame.tip?"(「"+inGame.text+"」)":""));

  // 场景一变,提示要立刻收掉,不许飘到下一幕
  const afterLeave=await page.evaluate(async()=>{
    const g=AIBA.runtime.service("legacy");
    g.G.state="menu";g.G.canShoot=false;
    for(let i=0;i<10;i++){
      await new Promise(r=>setTimeout(r,200));
      const el=document.getElementById("obTip");
      if(!el||!el.classList.contains("on"))return {gone:true,ms:(i+1)*200};
    }
    return {gone:false};
  });
  check(afterLeave.gone===true,"离开场景后提示被收掉"+(afterLeave.gone?"("+afterLeave.ms+"ms 内)":""));
  await page.close();
}

await browser.close();server.close();
console.log(fail?`\n${fail} 条失败`:"\n首屏第一投验证通过");
process.exit(fail?1:0);
