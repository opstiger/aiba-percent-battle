/* Grey-model review for the three new shoe families.
 * Renders production geometry with colour removed, so approving these images
 * approves what will actually ship — no lab-model translation step in between.
 * Nothing here is wired into index.html yet; shoe-styles.js is injected per run. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/shoe-styles-20260916');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const FAMILIES=['RetroHighPanels','StripeMidPanels','CanvasHighPanels','AirRunnerPanels'];
const LABEL={RetroHighPanels:'RetroHigh · 篮球人物剪影',StripeMidPanels:'StripeMid · 三道斜带中帮',CanvasHighPanels:'CanvasHigh · 帆布高帮',AirRunnerPanels:'AirRunner · 缓震低帮'};
/* 面数预算。RetroHigh 524 是已上线的参照,新品系不许翻倍——手机端还欠一个 400 面 LOD。 */
const BUDGET={RetroHighPanels:760,StripeMidPanels:720,CanvasHighPanels:800,AirRunnerPanels:760};
const report={errors:[],families:{}};
try{
 const ctx=await browser.newContext({viewport:{width:720,height:900},deviceScaleFactor:1});
 await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 /* 开发机常年跑满(实测 load 60~120),load 事件可以拖到几十秒。
    先等 DOM,再单独等运行时就绪,比赌一个 load 超时稳。 */
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260916',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBARetroHigh,null,{timeout:120000});
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();applyScenePreset('indoor',{persist:false});});
 await page.addScriptTag({path:path.join(root,'src/rendering/shoe-styles.js')});

 // The accepted RetroHigh must come out of this run byte-identical in structure.
 report.baseline=await page.evaluate(()=>{const s=createBasketballShoe({});return {triangles:s.userData.shoe.triangles,modules:s.userData.shoe.modules.map(m=>m.name).sort(),markTriangles:s.userData.shoe.modules.find(m=>m.name==='brandMark')?.triangles||0};});
 assert.equal(report.baseline.triangles-report.baseline.markTriangles,524,'RetroHigh base geometry must not move');
 assert(report.baseline.markTriangles>0,'RetroHigh must have the requested player silhouette');

 await page.evaluate(()=>{
  window.labScene=new THREE.Scene();labScene.background=new THREE.Color(0xd2d2d2);
  labScene.add(new THREE.HemisphereLight(0xffffff,0x8a8a8a,.95));
  const key=new THREE.DirectionalLight(0xffffff,1.15);key.position.set(-3,4,5);labScene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.42);fill.position.set(3.5,1.6,-3);labScene.add(fill);
  window.labCamera=new THREE.OrthographicCamera(-.66,.66,.44,-.20,.01,30);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:0xbcbcbc}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.name='labFloor';labScene.add(floor);
  window.labShoe=null;
  window.mountFamily=(family,flat)=>{
   if(labShoe){labScene.remove(labShoe);labShoe.traverse(o=>{if(o.isMesh&&o.geometry!==undefined&&o.material&&o.material.vertexColors){o.geometry.dispose();o.material.dispose();}});}
   const built=family==='RetroHighPanels'?createBasketballShoe({}):AIBAShoeStyles.build(family);
   AIBAShoeStyles.greyStudy(built,{flat:!!flat});
   labShoe=built;labScene.add(built);labScene.updateMatrixWorld(true);
   const mesh=built.getObjectByName('base_basketball_shoe');const g=mesh.geometry;g.computeBoundingBox();
   const size=g.boundingBox.getSize(new THREE.Vector3());
   let meshes=0,mats=new Set();built.traverse(o=>{if(o.isMesh){meshes++;mats.add(o.material.uuid);}});
   return {family,triangles:built.userData.shoe.triangles,meshes,materials:mats.size,
    length:+size.z.toFixed(4),width:+size.x.toFixed(4),height:+size.y.toFixed(4),
    modules:built.userData.shoe.modules.map(m=>({name:m.name,triangles:m.triangles})).sort((a,b)=>a.name<b.name?-1:1)};
  };
 });

 const save=async(name)=>{const data=await page.evaluate(()=>{renderer.setSize(1000,Math.round(1000*(labCamera.top-labCamera.bottom)/(labCamera.right-labCamera.left)),false);labScene.updateMatrixWorld(true);labCamera.updateMatrixWorld(true);renderer.render(labScene,labCamera);return renderer.domElement.toDataURL();});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));return name+'.png';};
 /* 正交视锥按视角分别给:45° 看过去对角线更长,沿用侧视的框会把鞋头切掉。
    [名称, 相机位置, 视线目标, 半宽, 上, 下] */
 const VIEWS=[['side',[3,.20,.24],[0,.17,.24],.66,.44,-.20],
              ['front45',[2.4,1.35,2.6],[0,.16,.22],.86,.62,-.30],
              ['rear45',[2.4,1.35,-2.4],[0,.16,.16],.86,.62,-.30],
              ['front',[0,.20,3],[0,.17,.24],.40,.44,-.20],
              ['top',[0,3,.24],[0,0,.24],.66,.34,-.34]];

 for(const family of FAMILIES){
  const info=await page.evaluate(f=>mountFamily(f,false),family);
  report.families[family]={...info,views:{},flat:{}};
  // Every family rides the same accepted last: L=1, forefoot .39 wide.
  assert(Math.abs(info.length-1)<1e-5,family+' length must stay 1');
  /* 图案是贴在表面外 PROUD(.004,L=1 尺度;换算到 L=.44 约 1.8mm)的一层贴花,
     最宽的前掌因此会把包围盒带出 2*PROUD。断言要挡的是"比例被改了",不是这层
     统一的贴花厚度 —— 所以下限仍卡死 .39,上限放到 .39+2*PROUD。 */
  const proud=await page.evaluate(()=>AIBAShoeStyles.PROUD);
  assert(info.width>=.39-1e-5&&info.width<=.39+2*proud+1e-5,
   family+' forefoot width must stay .39 (+decal '+(2*proud)+'), got '+info.width);
  assert.equal(info.meshes,1,family+' must batch into one mesh');
  assert.equal(info.materials,1,family+' must use one material');
  assert(info.triangles<=BUDGET[family],family+' over triangle budget: '+info.triangles+' > '+BUDGET[family]);
  for(const [view,pos,look,halfW,top,bottom]of VIEWS){
   await page.evaluate(([view,pos,look,halfW,top,bottom])=>{labScene.getObjectByName('labFloor').visible=view!=='top';labCamera.up.set(0,1,0);if(view==='top')labCamera.up.set(0,0,-1);
    labCamera.left=-halfW;labCamera.right=halfW;labCamera.top=top;labCamera.bottom=bottom;
    labCamera.position.set(...pos);labCamera.lookAt(...look);labCamera.updateProjectionMatrix();},[view,pos,look,halfW,top,bottom]);
   report.families[family].views[view]=await save(family.replace('Panels','')+'-'+view);
  }
  // A flat-value pass so the silhouette can be judged without panel breakup.
  await page.evaluate(f=>mountFamily(f,true),family);
  await page.evaluate(()=>{labScene.getObjectByName('labFloor').visible=true;labCamera.up.set(0,1,0);labCamera.top=.44;labCamera.bottom=-.20;labCamera.position.set(3,.20,.24);labCamera.lookAt(0,.17,.24);labCamera.updateProjectionMatrix();});
  report.families[family].flat.side=await save(family.replace('Panels','')+'-flat-side');
 }

 /* Same four families at L=.44 on a real character, so proportion is judged in context
    and not just as a floating object. Skeleton must come back untouched. */
 report.onFoot={};
 await page.evaluate(()=>{
  window.subject=rivals[0];applyStarStyle(subject,LEGENDS.find(s=>s.id==='j23'));
  labScene.add(subject.g);subject.g.visible=false;
  window.baseRig=['legs','knees','ankles','footRoots','toeRoots','arms','elbows'].flatMap(k=>subject[k].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()})));
  window.rigSnapshot=()=>['legs','knees','ankles','footRoots','toeRoots'].flatMap(k=>subject[k].map(o=>({id:o.uuid,parent:o.parent.uuid,p:o.position.toArray(),r:o.rotation.toArray(),s:o.scale.toArray()})));
 });
 for(const family of FAMILIES){
  const fit=await page.evaluate(f=>{
   if(labShoe){labScene.remove(labShoe);labShoe=null;}
   baseRig.forEach(({n,p,q,s})=>{n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);});
   subject.g.visible=true;subject.g.position.set(0,0,0);subject.g.rotation.set(0,0,0);G.tNow=0;
   const before=rigSnapshot();
   AIBABasketballShoes.clear(subject);
   const kit=AIBABasketballShoes.apply(subject,'RetroHigh',{length:.44});
   // Swap in the family under review, then repaint to the same grey study.
   kit.roots.forEach((anchor,i)=>{
    anchor.children.slice().forEach(c=>anchor.remove(c));
    const built=f==='RetroHighPanels'?createBasketballShoe({}):AIBAShoeStyles.build(f);
    AIBAShoeStyles.greyStudy(built);built.name=i===0?'right_shoe':'left_shoe';anchor.add(built);
   });
   subject.g.position.y=poseGuy(subject,{dip:0,lift:0,jmp:0,over:0},0,1);
   AIBABasketballShoes.update(subject,1/60,{snap:true});
   const after=rigSnapshot();
   /* 正交的 top/bottom 是相对视线中心的。原来 lookAt y=.20 配 bottom=-.10,
      画面下沿正好落在 y=.10 —— 鞋(y 0~.2)被切掉一半,露出来全是躯干。
      这张图唯一的用处是看鞋和小腿的比例,所以框死在脚踝上下。 */
   labCamera.left=-.34;labCamera.right=.34;labCamera.top=.47;labCamera.bottom=-.24;
   labCamera.up.set(0,1,0);labCamera.position.set(1.9,.30,2.1);labCamera.lookAt(0,.15,.02);labCamera.updateProjectionMatrix();
   labScene.updateMatrixWorld(true);
   return {rigUnchanged:JSON.stringify(before)===JSON.stringify(after),
    soleY:subject.baseShoeKit.lastContacts.map(c=>c&&+c.after.toFixed(5))};
  },family);
  assert(fit.rigUnchanged,family+' must not touch the skeleton');
  report.onFoot[family]={...fit,image:await save(family.replace('Panels','')+'-onfoot')};
 }
 report.poses=[];
 for(const pose of ['prepare','jump','land','run']){
  const result=await page.evaluate(pose=>{
   baseRig.forEach(({n,p,q,s})=>{n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);});
   let c={dip:0,lift:0,jmp:0,over:0};
   if(pose==='prepare')c={dip:1,lift:.5,jmp:0,over:0};
   if(pose==='jump')c={dip:0,lift:1,jmp:1,over:0};
   subject.g.position.y=poseGuy(subject,c,pose==='land'?1:0,1);
   if(pose==='run'){const state={phase:0,stride:0,bob:0};for(let i=0;i<24;i++)poseRunCycle(subject,state,1.6,1/60,{sway:true});}
   const before=rigSnapshot();AIBABasketballShoes.update(subject,1/60,{snap:true,grounded:pose==='jump'?false:pose==='run'?[true,false]:true});
   labCamera.top=.62;labCamera.bottom=-.25;labCamera.left=-.48;labCamera.right=.48;labCamera.updateProjectionMatrix();
   return {pose,rigUnchanged:JSON.stringify(before)===JSON.stringify(rigSnapshot()),finite:subject.baseShoeKit.lastContacts.every(c=>Number.isFinite(c.after))};
  },pose);
  // Fitting may move only the shoe anchor, never the animation rig.
  assert(result.finite);assert(result.rigUnchanged);report.poses.push({...result,image:await save('sock-'+pose)});
 }
 report.sockCoverage=await page.evaluate(()=>LEGENDS.map(star=>{
  applyStarStyle(subject,star);
  const checks=subject.knees.map(knee=>{
   const sock=knee.getObjectByName('crewSock'),skin=knee.getObjectByName('shoeEquipped_calf');
   if(!sock||!skin)return {covered:false};
   const cuff=sock.position.y+sock.geometry.parameters.height*sock.scale.y/2;
   const a=skin.geometry.attributes.position;let low=Infinity;
   for(let i=0;i<a.count;i++)low=Math.min(low,a.getY(i)*skin.scale.y+skin.position.y);
   return {covered:low>=cuff-.00601,cuff,lowestSkin:low};
  });return {id:star.id,checks};
 }));
 assert(report.sockCoverage.every(s=>s.checks.every(c=>c.covered)),'all roster skin must end at the sock cuff');
 await page.evaluate(()=>{AIBABasketballShoes.clear(subject);subject.g.visible=false;});

 assert.deepEqual(report.errors,[],'no page errors');

 /* 图名固定,重跑会原地覆盖;不带戳的话浏览器一直显示上一版,评审就白做了。 */
 const stamp='?b='+Date.now();
 const card=f=>`<section><h2>${LABEL[f]}</h2>
  <p class="meta">面数 <b>${report.families[f].triangles}</b> / 预算 ${BUDGET[f]} &nbsp;·&nbsp; ${report.families[f].meshes} Mesh / ${report.families[f].materials} 材质 &nbsp;·&nbsp; L=${report.families[f].length} 宽=${report.families[f].width} 高=${report.families[f].height}</p>
  <div class="row">${Object.entries(report.families[f].views).map(([v,src])=>`<figure><a href="${src}${stamp}" target="_blank"><img src="${src}${stamp}"></a><figcaption>${v}</figcaption></figure>`).join('')}</div>
  <div class="row"><figure><a href="${report.families[f].flat.side}${stamp}" target="_blank"><img src="${report.families[f].flat.side}${stamp}"></a><figcaption>纯轮廓(单色)</figcaption></figure><figure><a href="${report.onFoot[f].image}${stamp}" target="_blank"><img src="${report.onFoot[f].image}${stamp}"></a><figcaption>上脚 L=.44</figcaption></figure></div>
  <details><summary>面片分区 (${report.families[f].modules.length} 个)</summary><p class="mods">${report.families[f].modules.map(m=>m.name+' '+m.triangles).join(' · ')}</p></details>
 </section>`;
 fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><meta charset="utf-8"><title>球鞋四品系 · 灰模评审</title>
