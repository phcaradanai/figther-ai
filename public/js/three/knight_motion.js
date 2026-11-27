import { SHIELD_HOLD_EULER } from './knight_anatomy.js';

// Poses for the skinned Knight's proportions. The render root still follows
// the server; the hip offsets are local weight shifts, in rig units.

// The Knight's ready stance, shared by locomotion and attacks so both start and
// finish on the same pose.
export function knightIdle(ready, pose) {
  return pose(ready, {
    hips: [0.01, 0.09, -0.022], hipsY: 0.604,
    torso: [0.08, 0.18, 0.035], head: [-0.04, -0.31, -0.02],
    armL: [-0.48, 0, 0.22], foreL: [-1.11, 0, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.18, 0, -0.30], foreR: [-0.38, 0, 0], handR: [0, 0, 0],
    legL: [-0.24, 0.03, 0.004], shinL: [0.27, 0, 0],
    legR: [0.10, -0.025, 0.008], shinR: [0.17, 0, 0]
  });
}

export function buildKnightLocomotion(makeClip, ready, pose) {
  const idle = knightIdle(ready, pose);
  const breathe = pose(idle, {
    torso: [0.04, 0.16, 0.045], head: [-0.02, -0.29, -0.03],
    armL: [-0.54, 0, 0.24], foreL: [-1.15, 0, 0],
    armR: [0.14, 0, -0.34], foreR: [-0.42, 0, 0], handR: [0.06, 0.02, 0]
  });

  // Tree of Savior style run: forward lean, bouncing hips, knee drive, feet under center line.
  const STRIDE = [
    [0.00, [-0.56, 0.28, -0.18], [0.46, 0.96, 0.42], -0.010, 1.0, 1.00],
    [0.08, [-0.32, 0.56, 0.02], [0.34, 1.64, 0.50], -0.004, 0.65, 0.80],
    [0.19, [-0.02, 0.42, 0.14], [-0.40, 1.76, 0.34], -0.010, 0.0, 0.25],
    [0.30, [0.38, 0.26, 0.48], [-0.84, 1.24, 0.12], 0.016, -0.55, -0.45],
    [0.41, [0.52, 0.68, 0.40], [-0.74, 0.54, -0.08], 0.040, -0.85, -0.85]
  ];
  const TRACK = 0.07;

  function gait(name, duration, effort) {
    const sprint = name === 'run';
    const lean = sprint ? 0.40 : 0.26;
    const hipsY = sprint ? 0.588 : 0.600;
    const fold = sprint ? 1.04 : 0.88;
    const bob = sprint ? 1.15 : 0.95;
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.09 * turn * side * effort;
        const chest = -twist * 1.8;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.04, 0.03 + twist, -0.03 * turn * side],
          hipsOffset: [0.014 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: hipsY + rise * bob,
          torso: [lean + 0.05 * (0.5 - rise / 0.04) * (sprint ? 1 : 0.7), chest, 0.04 * side * effort],
          head: [-lean * 0.75, -0.04 - (chest + twist) * 0.7, -0.03 * side],
          armR: [0.06 - 0.38 * swing * effort, -0.10, -0.32],
          foreR: [-0.86 - 0.22 * Math.max(0, swing) + 0.12 * Math.max(0, -swing), 0, 0],
          handR: [0.28 + 0.24 * swing, 0.05, -0.06],
          armL: [-0.42 + 0.40 * swing * effort, 0.06, 0.22],
          foreL: [-1.20 + 0.14 * swing, 0.32, 0],
          handL: SHIELD_HOLD_EULER,
          ['leg' + lead]: [lt * effort, 0, -TRACK * side],
          ['shin' + lead]: [lk * fold, 0, 0], ['foot' + lead]: [la * effort, 0, TRACK * side * 0.7],
          ['leg' + trail]: [tt * effort, 0, TRACK * side],
          ['shin' + trail]: [tk * fold, 0, 0], ['foot' + trail]: [ta * effort, 0, -TRACK * side * 0.7]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    return makeClip(name, frames);
  }

  // Athletic low shield-forward burst dash (replaces stiff generic chibi dash).
  function buildDash() {
    const frames = [];
    const duration = 0.34;
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.08 * turn * side;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.12, -0.04 + twist, -0.03 * turn * side],
          hipsY: 0.562 + rise * 0.9,
          torso: [0.34, 0.12 - twist * 1.4, 0.03 * side],
          head: [-0.28, -0.12, -0.02 * side],
          armL: [-0.94 + 0.14 * swing, 0.10, 0.12],
          foreL: [-1.18 + 0.08 * swing, 0.35, 0],
          handL: SHIELD_HOLD_EULER,
          armR: [0.44 - 0.22 * swing, -0.10, -0.38],
          foreR: [-0.74 - 0.12 * swing, 0, 0],
          handR: [0.18, 0.04, -0.05],
          ['leg' + lead]: [lt * 1.02, 0, -TRACK * side],
          ['shin' + lead]: [lk * 1.02, 0, 0], ['foot' + lead]: [la, 0, TRACK * side * 0.6],
          ['leg' + trail]: [tt * 1.02, 0, TRACK * side],
          ['shin' + trail]: [tk * 1.02, 0, 0], ['foot' + trail]: [ta, 0, -TRACK * side * 0.6]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    return makeClip('dash', frames);
  }

  function brake(lead, trail, side) {
    const catchStep = pose(idle, {
      hips: [-0.08, 0.08 * side, -0.03 * side], hipsOffset: [0.035 * side, 0, -0.08], hipsY: 0.535,
      torso: [-0.24, 0.12 * side, 0.06 * side], head: [0.15, -0.10 * side, -0.05 * side],
      armL: [-0.84, 0.05, 0.14], foreL: [-1.18, 0.30, 0], handL: SHIELD_HOLD_EULER,
      armR: [-0.32, -0.16, -0.68], foreR: [-0.58, 0, 0], handR: [0.12, 0, 0],
      ['leg' + lead]: [-0.56, 0.025 * side, -0.02 * side],
      ['shin' + lead]: [0.72, 0, 0], ['foot' + lead]: [-0.14, 0, 0],
      ['leg' + trail]: [0.25, 0, 0.02 * side],
      ['shin' + trail]: [0.52, 0, 0], ['foot' + trail]: [-0.55, 0, 0]
    });
    const recover = pose(catchStep, {
      hips: [0.02, 0.06 * side, 0.02 * side], hipsOffset: [0, 0, 0.03], hipsY: 0.575,
      torso: [0.14, 0.08, 0], head: [-0.08, -0.16, 0],
      armL: [-0.56, 0, 0.24], armR: [0.22, -0.06, -0.34],
      ['leg' + lead]: [-0.36, 0, -0.01 * side], ['shin' + lead]: [0.40, 0, 0],
      ['leg' + trail]: [0.04, 0, 0.01 * side], ['shin' + trail]: [0.40, 0, 0]
    });
    return makeClip('brake' + lead, [[0, catchStep], [0.071, catchStep, 'lin'], [0.145, recover, 'out'], [0.27, idle]]);
  }

  // Jump & Fall fallback clips (overridden by repaired baked clips unless ?handmade=all).
  const lift = pose(idle, {
    hips: [-0.06, 0.03, 0], hipsY: 0.64, torso: [-0.08, 0.10, 0], head: [0.06, -0.12, 0],
    legL: [0.08, 0, -0.05], shinL: [0.30, 0, 0], footL: [0.55, 0, 0.04],
    legR: [0.26, 0, 0.05], shinR: [0.44, 0, 0], footR: [0.52, 0, -0.04],
    armL: [-0.88, 0.10, 0.34], foreL: [-0.82, 0.25, 0], handL: SHIELD_HOLD_EULER,
    armR: [-0.95, -0.12, -0.26], foreR: [-0.55, 0, 0], handR: [0.10, 0.05, 0]
  });
  const tuck = pose(lift, {
    hips: [0.05, 0.04, 0], hipsY: 0.66, torso: [0.16, 0.12, 0.02], head: [-0.14, -0.14, 0],
    legL: [-1.22, 0, -0.06], shinL: [1.92, 0, 0], footL: [0.40, 0, 0.05],
    legR: [-0.82, 0, 0.06], shinR: [2.02, 0, 0], footR: [0.50, 0, -0.05],
    armL: [0.25, 0.08, 0.44], foreL: [-0.95, 0.25, 0],
    armR: [-1.15, -0.10, -0.22], foreR: [-0.25, 0, 0], handR: [0.65, 0.05, 0]
  });
  const apex = pose(tuck, {
    torso: [0.12, 0.10, 0.02],
    legL: [-1.14, 0, -0.06], shinL: [1.80, 0, 0],
    legR: [-0.70, 0, 0.06], shinR: [1.92, 0, 0],
    armR: [-1.08, -0.10, -0.22], foreR: [-0.28, 0, 0]
  });
  const reach = pose(tuck, {
    hips: [0.02, 0.04, 0], hipsY: 0.625, torso: [0.18, 0.08, 0.02], head: [-0.12, -0.10, 0],
    legL: [-0.46, 0, -0.06], shinL: [0.52, 0, 0], footL: [-0.05, 0, 0.04],
    legR: [0.12, 0, 0.06], shinR: [0.86, 0, 0], footR: [0.28, 0, -0.04],
    armL: [-0.32, 0.06, 0.46], foreL: [-0.85, 0.25, 0],
    armR: [-0.82, -0.10, -0.34], foreR: [-0.45, 0, 0], handR: [0.42, 0.05, 0]
  });

  // Smooth athletic shield-evade dodge (grounded push-off -> glide -> catch step -> idle).
  const dodgePush = pose(idle, {
    hips: [0.16, 0.22, -0.06], hipsY: 0.50, hipsOffset: [0, 0, -0.06],
    torso: [0.28, 0.18, 0.06], head: [-0.24, -0.30, 0],
    armL: [-0.96, 0.08, 0.04], foreL: [-1.05, 0.35, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.42, -0.08, -0.42], foreR: [-0.52, 0, 0], handR: [0.12, 0, 0],
    legL: [-0.78, 0.03, 0.04], shinL: [1.18, 0, 0], footL: [-0.36, 0, -0.03],
    legR: [0.54, 0, -0.04], shinR: [0.52, 0, 0], footR: [0.18, 0, 0.03]
  });
  const dodgePass = pose(dodgePush, {
    hips: [0.20, 0.14, 0.05], hipsY: 0.515, hipsOffset: [0, 0, 0.08],
    torso: [0.32, 0.16, -0.05], head: [-0.26, -0.26, 0],
    armL: [-1.10, 0.10, 0.04], foreL: [-0.98, 0.35, 0],
    armR: [0.58, -0.08, -0.44], foreR: [-0.48, 0, 0],
    legL: [0.32, 0, 0.04], shinL: [0.98, 0, 0], footL: [0.18, 0, -0.03],
    legR: [-0.84, 0, -0.04], shinR: [1.16, 0, 0], footR: [-0.14, 0, 0.03]
  });
  const dodgeCatch = pose(dodgePass, {
    hips: [0.08, 0.16, 0.03], hipsY: 0.525, hipsOffset: [0, 0, 0.04],
    torso: [0.14, 0.14, -0.02], head: [-0.10, -0.24, 0],
    armL: [-0.82, 0.06, 0.10], foreL: [-1.06, 0.25, 0],
    armR: [0.28, -0.05, -0.38], foreR: [-0.44, 0, 0],
    legL: [0.24, 0, 0.04], shinL: [0.42, 0, 0], footL: [-0.22, 0, -0.03],
    legR: [-0.58, 0, -0.04], shinR: [0.72, 0, 0], footR: [-0.14, 0, 0.03]
  });

  // Armored stagger recoil on hit (keeps shield braced, natural knee flex, zero stiff plank).
  const hurtPeak = pose(idle, {
    hips: [-0.04, 0.12, 0.03], hipsY: 0.562, hipsOffset: [0, 0, -0.04],
    torso: [-0.22, -0.14, 0.08], head: [0.18, 0.12, -0.04],
    armL: [-0.75, 0.08, 0.14], foreL: [-1.32, 0.35, 0], handL: SHIELD_HOLD_EULER,
    armR: [0.30, -0.12, -0.46], foreR: [-0.82, 0, 0], handR: [0.12, 0, 0],
    legL: [-0.46, 0.06, 0.05], shinL: [0.68, 0, 0], footL: [-0.18, 0, -0.04],
    legR: [0.26, -0.06, -0.05], shinR: [0.46, 0, 0], footR: [-0.42, 0, 0.04]
  });
  const hurtSettle = pose(idle, {
    hips: [0.0, 0.10, 0.01], hipsY: 0.588,
    torso: [-0.04, 0.04, 0.04], head: [0.04, -0.12, -0.02],
    armL: [-0.58, 0.04, 0.18], foreL: [-1.18, 0.20, 0],
    armR: [0.22, -0.04, -0.36], foreR: [-0.56, 0, 0],
    legL: [-0.32, 0.05, 0.04], shinL: [0.42, 0, 0],
    legR: [0.18, -0.05, -0.04], shinR: [0.28, 0, 0]
  });

  // Knockdown fall with bent knees, chin tucked, and shield/sword clear of floor.
  const kdMid = pose(hurtPeak, {
    hips: [-0.72, 0.06, 0.04], hipsY: 0.42, hipsOffset: [0, 0, -0.06],
    torso: [-0.32, -0.08, 0.06], head: [0.30, 0.06, -0.03],
    armL: [-0.88, 0.10, 0.22], foreL: [-1.18, 0.30, 0], handL: SHIELD_HOLD_EULER,
    armR: [-0.65, -0.18, -0.52], foreR: [-0.95, 0, 0], handR: [0.15, 0, 0],
    legL: [-0.62, 0.04, 0.06], shinL: [0.92, 0, 0], footL: [0.20, 0, 0],
    legR: [-0.28, -0.04, -0.06], shinR: [0.76, 0, 0], footR: [0.25, 0, 0]
  });
  const kdLand = pose(kdMid, {
    hips: [-1.42, 0.04, 0.03], hipsY: 0.21, hipsOffset: [0, 0, -0.08],
    torso: [-0.22, -0.05, 0.04], head: [0.36, 0.05, 0],
    armL: [-1.10, 0.08, 0.35], foreL: [-1.10, 0.30, 0],
    armR: [-1.35, -0.22, -0.45], foreR: [-0.85, 0, 0],
    legL: [-0.34, 0.06, 0.08], shinL: [0.78, 0, 0], footL: [0.30, 0, 0],
    legR: [-0.14, -0.06, -0.08], shinR: [0.62, 0, 0], footR: [0.32, 0, 0]
  });
  const kdBounce = pose(kdLand, { hipsY: 0.245, torso: [-0.28, -0.04, 0.04], head: [0.32, 0.04, 0] });

  return {
    idle: makeClip('idle', [[0, idle], [0.95, breathe], [2.15, idle]]),
    walk: gait('walk', 0.44, 0.9),
    run: gait('run', 0.38, 1.05),
    dash: buildDash(),
    brakeL: brake('L', 'R', 1),
    brakeR: brake('R', 'L', -1),
    jump: makeClip('jump', [[0, lift], [0.05, lift, 'lin'], [0.17, tuck, 'out'], [0.42, apex, 'io']]),
    fall: makeClip('fall', [[0, apex], [0.10, pose(apex, { legL: [-0.92, 0, -0.06], shinL: [1.35, 0, 0] }), 'io'], [0.30, reach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.06, dodgePush, 'out'], [0.16, dodgePass, 'lin'], [0.27, dodgeCatch, 'out'], [0.36, idle, 'io']]),
    hurt: makeClip('hurt', [[0, idle], [0.06, hurtPeak, 'out'], [0.20, hurtSettle, 'io'], [0.34, idle, 'io']]),
    knockdown: makeClip('knockdown', [[0, hurtPeak], [0.18, kdMid, 'in'], [0.36, kdLand, 'out'], [0.46, kdBounce, 'io'], [0.56, kdLand, 'io']])
  };
}
