// Retarget Mixamo animations (converted to GLB by mixamo_to_glb.py) onto the
// skinned Knight's rig, measure them on the real rig, and optionally write the
// result as the game's own clip data.
//
//   node tools/rig/bake-mixamo.mjs <glb dir>                     score every clip
//   node tools/rig/bake-mixamo.mjs <glb dir> --bake <out dir>     also write the clips in BAKE
//   node tools/rig/bake-mixamo.mjs <glb dir> --preview <out dir>  write every clip, named by file, for the lab
//
// Only derived keyframes are written. Keep the Mixamo source files out of the repo.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import {
  AnimationClip, AnimationMixer, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadChibiViews } from './load-chibi.mjs';
import { KnightFootwork } from '../../public/js/three/knight_footwork.js';

// Source file → game clip (see docs/handoff/motion-standard.md).
//   inPlace  remove travel the server already applies
//   speed    play faster
//   floor    keep a lying body, helmet and gear on top of the floor
//   fix      turn the shield to face forward and keep the blade out of the helmet
//   strike   [contact, end]: retime so the fastest blade lands at `contact` (the
//            server deals damage on the press) and the swing settles by `end`
//   legs     put the Knight's boots where the model's are (see reachLegs); true, or
//            { stride, lateral } multipliers on the model's fore-and-aft and sideways offsets
//   pace     { speed, cycle } retime a gait for the game's ground speed (see warpGait)
//   range    [from, to, seconds]: cut that part of the file and play it over `seconds`
//   flat     keep the hips where they started: the server moves the body, so a jump's own
//            rise would be counted twice
//   at       with strike: the source time of this strike's blade contact, for a
//            file that holds several strikes (a value that is a list bakes one clip
//            per entry); without it the fastest blade moment of the whole file is used
//   gait     cycle length; the left heel strikes at phase 0 for the footwork
//   yawFree  drop the hips' turn so the game's own yaw turns the Knight
export const BAKE = {
  'sword and shield death': { clip: 'dead', speed: 1.25, floor: true },
  // One file, three overhead chops: the blade peaks at 1.12, 2.20 and 3.03 s.
  'one hand sword combo': [
    { clip: 'attack1', inPlace: true, fix: true, at: 1.12, strike: [0.12, 0.44], legs: true },
    { clip: 'attack2', inPlace: true, fix: true, at: 2.20, strike: [0.115, 0.42], legs: true },
    { clip: 'attack3', inPlace: true, fix: true, at: 3.03, strike: [0.19, 0.58], legs: true }
  ],
  'sword and shield walk': { clip: 'walk', inPlace: true, fix: true, gait: 0.4, legs: true, pace: { speed: 5.4, cycle: 0.34 } },
  'sword and shield run': { clip: 'run', inPlace: true, fix: true, gait: 0.4, legs: true, pace: { speed: 7.5, cycle: 0.32 } },
  'sword and shield idle': { clip: 'idle', inPlace: true, fix: true, legs: true },
  // The jump file is crouch, leap, tuck at the apex, descent and landing over one second. The
  // game's rise (server velocity 11.2 against gravity 28) peaks 0.4 s after take-off and the fall
  // is about as long, so the leap and the descent are cut out and played at those lengths; the
  // landing squat is the game's own (updateLanding).
  'sword and shield jump': [
    { clip: 'jump', inPlace: true, fix: true, legs: true, flat: true, range: [0.17, 0.5, 0.38] },
    { clip: 'fall', inPlace: true, fix: true, legs: true, flat: true, range: [0.5, 0.8, 0.32] }
  ],
  'long idle': { clip: 'idleFidget', inPlace: true, fix: true, legs: true },
  'sword and shield block idle': { clip: 'guard', inPlace: true, fix: true, legs: true },
  'sword and shield block (2)': { clip: 'guardHit', inPlace: true, fix: true, legs: true },
  'sword and shield turn': { clip: 'turnR', inPlace: true, fix: true, legs: true, yawFree: true, speed: 2 },
  'sword and shield turn (2)': { clip: 'turnL', inPlace: true, fix: true, legs: true, yawFree: true, speed: 2 },
  'draw sword 1': { clip: 'draw', inPlace: true, fix: true, legs: true }
};

const FPS = 30;
const MAP = {
  hips: 'Hips', torso: 'Spine2', head: 'Head',
  armL: 'LeftArm', foreL: 'LeftForeArm', handL: 'LeftHand',
  armR: 'RightArm', foreR: 'RightForeArm', handR: 'RightHand',
  legL: 'LeftUpLeg', shinL: 'LeftLeg', footL: 'LeftFoot',
  legR: 'RightUpLeg', shinR: 'RightLeg', footR: 'RightFoot'
};
const PARENT = {
  hips: null, torso: 'hips', head: 'torso', armL: 'torso', foreL: 'armL', handL: 'foreL',
  armR: 'torso', foreR: 'armR', handR: 'foreR', legL: 'hips', shinL: 'legL', footL: 'shinL',
  legR: 'hips', shinR: 'legR', footR: 'shinR'
};
// Mixamo rests in a T-pose; the Knight's identity rest hangs its arms down.
const T_POSE = Object.fromEntries(Object.keys(MAP).map(joint => [joint, new Quaternion()]));
for (const joint of ['armL', 'foreL', 'handL']) T_POSE[joint].setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
for (const joint of ['armR', 'foreR', 'handR']) T_POSE[joint].setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);

