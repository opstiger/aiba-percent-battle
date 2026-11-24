/* Off-ball 5v5 motion play controller (Last Shot MVP).
   Shoulder midpoint offset + lateral burst speed drive razor-agile arc movement;
   a 3-2-1-GO countdown signals start; raising both hands in the overhead zone calls for the pass.
   Sample timestamps come from pose inference so a held video frame cannot fabricate motion or gestures. */
(function(global){
  "use strict";
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const GLANCE_TARGETS=["ally0","ally1","ally3"];

  function create(){
    return {
      center:null,width:0,neutralFrames:0,lastFrame:-1,lastX:null,
      // 3-2-1-GO countdown (in seconds) once player stands calibrated in frame; clock frozen until GO!
      countdown:2.4,countdownTick:4,goFlash:0,started:false,
      target:0,vel:0,burst:0,armLift:0,armed:false,raisedAt:null,call:false,walking:false,
      // Live open-space & overhead zone telemetry for HUD & translucent call-zone UI
      openNow:false,openQuality:"intercepted",openGap:0,shoulderLine:0.42,callLineY:0.34,
      // Defender glance-away cadence (looks at ball handler or other cutters on court)
      glanceAt:1.05+Math.random()*1.15,glanceDur:1.25,glancing:false,glanceTarget:"ally0",glanceIdx:0,
      // Dynamic off-ball teammate screens (guaranteed 1st screen early, optional 2nd screen if still off-ball)
      screenAt:1.8+Math.random()*1.3,screenCount:0,screen:null,screenSnagUntil:0,screenToasted:false,
      // Player position trail so defender chases with realistic reaction lag (making sudden speed cuts shake him!)
      trail:[],
      passQuality:null,passGap:0,hint:""
    };
  }

  function recordPlayerTrail(play,pos,t){
    const tr=play.trail;
    if(tr.length&&t-tr[tr.length-1].t<.025)return;
    tr.push({t,x:pos.x,z:pos.z});
    while(tr.length>48)tr.shift();
  }

  function playerTrailAt(play,t){
    const tr=play.trail;
    if(!tr||!tr.length)return null;
    if(t<=tr[0].t)return tr[0];
    for(let i=tr.length-1;i>0;i--){
      const a=tr[i-1],b=tr[i];
      if(t>=a.t){
        const k=clamp((t-a.t)/Math.max(1e-4,b.t-a.t),0,1);
        return {x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k};
      }
    }
    return tr[tr.length-1];
  }

  function track(play,sample){
    if(!sample){
      play.raisedAt=null;play.call=false;play.armed=false;play.walking=false;play.vel=0;play.burst=0;
      if(play.neutralFrames<2){play.neutralFrames=0;play.center=null;play.lastX=null;}
      return false;
    }
    // Keep overhead call-zone line synced to player's live shoulder height for the translucent overlay
    if(Number.isFinite(sample.line))play.shoulderLine=sample.line;
    if(Number.isFinite(sample.callLineY))play.callLineY=sample.callLineY;

    if(sample.at===play.lastFrame)return play.neutralFrames>=2;
    const dtMs=play.lastFrame>0?clamp(sample.at-play.lastFrame,14,260):42;
    play.lastFrame=sample.at;
    if(play.neutralFrames<2){
      if(!sample.lowered){play.neutralFrames=0;play.center=null;play.lastX=null;return false;}
      if(play.center===null||Math.abs(play.center-sample.x)>sample.width*.20){
        play.center=sample.x;play.width=sample.width;play.neutralFrames=0;
      }
      play.lastX=sample.x;
      play.neutralFrames++;
      play.armed=true;
      return play.neutralFrames===2;
    }
    // During 3-2-1 countdown, softly lock center and hold position until GO!
    if(play.countdown>0){
      play.center=play.center*.7+sample.x*.3;
      play.width=play.width*.7+sample.width*.3;
      play.lastX=sample.x;
      play.target=0;play.vel=0;play.burst=0;play.raisedAt=null;play.call=false;
      if(sample.lowered)play.armed=true;
      return true;
    }

    const w=Math.max(.075,play.width||sample.width||.2);
    // Agile lateral displacement amplitude + burst velocity (low-latency control!)
    const offset=(play.center-sample.x)/w;
    const rawVel=play.lastX!=null?((play.lastX-sample.x)/w)/(dtMs/1000):0;
    play.lastX=sample.x;
    play.vel=play.vel*.24+clamp(rawVel,-8.0,8.0)*.76;
    play.burst=clamp(Math.abs(play.vel)/2.2,0,1);

    // Small deadzone (0.028) + crisp amplitude gain + fast velocity lead for instant precise cuts!
    const deadOffset=Math.sign(offset)*Math.max(0,Math.abs(offset)-.028);
    const speedLead=clamp(play.vel*.34,-1.55,1.55);
    play.target=clamp(deadOffset*4.35+speedLead,-4.45,4.45);

    if(sample.lowered)play.armed=true;
    if(sample.raised&&play.armed){
      if(play.raisedAt===null)play.raisedAt=sample.at;
      if(sample.at-play.raisedAt>=65){play.call=true;play.armed=false;}
    }else play.raisedAt=null;
    return true;
  }

  function move(play,pos,spot,hoop,dt,t){
    // Razor-agile lateral tracking: responsive to gentle sidesteps (~5.4 m/s) and explosive bursts (up to 9.8 m/s!)
    const maxSpeed=5.4+play.burst*4.4;
    const response=17.5+play.burst*10.5;
    const dx=clamp((play.target-pos.x)*(1-Math.exp(-response*dt)),-maxSpeed*dt,maxSpeed*dt);
    pos.x=clamp(pos.x+dx,-4.55,4.55);
    const radius=Math.max(5.5,spot.z-hoop.z);
    const r2=Math.max(1.2,radius*radius-pos.x*pos.x);
    pos.z=hoop.z+Math.sqrt(r2);
    play.walking=Math.abs(dx)>.14*dt;
    if(typeof t==="number")recordPlayerTrail(play,pos,t);
  }

  function readDefense(play,t,guard,screener,player){
    // 1) Defender occasionally looks away toward ball handler or another teammate on court!
    const wasGlancing=play.glancing;
    play.glancing=t>=play.glanceAt&&t<play.glanceAt+play.glanceDur;
    if(play.glancing&&!wasGlancing){
      play.glanceTarget=GLANCE_TARGETS[play.glanceIdx%GLANCE_TARGETS.length];
      play.glanceIdx++;
    }
    if(t>=play.glanceAt+play.glanceDur){
      play.glanceDur=1.05+Math.random()*.45;
      play.glanceAt=t+1.35+Math.random()*1.65;
    }

    // 2) Dynamic off-ball teammate screens (up to 2 screens in 12s; positioned on the open-lane side of defender!)
    if(play.screen&&t>=play.screen.until){
      play.screen=null;
      play.screenToasted=false;
      if(play.screenCount<2)play.screenAt=t+2.0+Math.random()*1.3;
    }
    if(!play.screen&&play.screenCount<2&&t>=play.screenAt){
      const openSide=player.x>=0?-1:1;
      const sx=clamp(guard.x+openSide*.96,-4.2,4.2);
      const sz=clamp(guard.z+.08,-4.8,player.z-.75);
      play.screen={x:sx,z:sz,side:openSide,until:t+3.8,planted:false};
      play.screenCount++;
      play.screenToasted=false;
    }
  }

  function passRead(from,to,guard){
    const dx=to.x-from.x,dz=to.z-from.z;
    const u=clamp(((guard.x-from.x)*dx+(guard.z-from.z)*dz)/(dx*dx+dz*dz||1),0,1);
    const lane=Math.hypot(guard.x-from.x-u*dx,guard.z-from.z-u*dz);
    const gap=Math.hypot(guard.x-to.x,guard.z-to.z);
    const cut=gap<1.45||(u>.12&&lane<.72);
    const quality=cut?"intercepted":(gap>=2.10?"wide":"tight");
    return {gap,lane,cut,quality};
  }

  global.AIBAOffball=Object.freeze({create,track,move,readDefense,passRead,playerTrailAt});
})(window);
