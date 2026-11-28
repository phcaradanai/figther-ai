import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Euler, Quaternion, Vector3 } from 'three';
import { loadChibiViews } from '../tools/rig/load-chibi.mjs';
import { BodyField } from '../tools/rig/body-field.mjs';
import { enforceHeroAnatomy } from '../public/js/three/knight_anatomy.js';
import { applyMotionRigPose } from '../public/dev/motion_rig_ik.js';
import {
  SCHEMA_ID,
  RIG_SPEC_VERSION,
  MOVEMENT_PRESETS,
  RIG_PRESETS,
  sampleRigKeyframes,
  buildExportPayload,
  validateImportPayload
} from '../public/dev/motion_rig_presets.js';
import {
  DASH_PHYSICS,
  DASH_SCENARIO,
  precomputeDashPath,
  ATTACK_SCENARIOS
} from '../public/dev/motion_rig_scenarios.js';

const { ChibiView } = await loadChibiViews();
const D2R = Math.PI / 180;
const gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
const base = { heroId: 'knight', gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };

test('DASH_SCENARIO reproduces server.js Knight dash burst and deceleration stop', () => {
  const frames = precomputeDashPath(1 / 60);
  assert.ok(frames.length >= 80);
  const maxSpeed = Math.max(...frames.map(f => f.speed));
  assert.ok(Math.abs(maxSpeed - DASH_PHYSICS.dashBurst) < 0.05, `peak speed=${maxSpeed}`);

  const dashFrames = frames.filter(f => f.isDashing);
  assert.ok(dashFrames.length >= 20, 'burst window spans 0.36 s');

  const travel = Math.hypot(frames[frames.length - 1].x, frames[frames.length - 1].z);
  assert.ok(travel > 2.8 && travel < 4.0, `dash travel=${travel}`);
  assert.ok(frames[frames.length - 1].speed < 0.15, `end speed=${frames[frames.length - 1].speed}`);
  assert.ok(DASH_SCENARIO.markers.some(m => m.id === 'brake'));
});

test('attack2_clean_r1 eliminates >2cm sword self-collision across all 13 frames while keeping 0.100s contact intact', async (t) => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const field = new BodyField(knight);
  const clipData = JSON.parse(await readFile(new URL('../public/assets/anims/knight/attack2.json', import.meta.url), 'utf8'));
  const action = knight.actions.attack2;

  function measureVariant(keyframes) {
    let badFrames = 0;
    let worstDepth = 0;
    let contactDepth = 0;
    for (const tSec of clipData.times) {
      knight.mixer.stopAllAction();
      action.reset().setEffectiveWeight(1).play();
      action.time = tSec;
      knight.mixer.update(0);

      const sample = sampleRigKeyframes(keyframes, tSec);
      for (const [j, degs] of Object.entries(sample.joints)) {
        knight.R[j].quaternion.multiply(
          new Quaternion().setFromEuler(new Euler(degs[0] * D2R, degs[1] * D2R, degs[2] * D2R, 'XYZ'))
        );
      }
      enforceHeroAnatomy(knight.R, { lockShield: true, clampWristR: true, clampWristL: false, softenKnees: true });
      knight.root.position.set(0, 0, 0);
      knight.root.rotation.set(0, 0, 0);
      knight.root.updateMatrixWorld(true);

      field.build();
      let frameMax = 0;
      for (const pt of field.swordPoints(2)) {
        const hit = field.depth(pt);
        if (hit && hit.depth > frameMax) frameMax = hit.depth;
      }
      if (frameMax > 0.02) badFrames++;
      worstDepth = Math.max(worstDepth, frameMax);
      if (Math.abs(tSec - ATTACK_SCENARIOS.attack2.visualContactAt) < 0.005) {
        contactDepth = frameMax;
      }
    }
    return { badFrames, worstDepth, contactDepth };
  }

  const baseline = measureVariant(RIG_PRESETS.attack2_baseline.keyframes);
  assert.ok(baseline.badFrames >= 2, `expected baseline clipping frames >= 2, got ${baseline.badFrames}`);
  assert.ok(baseline.worstDepth >= 0.05, `expected baseline worst depth >= 5cm, got ${(baseline.worstDepth * 100).toFixed(1)}cm`);

  const fixed = measureVariant(RIG_PRESETS.attack2_clean_r1.keyframes);
  assert.equal(fixed.badFrames, 0, `expected 0 frames > 2cm after fix, got ${fixed.badFrames} (worst=${(fixed.worstDepth * 100).toFixed(1)}cm)`);
  assert.equal(fixed.contactDepth, 0, 'contact frame stays clean');

  const contactSample = sampleRigKeyframes(RIG_PRESETS.attack2_clean_r1.keyframes, ATTACK_SCENARIOS.attack2.visualContactAt);
  assert.deepEqual(contactSample.joints, {}, 'contact frame at 0.100s stays untouched from baseline');
});

