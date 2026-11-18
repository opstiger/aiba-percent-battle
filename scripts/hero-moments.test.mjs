import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=name=>fs.readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

const hero={on:false},starts=[];
const G={mode:"rackrush",state:"rackrush",running:true,practice:false,rush:{total:96,level:0}};
const window={};
vm.runInNewContext(source("hero-moments.js"),{
  window,G,hero,startHero:ball=>starts.push(ball),
  isRackRushSpeed:()=>true,RACK_RUSH_SPEED_TARGET:100
});
for(const [score,val,expected] of [[95,4,false],[96,3,false],[96,4,true],[97,3,true],[99,3,true],[100,4,false]]){
  G.rush.total=score;
  const count=starts.length;
  window.AIBAHeroMoments.onRackRushBallSpawn({val});
  assert.equal(starts.length-count,Number(expected),`${score}+${val}`);
}
G.rush.total=98;
const before=starts.length;
window.AIBAHeroMoments.onRackRushBallSpawn(null);
assert.equal(starts.length,before,"a missing spawned ball cannot trigger the shot camera");
G.state="rushend";
window.AIBAHeroMoments.onRackRushBallSpawn({val:4});
assert.equal(starts.length,before,"a round that has ended cannot trigger the shot camera");

const calls=[],battle={OPP:{}};
const match={state:"battle",score:96,battleOppScore:96,battleOver:false};
const legacy={G:match,BATTLE_TARGET:100,getWinCine:()=>({on:false}),startWinCine:win=>calls.push(win)};
const matchWindow={AIBA:{runtime:{service:()=>legacy}},AIBABattle:battle};
vm.runInNewContext(source("modes/percent-battle/results.js"),{window:matchWindow});
battle.finishBattle(true,{val:3});
battle.finishBattle(false,{val:3});
assert.deepEqual(calls,[],"neither side has reached the score target");
match.battleOppScore=101;
battle.finishBattle(false,{val:5});
match.score=100;
battle.finishBattle(true,{val:3});
assert.deepEqual(calls,[false,true],"only the side that reached 100 may trigger its result replay");

console.log("Hero moment is gated by actual shot value in Speed 100 and by awarded score in Percent Battle.");
