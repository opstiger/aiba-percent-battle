/* Accepted v0.3 normalized ShoeLast. Never infer design from character mesh bounds. */
(()=>{
 const standard=Object.freeze({forefootWidth:.39,midfootWidth:.30,heelWidth:.32,soleThickness:.11,toeHeight:.17,instepHeight:.29,highTopReference:.46});
 // z / full width / bottom / roof. Ankle origin is 26% of L from heel.
 const sections=Object.freeze([[-.26,.22,.012,.19],[-.21,.32,0,.24],[-.08,.32,0,.29],[.12,.30,0,.265],[.30,.35,0,.225],[.48,.39,.004,.17],[.65,.32,.016,.155],[.74,.18,.025,.135]]);
 function build(){
  const v=[],ix=[];
  for(const [z,w,b,h]of sections){const r=w/2;for(const [x,y]of [[-.78*r,b],[-r,b+.025],[-r,h*.63],[-.67*r,h],[.67*r,h],[r,h*.63],[r,b+.025],[.78*r,b]])v.push(x,y,z);}
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8;ix.push(a,a+8,b,b,a+8,b+8);}
  for(let k=1;k<7;k++){ix.push(0,k,k+1);const n=(sections.length-1)*8;ix.push(n,n+k+1,n+k);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(ix);const flat=geo.toNonIndexed();geo.dispose();flat.computeVertexNormals();
  const mesh=new THREE.Mesh(flat,new THREE.MeshLambertMaterial({color:new THREE.Color(0x888888).convertSRGBToLinear()}));mesh.name='ShoeLastDebug';mesh.userData={standard,sections,triangles:flat.attributes.position.count/3};return mesh;
 }
 window.AIBAShoeLast=Object.freeze({standard,sections,build});
})();
