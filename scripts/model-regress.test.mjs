/* 建模回归台 —— 只补 docs/MODELING_PLAN-20260908.md 交接里点名"尚未做专项回归"的三项：
     ① 四种球鞋 × 跑动（上一轮只测了 shoes-anchor 一种）
     ② 前掌件是否真的跟着脚趾弯折（改挂点最容易出现"挂上了但根本没动"）
     ③ 扣篮挂框时，抓框手的位置和新绳网之间的净空

   为什么用 A/B 而不是写死阈值：这三项都没有"绝对正确值"，只有"不能比改之前差"。
   classic 是同一套生产代码在 model=classic 下的表现，是唯一可信的基线。
   写死阈值的话，阈值本身就是我编的，测出来的绿灯没有意义。

   纪律沿用 model-detail.test.mjs：--mute-audio + 导航前注入 silence-browser.js、
   单浏览器顺序跑、finally 里关页面/进程/服务器，不碰用户自己的浏览器。 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"artifacts/model-detail-20260908");
fs.mkdirSync(OUT,{recursive:true});
const SHOES=["shoes-anchor","shoes-blaze","shoes-marathon","shoes-spring"];
const SLEEVES=["sleeve-ice","sleeve-saver","sleeve-snap","sleeve-steady"];
const BANDS=["band-focus","band-gold","band-iron","band-volt"];
/* 6mm：沿用上一轮已经确立的脚底容差，不是我新造的数字。 */
const SOLE_TOLERANCE=-0.0061;

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

let browser;const reports={},errors=[];
const check=(ok,msg)=>{console.log((ok?"  PASS  ":"  FAIL  ")+msg);if(!ok)errors.push(msg);};

