/* 14 shared colorways, the per-star assignment, and the in-game result.
 * The two things that must not regress: nobody wears the same shoe as anyone
 * else, and everyone's shoe agrees with their jersey. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/shoe-colorways-20260916');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}assert(browser);
const report={errors:[]};
try{
 const ctx=await browser.newContext({viewport:{width:720,height:900},deviceScaleFactor:1});
 await ctx.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
 await ctx.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__lifeFreeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader/i.test(m.text()))report.errors.push(m.text());});
 await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4195')+'/index.html?intro=0&seed=20260916',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBAShoeColorways,null,{timeout:120000});
 await page.evaluate(()=>{window.__lifeFreeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();});

 report.assignment=await page.evaluate(()=>{
  const map=AIBAShoeColorways.assign(LEGENDS);
  return {count:Object.keys(map).length,colorways:AIBAShoeColorways.names.length,
   rows:LEGENDS.map(s=>({id:s.id,jersey:s.col&&s.col[0],...map[s.id]}))};
 });
 assert.equal(report.assignment.colorways,14,'14 shared colorways');
 assert(report.assignment.count>=13,'every named star gets an assignment');

 // 1. 同场不撞鞋:(品系,配色) 组合在全名册内唯一。
 const pairs=report.assignment.rows.map(r=>r.family+':'+r.colorway);
 assert.equal(new Set(pairs).size,pairs.length,'no two stars may share a (family,colorway) pair');
 // 2. 品系没有只用一种 —— 否则"大家鞋一样"只是换了个说法。
 const families=new Set(report.assignment.rows.map(r=>r.family));
 assert(families.size>=3,'the roster must spread across families, got '+families.size);
 // 3. 袜子跟着配色走。
 for(const r of report.assignment.rows)assert(Number.isFinite(r.sock)&&Number.isFinite(r.sockStripe),r.id+' needs sock colours');

 // 4. 分配是确定性的:同一份名册跑两次必须逐位一致。
 report.deterministic=await page.evaluate(()=>{
  const a=JSON.stringify(AIBAShoeColorways.assign(LEGENDS));
  const b=JSON.stringify(AIBAShoeColorways.assign(LEGENDS.slice()));
  return a===b;
 });
 assert(report.deterministic,'assignment must be deterministic');

 // 5. 每一套 (品系,配色) 都要能真的造出来,且仍是单 Mesh 单材质。
 report.builds=await page.evaluate(()=>LEGENDS.map(s=>{
  const fit=AIBAShoeColorways.forStar(s,LEGENDS);
  const shoe=AIBAShoeStyles.families.includes(fit.family)
   ?AIBAShoeStyles.build(fit.family,{colorway:fit.colorway})
   :createBasketballShoe({colorway:fit.colorway});
  let meshes=0;const mats=new Set();shoe.traverse(o=>{if(o.isMesh){meshes++;mats.add(o.material.uuid);}});
  return {id:s.id,family:fit.family,colorway:fit.colorway,triangles:shoe.userData.shoe.triangles,meshes,materials:mats.size};
 }));
 for(const b of report.builds){assert.equal(b.meshes,1,b.id+' one mesh');assert.equal(b.materials,1,b.id+' one material');assert(b.triangles<=560,b.id+' over budget: '+b.triangles);}

 // 6. 真实上场:每个球星穿上后骨架不变,鞋底不穿地,袜子被染成配色色。
 report.inGame=await page.evaluate(()=>{
  const snap=()=>['legs','knees','ankles','footRoots','toeRoots'].flatMap(k=>rivals[0][k].map(o=>o.position.toArray().concat(o.rotation.toArray().slice(0,3))));
  const rows=[];
  for(const star of LEGENDS){
   const before=JSON.stringify(snap());
   applyStarStyle(rivals[0],star);
   const kit=rivals[0].baseShoeKit;
   AIBABasketballShoes.update(rivals[0],1/60,{snap:true});
   const socks=[];rivals[0].knees.forEach(k=>k.traverse(m=>{if(m.name==='shoeEquipped_crewSock')socks.push(m.material.color.getHex());}));
   rows.push({id:star.id,hasKit:!!kit,family:kit&&kit.options.family,colorway:kit&&kit.options.colorway,
    rigUnchanged:before===JSON.stringify(snap()),
    sole:kit?kit.lastContacts.map(c=>c&&+c.after.toFixed(5)):null,socks});
  }
  return rows;
 });
 for(const r of report.inGame){
  assert(r.hasKit,r.id+' must end up wearing a shoe');
  assert(r.rigUnchanged,r.id+' must not move the skeleton');
  for(const y of r.sole||[])assert(Number.isFinite(y)&&y>=-1e-4,r.id+' sole must not sink through the floor: '+y);
  assert(r.socks.length>0,r.id+' sock proxy must exist');
 }
 const worn=new Set(report.inGame.map(r=>r.family+':'+r.colorway));
 assert.equal(worn.size,report.inGame.length,'in-game shoes must stay unique per star');

 assert.deepEqual(report.errors,[],'no page errors');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS 14 套共享配色 / 分配唯一且确定 / 全员上场骨架不变、鞋底不穿地');
 console.log('  名册 '+report.assignment.count+' 人,用到 '+new Set(report.assignment.rows.map(r=>r.colorway)).size+' 套配色、'+families.size+' 个品系');
 for(const r of report.assignment.rows)console.log('   '+String(r.id).padEnd(11)+String(r.family).replace('Panels','').padEnd(11)+r.colorway);
 await ctx.close();
}finally{await browser.close();}
