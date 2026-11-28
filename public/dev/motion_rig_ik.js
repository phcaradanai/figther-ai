// ============================================================================
// Motion & Rig Lab — Shared Anatomical IK & Pose Layering Helper
// Pure Three.js ES module (no DOM) shared by Motion Rig Lab, Art Combat Lab,
// and Node verification tests. Strictly dev-lab only.
// ============================================================================
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import {
  HUMAN_ROM,
  enforceHeroAnatomy,
  solveAnatomicalArm,
  solveAnatomicalLeg
} from '../js/three/knight_anatomy.js';
import { sampleRigKeyframes } from './motion_rig_presets.js';

export const BLADE_BASE_LOCAL = [0, 0, 0.16];
export const BLADE_TIP_LOCAL = [0, 0, 1.04];

const D2R = Math.PI / 180;
const RIG_BONES = [
  'hips', 'torso', 'head',
  'armL', 'foreL', 'handL',
  'armR', 'foreR', 'handR',
  'legL', 'shinL', 'footL',
  'legR', 'shinR', 'footR'
];

const _up = new Vector3(0, 1, 0);
const _vGoal = new Vector3();
const _vCur = new Vector3();
const _vBase = new Vector3();
const _vTip = new Vector3();
const _vWant = new Vector3();
const _vDir = new Vector3();
const _vHip = new Vector3();
const _vKnee = new Vector3();
const _qTmp = new Quaternion();
const _qForeWorld = new Quaternion();
const _qShinWorld = new Quaternion();
const _qFootWorld = new Quaternion();
const _qLevel = new Quaternion();
const _eTmp = new Euler();

/**
 * Compute active foot-lock target & weight at time `t`.
 * Inside [startT, endT], weight is strictly 1.0 (zero slide).
 * Outside that window, ramps linearly/smoothly over `fadeSec` so transitions stay pop-free.
 */
export function getActiveFootLock(footLocks = [], footId, t, fadeSec = 0.03) {
  let best = null;
  let bestWeight = 0;
  for (const lk of footLocks || []) {
    if (!lk || lk.foot !== footId || !Array.isArray(lk.pos)) continue;
    let w = 0;
    if (t >= lk.startT - 1e-4 && t <= lk.endT + 1e-4) {
      w = 1;
    } else if (fadeSec > 0) {
      if (t < lk.startT && t >= lk.startT - fadeSec) {
        const u = (t - (lk.startT - fadeSec)) / fadeSec;
        w = u * u * (3 - 2 * u);
      } else if (t > lk.endT && t <= lk.endT + fadeSec) {
        const u = 1 - (t - lk.endT) / fadeSec;
        w = u * u * (3 - 2 * u);
      }
    }
    if (w > bestWeight) {
      bestWeight = w;
      best = lk;
    }
  }
  return best ? { lock: best, weight: bestWeight } : null;
}

/**
 * Aim the sword blade toward `targetTipWorld` without moving `handR` world position,
 * distributing twist naturally across forearm pronation (`foreR.y`) and carpal flexion (`handR`)
 * inside `HUMAN_ROM`.
 */
export function solveBladeAim(R, targetTipWorld, weight = 1) {
  if (weight <= 0.001 || !R?.swordMount || !R?.foreR || !R?.handR) return;
  R.armR.updateMatrixWorld(true);
  _vBase.set(...BLADE_BASE_LOCAL).applyMatrix4(R.swordMount.matrixWorld);
  _vWant.copy(targetTipWorld).sub(_vBase);
  if (_vWant.lengthSq() < 1e-6) return;
  _vWant.normalize();

  const eFore = _eTmp.setFromQuaternion(R.foreR.quaternion, 'XYZ');
  const flexX = eFore.x;
  const startForeY = eFore.y;
  const eHand = new Euler().setFromQuaternion(R.handR.quaternion, 'XYZ');
  const start = [startForeY, eHand.x, eHand.y, eHand.z];
  const val = start.slice();
  const lim = [
    [-HUMAN_ROM.elbowPronationMax, HUMAN_ROM.elbowPronationMax],
    [-HUMAN_ROM.wristXMax, HUMAN_ROM.wristXMax],
    [-HUMAN_ROM.wristYMax, HUMAN_ROM.wristYMax],
    [-HUMAN_ROM.wristZMax, HUMAN_ROM.wristZMax]
  ];

  const apply = () => {
    R.foreR.quaternion.setFromEuler(_eTmp.set(flexX, val[0], 0, 'XYZ'));
    R.handR.quaternion.setFromEuler(_eTmp.set(val[1], val[2], val[3], 'XYZ'));
    R.foreR.updateMatrixWorld(true);
  };
  const cost = () => {
    apply();
    _vBase.set(...BLADE_BASE_LOCAL).applyMatrix4(R.swordMount.matrixWorld);
    _vTip.set(...BLADE_TIP_LOCAL).applyMatrix4(R.swordMount.matrixWorld);
    _vDir.subVectors(_vTip, _vBase);
    if (_vDir.lengthSq() < 1e-8) return 10;
    _vDir.normalize();
    const ang = Math.acos(MathUtils.clamp(_vDir.dot(_vWant), -1, 1));
    const wristStrain = val[1] * val[1] + val[2] * val[2] + val[3] * val[3];
    return ang * ang + wristStrain * 0.03;
  };

  let best = cost();
  for (let step = 0.35; step > 0.006; step *= 0.55) {
    for (let it = 0; it < 16; it++) {
      let imp = false;
      for (let i = 0; i < 4; i++) {
        for (const d of [step, -step]) {
          const old = val[i];
          val[i] = MathUtils.clamp(old + d, lim[i][0], lim[i][1]);
          const c = cost();
          if (c < best - 1e-6) {
            best = c;
            imp = true;
          } else {
            val[i] = old;
          }
        }
      }
      if (!imp) break;
    }
  }

  for (let i = 0; i < 4; i++) {
    val[i] = start[i] + (val[i] - start[i]) * weight;
  }
  apply();
}

