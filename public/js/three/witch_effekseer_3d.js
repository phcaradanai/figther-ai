// ============================================================================
// LOST SAGA 3D - FROST ICE WITCH (CRYOMANCER) 3D EFFEKSEER + THREE.JS VFX
// ============================================================================
// Dedicated 7-move Frost Ice Witch (แม่มดน้ำแข็ง) 3D VFX suite modeled after
// Tree of Savior's Cryomancer skills (Ice Bolt, Ice Pike, Ice Wall, Ice Blast,
// Subzero Shield, Frost Pillar, Snow Rolling / Frost Skate):
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep midnight-sapphire &
//      slate-indigo NormalBlending crystal silhouettes (#0a2540 / #0f2e54) +
//      blinding glacial-cyan & diamond-white Additive HDR Bloom (#22d3ee,
//      #67e8f9, #ecfeff) using our 10 512x512 Cryomancer PNGs!
// ============================================================================
import * as THREE from 'three';

const WITCH_TEX_NAMES = [
  'frost_snowflake_seal',
  'ice_spike',
  'subzero_shield',
  'glacial_floor',
  'blizzard_vortex',
  'frost_ring',
  'snowflake_mote',
  'ice_shard',
  'frost_mist',
  'crystal_flare'
];

const WITCH_EFFECT_IDS = new Set([
  'witch_basic_icebolt',
  'witch_heavy_breath',
  'witch_weapon',
  'witch_armor',
  'witch_helmet',
  'witch_trinket',
  'witch_mobility_glide'
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

export class WitchThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'WitchThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      cyclone: new THREE.CylinderGeometry(1.48, 0.82, 1.0, 32, 1, true),
      innerCyclone: new THREE.CylinderGeometry(1.12, 0.58, 1.0, 26, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of WITCH_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/witch/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'blizzard_vortex') {
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
   * Handle server FX events for Frost Ice Witch (including stolen Witch gear skills!).
   * Returns true if handled/suppressed by the Frost Ice Witch 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && WITCH_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'witch_weapon') this.shake(7);
      else if (mapped.effectId === 'witch_helmet') this.shake(7);
      else if (mapped.effectId === 'witch_armor') this.shake(5);
      else if (mapped.effectId === 'witch_heavy_breath') this.shake(5);
      else if (mapped.effectId === 'witch_trinket') this.shake(3);
      else if (mapped.effectId === 'witch_basic_icebolt' && mapped.isFinisher) this.shake(3);

      return true;
    }

    // Suppress ONLY Frost Ice Witch's duplicate secondary server events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'witch') ||
      (fx.type === 'skill_cast' && (fx.skillId === 'witch_weapon' || fx.skillId === 'witch_helmet')) ||
      (fx.type === 'ice_tomb' && fx.fromSkill === 'witch_armor')
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
    const particles = [];
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

    // Helper: 3D Crossed Crystalline Ice Pillar Spire (2-plane X-cross or 3-plane star)
    // Dual-pass: deep sapphire NormalBlending silhouette + radiant glacial-cyan Additive facets!
    const addIcePillar = (cfg) => {
      const planes = cfg.planes || 2;
      const pillarGroup = new THREE.Group();
      pillarGroup.position.set(cfg.ox || 0, cfg.baseY !== undefined ? cfg.baseY : gyOffset, cfg.oz || 0);
      pillarGroup.rotation.y = cfg.rotY || 0;
      if (cfg.tiltX) pillarGroup.rotation.x = cfg.tiltX;
      if (cfg.tiltZ) pillarGroup.rotation.z = cfg.tiltZ;
      root.add(pillarGroup);

      const mats = [];
      for (let p = 0; p < planes; p++) {
        const ang = (p / planes) * Math.PI;
        // NormalBlending deep midnight-sapphire silhouette layer (makes ice pop sharply on sunlit stone!)
        const darkMat = this.makeMat('ice_spike', cfg.darkHex || '#0c2d48', 1.0, 0.94, false);
        const darkMesh = new THREE.Mesh(this.geo.plane, darkMat);
        darkMesh.rotation.y = ang;
        darkMesh.position.y = 0.5;
        darkMesh.scale.set(1.06, 1.03, 1);
        darkMesh.renderOrder = 17;
        pillarGroup.add(darkMesh);

        // Additive HDR glacial-cyan / diamond-white luminous crystal facet layer
        const glowMat = this.makeMat('ice_spike', cfg.glowHex || '#67e8f9', cfg.intensity || 2.35, 0.96, true);
        const glowMesh = new THREE.Mesh(this.geo.plane, glowMat);
        glowMesh.rotation.y = ang;
        glowMesh.position.y = 0.52;
        glowMesh.renderOrder = 19;
        pillarGroup.add(glowMesh);

        mats.push(darkMat, glowMat);
      }

      const delay = cfg.delay || 0;
      const life = cfg.life || 0.72;
      const maxW = cfg.width || 1.35;
      const maxH = cfg.height || 2.8;

      parts.push({
        mesh: pillarGroup,
        mat: mats[0],
        extraMats: mats.slice(1),
        update: (g, _m, t) => {
          const lt = (t - delay) / life;
          if (lt <= 0 || lt >= 1) {
            g.visible = false;
            return;
          }
          g.visible = true;
          // Rapid violent Cryomancer ground eruption with subtle crystal snap overshoot
          const riseT = clamp01(lt / 0.16);
          const riseEase = easeOutCubic(riseT);
          const overshoot = lt < 0.22 ? (1 + Math.sin(riseT * Math.PI) * 0.14) : 1.0;
          const fadeOut = lt > 0.74 ? clamp01(1 - (lt - 0.74) / 0.26) : 1.0;

          const curH = Math.max(0.05, maxH * riseEase * overshoot);
          const curW = maxW * (0.45 + 0.55 * riseEase);
          g.scale.set(curW, curH, curW);

          for (let k = 0; k < mats.length; k++) {
            const isDark = (k % 2 === 0);
            mats[k].opacity = (isDark ? 0.92 : 0.96) * fadeOut;
          }
        }
      });
      return pillarGroup;
    };

    const addFrostParticles = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const kind = cfg.kind || 'snowflake'; // 'snowflake' | 'shard' | 'mist'
        const tex = cfg.tex || (kind === 'shard' ? 'ice_shard' : (kind === 'mist' ? 'frost_mist' : 'snowflake_mote'));
        const additive = cfg.additive !== undefined ? cfg.additive : (kind === 'snowflake');
        const mat = this.makeMat(tex, cfg.color || (kind === 'shard' ? '#0ea5e9' : '#e0f7ff'), cfg.intensity || (additive ? 2.2 : 1.0), 1.0, additive);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = additive ? 20 : 18;

        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.7);
        const spd = (cfg.speedMin || 1.0) + Math.random() * (cfg.speedMax || 3.4);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin !== undefined ? cfg.vyMin : 0.8) + Math.random() * (cfg.vyMax !== undefined ? cfg.vyMax : 2.6);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy !== undefined ? cfg.oy : 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.5);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || (kind === 'mist' ? 1.45 : (kind === 'snowflake' ? 0.40 : 0.34))) * (0.75 + Math.random() * 0.65);
        root.add(mesh);

        particles.push({
          mesh, mat, kind, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : (kind === 'shard' ? -9.5 : (kind === 'mist' ? 0.35 : -0.9)),
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.14),
          baseSz: sz,
          swirl: cfg.swirl || 0,
          swirlRadius: rad,
          swirlAngle: ang,
          flutterAmp: kind === 'snowflake' ? (0.28 + Math.random() * 0.38) : 0,
          flutterFreq: 4.5 + Math.random() * 5.0,
          rotSpeed: (Math.random() - 0.5) * (kind === 'mist' ? 1.8 : 7.5),
          rotInit: Math.random() * Math.PI * 2,
          alphaPeak: cfg.alphaPeak !== undefined ? cfg.alphaPeak : (kind === 'mist' ? 0.58 : 0.96)
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: CRYOMANCER ICE BOLT CAST (Staff Muzzle Seal & Shard Burst)
    //    (Real moving Octahedron icebolt is rendered cleanly by ThreeRenderer!)
    // ------------------------------------------------------------------------
    if (effectId === 'witch_basic_icebolt') {
      duration = opts.isFinisher ? 0.48 : 0.34;

      // Vertical Spinning Cryomancer Snowflake Cast Sigil right at Wand Tip (z = 0.92m)
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#0a2540', 1.0, (m) => {
        m.position.set(0, 1.02, 0.90);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.55 : 1.12) + ease * 0.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t * 1.15) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#22d3ee', 2.5, (m) => {
        m.position.set(0, 1.02, 0.94);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.48 : 1.06) + ease * 0.82;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // Blinding 6-Ray Crystalline Starburst Flash at Staff Tip
      addMesh(this.geo.plane, 'crystal_flare', '#ecfeff', 3.0, (m) => {
        m.position.set(0, 1.02, 0.98);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 2.4);
        const s = (opts.isFinisher ? 1.45 : 1.0) + ease * 1.45;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.85);
      });

      // Finisher (Freezing Ice Bolt): Extra Jagged Cryo Shock Ring at Muzzle!
      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'frost_ring', '#0a2540', 1.0, (m) => {
          m.position.set(0, 1.02, 1.02);
        }, (m, mat, t, ease) => {
          const s = 0.85 + ease * 2.1;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.2) * 0.88;
        }, false);
        addMesh(this.geo.plane, 'frost_ring', '#67e8f9', 2.6, (m) => {
          m.position.set(0, 1.02, 1.06);
        }, (m, mat, t, ease) => {
          const s = 0.80 + ease * 2.0;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25);
        });
      }

      // Crisp Shattering Ice Shards & Sparkling Snowflakes right at Cast Point
      addFrostParticles(opts.isFinisher ? 10 : 6, {
        kind: 'shard', additive: false, color: '#0284c7',
        ox: 0, oy: 1.02, oz: 1.05, radius: 0.28,
        forwardBias: 2.2, speedMin: 0.8, speedMax: 2.4, vyMin: 0.4, vyMax: 2.2, size: 0.30
      });
      addFrostParticles(opts.isFinisher ? 12 : 6, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        ox: 0, oy: 1.02, oz: 1.05, radius: 0.32,
        forwardBias: 1.8, speedMin: 0.6, speedMax: 2.0, vyMin: 0.2, vyMax: 1.4, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: ABSOLUTE ZERO BREATH (4.5m Cryomancer Ice Pike Cone!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_heavy_breath') {
      duration = 0.92;

      // Frozen Cracked Glacial Cone Patch across the 4.5m Front Arc
      addMesh(this.geo.plane, 'glacial_floor', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 2.45);
      }, (m, mat, t, ease) => {
        const w = 1.6 + ease * 3.4;
        const l = 1.8 + ease * 3.8;
        m.scale.set(w, l, 1);
        mat.opacity = clamp01(t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'glacial_floor', '#38bdf8', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 2.45);
      }, (m, mat, t, ease) => {
        const w = 1.5 + ease * 3.2;
        const l = 1.7 + ease * 3.6;
        m.scale.set(w, l, 1);
        mat.opacity = clamp01(t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92) * 0.88;
      });

      // 5 Staggered Fan-Spread Cryomancer Ice Pikes erupting across the 4.5m Cone!
      const pikes = [
        { ox: 0.0,  oz: 1.35, w: 1.10, h: 1.95, delay: 0.00, tiltZ: 0.0 },
        { ox: -0.68, oz: 2.35, w: 1.25, h: 2.35, delay: 0.05, tiltZ: 0.14 },
        { ox:  0.68, oz: 2.35, w: 1.25, h: 2.35, delay: 0.06, tiltZ: -0.14 },
        { ox: -1.05, oz: 3.65, w: 1.40, h: 2.75, delay: 0.11, tiltZ: 0.18 },
        { ox:  1.05, oz: 3.65, w: 1.40, h: 2.75, delay: 0.12, tiltZ: -0.18 },
        { ox: 0.0,  oz: 4.25, w: 1.55, h: 3.15, delay: 0.15, tiltZ: 0.0 }
      ];
      for (const pk of pikes) {
        addIcePillar({
          ox: pk.ox, oz: pk.oz, width: pk.w, height: pk.h,
          delay: pk.delay, life: 0.78 - pk.delay * 0.4,
          tiltZ: pk.tiltZ, rotY: pk.oz * 0.7,
          darkHex: '#0a2540', glowHex: '#67e8f9', intensity: 2.4
        });
      }

      // Forward Vertical Expanding Frost Breath Ring
      addMesh(this.geo.plane, 'frost_ring', '#0a2540', 1.0, (m) => {
        m.position.set(0, 1.05, 1.1);
      }, (m, mat, t, ease) => {
        m.position.z = 1.0 + ease * 3.4;
        const s = 1.0 + ease * 3.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'frost_ring', '#ecfeff', 2.6, (m) => {
        m.position.set(0, 1.05, 1.15);
      }, (m, mat, t, ease) => {
        m.position.z = 1.05 + ease * 3.4;
        const s = 0.95 + ease * 2.85;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.3);
      });

      // Rolling Subzero Frost Mist + Snowflakes + Shattering Ice Shards
      addFrostParticles(10, {
        kind: 'mist', additive: false, color: '#bae6fd', alphaPeak: 0.56,
        ox: 0, oy: 0.85, oz: 2.4, radius: 0.9, ozSpread: 2.8,
        forwardBias: 2.6, speedMin: 0.5, speedMax: 1.6, vyMin: 0.2, vyMax: 1.0, size: 1.75
      });
      addFrostParticles(18, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        ox: 0, oy: 0.9, oz: 2.2, radius: 0.9, ozSpread: 3.0,
        forwardBias: 3.2, speedMin: 0.8, speedMax: 2.2, vyMin: 0.6, vyMax: 2.2, size: 0.42
      });
      addFrostParticles(14, {
        kind: 'shard', additive: false, color: '#0ea5e9',
        ox: 0, oy: 0.7, oz: 2.6, radius: 1.1, ozSpread: 2.8,
        forwardBias: 2.2, speedMin: 1.5, speedMax: 4.0, vyMin: 2.2, vyMax: 5.2, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: ETERNAL BLIZZARD x CRYOMANCER FROST PILLAR!
    //    (Radius 4.5m at target zone 4.2m ahead; towering 3D Frost Pillar + Blizzard Cyclone!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_weapon') {
      duration = 2.40;

      // Giant 9.2m Frozen Glacial Crust on the Arena Floor (Radius 4.5m!)
      addMesh(this.geo.plane, 'glacial_floor', '#081f38', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.8 + ease * 6.8;
        m.scale.set(s, s, 1);
        const fade = t < 0.06 ? t / 0.06 : (t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1.0);
        mat.opacity = clamp01(fade) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'glacial_floor', '#38bdf8', 2.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 2.6 + ease * 6.5;
        m.scale.set(s, s, 1);
        const fade = t < 0.06 ? t / 0.06 : (t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1.0);
        mat.opacity = clamp01(fade) * 0.86;
      });

      // Giant 9.0m Spinning Cryomancer Snowflake Magic Circle Seal
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 2.4 + ease * 6.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.2;
        const fade = t < 0.05 ? t / 0.05 : (t > 0.80 ? 1 - (t - 0.80) / 0.20 : 1.0);
        mat.opacity = clamp01(fade) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#22d3ee', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.09, 0);
      }, (m, mat, t, ease) => {
        const s = 2.3 + ease * 6.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.2;
        const fade = t < 0.05 ? t / 0.05 : (t > 0.80 ? 1 - (t - 0.80) / 0.20 : 1.0);
        mat.opacity = clamp01(fade) * (0.85 + 0.12 * Math.sin(t * 28));
      });

      // Rapid 9.4m Ice Blast Impact Shockwave Ring (first 0.7s)
      addMesh(this.geo.plane, 'frost_ring', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.11, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.34);
        const s = 1.6 + easeOutCubic(wt) * 7.8;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.92 : 0;
      }, false);
      addMesh(this.geo.plane, 'frost_ring', '#ecfeff', 2.7, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.14, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.34);
        const s = 1.5 + easeOutCubic(wt) * 7.6;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // TOWERING CENTER CRYOMANCER FROST PILLAR (3-Plane Star Obelisk, 5.2m Tall!)
      addIcePillar({
        planes: 3, ox: 0, oz: 0, width: 2.75, height: 5.25,
        delay: 0.0, life: 0.96, rotY: 0.35,
        darkHex: '#0a2540', glowHex: '#67e8f9', intensity: 2.55
      });

      // 4 Angled Crystal Buttress Spires erupting around the Frost Pillar Base!
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
        const rad = 1.48;
        addIcePillar({
          planes: 2,
          ox: Math.cos(ang) * rad,
          oz: Math.sin(ang) * rad,
          width: 1.38,
          height: 2.75,
          delay: 0.03 + i * 0.015,
          life: 0.90,
          rotY: -ang,
          tiltX: Math.sin(ang) * 0.24,
          tiltZ: -Math.cos(ang) * 0.24,
          darkHex: '#0f2e54',
          glowHex: '#22d3ee',
          intensity: 2.35
        });
      }

      // 3D Swirling Howling Blizzard Cyclone Funnel wrapping the Frost Pillar!
      addMesh(this.geo.cyclone, 'blizzard_vortex', '#0c2d48', 1.0, null, (m, mat, t, ease) => {
        const r = 1.7 + ease * 2.05;
        const h = 2.6 + ease * 2.2;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = t * 14.0;
        const fade = t < 0.07 ? t / 0.07 : (t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1.0);
        mat.opacity = clamp01(fade) * 0.78;
      }, false);
      addMesh(this.geo.innerCyclone, 'blizzard_vortex', '#67e8f9', 2.25, null, (m, mat, t, ease) => {
        const r = 1.45 + ease * 1.95;
        const h = 3.0 + ease * 2.4;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = -t * 19.0;
        const fade = t < 0.07 ? t / 0.07 : (t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1.0);
        mat.opacity = clamp01(fade) * 0.86;
      });

      // Blinding Pillar Eruption Crystal Flare
      addMesh(this.geo.plane, 'crystal_flare', '#ecfeff', 3.0, (m) => {
        m.position.set(0, 2.3, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.24);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(wt * 2.5);
        const s = 1.8 + easeOutCubic(wt) * 4.4;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Swirling Blizzard Snowflakes + Ground Frost Mist + Bursting Ice Shards!
      addFrostParticles(36, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        radius: 3.4, oy: 3.4, oySpread: 1.8,
        speedMin: 0.4, speedMax: 1.4, vyMin: -1.8, vyMax: -0.5, gravity: -0.2,
        swirl: 4.5, maxDelay: 0.85, size: 0.46
      });
      addFrostParticles(20, {
        kind: 'shard', additive: false, color: '#0284c7',
        radius: 1.8, oy: 1.0, oySpread: 1.0,
        speedMin: 2.2, speedMax: 5.5, vyMin: 3.0, vyMax: 6.8, gravity: -8.5,
        maxDelay: 0.35, size: 0.40
      });
      addFrostParticles(12, {
        kind: 'mist', additive: false, color: '#bae6fd', alphaPeak: 0.50,
        radius: 2.6, oy: 0.65, oySpread: 0.4,
        speedMin: 0.5, speedMax: 1.5, vyMin: 0.2, vyMax: 0.8,
        swirl: 2.2, maxDelay: 0.5, size: 2.25
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: CRYSTAL ICE TOMB x CRYOMANCER SUBZERO SHIELD!
    //    (1.5s Invuln attached to caster + 4.0m AoE Ice Blast Freeze + +25 HP Heal!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_armor') {
      duration = 1.50;
      attachToCaster = true;

      // 4.6m Rotating Cryomancer Snowflake Ground Halo following Witch
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t) => {
        const expand = t < 0.08 ? easeOutCubic(t / 0.08) : 1.0;
        const fade = t > 0.84 ? 1 - (t - 0.84) / 0.16 : 1.0;
        const s = 1.4 + expand * 3.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.5;
        mat.opacity = 0.86 * fade;
      }, false);
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#67e8f9', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t) => {
        const expand = t < 0.08 ? easeOutCubic(t / 0.08) : 1.0;
        const fade = t > 0.84 ? 1 - (t - 0.84) / 0.16 : 1.0;
        const s = 1.3 + expand * 3.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.5;
        mat.opacity = (0.82 + 0.15 * Math.sin(t * 28)) * fade;
      });

      // 8.2m Expanding Cryomancer "Ice Blast" AoE Freeze Shockwave Ring (Radius 4.0m!)
      addMesh(this.geo.plane, 'frost_ring', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.11, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.45);
        const s = 1.2 + easeOutCubic(wt) * 7.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.94 : 0;
      }, false);
      addMesh(this.geo.plane, 'frost_ring', '#ecfeff', 2.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.14, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.45);
        const s = 1.1 + easeOutCubic(wt) * 7.0;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // 6 Rotating Chamfered Hexagonal Subzero Shield Ice Barrier Plates orbiting Witch!
      const shieldDome = new THREE.Group();
      shieldDome.position.set(0, 1.12, 0);
      root.add(shieldDome);
      const shieldMats = [];
      const shieldPlates = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const holder = new THREE.Group();
        holder.rotation.y = ang;

        const platePivot = new THREE.Group();
        platePivot.position.set(0, 0, 1.28);
        platePivot.rotation.x = -0.10; // slight protective dome taper

        // Deep Midnight-Sapphire Silhouette Backing
        const darkMat = this.makeMat('subzero_shield', '#0c2d48', 1.0, 0.88, false);
        const darkPlate = new THREE.Mesh(this.geo.plane, darkMat);
        darkPlate.scale.set(1.24, 1.98, 1);
        darkPlate.renderOrder = 17;
        platePivot.add(darkPlate);

        // Luminous Translucent Crystal Shield Barrier Plate
        const glowMat = this.makeMat('subzero_shield', i % 2 === 0 ? '#67e8f9' : '#ecfeff', 2.35, 0.94, true);
        const glowPlate = new THREE.Mesh(this.geo.plane, glowMat);
        glowPlate.position.z = 0.03;
        glowPlate.scale.set(1.18, 1.90, 1);
        glowPlate.renderOrder = 19;
        platePivot.add(glowPlate);

        holder.add(platePivot);
        shieldDome.add(holder);
        shieldPlates.push({ pivot: platePivot, phase: i * 1.047 });
        shieldMats.push(darkMat, glowMat);
      }

      parts.push({
        mesh: shieldDome,
        mat: shieldMats[0],
        extraMats: shieldMats.slice(1),
        update: (g, _m, t) => {
          const expand = t < 0.10 ? easeOutCubic(t / 0.10) : 1.0;
          const shatterFade = t > 0.85 ? clamp01(1 - (t - 0.85) / 0.15) : 1.0;
          const shatterBurst = t > 0.85 ? (1 + ((t - 0.85) / 0.15) * 0.45) : 1.0;
          g.rotation.y = t * 4.6;
          for (const sp of shieldPlates) {
            sp.pivot.position.z = 1.26 * expand * shatterBurst;
            sp.pivot.position.y = Math.sin(t * 14 + sp.phase) * 0.09;
          }
          const pulse = 0.88 + 0.12 * Math.sin(t * 24);
          for (let k = 0; k < shieldMats.length; k++) {
            const isDark = (k % 2 === 0);
            shieldMats[k].opacity = (isDark ? 0.78 : 0.92 * pulse) * shatterFade;
          }
        }
      });

      // Blinding Center Crystal Flash on Activation
      addMesh(this.geo.plane, 'crystal_flare', '#ecfeff', 3.0, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.24);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + easeOutCubic(wt) * 3.8;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Aqua-Mint Rising Healing Snowflakes (+25 HP) + Outward Ice Blast Shards!
      addFrostParticles(16, {
        kind: 'snowflake', additive: true, color: '#5eead4',
        radius: 1.35, oy: 0.4, oySpread: 0.4,
        speedMin: 0.2, speedMax: 0.8, vyMin: 1.8, vyMax: 3.6, gravity: -0.2,
        swirl: 2.5, maxDelay: 0.45, size: 0.38
      });
      addFrostParticles(20, {
        kind: 'shard', additive: false, color: '#0284c7',
        radius: 0.9, oy: 1.0,
        speedMin: 3.2, speedMax: 7.5, vyMin: 1.2, vyMax: 3.8, gravity: -7.5, size: 0.38
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: GLACIAL SPIKE ERUPTION (Cryomancer Ice Pike 7.5m Line!)
    //    (6 Giant Staggered Erupting Crystalline Ice Pillars launching enemies Y=11.0!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_helmet') {
      duration = 1.28;

      // Frozen Cracked Glacial Trench Runway spanning z = 0..7.8m!
      addMesh(this.geo.plane, 'glacial_floor', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 3.9);
      }, (m, mat, t, ease) => {
        const len = Math.min(1, ease * 2.2) * 8.2;
        m.scale.set(3.2, len, 1);
        m.position.z = len * 0.5 + 0.2;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'glacial_floor', '#38bdf8', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 3.9);
      }, (m, mat, t, ease) => {
        const len = Math.min(1, ease * 2.2) * 8.0;
        m.scale.set(3.0, len, 1);
        m.position.z = len * 0.5 + 0.2;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.88;
      });

      // 6 Staggered Giant Erupting Cryomancer Ice Pike Pillars marching forward to 7.2m!
      for (let i = 0; i < 6; i++) {
        const pz = 1.2 + i * 1.2;
        const px = (i % 2 === 0 ? -0.22 : 0.22) * (i < 5 ? 1 : 0);
        const delay = i * 0.045;
        const h = 2.25 + i * 0.38; // crescendos up to a towering 4.15m final crystal spike!
        const w = 1.22 + i * 0.16;

        addIcePillar({
          planes: i === 5 ? 3 : 2,
          ox: px, oz: pz, width: w, height: h,
          delay, life: 0.92 - delay * 0.45,
          rotY: i * 0.65,
          tiltX: 0.08, // subtly thrusting forward!
          darkHex: '#0a2540',
          glowHex: i === 5 ? '#ecfeff' : '#67e8f9',
          intensity: i === 5 ? 2.75 : 2.4
        });

        // Glowing Cyan Frost Ring Base Flash at every erupting spike!
        addMesh(this.geo.plane, 'frost_ring', '#22d3ee', 2.5, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(px, gyOffset + 0.08, pz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.36;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.8 + easeOutCubic(lt) * (2.2 + i * 0.25);
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Climax Crystal Flare at Final Spire (z = 7.2m)
      addMesh(this.geo.plane, 'crystal_flare', '#ecfeff', 3.0, (m) => {
        m.position.set(0, 2.3, 7.2);
      }, (m, mat, t) => {
        const lt = (t - 0.22) / 0.35;
        if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(lt * 3.0);
        const s = 1.4 + easeOutCubic(lt) * 3.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });

      // Skyward Blasting Ice Shards (matching launchY: 11.0!) + Trench Frost Mist!
      addFrostParticles(28, {
        kind: 'shard', additive: false, color: '#0284c7',
        ox: 0, oy: 0.5, oz: 4.0, radius: 0.9, ozSpread: 6.4,
        speedMin: 1.2, speedMax: 3.4, vyMin: 5.5, vyMax: 10.5, gravity: -11.0,
        maxDelay: 0.28, size: 0.42
      });
      addFrostParticles(16, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        ox: 0, oy: 1.0, oz: 4.0, radius: 1.0, ozSpread: 6.4,
        speedMin: 0.8, speedMax: 2.2, vyMin: 2.0, vyMax: 5.0, gravity: -1.2,
        maxDelay: 0.28, size: 0.44
      });
      addFrostParticles(10, {
        kind: 'mist', additive: false, color: '#bae6fd', alphaPeak: 0.54,
        ox: 0, oy: 0.7, oz: 4.0, radius: 0.9, ozSpread: 6.2,
        speedMin: 0.4, speedMax: 1.2, vyMin: 0.3, vyMax: 1.1,
        maxDelay: 0.25, size: 1.85
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: FROST SKATE TRAIL (5.5m Speed Glide & Freeze Wake!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_trinket') {
      duration = 0.98;

      // Launch Snowflake Sigil beneath Witch's Skates
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0.2);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 2.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#67e8f9', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.06, 0.2);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 2.5;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      // 5.8m Frozen Glacial Ice Skate Lane
      addMesh(this.geo.plane, 'glacial_floor', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 2.8);
      }, (m, mat, t, ease) => {
        const len = Math.min(1, ease * 2.4) * 6.0;
        m.scale.set(2.5, len, 1);
        m.position.z = len * 0.5 + 0.2;
        mat.opacity = clamp01(1 - t * 0.95) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'glacial_floor', '#22d3ee', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 2.8);
      }, (m, mat, t, ease) => {
        const len = Math.min(1, ease * 2.4) * 5.8;
        m.scale.set(2.3, len, 1);
        m.position.z = len * 0.5 + 0.2;
        mat.opacity = clamp01(1 - t);
      });

      // 3 Forward Cryo Wind-Shear Speed Rings along the Skate Trajectory
      for (let i = 0; i < 3; i++) {
        const rz = 1.0 + i * 1.8;
        const delay = i * 0.05;
        addMesh(this.geo.plane, 'frost_ring', '#0a2540', 1.0, (m) => {
          m.position.set(0, 1.02, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.55;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.9 + easeOutCubic(lt) * 2.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.88;
        }, false);
        addMesh(this.geo.plane, 'frost_ring', '#ecfeff', 2.6, (m) => {
          m.position.set(0, 1.02, rz + 0.04);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.55;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.85 + easeOutCubic(lt) * 2.3;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Sparkling Ice Skate Snow-Spray & Low Frost Mist Wake!
      addFrostParticles(22, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        ox: 0, oy: 0.65, oz: 2.8, radius: 0.85, ozSpread: 5.2,
        speedMin: 0.8, speedMax: 2.4, vyMin: 0.8, vyMax: 2.8, gravity: -1.1, size: 0.42
      });
      addFrostParticles(14, {
        kind: 'shard', additive: false, color: '#0ea5e9',
        ox: 0, oy: 0.45, oz: 2.8, radius: 0.75, ozSpread: 5.0,
        speedMin: 1.5, speedMax: 3.6, vyMin: 1.8, vyMax: 4.5, gravity: -8.0, size: 0.34
      });
      addFrostParticles(8, {
        kind: 'mist', additive: false, color: '#bae6fd', alphaPeak: 0.50,
        ox: 0, oy: 0.55, oz: 2.6, radius: 0.7, ozSpread: 4.6,
        speedMin: 0.3, speedMax: 1.0, vyMin: 0.2, vyMax: 0.7, size: 1.55
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: FROST GLIDE FLY / SKATE DASH (Air Jump / Dash!)
    // ------------------------------------------------------------------------
    else if (effectId === 'witch_mobility_glide') {
      duration = 0.48;

      addMesh(this.geo.plane, 'frost_snowflake_seal', '#0a2540', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 1.95;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'frost_snowflake_seal', '#67e8f9', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 0.85 + ease * 1.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'frost_ring', '#ecfeff', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.11, 0);
      }, (m, mat, t, ease) => {
        const s = 0.75 + ease * 2.15;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addFrostParticles(12, {
        kind: 'snowflake', additive: true, color: '#ecfeff',
        radius: 0.55, oy: 0.65, speedMin: 0.8, speedMax: 2.2, vyMin: 0.4, vyMax: 1.8, gravity: -0.9, size: 0.36
      });
    }

    this.activeEffects.push({
      id: effectId,
      root,
      parts,
      particles,
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
      for (const sp of fx.particles) {
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
          const curRad = sp.swirlRadius * (0.85 + 0.25 * Math.sin(st * Math.PI));
          px = Math.cos(curAng) * curRad;
          pz = Math.sin(curAng) * curRad;
        } else {
          const flutter = sp.kind === 'snowflake' ? Math.sin(localT * sp.flutterFreq + sp.rotInit) * sp.flutterAmp : 0;
          px = sp.ox + sp.vx * localT + flutter;
          pz = sp.oz + sp.vz * localT;
        }
        const py = Math.max(0.08, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT);

        sp.mesh.position.set(px, py, pz);
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);

        if (sp.kind === 'mist') {
          const sc = sp.baseSz * (0.75 + st * 0.95);
          sp.mesh.scale.set(sc, sc * 0.85, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.18 ? st / 0.18 : 1 - (st - 0.18) / 0.82) * sp.alphaPeak);
        } else if (sp.kind === 'snowflake') {
          const sc = sp.baseSz * (0.8 + Math.sin(st * Math.PI) * 0.35);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.12 ? st / 0.12 : 1 - (st - 0.12) / 0.88) * sp.alphaPeak);
        } else {
          // Sharp angular ice_shard tumbling through air
          const sc = sp.baseSz * (1.08 - st * 0.55);
          sp.mesh.scale.set(sc * 0.72, sc * 1.25, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
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
    for (const sp of fx.particles) {
      sp.mat.dispose();
    }
  }
}
