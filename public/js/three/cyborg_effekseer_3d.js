// ============================================================================
// LOST SAGA 3D - CYBORG (MECHA FLIGHT TROOPER) 3D EFFEKSEER + THREE.JS VFX
// ============================================================================
// Dedicated 7-move Cyborg 3D VFX suite:
//   1. PRIMARY: Compiled EffekseerForWebGL (.efkefc) runtime synced to camera
//   2. NATIVE 3D THREE.JS HIGH-CONTRAST DUAL-PASS: Deep titanium-navy & reactor-
//      obsidian NormalBlending silhouettes (#09152b / #3a1204) paired with
//      electric Buster-cyan (#38bdf8 / #e0f7ff), EMP teal (#2dd4bf), and
//      supersonic jetpack amber-orange (#f97316 / #fbbf24) Additive HDR Bloom
//      using our 10 512x512 sci-fi mecha PNGs!
// ============================================================================
import * as THREE from 'three';

const CYBORG_TEX_NAMES = [
  'mecha_hud_reticle',
  'buster_beam_core',
  'hex_emp_grid',
  'rail_shock_ring',
  'plasma_arc_bolt',
  'jet_thruster_plume',
  'missile_smoke_puff',
  'mecha_flare',
  'cyber_hex_tile',
  'ion_spark'
];

const CYBORG_EFFECT_IDS = new Set([
  'cyborg_basic_plasma',
  'cyborg_heavy_laser',
  'cyborg_weapon',
  'cyborg_armor',
  'cyborg_helmet',
  'cyborg_trinket',
  'cyborg_mobility_jetpack'
]);

const UP_VEC = new THREE.Vector3(0, 1, 0);

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

