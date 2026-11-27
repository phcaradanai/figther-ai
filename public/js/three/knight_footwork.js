import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { solveAnatomicalLeg } from './knight_anatomy.js';

const { clamp, smoothstep } = MathUtils;
const up = new Vector3(0, 1, 0);
const CATCH = 0.045;
const heading = new Euler();

// Anchor the support boot in world space while the clip drives its swing leg.
// The placement follows the visual root so server tick cadence cannot tug the boot along.
export class KnightFootwork {
  constructor(rig) {
    this.rig = rig;
    this.legs = [
      { thigh: rig.legL, knee: rig.shinL, ankle: rig.footL, side: 1 },
      { thigh: rig.legR, knee: rig.shinR, ankle: rig.footR, side: -1 }
    ].map(leg => ({
      ...leg,
      upper: leg.knee.position.length() * rig.rigScale,
      lower: leg.ankle.position.length() * rig.rigScale,
      contact: new Vector3(),
      planted: false,
      footYaw: 0,
      yaw: 0,
      progress: 0
    }));
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.hip = new Vector3();
    this.knee = new Vector3();
    this.ankle = new Vector3();
    this.target = new Vector3();
    this.parentRotation = new Quaternion();
    this.footWorld = new Quaternion();
    this.swing = new Quaternion();
    this.speed = 0;
    this.pitch = 0;
    this.bank = 0;
    this.turnRate = 0;
    this.gearLag = 0;
    this.coast = 0;
    this.breathPhase = Math.random() * Math.PI * 2;
    this.fx = null;
  }

  track(position, yaw, turn, dt, speed) {
    if (this.ready) {
      this.velocity.copy(position).sub(this.position);
    }
    const moved = this.velocity.length();
    if (moved > 0.85) this.release();
    this.coast = speed > 0.8 ? 0.075 : Math.max(0, this.coast - dt);
    const sampledSpeed = moved <= 0.85 && dt > 0
      ? Math.hypot(this.velocity.x, this.velocity.z) / dt : speed;
    const previous = this.speed;
    const blend = 1 - Math.exp(-dt * 18);
    this.speed += (Math.min(sampledSpeed, speed * 1.35 + 2) - this.speed) * blend;
    const acceleration = dt > 0 ? (this.speed - previous) / dt : 0;
    this.pitch += (clamp(acceleration * 0.019, -0.21, 0.24) - this.pitch) * blend;
    const turnVel = dt > 0 ? clamp(turn / dt, -12, 12) : 0;
    this.turnRate += (turnVel - this.turnRate) * (1 - Math.exp(-dt * 14));
    const bank = dt > 0 && speed > 0.8 ? clamp(-turnVel * 0.028, -0.25, 0.25) : 0;
    this.bank += (bank - this.bank) * blend;
    this.gearLag += (this.pitch - this.gearLag) * (1 - Math.exp(-dt * 8));
    this.breathPhase += dt * 2.2;
    this.position.copy(position);
    this.yaw = yaw;
    this.ready = true;
  }

  // Playback speed that keeps the planted boot still: the clip is baked for `groundSpeed`.
  rate(clip, speed) {
    const nominal = clip.userData?.groundSpeed || (clip.name === 'run' ? 7.45 : 5.4);
    const travelSpeed = this.speed * 0.62 + speed * 0.38;
    return clamp(travelSpeed / nominal * (clip.userData?.groundSpeed ? 1 : 1.09), 0.28, 1.85);
  }

  locomotionSpeed(speed, actionName) {
    const gait = actionName === 'walk' || actionName === 'run';
    return gait && this.coast > 0 ? Math.max(speed, this.speed * 0.72) : speed;
  }

  release() {
    for (const leg of this.legs) leg.planted = false;
  }

