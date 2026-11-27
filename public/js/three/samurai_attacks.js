import { dirOf, samuraiStance, swordArm } from './samurai_motion.js';

// Katana combat, aerial and skill animations for the skinned Samurai.
// Server timing (shared_data.js): 210 ms basic combo of 4 hits (right chop, reverse cut, right chop, overhead
// finisher), 520 ms Iaido Flash heavy, 550 ms gear skills. The server deals damage on the press, so each strike
// reaches its blade contact within about 0.08 s. Blade directions are authored, and swordArm() (blade_solver.js)
// solves the shoulder, elbow and wrist angles that put the blade on them.

export const SAMURAI_STRIKES = {
  attack1:   { contact: 0.075, trail: [0.03, 0.17], commit: 0.18 },
  attack2:   { contact: 0.075, trail: [0.03, 0.17], commit: 0.18 },
  attack3:   { contact: 0.14, trail: [0.07, 0.30], commit: 0.40 },
  heavy:     { contact: 0.11, trail: [0.05, 0.34], commit: 0.44 },
  // Gear skills: spin (Q Senbonzakura Storm), counter (E Mind's Eye), aura (R Asura Blood Aura), rising (F Tsubame Gaeshi)
  spin:      { contact: 0.10, trail: [0.07, 0.62], commit: 0.80 },
  counter:   { contact: 0.14, trail: [0.08, 0.34], commit: 0.50 },
  aura:      { contact: 0.12, trail: null, commit: 0.56 },
  rising:    { contact: 0.14, trail: [0.10, 0.30], commit: 0.46, air: true },
  // 3-hit aerial combo
  airRise:   { contact: 0.075, trail: [0.03, 0.17], commit: 0.18, air: true },
  airCut:    { contact: 0.075, trail: [0.03, 0.17], commit: 0.18, air: true },
  airSpike:  { contact: 0.10, trail: [0.05, 0.24], commit: 0.26, air: true },
  // Air heavy (Flash Dash mode)
  slamAim:    { air: true, commit: 0 },
  slamDive:   { air: true, commit: 0 },
  slamImpact: { contact: 0.06, trail: [0.01, 0.20], commit: 0.36 }
};

// Windows in which a clip leaves the ground (the floor guard must not pull the sole down)
export const SAMURAI_AIRBORNE = {
  rising: [0.13, 0.36]
};

