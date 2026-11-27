import { ninjaStance } from './ninja_motion.js';

// Anatomically valid dual-kunai strikes & skill animations for the skinned Shadow Ninja.
// Contact and trail windows align tightly with server cooldowns (190 ms basic combo,
// 520 ms heavy backstab, 550 ms gear skills) and ninja_effekseer_3d.js VFX.

export const NINJA_STRIKES = {
  attack1:   { contact: 0.065, trail: [0.025, 0.145], offhandTrail: null, commit: 0.16 },
  attack2:   { contact: 0.065, trail: null, offhandTrail: [0.025, 0.145], commit: 0.16 },
  attack3:   { contact: 0.140, trail: [0.06, 0.30], offhandTrail: [0.06, 0.30], commit: 0.42 },
  heavy:     { contact: 0.110, trail: [0.05, 0.24], offhandTrail: [0.05, 0.24], commit: 0.38 },
  // Gear skills: windslash (Q), seal (E), throw (R), backflip (F)
  windslash: { contact: 0.120, trail: [0.08, 0.46], offhandTrail: [0.08, 0.46], commit: 0.62 },
  seal:      { contact: 0.070, trail: null, offhandTrail: null, commit: 0.46 },
  throw:     { contact: 0.100, trail: [0.07, 0.18], offhandTrail: null, commit: 0.42 },
  backflip:  { contact: 0.070, trail: null, offhandTrail: null, commit: 0.54, air: true },
  // 3-hit aerial dual-kunai combo
  airRise:   { contact: 0.065, trail: [0.02, 0.14], offhandTrail: null, commit: 0.16, air: true },
  airCut:    { contact: 0.065, trail: null, offhandTrail: [0.02, 0.14], commit: 0.16, air: true },
  airSpike:  { contact: 0.085, trail: [0.04, 0.18], offhandTrail: [0.04, 0.18], commit: 0.22, air: true },
  // Air heavy (Shadow Dash mode)
  slamAim:    { air: true, commit: 0 },
  slamDive:   { air: true, commit: 0 },
  slamImpact: { contact: 0.060, trail: [0.01, 0.15], offhandTrail: [0.01, 0.15], commit: 0.34 }
};

export const NINJA_AIRBORNE = {
  attack3: [0.06, 0.28],
  backflip: [0.10, 0.48]
};

