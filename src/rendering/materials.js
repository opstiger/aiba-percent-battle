/* ---------------- pixel texture helpers ---------------- */
function pixTex(w,h,draw,opt){
  const cv=document.createElement("canvas");cv.width=w;cv.height=h;
  draw(cv.getContext("2d"),w,h);
  const t=new THREE.CanvasTexture(cv);
  const smooth=opt&&opt.smooth;
  t.magFilter=smooth?THREE.LinearFilter:THREE.NearestFilter;
  const mipmaps=!!(opt&&opt.mipmaps);
  t.minFilter=mipmaps?THREE.LinearMipmapLinearFilter:(smooth?THREE.LinearFilter:THREE.NearestFilter);
  t.generateMipmaps=mipmaps;
  if(smooth&&renderer.capabilities&&renderer.capabilities.getMaxAnisotropy){
    t.anisotropy=Math.min((opt&&opt.anisotropy)||4,renderer.capabilities.getMaxAnisotropy());
  }
  if(THREE.sRGBEncoding&&!(opt&&opt.linear))t.encoding=THREE.sRGBEncoding;
  return t;
}

function ballTextureRng(seed){
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}

function ballUvPoint(x,y,z){
  let u=Math.atan2(z,-x)/(Math.PI*2);if(u<0)u+=1;
  return [u,Math.acos(Math.max(-1,Math.min(1,y)))/Math.PI];
}

const BALL_LINE_DEBUG=new URLSearchParams(location.search).get("debugBallLines")==="1";
let ballLineDebugLegendQueued=false;
function ensureBallLineDebugLegend(){
  if(!BALL_LINE_DEBUG||ballLineDebugLegendQueued)return;ballLineDebugLegendQueued=true;
  const mount=()=>{
    if(document.getElementById("ballLineDebugLegend"))return;
    const el=document.createElement("div");el.id="ballLineDebugLegend";
    el.style.cssText="position:fixed;right:10px;bottom:10px;z-index:99999;padding:10px 12px;background:rgba(5,9,15,.9);border:1px solid #546170;color:#fff;font:700 13px/1.7 monospace;pointer-events:none";
    el.innerHTML='<div><span style="color:#ff453a">1 RED</span> full ring 1</div><div><span style="color:#ffd60a">2 YELLOW</span> full ring A</div><div><span style="color:#bf5af2">3 PURPLE</span> double curve</div>';
    document.body.appendChild(el);
  };
  if(document.body)mount();else addEventListener("DOMContentLoaded",mount,{once:true});
}

// Two orthogonal great circles and the sphere curve define the molded channel layout.
const spaldingPts3D=(()=>{
  const pts=[],radius=1.5,samples=720;
  for(let i=0;i<=samples;i++){
    const a=i/samples*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    let lo=0,hi=2;
    for(let n=0;n<24;n++){
      const r=(lo+hi)*.5,u=r*c,v=r*s;
      const x=u-u*u*u/3+u*v*v,y=v-v*v*v/3+v*u*u,z=u*u-v*v;
      if(Math.hypot(x,y,z)<radius)lo=r;else hi=r;
    }
    const r=(lo+hi)*.5,u=r*c,v=r*s;
    pts.push([(u-u*u*u/3+u*v*v)/radius,(v-v*v*v/3+v*u*u)/radius,(u*u-v*v)/radius]);
  }
  return pts;
})();

function channelDistance3D(nx,ny,nz){
  let minD=Math.min(Math.abs(ny),Math.abs(nx));
  let bestI=0,bestDot=-2;
  for(let i=0;i<spaldingPts3D.length;i+=6){
    const p=spaldingPts3D[i],dot=nx*p[0]+ny*p[1]+nz*p[2];
    if(dot>bestDot){bestDot=dot;bestI=i;}
  }
  for(let j=bestI-6;j<=bestI+6;j++){
    const idx=(j+spaldingPts3D.length)%spaldingPts3D.length;
    const p=spaldingPts3D[idx],dot=nx*p[0]+ny*p[1]+nz*p[2];
    if(dot>bestDot)bestDot=dot;
  }
  return Math.min(minD,Math.acos(Math.max(-1,Math.min(1,bestDot))));
}

