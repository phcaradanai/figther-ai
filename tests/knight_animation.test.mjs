import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';
import { swingFor } from '../public/js/three/knight_holy_vfx.js';

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
    // The boot is pinned from just after its heel strike until its stance (a share of the retimed cycle) ends.
    if (phase >= 0.03 && phase <= knight.current.getClip().userData.stance - 0.02) {
      knight.R.footL.getWorldPosition(ankle);
      lowest = Math.min(lowest, ankle.z);
      highest = Math.max(highest, ankle.z);
      samples++;
    } else if (samples >= 2) break;
    else {
      lowest = Infinity;
      highest = -Infinity;
      samples = 0;
    }
  }
  assert.ok(samples >= 2, 'the left foot entered its support phase');
  const travel = highest - lowest;
  assert.ok(travel < 0.10, `supporting ankle slid ${travel.toFixed(3)} units`);
});

test('Knight stops by fading from its gait into the idle and resumes locomotion immediately on new input', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  advance(knight, {}, 30);
  for (let i = 1; i <= 42; i++) advance(knight, { z: i * 7.5 * dt, vz: 7.5, isSprinting: true }, 1);
  const z = 42 * 7.5 * dt;
  assert.equal(knight.currentName, 'run');
  // The hand-made braking poses popped against the baked clips; a stop is the idle fading in.
  advance(knight, { z }, 8);
  assert.equal(knight.currentName, 'idle');
  assert.ok(knight.actions.run.getEffectiveWeight() > 0, 'the run is still fading out');
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

test('Knight holds a hit until the blade lands, and never swallows it', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const released = [];
  const shown = [];
  const hit = { type: 'hit', damage: 9 };
  assert.equal(knight.holdForContact(hit), false, 'nothing to wait for before a swing');

  knight.queueBladeAccent({ type: 'slash' }, (event, held) => shown.push(...held), held => released.push(...held));
  assert.equal(knight.holdForContact(hit), true);
  advance(knight, { state: 'attack', comboStep: 1 }, 4);
  assert.equal(shown.length, 0, 'still waiting while the blade is in the air');
  advance(knight, { state: 'attack', comboStep: 1 }, 15);
  assert.deepEqual(shown, [hit], 'shown with the contact frame');
  assert.equal(released.length, 0);

  // A swing that never lands hands its hits back when it expires...
  const late = { type: 'hit', damage: 5 };
  knight.queueBladeAccent({ type: 'slash' }, () => {}, held => released.push(...held));
  knight.holdForContact(late);
  advance(knight, {}, 60);
  assert.deepEqual(released, [late]);

  // ...and when a newer swing replaces it.
  const replaced = { type: 'hit', damage: 6 };
  knight.queueBladeAccent({ type: 'slash' }, () => {}, held => released.push(...held));
  knight.holdForContact(replaced);
  knight.queueBladeAccent({ type: 'slash' }, () => {}, () => {});
  assert.deepEqual(released, [late, replaced]);
});

test('a swing that is cut short hands its held hits back at once', t => {
  const parry = { type: 'parry', text: 'JUST GUARD!' };
  for (const state of ['hurt', 'knockdown', 'skill', 'dead']) {
    const knight = new ChibiView(base);
    t.after(() => knight.dispose());
    const released = [];
    advance(knight, {}, 20);
    knight.queueBladeAccent({ type: 'slash' }, () => {}, held => released.push(...held));
    knight.holdForContact(parry);
    advance(knight, { state }, 2);
    assert.deepEqual(released, [parry], `${state} should release within two frames, not at the 0.42 s expiry`);
  }

  // A view that is rebuilt or removed mid-swing releases them too.
  const gone = new ChibiView(base);
  const handed = [];
  gone.queueBladeAccent({ type: 'slash' }, () => {}, held => handed.push(...held));
  gone.holdForContact(parry);
  gone.dispose();
  assert.deepEqual(handed, [parry]);
});

test('a victim keeps its pose until the blade lands, then flinches', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  advance(knight, {}, 30);
  knight.holdReaction(0.3);
  advance(knight, { state: 'hurt' }, 8);
  assert.notEqual(knight.currentName, 'hurt', 'the server flips to hurt before the blade lands');
  knight.holdReaction(0);
  advance(knight, { state: 'hurt' }, 2);
  assert.equal(knight.currentName, 'hurt');

  // The wait never outlives its limit, even if the release is lost.
  const other = new ChibiView(base);
  t.after(() => other.dispose());
  advance(other, {}, 30);
  other.holdReaction(0.1);
  advance(other, { state: 'knockdown' }, 3);
  assert.notEqual(other.currentName, 'knockdown');
  advance(other, { state: 'knockdown' }, 10);
  assert.equal(other.currentName, 'knockdown');
});

