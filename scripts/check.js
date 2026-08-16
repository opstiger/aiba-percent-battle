#!/usr/bin/env node
"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const childProcess=require("child_process");

const root=path.resolve(__dirname,"..");
const entry="index.html";
const legacyEntry="legacy.html";
const snapshot="block-3pt-kingv2.19.5-modular.html";
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
  "src/modes/last-shot/config.js",
  "src/modes/last-shot/squad.js",
  "src/modes/last-shot/sequence.js",
  "src/modes/last-shot/index.js",
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
if(!entryHtml.includes('<script src="src/vision.js?v=2.19.5-unify"></script>'))fail("next vision cache version missing");
if(!entryHtml.includes('<script src="src/rendering/core.js?v=2.19.5-hfov"></script>'))fail("next rendering core missing");
for(const file of ["core/error-boundary","core/foundation","data/dialogue","core/state","services/audio-cues","ui/result-copy"]){
  const version=file==="core/state"?"2.19.2-fp-lastshot":"refactor39";
  if(!entryHtml.includes(`<script src="src/${file}.js?v=${version}"></script>`))fail(`next shell module missing ${file}`);
}
if(!entryHtml.includes('<script src="src/data/game-config.js?v=2.19.5-release"></script>'))fail("next game config cache version missing");

if(entryHtml.indexOf('src/core/runtime.js')>entryHtml.indexOf('src/config.js'))fail("next runtime must load before config");
if(entryHtml.indexOf('<script src="src/rendering/core.js?v=2.19.5-hfov"></script>')>entryHtml.indexOf('<script src="src/core/scene-init.js?v=refactor38"></script>'))fail("rendering core must load before scene construction");
if(!entryHtml.includes('<script src="src/core/legacy-adapter.js?v=2.18.5-shared-ai-shot"></script>'))fail("next legacy adapter missing");
if(!entryHtml.includes('<script src="src/modes/rack-rush.js?v=refactor5b"></script>'))fail("next Rack Rush module missing");
if(!entryHtml.includes('<script src="src/modes/contest.js?v=refactor5c"></script>'))fail("next contest module missing");
if(!entryHtml.includes('<script src="src/modes/practice.js?v=refactor5a"></script>'))fail("next practice module missing");
if(!entryHtml.includes('<script src="src/ui/panels.js?v=refactor7"></script>'))fail("next panels module missing");
if(!entryHtml.includes('<script src="src/ui/loading.js?v=2.13"></script>'))fail("next loading module missing");
if(!entryHtml.includes('<script src="src/ui/menu.js?v=2.19-lastshot5"></script>'))fail("next menu module missing");
if(!entryHtml.includes('<script src="src/ui/setup.js?v=refactor13"></script>'))fail("next setup module missing");
if(!entryHtml.includes('<script src="src/ui/pregame.js?v=refactor15c"></script>'))fail("next pregame module missing");
if(!entryHtml.includes('<script src="src/ui/pause.js?v=1.98"></script>'))fail("next pause module missing");
if(!entryHtml.includes('<script src="src/core/bootstrap-next.js?v=cutover1"></script>'))fail("next bootstrap module missing");
if(!entryHtml.includes('<script src="src/modes/percent-battle/state.js?v=refactor4c"></script>'))fail("next Percent Battle state module missing");
if(!entryHtml.includes('<script src="src/modes/percent-battle/spots.js?v=refactor4b"></script>'))fail("next Percent Battle spots module missing");
const percentBattleVersions={opponent:"2.19.3-tstage",results:"refactor4a",index:"refactor4a"};
for(const [file,version] of Object.entries(percentBattleVersions)){
  if(!entryHtml.includes(`<script src="src/modes/percent-battle/${file}.js?v=${version}"></script>`))fail(`next Percent Battle ${file} module missing`);
}
const lastShotModules=["config","squad","sequence","index"];
const lastShotVersions={config:"2.19.5-roster",squad:"2.19.6-kit2",sequence:"2.19.5-celeb3",index:"2.19.5-unify3"};
for(const file of lastShotModules){
  if(!entryHtml.includes(`<script src="src/modes/last-shot/${file}.js?v=${lastShotVersions[file]}"></script>`))fail(`next Last Shot ${file} module missing`);
}
for(let i=1;i<lastShotModules.length;i++){
  const prev=entryHtml.indexOf(`src/modes/last-shot/${lastShotModules[i-1]}.js`);
  const cur=entryHtml.indexOf(`src/modes/last-shot/${lastShotModules[i]}.js`);
  if(prev<0||cur<0||prev>cur)fail(`Last Shot module order broken at ${lastShotModules[i]}`);
}
if(entryHtml.includes("function beginLastShot(")||entryHtml.includes("function updateLastShot("))fail("next entry still contains inline Last Shot implementation");
const lastShotLoop=read("src/core/game-loop.js");
if(!lastShotLoop.includes("updateLastShotCam")||!lastShotLoop.includes("updPlayCam(dt)"))fail("Last Shot camera must fall back to shared updPlayCam");
const lastShotInput=read("src/core/input.js");
if(!/G\.state==="lastshot"/.test(lastShotInput))fail("Last Shot must be able to receive touch/keyboard shot input");
if(!/G\.state==="lastshot"/.test(read("src/vision.js")))fail("Last Shot must be reachable by vision (体感) control");
if(!/G\.mode!=="lastshot"/.test(read("src/rendering/props.js")))fail("Last Shot must hide the practice ball racks");
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
if(entryHtml.indexOf('src/core/foundation.js?v=refactor39')>entryHtml.indexOf('src/data/game-config.js?v=2.19.5-release'))fail("foundation must load before game config");
if(entryHtml.indexOf('src/data/game-config.js?v=2.19.5-release')>entryHtml.indexOf('src/core/state.js?v=2.19.2-fp-lastshot'))fail("game config must load before runtime state");
if(entryHtml.indexOf('src/core/state.js?v=2.19.2-fp-lastshot')>entryHtml.indexOf('src/services/audio-cues.js?v=refactor39'))fail("runtime state must load before audio cues");
if(entryHtml.indexOf('src/services/audio-cues.js?v=refactor39')>entryHtml.indexOf('src/audio.js?v=2.19'))fail("audio cues must load before audio engine");
if(entryHtml.indexOf('<script src="src/core/legacy-adapter.js?v=2.18.5-shared-ai-shot"></script>')>entryHtml.indexOf('<script src="src/modes/rack-rush.js?v=refactor5b"></script>'))fail("legacy adapter must load before Rack Rush module");
if(entryHtml.indexOf('<script src="src/modes/rack-rush.js?v=refactor5b"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("Rack Rush module must load before late hooks");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("contest module must load before late hooks");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/modes/practice.js?v=refactor5a"></script>'))fail("contest module must load before practice module");
if(entryHtml.indexOf('<script src="src/ui/panels.js?v=refactor7"></script>')>entryHtml.indexOf('<script src="src/ui/loading.js?v=2.13"></script>'))fail("panels must load before loading module");
if(entryHtml.indexOf('<script src="src/ui/loading.js?v=2.13"></script>')>entryHtml.indexOf('<script src="src/ui/menu.js?v=2.19-lastshot5"></script>'))fail("loading must load before menu module");
if(entryHtml.indexOf('<script src="src/ui/menu.js?v=2.19-lastshot5"></script>')>entryHtml.indexOf('<script src="src/ui/setup.js?v=refactor13"></script>'))fail("menu must load before setup module");
if(entryHtml.indexOf('<script src="src/ui/setup.js?v=refactor13"></script>')>entryHtml.indexOf('<script src="src/ui/pregame.js?v=refactor15c"></script>'))fail("setup must load before pregame module");
if(entryHtml.indexOf('<script src="src/ui/pregame.js?v=refactor15c"></script>')>entryHtml.indexOf('<script src="src/ui/pause.js?v=1.98"></script>'))fail("pregame must load before pause module");
if(entryHtml.indexOf('<script src="src/ui/pause.js?v=1.98"></script>')>entryHtml.indexOf('<script src="src/core/bootstrap-next.js?v=cutover1"></script>'))fail("pause module must load before bootstrap");
if(!entryHtml.includes('<script src="src/navigation.js?v=2.19-lastshot5"></script>'))fail("next navigation cache version missing");
if(entryHtml.indexOf('<script src="src/core/bootstrap-next.js?v=refactor12"></script>')>entryHtml.indexOf('<script src="src/navigation.js?v=2.19-lastshot5"></script>'))fail("boot must begin before navigation rewires the loading gate");
if(entryHtml.indexOf('<script src="src/modes/contest.js?v=refactor5c"></script>')>entryHtml.indexOf('<script src="src/modes/percent-battle/state.js?v=refactor4c"></script>'))fail("contest module must load before Percent Battle modules");
for(const pair of [["state","spots"],["spots","opponent"],["opponent","results"],["results","index"]]){
  if(entryHtml.indexOf(`src/modes/percent-battle/${pair[0]}.js`)>entryHtml.indexOf(`src/modes/percent-battle/${pair[1]}.js`))fail(`Percent Battle ${pair[0]} must load before ${pair[1]}`);
}
if(!entryHtml.includes('<script src="src/modes/percent-battle/opponent.js?v=2.19.3-tstage"></script>'))fail("Percent Battle opponent cache version missing");
if(entryHtml.indexOf('<script src="src/modes/percent-battle/index.js?v=refactor4a"></script>')>entryHtml.indexOf('<script src="src/game-flow.js?v=2.12.4-prewarm"></script>'))fail("Percent Battle module must load before late hooks");
if(/^(<<<<<<<|=======|>>>>>>>)$/m.test(entryHtml))fail("conflict marker in html");
for(const token of ["v2.19.5 MODULAR","MODULAR / v2.19.5"])
  if(!entryHtml.includes(token))fail("visible version token missing "+token);
