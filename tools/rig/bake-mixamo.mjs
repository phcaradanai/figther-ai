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
  AnimationClip, AnimationMixer, Euler, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadChibiViews } from './load-chibi.mjs';

// Source file → game clip (see docs/handoff/motion-standard.md).
//   inPlace  remove travel the server already applies
//   speed    play faster
//   floor    keep a lying body, helmet and gear on top of the floor
//   fix      turn the shield to face forward and keep the blade out of the helmet
//   strike   [contact, end]: retime so the fastest blade lands at `contact` (the
//            server deals damage on the press) and the swing settles by `end`
//   gait     cycle length; the left heel strikes at phase 0 for the footwork
//   yawFree  drop the hips' turn so the game's own yaw turns the Knight
export const BAKE = {
  'sword and shield death': { clip: 'dead', speed: 1.25, floor: true },
  'slash': { clip: 'attack1', inPlace: true, fix: true, strike: [0.12, 0.44] },
  'sword and shield attack (2)': { clip: 'attack2', inPlace: true, fix: true, strike: [0.115, 0.42] },
  'sword and shield attack (3)': { clip: 'attack3', inPlace: true, fix: true, strike: [0.19, 0.58] },
  'sword and shield run': { clip: 'walk', inPlace: true, fix: true, gait: 0.44 },
  'sword and shield run (2)': { clip: 'run', inPlace: true, fix: true, gait: 0.39 },
  'sword and shield idle': { clip: 'idle', inPlace: true, fix: true },
  'long idle': { clip: 'idleFidget', inPlace: true, fix: true },
  'sword and shield block idle': { clip: 'guard', inPlace: true, fix: true },
  'sword and shield block (2)': { clip: 'guardHit', inPlace: true, fix: true },
  'sword and shield turn': { clip: 'turnR', inPlace: true, fix: true, yawFree: true, speed: 2 },
  'sword and shield turn (2)': { clip: 'turnL', inPlace: true, fix: true, yawFree: true, speed: 2 },
  'draw sword 1': { clip: 'draw', inPlace: true, fix: true }
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
  const mixer = new AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const count = sourceTimes ? sourceTimes.length : Math.round(clip.duration * FPS) + 1;
  const times = [];
  const rotations = Object.fromEntries(Object.keys(MAP).map(joint => [joint, []]));
  const hips = [];
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
  return { fps: FPS, duration: times[times.length - 1], times, rotations, hips: hips.map(v => +v.toFixed(4)) };
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

// Mixamo holds its shield on the forearm, so on the Knight's hand mount the
// shield faces sideways, and its swings pass through the oversized helmet. Turn
// the left wrist so the shield faces forward, and the right wrist (then the
// forearm) just enough to keep the blade clear of the helmet. Each frame starts
// from the previous frame's correction so the wrists move smoothly.
const SHIELD_FACING = new Vector3(0.35, 0.05, 0.93).normalize();
const HELMET_CLEARANCE = 0.3;
export function fixHands(view, data) {
  const R = view.R;
  const out = { ...data, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
  const base = new Quaternion();
  const turn = new Quaternion();
  const euler = new Euler();
  const normal = new Vector3();
  const rootInverse = new Quaternion();
  const head = new Vector3();
  const bladeBase = new Vector3();
  const bladeTip = new Vector3();
  const along = new Vector3();
  const nearest = new Vector3();
  // The shield's face is the wrist's -Y and its crest points along +Z. Facing forward
  // leaves the roll about the face free, and each clip would settle on its own roll:
  // two clips could then sit half a turn apart and spin the shield when they blend.
  // The roll term keeps the crest upright in every clip.
  const up = new Vector3();
  let rollOff = 0;
  const facing = (value) => {
    R.handL.quaternion.copy(base).multiply(turn.setFromEuler(euler.set(...value)));
    R.handL.updateMatrixWorld(true);
    R.handL.getWorldQuaternion(turn);
    normal.set(0, -1, 0).applyQuaternion(turn).applyQuaternion(rootInverse);
    up.set(0, 0, 1).applyQuaternion(turn).applyQuaternion(rootInverse);
    rollOff = Math.acos(Math.max(-1, Math.min(1, up.y)));
    return Math.acos(Math.max(-1, Math.min(1, normal.dot(SHIELD_FACING))));
  };
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
  const solve = (startShield, startBlade) => {
    const result = { ...out, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
    let shield = startShield;
    const blade = { handR: startBlade.handR, foreR: startBlade.foreR };
    const settled = { shield: null, blade: null };
    for (let i = 0; i < data.times.length; i++) {
      poseFrame(view, result, i);
      view.root.getWorldQuaternion(rootInverse).invert();
      base.copy(R.handL.quaternion);
      const previousShield = shield;
      shield = search(shield, v => facing(v) ** 2 + 0.3 * rollOff ** 2 + 0.02 * v.reduce((a, x) => a + x * x, 0)
        + 0.5 * v.reduce((a, x, k) => a + (x - previousShield[k]) ** 2, 0), 2.2);
      R.handL.quaternion.copy(base).multiply(turn.setFromEuler(euler.set(...shield)));
      R.handL.quaternion.toArray().forEach((v, k) => { result.rotations.handL[i * 4 + k] = +v.toFixed(4); });
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
      if (i === Math.min(2, data.times.length - 1)) {
        settled.shield = shield.slice();
        settled.blade = { handR: blade.handR.slice(), foreR: blade.foreR.slice() };
      }
    }
    return { result, settled };
  };
  const first = solve([0, 0, 0], { handR: [0, 0, 0], foreR: [0, 0, 0] });
  return solve(first.settled.shield, first.settled.blade).result;
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

function poseFrame(view, data, frame) {
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
    const key = basename(file, '.glb');
    const plan = BAKE[key];
    let data = retarget(gltf.scene, source, restHipsY, plan || { inPlace: true });
    report['mixamo:' + key] = score(view, clipFromData(key, data));
    if (preview) {
      await mkdir(preview, { recursive: true });
      await writeFile(join(preview, key + '.json'), JSON.stringify({ source: 'Mixamo: ' + key, ...data }));
    }
    if (out && plan) {
      let extra = {};
      if (plan.strike) {
        const [contact, end] = plan.strike;
        data = retarget(gltf.scene, source, restHipsY, {
          inPlace: plan.inPlace, sourceTimes: strikeTimes(bladeTiming(view, data).contact, source.duration, contact, end)
        });
      }
      if (plan.yawFree) data = stripYaw(data);
      if (plan.gait) data = alignGait(view, data, plan.gait);
      if (plan.fix) data = fixHands(view, data);
      if (plan.floor) data = clearFloor(view, data);
      if (plan.speed) data = { ...data, duration: +(data.duration / plan.speed).toFixed(4), times: data.times.map(t => +(t / plan.speed).toFixed(4)) };
      if (plan.strike) extra = bladeTiming(view, data);
      await mkdir(out, { recursive: true });
      await writeFile(join(out, plan.clip + '.json'), JSON.stringify({ source: 'Mixamo: ' + key, ...extra, ...data }));
      report['baked:' + plan.clip] = { ...score(view, clipFromData(plan.clip, data)), ...extra };
    }
  }
  view.dispose();
  console.log(JSON.stringify(report, null, 1));
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('bake-mixamo.mjs')) await main();
