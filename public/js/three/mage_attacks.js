import { mageStance } from './mage_motion.js';

// Anatomically valid Fire Archmage combat, aerial, and skill animations.
// Timings align with server cooldowns (340 ms fireball combo, 520 ms heavy Dragon Pillar,
// 550 ms gear skills) and mage_effekseer_3d.js VFX beats.

export const MAGE_STRIKES = {
  attack1:    { contact: 0.110, trail: null, commit: 0.26 },
  attack2:    { contact: 0.110, trail: [0.06, 0.24], commit: 0.26 },
  attack3:    { contact: 0.160, trail: [0.08, 0.34], commit: 0.44 },
  heavy:      { contact: 0.190, trail: [0.09, 0.38], commit: 0.56 },
  // Gear skills: summon (Q meteor), nova (E supernova), raise (R solar orbs), blink (F warp)
  summon:     { contact: 0.280, trail: [0.14, 0.56], commit: 0.68 },
  nova:       { contact: 0.180, trail: [0.14, 0.44], commit: 0.60 },
  raise:      { contact: 0.140, trail: null, commit: 0.58 },
  blink:      { contact: 0.140, trail: null, commit: 0.34 },
  // 3-hit aerial spell/staff combo
  airRise:    { contact: 0.095, trail: null, commit: 0.24, air: true },
  airCut:     { contact: 0.105, trail: [0.05, 0.22], commit: 0.26, air: true },
  airSpike:   { contact: 0.140, trail: [0.06, 0.26], commit: 0.32, air: true },
  // Air heavy (Slam mode)
  slamAim:    { air: true, commit: 0 },
  slamDive:   { air: true, commit: 0 },
  slamImpact: { contact: 0.080, trail: [0.02, 0.20], commit: 0.38 }
};

export const MAGE_AIRBORNE = {};

