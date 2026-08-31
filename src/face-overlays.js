/* ---------------- retired special face overlays ----------------
   特殊脸部贴图方案已停用。保留一个空 API 只是为了兼容旧调用方，当前角色一律
   使用 rendering/characters.js 的程序化基础脸，不再按球员名称加载任何贴图。 */
(function(global){
  "use strict";
  function pathFor(){return "";}
  function apply(){return false;}
  global.AIBAFaceOverlays=Object.freeze({apply,pathFor});
})(window);
