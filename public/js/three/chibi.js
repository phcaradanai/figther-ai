// ============================================================================
// Chibi 3D characters for the Three.js renderer
// - Rigid-part rig (hips/torso/head/arms/legs) built from primitives
// - Mixed gear: armor, helmet, weapon and trinket each come from their own hero
// - Keyframed AnimationClips (anticipation -> strike -> follow-through) played
//   through an AnimationMixer with crossfades, plus hit-stop, hit flash,
//   squash & stretch and spring-driven capes
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { makeToonRamp } from './textures.js';
import { buildKnightLocomotion, knightIdle } from './knight_motion.js';
import { buildKnightAttacks, buildKnightSkills, KNIGHT_AIRBORNE, KNIGHT_STRIKES } from './knight_attacks.js';
import { KnightFootwork } from './knight_footwork.js';
import { CapeCloth } from './cape_cloth.js';

const gltfLoader = new GLTFLoader();

// The Blender file stores a display arrangement. Each mesh's geometry is local
// to its named socket, so actors can share geometry while wearing different gear.
const workshopPromise = gltfLoader.loadAsync('/assets/models/hero-workshop.glb')
  .then(gltf => gltf.scene)
  .catch(error => { console.warn('Character workshop unavailable', error); return null; });

// Skinned hero models: each GLB carries a HeroRig matching chibi.js bone names
// (plus optional cape chain bones). Loaded by default; pass ?skinned=0 to disable.
const SKINNED_HEROES = {
  knight: {
    url: '/assets/models/hero-knight.glb',
    gearUrl: '/assets/models/knight-gear.glb',
    hipHeight: 0.78,
    alignArms: true,
    narrowLegRest: true,
    painterly: true,
    stepFps: 0,
    headScale: 1.10,
    swordScale: 1.10,
    shieldScale: 1.08,
    fused: [],
    capeMesh: 'KnightCape',
    helmetMesh: 'KnightHelmet',
    swordMesh: 'KnightSword',
    shieldMesh: 'KnightShield',
    swordMount: { p: [0.029, -0.090, 0.006], rx: 0.38 },
    swordTrail: { base: [0, 0, 0.16], tip: [0, 0, 1.04] },
    otherHelmetScale: 0.56,
    otherHelmetOffset: [0, 0.03, 0.01],
    // Cape hem below the last cape bone, in that bone's space.
    capeTip: [0.003, -0.289, -0.105],
    // Mixamo clips baked by tools/rig/bake-mixamo.mjs, preferred over the code clips.
    bakedClips: {
      dead: '/assets/anims/knight/dead.json',
      attack1: '/assets/anims/knight/attack1.json',
      attack2: '/assets/anims/knight/attack2.json',
      attack3: '/assets/anims/knight/attack3.json',
      walk: '/assets/anims/knight/walk.json',
      run: '/assets/anims/knight/run.json',
      idle: '/assets/anims/knight/idle.json',
      idleFidget: '/assets/anims/knight/idleFidget.json',
      guard: '/assets/anims/knight/guard.json',
      guardHit: '/assets/anims/knight/guardHit.json',
      turnL: '/assets/anims/knight/turnL.json',
      turnR: '/assets/anims/knight/turnR.json',
      draw: '/assets/anims/knight/draw.json'
    },
    capeBones: [
      { name: 'cape1', weight: 0.22 },
      { name: 'cape2', weight: 0.38 },
      { name: 'cape3', weight: 0.40 }
    ]
  }
};
const SKIP_SKINNED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('skinned') === '0';
// Dev switch for comparing sources: ?handmade=all (or a comma list of clip names)
// plays the code-made Knight clips in place of the baked Mixamo ones.
const HANDMADE = typeof location !== 'undefined'
  ? (new URLSearchParams(location.search).get('handmade') || '').split(',').filter(Boolean) : [];
const FORCE_STEP = typeof location !== 'undefined' ? (Number(new URLSearchParams(location.search).get('step')) || 0) : 0;
const skinnedEntries = !SKIP_SKINNED
  ? await Promise.all(Object.entries(SKINNED_HEROES).map(async ([id, spec]) => {
    try {
      const [gltf, gearGltf, baked] = await Promise.all([
        gltfLoader.loadAsync(spec.url),
        spec.gearUrl
          ? gltfLoader.loadAsync(spec.gearUrl).catch(error => { console.warn(`Gear model unavailable for ${id}:`, error); return null; })
          : Promise.resolve(null),
        Promise.all(Object.entries(spec.bakedClips || {}).map(([name, url]) => fetch(url)
          .then(response => (response.ok ? response.json() : Promise.reject(new Error(`${response.status} ${url}`))))
          .then(data => [name, data])
          .catch(error => { console.warn(`Baked clip ${name} unavailable for ${id}:`, error); return null; })))
      ]);
      const bakedClips = Object.fromEntries(baked.filter(entry => entry && !HANDMADE.includes('all') && !HANDMADE.includes(entry[0])));
      return [id, { spec, scene: gltf.scene, gearScene: gearGltf?.scene || null, animations: gltf.animations || [], bakedClips }];
    } catch (error) {
      console.warn(`Skinned model unavailable for ${id}:`, error);
      return [id, null];
    }
  }))
  : [];
const SKINNED_MODELS = Object.fromEntries(skinnedEntries.filter(([, v]) => v));
// Baked strikes carry their own blade contact and trail window.
for (const [name, data] of Object.entries(SKINNED_MODELS.knight?.bakedClips || {})) {
  if (data.contact !== undefined && KNIGHT_STRIKES[name]) Object.assign(KNIGHT_STRIKES[name], { contact: data.contact, trail: data.trail });
}
const workshop = await workshopPromise;
const hairSwatch = new THREE.Color('#cfb390');
const leatherSwatch = new THREE.Color('#92735f');

// Nodes that move on their own (animated by clips or code). Everything else is
// static relative to its nearest animated ancestor and gets merged into it.
const ANIMATED_NODES = new Set(['body', 'hips', 'torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR', 'cape', 'orb', 'thruster', 'staff']);

// Which skills get a signature animation instead of the generic cast pose
export const SKILL_ANIM = {
  cowboy_weapon: 'spin', samurai_weapon: 'spin', reaper_weapon: 'spin',
  ninja_weapon: 'windslash', ninja_armor: 'seal', ninja_helmet: 'throw', ninja_trinket: 'backflip',
  viking_weapon: 'slam', striker_trinket: 'slam', knight_armor: 'slam',
  cowboy_helmet: 'rollshot', cowboy_armor: 'toss', cowboy_trinket: 'lasso',
  knight_weapon: 'sweep', knight_helmet: 'warcry', knight_trinket: 'charge',
  striker_weapon: 'flurry',
  mage_weapon: 'summon', mage_armor: 'nova', mage_helmet: 'raise', mage_trinket: 'blink'
};

function mergeKind(mat) {
  if (mat.transparent || mat.map || mat.userData.keepUnmerged || mat.userData.baseIntensity !== undefined) return null;
  if (mat.isMeshToonMaterial) return mat.side === THREE.DoubleSide ? 'toon2' : 'toon';
  if (mat.isMeshBasicMaterial) return 'basic';
  return null;
}

