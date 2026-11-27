import { SHIELD_HOLD_EULER } from './knight_anatomy.js';

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
  heavy: { contact: 0.21, trail: null, commit: 0.40 },
  // Gear skills: contact is when the skill's effect lands.
  sweep: { contact: 0.085, trail: [0.03, 0.13], commit: 0.50 },
  slam: { contact: 0.05, trail: null, commit: 0.50, kneel: true },
  warcry: { contact: 0.085, trail: null, commit: 0.50 },
  charge: { contact: 0.035, trail: null, commit: 0.45 },
  // Strikes that start in the air keep their clip through a landing.
  airRise: { contact: 0.115, trail: [0.06, 0.18], commit: 0.24, air: true },
  airCut: { contact: 0.11, trail: [0.06, 0.17], commit: 0.24, air: true },
  airSpike: { contact: 0.11, trail: [0.06, 0.17], commit: 0.24, air: true },
  // Air heavy: hover while aiming, plunge, then chop into the floor on landing.
  slamAim: { air: true, commit: 0 },
  slamDive: { air: true, commit: 0 },
  slamImpact: { contact: 0.055, trail: [0, 0.09], commit: 0.36 }
};
// Clip times when a strike deliberately leaves the floor.
export const KNIGHT_AIRBORNE = { charge: [0.03, 0.2] };

