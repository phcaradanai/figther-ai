// Natural, anatomically accurate human shinobi locomotion and reaction clips
// calibrated to the skinned Shadow Ninja's proportions.

// Leg geometry of the skinned Ninja, in rig units (hipHeight=0.76, HIPS_Y=0.62).
const THIGH = 0.2752;
const SHIN = 0.2601;
const THIGH_REST = 0.0489;
const SHIN_REST = -0.0103;
const ANKLE = 0.0897;
const PIVOT = 0.0163;
const KNEE_REST_OFFSET = SHIN_REST - THIGH_REST; // -0.0592 rad at rest; knee >= 0.13 guarantees true flexion

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Two-bone leg angles that place a flat sandal at `reach` ahead of its hip
// with strictly anatomical forward knee flexion (zero hyperextension or sideways buckling).
export function ninjaPlant(hipsY, pitch, reach, spread) {
  const drop = (hipsY - PIVOT - ANKLE) / Math.cos(spread);
  const distance = Math.min(Math.hypot(reach, drop), THIGH + SHIN - 0.008);
  const line = Math.atan2(-reach, drop);
  const open = Math.acos(clamp((THIGH ** 2 + distance ** 2 - SHIN ** 2) / (2 * THIGH * distance), -1, 1));
  const thigh = line - open;
  const kneeZ = -THIGH * Math.sin(thigh);
  const kneeY = -THIGH * Math.cos(thigh);
  const shin = Math.atan2(-(-distance * Math.sin(line) - kneeZ), -(-distance * Math.cos(line) - kneeY));
  const leg = thigh - pitch - THIGH_REST;
  const knee = Math.max(0.14, shin - thigh - KNEE_REST_OFFSET);
  return [leg, knee, clamp(-(pitch + leg + knee), -0.85, 0.90)];
}

export function ninjaStance(hipsY, pitch, [leftReach, leftSpread], [rightReach, rightSpread]) {
  const [legL, shinL, footL] = ninjaPlant(hipsY, pitch, leftReach, leftSpread);
  const [legR, shinR, footR] = ninjaPlant(hipsY, pitch, rightReach, rightSpread);
  return {
    hipsY,
    legL: [legL, 0.05, leftSpread], shinL: [shinL, 0, 0], footL: [footL, 0, -leftSpread * 0.7],
    legR: [legR, -0.05, -rightSpread], shinR: [shinR, 0, 0], footR: [footR, 0, rightSpread * 0.7]
  };
}

// Low coiled dual-kunai shinobi ready stance shared across locomotion and combat clips.
export function ninjaIdle(ready, pose) {
  return pose(ready, ninjaStance(0.565, 0.08, [0.16, 0.07], [-0.18, 0.08]), {
    hips: [0.08, 0.24, -0.02],
    torso: [0.18, 0.20, 0.02],
    head: [-0.20, -0.40, -0.02],
    armL: [-0.46, 0.14, 0.28],
    foreL: [-1.42, -0.28, 0],
    handL: [0.22, -0.15, 0.08],
    armR: [0.28, -0.18, -0.34],
    foreR: [-0.88, 0.22, 0],
    handR: [0.38, 0.10, -0.08]
  });
}