function spaldingPanelCurve(){
  return spaldingPts3D.map(p=>ballUvPoint(p[0],p[1],p[2]));
}

let basketballChannelPathCache=null;
function basketballChannelPaths(){
  if(basketballChannelPathCache)return basketballChannelPathCache;
  const equator=[],candidateMeridianA=[],candidateMeridianAOpposite=[];
  for(let i=0;i<=256;i++){
    const k=i/256;
    equator.push([k,.5]);
    candidateMeridianA.push([.75,k]);
    candidateMeridianAOpposite.push([.25,k]);
  }
  const panelCurve=spaldingPanelCurve(720);
  equator.debugColor="#ff453a";
  candidateMeridianA.debugColor=candidateMeridianAOpposite.debugColor="#ffd60a";
  panelCurve.debugColor="#bf5af2";
  basketballChannelPathCache=[equator,candidateMeridianA,candidateMeridianAOpposite,panelCurve];
  return basketballChannelPathCache;
}

function strokeWrappedBallPath(g,pts,w,h,width,color){
  const unwrapped=[[pts[0][0],pts[0][1]]];let offset=0,prev=pts[0][0];
  for(let i=1;i<pts.length;i++){
    const u=pts[i][0],d=u-prev;if(d>.5)offset-=1;else if(d<-.5)offset+=1;
    unwrapped.push([u+offset,pts[i][1]]);prev=u;
  }
  g.strokeStyle=color;g.lineWidth=width;g.lineCap="round";g.lineJoin="round";
  for(let shift=-2;shift<=2;shift++){
    g.beginPath();g.moveTo((unwrapped[0][0]+shift)*w,unwrapped[0][1]*h);
    for(let i=1;i<unwrapped.length;i++)g.lineTo((unwrapped[i][0]+shift)*w,unwrapped[i][1]*h);
    g.stroke();
  }
}

function paintBasketballChannels(g,w,h,relief){
  const scale=h/256,paths=basketballChannelPaths();
  if(BALL_LINE_DEBUG&&!relief){
    ensureBallLineDebugLegend();
    for(const p of paths)strokeWrappedBallPath(g,p,w,h,10*scale,"#05070a");
    for(const p of paths)strokeWrappedBallPath(g,p,w,h,6*scale,p.debugColor);
    return;
  }
  const img=g.getImageData(0,0,w,h),data=img.data;
  const halfCore=0.0145,halfBevel=0.0245;
  for(let py=0;py<h;py++){
    const theta=(py+.5)/h*Math.PI,sinT=Math.sin(theta),ny=Math.cos(theta);
    for(let px=0;px<w;px++){
      const phi=(px+.5)/w*Math.PI*2,nx=-Math.cos(phi)*sinT,nz=Math.sin(phi)*sinT;
      const d=channelDistance3D(nx,ny,nz);
      if(d>=halfBevel)continue;
      const idx=(py*w+px)*4;
      if(relief){
        const t=d<=halfCore?0:(d-halfCore)/(halfBevel-halfCore);
        const v=Math.round(6+140*t*t);
        data[idx]=Math.min(data[idx],v);
        data[idx+1]=Math.min(data[idx+1],v);
        data[idx+2]=Math.min(data[idx+2],v);
      }else if(d<=halfCore){
        data[idx]=16;data[idx+1]=10;data[idx+2]=8;
      }else{
        const t=(d-halfCore)/(halfBevel-halfCore),blend=1-t;
        data[idx]=Math.round(data[idx]*(1-blend*.65)+28*blend*.65);
        data[idx+1]=Math.round(data[idx+1]*(1-blend*.65)+15*blend*.65);
        data[idx+2]=Math.round(data[idx+2]*(1-blend*.65)+10*blend*.65);
      }
    }
  }
  g.putImageData(img,0,0);
}

