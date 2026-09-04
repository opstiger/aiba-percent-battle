/* 过曝归因消融台。跑:node scripts/blown-cause.test.mjs
   为什么需要它:改了地板 clearcoat(0.26→0.17 / roughness 0.24→0.45)之后
   过曝像素 20320→20419,**一动不动**。说明那块死白根本不是清漆高光,
   继续调 clearcoat 纯属瞎猜。
   这里做的是消融:逐个把可疑因素关掉,每次重数过曝像素 ——
   谁一关,过曝就塌,谁就是真凶。被测的候选:
     clearcoat      清漆镜面高光
     envMap         环境反射
     灯             直射/漫反射照明
     map(贴图)      地板纹理本身就有亮区
     toneMapping    色调映射有没有把高光压回来
   输出"塌到多少",直接读出每个因素贡献了多少过曝。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);fs.readFile(f,(e,b)=>{if(e){rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
let browser;for(const m of mods()){try{browser=await m.chromium.launch({args:["--mute-audio"]});break;}catch(e){}}
if(!browser){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}

const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errs=[];page.on("pageerror",e=>errs.push(e.stack||e.message));
await page.addInitScript(()=>{
  const orig=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,a){
    if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
    return orig.call(this,t,a);
  };
});
await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0`,{waitUntil:"commit"});
await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
try{
  await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:90000,polling:"raf"});
  await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:90000,polling:"raf"});
}catch(e){
  console.log("!! 开场未启动。页面错误:");
  for(const m of errs)console.log("   "+m);
  if(!errs.length)console.log("   (无 pageerror,可能是初始化卡住或抛在非全局作用域)");
  await browser.close();server.close();
  process.exit(1);
}

const r=await page.evaluate(()=>{
  const canvas=document.querySelector("canvas");
  const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
  if(!gl||typeof courtFloor==="undefined"||!courtFloor)return {error:"拿不到 gl 或 courtFloor"};
  const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const p=new Uint8Array(W*H*4);
  const TH=248,yTop=Math.floor(H*0.45);
  /* 数过曝像素 + 顺带记下这块的最亮值和面积,避免只看计数被"刚好卡在 248"误导 */
  const count=()=>{
    renderer.render(scene,camera);gl.finish();
    renderer.render(scene,camera);gl.finish();
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let n=0,mx=0,sum=0;
    for(let y=0;y<yTop;y++)for(let x=0;x<W;x++){
      const i=(y*W+x)*4,l=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
      if(l>mx)mx=l;
      if(l>=TH){n++;sum+=l;}
    }
    return {过曝:n,最亮:+mx.toFixed(0),过曝均值:+(n?sum/n:0).toFixed(1)};
  };
  const M=courtFloor.material;
  const snap={cc:M.clearcoat,ccr:M.clearcoatRoughness,env:M.envMap,
              envI:M.envMapIntensity,map:M.map,rough:M.roughness};
  /* 灯:arenaLights 是顶灯阵列;另外还有 ambient/hemi,一起收进来才能看"照明"总贡献 */
  const lights=[];
  scene.traverse(o=>{if(o.isLight)lights.push(o);});
  const lsnap=lights.map(l=>l.intensity);
  const out={};
  out["0 基线(当前)"]=count();

  M.clearcoat=0;M.needsUpdate=true;
  out["1 关清漆 clearcoat=0"]=count();
  M.clearcoat=snap.cc;

  M.envMap=null;M.needsUpdate=true;
  out["2 关环境反射 envMap=null"]=count();
  M.envMap=snap.env;

  M.clearcoat=0;M.envMap=null;M.needsUpdate=true;
  out["3 清漆+环境反射都关"]=count();
  M.clearcoat=snap.cc;M.envMap=snap.env;

  lights.forEach(l=>l.intensity=0);M.needsUpdate=true;
  out["4 全灯关光(只剩环境底色)"]=count();
  lights.forEach((l,i)=>l.intensity=lsnap[i]);

  /* 再单独看"贴图本身":把 map 摘掉、材质给纯白,如果这时地板反而更亮,
     说明贴图不是亮的来源,亮的是照明;如果摘掉后过曝消失,就是贴图有亮区。 */
  M.map=null;M.color=new THREE.Color(0xffffff);M.needsUpdate=true;
  out["5 摘掉贴图(纯白基底)"]=count();
  M.map=snap.map;M.color=new THREE.Color(0xffffff);M.needsUpdate=true;

  M.roughness=1;M.clearcoat=0;M.envMap=null;M.needsUpdate=true;
  out["6 全哑光(rough=1/无清漆/无反射)"]=count();
  M.roughness=snap.rough;M.clearcoat=snap.cc;M.envMap=snap.env;M.needsUpdate=true;

  out["9 复原后复测(应回到基线)"]=count();

  /* 第二阶段:逐灯消融。
     第一阶段的结论是"过曝 100% 来自灯,但清漆只占 30%" —— 剩下的 70%
     是漫反射直接被灯打爆,那就必须知道是**哪一盏**。
     逐个把单灯 intensity 归零再数过曝:谁一关,过曝塌得最狠,谁就是主犯。
     只关一盏(其余照常),因为多灯会互相补偿,全关只能证明"是灯",定位不到具体那盏。 */
  const per={};
  const base=out["9 复原后复测(应回到基线)"].过曝;
  lights.forEach((l,i)=>{
    const old=l.intensity;l.intensity=0;
    const c=count();
    /* 必须报**世界**坐标,不能只报 local:
       perf.js 的静态矩阵冻结会把 indoorRoot 下所有对象设成 matrixAutoUpdate=false,
       而 rim 正好挂在 indoorRoot 下 —— 一旦它的 matrixWorld 停在某个错误值,
       照明方向就和我们看到的 position 完全不是一回事,
       所有基于 local position 的推算(包括"余弦只有 0.24 不该过曝")都会失效。 */
    const wp=new THREE.Vector3();l.getWorldPosition(wp);
    const f=v=>v.toFixed(1);
    per["灯"+i+" "+l.type+" I="+old.toFixed(2)+
          " local@"+[f(l.position.x),f(l.position.y),f(l.position.z)].join(",")+
          " world@"+[f(wp.x),f(wp.y),f(wp.z)].join(",")]=
        {过曝:c.过曝,减少:base-c.过曝,降幅:+(((base-c.过曝)/Math.max(1,base))*100).toFixed(1)};
    l.intensity=old;
  });
  out._逐灯=per;

  /* 第三阶段:rim 强度扫描。
     rim 是背光/轮廓光,设计上只该勾人物边缘(见 core.js 的注释),
     但它俯角只有 16°(y=4.5、水平距离 15.8),是**掠射角** ——
     漫反射余弦仅 0.27,弱得几乎看不见,可 Fresnel 在掠射角趋近 1.0,
     GGX 镜面反射被拉成一条长带,正是画面上那条从左后方斜过来的过曝。
     所以这里扫它的强度:看到多低,过曝才归零。
     同时记场地整体均值 —— 一味压 rim 会把地板压暗,得知道代价。 */
  const rimL=lights.find(l=>l.isDirectionalLight&&Math.abs(l.position.y-4.5)<0.01)||
             lights.find(l=>l.isDirectionalLight);
  /* 压 rim 的代价必须量化在**角色**身上 —— 场地均值只掉 2.5% 说明它对全局照明无关紧要,
     但它是背光/轮廓光,真正的价值是勾人物边缘。所以这里单独量角色包围盒内的
     P95(≈边缘那圈高光的强度)和均值:如果 P95 掉得厉害,说明轮廓光被削没了,
     那就不能用"降强度",得改用 layers 让 rim 只照角色、不照地板。 */
  let roleBox=null;
  try{
    const g2=AIBA.runtime.service("legacy");
    const bb=new THREE.Box3().setFromObject(g2.player.g);
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(let i=0;i<8;i++){
      const v=new THREE.Vector3(i&1?bb.max.x:bb.min.x,i&2?bb.max.y:bb.min.y,i&4?bb.max.z:bb.min.z).project(camera);
      const sxg=(v.x*0.5+0.5)*W,syg=(0.5-v.y*0.5)*H;   // 转成 readPixels 的 y(下起)
      x0=Math.min(x0,sxg);x1=Math.max(x1,sxg);y0=Math.min(y0,syg);y1=Math.max(y1,syg);
    }
    roleBox={x0:Math.max(0,Math.floor(x0)),x1:Math.min(W-1,Math.ceil(x1)),
             y0:Math.max(0,Math.floor(y0)),y1:Math.min(yTop-1,Math.ceil(y1))};
  }catch(e){}
  const measureRole=()=>{
    if(!roleBox)return null;
    const vals=[];let s=0;
    for(let y=roleBox.y0;y<=roleBox.y1;y++)for(let x=roleBox.x0;x<=roleBox.x1;x++){
      const i=(y*W+x)*4;const l=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
      vals.push(l);s+=l;
    }
    if(!vals.length)return null;
    vals.sort((a,b)=>a-b);
    return {均值:+(s/vals.length).toFixed(1),
            P95:+vals[Math.floor(vals.length*0.95)].toFixed(1),
            最亮:+vals[vals.length-1].toFixed(0)};
  };
  if(rimL){
    const old=rimL.intensity;const scan={};
    for(const I of [0.46,0.38,0.30,0.24,0.18,0.12,0.06]){
      rimL.intensity=I;
      const c=count();
      /* 顺带记全场均值,看压 rim 的副作用 */
      let s=0,n=0;
      for(let y=0;y<yTop;y++)for(let x=0;x<W;x+=4){
        const i=(y*W+x)*4;s+=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];n++;
      }
      scan["rim="+I.toFixed(2)]={过曝:c.过曝,场地均值:+(s/n).toFixed(1),角色:measureRole()};
    }
    rimL.intensity=old;
    out._rim扫描=scan;
  }
  out._材质={clearcoat:M.clearcoat,clearcoatRoughness:M.clearcoatRoughness,
             roughness:M.roughness,envMapIntensity:M.envMapIntensity,
             有贴图:!!M.map,有环境贴图:!!M.envMap,灯数:lights.length,
             色调映射:renderer.toneMapping,曝光:renderer.toneMappingExposure};
  return out;
});

