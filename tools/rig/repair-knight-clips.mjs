// Repairs all 15 baked Knight clips in public/assets/anims/knight/ for true human
// anatomy, symmetric smooth gait mechanics, seamless transitions, and clean sword clearance.
// Usage: node tools/rig/repair-knight-clips.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from './load-chibi.mjs';
import { KnightFootwork } from '../../public/js/three/knight_footwork.js';
import { BodyField } from './body-field.mjs';
import {
  HUMAN_ROM,
  SHIELD_HOLD,
  enforceKnightAnatomy,
  solveAnatomicalArm,
  solveAnatomicalLeg
} from '../../public/js/three/knight_anatomy.js';

const { clamp, smoothstep } = MathUtils;
const DIR = new URL('../../public/assets/anims/knight/', import.meta.url);

const JOINTS = [
  'hips', 'torso', 'head',
  'armL', 'foreL', 'handL',
  'armR', 'foreR', 'handR',
  'legL', 'shinL', 'footL',
  'legR', 'shinR', 'footR'
];
const PARENT = {
  hips: null, torso: 'hips', head: 'torso',
  armL: 'torso', foreL: 'armL', handL: 'foreL',
  armR: 'torso', foreR: 'armR', handR: 'foreR',
  legL: 'hips', shinL: 'legL', footL: 'shinL',
  legR: 'hips', shinR: 'legR', footR: 'shinR'
};
const T_POSE = {};
for (const j of JOINTS) T_POSE[j] = new Quaternion();
for (const j of ['armL', 'foreL', 'handL']) T_POSE[j].setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
for (const j of ['armR', 'foreR', 'handR']) T_POSE[j].setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);

const readClip = async name => JSON.parse(await readFile(new URL(`${name}.json`, DIR), 'utf8'));
const writeClip = async (name, data) => writeFile(new URL(`${name}.json`, DIR), JSON.stringify(data));

function loadWorld(data, frame) {
  const w = {};
  for (const j of JOINTS) {
    const q = new Quaternion().fromArray(data.rotations[j], frame * 4);
    w[j] = PARENT[j] ? w[PARENT[j]].clone().multiply(q) : q;
  }
  return w;
}

function composeWorld(wClip, wBase) {
  const out = {};
  for (const j of JOINTS) out[j] = wClip[j].clone().multiply(T_POSE[j].clone().invert()).multiply(wBase[j]);
  return out;
}

function worldToLocal(w) {
  const loc = {};
  for (const j of JOINTS) loc[j] = PARENT[j] ? w[PARENT[j]].clone().invert().multiply(w[j]) : w[j].clone();
  return loc;
}

function uncorrupt(data, wBase) {
  const out = {
    ...data,
    rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()]))
  };
  let lastEnd = null;
  for (let i = 0; i < data.times.length; i++) {
    const w = composeWorld(loadWorld(data, i), wBase);
    if (i === data.times.length - 1) lastEnd = w;
    const loc = worldToLocal(w);
    for (const j of JOINTS) {
      if (i > 0) {
        const prev = new Quaternion().fromArray(out.rotations[j], (i - 1) * 4);
        if (loc[j].dot(prev) < 0) loc[j].set(-loc[j].x, -loc[j].y, -loc[j].z, -loc[j].w);
      }
      loc[j].toArray().forEach((v, k) => { out.rotations[j][i * 4 + k] = +v.toFixed(4); });
    }
  }
  return { out, lastEnd };
}

function poseFrame(view, data, frame) {
  for (const [joint, values] of Object.entries(data.rotations)) view.R[joint].quaternion.fromArray(values, frame * 4);
  view.R.hips.position.fromArray(data.hips, frame * 3);
  view.root.updateMatrixWorld(true);
}

