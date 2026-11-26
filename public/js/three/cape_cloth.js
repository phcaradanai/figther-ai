import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

const { clamp } = MathUtils;
const GRAVITY = 14;
const AIR = 3.2;        // drag against still air, per second
const DAMPING = 2.6;    // cloth's own loss, per second
const PULL = [0, 10, 5, 2]; // spring back toward the authored drape, per point
const BEND = 30;        // spring toward a straight continuation of the segment above
const MAX_BEND = 0.5;   // radians a segment may fold relative to the one above
const SLACK = 0.02;     // how far the cloth may swing forward of its drape (rig units)
const LEG_RADIUS = 0.07;
const LEG_SOFTNESS = 0.45; // share of a leg overlap resolved per pass
const MAX_LIFT = 1.45;  // radians from hanging straight down, about the torso's side axis
const MAX_SWAY = 0.3;   // radians sideways
const SUBSTEP = 1 / 120;
const FLOOR = 0.03;      // the strand stays this far above the feet line (render root)
const FOLLOW = 26;      // per second: how fast the bones take up the strand's shape

const _inverse = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _w = new Vector3();
const _force = new Vector3();
const _side = new Vector3();
const _back = new Vector3();
const _raw = new Vector3();
const _acc = new Vector3();

// A short verlet strand drives a cape's bone chain (bones with identity rest
// rotation). Points are kept relative to the render root; the root's smoothed
// velocity and acceleration act as air drag and inertia, so server-tick steps in
// the root do not make the cloth twitch. The body pushes the strand back out: it
// cannot fold forward past its authored drape and it rides over a heel kicked up
// behind the hips.
export class CapeCloth {
  constructor(bones, tip, colliders) {
    this.bones = bones;
    this.torso = bones[0].parent;
    this.colliders = colliders;
    const offsets = [...bones.slice(1).map(bone => bone.position.clone()), new Vector3(...tip)];
    this.rest = offsets.map(offset => offset.clone().normalize());
    // Drape points in the torso's space with every cape bone at rest.
    this.drape = [bones[0].position.clone()];
    for (const offset of offsets) this.drape.push(this.drape[this.drape.length - 1].clone().add(offset));
    this.lengths = offsets.map(offset => offset.length());
    this.points = this.drape.map(() => new Vector3());
    this.previous = this.drape.map(() => new Vector3());
    this.targets = this.drape.map(() => new Vector3());
    this.local = this.drape.map(() => new Vector3());
    this.legPoints = colliders.map(() => new Vector3());
    this.shape = bones.map(() => new Quaternion());
    this.root = new Vector3();
    this.rootVelocity = new Vector3();
    this.rootAcceleration = new Vector3();
    this.ready = false;
    this.time = 0;
  }

  reset(root) {
    this.locate();
    for (let i = 0; i < this.points.length; i++) {
      this.points[i].copy(this.targets[i]).sub(root);
      this.previous[i].copy(this.points[i]);
    }
    this.root.copy(root);
    this.rootVelocity.set(0, 0, 0);
    this.rootAcceleration.set(0, 0, 0);
    this.ready = true;
    this.pose(root, Infinity);
  }

  // World positions of the drape for the torso's current pose.
  locate() {
    for (const bone of this.bones) bone.quaternion.identity();
    this.torso.updateWorldMatrix(true, false);
    for (let i = 0; i < this.drape.length; i++) this.targets[i].copy(this.drape[i]).applyMatrix4(this.torso.matrixWorld);
  }