function findBone(scene, name) {
  let found = null;
  scene.traverse(o => { if (!found && o.name.replace(/[:_]/g, '').endsWith('mixamorig' + name)) found = o; });
  if (!found) throw new Error(`Missing Mixamo bone ${name}`);
  return found;
}

// World rotation of each source bone relative to its T-pose, applied to the
// Knight's matching bone in the same reference pose, then made local.
export function retarget(scene, clip, restHipsY, { inPlace = false, sourceTimes = null } = {}) {
  const bones = Object.fromEntries(Object.entries(MAP).map(([joint, name]) => [joint, findBone(scene, name)]));
  scene.updateMatrixWorld(true);
  const rest = {};
  for (const joint in bones) rest[joint] = bones[joint].getWorldQuaternion(new Quaternion()).invert();
  const hipsRest = bones.hips.getWorldPosition(new Vector3());
  const scale = restHipsY / hipsRest.y;
  const legDrop = (hipsRest.y - bones.footL.getWorldPosition(new Vector3()).y) * scale;
  const mixer = new AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const count = sourceTimes ? sourceTimes.length : Math.round(clip.duration * FPS) + 1;
  const times = [];
  const rotations = Object.fromEntries(Object.keys(MAP).map(joint => [joint, []]));
  const hips = [];
  const feet = [];
  const world = {};
  const local = new Quaternion();
  for (let i = 0; i < count; i++) {
    const time = Math.min(clip.duration, i / FPS);
    times.push(+(sourceTimes ? i / FPS : time).toFixed(4));
    action.time = sourceTimes ? Math.min(clip.duration, sourceTimes[i]) : time;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    for (const joint of Object.keys(MAP)) {
      world[joint] = bones[joint].getWorldQuaternion(new Quaternion()).multiply(rest[joint]).multiply(T_POSE[joint]);
      local.copy(world[joint]);
      if (PARENT[joint]) local.premultiply(world[PARENT[joint]].clone().invert());
      if (rotations[joint].length && local.dot(new Quaternion().fromArray(rotations[joint].slice(-4))) < 0) {
        local.set(-local.x, -local.y, -local.z, -local.w);
      }
      rotations[joint].push(...local.toArray().map(v => +v.toFixed(4)));
    }
    const p = bones.hips.getWorldPosition(new Vector3());
    hips.push((p.x - hipsRest.x) * scale, restHipsY + (p.y - hipsRest.y) * scale, (p.z - hipsRest.z) * scale);
    // Where the model's boots are, relative to its hips, in its own (facing +Z) axes.
    feet.push(['footL', 'footR'].flatMap(joint => bones[joint].getWorldPosition(new Vector3()).sub(p).multiplyScalar(scale).toArray()));
  }
  if (inPlace) {
    const [x0, , z0] = hips;
    const [x1, , z1] = hips.slice(-3);
    for (let i = 0; i < count; i++) {
      const k = count > 1 ? i / (count - 1) : 0;
      hips[i * 3] -= x0 + (x1 - x0) * k;
      hips[i * 3 + 2] -= z0 + (z1 - z0) * k;
    }
  }
  return { fps: FPS, duration: times[times.length - 1], times, rotations, hips: hips.map(v => +v.toFixed(4)), feet, legDrop, restHipsY };
}

// The Knight's legs are set wider apart than the model's (chibi hips are about twice as wide),
// so the model's leg rotations on them splay the boots out. Put each boot where the model's
// boot is: the same distance from the hips' centre line, and the model's stride, scaled by the
// ratio of the two legs' lengths. `stride` stretches the fore-and-aft swing, `lateral` the
// sideways offset; the leg's own reach limits both.
export function reachLegs(view, data, { stride = 1, lateral = 1, minHalf = 0.055 } = {}) {
  const R = view.R;
  const out = { ...data, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
  const fw = new KnightFootwork(R);
  fw.yaw = 0;
  const hips = new Vector3();
  const foot = new Quaternion();
  const parent = new Quaternion();
  // The legs' lengths: hips to ankle with the leg hanging straight, the Knight's against the model's.
  const rest = new Quaternion();
  const keep = ['hips', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'].map(joint => [joint, R[joint].quaternion.clone()]);
  const keepY = R.hips.position.y;
  for (const [joint] of keep) R[joint].quaternion.copy(rest);
  R.hips.position.y = data.restHipsY;
  R.hips.updateMatrixWorld(true);
  const ours = R.hips.getWorldPosition(new Vector3()).y - R.footL.getWorldPosition(new Vector3()).y;
  for (const [joint, q] of keep) R[joint].quaternion.copy(q);
  R.hips.position.y = keepY;
  const baseLeg = ours / data.legDrop;
  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, out, i);
    R.hips.getWorldPosition(hips);
    for (const [side, leg, joint] of [[0, fw.legs[0], 'L'], [1, fw.legs[1], 'R']]) {
      const [x, y, z] = data.feet[i].slice(side * 3, side * 3 + 3);
      const sign = Math.sign(x) || (side === 0 ? 1 : -1);
      fw.target.set(hips.x + sign * Math.max(minHalf, Math.abs(x) * baseLeg) * lateral, hips.y + y * baseLeg, hips.z + z * baseLeg * stride);
      leg.ankle.getWorldQuaternion(foot);
      fw.placeLeg(leg);
      // Keep the boot's own tilt as the model has it, whatever the leg did.
      leg.ankle.parent.getWorldQuaternion(parent);
      leg.ankle.quaternion.copy(parent.invert().multiply(foot));
      for (const bone of [joint === 'L' ? 'legL' : 'legR', joint === 'L' ? 'shinL' : 'shinR', joint === 'L' ? 'footL' : 'footR']) {
        R[bone].quaternion.toArray().forEach((v, k) => { out.rotations[bone][i * 4 + k] = +v.toFixed(4); });
      }
      R.hips.updateMatrixWorld(true);
    }
  }
  return out;
}


