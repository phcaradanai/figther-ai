// Blade report for the skinned Samurai: for each strike, play the clip on the real rig to its blade contact (and the
// frames around it) and print where the katana points relative to her facing (yaw: + is to her left, pitch: + is up)
// and where its tip is. Usage: node tools/rig/samurai-blade.mjs [clip ...]
import { Vector3, Quaternion } from 'three';
import { loadChibiViews } from './load-chibi.mjs';
import { SAMURAI_STRIKES } from '../../public/js/three/samurai_attacks.js';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'samurai', armor: 'samurai', helmet: 'samurai', trinket: 'samurai' };
const base = { heroId: 'samurai', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const view = new ChibiView(base);
const deg = r => (r * 180 / Math.PI).toFixed(0);
const clips = process.argv.slice(2).length ? process.argv.slice(2) : ['idle', 'walk', 'run', ...Object.keys(SAMURAI_STRIKES).filter(n => SAMURAI_STRIKES[n].contact)];
const q = new Quaternion(), rq = new Quaternion(), pos = new Vector3(), rp = new Vector3(), dir = new Vector3();

export function blade(view) {
  view.root.updateMatrixWorld(true);
  view.R.swordMount.getWorldQuaternion(q);
  view.R.swordMount.getWorldPosition(pos);
  view.root.getWorldQuaternion(rq).invert();
  view.root.getWorldPosition(rp);
  dir.set(0, 0, 1).applyQuaternion(q).applyQuaternion(rq);
  const tip = pos.clone().sub(rp).applyQuaternion(rq).addScaledVector(dir, 0.88);
  return { yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(dir.y), tip };
}

for (const name of clips) {
  const act = view.actions[name];
  if (!act) { console.log(name, 'no clip'); continue; }
  const strike = SAMURAI_STRIKES[name];
  const times = strike?.contact ? [0.03, strike.contact * 0.6, strike.contact, strike.contact + 0.08] : [0.0, 0.15, act.getClip().duration];
  view.mixer.stopAllAction();
  act.reset(); act.setEffectiveWeight(1); act.play();
  const out = [];
  for (const t of times) {
    act.time = Math.min(t, act.getClip().duration);
    view.mixer.update(0);
    const b = blade(view);
    out.push(`@${t.toFixed(3)} yaw ${deg(b.yaw)} pitch ${deg(b.pitch)} tip (${b.tip.x.toFixed(2)},${b.tip.y.toFixed(2)},${b.tip.z.toFixed(2)})`);
  }
  console.log(name.padEnd(10), out.join(' | '));
}
view.dispose();
