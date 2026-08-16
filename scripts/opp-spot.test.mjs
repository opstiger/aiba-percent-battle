/* 校验：百分大战里对手必须和玩家站在同一投篮点的左右两侧，到篮筐距离基本一致。
   旧实现的首选槽位是沿背离篮筐方向后撤 0.95m（sqrt(0.95²+0.5²)=1.07 恒 >= 0.9 的
   间距门槛，所以它在每个点位都直接胜出）——对手因此在所有点位都比玩家远约 0.95m。
   跑：node scripts/opp-spot.test.mjs */
import fs from "node:fs";
const read=f=>fs.readFileSync(f,"utf8");
const grab=(src,head)=>{const a=src.indexOf(head);let i=src.indexOf("(",a),p=0;
  for(;i<src.length;i++){if(src[i]==="(")p++;else if(src[i]===")"){p--;if(!p){i++;break;}}}
  i=src.indexOf("{",i);let d=0;
  for(;i<src.length;i++){if(src[i]==="{")d++;else if(src[i]==="}"){d--;if(!d)return src.slice(a,i+1);}}};
const opp=read("src/modes/percent-battle/opponent.js");
const code=opp.slice(opp.indexOf("const OPP_ARC_GAP"),opp.indexOf("function oppSpotQuota"));

const V3=(x,y,z)=>({x,y,z,
  length(){return Math.hypot(this.x,this.z);},
  clone(){return V3(this.x,this.y,this.z);},
  distanceTo(o){return Math.hypot(this.x-o.x,this.z-o.z);}});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HOOP={x:0,z:-8};
const COURT={halfWidth:7.62,nearBaseline:-9.58,playMaxZ:4.245};
/* 直接从 game-config.js 里跑出真实的 RACKS / DEEPS / HALFCOURT / BATTLE_SPOTS */
const cfg=read("src/data/game-config.js");
/* 点位坐标抄自 src/data/game-config.js（整段 eval 会连带拉起 CONFIG/SCENE_PRESETS，
   对这个校验没必要）。改了那边记得同步这里。 */
const BATTLE_SPOTS=[
  {n:"左底角",   p:V3(-7.2,0,-6.15)},
  {n:"左侧 45°", p:V3(-5.62,0,-2.38)},
  {n:"弧顶",     p:V3(0,0,-0.05)},
  {n:"右侧 45°", p:V3(5.62,0,-2.38)},
  {n:"右底角",   p:V3(7.2,0,-6.15)},
  {n:"左彩球点", p:V3(-3.7,0,0.95)},
  {n:"右彩球点", p:V3(3.7,0,0.95)},
  {n:"中场超远", p:V3(0,0,4.245)},
];

const fn=new Function("V3","clamp","HOOP","COURT","BATTLE_SPOTS",code+"\nreturn oppSpotPos;")
  (V3,clamp,HOOP,COURT,BATTLE_SPOTS);

let bad=0,maxDelta=0,minSep=99;
console.log("点位          玩家距筐  对手距筐   差值    间距");
BATTLE_SPOTS.forEach((sp,i)=>{
  const o=fn(i);
  const dP=Math.hypot(sp.p.x-HOOP.x,sp.p.z-HOOP.z);
  const dO=Math.hypot(o.x-HOOP.x,o.z-HOOP.z);
  const delta=Math.abs(dO-dP), sep=Math.hypot(o.x-sp.p.x,o.z-sp.p.z);
  maxDelta=Math.max(maxDelta,delta); minSep=Math.min(minSep,sep);
  const flag=delta>0.35?" ❌":(sep<0.85?" ⚠间距":"");
  if(delta>0.35||sep<0.85)bad++;
  console.log(` ${sp.n.padEnd(12)} ${dP.toFixed(2)}m    ${dO.toFixed(2)}m   ${delta.toFixed(2)}m  ${sep.toFixed(2)}m${flag}`);
});
console.log(`\n最大距筐差 ${maxDelta.toFixed(3)}m，最小间距 ${minSep.toFixed(2)}m`);
console.log(bad?`${bad} 个点位不合格`:"全部点位：对手与玩家距筐基本一致且不重叠");
process.exit(bad?1:0);