// How the Mixamo shield sits on its forearm, as the Knight's wrist rotation.
// The model's shield is rigid on LeftForeArm (its prop bone Shield_joint is a child
// of the forearm), so the angle it is held at is a constant of that bone. Measure
// the shield mesh's principal axes at the first frame (thin axis = face, long axis =
// up), then express them as the wrist rotation that gives the Knight's shield the
// same orientation: its face is the wrist's -Y and its crest the wrist's +Z.
// `meshName` is the model's shield mesh (the file names its meshes one off).
export function shieldHold(scene, clip, meshName, upSign = 1) {
  const fore = findBone(scene, 'LeftForeArm');
  const hips = findBone(scene, 'Hips');
  scene.updateMatrixWorld(true);
  const restFore = fore.getWorldQuaternion(new Quaternion());
  const mixer = new AnimationMixer(scene);
  mixer.clipAction(clip).play();
  mixer.update(0);
  scene.updateMatrixWorld(true);
  let mesh = null;
  scene.traverse(o => { if (o.isSkinnedMesh && o.name === meshName) mesh = o; });
  if (!mesh) throw new Error(`No skinned mesh ${meshName}`);
  mesh.skeleton.update();
  const count = mesh.geometry.attributes.position.count;
  const points = [];
  const point = new Vector3();
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, point);
    mesh.localToWorld(point);
    points.push(point.clone());
  }
  const centre = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(count);
  // Principal axes of the point cloud: Jacobi sweeps on the 3x3 covariance.
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = [p.x - centre.x, p.y - centre.y, p.z - centre.z];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r][c] += d[r] * d[c] / count;
  }
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 40; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(m[p][q]) < 1e-14) continue;
      const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const sn = t * c;
      for (let k = 0; k < 3; k++) {
        const kp = m[k][p], kq = m[k][q];
        m[k][p] = c * kp - sn * kq;
        m[k][q] = sn * kp + c * kq;
      }
      for (let k = 0; k < 3; k++) {
        const pk = m[p][k], qk = m[q][k];
        m[p][k] = c * pk - sn * qk;
        m[q][k] = sn * pk + c * qk;
      }
      for (let k = 0; k < 3; k++) {
        const kp = v[k][p], kq = v[k][q];
        v[k][p] = c * kp - sn * kq;
        v[k][q] = sn * kp + c * kq;
      }
    }
  }
  const axes = [0, 1, 2].map(i => ({ value: m[i][i], vector: new Vector3(v[0][i], v[1][i], v[2][i]).normalize() }))
    .sort((a, b) => a.value - b.value);
  // Face outward = away from the body: the side of the thin axis the shield centre sits on.
  const bodyCentre = hips.getWorldPosition(new Vector3());
  const normal = axes[0].vector.clone();
  if (normal.dot(centre.clone().sub(bodyCentre)) < 0) normal.negate();
  const crest = axes[2].vector.clone().multiplyScalar(upSign);
  crest.addScaledVector(normal, -crest.dot(normal)).normalize();
  const face = normal.clone().negate();
  const side = new Vector3().crossVectors(face, crest);
  const shield = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, face, crest));
  const foreNow = fore.getWorldQuaternion(new Quaternion());
  // wrist = T_POSE(foreL)^-1 * restFore * foreNow^-1 * shield
  const wrist = T_POSE.foreL.clone().invert().multiply(restFore).multiply(foreNow.invert()).multiply(shield);
  return { wrist, normal, crest, extents: axes.map(a => Math.sqrt(a.value) * 2) };
}