if(!read("src/data/game-config.js").includes('const GAME_VERSION="v2.19.5";'))fail("GAME_VERSION must be v2.19.5");
const playerMeterGradient='<linearGradient id="ppGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#2e8bff"/><stop offset="55%" stop-color="#39d3ff"/><stop offset="78%" stop-color="#ffd23f"/><stop offset="100%" stop-color="#ff4040"/></linearGradient>';
if(!entryHtml.includes(playerMeterGradient))fail("player power fill must preserve the original single-sweet-zone gradient");
if((entryHtml.match(/class="ppSweet"/g)||[]).length!==1)fail("player power must expose exactly one sweet-zone marker");
if((entryHtml.match(/class="ppFill"/g)||[]).length!==1)fail("player power must expose one continuous fill path");
for(const token of ["ppMidClip","ppTopClip","ppFillBase","ppFillMid","ppFillTop"])
  if(entryHtml.includes(token)||read("styles.css").includes(token))fail("player power duplicate fill layer remains "+token);
if(!entryHtml.includes('<link rel="stylesheet" href="styles.css?v=2.18.5-shared-ai-shot">'))fail("stylesheet link missing");
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
if(!entryHtml.includes('<script src="src/player-locker-preview.js?v=2.18.3-locker-hands"></script>'))fail("player locker preview script missing");
if(!entryHtml.includes('<script src="src/player-id.js"></script>'))fail("player id script missing");
if(!entryHtml.includes('<script src="src/leaderboard-api.js"></script>'))fail("leaderboard api script missing");
if(!entryHtml.includes('<script src="src/leaderboard-ui.js?v=1.94"></script>'))fail("leaderboard ui script missing");
if(!entryHtml.includes('<script src="src/share.js?v=2.01"></script>'))fail("share script missing");
if(!entryHtml.includes('<script src="src/shot-physics.js?v=2.07-late-diag"></script>'))fail("shot physics script missing");
if(!entryHtml.includes('<script src="src/result-stats.js?v=1.78"></script>'))fail("result stats script missing");
if(!entryHtml.includes('<script src="src/rendering/equipment-visuals.js?v=2.16-soft-voxel"></script>'))fail("equipment visual script missing");
if(!entryHtml.includes('<script src="src/gear.js?v=2.15.5-hand-follow"></script>'))fail("gear script missing");
if(!entryHtml.includes('<script src="src/avatar-customizer.js?v=2.15.5-hand-follow"></script>'))fail("avatar customizer script missing");
if(!entryHtml.includes('<script src="src/shot-motion.js?v=2.19.6-hipfwd"></script>'))fail("shot motion script missing");
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
if(!entryHtml.includes('<script src="src/vision.js?v=2.19.5-unify"></script>'))fail("vision script missing");
if(!entryHtml.includes('<script src="src/ui/icons.js?v=1"></script>'))fail("local SVG icon script missing");
if(!entryHtml.includes('<script src="src/ui/interactive-tutorial.js?v=2.05"></script>'))fail("interactive tutorial script missing");
if(!entryHtml.includes('<script src="src/navigation.js?v=2.19-lastshot5"></script>'))fail("navigation script missing");
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
for(const token of ["LOCKER_ACTIONS","function idlePose","function wavePose","function shadowShotPose","function jerseyPose","function headbandPose","function startLiveMotion","lastMotionFrame<33","prefers-reduced-motion: reduce","cancelAnimationFrame(liveView.motionRaf)","dataset.lockerAction","Math.sin(progress*Math.PI*7)*k*sign","blendRotation(guy.handRoots&&guy.handRoots[1],-.18,-1.05,.04,k)","blendRotation(guy.handRoots&&guy.handRoots[0],-.18,Math.PI","blendRotation(guy.handRoots&&guy.handRoots[0],-.18,Math.PI*.5"])
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
for(const key of ["AIBAMotion","restoreLegacy","installMotionHooks","boardHit","attachBall","STANCE_YAW","captureReleasePose","followState","AIBAShotMotion","BALL_RELEASE_AT","completePendingRelease","pendingRelease"])
if(!shotMotionScript.includes(key))fail("shot motion script missing "+key);
for(const oldKey of ["tuneGuideHand","captureGuideStart"])
  if(shotMotionScript.includes(oldKey))fail("shot motion duplicate hand controller remains "+oldKey);
for(const key of ['function mirrorArm(','source.clone(true)','function syncArmMirror(','function syncFpRigFromPlayer(','rig.name="fpSharedPoseRig"','ballGrip:shoot.clone.getObjectByName("ballGrip")','clone.material=source.material','restoreFpBall();'])
  if(!shotMotionScript.includes(key))fail("shared first-person pose mirror missing "+key);
if(shotMotionScript.includes("function animFpRig(c,phys,state)"))fail("first-person pose must not keep a second charge-animation formula");
const sharedShotPose=read("src/rendering/motion.js");
for(const key of ["SHOT_CATCH_POSE","SHOT_READY_POSE","SHOT_SET_POSE","SHOT_FOLLOW_POSE","handActorQuat","function applyShotSetPose","function applyShootingHandWorldFollow","function applyShotFollowThroughPose","pose.aq="])
  if(!sharedShotPose.includes(key))fail("shared shot arm pose missing "+key);
/* 迎球→持球→最高点必须是同一族关键帧：握球腕姿直接引用 SHOT_SET_POSE，
   任何一处改回“各写一套腕姿”都会让手掌重新追不上小臂。 */
for(const key of ["handQuat:SHOT_SET_POSE.shooting.handQuat","handQuat:SHOT_SET_POSE.guide.handQuat"])
  if(!sharedShotPose.includes(key))fail("ready grip must reuse the T-stage hand quaternion: "+key);
for(const oldKey of ["planeK","targetShootZ","SHOT_HOLD_POSE","SHOT_FOLLOW_POSE.shooting.handQuat"])
  if(sharedShotPose.includes(oldKey))fail("legacy local-axis follow-through remains "+oldKey);
/* v2.19.4 回归护栏：持球段一旦再用“球员局部绝对朝向”钉手腕，或用世界坐标反解
   辅助手腕位，接球到最高点的双手就会重新乱转/脱节。 */
for(const oldKey of ["READY_SHOOT_HAND_ACTOR_QUAT","READY_GUIDE_HAND_ACTOR_QUAT","blendHandActorQuat","applyActorLocalQuat","captureActorLocalQuat","worldToLocal(_holdTarget"])
  if(sharedShotPose.includes(oldKey))fail("hold phase must stay parent-local, found "+oldKey);
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
/* 出手跟随必须复用玩家那一套 applyShotFollowThroughPose(伸肩肘 + 压腕)。
   applyHandFollowThroughPose 只压腕，球出去了手臂还僵在最高点——就是"悬停空中"。 */
for(const token of ["g.ballGrips&&g.ballGrips[0]","applyShotFollowThroughPose(g,st,it.shotPose)","captureShotPose(g)"])
  if(!contestCinematics.includes(token))fail("contest follow-through must reuse the shared one: "+token);
