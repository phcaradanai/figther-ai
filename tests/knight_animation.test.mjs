import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { LoopOnce } from 'three';

// Load the actual GLBs in Node while stubbing browser-only image decoding.
const assetOrigin = 'http://knight-animation.test';
const NativeRequest = Request;
const nativeFetch = fetch;
globalThis.Request = class extends NativeRequest {
  constructor(input, options) {
    super(typeof input === 'string' ? new URL(input, assetOrigin) : input, options);
  }
};
globalThis.fetch = async (request, options) => {
  const url = new URL(request instanceof NativeRequest ? request.url : request);
  if (url.protocol === 'blob:') return nativeFetch(request, options);
  assert.equal(url.origin, assetOrigin);
  assert.ok(url.pathname.startsWith('/assets/models/'));
  const bytes = await readFile(new URL('../public' + url.pathname, import.meta.url));
  return new Response(bytes, { headers: { 'Content-Length': bytes.length } });
};
globalThis.self = globalThis;
globalThis.ProgressEvent = Event;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
globalThis.location = new URL(assetOrigin);
globalThis.window = { GAME_DATA: { HEROES: { knight: { speed: 5.4, basicAttack: { comboHits: 3 } } } } };

const { ChibiView } = await import('../public/js/three/chibi.js');
const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
const base = { heroId: 'knight', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;

function advance(actor, state, frames) {
  for (let i = 0; i < frames; i++) {
    actor.update({ ...base, ...state }, { dt });
  }
  actor.root.updateMatrixWorld(true);
}

test('skinned Knight uses separate gaits and preserves gait phase across a sprint', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  assert.ok(knight.root.getObjectByProperty('isSkinnedMesh', true));
  advance(knight, { vx: 5.4 }, 13);
  assert.equal(knight.currentName, 'walk');
  const walkPhase = knight.current.time / knight.current.getClip().duration;
  advance(knight, { vx: 7.5, isSprinting: true }, 1);
  assert.equal(knight.currentName, 'run');
  const runPhase = knight.current.time / knight.current.getClip().duration;
  assert.ok(runPhase >= walkPhase && runPhase - walkPhase < 0.1);
});

test('skinned Knight plays the dodge while guard is held and restarts on a second jump', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());

  advance(knight, { grounded: false, vy: 8, jumpCount: 1 }, 18);
  assert.equal(knight.currentName, 'jump');
  advance(knight, { grounded: false, vy: 8, jumpCount: 2 }, 1);
  assert.ok(knight.current.time <= dt);
  advance(knight, { grounded: false, vy: -3, jumpCount: 2 }, 24);
  assert.equal(knight.currentName, 'fall');
  assert.equal(knight.current.loop, LoopOnce);

  advance(knight, { guarding: true, state: 'guard' }, 12);
  assert.equal(knight.currentName, 'guard');
  advance(knight, { guarding: true, state: 'guard', isRolling: true, vx: 10 }, 8);
  assert.equal(knight.currentName, 'roll');
});

test('Knight attack clips animate the grip and capes stay modular on the real skinned rig', t => {
  const knight = new ChibiView(base);
  const stripped = new ChibiView({ ...base, gear: {} });
  t.after(() => { knight.dispose(); stripped.dispose(); });
  const cape = knight.root.getObjectByName('KnightCape');
  assert.ok(cape.isSkinnedMesh && cape.visible);
  assert.equal(stripped.root.getObjectByName('KnightCape').visible, false);
  assert.ok(stripped.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(knight.R.swordMount);
  assert.ok(!stripped.R.swordMount);

  for (const comboStep of [1, 2, 3]) {
    advance(knight, { state: 'attack', comboStep }, 8);
    assert.equal(knight.currentName, 'attack' + comboStep);
    assert.ok(knight.R.hips.matrixWorld.elements.every(Number.isFinite));
    assert.ok(Math.abs(knight.R.handR.quaternion.w) < 0.99999);
  }
  advance(knight, { state: 'heavy' }, 16);
  assert.equal(knight.currentName, 'heavy');
});