// Fastest blade moment and the window where the blade sweeps above 35% of it.
export function bladeTiming(view, data) {
  const tip = new Vector3();
  const previous = new Vector3();
  const speeds = [];
  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, data, i);
    view.R.swordMount.localToWorld(tip.set(0, 0, 1.04));
    speeds.push(i ? tip.distanceTo(previous) / (data.times[i] - data.times[i - 1]) : 0);
    previous.copy(tip);
  }
  const peak = speeds.indexOf(Math.max(...speeds));
  let first = peak;
  let last = peak;
  while (first > 1 && speeds[first - 1] > speeds[peak] * 0.35) first--;
  while (last < speeds.length - 1 && speeds[last + 1] > speeds[peak] * 0.35) last++;
  return { contact: data.times[peak], trail: [data.times[Math.max(0, first - 1)], data.times[last]] };
}

// Contact and trail window when the contact is known (the strike was retimed to
// land exactly there): the trail is the run of frames around it where the blade
// moves at over 35% of its top speed near contact. The fastest blade moment of a
// retimed clip can be the compressed wind-up, so it is not used for the contact.
export function bladeWindowAt(view, data, contact) {
  const tip = new Vector3();
  const previous = new Vector3();
  const speeds = [];
  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, data, i);
    view.R.swordMount.localToWorld(tip.set(0, 0, 1.04));
    speeds.push(i ? tip.distanceTo(previous) / (data.times[i] - data.times[i - 1]) : 0);
    previous.copy(tip);
  }
  const at = data.times.reduce((best, t, i) => (Math.abs(t - contact) < Math.abs(data.times[best] - contact) ? i : best), 0);
  const near = speeds.slice(Math.max(1, at - 1), at + 3);
  const reference = Math.max(...near);
  let first = at;
  let last = at;
  while (first > 1 && speeds[first - 1] > reference * 0.35) first--;
  while (last < speeds.length - 1 && speeds[last + 1] > reference * 0.35) last++;
  return { contact: data.times[at], trail: [data.times[Math.max(0, first - 1)], data.times[last]] };
}

// Source sample times that put the fastest blade at `contact` and end by `end`:
// a short wind-up is compressed into the contact time, the follow-through into the rest.
export function strikeTimes(sourceContact, duration, contact, end) {
  const windup = Math.min(sourceContact, 0.3);
  const follow = Math.min(duration - sourceContact, 0.6);
  const times = [];
  for (let t = 0; t <= end + 1e-6; t += 1 / FPS) {
    times.push(t <= contact
      ? sourceContact - windup + windup * (t / contact)
      : sourceContact + follow * Math.min(1, (t - contact) / (end - contact)));
  }
  return times;
}

// Rotate a looping gait so the left heel strike (left boot furthest ahead of the
// hips) is phase 0, and resample it to `duration`.
export function alignGait(view, data, duration) {
  const ankle = new Vector3();
  const hips = new Vector3();
  const frames = data.times.length - 1;
  let strike = 0;
  let reach = -Infinity;
  for (let i = 0; i < frames; i++) {
    poseFrame(view, data, i);
    const ahead = view.R.footL.getWorldPosition(ankle).z - view.R.hips.getWorldPosition(hips).z;
    if (ahead > reach) { reach = ahead; strike = i; }
  }
  const order = Array.from({ length: frames }, (_, i) => (i + strike) % frames);
  order.push(order[0]);
  const rotations = Object.fromEntries(Object.entries(data.rotations).map(([joint, values]) => [joint, order.flatMap(i => values.slice(i * 4, i * 4 + 4))]));
  const hipsTrack = order.flatMap(i => data.hips.slice(i * 3, i * 3 + 3));
  const times = order.map((_, i) => +(duration * i / frames).toFixed(4));
  return { ...data, duration, times, rotations, hips: hipsTrack };
}

