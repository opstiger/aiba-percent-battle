/* Place-specific contact layers: independent seeds, disposable art, unchanged shot geometry. */
(()=>{
  function surface(g,name,p,r){
    const jungle=name==="flowerCourt",street=name==="spanishQuarter"||name==="beachSunset";
    if(!jungle&&!street)return;
    if(jungle){
      g.fillStyle="#34422c";g.fillRect(-16,COURT.floorMinZ,32,36);
      // Overlapping worn footpaths have no rectangular boundary or artificial paint fill.
      for(let i=0;i<2300;i++){
        const x=(r()-.5)*32,z=COURT.floorMinZ+r()*36;
        const clearing=Math.abs(x)<8.3+Math.sin(z*.8)*.9&&z>-10.8&&z<5.8+Math.sin(x)*.7;
        const tone=clearing?["#4b5140","#50543f","#414a35","#555640"][i%4]:["#284329","#36532e","#425d32","#263c2a"][i%4];
        const radius=.22+r()*1.2,fade=g.createRadialGradient(x,z,0,x,z,radius);
        fade.addColorStop(0,tone);fade.addColorStop(1,tone+"00");g.fillStyle=fade;
        g.globalAlpha=.3+r()*.35;g.fillRect(x-radius,z-radius,radius*2,radius*2);
      }
      g.globalAlpha=1;g.strokeStyle="#d6d1ab";g.lineWidth=.058;
      // A hand-marked arc, with small chips rather than unreadable missing shooting positions.
      for(let a=.12;a<Math.PI-.12;a+=.047){if(r()<.14)continue;g.beginPath();g.arc(0,HOOP.z,6.75,a,Math.min(a+.04,Math.PI-.12));g.stroke();}
      for(const side of [-1,1]){g.beginPath();g.moveTo(side*6.7,-9.55);g.lineTo(side*6.7,-7.18);g.stroke();}
      for(let i=0;i<900;i++){
        const x=(r()-.5)*32,z=-13+r()*36;
        g.fillStyle=i%3===0?"#8b7c42":i%3===1?"#788046":"#233c28";g.globalAlpha=.28+r()*.24;
        g.save();g.translate(x,z);g.rotate(r()*6.28);g.fillRect(0,0,.035+r()*.095,.015+r()*.045);g.restore();
      }
      g.globalAlpha=1;
    }else{
      // Wear has a footprint: exposed undercoat around the busy paint and wall-side drainage.
      const oldTown=name==="spanishQuarter";
      for(let i=0;i<115;i++){
        const edge=i%3!==0,x=edge?(i%2?1:-1)*(6.6+r()*1.5):(r()-.5)*12,z=-9+r()*27;
        g.fillStyle=oldTown?(i%3?"#a49b82":"#746957"):(i%3?"#8d8b79":"#6c7266");g.globalAlpha=.14+r()*.19;
        const w=.18+r()*.9,h=.12+r()*.65;g.beginPath();
        for(let j=0;j<9;j++){const a=j/9*6.283,rad=.5+r()*.5,xx=x+Math.cos(a)*w*rad,zz=z+Math.sin(a)*h*rad;j?g.lineTo(xx,zz):g.moveTo(xx,zz);}g.closePath();g.fill();
      }
      g.globalAlpha=.45;g.strokeStyle=oldTown?"#685e4f":"#5c6257";g.lineWidth=.019;
      for(let i=0;i<20;i++){
        let x=(r()-.5)*14,z=-9+r()*26;g.beginPath();g.moveTo(x,z);
        for(let j=0;j<7;j++){x+=(r()-.4)*.6;z+=.2+r()*.4;g.lineTo(x,z);}g.stroke();
      }
      g.globalAlpha=1;
      // Faded murals belong on unused apron and the rear half, away from active aiming marks.
      for(const [x,z,rot,txt] of [[-9.1,-5,-Math.PI/2,name==="spanishQuarter"?"BARRIO":"VENICE"],[1,10,.1,name==="spanishQuarter"?"LA CANCHA":"SUNSET RUN"]]){
        g.save();g.translate(x,z);g.rotate(rot);g.globalAlpha=.4;g.font="900 1.1px sans-serif";g.textAlign="center";g.lineWidth=.13;g.strokeStyle="#343932";g.strokeText(txt,0,0);g.fillStyle=name==="spanishQuarter"?"#d39455":"#ba695e";g.fillText(txt,0,0);g.restore();
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
    if(s.name==="flowerCourt"){
      const green=[0x25482b,0x355c2c,0x496635,0x608045];
      const fern=(bb,x,y,z,sc)=>{
        for(let j=0;j<7;j++){const a=j*.9+r()*.2;
          for(let k=1;k<4;k++)bb.box(green[(j+k)%4],x+Math.cos(a)*k*.19*sc,y+(.48-k*.06)*sc,z+Math.sin(a)*k*.19*sc,.16*sc,.035*sc,.3*sc,-.35,a,.1);
        }
      };
      // Connected forest floor, not individual plants scattered on a paved apron.
      for(let i=0;i<(s.mobile?180:320);i++){
        const z=-17+r()*41,side=i%2?1:-1,x=side*(9.4+r()*8.2);
        b.add("blob",green[i%4],x,.12+r()*.1,z,.55+r()*.75,.12+r()*.17,.5+r()*.8);
        if(i%2===0)fern(b,x,.13,z,.75+r()*.9);
      }
      // Behind the basket, the forest closes in; the orange rim keeps its silhouette.
      for(let i=0;i<(s.mobile?65:115);i++){
        const x=(r()-.5)*34,z=-14-r()*11;
        b.add("blob",green[i%4],x,.45+r()*.35,z,.8+r()*.8,.35+r()*.5,.6+r());
        fern(b,x,.3,z,1.2+r());
      }
      for(const [x,z,scale] of [[-10.5,-9,1.2],[10.2,-11,1],[-10.5,5,1.1],[10.7,6,.9]]){
        b.add("blob",0x3a4a31,x,.38,z,1.2*scale,.5,1.7*scale);
        // Buttress roots touch moss, bark, and soil rather than floating above a flat slab.
        for(let j=0;j<5;j++){const a=j*1.25;b.box(0x4b4931,x+Math.sin(a)*.7,.25,z+Math.cos(a)*.7,.18,.3,1.7,.18,a);}
        const pivot=new THREE.Group();pivot.position.set(x,.6,z);s.root.add(pivot);const leaves=batch();fern(leaves,0,0,0,1.8);leaves.finish(pivot,"livingUnderstory");s.plants.push({pivot,phase:r()*6.28,amp:.032});
      }
      // Climbing mats on the inner rock face break the repeated rectangular cliff rhythm.
      for(let i=0;i<(s.mobile?80:145);i++){
        const side=i%2?1:-1,x=side*(20+r()*3),z=-31+r()*63,y=3+r()*26;
        b.add("blob",green[i%4],x,y,z,1.4+r(),.65+r(),1.4+r());
        if(i%3===0)for(let k=0;k<5;k++)b.add("blob",green[(i+k)%4],x,y-k*.7,z,.13,.5,.16);
      }
    }
    if(s.name==="beachSunset"){
      // A compact beach bar directly behind the baseline, visible from the shooting camera.
      const x=-9.8,z=-17.3;
      b.box(0x705038,x,.68,z,5.4,1.25,1.3);b.box(0xc19c66,x,1.36,z+.05,5.8,.16,1.6);
      for(const side of [-1,1])b.box(0x69513c,x+side*2.65,1.7,z-.45,.18,3.4,.18);
      b.box(0x4e766f,x,3.35,z,6.2,.18,2.8,0,0,.035);
      sign(s,"SUNSET BAR",x,2.85,z+.66,4.4,.72,"#3c4841","#edb57a");
      for(let i=0;i<7;i++){
        const xx=x-2.15+i*.7;b.box(0x3e6b4d,xx,1.57,z,.085,.25,.085);b.box(0xc6a56c,xx,1.73,z,.038,.09,.038);
        if(i%2===0){b.box(0x3b3930,xx,.43,z+1.2,.08,.75,.08);b.box(0xad7153,xx,.83,z+1.2,.5,.12,.46);}
      }
      const bulbs=batch();for(let i=0;i<9;i++)bulbs.add("blob",i%2?0xffba68:0xef857c,x-2.5+i*.62,3.07-Math.sin(i/8*Math.PI)*.21,z+.9,.075,.1,.075);
      const glow=bulbs.finish(s.root,"beachBarLights",true);glow.material.color.setScalar(.12);s.lights.push({mesh:glow,threshold:.38});
      for(let i=0;i<4;i++){
        const xx=9.8+(i%2)*2.2,zz=-16.5-Math.floor(i/2)*3.3;
        b.box(i%2?0xcfa478:0x759e98,xx,.36,zz,.85,.12,1.75);
        b.box(i%2?0xcfa478:0x759e98,xx,.75,zz-.9,.85,.12,1.15,.75);
        for(const a of [-1,1])b.box(0x6c6551,xx+a*.34,.18,zz,.055,.32,1.6);
        b.box(0x937955,xx+.85,.5,zz,.5,.06,.5);b.add("blob",0x8b783e,xx+.85,.67,zz,.13,.15,.13);
        b.box(0xe8d4a0,xx+.86,.88,zz,.025,.27,.025,0,0,.16);
      }
      sign(s,"STAY LOOSE",7.3,1.15,-15.8,3.9,1.3,"#756d58","#d99370");
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
