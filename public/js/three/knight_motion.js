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

  // Tree of Savior style chibi run: forward lean, bouncing hips, a knee driven
  // high through a heel kicked up behind, fists pumping, feet landing under the
  // body. Per half stride the lead leg reaches, catches the body, passes under it
  // and pushes off; both feet leave the ground before the other leg lands.
  const STRIDE = [
    // [phase, lead thigh/knee/ankle, trail thigh/knee/ankle, hip height, pelvis turn, arm swing]
    [0.00, [-0.60, 0.26, -0.20], [0.50, 1.00, 0.48], -0.012, 1.0, 1.00],
    [0.08, [-0.34, 0.58, 0.02], [0.36, 1.72, 0.58], -0.004, 0.65, 0.80],
    [0.19, [-0.02, 0.44, 0.14], [-0.42, 1.85, 0.36], -0.012, 0.0, 0.25],
    [0.30, [0.40, 0.24, 0.55], [-0.90, 1.30, 0.12], 0.018, -0.55, -0.45],
    [0.41, [0.56, 0.72, 0.46], [-0.80, 0.56, -0.08], 0.045, -0.85, -0.85]
  ];
  // Thighs adduct so each boot lands near the centre line instead of under its hip.
  const TRACK = 0.075;

  function gait(name, duration, effort) {
    const sprint = name === 'run';
    const lean = sprint ? 0.42 : 0.28;
    const hipsY = sprint ? 0.588 : 0.600;
    const fold = sprint ? 1.06 : 0.9;
    const bob = sprint ? 1.2 : 1;
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.10 * turn * side * effort;
        const chest = -twist * 1.9;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.04, 0.03 + twist, -0.03 * turn * side],
          hipsOffset: [0.016 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: hipsY + rise * bob,
          torso: [lean + 0.06 * (0.5 - rise / 0.045) * (sprint ? 1 : 0.7), chest, 0.045 * side * effort],
          head: [-lean * 0.78, -0.05 - (chest + twist) * 0.7, -0.03 * side],
          // Sword arm pumps opposite the lead leg, mostly behind the hip, so the
          // blade is carried level instead of brandished.
          armR: [0.05 - 0.42 * swing * effort, -0.10, -0.32],
          foreR: [-0.85 - 0.25 * Math.max(0, swing) + 0.15 * Math.max(0, -swing), 0, 0],
          handR: [0.35 + 0.30 * swing, 0.06, -0.08],
          // Shield arm stays bent with the shield carried at the hip.
          armL: [-0.40 + 0.46 * swing * effort, 0.06, 0.24],
          foreL: [-1.22 + 0.16 * swing, 0, 0],
          ['leg' + lead]: [lt * effort, 0, -TRACK * side],
          ['shin' + lead]: [lk * fold, 0, 0], ['foot' + lead]: [la * effort, 0, TRACK * side * 0.8],
          ['leg' + trail]: [tt * effort, 0, TRACK * side],
          ['shin' + trail]: [tk * fold, 0, 0], ['foot' + trail]: [ta * effort, 0, -TRACK * side * 0.8]
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

  // Jump: push off through the toes, then gather both knees up to the chest with
  // the sword pointed ahead and the shield arm thrown back for balance, then let
  // the legs open toward the ground on the way down.
  const lift = pose(idle, {
    hips: [-0.06, 0.03, 0], hipsY: 0.648, torso: [-0.08, 0.10, 0], head: [0.06, -0.12, 0],
    legL: [0.10, 0, -0.05], shinL: [0.30, 0, 0], footL: [0.62, 0, 0.04],
    legR: [0.30, 0, 0.05], shinR: [0.46, 0, 0], footR: [0.58, 0, -0.04],
    armL: [-0.95, 0.10, 0.36], foreL: [-0.80, 0, 0],
    armR: [-1.05, -0.12, -0.26], foreR: [-0.55, 0, 0], handR: [0.10, 0.05, 0]
  });
  const tuck = pose(lift, {
    hips: [0.05, 0.04, 0], hipsY: 0.668, torso: [0.16, 0.12, 0.02], head: [-0.16, -0.14, 0],
    legL: [-1.30, 0, -0.07], shinL: [2.05, 0, 0], footL: [0.45, 0, 0.05],
    legR: [-0.88, 0, 0.07], shinR: [2.15, 0, 0], footR: [0.55, 0, -0.05],
    armL: [0.30, 0.08, 0.50], foreL: [-0.95, 0, 0],
    armR: [-1.22, -0.10, -0.20], foreR: [-0.12, 0, 0], handR: [0.78, 0.05, 0]
  });
  const apex = pose(tuck, {
    torso: [0.12, 0.10, 0.02],
    legL: [-1.20, 0, -0.07], shinL: [1.90, 0, 0],
    legR: [-0.74, 0, 0.07], shinR: [2.05, 0, 0],
    armR: [-1.14, -0.10, -0.22], foreR: [-0.18, 0, 0]
  });
  const reach = pose(tuck, {
    hips: [0.02, 0.04, 0], hipsY: 0.630, torso: [0.20, 0.08, 0.02], head: [-0.14, -0.10, 0],
    legL: [-0.50, 0, -0.06], shinL: [0.55, 0, 0], footL: [-0.05, 0, 0.04],
    legR: [0.12, 0, 0.06], shinR: [0.90, 0, 0], footR: [0.30, 0, -0.04],
    armL: [-0.30, 0.06, 0.52], foreL: [-0.85, 0, 0],
    armR: [-0.85, -0.10, -0.34], foreR: [-0.45, 0, 0], handR: [0.50, 0.05, 0]
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
    walk: gait('walk', 0.44, 0.9),
    run: gait('run', 0.39, 1.08),
    brakeL: brake('L', 'R', 1),
    brakeR: brake('R', 'L', -1),
    jump: makeClip('jump', [[0, lift], [0.05, lift, 'lin'], [0.17, tuck, 'out'], [0.42, apex, 'io']]),
    fall: makeClip('fall', [[0, apex], [0.10, pose(apex, { legL: [-0.95, 0, -0.07], shinL: [1.40, 0, 0] }), 'io'],
      [0.30, reach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.052, dodgePush, 'out'], [0.146, dodgePass, 'lin'], [0.252, dodgeCatch, 'out'], [0.35, idle, 'io']])
  };
}