function rotatedTriColorIndex(px,py,w,h,colorCount){
  const theta=(py+.5)/h*Math.PI,sinTheta=Math.sin(theta),y=Math.cos(theta);
  const phi=(px+.5)/w*Math.PI*2,x=-Math.cos(phi)*sinTheta,z=Math.sin(phi)*sinTheta;
  const turn=Math.PI/2,c=Math.cos(-turn),s=Math.sin(-turn),sourceZ=s*y+c*z;
  let sourceU=Math.atan2(sourceZ,-x)/(Math.PI*2);if(sourceU<0)sourceU+=1;
  return Math.floor(sourceU*8)%colorCount;
}

function paintTriBallPanels(g,w,h,palette){
  const maskCanvas=document.createElement("canvas");maskCanvas.width=w;maskCanvas.height=h;
  const maskContext=maskCanvas.getContext("2d");
  for(const path of basketballChannelPaths())strokeWrappedBallPath(maskContext,path,w,h,4*h/256,"#000");
  const mask=maskContext.getImageData(0,0,w,h).data,labels=new Int16Array(w*h),queue=new Int32Array(w*h),votes=[];
  labels.fill(-1);let panel=0;
  for(let seed=0;seed<w*h;seed++){
    if(mask[seed*4+3]>32||labels[seed]>=0)continue;
    const panelVotes=new Uint32Array(palette.length);votes.push(panelVotes);
    let head=0,tail=0;queue[tail++]=seed;labels[seed]=panel;
    while(head<tail){
      const p=queue[head++],x=p%w,y=(p/w)|0;
      panelVotes[rotatedTriColorIndex(x,y,w,h,palette.length)]++;
      const left=y*w+(x?x-1:w-1),right=y*w+(x+1<w?x+1:0);
      if(mask[left*4+3]<=32&&labels[left]<0){labels[left]=panel;queue[tail++]=left;}
      if(mask[right*4+3]<=32&&labels[right]<0){labels[right]=panel;queue[tail++]=right;}
      if(y){const up=p-w;if(mask[up*4+3]<=32&&labels[up]<0){labels[up]=panel;queue[tail++]=up;}}
      if(y+1<h){const down=p+w;if(mask[down*4+3]<=32&&labels[down]<0){labels[down]=panel;queue[tail++]=down;}}
    }
    panel++;
  }
  const colors=palette.map(color=>[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]);
  const panelColors=votes.map(panelVotes=>{let best=0;for(let i=1;i<panelVotes.length;i++)if(panelVotes[i]>panelVotes[best])best=i;return colors[best];});
  const image=g.createImageData(w,h);
  for(let p=0;p<w*h;p++){
    const color=labels[p]>=0?panelColors[labels[p]]:colors[0],i=p*4;
    image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=255;
  }
  g.putImageData(image,0,0);
}

