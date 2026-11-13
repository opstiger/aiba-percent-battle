/* 浏览器里验证 tripo 皮套用的测试支架(只给自动化验证用,不被游戏加载)。
   用法:进游戏页后注入这个脚本,再 await __H.boot()。全程静音、接管帧驱动(固定 1/30 秒一帧)。 */
(function(){
  AudioContext.prototype.resume=()=>Promise.resolve();
  HTMLMediaElement.prototype.play=()=>Promise.resolve();
  document.querySelectorAll("audio,video").forEach(a=>{a.muted=true;a.pause();});
  if(window.speechSynthesis){speechSynthesis.cancel();speechSynthesis.speak=()=>{};}
  const mute=()=>{try{if(typeof AC!=="undefined"&&AC)AC.suspend();}catch(e){}};
  const H=window.__H={err:null};
  H.step=n=>{for(let i=0;i<(n||1);i++){try{window.animate();}catch(e){H.err=String(e.stack||e).slice(0,300);}}};
  /* 游戏里有些流程靠真实时间的定时器(取球、传球),同步连跑帧不会触发,要用这个带等待的版本 */
  H.astep=async n=>{for(let i=0;i<(n||1);i++){H.step(1);await new Promise(r=>setTimeout(r,6));}};
  H.until=(fn,max)=>{let g=0;while(!fn()&&g++<(max||1500))H.step(1);return g;};
  H.boot=async function(){
    window.requestAnimationFrame=function(){return 0;};
    const core=H.core=AIBA.runtime.service("rendering:core"),loop=AIBA.runtime.service("core:game-loop");
    H.R=core.renderer;loop.clock.getDelta=()=>0.0333;
    const img=H.img=document.createElement("img");
    img.style.cssText="position:fixed;inset:0;width:100%;height:100%;z-index:99999;object-fit:contain;background:#000;pointer-events:none";
    document.body.appendChild(img);
    H.practice();
    for(let i=0;i<40&&!(window.AIBATripo&&AIBATripo.root)&&!(window.AIBATripo&&AIBATripo.failed);i++){H.step(1);await new Promise(r=>setTimeout(r,250));}
    H.until(()=>G.canShoot&&!P.walking&&!G.moving&&!(G.passCatch&&G.passCatch.active));H.step(20);
    return H.info();
  };
  H.practice=()=>{startPractice();mute();setCameraMode(1,{silent:true});};
  H.ready=()=>{H.until(()=>G.canShoot&&!P.walking&&!G.moving&&!(G.passCatch&&G.passCatch.active),2000);H.step(20);if(!G.canShoot){H.practice();H.until(()=>G.canShoot&&!P.walking&&!G.moving&&!(G.passCatch&&G.passCatch.active),2000);H.step(20);}};
  H.info=()=>({ac:typeof AC!=="undefined"&&AC?AC.state:null,gs:G.state,canShoot:G.canShoot,cam:CAM.mode,ready:!!(window.AIBATripo&&AIBATripo.ready),
    errs:window.AIBATripo&&AIBATripo.errors,err:String(window.AIBATripo&&AIBATripo.lastError&&(AIBATripo.lastError.stack||AIBATripo.lastError)||"").slice(0,300),stepErr:H.err});
  H.begin=(cols,rows)=>{const cv=H.cv=document.createElement("canvas");cv.width=1600;cv.height=Math.round(1600*rows/cols*.75);H.cols=cols;H.rows=rows;H.i=0;};
  H.cam=(ang,dist,h,lookH,fov)=>{const c=H.core.camera.clone(),p=player.g.position,f=player.g.rotation.y+ang;
    c.position.set(p.x+Math.sin(f)*dist,h==null?1.4:h,p.z+Math.cos(f)*dist);c.lookAt(p.x,lookH==null?1.25:lookH,p.z);c.fov=fov||38;
    c.aspect=H.R.domElement.width/H.R.domElement.height;c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;};
  H.addCam=(label,c)=>{H.R.render(scene,c);const x=H.cv.getContext("2d"),w=H.cv.width/H.cols,h=H.cv.height/H.rows,cx=(H.i%H.cols)*w,cy=Math.floor(H.i/H.cols)*h;
    x.drawImage(H.R.domElement,cx,cy,w,h);x.fillStyle="#000a";x.fillRect(cx,cy,w,26);x.fillStyle="#fff";x.font="18px sans-serif";x.fillText(label,cx+6,cy+19);H.i++;};
  H.add=(label,ang,dist,h,lookH,fov)=>H.addCam(label,H.cam(ang,dist,h,lookH,fov));
  /* 同一帧画两格:左方块人、右新模型 */
  H.pair=(label,ang,dist,h,lookH)=>{AIBATripo.off=true;H.add(label+" · 方块人",ang,dist,h,lookH);AIBATripo.off=false;H.add(label+" · 新模型",ang,dist,h,lookH);};
  H.show=async()=>{H.img.src=H.cv.toDataURL("image/jpeg",.9);await new Promise(r=>setTimeout(r,700));};
  H.chargeTo=k=>{if(!G.charging)startCharge();let g=0;while(poseK<k&&G.charging&&g++<600)H.step(1);return poseK;};
})();
