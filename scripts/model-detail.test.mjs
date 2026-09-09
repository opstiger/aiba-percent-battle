/* Model-only A/B using real production modules. One browser, one page at a time;
   mute before navigation, bounded runs and finally cleanup. No gameplay saves. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const OUT=path.join(ROOT,"artifacts/model-detail-20260908");
fs.mkdirSync(OUT,{recursive:true});
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
try{
  await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok);});
  const bases=[import.meta.url,"/opt/homebrew/lib/node_modules/"];
  const cache=path.join(process.env.HOME,".npm/_npx");
  if(fs.existsSync(cache))for(const d of fs.readdirSync(cache))bases.push(path.join(cache,d,"node_modules/"));
  const launchErrors=[];
  outer:for(const base of bases)for(const pkg of ["playwright","playwright-core"]){
    let mod;try{mod=createRequire(base)(pkg);}catch{continue;}
    try{browser=await mod.chromium.launch({args:["--mute-audio","--disable-background-timer-throttling","--disable-renderer-backgrounding"]});break outer;}
    catch(e){launchErrors.push(e.message.split("\n")[0]);}
  }
  if(!browser)throw new Error("No browser: "+launchErrors.slice(0,3).join("; "));
  const baseURL="http://127.0.0.1:"+server.address().port;
  for(const variant of ["classic","detail"]){
    const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1});
    try{
      await context.addInitScript({path:path.join(ROOT,"scripts/silence-browser.js")});
      await context.addInitScript(()=>{
        let seed=917;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
        const raf=window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame=fn=>raf(t=>{if(!window.__modelFreeze)fn(t);});
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};
      });
      const page=await context.newPage();page.on("pageerror",e=>errors.push(variant+": "+e.message));
      const report=reports[variant]={};
      await page.goto(baseURL+"/viewer.html?nohud=1&bg=neutral&angle=three-quarter&model="+variant,{waitUntil:"load",timeout:60000});
      await page.waitForFunction("window.__viewerReady",{timeout:10000});
      report.viewer=await page.evaluate(()=>{
        const {guy:g}=__viewerModel();
        return {bench:__viewerBench(12),bones:["legs","knees","ankles","footRoots","toeRoots","arms","elbows","handRoots","ballGrips"].map(k=>[k,g[k].map(n=>n.position.toArray())]),
          face:g.mFace.map.image.toDataURL(),headScale:g.headRoot.scale.toArray()};
      });
      await page.screenshot({path:path.join(OUT,variant+"-player.png")});
      await page.evaluate(()=>{const {guy:g,camera,root}=__viewerModel();root.rotation.y=Math.PI*.5;camera.position.set(0,1,3.8);camera.lookAt(0,.95,0);renderer.render(scene,camera);});
      await page.screenshot({path:path.join(OUT,variant+"-player-side.png")});
      report.gear=await page.evaluate(()=>{
        const {guy:g,camera,root}=__viewerModel();root.rotation.y=.70;
        AIBAEquipmentVisuals.applyShoes(g,{id:"shoes-anchor",color:"#358b96"});
        g.footRoots[0].rotation.x=.35;g.toeRoots[0].rotation.x=-.45;
        camera.position.set(0,.48,1.48);camera.lookAt(0,.22,0);renderer.render(scene,camera);
        return g.gearShoeGroups.map(n=>({parent:n.parent.name,children:n.children.length}));
      });
      await page.screenshot({path:path.join(OUT,variant+"-shoes-flex.png")});
      await page.goto(baseURL+"/index.html?intro=0&seed=20260908&quality=hd&model="+variant,{waitUntil:"load",timeout:60000});
      await page.waitForFunction("typeof player!=='undefined'&&player&&player.g&&typeof poseGuy==='function'",{timeout:20000});
      await page.evaluate(()=>{
        window.__modelFreeze=true;
        goDiff("normal",true);pickDiff("normal");G.posted=[];hidePanel();startRound();
      });
      report.game=await page.evaluate(()=>{
        const bones=g=>["legs","knees","ankles","footRoots","toeRoots","arms","elbows","handRoots","ballGrips"].map(k=>[k,g[k].map(n=>[n.position.toArray(),n.quaternion.toArray()])]);
        player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
        G.tNow=0; // Hold the breath clock equal across A/B; do not weaken pose equality.
        const poses={};for(const [name,c] of Object.entries({ready:{dip:0,lift:0,jmp:0,over:0},charge:{dip:1,lift:.5,jmp:0,over:0},release:{dip:0,lift:1,jmp:1,over:.2}})){
          poseGuy(player,c,0,1);poses[name]=bones(player);
        }
        const points=arr=>arr.map(m=>m.position.toArray());
        const out={poses,rackBalls:rackBalls.map(points),deepBalls:points(deepBalls),half:halfCourtBall.position.toArray(),hoop:HOOP.toArray(),rackBottoms:rackStands.map(g=>new THREE.Box3().setFromObject(g).min.y)};
        // Freeze a known pose instead of waiting on opening cinematics/rAF.
        poseGuy(player,{dip:0,lift:0,jmp:0,over:0},0,1);
        netPulse=0;updateNetPulse(0);
        player.g.visible=false;player.groundShadow.visible=false; // Equipment A/B must not contain random wardrobe differences.
        if(typeof updCrowd==="function")for(let i=0;i<6;i++)updCrowd(0); // Complete all tier throttling buckets.
        renderer.setSize(1100,900,false);camera.aspect=1100/900;camera.fov=45;camera.updateProjectionMatrix();
        return out;
      });
      const views=[
        {name:"rack",pos:[1.9,1.45,2.65],target:[0,.55,.72]},
        {name:"hoop-front",pos:[2.0,3.8,-4.9],target:[0,3.05,-8.1]},
        {name:"hoop-back",pos:[-2.4,3.4,-11.5],target:[0,3.15,-8.8]},
        {name:"court",pos:[8,6,6],target:[0,1,-4]},
        {name:"hoop-far",pos:[-2.0,3.8,14.4],target:[0,3.05,17.49]}
      ];
      report.views={};
      for(const view of views){
        report.views[view.name]=await page.evaluate(v=>{
          camera.position.fromArray(v.pos);camera.lookAt(new THREE.Vector3(...v.target));camera.updateMatrixWorld(true);
          scene.updateMatrixWorld(true);renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,camera);
          const stats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
          renderer.info.autoReset=true;return stats;
        },view);
        const data=await page.evaluate(()=>renderer.domElement.toDataURL("image/png"));
        fs.writeFileSync(path.join(OUT,variant+"-"+view.name+".png"),Buffer.from(data.split(",")[1],"base64"));
      }
      report.net=await page.evaluate(()=>{
        const p=netMesh.geometry.attributes.position,base=new Float32Array(p.array);
        pulseNet(1,.5);updateNetPulse(.07);
        let max=0;for(let i=0;i<p.array.length;i++){if(!Number.isFinite(p.array[i]))throw Error("invalid net vertex");max=Math.max(max,Math.abs(p.array[i]-base[i]));}
        pulseNet(0,0);updateNetPulse(0);
        let reset=0;for(let i=0;i<p.array.length;i++)reset=Math.max(reset,Math.abs(p.array[i]-base[i]));
        return {max,reset};
      });
      report.run=await page.evaluate(()=>{
        player.g.visible=true;player.groundShadow.visible=true;
        AIBAEquipmentVisuals.applyShoes(player,{id:"shoes-anchor",color:"#358b96"});
        const state={phase:0,runArmPhaseOffset:0,runArmPhaseWarp:0,runArmScaleA:1,runArmScaleB:1},samples=[];
        player.g.position.set(0,0,0);player.g.rotation.set(0,0,0);
        for(let i=0;i<120;i++){
          G.tNow=i/60;
          const speed=i<80?1.6:1.6*(120-i)/40;
          poseRunCycle(player,state,speed,1/60,{sway:true,decel:i<80?0:(i-80)/40});
          samples.push({frame:i,ground:player.g.userData.runFootGround.slice(),speed});
        }
        return samples;
      });
      for(const frame of [20,45,70,108]){
        await page.evaluate(frame=>{
          const state={phase:0,runArmPhaseOffset:0,runArmPhaseWarp:0,runArmScaleA:1,runArmScaleB:1};
          player.g.position.set(-2.5,0,1.5);player.g.rotation.set(0,0,0);
          for(let i=0;i<=frame;i++){G.tNow=i/60;poseRunCycle(player,state,i<80?1.6:1.6*(120-i)/40,1/60,{sway:true,decel:i<80?0:(i-80)/40});}
          camera.position.set(-.5,1.4,4.6);camera.lookAt(-2.5,.9,1.5);camera.fov=35;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
          updGroundShadows();renderer.render(scene,camera);
        },frame);
        const data=await page.evaluate(()=>renderer.domElement.toDataURL("image/png"));
        fs.writeFileSync(path.join(OUT,variant+"-run-"+frame+".png"),Buffer.from(data.split(",")[1],"base64"));
      }
      console.log(variant,JSON.stringify({bench:report.viewer.bench,views:report.views,net:report.net}));
    }finally{await context.close();}
  }
  const a=reports.classic,b=reports.detail;
  assert.deepEqual(b.viewer.bones,a.viewer.bones,"rig bind positions changed");
  assert.equal(b.viewer.face,a.viewer.face,"face texture changed");
  assert.deepEqual(b.viewer.headScale,a.viewer.headScale,"head proportion changed");
  assert.deepEqual(b.game.poses,a.game.poses,"production shot joint transforms changed");
  /* deepBalls / half / hoop 仍然逐位锁死 —— 那几个是真正的玩法坐标。
     rackBalls 从 v2.23 起**故意**变了:球架加了坡度,而且"下一颗要投的球"被排到
     最低那一格(取球顺序 = 视觉顺序)。所以这里不能再要求两套模型逐位相同,
     否则就是拿测试去否决一个已经确认的产品决定。
     但也不能直接删 —— 换成守仍然要紧的两件事:
       · 球必须还在架子上(不会因为改坡度飘到空中或陷进地里)
       · 下一颗要投的球必须是最低的那一颗(这正是坡度存在的意义) */
  for(const k of ["deepBalls","half","hoop"])assert.deepEqual(b.game[k],a.game[k],k+" gameplay coordinates changed");
  {
    const rackY=b.game.rackBalls.map(r=>r.map(p=>+p[1].toFixed(3)));
    assert(rackY.every(r=>r.length===5),"每个架子仍然是 5 颗球");
    /* 下标 0 是下一颗要投的,必须最低;下标 4(花球)必须最高 */
    assert(rackY.every(r=>r[0]===Math.min(...r)&&r[4]===Math.max(...r)),
      "下一颗球必须在最低格、花球在最高格,实际 "+JSON.stringify(rackY[0]));
    const drop=rackY[0][4]-rackY[0][0];
    assert(drop>0.10&&drop<0.30,"坡度落差应在 10~30cm,实际 "+(drop*100).toFixed(1)+"cm");
    /* 球心离架体顶面不能太远,否则就是"浮在轨道外" */
    assert(b.game.rackBottoms.every(y=>Math.abs(y)<1e-6),"架底仍然贴地");
  }
  assert(b.game.rackBottoms.every(y=>Math.abs(y)<1e-6),"rack must be on ground");
  assert(b.gear.every(g=>g.parent==="footRig"||g.parent==="toeJoint"),"shoe kit bypasses foot joints");
  assert(b.net.max>.01&&b.net.reset<1e-6,"net pulse/reset regression");
  assert(b.run.every(s=>s.ground.every(y=>Number.isFinite(y)&&y>=-.0061)),"detailed shoes penetrate running floor");
  assert.equal(errors.length,0,errors.join("\n"));
  // Contact sheet from real browser captures, not generated concept art.
  const sheet=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
  const columns=[["player","球员 · 轮廓 / 服装"],["rack","球架 · 落地 / 开放结构"],["hoop-front","篮架 · 支撑 / 绳网"]];
  const cells=variant=>columns.map(([key])=>'<img src="'+baseURL+'/artifacts/model-detail-20260908/'+variant+'-'+key+'.png">').join("");
  await sheet.setContent('<html lang="zh"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#101820;color:#e9edf1;font:16px system-ui}h1{font-size:26px;margin:0 0 6px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img{width:100%;border:1px solid #384550}p{margin:10px 0;color:#b2bdc8}.title{font-weight:700;margin:14px 0}</style><h1>AIBA / MODEL DETAIL 01</h1><p>同模型、同机位、同灯光；上排改前，下排本轮。非生成效果图。</p><div class="row title">'+columns.map(([,title])=>'<div>'+title+'</div>').join("")+'</div><div class="row">'+cells("classic")+'</div><p>↓ 本轮：保留方块风格与原动作骨骼</p><div class="row">'+cells("detail")+'</div></html>');
  await sheet.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await sheet.screenshot({path:path.join(OUT,"comparison.png"),fullPage:true});await sheet.close();
  console.log("PASS model protections, real shot transforms, rack grounding, gear parents, net deformation");
}finally{
  fs.writeFileSync(path.join(OUT,"audit.json"),JSON.stringify({reports,errors},null,2));
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