function writeFrameFromRig(view, data, frame, joints = JOINTS) {
  for (const j of joints) {
    const q = view.R[j].quaternion;
    if (frame > 0) {
      const prev = new Quaternion().fromArray(data.rotations[j], (frame - 1) * 4);
      if (q.dot(prev) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    }
    q.toArray().forEach((v, k) => { data.rotations[j][frame * 4 + k] = +v.toFixed(4); });
  }
  view.R.hips.position.toArray().forEach((v, k) => { data.hips[frame * 3 + k] = +v.toFixed(4); });
}

function ensureQuaternionContinuity(data) {
  const n = data.times.length;
  for (const j of JOINTS) {
    const arr = data.rotations[j];
    for (let i = 1; i < n; i++) {
      let dot = 0;
      for (let k = 0; k < 4; k++) dot += arr[(i - 1) * 4 + k] * arr[i * 4 + k];
      if (dot < 0) for (let k = 0; k < 4; k++) arr[i * 4 + k] = -arr[i * 4 + k];
    }
  }
}

// Smooth a track over frames using a weighted 3-tap binomial filter (preserving endpoints).
function smoothJoints(data, joints, passes = 1, keepEndpoints = true) {
  const n = data.times.length;
  if (n < 3) return;
  const q0 = new Quaternion(), q1 = new Quaternion(), q2 = new Quaternion(), qMid = new Quaternion();
  for (let p = 0; p < passes; p++) {
    for (const j of joints) {
      const src = data.rotations[j].slice();
      for (let i = 0; i < n; i++) {
        if (keepEndpoints && (i === 0 || i === n - 1)) continue;
        const iPrev = i === 0 ? 0 : i - 1;
        const iNext = i === n - 1 ? n - 1 : i + 1;
        q0.fromArray(src, iPrev * 4);
        q1.fromArray(src, i * 4);
        q2.fromArray(src, iNext * 4);
        if (q0.dot(q1) < 0) q0.set(-q0.x, -q0.y, -q0.z, -q0.w);
        if (q2.dot(q1) < 0) q2.set(-q2.x, -q2.y, -q2.z, -q2.w);
        qMid.copy(q0).slerp(q2, 0.5);
        q1.slerp(qMid, 0.35);
        q1.toArray().forEach((v, k) => { data.rotations[j][i * 4 + k] = +v.toFixed(4); });
      }
    }
  }
  ensureQuaternionContinuity(data);
}

// Sanitize arms, neck, shield, and optionally re-solve existing legs with forward knee pole.
function sanitizePoseTracks(view, data, { solveLegs = true, lockShield = true, clampWristR = true, solveArms = true, upperLengths } = {}) {
  const R = view.R;
  const fw = new KnightFootwork(R);
  const footWorldQ = new Quaternion();
  const footPos = new Vector3();
  const kneePos = new Vector3();
  const wristPos = new Vector3();
  const elbowPos = new Vector3();
  const foreWorldQ = new Quaternion();
  const handWorldQ = new Quaternion();
  const parentQ = new Quaternion();
  const e = new Euler();

  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, data, i);

    // Fix any broken elbows / off-axis forearms cleanly via 2-bone anatomical arm solve.
    if (solveArms) {
      for (const [side, sgn] of [['L', 1], ['R', -1]]) {
        const arm = R['arm' + side], fore = R['fore' + side], hand = R['hand' + side];
        e.setFromQuaternion(fore.quaternion, 'XYZ');
        const badElbow = e.x > -HUMAN_ROM.elbowFlexMin || e.x < -HUMAN_ROM.elbowFlexMax || Math.abs(e.z) > 0.02 || Math.abs(e.y) > HUMAN_ROM.elbowPronationMax;
        if (badElbow) {
          hand.getWorldPosition(wristPos);
          fore.getWorldPosition(elbowPos);
          fore.getWorldQuaternion(foreWorldQ);
          hand.getWorldQuaternion(handWorldQ);
          const shPos = arm.getWorldPosition(new Vector3());
          const mid = shPos.clone().add(wristPos).multiplyScalar(0.5);
          const pole = elbowPos.clone().sub(mid);
          // If elbow was hyperextended, push pole naturally backward/outward from torso.
          if (e.x > -HUMAN_ROM.elbowFlexMin || pole.lengthSq() < 1e-4) {
            const tq = R.torso.getWorldQuaternion(new Quaternion());
            pole.set(sgn * 0.45, -0.25, -0.85).applyQuaternion(tq);
          }
          solveAnatomicalArm(R.torso, arm, fore, hand, wristPos, upperLengths.arm, upperLengths.fore, sgn, pole, foreWorldQ);
          R.root.updateMatrixWorld(true);
          if (side === 'R' && clampWristR) {
            hand.parent.getWorldQuaternion(parentQ);
            hand.quaternion.copy(parentQ.invert().multiply(handWorldQ));
          }
        }
      }
    }

    // Re-solve legs through forward-pole anatomical IK while preserving world ankle positions & foot tilt.
    if (solveLegs) {
      for (const [side, leg, sgn] of [['L', fw.legs[0], 1], ['R', fw.legs[1], -1]]) {
        leg.ankle.getWorldPosition(footPos);
        leg.knee.getWorldPosition(kneePos);
        leg.ankle.getWorldQuaternion(footWorldQ);
        solveAnatomicalLeg(R.hips, leg.thigh, leg.knee, leg.ankle, footPos, leg.upper, leg.lower, sgn, kneePos);
        R.hips.updateMatrixWorld(true);
        leg.ankle.parent.getWorldQuaternion(parentQ);
        leg.ankle.quaternion.copy(parentQ.invert().multiply(footWorldQ));
      }
    }

    enforceKnightAnatomy(R, { lockShield, clampWristR, softenKnees: !solveLegs });
    R.root.updateMatrixWorld(true);
    writeFrameFromRig(view, data, i);
  }
  ensureQuaternionContinuity(data);
  return data;
}

