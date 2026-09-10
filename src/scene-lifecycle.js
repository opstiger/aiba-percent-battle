/* Progressive court lifecycle: reset a run without rebuilding the whole venue. */
(function(global){
  "use strict";

  function resetFlowerLayer(layer){
    if(!layer)return;
    layer.target=0;
    if(Array.isArray(layer.data))layer.data.forEach(item=>{item.grow=0;});
    [layer.stems,layer.petals,layer.centers].forEach(mesh=>{if(mesh)mesh.count=0;});
  }

  function resetFlower(){
    const state=environmentRoot&&environmentRoot.userData&&environmentRoot.userData.flowerState;
    if(!state)return false;
    state.revealProgress=0;state.pulse=0;state.visible=0;state.structureVisible=0;
    resetFlowerLayer(state.ground);resetFlowerLayer(state.structure);
    if(state.grassMat&&state.grassStart)state.grassMat.color.copy(state.grassStart);
    if(Array.isArray(state.bloomMaterials))state.bloomMaterials.forEach(mat=>{mat.emissiveIntensity=0;});
    document.documentElement.dataset.flowerCount="0";
    document.documentElement.dataset.flowerGround="0";
    document.documentElement.dataset.flowerStructure="0";
    document.documentElement.dataset.weedCount=String(state.weedTotal||0);
    return true;
  }

  function resetBeach(){
    const state=environmentRoot&&environmentRoot.userData&&environmentRoot.userData.beachState;
    if(!state)return false;
    state.time=0;state.finalBoost=0;state.nextGull=6;
    if(Array.isArray(state.gulls)){
      state.gulls.forEach(gull=>environmentRoot.remove(gull));
      state.gulls.length=0;
    }
    if(Array.isArray(state.waves))state.waves.forEach((wave,i)=>{wave.position.z=-23-i*3.7;});
    updateBeachSunset(0,0);
    document.documentElement.dataset.environmentPhase="golden";
    return true;
  }

  function resetForRun(){
    const preset=SCENE_PRESETS[currentScenePreset];
    if(!preset||preset.progression==="none")return true;
    let reset=false;
    if(preset.progression==="flowerBloom")reset=resetFlower();
    else if(preset.progression==="sunsetToNight")reset=resetBeach();
    if(!reset){applyScenePreset(currentScenePreset,{persist:false});return false;}
    environmentRoot.userData.progress=0;
    return true;
  }

  global.AIBASceneLifecycle=Object.freeze({resetForRun,resetFlower,resetBeach});
})(window);
