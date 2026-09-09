/* racks & rack balls */
const rackBalls=[]; const deepBalls=[]; const rackStands=[]; const deepStands=[]; let halfCourtBall=null;
/* 每个架子的世界坐标系(原点 + 横向单位向量)。摆球要用,取球和滚落也要用,
   所以建的时候存下来,不要在三个地方各算一遍。 */
const rackFrames=[];
const rackNextIndex=[];        // 每个架子"下一颗要被拿走的球"的下标
let rackSide=1;                // +1 = 摆在球员右手边, -1 = 左手边
/* ---------------- 球架摆位 ----------------
   原来架子摆在球员**身后** 0.85m —— 那个位置球员根本够不着,只能让球自己飞过来,
   一眼假。真实三分大赛的架子是立在投篮点**旁边**的:球员侧身、双手把球端起来。

   摆哪一侧看惯用手 —— 规则是**架子放在辅助手那一侧**,右手球员在左边、左手球员在右边。
   理由是蓄力时躯干朝辅助手一侧打开(实测:满蓄力下投篮臂前移 +0.097m、辅助臂后撤 -0.097m),
   架子放在已经打开的那一侧,伸手是顺的;放在投篮手一侧就得反向拧回去。

   ⚠ 坐标提醒:`perp=(dir.z,0,-dir.x)` 是球员的**左**手边,不是右手边。
   (面朝 -Z 时 perp=(-1,0,0),而面朝 -Z 的人左手指向 -X。)
   我上一版把它注释成"右手边",结论虽然歪打正着,但注释会把下一个人带沟里。
   验证方法别再推符号了,直接问"架子和哪只手同侧":
     toRack·toGuide = +0.995 / toRack·toShoot = -0.995 → 架子在辅助手一侧。

   还有一件必须对的事:**坡度的低端要朝向球员**,不然他得伸到架子最远端去够球。
   做法是右侧架整体转 180° —— 于是局部 +X(最低那一格)永远指回球员站的方向,
   几何一份就够,不用为左右各做一套。 */
function currentRackSide(){
  const cfg=window.AIBA_CONFIG;
  return (cfg&&cfg.rackSideFor)?cfg.rackSideFor(typeof G!=="undefined"?G.myStar:null):1;
}
function placeRacks(side){
  rackSide=side<0?-1:1;
  RACKS.forEach((r,ri)=>{
    const stand=rackStands[ri];if(!stand)return;
    const dir=HOOP.clone().sub(r.p);dir.y=0;dir.normalize();
    const perp=V3(dir.z,0,-dir.x);                       // 球员的**左**手边(见上面的坐标提醒)
    /* 0.95m 横向 + 0.10m 后撤:够得着,又不站在出手线上挡视线。 */
    const base=r.p.clone().addScaledVector(perp,rackSide*0.95).addScaledVector(dir,-0.10);
    stand.position.set(base.x,0.45,base.z);
    stand.rotation.y=Math.atan2(dir.x,dir.z)+(rackSide>0?Math.PI:0);
    const perpEff=perp.clone().multiplyScalar(rackSide>0?-1:1);  // 局部 +X 的世界方向
    rackFrames[ri]={base:base.clone(),perp:perpEff};
    seatRackBalls(ri,rackNextIndex[ri]||0,false);
  });
}
const RACK_SLOT_FALLBACK={SLOTS:5,DX:.30,DROP:0,BALL_Y:.41};
function rackSlotSpec(){
  const md=window.AIBAModelDetail;
  return (md&&md.enabled&&md.rackSlotLocal)
    ?{SLOTS:md.RACK_SLOTS,local:md.rackSlotLocal}
    :{SLOTS:RACK_SLOT_FALLBACK.SLOTS,
      local:i=>({x:(i-(RACK_SLOT_FALLBACK.SLOTS-1)/2)*RACK_SLOT_FALLBACK.DX,y:RACK_SLOT_FALLBACK.BALL_Y})};
}
/* 槽位 i 的世界坐标。架子本体挂在 y=0.45,局部 (x,y,0) 换算到世界就是这一行。 */
function rackSlotWorld(ri,i,out){
  const f=rackFrames[ri];if(!f)return null;
  const p=rackSlotSpec().local(i);
  return (out||new THREE.Vector3()).set(
    f.base.x+f.perp.x*p.x, 0.45+p.y, f.base.z+f.perp.z*p.x);
}
/* 把"还没被拿走"的球重新落位:下一颗永远排在**最低**那一格,后面的依次往高处排。
   这样视觉顺序和 shot.ball 的逻辑顺序天然一致 —— 花球(第 5 颗)排在最高、最后才拿到,
   和真实三分大赛的钱球位置一样。animate=true 时用补间滚下来,而不是瞬移。 */
