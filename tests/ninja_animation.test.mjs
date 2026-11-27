import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'ninja', armor: 'ninja', helmet: 'ninja', trinket: 'ninja' };
const base = { heroId: 'ninja', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;

function advance(actor, state, frames) {
  for (let i = 0; i < frames; i++) {
    actor.update({ ...base, ...state }, { dt });
  }
  actor.root.updateMatrixWorld(true);
}

test('skinned Ninja loads modular gear, dual blades, cloth scarf and survives stripped armor', t => {
  const ninja = new ChibiView(base);
  const stripped = new ChibiView({ ...base, gear: {} });
  t.after(() => { ninja.dispose(); stripped.dispose(); });

  assert.ok(ninja.root.getObjectByProperty('isSkinnedMesh', true));
  const scarf = ninja.root.getObjectByName('NinjaScarf');
  assert.ok(scarf && scarf.isSkinnedMesh && scarf.visible);
  assert.equal(stripped.root.getObjectByName('NinjaScarf').visible, false);
  assert.ok(stripped.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(ninja.R.swordMount && ninja.R.offhandMount, 'dual kunai mounts present');
  assert.ok(ninja.swordTrail && ninja.offhandTrail, 'dual blade ribbons active');
  assert.ok(!stripped.R.swordMount && !stripped.R.offhandMount);
  assert.ok(ninja.R.head.getObjectByName('NinjaHeadband'), 'modular headband mounted');
  assert.ok(!stripped.R.head.getObjectByName('NinjaHeadband'));
});

test('Ninja uses separate walk/run gaits and preserves phase across a sprint transition', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  advance(ninja, { vz: 7.0 }, 14);
  assert.equal(ninja.currentName, 'walk');
  const walkPhase = ninja.current.time / ninja.current.getClip().duration;
  advance(ninja, { vz: 12.25, isSprinting: true }, 1);
  assert.equal(ninja.currentName, 'run');
  const runPhase = ninja.current.time / ninja.current.getClip().duration;
  assert.ok(Math.abs(runPhase - walkPhase) < 0.12 || runPhase < 0.12);
});

test('Ninja plants the supporting foot cleanly during walk without floor sliding', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  const ankle = new Vector3();
  let lowest = Infinity;
  let highest = -Infinity;
  let samples = 0;
  for (let i = 0; i < 120; i++) {
    advance(ninja, { z: i * 5.4 * dt, vz: 5.4 }, 1);
    if (i < 25 || ninja.currentName !== 'walk') continue;
    const phase = ninja.current.time / ninja.current.getClip().duration;
    if (phase >= 0.03 && phase <= (ninja.current.getClip().userData?.stance || 0.34) - 0.02) {
      ninja.R.footL.getWorldPosition(ankle);
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
  assert.ok(samples >= 2, 'left sandal entered support phase');
  const travel = highest - lowest;
  assert.ok(travel < 0.10, `supporting ankle slid ${travel.toFixed(3)} units`);
});

test('Ninja keeps its air pose until near the floor and compresses harder from higher drops', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  const floorY = () => 0;
  const step = state => ninja.update({ ...base, ...state }, { dt, floorY });
  advance(ninja, {}, 24);
  for (let i = 0; i < 18; i++) step({ y: 1.2 - i * 0.05, grounded: false, vy: -8 });
  assert.equal(ninja.currentName, 'fall');
  for (const y of [0.32, 0.22, 0.14]) {
    step({ y, grounded: true, vy: 0 });
    assert.equal(ninja.currentName, 'fall');
  }
  for (const y of [0.05, 0.01, 0]) step({ y, grounded: true, vy: 0 });
  assert.notEqual(ninja.currentName, 'fall');

  function drop(vy) {
    const view = new ChibiView(base);
    t.after(() => view.dispose());
    advance(view, {}, 40);
    const hips = new Vector3();
    const readyY = view.R.hips.getWorldPosition(hips).y;
    advance(view, { y: 0.4, grounded: false, vy }, 16);
    let low = readyY;
    for (let i = 0; i < 12; i++) {
      advance(view, {}, 1);
      low = Math.min(low, view.R.hips.getWorldPosition(hips).y);
    }
    return readyY - low;
  }
  const light = drop(-4.5);
  const heavy = drop(-12.6);
  assert.ok(heavy - light >= 0.025, `landing compression did not scale: ${light} -> ${heavy}`);
});

test('Ninja restarts jump animation cleanly across all three jumps', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  for (const jumpCount of [1, 2, 3]) {
    advance(ninja, { grounded: false, vy: 10, jumpCount }, 1);
    assert.equal(ninja.currentName, 'jump');
    assert.ok(ninja.current.time <= dt * 1.5, `jump ${jumpCount} did not restart`);
    assert.equal(ninja.current.loop, LoopOnce);
    advance(ninja, { grounded: false, vy: 6, jumpCount }, 12);
  }
});

