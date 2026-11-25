// ============================================================================
// LOST SAGA 3D - NECRO GRIM REAPER (ABYSSAL SOUL & SCYTHE) 3D VFX SUITE
// ============================================================================
// Dedicated 7-move Necro Grim Reaper (ยมทูตเคียวทมิฬ) 3D VFX suite:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Pitch-black Abyssal Void
//      NormalBlending silhouettes (#090314 / #140624) paired with Royal Violet
//      (#9333ea), Electric Soul Fuchsia (#e879f9), Spectral Necro-Teal
//      (#2dd4bf), and Blood-Soul Crimson (#f43f5e) Additive HDR Bloom using
//      our 10 512x512 Necro Grim Reaper PNGs!
// ============================================================================
import * as THREE from 'three';

const REAPER_TEX_NAMES = [
  'reaper_necro_circle',
  'scythe_reap_arc',
  'abyssal_chain_beam',
  'phantom_skull_emblem',
  'grave_portal_seal',
  'soul_vortex_column',
  'wraith_mist_cloud',
  'wraith_soul_ring',
  'soul_harvest_flare',
  'soul_ember'
];

const REAPER_EFFECT_IDS = new Set([
  'reaper_basic_combo',
  'reaper_heavy_hook',
  'reaper_weapon',
  'reaper_armor',
  'reaper_helmet',
  'reaper_trinket',
  'reaper_mobility_wraith'
]);

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function easeInOutQuad(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function hdrColor(hex, intensity = 2.0) {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

export class ReaperThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'ReaperThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      vortexOuter: new THREE.CylinderGeometry(1.55, 0.78, 1.0, 28, 1, true),
      vortexInner: new THREE.CylinderGeometry(1.05, 0.48, 1.0, 24, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of REAPER_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/reaper/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'soul_vortex_column') {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
      }
      this.textures[name] = tex;
    }
  }

  makeMat(texName, hex, intensity = 2.0, opacity = 1.0, additive = true) {
    return new THREE.MeshBasicMaterial({
      map: this.textures[texName] || null,
      color: additive ? hdrColor(hex, intensity) : new THREE.Color(hex),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide
    });
  }

  groundY(x, y, z) {
    const gy = this.floorY(x, z, y + 0.5);
    return Number.isFinite(gy) ? gy : y;
  }

  /**
   * Handle server FX events for Necro Grim Reaper (including stolen Reaper gear skills!).
   * Returns true if handled/suppressed by the Reaper 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && REAPER_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'reaper_weapon') this.shake(8);
      else if (mapped.effectId === 'reaper_trinket') this.shake(8);
      else if (mapped.effectId === 'reaper_heavy_hook') this.shake(6);
      else if (mapped.effectId === 'reaper_armor') this.shake(5);
      else if (mapped.effectId === 'reaper_helmet') this.shake(5);
      else if (mapped.effectId === 'reaper_basic_combo' && mapped.isFinisher) this.shake(4);

      return true;
    }

    // Suppress ONLY Reaper's duplicate secondary server events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'reaper') ||
      (fx.type === 'skill_cast' && (
        fx.skillId === 'reaper_weapon' ||
        fx.skillId === 'reaper_armor' ||
        fx.skillId === 'reaper_trinket'
      ))
    ) {
      return true;
    }
    return false;
  }

  spawnThreeEffect(effectId, opts) {
    const root = new THREE.Group();
    const x = opts.x || 0;
    const y = opts.y || 0;
    const z = opts.z || 0;
    const facing = typeof opts.facing === 'number' ? opts.facing : 0;
    const yaw = Math.PI * 0.5 - facing;
    const scale = opts.scale || 1.0;

    root.position.set(x, y, z);
    root.rotation.y = yaw;
    root.scale.setScalar(scale);
    this.group.add(root);

    const gyOffset = this.groundY(x, y, z) - y + 0.04;
    const parts = [];
    const sparks = [];
    let duration = 0.75;
    let attachToCaster = false;

    const addMesh = (geo, texName, hex, intensity, initFn, updateFn, additive = true) => {
      const mat = this.makeMat(texName, hex, intensity, 1.0, additive);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = additive ? 16 : 12;
      if (initFn) initFn(mesh, mat);
      root.add(mesh);
      parts.push({ mesh, mat, update: updateFn });
      return mesh;
    };

    const addDualGround = (texName, darkHex, brightHex, intensity, yOff, startS, endS, spinSpeed, delay = 0, darkAlpha = 0.86) => {
      addMesh(this.geo.plane, texName, darkHex, 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.y = gyOffset + yOff;
        m.visible = false;
      }, (m, mat, t) => {
        const lt = clamp01((t - delay) / Math.max(0.08, 1 - delay));
        if (t < delay) { m.visible = false; return; }
        m.visible = true;
        const s = startS + easeOutCubic(lt) * (endS - startS);
        m.scale.set(s * 1.05, s * 1.05, 1);
        m.rotation.z = lt * spinSpeed;
        mat.opacity = clamp01(Math.min(lt * 6.5, (1 - lt) * 2.4)) * darkAlpha;
      }, false);

      addMesh(this.geo.plane, texName, brightHex, intensity, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.y = gyOffset + yOff + 0.035;
        m.visible = false;
      }, (m, mat, t) => {
        const lt = clamp01((t - delay) / Math.max(0.08, 1 - delay));
        if (t < delay) { m.visible = false; return; }
        m.visible = true;
        const s = startS + easeOutCubic(lt) * (endS - startS);
        m.scale.set(s, s, 1);
        m.rotation.z = lt * spinSpeed * 1.15;
        mat.opacity = clamp01(Math.min(lt * 7.5, (1 - lt) * 2.2));
      }, true);
    };

    const addBillboardFlare = (texName, darkHex, brightHex, intensity, posFn, sizeFn, opacityFn, spinSpeed = 0) => {
      addMesh(this.geo.plane, texName, darkHex, 1.0, (m) => {
        m.userData.billboard = true;
      }, (m, mat, t) => {
        const p = posFn(t);
        const s = sizeFn(t);
        const op = opacityFn(t);
        m.visible = op > 0.01 && s > 0.02;
        if (!m.visible) return;
        m.position.set(p.x, p.y, p.z);
        m.scale.set(s * 1.08, s * 1.08, 1);
        m.userData.billboardRoll = t * spinSpeed;
        mat.opacity = op * 0.85;
      }, false);

      addMesh(this.geo.plane, texName, brightHex, intensity, (m) => {
        m.userData.billboard = true;
      }, (m, mat, t) => {
        const p = posFn(t);
        const s = sizeFn(t);
        const op = opacityFn(t);
        m.visible = op > 0.01 && s > 0.02;
        if (!m.visible) return;
        m.position.set(p.x, p.y, p.z);
        m.scale.set(s, s, 1);
        m.userData.billboardRoll = t * spinSpeed;
        mat.opacity = op;
      }, true);
    };

    const addScytheSweep = (yPos, zOff, tiltX, tiltZ, startS, endS, startAngle, sweepDelta, brightHex, intensity, delay = 0, span = 0.72) => {
      const holder = new THREE.Group();
      holder.position.set(0, yPos, zOff);
      holder.rotation.set(tiltX, 0, tiltZ);
      root.add(holder);

      const addLayer = (hex, intVal, additive, scaleMult, yBias, alphaMax) => {
        const mat = this.makeMat('scythe_reap_arc', hex, intVal, 0, additive);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.rotation.x = -Math.PI * 0.5;
        mesh.position.y = yBias;
        mesh.renderOrder = additive ? 17 : 13;
        holder.add(mesh);
        parts.push({
          mesh,
          mat,
          update: (m, mt, t) => {
            const lt = clamp01((t - delay) / Math.max(0.08, span));
            if (t < delay || t > delay + span) { m.visible = false; return; }
            m.visible = true;
            const e = easeOutCubic(lt);
            const s = (startS + e * (endS - startS)) * scaleMult;
            m.scale.set(s, s, 1);
            m.rotation.z = startAngle + e * sweepDelta;
            mt.opacity = clamp01(Math.min(lt * 8.0, (1 - lt) * 2.6)) * alphaMax;
          }
        });
      };

      addLayer('#090314', 1.0, false, 1.07, -0.02, 0.88);
      addLayer(brightHex, intensity, true, 1.0, 0.02, 1.0);
    };

    const addSoulVortex = (baseY, height, radiusScale, outerHex, innerHex, durationFrac = 0.92, delay = 0) => {
      // Dark void outer shroud (NormalBlending)
      addMesh(this.geo.vortexOuter, 'soul_vortex_column', '#0c031a', 1.0, (m) => {
        m.position.y = baseY + height * 0.5;
      }, (m, mat, t) => {
        const lt = clamp01((t - delay) / Math.max(0.1, durationFrac));
        if (t < delay || lt >= 1) { m.visible = false; return; }
        m.visible = true;
        const e = easeOutCubic(lt);
        const r = radiusScale * (0.65 + e * 0.45);
        m.scale.set(r * 1.06, height * (0.35 + e * 0.72), r * 1.06);
        m.position.y = baseY + m.scale.y * 0.5;
        m.rotation.y = lt * 6.5;
        mat.opacity = clamp01(Math.min(lt * 5.0, (1 - lt) * 2.2)) * 0.78;
      }, false);

      // Luminous additive violet outer spiral
      addMesh(this.geo.vortexOuter, 'soul_vortex_column', outerHex, 2.3, (m) => {
        m.position.y = baseY + height * 0.5;
      }, (m, mat, t) => {
        const lt = clamp01((t - delay) / Math.max(0.1, durationFrac));
        if (t < delay || lt >= 1) { m.visible = false; return; }
        m.visible = true;
        const e = easeOutCubic(lt);
        const r = radiusScale * (0.62 + e * 0.42);
        m.scale.set(r, height * (0.35 + e * 0.75), r);
        m.position.y = baseY + m.scale.y * 0.5;
        m.rotation.y = lt * 7.8;
        mat.opacity = clamp01(Math.min(lt * 6.0, (1 - lt) * 2.1)) * 0.95;
      }, true);

      // Counter-spinning inner necro-teal / fuchsia spectral core
      addMesh(this.geo.vortexInner, 'soul_vortex_column', innerHex, 2.6, (m) => {
        m.position.y = baseY + height * 0.5;
      }, (m, mat, t) => {
        const lt = clamp01((t - delay) / Math.max(0.1, durationFrac));
        if (t < delay || lt >= 1) { m.visible = false; return; }
        m.visible = true;
        const e = easeOutCubic(lt);
        const r = radiusScale * (0.48 + e * 0.34);
        m.scale.set(r, height * (0.4 + e * 0.78), r);
        m.position.y = baseY + m.scale.y * 0.5;
        m.rotation.y = -lt * 10.5;
        mat.opacity = clamp01(Math.min(lt * 6.5, (1 - lt) * 2.3)) * 0.9;
      }, true);
    };

    const addCrossedChain = (posFn, rotFn, widthFn, lengthFn, brightHex, intensity, opacityFn) => {
      const holder = new THREE.Group();
      root.add(holder);

      const layers = [
        { hex: '#090314', inten: 1.0, add: false, rotY: 0, wMult: 1.15, opMult: 0.88 },
        { hex: '#090314', inten: 1.0, add: false, rotY: Math.PI * 0.5, wMult: 1.15, opMult: 0.88 },
        { hex: brightHex, inten: intensity, add: true, rotY: 0, wMult: 1.0, opMult: 1.0 },
        { hex: brightHex, inten: intensity, add: true, rotY: Math.PI * 0.5, wMult: 1.0, opMult: 1.0 }
      ];

      for (const l of layers) {
        const mat = this.makeMat('abyssal_chain_beam', l.hex, l.inten, 0, l.add);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.rotation.y = l.rotY;
        mesh.renderOrder = l.add ? 17 : 13;
        holder.add(mesh);
        parts.push({
          mesh,
          mat,
          update: (m, mt, t) => {
            const op = opacityFn(t);
            const len = lengthFn(t);
            const w = widthFn(t);
            m.visible = op > 0.01 && len > 0.05;
            if (!m.visible) return;
            const p = posFn(t);
            const r = rotFn(t);
            holder.position.set(p.x, p.y, p.z);
            holder.rotation.set(r.x, r.y, r.z);
            m.scale.set(w * l.wMult, len, 1);
            mt.opacity = op * l.opMult;
          }
        });
      }
    };

    const spawnSparks = (count, cfg = {}) => {
      const originZ = cfg.originZ || 0;
      const originY = cfg.originY !== undefined ? cfg.originY : 1.0;
      const spread = cfg.spread || 1.2;
      const speedMin = cfg.speedMin || 2.0;
      const speedMax = cfg.speedMax || 6.5;
      const upBias = cfg.upBias !== undefined ? cfg.upBias : 2.6;
      const inward = !!cfg.inward;
      const ringRadius = cfg.ringRadius || 3.4;
      const colors = cfg.colors || ['#e879f9', '#a855f7', '#2dd4bf', '#f43f5e'];

      for (let i = 0; i < count; i++) {
        const ang = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const colorHex = colors[i % colors.length];
        const mat = this.makeMat('soul_ember', colorHex, 2.5, 0.95, true);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = 18;
        mesh.userData.billboard = true;

        let ox, oy, oz, vx, vy, vz;
        if (inward) {
          const rr = ringRadius * (0.7 + Math.random() * 0.45);
          ox = Math.cos(ang) * rr;
          oy = originY + Math.random() * 0.9;
          oz = originZ + Math.sin(ang) * rr;
          const pullSpd = speedMin + Math.random() * (speedMax - speedMin);
          vx = -Math.cos(ang) * pullSpd;
          vy = upBias + Math.random() * 1.4;
          vz = -Math.sin(ang) * pullSpd;
        } else {
          const spd = speedMin + Math.random() * (speedMax - speedMin);
          ox = (Math.random() - 0.5) * spread;
          oy = originY + (Math.random() - 0.5) * 0.6;
          oz = originZ + (Math.random() - 0.5) * spread;
          vx = Math.cos(ang) * spd;
          vy = upBias + Math.random() * 3.0;
          vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        }

        mesh.position.set(ox, oy, oz);
        const sz = 0.28 + Math.random() * 0.34;
        mesh.scale.set(sz * 0.72, sz * 1.45, 1);
        root.add(mesh);

        sparks.push({
          mesh,
          mat,
          ox, oy, oz,
          vx, vy, vz,
          size: sz,
          delay: Math.random() * (cfg.maxDelay || 0.14),
          gravity: cfg.gravity !== undefined ? cfg.gravity : -2.4
        });
      }
    };

    // ========================================================================
    // 1. BASIC COMBO (J x 3) - Wicked Grim Scythe Reap Combo
    // ========================================================================
    if (effectId === 'reaper_basic_combo') {
      const step = opts.comboStep || 1;
      const isFinisher = !!opts.isFinisher || step >= 3;
      duration = isFinisher ? 0.62 : 0.44;

      if (!isFinisher) {
        const dir = step % 2 === 1 ? 1 : -1;
        addScytheSweep(
          1.05, 0.9, 0.18 * dir, 0.20 * dir,
          3.2, 4.9,
          -1.65 * dir, 3.1 * dir,
          step === 1 ? '#e879f9' : '#c084fc', 2.5, 0, 0.85
        );
        // Trailing spectral teal ghost scythe edge
        addScytheSweep(
          1.12, 0.95, 0.16 * dir, 0.22 * dir,
          2.7, 4.3,
          -1.95 * dir, 3.0 * dir,
          '#2dd4bf', 2.0, 0.06, 0.78
        );
        addDualGround('reaper_necro_circle', '#0b0318', '#9333ea', 2.0, 0.02, 1.8, 3.3, 1.6 * dir, 0, 0.70);
        addBillboardFlare(
          'soul_harvest_flare', '#120424', '#f0abfc', 2.6,
          (t) => ({ x: 0.25 * dir * t, y: 1.08, z: 1.75 + t * 0.45 }),
          (t) => 1.0 + easeOutCubic(t) * 1.7,
          (t) => clamp01(Math.min(t * 9, (1 - t) * 2.8)),
          4.0 * dir
        );
        spawnSparks(10, { originZ: 1.5, originY: 1.05, forwardBias: 2.2, speedMax: 5.0 });
      } else {
        // Hit 3 Finisher: Double-Crossed X-Reap Death Scythe Execution!
        addScytheSweep(1.10, 0.95, 0.36, 0.44, 4.0, 6.4, -1.9, 3.6, '#e879f9', 2.8, 0.0, 0.82);
        addScytheSweep(1.18, 1.00, -0.32, -0.44, 3.9, 6.3, 1.9, -3.6, '#f43f5e', 2.7, 0.06, 0.82);
        addDualGround('reaper_necro_circle', '#0a0316', '#a855f7', 2.3, 0.02, 2.4, 4.9, 2.5, 0, 0.82);
        addDualGround('wraith_soul_ring', '#120424', '#2dd4bf', 2.4, 0.06, 1.4, 5.2, -3.2, 0.05, 0.72);
        addBillboardFlare(
          'soul_harvest_flare', '#150320', '#f0abfc', 3.0,
          () => ({ x: 0, y: 1.15, z: 2.0 }),
          (t) => 1.4 + easeOutCubic(t) * 2.8,
          (t) => clamp01(Math.min(t * 9, (1 - t) * 2.5)),
          5.5
        );
        spawnSparks(16, { originZ: 1.85, originY: 1.1, forwardBias: 2.8, speedMax: 6.8 });
      }

    // ========================================================================
    // 2. HEAVY ATTACK (K) - Soul Hook Pull (4.8m Abyssal Chain + Reap Hook Pull!)
    // ========================================================================
    } else if (effectId === 'reaper_heavy_hook') {
      duration = 0.88;

      // Ground necromancer sigil under caster
      addDualGround('reaper_necro_circle', '#090314', '#9333ea', 2.3, 0.02, 2.2, 4.8, 2.4, 0, 0.84);

      // 4.8m Abyssal Soul Chain snapping forward (+Z) then yanking BACKWARD!
      addCrossedChain(
        (t) => {
          const reach = t < 0.32
            ? easeOutCubic(t / 0.32) * 4.8
            : (t < 0.50 ? 4.8 : 4.8 * (1 - easeInOutQuad((t - 0.50) / 0.50) * 0.74));
          return { x: 0, y: 1.05, z: reach * 0.5 };
        },
        () => ({ x: Math.PI * 0.5, y: 0, z: 0 }),
        () => 1.15,
        (t) => {
          if (t < 0.32) return 0.5 + easeOutCubic(t / 0.32) * 4.4;
          if (t < 0.50) return 4.9;
          return Math.max(0.7, 4.9 * (1 - easeInOutQuad((t - 0.50) / 0.50) * 0.76));
        },
        '#e879f9', 2.6,
        (t) => clamp01(Math.min(t * 10, (1 - t) * 2.8))
      );

      // Far-end Grim Scythe Hook grabbing at z=4.5m and ripping BACKWARD to z=1.1m!
      const hookHolder = new THREE.Group();
      root.add(hookHolder);
      const mkHookLayer = (hex, inten, add, sMult, yOff) => {
        const mat = this.makeMat('scythe_reap_arc', hex, inten, 0, add);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.rotation.x = -Math.PI * 0.5;
        mesh.position.y = yOff;
        mesh.renderOrder = add ? 17 : 13;
        hookHolder.add(mesh);
        parts.push({
          mesh,
          mat,
          update: (m, mt, t) => {
            if (t < 0.16) { m.visible = false; return; }
            m.visible = true;
            const lt = clamp01((t - 0.16) / 0.84);
            const pullZ = lt < 0.25 ? (3.8 + (lt / 0.25) * 0.75) : (4.55 - easeInOutQuad((lt - 0.25) / 0.75) * 3.45);
            hookHolder.position.set(0, 1.08, pullZ);
            const s = (3.4 + Math.sin(lt * Math.PI) * 1.1) * sMult;
            m.scale.set(s, s, 1);
            m.rotation.z = -1.1 + lt * 4.2;
            mt.opacity = clamp01(Math.min(lt * 7.5, (1 - lt) * 2.6)) * (add ? 1.0 : 0.86);
          }
        });
      };
      mkHookLayer('#090314', 1.0, false, 1.08, -0.02);
      mkHookLayer('#f43f5e', 2.7, true, 1.0, 0.03);

      // Imploding Pull Ring collapsing INWARD as it drags back from z=4.3m to z=1.1m!
      addMesh(this.geo.plane, 'wraith_soul_ring', '#2dd4bf', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.y = gyOffset + 0.12;
      }, (m, mat, t) => {
        if (t < 0.20) { m.visible = false; return; }
        m.visible = true;
        const lt = clamp01((t - 0.20) / 0.80);
        const s = 5.2 - easeOutCubic(lt) * 3.8;
        m.scale.set(s, s, 1);
        m.position.z = 4.3 - easeInOutQuad(lt) * 3.2;
        m.rotation.z = -lt * 5.0;
        mat.opacity = clamp01(Math.min(lt * 6.5, (1 - lt) * 2.5));
      }, true);

      // Dragged Soul Flare pulled along the chain!
      addBillboardFlare(
        'soul_harvest_flare', '#120322', '#2dd4bf', 2.8,
        (t) => {
          const lt = clamp01((t - 0.20) / 0.80);
          return { x: 0, y: 1.12, z: 4.4 - easeInOutQuad(lt) * 3.3 };
        },
        (t) => t < 0.20 ? 0 : (2.6 - clamp01((t - 0.20) / 0.80) * 1.1),
        (t) => t < 0.20 ? 0 : clamp01(Math.min((t - 0.20) * 8, (1 - t) * 2.8)),
        6.0
      );

      spawnSparks(18, { originZ: 3.8, originY: 1.05, spread: 1.6, forwardBias: -5.2, upBias: 1.5, speedMin: 1.5, speedMax: 3.5 });

    // ========================================================================
    // 3. [Q/SD] WEAPON SKILL - Grim Soul Harvest (360° Colossal Scythe + Lifesteal!)
    // ========================================================================
    } else if (effectId === 'reaper_weapon') {
      duration = 1.24;

      // Colossal 8.8m Cursed Necromancer Circle + Inner Hell-Gate Rift
      addDualGround('reaper_necro_circle', '#080212', '#a855f7', 2.5, 0.02, 2.8, 8.8, 2.2, 0, 0.88);
      addDualGround('grave_portal_seal', '#0b0318', '#e879f9', 2.2, 0.06, 2.0, 6.2, -3.0, 0.04, 0.78);

      // Dual 360° Colossal Phantom Scythe Sweeps (Fuchsia + Blood-Crimson Gear Strip!)
      addScytheSweep(1.15, 0, 0.08, 0.06, 5.0, 9.2, -0.5, 11.4, '#e879f9', 2.8, 0.0, 0.86);
      addScytheSweep(1.48, 0, -0.28, 0.24, 4.4, 8.4, 2.6, -10.8, '#f43f5e', 2.7, 0.06, 0.82);

      // Central Rising Soul Vortex Tornado
      addSoulVortex(gyOffset, 4.8, 1.35, '#9333ea', '#2dd4bf', 0.90, 0.04);

      // Expanding Harvest Shockwave Ring (8.6m)
      addDualGround('wraith_soul_ring', '#100320', '#f0abfc', 2.6, 0.12, 1.8, 8.8, 3.6, 0.06, 0.72);

      // Rising Spectral Reaper Skull Cresting Over the Harvest
      addBillboardFlare(
        'phantom_skull_emblem', '#090314', '#e879f9', 2.6,
        (t) => ({ x: 0, y: 1.9 + easeOutCubic(t) * 2.1, z: 0 }),
        (t) => 1.8 + easeOutCubic(t) * 1.9,
        (t) => clamp01(Math.min((t - 0.08) * 6.0, (1 - t) * 2.2)),
        0
      );

      // 6 Lifesteal Soul-Drain Orbs spiraling INWARD from r=4.2m back to center!
      for (let i = 0; i < 6; i++) {
        const baseAng = (i / 6) * Math.PI * 2;
        const hex = i % 2 === 0 ? '#2dd4bf' : '#f43f5e';
        addBillboardFlare(
          'soul_harvest_flare', '#100320', hex, 2.7,
          (t) => {
            const lt = clamp01((t - 0.12) / 0.80);
            const r = 4.2 * (1 - easeInOutQuad(lt) * 0.92);
            const a = baseAng + lt * 4.4;
            return { x: Math.cos(a) * r, y: 0.95 + Math.sin(lt * Math.PI) * 1.1, z: Math.sin(a) * r };
          },
          (t) => (t < 0.12 ? 0 : (1.55 - clamp01((t - 0.12) / 0.80) * 0.65)),
          (t) => (t < 0.12 ? 0 : clamp01(Math.min((t - 0.12) * 8, (1 - t) * 2.8))),
          7.0
        );
      }

      spawnSparks(26, { originY: 1.0, inward: true, ringRadius: 4.1, speedMin: 3.0, speedMax: 5.4, upBias: 2.0 });

    // ========================================================================
    // 4. [E/ASD] ARMOR SKILL - Wraith Mist Form (Follows Caster! Spectral Shroud)
    // ========================================================================
    } else if (effectId === 'reaper_armor') {
      duration = 1.38;
      attachToCaster = true;

      // Billowing 7.6m Dual-Pass Abyssal Shadow + Violet Wraith Mist
      addDualGround('wraith_mist_cloud', '#080212', '#9333ea', 2.4, 0.06, 2.6, 7.6, 2.4, 0, 0.90);
      addDualGround('reaper_necro_circle', '#0b0318', '#2dd4bf', 2.3, 0.02, 2.2, 6.8, -2.6, 0.03, 0.78);

      // Rising Wraith Shroud Vortex wrapping around the Reaper
      addSoulVortex(gyOffset, 3.8, 1.15, '#a855f7', '#2dd4bf', 0.95, 0);

      // 2 Ascending Spectral Halo Rings
      for (let k = 0; k < 2; k++) {
        const dly = k * 0.22;
        addMesh(this.geo.plane, 'wraith_soul_ring', k === 0 ? '#e879f9' : '#2dd4bf', 2.5, (m) => {
          m.rotation.x = -Math.PI * 0.5;
        }, (m, mat, t) => {
          const lt = clamp01((t - dly) / Math.max(0.15, 0.82 - dly));
          if (t < dly || lt >= 1) { m.visible = false; return; }
          m.visible = true;
          const e = easeOutCubic(lt);
          const s = 1.6 + e * 5.8;
          m.scale.set(s, s, 1);
          m.position.y = gyOffset + 0.15 + e * 2.4;
          m.rotation.z = (k === 0 ? 1 : -1) * lt * 4.5;
          mat.opacity = clamp01(Math.min(lt * 7, (1 - lt) * 2.4));
        }, true);
      }

      // Towering Phantom Skull Aura hovering over Wraith Form
      addBillboardFlare(
        'phantom_skull_emblem', '#090314', '#2dd4bf', 2.5,
        (t) => ({ x: 0, y: 1.7 + easeOutCubic(t) * 1.6, z: 0 }),
        (t) => 1.5 + Math.sin(clamp01(t) * Math.PI) * 1.4,
        (t) => clamp01(Math.min(t * 6.0, (1 - t) * 2.4)),
        0
      );

      // 4 Orbiting Lifesteal Soul Wisps spiraling into the Reaper
      for (let i = 0; i < 4; i++) {
        const off = (i / 4) * Math.PI * 2;
        addBillboardFlare(
          'soul_harvest_flare', '#100320', i % 2 === 0 ? '#f43f5e' : '#e879f9', 2.5,
          (t) => {
            const r = 3.4 * (1 - easeInOutQuad(t) * 0.85);
            const a = off + t * 5.5;
            return { x: Math.cos(a) * r, y: 0.9 + t * 1.2, z: Math.sin(a) * r };
          },
          (t) => 1.3 - t * 0.45,
          (t) => clamp01(Math.min(t * 7, (1 - t) * 2.6)),
          6.0
        );
      }

      spawnSparks(22, { originY: 0.9, inward: true, ringRadius: 3.5, speedMin: 2.2, speedMax: 4.5, upBias: 2.2 });

    // ========================================================================
    // 5. [R/AD] HELMET SKILL - Phantom Skull Swarm (3 Fanned Necro Portals!)
    // ========================================================================
    } else if (effectId === 'reaper_helmet') {
      duration = 0.98;

      // Ground Necromancer Summoning Circle
      addDualGround('reaper_necro_circle', '#090314', '#a855f7', 2.4, 0.02, 2.2, 5.8, 3.2, 0, 0.85);

      // 3 Fanned Summoning Portals & Surging Phantom Skulls matching server (-0.4, 0, +0.4 rad)
      const fanAngles = [-0.4, 0, 0.4];
      const fanColors = ['#e879f9', '#f0abfc', '#2dd4bf'];

      for (let i = 0; i < 3; i++) {
        const ang = fanAngles[i];
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);
        const delay = i === 1 ? 0.0 : 0.06;
        const hex = fanColors[i];

        // Vertical summoning gate ring oriented perpendicular to launch vector
        addMesh(this.geo.plane, 'wraith_soul_ring', hex, 2.6, (m) => {
          m.position.set(sinA * 1.35, 1.25, cosA * 1.35);
          m.rotation.y = ang;
        }, (m, mat, t) => {
          const lt = clamp01((t - delay) / 0.72);
          if (t < delay || lt >= 1) { m.visible = false; return; }
          m.visible = true;
          const s = 0.9 + easeOutCubic(lt) * 1.85;
          m.scale.set(s, s, 1);
          m.rotation.z = lt * (i === 1 ? 5.5 : -5.5);
          mat.opacity = clamp01(Math.min(lt * 8, (1 - lt) * 2.5));
        }, true);

        // Surging Phantom Reaper Skull bursting forward from each portal!
        addBillboardFlare(
          'phantom_skull_emblem', '#090314', hex, 2.7,
          (t) => {
            const lt = clamp01((t - delay) / 0.82);
            const dist = 1.15 + easeOutCubic(lt) * 4.4;
            return {
              x: sinA * dist,
              y: 1.25 + Math.sin(lt * Math.PI * 2.0) * 0.22,
              z: cosA * dist
            };
          },
          (t) => {
            const lt = clamp01((t - delay) / 0.82);
            return t < delay ? 0 : (1.25 + Math.sin(lt * Math.PI) * 1.05);
          },
          (t) => {
            const lt = clamp01((t - delay) / 0.82);
            return t < delay ? 0 : clamp01(Math.min(lt * 9, (1 - lt) * 2.6));
          },
          0
        );

        // Trailing dark-violet spectral mist wake behind each skull
        addBillboardFlare(
          'wraith_mist_cloud', '#0b0316', '#9333ea', 2.1,
          (t) => {
            const lt = clamp01((t - delay) / 0.84);
            const dist = 0.85 + easeOutCubic(lt) * 3.5;
            return { x: sinA * dist, y: 1.20, z: cosA * dist };
          },
          (t) => (t < delay ? 0 : (1.1 + easeOutCubic(clamp01((t - delay) / 0.84)) * 1.8)),
          (t) => (t < delay ? 0 : clamp01(Math.min((t - delay) * 7, (1 - t) * 2.4)) * 0.78),
          3.2 * (i - 1)
        );
      }

      spawnSparks(20, { originZ: 1.6, originY: 1.25, spread: 1.6, forwardBias: 5.5, upBias: 1.4, speedMax: 5.5 });

    // ========================================================================
    // 6. [F/AS] TRINKET SKILL - Abyssal Grave Chains (Hell-Gate + 6 Chain Cage!)
    // ========================================================================
    } else if (effectId === 'reaper_trinket') {
      duration = 1.48;

      // Colossal 8.6m Cracked Underworld Hell-Gate Portal + Occult Rune Ring
      addDualGround('grave_portal_seal', '#070210', '#d946ef', 2.6, 0.02, 2.4, 8.8, 1.8, 0, 0.92);
      addDualGround('reaper_necro_circle', '#0b0318', '#9333ea', 2.2, 0.06, 2.0, 7.6, -2.2, 0.04, 0.80);
      addDualGround('wraith_mist_cloud', '#080212', '#a855f7', 2.0, 0.10, 2.2, 7.4, 1.4, 0.08, 0.72);

      // 6 Towering Erupting Underworld Chain Columns clamping INWARD like a spectral cage!
      const chainColors = ['#e879f9', '#a855f7', '#2dd4bf', '#f43f5e', '#c084fc', '#e879f9'];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.25;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const dly = 0.04 + (i % 3) * 0.045;
        const hex = chainColors[i];

        addCrossedChain(
          (t) => {
            const lt = clamp01((t - dly) / Math.max(0.15, 0.90 - dly));
            const e = easeOutCubic(lt);
            const rad = 3.7 - e * 1.15; // clamps inward to telegraph Root + Pull!
            const h = 0.6 + e * 5.2;
            return { x: cosA * rad, y: gyOffset + h * 0.45, z: sinA * rad };
          },
          (t) => {
            const lt = clamp01((t - dly) / Math.max(0.15, 0.90 - dly));
            const lean = 0.34 - easeOutCubic(lt) * 0.12;
            // Tilt each chain column slightly inward toward center
            return { x: sinA * lean, y: -ang, z: -cosA * lean };
          },
          () => 1.25,
          (t) => {
            const lt = clamp01((t - dly) / Math.max(0.15, 0.90 - dly));
            return t < dly ? 0 : (0.7 + easeOutCubic(lt) * 5.1);
          },
          hex, 2.6,
          (t) => (t < dly ? 0 : clamp01(Math.min((t - dly) * 8.5, (1 - t) * 2.5)))
        );
      }

      // Central Abyssal Soul Vortex Pillar roaring up from the Hell-Gate
      addSoulVortex(gyOffset, 5.4, 1.38, '#d946ef', '#2dd4bf', 0.92, 0.06);

      // 2 Shockwaves: outer expanding rupture + inner clamping pull ring!
      addDualGround('wraith_soul_ring', '#0d031c', '#f0abfc', 2.5, 0.14, 1.8, 8.6, 3.0, 0.05, 0.72);
      addMesh(this.geo.plane, 'wraith_soul_ring', '#2dd4bf', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.y = gyOffset + 0.22;
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.14) / 0.78);
        if (t < 0.14 || lt >= 1) { m.visible = false; return; }
        m.visible = true;
        const s = 8.4 - easeInOutQuad(lt) * 6.4;
        m.scale.set(s, s, 1);
        m.rotation.z = -lt * 5.2;
        mat.opacity = clamp01(Math.min(lt * 7, (1 - lt) * 2.4));
      }, true);

      // 3 Howling Phantom Skulls erupting spirally from the underworld pit!
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const sAng = (sIdx / 3) * Math.PI * 2;
        const sDly = 0.10 + sIdx * 0.07;
        addBillboardFlare(
          'phantom_skull_emblem', '#090314', sIdx === 1 ? '#2dd4bf' : '#e879f9', 2.6,
          (t) => {
            const lt = clamp01((t - sDly) / 0.80);
            const a = sAng + lt * 3.4;
            const r = 1.65 * (1 - lt * 0.45);
            return { x: Math.cos(a) * r, y: gyOffset + 0.7 + easeOutCubic(lt) * 3.8, z: Math.sin(a) * r };
          },
          (t) => (t < sDly ? 0 : (1.35 + Math.sin(clamp01((t - sDly) / 0.80) * Math.PI) * 1.15)),
          (t) => (t < sDly ? 0 : clamp01(Math.min((t - sDly) * 7.5, (1 - t) * 2.4))),
          0
        );
      }

      spawnSparks(30, { originY: 0.4, inward: true, ringRadius: 4.0, speedMin: 2.0, speedMax: 4.5, upBias: 4.2, gravity: -1.4 });

    // ========================================================================
    // 7. MOBILITY - Wraith Float Fly / Shadow Air Dash
    // ========================================================================
    } else if (effectId === 'reaper_mobility_wraith') {
      duration = 0.52;
      addDualGround('wraith_mist_cloud', '#090314', '#9333ea', 2.2, 0.05, 1.5, 3.8, 3.0, 0, 0.84);
      addDualGround('wraith_soul_ring', '#0d031c', '#2dd4bf', 2.4, 0.09, 1.1, 3.6, -4.0, 0.03, 0.72);
      addDualGround('reaper_necro_circle', '#0b0318', '#e879f9', 2.0, 0.02, 1.3, 2.9, 2.2, 0, 0.68);
      spawnSparks(10, { originY: 0.65, spread: 0.9, upBias: 2.2, speedMax: 4.4 });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      sparks,
      age: 0,
      duration,
      attachToCaster,
      playerId: opts.playerId || null
    });
  }

  update(dt, stateOrPlayers) {
    if (!this.activeEffects.length) return;
    const players = stateOrPlayers && stateOrPlayers.players
      ? stateOrPlayers.players
      : stateOrPlayers;

    const findPlayer = (pid) => {
      if (!pid || !players) return null;
      if (players instanceof Map) return players.get(pid) || null;
      if (Array.isArray(players)) return players.find((p) => p.id === pid) || null;
      return players[pid] || null;
    };

    const camQuat = this.camera ? this.camera.quaternion : null;

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.age += dt;
      const t = fx.age / fx.duration;

      if (t >= 1) {
        this.disposeEffect(fx);
        this.activeEffects.splice(i, 1);
        continue;
      }

      if (fx.attachToCaster && fx.playerId) {
        const caster = findPlayer(fx.playerId);
        if (caster) {
          fx.root.position.set(caster.x, caster.y, caster.z);
        }
      }

      for (const p of fx.parts) {
        if (p.update) p.update(p.mesh, p.mat, t, fx.age);
        if (p.mesh.userData.billboard && camQuat) {
          p.mesh.quaternion.copy(camQuat);
          if (p.mesh.userData.billboardRoll) {
            p.mesh.rotateZ(p.mesh.userData.billboardRoll);
          }
        }
      }

      for (const sp of fx.sparks) {
        const localAge = fx.age - sp.delay;
        if (localAge <= 0) {
          sp.mesh.visible = false;
          continue;
        }
        const spLife = Math.max(0.14, fx.duration - sp.delay);
        const st = clamp01(localAge / spLife);
        if (st >= 1) {
          sp.mesh.visible = false;
          continue;
        }
        sp.mesh.visible = true;
        sp.mesh.position.set(
          sp.ox + sp.vx * localAge,
          sp.oy + sp.vy * localAge + 0.5 * sp.gravity * localAge * localAge,
          sp.oz + sp.vz * localAge
        );
        const shrink = 1.0 - st * 0.62;
        sp.mesh.scale.set(sp.size * 0.72 * shrink, sp.size * 1.45 * shrink, 1);
        sp.mat.opacity = (1 - st) * 0.95;
        if (camQuat) {
          sp.mesh.quaternion.copy(camQuat);
        }
      }
    }
  }

  disposeEffect(fx) {
    this.group.remove(fx.root);
    for (const p of fx.parts) {
      if (p.mat) p.mat.dispose();
    }
    for (const sp of fx.sparks) {
      if (sp.mat) sp.mat.dispose();
    }
  }

  dispose() {
    for (const fx of this.activeEffects) {
      this.disposeEffect(fx);
    }
    this.activeEffects = [];
    for (const g of Object.values(this.geo)) {
      if (g && g.dispose) g.dispose();
    }
    for (const tex of Object.values(this.textures)) {
      if (tex && tex.dispose) tex.dispose();
    }
    this.scene.remove(this.group);
  }
}