// The game moves the Knight at 5.4 and 7.5 units a second, which for legs half a unit long is
// a sprint, far faster than the model's own walk or run covers. Played at the model's pace the
// planted boot would slide across the floor and the boot pinned to it would be dragged until it
// let go. So retime the cycle: the stance (heel strike to toe-off, the boot sweeping back
// under the hips) is played at the pace that keeps the boot still on the floor at `speed`,
// the rest of the step stretches to fill `cycle`. Needs the left heel strike at phase 0 (alignGait).
// Stores `groundSpeed` (the speed the clip is matched to) and `stance` (its share of the cycle).
export function warpGait(view, data, { speed, cycle, toeOff = 0.42 }) {
  const R = view.R;
  const ankle = new Vector3();
  const hips = new Vector3();
  const frames = data.times.length - 1;
  const z = [];
  for (let i = 0; i <= frames; i++) {
    poseFrame(view, data, i);
    z.push(R.footL.getWorldPosition(ankle).z - R.hips.getWorldPosition(hips).z);
  }
  // Toe-off: the boot furthest behind the hips, but never past `toeOff` of the cycle.
  let off = 0;
  for (let i = 0; i <= Math.round(toeOff * frames); i++) if (z[i] < z[off]) off = i;
  const stancePhase = off / frames;
  const sweep = z[0] - z[off];
  const half = Math.max(cycle / 2, sweep / speed / 0.7);
  // Dense keys: the stance is only a couple of 30 fps frames long once compressed.
  const KEYS = 120;
  const count = Math.round(half * 2 * KEYS);
  const duration = count / KEYS;
  const stanceTime = Math.min(sweep / speed, 0.7 * duration / 2);
  // Time as a function of the step's phase: slow where the stance is stretched, fast where it is
  // squeezed. The seam between the two would be a kink in the motion (a jolt at toe-off), so
  // the rate is blurred over `blur` of the step, then the half cycle is rescaled to its length.
  const grid = 1000;
  const halfTime = duration / 2;
  const slope = i => {
    const u = (i / grid) * 0.5;
    return u < stancePhase ? stanceTime / stancePhase : (halfTime - stanceTime) / (0.5 - stancePhase);
  };
  const blur = Math.max(1, Math.round(grid * 0.06));
  const rate = Array.from({ length: grid }, (_, i) => {
    let sum = 0;
    for (let k = -blur; k <= blur; k++) sum += slope(((i + k) % grid + grid) % grid);
    return sum / (2 * blur + 1);
  });
  const tauAt = [0];
  for (let i = 0; i < grid; i++) tauAt.push(tauAt[i] + rate[i]);
  const total = tauAt[grid];
  for (let i = 0; i <= grid; i++) tauAt[i] *= halfTime / total;
  const phaseAt = tau => {
    let lo = 0, hi = grid;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tauAt[mid] <= tau) lo = mid; else hi = mid; }
    const span = tauAt[hi] - tauAt[lo] || 1;
    return ((lo + (tau - tauAt[lo]) / span) / grid) * 0.5;
  };
  const sample = new Quaternion();
  const next = new Quaternion();
  const rotations = Object.fromEntries(Object.keys(data.rotations).map(joint => [joint, []]));
  const hipsTrack = [];
  const times = [];
  for (let j = 0; j <= count; j++) {
    const t = j / KEYS;
    const step = t >= halfTime ? 1 : 0;
    const u = phaseAt(Math.min(halfTime, t - step * halfTime));
    const f = Math.min(frames, (u + step * 0.5) * frames);
    const i0 = Math.min(frames - 1, Math.floor(f));
    const a = f - i0;
    times.push(+t.toFixed(4));
    for (const joint of Object.keys(data.rotations)) {
      sample.fromArray(data.rotations[joint], i0 * 4);
      next.fromArray(data.rotations[joint], (i0 + 1) * 4);
      sample.slerp(next, a).toArray().forEach(v => rotations[joint].push(+v.toFixed(4)));
    }
    for (let k = 0; k < 3; k++) {
      const p = data.hips[i0 * 3 + k];
      hipsTrack.push(+(p + (data.hips[(i0 + 1) * 3 + k] - p) * a).toFixed(4));
    }
  }
  return { ...data, duration, times, rotations, hips: hipsTrack, groundSpeed: speed, stance: +(stanceTime / duration).toFixed(3) };
}

// Remove the hips' turn about the vertical from the first frame on.
export function stripYaw(data) {
  const q = new Quaternion();
  const first = new Euler().setFromQuaternion(q.fromArray(data.rotations.hips, 0), 'YXZ').y;
  const turn = new Quaternion();
  const hips = data.rotations.hips.slice();
  for (let i = 0; i < data.times.length; i++) {
    q.fromArray(hips, i * 4);
    const yaw = new Euler().setFromQuaternion(q, 'YXZ').y;
    q.premultiply(turn.setFromAxisAngle(new Vector3(0, 1, 0), first - yaw));
    q.toArray().forEach((v, k) => { hips[i * 4 + k] = +v.toFixed(4); });
  }
  return { ...data, rotations: { ...data.rotations, hips } };
}

