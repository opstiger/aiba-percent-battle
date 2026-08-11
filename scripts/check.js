#!/usr/bin/env node
"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const childProcess=require("child_process");

const root=path.resolve(__dirname,"..");
const entry="index.html";
const legacyEntry="legacy.html";
const snapshot="block-3pt-kingv2.18-modular.html";
const requiredFiles=[
  entry,
  legacyEntry,
  snapshot,
  "styles.css",
  "src/assets-manifest.js",
  "src/config.js",
  "src/player-select.js",
  "src/player-locker-preview.js",
  "src/avatar-customizer.js",
  "src/player-id.js",
  "src/leaderboard-api.js",
  "src/leaderboard-ui.js",
  "src/share.js",
  "src/recorder.js",
  "src/shot-physics.js",
  "src/shot-motion.js",
  "src/roster-style.js",
  "src/rendering/character-visuals.js",
  "src/rendering/equipment-visuals.js",
  "src/hero-moments.js",
  "src/hot-hand.js",
  "src/result-stats.js",
  "src/gear.js",
  "src/perf.js",
  "src/perf-settings.js",
  "src/i18n.js",
  "src/game-flow.js",
  "src/navigation.js",
  "src/scene-lifecycle.js",
  "src/visual-director.js",
  "src/face-overlays.js",
  "src/haptics.js",
  "src/audio.js",
  "src/vision.js",
  "src/core/runtime.js",
  "src/core/error-boundary.js",
  "src/core/foundation.js",
  "src/core/state.js",
  "src/core/player-id-sandbox.js",
  "src/core/leaderboard-sandbox.js",
  "src/core/legacy-adapter.js",
  "src/core/bootstrap-next.js",
  "src/data/game-config.js",
  "src/data/dialogue.js",
  "src/services/audio-cues.js",
  "src/rendering/core.js",
  "src/modes/rack-rush.js",
  "src/modes/contest.js",
  "src/modes/practice.js",
  "src/modes/percent-battle/state.js",
  "src/modes/percent-battle/spots.js",
  "src/modes/percent-battle/opponent.js",
  "src/modes/percent-battle/results.js",
  "src/modes/percent-battle/index.js",
  "src/ui/panels.js",
  "src/ui/loading.js",
  "src/ui/menu.js",
  "src/ui/setup.js",
  "src/ui/pregame.js",
  "src/ui/pause.js",
  "src/ui/icons.js",
  "src/ui/result-copy.js",
  "assets/aiba-brand/aiba-percent-battle-logo-v3.png",
  "assets/aiba-brand/aiba-percent-battle-logo-v3.webp",
  "docs/ARCHITECTURE.md",
  "docs/MODULAR_REFACTOR_PLAN.md",
  "assets/aiba-faces/curry-smile-pixel-128.png",
  "vendor/three.min.r128.js",
  "assets/aiba-vision/pose_landmarker_lite.task"
];

function read(rel){return fs.readFileSync(path.join(root,rel),"utf8");}
function exists(rel){return fs.existsSync(path.join(root,rel));}
function fail(msg){console.error("check failed:",msg);process.exit(1);}

for(const file of requiredFiles){
  if(!exists(file))fail("missing required file "+file);
}

const entryHtml=read(entry);
const legacyHtml=read(legacyEntry);
const snapshotHtml=read(snapshot);
if(entryHtml!==snapshotHtml)fail(entry+" and "+snapshot+" differ");
if(entryHtml.includes('<base href='))fail("entry must not use base href");
if(entryHtml.includes("__AIBA_NEXT__")||entryHtml.includes("__AIBA_DISABLE_PRODUCTION_WRITES__"))fail("entry must not carry experimental flags");
if(!entryHtml.includes('location.replace("legacy.html"'))fail("entry legacy escape (?engine=legacy) missing");
if(!entryHtml.includes('<meta name="aiba-entry" content="main">'))fail("entry marker meta missing");
if(!legacyHtml.includes("v1.96-full-en"))fail("legacy entry version token missing");
if(legacyHtml.includes('location.replace("legacy.html"'))fail("legacy entry must not self-redirect");
if(!entryHtml.includes("data-aiba-early-errors"))fail("next early error diagnostics missing");
if(!entryHtml.includes('<script src="src/i18n.js?v=2.14-locker-orbit"></script>'))fail("i18n cache version missing");
if(!entryHtml.includes('<script src="src/core/runtime.js?v=refactor7"></script>'))fail("next runtime bridge missing");
if(entryHtml.includes("player-id-sandbox")||entryHtml.includes("leaderboard-sandbox"))fail("entry must not load sandbox identity/leaderboard");
if(!entryHtml.includes('<script src="src/recorder.js?v=refactor10"></script>'))fail("next recorder cache version missing");
if(!entryHtml.includes('<script src="src/vision.js?v=2.13"></script>'))fail("next vision cache version missing");
if(!entryHtml.includes('<script src="src/rendering/core.js?v=2.12"></script>'))fail("next rendering core missing");
for(const file of ["core/error-boundary","core/foundation","data/dialogue","core/state","services/audio-cues","ui/result-copy"]){
  if(!entryHtml.includes(`<script src="src/${file}.js?v=refactor39"></script>`))fail(`next shell module missing ${file}`);
}
if(!entryHtml.includes('<script src="src/data/game-config.js?v=2.16.2-human-proportion"></script>'))fail("next game config cache version missing");

