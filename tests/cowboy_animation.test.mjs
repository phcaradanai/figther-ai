import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoopOnce, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';
import { COWBOY_SHOTS, COWBOY_STRIKES } from '../public/js/three/cowboy_attacks.js';

const { ChibiView } = await loadChibiViews();
const gear = { weapon: 'cowboy', armor: 'cowboy', helmet: 'cowboy', trinket: 'cowboy' };
const base = { heroId: 'cowboy', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
const dt = 1 / 60;
const WALK = 5.8;
const SPRINT = 9.0;

function advance(actor, state, frames) {
  for (let i = 0; i < frames; i++) {
    actor.update({ ...base, ...state }, { dt });
  }
  actor.root.updateMatrixWorld(true);
}

test('skinned Cowgirl loads her hat and both revolvers with muzzle frames, and survives stripped armor', t => {
  const cow = new ChibiView(base);
  const stripped = new ChibiView({ ...base, gear: {} });
  t.after(() => { cow.dispose(); stripped.dispose(); });

  assert.ok(cow.skinnedCowboy && cow.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(stripped.root.getObjectByProperty('isSkinnedMesh', true));
  assert.ok(cow.R.head.getObjectByName('CowboyHat'), 'sculpted hat mounted');
  assert.ok(!stripped.R.head.getObjectByName('CowboyHat'));
  assert.ok(cow.R.handR.getObjectByName('CowboyGun') && cow.R.handL.getObjectByName('CowboyGun'), 'a revolver in each fist');
  assert.ok(cow.R.muzzleR && cow.R.muzzleL, 'both barrels expose a muzzle frame');
  assert.ok(!stripped.R.muzzleR && !stripped.root.getObjectByName('CowboyGun'));
  // armor stripped but her own weapon kept: the fists still hold the revolvers
  const unarmored = new ChibiView({ ...base, gear: { weapon: 'cowboy', armor: 'cowboy' } });
  t.after(() => unarmored.dispose());
  assert.ok(unarmored.R.muzzleR && !unarmored.R.head.getObjectByName('CowboyHat'));
  // her trinket is a coil of lasso rope on the back of her belt; without it the belt is bare
  assert.ok(cow.root.getObjectByName('lassoCoil'), 'lasso coil on her belt');
  assert.ok(!unarmored.root.getObjectByName('lassoCoil'));
});

test('Cowgirl uses separate walk/run gaits and preserves phase across a sprint transition', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  advance(cow, { vz: WALK }, 14);
  assert.equal(cow.currentName, 'walk');
  const walkPhase = cow.current.time / cow.current.getClip().duration;
  advance(cow, { vz: SPRINT, isSprinting: true }, 1);
  assert.equal(cow.currentName, 'run');
  const runPhase = cow.current.time / cow.current.getClip().duration;
  assert.ok(Math.abs(runPhase - walkPhase) < 0.14 || runPhase < 0.14);
});

test('Cowgirl plants the supporting foot cleanly during walk without floor sliding', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const ankle = new Vector3();
  let lowest = Infinity;
  let highest = -Infinity;
  let samples = 0;
  for (let i = 0; i < 120; i++) {
    advance(cow, { z: i * WALK * dt, vz: WALK }, 1);
    if (i < 25 || cow.currentName !== 'walk') continue;
    const phase = cow.current.time / cow.current.getClip().duration;
    if (phase >= 0.03 && phase <= (cow.current.getClip().userData?.stance || 0.26) - 0.02) {
      cow.R.footL.getWorldPosition(ankle);
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

test('Cowgirl keeps her air pose until near the floor and compresses harder from higher drops', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const floorY = () => 0;
  const step = state => cow.update({ ...base, ...state }, { dt, floorY });
  advance(cow, {}, 24);
  for (let i = 0; i < 18; i++) step({ y: 1.2 - i * 0.05, grounded: false, vy: -8 });
  assert.equal(cow.currentName, 'fall');
  for (const y of [0.32, 0.22, 0.14]) {
    step({ y, grounded: true, vy: 0 });
    assert.equal(cow.currentName, 'fall');
  }
  for (const y of [0.05, 0.01, 0]) step({ y, grounded: true, vy: 0 });
  assert.notEqual(cow.currentName, 'fall');

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

test('Cowgirl restarts the jump animation cleanly across her double jump', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  for (const jumpCount of [1, 2]) {
    advance(cow, { grounded: false, vy: 10, jumpCount }, 1);
    assert.equal(cow.currentName, 'jump');
    assert.ok(cow.current.time <= dt * 1.5, `jump ${jumpCount} did not restart`);
    assert.equal(cow.current.loop, LoopOnce);
    advance(cow, { grounded: false, vy: 6, jumpCount }, 12);
  }
});

test('Cowgirl strikes, aerial combo, air slam heavy and all 4 skills play clean poses and keep floor contact', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const point = new Vector3();
  const rest = cow.R.restFootY;
  advance(cow, {}, 30);

  // comboHits is 4: the fourth press is the kneeling finisher
  for (const [step, expected] of [[1, 'attack1'], [2, 'attack2'], [4, 'attack3']]) {
    advance(cow, { state: 'attack', comboStep: step }, 8);
    assert.equal(cow.currentName, expected);
    const lifts = [cow.R.footL, cow.R.footR].map(f => f.getWorldPosition(point).y - rest);
    assert.ok(Math.min(...lifts.map(Math.abs)) < 0.03, `${expected} floating (${lifts})`);
    advance(cow, {}, 35);
  }

  advance(cow, { state: 'heavy' }, 10);
  assert.equal(cow.currentName, 'heavy');
  advance(cow, {}, 40);

  const air = { y: 1.8, grounded: false, vy: 2 };
  advance(cow, air, 10);
  advance(cow, { ...air, state: 'attack', comboStep: 1, airStrikes: 1 }, 5);
  assert.equal(cow.currentName, 'airRise');
  advance(cow, { ...air, state: 'attack', comboStep: 2, airStrikes: 2 }, 5);
  assert.equal(cow.currentName, 'airCut');
  advance(cow, { ...air, state: 'attack', comboStep: 3, airStrikes: 3 }, 6);
  assert.equal(cow.currentName, 'airSpike');

  const zone = { mode: 'slam', x: 0, y: 0, z: 3, radius: 2.2 };
  advance(cow, { y: 1.8, grounded: false, state: 'heavy', airSlam: { ...zone, phase: 'aim' } }, 8);
  assert.equal(cow.currentName, 'slamAim');
  advance(cow, { y: 1.1, z: 1.5, grounded: false, vy: -8, state: 'heavy', airSlam: { ...zone, phase: 'dive' } }, 5);
  assert.equal(cow.currentName, 'slamDive');
  advance(cow, { z: 3, grounded: true, state: 'heavy', airSlam: { ...zone, phase: 'impact' } }, 6);
  assert.equal(cow.currentName, 'slamImpact');
  advance(cow, {}, 40);

  for (const [skillId, clipName] of [
    ['cowboy_weapon', 'spin'],
    ['cowboy_armor', 'toss'],
    ['cowboy_helmet', 'rollshot'],
    ['cowboy_trinket', 'lasso']
  ]) {
    advance(cow, { state: 'skill', animSkillId: skillId }, 9);
    assert.equal(cow.currentName, clipName);
    advance(cow, {}, 60);
  }
});

test('Cowgirl fires from the real barrels: every scheduled shot leaves both muzzles clear of the body and on target', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const pos = new Vector3();
  const dir = new Vector3();
  const rootInv = new Quaternion();
  const rootPos = new Vector3();
  const deg = r => r * 180 / Math.PI;
  let checked = 0;
  for (const [name, shots] of Object.entries(COWBOY_SHOTS)) {
    const act = cow.actions[name];
    assert.ok(act, `${name} clip exists`);
    cow.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    for (const [time, hand, power = 0] of shots) {
      act.time = time;
      cow.mixer.update(0);
      cow.root.updateMatrixWorld(true);
      cow.root.getWorldQuaternion(rootInv).invert();
      cow.root.getWorldPosition(rootPos);
      for (const left of hand === 'B' ? [false, true] : [hand === 'L']) {
        cow.muzzle(left, pos, dir);
        const local = dir.clone().applyQuaternion(rootInv);
        const tip = pos.clone().sub(rootPos).applyQuaternion(rootInv);
        const yaw = deg(Math.atan2(local.x, local.z));
        const pitch = deg(Math.asin(local.y));
        const where = `${name}@${time} ${left ? 'L' : 'R'}`;
        if (name === 'spin' && power !== 2) {
          assert.ok(Math.abs(Math.abs(yaw) - 90) <= 15 && Math.abs(pitch) <= 15, `${where} should fire out to her ${left ? 'left' : 'right'} (yaw ${yaw.toFixed(1)}, pitch ${pitch.toFixed(1)})`);
          assert.ok(Math.sign(yaw) === (left ? 1 : -1), `${where} fires out of the wrong side`);
        } else {
          assert.ok(Math.abs(yaw) <= 15, `${where} off target by ${yaw.toFixed(1)} deg`);
          if (name === 'spin') assert.ok(pitch < -30, `${where} golden shot should point at the ground (${pitch.toFixed(1)})`);
        }
        // tip outside the torso and in front (or out to the side during the spin)
        assert.ok(Math.hypot(tip.x, tip.z) > 0.45, `${where} muzzle still inside the body (${tip.x.toFixed(2)}, ${tip.z.toFixed(2)})`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 20, `only ${checked} shots checked`);
});

test('Cowgirl muzzle frames drive the shot flashes at the barrel tip', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const flashes = [];
  const fx = { gunShot: (x, y, z, dx, dy, dz, power) => flashes.push({ x, y, z, dx, dy, dz, power }), later() {}, text() {} };
  const act = cow.actions.attack1;
  cow.mixer.stopAllAction();
  advance(cow, { state: 'attack', comboStep: 1 }, 1);
  const env = { dt, fx, floorY: () => 0 };
  for (let i = 0; i < 12; i++) cow.update({ ...base, state: 'attack', comboStep: 1 }, env);
  assert.equal(cow.currentName, 'attack1');
  assert.ok(act);
  assert.equal(flashes.length, 1, 'attack1 fires one shot');
  const origin = new Vector3();
  cow.root.getWorldPosition(origin);
  const f = flashes[0];
  // facing = +PI/2 faces +Z in the world; the flash starts well ahead of her and travels away from her
  assert.ok(f.z - origin.z > 0.45 && f.dz > 0.9, `flash not at the barrel tip: z ${(f.z - origin.z).toFixed(2)}, dz ${f.dz.toFixed(2)}`);
  assert.ok(f.y - origin.y > 0.7 && f.y - origin.y < 1.6, `flash height ${(f.y - origin.y).toFixed(2)}`);
});

test('Cowgirl live shots (anatomy clamps and recoil kick running) stay on target through the finisher and the spin', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  const shots = [];
  const fx = { gunShot: (x, y, z, dx, dy, dz, power) => shots.push({ x, y, z, dx, dy, dz, power }), later() {}, text() {} };
  const env = { dt, fx, floorY: () => 0 };
  const run = (state, frames) => { for (let i = 0; i < frames; i++) cow.update({ ...base, ...state }, env); };
  run({}, 30);
  // facing = PI/2 looks down +Z in the world, so a shot on target has dz close to 1
  run({ state: 'attack', comboStep: 4 }, 24);
  assert.equal(cow.currentName, 'attack3');
  assert.equal(shots.length, 4, 'the finisher fires four shots');
  for (const s of shots) {
    const yaw = Math.abs(Math.atan2(s.dx, s.dz)) * 180 / Math.PI;
    assert.ok(yaw <= 15, `finisher shot off target by ${yaw.toFixed(1)} deg`);
    assert.ok(Math.abs(s.dy) < 0.35, `finisher shot pitched ${s.dy.toFixed(2)}`);
  }
  run({}, 60);
  shots.length = 0;
  run({ state: 'attack', comboStep: 1 }, 14);
  assert.equal(shots.length, 1);
  assert.ok(shots[0].dz > 0.95 && shots[0].z > 0.45, `attack1 flash dz ${shots[0].dz.toFixed(2)} z ${shots[0].z.toFixed(2)}`);
  run({}, 60);
  shots.length = 0;
  run({ state: 'skill', animSkillId: 'cowboy_weapon' }, 60);
  assert.equal(cow.currentName, 'spin');
  assert.equal(shots.length, 14, 'High Noon Barrage fires 12 alternating shots and the golden blast (both guns)');
  assert.ok(shots.some(s => s.power === 2), 'closing blast is the ground shot');
});

test('Cowgirl strike table matches the shot schedule and the server timing', () => {
  for (const [name, shots] of Object.entries(COWBOY_SHOTS)) {
    const strike = COWBOY_STRIKES[name];
    assert.ok(strike, `${name} has a strike entry`);
    assert.ok(Math.abs(strike.contact - shots[0][0]) < 0.02, `${name} contact ${strike.contact} vs first shot ${shots[0][0]}`);
    for (let i = 1; i < shots.length; i++) assert.ok(shots[i][0] > shots[i - 1][0], `${name} shots out of order`);
  }
});

test('Cowgirl clears the floor on death and every one of her clips stays within human joint ranges', t => {
  const cow = new ChibiView(base);
  t.after(() => cow.dispose());
  advance(cow, { state: 'dead' }, 90);
  assert.equal(cow.currentName, 'dead');
  const p = new Vector3();
  let lowest = Infinity;
  cow.root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    if (o.name === 'CowboyHat' || o.name === 'CowboyGun') return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 8) lowest = Math.min(lowest, o.localToWorld(o.getVertexPosition(i, p)).y);
  });
  assert.ok(lowest > -0.04 && lowest < 0.05, `Cowgirl body lies ${lowest.toFixed(3)} from the floor`);

  // lying down, her arms rest along the body parallel to the floor instead of pointing up
  const shoulder = new Vector3(), wrist = new Vector3();
  for (const side of ['L', 'R']) {
    cow.R['arm' + side].getWorldPosition(shoulder);
    cow.R['hand' + side].getWorldPosition(wrist);
    assert.ok(Math.abs(shoulder.y - wrist.y) < 0.12, `${side} arm not flat on the floor (${(wrist.y - shoulder.y).toFixed(2)} rise)`);
    assert.ok(shoulder.distanceTo(wrist) > 0.3, `${side} arm folded up (${shoulder.distanceTo(wrist).toFixed(2)})`);
  }

  const vHip = new Vector3(), vKnee = new Vector3(), vAnk = new Vector3();
  const vSh = new Vector3(), vElb = new Vector3(), vWr = new Vector3();
  const qInv = new Quaternion(), u = new Vector3(), w = new Vector3(), perp = new Vector3();
  const deg = r => r * 180 / Math.PI;
  const clips = [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'spin', 'toss', 'rollshot', 'lasso',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ];
  for (const name of clips) {
    const act = cow.actions[name];
    const clip = act.getClip();
    const steps = Math.max(12, Math.round(clip.duration * 30));
    cow.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    for (let i = 0; i <= steps; i++) {
      act.time = clip.duration * i / steps;
      cow.mixer.update(0);
      cow.root.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        cow.R['leg' + side].getWorldPosition(vHip);
        cow.R['shin' + side].getWorldPosition(vKnee);
        cow.R['foot' + side].getWorldPosition(vAnk);
        cow.R['leg' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vKnee, vHip).applyQuaternion(qInv).normalize();
        w.subVectors(vAnk, vKnee).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const kneeHyp = perp.z > 0 ? deg(Math.atan2(perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const kneeLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(kneeHyp <= 2.5, `${name} knee${side} hyperextended ${kneeHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(kneeLat <= (name === 'dead' ? 24 : 12), `${name} knee${side} lateral ${kneeLat.toFixed(1)} deg at step ${i}`);

        cow.R['arm' + side].getWorldPosition(vSh);
        cow.R['fore' + side].getWorldPosition(vElb);
        cow.R['hand' + side].getWorldPosition(vWr);
        cow.R['arm' + side].getWorldQuaternion(qInv).invert();
        u.subVectors(vElb, vSh).applyQuaternion(qInv).normalize();
        w.subVectors(vWr, vElb).applyQuaternion(qInv).normalize();
        perp.copy(w).addScaledVector(u, -w.dot(u));
        const elbHyp = perp.z < 0 ? deg(Math.atan2(-perp.z, Math.max(1e-4, u.dot(w)))) : 0;
        const elbLat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
        assert.ok(elbHyp <= 2.5, `${name} elbow${side} hyperextended ${elbHyp.toFixed(1)} deg at step ${i}`);
        assert.ok(elbLat <= 12, `${name} elbow${side} lateral ${elbLat.toFixed(1)} deg at step ${i}`);
      }
      const headAng = deg(2 * Math.acos(Math.min(1, Math.abs(cow.R.head.quaternion.w))));
      assert.ok(headAng <= 75, `${name} head turned ${headAng.toFixed(1)} deg at step ${i}`);
    }
  }
});