// Anatomical BodyField clearance (same constraint logic as fixHands in bake-mixamo.mjs).
function clearSwordCollision(view, data, radius = 0.45, helmetMin = 0.30) {
  const R = view.R;
  const field = new BodyField(view);
  const swordSamples = [];
  {
    const q = new Vector3();
    R.swordMount.updateWorldMatrix(true, false);
    for (const mesh of field.sword) {
      mesh.updateWorldMatrix(true, false);
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 4) {
        swordSamples.push(R.swordMount.worldToLocal(q.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).clone()));
      }
    }
  }
  const world = new Vector3();
  const penetration = () => {
    let sum = 0;
    for (const sample of swordSamples) {
      const { depth } = field.depth(world.copy(sample).applyMatrix4(R.swordMount.matrixWorld));
      sum += depth * depth;
    }
    return sum;
  };
  const base = new Quaternion();
  const turn = new Quaternion();
  const euler = new Euler();
  const head = new Vector3();
  const bladeBase = new Vector3();
  const bladeTip = new Vector3();
  const along = new Vector3();
  const nearest = new Vector3();
  const applyAnat = (joint, value) => {
    if (joint === 'foreR') {
      euler.setFromQuaternion(base.clone().multiply(turn.setFromEuler(euler.set(...value))), 'XYZ');
      euler.x = clamp(euler.x, -HUMAN_ROM.elbowFlexMax, -HUMAN_ROM.elbowFlexMin);
      euler.y = clamp(euler.y, -HUMAN_ROM.elbowPronationMax, HUMAN_ROM.elbowPronationMax);
      euler.z = 0;
      R[joint].quaternion.setFromEuler(euler);
    } else if (joint === 'handR') {
      euler.setFromQuaternion(base.clone().multiply(turn.setFromEuler(euler.set(...value))), 'XYZ');
      euler.x = clamp(euler.x, -HUMAN_ROM.wristXMax, HUMAN_ROM.wristXMax);
      euler.y = clamp(euler.y, -HUMAN_ROM.wristYMax, HUMAN_ROM.wristYMax);
      euler.z = clamp(euler.z, -HUMAN_ROM.wristZMax, HUMAN_ROM.wristZMax);
      R[joint].quaternion.setFromEuler(euler);
    } else {
      R[joint].quaternion.copy(base).multiply(turn.setFromEuler(euler.set(...value)));
    }
  };
  const clearance = (joint, value) => {
    applyAnat(joint, value);
    R[joint].updateMatrixWorld(true);
    R.head.getWorldPosition(head).y += 0.22;
    R.swordMount.localToWorld(bladeBase.set(0, 0, 0.16));
    R.swordMount.localToWorld(bladeTip.set(0, 0, 1.04));
    along.subVectors(bladeTip, bladeBase);
    const k = clamp(head.clone().sub(bladeBase).dot(along) / along.lengthSq(), 0, 1);
    return nearest.copy(bladeBase).addScaledVector(along, k).distanceTo(head);
  };
  const search = (start, cost, limit, anchor, r) => {
    const value = start.slice();
    const low = axis => Math.max(-limit, anchor[axis] - r);
    const high = axis => Math.min(limit, anchor[axis] + r);
    for (let axis = 0; axis < 3; axis++) value[axis] = clamp(value[axis], low(axis), high(axis));
    let best = cost(value);
    for (let step = 0.35; step > 0.015; step *= 0.55) {
      for (let round = 0; round < 8; round++) {
        let improved = false;
        for (let axis = 0; axis < 3; axis++) for (const delta of [step, -step]) {
          const old = value[axis];
          value[axis] = clamp(old + delta, low(axis), high(axis));
          const c = cost(value);
          if (c < best - 1e-6) { best = c; improved = true; } else value[axis] = old;
        }
        if (!improved) break;
      }
    }
    return value;
  };
  const JOINTS_R = ['handR', 'foreR', 'armR'];
  const SPRING = { handR: 0.05, foreR: 0.05, armR: 0.15 };
  const frames = data.times.length;
  const solve = (guide = null) => {
    const result = { ...data, rotations: Object.fromEntries(Object.entries(data.rotations).map(([k, v]) => [k, v.slice()])) };
    const track = Object.fromEntries(JOINTS_R.map(j => [j, []]));
    const blade = { handR: [0, 0, 0], foreR: [0, 0, 0], armR: [0, 0, 0] };
    for (let i = 0; i < frames; i++) {
      poseFrame(view, result, i);
      field.build();
      for (const joint of JOINTS_R) {
        base.copy(R[joint].quaternion);
        let previous = blade[joint];
        let start = previous;
        let pull = 0.35;
        const cleanAtZero = clearance(joint, [0, 0, 0]) >= helmetMin && penetration() < 1e-6;
        if (guide) {
          const before = guide[joint][Math.max(0, i - 1)];
          const after = guide[joint][Math.min(frames - 1, i + 1)];
          previous = before.map((x, k) => (x + after[k]) / 2);
          start = guide[joint][i];
          pull = 2.0;
          if (cleanAtZero && previous.every(x => Math.abs(x) < 1e-3) && start.every(x => Math.abs(x) < 1e-3)) {
            blade[joint] = [0, 0, 0];
            track[joint].push([0, 0, 0]);
            R[joint].quaternion.copy(base);
            R[joint].updateMatrixWorld(true);
            continue;
          }
        } else if (cleanAtZero && previous.every(x => Math.abs(x) < 1e-3)) {
          blade[joint] = [0, 0, 0];
          track[joint].push([0, 0, 0]);
          R[joint].quaternion.copy(base);
          R[joint].updateMatrixWorld(true);
          continue;
        } else if (clearance(joint, previous) >= helmetMin && penetration() < 1e-4) {
          start = previous.map(x => x * 0.85);
        }
        blade[joint] = search(
          start,
          v => Math.max(0, helmetMin - clearance(joint, v)) ** 2 * 220
            + penetration() * 80000
            + SPRING[joint] * v.reduce((a, x) => a + x * x, 0)
            + pull * v.reduce((a, x, k) => a + (x - previous[k]) ** 2, 0),
          1.4,
          previous,
          radius
        );
        track[joint].push(blade[joint].slice());
        applyAnat(joint, blade[joint]);
        R[joint].updateMatrixWorld(true);
        R[joint].quaternion.toArray().forEach((v, k) => { result.rotations[joint][i * 4 + k] = +v.toFixed(4); });
      }
    }
    return { result, track };
  };
  const first = solve();
  const final = solve(first.track).result;
  ensureQuaternionContinuity(final);
  return final;
}

