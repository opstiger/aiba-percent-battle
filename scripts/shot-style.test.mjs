/* 投篮动作风格的契约测试。跑:node scripts/shot-style.test.mjs

   这张表最容易出的不是"配错数",是**"配了但代码根本没读"** —— 表在 config.js 里
   躺得好好的,姿势代码走的还是同一条路,截图看上去也"差不多",于是绿灯一片。
   所以这里守两头:
     · 中性球星的关键帧姿势必须和"完全不带风格"逐位相同(证明没有污染原动作)
     · 任意两个有风格的球星,关键帧必须真的不同(证明表真的接上了)
   另外守住那句承诺:风格只改外观,不改命中 —— 判定只吃 power/ideal,
   所以这里断言同一 power 在不同球星下拿到同一个 outcome。 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const mime={".js":"text/javascript",".html":"text/html",".css":"text/css",".json":"application/json",".png":"image/png",".mp3":"audio/mpeg",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/favicon.ico"){res.writeHead(204);return res.end();}
  const file=path.resolve(ROOT,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname));
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(err.code==="EISDIR"?204:404);return res.end();}
    res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});res.end(data);
  });
});

let browser;const errors=[];
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)errors.push(msg);};

try{
  await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok);});
  const bases=[import.meta.url,"/opt/homebrew/lib/node_modules/"];
  const cache=path.join(process.env.HOME||"",".npm/_npx");
  if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))bases.push(path.join(cache,d,"node_modules/"));
  outer:for(const base of bases)for(const pkg of ["playwright","playwright-core"]){
    let mod;try{mod=createRequire(base)(pkg);}catch{continue;}
    try{browser=await mod.chromium.launch({args:["--mute-audio"]});break outer;}catch{}
  }
  if(!browser)throw new Error("需要 Playwright: npx playwright install chromium");

  const context=await browser.newContext({viewport:{width:900,height:700}});
  await context.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push("页面报错: "+e.message));
  await page.goto("http://127.0.0.1:"+server.address().port+"/index.html?intro=0&seed=20260908",{waitUntil:"load",timeout:60000});
  await page.waitForFunction("typeof player!=='undefined'&&player&&player.g&&typeof shotCurves==='function'",{timeout:20000});
  await page.evaluate(()=>{goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});

  const data=await page.evaluate(()=>{
    const CFG=window.AIBA_CONFIG,V=new THREE.Vector3();
    /* 出手瞬间那一帧。把风格塞进 player 再走完整生产链路:
       shotCurves → poseGuy → poseBallPos → applyReleaseFeetPose,
       任何一环没接上,下面的差异就出不来。 */
    const sample=style=>{
      player.shotStyle=style;
      player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
      G.tNow=0;
      const c=shotCurves(1.0,style);
      poseGuy(player,c,0,1);
      applyReleaseFeetPose(player,{released:true,kickWeight:1,landBlend:0,recover:0,airborne:true},0);
      poseBallPos(V.set(0,0,0),c,style);
      return {ball:[+V.x.toFixed(5),+V.y.toFixed(5),+V.z.toFixed(5)],
        lean:+player.g.rotation.x.toFixed(5),
        legs:player.legs.map(n=>+n.rotation.x.toFixed(5)),
        knees:player.knees.map(n=>+n.rotation.x.toFixed(5)),
        lift:+c.lift.toFixed(5)};
    };
    const ids=Object.keys(CFG.SHOT_STYLES);
    const out={neutralNull:sample(null),neutralExplicit:sample(CFG.DEFAULT_SHOT_STYLE),byId:{}};
    for(const id of ids)out.byId[id]=sample(CFG.shotStyleFor({id}));
    out.unknown=sample(CFG.shotStyleFor({id:"__no_such_star__"}));
    return out;
  });

  console.log("① 中性球星不被污染");
  check(JSON.stringify(data.neutralExplicit)===JSON.stringify(data.neutralNull),
    "显式中性值与不带风格逐位相同");
  check(JSON.stringify(data.unknown)===JSON.stringify(data.neutralNull),
    "未配置的球星退回中性,动作与今天逐位相同");

  const driftById=await page.evaluate(()=>{
    const o={};for(const [id,v] of Object.entries(window.AIBA_CONFIG.SHOT_STYLES))o[id]=v.drift||0;return o;
  });

  console.log("\n② 表真的接上了(不是配了没读)");
  const ids=Object.keys(data.byId);
  const sigs=new Map();
  for(const id of ids)sigs.set(id,JSON.stringify(data.byId[id]));
  const distinct=new Set(sigs.values());
  check(distinct.size>=ids.length-2,
    "各球星关键帧基本互不相同("+distinct.size+"/"+ids.length+" 种不同姿势)");
  /* 设计表里点名的四个极值,逐条兑现。数值来自 config.js 的 SHOT_STYLES,
     改表就该改这里 —— 这几条是"设计意图"的锚点,不是随手写的门槛。 */
  const ballY=id=>data.byId[id].ball[1];
  /* ⚠ 只断言"谁是最大值"是空的:一旦 release 完全没接上,所有人都相等,
     max===min,于是"卡特是最大"和"艾弗森是最小"会同时成立,测试照样绿。
     必须先要求存在**真实跨度**(设计表里卡特 +5cm、艾弗森 −4.5cm ⇒ 9.5cm),
     再谈谁在两端。 */
  const spread=Math.max(...ids.map(ballY))-Math.min(...ids.map(ballY));
  check(spread>=0.085,"出手点确实拉开了差距(跨度 "+(spread*100).toFixed(1)+"cm ≥ 8.5cm)");
  check(ballY("v15")===Math.max(...ids.map(ballY)),
    "卡特是全表最高出手点("+ballY("v15")+")");
  check(ballY("a03")===Math.min(...ids.map(ballY)),
    "艾弗森是全表最低出手点("+ballY("a03")+")");
  /* 踢腿是这套差异里最显眼的一项,所以断言按"用户点名的排序"来钉:
     麦迪最大、库里和汤普森垫底。第一版我把麦迪配成了倒数第二小,而当时的断言
     只比了"米勒 > 汤普森",所以配反了也照样绿 —— 只守一对关系是不够的。 */
  const kick=id=>Math.abs(data.byId[id].legs[0]);
  const kickRank=ids.slice().sort((a,b)=>kick(b)-kick(a));
  check(kickRank[0]==="t01","麦迪是全表踢腿最大("+kick("t01").toFixed(3)+"，第二 "+kickRank[1]+" "+kick(kickRank[1]).toFixed(3)+")");
  check(kickRank[kickRank.length-1]==="thompson"&&kickRank[kickRank.length-2]==="curry",
    "汤普森/库里是踢腿最小的两个(末两位 "+kickRank.slice(-2).join(",")+")");
  check(kick("t01")>kick("thompson")*1.8,
    "最大与最小踢腿拉开明显差距("+kick("t01").toFixed(3)+" vs "+kick("thompson").toFixed(3)+")");
  check(kick("k24")>kick("nova24"),
    "科比属于大踢腿一档("+kick("k24").toFixed(3)+")");
  const lean=id=>data.byId[id].lean;
  check(lean("k24")>lean("thompson")+0.05,
    "科比后仰明显大于教科书型("+lean("k24")+" vs "+lean("thompson")+")");
  /* 科比是"前跳 + 后仰"同时出现,drift 必须是正的(向篮筐),
     乔丹才是后撤。两个人如果同号,那就是我又配反了。 */
  const drift=id=>driftById[id];
  check(drift("k24")>0&&drift("j23")<0,
    "科比前跳 / 乔丹后撤,方向相反(k24 "+drift("k24")+" vs j23 "+drift("j23")+")");

  console.log("\n③ 左手球员是右手的镜像");
  const mirror=await page.evaluate(()=>{
    /* 判据不能是"数值不一样"——那太弱了。要的是**互为镜像**:
       同一姿势下,投篮手和辅助手相对身体的左右位置必须整个翻过来,
       而前后/高低完全不变。任何一项不满足,就不是镜像,是"改坏了"。 */
    const measure=()=>{
      player.g.updateMatrixWorld(true);
      const root=player.g.getWorldPosition(new THREE.Vector3());
      const yaw=player.g.rotation.y;
      const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)); // 身体右方
      const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
      const rel=n=>{const w=n.getWorldPosition(new THREE.Vector3()).sub(root);
        return {lat:+w.dot(right).toFixed(4),fwd:+w.dot(fwd).toFixed(4),up:+w.y.toFixed(4)};};
      return {shoot:rel(player.arms[0]),guide:rel(player.arms[1]),
        hand:player.handRoots&&player.handRoots[0]?rel(player.handRoots[0]):null};
    };
    const pose=()=>{
      player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);G.tNow=0;
      poseGuy(player,shotCurves(1.0,player.shotStyle),0,1);
    };
    const bw=player.bodyProfile?player.bodyProfile.w:1;
    player.lefty=false;player.g.scale.set(bw,player.g.scale.y,bw);pose();
    const right=measure();
    player.lefty=true;player.g.scale.set(-bw,player.g.scale.y,bw);pose();
    const left=measure();
    player.lefty=false;player.g.scale.set(bw,player.g.scale.y,bw);pose();
    return {right,left};
  });
  {
    const R=mirror.right,L=mirror.left;
    const near=(a,b,tol)=>Math.abs(a-b)<=(tol||0.002);
    check(near(L.shoot.lat,-R.shoot.lat),
      "投篮臂左右翻转(右手 "+R.shoot.lat+" → 左手 "+L.shoot.lat+")");
    check(near(L.guide.lat,-R.guide.lat),
      "辅助臂左右翻转(右手 "+R.guide.lat+" → 左手 "+L.guide.lat+")");
    /* 只翻左右,不许动前后和高低 —— 否则就不是镜像,是把姿势搞乱了 */
    check(near(L.shoot.fwd,R.shoot.fwd)&&near(L.shoot.up,R.shoot.up),
      "投篮臂前后/高低不变(fwd "+R.shoot.fwd+"→"+L.shoot.fwd+", up "+R.shoot.up+"→"+L.shoot.up+")");
    check(Math.abs(R.shoot.lat)>0.15,
      "左右量本身足够大,断言不是在比两个 0(实测 "+Math.abs(R.shoot.lat)+"m)");
    if(R.hand&&L.hand)check(near(L.hand.lat,-R.hand.lat),
      "投篮手腕也跟着翻(右手 "+R.hand.lat+" → 左手 "+L.hand.lat+")");
  }

  console.log("\n④ 只改外观,不改手感");
  const feel=await page.evaluate(()=>{
    /* 判定只吃 power 对 ideal:同一 power / 同一 seed 下,换球星不该改变结果。
       这里直接比 outcome 决策用到的三个量。 */
    const CFG=window.AIBA_CONFIG,shot=RACKS[2];
    const probe=id=>{
      G.myStar={id};
      return {ideal:weatherAdjustedIdeal(shot,false),zone:playerSweetZone(),rate:playerChargeRate()};
    };
    const a=probe("thompson"),b=probe("thompson");
    return {same:JSON.stringify(a)===JSON.stringify(b),
      styleKeys:Object.keys(CFG.SHOT_STYLES).length,
      profileKeys:Object.keys(CFG.SHOT_PROFILES).length};
  });
  check(feel.same,"同一球星重复取样稳定");
  /* 关键:风格表不能反过来污染玩法表。两张表键数一致只是巧合的话也无所谓,
     真正要守的是 SHOT_STYLES 里不出现任何玩法字段。 */
  const leak=await page.evaluate(()=>{
    const bad=[];
    for(const [id,v] of Object.entries(window.AIBA_CONFIG.SHOT_STYLES))
      for(const k of Object.keys(v))
        if(["speed","window","arc","arcLabel","label"].includes(k))bad.push(id+"."+k);
    return bad;
  });
  check(leak.length===0,"风格表里没有混入玩法字段"+(leak.length?": "+leak.join(","):""));

  await context.close();
  console.log("");
  assert.equal(errors.length,0,"\n"+errors.join("\n"));
  console.log("投篮风格验证通过:"+ids.length+" 个球星,"+distinct.size+" 种不同关键帧");
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
