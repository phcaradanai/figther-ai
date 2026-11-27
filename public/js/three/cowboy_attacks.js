import { aimArm, cowboyStance } from './cowboy_motion.js';

// Twin-revolver combat, aerial and skill animations for the skinned Cowgirl.
// Server timing (shared_data.js): 230 ms basic combo, Deadeye Magnum heavy, 550 ms gear skills; the server spawns
// every projectile on the cast, so the aim pose is reached by the first shot (SHOTS below) and the barrel flash
// is read from the real muzzle node (`ChibiView.muzzle`). Aim poses use `aimArm` so each straight arm really
// points the revolver along the facing direction once the torso has turned.

export const COWBOY_STRIKES = {
  attack1:   { contact: 0.05, trail: null, commit: 0.16 },
  attack2:   { contact: 0.05, trail: null, commit: 0.16 },
  attack3:   { contact: 0.08, trail: null, commit: 0.40, kneel: true },
  heavy:     { contact: 0.066, trail: null, commit: 0.44 },
  // Gear skills: spin (Q High Noon Barrage), toss (E TNT), rollshot (R Tactical Roll), lasso (F Bounty Lasso)
  spin:      { contact: 0.08, trail: null, commit: 0.90 },
  toss:      { contact: 0.13, trail: null, commit: 0.38 },
  rollshot:  { contact: 0.35, trail: null, commit: 0.56, kneel: true },
  lasso:     { contact: 0.18, trail: null, commit: 0.50 },
  // 3-hit aerial revolver combo
  airRise:   { contact: 0.05, trail: null, commit: 0.16, air: true },
  airCut:    { contact: 0.05, trail: null, commit: 0.16, air: true },
  airSpike:  { contact: 0.06, trail: null, commit: 0.22, air: true },
  // Air heavy (Slam mode)
  slamAim:    { air: true, commit: 0 },
  slamDive:   { air: true, commit: 0 },
  slamImpact: { contact: 0.05, trail: null, commit: 0.34 }
};

export const COWBOY_AIRBORNE = {};

// Timed shots on each clip: [clip time, 'R' | 'L' | 'B' (both), power (0 normal, 1 big, 2 ground blast)]
export const COWBOY_SHOTS = {
  attack1: [[0.05, 'R']],
  attack2: [[0.05, 'L']],
  attack3: [[0.08, 'R'], [0.13, 'L'], [0.18, 'R'], [0.23, 'L']],
  heavy: [[0.066, 'B', 1]],
  rollshot: [[0.35, 'R'], [0.4, 'L']],
  spin: [...Array.from({ length: 12 }, (_, i) => [0.08 + i * 0.045, i % 2 ? 'L' : 'R']), [0.71, 'B', 2]],
  airRise: [[0.05, 'R']],
  airCut: [[0.05, 'L']],
  airSpike: [[0.06, 'R'], [0.1, 'L']]
};

// Swap left and right: names, and the sign of the Y and Z rotations
function flip(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'hipsY') { out[k] = v; continue; }
    if (k === 'hipsOffset') { out[k] = [-v[0], v[1], v[2]]; continue; }
    const mk = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
    out[mk] = [v[0], -v[1], -v[2]];
  }
  return out;
}

