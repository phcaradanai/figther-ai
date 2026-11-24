// ============================================================================
// Painterly VFX for the Three.js renderer
// - GPU point particles (one draw call per blend mode) from a 4-tile atlas
// - Shaped effects: slash crescents, ground rings, magic circles, beams,
//   fresnel domes and ice crystals
// - Floating texts (damage numbers, skill callouts) handed to the 2D overlay
// ============================================================================
import * as THREE from 'three';
import { makeParticleAtlas, makeMagicCircle, makeSlashTexture, makeBeamTexture, makeScorchTexture } from './textures.js';
import { SKILL_ANIM } from './chibi.js';

const TILE = { dot: 0, dust: 1, petal: 2, star: 3 };

const PARTICLE_VS = `
attribute float size;
attribute float alpha;
attribute float rot;
attribute float tile;
attribute vec3 pcolor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vTile;
void main() {
  vColor = pcolor;
  vAlpha = alpha;
  vRot = rot;
  vTile = tile;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(0.1, -mv.z);
}`;

const PARTICLE_FS = `
uniform sampler2D map;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vTile;
void main() {
  if (vAlpha <= 0.001) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  float tx = mod(vTile, 2.0);
  float ty = 1.0 - floor(vTile / 2.0);
  vec4 t = texture2D(map, (uv + vec2(tx, ty)) * 0.5);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
}`;

class ParticleLayer {
  constructor(max, blending, atlas) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.tile = new Float32Array(max);
    // simulation state
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.swirl = new Float32Array(max);
    this.center = new Float32Array(max * 2);
    this.life.fill(0);

    const g = new THREE.BufferGeometry();
    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(this.pos, 3));
    g.setAttribute('pcolor', attr(this.col, 3));
    g.setAttribute('size', attr(this.size, 1));
    g.setAttribute('alpha', attr(this.alpha, 1));
    g.setAttribute('rot', attr(this.rot, 1));
    g.setAttribute('tile', attr(this.tile, 1));
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: atlas }, uScale: { value: 800 } },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      blending
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 20 : 10;
  }

  spawn(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const c = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color || '#ffffff');
    const k = o.intensity ?? 1;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.vel[i * 3] = o.vx || 0; this.vel[i * 3 + 1] = o.vy || 0; this.vel[i * 3 + 2] = o.vz || 0;
    this.col[i * 3] = c.r * k; this.col[i * 3 + 1] = c.g * k; this.col[i * 3 + 2] = c.b * k;
    this.age[i] = 0;
    this.life[i] = o.life || 0.5;
    this.s0[i] = o.size ?? 0.4;
    this.s1[i] = o.sizeEnd ?? (o.size ?? 0.4) * 0.2;
    this.a0[i] = o.alpha ?? 1;
    this.grav[i] = o.gravity || 0;
    this.drag[i] = o.drag || 0;
    this.spin[i] = o.spin || 0;
    this.rot[i] = o.rot ?? Math.random() * Math.PI * 2;
    this.tile[i] = TILE[o.tile || 'dot'];
    this.swirl[i] = o.swirl || 0;
    this.center[i * 2] = o.cx ?? o.x;
    this.center[i * 2 + 1] = o.cz ?? o.z;
    this.size[i] = this.s0[i];
    this.alpha[i] = 0;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const j = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= dr; this.vel[j + 1] = this.vel[j + 1] * dr + this.grav[i] * dt; this.vel[j + 2] *= dr;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.swirl[i] !== 0) {
        const cx = this.center[i * 2], cz = this.center[i * 2 + 1];
        const dx = this.pos[j] - cx, dz = this.pos[j + 2] - cz;
        const a = this.swirl[i] * dt;
        const ca = Math.cos(a), sa = Math.sin(a);
        this.pos[j] = cx + dx * ca - dz * sa;
        this.pos[j + 2] = cz + dx * sa + dz * ca;
      }
      this.rot[i] += this.spin[i] * dt;
      const e = 1 - Math.pow(1 - t, 2);
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
      const fadeIn = Math.min(1, t / 0.08);
      this.alpha[i] = this.a0[i] * fadeIn * (1 - t * t);
    }
    const a = this.geometry.attributes;
    a.position.needsUpdate = a.pcolor.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.rot.needsUpdate = a.tile.needsUpdate = true;
  }
}

function arcGeometry(span, inner = 0.5, segs = 30) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = span / 2 - u * span;
    for (let v = 0; v <= 1; v++) {
      const r = inner + (1 - inner) * v;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      uv.push(u, v);
    }
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function fresnelMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.7) }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor * (0.25 + f), (0.1 + f) * uOpacity); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// Additive effect quads batched as instances: one draw call per (geometry, texture)
// no matter how many rings/arcs/beams are alive. With additive blending, fading
// an instance is the same as scaling its colour, so no per-instance alpha needed.
const _c = new THREE.Color();
class InstPool {
  constructor(parent, geometry, map, max = 320) {
    this.mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geometry, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.mesh.count = 0;
    this.max = max;
    this.items = [];
    parent.add(this.mesh);
  }
  add(obj, color) {
    if (this.items.length >= this.max) return null;
    const it = { obj, color, alpha: 1, pool: this };
    this.items.push(it);
    return it;
  }
  remove(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }
  flush() {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.obj.updateWorldMatrix(true, false);
      this.mesh.setMatrixAt(i, it.obj.matrixWorld);
      this.mesh.setColorAt(i, _c.copy(it.color).multiplyScalar(Math.max(0, it.alpha)));
    }
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

const MAX_DECALS = 28;
const rand = (a, b) => a + Math.random() * (b - a);
const hot = (hex, k = 1.8) => new THREE.Color(hex).multiplyScalar(k);

export class FxSystem {
  constructor(scene) {
    this.scene = scene;
    this.atlas = makeParticleAtlas();
    this.add = new ParticleLayer(2400, THREE.AdditiveBlending, this.atlas);
    this.norm = new ParticleLayer(900, THREE.NormalBlending, this.atlas);
    scene.add(this.norm.points, this.add.points);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.shapes = [];
    this.timers = [];
    this.texts = [];
    this.time = 0;
    this.tex = { circle: makeMagicCircle(), slash: makeSlashTexture(), beam: makeBeamTexture(), scorch: makeScorchTexture() };
    this.geo = {
      ring: new THREE.RingGeometry(0.82, 1, 64),
      plane: new THREE.PlaneGeometry(1, 1),
      beam: new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
      sphere: new THREE.IcosahedronGeometry(1, 3),
      crystal: new THREE.ConeGeometry(0.3, 1.5, 6).translate(0, 0.75, 0)
    };
    this.arcCache = new Map();
    this.pools = new Map();
    this.decals = [];
    this.ctx = { shake: () => {}, floorY: () => null };
  }

  pool(key, geometry, map) {
    let p = this.pools.get(key);
    if (!p) {
      p = new InstPool(this.group, geometry, map);
      this.pools.set(key, p);
    }
    return p;
  }

