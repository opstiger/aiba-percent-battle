/* Off-ball 5v5 motion play controller (Last Shot MVP).
   Shoulder midpoint offset + lateral burst speed drive arc movement; raising both hands calls for the pass.
   Sample timestamps come from pose inference so a held video frame cannot fabricate motion or gestures. */
(function(global){
  "use strict";
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const GLANCE_TARGETS=["ally0","ally1","ally3"];

  function create(){
    return {
      center:null,width:0,neutralFrames:0,lastFrame:-1,lastX:null,
      target:0,vel:0,burst:0,armLift:0,armed:false,raisedAt:null,call:false,walking:false,
      // Defender glance-away cadence (looks at ball handler or other cutters on court)
      glanceAt:1.05+Math.random()*1.25,glanceDur:1.15,glancing:false,glanceTarget:"ally0",glanceIdx:0,
      // Dynamic off-ball teammate screens (guaranteed 1st screen early, optional 2nd screen if still off-ball)
      screenAt:2.0+Math.random()*1.5,screenCount:0,screen:null,screenSnagUntil:0,screenToasted:false,
      // Player position trail so defender chases with realistic reaction lag (making sudden speed cuts shake him!)
      trail:[],
      passQuality:null,passGap:0,hint:""
    };
  }

  function recordPlayerTrail(play,pos,t){
    const tr=play.trail;
    if(tr.length&&t-tr[tr.length-1].t<.03)return;
    tr.push({t,x:pos.x,z:pos.z});
    while(tr.length>42)tr.shift();
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
      if(play.neutralFrames<3){play.neutralFrames=0;play.center=null;play.lastX=null;}
      return false;
    }
    if(sample.at===play.lastFrame)return play.neutralFrames>=3;
    const dtMs=play.lastFrame>0?clamp(sample.at-play.lastFrame,16,320):80;
    play.lastFrame=sample.at;
    if(play.neutralFrames<3){
      if(!sample.lowered){play.neutralFrames=0;play.center=null;play.lastX=null;return false;}
      if(play.center===null||Math.abs(play.center-sample.x)>sample.width*.18){
        play.center=sample.x;play.width=sample.width;play.neutralFrames=0;
      }
      play.lastX=sample.x;
      play.neutralFrames++;
      play.armed=true;
      return play.neutralFrames===3;
    }
    const w=Math.max(.075,play.width||sample.width||.2);
    // Lateral displacement amplitude (normalized by shoulder width)
    const offset=(play.center-sample.x)/w;
    // Lateral movement speed (shoulder-widths per second; camera X is mirrored so prev - cur = +right)
    const rawVel=play.lastX!=null?((play.lastX-sample.x)/w)/(dtMs/1000):0;
    play.lastX=sample.x;
    play.vel=play.vel*.45+clamp(rawVel,-6.5,6.5)*.55;
    play.burst=clamp(Math.abs(play.vel)/2.6,0,1);

    // Combine amplitude + speed lead so quick explosive cuts drive harder separation along the 3PT arc!
    const deadOffset=Math.sign(offset)*Math.max(0,Math.abs(offset)-.055);
    const speedLead=clamp(play.vel*.28,-1.25,1.25);
    play.target=clamp(deadOffset*3.9+speedLead,-4.35,4.35);

    if(sample.lowered)play.armed=true;
    if(sample.raised&&play.armed){
      if(play.raisedAt===null)play.raisedAt=sample.at;
      if(sample.at-play.raisedAt>=85){play.call=true;play.armed=false;}
    }else play.raisedAt=null;
    return true;
  }

  function move(play,pos,spot,hoop,dt,t){
    // Dynamic speed scales with player's real lateral movement speed (slow shuffle ~3.5 m/s, explosive cut up to 7.6 m/s!)
    const maxSpeed=3.6+play.burst*4.0;
    const response=8.5+play.burst*6.5;
    const dx=clamp((play.target-pos.x)*(1-Math.exp(-response*dt)),-maxSpeed*dt,maxSpeed*dt);
    pos.x=clamp(pos.x+dx,-4.5,4.5);
    const radius=Math.max(5.5,spot.z-hoop.z);
    const r2=Math.max(1.2,radius*radius-pos.x*pos.x);
    pos.z=hoop.z+Math.sqrt(r2);
    play.walking=Math.abs(dx)>.18*dt;
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
      play.glanceDur=1.0+Math.random()*.42;
      play.glanceAt=t+1.45+Math.random()*1.75;
    }

    // 2) Dynamic off-ball teammate screens (up to 2 screens in 12s; positioned on the open-lane side of defender!)
    if(play.screen&&t>=play.screen.until){
      play.screen=null;
      play.screenToasted=false;
      if(play.screenCount<2)play.screenAt=t+2.2+Math.random()*1.4;
    }
    if(!play.screen&&play.screenCount<2&&t>=play.screenAt){
      // Pick the side with more space along the arc so player has a clean curl lane off the screen
      const openSide=player.x>=0?-1:1;
      const sx=clamp(guard.x+openSide*.96,-4.2,4.2);
      const sz=clamp(guard.z+.08,-4.8,player.z-.75);
      play.screen={x:sx,z:sz,side:openSide,until:t+3.6,planted:false};
      play.screenCount++;
      play.screenToasted=false;
    }
  }

  function passRead(from,to,guard){
    const dx=to.x-from.x,dz=to.z-from.z;
    const u=clamp(((guard.x-from.x)*dx+(guard.z-from.z)*dz)/(dx*dx+dz*dz||1),0,1);
    const lane=Math.hypot(guard.x-from.x-u*dx,guard.z-from.z-u*dz);
    const gap=Math.hypot(guard.x-to.x,guard.z-to.z);
    const cut=gap<1.48||(u>.12&&lane<.74);
    const quality=cut?"intercepted":(gap>=2.15?"wide":"tight");
    return {gap,lane,cut,quality};
  }

  global.AIBAOffball=Object.freeze({create,track,move,readDefense,passRead,playerTrailAt});
})(window);