export function buildCowboyAttacks(makeClip, idle, pose) {
  const H = 0.007;
  // Reach for a gun held out straight with the body turned by (yaw, pitch); the mirror arm uses the same call.
  const arm = (hips, torso, yaw = 0, pitch = 0) => aimArm(hips, torso, yaw, pitch);

  // 1: right gun, bladed stance: the body turns to the left, the off gun cocked up by the face
  const bladeStance = cowboyStance(0.545 + H, 0.08, [0.20, 0.10], [-0.20, 0.10]);
  const aimR = pose(idle, bladeStance, {
    hips: [0.06, 0.30, -0.02], torso: [0.04, 0.34, 0], head: [0, -0.56, 0],
    armR: arm([0.06, 0.30, -0.02], [0.04, 0.34, 0], 0, 0.04), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: [-0.35, 0, 0.32], foreL: [-2.30, 0, 0], handL: [0.1, 0, 0]
  });
  const aimL = pose(idle, flip(aimR));
  const shot = (name, aim) => makeClip(name, [
    [0, idle], [0.04, aim, 'out'], [0.16, aim, 'lin'],
    [0.26, pose(aim, { torso: [aim.torso[0] + 0.02, aim.torso[1], 0] }), 'lin'], [0.40, idle, 'io']
  ]);

  // 3: Tracer Bullet finisher: drop to one knee, both guns out, alternating burst
  const kneelLegs = {
    legL: [-1.45, 0, 0.14], shinL: [1.50, 0, 0], footL: [-0.09, 0, 0],
    legR: [0.25, 0, -0.12], shinR: [1.55, 0, 0], footR: [0.70, 0, 0], hipsY: 0.37 + H
  };
  const kneelAim = pose(idle, kneelLegs, {
    hips: [0.04, 0, 0], torso: [0.12, 0, 0], head: [-0.08, 0, 0],
    armR: arm([0.04, 0, 0], [0.12, 0, 0], 0.05, 0.02), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.04, 0, 0], [0.12, 0, 0], -0.05, 0.02), foreL: [0, 0, 0], handL: [0, 0, 0]
  });

  // Heavy: Deadeye Magnum, both guns side by side, one huge shot that throws the arms up
  const deadeyeLegs = cowboyStance(0.510 + H, 0.12, [0.22, 0.12], [-0.22, 0.12]);
  const deadeye = pose(idle, deadeyeLegs, {
    hips: [0.06, 0, 0], torso: [0.14, 0, 0], head: [-0.08, 0, 0],
    armR: arm([0.06, 0, 0], [0.14, 0, 0], 0.03, 0.03), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.06, 0, 0], [0.14, 0, 0], -0.03, 0.03), foreL: [0, 0, 0], handL: [0, 0, 0]
  });
  const deadeyeRecoil = pose(deadeye, cowboyStance(0.540 + H, 0.0, [0.22, 0.12], [-0.30, 0.12]), {
    hips: [-0.06, 0, 0], torso: [-0.22, 0, 0], head: [-0.22, 0, 0],
    armR: arm([-0.06, 0, 0], [-0.22, 0, 0], 0.03, 0.80), foreR: [-0.42, 0, 0],
    armL: arm([-0.06, 0, 0], [-0.22, 0, 0], -0.03, 0.80), foreL: [-0.42, 0, 0]
  });

  // Aerial combo: legs gathered, upper body from the ground shots
  const airLegs = {
    legL: [-0.72, 0.04, 0.05], shinL: [1.34, 0, 0], footL: [0.38, 0, -0.03],
    legR: [0.04, -0.04, -0.05], shinR: [1.56, 0, 0], footR: [0.42, 0, 0.03]
  };
  const airBase = pose(idle, airLegs, {
    hips: [0.08, 0.10, 0], hipsY: 0.64 + H, torso: [0.14, 0.12, 0.02], head: [-0.14, -0.14, 0],
    armL: [-0.62, 0, 0.40], foreL: [-1.34, -0.06, 0],
    armR: [-0.62, 0, -0.40], foreR: [-1.34, 0.06, 0]
  });
  const upperOf = p => ({
    hips: p.hips, torso: p.torso, head: p.head,
    armL: p.armL, foreL: p.foreL, handL: p.handL,
    armR: p.armR, foreR: p.foreR, handR: p.handR
  });
  // Spike: both guns down at the target, firing as the body folds forward
  const spikeAim = pose(airBase, {
    hips: [0.20, 0, 0], torso: [0.30, 0, 0], head: [-0.30, 0, 0],
    armR: arm([0.20, 0, 0], [0.30, 0, 0], 0.04, -0.62), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.20, 0, 0], [0.30, 0, 0], -0.04, -0.62), foreL: [0, 0, 0], handL: [0, 0, 0]
  });

  // Air heavy: hover with both guns raised, dive head-first, crash with the guns at the floor
  const slamAimPose = pose(airBase, {
    hips: [0.12, 0, 0], hipsY: 0.65 + H,
    torso: [-0.12, 0, 0], head: [0.10, 0, 0],
    armR: arm([0.12, 0, 0], [-0.12, 0, 0], 0.10, 0.90), foreR: [0, 0, 0],
    armL: arm([0.12, 0, 0], [-0.12, 0, 0], -0.10, 0.90), foreL: [0, 0, 0]
  });
  const slamDivePose = pose(airBase, {
    hips: [0.42, 0, 0], hipsY: 0.62 + H,
    torso: [0.46, 0, 0], head: [-0.42, 0, 0],
    armR: arm([0.42, 0, 0], [0.46, 0, 0], 0.05, -0.50), foreR: [0, 0, 0],
    armL: arm([0.42, 0, 0], [0.46, 0, 0], -0.05, -0.50), foreL: [0, 0, 0],
    legL: [0.14, 0.04, -0.04], shinL: [0.58, 0, 0], footL: [0.48, 0, 0.03],
    legR: [0.36, -0.04, 0.04], shinR: [0.84, 0, 0], footR: [0.52, 0, -0.03]
  });
  const slamLegs = cowboyStance(0.455 + H, 0.24, [0.26, 0.13], [-0.22, 0.13]);
  const slamImpactPose = pose(idle, slamLegs, {
    hips: [0.24, 0, 0], torso: [0.42, 0, 0], head: [-0.30, 0, 0],
    armR: arm([0.24, 0, 0], [0.42, 0, 0], 0.05, -0.30), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.24, 0, 0], [0.42, 0, 0], -0.05, -0.30), foreL: [0, 0, 0], handL: [0, 0, 0]
  });
  const slamCoil = pose(idle, cowboyStance(0.475 + H, 0.20, [0.18, 0.11], [-0.18, 0.11]), {
    hips: [0.20, 0, 0], torso: [0.30, 0, 0], head: [0.10, 0, 0],
    armR: [-0.80, 0, -0.30], foreR: [-1.50, 0, 0], armL: [-0.80, 0, 0.30], foreL: [-1.50, 0, 0]
  });

  return {
    attack1: shot('attack1', aimR),
    attack2: shot('attack2', aimL),
    attack3: makeClip('attack3', [
      [0, idle], [0.06, kneelAim, 'out'], [0.26, kneelAim, 'lin'],
      [0.34, pose(kneelAim, { torso: [0.14, 0, 0] }), 'lin'], [0.52, idle, 'io']
    ]),
    heavy: makeClip('heavy', [
      [0, idle], [0.04, deadeye, 'out'], [0.075, deadeye, 'lin'], [0.12, deadeyeRecoil, 'out'],
      [0.28, deadeye, 'io'], [0.44, deadeye, 'lin'], [0.58, idle, 'io']
    ]),
    airRise: makeClip('airRise', [
      [0, airBase], [0.04, pose(airBase, upperOf(aimR)), 'out'],
      [0.20, pose(airBase, upperOf(aimR)), 'lin'], [0.34, airBase, 'io']
    ]),
    airCut: makeClip('airCut', [
      [0, airBase], [0.04, pose(airBase, upperOf(aimL)), 'out'],
      [0.20, pose(airBase, upperOf(aimL)), 'lin'], [0.34, airBase, 'io']
    ]),
    airSpike: makeClip('airSpike', [
      [0, airBase], [0.05, spikeAim, 'out'], [0.30, spikeAim, 'lin'], [0.44, airBase, 'io']
    ]),
    slamAim: makeClip('slamAim', [
      [0, slamAimPose], [0.40, pose(slamAimPose, { hipsY: 0.675 + H, torso: [-0.08, 0, 0] }), 'io'], [0.80, slamAimPose, 'io']
    ]),
    slamDive: makeClip('slamDive', [[0, slamAimPose], [0.07, slamDivePose, 'out'], [0.40, slamDivePose, 'lin']]),
    slamImpact: makeClip('slamImpact', [[0, slamCoil], [0.06, slamImpactPose, 'in'], [0.28, slamImpactPose, 'io'], [0.48, idle, 'io']])
  };
}

