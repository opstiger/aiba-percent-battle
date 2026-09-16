/* Real camera director on all eight outdoor courts: the environment may frame the
   shot, never hide it, and never sit inside a camera.

   ⚠ 旧版只对两张新场、只射 HOOP 中心 —— 那只能证明"篮筐中心可见",
   证明不了球员、手、投篮抛物线和篮板轮廓不被挡(计划 §5)。现在每个机位射 8 条线:
   篮筐中心 + 篮板四角 + 出手点 + 抛物线上三点。
   另外加两项:①任何生产机位与环境表面至少留 0.45m(近裁面之外);
   ②菜单环绕椭圆(18cos a, 8, 4.745+20 sin a)全程不得钻进几何体里 ——
   把首排立面收近之后,这条椭圆几乎是贴着屋脊飞的,必须有断言守住。 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,process.env.AIBA_QA_OUT||'artifacts/court-density-20260910');fs.mkdirSync(out,{recursive:true});
const candidates=[import.meta.url,'/opt/homebrew/lib/node_modules/'],cache=path.join(process.env.HOME,'.npm/_npx');
if(fs.existsSync(cache))for(const n of fs.readdirSync(cache))candidates.push(path.join(cache,n,'node_modules/'));
let browser;for(const c of candidates){try{browser=await createRequire(c)('playwright').chromium.launch({args:['--mute-audio']});break;}catch{}}
if(!browser)throw Error('Playwright Chromium required');
const SCENES=['outdoorSunny','rainyCourt','flowerCourt','shonanCoast','medCliff','beachSunset','arcticSnow','spanishQuarter'];
const report={},problems=[];
try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript({path:path.join(root,'scripts/silence-browser.js')});
  await context.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__freeze)f(t);});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return get.call(this,t,/webgl/.test(t)?{...a,preserveDrawingBuffer:true}:a);};});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.AIBA_QA_URL||'http://127.0.0.1:4189')+'/index.html?intro=0',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof player!=='undefined'&&player?.g&&window.AIBAWorldWonders);
  await page.evaluate(()=>{window.__freeze=true;goDiff('normal',true);pickDiff('normal');G.posted=[];hidePanel();startRound();G.state='round';G.glideCam=null;G.cutAway=null;G.battleCut=null;G.running=false;});
  for(const name of SCENES){
    const result=await page.evaluate(name=>{
      applyScenePreset(name,{persist:false});
      const solid=[];environmentRoot.traverse(o=>{if(o.isMesh&&o.material&&!o.material.transparent&&o.name!=='aibaSkyDome')solid.push(o);});
      const visible=hit=>{for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;
        return hit.object.isMesh&&!hit.object.material.transparent&&hit.object.name!=='aibaSkyDome';};
      const blockers=(from,to)=>{
        const dir=to.clone().sub(from),dist=dir.length();
        const ray=new THREE.Raycaster(from,dir.normalize(),.1,dist-.35);
        return ray.intersectObject(environmentRoot,true).filter(visible).map(h=>h.object.name);
      };
      /* 相机不能待在几何体里,也不能贴在表面上(近裁面之外)。
         ⚠ "六向短射线"只能抓住贴着表面的情况:大盒子内部离每个面都超过 0.45m 时
         它一条都打不中 —— 湘南的菜单镜头整个待在校舍里,这个探针照样报"没问题"。
         真正的包含判定要用奇偶:向下打一条长射线(双面),穿过的面数为奇 = 在体内。
         只算封闭体(排除海面/极光这类单片 Plane),否则一张平面就会把奇偶翻掉。 */
      const volumes=solid.filter(m=>m.geometry?.type!=='PlaneGeometry'&&!/Cloud|Sky|aurora/i.test(m.name));
      const DOWN=new THREE.Vector3(0,-1,0);
      const inside=from=>{
        const sides=volumes.map(m=>m.material.side);volumes.forEach(m=>{m.material.side=THREE.DoubleSide;});
        const n=new THREE.Raycaster(from,DOWN,.01,500).intersectObjects(volumes,true).filter(visible).length;
        volumes.forEach((m,i)=>{m.material.side=sides[i];});
        return n%2===1;
      };
      const AXES=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(a=>new THREE.Vector3(...a));
      const clearance=from=>{
        if(inside(from))return 0;
        const sides=solid.map(m=>m.material.side);solid.forEach(m=>{m.material.side=THREE.DoubleSide;});
        let min=Infinity;
        for(const a of AXES){
          const ray=new THREE.Raycaster(from,a,.01,.45);
          const hit=ray.intersectObjects(solid,true).filter(visible)[0];
          if(hit)min=Math.min(min,hit.distance);
        }
        solid.forEach((m,i)=>{m.material.side=sides[i];});
        return min===Infinity?null:+min.toFixed(3);
      };
      const rows=[],tight=[];
      for(let rack=0;rack<RACKS.length;rack++)for(let mode=0;mode<3;mode++){
        P.pos.copy(RACKS[rack].p);P.face=faceTo(P.pos,HOOP);P.walking=false;P.jump=0;CAM.mode=mode;applyCamMode();
        for(let i=0;i<90;i++)updateCameraDirector(1/60);
        camera.position.copy(rig.pos);camera.lookAt(rig.look);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
        // The shot itself, not just the rim: release point, three points on the arc,
        // the four backboard corners and the shooter's head.
        const release=new THREE.Vector3(P.pos.x,2.25,P.pos.z),apex=Math.max(release.y,HOOP.y)+2.1,targets=[HOOP.clone()];
        for(const t of [.25,.5,.75]){
          const p=release.clone().lerp(HOOP,t);
          p.y=release.y+(HOOP.y-release.y)*t+4*(apex-Math.max(release.y,HOOP.y))*t*(1-t);
          targets.push(p);
        }
        for(const dx of [-.92,.92])for(const dy of [-.5,.5])targets.push(new THREE.Vector3(dx,3.5+dy,HOOP.z-.06));
        targets.push(new THREE.Vector3(P.pos.x,1.72,P.pos.z));
        const obstructions=[];
        targets.forEach((t,i)=>blockers(camera.position,t).forEach(n=>obstructions.push(i+':'+n)));
        const gap=clearance(camera.position);
        rows.push({rack,mode,camera:camera.position.toArray().map(v=>+v.toFixed(2)),obstructions,clearance:gap});
        if(gap!==null)tight.push({rack,mode,gap});
      }
      // Menu orbit: the ellipse the main menu flies. Buildings may pass in front of
      // it — it must never end up inside one.
      const menu=[],orbit=environmentRoot.userData.placeState?.menuOrbit||[18,20,8,2.2];
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2,from=new THREE.Vector3(Math.cos(a)*orbit[0],orbit[2],COURT.midZ+Math.sin(a)*orbit[1]);
        const gap=clearance(from);
        menu.push({deg:Math.round(a*180/Math.PI),clearance:gap,blocked:blockers(from,new THREE.Vector3(0,orbit[3],COURT.midZ)).length});
      }
      P.pos.copy(RACKS[2].p);P.face=faceTo(P.pos,HOOP);CAM.mode=0;applyCamMode();
      for(let i=0;i<90;i++)updateCameraDirector(1/60);
      camera.position.copy(rig.pos);camera.lookAt(rig.look);camera.updateMatrixWorld(true);player.g.visible=false;
      renderer.render(scene,camera);
      return {rows,tight,menu,png:renderer.domElement.toDataURL()};
    },name);
    const blocked=result.rows.filter(r=>r.obstructions.length);
    if(blocked.length)problems.push(name+' blocks a production camera: '+JSON.stringify(blocked));
    if(result.tight.length)problems.push(name+' production camera inside/against geometry: '+JSON.stringify(result.tight));
    const menuInside=result.menu.filter(m=>m.clearance!==null);
    if(menuInside.length)problems.push(name+' menu orbit inside geometry: '+JSON.stringify(menuInside));
    fs.writeFileSync(path.join(out,name+'-first-person.png'),Buffer.from(result.png.split(',')[1],'base64'));
    report[name]={rows:result.rows,menuBlocked:result.menu.filter(m=>m.blocked).map(m=>m.deg)};
  }
  fs.writeFileSync(path.join(out,'camera-report.json'),JSON.stringify(report,null,2));
  // 一次跑完八场再报,别一红就停 —— 否则每修一处就要重跑一遍全场。
  assert.deepEqual(problems,[]);assert.deepEqual(errors,[]);
  console.log('PASS: '+SCENES.length+' courts × 5 racks × 3 production cameras × 9 sightlines (rim, arc, backboard, shooter), camera clearance, and a 24-step menu orbit');
}finally{await browser.close();}