function makeLunarBallSurfaceCanvas(w,h){
  const lc=document.createElement("canvas");lc.width=w;lc.height=h;
  const lg=lc.getContext("2d"),r=ballTextureRng(0x19690720);
  lg.fillStyle="#aeb4be";lg.fillRect(0,0,w,h);
  for(let i=0;i<55;i++){
    const x=r()*w,y=r()*h,rad=(18+r()*55)*(h/256);
    const gr=lg.createRadialGradient(x,y,rad*.1,x,y,rad);
    gr.addColorStop(0,"rgba(92,98,110,0.42)");gr.addColorStop(1,"rgba(92,98,110,0)");
    lg.fillStyle=gr;lg.beginPath();lg.arc(x,y,rad,0,Math.PI*2);lg.fill();
  }
  for(let i=0;i<14000;i++){
    lg.fillStyle=r()>.5?"rgba(235,240,248,0.16)":"rgba(48,52,60,0.18)";
    const sz=1+r()*1.8;lg.fillRect(r()*w,r()*h,sz,sz);
  }
  for(let i=0;i<140;i++){
    const x=r()*w,y=r()*h;
    const rad=(i<22?11+r()*15:(i<65?5+r()*7:2+r()*3.5))*(h/256);
    lg.fillStyle="rgba(42,46,54,0.52)";lg.beginPath();lg.arc(x,y,rad,0,Math.PI*2);lg.fill();
    lg.fillStyle="rgba(195,202,214,0.45)";lg.beginPath();lg.arc(x+rad*.16,y+rad*.16,rad*.76,0,Math.PI*2);lg.fill();
    lg.strokeStyle="rgba(244,247,252,0.55)";lg.lineWidth=Math.max(1,rad*.16);
    lg.beginPath();lg.arc(x,y,rad*.96,-Math.PI*.85,Math.PI*.25);lg.stroke();
    lg.strokeStyle="rgba(38,42,48,0.48)";
    lg.beginPath();lg.arc(x,y,rad*.96,Math.PI*.25,Math.PI*1.15);lg.stroke();
  }
  return lc;
}

/* 新疆鲜花球场特调面板：日照金山 × 伊犁薰衣草艾德莱斯绸
   直接按 3D 球面每片球皮的切平面主轴坐标 (along, across) 采样，彻底消除极点放射状聚拢与斜切 */
function sampleFlowerSilkAt(along,across,warp,r,cols){
  const bands=4.8;
  const bp=across*bands+50,bi=Math.floor(bp),dx=Math.abs((bp-bi)-0.5)*2;
  const crossIdx=((Math.floor((across+2)*64)%256)+256)%256;
  const p=along*Math.PI*2*2.2+bi*0.9;
  const ridge=Math.sin(p)*0.18+Math.sin(p*2.2)*0.08;
  const bleed=warp[crossIdx]+(r()-0.5)*0.035;
  const t=Math.max(0,Math.min(1,(dx+ridge+bleed*0.8)*0.9));
  const ci=Math.min(cols.length-1,Math.floor(t*cols.length));
  const rgb=dx>0.92?cols[0]:cols[ci];
  const weft=0.96+0.04*Math.sin(along*140);
  const silk=(0.93+0.07*Math.sin(across*200))*weft;
  return [Math.min(255,rgb[0]*silk),Math.min(255,rgb[1]*silk),Math.min(255,rgb[2]*silk)];
}

