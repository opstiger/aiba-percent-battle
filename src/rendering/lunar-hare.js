/* Moon hare. Longitudinal sections describe its spine, muzzle, folded hocks and layered pinnae.
   The colour atlas has separate islands for coat, face, ears, socks, feathers and amber irises. */
(function(global){
  "use strict";
  const TAU=Math.PI*2;
  function makeJoint(parent,x=0,y=0,z=0){
    const joint=new THREE.Group();joint.position.set(x,y,z);parent.add(joint);return joint;
  }

  function create(){
    const group=new THREE.Group();group.name="lunarJadeRabbit";
    const body=makeJoint(group),head=makeJoint(body,0,.89,.38);
    const atlas=new THREE.TextureLoader().load("assets/lunar/moon-hare-coat.webp");
    atlas.anisotropy=2;
    const tuck={value:0};
    const bendLimb=`void bendLimb(inout vec3 p,inout vec3 n){
        if(aLeg>.5){
            bool hind=aLeg>1.5;
            vec2 pivot=hind?vec2(-.31,-.135):vec2(-.19,-.032);
            float weight=1.-smoothstep(pivot.x-.065,pivot.x+.045,p.y);
            float angle=(hind?-1.12:1.43)*uTuck*weight;
            float sn=sin(angle),cs=cos(angle);mat2 bend=mat2(cs,sn,-sn,cs);
            p.yz=pivot+bend*(p.yz-pivot);n.yz=bend*n.yz;
          }
      }`;
    const coat=new THREE.ShaderMaterial({
      uniforms:{map:{value:atlas},uEclipse:{value:0},uTuck:tuck},
      vertexShader:`attribute float aLeg;uniform float uTuck;varying vec2 vUv;varying vec3 vN,vV,vLight;
        ${bendLimb}
        void main(){
          vec3 p=position,n=normal;
          bendLimb(p,n);
          vUv=uv;vec4 mv=modelViewMatrix*vec4(p,1.);
          vN=normalMatrix*n;vV=-mv.xyz;
          vLight=mat3(viewMatrix)*normalize(vec3(-.62,.78,.58));
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D map;uniform float uEclipse;varying vec2 vUv;varying vec3 vN,vV,vLight;
        void main(){
          vec3 n=normalize(vN),v=normalize(vV),pigment=texture2D(map,vUv).rgb;
          float light=smoothstep(-.52,.91,dot(n,normalize(vLight)));
          float velvet=pow(1.-max(0.,dot(n,v)),3.1);
          vec3 col=pigment*(.72+.32*light)+vec3(.008,.013,.024)*(1.-light);
          col+=vec3(.14,.31,.34)*velvet*(.75+.45*uEclipse);
          gl_FragColor=vec4(col,1.);
        }`
    });
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    depth.onBeforeCompile=shader=>{
      shader.uniforms.uTuck=tuck;
      shader.vertexShader="attribute float aLeg;uniform float uTuck;"+bendLimb+"\n"+shader.vertexShader.replace(
        "#include <begin_vertex>","vec3 transformed=position,bendNormal=normal;bendLimb(transformed,bendNormal);");
    };
    coat.addEventListener("dispose",()=>{atlas.dispose();depth.dispose();});
    const segments=new Map();
    function section(joint){
      if(!segments.has(joint))segments.set(joint,{p:[],uv:[],idx:[],seams:[]});
      return segments.get(joint);
    }
    function uv(buffer,tile,u,v){
      // Sample inside each island even in the lower mip levels.
      buffer.push((tile%4+.006+.988*u)/4,1-(Math.floor(tile/4)+.994-.988*v)/2);
    }
    function blend(a,b,c,d,k){
      return .5*((2*b)+(-a+c)*k+(2*a-5*b+4*c-d)*k*k+(-a+3*b-3*c+d)*k*k*k);
    }
    // Each row gives axial coordinate, two centre offsets, and two radii.
    function loft(joint,tile,axis,rows,sides=20){
      const mesh=section(joint),first=mesh.p.length/3,steps=(rows.length-1)*3;
      for(let j=0;j<=steps;j++){
        const i=Math.min(rows.length-2,Math.floor(j/3)),k=j/3-i;
        const a=rows[Math.max(0,i-1)],b=rows[i],c=rows[i+1],d=rows[Math.min(rows.length-1,i+2)];
        const h=b[0]+(c[0]-b[0])*k;
        const x=blend(a[1],b[1],c[1],d[1],k),z=blend(a[2],b[2],c[2],d[2],k);
        const rx=Math.max(.001,blend(a[3],b[3],c[3],d[3],k)),rz=Math.max(.001,blend(a[4],b[4],c[4],d[4],k));
        for(let n=0;n<=sides;n++){
          const u=n/sides,angle=(u-.5)*TAU,px=x+rx*Math.sin(angle),pz=z+rz*Math.cos(angle);
          if(axis==="y")mesh.p.push(px,h,pz);else mesh.p.push(px,pz,h);
          uv(mesh.uv,tile,u,j/steps);
          if(j&&n){
            const hi=first+j*(sides+1)+n,lo=hi-sides-1;
            if(axis==="y")mesh.idx.push(lo-1,lo,hi,lo-1,hi,hi-1);
            else mesh.idx.push(lo-1,hi,lo,lo-1,hi-1,hi);
          }
        }
        mesh.seams.push([first+j*(sides+1),first+j*(sides+1)+sides]);
      }
    }
    // Sweep the back from rump to nape, with a tucked flank and a rising chest.
    const spine=[
      [-.82,0,.44,.012,.02],[-.72,0,.43,.20,.23],[-.53,0,.45,.308,.325],
      [-.32,0,.48,.304,.313],[-.08,0,.49,.235,.244],[.10,0,.53,.212,.252],
      [.27,0,.626,.215,.287],[.365,0,.752,.166,.214],[.43,0,.827,.12,.125],[.46,0,.856,.02,.03]
    ];
    loft(body,0,"z",spine,28);
    loft(head,1,"y",[
      [-.163,0,.097,.014,.025],[-.141,0,.075,.095,.134],[-.084,0,.093,.149,.20],
      [-.018,0,.052,.196,.227],[.066,0,.025,.227,.209],[.137,0,-.008,.213,.178],
      [.21,0,-.032,.159,.144],[.254,0,-.048,.082,.086],[.27,0,-.054,.005,.009]
    ],32);
    // Narrow muzzle, a small dark nose, and paired tapered cheek fans.
    loft(head,7,"y",[[-.092,0,.286,.006,.008],[-.077,0,.288,.025,.018],[-.058,0,.283,.032,.019],[-.051,0,.283,.018,.011]],16);
    const eyes=[];
    for(const side of [-1,1]){
      for(let n=0;n<3;n++){
        const dx=n*.017,dz=n*.055;
        loft(head,4,"y",[
          [-.175+n*.025,side*(.25+dx),-.084-dz,.001,.002],
          [-.12+n*.025,side*(.218+dx),-.06-dz,.024,.038],
          [-.04+n*.025,side*(.18+dx),-.028-dz,.055,.079],
          [.048+n*.016,side*.162,-.014-dz,.057,.078],[.092+n*.015,side*.161,-.014-dz,.003,.008]
        ],10);
      }
      const eye=makeJoint(head,side*.160,.060,.173);
      eye.rotation.y=side*.80;eye.rotation.z=side*.15;eyes.push(eye);
      const m=section(eye),segmentsAround=32;
      for(let ring=0;ring<=6;ring++){
        const r=Math.max(.001,ring/6);
        for(let n=0;n<=segmentsAround;n++){
          const ang=n*TAU/segmentsAround,x=r*Math.cos(ang),y=r*Math.sin(ang);
          m.p.push(.093*x,.050*y*(1-.29*Math.abs(x)),.028*(1-r*r)+.003);
          uv(m.uv,6,.5+.49*x,.5+.49*y);
          if(ring&&n){const i=ring*(segmentsAround+1)+n,j=i-segmentsAround-1;m.idx.push(j-1,i-1,i,j-1,i,j);}
        }
      }
    }

    function pinna(side){
      const ear=makeJoint(head,side*.103,.174,-.054);
      loft(ear,2,"y",[
        [0,0,0,.044,.041],[.105,side*.014,-.012,.070,.045],[.275,side*.047,-.038,.085,.047],
        [.45,side*.063,-.072,.073,.039],[.60,side*.054,-.122,.049,.027],
        [.715,side*.025,-.169,.022,.016],[.788,side*.003,-.192,.002,.003]
      ],20);
      for(let n=0;n<2;n++){
        const h=n*.11;
        loft(ear,5,"y",[
          [.11+h,side*.025,-.043,.019,.015],[.22+h,side*(.066-n*.018),-.075,.038,.024],
          [.36+h,side*(.102-n*.022),-.128,.044,.023],[.49+h,side*(.128-n*.019),-.196,.027,.015],
          [.55+h,side*(.129-n*.023),-.231,.002,.003]
        ],12);
      }
      return ear;
    }
    const earL=pinna(-1),earR=pinna(1);
    function leg(side,hind){
      const leg=makeJoint(body,side*(hind ? .215 : .14),hind ? .50 : .46,hind ? -.46 : .22);
      if(hind){
        const hip=section(leg),start=hip.p.length/3;
        loft(leg,0,"y",[[-.36,0,-.153,.032,.045],[-.27,side*.014,-.135,.063,.087],
          [-.16,side*.033,-.045,.116,.157],[-.012,side*.026,.012,.15,.213],
          [.12,0,-.012,.116,.166],[.19,-side*.031,-.045,.043,.082],[.207,-side*.035,-.06,.003,.004]]);
        // Continue the flank painting across the moving thigh in its resting pose.
        for(let j=start;j<hip.p.length/3;j++){
          const x=hip.p[j*3]+leg.position.x,y=hip.p[j*3+1]+leg.position.y,z=hip.p[j*3+2]+leg.position.z;
          let i=0;while(i<spine.length-2&&spine[i+1][0]<z)i++;
          const a=spine[i],b=spine[i+1];
          const t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
          const center=THREE.MathUtils.lerp(a[2],b[2],t),width=THREE.MathUtils.lerp(a[3],b[3],t),height=THREE.MathUtils.lerp(a[4],b[4],t);
          const u=.5+Math.atan2(x/width,(y-center)/height)/TAU;
          hip.uv[j*2]=(.006+.988*u)/4;
          hip.uv[j*2+1]=1-(.994-.988*(i+t)/(spine.length-1))/2;
        }
        loft(leg,3,"y",[[-.488,0,.017,.036,.100],[-.459,0,.009,.067,.173],[-.413,0,-.026,.067,.17],
          [-.348,0,-.129,.045,.074],[-.264,0,-.141,.042,.064],[-.233,0,-.13,.004,.008]],16);
      }else{
        loft(leg,3,"y",[[-.453,0,.062,.026,.062],[-.433,0,.066,.046,.113],[-.397,0,.048,.049,.11],
          [-.353,0,-.005,.037,.060],[-.236,side*.006,-.032,.035,.045],
          [-.124,side*.008,-.044,.056,.068],[.012,0,.012,.072,.10],[.10,0,.018,.035,.055],[.12,0,.01,.003,.005]],16);
      }
      return leg;
    }
    const foreL=leg(-1,false),foreR=leg(1,false),hindL=leg(-1,true),hindR=leg(1,true);
    const tail=makeJoint(body,0,.40,-.69);
    loft(tail,4,"y",[[0,0,.034,.03,.04],[.08,0,-.051,.085,.114],[.19,0,-.116,.091,.115],
      [.283,0,-.192,.061,.084],[.36,0,-.222,.026,.044],[.398,0,-.214,.003,.003]],16);
    for(const [joint,m] of segments){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.Float32BufferAttribute(m.p,3));geo.setAttribute("uv",new THREE.Float32BufferAttribute(m.uv,2));
      const limb=joint===hindL||joint===hindR?2:joint===foreL||joint===foreR?1:0;
      geo.setAttribute("aLeg",new THREE.BufferAttribute(new Uint8Array(m.p.length/3).fill(limb),1));
      geo.setIndex(m.idx);geo.computeVertexNormals();
      const normals=geo.attributes.normal,n=new THREE.Vector3(),other=new THREE.Vector3();
      for(const [a,b] of m.seams){
        n.fromBufferAttribute(normals,a).add(other.fromBufferAttribute(normals,b)).normalize();
        normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
      }
      const mesh=new THREE.Mesh(geo,coat);mesh.castShadow=true;if(limb)mesh.customDepthMaterial=depth;joint.add(mesh);
    }
    return {group,body,head,earL,earR,foreL,foreR,hindL,hindR,tail,eyes,coat};
  }
  global.AIBALunarHare=Object.freeze({create});
})(window);
