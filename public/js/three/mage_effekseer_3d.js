// ============================================================================
// LOST SAGA 3D - FIRE ARCHMAGE 3D EFFEKSEER + THREE.JS HDR-BLOOM VFX SYSTEM
// ============================================================================
// Dedicated 7-move Fire Archmage (จอมเวทย์อัคคี) 3D VFX suite for ThreeRenderer:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep scorched volcanic-obsidian
//      NormalBlending silhouettes + blazing scarlet/orange/solar-gold Additive HDR
//      Bloom using our 10 custom 512x512 Fire Archmage PNG textures!
// ============================================================================
import * as THREE from 'three';

const MAGE_TEX_NAMES = [
  'pyro_rune_circle',
  'flame_lick',
  'flame_vortex',
  'fire_shockwave',
  'magma_crater',
  'meteor_core',
  'solar_orb',
  'phoenix_wings',
  'volcanic_smoke',
  'fire_ember'
];

const MAGE_EFFECT_IDS = new Set([
  'mage_basic_fireball',
  'mage_heavy_pillar',
  'mage_weapon',
  'mage_armor',
  'mage_helmet',
  'mage_trinket',
  'mage_mobility_hover'
]);

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function easeInQuad(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function hdrColor(hex, intensity = 2.0) {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

export class MageThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'MageThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      pillar: new THREE.CylinderGeometry(1.18, 0.78, 1.0, 28, 1, true),
      novaWall: new THREE.CylinderGeometry(1.05, 0.95, 1.0, 32, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of MAGE_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/mage/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'flame_vortex') {
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
   * Handle server FX events for Fire Archmage (including stolen Mage gear skills!).
   * Returns true if handled/suppressed by the Fire Archmage 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && MAGE_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'mage_weapon') this.shake(9);
      else if (mapped.effectId === 'mage_armor') this.shake(7);
      else if (mapped.effectId === 'mage_heavy_pillar') this.shake(6);
      else if (mapped.effectId === 'mage_trinket') this.shake(5);
      else if (mapped.effectId === 'mage_helmet') this.shake(4);
      else if (mapped.effectId === 'mage_basic_fireball' && mapped.isFinisher) this.shake(3);

      return true;
    }

    // Suppress ONLY Fire Archmage's duplicate secondary events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'mage') ||
      (fx.type === 'skill_cast' && (fx.skillId === 'mage_weapon' || fx.skillId === 'mage_trinket')) ||
      (fx.type === 'shockwave' && fx.fromSkill === 'mage_armor')
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
      mesh.renderOrder = additive ? 19 : 17;
      if (initFn) initFn(mesh);
      root.add(mesh);
      parts.push({ mesh, mat, update: updateFn });
      return mesh;
    };

    const addSparks = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const mat = this.makeMat(cfg.tex || 'fire_ember', cfg.color, cfg.intensity || 2.3, 1.0, cfg.additive !== false);
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
          gravity: cfg.gravity !== undefined ? cfg.gravity : -7.5,
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.12),
          baseSz: sz,
          isCloud: cfg.tex === 'volcanic_smoke' || cfg.tex === 'flame_lick',
          isFlame: cfg.tex === 'flame_lick',
          rotSpeed: (Math.random() - 0.5) * 3.0,
          rotInit: cfg.tex === 'flame_lick' ? (Math.random() - 0.5) * 0.45 : Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: ARCANE FIREBALL CAST (Staff Casting Sigil + Solar Flash!)
    // ------------------------------------------------------------------------
    if (effectId === 'mage_basic_fireball') {
      duration = opts.isFinisher ? 0.50 : 0.36;

      // Vertical Arcane Pyromancy Casting Sigil in front of staff tip (+Z)
      addMesh(this.geo.plane, 'pyro_rune_circle', '#3b0704', 1.0, (m) => {
        m.position.set(0, 1.02, 0.92);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.5 : 1.1) + ease * (opts.isFinisher ? 1.85 : 1.35);
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.5;
        mat.opacity = clamp01(1 - t) * 0.94;
      }, false);

      addMesh(this.geo.plane, 'pyro_rune_circle', opts.isFinisher ? '#ef4444' : '#f97316', 2.4, (m) => {
        m.position.set(0, 1.02, 0.96);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.4 : 1.0) + ease * (opts.isFinisher ? 1.75 : 1.28);
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.5;
        mat.opacity = clamp01(1 - t);
      });

      // Solar Ignition Core Flash
      addMesh(this.geo.plane, 'solar_orb', '#fde047', 2.6, (m) => {
        m.position.set(0, 1.02, 1.08);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = (opts.isFinisher ? 1.15 : 0.85) + ease * 1.45;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.6);
      });

      // Muzzle Flame Licks & Volcanic Embers shooting forward
      addSparks(opts.isFinisher ? 7 : 4, {
        tex: 'flame_lick', additive: true, color: '#fb923c', intensity: 2.2,
        ox: 0, oy: 1.02, oz: 1.05, radius: 0.25,
        forwardBias: 5.5, speedMin: 0.8, speedMax: 2.2, vyMin: 0.6, vyMax: 2.0, gravity: 1.0, size: 0.95
      });
      addSparks(opts.isFinisher ? 16 : 9, {
        color: '#fde047', ox: 0, oy: 1.02, oz: 1.05,
        forwardBias: 6.5, speedMin: 1.2, speedMax: 3.6, size: 0.28
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: DRAGON PILLAR (Volcanic Fissure + 3D Spiraling Fire Column!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_heavy_pillar') {
      duration = 0.88;
      const pz = 2.35; // Erupts directly ahead in Dragon Pillar's 5m strike zone!

      // Scorched Obsidian Magma Crater Base
      addMesh(this.geo.plane, 'magma_crater', '#260604', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, pz);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'magma_crater', '#f97316', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, pz);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 4.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92));
      });

      // Spinning Arcane Fire Rune
      addMesh(this.geo.plane, 'pyro_rune_circle', '#ef4444', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.06, pz);
      }, (m, mat, t, ease) => {
        const s = 1.4 + ease * 4.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t);
      });

      // Towering 3D Spiraling Dragon-Fire Vortex Column (obsidian core + blazing orange-gold outer!)
      addMesh(this.geo.pillar, 'flame_vortex', '#3b0704', 1.0, (m) => {
        m.position.set(0, 0, pz);
      }, (m, mat, t, ease) => {
        const r = 0.85 + ease * 1.15;
        const h = 1.8 + ease * 4.2;
        m.scale.set(r, h, r);
        m.position.set(0, h * 0.5 + gyOffset, pz);
        m.rotation.y = t * 11.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.3))) * 0.96;
      }, false);
      addMesh(this.geo.pillar, 'flame_vortex', '#f97316', 2.4, (m) => {
        m.position.set(0, 0, pz);
      }, (m, mat, t, ease) => {
        const r = 0.78 + ease * 1.05;
        const h = 2.0 + ease * 4.4;
        m.scale.set(r, h, r);
        m.position.set(0, h * 0.5 + gyOffset, pz);
        m.rotation.y = -t * 14.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.95;
      });
      addMesh(this.geo.pillar, 'flame_vortex', '#fde047', 2.6, (m) => {
        m.position.set(0, 0, pz);
      }, (m, mat, t, ease) => {
        const r = 0.52 + ease * 0.65;
        const h = 2.2 + ease * 4.5;
        m.scale.set(r, h, r);
        m.position.set(0, h * 0.5 + gyOffset, pz);
        m.rotation.y = t * 18.0;
        mat.opacity = clamp01(1 - t * 1.15) * 0.88;
      });

      // Eruption Shockwave Ring
      addMesh(this.geo.plane, 'fire_shockwave', '#2b0604', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, pz);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.55);
        const s = 1.0 + easeOutCubic(wt) * 5.4;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.92 : 0;
      }, false);
      addMesh(this.geo.plane, 'fire_shockwave', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.12, pz);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.55);
        const s = 0.9 + easeOutCubic(wt) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Rising Flame Tongues + Dark Smoke Base + Embers
      addSparks(8, {
        tex: 'volcanic_smoke', additive: false, color: '#220908', intensity: 1.0,
        ox: 0, oy: 0.45, oz: pz, radius: 1.0,
        speedMin: 1.0, speedMax: 2.6, vyMin: 0.6, vyMax: 1.8, gravity: -0.2, size: 1.9
      });
      addSparks(10, {
        tex: 'flame_lick', additive: true, color: '#fb923c', intensity: 2.3,
        ox: 0, oy: 0.55, oz: pz, radius: 0.85,
        speedMin: 0.5, speedMax: 1.6, vyMin: 3.5, vyMax: 7.0, gravity: 0.5, size: 1.55
      });
      addSparks(22, {
        color: '#fde047', ox: 0, oy: 0.8, oz: pz, radius: 0.9,
        speedMin: 1.8, speedMax: 5.0, vyMin: 3.5, vyMax: 7.5, gravity: -6.0, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: METEOR APOCALYPSE (Falling Meteor + 9m Magma Crater!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_weapon') {
      duration = 1.55;
      const IMPACT_T = 0.28 / 1.55; // Impact hits at 0.28s!
      const startPos = new THREE.Vector3(-4.5, 13.5, -3.5);
      const endPos = new THREE.Vector3(0, gyOffset + 0.6, 0);

      // Phase 1+2: Giant 9m Arcane Apocalypse Target Circle (dark crimson ink + glowing gold-red!)
      addMesh(this.geo.plane, 'pyro_rune_circle', '#260504', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.6 + ease * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.2;
        mat.opacity = clamp01((t < 0.05 ? t / 0.05 : 1 - Math.pow((t - 0.05) / 0.95, 1.5))) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'pyro_rune_circle', '#ef4444', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 2.4 + ease * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.2;
        mat.opacity = clamp01((t < 0.05 ? t / 0.05 : 1 - Math.pow((t - 0.05) / 0.95, 1.5))) * 0.94;
      });

      // Phase 1 (0..0.28s): Plunging 3D Molten Meteor Core + Reentry Halo!
      addMesh(this.geo.plane, 'meteor_core', '#4a1206', 1.0, null, (m, mat, t) => {
        if (t >= IMPACT_T + 0.04) { mat.opacity = 0; return; }
        const ft = easeInQuad(clamp01(t / IMPACT_T));
        m.position.lerpVectors(startPos, endPos, ft);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 14.0);
        const s = 2.6 + ft * 1.4;
        m.scale.set(s, s, 1);
        mat.opacity = 0.98;
      }, false);
      addMesh(this.geo.plane, 'meteor_core', '#fb923c', 2.7, null, (m, mat, t) => {
        if (t >= IMPACT_T + 0.04) { mat.opacity = 0; return; }
        const ft = easeInQuad(clamp01(t / IMPACT_T));
        m.position.lerpVectors(startPos, endPos, ft);
        m.position.y += 0.06;
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 14.0);
        const s = 2.9 + ft * 1.5;
        m.scale.set(s, s, 1);
        mat.opacity = 0.96;
      });

      // Phase 2 (0.28s..1.55s): Massive 8.6m Fractured Obsidian Magma Crater!
      addMesh(this.geo.plane, 'magma_crater', '#1c0504', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.05, 0);
      }, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const it = clamp01((t - IMPACT_T) / (1 - IMPACT_T));
        const s = 2.0 + easeOutCubic(it) * 7.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - Math.pow(it, 1.6)) * 0.98;
      }, false);
      addMesh(this.geo.plane, 'magma_crater', '#f97316', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const it = clamp01((t - IMPACT_T) / (1 - IMPACT_T));
        const s = 1.9 + easeOutCubic(it) * 6.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - Math.pow(it, 1.4));
      });

      // Phase 2: Twin 9.6m Superheated Cataclysm Fire Shockwaves!
      addMesh(this.geo.plane, 'fire_shockwave', '#2e0504', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.12, 0);
      }, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const wt = clamp01((t - IMPACT_T) / 0.55);
        const s = 1.4 + easeOutCubic(wt) * 8.4;
        m.scale.set(s, s, 1);
        m.rotation.z = wt * 2.2;
        mat.opacity = wt < 1 ? (1 - wt) * 0.96 : 0;
      }, false);
      addMesh(this.geo.plane, 'fire_shockwave', '#fde047', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.16, 0);
      }, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const wt = clamp01((t - IMPACT_T) / 0.55);
        const s = 1.2 + easeOutCubic(wt) * 8.2;
        m.scale.set(s, s, 1);
        m.rotation.z = wt * 2.2;
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Phase 2: Towering Volcanic Impact Eruption Column (Obsidian-Scarlet + Solar Core!)
      addMesh(this.geo.pillar, 'flame_vortex', '#2b0604', 1.0, null, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const it = clamp01((t - IMPACT_T) / 0.72);
        const ie = easeOutCubic(it);
        const r = 1.4 + ie * 2.1;
        const h = 2.0 + ie * 4.8;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = it * 8.5;
        mat.opacity = it < 1 ? clamp01(1 - Math.pow(it, 1.35)) * 0.95 : 0;
      }, false);
      addMesh(this.geo.pillar, 'flame_vortex', '#f97316', 2.5, null, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const it = clamp01((t - IMPACT_T) / 0.72);
        const ie = easeOutCubic(it);
        const r = 1.25 + ie * 1.95;
        const h = 2.2 + ie * 5.0;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = -it * 11.0;
        mat.opacity = it < 1 ? clamp01(1 - it) * 0.96 : 0;
      });

      // Phase 2: Incandescent Solar Impact Core Flash
      addMesh(this.geo.plane, 'solar_orb', '#fde047', 3.0, (m) => {
        m.position.set(0, 1.4, 0);
      }, (m, mat, t) => {
        if (t < IMPACT_T) { mat.opacity = 0; return; }
        const it = clamp01((t - IMPACT_T) / 0.35);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 2.0 + easeOutCubic(it) * 5.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - it);
      });

      // Phase 2: 16 Billowing Dark Volcanic Ash Clouds + 10 Flame Licks + 36 Lava Embers!
      addSparks(16, {
        tex: 'volcanic_smoke', additive: false, color: '#1e0807', intensity: 1.0,
        radius: 2.0, oy: 0.9, oySpread: 0.6,
        speedMin: 1.8, speedMax: 4.5, vyMin: 1.2, vyMax: 3.6, gravity: -0.6,
        baseDelay: 0.27, maxDelay: 0.14, size: 2.95
      });
      addSparks(10, {
        tex: 'flame_lick', additive: true, color: '#fb923c', intensity: 2.3,
        radius: 1.8, oy: 0.7, oySpread: 0.4,
        speedMin: 1.0, speedMax: 2.8, vyMin: 3.2, vyMax: 6.5, gravity: 0.2,
        baseDelay: 0.27, maxDelay: 0.16, size: 1.85
      });
      addSparks(36, {
        color: '#fde047', radius: 1.4, oy: 0.8,
        speedMin: 3.2, speedMax: 8.8, vyMin: 3.2, vyMax: 8.2, gravity: -10.5,
        baseDelay: 0.27, maxDelay: 0.14, size: 0.42
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: SUPERNOVA RING (360-Degree Blazing 9m Flame Wall!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_armor') {
      duration = 1.05;

      // Ground Spinning 9m Pyromancy Nova Seal
      addMesh(this.geo.plane, 'pyro_rune_circle', '#260504', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 7.4;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.2;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'pyro_rune_circle', '#f97316', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 7.2;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.2;
        mat.opacity = clamp01(1 - t);
      });

      // Expanding 3D Supernova Flame Wall Cylinder (0.8m -> 4.6m radius!)
      addMesh(this.geo.novaWall, 'flame_vortex', '#3b0704', 1.0, null, (m, mat, t, ease) => {
        const r = 0.9 + ease * 3.85;
        const h = 1.4 + (1 - t * 0.4) * 1.4;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = t * 6.0;
        mat.opacity = clamp01(1 - Math.pow(t, 1.35)) * 0.95;
      }, false);
      addMesh(this.geo.novaWall, 'flame_vortex', '#f97316', 2.5, null, (m, mat, t, ease) => {
        const r = 0.82 + ease * 3.75;
        const h = 1.5 + (1 - t * 0.4) * 1.5;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = -t * 8.0;
        mat.opacity = clamp01(1 - t) * 0.96;
      });

      // Dual-Pass 9.2m Jagged Fire Shockwave Ring
      addMesh(this.geo.plane, 'fire_shockwave', '#2b0504', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.65);
        const s = 1.2 + easeOutCubic(wt) * 8.2;
        m.scale.set(s, s, 1);
        m.rotation.z = wt * 3.0;
        mat.opacity = wt < 1 ? (1 - wt) * 0.95 : 0;
      }, false);
      addMesh(this.geo.plane, 'fire_shockwave', '#fde047', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.13, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.65);
        const s = 1.1 + easeOutCubic(wt) * 8.0;
        m.scale.set(s, s, 1);
        m.rotation.z = wt * 3.0;
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Core Solar Flash
      addMesh(this.geo.plane, 'solar_orb', '#fde047', 2.8, (m) => {
        m.position.set(0, 1.05, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.4 + ease * 4.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 2.5);
      });

      // Dark Volcanic Ash Ring + 360 Embers
      addSparks(14, {
        tex: 'volcanic_smoke', additive: false, color: '#210807', intensity: 1.0,
        radius: 1.4, oy: 0.7, speedMin: 2.2, speedMax: 5.0, vyMin: 0.5, vyMax: 1.8, gravity: -0.4, size: 2.2
      });
      addSparks(28, {
        color: '#fde047', radius: 0.7, oy: 0.95,
        speedMin: 3.5, speedMax: 8.2, vyMin: 1.5, vyMax: 4.5, gravity: -7.5, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: SOLAR ORBIT SPHERES (6.0s Caster-Attached 4 Suns!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_helmet') {
      duration = 6.0;
      attachToCaster = true;

      // Persistent 5.4m (2.7m exact AoE hit radius!) Solar Floor Halo attached to caster
      addMesh(this.geo.plane, 'pyro_rune_circle', '#2a0704', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t) => {
        const s = t < 0.06 ? (1.2 + easeOutCubic(t / 0.06) * 4.2) : 5.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
        mat.opacity = 0.76 * fadeOut;
      }, false);
      addMesh(this.geo.plane, 'pyro_rune_circle', '#fb923c', 2.1, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t) => {
        const s = t < 0.06 ? (1.1 + easeOutCubic(t / 0.06) * 4.1) : 5.2;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
        mat.opacity = (0.72 + 0.18 * Math.sin(t * 48)) * fadeOut;
      });

      // Summon Activation Shockwave Ring (first 0.55s)
      addMesh(this.geo.plane, 'fire_shockwave', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.12, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.09);
        const s = 1.0 + easeOutCubic(wt) * 5.0;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // 4 Radiant Dual-Pass Orbiting Solar Spheres + Fiery Corona Trails!
      const orbitGroup = new THREE.Group();
      orbitGroup.position.set(0, 1.15, 0);
      root.add(orbitGroup);
      const orbMats = [];
      const orbNodes = [];
      for (let i = 0; i < 4; i++) {
        const node = new THREE.Group();
        const darkMat = this.makeMat('solar_orb', '#450a0a', 1.0, 0.92, false);
        const darkMesh = new THREE.Mesh(this.geo.plane, darkMat);
        darkMesh.scale.set(1.22, 1.22, 1);
        darkMesh.renderOrder = 17;
        node.add(darkMesh);

        const brightMat = this.makeMat('solar_orb', '#fb923c', 2.6, 0.98, true);
        const brightMesh = new THREE.Mesh(this.geo.plane, brightMat);
        brightMesh.scale.set(1.12, 1.12, 1);
        brightMesh.renderOrder = 19;
        node.add(brightMesh);

        const coreMat = this.makeMat('solar_orb', '#fef08a', 2.8, 0.95, true);
        const coreMesh = new THREE.Mesh(this.geo.plane, coreMat);
        coreMesh.scale.set(0.68, 0.68, 1);
        coreMesh.renderOrder = 20;
        node.add(coreMesh);

        orbitGroup.add(node);
        orbNodes.push(node);
        orbMats.push(darkMat, brightMat, coreMat);
      }

      parts.push({
        mesh: orbitGroup,
        mat: orbMats[0],
        extraMats: orbMats.slice(1),
        update: (_g, _m, t) => {
          const sec = t * duration;
          const expand = t < 0.05 ? easeOutCubic(t / 0.05) : 1.0;
          const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
          const rad = 1.65 * expand;
          const invQ = root.quaternion.clone().invert();
          for (let i = 0; i < 4; i++) {
            const ang = sec * 4.4 + (i * Math.PI * 0.5);
            const node = orbNodes[i];
            node.position.set(
              Math.cos(ang) * rad,
              Math.sin(sec * 5.0 + i * 1.57) * 0.24,
              Math.sin(ang) * rad
            );
            node.quaternion.copy(this.camera.quaternion).premultiply(invQ);
            const pulse = (0.92 + 0.16 * Math.sin(sec * 12 + i)) * expand;
            node.scale.setScalar(pulse);
          }
          for (let k = 0; k < orbMats.length; k++) {
            orbMats[k].opacity = (k % 3 === 0 ? 0.88 : 0.96) * fadeOut;
          }
        }
      });

      addSparks(22, {
        color: '#fde047', radius: 1.7, oy: 1.0,
        speedMin: 1.2, speedMax: 3.5, vyMin: 1.5, vyMax: 3.8, gravity: -3.0, maxDelay: 0.35, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: FLAME BLINK WARP (Departure & Arrival Phoenix Explosions!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_trinket') {
      duration = 0.78;
      const isArrival = !!opts.isArrival;

      // Ground Blink Rune Circle (2.8m radius = 5.6m diameter!)
      addMesh(this.geo.plane, 'pyro_rune_circle', '#2b0604', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 4.8;
        m.scale.set(s, s, 1);
        m.rotation.z = (isArrival ? -1 : 1) * t * 6.5;
        mat.opacity = clamp01(1 - t) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'pyro_rune_circle', isArrival ? '#ef4444' : '#facc15', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 4.6;
        m.scale.set(s, s, 1);
        m.rotation.z = (isArrival ? -1 : 1) * t * 6.5;
        mat.opacity = clamp01(1 - t);
      });

      // Explosive Fire Shockwave Ring (5.8m)
      addMesh(this.geo.plane, 'fire_shockwave', '#2e0604', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.6);
        const s = 0.9 + easeOutCubic(wt) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.95 : 0;
      }, false);
      addMesh(this.geo.plane, 'fire_shockwave', isArrival ? '#f97316' : '#fde047', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.12, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.6);
        const s = 0.85 + easeOutCubic(wt) * 5.0;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // On Departure: Blazing 6m Phoenix Warp Streak connecting start -> arrival!
      if (!isArrival) {
        addMesh(this.geo.plane, 'flame_vortex', '#3b0704', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.rotation.z = Math.PI * 0.5;
          m.position.set(0, 0.85, 3.0);
        }, (m, mat, t, ease) => {
          m.scale.set(1.6 - t * 0.5, 6.2 * Math.min(1, ease * 1.4), 1);
          mat.opacity = clamp01(1 - t * 1.35) * 0.9;
        }, false);
        addMesh(this.geo.plane, 'flame_vortex', '#fb923c', 2.5, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.rotation.z = Math.PI * 0.5;
          m.position.set(0, 0.90, 3.0);
        }, (m, mat, t, ease) => {
          m.scale.set(1.3 - t * 0.4, 6.2 * Math.min(1, ease * 1.4), 1);
          mat.opacity = clamp01(1 - t * 1.45);
        });
      }

      // Dramatic Blazing Phoenix Wings Crest (especially grand on Arrival!)
      addMesh(this.geo.plane, 'phoenix_wings', '#3b0604', 1.0, (m) => {
        m.position.set(0, 1.25, -0.1);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const base = isArrival ? 1.6 : 1.1;
        const s = base + ease * (isArrival ? 2.6 : 1.7);
        m.scale.set(s * 1.2, s, 1);
        m.position.y = 1.25 + ease * 0.65;
        mat.opacity = clamp01(1 - t * 1.15) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'phoenix_wings', isArrival ? '#fb923c' : '#fde047', 2.6, (m) => {
        m.position.set(0, 1.28, -0.05);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const base = isArrival ? 1.5 : 1.0;
        const s = base + ease * (isArrival ? 2.5 : 1.6);
        m.scale.set(s * 1.2, s, 1);
        m.position.y = 1.28 + ease * 0.65;
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // Volcanic Smoke Puff + Radiant Embers
      addSparks(8, {
        tex: 'volcanic_smoke', additive: false, color: '#240807', intensity: 1.0,
        radius: 0.75, oy: 0.8, speedMin: 1.2, speedMax: 2.8, vyMin: 0.5, vyMax: 1.8, gravity: -0.3, size: 1.7
      });
      addSparks(20, {
        color: isArrival ? '#f97316' : '#fde047', radius: 0.55, oy: 0.9,
        speedMin: 2.2, speedMax: 6.2, vyMin: 1.5, vyMax: 4.5, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: FLAME HOVER / FLAME AIR DASH (Phoenix Wings + Boost Rune!)
    // ------------------------------------------------------------------------
    else if (effectId === 'mage_mobility_hover') {
      duration = 0.48;

      addMesh(this.geo.plane, 'pyro_rune_circle', '#2b0604', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 0.8 + ease * 2.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'pyro_rune_circle', '#fb923c', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.11, 0);
      }, (m, mat, t, ease) => {
        const s = 0.75 + ease * 2.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'phoenix_wings', '#3b0604', 1.0, (m) => {
        m.position.set(0, 1.0, -0.15);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.0 + ease * 1.5;
        m.scale.set(s * 1.15, s, 1);
        mat.opacity = clamp01(1 - t) * 0.9;
      }, false);
      addMesh(this.geo.plane, 'phoenix_wings', '#fde047', 2.4, (m) => {
        m.position.set(0, 1.02, -0.10);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 0.95 + ease * 1.45;
        m.scale.set(s * 1.15, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addSparks(12, {
        color: '#fde047', radius: 0.45, oy: 0.55,
        speedMin: 1.2, speedMax: 3.5, vyMin: -1.5, vyMax: 1.5, gravity: -3.0, size: 0.28
      });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      sparks,
      age: 0,
      duration,
      playerId: opts.playerId || null,
      attachToCaster: attachToCaster && !!opts.playerId
    });
  }

  update(dt, state) {
    if (this.activeEffects.length === 0) return;

    let playerMap = null;
    if (state && state.players) {
      playerMap = new Map();
      for (const pl of state.players) playerMap.set(pl.id, pl);
    }

    const invRootQ = new THREE.Quaternion();

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.age += dt;

      if (fx.attachToCaster && playerMap) {
        const pl = playerMap.get(fx.playerId);
        if (!pl || pl.state === 'dead') {
          this.disposeEffect(fx);
          this.activeEffects.splice(i, 1);
          continue;
        }
        fx.root.position.set(pl.x, pl.y, pl.z);
      }

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
        if (sp.isFlame) {
          const sc = sp.baseSz * (0.75 + Math.sin(st * Math.PI) * 0.65);
          sp.mesh.scale.set(sc * 0.72, sc * 1.25, 1);
          sp.mesh.rotateZ(sp.rotInit);
          sp.mat.opacity = clamp01(Math.sin(st * Math.PI) * 1.1);
        } else if (sp.isCloud) {
          const sc = sp.baseSz * (0.65 + easeOutCubic(st) * 0.95);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.12 ? st / 0.12 : 1 - (st - 0.12) / 0.88) * 0.90);
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