function seatRackBalls(ri,nextIndex,animate){
  const balls=rackBalls[ri];if(!balls)return;
  const spec=rackSlotSpec(),last=spec.SLOTS-1;
  rackNextIndex[ri]=nextIndex;
  const target=new THREE.Vector3();
  for(let b=0;b<balls.length;b++){
    const m=balls[b];if(!m)continue;
    if(b<nextIndex){m.visible=false;continue;}
    const slot=Math.max(0,last-(b-nextIndex));
    rackSlotWorld(ri,slot,target);
    if(!animate){m.position.copy(target);continue;}
    const from=m.position.clone(),to=target.clone();
    const spin=from.distanceTo(to)/0.16;        // 滚过的弧长 / 球半径 = 转过的弧度
    const r0=m.rotation.x;
    if(typeof tween==="function")tween(0.26,k=>{
      m.position.lerpVectors(from,to,k);
      m.rotation.x=r0+spin*k;                   // 滚动而不是平移
    });
    else m.position.copy(to);
  }
}
/* 取走最低那一颗。返回它的世界坐标,供球动画用它当起点 —— 球是从架子上拿的,
   起点必须是架上真实的那个位置,不能是球员身上。 */
function takeRackBall(ri,index,out){
  const balls=rackBalls[ri];if(!balls)return null;
  const b=Math.max(0,Math.min(balls.length-1,index|0));
  const m=balls[b];
  const pos=(out||new THREE.Vector3()).copy(m?m.position:rackSlotWorld(ri,rackSlotSpec().SLOTS-1)||new THREE.Vector3());
  if(m)m.visible=false;
  seatRackBalls(ri,b+1,true);
  return pos;
}
/* 无限球模式(投篮机 / 百分大战)在架子空了之后补满,视觉上永远是一架球。 */
function refillRackBalls(ri){
  const balls=rackBalls[ri];if(!balls)return;
  balls.forEach(m=>{if(m)m.visible=true;});
  seatRackBalls(ri,0,false);
}
function buildRacks(){
  const standM=new THREE.MeshLambertMaterial({color:0x2255aa});
  RACKS.forEach((r,ri)=>{
    const stand=window.AIBAModelDetail?.enabled?AIBAModelDetail.rack(standM):
      new THREE.Mesh(new THREE.BoxGeometry(1.5,0.55,0.5),standM);
    scene.add(stand);rackStands[ri]=stand;
    rackBalls[ri]=[];
    for(let b=0;b<5;b++){
      const mat=b===4?matGold:matBall;
      const m=new THREE.Mesh(ballGeo,mat);
      m.rotation.set(rnd(0,1),rnd(0,1),0);
      scene.add(m);rackBalls[ri].push(m);
    }
  });
  placeRacks(currentRackSide());
  DEEPS.forEach((d,i)=>{
    const pedMat=new THREE.MeshLambertMaterial({color:0x1f7a28});
    const ped=window.AIBAModelDetail?.enabled?AIBAModelDetail.pedestal(.45,.9,pedMat):
      new THREE.Mesh(new THREE.BoxGeometry(0.45,0.9,0.45),pedMat);
    const dir=HOOP.clone().sub(d.p);dir.y=0;dir.normalize();
    const base=d.p.clone().addScaledVector(dir,-0.8);
    ped.position.set(base.x,0.45,base.z);scene.add(ped);deepStands[i]=ped;
    const m=new THREE.Mesh(ballGeo,matDeep);
    m.position.set(base.x,1.05,base.z);scene.add(m);
    deepBalls[i]=m;
  });
  const hdir=HOOP.clone().sub(HALFCOURT.p);hdir.y=0;hdir.normalize();
  const hbase=HALFCOURT.p.clone().addScaledVector(hdir,-0.8);
  const hpedMat=new THREE.MeshLambertMaterial({color:0x263b18});
  const hped=window.AIBAModelDetail?.enabled?AIBAModelDetail.pedestal(.62,1,hpedMat,1):
    new THREE.Mesh(new THREE.BoxGeometry(0.62,1.0,0.62),hpedMat);
  hped.position.set(hbase.x,0.5,hbase.z);hped.visible=false;scene.add(hped);
  halfCourtBall=new THREE.Mesh(ballGeo,matDeep);
  halfCourtBall.position.set(hbase.x,1.16,hbase.z);halfCourtBall.visible=false;scene.add(halfCourtBall);
  halfCourtBall.ped=hped;
}
function resetRackBalls(){
  // 绝杀时刻模拟的是真实比赛回合,场上不该有投篮架和备用球
  const showRacks=G.mode!=="battle"&&G.mode!=="lastshot";
  rackStands.forEach(stand=>{stand.visible=showRacks;});
  deepStands.forEach(stand=>{stand.visible=showRacks;});
  if(showRacks)placeRacks(currentRackSide());
  rackBalls.forEach((r,ri)=>{r.forEach(m=>{m.visible=showRacks;});if(showRacks)seatRackBalls(ri,0,false);});
  deepBalls.forEach(m=>{m.visible=showRacks;});
  if(halfCourtBall){halfCourtBall.visible=false;halfCourtBall.ped.visible=false;}
}