function applyHybridPanels(g,w,h,surfaceMode){
  const maskCanvas=document.createElement("canvas");maskCanvas.width=w;maskCanvas.height=h;
  const mc=maskCanvas.getContext("2d");
  for(const path of basketballChannelPaths())strokeWrappedBallPath(mc,path,w,h,4*h/256,"#000");
  const mask=mc.getImageData(0,0,w,h).data,labels=new Int16Array(w*h),queue=new Int32Array(w*h),votes=[];
  labels.fill(-1);let panel=0;
  for(let seed=0;seed<w*h;seed++){
    if(mask[seed*4+3]>32||labels[seed]>=0)continue;
    const pv=[0,0];votes.push(pv);
    let head=0,tail=0;queue[tail++]=seed;labels[seed]=panel;
    while(head<tail){
      const p=queue[head++],x=p%w,y=(p/w)|0;
      pv[rotatedTriColorIndex(x,y,w,h,2)]++;
      const left=y*w+(x?x-1:w-1),right=y*w+(x+1<w?x+1:0);
      if(mask[left*4+3]<=32&&labels[left]<0){labels[left]=panel;queue[tail++]=left;}
      if(mask[right*4+3]<=32&&labels[right]<0){labels[right]=panel;queue[tail++]=right;}
      if(y){const up=p-w;if(mask[up*4+3]<=32&&labels[up]<0){labels[up]=panel;queue[tail++]=up;}}
      if(y+1<h){const down=p+w;if(mask[down*4+3]<=32&&labels[down]<0){labels[down]=panel;queue[tail++]=down;}}
    }
    panel++;
  }
  const isCustom=votes.map(v=>v[1]>v[0]);
  const outImg=g.getImageData(0,0,w,h);

  if(surfaceMode==="flower"){
    // 对每一片自定义球皮独立做 3D 切平面 PCA，算出它自己的长轴 E_long 和短轴 E_short
    const sx=new Float64Array(panel),sy=new Float64Array(panel),sz=new Float64Array(panel),cnt=new Int32Array(panel);
    const pxArr=new Float32Array(w*h),pyArr=new Float32Array(w*h),pzArr=new Float32Array(w*h);
    for(let p=0;p<w*h;p++){
      const x=p%w,y=(p/w)|0,phi=((x+.5)/w)*Math.PI*2,th=((y+.5)/h)*Math.PI,sinT=Math.sin(th);
      const nx=-Math.cos(phi)*sinT,ny=Math.cos(th),nz=Math.sin(phi)*sinT;
      pxArr[p]=nx;pyArr[p]=ny;pzArr[p]=nz;
      const lb=labels[p];
      if(lb>=0&&isCustom[lb]){sx[lb]+=nx;sy[lb]+=ny;sz[lb]+=nz;cnt[lb]++;}
    }
    const basis=new Array(panel);
    for(let lb=0;lb<panel;lb++){
      if(!isCustom[lb]||!cnt[lb])continue;
      const nl=Math.hypot(sx[lb],sy[lb],sz[lb])||1;
      const Nx=sx[lb]/nl,Ny=sy[lb]/nl,Nz=sz[lb]/nl;
      // 构造切平面正交基 (T1, T2)
      const upX=Math.abs(Ny)<0.9?0:1,upY=Math.abs(Ny)<0.9?1:0,upZ=0;
      let t1x=upY*Nz-upZ*Ny,t1y=upZ*Nx-upX*Nz,t1z=upX*Ny-upY*Nx;
      const t1l=Math.hypot(t1x,t1y,t1z)||1;t1x/=t1l;t1y/=t1l;t1z/=t1l;
      const t2x=Ny*t1z-Nz*t1y,t2y=Nz*t1x-Nx*t1z,t2z=Nx*t1y-Ny*t1x;
      basis[lb]={t1x,t1y,t1z,t2x,t2y,t2z,cxx:0,cxy:0,cyy:0};
    }
    for(let p=0;p<w*h;p++){
      const lb=labels[p];if(lb<0||!basis[lb])continue;
      const B=basis[lb],nx=pxArr[p],ny=pyArr[p],nz=pzArr[p];
      const u1=nx*B.t1x+ny*B.t1y+nz*B.t1z,u2=nx*B.t2x+ny*B.t2y+nz*B.t2z;
      B.cxx+=u1*u1;B.cxy+=u1*u2;B.cyy+=u2*u2;
    }
    for(let lb=0;lb<panel;lb++){
      const B=basis[lb];if(!B)continue;
      const ang=0.5*Math.atan2(2*B.cxy,B.cxx-B.cyy),ca=Math.cos(ang),sa=Math.sin(ang);
      B.lx=ca*B.t1x+sa*B.t2x;B.ly=ca*B.t1y+sa*B.t2y;B.lz=ca*B.t1z+sa*B.t2z;
      B.sx=-sa*B.t1x+ca*B.t2x;B.sy=-sa*B.t1y+ca*B.t2y;B.sz=-sa*B.t1z+ca*B.t2z;
    }
    const hexRgb=hx=>{const n=parseInt(hx.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];};
    const cols=["#f5efe6","#f2b84b","#9b72cf","#2d9c92"].map(hexRgb);
    const r=ballTextureRng(0x521a808),warp=new Float32Array(256);
    for(let k=0;k<256;k++)warp[k]=(r()-0.5)*0.14+Math.sin(k*0.5)*0.035;
    for(let p=0;p<w*h;p++){
      const lb=labels[p];if(lb<0||!basis[lb])continue;
      const B=basis[lb],nx=pxArr[p],ny=pyArr[p],nz=pzArr[p];
      const along=nx*B.lx+ny*B.ly+nz*B.lz;
      const across=nx*B.sx+ny*B.sy+nz*B.sz;
      const rgb=sampleFlowerSilkAt(along,across,warp,r,cols);
      const i=p*4,grain=0.92+0.12*((outImg.data[i]-160)/80);
      outImg.data[i]=Math.max(0,Math.min(255,rgb[0]*grain));
      outImg.data[i+1]=Math.max(0,Math.min(255,rgb[1]*grain));
      outImg.data[i+2]=Math.max(0,Math.min(255,rgb[2]*grain));
      outImg.data[i+3]=255;
    }
    g.putImageData(outImg,0,0);
    return;
  }

  const surfH=makeLunarBallSurfaceCanvas(w,h).getContext("2d").getImageData(0,0,w,h).data;
  for(let p=0;p<w*h;p++){
    const lb=labels[p];
    if(lb>=0&&isCustom[lb]){
      const i=p*4,grain=0.92+0.12*((outImg.data[i]-160)/80);
      outImg.data[i]=Math.max(0,Math.min(255,surfH[i]*grain));
      outImg.data[i+1]=Math.max(0,Math.min(255,surfH[i+1]*grain));
      outImg.data[i+2]=Math.max(0,Math.min(255,surfH[i+2]*grain));
      outImg.data[i+3]=255;
    }
  }
  g.putImageData(outImg,0,0);
}

