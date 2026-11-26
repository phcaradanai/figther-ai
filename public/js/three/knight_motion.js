// Poses for the skinned Knight's proportions. The render root still follows
// the server; the hip offsets are local weight shifts, in rig units.
export function buildKnightLocomotion(makeClip, ready, pose) {
  const idle = pose(ready, {
    hips: [0.01, 0.09, -0.022], hipsY: 0.604,
    torso: [0.08, 0.18, 0.035], head: [-0.04, -0.31, -0.02],
    armL: [-0.48, 0, 0.22], foreL: [-1.11, 0, 0],
    armR: [0.18, 0, -0.30], foreR: [-0.38, 0, 0],
    legL: [-0.24, 0.03, 0.004], shinL: [0.27, 0, 0],
    legR: [0.10, -0.025, 0.008], shinR: [0.17, 0, 0]
  });
  const breathe = pose(idle, {
    torso: [0.025, 0.15, 0.048], head: [-0.015, -0.29, -0.035],
    armL: [-0.56, 0, 0.25], foreL: [-1.16, 0, 0],
    armR: [0.13, 0, -0.36], foreR: [-0.43, 0, 0], handR: [0.08, 0.02, 0]
  });

  function gait(name, duration, effort) {
    // The loaded leg moves from reach through compression and push-off.
    // The other leg folds forward. Pelvis and shoulders turn in opposition.
    const keys = [
      { angle: -0.66, knee: 0.16, ankle: 0.37, back: 0.58, fold: 0.28, toe: 0.22, load: 0.003, twist: 0.12, swing: 0.49 },
      { angle: -0.28, knee: 0.33, ankle: -0.06, back: 0.26, fold: 0.65, toe: 0.14, load: -0.020, twist: 0.06, swing: 0.27 },
      { angle: 0.13, knee: 0.15, ankle: -0.32, back: -0.33, fold: 0.80, toe: -0.11, load: 0.014, twist: -0.03, swing: -0.11 },
      { angle: 0.51, knee: 0.20, ankle: 0.04, back: -0.67, fold: 0.39, toe: 0.17, load: 0.017, twist: -0.10, swing: -0.40 }
    ];
    const sprint = name === 'run';
    const frames = [];
    for (const side of [1, -1]) {
      for (const [index, k] of keys.entries()) {
        const phase = (side === 1 ? 0 : 0.5) + [0, 0.115, 0.255, 0.385][index];
        const lead = side === 1 ? 'L' : 'R';
        const trail = side === 1 ? 'R' : 'L';
        frames.push([phase * duration, pose(idle, {
          hips: [0.045 * effort, k.twist * side * effort * 0.72, -0.026 * side * effort],
          hipsOffset: [0.019 * side * effort, 0, k.load * 0.5],
          hipsY: 0.603 + k.load * effort,
          torso: [(sprint ? 0.42 : 0.16) - k.load * 1.6, -k.twist * side * effort * 1.85, 0.068 * side * effort],
          head: [sprint ? -0.32 : -0.12, k.twist * side * 0.60, -0.046 * side * effort],
          armL: [-0.50 - k.swing * side * effort * 0.74, 0.08, 0.27],
          foreL: [(sprint ? -0.75 : -1.01) + k.swing * side * 0.20, 0, 0.04],
          armR: [(sprint ? 0.43 : 0.12) + k.swing * side * effort * 0.72, -0.13, -0.48],
          foreR: [(sprint ? -0.63 : -0.38) - k.swing * side * effort * 0.42, 0, 0],
          handR: [-0.20 * k.swing * side * effort, 0.07, -0.06],
          ['leg' + lead]: [k.angle * effort, 0, -0.015 * side],
          ['shin' + lead]: [k.knee, 0, 0], ['foot' + lead]: [k.ankle * effort, 0, 0],
          ['leg' + trail]: [k.back * effort, 0, 0.015 * side],
          ['shin' + trail]: [k.fold * effort, 0, 0], ['foot' + trail]: [k.toe * effort, 0, 0]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    return makeClip(name, frames);
  }

  function brake(lead, trail, side) {
    const catchStep = pose(idle, {
      hips: [-0.10, 0.08 * side, -0.04 * side], hipsOffset: [0.04 * side, 0, -0.10], hipsY: 0.519,
      torso: [-0.31, 0.13 * side, 0.075 * side], head: [0.18, -0.10 * side, -0.06 * side],
      armL: [-0.88, 0.05, 0.14], foreL: [-1.20, 0, 0],
      armR: [-0.37, -0.18, -0.76], foreR: [-0.57, 0, 0], handR: [0.14, 0, 0],
      ['leg' + lead]: [-0.61, 0.025 * side, -0.018 * side],
      ['shin' + lead]: [0.76, 0, 0], ['foot' + lead]: [-0.14, 0, 0],
      ['leg' + trail]: [0.27, 0, 0.018 * side],
      ['shin' + trail]: [0.54, 0, 0], ['foot' + trail]: [-0.61, 0, 0]
    });
    const recover = pose(catchStep, {
      hips: [0.02, 0.06 * side, 0.025 * side], hipsOffset: [0, 0, 0.032], hipsY: 0.57,
      torso: [0.16, 0.08, 0], head: [-0.09, -0.17, 0],
      armL: [-0.57, 0, 0.25], armR: [0.26, -0.07, -0.36],
      ['leg' + lead]: [-0.38, 0, -0.01 * side], ['shin' + lead]: [0.42, 0, 0],
      ['leg' + trail]: [0.04, 0, 0.01 * side], ['shin' + trail]: [0.43, 0, 0]
    });
    return makeClip('brake' + lead, [[0, catchStep], [0.071, catchStep, 'lin'], [0.145, recover, 'out'], [0.27, idle]]);
  }

  const lift = pose(idle, {
    hips: [0.04, 0.025, -0.026], hipsY: 0.637, torso: [-0.19, 0.14, 0.03], head: [0.13, -0.16, 0],
    legL: [-0.50, 0, -0.027], shinL: [0.48, 0, 0], footL: [0.14, 0, 0],
    legR: [0.12, 0, 0.014], shinR: [0.30, 0, 0], footR: [0.19, 0, 0],
    armL: [-0.48, 0, 0.30], foreL: [-0.90, 0, 0], armR: [0.63, 0, -0.48]
  });
  const tuck = pose(lift, {
    hips: [-0.04, 0.045, -0.035], hipsY: 0.609, torso: [0.18, 0.18, 0.06], head: [-0.12, -0.22, -0.04],
    legL: [-0.76, 0, -0.052], shinL: [0.94, 0, 0], footL: [0.08, 0, 0],
    legR: [-0.19, 0, 0.034], shinR: [0.72, 0, 0], footR: [0.15, 0, 0],
    armL: [-0.94, 0.06, 0.24], foreL: [-1.24, 0, 0],
    armR: [0.19, -0.12, -0.61], foreR: [-0.60, 0, 0]
  });
  const reach = pose(tuck, {
    hips: [0.03, 0.04, -0.018], hipsY: 0.611, torso: [0.30, 0.05, 0.045], head: [-0.12, -0.08, 0],
    legL: [-0.29, 0, -0.022], shinL: [0.35, 0, 0], footL: [0.025, 0, 0],
    legR: [0.035, 0, 0.021], shinR: [0.32, 0, 0], footR: [-0.10, 0, 0],
    armL: [-0.75, 0, 0.18], foreL: [-1.04, 0, 0], armR: [0.29, -0.09, -0.57]
  });
  const dodgePush = pose(idle, {
    hips: [0.20, 0.25, -0.10], hipsY: 0.47, hipsOffset: [0, 0, -0.08],
    torso: [0.34, 0.20, 0.10], head: [-0.30, -0.35, 0],
    armL: [-1.05, 0, -0.13], foreL: [-0.92, 0, 0], armR: [0.48, 0, -0.44],
    legL: [-0.85, 0.03, 0.015], shinL: [1.35, 0, 0], footL: [-0.45, 0, 0],
    legR: [0.67, 0, 0.018], shinR: [0.52, 0, 0], footR: [0.25, 0, 0]
  });
  const dodgePass = pose(dodgePush, {
    hips: [0.24, 0.12, 0.08], hipsY: 0.50, hipsOffset: [0, 0, 0.12],
    torso: [0.38, 0.17, -0.08], armL: [-1.24, 0, -0.16], armR: [0.72, 0, -0.45],
    legL: [0.36, 0, -0.02], shinL: [1.08, 0, 0], footL: [0.24, 0, 0],
    legR: [-0.94, 0, 0.018], shinR: [1.30, 0, 0], footR: [-0.15, 0, 0]
  });
  const dodgeCatch = pose(dodgePass, {
    hips: [0.08, 0.17, 0.04], hipsY: 0.50, hipsOffset: [0, 0, 0.045],
    torso: [0.14, 0.12, -0.02], head: [-0.10, -0.24, 0], armR: [0.30, 0, -0.44],
    legL: [0.29, 0, 0.015], shinL: [0.42, 0, 0], footL: [-0.24, 0, 0],
    legR: [-0.64, 0, 0.022], shinR: [0.77, 0, 0], footR: [-0.16, 0, 0]
  });

  return {
    idle: makeClip('idle', [[0, idle], [0.92, breathe], [2.15, idle]]),
    walk: gait('walk', 0.46, 0.76),
    run: gait('run', 0.39, 1.11),
    brakeL: brake('L', 'R', 1),
    brakeR: brake('R', 'L', -1),
    jump: makeClip('jump', [[0, lift], [0.07, lift, 'lin'], [0.19, tuck, 'out'],
      [0.38, pose(tuck, { torso: [0.10, 0.10, 0.025], armR: [0.07, 0, -0.41] }), 'lin']]),
    fall: makeClip('fall', [[0, pose(tuck, { legL: [-0.50, 0, -0.036], shinL: [0.65, 0, 0] })], [0.19, reach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.052, dodgePush, 'out'], [0.146, dodgePass, 'lin'], [0.252, dodgeCatch, 'out'], [0.35, idle, 'io']])
  };
}
