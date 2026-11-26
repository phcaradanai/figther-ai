// ============================================================================
// Iron Knight gear skills - crisp, hard-hitting Paladin-style VFX
// (Tree of Savior feel, drawn from scratch)
//
// Feel rules used throughout:
//   * shapes snap in within 1-3 frames, flash white on contact, then leave fast
//     (short ease-in fades, no long floating glows)
//   * every contact gets an impact layer: jagged impact frame, ground cracks,
//     dust ring, rock chips, sparks that fly fast and fall, camera shake + punch,
//     caster hit-stop and a brief freeze of the knight's own VFX clock
//   * bright additive shapes sit on a painted (normal-blend) body and a dark
//     outline so they keep their edges on light floors
//
//   knight_weapon  Excalibur Wave    sword arc + crescent riding the server projectile
//   knight_armor   Aegis Fortress    shield slam, cracks, hex barrier dome, light shards
//   knight_helmet  Lionheart Warcry  sky pillar slam, sunburst stamp, roar rings, heal crosses
//   knight_trinket Chariot Rush      launch blast, shield crest ram, bow wave, speed lines
// ============================================================================
import * as THREE from 'three';
import { holyTextures } from './holy_textures.js';

const C = {
  white: '#fff7e2',
  gold: '#ffd46e',
  paint: '#ffb02a',
  outline: '#3a1c00',
  amber: '#f2a93b',
  sky: '#bfe7ff',
  blue: '#3d97f0',
  navy: '#0f2a5c',
  heal: '#b6ffc8',
  healBody: '#4fdc7e',
  healDark: '#0d5a26',
  crack: '#2a1806',
  dust: '#d9c7a3',
  rock: '#6b5236'
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x) => Math.pow(clamp01(x), 2);
const easeOutBack = (x) => {
  const k = clamp01(x) - 1;
  return 1 + 2.6 * k * k * k + 1.6 * k * k;
};
// 0 before t0, rises to 1 over fadeIn, holds until t1, then drops to 0 over fadeOut (ease-in: leaves fast)
function env(age, t0, fadeIn, t1, fadeOut) {
  if (age < t0) return 0;
  if (age < t0 + fadeIn) return (age - t0) / Math.max(1e-4, fadeIn);
  if (age < t1) return 1;
  return 1 - easeIn((age - t1) / Math.max(1e-4, fadeOut));
}
// Stamp: lands oversized and snaps down to 1 (reads as a slam, not a slow grow)
function stamp(age, t0, dur, over = 0.35) {
  if (age < t0) return 1 + over;
  return 1 + over * (1 - easeOut((age - t0) / dur));
}
const rand = (a, b) => a + Math.random() * (b - a);

const MAX_SPARKS = 480;
const _cam = new THREE.Vector3();
const _d = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _ay = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _col = new THREE.Color();
const BLACK = new THREE.Color(0, 0, 0);

export class KnightHolyVFX {
  constructor({ scene, camera, fx, shake, floorY, getProjectiles, hitStop, punch }) {
    this.camera = camera;
    this.fx = fx;
    this.shake = shake || (() => {});
    this.floorY = floorY || (() => 0);
    this.getProjectiles = getProjectiles || (() => new Map());
    this.hitStop = hitStop || (() => {});
    this.punch = punch || (() => {});
    this.group = new THREE.Group();
    this.group.name = 'KnightHolyVFX';
    scene.add(this.group);
    this.tex = holyTextures();
    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      dome: new THREE.SphereGeometry(1, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2)
    };
    this.effects = [];
    this.auras = new Map();
    this.boundProjectiles = new Set();
    this.freezeUntil = 0;

