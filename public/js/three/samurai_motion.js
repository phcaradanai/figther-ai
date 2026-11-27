import { dirOf, solveBlade } from './blade_solver.js';

// Natural swordswoman locomotion, jump, guard and reaction clips calibrated to the skinned Samurai's exact
// proportions (hero id `samurai`, katana in the right fist, left hand free).

// Leg geometry of the skinned Samurai, in rig units (hipHeight=0.8356, HIPS_Y=0.62).
// Printed by tools/rig/build_samurai.py as LEG_RIG.
const THIGH = 0.2938;
const SHIN = 0.2473;
const THIGH_REST = -0.0082;
const SHIN_REST = 0.1069;
const ANKLE = 0.0927;
const PIVOT = 0.0058;
const KNEE_REST_OFFSET = SHIN_REST - THIGH_REST;
// Her legs are 6% longer than the Archmage's; the shared gait tables were tuned on 0.507.
const LIFT = (THIGH + SHIN) - 0.5073;

// Right arm in torso space (rig units), from the build script's joints; the grip is where the fist closes
export const SWORD_ARM = { shoulder: [-0.1333, 0.2693, 0], upper: 0.151, lower: 0.1333, grip: [0.0297, -0.0631, 0] };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Two-bone leg angles that place a flat sole at `reach` ahead of its hip with strictly anatomical knee flexion
export function samuraiPlant(hipsY, pitch, reach, spread) {
  const drop = (hipsY - PIVOT - ANKLE) / Math.cos(spread);
  const distance = Math.min(Math.hypot(reach, drop), THIGH + SHIN - 0.008);
  const line = Math.atan2(-reach, drop);
  const open = Math.acos(clamp((THIGH ** 2 + distance ** 2 - SHIN ** 2) / (2 * THIGH * distance), -1, 1));
  const thigh = line - open;
  const kneeZ = -THIGH * Math.sin(thigh);
  const kneeY = -THIGH * Math.cos(thigh);
  const shin = Math.atan2(-(-distance * Math.sin(line) - kneeZ), -(-distance * Math.cos(line) - kneeY));
  const leg = thigh - pitch - THIGH_REST;
  const knee = Math.max(0.14, shin - thigh - KNEE_REST_OFFSET);
  return [leg, knee, clamp(-(pitch + leg + knee), -0.85, 0.90)];
}

export function samuraiStance(hipsY, pitch, [leftReach, leftSpread], [rightReach, rightSpread]) {
  const [legL, shinL, footL] = samuraiPlant(hipsY, pitch, leftReach, leftSpread);
  const [legR, shinR, footR] = samuraiPlant(hipsY, pitch, rightReach, rightSpread);
  return {
    hipsY,
    legL: [legL, 0.04, leftSpread], shinL: [shinL, 0, 0], footL: [footL, 0, -leftSpread * 0.7],
    legR: [legR, -0.04, -rightSpread], shinR: [shinR, 0, 0], footR: [footR, 0, rightSpread * 0.7]
  };
}

// The sword arm for a wanted blade direction (model frame) and grip place (torso space); `body` carries the hips and
// torso Euler angles of the same pose. Returns { armR, foreR, handR } ready to merge into a pose.
export function swordArm(body, blade, at = null, fore = -0.9) {
  const s = solveBlade(SWORD_ARM, body.hips || [0, 0, 0], body.torso || [0, 0, 0], blade, { fore, at });
  return { armR: s.arm, foreR: s.fore, handR: s.hand };
}
export { dirOf };

// Poised stance: blade held low and forward (chudan), the point at her opponent's throat, free hand relaxed
export function samuraiIdle(ready, pose) {
  const body = { hips: [0.05, -0.08, -0.02], torso: [0.05, -0.12, 0.01] };
  return pose(ready, samuraiStance(0.562 + LIFT * 0.4, 0.05, [0.12, 0.07], [-0.14, 0.07]), {
    ...body,
    head: [-0.08, 0.14, -0.01],
    ...swordArm(body, dirOf(0.12, 0.55), [-0.07, 0.17, 0.17], -1.05),
    armL: [-0.22, 0, 0.30], foreL: [-0.85, -0.10, 0], handL: [0.10, 0, 0]
  });
}

