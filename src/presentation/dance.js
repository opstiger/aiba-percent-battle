/* ---------------- 分类动作库 (AIBADance) ----------------
   统一管理全部 Mixamo 骨骼动作(assets/dance/dances.json)，按四类位置姿态严格分区，
   防止出现"座位观众跳舞 / 场边站立观众坐下"等穿帮：
     · posture:
         - "dance"     : 跳舞/地板技（仅限球场开阔地带的球员）
         - "standing"  : 站立动作（站立球员、传球手、场边站立观众、街头站立观众）
         - "seated"    : 纯坐姿动作（场边坐席 VIP、户外长椅观众、底线坐地人员）
         - "sit_stand" : 坐→起立欢呼/鼓掌→坐回（仅限有起身空间的坐席 VIP / 长椅观众）
     · mood: "dance" | "cheer" | "miss" | "idle"
     · roles: 允许调用的角色白名单
   每帧(15fps)带两套数据:
     · q   —— 22 根主骨骼相对静止姿势的世界旋转增量(游戏坐标:面朝 +Z、头顶 +Y、左手 +X)
     · hy  —— 髋部高度相对站姿的比例偏移(坐姿约 -0.42，站姿约 0)
     · vox —— 方块人/低模关节参数(身体 YXZ / 头 xyz / 右臂 x,z,肘 / 左臂 x,z,肘 / 右腿 / 左腿)
   用法:
     AIBADance.load() 预取
     AIBADance.pickFor({role, posture, mood, skinned, avoid}) 严格按位置与情绪抽取
     AIBADance.pick(skinned, avoid, opts) 兼容旧接口(默认 role:"player", posture:"dance")
     AIBADance.sample(id, t) 采样某一时刻
     AIBADance.applyVox(guy, vox, w) 驱动方块球员 */
