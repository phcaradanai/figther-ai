// ============================================================================
// LOST SAGA 3D - SAMURAI EVO (BLOSSOM BLADER) 3D EFFEKSEER + THREE.JS VFX
// ============================================================================
// Dedicated 7-move Samurai EVO (ซามูไร อีโว) 3D VFX suite inspired by
// Tree of Savior's Blossom Blader (Blossom Slash, Flash, Control Blade: Hiten
// Blade, Flowering, StartUp, Falling Blossom):
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep cherry-plum wine
//      NormalBlending silhouettes + luminous sakura pink, rose-crimson, white-
//      pink core, and warm gold Additive HDR Bloom using our 10 512x512 PNGs!
// ============================================================================
import * as THREE from 'three';

const SAMURAI_TEX_NAMES = [
  'katana_crescent',
  'sakura_petal',
  'sakura_flower',
  'sakura_crest',
  'spectral_katana',
  'petal_vortex',
  'blossom_ring',
  'iaido_flash_beam',
  'blossom_flare',
  'sakura_spark'
];

const SAMURAI_EFFECT_IDS = new Set([
  'samurai_basic_slash',
  'samurai_heavy_iaido',
  'samurai_weapon',
  'samurai_armor',
  'samurai_helmet',
  'samurai_trinket',
  'samurai_mobility_flashstep'
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

export class SamuraiThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'SamuraiThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      cyclone: new THREE.CylinderGeometry(1.38, 0.80, 1.0, 30, 1, true),
      sheath: new THREE.CylinderGeometry(0.95, 0.72, 1.0, 24, 1, true)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of SAMURAI_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/samurai/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'petal_vortex') {
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
   * Handle server FX events for Samurai EVO (including stolen Samurai gear skills!).
   * Returns true if handled/suppressed by the Samurai 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && SAMURAI_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'samurai_weapon') this.shake(7);
      else if (mapped.effectId === 'samurai_armor') this.shake(7);
      else if (mapped.effectId === 'samurai_heavy_iaido') this.shake(6);
      else if (mapped.effectId === 'samurai_trinket') this.shake(5);
      else if (mapped.effectId === 'samurai_helmet') this.shake(4);
      else if (mapped.effectId === 'samurai_basic_slash' && mapped.isFinisher) this.shake(4);

      return true;
    }

    // Suppress ONLY Samurai's duplicate secondary events
    if (
      (fx.type === 'heavy_cast' && fx.heroId === 'samurai') ||
      (fx.type === 'skill_cast' && fx.skillId === 'samurai_weapon') ||
      (fx.type === 'shockwave' && fx.fromSkill === 'samurai_armor') ||
      (fx.type === 'aura' && fx.fromSkill === 'samurai_helmet')
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

    const addPetals = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const isPetal = (cfg.tex || 'sakura_petal') === 'sakura_petal';
        const additive = cfg.additive !== undefined ? cfg.additive : !isPetal;
        const mat = this.makeMat(cfg.tex || 'sakura_petal', cfg.color || '#f472b6', cfg.intensity || (additive ? 2.2 : 1.0), 1.0, additive);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = additive ? 20 : 18;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * (cfg.radius || 0.65);
        const spd = (cfg.speedMin || 1.2) + Math.random() * (cfg.speedMax || 3.8);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin || 0.8) + Math.random() * (cfg.vyMax || 3.0);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy || 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.5);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || (isPetal ? 0.42 : 0.30)) * (0.75 + Math.random() * 0.65);
        root.add(mesh);
        sparks.push({
          mesh, mat, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : (isPetal ? -1.4 : -7.5),
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.14),
          baseSz: sz,
          isPetal,
          flutterAmp: isPetal ? (0.35 + Math.random() * 0.45) : 0,
          flutterFreq: 5.0 + Math.random() * 6.0,
          rotSpeed: (Math.random() - 0.5) * 8.0,
          rotInit: Math.random() * Math.PI * 2
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: BLOSSOM SLASH (4-Hit Sakura Katana Sweeps + Flower Finisher!)
    // ------------------------------------------------------------------------
    if (effectId === 'samurai_basic_slash') {
      duration = opts.isFinisher ? 0.52 : 0.36;
      const swingDir = (opts.comboStep % 2 === 0) ? -1 : 1;

      // Deep Cherry-Plum Silhouette Backing (ultra-crisp contrast on sunlit stone!)
      addMesh(this.geo.plane, 'katana_crescent', '#3b071e', 1.0, (m) => {
        m.position.set(0, 1.02, 0.52);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.44, swingDir * 0.24, swingDir * (-1.15 + ease * 2.25) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 3.7 : 2.85) + ease * 1.3;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 0.95) * 0.94;
      }, false);

      // Luminous Sakura-Pink + White-Hot Katana Crescent Wave
      addMesh(this.geo.plane, 'katana_crescent', '#f472b6', 2.4, (m) => {
        m.position.set(0, 1.06, 0.56);
      }, (m, mat, t, ease) => {
        m.rotation.set(-Math.PI * 0.44, swingDir * 0.24, swingDir * (-1.05 + ease * 2.25) - Math.PI * 0.5);
        const s = (opts.isFinisher ? 3.45 : 2.6) + ease * 1.25;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      // Finisher blooms a full 5-petal Blossom Blader cherry blossom + cross flare!
      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'sakura_flower', '#4a0720', 1.0, (m) => {
          m.position.set(0, 1.10, 1.40);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(t * 2.5);
          const s = 1.2 + ease * 2.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.15) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'sakura_flower', '#f472b6', 2.4, (m) => {
          m.position.set(0, 1.12, 1.44);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(t * 2.5);
          const s = 1.1 + ease * 2.25;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.2);
        });
        addMesh(this.geo.plane, 'blossom_flare', '#fff1f2', 2.8, (m) => {
          m.position.set(0, 1.12, 1.48);
        }, (m, mat, t, ease) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.0 + ease * 2.6;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.7);
        });
      }

      // Fluttering Cherry Blossom Petals scattering from the blade!
      addPetals(opts.isFinisher ? 18 : 10, {
        tex: 'sakura_petal', additive: false, color: '#f472b6',
        ox: 0, oy: 1.05, oz: 1.15, radius: 0.55,
        forwardBias: 3.0, speedMin: 1.0, speedMax: 3.0, vyMin: 0.5, vyMax: 2.0, size: 0.42
      });
      addPetals(opts.isFinisher ? 10 : 5, {
        tex: 'sakura_spark', additive: true, color: '#fcd34d',
        ox: 0, oy: 1.05, oz: 1.2, forwardBias: 4.5, speedMin: 1.2, speedMax: 3.8, size: 0.28
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: IAIDO FLASH CUT (Blossom Blader "Flash" 4.8m Piercing Line!)
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_heavy_iaido') {
      duration = 0.72;

      // 4.8m Piercing Horizontal Iaido Flash Beam (Deep plum-crimson ink + blinding sakura-white core!)
      addMesh(this.geo.plane, 'iaido_flash_beam', '#38061a', 1.0, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.00, 2.5);
      }, (m, mat, t, ease) => {
        m.scale.set(5.8 * Math.min(1, ease * 2.4), 1.85 * (1 - t * 0.4), 1);
        mat.opacity = clamp01(1 - t * 1.15) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'iaido_flash_beam', '#f472b6', 2.7, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.04, 2.5);
      }, (m, mat, t, ease) => {
        m.scale.set(5.6 * Math.min(1, ease * 2.4), 1.50 * (1 - t * 0.4), 1);
        mat.opacity = clamp01(1 - t * 1.2);
      });
      // Vertical companion blade sheet so the slash reads 3D from every angle!
      addMesh(this.geo.plane, 'iaido_flash_beam', '#fff1f2', 2.8, (m) => {
        m.rotation.set(0, Math.PI * 0.5, 0);
        m.position.set(0, 1.06, 2.5);
      }, (m, mat, t, ease) => {
        m.scale.set(5.4 * Math.min(1, ease * 2.4), 1.1 * (1 - t * 0.5), 1);
        mat.opacity = clamp01(1 - t * 1.35);
      });

      // 2 Wind-Shear Blossom Rings along the Flash trajectory
      for (let i = 0; i < 2; i++) {
        const rz = 1.2 + i * 2.2;
        addMesh(this.geo.plane, 'blossom_ring', '#38061a', 1.0, (m) => {
          m.position.set(0, 1.04, rz);
        }, (m, mat, t, ease) => {
          const s = 0.8 + ease * 2.6;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25) * 0.90;
        }, false);
        addMesh(this.geo.plane, 'blossom_ring', '#f472b6', 2.4, (m) => {
          m.position.set(0, 1.04, rz + 0.03);
        }, (m, mat, t, ease) => {
          const s = 0.75 + ease * 2.5;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.3);
        });
      }

      // Blooming Sakura Flower & Cross Flare at Destination (z = 4.8m)!
      addMesh(this.geo.plane, 'sakura_flower', '#450720', 1.0, (m) => {
        m.position.set(0, 1.08, 4.75);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 3.0);
        const s = 1.2 + ease * 2.9;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.1) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'sakura_flower', '#f472b6', 2.5, (m) => {
        m.position.set(0, 1.10, 4.80);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 3.0);
        const s = 1.1 + ease * 2.75;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.15);
      });
      addMesh(this.geo.plane, 'blossom_flare', '#fff1f2', 3.0, (m) => {
        m.position.set(0, 1.12, 4.82);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.4 + ease * 3.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.8);
      });

      // Sweeping Sakura Petal Trail spanning the entire 4.8m dash line!
      addPetals(26, {
        tex: 'sakura_petal', additive: false, color: '#f472b6',
        ox: 0, oy: 1.0, oz: 2.4, radius: 0.75, ozSpread: 4.4,
        speedMin: 0.8, speedMax: 2.4, vyMin: 0.6, vyMax: 2.4, size: 0.46
      });
      addPetals(14, {
        tex: 'sakura_spark', additive: true, color: '#fcd34d',
        ox: 0, oy: 1.0, oz: 2.4, radius: 0.6, ozSpread: 4.4,
        speedMin: 1.2, speedMax: 3.6, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: SENBONZAKURA STORM x CONTROL BLADE: HITEN BLADE!
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_weapon') {
      duration = 1.25;

      // Giant 7.6m Blooming Sakura Mandala Crest on the Arena Floor (3.8m radius!)
      addMesh(this.geo.plane, 'sakura_crest', '#2e0618', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 6.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.4;
        mat.opacity = clamp01((t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4))) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'sakura_crest', '#f472b6', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 3.4;
        mat.opacity = clamp01((t < 0.06 ? t / 0.06 : 1 - Math.pow((t - 0.06) / 0.94, 1.4))) * 0.95;
      });

      // Outer 8.0m Golden-Rose Petal Shockwave Perimeter Ring
      addMesh(this.geo.plane, 'blossom_ring', '#38061a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.07, 0);
      }, (m, mat, t, ease) => {
        const s = 2.2 + ease * 6.0;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 5.0;
        mat.opacity = clamp01(1 - t) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'blossom_ring', '#fcd34d', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.10, 0);
      }, (m, mat, t, ease) => {
        const s = 2.1 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 5.0;
        mat.opacity = clamp01(1 - t);
      });

      // 3D Swirling Sakura Blossom Cyclone Funnel!
      addMesh(this.geo.cyclone, 'petal_vortex', '#3b071e', 1.0, null, (m, mat, t, ease) => {
        const r = 1.2 + ease * 1.9;
        const h = 1.8 + ease * 3.4;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = t * 10.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.35))) * 0.92;
      }, false);
      addMesh(this.geo.cyclone, 'petal_vortex', '#f472b6', 2.3, null, (m, mat, t, ease) => {
        const r = 1.05 + ease * 1.75;
        const h = 2.0 + ease * 3.6;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + gyOffset;
        m.rotation.y = -t * 13.0;
        mat.opacity = clamp01((t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92)) * 0.92;
      });

      // 8 Summoned Floating Spectral Katanas ([Arts] Control Blade: Hiten Blade!) fanning & slicing in 3D!
      const bladeRing = new THREE.Group();
      bladeRing.position.set(0, 1.45, 0);
      root.add(bladeRing);
      const bladeMats = [];
      const bladeNodes = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const holder = new THREE.Group();
        holder.rotation.y = ang;

        const darkMat = this.makeMat('spectral_katana', '#450720', 1.0, 0.95, false);
        const darkSword = new THREE.Mesh(this.geo.plane, darkMat);
        darkSword.scale.set(1.3, 2.9, 1);
        darkSword.rotation.z = -0.35;
        darkSword.renderOrder = 18;
        holder.add(darkSword);

        const glowMat = this.makeMat('spectral_katana', i % 2 === 0 ? '#f472b6' : '#fff1f2', 2.6, 0.96, true);
        const glowSword = new THREE.Mesh(this.geo.plane, glowMat);
        glowSword.position.z = 0.04;
        glowSword.scale.set(1.22, 2.8, 1);
        glowSword.rotation.z = -0.35;
        glowSword.renderOrder = 19;
        holder.add(glowSword);

        bladeRing.add(holder);
        bladeNodes.push({ holder, ang, phase: i * 0.78 });
        bladeMats.push(darkMat, glowMat);
      }
      parts.push({
        mesh: bladeRing,
        mat: bladeMats[0],
        extraMats: bladeMats.slice(1),
        update: (g, _m, t, ease) => {
          g.rotation.y = t * 7.5;
          const rad = 1.2 + ease * 2.25;
          const fade = clamp01(t < 0.1 ? t / 0.1 : 1 - Math.pow((t - 0.1) / 0.9, 1.5));
          for (const b of bladeNodes) {
            const plunge = Math.sin(t * Math.PI * 2.5 + b.phase) * 0.45;
            b.holder.position.set(Math.cos(b.ang) * rad, plunge, Math.sin(b.ang) * rad);
            b.holder.rotation.x = 0.35 + plunge * 0.35;
          }
          for (const bm of bladeMats) bm.opacity = fade * 0.95;
        }
      });

      // 6 Staggered Multi-Angle Blossom Katana Slashes tearing through the storm!
      for (let i = 0; i < 6; i++) {
        const delay = i * 0.085;
        const rx = (i % 2 === 0 ? 0.50 : -0.50);
        const ry = (i / 6) * Math.PI * 2;
        const oy = 0.9 + (i % 3) * 0.65;
        const col = i % 3 === 0 ? '#f43f5e' : (i % 3 === 1 ? '#f472b6' : '#fff1f2');
        addMesh(this.geo.plane, 'katana_crescent', '#38061a', 1.0, (m) => {
          m.position.set(Math.cos(ry) * 0.7, oy - 0.03, Math.sin(ry) * 0.7);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.46;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.rotation.set(rx, ry, -1.25 + le * 2.55);
          const s = 3.2 + le * 2.4;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt * 0.95) * 0.94;
        }, false);
        addMesh(this.geo.plane, 'katana_crescent', col, 2.5, (m) => {
          m.position.set(Math.cos(ry) * 0.7, oy, Math.sin(ry) * 0.7);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.46;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.rotation.set(rx, ry, -1.25 + le * 2.55);
          const s = 3.0 + le * 2.25;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Central Giant Blooming Sakura Flower Finisher!
      addMesh(this.geo.plane, 'sakura_flower', '#f472b6', 2.4, (m) => {
        m.position.set(0, 1.45, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 2.2);
        const s = 1.4 + ease * 3.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.15) * 0.92;
      });

      // 36 Fluttering Sakura Petals + Golden-Rose Glints!
      addPetals(36, {
        tex: 'sakura_petal', additive: false, color: '#f472b6',
        radius: 2.4, oy: 0.65, oySpread: 0.9,
        speedMin: 1.4, speedMax: 4.2, vyMin: 1.8, vyMax: 5.2, gravity: -1.2, maxDelay: 0.35, size: 0.50
      });
      addPetals(18, {
        tex: 'sakura_spark', additive: true, color: '#fcd34d',
        radius: 2.0, oy: 0.6, speedMin: 2.0, speedMax: 5.2, vyMin: 2.5, vyMax: 6.0, gravity: -3.0, maxDelay: 0.3, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: MIND'S EYE COUNTER (9m Flowering 360 Katana Counter!)
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_armor') {
      duration = 1.02;

      // 9.0m Spinning Crimson-Sakura Counter Crest (4.5m radius!)
      addMesh(this.geo.plane, 'sakura_crest', '#380518', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 7.2;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.5;
        mat.opacity = clamp01(1 - t) * 0.96;
      }, false);
      addMesh(this.geo.plane, 'sakura_crest', '#f43f5e', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.7 + ease * 7.0;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.5;
        mat.opacity = clamp01(1 - t);
      });

      // 9.2m High-Speed Expanding Counter Shockwave Ring
      addMesh(this.geo.plane, 'blossom_ring', '#380518', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.62);
        const s = 1.2 + easeOutCubic(wt) * 8.2;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) * 0.96 : 0;
      }, false);
      addMesh(this.geo.plane, 'blossom_ring', '#fff1f2', 2.7, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.12, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.62);
        const s = 1.1 + easeOutCubic(wt) * 8.0;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // Full 360-Degree Spinning Horizontal Katana Counter Sweep!
      addMesh(this.geo.plane, 'katana_crescent', '#3b0618', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 1.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.6 + ease * 6.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * Math.PI * 4.0;
        mat.opacity = clamp01(1 - t * 1.35) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'katana_crescent', '#f43f5e', 2.7, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 1.08, 0);
      }, (m, mat, t, ease) => {
        const s = 2.4 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * Math.PI * 4.0;
        mat.opacity = clamp01(1 - t * 1.4);
      });

      // Blinding Mind's Eye White-Pink & Gold Cross Flash + Opening Sakura Flower!
      addMesh(this.geo.plane, 'blossom_flare', '#fcd34d', 3.0, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + ease * 4.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 2.2);
      });
      addMesh(this.geo.plane, 'sakura_flower', '#f472b6', 2.5, (m) => {
        m.position.set(0, 1.12, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(-t * 2.4);
        const s = 1.4 + ease * 3.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.4);
      });

      addPetals(28, {
        tex: 'sakura_petal', additive: false, color: '#fb7185',
        radius: 0.9, oy: 0.9, speedMin: 3.0, speedMax: 7.5, vyMin: 1.2, vyMax: 4.0, gravity: -2.0, size: 0.48
      });
      addPetals(16, {
        tex: 'sakura_spark', additive: true, color: '#fcd34d',
        radius: 0.7, oy: 1.0, speedMin: 3.5, speedMax: 8.0, vyMin: 1.2, vyMax: 4.0, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: ASURA BLOOD AURA (6s Stance Aura + 4 Floating Katanas!)
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_helmet') {
      duration = 6.0;
      attachToCaster = true;

      // Persistent 3.8m Spinning Crimson-Sakura Stance Halo attached to Samurai!
      addMesh(this.geo.plane, 'sakura_crest', '#380514', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.05, 0);
      }, (m, mat, t) => {
        const s = t < 0.05 ? (1.2 + easeOutCubic(t / 0.05) * 2.8) : 4.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
        mat.opacity = 0.80 * fadeOut;
      }, false);
      addMesh(this.geo.plane, 'sakura_crest', '#f43f5e', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t) => {
        const s = t < 0.05 ? (1.1 + easeOutCubic(t / 0.05) * 2.7) : 3.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 14.0;
        const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
        mat.opacity = (0.72 + 0.18 * Math.sin(t * 48)) * fadeOut;
      });

      // Tall Translucent Magenta-Crimson Vertical Aura Sheath (Tree of Savior Blossom Blader 7:07!)
      addMesh(this.geo.sheath, 'petal_vortex', '#dc2626', 1.9, null, (m, mat, t) => {
        const expand = t < 0.05 ? easeOutCubic(t / 0.05) : 1.0;
        const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
        const r = (0.85 + 0.08 * Math.sin(t * 42)) * expand;
        const h = 2.6 * expand;
        m.scale.set(r, h, r);
        m.position.y = h * 0.5 + 0.05;
        m.rotation.y = t * 28.0;
        mat.opacity = 0.52 * fadeOut;
      });

      // Initial Awakening Vertical Light Flare Burst (first 0.55s)
      addMesh(this.geo.plane, 'blossom_flare', '#fff1f2', 2.9, (m) => {
        m.position.set(0, 1.35, 0);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.09);
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.4 + easeOutCubic(wt) * 3.8;
        m.scale.set(s, s * 1.25, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });

      // 4 Floating Spectral Katanas orbiting Samurai's shoulders for the full 6s!
      const orbitGroup = new THREE.Group();
      orbitGroup.position.set(0, 1.35, 0);
      root.add(orbitGroup);
      const swordMats = [];
      const swordNodes = [];
      for (let i = 0; i < 4; i++) {
        const node = new THREE.Group();
        const darkMat = this.makeMat('spectral_katana', '#450514', 1.0, 0.92, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.scale.set(0.95, 2.05, 1);
        darkM.renderOrder = 17;
        node.add(darkM);

        const glowMat = this.makeMat('spectral_katana', i % 2 === 0 ? '#f43f5e' : '#f472b6', 2.5, 0.96, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.position.z = 0.03;
        glowM.scale.set(0.90, 1.98, 1);
        glowM.renderOrder = 19;
        node.add(glowM);

        orbitGroup.add(node);
        swordNodes.push(node);
        swordMats.push(darkMat, glowMat);
      }

      parts.push({
        mesh: orbitGroup,
        mat: swordMats[0],
        extraMats: swordMats.slice(1),
        update: (_g, _m, t) => {
          const sec = t * duration;
          const expand = t < 0.05 ? easeOutCubic(t / 0.05) : 1.0;
          const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
          const rad = 1.38 * expand;
          const invQ = root.quaternion.clone().invert();
          for (let i = 0; i < 4; i++) {
            const ang = sec * 3.8 + (i * Math.PI * 0.5);
            const node = swordNodes[i];
            node.position.set(
              Math.cos(ang) * rad,
              Math.sin(sec * 4.5 + i * 1.57) * 0.25,
              Math.sin(ang) * rad
            );
            node.quaternion.copy(this.camera.quaternion).premultiply(invQ);
            node.rotateZ(Math.sin(sec * 3.0 + i) * 0.18);
          }
          for (let k = 0; k < swordMats.length; k++) {
            swordMats[k].opacity = (k % 2 === 0 ? 0.88 : 0.95) * fadeOut;
          }
        }
      });

      addPetals(22, {
        tex: 'sakura_petal', additive: false, color: '#f43f5e',
        radius: 1.5, oy: 0.5, speedMin: 0.8, speedMax: 2.2, vyMin: 1.8, vyMax: 4.0, gravity: -0.5, maxDelay: 0.35, size: 0.44
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: TSUBAME GAESHI (Twin Rising Vertical Sakura Slashes!)
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_trinket') {
      duration = 0.78;

      // Ground Launch Blossom Ring
      addMesh(this.geo.plane, 'blossom_ring', '#38061a', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 1.0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 4.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.15) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'blossom_ring', '#fb7185', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 1.0);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 4.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // Twin Vertical Rising X-Crossed Katana Crescent Arcs (Tsubame Gaeshi Double Swallow!)
      for (let k = 0; k < 2; k++) {
        const sideTilt = k === 0 ? 0.28 : -0.28;
        const delay = k * 0.07;
        addMesh(this.geo.plane, 'katana_crescent', '#38061a', 1.0, null, (m, mat, t) => {
          const lt = (t - delay) / 0.65;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.position.set(sideTilt * 0.8, 0.9 + le * 3.0, 1.1 + le * 1.8);
          m.rotation.set(0, Math.PI * 0.5 + sideTilt, -1.6 + le * 2.3);
          const s = 2.8 + le * 2.6;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt) * 0.94;
        }, false);
        addMesh(this.geo.plane, 'katana_crescent', k === 0 ? '#f472b6' : '#f43f5e', 2.6, null, (m, mat, t) => {
          const lt = (t - delay) / 0.65;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const le = easeOutCubic(lt);
          m.position.set(sideTilt * 0.8 + 0.04, 0.95 + le * 3.0, 1.15 + le * 1.8);
          m.rotation.set(0, Math.PI * 0.5 + sideTilt, -1.6 + le * 2.3);
          const s = 2.65 + le * 2.45;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Blooming Sakura Flower at Apex
      addMesh(this.geo.plane, 'sakura_flower', '#fff1f2', 2.5, (m) => {
        m.position.set(0, 2.2, 1.8);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 3.5);
        const s = 1.2 + ease * 2.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.3);
      });

      addPetals(24, {
        tex: 'sakura_petal', additive: false, color: '#f472b6',
        ox: 0, oy: 0.7, oz: 1.2, radius: 1.0,
        forwardBias: 2.5, speedMin: 1.0, speedMax: 2.8, vyMin: 4.0, vyMax: 8.0, gravity: -2.0, size: 0.46
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: FALLING BLOSSOM FLASH STEP (Double Jump / Air Dash!)
    // ------------------------------------------------------------------------
    else if (effectId === 'samurai_mobility_flashstep') {
      duration = 0.48;

      addMesh(this.geo.plane, 'sakura_flower', '#3b071e', 1.0, (m) => {
        m.position.set(0, 0.95, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 3.8);
        const s = 0.95 + ease * 1.85;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'sakura_flower', '#f472b6', 2.4, (m) => {
        m.position.set(0, 0.98, 0.03);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 3.8);
        const s = 0.90 + ease * 1.75;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'blossom_ring', '#f472b6', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 0.8 + ease * 2.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addPetals(14, {
        tex: 'sakura_petal', additive: false, color: '#f472b6',
        radius: 0.55, oy: 0.85, speedMin: 1.0, speedMax: 2.8, vyMin: 0.5, vyMax: 2.2, gravity: -1.4, size: 0.42
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
        const flutter = sp.isPetal ? Math.sin(localT * sp.flutterFreq + sp.rotInit) * sp.flutterAmp : 0;
        sp.mesh.position.set(
          sp.ox + sp.vx * localT + flutter,
          Math.max(0.08, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT),
          sp.oz + sp.vz * localT
        );
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);
        if (sp.isPetal) {
          const sc = sp.baseSz * (0.85 + Math.sin(st * Math.PI) * 0.35);
          sp.mesh.scale.set(sc * (0.65 + 0.35 * Math.abs(Math.cos(localT * 5.0))), sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.1 ? st / 0.1 : 1 - (st - 0.1) / 0.9) * 0.96);
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