/* first-person hands + held ball */
const hands=new THREE.Group();
let handBall;
function buildHands(){
  const skin=new THREE.MeshLambertMaterial({color:0xf4c89c});
  const sleeve=new THREE.MeshLambertMaterial({color:0x1d428a});
  [[-0.22,1],[0.22,-1]].forEach(s=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.13,0.42),sleeve);
    arm.position.set(s[0],-0.06,0.16);arm.rotation.y=s[1]*0.25;hands.add(arm);
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.16),skin);
    h.position.set(s[0]*0.85,-0.04,-0.07);hands.add(h);
    const thumb=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.09,0.055),skin);
    thumb.position.set(s[0]*0.85+s[1]*0.08,-0.03,-0.04);thumb.rotation.z=s[1]*0.18;hands.add(thumb);
    for(let i=0;i<4;i++){
      const f=new THREE.Mesh(new THREE.BoxGeometry(0.026,0.08,0.045),skin);
      f.position.set(s[0]*0.85+(i-1.5)*0.032,-0.12,-0.105);hands.add(f);
    }
  });
  handBall=new THREE.Mesh(ballGeo,matBall);
  handBall.position.set(0,0.08,-0.12);
  hands.add(handBall);
  hands.position.set(0,-0.5,-0.62);
  camera.add(hands);
}


window.AIBA.runtime.register("rendering:props",Object.freeze({
  buildRacks,resetRackBalls,buildHands,placeRacks,currentRackSide,rackSlotWorld,
  getRackSide:()=>rackSide,seatRackBalls,takeRackBall,refillRackBalls,
  getRackBalls:()=>({regular:rackBalls,deep:deepBalls,regularStands:rackStands,deepStands,halfCourt:halfCourtBall}),
  getHands:()=>({group:hands,ball:handBall})
}));
