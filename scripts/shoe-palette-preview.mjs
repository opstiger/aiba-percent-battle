/* Grey-model review for the three new shoe families.
 * Renders production geometry with colour removed, so approving these images
 * approves what will actually ship — no lab-model translation step in between.
 * Nothing here is wired into index.html yet; shoe-styles.js is injected per run. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/shoe-palette-preview-20260916');fs.mkdirSync(out,{recursive:true});
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

 const palettes=[
  {id:'mono',label:'01 · 黑白灰',main:0x252932,accent:0x8a9097,light:0xf0eee7,dark:0x171a20},
  {id:'red',label:'02 · 经典红黑',main:0xad292b,accent:0x241d22,light:0xf0e9df,dark:0x201c20},
  {id:'blue',label:'03 · 海军蓝奶油',main:0x234573,accent:0xc99b50,light:0xf1e5ce,dark:0x142238},
  {id:'green',label:'04 · 森林绿米白',main:0x315b47,accent:0xc2a17b,light:0xeee9d9,dark:0x1b3028}
 ];
 await page.evaluate(palettes=>{
  window.labScene=new THREE.Scene();labScene.background=new THREE.Color(0xd2d2d2);
  labScene.add(new THREE.HemisphereLight(0xffffff,0x8a8a8a,.95));
  const key=new THREE.DirectionalLight(0xffffff,1.15);key.position.set(-3,4,5);labScene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.42);fill.position.set(3.5,1.6,-3);labScene.add(fill);
  window.labCamera=new THREE.OrthographicCamera(-.72,.72,.52,-.30,.01,30);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:0xbcbcbc}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;labScene.add(floor);
  window.labShoe=null;window.subject=rivals[0];applyStarStyle(subject,LEGENDS.find(s=>s.id==='j23'));
  labScene.add(subject.g);subject.g.visible=false;
  window.paletteNames={};
  for(const family of ['RetroHighPanels',...AIBAShoeStyles.families])for(const p of palettes){
   const canvas=family==='CanvasHighPanels',air=family==='AirRunnerPanels',stripe=family==='StripeMidPanels';
   const name='preview_'+family+'_'+p.id;
   AIBARetroHigh.registerColorway(name,{
    outsole:p.dark,outsoleEdge:p.dark,midsole:p.light,foxingTape:p.light,
    toeBox:p.light,toeCap:p.main,toeBumper:p.light,shellToe:p.light,mudguard:p.main,
    quarterPanel:canvas?p.main:p.light,stripePanel:p.main,sidePatch:0xf1eee5,
    airWindow:p.accent,heelCounter:p.main,heelClip:p.main,collar:p.main,tongue:p.dark,
    eyestay:p.main,laceBlock:canvas?p.light:p.dark,brandMark:canvas?p.dark:air?p.main:p.dark
   });paletteNames[family+'_'+p.id]=name;
  }
 },palettes);
 const rows=[];
 const save=async name=>{const data=await page.evaluate(()=>{
  renderer.setSize(1000,Math.round(1000*(labCamera.top-labCamera.bottom)/(labCamera.right-labCamera.left)),false);
  labScene.updateMatrixWorld(true);labCamera.updateMatrixWorld(true);renderer.render(labScene,labCamera);return renderer.domElement.toDataURL();
 });fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));return name+'.png';};
 for(const family of FAMILIES)for(const p of palettes){
  const id=family.replace('Panels','')+'-'+p.id;
  const info=await page.evaluate(({family,p})=>{
   subject.g.visible=false;if(labShoe)labScene.remove(labShoe);
   const name=paletteNames[family+'_'+p.id];
   labShoe=family==='RetroHighPanels'?createBasketballShoe({colorway:name}):AIBAShoeStyles.build(family,{colorway:name});labScene.add(labShoe);
   const original=family==='RetroHighPanels'?createBasketballShoe({}):AIBAShoeStyles.build(family);
   const a=original.children[0].geometry.attributes.position.array,b=labShoe.children[0].geometry.attributes.position.array;
   return {sameGeometry:a.length===b.length&&a.every((v,i)=>v===b[i]),triangles:labShoe.userData.shoe.triangles};
  },{family,p});assert(info.sameGeometry);
  const row={family,palette:p.id,label:p.label,...info};
  for(const view of ['front45','side','onfoot']){
   await page.evaluate(({view,family,p})=>{
    labCamera.up.set(0,1,0);
    if(view==='onfoot'){
     labScene.remove(labShoe);subject.g.visible=true;
     AIBABasketballShoes.apply(subject,'RetroHigh',{family,colorway:paletteNames[family+'_'+p.id],sock:p.light,sockStripe:p.main});
     subject.g.position.set(0,0,0);subject.g.rotation.set(0,0,0);subject.g.position.y=poseGuy(subject,{dip:0,lift:0,jmp:0,over:0},0,1);
     AIBABasketballShoes.update(subject,1/60,{snap:true});
     labCamera.left=-.34;labCamera.right=.34;labCamera.top=.47;labCamera.bottom=-.24;
     labCamera.position.set(1.9,.30,2.1);labCamera.lookAt(0,.15,.02);
    }else{
     labCamera.left=-.69;labCamera.right=.69;labCamera.top=.43;labCamera.bottom=-.24;
     if(view==='side'){labCamera.position.set(3,.20,.24);labCamera.lookAt(0,.17,.24);}
     else{labCamera.left=-.78;labCamera.right=.78;labCamera.top=.52;labCamera.bottom=-.34;labCamera.position.set(2.4,1.35,2.6);labCamera.lookAt(0,.16,.22);}
    }labCamera.updateProjectionMatrix();
   },{view,family,p});row[view]=await save(id+'-'+view);
  }rows.push(row);
 }
 assert.deepEqual(report.errors,[]);report.rows=rows;
 const labels={RetroHighPanels:'AJ / RetroHigh · 人物剪影',StripeMidPanels:'StripeMid · 平行三条杠',CanvasHighPanels:'Canvas · 星与折角',AirRunnerPanels:'AirRunner · 勾形'};
 const stamp=Date.now();
 fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>球鞋 · 四组配色预览</title>
 <style>*{box-sizing:border-box}body{margin:0;background:#17191d;color:#eee;font:15px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif}header,main{max-width:1500px;margin:auto;padding:26px}h1{font-size:26px;margin:0}p{color:#abb0bb;margin:8px 0}nav{position:sticky;top:0;background:#17191df5;padding:14px 26px;z-index:2;border-bottom:1px solid #333;display:flex;gap:10px;flex-wrap:wrap}button{background:#303640;color:#eee;border:1px solid #515967;padding:9px 18px;border-radius:8px;cursor:pointer}button.active{background:#eee;color:#17191d}section{margin-bottom:35px}h2{font-size:20px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}article{border:1px solid #373c45;border-radius:12px;overflow:hidden;background:#23272e}img{width:100%;display:block;background:#d2d2d2;aspect-ratio:1.8;object-fit:contain}body.onfoot img{aspect-ratio:.96}h3{font-size:15px;padding:12px;margin:0}.swatch{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){header,main{padding:16px}.grid{grid-template-columns:1fr}}</style>
 <header><h1>球鞋 · 四组配色预览</h1><p>四款已确认灰模 × 黑白灰 / 红黑 / 海军蓝奶油 / 森林绿米白。点击图片放大查看。</p><p>本页为配色试穿稿，鞋型与图案保持一致；袜筒用浅色，袜口条纹呼应鞋色。</p></header>
 <nav><button class="active" data-view="front45">前侧 45°</button><button data-view="side">正侧面 · 看图案</button><button data-view="onfoot">上脚 · 看鞋袜搭配</button></nav><main>
 ${FAMILIES.map(f=>`<section><h2>${labels[f]}</h2><div class="grid">${rows.filter(r=>r.family===f).map(r=>{const p=palettes.find(p=>p.id===r.palette);return `<article><a target="_blank" href="${r.front45}?v=${stamp}"><img alt="${labels[f]} ${r.label}" src="${r.front45}?v=${stamp}" data-front45="${r.front45}?v=${stamp}" data-side="${r.side}?v=${stamp}" data-onfoot="${r.onfoot}?v=${stamp}"></a><h3><span class="swatch" style="background:#${p.main.toString(16).padStart(6,'0')}"></span>${r.label}</h3></article>`;}).join('')}</div></section>`).join('')}
 </main><script>for(const b of document.querySelectorAll('button'))b.onclick=()=>{document.body.classList.toggle('onfoot',b.dataset.view==='onfoot');document.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('img').forEach(img=>{img.src=img.dataset[b.dataset.view];img.parentElement.href=img.src;});};</script></html>`);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS 16 palette variants / identical geometry / 48 renders / no browser errors');
 await ctx.close();
}finally{await browser.close();}