function paintBallLeather(g,w,h,base,dark,palette,hybridMode){
  if(palette)paintTriBallPanels(g,w,h,palette);else{g.fillStyle=base;g.fillRect(0,0,w,h);}
  const rnd=ballTextureRng(palette?0x51f15e:0xba11c0de),sc=h/256;
  const step=3.2*sc;
  for(let y=2,row=0;y<h-1;y+=step,row++){
    for(let x=2+(row&1)*1.6*sc;x<w-1;x+=step){
      const px=x+(rnd()-.5)*1.1*sc,py=y+(rnd()-.5)*1.1*sc,r=(1.1+rnd()*.55)*sc;
      g.fillStyle=dark;g.globalAlpha=palette?0.18:0.30;
      g.beginPath();g.arc(px+.4,py+.4,r,0,Math.PI*2);g.fill();
      g.fillStyle="#ffffff";g.globalAlpha=palette?0.08:0.12;
      g.beginPath();g.arc(px-.3,py-.3,r*.62,0,Math.PI*2);g.fill();
    }
  }
  g.globalAlpha=1;
  if(hybridMode)applyHybridPanels(g,w,h,hybridMode==="flower"?"flower":"lunar");
  // 轻微实战使用痕迹：细微磨砂划痕
  const wr=ballTextureRng(0x5c0ff01);
  g.lineCap="round";
  for(let i=0;i<55;i++){
    const sx=wr()*w,sy=wr()*h,ang=wr()*Math.PI*2,len=(10+wr()*34)*sc;
    g.strokeStyle=wr()>.45?"rgba(245,240,232,0.11)":"rgba(35,28,24,0.13)";
    g.lineWidth=(0.7+wr()*1.1)*sc;
    g.beginPath();g.moveTo(sx,sy);
    g.quadraticCurveTo(sx+Math.cos(ang+.2)*len*.5,sy+Math.sin(ang+.2)*len*.5,sx+Math.cos(ang)*len,sy+Math.sin(ang)*len);
    g.stroke();
  }
  // 先印海报体 aiBA 徽标，再绘制黑色下凹胶缝，确保黑线绝不被遮盖
  for(const cx of [w*0.5,0,w]){
    g.save();
    g.translate(cx,h*0.355);
    g.transform(1.04,-0.03,-0.26,0.95,0,0);
    const fsSm=Math.round(h*0.082),fsLg=Math.round(h*0.122);
    g.font="900 "+fsSm+"px 'Arial Black',Impact,sans-serif";
    const wAi=g.measureText("ai").width;
    g.font="900 "+fsLg+"px 'Arial Black',Impact,sans-serif";
    const wBa=g.measureText("BA").width;
    const gap=w*0.003,tot=wAi+gap+wBa;
    const xAi=-tot/2+wAi/2,xBa=tot/2-wBa/2;
    g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";
    g.fillStyle="rgba(22,18,16,0.82)";
    g.fillRect(-tot*.54,h*0.058,tot*1.08,h*0.01);
    g.fillStyle="rgba(238,232,222,0.75)";
    g.fillRect(-tot*.50,h*0.052,tot*0.62,h*0.005);
    g.font="900 "+fsSm+"px 'Arial Black',Impact,sans-serif";
    g.lineWidth=Math.max(2.5,h*0.017);g.strokeStyle="#181412";
    g.strokeText("ai",xAi,-h*0.015);
    g.fillStyle="#e8e2d7";g.fillText("ai",xAi,-h*0.015);
    g.font="900 "+fsLg+"px 'Arial Black',Impact,sans-serif";
    g.lineWidth=Math.max(3,h*0.02);g.strokeStyle="#181412";
    g.strokeText("BA",xBa,h*0.003);
    g.fillStyle="#f3efe6";g.fillText("BA",xBa,h*0.003);
    g.fillStyle="rgba(40,32,28,0.12)";
    for(let s=0;s<12;s++){
      g.fillRect((s*17%100-50)/100*tot,((s*31%40)-20)/100*h*0.16,w*0.005,h*0.0035);
    }
    g.restore();
  }
  paintBasketballChannels(g,w,h,false);
}