export function buildMageAttacks(makeClip, idle, pose) {
  // 1: Fireball Snap — open left palm coils back then thrusts forward launching fireball
  const a1Coil = pose(idle, mageStance(0.545, 0.08, [0.10, 0.08], [-0.14, 0.08]), {
    hips: [0.08, 0.30, -0.02], torso: [0.04, 0.36, 0.02], head: [-0.06, -0.44, 0],
    armL: [0.22, 0.14, 0.42], foreL: [-1.85, -0.18, 0], handL: [0.24, -0.10, 0.05],
    armR: [-0.18, -0.10, -0.28], foreR: [-1.22, 0.16, 0]
  });
  const a1Cast = pose(idle, mageStance(0.515, 0.14, [0.24, 0.10], [-0.22, 0.10]), {
    hips: [0.14, -0.18, 0.02], hipsOffset: [0, 0, 0.04],
    torso: [0.20, -0.34, -0.02], head: [-0.16, 0.38, 0],
    armL: [-1.42, 0.14, -0.06], foreL: [-0.12, -0.16, 0], handL: [0.35, 0, 0],
    armR: [-0.10, -0.12, -0.32], foreR: [-1.18, 0.16, 0]
  });

  // 2: Staff Ember Thrust — right hand drives blazing staff crystal forward
  const a2Coil = pose(idle, mageStance(0.545, 0.08, [0.14, 0.08], [-0.14, 0.08]), {
    hips: [0.08, -0.22, 0.02], torso: [-0.02, -0.28, 0.02], head: [0.02, 0.30, 0],
    armR: [0.22, -0.16, -0.30], foreR: [-1.52, 0.18, 0], handR: [0.15, 0.05, 0],
    armL: [-0.24, 0.12, 0.28], foreL: [-1.05, -0.16, 0]
  });
  const a2Cast = pose(idle, mageStance(0.515, 0.14, [0.22, 0.10], [-0.20, 0.10]), {
    hips: [0.14, 0.24, -0.02], hipsOffset: [0, 0, 0.04],
    torso: [0.20, 0.34, 0.02], head: [-0.16, -0.40, 0],
    armR: [-1.28, -0.12, -0.04], foreR: [-0.46, 0.16, 0], handR: [0.25, 0.05, 0],
    armL: [-0.14, 0.12, 0.34], foreL: [-0.88, -0.16, 0]
  });

  // 3: Hell Breath — dual coil then low grounded forward lunge pouring flame from handL
  const a3Coil = pose(idle, mageStance(0.535, 0.10, [0.12, 0.09], [-0.16, 0.09]), {
    hips: [0.10, 0.34, -0.03], torso: [0.06, 0.44, 0.03], head: [-0.06, -0.50, 0],
    armL: [0.12, 0.14, -0.22], foreL: [-1.76, -0.16, 0], handL: [0.20, -0.10, 0],
    armR: [0.20, -0.14, -0.32], foreR: [-1.48, 0.16, 0]
  });
  const a3Cast = pose(idle, mageStance(0.475, 0.20, [0.30, 0.12], [-0.26, 0.12]), {
    hips: [0.20, -0.06, 0], hipsOffset: [0, 0, 0.06],
    torso: [0.34, -0.12, 0], head: [-0.26, 0.14, 0],
    armL: [-1.40, 0.12, -0.10], foreL: [-0.12, -0.14, 0], handL: [0.38, 0, 0],
    armR: [-1.14, -0.12, 0.08], foreR: [-0.52, 0.14, 0], handR: [0.22, 0.05, 0]
  });

  // Heavy: Dragon Pillar — crouched gather then explosive chest-out arm fling
  const heavyCoil = pose(idle, mageStance(0.475, 0.20, [0.18, 0.11], [-0.18, 0.11]), {
    hips: [0.20, 0, 0], torso: [0.32, 0, 0], head: [0.12, 0, 0],
    armL: [-0.58, 0.16, -0.38], foreL: [-1.42, -0.18, 0], handL: [0.18, 0, 0],
    armR: [-0.58, -0.16, 0.24], foreR: [-1.42, 0.18, 0], handR: [0.18, 0, 0]
  });
  const heavyBurst = pose(idle, mageStance(0.555, 0.04, [0.16, 0.12], [-0.16, 0.12]), {
    hips: [0.04, 0, 0], torso: [-0.18, 0, 0], head: [-0.22, 0, 0],
    armL: [-0.36, 0.16, 1.32], foreL: [-0.14, -0.18, 0], handL: [0.22, 0, 0],
    armR: [-0.36, -0.16, -1.32], foreR: [-1.05, 0.18, 0], handR: [0.22, 0, 0]
  });

  // Aerial combo (3 hits) + Air Heavy (Meteor Slam)
  const airLegs = {
    legL: [-0.72, 0.04, 0.05], shinL: [1.34, 0, 0], footL: [0.38, 0, -0.03],
    legR: [0.04, -0.04, -0.05], shinR: [1.56, 0, 0], footR: [0.42, 0, 0.03]
  };
  const airBase = pose(idle, airLegs, {
    hips: [0.08, 0.10, 0], hipsY: 0.635, torso: [0.14, 0.12, 0.02], head: [-0.14, -0.14, 0],
    armL: [-0.52, 0.14, 0.42], foreL: [-0.82, -0.16, 0],
    armR: [-0.26, -0.12, -0.34], foreR: [-1.18, 0.16, 0]
  });
  const upperOf = p => ({
    torso: p.torso, head: p.head,
    armL: p.armL, foreL: p.foreL, handL: p.handL,
    armR: p.armR, foreR: p.foreR, handR: p.handR
  });

  const slamAimPose = pose(airBase, {
    hips: [0.12, 0, 0], hipsY: 0.65,
    torso: [-0.14, 0, 0], head: [0.12, 0, 0],
    armR: [-2.42, -0.16, -0.26], foreR: [-0.38, 0.18, 0],
    armL: [-2.20, 0.16, 0.34], foreL: [-0.42, -0.18, 0]
  });
  const slamDivePose = pose(airBase, {
    hips: [0.42, 0, 0], hipsY: 0.62,
    torso: [0.48, 0, 0], head: [-0.44, 0, 0],
    armR: [-0.85, -0.14, -0.22], foreR: [-0.52, 0.16, 0],
    armL: [0.48, 0.14, 0.36], foreL: [-0.62, -0.16, 0],
    legL: [0.14, 0.04, -0.04], shinL: [0.58, 0, 0], footL: [0.48, 0, 0.03],
    legR: [0.36, -0.04, 0.04], shinR: [0.84, 0, 0], footR: [0.52, 0, -0.03]
  });
  const slamImpactPose = pose(idle, mageStance(0.455, 0.24, [0.28, 0.13], [-0.24, 0.13]), {
    hips: [0.24, 0, 0], hipsOffset: [0, 0, 0.06],
    torso: [0.44, 0, 0], head: [-0.34, 0, 0],
    armR: [-0.72, -0.14, -0.30], foreR: [-0.68, 0.18, 0], handR: [0.26, 0, 0],
    armL: [-0.66, 0.14, 0.38], foreL: [-0.72, -0.18, 0], handL: [0.26, 0, 0]
  });

  const castClip = (name, a, b, t) => makeClip(name, [
    [0, idle], [t[0], a, 'out'], [t[1], b, 'out'],
    [t[2], pose(b, { torso: [b.torso[0] + 0.03, b.torso[1], b.torso[2]] }), 'lin'],
    [t[3], idle, 'io']
  ]);

  return {
    attack1: castClip('attack1', a1Coil, a1Cast, [0.055, 0.115, 0.28, 0.44]),
    attack2: castClip('attack2', a2Coil, a2Cast, [0.055, 0.115, 0.28, 0.44]),
    attack3: castClip('attack3', a3Coil, a3Cast, [0.09, 0.16, 0.42, 0.60]),
    heavy: makeClip('heavy', [
      [0, idle], [0.11, heavyCoil, 'out'], [0.20, heavyBurst, 'out'],
      [0.52, pose(heavyBurst, { head: [-0.26, 0, 0] }), 'lin'], [0.70, idle, 'io']
    ]),
    airRise: makeClip('airRise', [
      [0, airBase], [0.045, pose(airBase, upperOf(a1Coil)), 'out'],
      [0.095, pose(airBase, upperOf(a1Cast)), 'out'], [0.22, pose(airBase, upperOf(a1Cast)), 'lin'], [0.36, airBase, 'io']
    ]),
    airCut: makeClip('airCut', [
      [0, airBase], [0.045, pose(airBase, upperOf(a2Coil)), 'out'],
      [0.105, pose(airBase, upperOf(a2Cast)), 'out'], [0.24, pose(airBase, upperOf(a2Cast)), 'lin'], [0.38, airBase, 'io']
    ]),
    airSpike: makeClip('airSpike', [
      [0, airBase], [0.06, pose(airBase, upperOf(a3Coil)), 'out'],
      [0.14, pose(airBase, upperOf(a3Cast)), 'out'], [0.30, pose(airBase, upperOf(a3Cast)), 'lin'], [0.44, airBase, 'io']
    ]),
    slamAim: makeClip('slamAim', [
      [0, slamAimPose], [0.40, pose(slamAimPose, { hipsY: 0.675, torso: [-0.10, 0, 0] }), 'io'], [0.80, slamAimPose, 'io']
    ]),
    slamDive: makeClip('slamDive', [[0, slamAimPose], [0.07, slamDivePose, 'out'], [0.40, slamDivePose, 'lin']]),
    slamImpact: makeClip('slamImpact', [[0, heavyCoil], [0.08, slamImpactPose, 'in'], [0.28, slamImpactPose, 'io'], [0.48, idle, 'io']])
  };
}

