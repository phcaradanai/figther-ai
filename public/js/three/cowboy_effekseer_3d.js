// ============================================================================
// LOST SAGA 3D - DESPERADO COWBOY 3D EFFEKSEER + THREE.JS HDR-BLOOM VFX SYSTEM
// ============================================================================
// Dedicated 7-move Desperado Cowboy (คาวบอยปืนคู่) 3D VFX suite for ThreeRenderer:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep espresso-charcoal /
//      gunpowder-smoke NormalBlending silhouettes + High Noon Gold / Sunset Amber /
//      Dynamite Crimson Additive HDR Bloom using our 10 custom 512x512 PNGs!
// ============================================================================
import * as THREE from 'three';

const COWBOY_TEX_NAMES = [
  'sheriff_crest',
  'deadeye_reticle',
  'muzzle_star',
  'bullet_tracer',
  'sonic_ring',
  'tnt_bundle',
  'tnt_blast',
  'lasso_loop',
  'gun_smoke',
  'brass_spark'
];

const COWBOY_EFFECT_IDS = new Set([
  'cowboy_basic_shot',
  'cowboy_heavy_deadeye',
  'cowboy_weapon',
  'cowboy_armor',
  'cowboy_helmet',
  'cowboy_trinket',
  'cowboy_mobility_tumble'
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

export class CowboyThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'CowboyThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of COWBOY_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/cowboy/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
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
   * Handle server FX events for Desperado Cowboy (including stolen Cowboy gear skills!).
   * Returns true if handled/suppressed by the Cowboy 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && COWBOY_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'cowboy_armor') this.shake(8);
      else if (mapped.effectId === 'cowboy_weapon') this.shake(7);
      else if (mapped.effectId === 'cowboy_heavy_deadeye') this.shake(6);
      else if (mapped.effectId === 'cowboy_helmet') this.shake(4);
      else if (mapped.effectId === 'cowboy_trinket') this.shake(4);
      else if (mapped.effectId === 'cowboy_basic_shot' && mapped.isFinisher) this.shake(3);

      return true;
    }

    // Suppress ONLY Cowboy's duplicate secondary events
    if (fx.type === 'skill_cast' && (fx.skillId === 'cowboy_armor' || fx.skillId === 'cowboy_trinket')) {
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
        const mat = this.makeMat(cfg.tex || 'brass_spark', cfg.color, cfg.intensity || 2.3, 1.0, cfg.additive !== false);
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
        const sz = (cfg.size || 0.30) * (0.75 + Math.random() * 0.65);
        root.add(mesh);
        sparks.push({
          mesh, mat, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : -8.5,
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.12),
          baseSz: sz,
          isCloud: cfg.tex === 'gun_smoke',
          rotSpeed: (Math.random() - 0.5) * 3.5,
          rotInit: Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: DUAL REVOLVER QUICKDRAW (Star Muzzle + Gunpowder Smoke!)
    //    (No fake moving bullet mesh — keeps the real server bullet crystal clear!)
    // ------------------------------------------------------------------------
    if (effectId === 'cowboy_basic_shot') {
      duration = opts.isFinisher ? 0.38 : 0.26;
      const side = (opts.comboStep % 2 === 0) ? -0.22 : 0.22;

      // Dark Espresso Muzzle Backing + Blazing Western Star Flash at barrel
      addMesh(this.geo.plane, 'muzzle_star', '#3b1606', 1.0, (m) => {
        m.position.set(side, 1.02, 0.95);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 8.0);
        const s = (opts.isFinisher ? 1.25 : 0.85) + ease * (opts.isFinisher ? 1.55 : 1.05);
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.45) * 0.85;
      }, false);
      addMesh(this.geo.plane, 'muzzle_star', '#fde047', 2.6, (m) => {
        m.position.set(side, 1.03, 0.98);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 8.0);
        const s = (opts.isFinisher ? 1.15 : 0.78) + ease * (opts.isFinisher ? 1.45 : 0.95);
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.55);
      });

      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'sonic_ring', '#fde047', 2.5, (m) => {
          m.position.set(0, 1.02, 1.30);
        }, (m, mat, t, ease) => {
          const s = 0.65 + ease * 1.9;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25);
        });
      }

      addSparks(4, {
        tex: 'gun_smoke', additive: false, color: '#5c4028', intensity: 1.0,
        ox: side, oy: 1.02, oz: 1.05, radius: 0.2,
        forwardBias: 1.8, speedMin: 0.5, speedMax: 1.4, vyMin: 0.4, vyMax: 1.2, gravity: 0.2, size: 0.82
      });
      addSparks(opts.isFinisher ? 12 : 6, {
        color: '#fde047', ox: side, oy: 1.02, oz: 1.05,
        forwardBias: 4.5, speedMin: 1.0, speedMax: 3.0, size: 0.24
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: DEADEYE MAGNUM (Crosshair Lock + Muzzle Sonic Boom Rings!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_heavy_deadeye') {
      duration = 0.62;

      // Iconic Western Deadeye Crosshair Reticle locking in front of Cowboy!
      addMesh(this.geo.plane, 'deadeye_reticle', '#260d04', 1.0, (m) => {
        m.position.set(0, 1.08, 1.45);
      }, (m, mat, t, ease) => {
        const s = 2.8 - ease * 1.15;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'deadeye_reticle', '#fbbf24', 2.6, (m) => {
        m.position.set(0, 1.08, 1.49);
      }, (m, mat, t, ease) => {
        const s = 2.65 - ease * 1.1;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      // 2 Supersonic Muzzle Boom Rings (shows launch power while letting the real magnum projectile read cleanly!)
      for (let i = 0; i < 2; i++) {
        const delay = i * 0.05;
        const rz = 1.35 + i * 0.95;
        addMesh(this.geo.plane, 'sonic_ring', '#260d04', 1.0, (m) => {
          m.position.set(0, 1.06, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.52;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.65 + easeOutCubic(lt) * (2.4 - i * 0.4);
          m.scale.set(s, s, 1);
          mat.opacity = (1 - lt) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'sonic_ring', '#fde047', 2.5, (m) => {
          m.position.set(0, 1.06, rz + 0.03);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.52;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.60 + easeOutCubic(lt) * (2.3 - i * 0.4);
          m.scale.set(s, s, 1);
          mat.opacity = 1 - lt;
        });
      }

      // Blazing Magnum Muzzle Starburst
      addMesh(this.geo.plane, 'muzzle_star', '#fef08a', 2.9, (m) => {
        m.position.set(0, 1.08, 1.15);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.2 + ease * 2.5;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 2.2);
      });

      addSparks(8, {
        tex: 'gun_smoke', additive: false, color: '#3b2212', intensity: 1.0,
        ox: 0, oy: 0.45, oz: 0.4, radius: 0.6,
        forwardBias: -2.0, speedMin: 0.8, speedMax: 2.2, vyMin: 0.4, vyMax: 1.3, gravity: 0.1, size: 1.4
      });
      addSparks(18, {
        color: '#fde047', ox: 0, oy: 1.05, oz: 1.2,
        forwardBias: 5.5, speedMin: 1.5, speedMax: 4.2, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: HIGH NOON BARRAGE (8.4m Sundial + Golden Ground Blast!)
    //    (Real 12-way server bullets fly cleanly with zero fake duplicate tracers!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_weapon') {
      duration = 1.15;
      const SLAM_T = 0.66 / 1.15; // Syncs with ChibiView's double-barrel ground slam at 0.71s!

      // Giant 8.4m High Noon Sheriff Sundial & 6-Chamber Revolver Circle on ground!
      addMesh(this.geo.plane, 'sheriff_crest', '#241005', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01((t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4))) * 0.98;
      }, false);
      addMesh(this.geo.plane, 'sheriff_crest', '#fbbf24', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01((t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4))) * 0.96;
      });

      // Outer 8.8m High-Speed Sonic Ring Boundary
      addMesh(this.geo.plane, 'sonic_ring', '#291105', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.07, 0);
      }, (m, mat, t, ease) => {
        const s = 2.2 + ease * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 6.5;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'sonic_ring', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.10, 0);
      }, (m, mat, t, ease) => {
        const s = 2.1 + ease * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 6.5;
        mat.opacity = clamp01(1 - t);
      });

      // Staggered 360-degree muzzle flash stars around Cowboy's guns (no fake flying bullets!)
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const delay = i * 0.07;
        addMesh(this.geo.plane, 'muzzle_star', '#fde047', 2.6, (m) => {
          m.position.set(Math.cos(ang) * 0.95, 1.04, Math.sin(ang) * 0.95);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.24;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 0.8 + easeOutCubic(lt) * 1.4;
          m.scale.set(s, s, 1);
          mat.opacity = 1 - lt;
        });
      }

      // Climax Golden Ground-Blast Starburst at t = 0.66s!
      addMesh(this.geo.plane, 'tnt_blast', '#380e04', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.14, 0);
      }, (m, mat, t) => {
        if (t < SLAM_T) { mat.opacity = 0; return; }
        const st = clamp01((t - SLAM_T) / (1 - SLAM_T));
        const s = 1.8 + easeOutCubic(st) * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = st * 2.0;
        mat.opacity = (1 - st) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'tnt_blast', '#fbbf24', 2.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.18, 0);
      }, (m, mat, t) => {
        if (t < SLAM_T) { mat.opacity = 0; return; }
        const st = clamp01((t - SLAM_T) / (1 - SLAM_T));
        const s = 1.6 + easeOutCubic(st) * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = st * 2.0;
        mat.opacity = 1 - st;
      });

      // Swirling Canyon Dust + High Noon Brass Shell Sparks
      addSparks(12, {
        tex: 'gun_smoke', additive: false, color: '#3b2414', intensity: 1.0,
        radius: 1.8, oy: 0.45, oySpread: 0.25,
        speedMin: 1.5, speedMax: 3.6, vyMin: 0.4, vyMax: 1.6, gravity: -0.2, maxDelay: 0.3, size: 2.1
      });
      addSparks(28, {
        color: '#fde047', radius: 1.0, oy: 1.0,
        speedMin: 2.8, speedMax: 6.5, vyMin: 1.5, vyMax: 4.5, gravity: -9.0, maxDelay: 0.45, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: TNT DYNAMITE TOSS (Lobbing TNT Bundle + 8.4m Blast!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_armor') {
      duration = 1.25;
      const DET_T = 0.22 / 1.25; // TNT arcs in cleanly and detonates at 0.22s!

      // Pulsing Crimson-Gold Target Blast Zone Reticle (4.0m radius = 8.0m diameter!)
      addMesh(this.geo.plane, 'deadeye_reticle', '#2e0704', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 6.2;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t * 1.1) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'deadeye_reticle', '#ef4444', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 6.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t * 1.15);
      });

      // Phase 1 (0..0.22s): Spinning Red TNT Dynamite Bundle arcing from Cowboy (0, 1.1, -4.5) to (0, 0.5, 0)!
      addMesh(this.geo.plane, 'tnt_bundle', '#ffffff', 1.0, null, (m, mat, t) => {
        if (t >= DET_T + 0.02) { mat.opacity = 0; return; }
        const lt = clamp01(t / DET_T);
        const zPos = -4.5 * (1 - lt);
        const yPos = 1.1 * (1 - lt) + 0.5 * lt + Math.sin(lt * Math.PI) * 2.8;
        m.position.set(0, yPos, zPos);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 24.0);
        m.scale.set(1.55, 1.55, 1);
        mat.opacity = 1.0;
      }, false);

      // Phase 2 (0.22s..1.25s): MASSIVE TNT DYNAMITE BLAST + 8.4m SHOCKWAVE!
      addMesh(this.geo.plane, 'tnt_blast', '#2b0804', 1.0, (m) => {
        m.position.set(0, 1.35, 0);
      }, (m, mat, t) => {
        if (t < DET_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DET_T) / 0.65);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 2.2 + easeOutCubic(dt2) * 5.8;
        m.scale.set(s, s, 1);
        m.rotateZ(dt2 * 1.4);
        mat.opacity = clamp01(1 - dt2) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'tnt_blast', '#f97316', 2.8, (m) => {
        m.position.set(0, 1.40, 0);
      }, (m, mat, t) => {
        if (t < DET_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DET_T) / 0.65);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 2.0 + easeOutCubic(dt2) * 5.5;
        m.scale.set(s, s, 1);
        m.rotateZ(dt2 * 1.4);
        mat.opacity = clamp01(1 - dt2);
      });

      addMesh(this.geo.plane, 'sonic_ring', '#2e0804', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, 0);
      }, (m, mat, t) => {
        if (t < DET_T) { mat.opacity = 0; return; }
        const wt = clamp01((t - DET_T) / 0.55);
        const s = 1.4 + easeOutCubic(wt) * 7.6;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.96 : 0;
      }, false);
      addMesh(this.geo.plane, 'sonic_ring', '#fde047', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.13, 0);
      }, (m, mat, t) => {
        if (t < DET_T) { mat.opacity = 0; return; }
        const wt = clamp01((t - DET_T) / 0.55);
        const s = 1.2 + easeOutCubic(wt) * 7.4;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      addMesh(this.geo.plane, 'muzzle_star', '#fef08a', 3.0, (m) => {
        m.position.set(0, 1.25, 0);
      }, (m, mat, t) => {
        if (t < DET_T) { mat.opacity = 0; return; }
        const dt2 = clamp01((t - DET_T) / 0.32);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.8 + easeOutCubic(dt2) * 5.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - dt2);
      });

      // 16 Billowing Charcoal Gunpowder Smoke Clouds + 32 Blazing Dynamite Embers!
      addSparks(16, {
        tex: 'gun_smoke', additive: false, color: '#21120a', intensity: 1.0,
        radius: 1.8, oy: 0.9, oySpread: 0.55,
        speedMin: 1.8, speedMax: 4.4, vyMin: 1.2, vyMax: 3.6, gravity: -0.6,
        baseDelay: 0.21, maxDelay: 0.12, size: 2.85
      });
      addSparks(32, {
        color: '#fde047', radius: 1.0, oy: 0.8,
        speedMin: 3.4, speedMax: 8.6, vyMin: 3.2, vyMax: 8.0, gravity: -11.0,
        baseDelay: 0.21, maxDelay: 0.12, size: 0.42
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: TACTICAL ROLL & STUN SHOT (Flashbang Star + Beam!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_helmet') {
      duration = 0.68;

      // Golden Invulnerability Dodge Sonic Ring
      addMesh(this.geo.plane, 'sonic_ring', '#2b1205', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.05, 0);
      }, (m, mat, t, ease) => {
        const s = 1.0 + ease * 3.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.2) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'sonic_ring', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 0.95 + ease * 3.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25);
      });

      // Blinding Flashbang Starburst Cone firing forward! (No fake bullet beam — real stun magnum projectile stays 100% clear!)
      addMesh(this.geo.plane, 'muzzle_star', '#3b1c04', 1.0, (m) => {
        m.position.set(0, 1.08, 1.5);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 9.0);
        const s = 1.3 + ease * 3.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.45) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'muzzle_star', '#fef08a', 3.0, (m) => {
        m.position.set(0, 1.10, 1.55);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 9.0);
        const s = 1.2 + ease * 3.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.5);
      });

      addSparks(10, {
        tex: 'gun_smoke', additive: false, color: '#4f321c', intensity: 1.0,
        radius: 0.65, oy: 0.4, speedMin: 1.2, speedMax: 2.8, vyMin: 0.4, vyMax: 1.4, gravity: -0.2, size: 1.5
      });
      addSparks(14, {
        color: '#fef08a', ox: 0, oy: 1.05, oz: 1.3,
        forwardBias: 5.0, speedMin: 1.4, speedMax: 3.8, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: BOUNTY HUNTER LASSO (8m Rope Line + Cinching Snare!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_trinket') {
      duration = 0.80;

      // Overhead Whirling Cowboy Lasso Loop
      addMesh(this.geo.plane, 'lasso_loop', '#2b1205', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 1.72, 0.3);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 1.5;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 18.0;
        mat.opacity = clamp01(1 - t * 1.6) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'lasso_loop', '#fbbf24', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 1.75, 0.3);
      }, (m, mat, t, ease) => {
        const s = 1.15 + ease * 1.45;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 18.0;
        mat.opacity = clamp01(1 - t * 1.65);
      });

      // Taut 8.0m Braided Golden Rope Beam shooting out (0..0.3) then yanking back (0.3..1)!
      addMesh(this.geo.plane, 'bullet_tracer', '#2b1204', 1.0, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
      }, (m, mat, t) => {
        const reach = t < 0.25 ? easeOutCubic(t / 0.25) : Math.max(0.18, 1 - (t - 0.25) * 1.05);
        const len = 8.2 * reach;
        m.position.set(0, 1.00, len * 0.5 + 0.3);
        m.scale.set(len, 0.72, 1);
        mat.opacity = clamp01(1 - Math.max(0, (t - 0.65) / 0.35)) * 0.95;
      }, false);
      addMesh(this.geo.plane, 'bullet_tracer', '#f59e0b', 2.5, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
      }, (m, mat, t) => {
        const reach = t < 0.25 ? easeOutCubic(t / 0.25) : Math.max(0.18, 1 - (t - 0.25) * 1.05);
        const len = 8.2 * reach;
        m.position.set(0, 1.04, len * 0.5 + 0.3);
        m.scale.set(len, 0.54, 1);
        mat.opacity = clamp01(1 - Math.max(0, (t - 0.65) / 0.35));
      });

      // Giant Cinching Lasso Snare Ring + Wanted Reticle racing to 8.0m then YANKING INWARD!
      addMesh(this.geo.plane, 'lasso_loop', '#2b1204', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
      }, (m, mat, t) => {
        const reach = t < 0.25 ? easeOutCubic(t / 0.25) : Math.max(0.18, 1 - (t - 0.25) * 1.05);
        m.position.set(0, 0.92, 0.5 + 7.8 * reach);
        const s = t < 0.32 ? (3.2 - (t / 0.32) * 1.5) : 1.7;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        mat.opacity = clamp01(1 - Math.max(0, (t - 0.65) / 0.35)) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'lasso_loop', '#fde047', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
      }, (m, mat, t) => {
        const reach = t < 0.25 ? easeOutCubic(t / 0.25) : Math.max(0.18, 1 - (t - 0.25) * 1.05);
        m.position.set(0, 0.96, 0.5 + 7.8 * reach);
        const s = t < 0.32 ? (3.1 - (t / 0.32) * 1.45) : 1.65;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        mat.opacity = clamp01(1 - Math.max(0, (t - 0.65) / 0.35));
      });

      // Floor Wanted Lock Reticle at max lasso reach
      addMesh(this.geo.plane, 'deadeye_reticle', '#d97706', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 7.6);
      }, (m, mat, t, ease) => {
        const s = 3.2 - ease * 1.2;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 5.0;
        mat.opacity = clamp01(1 - t * 1.3);
      });

      addSparks(8, {
        tex: 'gun_smoke', additive: false, color: '#4f321c', intensity: 1.0,
        ox: 0, oy: 0.45, oz: 7.4, radius: 0.9,
        forwardBias: -4.5, speedMin: 1.0, speedMax: 2.5, vyMin: 0.5, vyMax: 1.5, gravity: -0.2, size: 1.6
      });
      addSparks(20, {
        color: '#fde047', ox: 0, oy: 0.95, oz: 7.4,
        forwardBias: -6.0, speedMin: 1.5, speedMax: 4.5, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: DOUBLE JUMP / TUMBLE DASH (Sheriff Spur Star + Canyon Dust!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cowboy_mobility_tumble') {
      duration = 0.46;

      addMesh(this.geo.plane, 'sheriff_crest', '#261005', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 0.8 + ease * 2.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'sheriff_crest', '#fbbf24', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.09, 0);
      }, (m, mat, t, ease) => {
        const s = 0.75 + ease * 2.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t);
      });

      addSparks(7, {
        tex: 'gun_smoke', additive: false, color: '#4f321c', intensity: 1.0,
        radius: 0.5, oy: 0.35, speedMin: 1.0, speedMax: 2.4, vyMin: 0.3, vyMax: 1.2, gravity: -0.2, size: 1.35
      });
      addSparks(12, {
        color: '#fde047', radius: 0.4, oy: 0.45,
        speedMin: 1.5, speedMax: 4.0, vyMin: 0.8, vyMax: 2.6, size: 0.26
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