function realBallTex(base,dark,hybridMode){
  const W=hybridMode?1024:512,H=hybridMode?512:256;
  return pixTex(W,H,(g,w,h)=>paintBallLeather(g,w,h,base,dark,null,hybridMode||false),{smooth:true,mipmaps:true,anisotropy:8});
}

function triBallTex(){
  return pixTex(512,256,(g,w,h)=>paintBallLeather(g,w,h,"#e8771e","#1b1110",["#1f4fd8","#f2f2f2","#d8262e"],false),{smooth:true,mipmaps:true,anisotropy:8});
}

function ballReliefTex(){
  return pixTex(1024,512,(g,w,h)=>{
    g.fillStyle="#929292";g.fillRect(0,0,w,h);
    const rnd=ballTextureRng(0x8badf00d);g.fillStyle="#a6a6a6";
    for(let y=3,row=0;y<h-3;y+=5.5,row++)for(let x=3+(row&1)*2.75;x<w-3;x+=5.5){
      const px=x+(rnd()-.5)*1.4,py=y+(rnd()-.5)*1.4,r=1.5+rnd()*.7;
      g.beginPath();g.arc(px,py,r,0,Math.PI*2);g.fill();
    }
    paintBasketballChannels(g,w,h,true);
  },{smooth:true,mipmaps:true,anisotropy:8,linear:true});
}