// Mixamo holds its shield rigidly on the forearm, and its swings pass through the
// oversized helmet. Hold the Knight's shield at the angle the Mixamo model holds its
// own (SHIELD_HOLD, measured by shield-from-model.mjs from the model Sword And
// Shield Run (1) Model.fbx), and turn the right wrist (then the forearm) just enough
// to keep the blade clear of the helmet. Each frame starts from the previous frame's
// correction so the wrists move smoothly.
//
// SHIELD_HOLD is the left wrist's rotation: the shield face is the wrist's -Y and its
// crest points along +Z. Because the shield is rigid on the forearm it is the same in
// every clip, and the shield turns with the forearm as it does on the model: face
// forward and crest up standing and guarding, face out to the left in a run.
export const SHIELD_HOLD = [-0.0086, 0.0277, 0.6796, 0.7330];
const HELMET_CLEARANCE = 0.3;
export function fixHands(view, data) {
  const R = view.R;
  const out = { ...data, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
  const base = new Quaternion();
  const turn = new Quaternion();
  const euler = new Euler();
  const head = new Vector3();
  const bladeBase = new Vector3();
  const bladeTip = new Vector3();
  const along = new Vector3();
  const nearest = new Vector3();
  const clearance = (joint, value) => {
    R[joint].quaternion.copy(base).multiply(turn.setFromEuler(euler.set(...value)));
    R[joint].updateMatrixWorld(true);
    R.head.getWorldPosition(head).y += 0.22;
    R.swordMount.localToWorld(bladeBase.set(0, 0, 0.16));
    R.swordMount.localToWorld(bladeTip.set(0, 0, 1.04));
    along.subVectors(bladeTip, bladeBase);
    const k = Math.max(0, Math.min(1, head.clone().sub(bladeBase).dot(along) / along.lengthSq()));
    return nearest.copy(bladeBase).addScaledVector(along, k).distanceTo(head);
  };
  const search = (start, cost, limit) => {
    const value = start.slice();
    let best = cost(value);
    for (let step = 0.4; step > 0.005; step *= 0.6) {
      for (let round = 0; round < 20; round++) {
        let improved = false;
        for (let axis = 0; axis < 3; axis++) for (const delta of [step, -step]) {
          const old = value[axis];
          value[axis] = Math.max(-limit, Math.min(limit, old + delta));
          const c = cost(value);
          if (c < best - 1e-7) { best = c; improved = true; } else value[axis] = old;
        }
        if (!improved) break;
      }
    }
    return value;
  };
  // The search carries each frame's answer into the next, so frame 0 would start
  // from nothing and land far from frame 1: a wrist snap at the start of every
  // clip. Solve once to learn where the wrist settles, then solve again from there.
  const solve = (startBlade) => {
    const result = { ...out, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
    const blade = { handR: startBlade.handR, foreR: startBlade.foreR };
    const settled = { blade: null };
    for (let i = 0; i < data.times.length; i++) {
      for (let k = 0; k < 4; k++) result.rotations.handL[i * 4 + k] = SHIELD_HOLD[k];
      poseFrame(view, result, i);
      for (const joint of ['handR', 'foreR']) {
        base.copy(R[joint].quaternion);
        const previous = blade[joint];
        const start = clearance(joint, previous) >= HELMET_CLEARANCE ? previous.map(x => x * 0.85) : previous;
        blade[joint] = search(start, v => Math.max(0, HELMET_CLEARANCE - clearance(joint, v)) ** 2 * 200
          + 0.05 * v.reduce((a, x) => a + x * x, 0) + 0.3 * v.reduce((a, x, k) => a + (x - previous[k]) ** 2, 0), 1.4);
        R[joint].quaternion.copy(base).multiply(turn.setFromEuler(euler.set(...blade[joint])));
        R[joint].updateMatrixWorld(true);
        R[joint].quaternion.toArray().forEach((v, k) => { result.rotations[joint][i * 4 + k] = +v.toFixed(4); });
      }
      if (i === Math.min(2, data.times.length - 1)) settled.blade = { handR: blade.handR.slice(), foreR: blade.foreR.slice() };
    }
    return { result, settled };
  };
  const first = solve({ handR: [0, 0, 0], foreR: [0, 0, 0] });
  return { ...solve(first.settled.blade).result, shield: SHIELD_HOLD };
}

// Lowest point of a set of meshes, from every fourth vertex, in world units.
function lowestPoint(meshes, point) {
  let lowest = Infinity;
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 4) {
      mesh.getVertexPosition(i, point);
      lowest = Math.min(lowest, mesh.localToWorld(point).y);
    }
  }
  return lowest;
}

export function poseFrame(view, data, frame) {
  for (const [joint, values] of Object.entries(data.rotations)) view.R[joint].quaternion.fromArray(values, frame * 4);
  view.R.hips.position.fromArray(data.hips, frame * 3);
  view.root.updateMatrixWorld(true);
}

// Ease a per-frame amount over its neighbours so a correction fades in and out.
function spread(values, reach = 4) {
  return values.map((_, i) => {
    let best = 0;
    for (let j = Math.max(0, i - reach); j <= Math.min(values.length - 1, i + reach); j++) {
      best = Math.max(best, values[j] * (1 - Math.abs(i - j) / (reach + 1)));
    }
    return best;
  });
}

