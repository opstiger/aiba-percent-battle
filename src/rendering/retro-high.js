/* Preset design only. All coordinates are relative to the accepted L=1 last.
 * Semantically separated panels are batched into one vertex-colored draw call.
 */
(()=>{
 const white=0xe8e7e2,black=0x18191b,red=0xb8322b;
 const classic={outsole:red,midsole:0xd8d7d1,toeBox:white,toeCap:black,mudguard:black,outsoleEdge:red,quarterPanel:white,heelCounter:red,collar:red,tongue:black,eyestay:black,laceBlock:black};
 const colorways=Object.freeze({classicRedBlackWhite:Object.freeze(classic),royalBlueBlackWhite:Object.freeze({...classic,outsole:0x2451a0,outsoleEdge:0x2451a0,heelCounter:0x2451a0,collar:0x2451a0}),purpleBlackWhite:Object.freeze({...classic,outsole:0x68478d,outsoleEdge:0x68478d,heelCounter:0x68478d,collar:0x68478d}),bredDark:Object.freeze({...classic,toeBox:red,quarterPanel:black})});
 const preset=Object.freeze({lastType:'AcceptedLastV1',shoeType:'RetroHigh',collarType:'TaperedHigh',outsoleType:'Cupsole',panelLayout:'RetroHighPanels',length:.44,laceRows:6,colorways});
 function clip(poly,axis,value,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=above?a[axis]>=value:a[axis]<=value,inb=above?b[axis]>=value:b[axis]<=value;if(ina)out.push(a);if(ina!==inb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,k)=>v+t*(b[k]-v)));}}return out;}
 function collarGeometry(){
  const rings=[{w:.16,d:.23,front:.52,y:.215},{w:.15,d:.17,front:.17,y:.46},{w:.132,d:.151,front:.151,y:.46},{w:.138,d:.208,front:.495,y:.215}],v=[],ix=[];
  for(const r of rings)for(const [x,z]of [[-.7,-1],[-1,-.65],[-1,.65],[-.7,1],[.7,1],[1,.65],[1,-.65],[.7,-1]])v.push(x*r.w,r.y-(z>0?(r.y>.4?.012:.055*z):0),z*(z>0?r.front:r.d));
  for(let j=0;j<4;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=((j+1)%4)*8+(i+1)%8,d=((j+1)%4)*8+i;ix.push(a,b,d,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);const flat=g.toNonIndexed();g.dispose();return flat;
 }
 /* 配色注册口,和 registerLayout 对称。已验收的四套留在 colorways 里不动,
    扩展的共享配色走 extraColorways —— 冻结对象没法就地加键。 */
 const extraColorways={};
 const paletteOf=name=>colorways[name]||extraColorways[name];
 function registerColorway(name,palette){
  if(paletteOf(name))throw Error('Colorway already registered '+name);
  extraColorways[name]=Object.freeze({...palette});
 }
 const cache=new Map();
 // Explicit extension registry. Unimplemented styles reject instead of pretending to work.
 const layouts={RetroHighPanels:{shoeType:'RetroHigh',buildShell:collarGeometry,collarType:'TaperedHigh',outsoleType:'Cupsole'}};
 function createBasketballShoe(options={}){
  const cfg={...preset,colorway:'classicRedBlackWhite',roleScale:1,...options};
  const layout=layouts[cfg.panelLayout];if(cfg.lastType!=='AcceptedLastV1'||!layout||cfg.shoeType!==layout.shoeType||cfg.collarType!==layout.collarType||cfg.outsoleType!==layout.outsoleType)throw Error('Unsupported shoe layout: register a tested preset first');
  if(!paletteOf(cfg.colorway))throw Error('Unknown shoe colorway '+cfg.colorway);
  if(!(Number.isFinite(cfg.roleScale)&&cfg.roleScale>0))throw Error('Invalid roleScale');
  const palette=paletteOf(cfg.colorway),key=cfg.panelLayout+':'+cfg.colorway;
  let resource=cache.get(key);
  if(!resource){
   const buckets={},push=(name,pts)=>{const a=new THREE.Vector3(...pts[0]),b=new THREE.Vector3(...pts[1]),c=new THREE.Vector3(...pts[2]);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-15)return;(buckets[name]||(buckets[name]=[])).push(...pts.flat());};
   function divide(geo,isCollar){const a=geo.attributes.position;const bands=isCollar?[[-1,.37],[.37,1]]:[[-1,.035],[.035,.11],[.11,1]];
    for(let i=0;i<a.count;i+=3){const tri=[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]);
     for(const [lo,hi]of bands){const poly=clip(clip(tri,1,lo,true),1,hi,false);for(let j=1;j<poly.length-1;j++){const pts=[poly[0],poly[j],poly[j+1]],mid=pts[0].map((_,k)=>pts.reduce((sum,p)=>sum+p[k],0)/3),n=new THREE.Vector3(...pts[1]).sub(new THREE.Vector3(...pts[0])).cross(new THREE.Vector3(...pts[2]).sub(new THREE.Vector3(...pts[0])));let name;
      if(isCollar){name=mid[1]>.37?'collar':mid[2]<-.12?'heelCounter':'quarterPanel';if(mid[2]>.14&&Math.abs(mid[0])<.113)name='tongue';}
      else name=hi===.035?(Math.abs(n.y)>Math.abs(n.x)+Math.abs(n.z)?'outsole':'outsoleEdge'):hi===.11?'midsole':mid[2]<-.10?'heelCounter':mid[2]>.43?(i<336&&Math.floor(i/6)%8===3?'toeBox':mid[2]>.65?'toeCap':'mudguard'):'quarterPanel';
      if(layout.classifyPanel)name=layout.classifyPanel({isCollar,center:mid,normal:n,band:[lo,hi],defaultPanel:name});push(name,pts);
     }}
    }geo.dispose();
   }
   const last=AIBAShoeLast.build();divide(last.geometry,false);last.material.dispose();divide(layout.buildShell(),true);
   function addBox(name,w,h,d,x,y,z,rx=0){const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.rotateX(rx);g.translate(x,y,z);const a=g.attributes.position;for(let i=0;i<a.count;i+=3)push(name,[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]));g.dispose();}
   // Narrow eye stays sit on the accepted ramp. They do not widen its outer boundary.
   const slope=Math.atan2(.288,.35),rampLength=Math.hypot(.288,.35);
   if(layout.addDetails)layout.addDetails({addBox,push,palette});else {
   for(const side of [-1,1])addBox('eyestay',.017,.007,rampLength*.86,side*.097,.16+.288*.5+.004,.52-.35*.5+.004,slope);
   // Tongue lip has thickness, remains below the .46L collar crown.
   addBox('tongue',.16,.007,.039,0,.432,.195,slope);
   for(let i=0;i<6;i++){const t=.17+i*.118;addBox('laceBlock',.177-.018*t,.008,.018,0,.16+.288*t+.009,.52-.35*t+.007,slope);}
   }
   const pos=[],cols=[],modules=[];
   for(const [name,verts]of Object.entries(buckets)){const start=pos.length/3;pos.push(...verts);const c=new THREE.Color(palette[name]||black).convertSRGBToLinear();for(let i=0;i<verts.length/3;i++)cols.push(c.r,c.g,c.b);modules.push({name,start,count:verts.length/3,triangles:verts.length/9});}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
   const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:0,side:THREE.DoubleSide});
   resource={geometry:geo,material,modules,triangles:pos.length/9};cache.set(key,resource);
  }
  const root=new THREE.Group(),mesh=new THREE.Mesh(resource.geometry,resource.material);mesh.name='base_basketball_shoe';root.name=cfg.shoeType;root.add(mesh);root.scale.setScalar(cfg.roleScale);root.userData.shoe={preset:cfg.shoeType,colorway:cfg.colorway,triangles:resource.triangles,modules:resource.modules,lastType:cfg.lastType,sharedResource:true};return root;
 }
 function registerLayout(name,definition){if(layouts[name])throw Error('Layout already registered');if(!definition.shoeType||!definition.collarType||!definition.outsoleType||typeof definition.buildShell!=='function'||typeof definition.classifyPanel!=='function'||typeof definition.addDetails!=='function')throw Error('Layout requires shell, classification and detail builders');layouts[name]=Object.freeze({...definition});}
 window.AIBARetroHigh=Object.freeze({preset,colorways,layouts,registerLayout,registerColorway,paletteOf,colorwayNames:()=>Object.keys(colorways).concat(Object.keys(extraColorways)),createBasketballShoe,plannedTypes:Object.freeze(['RetroLow','ModernMid','LightweightLow','ChunkyPowerHigh'])});
 window.createBasketballShoe=createBasketballShoe;
})();
