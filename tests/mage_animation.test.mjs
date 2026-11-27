import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'mage', armor: 'mage', helmet: 'mage', trinket: 'mage' };
const base = { heroId: 'mage', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;

function advance(actor, state, frames) {
  for (let i = 0; i < frames; i++) {
    actor.update({ ...base, ...state }, { dt });
  }
  actor.root.updateMatrixWorld(true);
}

test('skinned Fire Archmage loads modular hat, upright staff, orbiting orb and survives stripped armor', t => {
  const mage = new ChibiView(base);
  const stripped = new ChibiView({ ...base, gear: {} });
  t.after(() => { mage.dispose(); stripped.dispose(); });

  assert.ok(mage.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(stripped.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(mage.R.staff && mage.R.swordMount, 'upright MageStaff mount active');
  assert.ok(mage.R.staff.getObjectByName('MageStaff'), 'sculpted MageStaff attached');
  assert.ok(!stripped.R.staff && !stripped.R.swordMount);
  assert.ok(mage.R.head.getObjectByName('MageHat'), 'modular witch hat mounted');
  assert.ok(!stripped.R.head.getObjectByName('MageHat'));
  const orb = mage.root.getObjectByName('orb');
  assert.ok(orb && mage.root.getObjectByName('MageOrb') && mage.R.extras.orbiters.length === 1, 'sculpted fire orbiter active');
  assert.ok(!stripped.root.getObjectByName('MageOrb'));
});

test('Mage uses separate walk/run gaits and preserves phase across a sprint transition', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  advance(mage, { vz: 5.1 }, 14);
  assert.equal(mage.currentName, 'walk');
  const walkPhase = mage.current.time / mage.current.getClip().duration;
  advance(mage, { vz: 8.16, isSprinting: true }, 1);
  assert.equal(mage.currentName, 'run');
  const runPhase = mage.current.time / mage.current.getClip().duration;
  assert.ok(Math.abs(runPhase - walkPhase) < 0.14 || runPhase < 0.14);
});

test('Mage plants the supporting foot cleanly during walk without floor sliding', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  const ankle = new Vector3();
  let lowest = Infinity;
  let highest = -Infinity;
  let samples = 0;
  for (let i = 0; i < 120; i++) {
    advance(mage, { z: i * 5.1 * dt, vz: 5.1 }, 1);
    if (i < 25 || mage.currentName !== 'walk') continue;
    const phase = mage.current.time / mage.current.getClip().duration;
    if (phase >= 0.03 && phase <= (mage.current.getClip().userData?.stance || 0.26) - 0.02) {
      mage.R.footL.getWorldPosition(ankle);
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
  assert.ok(samples >= 2, 'left boot entered support phase');
  const travel = highest - lowest;
  assert.ok(travel < 0.10, `supporting ankle slid ${travel.toFixed(3)} units`);
});

test('Mage keeps its air pose until near the floor and compresses harder from higher drops', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  const floorY = () => 0;
  const step = state => mage.update({ ...base, ...state }, { dt, floorY });
  advance(mage, {}, 24);
  for (let i = 0; i < 18; i++) step({ y: 1.2 - i * 0.05, grounded: false, vy: -8 });
  assert.equal(mage.currentName, 'fall');
  for (const y of [0.32, 0.22, 0.14]) {
    step({ y, grounded: true, vy: 0 });
    assert.equal(mage.currentName, 'fall');
  }
  for (const y of [0.05, 0.01, 0]) step({ y, grounded: true, vy: 0 });
  assert.notEqual(mage.currentName, 'fall');

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
  const heavy = drop(-11.4);
  assert.ok(heavy - light >= 0.025, `landing compression did not scale: ${light} -> ${heavy}`);
});

test('Mage restarts jump animation cleanly across double jump and plays Flame Hover fly', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  for (const jumpCount of [1, 2]) {
    advance(mage, { grounded: false, vy: 10, jumpCount }, 1);
    assert.equal(mage.currentName, 'jump');
    assert.ok(mage.current.time <= dt * 1.5, `jump ${jumpCount} did not restart`);
    assert.equal(mage.current.loop, LoopOnce);
    advance(mage, { grounded: false, vy: 6, jumpCount }, 12);
  }
  advance(mage, { y: 1.8, grounded: false, vy: 0, isFlying: true }, 16);
  assert.equal(mage.currentName, 'fly');
  const orbStart = mage.R.extras.orbiters[0].rotation.y;
  advance(mage, { y: 1.8, grounded: false, vy: 0, isFlying: true }, 20);
  assert.ok(mage.R.extras.orbiters[0].rotation.y > orbStart + 0.3, 'fire orb continues orbiting while hovering');
});

test('Mage strikes, aerial combo, air slam heavy and all 4 skills hit clean poses and floor contact', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  const point = new Vector3();
  const rest = mage.R.restFootY;
  advance(mage, {}, 30);

  for (const [step, expected] of [[1, 'attack1'], [2, 'attack2'], [3, 'attack3']]) {
    advance(mage, { state: 'attack', comboStep: step }, 7);
    assert.equal(mage.currentName, expected);
    const lifts = [mage.R.footL, mage.R.footR].map(f => f.getWorldPosition(point).y - rest);
    assert.ok(Math.min(...lifts.map(Math.abs)) < 0.03, `${expected} floating (${lifts})`);
    advance(mage, {}, 35);
  }

  advance(mage, { state: 'heavy' }, 10);
  assert.equal(mage.currentName, 'heavy');
  advance(mage, {}, 40);

  const air = { y: 1.8, grounded: false, vy: 2 };
  advance(mage, air, 10);
  advance(mage, { ...air, state: 'attack', comboStep: 1, airStrikes: 1 }, 5);
  assert.equal(mage.currentName, 'airRise');
  advance(mage, { ...air, state: 'attack', comboStep: 2, airStrikes: 2 }, 5);
  assert.equal(mage.currentName, 'airCut');
  advance(mage, { ...air, state: 'attack', comboStep: 3, airStrikes: 3 }, 6);
  assert.equal(mage.currentName, 'airSpike');

  const zone = { mode: 'slam', x: 0, y: 0, z: 3, radius: 2.8 };
  advance(mage, { y: 1.8, grounded: false, state: 'heavy', airSlam: { ...zone, phase: 'aim' } }, 8);
  assert.equal(mage.currentName, 'slamAim');
  advance(mage, { y: 1.1, z: 1.5, grounded: false, vy: -8, state: 'heavy', airSlam: { ...zone, phase: 'dive' } }, 5);
  assert.equal(mage.currentName, 'slamDive');
  advance(mage, { z: 3, grounded: true, state: 'heavy', airSlam: { ...zone, phase: 'impact' } }, 6);
  assert.equal(mage.currentName, 'slamImpact');
  advance(mage, {}, 40);

  for (const [skillId, clipName] of [
    ['mage_weapon', 'summon'],
    ['mage_armor', 'nova'],
    ['mage_helmet', 'raise'],
    ['mage_trinket', 'blink']
  ]) {
    advance(mage, { state: 'skill', animSkillId: skillId }, 9);
    assert.equal(mage.currentName, clipName);
    advance(mage, {}, 40);
  }
});