// Compute blade contact and trail window around target contact time.
function bladeWindowAt(view, data, contact) {
  const tip = new Vector3();
  const prev = new Vector3();
  const speeds = [];
  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, data, i);
    view.R.swordMount.localToWorld(tip.set(0, 0, 1.04));
    speeds.push(i ? tip.distanceTo(prev) / Math.max(1e-4, data.times[i] - data.times[i - 1]) : 0);
    prev.copy(tip);
  }
  const at = data.times.reduce((best, t, i) => (Math.abs(t - contact) < Math.abs(data.times[best] - contact) ? i : best), 0);
  const near = speeds.slice(Math.max(1, at - 2), at + 3);
  const ref = Math.max(...near, 1e-4);
  let first = at, last = at;
  while (first > 1 && speeds[first - 1] > ref * 0.35) first--;
  while (last < speeds.length - 1 && speeds[last + 1] > ref * 0.35) last++;
  return { contact: data.times[at], trail: [data.times[Math.max(0, first - 1)], data.times[last]] };
}

// Re-sample a periodic loop at dense uniform timestamps using slerp/lerp.
function resampleLoop(data, newDuration, numSteps) {
  const n = data.times.length - 1;
  const oldDur = data.duration;
  const out = {
    ...data,
    duration: +newDuration.toFixed(4),
    times: [],
    hips: [],
    rotations: Object.fromEntries(JOINTS.map(j => [j, []]))
  };
  const q0 = new Quaternion(), q1 = new Quaternion();
  for (let s = 0; s <= numSteps; s++) {
    const u = s / numSteps;
    const tOld = (u % 1) * oldDur;
    let i0 = 0;
    while (i0 < n - 1 && data.times[i0 + 1] <= tOld) i0++;
    const i1 = i0 + 1;
    const span = data.times[i1] - data.times[i0] || 1;
    const a = clamp((tOld - data.times[i0]) / span, 0, 1);
    out.times.push(+(u * newDuration).toFixed(4));
    for (let k = 0; k < 3; k++) {
      const p0 = data.hips[i0 * 3 + k];
      const p1 = data.hips[i1 * 3 + k];
      out.hips.push(+(p0 + (p1 - p0) * a).toFixed(4));
    }
    for (const j of JOINTS) {
      q0.fromArray(data.rotations[j], i0 * 4);
      q1.fromArray(data.rotations[j], i1 * 4);
      q0.slerp(q1, a);
      if (s > 0) {
        const prev = new Quaternion().fromArray(out.rotations[j], (s - 1) * 4);
        if (q0.dot(prev) < 0) q0.set(-q0.x, -q0.y, -q0.z, -q0.w);
      }
      q0.toArray().forEach(v => out.rotations[j].push(+v.toFixed(4)));
    }
  }
  return out;
}

