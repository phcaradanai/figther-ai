// Muzzle report for the skinned Cowgirl: for each shot scheduled in COWBOY_SHOTS, play the clip to that time on the
// real rig and print where each barrel points relative to her facing (yaw: + is to her left, pitch: + is up).
// Usage: node tools/rig/cowboy-aim.mjs [clip ...]
import { Vector3, Quaternion } from 'three';
import { loadChibiViews } from './load-chibi.mjs';
import { COWBOY_SHOTS } from '../../public/js/three/cowboy_attacks.js';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'cowboy', armor: 'cowboy', helmet: 'cowboy', trinket: 'cowboy' };
const base = { heroId: 'cowboy', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const view = new ChibiView(base);
const deg = r => (r * 180 / Math.PI).toFixed(1);
const clips = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COWBOY_SHOTS);
const pos = new Vector3(), dir = new Vector3(), q = new Quaternion(), rootInv = new Quaternion(), rootPos = new Vector3();

export function reading(view, left) {
  view.root.updateMatrixWorld(true);
  view.muzzle(left, pos, dir);
  view.root.getWorldQuaternion(rootInv).invert();
  const d = dir.clone().applyQuaternion(rootInv);
  const p = pos.clone();
  view.root.getWorldPosition(rootPos);
  p.sub(rootPos).applyQuaternion(rootInv);
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), pos: p };
}

for (const name of clips) {
  const act = view.actions[name];
  if (!act) { console.log(name, 'no clip'); continue; }
  const clip = act.getClip();
  view.mixer.stopAllAction();
  act.reset(); act.setEffectiveWeight(1); act.play();
  for (const [t, hand] of COWBOY_SHOTS[name] || [[0.1, 'B']]) {
    act.time = t;
    view.mixer.update(0);
    const out = [];
    for (const left of hand === 'B' ? [false, true] : [hand === 'L']) {
      const r = reading(view, left);
      out.push(`${left ? 'L' : 'R'} yaw ${deg(r.yaw)} pitch ${deg(r.pitch)} tip (${r.pos.x.toFixed(2)}, ${r.pos.y.toFixed(2)}, ${r.pos.z.toFixed(2)})`);
    }
    console.log(`${name} @${t.toFixed(3)}: ${out.join(' | ')}`);
  }
}
view.dispose();