/* 代码改了但运行时读到的还是旧值 —— 先把"浏览器实际拿到哪份源码"钉死,
   否则一直在猜:是没刷新?还是被别处覆盖了? */
const src=await page.evaluate(async()=>{
  const txt=await fetch("src/rendering/court.js").then(r=>r.text());
  const all=txt.match(/clearcoat:\s*[\d.]+/g)||[];
  return {源码里的clearcoat:all,
          含017:/clearcoat:\s*0\.17/.test(txt),
          运行时地板clearcoat:courtFloor?courtFloor.material.clearcoat:null,
          运行时地板rough:courtFloor?courtFloor.material.clearcoatRoughness:null};
});
console.log("--- 源码 vs 运行时 ---");
console.log(JSON.stringify(src));

if(r.error){console.log("!! "+r.error);}
else{
  console.log("=== 过曝归因(画面下 45%,阈值 248)===");
  for(const [k,v] of Object.entries(r)){
    if(k==="_材质")continue;
    console.log(k.padEnd(26)+" 过曝 "+String(v.过曝).padStart(6)+
                "  最亮 "+String(v.最亮).padStart(4)+"  过曝均值 "+v.过曝均值);
  }
  if(r._逐灯){
    console.log("--- 逐灯消融(单灯归零,看谁一关过曝就塌)---");
    const rows=Object.entries(r._逐灯).sort((a,b)=>b[1].减少-a[1].减少);
    for(const [k,v] of rows)
      console.log("  "+k.padEnd(42)+" 过曝 "+String(v.过曝).padStart(6)+
                  "  减少 "+String(v.减少).padStart(6)+"  ("+v.降幅+"%)");
  }
  if(r._rim扫描){console.log("--- rim 强度扫描(过曝归零点 + 场地均值代价)---");
    for(const [k,v] of Object.entries(r._rim扫描))
      console.log("  "+k.padEnd(12)+" 过曝 "+String(v.过曝).padStart(6)+"   场地均值 "+String(v.场地均值).padStart(6)+(v.角色?("   角色 均值"+v.角色.均值+" P95="+v.角色.P95+" 最亮"+v.角色.最亮):""));}
  console.log("--- 材质/渲染器状态 ---");
  console.log(JSON.stringify(r._材质));
}
console.log(errs.length?("!! 报错:"+errs.join("|")):"零报错");
await browser.close();server.close();