// Build symmetric, C2-smooth, biomechanically accurate gait legs + pelvis bounce on top of
// the sanitized upper body of walk/run.
function buildHumanGait(view, rawData, cfg) {
  const { speed, duration, stance, strideLen, lateral, liftHeight, heelKick, bounceAmp, hipsBaseY, leanPitch, footPitchStance, swingPitchAmp } = cfg;
  const steps = Math.round(duration * 60);
  const data = resampleLoop(rawData, duration, steps);
  const R = view.R;
  const fw = new KnightFootwork(R);
  const restFootY = R.restFootY;
  const s = R.rigScale;
  const e = new Euler();
  const qFoot = new Quaternion();
  const qParent = new Quaternion();
  const qHips = new Quaternion();
  const footTarget = new Vector3();

  // Compute exact symmetric foot target & ankle tilt for one leg given its cycle u in [0, 1).
  // u = 0 is heel strike; u in [0, stance] is ground contact stance; u in [stance, 1) is swing.
  const legTrajectory = (u, sideSign) => {
    const halfStride = strideLen * 0.5;
    let z, y, pitch, yawOut;
    yawOut = sideSign * 0.08;
    if (u <= stance) {
      const p = u / stance; // 0..1 during stance
      // Linear backward sweep relative to advancing body so planted foot holds still on ground!
      z = halfStride - strideLen * p;
      // Heel strike (p=0): ankle slightly higher by ~0.012, flat mid-stance, toe push-off lift at end.
      const heelFade = 1 - smoothstep(p, 0, 0.22);
      const pushRise = smoothstep(p, 0.72, 1.0);
      y = restFootY + 0.010 * heelFade + 0.032 * pushRise;
      // Dorsiflex at heel strike (-0.22 rad) -> flat (0) -> plantarflex at toe-off (+0.38 rad)
      pitch = -footPitchStance * heelFade + (footPitchStance * 1.45) * pushRise;
    } else {
      const p = (u - stance) / (1 - stance); // 0..1 during swing
      // Smooth C1 cubic Hermite position matching stance endpoints:
      // at p=0: z = -halfStride, dz/dp = -strideLen*(1-stance)/stance? Use smoothstep with follow-through!
      const rearKick = Math.sin(p * Math.PI) * (p < 0.55 ? 1 : 0.4);
      const zCurve = smoothstep(p, 0.06, 0.96);
      z = -halfStride + strideLen * zCurve - heelKick * 0.14 * Math.sin(p * Math.PI * 1.15) * (1 - p);
      // Smooth bell arch for foot clearance + heel kick behind hip in run
      const arch = Math.pow(Math.sin(p * Math.PI), 0.85);
      y = restFootY + 0.032 * (1 - smoothstep(p, 0, 0.25)) + liftHeight * arch + 0.010 * smoothstep(p, 0.82, 1.0);
      // Toe clears ground mid-swing, dorsiflexes before heel strike
      pitch = (footPitchStance * 1.45) * (1 - smoothstep(p, 0, 0.35))
        - swingPitchAmp * Math.sin(p * Math.PI)
        - footPitchStance * smoothstep(p, 0.75, 1.0);
    }
    return { x: sideSign * lateral, y, z, pitch, yawOut };
  };

  for (let i = 0; i <= steps; i++) {
    const phase = (i / steps) % 1;
    poseFrame(view, data, i);

    // Smooth upper-body forward lean & double-frequency pelvis vertical oscillation
    // Lowest hips at mid-loading (~0.14, 0.64), highest at push-off/flight (~0.40, 0.90).
    const strideWave = Math.sin((phase - 0.26) * Math.PI * 4);
    const hipY = hipsBaseY + bounceAmp * strideWave;
    R.hips.position.set(
      0.012 * Math.sin(phase * Math.PI * 2),
      hipY / s,
      0
    );

    // Gentle symmetric pelvic yaw + Trendelenburg roll + forward lean
    const hipYaw = -0.11 * Math.cos(phase * Math.PI * 2);
    const hipRoll = -0.04 * Math.sin(phase * Math.PI * 2);
    R.hips.quaternion.setFromEuler(e.set(leanPitch * 0.25, hipYaw, hipRoll, 'YXZ'));

    // Counter-rotate torso slightly so chest stays balanced; stabilize head forward.
    e.setFromQuaternion(R.torso.quaternion, 'YXZ');
    e.x = clamp(leanPitch * 0.78 + 0.04 * strideWave, -0.3, 0.55);
    e.y = clamp(-hipYaw * 1.15, -0.45, 0.45);
    e.z = clamp(-hipRoll * 0.7, -0.15, 0.15);
    const torsoYaw = e.y;
    R.torso.quaternion.setFromEuler(e);

    e.setFromQuaternion(R.head.quaternion, 'YXZ');
    e.x = clamp(-leanPitch * 0.72, -0.55, 0.35);
    e.y = clamp(-(hipYaw + torsoYaw) * 0.65, -0.35, 0.35);
    e.z = 0;
    R.head.quaternion.setFromEuler(e);

    R.hips.updateMatrixWorld(true);
    R.hips.getWorldQuaternion(qHips);

    for (const [sideIdx, leg, sideSign] of [[0, fw.legs[0], 1], [1, fw.legs[1], -1]]) {
      const u = (phase + sideIdx * 0.5) % 1;
      const tr = legTrajectory(u, sideSign);
      footTarget.set(tr.x, tr.y, tr.z);
      solveAnatomicalLeg(R.hips, leg.thigh, leg.knee, leg.ankle, footTarget, leg.upper, leg.lower, sideSign);
      R.hips.updateMatrixWorld(true);
      leg.ankle.parent.getWorldQuaternion(qParent);
      qFoot.setFromEuler(e.set(tr.pitch, tr.yawOut, 0, 'YXZ'));
      leg.ankle.quaternion.copy(qParent.invert().multiply(qFoot));
    }

    enforceKnightAnatomy(R, { lockShield: true, clampWristR: true, softenKnees: false });
    R.root.updateMatrixWorld(true);
    writeFrameFromRig(view, data, i);
  }
  // Ensure loop periodicity: frame[steps] === frame[0]
  for (const j of JOINTS) {
    for (let k = 0; k < 4; k++) data.rotations[j][steps * 4 + k] = data.rotations[j][k];
  }
  for (let k = 0; k < 3; k++) data.hips[steps * 3 + k] = data.hips[k];
  ensureQuaternionContinuity(data);
  data.groundSpeed = speed;
  data.stance = +stance.toFixed(3);
  return data;
}

