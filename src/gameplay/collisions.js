/* ---- 空中球碰撞:撞击改变结果(原本进的被撞歪→不进) ---- */
/* 真实物理球（phase "path"）到筐之前也算"在空中飞" */
function ballAirborne(b){return b.phase==="fly"||(b.phase==="path"&&b.t<b.tf);}
function checkBallCollisions(){
  for(let i=0;i<balls.length;i++){
    const a=balls[i];if(!ballAirborne(a))continue;
    for(let j=i+1;j<balls.length;j++){
      const b=balls[j];if(!ballAirborne(b))continue;
      if(a.collided&&b.collided)continue;
      // 只有玩家球 vs 对手球之间才判定(同一人的球不互撞)
      if(!!a.opp===!!b.opp)continue;
      const dx=a.mesh.position.x-b.mesh.position.x;
      const dy=a.mesh.position.y-b.mesh.position.y;
      const dz=a.mesh.position.z-b.mesh.position.z;
      const d2=dx*dx+dy*dy+dz*dz;
      if(d2<0.34*0.34){ // 球半径~0.17,两球接触
        if(a.physics&&b.physics)physicsBallCollide(a,b);
        else ballCollide(a,b);
      }
    }
  }
}
function ballCollide(a,b){
  a.collided=b.collided=true;
  // 互相弹开:沿连线方向给一个横向偏移速度
  const n=V3(a.mesh.position.x-b.mesh.position.x,a.mesh.position.y-b.mesh.position.y,a.mesh.position.z-b.mesh.position.z);
  if(n.length()<0.001)n.set(rnd(-1,1),0.4,rnd(-1,1));
  n.normalize();
  // 原本要进的球被撞 → 改判不进(转 free 落体飞出)
  [[a,1],[b,-1]].forEach(([ball,sgn])=>{
    const wasSwish=ball.outcome==="swish";
    sClank();
    ball.phase="free";
    const vy=ball.v0.y-9.8*ball.t;
    ball.vel.set(ball.v0.x+sgn*n.x*2.6,Math.max(vy,1.2)+1.0,ball.v0.z+sgn*n.z*2.6);
    ball.outcome="rimout";
    ball.life=1.4;
    if(wasSwish){
      if(ball.opp){toast("💥 空中相撞!对手没进!","#7CFC6B");}
      else{toast("💥 空中相撞!你的球被打飞!","#ff8d7a");if(!ball.silent)missBall();}
    }
  });
  // 撞击反馈
  cheerSound(false);if(navigator.vibrate)navigator.vibrate([15,30,15]);
  popScore("💥","#fff");
}

/* 两颗物理球相撞：沿连心线交换法向速度（等质量弹性碰撞，恢复系数 .75），
   各自从这一刻重新模拟——被撞偏的球真的飞偏，进不进由物理决定（大多数不进，偶尔歪打正着）。 */
const PHYS_COLLIDE_SAMPLE_A={},PHYS_COLLIDE_SAMPLE_B={};
function physicsBallState(b,out){
  const PHYS=globalThis.AIBABallPhysics,lt=b.t-(b.pathT0||0),h=1/120;
  const s1=PHYS.sampleAt(b.path,lt,{}),s0=PHYS.sampleAt(b.path,Math.max(0,lt-h),{});
  out.p=[s1.x,s1.y,s1.z];out.v=[(s1.x-s0.x)/h,(s1.y-s0.y)/h,(s1.z-s0.z)/h];out.w=[s1.wx,s1.wy,s1.wz];
  return out;
}
function physicsBallCollide(a,b){
  a.collided=b.collided=true;
  const sa=physicsBallState(a,PHYS_COLLIDE_SAMPLE_A),sb=physicsBallState(b,PHYS_COLLIDE_SAMPLE_B);
  let nx=sa.p[0]-sb.p[0],ny=sa.p[1]-sb.p[1],nz=sa.p[2]-sb.p[2],nl=Math.hypot(nx,ny,nz);
  if(nl<1e-4){nx=1;ny=0;nz=0;nl=1;}
  nx/=nl;ny/=nl;nz/=nl;
  const rel=(sa.v[0]-sb.v[0])*nx+(sa.v[1]-sb.v[1])*ny+(sa.v[2]-sb.v[2])*nz;
  if(rel<0){
    const j=-(1+.75)*rel/2;
    sa.v[0]+=j*nx;sa.v[1]+=j*ny;sa.v[2]+=j*nz;
    sb.v[0]-=j*nx;sb.v[1]-=j*ny;sb.v[2]-=j*nz;
  }
  // 推开到刚好不重叠，避免下一帧再撞
  const push=Math.max(0,.34-nl)/2+.005;
  sa.p[0]+=nx*push;sa.p[1]+=ny*push;sa.p[2]+=nz*push;
  sb.p[0]-=nx*push;sb.p[1]-=ny*push;sb.p[2]-=nz*push;
  const wasA=a.willMake,wasB=b.willMake;
  resimPhysicsBall(a,sa.p,sa.v,sa.w,a.t);
  resimPhysicsBall(b,sb.p,sb.v,sb.w,b.t);
  if(typeof impactSfx==="function")impactSfx("rim",Math.abs(rel));else sClank();
  [[a,wasA],[b,wasB]].forEach(([ball,was])=>{
    if(!was||ball.willMake)return;
    if(ball.opp)toast("💥 空中相撞!对手没进!","#7CFC6B");
    else if(!ball.silent)toast("💥 空中相撞!你的球被打飞!","#ff8d7a");
  });
  cheerSound(false);if(navigator.vibrate)navigator.vibrate([15,30,15]);
  popScore("💥","#fff");
}

window.AIBA.runtime.register("gameplay:collisions",Object.freeze({
  checkBallCollisions,ballCollide,physicsBallCollide
}));

