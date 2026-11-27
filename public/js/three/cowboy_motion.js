// Natural gunslinger locomotion, jump, guard and reaction clips calibrated to the
// skinned Cowgirl's exact proportions (hero id `cowboy`, twin revolvers).

// Leg geometry of the skinned Cowgirl, in rig units (hipHeight=0.8218, HIPS_Y=0.62).
// Printed by tools/rig/build_cowboy.py as LEG_RIG.
const THIGH = 0.2768;
const SHIN = 0.2482;
const THIGH_REST = 0.0167;
const SHIN_REST = -0.0186;
const ANKLE = 0.0967;
const PIVOT = 0.0057;
const KNEE_REST_OFFSET = SHIN_REST - THIGH_REST;
// Her legs are 3.5% longer than the Archmage's; the shared gait tables were tuned on 0.507.
const LIFT = (THIGH + SHIN) - 0.5073;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Two-bone leg angles that place a flat boot sole at `reach` ahead of its hip
// with strictly anatomical forward knee flexion (no hyperextension or sideways buckling).
export function cowboyPlant(hipsY, pitch, reach, spread) {
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

export function cowboyStance(hipsY, pitch, [leftReach, leftSpread], [rightReach, rightSpread]) {
  const [legL, shinL, footL] = cowboyPlant(hipsY, pitch, leftReach, leftSpread);
  const [legR, shinR, footR] = cowboyPlant(hipsY, pitch, rightReach, rightSpread);
  return {
    hipsY,
    legL: [legL, 0.04, leftSpread], shinL: [shinL, 0, 0], footL: [footL, 0, -leftSpread * 0.7],
    legR: [legR, -0.04, -rightSpread], shinR: [shinR, 0, 0], footR: [footR, 0, rightSpread * 0.7]
  };
}

// Rotation matrix (row-major 3x3) of a three.js 'XYZ' Euler: Rx * Ry * Rz
function eulerMatrix([x, y, z]) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [
    [c * e, -c * f, d],
    [b * d * e + a * f, -b * d * f + a * e, -b * c],
    [-a * d * e + b * f, a * d * f + b * e, a * c]
  ];
}
const mul = (A, B) => A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));

// Where a straight arm must point so a revolver held along the forearm aims along `yaw` / `pitch`
// (model frame: +Z ahead, +X to her left), given the hips and torso Euler angles of the same pose. The arm hangs
// from the torso, so the world aim direction is taken into the torso's frame; the forearm stays straight.
// Returns the arm Euler (the shoulder's rotation about the forearm axis is left at zero).
export function aimArm(hips, torso, yaw = 0, pitch = 0) {
  const R = mul(eulerMatrix(hips), eulerMatrix(torso));
  const w = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  // d = R^T w
  const d = [0, 1, 2].map(j => R[0][j] * w[0] + R[1][j] * w[1] + R[2][j] * w[2]);
  return [Math.atan2(-d[2], -d[1]), 0, Math.asin(clamp(d[0], -1, 1))];
}

// Poised gunslinger: both revolvers held low-ready, barrels angled up and forward, elbows soft.
export function cowboyIdle(ready, pose) {
  return pose(ready, cowboyStance(0.562 + LIFT * 0.4, 0.05, [0.13, 0.07], [-0.13, 0.07]), {
    hips: [0.05, 0.10, -0.02],
    torso: [0.06, 0.14, 0.01],
    head: [-0.08, -0.18, -0.01],
    armR: [-0.46, 0, -0.24], foreR: [-1.50, 0.06, 0], handR: [0.08, 0, 0],
    armL: [-0.46, 0, 0.24], foreL: [-1.50, -0.06, 0], handL: [0.08, 0, 0]
  });
}

