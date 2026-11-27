// How far the Knight's sword passes through the Knight's own body, per clip.
//
//   node tools/rig/self-collision.mjs [clip ...]      baked clips (default: all of them)
//
// The body (skinned armour, the helmet, the shield) is skinned to the clip's pose frame by
// frame. Each sampled point of the sword is tested against its nearest body vertices: it is
// inside the body when it lies behind that vertex's surface plane. The arm that holds the
// sword and the cape are left out. Reports the deepest penetration and where it happens.
import { readFile } from 'node:fs/promises';
import { loadChibiViews } from './load-chibi.mjs';
import { poseFrame } from './bake-mixamo.mjs';
import { BodyField } from './body-field.mjs';

export async function measureClip(view, field, data, { every = 1 } = {}) {
  const parts = {};
  let max = 0;
  let frames = 0;
  let worstAt = 0;
  for (let i = 0; i < data.times.length; i += every) {
    poseFrame(view, data, i);
    view.root.updateMatrixWorld(true);
    const hit = field.worst();
    if (hit.depth > 0.02) {
      frames++;
      parts[hit.part] = (parts[hit.part] || 0) + 1;
    }
    if (hit.depth > max) { max = hit.depth; worstAt = data.times[i]; }
  }
  return { frames, of: Math.ceil(data.times.length / every), maxDepth: +max.toFixed(3), at: +worstAt.toFixed(2), parts };
}

if (process.argv[1]?.endsWith('self-collision.mjs')) {
  const { ChibiView } = await loadChibiViews();
  const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
  const view = new ChibiView({ heroId: 'knight', gear, x: 0, y: 0, z: 0, facing: Math.PI / 2, grounded: true });
  const field = new BodyField(view);
  const names = process.argv.slice(2).length ? process.argv.slice(2)
    : ['idle', 'guard', 'walk', 'run', 'attack1', 'attack2', 'attack3', 'jump', 'fall', 'guardHit', 'turnL', 'draw', 'idleFidget', 'dead'];
  for (const name of names) {
    const data = JSON.parse(await readFile(`public/assets/anims/knight/${name}.json`, 'utf8'));
    const r = await measureClip(view, field, data, { every: name === 'idleFidget' ? 6 : 1 });
    console.log(name.padEnd(11), `${String(r.frames).padStart(3)}/${String(r.of).padEnd(3)} frames inside > 2 cm`, `deepest ${(r.maxDepth * 100).toFixed(1)} cm at ${r.at}s`, JSON.stringify(r.parts));
  }
  view.dispose();
}
