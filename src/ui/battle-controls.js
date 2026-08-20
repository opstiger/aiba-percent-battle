/* ---- 点击点位移动:屏幕投影光圈 + 屏幕外边缘箭头 ---- */
let spotEls=null,edgeEls=null;
function buildSpotDots(){
  const host=$("spotDots");host.innerHTML="";spotEls=[];
  const eh=$("edgeArrows");eh.innerHTML="";edgeEls=[];
  BATTLE_SPOTS.forEach((sp,i)=>{
    const el=document.createElement("div");
    el.className="spot"+(sp.super?" super":"");
    el.innerHTML='<div class="ring"></div>';
    el.addEventListener("pointerdown",ev=>{ev.stopPropagation();ev.preventDefault();battleSetSpot(i);});
    host.appendChild(el);spotEls.push(el);
    // 边缘箭头(点位在画面外时显示)
    const ea=document.createElement("div");
    ea.className="ea"+(sp.super?" super":"");
    ea.addEventListener("pointerdown",ev=>{ev.stopPropagation();ev.preventDefault();battleSetSpot(i);});
    eh.appendChild(ea);edgeEls.push(ea);
  });
}
const _projV=new THREE.Vector3(),_ppWorld=new THREE.Vector3();
function hidePlayerPowerUI(){
  const el=$("playerPower");if(el)el.style.display="none";
}
function avoidPowerHudOverlap(el,x,y,W,H){
  const rack=$("hudRack");
  if(!rack||getComputedStyle(rack).display==="none")return{x,y};
  const rr=rack.getBoundingClientRect(),halfW=39,halfH=62,gap=10;
  const overlaps=()=>x+halfW>rr.left-gap&&x-halfW<rr.right+gap&&y+halfH>rr.top-gap&&y-halfH<rr.bottom+gap;
  if(!overlaps())return{x,y};
  const left=rr.left-gap-halfW,right=rr.right+gap+halfW;
  const candidates=[];
  if(left>=halfW)candidates.push(clamp(left,halfW,W-halfW));
  if(right<=W-halfW)candidates.push(clamp(right,halfW,W-halfW));
  if(candidates.length)x=candidates.reduce((best,v)=>Math.abs(v-x)<Math.abs(best-x)?v:best,candidates[0]);
  else y=clamp(rr.top-gap-halfH,halfH,H-halfH);
  return{x,y};
}
function updatePlayerPowerUI(){
  const el=$("playerPower");if(!el)return;
  const fixed=$("powerWrap");if(fixed)fixed.style.display="none";
  const s=curShot();
  const active=G.charging&&s&&!barHiddenFor(s)&&
    (G.state==="round"||G.state==="tiebreak"||G.state==="battle"||G.state==="rackrush"||G.state==="bootshot");
  if(!active){el.style.display="none";return;}
  const W=innerWidth,H=innerHeight;
  if(CAM.mode===0)ballWorldPos(_ppWorld);
  else _ppWorld.set(P.pos.x,1.28+P.jump,P.pos.z);
  _projV.copy(_ppWorld).project(camera);
  if(!Number.isFinite(_projV.x)||!Number.isFinite(_projV.y)||_projV.z>1){el.style.display="none";return;}
  let x=(_projV.x*0.5+0.5)*W,y=(-_projV.y*0.5+0.5)*H;
  x=clamp(x+54,56,W-38);
  y=clamp(y-14,78,H-78);
  ({x,y}=avoidPowerHudOverlap(el,x,y,W,H));
  el.style.display="block";el.style.left=x+"px";el.style.top=y+"px";
  const fill=el.querySelector("#ppFillClipRect"),sweet=el.querySelector(".ppSweet");
  const power=clamp(G.power,0,100);
  if(fill){
    if(power<=0.5){fill.setAttribute("y","124");fill.setAttribute("height","0");}
    else{const y=112-power;fill.setAttribute("y",String(clamp(y,12,112)));fill.setAttribute("height",String(124-clamp(y,12,112)));}
  }
  if(sweet){
    const training=G.practice||G.tutorial||G.interactiveTutorial;
    const zone=clamp(playerSweetZone()*1.05,4.5,training?15:10),center=78;
    const start=clamp(center-zone*.5,training?68:70,86),end=clamp(center+zone*.5,74,training?92:90),span=end-start;
    sweet.style.strokeDasharray=span+" 100";
    sweet.style.strokeDashoffset=String(-start);
  }
}
function updSpotDots(){
  const host=$("spotDots"),eh=$("edgeArrows");
  const show=G.mode==="battle"&&G.state==="battle"&&!G.battleOver;
  host.style.display=show?"block":"none";
  eh.style.display=show?"block":"none";
  // 当前点位地面光圈:跟随站位、轻微脉动(脱离比赛态则隐藏)
  if(curSpotRing){
    if(show){
      const cp=BATTLE_SPOTS[G.battleSpot||0].p;
      curSpotRing.visible=true;
      curSpotRing.position.set(cp.x,0.025,cp.z);
      const pulse=1+Math.sin(G.tNow*3.2)*0.06;
      curSpotRing.scale.set(pulse,pulse,1);
      const sp0=BATTLE_SPOTS[G.battleSpot||0];
      curSpotRing.material.color.setHex(sp0.super?0xff7a2a:0xffd23f);
      curSpotRing.material.opacity=0.42+Math.sin(G.tNow*3.2)*0.13;
    }else curSpotRing.visible=false;
  }
  if(!show||!spotEls)return;
  const W=innerWidth,H=innerHeight,M=46;
  BATTLE_SPOTS.forEach((sp,i)=>{
    const el=spotEls[i],ea=edgeEls[i];
    _projV.copy(sp.p);_projV.y=0.05;_projV.project(camera);
    const behind=_projV.z>1;
    let x=(_projV.x*0.5+0.5)*W,y=(-_projV.y*0.5+0.5)*H;
    const onScreen=!behind&&x>=M&&x<=W-M&&y>=M&&y<=H-M;
    const st=battleSpotStatus(i);
    if(onScreen){
      // 画面内:仅保留极淡的隐形点击热区(地面标记已画在球场上)
      el.style.display="flex";el.style.left=x+"px";el.style.top=y+"px";
      el.classList.toggle("cur",i===G.battleSpot);
      el.classList.toggle("locked",!st.ok);
      ea.style.display="none";
    }else{
      // 画面外:屏幕边缘只放一个小箭头指向(无文字),中场点尤其需要
      el.style.display="none";
      if(i===G.battleSpot){ea.style.display="none";return;}
      let px=x,py=y;
      if(behind){px=W-x;py=H-y;}
      const cx=W/2,cy=H/2;let dx=px-cx,dy=py-cy;
      const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
      const ex=clamp(cx+dx*(W/2-M),M,W-M),ey=clamp(cy+dy*(H/2-M),M,H-M);
      ea.style.display="flex";ea.style.left=ex+"px";ea.style.top=ey+"px";
      const arrow=dx>0.4?"▶":(dx<-0.4?"◀":(dy>0?"▼":"▲"));
      ea.style.opacity=st.ok?"1":".4";
      ea.textContent=arrow;
    }
  });
}
function battlePrevSpot(){const n=BATTLE_SPOTS.length;battleSetSpot(((G.battleSpot||0)-1+n)%n);}
function battleNextSpot(){const n=BATTLE_SPOTS.length;battleSetSpot(((G.battleSpot||0)+1)%n);}

window.AIBA.runtime.register("ui:battle-controls",Object.freeze({
  buildSpotDots,hidePlayerPowerUI,updatePlayerPowerUI,updSpotDots,battlePrevSpot,battleNextSpot
}));