export function buildCowboySkills(makeClip, idle, pose) {
  const H = 0.007;
  const arm = (hips, torso, yaw = 0, pitch = 0) => aimArm(hips, torso, yaw, pitch);

  // Q (cowboy_weapon, High Noon Barrage): arms straight out to both sides firing while the body spins
  // (ChibiView.spin), then both guns point at the ground for the closing golden shot
  const spreadLegs = cowboyStance(0.525 + H, 0.04, [0.18, 0.15], [-0.18, 0.15]);
  const spread = pose(idle, spreadLegs, {
    hips: [0.04, 0, 0], torso: [0.05, 0, 0], head: [0, 0, 0],
    armR: arm([0.04, 0, 0], [0.05, 0, 0], -Math.PI / 2, 0), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.04, 0, 0], [0.05, 0, 0], Math.PI / 2, 0), foreL: [0, 0, 0], handL: [0, 0, 0]
  });
  const rip = pose(idle, cowboyStance(0.470 + H, 0.40, [0.22, 0.13], [-0.20, 0.13]), {
    hips: [0.20, 0, 0], torso: [0.36, 0, 0], head: [-0.20, 0, 0],
    armR: arm([0.20, 0, 0], [0.36, 0, 0], 0.12, -0.85), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.20, 0, 0], [0.36, 0, 0], -0.12, -0.85), foreL: [0, 0, 0], handL: [0, 0, 0]
  });

  // E (cowboy_armor, TNT Dynamite Toss): off hand swings back and lobs the bundle overhand, gun hand ready
  const tossBack = pose(idle, cowboyStance(0.552 + H, 0.04, [0.12, 0.10], [-0.26, 0.10]), {
    hips: [0.04, 0.26, 0], torso: [-0.12, 0.40, 0], head: [0, -0.34, 0],
    armL: [0.78, 0.10, 0.36], foreL: [-1.30, 0, 0], handL: [0.2, 0, 0]
  });
  const tossOut = pose(idle, cowboyStance(0.505 + H, 0.14, [0.26, 0.12], [-0.22, 0.12]), {
    hips: [0.12, -0.30, 0], torso: [0.30, -0.36, 0], head: [-0.15, 0.32, 0],
    armL: [-2.30, 0, 0.20], foreL: [-0.15, 0, 0], handL: [0.1, 0, 0]
  });

  // R (cowboy_helmet, Tactical Roll & Stun Shot): tuck roll that comes up on one knee, both guns out
  const tuck = pose(idle, {
    hips: [0.10, 0, 0], hipsY: 0.50 + H, torso: [0.88, 0, 0], head: [0.46, 0, 0],
    armL: [-0.90, 0.10, 0.24], foreL: [-1.78, -0.14, 0], handL: [0.20, 0, 0],
    armR: [-0.90, -0.10, -0.24], foreR: [-1.78, 0.14, 0], handR: [0.20, 0, 0],
    legL: [-1.62, 0.04, 0.09], shinL: [2.16, 0, 0], footL: [0.34, 0, -0.05],
    legR: [-1.50, -0.04, -0.09], shinR: [2.16, 0, 0], footR: [0.34, 0, 0.05]
  });
  const kneelOut = pose(idle, {
    legL: [-1.45, 0, 0.14], shinL: [1.50, 0, 0], footL: [-0.09, 0, 0],
    legR: [0.25, 0, -0.12], shinR: [1.55, 0, 0], footR: [0.70, 0, 0], hipsY: 0.37 + H
  }, {
    hips: [0.04, 0, 0], torso: [0.12, 0, 0], head: [-0.08, 0, 0],
    armR: arm([0.04, 0, 0], [0.12, 0, 0], 0.05, 0.02), foreR: [0, 0, 0], handR: [0, 0, 0],
    armL: arm([0.04, 0, 0], [0.12, 0, 0], -0.05, 0.02), foreL: [0, 0, 0], handL: [0, 0, 0]
  });

  // F (cowboy_trinket, Bounty Hunter Lasso): fling the loop with the off hand, brace and yank, gun hand aimed
  const lassoOut = pose(idle, cowboyStance(0.505 + H, 0.14, [0.26, 0.12], [-0.22, 0.12]), {
    hips: [0.12, -0.26, 0], torso: [0.28, -0.40, 0], head: [-0.15, 0.34, 0],
    armL: [-1.75, 0, 0.12], foreL: [-0.12, 0, 0], handL: [0.1, 0, 0]
  });
  const lassoYank = pose(idle, cowboyStance(0.520 + H, 0.0, [0.24, 0.16], [-0.24, 0.16]), {
    hips: [-0.06, 0.20, 0], torso: [-0.28, 0.30, 0], head: [-0.10, -0.20, 0],
    armL: [-0.35, 0, 0.40], foreL: [-1.90, 0, 0],
    armR: arm([-0.06, 0.20, 0], [-0.28, 0.30, 0], 0, 0.0), foreR: [0, 0, 0], handR: [0, 0, 0]
  });

  return {
    spin: makeClip('spin', [
      [0, idle], [0.06, spread, 'out'], [0.62, pose(spread, { hipsY: 0.505 + H }), 'lin'],
      [0.70, rip, 'out'], [0.84, rip, 'lin'], [0.98, idle, 'io']
    ]),
    toss: makeClip('toss', [[0, idle], [0.06, tossBack, 'out'], [0.13, tossOut, 'out'], [0.32, tossOut, 'lin'], [0.46, idle, 'io']]),
    rollshot: makeClip('rollshot', [
      [0, idle], [0.04, tuck, 'out'], [0.28, tuck, 'lin'], [0.34, kneelOut, 'out'], [0.52, kneelOut, 'lin'], [0.66, idle, 'io']
    ]),
    lasso: makeClip('lasso', [
      [0, idle], [0.05, lassoOut, 'out'], [0.18, lassoYank, 'out'],
      [0.48, pose(lassoYank, { torso: [-0.30, 0.32, 0] }), 'lin'], [0.64, idle, 'io']
    ])
  };
}