test('a Knight impact only goes to hits from the Knight that swung', () => {
  const swings = new Map([['knight1', { at: 1000, x: 2, z: 0, facing: 0, step: 1, fin: false }]]);
  const hit = { x: 3, z: 0.5, attackerId: 'knight1' };
  assert.equal(swingFor(swings, hit, 1200), swings.get('knight1'));
  assert.equal(swingFor(swings, { ...hit, attackerId: 'ninja' }, 1200), null, 'a hit from someone else nearby');
  assert.equal(swingFor(swings, { ...hit, attackerId: undefined }, 1200), null, 'a hit with no attacker');
  assert.equal(swingFor(swings, hit, 1600), null, 'a swing that ended long ago');
  assert.equal(swingFor(swings, { ...hit, x: 9 }, 1200), null, 'a hit far from the swing');
  // A second Knight does not overwrite the first one's swing.
  swings.set('knight2', { at: 1100, x: -4, z: 0, facing: Math.PI, step: 3, fin: true });
  assert.equal(swingFor(swings, hit, 1200).step, 1);
});

test('Knight keeps its ankles under its body through ground and air poses', t => {
  const left = new Vector3();
  const right = new Vector3();
  const sequences = [
    ['idle', {}, 120, 0.40],
    ['walk', { vz: 5.4 }, 64, 0.40],
    ['sprint', { vz: 7.5, isSprinting: true }, 64, 0.41],
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
  assert.ok(trailing > resting.behind + 0.15, `cape trailed ${trailing.toFixed(3)} vs ${resting.behind.toFixed(3)} at rest`);
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
  let highest = -Infinity;
  for (let i = 1; i <= 36; i++) {
    const time = i * dt;
    advance(knight, { z, y: 11.2 * time - 14 * time * time, vy: 11.2 - 28 * time, grounded: false }, 1);
    const falling = measure();
    highest = Math.max(highest, falling.height);
    assert.ok(falling.behind > 0.3, `cape hem swung to ${falling.behind.toFixed(3)} in the air`);
  }
  // The hem rises against the hips as the jump peaks (it settles back as the fall picks up).
  assert.ok(highest > resting.height + 0.05, `cape did not lift in the air: ${highest.toFixed(3)} against ${resting.height.toFixed(3)} at rest`);
  for (const name of ['cape1', 'cape2', 'cape3']) {
    assert.ok(knight.root.getObjectByName(name).matrixWorld.elements.every(Number.isFinite));
  }
});

test('Knight strikes always keep a boot planted and never sink one into the floor', t => {
  const point = new Vector3();
  for (const comboStep of [1, 2, 3]) {
    const knight = new ChibiView(base);
    t.after(() => knight.dispose());
    const rest = knight.R.restFootY;
    advance(knight, {}, 40);
    for (let i = 0; i < 34; i++) {
      advance(knight, { state: 'attack', comboStep }, 1);
      const lifts = [knight.R.footL, knight.R.footR].map(foot => foot.getWorldPosition(point).y - rest);
      assert.equal(knight.currentName, 'attack' + comboStep);
      assert.ok(Math.min(...lifts) > -0.03, `attack${comboStep} sank a boot ${Math.min(...lifts).toFixed(3)} at frame ${i}`);
      if (i >= 4) assert.ok(Math.min(...lifts.map(Math.abs)) < 0.03, `attack${comboStep} had no boot on the floor at frame ${i} (${lifts.map(l => l.toFixed(3))})`);
    }
  }
});

test('Knight air strikes launch, cut and spike with gathered legs and keep their clip through a landing', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const point = new Vector3();
  const air = { y: 1.6, grounded: false, vy: 2 };
  const lowestAnkle = () => Math.min(...[knight.R.footL, knight.R.footR].map(foot => foot.getWorldPosition(point).y)) - air.y;
  advance(knight, {}, 30);
  advance(knight, air, 10);

  advance(knight, { ...air, state: 'attack', comboStep: 1, airStrikes: 1 }, 7);
  assert.equal(knight.currentName, 'airRise');
  assert.ok(lowestAnkle() > 0.25, `boots hang ${lowestAnkle().toFixed(3)} above the feet line in the launcher`);
  advance(knight, { ...air, airStrikes: 1 }, 6);
  advance(knight, { ...air, state: 'attack', comboStep: 2, airStrikes: 2 }, 4);
  assert.equal(knight.currentName, 'airCut');
  advance(knight, { ...air, airStrikes: 2 }, 8);
  advance(knight, { ...air, state: 'attack', comboStep: 3, airStrikes: 3 }, 4);
  assert.equal(knight.currentName, 'airSpike');

  // Landing mid-swing keeps the air strike instead of restarting a ground one.
  advance(knight, { state: 'attack', comboStep: 3 }, 6);
  assert.equal(knight.currentName, 'airSpike');
  advance(knight, {}, 40);
  assert.equal(knight.currentName, 'idle');

  // A new jump starts with the launcher again.
  advance(knight, air, 6);
  advance(knight, { ...air, state: 'attack', comboStep: 1 }, 3);
  assert.equal(knight.currentName, 'airRise');
});

