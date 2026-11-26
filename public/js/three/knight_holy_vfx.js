// ============================================================================
// Iron Knight gear skills - crisp Paladin-style holy VFX (Tree of Savior feel)
// Every bright additive shape sits on a darker normal-blended copy so it keeps
// its outline on the light arena floor instead of blooming into a blob.
//   knight_weapon  Excalibur Wave    vertical sword wave riding the server projectile
//   knight_armor   Aegis Fortress    sanctuary circle, hex barrier dome, light shards
//   knight_helmet  Lionheart Warcry  sky pillar, sunburst emblem, roar rings, heal crosses
//   knight_trinket Chariot Rush      shield crest ram, bow wave, light trail
// ============================================================================
import * as THREE from 'three';
import { holyTextures } from './holy_textures.js';

const C = {
  white: '#fff7e2',
  paint: '#ffb02a',
  outline: '#3a1c00',
  gold: '#ffd46e',
  amber: '#f2a93b',
  shadow: '#4a2a05',
  sky: '#bfe7ff',
  steel: '#7fc6ff',
  navy: '#0f2a5c',
  heal: '#b6ffc8',
  healBody: '#4fdc7e',
  blue: '#3d97f0',
  healDark: '#0d5a26'
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x) => Math.pow(clamp01(x), 2);
const easeOutBack = (x) => {
  const k = clamp01(x) - 1;
  return 1 + 2.4 * k * k * k + 1.4 * k * k;
};
// 0 before t0, rises to 1 over fadeIn, holds until t1, falls to 0 over fadeOut
function env(age, t0, fadeIn, t1, fadeOut) {
  if (age < t0) return 0;
  if (age < t0 + fadeIn) return (age - t0) / Math.max(1e-4, fadeIn);
  if (age < t1) return 1;
  return clamp01(1 - (age - t1) / Math.max(1e-4, fadeOut));
}
const rand = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();
const _cam = new THREE.Vector3();

export class KnightHolyVFX {
  constructor({ scene, camera, fx, shake, floorY, getProjectiles }) {
    this.camera = camera;
    this.fx = fx;
    this.shake = shake || (() => {});
    this.floorY = floorY || (() => 0);
    this.getProjectiles = getProjectiles || (() => new Map());
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
    m.userData.baseOpacity = o.opacity ?? 1;
    parent.add(m);
    return m;
  }

  // Flat decal on the floor; texture +X maps to the parent's local +Z (forward)
  decal(parent, texKey, color, k, o = {}) {
    const m = this.quad(parent, texKey, color, k, o);
    m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    return m;
  }