export function buildSamuraiAttacks(makeClip, idle, pose) {
  const H = 0.007;
  const arm = (body, dir, at, fore) => swordArm(body, dir, at, fore);
  const D = dirOf;

  // 1: diagonal chop from over the right shoulder down into a wide lunge, left leg leading
  const a1b = { hips: [0.10, -0.34, 0.04], torso: [0.04, -0.46, 0.03] };
  const a1Pre = pose(idle, samuraiStance(0.54 + H, 0.10, [0.10, 0.08], [-0.22, 0.10]), {
    ...a1b, head: [-0.05, 0.55, 0], ...arm(a1b, [-0.50, 0.80, -0.35], [-0.12, 0.42, -0.02], -1.30),
    armL: [0.2, 0.1, 0.5], foreL: [-0.9, -0.10, 0]
  });
  const a1h = { hips: [0.22, 0.36, -0.04], torso: [0.40, 0.46, 0.05] };
  const a1Hit = pose(idle, samuraiStance(0.455 + H, 0.22, [0.34, 0.13], [-0.30, 0.13]), {
    ...a1h, hipsOffset: [0.02, 0, 0.06], head: [-0.30, -0.60, 0],
    ...arm(a1h, [0.45, -0.45, 0.77], [0.0, 0.16, 0.26], -0.35),
    armL: [-0.7, 0, 0.45], foreL: [-1.2, -0.10, 0]
  });

  // 2: reverse cut, drawn up from the left hip across to the right, right leg leading
  const a2b = { hips: [0.14, 0.30, -0.04], torso: [0.22, 0.44, -0.05] };
  const a2Pre = pose(idle, samuraiStance(0.52 + H, 0.16, [0.18, 0.10], [-0.18, 0.10]), {
    ...a2b, head: [-0.18, -0.60, 0], ...arm(a2b, [0.55, -0.55, 0.45], [0.0, 0.10, 0.20], -1.10),
    armL: [-0.4, 0, 0.6], foreL: [-1.0, -0.10, 0]
  });
  const a2h = { hips: [0.22, -0.34, 0.04], torso: [0.40, -0.44, -0.05] };
  const a2Hit = pose(idle, samuraiStance(0.455 + H, 0.22, [-0.30, 0.13], [0.34, 0.13]), {
    ...a2h, hipsOffset: [-0.02, 0, 0.06], head: [-0.34, 0.62, 0],
    ...arm(a2h, [-0.50, 0.50, 0.70], [-0.20, 0.30, 0.18], -0.40),
    armL: [-0.5, 0, 0.5], foreL: [-1.2, -0.10, 0]
  });

  // 3: finisher: blade high over her head, then an overhead cleave into a deep lunge
  const a3b = { hips: [-0.10, -0.10, 0], torso: [-0.30, -0.10, 0] };
  const a3Pre = pose(idle, samuraiStance(0.57 + H, -0.02, [0.10, 0.08], [-0.12, 0.08]), {
    ...a3b, head: [0.10, 0.10, 0], ...arm(a3b, [0.0, 0.95, -0.30], [-0.06, 0.50, 0.0], -1.50),
    armL: [-1.8, 0, 0.6], foreL: [-0.6, -0.10, 0]
  });
  const a3h = { hips: [0.20, -0.04, 0], torso: [0.40, -0.04, 0] };
  const a3Hit = pose(idle, samuraiStance(0.43 + H, 0.26, [0.36, 0.12], [-0.30, 0.12]), {
    ...a3h, hipsOffset: [0, 0, 0.06], head: [-0.30, 0.04, 0],
    ...arm(a3h, [0.0, -0.55, 0.83], [-0.04, 0.10, 0.28], -0.30),
    armL: [-0.6, 0, 0.5], foreL: [-1.2, -0.10, 0]
  });

  // Heavy: Iaido Flash. A low coil with the hand at the left hip and the blade still back, then one flat sweep
  const hcb = { hips: [0.16, 0.45, -0.04], torso: [0.16, 0.55, 0] };
  const heavyCoil = pose(idle, samuraiStance(0.47 + H, 0.20, [0.18, 0.11], [-0.18, 0.11]), {
    ...hcb, head: [-0.05, -0.55, 0], ...arm(hcb, [0.5, -0.1, -0.85], [0.12, 0.04, 0.12], -1.50),
    armL: [-0.3, 0, 0.6], foreL: [-0.9, -0.10, 0]
  });
  const hfb = { hips: [0.16, -0.35, 0], torso: [0.12, -0.45, 0] };
  const heavyFlash = pose(idle, samuraiStance(0.46 + H, 0.22, [0.28, 0.12], [-0.28, 0.12]), {
    ...hfb, hipsOffset: [0, 0, 0.05], head: [-0.15, 0.50, 0],
    ...arm(hfb, [-0.15, 0.05, 0.99], [-0.14, 0.14, 0.28], -0.45),
    armL: [-0.9, 0, 0.5], foreL: [-1.0, -0.10, 0]
  });
  const heavyFollow = pose(heavyFlash, {
    ...arm(hfb, [-0.90, 0.10, 0.30], [-0.25, 0.20, 0.20], -0.45)
  });

  // Aerial combo: legs gathered, the sword arm from the ground cuts
  const airLegs = {
    legL: [-0.72, 0.04, 0.05], shinL: [1.34, 0, 0], footL: [0.38, 0, -0.03],
    legR: [0.04, -0.04, -0.05], shinR: [1.56, 0, 0], footR: [0.42, 0, 0.03]
  };
  const airBase = pose(idle, airLegs, {
    hips: [0.08, 0.10, 0], hipsY: 0.635 + H, torso: [0.14, 0.12, 0.02], head: [-0.14, 0.14, 0],
    armL: [-0.52, 0, 0.60], foreL: [-0.80, -0.10, 0]
  });
  const upperOf = p => ({
    hips: p.hips, torso: p.torso, head: p.head,
    armL: p.armL, foreL: p.foreL, handL: p.handL,
    armR: p.armR, foreR: p.foreR, handR: p.handR
  });
  // Spike: a plunging cut down at the target
  const spb = { hips: [0.20, 0, 0], torso: [0.30, 0, 0] };
  const spikeAim = pose(airBase, {
    ...spb, head: [-0.30, 0, 0], ...arm(spb, [0.0, -0.80, 0.55], [-0.06, 0.12, 0.26], -0.40),
    armL: [-0.7, 0, 0.5], foreL: [-1.0, -0.10, 0]
  });

  // Air heavy: Flash Dash. Hover coiled with the blade back, streak flat out with the blade leading, land in a sweep
  const sab = { hips: [0.12, 0.30, 0], torso: [0.04, 0.40, 0] };
  const slamAimPose = pose(airBase, {
    ...sab, hipsY: 0.65 + H, head: [0.0, -0.40, 0], ...arm(sab, [0.4, -0.1, -0.9], [0.10, 0.06, 0.10], -1.50)
  });
  const sdb = { hips: [0.62, -0.05, 0], torso: [0.45, -0.05, 0] };
  const slamDivePose = pose(airBase, {
    ...sdb, hipsY: 0.60 + H, head: [-0.55, 0, 0], ...arm(sdb, [0.0, -0.10, 1.0], [-0.04, 0.10, 0.30], -0.20),
    armL: [0.45, 0, 0.45], foreL: [-0.4, -0.10, 0],
    legL: [0.14, 0.04, -0.04], shinL: [0.58, 0, 0], footL: [0.48, 0, 0.03],
    legR: [0.36, -0.04, 0.04], shinR: [0.84, 0, 0], footR: [0.52, 0, -0.03]
  });

  const castClip = (name, pre, hit, t) => makeClip(name, [
    [0, idle], [t[0], pre, 'out'], [t[1], hit, 'out'],
    [t[2], pose(hit, { torso: [hit.torso[0] + 0.02, hit.torso[1], hit.torso[2]] }), 'lin'], [t[3], idle, 'io']
  ]);

  return {
    attack1: castClip('attack1', a1Pre, a1Hit, [0.03, 0.075, 0.18, 0.34]),
    attack2: castClip('attack2', a2Pre, a2Hit, [0.03, 0.075, 0.18, 0.34]),
    attack3: castClip('attack3', a3Pre, a3Hit, [0.07, 0.14, 0.40, 0.56]),
    heavy: makeClip('heavy', [
      [0, idle], [0.05, heavyCoil, 'out'], [0.11, heavyFlash, 'out'], [0.2, heavyFollow, 'out'],
      [0.36, heavyFollow, 'lin'], [0.56, idle, 'io']
    ]),
    airRise: makeClip('airRise', [
      [0, airBase], [0.03, pose(airBase, upperOf(a2Pre)), 'out'], [0.075, pose(airBase, upperOf(a2Hit)), 'out'],
      [0.22, pose(airBase, upperOf(a2Hit)), 'lin'], [0.36, airBase, 'io']
    ]),
    airCut: makeClip('airCut', [
      [0, airBase], [0.03, pose(airBase, upperOf(a1Pre)), 'out'], [0.075, pose(airBase, upperOf(a1Hit)), 'out'],
      [0.22, pose(airBase, upperOf(a1Hit)), 'lin'], [0.36, airBase, 'io']
    ]),
    airSpike: makeClip('airSpike', [
      [0, airBase], [0.05, pose(airBase, upperOf(a3Pre)), 'out'], [0.10, spikeAim, 'out'],
      [0.30, spikeAim, 'lin'], [0.44, airBase, 'io']
    ]),
    slamAim: makeClip('slamAim', [
      [0, slamAimPose], [0.40, pose(slamAimPose, { hipsY: 0.675 + H, torso: [0.0, 0.40, 0] }), 'io'], [0.80, slamAimPose, 'io']
    ]),
    slamDive: makeClip('slamDive', [[0, slamAimPose], [0.06, slamDivePose, 'out'], [0.40, slamDivePose, 'lin']]),
    slamImpact: makeClip('slamImpact', [[0, heavyCoil], [0.05, heavyFlash, 'in'], [0.14, heavyFollow, 'out'], [0.30, heavyFollow, 'lin'], [0.48, idle, 'io']])
  };
}