// Mixamo's mannequin is slimmer than the armoured chibi, and its hands hold no
// shield, so a pose on the floor sinks the Knight and buries the gear. Raise the
// hips until the body and helmet clear the floor, then turn each wrist just far
// enough that the sword and shield rest on it. The cape is left to its cloth.
export function clearFloor(view, data) {
  const R = view.R;
  const underHand = (mesh, hand) => { let found = false; mesh.traverseAncestors(a => { if (a === R[hand]) found = true; }); return found; };
  const body = [];
  const props = { handL: [], handR: [] };
  view.root.traverse(o => {
    if (!o.isMesh || o.name === 'KnightCape' || !o.geometry?.attributes.position) return;
    if (underHand(o, 'handL')) props.handL.push(o);
    else if (underHand(o, 'handR')) props.handR.push(o);
    else body.push(o);
  });
  view.mixer.stopAllAction();
  const point = new Vector3();
  const count = data.times.length;
  const out = { ...data, hips: data.hips.slice(), rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };

  // The big helmet sinks first when the Knight lies down, so rather than float
  // the whole body, search for the smallest mix of hips lift, chest raise and
  // chin tuck that keeps body and helmet on top of the floor.
  const fixes = [];
  const torso = new Quaternion();
  const head = new Quaternion();
  const bend = new Quaternion();
  for (let i = 0; i < count; i++) {
    poseFrame(view, out, i);
    const depth = Math.max(0, -lowestPoint(body, point));
    let best = { cost: depth * depth * 100, fix: [0, 0, 0] };
    if (depth > 0.01) {
      torso.copy(R.torso.quaternion);
      head.copy(R.head.quaternion);
      const hipsY = R.hips.position.y;
      for (let lift = 0; lift <= 0.45; lift += 0.05) for (let chest = 0; chest <= 0.91; chest += 0.15) for (let chin = 0; chin <= 0.81; chin += 0.2) {
        R.hips.position.y = hipsY + lift / R.rigScale;
        R.torso.quaternion.copy(torso).multiply(bend.setFromAxisAngle(new Vector3(1, 0, 0), chest));
        R.head.quaternion.copy(head).multiply(bend.setFromAxisAngle(new Vector3(1, 0, 0), chin));
        view.root.updateMatrixWorld(true);
        const d = Math.max(0, -lowestPoint(body, point));
        const cost = d * d * 100 + lift * lift * 2 + (chest * chest + chin * chin) * 0.05;
        if (cost < best.cost) best = { cost, fix: [lift, chest, chin] };
      }
    }
    fixes.push(best.fix);
  }
  const [lifts, chests, chins] = [0, 1, 2].map(k => spread(fixes.map(f => f[k])));
  for (let i = 0; i < count; i++) {
    out.hips[i * 3 + 1] = +(out.hips[i * 3 + 1] + lifts[i] / R.rigScale).toFixed(4);
    for (const [joint, angle] of [['torso', chests[i]], ['head', chins[i]]]) {
      if (!angle) continue;
      torso.fromArray(out.rotations[joint], i * 4).multiply(bend.setFromAxisAngle(new Vector3(1, 0, 0), angle));
      torso.toArray().forEach((v, k) => { out.rotations[joint][i * 4 + k] = +v.toFixed(4); });
    }
  }

  const turn = new Quaternion();
  const base = new Quaternion();
  for (const hand of ['handL', 'handR']) {
    if (!props[hand].length) continue;
    const corrections = [];
    for (let i = 0; i < count; i++) {
      poseFrame(view, out, i);
      base.copy(R[hand].quaternion);
      const depth = Math.max(0, -lowestPoint(props[hand], point));
      let best = { cost: depth * depth * 100, euler: [0, 0, 0] };
      if (depth > 0.01) {
        // Coarse search for the smallest wrist turn that lifts the gear out of the floor.
        for (const x of [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]) for (const y of [-1.2, -0.6, 0, 0.6, 1.2]) for (const z of [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]) {
          R[hand].quaternion.copy(base).multiply(turn.setFromEuler(new Euler(x, y, z)));
          R[hand].updateMatrixWorld(true);
          const d = Math.max(0, -lowestPoint(props[hand], point));
          const cost = d * d * 100 + (x * x + y * y + z * z) * 0.02;
          if (cost < best.cost) best = { cost, euler: [x, y, z] };
        }
      }
      corrections.push(best.euler);
    }
    // Hold each turn over neighbouring frames, weighted by how far it is from a buried frame.
    const weight = spread(corrections.map(e => (e.some(v => v !== 0) ? 1 : 0)));
    for (let i = 0; i < count; i++) {
      let source = corrections[i];
      if (!source.some(v => v !== 0)) {
        for (let r = 1; r <= 4 && !source.some(v => v !== 0); r++) {
          source = corrections[Math.min(count - 1, i + r)].some(v => v !== 0) ? corrections[Math.min(count - 1, i + r)] : corrections[Math.max(0, i - r)];
        }
      }
      if (weight[i] <= 0) continue;
      base.fromArray(out.rotations[hand], i * 4);
      turn.setFromEuler(new Euler(...source.map(v => v * weight[i])));
      base.multiply(turn).toArray(out.rotations[hand], i * 4);
      for (let k = 0; k < 4; k++) out.rotations[hand][i * 4 + k] = +out.rotations[hand][i * 4 + k].toFixed(4);
    }
  }
  return out;
}

export function clipFromData(name, data) {
  const tracks = Object.entries(data.rotations).map(([joint, values]) => new QuaternionKeyframeTrack(`${joint}.quaternion`, data.times, values));
  tracks.push(new VectorKeyframeTrack('hips.position', data.times, data.hips));
  return new AnimationClip(name, data.duration, tracks);
}

