/* Authored era-inspired accessories, not exact reproductions of tattoo lettering. */
(()=>{
 const profiles={bird:{sock:.25,stripes:2},miller:{sock:.24},allen:{sock:.21},j23:{sock:.21,knee:1,kneeColor:0x18191b},a03:{sock:.22,tattoo:'dense',forearmSleeve:0},lillard:{sock:.2,tattoo:'dense'},curry:{sock:.18,tattoo:'small'},k24:{sock:.19,tattoo:'upper'},t01:{sock:.2,knee:0},v15:{sock:.2,knee:0},thompson:{sock:.19},h13:{sock:.19},ionescu:{sock:.19},taurasi:{sock:.22},'sue-bird':{sock:.2}};
 function clear(g){for(const root of g.playerKit||[]){root.parent.remove(root);root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material.map)o.material.map.dispose();o.material.dispose();}});}g.playerKit=[];g.knees.forEach(k=>k.traverse(o=>{if(o.name==="legacySock")o.visible=true;}));}
 function apply(g,star){clear(g);g.knees.forEach(k=>k.traverse(o=>{if(o.name==="legacySock")o.visible=false;}));const p=profiles[star.id]||{sock:.17};
  const add=(parent,geo,color,name)=>{const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color}));m.name=name;parent.add(m);g.playerKit.push(m);return m;};
  for(let side=0;side<2;side++){
   const h=p.sock;const sock=add(g.knees[side],new THREE.CylinderGeometry(.081,.077,h,8,1,false),0xe8e7e2,'crewSock');sock.scale.z=1.09;sock.position.set(0,-.323+h/2,.006);
   for(let i=0;i<(p.stripes||1);i++){const stripe=add(g.knees[side],new THREE.CylinderGeometry(.082,.082,.009,8,1,false),star.col[0],'sockStripe');stripe.scale.z=1.09;stripe.position.set(0,-.323+h-.02-i*.018,.006);}
  }
  if(p.knee!=null){const pad=add(g.knees[p.knee],new THREE.CylinderGeometry(.084,.081,.15,8,1,false),p.kneeColor||0x202127,'kneeSleeve');pad.position.y=-.032;pad.scale.z=1.08;}
  if(p.forearmSleeve!=null){const sl=add(g.elbows[p.forearmSleeve],new THREE.BoxGeometry(.132,.245,.151),star.sleeve||0xe8e7e2,'forearmSleeve');sl.position.y=-.115;}
  if(p.tattoo){
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;const c=canvas.getContext('2d');c.strokeStyle='rgba(38,34,29,.65)';c.lineWidth=2;
   const rows=p.tattoo==='dense'?13:p.tattoo==='small'?2:6;
   for(let i=0;i<rows;i++){const y=8+i*(110/rows);c.beginPath();c.moveTo(12,y);c.lineTo(23,y+5);c.lineTo(39,y+1);c.lineTo(51,y+8);c.stroke();if(i%2===0){c.beginPath();c.arc(31,y+5,7,0,Math.PI*1.6);c.stroke();}}
   const sides=p.tattoo==='dense'?[0,1]:[0];
   for(const side of sides){
    const parent=p.tattoo==='small'?g.forearms[side]:g.upperArms[side];
    if(parent===g.upperArms[side]&&g.sleeves[side].visible)continue;
    const map=new THREE.CanvasTexture(canvas),mat=new THREE.MeshLambertMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const tattoo=new THREE.Mesh(new THREE.PlaneGeometry(p.tattoo==='small'?.055:.095,p.tattoo==='small'?.055:.18),mat);tattoo.name='tattooInk';tattoo.position.set(0,0,parent===g.upperArms[side]?.081:.074);parent.add(tattoo);g.playerKit.push(tattoo);
   }
  }
 }
 window.AIBAPlayerKit=Object.freeze({profiles,apply,clear});
})();
