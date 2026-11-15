/* ---------------- 热身舞蹈库 ----------------
   五段 Mixamo 舞蹈(热舞 / 嘻哈 / 滑稽舞 / 两段霹雳定格),在 Blender 里离线抽成 assets/dance/dances.json,
   每帧(15fps)带两套数据:
     · q   —— 22 根主骨骼"相对静止姿势的世界旋转增量"(游戏坐标:面朝 +Z、头顶 +Y、左手 +X),
              所有 Mixamo 规范的写实皮套直接套(tripo-avatar.js 里 applyDance);
     · hy  —— 髋部高度相对站姿的比例;
     · vox —— 方块人的关节参数(身体欧拉角 / 头 / 两臂 x,z + 肘 / 两腿 x,z + 膝 + 踝),
              从同一段动画的关节位置换算出来,所以没有写实皮套的球员也能跳同一支舞。
   霹雳定格有手撑地、身体横躺的姿势,方块人躯干立不起来,标了 vox_ok:false,只给写实角色跳。
   用法:AIBADance.load() 预取;AIBADance.pick(canVox) 选一段;AIBADance.sample(id,t) 取某一时刻;
         AIBADance.applyVox(guy,vox,w) 把方块人摆成这一帧。?dance=0 关闭。 */
(function(global){
  "use strict";
  const D={ready:false,loading:false,failed:false,clips:{},ids:[],enabled:!/[?&]dance=0\b/.test(String(global.location&&global.location.search))};
  const SELF=document.currentScript&&document.currentScript.src||location.href;
  const URL_JSON=new URL("../../assets/dance/dances.json",SELF).href;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function load(){
    if(!D.enabled||D.ready||D.loading||D.failed)return;
    D.loading=true;
    fetch(URL_JSON).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(j=>{
      for(const id in j.clips){const c=j.clips[id];c.fps=j.fps;D.clips[id]=c;}
      D.ids=Object.keys(D.clips);D.ready=true;D.loading=false;
    }).catch(e=>{D.failed=true;D.loading=false;D.error=String(e);});
  }
  /* 选一段:写实皮套什么都能跳;方块人只能选 vox_ok 的(霹雳定格有手撑地、身体横躺,方块人立不起来);支持传入 avoid 避免连续重样 */
  function pick(skinned,avoid){
    let ids=D.ids.filter(id=>skinned?true:D.clips[id].vox_ok);
    if(!ids.length)return null;
    if(avoid&&ids.length>1)ids=ids.filter(id=>id!==avoid);
    return ids[(Math.random()*ids.length)|0];
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
  /* 取 t 秒处的姿势(超出就停在末帧/首帧)。返回对象会被复用,别缓存 */
  const OUT={q:new Float32Array(22*4),hy:0,vox:new Array(27).fill(0),id:null};
  function sample(id,t){
    const c=D.clips[id];if(!c)return null;
    const f=clamp(t*c.fps,0,c.n-1),i=Math.min(c.n-2,Math.floor(f)),k=f-i;
    const A=c.q[i],B=c.q[i+1],nb=c.bones.length;
    for(let b=0;b<nb;b++){
      for(let j=0;j<4;j++){Q0[j]=A[b*4+j];Q1[j]=B[b*4+j];}
      slerpInto(OUT.q,b*4,Q0,Q1,k);
    }
    OUT.hy=c.hy[i]+(c.hy[i+1]-c.hy[i])*k;
    const va=c.vox[i],vb=c.vox[i+1];
    for(let j=0;j<va.length;j++)OUT.vox[j]=va[j]+(vb[j]-va[j])*k;
    OUT.id=id;return OUT;
  }
  /* 把方块人摆成 vox 这一帧(和当前姿势按 w 混合)。
     vox: [0..2]身体欧拉角(YXZ 序:先转身再前倾再侧倾,转身可以转满一圈)  [3..5]头 xyz  [6..8]右臂 x,z,肘  [9..11]左臂 x,z,肘  [12..15]右腿 x,z,膝,踝  [16..19]左腿 x,z,膝,踝
     手臂/腿 rotation.set(x,0,z);臂的 x 向前为负,和游戏里一致。脚贴地:取两只脚里最低的那只落到地板上。 */
  const _pv=new THREE.Vector3(),_e=new THREE.Euler(),_q=new THREE.Quaternion(),_qy=new THREE.Quaternion(),_ax=new THREE.Vector3(0,1,0);
  function applyVox(guy,v,w){
    if(!guy||!guy.g||!v)return false;
    w=clamp(w,0,1);if(w<=0)return false;
    const mix=(a,b)=>a+(b-a)*w;
    const g=guy.g;
    /* 身体:朝向(face)在最外层,舞蹈的身体欧拉角在里面 */
    const face=g.rotation.y;
    g.rotation.order="YXZ";   // 跳舞时用 YXZ 序存欧拉角:转身超过 90° 也不翻转,pregameSmoothPose 逐分量混合才不会穿帮
    _e.set(v[0]*w,v[1]*w,v[2]*w,"YXZ");_q.setFromEuler(_e);_qy.setFromAxisAngle(_ax,face);g.quaternion.copy(_qy).multiply(_q);
    /* 身体是绕脚底转的,真人弯腰/转身时髋不会跟着挪:把骨盆(离脚底 .78)被带偏的水平位移补回去 */
    _pv.set(0,.78,0).applyQuaternion(g.quaternion);g.position.x-=_pv.x;g.position.z-=_pv.z;
    if(guy.headRoot)guy.headRoot.rotation.set(v[3]*w,v[4]*w,v[5]*w);
    const arm=(i,o)=>{guy.arms[i].rotation.set(mix(guy.arms[i].rotation.x,v[o]),0,mix(guy.arms[i].rotation.z,v[o+1]));guy.elbows[i].rotation.set(mix(guy.elbows[i].rotation.x,v[o+2]),0,0);};
    arm(0,6);arm(1,9);
    const leg=(i,o)=>{guy.legs[i].rotation.set(mix(guy.legs[i].rotation.x,v[o]),0,mix(guy.legs[i].rotation.z,v[o+1]));guy.knees[i].rotation.set(mix(guy.knees[i].rotation.x,v[o+2]),0,0);guy.ankles[i].rotation.set(mix(guy.ankles[i].rotation.x,v[o+3]),0,0);};
    leg(0,12);leg(1,16);
    /* 贴地:最低的那只脚落到地板;两腿都伸直时就是站姿高度 */
    if(typeof poseFootBottomY==="function"&&typeof POSE_STAND_FOOT_Y!=="undefined"){
      const fy=i=>poseFootBottomY(guy.legs[i].rotation.x,guy.knees[i].rotation.x,guy.ankles[i].rotation.x);
      const low=Math.min(fy(0),fy(1));
      g.position.y=Math.max(0,POSE_STAND_FOOT_Y-low);
    }
    return true;
  }
  D.load=load;D.pick=pick;D.sample=sample;D.applyVox=applyVox;
  global.AIBADance=D;
  if(D.enabled)load();
})(window);