export function buildMageSkills(makeClip, idle, pose) {
  // Q (mage_weapon - Meteor Apocalypse): raise staff skyward -> sweeping downward summon point
  const sumUp = pose(idle, mageStance(0.568, 0.02, [0.10, 0.09], [-0.12, 0.09]), {
    hips: [0.02, -0.10, 0], torso: [-0.20, -0.14, 0], head: [-0.34, 0.14, 0],
    armR: [-2.52, -0.16, -0.24], foreR: [-0.36, 0.18, 0], handR: [-0.12, 0, 0],
    armL: [-0.46, 0.14, 0.88], foreL: [-0.48, -0.16, 0], handL: [0.20, 0, 0]
  });
  const sumPoint = pose(idle, mageStance(0.495, 0.16, [0.28, 0.12], [-0.24, 0.12]), {
    hips: [0.16, 0.20, -0.02], hipsOffset: [0, 0, 0.05],
    torso: [0.28, 0.28, 0.02], head: [-0.20, -0.26, 0],
    armR: [-1.36, -0.14, -0.06], foreR: [-0.42, 0.18, 0], handR: [0.28, 0, 0],
    armL: [0.26, 0.14, 0.38], foreL: [-0.42, -0.16, 0]
  });

  // E (mage_armor - Supernova Ring): compact crouched cross -> explosive wide burst
  const novaIn = pose(idle, mageStance(0.465, 0.22, [0.18, 0.11], [-0.18, 0.11]), {
    hips: [0.22, 0, 0], torso: [0.36, 0, 0], head: [0.22, 0, 0],
    armR: [-0.86, -0.20, 0.52], foreR: [-1.52, 0.18, 0],
    armL: [-0.86, 0.20, -0.52], foreL: [-1.52, -0.18, 0]
  });
  const novaOut = pose(idle, mageStance(0.555, 0.02, [0.16, 0.12], [-0.16, 0.12]), {
    hips: [0.02, 0, 0], torso: [-0.26, 0, 0], head: [-0.36, 0, 0],
    armR: [-0.68, -0.14, -1.62], foreR: [-0.78, 0.18, 0],
    armL: [-0.68, 0.14, 1.62], foreL: [-0.18, -0.18, 0]
  });

  // R (mage_helmet - Solar Orbit Spheres): lofty staff salute + glowing summoning palm
  const raisePose = pose(sumUp, {
    torso: [-0.18, 0, 0], head: [-0.34, 0, 0],
    armR: [-2.56, -0.16, -0.24], foreR: [-0.34, 0.18, 0],
    armL: [-0.44, 0.14, 0.94], foreL: [-0.48, -0.16, 0]
  });

  // F (mage_trinket - Flame Blink Warp): quick ember tuck -> buoyant emerge
  const blinkIn = pose(idle, mageStance(0.445, 0.24, [0.14, 0.09], [-0.16, 0.09]), {
    hips: [0.24, 0, 0], torso: [0.44, 0, 0], head: [0.28, 0, 0],
    armR: [-0.68, -0.14, 0.42], foreR: [-1.72, 0.16, 0],
    armL: [-0.68, 0.14, -0.42], foreL: [-1.72, -0.16, 0]
  });
  const blinkOut = pose(idle, mageStance(0.552, 0.06, [0.16, 0.09], [-0.16, 0.09]), {
    torso: [-0.06, 0, 0], head: [-0.10, 0, 0],
    armL: [-0.32, 0.14, 0.78], foreL: [-0.34, -0.16, 0],
    armR: [-0.24, -0.10, -0.34], foreR: [-1.22, 0.16, 0]
  });

  return {
    summon: makeClip('summon', [
      [0, idle], [0.11, sumUp, 'out'], [0.28, sumUp, 'lin'],
      [0.38, sumPoint, 'out'], [0.60, sumPoint, 'lin'], [0.76, idle, 'io']
    ]),
    nova: makeClip('nova', [
      [0, idle], [0.11, novaIn, 'out'], [0.18, novaOut, 'out'],
      [0.52, novaOut, 'lin'], [0.70, idle, 'io']
    ]),
    raise: makeClip('raise', [
      [0, idle], [0.11, raisePose, 'out'],
      [0.56, pose(raisePose, { head: [-0.38, 0, 0] }), 'lin'], [0.72, idle, 'io']
    ]),
    blink: makeClip('blink', [
      [0, idle], [0.06, blinkIn, 'out'], [0.15, blinkOut, 'out'],
      [0.26, blinkOut, 'lin'], [0.40, idle, 'io']
    ])
  };
}