  // A transform-only proxy drawn by an instance pool; fade with fade(o, alpha)
  inst(pool, color, k = 1.8, parent = null) {
    const o = new THREE.Object3D();
    if (parent) parent.add(o);
    o.userData.inst = pool.add(o, hot(color, k));
    return o;
  }

  fade(o, alpha) {
    if (o.userData.inst) o.userData.inst.alpha = alpha;
  }

  arcGeo(span, inner) {
    const key = `${span}|${inner}`;
    let g = this.arcCache.get(key);
    if (!g) {
      g = arcGeometry(span, inner);
      this.arcCache.set(key, g);
    }
    return g;
  }

  setPixelScale(s) {
    this.add.material.uniforms.uScale.value = s;
    this.norm.material.uniforms.uScale.value = s;
  }

  later(delay, fn) {
    this.timers.push({ at: this.time + delay, fn });
  }

  ground(x, y, z) {
    const g = this.ctx.floorY(x, z, y);
    return g === null || g === undefined ? y : g;
  }

  // ---------------------------------------------------------------- primitives
  sparks(x, y, z, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = rand(o.elMin ?? -0.3, o.elMax ?? 1.0);
      const sp = rand(o.speedMin ?? 3, o.speed ?? 8);
      let dx = Math.cos(a), dz = Math.sin(a);
      if (o.dir !== undefined) {
        const d = o.dir + rand(-(o.cone ?? 0.5), o.cone ?? 0.5);
        dx = Math.cos(d);
        dz = Math.sin(d);
      }
      this.add.spawn({
        x, y, z,
        vx: dx * sp * Math.cos(el), vy: Math.sin(el) * sp + (o.up ?? 0), vz: dz * sp * Math.cos(el),
        color: Math.random() < (o.white ?? 0.3) ? '#ffffff' : color,
        intensity: o.intensity ?? 1.6,
        size: rand(0.18, o.size ?? 0.4), sizeEnd: 0.02,
        life: rand(0.25, o.life ?? 0.55), gravity: o.gravity ?? -12, drag: o.drag ?? 2.5,
        tile: o.tile || (Math.random() < 0.5 ? 'star' : 'dot'), spin: rand(-6, 6)
      });
    }
  }

  flash(x, y, z, color, size = 2, life = 0.16) {
    this.add.spawn({ x, y, z, color, intensity: 1.7, size: size * 0.6, sizeEnd: size, life, alpha: 1, tile: 'dot', rot: 0 });
    this.add.spawn({ x, y, z, color: '#ffffff', intensity: 1.3, size: size * 0.35, sizeEnd: size * 0.5, life: life * 0.7, tile: 'star', rot: Math.random() * 3 });
  }

