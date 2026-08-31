#!/usr/bin/env node
/*
 * Import the editable T台 clips into the game runtime.
 *
 * The pose lab stores shoulder/elbow/wrist points in actor space and stores
 * the hand quaternion in that same space. The game uses a nested chain:
 * actor -> upper arm -> forearm -> hand. Convert the points back to parent
 * local rotations here once, instead of making the render loop solve IK.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const GAME_ROOT = path.resolve(import.meta.dirname, "..");
const TSTAGE_ROOT = path.resolve(GAME_ROOT, "..", "basketball-pose-lab");
const ANIMATION_DIR = path.join(TSTAGE_ROOT, "animations");
const POSE_DIR = path.join(TSTAGE_ROOT, "poses");
const OUT_FILE = path.join(GAME_ROOT, "src", "data", "tstage-motion-pack.js");
const CHECK_ONLY = process.argv.includes("--check");
const EPSILON = 1e-6;

const require = createRequire(import.meta.url);
const THREE = require(path.join(GAME_ROOT, "vendor", "three.min.r128.js"));
const DOWN = new THREE.Vector3(0, -1, 0);
const HAND_BASIS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);

function round(value) {
  return Number(Number(value).toFixed(6));
}

function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${label} must be a finite Vec3`);
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function quaternion(value, label) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${label} must be a finite quaternion`);
  }
  return new THREE.Quaternion(value[0], value[1], value[2], value[3]).normalize();
}

function array3(value) {
  return [round(value.x), round(value.y), round(value.z)];
}

function array4(value) {
  const normalized = value.clone().normalize();
  return [round(normalized.x), round(normalized.y), round(normalized.z), round(normalized.w)];
}

function readPose(name) {
  const filename = `${name}.md`;
  const file = path.join(POSE_DIR, filename);
  if (!fs.existsSync(file)) throw new Error(`missing T台 pose: poses/${filename}`);
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) throw new Error(`pose has no JSON block: poses/${filename}`);
  const pose = JSON.parse(match[1]);
  if (pose.schema !== "aiba-pose-lab/3d-v2") throw new Error(`unsupported pose schema: ${name}`);
  return pose;
}

function importLimb(raw, label) {
  const shoulder = vector(raw?.shoulder, `${label}.shoulder`);
  const elbow = vector(raw?.elbow, `${label}.elbow`);
  const wrist = vector(raw?.wrist, `${label}.wrist`);
  const upper = elbow.clone().sub(shoulder);
  const lower = wrist.clone().sub(elbow);
  const upperLength = upper.length();
  const lowerLength = lower.length();
  if (upperLength < 0.05 || lowerLength < 0.05) throw new Error(`${label} has an invalid segment length`);

  // The game arm points down its local -Y axis. Solve the shoulder rotation.
  const armQuat = new THREE.Quaternion().setFromUnitVectors(DOWN, upper.normalize()).normalize();
  // Elbow is a child of the upper arm, so solve the lower direction in the
  // upper-arm parent-local space rather than reusing the actor-space vector.
  const lowerLocal = lower.normalize().applyQuaternion(armQuat.clone().invert());
  const elbowQuat = new THREE.Quaternion().setFromUnitVectors(DOWN, lowerLocal).normalize();

  // T台 fingers point along local +Y; game fingers point along local -Y.
  // Convert the T台 hand orientation to game hand orientation, then into the
  // forearm's local space.
  const handWorldQuat = quaternion(raw?.handQuat, `${label}.handQuat`).multiply(HAND_BASIS).normalize();
  const forearmWorldQuat = armQuat.clone().multiply(elbowQuat).normalize();
  const handQuat = forearmWorldQuat.invert().multiply(handWorldQuat).normalize();

  const imported = {
    upperLength: round(upperLength),
    lowerLength: round(lowerLength),
    armQuat: array4(armQuat),
    elbowQuat: array4(elbowQuat),
    handQuat: array4(handQuat),
    curl: Number.isFinite(raw?.curl) ? round(raw.curl) : null,
    source: {
      shoulder: array3(shoulder),
      elbow: array3(elbow),
      wrist: array3(wrist),
    },
  };
  if (Array.isArray(raw?.fingerCurls)) imported.fingerCurls = raw.fingerCurls.map(round);
  if (Array.isArray(raw?.fingerSplays)) imported.fingerSplays = raw.fingerSplays.map(round);
  return imported;
}

/* T台下肢点是 actor-space 的 hip/knee/ankle，游戏下肢是
   legs -> knees -> ankles 的嵌套 X 轴旋转链。只把 release pose 的下肢
   目标预计算成这条链的相对角度；root/骨盆高度仍由游戏投篮物理控制，
   避免把 T台静态姿势的身体高度直接带进游戏。 */
