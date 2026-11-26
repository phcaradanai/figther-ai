import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';

const { ChibiView } = await loadChibiViews();
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

test('Knight plants the supporting foot while the render root travels forward', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const ankle = new Vector3();
  let lowest = Infinity;
  let highest = -Infinity;
  let samples = 0;
  for (let i = 0; i < 120; i++) {
    advance(knight, { z: i * 5.4 * dt, vz: 5.4 }, 1);
    if (i < 25 || knight.currentName !== 'walk') continue;
    const phase = knight.current.time / knight.current.getClip().duration;
    if (phase >= 0.10 && phase <= 0.28) {
      knight.R.footL.getWorldPosition(ankle);
      lowest = Math.min(lowest, ankle.z);
      highest = Math.max(highest, ankle.z);
      samples++;
    } else if (samples >= 4) break;
    else {
      lowest = Infinity;
      highest = -Infinity;
      samples = 0;
    }
  }
  assert.ok(samples >= 4, 'the left foot entered its support phase');
  const travel = highest - lowest;
  assert.ok(travel < 0.10, `supporting ankle slid ${travel.toFixed(3)} units`);
});

test('Knight compresses more when landing with greater downward speed', t => {
  function drop(vy) {
    const knight = new ChibiView(base);
    t.after(() => knight.dispose());
    advance(knight, {}, 60);
    const hips = new Vector3();
    const readyY = knight.R.hips.getWorldPosition(hips).y;
    advance(knight, { y: 0.4, grounded: false, vy }, 18);
    let lowest = readyY;
    for (let i = 0; i < 12; i++) {
      advance(knight, {}, 1);
      lowest = Math.min(lowest, knight.R.hips.getWorldPosition(hips).y);
    }
    return readyY - lowest;
  }
  const light = drop(-4.5);
  const heavy = drop(-11.2);
  assert.ok(heavy - light >= 0.025, `landing compression did not scale: ${light} → ${heavy}`);
});

test('Knight emits the server swing accent once at visual contact', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const events = [];
  const fx = { type: 'slash', comboStep: 1 };
  knight.queueBladeAccent(fx, event => events.push({ event, time: knight.current.time }));
  advance(knight, { state: 'attack', comboStep: 1 }, 4);
  assert.equal(events.length, 0);
  advance(knight, { state: 'attack', comboStep: 1 }, 15);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, fx);
  assert.ok(events[0].time >= 0.10 && events[0].time <= 0.15);
});

test('Knight keeps its ankles under its body through ground and air poses', t => {
  const left = new Vector3();
  const right = new Vector3();
  const sequences = [
    ['idle', {}, 120, 0.40],
    ['walk', { vz: 5.4 }, 64, 0.40],
    ['sprint', { vz: 7.5, isSprinting: true }, 64, 0.40],
    ['dodge', { vx: 10, isRolling: true }, 24, 0.46],
    ['rise', { grounded: false, vy: 8 }, 28, 0.40],
    ['fall', { grounded: false, vy: -3 }, 28, 0.40]
  ];
  for (const [name, state, frames, limit] of sequences) {
    const knight = new ChibiView(base);
    t.after(() => knight.dispose());
    advance(knight, {}, 30);
    let widest = 0;
    for (let i = 0; i < frames; i++) {
      advance(knight, state, 1);
      knight.root.worldToLocal(knight.R.footL.getWorldPosition(left));
      knight.root.worldToLocal(knight.R.footR.getWorldPosition(right));
      widest = Math.max(widest, Math.abs(left.x - right.x));
    }
    assert.ok(widest <= limit, `${name} ankle spread ${widest.toFixed(3)} exceeded ${limit}`);
  }
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