// Leg geometry of the skinned Knight, in rig units.
const THIGH = 0.2238;
const SHIN = 0.2713;
const THIGH_REST = 0.0805; // rest thigh leans back from vertical (radians)
const SHIN_REST = 0.1966;  // rest shin leans back from vertical
const ANKLE = 0.107;       // ankle height above a flat sole
const PIVOT = 0.024;       // hip joints sit this far below the hips bone

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Thigh, knee and ankle angles that set a flat boot on the floor `reach` ahead of
// its hip (negative: behind), with the knee bending forward and never hyperextending.
function plant(hipsY, pitch, reach, spread) {
  const drop = (hipsY - PIVOT - ANKLE) / Math.cos(spread);
  const distance = Math.min(Math.hypot(reach, drop), THIGH + SHIN - 0.004);
  const line = Math.atan2(-reach, drop);
  const open = Math.acos(clamp((THIGH ** 2 + distance ** 2 - SHIN ** 2) / (2 * THIGH * distance), -1, 1));
  const thigh = line - open;
  const kneeZ = -THIGH * Math.sin(thigh);
  const kneeY = -THIGH * Math.cos(thigh);
  const shin = Math.atan2(-(-distance * Math.sin(line) - kneeZ), -(-distance * Math.cos(line) - kneeY));
  const leg = thigh - pitch - THIGH_REST;
  const knee = Math.max(0.05, shin - thigh - (SHIN_REST - THIGH_REST));
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
  // 1: Diagonal cleave (handmade fallback; baked attack1 overrides by default).
  const cleaveCoil = pose(idle, stance(0.585, 0.02, [0.10, 0.05], [-0.12, 0.06]), {
    hips: [0.02, -0.32, 0.02], hipsOffset: [-0.02, 0, -0.03],
    torso: [-0.06, -0.48, 0.06], head: [0.04, 0.65, -0.04],
    armR: [-1.74, -0.39, 0.24], foreR: [-0.62, 0, 0], handR: [0.05, -0.34, 0],
    armL: [-0.95, 0.05, 0.24], foreL: [-0.95, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const cleaveCut = pose(idle, stance(0.475, 0.12, [0.28, 0.14], [-0.28, 0.14]), {
    hips: [0.12, 0.34, -0.04], hipsOffset: [0.03, 0, 0.06],
    torso: [0.40, 0.48, 0.08], head: [-0.24, -0.68, -0.02],
    armR: [-0.82, -0.54, 0.53], foreR: [-0.12, 0, 0], handR: [0.32, -0.26, -0.02],
    armL: [0.28, 0.05, 0.42], foreL: [-1.32, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const cleaveThrough = pose(cleaveCut, {
    hipsY: 0.462, torso: [0.46, 0.58, 0.09], head: [-0.27, -0.74, -0.02],
    armR: [-0.36, -0.40, 0.62], foreR: [-0.32, 0, 0], handR: [0.51, -0.08, 0.11]
  });
  const cleaveHold = pose(cleaveThrough, {
    hipsY: 0.47, torso: [0.43, 0.54, 0.08],
    armR: [-0.48, -0.44, 0.60], foreR: [-0.22, 0, 0], handR: [0.45, -0.14, 0.06]
  });

  // 2: Backhand sweep (handmade fallback; baked attack2 overrides by default).
  const sweepDraw = pose(idle, stance(0.50, 0.10, [0.20, 0.12], [-0.20, 0.12]), {
    hips: [0.10, 0.32, -0.04], hipsOffset: [0.02, 0, 0.04],
    torso: [0.26, 0.68, 0.05], head: [-0.16, -0.82, 0],
    armR: [-0.94, 0.48, 0.64], foreR: [-0.22, 0, 0], handR: [0.62, -0.09, 0.11],
    armL: [0.18, 0, 0.38], foreL: [-1.28, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const sweepCut = pose(idle, stance(0.49, 0.08, [-0.20, 0.13], [0.24, 0.13]), {
    hips: [0.08, -0.32, 0.04], hipsOffset: [-0.03, 0, 0.05],
    torso: [0.26, -0.56, -0.05], head: [-0.14, 0.72, 0],
    armR: [-1.70, 0.52, 0.74], foreR: [-0.38, 0, 0], handR: [0.72, -0.38, 0.09],
    armL: [-0.82, 0, 0.54], foreL: [-0.85, 0.25, 0], handL: SHIELD_HOLD_EULER
  });
  const sweepThrough = pose(sweepCut, {
    hipsY: 0.48, torso: [0.28, -0.66, -0.06], head: [-0.15, 0.80, 0],
    armR: [-1.54, -0.75, -0.18], foreR: [-0.16, 0, 0], handR: [0.46, -0.22, -0.16]
  });
  const sweepHold = pose(sweepThrough, {
    hipsY: 0.49, torso: [0.27, -0.62, -0.05],
    armR: [-1.48, -0.70, -0.22], handR: [0.42, -0.18, -0.14]
  });

  // 3: Leaping crush (handmade fallback; baked attack3 overrides by default).
  const crushGather = pose(idle, stance(0.47, 0.20, [0.14, 0.11], [-0.14, 0.11]), {
    hips: [0.20, 0.06, 0], hipsOffset: [0, 0, -0.02],
    torso: [0.36, -0.10, 0], head: [-0.24, 0.02, 0],
    armR: [0.17, -0.60, -0.16], foreR: [-0.24, 0, 0], handR: [0.74, -0.08, 0.12],
    armL: [0.28, 0, 0.36], foreL: [-1.10, 0.25, 0], handL: SHIELD_HOLD_EULER
  });
  const crushRise = pose(crushGather, {
    hips: [-0.06, 0.04, 0], hipsOffset: [0, 0, 0.02], hipsY: 0.68,
    torso: [-0.28, -0.08, 0], head: [0.10, 0.06, 0],
    armR: [-2.25, -0.28, 0.38], foreR: [-0.32, 0, 0], handR: [0.05, 0.16, 0.07],
    armL: [-1.02, 0.10, 0.56], foreL: [-1.22, 0.28, 0],
    legL: [-0.72, 0.04, 0.07], shinL: [1.12, 0, 0], footL: [0.32, 0, 0],
    legR: [0.05, -0.04, -0.07], shinR: [1.22, 0, 0], footR: [0.42, 0, 0]
  });
  const crushSlam = pose(idle, stance(0.43, 0.20, [0.28, 0.16], [-0.26, 0.16]), {
    hips: [0.20, 0.10, 0], hipsOffset: [0, 0, 0.08],
    torso: [0.58, 0.06, 0], head: [-0.42, -0.08, 0],
    armR: [-0.84, -0.20, 0.36], foreR: [-0.14, 0, 0], handR: [0.28, -0.05, -0.22],
    armL: [0.22, 0, 0.52], foreL: [-1.28, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const crushHold = pose(crushSlam, { hipsY: 0.44, torso: [0.56, 0.07, 0] });

  // Heavy: Shield bash. Pull the shield close across the chest with a natural elbow fold,
  // then step in and drive it forward behind the strapped shield.
  const bashPull = pose(idle, stance(0.52, 0.08, [-0.06, 0.09], [-0.04, 0.10]), {
    hips: [0.06, 0.28, 0], hipsOffset: [-0.02, 0, -0.04],
    torso: [0.06, 0.48, 0.04], head: [-0.06, -0.66, 0],
    armL: [-0.36, -0.32, 0.08], foreL: [-1.58, 0.42, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.68, -0.36, -0.14], foreR: [-0.42, 0, 0], handR: [0.04, -0.45, -0.06]
  });
  const bashDrive = pose(idle, stance(0.46, 0.14, [0.32, 0.12], [-0.28, 0.12]), {
    hips: [0.14, -0.26, 0.04], hipsOffset: [0.02, 0, 0.10],
    torso: [0.38, -0.36, 0], head: [-0.22, 0.54, 0],
    armL: [-1.36, 0.22, -0.08], foreL: [-1.42, 0.46, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.52, -0.34, -0.26], foreR: [-0.46, 0, 0], handR: [0.08, -0.40, 0]
  });
  const bashHold = pose(bashDrive, { hipsY: 0.468, torso: [0.40, -0.40, 0], armL: [-1.30, 0.20, -0.08] });

  // Air strikes: three per jump. Natural elbow flexion and smooth wrist articulation
  // eliminate 1-frame arm pops while keeping knees athletically gathered.
  const tuckedLegs = {
    legL: [-1.22, 0.04, -0.07], shinL: [1.90, 0, 0], footL: [0.42, 0, 0.05],
    legR: [-0.78, -0.04, 0.07], shinR: [1.98, 0, 0], footR: [0.50, 0, -0.05]
  };
  const airborne = pose(idle, tuckedLegs, {
    hips: [0.04, 0.04, 0], hipsOffset: [0, 0, 0], hipsY: 0.66,
    torso: [0.12, 0.10, 0.02], head: [-0.12, -0.14, 0],
    armL: [-0.78, 0.06, 0.36], foreL: [-1.02, 0.26, 0], handL: SHIELD_HOLD_EULER,
    armR: [-0.88, -0.10, -0.28], foreR: [-0.36, 0, 0], handR: [0.32, 0, 0]
  });
  const riseCoil = pose(airborne, {
    hips: [0.10, -0.22, 0], torso: [0.28, -0.46, 0.05], head: [-0.18, 0.54, 0],
    legL: [-0.92, 0.04, -0.07], shinL: [1.66, 0, 0], legR: [-0.32, -0.04, 0.07], shinR: [1.56, 0, 0],
    armR: [-0.76, -0.68, -0.42], foreR: [-0.32, -0.18, 0], handR: [0.64, -0.34, -0.10],
    armL: [-1.04, 0.06, 0.28], foreL: [-0.94, 0.26, 0]
  });
  const riseCut = pose(airborne, {
    hips: [-0.08, 0.22, 0], torso: [-0.24, 0.44, 0.02], head: [0.10, -0.54, 0],
    legL: [-1.38, 0.04, -0.07], shinL: [1.74, 0, 0], legR: [-0.22, -0.04, 0.07], shinR: [1.10, 0, 0],
    armR: [-1.68, -0.44, -0.16], foreR: [-0.14, -0.08, 0], handR: [0.46, -0.04, 0],
    armL: [0.22, 0.06, 0.50], foreL: [-1.18, 0.28, 0]
  });
  const riseThrough = pose(riseCut, {
    torso: [-0.28, 0.50, 0.02], armR: [-1.88, 0.12, -0.04], foreR: [-0.16, 0, 0], handR: [0.18, 0.02, 0.01]
  });

  const spikeCoil = pose(airborne, {
    hips: [-0.10, -0.06, 0], torso: [-0.26, -0.12, 0], head: [0.16, 0.10, 0],
    legL: [-1.36, 0.04, -0.07], shinL: [2.04, 0, 0], legR: [-1.06, -0.04, 0.07], shinR: [2.08, 0, 0],
    armR: [-2.36, -0.14, 0.16], foreR: [-0.24, 0, 0], handR: [-0.04, -0.01, -0.01],
    armL: [-0.96, 0.06, 0.44], foreL: [-1.02, 0.26, 0]
  });
  const spikeCut = pose(airborne, {
    hips: [0.20, 0.06, 0], torso: [0.58, 0.08, 0], head: [-0.44, -0.08, 0],
    legL: [-0.68, 0.04, -0.07], shinL: [1.28, 0, 0], footL: [0.38, 0, 0.05],
    legR: [0.28, -0.04, 0.07], shinR: [1.38, 0, 0], footR: [0.56, 0, -0.05],
    armR: [-0.88, -0.62, 0.44], foreR: [-0.16, 0.12, 0], handR: [0.42, 0.04, 0.01],
    armL: [0.24, 0.06, 0.52], foreL: [-1.26, 0.28, 0]
  });
  const spikeThrough = pose(spikeCut, {
    torso: [0.64, 0.10, 0], head: [-0.48, -0.08, 0],
    armR: [-0.82, -0.58, 0.38], foreR: [-0.18, 0.10, 0], handR: [0.48, -0.04, -0.01]
  });

  const upper = (p) => ({ torso: p.torso, head: p.head, armR: p.armR, foreR: p.foreR, handR: p.handR, armL: p.armL, foreL: p.foreL, handL: p.handL });
  const cutDraw = pose(airborne, upper(sweepDraw), { hips: [0.08, 0.26, 0], legL: [-1.08, 0.04, -0.07], shinL: [1.86, 0, 0] });
  const cutSweep = pose(airborne, upper(sweepCut), { hips: [0.06, -0.26, 0], legR: [-1.12, -0.04, 0.07], shinR: [1.90, 0, 0] });
  const cutThrough = pose(cutSweep, upper(sweepThrough));

  // Air heavy: hover with sword cocked overhead, dive trailing legs, chop on impact.
  const aimHover = pose(airborne, upper(spikeCoil), {
    hips: [0.25, 0, 0], hipsY: 0.67, torso: [0.20, -0.08, 0], head: [0.10, 0.08, 0],
    armL: [-1.02, 0.06, 0.40], foreL: [-1.04, 0.26, 0], handL: SHIELD_HOLD_EULER
  });
  const aimTense = pose(aimHover, { hipsY: 0.68, torso: [0.26, -0.10, 0], head: [0.14, 0.08, 0] });
  const dive = pose(aimHover, {
    hips: [0.58, 0, 0], torso: [0.28, -0.05, 0], head: [-0.52, 0.05, 0],
    legL: [0.20, 0.04, -0.05], shinL: [0.54, 0, 0], footL: [0.60, 0, 0.04],
    legR: [0.48, -0.04, 0.05], shinR: [0.84, 0, 0], footR: [0.60, 0, -0.04]
  });
  const landStrike = pose(crushSlam, upper(spikeCoil), { hipsY: 0.52, torso: [0.20, 0.06, 0], head: [-0.28, -0.06, 0] });

  const { airRise, airCut, airSpike, slamImpact } = KNIGHT_STRIKES;
  const air = {
    airRise: makeClip('airRise', [
      [0, airborne], [0.06, riseCoil, 'out'], [airRise.contact, riseCut, 'in'],
      [0.17, riseThrough, 'out'], [0.38, airborne, 'io']
    ]),
    airSpike: makeClip('airSpike', [
      [0, airborne], [0.06, spikeCoil, 'out'], [airSpike.contact, spikeCut, 'in'],
      [0.16, spikeThrough, 'out'], [0.38, airborne, 'io']
    ]),
    airCut: makeClip('airCut', [
      [0, airborne], [0.06, cutDraw, 'out'], [airCut.contact, cutSweep, 'in'],
      [0.16, cutThrough, 'out'], [0.38, airborne, 'io']
    ]),
    slamAim: makeClip('slamAim', [[0, aimHover], [0.45, aimTense, 'io'], [0.9, aimHover, 'io']]),
    slamDive: makeClip('slamDive', [[0, aimHover], [0.08, dive, 'out'], [0.4, dive, 'lin']]),
    slamImpact: makeClip('slamImpact', [
      [0, landStrike], [slamImpact.contact, crushSlam, 'in'], [0.30, crushHold, 'io'], [0.52, idle, 'io']
    ])
  };

  const { attack1: a1, attack2: a2, attack3: a3, heavy } = KNIGHT_STRIKES;
  return {
    ...air,
    attack1: makeClip('attack1', [
      [0, idle], [0.07, cleaveCoil, 'out'], [a1.contact, cleaveCut, 'in'],
      [0.165, cleaveThrough, 'out'], [0.25, cleaveHold, 'io'], [0.44, idle, 'io']
    ]),
    attack2: makeClip('attack2', [
      [0, pose(idle, { torso: [0.14, 0.36, 0.05] })], [0.065, sweepDraw, 'out'], [a2.contact, sweepCut, 'in'],
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

// Gear skills, timed to their effects: every effect is spawned on the cast, so
// each pose reaches its mark within the first 0.1 s and then holds.
export function buildKnightSkills(makeClip, idle, pose) {
  // Excalibur Wave: the blade snaps straight up (the glint), then chops down
  // into the ground in front as the golden crescent leaves.
  const waveRaise = pose(idle, stance(0.60, -0.04, [0.08, 0.06], [-0.14, 0.06]), {
    hips: [-0.04, -0.10, 0], hipsOffset: [0, 0, -0.03],
    torso: [-0.20, -0.14, 0], head: [0.12, 0.18, 0],
    armR: [-2.36, -0.22, 0.18], foreR: [-0.18, 0, 0], handR: [0.54, -0.01, -0.01],
    armL: [-0.88, 0.04, 0.28], foreL: [-0.94, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const waveChop = pose(idle, stance(0.46, 0.16, [0.32, 0.12], [-0.28, 0.12]), {
    hips: [0.16, 0.08, 0], hipsOffset: [0, 0, 0.08],
    torso: [0.60, 0.08, 0], head: [-0.40, -0.10, 0],
    armR: [-0.78, -0.40, 0.36], foreR: [-0.16, 0, 0], handR: [0.24, 0.03, 0],
    armL: [0.26, 0.04, 0.48], foreL: [-1.26, 0.28, 0], handL: SHIELD_HOLD_EULER
  });
  const waveThrough = pose(waveChop, {
    hipsY: 0.448, torso: [0.64, 0.10, 0], head: [-0.44, -0.10, 0],
    armR: [-0.76, -0.38, 0.32], foreR: [-0.14, 0, 0], handR: [0.22, 0, -0.01]
  });
  const waveHold = pose(waveChop, { hipsY: 0.456, torso: [0.62, 0.09, 0] });

  // Aegis Fortress: lift the shield, then drop to one knee and drive its rim
  // into the floor with the sword held back, keeping the left wrist strapped.
  const aegisLift = pose(idle, stance(0.59, 0, [0.05, 0.06], [-0.10, 0.06]), {
    hips: [0, 0.20, 0], torso: [-0.10, 0.22, 0], head: [0.04, -0.36, 0],
    armL: [-1.18, 0.12, 0.16], foreL: [-0.95, 0.38, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.34, -0.58, -0.28], foreR: [-0.28, 0, 0], handR: [0.04, 0, -0.01]
  });
  const [kneelLeg, kneelShin, kneelFoot] = plant(0.36, 0.05, 0.24, 0.10);
  const aegisPlant = pose(idle, {
    hips: [0.05, -0.06, 0], hipsOffset: [0, 0, 0.02], hipsY: 0.36,
    legL: [kneelLeg, 0.04, 0.10], shinL: [kneelShin, 0, 0], footL: [kneelFoot, 0, -0.08],
    legR: [0.18, -0.04, -0.08], shinR: [1.62, 0, 0], footR: [0.85, 0, 0.06],
    torso: [0.40, -0.16, 0], head: [-0.24, 0.18, 0],
    armL: [-1.14, -0.10, -0.22], foreL: [-0.40, 0.36, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.10, -0.78, -0.52], foreR: [-0.34, 0, 0], handR: [-0.36, -0.30, -0.15]
  });
  const aegisSettle = pose(aegisPlant, { hipsY: 0.348, torso: [0.43, -0.16, 0] });
  const aegisHold = pose(aegisPlant, { hipsY: 0.354, torso: [0.40, -0.16, 0] });

  // Lionheart Warcry: gather in, then throw the chest up and thrust the sword
  // into the falling pillar of light, shield arm flung wide, roaring upward.
  const roarGather = pose(idle, stance(0.52, 0.18, [0.12, 0.10], [-0.12, 0.10]), {
    hips: [0.18, 0.05, 0], torso: [0.38, 0, 0], head: [0.18, 0, 0],
    armR: [0.18, -0.75, 0.85], foreR: [-0.28, 0, 0], handR: [0.62, -0.01, -0.01],
    armL: [-0.35, -0.25, -0.15], foreL: [-1.75, 0.38, 0], handL: SHIELD_HOLD_EULER
  });
  const roarCry = pose(idle, stance(0.55, -0.05, [0.20, 0.16], [-0.18, 0.16]), {
    hips: [-0.05, 0.05, 0], torso: [-0.30, 0, 0], head: [-0.34, 0, 0],
    armR: [-2.42, 0.22, -0.10], foreR: [-0.14, 0, 0], handR: [0.88, 0.01, 0],
    armL: [-0.68, 0.36, 0.62], foreL: [-0.64, 0.32, 0], handL: SHIELD_HOLD_EULER
  });
  const roarPeak = pose(roarCry, { hipsY: 0.542, torso: [-0.35, 0, 0], head: [-0.38, 0, 0] });
  const roarHold = pose(roarCry, { torso: [-0.28, 0, 0], head: [-0.30, 0, 0] });

  // Chariot Rush: push off low behind the shield, leap shield-first, then land
  // braced and skid as the rush slows.
  const rushPush = pose(idle, stance(0.46, 0.28, [0.18, 0.06], [-0.32, 0.06]), {
    hips: [0.28, -0.18, 0], torso: [0.52, -0.32, 0], head: [-0.46, 0.44, 0],
    armL: [-1.18, 0.18, -0.14], foreL: [-1.18, 0.42, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.24, 0.24, -0.52], foreR: [-0.32, 0, 0], handR: [-0.22, -0.08, -0.03]
  });
  const rushLeap = pose(rushPush, {
    hipsY: 0.64, torso: [0.64, -0.32, 0], head: [-0.54, 0.44, 0],
    legL: [-1.05, 0.04, -0.04], shinL: [1.26, 0, 0], footL: [0.28, 0, 0],
    legR: [0.70, -0.04, 0.04], shinR: [0.58, 0, 0], footR: [0.54, 0, 0],
    armL: [-1.28, 0.16, -0.16], foreL: [-1.28, 0.44, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.06, 0.24, -0.40], foreR: [-0.26, 0, 0], handR: [-0.24, -0.04, -0.02]
  });
  const rushLand = pose(rushPush, stance(0.45, 0.24, [0.34, 0.10], [-0.32, 0.10]), {
    hips: [0.24, -0.22, 0], torso: [0.56, -0.36, 0], head: [-0.46, 0.48, 0],
    armL: [-1.14, 0.18, -0.14], foreL: [-1.24, 0.44, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.12, 0.36, -0.44], foreR: [-0.22, 0, 0], handR: [-0.14, -0.03, -0.03]
  });
  const rushSkid = pose(rushLand, { hipsY: 0.458, torso: [0.48, -0.34, 0], head: [-0.40, 0.46, 0] });

  const { sweep, slam, warcry, charge } = KNIGHT_STRIKES;
  return {
    sweep: makeClip('sweep', [
      [0, idle], [0.035, waveRaise, 'out'], [sweep.contact, waveChop, 'in'],
      [0.12, waveThrough, 'out'], [0.40, waveHold, 'io'], [0.62, idle, 'io']
    ]),
    slam: makeClip('slam', [
      [0, idle], [0.025, aegisLift, 'out'], [slam.contact, aegisPlant, 'in'],
      [0.09, aegisSettle, 'out'], [0.44, aegisHold, 'io'], [0.68, idle, 'io']
    ]),
    warcry: makeClip('warcry', [
      [0, idle], [0.045, roarGather, 'out'], [warcry.contact, roarCry, 'in'],
      [0.14, roarPeak, 'out'], [0.44, roarHold, 'io'], [0.66, idle, 'io']
    ]),
    charge: makeClip('charge', [
      [0, idle], [charge.contact, rushPush, 'out'], [0.12, rushLeap, 'out'],
      [0.22, rushLand, 'in'], [0.40, rushSkid, 'io'], [0.60, idle, 'io']
    ])
  };
}
