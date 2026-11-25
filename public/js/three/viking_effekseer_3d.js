// ============================================================================
// LOST SAGA 3D - VIKING BERSERKER (NORSE RAGNAROK) 3D EFFEKSEER + THREE.JS VFX
// ============================================================================
// Dedicated 7-move Viking Berserker (ไวกิ้งคลั่ง) 3D VFX suite:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Heavy volcanic basalt,
//      forged iron, and blood-crimson NormalBlending silhouettes (#1c1410 /
//      #3b0a0a) paired with molten forge-copper (#ea580c / #f97316),
//      Valhalla rage scarlet (#dc2626), and Norse gold (#fde047) HDR Bloom
//      using our 10 512x512 Norse Berserker PNGs!
// ============================================================================
import * as THREE from 'three';

const VIKING_TEX_NAMES = [
  'norse_rune_circle',
  'axe_cleave_arc',
  'whirlwind_axe_ring',
  'tectonic_crater',
  'earth_pillar_rock',
  'valhalla_rage_vortex',
  'seismic_shock_ring',
  'colossus_claw_impact',
  'rock_chunk',
  'berserk_ember'
];

const VIKING_EFFECT_IDS = new Set([
  'viking_basic_axe',
  'viking_heavy_whirlwind',
  'viking_weapon',
  'viking_armor',
  'viking_helmet',
  'viking_trinket',
  'viking_mobility_rush'
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

export class VikingThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'VikingThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      rageSheath: new THREE.CylinderGeometry(1.18, 0.85, 1.0, 26, 1, true),
      innerSheath: new THREE.CylinderGeometry(0.92, 0.68, 1.0, 22, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of VIKING_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/viking/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'valhalla_rage_vortex') {
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
   * Handle server FX events for Viking Berserker (including stolen Viking gear skills!).
   * Returns true if handled/suppressed by the Viking 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && VIKING_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'viking_weapon') this.shake(10);
      else if (mapped.effectId === 'viking_helmet') this.shake(7);
      else if (mapped.effectId === 'viking_armor') this.shake(6);
      else if (mapped.effectId === 'viking_heavy_whirlwind') this.shake(6);
      else if (mapped.effectId === 'viking_trinket') this.shake(4);
      else if (mapped.effectId === 'viking_basic_axe' && mapped.isFinisher) this.shake(5);

      return true;
    }

    // Suppress ONLY Viking's duplicate secondary server events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'viking') ||
      (fx.type === 'skill_cast' && fx.skillId === 'viking_weapon') ||
      (fx.type === 'shockwave' && fx.fromSkill === 'viking_armor')
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
    const debris = [];
    let duration = 0.78;
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

    // Helper: 3D Crossed Erupting Volcanic Basalt Rock Slab (NormalBlending solid rock + molten ember glow!)
    const addRockSlab = (cfg) => {
      const planes = cfg.planes || 2;
      const slab = new THREE.Group();
      slab.position.set(cfg.ox || 0, cfg.baseY !== undefined ? cfg.baseY : gyOffset, cfg.oz || 0);
      slab.rotation.y = cfg.rotY || 0;
      if (cfg.tiltX) slab.rotation.x = cfg.tiltX;
      if (cfg.tiltZ) slab.rotation.z = cfg.tiltZ;
      root.add(slab);

      const mats = [];
      for (let p = 0; p < planes; p++) {
        const ang = (p / planes) * Math.PI;
        // Solid heavy faceted basalt rock slab (NormalBlending so stone pops dramatically on sunlit floor!)
        const rockMat = this.makeMat('earth_pillar_rock', cfg.rockHex || '#ffffff', 1.0, 0.98, false);
        const rockM = new THREE.Mesh(this.geo.plane, rockMat);
        rockM.rotation.y = ang;
        rockM.position.y = 0.5;
        rockM.renderOrder = 17;
        slab.add(rockM);

        // Subtle molten orange fissure glow overlay
        const emberMat = this.makeMat('earth_pillar_rock', cfg.glowHex || '#ea580c', cfg.intensity || 1.6, 0.48, true);
        const emberM = new THREE.Mesh(this.geo.plane, emberMat);
        emberM.rotation.y = ang;
        emberM.position.y = 0.51;
        emberM.scale.set(1.03, 1.02, 1);
        emberM.renderOrder = 19;
        slab.add(emberM);

        mats.push(rockMat, emberMat);
      }

      const delay = cfg.delay || 0;
      const life = cfg.life || 0.85;
      const maxW = cfg.width || 1.65;
      const maxH = cfg.height || 3.1;

      parts.push({
        mesh: slab,
        mat: mats[0],
        extraMats: mats.slice(1),
        update: (g, _m, t) => {
          const lt = (t - delay) / life;
          if (lt <= 0 || lt >= 1) { g.visible = false; return; }
          g.visible = true;
          const riseT = clamp01(lt / 0.14);
          const rise = easeOutCubic(riseT);
          const sink = lt > 0.72 ? clamp01(1 - (lt - 0.72) / 0.28) : 1.0;
          const curH = Math.max(0.06, maxH * rise * (0.2 + 0.8 * sink));
          g.scale.set(maxW * (0.65 + 0.35 * rise), curH, maxW * (0.65 + 0.35 * rise));
          for (let k = 0; k < mats.length; k++) {
            const isRock = (k % 2 === 0);
            mats[k].opacity = (isRock ? 0.98 : 0.45) * sink;
          }
        }
      });
    };

    const addDebris = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const isRock = (cfg.kind || 'ember') === 'rock';
        const tex = cfg.tex || (isRock ? 'rock_chunk' : 'berserk_ember');
        const additive = cfg.additive !== undefined ? cfg.additive : !isRock;
        const mat = this.makeMat(tex, cfg.color || (isRock ? '#ffffff' : '#fb923c'), cfg.intensity || (additive ? 2.4 : 1.0), 1.0, additive);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = additive ? 20 : 18;

        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.8);
        const spd = (cfg.speedMin !== undefined ? cfg.speedMin : 1.6) + Math.random() * (cfg.speedMax !== undefined ? cfg.speedMax : 4.6);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin !== undefined ? cfg.vyMin : 1.8) + Math.random() * (cfg.vyMax !== undefined ? cfg.vyMax : 4.5);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy !== undefined ? cfg.oy : 0.55) + (Math.random() - 0.5) * (cfg.oySpread || 0.4);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0.4);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || (isRock ? 0.55 : 0.36)) * (0.7 + Math.random() * 0.7);
        root.add(mesh);

        debris.push({
          mesh, mat, isRock, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : (isRock ? -16.5 : -4.5),
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.12),
          baseSz: sz,
          swirl: cfg.swirl || 0,
          swirlRadius: rad,
          swirlAngle: ang,
          rotSpeed: (Math.random() - 0.5) * (isRock ? 12.0 : 6.0),
          rotInit: Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: TWIN BATTLEAXE CLEAVES + X-CHOP GROUND SLAM FINISHER!
    // ------------------------------------------------------------------------
    if (effectId === 'viking_basic_axe') {
      duration = opts.isFinisher ? 0.54 : 0.38;
      const swingDir = (opts.comboStep % 2 === 0) ? -1 : 1;

      if (opts.isFinisher) {
        // Brutal Twin X-Crossed Double-Axe Overhead Slam!
        for (let k = 0; k < 2; k++) {
          const tilt = k === 0 ? 0.45 : -0.45;
          addMesh(this.geo.plane, 'axe_cleave_arc', '#2b1006', 1.0, (m) => {
            m.position.set(tilt * 0.4, 1.15, 0.85);
          }, (m, mat, t, ease) => {
            m.rotation.set(0, Math.PI * 0.5 + tilt, -1.6 + ease * 2.4);
            const s = 2.9 + ease * 1.4;
            m.scale.set(s, s, 1);
            mat.opacity = clamp01(1 - t * 1.05) * 0.94;
          }, false);
          addMesh(this.geo.plane, 'axe_cleave_arc', k === 0 ? '#f97316' : '#fde047', 2.6, (m) => {
            m.position.set(tilt * 0.4 + 0.03, 1.18, 0.88);
          }, (m, mat, t, ease) => {
            m.rotation.set(0, Math.PI * 0.5 + tilt, -1.6 + ease * 2.4);
            const s = 2.75 + ease * 1.3;
            m.scale.set(s, s, 1);
            mat.opacity = clamp01(1 - t * 1.1);
          });
        }
        // Mini Ground Crater Smash at Impact Point (z = 1.6m)
        addMesh(this.geo.plane, 'tectonic_crater', '#2b1a12', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset, 1.65);
        }, (m, mat, t, ease) => {
          const s = 1.3 + ease * 2.2;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'seismic_shock_ring', '#fb923c', 2.5, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.05, 1.65);
        }, (m, mat, t, ease) => {
          const s = 1.0 + ease * 2.8;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25);
        });
      } else {
        // Heavy Brutal Horizontal Battleaxe Cleave Arc
        addMesh(this.geo.plane, 'axe_cleave_arc', '#2b1006', 1.0, (m) => {
          m.position.set(0, 1.04, 0.62);
        }, (m, mat, t, ease) => {
          m.rotation.set(-Math.PI * 0.42, swingDir * 0.28, swingDir * (-1.15 + ease * 2.25) - Math.PI * 0.5);
          const s = 2.75 + ease * 1.25;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.05) * 0.94;
        }, false);
        addMesh(this.geo.plane, 'axe_cleave_arc', '#f97316', 2.5, (m) => {
          m.position.set(0, 1.08, 0.66);
        }, (m, mat, t, ease) => {
          m.rotation.set(-Math.PI * 0.42, swingDir * 0.28, swingDir * (-1.05 + ease * 2.25) - Math.PI * 0.5);
          const s = 2.60 + ease * 1.15;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.1);
        });
      }

      addDebris(opts.isFinisher ? 12 : 6, {
        kind: 'rock', ox: 0, oy: 0.45, oz: 1.5, radius: 0.65,
        forwardBias: 2.2, speedMin: 1.2, speedMax: 3.4, vyMin: 3.0, vyMax: 6.5, size: 0.42
      });
      addDebris(opts.isFinisher ? 14 : 7, {
        kind: 'ember', color: '#fde047', ox: 0, oy: 1.0, oz: 1.35, radius: 0.55,
        forwardBias: 3.5, speedMin: 1.4, speedMax: 4.0, vyMin: 1.0, vyMax: 3.5, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: WHIRLWIND AXE (360-Degree 5.8m Twin-Axe Berserker Cyclone!)
    //    (Matches server.js range = 2.9m full 360 degrees + guardBreak!)
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_heavy_whirlwind') {
      duration = 0.82;

      // 5.8m Spinning Carved Norse Vegvisir Runestone Floor Seal
      addMesh(this.geo.plane, 'norse_rune_circle', '#2b1006', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.2 + ease * 3.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'norse_rune_circle', '#f97316', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.1 + ease * 3.7;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      // 3 Stacked Counter-Rotating 360-Degree Twin-Axe Whirlwind Cyclone Discs!
      const layers = [
        { oy: 0.65, s0: 2.6, s1: 5.9, spd: 20.0, col: '#ea580c', delay: 0.00 },
        { oy: 1.08, s0: 2.8, s1: 6.2, spd: -24.0, col: '#fde047', delay: 0.03 },
        { oy: 1.50, s0: 2.3, s1: 5.4, spd: 22.0, col: '#dc2626', delay: 0.06 }
      ];
      for (const L of layers) {
        addMesh(this.geo.plane, 'whirlwind_axe_ring', '#330c06', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, L.oy - 0.03, 0);
        }, (m, mat, t) => {
          const lt = (t - L.delay) / 0.85;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = L.s0 + easeOutCubic(lt) * (L.s1 - L.s0);
          m.scale.set(s, s, 1);
          m.rotation.z = lt * L.spd;
          mat.opacity = clamp01(1 - lt * 1.05) * 0.90;
        }, false);
        addMesh(this.geo.plane, 'whirlwind_axe_ring', L.col, 2.6, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, L.oy, 0);
        }, (m, mat, t) => {
          const lt = (t - L.delay) / 0.85;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = (L.s0 - 0.1) + easeOutCubic(lt) * (L.s1 - L.s0);
          m.scale.set(s, s, 1);
          m.rotation.z = lt * L.spd;
          mat.opacity = clamp01(1 - lt * 1.1);
        });
      }

      // Outer Seismic Shockwave Ring
      addMesh(this.geo.plane, 'seismic_shock_ring', '#fb923c', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 5.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25);
      });

      addDebris(14, {
        kind: 'rock', radius: 2.2, oy: 0.4, speedMin: 2.0, speedMax: 5.0, vyMin: 2.5, vyMax: 5.5, size: 0.46
      });
      addDebris(22, {
        kind: 'ember', color: '#fde047', radius: 2.6, oy: 0.9, oySpread: 0.8,
        swirl: 9.0, speedMin: 1.0, speedMax: 2.4, vyMin: 1.0, vyMax: 3.2, gravity: -1.5, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: RAGNAROK EARTHSHATTER (9.2m Tectonic Crater + 8 Rock Slabs!)
    //    (Matches server.js hitAoE at tx/tz radius = 4.6m -> 9.2m diameter, knockback 12.5!)
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_weapon') {
      duration = 1.55;

      // Massive 9.4m Jagged Basalt Tectonic Earthshatter Crater seared into Arena Floor!
      addMesh(this.geo.plane, 'tectonic_crater', '#2b1910', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.8 + ease * 6.8;
        m.scale.set(s, s, 1);
        const fade = t < 0.06 ? t / 0.06 : (t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0);
        mat.opacity = clamp01(fade) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'tectonic_crater', '#ea580c', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 2.6 + ease * 6.6;
        m.scale.set(s, s, 1);
        const fade = t < 0.06 ? t / 0.06 : (t > 0.70 ? 1 - (t - 0.70) / 0.30 : 1.0);
        mat.opacity = clamp01(fade) * 0.88;
      });

      // Giant 9.0m Glowing Carved Norse Vegvisir Runestone Ring
      addMesh(this.geo.plane, 'norse_rune_circle', '#2b0d06', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 2.2 + ease * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'norse_rune_circle', '#fb923c', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, 0);
      }, (m, mat, t, ease) => {
        const s = 2.1 + ease * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 2.2;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.94;
      });

      // Double High-Velocity 9.8m Seismic Shockwave Blast Rings!
      for (let w = 0; w < 2; w++) {
        const delay = w * 0.10;
        addMesh(this.geo.plane, 'seismic_shock_ring', '#2b1006', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.12, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.52;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 1.6 + easeOutCubic(lt) * 8.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'seismic_shock_ring', w === 0 ? '#fde047' : '#f97316', 2.8, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.15, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.52;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 1.5 + easeOutCubic(lt) * 8.2;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // 8 GIANT 3D X-CROSSED VOLCANIC BASALT ROCK SLABS ERUPTING AROUND THE 9.2m CRATER + CENTER SPIRE!
      addRockSlab({
        planes: 3, ox: 0, oz: 0, width: 2.35, height: 4.15,
        delay: 0.0, life: 0.92, rotY: 0.3, glowHex: '#f97316', intensity: 1.9
      });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const rad = i % 2 === 0 ? 3.55 : 2.45;
        addRockSlab({
          planes: 2,
          ox: Math.cos(ang) * rad,
          oz: Math.sin(ang) * rad,
          width: i % 2 === 0 ? 1.85 : 1.50,
          height: i % 2 === 0 ? 3.25 : 2.55,
          delay: 0.02 + (i % 4) * 0.02,
          life: 0.88,
          rotY: -ang,
          tiltX: Math.sin(ang) * 0.30,  // blasted dramatically outward!
          tiltZ: -Math.cos(ang) * 0.30,
          glowHex: '#ea580c',
          intensity: 1.75
        });
      }

      // Blinding Ground-Zero Colossus Impact Burst!
      addMesh(this.geo.plane, 'colossus_claw_impact', '#fde047', 3.0, (m) => {
        m.position.set(0, 1.35, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.32);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(wt * 2.5);
        const s = 2.0 + easeOutCubic(wt) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // 30 Catapulted Tumbling Basalt Boulders & 26 Molten Ragnarok Embers!
      addDebris(30, {
        kind: 'rock', radius: 3.2, oy: 0.4,
        speedMin: 2.2, speedMax: 6.8, vyMin: 5.8, vyMax: 12.2, gravity: -17.0, size: 0.68
      });
      addDebris(26, {
        kind: 'ember', color: '#fde047', radius: 3.0, oy: 0.7, oySpread: 0.8,
        speedMin: 2.8, speedMax: 7.5, vyMin: 3.2, vyMax: 8.5, gravity: -7.5, size: 0.42
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: VALHALLA BERSERK (6s Attached Rage Aura & War-Flame Sheath!)
    //    (Matches server.js 6000ms berserk/superArmor/speedBuff + 3.5m AoE knockback!)
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_armor') {
      duration = 6.0;
      attachToCaster = true;

      // Persistent 4.2m Spinning Carved Norse Vegvisir Runestone Halo locked beneath Viking!
      addMesh(this.geo.plane, 'norse_rune_circle', '#3b0a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t) => {
        const s = t < 0.04 ? (1.4 + easeOutCubic(t / 0.04) * 2.9) : 4.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
        mat.opacity = 0.84 * fadeOut;
      }, false);
      addMesh(this.geo.plane, 'norse_rune_circle', '#ef4444', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t) => {
        const s = t < 0.04 ? (1.3 + easeOutCubic(t / 0.04) * 2.8) : 4.15;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
        mat.opacity = (0.76 + 0.20 * Math.sin(t * 52)) * fadeOut;
      });

      // Dual-Pass Tall Roaring Crimson-Amber Valhalla War-Flame Sheath around Viking for 6s!
      addMesh(this.geo.rageSheath, 'valhalla_rage_vortex', '#450a0a', 1.0, null, (m, mat, t) => {
        const expand = t < 0.04 ? easeOutCubic(t / 0.04) : 1.0;
        const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
        const r = (0.98 + 0.09 * Math.sin(t * 48)) * expand;
        const h = 2.85 * expand;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.04;
        m.rotation.y = t * 24.0;
        mat.opacity = 0.52 * fadeOut;
      }, false);
      addMesh(this.geo.innerSheath, 'valhalla_rage_vortex', '#f97316', 2.25, null, (m, mat, t) => {
        const expand = t < 0.04 ? easeOutCubic(t / 0.04) : 1.0;
        const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
        const r = (0.86 + 0.08 * Math.cos(t * 54)) * expand;
        const h = 3.05 * expand;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.04;
        m.rotation.y = -t * 32.0;
        mat.opacity = (0.58 + 0.14 * Math.sin(t * 46)) * fadeOut;
      });

      // Initial 7.6m Activation Berserker War-Roar Seismic Shockwave (first 0.55s!)
      addMesh(this.geo.plane, 'seismic_shock_ring', '#3b0a0a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.11, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.09);
        const s = 1.4 + easeOutCubic(wt) * 6.4;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.92 : 0;
      }, false);
      addMesh(this.geo.plane, 'seismic_shock_ring', '#fde047', 2.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.14, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.09);
        const s = 1.3 + easeOutCubic(wt) * 6.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });
      addMesh(this.geo.plane, 'colossus_claw_impact', '#ef4444', 2.8, (m) => {
        m.position.set(0, 1.3, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.08);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + easeOutCubic(wt) * 3.8;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      addDebris(24, {
        kind: 'ember', color: '#fde047', radius: 1.4, oy: 0.4, oySpread: 0.5,
        speedMin: 0.4, speedMax: 1.4, vyMin: 2.2, vyMax: 5.0, gravity: -0.4, maxDelay: 0.45, size: 0.42
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: COLOSSUS HURL THROW (Titan Grab & 14.0 Ring-Out Launch!)
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_helmet') {
      duration = 0.78;

      // Ground Bracing Stomp Crater beneath Viking's boots
      addMesh(this.geo.plane, 'tectonic_crater', '#2b1810', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0.4);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 2.5;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);

      // Brutal Titan Grab-Impact Burst right at Grab Zone (z = 1.7m)
      addMesh(this.geo.plane, 'colossus_claw_impact', '#3b0d06', 1.0, (m) => {
        m.position.set(0, 1.15, 1.65);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 5.0);
        const s = 1.5 + ease * 3.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'colossus_claw_impact', '#fde047', 2.9, (m) => {
        m.position.set(0, 1.18, 1.70);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 5.0);
        const s = 1.4 + ease * 2.85;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.3);
      });

      // 3 Forward-Blasting Hurricane Throw Shock Rings along Throw Vector (z = 1.2, 2.5, 3.8m)
      for (let i = 0; i < 3; i++) {
        const rz = 1.2 + i * 1.3;
        const delay = i * 0.05;
        addMesh(this.geo.plane, 'seismic_shock_ring', '#2b0d06', 1.0, (m) => {
          m.position.set(0, 1.15 + i * 0.25, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.56;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.95 + easeOutCubic(lt) * (2.6 + i * 0.45);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.90;
        }, false);
        addMesh(this.geo.plane, 'seismic_shock_ring', i === 2 ? '#fde047' : '#f97316', 2.7, (m) => {
          m.position.set(0, 1.15 + i * 0.25, rz + 0.04);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.56;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.90 + easeOutCubic(lt) * (2.5 + i * 0.45);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      addDebris(14, {
        kind: 'rock', ox: 0, oy: 0.5, oz: 1.5, radius: 0.8,
        forwardBias: 5.5, speedMin: 1.8, speedMax: 4.5, vyMin: 3.5, vyMax: 7.5, size: 0.48
      });
      addDebris(16, {
        kind: 'ember', color: '#fb923c', ox: 0, oy: 1.1, oz: 1.6, radius: 0.7,
        forwardBias: 7.5, speedMin: 2.0, speedMax: 5.0, vyMin: 1.5, vyMax: 4.5, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: BOOMERANG TOMAHAWK (Spinning Release Burst!)
    //    (Real 3D spinning boomerang_axe projectile travels out & back cleanly!)
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_trinket') {
      duration = 0.62;

      // Carved Norse Rune Stance Ring under Viking's throw pivot
      addMesh(this.geo.plane, 'norse_rune_circle', '#2b1006', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 1.9;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.5;
        mat.opacity = clamp01(1 - t) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'norse_rune_circle', '#fb923c', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.15 + ease * 1.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.5;
        mat.opacity = clamp01(1 - t);
      });

      // High-Torque Horizontal Tomahawk Release Whirl Disc (strictly at release point z = 0.9m!)
      addMesh(this.geo.plane, 'whirlwind_axe_ring', '#330c06', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.46;
        m.position.set(0, 1.05, 0.88);
      }, (m, mat, t, ease) => {
        const s = 1.4 + ease * 2.1;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 24.0;
        mat.opacity = clamp01(1 - t * 1.2) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'whirlwind_axe_ring', '#fde047', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.46;
        m.position.set(0, 1.08, 0.92);
      }, (m, mat, t, ease) => {
        const s = 1.3 + ease * 2.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 24.0;
        mat.opacity = clamp01(1 - t * 1.25);
      });

      // Forward Vertical Launch Gust Ring
      addMesh(this.geo.plane, 'seismic_shock_ring', '#fb923c', 2.5, (m) => {
        m.position.set(0, 1.05, 1.15);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 2.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.35);
      });

      addDebris(12, {
        kind: 'ember', color: '#fde047', ox: 0, oy: 1.05, oz: 1.0, radius: 0.45,
        forwardBias: 5.5, speedMin: 1.4, speedMax: 3.8, vyMin: 0.5, vyMax: 2.2, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: BERSERK BULL RUSH / GIANT JUMP SEISMIC STOMP!
    // ------------------------------------------------------------------------
    else if (effectId === 'viking_mobility_rush') {
      duration = 0.48;

      addMesh(this.geo.plane, 'seismic_shock_ring', '#2b1006', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 2.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'seismic_shock_ring', '#fb923c', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.09, 0);
      }, (m, mat, t, ease) => {
        const s = 0.85 + ease * 2.1;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addDebris(8, {
        kind: 'rock', radius: 0.55, oy: 0.25, speedMin: 1.2, speedMax: 3.2, vyMin: 2.5, vyMax: 5.2, size: 0.38
      });
      addDebris(8, {
        kind: 'ember', color: '#fb923c', radius: 0.45, oy: 0.55, speedMin: 1.0, speedMax: 2.6, vyMin: 0.8, vyMax: 2.4, size: 0.30
      });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      debris,
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
      for (const sp of fx.debris) {
        const localT = fx.age - sp.delay;
        if (localT <= 0) {
          sp.mesh.visible = false;
          continue;
        }
        sp.mesh.visible = true;
        const st = clamp01(localT / Math.max(0.18, fx.duration - sp.delay));

        let px, pz;
        if (sp.swirl) {
          const curAng = sp.swirlAngle + localT * sp.swirl;
          px = Math.cos(curAng) * sp.swirlRadius;
          pz = Math.sin(curAng) * sp.swirlRadius;
        } else {
          px = sp.ox + sp.vx * localT;
          pz = sp.oz + sp.vz * localT;
        }
        const py = Math.max(0.10, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT);

        sp.mesh.position.set(px, py, pz);
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);
        sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);

        if (sp.isRock) {
          const sc = sp.baseSz * (1.0 - st * 0.35);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mat.opacity = clamp01(st > 0.72 ? 1 - (st - 0.72) / 0.28 : 1.0);
        } else {
          const sc = sp.baseSz * (1.08 - st * 0.62);
          sp.mesh.scale.set(sc * 0.52, sc * 1.45, 1);
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
    for (const sp of fx.debris) {
      sp.mat.dispose();
    }
  }
}
