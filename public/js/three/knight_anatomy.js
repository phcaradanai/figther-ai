import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

const { clamp } = MathUtils;

// Left wrist rotation measured from the Mixamo reference model (shield face -Y, crest +Z).
export const SHIELD_HOLD = [-0.0086, 0.0277, 0.6796, 0.7330];
export const SHIELD_HOLD_EULER = [-0.0503, 0.0289, 1.4959];

// Anatomical human joint range-of-motion limits (radians).
export const HUMAN_ROM = {
  kneeFlexMin: 0.04,       // ~2.3 deg (never straight-locked or hyperextended)
  kneeFlexMax: 2.40,       // ~137.5 deg deep squat / tuck
  kneeTwistMax: 0.14,      // ~8 deg passive tibial rotation
  kneeLateralMax: 0.06,    // ~3.4 deg tolerance for runtime crossfades
  elbowFlexMin: 0.04,      // ~2.3 deg (never hyperextended)
  elbowFlexMax: 2.42,      // ~138.6 deg full flexion
  elbowPronationMax: 1.35, // ~77 deg pronation/supination
  neckYawMax: 1.15,        // ~66 deg cervical rotation
  neckPitchMin: -0.72,     // ~-41 deg look up
  neckPitchMax: 0.85,      // ~+49 deg chin tuck
  neckRollMax: 0.48,       // ~27.5 deg ear-to-shoulder tilt
  torsoYawMax: 0.95,       // ~54 deg thoracic/lumbar twist
  torsoPitchMin: -0.58,    // ~-33 deg extension
  torsoPitchMax: 1.05,     // ~+60 deg forward flexion
  torsoRollMax: 0.45,      // ~26 deg lateral bend
  wristXMax: 1.05,
  wristYMax: 0.95,
  wristZMax: 0.62,
  anklePitchMin: -0.75,
  anklePitchMax: 0.95,
  ankleYawMax: 0.45,
  ankleRollMax: 0.35
};

// Reusable scratch objects to keep runtime pose updates allocation-free.
const _hip = new Vector3();
const _knee = new Vector3();
const _ankle = new Vector3();
const _dir = new Vector3();
const _pole = new Vector3();
const _pelvisFwd = new Vector3();
const _hint = new Vector3();
const _kPos = new Vector3();
const _uRest = new Vector3();
const _wRest = new Vector3();
const _uWorld = new Vector3();
const _wWorld = new Vector3();
const _xRest = new Vector3();
const _yRest = new Vector3();
const _zRest = new Vector3();
const _xWorld = new Vector3();
const _yWorld = new Vector3();
const _zWorld = new Vector3();
const _wLocal = new Vector3();
const _cross = new Vector3();
const _fwd = new Vector3(0, 0, 1);
const _up = new Vector3(0, 1, 0);
const _down = new Vector3(0, -1, 0);

const _qHips = new Quaternion();
const _qRest = new Quaternion();
const _qWorld = new Quaternion();
const _qLegWorld = new Quaternion();
const _qShinWorld = new Quaternion();
const _qTorso = new Quaternion();
const _qArm = new Quaternion();
const _qFore = new Quaternion();
const _qHand = new Quaternion();
const _qShield = new Quaternion(...SHIELD_HOLD);
const _qTmp = new Quaternion();
const _mRest = new Matrix4();
const _mWorld = new Matrix4();
const _e = new Euler();

function basisQuaternion(x, y, z, out) {
  _mWorld.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_mWorld);
}

/**
 * Solve a 2-bone human leg (thigh + shin) to place the ankle at `targetWorld`
 * with an anatomical forward knee pole and a pure 1-DOF sagittal knee hinge.
 */