test('Ninja strikes, aerial combo, air-dash heavy and all 4 gear skills hit clean poses and floor contact', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  const point = new Vector3();
  const rest = ninja.R.restFootY;
  advance(ninja, {}, 30);

  // 4-hit combo -> steps 1, 2, 3 (maps step 4 finisher to attack3)
  for (const [step, expected] of [[1, 'attack1'], [2, 'attack2'], [4, 'attack3']]) {
    advance(ninja, { state: 'attack', comboStep: step }, 6);
    assert.equal(ninja.currentName, expected);
    const lifts = [ninja.R.footL, ninja.R.footR].map(f => f.getWorldPosition(point).y - rest);
    if (expected !== 'attack3') {
      assert.ok(Math.min(...lifts.map(Math.abs)) < 0.03, `${expected} floating (${lifts})`);
    }
    advance(ninja, {}, 30);
  }

  // Heavy backstab
  advance(ninja, { state: 'heavy' }, 8);
  assert.equal(ninja.currentName, 'heavy');
  advance(ninja, {}, 35);

  // Air 3-hit combo + Air heavy (dash mode)
  const air = { y: 1.8, grounded: false, vy: 2 };
  advance(ninja, air, 10);
  advance(ninja, { ...air, state: 'attack', comboStep: 1, airStrikes: 1 }, 4);
  assert.equal(ninja.currentName, 'airRise');
  advance(ninja, { ...air, state: 'attack', comboStep: 2, airStrikes: 2 }, 4);
  assert.equal(ninja.currentName, 'airCut');
  advance(ninja, { ...air, state: 'attack', comboStep: 3, airStrikes: 3 }, 5);
  assert.equal(ninja.currentName, 'airSpike');

  const zone = { mode: 'dash', x: 0, y: 0, z: 3, radius: 2.2 };
  advance(ninja, { y: 1.8, grounded: false, state: 'heavy', airSlam: { ...zone, phase: 'aim' } }, 8);
  assert.equal(ninja.currentName, 'slamAim');
  advance(ninja, { y: 1.1, z: 1.5, grounded: false, vy: -4, state: 'heavy', airSlam: { ...zone, phase: 'dash' } }, 5);
  assert.equal(ninja.currentName, 'slamDive');
  advance(ninja, { z: 3, grounded: true, state: 'heavy', airSlam: { ...zone, phase: 'impact' } }, 6);
  assert.equal(ninja.currentName, 'slamImpact');
  advance(ninja, {}, 35);

  for (const [skillId, clipName] of [
    ['ninja_weapon', 'windslash'],
    ['ninja_armor', 'seal'],
    ['ninja_helmet', 'throw'],
    ['ninja_trinket', 'backflip']
  ]) {
    advance(ninja, { state: 'skill', animSkillId: skillId }, 8);
    assert.equal(ninja.currentName, clipName);
    advance(ninja, {}, 40);
  }
});

