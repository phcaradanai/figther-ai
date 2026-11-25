// ============================================================================
// LOST SAGA 3D - MUAY THAI STRIKER (GOLDEN TIGER & LIGHTNING) 3D VFX SUITE
// ============================================================================
// Dedicated 7-move Muay Thai Striker (ยอดนักสู้มวยไทย) 3D VFX suite:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep crimson Muay-Thai rope
//      & obsidian NormalBlending silhouettes (#450a0a / #2b0f06) paired with
//      Champion Gold (#fde047 / #facc15), Crimson Flame (#dc2626), and Speed
//      Lightning White-Gold (#ffffff) Additive HDR Bloom using our 10 512x512
//      Thai Martial Arts PNGs!
// ============================================================================
import * as THREE from 'three';

const STRIKER_TEX_NAMES = [
  'thai_lotus_mandala',
  'tiger_fist_impact',
  'muay_kick_arc',
  'tiger_uppercut_spiral',
  'rapid_fist_barrage',
  'gold_lightning_arc',
  'golden_shock_ring',
  'stomp_fissure_ring',
  'tiger_flare',
  'chi_spark'
];

const STRIKER_EFFECT_IDS = new Set([
  'striker_basic_combo',
  'striker_heavy_uppercut',
  'striker_weapon',
  'striker_armor',
  'striker_helmet',
  'striker_trinket',
  'striker_mobility_sway'
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

export class StrikerThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'StrikerThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      uppercutOuter: new THREE.CylinderGeometry(1.45, 0.72, 1.0, 28, 1, true),
      uppercutInner: new THREE.CylinderGeometry(1.05, 0.52, 1.0, 24, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of STRIKER_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/striker/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'tiger_uppercut_spiral') {
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
   * Handle server FX events for Muay Thai Striker (including stolen Striker gear skills!).
   * Returns true if handled/suppressed by the Striker 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && STRIKER_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'striker_weapon') this.shake(8);
      else if (mapped.effectId === 'striker_trinket') this.shake(7);
      else if (mapped.effectId === 'striker_heavy_uppercut') this.shake(6);
      else if (mapped.effectId === 'striker_armor') this.shake(6);
      else if (mapped.effectId === 'striker_helmet') this.shake(4);
      else if (mapped.effectId === 'striker_basic_combo' && mapped.isFinisher) this.shake(4);

      return true;
    }

    // Suppress ONLY Striker's duplicate secondary server events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'striker') ||
      (fx.type === 'skill_cast' && (fx.skillId === 'striker_weapon' || fx.skillId === 'striker_trinket'))
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
    let duration = 0.72;
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
        const mat = this.makeMat(cfg.tex || 'chi_spark', cfg.color || '#fde047', cfg.intensity || 2.5, 1.0, cfg.additive !== false);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = cfg.additive === false ? 18 : 20;

        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.65);
        const spd = (cfg.speedMin !== undefined ? cfg.speedMin : 1.5) + Math.random() * (cfg.speedMax !== undefined ? cfg.speedMax : 4.2);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin !== undefined ? cfg.vyMin : 0.8) + Math.random() * (cfg.vyMax !== undefined ? cfg.vyMax : 3.2);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy !== undefined ? cfg.oy : 1.0) + (Math.random() - 0.5) * (cfg.oySpread || 0.5);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0.5);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || 0.34) * (0.75 + Math.random() * 0.65);
        root.add(mesh);

        sparks.push({
          mesh, mat, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : -5.5,
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.10),
          baseSz: sz,
          swirl: cfg.swirl || 0,
          swirlRadius: rad,
          swirlAngle: ang,
          rotSpeed: (Math.random() - 0.5) * 9.0,
          rotInit: Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: 4-HIT MUAY THAI PUNCH / ELBOW / ROUNDHOUSE KICK COMBO!
    // ------------------------------------------------------------------------
    if (effectId === 'striker_basic_combo') {
      duration = opts.isFinisher ? 0.46 : 0.28;
      const step = opts.comboStep || 1;
      const side = (step % 2 === 0) ? -0.35 : 0.35;

      if (step === 3 && !opts.isFinisher) {
        // Hit 3: Whip-Fast Muay Thai Roundhouse Kick Gust Arc!
        addMesh(this.geo.plane, 'muay_kick_arc', '#450a0a', 1.0, (m) => {
          m.position.set(0, 1.06, 0.52);
        }, (m, mat, t, ease) => {
          m.rotation.set(-Math.PI * 0.44, 0.22, (-1.15 + ease * 2.4) - Math.PI * 0.5);
          const s = 2.45 + ease * 1.25;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.05) * 0.94;
        }, false);
        addMesh(this.geo.plane, 'muay_kick_arc', '#facc15', 2.6, (m) => {
          m.position.set(0, 1.10, 0.56);
        }, (m, mat, t, ease) => {
          m.rotation.set(-Math.PI * 0.44, 0.22, (-1.05 + ease * 2.4) - Math.PI * 0.5);
          const s = 2.35 + ease * 1.18;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.1);
        });
      } else {
        // Hits 1, 2 (Lightning Jab/Cross) & Hit 4 Finisher (Blazing Golden Tiger Fist!)
        addMesh(this.geo.plane, 'tiger_fist_impact', '#450a0a', 1.0, (m) => {
          m.position.set(opts.isFinisher ? 0 : side, 1.05, opts.isFinisher ? 1.55 : 1.35);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(side * t * 6.0);
          const s = (opts.isFinisher ? 1.65 : 1.05) + ease * (opts.isFinisher ? 2.2 : 1.35);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'tiger_fist_impact', opts.isFinisher ? '#ffffff' : '#fde047', 2.8, (m) => {
          m.position.set(opts.isFinisher ? 0 : side, 1.06, opts.isFinisher ? 1.60 : 1.38);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(side * t * 6.0);
          const s = (opts.isFinisher ? 1.55 : 0.98) + ease * (opts.isFinisher ? 2.1 : 1.28);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.3);
        });

        // Forward Kinetic Punch Shock Ring
        addMesh(this.geo.plane, 'golden_shock_ring', opts.isFinisher ? '#dc2626' : '#facc15', 2.6, (m) => {
          m.position.set(opts.isFinisher ? 0 : side, 1.05, opts.isFinisher ? 1.50 : 1.30);
        }, (m, mat, t, ease) => {
          const s = (opts.isFinisher ? 1.15 : 0.72) + ease * (opts.isFinisher ? 2.4 : 1.35);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.3);
        });
      }

      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'tiger_flare', '#ffffff', 3.0, (m) => {
          m.position.set(0, 1.08, 1.62);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.4 + ease * 2.8;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.75);
        });
        addMesh(this.geo.plane, 'gold_lightning_arc', '#fde047', 2.7, (m) => {
          m.position.set(0, 1.2, 1.6);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(t * 4.0);
          m.scale.set(1.1, 2.3, 1);
          mat.opacity = clamp01(1 - t * 1.5);
        });
      }

      addSparks(opts.isFinisher ? 14 : 6, {
        color: '#fde047', ox: opts.isFinisher ? 0 : side, oy: 1.05, oz: 1.35, radius: 0.35,
        forwardBias: 4.0, speedMin: 1.4, speedMax: 4.2, vyMin: 0.5, vyMax: 2.5, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: TIGER UPPERCUT (Rising 4.8m Golden Dragon-Tiger Vortex!)
    //    (Matches server.js vy=7.5 + launchY=11.5 guardBreak!)
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_heavy_uppercut') {
      duration = 0.88;

      // Spinning Sacred Thai Lai-Thai Lotus Ground Launch Seal
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0.75);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 3.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#facc15', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0.75);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 3.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t);
      });

      // ICONIC RISING 3D GOLDEN-CRIMSON TIGER UPPERCUT SPIRAL VORTEX (4.8m Tall!)
      addMesh(this.geo.uppercutOuter, 'tiger_uppercut_spiral', '#450a0a', 1.0, null, (m, mat, t, ease) => {
        const r = 1.15 + ease * 1.15;
        const h = 1.6 + ease * 3.6;
        m.scale.set(r, h, r);
        m.position.set(0, gyOffset + h * 0.5 + ease * 0.5, 0.95);
        m.rotation.y = t * 14.0;
        mat.opacity = clamp01(1 - t * 1.05) * 0.90;
      }, false);
      addMesh(this.geo.uppercutInner, 'tiger_uppercut_spiral', '#fde047', 2.7, null, (m, mat, t, ease) => {
        const r = 0.95 + ease * 1.05;
        const h = 1.8 + ease * 3.8;
        m.scale.set(r, h, r);
        m.position.set(0, gyOffset + h * 0.5 + ease * 0.6, 0.95);
        m.rotation.y = -t * 18.0;
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // 3 Rising Stacked Kinetic Punch Shock Rings Climbing Rapidly Skyward!
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.08;
        addMesh(this.geo.plane, 'golden_shock_ring', i === 2 ? '#ffffff' : (i === 1 ? '#fde047' : '#dc2626'), 2.7, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, 0.6, 0.95);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.65;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.position.y = 0.5 + le * 3.8;
          const s = 1.2 + le * 2.9;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Zenith Skyward Tiger Fist Impact Burst!
      addMesh(this.geo.plane, 'tiger_fist_impact', '#ffffff', 2.9, (m) => {
        m.position.set(0, 3.3, 1.05);
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.12) / 0.55);
        if (t < 0.12) { mat.opacity = 0; return; }
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(lt * 5.0);
        const s = 1.6 + easeOutCubic(lt) * 3.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });

      // Crackling Golden Uppercut Lightning
      for (let i = 0; i < 2; i++) {
        const ox = i === 0 ? -0.7 : 0.7;
        addMesh(this.geo.plane, 'gold_lightning_arc', '#fde047', 2.8, (m) => {
          m.position.set(ox, 2.2, 1.0);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.scale.set(1.1, 3.6, 1);
          mat.opacity = clamp01(1 - t * 1.25) * (0.55 + 0.45 * Math.abs(Math.sin(t * 50 + i * 2)));
        });
      }

      addSparks(24, {
        color: '#fde047', ox: 0, oy: 0.8, oz: 0.95, radius: 1.0,
        swirl: 8.0, speedMin: 0.6, speedMax: 1.8, vyMin: 4.5, vyMax: 9.5, gravity: -3.5, size: 0.38
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: ASURA HUNDRED FISTS (Rapid-Fire 100-Fist Flurry + Dragon Finisher!)
    //    (Matches server.js hundred_fists at player + dir*2.0, AoE radius = 3.4m!)
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_weapon') {
      duration = 1.24;

      // Giant 6.8m Sacred Thai Lai-Thai Kranok Mandala beneath the 100-Fist Arena!
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 5.2;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.2;
        mat.opacity = clamp01(t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4)) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#facc15', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 5.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.2;
        mat.opacity = clamp01(t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4)) * 0.96;
      });

      // 14 Staggered Ultra-Rapid Kinetic Punch Clusters & Tiger Fist Impacts ("ORA ORA" Barrage!)
      for (let i = 0; i < 14; i++) {
        const delay = i * 0.036;
        const px = ((i % 5) - 2) * 0.65 + (Math.sin(i * 3.1) * 0.28);
        const py = 0.65 + (i % 3) * 0.52;
        const pz = -1.2 + (i % 4) * 0.85;
        const useCluster = (i % 2 === 0);
        const col = i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#fde047' : '#dc2626');

        addMesh(this.geo.plane, useCluster ? 'rapid_fist_barrage' : 'tiger_fist_impact', '#450a0a', 1.0, (m) => {
          m.position.set(px, py, pz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.24;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(i * 0.9 + lt * 4.0);
          const s = 0.95 + easeOutCubic(lt) * 1.9;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.88;
        }, false);
        addMesh(this.geo.plane, useCluster ? 'rapid_fist_barrage' : 'tiger_fist_impact', col, 2.8, (m) => {
          m.position.set(px, py + 0.02, pz + 0.03);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.24;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(i * 0.9 + lt * 4.0);
          const s = 0.90 + easeOutCubic(lt) * 1.8;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // CLIMAX GOLDEN DRAGON FINISHER PUNCH DETONATION (fires at t = 0.44 -> 1.0!)
      addMesh(this.geo.plane, 'golden_shock_ring', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.10, 0);
      }, (m, mat, t) => {
        const lt = (t - 0.42) / 0.52;
        if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
        const s = 1.6 + easeOutCubic(lt) * 6.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'golden_shock_ring', '#ffffff', 2.9, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.14, 0);
      }, (m, mat, t) => {
        const lt = (t - 0.42) / 0.52;
        if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
        const s = 1.5 + easeOutCubic(lt) * 6.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });
      addMesh(this.geo.plane, 'tiger_flare', '#ffffff', 3.2, (m) => {
        m.position.set(0, 1.3, 0);
      }, (m, mat, t) => {
        const lt = (t - 0.42) / 0.44;
        if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(lt * 3.0);
        const s = 2.0 + easeOutCubic(lt) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });

      // 4 Crackling Golden-White Asura Thunderbolts at Climax
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        addMesh(this.geo.plane, 'gold_lightning_arc', '#fde047', 2.8, (m) => {
          m.position.set(Math.cos(ang) * 1.6, 1.65, Math.sin(ang) * 1.6);
        }, (m, mat, t) => {
          const lt = (t - 0.40) / 0.48;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.scale.set(1.25, 3.2, 1);
          mat.opacity = clamp01(1 - lt) * (0.55 + 0.45 * Math.abs(Math.sin(lt * 44 + i)));
        });
      }

      addSparks(28, {
        color: '#fde047', radius: 2.0, oy: 1.1, oySpread: 0.9,
        forwardBias: 2.5, speedMin: 2.2, speedMax: 6.5, vyMin: 1.6, vyMax: 5.5, maxDelay: 0.42, size: 0.40
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: SWAY & LIVER BLOW (Evade Halo + Piercing Counter Gut-Punch!)
    //    (700ms Invuln + 3.2m Forward AoE 2.0s Stun!)
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_armor') {
      duration = 0.92;

      // Sway Evade Sacred Thai Lotus Halo under Striker
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 3.2;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 6.0;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#facc15', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.4 + ease * 3.1;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 6.0;
        mat.opacity = clamp01(1 - t);
      });

      // DEVASTATING COUNTER LIVER BLOW IMPACT BURST at z = 1.65m!
      addMesh(this.geo.plane, 'tiger_fist_impact', '#450a0a', 1.0, (m) => {
        m.position.set(0, 1.06, 1.62);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 5.5);
        const s = 1.6 + ease * 3.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.15) * 0.95;
      }, false);
      addMesh(this.geo.plane, 'tiger_fist_impact', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.08, 1.66);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 5.5);
        const s = 1.5 + ease * 3.45;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // 3 Vertical Piercing Gut-Punch Sonic Boom Rings Blasting Straight Through Enemy!
      for (let i = 0; i < 3; i++) {
        const rz = 1.25 + i * 1.05;
        const delay = i * 0.05;
        addMesh(this.geo.plane, 'golden_shock_ring', '#450a0a', 1.0, (m) => {
          m.position.set(0, 1.05, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.55;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 1.0 + easeOutCubic(lt) * (3.2 - i * 0.35);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'golden_shock_ring', i === 0 ? '#dc2626' : '#fde047', 2.8, (m) => {
          m.position.set(0, 1.05, rz + 0.04);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.55;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.95 + easeOutCubic(lt) * (3.05 - i * 0.35);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Blinding Counter Flash & 3 Stun Lightning Discharges (2.0s Stun!)
      addMesh(this.geo.plane, 'tiger_flare', '#ffffff', 3.1, (m) => {
        m.position.set(0, 1.08, 1.72);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.8 + ease * 4.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.75);
      });
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 0.95;
        addMesh(this.geo.plane, 'gold_lightning_arc', '#fde047', 2.8, (m) => {
          m.position.set(ox, 1.35, 1.75);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ((i - 1) * 0.4);
          m.scale.set(1.1, 2.7, 1);
          mat.opacity = clamp01(1 - t * 1.3) * (0.5 + 0.5 * Math.abs(Math.sin(t * 48 + i * 2)));
        });
      }

      addSparks(22, {
        color: '#fde047', ox: 0, oy: 1.05, oz: 1.65, radius: 0.65,
        forwardBias: 5.5, speedMin: 2.0, speedMax: 6.2, vyMin: 1.0, vyMax: 4.0, size: 0.38
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: LIGHTNING FOOTWORK (Golden Thunderbolt Dash + -3s CD Reset!)
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_helmet') {
      duration = 0.85;

      // Rapidly Spinning Cooldown-Reset Sacred Thai Lotus Halo!
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 3.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 8.5;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#fef08a', 2.7, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.4 + ease * 3.7;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 8.5;
        mat.opacity = clamp01(1 - t);
      });

      // 5 Staggered Golden Thunderbolts Striking Along the 4.6m Footwork Dash Line!
      for (let i = 0; i < 5; i++) {
        const bz = 0.4 + i * 1.05;
        const bx = (i % 2 === 0 ? -0.45 : 0.45);
        const delay = i * 0.04;
        addMesh(this.geo.plane, 'gold_lightning_arc', i % 2 === 0 ? '#ffffff' : '#fde047', 2.9, (m) => {
          m.position.set(bx, 1.75, bz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.52;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ((i % 2 === 0 ? 0.12 : -0.12));
          m.scale.set(1.25, 3.6, 1);
          mat.opacity = clamp01(1 - lt) * (0.55 + 0.45 * Math.abs(Math.sin(lt * 52 + i)));
        });
      }

      // 3 Forward Mach Footwork Shock Gates
      for (let i = 0; i < 3; i++) {
        const rz = 0.8 + i * 1.5;
        const delay = i * 0.045;
        addMesh(this.geo.plane, 'golden_shock_ring', '#fde047', 2.6, (m) => {
          m.position.set(0, 1.05, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.50;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.95 + easeOutCubic(lt) * 2.5;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      addMesh(this.geo.plane, 'tiger_flare', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.15, 0.4);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + ease * 3.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.8);
      });

      addSparks(22, {
        color: '#fef08a', ox: 0, oy: 0.9, oz: 2.2, radius: 0.7, ozSpread: 4.0,
        speedMin: 1.2, speedMax: 3.4, vyMin: 1.0, vyMax: 3.8, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: SEISMIC GROUND STOMP (8.4m Thai Mandala + Skyward Updraft!)
    //    (Matches server.js shockwave radius 4.2m -> 8.4m diameter, launchY: 12.5!)
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_trinket') {
      duration = 1.08;

      // 8.6m Radiating Golden-Amber Seismic Stomp Fissure Wheel on Floor
      addMesh(this.geo.plane, 'stomp_fissure_ring', '#3b1006', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.2 + ease * 6.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.05) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'stomp_fissure_ring', '#facc15', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.1 + ease * 6.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // Giant 8.2m Sacred Thai Lai-Thai Kranok Lotus Mandala!
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.07, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 6.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.5;
        mat.opacity = clamp01(1 - t * 1.05) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.10, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 6.2;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.5;
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // 3 Concentric Skyward-Launching Golden Updraft Shockwave Rings (matching launchY: 12.5!)
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.07;
        addMesh(this.geo.plane, 'golden_shock_ring', i === 0 ? '#ffffff' : (i === 1 ? '#fde047' : '#dc2626'), 2.7, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.15, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.65;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.position.y = gyOffset + 0.15 + le * (3.2 + i * 0.6);
          const s = 1.6 + le * 6.8;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // 4 Vertical Perimeter Golden Shock Thunderbolts Erupting Skyward!
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
        addMesh(this.geo.plane, 'gold_lightning_arc', '#fde047', 2.8, (m) => {
          m.position.set(Math.cos(ang) * 2.4, 2.0, Math.sin(ang) * 2.4);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.scale.set(1.3, 4.0, 1);
          mat.opacity = clamp01(1 - t * 1.25) * (0.55 + 0.45 * Math.abs(Math.sin(t * 46 + i)));
        });
      }

      addSparks(26, {
        color: '#fde047', radius: 3.2, oy: 0.3,
        speedMin: 0.8, speedMax: 2.5, vyMin: 5.5, vyMax: 11.5, gravity: -6.5, size: 0.42
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: AIR SWAY FOOTWORK / DOUBLE JUMP!
    // ------------------------------------------------------------------------
    else if (effectId === 'striker_mobility_sway') {
      duration = 0.44;

      addMesh(this.geo.plane, 'thai_lotus_mandala', '#450a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 1.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 7.5;
        mat.opacity = clamp01(1 - t) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'thai_lotus_mandala', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.09, 0);
      }, (m, mat, t, ease) => {
        const s = 0.85 + ease * 1.75;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 7.5;
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'golden_shock_ring', '#ffffff', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.12, 0);
      }, (m, mat, t, ease) => {
        const s = 0.8 + ease * 2.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addSparks(10, {
        color: '#fde047', radius: 0.5, oy: 0.65, speedMin: 1.0, speedMax: 2.8, vyMin: 0.5, vyMax: 2.2, size: 0.30
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
        const st = clamp01(localT / Math.max(0.16, fx.duration - sp.delay));

        let px, pz;
        if (sp.swirl) {
          const curAng = sp.swirlAngle + localT * sp.swirl;
          px = sp.ox + Math.cos(curAng) * sp.swirlRadius;
          pz = sp.oz + Math.sin(curAng) * sp.swirlRadius;
        } else {
          px = sp.ox + sp.vx * localT;
          pz = sp.oz + sp.vz * localT;
        }
        const py = Math.max(0.08, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT);

        sp.mesh.position.set(px, py, pz);
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);

        const sc = sp.baseSz * (1.1 - st * 0.65);
        sp.mesh.scale.set(sc * 0.45, sc * 1.55, 1);
        sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
        sp.mat.opacity = clamp01((1 - st) * 1.18);
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
