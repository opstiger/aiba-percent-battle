/* ---------------- roster style: 女性发型 + 球员体型差异 ----------------
   在主内联脚本与 avatar-customizer 之后加载:
   1) setHair 扩展 ponytail/bun/long 三种发型(女性球员用),未知发型回退原函数。
   2) applyStarStyle 追加体型缩放:按 AIBA_CONFIG.BODY_PROFILES 的 h(身高)/w(体格)
      缩放整个体素小人;球(pBall)做反向补偿保持标准尺寸不变形。
   3) randomizeOutfit 单独调用时重置缩放,避免上一位球员的体型残留。 */
(function(global){
  "use strict";

  function cfg(){return global.AIBA_CONFIG||{};}

  /* ---------- 女性发型 ---------- */
  const FEMALE_STYLES={ponytail:1,bun:1,long:1};
  function buildFemaleHair(o,style){
    const m=o.hairMat;
    /* 与 characters.js 的 setHair 保持同一套分层:
       B=贴头皮(发冠/后脑/侧发/发际线) → 固定,发根不漂
       S=外层(丸子等头顶上方结构)      → 小幅摆
       T=马尾/长发末端                  → 摆幅最大
       ⚠ 女性发型原先整组挂在 hairGrp 上,发根会随晃动漂移,必须一并覆盖。 */
    const B=o.hairBase||o.hairGrp,S=o.hairGrp,T=o.hairTail||o.hairGrp;
    [B,S,T].forEach(G=>{
      while(G.children.length){
        const child=G.children[0];G.remove(child);
        if(child.geometry&&child.geometry.dispose)child.geometry.dispose();
      }
    });
    o.hairStyle=style;
    const box=(L,w,h,d,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);L.add(b);return b;};
    const tuft=(L,rx,ry,rz,x,y,z)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(1,8,5),m);b.scale.set(rx,ry,rz);b.position.set(x,y,z);L.add(b);return b;};
    const lock=(L,r,h,x,y,z,rx,rz)=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(r*.72,r,h,6),m);b.position.set(x,y,z);b.rotation.set(rx||0,0,rz||0);L.add(b);return b;};
    /* 共用发冠:顶部之外继续包到侧后脑,避免像一块头顶盖板 —— 全部贴头皮,归 B。 */
    tuft(B,.182,.072,.182,0,1.787,0);
    box(B,.30,.22,.058,0,1.68,-.166);
    box(B,.058,.21,.29,-.166,1.69,0);
    box(B,.058,.21,.29,.166,1.69,0);
    box(B,.29,.042,.052,0,1.765,.17);
    if(style==="ponytail"){
      tuft(B,.095,.09,.085,0,1.77,-.235);        // 扎发点与头皮相连,固定
      lock(T,.075,.31,0,1.59,-.31,-.20,0);        // 马尾第一节
      lock(T,.063,.27,.025,1.34,-.34,-.17,.07);   // 第二节
      tuft(T,.068,.072,.06,.04,1.18,-.35);        // 末端
      return;
    }
    if(style==="bun"){
      /* 丸子在头顶上方,不贴头皮 → S */
      tuft(S,.13,.13,.12,0,1.88,-.18);
      tuft(S,.085,.075,.08,0,1.98,-.18);
      return;
    }
    /* long:披肩长发 —— 分成后发与左右侧发,统一归 T。
       它们垂到肩膀高度,motion.js 已把 T 层调成"多前后摆、少左右摆"以避开肩膀。 */
    box(T,.085,.42,.27,-.19,1.52,-.03);
    box(T,.085,.42,.27,.19,1.52,-.03);
    box(T,.34,.40,.075,0,1.52,-.205);
    tuft(T,.17,.065,.055,0,1.31,-.21);
  }
  const origSetHair=global.setHair;
  if(typeof origSetHair==="function"&&!origSetHair.__aibaRoster){
    const fn=function(o,style,colorHex){
      if(FEMALE_STYLES[style]){
        if(colorHex!=null)o.hairMat.color.setHex(colorHex);
        buildFemaleHair(o,style);
        return;
      }
      return origSetHair.apply(this,arguments);
    };
    fn.__aibaRoster=true;
    global.setHair=fn;
  }

  /* ---------- 体型缩放 ---------- */
  function applyBody(guy,star){
    if(!guy||!guy.g)return;
    const bp=(cfg().bodyProfileFor?cfg().bodyProfileFor(star):null)||{h:1,w:1};
    guy.g.scale.set(bp.w,bp.h,bp.w);
    // 主角的球挂在体素层级里,反向补偿保持球为标准圆球
    if(typeof player!=="undefined"&&guy===player&&typeof pBall!=="undefined")
      pBall.scale.set(1/bp.w,1/bp.h,1/bp.w);
  }
  function resetBody(guy){
    if(!guy||!guy.g)return;
    guy.g.scale.set(1,1,1);
    if(typeof player!=="undefined"&&guy===player&&typeof pBall!=="undefined")
      pBall.scale.set(1,1,1);
  }

  /* 通用经典球星(无专属肤色/发型档案)现在统一走 applyStarStyle,
     原函数会把发型固定成 short——这里补回原随机造型池,保留赛前多样性 */
  const RAND_HAIR_COLORS=[0x222222,0x4a2c12,0x101010,0x5c4a1e,0x3a2410];
  const RAND_HAIR_STYLES=["short","short","fade","fade","buzz","afro","cornrows","flattop"];
  function restyleGenericLegend(guy,star){
    if(!star||star.custom||star.hairStyle||star.skin!=null||star.sex==="f")return;
    const hc=RAND_HAIR_COLORS[(Math.random()*RAND_HAIR_COLORS.length)|0];
    if(typeof setHair==="function")setHair(guy,RAND_HAIR_STYLES[(Math.random()*RAND_HAIR_STYLES.length)|0],hc);
    if(typeof setBeard==="function")setBeard(guy,Math.random()<0.3,hc);
  }

  const origApplyStar=global.applyStarStyle;
  if(typeof origApplyStar==="function"&&!origApplyStar.__aibaRosterBody){
    const fn=function(guy,star){
      const r=origApplyStar.apply(this,arguments);
      restyleGenericLegend(guy,star);
      applyBody(guy,star);
      return r;
    };
    fn.__aibaRosterBody=true;
    global.applyStarStyle=fn;
  }
  const origRandomize=global.randomizeOutfit;
  if(typeof origRandomize==="function"&&!origRandomize.__aibaRosterBody){
    const fn=function(o){
      const r=origRandomize.apply(this,arguments);
      resetBody(o); // applyStarStyle 内部会随后重新按球员档案缩放
      return r;
    };
    fn.__aibaRosterBody=true;
    global.randomizeOutfit=fn;
  }

  global.AIBARosterStyle={applyBody,resetBody,femaleStyles:Object.keys(FEMALE_STYLES)};
})(window);