export function buildNinjaAttacks(makeClip, idle, pose) {
  // 1: Lightning right-hand forehand slash into a wide shinobi lunge
  const a1Coil = pose(idle, ninjaStance(0.53, 0.14, [0.14, 0.08], [-0.14, 0.08]), {
    hips: [0.14, -0.34, 0.04], torso: [0.16, -0.50, 0.06], head: [-0.10, 0.62, -0.03],
    armR: [0.25, -0.55, -0.95], foreR: [-0.85, 0.25, 0], handR: [0.35, 0.15, 0],
    armL: [-0.62, 0.20, 0.25], foreL: [-1.62, -0.30, 0], handL: [0.18, 0, 0]
  });
  const a1Hit = pose(idle, ninjaStance(0.455, 0.22, [0.34, 0.13], [-0.30, 0.13]), {
    hips: [0.22, 0.36, -0.04], hipsOffset: [0.02, 0, 0.06],
    torso: [0.46, 0.56, 0.06], head: [-0.34, -0.74, -0.02],
    armR: [-1.32, -0.35, 0.56], foreR: [-0.14, 0.30, 0], handR: [0.44, -0.10, 0.08],
    armL: [-0.48, 0.22, 0.18], foreL: [-1.72, -0.35, 0], handL: [0.20, 0, 0]
  });
  const a1Follow = pose(a1Hit, {
    hipsY: 0.450, torso: [0.48, 0.62, 0.07],
    armR: [-1.18, -0.25, 0.68], foreR: [-0.22, 0.30, 0]
  });

  // 2: Snappy left-hand reverse sweep with counter torso twist
  const a2Coil = pose(idle, ninjaStance(0.51, 0.16, [0.18, 0.10], [-0.18, 0.10]), {
    hips: [0.16, 0.32, -0.04], torso: [0.24, 0.52, -0.05], head: [-0.18, -0.68, 0],
    armL: [-1.05, 0.45, 0.65], foreL: [-1.15, -0.25, 0], handL: [0.32, -0.15, 0],
    armR: [0.38, -0.18, -0.45], foreR: [-0.95, 0.22, 0]
  });
  const a2Hit = pose(idle, ninjaStance(0.455, 0.22, [-0.22, 0.13], [0.32, 0.13]), {
    hips: [0.22, -0.34, 0.04], hipsOffset: [-0.02, 0, 0.06],
    torso: [0.46, -0.56, -0.06], head: [-0.34, 0.72, 0.02],
    armL: [-1.26, 0.35, -0.68], foreL: [-0.14, -0.30, 0], handL: [0.44, 0.10, -0.08],
    armR: [-0.46, -0.20, -0.18], foreR: [-1.68, 0.35, 0]
  });
  const a2Follow = pose(a2Hit, {
    hipsY: 0.450, torso: [0.48, -0.62, -0.07],
    armL: [-1.12, 0.25, -0.78], foreL: [-0.22, -0.30, 0]
  });

  // 3: Hop + 360-deg dual-blade cyclone + deep crouched landing cross-cut (hits floor cleanly!)
  const a3Gather = pose(idle, ninjaStance(0.46, 0.22, [0.14, 0.11], [-0.14, 0.11]), {
    hips: [0.22, 0.06, 0], torso: [0.38, 0.05, 0], head: [-0.28, -0.08, 0],
    armL: [0.20, 0.15, 0.42], foreL: [-1.35, -0.20, 0],
    armR: [0.20, -0.15, -0.42], foreR: [-1.35, 0.20, 0]
  });
  const a3Spin = pose(idle, {
    hips: [0.12, 0, 0], hipsY: 0.74,
    torso: [0.24, 0, 0], head: [-0.16, 0, 0],
    armR: [-1.42, -0.25, -1.18], foreR: [-0.16, 0.35, 0], handR: [0.25, 0, 0],
    armL: [-1.42, 0.25, 1.18], foreL: [-0.16, -0.35, 0], handL: [0.25, 0, 0],
    legL: [-0.95, 0.05, 0.10], shinL: [1.46, 0, 0], footL: [0.38, 0, -0.05],
    legR: [-0.48, -0.05, -0.10], shinR: [1.32, 0, 0], footR: [0.42, 0, 0.05]
  });
  const a3Land = pose(idle, ninjaStance(0.435, 0.24, [0.30, 0.14], [-0.26, 0.14]), {
    hips: [0.24, 0.18, 0], hipsOffset: [0, 0, 0.07],
    torso: [0.54, 0.16, 0.03], head: [-0.38, -0.20, 0],
    armR: [-1.05, -0.25, 0.52], foreR: [-0.18, 0.30, 0], handR: [0.42, 0, 0],
    armL: [-0.96, 0.25, -0.44], foreL: [-0.24, -0.30, 0], handL: [0.42, 0, 0]
  });

  // Heavy: Shadow Backstab — coiled twin-blade overhead raise -> downward X-fang lunge thrust
  const heavyUp = pose(idle, ninjaStance(0.56, 0.04, [0.12, 0.10], [-0.14, 0.10]), {
    hips: [0.04, 0, 0], torso: [-0.14, 0, 0], head: [-0.12, 0, 0],
    armR: [-2.42, -0.22, -0.36], foreR: [-0.72, 0.20, 0], handR: [-0.15, 0, 0],
    armL: [-2.42, 0.22, 0.36], foreL: [-0.72, -0.20, 0], handL: [-0.15, 0, 0]
  });
  const heavyDown = pose(idle, ninjaStance(0.435, 0.26, [0.32, 0.14], [-0.28, 0.14]), {
    hips: [0.26, 0, 0], hipsOffset: [0, 0, 0.08],
    torso: [0.62, 0, 0], head: [-0.44, 0, 0],
    armR: [-0.96, -0.18, 0.28], foreR: [-0.14, 0.22, 0], handR: [0.48, 0, 0],
    armL: [-0.96, 0.18, -0.28], foreL: [-0.14, -0.22, 0], handL: [0.48, 0, 0]
  });

  // Air combo (3 hits) + Air heavy (Shadow Dash)
  const airLegs = {
    legL: [-1.18, 0.04, -0.06], shinL: [1.88, 0, 0], footL: [0.42, 0, 0.04],
    legR: [-0.74, -0.04, 0.06], shinR: [1.96, 0, 0], footR: [0.50, 0, -0.04]
  };
  const airBase = pose(idle, airLegs, {
    hips: [0.10, 0.08, 0], hipsY: 0.65, torso: [0.22, 0.12, 0.02], head: [-0.20, -0.14, 0],
    armL: [-0.55, 0.14, 0.42], foreL: [-1.10, -0.20, 0],
    armR: [-0.55, -0.14, -0.42], foreR: [-1.10, 0.20, 0]
  });
  const airUpper = p => ({
    torso: p.torso, head: p.head,
    armR: p.armR, foreR: p.foreR, handR: p.handR,
    armL: p.armL, foreL: p.foreL, handL: p.handL
  });

  const airRiseCoil = pose(airBase, airUpper(a1Coil), { torso: [0.16, -0.42, 0.04], head: [-0.14, 0.50, 0] });
  const airRiseHit = pose(airBase, airUpper(a1Hit), {
    torso: [-0.18, 0.46, 0.02], head: [0.06, -0.50, 0],
    legL: [-1.32, 0.04, -0.06], shinL: [1.66, 0, 0], legR: [-0.30, -0.04, 0.06], shinR: [1.28, 0, 0]
  });
  const airCutCoil = pose(airBase, airUpper(a2Coil));
  const airCutHit = pose(airBase, airUpper(a2Hit));
  const airSpikeCoil = pose(airBase, airUpper(heavyUp));
  const airSpikeHit = pose(airBase, airUpper(heavyDown), {
    legL: [-0.72, 0.04, -0.06], shinL: [1.34, 0, 0], legR: [0.18, -0.04, 0.06], shinR: [1.38, 0, 0]
  });

  // Air heavy: hover coil -> horizontal shadow dash lunge -> crouched landing impact
  const slamHover = pose(airBase, airUpper(heavyUp), {
    hips: [0.22, 0, 0], hipsY: 0.66, torso: [0.16, 0, 0], head: [0.12, 0, 0]
  });
  const slamDivePose = pose(airBase, {
    hips: [0.56, 0, 0], torso: [0.58, 0, 0], head: [-0.52, 0, 0],
    armR: [-1.45, -0.15, -0.18], foreR: [-0.18, 0.25, 0], handR: [0.42, 0, 0],
    armL: [0.75, 0.15, 0.35], foreL: [-0.38, -0.20, 0], handL: [0.55, 0, 0],
    legL: [0.18, 0.04, -0.05], shinL: [0.54, 0, 0], footL: [0.58, 0, 0.04],
    legR: [0.46, -0.04, 0.05], shinR: [0.84, 0, 0], footR: [0.58, 0, -0.04]
  });

  const { attack1: a1, attack2: a2, attack3: a3, heavy, airRise, airCut, airSpike, slamImpact } = NINJA_STRIKES;
  return {
    attack1: makeClip('attack1', [[0, idle], [0.025, a1Coil, 'out'], [a1.contact, a1Hit, 'in'], [0.145, a1Follow, 'out'], [0.27, idle, 'io']]),
    attack2: makeClip('attack2', [[0, idle], [0.025, a2Coil, 'out'], [a2.contact, a2Hit, 'in'], [0.145, a2Follow, 'out'], [0.27, idle, 'io']]),
    attack3: makeClip('attack3', [[0, idle], [0.04, a3Gather, 'out'], [0.09, a3Spin, 'out'], [0.26, a3Spin, 'lin'], [0.33, a3Land, 'in'], [0.44, a3Land, 'io'], [0.56, idle, 'io']]),
    heavy: makeClip('heavy', [[0, idle], [0.055, heavyUp, 'out'], [heavy.contact, heavyDown, 'in'], [0.34, heavyDown, 'lin'], [0.48, idle, 'io']]),
    airRise: makeClip('airRise', [[0, airBase], [0.025, airRiseCoil, 'out'], [airRise.contact, airRiseHit, 'in'], [0.16, airRiseHit, 'out'], [0.34, airBase, 'io']]),
    airCut: makeClip('airCut', [[0, airBase], [0.025, airCutCoil, 'out'], [airCut.contact, airCutHit, 'in'], [0.16, airCutHit, 'out'], [0.34, airBase, 'io']]),
    airSpike: makeClip('airSpike', [[0, airBase], [0.035, airSpikeCoil, 'out'], [airSpike.contact, airSpikeHit, 'in'], [0.20, airSpikeHit, 'out'], [0.36, airBase, 'io']]),
    slamAim: makeClip('slamAim', [[0, slamHover], [0.40, pose(slamHover, { hipsY: 0.68, torso: [0.20, 0, 0] }), 'io'], [0.80, slamHover, 'io']]),
    slamDive: makeClip('slamDive', [[0, slamHover], [0.07, slamDivePose, 'out'], [0.40, slamDivePose, 'lin']]),
    slamImpact: makeClip('slamImpact', [[0, heavyUp], [slamImpact.contact, heavyDown, 'in'], [0.26, heavyDown, 'io'], [0.46, idle, 'io']])
  };
}

