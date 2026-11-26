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

test('Knight catches its weight on a stop and resumes locomotion immediately on new input', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  advance(knight, {}, 30);
  for (let i = 1; i <= 42; i++) advance(knight, { z: i * 7.5 * dt, vz: 7.5, isSprinting: true }, 1);
  const z = 42 * 7.5 * dt;
  assert.equal(knight.currentName, 'run');
  advance(knight, { z }, 8);
  assert.match(knight.currentName, /^brake[LR]$/);
  assert.ok(knight.R.torso.rotation.x < -0.11, 'the torso should visibly lean back during braking');
  advance(knight, { z: z - 5.4 * dt, vz: -5.4, facing: -Math.PI / 2 }, 1);
  assert.equal(knight.currentName, 'walk');
  advance(knight, { z: z - 5.4 * dt }, 40);
  assert.equal(knight.currentName, 'idle');
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

test('Knight cape sways with the stride and turns, lifts while falling and stays behind the body', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const hem = knight.root.getObjectByName('cape3');
  const tip = new Vector3();
  const hips = new Vector3();
  // The Knight faces +Z, so a positive value is distance behind the hips.
  function measure() {
    hem.localToWorld(tip.set(0.003, -0.289, -0.105));
    knight.R.hips.getWorldPosition(hips);
    const local = knight.R.torso.worldToLocal(tip.clone());
    return { behind: hips.z - tip.z, height: tip.y - hips.y, local };
  }
  const range = values => Math.max(...values) - Math.min(...values);
  advance(knight, {}, 60);
  const resting = measure();
  let z = 0;
  let nearest = Infinity;
  let trailing = 0;
  const side = [];
  const lift = [];
  for (let i = 1; i <= 90; i++) {
    z += 7.5 * dt;
    advance(knight, { z, vz: 7.5, isSprinting: true }, 1);
    const { behind, local } = measure();
    nearest = Math.min(nearest, behind);
    if (i <= 45) continue;
    trailing += behind / 45;
    side.push(local.x);
    lift.push(local.y);
  }
  assert.ok(trailing > resting.behind + 0.25, `cape trailed ${trailing.toFixed(3)} vs ${resting.behind.toFixed(3)} at rest`);
  assert.ok(nearest > 0.3, `cape hem came within ${nearest.toFixed(3)} of the hips`);
  // Against the torso, the hem keeps moving through a steady sprint.
  assert.ok(range(side) > 0.12 && range(lift) > 0.15,
    `cape barely moved against the torso: side ${range(side).toFixed(3)}, lift ${range(lift).toFixed(3)}`);

  const turning = [];
  let x = 0;
  for (let i = 1; i <= 20; i++) {
    x += 5.4 * dt;
    advance(knight, { x, z, vx: 5.4, facing: 0 }, 1);
    turning.push(measure().local.x);
  }
  assert.ok(range(turning) > 0.12, `cape did not swing out on a turn: ${range(turning).toFixed(3)}`);

  advance(knight, { x, z, facing: Math.PI / 2 }, 60);
  let falling;
  for (let i = 1; i <= 36; i++) {
    const time = i * dt;
    advance(knight, { z, y: 11.2 * time - 14 * time * time, vy: 11.2 - 28 * time, grounded: false }, 1);
    falling = measure();
    assert.ok(falling.behind > 0.3, `cape hem swung to ${falling.behind.toFixed(3)} in the air`);
  }
  assert.ok(falling.height > resting.height + 0.15, `cape did not lift while falling: ${falling.height.toFixed(3)}`);
  for (const name of ['cape1', 'cape2', 'cape3']) {
    assert.ok(knight.root.getObjectByName(name).matrixWorld.elements.every(Number.isFinite));
  }
});