test('buildExportPayload & validateImportPayload enforce rig, hero, clip, and joint validation', () => {
  const payload = buildExportPayload({
    mode: 'rig',
    heroId: 'knight',
    clip: 'attack2',
    presetId: 'attack2_clean_r1',
    label: 'Knight attack2 Clean',
    movementParams: MOVEMENT_PRESETS.dash_grounded_r1,
    keyframes: RIG_PRESETS.attack2_clean_r1.keyframes
  });
  assert.equal(payload.schema, SCHEMA_ID);
  assert.equal(payload.rigVersion, RIG_SPEC_VERSION);

  const okRes = validateImportPayload(JSON.stringify(payload), { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(okRes.ok, true, okRes.errors.join('; '));
  assert.equal(okRes.data.keyframes.length, RIG_PRESETS.attack2_clean_r1.keyframes.length);

  const badRig = validateImportPayload({ ...payload, rigVersion: 'ninja-skinned-v1' }, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(badRig.ok, false);
  assert.ok(badRig.errors.some(e => e.includes('rig เวอร์ชัน')));

  const badHero = validateImportPayload({ ...payload, heroId: 'ninja' }, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(badHero.ok, false);
  assert.ok(badHero.errors.some(e => e.includes('ตัวละคร')));

  const badClip = validateImportPayload(payload, { heroId: 'knight', mode: 'rig', clip: 'attack1' });
  assert.equal(badClip.ok, false);
  assert.ok(badClip.errors.some(e => e.includes('attack2') && e.includes('attack1')));

  const badJoint = validateImportPayload({
    ...payload,
    keyframes: [{ t: 0.1, joints: { tailBone99: [1, 2, 3] } }]
  }, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(badJoint.ok, false);
  assert.ok(badJoint.errors.some(e => e.includes('tailBone99')));
});

test('attack2_ik_r2 eliminates >2cm clipping, preserves hilt alignment, and holds locked feet under hip drag', async (t) => {
  const knight = new ChibiView(base);
  t.after(() => knight.dispose());
  const restMount = { pos: knight.R.swordMount.position.clone(), quat: knight.R.swordMount.quaternion.clone() };
  const field = new BodyField(knight);
  const clipData = JSON.parse(await readFile(new URL('../public/assets/anims/knight/attack2.json', import.meta.url), 'utf8'));
  const action = knight.actions.attack2;
  const preset = RIG_PRESETS.attack2_ik_r2;

  let badFrames = 0;
  let worstDepth = 0;
  const handMountDists = [];
  const lockedFootLPositions = [];

  for (const tSec of clipData.times) {
    knight.mixer.stopAllAction();
    action.reset().setEffectiveWeight(1).play();
    action.time = tSec;
    knight.mixer.update(0);
    knight.root.position.set(0, 0, 0);
    knight.root.rotation.set(0, 0, 0);
    knight.root.updateMatrixWorld(true);

    applyMotionRigPose(knight, restMount, tSec, preset.keyframes, preset.footLocks);
    field.build();
    let frameMax = 0;
    for (const pt of field.swordPoints(2)) {
      const hit = field.depth(pt);
      if (hit && hit.depth > frameMax) frameMax = hit.depth;
    }
    if (frameMax > 0.02) badFrames++;
    worstDepth = Math.max(worstDepth, frameMax);

    const hPos = knight.R.handR.getWorldPosition(new Vector3());
    const mPos = knight.R.swordMount.getWorldPosition(new Vector3());
    handMountDists.push(hPos.distanceTo(mPos));

    if (tSec >= 0.200 && tSec <= 0.400) {
      lockedFootLPositions.push(knight.R.footL.getWorldPosition(new Vector3()));
    }
  }

  assert.equal(badFrames, 0, `expected 0 frames > 2cm on attack2_ik_r2, got ${badFrames} (worst=${(worstDepth * 100).toFixed(1)}cm)`);
  const distSpread = Math.max(...handMountDists) - Math.min(...handMountDists);
  assert.ok(distSpread < 0.001, `hilt shifted relative to handR by ${distSpread.toFixed(4)}m`);

  const lockRef = lockedFootLPositions[0];
  for (const p of lockedFootLPositions) {
    assert.ok(p.distanceTo(lockRef) < 0.005, `locked footL drifted ${p.distanceTo(lockRef).toFixed(4)}m`);
  }

  // Verify foot lock holds even when dragging hipsPos in recovery (t = 0.367s)
  knight.mixer.stopAllAction();
  action.reset().setEffectiveWeight(1).play();
  action.time = 0.367;
  knight.mixer.update(0);
  knight.root.position.set(0, 0, 0);
  knight.root.rotation.set(0, 0, 0);
  knight.root.updateMatrixWorld(true);

  const curHip = knight.R.hips.getWorldPosition(new Vector3());
  const shiftedKfs = preset.keyframes.map(kf => (
    Math.abs(kf.t - 0.367) < 0.005
      ? { ...kf, ik: { ...(kf.ik || {}), hipsPos: [curHip.x - 0.06, curHip.y - 0.07, curHip.z + 0.04] } }
      : kf
  ));
  applyMotionRigPose(knight, restMount, 0.367, shiftedKfs, preset.footLocks);
  const footAfterHipDrag = knight.R.footL.getWorldPosition(new Vector3());
  assert.ok(footAfterHipDrag.distanceTo(lockRef) < 0.005, `footL drifted after hip shift: ${footAfterHipDrag.distanceTo(lockRef).toFixed(4)}m`);
});

test('validateImportPayload supports IK/footLocks round-trip and legacy rotation-only JSON', () => {
  const preset = RIG_PRESETS.attack2_ik_r2;
  const payload = buildExportPayload({
    mode: 'rig',
    heroId: 'knight',
    clip: 'attack2',
    presetId: preset.id,
    label: preset.label,
    keyframes: preset.keyframes,
    footLocks: preset.footLocks
  });

  const okIk = validateImportPayload(JSON.stringify(payload), { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(okIk.ok, true, okIk.errors.join('; '));
  assert.equal(okIk.data.footLocks.length, 2);
  assert.ok(okIk.data.keyframes[0].ik?.bladeTip);

  // Legacy payload with no ik and no footLocks must remain backward-compatible
  const legacy = { ...payload, footLocks: undefined, keyframes: RIG_PRESETS.attack2_clean_r1.keyframes };
  const okLegacy = validateImportPayload(legacy, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(okLegacy.ok, true, okLegacy.errors.join('; '));
  assert.deepEqual(okLegacy.data.footLocks, []);

  // Reject invalid footLock range and unknown IK handle
  const badLock = validateImportPayload({
    ...payload,
    footLocks: [{ foot: 'footL', startT: 0.35, endT: 0.20, pos: [0.1, 0.13, -0.15] }]
  }, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(badLock.ok, false);
  assert.ok(badLock.errors.some(e => e.includes('footLock #0')));

  const badIk = validateImportPayload({
    ...payload,
    keyframes: [{ t: 0.1, joints: {}, ik: { wings: [0, 1, 0] } }]
  }, { heroId: 'knight', mode: 'rig', clip: 'attack2' });
  assert.equal(badIk.ok, false);
  assert.ok(badIk.errors.some(e => e.includes('wings')));
});