// Re-solve legs cleanly on attack1/2/3 with planted human combat footwork matching hips yaw.
function buildCombatFootwork(view, data, opts) {
  const R = view.R;
  const fw = new KnightFootwork(R);
  const restFootY = R.restFootY;
  const s = R.rigScale;
  const { leadFoot, footLBase, footRBase, stepPhase, stepReach, hipsBaseY } = opts;
  const qParent = new Quaternion();
  const qFoot = new Quaternion();
  const e = new Euler();
  const target = new Vector3();

  for (let i = 0; i < data.times.length; i++) {
    poseFrame(view, data, i);
    const u = data.times[i] / data.duration;
    // Smooth stepping lunge progression: settle into wide planted stance by contact, hold, recover slightly.
    const stepIn = smoothstep(u, stepPhase[0], stepPhase[1]);
    const recover = smoothstep(u, 0.72, 1.0);
    const k = stepIn * (1 - 0.35 * recover);
    // Slight step lift mid-step so lead foot steps naturally rather than dragging.
    const stepLift = Math.sin(clamp((u - stepPhase[0]) / Math.max(0.05, stepPhase[1] - stepPhase[0]), 0, 1) * Math.PI) * 0.045;

    const drop = 0.08 * stepIn * (1 - 0.35 * recover);
    R.hips.position.set(0, (hipsBaseY - drop) / s, 0.05 * k);
    R.hips.updateMatrixWorld(true);

    const posL = new Vector3(
      footLBase[0],
      restFootY + (leadFoot === 'L' ? stepLift : 0),
      footLBase[2] + (leadFoot === 'L' ? stepReach * k : -stepReach * 0.35 * k)
    );
    const posR = new Vector3(
      footRBase[0],
      restFootY + (leadFoot === 'R' ? stepLift : 0),
      footRBase[2] + (leadFoot === 'R' ? stepReach * k : -stepReach * 0.35 * k)
    );

    // Keep ankle distance from hip strictly within leg reach so knees remain gently flexed!
    const hipW = R.hips.getWorldPosition(new Vector3());
    for (const [leg, p, sgn, yaw] of [[fw.legs[0], posL, 1, 0.22], [fw.legs[1], posR, -1, -0.24]]) {
      const d = p.distanceTo(hipW);
      const maxD = leg.upper + leg.lower - 0.035;
      if (d > maxD) {
        const excess = d - maxD;
        R.hips.position.y -= excess / s;
        R.hips.updateMatrixWorld(true);
        hipW.copy(R.hips.getWorldPosition(new Vector3()));
      }
      target.copy(p);
      solveAnatomicalLeg(R.hips, leg.thigh, leg.knee, leg.ankle, target, leg.upper, leg.lower, sgn);
      R.hips.updateMatrixWorld(true);
      leg.ankle.parent.getWorldQuaternion(qParent);
      qFoot.setFromEuler(e.set(0, yaw, 0, 'YXZ'));
      leg.ankle.quaternion.copy(qParent.invert().multiply(qFoot));
    }
    enforceKnightAnatomy(R, { lockShield: true, clampWristR: true, softenKnees: false });
    R.root.updateMatrixWorld(true);
    writeFrameFromRig(view, data, i);
  }
  ensureQuaternionContinuity(data);
  return data;
}

