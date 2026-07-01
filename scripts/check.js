#!/usr/bin/env node
"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.resolve(__dirname,"..");
const entry="index.html";
const snapshot="block-3pt-kingv1.44-hd-voxel-player.html";
const requiredFiles=[
  entry,
  snapshot,
  "styles.css",
  "src/assets-manifest.js",
  "src/audio.js",
  "src/vision.js",
  "vendor/three.min.r128.js",
  "assets/aiba-vision/pose_landmarker_lite.task",
  "assets/aiba-vision/hand_landmarker.task"
];

function read(rel){return fs.readFileSync(path.join(root,rel),"utf8");}
function exists(rel){return fs.existsSync(path.join(root,rel));}
function fail(msg){console.error("check failed:",msg);process.exit(1);}

for(const file of requiredFiles){
  if(!exists(file))fail("missing required file "+file);
}

const entryHtml=read(entry);
const snapshotHtml=read(snapshot);
if(entryHtml!==snapshotHtml)fail(entry+" and "+snapshot+" differ");
if(/^(<<<<<<<|=======|>>>>>>>)$/m.test(entryHtml))fail("conflict marker in html");
if(!entryHtml.includes('<link rel="stylesheet" href="styles.css">'))fail("stylesheet link missing");
if(!entryHtml.includes('<script src="src/assets-manifest.js"></script>'))fail("assets manifest script missing");
if(!entryHtml.includes('<script src="src/audio.js"></script>'))fail("audio script missing");
if(!entryHtml.includes('<script src="src/vision.js"></script>'))fail("vision script missing");
if(/<style>[\s\S]*?<\/style>/.test(entryHtml))fail("inline style block should stay split out");
if(/const COVER_STARS=\[/.test(entryHtml)||/const EXT_AUDIO=\{/.test(entryHtml))fail("asset manifest data leaked back into html");

const inlineScripts=[...entryHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(s=>s.trim());
for(const [i,script] of inlineScripts.entries()){
  try{new Function(script);}
  catch(e){fail("inline script "+i+" syntax error: "+e.message);}
}

const manifest=read("src/assets-manifest.js");
try{new Function(read("src/audio.js"));}
catch(e){fail("audio script syntax error: "+e.message);}
const vision=read("src/vision.js");
try{new Function(vision);}
catch(e){fail("vision script syntax error: "+e.message);}
if(vision.includes('import("./vendor/'))fail("vision module import path should be relative from src/");

const sandbox={window:{}};
vm.createContext(sandbox);
try{vm.runInContext(manifest,sandbox,{filename:"src/assets-manifest.js"});}
catch(e){fail("assets manifest syntax error: "+e.message);}
const assets=sandbox.window.AIBA_ASSETS;
if(!assets)fail("AIBA_ASSETS missing");
if(!Array.isArray(assets.coverStars)||assets.coverStars.length!==5)fail("coverStars should have 5 entries");
for(const star of assets.coverStars){
  if(!star.id||!star.cover||!star.coverVideo)fail("cover star missing fields");
  if(!exists(star.cover))fail("missing cover image "+star.cover);
  if(!exists(star.coverVideo))fail("missing cover video "+star.coverVideo);
}
for(const key of ["bgm","crowd","crowdCheer","rain","ocean","gull"]){
  const rel=assets.audio&&assets.audio[key];
  if(!rel)fail("audio key missing "+key);
  if(!exists(rel))fail("missing audio file "+rel);
}

console.log("check ok:",inlineScripts.length+" inline scripts,",assets.coverStars.length+" cover stars");
