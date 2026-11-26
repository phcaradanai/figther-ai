// Tree of Savior style sword-and-board strikes for the skinned Knight.
//
// Reference: a quick wind-up with the blade cocked over the shoulder, a strike
// that covers its arc in two or three frames, and a finish in a low, wide stance
// with both boots on the floor, held briefly before the next swing. The server
// applies damage on the button press and allows a swing every 280 ms, so each
// blade reaches contact near 0.12 s and the hold gives way to the next swing.

// Per strike: blade contact (s), sword trail window (s), and how long movement
// may not cut the clip short (s).
export const KNIGHT_STRIKES = {
  attack1: { contact: 0.12, trail: [0.07, 0.19], commit: 0.24 },
  attack2: { contact: 0.115, trail: [0.065, 0.18], commit: 0.24 },
  attack3: { contact: 0.19, trail: [0.13, 0.25], commit: 0.36 },
  heavy: { contact: 0.21, trail: null, commit: 0.40 }
};
// Clip times when a strike deliberately leaves the floor.
export const KNIGHT_AIRBORNE = { attack3: [0.058, 0.18] };

// Leg geometry of the skinned Knight, in rig units.
const THIGH = 0.2238;
const SHIN = 0.2713;
const THIGH_REST = 0.0805; // rest thigh leans back from vertical (radians)
const SHIN_REST = 0.1966;  // rest shin leans back from vertical
const ANKLE = 0.107;       // ankle height above a flat sole
const PIVOT = 0.024;       // hip joints sit this far below the hips bone

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Thigh, knee and ankle angles that set a flat boot on the floor `reach` ahead of
// its hip (negative: behind), with the knee bending forward.
function plant(hipsY, pitch, reach, spread) {
  const drop = (hipsY - PIVOT - ANKLE) / Math.cos(spread);
  const distance = Math.min(Math.hypot(reach, drop), THIGH + SHIN - 0.003);
  const line = Math.atan2(-reach, drop);
  const open = Math.acos(clamp((THIGH ** 2 + distance ** 2 - SHIN ** 2) / (2 * THIGH * distance), -1, 1));
  const thigh = line - open;
  const kneeZ = -THIGH * Math.sin(thigh);
  const kneeY = -THIGH * Math.cos(thigh);
  const shin = Math.atan2(-(-distance * Math.sin(line) - kneeZ), -(-distance * Math.cos(line) - kneeY));
  const leg = thigh - pitch - THIGH_REST;
  const knee = shin - thigh - (SHIN_REST - THIGH_REST);
  return [leg, knee, -(pitch + leg + knee)];
}

// A planted stance: hips height and pitch, then each boot's reach and outward spread.
function stance(hipsY, pitch, [leftReach, leftSpread], [rightReach, rightSpread]) {
  const [legL, shinL, footL] = plant(hipsY, pitch, leftReach, leftSpread);
  const [legR, shinR, footR] = plant(hipsY, pitch, rightReach, rightSpread);
  return {
    hipsY,
    legL: [legL, 0.04, leftSpread], shinL: [shinL, 0, 0], footL: [footL, 0, -leftSpread * 0.8],
    legR: [legR, -0.04, -rightSpread], shinR: [shinR, 0, 0], footR: [footR, 0, rightSpread * 0.8]
  };
}