  update(dt, root, flutter = 0) {
    if (!this.ready || root.distanceToSquared(this.root) > 4) this.reset(root);
    if (dt <= 0) {
      this.locate();
      this.points[0].copy(this.targets[0]).sub(root);
      this.pose(root, 0);
      return;
    }
    this.time += dt;
    // Root motion as seen by the cloth: velocity for drag, acceleration for inertia.
    _raw.copy(root).sub(this.root).divideScalar(dt);
    this.root.copy(root);
    _acc.copy(this.rootVelocity);
    this.rootVelocity.lerp(_raw, 1 - Math.exp(-dt * 22));
    _acc.subVectors(this.rootVelocity, _acc).divideScalar(dt);
    this.rootAcceleration.lerp(_acc, 1 - Math.exp(-dt * 16));
    this.rootAcceleration.clampLength(0, 60);

    this.locate();
    this.torso.getWorldQuaternion(_q);
    _side.set(1, 0, 0).applyQuaternion(_q);
    _back.set(0, 0, -1).applyQuaternion(_q);
    for (let i = 0; i < this.colliders.length; i++) {
      const [node, offset] = this.colliders[i];
      this.legPoints[i].copy(offset).applyMatrix4(node.matrixWorld);
    }
    _inverse.copy(this.torso.matrixWorld).invert();

    const steps = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-6));
    const h = dt / steps;
    const keep = Math.exp(-DAMPING * h);
    for (let step = 0; step < steps; step++) {
      this.points[0].copy(this.targets[0]).sub(root);
      for (let i = 1; i < this.points.length; i++) {
        const p = this.points[i];
        const q = this.previous[i];
        _v.subVectors(p, q).divideScalar(h);
        _force.set(0, -GRAVITY, 0)
          .addScaledVector(_w.copy(_v).add(this.rootVelocity), -AIR)
          .sub(this.rootAcceleration)
          .addScaledVector(_w.copy(this.targets[i]).sub(root).sub(p), PULL[i]);
        if (i >= 2) {
          // Bending stiffness: lean toward the line of the segment above.
          const a = this.points[i - 1];
          _w.subVectors(a, this.points[i - 2]).normalize().multiplyScalar(this.lengths[i - 1]).add(a).sub(p);
          _force.addScaledVector(_w, BEND);
        }
        if (flutter > 0) {
          const wave = this.time * 9.5 - i * 1.4;
          _force.addScaledVector(_side, Math.sin(wave) * flutter * i * 0.9)
            .addScaledVector(_back, (0.5 + 0.5 * Math.sin(wave * 0.83 + 1.1)) * flutter * i * 0.7);
        }
        q.copy(p);
        p.addScaledVector(_v, h * keep).addScaledVector(_force, h * h);
      }
      this.constrain(root);
    }
    this.pose(root, dt);
  }

  // Hold segment lengths and keep the strand behind the body, in torso space.
  constrain(root) {
    const { local, drape, lengths } = this;
    for (let i = 0; i < local.length; i++) local[i].copy(this.points[i]).add(root).applyMatrix4(_inverse);
    local[0].copy(drape[0]);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < local.length; i++) this.limit(i);
      for (const point of this.legPoints) {
        _v.copy(point).applyMatrix4(_inverse);
        for (let i = 1; i < local.length; i++) {
          const a = local[i - 1];
          const b = local[i];
          if (_v.y > a.y + LEG_RADIUS || _v.y < b.y - LEG_RADIUS) continue;
          const u = clamp((a.y - _v.y) / Math.max(1e-4, a.y - b.y), 0, 1);
          const push = a.z + (b.z - a.z) * u - (_v.z - LEG_RADIUS);
          if (push <= 0) continue;
          // Swing the lower end out about the upper one, a share at a time, so a
          // kicking heel lifts the cloth without snapping it.
          b.z -= Math.min(push / Math.max(u, 0.4), 0.08) * LEG_SOFTNESS;
        }
      }
    }
    for (let i = 1; i < local.length; i++) {
      this.points[i].copy(local[i]).applyMatrix4(this.torso.matrixWorld).sub(root);
      // A Knight lying on its back must not push the cloth through the floor.
      if (this.points[i].y < FLOOR) this.points[i].y = FLOOR;
    }
  }

  // Place point i from its parent at the segment length, within the swing limits,
  // and never forward of the authored drape.
  limit(i) {
    const { local, drape } = this;
    const a = local[i - 1];
    const b = local[i];
    _w.subVectors(b, a);
    if (_w.lengthSq() < 1e-8) _w.subVectors(drape[i], drape[i - 1]);
    _w.normalize();
    const restLift = Math.atan2(-(drape[i].z - drape[i - 1].z), -(drape[i].y - drape[i - 1].y));
    let lift = clamp(Math.atan2(-_w.z, -_w.y), restLift - 0.25, MAX_LIFT);
    let sway = clamp(Math.asin(clamp(_w.x, -1, 1)), -MAX_SWAY, MAX_SWAY);
    if (i >= 2) {
      // Keep the cloth from creasing: limit the fold against the segment above.
      _v.subVectors(a, local[i - 2]).normalize();
      const upperLift = Math.atan2(-_v.z, -_v.y);
      const upperSway = Math.asin(clamp(_v.x, -1, 1));
      lift = clamp(lift, upperLift - MAX_BEND, upperLift + MAX_BEND);
      sway = clamp(sway, upperSway - MAX_BEND * 0.5, upperSway + MAX_BEND * 0.5);
    }
    const along = Math.cos(sway);
    b.set(Math.sin(sway), -Math.cos(lift) * along, -Math.sin(lift) * along).multiplyScalar(this.lengths[i - 1]).add(a);
    const front = this.drapeZ(b.y) + SLACK;
    if (b.z > front) b.z -= (b.z - front) * 0.6;
  }

  drapeZ(y) {
    const { drape } = this;
    for (let i = 1; i < drape.length; i++) {
      if (y >= drape[i].y || i === drape.length - 1) {
        const a = drape[i - 1];
        const b = drape[i];
        return a.z + (b.z - a.z) * (a.y - y) / (a.y - b.y);
      }
    }
    return drape[0].z;
  }

  // Aim each bone at the next point. The bones ease into the strand's shape so a
  // contact or a limit reached between frames does not read as a twitch.
  pose(root, dt) {
    const follow = 1 - Math.exp(-dt * FOLLOW);
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      bone.parent.getWorldQuaternion(_q).invert();
      _v.subVectors(this.points[i + 1], this.points[i]).applyQuaternion(_q).normalize();
      _q.setFromUnitVectors(this.rest[i], _v);
      this.shape[i].slerp(_q, follow);
      bone.quaternion.copy(this.shape[i]);
      bone.updateWorldMatrix(false, false);
    }
    this.root.copy(root);
  }
}
