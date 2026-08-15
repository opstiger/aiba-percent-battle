"use strict";

const GAME_VERSION="v2.19.5";
const GAME_NAME="aiBA·百分大战";
const CONFIG=window.AIBA_CONFIG||{};
const COURT={
  width:15.24,length:28.65,halfWidth:7.62,
  nearBaseline:-9.58,farBaseline:19.07,midZ:4.745,
  nearHoopZ:-8,farHoopZ:17.49,
  floorMinZ:-13,floorMaxZ:23,
  playMaxZ:4.245
};
const COURT_ATTACK_DIR=V3(0,0,-1);
const HOOP=V3(0,3.05,COURT.nearHoopZ);
const EYE=1.78;
const RACKS=[
  {p:V3(-7.2,0,-6.15),n:"左底角"},
  {p:V3(-5.62,0,-2.38),n:"左侧 45°"},
  {p:V3(0,0,-0.05),n:"弧顶"},
  {p:V3(5.62,0,-2.38),n:"右侧 45°"},
  {p:V3(7.2,0,-6.15),n:"右底角"}
];
const DEEPS=[{p:V3(-3.7,0,0.95)},{p:V3(3.7,0,0.95)}];
const HALFCOURT={p:V3(0,0,COURT.playMaxZ),n:"中场 LOGO 超远",val:10};
const DIFFS=CONFIG.DIFFS;
const IDEAL=74,IDEAL_DEEP=86,IDEAL_HALF=94;
const BATTLE_TARGET=100;
const CUTAWAY_MIN_SCORE=20;
const BATTLE_CUT_COOLDOWN=18;
const BATTLE_CUT_MIN_SCORE_EVENTS=3;
const BATTLE_CUT_MAX=3;
const BATTLE_BAR_VISIBLE_SHOTS=5;
const OPP_SPOT_EMPTY_WAIT=0.38;
const BATTLE_NORMAL_STOCK=5;
const BATTLE_NORMAL_RELOAD=10;
const BATTLE_DEEP_RELOAD=10;
const RACK_RUSH_RUNS_KEY="aiba-rack-rush-runs-v1";
const RACK_RUSH_SPEED_RUNS_KEY="aiba-rack-rush-speed100-runs-v1";
const RACK_RUSH_SPEED_TARGET=100;
const RACK_RUSH_LEVELS=CONFIG.RACK_RUSH_LEVELS;
const SCENE_PRESETS=CONFIG.SCENE_PRESETS;
let currentScenePreset="indoor";
try{
  const savedScene=localStorage.getItem("aiba-scene-preset");
  if(savedScene&&SCENE_PRESETS[savedScene])currentScenePreset=savedScene;
}catch(e){}
try{
  const sharedScene=new URLSearchParams(location.search).get("scene");
  if(sharedScene&&SCENE_PRESETS[sharedScene])currentScenePreset=sharedScene;
}catch(e){}
let currentWeather=SCENE_PRESETS[currentScenePreset].weather;
const WEATHER_SHOT_MODIFIERS=CONFIG.WEATHER_SHOT_MODIFIERS;
const BATTLE_SPOTS=[
  {n:"左底角",rack:0,deep:null,super:false,val:3,p:RACKS[0].p},
  {n:"左侧 45°",rack:1,deep:null,super:false,val:3,p:RACKS[1].p},
  {n:"弧顶",rack:2,deep:null,super:false,val:3,p:RACKS[2].p},
  {n:"右侧 45°",rack:3,deep:null,super:false,val:3,p:RACKS[3].p},
  {n:"右底角",rack:4,deep:null,super:false,val:3,p:RACKS[4].p},
  {n:"左彩球点",rack:null,deep:0,super:false,val:5,p:DEEPS[0].p},
  {n:"右彩球点",rack:null,deep:1,super:false,val:5,p:DEEPS[1].p},
  {n:HALFCOURT.n,rack:null,deep:null,super:true,val:HALFCOURT.val,p:HALFCOURT.p}
];

function mulberry32(a){
  return function(){
    a|=0;
    a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
function todaySeed(){
  const d=new Date();
  return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
}
function getSeed(){
  try{
    const u=new URLSearchParams(location.search);
    if(u.has("seed"))return parseInt(u.get("seed"))||todaySeed();
  }catch(e){}
  return todaySeed();
}
const GAME_SEED=getSeed();
let SHARED_RACK_RUSH=null;
try{
  const q=new URLSearchParams(location.search),diff=q.get("diff");
  if(q.get("mode")==="rackrush"&&DIFFS[diff]){
    SHARED_RACK_RUSH={diff,star:q.get("star"),submode:q.get("submode"),opened:false};
  }
}catch(e){}
const seedRng=mulberry32(GAME_SEED);
function seededRandom(){return seedRng();}

const ASSETS=window.AIBA_ASSETS||{coverStars:[],audio:{}};
const COVER_STARS=ASSETS.coverStars||[];
const CLASSIC_LEGENDS=CONFIG.CLASSIC_LEGENDS;
const LEGENDS=[...CLASSIC_LEGENDS,...COVER_STARS];
const DEFAULT_SHOT_PROFILE=CONFIG.DEFAULT_SHOT_PROFILE;
const SHOT_PROFILES=CONFIG.SHOT_PROFILES;
function shotProfileFor(star){
  return CONFIG.shotProfileFor?CONFIG.shotProfileFor(star):(SHOT_PROFILES[star&&(star.id||star.n)]||DEFAULT_SHOT_PROFILE);
}
function playerShotProfile(){return shotProfileFor(G.myStar);}
function playerSweetZone(){
  const base=DIFFS[G.diff].zone*playerShotProfile().window;
  return base*((G.practice||G.tutorial||G.interactiveTutorial)?1.5:1);
}
function playerChargeRate(){return DIFFS[G.diff].fill*playerShotProfile().speed;}
function shotFlightTime(baseTf,star,shot){
  return CONFIG.shotFlightTime?CONFIG.shotFlightTime(baseTf,star,{deep:!!(shot&&(shot.deep!=null||shot.super))}):baseTf;
}
function shotProfileText(star){
  const p=shotProfileFor(star);
  return p.label+" · "+(p.arcLabel||"标准弧线")+" · 甜区 "+Math.round(p.window*100)+"%";
}
const TEAM_COLORS=[
  [0x552583,0xfdb927],[0xce1141,0x111111],[0x007a33,0xffffff],[0x1d428a,0xffc72c],
  [0x98002e,0xf9a01b],[0x006bb6,0xf58426],[0x00471b,0xeee1c6],[0x0e2240,0xfec524],
  [0xe56020,0x1d1160],[0x000000,0xc4ced4],[0x5a2d81,0x63727a],[0x00538c,0x002b5e]
];
const MY_NUMS=[23,24,30,33,3,11,8,0,77,35,13,7];
const EXT_AUDIO=ASSETS.audio||{};