  apply(action, grounded, floorY, feetDown = false) {
    const name = action.getClip().name;
    const gait = name === 'walk' || name === 'run';
    const { rig } = this;
    if (grounded && (gait || name === 'idle' || name === 'dash')) {
      rig.torso.rotateX(this.pitch);
      rig.torso.rotateZ(this.bank);
      // Vestibulo-ocular stabilization & turn-leading gaze anticipation.
      rig.head.rotateX(-this.pitch * 0.65);
      rig.head.rotateZ(-this.bank * 0.60);
      rig.head.rotateY(clamp(this.turnRate * 0.035, -0.20, 0.20));
    }
    if (grounded && (name === 'idle' || name === 'guard')) {
      const breath = Math.sin(this.breathPhase);
      rig.torso.rotateX(breath * 0.014);
      rig.head.rotateX(-breath * 0.010);
      rig.armL.rotateZ(breath * 0.008);
      rig.armR.rotateZ(-breath * 0.008);
    }
    if (grounded && (gait || name === 'idle' || name === 'dash' || name === 'brakeL' || name === 'brakeR')) {
      const followThrough = this.gearLag - this.pitch;
      rig.foreL.rotateX(clamp(followThrough * 0.45, -0.25, 0.25));
      rig.armR.rotateX(followThrough * 0.85);
    }
    if (!grounded || !gait) {
      this.release();
      if (grounded && feetDown) this.ground(action, floorY);
      return;
    }

    if (this.speed < 0.35) {
      this.release();
      return;
    }
    const duration = action.getClip().duration;
    const phase = action.time / duration;
    // Fraction of the cycle a boot stays down: the baked gaits say (the stance of the retimed step),
    // the hand-made ones are 0.34.
    const end = action.getClip().userData?.stance ? action.getClip().userData.stance + 0.055 : 0.34;
    const releaseStart = action.getClip().userData?.stance ? action.getClip().userData.stance - 0.005 : end - 0.11;
    for (const [i, leg] of this.legs.entries()) {
      // A running foot is caught just before its contact key, so it does not
      // skim the floor at full swing speed on the last airborne frame.
      const cycle = (phase + i * 0.5) % 1;
      const progress = cycle >= 1 - CATCH ? cycle - 1 : cycle;
      if (progress >= end || (leg.planted && progress < leg.progress)) {
        leg.planted = false;
      }
      leg.progress = progress;
      if (progress >= end) continue;

      leg.ankle.getWorldPosition(this.ankle);
      let touched = false;
      if (!leg.planted) {
        leg.planted = true;
        leg.contact.copy(this.ankle);
        leg.yaw = this.yaw;
        // The boot's own heading when it lands (toes out as the clip has them) is what it keeps.
        leg.ankle.getWorldQuaternion(this.parentRotation);
        leg.footYaw = heading.setFromQuaternion(this.parentRotation, 'YXZ').y;
        touched = true;
      }
      const floor = floorY?.(leg.contact.x, leg.contact.z, this.position.y + 0.10);
      const ground = floorY ? floor : this.position.y;
      if (ground == null || Math.abs(ground - this.position.y) > 0.18) continue;
      if (touched) this.kickUp(leg.contact, ground);

      // Allow the foot to release smoothly on sharp direction changes and platform edges.
      const turn = Math.acos(clamp(Math.cos(this.yaw - leg.yaw), -1, 1));
      const sideError = Math.abs((leg.contact.x - this.ankle.x) * Math.cos(this.yaw)
        - (leg.contact.z - this.ankle.z) * Math.sin(this.yaw));
      const weight = smoothstep(progress, -CATCH, 0.01)
        * (1 - smoothstep(progress, releaseStart, end))
        * (1 - smoothstep(turn, 0.30, 0.90))
        * (1 - smoothstep(sideError, 0.075, 0.16))
        * action.getEffectiveWeight();
      if (weight <= 0.001) continue;
      this.target.set(leg.contact.x, ground + rig.restFootY, leg.contact.z).lerp(this.ankle, 1 - weight);
      this.solve(leg, weight, true);
    }
  }

  // A fast boot kicks up a small puff of dust as it lands.
  kickUp(contact, ground) {
    const k = clamp((this.speed - 3.5) / 4, 0, 1.2);
    if (!this.fx || k < 0.15) return;
    this.fx.dustPuff(contact.x, ground, contact.z, k > 0.8 ? 4 : 3, 0.55 + 0.4 * k, '#f4ecd9');
  }

  // Strikes: pull a boot that is near the floor onto it and stand it flat, so a
  // wide stance never floats one foot or sinks the other.
  ground(action, floorY) {
    const { rig } = this;
    const plans = [];
    for (const leg of this.legs) {
      leg.ankle.getWorldPosition(this.ankle);
      const floor = floorY ? floorY(this.ankle.x, this.ankle.z, this.position.y + 0.10) : this.position.y;
      if (floor == null || Math.abs(floor - this.position.y) > 0.18) continue;
      const lift = this.ankle.y - floor - rig.restFootY;
      const weight = (1 - smoothstep(lift, 0.05, 0.14)) * action.getEffectiveWeight();
      if (weight <= 0.001) continue;
      leg.knee.getWorldQuaternion(this.parentRotation);
      leg.yaw = heading.setFromQuaternion(this.parentRotation, 'YXZ').y;
      const goal = new Vector3(this.ankle.x, floor + rig.restFootY, this.ankle.z).lerp(this.ankle, 1 - weight);
      plans.push({ leg, goal, weight });
    }
    // Reaching one boot down can lower the hips, which sinks the other boot, so
    // solve both legs again against the final hip height.
    for (let pass = 0; pass < 2; pass++) {
      for (const { leg, goal, weight } of plans) {
        this.target.copy(goal);
        this.solve(leg, weight);
      }
    }
  }

  // keepTilt: leave the boot's pitch and roll as the clip has them (heel strike, flat, toe-off)
  // and only hold its heading; otherwise stand it flat (strikes).
  solve(leg, weight, keepTilt = false) {
    const { rig, hip, target } = this;
    if (keepTilt) leg.ankle.getWorldQuaternion(this.footWorld);
    leg.thigh.getWorldPosition(hip);
    const reach = leg.upper + leg.lower - 0.014;
    const horizontal = Math.hypot(target.x - hip.x, target.z - hip.z);
    const height = Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal));
    const drop = clamp(hip.y - target.y - height, 0, 0.14 * weight);
    if (drop > 0) {
      rig.hips.position.y -= drop / rig.rigScale;
      leg.thigh.getWorldPosition(hip);
    }

    this.placeLeg(leg);
    leg.ankle.parent.getWorldQuaternion(this.parentRotation);
    if (keepTilt) {
      const now = heading.setFromQuaternion(this.footWorld, 'YXZ').y;
      const turn = Math.atan2(Math.sin(leg.footYaw - now), Math.cos(leg.footYaw - now)) * weight;
      this.footWorld.premultiply(this.swing.setFromAxisAngle(up, turn));
      leg.ankle.quaternion.copy(this.parentRotation.invert().multiply(this.footWorld));
      return;
    }
    this.swing.setFromAxisAngle(up, leg.yaw);
    leg.ankle.quaternion.slerp(this.parentRotation.invert().multiply(this.swing), weight);
  }

  // Anatomically constrained 2-bone leg solver with forward knee pole and 1-DOF knee hinge.
  placeLeg(leg) {
    leg.knee.getWorldPosition(this.knee);
    solveAnatomicalLeg(this.rig.hips, leg.thigh, leg.knee, leg.ankle, this.target, leg.upper, leg.lower, leg.side, this.knee);
  }
}
