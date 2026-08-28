/* ---------------- boot ---------------- */
buildCourt();
const seatList=buildStands();
buildCeiling();          // 球馆顶棚:原来相机一仰是 34% 的纯黑空洞
buildBackcourtShow();
buildCrowd(seatList);
buildNearCourtCrowd();
buildHoop();
buildAtmos();
buildRacks();
buildHands();
buildCharacters();
buildSpotDots();
applyScenePreset(currentScenePreset,{persist:false});
applyCamMode();
handBall.visible=false;

window.AIBA.runtime.register("core:scene-init",Object.freeze({initialized:true}));

