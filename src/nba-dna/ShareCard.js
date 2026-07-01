(function(global){
  "use strict";

  function drawCoverImage(ctx,img,x,y,w,h){
    if(!img){ctx.fillStyle="#080910";ctx.fillRect(x,y,w,h);return;}
    const ir=img.naturalWidth/img.naturalHeight,rr=w/h;
    let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
    if(ir>rr){sw=sh*rr;sx=(img.naturalWidth-sw)/2;}
    else{sh=sw/rr;sy=(img.naturalHeight-sh)/2;}
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function makePseudoCode(ctx,x,y,size){
    ctx.fillStyle="#f4f7fb";ctx.fillRect(x,y,size,size);
    ctx.fillStyle="#090b12";
    const cell=size/17;
    function marker(cx,cy){ctx.fillRect(x+cx*cell,y+cy*cell,cell*5,cell*5);ctx.fillStyle="#f4f7fb";ctx.fillRect(x+(cx+1)*cell,y+(cy+1)*cell,cell*3,cell*3);ctx.fillStyle="#090b12";ctx.fillRect(x+(cx+2)*cell,y+(cy+2)*cell,cell,cell);}
    marker(1,1);marker(11,1);marker(1,11);
    for(let yy=1;yy<16;yy++)for(let xx=1;xx<16;xx++){
      if((xx<6&&yy<6)||(xx>10&&yy<6)||(xx<6&&yy>10))continue;
      if(((xx*7+yy*11+size)%5)<2)ctx.fillRect(x+xx*cell,y+yy*cell,cell*.86,cell*.86);
    }
  }
  function build(result,userImg,analysis){
    const W=1080,H=1350,cv=document.createElement("canvas");cv.width=W;cv.height=H;
    const c=cv.getContext("2d");
    const data=analysis||{img:userImg,refImg:null,user:null,ref:null};
    if(!data.img)data.img=userImg;
    c.fillStyle="#03050b";c.fillRect(0,0,W,H);
    drawCoverImage(c,data.img||userImg,0,0,W,H);
    let g=c.createLinearGradient(0,0,W,H);
    g.addColorStop(0,"rgba(3,4,10,.82)");g.addColorStop(.42,"rgba(3,4,10,.38)");g.addColorStop(1,"rgba(3,4,10,.96)");
    c.fillStyle=g;c.fillRect(0,0,W,H);
    c.fillStyle="rgba(255,210,63,.08)";c.fillRect(0,0,20,H);
    c.fillStyle="rgba(119,231,255,.08)";c.fillRect(W-20,0,20,H);

    c.save();
    c.shadowColor="rgba(0,0,0,.75)";c.shadowBlur=26;c.shadowOffsetY=24;
    c.fillStyle="rgba(9,12,19,.92)";
    c.beginPath();c.moveTo(74,86);c.lineTo(992,48);c.lineTo(948,980);c.lineTo(116,1028);c.closePath();c.fill();
    c.restore();
    c.strokeStyle="rgba(255,210,63,.7)";c.lineWidth=5;
    c.beginPath();c.moveTo(74,86);c.lineTo(992,48);c.lineTo(948,980);c.lineTo(116,1028);c.closePath();c.stroke();
    c.strokeStyle="rgba(119,231,255,.35)";c.lineWidth=2;
    c.beginPath();c.moveTo(104,124);c.lineTo(956,88);c.lineTo(918,932);c.lineTo(148,974);c.closePath();c.stroke();

    c.save();
    c.beginPath();c.moveTo(116,150);c.lineTo(934,118);c.lineTo(900,805);c.lineTo(160,844);c.closePath();c.clip();
    const hero={x:130,y:126,w:790,h:720};
    if(global.NBADNAPoseVisualizer&&NBADNAPoseVisualizer.drawPosterHero)NBADNAPoseVisualizer.drawPosterHero(c,data,result,hero);
    else drawCoverImage(c,data.img||userImg,hero.x,hero.y,hero.w,hero.h);
    c.restore();

    c.fillStyle="#77e7ff";c.font="bold 29px monospace";c.fillText("YOUR NBA DNA",92,80);
    c.fillStyle="#fff";c.font="900 154px Arial Black, sans-serif";c.shadowColor="rgba(0,0,0,.9)";c.shadowBlur=0;c.shadowOffsetX=6;c.shadowOffsetY=7;
    c.fillText(result.total+"%",132,962);
    c.shadowOffsetX=0;c.shadowOffsetY=0;
    c.fillStyle="#ffd23f";c.font="900 52px Arial Black, sans-serif";c.fillText(result.star,136,1022);
    c.fillStyle="#d9f6ff";c.font="26px sans-serif";c.fillText(result.line,138,1068);

    const rows=[["出手动作",result.parts.shooting],["手肘稳定",result.parts.elbow],["身体平衡",result.parts.balance],["跟随动作",result.parts.follow]];
    rows.forEach((r,i)=>{
      const x=136+(i%2)*400,yy=1138+Math.floor(i/2)*74;
      c.fillStyle="rgba(5,8,13,.76)";c.fillRect(x-14,yy-38,330,54);
      c.strokeStyle=i===1?"rgba(124,252,107,.52)":"rgba(255,210,63,.45)";c.strokeRect(x-14,yy-38,330,54);
      c.fillStyle="#f4fbff";c.font="bold 25px sans-serif";c.fillText(r[0],x,yy);
      c.fillStyle=i===0?"#ffd23f":(i===1?"#7CFC6B":"#77e7ff");c.textAlign="right";c.fillText(r[1]+"%",x+284,yy);c.textAlign="left";
    });
    c.fillStyle="#ffd23f";c.font="bold 28px sans-serif";c.fillText("我的投篮有 "+result.total+"% 像 Kobe, 你呢?",138,1290);
    makePseudoCode(c,W-206,H-206,136);
    c.fillStyle="#9ab";c.font="16px monospace";c.textAlign="center";c.fillText("SCAN TO PLAY",W-138,H-46);c.textAlign="left";
    return cv;
  }
  function save(canvas){
    canvas.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="aiba-nba-dna.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    },"image/png");
  }
  async function share(canvas,result){
    const text=`我的投篮有 ${result.total}% 像 Kobe, 你呢?`;
    if(navigator.share&&canvas.toBlob){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(blob&&navigator.canShare){
        const file=new File([blob],"aiba-nba-dna.png",{type:"image/png"});
        if(navigator.canShare({files:[file]})){
          await navigator.share({title:"aiBA NBA DNA",text,files:[file]});
          return;
        }
      }
      await navigator.share({title:"aiBA NBA DNA",text,url:location.href});
      return;
    }
    try{await navigator.clipboard.writeText(text+" "+location.href);}catch(e){}
  }

  global.NBADNAShareCard={build,save,share};
})(window);
