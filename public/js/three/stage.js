// ============================================================================
// 3D arena for the Three.js renderer: floating island platforms built from the
// shared MAPS data, painted floor/sky textures, props, clouds and themed voids.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeCloudTexture, makeMagicCircle, makeToonRamp } from './textures.js';
import { makeArenaFloor, makeArenaSky, makeArenaWall, makeConveyorTread, makeShrineInlay, makeTideTexture } from './arena_textures.js';

const loader = new THREE.TextureLoader();
const texCache = new Map();
const paintedArenas = new Map();
let tavernModel;
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
    courtArt: { platform: 'sanctuary_court', image: 'sanctuary_floor' },
    surface: ['#c5b694', '#81765d', '#e4d5b0', '#a99a79'],
    sky: 'sanctuary_sky', cliff: ['#c9b996', '#877759'], under: '#74664e', trim: '#b29a68',
    fog: '#f6e7cc', fogNear: 48, fogFar: 120, hemiSky: '#fff5e0', hemiGround: '#a7bfd9', hemiI: 1.0, sun: '#fff0d4', sunI: 1.7,
    cloud: '#fff8ec', cloudOpacity: 0.33, cloudY: [-15, -8], props: 'sanctuary', skyIntensity: 0.88
  },
  lantern_tavern: {
    props: 'tavern', backdrop: '#bea9b5', surface: ['#90695b', '#503945', '#a67d66', '#795948'],
    cliff: ['#735650', '#46343c'], under: '#4a3540',
    fog: '#bda4b1', fogNear: 74, fogFar: 130, hemiSky: '#f2d8c9', hemiGround: '#ad8a96', hemiI: 1.18,
    sun: '#ffead1', sunI: 1.65, cloudOpacity: 0
  },
  lava_citadel: {
    surface: ['#66605c', '#373036', '#8b7d70', '#554a48'], ridges: ['#886d70', '#675461', '#4c3d4c'],
    cliff: ['#76645c', '#302a32'], under: '#302732', trim: '#ad846b',
    fog: '#6b545b', fogNear: 43, fogFar: 134, hemiSky: '#f1d5ca', hemiGround: '#694954', hemiI: 1.04, sun: '#f5d8c0', sunI: 1.44,
    cloud: '#978081', cloudOpacity: 0.19, cloudY: [-15, -9], props: 'lava'
  },
  cyber_rooftop: {
    surface: ['#3f526a', '#23344c', '#60778b', '#374a5f'], ridges: ['#728799', '#596e81', '#465a70'],
    cliff: ['#536681', '#242f45'], under: '#25354a', trim: '#98c9d5', trimGlow: 1.23,
    fog: '#617487', fogNear: 48, fogFar: 134, hemiSky: '#dae4f3', hemiGround: '#536079', hemiI: 1.0, sun: '#e4edf3', sunI: 1.4,
    cloudOpacity: 0, props: 'astral'
  },
  tideglass_harbor: {
    props: 'harbor', surface: ['#956845', '#4a352c', '#bc9061', '#7d583e'],
    ridges: ['#a8b5a6', '#8fa5a0', '#698e92'],
    cliff: ['#886751', '#49342b'], under: '#3d554d', trim: '#a77a56',
    fog: '#a0b6b5', fogNear: 43, fogFar: 130, hemiSky: '#f5eee0', hemiGround: '#7f9f9f', hemiI: 1.05, sun: '#f4e6cb', sunI: 1.38,
    cloudOpacity: 0
  },
  brasswind_courier: {
    props: 'courier', surface: ['#638087', '#344b56', '#8fa2a0', '#49646b'],
    ridges: [],
    cliff: ['#69584d', '#383738'], under: '#795b4e', trim: '#bc975e',
    fog: '#bbc0ca', fogNear: 46, fogFar: 145, hemiSky: '#f7f0e5', hemiGround: '#8b93a8', hemiI: 1.04, sun: '#f9ddbb', sunI: 1.45,
    cloud: '#eff1ed', cloudOpacity: 0.36, cloudY: [-16, -7]
  },
  mossgate_ruins: {
    props: 'ruins', surface: ['#85816b', '#465043', '#a8a386', '#747363'],
    ridges: ['#a6af8d', '#778f76', '#4d7466'],
    cliff: ['#788469', '#424932'], under: '#414d3c', trim: '#b7ae7a',
    fog: '#a6b493', fogNear: 45, fogFar: 128, hemiSky: '#edf2d5', hemiGround: '#617761', hemiI: 1.12, sun: '#ffefcc', sunI: 1.4,
    cloud: '#d0d8b9', cloudOpacity: 0.27, cloudY: [-14, -6]
  },
  frostline_pass: {
    props: 'snow', surface: ['#b9d7de', '#7798b4', '#e0eff0', '#a5c5d4'],
    ridges: ['#b5c8d6', '#8da9c3', '#6889ab'],
    cliff: ['#a4bfcc', '#50708a'], under: '#6c879e',
    fog: '#c1d5e2', fogNear: 47, fogFar: 137, hemiSky: '#e4f1ff', hemiGround: '#7696b6', hemiI: 0.96, sun: '#fff3de', sunI: 1.38,
    cloud: '#e1ecf3', cloudOpacity: 0.33, cloudY: [-15, -7]
  }
};

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}
function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
}

