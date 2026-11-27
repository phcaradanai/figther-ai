// Natural, anatomically accurate human locomotion, flight, and reaction clips
// calibrated to the skinned Fire Archmage's exact proportions.

// Leg geometry of the skinned Fire Archmage, in rig units (hipHeight=0.74, HIPS_Y=0.62).
const THIGH = 0.2557;
const SHIN = 0.2516;
const THIGH_REST = 0.0179;
const SHIN_REST = 0.0192;
const ANKLE = 0.1005;
const PIVOT = 0.0168;
const KNEE_REST_OFFSET = SHIN_REST - THIGH_REST; // +0.0013 rad at rest; knee >= 0.14 guarantees true flexion

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Two-bone leg angles that place a flat boot sole at `reach` ahead of its hip
// with strictly anatomical forward knee flexion (zero hyperextension or sideways buckling).
export function magePlant(hipsY, pitch, reach, spread) {
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

export function mageStance(hipsY, pitch, [leftReach, leftSpread], [rightReach, rightSpread]) {
  const [legL, shinL, footL] = magePlant(hipsY, pitch, leftReach, leftSpread);
  const [legR, shinR, footR] = magePlant(hipsY, pitch, rightReach, rightSpread);
  return {
    hipsY,
    legL: [legL, 0.04, leftSpread], shinL: [shinL, 0, 0], footL: [footL, 0, -leftSpread * 0.7],
    legR: [legR, -0.04, -rightSpread], shinR: [shinR, 0, 0], footR: [footR, 0, rightSpread * 0.7]
  };
}

// Poised Fire Archmage casting stance: staff upright in right fist, open flame palm forward-left.
export function mageIdle(ready, pose) {
  return pose(ready, mageStance(0.562, 0.05, [0.12, 0.07], [-0.14, 0.07]), {
    hips: [0.05, 0.14, -0.02],
    torso: [0.06, 0.16, 0.01],
    head: [-0.08, -0.26, -0.01],
    armR: [-0.16, -0.10, -0.46],
    foreR: [-1.16, 0.16, 0],
    handR: [0.12, 0.05, -0.05],
    armL: [-0.36, 0.16, 0.24],
    foreL: [-0.92, -0.18, 0],
    handL: [0.20, -0.14, 0.06]
  });
}

export function buildMageLocomotion(makeClip, ready, pose) {
  const idle = mageIdle(ready, pose);
  const breathe = pose(idle, mageStance(0.556, 0.06, [0.12, 0.07], [-0.14, 0.07]), {
    torso: [0.09, 0.15, 0.02],
    head: [-0.10, -0.25, -0.01],
    armR: [-0.19, -0.10, -0.47],
    foreR: [-1.20, 0.16, 0],
    armL: [-0.40, 0.16, 0.22],
    foreL: [-0.98, -0.18, 0]
  });

  // Grounded athletic spellcaster stride calibrated for 0.507-unit leg reach.
  // Columns: [phase, [leadLegX, leadShinX, leadFootX], [trailLegX, trailShinX, trailFootX], hipsRise, yawSign, armSwing]
  const STRIDE = [
    [0.00, [-0.66, 0.30, -0.14], [0.46, 0.94, 0.40], -0.014, 1.0, 1.00],
    [0.09, [-0.34, 0.54, 0.02],  [0.28, 1.62, 0.46], -0.006, 0.65, 0.78],
    [0.20, [0.02, 0.38, 0.14],   [-0.44, 1.78, 0.30], -0.010, 0.0, 0.20],
    [0.31, [0.38, 0.52, 0.42],   [-0.84, 1.48, 0.16],  0.018, -0.55, -0.45],
    [0.42, [0.50, 0.86, 0.38],   [-0.78, 0.92, -0.04], 0.036, -0.85, -0.85]
  ];
  const TRACK = 0.055;

  function buildWalk() {
    const duration = 0.30;
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.09 * turn * side;
        const chest = -twist * 1.4;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.06, twist, -0.025 * turn * side],
          hipsOffset: [0.010 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: 0.555 + rise * 0.85,
          torso: [0.16 + 0.03 * (0.5 - rise / 0.04), chest, 0.03 * side],
          head: [-0.15, -chest * 0.7 - twist * 0.5, -0.02 * side],
          armL: [-0.28 + 0.34 * swing, 0.12, 0.22],
          foreL: [-0.95 + 0.14 * swing, -0.16, 0],
          handL: [0.18 + 0.10 * swing, -0.10, 0.05],
          armR: [-0.16 - 0.18 * swing, -0.10, -0.44],
          foreR: [-1.14 - 0.08 * swing, 0.16, 0],
          handR: [0.12, 0.05, -0.05],
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
    clip.userData = { groundSpeed: 4.5, stance: 0.27 };
    return clip;
  }

  // Forward-leaning arcane sprint with staff carried upright-tilted and free hand swaying in rhythm
  function buildSprint(name, duration, speedMeta, forwardLean) {
    const frames = [];
    for (const side of [1, -1]) {
      const lead = side === 1 ? 'L' : 'R';
      const trail = side === 1 ? 'R' : 'L';
      for (const [at, [lt, lk, la], [tt, tk, ta], rise, turn, arm] of STRIDE) {
        const swing = arm * side;
        const twist = -0.10 * turn * side;
        const chest = -twist * 1.25;
        frames.push([((side === 1 ? 0 : 0.5) + at) * duration, pose(idle, {
          hips: [0.12, twist, -0.025 * turn * side],
          hipsOffset: [0.008 * side * Math.max(0, 1 - Math.abs(turn - 0.3)), 0, 0],
          hipsY: 0.532 + rise * 0.95,
          torso: [forwardLean + 0.03 * (0.5 - rise / 0.04), chest, 0.03 * side],
          head: [-(forwardLean * 0.80), -chest * 0.75 - twist * 0.5, -0.02 * side],
          armL: [0.36 + 0.36 * swing, 0.14, 0.28],
          foreL: [-0.82 - 0.12 * swing, -0.16, 0],
          handL: [0.22, -0.08, 0.05],
          armR: [-0.12 - 0.14 * swing, -0.10, -0.46],
          foreR: [-1.12 - 0.06 * swing, 0.14, 0],
          handR: [0.16, 0.05, -0.05],
          ['leg' + lead]: [lt * 1.04, 0, -TRACK * side],
          ['shin' + lead]: [Math.max(0.18, lk * 1.04), 0, 0],
          ['foot' + lead]: [la * 1.00, 0, TRACK * side * 0.65],
          ['leg' + trail]: [tt * 1.04, 0, TRACK * side],
          ['shin' + trail]: [Math.max(0.18, tk * 1.04), 0, 0],
          ['foot' + trail]: [ta * 1.00, 0, -TRACK * side * 0.65]
        }), 'lin']);
      }
    }
    frames.push([duration, frames[0][1], 'lin']);
    const clip = makeClip(name, frames);
    if (speedMeta) clip.userData = speedMeta;
    return clip;
  }

  // Buoyant arcane jump & cat-soft landing reach matched to idle stance height
  const jLift = pose(idle, {
    hips: [-0.04, 0.06, 0], hipsY: 0.620,
    torso: [0.06, 0.08, 0], head: [-0.08, -0.10, 0],
    legL: [0.06, 0.02, -0.04], shinL: [0.38, 0, 0], footL: [0.46, 0, 0.03],
    legR: [0.20, -0.02, 0.04], shinR: [0.52, 0, 0], footR: [0.44, 0, -0.03],
    armL: [-0.58, 0.14, 0.42], foreL: [-0.88, -0.16, 0], handL: [0.18, -0.10, 0],
    armR: [-0.30, -0.12, -0.34], foreR: [-1.12, 0.16, 0], handR: [0.14, 0.06, 0]
  });
  const jTuck = pose(jLift, {
    hips: [0.10, 0.08, 0], hipsY: 0.635,
    torso: [0.22, 0.10, 0.02], head: [-0.20, -0.12, 0],
    legL: [-1.08, 0.04, -0.05], shinL: [1.74, 0, 0], footL: [0.38, 0, 0.04],
    legR: [-0.66, -0.04, 0.05], shinR: [1.82, 0, 0], footR: [0.44, 0, -0.04],
    armL: [-0.42, 0.14, 0.56], foreL: [-0.72, -0.18, 0],
    armR: [-0.26, -0.12, -0.44], foreR: [-1.18, 0.16, 0]
  });
  const jApex = pose(jTuck, {
    torso: [0.18, 0.08, 0.02], head: [-0.16, -0.10, 0],
    legL: [-0.94, 0.04, -0.05], shinL: [1.56, 0, 0],
    legR: [-0.52, -0.04, 0.05], shinR: [1.66, 0, 0]
  });
  const fallReach = pose(jApex, {
    hips: [0.06, 0.12, -0.02], hipsY: 0.530,
    torso: [0.14, 0.12, 0.02], head: [-0.14, -0.20, 0],
    legL: [-0.68, 0.04, 0.06], shinL: [1.06, 0, 0], footL: [-0.24, 0, -0.04],
    legR: [0.12, -0.04, -0.06], shinR: [1.02, 0, 0], footR: [-0.12, 0, 0.04],
    armL: [-0.46, 0.14, 0.52], foreL: [-0.82, -0.16, 0],
    armR: [-0.22, -0.10, -0.38], foreR: [-1.22, 0.16, 0]
  });

  // Flame Hover Fly: graceful airborne levitation with gathered legs, poised upright staff, glowing left palm
  const flyLo = pose(idle, {
    hips: [0.06, 0.12, -0.02], hipsY: 0.625,
    torso: [0.18, 0.12, 0.02], head: [-0.16, -0.18, 0],
    legL: [-0.62, 0.04, 0.06], shinL: [1.22, 0, 0], footL: [0.36, 0, -0.03],
    legR: [0.06, -0.04, -0.06], shinR: [1.48, 0, 0], footR: [0.42, 0, 0.03],
    armL: [-0.54, 0.16, 0.44], foreL: [-0.68, -0.18, 0], handL: [0.24, -0.12, 0.06],
    armR: [-0.26, -0.10, -0.32], foreR: [-1.20, 0.16, 0], handR: [0.14, 0.05, -0.05]
  });
  const flyHi = pose(flyLo, {
    hipsY: 0.665,
    torso: [0.14, 0.12, 0.02],
    legL: [-0.52, 0.04, 0.06], shinL: [1.08, 0, 0],
    legR: [0.16, -0.04, -0.06], shinR: [1.34, 0, 0],
    armL: [-0.62, 0.16, 0.52], foreL: [-0.60, -0.18, 0]
  });

  // Compact tucked arcane roll within human ROM
  const rollTuck = pose(idle, {
    hips: [0.10, 0, 0], hipsY: 0.49,
    torso: [0.85, 0, 0], head: [0.44, 0, 0],
    armL: [-0.90, 0.10, 0.24], foreL: [-1.68, -0.14, 0], handL: [0.20, 0, 0],
    armR: [-0.90, -0.10, -0.24], foreR: [-1.68, 0.14, 0], handR: [0.20, 0, 0],
    legL: [-1.62, 0.04, 0.09], shinL: [2.16, 0, 0], footL: [0.34, 0, -0.05],
    legR: [-1.50, -0.04, -0.09], shinR: [2.16, 0, 0], footR: [0.34, 0, 0.05]
  });

  // Arcane ward guard stance: staff angled across body + left palm conjuring flame shield
  const guardPose = pose(idle, mageStance(0.540, 0.10, [0.20, 0.10], [-0.20, 0.10]), {
    hips: [0.10, 0.20, -0.02], torso: [0.12, 0.18, 0.02], head: [-0.14, -0.32, 0],
    armL: [-1.22, 0.30, -0.16], foreL: [-0.72, -0.22, 0], handL: [0.36, -0.12, 0.06],
    armR: [-0.40, -0.18, -0.44], foreR: [-1.32, 0.18, 0], handR: [0.16, 0.06, -0.05]
  });
  const guardBreathe = pose(guardPose, {
    torso: [0.15, 0.17, 0.02],
    armL: [-1.26, 0.30, -0.16]
  });
  const guardHitPose = pose(guardPose, mageStance(0.518, 0.06, [0.22, 0.11], [-0.22, 0.11]), {
    hips: [0.06, 0.22, -0.03], torso: [-0.06, 0.14, 0.04], head: [-0.04, -0.26, 0],
    armL: [-1.04, 0.26, -0.10], foreL: [-0.98, -0.22, 0],
    armR: [-0.38, -0.18, -0.36], foreR: [-1.54, 0.18, 0]
  });

  // Hit recoil & supine knockdown/defeat (hat crown/hair clear floor cleanly)
  const hurtPeak = pose(idle, mageStance(0.545, -0.02, [0.12, 0.09], [-0.18, 0.09]), {
    hips: [-0.02, 0.12, 0.03], torso: [-0.26, -0.12, 0.05], head: [0.16, 0.12, -0.04],
    armL: [-0.36, 0.12, 0.68], foreL: [-0.68, -0.20, 0], handL: [0.18, 0, 0],
    armR: [-0.28, -0.12, -0.68], foreR: [-0.82, 0.20, 0], handR: [0.18, 0, 0]
  });
  const hurtSettle = pose(idle, mageStance(0.556, 0.04, [0.12, 0.07], [-0.14, 0.07]), {
    torso: [0.02, 0.06, 0.02], head: [-0.06, -0.16, 0]
  });
  const kdMid = pose(hurtPeak, {
    hips: [-0.74, 0.05, 0.03], hipsY: 0.42, hipsOffset: [0, 0, -0.06],
    torso: [-0.26, -0.08, 0.04], head: [0.28, 0.06, -0.03],
    armL: [-0.68, 0.12, 0.42], foreL: [-0.88, -0.18, 0],
    armR: [-0.64, -0.12, -0.44], foreR: [-0.88, 0.18, 0],
    legL: [-0.60, 0.04, 0.06], shinL: [0.94, 0, 0], footL: [0.22, 0, 0],
    legR: [-0.28, -0.04, -0.06], shinR: [0.78, 0, 0], footR: [0.24, 0, 0]
  });
  const kdLand = pose(kdMid, {
    hips: [-1.42, 0.03, 0.02], hipsY: 0.325, hipsOffset: [0, 0, -0.06],
    torso: [0.08, -0.03, 0.02], head: [0.30, 0.03, 0],
    armL: [-1.14, 0.12, 0.46], foreL: [-0.78, -0.18, 0],
    armR: [-1.18, -0.12, -0.46], foreR: [-0.82, 0.18, 0],
    legL: [-0.30, 0.04, 0.07], shinL: [0.70, 0, 0], footL: [0.28, 0, 0],
    legR: [-0.14, -0.04, -0.07], shinR: [0.58, 0, 0], footR: [0.30, 0, 0]
  });
  const kdBounce = pose(kdLand, { hipsY: 0.365, torso: [0.02, -0.02, 0.02] });

  return {
    idle: makeClip('idle', [[0, idle], [0.95, breathe], [1.90, idle]]),
    walk: buildWalk(),
    run: buildSprint('run', 0.25, { groundSpeed: 6.0, stance: 0.22 }, 0.36),
    dash: buildSprint('dash', 0.23, null, 0.48),
    jump: makeClip('jump', [[0, jLift], [0.045, jLift, 'lin'], [0.15, jTuck, 'out'], [0.38, jApex, 'io']]),
    fall: makeClip('fall', [[0, jApex], [0.10, pose(jApex, { legL: [-0.82, 0.04, 0.04], shinL: [1.34, 0, 0] }), 'io'], [0.28, fallReach, 'out']]),
    fly: makeClip('fly', [[0, flyLo], [0.45, flyHi, 'io'], [0.90, flyLo, 'io']]),
    roll: makeClip('roll', [[0, idle], [0.05, rollTuck, 'out'], [0.32, rollTuck, 'lin'], [0.46, idle, 'io']]),
    guard: makeClip('guard', [[0, guardPose], [0.65, guardBreathe], [1.30, guardPose]]),
    guardHit: makeClip('guardHit', [[0, guardPose], [0.05, guardHitPose, 'out'], [0.22, guardPose, 'io']]),
    hurt: makeClip('hurt', [[0, idle], [0.05, hurtPeak, 'out'], [0.18, hurtSettle, 'io'], [0.32, idle, 'io']]),
    knockdown: makeClip('knockdown', [[0, hurtPeak], [0.18, kdMid, 'in'], [0.36, kdLand, 'out'], [0.46, kdBounce, 'io'], [0.56, kdLand, 'io']]),
    dead: makeClip('dead', [[0, hurtPeak], [0.26, kdMid, 'in'], [0.54, kdLand, 'out']])
  };
}