// Blade through the helmet, fastest blade moment, and how far the feet sink
// below or float above the floor, sampled at 60 Hz on the real rig.
export function score(view, clip) {
  const R = view.R;
  view.mixer.stopAllAction();
  const action = view.mixer.clipAction(clip);
  action.reset();
  action.play();
  const head = new Vector3();
  const base = new Vector3();
  const tip = new Vector3();
  const previous = new Vector3();
  const ankle = new Vector3();
  let inHelmet = 0;
  let peak = 0;
  let peakAt = 0;
  let deepest = 0;
  let highest = -Infinity;
  for (let i = 0; i <= Math.round(clip.duration * 60); i++) {
    action.time = i / 60;
    view.mixer.update(0);
    view.root.updateMatrixWorld(true);
    R.swordMount.localToWorld(base.set(0, 0, 0.16));
    R.swordMount.localToWorld(tip.set(0, 0, 1.04));
    R.head.getWorldPosition(head).y += 0.22;
    const along = tip.clone().sub(base);
    const k = Math.min(1, Math.max(0, head.clone().sub(base).dot(along) / along.lengthSq()));
    if (base.clone().addScaledVector(along, k).distanceTo(head) < 0.28) inHelmet++;
    if (i > 0 && tip.distanceTo(previous) * 60 > peak) { peak = tip.distanceTo(previous) * 60; peakAt = i / 60; }
    previous.copy(tip);
    const low = Math.min(...[R.footL, R.footR].map(foot => foot.getWorldPosition(ankle).y)) - R.restFootY;
    deepest = Math.min(deepest, low);
    highest = Math.max(highest, low);
  }
  action.stop();
  return { seconds: +clip.duration.toFixed(2), bladeInHelmetFrames: inHelmet, fastestBladeAt: +peakAt.toFixed(2),
    lowestAnkle: +deepest.toFixed(3), lowestAnkleMax: +highest.toFixed(3) };
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args[0];
  const bakeAt = args.indexOf('--bake');
  const out = bakeAt >= 0 ? args[bakeAt + 1] : null;
  const previewAt = args.indexOf('--preview');
  const preview = previewAt >= 0 ? args[previewAt + 1] : null;
  if (!dir) throw new Error('Usage: node tools/rig/bake-mixamo.mjs <glb dir> [--bake <out dir>]');
  const { ChibiView } = await loadChibiViews();
  const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
  const view = new ChibiView({ heroId: 'knight', gear, x: 0, y: 0, z: 0, facing: Math.PI / 2, grounded: true });
  const restHipsY = view.R.hips.position.y;
  const loader = new GLTFLoader();
  const report = {};
  for (const name of Object.keys(view.actions)) {
    if (/^(idle|walk|run|guard|dead|attack1|attack2|attack3|heavy|hurt)$/.test(name)) report['knight:' + name] = score(view, view.actions[name].getClip());
  }
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.glb')).sort()) {
    const bytes = await readFile(join(dir, file));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const source = gltf.animations.find(a => a.duration > 0.05);
    if (!source) continue;
    const key = basename(file, '.glb').toLowerCase();
    const plans = [].concat(BAKE[key] || []);
    const raw = retarget(gltf.scene, source, restHipsY, plans[0] || { inPlace: true });
    report['mixamo:' + key] = score(view, clipFromData(key, raw));
    if (preview) {
      await mkdir(preview, { recursive: true });
      await writeFile(join(preview, key + '.json'), JSON.stringify({ source: 'Mixamo: ' + key, ...raw }));
    }
    for (const plan of out ? plans : []) {
      let data = raw;
      let extra = {};
      if (plan.range) {
        const [from, to, seconds] = plan.range;
        const count = Math.round(seconds * FPS) + 1;
        data = retarget(gltf.scene, source, restHipsY, {
          inPlace: plan.inPlace, sourceTimes: Array.from({ length: count }, (_, i) => from + (to - from) * i / (count - 1))
        });
      }
      if (plan.strike) {
        const [contact, end] = plan.strike;
        data = retarget(gltf.scene, source, restHipsY, {
          inPlace: plan.inPlace, sourceTimes: strikeTimes(plan.at ?? bladeTiming(view, raw).contact, source.duration, contact, end)
        });
      }
      if (plan.legs) data = reachLegs(view, data, plan.legs === true ? {} : plan.legs);
      if (plan.flat) {
        // Standing height, from the file's first frame (before the crouch).
        const standing = [0, raw.hips[1], 0];
        data = { ...data, hips: data.hips.map((v, i) => +standing[i % 3].toFixed(4)) };
      }
      if (plan.yawFree) data = stripYaw(data);
      if (plan.gait) data = alignGait(view, data, plan.gait);
      if (plan.pace) data = warpGait(view, data, plan.pace);
      if (plan.fix) data = fixHands(view, data);
      if (plan.floor) data = clearFloor(view, data);
      if (plan.speed) data = { ...data, duration: +(data.duration / plan.speed).toFixed(4), times: data.times.map(t => +(t / plan.speed).toFixed(4)) };
      if (plan.strike) extra = plan.at === undefined ? bladeTiming(view, data) : bladeWindowAt(view, data, plan.strike[0]);
      await mkdir(out, { recursive: true });
      const { feet, legDrop, restHipsY: _rest, ...clip } = data;
      await writeFile(join(out, plan.clip + '.json'), JSON.stringify({ source: 'Mixamo: ' + key, ...extra, ...clip }));
      report['baked:' + plan.clip] = { ...score(view, clipFromData(plan.clip, data)), ...extra };
    }
  }
  view.dispose();
  console.log(JSON.stringify(report, null, 1));
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('bake-mixamo.mjs')) await main();