export function buildCowboyLocomotion(makeClip, ready, pose) {
  const idle = cowboyIdle(ready, pose);
  const H = LIFT * 0.4;
  const breathe = pose(idle, cowboyStance(0.556 + H, 0.06, [0.13, 0.07], [-0.13, 0.07]), {
    torso: [0.09, 0.14, 0.02],
    head: [-0.10, -0.18, -0.01],
    armR: [-0.49, 0, -0.25], foreR: [-1.54, 0.06, 0],
    armL: [-0.49, 0, 0.25], foreL: [-1.54, -0.06, 0]
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

  // Both guns stay up and ready: only the elbows pump, so the barrels keep pointing ahead.
  const arms = (swing, bend, out) => ({
    armL: [-0.46 + 0.20 * swing, 0, 0.24 + out], foreL: [-1.50 + bend * swing, -0.06, 0], handL: [0.08, 0, 0],
    armR: [-0.46 - 0.20 * swing, 0, -0.24 - out], foreR: [-1.50 - bend * swing, 0.06, 0], handR: [0.08, 0, 0]
  });

  function buildGait(name, duration, speedMeta, hipsBase, lean, step, bend, out) {
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.09 * turn * side;
        const chest = -twist * 1.3;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [lean * 0.35, twist, -0.025 * turn * side],
          hipsOffset: [0.010 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: hipsBase + H + rise * 0.9,
          torso: [lean + 0.03 * (0.5 - rise / 0.04), chest, 0.03 * side],
          head: [-(lean * 0.9), -chest * 0.7 - twist * 0.5, -0.02 * side],
          ...arms(swing, bend, out),
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

  // Quick-draw jump: knees tuck, elbows pump the guns up beside the face
  const jLift = pose(idle, {
    hips: [-0.04, 0.06, 0], hipsY: 0.64 + H,
    torso: [0.06, 0.08, 0], head: [-0.08, -0.10, 0],
    legL: [0.06, 0.02, -0.04], shinL: [0.38, 0, 0], footL: [0.46, 0, 0.03],
    legR: [0.20, -0.02, 0.04], shinR: [0.52, 0, 0], footR: [0.44, 0, -0.03],
    armL: [-0.72, 0, 0.30], foreL: [-1.50, -0.06, 0],
    armR: [-0.72, 0, -0.30], foreR: [-1.50, 0.06, 0]
  });
  const jTuck = pose(jLift, {
    hips: [0.10, 0.08, 0], hipsY: 0.655 + H,
    torso: [0.20, 0.10, 0.02], head: [-0.18, -0.12, 0],
    legL: [-1.08, 0.04, -0.05], shinL: [1.74, 0, 0], footL: [0.38, 0, 0.04],
    legR: [-0.66, -0.04, 0.05], shinR: [1.82, 0, 0], footR: [0.44, 0, -0.04],
    armL: [-0.62, 0, 0.40], foreL: [-1.34, -0.06, 0],
    armR: [-0.62, 0, -0.40], foreR: [-1.34, 0.06, 0]
  });
  const jApex = pose(jTuck, {
    torso: [0.16, 0.08, 0.02], head: [-0.14, -0.10, 0],
    legL: [-0.94, 0.04, -0.05], shinL: [1.56, 0, 0],
    legR: [-0.52, -0.04, 0.05], shinR: [1.66, 0, 0]
  });
  const fallReach = pose(jApex, {
    hips: [0.06, 0.12, -0.02], hipsY: 0.55 + H,
    torso: [0.12, 0.12, 0.02], head: [-0.12, -0.20, 0],
    legL: [-0.68, 0.04, 0.06], shinL: [1.06, 0, 0], footL: [-0.24, 0, -0.04],
    legR: [0.12, -0.04, -0.06], shinR: [1.02, 0, 0], footR: [-0.12, 0, 0.04],
    armL: [-0.50, 0, 0.62], foreL: [-1.18, -0.06, 0],
    armR: [-0.50, 0, -0.62], foreR: [-1.18, 0.06, 0]
  });

  // Tumble dash: compact tuck, the revolvers held in against the chest
  const rollTuck = pose(idle, {
    hips: [0.10, 0, 0], hipsY: 0.50 + H,
    torso: [0.85, 0, 0], head: [0.44, 0, 0],
    armL: [-0.90, 0.10, 0.24], foreL: [-1.78, -0.14, 0], handL: [0.20, 0, 0],
    armR: [-0.90, -0.10, -0.24], foreR: [-1.78, 0.14, 0], handR: [0.20, 0, 0],
    legL: [-1.62, 0.04, 0.09], shinL: [2.16, 0, 0], footL: [0.34, 0, -0.05],
    legR: [-1.50, -0.04, -0.09], shinR: [2.16, 0, 0], footR: [0.34, 0, 0.05]
  });

  // Guard: revolvers crossed in front of the chest, shoulders hunched
  const guardPose = pose(idle, cowboyStance(0.548 + H, 0.10, [0.20, 0.10], [-0.20, 0.10]), {
    hips: [0.10, 0.20, -0.02], torso: [0.12, 0.18, 0.02], head: [-0.14, -0.30, 0],
    armL: [-0.95, 0, -0.30], foreL: [-1.55, 0, 0], handL: [0.08, 0, 0],
    armR: [-0.95, 0, 0.30], foreR: [-1.55, 0, 0], handR: [0.08, 0, 0]
  });
  const guardBreathe = pose(guardPose, { torso: [0.15, 0.17, 0.02], armL: [-0.99, 0, -0.30], armR: [-0.99, 0, 0.30] });
  const guardHitPose = pose(guardPose, cowboyStance(0.526 + H, 0.06, [0.22, 0.11], [-0.22, 0.11]), {
    hips: [0.06, 0.22, -0.03], torso: [-0.06, 0.14, 0.04], head: [-0.04, -0.26, 0],
    armL: [-0.80, 0, -0.22], foreL: [-1.75, 0, 0],
    armR: [-0.80, 0, 0.22], foreR: [-1.75, 0, 0]
  });

  // Hit recoil & supine knockdown / defeat (the hat brim and hair clear the floor)
  const hurtPeak = pose(idle, cowboyStance(0.552 + H, -0.02, [0.12, 0.09], [-0.18, 0.09]), {
    hips: [-0.02, 0.12, 0.03], torso: [-0.26, -0.12, 0.05], head: [0.16, 0.12, -0.04],
    armL: [-0.36, 0.12, 0.68], foreL: [-0.68, -0.20, 0], handL: [0.18, 0, 0],
    armR: [-0.28, -0.12, -0.68], foreR: [-0.82, 0.20, 0], handR: [0.18, 0, 0]
  });
  const hurtSettle = pose(idle, cowboyStance(0.564 + H, 0.04, [0.12, 0.07], [-0.14, 0.07]), {
    torso: [0.02, 0.06, 0.02], head: [-0.06, -0.16, 0]
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
    // lying on her back the arms rest on the floor beside the body, straight along it
    armL: [0.04, 0, 0.30], foreL: [-0.14, 0, 0], handL: [0.10, 0, 0],
    armR: [0.04, 0, -0.30], foreR: [-0.14, 0, 0], handR: [0.10, 0, 0],
    legL: [-0.30, 0.04, 0.07], shinL: [0.70, 0, 0], footL: [0.28, 0, 0],
    legR: [-0.14, -0.04, -0.07], shinR: [0.58, 0, 0], footR: [0.30, 0, 0]
  });
  const kdBounce = pose(kdLand, { hipsY: 0.285 + H, torso: [0.02, -0.02, 0.02] });

  return {
    idle: makeClip('idle', [[0, idle], [0.95, breathe], [1.90, idle]]),
    walk: buildGait('walk', 0.30, { groundSpeed: 5.0, stance: 0.27 }, 0.555, 0.14, 0.92, 0.10, 0.0),
    run: buildGait('run', 0.25, { groundSpeed: 6.4, stance: 0.22 }, 0.532, 0.30, 1.04, 0.16, 0.04),
    dash: buildGait('dash', 0.23, null, 0.52, 0.46, 1.04, 0.20, 0.06),
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