  motes(x, y, z, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (o.radius ?? 1);
      this.add.spawn({
        x: x + Math.cos(a) * r, y: y + rand(0, o.h ?? 0.4), z: z + Math.sin(a) * r,
        vx: 0, vy: rand(1.2, o.rise ?? 3.2), vz: 0, color, intensity: o.intensity ?? 1.5,
        size: rand(0.15, o.size ?? 0.35), sizeEnd: 0.03, life: rand(0.6, o.life ?? 1.2), drag: 1.2,
        tile: Math.random() < 0.6 ? 'star' : 'dot', swirl: o.swirl ?? 0, cx: x, cz: z
      });
    }
  }

  dustPuff(x, y, z, n = 4, scale = 1, color = '#e9dcc4') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(0.6, 2.2) * scale;
      this.norm.spawn({
        x: x + Math.cos(a) * 0.15, y: y + 0.1, z: z + Math.sin(a) * 0.15,
        vx: Math.cos(a) * sp, vy: rand(0.4, 1.2), vz: Math.sin(a) * sp,
        color, size: rand(0.5, 0.8) * scale, sizeEnd: rand(1.2, 1.8) * scale,
        life: rand(0.45, 0.8), alpha: 0.55, drag: 3.5, tile: 'dust', spin: rand(-1, 1)
      });
    }
  }

  smoke(x, y, z, n, color, radius = 1.5, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.norm.spawn({
        x: x + Math.cos(a) * r, y: y + rand(0, 1.2), z: z + Math.sin(a) * r,
        vx: Math.cos(a) * rand(0.3, 1.5), vy: rand(0.2, 1.4), vz: Math.sin(a) * rand(0.3, 1.5),
        color, size: rand(1.0, 1.8), sizeEnd: rand(2.8, 4.4), life: rand(0.9, o.life ?? 1.7),
        alpha: o.alpha ?? 0.75, drag: 1.5, tile: 'dust', spin: rand(-0.6, 0.6)
      });
    }
  }

  shape(mesh, life, update, inScene = true) {
    if (inScene) this.group.add(mesh);
    this.shapes.push({ mesh, life, age: 0, update, inScene });
    return mesh;
  }

  ring(x, y, z, radius, color, life = 0.45, o = {}) {
    const m = this.inst(this.pool('ring', this.geo.ring, null), color, o.k ?? 1.6);
    m.position.set(x, y + 0.06, z);
    if (!o.vertical) m.rotation.x = -Math.PI / 2;
    this.shape(m, life, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      m.scale.setScalar(Math.max(0.01, radius * (0.15 + 0.85 * e)));
      this.fade(m, (1 - k) * (o.opacity ?? 1));
    }, false);
  }

  circle(x, y, z, radius, color, life = 1.0, spin = 1.2) {
    const m = this.inst(this.pool('circle', this.geo.plane, this.tex.circle), color, 1.6);
    m.position.set(x, y + 0.07, z);
    m.rotation.x = -Math.PI / 2;
    this.shape(m, life, (k, dt) => {
      const pop = k < 0.15 ? 1 - Math.pow(1 - k / 0.15, 3) : 1;
      m.scale.setScalar(radius * 2 * (0.6 + 0.4 * pop));
      m.rotation.z += spin * dt;
      this.fade(m, k < 0.7 ? 1 : (1 - k) / 0.3);
    }, false);
  }

  arc(x, y, z, facing, radius, color, o = {}) {
    const span = o.span ?? 2.4;
    const pool = this.pool(`arc${span}`, this.arcGeo(span, 0.5), this.tex.slash);
    const holder = new THREE.Object3D();
    holder.position.set(x, y, z);
    holder.rotation.y = -facing;
    const mk = (col, k, s) => {
      const m = this.inst(pool, col, k, holder);
      m.rotation.x = o.tilt ?? 0;
      m.scale.set(radius * s, radius * s, radius * s * (o.mirror ? -1 : 1));
      return m;
    };
    const outer = mk(color, 2.8, 1);
    const core = mk('#ffffff', 2.0, 0.97);
    const life = o.life ?? 0.24;
    const sweep = (o.mirror ? -1 : 1) * (o.sweep ?? 0.5);
    this.shape(holder, life, (k) => {
      const e = 1 - Math.pow(1 - k, 2);
      holder.rotation.y = -facing - sweep * (e - 0.5);
      const s = 0.92 + e * 0.16;
      holder.scale.setScalar(s);
      this.fade(outer, (1 - k) * 1.1);
      this.fade(core, Math.max(0, 1 - k * 1.8));
    }, false);
  }

  beam(ax, ay, az, bx, by, bz, width, color, life = 0.5, o = {}) {
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const len = Math.max(0.01, dir.length());
    const holder = new THREE.Object3D();
    holder.position.set(ax, ay, az);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const pool = this.pool('beam', this.geo.beam, this.tex.beam);
    const planes = [];
    for (let i = 0; i < 2; i++) {
      const p = this.inst(pool, color, o.k ?? 2.2, holder);
      p.rotation.y = i * Math.PI / 2;
      planes.push(p);
    }
    this.shape(holder, life, (k) => {
      const w = width * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.6) * (0.9 + Math.random() * 0.2);
      holder.scale.set(Math.max(0.01, w), len, Math.max(0.01, w));
      for (const p of planes) this.fade(p, k < 0.7 ? 1 : (1 - k) / 0.3);
    }, false);
  }

  dome(x, y, z, radius, color, life = 0.7) {
    const mat = fresnelMaterial(color);
    const m = new THREE.Mesh(this.geo.sphere, mat);
    m.position.set(x, y, z);
    this.shape(m, life, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      m.scale.setScalar(Math.max(0.01, radius * (0.2 + 0.8 * e)));
      mat.uniforms.uOpacity.value = 1 - k;
    });
  }

  crystal(x, y, z, scale, life = 0.9, tilt = 0) {
    const mat = new THREE.MeshLambertMaterial({ color: '#d9f6ff', emissive: '#2bb3d8', emissiveIntensity: 0.8, transparent: true, opacity: 0.92 });
    const m = new THREE.Mesh(this.geo.crystal, mat);
    m.position.set(x, y, z);
    m.rotation.set(rand(-0.25, 0.25) + tilt, rand(0, 3), rand(-0.25, 0.25));
    this.shape(m, life, (k) => {
      const grow = k < 0.12 ? 1 - Math.pow(1 - k / 0.12, 3) : (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
      m.scale.set(scale, Math.max(0.01, scale * grow), scale);
      mat.opacity = 0.92 * (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
    });
  }

  // Lingering ground mark (scorch, skid); fades over `life` seconds
  decal(x, y, z, radius, color, life = 3.5, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.scorch, color, transparent: true, depthWrite: false, opacity: o.opacity ?? 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(this.geo.plane, mat);
    m.rotation.set(-Math.PI / 2, 0, o.angle ?? Math.random() * Math.PI * 2);
    m.position.set(x, y + 0.03, z);
    m.renderOrder = 1;
    const base = mat.opacity;
    const sx = o.stretch ?? 1;
    this.decals.push(m);
    if (this.decals.length > MAX_DECALS) {
      const old = this.decals.shift();
      const entry = this.shapes.find(e => e.mesh === old);
      if (entry) entry.age = Math.max(entry.age, entry.life * 0.9);
    }
    this.shape(m, life, (k) => {
      const grow = Math.min(1, (k * life) / 0.08);
      m.scale.set(radius * 2 * sx * (0.6 + 0.4 * grow), radius * 2 * (0.6 + 0.4 * grow), 1);
      mat.opacity = base * (k < 0.55 ? 1 : (1 - k) / 0.45);
    });
  }

  // Motion-blur whirl around a spinning character
  whirl(x, y, z, color, life = 0.68) {
    const pool = this.pool('whirl', this.arcGeo(Math.PI * 1.7, 0.35), this.tex.slash);
    const holder = new THREE.Object3D();
    holder.position.set(x, y, z);
    const layers = [];
    for (const [dy, r, c, k] of [[0, 1.7, color, 2.4], [0.32, 1.35, '#ffffff', 1.4], [-0.3, 1.5, color, 1.6]]) {
      const m = this.inst(pool, c, k, holder);
      m.position.y = dy;
      m.scale.setScalar(r);
      m.rotation.y = Math.random() * 6.28;
      layers.push(m);
    }
    this.shape(holder, life, (k, dt) => {
      layers.forEach((m, i) => {
        m.rotation.y -= dt * (24 + i * 5);
        this.fade(m, (k < 0.1 ? k / 0.1 : 1 - Math.pow(k, 3)) * 0.95);
      });
    }, false);
    for (let i = 0; i < 18; i++) {
      this.later(i * 0.03, () => {
        const a = Math.random() * Math.PI * 2;
        const r = rand(1.2, 1.9);
        this.add.spawn({ x: x + Math.cos(a) * r, y: y + rand(-0.4, 0.4), z: z + Math.sin(a) * r, vx: -Math.sin(a) * 9, vz: Math.cos(a) * 9, color, intensity: 1.8, size: 0.22, sizeEnd: 0.04, life: 0.22, drag: 3, tile: 'dot' });
      });
    }
  }

  debris(x, y, z, n, color = '#4a3a30', o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(2, o.speed ?? 7);
      this.norm.spawn({ x: x + Math.cos(a) * rand(0, o.radius ?? 0.6), y: y + 0.2, z: z + Math.sin(a) * rand(0, o.radius ?? 0.6), vx: Math.cos(a) * sp, vy: rand(5, o.up ?? 11), vz: Math.sin(a) * sp, color, size: rand(0.16, 0.34), sizeEnd: 0.14, life: rand(0.8, 1.3), gravity: -24, tile: 'dust', alpha: 1, spin: rand(-10, 10) });
    }
  }

  // Sword & shield (knight) basic attacks, timed to the strike frame of each clip
  knightSlash(fx) {
    const f = fx.facing || 0;
    const cf = Math.cos(f), sf = Math.sin(f);
    const px = fx.x - cf * 1.1, pz = fx.z - sf * 1.1;
    const g = this.ground(px, fx.y - 0.9, pz);
    const col = fx.color || '#fbbf24';
    const step = fx.comboStep || 1;
    if (fx.isFinisher) {
      // Overhead smash: vertical arc, then a burst where the blade meets the ground
      this.later(0.07, () => this.arc(px, fx.y + 0.1, pz, f, 1.8, col, { tilt: -Math.PI / 2 + 0.2, span: 2.6, life: 0.3, sweep: 0.15 }));
      this.later(0.14, () => {
        const ix = px + cf * 1.5, iz = pz + sf * 1.5;
        const gy = this.ground(ix, g + 0.5, iz);
        this.flash(ix, gy + 0.3, iz, '#fff1c2', 2.6, 0.2);
        this.ring(ix, gy, iz, 2.6, col, 0.45);
        this.dustPuff(ix, gy, iz, 12, 1.6);
        this.debris(ix, gy, iz, 10);
        this.decal(ix, gy, iz, 1.2, '#2a1c14', 3, { opacity: 0.6 });
        this.ctx.shake(7);
      });
    } else if (step % 2 === 0) {
      // Shield bash: a bright burst right in front of the shield
      this.later(0.08, () => {
        const ix = px + cf * 0.55, iz = pz + sf * 0.55;
        this.flash(ix, fx.y, iz, '#fff3c4', 2.2, 0.16);
        this.sparks(ix, fx.y, iz, 14, '#fde68a', { dir: f, cone: 0.9, speed: 9, tile: 'star' });
        this.dustPuff(px, g, pz, 4, 1);
        this.ctx.shake(3);
      });
    } else {
      // Montano-style low sweep skimming the ground
      this.later(0.06, () => {
        this.arc(px, g + 0.38, pz, f, 2.0, col, { tilt: 0.05, span: 3.2, life: 0.34, sweep: 0.9 });
        this.arc(px, g + 0.24, pz, f, 1.6, '#ffffff', { tilt: 0.05, span: 2.8, life: 0.22, sweep: 0.8 });
        this.dustPuff(px + cf * 1.2, g, pz + sf * 1.2, 6, 1.2);
      });
    }
  }

  // Shinobi dagger slashes: thin layered cyan / gold crescents, fast and low
  ninjaSlash(fx) {
    const f = fx.facing || 0;
    const cf = Math.cos(f), sf = Math.sin(f);
    const px = fx.x - cf * 1.1, pz = fx.z - sf * 1.1;
    const y = fx.y - 0.25;
    const step = fx.comboStep || 1;
    const mirror = step % 2 === 0;
    this.later(0.04, () => {
      if (fx.isFinisher) {
        this.whirl(px, y + 0.1, pz, '#7dd3fc', 0.32);
        this.sparks(px, y, pz, 14, '#bae6fd', { speed: 9, tile: 'star' });
        return;
      }
      this.arc(px, y, pz, f, 1.55, '#7dd3fc', { tilt: mirror ? -0.12 : 0.12, span: 2.7, life: 0.2, sweep: 0.9, mirror });
      this.arc(px, y - 0.12, pz, f, 1.3, '#fde68a', { tilt: mirror ? -0.2 : 0.2, span: 2.4, life: 0.18, sweep: 0.8, mirror });
      this.sparks(px + cf, y, pz + sf, 5, '#e0f2fe', { dir: f, cone: 0.9, speed: 7, gravity: -4 });
    });
  }

  // Revolver shot from a barrel tip along (dx, dy, dz): flash, spark cone, tracer,
  // smoke and an ejected casing. power 1 = magnum, 2 = magnum into the ground
  gunShot(x, y, z, dx, dy, dz, power = 0, gy = null) {
    const big = power > 0;
    this.flash(x, y, z, '#fff3c4', big ? 1.4 : 0.8, big ? 0.12 : 0.07);
    for (let i = 0; i < (big ? 14 : 5); i++) {
      const sp = rand(8, big ? 20 : 15);
      this.add.spawn({
        x, y, z, vx: dx * sp + rand(-1.2, 1.2), vy: dy * sp + rand(-0.8, 1.2), vz: dz * sp + rand(-1.2, 1.2),
        color: Math.random() < 0.35 ? '#ffffff' : '#ffc94d', intensity: 1.8,
        size: rand(0.12, 0.3), sizeEnd: 0.02, life: rand(0.07, 0.16), drag: 7, tile: 'dot'
      });
    }
    const len = big ? 6 : 3.2;
    this.beam(x, y, z, x + dx * len, y + dy * len, z + dz * len, big ? 0.16 : 0.08, '#ffd27a', big ? 0.14 : 0.08, { k: big ? 1.8 : 2.2 });
    this.norm.spawn({ x: x + dx * 0.25, y: y + dy * 0.25, z: z + dz * 0.25, vx: dx * 1.4, vy: 0.5, vz: dz * 1.4, color: '#d6cec4', size: big ? 0.6 : 0.3, sizeEnd: big ? 1.8 : 1.0, life: 0.55, alpha: 0.45, drag: 3, tile: 'dust' });
    const sl = Math.hypot(dx, dz) || 1;
    const sx = -dz / sl, sz = dx / sl;
    this.norm.spawn({ x, y, z, vx: sx * rand(1.5, 3), vy: rand(2.2, 3.6), vz: sz * rand(1.5, 3), color: '#e0a92e', size: 0.1, sizeEnd: 0.09, life: 0.7, gravity: -18, alpha: 1, tile: 'dot' });
    if (!big) return;
    this.sparks(x, y, z, 10, '#fde68a', { dir: Math.atan2(dz, dx), cone: 0.35, speed: 16, gravity: -2, tile: 'star' });
    this.ctx.shake(power > 1 ? 7 : 5);
    if (power > 1 && gy !== null && dy < -0.15) {
      // The closing shot hits the ground in front: golden burst and a scorch
      const t = (y - gy) / -dy;
      const hx = x + dx * t, hz = z + dz * t;
      this.flash(hx, gy + 0.3, hz, '#ffd27a', 2.4, 0.2);
      this.ring(hx, gy, hz, 2.8, '#fbbf24', 0.45);
      this.sparks(hx, gy + 0.2, hz, 16, '#fde68a', { speed: 9, tile: 'star' });
      this.dustPuff(hx, gy, hz, 8, 1.2);
      this.debris(hx, gy, hz, 6);
      this.decal(hx, gy, hz, 0.9, '#2a1c14', 3, { opacity: 0.55 });
    }
  }

  // A column of flame licking up out of the ground for `dur` seconds
  flameColumn(x, gy, z, height = 2.4, dur = 0.6, scale = 1) {
    const n = Math.max(1, Math.round(dur / 0.03));
    this.flash(x, gy + 0.3, z, '#ffb347', 1.4 * scale, 0.14);
    for (let i = 0; i < n; i++) {
      this.later(i * 0.03, () => {
        for (let j = 0; j < 2; j++) {
          const hot = j === 0;
          this.add.spawn({
            x: x + rand(-0.22, 0.22) * scale, y: gy + 0.1, z: z + rand(-0.22, 0.22) * scale,
            vx: rand(-0.3, 0.3), vy: rand(4.2, 6.8) * height / 2.4, vz: rand(-0.3, 0.3),
            color: hot ? '#ff9a14' : '#e8300a', intensity: hot ? 1.55 : 1.35,
            size: rand(0.42, 0.62) * scale, sizeEnd: 0.08, life: rand(0.38, 0.58), drag: 1.0, tile: 'dot'
          });
        }
        if (i % 4 === 0) this.norm.spawn({ x: x + rand(-0.2, 0.2), y: gy + height * 0.75, z: z + rand(-0.2, 0.2), vy: 1.2, color: '#3b2a24', size: 0.6 * scale, sizeEnd: 1.6 * scale, life: 0.8, alpha: 0.45, tile: 'dust' });
      });
    }
    this.decal(x, gy, z, 0.6 * scale, '#2a140c', 3, { opacity: 0.5 });
  }

  // Fire Wall: a staggered row of flame columns marching out along `facing`
  fireWall(x, gy, z, facing, count = 5, spacing = 0.85, start = 0.7) {
    const cf = Math.cos(facing), sf = Math.sin(facing);
    for (let i = 0; i < count; i++) {
      this.later(i * 0.05, () => {
        const px = x + cf * (start + i * spacing), pz = z + sf * (start + i * spacing);
        this.flameColumn(px, this.ground(px, gy + 0.5, pz), pz, 2.6, 0.55, 1.1);
      });
    }
    this.ctx.shake(6);
  }

  // Hell Breath: a cone of fire pouring out of the hands along `facing`
  flameStream(x, y, z, facing, dur = 0.36) {
    const n = Math.round(dur / 0.02);
    for (let i = 0; i < n; i++) {
      this.later(i * 0.02, () => {
        for (let j = 0; j < 3; j++) {
          const a = facing + rand(-0.22, 0.22);
          const sp = rand(9, 14);
          this.add.spawn({ x, y: y + rand(-0.1, 0.1), z, vx: Math.cos(a) * sp, vy: rand(-0.2, 0.8), vz: Math.sin(a) * sp, color: j === 0 ? '#ffb020' : '#e8380c', intensity: j === 0 ? 1.7 : 1.4, size: 0.22, sizeEnd: rand(0.9, 1.3), life: rand(0.3, 0.42), drag: 2.2, tile: 'dot' });
        }
        if (i % 3 === 0) this.norm.spawn({ x: x + Math.cos(facing) * 3, y: y + 0.4, z: z + Math.sin(facing) * 3, vx: Math.cos(facing) * 2, vy: 1.2, vz: Math.sin(facing) * 2, color: '#3b2a24', size: 0.6, sizeEnd: 1.8, life: 0.8, alpha: 0.4, tile: 'dust' });
      });
    }
  }

  // Shadow poof: dark smoke burst with a few violet glints (teleports, substitution)
  shadowPoof(x, y, z, scale = 1) {
    this.smoke(x, y, z, Math.round(12 * scale), '#2d1f3d', 0.6 * scale, { alpha: 0.8, life: 1.0 });
    this.sparks(x, y + 0.8, z, Math.round(10 * scale), '#c084fc', { speed: 5, tile: 'star', gravity: -2 });
    this.flash(x, y + 0.8, z, '#a855f7', 1.4 * scale, 0.12);
  }

  text(x, y, z, text, color, kind = 'info') {
    this.texts.push({ x, y, z, text, color, kind, born: performance.now(), ttl: kind === 'callout' ? 1300 : kind === 'big' ? 1400 : kind === 'dmg' ? 900 : 1000, jitter: rand(-0.3, 0.3) });
  }

  // ---------------------------------------------------------------- server fx
  handle(fx) {
    const { x, y, z } = fx;
    const col = fx.color || '#fde68a';
    const g = this.ground(x, y, z);
    const shake = this.ctx.shake;
    switch (fx.type) {
      case 'hit': {
        this.flash(x, y, z, col, fx.damage >= 18 ? 1.9 : 1.3);
        this.sparks(x, y, z, fx.damage >= 18 ? 20 : 12, col, { speed: 9 });
        if (fx.damage) this.text(x, y + 0.5, z, String(fx.damage), fx.guardBreak ? '#fde047' : '#ffb15c', 'dmg');
        if (fx.text) this.text(x, y + 0.8, z, fx.text, col, 'info');
        shake(fx.damage >= 18 ? 6 : 2.5);
        break;
      }
      case 'slash': {
        if (fx.weaponType === 'broadsword') {
          this.knightSlash(fx);
          break;
        }
        if (fx.weaponType === 'dual_kunai') {
          this.ninjaSlash(fx);
          break;
        }
        const f = fx.facing || 0;
        const cx = x - Math.cos(f) * 1.1;
        const cz = z - Math.sin(f) * 1.1;
        const step = fx.comboStep || 1;
        if (fx.isFinisher) {
          this.arc(cx, y + 0.1, cz, f, 1.7, col, { tilt: -Math.PI / 2 + 0.25, span: 2.8, life: 0.3, sweep: 0.2 });
          this.arc(cx, y, cz, f, 1.5, col, { tilt: 0.2, span: 2.6, life: 0.26, mirror: step % 2 === 0 });
        } else {
          this.arc(cx, y, cz, f, 1.45, col, { tilt: step % 2 === 1 ? 0.3 : -0.3, mirror: step % 2 === 0 });
        }
        this.sparks(x, y, z, 5, col, { dir: f, cone: 0.8, speed: 6, gravity: -6 });
        break;
      }
      case 'muzzle': {
        const f = fx.facing || 0;
        this.flash(x, y, z, '#fff3c4', 1.1, 0.08);
        this.sparks(x, y, z, 6, col, { dir: f, cone: 0.3, speed: 12, gravity: -2, elMin: -0.1, elMax: 0.2, life: 0.2 });
        if (fx._style === 'pyro') {
          this.sparks(x, y, z, 8, '#ff8a2a', { dir: f, cone: 0.6, speed: 6, gravity: 2, tile: 'dot' });
          break;
        }
        if (fx._style !== 'gun') break;
        this.norm.spawn({ x: x + Math.cos(f) * 0.25, y, z: z + Math.sin(f) * 0.25, vx: Math.cos(f) * 1.4, vy: 0.5, vz: Math.sin(f) * 1.4, color: '#d6cec4', size: 0.35, sizeEnd: 1.1, life: 0.55, alpha: 0.5, drag: 3, tile: 'dust' });
        const side = f + Math.PI / 2;
        for (let i = 0; i < 2; i++) {
          this.norm.spawn({ x, y, z, vx: Math.cos(side) * rand(1.5, 3), vy: rand(2.2, 3.6), vz: Math.sin(side) * rand(1.5, 3), color: '#e0a92e', size: 0.1, sizeEnd: 0.09, life: 0.7, gravity: -18, alpha: 1, tile: 'dot' });
        }
        break;
      }
      case 'heavy_cast':
        this.flash(x, y + 0.6, z, col, 1.1, 0.22);
        this.motes(x, g, z, 10, col, { radius: 0.8 });
        break;
      case 'heavy_impact':
        this.flash(x, y, z, col, 2.0, 0.2);
        this.ring(x, g, z, 3.2, col, 0.45);
        this.sparks(x, y, z, 18, col, { speed: 10 });
        this.dustPuff(x, g, z, 10, 1.4);
        this.debris(x, g, z, 8);
        this.decal(x, g, z, 1.3, '#2a1c14', 3, { opacity: 0.6 });
        if (fx.heroId === 'mage') {
          const f = fx.facing || 0;
          this.fireWall(x - Math.cos(f) * 1.5, g, z - Math.sin(f) * 1.5, f, 5, 0.85, 0.8);
        }
        if (fx.heroId === 'knight') {
          // Shield Push: a big golden burst off the shield face
          this.flash(x, y, z, '#fff3c4', 3.4, 0.24);
          this.sparks(x, y, z, 22, '#fde68a', { dir: fx.facing || 0, cone: 1.1, speed: 12, tile: 'star' });
          this.ring(x, g, z, 2.4, '#fde68a', 0.4);
        }
        shake(7);
        break;
      case 'shockwave': {
        const r = fx.radius || 3.5;
        this.ring(x, g, z, r, col, 0.5);
        this.later(0.08, () => this.ring(x, g, z, r * 0.75, '#ffffff', 0.4, { k: 1.2 }));
        this.dustPuff(x, g, z, 12, 1.6);
        this.motes(x, g, z, 14, col, { radius: r * 0.6 });
        shake(5);
        break;
      }
      case 'skill_cast': {
        this.circle(x, this.ground(x, y - 1.5, z), z, 2.1, col, 1.1, 2.5);
        this.motes(x, this.ground(x, y - 1.5, z), z, 18, col, { radius: 1.6, swirl: 2.5 });
        if (fx.skillNameTh) this.text(x, y + 0.9, z, fx.skillNameTh, col, 'callout');
        const anim = SKILL_ANIM[fx.skillId];
        const gy = this.ground(x, y - 1.5, z);
        if (anim === 'spin') this.later(0.05, () => this.whirl(x, gy + 0.95, z, col));
        if (anim === 'sweep') {
          const f = fx.facing || 0;
          this.later(0.18, () => {
            this.arc(x, gy + 0.4, z, f, 2.8, col, { tilt: 0.05, span: 3.8, life: 0.42, sweep: 1.0 });
            this.arc(x, gy + 0.25, z, f, 2.2, '#ffffff', { tilt: 0.05, span: 3.4, life: 0.28, sweep: 0.9 });
            this.dustPuff(x + Math.cos(f) * 1.5, gy, z + Math.sin(f) * 1.5, 10, 1.5);
            shake(5);
          });
        }
        if (anim === 'raise' || anim === 'summon') {
          // Enchant fire: flames spiral up the caster, a burst crowns the raised staff
          this.later(0.1, () => {
            this.flameColumn(x, gy, z, 2.2, 0.35, 0.9);
            for (let i = 0; i < 24; i++) {
              const a = (i / 24) * Math.PI * 2;
              this.add.spawn({ x: x + Math.cos(a) * 0.9, y: gy + 0.1 + (i % 6) * 0.2, z: z + Math.sin(a) * 0.9, vy: 2.6, color: i % 2 ? '#ffb347' : '#ff5a1f', intensity: 2.2, size: 0.3, sizeEnd: 0.05, life: 0.7, swirl: 6, cx: x, cz: z, tile: 'dot' });
            }
            this.flash(x, gy + 2.6, z, '#ffd27a', 2.0, 0.3);
          });
        }
        if (anim === 'nova') {
          this.later(0.2, () => {
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2;
              this.flameColumn(x + Math.cos(a) * 2.2, gy, z + Math.sin(a) * 2.2, 1.8, 0.35, 0.8);
            }
            this.flash(x, gy + 1, z, '#ffd27a', 3.2, 0.25);
          });
        }
        if (anim === 'blink') {
          this.flameColumn(x, gy, z, 2.0, 0.25, 1);
          this.whirl(x, gy + 0.8, z, '#ff7a1a', 0.35);
        }
        if (anim === 'rollshot') this.dustPuff(x, gy, z, 5, 1.0);
        if (anim === 'toss') {
          // Lit fuse: a few sparks fizz off the thrown hand
          const f = fx.facing || 0;
          this.later(0.12, () => this.sparks(x + Math.cos(f) * 0.6, gy + 1.6, z + Math.sin(f) * 0.6, 8, '#fb923c', { dir: f, cone: 0.6, speed: 6, gravity: -6 }));
        }
        if (anim === 'windslash') {
          this.later(0.12, () => this.whirl(x, gy + 0.8, z, '#e0f7ff', 0.4));
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            this.add.spawn({ x: x + Math.cos(a) * 1.2, y: gy + 0.2 + (i % 5) * 0.25, z: z + Math.sin(a) * 1.2, vy: 1.6, color: i % 3 ? '#e0f7ff' : '#7dd3fc', intensity: 1.6, size: 0.24, sizeEnd: 0.05, life: 0.55, swirl: 9, cx: x, cz: z, tile: 'dot' });
          }
        }
        if (anim === 'seal' || anim === 'backflip') {
          this.flash(x, gy + 0.9, z, '#bae6fd', 1.2, 0.18);
          this.motes(x, gy + 0.6, z, 10, '#93c5fd', { radius: 0.4, rise: 2.5 });
        }
        if (anim === 'backflip') this.later(0.1, () => this.shadowPoof(x, gy, z, 1.1));
        if (anim === 'throw') {
          const f = fx.facing || 0;
          this.later(0.16, () => this.sparks(x + Math.cos(f) * 0.8, gy + 1.0, z + Math.sin(f) * 0.8, 10, '#e9d5ff', { dir: f, cone: 0.5, speed: 12, gravity: 0, drag: 4 }));
        }
        if (anim === 'warcry') this.later(0.24, () => { this.ring(x, gy, z, 3.2, col, 0.5); this.motes(x, gy, z, 16, col, { radius: 1.2, rise: 5 }); });
        if (anim === 'slam') {
          this.later(0.36, () => {
            this.ring(x, gy, z, 3.4, col, 0.45);
            this.dustPuff(x, gy, z, 14, 1.8);
            this.debris(x, gy, z, 12);
            this.decal(x, gy, z, 1.8, '#2a1c14', 3.5, { opacity: 0.65 });
            shake(8);
          });
        }
        shake(3);
        break;
      }
      case 'explosion': {
        const r = fx.radius || 3.5;
        this.flash(x, y + 0.4, z, '#ffd28a', r * 1.6, 0.3);
        this.sparks(x, y, z, 30, Math.random() < 0.5 ? col : '#ffb347', { speed: 14, up: 3, gravity: -10, size: 0.55, life: 0.8 });
        this.smoke(x, g, z, 12, '#5b4a44', r * 0.5, { alpha: 0.6 });
        this.later(0.06, () => this.smoke(x, g, z, 16, '#241c19', r * 0.45, { alpha: 0.85, life: 2.0 }));
        this.debris(x, g, z, 18, '#3b2a22', { radius: r * 0.3, speed: 9 });
        this.ring(x, g, z, r, col, 0.55);
        this.decal(x, g, z, r * 0.75, '#1c120c', 4.5);
        shake(10);
        break;
      }
      case 'meteor_strike': {
        const sx = x - 5, sy = y + 16, sz = z - 5;
        const T = 0.3;
        this.add.spawn({ x: sx, y: sy, z: sz, vx: (x - sx) / T, vy: (y - sy) / T, vz: (z - sz) / T, color: '#ffb347', intensity: 3, size: 2.6, sizeEnd: 2.2, life: T, tile: 'dot' });
        for (let i = 0; i < 10; i++) {
          this.later((i / 10) * T, () => {
            const k = i / 10;
            this.add.spawn({ x: sx + (x - sx) * k, y: sy + (y - sy) * k, z: sz + (z - sz) * k, color: '#ff7a1a', intensity: 2.4, size: 1.4, sizeEnd: 0.2, life: 0.5, tile: 'dot' });
          });
        }
        this.circle(x, g, z, fx.radius || 4.5, '#ef4444', 1.0, 1.5);
        this.later(T, () => this.handle({ type: 'explosion', x, y, z, radius: (fx.radius || 4.5) * 1.1, color: '#ff6a1a' }));
        break;
      }
      case 'smoke':
        this.smoke(x, g, z, 26, '#6b5b7a', (fx.radius || 3.5) * 0.6);
        this.sparks(x, y, z, 10, col, { speed: 5 });
        break;
      case 'blade_storm': {
        for (let i = 0; i < 7; i++) {
          this.later(i * 0.06, () => this.arc(x + rand(-1, 1), y + rand(-0.4, 0.4), z + rand(-1, 1), rand(0, 6.28), rand(1.4, 2.4), col, { tilt: rand(-1, 1), mirror: i % 2 === 0, life: 0.22 }));
        }
        this.sparks(x, y, z, 20, col, { speed: 9 });
        break;
      }
      case 'sakura_storm': {
        const r = fx.radius || 3.8;
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r;
          this.norm.spawn({ x: x + Math.cos(a) * d, y: y + rand(-0.8, 1.6), z: z + Math.sin(a) * d, vy: rand(-0.3, 0.8), color: Math.random() < 0.7 ? '#f9a8d4' : '#fff1f2', size: rand(0.18, 0.32), sizeEnd: 0.15, life: rand(0.9, 1.6), swirl: rand(3, 5), cx: x, cz: z, tile: 'petal', spin: rand(-4, 4), alpha: 0.95 });
        }
        for (let i = 0; i < 4; i++) this.later(i * 0.08, () => this.arc(x, y + rand(-0.3, 0.3), z, rand(0, 6.28), r * 0.7, col, { tilt: rand(-0.5, 0.5), life: 0.25 }));
        break;
      }
      case 'blizzard': {
        const r = fx.radius || 4.5;
        this.circle(x, g, z, r, col, 1.5, 1);
        for (let i = 0; i < 90; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r;
          this.add.spawn({ x: x + Math.cos(a) * d, y: g + rand(0.2, 3), z: z + Math.sin(a) * d, vy: rand(-1.5, -0.4), color: Math.random() < 0.5 ? '#ffffff' : col, intensity: 1.6, size: rand(0.1, 0.22), sizeEnd: 0.05, life: rand(0.8, 1.5), swirl: rand(2.5, 4.5), cx: x, cz: z, tile: Math.random() < 0.3 ? 'star' : 'dot' });
        }
        this.ring(x, g, z, r, col, 0.6);
        break;
      }
      case 'ice_tomb': {
        this.dome(x, y, z, 1.6, col, 0.9);
        this.ring(x, g, z, fx.radius || 4, col, 0.5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.crystal(x + Math.cos(a) * 1.4, g, z + Math.sin(a) * 1.4, rand(0.6, 1.0), 1.0);
        }
        this.sparks(x, y, z, 16, col, { speed: 6 });
        break;
      }
      case 'ice_spikes': {
        const tx = fx.tx ?? x, tz = fx.tz ?? z;
        for (let i = 0; i < 9; i++) {
          const k = (i + 1) / 9;
          this.later(i * 0.045, () => {
            const px = x + (tx - x) * k + rand(-0.3, 0.3);
            const pz = z + (tz - z) * k + rand(-0.3, 0.3);
            const gy = this.ground(px, y, pz);
            this.crystal(px, gy, pz, 0.7 + k * 0.6, 0.9);
            this.dustPuff(px, gy, pz, 2, 0.8, '#e0f7ff');
          });
        }
        break;
      }
      case 'freeze':
        this.sparks(x, y, z, 14, col, { speed: 4, tile: 'star', gravity: -2 });
        if (fx.text) this.text(x, y + 0.6, z, fx.text, col, 'info');
        break;
      case 'orbital_beam': {
        const r = fx.radius || 3.8;
        this.circle(x, g, z, r, col, 1.0, 3);
        this.later(0.08, () => {
          this.beam(x, g, z, x, g + 30, z, r * 0.9, col, 0.8);
          this.decal(x, g, z, r * 0.7, '#0f3a2c', 3.5);
          this.beam(x, g, z, x, g + 30, z, r * 0.35, '#ffffff', 0.7, { k: 1.6 });
          this.ring(x, g, z, r * 1.2, col, 0.6);
          this.sparks(x, g + 0.5, z, 30, col, { speed: 9, up: 6, gravity: -4 });
          shake(9);
        });
        break;
      }
      case 'aerial_laser': {
        const tx = fx.tx ?? x, ty = fx.ty ?? y, tz = fx.tz ?? z;
        this.beam(x, y, z, tx, ty, tz, 0.8, col, 0.45);
        this.beam(x, y, z, tx, ty, tz, 0.3, '#ffffff', 0.4, { k: 1.6 });
        this.flash(tx, ty, tz, col, 3, 0.25);
        this.ring(tx, this.ground(tx, ty, tz), tz, 3.2, col, 0.45);
        this.sparks(tx, ty, tz, 22, col, { speed: 10 });
        shake(8);
        break;
      }
      case 'emp_dome':
        this.dome(x, y, z, fx.radius || 4.8, col, 0.75);
        this.ring(x, g, z, fx.radius || 4.8, col, 0.6);
        this.sparks(x, y, z, 30, col, { speed: 12, tile: 'star', gravity: 0, drag: 4 });
        shake(6);
        break;
      case 'earthshatter': {
        const r = fx.radius || 4.6;
        this.flash(x, g + 0.5, z, '#ffb070', 3.5, 0.25);
        this.ring(x, g, z, r, col, 0.5);
        this.dustPuff(x, g, z, 18, 2.2, '#b8956a');
        this.decal(x, g, z, r * 0.85, '#2a1a10', 4.5);
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = rand(2, 6);
          this.norm.spawn({ x: x + Math.cos(a) * rand(0, r * 0.5), y: g + 0.2, z: z + Math.sin(a) * rand(0, r * 0.5), vx: Math.cos(a) * sp, vy: rand(6, 11), vz: Math.sin(a) * sp, color: '#6b4f3a', size: rand(0.2, 0.38), sizeEnd: 0.15, life: rand(0.8, 1.2), gravity: -22, tile: 'dust', alpha: 1, spin: rand(-8, 8) });
        }
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          this.crystal(x + Math.cos(a) * rand(0.5, r * 0.6), g, z + Math.sin(a) * rand(0.5, r * 0.6), rand(0.5, 0.9), 0.7);
        }
        shake(12);
        break;
      }
      case 'hundred_fists': {
        const f = fx.facing || 0;
        for (let i = 0; i < 12; i++) {
          this.later(i * 0.04, () => {
            const px = x + rand(-0.6, 0.6), py = y + rand(-0.4, 0.5), pz = z + rand(-0.6, 0.6);
            this.flash(px, py, pz, col, 1.2, 0.1);
            this.sparks(px, py, pz, 3, col, { dir: f, cone: 0.6, speed: 7 });
          });
        }
        this.later(0.5, () => { this.ring(x, g, z, 2.6, col, 0.4); shake(6); });
        break;
      }
      case 'scythe_reap': {
        const r = fx.radius || 4.2;
        const f = fx.facing || 0;
        const cx = x - Math.cos(f) * 2.2, cz = z - Math.sin(f) * 2.2;
        this.arc(cx, y, cz, f, r * 0.8, col, { span: 5.2, life: 0.4, sweep: 1.2 });
        this.later(0.08, () => this.arc(cx, y + 0.2, cz, f, r * 0.65, '#f0abfc', { span: 4.6, life: 0.32, sweep: 1.0, tilt: 0.2 }));
        this.smoke(cx, g, cz, 10, '#3b2147', r * 0.5, { alpha: 0.5, life: 1.1 });
        this.sparks(x, y, z, 16, col, { speed: 8 });
        shake(6);
        break;
      }
      case 'grave_chains': {
        const r = fx.radius || 4;
        this.circle(x, g, z, r, col, 1.2, -1.5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.later(i * 0.03, () => this.beam(x + Math.cos(a) * r * 0.7, g, z + Math.sin(a) * r * 0.7, x, g + 1.2, z, 0.18, col, 0.7));
        }
        this.motes(x, g, z, 16, col, { radius: r * 0.7 });
        shake(5);
        break;
      }
      case 'lasso':
        this.beam(x, y, z, fx.tx ?? x, y, fx.tz ?? z, 0.14, col, 0.35, { k: 1.6 });
        this.sparks(fx.tx ?? x, y, fx.tz ?? z, 8, col, { speed: 5 });
        break;
      case 'iaido_line': {
        const tx = fx.tx ?? x, tz = fx.tz ?? z;
        this.beam(x, y, z, tx, y, tz, 0.4, col, 0.3);
        this.beam(x, y, z, tx, y, tz, 0.12, '#ffffff', 0.25, { k: 1.4 });
        for (let i = 0; i < 24; i++) {
          const k = Math.random();
          this.norm.spawn({ x: x + (tx - x) * k, y: y + rand(-0.3, 0.6), z: z + (tz - z) * k, vx: rand(-1, 1), vy: rand(0, 1.5), vz: rand(-1, 1), color: '#f9a8d4', size: 0.26, sizeEnd: 0.18, life: rand(0.8, 1.4), tile: 'petal', spin: rand(-5, 5), gravity: -0.8 });
        }
        this.flash(tx, y, tz, col, 2.2, 0.2);
        shake(6);
        break;
      }
      case 'dash': {
        const f = fx.facing || 0;
        if (!fx.isAir) {
          this.dustPuff(x, g, z, 6, 1.1);
          this.decal(x - Math.cos(f) * 0.5, g, z - Math.sin(f) * 0.5, 0.45, '#5a4632', 1.6, { opacity: 0.45, stretch: 2.4, angle: -f });
        }
        for (let i = 0; i < 6; i++) {
          this.add.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(-0.2, 0.6), z: z + rand(-0.3, 0.3), vx: -Math.cos(f) * rand(5, 9), vy: 0, vz: -Math.sin(f) * rand(5, 9), color: col, intensity: 1.6, size: 0.3, sizeEnd: 0.05, life: 0.25, drag: 4, tile: 'dot' });
        }
        break;
      }
      case 'jump':
        this.dustPuff(x, g, z, 6, 0.9);
        this.ring(x, g, z, 1.1, col, 0.3, { opacity: 0.7 });
        break;
      case 'air_jump':
        this.ring(x, y, z, 1.4, col, 0.35);
        this.sparks(x, y, z, 10, col, { speed: 4, tile: 'star', gravity: -3, elMax: 0.2, elMin: -0.6 });
        break;
      case 'jumppad':
        this.beam(x, y, z, x, y + 5, z, 1.4, col, 0.5);
        this.ring(x, y, z, 1.6, col, 0.4);
        this.motes(x, y, z, 12, col, { radius: 1, rise: 6 });
        break;
      case 'teleport':
        this.shadowPoof(x, g, z, 1);
        break;
      case 'spawn':
      case 'hero_swap':
      case 'pickup': {
        const gy = fx.type === 'pickup' ? this.ground(x, y - 1.5, z) : g;
        this.beam(x, gy, z, x, gy + 5, z, fx.type === 'pickup' ? 1.0 : 1.6, col, 0.6);
        this.ring(x, gy, z, 1.8, col, 0.5);
        this.motes(x, gy, z, 18, col, { radius: 0.9, rise: 4, swirl: 3 });
        if (fx.text) this.text(x, gy + 2.4, z, fx.text, col, 'info');
        break;
      }
      case 'heal':
      case 'aura':
        this.motes(x, this.ground(x, y - 1.5, z), z, 20, col, { radius: 0.9, rise: 3.5, swirl: 2 });
        this.ring(x, this.ground(x, y - 1.5, z), z, 1.6, col, 0.6);
        if (fx.text) this.text(x, y + 0.5, z, fx.text, col, fx.type === 'heal' ? 'info' : 'callout');
        break;
      case 'ko':
        this.flash(x, y, z, '#ffffff', 5, 0.3);
        this.ring(x, Math.max(g, y - 1), z, 3.4, col, 0.55);
        this.sparks(x, y, z, 32, col, { speed: 12, size: 0.5 });
        if (fx.text) this.text(x, y + 0.9, z, fx.text, col, 'big');
        shake(9);
        break;
      case 'gear_break':
        this.flash(x, y, z, '#fde68a', 2.4, 0.2);
        this.sparks(x, y, z, 22, '#fbbf24', { speed: 9, tile: 'star' });
        if (fx.text) this.text(x, y + 0.5, z, fx.text, col, 'big');
        shake(4);
        break;
      case 'parry':
        this.flash(x, y, z, '#bae6fd', 3, 0.22);
        this.ring(x, y, z, 1.8, col, 0.3, { vertical: true });
        this.sparks(x, y, z, 16, '#e0f2fe', { speed: 10, tile: 'star' });
        if (fx.text) this.text(x, y + 0.6, z, fx.text, col, 'big');
        shake(4);
        break;
      case 'block':
        this.flash(x, y, z, '#93c5fd', 1.6, 0.14);
        this.sparks(x, y, z, 8, '#bfdbfe', { speed: 6 });
        if (fx.text) this.text(x, y + 0.6, z, fx.text, col, 'info');
        break;
      case 'text':
        if (fx.text) this.text(x, y, z, fx.text, col, 'info');
        break;
      default:
        if (fx.text) this.text(x, y + 0.4, z, fx.text, col, 'info');
    }
  }

  update(dt) {
    this.time += dt;
    if (this.timers.length) {
      const due = this.timers.filter(t => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter(t => t.at > this.time);
        for (const t of due) t.fn();
      }
    }
    this.add.update(dt);
    this.norm.update(dt);
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      s.age += dt;
      const k = Math.min(1, s.age / s.life);
      s.update(k, dt);
      if (k >= 1) {
        s.mesh.traverse((o) => {
          if (o.userData.inst) o.userData.inst.pool.remove(o.userData.inst);
          if (o.material) o.material.dispose();
        });
        if (s.inScene) s.mesh.removeFromParent();
        const di = this.decals.indexOf(s.mesh);
        if (di >= 0) this.decals.splice(di, 1);
        this.shapes.splice(i, 1);
      }
    }
    for (const p of this.pools.values()) p.flush();
    const now = performance.now();
    this.texts = this.texts.filter(t => now - t.born < t.ttl);
  }
}