try{
  await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok);});
  const bases=[import.meta.url,"/opt/homebrew/lib/node_modules/"];
  const cache=path.join(process.env.HOME||"",".npm/_npx");
  if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))bases.push(path.join(cache,d,"node_modules/"));
  const launchErrors=[];
  outer:for(const base of bases)for(const pkg of ["playwright","playwright-core"]){
    let mod;try{mod=createRequire(base)(pkg);}catch{continue;}
    try{browser=await mod.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break outer;}
    catch(e){launchErrors.push(e.message.split("\n")[0]);}
  }
  if(!browser)throw new Error("需要 Playwright: npx playwright install chromium ("+launchErrors.slice(0,2).join("; ")+")");
  const baseURL="http://127.0.0.1:"+server.address().port;

  for(const variant of ["classic","detail"]){
    const context=await browser.newContext({viewport:{width:900,height:700},deviceScaleFactor:1});
    try{
      await context.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});
      await context.addInitScript(()=>{
        let seed=917;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
        /* three 默认 preserveDrawingBuffer:false —— 不开这一项,toDataURL 拿到的是
           已经清空的缓冲,截出来一张纯黑,很容易被误读成"模型没渲染出来"。 */
        /* 冻结帧驱动。渲染和 toDataURL 是两次 evaluate,中间只要游戏循环跑过一帧,
           就会把刚摆好的机位覆盖掉 —— 截出来是"正常游戏画面",不是我要看的近景。 */
        const raf=window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame=fn=>raf(t=>{if(!window.__modelFreeze)fn(t);});
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
      });
      const page=await context.newPage();
      page.on("pageerror",e=>errors.push(variant+" 页面报错: "+e.message));
      await page.goto(baseURL+"/index.html?intro=0&seed=20260908&quality=hd&model="+variant,{waitUntil:"load",timeout:60000});
      await page.waitForFunction("typeof player!=='undefined'&&player&&player.g&&typeof poseRunCycle==='function'",{timeout:20000});
      await page.evaluate(()=>{window.__modelFreeze=true;goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();});

      const report=reports[variant]={};

      /* ① 四种球鞋 × 120 帧跑动。
         同时看两件事：脚底穿地，和"装备有没有真的跟着脚走"——后者用装备网格到
         踝关节的世界距离衡量：正常刚性挂载下这个距离只随脚/趾旋转小幅变化；
         一旦挂错父节点（挂到场景或挂到 g 根上），跑动时它会被甩出去。 */
      report.shoes=await page.evaluate(({ids})=>{
        const ankleOf=node=>{
          for(let n=node;n;n=n.parent){
            const i=player.ankles.indexOf(n);
            if(i>=0)return player.ankles[i];
          }
          return null;
        };
        const out={};
        for(const id of ids){
          AIBAEquipmentVisuals.applyShoes(player,{id,color:"#358b96"});
          const state={phase:0,runArmPhaseOffset:0,runArmPhaseWarp:0,runArmScaleA:1,runArmScaleB:1};
          player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
          let minSole=Infinity,maxDrift=0,meshCount=0,localDrift=0;
          const v=new THREE.Vector3(),av=new THREE.Vector3();
          /* 刚性挂载的判据是"局部变换不变",不是"离踝多远"。
             前掌件挂在脚趾上,脚趾一弯它离踝自然就比 classic 远一截(实测约 2.4cm),
             拿世界距离和 classic 比会把这段正常行程判成故障。 */
          const base=new Map();
          (player.gearShoeGroups||[]).forEach(g=>g.children.forEach(m=>base.set(m,m.position.clone())));
          for(let i=0;i<120;i++){
            G.tNow=i/60;
            const speed=i<80?1.6:1.6*(120-i)/40;
            poseRunCycle(player,state,speed,1/60,{sway:true,decel:i<80?0:(i-80)/40});
            player.g.updateMatrixWorld(true);
            for(const y of player.g.userData.runFootGround)if(Number.isFinite(y))minSole=Math.min(minSole,y);
            (player.gearShoeGroups||[]).forEach(grp=>{
              /* 不能按数组下标猜是哪只脚：detail 下每只脚会 push 两组(脚+趾),
                 classic 下每只脚只 push 一组,顺序完全不同。按下标配对会把左脚的
                 装备和右脚的踝比距离 —— 跑动中两脚本来就能差 0.9m,于是测出
                 一个漂亮的假红灯。改成沿父链往上找它真正属于哪只踝。 */
              const ankle=ankleOf(grp);if(!ankle)return;
              ankle.getWorldPosition(av);
              grp.children.forEach(m=>{
                m.getWorldPosition(v);maxDrift=Math.max(maxDrift,v.distanceTo(av));
                const b=base.get(m);if(b)localDrift=Math.max(localDrift,m.position.distanceTo(b));
              });
            });
          }
          (player.gearShoeGroups||[]).forEach(g=>{meshCount+=g.children.length;});
          out[id]={minSole:+minSole.toFixed(5),maxDrift:+maxDrift.toFixed(4),localDrift:+localDrift.toFixed(6),meshCount,
            parents:(player.gearShoeGroups||[]).map(g=>g.parent&&g.parent.name)};
        }
        return out;
      },{ids:SHOES});

      /* ② 前掌件跟随脚趾。
         把脚趾从 0 转到 -0.6 弧度，量两组网格的世界位移：
           挂在 toe 上的前掌件 —— 必须动
           挂在 foot 上的中底/后跟 —— 必须几乎不动
         这条断言是"变异抵抗"的关键：如果有人把挂点改回全挂 foot，第一条会红；
         如果有人把全部挂到 toe 上，第二条会红。只测"有没有挂上"是抓不到的。 */
      report.toeFollow=await page.evaluate(()=>{
        AIBAEquipmentVisuals.applyShoes(player,{id:"shoes-anchor",color:"#358b96"});
        player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
        const groups=player.gearShoeGroups||[];
        const snap=()=>{player.g.updateMatrixWorld(true);
          return groups.map(g=>({name:g.parent&&g.parent.name,
            pts:g.children.map(m=>m.getWorldPosition(new THREE.Vector3()).toArray())}));};
        player.toeRoots.forEach(t=>t.rotation.x=0);player.footRoots.forEach(f=>f.rotation.x=0);
        const a=snap();
        player.toeRoots.forEach(t=>t.rotation.x=-0.6);
        const b=snap();
        player.toeRoots.forEach(t=>t.rotation.x=0);
        const move=[];
        for(let g=0;g<a.length;g++){
          let mx=0;
          for(let i=0;i<a[g].pts.length;i++){
            const p=a[g].pts[i],q=b[g].pts[i];
            mx=Math.max(mx,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]));
          }
          move.push({parent:a[g].name,count:a[g].pts.length,maxMove:+mx.toFixed(5)});
        }
        return move;
      });

      /* ②b 护臂 × 屈肘。
         这轮 model-detail.profile(fo,.90,1) 把前臂**腕端**收到 90%、肘端不变。
         护臂是照旧粗细做的贴合件,所以真正要量的是"前臂表面退后了多少毫米",
         那就是护臂最坏情况下的悬空量 —— 而不是护臂到关节原点的距离
         (那个数随屈肘一起变,量到的是姿势不是贴合)。
         同时守两件事:护臂刚性挂载、屈肘全程不脱节。 */
      report.sleeves=await page.evaluate(({ids})=>{
        const out={};
        const fore=player.forearms&&player.forearms[0];
        for(const id of ids){
          AIBAEquipmentVisuals.applySleeve(player,{id,color:"#358b96"});
          player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
          const groups=player.gearSleeveGroups||[];
          let maxGap=0,minGap=Infinity,count=0,localDrift=0;
          const base=new Map();
          groups.forEach(g=>g.children.forEach(m=>{base.set(m,m.position.clone());count++;}));
          const v=new THREE.Vector3(),fv=new THREE.Vector3();
          for(let k=0;k<=12;k++){
            const bend=-k/12*1.9;
            player.elbows.forEach(e=>e.rotation.x=bend);
            player.g.updateMatrixWorld(true);
            if(fore)fore.getWorldPosition(fv);
            groups.forEach(g=>g.children.forEach(m=>{
              m.getWorldPosition(v);
              const d=v.distanceTo(fv);
              maxGap=Math.max(maxGap,d);minGap=Math.min(minGap,d);
              const b=base.get(m);if(b)localDrift=Math.max(localDrift,m.position.distanceTo(b));
            }));
          }
          player.elbows.forEach(e=>e.rotation.x=0);
          /* 手臂那几个节点没有 .name(只有本轮新加的 footRig/toeJoint 才有),
             所以按身份判断挂在哪根骨头上,不能按名字 —— 按名字会得到一串空串,
             看起来像"没挂上",其实挂得好好的。 */
          const boneOf=n=>{
            for(const key of ["sleeves","forearms","upperArms","elbows","arms","wrists","handRoots"]){
              const arr=player[key];if(!Array.isArray(arr))continue;
              const i=arr.indexOf(n);if(i>=0)return key+"["+i+"]";
            }
            return n===player.g?"root":(n?"other":"none");
          };
          out[id]={count,localDrift:+localDrift.toFixed(6),
            maxGap:+maxGap.toFixed(4),minGap:+(minGap===Infinity?0:minGap).toFixed(4),
            parents:groups.map(g=>boneOf(g.parent))};
        }
        /* 前臂被收束之后,护臂还贴不贴得住。
           前臂是圆角软体素:两端极点半径本来就是 0,所以既不能取"最低那一圈"
           (量到极点=0),也不能取百分比带(2 段几何在带内一个顶点都没有)。
           正确做法是先把它自己的"半径-高度"剖面列出来,再按高度插值。 */
        if(fore&&fore.geometry&&fore.geometry.attributes.position){
          const fp=fore.geometry.attributes.position,rows=new Map();
          for(let i=0;i<fp.count;i++){
            const y=+fp.getY(i).toFixed(4),r=Math.hypot(fp.getX(i),fp.getZ(i));
            rows.set(y,Math.max(rows.get(y)||0,r));
          }
          const prof=[...rows.entries()].sort((a,b)=>a[0]-b[0]);
          const radiusAt=y=>{
            if(y<=prof[0][0])return prof[0][1];
            if(y>=prof[prof.length-1][0])return prof[prof.length-1][1];
            for(let i=1;i<prof.length;i++)if(y<=prof[i][0]){
              const [y0,r0]=prof[i-1],[y1,r1]=prof[i];
              return r0+(r1-r0)*(y-y0)/Math.max(1e-9,y1-y0);
            }
            return 0;
          };
          out.__forearm={profile:prof.map(([y,r])=>[y,+(r*1000).toFixed(2)])};
          /* 每件护臂:把它自己的顶点换算到前臂局部坐标,取"最内侧顶点相对前臂表面"
             的间隙。<=0 表示还扎在手臂里(贴合);>0 表示整件已经脱开悬空。 */
          const gaps={};
          for(const id of ids){
            AIBAEquipmentVisuals.applySleeve(player,{id,color:"#358b96"});
            player.elbows.forEach(e=>e.rotation.x=0);
            player.g.updateMatrixWorld(true);fore.updateMatrixWorld(true);
            const inv=new THREE.Matrix4().copy(fore.matrixWorld).invert();
            let minGap=Infinity;
            (player.gearSleeveGroups||[]).forEach(g=>g.children.forEach(m=>{
              const mp=m.geometry&&m.geometry.attributes&&m.geometry.attributes.position;
              if(!mp)return;
              m.updateMatrixWorld(true);
              const v=new THREE.Vector3();
              for(let i=0;i<mp.count;i++){
                v.fromBufferAttribute(mp,i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
                if(v.y<prof[0][0]||v.y>prof[prof.length-1][0])continue;  // 超出前臂长度的段不算
                minGap=Math.min(minGap,Math.hypot(v.x,v.z)-radiusAt(v.y));
              }
            }));
            gaps[id]=minGap===Infinity?null:+(minGap*1000).toFixed(2);
          }
          out.__sleeveGap=gaps;
        }
        AIBAEquipmentVisuals.applySleeve(player,null);
        return out;
      },{ids:SLEEVES});

      /* 护臂近景 A/B：数值只能证明"退让了多少",看不看得出来必须看图。 */
      await page.evaluate(()=>{
        /* 默认是第一人称机位,player.g.visible=false —— 不打开就是"渲染正常但人不见了"。 */
        player.g.visible=true;if(player.groundShadow)player.groundShadow.visible=true;
        AIBAEquipmentVisuals.applySleeve(player,{id:"sleeve-snap",color:"#e2e8f0"});
        player.g.position.set(0,0,0);player.g.rotation.set(0,Math.PI*0.5,0);
        player.elbows.forEach(e=>e.rotation.x=-1.1);
        player.g.updateMatrixWorld(true);
        const fore=player.forearms[0],p=fore.getWorldPosition(new THREE.Vector3());
        camera.position.set(p.x+0.95,p.y+0.18,p.z+0.62);camera.lookAt(p);
        camera.fov=22;camera.near=0.05;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        renderer.render(scene,camera);
      });
      {
        const data=await page.evaluate(()=>renderer.domElement.toDataURL("image/png"));
        fs.writeFileSync(path.join(OUT,variant+"-sleeve-fit.png"),Buffer.from(data.split(",")[1],"base64"));
      }

      /* ②c 全套装备一起穿 + 换装。交接说"完整衣柜未做专项回归",这里只守最基本的:
         四类装备叠穿、反复换、脱下来,不能抛异常也不能把网格越堆越多(泄漏)。 */
      report.wardrobe=await page.evaluate(({shoes,sleeves,bands})=>{
        const count=()=>{let n=0;player.g.traverse(o=>{if(o.isMesh)n++;});return n;};
        /* 基线必须先脱干净再量:前面的子测试留着鞋没脱,直接量会把"有装备"当成基线,
           最后脱光反而比基线少 10 个网格,看起来像丢件,其实是量错了起点。 */
        AIBAEquipmentVisuals.applyShoes(player,null);
        AIBAEquipmentVisuals.applySleeve(player,null);
        AIBAEquipmentVisuals.applyHead(player,null);
        const before=count();const seen=[];
        for(let round=0;round<3;round++){
          for(let i=0;i<shoes.length;i++){
            AIBAEquipmentVisuals.applyShoes(player,{id:shoes[i],color:"#358b96"});
            AIBAEquipmentVisuals.applySleeve(player,{id:sleeves[i],color:"#c2410c"});
            AIBAEquipmentVisuals.applyHead(player,{id:bands[i],color:"#facc15"});
            seen.push(count());
          }
        }
        AIBAEquipmentVisuals.applyShoes(player,null);
        AIBAEquipmentVisuals.applySleeve(player,null);
        AIBAEquipmentVisuals.applyHead(player,null);
        return {before,after:count(),peak:Math.max(...seen),cycles:seen.length};
      },{shoes:SHOES,sleeves:SLEEVES,bands:BANDS});

      /* ④ 第一人称镜像有没有拿到"收束后"的前臂。
         第一人称手臂是第三人称手臂的**深拷贝**(shot-motion.js 的 buildFpRig),
         而这轮 profile() 是就地改顶点的。拷贝时机只要早于 profile,就会出现
         第三人称前臂已经收细、第一人称还是原来那根粗的 —— 同一条手臂两个视角
         两个粗细,近景一眼能看出来,而且现有 fp-arms 测试完全测不到这一条
         (它只查节点数、肘上是否可见、装备件数,不查几何)。
         判据:场景里所有名为 forearm 的网格,腕端半径必须完全一致。 */
      report.fpForearm=await page.evaluate(()=>{
        if(typeof applyCamMode==="function"){CAM.mode=0;applyCamMode();}
        for(let i=0;i<8;i++)if(typeof updPose==="function")updPose(1/60);
        const wristR=mesh=>{
          const pos=mesh.geometry&&mesh.geometry.attributes&&mesh.geometry.attributes.position;
          if(!pos)return null;
          let minY=Infinity;
          for(let i=0;i<pos.count;i++)minY=Math.min(minY,pos.getY(i));
          /* 圆角软体素最底那圈是极点(半径 0),取倒数第二圈才是真正的腕围 */
          const ys=[...new Set(Array.from({length:pos.count},(_,i)=>+pos.getY(i).toFixed(4)))].sort((a,b)=>a-b);
          const y=ys[1]!==undefined?ys[1]:ys[0];
          let r=0;
          for(let i=0;i<pos.count;i++)if(Math.abs(pos.getY(i)-y)<1e-4)r=Math.max(r,Math.hypot(pos.getX(i),pos.getZ(i)));
          return +(r*1000).toFixed(2);
        };
        const inPlayer=n=>{for(let x=n;x;x=x.parent)if(x===player.g)return true;return false;};
        const found=[];
        scene.traverse(o=>{if(o.isMesh&&o.name==="forearm")found.push({inPlayer:inPlayer(o),wristR:wristR(o)});});
        return {total:found.length,thirdPerson:found.filter(f=>f.inPlayer).map(f=>f.wristR),
          mirrored:found.filter(f=>!f.inPlayer).map(f=>f.wristR),camMode:CAM.mode};
      });

      /* ③ 扣篮挂框：抓框手的锚点和绳网的净空。
         锚点取 pregame.js 里写死的那个：V3(HOOP.x, HOOP.y+.10, HOOP.z+.26)。
         量的是"手腕锚点到最近网格顶点的距离"，classic / detail 用同一个锚点，
         所以差值就是换网带来的影响，与手部姿势无关。 */
      report.rimNet=await page.evaluate(()=>{
        const net=AIBA.runtime.service("rendering:hoop").getNet();
        if(!net)return null;
        net.updateMatrixWorld(true);
        const pos=net.geometry.attributes.position,v=new THREE.Vector3();
        const anchor=new THREE.Vector3(HOOP.x,HOOP.y+0.10,HOOP.z+0.26);
        /* 抓框手不是一个点：用腕锚点周围 ±9cm 的一圈采样点近似手掌占的体积，
           只测锚点会低估侵入（手掌比手腕宽）。 */
        const hand=[];
        for(const dx of [-0.09,0,0.09])for(const dy of [-0.05,0,0.05])for(const dz of [-0.06,0,0.06])
          hand.push(new THREE.Vector3(anchor.x+dx,anchor.y+dy,anchor.z+dz));
        let minToAnchor=Infinity,minToHand=Infinity;
        for(let i=0;i<pos.count;i++){
          v.fromBufferAttribute(pos,i).applyMatrix4(net.matrixWorld);
          minToAnchor=Math.min(minToAnchor,v.distanceTo(anchor));
          for(const h of hand)minToHand=Math.min(minToHand,v.distanceTo(h));
        }
        return {verts:pos.count,minToAnchor:+minToAnchor.toFixed(4),minToHand:+minToHand.toFixed(4)};
      });

      console.log("\n["+variant+"] "+JSON.stringify(report.rimNet));
      for(const id of SHOES)console.log("  "+id.padEnd(16),JSON.stringify(report.shoes[id]));
    }finally{await context.close();}
  }

  const a=reports.classic,b=reports.detail;

  console.log("\n① 四种球鞋 × 120 帧跑动");
  for(const id of SHOES){
    const d=b.shoes[id],c=a.shoes[id];
    check(d.minSole>=SOLE_TOLERANCE,
      id+" 脚底不穿地(最低 "+(d.minSole*1000).toFixed(2)+"mm，容差 -6.1mm)");
    check(d.minSole>=c.minSole-0.0005,
      id+" 穿地没比改前更深(detail "+(d.minSole*1000).toFixed(2)+"mm vs classic "+(c.minSole*1000).toFixed(2)+"mm)");
    /* 刚性挂载：跑动 120 帧里没有任何一件装备的局部坐标发生过变化。
       挂错父节点、被别的系统搬走、或者有人偷偷逐帧改位置，这条都会红。 */
    check(d.localDrift===0,
      id+" 装备是刚性挂载(120 帧局部位移 "+(d.localDrift*1000).toFixed(3)+"mm，必须为 0)");
    /* 世界距离只做"有没有整个飞出去"的粗筛：脚踝到脚尖约 0.2m，
       0.35m 以上说明它已经不在这只脚上了。 */
    check(d.maxDrift<0.35,
      id+" 装备仍在脚上(离踝最远 "+d.maxDrift.toFixed(3)+"m，classic "+c.maxDrift.toFixed(3)+"m)");
    check(d.meshCount===c.meshCount,
      id+" 装备件数没丢(detail "+d.meshCount+" vs classic "+c.meshCount+")");
    check(d.parents.every(p=>p==="footRig"||p==="toeJoint"),
      id+" 全部挂在脚/趾关节上(实际 "+JSON.stringify(d.parents)+")");
  }

  console.log("\n② 前掌件跟随脚趾弯折");
  {
    const toe=b.toeFollow.filter(g=>g.parent==="toeJoint");
    const foot=b.toeFollow.filter(g=>g.parent==="footRig");
    check(toe.length>0,"存在挂在 toeJoint 上的前掌件(实际 "+toe.length+" 组)");
    check(toe.every(g=>g.maxMove>0.005),
      "前掌件确实随脚趾移动(最小位移 "+(Math.min(...toe.map(g=>g.maxMove))*1000).toFixed(1)+"mm，门槛 5mm)");
    check(foot.every(g=>g.maxMove<0.0005),
      "中底/后跟不跟着脚趾动(最大位移 "+(Math.max(...foot.map(g=>g.maxMove))*1000).toFixed(2)+"mm，门槛 0.5mm)");
    const cToe=a.toeFollow.filter(g=>g.parent==="toeJoint");
    check(cToe.length===0,"classic 下没有前掌件挂到脚趾(确认这是本轮引入的行为，实际 "+cToe.length+" 组)");
  }

  console.log("\n②b 护臂 × 屈肘贴合");
  for(const id of SLEEVES){
    const d=b.sleeves[id],c=a.sleeves[id];if(!d||!c)continue;
    check(d.count>0,id+" 装上了("+d.count+" 件)");
    check(d.localDrift===0,id+" 刚性挂载(屈肘全程局部位移 "+(d.localDrift*1000).toFixed(3)+"mm)");
    check(d.parents.every(p=>p!=="none"&&p!=="root"&&p!=="other"),
      id+" 挂在手臂骨骼上(实际 "+JSON.stringify(d.parents)+")");
    check(JSON.stringify(d.parents)===JSON.stringify(c.parents),
      id+" 挂点与改前一致(detail "+JSON.stringify(d.parents)+" vs classic "+JSON.stringify(c.parents)+")");
  }
  {
    const f=b.sleeves.__forearm,cf=a.sleeves.__forearm;
    const dg=b.sleeves.__sleeveGap,cg=a.sleeves.__sleeveGap;
    if(f&&cf&&dg&&cg){
      const row=y=>{const e=cf.profile.find(r=>r[0]===y),n=f.profile.find(r=>r[0]===y);return e&&n?(e[1]-n[1]):null;};
      console.log("  前臂半径收束(mm)：" + cf.profile.map(([y])=>{
        const d=row(y);return d===null?"":y+" ↓"+d.toFixed(2);}).filter(Boolean).join("  "));
      for(const id of SLEEVES){
        const d=dg[id],c=cg[id];
        if(d===null||c===null){check(false,id+" 拿不到贴合间隙");continue;}
        console.log("    "+id.padEnd(15)+" 最内间隙 classic "+c+"mm → detail "+d+"mm  (Δ"+(d-c).toFixed(2)+"mm)");
        /* 不能用"间隙 ≤0"当判据:护臂里有一部分件骑在球衣袖子上,球衣袖本来就比裸
           前臂粗,所以它们在改动之前就是正间隙(sleeve-snap classic +24.4mm)。
           拿绝对值判会把"一直如此"报成"这轮改坏了"。
           能守住的是**增量**:前臂最多退后 7.7mm,任何护臂的间隙增加都不该超过它 ——
           超过就说明除了收束还有别的东西在把它推开。
           2~6.5mm 的退让在近景看不看得出来,交给截图,不由我编阈值。 */
        check(d-c<=8.2,id+" 间隙增量没有超过前臂收束量(Δ"+(d-c).toFixed(2)+"mm ≤ 7.7mm+余量)");
      }
    }else check(false,"拿不到前臂剖面或护臂间隙，无法评估贴合");
  }

  console.log("\n②c 四类装备叠穿 / 反复换装");
  {
    const w=b.wardrobe;
    check(w.after===w.before,"全部脱下后网格数回到原值(前 "+w.before+" 后 "+w.after+")");
    const cw=a.wardrobe;
    check(w.peak<=cw.peak*1.6,
      "叠穿峰值网格数没有失控(detail "+w.peak+" vs classic "+cw.peak+"，"+w.cycles+" 轮换装)");
  }

  console.log("\n④ 第一人称镜像前臂与第三人称一致");
  {
    const d=b.fpForearm,c=a.fpForearm;
    console.log("  detail  第三人称 "+JSON.stringify(d.thirdPerson)+"mm，镜像 "+JSON.stringify(d.mirrored)+"mm");
    console.log("  classic 第三人称 "+JSON.stringify(c.thirdPerson)+"mm，镜像 "+JSON.stringify(c.mirrored)+"mm");
    check(d.mirrored.length>0,"第一人称镜像里存在前臂("+d.mirrored.length+" 根)");
    const all=[...d.thirdPerson,...d.mirrored].filter(v=>v!==null);
    check(all.length>0&&new Set(all).size===1,
      "两个视角的前臂腕围完全一致(实测 "+JSON.stringify([...new Set(all)])+"mm)");
    check(d.thirdPerson.length&&c.thirdPerson.length&&d.thirdPerson[0]<c.thirdPerson[0],
      "detail 的前臂确实比 classic 细(detail "+d.thirdPerson[0]+"mm < classic "+c.thirdPerson[0]+"mm)");
  }

  console.log("\n③ 扣篮挂框 · 抓框手与绳网净空");
  if(!b.rimNet||!a.rimNet){
    check(false,"拿不到网格，无法评估净空");
  }else{
    console.log("  classic: "+JSON.stringify(a.rimNet));
    console.log("  detail : "+JSON.stringify(b.rimNet));
    check(b.rimNet.minToHand>0,"手掌包络没有落在网格顶点上(最近 "+(b.rimNet.minToHand*100).toFixed(1)+"cm)");
    /* 换网只允许让净空变好或基本持平；变差超过 1cm 就是新网侵入了抓框位置。 */
    check(b.rimNet.minToHand>=a.rimNet.minToHand-0.01,
      "新网没有比旧网更挤占抓框位(detail "+(b.rimNet.minToHand*100).toFixed(1)+
      "cm vs classic "+(a.rimNet.minToHand*100).toFixed(1)+"cm)");
  }

  console.log("");
  assert.equal(errors.length,0,"\n"+errors.join("\n"));
  console.log("建模回归通过：四种球鞋跑动 / 前掌件联动 / 挂框净空");
}finally{
  fs.writeFileSync(path.join(OUT,"regress.json"),JSON.stringify({reports,errors},null,2));
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