function importLeg(raw, label) {
  const hip = vector(raw?.hip, `${label}.hip`);
  const knee = vector(raw?.knee, `${label}.knee`);
  const ankle = vector(raw?.ankle, `${label}.ankle`);
  const upper = knee.clone().sub(hip);
  const lower = ankle.clone().sub(knee);
  if (upper.length() < 0.05 || lower.length() < 0.05) throw new Error(`${label} has an invalid leg segment`);

  /* game 的 -Y 骨段绕本地 X 旋转后，z = -sin(x)。先求两段在 actor
     空间的绝对俯仰，再相减得到 knee/ankle 的 parent-local 旋转。 */
  const absoluteX = (direction, part) => {
    const v = direction.clone().normalize();
    if (Math.hypot(v.y, v.z) < 0.2) throw new Error(`${label}.${part} is not a usable vertical leg direction`);
    return Math.atan2(-v.z, -v.y);
  };
  const hipX = absoluteX(upper, "upper");
  const lowerX = absoluteX(lower, "lower");
  const footQuat = quaternion(raw?.quaternion || raw?.ankleQuat, `${label}.ankleQuat`);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(footQuat);
  /* 游戏鞋只有 X 轴脚掌俯仰；把 T台鞋的 forward 向量投影到 YZ，
     保留 release pose 的脚跟/脚尖方向，忽略不能落进游戏骨架的偏航滚转。 */
  const footX = Math.atan2(-forward.y, Math.max(0.001, Math.hypot(forward.x, forward.z)));
  return {
    hip: round(hipX),
    knee: round(lowerX - hipX),
    ankle: round(footX - lowerX),
    ankleWorldQuat: array4(footQuat),
    source: { hip: array3(hip), knee: array3(knee), ankle: array3(ankle) },
  };
}

function importLowerBody(pose, label) {
  const body = pose?.body;
  if (!body?.leftLeg || !body?.rightLeg) throw new Error(`${label} has no complete body leg data`);
  return {
    left: importLeg(body.leftLeg, `${label}.leftLeg`),
    right: importLeg(body.rightLeg, `${label}.rightLeg`),
  };
}

function importBodyPose(pose, label) {
  const body = pose?.body;
  if (!body?.pelvis?.quaternion || !body?.spine?.quaternion || !body?.neck?.quaternion || !body?.head?.quaternion) {
    throw new Error(`${label} has no complete body quaternion data`);
  }
  return {
    pelvisQuat: array4(quaternion(body.pelvis.quaternion, `${label}.pelvisQuat`)),
    spineQuat: array4(quaternion(body.spine.quaternion, `${label}.spineQuat`)),
    neckQuat: array4(quaternion(body.neck.quaternion, `${label}.neckQuat`)),
    headQuat: array4(quaternion(body.head.quaternion, `${label}.headQuat`)),
  };
}

/* 单个静态 T台姿势也走同一条导入链。热身扣篮的水平位移、起跳弧线和球何时
   脱手仍归游戏；这里只把 Air Jordan 姿势的骨骼目标和球相对位置落成动作包。 */
function importStaticPose(name) {
  const pose = readPose(name);
  const shooting = pose.shootingHand || pose.shooting;
  const guide = pose.guideHand || pose.guide;
  const sourceShoulder = vector(shooting?.shoulder, `${name}.shooting.shoulder`);
  const ball = vector(pose.ball?.position, `${name}.ball.position`);
  const gameShoulder = new THREE.Vector3(-0.285, 1.36, 0);
  return {
    name,
    sourcePose: name,
    shooting: importLimb(shooting, `${name}.shooting`),
    guide: importLimb(guide, `${name}.guide`),
    lowerBody: importLowerBody(pose, name),
    body: importBodyPose(pose, name),
    ball: {
      position: array3(ball),
      quaternion: array4(quaternion(pose.ball?.quaternion || [0, 0, 0, 1], `${name}.ballQuat`)),
    },
    /* 将 T台球心从投篮肩锚点平移到游戏的 actor-local 肩锚点，便于任意预热
       角色共享同一套 pose，而不把 T台的绝对腾空高度硬写进根节点。 */
    ballLocal: array3(ball.clone().sub(sourceShoulder).add(gameShoulder)),
  };
}

function importBodyBob(animation, file) {
  if (animation.bodyBob == null) return null;
  if (typeof animation.bodyBob !== "object") throw new Error(`animation ${file} bodyBob must be an object`);
  const amplitude = Number(animation.bodyBob.amplitude);
  const frequency = animation.bodyBob.frequency == null ? 2 : Number(animation.bodyBob.frequency);
  const phase = animation.bodyBob.phase == null ? 0 : Number(animation.bodyBob.phase);
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 0.08) {
    throw new Error(`animation ${file} bodyBob.amplitude must be between 0 and 0.08m`);
  }
  if (!Number.isFinite(frequency) || frequency < 0.5 || frequency > 4) {
    throw new Error(`animation ${file} bodyBob.frequency must be between 0.5 and 4`);
  }
  if (!Number.isFinite(phase)) throw new Error(`animation ${file} bodyBob.phase must be finite`);
  return { amplitude: round(amplitude), frequency: round(frequency), phase: round(phase) };
}