if(/applyHandFollowThroughPose\(g,ease01/.test(contestCinematics))
  fail("contest must not fall back to the wrist-only follow-through (the arm freezes mid-air)");
if(contestCinematics.includes("每架可视化2球"))fail("contest AI must not use the two-shot montage");
const battleOpponent=read("src/modes/percent-battle/opponent.js");
for(const token of ["function oppRepositionForPlayer","OPP.playerSpotSeen","candidates.sort"])
  if(!battleOpponent.includes(token))fail("Percent Battle overlap guard missing "+token);
for(const token of ["oppPasser","function oppBeginPass","OPP.phase=\"receive\"","OPP.ballOut","oppBeginPass();","superChanceId:OPP.possessionSuperChanceId"])
  if(!battleOpponent.includes(token))fail("Percent Battle opponent pass sequence missing "+token);
if(battleOpponent.includes("G.superStock=Math.max(0,(G.superStock||0)-1)"))fail("opponent attempt must not consume Logo chance");
if(!battleOpponent.includes("applyHandFollowThroughPose(guy,hold)"))fail("Percent Battle opponent wrist follow-through missing");
for(const token of ["function attachOppBall","guy.ball.getWorldPosition(start)","shotFlightTime(0.78+distance*0.062,G.myStar||opponent,spot)","poseGuy(guy,curve,0)","captureShotPose","AIBAShotMotion"])
  if(!battleOpponent.includes(token))fail("Percent Battle opponent shared shot pose missing "+token);
if(/applyShotSetPose\(guy|tuneGuideHandPose\(guy/.test(battleOpponent))fail("Percent Battle must not overwrite poseGuy hand transforms");
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
for(const token of ["applyHandFollowThroughPose","tuneGuideHandPose","captureShotPose","applyShotSetPose"])
  if(!read("src/core/legacy-adapter.js").includes(token))fail("legacy adapter must expose shared shot pose "+token);
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
for(const token of [
  "function poseHandJoints","function poseShootingHandToBall","function poseGuidePalmToBall","function poseCatchHands",
  "function applyHandFollowThroughPose","function captureShotPose","function applyShotSetPose","function applyShootingHandWorldFollow",
  "function applyShotFollowThroughPose","SHOT_SET_BALL={x:-.106,y:1.8962,z:.3201}",
  "handActorQuat:Object.freeze([-Math.SQRT1_2,0,0,Math.SQRT1_2])","HAND_FINGER_FOLLOW=[.14,.38,Math.PI/6,.16]",
  "_shotPoseDesiredQuat.copy(_shotPoseActorQuat).invert().multiply(_shotPoseWorldQuat)",
  "shoot.quaternion.copy(_shotPoseParentQuat.invert().multiply(_shotPoseWorldQuat))"
])
  if(!renderingMotion.includes(token))fail("shared wrist follow-through token missing "+token);
for(const removed of ["STATIC_HOLD_DEBUG","applyStaticBallHoldPose","BALL_IN_ELBOW","SHOOT_HAND_PITCH","GUIDE_PALM_YAW"])
  if(renderingMotion.includes(removed))fail("obsolete hand controller remains "+removed);
if((renderingMotion.match(/function applyShotSetPose\(/g)||[]).length!==1||
  (renderingMotion.match(/^\s*applyShotSetPose\(o,c\);/gm)||[]).length!==1)
  fail("applyShotSetPose must have one definition and one poseGuy call");
if(!renderingCharacters.includes('ballGrip.position.set(.012341,-.108954,-.193745)'))fail("handRig ballGrip must match the T-stage ball center");
for(const token of ["upperArms.push(up)","forearms.push(fo)",'fingerRoot.position.set(i*.028,-.128,-.015)'])
  if(!renderingCharacters.includes(token))fail("T-stage adjustable arm rig missing "+token);
if(!renderingCharacters.includes('const handSide=x<0?1:-1'))fail("thumb side must face between the two hands");
if(!read("src/shot-motion.js").includes("const parent=player.ballGrips&&player.ballGrips[0];"))fail("player ball must use the handRig ballGrip");
if(/parent===player\.elbows\[0\]|pBall\.position\.set\(\.01,-\.105,\.065\)/.test(read("src/shot-motion.js")))
  fail("legacy elbow ball anchor fallback remains");
try{
  const THREE=require(path.join(root,"vendor/three.min.r128.js"));
  let motionApi=null;
  const motionSandbox={
    THREE,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    window:{AIBA:{runtime:{register:(name,api)=>{if(name==="rendering:motion")motionApi=api;}}}}
  };
  motionSandbox.globalThis=motionSandbox;
  vm.runInNewContext(renderingMotion,motionSandbox);
  if(!motionApi)fail("rendering motion runtime API did not register");
  const actor={g:new THREE.Group(),baseShoulderX:.285,arms:[],elbows:[],handRoots:[],fingerJoints:[],ballGrips:[],legs:[],knees:[],ankles:[],shoes:[]};
  for(let i=0;i<2;i++){
    const arm=new THREE.Group(),elbow=new THREE.Group(),hand=new THREE.Group(),grip=new THREE.Group();
    actor.g.add(arm);arm.add(elbow);elbow.add(hand);hand.add(grip);
    actor.arms.push(arm);actor.elbows.push(elbow);actor.handRoots.push(hand);actor.ballGrips.push(grip);
    actor.fingerJoints.push(Array.from({length:4},()=>{const finger=new THREE.Group();hand.add(finger);return finger;}));
    grip.position.set(.012341,-.108954,-.193745);
    actor.legs.push(new THREE.Group());actor.knees.push(new THREE.Group());actor.ankles.push(new THREE.Group());actor.shoes.push(new THREE.Group());
  }
  const resetSet=()=>{
    motionApi.poseHandJoints(actor,{lift:1});
    motionApi.applyShotSetPose(actor,{lift:1},true);
    actor.g.updateMatrixWorld(true);
  };
  resetSet();
  const setBall=actor.ballGrips[0].getWorldPosition(new THREE.Vector3());
  const expectedBall=new THREE.Vector3(-.106,1.8962,.3201);
  if(setBall.distanceTo(expectedBall)>=1e-3)fail(`T-stage ball center drifted by ${setBall.distanceTo(expectedBall).toFixed(6)}`);

  // 接球与前段蓄力必须继续走旧曲线；只有末段才收敛到上面的 T台最高点。
  motionSandbox.player=actor;
  motionSandbox.G={canShoot:true,charging:false};
  const curve=(lift,dip=0,jmp=0)=>({lift,dip,rise:0,jmp,over:0});
  const actorHandQuat=hand=>{
    actor.g.updateMatrixWorld(true);
    const world=hand.getWorldQuaternion(new THREE.Quaternion());
    const rootQ=actor.g.getWorldQuaternion(new THREE.Quaternion());
    return rootQ.invert().multiply(world).normalize();
  };
  /* 持球帧必须与最高点同一种握球方式：腕部相对前臂一格都不许转。
     只要这两个夹角不是 0，抬球段的手掌就又开始自己拧了。 */
  const topHandQuat=actor.handRoots[0].quaternion.clone(),topGuideHandQuat=actor.handRoots[1].quaternion.clone();
  motionApi.poseGuy(actor,curve(0),0);
  if(actor.handRoots[0].quaternion.angleTo(topHandQuat)>1e-5||actor.handRoots[1].quaternion.angleTo(topGuideHandQuat)>1e-5)
    fail("ready grip must match the T-stage wrist exactly");
  if(actor.g.userData.shotSetPosePhase!=="ready-hold")fail("ready must sit on the hold keyframe");
  /* 抬球全程扫描：球心只能往上走(球硬挂在投篮手上，往回掉就是姿势在打架)、
     手腕必须留在前臂末端、逐帧角速度不许炸。阈值取实测值 4.77°/步的 2 倍余量。 */
  motionSandbox.G.canShoot=false;motionSandbox.G.charging=true;
  let prevHand=null,prevBall=null,worstStep=0,ballDrops=0,wristOff=0,ballReach=0;
  const LIFT_STEPS=22;
  for(let i=0;i<=LIFT_STEPS;i++){
    motionApi.poseGuy(actor,curve(i/LIFT_STEPS),0);
    actor.g.updateMatrixWorld(true);
    const ball=actor.ballGrips[0].getWorldPosition(new THREE.Vector3());
    const handQ=actor.handRoots[0].getWorldQuaternion(new THREE.Quaternion());
    if(prevHand)worstStep=Math.max(worstStep,prevHand.angleTo(handQ)*180/Math.PI);
    if(prevBall&&ball.y<prevBall.y-1e-4)ballDrops++;
    actor.handRoots.forEach(hand=>{wristOff=Math.max(wristOff,Math.hypot(hand.position.x,hand.position.z));});
    ballReach=Math.max(ballReach,ball.z);
    prevHand=handQ;prevBall=ball;
  }
  if(worstStep>10)fail(`lift whips the shooting hand at ${worstStep.toFixed(1)}deg per step`);
  if(ballDrops)fail(`ball center dips ${ballDrops}x while the arm lifts`);
  if(wristOff>.02)fail(`wrist left the forearm end by ${wristOff.toFixed(3)} (no world-space IK on the hold phase)`);
  if(ballReach>.75)fail(`ball swings ${ballReach.toFixed(2)} in front of the body during the lift`);
  motionSandbox.G.charging=false;

  motionSandbox.G.charging=false;motionSandbox.G.canShoot=false;
  motionApi.poseGuy(actor,curve(0),0);
  const catchState={active:true,progress:1};
  motionApi.poseCatchHands(actor,catchState,0);
  const catchGuide=actor.arms[1].quaternion.clone();
  motionSandbox.G.canShoot=true;
  motionApi.poseGuy(actor,curve(0),0);
  const readyGuide=actor.arms[1].quaternion.clone();
  const catchGap=catchGuide.angleTo(readyGuide);
  const settleSeconds=parseFloat((/CATCH_SETTLE_SECONDS=([\d.]+)/.exec(sharedShotPose)||[])[1]);
  if(!(settleSeconds>0))fail("catch settle duration must be declared");
  const settleFrames=Math.ceil(settleSeconds*60);
  catchState.settling=true;catchState.settle=0;
  for(let i=0;i<Math.floor(settleFrames/2);i++){motionApi.poseGuy(actor,curve(0),0);motionApi.poseCatchHands(actor,catchState,1/60);}
  const midGap=actor.arms[1].quaternion.angleTo(readyGuide);
  for(let i=0;i<settleFrames;i++){motionApi.poseGuy(actor,curve(0),0);motionApi.poseCatchHands(actor,catchState,1/60);}
  const settledGap=actor.arms[1].quaternion.angleTo(readyGuide);
  if(midGap>=catchGap*.75||settledGap>.01||catchState.active)fail("catch-to-ready bridge must settle continuously instead of switching pose in one frame");

  /* 压腕必须晚于球脱手：ballGrip 在掌心前方 19cm，压腕会把球从掌上翻到掌下。
     两个常量必须对齐，否则球会在 release 前先掉下去。 */
  /* 传球飞行时长与 shots.js 的供球间隔预算必须同步，否则调快慢传球会连带改掉整关节奏。 */
  const rushPass=/PASS_FLIGHT_RUSH=Object\.freeze\(\{([^}]*)\}\)/.exec(sharedShotPose);
  if(!rushPass)fail("rack rush pass flight timing must be declared as PASS_FLIGHT_RUSH");
  else{
    const num=key=>parseFloat((new RegExp(key+":([\\d.]+)").exec(rushPass[1])||[])[1]);
    const mid=(num("min")+num("max"))/2;
    if(!(num("min")>=.3))fail(`rack rush pass flight ${num("min")}s is too fast to read`);
    if(Math.abs(num("budget")-mid)>.03)fail(`pass flight budget ${num("budget")} does not track the ${mid} midpoint`);
    if(!read("src/gameplay/shots.js").includes("PASS_FLIGHT_RUSH.budget"))
      fail("rack rush feed delay must derive its flight budget from PASS_FLIGHT_RUSH");
  }
  /* 出手跟随与接球必须叠加，二选一会把跟随姿势整个丢掉。 */
  if(!/if\(follow\.active\)applyFollowThroughPose/.test(shotMotionScript))
    fail("follow-through must keep posing while the catch reaches out");
  const wristDelay=/SHOT_WRIST_SNAP_DELAY=([\d.]+)/.exec(sharedShotPose);
  const ballReleaseAt=/BALL_RELEASE_AT=([\d.]+)/.exec(shotMotionScript);
  if(!wristDelay||!ballReleaseAt)fail("wrist-snap delay and ball release time must both be declared");
  else if(Math.abs(parseFloat(wristDelay[1])-parseFloat(ballReleaseAt[1]))>1e-6)
    fail(`wrist snap starts at ${wristDelay[1]} but the ball leaves at ${ballReleaseAt[1]}`);
  const releaseAt=parseFloat(ballReleaseAt[1]),extendSeconds=.105;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  /* 出手段扫描：球心必须一路升到脱手那一刻(= 从托着球的手掌直接送出去)，
     且脱手瞬间球仍在手腕上方、掌心还朝上托着，不能已经压到朝地。 */
  let releaseBallY=null,liftDrops=0,prevBallY=null,ballOverWrist=null,palmUpAtRelease=null;
  for(let age=0;age<=releaseAt+1e-9;age+=1/240){
    resetSet();
    motionApi.applyShotFollowThroughPose(actor,{active:true,extend:smooth(age/extendSeconds),recover:0,follow:1,age},motionApi.captureShotPose(actor));
    actor.g.updateMatrixWorld(true);
    const ball=actor.ballGrips[0].getWorldPosition(new THREE.Vector3());
    if(prevBallY!=null&&ball.y<prevBallY-1e-4)liftDrops++;
    prevBallY=ball.y;releaseBallY=ball.y;
    const wrist=actor.handRoots[0].getWorldPosition(new THREE.Vector3());
    ballOverWrist=ball.y-wrist.y;
    palmUpAtRelease=new THREE.Vector3(0,0,-1).applyQuaternion(actor.handRoots[0].getWorldQuaternion(new THREE.Quaternion())).y;
  }
  if(liftDrops)fail(`ball dips ${liftDrops}x before it leaves the hand`);
  if(releaseBallY<=setBall.y)fail(`release point ${releaseBallY.toFixed(3)} is not above the set point ${setBall.y.toFixed(3)}`);
  if(ballOverWrist<.08)fail(`ball sits ${ballOverWrist.toFixed(3)} above the wrist at release (wrist snapped too early)`);
  if(palmUpAtRelease<.5)fail(`palm already turned over at release (up component ${palmUpAtRelease.toFixed(2)})`);

  resetSet();
  const releasePose=motionApi.captureShotPose(actor);
  if(!releasePose||!releasePose.release.hand.aq)fail("release pose must capture the shooting hand in actor-local space");
  let midPalm=null,finalPalm=null,finalFinger=null,finalSide=null;
  for(const progress of [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]){
    resetSet();
    motionApi.applyShotFollowThroughPose(actor,{active:true,extend:progress,follow:progress,recover:0},releasePose);
    actor.g.updateMatrixWorld(true);
    const q=actor.handRoots[0].getWorldQuaternion(new THREE.Quaternion());
    const palm=new THREE.Vector3(0,0,-1).applyQuaternion(q);
    const finger=new THREE.Vector3(0,-1,0).applyQuaternion(q);
    const side=new THREE.Vector3(1,0,0).applyQuaternion(q);
    if(Math.abs(palm.x)>.31)fail(`wrist snap twists sideways at ${progress.toFixed(1)}: ${palm.x.toFixed(3)}`);
    if(palm.z<-.001)fail(`wrist snap must rotate through the hoop direction at ${progress.toFixed(1)}`);
    if(progress===.5)midPalm=palm;
    if(progress===1){finalPalm=palm;finalFinger=finger;finalSide=side;}
  }
  if(!midPalm||midPalm.z<.95||Math.abs(midPalm.x)>.15)fail("wrist snap midpoint must face the hoop without a side flip");
  if(!finalPalm||finalPalm.y>-.995||Math.abs(finalPalm.x)>.01||Math.abs(finalPalm.z)>.01)fail("follow-through palm must finish facing the ground");
  if(!finalFinger||finalFinger.z<.995)fail("follow-through fingers must finish pointing toward the hoop");
  if(!finalSide||finalSide.x<.995)fail("shooting thumb side must finish toward the guide hand");
}catch(e){fail("T-stage shot pose geometry check failed: "+e.message);}
for(const token of ['src/rendering/props.js?v=2.19-lastshot5','src/rendering/characters.js?v=2.19.3-tstage','src/rendering/camera.js?v=2.19.5-eyeline2','src/rendering/motion.js?v=2.19.6-hipfwd','src/gameplay/shots.js?v=2.19.5-hand-chain','src/modes/last-shot/squad.js?v=2.19.6-kit2','src/modes/last-shot/sequence.js?v=2.19.5-celeb3'])
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
for(const token of ["function attachShowBall","getWorldPosition(_showReleasePos)","function setAIShowActors","poseGuy(g,c,0)","G.myStar||show.o"])
  if(!presentationCinematics.includes(token))fail("contest opponent presentation fix missing "+token);
if(/applyShotSetPose\(g|tuneGuideHandPose\(g/.test(presentationCinematics))fail("contest presentation must not overwrite poseGuy hand transforms");
const presentationPregame=read("src/presentation/pregame.js");
for(const token of ['runtime.register("presentation:pregame"',"const PREGAME=","function startPreGameShow","function updPreGameShow"])
  if(!presentationPregame.includes(token))fail("presentation pregame token missing "+token);
for(const token of ["function pregameSmoothPose","pregameSmoothPose(a.guy,dt)","const dunkArc=","const hangRise=","PREGAME.poseCache.clear()"])
  if(!presentationPregame.includes(token))fail("pregame fluidity fix missing "+token);
const presentationBattle=read("src/presentation/battle.js");
for(const token of ['runtime.register("presentation:battle"',"function updBattleCut","function checkBattleOvertake","function battleScoreCallout"])
  if(!presentationBattle.includes(token))fail("presentation battle token missing "+token);
for(const token of ['src/rendering/effects.js?v=refactor27','src/presentation/cinematics.js?v=2.19.5-unify2','src/presentation/pregame.js?v=refactor29c','src/presentation/battle.js?v=refactor30'])
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
if(!gameplayShots.includes('G.mode!=="lastshot"&&!G.practice'))fail("Last Shot must bypass hero moment camera");
if(!renderingMotion.includes("G.passCatch={active:true,progress:0,target:catchP.clone()}")||
  !renderingMotion.includes("G.passCatch.active=k<1")||!renderingMotion.includes("G.passCatch.settling=true"))
  fail("shared pass must drive incoming catch and the catch-to-ready bridge");
if(!read("src/shot-motion.js").includes("poseCatchHands(player,catchState,dt)"))fail("shared shot loop must advance the catch settle bridge");
const lastShotSquad=read("src/modes/last-shot/squad.js");
for(const token of ["function startPostShot","function updatePostShot","function startReaction","poseWatcher","headTrack","REACTION_ALLY_MADE","REACTION_FOE_MADE"])
  if(!lastShotSquad.includes(token))fail("Last Shot post-shot reaction token missing "+token);
/* headRoot 的原点在球员局部 y≈0.203，头网格却在它局部 y=1.62：直接写 rotation
   会让头沿 1.39m 半径公转飞出身体(实测抬头 .58rad 漂 0.797m)。旋转后必须用
   pivotHead 把旋转中心搬回脖子，且常量要跟 characters.js 的 VOXEL_HEAD_PIVOT_Y 一致。 */
if(!lastShotSquad.includes("function pivotHead"))fail("Last Shot head rotation must re-pivot to the neck");
{
  const squadPivot=/HEAD_PIVOT_Y=([\d.]+)/.exec(lastShotSquad);
  const charPivot=/VOXEL_HEAD_PIVOT_Y=([\d.]+)/.exec(read("src/rendering/characters.js"));
  if(!squadPivot||!charPivot)fail("head pivot constants must be declared on both sides");
  else if(Math.abs(parseFloat(squadPivot[1])-parseFloat(charPivot[1]))>1e-6)
    fail(`Last Shot head pivot ${squadPivot[1]} does not match the rig pivot ${charPivot[1]}`);
  // 两条姿势路径(跑动编排 + 出手后反应)都必须收尾调用，否则只修好一半
  if((lastShotSquad.match(/pivotHead\(actor\.guy\)/g)||[]).length<2)
    fail("pivotHead must run on both the choreography and the post-shot pose paths");
}
/* 跑动摆幅必须由速度主导：原来站着不动也摆 0.28rad，全场看着像原地踏步。
   跑动速度必须取纯路径差分，用 actor.pos 差分会把 separate() 的推挤算成跑动。 */
if(/const swing=0\.28\+/.test(lastShotSquad))fail("idle actors must not keep swinging their legs");
if(!/actor\.speed=prev\?/.test(lastShotSquad))fail("runner speed must come from path sampling, not separated positions");
if(!lastShotSquad.includes("function poseDribble"))fail("the ball handler must actually dribble instead of holding a frozen ball");
/* 对位防守必须是"有延迟、有惯性"的追踪，不能再让防守人跟着手写路点与进攻人同频同步。
   DEF_ACCEL 是决定性的一个数：给太高会瞬间补掉感知延迟，重新退化成完美跟随。 */
for(const token of ["function steerTo","function trailAt","function recordTrail","function markTarget","function updateOnBall","function contestLevel"])
  if(!lastShotSquad.includes(token))fail("defensive tracking model missing "+token);
{
  const num=key=>{const m=new RegExp(key+"=([\\d.]+)").exec(lastShotSquad);return m?parseFloat(m[1]):NaN;};
  const react=num("DEF_REACTION"),accel=num("DEF_ACCEL"),markSpeed=num("DEF_MARK_SPEED"),closeout=num("DEF_CLOSEOUT_SPEED");
  if(!(react>=.18&&react<=.35))fail(`defender reaction ${react}s is outside the measured 0.2-0.3s window`);
  if(!(accel<=9))fail(`defender accel ${accel}m/s2 is high enough to erase the reaction delay (perfect tracking again)`);
  if(!(markSpeed<4.9))fail(`defender top speed ${markSpeed} must stay under the handler's 4.95m/s peak so crossovers create separation`);
  if(!(closeout>=4&&closeout<=7.5))fail(`closeout speed ${closeout} is outside the measured 4-7.5m/s range`);
  if(!/actor\.speed=steerTo\(actor,tgt\.x,tgt\.z/.test(lastShotSquad))
    fail("man-to-man defenders must steer toward the delayed read, not follow scripted waypoints");
}
// 冲刺庆祝不能是写死的对称双臂——那就是"双手交叉在胸前像叉车"
if(/action==="rush"\|\|action==="push"\)\{\s*guy\.arms\[0\]\.rotation\.x=-1\.12/.test(lastShotSquad))
  fail("charging celebration must not freeze both arms into the same crossed pose");
if(!lastShotSquad.includes("function poseContestJump"))fail("the on-ball defender must be able to jump and contest");
if(!lastShotSquad.includes("function poseBoxOut")||!lastShotSquad.includes("BOX_OUT_SPOTS"))
  fail("bigs must box out under the rim once the shot is up");
/* 盯你的人必须堵在你与篮筐之间(投篮路线上)。用"保持防守人当前方位角"靠近的写法
   会让他从哪边来就停在哪边，永远在侧面防守。 */
if(!/const spot=markTarget\(playerPos,gap\);/.test(lastShotSquad))
  fail("on-ball defender must close out onto the shooting line, not from whatever side he came");
if(/const tx=playerPos\.x\+dx\/d\*gap/.test(lastShotSquad))
  fail("on-ball closeout must not preserve the defender's current bearing");
// 持球拖延要有递增压迫：贴得更近 + 手举更高，否则"等很久也没人来"
if(!lastShotSquad.includes("function poseContestHands")||!/actor\.pressure=/.test(lastShotSquad))
  fail("holding the ball too long must ramp up on-ball pressure");
/* 跑动姿势全项目只能有一套：实现在 motion.js 的 poseRunCycle，
   步频必须由位移驱动(按 dt 推进相位会让腿和位移脱钩，脚在地上滑)。
   任何模块都不许再自己写一遍腿部循环。 */
{
  if(!renderingMotion.includes("function poseRunCycle"))
    fail("the shared run cycle must live in rendering/motion.js");
  if(!/state\.phase=\(state\.phase\|\|0\)\+\(speed\*dt\/stride\)\*Math\.PI;/.test(renderingMotion))
    fail("stride must be driven by distance travelled, not by elapsed time (foot sliding)");
  if(!/poseRunCycle\(actor\.guy,actor,speed,dt/.test(lastShotSquad))
    fail("Last Shot must reuse the shared run cycle");
  const cine=read("src/presentation/cinematics.js");
  if(!cine.includes("poseRunCycle("))fail("AI show must reuse the shared run cycle");
  if(/g\.legs\[0\]\.rotation\.x=sw\*0\.6/.test(cine))
    fail("AI show must not keep its own time-driven leg swing");
}
// 你出手时没人反应是最假的：近处大概率起跳，其余至少举手
if(!lastShotSquad.includes("CONTEST_JUMP_CHANCE")||!/actor\.handsUp/.test(lastShotSquad))
  fail("defenders must either jump or at least get a hand up when you shoot");
/* 手势安全：绝不允许"单臂接近伸直 + 斜前上方"。举手一律接近垂直，靠 rotation.z 挥动。
   guardArms 是运行时兜底，必须挂在两条姿势路径的收尾。 */
if(!lastShotSquad.includes("function guardArms")||(lastShotSquad.match(/guardArms\(actor\.guy\)/g)||[]).length<2)
  fail("arm-gesture safety guard must run on both pose paths");
for(const banned of ["arms[0].rotation.x=-1.85","arms[0].rotation.x=-1.34","arms[0].rotation.x=-1.52-.44"])
  if(lastShotSquad.includes(banned))fail("celebration must not raise a straight arm forward-diagonally: "+banned);
{
  const lift=/lift:-2\.72-Math\.random\(\)\*\.30/.test(lastShotSquad);
  if(!lift)fail("raised arms must stay near vertical");
  // 十个人不能一模一样：幅度/频率/惯用手都要有个体差异
  for(const key of ["style","amp:","rate:","swing:","hand:","both:","bias:"])
    if(!lastShotSquad.includes(key))fail("per-actor gesture variation missing "+key);
  /* 举手不能整条手臂绷直(小臂要有自然倾斜)，挥动的内摆要收着，否则手会扫进头里。 */
  if(!lastShotSquad.includes("function swingZ")||!lastShotSquad.includes("ARM_OUT"))
    fail("raised-arm swing must be biased outward so hands never clip the head");
  if(/elbows\[hand\]\.rotation\.x=-\.(1|2|3)\d/.test(lastShotSquad))
    fail("celebration elbows must stay bent (a locked-straight arm looks rigid)");
}
{
  const seq=read("src/modes/last-shot/sequence.js");
  /* 结果一定下来就反应，不能等球在地上弹完才开始庆祝/懊恼。 */
  if(!seq.includes("function ballSettled")||!/ballSettled\(activeBall\)/.test(seq))
    fail("reactions must fire the moment the result is decided, not after the ball stops bouncing");
  if(/!LS\.reactionStarted&&!activeBall&&/.test(seq))
    fail("miss reaction must not wait for the ball to be removed");
}
// 打铁时离篮筐最近的两人必须去抢板，球在空中时也要有人跟进
if(!lastShotSquad.includes("boarders")||!lastShotSquad.includes("function poseTrailIn"))
  fail("a miss must send the two nearest players after the rebound, and others should trail in");
{
  const seq=read("src/modes/last-shot/sequence.js");
  // 出手后比赛钟必须继续走
  if(/if\(!LS\.released\)updClock\(clock\)/.test(seq))fail("game clock must keep running after the release");
  if(!/FOUL_CHANCE/.test(seq)||!/andOne/.test(seq))fail("shooting fouls (3 shots / and-one) must be possible");
  /* 第一人称相机高度：FP_RISE 与 FP_BALL_DUCK 是一对耦合参数，
     举球到位的最终高度 = EYE + FP_RISE - FP_BALL_DUCK 必须保持 1.60m(既有投篮取景)。
     FP_RISE 过大(曾经 0.28 → 相机 2.06m)会高过防守人头顶，投完只能看到对方头发，
     接球时投篮手也被压出画面下缘。 */
  {
    const cam=read("src/rendering/camera.js");
    const rise=/FP_RISE=([\d.]+)/.exec(cam),duck=/FP_BALL_DUCK=([\d.]+)/.exec(cam);
    if(!rise||!duck)fail("first-person camera height constants must be declared");
    else{
      const r=parseFloat(rise[1]),k=parseFloat(duck[1]),EYE=1.78;
      if(r>.12)fail(`FP_RISE ${r} puts the camera above defenders' heads (only their hair is visible)`);
      const shotY=EYE+r-k;
      if(Math.abs(shotY-1.60)>.03)fail(`raised-ball camera height ${shotY.toFixed(2)} drifted from the tuned 1.60m`);
    }
    if(/fpRise-=clamp\(\(rel\+0\.25\)\/0\.45/.test(cam))
      fail("the duck curve must engage while the ball is still at waist height, not only near eye level");
    if(!/rig\.pos\.set\(eye\.x-dir\.x\*0\.85,eye\.y\+\(typeof FP_RISE/.test(read("src/modes/last-shot/sequence.js")))
      fail("Last Shot watch camera must share FP_RISE instead of hardcoding its own lift");
  }
  /* 竖屏必须按 Hor+ 补偿视野。THREE 的 fov 是垂直视角，竖屏(aspect≈0.46)时
     垂直 68° 只换算出 35° 的水平视角，贴脸的防守人会糊满半屏、自己的手被挤出画面。 */
  {
    const core=read("src/rendering/core.js");
    if(!core.includes("function fovForAspect")||!/camera\.fov=fovForAspect/.test(core))
      fail("portrait must widen the vertical fov to keep a usable horizontal FOV (Hor+)");
    const maxV=/MAX_VFOV=(\d+)/.exec(core);
    if(!maxV)fail("the vertical fov cap must be declared");
    else{
      const m=parseInt(maxV[1],10);
      if(m<80)fail(`MAX_VFOV ${m} is too tight — portrait horizontal FOV stays cramped`);
      if(m>95)fail(`MAX_VFOV ${m} distorts perspective in portrait`);
    }
    // 横屏不能被改宽：宽屏下仍是原来的 68° 垂直视角
    if(!/Math\.max\(BASE_VFOV,/.test(core))
      fail("landscape must keep the original 68deg vertical fov");
  }
  /* 球一到手身体必须朝篮筐。传球结束后 LS.pass 被清空，如果朝向目标退回"看持球人"，
     身体会转向左路的核心，投篮手和球被甩出画面左侧(实测腕 NDC x=-1.27、球 -1.50)。 */
  {
    const seq=read("src/modes/last-shot/sequence.js");
    if(!/const inHand=G\.canShoot&&!LS\.released;/.test(seq))
      fail("body orientation must know when the ball is in hand");
    if(!/const target=\(inHand\|\|!handler\)\?V3\(HOOP\.x/.test(seq))
      fail("once the ball is in hand the player must square up to the hoop, not keep facing the handler");
  }
  // 第一人称等球时要有碎步与镜头起伏，且出手前收住
  if(!/LS\.footT/.test(seq)||!/LS\.spot/.test(seq))fail("first-person must shuffle its feet while waiting for the pass");
}
/* 封盖必须由"你起跳"触发，不能用持球秒表——起跳到出手只有 0.19s，
   任何时间阈值都永远等不到，结果就是从不封盖。 */
if(!lastShotSquad.includes("function triggerContest"))fail("contest must be triggered by the player's jump");
if(!/contestPending=\.08\+Math\.random\(\)\*\.20/.test(lastShotSquad))
  fail("defender must jump after a randomised visual-reaction delay");
if(/chargeT\|\|0\)>=CONTEST_JUMP_AT/.test(lastShotSquad))
  fail("contest must not depend on a hold-time threshold the player never reaches");
/* 身高：每个位置不能一样高，且缩放必须参与触地计算，否则高个会陷进地板。 */
{
  const cfgSrc=read("src/modes/last-shot/config.js");
  const hs=[...cfgSrc.matchAll(/height:([\d.]+)/g)].map(m=>parseFloat(m[1]));
  if(hs.length<9)fail(`every actor needs a height, found ${hs.length}`);
  else{
    const spread=Math.max(...hs)-Math.min(...hs);
    if(spread<.15)fail(`height spread ${spread.toFixed(2)} is too flat — guards and centers must differ`);
    if(new Set(hs).size<6)fail("too many actors share the exact same height");
  }
  if(!/footY\*hs/.test(renderingMotion))fail("foot contact must scale with actor height");
  if(!/1\.62\*\(actor\.hs\|\|1\)/.test(lastShotSquad))fail("head height must scale with actor height");
  if(!/hs=cfg\.hs\|\|1/.test(renderingMotion))fail("shared run cycle must accept a height scale");
}
/* 反应阶段:视线各看各的(不再统一锁篮筐),且任何有位移的反应都必须走 poseRunner——
   只改 pos 不摆腿就是"没有走路动作自己飘过来"。 */
if(!lastShotSquad.includes("REACTION_META"))fail("each reaction must declare its own gaze/move target");
if(!/poseRunner\(actor,moved,dt/.test(lastShotSquad))fail("moving reactions must run their legs instead of sliding");
if(!/function poseWatcher\(actor,dt,target,faceTarget\)/.test(lastShotSquad))
  fail("poseWatcher must take an explicit face target instead of always turning to the hoop");
if(/const want=faceTo\(actor\.pos,HOOP\);/.test(lastShotSquad))
  fail("post-shot body orientation must not be hard-locked to the hoop");
// 运球手与球必须同侧:arms[0] 建在 -X 侧
if(!lastShotSquad.includes("actor.dribbleHand")||!lastShotSquad.includes("side*0.32"))
  fail("dribble must switch hands on direction changes and keep the ball on the dribbling side");
{
  const cfgSrc=read("src/modes/last-shot/config.js");
  const handler=/ally0:\{role:"handler",[^[]*path:\[([^\]]*)\]\}/.exec(cfgSrc);
  if(!handler)fail("last shot handler path must be declared");
  else{
    const pts=[...handler[1].matchAll(/wp\(([-\d.]+),([-\d.]+),([-\d.]+)\)/g)]
      .map(m=>({t:parseFloat(m[1]),x:parseFloat(m[2]),z:parseFloat(m[3])}));
    if(pts.length<6)fail(`handler drive needs direction changes, only ${pts.length} waypoints`);
    let dist=0;for(let i=1;i<pts.length;i++)dist+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
    const avg=dist/(pts[pts.length-1].t-pts[0].t);
    if(avg<2)fail(`handler averages ${avg.toFixed(2)}m/s — too slow for the final seconds`);
  }
}
const lastShotSequence=read("src/modes/last-shot/sequence.js");
for(const token of ["G.passCatch={active:true,progress:0,target:to.clone()}","G.passCatch.settling=true","squadApi.startPostShot()","squadApi.updatePostShot","squadApi.startReaction","reactionT>=3.6"])
  if(!lastShotSequence.includes(token))fail("Last Shot catch/reaction lifecycle token missing "+token);
/* 结果已定(进网/砸框/开始弹跳/掉到筐下)之后不能再让全场用眼睛跟球，
   否则十个人会跟着球在地上反复点头(实测 5 次上下点头，最后低头看地)。 */
if(!lastShotSequence.includes("function gazeTarget"))fail("Last Shot gaze must stop tracking the ball once the result is settled");
if(!/squadApi\.updatePostShot\(dt,gazeTarget\(/.test(lastShotSequence))
  fail("post-shot gaze must go through gazeTarget instead of the raw ball position");
for(const token of ["ball.made","ball.rimSoundPlayed","ball.bounces>0",'ball.phase!=="fly"'])
  if(!lastShotSequence.includes(token))fail("gaze release condition missing "+token);
/* 绝不能拿"球低于篮筐高度"当结果已定的判据：出手点才 2.1m、篮筐 3.05m，
   球一离手就满足，全场会在你刚出手时就开始庆祝。 */
if(/position\.y<=HOOP\.y/.test(lastShotSequence))
  fail("ball-settled must not test against hoop height (the release point is already below it)");
/* 庆祝只有两个启动点：进球后 CELEBRATE_DELAY，或时间走完。 */
if(!lastShotSequence.includes("CELEBRATE_DELAY")||!lastShotSequence.includes("BUZZER_DELAY"))
  fail("celebration must trigger only on a make (after a delay) or on the buzzer");
/* 时间到但球还在空中，不能直接判负——出手在结束前、球进了就算。 */
if(!/clock<=0&&\(!activeBall\|\|ballSettled\(activeBall\)\)/.test(lastShotSequence))
  fail("buzzer must wait for a ball still in flight instead of ruling it a loss");
/* 篮板球权：防守方大概率保护篮板；我方抢到只能补篮且必定不进。 */
if(!lastShotSquad.includes("DEF_REBOUND_RATE")||!lastShotSquad.includes("rb.winner"))
  fail("rebound possession must be decided, not just a footrace");
if(!lastShotSequence.includes("startPutback")||!lastShotSequence.includes("startOutlet"))
  fail("a secured rebound must lead to a putback or an outlet pass");
/* 犯规门槛必须用"最近防守人距离"，不能用 contestLevel——后者在 1.9m 之外恒为 0，
   拿它当门槛等于果断出手永远不可能被犯规(实测名义 33% 实际只有 13%，玩家连打
   10 盘一次都碰不到)。同时保留 TEST/LIVE 两档，上线前切回 LIVE。 */
if(!lastShotSquad.includes("function defenderDistance"))
  fail("squad must expose the nearest-defender distance for foul gating");
if(!/foulDist<=FOUL_RANGE&&Math\.random\(\)<FOUL_CHANCE/.test(lastShotSequence))
  fail("fouls must be gated by defender distance, not by contestLevel");
if(/level>=\.5&&Math\.random\(\)<FOUL_CHANCE/.test(lastShotSequence))
  fail("contestLevel is zero beyond 1.9m — gating fouls on it makes them nearly unreachable");
for(const token of ["FOUL_CHANCE_TEST","FOUL_CHANCE_LIVE","FOUL_RANGE"])
  if(!lastShotSequence.includes(token))fail("foul tuning constant missing "+token);
/* 罚球必须由玩家自己投，不能拿概率算掉。 */
for(const token of ["function beginFreeThrows","function nextFreeThrow","function updateFreeThrows",'LS.phase==="freethrow"'])
  if(!lastShotSequence.includes(token))fail("free throws must be shot by the player: "+token);
if(/for\(let i=0;i<shots;i\+\+\)if\(Math\.random\(\)<FT_RATE\)hit\+\+/.test(lastShotSequence))
  fail("free throws must not be auto-resolved by probability");
if(!lastShotSquad.includes("function lineUpForFreeThrow"))fail("players must line the lane for free throws");
/* 罚球必须能收尾：最后一罚落定后要调用 finishFreeThrows，
   否则整个模式永远卡在罚球阶段(曾经就是这样，罚完没有任何后续)。 */
if(!/if\(f\.taken<f\.shots\)nextFreeThrow\(\);\s*else finishFreeThrows\(\);/.test(lastShotSequence))
  fail("the last free throw must fall through to finishFreeThrows");
if(/!LS\.ftBall&&f\.taken<f\.shots\)\{/.test(lastShotSequence))
  fail("free-throw loop must not strand itself once all attempts are taken");
/* 罚球站位按规则排：禁区两侧 3 防守 + 2 进攻穿插，其余退到三分线外。 */
{
  const lane=/const FT_LANE=\[([\s\S]*?)\];/.exec(lastShotSquad);
  if(!lane)fail("free-throw lane slots must be declared");
  else{
    const defs=(lane[1].match(/def:true/g)||[]).length;
    const offs=(lane[1].match(/def:false/g)||[]).length;
    if(defs!==3||offs!==2)fail(`lane must hold 3 defenders and 2 offensive players, got ${defs}/${offs}`);
  }
  if(!lastShotSquad.includes("FT_ARC"))fail("everyone else must clear out beyond the arc");
}
/* 体感在绝杀模式里也要能自动启动——原来只认难度选择界面。 */
{
  const vision=read("src/vision.js");
  if(!vision.includes("VISION_AUTO_STATES")||!/lastshot:true/.test(vision))
    fail("motion control must be able to auto-start in Last Shot, not only on the difficulty screen");
  if(/G\.state!=="diff"\|\|visionPreferenceQueued/.test(vision))
    fail("vision auto-start must not be hard-gated to the difficulty screen");
  /* 绝杀模式的开始界面必须和其他模式一样给出控制模式选择。
     visionModeMarkup() 既是那两个按钮，也是 restoreVisionControlPreference() 的唯一触发点——
     不插它就等于既没有选项、也永远不会自动拉起摄像头。 */
  const lastShotIndex=read("src/modes/last-shot/index.js");
  if(!lastShotIndex.includes("visionModeMarkup"))
    fail("Last Shot start panel must offer the touch/motion control picker like every other mode");
  /* 没进要告诉玩家怎么调整，不能只说一句"偏了"；正式挑战用完要有去处。 */
  for(const token of ["function missAdvice","function practiceCta","蓄力严重不足","出手时机没问题"])
    if(!lastShotIndex.includes(token))fail("a miss must explain how to adjust: "+token);
  for(const mode of ["rackrush","battle","contest"])
    if(!lastShotIndex.includes(`goDiff('${mode}')`))fail("result panel must route to "+mode+" for practice");
  if(!read("src/modes/last-shot/sequence.js").includes("LS.diag="))
    fail("release must record diagnostics (power error / contest) for the post-game advice");
  /* err 是 releasePower 扣减晚出手惩罚之后的数，蓄太久也可能被扣成 err<0，
     看起来像"蓄力不足"——方向刚好反了。late(扣减前的原始信号)必须比 err 优先判断，
     且要在扣减发生之前捕获，否则读到的已经是被污染的值。 */
  const physics=read("src/shot-physics.js");
  if(!physics.includes("function lastLate")||!physics.includes("lastLate}"))
    fail("shot physics must expose the pre-penalty late signal for diagnostics");
  const motion=read("src/shot-motion.js");
  if(!/G\.lastReleaseLate=AIBAShotPhysics\.lastLate[\s\S]{0,40}\n\s*const adj=AIBAShotPhysics\.releasePower/.test(motion))
    fail("late must be captured before releasePower applies its penalty");
  const lsIndex=read("src/modes/last-shot/index.js");
  if(!/if\(late>\.02\)\{/.test(lsIndex))
    fail("missAdvice must check the late-release signal before falling back to power-error sign");
  const lateIdx=lsIndex.indexOf("if(late>.02){"),inZoneIdx=lsIndex.indexOf("const inZone=Math.abs(err)");
  if(lateIdx<0||inZoneIdx<0||lateIdx>inZoneIdx)
    fail("the late-release branch must run before the power-error branches, not after");
}
// 速度不能全是固定值，每个人要有自己的快慢
if(!/pace:\.86\+Math\.random/.test(lastShotSquad)||!/pace\(actor\)/.test(lastShotSquad))
  fail("movement speeds must vary per actor instead of reading like a script");
if(!lastShotSequence.includes("squadApi.startRebound"))fail("a miss must kick off a rebound scramble");
if(!lastShotSquad.includes("function poseRebound")||!lastShotSquad.includes("reboundJump"))
  fail("players must chase and jump for the rebound");
// 最后 5 秒要有倒计时音
if(!/clock<=5&&clock>0/.test(lastShotSequence))fail("final 5 seconds need an audible countdown");
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
for(const token of ['src/gameplay/shots.js?v=2.19.5-hand-chain','src/presentation/replay.js?v=2.15.5-hand-follow','src/ui/battle-controls.js?v=refactor33b','src/gameplay/collisions.js?v=refactor34','src/presentation/win-cinematic.js?v=2.15.5-hand-follow','src/core/input.js?v=2.19-lastshot5','src/core/game-loop.js?v=2.19-lastshot5','src/core/scene-init.js?v=refactor38'])
  if(!entryHtml.includes(token))fail("next entry missing runtime-core module "+token);
for(const token of ["function startCharge(","function updBalls(","function startReplay(","function buildSpotDots(","function ballCollide(","function startWinCine(","function onDown(","function animate(","buildCourt();"])
  if(entryHtml.includes(token))fail("next entry still contains inline runtime core "+token);
if(!(entryHtml.indexOf('src/core/input.js?v=2.19-lastshot5')<entryHtml.indexOf('src/core/legacy-adapter.js?v=2.18.5-shared-ai-shot')))fail("input must load before legacy adapter");
if(!(entryHtml.indexOf('src/core/scene-init.js?v=refactor38')<entryHtml.indexOf('src/core/legacy-adapter.js?v=2.18.5-shared-ai-shot')))fail("scene init must load before legacy adapter");

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

/* ---------------- 你自己的庆祝 & 反应阶段防穿模 ---------------- */
{
  const seq=read("src/modes/last-shot/sequence.js");
  const squad=read("src/modes/last-shot/squad.js");
  /* 全场进入反应的每一个入口，你自己也必须跟着庆祝/懊恼。
     漏掉任何一个入口，就会出现"十个人在庆祝，只有你像根木桩"。 */
  const reactionSites=(seq.match(/squadApi\.startReaction\(/g)||[]).length;
  const celebSites=(seq.match(/startPlayerCelebrate\(/g)||[]).length;
  if(reactionSites===0)fail("Last Shot must start a squad reaction");
  if(celebSites<reactionSites+1)   // +1 是函数定义本身
    fail(`every startReaction must also start your own celebration (${reactionSites} reactions / ${celebSites-1} celebrations)`);
  /* 姿势必须写满三个轴。投篮链路会在肩上留下 rotation.y，只改 x/z 的话残留会一直挂着，
     第一人称里两只手一高一低、一个朝上一个朝右。 */
  if(!/guy\.arms\[i\]\.rotation\.set\(/.test(seq)||!/guy\.elbows\[i\]\.rotation\.set\(/.test(seq))
    fail("celebration arm pose must write all three rotation axes (a stale rotation.y desyncs both hands)");
  // 手腕也要拉回中立帧，否则还保持着压腕的投篮手型
  if(!/poseHandJoints\(guy,/.test(seq))
    fail("celebration must reset the wrist to a neutral frame");
  // 举手姿势同样要过场上那套敏感手势守卫
  if(!/squadApi\.guardArms\(guy\)/.test(seq))
    fail("your own celebration must go through the shared gesture guard");
  // 推搡必须挂在队友真的挤过来那一刻，不能是定时器假装的
  if(!/squadApi\.nearestMate\(/.test(seq))
    fail("the shove must be triggered by a team-mate actually arriving, not a timer");
  /* 反应阶段没有战术站位约束，必须跑一次最小间距推开：
     不然罚球失败后对方一拥而上，人直接穿进你和彼此身体里。 */
  if(!/if\(reaction\)separate\(/.test(squad))
    fail("the reaction phase must run the separation pass (celebrating players otherwise clip through each other)");
  // 冲过来的人和抢球的人都要有各自的落点，不能共用同一个点
  /* 落点必须按编号改"方向"，只改半径等于排成一列往你身上挤，还是会互相顶。 */
  const mobBody=squad.slice(squad.indexOf("function mobTarget"),squad.indexOf("function poseReaction"));
  if(!mobBody||!/mobSlot/.test(mobBody)||!mobBody.split("\n").some(l=>/mobSlot/.test(l)&&/ang/.test(l)))
    fail("mobbing team-mates must fan out by bearing instead of stacking on one point");
  if(!/actor\.rimSlot/.test(squad))fail("the two rebounders must split left/right instead of pressing into each other");
}

/* ---------------- 接球前倾 ---------------- */
{
  const m=read("src/rendering/motion.js");
  /* 这个骨架里 g.rotation.x 的正号是【后仰】（实测 +0.175 时头往后 3.8cm）。
     前倾必须用负号 —— 第一版写成 +0.175，画面上就是往后倒。 */
  if(!/const CATCH_HIP_LEAN=-0\.175;/.test(m))
    fail("接球前倾应为 -0.175（负号=前倾，正号是后仰）");
  if(!/const catchLean=CATCH_HIP_LEAN\*\(c\.hold\|\|0\)\*\(1-ease01\(c\.lift\)\);/.test(m))
    fail("接球前倾必须随 lift 平滑归零，否则会改掉最高点姿势");
  /* 蓄力项同样翻成前倾。原来是 +0.12*load，注释写着"上身前倾"但实际在后仰。 */
  if(!/o\.g\.rotation\.x=catchLean - 0\.12\*load - 0\.06\*c\.over - 0\.03\*c\.jmp \+ 0\.08\*land;/.test(m))
    fail("躯干角必须是 catchLean - 0.12*load（蓄力也前倾），且 over/jmp/land 三项保持原样");
  if(/0\.g\.rotation\.y\+=twist|catchTurnAmount/.test(m))
    fail("绕垂直轴转体那一版是理解错的，应已移除");
  if(!/holdLean\+=\(want-holdLean\)\*Math\.min\(1,\(dt\|\|0\.016\)\*CATCH_LEAN_RATE\)/.test(m))
    fail("接球前倾必须做平滑，不能在 canShoot 翻转那一帧硬切");
  /* updPose 有两条实现，shot-motion.js 那条才是当前生效的。
     只改 motion.js 的话画面上完全没有反应（第一次就踩了这个坑）。 */
  if(!/c\.hold=updateHoldLean\(dt\)/.test(read("src/shot-motion.js")))
    fail("生效的 updPose(shot-motion.js) 也必须写入 c.hold");
  // 下半身不动：屈膝链路仍由 load 驱动
  if(!/const kneeBase=Math\.max\(0,0\.98\*load/.test(m))
    fail("下半身屈膝链路不应被接球前倾改动");
}

/* ---------------- 绝杀时刻队服 ---------------- */
{
  const sq=read("src/modes/last-shot/squad.js");
  /* 队友必须跟玩家同色、对手必须拉开色差。之前是写死的 config 颜色：
     玩家近黑 #11151c、对手深蓝灰 #2c3550（几乎同色）、队友白 —— 分不清敌我，
     打铁后冲上来挑衅的对手会被当成自己人在庆祝。 */
  if(!/function playerKit\(cfg\)/.test(sq)||!/player&&player\.mJ&&player\.mJ\.color/.test(sq))
    fail("队友球衣必须取玩家自己的球衣色");
  // 注意别用 /MIN_KIT_DELTA/ 这种子串匹配：改名成 MIN_KIT_DELTA_X 也能匹配上，抓不到
  if(!/function foeKit\(allyJersey\)/.test(sq)||!/bestD<MIN_KIT_DELTA\b/.test(sq))
    fail("对手球衣必须按色差挑选并保证最小色差");
  /* build() 带缓存（阵容只建一次）。只在创建时染色的话，玩家中途换角色，
     队友还会穿上一次的颜色 —— 实测换 8 个角色队友一直停在第一个色。 */
  if(!/if\(squad\)\{dressSquad\(cfg\);return squad;\}/.test(sq))
    fail("复用已建阵容时必须重刷队服，否则换角色后队友仍是旧色");
  if(!/function dressSquad\(cfg\)/.test(sq))fail("队服染色应收敛到 dressSquad()");
}