// Copy a primitive into anchor space as plain position/normal(/color) triangles
function bakeGeo(src, matrix, color) {
  const flat = src.index ? src.toNonIndexed() : src;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', flat.attributes.position.clone());
  g.setAttribute('normal', flat.attributes.normal.clone());
  g.applyMatrix4(matrix);
  if (color) {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r;
      c[i * 3 + 1] = color.g;
      c[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (flat !== src) flat.dispose();
  return g;
}

const RAMP = makeToonRamp();
const TOS_RAMP = (() => {
  // Smooth high-key storybook shading ramp (Tree of Savior M soft painted diffuse, no harsh gray bands)
  const N = 16;
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const v = Math.round((0.58 + 0.42 * (t * t * (3 - 2 * t))) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

function makeToSMaterial(srcMat) {
  const m = new THREE.MeshToonMaterial({
    map: srcMat?.map || null,
    color: srcMat?.color ? srcMat.color.clone() : new THREE.Color('#ffffff'),
    gradientMap: TOS_RAMP,
    side: srcMat?.side ?? THREE.FrontSide
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `// Tree of Savior M warm storybook split-tone + delicate warm-sepia ink contour
       float tosLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
       vec3 tosWarmTint = mix(vec3(0.99, 0.94, 0.97), vec3(1.05, 1.01, 0.94), clamp(tosLuma, 0.0, 1.0));
       outgoingLight *= tosWarmTint;
       float tosRim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
       float tosInk = smoothstep(0.72, 0.91, tosRim);
       outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.25, 0.17, 0.14), tosInk * 0.54);
       #include <opaque_fragment>`
    );
  };
  m.customProgramCacheKey = () => 'tos-painterly-storybook-v2';
  return m;
}
const SKIN = '#fde3cf';
const OUTLINE_COLOR = '#2b1b16';

export const HERO_LOOK = {
  knight:  { hair: '#cfb390', hairStyle: 'ponytail', sleeve: '#2d58a8', trim: '#e5b94c', boot: '#3c4a66', glove: '#d9d4c7', glow: '#60a5fa', style: 'shield' },
  ninja:   { hair: '#2d2842', hairStyle: 'spiky', sleeve: '#2a243d', trim: '#8b5cf6', boot: '#272336', glove: '#2c2540', glow: '#a855f7', style: 'shinobi' },
  mage:    { hair: '#a64d32', hairStyle: 'wavy',  sleeve: '#9e262e', trim: '#e5b84b', boot: '#5c2620', glove: '#f5d8c0', glow: '#fb923c', style: 'pyro', robe: 0.16 },
  cowboy:  { hair: '#805336', hairStyle: 'wavy',  sleeve: '#e6d8be', trim: '#b87a3b', boot: '#6b4226', glove: '#7a4d2c', glow: '#fbbf24', style: 'twingun' },
  samurai: { hair: '#24232b', hairStyle: 'bun',   sleeve: '#3a3034', trim: '#b82830', boot: '#382a2a', glove: '#403438', glow: '#f87171', style: 'blade', robe: 0.1 },
  witch:   { hair: '#e8e4d5', hairStyle: 'long',  sleeve: '#233b5c', trim: '#9be7f5', boot: '#2c415e', glove: '#e6f4f8', glow: '#67e8f9', style: 'cast', robe: 0.2 },
  cyborg:  { hair: '#cfdbe3', hairStyle: 'short', sleeve: '#ebe5dc', trim: '#d9682b', boot: '#d6cfc4', glove: '#d9682b', glow: '#38bdf8', style: 'gun' },
  viking:  { hair: '#c96b2c', hairStyle: 'braid', sleeve: '#70492e', trim: '#c7a47b', boot: '#5c3a21', glove: '#6e472b', glow: '#fb923c', style: 'blade' },
  striker: { hair: '#4f3322', hairStyle: 'spiky', sleeve: '#e6b83c', trim: '#c9302c', boot: '#a62929', glove: '#d99e32', glow: '#fde047', style: 'fist' },
  reaper:  { hair: '#ccc7cf', hairStyle: 'long',  sleeve: '#3e2954', trim: '#b4a7c7', boot: '#2c1f3b', glove: '#2b1d3b', glow: '#e879f9', style: 'blade', robe: 0.26 }
};
const BARE = { sleeve: '#d9cdb8', trim: '#8a6946', boot: '#694a30', glove: '#f5d7be' };

const STEEL = '#dfe6ee';
const GOLD = '#e8b84a';
const IRON = '#8a8f98';
const WOOD = '#7a4a2a';
const GUNMETAL = '#4b5563';

// ---------------------------------------------------------------------------
// Geometry cache (shared by every character; never disposed)
// ---------------------------------------------------------------------------
const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
const G = {
  sphere: (r, w = 16, h = 12) => geo(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
  capsule: (r, l) => geo(`c${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10)),
  box: (w, h, d) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, seg = 12, open = false) => geo(`y${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  cone: (r, h, seg = 10) => geo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  torus: (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => geo(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  octa: (r) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0))
};

function darker(hex, k) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

// ---------------------------------------------------------------------------
// Per-character builder: owns its materials so flashes/opacity are per player
// ---------------------------------------------------------------------------
class Builder {
  constructor() {
    this.materials = [];
    this.skeletons = [];
    this.cache = new Map();
    this.glows = [];
    this.outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    this.materials.push(this.outlineMat);
  }
  model(parent, name, opts = {}, tint, swatch) {
    const piece = workshop.getObjectByName(name);
    const key = `model|${piece.material.uuid}|${tint || ''}|${swatch?.getHexString() || ''}`;
    let material = this.cache.get(key);
    if (!material) {
      material = piece.material.clone();
      if (tint) {
        const c = material.color.set(tint);
        if (swatch) c.setRGB(c.r / swatch.r, c.g / swatch.g, c.b / swatch.b);
      }
      this.cache.set(key, material);
      this.materials.push(material);
    }
    return this.part(parent, piece.geometry, material, { outline: 0, ...opts });
  }
  glbPart(parent, scene, name, opts = {}) {
    const piece = scene?.getObjectByName(name);
    if (!piece?.isMesh) return null;
    const { painterly, ...partOpts } = opts;
    const key = `glb|${painterly ? 'tos|' : ''}${piece.material.uuid}`;
    let material = this.cache.get(key);
    if (!material) {
      material = painterly ? makeToSMaterial(piece.material) : piece.material.clone();
      if (painterly) material.userData.keepUnmerged = true;
      this.cache.set(key, material);
      this.materials.push(material);
    }
    return this.part(parent, piece.geometry, material, { outline: 0, ...partOpts });
  }
  toon(color, opts = {}) {
    const key = `t${color}|${opts.side || 0}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, side: opts.side || THREE.FrontSide });
    this.cache.set(key, m);
    this.materials.push(m);
    return m;
  }
  basic(color, opts = {}) {
    const key = `b${color}|${opts.opacity ?? 1}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshBasicMaterial({ color, transparent: opts.opacity !== undefined, opacity: opts.opacity ?? 1, depthWrite: opts.opacity === undefined });
    this.cache.set(key, m);
    this.materials.push(m);
    return m;
  }
  // HDR-bright unlit material that the bloom pass picks up
  glow(color, intensity = 2.2) {
    const key = `g${color}|${intensity}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
    m.userData.baseIntensity = intensity;
    m.userData.baseColor = new THREE.Color(color);
    this.cache.set(key, m);
    this.materials.push(m);
    this.glows.push(m);
    return m;
  }
  part(parent, geometry, material, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], q = null, outline = 0.06, shadow = true } = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p[0], p[1], p[2]);
    if (q) mesh.quaternion.copy(q);
    else mesh.rotation.set(r[0], r[1], r[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    mesh.castShadow = shadow;
    mesh.userData.outline = workshop ? outline * 0.5 : outline;
    parent.add(mesh);
    return mesh;
  }

  // Merge every opaque part into one vertex-coloured mesh (+ one outline mesh)
  // per animated node: ~70 meshes x2 per character become ~30 draw calls.
  bake(root) {
    root.updateMatrixWorld(true);
    const anchors = [root];
    root.traverse((o) => { if (o !== root && ANIMATED_NODES.has(o.name)) anchors.push(o); });
    const merged = {
      toon: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.73, metalness: 0.045 }),
      toon2: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.73, metalness: 0.045, side: THREE.DoubleSide }),
      basic: new THREE.MeshBasicMaterial({ vertexColors: true })
    };
    const keep = new Set([this.outlineMat]);
    this.geos = [];
    const inv = new THREE.Matrix4();
    const rel = new THREE.Matrix4();
    const grow = new THREE.Matrix4();
    for (const anchor of anchors) {
      inv.copy(anchor.matrixWorld).invert();
      const parts = [];
      const collect = (obj) => {
        for (const child of obj.children) {
          if (ANIMATED_NODES.has(child.name)) continue;
          if (child.isSkinnedMesh) {
            if (Array.isArray(child.material)) child.material.forEach(m => keep.add(m));
            else if (child.material) keep.add(child.material);
            continue;
          }
          if (child.isMesh) parts.push(child);
          else collect(child);
        }
      };
      collect(anchor);
      const buckets = { toon: [], toon2: [], basic: [] };
      const outlines = [];
      for (const mesh of parts) {
        const kind = mergeKind(mesh.material);
        const ol = mesh.userData.outline || 0;
        if (!kind) {
          keep.add(mesh.material);
          if (ol > 0) {
            const o = new THREE.Mesh(mesh.geometry, this.outlineMat);
            o.scale.setScalar(1 + ol);
            mesh.add(o);
          }
          continue;
        }
        rel.multiplyMatrices(inv, mesh.matrixWorld);
        buckets[kind].push(bakeGeo(mesh.geometry, rel, mesh.material.color));
        if (ol > 0) outlines.push(bakeGeo(mesh.geometry, grow.makeScale(1 + ol, 1 + ol, 1 + ol).premultiply(rel), null));
        mesh.removeFromParent();
      }
      const emit = (list, material, shadow) => {
        if (!list.length) return;
        const g = mergeGeometries(list, false);
        for (const piece of list) piece.dispose();
        const m = new THREE.Mesh(g, material);
        m.castShadow = shadow;
        anchor.add(m);
        this.geos.push(g);
        keep.add(material);
      };
      emit(buckets.toon, merged.toon, true);
      emit(buckets.toon2, merged.toon2, true);
      emit(buckets.basic, merged.basic, false);
      emit(outlines, this.outlineMat, false);
    }
    for (const m of this.materials) if (!keep.has(m)) m.dispose();
    this.materials = [...keep];
    this.litMaterials = this.materials.filter(m => m.isMeshToonMaterial || m.isMeshStandardMaterial);
    this.glows = this.glows.filter(m => keep.has(m));
  }

  dispose() {
    for (const s of this.skeletons) s.dispose?.();
    for (const m of this.materials) m.dispose();
    for (const g of this.geos || []) g.dispose();
  }
}

function node(name, parent, x, y, z) {
  const n = new THREE.Group();
  n.name = name;
  n.position.set(x, y, z);
  parent.add(n);
  return n;
}

function alignQ(dir) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

// ---------------------------------------------------------------------------
// HEAD, FACE & HAIR
// ---------------------------------------------------------------------------
const HEAD_R = 0.38;

const HAIR_PIECES = { ponytail: 'Ponytail', wavy: 'Waves', long: 'LongLocks', bun: 'Topknot', braid: 'Braid', spiky: 'Spikes' };
const FACE_PIECES = { ninja: 'FaceViolet', reaper: 'FaceViolet', mage: 'FaceEmber', samurai: 'FaceEmber', striker: 'FaceEmber', witch: 'FaceIce', cyborg: 'FaceIce' };

function buildHead(b, head, heroId, helmetId) {
  const look = HERO_LOOK[heroId] || HERO_LOOK.knight;
  const c = new THREE.Vector3(0, 0.32, 0);
  if (workshop) {
    head.scale.setScalar(0.87);
    b.model(head, FACE_PIECES[heroId] || 'Face');
    b.model(head, 'EarsAndNeck');
    const covered = helmetId !== 'knight' && !!HELMET_COVER[helmetId];
    const hairRoot = node('hair', head, 0, 0, 0);
    if (covered) hairRoot.scale.set(0.97, 0.97, 0.97);
    for (const piece of ['Scalp', 'Nape', covered ? 'CroppedFringe' : 'SoftFringe']) {
      b.model(hairRoot, piece, {}, look.hair, hairSwatch);
    }
    const extra = HAIR_PIECES[look.hairStyle];
    if (extra && (!covered || ['Braid', 'LongLocks', 'Waves'].includes(extra))) {
      b.model(hairRoot, extra, {}, look.hair, hairSwatch);
    }
    return c;
  }
  const skin = b.toon(SKIN);
  b.part(head, G.sphere(HEAD_R, 28, 20), skin, { p: [c.x, c.y, c.z], outline: 0.035 });
  b.part(head, G.cyl(0.07, 0.08, 0.14, 10), skin, { p: [0, -0.02, 0], outline: 0 });

  // Big chibi eyes
  const eyeDark = b.basic('#2b1a14');
  const iris = b.basic('#' + new THREE.Color(look.glow).lerp(new THREE.Color('#3b2416'), 0.45).getHexString());
  const shine = b.basic('#ffffff');
  for (const side of [-1, 1]) {
    const ex = c.x + side * 0.13;
    b.part(head, G.sphere(0.062, 14, 10), eyeDark, { p: [ex, c.y - 0.03, c.z + 0.333], r: [0, side * 0.36, 0], s: [0.95, 1.45, 0.32], outline: 0, shadow: false });
    b.part(head, G.sphere(0.042, 12, 8), iris, { p: [ex + side * 0.004, c.y - 0.05, c.z + 0.346], r: [0, side * 0.36, 0], s: [0.9, 1.15, 0.3], outline: 0, shadow: false });
    b.part(head, G.sphere(0.017, 8, 6), shine, { p: [ex - side * 0.02, c.y + 0.005, c.z + 0.356], outline: 0, shadow: false });
    const blush = b.basic('#f59e9e', { opacity: 0.45 });
    b.part(head, G.sphere(0.05, 10, 8), blush, { p: [c.x + side * 0.215, c.y - 0.12, c.z + 0.292], r: [0, side * 0.62, 0], s: [1.3, 0.7, 0.25], outline: 0, shadow: false });
  }
  b.part(head, G.box(0.055, 0.014, 0.012), eyeDark, { p: [c.x, c.y - 0.165, c.z + 0.342], r: [-0.42, 0, 0], outline: 0, shadow: false });

  buildHair(b, head, c, look, HELMET_COVER[helmetId] || null);
  return c;
}

// What a helmet hides: 'dome' covers the whole crown, 'hat' the top above the brim.
// Bands (ninja, striker, cyborg) leave the hair alone.
const HELMET_COVER = { knight: 'dome', samurai: 'dome', viking: 'dome', reaper: 'dome', mage: 'hat', cowboy: 'hat', witch: 'hat' };

function buildHair(b, head, c, look, cover) {
  const m = b.toon(look.hair);
  const capGeo = geo('haircap', () => new THREE.SphereGeometry(0.405, 26, 16, 0, Math.PI * 2, 0, 1.78));
  // Under a helmet the cap is pressed flat so neither it nor its outline pokes through the shell.
  // Under a hat it also sits lower so it stays beneath the brim around the crown.
  const capS = cover ? [1, 0.975, 1] : [1, 1, 1];
  const capY = cover === 'hat' ? -0.03 : cover ? 0 : 0.015;
  b.part(head, capGeo, m, { p: [c.x, c.y + capY, c.z - 0.012], r: [-0.5, 0, 0], s: capS, outline: cover ? 0.015 : 0.03 });

  // Anime hair: pointed tufts. Bangs over the forehead...
  const onHead = (a, e, r = 0.4) => [c.x + Math.sin(a) * Math.cos(e) * r, c.y + Math.sin(e) * r, c.z + Math.cos(a) * Math.cos(e) * r];
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.25;
    // Under a dome the bangs start lower and closer in, below its front rim
    const e = (cover === 'dome' ? 0.42 : 0.66) - Math.abs(i) * 0.07;
    const dir = new THREE.Vector3(Math.sin(a) * 0.45 + i * 0.05, -1, Math.cos(a) * 0.7);
    b.part(head, G.cone(0.085, 0.2 + (i % 2 === 0 ? 0.04 : 0), 5), m, { p: onHead(a, e, cover === 'dome' ? 0.375 : 0.39), q: alignQ(dir), outline: 0.06 });
  }
  // ...messy side & back tufts...
  for (let i = 0; i < 11; i++) {
    const a = 1.05 + (i / 10) * (Math.PI * 2 - 2.1);
    // Under a helmet they hang lower and tighter so the cone bases stay inside the shell / under the brim
    for (const e of cover ? [-0.02, -0.32] : [0.15, -0.2]) {
      const dir = new THREE.Vector3(Math.sin(a) * 0.55, -0.85, Math.cos(a) * 0.55);
      b.part(head, G.cone(0.11, 0.34, 5), m, { p: onHead(a + e * 0.2, e, cover ? 0.36 : 0.39), q: alignQ(dir), outline: 0.05 });
    }
  }
  // ...and one cheeky ahoge strand on top
  if (!cover) b.part(head, G.cone(0.035, 0.26, 5), m, { p: [c.x + 0.02, c.y + 0.44, c.z + 0.02], r: [0.5, 0, -0.35], outline: 0.08 });

  const style = look.hairStyle;
  if (style === 'spiky' && cover) {
    // Spikes flare out from under the rim instead of through the crown
    const dirs = [[0.9, -0.15, -0.35], [-0.9, -0.15, -0.35], [0.5, -0.2, -0.85], [-0.5, -0.2, -0.85], [0, -0.25, -1]];
    for (const d of dirs) {
      const dir = new THREE.Vector3(...d).normalize();
      b.part(head, G.cone(0.09, 0.28, 6), m, { p: [c.x + dir.x * 0.36, c.y + 0.02 + dir.y * 0.36, c.z + dir.z * 0.36], q: alignQ(dir), outline: 0.05 });
    }
  } else if (style === 'spiky') {
    const dirs = [[0, 1, -0.3], [0.55, 0.8, -0.4], [-0.55, 0.8, -0.4], [0.3, 0.45, -0.85], [-0.3, 0.45, -0.85], [0.85, 0.3, -0.35], [-0.85, 0.3, -0.35], [0, 0.55, -0.85], [0.2, 0.95, 0.2]];
    for (const d of dirs) {
      const dir = new THREE.Vector3(...d).normalize();
      b.part(head, G.cone(0.1, 0.34, 6), m, { p: [c.x + dir.x * 0.4, c.y + dir.y * 0.4, c.z + dir.z * 0.4], q: alignQ(dir), outline: 0.05 });
    }
  } else if (style === 'wavy') {
    for (const side of [-1, 1]) {
      b.part(head, G.sphere(0.11, 12, 10), m, { p: [c.x + side * 0.33, c.y - 0.12, c.z + 0.05], s: [0.85, 2.0, 1.0], r: [0, 0, side * 0.12] });
    }
    b.part(head, G.sphere(0.2, 14, 10), m, { p: [c.x, c.y - 0.12, c.z - 0.3], s: [1.6, 1.2, 0.8] });
  } else if (style === 'bun') {
    if (cover) return; // tucked under the helmet
    b.part(head, G.sphere(0.15, 14, 10), m, { p: [c.x, c.y + 0.34, c.z - 0.22] });
    b.part(head, G.torus(0.07, 0.03, 6, 14), b.toon('#b82830'), { p: [c.x, c.y + 0.27, c.z - 0.2], r: [Math.PI / 2 - 0.7, 0, 0], outline: 0 });
  } else if (style === 'long') {
    b.part(head, G.sphere(0.3, 16, 12), m, { p: [c.x, c.y - 0.38, c.z - 0.24], s: [1.25, 1.9, 0.55] });
    for (const side of [-1, 1]) {
      b.part(head, G.sphere(0.1, 12, 10), m, { p: [c.x + side * 0.34, c.y - 0.2, c.z + 0.04], s: [0.8, 2.6, 0.9] });
    }
  } else if (style === 'braid') {
    for (let i = 0; i < 5; i++) {
      b.part(head, G.sphere(0.075, 10, 8), m, { p: [c.x, c.y - 0.2 - i * 0.12, c.z - 0.36 - i * 0.02], s: [1, 1.2, 1] });
    }
    b.part(head, G.sphere(0.04, 8, 6), b.toon(GOLD), { p: [c.x, c.y - 0.8, c.z - 0.45] });
  } else {
    b.part(head, G.sphere(0.2, 14, 10), m, { p: [c.x, c.y - 0.1, c.z - 0.26], s: [1.7, 1.2, 0.7] });
  }
}

// ---------------------------------------------------------------------------
// HELMETS (gear.helmet)
// ---------------------------------------------------------------------------
const domeGeo = () => geo('dome', () => new THREE.SphereGeometry(0.44, 22, 12, 0, Math.PI * 2, 0, 1.3));
// Kabuto bowl reaches down into its neck guard so no hair shows in between
const deepDomeGeo = () => geo('domeDeep', () => new THREE.SphereGeometry(0.44, 22, 14, 0, Math.PI * 2, 0, 1.58));
const brimGeo = (r) => G.cyl(r, r, 0.035, 28);

const HELMETS = {
  knight(b, h, c) {
    if (workshop) {
      b.model(h, 'KnightDiadem', { p: [c.x, c.y - 0.32, c.z] });
      return;
    }
    b.part(h, domeGeo(), b.toon(STEEL), { p: [c.x, c.y + 0.02, c.z], r: [-0.35, 0, 0], outline: 0.03 });
    b.part(h, G.torus(0.435, 0.03, 6, 28), b.toon(GOLD), { p: [c.x, c.y + 0.1, c.z - 0.02], r: [Math.PI / 2 - 0.35, 0, 0], outline: 0 });
    b.part(h, G.sphere(0.1, 12, 10), b.toon('#2563eb'), { p: [c.x, c.y + 0.5, c.z - 0.1], r: [-0.7, 0, 0], s: [0.8, 2.6, 1.6] });
    b.part(h, G.box(0.05, 0.22, 0.05), b.toon(GOLD), { p: [c.x, c.y + 0.3, c.z + 0.32], r: [0.55, 0, 0], outline: 0.08 });
  },
  ninja(b, h, c) {
    const band = b.toon('#6d28d9');
    b.part(h, G.torus(0.395, 0.045, 6, 28), band, { p: [c.x, c.y + 0.14, c.z], r: [Math.PI / 2 - 0.25, 0, 0], outline: 0.04 });
    b.part(h, G.box(0.17, 0.08, 0.03), b.toon(STEEL), { p: [c.x, c.y + 0.155, c.z + 0.375], r: [-0.25, 0, 0] });
    for (const side of [-1, 1]) {
      b.part(h, G.box(0.06, 0.34, 0.015), band, { p: [c.x + side * 0.05, c.y - 0.02, c.z - 0.42], r: [0.55, 0, side * 0.25] });
    }
  },
  mage(b, h, c) {
    const red = b.toon('#9e262e');
    b.part(h, brimGeo(0.56), red, { p: [c.x, c.y + 0.3, c.z - 0.02], r: [-0.25, 0, 0], outline: 0.025 });
    b.part(h, G.cone(0.33, 0.62, 20), red, { p: [c.x, c.y + 0.6, c.z - 0.1], r: [-0.4, 0, 0], outline: 0.03 });
    b.part(h, G.torus(0.31, 0.03, 6, 24), b.toon(GOLD), { p: [c.x, c.y + 0.35, c.z - 0.04], r: [Math.PI / 2 - 0.3, 0, 0], outline: 0 });
    b.part(h, G.sphere(0.05, 10, 8), b.glow('#fb923c', 3), { p: [c.x, c.y + 0.86, c.z - 0.24], outline: 0, shadow: false });
  },
  cowboy(b, h, c) {
    const felt = b.toon('#7c4a24');
    b.part(h, brimGeo(0.6), felt, { p: [c.x, c.y + 0.3, c.z], r: [-0.2, 0, 0], s: [1, 1, 0.85], outline: 0.025 });
    b.part(h, G.cyl(0.26, 0.32, 0.28, 20), felt, { p: [c.x, c.y + 0.44, c.z - 0.03], r: [-0.2, 0, 0], outline: 0.03 });
    b.part(h, G.torus(0.315, 0.028, 6, 24), b.toon('#3f2614'), { p: [c.x, c.y + 0.35, c.z - 0.01], r: [Math.PI / 2 - 0.2, 0, 0], outline: 0 });
  },
  samurai(b, h, c) {
    const lacquer = b.toon('#2a2228');
    b.part(h, deepDomeGeo(), lacquer, { p: [c.x, c.y + 0.03, c.z], r: [-0.3, 0, 0], outline: 0.03 });
    const guard = b.toon('#7f1d1d', { side: THREE.DoubleSide });
    // Neck guard starts flush with the bowl all the way round (no gap at the back)
    b.part(h, G.cyl(0.455, 0.56, 0.18, 22, true), guard, { p: [c.x, c.y - 0.02, c.z], r: [-0.3, 0, 0], outline: 0 });
    // Lip closing the guard's top edge against the bowl (top plane of the tilted guard)
    const lip = geo('kabutoLip', () => new THREE.RingGeometry(0.38, 0.46, 28));
    b.part(h, lip, guard, { p: [c.x, c.y - 0.02 + 0.09 * Math.cos(0.3), c.z - 0.09 * Math.sin(0.3)], r: [-Math.PI / 2 - 0.3, 0, 0], outline: 0, shadow: false });
    b.part(h, G.torus(0.2, 0.028, 6, 16, Math.PI), b.toon(GOLD), { p: [c.x, c.y + 0.42, c.z + 0.28], r: [0, 0, Math.PI], outline: 0.06 });
  },
  witch(b, h, c) {
    const navy = b.toon('#1e3a5f');
    b.part(h, brimGeo(0.6), navy, { p: [c.x, c.y + 0.3, c.z], r: [-0.2, 0, 0], outline: 0.025 });
    b.part(h, G.cone(0.34, 0.5, 20), navy, { p: [c.x, c.y + 0.55, c.z - 0.06], r: [-0.25, 0, 0], outline: 0.03 });
    b.part(h, G.cone(0.18, 0.46, 16), navy, { p: [c.x, c.y + 0.84, c.z - 0.3], r: [-1.05, 0, 0], outline: 0.04 });
    b.part(h, G.torus(0.31, 0.028, 6, 24), b.glow('#67e8f9', 1.6), { p: [c.x, c.y + 0.35, c.z - 0.01], r: [Math.PI / 2 - 0.25, 0, 0], outline: 0, shadow: false });
    b.part(h, G.octa(0.06), b.glow('#a5f3fc', 2.6), { p: [c.x, c.y + 0.42, c.z + 0.3], outline: 0, shadow: false });
  },
  cyborg(b, h, c) {
    const visor = geo('visor', () => new THREE.SphereGeometry(0.405, 22, 6, Math.PI / 2 - 1.1, 2.2, 1.32, 0.45));
    const vm = b.basic('#38bdf8', { opacity: 0.55 });
    vm.side = THREE.DoubleSide;
    b.part(h, visor, vm, { p: [c.x, c.y, c.z + 0.012], outline: 0, shadow: false });
    const white = b.toon('#ebe5dc');
    for (const side of [-1, 1]) {
      b.part(h, G.cyl(0.1, 0.1, 0.09, 14), white, { p: [c.x + side * 0.39, c.y, c.z], r: [0, 0, Math.PI / 2] });
      b.part(h, G.torus(0.07, 0.018, 6, 14), b.glow('#d9682b', 1.8), { p: [c.x + side * 0.44, c.y, c.z], r: [0, Math.PI / 2, 0], outline: 0, shadow: false });
    }
    b.part(h, G.cyl(0.012, 0.012, 0.3, 6), b.toon(GUNMETAL), { p: [c.x + 0.3, c.y + 0.42, c.z - 0.1], r: [0, 0, -0.35], outline: 0 });
    b.part(h, G.sphere(0.035, 8, 6), b.glow('#38bdf8', 3), { p: [c.x + 0.35, c.y + 0.56, c.z - 0.1], outline: 0, shadow: false });
  },
  viking(b, h, c) {
    b.part(h, domeGeo(), b.toon(IRON), { p: [c.x, c.y + 0.03, c.z], r: [-0.3, 0, 0], outline: 0.03 });
    b.part(h, G.torus(0.445, 0.035, 6, 28), b.toon('#9a6b3c'), { p: [c.x, c.y + 0.1, c.z - 0.02], r: [Math.PI / 2 - 0.3, 0, 0], outline: 0 });
    const horn = b.toon('#f3ead8');
    for (const side of [-1, 1]) {
      b.part(h, G.cone(0.085, 0.4, 10), horn, { p: [c.x + side * 0.43, c.y + 0.28, c.z - 0.02], r: [0, 0, -side * 1.0], outline: 0.05 });
    }
  },
  striker(b, h, c) {
    const red = b.toon('#c9302c');
    b.part(h, G.torus(0.4, 0.05, 6, 28), red, { p: [c.x, c.y + 0.16, c.z], r: [Math.PI / 2 - 0.25, 0, 0], outline: 0.04 });
    b.part(h, G.sphere(0.06, 10, 8), red, { p: [c.x, c.y + 0.1, c.z - 0.41] });
    for (const side of [-1, 1]) {
      b.part(h, G.box(0.07, 0.3, 0.015), red, { p: [c.x + side * 0.06, c.y - 0.05, c.z - 0.44], r: [0.45, 0, side * 0.35] });
    }
  },
  reaper(b, h, c) {
    const cloth = b.toon('#2e1a47', { side: THREE.DoubleSide });
    const hood = geo('hood', () => new THREE.SphereGeometry(0.47, 24, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.1));
    b.part(h, hood, cloth, { p: [c.x, c.y + 0.03, c.z - 0.02], r: [-0.2, 0, 0], outline: 0 });
    b.part(h, G.cone(0.14, 0.34, 10), cloth, { p: [c.x, c.y + 0.36, c.z - 0.34], r: [-1.2, 0, 0], outline: 0 });
  }
};

// ---------------------------------------------------------------------------
// WEAPONS (gear.weapon). Built along +Z of a mount node.
// mount(tilt): +Z = extension of the arm, tilted toward the knuckles.
// upright(): +Z = the hand's knuckle direction (staffs stand up at rest).
// ---------------------------------------------------------------------------
function mount(hand, tilt = 0.3) {
  const m = new THREE.Group();
  m.position.set(0, -0.03, 0);
  m.rotation.x = Math.PI / 2 - tilt;
  hand.add(m);
  return m;
}
function upright(hand) {
  const m = new THREE.Group();
  m.name = 'staff';
  m.position.set(0, -0.03, 0.01);
  hand.add(m);
  return m;
}
const ALONG_Z = [Math.PI / 2, 0, 0];

const WEAPONS = {
  knight(b, H) {
    const w = mount(H.R, 0.35);
    if (workshop) {
      b.model(w, 'KnightSword');
      b.model(H.L, 'KnightShield', { p: [0.105, -0.09, 0.02], r: [1.68, 0.22, -0.14], s: [0.87, 0.87, 0.87] });
      return;
    }
    b.part(w, G.cyl(0.03, 0.03, 0.24, 8), b.toon('#5b3a24'), { r: ALONG_Z });
    b.part(w, G.sphere(0.045, 10, 8), b.toon(GOLD), { p: [0, 0, -0.14] });
    b.part(w, G.box(0.32, 0.05, 0.06), b.toon(GOLD), { p: [0, 0, 0.13] });
    b.part(w, G.box(0.11, 0.026, 0.92), b.toon(STEEL), { p: [0, 0, 0.6], outline: 0.04 });
    b.part(w, G.box(0.026, 0.034, 0.62), b.glow('#93c5fd', 1.5), { p: [0, 0, 0.52], outline: 0, shadow: false });
    b.part(w, G.cone(0.055, 0.16, 4), b.toon(STEEL), { p: [0, 0, 1.13], r: [Math.PI / 2, 0, Math.PI / 4], s: [1, 1, 0.3] });
    // Round-kite shield gripped in the left fist; its face points along the forearm
    const s = node('shield', H.L, 0, -0.1, 0.02);
    b.part(s, G.cyl(0.3, 0.3, 0.06, 26), b.toon('#1d4ed8'), { s: [1, 1, 1.22], outline: 0.04 });
    b.part(s, G.torus(0.3, 0.03, 6, 30), b.toon(GOLD), { r: [Math.PI / 2, 0, 0], s: [1, 1.22, 1], outline: 0 });
    b.part(s, G.sphere(0.075, 10, 8), b.toon(GOLD), { p: [0, -0.04, 0] });
    b.part(s, G.box(0.035, 0.03, 0.5), b.toon(GOLD), { p: [0, -0.035, 0], outline: 0 });
    b.part(s, G.box(0.38, 0.03, 0.035), b.toon(GOLD), { p: [0, -0.035, 0.05], outline: 0 });
  },
  ninja(b, H) {
    for (const hand of [H.R, H.L]) {
      const w = mount(hand, 0.2);
      b.part(w, G.cyl(0.022, 0.022, 0.14, 8), b.toon('#3b0764'), { r: ALONG_Z });
      b.part(w, G.torus(0.035, 0.01, 6, 12), b.toon(STEEL), { p: [0, 0, -0.1], r: [0, Math.PI / 2, 0], outline: 0 });
      b.part(w, G.cone(0.05, 0.32, 4), b.toon('#cbd5e1'), { p: [0, 0, 0.23], r: [Math.PI / 2, 0, Math.PI / 4], s: [1, 1, 0.32] });
    }
  },
  mage(b, H) {
    const w = upright(H.R);
    b.part(w, G.cyl(0.028, 0.035, 1.5, 8), b.toon(WOOD), { p: [0, 0, 0.3], r: ALONG_Z });
    b.part(w, G.torus(0.12, 0.022, 6, 16, Math.PI * 1.5), b.toon(GOLD), { p: [0, 0, 1.12], r: [0, Math.PI / 2, Math.PI * 0.75] });
    const orb = b.part(w, G.sphere(0.085, 14, 10), b.glow('#fb923c', 2.8), { p: [0, 0, 1.12], outline: 0, shadow: false });
    orb.userData.flicker = true;
    b.part(w, G.sphere(0.04, 8, 6), b.toon(GOLD), { p: [0, 0, -0.46] });
  },
  cowboy(b, H) {
    for (const hand of [H.R, H.L]) {
      const w = mount(hand, 0.15);
      b.part(w, G.box(0.05, 0.12, 0.055), b.toon('#8b5a2b'), { p: [0, -0.05, -0.03], r: [0.3, 0, 0] });
      b.part(w, G.box(0.06, 0.08, 0.16), b.toon(GUNMETAL), { p: [0, 0.02, 0.06] });
      b.part(w, G.cyl(0.045, 0.045, 0.07, 8), b.toon('#6b7280'), { p: [0, 0.02, 0.07], r: ALONG_Z, outline: 0 });
      b.part(w, G.cyl(0.02, 0.02, 0.24, 8), b.toon(GUNMETAL), { p: [0, 0.045, 0.25], r: ALONG_Z });
      b.part(w, G.box(0.015, 0.025, 0.03), b.toon(GOLD), { p: [0, 0.07, 0.35], outline: 0 });
    }
  },
  samurai(b, H) {
    const w = mount(H.R, 0.6);
    b.part(w, G.cyl(0.026, 0.026, 0.28, 8), b.toon('#9f1239'), { p: [0, 0, -0.02], r: ALONG_Z });
    b.part(w, G.cyl(0.075, 0.075, 0.02, 12), b.toon('#3f3a2a'), { p: [0, 0, 0.13], r: ALONG_Z, outline: 0.1 });
    b.part(w, G.box(0.042, 0.014, 0.56), b.toon(STEEL), { p: [0, 0, 0.42], outline: 0.06 });
    b.part(w, G.box(0.04, 0.014, 0.56), b.toon(STEEL), { p: [0, 0.035, 0.95], r: [-0.13, 0, 0], outline: 0.06 });
    b.part(w, G.box(0.012, 0.018, 1.0), b.glow('#fecdd3', 1.4), { p: [0, -0.012, 0.68], r: [-0.06, 0, 0], outline: 0, shadow: false });
  },
  witch(b, H) {
    const w = mount(H.R, 0.5);
    b.part(w, G.cyl(0.02, 0.026, 0.5, 8), b.toon('#e2e8f0'), { p: [0, 0, 0.12], r: ALONG_Z });
    b.part(w, G.torus(0.06, 0.012, 6, 14), b.glow('#67e8f9', 1.6), { p: [0, 0, 0.36], outline: 0, shadow: false });
    const tip = b.part(w, G.octa(0.09), b.glow('#a5f3fc', 2.6), { p: [0, 0, 0.46], s: [0.7, 0.7, 1.4], outline: 0, shadow: false });
    tip.userData.flicker = true;
  },
  cyborg(b, H) {
    const w = mount(H.R, 0.12);
    b.part(w, G.box(0.11, 0.15, 0.5), b.toon('#ebe5dc'), { p: [0, 0.03, 0.12] });
    b.part(w, G.cyl(0.035, 0.035, 0.38, 10), b.toon(GUNMETAL), { p: [0, 0.05, 0.55], r: ALONG_Z });
    b.part(w, G.torus(0.04, 0.012, 6, 14), b.glow('#38bdf8', 2.4), { p: [0, 0.05, 0.74], outline: 0, shadow: false });
    b.part(w, G.box(0.118, 0.022, 0.32), b.glow('#38bdf8', 1.8), { p: [0, 0.085, 0.12], outline: 0, shadow: false });
    b.part(w, G.box(0.115, 0.05, 0.12), b.toon('#d9682b'), { p: [0, 0.02, -0.05], outline: 0 });
    b.part(w, G.box(0.08, 0.12, 0.18), b.toon(GUNMETAL), { p: [0, 0, -0.2] });
    b.part(w, G.box(0.05, 0.12, 0.06), b.toon(GUNMETAL), { p: [0, -0.08, 0], r: [0.3, 0, 0] });
  },
  viking(b, H) {
    const head = geo('axehead', () => new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16, 1, false, 0, Math.PI));
    for (const hand of [H.R, H.L]) {
      const w = mount(hand, 0.25);
      b.part(w, G.cyl(0.026, 0.026, 0.62, 8), b.toon(WOOD), { p: [0, 0, 0.16], r: ALONG_Z });
      b.part(w, head, b.toon('#c8ccd4'), { p: [0, 0.03, 0.42], r: [0, 0, Math.PI / 2], outline: 0.06 });
      b.part(w, G.cone(0.035, 0.12, 6), b.toon(IRON), { p: [0, -0.06, 0.42], r: [Math.PI, 0, 0] });
      b.part(w, G.box(0.034, 0.12, 0.016), b.glow('#fb923c', 1.6), { p: [0, 0.1, 0.42], outline: 0, shadow: false });
    }
  },
  striker(b, H) {
    for (const hand of [H.R, H.L]) {
      b.part(hand, G.sphere(0.12, 14, 10), b.toon('#d99e32'), { p: [0, -0.04, 0.01] });
      b.part(hand, G.box(0.17, 0.05, 0.09), b.toon('#a16207'), { p: [0, -0.1, 0.06], outline: 0.05 });
      b.part(hand, G.torus(0.085, 0.03, 6, 16), b.toon('#c9302c'), { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0], outline: 0 });
    }
  },
  reaper(b, H) {
    const w = upright(H.R);
    b.part(w, G.cyl(0.03, 0.03, 1.75, 8), b.toon('#3b2a3f'), { p: [0, 0, 0.35], r: ALONG_Z });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.05);
    shape.quadraticCurveTo(0.45, 0.24, 0.95, -0.3);
    shape.quadraticCurveTo(0.42, -0.02, 0, -0.1);
    shape.closePath();
    const blade = geo('scythe', () => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: false, curveSegments: 14 });
      g.translate(0, 0, -0.012);
      return g;
    });
    // shape X -> forward (-Y of the hand), shape Y -> up the pole (+Z)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)
    ));
    b.part(w, blade, b.toon('#c4c7d4'), { p: [0, 0, 1.16], q, outline: 0.04 });
    b.part(w, G.sphere(0.06, 10, 8), b.glow('#e879f9', 2.4), { p: [0, 0, 1.2], outline: 0, shadow: false });
  }
};

// ---------------------------------------------------------------------------
// ARMOR (gear.armor) - torso clothing, sleeves, boots, gloves
// ---------------------------------------------------------------------------
function skirtGeo(len) {
  return geo(`skirt${len}`, () => {
    const pts = [
      new THREE.Vector2(0.168, 0.12),
      new THREE.Vector2(0.186, 0.0),
      new THREE.Vector2(0.215, -0.12),
      new THREE.Vector2(0.27 + len * 0.25, -0.2 - len)
    ];
    return new THREE.LatheGeometry(pts, 20);
  });
}

const COATS = {
  cowboy: 'CowboyCoat', cyborg: 'CyborgCoat', mage: 'MageCoat', ninja: 'NinjaCoat',
  reaper: 'ReaperCoat', samurai: 'SamuraiCoat', striker: 'StrikerCoat', viking: 'VikingCoat', witch: 'WitchCoat'
};

function dressArmor(b, R, armorId) {
  const knight = armorId === 'knight';
  const look = HERO_LOOK[armorId];
  b.model(R.torso, knight ? 'KnightCuirass' : COATS[armorId]);
  if (knight) b.model(R.hips, 'KnightFauld');
  for (const [side, flip] of [['L', 1], ['R', -1]]) {
    const opts = { s: [flip, 1, 1] };
    if (knight) {
      b.model(R['arm' + side], 'KnightPauldron', opts);
      b.model(R['arm' + side], 'KnightSleeve', opts);
      b.model(R['fore' + side], 'KnightVambrace', opts);
      b.model(R['hand' + side], 'KnightGlove', opts);
      b.model(R['leg' + side], 'KnightLeg', opts);
      b.model(R['shin' + side], 'KnightGreave', opts);
      b.model(R['foot' + side], 'KnightSabatons', opts);
    } else {
      b.model(R['arm' + side], 'TailoredSleeve', opts, look.sleeve);
      b.model(R['fore' + side], 'FieldBracer', opts, armorId === 'cyborg' ? '#afb1b5' : null, leatherSwatch);
      b.model(R['hand' + side], 'FieldGlove', opts, look.glove);
      b.model(R['leg' + side], 'FieldTrousers', opts, darker(look.sleeve, 0.52));
      b.model(R['shin' + side], 'FoldedBoot', opts, look.boot);
      b.model(R['foot' + side], 'FieldShoe', opts, look.boot);
    }
  }
}

function buildArmor(b, R, armorId) {
  if (workshop && HERO_LOOK[armorId]) {
    dressArmor(b, R, armorId);
    return;
  }
  const L = armorId ? HERO_LOOK[armorId] : BARE;
  const look = armorId ? HERO_LOOK[armorId] : null;
  const cloth = b.toon(L.sleeve);
  const clothDark = b.toon(darker(L.sleeve, 0.7));
  const trim = b.toon(L.trim);
  const boot = b.toon(L.boot);
  const glove = b.toon(L.glove);
  const robe = look?.robe || 0;

  b.part(R.hips, G.sphere(0.17, 14, 10), clothDark, { p: [0, 0.02, 0], s: [1.08, 0.78, 0.92] });
  b.part(R.torso, G.capsule(0.165, 0.18), cloth, { p: [0, 0.27, 0], s: [1.15, 1, 0.88] });
  const skirtMat = b.toon(L.sleeve, { side: THREE.DoubleSide });
  b.part(R.torso, skirtGeo(robe), skirtMat, { p: [0, 0.1, 0], s: [1, 1, 0.86], outline: 0.03 });
  b.part(R.torso, G.torus(0.27 + robe * 0.25, 0.022, 6, 28), trim, { p: [0, 0.1 - 0.2 - robe, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1], outline: 0 });
  b.part(R.torso, G.torus(0.19, 0.035, 6, 24), trim, { p: [0, 0.13, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1], outline: 0.04 });
  for (const side of [-1, 1]) {
    b.part(R.torso, G.sphere(0.1, 12, 10), trim, { p: [side * 0.24, 0.43, 0], s: [1.15, 0.8, 1.1] });
  }

  // Limbs
  for (const [arm, fore, hand] of [[R.armL, R.foreL, R.handL], [R.armR, R.foreR, R.handR]]) {
    b.part(arm, G.capsule(0.066, 0.13), cloth, { p: [0, -0.11, 0] });
    b.part(fore, G.capsule(0.06, 0.12), clothDark, { p: [0, -0.1, 0] });
    b.part(hand, G.sphere(0.072, 12, 10), glove, { p: [0, -0.02, 0] });
  }
  for (const [leg, shin, foot] of [[R.legL, R.shinL, R.footL], [R.legR, R.shinR, R.footR]]) {
    b.part(leg, G.capsule(0.078, 0.15), clothDark, { p: [0, -0.14, 0] });
    b.part(shin, G.capsule(0.072, 0.14), boot, { p: [0, -0.13, 0] });
    b.part(foot, G.sphere(0.1, 12, 10), boot, { p: [0, 0.02, 0.05], s: [1.0, 0.72, 1.55] });
  }

  // Signature armor pieces
  if (armorId === 'knight') {
    b.part(R.torso, G.sphere(0.17, 16, 12), b.toon(STEEL), { p: [0, 0.3, 0.06], s: [1.12, 1.05, 0.62] });
    b.part(R.torso, G.box(0.04, 0.2, 0.03), b.toon(GOLD), { p: [0, 0.3, 0.17], outline: 0 });
    b.part(R.torso, G.box(0.14, 0.04, 0.03), b.toon(GOLD), { p: [0, 0.33, 0.17], outline: 0 });
  } else if (armorId === 'samurai') {
    b.part(R.torso, G.box(0.34, 0.26, 0.06), b.toon('#7f1d1d'), { p: [0, 0.28, 0.13], outline: 0.04 });
    for (let i = 0; i < 3; i++) b.part(R.torso, G.box(0.35, 0.012, 0.065), b.toon(GOLD), { p: [0, 0.2 + i * 0.08, 0.135], outline: 0 });
    for (const side of [-1, 1]) b.part(R.torso, G.box(0.16, 0.05, 0.2), b.toon('#7f1d1d'), { p: [side * 0.3, 0.42, 0], r: [0, 0, side * -0.5] });
  } else if (armorId === 'cyborg') {
    b.part(R.torso, G.sphere(0.065, 12, 10), b.glow('#38bdf8', 2.6), { p: [0, 0.3, 0.155], outline: 0, shadow: false });
    b.part(R.torso, G.torus(0.075, 0.018, 6, 16), b.toon('#d9682b'), { p: [0, 0.3, 0.15], outline: 0 });
  } else if (armorId === 'viking') {
    for (const side of [-1, 1]) b.part(R.torso, G.sphere(0.13, 12, 10), b.toon('#7c5a3c'), { p: [side * 0.24, 0.44, 0], s: [1.2, 0.9, 1.2] });
  } else if (armorId === 'ninja') {
    b.part(R.torso, G.box(0.06, 0.4, 0.04), b.toon('#7c3aed'), { p: [0, 0.27, 0.15], r: [0, 0, 0.6], outline: 0 });
  } else if (armorId === 'reaper') {
    b.part(R.torso, G.torus(0.22, 0.02, 6, 20), b.glow('#a855f7', 1.4), { p: [0, 0.13, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1], outline: 0, shadow: false });
  } else if (armorId === 'mage' || armorId === 'witch') {
    b.part(R.torso, G.box(0.08, 0.3, 0.03), trim, { p: [0, 0.24, 0.15], outline: 0 });
  }
}

// ---------------------------------------------------------------------------
// TRINKETS (gear.trinket) - capes, familiars, jetpack...
// ---------------------------------------------------------------------------
function cape(b, parent, color, trimColor, w, h, pos, opts = {}) {
  const n = node('cape', parent, pos[0], pos[1], pos[2]);
  const g = geo(`cape${w}|${h}`, () => new THREE.PlaneGeometry(w, h, 1, 4).translate(0, -h / 2, 0));
  b.part(n, g, b.toon(color, { side: THREE.DoubleSide }), { outline: 0 });
  if (trimColor) {
    const t = opts.glowTrim ? b.glow(trimColor, 1.5) : b.toon(trimColor);
    b.part(n, G.box(w, 0.045, 0.02), t, { p: [0, -h + 0.02, 0], outline: 0 });
  }
  return n;
}

function star5(r) {
  return geo(`star${r}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  });
}

const TRINKETS = {
  knight(b, T, out) {
    if (workshop) {
      const pivot = node('cape', T, 0, 0.44, -0.15);
      b.model(pivot, 'KnightCape');
      out.capes.push(pivot);
    } else {
      out.capes.push(cape(b, T, '#1e3a8a', GOLD, 0.52, 0.62, [0, 0.44, -0.16]));
    }
  },
  ninja: (b, T, out) => {
    b.part(T, G.torus(0.16, 0.055, 6, 18), b.toon('#6d28d9'), { p: [0, 0.47, 0], r: [Math.PI / 2, 0, 0], outline: 0.04 });
    const n = node('cape', T, 0.06, 0.46, -0.15);
    const tail = geo('scarftail', () => new THREE.PlaneGeometry(0.11, 0.66, 1, 4).translate(0, -0.33, 0));
    const m = b.toon('#7c3aed', { side: THREE.DoubleSide });
    b.part(n, tail, m, { p: [-0.05, 0, 0], r: [0, 0.2, 0], outline: 0 });
    b.part(n, tail, m, { p: [0.06, 0.02, 0], r: [0, -0.25, 0.12], outline: 0 });
    out.capes.push(n);
  },
  mage: (b, T, out) => {
    out.capes.push(cape(b, T, '#7f1d1d', GOLD, 0.44, 0.4, [0, 0.44, -0.16]));
    const o = node('orb', T, 0.48, 0.72, -0.12);
    b.part(o, G.sphere(0.09, 14, 10), b.glow('#fb923c', 2.8), { outline: 0, shadow: false }).userData.flicker = true;
    b.part(o, G.torus(0.13, 0.012, 6, 18), b.toon(GOLD), { r: [1.1, 0.3, 0], outline: 0 });
    out.orbiters.push(o);
  },
  cowboy: (b, T, out) => {
    out.capes.push(cape(b, T, '#b45309', '#78350f', 0.48, 0.36, [0, 0.45, -0.15]));
    b.part(T, star5(0.06), b.toon(GOLD), { p: [0.08, 0.33, 0.16], outline: 0 });
  },
  samurai: (b, T, out) => {
    b.part(T, G.cyl(0.015, 0.015, 1.0, 6), b.toon('#1f1a17'), { p: [0, 0.75, -0.22], outline: 0 });
    const n = node('cape', T, 0.02, 1.22, -0.22);
    const flag = geo('flag', () => new THREE.PlaneGeometry(0.34, 0.56, 1, 4).translate(0.17, -0.28, 0));
    b.part(n, flag, b.toon('#b91c1c', { side: THREE.DoubleSide }), { r: [0, Math.PI / 2, 0], outline: 0 });
    b.part(n, G.cyl(0.08, 0.08, 0.01, 18), b.toon('#fff7ed'), { p: [0.0, -0.26, 0.17], r: [0, 0, Math.PI / 2], outline: 0 });
    out.capes.push(n);
  },
  witch: (b, T, out) => {
    out.capes.push(cape(b, T, '#1e3a5f', '#67e8f9', 0.5, 0.7, [0, 0.44, -0.16], { glowTrim: true }));
    const o = node('orb', T, -0.46, 0.75, -0.12);
    const gm = b.glow('#a5f3fc', 2.4);
    b.part(o, G.octa(0.07), gm, { outline: 0, shadow: false });
    for (let i = 0; i < 3; i++) b.part(o, G.box(0.2, 0.018, 0.018), gm, { r: [0, 0, (i * Math.PI) / 3], outline: 0, shadow: false });
    out.orbiters.push(o);
  },
  cyborg: (b, T, out) => {
    b.part(T, G.box(0.32, 0.32, 0.15), b.toon('#ebe5dc'), { p: [0, 0.27, -0.22] });
    b.part(T, G.box(0.33, 0.05, 0.155), b.toon('#d9682b'), { p: [0, 0.33, -0.22], outline: 0 });
    for (const side of [-1, 1]) {
      b.part(T, G.cyl(0.06, 0.08, 0.12, 10), b.toon(GUNMETAL), { p: [side * 0.1, 0.07, -0.24] });
      const flame = node('thruster', T, side * 0.1, 0.0, -0.24);
      b.part(flame, G.cone(0.06, 0.3, 10), b.glow('#38bdf8', 2.6), { p: [0, -0.15, 0], r: [Math.PI, 0, 0], outline: 0, shadow: false });
      out.thrusters.push(flame);
    }
  },
  viking: (b, T, out) => {
    b.part(T, G.cyl(0.3, 0.3, 0.05, 22), b.toon('#8b5a2b'), { p: [0, 0.27, -0.21], r: [Math.PI / 2, 0, 0] });
    b.part(T, G.torus(0.3, 0.026, 6, 26), b.toon(IRON), { p: [0, 0.27, -0.21], outline: 0 });
    b.part(T, G.sphere(0.07, 10, 8), b.toon(IRON), { p: [0, 0.27, -0.25] });
    b.part(T, G.torus(0.19, 0.07, 8, 20), b.toon('#7c5a3c'), { p: [0, 0.47, 0], r: [Math.PI / 2, 0, 0], outline: 0.03 });
  },
  striker: (b, T, out) => {
    b.part(T, G.torus(0.215, 0.05, 6, 24), b.toon(GOLD), { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.88, 1], outline: 0.04 });
    b.part(T, G.box(0.17, 0.11, 0.04), b.toon(GOLD), { p: [0, 0.08, 0.2] });
    b.part(T, G.sphere(0.035, 10, 8), b.glow('#ef4444', 2.4), { p: [0, 0.08, 0.225], outline: 0, shadow: false });
  },
  reaper: (b, T, out) => {
    out.capes.push(cape(b, T, '#1e1033', '#a855f7', 0.56, 0.82, [0, 0.44, -0.16], { glowTrim: true }));
    const o = node('orb', T, 0.44, 0.62, -0.18);
    b.part(o, G.sphere(0.06, 10, 8), b.glow('#e879f9', 2.8), { outline: 0, shadow: false }).userData.flicker = true;
    out.orbiters.push(o);
  }
};

// ---------------------------------------------------------------------------
// FULL CHARACTER
// ---------------------------------------------------------------------------
const HIPS_Y = 0.62;
const SKINNED_RIG_BONES = [
  'hips', 'torso', 'head',
  'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR',
  'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'
];

function buildRig(b, heroId, gear) {
  const root = new THREE.Group();
  const body = node('body', root, 0, 0, 0);
  const R = { root, body };
  R.hips = node('hips', body, 0, HIPS_Y, 0);
  R.torso = node('torso', R.hips, 0, 0.02, 0);
  R.head = node('head', R.torso, 0, 0.5, 0);
  R.armL = node('armL', R.torso, 0.25, 0.42, 0);
  R.foreL = node('foreL', R.armL, 0, -0.235, 0);
  R.handL = node('handL', R.foreL, 0, -0.215, 0);
  R.armR = node('armR', R.torso, -0.25, 0.42, 0);
  R.foreR = node('foreR', R.armR, 0, -0.235, 0);
  R.handR = node('handR', R.foreR, 0, -0.215, 0);
  R.legL = node('legL', R.hips, 0.12, -0.02, 0);
  R.shinL = node('shinL', R.legL, 0, -0.29, 0);
  R.footL = node('footL', R.shinL, 0, -0.27, 0);
  R.legR = node('legR', R.hips, -0.12, -0.02, 0);
  R.shinR = node('shinR', R.legR, 0, -0.29, 0);
  R.footR = node('footR', R.shinR, 0, -0.27, 0);

  const c = buildHead(b, R.head, heroId, gear.helmet);
  buildArmor(b, R, gear.armor);
  if (gear.helmet && HELMETS[gear.helmet]) HELMETS[gear.helmet](b, R.head, c);
  if (gear.weapon && WEAPONS[gear.weapon]) WEAPONS[gear.weapon](b, { R: R.handR, L: R.handL, foreL: R.foreL });
  const extras = { capes: [], orbiters: [], thrusters: [] };
  if (gear.trinket && TRINKETS[gear.trinket]) TRINKETS[gear.trinket](b, R.torso, extras);
  R.extras = extras;
  return R;
}

function buildSkinnedRig(b, heroId, gear, model) {
  const { spec, scene: srcScene, gearScene } = model;
  const root = new THREE.Group();
  const body = node('body', root, 0, 0, 0);
  const R = { root, body };

  const cloned = SkeletonUtils.clone(srcScene);
  cloned.updateMatrixWorld(true);

  const worldPos = new Map();
  const origByName = new Map();
  const skinnedMeshes = [];
  cloned.traverse((o) => {
    if (o.isBone) {
      worldPos.set(o, o.getWorldPosition(new THREE.Vector3()));
      origByName.set(o.name, o);
    } else if (o.isSkinnedMesh) {
      skinnedMeshes.push({ mesh: o, bindWorld: o.matrixWorld.clone() });
    }
  });

  const hipsOrig = origByName.get('hips');
  const hipHeight = spec.hipHeight || (hipsOrig ? worldPos.get(hipsOrig).y : HIPS_Y);
  const s = hipHeight / HIPS_Y;

  // Keep body unscaled because ChibiView overwrites R.body.scale every frame for squash & stretch.
  const rigScale = new THREE.Group();
  rigScale.name = 'rigScale';
  rigScale.scale.setScalar(s);
  body.add(rigScale);

  // For A-pose models, align arm bind orientations to their actual rest limb direction relative to
  // canonical straight-down (0, -1, 0) so chibi.js absolute clip rotations drive A-pose arms cleanly.
  const restWorldQ = new Map();
  if (spec.alignArms) {
    const down = new THREE.Vector3(0, -1, 0);
    for (const side of ['L', 'R']) {
      const arm = origByName.get('arm' + side);
      const fore = origByName.get('fore' + side);
      const hand = origByName.get('hand' + side);
      if (arm && fore) {
        const du = worldPos.get(fore).clone().sub(worldPos.get(arm)).normalize();
        restWorldQ.set(arm, new THREE.Quaternion().setFromUnitVectors(down, du));
      }
      if (fore && hand) {
        const df = worldPos.get(hand).clone().sub(worldPos.get(fore)).normalize();
        const qf = new THREE.Quaternion().setFromUnitVectors(down, df);
        restWorldQ.set(fore, qf);
        restWorldQ.set(hand, qf.clone());
      }
    }
  }

  // Rebuild bones with canonical rest orientations in model axes so chibi.js clips drive them directly.
  const identityQ = new THREE.Quaternion();
  const invQ = new THREE.Quaternion();
  const newBones = new Map();
  const byName = new Map();
  cloned.traverse((o) => {
    if (!o.isBone) return;
    const wp = worldPos.get(o);
    const wq = restWorldQ.get(o) || identityQ;
    const nb = new THREE.Bone();
    nb.name = o.name;
    const parentBone = o.parent?.isBone ? o.parent : null;
    if (parentBone && newBones.has(parentBone)) {
      const pwq = restWorldQ.get(parentBone) || identityQ;
      invQ.copy(pwq).invert();
      nb.position.copy(wp).sub(worldPos.get(parentBone)).applyQuaternion(invQ).divideScalar(s);
      nb.quaternion.copy(invQ).multiply(wq);
      newBones.get(parentBone).add(nb);
    } else {
      nb.position.copy(wp).divideScalar(s);
      nb.quaternion.copy(wq);
      rigScale.add(nb);
    }
    newBones.set(o, nb);
    byName.set(o.name, nb);
  });

  for (const name of SKINNED_RIG_BONES) {
    if (byName.has(name)) {
      R[name] = byName.get(name);
    } else {
      const fb = new THREE.Bone();
      fb.name = name;
      rigScale.add(fb);
      R[name] = fb;
    }
  }

  // Move skinned meshes directly under body with identity transforms and rebind to the
  // canonical bones. Attached bind mode re-inverts mesh.matrixWorld each frame so
  // squash & stretch and root motion apply once.
  const rebindQueue = [];
  const armorStripped = !gear.armor;
  for (const { mesh, bindWorld } of skinnedMeshes) {
    const mappedBones = mesh.skeleton.bones.map(orig => newBones.get(orig) || byName.get(orig.name));
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    body.add(mesh);
    const isCapeMesh = !!(spec.capeMesh && mesh.name === spec.capeMesh);
    if (isCapeMesh) {
      mesh.visible = gear.trinket === heroId;
    }
    const cloneMat = (m) => {
      const c = spec.painterly ? makeToSMaterial(m) : m.clone();
      if (spec.painterly) c.userData.keepUnmerged = true;
      if (isCapeMesh) c.side = THREE.DoubleSide;
      // Subtle visual cue when armor is knocked off, while keeping the skinned model
      if (armorStripped && !isCapeMesh) c.color.multiplyScalar(0.84);
      b.materials.push(c);
      return c;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneMat);
    } else if (mesh.material) {
      mesh.material = cloneMat(mesh.material);
    }
    mesh.castShadow = mesh.visible;
    mesh.frustumCulled = false;
    mesh.bindMode = THREE.AttachedBindMode;
    rebindQueue.push({ mesh, mappedBones, bindWorld });
  }

  root.updateMatrixWorld(true);
  for (const { mesh, mappedBones, bindWorld } of rebindQueue) {
    const skeleton = new THREE.Skeleton(mappedBones);
    mesh.bind(skeleton, bindWorld);
    b.skeletons.push(skeleton);
  }

  // The sculpt's open bind pose places the ankles wider than the hips.
  // Keep the original inverse binds so the weighted boots and greaves follow
  // the corrected resting axes. Leave the hip pivots and the knee bend intact.
  if (spec.narrowLegRest) {
    for (const side of ['L', 'R']) {
      R['shin' + side].position.x *= 0.30;
      R['foot' + side].position.x *= 0.10;
    }
  }

  // Optional ToS chibi-heroic head proportion boost applied post-bind (scales head + helmet together)
  if (spec.headScale && spec.headScale !== 1 && R.head) {
    R.head.scale.setScalar(spec.headScale);
  }
  R.rigScale = s;
  R.restFootY = origByName.get('footL') ? worldPos.get(origByName.get('footL')).y : 0.135;

  // Rigid attachments under bones need a 1/s child wrapper because bones inherit rigScale = s.
  const fused = new Set(spec.fused || []);
  const unscaled = (parent) => {
    const g = new THREE.Group();
    g.scale.setScalar(1 / s);
    parent.add(g);
    return g;
  };
  if (!fused.has('helmet') && gear.helmet) {
    if (gear.helmet === heroId && spec.helmetMesh && gearScene) {
      b.glbPart(unscaled(R.head), gearScene, spec.helmetMesh, { painterly: !!spec.painterly });
    } else if (HELMETS[gear.helmet]) {
      const hWrap = unscaled(R.head);
      if (spec.otherHelmetScale) hWrap.scale.multiplyScalar(spec.otherHelmetScale);
      if (spec.otherHelmetOffset) hWrap.position.set(...spec.otherHelmetOffset).divideScalar(s);
      HELMETS[gear.helmet](b, hWrap, new THREE.Vector3(0, 0.32, 0));
    }
  }
  if (!fused.has('weapon') && gear.weapon) {
    if (gear.weapon === heroId && gearScene && (spec.swordMesh || spec.shieldMesh)) {
      if (spec.swordMesh) {
        const sm = spec.swordMount || { p: [0, -0.03, 0], tilt: 0.35 };
        const parent = unscaled(R.handR);
        let w;
        if (sm.rx !== undefined) {
          // Direct anatomically aligned fist grip (handle passes through curled fist, not extending out fingertips)
          w = node('swordMount', parent, sm.p[0], sm.p[1], sm.p[2]);
          w.rotation.set(sm.rx, sm.ry || 0, sm.rz || 0);
        } else {
          w = mount(parent, sm.tilt);
          w.position.set(sm.p[0], sm.p[1], sm.p[2]);
        }
        const swScale = spec.swordScale || 1;
        if (swScale !== 1) w.scale.setScalar(swScale);
        b.glbPart(w, gearScene, spec.swordMesh, { painterly: !!spec.painterly });
        if (spec.swordTrail) {
          R.swordMount = w;
          R.swordTrailSpec = spec.swordTrail;
        }
      }
      if (spec.shieldMesh) {
        const shWrap = unscaled(R.handL);
        const shScale = spec.shieldScale || 1;
        if (shScale !== 1) shWrap.scale.multiplyScalar(shScale);
        b.glbPart(shWrap, gearScene, spec.shieldMesh, { painterly: !!spec.painterly });
      }
    } else if (WEAPONS[gear.weapon]) {
      WEAPONS[gear.weapon](b, { R: unscaled(R.handR), L: unscaled(R.handL), foreL: unscaled(R.foreL) });
    }
  }
  const extras = { capes: [], orbiters: [], thrusters: [] };
  for (const cb of spec.capeBones || []) {
    const bone = byName.get(cb.name);
    if (bone) {
      bone.userData.capeScale = cb.weight;
      extras.capes.push(bone);
    }
  }
  if (!fused.has('trinket') && gear.trinket && TRINKETS[gear.trinket] && !(spec.capeMesh && gear.trinket === heroId)) {
    TRINKETS[gear.trinket](b, unscaled(R.torso), extras);
  }
  R.extras = extras;
  return R;
}

// Standalone gear piece for dropped loot on the floor
export function buildGearItem(slot, heroId) {
  const b = new Builder();
  const g = new THREE.Group();
  const skinned = SKINNED_MODELS[heroId];
  const gearScene = skinned?.gearScene;
  if (slot === 'weapon') {
    const hR = node('h', g, -0.12, 0, 0);
    const hL = node('h', g, 0.12, 0, 0);
    const fL = node('f', g, 0.25, 0.1, 0);
    if (gearScene && (skinned.spec.swordMesh || skinned.spec.shieldMesh)) {
      if (skinned.spec.swordMesh) {
        const w = mount(hR, skinned.spec.swordMount?.tilt ?? 0.35);
        b.glbPart(w, gearScene, skinned.spec.swordMesh, { painterly: !!skinned.spec.painterly });
      }
      if (skinned.spec.shieldMesh) b.glbPart(hL, gearScene, skinned.spec.shieldMesh, { painterly: !!skinned.spec.painterly });
    } else {
      WEAPONS[heroId]?.(b, { R: hR, L: hL, foreL: fL });
    }
    g.rotation.set(-0.9, 0, 0.5);
  } else if (slot === 'helmet') {
    if (gearScene && skinned.spec.helmetMesh) {
      b.glbPart(g, gearScene, skinned.spec.helmetMesh, { p: [0, -0.22, 0], painterly: !!skinned.spec.painterly });
    } else {
      HELMETS[heroId]?.(b, g, new THREE.Vector3(0, -0.15, 0));
    }
  } else if (slot === 'armor' && workshop && HERO_LOOK[heroId]) {
    b.model(g, COATS[heroId] || 'KnightCuirass', { p: [0, -0.16, 0] });
    if (heroId === 'knight') {
      b.model(g, 'KnightFauld', { p: [0, -0.18, 0] });
      for (const side of [-1, 1]) {
        b.model(g, 'KnightPauldron', { p: [side * 0.25, 0.26, 0], s: [side, 1, 1] });
      }
    }
  } else if (slot === 'armor') {
    const L = HERO_LOOK[heroId] || BARE;
    b.part(g, G.capsule(0.165, 0.18), b.toon(L.sleeve), { p: [0, 0.12, 0], s: [1.15, 1, 0.88] });
    b.part(g, skirtGeo(L.robe || 0), b.toon(L.sleeve, { side: THREE.DoubleSide }), { p: [0, -0.04, 0], s: [1, 1, 0.86] });
    b.part(g, G.torus(0.19, 0.035, 6, 24), b.toon(L.trim), { p: [0, -0.02, 0], r: [Math.PI / 2, 0, 0] });
    for (const side of [-1, 1]) b.part(g, G.sphere(0.1, 12, 10), b.toon(L.trim), { p: [side * 0.24, 0.28, 0], s: [1.15, 0.8, 1.1] });
  } else if (slot === 'trinket') {
    const t = node('t', g, 0, -0.35, 0.15);
    TRINKETS[heroId]?.(b, t, { capes: [], orbiters: [], thrusters: [] });
  }
  b.bake(g);
  return { group: g, dispose: () => b.dispose() };
}

// ---------------------------------------------------------------------------
// ANIMATION CLIPS (data-driven poses, eased keyframes)
// ---------------------------------------------------------------------------
const JOINTS = ['hips', 'torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];

const READY = {
  blade: { armR: [-0.35, 0, -0.2], foreR: [-0.95, 0, 0], armL: [-0.15, 0, 0.22], foreL: [-0.55, 0, 0] },
  dual:  { armR: [-0.4, 0, -0.28], foreR: [-1.1, 0, 0], armL: [-0.4, 0, 0.28], foreL: [-1.1, 0, 0] },
  pyro: {
    armR: [-0.2, 0, -0.2], foreR: [-1.35, 0, 0], armL: [0.08, 0, 0.2], foreL: [-0.5, 0, 0],
    torso: [-0.02, 0.12, 0], head: [0.04, -0.1, 0],
    legL: [-0.12, 0, 0.05], shinL: [0.12, 0, 0], legR: [0.14, 0, -0.06], shinR: [0.08, 0, 0], hipsY: 0.61
  },
  shinobi: {
    armR: [0.05, 0, -0.38], foreR: [-1.05, 0, 0], armL: [-0.55, 0, 0.05], foreL: [-1.95, 0, 0],
    torso: [0.28, 0.18, 0], head: [-0.12, -0.12, 0],
    legL: [-0.4, 0, 0.16], shinL: [0.6, 0, 0], legR: [0.38, 0, -0.16], shinR: [0.55, 0, 0], hipsY: 0.52
  },
  cast:  { armR: [-0.25, 0, -0.15], foreR: [-0.75, 0, 0], armL: [-0.1, 0, 0.22], foreL: [-0.45, 0, 0] },
  gun:   { armR: [-0.2, 0, -0.22], foreR: [-1.25, 0, 0], armL: [-0.2, 0, 0.22], foreL: [-1.15, 0, 0] },
  twingun: {
    armR: [-0.4, 0, -0.3], foreR: [-2.4, 0, 0], armL: [-0.08, 0, 0.26], foreL: [-0.55, 0, 0],
    torso: [0, 0.18, 0], head: [-0.05, -0.14, 0],
    legL: [-0.15, 0, 0.12], shinL: [0.1, 0, 0], legR: [0.18, 0, -0.12], shinR: [0.14, 0, 0], hipsY: 0.61
  },
  fist:  { armR: [-0.45, 0, -0.3], foreR: [-1.9, 0, 0], armL: [-0.55, 0, 0.3], foreL: [-1.9, 0, 0], torso: [0.12, 0.15, 0] },
  shield: {
    // Firmly grounded Tree of Savior Swordsman 3/4 stance: both boots flat on the floor (sole=0.000),
    // upright kite shield on left flank, pronated clenched fist gripping broadsword cleanly to the right
    hips: [0, 0.24, 0],
    torso: [0.05, 0.14, -0.015], head: [-0.04, -0.34, 0.01],
    armL: [-0.58, 0, 0.18], foreL: [-1.15, 0, 0],
    armR: [0.14, 0, -0.46], foreR: [-0.26, 0, 0],
    legL: [-0.39, 0.10, 0.08], shinL: [0.39, 0, 0], footL: [0.0, 0, -0.08],
    legR: [0.31, -0.14, -0.08], shinR: [0.23, 0, 0], footR: [-0.54, 0, 0.08], hipsY: 0.594
  }
};
const KNEEL = { legL: [-1.45, 0, 0.14], shinL: [1.5, 0, 0], legR: [0.25, 0, -0.12], shinR: [1.55, 0, 0], hipsY: 0.37 };
const STANCE = { torso: [0.06, 0, 0], head: [0.06, 0, 0], legL: [-0.1, 0, 0.05], shinL: [0.14, 0, 0], legR: [0.12, 0, -0.05], shinR: [0.1, 0, 0], hipsY: HIPS_Y };

function pose(...layers) {
  const out = {};
  for (const l of layers) Object.assign(out, l);
  return out;
}
const mirror = (p) => {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'hipsY') { out[k] = v; continue; }
    const mk = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
    out[mk] = [v[0], -v[1], -v[2]];
  }
  return out;
};

const EASE = {
  lin: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  io: (x) => x * x * (3 - 2 * x)
};

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// keys: [time, pose, easeIntoThisKey?]
function makeClip(name, keys, joints = JOINTS) {
  const samples = [];
  for (let i = 0; i < keys.length; i++) {
    const [t, p, ease = 'io'] = keys[i];
    if (i > 0) {
      const [t0, p0] = keys[i - 1];
      const f = EASE[ease];
      for (let s = 1; s <= 3; s++) {
        const u = s / 4;
        const k = f(u);
        const mix = {};
        for (const j of joints) {
          const a = p0[j] || [0, 0, 0];
          const bb = p[j] || [0, 0, 0];
          mix[j] = [a[0] + (bb[0] - a[0]) * k, a[1] + (bb[1] - a[1]) * k, a[2] + (bb[2] - a[2]) * k];
        }
        const ha = p0.hipsY ?? HIPS_Y;
        const hb = p.hipsY ?? HIPS_Y;
        mix.hipsY = ha + (hb - ha) * k;
        if (p0.hipsOffset || p.hipsOffset) {
          const a = p0.hipsOffset || [0, 0, 0];
          const b = p.hipsOffset || [0, 0, 0];
          mix.hipsOffset = a.map((value, i) => value + (b[i] - value) * k);
        }
        samples.push([t0 + (t - t0) * u, mix]);
      }
    }
    samples.push([t, p]);
  }
  const times = samples.map(s => s[0]);
  const tracks = [];
  for (const j of joints) {
    const vals = [];
    for (const [, p] of samples) {
      const e = p[j] || [0, 0, 0];
      _q.setFromEuler(_e.set(e[0], e[1], e[2]));
      vals.push(_q.x, _q.y, _q.z, _q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${j}.quaternion`, times, vals));
  }
  const pos = [];
  for (const [, p] of samples) {
    const [x, y, z] = p.hipsOffset || [0, 0, 0];
    pos.push(x, (p.hipsY ?? HIPS_Y) + y, z);
  }
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
  return new THREE.AnimationClip(name, times[times.length - 1], tracks);
}

// Keyframes baked by tools/rig/bake-mixamo.mjs: local joint quaternions and the hips position.
function bakedClip(name, data) {
  const tracks = Object.entries(data.rotations).map(([joint, values]) => new THREE.QuaternionKeyframeTrack(`${joint}.quaternion`, data.times, values));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', data.times, data.hips));
  return new THREE.AnimationClip(name, data.duration, tracks);
}

const KNIGHT_JOINTS = [...JOINTS, 'handL', 'handR'];
// Server states that replace a basic swing before its blade lands.
const CUTS_A_SWING = new Set(['hurt', 'knockdown', 'dead', 'frozen', 'skill', 'heavy']);
const KNIGHT_SWINGS = new Set(['attack1', 'attack2', 'attack3', 'airRise', 'airCut', 'airSpike']);
const makeKnightClip = (name, keys) => makeClip(name, keys, KNIGHT_JOINTS);
const KNIGHT_BLADE_CONTACT = Object.fromEntries(Object.entries(KNIGHT_STRIKES).map(([name, strike]) => [name, strike.contact]));

function buildClips(style, skinnedKnight = false) {
  const base = pose(STANCE, READY[style]);
  const P = (...l) => pose(base, ...l);
  const clips = {};
  const lunge = { legL: [-0.45, 0, 0.05], shinL: [0.35, 0, 0], legR: [0.4, 0, -0.05], shinR: [0.25, 0, 0], hipsY: 0.57 };

  // Locomotion
  // Idle: firmly planted feet on floor (sole=0.000, zero slide) with calm organic warrior breathing
  if (style === 'shield') {
    const shIdleHi = P({
      hips: [0, 0.24, 0], torso: [0.04, 0.15, -0.015], head: [-0.04, -0.35, 0.01], hipsY: 0.594,
      armL: [-0.56, 0, 0.19], foreL: [-1.13, 0, 0],
      armR: [0.12, 0, -0.45], foreR: [-0.24, 0, 0],
      legL: [-0.39, 0.10, 0.08], shinL: [0.39, 0, 0], footL: [0.0, 0, -0.08],
      legR: [0.31, -0.14, -0.08], shinR: [0.23, 0, 0], footR: [-0.54, 0, 0.08]
    });
    const shIdleMid = P({
      hips: [0, 0.24, 0], torso: [0.06, 0.14, 0.008], head: [-0.03, -0.34, -0.006], hipsY: 0.590,
      armL: [-0.59, 0, 0.17], foreL: [-1.16, 0, 0],
      armR: [0.15, 0, -0.47], foreR: [-0.27, 0, 0],
      legL: [-0.46, 0.10, 0.08], shinL: [0.51, 0, 0], footL: [-0.05, 0, -0.08],
      legR: [0.25, -0.14, -0.08], shinR: [0.36, 0, 0], footR: [-0.61, 0, 0.08]
    });
    const shIdleLo = P({
      hips: [0, 0.24, 0], torso: [0.075, 0.13, 0.012], head: [-0.05, -0.33, -0.008], hipsY: 0.586,
      armL: [-0.61, 0, 0.16], foreL: [-1.18, 0, 0],
      armR: [0.17, 0, -0.49], foreR: [-0.29, 0, 0],
      legL: [-0.51, 0.10, 0.08], shinL: [0.60, 0, 0], footL: [-0.09, 0, -0.08],
      legR: [0.20, -0.14, -0.08], shinR: [0.46, 0, 0], footR: [-0.66, 0, 0.08]
    });
    clips.idle = makeClip('idle', [[0, shIdleHi], [0.55, shIdleMid], [1.05, shIdleLo], [1.55, shIdleMid], [2.10, shIdleHi]]);
  } else {
    const idleA = P({ hips: [0, 0, 0.035], torso: [0.06, 0.05, -0.04], head: [0.06, -0.04, 0.02] });
    const idleB = P({ hips: [0, 0, -0.03], torso: [0.1, -0.04, 0.035], head: [0.02, 0.04, -0.02], hipsY: 0.6, armR: [base.armR[0] - 0.06, 0, base.armR[2] - 0.05], armL: [base.armL[0] - 0.06, 0, base.armL[2] + 0.05] });
    clips.idle = makeClip('idle', [[0, idleA], [1.0, idleB], [2.0, idleA]]);
  }
  const runArms = style === 'fist' || style === 'shield' ? {} : null;
  const runK = (side) => {
    const s = side;
    return P({
      torso: [0.28, 0.14 * s, 0], head: [-0.12, -0.1 * s, 0],
      legL: [s > 0 ? -0.85 : 0.65, 0, 0.03], shinL: [s > 0 ? 0.25 : 0.75, 0, 0],
      legR: [s > 0 ? 0.65 : -0.85, 0, -0.03], shinR: [s > 0 ? 0.75 : 0.25, 0, 0],
      armR: runArms ? base.armR : [s > 0 ? 0.55 : -0.75, 0, -0.18], foreR: runArms ? base.foreR : [-1.15, 0, 0],
      armL: runArms ? base.armL : [s > 0 ? -0.75 : 0.55, 0, 0.18], foreL: runArms ? base.foreL : [-1.15, 0, 0],
      hipsY: 0.57
    });
  };
  const pass = (s) => P({
    torso: [0.28, 0, 0], head: [-0.12, 0, 0],
    legL: [s > 0 ? -0.1 : -0.2, 0, 0.03], shinL: [s > 0 ? 0.35 : 1.45, 0, 0],
    legR: [s > 0 ? -0.2 : -0.1, 0, -0.03], shinR: [s > 0 ? 1.45 : 0.35, 0, 0],
    armR: runArms ? base.armR : [-0.1, 0, -0.18], foreR: runArms ? base.foreR : [-1.15, 0, 0],
    armL: runArms ? base.armL : [-0.1, 0, 0.18], foreL: runArms ? base.foreL : [-1.15, 0, 0],
    hipsY: 0.67
  });
  if (style === 'shinobi') {
    const nr = (p) => pose(p, { torso: [0.62, 0, 0], head: [-0.5, 0, 0], armR: [1.05, 0, -0.28], foreR: [-0.15, 0, 0], armL: [1.05, 0, 0.28], foreL: [-0.15, 0, 0] });
    clips.run = makeClip('run', [[0, nr(runK(1))], [0.1, nr(pass(1)), 'out'], [0.2, nr(runK(-1)), 'in'], [0.3, nr(pass(-1)), 'out'], [0.4, nr(runK(1)), 'in']]);
  } else if (style === 'pyro') {
    const pr = (p) => pose(p, { torso: [0.2, p.torso[1] * 0.5, 0], armR: [-0.35, 0, -0.2], foreR: [-1.25, 0, 0] });
    clips.run = makeClip('run', [[0, pr(runK(1))], [0.12, pr(pass(1)), 'out'], [0.24, pr(runK(-1)), 'in'], [0.36, pr(pass(-1)), 'out'], [0.48, pr(runK(1)), 'in']]);
  } else if (style === 'shield') {
    // Grounded 8-keyframe (4-phase per leg) ToS Swordsman run with real ankle articulation
    // (heel-strike -> flat mid-stance -> toe push-off -> high swing) and zero floor sinking!
    const shStride = (s) => {
      const m = (p) => (s > 0 ? p : {
        hips: [p.hips[0], -p.hips[1], -p.hips[2]],
        torso: [p.torso[0], -p.torso[1], -p.torso[2]],
        head: [p.head[0], -p.head[1], -p.head[2]],
        legL: [p.legR[0], -p.legR[1], -p.legR[2]], shinL: p.shinR, footL: [p.footR[0], -p.footR[1], -p.footR[2]],
        legR: [p.legL[0], -p.legL[1], -p.legL[2]], shinR: p.shinL, footR: [p.footL[0], -p.footL[1], -p.footL[2]],
        armL: p.armL_opp, foreL: p.foreL_opp,
        armR: p.armR_opp, foreR: p.foreR_opp,
        hipsY: p.hipsY
      });
      const contact = m({
        hips: [0.06, -0.14, 0.03], torso: [0.20, 0.18, -0.03], head: [-0.14, -0.06, 0.01], hipsY: 0.570,
        legL: [-0.52, 0, 0.04], shinL: [0.28, 0, 0], footL: [0.16, 0, -0.04],
        legR: [0.42, 0, -0.04], shinR: [0.42, 0, 0], footR: [-0.36, 0, 0.04],
        armL: [-0.70, 0, 0.14], foreL: [-1.14, 0, 0], armL_opp: [-0.58, 0, 0.16], foreL_opp: [-1.06, 0, 0],
        armR: [0.44, 0, -0.44], foreR: [-0.42, 0, 0], armR_opp: [0.22, 0, -0.48], foreR_opp: [-0.30, 0, 0]
      });
      const down = m({
        hips: [0.08, -0.06, 0.02], torso: [0.22, 0.10, -0.02], head: [-0.15, -0.04, 0], hipsY: 0.606,
        legL: [-0.30, 0, 0.04], shinL: [0.54, 0, 0], footL: [-0.28, 0, -0.04],
        legR: [0.18, 0, -0.04], shinR: [1.08, 0, 0], footR: [0.22, 0, 0.04],
        armL: [-0.66, 0, 0.15], foreL: [-1.12, 0, 0], armL_opp: [-0.62, 0, 0.16], foreL_opp: [-1.08, 0, 0],
        armR: [0.36, 0, -0.46], foreR: [-0.38, 0, 0], armR_opp: [0.28, 0, -0.46], foreR_opp: [-0.34, 0, 0]
      });
      const pass = m({
        hips: [0.06, 0.04, -0.01], torso: [0.20, -0.04, 0.01], head: [-0.14, 0.02, 0], hipsY: 0.618,
        legL: [0.08, 0, 0.04], shinL: [0.24, 0, 0], footL: [-0.34, 0, -0.04],
        legR: [-0.46, 0, -0.04], shinR: [1.15, 0, 0], footR: [0.18, 0, 0.04],
        armL: [-0.60, 0, 0.16], foreL: [-1.08, 0, 0], armL_opp: [-0.68, 0, 0.14], foreL_opp: [-1.14, 0, 0],
        armR: [0.26, 0, -0.48], foreR: [-0.32, 0, 0], armR_opp: [0.40, 0, -0.44], foreR_opp: [-0.40, 0, 0]
      });
      const push = m({
        hips: [0.06, 0.12, -0.03], torso: [0.19, -0.14, 0.03], head: [-0.13, 0.05, -0.01], hipsY: 0.576,
        legL: [0.40, 0, 0.04], shinL: [0.24, 0, 0], footL: [-0.32, 0, -0.04],
        legR: [-0.60, 0, -0.04], shinR: [0.64, 0, 0], footR: [0.08, 0, 0.04],
        armL: [-0.58, 0, 0.16], foreL: [-1.06, 0, 0], armL_opp: [-0.70, 0, 0.14], foreL_opp: [-1.14, 0, 0],
        armR: [0.20, 0, -0.48], foreR: [-0.28, 0, 0], armR_opp: [0.46, 0, -0.44], foreR_opp: [-0.44, 0, 0]
      });
      return [P(contact), P(down), P(pass), P(push)];
    };
    const [c1, d1, p1, u1] = shStride(1);
    const [c2, d2, p2, u2] = shStride(-1);
    clips.run = makeClip('run', [
      [0.00, c1], [0.06, d1, 'out'], [0.125, p1, 'io'], [0.19, u1, 'in'],
      [0.25, c2, 'out'], [0.31, d2, 'out'], [0.375, p2, 'io'], [0.44, u2, 'in'],
      [0.50, c1, 'out']
    ]);
  } else {
    clips.run = makeClip('run', [[0, runK(1)], [0.12, pass(1), 'out'], [0.24, runK(-1), 'in'], [0.36, pass(-1), 'out'], [0.48, runK(1), 'in']]);
  }

  const air = style === 'shield'
    ? P({ hips: [0.06, 0.16, 0], torso: [0.14, 0.14, 0], head: [-0.10, -0.20, 0], legL: [-0.95, 0, 0.08], shinL: [1.28, 0, 0], footL: [0.32, 0, 0], legR: [0.34, 0, -0.06], shinR: [0.42, 0, 0], footR: [0.45, 0, 0], armL: [-0.92, 0, 0.14], foreL: [-1.10, 0, 0], armR: [0.35, 0, -0.64], foreR: [-0.32, 0, 0], hipsY: 0.64 })
    : P({ torso: [0.12, 0, 0], legL: [-1.0, 0, 0.06], shinL: [1.5, 0, 0], legR: [-0.25, 0, -0.06], shinR: [1.0, 0, 0], armR: [-0.5, 0, -0.95], foreR: [-0.6, 0, 0], armL: [-0.5, 0, 0.95], foreL: [-0.6, 0, 0] });
  const air2 = style === 'shield'
    ? pose(air, { legL: [-0.82, 0, 0.08], shinL: [1.14, 0, 0], legR: [0.24, 0, -0.06], shinR: [0.56, 0, 0], armL: [-0.84, 0, 0.18], armR: [0.26, 0, -0.70] })
    : pose(air, { legL: [-0.85, 0, 0.06], armR: [-0.4, 0, -1.05], armL: [-0.4, 0, 1.05] });
  clips.jump = makeClip('jump', [[0, air], [0.28, air2], [0.56, air]]);
  const fall = style === 'shield'
    ? P({ hips: [0.04, 0.18, 0], torso: [0.10, 0.10, 0], head: [0.06, -0.22, 0], legL: [-0.46, 0, 0.08], shinL: [0.58, 0, 0], footL: [0.22, 0, 0], legR: [0.18, 0, -0.08], shinR: [0.48, 0, 0], footR: [0.28, 0, 0], armL: [-0.80, 0, 0.22], foreL: [-1.02, 0, 0], armR: [-0.08, 0, -0.78], foreR: [-0.34, 0, 0], hipsY: 0.62 })
    : P({ torso: [0.02, 0, 0], head: [-0.1, 0, 0], legL: [-0.45, 0, 0.08], shinL: [0.65, 0, 0], legR: [0.15, 0, -0.08], shinR: [0.45, 0, 0], armR: [-0.9, 0, -1.25], foreR: [-0.3, 0, 0], armL: [-0.9, 0, 1.25], foreL: [-0.3, 0, 0] });
  clips.fall = makeClip('fall', [[0, fall], [0.25, pose(fall, { armR: [fall.armR[0] - 0.08, 0, fall.armR[2] - 0.06], armL: [fall.armL[0] - 0.06, 0, fall.armL[2] + 0.06] })], [0.5, fall]]);
  const dash = style === 'shield'
    ? P({ hips: [0.12, -0.14, 0.04], torso: [0.32, 0.20, -0.03], head: [-0.26, -0.10, 0], armL: [-0.94, 0, 0.06], foreL: [-1.18, 0, 0], armR: [0.64, 0, -0.46], foreR: [-0.30, 0, 0], legL: [-0.66, 0, 0.05], shinL: [0.36, 0, 0], footL: [0.18, 0, -0.05], legR: [0.56, 0, -0.05], shinR: [0.48, 0, 0], footR: [-0.38, 0, 0.05], hipsY: 0.566 })
    : P({ torso: [0.7, 0, 0], head: [-0.45, 0, 0], armR: [0.95, 0, -0.35], foreR: [-0.3, 0, 0], armL: [0.95, 0, 0.35], foreL: [-0.3, 0, 0], legL: [-0.75, 0, 0], shinL: [1.0, 0, 0], legR: [0.85, 0, 0], shinR: [0.35, 0, 0], hipsY: 0.52 });
  clips.dash = style === 'shield'
    ? makeClip('dash', [
        [0.00, dash],
        [0.09, pose(dash, { hips: [0.12, 0, 0], torso: [0.34, 0.06, 0], legL: [-0.14, 0, 0.05], shinL: [0.42, 0, 0], footL: [-0.28, 0, -0.05], legR: [-0.44, 0, -0.05], shinR: [1.22, 0, 0], footR: [0.22, 0, 0.05], hipsY: 0.606 }), 'out'],
        [0.18, pose(dash, { hips: [0.12, 0.14, -0.04], torso: [0.32, -0.10, 0.03], legL: [0.56, 0, 0.05], shinL: [0.48, 0, 0], footL: [-0.38, 0, -0.05], legR: [-0.66, 0, -0.05], shinR: [0.36, 0, 0], footR: [0.18, 0, 0.05], hipsY: 0.566 }), 'in'],
        [0.27, pose(dash, { hips: [0.12, 0, 0], torso: [0.34, 0.06, 0], legL: [-0.44, 0, 0.05], shinL: [1.22, 0, 0], footL: [0.22, 0, -0.05], legR: [-0.14, 0, -0.05], shinR: [0.42, 0, 0], footR: [-0.28, 0, 0.05], hipsY: 0.606 }), 'out'],
        [0.36, dash, 'in']
      ])
    : makeClip('dash', [[0, dash], [0.2, pose(dash, { torso: [0.62, 0, 0] })], [0.4, dash]]);
  const fly = P({ torso: [0.8, 0, 0], head: [-0.55, 0, 0], armR: [0.5, 0, -0.65], foreR: [-0.2, 0, 0], armL: [0.5, 0, 0.65], foreL: [-0.2, 0, 0], legL: [0.45, 0, 0.06], shinL: [0.45, 0, 0], legR: [0.35, 0, -0.06], shinR: [0.7, 0, 0] });
  clips.fly = makeClip('fly', [[0, fly], [0.4, pose(fly, { legL: [0.3, 0, 0.06], legR: [0.5, 0, -0.06], torso: [0.74, 0, 0] })], [0.8, fly]]);

  const guard = P({ torso: [0.15, 0.25, 0], armL: [-1.35, 0, -0.55], foreL: [-0.9, 0, 0], armR: [-0.6, 0, -0.25], foreR: [-1.3, 0, 0], legL: [-0.38, 0, 0.1], shinL: [0.5, 0, 0], legR: [0.38, 0, -0.1], shinR: [0.4, 0, 0], hipsY: 0.55 });
  const guardPose = style === 'shield'
    ? P({
        hips: [0, 0.24, 0], torso: [0.18, 0.22, 0], head: [-0.10, -0.36, 0],
        armL: [-1.22, 0, -0.18], foreL: [-0.82, 0, 0],
        armR: [0.40, 0, -0.50], foreR: [-0.58, 0, 0],
        legL: [-0.63, 0.10, 0.08], shinL: [0.69, 0, 0], footL: [-0.06, 0, -0.08],
        legR: [0.30, -0.14, -0.08], shinR: [0.44, 0, 0], footR: [-0.74, 0, 0.08],
        hipsY: 0.570
      })
    : guard;
  clips.guard = makeClip('guard', [[0, guardPose], [0.6, pose(guardPose, { torso: [guardPose.torso[0] + 0.025, guardPose.torso[1], 0], armL: [guardPose.armL[0] - 0.03, 0, guardPose.armL[2]] })], [1.2, guardPose]]);

  // Attacks: [anticipation] -> [strike, eased out = snappy] -> [follow-through] -> settle
  const A = {};
  if (style === 'blade' || style === 'dual') {
    A.a1 = [
      P({ torso: [0.1, -0.75, 0], armR: [-1.3, 0, -1.1], foreR: [-0.55, 0, 0], hipsY: 0.6 }),
      P(lunge, { torso: [0.22, 0.6, 0], armR: [-1.42, 0, 0.45], foreR: [-0.05, 0, 0] }),
      P(lunge, { torso: [0.16, 0.72, 0], armR: [-1.05, 0, 0.7], foreR: [-0.3, 0, 0] })
    ];
    A.a2 = style === 'dual'
      ? A.a1.map(mirror).map(p => pose(base, p))
      : [
        P({ torso: [0.1, 0.62, 0], armR: [-1.3, 0, 0.6], foreR: [-1.25, 0, 0], hipsY: 0.6 }),
        P(lunge, { torso: [0.22, -0.62, 0], armR: [-1.42, 0, -1.0], foreR: [-0.08, 0, 0] }),
        P(lunge, { torso: [0.16, -0.72, 0], armR: [-1.0, 0, -1.2], foreR: [-0.3, 0, 0] })
      ];
    A.a3 = style === 'dual'
      ? [
        P({ torso: [-0.2, 0, 0], armR: [-2.5, 0, -0.65], foreR: [-0.4, 0, 0], armL: [-2.5, 0, 0.65], foreL: [-0.4, 0, 0], hipsY: 0.64 }),
        P(lunge, { torso: [0.45, 0, 0], armR: [-0.85, 0, 0.55], foreR: [0, 0, 0], armL: [-0.85, 0, -0.55], foreL: [0, 0, 0], hipsY: 0.5 }),
        P(lunge, { torso: [0.4, 0, 0], armR: [-0.6, 0, 0.6], foreR: [-0.2, 0, 0], armL: [-0.6, 0, -0.6], foreL: [-0.2, 0, 0], hipsY: 0.5 })
      ]
      : [
        P({ torso: [-0.25, -0.1, 0], armR: [-2.9, 0, -0.1], foreR: [-0.55, 0, 0], armL: [-2.6, 0, 0.25], foreL: [-0.5, 0, 0], hipsY: 0.62 }),
        P(lunge, { torso: [0.52, 0, 0], armR: [-0.72, 0, 0], foreR: [0, 0, 0], armL: [-0.8, 0, -0.1], foreL: [-0.2, 0, 0], legL: [-0.75, 0, 0.05], shinL: [0.75, 0, 0], legR: [0.6, 0, -0.05], shinR: [0.2, 0, 0], hipsY: 0.48 }),
        P(lunge, { torso: [0.5, 0, 0], armR: [-0.6, 0, 0], foreR: [-0.05, 0, 0], armL: [-0.7, 0, -0.1], foreL: [-0.25, 0, 0], legL: [-0.75, 0, 0.05], shinL: [0.75, 0, 0], legR: [0.6, 0, -0.05], shinR: [0.2, 0, 0], hipsY: 0.48 })
      ];
  } else if (style === 'pyro') {
    const step = { legL: [-0.42, 0, 0.1], shinL: [0.45, 0, 0], legR: [0.35, 0, -0.1], shinR: [0.2, 0, 0], hipsY: 0.56 };
    // 1: Flare - free palm drawn to the shoulder, then thrust at the target
    const palmA = P({ torso: [0.0, 0.4, 0], head: [0, -0.35, 0], armL: [0.3, 0, 0.45], foreL: [-2.0, 0, 0] });
    const palmB = P(step, { torso: [0.15, -0.42, 0], head: [-0.05, 0.35, 0], armL: [-1.55, 0, -0.08], foreL: [-0.05, 0, 0] });
    // 2: staff thrust - the orb is driven forward (wrist tilts the staff, see staffTilt)
    const staffA = P({ torso: [-0.05, -0.3, 0], head: [0, 0.25, 0], armR: [0.25, 0, -0.3], foreR: [-1.65, 0, 0] });
    const staffB = P(step, { torso: [0.15, 0.4, 0], head: [-0.05, -0.35, 0], armR: [-1.35, 0, -0.05], foreR: [-0.55, 0, 0] });
    // 3: Hell Breath - coil to the side, then both hands thrust forward pouring fire
    const breathA = P({ torso: [0.05, 0.55, 0], head: [0, -0.45, 0], armL: [0.1, 0, -0.35], foreL: [-1.9, 0, 0], armR: [0.25, 0, -0.35], foreR: [-1.6, 0, 0], hipsY: 0.57 });
    const breathB = P({ legL: [-0.6, 0, 0.12], shinL: [0.7, 0, 0], legR: [0.5, 0, -0.12], shinR: [0.25, 0, 0], hipsY: 0.5 }, { torso: [0.32, -0.1, 0], head: [-0.25, 0.1, 0], armL: [-1.45, 0, -0.12], foreL: [-0.05, 0, 0], armR: [-1.2, 0, 0.08], foreR: [-0.6, 0, 0] });
    const cast = (name, a, b, t) => makeClip(name, [[0, base], [t[0], a, 'out'], [t[1], b, 'out'], [t[2], pose(b, { torso: [b.torso[0] + 0.03, b.torso[1], 0] }), 'lin'], [t[3], base, 'io']]);
    clips.attack1 = cast('attack1', palmA, palmB, [0.06, 0.12, 0.3, 0.45]);
    clips.attack2 = cast('attack2', staffA, staffB, [0.06, 0.12, 0.3, 0.45]);
    clips.attack3 = cast('attack3', breathA, breathB, [0.1, 0.17, 0.48, 0.64]);
    // Heavy: Dragon Pillar - crouch, then arms flung wide and held while the pillars erupt
    const pillarA = P({ torso: [0.35, 0, 0], head: [0.15, 0, 0], armL: [-0.6, 0, -0.5], foreL: [-1.5, 0, 0], armR: [-0.6, 0, 0.3], foreR: [-1.5, 0, 0], legL: [-0.5, 0, 0.15], shinL: [0.75, 0, 0], legR: [0.45, 0, -0.15], shinR: [0.65, 0, 0], hipsY: 0.48 });
    const pillarB = P({ torso: [-0.18, 0, 0], head: [-0.22, 0, 0], armL: [-0.35, 0, 1.4], foreL: [-0.1, 0, 0], armR: [-0.35, 0, -1.4], foreR: [-1.2, 0, 0], legL: [-0.35, 0, 0.2], shinL: [0.25, 0, 0], legR: [0.35, 0, -0.2], shinR: [0.2, 0, 0], hipsY: 0.58 });
    clips.heavy = makeClip('heavy', [[0, base], [0.12, pillarA, 'out'], [0.22, pillarB, 'out'], [0.56, pose(pillarB, { head: [-0.28, 0, 0] }), 'lin'], [0.74, base, 'io']]);
    A.a1 = null;
  } else if (style === 'shinobi') {
    const low = { legL: [-0.85, 0, 0.14], shinL: [1.05, 0, 0], legR: [0.75, 0, -0.14], shinR: [0.5, 0, 0], hipsY: 0.4 };
    const sealL = { armL: [-0.55, 0, 0.05], foreL: [-1.95, 0, 0] };
    // 1: Dagger Slash, right to left, dropping into a low lunge
    const s1a = P({ torso: [0.35, -0.65, 0], head: [-0.1, 0.45, 0], armR: [0.45, 0, -0.95], foreR: [-0.5, 0, 0], hipsY: 0.48 });
    const s1b = P(low, sealL, { torso: [0.62, 0.7, 0], head: [-0.35, -0.5, 0], armR: [-1.3, 0, 0.62], foreR: [-0.05, 0, 0] });
    // 2: backhand, left to right
    const s2a = P({ torso: [0.35, 0.6, 0], head: [-0.1, -0.4, 0], armR: [-1.15, 0, 0.75], foreR: [-1.3, 0, 0], hipsY: 0.48 });
    const s2b = P(low, sealL, { torso: [0.62, -0.7, 0], head: [-0.35, 0.5, 0], armR: [-1.25, 0, -1.15], foreR: [-0.05, 0, 0] });
    const quick = (name, a, b) => makeClip(name, [[0, base], [0.03, a, 'out'], [0.075, b, 'out'], [0.17, pose(b, { torso: [b.torso[0] + 0.03, b.torso[1], 0] }), 'lin'], [0.3, base, 'io']]);
    clips.attack1 = quick('attack1', s1a, s1b);
    clips.attack2 = quick('attack2', s2a, s2b);
    // 4th hit: hop + one full spinning slash with both kunai out (spin is applied in code)
    const hop = P({ torso: [0.2, 0, 0], head: [0, 0, 0], armR: [-1.45, 0, -1.3], foreR: [0, 0, 0], armL: [-1.45, 0, 1.3], foreL: [0, 0, 0], legL: [-0.9, 0, 0.1], shinL: [1.4, 0, 0], legR: [-0.4, 0, -0.1], shinR: [1.2, 0, 0], hipsY: 0.85 });
    const land = P(low, { torso: [0.55, 0.3, 0], head: [-0.3, -0.2, 0], armR: [-1.2, 0, 0.5], foreR: [0, 0, 0], armL: [-0.9, 0, -0.4], foreL: [-0.2, 0, 0] });
    clips.attack3 = makeClip('attack3', [[0, base], [0.04, pose(base, { hipsY: 0.44, torso: [0.4, 0, 0] }), 'out'], [0.1, hop, 'out'], [0.26, hop, 'lin'], [0.33, land, 'in'], [0.44, land], [0.56, base, 'io']]);
    // Heavy: Shadow Backstab - kunai raised reverse, then driven down into the target
    const stabUp = P({ torso: [-0.15, 0, 0], head: [-0.2, 0, 0], armR: [-2.6, 0, -0.35], foreR: [-0.8, 0, 0], armL: [-2.6, 0, 0.35], foreL: [-0.8, 0, 0], hipsY: 0.6 });
    const stabDown = P(low, { torso: [0.7, 0, 0], head: [-0.4, 0, 0], armR: [-1.0, 0, 0.28], foreR: [0, 0, 0], armL: [-1.0, 0, -0.28], foreL: [0, 0, 0] });
    clips.heavy = makeClip('heavy', [[0, base], [0.06, stabUp, 'out'], [0.13, stabDown, 'out'], [0.36, stabDown, 'lin'], [0.5, base, 'io']]);
    A.a1 = null;
  } else if (style === 'shield') {
    const crouchWide = { legL: [-0.55, 0, 0.16], shinL: [0.75, 0, 0], legR: [0.45, 0, -0.16], shinR: [0.6, 0, 0], hipsY: 0.5 };
    const deepLunge = { legL: [-0.92, 0, 0.12], shinL: [1.02, 0, 0], legR: [0.76, 0, -0.12], shinR: [0.32, 0, 0], hipsY: 0.43 };
    if (skinnedKnight) {
      Object.assign(crouchWide, { hips: [0.10, -0.12, 0.07], hipsOffset: [-0.045, 0, -0.08], hipsY: 0.535 });
      Object.assign(deepLunge, {
        hips: [0.12, 0.19, -0.08], hipsOffset: [0.07, 0, 0.12], hipsY: 0.49,
        footL: [-0.20, 0, -0.10], footR: [0.20, 0, 0.10]
      });
    }
    const tucked = { armL: [0.10, 0, 0.28], foreL: [-1.25, 0, 0] };
    // 1: ToS M Swordsman Double Slash (high shoulder coil -> explosive diagonal cleave)
    const sweepAntic = P(crouchWide, { torso: [0.14, -0.82, 0], head: [-0.06, 0.58, 0], armR: [-1.95, 0, -1.22], foreR: [-0.42, 0, 0] });
    const sweepHit = P(deepLunge, tucked, { torso: [0.44, 0.85, 0], head: [-0.12, -0.60, 0], armR: [-1.22, 0, 0.72], foreR: [-0.04, 0, 0] });
    const sweepHold = pose(sweepHit, { torso: [0.46, 0.90, 0], armR: [-1.14, 0, 0.78] });
    // 2: Peltasta Shield Bash + crisp reverse backhand sword cut
    const bashAntic = P(crouchWide, { torso: [0.10, 0.62, 0], head: [-0.04, -0.45, 0], armL: [0.12, 0, 0.12], foreL: [-2.05, 0, 0], armR: [-1.32, 0, 0.76], foreR: [-0.6, 0, 0] });
    const bashHit = P(deepLunge, { torso: [0.36, -0.62, 0], head: [-0.14, 0.48, 0], armL: [-1.52, 0, -0.16], foreL: [-0.12, 0, 0], armR: [-1.05, 0, -1.32], foreR: [-0.08, 0, 0] });
    const bashHold = pose(bashHit, { torso: [0.38, -0.66, 0], armR: [-0.95, 0, -1.38] });
    // 3: Highlander Crosscut — quick gather + airborne hop cleave slamming downward
    const smashGather = P(crouchWide, { torso: [0.28, -0.15, 0], head: [-0.15, 0.1, 0], armR: [-2.2, 0, -0.5], foreR: [-0.6, 0, 0], hipsY: 0.46 });
    const smashAntic = P({ torso: [-0.34, -0.18, 0], head: [-0.28, 0.12, 0], armR: [-3.05, 0, -0.14], foreR: [-0.4, 0, 0], armL: [-0.7, 0, 0.45], foreL: [-1.0, 0, 0], legL: [-0.85, 0, 0.12], shinL: [1.3, 0, 0], legR: [-0.3, 0, -0.12], shinR: [1.0, 0, 0], hipsY: 0.76 });
    const smashHit = P(deepLunge, tucked, { torso: [0.52, 0.12, 0], head: [-0.28, -0.08, 0], armR: [-0.68, 0, 0.14], foreR: [0, 0, 0], hipsY: 0.43 });
    const smashHold = pose(smashHit, { torso: [0.54, 0.14, 0] });
    // Smooth, organic attack timings: snappy strike + elastic follow-through settle (no robotic statue freeze)
    const strikeHold = (name, antic, hit, hold, t) => makeClip(name, [[0, base], [t[0], antic, 'out'], [t[1], hit, 'out'], [t[2], hold, 'io'], [t[3], base, 'io']]);
    clips.attack1 = strikeHold('attack1', sweepAntic, sweepHit, sweepHold, [0.06, 0.13, 0.32, 0.50]);
    clips.attack2 = strikeHold('attack2', bashAntic, bashHit, bashHold, [0.055, 0.12, 0.30, 0.48]);
    clips.attack3 = makeClip('attack3', [[0, base], [0.05, smashGather, 'out'], [0.11, smashAntic, 'out'], [0.19, smashHit, 'in'], [0.42, smashHold, 'io'], [0.64, base, 'io']]);
    // Heavy: Murmilo Shield Drive — deep pull, explosive shield slam, elastic settle
    clips.heavy = makeClip('heavy', [[0, base], [0.15, pose(bashAntic, { hipsY: 0.46, foreL: [-2.1, 0, 0], armR: [0.45, 0, -0.72] }), 'out'], [0.24, pose(bashHit, { armL: [-1.46, 0, -0.14], torso: [0.44, -0.56, 0], armR: [0.58, 0, -0.78] }), 'out'], [0.46, pose(bashHold, { armR: [0.52, 0, -0.76] }), 'io'], [0.68, base, 'io']]);
    // Skills: Excalibur Wave wide sweeping cleave
    clips.sweep = strikeHold('sweep', pose(sweepAntic, { torso: [0.22, -0.96, 0], armR: [-1.52, 0, -1.36], hipsY: 0.47 }), pose(sweepHit, { torso: [0.46, 0.92, 0], armR: [-1.14, 0, 0.78] }), pose(sweepHold, { torso: [0.44, 0.96, 0] }), [0.11, 0.19, 0.50, 0.72]);
    A.a1 = null;
  } else if (style === 'cast') {
    A.a1 = [
      P({ torso: [0.0, -0.35, 0], armR: [-0.15, 0, -0.35], foreR: [-1.65, 0, 0] }),
      P(lunge, { torso: [0.18, 0.28, 0], armR: [-1.5, 0, -0.1], foreR: [-0.1, 0, 0], armL: [-1.1, 0, 0.35], foreL: [-0.3, 0, 0] }),
      P(lunge, { torso: [0.15, 0.3, 0], armR: [-1.35, 0, -0.1], foreR: [-0.2, 0, 0], armL: [-0.9, 0, 0.35], foreL: [-0.4, 0, 0] })
    ];
    A.a2 = [
      P({ torso: [0.0, 0.35, 0], armL: [-0.3, 0, 0.5], foreL: [-1.7, 0, 0] }),
      P(lunge, { torso: [0.18, -0.35, 0], armL: [-1.55, 0, 0.05], foreL: [-0.05, 0, 0], armR: [-0.6, 0, -0.35], foreR: [-0.9, 0, 0] }),
      P(lunge, { torso: [0.15, -0.3, 0], armL: [-1.4, 0, 0.05], foreL: [-0.15, 0, 0], armR: [-0.6, 0, -0.35], foreR: [-0.9, 0, 0] })
    ];
    A.a3 = [
      P({ torso: [-0.25, 0, 0], armR: [-2.8, 0, -0.15], foreR: [-0.4, 0, 0], armL: [-2.6, 0, 0.3], foreL: [-0.3, 0, 0], hipsY: 0.64 }),
      P(lunge, { torso: [0.4, 0, 0], armR: [-1.4, 0, 0], foreR: [0, 0, 0], armL: [-1.45, 0, 0.1], foreL: [0, 0, 0], hipsY: 0.52 }),
      P(lunge, { torso: [0.36, 0, 0], armR: [-1.3, 0, 0], foreR: [-0.1, 0, 0], armL: [-1.3, 0, 0.1], foreL: [-0.1, 0, 0], hipsY: 0.52 })
    ];
  } else if (style === 'twingun') {
    // Tree of Savior Bullet Marker: bladed side-on shots, the off gun cocked up by
    // the face; the shot itself (recoil + barrel flash) comes from SHOTS in code
    const aimR = P({ torso: [0.04, 0.62, 0], head: [0, -0.52, 0], armR: [-1.47, 0, -0.62], foreR: [0, 0, 0], armL: [-0.35, 0, 0.32], foreL: [-2.4, 0, 0], legL: [-0.32, 0, 0.14], shinL: [0.25, 0, 0], legR: [0.32, 0, -0.14], shinR: [0.15, 0, 0], hipsY: 0.6 });
    const aimL = pose(base, mirror(aimR));
    const shot = (name, aim) => makeClip(name, [[0, base], [0.045, aim, 'out'], [0.26, pose(aim, { torso: [aim.torso[0] + 0.02, aim.torso[1], 0] }), 'lin'], [0.4, base, 'io']]);
    clips.attack1 = shot('attack1', aimR);
    clips.attack2 = shot('attack2', aimL);
    // Finisher: drop to one knee, both guns out, alternating burst (Tracer Bullet)
    const kneelAim = P(KNEEL, { torso: [0.12, 0, 0], head: [-0.05, 0, 0], armR: [-1.45, 0, 0.06], foreR: [0, 0, 0], armL: [-1.45, 0, -0.06], foreL: [0, 0, 0] });
    clips.attack3 = makeClip('attack3', [[0, base], [0.06, kneelAim, 'out'], [0.34, pose(kneelAim, { torso: [0.15, 0, 0] }), 'lin'], [0.52, base, 'io']]);
    // Heavy: Deadeye Magnum - both guns side by side, one huge shot that throws the arms up
    const deadeye = P({ torso: [0.14, 0, 0], head: [-0.08, 0, 0], armR: [-1.47, 0, 0.06], foreR: [0, 0, 0], armL: [-1.47, 0, -0.06], foreL: [0, 0, 0], legL: [-0.55, 0, 0.12], shinL: [0.55, 0, 0], legR: [0.5, 0, -0.12], shinR: [0.25, 0, 0], hipsY: 0.53 });
    const recoil = pose(deadeye, { torso: [-0.3, 0, 0], head: [-0.25, 0, 0], armR: [-2.35, 0, 0.1], foreR: [-0.5, 0, 0], armL: [-2.35, 0, -0.1], foreL: [-0.5, 0, 0], legR: [0.7, 0, -0.12], shinR: [0.2, 0, 0], hipsY: 0.55 });
    clips.heavy = makeClip('heavy', [[0, base], [0.04, deadeye, 'out'], [0.075, deadeye, 'lin'], [0.12, recoil, 'out'], [0.28, deadeye, 'io'], [0.44, deadeye, 'lin'], [0.58, base, 'io']]);
    A.a1 = null;
  } else if (style === 'gun') {
    // Side-on quick draw: snap to aim, kick, settle, HOLD, holster. Tree-of-Savior
    // gunslingers read as clear poses with very short transitions between them.
    const aimR = P({ torso: [0.04, 0.6, 0], head: [0, -0.5, 0], armR: [-1.56, 0, 0.2], foreR: [0, 0, 0], armL: [-0.1, 0, 0.4], foreL: [-0.7, 0, 0], legL: [-0.32, 0, 0.14], shinL: [0.25, 0, 0], legR: [0.32, 0, -0.14], shinR: [0.15, 0, 0], hipsY: 0.6 });
    const kickR = pose(aimR, { armR: [-2.0, 0, 0.2], foreR: [-0.55, 0, 0], torso: [-0.14, 0.66, 0], head: [-0.12, -0.5, 0] });
    const aimL = mirror(aimR);
    const kickL = mirror(kickR);
    const draw = (name, aim, kick) => makeClip(name, [[0, base], [0.045, aim, 'out'], [0.08, kick, 'out'], [0.16, aim, 'io'], [0.3, aim], [0.42, base, 'io']]);
    clips.attack1 = draw('attack1', aimR, kickR);
    clips.attack2 = draw('attack2', aimL, kickL);
    // Finisher: both guns, fan the hammer (three kicks)
    const both = P({ torso: [0.08, 0, 0], head: [0.05, 0, 0], armR: [-1.5, 0, 0.22], foreR: [0, 0, 0], armL: [-1.5, 0, -0.22], foreL: [0, 0, 0], legL: [-0.45, 0, 0.14], shinL: [0.45, 0, 0], legR: [0.45, 0, -0.14], shinR: [0.3, 0, 0], hipsY: 0.55 });
    const kickB = pose(both, { armR: [-1.92, 0, 0.22], armL: [-1.92, 0, -0.22], foreR: [-0.42, 0, 0], foreL: [-0.42, 0, 0], torso: [-0.14, 0, 0], head: [-0.08, 0, 0] });
    clips.attack3 = makeClip('attack3', [[0, base], [0.05, both, 'out'], [0.075, kickB, 'out'], [0.13, both], [0.155, kickB, 'out'], [0.21, both], [0.235, kickB, 'out'], [0.32, both], [0.44, both], [0.56, base, 'io']]);
    A.a1 = null;
  } else {
    // fist
    A.a1 = [
      P({ torso: [0.1, -0.35, 0], armR: [-0.55, 0, -0.3], foreR: [-2.15, 0, 0] }),
      P(lunge, { torso: [0.2, 0.5, 0], armR: [-1.62, 0, 0.12], foreR: [-0.04, 0, 0] }),
      P(lunge, { torso: [0.18, 0.45, 0], armR: [-1.5, 0, 0.1], foreR: [-0.2, 0, 0] })
    ];
    A.a2 = A.a1.map(mirror).map(p => pose(base, p));
    A.a3 = [
      P({ torso: [0.35, 0.3, 0], armR: [-0.25, 0, -0.25], foreR: [-1.9, 0, 0], legL: [-0.6, 0, 0.1], shinL: [0.9, 0, 0], legR: [0.5, 0, -0.1], shinR: [0.7, 0, 0], hipsY: 0.48 }),
      P({ torso: [-0.2, -0.35, 0], armR: [-2.85, 0, 0.05], foreR: [-0.25, 0, 0], legL: [-0.1, 0, 0.05], shinL: [0.1, 0, 0], legR: [0.2, 0, -0.05], shinR: [0.5, 0, 0], hipsY: 0.72 }),
      P({ torso: [-0.15, -0.3, 0], armR: [-2.7, 0, 0.05], foreR: [-0.4, 0, 0], hipsY: 0.7 })
    ];
  }
  const attackClip = (name, [antic, strike, follow], dur = 0.36) => makeClip(name, [
    [0, base],
    [dur * 0.2, antic, 'out'],
    [dur * 0.42, strike, 'out'],
    [dur * 0.7, follow, 'io'],
    [dur, base, 'io']
  ]);
  if (A.a1) {
    clips.attack1 = attackClip('attack1', A.a1);
    clips.attack2 = attackClip('attack2', A.a2);
    clips.attack3 = attackClip('attack3', A.a3, 0.5);
  }

  const heavyUp0 = P({ torso: [-0.32, 0, 0], head: [-0.2, 0, 0], armR: [-2.9, 0, -0.2], foreR: [-0.6, 0, 0], armL: [-2.7, 0, 0.2], foreL: [-0.6, 0, 0], legL: [-0.3, 0, 0.08], shinL: [0.6, 0, 0], legR: [0.3, 0, -0.08], shinR: [0.5, 0, 0], hipsY: 0.58 });
  const heavyDown0 = P({ torso: [0.62, 0, 0], head: [0.1, 0, 0], armR: [-0.6, 0, 0], foreR: [0, 0, 0], armL: [-0.65, 0, 0], foreL: [0, 0, 0], legL: [-0.9, 0, 0.08], shinL: [0.95, 0, 0], legR: [0.7, 0, -0.08], shinR: [0.3, 0, 0], hipsY: 0.45 });
  const heavyUp = heavyUp0;
  const heavyDown = heavyDown0;
  if (!clips.heavy) clips.heavy = makeClip('heavy', [[0, base], [0.24, heavyUp, 'out'], [0.32, heavyDown, 'in'], [0.48, heavyDown], [0.65, base, 'io']]);

  const skillUp = P({ torso: [-0.28, 0, 0], head: [-0.32, 0, 0], armR: [-2.6, 0, -0.55], foreR: [-0.2, 0, 0], armL: [-2.6, 0, 0.55], foreL: [-0.2, 0, 0], hipsY: 0.66 });
  const skillOut = P({ torso: [0.32, 0, 0], head: [0.05, 0, 0], armR: [-1.5, 0, -0.15], foreR: [0, 0, 0], armL: [-1.5, 0, 0.15], foreL: [0, 0, 0], legL: [-0.5, 0, 0.1], shinL: [0.5, 0, 0], legR: [0.45, 0, -0.1], shinR: [0.25, 0, 0], hipsY: 0.55 });
  clips.skill = makeClip('skill', [[0, base], [0.14, skillUp, 'out'], [0.24, skillOut, 'out'], [0.45, skillOut], [0.62, base, 'io']]);

  if (!clips.sweep) {
    clips.sweep = clips.attack1.clone();
    clips.sweep.name = 'sweep';
  }
  // War cry: weapon raised high, chest out, head thrown back
  const roar = P({ torso: [-0.38, 0, 0], head: [-0.5, 0, 0], armR: [-2.8, 0, -0.55], foreR: [-0.2, 0, 0], armL: [-1.1, 0, 0.75], foreL: [-0.5, 0, 0], legL: [-0.42, 0, 0.16], shinL: [0.4, 0, 0], legR: [0.42, 0, -0.16], shinR: [0.35, 0, 0], hipsY: 0.6 });
  const roarCrouch = P({ torso: [0.4, 0, 0], head: [0.2, 0, 0], armR: [0.3, 0, -0.4], armL: [0.3, 0, 0.4], legL: [-0.55, 0, 0.16], shinL: [0.8, 0, 0], legR: [0.45, 0, -0.16], shinR: [0.7, 0, 0], hipsY: 0.47 });
  clips.warcry = makeClip('warcry', [[0, base], [0.12, roarCrouch, 'out'], [0.24, roar, 'out'], [0.6, pose(roar, { head: [-0.55, 0, 0] }), 'lin'], [0.76, base, 'io']]);
  // Shield charge: lean in behind the shield and drive with the legs
  const chargeArms = { torso: [0.55, 0, 0], head: [-0.4, 0, 0], armL: [-1.25, 0, -0.12], foreL: [-0.45, 0, 0], armR: [0.85, 0, -0.38], foreR: [-0.2, 0, 0] };
  clips.charge = makeClip('charge', [[0, pose(runK(1), chargeArms, { hipsY: 0.5 })], [0.1, pose(pass(1), chargeArms, { hipsY: 0.58 }), 'out'], [0.2, pose(runK(-1), chargeArms, { hipsY: 0.5 }), 'in'], [0.3, pose(pass(-1), chargeArms, { hipsY: 0.58 }), 'out'], [0.4, pose(runK(1), chargeArms, { hipsY: 0.5 }), 'in']]);

  // Enchant-fire pose: staff hand raised high overhead, free palm open, chest up
  const raiseUp = P({ torso: [-0.22, 0, 0], head: [-0.38, 0, 0], armR: [-2.75, 0, -0.25], foreR: [-0.35, 0, 0], armL: [-0.45, 0, 1.0], foreL: [-0.5, 0, 0], legL: [-0.2, 0, 0.1], shinL: [0.15, 0, 0], legR: [0.25, 0, -0.1], shinR: [0.15, 0, 0], hipsY: 0.62 });
  clips.raise = makeClip('raise', [[0, base], [0.12, raiseUp, 'out'], [0.58, pose(raiseUp, { head: [-0.42, 0, 0] }), 'lin'], [0.74, base, 'io']]);
  // Meteor: raise the staff, then bring it down to point at the target
  const pointDown = P({ torso: [0.3, 0.3, 0], head: [-0.2, -0.25, 0], armR: [-1.4, 0, -0.05], foreR: [-0.45, 0, 0], armL: [0.3, 0, 0.4], foreL: [-0.4, 0, 0], legL: [-0.55, 0, 0.12], shinL: [0.6, 0, 0], legR: [0.45, 0, -0.12], shinR: [0.25, 0, 0], hipsY: 0.52 });
  clips.summon = makeClip('summon', [[0, base], [0.12, raiseUp, 'out'], [0.34, raiseUp, 'lin'], [0.42, pointDown, 'out'], [0.62, pointDown, 'lin'], [0.78, base, 'io']]);
  // Supernova: arms crossed in a crouch, then flung wide as the ring bursts
  const novaIn = P({ torso: [0.4, 0, 0], head: [0.25, 0, 0], armR: [-0.9, 0, 0.6], foreR: [-1.6, 0, 0], armL: [-0.9, 0, -0.6], foreL: [-1.6, 0, 0], legL: [-0.55, 0, 0.16], shinL: [0.85, 0, 0], legR: [0.5, 0, -0.16], shinR: [0.75, 0, 0], hipsY: 0.45 });
  const novaOut = P({ torso: [-0.3, 0, 0], head: [-0.4, 0, 0], armR: [-0.7, 0, -1.75], foreR: [-0.9, 0, 0], armL: [-0.7, 0, 1.75], foreL: [-0.1, 0, 0], legL: [-0.4, 0, 0.22], shinL: [0.3, 0, 0], legR: [0.4, 0, -0.22], shinR: [0.25, 0, 0], hipsY: 0.6 });
  clips.nova = makeClip('nova', [[0, base], [0.12, novaIn, 'out'], [0.2, novaOut, 'out'], [0.54, novaOut, 'lin'], [0.72, base, 'io']]);
  // Flame Blink: wrap up small, then spring open at the destination
  const blinkIn = P({ torso: [0.5, 0, 0], head: [0.3, 0, 0], armR: [-0.7, 0, 0.5], foreR: [-1.8, 0, 0], armL: [-0.7, 0, -0.5], foreL: [-1.8, 0, 0], legL: [-0.6, 0, 0.1], shinL: [1.0, 0, 0], legR: [0.4, 0, -0.1], shinR: [0.9, 0, 0], hipsY: 0.42 });
  const blinkOut = P({ torso: [-0.1, 0, 0], head: [-0.1, 0, 0], armL: [-0.3, 0, 0.8], foreL: [-0.3, 0, 0] });
  clips.blink = makeClip('blink', [[0, base], [0.06, blinkIn, 'out'], [0.16, blinkOut, 'out'], [0.26, blinkOut], [0.4, base, 'io']]);

  // Hand seal: both hands pressed together in front of the chest
  const seal = P({ torso: [0.18, 0, 0], head: [0.15, 0, 0], armR: [-0.8, 0, 0.42], foreR: [-1.75, 0, 0], armL: [-0.8, 0, -0.42], foreL: [-1.75, 0, 0], legL: [-0.45, 0, 0.16], shinL: [0.65, 0, 0], legR: [0.4, 0, -0.16], shinR: [0.6, 0, 0], hipsY: 0.5 });
  clips.seal = makeClip('seal', [[0, base], [0.07, seal, 'out'], [0.42, pose(seal, { hipsY: 0.48 }), 'lin'], [0.58, base, 'io']]);
  // Wind Release: crouch-twist, whirl around (code spin), finish in a long low lunge
  const windCoil = P({ torso: [0.45, -0.9, 0], head: [-0.2, 0.6, 0], armR: [0.5, 0, -1.0], foreR: [-0.4, 0, 0], armL: [-0.5, 0, 0.6], foreL: [-1.2, 0, 0], legL: [-0.6, 0, 0.18], shinL: [0.9, 0, 0], legR: [0.5, 0, -0.18], shinR: [0.8, 0, 0], hipsY: 0.44 });
  const windOut = P({ torso: [0.25, 0, 0], head: [-0.1, 0, 0], armR: [-1.45, 0, -1.3], foreR: [0, 0, 0], armL: [-1.45, 0, 1.3], foreL: [0, 0, 0], legL: [-0.5, 0, 0.2], shinL: [0.7, 0, 0], legR: [0.45, 0, -0.2], shinR: [0.6, 0, 0], hipsY: 0.5 });
  const windLunge = P({ torso: [0.7, 0.3, 0], head: [-0.45, -0.2, 0], armR: [-1.35, 0, 0.35], foreR: [0, 0, 0], armL: [0.6, 0, 0.4], foreL: [-0.3, 0, 0], legL: [-1.0, 0, 0.14], shinL: [1.1, 0, 0], legR: [0.85, 0, -0.14], shinR: [0.4, 0, 0], hipsY: 0.38 });
  clips.windslash = makeClip('windslash', [[0, base], [0.08, windCoil, 'out'], [0.14, windOut, 'out'], [0.38, windOut, 'lin'], [0.46, windLunge, 'out'], [0.64, windLunge, 'lin'], [0.78, base, 'io']]);
  // Shuriken throw: wind up over the shoulder, whip the arm through
  const throwUp = P({ torso: [-0.1, -0.6, 0], head: [0, 0.5, 0], armR: [-2.5, 0, -0.6], foreR: [-1.4, 0, 0], armL: [-1.2, 0, 0.3], foreL: [-0.2, 0, 0], legL: [-0.5, 0, 0.15], shinL: [0.5, 0, 0], legR: [0.45, 0, -0.15], shinR: [0.5, 0, 0], hipsY: 0.56 });
  const throwOut = P({ torso: [0.55, 0.55, 0], head: [-0.3, -0.4, 0], armR: [-1.1, 0, 0.45], foreR: [0, 0, 0], armL: [0.5, 0, 0.35], foreL: [-0.3, 0, 0], legL: [-0.8, 0, 0.12], shinL: [0.9, 0, 0], legR: [0.7, 0, -0.12], shinR: [0.35, 0, 0], hipsY: 0.44 });
  clips.throw = makeClip('throw', [[0, base], [0.1, throwUp, 'out'], [0.17, throwOut, 'out'], [0.36, throwOut, 'lin'], [0.5, base, 'io']]);
  // Substitution backflip: quick seal, then a tucked flip backwards (rotation in code)
  const flipTuck = P({ torso: [0.85, 0, 0], head: [0.45, 0, 0], armR: [-1.0, 0, -0.3], foreR: [-1.6, 0, 0], armL: [-1.0, 0, 0.3], foreL: [-1.6, 0, 0], legL: [-1.7, 0, 0.12], shinL: [2.2, 0, 0], legR: [-1.6, 0, -0.12], shinR: [2.2, 0, 0], hipsY: 0.55 });
  clips.backflip = makeClip('backflip', [[0, base], [0.07, seal, 'out'], [0.14, flipTuck, 'out'], [0.46, flipTuck, 'lin'], [0.58, base, 'io']]);

  // Spin barrage: arms straight out to both sides; ChibiView spins the body
  const spinPose = P({ torso: [0.12, 0, 0], head: [0.12, 0, 0], armR: [-1.45, 0, -1.35], foreR: [0, 0, 0], armL: [-1.45, 0, 1.35], foreL: [0, 0, 0], legL: [-0.35, 0, 0.2], shinL: [0.45, 0, 0], legR: [0.35, 0, -0.2], shinR: [0.35, 0, 0], hipsY: 0.55 });
  if (style === 'twingun') {
    // Bloody Overdrive: arms straight out firing both ways while spinning, then
    // both guns point down at the ground for the closing golden shot
    const spread = P({ torso: [0.05, 0, 0], head: [0, 0, 0], armR: [-1.5, 0, -1.3], foreR: [0, 0, 0], armL: [-1.5, 0, 1.3], foreL: [0, 0, 0], legL: [-0.4, 0, 0.22], shinL: [0.5, 0, 0], legR: [0.4, 0, -0.22], shinR: [0.4, 0, 0], hipsY: 0.53 });
    const rip = P({ torso: [0.42, 0, 0], head: [0.1, 0, 0], armR: [-1.15, 0, 0.12], foreR: [0, 0, 0], armL: [-1.15, 0, -0.12], foreL: [0, 0, 0], legL: [-0.6, 0, 0.15], shinL: [0.7, 0, 0], legR: [0.5, 0, -0.15], shinR: [0.45, 0, 0], hipsY: 0.47 });
    clips.spin = makeClip('spin', [[0, base], [0.06, spread, 'out'], [0.62, pose(spread, { hipsY: 0.51 }), 'lin'], [0.7, rip, 'out'], [0.84, rip, 'lin'], [0.98, base, 'io']]);
  } else {
    clips.spin = makeClip('spin', [[0, base], [0.07, spinPose, 'out'], [0.66, spinPose], [0.8, base, 'io']]);
  }

  // Leap & ground slam
  const crouch = P({ torso: [0.35, 0, 0], head: [-0.15, 0, 0], legL: [-0.6, 0, 0.1], shinL: [1.1, 0, 0], legR: [0.35, 0, -0.1], shinR: [0.95, 0, 0], armR: [0.4, 0, -0.3], armL: [0.4, 0, 0.3], hipsY: 0.46 });
  const slamUp = P({ torso: [-0.35, 0, 0], head: [-0.3, 0, 0], armR: [-3.0, 0, -0.3], foreR: [-0.5, 0, 0], armL: [-3.0, 0, 0.3], foreL: [-0.5, 0, 0], legL: [-1.1, 0, 0.05], shinL: [1.6, 0, 0], legR: [-0.6, 0, -0.05], shinR: [1.3, 0, 0], hipsY: 1.3 });
  const slamDown = pose(heavyDown, { hipsY: 0.42, armR: [-0.45, 0, 0], armL: [-0.5, 0, 0] });
  clips.slam = makeClip('slam', [[0, base], [0.1, crouch, 'out'], [0.27, slamUp, 'out'], [0.36, slamDown, 'in'], [0.58, slamDown], [0.76, base, 'io']]);

  // Rapid alternating punches
  const jabR = P({ torso: [0.2, 0.45, 0], armR: [-1.62, 0, 0.12], foreR: [-0.04, 0, 0], armL: [-0.6, 0, 0.3], foreL: [-2.0, 0, 0], legL: [-0.45, 0, 0.05], shinL: [0.35, 0, 0], legR: [0.4, 0, -0.05], shinR: [0.25, 0, 0], hipsY: 0.56 });
  const jabL = mirror(jabR);
  const fl = [[0, base]];
  for (let i = 0; i < 8; i++) fl.push([0.05 + i * 0.06, i % 2 === 0 ? jabR : jabL, 'out']);
  fl.push([0.62, base, 'io']);
  clips.flurry = makeClip('flurry', fl);

  // Dodge roll: shield style uses a fluid low athletic shield-evade glide instead of a stiff 360 ball flip
  const tuck = P({ torso: [0.9, 0, 0], head: [0.5, 0, 0], armR: [-1.0, 0, -0.25], foreR: [-1.7, 0, 0], armL: [-1.0, 0, 0.25], foreL: [-1.7, 0, 0], legL: [-1.75, 0, 0.12], shinL: [2.3, 0, 0], legR: [-1.6, 0, -0.12], shinR: [2.3, 0, 0], hipsY: 0.48 });
  if (style === 'shield') {
    const evadeDip = P({ hips: [0.22, 0.36, -0.06], torso: [0.42, 0.24, 0.05], head: [-0.32, -0.46, 0], armL: [-1.12, 0, -0.12], foreL: [-0.95, 0, 0], armR: [0.62, 0, -0.68], foreR: [-0.35, 0, 0], legL: [-0.95, 0.12, 0.18], shinL: [1.18, 0, 0], legR: [0.85, -0.10, -0.16], shinR: [0.68, 0, 0], hipsY: 0.42 });
    const evadeGlide = P({ hips: [0.26, 0.42, -0.08], torso: [0.48, 0.28, 0.06], head: [-0.36, -0.52, 0], armL: [-1.25, 0, -0.18], foreL: [-0.82, 0, 0], armR: [0.78, 0, -0.74], foreR: [-0.25, 0, 0], legL: [-1.05, 0.12, 0.18], shinL: [1.10, 0, 0], legR: [0.95, -0.10, -0.16], shinR: [0.45, 0, 0], hipsY: 0.39 });
    const evadeRecover = P({ hips: [0.10, 0.20, 0.02], torso: [0.18, 0.14, 0], head: [-0.12, -0.28, 0], armL: [-0.82, 0, 0.12], foreL: [-1.08, 0, 0], armR: [0.35, 0, -0.60], foreR: [-0.32, 0, 0], legL: [-0.46, 0.10, 0.15], shinL: [0.58, 0, 0], legR: [0.42, -0.10, -0.15], shinR: [0.44, 0, 0], hipsY: 0.50 });
    clips.roll = makeClip('roll', [[0, base], [0.06, evadeDip, 'out'], [0.22, evadeGlide, 'io'], [0.34, evadeRecover, 'out'], [0.46, base, 'io']]);
  } else {
    clips.roll = makeClip('roll', [[0, base], [0.05, tuck, 'out'], [0.33, tuck], [0.46, base, 'io']]);
  }
  // Roll & shoot: forward roll that comes up on one knee, both weapons out
  const kneelOut = P(KNEEL, { torso: [0.12, 0, 0], head: [-0.05, 0, 0], armR: [-1.45, 0, 0.06], foreR: [0, 0, 0], armL: [-1.45, 0, -0.06], foreL: [0, 0, 0] });
  clips.rollshot = makeClip('rollshot', [[0, base], [0.04, tuck, 'out'], [0.28, tuck], [0.34, kneelOut, 'out'], [0.52, kneelOut, 'lin'], [0.66, base, 'io']]);
  // Dynamite toss: off hand swings back, then lobs it overhand
  const tossBack = P({ torso: [-0.12, 0.45, 0], head: [0, -0.35, 0], armL: [0.7, 0, 0.35], foreL: [-1.3, 0, 0], legL: [-0.35, 0, 0.12], shinL: [0.3, 0, 0], legR: [0.4, 0, -0.12], shinR: [0.35, 0, 0], hipsY: 0.58 });
  const tossOut = P({ torso: [0.3, -0.4, 0], head: [-0.15, 0.3, 0], armL: [-2.2, 0, 0.15], foreL: [-0.15, 0, 0], legL: [-0.6, 0, 0.12], shinL: [0.55, 0, 0], legR: [0.5, 0, -0.12], shinR: [0.25, 0, 0], hipsY: 0.53 });
  clips.toss = makeClip('toss', [[0, base], [0.06, tossBack, 'out'], [0.13, tossOut, 'out'], [0.32, tossOut, 'lin'], [0.46, base, 'io']]);
  // Lasso: fling the loop with the off hand, then brace and yank, gun hand aimed
  const lassoOut = P({ torso: [0.28, -0.45, 0], head: [-0.15, 0.35, 0], armL: [-1.75, 0, -0.15], foreL: [-0.05, 0, 0], legL: [-0.6, 0, 0.12], shinL: [0.55, 0, 0], legR: [0.5, 0, -0.12], shinR: [0.25, 0, 0], hipsY: 0.53 });
  const lassoYank = P({ torso: [-0.28, 0.3, 0], head: [-0.1, -0.2, 0], armL: [-0.35, 0, 0.4], foreL: [-1.9, 0, 0], armR: [-1.5, 0, 0.25], foreR: [0, 0, 0], legL: [-0.55, 0, 0.18], shinL: [0.2, 0, 0], legR: [0.55, 0, -0.18], shinR: [0.6, 0, 0], hipsY: 0.52 });
  clips.lasso = makeClip('lasso', [[0, base], [0.05, lassoOut, 'out'], [0.18, lassoYank, 'out'], [0.48, pose(lassoYank, { torso: [-0.3, 0.32, 0] }), 'lin'], [0.64, base, 'io']]);

  const hurt = P({ torso: [-0.5, 0, 0.12], head: [-0.45, 0, 0], armR: [-0.3, 0, -0.9], foreR: [-0.4, 0, 0], armL: [-0.3, 0, 0.9], foreL: [-0.4, 0, 0], hipsY: 0.6 });
  clips.hurt = makeClip('hurt', [[0, base], [0.05, hurt, 'out'], [0.32, pose(hurt, { torso: [-0.2, 0, 0.05], head: [-0.15, 0, 0] }), 'io']]);

  const down1 = pose(hurt, { hips: [-0.8, 0, 0], hipsY: 0.42 });
  const down2 = pose(hurt, { hips: [-1.47, 0, 0], hipsY: 0.2, armR: [-2.2, 0, -0.5], armL: [-2.2, 0, 0.5], legL: [-0.15, 0, 0.1], shinL: [0.3, 0, 0], legR: [0.1, 0, -0.1], shinR: [0.1, 0, 0] });
  clips.knockdown = makeClip('knockdown', [[0, hurt], [0.18, down1, 'in'], [0.36, down2, 'out'], [0.46, pose(down2, { hipsY: 0.24 })], [0.55, down2]]);
  clips.dead = makeClip('dead', [[0, hurt], [0.3, down2, 'in'], [0.6, down2]]);

  return clips;
}

const CLIP_CACHE = new Map();
function clipsFor(style, skinnedKnight) {
  const key = skinnedKnight ? 'skinnedKnight' : style;
  if (!CLIP_CACHE.has(key)) {
    const clips = buildClips(style, skinnedKnight);
    if (skinnedKnight) {
      const ready = pose(STANCE, READY.shield);
      Object.assign(clips, buildKnightLocomotion(makeKnightClip, ready, pose));
      const idle = knightIdle(ready, pose);
      Object.assign(clips, buildKnightAttacks(makeKnightClip, idle, pose), buildKnightSkills(makeKnightClip, idle, pose));
      for (const [name, data] of Object.entries(SKINNED_MODELS.knight?.bakedClips || {})) clips[name] = bakedClip(name, data);
      // Every action must own the wrist tracks so crossfades can reset them.
      for (const clip of Object.values(clips)) {
        if (clip.tracks.some(track => track.name === 'handR.quaternion')) continue;
        for (const joint of ['handL', 'handR']) {
          clip.tracks.push(new THREE.QuaternionKeyframeTrack(`${joint}.quaternion`, [0], [0, 0, 0, 1]));
        }
      }
    }
    CLIP_CACHE.set(key, clips);
  }
  return CLIP_CACHE.get(key);
}

const ONE_SHOT = new Set(['attack1', 'attack2', 'attack3', 'heavy', 'skill', 'spin', 'slam', 'flurry', 'roll', 'sweep', 'warcry', 'seal', 'windslash', 'throw', 'backflip', 'raise', 'summon', 'nova', 'blink', 'rollshot', 'toss', 'lasso', 'hurt', 'knockdown', 'dead', 'brakeL', 'brakeR', 'airRise', 'airCut', 'airSpike', 'slamDive', 'slamImpact', 'guardHit', 'turnL', 'turnR', 'draw', 'idleFidget']);
// Clips that must finish even if the server state moves on (movement can't cut them)
const COMMITTED = { spin: 0.78, slam: 0.74, flurry: 0.6, roll: 0.44, sweep: 0.72, warcry: 0.7, charge: 0.6, seal: 0.5, windslash: 0.74, throw: 0.42, backflip: 0.55, raise: 0.7, summon: 0.76, nova: 0.7, blink: 0.38, rollshot: 0.56, toss: 0.38, lasso: 0.5 };
// Sword-and-shield attacks hold their strike pose; moving can't cut the hold short
const STYLE_COMMIT = {
  shield: { attack1: 0.4, attack2: 0.36, attack3: 0.55, heavy: 0.6 },
  shinobi: { attack1: 0.15, attack2: 0.15, attack3: 0.42, heavy: 0.42 },
  pyro: { attack1: 0.28, attack2: 0.28, attack3: 0.5, heavy: 0.66 },
  twingun: { attack1: 0.16, attack2: 0.16, attack3: 0.4, heavy: 0.44, spin: 0.9 }
};
const KNIGHT_COMMIT = { ...Object.fromEntries(Object.entries(KNIGHT_STRIKES).map(([name, strike]) => [name, strike.commit])), roll: 0.32 };
// Twin-gun shots timed on the clip: [clip time, 'R' | 'L' | 'B' (both), power (1 big, 2 ground blast)]
const SHOTS = {
  'twingun:attack1': [[0.05, 'R']],
  'twingun:attack2': [[0.05, 'L']],
  'twingun:attack3': [[0.08, 'R'], [0.13, 'L'], [0.18, 'R'], [0.23, 'L']],
  'twingun:heavy': [[0.066, 'B', 1]],
  'twingun:rollshot': [[0.35, 'R'], [0.4, 'L']],
  'twingun:spin': [...Array.from({ length: 12 }, (_, i) => [0.08 + i * 0.045, i % 2 ? 'L' : 'R']), [0.71, 'B', 2]]
};
// Pyromancer wrist: how far the upright staff tips toward the target (radians), by clip
function staffTilt(name, t) {
  if (name === 'attack2') return t > 0.08 && t < 0.4 ? 0.8 : 0.1;
  if (name === 'attack3') return t > 0.12 && t < 0.55 ? 0.6 : 0.1;
  if (name === 'summon') return t > 0.38 && t < 0.7 ? 1.0 : 0;
  if (name === 'run') return 0.25;
  return 0.06;
}
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _vz = new THREE.Vector3(0, 0, 1);
const _vd = new THREE.Vector3();
const _vp = new THREE.Vector3();
const _inverseBody = new THREE.Matrix4();
const _shoeToBody = new THREE.Matrix4();
// Heel and toe on the rest sole, in the Knight GLB's model units relative to the ankle.
const KNIGHT_SOLE_Z = [-0.071, 0.195];
// Whole-body spins done in code: [start, duration, turns], keyed by clip or style:clip
const SPIN = { spin: [0.05, 0.6, 2], windslash: [0.12, 0.28, 1.5], 'shinobi:attack3': [0.08, 0.2, 1], 'twingun:spin': [0.06, 0.56, 2] };
// Somersaults about the body's centre: [start, duration, direction (+1 forward / -1 back), hop height]
const FLIP = { roll: [0.03, 0.33, 1, 0], 'shield:roll': null, backflip: [0.12, 0.36, -1, 0.55], rollshot: [0.02, 0.28, 1, 0] };
const _vy = new THREE.Vector3(0, 1, 0);
const LAYER_JOINTS = ['hips', 'torso', 'head', 'armR', 'foreR', 'armL', 'foreL', 'handL', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];
const KNIGHT_BRAKE_CLIPS = new Set(['brakeL', 'brakeR']);
const LOCOMOTION = new Set(['idle', 'walk', 'run', 'jump', 'fall', 'dash', 'guard', 'roll', ...KNIGHT_BRAKE_CLIPS]);
// Standing clips whose boots are levelled and set on the floor.
const KNIGHT_STANDING = new Set(['idle', 'guard', 'guardHit', 'turnL', 'turnR', 'draw', 'idleFidget']);
const KNIGHT_FLOOR_CLIPS = new Set(['walk', 'run', 'dash', 'roll', ...KNIGHT_STANDING, ...Object.keys(KNIGHT_STRIKES), ...KNIGHT_BRAKE_CLIPS]);
const IDLE_FAMILY = new Set(['idle', 'idleFidget', 'turnL', 'turnR', 'draw']);
const FIDGET_AFTER = 6;
const easeInOut = (x) => x * x * (3 - 2 * x);

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------------------------------------------------------------------------
// SWORD RIBBON TRAIL (Tree of Savior M Double Slash / Crosscut golden blade arc)
// ---------------------------------------------------------------------------
const SWORD_TRAIL_WINDOWS = Object.fromEntries(Object.entries(KNIGHT_STRIKES)
  .filter(([, strike]) => strike.trail).map(([name, strike]) => [name, strike.trail]));

function basicAttackClip(step, hits) {
  return step >= hits ? 'attack3' : (step % 2 === 1 ? 'attack1' : 'attack2');
}

class SwordTrail {
  constructor(mountNode, spec) {
    this.mount = mountNode;
    this.localBase = new THREE.Vector3(...spec.base);
    // The ribbon reaches past the steel so the crescent reads wider than the blade.
    const tip = new THREE.Vector3(...spec.tip);
    const along = tip.clone().sub(this.localBase);
    this.localBase.addScaledVector(along, -0.12);
    this.localTip = tip.clone().addScaledVector(along, 0.34);
    this.maxSamples = 40;
    this.life = 0.3;
    this.samples = [];
    this.prevBase = new THREE.Vector3();
    this.prevTip = new THREE.Vector3();
    this.hasPrev = false;

    // Three vertices per sample: the blade root (clear), a saturated body and a white edge.
    const rows = 3;
    const verts = new Float32Array(this.maxSamples * rows * 3);
    const colors = new Float32Array(this.maxSamples * rows * 4);
    const indices = [];
    for (let i = 0; i < this.maxSamples - 1; i++) {
      const a = i * rows, b = a + rows;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
      indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(verts, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(indices);
    this.geo.setDrawRange(0, 0);

    // Normal blending with per-vertex RGBA alpha: the saturated body keeps the arc readable
    // on bright floors, and it still works on transparent My Item preview canvases.
    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 19;
    this._b = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._mb = new THREE.Vector3();
    this._mt = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  pushSample(b, t, age = 0) {
    this.samples.push({ b: b.clone(), t: t.clone(), age });
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  update(dt, active, spaceParent) {
    if (!spaceParent) return;
    if (this.mesh.parent !== spaceParent) spaceParent.add(this.mesh);
    for (let i = this.samples.length - 1; i >= 0; i--) {
      this.samples[i].age += dt;
      if (this.samples[i].age >= this.life) this.samples.splice(i, 1);
    }
    if (active) {
      this.mount.updateWorldMatrix(true, false);
      this._b.copy(this.localBase).applyMatrix4(this.mount.matrixWorld);
      this._t.copy(this.localTip).applyMatrix4(this.mount.matrixWorld);
      spaceParent.worldToLocal(this._b);
      spaceParent.worldToLocal(this._t);

      // Subdivide fast swings along a curved blade arc so the ribbon stays silky smooth even on stepped frames
      if (this.hasPrev) {
        const dist = this._t.distanceTo(this.prevTip);
        if (dist > 0.12) {
          const steps = Math.min(6, Math.ceil(dist / 0.18));
          const len = this._t.distanceTo(this._b);
          for (let k = 1; k < steps; k++) {
            const u = k / steps;
            this._mb.lerpVectors(this.prevBase, this._b, u);
            this._mt.lerpVectors(this.prevTip, this._t, u);
            this._dir.subVectors(this._mt, this._mb);
            if (this._dir.lengthSq() > 1e-5) {
              this._dir.normalize().multiplyScalar(len);
              this._mt.copy(this._mb).add(this._dir);
            }
            this.pushSample(this._mb, this._mt, dt * (1 - u));
          }
        }
      }
      this.pushSample(this._b, this._t, 0);
      this.prevBase.copy(this._b);
      this.prevTip.copy(this._t);
      this.hasPrev = true;
    } else {
      this.hasPrev = false;
    }

    const n = this.samples.length;
    if (n < 2) {
      this.mesh.visible = false;
      this.geo.setDrawRange(0, 0);
      return;
    }
    this.mesh.visible = true;
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    for (let i = 0; i < n; i++) {
      const s = this.samples[i];
      const u = i / (n - 1);
      const fade = Math.pow(Math.max(0, 1 - s.age / this.life), 1.4) * Math.pow(u, 1.2);
      const vi = i * 9;
      const ci = i * 12;
      pos[vi] = s.b.x; pos[vi + 1] = s.b.y; pos[vi + 2] = s.b.z;
      pos[vi + 3] = s.b.x + (s.t.x - s.b.x) * 0.5;
      pos[vi + 4] = s.b.y + (s.t.y - s.b.y) * 0.5;
      pos[vi + 5] = s.b.z + (s.t.z - s.b.z) * 0.5;
      pos[vi + 6] = s.t.x; pos[vi + 7] = s.t.y; pos[vi + 8] = s.t.z;
      // Clear root, azure body, white-hot edge.
      col[ci] = 0.22; col[ci + 1] = 0.5; col[ci + 2] = 0.98; col[ci + 3] = 0;
      col[ci + 4] = 0.2; col[ci + 5] = 0.55; col[ci + 6] = 1.0; col[ci + 7] = 0.82 * fade;
      col[ci + 8] = 0.94; col[ci + 9] = 0.99; col[ci + 10] = 1.0; col[ci + 11] = 1.0 * fade;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * 12);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// CHIBI VIEW: one per player
// ---------------------------------------------------------------------------
export class ChibiView {
  constructor(pl) {
    this.heroId = pl.heroId;
    this.gearKey = ChibiView.gearKey(pl);
    this.b = new Builder();
    const gear = pl.gear || {};
    const skinned = SKINNED_MODELS[pl.heroId];
    // Keep skinned model even when all gear/armor is knocked off (never revert to procedural chibi!)
    const useSkinned = !!(skinned && (!gear.armor || gear.armor === pl.heroId));
    this.skinnedKnight = useSkinned && pl.heroId === 'knight';
    this.R = useSkinned
      ? buildSkinnedRig(this.b, pl.heroId, gear, skinned)
      : buildRig(this.b, pl.heroId, gear);
    this.b.bake(this.R.root);
    this.stepFps = useSkinned ? (FORCE_STEP || skinned.spec.stepFps || 0) : 0;
    this.stepAcc = 0;
    this.stepForce = true;
    this.swordTrail = this.R.swordMount && this.R.swordTrailSpec
      ? new SwordTrail(this.R.swordMount, this.R.swordTrailSpec)
      : null;
    this.root = this.R.root;
    this.footwork = this.skinnedKnight ? new KnightFootwork(this.R) : null;
    // The skinned cape's bone chain follows a small cloth strand.
    const capeTip = useSkinned ? skinned.spec.capeTip : null;
    this.cloth = capeTip && this.R.extras.capes.length === 3 && gear.trinket === pl.heroId
      ? new CapeCloth(this.R.extras.capes, capeTip, ['L', 'R'].flatMap(side => [
        [this.R['shin' + side], new THREE.Vector3(0, 0, 0)],
        [this.R['shin' + side], new THREE.Vector3(0, -0.14, 0)],
        [this.R['foot' + side], new THREE.Vector3(0, 0, 0)],
        [this.R['foot' + side], new THREE.Vector3(0, -0.09, -0.06)]
      ]))
      : null;
    this.R.staff = this.root.getObjectByName('staff') || null;
    this.style = (HERO_LOOK[pl.heroId] || HERO_LOOK.knight).style;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [name, clip] of Object.entries(clipsFor(this.style, this.skinnedKnight))) {
      const a = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(name) || (this.skinnedKnight && (name === 'jump' || name === 'fall' || name === 'charge'))) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[name] = a;
    }
    this.current = null;
    this.currentName = '';
    this.triggerKey = '';
    this.yaw = Math.PI / 2 - (pl.facing || 0);
    this.root.rotation.y = this.yaw;
    this.wasGrounded = true;
    this.incomingVy = 0;
    this.landingStrength = 0;
    this.landingAge = 0;
    this.landingLoad = 0;
    this.bladeAccent = null;
    this.squash = 0;
    this.stretch = 0;
    this.flashT = 0;
    this.hitStopUntil = 0;
    this.capeAng = 0.15;
    this.capeVel = 0;
    this.lastRunPhase = 0;
    this.airStrikes = 0;
    this.blockUntil = 0;
    this.blocks = 0;
    this.drawUntil = 0;
    this.spawns = 0;
    this.turns = 0;
    this.turnError = 0;
    this.reactionHoldUntil = 0;
    this.turnSince = null;
    this.stanceYaw = null;
    this.targetYaw = 0;
    this.fidgets = 0;
    this.time = Math.random() * 10;
    // The fidget waits for standing time measured on this clock.
    this.idleSince = this.time;
    this.opacityKey = 1;
    this.dashCount = 0;
    this.wasDashing = false;
    this.rollCount = 0;
    this.wasRolling = false;
    this.clipStart = 0;
    this.commitUntil = 0;
    this.kickR = 0;
    this.kickL = 0;
    this.hitLean = 0;
    this.tumble = 0;
    this.purePose = LAYER_JOINTS.map(() => new THREE.Quaternion());
    this.pureSaved = false;
    this.play('idle', 0);
  }

  static gearKey(pl) {
    const g = pl.gear || {};
    return `${pl.heroId}|${g.weapon}|${g.armor}|${g.helmet}|${g.trinket}`;
  }

  play(name, fade = 0.15, restart = false) {
    const next = this.actions[name];
    if (!next) return;
    if (this.current === next) {
      if (restart) {
        next.reset();
        next.play();
        this.clipStart = this.time;
        this.stepForce = true;
      }
      return;
    }
    // A swing handing over to standing still or to the next swing holds its last pose while
    // it fades out. Its sword arm can be nearly half a turn from the next pose, and a blend
    // between two poses that far apart takes the other way round the moment the moving
    // swing crosses that line, which snapped the arm back in a single frame.
    if (this.skinnedKnight && this.current && KNIGHT_SWINGS.has(this.currentName) && (name === 'idle' || KNIGHT_SWINGS.has(name)) && fade > 0) {
      this.current.setEffectiveTimeScale(0);
    }
    const previousGait = this.skinnedKnight && (this.currentName === 'walk' || this.currentName === 'run');
    const nextGait = this.skinnedKnight && (name === 'walk' || name === 'run');
    if (nextGait && !previousGait) this.gaitStart = this.time;
    const gaitPhase = previousGait && nextGait
      ? this.current.time / this.current.getClip().duration : 0;
    next.reset();
    next.time = next.getClip().duration * gaitPhase;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (this.current && fade > 0) next.fadeIn(fade);
    for (const a of Object.values(this.actions)) {
      if (a === next || !a.isScheduled()) continue;
      const w = a.getEffectiveWeight();
      if (fade > 0 && w > 0.001) a._scheduleFading(fade, w, 0);
      else a.stop();
    }
    this.current = next;
    this.currentName = name;
    this.clipStart = this.time;
    this.stepForce = true;
    const commit = (this.skinnedKnight ? KNIGHT_COMMIT[name] : undefined) ?? STYLE_COMMIT[this.style]?.[name] ?? COMMITTED[name];
    this.commitUntil = commit ? this.time + commit : 0;
  }

  // The mixer only rewrites a joint when its keyed value changes, so layers would
  // pile up during holds: put the clean pose back before mixing, keep a copy after
  restorePure() {
    if (!this.pureSaved) return;
    for (let i = 0; i < LAYER_JOINTS.length; i++) this.R[LAYER_JOINTS[i]].quaternion.copy(this.purePose[i]);
    if (this.pureHipsY !== undefined) this.R.hips.position.y = this.pureHipsY;
  }

  savePure() {
    for (let i = 0; i < LAYER_JOINTS.length; i++) this.purePose[i].copy(this.R[LAYER_JOINTS[i]].quaternion);
    this.pureHipsY = this.R.hips.position.y;
    this.pureSaved = true;
  }

  // Per-shot recoil layered on top of whatever clip is playing
  kick(left) {
    if (left) this.kickL = 1;
    else this.kickR = 1;
  }

  // World position of a gun's barrel tip and the direction it points
  muzzle(left, pos, dir) {
    (left ? this.R.foreL : this.R.foreR).getWorldQuaternion(_qa);
    dir.set(0, -0.989, 0.149).applyQuaternion(_qa);
    (left ? this.R.handL : this.R.handR).getWorldPosition(pos).addScaledVector(dir, 0.4);
  }

  // Fire one or both guns: recoil kick plus a flash/tracer from the real barrel
  fire(hand, power, fx, groundY) {
    this.root.updateMatrixWorld(true);
    for (const left of hand === 'B' ? [false, true] : [hand === 'L']) {
      this.kick(left);
      this.muzzle(left, _vp, _vd);
      fx.gunShot(_vp.x, _vp.y, _vp.z, _vd.x, _vd.y, _vd.z, power, groundY);
    }
  }

  pickClip(pl, speed) {
    const st = pl.state;
    const hero = window.GAME_DATA?.HEROES?.[pl.heroId];
    if (st === 'dead') {
      this.wasDead = true;
      return { name: 'dead', key: 'dead', fade: 0.08 };
    }
    if (this.wasDead) {
      this.wasDead = false;
      if (this.actions.draw) {
        this.spawns++;
        this.drawUntil = this.time + this.actions.draw.getClip().duration;
      }
    }
    // A blow that has not landed on screen yet (see holdReaction) does not flinch the victim early.
    const braced = this.time < this.reactionHoldUntil;
    if (st === 'knockdown' && !braced) return { name: 'knockdown', key: 'kd', fade: 0.06 };
    if (st === 'hurt' && !braced) return { name: 'hurt', key: 'hurt', fade: 0.04 };
    if (st !== 'attack' && st !== 'heavy') {
      this.strikeKey = null;
      if (pl.grounded) this.airStrikes = 0;
    }
    if (this.skinnedKnight && pl.airSlam) {
      const phase = pl.airSlam.phase;
      const name = phase === 'aim' ? 'slamAim' : phase === 'impact' ? (pl.grounded ? 'slamImpact' : 'airSpike') : 'slamDive';
      return { name, key: 'slam-' + phase, fade: phase === 'impact' ? 0.03 : 0.08 };
    }
    if (st === 'attack') {
      const step = pl.comboStep || 1;
      const hits = hero?.basicAttack?.comboHits || 3;
      const key = `atk${step}`;
      const ground = basicAttackClip(step, hits);
      // Each chop of the combo ends with the body turned about 100 degrees and the next one
      // starts square on; a little longer fade between swings takes the edge off that turn.
      const handover = this.skinnedKnight && KNIGHT_SWINGS.has(this.currentName) ? 0.08 : 0.05;
      return { name: this.skinnedKnight ? this.strikeClip(key, pl, ground) : ground, key, fade: handover };
    }
    if (st === 'heavy') return { name: this.skinnedKnight ? this.strikeClip('heavy', pl, 'heavy') : 'heavy', key: 'heavy', fade: 0.06 };
    if (st === 'skill') return { name: SKILL_ANIM[pl.animSkillId] || 'skill', key: `skill${pl.animSkillId || ''}`, fade: 0.05 };
    if (this.skinnedKnight && pl.isRolling) return { name: 'roll', key: `roll${this.rollCount}`, fade: 0.04 };
    if (pl.guarding || st === 'guard') {
      if (this.actions.guardHit && this.time < this.blockUntil) return { name: 'guardHit', key: `block${this.blocks}`, fade: 0.04 };
      return { name: 'guard', key: 'guard', fade: 0.1 };
    }
    if (pl.isFlying) return { name: 'fly', key: 'fly', fade: 0.2 };
    if (pl.isRolling) return { name: 'roll', key: `roll${this.rollCount}`, fade: 0.04 };
    if (pl.isDashing) {
      if (pl.grounded && (this.style === 'gun' || this.style === 'twingun' || this.style === 'dual')) return { name: 'roll', key: `roll${this.dashCount}`, fade: 0.04 };
      return { name: 'dash', key: 'dash', fade: 0.08 };
    }
    if (!pl.grounded) return (pl.vy || 0) > 0
      ? { name: 'jump', key: this.skinnedKnight ? `jump${pl.jumpCount || 0}` : 'jump', fade: this.skinnedKnight ? 0.075 : 0.12 }
      : { name: 'fall', key: 'fall', fade: this.skinnedKnight ? 0.095 : 0.2 };
    if (speed > 0.8) {
      if (this.skinnedKnight && !pl.isSprinting) return { name: 'walk', key: 'walk', fade: 0.13 };
      return { name: 'run', key: 'run', fade: 0.14 };
    }
    if (this.skinnedKnight) {
      const playing = this.currentName;
      if (KNIGHT_BRAKE_CLIPS.has(playing) && this.current.time < this.current.getClip().duration) {
        return { name: playing, key: playing, fade: 0.060 };
      }
      if ((playing === 'walk' || playing === 'run') && this.time - this.gaitStart >= 0.08) {
        const phase = this.current.time / this.current.getClip().duration;
        const name = phase < 0.5 ? 'brakeL' : 'brakeR';
        return { name, key: name, fade: 0.060 };
      }
    }
    if (this.skinnedKnight) {
      const extra = this.idleExtra();
      if (extra) return extra;
    }
    return { name: 'idle', key: 'idle', fade: 0.2 };
  }

  // Standing still: draw the sword after a respawn, step round on a turn in
  // place, and every so often play the long fidget. Each runs to its end.
  idleExtra() {
    const playing = this.currentName;
    const running = this.current && this.current.time < this.current.getClip().duration - 0.02;
    if (this.actions.draw && this.time < this.drawUntil) return { name: 'draw', key: `draw${this.spawns}`, fade: 0.1 };
    if ((playing === 'turnL' || playing === 'turnR' || playing === 'idleFidget') && running) {
      return { name: playing, key: playing + (playing === 'idleFidget' ? this.fidgets : this.turns), fade: 0.1 };
    }
    // A turn clip only starts once the player has stayed put: pressing a direction
    // key turns the Knight a frame or two before the run starts, and that must not
    // flash the turn pose.
    if (this.actions.turnL && Math.abs(this.turnError) > 0.6) {
      this.turnSince ??= this.time;
      if (this.time - this.turnSince >= 0.15) {
        this.turns++;
        this.stanceYaw = this.targetYaw;
        const name = this.turnError > 0 ? 'turnL' : 'turnR';
        return { name, key: name + this.turns, fade: 0.1 };
      }
    }
    if (this.actions.idleFidget && this.time - this.idleSince > FIDGET_AFTER) {
      this.fidgets++;
      this.idleSince = this.time + this.actions.idleFidget.getClip().duration;
      return { name: 'idleFidget', key: `idleFidget${this.fidgets}`, fade: 0.3 };
    }
    return null;
  }

  // A guarded hit landed: the shield arm takes the blow.
  onBlock() {
    if (!this.actions.guardHit) return;
    this.blocks++;
    this.blockUntil = this.time + this.actions.guardHit.getClip().duration * 0.9;
  }

  onHit(strong) {
    this.flashT = 1;
    this.hitLean = strong ? 1 : 0.7;
    this.stepForce = true;
    this.hitStopUntil = performance.now() + (strong ? 110 : 75);
    if (this.currentName === 'hurt') this.play('hurt', 0, true);
  }

  hitStop(ms) {
    this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms);
  }

  // A strike keeps the clip it started with, so one begun in the air stays an
  // air strike through the landing. The server counts the three hits of a jump
  // (launch, cut, spike); the local count stands in when a snapshot has none.
  strikeClip(key, pl, ground) {
    if (this.strikeKey !== key) {
      this.strikeKey = key;
      this.strikeAir = !pl.grounded;
      if (this.strikeAir && ground !== 'heavy') this.airStrikes++;
    }
    if (!this.strikeAir || ground === 'heavy') return ground;
    const hit = pl.airStrikes || this.airStrikes;
    return hit >= 3 ? 'airSpike' : hit === 2 ? 'airCut' : 'airRise';
  }

  // `release` gets any hits held for this swing when it never reaches its contact frame.
  queueBladeAccent(event, emit, release) {
    if (!this.skinnedKnight || !this.swordTrail) return false;
    // A swing that never reached contact must not swallow the hits it was holding.
    if (this.bladeAccent) this.bladeAccent.release?.(this.bladeAccent.held);
    this.bladeAccent = { event, emit, release, queued: this.time, expires: this.time + 0.42, held: [] };
    return true;
  }

  // The server flips a victim to `hurt` when the swing starts. While the blade is
  // still on its way, keep the victim's pose; the hit's own release ends the wait,
  // and it never lasts longer than `seconds`.
  holdReaction(seconds) {
    this.reactionHoldUntil = seconds > 0 ? this.time + seconds : 0;
  }

  // The server resolves a hit the moment a swing starts. Showing it on the blade's
  // contact frame keeps the flash, number and flinch in step with the steel.
  holdForContact(fx) {
    if (!this.bladeAccent) return false;
    this.bladeAccent.held.push(fx);
    return true;
  }

  // Emit on the blade contact of the swing that started with the server event,
  // on the ground or in the air. A swing already under way belongs to an
  // earlier press.
  updateBladeAccent(pl) {
    const pending = this.bladeAccent;
    if (!pending) return;
    // A swing cut short (hit mid-swing, parried, a skill or heavy pressed over it, dead)
    // never reaches contact: hand its held hits back now, not when the swing expires.
    if (pl && CUTS_A_SWING.has(pl.state)) {
      this.bladeAccent = null;
      pending.release?.(pending.held);
      return;
    }
    const contact = KNIGHT_SWINGS.has(this.currentName) ? KNIGHT_BLADE_CONTACT[this.currentName] : undefined;
    if (this.time >= pending.expires) {
      this.bladeAccent = null;
      pending.release?.(pending.held);
    } else if (contact !== undefined && this.clipStart >= pending.queued - 0.1 && this.current.time >= contact) {
      this.bladeAccent = null;
      pending.emit(pending.event, pending.held);
    }
  }

  updateLanding(pl, dt) {
    if (!pl.grounded) {
      this.incomingVy = Math.min(0, pl.vy || 0);
      this.landingStrength = 0;
    } else if (!this.wasGrounded) {
      this.landingAge = 0;
      this.landingStrength = THREE.MathUtils.smoothstep(-this.incomingVy, 1, 12);
    }
    this.landingAge += dt;
    const inWeight = THREE.MathUtils.smoothstep(this.landingAge, 0, 0.045);
    const recovery = 1 - THREE.MathUtils.smoothstep(this.landingAge, 0.045, 0.16 + 0.11 * this.landingStrength);
    this.landingLoad = this.landingStrength * inWeight * recovery;
  }

  setOpacity(alpha) {
    if (Math.abs(alpha - this.opacityKey) < 0.01) return;
    this.opacityKey = alpha;
    for (const m of this.b.materials) {
      if (m.userData.baseOpacity === undefined) {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
      }
      m.opacity = m.userData.baseOpacity * alpha;
      m.transparent = m.userData.baseTransparent || alpha < 1;
      m.needsUpdate = true;
    }
  }

  // Procedural layers applied after the mixer has written this frame's pose
  applyLayers(pl, dt, paused) {
    const R = this.R;
    const t = this.time - this.clipStart;
    // Whole-body spins (spin barrage, wind slash, spinning finisher)
    const sp = SPIN[`${this.style}:${this.currentName}`] || SPIN[this.currentName];
    if (sp) {
      const k = Math.min(1, Math.max(0, (t - sp[0]) / sp[1]));
      R.hips.rotateY(easeInOut(k) * Math.PI * 2 * sp[2]);
    }
    // Rolls / flips: rotate the curled body about its centre, not the feet
    R.body.rotation.x = 0;
    R.body.position.set(0, 0, 0);
    const flipKey = `${this.style}:${this.currentName}`;
    const fl = flipKey in FLIP ? FLIP[flipKey] : FLIP[this.currentName];
    if (fl) {
      const k = Math.min(1, Math.max(0, (t - fl[0]) / fl[1]));
      const a = easeInOut(k) * Math.PI * 2 * fl[2];
      const h = 0.55;
      R.body.rotation.x = a;
      R.body.position.set(0, h - h * Math.cos(a) + Math.sin(k * Math.PI) * fl[3], -h * Math.sin(a));
    }
    // Knocked into the air: tumble head over heels until landing
    if (pl.state === 'knockdown' && !pl.grounded) this.tumble += dt * 11;
    else this.tumble += (Math.round(this.tumble / (Math.PI * 2)) * Math.PI * 2 - this.tumble) * Math.min(1, dt * 14);
    if (Math.abs(this.tumble % (Math.PI * 2)) > 0.001) R.hips.rotateX(-this.tumble);
    // Gun recoil and hit flinch
    this.kickR = Math.max(0, this.kickR - dt * 9);
    this.kickL = Math.max(0, this.kickL - dt * 9);
    this.hitLean = Math.max(0, this.hitLean - dt * 6);
    const kr = Math.sin(this.kickR * Math.PI * 0.5);
    const kl = Math.sin(this.kickL * Math.PI * 0.5);
    const ks = this.style === 'twingun' ? 0.55 : 1;
    if (kr) { R.armR.rotateX(-0.45 * kr * ks); R.foreR.rotateX(-0.35 * kr * ks); }
    if (kl) { R.armL.rotateX(-0.45 * kl * ks); R.foreL.rotateX(-0.35 * kl * ks); }
    const lean = 0.12 * Math.max(kr, kl) + 0.45 * Math.sin(this.hitLean * Math.PI * 0.5);
    if (lean) { R.torso.rotateX(-lean); R.head.rotateX(-lean * 0.6); }
    const planted = this.skinnedKnight ? KNIGHT_STANDING.has(this.currentName) : this.currentName === 'idle' || this.currentName === 'guard';
    this.strikeFeetDown = false;
    if (this.skinnedKnight && pl.grounded && KNIGHT_FLOOR_CLIPS.has(this.currentName)) {
      const load = this.landingLoad;
      if (load > 0 && (planted || this.currentName === 'walk' || this.currentName === 'run')) {
        R.hips.position.y -= 0.082 * load;
        R.legL.rotateX(-0.55 * load);
        R.legR.rotateX(-0.55 * load);
        R.shinL.rotateX(0.92 * load);
        R.shinR.rotateX(0.92 * load);
        R.torso.rotateX(0.43 * load);
        R.head.rotateX(-0.22 * load);
        R.armL.rotateX(-0.24 * load);
        R.armR.rotateX(0.22 * load);
      }
      // Level a standing boot but keep the authored heel strike and toe-off in motion.
      if (planted) {
        for (const [leg, shin, foot] of [[R.legL, R.shinL, R.footL], [R.legR, R.shinR, R.footR]]) {
          _qa.copy(R.hips.quaternion).multiply(leg.quaternion).multiply(shin.quaternion);
          _e.setFromQuaternion(_qa, 'YXZ');
          _qb.setFromAxisAngle(_vy, _e.y);
          foot.quaternion.slerp(_qa.invert().multiply(_qb), this.current.getEffectiveWeight());
        }
      }
      R.footL.updateWorldMatrix(true, false);
      R.footR.updateWorldMatrix(true, false);
      _inverseBody.copy(R.body.matrixWorld).invert();
      const s = R.rigScale;
      let soleY = Infinity;
      for (const foot of [R.footL, R.footR]) {
        _shoeToBody.multiplyMatrices(_inverseBody, foot.matrixWorld);
        for (const z of KNIGHT_SOLE_Z) {
          _vp.set(0, -R.restFootY / s, z / s).applyMatrix4(_shoeToBody);
          soleY = Math.min(soleY, _vp.y);
        }
      }
      // Pull the lowest sole down in a standing pose, a planted strike and while a
      // stride is supported. The flight half of a stride and a leaping strike leave the ground.
      const air = KNIGHT_AIRBORNE[this.currentName];
      const strike = KNIGHT_STRIKES[this.currentName];
      this.strikeFeetDown = !!strike && !strike.air && !(air && this.current.time > air[0] && this.current.time < air[1]);
      let settle = planted || this.strikeFeetDown || KNIGHT_BRAKE_CLIPS.has(this.currentName) ? Infinity : 0;
      if (this.currentName === 'walk' || this.currentName === 'run') {
        const half = (this.current.time / this.current.getClip().duration * 2) % 1;
        settle = 0.06 * (1 - THREE.MathUtils.smoothstep(half, 0.48, 0.62));
      }
      R.hips.position.y += Math.max(-settle, -soleY) / s;
    }
    // Pyromancer wrist: hold the staff upright (tipping it toward the target on thrusts)
    if (this.style === 'pyro' && R.staff) {
      this.root.updateMatrixWorld(true);
      const tilt = staffTilt(this.currentName, t);
      const yaw = this.root.rotation.y;
      _vd.set(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt));
      _qb.setFromUnitVectors(_vz, _vd);
      R.handR.getWorldQuaternion(_qa).invert().multiply(_qb);
      R.staff.quaternion.slerp(_qa, Math.min(1, dt * 18 + (paused ? 0 : 0.02)));
    }
  }

  // env: { dt, now, fx (FxSystem), floorY }
  update(pl, env) {
    const { dt } = env;
    const now = performance.now();
    this.time += dt;
    const speed = Math.hypot(pl.vx || 0, pl.vz || 0);

    // Position & smooth turning
    this.root.position.set(pl.x, pl.y, pl.z);
    // Actions turn briskly into aim; locomotion turns fluidly without jarring snaps
    const acting = pl.state === 'attack' || pl.state === 'heavy' || pl.state === 'skill';
    const previousYaw = this.yaw;
    // How far the aim has swung from the way the feet last stood; the visible yaw
    // catches up within a few frames, so the turn clip needs its own measure.
    this.targetYaw = Math.PI / 2 - (pl.facing || 0);
    if (this.stanceYaw === null) this.stanceYaw = this.targetYaw;
    this.turnError = lerpAngle(0, this.targetYaw - this.stanceYaw, 1);
    this.yaw = lerpAngle(this.yaw, Math.PI / 2 - (pl.facing || 0), 1 - Math.exp(-dt * (acting ? 28 : 14)));
    this.root.rotation.y = this.yaw;
    this.footwork?.track(this.root.position, this.yaw, this.yaw - previousYaw, dt, speed);

    // Animation state machine
    if (pl.isDashing && !this.wasDashing) this.dashCount++;
    this.wasDashing = !!pl.isDashing;
    if (pl.isRolling && !this.wasRolling) this.rollCount++;
    this.wasRolling = !!pl.isRolling;
    const locomotionSpeed = this.footwork?.locomotionSpeed(speed, this.currentName) ?? speed;
    const want = this.pickClip(pl, locomotionSpeed);
    if (!IDLE_FAMILY.has(want.name)) this.idleSince = this.time;
    if (want.name !== 'idle') this.stanceYaw = this.targetYaw;
    if (want.name !== 'idle' || Math.abs(this.turnError) <= 0.6) this.turnSince = null;
    const trigger = `${want.name}|${want.key}`;
    const committed = this.time < this.commitUntil && LOCOMOTION.has(want.name) && want.name !== this.currentName;
    if (trigger !== this.triggerKey && !committed) {
      const restart = ONE_SHOT.has(want.name) || (this.skinnedKnight && want.name === 'jump');
      this.play(want.name, want.fade, restart);
      this.triggerKey = trigger;
    }
    if (this.currentName === 'run' || this.currentName === 'walk') {
      const hero = window.GAME_DATA?.HEROES?.[pl.heroId];
      const rate = this.footwork ? this.footwork.rate(this.currentName, speed)
        : Math.max(0.65, Math.min(1.9, speed / (hero?.speed || 5.4)));
      this.current.setEffectiveTimeScale(rate);
    }

    // Hit-stop / frozen freeze the pose; ToS stepped animation quantizes skeleton
    // updates to stepFps (e.g. 15 FPS) while snapping instantly on new actions.
    const frozen = pl.buffs?.frozen || pl.state === 'frozen';
    const paused = now < this.hitStopUntil || frozen;
    const clipTime = this.skinnedKnight ? this.current.time : this.time - this.clipStart;
    const trailWin = SWORD_TRAIL_WINDOWS[this.currentName];
    const inSlash = !!(trailWin && clipTime >= trailWin[0] && clipTime <= trailWin[1]);
    // Step at 15 FPS for ToS 2D punch on idle/locomotion/holds; run smooth during active blade swings for crisp arc trails
    const effStepFps = inSlash ? 0 : this.stepFps;
    const stepDt = effStepFps > 0 ? 1 / effStepFps : 0;
    let poseDt = dt;
    let doPose = true;
    if (stepDt > 0) {
      this.stepAcc += dt;
      if (this.stepForce || this.stepAcc >= stepDt) {
        poseDt = this.stepForce ? Math.min(this.stepAcc, stepDt) : Math.floor(this.stepAcc / stepDt) * stepDt;
        this.stepAcc = this.stepForce ? 0 : this.stepAcc - poseDt;
        this.stepForce = false;
      } else {
        doPose = false;
      }
    } else if (this.stepAcc > 0) {
      poseDt = dt + this.stepAcc;
      this.stepAcc = 0;
      this.stepForce = false;
    }
    if (this.skinnedKnight) this.updateLanding(pl, paused ? 0 : dt);
    if (doPose) {
      this.restorePure();
      this.mixer.update(paused ? 0 : poseDt);
      this.savePure();
      this.applyLayers(pl, poseDt, paused);
      if (this.footwork) this.footwork.fx = env.fx;
      this.footwork?.apply(this.current, pl.grounded, env.floorY, this.strikeFeetDown && !KNIGHT_STRIKES[this.currentName].kneel);
    }
    if (this.swordTrail) {
      const swinging = this.skinnedKnight && trailWin
        ? this.current.time >= trailWin[0] && this.current.time <= trailWin[1] : inSlash;
      this.swordTrail.update(paused ? 0 : dt, swinging && !paused, this.root.parent);
    }
    if (!paused) this.updateBladeAccent(pl);

    // Timed gun shots (twin gunner): fire each scheduled shot as the clip passes it
    const shots = SHOTS[`${this.style}:${this.currentName}`];
    if (shots && env.fx && this.current) {
      const ct = this.current.time;
      if (this.shotAction !== this.current || ct < this.shotT) {
        this.shotAction = this.current;
        this.shotT = -1;
      }
      for (const sh of shots) if (sh[0] > this.shotT && sh[0] <= ct) this.fire(sh[1], sh[2] || 0, env.fx, pl.y);
      this.shotT = ct;
    }

    // Pyromancer Hell Breath: fire pours from the hands on the finisher's thrust frame
    if (env.fx && this.style === 'pyro' && this.currentName === 'attack3' && this.lastBreathClip !== this.current) {
      const fx = env.fx;
      const hand = this.R.handL;
      const f = pl.facing || 0;
      fx.later(0.15, () => {
        hand.getWorldPosition(_vp);
        fx.flameStream(_vp.x, _vp.y, _vp.z, f, 0.36);
      });
    }
    this.lastBreathClip = this.currentName === 'attack3' ? this.current : null;

    // Pyromancer: a small flame dances in the free hand
    if (env.fx && this.style === 'pyro' && /^(idle|run|guard|jump|fall)$/.test(this.currentName)) {
      this.fireT = (this.fireT || 0) - dt;
      if (this.fireT <= 0) {
        this.fireT = 0.06;
        this.R.handL.getWorldPosition(_vp);
        env.fx.add.spawn({ x: _vp.x + (Math.random() - 0.5) * 0.06, y: _vp.y + 0.06, z: _vp.z + (Math.random() - 0.5) * 0.06, vy: 1.3, color: Math.random() < 0.5 ? '#ffb347' : '#ff6a1a', intensity: 2, size: 0.26, sizeEnd: 0.04, life: 0.42, drag: 1, tile: 'dot' });
      }
    }

    // Dust trail while shield-charging, puff on lunging strikes
    if (env.fx) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.currentName === 'charge' && this.dustT <= 0) {
        this.dustT = 0.05;
        const f = pl.facing || 0;
        env.fx.dustPuff(pl.x - Math.cos(f) * 0.4, pl.y + 0.05, pl.z - Math.sin(f) * 0.4, 2, 1.1);
      }
      if (this.style === 'shield' && this.lastDustClip !== this.current && /^(attack|heavy|sweep)/.test(this.currentName)) {
        const fx = env.fx;
        const x = pl.x, y = pl.y, z = pl.z;
        fx.later(0.1, () => fx.dustPuff(x, y + 0.05, z, 5, 1.0));
      }
      // Twin gunner: knee hits the dirt on the kneeling shots, boots skid on the magnum
      if (this.style === 'twingun' && this.lastDustClip !== this.current && /^(attack3|heavy|rollshot)$/.test(this.currentName)) {
        const fx = env.fx;
        const f = pl.facing || 0;
        const back = this.currentName === 'heavy' ? 0.5 : 0;
        const delay = this.currentName === 'rollshot' ? 0.32 : 0.07;
        const root = this.root.position;
        fx.later(delay, () => fx.dustPuff(root.x - Math.cos(f) * back, root.y + 0.05, root.z - Math.sin(f) * back, 4, 0.8));
      }
      this.lastDustClip = this.current;
    }

    // Footstep dust at the first contact of each half stride.
    if ((this.currentName === 'run' || this.currentName === 'walk') && env.fx) {
      const phase = (this.current.time / this.current.getClip().duration) % 1;
      if ((this.lastRunPhase < 0.02 && phase >= 0.02) || (this.lastRunPhase < 0.52 && phase >= 0.52)) {
        env.fx.dustPuff(pl.x, pl.y + 0.05, pl.z, 1, 0.5);
      }
      this.lastRunPhase = phase;
    }

    // Squash & stretch on landing / take-off
    const grounded = !!pl.grounded;
    if (grounded && !this.wasGrounded) {
      this.squash = 1;
      if (env.fx && this.skinnedKnight) {
        // A harder landing throws a bigger, paler cloud (pale enough to read on stone).
        const hard = Math.max(0.35, this.landingStrength);
        env.fx.dustPuff(pl.x, pl.y + 0.05, pl.z, 3 + Math.round(6 * hard), 0.7 + 0.8 * hard, '#f4ecd9');
      } else if (env.fx) env.fx.dustPuff(pl.x, pl.y + 0.05, pl.z, 5, 0.8);
    } else if (!grounded && this.wasGrounded && (pl.vy || 0) > 1) {
      this.stretch = 1;
      if (env.fx && this.skinnedKnight) env.fx.dustPuff(pl.x, pl.y + 0.05, pl.z, 3, 0.65, '#f4ecd9');
    }
    this.wasGrounded = grounded;
    this.squash = Math.max(0, this.squash - dt * 6);
    this.stretch = Math.max(0, this.stretch - dt * 5);
    const sq = this.skinnedKnight ? 0
      : Math.sin(this.squash * Math.PI * 0.5) * 0.22 - Math.sin(this.stretch * Math.PI * 0.5) * 0.14;
    this.R.body.scale.set(1 + sq * 0.8, 1 - sq, 1 + sq * 0.8);

    // Spring-driven cape / scarf / flag with torso-pitch compensation so the cape
    // flows smoothly behind the knight and NEVER swings forward through armor or legs
    const speedFactor = Math.min(0.68, speed * 0.11);
    const airLift = grounded ? 0 : 0.24;
    const rollLift = this.currentName === 'roll' || this.currentName === 'dash' ? 0.22 : 0;
    const capeTarget = 0.08 + speedFactor + airLift + rollLift;
    this.capeVel += (capeTarget - this.capeAng) * 46 * dt;
    this.capeVel *= Math.exp(-dt * 8.5);
    this.capeAng = Math.max(0.04, Math.min(0.92, this.capeAng + this.capeVel * dt));
    if (this.cloth) {
      if (doPose) {
        this.root.updateMatrixWorld(true);
        this.cloth.update(paused ? 0 : poseDt, this.root.position, Math.min(1, speed / 7.5) * 1.6);
      }
    } else if (doPose && this.R.extras.capes.length > 0) {
      const torsoPitch = _e.setFromQuaternion(this.R.torso.quaternion, 'XYZ').x;
      // When torso leans backward (torsoPitch < 0), compensate cape1 so cloth stays clear of legs!
      const backComp = Math.max(0, -torsoPitch * 0.85);
      // When torso leans steeply forward (torsoPitch > 0.25), keep collar gentle so cape never folds into upper back
      const fwdTrim = Math.max(0, (torsoPitch - 0.25) * 0.35);
      for (let i = 0; i < this.R.extras.capes.length; i++) {
        const c = this.R.extras.capes[i];
        const w = c.userData.capeScale ?? 1;
        const flutter = Math.sin(this.time * 5.2 - i * 1.05) * (0.015 + 0.032 * Math.min(1, speed * 0.25 + 0.2)) * (i === 0 ? 0.35 : 1);
        let ang = this.capeAng * w + flutter;
        if (i === 0) ang = Math.max(0.05, Math.min(0.32, ang + backComp - fwdTrim));
        else ang = Math.max(0.03, Math.min(0.45, ang + backComp * 0.25));
        c.rotation.x = ang;
      }
    }
    for (let i = 0; i < this.R.extras.orbiters.length; i++) {
      const o = this.R.extras.orbiters[i];
      o.position.y += (0.72 + Math.sin(this.time * 2.4 + i) * 0.07 - o.position.y) * Math.min(1, dt * 10);
      o.rotation.y += dt * 1.6;
    }
    const thrust = pl.isFlying ? 1.4 : (pl.isDashing ? 1.0 : 0.35);
    for (const t of this.R.extras.thrusters) {
      const s = thrust * (0.85 + Math.random() * 0.3);
      t.scale.set(1, s, 1);
    }
    for (const m of this.b.glows) {
      const k = m.userData.baseIntensity * (0.85 + Math.sin(this.time * 9 + m.id) * 0.15);
      m.color.copy(m.userData.baseColor).multiplyScalar(k);
    }

    // Hit flash + buff tints via emissive
    this.flashT = Math.max(0, this.flashT - dt * 7);
    const b = pl.buffs || {};
    let er = 0, eg = 0, eb = 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 10);
    if (b.superArmor) { er += 0.35 * pulse; eg += 0.25 * pulse; }
    if (b.berserk || b.asura) { er += 0.45 * pulse; eg += 0.04; }
    if (pl.charging) { const ck = 0.25 + 0.3 * pulse; er += ck * 0.9; eg += ck * 0.8; eb += ck * 0.2; }
    if (frozen) { er += 0.15; eg += 0.35; eb += 0.55; }
    if (b.invuln) { const k = (Math.floor(this.time * 12) % 2) * 0.25; er += k; eg += k; eb += k; }
    const f = this.flashT * this.flashT * 1.3;
    er += f; eg += f; eb += f;
    for (const m of this.b.litMaterials) m.emissive.setRGB(er, eg, eb);

    // Stealth / wraith transparency
    this.setOpacity(b.stealth ? 0.28 : (b.wraith ? 0.5 : 1));
  }

  dispose() {
    // A rebuilt or removed view must not swallow hits it was holding for its blade.
    this.bladeAccent?.release?.(this.bladeAccent.held);
    this.bladeAccent = null;
    this.swordTrail?.dispose();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    this.b.dispose();
  }
}
