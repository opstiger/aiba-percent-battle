/* A small authored population using the arena's real skewed aisle geometry. */
(()=>{
  const state={root:null,walkers:[],paths:[]};
  const mix=(a,b,t)=>a+(b-a)*t;
  function point(path,k){
    const T=BOWL_TIERS[path.tier],a=(path.aisle+1)*Math.PI*2/AISLE_COUNT+k*AISLE_SKEW;
    const [x,z]=bowlPt(a,mix(T.rx0,T.rx1,k),mix(T.rz0,T.rz1,k));
    return new THREE.Vector3(x,mix(T.y0,T.y1,k),z);
  }
  function build(){
    if(state.root)return;
    const root=new THREE.Group();root.name="arenaAisleLife";indoorRoot.add(root);state.root=root;
    const mobile=matchMedia('(pointer:coarse)').matches;
    // Coordinates follow buildStands directly, including the skew of each aisle.
    const parts=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
    for(let tier=1;tier<3;tier++)for(let aisle=0;aisle<AISLE_COUNT;aisle++){
      const path={tier,aisle,steps:(BOWL_TIERS[tier].rows-1)*4};state.paths.push(path);
      for(let j=0;j<path.steps;j++){
        const a=point(path,j/path.steps),b=point(path,(j+1)/path.steps),mid=a.clone().add(b).multiplyScalar(.5),h=b.y-a.y;
        mid.y=b.y-h*.5-.035;
        q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(b.x-a.x,b.z-a.z));
        matrix.compose(mid,q,new THREE.Vector3(.76,h+.07,Math.hypot(b.x-a.x,b.z-a.z)+.035));
        parts.push({color:0x3c414a,matrix:matrix.clone()});
      }
      for(const k of [0,1]){
        const p=point(path,k),next=point(path,k===0?.01:.99),angle=Math.atan2(next.x-p.x,next.z-p.z);
        q.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);p.y-=.07;
        matrix.compose(p,q,new THREE.Vector3(.76,.14,.85));parts.push({color:0x3c414a,matrix:matrix.clone()});
      }
    }
    bakeVoxelMesh(root,parts).name="arenaAisleSteps";
    const cube=new THREE.BoxGeometry(1,1,1),mat=c=>new THREE.MeshLambertMaterial({color:new THREE.Color(c).convertSRGBToLinear()});
    const skin=mat(0xc99970),pants=mat(0x253344),shoe=mat(0xc7c6b6),shirt=[mat(0xb7a669),mat(0x477782),mat(0x7e5144)];
    for(let i=0;i<(mobile?4:8);i++){
      const g=new THREE.Group();g.name="aisleWalker";root.add(g);
      bakeVoxelMesh(g,[{color:shirt[i%3].color,pos:[0,.93,0],scale:[.34,.54,.22]},{color:skin.color,pos:[0,1.39,0],scale:[.25,.28,.24]},{color:0x292622,pos:[0,1.55,0],scale:[.27,.07,.25]}]);
      const legs=[],arms=[];
      for(const side of [-1,1]){
        const leg=new THREE.Group();leg.position.set(side*.095,.68,0);g.add(leg);
        showBox(leg,cube,pants,0,-.3,0,.13,.6,.15);showBox(leg,cube,shoe,0,-.64,.045,.17,.09,.25);legs.push(leg);
        const arm=new THREE.Group();arm.position.set(side*.24,1.15,0);g.add(arm);showBox(arm,cube,skin,0,-.22,0,.1,.45,.12);arms.push(arm);
      }
      const path=state.paths[[2,4,1,5,8,10,7,11][i]],duration=22+i*2.1;
      state.walkers.push({g,legs,arms,path,duration,offset:i*5.71,status:"walk",distance:0});
    }
    update(0);
  }
  function update(t){
    if(!state.root||!indoorRoot.visible)return;
    for(const w of state.walkers){
      const cycle=w.duration*2+8,u=(t+w.offset)%cycle,forward=u<w.duration+4;
      const travel=forward?u:u-w.duration-4,walking=travel<w.duration;
      const k=forward?Math.min(1,travel/w.duration):1-Math.min(1,travel/w.duration);
      const p=point(w.path,k),behind=point(w.path,Math.max(0,k-.003)),ahead=point(w.path,Math.min(1,k+.003));
      const T=BOWL_TIERS[w.path.tier];p.y=mix(T.y0,T.y1,Math.ceil(k*w.path.steps)/w.path.steps);
      w.g.position.copy(p);w.g.rotation.y=Math.atan2(ahead.x-behind.x,ahead.z-behind.z)+(forward?0:Math.PI);
      // A four-second landing pause includes a gradual turn before the return journey.
      if(!walking)w.g.rotation.y+=Math.min(Math.PI,Math.max(0,travel-w.duration-2)*Math.PI/2);
      const gait=t*4.6+w.offset,amp=walking?.35:0;
      w.legs[0].rotation.x=Math.sin(gait)*amp;w.legs[1].rotation.x=-w.legs[0].rotation.x;
      w.arms[0].rotation.x=-Math.sin(gait)*amp*.65;w.arms[1].rotation.x=-w.arms[0].rotation.x;
      w.g.position.y+=walking?.025+Math.abs(Math.sin(gait))*.035:0;
      w.status=walking?"walk":"pause";w.distance=k;
    }
  }
  window.AIBACrowdLife=Object.freeze({build,update,state});
})();
