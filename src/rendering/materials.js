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
function spaldingPanelCurve(samples){
  const pts=[],radius=1.5;
  for(let i=0;i<=samples;i++){
    const a=i/samples*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    let lo=0,hi=2;
    for(let n=0;n<24;n++){
      const r=(lo+hi)*.5,u=r*c,v=r*s;
      const x=u-u*u*u/3+u*v*v;
      const y=v-v*v*v/3+v*u*u;
      const z=u*u-v*v;
      if(Math.hypot(x,y,z)<radius)lo=r;else hi=r;
    }
    const r=(lo+hi)*.5,u=r*c,v=r*s;
    const x=(u-u*u*u/3+u*v*v)/radius;
    const y=(v-v*v*v/3+v*u*u)/radius;
    const z=(u*u-v*v)/radius;
    pts.push(ballUvPoint(x,y,z));
  }
  return pts;
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
  for(const p of paths)strokeWrappedBallPath(g,p,w,h,8*scale,relief?"#303030":"#54250e");
  for(const p of paths)strokeWrappedBallPath(g,p,w,h,4.4*scale,relief?"#090909":"#130905");
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

function paintBallLeather(g,w,h,base,dark,palette){
  if(palette)paintTriBallPanels(g,w,h,palette);else{g.fillStyle=base;g.fillRect(0,0,w,h);}
  const rnd=ballTextureRng(palette?0x51f15e:0xba11c0de);
  g.fillStyle=dark;g.globalAlpha=palette ? 0.15 : 0.24;
  for(let y=2,row=0;y<h-1;y+=3,row++){
    for(let x=2+(row&1)*1.5;x<w-1;x+=3){
      const px=x+(rnd()-.5)*1.2,py=y+(rnd()-.5)*1.2,r=rnd()>.82?1.15:.72;
      g.beginPath();g.arc(px,py,r,0,Math.PI*2);g.fill();
    }
  }
  g.globalAlpha=1;paintBasketballChannels(g,w,h,false);
}

function realBallTex(base,dark){
  return pixTex(512,256,(g,w,h)=>paintBallLeather(g,w,h,base,dark,null),{smooth:true,mipmaps:true,anisotropy:8});
}

function triBallTex(){
  return pixTex(512,256,(g,w,h)=>paintBallLeather(g,w,h,"#e8771e","#1b1110",["#1f4fd8","#f2f2f2","#d8262e"]),{smooth:true,mipmaps:true,anisotropy:8});
}

function ballReliefTex(){
  return pixTex(512,256,(g,w,h)=>{
    g.fillStyle="#787878";g.fillRect(0,0,w,h);
    const rnd=ballTextureRng(0x8badf00d);g.fillStyle="#a8a8a8";
    for(let y=2,row=0;y<h-1;y+=3,row++)for(let x=2+(row&1)*1.5;x<w-1;x+=3){
      const px=x+(rnd()-.5),py=y+(rnd()-.5);g.fillRect(px,py,1.4,1.4);
    }
    paintBasketballChannels(g,w,h,true);
  },{smooth:true,mipmaps:true,anisotropy:8,linear:true});
}

const texBall=realBallTex("#d66032","#77351c");
const texGold=triBallTex();
const texDeep=realBallTex("#54e05a","#1f7a26");
const texBallRelief=ballReliefTex();
const matBall=new THREE.MeshPhongMaterial({map:texBall,bumpMap:texBallRelief,bumpScale:.0018,shininess:5,specular:0x4a2a18});
const matGold=new THREE.MeshPhongMaterial({map:texGold,bumpMap:texBallRelief,bumpScale:.0018,shininess:5,specular:0x303030});
const matDeep=new THREE.MeshPhongMaterial({map:texDeep,bumpMap:texBallRelief,bumpScale:.0018,shininess:5,specular:0x183f1b});
const ballGeo=new THREE.SphereGeometry(0.16,32,20);

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
      bumpMap:texBallRelief,bumpScale:.0018,shininess:5,specular:c.spec});
  }
  return superBallMats[i];
}
/* 走可复现随机通道:?seed=N 固定时,同一局开出的颜色序列也固定。 */
function rollSuperBallSkin(){
  const roll=typeof aibaRoll==="function"?aibaRoll():Math.random();
  return Math.floor(roll*SUPER_BALL_SKINS.length)%SUPER_BALL_SKINS.length;
}

window.AIBA.runtime.register("rendering:materials",Object.freeze({
  pixTex,realBallTex,triBallTex,texBall,texGold,texDeep,texBallRelief,matBall,matGold,matDeep,ballGeo,
  SUPER_BALL_SKINS,superBallMaterial,rollSuperBallSkin
}));
