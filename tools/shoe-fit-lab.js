/* Shoe fitting lab v0.3. No production entrypoint, skeleton edits or preset styling.
 * Design: normalized L=1. Fitting: anchor transform only, never mesh bounding boxes.
 */
(()=>{
 const standard=Object.freeze({forefootWidth:.39,midfootWidth:.30,heelWidth:.32,soleThickness:.11,toeHeight:.17,instepHeight:.29,highTopReference:.46});
 // z / full width / bottom / roof. Ankle origin is 26% of L from heel.
 const sections=Object.freeze([[-.26,.22,.012,.19],[-.21,.32,0,.24],[-.08,.32,0,.29],[.12,.30,0,.265],[.30,.35,0,.225],[.48,.39,.004,.17],[.65,.32,.016,.155],[.74,.18,.025,.135]]);
 function build({highTop=false}={}){
  const v=[],ix=[];
  for(const [z,w,b,h]of sections){const r=w/2;for(const [x,y]of [[-.78*r,b],[-r,b+.025],[-r,h*.63],[-.67*r,h],[.67*r,h],[r,h*.63],[r,b+.025],[.78*r,b]])v.push(x,y,z);}
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8;ix.push(a,a+8,b,b,a+8,b+8);}
  for(let k=1;k<7;k++){ix.push(0,k,k+1);const n=(sections.length-1)*8;ix.push(n,n+k+1,n+k);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(ix);const flat=geo.toNonIndexed();geo.dispose();flat.computeVertexNormals();
  const mesh=new THREE.Mesh(flat,new THREE.MeshLambertMaterial({color:new THREE.Color(0x888888).convertSRGBToLinear()}));mesh.name='ShoeLastDebug';if(highTop)mesh.add(buildCollar());mesh.userData={standard,sections,triangles:flat.attributes.position.count/3};return mesh;
 }
 // Optional high-top envelope, separate from the universal shoe last.
 function buildCollar(){
  const rings=[{w:.16,d:.23,front:.52,y:.215},{w:.15,d:.17,front:.17,y:.46},{w:.132,d:.151,front:.151,y:.46},{w:.138,d:.208,front:.495,y:.215}],v=[],ix=[];
  for(const r of rings)for(const [x,z]of [[-.7,-1],[-1,-.65],[-1,.65],[-.7,1],[.7,1],[1,.65],[1,-.65],[.7,-1]])v.push(x*r.w,r.y-(z>0?(r.y>.4?.012:.055*z):0),z*(z>0?r.front:r.d));
  for(let j=0;j<4;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=((j+1)%4)*8+(i+1)%8,d=((j+1)%4)*8+i;ix.push(a,b,d,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();
  const m=new THREE.Mesh(flat,new THREE.MeshLambertMaterial({color:new THREE.Color(0x888888).convertSRGBToLinear(),side:THREE.DoubleSide}));m.name='HighTopEnvelopeDebug';m.userData={height:.46,topOuterWidth:.30,topInnerWidth:.264,rampStartZ:.52,rampEndZ:.17,rampStartY:.16,rampEndY:.448,triangles:128};return m;
 }
 function clear(guy){const fit=guy.shoeFitDebug;if(!fit)return;for(const root of fit.created){root.removeFromParent?root.removeFromParent():root.parent.remove(root);root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}for(const [mesh,visible]of fit.hidden)mesh.visible=visible;delete guy.shoeFitDebug;}
 function apply(guy,{length=.44,groundOffset=-.12,yaw=0}={}){
  if(!(length>0))throw Error('Shoe length must be positive');clear(guy);
  const created=[],hidden=[],audit=[],seen=new Set();
  const hide=(mesh,reason)=>{if(!mesh.isMesh||seen.has(mesh))return;seen.add(mesh);hidden.push([mesh,mesh.visible]);audit.push({name:mesh.name||'(unnamed mesh)',reason,wasVisible:mesh.visible});mesh.visible=false;};
  for(const foot of guy.footRoots)foot.traverse(o=>hide(o,'old foot/toe/shoe visual; keep every rig node'));
  for(const ankle of guy.ankles)ankle.children.forEach(o=>{if(o.name==='ankleBlend'||o.name==='sockKnit')o.traverse(m=>hide(m,'replace blocky ankle visual'));});
  // Keep upper calf shape; taper only the lower visual, with no bone mutation.
  for(const knee of guy.knees){const replacements=[];knee.traverse(m=>{if(m.isMesh&&['calf','crewSock','sockStripe','legacySock'].includes(m.name)){const visible=m.visible;hide(m,'lower-leg/sock visual proxy');if(visible)replacements.push(m);}});
   for(const old of replacements){const proxy=old.clone(false);proxy.geometry=(old.name==='crewSock'||old.name==='sockStripe')?new THREE.BoxGeometry(.168,old.geometry.parameters.height,.174,1,6,1):old.geometry.clone();proxy.material=old.material.clone();proxy.name='shoeEquipped_'+old.name;proxy.visible=true;
    const a=proxy.geometry.attributes.position;for(let i=0;i<a.count;i++){const kneeY=a.getY(i)*old.scale.y+old.position.y;const t=THREE.MathUtils.clamp((kneeY+.19)/.10,0,1);const taper=.60+.40*t;a.setXYZ(i,a.getX(i)*taper,a.getY(i),a.getZ(i)*taper);}proxy.geometry.computeVertexNormals();old.parent.add(proxy);created.push(proxy);
   }
  }
  guy.ankles.forEach((ankle,i)=>{const proxy=new THREE.Mesh(new THREE.CylinderGeometry(.055,.05,.115,8),new THREE.MeshLambertMaterial({color:0xb0b0b0}));proxy.name='shoeEquippedAnkleProxy';proxy.position.set(0,.037,0);ankle.add(proxy);created.push(proxy);
   const anchor=new THREE.Group();anchor.name='ShoeFitAnchor';anchor.position.set(0,groundOffset,0);anchor.rotation.y=yaw;anchor.scale.setScalar(length);anchor.userData={length,side:i===0?'right':'left',orientation:'inherited footRig; symmetric last needs no reflection',groundOffset};anchor.add(build({highTop:true}));guy.footRoots[i].add(anchor);created.push(anchor);
  });
  guy.shoeFitDebug={created,hidden,audit,length};return guy.shoeFitDebug;
 }
 // Visual-only contact fitting. No ankle/foot/toe transform is changed.
 function sync(guy,{grounded=true,groundY=0}={}){
  const fit=guy.shoeFitDebug;if(!fit)return [];
  return fit.created.filter(o=>o.name==='ShoeFitAnchor').map((anchor,i)=>{
   anchor.position.y=anchor.userData.groundOffset;anchor.updateMatrix();guy.g.updateMatrixWorld(true);
   const min=new THREE.Box3().setFromObject(anchor).min.y;const contact=Array.isArray(grounded)?grounded[i]:grounded;
   let correction=0;if(contact){const e=anchor.parent.matrixWorld.elements;correction=(groundY-min)/e[5];anchor.position.y+=correction;anchor.updateMatrix();}
   guy.g.updateMatrixWorld(true);return {side:anchor.userData.side,correction,before:min,after:new THREE.Box3().setFromObject(anchor).min.y};
  });
 }
 window.AIBAShoeFitLab=Object.freeze({version:'0.3',standard,sections,build,apply,clear,sync});
})();