if(entryHtml.indexOf('src/core/runtime.js')>entryHtml.indexOf('src/config.js'))fail("next runtime must load before config");
if(entryHtml.indexOf('<script src="src/rendering/core.js?v=2.12"></script>')>entryHtml.indexOf('<script src="src/core/scene-init.js?v=refactor38"></script>'))fail("rendering core must load before scene construction");
if(!entryHtml.includes('<script src="src/core/legacy-adapter.js?v=2.15.5-hand-follow"></script>'))fail("next legacy adapter missing");
if(!entryHtml.includes('<script src="src/modes/rack-rush.js?v=refactor5b"></script>'))fail("next Rack Rush module missing");
if(!entryHtml.includes('<script src="src/modes/contest.js?v=refactor5c"></script>'))fail("next contest module missing");
if(!entryHtml.includes('<script src="src/modes/practice.js?v=refactor5a"></script>'))fail("next practice module missing");
if(!entryHtml.includes('<script src="src/ui/panels.js?v=refactor7"></script>'))fail("next panels module missing");
if(!entryHtml.includes('<script src="src/ui/loading.js?v=2.13"></script>'))fail("next loading module missing");
if(!entryHtml.includes('<script src="src/ui/menu.js?v=cutover7"></script>'))fail("next menu module missing");
if(!entryHtml.includes('<script src="src/ui/setup.js?v=refactor13"></script>'))fail("next setup module missing");
if(!entryHtml.includes('<script src="src/ui/pregame.js?v=refactor15c"></script>'))fail("next pregame module missing");
if(!entryHtml.includes('<script src="src/ui/pause.js?v=1.98"></script>'))fail("next pause module missing");
if(!entryHtml.includes('<script src="src/core/bootstrap-next.js?v=cutover1"></script>'))fail("next bootstrap module missing");
if(!entryHtml.includes('<script src="src/modes/percent-battle/state.js?v=refactor4c"></script>'))fail("next Percent Battle state module missing");
if(!entryHtml.includes('<script src="src/modes/percent-battle/spots.js?v=refactor4b"></script>'))fail("next Percent Battle spots module missing");
const percentBattleVersions={opponent:"2.15.5-hand-follow",results:"refactor4a",index:"refactor4a"};
for(const [file,version] of Object.entries(percentBattleVersions)){
  if(!entryHtml.includes(`<script src="src/modes/percent-battle/${file}.js?v=${version}"></script>`))fail(`next Percent Battle ${file} module missing`);
}
if(entryHtml.includes("function startRackRush("))fail("next entry still contains inline Rack Rush implementation");
if(entryHtml.includes("function beginStage(")||entryHtml.includes("function champion("))fail("next entry still contains inline contest implementation");
if(entryHtml.includes("function startPractice(")||entryHtml.includes("function endPractice("))fail("next entry still contains inline practice implementation");
if(entryHtml.includes("function bootGame(")||entryHtml.includes("function showPanel(")||entryHtml.includes("function toast("))fail("next entry still contains inline panels/loading implementation");
if(entryHtml.includes("function pauseableState(")||entryHtml.includes("function restartPausedMode("))fail("next entry still contains inline pause implementation");
if(entryHtml.includes("function showMenu(")||entryHtml.includes("function showModeInfo("))fail("next entry still contains inline home menu implementation");
if(entryHtml.includes("function sceneSelectMarkup(")||entryHtml.includes("function showScenePicker(")||entryHtml.includes("function goDiff("))fail("next entry still contains inline difficulty setup implementation");
if(entryHtml.includes("function pickDiff(")||entryHtml.includes("function showBattleIntro("))fail("next entry still contains inline pregame implementation");
if(entryHtml.includes("const renderer=new THREE.WebGLRenderer")||entryHtml.includes("function updateRenderQuality(")||entryHtml.includes("const ambient=new THREE.AmbientLight"))fail("next entry still contains inline rendering core implementation");
if(entryHtml.includes("bootGame();\nanimate();"))fail("next entry still starts boot and loop inline");
if(entryHtml.includes("function startBattle(")||entryHtml.includes("function battleRefreshSpot(")||entryHtml.includes("function startOppShooter(")||entryHtml.includes("function finishBattle("))fail("next entry still contains inline Percent Battle implementation");
for(const token of ["const GAME_VERSION=","const G={","function triggerMakeRunVoice(","const COVER_QUOTES="]){
  if(entryHtml.includes(token))fail("next entry still contains inline shell ownership "+token);
}
if(entryHtml.includes("/* Renderer, camera, adaptive quality and base lights are owned"))fail("next entry still contains generated ownership placeholders");
if(entryHtml.indexOf('src/core/foundation.js?v=refactor39')>entryHtml.indexOf('src/data/game-config.js?v=2.16.2-human-proportion'))fail("foundation must load before game config");
if(entryHtml.indexOf('src/data/game-config.js?v=2.16.2-human-proportion')>entryHtml.indexOf('src/core/state.js?v=refactor39'))fail("game config must load before runtime state");
if(entryHtml.indexOf('src/core/state.js?v=refactor39')>entryHtml.indexOf('src/services/audio-cues.js?v=refactor39'))fail("runtime state must load before audio cues");
if(entryHtml.indexOf('src/services/audio-cues.js?v=refactor39')>entryHtml.indexOf('src/audio.js?v=2.19'))fail("audio cues must load before audio engine");
if(entryHtml.indexOf('<script src="src/core/legacy-adapter.js?v=2.15.5-hand-follow"></script>')>entryHtml.indexOf('<script src="src/modes/rack-rush.js?v=refactor5b"></script>'))fail("legacy adapter must load before Rack Rush module");
if(entryHtml.indexOf('<script src="src/modes/rack-rush.js?v=refactor5b"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("Rack Rush module must load before late hooks");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("contest module must load before late hooks");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/modes/practice.js?v=refactor5a"></script>'))fail("contest module must load before practice module");
if(entryHtml.indexOf('<script src="src/ui/panels.js?v=refactor7"></script>')>entryHtml.indexOf('<script src="src/ui/loading.js?v=2.13"></script>'))fail("panels must load before loading module");
if(entryHtml.indexOf('<script src="src/ui/loading.js?v=2.13"></script>')>entryHtml.indexOf('<script src="src/ui/menu.js?v=cutover7"></script>'))fail("loading must load before menu module");
if(entryHtml.indexOf('<script src="src/ui/menu.js?v=cutover7"></script>')>entryHtml.indexOf('<script src="src/ui/setup.js?v=refactor13"></script>'))fail("menu must load before setup module");
if(entryHtml.indexOf('<script src="src/ui/setup.js?v=refactor13"></script>')>entryHtml.indexOf('<script src="src/ui/pregame.js?v=refactor15c"></script>'))fail("setup must load before pregame module");
if(entryHtml.indexOf('<script src="src/ui/pregame.js?v=refactor15c"></script>')>entryHtml.indexOf('<script src="src/ui/pause.js?v=1.98"></script>'))fail("pregame must load before pause module");
if(entryHtml.indexOf('<script src="src/ui/pause.js?v=1.98"></script>')>entryHtml.indexOf('<script src="src/core/bootstrap-next.js?v=cutover1"></script>'))fail("pause module must load before bootstrap");
if(!entryHtml.includes('<script src="src/navigation.js?v=1.98a"></script>'))fail("next navigation cache version missing");
if(entryHtml.indexOf('<script src="src/core/bootstrap-next.js?v=refactor12"></script>')>entryHtml.indexOf('<script src="src/navigation.js?v=1.98a"></script>'))fail("boot must begin before navigation rewires the loading gate");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/modes/percent-battle/state.js?v=refactor4c"></script>'))fail("contest module must load before Percent Battle modules");
for(const pair of [["state","spots"],["spots","opponent"],["opponent","results"],["results","index"]]){
  if(entryHtml.indexOf(`src/modes/percent-battle/${pair[0]}.js`)>entryHtml.indexOf(`src/modes/percent-battle/${pair[1]}.js`))fail(`Percent Battle ${pair[0]} must load before ${pair[1]}`);
}
if(!entryHtml.includes('<script src="src/modes/percent-battle/opponent.js?v=2.15.5-hand-follow"></script>'))fail("Percent Battle opponent cache version missing");
if(entryHtml.indexOf('<script src="src/modes/percent-battle/index.js?v=refactor4a"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("Percent Battle module must load before late hooks");
if(/^(<<<<<<<|=======|>>>>>>>)$/m.test(entryHtml))fail("conflict marker in html");
for(const token of ["v2.18 MODULAR","MODULAR / v2.18"])
  if(!entryHtml.includes(token))fail("visible version token missing "+token);
if(!read("src/data/game-config.js").includes('const GAME_VERSION="v2.18";'))fail("GAME_VERSION must be v2.18");
if(!entryHtml.includes('<link rel="stylesheet" href="styles.css?v=2.15.5-hand-follow">'))fail("stylesheet link missing");
const menuScript=read("src/ui/menu.js");
const nbaDnaScript=read("src/nba-dna/NBADNA.js");
const homeMenuSource=menuScript.slice(menuScript.indexOf("function showMenu"),menuScript.indexOf("function showModeInfo"));
if(homeMenuSource.includes("CYBER COURT")||read("styles.css").includes(".coverKicker"))fail("legacy CYBER COURT kicker must stay removed");
if(!homeMenuSource.includes("对着空气时出手，对着篮筐时杀手"))fail("new home slogan missing");
if(!read("src/i18n.js").includes('"对着空气时出手,对着篮筐时杀手":"Shoot at the air. Kill at the rim."'))fail("new home slogan translation missing");
if(!homeMenuSource.includes('<source srcset="assets/aiba-brand/aiba-percent-battle-logo-v3.webp" type="image/webp">'))fail("compressed WebP home title source missing");
if(!homeMenuSource.includes('<img class="coverTitleLogo" src="assets/aiba-brand/aiba-percent-battle-logo-v3.png"'))fail("PNG home title fallback missing");
if(homeMenuSource.includes("global.coverQuote()")||homeMenuSource.includes('class="coverQuote"'))fail("home quote must stay removed");
if(homeMenuSource.includes('class="coverTitle"'))fail("legacy text home title must stay removed");
const homeStyles=read("styles.css");
if(!homeStyles.includes(".coverTitleMark{")||!homeStyles.includes(".coverTitleLogo{"))fail("home title logo styles missing");
if(!homeStyles.includes(".coverHero.video-active .coverTitleLogo{opacity:.58"))fail("video-active title de-emphasis missing");
if(homeStyles.includes(".coverTitle{")||homeStyles.includes(".coverQuote{"))fail("legacy home title or quote styles must stay removed");
if(!read("src/ui/result-copy.js").includes('class="scoreQuote"')||!homeStyles.includes(".scoreQuote{"))fail("result-page quote module must stay available");
const titleLogoPng=fs.readFileSync(path.join(root,"assets/aiba-brand/aiba-percent-battle-logo-v3.png"));
const titleLogoWebp=fs.readFileSync(path.join(root,"assets/aiba-brand/aiba-percent-battle-logo-v3.webp"));
if(titleLogoPng.length<10000||titleLogoPng.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")fail("home title fallback must be a valid PNG asset");
if(titleLogoWebp.length>100000||titleLogoWebp.subarray(0,4).toString("ascii")!=="RIFF"||titleLogoWebp.subarray(8,12).toString("ascii")!=="WEBP")fail("home title WebP must stay valid and under 100 KB");
const loadingScript=read("src/ui/loading.js");
if(!loadingScript.includes('classList.add("video-active")')||!loadingScript.includes('classList.remove("video-active")'))fail("cover video must toggle title de-emphasis state");
if(/quickMode dna|NBA DNA|showModeInfo\('nbadna'\)/.test(homeMenuSource))fail("NBA DNA entry must stay hidden from home");
if(!homeMenuSource.includes("grid")&&!read("styles.css").includes(".quickModes{display:grid;grid-template-columns:repeat(2"))fail("home quick modes should use two columns");
for(const token of ["const NBA_DNA_ENABLED=false","if(!NBA_DNA_ENABLED)","return false"])
  if(!nbaDnaScript.includes(token))fail("NBA DNA runtime gate missing "+token);
if(!entryHtml.includes('<script src="src/nba-dna/NBADNA.js?v=20260718-coming-soon"></script>'))fail("next NBA DNA gate cache version missing");
if(!entryHtml.includes('<script src="src/assets-manifest.js?v=20260726-bkyx1"></script>'))fail("assets manifest script missing");
if(!entryHtml.includes('<script src="src/config.js?v=2.15.5-hand-follow"></script>'))fail("config script missing");
if(!entryHtml.includes('<script src="src/player-select.js?v=2.15.5-hand-follow"></script>'))fail("player select script missing");
if(!entryHtml.includes('<script src="src/player-locker-preview.js?v=2.17-locker-idles"></script>'))fail("player locker preview script missing");
if(!entryHtml.includes('<script src="src/player-id.js"></script>'))fail("player id script missing");
if(!entryHtml.includes('<script src="src/leaderboard-api.js"></script>'))fail("leaderboard api script missing");
if(!entryHtml.includes('<script src="src/leaderboard-ui.js?v=1.94"></script>'))fail("leaderboard ui script missing");
if(!entryHtml.includes('<script src="src/share.js?v=2.01"></script>'))fail("share script missing");
if(!entryHtml.includes('<script src="src/shot-physics.js?v=2.06"></script>'))fail("shot physics script missing");
if(!entryHtml.includes('<script src="src/result-stats.js?v=1.78"></script>'))fail("result stats script missing");
if(!entryHtml.includes('<script src="src/rendering/equipment-visuals.js?v=2.16-soft-voxel"></script>'))fail("equipment visual script missing");
if(!entryHtml.includes('<script src="src/gear.js?v=2.15.5-hand-follow"></script>'))fail("gear script missing");
if(!entryHtml.includes('<script src="src/avatar-customizer.js?v=2.15.5-hand-follow"></script>'))fail("avatar customizer script missing");
if(!entryHtml.includes('<script src="src/shot-motion.js?v=2.18-shared-fp-pose"></script>'))fail("shot motion script missing");
if(!entryHtml.includes('<script src="src/roster-style.js?v=2.15.5-hand-follow"></script>'))fail("roster style script missing");
if(!entryHtml.includes('<script src="src/rendering/character-visuals.js?v=2.16.2-human-proportion"></script>'))fail("voxel pro character visuals missing");
if(entryHtml.indexOf('src/roster-style.js?v=2.15.5-hand-follow')>entryHtml.indexOf('src/rendering/character-visuals.js?v=2.16.2-human-proportion'))fail("voxel pro visuals must wrap roster styling");
if(!entryHtml.includes('<script src="src/hero-moments.js?v=1.80"></script>'))fail("hero moments script missing");
if(!entryHtml.includes('<script src="src/hot-hand.js?v=1.81"></script>'))fail("hot hand script missing");
if(!entryHtml.includes('<script src="src/perf.js?v=1.72"></script>'))fail("perf script missing");
if(!entryHtml.includes('<script src="src/perf-settings.js?v=1.93b"></script>'))fail("perf settings script missing");
if(!entryHtml.includes('<script src="src/face-overlays.js?v=1.1-realnames"></script>'))fail("face overlays script missing");
if(!entryHtml.includes('<script src="src/haptics.js?v=1.80"></script>'))fail("haptics script missing");
if(!entryHtml.includes('<script src="src/visual-director.js?v=1.85"></script>'))fail("visual director script missing");
if(!entryHtml.includes('<script src="src/audio.js?v=2.19"></script>'))fail("audio script missing");
if(!entryHtml.includes('<script src="src/vision.js?v=2.13"></script>'))fail("vision script missing");
if(!entryHtml.includes('<script src="src/ui/icons.js?v=1"></script>'))fail("local SVG icon script missing");
if(!entryHtml.includes('<script src="src/ui/interactive-tutorial.js?v=2.05"></script>'))fail("interactive tutorial script missing");
if(!entryHtml.includes('<script src="src/navigation.js?v=1.98a"></script>'))fail("navigation script missing");
if(!entryHtml.includes('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("game flow script missing");
if(/<style>[\s\S]*?<\/style>/.test(entryHtml))fail("inline style block should stay split out");
if(/const COVER_STARS=\[/.test(entryHtml)||/const EXT_AUDIO=\{/.test(entryHtml))fail("asset manifest data leaked back into html");
if(/assets\/aiba-covers\/[^"')]+\.png/.test(entryHtml))fail("runtime should not reference png cover assets");

if(!entryHtml.includes('<script src="src/scene-lifecycle.js?v=1.88"></script>'))fail("scene lifecycle script missing");
for(const rel of ["src/modes/practice.js","src/modes/rack-rush.js","src/modes/percent-battle/state.js","src/modes/contest.js"]){
  if(!read(rel).includes("resetProgressiveSceneForRun()"))fail(rel+" must reset progressive scene before a new run");
}
for(const token of ['dataset.flowerCount="0"','dataset.environmentPhase=progress<.25?"golden"'])
  if(!read("src/rendering/environments.js").includes(token))fail("progressive scene initialization missing "+token);
if(!read("src/modes/rack-rush.js").includes("rush.total>=88"))fail("rack rush recorder arming missing");
if(!read("src/modes/rack-rush.js").includes("AIBARecorder.discard()"))fail("rack rush cleared rounds must discard their recording");
if(!read("src/core/game-loop.js").includes("G.timer<=12&&window.AIBARecorder"))fail("timer recorder arming missing");
if(!read("src/modes/percent-battle/opponent.js").includes(">=85&&global.AIBARecorder"))fail("battle recorder arming missing");

function inlineScriptLineCount(html){
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m=>m[1]).filter(s=>s.trim()).reduce((n,s)=>n+s.replace(/\s+$/,"").split(/\r?\n/).length,0);
}
const inlineLines=inlineScriptLineCount(entryHtml);
try{
  const baseHtml=childProcess.execFileSync("git",["show","HEAD:index.html"],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","ignore"]});
  const baseLines=inlineScriptLineCount(baseHtml);
  if(inlineLines>baseLines)fail("inline script line count grew "+inlineLines+" > "+baseLines);
}catch(e){}

const inlineScriptCounts={};
for(const [label,html] of [["main",entryHtml],["legacy",legacyHtml]]){
  const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m=>m[1]).filter(s=>s.trim());
  inlineScriptCounts[label]=inlineScripts.length;
  for(const [i,script] of inlineScripts.entries()){
    try{new vm.Script(script,{filename:`${label}-inline-${i}.js`});}
    catch(e){fail(`${label} inline script ${i} syntax error: ${e.message}`);}
  }
}

const manifest=read("src/assets-manifest.js");
const configScript=read("src/config.js");
const gameConfigScript=read("src/data/game-config.js");
const playerSelectScript=read("src/player-select.js");
const playerLockerPreviewScript=read("src/player-locker-preview.js");
const avatarCustomizerScript=read("src/avatar-customizer.js");
const playerIdScript=read("src/player-id.js");
const leaderboardApiScript=read("src/leaderboard-api.js");
const leaderboardUiScript=read("src/leaderboard-ui.js");
const shareScript=read("src/share.js");
const recorderScript=read("src/recorder.js");
const shotPhysicsScript=read("src/shot-physics.js");
const shotMotionScript=read("src/shot-motion.js");
const resultStatsScript=read("src/result-stats.js");
const gearScript=read("src/gear.js");
const characterVisualsScript=read("src/rendering/character-visuals.js");
const equipmentVisualsScript=read("src/rendering/equipment-visuals.js");
const hotHandScript=read("src/hot-hand.js");
const faceOverlaysScript=read("src/face-overlays.js");
const hapticsScript=read("src/haptics.js");
const audioScript=read("src/audio.js");
const visualDirectorScript=read("src/visual-director.js");
const sceneLifecycleScript=read("src/scene-lifecycle.js");
const styles=read("styles.css");
for(const token of ["同题挑战","好友挑战","复制挑战链接","排行与挑战","copyAIBAChallenge","challengeUrlFor","GLOBAL CHALLENGE LINK READY"]){
  if((leaderboardUiScript+shareScript+read("src/i18n.js")).includes(token))fail("retired same-seed challenge UI remains: "+token);
}
if(!styles.includes('#tiltWrap{bottom:max(160px,calc(env(safe-area-inset-bottom) + 150px))}'))fail("mobile balance meter separation missing");
try{new Function(configScript);}
catch(e){fail("config script syntax error: "+e.message);}
for(const token of ['id:"nova24"','visualProfile:"voxel-pro-01"','nova24:{speed:','nova24:{h:'])
  if(!configScript.includes(token))fail("N-24 character config missing "+token);
try{new Function(characterVisualsScript);}
catch(e){fail("character visuals script syntax error: "+e.message);}
for(const token of ["voxel-pro-01","function proFaceTex","function proJerseyTex","function applyProfile","guy.headRoot","guy.baseShoulderX||.285","guy.baseHipX||.125","arm.children[0].material=guy.mS","deeply overlapped shoulder-to-arm blend","Narrow front/back straps","guy.ankles.forEach"])
  if(!characterVisualsScript.includes(token))fail("voxel pro visual token missing "+token);
try{new Function(gameConfigScript);}
catch(e){fail("game config script syntax error: "+e.message);}
for(const source of [gameConfigScript]){
  if(!source.includes("G.practice||G.tutorial||G.interactiveTutorial")||!source.includes("?1.5:1"))fail("training sweet zone multiplier missing");
}
try{new Function(playerSelectScript);}
catch(e){fail("player select script syntax error: "+e.message);}
if(playerSelectScript.includes("scrollIntoView"))fail("player selection must not vertically scroll the locker");
for(const token of ['closest(".lockerDeck")',"workbench.scrollTop=scrollTop"])
  if(!playerSelectScript.includes(token))fail("player locker scroll preservation missing "+token);
try{new Function(playerLockerPreviewScript);}
catch(e){fail("player locker preview script syntax error: "+e.message);}
for(const token of ["lockerStage","lockerWorkbench"])
  if(!(playerLockerPreviewScript+playerSelectScript+styles).includes(token))fail("fixed gear preview token missing "+token);
for(const token of ["function mountLive","function refreshLive","function focusLive","mousedown","mousemove","touchstart","touchmove","wheel","ResizeObserver","clampZoom","clampPitch","baseAzimuth","baseElevation","Math.sin(azimuth)","Math.sin(elevation)","dataset.orbitYaw","dataset.orbitPitch","dataset.orbitZoom","AIBALockerPreview={render,refreshLive,reset:resetLive,focus:focusLive,destroy:destroyLive}"])
  if(!playerLockerPreviewScript.includes(token))fail("interactive locker orbit missing "+token);
for(const token of ["LOCKER_ACTIONS","function idlePose","function wavePose","function shadowShotPose","function jerseyPose","function headbandPose","function startLiveMotion","lastMotionFrame<33","prefers-reduced-motion: reduce","cancelAnimationFrame(liveView.motionRaf)","dataset.lockerAction"])
  if(!playerLockerPreviewScript.includes(token))fail("locker idle animation missing "+token);
for(const token of ["lockerViewReset","rotate-ccw","AIBALockerPreview.reset()"])
  if(!playerSelectScript.includes(token))fail("locker orbit controls missing "+token);
for(const token of [".lockerOrbitCanvas","touch-action:none",".lockerViewReset"])
  if(!styles.includes(token))fail("locker orbit styles missing "+token);
try{new Function(avatarCustomizerScript);}
catch(e){fail("avatar customizer script syntax error: "+e.message);}
for(const token of ["Number.isFinite(opts.scrollTop)","open(null,{scrollTop,quiet:true})"])
  if(!avatarCustomizerScript.includes(token))fail("customizer scroll preservation missing "+token);
for(const key of ["AIBACustomizer","customStar","saveUse","applyCustomHead","customHead"])
  if(!avatarCustomizerScript.includes(key))fail("avatar customizer script missing "+key);
for(const token of ["(guy.headRoot||guy.g).add(group)","customTopHeadGroup"])
  if(!avatarCustomizerScript.includes(token))fail("custom head mount token missing "+token);
for(const token of ["function applyVisual","function applyGearHead","appearanceKey","refreshGearPreview"])
  if(!gearScript.includes(token))fail("gear visual preview token missing "+token);
try{new Function(equipmentVisualsScript);}
catch(e){fail("equipment visuals script syntax error: "+e.message);}
for(const token of ["function buildMask","function buildCap","function buildShades","function buildHood","function buildMascot","function buildHoodieWear","function roundedBoxGeometry","roundedBox(torso,.535,.61,.295,.05","roundedBox(sleeve,.166,.18,.186,.06","roundedBox(sleeve,.154,.285,.174,.022","roundedBox(sleeve,.148,.245,.166,.025","function applyShoes","function applySleeve","disposeUnusedMaterials",'get("gear")==="classic"'])
  if(!equipmentVisualsScript.includes(token))fail("equipment visual token missing "+token);
if(!gearScript.includes("(guy.headRoot||guy.g).add(group)"))fail("gear head mount missing");
for(const token of ['closest(".lockerWorkbench")',"workbench.scrollTop=scrollTop"])
  if(!gearScript.includes(token))fail("gear scroll preservation missing "+token);
try{new Function(playerIdScript);}
catch(e){fail("player id script syntax error: "+e.message);}
try{new Function(leaderboardApiScript);}
catch(e){fail("leaderboard api script syntax error: "+e.message);}
try{new Function(leaderboardUiScript);}
catch(e){fail("leaderboard ui script syntax error: "+e.message);}
if(!leaderboardUiScript.includes("AIBARecorder.rankUpdated"))fail("leaderboard result should notify recorder when global rank arrives");
for(const token of ["showLeaderboardHub('all')","<b>全球排行榜</b>","全球总榜</button><button class=\"${period===\"today\"?"])
  if(!leaderboardUiScript.includes(token))fail("global-first leaderboard entry missing "+token);
if(/showLeaderboardHub\('today'\)[^]*showLeaderboardHub\('all'\)/.test(leaderboardUiScript.slice(leaderboardUiScript.indexOf("function homeMarkup"),leaderboardUiScript.indexOf("function modeMarkup"))))fail("home still prioritizes daily leaderboard");
try{new Function(shareScript);}
catch(e){fail("share script syntax error: "+e.message);}
try{new Function(recorderScript);}
catch(e){fail("recorder script syntax error: "+e.message);}
if(!recorderScript.includes("AIBAAudioCaptureStream"))fail("recorder should attach audio capture stream");
if(!/function tick\(ctxObj\)\{\s*if\(!supported\(\)\|\|!state\.capturing\)return;/.test(recorderScript))fail("recorder tick must stay idle until capture starts");
for(const token of ["MOBILE?540:720","MOBILE?15:24","MOBILE?1800000:3600000"])
  if(!recorderScript.includes(token))fail("recorder mobile profile missing "+token);
for(const token of ["MAX_CLIP_MS=18000","MIN_RESULT_MS=4800","rankUpdated","最后三球已捕捉"])
  if(!recorderScript.includes(token))fail("recorder highlight window missing "+token);
for(const token of ["function discard()","URL.revokeObjectURL(state.lastUrl)","hasClip:!!state.lastBlob","discard,resultMarkup"])
  if(!recorderScript.includes(token))fail("recorder round discard missing "+token);
for(const token of ["function drawContain","AIBAVisionFrame","portrait?(MOBILE?142:170)"])
  if(!recorderScript.includes(token))fail("portrait recorder pip missing "+token);
const firstMp4=recorderScript.indexOf("video/mp4"),firstWebm=recorderScript.indexOf("video/webm");
if(firstMp4<0||firstWebm<0||firstMp4>firstWebm)fail("recorder should prefer mp4 before webm");
try{new Function(shotPhysicsScript);}
catch(e){fail("shot physics script syntax error: "+e.message);}
try{
  const sandbox={};new Function("window",shotPhysicsScript)(sandbox);
  const physics=sandbox.AIBAShotPhysics;physics.reset();
  let held=physics.update({charging:true,dt:.4,ideal:74,rate:95,curve:{jmp:1}});
  const heldAt=held.t;
  for(let i=0;i<20;i++)held=physics.update({charging:true,paused:true,dt:.08,ideal:74,rate:95,curve:{jmp:1}});
  if(held.t!==heldAt||held.autoRelease)fail("shot physics tutorial pause must freeze time and auto release");
  physics.reset();
  let charged;
  for(let i=0;i<12;i++)charged=physics.update({charging:true,dt:.08,ideal:74,rate:95,curve:{jmp:1}});
  const released=physics.update({charging:false,dt:.016,ideal:74,rate:95,curve:{jmp:0}});
  if(!released.airborne||released.jump<.35||!physics.isAirborne())fail("shot release must preserve airborne height");
  const releaseOver=released.curve.over;
  let landed=false;
  for(let i=0;i<50;i++){
    const frame=physics.update({charging:false,dt:.016,ideal:74,rate:95,curve:{jmp:0}});
    if(frame.curve.over>releaseOver+.001)fail("late-release penalty must freeze after the ball leaves the hand");
    if(frame.justLanded){landed=true;break;}
  }
  if(!landed||physics.isAirborne())fail("shot physics must finish with a grounded landing");
}catch(e){fail("shot physics pause check failed: "+e.message);}
try{new Function(shotMotionScript);}
catch(e){fail("shot motion script syntax error: "+e.message);}
for(const key of ["AIBAMotion","restoreLegacy","installMotionHooks","boardHit","attachBall","STANCE_YAW","tuneGuideHand","captureGuideStart","captureReleasePose","followState","guideBlend","BALL_RELEASE_AT","applyShotSetPose","completePendingRelease","pendingRelease"])
if(!shotMotionScript.includes(key))fail("shot motion script missing "+key);
for(const key of ['function mirrorArm(','source.clone(true)','function syncArmMirror(','function syncFpRigFromPlayer(','rig.name="fpSharedPoseRig"','ballGrip:shoot.clone.getObjectByName("ballGrip")','clone.material=source.material','restoreFpBall();'])
  if(!shotMotionScript.includes(key))fail("shared first-person pose mirror missing "+key);
if(shotMotionScript.includes("function animFpRig(c,phys,state)"))fail("first-person pose must not keep a second charge-animation formula");
for(const key of ["planeK","shoot.rotation.z=mixN(shoot.rotation.z,0.10,planeK)","targetShootZ=0.06","shootEl.rotation.y=0"])
if(!shotMotionScript.includes(key))fail("shot arm plane correction missing "+key);
for(const key of ["releaseJump","lastJump","launchJump"])
  if(!shotPhysicsScript.includes(key))fail("shot physics continuity token missing "+key);
if(!read("src/gameplay/shots.js").includes("afterPlayerLands"))fail("shot lifecycle must wait for landing before the next possession");
if(!read("src/modes/percent-battle/opponent.js").includes('OPP.phase==="land"'))fail("opponent shot must include a landing phase");
const rosterStyleScript=read("src/roster-style.js");
try{new Function(rosterStyleScript);}
catch(e){fail("roster style script syntax error: "+e.message);}
for(const key of ["AIBARosterStyle","ponytail","bodyProfileFor","resetBody"])
  if(!rosterStyleScript.includes(key))fail("roster style script missing "+key);
const heroMomentsScript=read("src/hero-moments.js");
try{new Function(heroMomentsScript);}
catch(e){fail("hero moments script syntax error: "+e.message);}
for(const key of ["AIBAHeroMoments","shouldHero","startHero","RACK_RUSH_SPEED_TARGET"])
  if(!heroMomentsScript.includes(key))fail("hero moments script missing "+key);
if(heroMomentsScript.includes('G.mode==="battle"')||heroMomentsScript.includes("BATTLE_TARGET"))
  fail("Percent Battle must not pre-trigger a hero camera before the shot result");
if(!configScript.includes("BODY_PROFILES")||!configScript.includes("bodyProfileFor"))fail("config missing body profiles");
if(!configScript.includes("萨布丽娜")||!configScript.includes("苏·伯德"))fail("config missing female legends");
try{new Function(resultStatsScript);}
catch(e){fail("result stats script syntax error: "+e.message);}
for(const key of ["noteResultAttempt","noteResultMake","summarizeResultStats"])
  if(!resultStatsScript.includes(key))fail("result stats script missing "+key);
try{new Function(gearScript);}
catch(e){fail("gear script syntax error: "+e.message);}
if(!gearScript.includes("AIBAGear")||!gearScript.includes("aiba_gear_v1"))fail("gear script missing AIBAGear exports");
for(const key of ["staRing","staArc","positionHud","CAM.mode"])
  if(!gearScript.includes(key))fail("gear script missing stamina ring "+key);
for(const key of ["黑面具","太阳镜","连帽衫","奇葩头套","mods"])
  if(!gearScript.includes(key))fail("gear script missing head gear "+key);
for(const name of ["playerSweetZone","playerChargeRate","startCharge","releaseShot"])
  if(!gearScript.includes('"'+name+'"'))fail("gear script no longer hooks "+name);
try{new Function(hotHandScript);}
catch(e){fail("hot hand script syntax error: "+e.message);}
for(const key of ["AIBAHotHand","levelFor","tagLastShotHot","setCrowdHeat","hotHandWrap"])
  if(!hotHandScript.includes(key))fail("hot hand script missing "+key);
const perfScript=read("src/perf.js");
try{new Function(perfScript);}
catch(e){fail("perf script syntax error: "+e.message);}
if(!perfScript.includes("AIBAPerf")||!perfScript.includes("freezeStatic"))fail("perf script missing AIBAPerf exports");
if(/HandLandmarker|minPoseDetectionConfidence|detectForVideo/.test(perfScript))fail("perf script must not touch pose detection");
const perfSettingsScript=read("src/perf-settings.js");
try{new Function(perfSettingsScript);}
catch(e){fail("perf settings script syntax error: "+e.message);}
for(const key of ["AIBAPerfSettings","aiba_perf_settings_v1","meterTick","applyLowRes","autoSample","recorderBusy","autoPerfTier"])
  if(!perfSettingsScript.includes(key))fail("perf settings script missing "+key);
if(/HandLandmarker|minPoseDetectionConfidence|detectForVideo/.test(perfSettingsScript))fail("perf settings must not touch pose detection");
const iconScript=read("src/ui/icons.js"),i18nScript=read("src/i18n.js");
try{new Function(iconScript);new Function(i18nScript);}
catch(e){fail("icon/i18n script syntax error: "+e.message);}
for(const key of ["AIBASetIcon","volume-x","book-open","MutationObserver"])
  if(!iconScript.includes(key))fail("local SVG icon token missing "+key);
for(const key of ["Broadcast cam","Cam \"+m[1]","Replay onboarding","Turn sound on","Rack \"+m[1]","YOUR TURN","All-money rack:"])
  if(!i18nScript.includes(key))fail("dynamic English translation missing "+key);
for(const key of ["returnToPause","AIBAOnboard.help('settings')","syncButton"])
  if(!perfSettingsScript.includes(key))fail("settings/help integration missing "+key);
try{new Function(faceOverlaysScript);}
catch(e){fail("face overlays script syntax error: "+e.message);}
try{new Function(hapticsScript);}
catch(e){fail("haptics script syntax error: "+e.message);}
for(const key of ["HAPTIC_PATTERNS","clutchMake","heroShot","victory","wireHapticMoments","playerRimHaptic"])
  if(!hapticsScript.includes(key))fail("haptics script missing "+key);
if(!faceOverlaysScript.includes("curry-smile-pixel-128.png"))fail("curry face overlay asset not referenced");
const configSandbox={window:{}};
vm.createContext(configSandbox);
try{vm.runInContext(configScript,configSandbox,{filename:"src/config.js"});}
catch(e){fail("config script runtime error: "+e.message);}
if(!configSandbox.window.AIBA_CONFIG||!configSandbox.window.AIBA_CONFIG.DIFFS)fail("AIBA_CONFIG missing required data");
if(configSandbox.window.AIBA_CONFIG.SHOT_PROFILES.t01.arc!==.9)fail("T-Mac should have the lowest supported shot arc");
if(configSandbox.window.AIBA_CONFIG.SHOT_PROFILES.allen.arc!==.94)fail("Ray Allen shot arc should be second-lowest");
if(configSandbox.window.AIBA_CONFIG.SHOT_PROFILES.t01.arc>=configSandbox.window.AIBA_CONFIG.SHOT_PROFILES.allen.arc)fail("T-Mac arc should stay lower than Ray Allen");
try{new Function(audioScript);}
catch(e){fail("audio script syntax error: "+e.message);}
try{new Function(visualDirectorScript);}
catch(e){fail("visual director script syntax error: "+e.message);}
for(const key of ["AIBAVisual","makeSkyDome","tuneCourt"])
  if(!visualDirectorScript.includes(key))fail("visual director missing "+key);
try{new Function(sceneLifecycleScript);}
catch(e){fail("scene lifecycle script syntax error: "+e.message);}
for(const key of ["AIBASceneLifecycle","resetForRun","resetFlowerLayer","resetBeach"])
  if(!sceneLifecycleScript.includes(key))fail("scene lifecycle missing "+key);
if(/\bglobal\./.test(audioScript))fail("audio script must use browser globals, not bare global");
if(!audioScript.includes("AIBAAudioCaptureStream"))fail("audio capture stream hook missing");
if(/\n\s*preloadVoiceClips\(\);/.test(audioScript))fail("audio startup must not preload the full voice library");
for(const key of ['dataset.audioVoices="on-demand"',"noteAudioIssue","AC.resume()"])
  if(!audioScript.includes(key))fail("audio lazy startup missing "+key);
for(const key of ["decodeGameplaySfx","playDecodedGameplaySfx","prewarmGameplaySfx();"])
  if(!audioScript.includes(key))fail("mobile gameplay SFX unlock missing "+key);
const earlyExtInit=audioScript.indexOf("\nextInit();"),audioInitFn=audioScript.indexOf("function audioInit()");
if(earlyExtInit<0||earlyExtInit>audioInitFn)fail("external BGM must be prepared before first user gesture");
if(!/function ensureAudio\(menuMusic,forcePrime\)\{[\s\S]{0,180}extPlay\("bgm"\);[\s\S]{0,80}audioInit\(\);/.test(audioScript))fail("menu BGM must start before heavy WebAudio initialization");
if(!audioScript.includes("mediaRetryAt[k]=Date.now()+2500"))fail("failed media playback should use retry cooldown");
for(const key of ["crowdHeat","setCrowdHeat","AIBAAudio"])
  if(!audioScript.includes(key))fail("audio script missing crowd heat "+key);
const voiceFiles=new Set([...audioScript.matchAll(/voiceUrl\("([^"]+\.wav)"\)/g)].map(m=>m[1]));
if(!voiceFiles.size)fail("no voiceUrl wav references found in audio script");
const voiceExt=(audioScript.match(/const VOICE_EXT="([^"]+)"/)||[])[1]||".wav";
function voiceExists(name){
  return exists(path.posix.join("assets/aiba-audio/voices",name.replace(/\.wav$/i,voiceExt)));
}
for(const file of voiceFiles){
  if(!voiceExists(file))fail("missing referenced voice clip "+file+" (ext "+voiceExt+")");
}
const audioEventsBlock=(audioScript.match(/const AUDIO_EVENTS = \{([\s\S]*?)\n\};/)||[])[1]||"";
const audioEvents=[...audioEventsBlock.matchAll(/\n\s*([A-Za-z0-9_]+):\s*\[([^\]]*)\]/g)].map(m=>({id:m[1],files:[...m[2].matchAll(/"([^"]+)"/g)].map(x=>x[1])}));
if(audioEvents.length<30)fail("AUDIO_EVENTS unexpectedly small: "+audioEvents.length);
function walkSrc(dir){
  let out=[];
  for(const name of fs.readdirSync(path.join(root,dir))){
    const rel=dir+"/"+name;
    const st=fs.statSync(path.join(root,rel));
    if(st.isDirectory())out=out.concat(walkSrc(rel));
    else if(/\.js$/.test(name))out.push(rel);
  }
  return out;
}
const allCode=walkSrc("src").map(read).join("\n");
for(const ev of audioEvents){
  if(!new RegExp('playAudioEvent\\(\\s*["\\\']'+ev.id+'["\\\']').test(allCode))fail("AUDIO_EVENTS entry has no direct trigger "+ev.id);
  for(const name of ev.files){
    if(!voiceExists(name+".wav"))fail("missing AUDIO_EVENTS clip "+name+voiceExt);
  }
}
for(const name of new Set([...allCode.matchAll(/playSFX\(\s*["']([^"']+)["']/g)].map(m=>m[1]))){
  if(!voiceExists(name+".wav"))fail("missing SFX clip "+name+voiceExt);
}
const vision=read("src/vision.js");
try{new Function(vision);}
catch(e){fail("vision script syntax error: "+e.message);}
const interactiveTutorial=read("src/ui/interactive-tutorial.js");
try{new Function(interactiveTutorial);}
catch(e){fail("interactive tutorial script syntax error: "+e.message);}
for(const token of ["acceptVisionRelease","guidedReleaseCompleted","releaseArmed","step&&step.auto","isHoldingRelease","teardown({stopVision:true})","suspendVisionControl","任意一只手越过白线"])
  if(!interactiveTutorial.includes(token))fail("interactive tutorial release gate missing "+token);
for(const token of ["function visionLostPromptActive","G.running&&!G.buzzed","!G.practice","!lostPromptActive","VISION._lostPromptWindow"])
  if(!vision.includes(token))fail("vision lost prompt game-window gate missing "+token);
if(vision.includes('playAudioEvent("pose_release")')||audioScript.includes("sfx_pose_release_01")||read("src/gameplay/shots.js").includes("shotReleaseSound("))
  fail("shot release must stay silent");
if(interactiveTutorial.includes("itPower")||styles.includes(".itPower"))fail("interactive tutorial must use only the player-side power meter");
for(const token of ["tutorial.acceptVisionRelease(step)","sm.phase=\"charging\"","sm.chargeStart=now"])
  if(!vision.includes(token))fail("vision tutorial release gate missing "+token);
for(const token of ['#itCoach{position:fixed','right:max(10px,env(safe-area-inset-right))','bottom:max(0px,env(safe-area-inset-bottom))!important','#itCoach h2{font-size:20px'])
  if(!styles.includes(token))fail("split tutorial coach style missing "+token);
for(const token of ["aiba_shot_control_v1","触屏控制","体感控制","controlRecommend","restoreVisionControlPreference"])
  if(!vision.includes(token))fail("motion control preference token missing "+token);
for(const token of ["VISION_INFERENCE_MAX_PIXELS=288*512","visionCaptureConstraints","resizeMode:{ideal:\"none\"}","visionRecordCaptureSettings","visionInferenceSource","AIBAVisionFrame","displayAspect","cropPortrait","请保持手机竖屏"])
  if(!vision.includes(token))fail("portrait vision token missing "+token);
if(/function visionCaptureConstraints\(\)\{[\s\S]{0,400}aspectRatio\s*:/.test(vision))fail("camera capture must not request a cropped aspect ratio");
if(!vision.includes("frame.cropPortrait=false"))fail("vision preview must preserve the full camera frame");
if(/if\(cropPortrait\).*drawCover/.test(recorderScript))fail("recorded vision preview must not crop the camera frame");
for(const token of ['aspect-ratio:var(--vision-aspect,9/16)','data-orientation="portrait"'])
  if(!styles.includes(token))fail("portrait vision style missing "+token);
if(vision.includes("视觉实验"))fail("legacy vision experiment label remains");
if(vision.includes('import("./vendor/'))fail("vision module import path should be relative from src/");
if(/HandLandmarker|hand_landmarker\.task/.test(vision))fail("game vision path should not load hand landmarker");
const navigation=read("src/navigation.js");
try{new Function(navigation);}
catch(e){fail("navigation script syntax error: "+e.message);}
for(const token of ["homeBtn","requestHome","cleanup","removeEventListener(\"pointerdown\",global.unlockBoot)","addEventListener(\"pointerup\""])
  if(!navigation.includes(token))fail("navigation flow token missing "+token);
/* 导出顺序会随功能增删变化,只断言"定义了 + 导出了",不绑定相邻写法 */
if(!recorderScript.includes("function cancel()"))fail("recorder cancellation missing function cancel()");
const recorderExports=(recorderScript.match(/AIBARecorder=Object\.freeze\(\{([\s\S]*?)\}\)/)||[])[1]||"";
for(const name of ["cancel","resultMarkup"])
  if(!new RegExp("(^|[,{\\s])"+name+"\\s*[,:}]").test(recorderExports))fail("recorder must export "+name);
const gameFlow=read("src/game-flow.js");
try{new Function(gameFlow);}
catch(e){fail("game flow script syntax error: "+e.message);}
for(const token of ["rookieMeterProgress","G.diff===\"easy\"","updatePregameWarmupShot","updatePregameChalk","updatePlayerLockCamera"])
  if(!gameFlow.includes(token))fail("game flow token missing "+token);

for(const rel of ["src/core/runtime.js","src/core/error-boundary.js","src/core/foundation.js","src/core/state.js","src/core/player-id-sandbox.js","src/core/leaderboard-sandbox.js","src/core/input.js","src/core/game-loop.js","src/core/scene-init.js","src/core/legacy-adapter.js","src/core/bootstrap-next.js","src/data/game-config.js","src/data/dialogue.js","src/services/audio-cues.js","src/rendering/core.js","src/rendering/materials.js","src/rendering/court.js","src/rendering/arena.js","src/rendering/spectators.js","src/rendering/hoop.js","src/rendering/environments.js","src/rendering/props.js","src/rendering/characters.js","src/rendering/camera.js","src/rendering/motion.js","src/rendering/effects.js","src/gameplay/shots.js","src/gameplay/collisions.js","src/presentation/cinematics.js","src/presentation/pregame.js","src/presentation/battle.js","src/presentation/replay.js","src/presentation/win-cinematic.js","src/modes/rack-rush.js","src/modes/contest.js","src/modes/practice.js","src/modes/percent-battle/state.js","src/modes/percent-battle/spots.js","src/modes/percent-battle/opponent.js","src/modes/percent-battle/results.js","src/modes/percent-battle/index.js","src/ui/panels.js","src/ui/loading.js","src/ui/menu.js","src/ui/setup.js","src/ui/pregame.js","src/ui/pause.js","src/ui/battle-controls.js","src/ui/result-copy.js"]){
  try{new Function(read(rel));}
  catch(e){fail(rel+" syntax error: "+e.message);}
}
const ownershipModuleFiles=["core","materials","court","arena","spectators","hoop","environments","props","characters","camera","motion","effects"].map(name=>"src/rendering/"+name+".js")
  .concat(["src/core/error-boundary.js","src/core/foundation.js","src/data/game-config.js","src/data/dialogue.js","src/core/state.js","src/services/audio-cues.js","src/ui/result-copy.js","src/gameplay/shots.js","src/gameplay/collisions.js","src/presentation/cinematics.js","src/presentation/pregame.js","src/presentation/battle.js","src/presentation/replay.js","src/presentation/win-cinematic.js","src/ui/battle-controls.js","src/core/input.js","src/core/game-loop.js","src/core/scene-init.js"]);
try{new Function(ownershipModuleFiles.map(read).join("\n;\n"));}
catch(e){fail("ownership modules have conflicting top-level declarations: "+e.message);}
/* 顶层脚本(非 IIFE 包装)里不能出现 Node 风格的 global.*:浏览器里会直接 ReferenceError */
for(const rel of walkSrc("src")){
  const src=read(rel);
  if(/function[A-Za-z ]*\(global\)/.test(src))continue;   // IIFE 包装过的模块可以用 global
  if(/\bglobal\s*\./.test(src))fail(rel+" uses bare global.* but is not wrapped in an IIFE; use window.*");
}
const runtimeScript=read("src/core/runtime.js");
for(const token of ["aiba_next_v1:","scopeLocalStorage","attachLegacy","service:registered"])
  if(!runtimeScript.includes(token))fail("runtime bridge token missing "+token);
const identitySandbox=read("src/core/player-id-sandbox.js");
const leaderboardSandbox=read("src/core/leaderboard-sandbox.js");
if(/\bfetch\s*\(/.test(identitySandbox+leaderboardSandbox))fail("next sandboxes must not access the network");
if(!leaderboardSandbox.includes("experimental_leaderboard_disabled"))fail("leaderboard sandbox marker missing");
const rackRushModule=read("src/modes/rack-rush.js");
for(const token of ['runtime.service("legacy")','runtime.register("mode:rackrush"',"startRackRush","updateRackRush","finishRackRushRun"])
  if(!rackRushModule.includes(token))fail("Rack Rush module token missing "+token);
const contestModule=read("src/modes/contest.js");
for(const token of ['runtime.service("legacy")','runtime.register("mode:contest"',"beginStage","startRound","showBracket","champion"])
  if(!contestModule.includes(token))fail("contest module token missing "+token);
for(const token of ["function startStageCeremony","startStageCeremony()","G.stageCeremonyDone=true","function returnContestHome","AIBANavigation.returnHome","G.contestRoundAdvanced"])
  if(!contestModule.includes(token))fail("contest stage lifecycle fix missing "+token);
if(contestModule.includes("location.reload()"))fail("contest result must return home without reloading");
const contestCinematics=read("src/presentation/cinematics.js");
for(const token of ["rackShots.forEach(s=>q.push({type:\"shot\",s}))","it.from.distanceTo(it.to)/3.2","it.loadDur=clamp(1.18/speed,.96,1.38)","it.s.ball+1"])
  if(!contestCinematics.includes(token))fail("contest AI full-run behavior missing "+token);
for(const token of ["contest_opponent_intro","contest_moneyrack","contest_finalrack","contest_final10","final_shot","function announceAIShowResult","TALK_STREAK_THREE","TALK_MISS_FIVE"])
  if(!contestCinematics.includes(token))fail("contest AI broadcast parity missing "+token);
for(const token of ["g.ballGrips&&g.ballGrips[0]","applyHandFollowThroughPose(g,ease01((ph-.94)/.09))"])
  if(!contestCinematics.includes(token))fail("contest hand follow-through missing "+token);
if(contestCinematics.includes("每架可视化2球"))fail("contest AI must not use the two-shot montage");
const battleOpponent=read("src/modes/percent-battle/opponent.js");
for(const token of ["function oppRepositionForPlayer","OPP.playerSpotSeen","candidates.sort"])
  if(!battleOpponent.includes(token))fail("Percent Battle overlap guard missing "+token);
for(const token of ["oppPasser","function oppBeginPass","OPP.phase=\"receive\"","OPP.ballOut","oppBeginPass();","superChanceId:OPP.possessionSuperChanceId"])
  if(!battleOpponent.includes(token))fail("Percent Battle opponent pass sequence missing "+token);
if(battleOpponent.includes("G.superStock=Math.max(0,(G.superStock||0)-1)"))fail("opponent attempt must not consume Logo chance");
if(!battleOpponent.includes("applyHandFollowThroughPose(guy,hold)"))fail("Percent Battle opponent wrist follow-through missing");
const battleSpots=read("src/modes/percent-battle/spots.js");
for(const token of ["if(spot.super)return;","function battleConsumeSuperChance","chanceId!==G.superChanceId","G.superResolvedId=chanceId"])
  if(!battleSpots.includes(token))fail("shared Logo make-only opportunity missing "+token);
for(const token of ["battleChargeSuperChanceId","superChanceId:shot.superChanceId","battleConsumeSuperChance(b)"])
  if(!read("src/gameplay/shots.js").includes(token))fail("player concurrent Logo shot identity missing "+token);
const pregameModule=read("src/ui/pregame.js");
for(const token of ['runtime.register("ui:pregame"',"dressGuy","AIBASelectedStar","showRackRushIntro","showBattleIntro"])
  if(!pregameModule.includes(token))fail("pregame module token missing "+token);
for(const token of ['class="battleLineup"','class="battleMetrics"','data-locker-avatar','AIBALockerPreview.render(root)'])
  if(!pregameModule.includes(token))fail("Percent Battle versus presentation missing "+token);
for(const token of [".battleIntroBox",".battleLineup",".battleMetric",".battleRuleChips"])
  if(!styles.includes(token))fail("Percent Battle versus styles missing "+token);
if(!read("src/core/legacy-adapter.js").includes("dressGuy"))fail("legacy adapter must expose dressGuy to pregame");
if(!read("src/core/legacy-adapter.js").includes("sBounce"))fail("legacy adapter must expose bounce SFX to opponent passing");
if(!read("src/core/legacy-adapter.js").includes("applyHandFollowThroughPose"))fail("legacy adapter must expose wrist follow-through");
const renderingCore=read("src/rendering/core.js");
for(const token of ['runtime.register("rendering:core"',"WebGLRenderer","RENDER_QUALITY","updateRenderQuality","dampRig","visualViewport","AmbientLight"])
  if(!renderingCore.includes(token))fail("rendering core token missing "+token);
const renderingMaterials=read("src/rendering/materials.js");
for(const token of ['runtime.register("rendering:materials"',"function pixTex","function realBallTex","function triBallTex","function spaldingPanelCurve","function paintBasketballChannels","function paintTriBallPanels","MeshPhongMaterial","bumpMap:texBallRelief","SphereGeometry(0.16,32,20)"])
  if(!renderingMaterials.includes(token))fail("rendering materials token missing "+token);
for(const source of [renderingMaterials]){
  for(const token of ["pixTex(512,256","spaldingPanelCurve(720)","candidateMeridianA.push([.75,k])","candidateMeridianAOpposite.push([.25,k])","paintTriBallPanels","rotatedTriColorIndex","labels.fill(-1)","panelVotes","turn=Math.PI/2","BALL_LINE_DEBUG","full ring 1","full ring A","double curve","Math.hypot(x,y,z)<radius","LinearMipmapLinearFilter","anisotropy:8","ballTextureRng(0x8badf00d)","SphereGeometry(0.16,32,20)"])
    if(!source.includes(token))fail("calculated basketball material missing "+token);
  if(source.includes("centerMeridian")||source.includes("meridianA.push([0,k])")||source.includes("meridianB.push([.5,k])")||source.includes("candidateMeridianB")||source.includes("Math.random()*96")||source.includes("SphereGeometry(0.16,12,10)"))fail("legacy basketball pattern remains");
}
if(!entryHtml.includes('src/rendering/materials.js?v=refactor17h'))fail("next entry must load rendering materials");
if(entryHtml.includes("function realBallTex("))fail("next entry still contains inline ball materials");
const renderingCourt=read("src/rendering/court.js");
for(const token of ['runtime.register("rendering:court"',"function makeCourtTexture","function buildCourt","courtIndoorTexture","curSpotRing=new THREE.Mesh"])
  if(!renderingCourt.includes(token))fail("rendering court token missing "+token);
if(!entryHtml.includes('src/rendering/court.js?v=refactor18'))fail("next entry must load rendering court");
if(entryHtml.includes("function makeCourtTexture("))fail("next entry still contains inline court texture builder");
const renderingArena=read("src/rendering/arena.js");
for(const token of ['runtime.register("rendering:arena"',"function buildStands","function buildBackcourtShow","function buildCrowd","function updCrowd"])
  if(!renderingArena.includes(token))fail("rendering arena token missing "+token);
const renderingSpectators=read("src/rendering/spectators.js");
for(const token of ['runtime.register("rendering:spectators"',"function buildNearCourtCrowd","function buildStreetCrowd","function updStreetCrowd"])
  if(!renderingSpectators.includes(token))fail("rendering spectators token missing "+token);
const renderingHoop=read("src/rendering/hoop.js");
for(const token of ['runtime.register("rendering:hoop"',"function buildHoop","function buildAtmos","function updJumbo"])
  if(!renderingHoop.includes(token))fail("rendering hoop token missing "+token);
const renderingEnvironments=read("src/rendering/environments.js");
for(const token of ['runtime.register("rendering:environments"',"function buildOutdoorPark","function buildFlowerCourt","function buildBeachSunset","function applyScenePreset","function updateEnvironment"])
  if(!renderingEnvironments.includes(token))fail("rendering environments token missing "+token);
if(renderingEnvironments.includes("const rackBalls="))fail("rendering environments must not own gameplay props");
for(const token of ['src/rendering/arena.js?v=bake1','src/rendering/spectators.js?v=bake2','src/rendering/hoop.js?v=refactor21','src/rendering/environments.js?v=refactor22a'])
  if(!entryHtml.includes(token))fail("next entry missing court element module "+token);
for(const token of ["function buildStands(","function buildNearCourtCrowd(","function buildHoop(","function applyScenePreset("])
  if(entryHtml.includes(token))fail("next entry still contains inline court element "+token);
const renderingProps=read("src/rendering/props.js");
for(const token of ['runtime.register("rendering:props"',"function buildRacks","function resetRackBalls","function buildHands"])
  if(!renderingProps.includes(token))fail("rendering props token missing "+token);
for(const token of ["rackStands=[]","deepStands=[]",'showRacks=G.mode!=="battle"',"halfCourtBall.visible=false"])
  if(!renderingProps.includes(token))fail("Percent Battle rack hiding missing "+token);
const renderingCharacters=read("src/rendering/characters.js");
for(const token of ['runtime.register("rendering:characters"',"function voxelGuy","function applyStarStyle","function buildCharacters","function benchSetup"])
  if(!renderingCharacters.includes(token))fail("rendering characters token missing "+token);
for(const token of ["VOXEL_HEAD_SCALE","headRoot.name=\"headRoot\"","headScale:VOXEL_HEAD_SCALE"])
  if(!renderingCharacters.includes(token))fail("smaller head rig token missing "+token);
for(const token of ['shoulder.name="shoulderBlend"','up.name="upperArm"','roundedBoxGeometry(.152,.17,.172,.052,3)','roundedBoxGeometry(.14,.265,.16,.018,2)','up.position.y=-.1775'])
  if(!renderingCharacters.includes(token))fail("integrated shoulder-arm blend missing "+token);
for(const token of ['handRoot.name="handRig"','roundedBoxGeometry(.145,.135,.058,.024,3)','fingerRoot.name="fingerJoint"','ballGrip.name="ballGrip"','handRoots,fingerJoints,ballGrips'])
  if(!renderingCharacters.includes(token))fail("articulated rounded palm rig missing "+token);
for(const token of ['const soft=(w,h,d,m,r,segments)','const addSoft=','const VOXEL_SHOULDER_X=.285','const VOXEL_HIP_X=.125','roundedBoxGeometry(0.5,0.52,0.27,.048,3)','addSoft(g,0.50,0.22,0.27,mP,0,0.88','add(g,0.52,0.05,0.29,mJ,0,0.98','baseShoulderX:VOXEL_SHOULDER_X','baseHipX:VOXEL_HIP_X','soft(0.125,0.27,0.145,mS,.026,2)','soft(0.19,0.11,0.23','addSoft(kn,0.15,0.22,0.165'])
  if(!renderingCharacters.includes(token))fail("soft voxel body token missing "+token);
for(const token of ['hipBlend.name="hipBlend"','kneeBlend.name="kneeBlend"','ankleBlend.name="ankleBlend"','elbowBlend.name="elbowBlend"','wristBlend.name="wristBlend"','neckBlend.name="neckBlend"','hipBlends,kneeBlends,ankleBlends,elbowBlends,wristBlends'])
  if(!renderingCharacters.includes(token))fail("overlapping rounded joint token missing "+token);
for(const token of ["oppPasser=voxelGuy()","oppPasserBall","bakeActorSegments(oppPasser)"])
  if(!renderingCharacters.includes(token))fail("opponent passer actor missing "+token);
const renderingCamera=read("src/rendering/camera.js");
for(const token of ['runtime.register("rendering:camera"',"const P=","const CAM=","function autoFrameCam","function updPlayCam"])
  if(!renderingCamera.includes(token))fail("rendering camera token missing "+token);
if(!/function ballWorldPos\(out\)\{[^]*pBall\.getWorldPosition\(out\);[^]*return out;[^]*\}/.test(renderingCamera))fail("all cameras must release from the real player ball grip");
if(/function ballWorldPos\(out\)\{[^}]*CAM\.mode/.test(renderingCamera)||/function ballWorldPos\(out\)\{[^}]*handBall\.getWorldPosition/.test(renderingCamera))fail("camera mode must not change the shot release origin");
const renderingMotion=read("src/rendering/motion.js");
for(const token of ['runtime.register("rendering:motion"',"function shotCurves","function poseGuy","function updPose","function startPass","function updWalk"])
  if(!renderingMotion.includes(token))fail("rendering motion token missing "+token);
for(const token of ["SHOT_STANCE_YAW","function shotStanceBlend","function tuneGuideHandPose"])
  if(!renderingMotion.includes(token))fail("shared shot pose token missing "+token);
for(const token of ["function poseHandJoints","function poseGuidePalmToBall","function applyHandFollowThroughPose","HAND_FINGER_FOLLOW=[.14,.38,Math.PI/6,.16]","GUIDE_PALM_INWARD_Y=-1.48","shoot.rotation.x+=(1.18-shoot.rotation.x)*follow","poseGuidePalmToBall(o,c,ready)"])
  if(!renderingMotion.includes(token))fail("shared wrist follow-through token missing "+token);
try{
  let motionApi=null;
  const motionSandbox={
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    window:{AIBA:{runtime:{register:(name,api)=>{if(name==="rendering:motion")motionApi=api;}}}}
  };
  vm.runInNewContext(renderingMotion,motionSandbox);
  const rotation=()=>({x:0,y:0,z:0});
  const fingers=()=>Array.from({length:4},()=>({rotation:rotation()}));
  const pose={handRoots:[{rotation:rotation()},{rotation:rotation()}],fingerJoints:[fingers(),fingers()]};
  motionApi.poseHandJoints(pose,{lift:1});
  motionApi.poseGuidePalmToBall(pose,{dip:0,lift:1,jmp:0},true);
  if(Math.abs(pose.handRoots[1].rotation.y+1.48)>.001)fail("guide palm must face inward toward the ball");
  const guideBefore={...pose.handRoots[1].rotation};
  motionApi.applyHandFollowThroughPose(pose,1);
  if(Object.keys(guideBefore).some(axis=>Math.abs(pose.handRoots[1].rotation[axis]-guideBefore[axis])>.001))fail("shooting follow-through must not flip the guide palm");
}catch(e){fail("guide palm pose check failed: "+e.message);}
for(const token of ['src/rendering/props.js?v=refactor23a','src/rendering/characters.js?v=2.16.2-human-proportion','src/rendering/camera.js?v=2.18-shared-fp-pose','src/rendering/motion.js?v=2.15.5-hand-follow'])
  if(!entryHtml.includes(token))fail("next entry missing gameplay rendering module "+token);
for(const token of ["function buildRacks(","function voxelGuy(","function autoFrameCam(","function shotCurves(","function updWalk("])
  if(entryHtml.includes(token))fail("next entry still contains inline gameplay rendering "+token);
const renderingEffects=read("src/rendering/effects.js");
for(const token of ['runtime.register("rendering:effects"',"function emitFire","function startConfetti","function tween","function glideTo"])
  if(!renderingEffects.includes(token))fail("rendering effects token missing "+token);
const presentationCinematics=read("src/presentation/cinematics.js");
for(const token of ['runtime.register("presentation:cinematics"',"function startHero","function startAIShow","function battleCutaway","function startVictoryCine","function stopVictoryCine","function setVictoryTag"])
  if(!presentationCinematics.includes(token))fail("presentation cinematics token missing "+token);
for(const token of ['if(G.state!=="victorycine"){stopVictoryCine();return;}','setVictoryTag(v,"crowd","全场欢呼")'])
  if(!presentationCinematics.includes(token))fail("victory cinematic state/DOM guard missing "+token);
const percentBattleState=read("src/modes/percent-battle/state.js");
if(!percentBattleState.includes("function resetBattleState(){\n    stopVictoryCine();"))
  fail("Percent Battle reset must cancel stale victory cinematics");
for(const token of ["function attachShowBall","getWorldPosition(_showReleasePos)","function setAIShowActors","tuneGuideHandPose(g,c,true)"])
  if(!presentationCinematics.includes(token))fail("contest opponent presentation fix missing "+token);
const presentationPregame=read("src/presentation/pregame.js");
for(const token of ['runtime.register("presentation:pregame"',"const PREGAME=","function startPreGameShow","function updPreGameShow"])
  if(!presentationPregame.includes(token))fail("presentation pregame token missing "+token);
for(const token of ["function pregameSmoothPose","pregameSmoothPose(a.guy,dt)","const dunkArc=","const hangRise=","PREGAME.poseCache.clear()"])
  if(!presentationPregame.includes(token))fail("pregame fluidity fix missing "+token);
const presentationBattle=read("src/presentation/battle.js");
for(const token of ['runtime.register("presentation:battle"',"function updBattleCut","function checkBattleOvertake","function battleScoreCallout"])
  if(!presentationBattle.includes(token))fail("presentation battle token missing "+token);
for(const token of ['src/rendering/effects.js?v=refactor27','src/presentation/cinematics.js?v=2.15.5-hand-follow','src/presentation/pregame.js?v=refactor29c','src/presentation/battle.js?v=refactor30'])
  if(!entryHtml.includes(token))fail("next entry missing presentation module "+token);
for(const token of ["function startHero(","function startAIShow(","function startVictoryCine(","function startPreGameShow(","function battleScoreCallout(","function startConfetti("])
  if(entryHtml.includes(token))fail("next entry still contains inline presentation "+token);
const gameplayShots=read("src/gameplay/shots.js");
for(const token of ['runtime.register("gameplay:shots"',"const balls=","function startCharge","function releaseShot","function madeBall","function updBalls"])
  if(!gameplayShots.includes(token))fail("gameplay shots token missing "+token);
for(const token of [
  "const BALL_FLOOR_PHYSICS=",
  "restitution:[.77,.67,.54]",
  'ball.phase="roll"',
  'b.phase==="roll"',
  "resolveFloorBounce(b)"
]) if(!gameplayShots.includes(token))fail("staged floor bounce physics missing "+token);
if(gameplayShots.includes("b.vel.y*=-0.42"))fail("legacy underinflated floor bounce must stay removed");
for(const token of ["function playRimImpactSound","b.rimSoundPlayed","playRimImpactSound(b,b.rin)","playRimImpactSound(b,false)"])
  if(!gameplayShots.includes(token))fail("rim impact sound route missing "+token);
if(!gameplayShots.includes('announceAIShowResult(b,true)')||!gameplayShots.includes('announceAIShowResult(b,false)'))fail("contest AI shot results must feed broadcast commentary");
const gameplayCollisions=read("src/gameplay/collisions.js");
for(const token of ['runtime.register("gameplay:collisions"',"function checkBallCollisions","function ballCollide"])
  if(!gameplayCollisions.includes(token))fail("gameplay collisions token missing "+token);
const presentationReplay=read("src/presentation/replay.js");
for(const token of ['runtime.register("presentation:replay"',"function startReplay","function updReplay","function aiProb"])
  if(!presentationReplay.includes(token))fail("presentation replay token missing "+token);
const battleControls=read("src/ui/battle-controls.js");
for(const token of ['runtime.register("ui:battle-controls"',"function buildSpotDots","function updatePlayerPowerUI","function updSpotDots"])
  if(!battleControls.includes(token))fail("battle controls token missing "+token);
for(const source of [battleControls]){
  if(!source.includes("training?15:10")||!source.includes("training?68:70")||!source.includes("training?92:90"))fail("training player-side sweet zone display missing");
}
if(!battleControls.includes("function avoidPowerHudOverlap"))fail("power meter HUD overlap guard missing");
const winCinematic=read("src/presentation/win-cinematic.js");
for(const token of ['runtime.register("presentation:win-cinematic"',"const winCine=","function startWinCine","function updWinCine"])
  if(!winCinematic.includes(token))fail("winning cinematic token missing "+token);
if(!winCinematic.includes("applyHandFollowThroughPose(w.shooter"))fail("winning cinematic wrist follow-through missing");
const coreInput=read("src/core/input.js"),coreLoop=read("src/core/game-loop.js"),sceneInit=read("src/core/scene-init.js");
for(const token of ['runtime.register("core:input"',"function onDown","function onUp","const TILT="])
  if(!coreInput.includes(token))fail("core input token missing "+token);
for(const token of ['runtime.register("core:game-loop"',"function animate","window.animate=animate","updatePractice(dt)"])
  if(!coreLoop.includes(token))fail("core game-loop token missing "+token);
if(!coreLoop.includes('if(VICTORY_CINE.on&&G.state!=="victorycine")stopVictoryCine();'))
  fail("game loop must cancel a stale victory cinematic before camera dispatch");
for(const token of ['runtime.register("core:scene-init"',"buildCourt();","buildCharacters();","applyScenePreset(currentScenePreset"])
  if(!sceneInit.includes(token))fail("scene init token missing "+token);
for(const token of ['src/gameplay/shots.js?v=2.15.5-hand-follow','src/presentation/replay.js?v=2.15.5-hand-follow','src/ui/battle-controls.js?v=refactor33b','src/gameplay/collisions.js?v=refactor34','src/presentation/win-cinematic.js?v=2.15.5-hand-follow','src/core/input.js?v=cutover2','src/core/game-loop.js?v=refactor37a','src/core/scene-init.js?v=refactor38'])
  if(!entryHtml.includes(token))fail("next entry missing runtime-core module "+token);
for(const token of ["function startCharge(","function updBalls(","function startReplay(","function buildSpotDots(","function ballCollide(","function startWinCine(","function onDown(","function animate(","buildCourt();"])
  if(entryHtml.includes(token))fail("next entry still contains inline runtime core "+token);
if(!(entryHtml.indexOf('src/core/input.js?v=cutover2')<entryHtml.indexOf('src/core/legacy-adapter.js?v=2.15.5-hand-follow')))fail("input must load before legacy adapter");
if(!(entryHtml.indexOf('src/core/scene-init.js?v=refactor38')<entryHtml.indexOf('src/core/legacy-adapter.js?v=2.15.5-hand-follow')))fail("scene init must load before legacy adapter");

const sandbox={window:{}};
vm.createContext(sandbox);
try{vm.runInContext(manifest,sandbox,{filename:"src/assets-manifest.js"});}
catch(e){fail("assets manifest syntax error: "+e.message);}
const assets=sandbox.window.AIBA_ASSETS;
if(!assets)fail("AIBA_ASSETS missing");
if(!Array.isArray(assets.coverStars)||assets.coverStars.length!==5)fail("coverStars should have 5 entries");
for(const star of assets.coverStars){
  if(!star.id||!star.cover||!star.coverVideo)fail("cover star missing fields");
  if(!/\.webp$/.test(star.cover))fail("cover image should be webp for "+star.id);
  if(!/-lite\.mp4$/.test(star.coverVideo))fail("cover video should use lite mp4 for "+star.id);
  if(!exists(star.cover))fail("missing cover image "+star.cover);
  if(!exists(star.coverVideo))fail("missing cover video "+star.coverVideo);
}
for(const key of ["bgm","crowd","crowdCheer","rain","ocean","gull"]){
  const rel=assets.audio&&assets.audio[key];
  if(!rel)fail("audio key missing "+key);
  if(!exists(rel))fail("missing audio file "+rel);
}
for(const key of [
  "applause","boo","buzzer","startWhistle","shoeSqueak",
  "bounce","bounce2","bounceSequence","swish","swish2","swish3","clank","clank2","rimMake"
]){
  const rel=assets.audio&&assets.audio[key];
  if(!rel)fail("gameplay SFX key missing "+key);
  if(!exists(rel))fail("missing gameplay SFX file "+rel);
}
for(const token of ["function extPlayVariant(","function sRimMake(","startWhistle",'"sequence"'])
  if(!(audioScript+gameplayShots).includes(token))fail("gameplay SFX routing missing "+token);

console.log("check ok:",inlineScriptCounts.main+" main / "+inlineScriptCounts.legacy+" legacy inline scripts,",inlineLines+" main inline lines,",assets.coverStars.length+" cover stars");