  // Bright decal over a darker normal-blended copy (crisp on light floors)
  // bodyColor adds a painted (normal-blend) layer between the outline and the glow
  decalPair(parent, texKey, color, k, shadowColor = C.shadow, shadowOpacity = 0.5, bodyColor = null, bodyOpacity = 0.85) {
    const back = this.decal(parent, texKey, shadowColor, 1, { blend: 'normal', opacity: shadowOpacity });
    const body = bodyColor ? this.decal(parent, texKey, bodyColor, 1, { blend: 'normal', opacity: bodyOpacity }) : null;
    const front = this.decal(parent, texKey, color, k);
    if (body) body.position.y = 0.006;
    front.position.y = 0.012;
    return { back, body, front, set: (s, a, rotZ = 0) => {
      back.scale.set(s * 1.02, s * 1.02, 1);
      front.scale.set(s, s, 1);
      back.material.opacity = shadowOpacity * a;
      front.material.opacity = a;
      back.rotation.z = -Math.PI / 2 + rotZ;
      front.rotation.z = -Math.PI / 2 + rotZ;
      if (body) {
        body.scale.set(s, s, 1);
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

  // An effect owns a root group (world space) and a tick(dt, age) that animates it
  effect(o, duration, tick, { follow = false } = {}) {
    const root = new THREE.Group();
    root.position.set(o.x || 0, o.y || 0, o.z || 0);
    root.rotation.y = Math.PI / 2 - (o.facing || 0);
    this.group.add(root);
    const e = {
      root, age: 0, duration, tick, follow: follow && !!o.playerId, playerId: o.playerId || null,
      facing: o.facing || 0, gy: this.ground(o.x || 0, o.y || 0, o.z || 0) - (o.y || 0) + 0.03
    };
    this.effects.push(e);
    return e;
  }

  dispose(obj) {
    obj.removeFromParent();
    obj.traverse((n) => {
      if (n.material) n.material.dispose();
    });
  }

  spawn(effectId, o) {
    if (effectId === 'knight_weapon') this.excalibur(o);
    else if (effectId === 'knight_armor') this.aegis(o);
    else if (effectId === 'knight_helmet') this.lionheart(o);
    else if (effectId === 'knight_trinket') this.chariot(o);
    else return false;
    return true;
  }

  // ------------------------------------------------------------------ 1. Excalibur Wave
  excalibur(o) {
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);
    const ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
    const fx = this.fx;

    // Caster: sanctuary circle under the feet, a charge glint above the sword arm,
    // and a vertical swing arc from overhead into the ground
    const e = this.effect(o, 0.9, null);
    const circle = this.decalPair(e.root, 'circle', C.white, 0.9, C.outline, 0.7, C.paint, 0.85);
    e.groundPairs = [[circle, 0]];
    const glint = this.sprite(e.root, 'flare', C.white, 1.5);
    glint.position.set(-0.25, 2.25, -0.1);
    const swingRoll = new THREE.Group();
    swingRoll.position.set(0, 1.05, 0.15);
    e.root.add(swingRoll);
    const swingPivot = new THREE.Group();
    swingRoll.add(swingPivot);
    const swingBack = this.quad(swingPivot, 'crescent', C.outline, 1, { blend: 'normal', opacity: 0.7 });
    const swing = this.quad(swingPivot, 'crescent', C.paint, 1, { blend: 'normal', opacity: 0.9 });
    const swingCore = this.quad(swingPivot, 'crescent', C.white, 1.05);
    for (const m of [swingBack, swing, swingCore]) {
      m.rotation.y = -Math.PI / 2;
      m.position.z = -0.35;
    }
    swingBack.scale.set(2.8, 2.8, 1);
    swing.scale.set(2.65, 2.65, 1);
    swingCore.scale.set(2.35, 2.35, 1);
    e.tick = (dt, age) => {
      this.faceCameraRoll(swingRoll);
      circle.set(1.2 + 2.0 * easeOut(age / 0.14), env(age, 0, 0.05, 0.45, 0.35), age * 0.7);
      const g = env(age, 0, 0.06, 0.1, 0.12);
      glint.scale.setScalar(0.4 + 1.6 * g);
      glint.material.opacity = g;
      glint.material.rotation = age * 3;
      // Sweep from overhead (tipped back) to the ground in front
      const sw = easeOut((age - 0.07) / 0.12);
      swingPivot.rotation.x = -1.35 + 1.6 * sw;
      const sa = env(age, 0.07, 0.03, 0.2, 0.14);
      swingBack.material.opacity = 0.7 * sa;
      swing.material.opacity = 0.9 * sa;
      swingCore.material.opacity = sa;
    };
    fx.later(0.1, () => {
      this.shake(4);
      fx.dustPuff(ox + dx * 0.9, oy + 0.05, oz + dz * 0.9, 6, 1.1);
    });

    // The wave rides the server's crescent_wave projectile (same position as the hits)
    const wave = new THREE.Group();
    wave.rotation.y = Math.PI / 2 - f;
    this.group.add(wave);
    const waveRoll = new THREE.Group();
    wave.add(waveRoll);
    const layers = [
      { tex: 'crescent', color: C.paint, k: 1, blend: 'normal', opacity: 0.5, s: 3.35, back: -0.7 },
      { tex: 'crescent', color: C.paint, k: 1, blend: 'normal', opacity: 0.25, s: 3.15, back: -1.35 },
      { tex: 'crescent', color: C.outline, k: 1, blend: 'normal', opacity: 0.75, s: 3.8, back: -0.08 },
      { tex: 'crescent', color: C.paint, k: 1, blend: 'normal', opacity: 0.92, s: 3.6, back: 0 },
      { tex: 'crescent', color: C.gold, k: 0.9, s: 3.45, back: 0.02 },
      { tex: 'crescent', color: C.white, k: 1.15, s: 3.0, back: 0.05 }
    ].map((L) => {
      const m = this.quad(waveRoll, L.tex, L.color, L.k, { blend: L.blend, opacity: L.opacity ?? 1 });
      m.rotation.y = -Math.PI / 2;
      m.scale.set(L.s, L.s, 1);
      m.position.set(0, 0.3, -1.2 + L.back);
      m.userData.base = (L.opacity ?? 1) * (L.ghost ?? 1);
      return m;
    });
    const glow = this.sprite(waveRoll, 'glow', C.gold, 0.7);
    glow.position.set(0, 0.35, 0.1);
    glow.scale.set(2.2, 3.4, 1);

    // Carved light line on the floor from the knight to the wave
    const lineRoot = new THREE.Group();
    lineRoot.position.set(ox + dx * 0.8, this.ground(ox, oy, oz) + 0.035, oz + dz * 0.8);
    lineRoot.rotation.y = -f;
    this.group.add(lineRoot);
    const lineBack = this.quad(lineRoot, 'streak', C.paint, 1, { blend: 'normal', opacity: 0.6 });
    const line = this.quad(lineRoot, 'streak', C.white, 0.95);
    for (const m of [lineBack, line]) m.rotation.x = -Math.PI / 2;
    line.position.y = 0.01;

    const start = { x: ox + dx * 1.2, y: oy + 1.0, z: oz + dz * 1.2 };
    const st = { boundId: null, lost: false, endAge: -1, last: new THREE.Vector3(start.x, start.y, start.z), sparkT: 0 };
    const we = this.effect({ x: 0, y: 0, z: 0 }, 2.2, (dt, age) => {
      // Bind to the matching projectile once the renderer has it
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
        fx.flash(p.x, p.y + 0.3, p.z, C.gold, 2.6, 0.22);
        fx.sparks(p.x, p.y + 0.3, p.z, 14, C.gold, { speed: 6, gravity: -6, tile: 'star', white: 0.5 });
      }
      wave.position.copy(st.last);
      this.faceCameraRoll(waveRoll);
      const inA = clamp01((age - 0.05) / 0.07);
      const outA = st.endAge < 0 ? 1 : clamp01(1 - (age - st.endAge) / 0.16);
      const a = inA * outA;
      const grow = 0.75 + 0.25 * easeOut((age - 0.05) / 0.12);
      for (const m of layers) {
        m.material.opacity = m.userData.base * a;
        m.scale.y = Math.abs(m.scale.x) * grow;
      }
      glow.material.opacity = 0.55 * a;

      // Floor line stretches behind the wave, then fades after it is gone
      const len = Math.max(0.1, Math.hypot(st.last.x - lineRoot.position.x, st.last.z - lineRoot.position.z) - 0.4);
      for (const m of [lineBack, line]) {
        m.scale.set(len, 1.1, 1);
        m.position.x = len / 2;
      }
      const la = inA * (st.endAge < 0 ? 1 : clamp01(1 - (age - st.endAge) / 0.55));
      line.material.opacity = la;
      lineBack.material.opacity = 0.6 * la;

      // Shed sparkles and a few white feathers along the blade edge
      if (a > 0.3) {
        st.sparkT -= dt;
        while (st.sparkT <= 0) {
          st.sparkT += 0.012;
          const th = rand(-1.15, 1.15);
          const fwd = 0.4 * Math.cos(th) - 0.1;
          const up = 1.4 * Math.sin(th) + 0.3;
          const sx = st.last.x + dx * fwd, sz = st.last.z + dz * fwd, sy = st.last.y + up;
          fx.add.spawn({
            x: sx, y: sy, z: sz, vx: -dx * rand(1, 3), vy: rand(0.3, 1.6), vz: -dz * rand(1, 3),
            color: Math.random() < 0.4 ? C.white : C.gold, intensity: 1.3, size: rand(0.22, 0.42), sizeEnd: 0.02,
            life: rand(0.35, 0.65), drag: 2.2, gravity: -1.5, tile: 'star', spin: rand(-4, 4)
          });
          if (Math.random() < 0.12) {
            fx.norm.spawn({
              x: sx, y: sy, z: sz, vx: -dx * rand(0.4, 1.2), vy: rand(0.2, 0.8), vz: -dz * rand(0.4, 1.2),
              color: '#fffdf4', size: rand(0.22, 0.34), sizeEnd: 0.12, life: rand(0.7, 1.1), alpha: 0.95,
              drag: 1.6, gravity: -0.8, tile: 'petal', spin: rand(-3, 3)
            });
          }
        }
      }
      if (st.endAge >= 0 && age - st.endAge > 0.6) we.age = we.duration;
    });
    we.extra = [wave, lineRoot];
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

  // ------------------------------------------------------------------ 2. Aegis Fortress
  aegis(o) {
    const fx = this.fx;
    const e = this.effect(o, 1.25, null, { follow: true });
    const R = 3.8;
    const outer = this.decalPair(e.root, 'circle', C.white, 0.9, C.navy, 0.65, C.blue, 0.85);
    const inner = this.decalPair(e.root, 'circle', C.white, 0.85, C.outline, 0.55, C.paint, 0.85);
    const shock = this.decalPair(e.root, 'shock', C.white, 0.9, C.navy, 0.4, C.blue, 0.6);
    e.groundPairs = [[outer, 0], [inner, 0.004], [shock, 0.008]];

    // Hex barrier dome: painted blue cage + white highlight + faint glassy fill
    const domeBody = new THREE.Mesh(this.geo.dome, this.mat('hex', C.blue, 1, { blend: 'normal', opacity: 0.75 }));
    const dome = new THREE.Mesh(this.geo.dome, this.mat('hex', C.sky, 0.85));
    const shell = new THREE.Mesh(this.geo.dome, this.mat(null, C.blue, 1, { blend: 'normal', opacity: 0.12 }));
    shell.material.side = THREE.FrontSide;
    shell.renderOrder = 15;
    domeBody.renderOrder = 16;
    dome.renderOrder = 17;
    e.root.add(shell, domeBody, dome);
    e.groundMeshes = [shell, domeBody, dome];

    // Light shards rising round the rim
    const shards = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = this.spritePair(e.root, 'shaft', i % 2 ? C.blue : C.paint, C.white, 1.0, { anchorBottom: true, bodyOpacity: 0.75, bodyScale: 1.6 });
      s.place(Math.cos(a) * R * 0.92, 0, Math.sin(a) * R * 0.92);
      s.delay = 0.08 + (i % 5) * 0.02;
      e.groundMeshes.push(s.body, s.glow);
      shards.push(s);
    }
    const core = this.sprite(e.root, 'flare', C.white, 1.4);
    core.position.set(0, 1.0, 0.2);

    fx.later(0.08, () => {
      this.shake(6);
      const p = e.root.position;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        fx.dustPuff(p.x + Math.cos(a) * 1.1, p.y + 0.05, p.z + Math.sin(a) * 1.1, 1, 1.2);
      }
    });
    let moteT = 0;
    e.tick = (dt, age) => {
      outer.set(1.0 + (R * 2 - 1.0) * easeOut((age - 0.05) / 0.18), env(age, 0.05, 0.04, 0.75, 0.4), -age * 0.5);
      inner.set(1.8 + 1.6 * easeOut((age - 0.05) / 0.2), env(age, 0.06, 0.05, 0.7, 0.4), age * 1.1);
      const sk = clamp01((age - 0.07) / 0.28);
      shock.set(0.5 + R * 2 * easeOut(sk), sk > 0 && sk < 1 ? 1 - sk : 0);
      const pop = easeOutBack((age - 0.07) / 0.18);
      const da = env(age, 0.07, 0.04, 0.6, 0.45);
      for (const m of [shell, domeBody, dome]) m.scale.set(0.4 + 2.0 * pop, 0.3 + 1.9 * pop, 0.4 + 2.0 * pop);
      const flashK = 1 + 0.8 * Math.max(0, 1 - (age - 0.12) / 0.15);
      dome.material.opacity = da * flashK;
      domeBody.material.opacity = 0.75 * da;
      shell.material.opacity = 0.12 * da;
      dome.material.map.offset.x = age * 0.05;
      for (const s of shards) {
        const k = easeOut((age - s.delay) / 0.14);
        s.set(0.5, 3.0 * k, env(age, s.delay, 0.04, 0.4, 0.3));
      }
      const ca = env(age, 0.06, 0.03, 0.1, 0.2);
      core.scale.setScalar(0.5 + 2.4 * ca);
      core.material.opacity = ca;
      moteT -= dt;
      if (age > 0.1 && age < 0.8 && moteT <= 0) {
        moteT = 0.025;
        const a = rand(0, Math.PI * 2), r = rand(0.6, 2.3);
        const p = e.root.position;
        fx.add.spawn({
          x: p.x + Math.cos(a) * r, y: p.y + rand(0.1, 1.8), z: p.z + Math.sin(a) * r, vy: rand(0.8, 2.0),
          color: Math.random() < 0.5 ? C.sky : C.gold, intensity: 1.2, size: rand(0.2, 0.36), sizeEnd: 0.02,
          life: rand(0.5, 0.9), drag: 1.2, tile: 'star', spin: rand(-3, 3)
        });
      }
    };
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
      aura.t = 0;
    }
    aura.root.position.set(pl.x, this.ground(pl.x, pl.y, pl.z), pl.z);
    const a = Math.min(1, aura.age / 0.4) * (0.6 + 0.15 * Math.sin(aura.age * 6));
    aura.ring.set(1.9, a, aura.age * 0.9);
    aura.t -= dt;
    if (aura.t <= 0) {
      aura.t = 0.12;
      const ang = rand(0, Math.PI * 2);
      this.fx.add.spawn({
        x: pl.x + Math.cos(ang) * 0.75, y: pl.y + rand(0.1, 0.5), z: pl.z + Math.sin(ang) * 0.75, vy: rand(1.2, 2),
        color: C.gold, intensity: 1.1, size: rand(0.16, 0.26), sizeEnd: 0.02, life: 0.6, drag: 1, tile: 'star'
      });
    }
  }

