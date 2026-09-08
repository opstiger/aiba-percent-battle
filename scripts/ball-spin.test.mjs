/* Pure math + real Three r128 regression. No browser, audio or scoring writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'vendor/three.min.r128.js'),'utf8'),context);
const src=fs.readFileSync(path.join(root,'src/gameplay/shots.js'),'utf8');
vm.runInContext(src.slice(0,src.indexOf('const BALL_FLOOR_PHYSICS')),context);
const {THREE}=context,up=new THREE.Vector3(0,1,0);
let cases=0;
for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*1.9]){
 for(const parentYaw of [0,.83]){
  const parent=new THREE.Group();parent.rotation.set(.12,parentYaw,-.1);
  const mesh=new THREE.Object3D();mesh.rotation.set(.48,.29,-.77);parent.add(mesh);
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const b={mesh,v0:fwd.clone().multiplyScalar(6),vel:fwd.clone(),backspin:1,sideSpin:0};
  const q0=mesh.getWorldQuaternion(new THREE.Quaternion());
  const marker=up.clone().applyQuaternion(q0.clone().invert());
  context.spinBall(b,1e-4,1);
  const top=marker.applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  assert(top.sub(up).dot(fwd)<-1e-5,'ball top must move back toward shooter');
  assert(b.spinOmega.clone().cross(up).dot(fwd)<0,'world axis must be backspin');
  const axisBefore=b.spinOmega.clone();b.vel.negate();context.spinBall(b,.01,.42);
  assert(b.spinOmega.equals(axisBefore),'airborne rebound must not replace release spin');
  cases++;
 }
}
const outcomes=[];
for(const fps of [30,60,120]){
 const b={mesh:new THREE.Object3D(),v0:new THREE.Vector3(3,5,-6),backspin:1,sideSpin:.3};
 for(let i=0;i<fps;i++)context.spinBall(b,1/fps,1);
 outcomes.push(b.mesh.quaternion);
}
for(const q of outcomes)assert(1-Math.abs(q.dot(outcomes[0]))<1e-10,'frame rate invariant');
const rolling={mesh:new THREE.Object3D(),vel:new THREE.Vector3(2,0,-3)};
context.rollBall(rolling,.01);
assert(rolling._rollOmega.clone().cross(new THREE.Vector3(0,-.16,0)).add(rolling.vel).length()<1e-9,'rolling contact velocity zero');
const zero={mesh:new THREE.Object3D(),v0:new THREE.Vector3()};
context.spinBall(zero,.02);assert(Number.isFinite(zero.mesh.quaternion.w));
const stopped=zero.mesh.quaternion.clone();context.spinBall(zero,.1,0);context.spinBall(zero,-1,1);
assert(zero.mesh.quaternion.equals(stopped),'zero damping and negative dt cannot rotate');
const playback={mesh:new THREE.Object3D(),v0:new THREE.Vector3(-3,4,-6),sideSpin:0,backspin:.7};
context.poseBallSpinAtTime(playback,.43);const fixed=playback.mesh.quaternion.clone();
context.poseBallSpinAtTime(playback,.9);context.poseBallSpinAtTime(playback,.43);
assert(1-Math.abs(playback.mesh.quaternion.dot(fixed))<1e-12,'replay seek is deterministic');
context.poseBallSpinAtTime(playback,0);assert(playback.mesh.quaternion.equals(new THREE.Quaternion()),'replay photo freeze');
console.log(`PASS ball-spin: ${cases} heading/parent cases; 30/60/120fps; rebound continuity; floor rolling; zero inputs`);