test('Knight strikes coil high, then finish low with both boots on the floor', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const point = new Vector3();
  const tipHeight = () => knight.R.swordMount.localToWorld(point.set(0, 0, 1.04)).y;
  const ankles = () => [knight.R.footL, knight.R.footR].map(foot => foot.getWorldPosition(point).y);
  advance(knight, {}, 40);
  const standingHips = knight.R.hips.getWorldPosition(point).y;
  const rest = knight.R.restFootY;

  for (const comboStep of [1, 2]) {
    advance(knight, {}, 40);
    advance(knight, { state: 'attack', comboStep }, 4);
    const coiled = tipHeight();
    advance(knight, { state: 'attack', comboStep }, 8);
    assert.equal(knight.currentName, 'attack' + comboStep);
    const hips = knight.R.hips.getWorldPosition(point).y;
    assert.ok(standingHips - hips > 0.08, `attack${comboStep} finished only ${(standingHips - hips).toFixed(3)} below standing`);
    for (const y of ankles()) assert.ok(Math.abs(y - rest) < 0.03, `attack${comboStep} left a boot at ${y.toFixed(3)}`);
    if (comboStep === 1) assert.ok(coiled - tipHeight() > 0.5, 'the cleave should start high and finish low');
  }

  // The finisher leaves the floor on its leap and lands planted.
  advance(knight, {}, 40);
  let highest = 0;
  for (let i = 0; i < 11; i++) {
    advance(knight, { state: 'attack', comboStep: 3 }, 1);
    highest = Math.max(highest, ...ankles());
  }
  assert.ok(highest - rest > 0.08, `the leap only lifted a boot ${(highest - rest).toFixed(3)}`);
  advance(knight, { state: 'attack', comboStep: 3 }, 8);
  for (const y of ankles()) assert.ok(Math.abs(y - rest) < 0.03, `the slam left a boot at ${y.toFixed(3)}`);
});

test('Knight gear skills hit their poses when their effects land', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const point = new Vector3();
  const tip = () => knight.R.swordMount.localToWorld(point.set(0, 0, 1.04)).clone();
  const hilt = () => knight.R.swordMount.localToWorld(point.set(0, 0, 0.16)).clone();
  const hips = () => knight.R.hips.getWorldPosition(point).y;
  const shield = () => knight.R.handL.localToWorld(point.set(0.08, -0.16, 0.02)).clone();
  function cast(skill, frames) {
    advance(knight, {}, 40);
    advance(knight, { state: 'skill', animSkillId: skill }, frames);
  }
  advance(knight, {}, 40);
  const standing = hips();

  // Excalibur Wave: the effect glints on a raised blade, then chops into the floor at 0.085 s.
  cast('knight_weapon', 3);
  assert.equal(knight.currentName, 'sweep');
  assert.ok(tip().y > 2.0, `blade tip at ${tip().y.toFixed(2)} during the glint`);
  advance(knight, { state: 'skill', animSkillId: 'knight_weapon' }, 4);
  assert.ok(tip().y < 0.7 && tip().z > 0.8, `blade tip at ${tip().toArray().map(v => v.toFixed(2))} after the chop`);

  // Aegis Fortress: the ground impact lands at 0.05 s, on one knee behind the shield.
  cast('knight_armor', 4);
  assert.equal(knight.currentName, 'slam');
  assert.ok(standing - hips() > 0.25, `hips only ${(standing - hips()).toFixed(2)} below standing on the plant`);
  assert.ok(shield().y < 0.75 && shield().z > 0.35, `shield at ${shield().toArray().map(v => v.toFixed(2))}`);

  // Lionheart Warcry: the pillar lands by 0.08 s, the sword thrust up into it.
  cast('knight_helmet', 6);
  assert.equal(knight.currentName, 'warcry');
  const up = tip().sub(hilt()).normalize();
  assert.ok(up.y > 0.9, `sword points ${up.toArray().map(v => v.toFixed(2))} during the roar`);

  // Chariot Rush: shield in front from the push-off.
  cast('knight_trinket', 4);
  assert.equal(knight.currentName, 'charge');
  knight.R.torso.getWorldPosition(point);
  const chest = point.z;
  assert.ok(shield().z - chest > 0.3, `shield only ${(shield().z - chest).toFixed(2)} ahead of the chest`);
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