export function buildSamuraiSkills(makeClip, idle, pose) {
  const H = 0.007;
  const arm = (body, dir, at, fore) => swordArm(body, dir, at, fore);
  const D = dirOf;

  // Q (samurai_weapon, Senbonzakura Storm): arms thrown wide, blade out to the side while the body whirls
  // (ChibiView.spin), then a closing downward cut
  const spb = { hips: [0.06, 0, 0], torso: [0.08, 0, 0] };
  const spread = pose(idle, samuraiStance(0.525 + H, 0.04, [0.18, 0.15], [-0.18, 0.15]), {
    ...spb, head: [0, 0, 0], ...arm(spb, [-0.96, 0.02, 0.25], [-0.30, 0.26, 0.04], -0.15),
    armL: [-0.05, 0, 1.30], foreL: [-0.15, -0.10, 0], handL: [0.1, 0, 0]
  });
  const ripb = { hips: [0.20, 0, 0], torso: [0.30, 0, 0] };
  const rip = pose(idle, samuraiStance(0.47 + H, 0.36, [0.22, 0.13], [-0.20, 0.13]), {
    ...ripb, head: [-0.20, 0, 0], ...arm(ripb, [0.0, -0.70, 0.70], [-0.04, 0.12, 0.26], -0.35),
    armL: [-0.6, 0, 0.5], foreL: [-1.0, -0.10, 0]
  });

  // E (samurai_armor, Mind's Eye Counter): sink into a crouch with the blade back, then flash out in a wide cut
  const cib = { hips: [0.20, 0.45, -0.04], torso: [0.22, 0.55, 0] };
  const counterIn = pose(idle, samuraiStance(0.45 + H, 0.24, [0.18, 0.11], [-0.18, 0.11]), {
    ...cib, head: [-0.05, -0.50, 0], ...arm(cib, [0.5, -0.15, -0.85], [0.12, 0.02, 0.10], -1.50),
    armL: [-0.3, 0, 0.6], foreL: [-0.9, -0.10, 0]
  });
  const cob = { hips: [0.14, -0.50, 0], torso: [0.20, -0.60, 0] };
  const counterOut = pose(idle, samuraiStance(0.455 + H, 0.20, [0.30, 0.13], [-0.30, 0.13]), {
    ...cob, hipsOffset: [0, 0, 0.05], head: [-0.15, 0.60, 0],
    ...arm(cob, [-0.60, 0.20, 0.78], [-0.16, 0.20, 0.26], -0.45),
    armL: [-0.9, 0, 0.5], foreL: [-1.0, -0.10, 0]
  });

  // R (samurai_helmet, Asura Blood Aura): the blade raised straight up, chest out, head thrown back
  const arb = { hips: [-0.04, -0.06, 0], torso: [-0.22, -0.08, 0] };
  const auraPose = pose(idle, samuraiStance(0.568 + H, 0.0, [0.14, 0.10], [-0.14, 0.10]), {
    ...arb, head: [-0.45, 0.10, 0], ...arm(arb, [0.0, 1.0, 0.05], [-0.12, 0.46, 0.10], -1.40),
    armL: [-0.9, 0, 0.9], foreL: [-1.3, -0.10, 0], handL: [0.1, 0, 0]
  });

  // F (samurai_trinket, Tsubame Gaeshi): crouch with the blade low and back, then spring into a rising cut
  const rcb = { hips: [0.24, 0.20, 0], torso: [0.40, 0.20, 0] };
  const risingCrouch = pose(idle, samuraiStance(0.43 + H, 0.30, [0.20, 0.12], [-0.18, 0.12]), {
    ...rcb, head: [-0.25, -0.20, 0], ...arm(rcb, [0.0, -0.55, -0.80], [-0.10, 0.06, 0.04], -1.40),
    armL: [-0.5, 0, 0.5], foreL: [-1.1, -0.10, 0]
  });
  const rrb = { hips: [-0.12, -0.20, 0], torso: [-0.28, -0.20, 0] };
  const risingCut = pose(idle, {
    ...rrb, hipsY: 0.64 + H, head: [-0.30, 0.20, 0],
    legL: [-0.50, 0.04, 0.08], shinL: [0.90, 0, 0], footL: [0.30, 0, -0.04],
    legR: [0.10, -0.04, -0.08], shinR: [1.10, 0, 0], footR: [0.40, 0, 0.04],
    ...arm(rrb, [-0.15, 0.85, 0.50], [-0.10, 0.40, 0.18], -0.55),
    armL: [-1.0, 0, 0.7], foreL: [-0.8, -0.10, 0]
  });

  return {
    spin: makeClip('spin', [
      [0, idle], [0.07, spread, 'out'], [0.60, pose(spread, { hipsY: 0.505 + H }), 'lin'],
      [0.68, rip, 'out'], [0.84, rip, 'lin'], [0.98, idle, 'io']
    ]),
    counter: makeClip('counter', [
      [0, idle], [0.06, counterIn, 'out'], [0.14, counterOut, 'out'], [0.34, counterOut, 'lin'], [0.54, idle, 'io']
    ]),
    aura: makeClip('aura', [
      [0, idle], [0.12, auraPose, 'out'], [0.56, pose(auraPose, { head: [-0.50, 0.10, 0] }), 'lin'], [0.72, idle, 'io']
    ]),
    rising: makeClip('rising', [
      [0, idle], [0.07, risingCrouch, 'out'], [0.14, risingCut, 'out'], [0.30, risingCut, 'lin'], [0.50, idle, 'io']
    ])
  };
}
