// Author-time helper for one-handed sword poses: finds the arm and wrist angles that point a held blade along a
// wanted direction while the hand stays near a wanted place. Pure math on three.js 'XYZ' Euler angles (no THREE
// import), mirroring the rig: the arm hangs from the torso, the forearm from the arm, the hand from the forearm,
// and the blade runs along the hand's +Z (up once the arm is raised, because the fist is built with the knuckles
// stacked along Z). Results are cached, so building a hero's clips solves each pose once.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Rotation matrix (row-major 3x3) of a three.js 'XYZ' Euler: Rx * Ry * Rz
export function eulerMatrix([x, y, z]) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [
    [c * e, -c * f, d],
    [b * d * e + a * f, -b * d * f + a * e, -b * c],
    [-a * d * e + b * f, a * d * f + b * e, a * c]
  ];
}
export const matMul = (A, B) => A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
export const matVec = (M, v) => [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
export const matTVec = (M, v) => [0, 1, 2].map(j => M[0][j] * v[0] + M[1][j] * v[1] + M[2][j] * v[2]);
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };

// Direction from a yaw (to her left is +) and a pitch (up is +), model frame: +Z ahead
export const dirOf = (yaw, pitch = 0) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

const LO = [-3.3, -0.9, -1.6, -1.0, -0.6, -0.7];
const HI = [1.0, 0.9, 1.4, 1.0, 0.6, 0.7];
const SEEDS = [
  [-0.8, 0, -0.2, 0, 0, 0], [-1.6, 0, -0.5, 0.4, 0, 0], [0.3, 0, -0.8, -0.3, 0, 0],
  [-2.4, 0, -0.3, 0.6, 0, 0], [-1.2, 0.4, 0.2, 0.8, 0, 0], [-0.4, -0.3, -1.0, 0, 0, 0]
];
const cache = new Map();

/**
 * @param geom   { shoulder:[x,y,z], upper, lower, grip:[x,y,z] } in torso space, rig units (right arm: x < 0)
 * @param hips   hips Euler of the pose
 * @param torso  torso Euler of the pose
 * @param dir    wanted blade direction in the model frame (unit or not)
 * @param opts   fore: forearm flex (negative bends the elbow); at: wanted grip position in torso space
 * @returns      { arm, fore, hand, err (degrees), blade (achieved world direction) }
 */
export function solveBlade(geom, hips, torso, dir, { fore = -0.9, at = null, seeds = SEEDS } = {}) {
  const key = JSON.stringify([geom, hips, torso, dir, fore, at]);
  if (cache.has(key)) return cache.get(key);
  const Rb = matMul(eulerMatrix(hips), eulerMatrix(torso));
  const want = norm(dir);
  const Rfore = eulerMatrix([fore, 0, 0]);
  const evaluate = u => {
    const Ra = eulerMatrix([u[0], u[1], u[2]]);
    const Rh = matMul(matMul(Ra, Rfore), eulerMatrix([u[3], u[4], u[5]]));
    const bladeT = matVec(Rh, [0, 0, 1]);
    const blade = matVec(Rb, bladeT);
    const dot = clamp(blade[0] * want[0] + blade[1] * want[1] + blade[2] * want[2], -1, 1);
    let cost = Math.acos(dot) ** 2 + 0.03 * (u[3] ** 2 + u[4] ** 2 + u[5] ** 2) + 0.02 * u[1] ** 2;
    if (at) {
      const upper = matVec(Ra, [0, -geom.upper, 0]);
      const lowerV = matVec(matMul(Ra, Rfore), [0, -geom.lower, 0]);
      const g = matVec(Rh, geom.grip);
      const p = [0, 1, 2].map(i => geom.shoulder[i] + upper[i] + lowerV[i] + g[i]);
      cost += 8 * ((p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2 + (p[2] - at[2]) ** 2);
    }
    return { cost, blade };
  };
  let best = null;
  for (const seed of seeds) {
    let u = seed.slice();
    let c = evaluate(u).cost;
    for (const step of [0.5, 0.3, 0.18, 0.1, 0.05, 0.025, 0.012, 0.006, 0.003]) {
      for (let round = 0; round < 80; round++) {
        let improved = false;
        for (let i = 0; i < 6; i++) for (const d of [step, -step]) {
          const t = u.slice();
          t[i] = clamp(t[i] + d, LO[i], HI[i]);
          const e = evaluate(t).cost;
          if (e < c - 1e-10) { c = e; u = t; improved = true; }
        }
        if (!improved) break;
      }
    }
    if (!best || c < best.c) best = { c, u };
  }
  const { blade } = evaluate(best.u);
  const err = Math.acos(clamp(blade[0] * want[0] + blade[1] * want[1] + blade[2] * want[2], -1, 1)) * 180 / Math.PI;
  const r = v => +v.toFixed(3);
  const out = { arm: best.u.slice(0, 3).map(r), fore: [fore, 0, 0], hand: best.u.slice(3).map(r), err: +err.toFixed(2), blade: blade.map(r) };
  cache.set(key, out);
  return out;
}