export function solveAnatomicalLeg(hips, leg, shin, foot, targetWorld, upperLen, lowerLen, sideSign = 1, hintKneeWorld = null) {
  leg.getWorldPosition(_hip);
  hips.getWorldQuaternion(_qHips);

  _dir.copy(targetWorld).sub(_hip);
  const reach = upperLen + lowerLen - 0.012;
  const dist = clamp(_dir.length(), 0.12, reach);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, -1, 0);
  else _dir.normalize();

  // Anatomical forward knee pole from pelvis heading, gently tracking slightly outward (~6 deg).
  _pelvisFwd.set(sideSign * 0.10, 0, 1).normalize().applyQuaternion(_qHips);
  _pole.copy(_pelvisFwd).addScaledVector(_dir, -_pelvisFwd.dot(_dir));
  if (_pole.lengthSq() < 1e-6) {
    _pole.set(sideSign * 0.10, 1, 0).normalize().applyQuaternion(_qHips);
    _pole.addScaledVector(_dir, -_pole.dot(_dir));
  }
  _pole.normalize();

  // Optionally blend toward a forward knee hint without ever allowing backward/sideways buckling.
  if (hintKneeWorld) {
    _hint.copy(hintKneeWorld).sub(_hip);
    _hint.addScaledVector(_dir, -_hint.dot(_dir));
    if (_hint.lengthSq() > 1e-6) {
      _hint.normalize();
      if (_hint.dot(_pole) > 0.35) {
        _pole.lerp(_hint, 0.35).normalize();
      }
    }
  }

  // Law of cosines for knee world position.
  const along = clamp((upperLen * upperLen - lowerLen * lowerLen + dist * dist) / (2 * dist), -upperLen + 0.01, upperLen - 0.01);
  const out = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
  _kPos.copy(_hip).addScaledVector(_dir, along).addScaledVector(_pole, out);

  // Rest thigh frame in leg-local space (accounts for skinned Knight's non-vertical rest offset).
  _uRest.copy(shin.position);
  if (_uRest.lengthSq() < 1e-8) _uRest.set(0, -1, 0);
  else _uRest.normalize();
  _yRest.copy(_uRest).negate();
  _zRest.copy(_fwd).addScaledVector(_yRest, -_fwd.dot(_yRest)).normalize();
  _xRest.crossVectors(_yRest, _zRest).normalize();
  basisQuaternion(_xRest, _yRest, _zRest, _qRest);

  // World thigh frame aiming uRest -> (knee - hip) and zRest -> forward knee pole.
  _uWorld.copy(_kPos).sub(_hip).normalize();
  _yWorld.copy(_uWorld).negate();
  _zWorld.copy(_pole).addScaledVector(_yWorld, -_pole.dot(_yWorld)).normalize();
  _xWorld.crossVectors(_yWorld, _zWorld).normalize();
  basisQuaternion(_xWorld, _yWorld, _zWorld, _qWorld);

  // legWorld = qWorld * qRest^-1, legLocal = qHips^-1 * legWorld.
  _qLegWorld.copy(_qWorld).multiply(_qRest.invert());
  leg.quaternion.copy(_qHips).invert().multiply(_qLegWorld);

  // Rest shin vector in shin-local space.
  _wRest.copy(foot.position);
  if (_wRest.lengthSq() < 1e-8) _wRest.set(0, -1, 0);
  else _wRest.normalize();

  // Compute exact 1-DOF sagittal flexion angle between thigh and target shin vector.
  _wWorld.copy(_hip).addScaledVector(_dir, dist).sub(_kPos);
  if (_wWorld.lengthSq() < 1e-8) _wWorld.copy(_uWorld);
  else _wWorld.normalize();

  const cosFlex = clamp(_uWorld.dot(_wWorld), -1, 1);
  const sinFlex = _cross.crossVectors(_uWorld, _wWorld).dot(_xWorld);
  const desiredFlex = clamp(Math.atan2(sinFlex, cosFlex), HUMAN_ROM.kneeFlexMin, HUMAN_ROM.kneeFlexMax);
  const restFlex = Math.atan2(_cross.crossVectors(_uRest, _wRest).dot(_xRest), clamp(_uRest.dot(_wRest), -1, 1));
  shin.quaternion.setFromAxisAngle(_xRest, desiredFlex - restFlex);
}

const _sh = new Vector3();
const _el = new Vector3();
const _wr = new Vector3();
const _armPole = new Vector3();
const _armPerp = new Vector3();
const _armFwd = new Vector3();
const _eArm = new Euler();

