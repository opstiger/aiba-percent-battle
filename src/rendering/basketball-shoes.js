/* CharacterFit: visual mounting only. Never changes ankle/foot/toe skeleton transforms. */
(()=>{
 const active=new Set();
 function clear(guy){const fit=guy.baseShoeKit;if(!fit)return;for(const root of fit.created){if(root.parent)root.parent.remove(root);if(root.name==='ShoeFitAnchor')continue;root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}for(const [mesh,visible]of fit.hidden)mesh.visible=visible;delete guy.baseShoeKit;active.delete(guy);}
 function apply(guy,name="Preset_A_RetroHigh",options={}){
  const {length=.44,groundOffset=-.12,yaw=0,colorway='classicRedBlackWhite',family=null,sock=null,sockStripe=null}=options;
  /* family 为空时仍走已验收的 RetroHigh,预设名校验一个字没动;
     指定 family 时交给 AIBAShoeStyles,那边只接受注册过的品系。 */
  /* RetroHighPanels 是工厂内建的那一款,不在 AIBAShoeStyles.families 里 ——
     分配表会把它发给乔丹,所以这里必须认。 */
  const builtIn=!family||family==='RetroHighPanels';
  const known=!builtIn&&window.AIBAShoeStyles&&AIBAShoeStyles.families.includes(family);
  if(family&&!builtIn&&!known)throw Error('Unsupported shoe family '+family);
  if(!family&&name!=='Preset_A_RetroHigh'&&name!=='RetroHigh')throw Error('Unsupported preset '+name);
  if(!(length>0))throw Error('Shoe length must be positive');clear(guy);
  const created=[],hidden=[],audit=[],roots=[],seen=new Set();
  const hide=(mesh,reason)=>{if(!mesh.isMesh||seen.has(mesh))return;seen.add(mesh);hidden.push([mesh,mesh.visible]);audit.push({name:mesh.name||'(unnamed mesh)',reason,wasVisible:mesh.visible});mesh.visible=false;};
  for(const foot of guy.footRoots)foot.traverse(o=>hide(o,'old foot/toe/shoe visual; keep every rig node'));
  for(const ankle of guy.ankles)ankle.children.forEach(o=>{if(o.name==='ankleBlend'||o.name==='sockKnit')o.traverse(m=>hide(m,'replace blocky ankle visual'));});
  // Keep upper calf shape; taper only the lower visual, with no bone mutation.
  for(const knee of guy.knees){const replacements=[];knee.traverse(m=>{if(m.isMesh&&['calf','crewSock','sockStripe','legacySock'].includes(m.name)){const visible=m.visible;hide(m,'lower-leg/sock visual proxy');if(visible)replacements.push(m);}});
   for(const old of replacements){const proxy=old.clone(false);proxy.geometry=(old.name==='crewSock'||old.name==='sockStripe')?new THREE.BoxGeometry(.168,old.geometry.parameters.height,.174,1,6,1):old.geometry.clone();proxy.material=old.material.clone();proxy.name='shoeEquipped_'+old.name;proxy.userData.shoeFitVisual=true;proxy.visible=true;
    /* 袜子跟着配色走,但只染袜筒和袜条 —— calf 用的是皮肤材质,染了会把小腿变色。 */
    if(sock!=null&&(old.name==='crewSock'||old.name==='legacySock'))proxy.material.color.setHex(sock).convertSRGBToLinear();
    if(sockStripe!=null&&old.name==='sockStripe')proxy.material.color.setHex(sockStripe).convertSRGBToLinear();
    const a=proxy.geometry.attributes.position;for(let i=0;i<a.count;i++){const kneeY=a.getY(i)*old.scale.y+old.position.y;const t=THREE.MathUtils.clamp((kneeY+.19)/.10,0,1);const taper=.60+.40*t;a.setXYZ(i,a.getX(i)*taper,a.getY(i),a.getZ(i)*taper);}proxy.geometry.computeVertexNormals();old.parent.add(proxy);created.push(proxy);
   }
  }
  guy.ankles.forEach((ankle,i)=>{const proxy=new THREE.Mesh(new THREE.CylinderGeometry(.055,.05,.115,8),new THREE.MeshLambertMaterial({color:0xb0b0b0}));proxy.name='shoeEquippedAnkleProxy';proxy.userData.shoeFitVisual=true;proxy.position.set(0,.037,0);ankle.add(proxy);created.push(proxy);
   const anchor=new THREE.Group();anchor.name='ShoeFitAnchor';anchor.position.set(0,groundOffset,0);anchor.rotation.y=yaw;anchor.scale.setScalar(length);anchor.userData={length,side:i===0?'right':'left',orientation:'inherited footRig; symmetric last needs no reflection',groundOffset};const shoe=known?AIBAShoeStyles.build(family,{colorway}):AIBARetroHigh.createBasketballShoe({colorway});shoe.name=i===0?'right_shoe':'left_shoe';anchor.add(shoe);guy.footRoots[i].add(anchor);created.push(anchor);roots.push(anchor);
  });
  guy.baseShoeKit={created,hidden,audit,length,roots,options:{length,groundOffset,yaw,colorway,family,sock,sockStripe},offsets:[0,0],lastContacts:[]};active.add(guy);return guy.baseShoeKit;
 }

 // Use the existing animation's sole reference as contact signal, including toe roll.
 // Reusable vectors and precomputed sole samples avoid frame-by-frame geometry allocations.
 const point=new THREE.Vector3();
 const soleSamples=AIBAShoeLast.sections.flatMap(([z,w,b])=>[[-w*.39,b,z],[w*.39,b,z]]);
 function soleY(anchor){let min=Infinity;for(const xyz of soleSamples){point.set(...xyz).applyMatrix4(anchor.matrixWorld);min=Math.min(min,point.y);}return min;}
 function update(guy,dt=1/60,options={}){
  const fit=guy.baseShoeKit;if(!fit)return;
  guy.g.updateMatrixWorld(true);
  /* Every input is screened for finiteness before it can reach the integrator.
     The smoothing below feeds on its own previous output, so a single NaN frame from
     upstream (a fresh run cycle emits NaN lean/bob for one frame when its dt is bad)
     would otherwise pin anchor.position.y to NaN for the rest of the session: the shoe
     vanishes from rendering and poisons runFootGroundY's Box3 for the whole foot.
     A non-finite frame therefore resets the integrator instead of accumulating. */
  const step=Number.isFinite(dt)?Math.max(0,dt):1/60;
  fit.roots.forEach((anchor,i)=>{
   anchor.position.y=anchor.userData.groundOffset;anchor.updateMatrix();anchor.updateMatrixWorld(true);
   const before=soleY(anchor),axis=anchor.parent.matrixWorld.elements[5];
   if(!Number.isFinite(before)||!Number.isFinite(axis)){fit.offsets[i]=0;return;}
   /* 脚掌过陡时不做修正,但仍要留下这一帧的测量 —— 调用方问"鞋底发生了什么",
      拿到空数组和拿到"测过、没修正"是两回事。 */
   if(Math.abs(axis)<.2){fit.offsets[i]=Number.isFinite(fit.offsets[i])?fit.offsets[i]:0;
    fit.lastContacts[i]={reference:before,contact:0,correction:0,before,after:before};return;}
   const ground=Number.isFinite(options.groundY)?options.groundY:0;
   const measured=typeof runFootGroundY==='function'?runFootGroundY(guy,i):before;
   const reference=Number.isFinite(measured)?measured:before;
   const rawContact=options.grounded==null?1-THREE.MathUtils.smoothstep(reference-ground,.008,.045):(Array.isArray(options.grounded)?+options.grounded[i]:+options.grounded);
   const contact=THREE.MathUtils.clamp(Number.isFinite(rawContact)?rawContact:0,0,1);
   const target=THREE.MathUtils.clamp((Math.max(ground,reference)-before)/axis,-.045,.045)*contact;
   if(!Number.isFinite(target)){fit.offsets[i]=0;
    fit.lastContacts[i]={reference,contact,correction:0,before,after:before};return;}
   const previous=Number.isFinite(fit.offsets[i])?fit.offsets[i]:0;
   const alpha=1-Math.exp(-35*step);let correction=options.snap?target:previous+(target-previous)*alpha;
   // Non-penetration is immediate; unloading decays continuously rather than popping.
   if(before+correction*axis<ground&&contact>0)correction=(ground-before)/axis;
   if(!Number.isFinite(correction))correction=0;
   fit.offsets[i]=correction;anchor.position.y+=correction;anchor.updateMatrix();anchor.updateMatrixWorld(true);
   fit.lastContacts[i]={reference,contact,correction,before,after:soleY(anchor)};
  });
 }
 function updateAll(dt){for(const guy of active)if(guy.g.visible)update(guy,dt);}
 function build(name='Preset_A_RetroHigh',options={}){if(name!=='Preset_A_RetroHigh'&&name!=='RetroHigh')throw Error('Unsupported preset '+name);return AIBARetroHigh.createBasketballShoe(options);}
 window.AIBABasketballShoes=Object.freeze({build,apply,clear,update,updateAll,presets:{Preset_A_RetroHigh:AIBARetroHigh.preset},colorways:AIBARetroHigh.colorways});
})();
