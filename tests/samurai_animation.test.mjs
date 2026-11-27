import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';
import { SAMURAI_STRIKES } from '../public/js/three/samurai_attacks.js';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'samurai', armor: 'samurai', helmet: 'samurai', trinket: 'samurai' };
const base = { heroId: 'samurai', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;
const WALK = 6.6;
const SPRINT = 10.5;

function advance(actor, state, frames) {
  for (let i = 0; i < frames; i++) {
    actor.update({ ...base, ...state }, { dt });
  }
  actor.root.updateMatrixWorld(true);
}

test('skinned Samurai loads her kabuto, katana (with its trail) and back banner, and survives stripped armor', t => {
  const sam = new ChibiView(base);
  const stripped = new ChibiView({ ...base, gear: {} });
  t.after(() => { sam.dispose(); stripped.dispose(); });

  assert.ok(sam.skinnedSamurai && sam.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(stripped.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(sam.R.head.getObjectByName('SamuraiHelmet'), 'kabuto mounted');
  assert.ok(!stripped.R.head.getObjectByName('SamuraiHelmet'));
  assert.ok(sam.R.handR.getObjectByName('SamuraiKatana') && sam.R.swordMount, 'katana in the right fist');
  assert.ok(sam.swordTrail, 'the katana leaves a trail');
  assert.ok(!stripped.R.swordMount && !stripped.root.getObjectByName('SamuraiKatana'));
  assert.ok(sam.root.getObjectByName('SamuraiFlag') && sam.R.extras.capes.length === 1, 'banner rides on her back');
  assert.ok(!stripped.root.getObjectByName('SamuraiFlag'));
  const unarmored = new ChibiView({ ...base, gear: { weapon: 'samurai', armor: 'samurai' } });
  t.after(() => unarmored.dispose());
  assert.ok(unarmored.R.swordMount && !unarmored.R.head.getObjectByName('SamuraiHelmet'));
});

test('Samurai uses separate walk/run gaits and preserves phase across a sprint transition', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  advance(sam, { vz: WALK }, 14);
  assert.equal(sam.currentName, 'walk');
  const walkPhase = sam.current.time / sam.current.getClip().duration;
  advance(sam, { vz: SPRINT, isSprinting: true }, 1);
  assert.equal(sam.currentName, 'run');
  const runPhase = sam.current.time / sam.current.getClip().duration;
  assert.ok(Math.abs(runPhase - walkPhase) < 0.14 || runPhase < 0.14);
});

test('Samurai back banner trails behind her while she sprints instead of leaning over her head', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  const flag = sam.root.getObjectByName('SamuraiFlag');
  const rq = new Quaternion();
  const lean = () => {
    sam.root.updateMatrixWorld(true);
    const foot = flag.localToWorld(new Vector3(0, 0, 0));
    const top = flag.localToWorld(new Vector3(0, 0.9, 0));
    sam.R.torso.getWorldQuaternion(rq).invert();   // measured against her torso, which leans forward in a run
    return top.sub(foot).applyQuaternion(rq).z;   // + is toward her front
  };
  advance(sam, {}, 40);
  assert.ok(lean() <= 0.01, `banner leans forward off her back at rest (${lean().toFixed(3)})`);
  advance(sam, { vz: SPRINT, isSprinting: true }, 40);
  assert.ok(lean() < -0.03, `banner does not trail behind her while sprinting (${lean().toFixed(3)})`);
});

test('Samurai plants the supporting foot cleanly during walk without floor sliding', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  const ankle = new Vector3();
  let lowest = Infinity;
  let highest = -Infinity;
  let samples = 0;
  for (let i = 0; i < 120; i++) {
    advance(sam, { z: i * WALK * dt, vz: WALK }, 1);
    if (i < 25 || sam.currentName !== 'walk') continue;
    const phase = sam.current.time / sam.current.getClip().duration;
    if (phase >= 0.03 && phase <= (sam.current.getClip().userData?.stance || 0.26) - 0.02) {
      sam.R.footL.getWorldPosition(ankle);
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

test('Samurai keeps her air pose until near the floor and compresses harder from higher drops', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  const floorY = () => 0;
  const step = state => sam.update({ ...base, ...state }, { dt, floorY });
  advance(sam, {}, 24);
  for (let i = 0; i < 18; i++) step({ y: 1.2 - i * 0.05, grounded: false, vy: -8 });
  assert.equal(sam.currentName, 'fall');
  for (const y of [0.32, 0.22, 0.14]) {
    step({ y, grounded: true, vy: 0 });
    assert.equal(sam.currentName, 'fall');
  }
  for (const y of [0.05, 0.01, 0]) step({ y, grounded: true, vy: 0 });
  assert.notEqual(sam.currentName, 'fall');

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

test('Samurai restarts the jump animation cleanly across her double jump', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  for (const jumpCount of [1, 2]) {
    advance(sam, { grounded: false, vy: 10, jumpCount }, 1);
    assert.equal(sam.currentName, 'jump');
    assert.ok(sam.current.time <= dt * 1.5, `jump ${jumpCount} did not restart`);
    assert.equal(sam.current.loop, LoopOnce);
    advance(sam, { grounded: false, vy: 6, jumpCount }, 12);
  }
});

test('Samurai strikes, aerial combo, flash-dash air heavy and all 4 skills play clean poses and keep floor contact', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  const point = new Vector3();
  const rest = sam.R.restFootY;
  advance(sam, {}, 30);

  // comboHits is 4: the fourth press is the overhead finisher
  for (const [step, expected] of [[1, 'attack1'], [2, 'attack2'], [4, 'attack3']]) {
    advance(sam, { state: 'attack', comboStep: step }, 8);
    assert.equal(sam.currentName, expected);
    const lifts = [sam.R.footL, sam.R.footR].map(f => f.getWorldPosition(point).y - rest);
    assert.ok(Math.min(...lifts.map(Math.abs)) < 0.03, `${expected} floating (${lifts})`);
    advance(sam, {}, 35);
  }

  advance(sam, { state: 'heavy' }, 10);
  assert.equal(sam.currentName, 'heavy');
  advance(sam, {}, 40);

  const air = { y: 1.8, grounded: false, vy: 2 };
  advance(sam, air, 10);
  advance(sam, { ...air, state: 'attack', comboStep: 1, airStrikes: 1 }, 5);
  assert.equal(sam.currentName, 'airRise');
  advance(sam, { ...air, state: 'attack', comboStep: 2, airStrikes: 2 }, 5);
  assert.equal(sam.currentName, 'airCut');
  advance(sam, { ...air, state: 'attack', comboStep: 3, airStrikes: 3 }, 6);
  assert.equal(sam.currentName, 'airSpike');

  const zone = { mode: 'dash', x: 0, y: 0, z: 3, radius: 2 };
  advance(sam, { y: 1.8, grounded: false, state: 'heavy', airSlam: { ...zone, phase: 'aim' } }, 8);
  assert.equal(sam.currentName, 'slamAim');
  advance(sam, { y: 1.1, z: 1.5, grounded: false, vy: -8, state: 'heavy', airSlam: { ...zone, phase: 'dash' } }, 5);
  assert.equal(sam.currentName, 'slamDive');
  advance(sam, { z: 3, grounded: true, state: 'heavy', airSlam: { ...zone, phase: 'impact' } }, 6);
  assert.equal(sam.currentName, 'slamImpact');
  advance(sam, {}, 40);

  for (const [skillId, clipName] of [
    ['samurai_weapon', 'spin'],
    ['samurai_armor', 'counter'],
    ['samurai_helmet', 'aura'],
    ['samurai_trinket', 'rising']
  ]) {
    advance(sam, { state: 'skill', animSkillId: skillId }, 9);
    assert.equal(sam.currentName, clipName);
    advance(sam, {}, 60);
  }
});

test('Samurai blade: held ahead and up at rest, and every strike cuts through a clear arc in front of her', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  const q = new Quaternion(), rq = new Quaternion(), pos = new Vector3(), rp = new Vector3(), dir = new Vector3();
  const read = () => {
    sam.root.updateMatrixWorld(true);
    sam.R.swordMount.getWorldQuaternion(q);
    sam.R.swordMount.getWorldPosition(pos);
    sam.root.getWorldQuaternion(rq).invert();
    sam.root.getWorldPosition(rp);
    dir.set(0, 0, 1).applyQuaternion(q).applyQuaternion(rq);
    const tip = pos.clone().sub(rp).applyQuaternion(rq).addScaledVector(dir, 0.88);
    return { dir: dir.clone(), tip };
  };
  const at = (name, time) => {
    const act = sam.actions[name];
    sam.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    act.time = time;
    sam.mixer.update(0);
    return read();
  };
  const idle = at('idle', 0);
  assert.ok(idle.dir.z > 0.5 && idle.dir.y > 0.2, `idle blade not held ahead and up (${idle.dir.toArray().map(v => v.toFixed(2))})`);
  assert.ok(idle.tip.z > 0.5, `idle point behind her front (${idle.tip.z.toFixed(2)})`);
  for (const name of ['attack1', 'attack2', 'attack3', 'heavy', 'counter']) {
    const hit = at(name, SAMURAI_STRIKES[name].contact);
    assert.ok(hit.dir.z > 0.25, `${name} contact blade points behind her (${hit.dir.toArray().map(v => v.toFixed(2))})`);
    assert.ok(Math.hypot(hit.tip.x, hit.tip.z) > 0.7, `${name} contact tip too close (${hit.tip.toArray().map(v => v.toFixed(2))})`);
    assert.ok(hit.tip.y > 0.05, `${name} contact tip in the floor (${hit.tip.y.toFixed(2)})`);
    // the blade really swings: wind-up and contact differ by a wide angle
    const pre = at(name, SAMURAI_STRIKES[name].trail[0]);
    const swing = Math.acos(Math.max(-1, Math.min(1, pre.dir.dot(hit.dir)))) * 180 / Math.PI;
    assert.ok(swing > 45, `${name} blade only swings ${swing.toFixed(0)} deg`);
  }
});

test('Samurai trail follows the blade windows of the strike table', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  for (const [name, strike] of Object.entries(SAMURAI_STRIKES)) {
    if (strike.trail) assert.ok(strike.trail[1] > strike.trail[0] && strike.contact >= strike.trail[0], `${name} trail window`);
    assert.ok(name in sam.actions, `${name} clip exists`);
  }
});

test('Samurai clears the floor on death and every one of her clips stays within human joint ranges', t => {
  const sam = new ChibiView(base);
  t.after(() => sam.dispose());
  advance(sam, { state: 'dead' }, 90);
  assert.equal(sam.currentName, 'dead');
  const p = new Vector3();
  let lowest = Infinity;
  sam.root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    if (o.name === 'SamuraiHelmet' || o.name === 'SamuraiKatana' || o.name === 'SamuraiFlag') return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 8) lowest = Math.min(lowest, o.localToWorld(o.getVertexPosition(i, p)).y);
  });
  assert.ok(lowest > -0.04 && lowest < 0.06, `Samurai body lies ${lowest.toFixed(3)} from the floor`);

  // lying down, her arms rest along the body parallel to the floor
  const shoulder = new Vector3(), wrist = new Vector3();
  for (const side of ['L', 'R']) {
    sam.R['arm' + side].getWorldPosition(shoulder);
    sam.R['hand' + side].getWorldPosition(wrist);
    assert.ok(Math.abs(shoulder.y - wrist.y) < 0.12, `${side} arm not flat on the floor (${(wrist.y - shoulder.y).toFixed(2)} rise)`);
  }

  const vHip = new Vector3(), vKnee = new Vector3(), vAnk = new Vector3();
  const vSh = new Vector3(), vElb = new Vector3(), vWr = new Vector3();
  const qInv = new Quaternion(), u = new Vector3(), w = new Vector3(), perp = new Vector3();
  const deg = r => r * 180 / Math.PI;
  const clips = [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'spin', 'counter', 'aura', 'rising',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ];
  for (const name of clips) {
    const act = sam.actions[name];
    const clip = act.getClip();
    const steps = Math.max(12, Math.round(clip.duration * 30));
    sam.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    for (let i = 0; i <= steps; i++) {
      act.time = clip.duration * i / steps;
      sam.mixer.update(0);
      sam.root.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        sam.R['leg' + side].getWorldPosition(vHip);
        sam.R['shin' + side].getWorldPosition(vKnee);
        sam.R['foot' + side].getWorldPosition(vAnk);
        sam.R['leg' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vKnee, vHip).applyQuaternion(qInv).normalize();
        w.subVectors(vAnk, vKnee).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const kneeHyp = perp.z > 0 ? deg(Math.atan2(perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const kneeLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(kneeHyp <= 2.5, `${name} knee${side} hyperextended ${kneeHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(kneeLat <= (name === 'dead' ? 24 : 12), `${name} knee${side} lateral ${kneeLat.toFixed(1)} deg at step ${i}`);

        sam.R['arm' + side].getWorldPosition(vSh);
        sam.R['fore' + side].getWorldPosition(vElb);
        sam.R['hand' + side].getWorldPosition(vWr);
        sam.R['arm' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vElb, vSh).applyQuaternion(qInv).normalize();
        w.subVectors(vWr, vElb).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const elbHyp = perp.z < 0 ? deg(Math.atan2(-perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const elbLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(elbHyp <= 2.5, `${name} elbow${side} hyperextended ${elbHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(elbLat <= 12, `${name} elbow${side} lateral ${elbLat.toFixed(1)} deg at step ${i}`);
      }
      const headAng = deg(2 * Math.acos(Math.min(1, Math.abs(sam.R.head.quaternion.w))));
      assert.ok(headAng <= 75, `${name} head turned ${headAng.toFixed(1)} deg at step ${i}`);
    }
  }
});