<style>body{background:#1b1b1d;color:#e9e9ec;font:14px/1.6 -apple-system,"PingFang SC",sans-serif;margin:0;padding:28px 32px 60px}
h1{font-size:22px;margin:0 0 4px}p.sub{color:#9a9aa2;margin:0 0 26px}
section{border-top:1px solid #33343a;padding:20px 0 6px}h2{font-size:17px;margin:0 0 4px}
p.meta{color:#9a9aa2;margin:0 0 12px;font-size:12.5px}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
figure{margin:0}img{width:246px;background:#d2d2d2;border-radius:5px;display:block}
figcaption{color:#8b8b93;font-size:11.5px;padding-top:4px;text-align:center}
details{margin:6px 0 0}summary{cursor:pointer;color:#9a9aa2;font-size:12.5px}
p.mods{color:#7d7d86;font-size:11.5px;word-break:break-all;margin:6px 0 0}
.note{background:#232428;border-left:3px solid #6f7580;padding:12px 16px;margin:18px 0 8px;color:#b9b9c2;font-size:13px}</style>
<h1>球鞋四品系 · 灰模评审</h1>
<p class="sub">生成于 ${new Date().toISOString().slice(0,16).replace('T',' ')} &nbsp;·&nbsp; 全部使用已验收 L=1 鞋楦(前掌 .39 / 中足 .30 / 后跟 .32 / 脚头 .17 / 脚背 .29)</p>
<div class="note">这是<b>本地实际几何</b>的去色评审稿，先检查鞋型、图案边界及袜口。<br>
图案更新：三条平行四边形、白圈星形与六角折线、勾形、篮球人物剪影。发布面数优化仍待。<br>
本轮为本地修改后的实际鞋模型：侧面装饰贴合真实曲面，袜口以下皮肤裁切。未发布，等待外观验收。</div>
${FAMILIES.map(card).join('\n')}<section><h2>袜口动作检查 · 低帮鞋</h2><div class="row">${report.poses.map(p=>`<figure><a href="${p.image}${stamp}" target="_blank"><img src="${p.image}${stamp}"></a><figcaption>${p.pose}</figcaption></figure>`).join('')}</div></section>`);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS 四品系灰模：同一鞋楦 / 单 Mesh 单材质 / 面数在预算内 / 骨架未变');
 console.log('评审页 '+path.relative(root,path.join(out,'review.html')));
 for(const f of FAMILIES)console.log('  '+f.replace('Panels','').padEnd(12)+report.families[f].triangles+' 面');
 await ctx.close();
}finally{await browser.close();}