test('Mage keeps staff upright at rest/idle without flipping on spawn and death clears floor cleanly', t => {
  const mage = new ChibiView(base);
  t.after(() => mage.dispose());
  advance(mage, {}, 25);
  const basePt = new Vector3(0, 0, 0);
  const tipPt = new Vector3(0, 0, 0.8);
  mage.R.staff.localToWorld(basePt);
  mage.R.staff.localToWorld(tipPt);
  assert.ok(tipPt.y - basePt.y > 0.65, `staff not upright at idle (${(tipPt.y - basePt.y).toFixed(3)})`);

  advance(mage, { state: 'dead' }, 90);
  assert.equal(mage.currentName, 'dead');
  const p = new Vector3();
  assert.ok(mage.R.hips.getWorldPosition(p).y < 0.42);
  let lowest = Infinity;
  mage.root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    if (o.name === 'MageHat' || o.name === 'MageStaff' || o.name === 'MageOrb') return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 8) lowest = Math.min(lowest, o.localToWorld(o.getVertexPosition(i, p)).y);
  });
  assert.ok(lowest > -0.04, `Mage body sank ${lowest.toFixed(3)} into floor`);

  // Anatomical clip sweep across all 27 clips
  const vHip = new Vector3(), vKnee = new Vector3(), vAnk = new Vector3();
  const vSh = new Vector3(), vElb = new Vector3(), vWr = new Vector3();
  const qInv = new Quaternion(), u = new Vector3(), w = new Vector3(), perp = new Vector3();
  const deg = r => r * 180 / Math.PI;
  const clips = [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'fly', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'summon', 'nova', 'raise', 'blink',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ];
  for (const name of clips) {
    const act = mage.actions[name];
    const clip = act.getClip();
    const steps = Math.max(12, Math.round(clip.duration * 30));
    mage.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    for (let i = 0; i <= steps; i++) {
      act.time = clip.duration * i / steps;
      mage.mixer.update(0);
      mage.root.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        mage.R['leg' + side].getWorldPosition(vHip);
        mage.R['shin' + side].getWorldPosition(vKnee);
        mage.R['foot' + side].getWorldPosition(vAnk);
        mage.R['leg' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vKnee, vHip).applyQuaternion(qInv).normalize();
        w.subVectors(vAnk, vKnee).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const kneeHyp = perp.z > 0 ? deg(Math.atan2(perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const kneeLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(kneeHyp <= 2.5, `${name} knee${side} hyperextended ${kneeHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(kneeLat <= (name === 'dead' ? 24 : 12), `${name} knee${side} lateral ${kneeLat.toFixed(1)} deg at step ${i}`);

        mage.R['arm' + side].getWorldPosition(vSh);
        mage.R['fore' + side].getWorldPosition(vElb);
        mage.R['hand' + side].getWorldPosition(vWr);
        mage.R['arm' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vElb, vSh).applyQuaternion(qInv).normalize();
        w.subVectors(vWr, vElb).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const elbHyp = perp.z < 0 ? deg(Math.atan2(-perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const elbLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(elbHyp <= 2.5, `${name} elbow${side} hyperextended ${elbHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(elbLat <= 12, `${name} elbow${side} lateral ${elbLat.toFixed(1)} deg at step ${i}`);
      }
      const headAng = deg(2 * Math.acos(Math.min(1, Math.abs(mage.R.head.quaternion.w))));
      assert.ok(headAng <= 75, `${name} head turned ${headAng.toFixed(1)} deg at step ${i}`);
    }
  }
});