const texBall=realBallTex("#c95a2e","#77351c",false);
let texLunarBall=null;
let texFlowerBall=null;
const texGold=triBallTex();
const texDeep=realBallTex("#54e05a","#1f7a26",false);
const texBallRelief=ballReliefTex();
const matBall=new THREE.MeshPhongMaterial({map:texBall,bumpMap:texBallRelief,bumpScale:.003,shininess:2.2,specular:0x191513});
const matGold=new THREE.MeshPhongMaterial({map:texGold,bumpMap:texBallRelief,bumpScale:.003,shininess:2.2,specular:0x222020});
const matDeep=new THREE.MeshPhongMaterial({map:texDeep,bumpMap:texBallRelief,bumpScale:.003,shininess:2.2,specular:0x142c16});
const ballGeo=(()=>{
  const geo=new THREE.SphereGeometry(0.16,64,48);
  const pos=geo.attributes.position,halfCore=0.0145,halfBevel=0.028;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),len=Math.hypot(x,y,z)||1;
    const nx=x/len,ny=y/len,nz=z/len,d=channelDistance3D(nx,ny,nz);
    if(d<halfBevel){
      const t=d<=halfCore?1:1-(d-halfCore)/(halfBevel-halfCore);
      const r=0.16*(1-0.016*(t*t*(3-2*t)));
      pos.setXYZ(i,nx*r,ny*r,nz*r);
    }
  }
  pos.needsUpdate=true;geo.computeVertexNormals();
  return geo;
})();
function syncBallVenue(name){
  const wantLunar=name==="lunarCrater";
  const wantFlower=name==="flowerCourt";
  if(wantLunar&&!texLunarBall)texLunarBall=realBallTex("#c95a2e","#77351c","lunar");
  if(wantFlower&&!texFlowerBall)texFlowerBall=realBallTex("#5b6f7d","#2e3b45","flower");
  const target=wantLunar?texLunarBall:(wantFlower?texFlowerBall:texBall);
  if(matBall.map!==target){
    matBall.map=target;
    matBall.specular.setHex(wantFlower?0x162028:0x191513);
    matBall.needsUpdate=true;
  }
}

/* ---------------- 中场 10 分球配色 ----------------
   原来固定荧光绿。10 分机会是全场最稀有的事件,却和普通深远球共用一个外观,
   出现时缺少"这颗球不一样"的第一眼信号。改成每次机会随机换一色。
   贴图**懒加载**:五套 512x256 的球皮如果开机就全建,启动多花约 40ms 且大部分用不上;
   真正开出 10 分机会才建,并且建过一次就缓存。 */
const SUPER_BALL_SKINS=Object.freeze([
  {n:"荧光绿",base:"#54e05a",dark:"#1f7a26",spec:0x183f1b},
  {n:"斩男粉",base:"#ff5fa2",dark:"#8c1f4f",spec:0x4a1830},
  {n:"水晶蓝",base:"#3fb9ff",dark:"#12557f",spec:0x143a52},
  {n:"土豪金",base:"#ffc02e",dark:"#8a5c07",spec:0x4d3508},
  {n:"暴力紫",base:"#a86bff",dark:"#4a1f8c",spec:0x2e1852}
]);
const superBallMats=new Array(SUPER_BALL_SKINS.length).fill(null);
function superBallMaterial(index){
  const i=((index|0)%SUPER_BALL_SKINS.length+SUPER_BALL_SKINS.length)%SUPER_BALL_SKINS.length;
  if(!superBallMats[i]){
    const c=SUPER_BALL_SKINS[i];
    superBallMats[i]=new THREE.MeshPhongMaterial({map:realBallTex(c.base,c.dark),
      bumpMap:texBallRelief,bumpScale:.003,shininess:2.2,specular:c.spec});
  }
  return superBallMats[i];
}
/* 走可复现随机通道:?seed=N 固定时,同一局开出的颜色序列也固定。 */
function rollSuperBallSkin(){
  const roll=typeof aibaRoll==="function"?aibaRoll():Math.random();
  return Math.floor(roll*SUPER_BALL_SKINS.length)%SUPER_BALL_SKINS.length;
}

window.AIBA.runtime.register("rendering:materials",Object.freeze({
  pixTex,realBallTex,triBallTex,texBall,texGold,texDeep,texBallRelief,matBall,matGold,matDeep,ballGeo,syncBallVenue,
  SUPER_BALL_SKINS,superBallMaterial,rollSuperBallSkin
}));