/**
 * Solve a 2-bone human arm (upper arm + forearm) to reach `targetWristWorld`
 * with a pure anatomical elbow hinge (Rx(-flex) * Ry(pronation), z = 0).
 */
export function solveAnatomicalArm(torso, arm, fore, hand, targetWristWorld, upperLen, lowerLen, sideSign = 1, elbowPoleWorld = null, desiredForeWorldQ = null) {
  arm.getWorldPosition(_sh);
  torso.getWorldQuaternion(_qTorso);

  _dir.copy(targetWristWorld).sub(_sh);
  const reach = upperLen + lowerLen - 0.008;
  const dist = clamp(_dir.length(), 0.06, reach);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, -1, 0);
  else _dir.normalize();

  // Default anatomical elbow pole: outward and backward relative to torso.
  _armPole.set(sideSign * 0.45, -0.25, -0.85).normalize().applyQuaternion(_qTorso);
  if (elbowPoleWorld) {
    _hint.copy(elbowPoleWorld);
    _hint.addScaledVector(_dir, -_hint.dot(_dir));
    if (_hint.lengthSq() > 1e-6) _armPole.copy(_hint.normalize());
  } else {
    _armPole.addScaledVector(_dir, -_armPole.dot(_dir));
    if (_armPole.lengthSq() < 1e-6) _armPole.set(sideSign, 0, -1).applyQuaternion(_qTorso).addScaledVector(_dir, -_armPole.dot(_dir));
    _armPole.normalize();
  }

  const along = clamp((upperLen * upperLen - lowerLen * lowerLen + dist * dist) / (2 * dist), -upperLen + 0.005, upperLen - 0.005);
  const out = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
  _kPos.copy(_sh).addScaledVector(_dir, along).addScaledVector(_armPole, out);

  // Upper arm points down along (E - S); forearm flexes toward +Z_arm (opposite elbow pole).
  _uWorld.copy(_kPos).sub(_sh).normalize();
  _wWorld.copy(_sh).addScaledVector(_dir, dist).sub(_kPos).normalize();
  const flex = clamp(Math.acos(clamp(_uWorld.dot(_wWorld), -1, 1)), HUMAN_ROM.elbowFlexMin, HUMAN_ROM.elbowFlexMax);

  _armFwd.copy(_wWorld).addScaledVector(_uWorld, -_wWorld.dot(_uWorld));
  if (_armFwd.lengthSq() < 1e-6) _armFwd.copy(_armPole).negate().addScaledVector(_uWorld, -_armPole.dot(_uWorld));
  _armFwd.normalize();

  _yWorld.copy(_uWorld).negate();
  _zWorld.copy(_armFwd);
  _xWorld.crossVectors(_yWorld, _zWorld).normalize();
  basisQuaternion(_xWorld, _yWorld, _zWorld, _qWorld);
  arm.quaternion.copy(_qTorso).invert().multiply(_qWorld);

  // Choose pronation around forearm Y to preserve desired forearm orientation if supplied.
  let pronation = 0;
  if (desiredForeWorldQ) {
    _qTmp.copy(_qWorld).multiply(_qFore.setFromEuler(_eArm.set(-flex, 0, 0, 'XYZ'))).invert().multiply(desiredForeWorldQ);
    _eArm.setFromQuaternion(_qTmp, 'YXZ');
    pronation = clamp(_eArm.y, -HUMAN_ROM.elbowPronationMax, HUMAN_ROM.elbowPronationMax);
  }
  fore.quaternion.setFromEuler(_eArm.set(-flex, pronation, 0, 'XYZ'));
}

/**
 * Clamp/redistribute knight joint rotations at runtime or bake time so knees, elbows,
 * neck, wrists and shield alignment remain strictly within natural human anatomy.
 */
