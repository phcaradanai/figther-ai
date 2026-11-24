// ============================================================================
// 3D arena for the Three.js renderer: floating island platforms built from the
// shared MAPS data, painted floor/sky textures, props, clouds and themed voids.
// ============================================================================
import * as THREE from 'three';
import { makeCliffTexture, makeCloudTexture, makeMagicCircle, makeToonRamp } from './textures.js';

const loader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(name) {
  if (!texCache.has(name)) {
    const t = loader.load(`/assets/tos/arena/${name}.jpg`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(name, t);
  }
  return texCache.get(name);
}

const RAMP = makeToonRamp();
let CLOUD_TEX = null;
let CIRCLE_TEX = null;

export const THEMES = {
  sky_temple: {
    floor: 'sanctuary_floor', sky: 'sanctuary_sky', cliff: ['#e2d2ad', '#806b4c'], under: '#7a6248', trim: '#d4a537', trimGlow: 0,
    fog: '#f6e7cc', fogNear: 48, fogFar: 120, hemiSky: '#fff5e0', hemiGround: '#a7bfd9', hemiI: 1.0, sun: '#fff0d4', sunI: 1.7,
    cloud: '#fff8ec', cloudOpacity: 0.5, cloudY: [-14, -7], props: 'sanctuary'
  },
  lava_citadel: {
    floor: 'lava_floor', sky: 'lava_sky', cliff: ['#5e423a', '#1c1210'], under: '#2b1a16', trim: '#ff7a1a', trimGlow: 2.2,
    fog: '#3d150e', fogNear: 40, fogFar: 105, hemiSky: '#ffc49e', hemiGround: '#4a1c12', hemiI: 0.9, sun: '#ffd6b0', sunI: 1.6,
    cloud: '#5c1d10', cloudOpacity: 0.6, cloudY: [-6, -2], props: 'lava'
  },
  cyber_rooftop: {
    floor: 'astral_floor', sky: 'astral_sky', cliff: ['#46508a', '#131833'], under: '#1c2245', trim: '#7dd3fc', trimGlow: 1.8,
    fog: '#1c2050', fogNear: 45, fogFar: 115, hemiSky: '#d6dcff', hemiGround: '#2a2466', hemiI: 1.0, sun: '#e6ebff', sunI: 1.5,
    cloud: '#9f86ff', cloudOpacity: 0.45, cloudY: [-12, -4], props: 'astral'
  }
};

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}
function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
}

function makeLavaTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#7a1405';
  g.fillRect(0, 0, S, S);
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = 10 + r() * 40;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      const hot = r() > 0.6;
      grd.addColorStop(0, hot ? 'rgba(255,236,140,0.95)' : 'rgba(255,120,30,0.8)');
      grd.addColorStop(1, 'rgba(255,80,10,0)');
      g.fillStyle = grd;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(40,10,6,0.55)';
    g.beginPath();
    g.ellipse(r() * S, r() * S, 8 + r() * 22, 5 + r() * 12, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Stage {
  constructor(map) {
    this.map = map;
    this.theme = THEMES[map.id] || THEMES.sky_temple;
    this.group = new THREE.Group();
    this.animated = [];
    this.disposables = [];
    if (!CLOUD_TEX) CLOUD_TEX = makeCloudTexture(3);
    if (!CIRCLE_TEX) CIRCLE_TEX = makeMagicCircle();

    this.buildPlatforms();
    this.buildJumpPads();
    this.buildVoid();
    this.buildClouds();
    this.buildProps();
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  applyEnvironment(scene, hemi, sun) {
    const th = this.theme;
    scene.background = loadTex(th.sky);
    scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    hemi.color.set(th.hemiSky);
    hemi.groundColor.set(th.hemiGround);
    hemi.intensity = th.hemiI;
    sun.color.set(th.sun);
    sun.intensity = th.sunI;
  }

  floorY(x, z, y) {
    let best = null;
    for (const p of this.map.platforms) {
      if (x >= p.x && x <= p.x + p.w && z >= p.z && z <= p.z + p.d && y >= p.y - 0.45) {
        if (best === null || p.y > best) best = p.y;
      }
    }
    return best;
  }

  buildPlatforms() {
    const th = this.theme;
    const floorTex = loadTex(th.floor);
    const cliffBase = this.track(makeCliffTexture(th.cliff[0], th.cliff[1]));
    for (const p of this.map.platforms) {
      const h = p.h || 2;
      const cx = p.x + p.w / 2;
      const cz = p.z + p.d / 2;
      const main = p.y <= 0.01;
      const side = cliffBase.clone();
      side.repeat.set(p.w / 6, h / 3);
      side.needsUpdate = true;
      this.track(side);
      const sideMat = this.track(lambert('#ffffff', { map: side }));
      const topMat = this.track(lambert(main ? '#ffffff' : '#ffc2a8', { map: floorTex }));
      const underMat = this.track(lambert(th.under));
      const box = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, h, p.d)), [sideMat, sideMat, topMat, underMat, sideMat, sideMat]);
      box.position.set(cx, p.y - h / 2, cz);
      box.receiveShadow = true;
      box.castShadow = !main;
      this.group.add(box);

      // Raised gold / glowing trim along the top edge
      const trimMat = th.trimGlow
        ? this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(th.trim).multiplyScalar(th.trimGlow) }))
        : this.track(toon(th.trim));
      const tw = 0.24, tH = 0.12;
      for (const [w, d, ox, oz] of [[p.w + tw, tw, 0, -p.d / 2], [p.w + tw, tw, 0, p.d / 2], [tw, p.d, -p.w / 2, 0], [tw, p.d, p.w / 2, 0]]) {
        const bar = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, tH, d)), trimMat);
        bar.position.set(cx + ox, p.y + tH / 2 - 0.02, cz + oz);
        bar.receiveShadow = true;
        this.group.add(bar);
      }

      // Floating-island underside: inverted rocky pyramid plus a few hanging chunks
      if (main) {
        const rockMat = this.track(lambert(th.under, { map: side }));
        const rad = (p.w / 2) * Math.SQRT2 * 0.985;
        const cone = new THREE.Mesh(this.track(new THREE.ConeGeometry(rad, 10, 4, 3)), rockMat);
        cone.rotation.set(Math.PI, Math.PI / 4, 0);
        cone.position.set(cx, p.y - h - 5, cz);
        this.group.add(cone);
        const chunks = [[-0.25, -0.2, 0.45, 7], [0.3, 0.15, 0.35, 6], [0.05, 0.35, 0.3, 5]];
        for (const [fx, fz, fr, fh] of chunks) {
          const ch = new THREE.Mesh(this.track(new THREE.ConeGeometry(p.w * fr * 0.5, fh, 5)), rockMat);
          ch.rotation.x = Math.PI;
          ch.position.set(cx + fx * p.w, p.y - h - fh / 2 + 0.5, cz + fz * p.d);
          this.group.add(ch);
        }
      }
    }
  }

  buildJumpPads() {
    for (const jp of this.map.jumpPads || []) {
      const mat = this.track(new THREE.MeshBasicMaterial({
        map: CIRCLE_TEX, color: new THREE.Color('#38bdf8').multiplyScalar(1.8), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const disc = new THREE.Mesh(this.track(new THREE.PlaneGeometry(jp.r * 2.4, jp.r * 2.4)), mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(jp.x, 0.05, jp.z);
      this.group.add(disc);
      const core = new THREE.Mesh(this.track(new THREE.CircleGeometry(jp.r * 0.55, 24)),
        this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#7dd3fc').multiplyScalar(1.4), transparent: true, opacity: 0.5, depthWrite: false })));
      core.rotation.x = -Math.PI / 2;
      core.position.set(jp.x, 0.04, jp.z);
      this.group.add(core);
      this.animated.push((t) => {
        disc.rotation.z = t * 0.8;
        core.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
      });
    }
  }

  buildVoid() {
    const th = this.theme;
    const voidY = (this.map.voidY ?? -6.5) - 6;
    if (th.props === 'lava') {
      const tex = this.track(makeLavaTexture());
      tex.repeat.set(14, 14);
      const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(1.35), fog: true }));
      const lava = new THREE.Mesh(this.track(new THREE.PlaneGeometry(400, 400)), mat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = voidY;
      this.group.add(lava);
      this.animated.push((t) => {
        tex.offset.set(t * 0.01, t * 0.006);
      });
    } else if (th.props === 'astral') {
      const n = 1400;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 90;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = -8 - Math.random() * 40;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const g = this.track(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, this.track(new THREE.PointsMaterial({ color: new THREE.Color('#e0e7ff').multiplyScalar(2), size: 0.35, sizeAttenuation: true, fog: false })));
      this.group.add(stars);
    }
  }

  buildClouds() {
    const th = this.theme;
    let seed = 17;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      const mat = this.track(new THREE.SpriteMaterial({ map: CLOUD_TEX, color: th.cloud, transparent: true, opacity: th.cloudOpacity * (0.6 + r() * 0.4), depthWrite: false }));
      const s = new THREE.Sprite(mat);
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 40;
      s.position.set(Math.cos(a) * d, th.cloudY[0] + r() * (th.cloudY[1] - th.cloudY[0]), Math.sin(a) * d);
      const sz = 14 + r() * 20;
      s.scale.set(sz * 1.6, sz, 1);
      s.userData.drift = 0.3 + r() * 0.6;
      this.group.add(s);
      clouds.push(s);
    }
    this.animated.push((t, dt) => {
      for (const s of clouds) {
        s.position.x += s.userData.drift * dt;
        if (s.position.x > 60) s.position.x = -60;
      }
    });
  }

  // Decorative floating islets around the arena (screen-left/right/back)
  islet(x, y, z, r, kind) {
    const th = this.theme;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const topColor = kind === 'lava' ? '#3a2622' : kind === 'astral' ? '#3b3f77' : '#86b86a';
    const rockColor = kind === 'lava' ? '#24160f' : kind === 'astral' ? '#1f2350' : '#8a6e50';
    const top = new THREE.Mesh(this.track(new THREE.CylinderGeometry(r, r * 0.92, 0.6, 9)), this.track(toon(topColor)));
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const under = new THREE.Mesh(this.track(new THREE.ConeGeometry(r * 0.92, r * 2.4, 9)), this.track(toon(rockColor)));
    under.rotation.x = Math.PI;
    under.position.y = -0.3 - r * 1.2;
    g.add(under);

    let seed = Math.floor(Math.abs(x * 13 + z * 7)) + 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (kind === 'sanctuary') {
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * r * 0.55;
        g.add(this.tree(Math.cos(a) * d, 0.3, Math.sin(a) * d, 0.8 + rnd() * 0.6));
      }
    } else if (kind === 'lava') {
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.35 + rnd() * 0.3, 1.5 + rnd() * 2, 5)), this.track(toon('#1b1210')));
        sp.position.set(Math.cos(a) * r * 0.5, 1.0, Math.sin(a) * r * 0.5);
        sp.castShadow = true;
        g.add(sp);
      }
    } else {
      const c = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.6 + rnd() * 0.5, 0)),
        this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(th.trim).multiplyScalar(1.6) })));
      c.position.y = 1.6;
      c.scale.y = 1.7;
      g.add(c);
      this.animated.push((t) => {
        c.rotation.y = t * 0.6;
        c.position.y = 1.6 + Math.sin(t * 1.3 + x) * 0.2;
      });
    }
    this.group.add(g);
    const base = y;
    const ph = rnd() * 6;
    this.animated.push((t) => {
      g.position.y = base + Math.sin(t * 0.5 + ph) * 0.25;
    });
    return g;
  }

  tree(x, y, z, s) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    const trunk = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 7)), this.track(toon('#7a5236')));
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = this.track(toon('#5f9e4f'));
    const leafHi = this.track(toon('#8cc46a'));
    for (const [lx, ly, lz, lr, m] of [[0, 1.75, 0, 0.75, leaf], [0.35, 1.45, 0.15, 0.5, leafHi], [-0.32, 1.5, -0.1, 0.55, leaf], [0.05, 2.25, 0.05, 0.48, leafHi]]) {
      const f = new THREE.Mesh(this.track(new THREE.IcosahedronGeometry(lr, 1)), m);
      f.position.set(lx, ly, lz);
      f.castShadow = true;
      g.add(f);
    }
    return g;
  }

  column(x, z, height, broken) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const stone = this.track(toon('#efe4cc'));
    const base = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.2, 0.35, 1.2)), stone);
    base.position.y = 0.17;
    const shaft = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.42, 0.46, height, 12)), stone);
    shaft.position.y = 0.35 + height / 2;
    for (const m of [base, shaft]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    if (broken) {
      const top = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.44, 0.5, 6)), stone);
      top.position.y = 0.35 + height + 0.2;
      top.rotation.z = 0.35;
      top.castShadow = true;
      g.add(top);
    } else {
      const cap = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.15, 0.3, 1.15)), stone);
      cap.position.y = 0.35 + height + 0.15;
      cap.castShadow = true;
      g.add(cap);
      const vine = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.47, 0.06, 5, 16)), this.track(toon('#6aa35a')));
      vine.rotation.x = Math.PI / 2 - 0.3;
      vine.position.y = height * 0.6;
      g.add(vine);
    }
    this.group.add(g);
  }

  buildProps() {
    const kind = this.theme.props;
    const islets = [[-24, -3, 6, 3.2], [6, -2.5, -24, 3.6], [-18, 1.5, -22, 2.6], [14, -4, -22, 2.4], [-23, -5, 15, 2.2], [20, -6, -10, 2.8], [-10, -7, -30, 3.4], [-34, 2, -12, 3.0]];
    for (const [x, y, z, r] of islets) this.islet(x, y, z, r, kind);

    const main = this.map.platforms[0];
    if (!main) return;
    const e = main.w / 2 - 0.8;
    if (kind === 'sanctuary') {
      this.column(-e, -e, 3.4, false);
      this.column(e, -e, 2.2, true);
      this.column(-e, e, 1.5, true);
      // Grass & flower tufts along the rim
      const tuft = this.track(new THREE.ConeGeometry(0.09, 0.32, 4));
      const inst = new THREE.InstancedMesh(tuft, this.track(toon('#79b45c')), 160);
      const flowers = new THREE.InstancedMesh(this.track(new THREE.IcosahedronGeometry(0.07, 0)), this.track(toon('#fff3b0')), 40);
      const m4 = new THREE.Matrix4();
      let fi = 0;
      for (let i = 0; i < 160; i++) {
        const side = i % 4;
        const t = (Math.random() - 0.5) * main.w * 0.96;
        const inset = 0.25 + Math.random() * 0.6;
        const x = side === 0 ? t : side === 1 ? t : side === 2 ? -main.w / 2 + inset : main.w / 2 - inset;
        const z = side === 0 ? -main.d / 2 + inset : side === 1 ? main.d / 2 - inset : t;
        m4.makeRotationY(Math.random() * 3);
        m4.setPosition(x, 0.14, z);
        inst.setMatrixAt(i, m4);
        if (fi < 40 && Math.random() < 0.3) {
          m4.makeTranslation(x + 0.1, 0.28, z + 0.05);
          flowers.setMatrixAt(fi++, m4);
        }
      }
      flowers.count = fi;
      this.group.add(inst, flowers);
    } else if (kind === 'lava') {
      for (const [x, z] of [[-e, -e], [e, -e], [-e, e]]) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const bowl = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.6, 0.35, 0.7, 10)), this.track(toon('#2a1d1a')));
        bowl.position.y = 0.9;
        const leg = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.15, 0.3, 0.6, 8)), this.track(toon('#1a1210')));
        leg.position.y = 0.3;
        const flame = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.45, 1.1, 8)),
          this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(2.4), transparent: true, opacity: 0.9, depthWrite: false })));
        flame.position.y = 1.75;
        bowl.castShadow = leg.castShadow = true;
        g.add(bowl, leg, flame);
        this.group.add(g);
        const ph = x * 0.3;
        this.animated.push((t) => {
          const s = 0.85 + Math.sin(t * 13 + ph) * 0.1 + Math.sin(t * 7.3 + ph) * 0.08;
          flame.scale.set(1 / s, s, 1 / s);
        });
      }
    } else {
      for (const [x, z, s] of [[-e, -e, 1.3], [e, -e, 1.0], [-e, e, 0.9]]) {
        const c = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.55 * s, 0)),
          this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#a5b4fc').multiplyScalar(1.7) })));
        c.scale.y = 1.8;
        c.position.set(x, 1.8 * s, z);
        this.group.add(c);
        this.animated.push((t) => {
          c.rotation.y = t * 0.7 + x;
          c.position.y = 1.8 * s + Math.sin(t * 1.5 + z) * 0.22;
        });
      }
    }
  }

  update(t, dt) {
    for (const fn of this.animated) fn(t, dt);
  }

  dispose() {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose?.();
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
  }
}
