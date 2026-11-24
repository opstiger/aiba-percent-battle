/* Place-specific contact layers: independent seeds, disposable art, unchanged shot geometry. */
(()=>{
  function surface(g,name,p,r){
    if(name!=="spanishQuarter"&&name!=="beachSunset"&&name!=="outdoorSunny")return;
    // Wear has a footprint: exposed undercoat around the busy paint and wall-side drainage.
    const oldTown=name==="spanishQuarter",vice=name==="outdoorSunny";
    for(let i=0;i<115;i++){
      const edge=i%3!==0,x=edge?(i%2?1:-1)*(6.6+r()*1.5):(r()-.5)*12,z=-9+r()*27;
      g.fillStyle=oldTown?(i%3?"#a49b82":"#746957"):vice?(i%3?"#22414c":"#1e2230"):(i%3?"#6f7b84":"#4b5660");g.globalAlpha=.14+r()*.19;
      const w=.18+r()*.9,h=.12+r()*.65;g.beginPath();
      for(let j=0;j<9;j++){const a=j/9*6.283,rad=.5+r()*.5,xx=x+Math.cos(a)*w*rad,zz=z+Math.sin(a)*h*rad;j?g.lineTo(xx,zz):g.moveTo(xx,zz);}g.closePath();g.fill();
    }
    g.globalAlpha=.45;g.strokeStyle=oldTown?"#685e4f":"#3a444d";g.lineWidth=.019;
    for(let i=0;i<20;i++){
      let x=(r()-.5)*14,z=-9+r()*26;g.beginPath();g.moveTo(x,z);
      for(let j=0;j<7;j++){x+=(r()-.4)*.6;z+=.2+r()*.4;g.lineTo(x,z);}g.stroke();
    }
    g.globalAlpha=1;
    // Faded murals belong on unused apron and the rear half, away from active aiming marks.
    const tags=oldTown?[[-9.1,-5,-Math.PI/2,"BARRIO","#d39455"],[1,10,.1,"LA CANCHA","#d39455"]]:
      vice?[[-9.1,-5,-Math.PI/2,"VICE BLOCK","#28d7ea"],[1,10,.1,"LEONIDA 305","#f25294"]]:
      [[-9.1,-5,-Math.PI/2,"VICE BEACH","#36c2ce"],[1,10,.1,"OCEAN DRIVE","#f05e94"]];
    for(const [x,z,rot,txt,fill] of tags){
      g.save();g.translate(x,z);g.rotate(rot);g.globalAlpha=.56;g.font="900 1.05px sans-serif";g.textAlign="center";g.lineWidth=.14;g.strokeStyle="#161b26";g.strokeText(txt,0,0);g.fillStyle=fill;g.fillText(txt,0,0);g.restore();
    }
    for(let i=0;i<450;i++){
      const x=(r()-.5)*15.2,z=COURT.nearBaseline+r()*COURT.length;
      g.fillStyle=p.field;g.globalAlpha=.3+r()*.45;g.fillRect(x,z,.05+r()*.42,.02+r()*.095);
    }
    // Chips follow the painted lines, where random whole-surface dots almost never land.
    g.fillStyle=p.field;
    for(const hz of [HOOP.z,COURT.farHoopZ])for(let a=0;a<6.28;a+=.025){
      if(r()>.28)continue;g.globalAlpha=.5+r()*.5;g.beginPath();g.ellipse(Math.cos(a)*6.75,hz+Math.sin(a)*6.75,.03+r()*.07,.02+r()*.065,r()*6.28,0,6.28);g.fill();
    }
    for(const side of [-1,1])for(let z=COURT.nearBaseline;z<COURT.farBaseline;z+=.47){
      if(r()>.65)continue;g.globalAlpha=.55;g.fillStyle=p.ground;
      g.beginPath();g.moveTo(side*8,z-.15);g.lineTo(side*(7.2+r()*.6),z+.2);g.lineTo(side*8,z+.8);g.fill();
    }
    g.globalAlpha=1;
  }
  function sign(s,text,x,y,z,w,h,bg,fg,rotation=0){
    const c=document.createElement("canvas");c.width=512;c.height=256;const g=c.getContext("2d");
    g.fillStyle=bg;g.fillRect(0,0,512,256);g.strokeStyle=fg;g.lineWidth=8;
    for(let i=0;i<8;i++){g.globalAlpha=.14;g.beginPath();g.moveTo(0,i*36);g.lineTo(512,i*36-40);g.stroke();}
    g.globalAlpha=1;g.font="900 65px sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillStyle=fg;g.fillText(text,256,125,478);
    const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:tex,side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.name="localStreetArt";s.root.add(mesh);return mesh;
  }
  function mural(s,r,x,y,z,w,h,rotation=0){
    const c=document.createElement('canvas');c.width=768;c.height=384;const g=c.getContext('2d');
    g.fillStyle='#b1a083';g.fillRect(0,0,768,384);
    const tones=['#4a7775','#b47740','#963e30','#c2aa6b'];
    for(let j=0;j<16;j++){const a=j/16*Math.PI;g.fillStyle=tones[j%4];g.beginPath();g.moveTo(525,355);g.arc(525,355,310,Math.PI+a,Math.PI+a+.17);g.closePath();g.fill();}
    // A locally themed bull silhouette and hand-painted lettering, weathered together with plaster.
    g.fillStyle='#343c35';g.beginPath();g.moveTo(90,213);g.bezierCurveTo(130,146,230,147,275,187);g.lineTo(318,175);g.lineTo(343,208);g.lineTo(313,233);g.lineTo(287,223);g.lineTo(254,228);g.lineTo(244,299);g.lineTo(227,299);g.lineTo(221,236);g.lineTo(137,241);g.lineTo(116,301);g.lineTo(98,301);g.lineTo(104,232);g.closePath();g.fill();
    g.strokeStyle='#343c35';g.lineWidth=12;g.beginPath();g.moveTo(307,184);g.quadraticCurveTo(276,163,296,141);g.moveTo(327,181);g.quadraticCurveTo(354,154,340,140);g.moveTo(98,206);g.quadraticCurveTo(56,175,72,151);g.stroke();
    g.fillStyle='#f0d7a6';g.font='900 58px sans-serif';g.fillText('LA CANCHA',48,85);g.font='bold 25px sans-serif';g.fillText('DEL BARRIO',54,119);
    for(let i=0;i<1500;i++){g.fillStyle=i%3?'rgba(190,172,139,.35)':'rgba(65,61,44,.2)';g.fillRect(r()*768,r()*384,1+r()*9,1+r()*3);}
    for(let i=0;i<48;i++){g.fillStyle='#aa9678';g.beginPath();g.ellipse(r()*768,r()*384,3+r()*17,2+r()*8,r()*6.28,0,6.28);g.fill();}
    const grime=g.createLinearGradient(0,270,0,384);grime.addColorStop(0,'#35402b00');grime.addColorStop(1,'#35402b88');g.fillStyle=grime;g.fillRect(0,250,768,134);
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.name='weatheredBarrioMural';s.root.add(mesh);
  }
  function build(s,b,{batch,rng}){
    const r=rng(490133+Object.keys(AIBAWorldPlaces.palettes).indexOf(s.name)*313);
    if(s.name==="beachSunset"){
      // Angels Gate 悬崖球场保持篮筐后方全开阔海景，不放遮挡海天线的沙滩酒吧与牌子
    }
    if(s.name==="spanishQuarter"){
      for(const side of [-1,1]){
        // Low patched walls connect the court to existing houses without boxing in cameras.
        b.box(0xa48764,side*10.95,.36,-9.6,2.5,.72,3.5);
        for(let i=0;i<16;i++)b.box(i%3?0xbc9d76:0x7f7560,side*(9.8+r()*2.2),.15+r()*.52,-7.83,.14+r()*.3,.09+r()*.14,.025);
      }
      mural(s,r,-10.92,2.35,-11.9,4.5,1.65,.22);
      mural(s,r,-13.065,1.55,-2.5,4.8,2.3,Math.PI/2);
      for(const side of [-1,1])for(let i=0;i<90;i++){
        const z=-8+r()*22,y=.28+r()*.82;
        b.box(i%3===0?0x716951:i%3===1?0xb29a75:0x8e8063,side*13.07,y,z,.035,.035+r()*.18,.08+r()*.32);
      }
      // Painted ceramic fan, rather than another rectangular generic sign.
      for(let j=0;j<15;j++){const a=j*Math.PI/14;b.box(j%3===0?0x2b717c:j%3===1?0xd99d46:0xb84c39,8.9+Math.cos(a)*1.4,.82+Math.sin(a)*1.4,-12.5,.27,.68,.08,0,0,a-Math.PI/2);}
    }
  }
  window.AIBAWorldLife=Object.freeze({surface,build});
})();