// Re-solve athletic human jump & fall leg arcs on the un-corrupted upper body.
function buildJumpFallLegs(view, jumpData, fallData) {
  const R = view.R;
  const fw = new KnightFootwork(R);
  const restFootY = R.restFootY;
  const s = R.rigScale;
  const qParent = new Quaternion();
  const qFoot = new Quaternion();
  const e = new Euler();
  const target = new Vector3();

  const applyAirLegs = (data, getArc) => {
    for (let i = 0; i < data.times.length; i++) {
      poseFrame(view, data, i);
      const u = data.times[i] / data.duration;
      const arc = getArc(u);
      R.hips.position.set(0, arc.hipsY / s, 0);
      R.hips.updateMatrixWorld(true);
      for (const [leg, cfg, sgn] of [[fw.legs[0], arc.L, 1], [fw.legs[1], arc.R, -1]]) {
        target.set(cfg.x, cfg.y, cfg.z);
        solveAnatomicalLeg(R.hips, leg.thigh, leg.knee, leg.ankle, target, leg.upper, leg.lower, sgn);
        R.hips.updateMatrixWorld(true);
        leg.ankle.parent.getWorldQuaternion(qParent);
        qFoot.setFromEuler(e.set(cfg.pitch, sgn * 0.08, 0, 'YXZ'));
        leg.ankle.quaternion.copy(qParent.invert().multiply(qFoot));
      }
      enforceKnightAnatomy(R, { lockShield: true, clampWristR: true, softenKnees: false });
      R.root.updateMatrixWorld(true);
      writeFrameFromRig(view, data, i);
    }
    ensureQuaternionContinuity(data);
  };

  // Jump: push off through balls of feet (u=0..0.25) -> tuck knees forward-up toward apex (u=1.0).
  const apexL = { x: 0.11, y: 0.44, z: 0.21, pitch: 0.36 };
  const apexR = { x: -0.11, y: 0.34, z: -0.10, pitch: 0.46 };
  applyAirLegs(jumpData, u => {
    const k = smoothstep(u, 0.05, 0.95);
    return {
      hipsY: 0.78 + 0.03 * Math.sin(u * Math.PI),
      L: {
        x: 0.10 + (apexL.x - 0.10) * k,
        y: restFootY + (apexL.y - restFootY) * k,
        z: 0.12 + (apexL.z - 0.12) * k,
        pitch: 0.55 * (1 - k) + apexL.pitch * k
      },
      R: {
        x: -0.10 + (apexR.x + 0.10) * k,
        y: restFootY + (apexR.y - restFootY) * k,
        z: -0.16 + (apexR.z + 0.16) * k,
        pitch: 0.60 * (1 - k) + apexR.pitch * k
      }
    };
  });

  // Fall: start seamlessly at jump's exact apex pose, then extend legs smoothly toward landing readiness.
  const landL = { x: 0.10, y: 0.19, z: 0.16, pitch: 0.12 };
  const landR = { x: -0.10, y: 0.21, z: -0.13, pitch: 0.20 };
  applyAirLegs(fallData, u => {
    const k = smoothstep(u, 0.05, 0.95);
    return {
      hipsY: 0.78 - 0.03 * k,
      L: {
        x: apexL.x + (landL.x - apexL.x) * k,
        y: apexL.y + (landL.y - apexL.y) * k,
        z: apexL.z + (landL.z - apexL.z) * k,
        pitch: apexL.pitch + (landL.pitch - apexL.pitch) * k
      },
      R: {
        x: apexR.x + (landR.x - apexR.x) * k,
        y: apexR.y + (landR.y - apexR.y) * k,
        z: apexR.z + (landR.z - apexR.z) * k,
        pitch: apexR.pitch + (landR.pitch - apexR.pitch) * k
      }
    };
  });
}

