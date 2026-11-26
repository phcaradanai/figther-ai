// Poses for the skinned Knight's proportions. The render root still follows
// the server; the hip offsets are local weight shifts, in rig units.
export function buildKnightLocomotion(makeClip, ready, pose) {
  const idle = pose(ready, {
    hips: [0.01, 0.16, -0.025], hipsY: 0.592,
    torso: [0.08, 0.18, 0.035], head: [-0.04, -0.31, -0.02],
    armL: [-0.48, 0, 0.22], foreL: [-1.11, 0, 0],
    armR: [0.18, 0, -0.30], foreR: [-0.38, 0, 0],
    legL: [-0.35, 0.10, 0.08], shinL: [0.43, 0, 0],
    legR: [0.18, -0.10, -0.08], shinR: [0.18, 0, 0]
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
      { angle: -0.63, knee: 0.19, ankle: 0.34, back: 0.57, fold: 0.46, toe: -0.33, load: 0.003, twist: 0.19, swing: 0.49 },
      { angle: -0.29, knee: 0.44, ankle: -0.15, back: 0.39, fold: 0.94, toe: -0.43, load: -0.029, twist: 0.10, swing: 0.27 },
      { angle: 0.17, knee: 0.19, ankle: -0.31, back: -0.28, fold: 1.06, toe: -0.21, load: 0.017, twist: -0.03, swing: -0.11 },
      { angle: 0.60, knee: 0.22, ankle: -0.17, back: -0.73, fold: 0.55, toe: 0.20, load: 0.025, twist: -0.15, swing: -0.40 }
    ];
    const frames = [];
    for (const side of [1, -1]) {
      for (const [index, k] of keys.entries()) {
        const phase = (side === 1 ? 0 : 0.5) + [0, 0.115, 0.255, 0.385][index];
        const lead = side === 1 ? 'L' : 'R';
        const trail = side === 1 ? 'R' : 'L';
        frames.push([phase * duration, pose(idle, {
          hips: [0.045 * effort, k.twist * side * effort, -0.064 * side * effort],
          hipsOffset: [0.038 * side * effort, 0, k.load * 0.5],
          hipsY: 0.586 + k.load * effort,
          torso: [0.09 + 0.24 * effort, -k.twist * side * effort * 1.38, 0.085 * side * effort],
          head: [-0.035 - 0.17 * effort, k.twist * side * 0.23, -0.048 * side * effort],
          armL: [-0.62 - k.swing * side * effort * 0.55, 0, 0.23], foreL: [-1.10, 0, 0],
          armR: [0.10 + k.swing * side * effort, 0, -0.36], foreR: [-0.43 - k.swing * side * effort * 0.34, 0, 0],
          handR: [-0.12 * k.swing * side * effort, 0, 0],
          ['leg' + lead]: [k.angle * effort, 0, 0.055 * side],
          ['shin' + lead]: [k.knee, 0, 0], ['foot' + lead]: [k.ankle, 0, 0],
          ['leg' + trail]: [k.back * effort, 0, -0.055 * side],
          ['shin' + trail]: [k.fold * effort, 0, 0], ['foot' + trail]: [k.toe, 0, 0]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    return makeClip(name, frames);
  }

  const lift = pose(idle, {
    hips: [0.08, 0.02, -0.03], hipsY: 0.64, torso: [0.23, 0.05, 0], head: [-0.18, -0.08, 0],
    legL: [-0.30, 0, 0.08], shinL: [0.28, 0, 0], footL: [0.43, 0, 0],
    legR: [0.34, 0, -0.08], shinR: [0.36, 0, 0], footR: [0.52, 0, 0],
    armL: [-0.82, 0, 0.22], armR: [0.54, 0, -0.48]
  });
  const tuck = pose(lift, {
    hips: [-0.10, 0.12, -0.08], hipsY: 0.606, torso: [0.11, 0.18, 0.05],
    legL: [-1.14, 0, 0.13], shinL: [1.39, 0, 0], footL: [0.20, 0, 0],
    legR: [-0.36, 0, -0.09], shinR: [1.12, 0, 0], footR: [0.34, 0, 0],
    armL: [-0.99, 0, 0.29], armR: [-0.08, 0, -0.69], foreR: [-0.57, 0, 0]
  });
  const reach = pose(tuck, {
    hips: [0, 0.12, -0.04], hipsY: 0.61, torso: [0.17, 0.08, 0.03], head: [0.09, -0.17, 0],
    legL: [-0.47, 0, 0.09], shinL: [0.51, 0, 0], footL: [0.12, 0, 0],
    legR: [0.11, 0, -0.09], shinR: [0.51, 0, 0], footR: [0.24, 0, 0],
    armL: [-0.72, 0, 0.36], armR: [0.18, 0, -0.74]
  });
  const dodgePush = pose(idle, {
    hips: [0.20, 0.25, -0.10], hipsY: 0.47, hipsOffset: [0, 0, -0.08],
    torso: [0.34, 0.20, 0.10], head: [-0.30, -0.35, 0],
    armL: [-1.05, 0, -0.13], foreL: [-0.92, 0, 0], armR: [0.48, 0, -0.44],
    legL: [-0.85, 0.08, 0.12], shinL: [1.35, 0, 0], footL: [-0.45, 0, 0],
    legR: [0.67, 0, -0.11], shinR: [0.52, 0, 0], footR: [0.25, 0, 0]
  });
  const dodgePass = pose(dodgePush, {
    hips: [0.24, 0.12, 0.08], hipsY: 0.50, hipsOffset: [0, 0, 0.12],
    torso: [0.38, 0.17, -0.08], armL: [-1.24, 0, -0.16], armR: [0.72, 0, -0.45],
    legL: [0.36, 0, 0.11], shinL: [1.08, 0, 0], footL: [0.34, 0, 0],
    legR: [-0.94, 0, -0.12], shinR: [1.30, 0, 0], footR: [-0.15, 0, 0]
  });
  const dodgeCatch = pose(dodgePass, {
    hips: [0.08, 0.17, 0.04], hipsY: 0.50, hipsOffset: [0, 0, 0.045],
    torso: [0.14, 0.12, -0.02], head: [-0.10, -0.24, 0], armR: [0.30, 0, -0.44],
    legL: [0.29, 0, 0.11], shinL: [0.42, 0, 0], footL: [-0.24, 0, 0],
    legR: [-0.64, 0, -0.12], shinR: [0.77, 0, 0], footR: [-0.16, 0, 0]
  });

  return {
    idle: makeClip('idle', [[0, idle], [0.92, breathe], [2.15, idle]]),
    walk: gait('walk', 0.47, 0.80),
    run: gait('run', 0.39, 1.15),
    jump: makeClip('jump', [[0, lift], [0.17, tuck, 'out'], [0.42, pose(tuck, { torso: [0.04, 0.16, 0.04], armR: [-0.15, 0, -0.73] }), 'lin']]),
    fall: makeClip('fall', [[0, tuck], [0.22, reach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.052, dodgePush, 'out'], [0.146, dodgePass, 'lin'], [0.252, dodgeCatch, 'out'], [0.35, idle, 'io']])
  };
}