export function enforceKnightAnatomy(R, { lockShield = true, clampWristR = true, softenKnees = true } = {}) {
  // 1. Knees: eliminate hyperextension (x < 0) and sideways buckling (|z| > tol).
  if (softenKnees) {
    for (const side of ['L', 'R']) {
      const shin = R['shin' + side];
      _e.setFromQuaternion(shin.quaternion, 'XYZ');
      const nx = clamp(_e.x, HUMAN_ROM.kneeFlexMin, HUMAN_ROM.kneeFlexMax);
      const ny = clamp(_e.y, -HUMAN_ROM.kneeTwistMax, HUMAN_ROM.kneeTwistMax);
      const nz = clamp(_e.z, -HUMAN_ROM.kneeLateralMax, HUMAN_ROM.kneeLateralMax);
      if (nx !== _e.x || ny !== _e.y || nz !== _e.z) {
        shin.quaternion.setFromEuler(_e.set(nx, ny, nz, 'XYZ'));
      }
    }
  }

  // 2. Elbows: eliminate backward hyperextension (x > -min) and sideways bend (|z| > 0).
  // Transfer any residual lateral roll from crossfades smoothly into the shoulder so
  // the hand trajectory stays coherent instead of clipping.
  for (const side of ['L', 'R']) {
    const arm = R['arm' + side];
    const fore = R['fore' + side];
    _e.setFromQuaternion(fore.quaternion, 'XYZ');
    const clampedX = clamp(_e.x, -HUMAN_ROM.elbowFlexMax, -HUMAN_ROM.elbowFlexMin);
    const clampedY = clamp(_e.y, -HUMAN_ROM.elbowPronationMax, HUMAN_ROM.elbowPronationMax);
    if (_e.x !== clampedX || _e.y !== clampedY || Math.abs(_e.z) > 0.005) {
      if (Math.abs(_e.z) > 0.05) {
        arm.quaternion.multiply(_qTmp.setFromAxisAngle(_fwd, _e.z * 0.45));
      }
      fore.quaternion.setFromEuler(_e.set(clampedX, clampedY, 0, 'XYZ'));
    }
  }

  // 3. Neck & thoracic twist: prevent owl-neck (> 66 deg); share excess rotation with torso.
  _e.setFromQuaternion(R.head.quaternion, 'YXZ');
  if (Math.abs(_e.y) > HUMAN_ROM.neckYawMax || _e.x < HUMAN_ROM.neckPitchMin || _e.x > HUMAN_ROM.neckPitchMax || Math.abs(_e.z) > HUMAN_ROM.neckRollMax) {
    const excessYaw = _e.y - clamp(_e.y, -HUMAN_ROM.neckYawMax, HUMAN_ROM.neckYawMax);
    if (Math.abs(excessYaw) > 1e-4) {
      _eArm.setFromQuaternion(R.torso.quaternion, 'YXZ');
      _eArm.y = clamp(_eArm.y + excessYaw * 0.65, -HUMAN_ROM.torsoYawMax, HUMAN_ROM.torsoYawMax);
      R.torso.quaternion.setFromEuler(_eArm);
    }
    _e.y = clamp(_e.y, -HUMAN_ROM.neckYawMax, HUMAN_ROM.neckYawMax);
    _e.x = clamp(_e.x, HUMAN_ROM.neckPitchMin, HUMAN_ROM.neckPitchMax);
    _e.z = clamp(_e.z, -HUMAN_ROM.neckRollMax, HUMAN_ROM.neckRollMax);
    R.head.quaternion.setFromEuler(_e);
  }

  // 4. Right wrist within human carpal range.
  if (clampWristR && R.handR) {
    _e.setFromQuaternion(R.handR.quaternion, 'XYZ');
    const wx = clamp(_e.x, -HUMAN_ROM.wristXMax, HUMAN_ROM.wristXMax);
    const wy = clamp(_e.y, -HUMAN_ROM.wristYMax, HUMAN_ROM.wristYMax);
    const wz = clamp(_e.z, -HUMAN_ROM.wristZMax, HUMAN_ROM.wristZMax);
    if (wx !== _e.x || wy !== _e.y || wz !== _e.z) {
      R.handR.quaternion.setFromEuler(_e.set(wx, wy, wz, 'XYZ'));
    }
  }

  // 5. Left wrist strapped to shield mount.
  if (lockShield && R.handL) {
    R.handL.quaternion.copy(_qShield);
  }
}