async function main() {
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
  const want = name => !only || only.has(name);
  const { ChibiView } = await loadChibiViews();
  const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
  const view = new ChibiView({ heroId: 'knight', gear, x: 0, y: 0, z: 0, facing: Math.PI / 2, grounded: true });
  const R = view.R;
  const upperLengths = {
    arm: R.foreL.position.length() * R.rigScale,
    fore: R.handL.position.length() * R.rigScale
  };

  const idle = await readClip('idle');
  const wIdle0 = loadWorld(idle, 0);

  // 1. Un-corrupt & repair attack1, attack2, attack3
  if (want('attack1') || want('attack2') || want('attack3')) {
    const rawA1 = await readClip('attack1');
    const rawA2 = await readClip('attack2');
    const rawA3 = await readClip('attack3');
    const { out: a1Unc, lastEnd: wA1End } = uncorrupt(rawA1, wIdle0);
    const { out: a2Unc, lastEnd: wA2End } = uncorrupt(rawA2, wA1End);
    const { out: a3Unc } = uncorrupt(rawA3, wA2End);

    if (want('attack1')) {
      let a1 = buildCombatFootwork(view, a1Unc, {
        leadFoot: 'L', footLBase: [0.11, 0, 0.14], footRBase: [-0.11, 0, -0.14], stepPhase: [0.05, 0.35], stepReach: 0.16, hipsBaseY: 0.74
      });
      sanitizePoseTracks(view, a1, { solveLegs: true, lockShield: true, clampWristR: true, solveArms: true, upperLengths });
      smoothJoints(a1, ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'handR'], 1);
      a1 = clearSwordCollision(view, a1, 0.50);
      Object.assign(a1, bladeWindowAt(view, a1, rawA1.contact));
      await writeClip('attack1', a1);
    }

    if (want('attack2')) {
      let a2 = buildCombatFootwork(view, a2Unc, {
        leadFoot: 'R', footLBase: [0.11, 0, -0.10], footRBase: [-0.11, 0, 0.08], stepPhase: [0.05, 0.35], stepReach: 0.15, hipsBaseY: 0.73
      });
      sanitizePoseTracks(view, a2, { solveLegs: true, lockShield: true, clampWristR: true, solveArms: true, upperLengths });
      smoothJoints(a2, ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'handR'], 1);
      a2 = clearSwordCollision(view, a2, 0.50);
      Object.assign(a2, bladeWindowAt(view, a2, rawA2.contact));
      await writeClip('attack2', a2);
    }

    if (want('attack3')) {
      let a3 = buildCombatFootwork(view, a3Unc, {
        leadFoot: 'L', footLBase: [0.12, 0, 0.12], footRBase: [-0.12, 0, -0.14], stepPhase: [0.08, 0.40], stepReach: 0.18, hipsBaseY: 0.72
      });
      sanitizePoseTracks(view, a3, { solveLegs: true, lockShield: true, clampWristR: true, solveArms: true, upperLengths });
      smoothJoints(a3, ['torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'handR'], 1);
      a3 = clearSwordCollision(view, a3, 0.55);
      Object.assign(a3, bladeWindowAt(view, a3, rawA3.contact));
      await writeClip('attack3', a3);
    }
  }

  // 2. Un-corrupt & repair jump and fall (seamless apex continuity!)
  if (want('jump') || want('fall')) {
    const rawJump = await readClip('jump');
    const rawFall = await readClip('fall');
    const { out: jumpUnc, lastEnd: wJumpEnd } = uncorrupt(rawJump, wIdle0);
    const { out: fallUnc } = uncorrupt(rawFall, wJumpEnd);
    buildJumpFallLegs(view, jumpUnc, fallUnc);
    sanitizePoseTracks(view, jumpUnc, { solveLegs: true, lockShield: true, clampWristR: true, solveArms: true, upperLengths });
    sanitizePoseTracks(view, fallUnc, { solveLegs: true, lockShield: true, clampWristR: true, solveArms: true, upperLengths });
    for (const j of ['hips', 'torso', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR']) {
      const last = jumpUnc.rotations[j].slice(-4);
      for (let k = 0; k < 4; k++) fallUnc.rotations[j][k] = last[k];
    }
    if (want('jump')) await writeClip('jump', clearSwordCollision(view, jumpUnc, 0.45));
    if (want('fall')) await writeClip('fall', clearSwordCollision(view, fallUnc, 0.45));
  }

  // 3. Rebuild walk and run with symmetric, C2-smooth human gait legs + clean upper body
  if (want('walk')) {
    const rawWalk = await readClip('walk');
    let walk = buildHumanGait(view, rawWalk, {
      speed: 5.4, duration: 0.36, stance: 0.36, strideLen: 0.62, lateral: 0.08,
      liftHeight: 0.135, heelKick: 0.25, bounceAmp: 0.022, hipsBaseY: 0.742,
      leanPitch: 0.18, footPitchStance: 0.20, swingPitchAmp: 0.14
    });
    walk = clearSwordCollision(view, walk, 0.45, 0.34);
    await writeClip('walk', walk);
  }

  if (want('run')) {
    const rawRun = await readClip('run');
    let run = buildHumanGait(view, rawRun, {
      speed: 7.5, duration: 0.34, stance: 0.28, strideLen: 0.68, lateral: 0.075,
      liftHeight: 0.24, heelKick: 0.85, bounceAmp: 0.036, hipsBaseY: 0.725,
      leanPitch: 0.32, footPitchStance: 0.24, swingPitchAmp: 0.32
    });
    run = clearSwordCollision(view, run, 0.40, 0.32);
    await writeClip('run', run);
  }

  // 4. Sanitize all remaining baked clips (idle, idleFidget, guard, guardHit, turnL, turnR, draw, dead)
  for (const name of ['idle', 'idleFidget', 'guard', 'guardHit', 'turnL', 'turnR', 'draw', 'dead']) {
    if (!want(name)) continue;
    let data = await readClip(name);
    const isDead = name === 'dead';
    sanitizePoseTracks(view, data, {
      solveLegs: !isDead,
      lockShield: !isDead,
      clampWristR: !isDead,
      solveArms: true,
      upperLengths
    });
    if (!isDead) {
      data = clearSwordCollision(view, data, name.startsWith('turn') ? 0.55 : 0.35);
    }
    await writeClip(name, data);
  }

  view.dispose();
  console.log('Repaired all 15 baked Knight clips cleanly.');
}

await main();