(function(global){
  "use strict";
  const POSTURE_RULES=Object.freeze({
    player:Object.freeze(["dance","standing"]),
    locker:Object.freeze(["dance","standing"]),
    standing_crowd:Object.freeze(["standing"]),
    seated_crowd:Object.freeze(["seated","sit_stand"]),
    seated_floor:Object.freeze(["seated"])
  });
  const D={
    ready:false,loading:false,failed:false,
    clips:{},ids:[],
    byPosture:{dance:[],standing:[],seated:[],sit_stand:[]},
    byMood:{dance:[],cheer:[],miss:[],idle:[]},
    POSTURE_RULES,
    enabled:!/[?&]dance=0\b/.test(String(global.location&&global.location.search))
  };
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const URL_JSON=new URL("../../assets/dance/dances.json",SELF).href;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const toArr=v=>Array.isArray(v)?v.filter(Boolean):(v?[v]:[]);

  function rebuildIndexes(){
    D.byPosture={dance:[],standing:[],seated:[],sit_stand:[]};
    D.byMood={dance:[],cheer:[],miss:[],idle:[]};
    for(const id of D.ids){
      const c=D.clips[id];if(!c)continue;
      const p=c.posture||"dance";
      const m=c.mood||(p==="dance"?"dance":"idle");
      c.posture=p;c.mood=m;
      if(!Array.isArray(c.roles))c.roles=p==="seated"?["seated_crowd","seated_floor"]:p==="sit_stand"?["seated_crowd"]:p==="standing"?["player","standing_crowd"]:["player"];
      if(D.byPosture[p])D.byPosture[p].push(id);
      if(D.byMood[m])D.byMood[m].push(id);
    }
  }

  function load(){
    if(!D.enabled||D.ready||D.loading||D.failed)return;
    D.loading=true;
    fetch(URL_JSON).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(j=>{
      for(const id in j.clips){const c=j.clips[id];c.fps=j.fps;D.clips[id]=c;}
      D.ids=Object.keys(D.clips);
      rebuildIndexes();
      D.ready=true;D.loading=false;
    }).catch(e=>{D.failed=true;D.loading=false;D.error=String(e);});
  }

  /* 严格按角色位置(role)、姿态大类(posture)、情绪(mood)和骨骼能力(skinned)筛选可用动作 */
  function list(opts){
    opts=opts||{};
    const skinned=opts.skinned!==false;
    const role=opts.role||null;
    const rolePostures=role&&POSTURE_RULES[role]?POSTURE_RULES[role]:null;
    const reqPostures=toArr(opts.postures||opts.posture);
    const reqMoods=toArr(opts.moods||opts.mood);
    return D.ids.filter(id=>{
      const c=D.clips[id];if(!c)return false;
      if(!skinned&&!c.vox_ok)return false;
      const p=c.posture||"dance";
      if(rolePostures&&rolePostures.indexOf(p)<0)return false;
      if(role&&Array.isArray(c.roles)&&c.roles.indexOf(role)<0){
        /* locker 预览复用 player 的站立与舞蹈动作 */
        if(!(role==="locker"&&c.roles.indexOf("player")>=0))return false;
      }
      if(reqPostures.length&&reqPostures.indexOf(p)<0)return false;
      if(reqMoods.length&&reqMoods.indexOf(c.mood)<0)return false;
      return true;
    });
  }

  function pickFrom(ids,avoid){
    if(!ids||!ids.length)return null;
    const avoidList=toArr(avoid);
    let pool=ids;
    if(avoidList.length&&pool.length>1){
      const filtered=pool.filter(id=>avoidList.indexOf(id)<0);
      if(filtered.length)pool=filtered;
      else if(avoidList[0]&&pool.length>1){
        const f1=pool.filter(id=>id!==avoidList[0]);
        if(f1.length)pool=f1;
      }
    }
    return pool[(Math.random()*pool.length)|0];
  }

  /* 推荐新接口：按 role / posture / mood 严格抽取；mood 无匹配时只在同 role+posture 内兜底，绝不越界 */
  function pickFor(opts){
    opts=opts||{};
    let ids=list(opts);
    if(!ids.length&&(opts.mood||opts.moods)){
      ids=list({role:opts.role,posture:opts.posture,postures:opts.postures,skinned:opts.skinned});
    }
    return pickFrom(ids,opts.avoid);
  }

  /* 兼容旧接口：默认只从球员跳舞池(posture:"dance")抽取，保证赛前炫舞/旧调用绝不抽到坐姿或静态待机 */
  function pick(skinned,avoid,opts){
    if(opts&&typeof opts==="object"){
      return pickFor(Object.assign({skinned:!!skinned,avoid},opts));
    }
    const ids=list({role:"player",posture:"dance",skinned:!!skinned});
    return pickFrom(ids,avoid);
  }

  function meta(id){
    const c=D.clips[id];
    return c?{id,posture:c.posture,mood:c.mood,roles:c.roles,dur:c.dur,vox_ok:!!c.vox_ok,label:c.label||id}:null;
  }

  const Q0=new Float32Array(4),Q1=new Float32Array(4);
  function slerpInto(out,o,a,b,k){
    let ax=a[0],ay=a[1],az=a[2],aw=a[3],bx=b[0],by=b[1],bz=b[2],bw=b[3];
    let d=ax*bx+ay*by+az*bz+aw*bw;if(d<0){bx=-bx;by=-by;bz=-bz;bw=-bw;d=-d;}
    let s0,s1;
    if(d>.9995){s0=1-k;s1=k;}else{const th=Math.acos(d),sn=Math.sin(th);s0=Math.sin((1-k)*th)/sn;s1=Math.sin(k*th)/sn;}
    const x=s0*ax+s1*bx,y=s0*ay+s1*by,z=s0*az+s1*bz,w=s0*aw+s1*bw,n=1/Math.hypot(x,y,z,w);
    out[o]=x*n;out[o+1]=y*n;out[o+2]=z*n;out[o+3]=w*n;
  }
  /* 取 t 秒处的姿势(超出就停在末帧/首帧；传 loop=true 可循环)。返回对象会被复用,别缓存 */
  const OUT={q:new Float32Array(22*4),hy:0,vox:new Array(27).fill(0),id:null,posture:"dance",mood:"dance"};
  function sample(id,t,loop){
    const c=D.clips[id];if(!c)return null;
    const dur=Math.max(.001,(c.n-1)/(c.fps||15));
    const tt=loop?(((t%dur)+dur)%dur):t;
    const f=clamp(tt*(c.fps||15),0,c.n-1),i=Math.min(c.n-2,Math.floor(f)),k=f-i;
    const A=c.q[i],B=c.q[i+1],nb=c.bones.length;
    for(let b=0;b<nb;b++){
      for(let j=0;j<4;j++){Q0[j]=A[b*4+j];Q1[j]=B[b*4+j];}
      slerpInto(OUT.q,b*4,Q0,Q1,k);
    }
    OUT.hy=c.hy[i]+(c.hy[i+1]-c.hy[i])*k;
    const va=c.vox[i],vb=c.vox[i+1];
    for(let j=0;j<va.length;j++)OUT.vox[j]=va[j]+(vb[j]-va[j])*k;
    OUT.id=id;OUT.posture=c.posture||"dance";OUT.mood=c.mood||"idle";
    return OUT;
  }

  /* 把方块人摆成 vox 这一帧(和当前姿势按 w 混合)。
     vox: [0..2]身体欧拉角(YXZ 序) [3..5]头 xyz [6..8]右臂 x,z,肘 [9..11]左臂 x,z,肘 [12..15]右腿 x,z,膝,踝 [16..19]左腿 x,z,膝,踝 */
  const _pv=new THREE.Vector3(),_e=new THREE.Euler(),_q=new THREE.Quaternion(),_qy=new THREE.Quaternion(),_ax=new THREE.Vector3(0,1,0);
  function applyVox(guy,v,w){
    if(!guy||!guy.g||!v)return false;
    w=clamp(w,0,1);if(w<=0)return false;
    const mix=(a,b)=>a+(b-a)*w;
    const g=guy.g;
    const face=g.rotation.y;
    g.rotation.order="YXZ";
    _e.set(v[0]*w,v[1]*w,v[2]*w,"YXZ");_q.setFromEuler(_e);_qy.setFromAxisAngle(_ax,face);g.quaternion.copy(_qy).multiply(_q);
    _pv.set(0,.78,0).applyQuaternion(g.quaternion);g.position.x-=_pv.x;g.position.z-=_pv.z;
    if(guy.headRoot)guy.headRoot.rotation.set(v[3]*w,v[4]*w,v[5]*w);
    const arm=(i,o)=>{guy.arms[i].rotation.set(mix(guy.arms[i].rotation.x,v[o]),0,mix(guy.arms[i].rotation.z,v[o+1]));guy.elbows[i].rotation.set(mix(guy.elbows[i].rotation.x,v[o+2]),0,0);};
    arm(0,6);arm(1,9);
    const leg=(i,o)=>{guy.legs[i].rotation.set(mix(guy.legs[i].rotation.x,v[o]),0,mix(guy.legs[i].rotation.z,v[o+1]));guy.knees[i].rotation.set(mix(guy.knees[i].rotation.x,v[o+2]),0,0);guy.ankles[i].rotation.set(mix(guy.ankles[i].rotation.x,v[o+3]),0,0);};
    leg(0,12);leg(1,16);
    g.position.y=0;
    g.updateMatrixWorld(true);
    let minY=Infinity;
    const chk=(n,r)=>{if(!n||!n.getWorldPosition)return;n.getWorldPosition(_pv);if(_pv.y-r<minY)minY=_pv.y-r;};
    if(guy.shoes)guy.shoes.forEach(s=>chk(s,.045));
    if(guy.footRoots)guy.footRoots.forEach(f=>chk(f,.055));
    if(guy.ankles)guy.ankles.forEach(a=>chk(a,.06));
    if(guy.knees)guy.knees.forEach(k=>chk(k,.06));
    if(guy.handRoots)guy.handRoots.forEach(h=>chk(h,.05));
    if(guy.elbows)guy.elbows.forEach(e=>chk(e,.06));
    if(guy.headRoot)chk(guy.headRoot,.16);
    if(Number.isFinite(minY))g.position.y=Math.max(0,-minY);
    else if(typeof poseFootBottomY==="function"&&typeof POSE_STAND_FOOT_Y!=="undefined"){
      const fy=i=>poseFootBottomY(guy.legs[i].rotation.x,guy.knees[i].rotation.x,guy.ankles[i].rotation.x);
      g.position.y=Math.max(0,POSE_STAND_FOOT_Y-Math.min(fy(0),fy(1)));
    }
    return true;
  }

  D.load=load;D.list=list;D.pick=pick;D.pickFor=pickFor;D.meta=meta;D.sample=sample;D.applyVox=applyVox;
  global.AIBADance=D;
  if(D.enabled)load();
})(window);