const FLOOR_PERIOD = 8;

function mapPlatformUVs(geometry, platform, fittedArt) {
  const { position, normal, uv } = geometry.attributes;
  for (let i = 0; i < uv.count; i++) {
    const x = position.getX(i) + platform.x + platform.w / 2;
    const z = position.getZ(i) + platform.z + platform.d / 2;
    if (normal.getY(i) > 0) {
      if (fittedArt) continue;
      if (platform.course === 'z') {
        uv.setXY(i, z / FLOOR_PERIOD, x / FLOOR_PERIOD);
      } else {
        uv.setXY(i, x / FLOOR_PERIOD, -z / FLOOR_PERIOD);
      }
    } else if (normal.getY(i) === 0) {
      const y = position.getY(i) + platform.y - platform.h / 2;
      uv.setXY(i, (normal.getX(i) !== 0 ? z : x) / FLOOR_PERIOD, y / 4);
    }
  }
}

function exposedEdgeSpans(platform, axis, edge, direction, platforms) {
  const alongSize = axis === 'x' ? 'w' : 'd';
  const across = axis === 'x' ? 'z' : 'x';
  const acrossSize = axis === 'x' ? 'd' : 'w';
  let spans = [[platform[axis], platform[axis] + platform[alongSize]]];
  for (const other of platforms) {
    if (other === platform || other.y !== platform.y) continue;
    const oppositeEdge = other[across] + (direction < 0 ? other[acrossSize] : 0);
    if (Math.abs(oppositeEdge - edge) > 0.0001) continue;
    const start = other[axis];
    const end = start + other[alongSize];
    spans = spans.flatMap(([min, max]) => {
      if (start >= max || end <= min) return [[min, max]];
      const visible = [];
      if (min < start) visible.push([min, start]);
      if (end < max) visible.push([end, max]);
      return visible;
    });
  }
  return spans;
}

function makeLavaTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cells = 4;
  const sites = Array.from({ length: cells * cells }, () => [0.12 + r() * 0.76, 0.12 + r() * 0.76]);
  const pixels = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = 2 * Math.PI * x / S, b = 2 * Math.PI * y / S;
      const u = cells * x / S + 0.15 * Math.sin(3 * b + Math.sin(a));
      const v = cells * y / S + 0.13 * Math.sin(2 * a - b);
      let nearest = Infinity, next = Infinity;
      for (let iz = Math.floor(v) - 1; iz <= Math.floor(v) + 1; iz++) {
        for (let ix = Math.floor(u) - 1; ix <= Math.floor(u) + 1; ix++) {
          const site = sites[((iz + cells) % cells) * cells + (ix + cells) % cells];
          const distance = (ix + site[0] - u) ** 2 + (iz + site[1] - v) ** 2;
          if (distance < nearest) { next = nearest; nearest = distance; }
          else if (distance < next) next = distance;
        }
      }
      const heat = Math.exp(-4.3 * (Math.sqrt(next) - Math.sqrt(nearest)));
      const ripple = 4 * Math.sin(8 * a + 3 * Math.sin(4 * b));
      const i = 4 * (y * S + x);
      pixels.data[i] = 98 + 154 * heat + ripple;
      pixels.data[i + 1] = 44 + 124 * heat ** 1.5 + ripple;
      pixels.data[i + 2] = 42 + 48 * heat ** 2;
      pixels.data[i + 3] = 255;
    }
  }
  g.putImageData(pixels, 0, 0);
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
        floors: new Map(),
        wall: makeArenaWall(this.theme),
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
    if (map.conveyor) this.buildConveyor(map.conveyor);
    if (map.shrine) this.buildShrine(map.shrine);
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
    scene.background = th.backdrop ? new THREE.Color(th.backdrop) : (this.painting.sky || loadTex(th.sky));
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
    const sideMat = this.track(lambert('#ffffff', { map: this.painting.wall }));
    const underside = this.track(lambert(th.under));
    const rockMat = this.track(lambert(th.under, { flatShading: true }));
    const trimMat = th.trim ? this.track(th.trimGlow
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(th.trim).multiplyScalar(th.trimGlow) })
      : toon(th.trim)) : null;
    for (const p of this.map.platforms) {
      const h = p.h;
      const cx = p.x + p.w / 2;
      const cz = p.z + p.d / 2;
      const fittedArt = th.courtArt?.platform === p.id && p.w === p.d;
      let top;
      if (fittedArt) {
        top = loadTex(th.courtArt.image);
      } else {
        const floors = this.painting.floors;
        if (!floors.has(p.finish)) floors.set(p.finish, makeArenaFloor(th, p.finish));
        top = floors.get(p.finish);
      }
      const geometry = this.track(new THREE.BoxGeometry(p.w, h, p.d));
      mapPlatformUVs(geometry, p, fittedArt);
      const topMat = this.track(p.finish === 'ice'
        ? new THREE.MeshPhongMaterial({ map: top, specular: '#819ba5', shininess: 30 })
        : lambert('#ffffff', { map: top }));
      const box = new THREE.Mesh(geometry, [sideMat, sideMat, topMat, underside, sideMat, sideMat]);
      box.name = p.id;
      box.position.set(cx, p.y - h / 2, cz);
      box.receiveShadow = true;
      box.castShadow = p.y > 0.01;
      this.group.add(box);

      if (trimMat && !fittedArt) this.buildPlatformRim(p, trimMat);

      // Floating-island underside: inverted rocky pyramid plus a few hanging chunks
      if (h >= 2.5 && ['sanctuary', 'ruins', 'snow'].includes(th.props)) {
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

  buildPlatformRim(platform, material) {
    const width = 0.13;
    const height = 0.06;
    for (const [axis, edge, direction] of [
      ['x', platform.z, -1], ['x', platform.z + platform.d, 1],
      ['z', platform.x, -1], ['z', platform.x + platform.w, 1]
    ]) {
      const alongX = axis === 'x';
      for (const [min, max] of exposedEdgeSpans(platform, axis, edge, direction, this.map.platforms)) {
        // Across the corners, the X trim covers the ends of the Z trim.
        const start = !alongX && min === platform.z ? min + width : min;
        const end = !alongX && max === platform.z + platform.d ? max - width : max;
        const length = end - start;
        if (length <= 0) continue;
        const center = (start + end) / 2;
        const inset = edge - direction * width / 2;
        const geometry = this.track(new THREE.BoxGeometry(alongX ? length : width, height, alongX ? width : length));
        const rim = new THREE.Mesh(geometry, material);
        rim.position.set(alongX ? center : inset, platform.y - 0.015, alongX ? inset : center);
        rim.receiveShadow = true;
        this.group.add(rim);
      }
    }
  }

  buildJumpPads() {
    for (const jp of this.map.jumpPads || []) {
      const y = jp.y ?? 0;
      const padColor = jp.directionX ? '#ffac67' : '#38bdf8';
      const coreColor = jp.directionX ? '#ffc493' : '#7dd3fc';
      const mat = this.track(new THREE.MeshBasicMaterial({
        map: CIRCLE_TEX, color: new THREE.Color(padColor).multiplyScalar(1.8), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const disc = new THREE.Mesh(this.track(new THREE.PlaneGeometry(jp.r * 2.4, jp.r * 2.4)), mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(jp.x, y + 0.05, jp.z);
      this.group.add(disc);
      const core = new THREE.Mesh(this.track(new THREE.CircleGeometry(jp.r * 0.55, 24)),
        this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(coreColor).multiplyScalar(1.4), transparent: true, opacity: 0.5, depthWrite: false })));
      core.rotation.x = -Math.PI / 2;
      core.position.set(jp.x, y + 0.04, jp.z);
      this.group.add(core);
      if (jp.directionX) {
        const arrow = new THREE.Shape();
        arrow.moveTo(-0.29, -0.31);
        arrow.lineTo(-0.02, -0.31);
        arrow.lineTo(0.32, 0);
        arrow.lineTo(-0.02, 0.31);
        arrow.lineTo(-0.29, 0.31);
        arrow.lineTo(0.05, 0);
        arrow.closePath();
        const marker = new THREE.Mesh(this.track(new THREE.ShapeGeometry(arrow)),
          this.track(new THREE.MeshBasicMaterial({ color: '#483031' })));
        marker.rotation.x = -Math.PI / 2;
        marker.rotateZ(jp.directionX > 0 ? 0 : Math.PI);
        marker.position.set(jp.x, y + 0.06, jp.z);
        marker.renderOrder = 1;
        this.group.add(marker);
      }
      this.animated.push((t) => {
        disc.rotation.z = t * 0.8;
        core.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
      });
    }
  }

  buildConveyor(belt) {
    const tread = this.track(makeConveyorTread());
    const pitch = belt.d * tread.image.width / tread.image.height;
    tread.repeat.x = belt.w / pitch;
    const centerX = belt.x + belt.w / 2;
    const centerZ = belt.z + belt.d / 2;
    const top = new THREE.Mesh(this.track(new THREE.PlaneGeometry(belt.w, belt.d)),
      this.track(lambert('#ffffff', { map: tread })));
    top.name = 'cargo_belt';
    top.rotation.x = -Math.PI / 2;
    top.position.set(centerX, belt.y + 0.045, centerZ);
    top.receiveShadow = true;
    this.group.add(top);
    const rail = this.track(new THREE.BoxGeometry(belt.w, 0.065, 0.12));
    const metal = this.track(toon('#97866c'));
    for (const z of [belt.z - 0.06, belt.z + belt.d + 0.06]) {
      const mesh = new THREE.Mesh(rail, metal);
      mesh.position.set(centerX, belt.y + 0.025, z);
      this.group.add(mesh);
    }
    this.animated.push(t => { tread.offset.x = -(t * belt.speedX / pitch) % 1; });
  }

  buildShrine(shrine) {
    const inlay = new THREE.Mesh(this.track(new THREE.PlaneGeometry(shrine.r * 2, shrine.r * 2)),
      this.track(lambert('#ffffff', { map: this.track(makeShrineInlay()), transparent: true, depthWrite: false })));
    inlay.name = 'healing_inlay';
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(shrine.x, shrine.y + 0.032, shrine.z);
    inlay.receiveShadow = true;
    this.group.add(inlay);
    const light = this.track(new THREE.MeshBasicMaterial({ color: '#bcd2ab', transparent: true, depthWrite: false }));
    const ring = new THREE.Mesh(this.track(new THREE.RingGeometry(shrine.r - 0.09, shrine.r, 80)), light);
    ring.rotation.copy(inlay.rotation);
    ring.position.copy(inlay.position);
    ring.position.y += 0.008;
    ring.renderOrder = 1;
    this.group.add(ring);
    this.animated.push((t, dt, state) => {
      light.color.set(state === 'contested' ? '#e5a365' : state === 'held' ? '#9aecbc' : '#bcd2ab');
      light.opacity = state === 'idle' ? 0.55 : 0.82 + 0.14 * Math.sin(t * 3);
    });
  }

  buildVoid() {
    const th = this.theme;
    const voidY = (this.map.voidY ?? -6.5) - 6;
    if (th.props === 'lava') {
      const tex = this.track(makeLavaTexture());
      const layers = [{ x: -200, z: -200, w: 400, d: 400, y: voidY }, this.map.lava];
      for (const area of layers.filter(Boolean)) {
        const inMoat = area === this.map.lava;
        const tileSize = inMoat ? 8 : 21;
        const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, color: inMoat ? '#fff4e4' : '#705e68', fog: true }));
        const geo = this.track(new THREE.PlaneGeometry(area.w, area.d));
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * area.w / tileSize, uv.getY(i) * area.d / tileSize);
        const lava = new THREE.Mesh(geo, mat);
        if (inMoat) lava.name = 'lava_channel';
        lava.rotation.x = -Math.PI / 2;
        lava.position.set(area.x + area.w / 2, area.y, area.z + area.d / 2);
        this.group.add(lava);
      }
      this.animated.push((t) => {
        tex.offset.set(t * 0.01, t * 0.006);
      });
      const channel = this.map.lava;
      if (channel) this.buildLavaFalls(channel, voidY, tex);
    } else if (th.props === 'harbor') {
      const tex = this.track(makeTideTexture());
      tex.repeat.set(22, 22);
      const sea = new THREE.Mesh(this.track(new THREE.PlaneGeometry(260, 260)),
        this.track(lambert('#c2d7d2', { map: tex })));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = this.map.voidY - 0.35;
      this.group.add(sea);
      this.animated.push(t => tex.offset.set(t * 0.025, t * 0.011));
    }
  }

  buildLavaFalls(channel, voidY, lavaTexture) {
    const texture = this.track(lavaTexture.clone());
    const height = channel.y - voidY;
    const geometry = this.track(new THREE.PlaneGeometry(channel.w, height));
    const { position, uv } = geometry.attributes;
    const upper = new THREE.Color('#fff4e4');
    const lower = new THREE.Color('#654356');
    const colors = [];
    for (let i = 0; i < uv.count; i++) {
      const color = position.getY(i) > 0 ? upper : lower;
      colors.push(color.r, color.g, color.b);
      uv.setXY(i, uv.getX(i) * channel.w / 8, uv.getY(i) * height / 14);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = this.track(new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, side: THREE.DoubleSide }));
    for (const z of [channel.z, channel.z + channel.d]) {
      const fall = new THREE.Mesh(geometry, material);
      fall.position.set(channel.x + channel.w / 2, (channel.y + voidY) / 2, z);
      this.group.add(fall);
    }
    this.animated.push(t => { texture.offset.set(t * 0.01, t * 0.22); });
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
  islet(x, y, z, r) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const top = new THREE.Mesh(this.track(new THREE.CylinderGeometry(r, r * 0.92, 0.6, 9)), this.track(toon('#829f6f')));
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const under = new THREE.Mesh(this.track(new THREE.ConeGeometry(r * 0.92, r * 2.4, 9)), this.track(toon('#837257')));
    under.rotation.x = Math.PI;
    under.position.y = -0.3 - r * 1.2;
    g.add(under);

    let seed = Math.floor(Math.abs(x * 13 + z * 7)) + 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (this.theme.props === 'sanctuary' && z < -22 && r > 3) {
      g.add(this.column(3.4, x < 0));
    } else {
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * r * 0.55;
        g.add(this.tree(Math.cos(a) * d, 0.3, Math.sin(a) * d, 0.8 + rnd() * 0.6));
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

  column(height, broken) {
    const g = new THREE.Group();
    g.position.y = 0.3;
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
    return g;
  }

  buildProps() {
    const kind = this.theme.props;
    if (kind === 'tavern') {
      // The collision volumes provide a visible floor even during the initial LAN download.
      tavernModel ??= new GLTFLoader().loadAsync('/assets/models/amber-lantern.glb')
        .then(({ scene }) => {
          scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          return scene;
        }).catch(error => {
          tavernModel = null;
          console.warn('Tavern scenery unavailable', error);
          return null;
        });
      tavernModel.then(model => {
        if (!model || this.disposed) return;
        for (const platform of this.map.platforms) this.group.getObjectByName(platform.id).visible = false;
        this.group.add(model.clone());
        for (const [x, z] of [[-13.94, -1.3], [-1.3, -10.5], [12.4, -10.5]]) {
          const lamp = new THREE.PointLight('#ffc382', 9.5, 8, 2);
          lamp.position.set(x, 2.8, z);
          this.group.add(lamp);
        }
      });
      return;
    }
    if (kind === 'lava') {
      this.buildLavaCitadel();
      return;
    }
    if (kind === 'harbor') {
      this.buildHarborSupports();
      this.buildHarborBackdrop();
      return;
    }
    if (kind === 'courier') {
      this.buildCourierHull();
      return;
    }
    const islets = [[-24, -4, 6, 3.2], [6, -4, -24, 3.6], [14, -5, -22, 2.4], [-23, -5, 15, 2.2], [20, -6, -10, 2.8]];
    if (kind === 'snow') {
      this.buildSnowRidges();
      return;
    }
    if (kind === 'ruins') {
      this.buildRuinsProps();
      return;
    }
    if (kind !== 'astral') {
      for (const [x, y, z, r] of islets) this.islet(x * 1.22, y, z * 1.22, r);
    }

    const main = this.map.platforms[0];
    if (!main) return;
    if (kind === 'sanctuary') {
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
    } else {
      const signal = this.track(new THREE.BoxGeometry(0.55, 1.85, 0.55));
      const steel = this.track(toon('#304758'));
      const marker = this.track(new THREE.BoxGeometry(0.42, 0.2, 0.42));
      const light = this.track(new THREE.MeshBasicMaterial({ color: '#9dd8df' }));
      for (const { x, z } of this.map.pillars) {
        const post = new THREE.Mesh(signal, steel);
        post.position.set(x, 0.925, z);
        const cap = new THREE.Mesh(marker, light);
        cap.position.set(x, 1.95, z);
        this.group.add(post, cap);
      }
      const strut = this.track(new THREE.BoxGeometry(0.18, 1, 0.18));
      const up = new THREE.Vector3(0, 1, 0);
      const addBrace = (x0, y0, x1, y1, z) => {
        const delta = new THREE.Vector3(x1 - x0, y1 - y0, 0);
        const brace = new THREE.Mesh(strut, steel);
        brace.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
        brace.scale.y = delta.length();
        brace.quaternion.setFromUnitVectors(up, delta.normalize());
        this.group.add(brace);
      };
      const eastRoof = this.map.platforms.find(p => p.id === 'cyber_east');
      for (const p of this.map.platforms.filter(p => p.finish === 'catwalk' && !p.stair)) {
        const underside = p.y - p.h;
        for (const z of [p.z + 0.42, p.z + p.d - 0.42]) {
          if (p.y === 0) {
            const center = p.x + p.w / 2;
            addBrace(p.x, underside - 2.5, center, underside, z);
            addBrace(p.x + p.w, underside - 2.5, center, underside, z);
          } else {
            const west = p.x < 0 && p.x + p.w < 0;
            const root = west ? main.x + main.w : eastRoof.x;
            const tip = west ? p.x + p.w - 0.45 : p.x + 0.45;
            addBrace(root, underside - 3.5, tip, underside, z);
          }
        }
      }
      this.buildCityBackdrop();
    }
  }

  buildLavaCitadel() {
    const bridge = this.map.platforms.find(p => p.finish === 'archstone');
    const half = bridge.w / 2;
    const span = half - 1.35;
    const base = this.map.lava.y - 2.9;
    const crown = -bridge.h - 0.5;
    const rise = crown - base;
    const outline = new THREE.Shape();
    outline.moveTo(-half, -bridge.h);
    outline.lineTo(half, -bridge.h);
    outline.lineTo(half, base);
    outline.lineTo(span, base);
    outline.absellipse(0, base, span, rise, 0, Math.PI, false, 0);
    outline.lineTo(-half, base);
    outline.closePath();
    const abutment = new THREE.Mesh(this.track(new THREE.ExtrudeGeometry(outline, { depth: bridge.d - 0.18, bevelEnabled: false })),
      this.track(lambert('#665252')));
    abutment.name = 'basalt_arch';
    abutment.position.set(bridge.x + half, bridge.y, bridge.z + 0.09);
    abutment.receiveShadow = true;
    this.group.add(abutment);

    const voussoirs = [];
    for (let i = 0; i < 15; i++) {
      const a = (i + 0.08) * Math.PI / 15;
      const b = (i + 0.92) * Math.PI / 15;
      const stone = new THREE.Shape();
      stone.moveTo(span * Math.cos(a), base + rise * Math.sin(a));
      stone.lineTo((span + 0.42) * Math.cos(a), base + (rise + 0.33) * Math.sin(a));
      stone.lineTo((span + 0.42) * Math.cos(b), base + (rise + 0.33) * Math.sin(b));
      stone.lineTo(span * Math.cos(b), base + rise * Math.sin(b));
      stone.closePath();
      voussoirs.push(stone);
    }
    const stoneGeo = this.track(new THREE.ShapeGeometry(voussoirs));
    const stoneMat = this.track(lambert('#98766a', { side: THREE.DoubleSide }));
    for (const z of [bridge.z + 0.08, bridge.z + bridge.d - 0.08]) {
      const stones = new THREE.Mesh(stoneGeo, stoneMat);
      stones.position.set(bridge.x + half, bridge.y, z);
      stones.receiveShadow = true;
      this.group.add(stones);
    }

    const rockGeo = this.track(new THREE.DodecahedronGeometry(1));
    const rockMat = this.track(lambert('#51434c', { flatShading: true }));
    for (const [x, z, w, h, d] of [
      [-42, -14, 8, 14, 10], [-41, 5, 6, 8, 7], [-36, -34, 7, 12, 8],
      [-22, -40, 9, 16, 8], [-7, -41, 5, 11, 6], [15, -40, 11, 13, 7],
      [33, -35, 7, 10, 6], [44, -20, 7, 13, 8], [-37, 24, 5, 8, 6]
    ]) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, -10, z);
      rock.scale.set(w, h, d);
      rock.rotation.set(x * 0.08, z * 0.15, x * 0.04);
      this.group.add(rock);
    }

    const bowlGeo = this.track(new THREE.CylinderGeometry(0.6, 0.35, 0.6, 10));
    const footGeo = this.track(new THREE.CylinderGeometry(0.2, 0.38, 0.7, 8));
    const metal = this.track(toon('#403136'));
    const flameGeo = this.track(new THREE.ConeGeometry(0.34, 0.8, 8));
    const firelight = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff985e').multiplyScalar(1.55) }));
    for (const { x, z, y } of this.map.pillars) {
      const support = new THREE.Group();
      support.position.set(x, y, z);
      const bowl = new THREE.Mesh(bowlGeo, metal);
      const foot = new THREE.Mesh(footGeo, metal);
      const flame = new THREE.Mesh(flameGeo, firelight);
      foot.position.y = 0.35;
      bowl.position.y = 0.94;
      flame.position.y = 1.53;
      bowl.castShadow = foot.castShadow = true;
      support.add(bowl, foot, flame);
      this.group.add(support);
      this.animated.push(t => {
        const height = 0.9 + Math.sin(t * 11 + x) * 0.1 + Math.sin(t * 6.5 + z) * 0.08;
        flame.scale.set(1 / height, height, 1 / height);
      });
    }
  }

  buildHarborSupports() {
    const piling = this.track(new THREE.CylinderGeometry(0.28, 0.35, 5, 8));
    const material = this.track(toon('#49392d'));
    const cap = this.track(new THREE.BoxGeometry(0.52, 0.42, 1));
    const supports = [];
    for (const p of this.map.platforms) {
      const alongZ = p.course === 'z';
      const length = alongZ ? p.d : p.w;
      const span = alongZ ? p.w : p.d;
      const rows = Math.max(1, Math.ceil((length - 1.5) / 7));
      for (let i = 0; i <= rows; i++) {
        const s = 0.75 + i * (length - 1.5) / rows;
        const x = p.x + (alongZ ? span / 2 : s);
        const z = p.z + (alongZ ? s : span / 2);
        const brace = new THREE.Mesh(cap, material);
        brace.scale.z = span - 0.8;
        brace.position.set(x, -1.43, z);
        if (alongZ) brace.rotation.y = Math.PI / 2;
        this.group.add(brace);
        for (const offset of [0.75 - span / 2, span / 2 - 0.75]) {
          supports.push([x + (alongZ ? offset : 0), z + (alongZ ? 0 : offset)]);
        }
      }
    }
    const posts = new THREE.InstancedMesh(piling, material, supports.length);
    const transform = new THREE.Matrix4();
    supports.forEach(([x, z], i) => posts.setMatrixAt(i, transform.makeTranslation(x, -3.25, z)));
    this.group.add(posts);
  }

  buildRuinsProps() {
    const stone = this.track(lambert('#6b7463'));
    const cap = this.track(lambert('#8b907b'));
    const pier = this.track(new THREE.BoxGeometry(1, 1, 1));
    const baseY = this.map.voidY - 8;
    for (const p of this.map.platforms.filter(p => p.finish === 'ruin_walk' && !p.stair)) {
      if (p.id === 'mossgate_terrace_corner') continue;
      const count = Math.max(1, Math.round(p.w / 7));
      for (let i = 0; i < count; i++) {
        const x = p.x + p.w * (i + 0.5) / count;
        const height = p.y - p.h - baseY;
        const shaft = new THREE.Mesh(pier, stone);
        shaft.scale.set(1.45, height, p.d * 0.34);
        shaft.position.set(x, baseY + height / 2, p.z + p.d / 2);
        const bearing = new THREE.Mesh(pier, cap);
        bearing.scale.set(Math.min(2.3, p.w), 0.45, p.d * 0.56);
        bearing.position.set(x, p.y - p.h - 0.23, shaft.position.z);
        this.group.add(shaft, bearing);
      }
    }
    for (const [x, y, z, r] of [
      [-44, -7, -15, 6], [-46, -12, 4, 5], [-33, -3, -42, 7], [-12, -7, -41, 5],
      [5, -9, -39, 4], [29, -8, -43, 7], [46, -11, -16, 6], [47, -12, 19, 5]
    ]) this.islet(x, y, z, r);
  }

  buildSnowRidges() {
    const rock = this.track(new THREE.DodecahedronGeometry(1));
    const cliff = this.track(lambert('#71869c', { flatShading: true }));
    const snow = this.track(lambert('#c4d7e1', { flatShading: true }));
    for (const [x, z, w, h, d] of [
      [-52, -32, 11, 17, 13], [-52, -6, 11, 13, 14],
      [-32, -50, 14, 20, 12], [-5, -55, 12, 17, 13], [18, -49, 14, 19, 12],
      [43, -40, 12, 16, 10], [51, -16, 10, 13, 13]
    ]) {
      const ridge = new THREE.Mesh(rock, cliff);
      ridge.position.set(x, -13, z);
      ridge.scale.set(w, h, d);
      ridge.rotateY((x - z) * 0.08);
      const snowcap = new THREE.Mesh(rock, snow);
      snowcap.position.set(x, -13 + h * 0.62, z);
      snowcap.scale.set(w * 0.61, h * 0.48, d * 0.65);
      snowcap.rotation.copy(ridge.rotation);
      this.group.add(ridge, snowcap);
    }
  }

  buildHarborBackdrop() {
    const rock = this.track(new THREE.IcosahedronGeometry(1, 1));
    const stone = this.track(lambert('#778b84', { flatShading: true }));
    for (const [x, z, width, height, depth] of [
      [-46, -32, 7, 5.1, 6], [-47, -18, 5.5, 3.6, 7], [-14, -39, 8, 5.2, 6],
      [9, -41, 12, 5.1, 8], [30, -35, 7, 3.7, 5], [48, -14, 6, 4.6, 7]
    ]) {
      const stack = new THREE.Mesh(rock, stone);
      stack.scale.set(width, height, depth);
      stack.position.set(x, -6, z);
      this.group.add(stack);
    }
    const tower = new THREE.Group();
    tower.position.set(-46, -1.8, -32);
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
    const shell = this.track(new THREE.SphereGeometry(1, 36, 18));
    const body = this.track(toon('#765753'));
    const brass = this.track(toon('#b48b55'));
    const hull = new THREE.Mesh(shell, body);
    hull.name = 'courier_hull';
    hull.position.set(deck.x + deck.w / 2, -4.1, deck.z + deck.d / 2);
    hull.scale.set(deck.w * 0.5, 4.1, deck.d * 0.49);
    this.group.add(hull);
    const seam = new THREE.Mesh(shell, brass);
    seam.position.copy(hull.position).y = -3.25;
    seam.scale.set(deck.w * 0.493, 0.34, deck.d * 0.497);
    this.group.add(seam);

    const casing = this.track(new THREE.CylinderGeometry(0.85, 1.1, 4.8, 12));
    const blade = this.track(new THREE.BoxGeometry(0.14, 4.5, 0.35));
    const hubGeo = this.track(new THREE.CylinderGeometry(0.32, 0.36, 0.56, 12));
    const braceGeo = this.track(new THREE.BoxGeometry(0.8, 0.44, 1));
    for (const bay of this.map.platforms.filter(p => p.finish === 'courier_wing')) {
      const side = Math.sign(bay.z);
      const bayZ = bay.z + bay.d / 2;
      const pod = new THREE.Mesh(shell, body);
      pod.scale.set(bay.w * 0.49, 1.9, bay.d * 0.46);
      pod.position.set(bay.x + bay.w / 2, -3.5, bayZ);
      this.group.add(pod);
      for (const s of [0.18, 0.8]) {
        const support = new THREE.Mesh(braceGeo, brass);
        support.scale.z = bay.d + 1.7;
        support.position.set(bay.x + bay.w * s, -1.8, bayZ - side * 0.55);
        this.group.add(support);
      }
      const propeller = new THREE.Group();
      const engine = new THREE.Mesh(casing, brass);
      engine.rotation.z = Math.PI / 2;
      engine.position.set(bay.x + bay.w * 0.31, -3.8, bayZ + side * 1.95);
      propeller.position.copy(engine.position).x -= 2.5;
      const hub = new THREE.Mesh(hubGeo, body);
      hub.rotation.z = Math.PI / 2;
      propeller.add(hub);
      for (let i = 0; i < 3; i++) {
        const vane = new THREE.Mesh(blade, brass);
        vane.rotation.x = i * Math.PI / 3;
        propeller.add(vane);
      }
      this.group.add(engine, propeller);
      this.animated.push(t => { propeller.rotation.x = side * t * 7; });
    }
  }

  buildCityBackdrop() {
    const box = this.track(new THREE.BoxGeometry(1, 1, 1));
    const walls = this.track(lambert('#46566c'));
    const roofs = this.track(lambert('#657c8f'));
    for (const [x, z, width, height, depth] of [
      [-46, -21, 9, 35, 10], [-50, 2, 13, 42, 8], [-45, 20, 10, 29, 9],
      [-27, -41, 9, 42, 11], [-11, -47, 11, 32, 11], [4, -40, 9, 30, 11], [24, -40, 11, 34, 8],
      [45, -20, 12, 35, 11], [47, 15, 13, 30, 9], [1, 29, 12, 22, 9], [-10, 20, 7, 24, 8]
    ]) {
      const tower = new THREE.Mesh(box, [walls, walls, roofs, walls, walls, walls]);
      tower.scale.set(width, height, depth);
      tower.position.set(x, -15 - height * 0.35, z);
      this.group.add(tower);
    }
  }

  update(t, dt, shrineState = 'idle') {
    for (const fn of this.animated) fn(t, dt, shrineState);
  }

  dispose() {
    this.disposed = true;
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose?.();
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
  }
}
