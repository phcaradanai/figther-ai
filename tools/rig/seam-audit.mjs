// Finds pops where one Knight clip hands over to another: plays scripted input
// through ChibiView at 60 Hz and reports the biggest one-frame bone rotation
// against the typical motion around it. Usage: node tools/rig/seam-audit.mjs [--all]
import { Quaternion } from 'three';
import { loadChibiViews } from './load-chibi.mjs';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
const base = { heroId: 'knight', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;
const BONES = ['torso', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR', 'handL', 'handR'];

// Each scenario is a list of [frames, state] segments.
const SCENARIOS = {
  'idle -> run': [[60, {}], [40, { vx: 7.5, isSprinting: true }]],
  'run -> idle': [[40, { vx: 7.5, isSprinting: true }], [50, {}]],
  'walk -> run': [[40, { vx: 5.4 }], [40, { vx: 7.5, isSprinting: true }]],
  'run -> attack1': [[40, { vx: 7.5, isSprinting: true }], [18, { state: 'attack', comboStep: 1 }], [30, {}]],
  'idle -> attack1 -> 2 -> 3': [[60, {}], [17, { state: 'attack', comboStep: 1 }], [17, { state: 'attack', comboStep: 2 }], [17, { state: 'attack', comboStep: 3 }], [40, {}]],
  'attack3 -> run': [[20, { state: 'attack', comboStep: 3 }], [40, { vx: 5.4 }]],
  'attack1 -> run': [[12, { state: 'attack', comboStep: 1 }], [40, { vx: 5.4 }]],
  'run -> jump -> land': [[40, { vx: 7.5, isSprinting: true }], [40, { vx: 7.5, grounded: false, vy: 8, jumpCount: 1, y: 1 }], [40, { vx: 7.5, grounded: false, vy: -6, jumpCount: 1, y: 2 }], [40, { vx: 7.5, isSprinting: true }]],
  'idle -> jump -> land': [[60, {}], [30, { grounded: false, vy: 8, jumpCount: 1, y: 1 }], [30, { grounded: false, vy: -6, jumpCount: 1, y: 2 }], [40, {}]],
  'jump -> air attack': [[30, { grounded: false, vy: 8, jumpCount: 1, y: 1 }], [17, { grounded: false, vy: 3.8, jumpCount: 1, y: 2, state: 'attack', comboStep: 1, airStrikes: 1 }], [30, { grounded: false, vy: -2, jumpCount: 1, y: 2 }]],
  'idle -> guard -> guard hit': [[60, {}], [30, { guarding: true, state: 'guard' }], [40, { guarding: true, state: 'guard' }], [30, {}]],
  'run -> guard': [[40, { vx: 7.5 }], [30, { guarding: true, state: 'guard' }], [30, {}]],
  'idle -> skill (sweep)': [[60, {}], [40, { state: 'skill', animSkillId: 'knight_weapon' }], [40, {}]],
  'attack -> skill': [[17, { state: 'attack', comboStep: 1 }], [40, { state: 'skill', animSkillId: 'knight_weapon' }], [30, {}]],
  'run -> skill (charge)': [[40, { vx: 7.5 }], [40, { state: 'skill', animSkillId: 'knight_trinket' }], [40, { vx: 7.5 }]],
  'idle -> dodge -> idle': [[60, {}], [24, { guarding: true, state: 'guard', isRolling: true, vx: 10 }], [40, {}]],
  'idle -> hurt -> idle': [[60, {}], [24, { state: 'hurt' }], [40, {}]],
  'hurt -> knockdown -> idle': [[20, { state: 'hurt' }], [50, { state: 'knockdown' }], [40, {}]]
};

// Bone orientation as seen on screen: relative to the character, not to its parent.
const rootInverse = new Quaternion();
function sample(view) {
  const out = {};
  view.root.getWorldQuaternion(rootInverse).invert();
  for (const name of BONES) out[name] = view.R[name].getWorldQuaternion(new Quaternion()).premultiply(rootInverse);
  return out;
}

function audit(name, segments) {
  const view = new ChibiView({ ...base });
  const frames = [];
  const names = [];
  let x = 0;
  for (const [count, state] of segments) {
    for (let i = 0; i < count; i++) {
      const snapshot = { ...base, ...state };
      x += (state.vx || 0) * dt;
      snapshot.x = x;
      view.update(snapshot, { dt });
      view.root.updateMatrixWorld(true);
      frames.push(sample(view));
      names.push(view.currentName);
    }
  }
  // One-frame rotation per bone, then each frame against the median of its neighbours.
  const deltas = frames.map((f, i) => (i === 0 ? null : Object.fromEntries(BONES.map(b => [b, 2 * Math.acos(Math.min(1, Math.abs(f[b].dot(frames[i - 1][b]))))]))));
  const pops = [];
  for (let i = 4; i < frames.length - 3; i++) {
    for (const b of BONES) {
      const around = [-3, -2, -1, 1, 2, 3].map(k => deltas[i + k][b]).sort((p, q) => p - q);
      const typical = (around[2] + around[3]) / 2;
      const jump = deltas[i][b];
      if (jump > 0.22 && jump > typical * 3 + 0.12) pops.push({ frame: i, bone: b, jump, typical, from: names[i - 1], to: names[i] });
    }
  }
  view.dispose();
  return pops;
}

let total = 0;
for (const [name, segments] of Object.entries(SCENARIOS)) {
  const pops = audit(name, segments);
  total += pops.length;
  if (!pops.length) { console.log(`ok    ${name}`); continue; }
  const worst = pops.sort((p, q) => q.jump - p.jump).slice(0, 4);
  console.log(`POP   ${name}`);
  for (const p of worst) console.log(`        frame ${p.frame} ${p.bone} ${p.jump.toFixed(2)} rad (usually ${p.typical.toFixed(2)})  ${p.from} -> ${p.to}`);
}
console.log(total ? `${total} pop(s)` : 'no pops');
