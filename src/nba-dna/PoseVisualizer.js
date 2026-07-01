(function(global){
  "use strict";

  const GROUPS=[
    {name:"head",bones:[[0,2],[2,4],[0,5],[5,7],[9,10]],w:.7},
    {name:"torso",bones:[[11,12],[11,23],[12,24],[23,24],[11,24],[12,23]],w:1},
    {name:"leftArm",bones:[[11,13],[13,15],[15,17],[15,19],[15,21],[17,19]],w:1.12},
    {name:"rightArm",bones:[[12,14],[14,16],[16,18],[16,20],[16,22],[18,20]],w:1.12},
    {name:"leftLeg",bones:[[23,25],[25,27],[27,29],[29,31],[27,31]],w:1.04},
    {name:"rightLeg",bones:[[24,26],[26,28],[28,30],[30,32],[28,32]],w:1.04}
  ];
  const BONES=GROUPS.flatMap(g=>g.bones.map(b=>({pair:b,group:g.name,w:g.w})));
  const IMPORTANT=[0,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32];

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function conf(p){return p?(p.visibility==null?(p.presence==null?1:p.presence):p.visibility):0;}
  function visible(p){return !!p&&conf(p)>.12;}
  function strong(p){return !!p&&conf(p)>.32;}
  function imgRect(img,x,y,w,h,cover){
    if(!img||!img.naturalWidth||!img.naturalHeight)return {x,y,w,h};
    const ir=img.naturalWidth/img.naturalHeight,rr=w/h;
    let dw=w,dh=h,dx=x,dy=y;
    if(cover?(ir<rr):(ir>rr)){dh=w/ir;dy=y+(h-dh)/2;}
    else{dw=h*ir;dx=x+(w-dw)/2;}
    return {x:dx,y:dy,w:dw,h:dh};
  }
  function drawImage(ctx,img,rect,alpha,cover){
    ctx.save();
    ctx.globalAlpha=alpha==null?1:alpha;
    ctx.fillStyle="#05070d";ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
    if(img){const r=imgRect(img,rect.x,rect.y,rect.w,rect.h,cover);ctx.drawImage(img,r.x,r.y,r.w,r.h);}
    ctx.restore();
  }
  function bounds(lm){
    const pts=(lm||[]).filter(visible);
    if(!pts.length)return null;
    return pts.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),
      {minX:1,maxX:0,minY:1,maxY:0});
  }
  function expandBounds(b,pad){
    if(!b)return null;
    const w=Math.max(.08,b.maxX-b.minX),h=Math.max(.12,b.maxY-b.minY);
    return {minX:b.minX-w*pad,maxX:b.maxX+w*pad,minY:b.minY-h*pad,maxY:b.maxY+h*pad};
  }
  function unionBounds(a,b){
    if(!a)return b;if(!b)return a;
    return {minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY)};
  }
  function mapper(lm,rect,sharedBounds,offset){
    const b=expandBounds(sharedBounds||bounds(lm),.13);
    const off=offset||{x:0,y:0};
    if(!b)return p=>({x:rect.x+rect.w*.5+off.x,y:rect.y+rect.h*.5+off.y});
    const bw=Math.max(.08,b.maxX-b.minX),bh=Math.max(.12,b.maxY-b.minY);
    const scale=Math.min(rect.w/bw,rect.h/bh);
    const ox=rect.x+rect.w*.5-(b.minX+bw*.5)*scale+off.x;
    const oy=rect.y+rect.h*.5-(b.minY+bh*.5)*scale+off.y;
    return p=>({x:ox+p.x*scale,y:oy+p.y*scale});
  }
  function lerpPoint(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  function blendMappers(from,to,t){
    return (p,i,lm)=>lerpPoint(from(p,i,lm),to(p,i,lm),t);
  }
  function drawSegment(ctx,a,b,t){
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
  }
  function drawBadge(ctx,x,y,text,color){
    ctx.save();
    ctx.font="bold 12px Orbitron, monospace";
    const w=ctx.measureText(text).width+18;
    ctx.fillStyle="rgba(5,8,13,.78)";ctx.fillRect(x,y,w,24);
    ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.strokeRect(x+.5,y+.5,w-1,23);
    ctx.fillStyle=color;ctx.fillText(text,x+9,y+16);
    ctx.restore();
  }
  function hasPose(lm){return !!lm&&lm.some(visible);}
  function drawMissingPose(ctx,rect,progress){
    const p=clamp(progress,0,1),cx=rect.x+rect.w*.73,cy=rect.y+rect.h*.42,scale=Math.min(rect.w,rect.h)/5.4;
    const pts=[
      [0,-1.12],[0,-.62],[-.42,-.28],[.42,-.28],[-.34,.26],[.34,.26],[-.48,.86],[.48,.86]
    ].map(a=>({x:cx+a[0]*scale,y:cy+a[1]*scale}));
    const segs=[[0,1],[1,2],[1,3],[1,4],[1,5],[4,6],[5,7]];
    ctx.save();
    ctx.globalAlpha=.22+.38*p;
    ctx.setLineDash([8,7]);ctx.lineCap="round";ctx.lineJoin="round";
    ctx.strokeStyle="#77e7ff";ctx.shadowColor="#77e7ff";ctx.shadowBlur=12;ctx.lineWidth=4;
    segs.forEach((s,i)=>{
      if(p<i/segs.length*.6)return;
      ctx.beginPath();ctx.moveTo(pts[s[0]].x,pts[s[0]].y);ctx.lineTo(pts[s[1]].x,pts[s[1]].y);ctx.stroke();
    });
    ctx.setLineDash([]);ctx.fillStyle="#77e7ff";
    pts.forEach((q,i)=>{if(p<i/pts.length*.55)return;ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();});
    ctx.shadowBlur=0;ctx.globalAlpha=.95;
    drawBadge(ctx,rect.x+rect.w-214,rect.y+70,"YOUR POSE NOT LOCKED","#77e7ff");
    ctx.fillStyle="#9fdfff";ctx.font="bold 11px Orbitron, monospace";
    ctx.fillText("TRY FULL BODY / BRIGHT PHOTO",rect.x+rect.w-204,rect.y+116);
    ctx.restore();
  }
  function drawSkeleton(ctx,lm,rect,theme,progress,lineWidth,map){
    if(!lm||!lm.length)return;
    const to=map||mapper(lm,rect);
    const total=BONES.length,drawCount=progress*total;
    ctx.save();
    ctx.lineCap="round";ctx.lineJoin="round";
    for(let i=0;i<BONES.length;i++){
      const item=BONES[i],local=clamp(drawCount-i,0,1),a=lm[item.pair[0]],b=lm[item.pair[1]];
      if(local<=0||!visible(a)||!visible(b))continue;
      const pa=to(a,item.pair[0],lm),pb=to(b,item.pair[1],lm);
      ctx.globalAlpha=(strong(a)&&strong(b)?theme.alpha:.36)*ease(local);
      ctx.lineWidth=(lineWidth||5)*item.w;
      ctx.strokeStyle=theme.glow;ctx.shadowColor=theme.glow;ctx.shadowBlur=theme.blur||14;
      ctx.beginPath();drawSegment(ctx,pa,pb,local);ctx.stroke();
      ctx.lineWidth=Math.max(1.5,(lineWidth||5)*item.w*.42);
      ctx.strokeStyle=theme.core;ctx.shadowBlur=0;
      ctx.beginPath();drawSegment(ctx,pa,pb,local);ctx.stroke();
    }
    ctx.shadowBlur=0;
    IMPORTANT.forEach((i,idx)=>{
      const p=lm[i];
      if(!visible(p)||progress<idx/IMPORTANT.length*.55)return;
      const q=to(p,i,lm),r=(i>=17&&i<=22)||i>=29?Math.max(2.2,(lineWidth||5)*.38):Math.max(3,(lineWidth||5)*.56);
      ctx.globalAlpha=strong(p)?theme.alpha:.42;
      ctx.fillStyle=theme.core;ctx.strokeStyle=theme.dotStroke||"#05070d";ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    });
    ctx.restore();
  }
  function drawWeakLandmarks(ctx,lm,map,color){
    if(!lm)return;
    ctx.save();
    ctx.strokeStyle=color;ctx.globalAlpha=.38;ctx.setLineDash([3,4]);
    IMPORTANT.forEach(i=>{
      const p=lm[i];
      if(!p||strong(p)||!visible(p))return;
      const q=map(p,i,lm);
      ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.stroke();
    });
    ctx.restore();
  }
  function sideKeys(result){
    const left=result&&result.metrics&&result.metrics.side==="left";
    return {shoulder:left?11:12,elbow:left?13:14,wrist:left?15:16,index:left?19:20,knee:left?25:26,ankle:left?27:28};
  }
  function scoreRows(result){
    const p=result&&result.parts?result.parts:{shooting:76,elbow:72,balance:70,follow:68};
    const k=sideKeys(result);
    return [
      {name:"出手点",score:p.shooting,key:k.wrist},
      {name:"手肘角度",score:p.elbow,key:k.elbow},
      {name:"身体轴线",score:p.balance,key:k.shoulder},
      {name:"跟随动作",score:p.follow,key:k.index}
    ];
  }
  function calloutPoint(data,row,rect,map){
    const lm=data&&data.user;
    if(!lm||!lm.length)return {x:rect.x+rect.w*(.65+(row.key%3)*.05),y:rect.y+rect.h*(.22+(row.key%4)*.14)};
    const p=lm[row.key]||lm[16]||lm[15];
    if(!visible(p))return {x:rect.x+rect.w*.68,y:rect.y+rect.h*.45};
    return map(p,row.key,lm);
  }
  function drawType(ctx,text,x,y,count,color,size){
    const shown=text.slice(0,Math.max(0,Math.floor(count)));
    ctx.fillStyle=color||"#eef7ff";ctx.font=`bold ${size||18}px Orbitron, monospace`;
    ctx.fillText(shown,x,y);
  }
  function drawCallouts(ctx,data,result,rect,amount,poster,userMap){
    const rows=scoreRows(result);
    ctx.save();
    rows.forEach((row,i)=>{
      const show=clamp(amount*rows.length-i,0,1);
      if(show<=0)return;
      const p=calloutPoint(data,row,rect,userMap);
      const side=i%2===0?1:-1;
      const boxW=poster?236:150,boxH=poster?48:36;
      const tx=clamp(p.x+side*(poster?126:86),rect.x+18,rect.x+rect.w-boxW-16);
      const ty=clamp(p.y-24,rect.y+48,rect.y+rect.h-34);
      ctx.globalAlpha=ease(show);
      ctx.strokeStyle=row.score>=82?"#7CFC6B":"#ffd23f";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(tx-10*side,ty+6);ctx.stroke();
      ctx.fillStyle="rgba(5,8,13,.84)";ctx.fillRect(tx-8,ty-22,boxW,boxH);
      ctx.strokeStyle="rgba(255,255,255,.26)";ctx.strokeRect(tx-8,ty-22,boxW,boxH);
      const label=`${row.name} ${Math.round(row.score)}%`;
      if(show>.98)drawType(ctx,label,tx,ty,label.length,row.score>=82?"#7CFC6B":"#ffd23f",poster?24:15);
      else drawType(ctx,label,tx,ty,show*label.length,row.score>=82?"#7CFC6B":"#ffd23f",poster?24:15);
    });
    ctx.restore();
  }
  function drawDoubleExposure(ctx,data,result,rect,phase,poster){
    const t=clamp(phase==null?1:phase,0,1);
    const hasRef=hasPose(data&&data.ref),hasUser=hasPose(data&&data.user);
    ctx.save();
    ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip();
    drawImage(ctx,data&&data.refImg,rect,.24,true);
    ctx.globalCompositeOperation="screen";
    drawImage(ctx,data&&data.img,rect,.44+.16*t,true);
    ctx.globalCompositeOperation="source-over";
    const grad=ctx.createLinearGradient(rect.x,rect.y,rect.x,rect.y+rect.h);
    grad.addColorStop(0,"rgba(2,3,8,.06)");grad.addColorStop(.62,"rgba(2,3,8,.30)");grad.addColorStop(1,"rgba(2,3,8,.80)");
    ctx.fillStyle=grad;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
    const shared=unionBounds(bounds(data&&data.ref),bounds(data&&data.user));
    const refExtract=mapper(data&&data.ref,rect,shared,{x:-46*(1-t),y:0});
    const userExtract=mapper(data&&data.user,rect,shared,{x:54*(1-t),y:10*(1-t)});
    const refFinal=mapper(data&&data.ref,rect,shared,{x:poster?0:-7,y:0});
    const userFinal=mapper(data&&data.user,rect,shared,{x:poster?34:32,y:poster?-12:-8});
    const alignT=clamp((t-.42)/.34,0,1);
    const refMap=blendMappers(refExtract,refFinal,alignT);
    const userMap=blendMappers(userExtract,userFinal,alignT);
    if(t>.04)drawBadge(ctx,rect.x+12,rect.y+12,hasRef?"KOBE STANDARD":"KOBE NOT LOCKED",poster?"#ffd23f":"rgba(255,210,63,.9)");
    if(t>.2)drawBadge(ctx,rect.x+12,rect.y+42,hasUser?"YOUR POSE LOCKED":"YOUR POSE RETRY",poster?"#77e7ff":"rgba(119,231,255,.95)");
    drawSkeleton(ctx,data&&data.ref,rect,{glow:"rgba(255,210,63,.92)",core:"#ffe371",alpha:.82,blur:poster?17:12,dotStroke:"#2a2105"},clamp((t-.08)/.24,0,1),poster?6.8:4.7,refMap);
    if(hasUser){
      drawSkeleton(ctx,data&&data.user,rect,{glow:"rgba(119,231,255,1)",core:"#b6fbff",alpha:.98,blur:poster?22:17,dotStroke:"#041d24"},clamp((t-.28)/.28,0,1),poster?7.2:5.4,userMap);
      drawWeakLandmarks(ctx,data&&data.user,userMap,"#77e7ff");
    }else drawMissingPose(ctx,rect,clamp((t-.28)/.28,0,1));
    drawWeakLandmarks(ctx,data&&data.ref,refMap,"#ffd23f");
    if(hasUser)drawCallouts(ctx,data,result,rect,clamp((t-.68)/.25,0,1),poster,userMap);
    ctx.fillStyle="rgba(255,255,255,.055)";
    for(let y=rect.y;y<rect.y+rect.h;y+=7)ctx.fillRect(rect.x,y,rect.w,1);
    ctx.restore();
  }
  function drawAnalysis(ctx,data,result,progress){
    const W=ctx.canvas.width,H=ctx.canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#05070d";ctx.fillRect(0,0,W,H);
    const rect={x:18,y:18,w:W-36,h:H-88};
    drawDoubleExposure(ctx,data,result,rect,progress,false);
    const scanY=rect.y+rect.h*((progress*1.65)%1);
    ctx.fillStyle="rgba(119,231,255,.16)";ctx.fillRect(rect.x,scanY-12,rect.w,24);
    ctx.strokeStyle="rgba(119,231,255,.9)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rect.x,scanY);ctx.lineTo(rect.x+rect.w,scanY);ctx.stroke();
    ctx.fillStyle="#77e7ff";ctx.font="bold 12px Orbitron, monospace";ctx.fillText("POSE ALIGNMENT / LOCAL",22,H-48);
    const dots=Math.floor((progress*18)%4);
    ctx.fillStyle="#ffd23f";ctx.fillText("PRINTING MATCH DATA"+".".repeat(dots),22,H-28);
    ctx.strokeStyle="rgba(255,210,63,.42)";ctx.strokeRect(rect.x,rect.y,rect.w,rect.h);
  }
  function animate(canvas,data,result,onFrame){
    const ctx=canvas.getContext("2d");
    const duration=4600,start=performance.now();
    return new Promise(resolve=>{
      function tick(now){
        const p=clamp((now-start)/duration,0,1);
        drawAnalysis(ctx,data,result,ease(p));
        if(onFrame)onFrame(p);
        if(p<1)requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }
  function snapshot(canvas,data,result){
    const ctx=canvas.getContext("2d");
    drawAnalysis(ctx,data,result,1);
  }
  function drawPosterHero(ctx,data,result,rect){
    drawDoubleExposure(ctx,data,result,rect,1,true);
  }

  global.NBADNAPoseVisualizer={animate,snapshot,drawPosterHero,scoreRows};
})(window);