export function buildSamuraiLocomotion(makeClip, ready, pose) {
  const idle = samuraiIdle(ready, pose);
  const H = LIFT * 0.4;
  const breathe = pose(idle, samuraiStance(0.556 + H, 0.06, [0.12, 0.07], [-0.14, 0.07]), {
    torso: [0.08, -0.12, 0.02], head: [-0.10, 0.14, -0.01],
    armL: [-0.25, 0, 0.30], foreL: [-0.90, -0.10, 0]
  });

  // Athletic stride. Columns: [phase, [leadLegX, leadShinX, leadFootX], [trailLegX, trailShinX, trailFootX], hipsRise, yawSign, armSwing]
  const STRIDE = [
    [0.00, [-0.66, 0.30, -0.14], [0.46, 0.94, 0.40], -0.014, 1.0, 1.00],
    [0.09, [-0.34, 0.54, 0.02],  [0.28, 1.62, 0.46], -0.006, 0.65, 0.78],
    [0.20, [0.02, 0.38, 0.14],   [-0.44, 1.78, 0.30], -0.010, 0.0, 0.20],
    [0.31, [0.38, 0.52, 0.42],   [-0.84, 1.48, 0.16],  0.018, -0.55, -0.45],
    [0.42, [0.50, 0.86, 0.38],   [-0.78, 0.92, -0.04], 0.036, -0.85, -0.85]
  ];
  const TRACK = 0.055;

  // The sword hand stays steady (only the elbow breathes with the stride); the free arm pumps
  function buildGait(name, duration, speedMeta, hipsBase, lean, step, swing, carry) {
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const sw = arm * side;
        const twist = -0.09 * turn * side;
        const chest = -twist * 1.3;
        const body = { hips: [lean * 0.35, twist - 0.05, -0.025 * turn * side], torso: [lean + 0.03 * (0.5 - rise / 0.04), chest - 0.08, 0.03 * side] };
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          ...body,
          hipsOffset: [0.010 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: hipsBase + H + rise * 0.9,
          head: [-(lean * 0.9), -chest * 0.7 - twist * 0.5 + 0.10, -0.02 * side],
          ...swordArm(body, dirOf(0.10 - chest * 0.5, carry + 0.05 * sw), [-0.08, 0.15 + 0.01 * sw, 0.16], -1.15),
          armL: [-0.20 + swing * sw, 0, 0.26], foreL: [-0.85 - 0.12 * sw, -0.10, 0], handL: [0.10, 0, 0],
          ['leg' + lead]: [lt * step, 0, -TRACK * side],
          ['shin' + lead]: [Math.max(0.16, lk * step), 0, 0],
          ['foot' + lead]: [la * (step - 0.02), 0, TRACK * side * 0.7],
          ['leg' + trail]: [tt * step, 0, TRACK * side],
          ['shin' + trail]: [Math.max(0.16, tk * step), 0, 0],
          ['foot' + trail]: [ta * (step - 0.02), 0, -TRACK * side * 0.7]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    const clip = makeClip(name, frames);
    if (speedMeta) clip.userData = speedMeta;
    return clip;
  }

  // Jump: knees tucked, the sword hand drawn up beside her face and the blade held back
  const jBody = { hips: [-0.04, 0.06, 0], torso: [0.06, 0.04, 0] };
  const jLift = pose(idle, {
    ...jBody, hipsY: 0.64 + H, head: [-0.08, 0.10, 0],
    legL: [0.06, 0.02, -0.04], shinL: [0.38, 0, 0], footL: [0.46, 0, 0.03],
    legR: [0.20, -0.02, 0.04], shinR: [0.52, 0, 0], footR: [0.44, 0, -0.03],
    ...swordArm(jBody, dirOf(-0.1, 0.9), [-0.10, 0.30, 0.10], -1.3),
    armL: [-0.50, 0, 0.50], foreL: [-0.70, -0.10, 0]
  });
  const tBody = { hips: [0.10, 0.08, 0], torso: [0.20, 0.06, 0.02] };
  const jTuck = pose(jLift, {
    ...tBody, hipsY: 0.655 + H, head: [-0.18, 0.10, 0],
    legL: [-1.08, 0.04, -0.05], shinL: [1.74, 0, 0], footL: [0.38, 0, 0.04],
    legR: [-0.66, -0.04, 0.05], shinR: [1.82, 0, 0], footR: [0.44, 0, -0.04],
    ...swordArm(tBody, dirOf(-0.1, 0.8), [-0.10, 0.28, 0.10], -1.3)
  });
  const jApex = pose(jTuck, {
    torso: [0.16, 0.06, 0.02],
    legL: [-0.94, 0.04, -0.05], shinL: [1.56, 0, 0],
    legR: [-0.52, -0.04, 0.05], shinR: [1.66, 0, 0]
  });
  const fBody = { hips: [0.06, 0.10, -0.02], torso: [0.12, 0.08, 0.02] };
  const fallReach = pose(jApex, {
    ...fBody, hipsY: 0.55 + H, head: [-0.12, 0.12, 0],
    legL: [-0.68, 0.04, 0.06], shinL: [1.06, 0, 0], footL: [-0.24, 0, -0.04],
    legR: [0.12, -0.04, -0.06], shinR: [1.02, 0, 0], footR: [-0.12, 0, 0.04],
    ...swordArm(fBody, dirOf(-0.5, 0.2), [-0.20, 0.18, 0.14], -0.9),
    armL: [-0.40, 0, 0.70], foreL: [-0.60, -0.10, 0]
  });

  // Flash step / tumble: compact tuck with the sword held in close
  const rollTuck = pose(idle, {
    hips: [0.10, 0, 0], hipsY: 0.50 + H, torso: [0.85, 0, 0], head: [0.44, 0, 0],
    armL: [-0.90, 0.10, 0.24], foreL: [-1.68, -0.14, 0], handL: [0.20, 0, 0],
    armR: [-0.90, -0.10, -0.24], foreR: [-1.68, 0.14, 0], handR: [0.20, 0, 0],
    legL: [-1.62, 0.04, 0.09], shinL: [2.16, 0, 0], footL: [0.34, 0, -0.05],
    legR: [-1.50, -0.04, -0.09], shinR: [2.16, 0, 0], footR: [0.34, 0, 0.05]
  });

  // Guard: the blade held upright before the face, the free hand braced under the hilt
  const gBody = { hips: [0.10, -0.16, -0.02], torso: [0.12, -0.20, 0.02] };
  const guardPose = pose(idle, samuraiStance(0.548 + H, 0.10, [0.20, 0.10], [-0.20, 0.10]), {
    ...gBody, head: [-0.14, 0.26, 0],
    ...swordArm(gBody, dirOf(0.25, 1.05), [-0.06, 0.34, 0.20], -1.45),
    armL: [-1.15, 0, 0.15], foreL: [-1.30, -0.15, 0], handL: [0.1, 0, 0]
  });
  const guardBreathe = pose(guardPose, { torso: [0.15, -0.20, 0.02] });
  const guardHitPose = pose(guardPose, samuraiStance(0.526 + H, 0.06, [0.22, 0.11], [-0.22, 0.11]), {
    hips: [0.06, -0.18, -0.03], torso: [-0.06, -0.16, 0.04], head: [-0.04, 0.22, 0]
  });

  // Hit recoil & supine knockdown / defeat: the arms rest flat along the body
  const hurtPeak = pose(idle, samuraiStance(0.552 + H, -0.02, [0.12, 0.09], [-0.18, 0.09]), {
    hips: [-0.02, 0.12, 0.03], torso: [-0.26, -0.12, 0.05], head: [0.16, 0.12, -0.04],
    armL: [-0.36, 0.12, 0.68], foreL: [-0.68, -0.20, 0], handL: [0.18, 0, 0],
    armR: [-0.28, -0.12, -0.68], foreR: [-0.82, 0.20, 0], handR: [0.18, 0, 0]
  });
  const hurtSettle = pose(idle, samuraiStance(0.564 + H, 0.04, [0.12, 0.07], [-0.14, 0.07]), {
    torso: [0.02, 0.06, 0.02], head: [-0.06, 0.16, 0]
  });
  const kdMid = pose(hurtPeak, {
    hips: [-0.74, 0.05, 0.03], hipsY: 0.37 + H, hipsOffset: [0, 0, -0.06],
    torso: [-0.26, -0.08, 0.04], head: [0.28, 0.06, -0.03],
    armL: [-0.34, 0.06, 0.40], foreL: [-0.50, -0.06, 0],
    armR: [-0.34, -0.06, -0.40], foreR: [-0.50, 0.06, 0],
    legL: [-0.60, 0.04, 0.06], shinL: [0.94, 0, 0], footL: [0.22, 0, 0],
    legR: [-0.28, -0.04, -0.06], shinR: [0.78, 0, 0], footR: [0.24, 0, 0]
  });
  const kdLand = pose(kdMid, {
    hips: [-1.42, 0.03, 0.02], hipsY: 0.24 + H, hipsOffset: [0, 0, -0.06],
    torso: [0.08, -0.03, 0.02], head: [0.30, 0.03, 0],
    armL: [0.04, 0, 0.30], foreL: [-0.14, 0, 0], handL: [0.10, 0, 0],
    armR: [0.04, 0, -0.30], foreR: [-0.14, -1.3, 0], handR: [0.10, 0, 0],
    legL: [-0.30, 0.04, 0.07], shinL: [0.70, 0, 0], footL: [0.28, 0, 0],
    legR: [-0.14, -0.04, -0.07], shinR: [0.58, 0, 0], footR: [0.30, 0, 0]
  });
  const kdBounce = pose(kdLand, { hipsY: 0.285 + H, torso: [0.02, -0.02, 0.02] });

  return {
    idle: makeClip('idle', [[0, idle], [0.95, breathe], [1.90, idle]]),
    walk: buildGait('walk', 0.30, { groundSpeed: 5.4, stance: 0.27 }, 0.555, 0.14, 0.92, 0.26, 0.45),
    run: buildGait('run', 0.25, { groundSpeed: 7.4, stance: 0.22 }, 0.532, 0.30, 1.04, 0.40, 0.30),
    dash: buildGait('dash', 0.23, null, 0.52, 0.48, 1.04, 0.46, 0.10),
    jump: makeClip('jump', [[0, jLift], [0.045, jLift, 'lin'], [0.15, jTuck, 'out'], [0.38, jApex, 'io']]),
    fall: makeClip('fall', [[0, jApex], [0.10, pose(jApex, { legL: [-0.82, 0.04, 0.04], shinL: [1.34, 0, 0] }), 'io'], [0.28, fallReach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.05, rollTuck, 'out'], [0.32, rollTuck, 'lin'], [0.46, idle, 'io']]),
    guard: makeClip('guard', [[0, guardPose], [0.65, guardBreathe], [1.30, guardPose]]),
    guardHit: makeClip('guardHit', [[0, guardPose], [0.05, guardHitPose, 'out'], [0.22, guardPose, 'io']]),
    hurt: makeClip('hurt', [[0, idle], [0.05, hurtPeak, 'out'], [0.18, hurtSettle, 'io'], [0.32, idle, 'io']]),
    knockdown: makeClip('knockdown', [[0, hurtPeak], [0.18, kdMid, 'in'], [0.36, kdLand, 'out'], [0.46, kdBounce, 'io'], [0.56, kdLand, 'io']]),
    dead: makeClip('dead', [[0, hurtPeak], [0.26, kdMid, 'in'], [0.54, kdLand, 'out']])
  };
}