test('Knight air heavy hovers, dives and chops into the floor on landing', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const point = new Vector3();
  const zone = { mode: 'slam', x: 0, y: 0, z: 3, radius: 2.6 };
  advance(knight, {}, 30);
  advance(knight, { y: 1.8, grounded: false, state: 'heavy', airSlam: { ...zone, phase: 'aim' } }, 20);
  assert.equal(knight.currentName, 'slamAim');
  const tip = knight.R.swordMount.localToWorld(point.set(0, 0, 1.04)).y;
  assert.ok(tip > 1.8 + 1.4, `the sword should be cocked overhead, tip at ${tip.toFixed(2)}`);
  advance(knight, { y: 1.0, z: 1.5, grounded: false, vy: -10, state: 'heavy', airSlam: { ...zone, phase: 'dive' } }, 5);
  assert.equal(knight.currentName, 'slamDive');
  advance(knight, { z: 3, state: 'heavy', airSlam: { ...zone, phase: 'impact' } }, 12);
  assert.equal(knight.currentName, 'slamImpact');
  for (const foot of [knight.R.footL, knight.R.footR]) {
    assert.ok(Math.abs(foot.getWorldPosition(point).y - knight.R.restFootY) < 0.03, 'the slam lands planted');
  }
  assert.ok(knight.R.swordMount.localToWorld(point.set(0, 0, 1.04)).y < 0.7, 'the blade should be driven into the floor');
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
  assert.ok(standing - hips() > 0.2, `hips only ${(standing - hips()).toFixed(2)} below standing on the plant`);
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

test('Knight death is the baked fall and comes to rest on top of the floor', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  advance(knight, {}, 20);
  advance(knight, { state: 'dead' }, 150);
  assert.equal(knight.currentName, 'dead');
  assert.ok(knight.current.getClip().duration > 1.5, 'the baked death clip should be loaded');
  const point = new Vector3();
  const hips = knight.R.hips.getWorldPosition(point).y;
  assert.ok(hips < 0.35, `hips rest ${hips.toFixed(2)} above the floor`);
  let lowest = Infinity;
  knight.root.traverse(o => {
    if (!o.isMesh || o.name === 'KnightCape' || !o.geometry?.attributes.position) return;
    const positions = o.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 8) lowest = Math.min(lowest, o.localToWorld(o.getVertexPosition(i, point)).y);
  });
  assert.ok(lowest > -0.04, `the lying Knight sinks ${lowest.toFixed(3)} into the floor`);
});

test('Knight standing extras: turn in place, draw after respawn, guard hit and a long-idle fidget', t => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  advance(knight, {}, 30);
  // Starting to run right after the turn must not flash the turn pose.
  advance(knight, { facing: Math.PI / 2 + 1.6 }, 4);
  assert.equal(knight.currentName, 'idle');
  advance(knight, { facing: Math.PI / 2 + 1.6, vx: 5.4 }, 6);
  assert.notEqual(knight.currentName, 'turnR');
  advance(knight, { facing: Math.PI / 2 + 1.6 }, 30);
  assert.equal(knight.currentName, 'idle');
  // A player who stays put does get the step round.
  advance(knight, { facing: Math.PI / 2 }, 14);
  assert.equal(knight.currentName, 'turnL');
  advance(knight, { facing: Math.PI / 2 }, 60);
  assert.equal(knight.currentName, 'idle');

  advance(knight, { state: 'dead' }, 20);
  advance(knight, {}, 3);
  assert.equal(knight.currentName, 'draw');
  advance(knight, {}, 40);
  assert.equal(knight.currentName, 'idle');

  advance(knight, { guarding: true, state: 'guard' }, 20);
  assert.equal(knight.currentName, 'guard');
  knight.onBlock();
  advance(knight, { guarding: true, state: 'guard' }, 3);
  assert.equal(knight.currentName, 'guardHit');
  advance(knight, { guarding: true, state: 'guard' }, 40);
  assert.equal(knight.currentName, 'guard');

  advance(knight, {}, 60 * 6 + 30);
  assert.equal(knight.currentName, 'idleFidget');
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