export class CyborgThreeVFX {
  constructor(scene, camera, shakeFn = () => {}, floorYFn = () => 0) {
    this.scene = scene;
    this.camera = camera;
    this.shake = shakeFn;
    this.floorY = floorYFn;

    this.group = new THREE.Group();
    this.group.name = 'CyborgThreeVFXGroup';
    this.scene.add(this.group);

    this.textures = {};
    this.loadTextures();

    this.geo = {
      plane: new THREE.PlaneGeometry(1, 1),
      beamTube: new THREE.CylinderGeometry(1.0, 1.0, 1.0, 26, 1, true),
      empDome: new THREE.SphereGeometry(1.0, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58)
    };

    this.activeEffects = [];
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    for (const name of CYBORG_TEX_NAMES) {
      const tex = loader.load(`/assets/vfx/cyborg/textures/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (name === 'hex_emp_grid') {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
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
   * Handle server FX events for Cyborg (including stolen Cyborg gear skills!).
   * Returns true if handled/suppressed by the Cyborg 3D VFX suite.
   */
  handleServerFx(fx) {
    const bridge = window.KnightEffekseerVFX;
    if (!bridge || !fx) return false;

    const mapped = bridge.resolveServerFxMapping(fx);
    if (mapped && CYBORG_EFFECT_IDS.has(mapped.effectId)) {
      const playedEffekseer = bridge.playWebGLOnly(mapped.effectId, mapped);
      if (!playedEffekseer) {
        this.spawnThreeEffect(mapped.effectId, mapped);
      }

      if (mapped.effectId === 'cyborg_weapon') this.shake(8);
      else if (mapped.effectId === 'cyborg_trinket') this.shake(7);
      else if (mapped.effectId === 'cyborg_armor') this.shake(6);
      else if (mapped.effectId === 'cyborg_heavy_laser') this.shake(5);
      else if (mapped.effectId === 'cyborg_helmet') this.shake(4);
      else if (mapped.effectId === 'cyborg_basic_plasma' && mapped.isFinisher) this.shake(3);

      return true;
    }

    // Suppress ONLY Cyborg's duplicate secondary server events
    if (
      fx.type === 'skill_cast' &&
      (fx.skillId === 'cyborg_weapon' || fx.skillId === 'cyborg_armor' || fx.skillId === 'cyborg_trinket')
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

    const addParticles = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const kind = cfg.kind || 'spark'; // 'spark' | 'hex' | 'smoke'
        const tex = cfg.tex || (kind === 'hex' ? 'cyber_hex_tile' : (kind === 'smoke' ? 'missile_smoke_puff' : 'ion_spark'));
        const additive = cfg.additive !== undefined ? cfg.additive : (kind !== 'smoke');
        const mat = this.makeMat(tex, cfg.color || (kind === 'smoke' ? '#cbd5e1' : '#38bdf8'), cfg.intensity || (additive ? 2.4 : 1.0), 1.0, additive);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = additive ? 20 : 18;

        const ang = Math.random() * Math.PI * 2;
        const rad = (cfg.radiusMin || 0) + Math.random() * ((cfg.radius || 0.7) - (cfg.radiusMin || 0));
        const spd = (cfg.speedMin !== undefined ? cfg.speedMin : 1.2) + Math.random() * (cfg.speedMax !== undefined ? cfg.speedMax : 3.6);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin !== undefined ? cfg.vyMin : 0.6) + Math.random() * (cfg.vyMax !== undefined ? cfg.vyMax : 2.6);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy !== undefined ? cfg.oy : 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.5);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || (kind === 'smoke' ? 1.35 : (kind === 'hex' ? 0.36 : 0.34))) * (0.75 + Math.random() * 0.65);
        root.add(mesh);

        particles.push({
          mesh, mat, kind, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : (kind === 'smoke' ? 0.8 : (kind === 'hex' ? -0.6 : -6.5)),
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.12),
          baseSz: sz,
          implode: !!cfg.implode,
          swirl: cfg.swirl || 0,
          swirlRadius: rad,
          swirlAngle: ang,
          rotSpeed: (Math.random() - 0.5) * (kind === 'smoke' ? 1.5 : 8.5),
          rotInit: Math.random() * Math.PI * 2,
          alphaPeak: cfg.alphaPeak !== undefined ? cfg.alphaPeak : (kind === 'smoke' ? 0.66 : 0.96)
        });
      }
    };

    // Helper: Twin Mecha Jetpack Wing Afterburner Plumes (X-crossed per nozzle so visible from all angles!)
    const addThrusterPlume = (ox, oy, oz, length, width, tiltX = 0.22, tiltZ = 0.0, delay = 0, life = 0.85) => {
      const nozzle = new THREE.Group();
      nozzle.position.set(ox, oy, oz);
      nozzle.rotation.set(tiltX, 0, tiltZ);
      root.add(nozzle);

      const mats = [];
      for (let p = 0; p < 2; p++) {
        const ang = p * Math.PI * 0.5;
        const darkMat = this.makeMat('jet_thruster_plume', '#3a1204', 1.0, 0.88, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.y = ang;
        darkM.position.y = -0.48;
        darkM.scale.set(1.12, 1.04, 1);
        darkM.renderOrder = 17;
        nozzle.add(darkM);

        const glowMat = this.makeMat('jet_thruster_plume', p === 0 ? '#f97316' : '#38bdf8', 2.6, 0.96, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.rotation.y = ang;
        glowM.position.y = -0.46;
        glowM.renderOrder = 19;
        nozzle.add(glowM);

        mats.push(darkMat, glowMat);
      }

      parts.push({
        mesh: nozzle,
        mat: mats[0],
        extraMats: mats.slice(1),
        update: (g, _m, t) => {
          const lt = (t - delay) / life;
          if (lt <= 0 || lt >= 1) { g.visible = false; return; }
          g.visible = true;
          const flicker = 0.88 + 0.18 * Math.sin(lt * 52);
          const fade = clamp01(1 - lt);
          const curL = length * (0.45 + easeOutCubic(Math.min(1, lt * 3.5)) * 0.65) * flicker;
          g.scale.set(width * (0.65 + fade * 0.5), curL, width * (0.65 + fade * 0.5));
          for (let k = 0; k < mats.length; k++) {
            mats[k].opacity = (k % 2 === 0 ? 0.82 : 0.96) * fade;
          }
        }
      });
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: PLASMA RIFLE HUD MUZZLE CAST (Barrel VFX ONLY!)
    // ------------------------------------------------------------------------
    if (effectId === 'cyborg_basic_plasma') {
      duration = opts.isFinisher ? 0.44 : 0.30;

      // Vertical Spinning Sci-Fi HUD Targeting Aperture right at Rifle Muzzle (z = 0.92m)
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.position.set(0, 1.02, 0.90);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.50 : 1.05) + ease * 0.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t * 1.15) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.5, (m) => {
        m.position.set(0, 1.02, 0.94);
      }, (m, mat, t, ease) => {
        const s = (opts.isFinisher ? 1.44 : 1.00) + ease * 0.80;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 6.0;
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // Anamorphic Plasma Lens Flare Flash
      addMesh(this.geo.plane, 'mecha_flare', '#e0f7ff', 3.0, (m) => {
        m.position.set(0, 1.02, 0.98);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = (opts.isFinisher ? 1.5 : 1.05) + ease * 1.4;
        m.scale.set(s * 1.4, s * 0.78, 1);
        mat.opacity = clamp01(1 - t * 1.9);
      });

      // Overcharged Finisher: Mechanical Rail Shock Ring + Plasma Discharge Bolt!
      if (opts.isFinisher) {
        addMesh(this.geo.plane, 'rail_shock_ring', '#09152b', 1.0, (m) => {
          m.position.set(0, 1.02, 1.04);
        }, (m, mat, t, ease) => {
          const s = 0.85 + ease * 2.1;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.2) * 0.88;
        }, false);
        addMesh(this.geo.plane, 'rail_shock_ring', '#38bdf8', 2.7, (m) => {
          m.position.set(0, 1.02, 1.08);
        }, (m, mat, t, ease) => {
          const s = 0.80 + ease * 2.0;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(1 - t * 1.25);
        });
      }

      addParticles(opts.isFinisher ? 10 : 6, {
        kind: 'spark', additive: true, color: '#e0f7ff',
        ox: 0, oy: 1.02, oz: 1.02, radius: 0.25,
        forwardBias: 3.4, speedMin: 0.9, speedMax: 2.8, vyMin: 0.2, vyMax: 1.8, size: 0.32
      });
      addParticles(opts.isFinisher ? 8 : 4, {
        kind: 'hex', additive: false, color: '#0284c7',
        ox: 0, oy: 1.02, oz: 1.05, radius: 0.30,
        forwardBias: 1.8, speedMin: 0.6, speedMax: 2.0, vyMin: 0.3, vyMax: 1.5, size: 0.28
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: CYBORG LASER CANNON (Railgun 3-Ring Accelerator Launch!)
    //    (Real piercing 3D railgun lance fires right through these 3 coil rings!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_heavy_laser') {
      duration = 0.65;

      // Precision Lock-On HUD Reticle at Railgun Barrel
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.position.set(0, 1.04, 1.00);
      }, (m, mat, t, ease) => {
        const s = 1.3 + ease * 1.65;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 7.5;
        mat.opacity = clamp01(1 - t * 1.15) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.7, (m) => {
        m.position.set(0, 1.04, 1.04);
      }, (m, mat, t, ease) => {
        const s = 1.25 + ease * 1.55;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 7.5;
        mat.opacity = clamp01(1 - t * 1.2);
      });

      // 3 Staggered Electromagnetic Rail Accelerator Shock Rings along Firing Axis!
      for (let i = 0; i < 3; i++) {
        const rz = 1.15 + i * 1.25;
        const delay = i * 0.045;
        addMesh(this.geo.plane, 'rail_shock_ring', '#09152b', 1.0, (m) => {
          m.position.set(0, 1.04, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.50;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.85 + easeOutCubic(lt) * (2.6 - i * 0.35);
          m.scale.set(s, s, 1);
          m.rotation.z = (i % 2 === 0 ? 1 : -1) * lt * 3.0;
          mat.opacity = clamp01(1 - lt) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'rail_shock_ring', i === 2 ? '#f97316' : '#e0f7ff', 2.7, (m) => {
          m.position.set(0, 1.04, rz + 0.04);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.50;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.80 + easeOutCubic(lt) * (2.5 - i * 0.35);
          m.scale.set(s, s, 1);
          m.rotation.z = (i % 2 === 0 ? 1 : -1) * lt * 3.0;
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Blinding Anamorphic Cannon Ignition Lens Flare
      addMesh(this.geo.plane, 'mecha_flare', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.05, 1.12);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + ease * 2.4;
        m.scale.set(s * 1.8, s * 0.85, 1);
        mat.opacity = clamp01(1 - t * 2.1);
      });

      // Crackling Electric Recoil Plasma Arcs around the Barrel
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -0.45 : 0.45;
        addMesh(this.geo.plane, 'plasma_arc_bolt', '#38bdf8', 2.6, (m) => {
          m.position.set(side, 1.04, 1.85);
          m.rotation.set(0, Math.PI * 0.5, Math.PI * 0.5 + side * 0.35);
        }, (m, mat, t) => {
          const s = 0.9 + t * 1.1;
          m.scale.set(s * 0.75, s * 1.9, 1);
          mat.opacity = clamp01(1 - t * 1.6) * (0.65 + 0.35 * Math.sin(t * 60 + i * 2));
        });
      }

      addParticles(14, {
        kind: 'spark', additive: true, color: '#38bdf8',
        ox: 0, oy: 1.04, oz: 1.4, radius: 0.45,
        forwardBias: 5.5, speedMin: 1.5, speedMax: 4.5, vyMin: 0.2, vyMax: 2.2, size: 0.36
      });
      addParticles(10, {
        kind: 'hex', additive: false, color: '#0284c7',
        ox: 0, oy: 1.04, oz: 1.6, radius: 0.55,
        forwardBias: 3.0, speedMin: 1.0, speedMax: 3.0, size: 0.32
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: BUSTER BEAM (9.5m Giant Forward Plasma Cannon!)
    //    (Matches server.js hitLine(player, 9.5, 2.6) to the exact decimeter!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_weapon') {
      duration = 1.25;

      // Ground Launch Calibration HUD Seal under Cyborg
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.6 + ease * 2.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.0;
        mat.opacity = clamp01(1 - t) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.5 + ease * 2.7;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.0;
        mat.opacity = clamp01(1 - t);
      });

      // Vertical Buster Cannon Firing Aperture HUD Ring (z = 0.95m)
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.position.set(0, 1.08, 0.92);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 1.9;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 7.5;
        mat.opacity = clamp01(1 - t * 1.05) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.7, (m) => {
        m.position.set(0, 1.08, 0.96);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 1.85;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 7.5;
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // COLOSSAL 9.5m 3D HORIZONTAL GIGA BUSTER PLASMA BEAM (Crossed H+V + 3D Hex Containment Tube!)
      const beamLen = 9.6;
      const beamCenterZ = 0.95 + beamLen * 0.5;

      // Pass 1 (NormalBlending Deep Cobalt-Navy Outer Plasma Silhouette — pops sharply on sunlit stone!)
      addMesh(this.geo.plane, 'buster_beam_core', '#091a3a', 1.0, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.02, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.12));
        const pulse = 0.92 + 0.12 * Math.sin(t * 58);
        const taper = t > 0.65 ? clamp01(1 - (t - 0.65) / 0.35) : 1.0;
        const curLen = beamLen * extend;
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(curLen, 3.35 * pulse * (0.35 + 0.65 * taper), 1);
        mat.opacity = 0.94 * taper;
      }, false);

      // Pass 2 (Additive HDR Electric Cyan Horizontal Beam)
      addMesh(this.geo.plane, 'buster_beam_core', '#38bdf8', 2.8, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.08, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.12));
        const pulse = 0.90 + 0.16 * Math.sin(t * 64);
        const taper = t > 0.65 ? clamp01(1 - (t - 0.65) / 0.35) : 1.0;
        const curLen = beamLen * extend;
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(curLen, 2.95 * pulse * (0.28 + 0.72 * taper), 1);
        mat.opacity = taper;
      });

      // Pass 3 (Additive White-Hot Vertical Cross-Sheet so Beam reads huge from every 3D angle!)
      addMesh(this.geo.plane, 'buster_beam_core', '#e0f7ff', 3.0, (m) => {
        m.rotation.set(0, Math.PI * 0.5, 0);
        m.position.set(0, 1.08, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.12));
        const pulse = 0.90 + 0.16 * Math.cos(t * 56);
        const taper = t > 0.65 ? clamp01(1 - (t - 0.65) / 0.35) : 1.0;
        const curLen = beamLen * extend;
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(curLen, 2.55 * pulse * (0.25 + 0.75 * taper), 1);
        mat.opacity = taper;
      });

      // Pass 4 (3D Rotating Hex-Grid Plasma Containment Sleeve wrapping the entire 9.5m Cannon Beam!)
      addMesh(this.geo.beamTube, 'hex_emp_grid', '#38bdf8', 2.2, (m) => {
        m.rotation.x = Math.PI * 0.5;
        m.position.set(0, 1.08, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.14));
        const taper = t > 0.62 ? clamp01(1 - (t - 0.62) / 0.38) : 1.0;
        const curLen = beamLen * extend;
        const rad = (1.15 + 0.14 * Math.sin(t * 42)) * (0.4 + 0.6 * taper);
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(rad, curLen, rad);
        m.rotation.z = t * 9.5;
        mat.opacity = 0.80 * taper;
      });

      // 3 Staggered Mechanical Shock Accelerator Rings blasted along the 9.5m Beam!
      for (let i = 0; i < 3; i++) {
        const rz = 1.65 + i * 2.45;
        const delay = i * 0.055;
        addMesh(this.geo.plane, 'rail_shock_ring', '#09152b', 1.0, (m) => {
          m.position.set(0, 1.08, rz);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.62;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 1.4 + easeOutCubic(lt) * 3.4;
          m.scale.set(s, s, 1);
          m.rotation.z = (i % 2 === 0 ? 1 : -1) * lt * 4.0;
          mat.opacity = clamp01(1 - lt) * 0.90;
        }, false);
        addMesh(this.geo.plane, 'rail_shock_ring', i === 1 ? '#f97316' : '#e0f7ff', 2.7, (m) => {
          m.position.set(0, 1.08, rz + 0.05);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.62;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 1.3 + easeOutCubic(lt) * 3.25;
          m.scale.set(s, s, 1);
          m.rotation.z = (i % 2 === 0 ? 1 : -1) * lt * 4.0;
          mat.opacity = clamp01(1 - lt);
        });
      }

      // 4 Crackling High-Voltage Plasma Arcs dancing along the Buster Beam!
      for (let i = 0; i < 4; i++) {
        const az = 2.4 + i * 2.0;
        addMesh(this.geo.plane, 'plasma_arc_bolt', '#e0f7ff', 2.7, (m) => {
          m.position.set((i % 2 === 0 ? -0.65 : 0.65), 1.1, az);
        }, (m, mat, t) => {
          const taper = t > 0.68 ? clamp01(1 - (t - 0.68) / 0.32) : 1.0;
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(Math.PI * 0.5 + Math.sin(t * 32 + i * 1.9) * 0.6);
          const s = 1.35 + 0.35 * Math.sin(t * 44 + i);
          m.scale.set(s * 0.85, s * 2.2, 1);
          mat.opacity = taper * (0.55 + 0.45 * Math.abs(Math.sin(t * 50 + i * 2.1)));
        });
      }

      // Blinding Terminal Plasma Detonation at Beam End (z = 9.5m!)
      addMesh(this.geo.plane, 'mecha_flare', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.15, 9.5);
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.08) / 0.65);
        if (t < 0.08) { mat.opacity = 0; return; }
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 2.0 + easeOutCubic(lt) * 4.4;
        m.scale.set(s * 1.45, s * 0.9, 1);
        mat.opacity = clamp01(1 - lt);
      });
      addMesh(this.geo.plane, 'rail_shock_ring', '#38bdf8', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 9.5);
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.08) / 0.72);
        if (t < 0.08) { mat.opacity = 0; return; }
        const s = 1.2 + easeOutCubic(lt) * 4.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });

      // Flying Cyber Hex Shards, Electric Ion Sparks & Terminal Exhaust Smoke!
      addParticles(24, {
        kind: 'hex', additive: false, color: '#0284c7',
        ox: 0, oy: 1.0, oz: 5.2, radius: 1.2, ozSpread: 8.2,
        speedMin: 1.6, speedMax: 4.5, vyMin: 1.4, vyMax: 4.6, gravity: -2.0, maxDelay: 0.25, size: 0.42
      });
      addParticles(24, {
        kind: 'spark', additive: true, color: '#e0f7ff',
        ox: 0, oy: 1.05, oz: 5.2, radius: 1.0, ozSpread: 8.4,
        forwardBias: 3.5, speedMin: 2.0, speedMax: 5.5, vyMin: 1.2, vyMax: 4.8, gravity: -6.0, maxDelay: 0.25, size: 0.38
      });
      addParticles(8, {
        kind: 'smoke', additive: false, color: '#475569', alphaPeak: 0.56,
        ox: 0, oy: 0.8, oz: 9.4, radius: 1.2,
        speedMin: 1.0, speedMax: 3.2, vyMin: 1.2, vyMax: 3.2, baseDelay: 0.08, size: 1.8
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: EMP GRAVITY FIELD (9.6m Geodesic Pull Dome & Shock!)
    //    (Radius 4.8m -> 9.6m diameter; pulls enemies inward + 1.5s electric stun!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_armor') {
      duration = 1.38;

      // Giant 9.6m Rotating Cyber-HUD Gravity Lock Seal on Floor
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.4 + ease * 7.6;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.8;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.3 + ease * 7.4;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 4.8;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * (0.86 + 0.14 * Math.sin(t * 36));
      });

      // TRUE 3D GEODESIC HEX-GRID EMP GRAVITY DOME (Radius 4.8m -> Snaps Open then Pulls Inward!)
      addMesh(this.geo.empDome, 'hex_emp_grid', '#091c3a', 1.0, (m) => {
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t) => {
        // Expands fast to 4.8m (0..0.18), holds with gravity pulse, then implodes slightly as enemies get pulled!
        const pop = t < 0.16 ? easeOutCubic(t / 0.16) : 1.0;
        const pull = t > 0.30 ? (1 - 0.24 * easeOutCubic((t - 0.30) / 0.70)) : 1.0;
        const r = 4.8 * pop * pull;
        m.scale.set(r, r * 0.84, r);
        m.rotation.y = t * 2.4;
        const fade = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1.0;
        mat.opacity = 0.62 * clamp01(fade);
      }, false);
      addMesh(this.geo.empDome, 'hex_emp_grid', '#2dd4bf', 2.25, (m) => {
        m.position.set(0, gyOffset + 0.02, 0);
      }, (m, mat, t) => {
        const pop = t < 0.16 ? easeOutCubic(t / 0.16) : 1.0;
        const pull = t > 0.30 ? (1 - 0.24 * easeOutCubic((t - 0.30) / 0.70)) : 1.0;
        const r = 4.72 * pop * pull;
        m.scale.set(r, r * 0.82, r);
        m.rotation.y = -t * 3.4;
        const fade = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1.0;
        mat.opacity = (0.74 + 0.18 * Math.sin(t * 40)) * clamp01(fade);
      });

      // 2 REVERSE-IMPLODING Gravity Suction Shock Rings (contracting 9.8m -> 1.4m!)
      for (let i = 0; i < 2; i++) {
        const delay = i * 0.24;
        addMesh(this.geo.plane, 'rail_shock_ring', '#09152b', 1.0, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.08 + i * 0.18, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.62;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 9.8 - easeOutCubic(lt) * 8.4; // Pulls INWARD!
          m.scale.set(s, s, 1);
          m.rotation.z = lt * 5.0;
          mat.opacity = clamp01(Math.sin(lt * Math.PI)) * 0.90;
        }, false);
        addMesh(this.geo.plane, 'rail_shock_ring', i === 0 ? '#2dd4bf' : '#e0f7ff', 2.7, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.11 + i * 0.18, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.62;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 9.6 - easeOutCubic(lt) * 8.2;
          m.scale.set(s, s, 1);
          m.rotation.z = lt * 5.0;
          mat.opacity = clamp01(Math.sin(lt * Math.PI));
        });
      }

      // 6 Crackling 3D High-Voltage EMP Lightning Bolts snapping inside the Dome!
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const rad = 2.6;
        addMesh(this.geo.plane, 'plasma_arc_bolt', i % 2 === 0 ? '#e0f7ff' : '#38bdf8', 2.8, (m) => {
          m.position.set(Math.cos(ang) * rad, 1.55, Math.sin(ang) * rad);
        }, (m, mat, t) => {
          const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
          const pullR = rad * (1 - t * 0.45);
          const spinA = ang + t * 2.8;
          m.position.set(Math.cos(spinA) * pullR, 1.45 + Math.sin(t * 24 + i) * 0.35, Math.sin(spinA) * pullR);
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(Math.sin(t * 28 + i * 2) * 0.8);
          m.scale.set(1.35, 3.1, 1);
          mat.opacity = clamp01(fade) * (0.45 + 0.55 * Math.abs(Math.sin(t * 54 + i * 1.7)));
        });
      }

      // Center EMP Gravity Core Flare
      addMesh(this.geo.plane, 'mecha_flare', '#e0f7ff', 3.0, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.6 + ease * 3.8;
        m.scale.set(s * 1.3, s, 1);
        mat.opacity = clamp01(1 - t * 1.8);
      });

      // Inward-Spiraling Holographic Hex Cells & EMP Electric Sparks!
      addParticles(24, {
        kind: 'hex', additive: true, color: '#2dd4bf',
        radiusMin: 2.2, radius: 4.8, oy: 1.1, oySpread: 1.4,
        implode: true, swirl: 5.5, vyMin: 0.2, vyMax: 1.0, gravity: 0, maxDelay: 0.25, size: 0.44
      });
      addParticles(18, {
        kind: 'spark', additive: true, color: '#e0f7ff',
        radiusMin: 1.5, radius: 4.5, oy: 1.2, oySpread: 1.2,
        implode: true, swirl: -6.5, vyMin: 0.3, vyMax: 1.2, gravity: 0, maxDelay: 0.25, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: CYBORG HOMING MISSILES (Shoulder Pod Salvo Launch!)
    //    (3 real 3D homing_missile projectiles fire at -0.35, 0, +0.35 rad!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_helmet') {
      duration = 0.92;

      // 3 Floating Tactical Orange-Amber Shoulder-Pod Lock-On Reticles (-0.35, 0, +0.35 rad!)
      const podSpecs = [
        { ang: -0.35, ox: -0.82, oy: 1.42, oz: 0.82, delay: 0.00 },
        { ang:  0.00, ox:  0.00, oy: 1.58, oz: 1.05, delay: 0.04 },
        { ang:  0.35, ox:  0.82, oy: 1.42, oz: 0.82, delay: 0.08 }
      ];
      for (const ps of podSpecs) {
        addMesh(this.geo.plane, 'mecha_hud_reticle', '#3a1204', 1.0, (m) => {
          m.position.set(ps.ox, ps.oy, ps.oz);
          m.rotation.y = -ps.ang;
        }, (m, mat, t) => {
          const lt = (t - ps.delay) / 0.72;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.85 + easeOutCubic(lt) * 1.15;
          m.scale.set(s, s, 1);
          m.rotation.z = lt * 6.5;
          mat.opacity = clamp01(1 - lt) * 0.92;
        }, false);
        addMesh(this.geo.plane, 'mecha_hud_reticle', '#f97316', 2.6, (m) => {
          m.position.set(ps.ox, ps.oy, ps.oz + 0.04);
          m.rotation.y = -ps.ang;
        }, (m, mat, t) => {
          const lt = (t - ps.delay) / 0.72;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 0.80 + easeOutCubic(lt) * 1.10;
          m.scale.set(s, s, 1);
          m.rotation.z = lt * 6.5;
          mat.opacity = clamp01(1 - lt);
        });

        // Ignition Flare per Missile Pod
        addMesh(this.geo.plane, 'mecha_flare', '#fde047', 2.9, (m) => {
          m.position.set(ps.ox, ps.oy, ps.oz + 0.12);
        }, (m, mat, t) => {
          const lt = (t - ps.delay) / 0.36;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          const s = 1.0 + easeOutCubic(lt) * 1.65;
          m.scale.set(s * 1.35, s * 0.8, 1);
          mat.opacity = clamp01(1 - lt);
        });
      }

      // Twin Shoulder Rocket Backblast Plumes firing backward (-Z)
      addThrusterPlume(-0.55, 1.38, -0.25, 2.0, 0.85, Math.PI * 0.55, 0.18, 0.0, 0.55);
      addThrusterPlume( 0.55, 1.38, -0.25, 2.0, 0.85, Math.PI * 0.55, -0.18, 0.0, 0.55);

      // Launch Shock Ring on Ground
      addMesh(this.geo.plane, 'rail_shock_ring', '#f97316', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.05, 0.2);
      }, (m, mat, t, ease) => {
        const s = 1.0 + ease * 3.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25);
      });

      // Billowing Rocket Exhaust Smoke Clouds & Amber Launch Sparks!
      addParticles(14, {
        kind: 'smoke', additive: false, color: '#cbd5e1', alphaPeak: 0.72,
        ox: 0, oy: 1.35, oz: -0.15, radius: 0.9,
        forwardBias: -2.2, speedMin: 0.6, speedMax: 2.0, vyMin: 0.5, vyMax: 1.8, size: 1.45
      });
      addParticles(18, {
        kind: 'spark', additive: true, color: '#fbbf24',
        ox: 0, oy: 1.4, oz: 0.65, radius: 0.75,
        forwardBias: 3.0, speedMin: 1.5, speedMax: 4.5, vyMin: 0.8, vyMax: 3.4, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: FLIGHT ASSAULT (Jetpack Launch + Diagonal Aerial Laser!)
    //    (Exact point-to-point laser from (originX, originY+3.2, originZ) -> (tx, ty+0.5, tz)
    //     + 3.6m radius (7.2m diameter) plasma impact crater detonation!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_trinket') {
      duration = 1.18;

      // Convert world target (tx, ty, tz) into root-local space (root is at (x, y, z) rotated by yaw)
      const worldTx = opts.tx !== undefined ? opts.tx : (x + Math.cos(facing) * 5.0);
      const worldTz = opts.tz !== undefined ? opts.tz : (z + Math.sin(facing) * 5.0);
      const targetGroundY = this.groundY(worldTx, opts.ty !== undefined ? opts.ty : y, worldTz);
      const worldTy = opts.ty !== undefined ? opts.ty : (targetGroundY + 0.4);

      const invQ = root.quaternion.clone().invert();
      const localTarget = new THREE.Vector3(worldTx - x, worldTy - y, worldTz - z).applyQuaternion(invQ);
      const localImpactFloor = new THREE.Vector3(worldTx - x, targetGroundY - y + 0.05, worldTz - z).applyQuaternion(invQ);
      const startPt = new THREE.Vector3(0, 3.2, 0);

      // 1) Ground Takeoff Shockwave Ring + Twin Wing-Pack Afterburners!
      addMesh(this.geo.plane, 'rail_shock_ring', '#3a1204', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 4.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'rail_shock_ring', '#f97316', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.3);
      });

      addThrusterPlume(-0.55, 2.75, -0.22, 3.1, 1.05, 0.08,  0.14, 0.0, 0.78);
      addThrusterPlume( 0.55, 2.75, -0.22, 3.1, 1.05, 0.08, -0.14, 0.0, 0.78);

      // 2) EXACT POINT-TO-POINT DIAGONAL AERIAL CYAN PLASMA LASER BEAM!
      const beamVec = new THREE.Vector3().subVectors(localTarget, startPt);
      const beamDist = Math.max(0.5, beamVec.length());
      const beamMid = new THREE.Vector3().addVectors(startPt, localTarget).multiplyScalar(0.5);
      const beamQuat = new THREE.Quaternion().setFromUnitVectors(UP_VEC, beamVec.clone().normalize());

      const beamGroup = new THREE.Group();
      beamGroup.position.copy(beamMid);
      beamGroup.quaternion.copy(beamQuat);
      root.add(beamGroup);

      const beamMats = [];
      for (let p = 0; p < 2; p++) {
        const rotY = p * Math.PI * 0.5;
        // NormalBlending Deep Navy Silhouette (buster_beam_core is horizontal so rotate Z = 90deg to run along +Y!)
        const darkMat = this.makeMat('buster_beam_core', '#091a3a', 1.0, 0.92, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.set(0, rotY, Math.PI * 0.5);
        darkM.scale.set(1.0, 1.45, 1.0);
        darkM.renderOrder = 17;
        beamGroup.add(darkM);

        // Additive Blinding Cyan / White Core
        const glowMat = this.makeMat('buster_beam_core', p === 0 ? '#38bdf8' : '#e0f7ff', 2.9, 0.98, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.rotation.set(0, rotY, Math.PI * 0.5);
        glowM.scale.set(1.0, 1.25, 1.0);
        glowM.renderOrder = 19;
        beamGroup.add(glowM);

        beamMats.push(darkMat, glowMat);
      }
      // Hex Containment Sleeve around the Diagonal Laser!
      const tubeMat = this.makeMat('hex_emp_grid', '#38bdf8', 2.2, 0.80, true);
      const tubeMesh = new THREE.Mesh(this.geo.beamTube, tubeMat);
      tubeMesh.scale.set(0.55, 1.0, 0.55);
      tubeMesh.renderOrder = 19;
      beamGroup.add(tubeMesh);
      beamMats.push(tubeMat);

      parts.push({
        mesh: beamGroup,
        mat: beamMats[0],
        extraMats: beamMats.slice(1),
        update: (g, _m, t) => {
          const lt = clamp01(t / 0.68);
          if (lt >= 1) { g.visible = false; return; }
          g.visible = true;
          const widthScale = (lt < 0.14 ? easeOutCubic(lt / 0.14) : 1.0) * (1 - lt * 0.55);
          const pulse = 0.90 + 0.15 * Math.sin(lt * 54);
          g.scale.set(1.25 * widthScale * pulse, beamDist, 1.25 * widthScale * pulse);
          tubeMesh.rotation.y = lt * 12.0;
          const fade = clamp01(lt > 0.55 ? 1 - (lt - 0.55) / 0.45 : 1.0);
          for (let k = 0; k < beamMats.length; k++) {
            beamMats[k].opacity = (k === beamMats.length - 1 ? 0.72 : (k % 2 === 0 ? 0.88 : 0.98)) * fade;
          }
        }
      });

      // 3) 7.2m TARGET GROUND IMPACT DETONATION ZONE (Radius 3.6m at (tx, ty, tz)!)
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#09152b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.copy(localImpactFloor);
      }, (m, mat, t, ease) => {
        const s = 2.0 + ease * 5.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t * 1.05) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'mecha_hud_reticle', '#38bdf8', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(localImpactFloor.x, localImpactFloor.y + 0.04, localImpactFloor.z);
      }, (m, mat, t, ease) => {
        const s = 1.9 + ease * 5.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 5.2;
        mat.opacity = clamp01(1 - t * 1.1);
      });
      addMesh(this.geo.plane, 'rail_shock_ring', '#e0f7ff', 2.8, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(localImpactFloor.x, localImpactFloor.y + 0.08, localImpactFloor.z);
      }, (m, mat, t) => {
        const wt = clamp01(t / 0.58);
        const s = 1.2 + easeOutCubic(wt) * 6.4;
        m.scale.set(s, s, 1);
        mat.opacity = wt < 1 ? (1 - wt) : 0;
      });
      addMesh(this.geo.plane, 'mecha_flare', '#ffffff', 3.0, (m) => {
        m.position.set(localImpactFloor.x, localImpactFloor.y + 0.55, localImpactFloor.z);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 1.8 + ease * 4.2;
        m.scale.set(s * 1.45, s * 0.9, 1);
        mat.opacity = clamp01(1 - t * 1.65);
      });

      // Crackling Impact Lightning Arcs & Crater Smoke/Sparks at Target!
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        addMesh(this.geo.plane, 'plasma_arc_bolt', '#38bdf8', 2.7, (m) => {
          m.position.set(localImpactFloor.x + Math.cos(ang) * 1.2, localImpactFloor.y + 1.1, localImpactFloor.z + Math.sin(ang) * 1.2);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(ang + t * 3.0);
          m.scale.set(1.1, 2.4, 1);
          mat.opacity = clamp01(1 - t * 1.45) * (0.5 + 0.5 * Math.abs(Math.sin(t * 48 + i)));
        });
      }

      addParticles(10, {
        kind: 'smoke', additive: false, color: '#64748b', alphaPeak: 0.62,
        ox: 0, oy: 0.4, oz: 0, radius: 1.0,
        speedMin: 1.0, speedMax: 2.8, vyMin: 0.6, vyMax: 2.0, size: 1.55
      });
      addParticles(22, {
        kind: 'spark', additive: true, color: '#38bdf8',
        ox: localImpactFloor.x, oy: localImpactFloor.y + 0.5, oz: localImpactFloor.z, radius: 1.2,
        speedMin: 2.5, speedMax: 6.8, vyMin: 2.5, vyMax: 6.5, gravity: -8.5, size: 0.38
      });
      addParticles(12, {
        kind: 'hex', additive: false, color: '#0284c7',
        ox: localImpactFloor.x, oy: localImpactFloor.y + 0.4, oz: localImpactFloor.z, radius: 1.5,
        speedMin: 1.8, speedMax: 4.5, vyMin: 2.0, vyMax: 5.5, gravity: -4.0, size: 0.40
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: CYBORG JETPACK FLY / AIR BOOST (Twin Wing Thrusters!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_mobility_jetpack') {
      duration = 0.48;

      addMesh(this.geo.plane, 'rail_shock_ring', '#09152b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 0.85 + ease * 2.15;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'rail_shock_ring', '#38bdf8', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.10, 0);
      }, (m, mat, t, ease) => {
        const s = 0.80 + ease * 2.05;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addThrusterPlume(-0.42, 1.05, -0.22, 1.8, 0.72, 0.25,  0.14, 0.0, 0.88);
      addThrusterPlume( 0.42, 1.05, -0.22, 1.8, 0.72, 0.25, -0.14, 0.0, 0.88);

      addParticles(10, {
        kind: 'spark', additive: true, color: '#fbbf24',
        ox: 0, oy: 0.75, oz: -0.2, radius: 0.45,
        speedMin: 1.0, speedMax: 2.8, vyMin: -1.8, vyMax: 0.5, gravity: -3.5, size: 0.30
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
        if (sp.implode) {
          const curAng = sp.swirlAngle + localT * sp.swirl;
          const curRad = sp.swirlRadius * (1.0 - easeOutCubic(st) * 0.85);
          px = Math.cos(curAng) * curRad;
          pz = Math.sin(curAng) * curRad;
        } else {
          px = sp.ox + sp.vx * localT;
          pz = sp.oz + sp.vz * localT;
        }
        const py = Math.max(0.08, sp.oy + sp.vy * localT + 0.5 * sp.gravity * localT * localT);

        sp.mesh.position.set(px, py, pz);
        sp.mesh.quaternion.copy(this.camera.quaternion).premultiply(invRootQ);

        if (sp.kind === 'smoke') {
          const sc = sp.baseSz * (0.72 + st * 1.15);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.16 ? st / 0.16 : 1 - (st - 0.16) / 0.84) * sp.alphaPeak);
        } else if (sp.kind === 'hex') {
          const sc = sp.baseSz * (1.0 - st * 0.52);
          sp.mesh.scale.set(sc, sc, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((st < 0.12 ? st / 0.12 : 1 - (st - 0.12) / 0.88) * sp.alphaPeak);
        } else {
          const sc = sp.baseSz * (1.1 - st * 0.65);
          sp.mesh.scale.set(sc * 0.45, sc * 1.6, 1);
          sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
          sp.mat.opacity = clamp01((1 - st) * 1.18);
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
