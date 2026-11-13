/* 逐帧量一次甜区出手的全过程(60 帧每秒)。先注入 harness.js,再注入本文件,然后 await __M.run()。 */
(function(){
  const M=window.__M={};
  const dtms=16.7;let fk=performance.now();
  M.setup=async function(){
    await __H.boot();
    fk=performance.now();performance.now=()=>fk;
    AIBA.runtime.service("core:game-loop").clock.getDelta=()=>dtms/1000;
  };
  M.sf=n=>{for(let i=0;i<(n||1);i++){fk+=dtms;__H.step(1);}};
  M.run=function(relK){
    const root=AIBATripo.root,bn=n=>root.getObjectByName("mixamorig"+n);
    const Bn={hip:bn("Hips"),rh:bn("RightHand"),lh:bn("LeftHand"),head:bn("Head"),rf:bn("RightFoot")};
    const rec=[],v=new THREE.Vector3();
    const snap=tag=>{const o={tag,k:+poseK.toFixed(3),held:pBall.visible?1:0};
      for(const n in Bn){Bn[n].getWorldPosition(v);o[n]=[v.x,v.y,v.z];}rec.push(o);};
    __H.practice();__H.ready();
    for(let i=0;i<10;i++){M.sf(1);snap("idle");}
    const ideal=weatherAdjustedIdeal(curShot(),false);
    startCharge();let g=0;
    while(G.charging&&G.power<ideal*(relK||1)&&g++<900){M.sf(1);snap("charge");}
    if(G.charging)doRelease();
    for(let i=0;i<110;i++){M.sf(1);snap("after");}
    const dt=dtms/1000,sp=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])/dt;
    for(let i=1;i<rec.length;i++)for(const n in Bn)rec[i]["v"+n]=sp(rec[i-1][n],rec[i][n]);
    M.rec=rec;
    const rows=[];
    for(let i=8;i<rec.length;i+=2){const b=rec[i];rows.push([i,b.tag[0],"k"+b.k.toFixed(2),"hip"+b.hip[1].toFixed(2),"rh"+b.rh[1].toFixed(2),"ft"+b.rf[1].toFixed(2),
      "vHip"+(b.vhip||0).toFixed(1),"vRH"+(b.vrh||0).toFixed(1),"vLH"+(b.vlh||0).toFixed(1),"vHd"+(b.vhead||0).toFixed(1),b.held?"":"rel"].join(" "));}
    const spikes=[];
    for(let i=2;i<rec.length;i++)for(const n in Bn){const a=(rec[i]["v"+n]-rec[i-1]["v"+n])/dt;if(Math.abs(a)>70)spikes.push(i+" "+rec[i].tag[0]+" k"+rec[i].k+" "+n+" "+a.toFixed(0));}
    return {rows,spikes};
  };
})();
