/* 反射验收台。跑:node scripts/reflection-check.test.mjs
   这一轮的目标不是"更亮",而是"地板上有可读的反射内容"。
   所以只回答两个问题,这两个不过,参数调得再漂亮也没用:

   ① PBR 开关必须肉眼可辨。
      关掉 PBR(?pbr=0)后木色区域亮度应明显变化。
      上一版实测 116.6 vs 116.1 —— 差 0.5 灰阶,等于清漆层根本不存在,
      那时候无论怎么调 clearcoat 都只是在给一层看不见的膜调参。

   ② 反射必须随镜头角度变化。
      同一块地板在两个机位下亮度应该不同;
      如果始终固定在地面的同一个位置,那说明是**贴上去的假灯池**,不是反射。
      这一条直接区分"环境反射"和"画上去的亮斑"。

   做法:在固定的**世界坐标点**上采样屏幕亮度,两个机位各读一次再比。 */
import fs from "node:fs";import path from "node:path";import http from "node:http";
import {fileURLToPath} from "node:url";import {createRequire} from "node:module";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".mp3":"audio/mpeg",".wav":"audio/wav",".svg":"image/svg+xml",".woff2":"font/woff2",".ttf":"font/ttf",".mjs":"text/javascript; charset=utf-8"};
const {s:server,port}=await new Promise(res=>{const s=http.createServer((rq,rs)=>{const c=decodeURIComponent(rq.url.split("?")[0]);if(c==="/favicon.ico"){rs.writeHead(204);return rs.end();}const f=path.join(ROOT,c==="/"?"/index.html":c);/* 目录请求:fs.readFile 会返回 EISDIR,真实静态服务器对目录返回索引或 403,
   不是 404。这里按 204 处理,否则 /assets/aiba-audio/voices/ 会被误报成
   "资源缺失" —— 它只是被当成文件读了而已,白白污染错误诊断。 */
fs.readFile(f,(e,b)=>{if(e){if(e.code==="EISDIR"){rs.writeHead(204);return rs.end();}rs.writeHead(404);return rs.end();}rs.writeHead(200,{"content-type":MIME[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});rs.end(b);});});s.listen(0,"127.0.0.1",()=>res({s,port:s.address().port}));});
function mods(){const out=[],seen=new Set();const push=b=>{for(const p of ["playwright","playwright-core"]){try{const m=createRequire(b)(p);if(m&&m.chromium&&!seen.has(m)){seen.add(m);out.push(m);}}catch(e){}}};push(import.meta.url);push("/opt/homebrew/lib/node_modules/");push("/usr/local/lib/node_modules/");try{const n=path.join(process.env.HOME||"","/.npm/_npx");for(const d of fs.readdirSync(n))push(path.join(n,d,"node_modules")+"/");}catch(e){}return out;}
async function measure(pbrOn){
  /* ⚠ 每个测量必须用**独立的 browser**,不能共用一个。
     同一个 browser 再开第二个 page 时,前一个 page 会变成后台标签,
     Chromium 随即把它的 requestAnimationFrame 节流到极低频率 ——
     实测开场动画时间 t 卡在 1.6 秒不再前进(需要等到 3.3 才算开场结束),
     于是两边都报"开场未启动",看起来像代码坏了,其实是 rAF 被节流。 */
  const ARGS=["--mute-audio",
              "--disable-background-timer-throttling",
              "--disable-backgrounding-occluded-windows",
              "--disable-renderer-backgrounding"];
  let b=null;
  for(const m of mods()){try{b=await m.chromium.launch({args:ARGS});break;}catch(e){}}
  if(!b){console.error("需要 Playwright: npx playwright install chromium");process.exit(2);}
  const page=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errs=[];page.on("pageerror",e=>errs.push(e.stack||e.message));
  page.on("console",m=>{if(m.type()==="error")errs.push("console.error: "+m.text());});
  /* 404 只报一句 "Failed to load resource" 是没法查的 —— 必须知道**哪个 URL**。 */
  page.on("response",r=>{if(r.status()>=400)errs.push("HTTP "+r.status()+" "+r.url());});
  await page.addInitScript(()=>{
    const orig=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(t,a){
      if(t==="webgl"||t==="webgl2"||t==="experimental-webgl")a=Object.assign({},a,{preserveDrawingBuffer:true});
      return orig.call(this,t,a);
    };
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?intro=1&fx=0${pbrOn?"":"&pbr=0"}`,{waitUntil:"commit"});
  await page.evaluate(async()=>{await fetch("scripts/silence-browser.js").then(r=>r.text()).then(eval);});
  try{
    await page.waitForFunction("window.AIBABootShot&&AIBABootShot.state().on===true",{timeout:90000,polling:"raf"});
    await page.waitForFunction("AIBABootShot.state().t>=3.3",{timeout:90000,polling:"raf"});
  }catch(e){
    console.log("!! 开场未启动("+(pbrOn?"PBR":"非PBR")+")。页面错误:");
    for(const m of errs)console.log("   "+m);
    if(!errs.length)console.log("   (无 pageerror)");
    /* 只说"未启动"没法查 —— 把页面当时的实际状态打出来,看卡在哪一步:
       BootShot 存不存在、t 走到多少、G 的状态机停在哪。 */
    const st=await page.evaluate(()=>({
      有BootShot:typeof AIBABootShot!=="undefined",
      shot:(typeof AIBABootShot!=="undefined"&&AIBABootShot.state)?AIBABootShot.state():null,
      有G:typeof G!=="undefined",
      G:(typeof G!=="undefined")?{state:G.state,mode:G.mode,running:!!G.running}:null,
      有renderer:(typeof renderer!=="undefined"),
      有scene:(typeof scene!=="undefined")
    })).catch(er=>({取状态失败:String(er).slice(0,120)}));
    console.log("   状态: "+JSON.stringify(st));
    await page.close();await b.close();return null;
  }
  const r=await page.evaluate(()=>{
    const canvas=document.querySelector("canvas");
    const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    if(!gl)return {error:"拿不到 gl"};
    const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
    const p=new Uint8Array(W*H*4);
    /* 采样点:地板上的固定世界坐标。避开线条和三秒区,取纯木色区域 */
    const cz=COURT.midZ;
    const PTS=[
      ["中圈左",new THREE.Vector3(-3.2,0,cz+2.2)],
      ["中圈右",new THREE.Vector3( 3.2,0,cz-2.2)],
      ["左翼",  new THREE.Vector3(-5.4,0,cz+5.0)],
      ["篮下",  new THREE.Vector3( 0.0,0,HOOP.z+2.6)],
      ["右底角",new THREE.Vector3( 5.6,0,COURT.farBaseline-3.2)]
    ];
    const lumAt=(sx,sy)=>{
      /* 取 3×3 中位数,避免正好采样到一条线或一个噪点 */
      const v=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const x=sx+dx,y=sy+dy;
        if(x<0||x>=W||y<0||y>=H)continue;
        const i=(y*W+x)*4;v.push(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]);
      }
      if(!v.length)return null;
      v.sort((a,b)=>a-b);return v[v.length>>1];
    };
    const readPts=()=>{
      renderer.render(scene,camera);gl.finish();
      renderer.render(scene,camera);gl.finish();
      gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
      return PTS.map(([name,wp])=>{
        const v=wp.clone().project(camera);
        /* project 的 y: +1 顶 / -1 底;readPixels 的 y: 0 底 / H 顶 */
        const sx=Math.round((v.x*0.5+0.5)*W),sy=Math.round((0.5-v.y*0.5)*H);
        return {name,l:lumAt(sx,sy)};
      });
    };
    /* 机位 A:当前转播机位(直接读现有 camera) */
    const A=readPts();
    /* 机位 B:绕球场中心转 70°、压低高度。
       同一块地板在两个机位下的**入射/反射方向全变了**:
       真反射会跟着变,画死的亮斑不会。 */
    const savedPos=camera.position.clone(),savedQ=camera.quaternion.clone();
    const R=19,ang=Math.atan2(camera.position.z-COURT.midZ,camera.position.x)+55*Math.PI/180;
    camera.position.set(Math.cos(ang)*R,3.4,COURT.midZ+Math.sin(ang)*R);
    camera.lookAt(0,1.2,COURT.midZ);
    camera.updateMatrixWorld(true);
    const B=readPts();
    camera.position.copy(savedPos);camera.quaternion.copy(savedQ);camera.updateMatrixWorld(true);
    /* ③ 环境反射贡献:把 envMap 摘掉,在**机位 A** 再读一次同样的点。
       这一项直接回答"清漆/环境反射层到底在不在起作用" ——
       上一版的病根就是摘掉它画面几乎没变化(116.6 vs 116.1)。 */
    let envOff=null;
    if(courtFloor&&courtFloor.material){
      const m=courtFloor.material,savedEnv=m.envMap;
      m.envMap=null;m.needsUpdate=true;
      envOff=readPts();
      m.envMap=savedEnv;m.needsUpdate=true;
    }
    /* 诊断:envMap 到底有没有进 shader。
       把 envMapIntensity 拉到 3 倍 —— 如果画面**毫无变化**,
       就说明环境贴图根本没参与渲染,那前面所有调 intensity 的动作全是白调。 */
    const mat=courtFloor.material;
    /* 不能只测 5 个点 —— 它们可能恰好都落在反射弱的位置。
       这里用**整片地板**的均值做消融,任何一层"没变化"都能定位问题:
       (a) 摘掉 envMap  → 不变说明贴图根本没进 shader
       (b) 强度拉到 3 倍 → 不变说明 intensity 无效 */
    const areaMean=()=>{
      renderer.render(scene,camera);gl.finish();
      renderer.render(scene,camera);gl.finish();
      gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);
      let ss=0,nn=0;
      for(let y=0;y<Math.floor(H*0.36);y+=2)for(let x=0;x<W;x+=2){
        const i=(y*W+x)*4;ss+=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];nn++;
      }
      return +(ss/nn).toFixed(2);
    };
    const envDiag={
      有envMap:!!mat.envMap,
      mapping:mat.envMap?String(mat.envMap.mapping):null,
      intensity:mat.envMapIntensity,
      PMREM_RT:(typeof arenaEnvRT!=="undefined")?!!arenaEnvRT:"n/a"
    };
    const savedEnv2=mat.envMap,savedI=mat.envMapIntensity;
    envDiag.场地均值_有env=areaMean();
    mat.envMap=null;mat.needsUpdate=true;
    envDiag.场地均值_无env=areaMean();
    mat.envMap=savedEnv2;mat.needsUpdate=true;
    mat.envMapIntensity=savedI*3;mat.needsUpdate=true;
    envDiag.场地均值_三倍强度=areaMean();
    mat.envMapIntensity=savedI;mat.needsUpdate=true;
    /* 木色区域均值:整个场地带(P99 之前的主体部分) */
    let s=0,n=0;const vals=[];
    for(let y=0;y<Math.floor(H*0.36);y+=2)for(let x=0;x<W;x+=2){
      const i=(y*W+x)*4;const l=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
      vals.push(l);s+=l;n++;
    }
    vals.sort((a,b)=>a-b);
    return {A,B,envOff,envDiag,场地均值:+(s/n).toFixed(1),
            场地中位:+vals[vals.length>>1].toFixed(1),
            材质:courtFloor?courtFloor.material.type:"?"};
  });
  await page.close();await b.close();
  if(r) r.报错=errs.length?errs.join("|"):"零报错";
  return r;
}

const on=await measure(true);
const off=await measure(false);
server.close();
if(!on||!off){process.exit(1);}

console.log("===== ① PBR 开关是否可辨 =====");
console.log("  开 PBR : 场地均值 "+on.场地均值+"  中位 "+on.场地中位+"  材质 "+on.材质);
console.log("  关 PBR : 场地均值 "+off.场地均值+"  中位 "+off.场地中位+"  材质 "+off.材质);
const dMean=+(on.场地均值-off.场地均值).toFixed(1),dMed=+(on.场地中位-off.场地中位).toFixed(1);
console.log("  差值   : 均值 "+dMean+"  中位 "+dMed+
            (Math.abs(dMed)>=3?"   → 可辨(≥3 灰阶)":"   → 偏弱,仍看不出"));

console.log("\n===== ② 反射是否随镜头变化(同一点两个机位)=====");
let moved=0,tot=0;
for(let i=0;i<on.A.length;i++){
  const a=on.A[i],b=on.B[i];
  if(a.l==null||b.l==null){console.log("  "+a.name.padEnd(6)+" 采样越界");continue;}
  const d=+(b.l-a.l).toFixed(1);
  tot++;if(Math.abs(d)>=4)moved++;
  console.log("  "+a.name.padEnd(6)+" 机位A "+a.l.toFixed(1).padStart(6)+
              "   机位B "+b.l.toFixed(1).padStart(6)+"   差 "+String(d).padStart(6)+
              (Math.abs(d)>=4?"  ← 随镜头变":""));
}
console.log("  结论: "+moved+"/"+tot+" 个点随镜头变化"+
            (moved>=Math.ceil(tot*0.6)?"  → 真反射":"  → 偏少,可能仍是固定亮斑"));
console.log("\n===== ③ 环境反射贡献(摘掉 envMap 后掉了多少)=====");
if(on.envOff){
  let sum=0,cnt=0;
  for(let i=0;i<on.A.length;i++){
    const a=on.A[i],e=on.envOff[i];
    if(a.l==null||e.l==null)continue;
    const d=a.l-e.l;sum+=d;cnt++;
    console.log("  "+a.name.padEnd(6)+" 有反射 "+a.l.toFixed(1).padStart(6)+
                "   无反射 "+e.l.toFixed(1).padStart(6)+"   贡献 "+d.toFixed(1).padStart(6));
  }
  const avg=cnt?+(sum/cnt).toFixed(1):0;
  console.log("  平均贡献 "+avg+" 灰阶"+(avg>=8?"  → 反射清晰可辨":(avg>=4?"  → 可辨但偏弱":"  → 太弱,等于没有")));
}
if(on.envDiag){
  console.log("\n===== 诊断:envMap 是否真的进了 shader =====");
  console.log("  "+JSON.stringify(on.envDiag));
}
console.log("\n报错: "+(on.报错==="零报错"&&off.报错==="零报错"?"零报错":("PBR:"+on.报错+" | 非PBR:"+off.报错)));
