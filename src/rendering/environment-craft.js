/* Architectural dressing for the four outdoor courts. Metres, deterministic,
   owned by environmentRoot and disposed on every preset change. ?craft=classic
   disables only this pass. No gameplay random stream, lights or collision edits. */
(function(global){
  "use strict";
  const enabled=new URLSearchParams(location.search).get("craft")!=="classic";
  function build(root,name){
    if(!enabled||name==="indoor")return;
    const beach=name==="beachSunset",flower=name==="flowerCourt",rain=name==="rainyCourt";
    const group=new THREE.Group();group.name="courtCraft";root.add(group);
    const parts=[],wires=[],dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
    const colors={steel:0x374c50,stone:0xa5a49a,wood:beach?0xb58b62:0x8b6445,woodLight:0xc29b70,
      trim:beach?0x477f7e:(flower?0x6d8462:0x286c69),leaf:rain?0x345a46:0x426f42};
    function box(x,y,z,w,h,d,c,ry=0){
      dummy.position.set(x,y,z);dummy.rotation.set(0,ry,0);dummy.scale.set(w,h,d);dummy.updateMatrix();
      parts.push({matrix:dummy.matrix.clone(),color:new THREE.Color(c)});
    }
    function beam(a,b,width,c){
      const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
      dummy.position.copy(av).add(bv).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());
      dummy.scale.set(width,delta.length(),width);dummy.updateMatrix();parts.push({matrix:dummy.matrix.clone(),color:new THREE.Color(c)});
    }
    function label(text,sub,x,y,z,w,ry=0){
      const tex=pixTex(512,160,(c)=>{
        c.fillStyle=beach?"#25484b":flower?"#344934":"#253b3e";c.fillRect(0,0,512,160);
        c.fillStyle="#dac399";c.fillRect(14,14,5,132);
        c.font="bold 45px monospace";c.textAlign="center";c.fillStyle="#f2ead9";c.fillText(text,266,76);
        c.font="21px monospace";c.fillStyle="#c2cebc";c.fillText(sub,266,121);
      },{smooth:true,mipmaps:true});
      const mat=new THREE.MeshLambertMaterial({map:tex});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w*160/512),mat);
      mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);
      // Two outward faces keep signs readable from both sides of the fence.
      const back=mesh.clone();back.rotation.y+=Math.PI;
      back.position.x-=Math.sin(ry)*.012;back.position.z-=Math.cos(ry)*.012;group.add(back);
    }
    function bench(x,z,ry=0){
      const p=(dx,y,dz,w,h,d,c)=>box(x+dx*Math.cos(ry)+dz*Math.sin(ry),y,z-dx*Math.sin(ry)+dz*Math.cos(ry),w,h,d,c,ry);
      for(const dx of [-.83,.83]){p(dx,.27,0,.09,.5,.46,colors.steel);p(dx,.65,-.23,.07,.68,.07,colors.steel);}
      for(let i=0;i<4;i++)p(0,.52,-.17+i*.115,2.12,.065,.095,colors.wood);
      for(let i=0;i<3;i++)p(0,.73+i*.115,-.25,2.12,.09,.055,colors.woodLight);
      for(const dx of [-.95,.95])p(dx,.72,0,.07,.065,.52,colors.steel);
    }
    function planter(x,z,w=1.7,d=1.15){
      box(x,.29,z,w,.54,d,colors.stone);box(x,.57,z,w+.09,.08,d+.09,0xcac2aa);
      box(x,.615,z,w-.18,.035,d-.18,0x443f2d);
      for(let i=0;i<5;i++)box(x+(i-2)*w*.14,.8+(i%2)*.12,z+(i%2?-.16:.14),w*.27,.38,.50,colors.leaf);
      if(flower)for(let i=0;i<7;i++){
        const px=x+(i%4-1.5)*w*.19,pz=z+(i<4?-.25:.25),py=1.04+(i%3)*.08;
        box(px,py-.09,pz,.035,.27,.035,0x386039);
        box(px,py,pz,.18,.065,.18,[0xeeb26f,0xdd8290,0xf3dfba][i%3]);box(px,py+.035,pz,.055,.028,.055,0xefd07a);
      }
    }
    function shelter(x,z){
      for(const dx of [-1.55,1.55])for(const dz of [-1.15,1.15]){
        box(x+dx,1.48,z+dz,.13,2.92,.13,colors.steel);
        box(x+dx,.11,z+dz,.28,.18,.28,colors.stone);
      }
      for(let i=0;i<9;i++)box(x+(i-4)*.42,3.02,z,.38,.11,2.8,i%2?colors.trim:0xcac8b4);
      box(x,2.88,z-1.15,3.45,.19,.13,colors.steel);box(x,2.88,z+1.15,3.45,.19,.13,colors.steel);
      bench(x,z+.2);planter(x-2.35,z,.85,1.05);
    }
    function fence(){
      // Fine diamond wire is a single LineSegments draw, independent of the posts.
      const wire=(a,b)=>wires.push(...a,...b);
      for(const x of [-10.2,10.2])for(let z=-9.7;z<19.5;z+=.48){
        for(let y=.18;y<2.35;y+=.48){
          wire([x,y,z],[x,y+.48,z+.48]);wire([x,y+.48,z],[x,y,z+.48]);
        }
      }
      for(const x of [-10.2,10.2])box(x,2.62,4.8,.065,.065,29.6,colors.steel);
      // Low concrete curb carries the fence, with expansion joints and gate-side paving.
      for(const x of [-10.2,10.2])for(let i=0;i<15;i++)box(x,.06,-9+i*2,.20,.12,1.95,colors.stone);
    }
    function city(){
      // A readable near-hoop backdrop: masonry bays, recessed windows, cornices,
      // roof plant and a few fire escapes, all in the same instanced batch.
      for(let i=0;i<7;i++){
        const x=(i-3)*6.2,z=-27-(i%3)*2.4,h=6.2+(i%4)*2.1,w=5.4;
        const wall=[0x8c7162,0x87918a,0x637982,0xa38f73][i%4];
        box(x,h/2-.07,z,w,h,4.5,wall);
        box(x,h+.05,z,w+.3,.22,4.75,0x535b56);box(x,h+.20,z,3.2,.15,2.6,0x424d4e);
        box(x+1,h+.60,z-.2,.9,.8,1.15,0x737b74);
        for(let floor=0;floor<Math.floor(h/1.7);floor++){
          const y=1.1+floor*1.7;
          box(x,y-.72,z+2.30,w+.06,.08,.1,0xb4aa95);
          for(let col=0;col<4;col++){
            const wx=x+(col-1.5)*1.19;
            box(wx,y,z+2.29,.74,1.02,.09,0x404e50);
            box(wx,y+.03,z+2.345,.56,.80,.025,(col+floor+i)%5===0?0xc0b58d:0x799799);
            box(wx,y-.50,z+2.39,.86,.10,.24,0xb9afa0);
            box(wx,y,z+2.365,.035,.83,.035,0xc0b9a4);
          }
        }
        if(i===1||i===5)for(let floor=0;floor<3;floor++){
          const y=1.4+floor*1.7;
          box(x+1.8,y,z+2.65,1.4,.09,.8,colors.steel);
          beam([x+1.15,y,z+3],[x+2.4,y+1.7,z+3],.055,colors.steel);
          box(x+1.8,y+.6,z+3.03,1.4,.05,.05,colors.steel);
        }
      }
      // Layered canopies keep a voxel silhouette instead of a single green cube.
      const positions=[[-14,-8],[-14,-1],[-14,7],[-14,15],[14,-7],[14,1],[14,9],[14,17]];
      positions.forEach(([x,z],i)=>{
        const s=.82+(i%4)*.08,y=3.35*s;
        box(x-.65*s,y+.18,z+.3,1.75*s,1.6*s,2*s,colors.leaf);
        box(x+.57*s,y+.55,z-.23,1.9*s,1.45*s,1.7*s,rain?0x45634c:0x648b4d);
        box(x-.13,y+1.20,z-.1,1.55*s,.7*s,1.55*s,rain?0x526f54:0x7b9c58);
        box(x,.055,z,1.6,.1,1.6,colors.stone);
      });
      shelter(12.4,12);bench(-11.9,5,Math.PI/2);bench(-11.9,-4,Math.PI/2);
      planter(-12,1);planter(12,-3);
      // Entry signage is well outside the playable floor.
      for(const x of [-2.55,2.55])box(x,1.95,24.5,.19,3.9,.19,colors.steel);
      box(0,3.63,24.5,5.55,.87,.18,colors.trim);
      label(flower?"BLOOM GARDEN":"NEIGHBORHOOD",flower?"GROW THE GAME":"PUBLIC BASKETBALL CLUB",0,3.63,24.395,5.1,Math.PI);
      label(flower?"BLOOM COURT":"THE LOCAL",flower?"EVERY BUCKET BLOOMS":"OPEN COURT / ALL WELCOME",-10.25,1.58,5,2.1,Math.PI/2);
      // Small three-row bleachers beyond the baseline, with individual seat slats.
      for(let row=0;row<3;row++){
        const z=22.8+row*.62,y=.43+row*.33;
        box(-6,y-.08,z,5.1,.12,.53,colors.steel);
        for(let seat=0;seat<8;seat++)box(-8.15+seat*.61,y,z,.52,.08,.44,colors.woodLight);
        for(const x of [-8,-4])box(x,y/2,z,.1,y,.1,colors.steel);
      }
      if(flower){
        for(const x of [-12.5,12.5]){
          for(const z of [-6.5,-1.5])box(x,1.75,z,.20,3.5,.20,colors.wood);
          box(x,3.42,-4,.22,.25,5.6,colors.wood);
          for(let i=0;i<12;i++)box(x,3.64,-6.7+i*.49,2.7,.12,.15,colors.woodLight);
          planter(x,-6.5,1.7,1.2);planter(x,-1.5,1.7,1.2);
          for(let i=0;i<9;i++)box(x+(i%2?-.44:.35),3.73,-6.2+i*.54,.9,.24,.7,i%2?0x678455:0x87975f);
        }
      }
      if(rain){
        // Curb drains make the weather feel attached to a built place.
        for(const x of [-9.9,9.9])for(const z of [-6,2,10,18]){
          box(x,.012,z,.27,.015,.7,0x37474c);
          for(let i=0;i<7;i++)box(x,.024,z-.28+i*.09,.24,.012,.018,0x7c8b88);
        }
      }
    }
    function coast(){
      // Boardwalk slats and a low sea wall frame the court without closing the horizon.
      for(const x of [-12.1,12.1]){
        for(let i=0;i<85;i++)box(x,-.027,-11.8+i*.41,3.25,.07,.38,i%4?colors.wood:colors.woodLight);
        box(x,.11,-12.25,3.4,.2,.24,0xbcb2a0);
      }
      for(let i=0;i<64;i++)box(-19+i*.6,.025,-14.5,.57,.08,3.3,i%3?colors.wood:colors.woodLight);
      for(const x of [-17,-9,9,17]){
        box(x,.6,-16.3,.12,1.2,.12,colors.steel);box(x,.045,-16.3,.26,.08,.26,colors.stone);
      }
      box(0,1.10,-16.3,34,.065,.065,colors.steel);box(0,.63,-16.3,34,.045,.045,colors.steel);
      // Raised lifeguard cabin: deck, supports, front windows, louvers and steps.
      const x=-18,z=-18.6;
      for(const dx of [-1.15,1.15])for(const dz of [-.9,.9])box(x+dx,.85,z+dz,.19,1.7,.19,colors.wood);
      box(x,1.70,z,3.7,.16,3.1,colors.woodLight);box(x,2.68,z,2.85,1.85,2.25,0xe0cba7);
      box(x,3.69,z,3.45,.18,2.8,colors.trim);
      for(const dx of [-.78,0,.78]){
        box(x+dx,2.99,z+1.137,.64,.77,.035,0x324f57);
        box(x+dx,2.55,z+1.2,.73,.075,.20,0xf0dfbd);
      }
      for(let i=0;i<7;i++)box(x,1.94+i*.2,z-1.14,2.86,.04,.035,0xbda889);
      for(let i=0;i<6;i++)box(x+2.15,.15+i*.26,z+2.0-i*.28,1.0,.15,.35,colors.woodLight);
      beam([x+2.62,.7,z+2.2],[x+2.62,2.15,z+.6],.075,colors.wood);
      label("COAST GUARD","WEST COAST / 07",x,2.10,z+1.14,2.15);
      shelter(12.3,11);bench(-12,3,Math.PI/2);bench(12,2,-Math.PI/2);
      planter(12,-5);planter(-12,8);
      // Shade sails are stepped fabric strips, staying true to block construction.
      for(const sx of [-1,1]){
        const px=sx*17,pz=3;
        for(const dx of [-1.6,1.6])box(px+dx,1.8,pz,.13,3.6,.13,colors.wood);
        for(let i=0;i<10;i++)box(px+(i-4.5)*.39,3.45+Math.abs(i-4.5)*.025,pz,.38,.09,2.7,i%2?0xdeb789:0xf0dfba);
        bench(px,pz);
      }
      label("WEST COAST","SUNSET BASKETBALL CLUB",10.25,1.58,4,2.4,-Math.PI/2);
      // Palm bark rings and split leaf tips add structure to the existing palms.
      [[-14,-9],[-14,3],[-14,15],[14,-6],[14,7],[14,17]].forEach(([px,pz],pi)=>{
        const first=parts.length;
        for(let j=0;j<12;j++)box(px,.3+j*.35,pz,.36,.045,.36,0x947459);
        for(let j=0;j<8;j++){
          const a=j*Math.PI/4,dx=Math.cos(a),dz=Math.sin(a);
          beam([px,4.8,pz],[px+dx*1.35,4.65,pz+dz*1.35],.18,0x436b48);
          beam([px+dx*1.35,4.65,pz+dz*1.35],[px+dx*2.05,4.10,pz+dz*2.05],.13,0x6d874c);
        }
        const transform=new THREE.Matrix4().makeTranslation(px,0,pz)
          .multiply(new THREE.Matrix4().makeRotationZ((pi%2?1:-1)*.035))
          .multiply(new THREE.Matrix4().makeTranslation(-px,0,-pz));
        for(let n=first;n<parts.length;n++)parts[n].matrix.premultiply(transform);
      });
    }
    fence();if(beach)coast();else city();
    function finish(list){
      if(!list.length)return;
      const mat=new THREE.MeshLambertMaterial({color:0xffffff});
      const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,list.length);
      list.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,p.color);});
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
      mesh.name="craftArchitecture";mesh.castShadow=false;mesh.receiveShadow=true;
      // r128 does not compute an aggregate instance bound; the unit cube is not our extent.
      mesh.frustumCulled=false;group.add(mesh);
    }
    finish(parts);
    const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute("position",new THREE.Float32BufferAttribute(wires,3));
    const wireMesh=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:rain?0x617676:0x6c807a,transparent:true,opacity:.34,depthWrite:false}));
    wireMesh.name="craftFenceWeave";group.add(wireMesh);
    group.userData={preset:name,boxes:parts.length,wireSegments:wires.length/6};
  }
  global.AIBAEnvironmentCraft=Object.freeze({enabled,build});
})(window);