export function buildKnightAttacks(makeClip, idle, pose) {
  // 1: Diagonal cleave. Coil to the sword side with the blade cocked behind the
  // head, then drop into a wide lunge as the blade cuts down across the body.
  const cleaveCoil = pose(idle, stance(0.585, 0.02, [0.10, 0.05], [-0.12, 0.06]), {
    hips: [0.02, -0.32, 0.02], hipsOffset: [-0.02, 0, -0.03],
    torso: [-0.06, -0.52, 0.06], head: [0.04, 0.70, -0.04],
    armR: [-1.74, -0.39, 0.24], foreR: [-0.62, 0, 0], handR: [0.05, -0.34, 0],
    armL: [-0.95, 0.05, 0.28], foreL: [-0.95, 0, 0], handL: [0, 0, 0]
  });
  const cleaveCut = pose(idle, stance(0.475, 0.12, [0.30, 0.16], [-0.31, 0.15]), {
    hips: [0.12, 0.34, -0.04], hipsOffset: [0.03, 0, 0.06],
    torso: [0.40, 0.52, 0.08], head: [-0.24, -0.72, -0.02],
    armR: [-0.82, -0.54, 0.53], foreR: [0, 0, 0], handR: [0.32, -0.26, -0.02],
    armL: [0.32, 0.05, 0.52], foreL: [-1.38, 0, 0], handL: [0, 0, 0]
  });
  const cleaveThrough = pose(cleaveCut, {
    hipsY: 0.462, torso: [0.46, 0.64, 0.09], head: [-0.27, -0.80, -0.02],
    armR: [-0.36, -0.40, 0.62], foreR: [-0.32, 0, 0], handR: [0.51, -0.08, 0.11]
  });
  const cleaveHold = pose(cleaveThrough, {
    hipsY: 0.47, torso: [0.43, 0.60, 0.08],
    armR: [-0.48, -0.44, 0.60], foreR: [-0.22, 0, 0], handR: [0.45, -0.14, 0.06]
  });

  // 2: Backhand sweep. The blade is drawn back across the hips, then swept flat
  // out to the sword side while the shield arm swings out for balance.
  const sweepDraw = pose(idle, stance(0.50, 0.10, [0.20, 0.14], [-0.22, 0.14]), {
    hips: [0.10, 0.36, -0.04], hipsOffset: [0.02, 0, 0.04],
    torso: [0.26, 0.82, 0.05], head: [-0.16, -0.95, 0],
    armR: [-0.94, 0.55, 0.74], foreR: [0, 0, 0], handR: [0.70, -0.09, 0.11],
    armL: [0.20, 0, 0.45], foreL: [-1.35, 0, 0], handL: [0, 0, 0]
  });
  const sweepCut = pose(idle, stance(0.49, 0.08, [-0.22, 0.15], [0.26, 0.15]), {
    hips: [0.08, -0.34, 0.04], hipsOffset: [-0.03, 0, 0.05],
    torso: [0.26, -0.62, -0.05], head: [-0.14, 0.78, 0],
    armR: [-1.74, 0.61, 0.82], foreR: [-0.41, 0, 0], handR: [0.88, -0.46, 0.09],
    armL: [-0.85, 0, 0.62], foreL: [-0.85, 0, 0], handL: [0, 0, 0]
  });
  const sweepThrough = pose(sweepCut, {
    hipsY: 0.48, torso: [0.28, -0.76, -0.06], head: [-0.15, 0.90, 0],
    armR: [-1.57, -0.90, -0.22], foreR: [0, 0, 0], handR: [0.49, -0.24, -0.19]
  });
  const sweepHold = pose(sweepThrough, {
    hipsY: 0.49, torso: [0.27, -0.70, -0.05],
    armR: [-1.50, -0.84, -0.26], handR: [0.45, -0.20, -0.15]
  });

  // 3: Leaping crush (finisher). Gather low, spring up with the sword raised
  // behind the head, then drive it straight down into a deep squat.
  const crushGather = pose(idle, stance(0.47, 0.20, [0.14, 0.12], [-0.14, 0.12]), {
    hips: [0.20, 0.06, 0], hipsOffset: [0, 0, -0.02],
    torso: [0.36, -0.10, 0], head: [-0.24, 0.02, 0],
    armR: [0.17, -0.64, -0.16], foreR: [0, 0, 0], handR: [0.88, -0.08, 0.13],
    armL: [0.30, 0, 0.42], foreL: [-1.10, 0, 0], handL: [0, 0, 0]
  });
  const crushRise = pose(crushGather, {
    hips: [-0.06, 0.04, 0], hipsOffset: [0, 0, 0.02], hipsY: 0.70,
    torso: [-0.32, -0.08, 0], head: [0.10, 0.06, 0],
    armR: [-2.29, -0.31, 0.41], foreR: [-0.31, 0, 0], handR: [0.01, 0.18, 0.07],
    armL: [-1.05, 0.10, 0.62], foreL: [-1.25, 0, 0],
    legL: [-0.75, 0.04, 0.08], shinL: [1.15, 0, 0], footL: [0.35, 0, 0],
    legR: [0.05, -0.04, -0.08], shinR: [1.25, 0, 0], footR: [0.45, 0, 0]
  });
  const crushSlam = pose(idle, stance(0.42, 0.22, [0.30, 0.20], [-0.28, 0.20]), {
    hips: [0.22, 0.10, 0], hipsOffset: [0, 0, 0.08],
    torso: [0.62, 0.06, 0], head: [-0.44, -0.08, 0],
    armR: [-0.88, -0.22, 0.40], foreR: [0, 0, 0], handR: [0.29, -0.05, -0.28],
    armL: [0.22, 0, 0.62], foreL: [-1.32, 0, 0], handL: [0, 0, 0]
  });
  const crushHold = pose(crushSlam, { hipsY: 0.43, torso: [0.60, 0.07, 0] });

  // Heavy: Shield bash. Pull the shield to the chest, then step in and drive it
  // forward with the sword drawn back low behind.
  const bashPull = pose(idle, stance(0.52, 0.08, [-0.06, 0.10], [-0.04, 0.12]), {
    hips: [0.06, 0.30, 0], hipsOffset: [-0.02, 0, -0.04],
    torso: [0.06, 0.52, 0.04], head: [-0.06, -0.72, 0],
    armL: [-0.13, -0.46, -0.46], foreL: [-1.95, 0, 0], handL: [0.28, 0, 0],
    armR: [0.73, -0.40, -0.09], foreR: [-0.32, 0, 0], handR: [0, -0.55, -0.07]
  });
  const bashDrive = pose(idle, stance(0.46, 0.14, [0.34, 0.14], [-0.30, 0.14]), {
    hips: [0.14, -0.30, 0.04], hipsOffset: [0.02, 0, 0.10],
    torso: [0.40, -0.42, 0], head: [-0.22, 0.62, 0],
    armL: [-1.59, 0.48, -0.41], foreL: [-1.64, 0, 0], handL: [0.52, 0.01, 0.59],
    armR: [0.55, -0.40, -0.25], foreR: [-0.40, 0, 0], handR: [0.10, -0.50, 0]
  });
  const bashHold = pose(bashDrive, { hipsY: 0.465, torso: [0.42, -0.46, 0], armL: [-1.52, 0.46, -0.40] });

  const { attack1: a1, attack2: a2, attack3: a3, heavy } = KNIGHT_STRIKES;
  return {
    attack1: makeClip('attack1', [
      [0, idle], [0.07, cleaveCoil, 'out'], [a1.contact, cleaveCut, 'in'],
      [0.165, cleaveThrough, 'out'], [0.25, cleaveHold, 'io'], [0.44, idle, 'io']
    ]),
    attack2: makeClip('attack2', [
      [0, pose(idle, { torso: [0.14, 0.40, 0.05] })], [0.065, sweepDraw, 'out'], [a2.contact, sweepCut, 'in'],
      [0.16, sweepThrough, 'out'], [0.24, sweepHold, 'io'], [0.42, idle, 'io']
    ]),
    attack3: makeClip('attack3', [
      [0, idle], [0.055, crushGather, 'out'], [0.13, crushRise, 'out'], [a3.contact, crushSlam, 'in'],
      [0.36, crushHold, 'io'], [0.58, idle, 'io']
    ]),
    heavy: makeClip('heavy', [
      [0, idle], [0.12, bashPull, 'out'], [heavy.contact, bashDrive, 'in'],
      [0.33, bashHold, 'io'], [0.56, idle, 'io']
    ])
  };
}