    // Spark needles: one instanced draw call, stretched along velocity, facing the camera
    this.sparkMesh = new THREE.InstancedMesh(this.geo.plane, new THREE.MeshBasicMaterial({
      map: this.tex.needle,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    }), MAX_SPARKS);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_SPARKS; i++) this.sparkMesh.setColorAt(i, BLACK);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.renderOrder = 22;
    this.sparkMesh.count = 0;
    this.group.add(this.sparkMesh);
    this.sparks = [];
    this.lastSlash = null;
  }

  // ------------------------------------------------------------------ building blocks
  mat(texKey, color, k = 1, { blend = 'add', opacity = 1 } = {}) {
    const additive = blend === 'add';
    return new THREE.MeshBasicMaterial({
      map: texKey ? this.tex[texKey] : null,
      color: new THREE.Color(color).multiplyScalar(additive ? k : 1),
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
  }

  quad(parent, texKey, color, k = 1, o = {}) {
    const m = new THREE.Mesh(this.geo.plane, this.mat(texKey, color, k, o));
    m.renderOrder = o.blend === 'normal' ? 15 : 16;
    parent.add(m);
    return m;
  }

  // Flat decal on the floor; texture +X maps to the parent's local +Z (forward)
  decal(parent, texKey, color, k, o = {}) {
    const m = this.quad(parent, texKey, color, k, o);
    m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    return m;
  }

  // Dark outline + optional painted body + additive highlight, all on the floor
  decalPair(parent, texKey, color, k, shadowColor = C.outline, shadowOpacity = 0.5, bodyColor = null, bodyOpacity = 0.85) {
    const back = this.decal(parent, texKey, shadowColor, 1, { blend: 'normal', opacity: shadowOpacity });
    const body = bodyColor ? this.decal(parent, texKey, bodyColor, 1, { blend: 'normal', opacity: bodyOpacity }) : null;
    const front = this.decal(parent, texKey, color, k);
    if (body) body.position.y = 0.006;
    front.position.y = 0.012;
    return { back, body, front, set: (s, a, rotZ = 0) => {
      const sc = Math.max(0.001, s);
      back.scale.set(sc * 1.02, sc * 1.02, 1);
      front.scale.set(sc, sc, 1);
      back.material.opacity = shadowOpacity * a;
      front.material.opacity = a;
      back.rotation.z = -Math.PI / 2 + rotZ;
      front.rotation.z = -Math.PI / 2 + rotZ;
      if (body) {
        body.scale.set(sc, sc, 1);
        body.material.opacity = bodyOpacity * a;
        body.rotation.z = -Math.PI / 2 + rotZ;
      }
    } };
  }

  sprite(parent, texKey, color, k = 1, o = {}) {
    const additive = (o.blend || 'add') === 'add';
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex[texKey],
      color: new THREE.Color(color).multiplyScalar(additive ? k : 1),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      opacity: o.opacity ?? 1
    }));
    if (o.anchorBottom) s.center.set(0.5, 0);
    s.renderOrder = additive ? 21 : 19;
    parent.add(s);
    return s;
  }

  // Painted sprite under an additive highlight (light shafts, crosses on bright scenery)
  spritePair(parent, texKey, bodyColor, glowColor, k = 1, o = {}) {
    const bodyOpacity = o.bodyOpacity ?? 0.7;
    const body = this.sprite(parent, texKey, bodyColor, 1, { blend: 'normal', opacity: bodyOpacity, anchorBottom: o.anchorBottom });
    const glow = this.sprite(parent, texKey, glowColor, k, { anchorBottom: o.anchorBottom });
    const bodyScale = o.bodyScale ?? 1.25;
    return { body, glow, set: (sx, sy, a) => {
      body.scale.set(Math.max(0.001, sx * bodyScale), Math.max(0.001, sy), 1);
      glow.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), 1);
      body.material.opacity = bodyOpacity * a;
      glow.material.opacity = a;
    }, place: (x, y, z) => {
      body.position.set(x, y, z);
      glow.position.set(x, y, z);
    } };
  }

  // Roll a group about its local +Z (travel axis) so a sheet lying in its local
  // YZ plane turns its face to the camera: crescents stay readable from any angle
  faceCameraRoll(holder) {
    if (!this.camera) return;
    this.camera.getWorldPosition(_cam);
    holder.parent.updateMatrixWorld(true);
    holder.parent.worldToLocal(_cam).sub(holder.position);
    let phi = Math.atan2(_cam.y, _cam.x);
    if (Math.cos(phi) < 0) phi += Math.PI;
    holder.rotation.z = phi;
  }

  ground(x, y, z) {
    const g = this.floorY(x, z, y + 0.5);
    return Number.isFinite(g) ? g : y;
  }

  // An effect owns a root group (world space) and a tick(dt, age, player) that animates it
  effect(o, duration, tick, { follow = false } = {}) {
    const root = new THREE.Group();
    root.position.set(o.x || 0, o.y || 0, o.z || 0);
    root.rotation.y = Math.PI / 2 - (o.facing || 0);
    this.group.add(root);
    const e = {
      root, age: 0, duration, tick, follow: follow && !!o.playerId, playerId: o.playerId || null,
      gy: this.ground(o.x || 0, o.y || 0, o.z || 0) - (o.y || 0) + 0.03
    };
    this.effects.push(e);
    return e;
  }

  dispose(obj) {
    obj.removeFromParent();
    obj.traverse((n) => {
      if (n.material && n !== this.sparkMesh) n.material.dispose();
    });
  }

  // Short global slow-down of the knight VFX clock: the "impact frame"
  freeze(ms) {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  // ------------------------------------------------------------------ impact layer
  sparkBurst(x, y, z, n, o = {}) {
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      let a, el;
      if (o.dir !== undefined) {
        a = o.dir + rand(-(o.cone ?? 0.6), o.cone ?? 0.6);
        el = rand(o.elMin ?? -0.1, o.elMax ?? 0.6);
      } else {
        a = rand(0, Math.PI * 2);
        el = rand(o.elMin ?? -0.15, o.elMax ?? 0.9);
      }
      const sp = rand(o.speedMin ?? 6, o.speed ?? 14);
      const col = Math.random() < (o.white ?? 0.35) ? C.white : (o.color || C.gold);
      this.sparks.push({
        p: new THREE.Vector3(x + rand(-0.1, 0.1), y + rand(-0.1, 0.1), z + rand(-0.1, 0.1)),
        v: new THREE.Vector3(Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + (o.up || 0), Math.sin(a) * Math.cos(el) * sp),
        age: 0,
        life: rand(o.lifeMin ?? 0.16, o.life ?? 0.36),
        color: new THREE.Color(col).multiplyScalar(o.k ?? 1.7),
        len: o.len ?? 0.05,
        width: o.width ?? 0.08,
        g: o.gravity ?? -18,
        drag: o.drag ?? 2.2
      });
    }
  }

  updateSparks(dt) {
    if (this.camera) this.camera.getWorldPosition(_cam);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.life) this.sparks.splice(i, 1);
    }
    let n = 0;
    for (const s of this.sparks) {
      s.v.y += s.g * dt;
      s.v.multiplyScalar(Math.exp(-s.drag * dt));
      s.p.addScaledVector(s.v, dt);
      const speed = s.v.length();
      if (speed > 0.01) _d.copy(s.v).divideScalar(speed);
      else _d.set(0, 1, 0);
      _n.copy(_cam).sub(s.p).normalize();
      _s.crossVectors(_d, _n);
      if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0);
      _s.normalize();
      _n.crossVectors(_d, _s);
      const k = 1 - s.age / s.life;
      const len = Math.max(0.15, speed * s.len);
      _ax.copy(_d).multiplyScalar(len);
      _ay.copy(_s).multiplyScalar(s.width * (0.35 + 0.65 * k));
      _m4.makeBasis(_ax, _ay, _n);
      _pos.copy(s.p).addScaledVector(_d, -len * 0.5);
      _m4.setPosition(_pos);
      this.sparkMesh.setMatrixAt(n, _m4);
      _col.copy(s.color).multiplyScalar(k);
      this.sparkMesh.setColorAt(n, _col);
      n++;
    }
    this.sparkMesh.count = n;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }

  // Jagged impact frame: dark outline, painted body, white-hot centre; ~0.13 s total
  impactBurst(x, y, z, { color = C.paint, size = 3.0, life = 0.16 } = {}) {
    const e = this.effect({ x, y, z }, life, null);
    const rot = rand(0, Math.PI * 2);
    const out = this.sprite(e.root, 'impact', C.outline, 1, { blend: 'normal', opacity: 0.9 });
    const body = this.sprite(e.root, 'impact', color, 1, { blend: 'normal', opacity: 1 });
    const hot = this.sprite(e.root, 'impact', C.white, 1.6);
    const flare = this.sprite(e.root, 'flare', C.white, 1.6);
    for (const s of [out, body, hot]) s.material.rotation = rot;
    e.tick = (dt, age) => {
      const k = clamp01(age / life);
      const grow = 0.45 + 0.55 * easeOut(age / 0.035) + 0.2 * k;
      const a = age < 0.05 ? 1 : 1 - easeIn((age - 0.05) / (life - 0.05));
      out.scale.setScalar(size * grow * 1.12);
      body.scale.setScalar(size * grow);
      hot.scale.setScalar(size * grow * 0.45);
      flare.scale.setScalar(size * 1.4 * (0.6 + 0.4 * k));
      out.material.opacity = 0.9 * a;
      body.material.opacity = a;
      hot.material.opacity = a;
      flare.material.opacity = a * 0.8;
    };
  }

  // X-shaped slash flash across a victim
  crossSlash(x, y, z, color = C.paint) {
    const e = this.effect({ x, y, z }, 0.16, null);
    const lines = [];
    for (const rot of [Math.PI / 4 + rand(-0.2, 0.2), -Math.PI / 4 + rand(-0.2, 0.2)]) {
      const body = this.sprite(e.root, 'needle', color, 1, { blend: 'normal', opacity: 0.95 });
      const hot = this.sprite(e.root, 'needle', C.white, 1.8);
      body.material.rotation = hot.material.rotation = rot;
      lines.push(body, hot);
    }
    e.tick = (dt, age) => {
      const g = easeOut(age / 0.05);
      const a = age < 0.07 ? 1 : 1 - easeIn((age - 0.07) / 0.09);
      for (let i = 0; i < lines.length; i++) {
        const hot = i % 2 === 1;
        lines[i].scale.set(Math.max(0.001, 1.9 * g * (hot ? 0.9 : 1)), hot ? 0.1 : 0.18, 1);
        lines[i].material.opacity = (hot ? 1 : 0.95) * a;
      }
    };
  }

  // Cracked floor: glowing seams flash and cool, dark cracks stay a moment longer
  groundCrack(x, y, z, size, { glow = C.gold, life = 1.1 } = {}) {
    const gy = this.ground(x, y, z);
    const e = this.effect({ x, y: gy, z, facing: rand(0, Math.PI * 2) }, life, null);
    const dark = this.decal(e.root, 'cracks', C.crack, 1, { blend: 'normal', opacity: 0.85 });
    const hot = this.decal(e.root, 'cracks', glow, 1, { blend: 'normal', opacity: 1 });
    dark.position.y = 0.05;
    hot.position.y = 0.056;
    dark.renderOrder = 17;
    hot.renderOrder = 17;
    e.tick = (dt, age) => {
      const s = size * (0.75 + 0.25 * easeOut(age / 0.05));
      dark.scale.set(s, s, 1);
      hot.scale.set(s * 0.985, s * 0.985, 1);
      dark.material.opacity = 0.85 * env(age, 0, 0.02, life * 0.55, life * 0.45);
      hot.material.opacity = env(age, 0, 0.015, 0.08, 0.35);
    };
  }

  // Impact star stamped flat on the floor (self-centred slams: a sprite there hides behind the knight)
  groundStar(x, y, z, size, color = C.paint) {
    const gy = this.ground(x, y, z);
    const e = this.effect({ x, y: gy, z, facing: rand(0, Math.PI * 2) }, 0.2, null);
    const out = this.decal(e.root, 'impact', C.outline, 1, { blend: 'normal', opacity: 0.85 });
    const body = this.decal(e.root, 'impact', color, 1, { blend: 'normal', opacity: 1 });
    const hot = this.decal(e.root, 'impact', C.white, 1.4);
    out.position.y = 0.06;
    body.position.y = 0.064;
    hot.position.y = 0.068;
    for (const m of [out, body, hot]) m.renderOrder = 18;
    e.tick = (dt, age) => {
      const g = size * (0.5 + 0.5 * easeOut(age / 0.04) + 0.15 * clamp01(age / 0.2));
      const a = age < 0.07 ? 1 : 1 - easeIn((age - 0.07) / 0.13);
      out.scale.set(g * 1.08, g * 1.08, 1);
      body.scale.set(g, g, 1);
      hot.scale.set(g * 0.42, g * 0.42, 1);
      out.material.opacity = 0.85 * a;
      body.material.opacity = a;
      hot.material.opacity = a;
    };
  }

  dustRing(x, y, z, n, speed = 7, color = C.dust) {
    const gy = this.ground(x, y, z);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.15, 0.15);
      const sp = speed * rand(0.7, 1.15);
      this.fx.norm.spawn({
        x: x + Math.cos(a) * 0.3, y: gy + 0.15, z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * sp, vy: rand(0.4, 1.4), vz: Math.sin(a) * sp,
        color, size: rand(0.55, 0.85), sizeEnd: rand(1.4, 2.0), life: rand(0.4, 0.6),
        alpha: 0.7, drag: 5.5, tile: 'dust', spin: rand(-2, 2)
      });
    }
  }

  debris(x, y, z, n, spread = 5) {
    const gy = this.ground(x, y, z);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(2, spread);
      this.fx.norm.spawn({
        x: x + rand(-0.3, 0.3), y: gy + 0.1, z: z + rand(-0.3, 0.3),
        vx: Math.cos(a) * sp, vy: rand(4, 9), vz: Math.sin(a) * sp,
        color: Math.random() < 0.5 ? C.rock : '#8a7356', size: rand(0.14, 0.26), sizeEnd: 0.12,
        life: rand(0.45, 0.7), alpha: 1, gravity: -24, drag: 0.6, tile: 'dot'
      });
    }
  }

  // A full contact hit: frame, cracks, dust, chips, sparks, camera + caster weight
  slamImpact(x, y, z, o) {
    if (o.groundStar) this.groundStar(x, y, z, o.groundStar, o.color);
    else this.impactBurst(x, y + (o.lift ?? 0.4), z, { color: o.color, size: o.size ?? 2.6 });
    if (o.crack) this.groundCrack(x, y, z, o.crack, { glow: o.glow || C.paint });
    if (o.dust) this.dustRing(x, y, z, o.dust, o.dustSpeed ?? 7);
    if (o.debris) this.debris(x, y, z, o.debris);
    if (o.sparks) this.sparkBurst(x, y + (o.lift ?? 0.4), z, o.sparks, o.sparkOpts || {});
    this.shake(o.shake ?? 7);
    this.punch(o.punch ?? 1);
    if (o.playerId) this.hitStop(o.playerId, o.hitStop ?? 60);
    const ms = o.freeze ?? 50;
    this.fx.later(o.freezeDelay ?? 0.035, () => this.freeze(ms));
  }

  // Server hit events near a live knight effect get a knight-styled impact on the victim
  onHit(fx) {
    for (const e of this.effects) {
      const h = e.hitTest ? e.hitTest(fx.x, fx.y, fx.z, e.age) : null;
      if (!h) continue;
      this.impactBurst(fx.x, fx.y, fx.z, { color: h.color, size: 1.6 });
      if (h.slash) this.crossSlash(fx.x, fx.y, fx.z, h.color);
      this.sparkBurst(fx.x, fx.y, fx.z, 10, { dir: h.dir, cone: h.dir === undefined ? undefined : 0.9, color: h.spark || C.gold, speed: 12 });
      this.freeze(40);
      this.shake(3);
      return true;
    }
    // A plain combo strike: the victim shows the blow, not just the generic flash.
    const swing = this.lastSlash;
    if (swing && performance.now() - swing.at < 500 && Math.hypot(fx.x - swing.x, fx.z - swing.z) < 3.4) {
      this.basicHit(fx, swing);
      return true;
    }
    return false;
  }

  // One bright needle across the victim, like a blade mark that stays a heartbeat.
  hitLine(x, y, z, angle, length, color = C.gold) {
    const e = this.effect({ x, y, z }, 0.15, null);
    const body = this.sprite(e.root, 'needle', color, 1, { blend: 'normal', opacity: 0.95 });
    const hot = this.sprite(e.root, 'needle', C.white, 1.8);
    body.material.rotation = hot.material.rotation = angle;
    e.tick = (dt, age) => {
      const g = easeOut(age / 0.045);
      const a = age < 0.06 ? 1 : 1 - easeIn((age - 0.06) / 0.09);
      body.scale.set(Math.max(0.001, length * g), 0.2, 1);
      hot.scale.set(Math.max(0.001, length * 0.92 * g), 0.09, 1);
      body.material.opacity = 0.95 * a;
      hot.material.opacity = a;
    };
  }

  // Combo contact on a victim. Hit 1 cuts diagonally, hit 2 (the shield bash) is a
  // short punch, and the finisher is a heavy cross-cut with a floor mark.
  basicHit(fx, swing) {
    const big = swing.fin;
    const bash = !big && swing.step % 2 === 0;
    fx._knightHit = true; // the generic red flash would only muddy this
    this.impactBurst(fx.x, fx.y, fx.z, { color: big ? C.paint : C.gold, size: big ? 3.4 : bash ? 2.6 : 2.2, life: big ? 0.2 : 0.15 });
    if (big) this.crossSlash(fx.x, fx.y, fx.z, C.paint);
    else this.hitLine(fx.x, fx.y, fx.z, bash ? 0.12 : (swing.step % 4 === 1 ? -0.62 : 0.62), bash ? 2.2 : 3.4);
    this.sparkBurst(fx.x, fx.y, fx.z, big ? 18 : 10, {
      dir: swing.facing, cone: 0.7, speedMin: 6, speed: big ? 17 : 12, color: C.gold, white: 0.5
    });
    if (big) {
      this.groundStar(fx.x, fx.y - 1.0, fx.z, 1.5);
      this.dustRing(fx.x, fx.y - 1.0, fx.z, 5, 4);
    }
    this.freeze(big ? 60 : 30);
  }

  spawn(effectId, o) {
    if (effectId === 'knight_weapon') this.excalibur(o);
    else if (effectId === 'knight_armor') this.aegis(o);
    else if (effectId === 'knight_helmet') this.lionheart(o);
    else if (effectId === 'knight_trinket') this.chariot(o);
    else if (effectId === 'basic_slash') this.basicSlash(o);
    else if (effectId === 'heavy_shield_bash') this.shieldBash(o);
    else if (effectId === 'guard_parry') this.guardParry(o);
    else return false;
    return true;
  }

  // Cohesive, feather-light ToS basic slash accent (3D SwordTrail draws the actual blade arc!)
  basicSlash(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);
    const x = (o.x || 0) + dx * 1.15;
    const y = (o.y || 0) + 1.0;
    const z = (o.z || 0) + dz * 1.15;
    const isFin = !!o.isFinisher;
    this.lastSlash = { at: performance.now(), x: o.x || 0, z: o.z || 0, facing: f, step: o.comboStep || 1, fin: isFin };
    this.sparkBurst(x, y, z, isFin ? 10 : 5, {
      dir: f, cone: 0.75, speedMin: 4.5, speed: isFin ? 10 : 7.5,
      color: C.gold, white: 0.45, lifeMin: 0.12, life: 0.22, width: 0.065, gravity: -12
    });
    if (isFin) {
      this.groundCrack(x + dx * 0.25, o.y || 0, z + dz * 0.25, 1.55, { glow: C.gold, life: 0.75 });
      this.dustRing(x + dx * 0.25, o.y || 0, z + dz * 0.25, 6, 4.2);
      this.shake(3.5);
    }
  }

  // Cohesive ToS heavy Shield Bash (warm ivory-gold crest + crisp shock ring + instanced sparks)
  shieldBash(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);
    const e = this.effect(o, 0.36, null);
    const crestBack = this.quad(e.root, 'crest', C.outline, 1, { blend: 'normal', opacity: 0.55 });
    const crestBody = this.quad(e.root, 'crest', C.paint, 1, { blend: 'normal', opacity: 0.88 });
    const crestHot = this.quad(e.root, 'crest', C.white, 1.2, { blend: 'add', opacity: 0.9 });
    const ring = this.quad(e.root, 'shock', C.gold, 1, { blend: 'normal', opacity: 0.85 });
    e.tick = (dt, age) => {
      const k = clamp01(age / 0.36);
      const ease = easeOut(k);
      const a = age < 0.04 ? age / 0.04 : 1 - easeIn((age - 0.04) / 0.32);
      const zPos = 0.75 + ease * 1.15;
      const sc = 0.85 + ease * 1.15;
      for (const [m, mul, op, dzOff] of [[crestBack, 1.08, 0.55, -0.02], [crestBody, 1.0, 0.88, 0], [crestHot, 0.92, 0.85, 0.02]]) {
        m.position.set(0, 1.0, zPos + dzOff);
        m.scale.set(sc * mul, sc * mul, 1);
        m.material.opacity = op * a;
      }
      ring.position.set(0, 1.0, zPos + 0.12);
      const rs = 0.65 + ease * 1.95;
      ring.scale.set(rs, rs, 1);
      ring.material.opacity = 0.8 * (1 - k);
    };
    this.dustRing((o.x || 0) + dx * 1.1, o.y || 0, (o.z || 0) + dz * 1.1, 7, 5.0);
    this.sparkBurst((o.x || 0) + dx * 1.25, (o.y || 0) + 1.0, (o.z || 0) + dz * 1.25, 12, {
      dir: f, cone: 0.8, speedMin: 5, speed: 12, color: C.gold, white: 0.5, life: 0.26
    });
    this.shake(5);
  }

  // Cohesive ToS Guard / Perfect Parry spark flash
  guardParry(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);
    const x = (o.x || 0) + dx * 0.75;
    const y = (o.y || 0) + 1.05;
    const z = (o.z || 0) + dz * 0.75;
    const e = this.effect(o, 0.24, null);
    const ring = this.quad(e.root, 'shock', C.sky, 1, { blend: 'normal', opacity: 0.8 });
    const flare = this.sprite(e.root, 'flare', C.white, 1.4);
    flare.position.set(0, 1.05, 0.85);
    e.tick = (dt, age) => {
      const k = clamp01(age / 0.24);
      const ease = easeOut(k);
      ring.position.set(0, 1.05, 0.82);
      const s = 0.55 + ease * 1.25;
      ring.scale.set(s, s, 1);
      ring.material.opacity = 0.8 * (1 - k);
      flare.scale.setScalar(0.75 + ease * 1.1);
      flare.material.opacity = 1 - k;
    };
    this.sparkBurst(x, y, z, 10, { dir: f, cone: 1.1, speedMin: 4, speed: 10, color: C.gold, white: 0.55, life: 0.22 });
  }

  // ------------------------------------------------------------------ 1. Excalibur Wave
  excalibur(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;

    // Caster: circle stamps under the feet, glint on the raised blade, then a
    // vertical swing arc snaps from overhead into the ground
    const e = this.effect(o, 0.6, null);
    const circle = this.decalPair(e.root, 'circle', C.white, 0.9, C.outline, 0.7, C.paint, 0.85);
    e.groundPairs = [[circle, 0]];
    const glint = this.sprite(e.root, 'flare', C.white, 1.6);
    glint.position.set(-0.25, 2.25, -0.1);
    const swingRoll = new THREE.Group();
    swingRoll.position.set(0, 1.05, 0.15);
    e.root.add(swingRoll);
    const swingPivot = new THREE.Group();
    swingRoll.add(swingPivot);
    const swingLayers = [
      [C.outline, 1, 'normal', 0.8, 2.1],
      [C.paint, 1, 'normal', 0.95, 2.0],
      [C.white, 1.0, 'add', 1, 1.75],
      [C.white, 1.8, 'add', 1, 1.9]
    ].map(([col, k, blend, op, s]) => {
      const m = this.quad(swingPivot, 'crescent', col, k, { blend, opacity: op });
      m.rotation.y = -Math.PI / 2;
      m.position.z = -0.25;
      m.scale.set(s, s, 1);
      m.userData.op = op;
      return m;
    });
    const swingHot = swingLayers[3];
    e.tick = (dt, age) => {
      this.faceCameraRoll(swingRoll);
      circle.set(1.8 * stamp(age, 0, 0.1), env(age, 0, 0.02, 0.28, 0.22), age * 0.6);
      const g = env(age, 0, 0.03, 0.05, 0.05);
      glint.scale.setScalar(0.2 + 0.9 * g);
      glint.material.opacity = g;
      glint.material.rotation = age * 4;
      swingPivot.rotation.x = -1.35 + 1.6 * easeOut((age - 0.035) / 0.055);
      const sa = env(age, 0.035, 0.015, 0.12, 0.08);
      for (const m of swingLayers) m.material.opacity = m.userData.op * sa;
      swingHot.material.opacity = env(age, 0.07, 0.01, 0.09, 0.05);
    };
    this.fx.later(0.085, () => {
      this.slamImpact(ox + dx * 1.3, oy, oz + dz * 1.3, {
        color: C.paint, size: 1.7, lift: 0.5, crack: 2.0, dust: 8, debris: 6, sparks: 14,
        sparkOpts: { dir: f, cone: 0.6, speed: 13, color: C.gold, elMin: 0, elMax: 0.6 },
        shake: 5, punch: 0.8, playerId: o.playerId, hitStop: 60, freeze: 45
      });
    });

    // The wave rides the server's crescent_wave projectile (same position as the hits)
    const wave = new THREE.Group();
    wave.rotation.y = Math.PI / 2 - f;
    this.group.add(wave);
    const waveRoll = new THREE.Group();
    wave.add(waveRoll);
    const layers = [
      { color: C.paint, blend: 'normal', opacity: 0.45, s: 2.3, back: -0.45 },
      { color: C.outline, blend: 'normal', opacity: 0.85, s: 2.6, back: -0.05 },
      { color: C.paint, blend: 'normal', opacity: 0.97, s: 2.45, back: 0 },
      { color: C.white, k: 1.05, s: 2.05, back: 0.03 },
      { color: C.white, k: 1.8, s: 2.25, back: 0.04, hot: true }
    ].map((L) => {
      const m = this.quad(waveRoll, 'crescent', L.color, L.k ?? 1, { blend: L.blend, opacity: L.opacity ?? 1 });
      m.rotation.y = -Math.PI / 2;
      m.scale.set(L.s, L.s, 1);
      m.position.set(0, 0.15, -0.8 + L.back);
      m.userData.base = L.opacity ?? 1;
      m.userData.hot = !!L.hot;
      return m;
    });

    // Carved light line on the floor from the knight to the wave
    const lineRoot = new THREE.Group();
    lineRoot.position.set(ox + dx * 0.8, this.ground(ox, oy, oz) + 0.035, oz + dz * 0.8);
    lineRoot.rotation.y = -f;
    this.group.add(lineRoot);
    const lineBack = this.quad(lineRoot, 'streak', C.paint, 1, { blend: 'normal', opacity: 0.7 });
    const line = this.quad(lineRoot, 'streak', C.white, 1.0);
    for (const m of [lineBack, line]) m.rotation.x = -Math.PI / 2;
    line.position.y = 0.01;

    const start = { x: ox + dx * 1.2, y: oy + 1.0, z: oz + dz * 1.2 };
    const st = { boundId: null, lost: false, endAge: -1, born: -1, last: new THREE.Vector3(start.x, start.y, start.z), shedT: 0 };
    const we = this.effect({ x: 0, y: 0, z: 0 }, 2.0, (dt, age) => {
      if (st.boundId === null && !st.lost) {
        const px = start.x + dx * 16 * age, pz = start.z + dz * 16 * age;
        for (const [id, p] of this.getProjectiles() || []) {
          if (this.boundProjectiles.has(id) || p.last?.type !== 'crescent_wave') continue;
          if (Math.hypot(p.obj.position.x - px, p.obj.position.z - pz) < 4) {
            st.boundId = id;
            this.boundProjectiles.add(id);
            break;
          }
        }
      }
      let alive;
      if (st.boundId !== null) {
        const p = this.getProjectiles()?.get(st.boundId);
        alive = !!p;
        if (p) st.last.copy(p.obj.position);
      } else {
        alive = age < 0.9;
        st.last.set(start.x + dx * 16 * age, start.y, start.z + dz * 16 * age);
        if (age > 0.35) st.lost = true;
      }
      if (!alive && st.endAge < 0) {
        st.endAge = age;
        if (st.boundId !== null) this.boundProjectiles.delete(st.boundId);
        const p = st.last;
        this.impactBurst(p.x, p.y + 0.2, p.z, { color: C.paint, size: 1.7 });
        this.sparkBurst(p.x, p.y + 0.2, p.z, 12, { dir: f, cone: 1.1, speed: 11, color: C.gold });
      }
      wave.position.copy(st.last);
      this.faceCameraRoll(waveRoll);
      const inA = clamp01((age - 0.06) / 0.03);
      if (inA > 0 && st.born < 0) st.born = age;
      const outA = st.endAge < 0 ? 1 : 1 - easeIn((age - st.endAge) / 0.1);
      const a = inA * outA;
      const hotA = st.born < 0 ? 0 : 1 - easeOut((age - st.born) / 0.12);
      for (const m of layers) m.material.opacity = m.userData.hot ? hotA * a : m.userData.base * a;

      // Floor line stretches behind the wave, then fades quickly after it is gone
      const len = Math.max(0.1, Math.hypot(st.last.x - lineRoot.position.x, st.last.z - lineRoot.position.z) - 0.4);
      for (const m of [lineBack, line]) {
        m.scale.set(len, 0.5, 1);
        m.position.x = len / 2;
      }
      const la = inA * (st.endAge < 0 ? 1 : 1 - easeIn((age - st.endAge) / 0.3));
      line.material.opacity = la;
      lineBack.material.opacity = 0.7 * la;

      // Sparks shear off the blade edge and fall (no floating motes)
      if (a > 0.3 && st.endAge < 0) {
        st.shedT -= dt;
        while (st.shedT <= 0) {
          st.shedT += 0.035;
          const th = rand(-1.15, 1.15);
          const fwd = 0.3 * Math.cos(th) - 0.05;
          const up = 0.95 * Math.sin(th) + 0.15;
          this.sparkBurst(st.last.x + dx * fwd, st.last.y + up, st.last.z + dz * fwd, 1, {
            dir: f + Math.PI, cone: 0.6, speed: 7, speedMin: 3, elMin: -0.2, elMax: 0.5, life: 0.3, color: C.gold
          });
        }
      }
      if (st.endAge >= 0 && age - st.endAge > 0.35) we.age = we.duration;
    });
    we.extra = [wave, lineRoot];
    we.hitTest = (x, y, z) => (st.endAge < 0 && st.born >= 0 && Math.hypot(x - st.last.x, z - st.last.z) < 2.4)
      ? { color: C.paint, spark: C.gold, dir: f, slash: true } : null;
  }

  // ------------------------------------------------------------------ 2. Aegis Fortress
  aegis(o) {
    const e = this.effect(o, 0.9, null, { follow: true });
    const R = 3.8;
    const outer = this.decalPair(e.root, 'circle', C.white, 0.6, C.navy, 0.7, C.blue, 0.9);
    const inner = this.decalPair(e.root, 'circle', C.white, 0.85, C.outline, 0.55, C.paint, 0.85);
    const shock = this.decalPair(e.root, 'shock', C.white, 0.8, C.navy, 0.45, C.blue, 0.6);
    e.groundPairs = [[outer, 0], [inner, 0.004], [shock, 0.008]];

    // Hex barrier dome: painted blue cage + white highlight + glassy fill + white pop flash
    const shell = new THREE.Mesh(this.geo.dome, this.mat(null, C.blue, 1, { blend: 'normal', opacity: 0.1 }));
    const domeBody = new THREE.Mesh(this.geo.dome, this.mat('hex', C.blue, 1, { blend: 'normal', opacity: 0.9 }));
    const dome = new THREE.Mesh(this.geo.dome, this.mat('hex', C.sky, 0.45));
    const domeHot = new THREE.Mesh(this.geo.dome, this.mat('hex', C.white, 1.3));
    shell.material.side = THREE.FrontSide;
    shell.renderOrder = 15;
    domeBody.renderOrder = 16;
    dome.renderOrder = 17;
    domeHot.renderOrder = 18;
    const domeParts = [shell, domeBody, dome, domeHot];
    e.root.add(...domeParts);
    e.groundMeshes = [...domeParts];

    // Light shards spike up round the rim
    const shards = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const s = this.spritePair(e.root, 'shaft', i % 2 ? C.blue : C.paint, C.white, 1.0, { anchorBottom: true, bodyOpacity: 0.85, bodyScale: 1.5 });
      s.place(Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55);
      s.delay = 0.05 + (i % 5) * 0.012;
      e.groundMeshes.push(s.body, s.glow);
      shards.push(s);
    }

    this.fx.later(0.05, () => {
      const p = e.root.position;
      this.slamImpact(p.x, p.y, p.z, {
        color: C.blue, groundStar: 2.6, crack: 2.8, glow: C.blue, dust: 12, dustSpeed: 7, debris: 8, sparks: 18,
        sparkOpts: { color: C.sky, speed: 12, elMin: 0.05, elMax: 0.55 },
        shake: 7, punch: 1.1, playerId: o.playerId, hitStop: 90, freeze: 70
      });
    });
    e.tick = (dt, age) => {
      outer.set(3.6 * stamp(age, 0.05, 0.1, 0.25), env(age, 0.05, 0.015, 0.5, 0.25), -age * 0.5);
      inner.set(1.9 * stamp(age, 0.05, 0.1), env(age, 0.05, 0.015, 0.45, 0.25), age * 1.6);
      const sk = clamp01((age - 0.05) / 0.18);
      shock.set(0.8 + R * 2 * easeOut(sk), sk > 0 && sk < 1 ? 0.8 * Math.sqrt(1 - sk) : 0);
      const pop = easeOutBack((age - 0.05) / 0.09) * 0.62;
      const da = env(age, 0.05, 0.02, 0.42, 0.18);
      const swell = 1 + 0.08 * clamp01((age - 0.42) / 0.18);
      for (const m of domeParts) m.scale.set((0.4 + 2.0 * pop) * swell, (0.3 + 1.9 * pop) * swell, (0.4 + 2.0 * pop) * swell);
      shell.material.opacity = 0.1 * da;
      domeBody.material.opacity = 0.9 * da;
      dome.material.opacity = da;
      domeHot.material.opacity = env(age, 0.05, 0.01, 0.07, 0.06);
      dome.material.map.offset.x = age * 0.05;
      for (const s of shards) {
        const k = easeOut((age - s.delay) / 0.06);
        s.set(0.32, 1.9 * k, env(age, s.delay, 0.01, s.delay + 0.1, 0.14));
      }
    };
    e.hitTest = (x, y, z, age) => (age < 0.35 && Math.hypot(x - e.root.position.x, z - e.root.position.z) < R + 0.8)
      ? { color: C.blue, spark: C.sky } : null;
    // Super Armor aura on the caster for as long as the server keeps the buff
    if (o.playerId) {
      const old = this.auras.get(o.playerId);
      if (old) old.age = 0;
      else this.auras.set(o.playerId, { age: 0, root: null });
    }
  }

  updateAura(id, aura, pl, dt) {
    aura.age += dt;
    const on = pl && pl.state !== 'dead' && (pl.buffs?.superArmor || aura.age < 0.4) && aura.age < 6;
    if (!on) {
      if (aura.root) this.dispose(aura.root);
      this.auras.delete(id);
      return;
    }
    if (!aura.root) {
      aura.root = new THREE.Group();
      this.group.add(aura.root);
      aura.ring = this.decalPair(aura.root, 'circle', C.white, 0.8, C.outline, 0.45, C.paint, 0.7);
      aura.ring.back.position.y = 0.035;
      aura.ring.body.position.y = 0.04;
      aura.ring.front.position.y = 0.045;
    }
    aura.root.position.set(pl.x, this.ground(pl.x, pl.y, pl.z), pl.z);
    const a = Math.min(1, aura.age / 0.3) * (0.6 + 0.15 * Math.sin(aura.age * 6));
    aura.ring.set(1.4, a, aura.age * 0.9);
  }

  // ------------------------------------------------------------------ 3. Lionheart Warcry
  lionheart(o) {
    const e = this.effect(o, 1.0, null, { follow: true });
    const R = 4.3;
    const emblem = this.decalPair(e.root, 'sunburst', C.white, 0.5, C.outline, 0.8, C.paint, 0.95);
    const circle = this.decalPair(e.root, 'circle', C.white, 0.9, C.outline, 0.55, C.gold, 0.7);
    e.groundPairs = [[emblem, 0], [circle, 0.004]];

    // Pillar of light slamming down from the sky onto the knight
    const pillar = this.spritePair(e.root, 'shaft', C.paint, C.white, 1.1, { anchorBottom: true, bodyOpacity: 0.85, bodyScale: 1.5 });
    e.groundMeshes = [pillar.body, pillar.glow];

    // Roar: thick rings at chest height racing out to the stun radius
    const rings = [0.09, 0.15, 0.21].map((delay) => {
      const holder = new THREE.Group();
      holder.position.y = 1.0;
      e.root.add(holder);
      const pair = this.decalPair(holder, 'shock', C.white, 0.8, C.outline, 0.45, C.paint, 0.7);
      pair.delay = delay;
      return pair;
    });

    // Heal crosses pop up and shoot upward
    const crosses = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(-0.2, 0.2);
      const r = rand(0.45, 0.9);
      const cross = this.spritePair(e.root, 'cross', C.healBody, C.white, 0.55, { bodyOpacity: 0.95, bodyScale: 1 });
      const outline = this.sprite(e.root, 'cross', C.healDark, 1, { blend: 'normal', opacity: 0.75 });
      outline.renderOrder = 18;
      const start = new THREE.Vector3(Math.cos(a) * r, rand(0.2, 1.0), Math.sin(a) * r);
      crosses.push({ cross, outline, start, delay: 0.18 + rand(0, 0.2), size: rand(0.26, 0.36) });
    }

    this.fx.later(0.08, () => {
      const p = e.root.position;
      this.slamImpact(p.x, p.y, p.z, {
        color: C.paint, groundStar: 2.4, crack: 2.6, glow: C.paint, dust: 10, dustSpeed: 7, debris: 6, sparks: 18,
        sparkOpts: { color: C.gold, speed: 14, elMin: -0.05, elMax: 0.25, gravity: -6 },
        shake: 6, punch: 1, playerId: o.playerId, hitStop: 70, freeze: 60
      });
    });
    e.tick = (dt, age) => {
      const drop = easeIn((age - 0.02) / 0.06);
      const narrow = age < 0.3 ? 1 : 1 - easeIn((age - 0.3) / 0.22);
      pillar.set(0.85 * narrow, 7 * drop, env(age, 0.02, 0.02, 0.3, 0.22));
      emblem.set(3.4 * stamp(age, 0.08, 0.1, 0.3), env(age, 0.08, 0.015, 0.6, 0.3), age * 0.4);
      circle.set(1.6 * stamp(age, 0.06, 0.1), env(age, 0.06, 0.02, 0.55, 0.3), -age * 0.9);
      for (const r of rings) {
        const k = clamp01((age - r.delay) / 0.22);
        r.set(0.6 + R * 2 * easeOut(k), k > 0 && k < 1 ? 1 - k : 0);
      }
      for (const c of crosses) {
        const t = age - c.delay;
        const a = env(age, c.delay, 0.02, c.delay + 0.3, 0.2);
        const pop = c.size * (1 + 0.45 * (1 - easeOut(t / 0.08)));
        const y = c.start.y + Math.max(0, t) * 2.6;
        c.cross.place(c.start.x, y, c.start.z);
        c.outline.position.set(c.start.x, y, c.start.z);
        c.cross.set(pop, pop, a);
        c.cross.glow.scale.setScalar(pop * 0.55);
        c.outline.scale.setScalar(pop * 1.25);
        c.outline.material.opacity = 0.75 * a;
      }
    };
    e.hitTest = (x, y, z, age) => (age < 0.45 && Math.hypot(x - e.root.position.x, z - e.root.position.z) < R + 0.8)
      ? { color: C.paint, spark: C.gold } : null;
  }

  // ------------------------------------------------------------------ 4. Chariot Rush
  chariot(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);

    // Launch blast stays where the charge started
    const mark = this.effect(o, 0.5, null);
    const startCircle = this.decalPair(mark.root, 'circle', C.white, 0.9, C.navy, 0.6, C.blue, 0.85);
    const startShock = this.decalPair(mark.root, 'shock', C.white, 1.0, C.navy, 0.45, C.blue, 0.7);
    mark.groundPairs = [[startCircle, 0], [startShock, 0.004]];
    mark.tick = (dt, age) => {
      startCircle.set(1.5 * stamp(age, 0, 0.08), env(age, 0, 0.015, 0.2, 0.2), age * 1.5);
      const k = clamp01(age / 0.18);
      startShock.set(0.5 + 2.4 * easeOut(k), k < 1 ? 0.8 * Math.sqrt(1 - k) : 0);
    };
    this.slamImpact(o.x - dx * 0.5, o.y, o.z - dz * 0.5, {
      color: C.blue, groundStar: 1.9, lift: 0.5, dust: 10, dustSpeed: 7, debris: 4, sparks: 12,
      sparkOpts: { dir: f + Math.PI, cone: 0.8, speed: 11, color: C.sky, elMin: 0, elMax: 0.5 },
      shake: 4, punch: 0.6, freeze: 30
    });

    // Shield crest ram + bow wave travel with the knight
    const e = this.effect(o, 0.6, null, { follow: true });
    const crestLayers = [
      [C.navy, 1, 'normal', 0.8, 1.25, 0.84],
      [C.blue, 1, 'normal', 0.92, 1.15, 0.86],
      [C.white, 0.55, 'add', 1, 1.15, 0.88],
      [C.white, 1.6, 'add', 1, 1.22, 0.9]
    ].map(([col, k, blend, op, s, z]) => {
      const m = this.quad(e.root, 'crest', col, k, { blend, opacity: op });
      m.position.set(0, 0.9, z);
      m.userData.op = op;
      m.userData.s = s;
      return m;
    });
    const crestHot = crestLayers[3];
    const bows = [0.5].map((h) => {
      const holder = new THREE.Group();
      holder.position.set(0, h, 0.15);
      e.root.add(holder);
      return this.decalPair(holder, 'crescent', C.white, 0.55, C.navy, 0.6, C.blue, 0.85);
    });

    // Floor trail + speed lines left behind in world space
    const trailRoot = new THREE.Group();
    trailRoot.position.set(o.x, this.ground(o.x, o.y, o.z) + 0.035, o.z);
    trailRoot.rotation.y = -f;
    this.group.add(trailRoot);
    const trailBack = this.quad(trailRoot, 'streak', C.blue, 1, { blend: 'normal', opacity: 0.65 });
    const trail = this.quad(trailRoot, 'streak', C.white, 0.9);
    for (const m of [trailBack, trail]) m.rotation.x = -Math.PI / 2;
    trail.position.y = 0.01;
    const streaks = [];
    let streakT = 0, ended = false;
    e.extra = [trailRoot];

    e.tick = (dt, age) => {
      const a = env(age, 0, 0.02, 0.42, 0.12);
      const pulse = 1 + 0.07 * Math.sin(age * 45);
      for (const m of crestLayers) {
        m.scale.set(m.userData.s * pulse, m.userData.s * pulse, 1);
        m.material.opacity = m.userData.op * a;
      }
      crestHot.material.opacity = env(age, 0, 0.01, 0.05, 0.08);
      for (const b of bows) b.set(1.7 + 0.2 * Math.sin(age * 34), a * 0.9);

      const p = e.root.position;
      const len = Math.max(0.1, Math.hypot(p.x - trailRoot.position.x, p.z - trailRoot.position.z));
      for (const m of [trailBack, trail]) {
        m.scale.set(len, 0.7, 1);
        m.position.x = len / 2;
      }
      const ta = age < 0.42 ? 1 : 1 - easeIn((age - 0.42) / 0.18);
      trail.material.opacity = ta;
      trailBack.material.opacity = 0.65 * ta;

      // Speed lines streaming past the body
      streakT -= dt;
      if (a > 0.5 && streakT <= 0) {
        streakT = 0.025;
        for (let i = 0; i < 2; i++) {
          const holder = new THREE.Group();
          const side = (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 0.85);
          holder.position.set(p.x - dz * side - dx * 0.3, p.y + rand(0.25, 1.8), p.z + dx * side - dz * 0.3);
          holder.rotation.y = -f;
          this.group.add(holder);
          const m = this.quad(holder, 'needle', Math.random() < 0.4 ? C.white : C.blue, 1, { blend: 'normal', opacity: 0.9 });
          m.rotation.x = Math.PI / 2 * Math.round(Math.random());
          m.scale.set(rand(1.1, 1.8), 0.08, 1);
          m.position.x = -m.scale.x / 2;
          streaks.push({ holder, m, age: 0 });
        }
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.age += dt;
        s.m.material.opacity = 0.9 * (1 - easeIn(s.age / 0.14));
        if (s.age > 0.14) {
          this.dispose(s.holder);
          streaks.splice(i, 1);
        }
      }
      if (age > 0.42 && !ended) {
        ended = true;
        this.dustRing(p.x + dx * 0.5, p.y, p.z + dz * 0.5, 8, 4);
        this.sparkBurst(p.x + dx * 0.8, p.y + 0.9, p.z + dz * 0.8, 8, { dir: f, cone: 1.0, speed: 9, color: C.sky });
      }
      if (age >= 0.59) for (const s of streaks.splice(0)) this.dispose(s.holder);
    };
    e.hitTest = (x, y, z, age) => (age < 0.5 && Math.hypot(x - e.root.position.x, z - e.root.position.z) < 3.2)
      ? { color: C.blue, spark: C.sky, dir: f } : null;
  }

  // ------------------------------------------------------------------ frame update
  update(dt, state) {
    // Impact frames: the knight VFX clock nearly stops for a few frames on contact
    const edt = performance.now() < this.freezeUntil ? dt * 0.06 : dt;
    const players = new Map();
    if (state?.players) for (const p of state.players) players.set(p.id, p);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += edt;
      if (e.age >= e.duration) {
        this.dispose(e.root);
        if (e.extra) for (const x of e.extra) this.dispose(x);
        this.effects.splice(i, 1);
        continue;
      }
      const pl = e.playerId ? players.get(e.playerId) : null;
      if (e.follow && pl && pl.state !== 'dead') {
        e.root.position.set(pl.x, pl.y, pl.z);
        e.gy = this.ground(pl.x, pl.y, pl.z) - pl.y + 0.03;
      }
      if (e.groundPairs) {
        for (const [pair, lift] of e.groundPairs) {
          pair.back.position.y = e.gy;
          if (pair.body) pair.body.position.y = e.gy + 0.006 + lift;
          pair.front.position.y = e.gy + 0.012 + lift;
        }
      }
      if (e.groundMeshes) for (const m of e.groundMeshes) m.position.y = e.gy;
      if (e.tick) e.tick(edt, e.age, pl);
    }
    for (const [id, aura] of this.auras) this.updateAura(id, aura, players.get(id), dt);
    this.updateSparks(edt);
  }
}
