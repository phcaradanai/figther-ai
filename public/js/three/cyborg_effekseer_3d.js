// ============================================================================
// LOST SAGA 3D - CYBORG (TOS RANK 9 MUSKETEER x CYBER-PLASMA) 3D VFX SUITE
// ============================================================================
// Dedicated 7-move Cyborg 3D VFX suite redesigned from Tree of Savior's
// Rank 9 Musketeer (_ssPpuHq_lg) fused with sci-fi Cyborg plasma energy so
// it is 100% visually distinct from Dual-Gun Cowboy:
//   - Grooving Muzzle white-core electric violet-cyan starburst bursts
//   - Penetration Shot roaring amber-crimson/cyan conical energy blasts
//   - Birdfall / Prime & Load swirling cerulean-violet energy arc ribbons
//   - Dual-tone cerulean-blue ground waves rimmed with fiery amber-orange
//   - Snipe vertical electric violet-cyan energy-shatter pillars
//   - Geodesic hex-grid EMP gravity dome & 9.5m Buster plasma cannon beam
// ============================================================================
import * as THREE from 'three';

const CYBORG_TEX_NAMES = [
  'grooving_starburst',
  'penetration_cone',
  'buster_beam_core',
  'hex_emp_grid',
  'cerulean_wave_ring',
  'snipe_shatter_pillar',
  'jet_thruster_plume',
  'plasma_arc_bolt',
  'overdrive_spark'
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

    // Helper: 3D Crossed Vertical Energy-Shatter Column (Musketeer Snipe 2:05!)
    const addShatterSpire = (ox, baseY, oz, width, height, delay = 0, life = 0.75) => {
      const spireGroup = new THREE.Group();
      spireGroup.position.set(ox, baseY, oz);
      root.add(spireGroup);

      const mats = [];
      for (let p = 0; p < 3; p++) {
        const ang = (p / 3) * Math.PI;
        const darkMat = this.makeMat('snipe_shatter_pillar', '#1e1b4b', 1.0, 0.92, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.y = ang;
        darkM.position.y = 0.5;
        darkM.scale.set(1.08, 1.04, 1);
        darkM.renderOrder = 17;
        spireGroup.add(darkM);

        const glowMat = this.makeMat('snipe_shatter_pillar', p === 0 ? '#ffffff' : '#a78bfa', 2.6, 0.96, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.rotation.y = ang;
        glowM.position.y = 0.52;
        glowM.renderOrder = 19;
        spireGroup.add(glowM);

        mats.push(darkMat, glowMat);
      }

      parts.push({
        mesh: spireGroup,
        mat: mats[0],
        extraMats: mats.slice(1),
        update: (g, _m, t) => {
          const lt = (t - delay) / life;
          if (lt <= 0 || lt >= 1) { g.visible = false; return; }
          g.visible = true;
          const rise = easeOutCubic(clamp01(lt / 0.16));
          const fade = lt > 0.65 ? clamp01(1 - (lt - 0.65) / 0.35) : 1.0;
          g.scale.set(width * (0.55 + 0.55 * rise), Math.max(0.08, height * rise), width * (0.55 + 0.55 * rise));
          g.rotation.y = lt * 2.2;
          for (let k = 0; k < mats.length; k++) {
            mats[k].opacity = (k % 2 === 0 ? 0.88 : 0.96) * fade;
          }
        }
      });
    };

    // Helper: 3D X-Crossed Penetration Shot Conical Plasma Blast (Musketeer 1:25!)
    // Originates at (ox, oy, oz) and blasts forward along local +Z (optionally angled by rotY)
    const addBlastCone = (cfg) => {
      const coneGroup = new THREE.Group();
      coneGroup.position.set(cfg.ox || 0, cfg.oy !== undefined ? cfg.oy : 1.04, cfg.oz || 0.9);
      if (cfg.rotY) coneGroup.rotation.y = cfg.rotY;
      root.add(coneGroup);

      const mats = [];
      // Horizontal + Vertical crossed planes so the roaring plasma cone reads 3D from every angle
      const setups = [
        { rx: -Math.PI * 0.5, ry: 0, rz: -Math.PI * 0.5, hex: cfg.hexA || '#f97316' },
        { rx: 0, ry: Math.PI * 0.5, rz: 0, hex: cfg.hexB || '#38bdf8' }
      ];
      for (const s of setups) {
        const darkMat = this.makeMat('penetration_cone', cfg.darkHex || '#2a0a18', 1.0, 0.92, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.set(s.rx, s.ry, s.rz);
        darkM.position.z = 0.5;
        darkM.scale.set(1.04, 1.12, 1);
        darkM.renderOrder = 17;
        coneGroup.add(darkM);

        const glowMat = this.makeMat('penetration_cone', s.hex, cfg.intensity || 2.7, 0.98, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.rotation.set(s.rx, s.ry, s.rz);
        glowM.position.z = 0.51;
        glowM.renderOrder = 19;
        coneGroup.add(glowM);

        mats.push(darkMat, glowMat);
      }

      const delay = cfg.delay || 0;
      const life = cfg.life || 0.55;
      const len = cfg.length || 4.4;
      const wid = cfg.width || 2.8;

      parts.push({
        mesh: coneGroup,
        mat: mats[0],
        extraMats: mats.slice(1),
        update: (g, _m, t) => {
          const lt = (t - delay) / life;
          if (lt <= 0 || lt >= 1) { g.visible = false; return; }
          g.visible = true;
          const e = easeOutCubic(lt);
          const curL = len * (0.35 + 0.72 * e);
          const curW = wid * (0.45 + 0.65 * e) * (1 - lt * 0.35);
          g.scale.set(curW, curW, curL);
          const fade = clamp01(1 - lt * 1.1);
          for (let k = 0; k < mats.length; k++) {
            mats[k].opacity = (k % 2 === 0 ? 0.88 : 0.98) * fade;
          }
        }
      });
    };

    // Helper: Twin Wing-Pack Afterburner Plumes
    const addThrusterPlume = (ox, oy, oz, length, width, tiltX = 0.22, tiltZ = 0.0, delay = 0, life = 0.85) => {
      const nozzle = new THREE.Group();
      nozzle.position.set(ox, oy, oz);
      nozzle.rotation.set(tiltX, 0, tiltZ);
      root.add(nozzle);

      const mats = [];
      for (let p = 0; p < 2; p++) {
        const ang = p * Math.PI * 0.5;
        const darkMat = this.makeMat('jet_thruster_plume', '#2a0d16', 1.0, 0.88, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.y = ang;
        darkM.position.y = -0.48;
        darkM.scale.set(1.12, 1.04, 1);
        darkM.renderOrder = 17;
        nozzle.add(darkM);

        const glowMat = this.makeMat('jet_thruster_plume', p === 0 ? '#f97316' : '#818cf8', 2.6, 0.96, true);
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

    const addSparks = (count, cfg) => {
      for (let i = 0; i < count; i++) {
        const mat = this.makeMat(cfg.tex || 'overdrive_spark', cfg.color || '#fbbf24', cfg.intensity || 2.5, 1.0, cfg.additive !== false);
        const mesh = new THREE.Mesh(this.geo.plane, mat);
        mesh.renderOrder = cfg.additive === false ? 18 : 20;

        const ang = Math.random() * Math.PI * 2;
        const rad = (cfg.radiusMin || 0) + Math.random() * ((cfg.radius || 0.7) - (cfg.radiusMin || 0));
        const spd = (cfg.speedMin !== undefined ? cfg.speedMin : 1.4) + Math.random() * (cfg.speedMax !== undefined ? cfg.speedMax : 4.2);
        const vx = Math.cos(ang) * spd;
        const vz = Math.sin(ang) * spd + (cfg.forwardBias || 0);
        const vy = (cfg.vyMin !== undefined ? cfg.vyMin : 0.6) + Math.random() * (cfg.vyMax !== undefined ? cfg.vyMax : 2.8);
        const ox = Math.cos(ang) * rad + (cfg.ox || 0);
        const oy = (cfg.oy !== undefined ? cfg.oy : 0.9) + (Math.random() - 0.5) * (cfg.oySpread || 0.5);
        const oz = Math.sin(ang) * rad + (cfg.oz || 0) + (Math.random() - 0.5) * (cfg.ozSpread || 0);
        mesh.position.set(ox, oy, oz);
        const sz = (cfg.size || 0.34) * (0.75 + Math.random() * 0.65);
        root.add(mesh);

        particles.push({
          mesh, mat, ox, oy, oz, vx, vy, vz,
          gravity: cfg.gravity !== undefined ? cfg.gravity : -6.0,
          delay: (cfg.baseDelay || 0) + Math.random() * (cfg.maxDelay || 0.10),
          baseSz: sz,
          implode: !!cfg.implode,
          swirl: cfg.swirl || 0,
          swirlRadius: rad,
          swirlAngle: ang,
          rotSpeed: (Math.random() - 0.5) * 9.0,
          rotInit: Math.random() * Math.PI * 2,
          alphaPeak: cfg.alphaPeak !== undefined ? cfg.alphaPeak : 0.98
        });
      }
    };

    // ------------------------------------------------------------------------
    // 1. BASIC ATTACK: GROOVING MUZZLE ELECTRIC STARBURST + CONICAL PLASMA BLAST
    //    (100% Energy Gunfire — ZERO sword-like slash crescents!)
    // ------------------------------------------------------------------------
    if (effectId === 'cyborg_basic_plasma') {
      duration = opts.isFinisher ? 0.50 : 0.34;
      const spinDir = (opts.comboStep % 2 === 0) ? -1 : 1;

      // Ground Icy-Cerulean Caster Ring beneath Cyborg's boots (Musketeer 1:21!)
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#1e1b4b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.0 + ease * (opts.isFinisher ? 2.2 : 1.4);
        m.scale.set(s, s, 1);
        m.rotation.z = spinDir * t * 3.5;
        mat.opacity = clamp01(1 - t) * 0.78;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.1, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.03, 0);
      }, (m, mat, t, ease) => {
        const s = 0.95 + ease * (opts.isFinisher ? 2.1 : 1.35);
        m.scale.set(s, s, 1);
        m.rotation.z = spinDir * t * 3.5;
        mat.opacity = clamp01(1 - t) * 0.90;
      });

      // Iconic Grooving Muzzle Electric White-Violet-Cyan Spiky Starburst at Cannon Tip!
      addMesh(this.geo.plane, 'grooving_starburst', '#1e1b4b', 1.0, (m) => {
        m.position.set(0, 1.04, 0.96);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(spinDir * t * 4.5);
        const s = (opts.isFinisher ? 1.65 : 1.10) + ease * (opts.isFinisher ? 2.1 : 1.35);
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 2.9, (m) => {
        m.position.set(0, 1.05, 1.00);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(spinDir * t * 4.5);
        const s = (opts.isFinisher ? 1.55 : 1.02) + ease * (opts.isFinisher ? 1.95 : 1.28);
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.35);
      });

      // Directional Conical Plasma Muzzle Blast (compact cyan-violet on hits 1-2, roaring amber-violet on finisher!)
      addBlastCone({
        ox: 0, oy: 1.04, oz: 0.92,
        length: opts.isFinisher ? 3.0 : 1.45,
        width: opts.isFinisher ? 1.95 : 1.05,
        life: opts.isFinisher ? 0.72 : 0.62,
        hexA: opts.isFinisher ? '#fb923c' : '#38bdf8',
        hexB: '#a78bfa',
        darkHex: '#1e1b4b',
        intensity: opts.isFinisher ? 2.8 : 2.5
      });

      // Warm Amber-Gold & Electric-Violet Grooving Muzzle Radial Spark Streaks (3:25!)
      addSparks(opts.isFinisher ? 12 : 7, {
        color: '#fbbf24', ox: 0, oy: 1.04, oz: 1.04, radius: 0.28,
        forwardBias: 3.4, speedMin: 1.4, speedMax: 4.2, vyMin: 0.4, vyMax: 2.2, size: 0.34
      });
      addSparks(opts.isFinisher ? 8 : 4, {
        color: '#a78bfa', ox: 0, oy: 1.04, oz: 1.04, radius: 0.30,
        forwardBias: 2.4, speedMin: 1.0, speedMax: 3.2, vyMin: 0.3, vyMax: 1.8, size: 0.30
      });
    }

    // ------------------------------------------------------------------------
    // 2. HEAVY ATTACK: PENETRATION SHOT CONICAL ENERGY BLAST + LIGHTNING RECOIL!
    //    (ToS Musketeer 1:21–1:25 — Wide Roaring Plasma Cone, ZERO slashes!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_heavy_laser') {
      duration = 0.72;

      // Dual-Tone Cerulean-Orange Ground Lock Wave beneath Cyborg's boots (Musketeer 1:21 & 2:35!)
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#1e1b4b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.4 + ease * 3.4;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.0;
        mat.opacity = clamp01(1 - t * 1.05) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.3, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.3 + ease * 3.3;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.0;
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // WIDE ROARING 4.8m PENETRATION SHOT CONICAL PLASMA BLAST (Amber-Crimson + Electric Cyan/Violet!)
      addBlastCone({
        ox: 0, oy: 1.06, oz: 0.95, length: 4.8, width: 3.1,
        life: 0.78, hexA: '#f97316', hexB: '#38bdf8', darkHex: '#24091c', intensity: 2.85
      });

      // Blinding Grooving Muzzle Electric White-Violet Starburst Explosion at Barrel!
      addMesh(this.geo.plane, 'grooving_starburst', '#1e1b4b', 1.0, (m) => {
        m.position.set(0, 1.06, 1.12);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(-t * 5.2);
        const s = 1.6 + ease * 2.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.35) * 0.92;
      }, false);
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.08, 1.16);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(-t * 5.2);
        const s = 1.5 + ease * 2.65;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.45);
      });

      // Crackling High-Voltage Violet-Cyan Recoil Lightning Bolts
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -0.55 : 0.55;
        addMesh(this.geo.plane, 'plasma_arc_bolt', '#a78bfa', 2.7, (m) => {
          m.position.set(side, 1.08, 2.1);
          m.rotation.set(0, Math.PI * 0.5, Math.PI * 0.5 + side * 0.35);
        }, (m, mat, t) => {
          const s = 1.0 + t * 1.2;
          m.scale.set(s * 0.85, s * 2.3, 1);
          mat.opacity = clamp01(1 - t * 1.5) * (0.55 + 0.45 * Math.abs(Math.sin(t * 58 + i * 2)));
        });
      }

      addSparks(16, {
        color: '#fbbf24', ox: 0, oy: 1.06, oz: 1.8, radius: 0.6, ozSpread: 2.2,
        forwardBias: 6.2, speedMin: 1.8, speedMax: 5.0, vyMin: 0.4, vyMax: 2.6, size: 0.38
      });
      addSparks(12, {
        color: '#a78bfa', ox: 0, oy: 1.06, oz: 1.6, radius: 0.6, ozSpread: 2.0,
        forwardBias: 4.5, speedMin: 1.5, speedMax: 4.2, vyMin: 0.4, vyMax: 2.4, size: 0.34
      });
    }

    // ------------------------------------------------------------------------
    // 3. [Q/SD] WEAPON SKILL: BUSTER BEAM (9.5m Plasma Cannon + Warm Cone + Snipe Shatter!)
    //    (Matches server.js hitLine(player, 9.5, 2.6)!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_weapon') {
      duration = 1.28;

      // Dual-Tone Cerulean-Orange Caster Shockwave Ring beneath Cyborg (Musketeer 2:35!)
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#1e1b4b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 4.0;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.7 + ease * 3.85;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t);
      });

      // Blinding Grooving Muzzle Discharge Starburst right at Buster Cannon Mouth!
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.08, 0.96);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 6.0);
        const s = 1.8 + ease * 2.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.35);
      });

      // Roaring Amber-Gold Penetration Shot Muzzle Blast Cone at Cannon Mouth (Warm-vs-Cool Contrast!)
      addBlastCone({
        ox: 0, oy: 1.08, oz: 0.90, length: 4.2, width: 3.2,
        life: 0.76, hexA: '#f97316', hexB: '#fbbf24', darkHex: '#2a0c08', intensity: 2.75
      });

      // COLOSSAL 9.5m 3D HORIZONTAL BUSTER PLASMA BEAM (Crossed H+V + Rotating Hex Tube!)
      const beamLen = 9.6;
      const beamCenterZ = 0.95 + beamLen * 0.5;

      addMesh(this.geo.plane, 'buster_beam_core', '#0f1035', 1.0, (m) => {
        m.rotation.set(-Math.PI * 0.5, 0, -Math.PI * 0.5);
        m.position.set(0, 1.02, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.12));
        const pulse = 0.92 + 0.12 * Math.sin(t * 58);
        const taper = t > 0.65 ? clamp01(1 - (t - 0.65) / 0.35) : 1.0;
        const curLen = beamLen * extend;
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(curLen, 3.45 * pulse * (0.35 + 0.65 * taper), 1);
        mat.opacity = 0.94 * taper;
      }, false);

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

      addMesh(this.geo.plane, 'buster_beam_core', '#e0f7ff', 3.0, (m) => {
        m.rotation.set(0, Math.PI * 0.5, 0);
        m.position.set(0, 1.08, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.12));
        const pulse = 0.90 + 0.16 * Math.cos(t * 56);
        const taper = t > 0.65 ? clamp01(1 - (t - 0.65) / 0.35) : 1.0;
        const curLen = beamLen * extend;
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(curLen, 2.60 * pulse * (0.25 + 0.75 * taper), 1);
        mat.opacity = taper;
      });

      // 3D Rotating Electric-Violet Hex-Grid Plasma Containment Sleeve wrapping the 9.5m Beam!
      addMesh(this.geo.beamTube, 'hex_emp_grid', '#818cf8', 2.4, (m) => {
        m.rotation.x = Math.PI * 0.5;
        m.position.set(0, 1.08, beamCenterZ);
      }, (m, mat, t) => {
        const extend = easeOutCubic(clamp01(t / 0.14));
        const taper = t > 0.62 ? clamp01(1 - (t - 0.62) / 0.38) : 1.0;
        const curLen = beamLen * extend;
        const rad = (1.18 + 0.14 * Math.sin(t * 42)) * (0.4 + 0.6 * taper);
        m.position.z = 0.95 + curLen * 0.5;
        m.scale.set(rad, curLen, rad);
        m.rotation.z = t * 9.5;
        mat.opacity = 0.84 * taper;
      });

      // 4 Crackling High-Voltage Violet-Cyan Lightning Arcs dancing along the Beam!
      for (let i = 0; i < 4; i++) {
        const az = 2.4 + i * 2.0;
        addMesh(this.geo.plane, 'plasma_arc_bolt', i % 2 === 0 ? '#a78bfa' : '#e0f7ff', 2.8, (m) => {
          m.position.set((i % 2 === 0 ? -0.68 : 0.68), 1.12, az);
        }, (m, mat, t) => {
          const taper = t > 0.68 ? clamp01(1 - (t - 0.68) / 0.32) : 1.0;
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(Math.PI * 0.5 + Math.sin(t * 32 + i * 1.9) * 0.6);
          const s = 1.4 + 0.35 * Math.sin(t * 44 + i);
          m.scale.set(s * 0.85, s * 2.3, 1);
          mat.opacity = taper * (0.55 + 0.45 * Math.abs(Math.sin(t * 50 + i * 2.1)));
        });
      }

      // Musketeer Snipe (2:05) Tall Vertical Energy-Shatter Column + Grooving Starburst at z = 9.5m!
      addShatterSpire(0, gyOffset, 9.5, 2.8, 5.2, 0.08, 0.85);
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.35, 9.5);
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.08) / 0.68);
        if (t < 0.08) { mat.opacity = 0; return; }
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(lt * 3.5);
        const s = 2.2 + easeOutCubic(lt) * 4.8;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.5, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 9.5);
      }, (m, mat, t) => {
        const lt = clamp01((t - 0.08) / 0.76);
        if (t < 0.08) { mat.opacity = 0; return; }
        const s = 1.4 + easeOutCubic(lt) * 5.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - lt);
      });

      addSparks(26, {
        color: '#fbbf24', ox: 0, oy: 1.05, oz: 5.2, radius: 1.1, ozSpread: 8.4,
        forwardBias: 3.5, speedMin: 2.0, speedMax: 5.8, vyMin: 1.4, vyMax: 5.2, gravity: -6.0, maxDelay: 0.25, size: 0.40
      });
      addSparks(18, {
        color: '#a78bfa', ox: 0, oy: 1.1, oz: 5.2, radius: 1.2, ozSpread: 8.2,
        speedMin: 1.6, speedMax: 4.6, vyMin: 1.6, vyMax: 5.0, gravity: -3.5, maxDelay: 0.25, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 4. [E/ASD] ARMOR SKILL: EMP GRAVITY FIELD (9.6m Dual-Tone Wave + Hex Dome + Ribbons!)
    //    (Musketeer 2:35 Cerulean-Orange Wave + Prime & Load Swirling Arcs + Geodesic EMP Dome!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_armor') {
      duration = 1.38;

      // Giant 9.8m Dual-Tone Cerulean-Blue / Fiery-Orange Rim Ground Wave (Musketeer 2:35!)
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#121236', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t, ease) => {
        const s = 2.4 + ease * 7.6;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 3.8;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.45, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 2.3 + ease * 7.5;
        m.scale.set(s, s, 1);
        m.rotation.z = -t * 3.8;
        const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
        mat.opacity = clamp01(fade) * (0.88 + 0.12 * Math.sin(t * 34));
      });

      // TRUE 3D GEODESIC VIOLET-CYAN HEX-GRID EMP GRAVITY DOME (4.8m -> Implodes Inward!)
      addMesh(this.geo.empDome, 'hex_emp_grid', '#131138', 1.0, (m) => {
        m.position.set(0, gyOffset, 0);
      }, (m, mat, t) => {
        const pop = t < 0.16 ? easeOutCubic(t / 0.16) : 1.0;
        const pull = t > 0.30 ? (1 - 0.24 * easeOutCubic((t - 0.30) / 0.70)) : 1.0;
        const r = 4.8 * pop * pull;
        m.scale.set(r, r * 0.84, r);
        m.rotation.y = t * 2.6;
        const fade = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1.0;
        mat.opacity = 0.62 * clamp01(fade);
      }, false);
      addMesh(this.geo.empDome, 'hex_emp_grid', '#818cf8', 2.35, (m) => {
        m.position.set(0, gyOffset + 0.02, 0);
      }, (m, mat, t) => {
        const pop = t < 0.16 ? easeOutCubic(t / 0.16) : 1.0;
        const pull = t > 0.30 ? (1 - 0.24 * easeOutCubic((t - 0.30) / 0.70)) : 1.0;
        const r = 4.72 * pop * pull;
        m.scale.set(r, r * 0.82, r);
        m.rotation.y = -t * 3.6;
        const fade = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1.0;
        mat.opacity = (0.76 + 0.18 * Math.sin(t * 42)) * clamp01(fade);
      });

      // 2 Reverse-Imploding Full-Circle Gravity Pull Waves contracting 9.6m -> 1.4m (0% slash arc!)
      for (let i = 0; i < 2; i++) {
        const delay = i * 0.24;
        addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.55, (m) => {
          m.rotation.x = -Math.PI * 0.5;
          m.position.set(0, gyOffset + 0.10 + i * 0.22, 0);
        }, (m, mat, t) => {
          const lt = (t - delay) / 0.66;
          if (lt <= 0 || lt >= 1) { mat.opacity = 0; return; }
          const s = 9.6 - easeOutCubic(lt) * 8.2; // Visibly pulls enemies inward!
          m.rotation.z = (i % 2 === 0 ? 1 : -1) * lt * 5.0;
          m.scale.set(s, s, 1);
          mat.opacity = clamp01(Math.sin(lt * Math.PI));
        });
      }

      // 6 Crackling 3D High-Voltage Violet-Cyan EMP Lightning Arcs inside the Dome!
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const rad = 2.6;
        addMesh(this.geo.plane, 'plasma_arc_bolt', i % 2 === 0 ? '#ffffff' : '#a78bfa', 2.8, (m) => {
          m.position.set(Math.cos(ang) * rad, 1.55, Math.sin(ang) * rad);
        }, (m, mat, t) => {
          const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1.0;
          const pullR = rad * (1 - t * 0.45);
          const spinA = ang + t * 2.8;
          m.position.set(Math.cos(spinA) * pullR, 1.45 + Math.sin(t * 24 + i) * 0.35, Math.sin(spinA) * pullR);
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(Math.sin(t * 28 + i * 2) * 0.8);
          m.scale.set(1.4, 3.2, 1);
          mat.opacity = clamp01(fade) * (0.45 + 0.55 * Math.abs(Math.sin(t * 54 + i * 1.7)));
        });
      }

      // Center Grooving Muzzle Electric White-Violet Burst Core!
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 3.0, (m) => {
        m.position.set(0, 1.15, 0);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 4.5);
        const s = 1.8 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.65);
      });

      // Inward-Spiraling Amber & Violet-Cyan Plasma Sparks!
      addSparks(22, {
        color: '#67e8f9', radiusMin: 2.0, radius: 4.8, oy: 1.1, oySpread: 1.4,
        implode: true, swirl: 5.8, vyMin: 0.2, vyMax: 1.0, gravity: 0, maxDelay: 0.25, size: 0.42
      });
      addSparks(16, {
        color: '#fb923c', radiusMin: 1.6, radius: 4.6, oy: 1.2, oySpread: 1.2,
        implode: true, swirl: -6.5, vyMin: 0.3, vyMax: 1.2, gravity: 0, maxDelay: 0.25, size: 0.38
      });
    }

    // ------------------------------------------------------------------------
    // 5. [R/AD] HELMET SKILL: HOMING MISSILES (Musketeer Covering Fire Fan Cones + Birdfall Sweep!)
    //    (0% Cowboy smoke/crosshair — 3 roaring amber-crimson energy launch cones + sweeping arc!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_helmet') {
      duration = 0.90;

      // 3 Fanning Fiery Amber-Orange Covering Fire Launch Cones matching the 3 real 3D homing missiles!
      const podAngles = [-0.35, 0.0, 0.35];
      for (let i = 0; i < 3; i++) {
        const ang = podAngles[i];
        addBlastCone({
          ox: Math.sin(-ang) * 0.75, oy: 1.42 + (i === 1 ? 0.14 : 0), oz: 0.72,
          rotY: -ang, length: 3.1, width: 1.75, delay: i * 0.045, life: 0.62,
          hexA: '#f97316', hexB: '#fde047', darkHex: '#2e0b05', intensity: 2.8
        });
      }

      // Grooving Muzzle Warm-Gold & White Salvo Ignition Starburst
      addMesh(this.geo.plane, 'grooving_starburst', '#fde047', 2.9, (m) => {
        m.position.set(0, 1.45, 0.95);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(t * 5.0);
        const s = 1.3 + ease * 2.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.5);
      });

      // Twin Wing Backblast Afterburner Plumes + Ground Dual-Tone Launch Wave
      addThrusterPlume(-0.55, 1.38, -0.25, 2.0, 0.85, Math.PI * 0.55,  0.18, 0.0, 0.55);
      addThrusterPlume( 0.55, 1.38, -0.25, 2.0, 0.85, Math.PI * 0.55, -0.18, 0.0, 0.55);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.2, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.05, 0.15);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 3.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25);
      });

      addSparks(20, {
        color: '#fbbf24', ox: 0, oy: 1.42, oz: 0.85, radius: 0.75,
        forwardBias: 4.5, speedMin: 1.8, speedMax: 5.2, vyMin: 0.8, vyMax: 3.6, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 6. [F/AS] TRINKET SKILL: FLIGHT ASSAULT (Jetpack Lift + Diagonal Beam + Snipe Shatter Spire!)
    //    (Exact point-to-point laser -> Musketeer 2:05 Snipe Vertical Shatter Spire at (tx, ty, tz)!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_trinket') {
      duration = 1.20;

      const worldTx = opts.tx !== undefined ? opts.tx : (x + Math.cos(facing) * 5.0);
      const worldTz = opts.tz !== undefined ? opts.tz : (z + Math.sin(facing) * 5.0);
      const targetGroundY = this.groundY(worldTx, opts.ty !== undefined ? opts.ty : y, worldTz);
      const worldTy = opts.ty !== undefined ? opts.ty : (targetGroundY + 0.4);

      const invQ = root.quaternion.clone().invert();
      const localTarget = new THREE.Vector3(worldTx - x, worldTy - y, worldTz - z).applyQuaternion(invQ);
      const localImpactFloor = new THREE.Vector3(worldTx - x, targetGroundY - y + 0.05, worldTz - z).applyQuaternion(invQ);
      const startPt = new THREE.Vector3(0, 3.2, 0);

      // 1) Takeoff Dual-Tone Cerulean-Orange Wave + Twin Wing Afterburners!
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#1e1b4b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.04, 0);
      }, (m, mat, t, ease) => {
        const s = 1.2 + ease * 4.4;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.2) * 0.90;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, gyOffset + 0.08, 0);
      }, (m, mat, t, ease) => {
        const s = 1.1 + ease * 4.2;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.25);
      });

      addThrusterPlume(-0.55, 2.75, -0.22, 3.1, 1.05, 0.08,  0.14, 0.0, 0.78);
      addThrusterPlume( 0.55, 2.75, -0.22, 3.1, 1.05, 0.08, -0.14, 0.0, 0.78);

      // 2) EXACT POINT-TO-POINT DIAGONAL AERIAL CYAN-VIOLET PLASMA LASER BEAM!
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
        const darkMat = this.makeMat('buster_beam_core', '#131138', 1.0, 0.92, false);
        const darkM = new THREE.Mesh(this.geo.plane, darkMat);
        darkM.rotation.set(0, rotY, Math.PI * 0.5);
        darkM.scale.set(1.0, 1.48, 1.0);
        darkM.renderOrder = 17;
        beamGroup.add(darkM);

        const glowMat = this.makeMat('buster_beam_core', p === 0 ? '#38bdf8' : '#e0f7ff', 2.9, 0.98, true);
        const glowM = new THREE.Mesh(this.geo.plane, glowMat);
        glowM.rotation.set(0, rotY, Math.PI * 0.5);
        glowM.scale.set(1.0, 1.28, 1.0);
        glowM.renderOrder = 19;
        beamGroup.add(glowM);

        beamMats.push(darkMat, glowMat);
      }
      const tubeMat = this.makeMat('hex_emp_grid', '#818cf8', 2.35, 0.82, true);
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
          g.scale.set(1.30 * widthScale * pulse, beamDist, 1.30 * widthScale * pulse);
          tubeMesh.rotation.y = lt * 12.0;
          const fade = clamp01(lt > 0.55 ? 1 - (lt - 0.55) / 0.45 : 1.0);
          for (let k = 0; k < beamMats.length; k++) {
            beamMats[k].opacity = (k === beamMats.length - 1 ? 0.76 : (k % 2 === 0 ? 0.88 : 0.98)) * fade;
          }
        }
      });

      // 3) MUSKETEER SNIPE (2:05) IMPACT DETONATION AT (tx, ty, tz) (Radius 3.6m -> 7.2m!)
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#121236', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.copy(localImpactFloor);
      }, (m, mat, t, ease) => {
        const s = 1.8 + ease * 5.8;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t * 1.05) * 0.94;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.6, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(localImpactFloor.x, localImpactFloor.y + 0.04, localImpactFloor.z);
      }, (m, mat, t, ease) => {
        const s = 1.7 + ease * 5.6;
        m.scale.set(s, s, 1);
        m.rotation.z = t * 4.5;
        mat.opacity = clamp01(1 - t * 1.1);
      });

      // Tall Vertical 3D Energy-Shatter Column bursting out of the Target Ground Crater!
      addShatterSpire(localImpactFloor.x, localImpactFloor.y, localImpactFloor.z, 3.0, 5.4, 0.02, 0.86);

      // Blinding Grooving Muzzle Impact Starburst Nova!
      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 3.0, (m) => {
        m.position.set(localImpactFloor.x, localImpactFloor.y + 0.75, localImpactFloor.z);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        m.rotateZ(-t * 4.2);
        const s = 2.0 + ease * 4.6;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.45);
      });

      // 3 Crackling Electric Impact Lightning Arcs
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        addMesh(this.geo.plane, 'plasma_arc_bolt', '#a78bfa', 2.8, (m) => {
          m.position.set(localImpactFloor.x + Math.cos(ang) * 1.3, localImpactFloor.y + 1.2, localImpactFloor.z + Math.sin(ang) * 1.3);
        }, (m, mat, t) => {
          m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
          m.rotateZ(ang + t * 3.0);
          m.scale.set(1.2, 2.6, 1);
          mat.opacity = clamp01(1 - t * 1.4) * (0.5 + 0.5 * Math.abs(Math.sin(t * 48 + i)));
        });
      }

      addSparks(22, {
        color: '#fbbf24', ox: localImpactFloor.x, oy: localImpactFloor.y + 0.5, oz: localImpactFloor.z, radius: 1.3,
        speedMin: 2.5, speedMax: 7.0, vyMin: 2.8, vyMax: 6.8, gravity: -8.5, size: 0.40
      });
      addSparks(14, {
        color: '#a78bfa', ox: localImpactFloor.x, oy: localImpactFloor.y + 0.5, oz: localImpactFloor.z, radius: 1.4,
        speedMin: 2.0, speedMax: 5.5, vyMin: 2.2, vyMax: 5.8, gravity: -5.0, size: 0.36
      });
    }

    // ------------------------------------------------------------------------
    // 7. MOBILITY: RECOIL WING JETPACK BOOST (Air Jump / Dash — 0% slash!)
    // ------------------------------------------------------------------------
    else if (effectId === 'cyborg_mobility_jetpack') {
      duration = 0.48;

      addMesh(this.geo.plane, 'cerulean_wave_ring', '#1e1b4b', 1.0, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.06, 0);
      }, (m, mat, t, ease) => {
        const s = 0.9 + ease * 2.0;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t) * 0.88;
      }, false);
      addMesh(this.geo.plane, 'cerulean_wave_ring', '#ffffff', 2.4, (m) => {
        m.rotation.x = -Math.PI * 0.5;
        m.position.set(0, 0.10, 0);
      }, (m, mat, t, ease) => {
        const s = 0.85 + ease * 1.9;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t);
      });

      addMesh(this.geo.plane, 'grooving_starburst', '#ffffff', 2.6, (m) => {
        m.position.set(0, 0.85, -0.15);
      }, (m, mat, t, ease) => {
        m.quaternion.copy(this.camera.quaternion).premultiply(root.quaternion.clone().invert());
        const s = 0.85 + ease * 1.65;
        m.scale.set(s, s, 1);
        mat.opacity = clamp01(1 - t * 1.4);
      });

      addThrusterPlume(-0.42, 1.05, -0.22, 1.85, 0.72, 0.25,  0.14, 0.0, 0.88);
      addThrusterPlume( 0.42, 1.05, -0.22, 1.85, 0.72, 0.25, -0.14, 0.0, 0.88);

      addSparks(10, {
        color: '#fbbf24', ox: 0, oy: 0.75, oz: -0.2, radius: 0.45,
        speedMin: 1.0, speedMax: 2.8, vyMin: -1.6, vyMax: 0.6, gravity: -3.5, size: 0.32
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

        const sc = sp.baseSz * (1.1 - st * 0.65);
        sp.mesh.scale.set(sc * 0.44, sc * 1.65, 1);
        sp.mesh.rotateZ(sp.rotInit + localT * sp.rotSpeed);
        sp.mat.opacity = clamp01((1 - st) * 1.18 * sp.alphaPeak);
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