export function buildNinjaLocomotion(makeClip, ready, pose) {
  const idle = ninjaIdle(ready, pose);
  const breathe = pose(idle, ninjaStance(0.558, 0.09, [0.16, 0.07], [-0.18, 0.08]), {
    torso: [0.21, 0.19, 0.03],
    head: [-0.22, -0.39, -0.02],
    armL: [-0.51, 0.14, 0.26],
    foreL: [-1.48, -0.28, 0],
    armR: [0.32, -0.18, -0.36],
    foreR: [-0.94, 0.22, 0]
  });

  // High-cadence athletic human shinobi stride: low hips, knee drive, rear heel flick, feet near center track.
  // Columns: [phase, [leadLegX, leadShinX, leadFootX], [trailLegX, trailShinX, trailFootX], hipsRise, yawSign, armSwing]
  const STRIDE = [
    [0.00, [-0.66, 0.30, -0.14], [0.46, 0.96, 0.40], -0.014, 1.0, 1.00],
    [0.09, [-0.34, 0.54, 0.02],  [0.28, 1.66, 0.46], -0.006, 0.65, 0.78],
    [0.20, [0.02, 0.38, 0.14],   [-0.44, 1.82, 0.30], -0.010, 0.0, 0.20],
    [0.31, [0.40, 0.32, 0.42],   [-0.86, 1.54, 0.16],  0.018, -0.55, -0.45],
    [0.42, [0.52, 0.74, 0.38],   [-0.80, 0.94, -0.04], 0.036, -0.85, -0.85]
  ];
  const TRACK = 0.055;

  function buildWalk() {
    const duration = 0.32;
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.10 * turn * side;
        const chest = -twist * 1.7;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.08, twist, -0.03 * turn * side],
          hipsOffset: [0.012 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: 0.562 + rise * 0.85,
          torso: [0.32 + 0.04 * (0.5 - rise / 0.04), chest, 0.04 * side],
          head: [-0.30, -chest * 0.72 - twist * 0.6, -0.03 * side],
          armL: [0.22 + 0.42 * swing, 0.10, 0.24],
          foreL: [-1.18 + 0.16 * swing, -0.25, 0],
          handL: [0.42 + 0.18 * swing, -0.10, 0.06],
          armR: [0.22 - 0.42 * swing, -0.10, -0.24],
          foreR: [-1.18 - 0.16 * swing, 0.25, 0],
          handR: [0.42 - 0.18 * swing, 0.10, -0.06],
          ['leg' + lead]: [lt * 0.92, 0, -TRACK * side],
          ['shin' + lead]: [Math.max(0.16, lk * 0.92), 0, 0],
          ['foot' + lead]: [la * 0.90, 0, TRACK * side * 0.7],
          ['leg' + trail]: [tt * 0.92, 0, TRACK * side],
          ['shin' + trail]: [Math.max(0.16, tk * 0.92), 0, 0],
          ['foot' + trail]: [ta * 0.90, 0, -TRACK * side * 0.7]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    const clip = makeClip('walk', frames);
    clip.userData = { groundSpeed: 4.4, stance: 0.28 };
    return clip;
  }

  // Agile shinobi sprint: aerodynamic ~42 deg chest lean, stabilized gaze,
  // powerful strides, bent trailing elbows with blades swept back clear of flanks.
  function buildSprint(name, duration, speedMeta, forwardLean) {
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.11 * turn * side;
        const chest = -twist * 1.3;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.16, twist, -0.03 * turn * side],
          hipsOffset: [0.010 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: 0.532 + rise * 0.95,
          torso: [forwardLean + 0.04 * (0.5 - rise / 0.04), chest, 0.03 * side],
          head: [-(forwardLean * 0.82), -chest * 0.75 - twist * 0.5, -0.02 * side],
          armL: [0.84 + 0.14 * swing, 0.16, 0.30],
          foreL: [-0.34 - 0.08 * swing, -0.22, 0],
          handL: [0.68, -0.08, 0.06],
          armR: [0.84 - 0.14 * swing, -0.16, -0.30],
          foreR: [-0.34 + 0.08 * swing, 0.22, 0],
          handR: [0.68, 0.08, -0.06],
          ['leg' + lead]: [lt * 1.06, 0, -TRACK * side],
          ['shin' + lead]: [Math.max(0.18, lk * 1.05), 0, 0],
          ['foot' + lead]: [la * 1.02, 0, TRACK * side * 0.65],
          ['leg' + trail]: [tt * 1.06, 0, TRACK * side],
          ['shin' + trail]: [Math.max(0.18, tk * 1.05), 0, 0],
          ['foot' + trail]: [ta * 1.02, 0, -TRACK * side * 0.65]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    const clip = makeClip(name, frames);
    if (speedMeta) clip.userData = speedMeta;
    return clip;
  }

  // Acrobatic shinobi jump (supports triple jump cleanly) and cat-like descent
  const jLift = pose(idle, {
    hips: [-0.04, 0.06, 0], hipsY: 0.635,
    torso: [0.12, 0.08, 0], head: [-0.10, -0.10, 0],
    legL: [0.06, 0.02, -0.04], shinL: [0.42, 0, 0], footL: [0.50, 0, 0.03],
    legR: [0.22, -0.02, 0.04], shinR: [0.56, 0, 0], footR: [0.48, 0, -0.03],
    armL: [-0.72, 0.14, 0.42], foreL: [-0.95, -0.20, 0], handL: [0.20, -0.10, 0],
    armR: [0.55, -0.18, -0.38], foreR: [-0.62, 0.20, 0], handR: [0.35, 0.10, 0]
  });
  const jTuck = pose(jLift, {
    hips: [0.14, 0.08, 0], hipsY: 0.655,
    torso: [0.36, 0.12, 0.02], head: [-0.30, -0.14, 0],
    legL: [-1.32, 0.04, -0.06], shinL: [2.04, 0, 0], footL: [0.42, 0, 0.04],
    legR: [-0.88, -0.04, 0.06], shinR: [2.12, 0, 0], footR: [0.52, 0, -0.04],
    armL: [0.46, 0.12, 0.48], foreL: [-0.88, -0.22, 0],
    armR: [0.68, -0.14, -0.44], foreR: [-0.58, 0.22, 0]
  });
  const jApex = pose(jTuck, {
    torso: [0.28, 0.10, 0.02], head: [-0.24, -0.12, 0],
    legL: [-1.18, 0.04, -0.06], shinL: [1.86, 0, 0],
    legR: [-0.72, -0.04, 0.06], shinR: [1.96, 0, 0]
  });
  const fallReach = pose(jApex, {
    hips: [0.08, 0.16, -0.02], hipsY: 0.525,
    torso: [0.22, 0.16, 0.02], head: [-0.20, -0.26, 0],
    legL: [-0.72, 0.04, 0.06], shinL: [1.12, 0, 0], footL: [-0.26, 0, -0.04],
    legR: [0.12, -0.04, -0.06], shinR: [1.06, 0, 0], footR: [-0.14, 0, 0.04],
    armL: [-0.56, 0.12, 0.44], foreL: [-1.05, -0.20, 0],
    armR: [-0.16, -0.14, -0.44], foreR: [-0.88, 0.20, 0]
  });

  // Compact shinobi somersault tuck (elbow flex <= 2.25, knee flex <= 2.25 -> 0 ROM violations)
  const rollTuck = pose(idle, {
    hips: [0.10, 0, 0], hipsY: 0.49,
    torso: [0.88, 0, 0], head: [0.48, 0, 0],
    armL: [-0.95, 0.10, 0.26], foreL: [-1.72, -0.15, 0], handL: [0.20, 0, 0],
    armR: [-0.95, -0.10, -0.26], foreR: [-1.72, 0.15, 0], handR: [0.20, 0, 0],
    legL: [-1.68, 0.04, 0.10], shinL: [2.22, 0, 0], footL: [0.35, 0, -0.06],
    legR: [-1.56, -0.04, -0.10], shinR: [2.22, 0, 0], footR: [0.35, 0, 0.06]
  });

  // Crossed dual-kunai parry guard + guard hit absorption
  const guardPose = pose(idle, ninjaStance(0.535, 0.14, [0.24, 0.11], [-0.22, 0.11]), {
    hips: [0.14, 0.22, -0.02], torso: [0.24, 0.18, 0.02], head: [-0.24, -0.34, 0],
    armL: [-1.22, 0.42, -0.22], foreL: [-1.28, -0.35, 0], handL: [0.22, -0.15, 0.05],
    armR: [-1.14, -0.46, 0.20], foreR: [-1.24, 0.35, 0], handR: [0.24, 0.15, -0.05]
  });
  const guardBreathe = pose(guardPose, {
    torso: [0.27, 0.17, 0.02],
    armL: [-1.26, 0.42, -0.22], armR: [-1.18, -0.46, 0.20]
  });
  const guardHitPose = pose(guardPose, ninjaStance(0.515, 0.08, [0.26, 0.12], [-0.24, 0.12]), {
    hips: [0.08, 0.24, -0.03], torso: [-0.04, 0.14, 0.04], head: [-0.04, -0.28, 0],
    armL: [-1.04, 0.36, -0.12], foreL: [-1.46, -0.35, 0],
    armR: [-0.96, -0.38, 0.12], foreR: [-1.42, 0.35, 0]
  });

  // Agile stagger & tucked knockdown/defeat
  const hurtPeak = pose(idle, ninjaStance(0.545, -0.02, [0.14, 0.10], [-0.22, 0.10]), {
    hips: [-0.02, 0.14, 0.03], torso: [-0.24, -0.14, 0.06], head: [0.16, 0.14, -0.04],
    armL: [-0.42, 0.12, 0.72], foreL: [-0.74, -0.25, 0], handL: [0.18, 0, 0],
    armR: [-0.36, -0.12, -0.78], foreR: [-0.68, 0.25, 0], handR: [0.18, 0, 0]
  });
  const hurtSettle = pose(idle, ninjaStance(0.558, 0.06, [0.16, 0.08], [-0.18, 0.08]), {
    torso: [0.02, 0.06, 0.03], head: [-0.08, -0.18, 0]
  });
  const kdMid = pose(hurtPeak, {
    hips: [-0.74, 0.06, 0.03], hipsY: 0.42, hipsOffset: [0, 0, -0.06],
    torso: [-0.28, -0.08, 0.05], head: [0.32, 0.06, -0.03],
    armL: [-0.75, 0.14, 0.42], foreL: [-0.95, -0.20, 0],
    armR: [-0.68, -0.14, -0.46], foreR: [-0.90, 0.20, 0],
    legL: [-0.64, 0.04, 0.06], shinL: [0.98, 0, 0], footL: [0.22, 0, 0],
    legR: [-0.30, -0.04, -0.06], shinR: [0.82, 0, 0], footR: [0.24, 0, 0]
  });
  const kdLand = pose(kdMid, {
    hips: [-1.40, 0.04, 0.02], hipsY: 0.285, hipsOffset: [0, 0, -0.06],
    torso: [0.08, -0.04, 0.03], head: [0.44, 0.04, 0],
    armL: [-1.18, 0.12, 0.48], foreL: [-0.85, -0.20, 0],
    armR: [-1.22, -0.14, -0.48], foreR: [-0.82, 0.20, 0],
    legL: [-0.34, 0.05, 0.07], shinL: [0.76, 0, 0], footL: [0.30, 0, 0],
    legR: [-0.16, -0.05, -0.07], shinR: [0.62, 0, 0], footR: [0.32, 0, 0]
  });
  const kdBounce = pose(kdLand, { hipsY: 0.315, torso: [0.02, -0.03, 0.03] });

  return {
    idle: makeClip('idle', [[0, idle], [0.90, breathe], [1.80, idle]]),
    walk: buildWalk(),
    run: buildSprint('run', 0.26, { groundSpeed: 6.2, stance: 0.24 }, 0.56),
    dash: buildSprint('dash', 0.24, null, 0.66),
    jump: makeClip('jump', [[0, jLift], [0.045, jLift, 'lin'], [0.15, jTuck, 'out'], [0.38, jApex, 'io']]),
    fall: makeClip('fall', [[0, jApex], [0.10, pose(jApex, { legL: [-0.95, 0.04, -0.06], shinL: [1.45, 0, 0] }), 'io'], [0.28, fallReach, 'out']]),
    roll: makeClip('roll', [[0, idle], [0.05, rollTuck, 'out'], [0.32, rollTuck, 'lin'], [0.46, idle, 'io']]),
    guard: makeClip('guard', [[0, guardPose], [0.60, guardBreathe], [1.20, guardPose]]),
    guardHit: makeClip('guardHit', [[0, guardPose], [0.05, guardHitPose, 'out'], [0.22, guardPose, 'io']]),
    hurt: makeClip('hurt', [[0, idle], [0.05, hurtPeak, 'out'], [0.18, hurtSettle, 'io'], [0.32, idle, 'io']]),
    knockdown: makeClip('knockdown', [[0, hurtPeak], [0.18, kdMid, 'in'], [0.36, kdLand, 'out'], [0.46, kdBounce, 'io'], [0.56, kdLand, 'io']]),
    dead: makeClip('dead', [[0, hurtPeak], [0.26, kdMid, 'in'], [0.54, kdLand, 'out']])
  };
}