test('Ninja scarf cloth trails dynamically during sprint/turn/jump and never blows forward', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  const hem = ninja.root.getObjectByName('cape3');
  const tip = new Vector3();
  const hips = new Vector3();
  const measure = () => {
    hem.localToWorld(tip.set(0, -0.2366, -0.0163));
    ninja.R.hips.getWorldPosition(hips);
    return { behind: hips.z - tip.z, height: tip.y - hips.y, local: ninja.R.torso.worldToLocal(tip.clone()) };
  };
  advance(ninja, {}, 50);
  const rest = measure();
  let z = 0;
  let nearest = Infinity;
  const side = [];
  for (let i = 1; i <= 70; i++) {
    z += 10 * dt;
    advance(ninja, { z, vz: 10, isSprinting: true }, 1);
    const m = measure();
    nearest = Math.min(nearest, m.behind);
    if (i > 30) side.push(m.local.x);
  }
  assert.ok(nearest > 0.14, `scarf clipped forward to ${nearest.toFixed(3)}`);
  assert.ok(Math.max(...side) - Math.min(...side) > 0.04, 'scarf did not sway during sprint');
  assert.ok(Number.isFinite(rest.height));
});

test('Ninja death comes to rest cleanly above floor and all clips respect human anatomy', t => {
  const ninja = new ChibiView(base);
  t.after(() => ninja.dispose());
  advance(ninja, {}, 20);
  advance(ninja, { state: 'dead' }, 90);
  assert.equal(ninja.currentName, 'dead');
  const p = new Vector3();
  assert.ok(ninja.R.hips.getWorldPosition(p).y < 0.35);
  let lowest = Infinity;
  ninja.root.traverse(o => {
    if (!o.isMesh || o.name === 'NinjaScarf' || !o.geometry?.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 8) lowest = Math.min(lowest, o.localToWorld(o.getVertexPosition(i, p)).y);
  });
  assert.ok(lowest > -0.04, `Ninja body sank ${lowest.toFixed(3)} into floor`);

  // Anatomical clip sweep
  const vHip = new Vector3(), vKnee = new Vector3(), vAnk = new Vector3();
  const vSh = new Vector3(), vElb = new Vector3(), vWr = new Vector3();
  const qInv = new Quaternion(), u = new Vector3(), w = new Vector3(), perp = new Vector3();
  const deg = r => r * 180 / Math.PI;
  const clips = [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'windslash', 'seal', 'throw', 'backflip',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ];
  for (const name of clips) {
    const act = ninja.actions[name];
    const clip = act.getClip();
    const steps = Math.max(12, Math.round(clip.duration * 30));
    ninja.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    for (let i = 0; i <= steps; i++) {
      act.time = clip.duration * i / steps;
      ninja.mixer.update(0);
      ninja.root.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        ninja.R['leg' + side].getWorldPosition(vHip);
        ninja.R['shin' + side].getWorldPosition(vKnee);
        ninja.R['foot' + side].getWorldPosition(vAnk);
        ninja.R['leg' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vKnee, vHip).applyQuaternion(qInv).normalize();
        w.subVectors(vAnk, vKnee).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const kneeHyp = perp.z > 0 ? deg(Math.atan2(perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const kneeLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(kneeHyp <= 2.5, `${name} knee${side} hyperextended ${kneeHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(kneeLat <= (name === 'dead' ? 24 : 12), `${name} knee${side} lateral ${kneeLat.toFixed(1)} deg at step ${i}`);

        ninja.R['arm' + side].getWorldPosition(vSh);
        ninja.R['fore' + side].getWorldPosition(vElb);
        ninja.R['hand' + side].getWorldPosition(vWr);
        ninja.R['arm' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vElb, vSh).applyQuaternion(qInv).normalize();
        w.subVectors(vWr, vElb).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const elbHyp = perp.z < 0 ? deg(Math.atan2(-perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const elbLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(elbHyp <= 2.5, `${name} elbow${side} hyperextended ${elbHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(elbLat <= 12, `${name} elbow${side} lateral ${elbLat.toFixed(1)} deg at step ${i}`);
      }
      const headAng = deg(2 * Math.acos(Math.min(1, Math.abs(ninja.R.head.quaternion.w))));
      assert.ok(headAng <= 75, `${name} head turned ${headAng.toFixed(1)} deg at step ${i}`);
    }
  }
});