function importClip(file) {
  const animation = JSON.parse(fs.readFileSync(path.join(ANIMATION_DIR, file), "utf8"));
  if (animation?.schema !== "aiba-animation/1") return null;
  if (!animation.name || !Array.isArray(animation.keyframes) || animation.keyframes.length < 2) {
    throw new Error(`animation ${file} needs at least two keyframes`);
  }
  if (!Number.isFinite(animation.duration) || animation.duration <= 0) {
    throw new Error(`animation ${file} needs a positive duration`);
  }
  const sourceFrames = animation.keyframes.slice().sort((a, b) => a.t - b.t);
  sourceFrames.forEach((frame, index) => {
    if (!frame.pose || !Number.isFinite(frame.t) || frame.t < -EPSILON || frame.t > 1 + EPSILON) {
      throw new Error(`animation ${file} keyframe ${index} needs pose and t in [0,1]`);
    }
  });
  if (animation.loop) {
    const first = sourceFrames[0];
    const last = sourceFrames[sourceFrames.length - 1];
    if (Math.abs(first.t) > EPSILON || Math.abs(last.t - 1) > EPSILON || first.pose !== last.pose) {
      throw new Error(`loop animation ${file} must close at t=1 with the t=0 pose`);
    }
  }
  const bodyBob = importBodyBob(animation, file);
  const keyframes = sourceFrames
    .map((frame) => {
      const pose = readPose(frame.pose);
      return {
        id: frame.id || frame.pose,
        t: round(frame.t),
        // Keep the absolute point on the editable T台 timeline as well as
        // the normalized phase used by the current runtime adapters.
        time: round(frame.t * animation.duration),
        sourcePose: frame.pose,
        label: frame.label || frame.pose,
        shooting: importLimb(pose.shootingHand || pose.shooting, `${frame.pose}.shooting`),
        guide: importLimb(pose.guideHand || pose.guide, `${frame.pose}.guide`),
        ...(animation.name === "shot_cycle" ? { lowerBody: importLowerBody(pose, frame.pose) } : {}),
      };
    });
  return {
    name: animation.name,
    label: animation.label || animation.name,
    loop: !!animation.loop,
    driver: animation.driver || "manual",
    duration: round(animation.duration || 1),
    ...(Number.isFinite(animation.contactAt) ? { contactAt: round(animation.contactAt) } : {}),
    ...(bodyBob ? { bodyBob } : {}),
    layers: animation.layers || {},
    keyframes,
  };
}

if (!fs.existsSync(ANIMATION_DIR)) throw new Error(`missing T台 animation directory: ${ANIMATION_DIR}`);
const clips = {};
for (const file of fs.readdirSync(ANIMATION_DIR).filter((name) => name.endsWith(".json")).sort()) {
  const clip = importClip(file);
  if (clip) clips[clip.name] = clip;
}
for (const required of ["run", "catching"]) {
  if (!clips[required]) throw new Error(`required T台 clip missing: ${required}`);
}

const STATIC_POSE_NAMES = ["dunk_air_jordan"];
const poses = Object.fromEntries(STATIC_POSE_NAMES.map((name) => [name, importStaticPose(name)]));

const pack = {
  schema: "aiba-motion-pack/1",
  editorVersion: "0.1.0",
  generatedAt: new Date().toISOString(),
  source: "basketball-pose-lab",
  clips,
  poses,
};

const output = [
  "/* generated by scripts/import-tstage-animations.mjs; edit T台 animations/ instead */",
  `const AIBA_TSTAGE_MOTION_PACK = ${JSON.stringify(pack, null, 2)};`,
  "globalThis.AIBA_TSTAGE_MOTION_PACK = AIBA_TSTAGE_MOTION_PACK;",
  "",
].join("\n");
if (CHECK_ONLY) {
  console.log(`checked ${Object.entries(clips).map(([name, clip]) => `${name}(${clip.keyframes.length} frames)`).join(", ")} and poses ${Object.keys(poses).join(", ")}`);
} else {
  const tempFile = `${OUT_FILE}.tmp`;
  fs.writeFileSync(tempFile, output, "utf8");
  fs.renameSync(tempFile, OUT_FILE);
  console.log(`imported ${Object.keys(clips).join(", ")} -> ${path.relative(GAME_ROOT, OUT_FILE)}`);
}
