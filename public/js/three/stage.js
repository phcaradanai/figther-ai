// ============================================================================
// 3D arena for the Three.js renderer: floating island platforms built from the
// shared MAPS data, painted floor/sky textures, props, clouds and themed voids.
// ============================================================================
import * as THREE from 'three';
import { makeCliffTexture, makeCloudTexture, makeMagicCircle, makeToonRamp } from './textures.js';
import { makeArenaFloor, makeArenaSky, makeTideTexture } from './arena_textures.js';

const loader = new THREE.TextureLoader();
const texCache = new Map();
const paintedArenas = new Map();
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
    cloud: '#fff8ec', cloudOpacity: 0.33, cloudY: [-15, -8], props: 'sanctuary', skyIntensity: 0.88
  },
  lava_citadel: {
    floor: 'lava_floor', ridges: ['#806668', '#63505c', '#493d4a'],
    cliff: ['#57443e', '#242026'], under: '#2b2327', trim: '#df875f', trimGlow: 1.22,
    fog: '#5b4549', fogNear: 38, fogFar: 110, hemiSky: '#edcbbb', hemiGround: '#543b40', hemiI: 0.9, sun: '#efd3c2', sunI: 1.45,
    cloud: '#a07b75', cloudOpacity: 0.23, cloudY: [-9, -5], props: 'lava'
  },
  cyber_rooftop: {
    surface: ['#2d415c', '#172943', '#47677e', '#293b51'], ridges: ['#728799', '#596e81', '#465a70'],
    cliff: ['#4b5e76', '#212b40'], under: '#25354a', trim: '#82cbdc', trimGlow: 1.32,
    fog: '#617487', fogNear: 48, fogFar: 115, hemiSky: '#dae4f3', hemiGround: '#536079', hemiI: 1.0, sun: '#e4edf3', sunI: 1.4,
    cloudOpacity: 0, props: 'astral'
  },
  tideglass_harbor: {
    props: 'harbor', surface: ['#9e6242', '#442d28', '#c38e61', '#825237'],
    ridges: ['#a8b5a6', '#8fa5a0', '#698e92'],
    cliff: ['#876250', '#49342b'], under: '#3d554d', trim: '#e2bb76',
    fog: '#a0b6b5', fogNear: 38, fogFar: 120, hemiSky: '#f5eee0', hemiGround: '#7f9f9f', hemiI: 1.05, sun: '#f4e6cb', sunI: 1.38,
    cloudOpacity: 0
  },
  brasswind_courier: {
    props: 'courier', surface: ['#597882', '#2f4555', '#7fa0a1', '#405c6a'],
    ridges: [],
    cliff: ['#73604a', '#2c2a32'], under: '#795b4e', trim: '#e9b454',
    fog: '#bbc0ca', fogNear: 43, fogFar: 130, hemiSky: '#f7f0e5', hemiGround: '#8b93a8', hemiI: 1.04, sun: '#f9ddbb', sunI: 1.45,
    cloud: '#eff1ed', cloudOpacity: 0.36, cloudY: [-16, -7]
  },
  mossgate_ruins: {
    props: 'ruins', surface: ['#6b7653', '#3a4839', '#8f9772', '#5d654b'],
    ridges: ['#a6af8d', '#778f76', '#4d7466'],
    cliff: ['#788469', '#424932'], under: '#414d3c', trim: '#b7ae7a',
    fog: '#9dac85', fogNear: 38, fogFar: 105, hemiSky: '#edf2cb', hemiGround: '#5c7761', hemiI: 1.12, sun: '#fff3c7', sunI: 1.4,
    cloud: '#d0d8b9', cloudOpacity: 0.27, cloudY: [-14, -6]
  },
  frostline_pass: {
    props: 'snow', surface: ['#b9d7de', '#7798b4', '#e0eff0', '#a5c5d4'],
    ridges: ['#b5c8d6', '#8da9c3', '#6889ab'],
    cliff: ['#7b9fbb', '#395771'], under: '#507a9b', trim: '#effcfb',
    fog: '#c1d5e2', fogNear: 45, fogFar: 120, hemiSky: '#e4f1ff', hemiGround: '#7696b6', hemiI: 0.96, sun: '#fff3de', sunI: 1.38,
    cloud: '#e1ecf3', cloudOpacity: 0.33, cloudY: [-15, -7]
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
  g.fillStyle = '#412b31';
  g.fillRect(0, 0, S, S);
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = 10 + r() * 40;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      const hot = r() > 0.6;
      grd.addColorStop(0, hot ? 'rgba(231,132,79,0.78)' : 'rgba(155,72,56,0.48)');
      grd.addColorStop(1, 'rgba(155,72,56,0)');
      g.fillStyle = grd;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(44,31,38,0.4)';
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
    if (!paintedArenas.has(map.id)) {
      paintedArenas.set(map.id, {
        floor: this.theme.surface ? makeArenaFloor(this.theme) : null,
        sky: this.theme.ridges ? makeArenaSky(map, this.theme) : null
      });
    }
    this.painting = paintedArenas.get(map.id);
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
    scene.background = this.painting?.sky || loadTex(th.sky);
    scene.backgroundIntensity = th.skyIntensity ?? 1;
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
    const paintedFloor = this.painting.floor;
    const floorTex = paintedFloor || loadTex(th.floor);
    const cliffBase = this.track(makeCliffTexture(th.cliff[0], th.cliff[1]));
    const trimMat = th.trimGlow
      ? this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(th.trim).multiplyScalar(th.trimGlow) }))
      : this.track(toon(th.trim));
    for (const p of this.map.platforms) {
      const h = p.h || 2;
      const cx = p.x + p.w / 2;
      const cz = p.z + p.d / 2;
      const side = cliffBase.clone();
      side.repeat.set(p.w / 6, h / 3);
      side.needsUpdate = true;
      this.track(side);
      const sideMat = this.track(lambert('#ffffff', { map: side }));
      const top = paintedFloor ? this.track(floorTex.clone()) : floorTex;
      if (paintedFloor) {
        top.repeat.set(p.w / 8, p.d / 8);
        top.needsUpdate = true;
      }
      const topTint = p.y > 0.01 && !paintedFloor ? '#ffcabc' : '#ffffff';
      const topMat = this.track(lambert(topTint, { map: top }));
      const underMat = this.track(lambert(th.under));
      const box = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, h, p.d)), [sideMat, sideMat, topMat, underMat, sideMat, sideMat]);
      box.position.set(cx, p.y - h / 2, cz);
      box.receiveShadow = true;
      box.castShadow = p.y > 0.01;
      this.group.add(box);

      // Raised gold / glowing trim along the top edge
      const tw = 0.2, tH = 0.1;
      const rimX = (p.w - tw) / 2;
      const rimZ = (p.d - tw) / 2;
      for (const [w, d, ox, oz] of [
        [p.w, tw, 0, -rimZ], [p.w, tw, 0, rimZ],
        [tw, p.d - 2 * tw, -rimX, 0], [tw, p.d - 2 * tw, rimX, 0]
      ]) {
        const bar = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, tH, d)), trimMat);
        bar.position.set(cx + ox, p.y + tH / 2 - 0.02, cz + oz);
        bar.receiveShadow = true;
        this.group.add(bar);
      }

      // Floating-island underside: inverted rocky pyramid plus a few hanging chunks
      if (h >= 2.5 && ['sanctuary', 'ruins', 'snow'].includes(th.props)) {
        const rockMat = this.track(lambert(th.under, { map: side }));
        // Stretch the already-rotated rock to fit rectangular ledges.
        const rock = new THREE.ConeGeometry(Math.SQRT1_2, 8, 4, 3).rotateY(Math.PI / 4);
        const cone = new THREE.Mesh(this.track(rock), rockMat);
        cone.rotation.x = Math.PI;
        cone.scale.set(p.w * 0.985, 1, p.d * 0.985);
        cone.position.set(cx, p.y - h - 4, cz);
        this.group.add(cone);
        const chunks = [[-0.25, -0.2, 0.45, 7], [0.3, 0.15, 0.35, 6], [0.05, 0.35, 0.3, 5]];
        for (const [fx, fz, fr, fh] of chunks) {
          const ch = new THREE.Mesh(this.track(new THREE.ConeGeometry(Math.min(p.w, p.d) * fr * 0.5, fh, 5)), rockMat);
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
      const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, fog: true }));
      const lava = new THREE.Mesh(this.track(new THREE.PlaneGeometry(400, 400)), mat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = voidY;
      this.group.add(lava);
      this.animated.push((t) => {
        tex.offset.set(t * 0.01, t * 0.006);
      });
    } else if (th.props === 'harbor') {
      const tex = this.track(makeTideTexture());
      tex.repeat.set(22, 26);
      const sea = new THREE.Mesh(this.track(new THREE.PlaneGeometry(260, 260)),
        this.track(lambert('#c2d7d2', { map: tex })));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = this.map.voidY - 0.35;
      this.group.add(sea);
      this.animated.push(t => tex.offset.set(t * 0.025, t * 0.011));
    }
  }

  buildClouds() {
    const th = this.theme;
    if (!th.cloudOpacity) return;
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
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const topColor = kind === 'lava' ? '#514047' : '#829f6f';
    const rockColor = kind === 'lava' ? '#342c32' : '#837257';
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
    } else {
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.35 + rnd() * 0.3, 1.5 + rnd() * 2, 5)), this.track(toon('#1b1210')));
        sp.position.set(Math.cos(a) * r * 0.5, 1.0, Math.sin(a) * r * 0.5);
        sp.castShadow = true;
        g.add(sp);
      }
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
    if (kind === 'harbor') {
      this.buildHarborSupports();
      this.buildHarborBackdrop();
      return;
    }
    if (kind === 'courier') {
      this.buildCourierHull();
      return;
    }
    const islets = [[-24, -3, 6, 3.2], [6, -2.5, -24, 3.6], [-18, 1.5, -22, 2.6], [14, -4, -22, 2.4], [-23, -5, 15, 2.2], [20, -6, -10, 2.8], [-10, -7, -30, 3.4], [-34, 2, -12, 3.0]];
    if (kind === 'snow') return;
    if (kind === 'ruins') {
      for (const [x, y, z, r] of islets) this.islet(x * 1.25, y - 2, z * 1.25, r, 'sanctuary');
      return;
    }
    if (kind !== 'astral') {
      for (const [x, y, z, r] of islets) this.islet(x * 1.22, y, z * 1.22, r, kind);
    }

    const main = this.map.platforms[0];
    if (!main) return;
    if (kind === 'sanctuary') {
      this.column(main.x + 0.8, main.z + 0.8, 3.4, false);
      this.column(main.x + main.w - 0.8, main.z + 0.8, 2.2, true);
      this.column(main.x + 0.8, main.z + main.d - 0.8, 1.5, true);
      // Grass & flower tufts along the rim
      const tuft = this.track(new THREE.ConeGeometry(0.09, 0.32, 4));
      const inst = new THREE.InstancedMesh(tuft, this.track(toon('#79b45c')), 160);
      const flowers = new THREE.InstancedMesh(this.track(new THREE.IcosahedronGeometry(0.07, 0)), this.track(toon('#fff3b0')), 40);
      const m4 = new THREE.Matrix4();
      let fi = 0;
      for (let i = 0; i < 160; i++) {
        const side = i % 4;
        const t = 0.02 + Math.random() * 0.96;
        const inset = 0.25 + Math.random() * 0.6;
        const x = main.x + (side < 2 ? t * main.w : side === 2 ? inset : main.w - inset);
        const z = main.z + (side > 1 ? t * main.d : side === 0 ? inset : main.d - inset);
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
      const edge = main.x + 1.5;
      for (const [x, z] of [[edge, edge], [-edge, edge], [edge, -edge]]) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const bowl = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.6, 0.35, 0.7, 10)), this.track(toon('#2a1d1a')));
        bowl.position.y = 0.9;
        const leg = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.15, 0.3, 0.6, 8)), this.track(toon('#1a1210')));
        leg.position.y = 0.3;
        const flame = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.45, 1.1, 8)),
          this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff985e').multiplyScalar(1.5), transparent: true, opacity: 0.86, depthWrite: false })));
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
      const signal = this.track(new THREE.BoxGeometry(0.55, 1.85, 0.55));
      const steel = this.track(toon('#304758'));
      const marker = this.track(new THREE.BoxGeometry(0.42, 0.2, 0.42));
      const light = this.track(new THREE.MeshBasicMaterial({ color: '#9dd8df' }));
      for (const [x, z] of [[-17.8, -12.8], [17.8, 12.8], [-17.8, 9.8]]) {
        const post = new THREE.Mesh(signal, steel);
        post.position.set(x, 0.925, z);
        const cap = new THREE.Mesh(marker, light);
        cap.position.set(x, 1.95, z);
        this.group.add(post, cap);
      }
      this.buildCityBackdrop();
    }
  }

  buildHarborSupports() {
    const piling = this.track(new THREE.CylinderGeometry(0.24, 0.32, 5, 8));
    const material = this.track(toon('#49392d'));
    for (const p of this.map.platforms.filter(platform => platform.y === 0)) {
      for (const x of [p.x + 0.65, p.x + p.w / 2, p.x + p.w - 0.65]) {
        for (const z of [p.z + 0.65, p.z + p.d - 0.65]) {
          const post = new THREE.Mesh(piling, material);
          post.position.set(x, -3.2, z);
          this.group.add(post);
        }
      }
    }
  }

  buildHarborBackdrop() {
    const rock = this.track(new THREE.IcosahedronGeometry(1, 1));
    const stone = this.track(lambert('#778b84', { flatShading: true }));
    for (const [x, z, width, height, depth] of [[-26, -15, 4, 4.5, 4], [-29, 3, 5, 3, 5], [3, -28, 7, 3.9, 5], [18, -24, 4, 3.5, 4]]) {
      const stack = new THREE.Mesh(rock, stone);
      stack.scale.set(width, height, depth);
      stack.position.set(x, -6, z);
      this.group.add(stack);
    }
    const tower = new THREE.Group();
    tower.position.set(-26, -2.7, -15);
    const body = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.58, 1, 4.4, 10)),
      this.track(toon('#d0c3a2')));
    body.position.y = 2.2;
    const cap = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.94, 1, 10)),
      this.track(toon('#885c51')));
    cap.position.y = 4.95;
    const windowBand = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.66, 0.68, 0.56, 10)),
      this.track(toon('#53636a')));
    windowBand.position.y = 4.25;
    tower.add(body, cap, windowBand);
    this.group.add(tower);
  }

  buildCourierHull() {
    const deck = this.map.platforms[0];
    const hull = new THREE.Mesh(this.track(new THREE.SphereGeometry(1, 28, 16)),
      this.track(toon('#76514a')));
    hull.position.y = -3.2;
    hull.scale.set(deck.w / 2, 2.6, deck.d * 0.49);
    this.group.add(hull);

    const brass = this.track(toon('#b48b55'));
    const casing = this.track(new THREE.CylinderGeometry(0.72, 0.86, 3.4, 12));
    const blade = this.track(new THREE.BoxGeometry(0.12, 3.3, 0.25));
    for (const side of [-1, 1]) {
      const engine = new THREE.Mesh(casing, brass);
      engine.rotation.z = Math.PI / 2;
      const engineX = deck.x + deck.w * 0.25;
      const engineZ = side * (deck.d / 2 + 0.15);
      engine.position.set(engineX, -2.5, engineZ);
      this.group.add(engine);
      const propeller = new THREE.Group();
      propeller.position.set(engineX - 1.8, -2.5, engineZ);
      const a = new THREE.Mesh(blade, brass);
      const b = new THREE.Mesh(blade, brass);
      b.rotation.x = Math.PI / 2;
      propeller.add(a, b);
      this.group.add(propeller);
      this.animated.push(t => { propeller.rotation.x = side * t * 9; });
    }
  }

  buildCityBackdrop() {
    const box = this.track(new THREE.BoxGeometry(1, 1, 1));
    const walls = this.track(lambert('#46566c'));
    const roofs = this.track(lambert('#657c8f'));
    for (const [x, z, width, height, depth] of [
      [-27, -13, 7, 24, 10], [-37, 1, 9, 34, 7], [-31, 15, 8, 21, 6],
      [-14, -27, 8, 24, 7], [1, -30, 9, 28, 9], [17, -27, 7, 22, 8],
      [29, -14, 9, 29, 7], [30, 12, 10, 22, 8]
    ]) {
      const tower = new THREE.Mesh(box, [walls, walls, roofs, walls, walls, walls]);
      tower.scale.set(width, height, depth);
      tower.position.set(x, -15 - height * 0.35, z);
      this.group.add(tower);
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