function computeLowestSoleY(view) {
  const R = view.R;
  const s = R.rigScale;
  R.footL.updateWorldMatrix(true, false);
  R.footR.updateWorldMatrix(true, false);
  const invBody = R.body.matrixWorld.clone().invert();
  const shoeMat = R.footL.matrixWorld.clone();
  let soleY = Infinity;
  for (const foot of [R.footL, R.footR]) {
    shoeMat.multiplyMatrices(invBody, foot.matrixWorld);
    for (const z of view.soleZ) {
      _vCur.set(0, -R.restFootY / s, z / s).applyMatrix4(shoeMat);
      soleY = Math.min(soleY, _vCur.y);
    }
  }
  return soleY;
}

/**
 * Apply rotational keyframe offsets, IK targets (hipsPos, footL/footR, handL/handR, bladeTip),
 * and frame-range footLocks onto a `ChibiView` already sampled at time `t`.
 */
export function applyMotionRigPose(view, restSwordMount, t, keyframes = [], footLocks = [], opts = {}) {
  const R = view.R;
  if (restSwordMount) {
    R.swordMount.position.copy(restSwordMount.pos);
    R.swordMount.quaternion.copy(restSwordMount.quat);
  }

  const sample = sampleRigKeyframes(keyframes, t);

  // 1. Additive fine rotational offsets
  for (const [jointId, degs] of Object.entries(sample.joints || {})) {
    if (!R[jointId]) continue;
    _qTmp.setFromEuler(_eTmp.set(degs[0] * D2R, degs[1] * D2R, degs[2] * D2R, 'XYZ'));
    R[jointId].quaternion.multiply(_qTmp);
  }

  // 2. Hips height offset / IK hipsPos target
  const hasHipsIk = Boolean(sample.ik?.hipsPos && sample.ik.hipsPos.weight > 0.001);
  if (hasHipsIk && R.hips.parent) {
    _vGoal.set(...sample.ik.hipsPos.pos);
    view.root.localToWorld(_vGoal);
    R.hips.parent.worldToLocal(_vGoal);
    R.hips.position.lerp(_vGoal, sample.ik.hipsPos.weight);
  }
  if (sample.hipsYCm) {
    R.hips.position.y += (sample.hipsYCm / 100) / R.rigScale;
  }

  view.root.updateMatrixWorld(true);

  // 3. Feet IK & Foot Locks (evaluated after hips movement so locked feet remain pinned!)
  let hasFootOverride = false;
  for (const [footId, side, sideSign] of [['footL', 'L', 1], ['footR', 'R', -1]]) {
    const leg = R['leg' + side];
    const shin = R['shin' + side];
    const foot = R['foot' + side];
    if (!leg || !shin || !foot) continue;

    const locked = getActiveFootLock(footLocks, footId, t);
    const ikCh = sample.ik?.[footId];
    const entry = locked
      ? { pos: locked.lock.pos, weight: locked.weight, snapGround: !!locked.lock.snapGround }
      : (ikCh && ikCh.weight > 0.001 ? { pos: ikCh.pos, weight: ikCh.weight, snapGround: false } : null);

    if (!entry) continue;
    hasFootOverride = true;

    _vGoal.set(...entry.pos);
    view.root.localToWorld(_vGoal);
    if (entry.snapGround) {
      _vGoal.y = view.root.position.y + R.restFootY;
    }

    foot.getWorldPosition(_vCur);
    _vGoal.lerpVectors(_vCur, _vGoal, entry.weight);

    const upperLen = shin.position.length() * R.rigScale;
    const lowerLen = foot.position.length() * R.rigScale;
    // Slight hip drop safety if target reaches slightly beyond straight leg
    leg.getWorldPosition(_vHip);
    const maxReach = upperLen + lowerLen - 0.012;
    const dist = _vGoal.distanceTo(_vHip);
    if (dist > maxReach && _vGoal.y <= view.root.position.y + R.restFootY + 0.03) {
      const horiz = Math.hypot(_vGoal.x - _vHip.x, _vGoal.z - _vHip.z);
      const maxDropY = Math.sqrt(Math.max(0, maxReach * maxReach - horiz * horiz));
      const excess = Math.min(0.14, Math.max(0, (_vHip.y - _vGoal.y) - maxDropY));
      if (excess > 0) {
        R.hips.position.y -= excess / R.rigScale;
        view.root.updateMatrixWorld(true);
      }
    }

    shin.getWorldPosition(_vKnee);
    solveAnatomicalLeg(R.hips, leg, shin, foot, _vGoal, upperLen, lowerLen, sideSign, _vKnee);

    // Keep planted boot level on the floor plane while preserving current foot heading
    if (_vGoal.y <= view.root.position.y + R.restFootY + 0.035) {
      R.hips.updateMatrixWorld(true);
      foot.getWorldQuaternion(_qFootWorld);
      _eTmp.setFromQuaternion(_qFootWorld, 'YXZ');
      _qLevel.setFromAxisAngle(_up, _eTmp.y);
      shin.getWorldQuaternion(_qShinWorld);
      _qTmp.copy(_qShinWorld).invert().multiply(_qLevel);
      foot.quaternion.slerp(_qTmp, entry.weight);
    }
  }

  view.root.updateMatrixWorld(true);

  // 4. Arm & Hand IK (handR = -1, handL = +1)
  for (const [handId, side, sideSign] of [['handR', 'R', -1], ['handL', 'L', 1]]) {
    const ikCh = sample.ik?.[handId];
    if (!ikCh || ikCh.weight <= 0.001) continue;
    const arm = R['arm' + side];
    const fore = R['fore' + side];
    const hand = R['hand' + side];
    if (!arm || !fore || !hand) continue;

    hand.getWorldPosition(_vCur);
    _vGoal.set(...ikCh.pos);
    view.root.localToWorld(_vGoal);
    _vGoal.lerpVectors(_vCur, _vGoal, ikCh.weight);
    fore.getWorldQuaternion(_qForeWorld);

    const upperLen = fore.position.length() * R.rigScale;
    const lowerLen = hand.position.length() * R.rigScale;
    solveAnatomicalArm(R.torso, arm, fore, hand, _vGoal, upperLen, lowerLen, sideSign, null, _qForeWorld);
  }

  view.root.updateMatrixWorld(true);

  // 5. Blade Tip Aim (rotates forearm pronation + wrist while keeping handR fixed)
  if (sample.ik?.bladeTip && sample.ik.bladeTip.weight > 0.001) {
    _vGoal.set(...sample.ik.bladeTip.pos);
    view.root.localToWorld(_vGoal);
    solveBladeAim(R, _vGoal, sample.ik.bladeTip.weight);
  }

  // 6. Enforce anatomical ROM & Knight left shield strap
  const hasHandLOverride = Boolean(sample.joints?.handL || sample.ik?.handL);
  enforceHeroAnatomy(R, {
    lockShield: !hasHandLOverride,
    clampWristR: true,
    clampWristL: false,
    softenKnees: true
  });

  view.root.updateMatrixWorld(true);

  // 7. Auto floor-ground lowest sole ONLY when no explicit hips/foot override is active
  if (!opts.skipAutoGround && !hasFootOverride && !hasHipsIk && !sample.hipsYCm) {
    const soleY = computeLowestSoleY(view);
    if (Math.abs(soleY) > 1e-5) {
      R.hips.position.y += -soleY / R.rigScale;
    }
  } else if (hasHipsIk || hasFootOverride) {
    // Only prevent soles sinking below ground plane
    const soleY = computeLowestSoleY(view);
    if (soleY < -0.002) {
      R.hips.position.y += -soleY / R.rigScale;
    }
  }

  // 8. Fine swordMount offsets
  if (sample.swordMountPosCm) {
    R.swordMount.position.x += sample.swordMountPosCm[0] / 100;
    R.swordMount.position.y += sample.swordMountPosCm[1] / 100;
    R.swordMount.position.z += sample.swordMountPosCm[2] / 100;
  }
  if (sample.swordMountRotDeg) {
    _qTmp.setFromEuler(_eTmp.set(
      sample.swordMountRotDeg[0] * D2R,
      sample.swordMountRotDeg[1] * D2R,
      sample.swordMountRotDeg[2] * D2R,
      'XYZ'
    ));
    R.swordMount.quaternion.multiply(_qTmp);
  }

  view.root.updateMatrixWorld(true);
  return sample;
}

export function snapshotRigPose(R) {
  const quats = {};
  for (const name of RIG_BONES) {
    if (R[name]) quats[name] = R[name].quaternion.clone();
  }
  return {
    hipsPos: R.hips.position.clone(),
    quats,
    swordPos: R.swordMount.position.clone(),
    swordQuat: R.swordMount.quaternion.clone()
  };
}

export function restoreRigPose(R, snap) {
  if (!snap) return;
  R.hips.position.copy(snap.hipsPos);
  for (const [name, q] of Object.entries(snap.quats)) {
    if (R[name]) R[name].quaternion.copy(q);
  }
  R.swordMount.position.copy(snap.swordPos);
  R.swordMount.quaternion.copy(snap.swordQuat);
  R.root.updateMatrixWorld(true);
}