  // ------------------------------------------------------------------ 3. Lionheart Warcry
  lionheart(o) {
    const fx = this.fx;
    const e = this.effect(o, 1.5, null, { follow: true });
    const R = 4.3;
    const emblem = this.decalPair(e.root, 'sunburst', C.white, 0.5, C.outline, 0.8, C.paint, 0.95);
    const circle = this.decalPair(e.root, 'circle', C.white, 0.9, C.outline, 0.55, C.gold, 0.7);
    e.groundPairs = [[emblem, 0], [circle, 0.004]];

    // Pillar of light dropping from the sky onto the knight
    const pillar = this.spritePair(e.root, 'shaft', C.paint, C.white, 1.15, { anchorBottom: true, bodyOpacity: 0.6, bodyScale: 1.7 });
    e.groundMeshes = [pillar.body, pillar.glow];

    // Roar: rings at chest height expanding to the stun radius
    const rings = [0.12, 0.22, 0.32].map((delay) => {
      const holder = new THREE.Group();
      holder.position.y = 1.0;
      e.root.add(holder);
      const pair = this.decalPair(holder, 'shock', C.white, 0.9, C.outline, 0.4, C.paint, 0.7);
      pair.delay = delay;
      return pair;
    });
    const burst = this.sprite(e.root, 'flare', C.white, 1.5);
    burst.position.set(0, 1.9, 0);

    // Heal crosses rising around the knight
    const crosses = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand(-0.2, 0.2);
      const r = rand(0.5, 1.2);
      const cross = this.spritePair(e.root, 'cross', C.healBody, C.white, 0.55, { bodyOpacity: 0.95, bodyScale: 1 });
      const outline = this.sprite(e.root, 'cross', C.healDark, 1, { blend: 'normal', opacity: 0.7 });
      outline.renderOrder = 18;
      const start = new THREE.Vector3(Math.cos(a) * r, rand(0.1, 0.9), Math.sin(a) * r);
      crosses.push({ cross, outline, start, delay: 0.25 + rand(0, 0.35), size: rand(0.34, 0.5) });
    }

