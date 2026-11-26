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
  airSpike: { contact: 0.11, trail: [0.06, 0.17], commit: 0.24, air: true },
  airSmash: { contact: 0.21, trail: [0.15, 0.27], commit: 0.40, air: true }
};
// Forward somersault into the air heavy's chop: [start, duration] in seconds.
export const KNIGHT_AIR_FLIP = [0.03, 0.17];
// Clip times when a strike deliberately leaves the floor.
export const KNIGHT_AIRBORNE = { attack3: [0.058, 0.18], charge: [0.03, 0.2] };

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


  // Air strikes. The first one in a jump launches the target, so the blade
  // rises from low behind to high in front. Later ones spike the target down
  // with an overhead chop. The air heavy somersaults into a chop (the flip is
  // applied in code). Knees stay gathered throughout so nothing reads as a
  // stance in mid-air.
  const tuckedLegs = {
    legL: [-1.25, 0.04, -0.07], shinL: [1.95, 0, 0], footL: [0.45, 0, 0.05],
    legR: [-0.80, -0.04, 0.07], shinR: [2.05, 0, 0], footR: [0.55, 0, -0.05]
  };
  const airborne = pose(idle, tuckedLegs, {
    hips: [0.04, 0.04, 0], hipsOffset: [0, 0, 0], hipsY: 0.66,
    torso: [0.12, 0.10, 0.02], head: [-0.12, -0.14, 0],
    armL: [-0.80, 0.06, 0.40], foreL: [-1.00, 0, 0], handL: [0, 0, 0],
    armR: [-0.90, -0.10, -0.30], foreR: [-0.30, 0, 0], handR: [0.40, 0, 0]
  });
  const riseCoil = pose(airborne, {
    hips: [0.10, -0.25, 0], torso: [0.30, -0.55, 0.05], head: [-0.20, 0.60, 0],
    legL: [-0.95, 0.04, -0.07], shinL: [1.70, 0, 0], legR: [-0.30, -0.04, 0.07], shinR: [1.60, 0, 0],
    armR: [-0.81, -0.90, -0.50], foreR: [0, 0, 0], handR: [0.94, -0.53, -0.15],
    armL: [-1.10, 0.06, 0.30], foreL: [-0.90, 0, 0]
  });
  const riseCut = pose(airborne, {
    hips: [-0.10, 0.25, 0], torso: [-0.28, 0.50, 0.02], head: [0.10, -0.60, 0],
    legL: [-1.45, 0.04, -0.07], shinL: [1.80, 0, 0], legR: [-0.20, -0.04, 0.07], shinR: [1.10, 0, 0],
    armR: [-1.75, -0.58, -0.21], foreR: [0, 0, 0], handR: [0.62, -0.02, 0],
    armL: [0.30, 0.06, 0.60], foreL: [-1.20, 0, 0]
  });
  const riseThrough = pose(riseCut, {
    torso: [-0.34, 0.58, 0.02], armR: [-2.00, 0.16, -0.04], foreR: [0, 0, 0], handR: [0.18, 0.02, 0.01]
  });

  const spikeCoil = pose(airborne, {
    hips: [-0.10, -0.06, 0], torso: [-0.30, -0.12, 0], head: [0.16, 0.10, 0],
    legL: [-1.40, 0.04, -0.07], shinL: [2.10, 0, 0], legR: [-1.10, -0.04, 0.07], shinR: [2.15, 0, 0],
    armR: [-2.47, -0.16, 0.17], foreR: [-0.04, 0, 0], handR: [-0.07, -0.01, -0.01],
    armL: [-1.00, 0.06, 0.50], foreL: [-1.00, 0, 0]
  });
  const spikeCut = pose(airborne, {
    hips: [0.20, 0.06, 0], torso: [0.62, 0.08, 0], head: [-0.48, -0.08, 0],
    legL: [-0.70, 0.04, -0.07], shinL: [1.30, 0, 0], footL: [0.40, 0, 0.05],
    legR: [0.30, -0.04, 0.07], shinR: [1.40, 0, 0], footR: [0.60, 0, -0.05],
    armR: [-0.91, -0.79, 0.52], foreR: [0, 0, 0], handR: [0.50, 0.04, 0.01],
    armL: [0.30, 0.06, 0.60], foreL: [-1.30, 0, 0]
  });
  const spikeThrough = pose(spikeCut, {
    torso: [0.70, 0.10, 0], head: [-0.52, -0.08, 0],
    armR: [-0.86, -0.73, 0.43], handR: [0.56, -0.04, -0.01]
  });

  const smashTuck = pose(airborne, {
    hips: [0.20, 0, 0], torso: [0.50, 0, 0], head: [0.20, 0, 0],
    legL: [-1.55, 0.04, -0.07], shinL: [2.25, 0, 0], legR: [-1.40, -0.04, 0.07], shinR: [2.25, 0, 0],
    armR: [-2.47, -0.16, 0.17], foreR: [-0.04, 0, 0], handR: [-0.07, -0.01, -0.01],
    armL: [-1.20, 0.06, 0.20], foreL: [-1.50, 0, 0]
  });
  const smashCut = pose(spikeCut, { torso: [0.66, 0.06, 0], legL: [-0.50, 0.04, -0.07], shinL: [1.10, 0, 0] });
  const smashHold = pose(smashCut, { torso: [0.58, 0.06, 0] });

  const { airRise, airSpike, airSmash } = KNIGHT_STRIKES;
  const air = {
    airRise: makeClip('airRise', [
      [0, airborne], [0.06, riseCoil, 'out'], [airRise.contact, riseCut, 'in'],
      [0.17, riseThrough, 'out'], [0.38, airborne, 'io']
    ]),
    airSpike: makeClip('airSpike', [
      [0, airborne], [0.06, spikeCoil, 'out'], [airSpike.contact, spikeCut, 'in'],
      [0.16, spikeThrough, 'out'], [0.38, airborne, 'io']
    ]),
    airSmash: makeClip('airSmash', [
      [0, airborne], [0.05, smashTuck, 'out'], [0.16, smashTuck, 'lin'], [airSmash.contact, smashCut, 'in'],
      [0.42, smashHold, 'io'], [0.6, airborne, 'io']
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

// Gear skills, timed to their effects: every effect is spawned on the cast, so
// each pose reaches its mark within the first 0.1 s and then holds.
export function buildKnightSkills(makeClip, idle, pose) {
  // Excalibur Wave: the blade snaps straight up (the glint), then chops down
  // into the ground in front as the golden crescent leaves.
  const waveRaise = pose(idle, stance(0.62, -0.04, [0.08, 0.06], [-0.14, 0.06]), {
    hips: [-0.04, -0.10, 0], hipsOffset: [0, 0, -0.03],
    torso: [-0.22, -0.15, 0], head: [0.14, 0.20, 0],
    armR: [-2.43, -0.26, 0.20], foreR: [0, 0, 0], handR: [0.54, -0.01, -0.01],
    armL: [-0.90, 0, 0.30], foreL: [-0.90, 0, 0], handL: [0, 0, 0]
  });
  const waveChop = pose(idle, stance(0.46, 0.16, [0.34, 0.14], [-0.30, 0.14]), {
    hips: [0.16, 0.08, 0], hipsOffset: [0, 0, 0.08],
    torso: [0.62, 0.08, 0], head: [-0.42, -0.10, 0],
    armR: [-0.81, -0.44, 0.40], foreR: [-0.10, 0, 0], handR: [0.26, 0.03, 0],
    armL: [0.30, 0, 0.55], foreL: [-1.30, 0, 0], handL: [0, 0, 0]
  });
  const waveThrough = pose(waveChop, {
    hipsY: 0.445, torso: [0.68, 0.10, 0], head: [-0.46, -0.10, 0],
    armR: [-0.79, -0.43, 0.34], foreR: [0, 0, 0], handR: [0.23, 0, -0.01]
  });
  const waveHold = pose(waveChop, { hipsY: 0.455, torso: [0.64, 0.09, 0] });

  // Aegis Fortress: lift the shield, then drop to one knee and drive its rim
  // into the floor with the sword held back, holding while the dome stands.
  const aegisLift = pose(idle, stance(0.60, 0, [0.05, 0.06], [-0.10, 0.06]), {
    hips: [0, 0.22, 0], torso: [-0.10, 0.25, 0], head: [0.04, -0.40, 0],
    armL: [-1.29, -0.38, -0.45], foreL: [-0.86, 0, 0], handL: [0.07, -0.02, 0.34],
    armR: [0.35, -0.65, -0.30], foreR: [-0.15, 0, 0], handR: [0.04, 0, -0.01]
  });
  const [kneelLeg, kneelShin, kneelFoot] = plant(0.36, 0.05, 0.24, 0.10);
  const aegisPlant = pose(idle, {
    hips: [0.05, 0.25, 0], hipsOffset: [0, 0, 0.02], hipsY: 0.36,
    legL: [kneelLeg, 0.04, 0.10], shinL: [kneelShin, 0, 0], footL: [kneelFoot, 0, -0.08],
    legR: [0.18, -0.04, -0.08], shinR: [1.62, 0, 0], footR: [0.85, 0, 0.06],
    torso: [0.32, 0.30, 0], head: [-0.22, -0.48, 0],
    armL: [-0.50, 0.44, -0.73], foreL: [-0.08, 0, 0], handL: [-0.28, 0.49, -0.70],
    armR: [-0.04, -0.90, -0.66], foreR: [-0.15, 0, 0], handR: [-0.46, -0.39, -0.19]
  });
  const aegisSettle = pose(aegisPlant, { hipsY: 0.345, torso: [0.36, 0.30, 0] });
  const aegisHold = pose(aegisPlant, { hipsY: 0.352, torso: [0.33, 0.30, 0] });

  // Lionheart Warcry: gather in, then throw the chest up and thrust the sword
  // into the falling pillar of light, shield arm flung wide, roaring upward.
  const roarGather = pose(idle, stance(0.52, 0.20, [0.12, 0.12], [-0.12, 0.12]), {
    hips: [0.20, 0.05, 0], torso: [0.40, 0, 0], head: [0.20, 0, 0],
    armR: [0.21, -0.90, 1.17], foreR: [0, 0, 0], handR: [0.71, -0.01, -0.01],
    armL: [0.17, -0.59, -0.68], foreL: [-2.30, 0, 0], handL: [-0.28, 0.16, -0.01]
  });
  const roarCry = pose(idle, stance(0.55, -0.05, [0.22, 0.20], [-0.20, 0.20]), {
    hips: [-0.05, 0.05, 0], torso: [-0.32, 0, 0], head: [-0.36, 0, 0],
    armR: [-2.51, 0.25, -0.12], foreR: [0, 0, 0], handR: [0.94, 0.01, 0],
    armL: [-0.75, 0.50, 0.80], foreL: [-0.51, 0, 0], handL: [-0.15, 0.08, 0.16]
  });
  const roarPeak = pose(roarCry, { hipsY: 0.54, torso: [-0.38, 0, 0], head: [-0.42, 0, 0] });
  const roarHold = pose(roarCry, { torso: [-0.30, 0, 0], head: [-0.32, 0, 0] });

  // Chariot Rush: push off low behind the shield, leap shield-first, then land
  // braced and skid as the rush slows.
  const rushPush = pose(idle, stance(0.46, 0.30, [0.18, 0.06], [-0.34, 0.06]), {
    hips: [0.30, -0.20, 0], torso: [0.55, -0.35, 0], head: [-0.50, 0.50, 0],
    armL: [-1.61, -0.08, -1.60], foreL: [-2.06, 0, 0], handL: [0.11, -0.39, 0.55],
    armR: [0.14, 0.30, -0.56], foreR: [-0.17, 0, 0], handR: [-0.28, -0.08, -0.03]
  });
  const rushLeap = pose(rushPush, {
    hipsY: 0.64, torso: [0.70, -0.35, 0], head: [-0.60, 0.50, 0],
    legL: [-1.10, 0.04, -0.04], shinL: [1.30, 0, 0], footL: [0.30, 0, 0],
    legR: [0.75, -0.04, 0.04], shinR: [0.60, 0, 0], footR: [0.60, 0, 0],
    armL: [-1.83, -0.40, -1.60], foreL: [-2.30, 0, 0], handL: [0.11, -0.37, 0.54],
    armR: [-0.07, 0.28, -0.42], foreR: [-0.12, 0, 0], handR: [-0.29, -0.04, -0.02]
  });
  const rushLand = pose(rushPush, stance(0.44, 0.25, [0.36, 0.10], [-0.34, 0.10]), {
    hips: [0.25, -0.25, 0], torso: [0.60, -0.40, 0], head: [-0.50, 0.55, 0],
    armL: [-1.36, -0.24, -1.60], foreL: [-2.30, 0, 0], handL: [0.08, -0.51, 0.29],
    armR: [-0.08, 0.44, -0.47], foreR: [-0.09, 0, 0], handR: [-0.16, -0.03, -0.03]
  });
  const rushSkid = pose(rushLand, { hipsY: 0.45, torso: [0.50, -0.38, 0], head: [-0.42, 0.52, 0] });

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
