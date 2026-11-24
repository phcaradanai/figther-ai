// ============================================================================
// LOST SAGA 3D - IRON KNIGHT 3D EFFEKSEER + THREE.JS HDR-BLOOM VFX SYSTEM
// ============================================================================
// Integrates Iron Knight's 7-move Effekseer 3D VFX suite directly into
// ThreeRenderer (public/js/three/renderer3d.js):
//   1. PRIMARY: Plays compiled EffekseerForWebGL (.efkefc) effects synced 1:1
//      to ThreeRenderer's THREE.PerspectiveCamera.
//   2. NATIVE 3D THREE.JS FALLBACK: If .efkefc / effekseer.wasm hasn't been
//      compiled via tools\build_knight_vfx.bat yet, renders true 3D Three.js
//      meshes (cones, cylinders, hex shield walls, vertical Excalibur waves,
//      rotating ground runes, sunbeam pillars & 3D sparks) using our 10 custom
//      512x512 Knight PNG textures with UnrealBloom HDR & real 3D depth test!
// ============================================================================
import * as THREE from 'three';

const TEX_NAMES = [
  'slash_crescent',
  'holy_rune_circle',
  'hex_aegis_shield',
  'lion_crest_roar',
  'shockwave_ring',
  'starburst_flare',
  'energy_ribbon',
  'soft_glow',
  'holy_spark',
  'heal_cross'
];

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function hdrColor(hex, intensity = 1.8) {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

export class KnightThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'KnightThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    // Shared low-allocation 3D geometries
    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      cylinder: new THREE.CylinderGeometry(0.96, 1.0, 1.0, 28, 1, true),
      cone: new THREE.ConeGeometry(1.0, 1.0, 28, 1, true)
    };
    // Align cone tip forward along +Z, skirt back along -Z
    this.geo.cone.rotateX(Math.PI * 0.5);

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/knight/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'energy_ribbon') {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
      }
      this.textures[name] = tex;
    }
  }

  makeMat(texName, hex, intensity = 1.9, opacity = 1.0, additive = true) {
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
   * Handle server FX events for Iron Knight (including stolen Knight gear skills!).
   * Returns true if handled/suppressed by the Knight 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (!mapped) {
      return bridge.shouldSuppressLegacyVfx(fx);
    }

    // 1. Try real 3D EffekseerForWebGL (.efkefc) first!
    const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
    if (!playedEffekseer) {
      // 2. Native True 3D Three.js HDR-Bloom VFX using our 10 512x512 textures!
      this.spawnThreeEffect(mapped.effectId, mapped);
    }

    // Subtle impactful camera shakes for Knight's signature moves
    if (mapped.effectId === 'heavy_shield_bash') this.shake(7);
    else if (mapped.effectId === 'knight_weapon') this.shake(5);
    else if (mapped.effectId === 'knight_armor') this.shake(6);
    else if (mapped.effectId === 'knight_helmet') this.shake(6);
    else if (mapped.effectId === 'knight_trinket') this.shake(4);
    else if (mapped.effectId === 'basic_slash' && mapped.isFinisher) this.shake(4);

    return true;
  }

  spawnThreeEffect(effectId, opts) {
    const root = new THREE.Group();
    const x = opts.x || 0;
    const y = opts.y || 0;
    const z = opts.z || 0;
    const facing = typeof opts.facing === 'number' ? opts.facing : 0;
    // Align local +Z with server facing (cos(facing), sin(facing))
    const yaw = Math.PI * 0.5 - facing;
    const scale = opts.scale || 1.0;

    root.position.set(x, y, z);
    root.rotation.y = yaw;
    root.scale.setScalar(scale);
    this.group.add(root);

    const gyOffset = this.groundY(x, y, z) - y + 0.04;
    const parts = [];
    const sparks = [];
    let duration = 0.7;
    let attachToCaster = false;

    const addMesh = (geo, texName, hex, intensity, initFn, updateFn, additive = true) => {
      const mat = this.makeMat(texName, hex, intensity, 1.0, additive);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = additive ? 19 : 17;
      if (initFn) initFn(mesh);
      root.add(mesh);
      parts.push({ mesh, mat, update: updateFn });
      return mesh;
    };

    const addSparkBurst = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const isHeal = !!cfg.isHeal;
        const mat = this.makeMat(isHeal ? 'heal_cross' : 'holy_spark', cfg.color, cfg.intensity || 2.1, 1.0);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = 20;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.4);
        const spd = (cfg.speedMin || 1.8) + Math.random() * (cfg.speedMax || 4.8);
        const vx = Math.cos(ang) * spd + (cfg.forwardBias ? 0 : 0);
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin || 1.5) + Math.random() * (cfg.vyMax || 4.0);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy || 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.4);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || 0.35) * (0.75 + Math.random() * 0.6);
        mesh.scale.set(isHeal ? sz : sz * 0.55, isHeal ? sz : sz * 1.4, 1);
        root.add(mesh);
        sparks.push({
          mesh, mat,
          ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : -9.0,
          delay: Math.random() * (cfg.maxDelay || 0.14),
          isHeal,
          baseSz: sz
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC BROADWORD SLASH (3-hit combo + finisher overhead slam)
    // ------------------------------------------------------------------------
    if (effectId === 'basic_slash') {
      duration = opts.isFinisher ? 0.52 : 0.42;
      const swingDir = (opts.comboStep % 2 === 0) ? -1 : 1;

      // High-contrast Deep Sapphire Slash Backing (pops sharply on bright stone!)
      addMesh(this.geo.plane, 'slash_crescent', '#1d4ed8', 1.0, (m) => {
        m.position.set(0, 1.01, 0.42);
      }, (m, mat, t, ease) => {
        if (opts.isFinisher) {
          m.rotation.set(0, -Math.PI * 0.5, -0.9 + ease * 1.5);
          m.position.set(0, 1.32 - ease * 0.32, 0.72 + ease * 0.38);
          const s = 3.1 + ease * 1.6;
          m.scale.set(s, s, 1);
        } else {
          m.rotation.set(-Math.PI * 0.47, 0, swingDir * (-1.1 + ease * 1.95) - Math.PI * 0.5);
          const s = 2.95 + ease * 1.25;
          m.scale.set(s, s, 1);
        }
        mat.opacity = clamp01(1 - t) * 0.9;
      }, false);

      // Primary Golden Crescent Arc (3D plane sweeping around +Z)
      addMesh(this.geo.plane, 'slash_crescent', '#f59e0b', 2.4, (m) => {
        m.position.set(0, 1.08, 0.45);
        m.rotation.x = -Math.PI * 0.46;
        if (opts.isFinisher) m.rotation.order = 'YXZ';
      }, (m, mat, t, ease) => {
        if (opts.isFinisher) {
          m.rotation.set(0, -Math.PI * 0.5, -0.8 + ease * 1.5);
          m.position.set(0, 1.35 - ease * 0.35, 0.75 + ease * 0.4);
          const s = 2.9 + ease * 1.5;
          m.scale.set(s, s, 1);
        } else {
          m.rotation.set(-Math.PI * 0.46, 0, swingDir * (-0.95 + ease * 1.95) - Math.PI * 0.5);
          const s = 2.7 + ease * 1.2;
          m.scale.set(s, s, 1);
        }
        mat.opacity = clamp01((t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88) * 1.1);
      });

      // Sapphire Secondary Under-Arc
      addMesh(this.geo.plane, 'slash_crescent', '#38bdf8', 1.8, (m) => {
        m.position.set(0, 1.02, 0.40);
      }, (m, mat, t, ease) => {
        if (opts.isFinisher) {
          m.rotation.set(0, -Math.PI * 0.5, -1.0 + ease * 1.45);
          m.position.set(0.1, 1.30 - ease * 0.3, 0.65 + ease * 0.35);
          const s = 2.8 + ease * 1.5;
          m.scale.set(s, s, 1);
        } else {
          m.rotation.set(-Math.PI * 0.47, 0, swingDir * (-1.2 + ease * 1.9) - Math.PI * 0.5);
          const s = 2.7 + ease * 1.15;
          m.scale.set(s, s, 1);
        }
        mat.opacity = clamp01(1 - t) * 0.85;
      });

      // Impact Tip Starburst Flare
      addMesh(this.geo.plane, 'starburst_flare', '#fef08a', 2.4, (m) => {
        m.position.set(0, 1.12, 1.65);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 0.6 + ease * (opts.isFinisher ? 2.4 : 1.5);
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.4);
      });

      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'shockwave_ring', '#fbbf24', 2.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset, 1.55);
        }, (m, mat, t, ease) => {
          const s = 0.8 + ease * 3.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t);
        });
      }

      addSparkBurst(opts.isFinisher ? 20 : 12, {
        color: '#fde047', ox: 0, oy: 1.05, oz: 1.35,
        forwardBias: 3.8, speedMin: 1.5, speedMax: 4.5, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: SHIELD BASH (Guard Break!)
    // ------------------------------------------------------------------------
    else if (effectId === 'heavy_shield_bash') {
      duration = 0.68;

      // Primary Royal Sapphire Contrast Backing + Luminous Hex Aegis Shield Crest
      addMesh(this.geo.plane, 'hex_aegis_shield', '#1d4ed8', 1.0, null, (m, mat, t, ease) => {
        m.position.set(0, 1.08, 0.50 + ease * 1.75);
        const s = 0.9 + ease * 2.45;
        m.scale.set(s, s, 1);
        m.rotation.z = -0.2 + ease * 0.3;
        mat.opacity = clamp01((t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9)) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'hex_aegis_shield', '#38bdf8', 2.4, null, (m, mat, t, ease) => {
        m.position.set(0, 1.08, 0.55 + ease * 1.75);
        const s = 0.82 + ease * 2.3;
        m.scale.set(s, s, 1);
        m.rotation.z = -0.2 + ease * 0.3;
        mat.opacity = clamp01((t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9));
      });

      // Golden Guard-Break Echo Crest ahead
      addMesh(this.geo.plane, 'hex_aegis_shield', '#fbbf24', 2.2, null, (m, mat, t, ease) => {
        m.position.set(0, 1.08, 0.85 + ease * 2.1);
        const s = 0.95 + ease * 2.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.88;
      });

      // Forward Vertical Sonic Shockwave Ring
      addMesh(this.geo.plane, 'shockwave_ring', '#fde047', 2.1, null, (m, mat, t, ease) => {
        m.position.set(0, 1.08, 1.15 + ease * 1.45);
        const s = 0.8 + ease * 3.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.15);
      });

      // Ground Bracing Shockwave Ring
      addMesh(this.geo.plane, 'shockwave_ring', '#f59e0b', 1.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 1.25);
      }, (m, mat, t, ease) => {
        const s = 0.7 + ease * 3.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      // Guard-Break Starburst Flash
      addMesh(this.geo.plane, 'starburst_flare', '#fff7cc', 2.6, (m) => {
        m.position.set(0, 1.08, 1.65);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 0.9 + ease * 2.7;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.6);
      });

      addSparkBurst(22, {
        color: '#fde047', ox: 0, oy: 1.05, oz: 1.5,
        forwardBias: 5.5, speedMin: 2.0, speedMax: 5.2, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: EXCALIBUR WAVE
    // ------------------------------------------------------------------------
    else if (effectId === 'knight_weapon') {
      duration = 1.05;

      // Ground Rotating Paladin Sanctuary Rune Circle (rich gold backing + HDR glow!)
      addMesh(this.geo.plane, 'holy_rune_circle', '#b45309', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 4.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.9;
      }, false);
      addMesh(this.geo.plane, 'holy_rune_circle', '#fbbf24', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.02, 0);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 4.2;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92));
      });

      // 4-Layer Towering Vertical Golden Excalibur Blade Wave rushing along +Z!
      const bladeSpecs = [
        { ox: 0, ry: -Math.PI * 0.5, col: '#d97706', k: 1.0, sx: 1.22, sy: 1.22, add: false },
        { ox: 0, ry: -Math.PI * 0.5, col: '#fff7cc', k: 2.8, sx: 1.05, sy: 1.05, add: true },
        { ox: -0.26, ry: -Math.PI * 0.44, col: '#f59e0b', k: 2.2, sx: 1.18, sy: 1.18, add: true },
        { ox: 0.26, ry: -Math.PI * 0.56, col: '#f59e0b', k: 2.2, sx: 1.18, sy: 1.18, add: true }
      ];
      for (const b of bladeSpecs) {
        addMesh(this.geo.plane, 'slash_crescent', b.col, b.k, (m) => {
          m.rotation.y = b.ry;
        }, (m, mat, t, ease) => {
          const travel = 0.9 + t * 14.5;
          m.position.set(b.ox, 1.48 + t * 0.25, travel);
          const sw = (2.4 + ease * 2.5) * b.sx;
          const sh = (2.8 + ease * 3.0) * b.sy;
          m.scale.set(sw, sh, 1);
          mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.max(0, (t - 0.65) / 0.35)));
        }, b.add);
      }

      // Sweeping Ground Energy Wake following beneath Excalibur Wave
      addMesh(this.geo.plane, 'shockwave_ring', '#fde047', 1.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
      }, (m, mat, t, ease) => {
        m.position.set(0, gyOffset + 0.02, 1.2 + t * 13.5);
        const s = 1.2 + ease * 2.4;
        m.scale.set(s, s * 1.4, 1);
        mat.opacity = clamp01(1 - t);
      });

      // Cast Starburst Flash
      addMesh(this.geo.plane, 'starburst_flare', '#fff7cc', 2.6, (m) => {
        m.position.set(0, 1.35, 0.95);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.0 + ease * 3.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 2.2);
      });

      addSparkBurst(26, {
        color: '#fde047', ox: 0, oy: 1.1, oz: 1.5,
        forwardBias: 8.5, speedMin: 1.2, speedMax: 4.5, vyMin: 1.8, vyMax: 5.0, gravity: -4.0, size: 0.38
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: AEGIS FORTRESS (3D Dome + 6 Hex Shield Wall + Knockback)
    // ------------------------------------------------------------------------
    else if (effectId === 'knight_armor') {
      duration = 1.45;
      attachToCaster = true;

      // Rotating Royal Sapphire Sanctuary Rune Circle (Normal contrast + HDR glow!)
      addMesh(this.geo.plane, 'holy_rune_circle', '#1d4ed8', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 5.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'holy_rune_circle', '#38bdf8', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.02, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 4.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92));
      });

      // Instant Radial Knockback Shockwave Ring (~3.8m)
      addMesh(this.geo.plane, 'shockwave_ring', '#0284c7', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.14, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.45);
        const s = 1.1 + easeOutCubic(wt) * 7.8;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.9 : 0;
      }, false);

      // 3D Cylindrical Aegis Barrier Energy Dome (deep sapphire + cyan HDR!)
      addMesh(this.geo.cylinder, 'energy_ribbon', '#1d4ed8', 1.0, (m) => {
        m.position.set(0, 1.2, 0);
      }, (m, mat, t, ease) => {
        const r = 1.0 + ease * 1.55;
        const h = 1.2 + ease * 1.75;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = -t * 2.8;
        mat.opacity = clamp01((t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9)) * 0.65;
      }, false);
      addMesh(this.geo.cylinder, 'energy_ribbon', '#38bdf8', 2.0, (m) => {
        m.position.set(0, 1.2, 0);
      }, (m, mat, t, ease) => {
        const r = 0.95 + ease * 1.5;
        const h = 1.15 + ease * 1.65;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = t * 2.2;
        mat.opacity = clamp01((t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9)) * 0.85;
      });

      // 6-Sided 3D Hexagonal Shield Wall orbiting Knight (crisp royal blue & gold!)
      const shieldRing = new THREE.Group();
      shieldRing.position.set(0, 1.22, 0);
      root.add(shieldRing);
      const wallMats = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const bgMat = this.makeMat('hex_aegis_shield', i % 2 === 0 ? '#1d4ed8' : '#d97706', 1.0, 0.92, false);
        const bgPanel = new THREE.Mesh(this.geo.plane, bgMat);
        bgPanel.position.set(Math.sin(ang) * 1.92, 0, Math.cos(ang) * 1.92);
        bgPanel.rotation.y = ang;
        bgPanel.scale.setScalar(1.35);
        bgPanel.renderOrder = 18;
        shieldRing.add(bgPanel);
        wallMats.push(bgMat);

        const mat = this.makeMat('hex_aegis_shield', i % 2 === 0 ? '#7dd3fc' : '#fde047', 2.1, 1.0, true);
        const panel = new THREE.Mesh(this.geo.plane, mat);
        panel.position.set(Math.sin(ang) * 1.95, 0, Math.cos(ang) * 1.95);
        panel.rotation.y = ang;
        panel.scale.setScalar(1.32);
        panel.renderOrder = 19;
        shieldRing.add(panel);
        wallMats.push(mat);
      }
      parts.push({
        mesh: shieldRing,
        mat: wallMats[0],
        extraMats: wallMats.slice(1),
        update: (g, _m, t, ease) => {
          g.rotation.y = t * 1.4;
          const sc = 0.45 + ease * 0.85;
          g.scale.setScalar(sc);
          const op = clamp01((t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9)) * 0.92;
          for (const wm of wallMats) wm.opacity = op;
        }
      });

      addSparkBurst(26, {
        color: '#fde047', radius: 1.65, oy: 0.25, oySpread: 0.3,
        speedMin: 0.4, speedMax: 1.4, vyMin: 2.2, vyMax: 4.5, gravity: 0.5, maxDelay: 0.45, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: LIONHEART WARCRY (Roar Waves + Sunbeam Pillar + Heal Crosses)
    // ------------------------------------------------------------------------
    else if (effectId === 'knight_helmet') {
      duration = 1.25;
      attachToCaster = true;

      // Giant Expanding Rotating Golden Lion Crest on the floor (high-contrast amber + HDR gold!)
      addMesh(this.geo.plane, 'lion_crest_roar', '#b45309', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.02, 0);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 7.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 1.3;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'lion_crest_roar', '#f59e0b', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 7.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 1.3;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92));
      });

      // 3 Pulsing Golden Sonic Stun Shockwaves (~4.3m)
      for (let w = 0; w < 3; w++) {
        const delay = w * 0.14;
        addMesh(this.geo.plane, 'shockwave_ring', '#fde047', 2.2, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, 0.95, 0);
        }, (m, mat, t) => {
          const wt = (t - delay) / 0.55;
          if (wt <= 0 || wt >= 1) { mat.opacity = 0; return; }
          const s = 1.0 + easeOutCubic(wt) * 7.8;
          m.scale.set(s, s, 1);
          mat.opacity = (1 - wt) * 0.92;
        });
      }

      // 3D Vertical Golden Sunbeam Pillar shooting 5.4m skyward!
      addMesh(this.geo.cylinder, 'energy_ribbon', '#fbbf24', 2.2, (m) => {
        m.position.set(0, 2.5, 0);
      }, (m, mat, t, ease) => {
        const r = 0.55 + ease * 0.9;
        const h = 2.4 + ease * 3.2;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5;
        m.rotation.y = t * 3.5;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.85;
      });

      // Warcry Starburst Flare
      addMesh(this.geo.plane, 'starburst_flare', '#fff7cc', 2.6, (m) => {
        m.position.set(0, 1.25, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.2 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 2.2);
      });

      // Rising Emerald-Gold +20 HP Healing Crosses!
      addSparkBurst(18, {
        isHeal: true, color: '#86efac', intensity: 2.0,
        radius: 1.25, oy: 0.35, oySpread: 0.4,
        speedMin: 0.2, speedMax: 0.7, vyMin: 2.0, vyMax: 3.6, gravity: 0.4, maxDelay: 0.38, size: 0.44
      });

      // Outward Golden Stun Sparks
      addSparkBurst(20, {
        color: '#fde047', radius: 0.4, oy: 1.1,
        speedMin: 3.5, speedMax: 7.2, vyMin: 0.8, vyMax: 2.5, gravity: -4.0, maxDelay: 0.12, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: CHARIOT RUSH (3D Aerodynamic Wind Ram Cone!)
    // ------------------------------------------------------------------------
    else if (effectId === 'knight_trinket') {
      duration = 0.98;
      attachToCaster = true;

      // Outer Deep Royal Sapphire + Cyan 3D Wind-Breaking Ram Cone (real ConeGeometry!)
      addMesh(this.geo.cone, 'energy_ribbon', '#1d4ed8', 1.0, (m) => {
        m.position.set(0, 1.05, 0.95);
      }, (m, mat, t, ease) => {
        const r = 0.95 + ease * 1.1;
        const l = 2.3 + ease * 1.6;
        m.scale.set(r, r, l);
        m.rotation.z = t * 9.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.85;
      }, false);
      addMesh(this.geo.cone, 'energy_ribbon', '#38bdf8', 2.2, (m) => {
        m.position.set(0, 1.05, 0.98);
      }, (m, mat, t, ease) => {
        const r = 0.9 + ease * 1.02;
        const l = 2.2 + ease * 1.5;
        m.scale.set(r, r, l);
        m.rotation.z = t * 9.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.95;
      });

      // Inner Golden Core Ram Cone counter-rotating!
      addMesh(this.geo.cone, 'energy_ribbon', '#f59e0b', 2.5, (m) => {
        m.position.set(0, 1.05, 1.18);
      }, (m, mat, t, ease) => {
        const r = 0.55 + ease * 0.72;
        const l = 1.8 + ease * 1.2;
        m.scale.set(r, r, l);
        m.rotation.z = -t * 13.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.98;
      });

      // Front Glowing Hex Shield Ram Crest (deep sapphire + bright cyan!)
      addMesh(this.geo.plane, 'hex_aegis_shield', '#1e40af', 1.0, (m) => {
        m.position.set(0, 1.05, 1.72);
      }, (m, mat, t, ease) => {
        const s = 1.25 + ease * 1.15;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'hex_aegis_shield', '#7dd3fc', 2.4, (m) => {
        m.position.set(0, 1.05, 1.78);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 1.1;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92));
      });

      // 3 Receding Mach Sonic Rings rushing backward along -Z
      for (let r = 0; r < 3; r++) {
        addMesh(this.geo.plane, 'shockwave_ring', '#bae6fd', 2.0, null, (m, mat, t) => {
          const rt = (t * 3.0 + r * 0.33) % 1.0;
          m.position.set(0, 1.05, 1.4 - rt * 2.8);
          const s = 1.0 + rt * 1.7;
          m.scale.set(s, s, 1);
          mat.opacity = (1 - rt) * clamp01(1 - t * 0.9) * 0.9;
        });
      }

      // Streaming Speed-Line & Boot Friction Sparks
      addSparkBurst(26, {
        color: '#7dd3fc', radius: 0.8, oy: 0.9, oz: 1.2,
        forwardBias: -8.5, speedMin: 0.5, speedMax: 2.0, vyMin: -0.3, vyMax: 1.2, gravity: -1.5, maxDelay: 0.55, size: 0.35
      });
    }

    // ------------------------------------------------------------------------
    // 7. SHIELD GUARD / PERFECT PARRY IMPACT
    // ------------------------------------------------------------------------
    else if (effectId === 'guard_parry') {
      duration = 0.52;

      addMesh(this.geo.plane, 'hex_aegis_shield', '#7dd3fc', 2.4, (m) => {
        m.position.set(0, 1.08, 0.85);
      }, (m, mat, t, ease) => {
        const s = 0.7 + ease * 1.55;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'shockwave_ring', '#38bdf8', 2.2, (m) => {
        m.position.set(0, 1.08, 0.90);
      }, (m, mat, t, ease) => {
        const s = 0.6 + ease * 2.3;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.1);
      });

      addMesh(this.geo.plane, 'starburst_flare', '#ffffff', 2.8, (m) => {
        m.position.set(0, 1.08, 0.95);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 0.8 + ease * 2.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.8);
      });

      addSparkBurst(16, {
        color: '#fde047', ox: 0, oy: 1.08, oz: 0.95,
        forwardBias: 2.2, speedMin: 2.2, speedMax: 5.5, size: 0.32
      });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      sparks,
      age: 0,
      duration,
      attachToCaster: attachToCaster && !!opts.playerId,
      playerId: opts.playerId || null
    });
  }

  update(dt, gameState) {
    if (this.activeEffects.length === 0) return;

    const playerMap = new Map();
    if (gameState && gameState.players) {
      for (const pl of gameState.players) playerMap.set(pl.id, pl);
    }

    const invRootQ = new THREE.Quaternion();

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.age += dt;
      if (fx.age >= fx.duration) {
        this.disposeEffect(fx);
        this.activeEffects.splice(i, 1);
        continue;
      }

      if (fx.attachToCaster && fx.playerId) {
        const pl = playerMap.get(fx.playerId);
        if (pl && pl.state !== 'dead') {
          fx.root.position.set(pl.x, pl.y, pl.z);
          if (fx.id === 'knight_trinket' && typeof pl.facing === 'number') {
            fx.root.rotation.y = Math.PI * 0.5 - pl.facing;
          }
        }
      }

      const t = fx.age / fx.duration;
      const ease = easeOutCubic(t);

      for (const p of fx.parts) {
        if (p.update) p.update(p.mesh, p.mat, t, ease);
      }

      invRootQ.copy(fx.root.quaternion).invert();
      for (const sp of fx.sparks) {
        const localT = fx.age - sp.delay;
        if (localT <= 0) {
          sp.mesh.visible = false;
          continue;
        }
        sp.mesh.visible = true;
        const st = clamp01(localT / Math.max(0.15, fx.duration - sp.delay));
        sp.mesh.position.set(
          sp.ox + sp.vx * localT,
          Math.max(0.06, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT),
          sp.oz + sp.vz * localT
        );
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);
        const sc = sp.isHeal ? (0.65 + st * 0.5) : (1.1 - st * 0.75);
        sp.mesh.scale.set(
          sp.baseSz * (sp.isHeal ? sc : sc * 0.55),
          sp.baseSz * (sp.isHeal ? sc : sc * 1.45),
          1
        );
        sp.mat.opacity = clamp01((1 - st) * 1.15);
      }
    }
  }

  disposeEffect(fx) {
    this.group.remove(fx.root);
    for (const p of fx.parts) {
      if (p.mat) p.mat.dispose();
      if (p.extraMats) {
        for (const em of p.extraMats) em.dispose();
      }
    }
    for (const sp of fx.sparks) {
      sp.mat.dispose();
    }
  }
}