    fx.later(0.12, () => {
      this.shake(5);
      const p = e.root.position;
      fx.sparks(p.x, p.y + 1.2, p.z, 22, C.gold, { speed: 9, gravity: -5, tile: 'star', white: 0.4, elMin: -0.1, elMax: 0.5 });
    });
    let moteT = 0;
    e.tick = (dt, age) => {
      emblem.set(1.5 + (R * 2 - 1.5) * easeOut((age - 0.1) / 0.22), env(age, 0.1, 0.05, 0.85, 0.5), age * 0.35);
      circle.set(1.2 + 1.4 * easeOut((age - 0.06) / 0.18), env(age, 0.06, 0.05, 0.9, 0.45), -age * 0.8);
      // Beam: reaches the ground at ~0.14 s, holds, then thins out
      const drop = easeIn((age - 0.04) / 0.1);
      const thin = 1 - 0.6 * clamp01((age - 0.55) / 0.4);
      pillar.set(1.5 * thin, 11 * drop, env(age, 0.04, 0.05, 0.55, 0.4));
      for (const r of rings) {
        const k = clamp01((age - r.delay) / 0.38);
        r.set(0.6 + R * 2 * easeOut(k), k > 0 && k < 1 ? 1 - k : 0);
      }
      const ba = env(age, 0.11, 0.03, 0.16, 0.25);
      burst.scale.setScalar(0.6 + 3.0 * ba);
      burst.material.opacity = ba;
      for (const c of crosses) {
        const t = age - c.delay;
        const a = env(age, c.delay, 0.1, c.delay + 0.55, 0.35);
        const y = c.start.y + Math.max(0, t) * 1.5;
        c.cross.place(c.start.x, y, c.start.z);
        c.outline.position.set(c.start.x, y, c.start.z);
        c.cross.set(c.size, c.size, a);
        c.cross.glow.scale.setScalar(c.size * 0.55);
        c.outline.scale.setScalar(c.size * 1.25);
        c.outline.material.opacity = 0.7 * a;
      }
      moteT -= dt;
      if (age > 0.12 && age < 0.9 && moteT <= 0) {
        moteT = 0.02;
        const a = rand(0, Math.PI * 2), r = rand(0, 0.9);
        const p = e.root.position;
        fx.add.spawn({
          x: p.x + Math.cos(a) * r, y: p.y + rand(0, 2.5), z: p.z + Math.sin(a) * r, vy: rand(1.5, 3.5),
          color: Math.random() < 0.6 ? C.white : C.gold, intensity: 1.2, size: rand(0.18, 0.34), sizeEnd: 0.02,
          life: rand(0.4, 0.8), drag: 1, tile: 'star', spin: rand(-3, 3)
        });
      }
    };
  }

  // ------------------------------------------------------------------ 4. Chariot Rush
  chariot(o) {
    const fx = this.fx;
    const f = o.facing || 0;
    const dx = Math.cos(f), dz = Math.sin(f);

    // Launch mark stays where the charge started
    const mark = this.effect(o, 0.6, null);
    const startCircle = this.decalPair(mark.root, 'circle', C.white, 0.9, C.navy, 0.6, C.blue, 0.85);
    const startShock = this.decalPair(mark.root, 'shock', C.white, 0.9, C.navy, 0.35, C.blue, 0.6);
    mark.groundPairs = [[startCircle, 0], [startShock, 0.004]];
    mark.tick = (dt, age) => {
      startCircle.set(1.0 + 1.4 * easeOut(age / 0.12), env(age, 0, 0.03, 0.25, 0.3), age * 1.5);
      const k = clamp01(age / 0.3);
      startShock.set(0.5 + 3.4 * easeOut(k), 1 - k);
    };
    fx.dustPuff(o.x - dx * 0.3, o.y + 0.05, o.z - dz * 0.3, 8, 1.3);

    // Shield crest ram + bow wave travel with the knight
    const e = this.effect(o, 0.78, null, { follow: true });
    const crestBack = this.quad(e.root, 'crest', C.navy, 1, { blend: 'normal', opacity: 0.7 });
    const crestBody = this.quad(e.root, 'crest', C.blue, 1, { blend: 'normal', opacity: 0.85 });
    const crest = this.quad(e.root, 'crest', C.white, 0.6);
    crestBack.position.set(0, 1.0, 0.94);
    crestBody.position.set(0, 1.0, 0.96);
    crest.position.set(0, 1.0, 0.98);
    const bows = [0.45, 1.25].map((h) => {
      const holder = new THREE.Group();
      holder.position.set(0, h, 0.2);
      e.root.add(holder);
      return this.decalPair(holder, 'crescent', C.white, 0.55, C.navy, 0.6, C.blue, 0.85);
    });
    const shine = this.sprite(e.root, 'flare', C.white, 1.4);
    shine.position.set(0, 1.05, 1.1);

    // Floor trail + speed streaks left behind in world space
    const trailRoot = new THREE.Group();
    trailRoot.position.set(o.x, this.ground(o.x, o.y, o.z) + 0.035, o.z);
    trailRoot.rotation.y = -f;
    this.group.add(trailRoot);
    const trailBack = this.quad(trailRoot, 'streak', C.blue, 1, { blend: 'normal', opacity: 0.6 });
    const trail = this.quad(trailRoot, 'streak', C.white, 0.9);
    for (const m of [trailBack, trail]) m.rotation.x = -Math.PI / 2;
    trail.position.y = 0.01;
    const streaks = [];
    let streakT = 0, endAge = -1;
    e.extra = [trailRoot];

    e.tick = (dt, age) => {
      const a = env(age, 0, 0.05, 0.5, 0.22);
      const pulse = 1 + 0.08 * Math.sin(age * 40);
      crestBack.scale.set(1.8 * pulse, 1.8 * pulse, 1);
      crestBody.scale.set(1.65 * pulse, 1.65 * pulse, 1);
      crest.scale.set(1.65 * pulse, 1.65 * pulse, 1);
      crestBack.material.opacity = 0.7 * a;
      crestBody.material.opacity = 0.85 * a;
      crest.material.opacity = a;
      for (const b of bows) b.set(2.6 + 0.4 * Math.sin(age * 30), a * 0.9);
      shine.scale.setScalar((1.2 + 0.5 * Math.sin(age * 25)) * a + 0.01);
      shine.material.opacity = a;

      // Trail line from the start point to the knight
      const p = e.root.position;
      const len = Math.max(0.1, Math.hypot(p.x - trailRoot.position.x, p.z - trailRoot.position.z));
      for (const m of [trailBack, trail]) {
        m.scale.set(len, 1.4, 1);
        m.position.x = len / 2;
      }
      const ta = age < 0.55 ? 1 : clamp01(1 - (age - 0.55) / 0.23);
      trail.material.opacity = ta;
      trailBack.material.opacity = 0.6 * ta;

      // Speed streaks at random heights beside the body
      streakT -= dt;
      if (a > 0.5 && streakT <= 0) {
        streakT = 0.03;
        for (let i = 0; i < 2; i++) {
          const holder = new THREE.Group();
          const side = (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.8);
          holder.position.set(p.x - dz * side - dx * 0.4, p.y + rand(0.3, 1.7), p.z + dx * side - dz * 0.4);
          holder.rotation.y = -f;
          this.group.add(holder);
          const m = this.quad(holder, 'streak', Math.random() < 0.5 ? C.blue : C.navy, 1, { blend: 'normal', opacity: 0.8 });
          m.scale.set(rand(1.2, 2.0), 0.16, 1);
          m.position.x = -m.scale.x / 2;
          streaks.push({ holder, m, age: 0 });
        }
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.age += dt;
        s.m.material.opacity = 0.8 * clamp01(1 - s.age / 0.22);
        if (s.age > 0.22) {
          this.dispose(s.holder);
          streaks.splice(i, 1);
        }
      }
      if (age > 0.5 && endAge < 0) {
        endAge = age;
        fx.flash(p.x + dx * 0.9, p.y + 1.0, p.z + dz * 0.9, C.sky, 2.2, 0.2);
        fx.dustPuff(p.x + dx * 0.6, p.y + 0.05, p.z + dz * 0.6, 6, 1.1);
      }
      if (age >= 0.77) for (const s of streaks.splice(0)) this.dispose(s.holder);
    };
    this.shake(3);
  }

  // ------------------------------------------------------------------ frame update
  update(dt, state) {
    const players = new Map();
    if (state?.players) for (const p of state.players) players.set(p.id, p);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
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
      if (e.tick) e.tick(dt, e.age, pl);
    }
    for (const [id, aura] of this.auras) this.updateAura(id, aura, players.get(id), dt);
  }
}