export function buildNinjaSkills(makeClip, idle, pose) {
  // 1. Izuna Blade Storm (windslash): coil -> spinning dual-blade whirl -> deep grounded finish lunge
  const windCoil = pose(idle, ninjaStance(0.45, 0.22, [0.14, 0.12], [-0.16, 0.12]), {
    hips: [0.22, -0.35, 0.04], torso: [0.40, -0.58, 0.06], head: [-0.22, 0.65, 0],
    armR: [0.46, -0.32, -0.92], foreR: [-0.52, 0.25, 0],
    armL: [-0.52, 0.22, 0.56], foreL: [-1.18, -0.25, 0]
  });
  const windWhirl = pose(idle, ninjaStance(0.50, 0.14, [0.22, 0.15], [-0.22, 0.15]), {
    hips: [0.14, 0, 0], torso: [0.26, 0, 0], head: [-0.14, 0, 0],
    armR: [-1.42, -0.22, -1.24], foreR: [-0.14, 0.35, 0], handR: [0.30, 0, 0],
    armL: [-1.42, 0.22, 1.24], foreL: [-0.14, -0.35, 0], handL: [0.30, 0, 0]
  });
  const windLunge = pose(idle, ninjaStance(0.425, 0.28, [0.36, 0.14], [-0.32, 0.14]), {
    hips: [0.28, 0.28, -0.04], hipsOffset: [0, 0, 0.08],
    torso: [0.62, 0.26, 0.04], head: [-0.46, -0.32, 0],
    armR: [-1.28, -0.20, 0.32], foreR: [-0.12, 0.25, 0], handR: [0.42, 0, 0],
    armL: [0.62, 0.16, 0.38], foreL: [-0.36, -0.20, 0]
  });

  // 2. Smoke Bomb Stealth (seal): crouched Kuji-in hand seal with forearms crossed cleanly in front of chest
  const sealCrouch = pose(idle, ninjaStance(0.495, 0.14, [0.20, 0.12], [-0.20, 0.12]), {
    hips: [0.14, 0, 0], torso: [0.20, 0, 0], head: [0.12, 0, 0],
    armR: [-0.76, -0.35, 0.42], foreR: [-1.70, 0.35, 0], handR: [0.18, 0.25, -0.15],
    armL: [-0.76, 0.35, -0.42], foreL: [-1.70, -0.35, 0], handL: [0.18, -0.25, 0.15]
  });

  // 3. Fuuma Shuriken Fan (throw): deep side wind-up -> crisp horizontal fan whip release
  const throwUp = pose(idle, ninjaStance(0.545, 0.04, [0.20, 0.11], [-0.20, 0.11]), {
    hips: [0.04, -0.28, 0], torso: [-0.08, -0.58, 0], head: [0.04, 0.64, 0],
    armR: [-2.35, -0.22, -0.56], foreR: [-1.35, 0.25, 0], handR: [-0.20, 0, 0],
    armL: [-1.15, 0.16, 0.34], foreL: [-0.36, -0.20, 0]
  });
  const throwOut = pose(idle, ninjaStance(0.455, 0.24, [0.34, 0.12], [-0.30, 0.12]), {
    hips: [0.24, 0.32, 0], torso: [0.52, 0.52, 0.04], head: [-0.36, -0.62, 0],
    armR: [-1.18, -0.24, 0.44], foreR: [-0.14, 0.35, 0], handR: [0.46, 0, 0],
    armL: [0.52, 0.16, 0.36], foreL: [-0.36, -0.20, 0]
  });

  // 4. Explosive Substitution (backflip): brief seal flash -> tucked somersault backwards (`FLIP.backflip`) -> crouched landing
  const flipTuck = pose(idle, {
    hips: [0.12, 0, 0], hipsY: 0.56,
    torso: [0.82, 0, 0], head: [0.44, 0, 0],
    armR: [-0.95, -0.10, -0.30], foreR: [-1.60, 0.15, 0], handR: [0.20, 0, 0],
    armL: [-0.95, 0.10, 0.30], foreL: [-1.60, -0.15, 0], handL: [0.20, 0, 0],
    legL: [-1.66, 0.04, 0.10], shinL: [2.18, 0, 0], footL: [0.36, 0, -0.05],
    legR: [-1.56, -0.04, -0.10], shinR: [2.18, 0, 0], footR: [0.36, 0, 0.05]
  });

  return {
    windslash: makeClip('windslash', [
      [0, idle], [0.06, windCoil, 'out'], [0.12, windWhirl, 'out'],
      [0.36, windWhirl, 'lin'], [0.44, windLunge, 'out'], [0.62, windLunge, 'io'], [0.76, idle, 'io']
    ]),
    seal: makeClip('seal', [
      [0, idle], [0.065, sealCrouch, 'out'], [0.42, pose(sealCrouch, { hipsY: 0.482 }), 'lin'], [0.56, idle, 'io']
    ]),
    throw: makeClip('throw', [
      [0, idle], [0.055, throwUp, 'out'], [0.10, throwOut, 'out'], [0.36, throwOut, 'lin'], [0.50, idle, 'io']
    ]),
    backflip: makeClip('backflip', [
      [0, idle], [0.065, sealCrouch, 'out'], [0.13, flipTuck, 'out'], [0.46, flipTuck, 'lin'], [0.58, idle, 'io']
    ])
  };
}
