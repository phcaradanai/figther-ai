// ============================================================================
// LOST SAGA 3D - SHADOW NINJA 3D EFFEKSEER + THREE.JS HDR-BLOOM VFX SYSTEM
// ============================================================================
// Dedicated 7-move Shadow Ninja 3D VFX suite for ThreeRenderer:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep shadow-ink NormalBlending
//      silhouettes + electric violet/magenta/cyan/crimson Additive HDR Bloom
//      using our 10 custom 512x512 Ninja PNG textures!
// ============================================================================
import * as THREE from 'three';

const NINJA_TEX_NAMES = [
  'kunai_slash',
  'cross_fang',
  'shinobi_seal',
  'shadow_smoke',
  'shuriken_glint',
  'paper_talisman',
  'shadow_vortex',
  'shadow_ring',
  'crimson_flare',
  'kunai_spark'
];

const NINJA_EFFECT_IDS = new Set([
  'ninja_basic_slash',
  'ninja_heavy_backstab',
  'ninja_weapon',
  'ninja_armor',
  'ninja_helmet',
  'ninja_trinket',
  'ninja_mobility_shadowstep'
]);

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function hdrColor(hex, intensity = 2.0) {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

export class NinjaThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'NinjaThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      tornado: new THREE.CylinderGeometry(1.35, 0.72, 1.0, 28, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of NINJA_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/ninja/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'shadow_vortex') {
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

  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && NINJA_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'ninja_weapon') this.shake(7);
      else if (mapped.effectId === 'ninja_heavy_backstab') this.shake(6);
      else if (mapped.effectId === 'ninja_armor') this.shake(5);
      else if (mapped.effectId === 'ninja_trinket') this.shake(5);
      else if (mapped.effectId === 'ninja_helmet') this.shake(3);
      else if (mapped.effectId === 'ninja_basic_slash' && mapped.isFinisher) this.shake(4);

      return true;
    }

    // Suppress duplicate secondary ninja server FX events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'ninja') ||
      (fx.type === 'skill_cast' && fx.skillId === 'ninja_weapon') ||
      (fx.type === 'smoke' && fx.fromSkill === 'ninja_armor') ||
      (fx.type === 'explosion' && fx.fromSkill === 'ninja_trinket')
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
    let duration = 0.65;

    const addMesh = (geo, texName, hex, intensity, initFn, updateFn, additive = true) => {
      const mat = this.makeMat(texName, hex, intensity, 1.0, additive);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = additive ? 19 : 17;
      if (initFn) initFn(mesh);
      root.add(mesh);
      parts.push({ mesh, mat, update: updateFn });
      return mesh;
    };

    const addSparks = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const mat = this.makeMat(cfg.tex || 'kunai_spark', cfg.color, cfg.intensity || 2.2, 1.0, cfg.additive !== false);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = cfg.additive === false ? 17 : 20;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.45);
        const spd = (cfg.speedMin || 1.8) + Math.random() * (cfg.speedMax || 5.2);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin || 1.2) + Math.random() * (cfg.vyMax || 4.0);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy || 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.45);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || 0.34) * (0.75 + Math.random() * 0.65);
        root.add(mesh);
        sparks.push({
          mesh, mat, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : -8.0,
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.12),
          baseSz: sz,
          isCloud: cfg.tex === 'shadow_smoke',
          rotSpeed: (Math.random() - 0.5) * 3.5,
          rotInit: Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC DUAL KUNAI COMBO SLASH (4-hit rapid X-slash + 360 finisher!)
    // ------------------------------------------------------------------------
    if (effectId === 'ninja_basic_slash') {
      duration = opts.isFinisher ? 0.50 : 0.36;
      const swingDir = (opts.comboStep % 2 === 0) ? -1 : 1;

      // Deep Obsidian-Indigo Shadow Ink Backing (ultra crisp on sunlit stone!)
      addMesh(this.geo.plane, 'kunai_slash', '#120526', 1.0, (m) => {
        m.position.set(0, 1.02, 0.45);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.45, swingDir * 0.25, swingDir * (-1.1 + ease * 2.2) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 3.5 : 2.75) + ease * 1.25;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 0.95) * 0.96;
      }, false);

      // Electric Phantom Violet Blade Arc
      addMesh(this.geo.plane, 'kunai_slash', '#a855f7', 2.4, (m) => {
        m.position.set(0, 1.05, 0.48);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.45, swingDir * 0.25, swingDir * (-1.0 + ease * 2.2) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 3.2 : 2.45) + ease * 1.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      // Off-Hand Dark Ink + Cyan Counter-Kunai Arc (X-Slash!)
      addMesh(this.geo.plane, 'kunai_slash', '#0c1936', 1.0, (m) => {
        m.position.set(0, 0.99, 0.50);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.48, -swingDir * 0.28, -swingDir * (-0.95 + ease * 2.1) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 3.05 : 2.3) + ease * 1.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.05) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'kunai_slash', '#38bdf8', 2.2, (m) => {
        m.position.set(0, 1.01, 0.52);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.48, -swingDir * 0.28, -swingDir * (-0.95 + ease * 2.1) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 2.85 : 2.15) + ease * 1.05;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.1) * 0.95;
      });

      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'cross_fang', '#260414', 1.0, (m) => {
          m.position.set(0, 1.1, 1.22);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.15 + ease * 2.6;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.2) * 0.95;
        }, false);
        addMesh(this.geo.plane, 'cross_fang', '#f43f5e', 2.5, (m) => {
          m.position.set(0, 1.1, 1.26);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.0 + ease * 2.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.3);
        });
      }

      addSparks(opts.isFinisher ? 18 : 10, {
        color: '#c084fc', ox: 0, oy: 1.02, oz: 1.1,
        forwardBias: 4.0, speedMin: 1.5, speedMax: 4.5, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: SHADOW BACKSTAB (Lethal Crimson-Violet X-Cross Fang!)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_heavy_backstab') {
      duration = 0.68;

      // Dark Shadow Ink X-Cross Backing (ultra crisp on bright floor!)
      addMesh(this.geo.plane, 'cross_fang', '#1a0418', 1.0, (m) => {
        m.position.set(0, 1.12, 0.72);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.25 + ease * 3.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.98;
      }, false);

      // Blazing Crimson-Magenta Assassination X-Fang
      addMesh(this.geo.plane, 'cross_fang', '#f43f5e', 2.6, (m) => {
        m.position.set(0, 1.12, 0.78);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.05 + ease * 2.85;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // Floor Kuji-In Shadow Seal
      addMesh(this.geo.plane, 'shinobi_seal', '#16052c', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0.3);
      }, (m, mat, t, ease) => {
        const s = 1.0 + ease * 3.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.5;
        mat.opacity = clamp01(1 - t) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'shinobi_seal', '#e11d48', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.02, 0.3);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 3.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.5;
        mat.opacity = clamp01(1 - t);
      });

      // Hit Flare
      addMesh(this.geo.plane, 'crimson_flare', '#fb7185', 2.7, (m) => {
        m.position.set(0, 1.12, 0.85);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.0 + ease * 3.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.8);
      });

      // Dark Shadow Mist puffs + razor shards
      addSparks(8, {
        tex: 'shadow_smoke', additive: false, color: '#140628', intensity: 1.0,
        radius: 0.65, oy: 0.8, speedMin: 0.8, speedMax: 2.2, vyMin: 0.4, vyMax: 1.5, gravity: 0.2, size: 1.55
      });
      addSparks(22, {
        color: '#f43f5e', ox: 0, oy: 1.1, oz: 0.75,
        forwardBias: 3.5, speedMin: 2.2, speedMax: 6.0, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: IZUNA BLADE STORM (6-Hit Omnislash Cage + Shadow Tornado!)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_weapon') {
      duration = 1.15;

      // Ground Spinning Kuji-In Shinobi Seal — Deep Obsidian Ink Base + Crisp Violet Neon
      addMesh(this.geo.plane, 'shinobi_seal', '#130528', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.8;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.4))) * 0.98;
      }, false);
      addMesh(this.geo.plane, 'shinobi_seal', '#7c3aed', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 1.7 + ease * 5.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.8;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.4))) * 0.92;
      });

      // Outer 7m Storm Perimeter Shadow Ring (high-contrast obsidian + electric cyan!)
      addMesh(this.geo.plane, 'shadow_ring', '#120526', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 6.0;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 5.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.95;
      }, false);
      addMesh(this.geo.plane, 'shadow_ring', '#38bdf8', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.07, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 5.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.92;
      });

      // 3D Rising Shadow Cyclone Tornado (Ultra-deep obsidian-indigo core + vivid violet/cyan vortex!)
      addMesh(this.geo.tornado, 'shadow_vortex', '#0f0422', 1.0, null, (m, mat, t, ease) => {
        const r = 1.05 + ease * 1.95;
        const h = 1.8 + ease * 3.5;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = t * 11.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.4))) * 0.96;
      }, false);
      addMesh(this.geo.tornado, 'shadow_vortex', '#4c1d95', 1.0, null, (m, mat, t, ease) => {
        const r = 0.85 + ease * 1.55;
        const h = 2.0 + ease * 3.7;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = -t * 14.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.4))) * 0.92;
      }, false);
      addMesh(this.geo.tornado, 'shadow_vortex', '#38bdf8', 2.0, null, (m, mat, t, ease) => {
        const r = 0.72 + ease * 1.35;
        const h = 2.1 + ease * 3.8;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = -t * 17.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.72;
      });

      // 6 Rapid Multi-Angle Omnislash 3D Shadow Blades (EACH with dark ink silhouette + neon edge!)
      for (let i = 0; i < 6; i++) {
        const delay = i * 0.085;
        const rx = (i % 2 === 0 ? 0.52 : -0.52) + ((i % 3) - 1) * 0.18;
        const ry = (i / 6) * Math.PI * 2;
        const oy = 0.85 + (i % 3) * 0.72;
        const col = i % 3 === 0 ? '#f43f5e' : (i % 3 === 1 ? '#a855f7' : '#38bdf8');
        // Dark obsidian ink blade backing so every slash cuts crisply across bright floors!
        addMesh(this.geo.plane, 'kunai_slash', '#110424', 1.0, (m) => {
          m.position.set(Math.cos(ry) * 0.65, oy - 0.03, Math.sin(ry) * 0.65);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.48;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.rotation.set(rx, ry, -1.25 + le * 2.55);
          const s = 3.1 + le * 2.3;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt * 0.95) * 0.96;
        }, false);
        // Blazing neon blade core
        addMesh(this.geo.plane, 'kunai_slash', col, 2.5, (m) => {
          m.position.set(Math.cos(ry) * 0.65, oy, Math.sin(ry) * 0.65);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.48;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.rotation.set(rx, ry, -1.25 + le * 2.55);
          const s = 2.85 + le * 2.15;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.98;
        });
      }

      // 3 Center X-Cross Assassination Flashes (Dark crimson-ink backing + blazing X-fang!)
      for (let k = 0; k < 3; k++) {
        const delay = 0.06 + k * 0.18;
        const ox = (k - 1) * 0.9, oy = 1.05 + k * 0.55, oz = (k % 2 === 0 ? 0.5 : -0.5);
        addMesh(this.geo.plane, 'cross_fang', '#1a0418', 1.0, (m) => {
          m.position.set(ox, oy, oz - 0.05);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.42;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.45 + easeOutCubic(lt) * 2.8;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.96;
        }, false);
        addMesh(this.geo.plane, 'cross_fang', k === 2 ? '#f43f5e' : '#c084fc', 2.6, (m) => {
          m.position.set(ox, oy, oz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.42;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.3 + easeOutCubic(lt) * 2.6;
          m.scale.set(s, s, 1);
          mat.opacity = 1 - lt;
        });
      }

      // Ground dark ink smoke base + rising kunai sparks
      addSparks(10, {
        tex: 'shadow_smoke', additive: false, color: '#140628', intensity: 1.0,
        radius: 1.6, oy: 0.45, oySpread: 0.3,
        speedMin: 0.8, speedMax: 2.0, vyMin: 0.6, vyMax: 1.8, gravity: 0.0, maxDelay: 0.2, size: 2.1
      });
      addSparks(32, {
        color: '#c084fc', radius: 2.0, oy: 0.4, oySpread: 0.6,
        speedMin: 1.5, speedMax: 4.2, vyMin: 3.5, vyMax: 7.5, gravity: -2.0, maxDelay: 0.35, size: 0.40
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: SMOKE BOMB STEALTH (Volumetric Dark Indigo Smoke Dome!)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_armor') {
      duration = 1.35;

      // Ground Spinning Stealth Kuji-In Seal + Concussion Stun Shockwave (~3.8m)
      addMesh(this.geo.plane, 'shinobi_seal', '#130528', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 2.4;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.96;
      }, false);

      addMesh(this.geo.plane, 'shadow_ring', '#1c0738', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.05, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.45);
        const s = 1.2 + easeOutCubic(wt) * 7.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.96 : 0;
      }, false);

      addMesh(this.geo.plane, 'shadow_ring', '#a855f7', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.45);
        const s = 1.1 + easeOutCubic(wt) * 7.0;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Detonation Flash Core
      addMesh(this.geo.plane, 'crimson_flare', '#c084fc', 2.6, (m) => {
        m.position.set(0, 0.95, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.2 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 3.0);
      });

      // 18 Volumetric Deep Obsidian-Indigo Billowing Ninja Smoke Clouds (NormalBlending — HUGE visual pop!)
      addSparks(18, {
        tex: 'shadow_smoke', additive: false, color: '#140628', intensity: 1.0,
        radius: 1.5, oy: 0.8, oySpread: 0.55,
        speedMin: 1.2, speedMax: 3.0, vyMin: 0.5, vyMax: 2.0, gravity: -0.4, maxDelay: 0.14, size: 2.85
      });
      // 8 Mystical Bright Violet Inner Mist Billows (Additive glow inside the dark smoke!)
      addSparks(8, {
        tex: 'shadow_smoke', additive: true, color: '#8b5cf6', intensity: 1.7,
        radius: 1.1, oy: 0.85, oySpread: 0.45,
        speedMin: 1.0, speedMax: 2.4, vyMin: 0.8, vyMax: 2.2, gravity: -0.2, maxDelay: 0.12, size: 2.15
      });
      // Dispersing Violet Kunai Sparks
      addSparks(18, {
        color: '#d8b4fe', radius: 0.8, oy: 0.8,
        speedMin: 3.0, speedMax: 6.5, vyMin: 1.2, vyMax: 3.5, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: FUUMA SHURIKEN FAN (5 Giant Spinning Shuriken Arcs!)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_helmet') {
      duration = 0.78;

      // Wide 5-Fan Launch Sweep Arc right in front of Ninja
      addMesh(this.geo.plane, 'kunai_slash', '#16052c', 1.0, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.02, 0.55);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 4.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.4) * 0.96;
      }, false);

      addMesh(this.geo.plane, 'kunai_slash', '#a855f7', 2.4, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.06, 0.60);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 3.7;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.5);
      });

      // 5 Giant Spectral Fuuma Shuriken Blades racing out along the exact 5-fan angles!
      for (let i = -2; i <= 2; i++) {
        const fanAng = i * 0.22;
        const dirX = Math.sin(fanAng);
        const dirZ = Math.cos(fanAng);
        // Dark crisp obsidian-violet silhouette
        addMesh(this.geo.plane, 'shuriken_glint', '#140528', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
        }, (m, mat, t, ease) => {
          const dist = 0.9 + t * 12.8;
          m.position.set(dirX * dist, 1.02, dirZ * dist);
          m.rotation.z = t * 24.0;
          const s = 1.5 + ease * 0.6;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - Math.max(0, (t - 0.72) / 0.28)) * 0.96;
        }, false);
        // Radiant lavender-cyan HDR edge
        addMesh(this.geo.plane, 'shuriken_glint', i === 0 ? '#38bdf8' : '#c084fc', 2.4, (m) => {
          m.rotation.x = -Math.PI * 0.5;
        }, (m, mat, t, ease) => {
          const dist = 0.9 + t * 12.8;
          m.position.set(dirX * dist, 1.06, dirZ * dist);
          m.rotation.z = t * 24.0;
          const s = 1.38 + ease * 0.55;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - Math.max(0, (t - 0.72) / 0.28));
        });
      }

      addSparks(20, {
        color: '#c084fc', ox: 0, oy: 1.05, oz: 0.85,
        forwardBias: 7.5, speedMin: 1.5, speedMax: 4.5, vyMin: 0.2, vyMax: 1.8, gravity: -2.0, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: EXPLOSIVE SUBSTITUTION (Kawarimi Paper Talismans + 0.45s Detonation!)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_trinket') {
      duration = 1.12;
      const DETONATE_T = 0.45 / 1.12; // exact 0.45s server triggerAt match!

      // Phase 1: Instant Kawarimi Swap Poof (dark indigo-charcoal smoke so log + tags stand out!)
      addSparks(8, {
        tex: 'shadow_smoke', additive: false, color: '#271438', intensity: 1.0,
        radius: 0.55, oy: 0.85, speedMin: 0.8, speedMax: 2.0, vyMin: 0.5, vyMax: 1.8, gravity: 0.2, size: 1.5
      });

      // Phase 1: Pulsing Crimson Danger Shinobi Seal on the ground (0..0.52s)
      addMesh(this.geo.plane, 'shinobi_seal', '#380512', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t) => {
        const pt = clamp01(t / (DETONATE_T + 0.08));
        const s = 1.6 + easeOutCubic(pt) * 5.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = t < DETONATE_T + 0.08 ? 0.94 : Math.max(0, 1 - (t - DETONATE_T - 0.08) * 6);
      }, false);
      addMesh(this.geo.plane, 'shinobi_seal', '#f43f5e', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t) => {
        const pt = clamp01(t / (DETONATE_T + 0.08));
        const s = 1.5 + easeOutCubic(pt) * 4.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = t < DETONATE_T + 0.08 ? (0.85 + Math.sin(t * 45) * 0.15) : Math.max(0, 1 - (t - DETONATE_T - 0.08) * 6);
      });

      // Phase 1: 6 Floating Japanese Explosive Paper Talismans (Kibaku Fuda) tilted toward camera!
      const talismanRing = new THREE.Group();
      talismanRing.position.set(0, 1.15, 0);
      root.add(talismanRing);
      const tagMats = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const bgMat = this.makeMat('paper_talisman', '#9f1239', 1.0, 0.98, false);
        const bg = new THREE.Mesh(this.geo.plane, bgMat);
        bg.position.set(Math.sin(ang) * 1.45, 0, Math.cos(ang) * 1.45);
        bg.rotation.set(-0.35, ang, 0);
        bg.scale.set(0.95, 1.38, 1);
        bg.renderOrder = 18;
        talismanRing.add(bg);
        tagMats.push(bgMat);

        const glowMat = this.makeMat('paper_talisman', '#fb7185', 2.1, 0.92, true);
        const glow = new THREE.Mesh(this.geo.plane, glowMat);
        glow.position.set(Math.sin(ang) * 1.48, 0.02, Math.cos(ang) * 1.48);
        glow.rotation.set(-0.35, ang, 0);
        glow.scale.set(0.98, 1.42, 1);
        glow.renderOrder = 19;
        talismanRing.add(glow);
        tagMats.push(glowMat);
      }
      parts.push({
        mesh: talismanRing,
        mat: tagMats[0],
        extraMats: tagMats.slice(1),
        update: (g, _m, t) => {
          if (t >= DETONATE_T + 0.04) {
            g.visible = false;
            return;
          }
          g.visible = true;
          const pt = clamp01(t / DETONATE_T);
          g.rotation.y = t * 6.5;
          const sc = 0.65 + easeOutCubic(pt) * 0.65;
          g.scale.setScalar(sc);
          const pulse = 0.78 + 0.22 * Math.sin(t * 50);
          for (const tm of tagMats) tm.opacity = pulse;
        }
      });

      // Phase 2 (at 0.45s!): MASSIVE CRIMSON-OBSIDIAN KIBAKU FUDA DETONATION!
      addMesh(this.geo.plane, 'shadow_ring', '#4c0519', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.12, 0);
      }, (m, mat, t) => {
        if (t < DETONATE_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DETONATE_T) / (1 - DETONATE_T));
        const s = 1.4 + easeOutCubic(dt2) * 7.6;
        m.scale.set(s, s, 1);
        mat.opacity = (1 - dt2) * 0.96;
      }, false);

      addMesh(this.geo.plane, 'shadow_ring', '#fb7185', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.16, 0);
      }, (m, mat, t) => {
        if (t < DETONATE_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DETONATE_T) / (1 - DETONATE_T));
        const s = 1.2 + easeOutCubic(dt2) * 7.4;
        m.scale.set(s, s, 1);
        mat.opacity = 1 - dt2;
      });

      // Crimson-obsidian X-blast cross + fireball flare
      addMesh(this.geo.plane, 'cross_fang', '#3b0716', 1.0, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t) => {
        if (t < DETONATE_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DETONATE_T) / 0.45);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + easeOutCubic(dt2) * 4.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - dt2) * 0.95;
      }, false);
      addMesh(this.geo.plane, 'crimson_flare', '#f43f5e', 2.9, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t) => {
        if (t < DETONATE_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DETONATE_T) / 0.42);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + easeOutCubic(dt2) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - dt2);
      });

      // Delayed dark blast smoke + crimson embers at t = 0.45s
      addSparks(12, {
        tex: 'shadow_smoke', additive: false, color: '#240614', intensity: 1.0,
        radius: 1.0, oy: 0.95, speedMin: 1.4, speedMax: 3.8, vyMin: 1.0, vyMax: 3.2, gravity: -0.5, baseDelay: 0.44, maxDelay: 0.08, size: 2.5
      });
      addSparks(28, {
        color: '#fb7185', radius: 0.4, oy: 0.9,
        speedMin: 3.5, speedMax: 8.5, vyMin: 2.5, vyMax: 7.0, gravity: -11.0, baseDelay: 0.44, maxDelay: 0.08, size: 0.44
      });
    }

    // ------------------------------------------------------------------------
    // 7. SHADOW STEP MOBILITY (Teleport Departure / Air Dash / Triple Jump)
    // ------------------------------------------------------------------------
    else if (effectId === 'ninja_mobility_shadowstep') {
      duration = 0.46;

      addMesh(this.geo.plane, 'shinobi_seal', '#3b0764', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 0.7 + ease * 2.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t) * 0.88;
      }, false);

      addMesh(this.geo.plane, 'shinobi_seal', '#c084fc', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 0.65 + ease * 2.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      addSparks(6, {
        tex: 'shadow_smoke', additive: false, color: '#2e1065', intensity: 1.0,
        radius: 0.4, oy: 0.6, speedMin: 0.8, speedMax: 2.0, vyMin: 0.4, vyMax: 1.4, gravity: 0.1, size: 1.35
      });
      addSparks(12, {
        color: '#d8b4fe', radius: 0.35, oy: 0.65,
        speedMin: 1.5, speedMax: 4.5, vyMin: 1.0, vyMax: 3.0, size: 0.28
      });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      sparks,
      age: 0,
      duration
    });
  }

  update(dt) {
    if (this.activeEffects.length === 0) return;
    const invRootQ = new THREE.Quaternion();

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.age += dt;
      if (fx.age >= fx.duration) {
        this.disposeEffect(fx);
        this.activeEffects.splice(i, 1);
        continue;
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
          Math.max(0.08, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT),
          sp.oz + sp.vz * localT
        );
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);
        if (sp.isCloud) {
          const sc = sp.baseSz * (0.65 + easeOutCubic(st) * 0.95);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.12 ? st / 0.12 : 1 - (st - 0.12) / 0.88) * 0.88);
        } else {
          const sc = sp.baseSz * (1.1 - st * 0.72);
          sp.mesh.scale.set(sc * 0.5, sc * 1.45, 1);
          sp.mat.opacity = clamp01((1 - st) * 1.15);
        }
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
