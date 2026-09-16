/* Bred color study on accepted v0.3 geometry. No branding or silhouette reshaping. */
(()=>{
 const palette={black:0x18191b,red:0xb8322b,white:0xd8d7d1};
 function clipped(poly,y,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=above?a[1]>=y:a[1]<=y,inb=above?b[1]>=y:b[1]<=y;if(ina)out.push(a);if(ina!==inb){const t=(y-a[1])/(b[1]-a[1]);out.push(a.map((n,k)=>n+t*(b[k]-n)));}}return out;}
 function paint(mesh,collar){
  const old=mesh.geometry,a=old.attributes.position,positions=[],colors=[];const cuts=collar?[[-1,.37],[.37,1]]:[[-1,.035],[.035,.11],[.11,1]];
  for(let i=0;i<a.count;i+=3){const tri=[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]);
   for(const [lo,hi]of cuts){const poly=clipped(clipped(tri,lo,true),hi,false);for(let j=1;j<poly.length-1;j++){const pts=[poly[0],poly[j],poly[j+1]],center=pts[0].map((_,k)=>pts.reduce((sum,p)=>sum+p[k],0)/3);const cross=new THREE.Vector3().subVectors(new THREE.Vector3(...pts[1]),new THREE.Vector3(...pts[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...pts[2]),new THREE.Vector3(...pts[0])));if(cross.lengthSq()<1e-14)continue;
    let zone='black';if(collar){if(center[2]<.09&&(center[1]>.37||center[2]<-.12))zone='red';}else if(hi===.035)zone='red';else if(hi===.11)zone='white';else if(center[2]<-.1||(center[2]>.43&&cross.y>Math.abs(cross.x)))zone='red';
    const c=new THREE.Color(palette[zone]).convertSRGBToLinear();for(const p of pts){positions.push(...p);colors.push(c.r,c.g,c.b);}
   }}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();mesh.geometry=geo;old.dispose();mesh.material.dispose();mesh.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:0,side:THREE.DoubleSide});
 }
 function style(last){if(last.userData.bred)return;paint(last,false);const collar=last.getObjectByName('HighTopEnvelopeDebug');if(collar)paint(collar,true);
  for(let i=0;i<5;i++){const t=.18+i*.145,z=.52-.35*t,y=.16+.288*t;const geo=new THREE.BoxGeometry(.174-.02*t,.008,.024);geo.rotateX(Math.atan2(.288,.35));geo.translate(0,y+.009,z+.007);const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(palette.black).convertSRGBToLinear(),roughness:.75,metalness:0}));m.name='BredLaceBlock';last.add(m);}
  last.userData.bred=true;
 }
 window.AIBABredPreview={palette,style};
})();
