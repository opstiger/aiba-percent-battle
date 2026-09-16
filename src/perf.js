/* ---------------- runtime performance tuning ----------------
   两项优化，均不触碰姿态识别 / 识别模式 / 帧率自适应逻辑：
   1) 静态几何矩阵冻结：室内球馆的看台/广告牌/后场/灯光/远景大观众等
      物体位置永不变，关闭它们的逐帧世界矩阵重算（对画面完全无损）。
   2) 摄像头模式近场观众 LOD：仅在「手机 + 视觉投篮」下，隐藏一部分
      最近的独立观众，直接砍 draw call；退出视觉模式即恢复。
   放在主内联脚本之后加载，靠共享全局词法作用域访问 scene / indoorRoot 等。 */
(function(global){
  "use strict";

  function isMobile(){
    try{return (global.matchMedia&&global.matchMedia("(pointer:coarse)").matches)||Math.min(global.innerWidth,global.innerHeight)<700;}
    catch(e){return false;}
  }

  /* ---- 1. 静态矩阵冻结 ---- */
  let frozenCount=0;
  function freezeStatic(){
    if(typeof scene==="undefined"||typeof indoorRoot==="undefined")return 0;
    const skip=new Set();
    // 排除会动的后场表演角色（啦啦队 / 吉祥物）
    if(typeof showCrew!=="undefined"&&Array.isArray(showCrew)){
      showCrew.forEach(c=>{if(c&&c.g&&c.g.traverse)c.g.traverse(o=>skip.add(o));});
    }
    // Aisle walkers have animated transforms; keep their whole rigs live.
    if(global.AIBACrowdLife)global.AIBACrowdLife.state.walkers.forEach(w=>w.g.traverse(o=>skip.add(o)));
    /* 灯和它们的 target 不能冻结。数量只有个位数,冻结省不下任何东西,
       但一旦冻上,`light.position.set(...)` 就**静默失效** ——
       matrixAutoUpdate=false 时 updateMatrixWorld 不会再用 position 重算 matrix,
       所以 applyScenePreset 里改灯位的那几行全是空操作,改完画面一点变化都没有。
       (v2.20 排查阴影不动时才发现:整整一轮 A/B 三个灯位读数完全相同。) */
    indoorRoot.traverse(o=>{if(o.isLight){skip.add(o);if(o.target)skip.add(o.target);}});
    const list=[];
    indoorRoot.traverse(o=>{if(o!==indoorRoot&&!skip.has(o))list.push(o);});
    if(typeof courtFloor!=="undefined"&&courtFloor)list.push(courtFloor);
    // 先强制刷新一次世界矩阵，之后再冻结，保证位置正确
    try{scene.updateMatrixWorld(true);}catch(e){}
    list.forEach(o=>{o.matrixAutoUpdate=false;});
    frozenCount=list.length;
    return frozenCount;
  }

  /* ---- 2. 摄像头模式近场观众 LOD ---- */
  let thinned=false;
  function people(){
    return (typeof nearCourtCrowd!=="undefined"&&nearCourtCrowd&&Array.isArray(nearCourtCrowd.people))?nearCourtCrowd.people:[];
  }
  function shouldHide(i){
    // 均匀分布地隐藏 2/5，视觉上不至于整片消失
    const m=i%5;return m===1||m===3;
  }
  function setThin(on){
    const arr=people();if(!arr.length)return 0;
    let hidden=0;
    arr.forEach((p,i)=>{
      if(!p||!p.g)return;
      const hide=on&&shouldHide(i);
      if(p.g.visible===!hide)return;  // 已是目标态
      p.g.visible=!hide;
      if(hide)hidden++;
    });
    thinned=on;
    return hidden;
  }
  function visionOn(){
    return typeof VISION!=="undefined"&&!!(VISION&&(VISION.desired||VISION.enabled));
  }
  function applyForVision(){
    // 仅手机 + 视觉模式激活时瘦身
    const wantThin=isMobile()&&visionOn();
    if(wantThin!==thinned)setThin(wantThin);
  }

  /* ---- 挂钩视觉模式开关（函数声明 → window 全局）---- */
  function wrapVision(){
    ["enableVisionControl","disableVisionControl","suspendVisionControl"].forEach(name=>{
      const orig=global[name];
      if(typeof orig!=="function"||orig.__perf)return;
      const fn=function(){
        const r=orig.apply(this,arguments);
        // 开关切换后延后一拍再判定，等 VISION.desired 状态落定
        setTimeout(applyForVision,0);
        return r;
      };
      fn.__perf=true;global[name]=fn;
    });
  }

  /* ⚠ 光包函数是不够的,这里踩过一个只在手机上出现的坑:
       enableVisionControl() 会**先**把 VISION.desired=true,再 await getUserMedia。
       包装器随即 applyForVision() → 手机上 setThin(true),藏掉 2/5 近场观众。
       随后摄像头授权被拒(手机上很常见,非 HTTPS 也会失败),vision.js 的 catch 里
       **直接**写 VISION.desired=false,并不走 disableVisionControl ——
       于是包装器再也不会被触发,瘦身永久留着:桌面一切正常,手机上场边观众
       凭空少掉 2/5,看起来就是"各种透明"。
     所以这里再加一道**周期性自愈**:applyForVision 在状态没变时是 O(1) 直接返回,
     700ms 一次的代价可以忽略,但任何绕过包装器改 VISION.desired 的路径都能被兜住。 */
  let healTimer=0;
  function startSelfHeal(){
    if(healTimer)return;
    healTimer=global.setInterval(applyForVision,700);
  }

  function boot(){
    freezeStatic();
    wrapVision();
    applyForVision();
    startSelfHeal();
  }

  // 主脚本已在本脚本之前跑完 boot()/animate()，场景已就绪
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  global.AIBAPerf={
    freezeStatic,
    setThin,
    applyForVision,
    startSelfHeal,
    stats:()=>({frozen:frozenCount,thinned,people:people().length,hidden:people().filter(p=>p&&p.g&&!p.g.visible).length})
  };
})(window);
