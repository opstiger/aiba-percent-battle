/* racks & rack balls */
const rackBalls=[]; const deepBalls=[]; const rackStands=[]; const deepStands=[]; let halfCourtBall=null;
function buildRacks(){
  const standM=new THREE.MeshLambertMaterial({color:0x2255aa});
  RACKS.forEach((r,ri)=>{
    const dir=HOOP.clone().sub(r.p);dir.y=0;dir.normalize();
    const base=r.p.clone().addScaledVector(dir,-0.85);
    const stand=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.55,0.5),standM);
    stand.position.set(base.x,0.45,base.z);
    stand.rotation.y=Math.atan2(dir.x,dir.z);scene.add(stand);rackStands[ri]=stand;
    const perp=V3(dir.z,0,-dir.x);
    rackBalls[ri]=[];
    for(let b=0;b<5;b++){
      const mat=b===4?matGold:matBall;
      const m=new THREE.Mesh(ballGeo,mat);
      const off=(b-2)*0.3;
      m.position.set(base.x+perp.x*off,0.86,base.z+perp.z*off);
      m.rotation.set(rnd(0,1),rnd(0,1),0);
      scene.add(m);rackBalls[ri].push(m);
    }
  });
  DEEPS.forEach((d,i)=>{
    const ped=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.9,0.45),
      new THREE.MeshLambertMaterial({color:0x1f7a28}));
    const dir=HOOP.clone().sub(d.p);dir.y=0;dir.normalize();
    const base=d.p.clone().addScaledVector(dir,-0.8);
    ped.position.set(base.x,0.45,base.z);scene.add(ped);deepStands[i]=ped;
    const m=new THREE.Mesh(ballGeo,matDeep);
    m.position.set(base.x,1.05,base.z);scene.add(m);
    deepBalls[i]=m;
  });
  const hdir=HOOP.clone().sub(HALFCOURT.p);hdir.y=0;hdir.normalize();
  const hbase=HALFCOURT.p.clone().addScaledVector(hdir,-0.8);
  const hped=new THREE.Mesh(new THREE.BoxGeometry(0.62,1.0,0.62),
    new THREE.MeshLambertMaterial({color:0x263b18}));
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
  rackBalls.forEach(r=>r.forEach(m=>{m.visible=showRacks;}));
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
  buildRacks,resetRackBalls,buildHands,
  getRackBalls:()=>({regular:rackBalls,deep:deepBalls,regularStands:rackStands,deepStands,halfCourt:halfCourtBall}),
  getHands:()=>({group:hands,ball:handBall})
}));
