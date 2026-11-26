import { MathUtils, Quaternion, Vector3 } from 'three';

const { clamp, smoothstep } = MathUtils;
const up = new Vector3(0, 1, 0);
const forward = new Vector3(0, 0, 1);

// Anchor the support boot in world space while the clip drives its swing leg.
// The placement follows the visual root so server tick cadence cannot tug the boot along.
export class KnightFootwork {
  constructor(rig) {
    this.rig = rig;
    this.legs = [
      { thigh: rig.legL, knee: rig.shinL, ankle: rig.footL },
      { thigh: rig.legR, knee: rig.shinR, ankle: rig.footR }
    ].map(leg => ({
      ...leg,
      upper: leg.knee.position.length() * rig.rigScale,
      lower: leg.ankle.position.length() * rig.rigScale,
      contact: new Vector3(),
      planted: false
    }));
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.hip = new Vector3();
    this.knee = new Vector3();
    this.ankle = new Vector3();
    this.target = new Vector3();
    this.direction = new Vector3();
    this.bend = new Vector3();
    this.from = new Vector3();
    this.to = new Vector3();
    this.parentRotation = new Quaternion();
    this.swing = new Quaternion();
    this.speed = 0;
    this.pitch = 0;
    this.bank = 0;
    this.coast = 0;
  }

  track(position, yaw, turn, dt, speed) {
    if (this.ready) {
      this.velocity.copy(position).sub(this.position);
    }
    const moved = this.velocity.length();
    if (moved > 0.85) this.release();
    this.coast = speed > 0.8 ? 0.13 : Math.max(0, this.coast - dt);
    const sampledSpeed = moved <= 0.85 && dt > 0
      ? Math.hypot(this.velocity.x, this.velocity.z) / dt : speed;
    const previous = this.speed;
    const blend = 1 - Math.exp(-dt * 18);
    this.speed += (Math.min(sampledSpeed, speed * 1.35 + 2) - this.speed) * blend;
    const acceleration = dt > 0 ? (this.speed - previous) / dt : 0;
    this.pitch += (clamp(acceleration * 0.012, -0.15, 0.17) - this.pitch) * blend;
    const bank = dt > 0 && speed > 0.8 ? clamp(-turn / dt * 0.019, -0.17, 0.17) : 0;
    this.bank += (bank - this.bank) * blend;
    this.position.copy(position);
    this.yaw = yaw;
    this.ready = true;
  }

  rate(actionName, speed) {
    const nominal = actionName === 'run' ? 7.45 : 5.4;
    const travelSpeed = this.speed * 0.62 + speed * 0.38;
    return clamp(travelSpeed / nominal * 1.09, 0.28, 1.85);
  }

  locomotionSpeed(speed, actionName) {
    const gait = actionName === 'walk' || actionName === 'run';
    return gait && this.coast > 0 ? Math.max(speed, this.speed * 0.72) : speed;
  }

  release() {
    for (const leg of this.legs) leg.planted = false;
  }

  apply(action, grounded, floorY) {
    const name = action.getClip().name;
    const gait = name === 'walk' || name === 'run';
    const { rig } = this;
    if (grounded && (gait || name === 'idle')) {
      rig.torso.rotateX(this.pitch);
      rig.torso.rotateZ(this.bank);
      rig.head.rotateZ(-this.bank * 0.55);
    }
    if (!grounded || !gait) {
      this.release();
      return;
    }

    if (this.speed < 0.35) {
      this.release();
      return;
    }
    const duration = action.getClip().duration;
    const phase = action.time / duration;
    const end = name === 'run' ? 0.34 : 0.41;
    for (const [i, leg] of this.legs.entries()) {
      const progress = (phase + i * 0.5) % 1;
      if (progress >= end || (leg.planted && progress < leg.progress)) {
        leg.planted = false;
      }
      leg.progress = progress;
      if (progress >= end) continue;

      leg.ankle.getWorldPosition(this.ankle);
      if (!leg.planted) {
        leg.planted = true;
        leg.contact.copy(this.ankle);
        leg.yaw = this.yaw;
      }
      const floor = floorY?.(leg.contact.x, leg.contact.z, this.position.y + 0.10);
      const ground = floorY ? floor : this.position.y;
      if (ground == null || Math.abs(ground - this.position.y) > 0.18) continue;

      // Allow the foot to release on sharp direction changes and platform edges.
      const turn = Math.acos(clamp(Math.cos(this.yaw - leg.yaw), -1, 1));
      const sideError = Math.abs((leg.contact.x - this.ankle.x) * Math.cos(this.yaw)
        - (leg.contact.z - this.ankle.z) * Math.sin(this.yaw));
      const weight = smoothstep(progress, 0.01, 0.075)
        * (1 - smoothstep(progress, end - 0.125, end))
        * (1 - smoothstep(turn, 0.30, 0.90))
        * (1 - smoothstep(sideError, 0.075, 0.16))
        * action.getEffectiveWeight();
      if (weight <= 0.001) continue;
      this.target.set(leg.contact.x, ground + rig.restFootY, leg.contact.z).lerp(this.ankle, 1 - weight);
      this.solve(leg, weight);
    }
  }

  solve(leg, weight) {
    const { rig, hip, knee, ankle, direction, bend, target } = this;
    leg.thigh.getWorldPosition(hip);
    const reach = leg.upper + leg.lower - 0.014;
    const horizontal = Math.hypot(target.x - hip.x, target.z - hip.z);
    const height = Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal));
    const drop = clamp(hip.y - target.y - height, 0, 0.14 * weight);
    if (drop > 0) {
      rig.hips.position.y -= drop / rig.rigScale;
      leg.thigh.getWorldPosition(hip);
    }

    leg.knee.getWorldPosition(knee);
    leg.ankle.getWorldPosition(ankle);
    direction.copy(target).sub(hip);
    const distance = clamp(direction.length(), 0.08, reach);
    direction.normalize();
    bend.copy(knee).sub(hip).addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < 0.0001) {
      bend.copy(forward).applyAxisAngle(up, this.yaw);
      bend.addScaledVector(direction, -bend.dot(direction));
    }
    bend.normalize();
    const along = (leg.upper ** 2 - leg.lower ** 2 + distance ** 2) / (2 * distance);
    const out = Math.sqrt(Math.max(0, leg.upper ** 2 - along ** 2));

    this.from.copy(knee).sub(hip);
    this.to.copy(direction).multiplyScalar(along).addScaledVector(bend, out);
    this.aim(leg.thigh);
    leg.knee.getWorldPosition(knee);
    leg.ankle.getWorldPosition(ankle);
    this.from.copy(ankle).sub(knee);
    this.to.copy(hip).addScaledVector(direction, distance).sub(knee);
    this.aim(leg.knee);

    leg.ankle.parent.getWorldQuaternion(this.parentRotation);
    this.swing.setFromAxisAngle(up, leg.yaw);
    leg.ankle.quaternion.slerp(this.parentRotation.invert().multiply(this.swing), weight);
  }

  aim(bone) {
    this.swing.setFromUnitVectors(this.from.normalize(), this.to.normalize());
    bone.parent.getWorldQuaternion(this.parentRotation);
    this.swing.multiply(this.parentRotation).premultiply(this.parentRotation.invert());
    bone.quaternion.premultiply(this.swing);
  }
}
