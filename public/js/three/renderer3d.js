// ============================================================================
// Three.js arena renderer with a fixed high-angle camera, toon characters,
// painterly platforms, and a canvas overlay for nameplates and damage numbers.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Stage } from './stage.js';
import { ChibiView, buildGearItem } from './chibi.js';
import { FxSystem } from './fx.js';
import { KnightThreeVFX } from './knight_effekseer_3d.js';
import { NinjaThreeVFX } from './ninja_effekseer_3d.js';
import { MageThreeVFX } from './mage_effekseer_3d.js';
import { CowboyThreeVFX } from './cowboy_effekseer_3d.js';
import { SamuraiThreeVFX } from './samurai_effekseer_3d.js';
import { WitchThreeVFX } from './witch_effekseer_3d.js';
import { CyborgThreeVFX } from './cyborg_effekseer_3d.js';
import { VikingThreeVFX } from './viking_effekseer_3d.js';
import { StrikerThreeVFX } from './striker_effekseer_3d.js';
import { makeShadowTexture, makeMagicCircle } from './textures.js';

const COS45 = Math.SQRT1_2;
const CAM_PITCH = 0.64; // ~37 degrees down
const FOV = 30;

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.26 },
    uWarm: { value: 0.014 },
    uSat: { value: 1.03 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform float uWarm; uniform float uSat; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += vec3(uWarm, uWarm * 0.4, -uWarm * 0.6);
      vec2 d = vUv - 0.5;
      c.rgb *= clamp(1.0 - dot(d, d) * uVignette * 2.2, 0.0, 1.0);
      gl_FragColor = c;
    }`
};

function hdr(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k);
}

export class ThreeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.style.imageRendering = 'auto';
    const GAME_DATA = window.GAME_DATA;
    this.GAME_DATA = GAME_DATA;

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.5, 300);

    this.hemi = new THREE.HemisphereLight('#fff5e0', '#a7bfd9', 1.3);
    this.sun = new THREE.DirectionalLight('#fff0d4', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.fx = new FxSystem(this.scene);
    this.fx.ctx = {
      shake: (a) => this.addShake(a),
      floorY: (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    };

    // Dedicated Iron Knight, Shadow Ninja & Fire Archmage 3D EffekseerForWebGL + Three.js HDR-Bloom VFX Suites
    this.knightVfx = new KnightThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.ninjaVfx = new NinjaThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.mageVfx = new MageThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.cowboyVfx = new CowboyThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.samuraiVfx = new SamuraiThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.witchVfx = new WitchThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.cyborgVfx = new CyborgThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.vikingVfx = new VikingThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    this.strikerVfx = new StrikerThreeVFX(
      this.scene,
      this.camera,
      (a) => this.addShake(a),
      (x, z, y) => (this.stage ? this.stage.floorY(x, z, y) : 0)
    );
    if (window.KnightEffekseerVFX) {
      const efkCanvas = document.getElementById('effekseerCanvas');
      if (efkCanvas) window.KnightEffekseerVFX.attachGameCanvas(efkCanvas);
    }

    // Post-processing: render -> bloom -> tone map/sRGB -> warm grade + vignette
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.45, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GradeShader));

    // 2D overlay for nameplates, damage numbers and skill callouts
    this.overlay = document.createElement('canvas');
    Object.assign(this.overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '5' });
    canvas.insertAdjacentElement('afterend', this.overlay);
    this.octx = this.overlay.getContext('2d');

    this.shadowTex = makeShadowTexture();
    this.circleTex = makeMagicCircle();

    this.players = new Map();
    this.projectiles = new Map();
    this.gears = new Map();
    this.hazards = new Map();
    this.stage = null;
    this.camTarget = new THREE.Vector3();
    this.camDist = 30;
    this.shake = 0;
    this.time = 0;
    this.last = performance.now();
    this.lastProjList = null;
    this.projSnapTime = 0;
    this._v = new THREE.Vector3();

    this.setStage('sky_temple');
    this.resize();
    window.__threeRenderer = this; // dev handle for tuning from the console
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('wheel', (e) => {
      if (e.target !== this.canvas) return;
      this.camDist = Math.max(18, Math.min(44, this.camDist + Math.sign(e.deltaY) * 2));
    }, { passive: true });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.floor(w * dpr);
    this.overlay.height = Math.floor(h * dpr);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fx.setPixelScale((h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))));
  }

  addShake(amount) {
    this.shake = Math.min(1.4, Math.max(this.shake, amount * 0.07));
  }

  // Keep WASD aligned with the screen regardless of the camera's world angle.
  transformInputByCamera(ix, iz) {
    if (ix === 0 && iz === 0) return { mx: 0, mz: 0 };
    return { mx: (iz + ix) * COS45, mz: (iz - ix) * COS45 };
  }

  setStage(mapId) {
    const map = this.GAME_DATA.MAPS[mapId] || this.GAME_DATA.MAPS.sky_temple;
    if (this.stage?.map.id === map.id) return;
    if (this.stage) {
      this.stage.dispose();
      this.fx.clear();
      window.KnightEffekseerVFX?.stopAll();
    }
    this.stage = new Stage(map);
    this.scene.add(this.stage.group);
    this.stage.applyEnvironment(this.scene, this.hemi, this.sun);
    this.centerCameraOnNextFrame = true;
  }

  // ------------------------------------------------------------------ fx
  processServerFx(list) {
    for (const fx of list) {
      let shooter = null;
      let skipLegacyTwinGunMuzzle = false;
      if (fx.type === 'muzzle') {
        // Tag the shot with the shooter's style/clip so the FX can differ per hero
        const f = fx.facing || 0;
        shooter = this.nearestPlayer(fx.x - Math.cos(f) * 0.9, fx.y - 1.0, fx.z - Math.sin(f) * 0.9, 1.5);
        if (shooter) {
          fx._style = shooter.view.style;
          fx._clip = shooter.view.currentName;
          // Legacy barrel flash comes from ChibiView SHOTS, but still let CowboyThreeVFX run!
          if (shooter.view.style === 'twingun') skipLegacyTwinGunMuzzle = true;
        }
      }
      const handledByHeroVfx =
        !!(this.knightVfx && this.knightVfx.handleServerFx(fx)) ||
        !!(this.ninjaVfx && this.ninjaVfx.handleServerFx(fx)) ||
        !!(this.mageVfx && this.mageVfx.handleServerFx(fx)) ||
        !!(this.cowboyVfx && this.cowboyVfx.handleServerFx(fx)) ||
        !!(this.samuraiVfx && this.samuraiVfx.handleServerFx(fx)) ||
        !!(this.witchVfx && this.witchVfx.handleServerFx(fx)) ||
        !!(this.cyborgVfx && this.cyborgVfx.handleServerFx(fx)) ||
        !!(this.vikingVfx && this.vikingVfx.handleServerFx(fx)) ||
        !!(this.strikerVfx && this.strikerVfx.handleServerFx(fx));
      if (handledByHeroVfx) {
        // Preserve floating skill callouts & guard/parry status text on the 2D HUD overlay
        if (fx.type === 'skill_cast' && fx.skillNameTh) {
          this.fx.text(fx.x, fx.y + 0.9, fx.z, fx.skillNameTh, fx.color || '#fde68a', 'callout');
        } else if ((fx.type === 'parry' || fx.type === 'block') && fx.text) {
          this.fx.text(fx.x, fx.y + 0.6, fx.z, fx.text, fx.color || '#7dd3fc', fx.type === 'parry' ? 'big' : 'info');
        }
      } else if (!skipLegacyTwinGunMuzzle) {
        this.fx.handle(fx);
      }
      if (shooter && shooter.view.style === 'gun') {
        // Recoil kick on the gun arm (both arms on the two-gun finisher)
        const clip = shooter.view.currentName;
        if (clip === 'attack3') { shooter.view.kick(false); shooter.view.kick(true); }
        else shooter.view.kick(clip === 'attack2');
      }
      if (fx.type === 'hit' || fx.type === 'parry' || fx.type === 'block') {
        const victim = this.nearestPlayer(fx.x, fx.y - 1.1, fx.z, 1.8);
        if (victim) {
          if (fx.type === 'hit') victim.view.onHit((fx.damage || 0) >= 18);
          else victim.view.hitStop(60);
          const attacker = this.nearestPlayer(fx.x, fx.y - 1.1, fx.z, 5, (e) => e !== victim && ['attack', 'heavy', 'skill'].includes(e.pl?.state));
          if (attacker) attacker.view.hitStop(fx.type === 'hit' ? 70 : 90);
        }
      }
    }
  }

  nearestPlayer(x, y, z, maxD, filter = null) {
    let best = null;
    let bd = maxD;
    for (const e of this.players.values()) {
      if (!e.pl || (filter && !filter(e))) continue;
      const d = Math.hypot(e.pl.x - x, (e.pl.y - y) * 0.6, e.pl.z - z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ players
  makeDecal(color, size, additive) {
    const mat = new THREE.MeshBasicMaterial({
      map: additive ? this.circleTex : this.shadowTex,
      color: additive ? hdr(color, 1.5) : '#ffffff',
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    this.scene.add(m);
    return m;
  }

  ensureBuffMesh(e, key, make) {
    if (!e.buff[key]) {
      e.buff[key] = make();
      this.scene.add(e.buff[key]);
    }
    return e.buff[key];
  }

  syncPlayers(players, localId, dt) {
    const seen = new Set();
    const mode = this.lastMode;
    const me = players.find(p => p.id === localId);
    for (const pl of players) {
      seen.add(pl.id);
      let e = this.players.get(pl.id);
      if (!e) {
        e = { view: new ChibiView(pl), shadow: this.makeDecal(null, 1.4, false), ring: null, buff: {}, burnT: 0 };
        this.scene.add(e.view.root);
        this.players.set(pl.id, e);
      } else if (e.view.gearKey !== ChibiView.gearKey(pl)) {
        const yaw = e.view.yaw;
        e.view.dispose();
        e.view = new ChibiView(pl);
        e.view.yaw = yaw;
        this.scene.add(e.view.root);
      }
      e.pl = pl;
      e.view.update(pl, { dt, fx: this.fx });

      // Soft blob shadow on the floor below (shrinks with height)
      const fy = this.stage.floorY(pl.x, pl.z, pl.y + 0.1);
      if (fy !== null && pl.state !== 'dead') {
        const k = Math.max(0.3, 1 - Math.max(0, pl.y - fy) * 0.12);
        e.shadow.visible = true;
        e.shadow.position.set(pl.x, fy + 0.025, pl.z);
        e.shadow.scale.setScalar(k);
        e.shadow.material.opacity = k;
      } else {
        e.shadow.visible = false;
      }

      // Target ring: gold for you, blue/red for teams
      let ringColor = null;
      if (pl.id === localId) ringColor = '#fcd34d';
      else if (mode === 'team' && pl.team) ringColor = me && pl.team === me.team ? '#60a5fa' : '#f87171';
      if (ringColor && !e.ring) {
        e.ring = this.makeDecal(ringColor, 1.7, true);
        e.ringColor = ringColor;
      }
      if (e.ring) {
        if (!ringColor) e.ring.visible = false;
        else {
          if (e.ringColor !== ringColor) {
            e.ring.material.color.copy(hdr(ringColor, 1.5));
            e.ringColor = ringColor;
          }
          e.ring.visible = fy !== null && pl.state !== 'dead';
          e.ring.position.set(pl.x, (fy ?? pl.y) + 0.035, pl.z);
          e.ring.rotation.z += dt * 0.8;
          e.ring.material.opacity = pl.id === localId ? 0.95 : 0.6;
        }
      }
      this.updateBuffs(e, pl, dt);
    }
    for (const [id, e] of this.players) {
      if (!seen.has(id)) {
        e.view.dispose();
        e.shadow.removeFromParent();
        e.ring?.removeFromParent();
        for (const m of Object.values(e.buff)) m.removeFromParent();
        this.players.delete(id);
      }
    }
  }

  updateBuffs(e, pl, dt) {
    const b = pl.buffs || {};
    const yaw = e.view.yaw;
    const frozen = b.frozen || pl.state === 'frozen';
    if (frozen || e.buff.ice) {
      const ice = this.ensureBuffMesh(e, 'ice', () => new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 2.0, 1.1),
        new THREE.MeshLambertMaterial({ color: '#c9f3ff', emissive: '#2aa4c7', emissiveIntensity: 0.6, transparent: true, opacity: 0.5, depthWrite: false })
      ));
      ice.visible = frozen;
      ice.position.set(pl.x, pl.y + 1.0, pl.z);
      ice.rotation.y = yaw + 0.3;
    }
    if (pl.guarding || e.buff.guard) {
      const sh = this.ensureBuffMesh(e, 'guard', () => new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 22, 12, Math.PI / 2 - 1.1, 2.2, 0.35, 2.2),
        new THREE.MeshBasicMaterial({ color: hdr('#60a5fa', 1.4), transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      ));
      sh.visible = !!pl.guarding;
      sh.position.set(pl.x, pl.y + 0.95, pl.z);
      sh.rotation.y = yaw;
      sh.material.opacity = 0.18 + Math.sin(this.time * 8) * 0.05;
    }
    if (b.orbit || e.buff.orbit) {
      const g = this.ensureBuffMesh(e, 'orbit', () => {
        const grp = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), new THREE.MeshBasicMaterial({ color: hdr('#fb923c', 3) }));
          grp.add(s);
        }
        return grp;
      });
      g.visible = !!b.orbit;
      g.position.set(pl.x, pl.y + 1.0, pl.z);
      g.children.forEach((s, i) => {
        const a = this.time * 4 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 1.0, Math.sin(this.time * 3 + i) * 0.15, Math.sin(a) * 1.0);
      });
      if (b.orbit && Math.random() < 0.5) {
        const s = g.children[Math.floor(Math.random() * 3)];
        this.fx.add.spawn({ x: g.position.x + s.position.x, y: g.position.y + s.position.y, z: g.position.z + s.position.z, color: '#fb923c', intensity: 2, size: 0.35, sizeEnd: 0.05, life: 0.3, tile: 'dot' });
      }
    }
    if (b.root || e.buff.root) {
      const rr = this.ensureBuffMesh(e, 'root', () => this.makeDecal('#d946ef', 2.0, true));
      rr.visible = !!b.root;
      rr.position.set(pl.x, pl.y + 0.04, pl.z);
      rr.rotation.z -= dt * 2;
    }
    if (b.burn) {
      e.burnT -= dt;
      if (e.burnT <= 0) {
        e.burnT = 0.05;
        this.fx.add.spawn({ x: pl.x + (Math.random() - 0.5) * 0.6, y: pl.y + 0.3 + Math.random() * 1.2, z: pl.z + (Math.random() - 0.5) * 0.6, vy: 2.5, color: Math.random() < 0.5 ? '#ff7a1a' : '#fde047', intensity: 2.2, size: 0.45, sizeEnd: 0.05, life: 0.5, tile: 'dot' });
      }
    }
  }

  // ------------------------------------------------------------------ projectiles
  makeProjectile(pr) {
    const g = new THREE.Group();
    const color = pr.color || '#fde68a';
    const r = Math.max(0.15, pr.radius || 0.3);
    const glow = (c, k) => new THREE.MeshBasicMaterial({ color: hdr(c, k) });
    const add = (geom, mat, s = [1, 1, 1], p = [0, 0, 0]) => {
      const m = new THREE.Mesh(geom, mat);
      m.scale.set(...s);
      m.position.set(...p);
      g.add(m);
      return m;
    };
    switch (pr.type) {
      case 'shuriken': {
        const shape = new THREE.Shape();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = i % 2 === 0 ? 1 : 0.32;
          if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        const m = add(geom, new THREE.MeshLambertMaterial({ color: '#cbd5e1', emissive: '#6d28d9', emissiveIntensity: 0.5 }), [r * 1.6, r * 1.6, 1]);
        m.rotation.x = -Math.PI / 2;
        g.userData.spin = m;
        break;
      }
      case 'boomerang_axe': {
        const m = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), new THREE.MeshLambertMaterial({ color: '#7a4a2a' }));
        handle.rotation.z = Math.PI / 2;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 14, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#d1d5db', emissive: '#ea580c', emissiveIntensity: 0.4 }));
        head.position.x = 0.45;
        m.add(handle, head);
        g.add(m);
        g.userData.spin = m;
        g.userData.spinAxis = 'y';
        break;
      }
      case 'homing_missile': {
        const body = add(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), new THREE.MeshLambertMaterial({ color: '#e5e7eb' }));
        body.rotation.z = Math.PI / 2;
        const nose = add(new THREE.ConeGeometry(0.08, 0.2, 8), new THREE.MeshLambertMaterial({ color: '#d9682b' }), [1, 1, 1], [0.35, 0, 0]);
        nose.rotation.z = -Math.PI / 2;
        g.userData.trail = '#38bdf8';
        break;
      }
      case 'crescent_wave':
      case 'wave': {
        const geom = new THREE.RingGeometry(0.6, 1, 32, 1, -1.1, 2.2);
        const m = add(geom, new THREE.MeshBasicMaterial({ color: hdr(color, 2.2), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), [r * 3, r * 3, r * 3]);
        m.rotation.x = -Math.PI / 2;
        break;
      }
      case 'icebolt': {
        add(new THREE.OctahedronGeometry(1, 0), glow('#a5f3fc', 2.2), [r * 1.6, r * 0.8, r * 0.8]);
        break;
      }
      case 'bullet':
      case 'magnum': {
        const isMag = pr.type === 'magnum';
        const s = isMag ? 1.25 : 0.9;
        const body = add(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.55 * s, 8), glow(color, 2.5), [1, 1, 1], [-0.08 * s, 0, 0]);
        body.rotation.z = Math.PI / 2;
        const tip = add(new THREE.ConeGeometry(0.11 * s, 0.28 * s, 8), glow('#fff7cc', 2.8), [1, 1, 1], [0.33 * s, 0, 0]);
        tip.rotation.z = -Math.PI / 2;
        break;
      }
      case 'plasma': {
        // Futuristic spinning violet-cyan plasma energy orb + perpendicular energy ring (gun energy pulse!)
        add(new THREE.OctahedronGeometry(0.24, 0), glow('#ffffff', 3.0), [1.35, 0.72, 0.72]);
        const ring = add(new THREE.TorusGeometry(0.30, 0.055, 8, 20), glow('#818cf8', 2.7), [1, 1, 1]);
        ring.rotation.y = Math.PI / 2;
        g.userData.spin = ring;
        g.userData.spinAxis = 'x';
        break;
      }
      case 'railgun': {
        // High-energy sci-fi plasma cannon beam pulse (elongated glowing plasma core + twin accelerator rings — 0% sword slash!)
        const core = add(new THREE.CapsuleGeometry(0.18, 1.35, 6, 12), glow('#ffffff', 3.2), [1, 1, 1]);
        core.rotation.z = Math.PI / 2;
        const sheath = add(new THREE.CapsuleGeometry(0.30, 1.50, 6, 12), new THREE.MeshBasicMaterial({ color: hdr('#38bdf8', 2.4), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), [1, 1, 1]);
        sheath.rotation.z = Math.PI / 2;
        const rings = new THREE.Group();
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 8, 20), glow('#f97316', 2.8));
        r1.rotation.y = Math.PI / 2;
        r1.position.x = 0.25;
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 20), glow('#a78bfa', 2.8));
        r2.rotation.y = Math.PI / 2;
        r2.position.x = -0.35;
        rings.add(r1, r2);
        g.add(rings);
        g.userData.spin = rings;
        g.userData.spinAxis = 'x';
        break;
      }
      default:
        add(new THREE.IcosahedronGeometry(1, 2), glow(color, 2.6), [r * 0.8, r * 0.8, r * 0.8]);
    }
    g.userData.color = pr.type === 'fireball' ? '#ff8a2a' : color;
    this.scene.add(g);
    return g;
  }

  syncProjectiles(list, dt) {
    const now = performance.now();
    if (list !== this.lastProjList) {
      this.lastProjList = list;
      this.projSnapTime = now;
      for (const pr of list) {
        const e = this.projectiles.get(pr.id);
        if (e) Object.assign(e, { sx: pr.x, sy: pr.y, sz: pr.z, vx: pr.vx, vz: pr.vz });
      }
    }
    const age = Math.min(0.12, (now - this.projSnapTime) / 1000);
    const seen = new Set();
    for (const pr of list) {
      seen.add(pr.id);
      let e = this.projectiles.get(pr.id);
      if (!e) {
        e = { obj: this.makeProjectile(pr), sx: pr.x, sy: pr.y, sz: pr.z, vx: pr.vx, vz: pr.vz, trailT: 0 };
        e.obj.position.set(pr.x, pr.y, pr.z);
        this.projectiles.set(pr.id, e);
      }
      const tx = e.sx + e.vx * age, ty = e.sy, tz = e.sz + e.vz * age;
      e.obj.position.lerp(this._v.set(tx, ty, tz), 1 - Math.exp(-dt * 30));
      if (Math.hypot(e.vx, e.vz) > 0.1) e.obj.rotation.y = -Math.atan2(e.vz, e.vx);
      const spin = e.obj.userData.spin;
      if (spin) {
        if (e.obj.userData.spinAxis === 'y') spin.rotation.y += dt * 22;
        else if (e.obj.userData.spinAxis === 'x') spin.rotation.x += dt * 22;
        else spin.rotation.z += dt * 24;
      }
      e.trailT -= dt;
      if (e.trailT <= 0) {
        e.trailT = 0.016;
        const c = e.obj.userData.trail || e.obj.userData.color;
        const p = e.obj.position;
        if (pr.type !== 'bullet' && pr.type !== 'magnum' && pr.type !== 'plasma' && pr.type !== 'railgun') {
          this.fx.add.spawn({ x: p.x, y: p.y, z: p.z, color: c, intensity: 2, size: Math.max(0.35, (pr.radius || 0.3) * 1.4), sizeEnd: 0.05, life: 0.28, tile: 'dot' });
        }
        if (pr.type === 'fireball' || pr.type === 'homing_missile') {
          this.fx.norm.spawn({ x: p.x, y: p.y, z: p.z, vy: 0.6, color: '#57534e', size: 0.4, sizeEnd: 0.9, life: 0.5, alpha: 0.4, tile: 'dust' });
        }
      }
      e.last = pr;
    }
    for (const [id, e] of this.projectiles) {
      if (!seen.has(id)) {
        const p = e.obj.position;
        this.fx.flash(p.x, p.y, p.z, e.obj.userData.color, 1.2, 0.12);
        e.obj.removeFromParent();
        e.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
        this.projectiles.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ loot & hazards
  syncGears(list, dt) {
    const seen = new Set();
    for (const gd of list) {
      seen.add(gd.id);
      let e = this.gears.get(gd.id);
      if (!e) {
        const item = buildGearItem(gd.slot, gd.heroId);
        const holder = new THREE.Group();
        item.group.scale.setScalar(1.5);
        holder.add(item.group);
        holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        const decal = this.makeDecal('#fcd34d', 1.6, true);
        const beamMat = new THREE.MeshBasicMaterial({ map: this.fx.tex.beam, color: hdr('#fde68a', 1.4), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const beam = new THREE.Group();
        for (let i = 0; i < 2; i++) {
          const p = new THREE.Mesh(this.fx.geo.beam, beamMat);
          p.rotation.y = i * Math.PI / 2;
          beam.add(p);
        }
        beam.scale.set(0.9, 3.2, 0.9);
        this.scene.add(holder, beam);
        e = { holder, item, decal, beam, phase: Math.random() * 6 };
        this.gears.set(gd.id, e);
      }
      const bob = Math.sin(this.time * 2.5 + e.phase) * 0.12;
      e.holder.position.set(gd.x, gd.y + 0.75 + bob, gd.z);
      e.holder.rotation.y += dt * 1.4;
      e.decal.position.set(gd.x, gd.y + 0.04, gd.z);
      e.decal.rotation.z += dt;
      e.beam.position.set(gd.x, gd.y, gd.z);
      e.beam.children[0].material.opacity = 0.45 + Math.sin(this.time * 4 + e.phase) * 0.15;
    }
    for (const [id, e] of this.gears) {
      if (!seen.has(id)) {
        e.holder.removeFromParent();
        e.beam.removeFromParent();
        e.decal.removeFromParent();
        e.item.dispose();
        this.gears.delete(id);
      }
    }
  }

  syncHazards(list, dt) {
    const seen = new Set();
    for (const hz of list) {
      seen.add(hz.id);
      let e = this.hazards.get(hz.id);
      const color = hz.color || '#f43f5e';
      if (!e) {
        const decal = this.makeDecal(color, (hz.radius || 2) * 2, true);
        let core = null;
        if (hz.type === 'lava_pool') {
          core = new THREE.Mesh(new THREE.CircleGeometry(hz.radius * 0.85, 32), new THREE.MeshBasicMaterial({ color: hdr('#ff5a1f', 1.6), transparent: true, opacity: 0.75, depthWrite: false }));
          core.rotation.x = -Math.PI / 2;
          this.scene.add(core);
        } else if (hz.type === 'decoy_bomb') {
          // Substitution log (kawarimi) with a blinking explosive tag
          core = new THREE.Group();
          const bark = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.86, 10), new THREE.MeshLambertMaterial({ color: '#8b5a2b' }));
          const cut = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), new THREE.MeshLambertMaterial({ color: '#e0b27a' }));
          cut.position.y = 0.43;
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 5, 16), new THREE.MeshLambertMaterial({ color: '#5b3a1e' }));
          band.rotation.x = Math.PI / 2;
          band.position.y = -0.12;
          const tag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.012), new THREE.MeshLambertMaterial({ color: '#fff4dc', emissive: '#f43f5e', emissiveIntensity: 0.2 }));
          tag.position.set(0, 0.05, 0.245);
          bark.castShadow = true;
          core.add(bark, cut, band, tag);
          core.rotation.set(0.12, Math.random() * Math.PI * 2, -0.08);
          core.userData.blink = tag.material;
          this.scene.add(core);
        }
        e = { decal, core, t: 0 };
        this.hazards.set(hz.id, e);
      }
      e.decal.position.set(hz.x, hz.y + 0.05, hz.z);
      e.decal.rotation.z += dt * (hz.type === 'decoy_bomb' ? 4 : 0.7);
      if (e.core) {
        e.core.position.set(hz.x, hz.y + (hz.type === 'decoy_bomb' ? 0.43 : 0.06), hz.z);
        if (e.core.userData.blink) e.core.userData.blink.emissiveIntensity = 0.2 + (Math.sin(this.time * 25) > 0 ? 1.0 : 0);
      }
      e.t -= dt;
      if (e.t <= 0) {
        e.t = 0.04;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (hz.radius || 2);
        if (hz.type === 'lava_pool') {
          this.fx.add.spawn({ x: hz.x + Math.cos(a) * d, y: hz.y + 0.1, z: hz.z + Math.sin(a) * d, vy: 2.2, color: Math.random() < 0.5 ? '#ff7a1a' : '#fde047', intensity: 2.2, size: 0.5, sizeEnd: 0.05, life: 0.7, tile: 'dot' });
        } else if (hz.type === 'blizzard_zone') {
          this.fx.add.spawn({ x: hz.x + Math.cos(a) * d, y: hz.y + 2.5, z: hz.z + Math.sin(a) * d, vy: -2, color: '#e0f7ff', intensity: 1.6, size: 0.2, sizeEnd: 0.08, life: 1.1, swirl: 3, cx: hz.x, cz: hz.z, tile: 'dot' });
        } else if (hz.type === 'decoy_bomb') {
          this.fx.add.spawn({ x: hz.x, y: hz.y + 0.95, z: hz.z, vx: (Math.random() - 0.5) * 2, vy: 2, vz: (Math.random() - 0.5) * 2, color: '#fde047', intensity: 2.6, size: 0.25, sizeEnd: 0.02, life: 0.3, gravity: -6, tile: 'star' });
        } else {
          this.fx.add.spawn({ x: hz.x + Math.cos(a) * d, y: hz.y + 0.1, z: hz.z + Math.sin(a) * d, vy: 1.5, color, intensity: 2, size: 0.3, sizeEnd: 0.05, life: 0.8, tile: 'star' });
        }
      }
    }
    for (const [id, e] of this.hazards) {
      if (!seen.has(id)) {
        e.decal.removeFromParent();
        e.decal.material.dispose();
        if (e.core) {
          e.core.removeFromParent();
          e.core.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
        }
        this.hazards.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ camera
  updateCamera(dt, me) {
    const target = this._v.set(0, 0, 0);
    if (me) target.set(me.x, Math.max(-3, Math.min(6, me.y)) * 0.6, me.z);
    if (me && this.centerCameraOnNextFrame) {
      this.camTarget.copy(target);
      this.centerCameraOnNextFrame = false;
    } else {
      this.camTarget.lerp(target, 1 - Math.exp(-dt * 4.5));
    }
    const horiz = this.camDist * Math.cos(CAM_PITCH);
    const vert = this.camDist * Math.sin(CAM_PITCH);
    const t = this.camTarget;
    this.camera.position.set(t.x + horiz * COS45, t.y + vert, t.z + horiz * COS45);
    this.shake *= Math.exp(-dt * 9);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(t);
    this.sun.position.set(t.x - 12, t.y + 24, t.z + 5);
    this.sun.target.position.copy(t);
  }

  // ------------------------------------------------------------------ overlay
  toScreen(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) * 0.5 * this.width, y: (1 - v.y) * 0.5 * this.height };
  }

  drawOverlay(state, localId) {
    const ctx = this.octx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const font = (px) => `800 ${px}px "Segoe UI", Tahoma, sans-serif`;

    if (state) {
      const me = state.players.find(p => p.id === localId);
      for (const pl of state.players) {
        if (pl.state === 'dead') continue;
        if (pl.buffs?.stealth && pl.id !== localId) continue;
        const s = this.toScreen(pl.x, pl.y + 2.25, pl.z);
        if (!s) continue;
        const isMe = pl.id === localId;
        const ally = state.mode === 'team' && me && pl.team === me.team;
        const nameColor = isMe ? '#fde68a' : state.mode === 'team' ? (ally ? '#93c5fd' : '#fca5a5') : '#ffffff';
        ctx.font = font(12);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(30,18,12,0.85)';
        ctx.strokeText(pl.name, s.x, s.y);
        ctx.fillStyle = nameColor;
        ctx.fillText(pl.name, s.x, s.y);
        const w = 48, h = 5;
        const pct = Math.max(0, Math.min(1, pl.hp / pl.maxHp));
        ctx.fillStyle = 'rgba(20,12,8,0.75)';
        ctx.fillRect(s.x - w / 2 - 1, s.y + 5, w + 2, h + 2);
        ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
        ctx.fillRect(s.x - w / 2, s.y + 6, w * pct, h);
        if (isMe) {
          const bob = Math.sin(this.time * 5) * 3;
          ctx.fillStyle = '#fcd34d';
          ctx.strokeStyle = 'rgba(30,18,12,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x - 7, s.y - 22 + bob);
          ctx.lineTo(s.x + 7, s.y - 22 + bob);
          ctx.lineTo(s.x, s.y - 13 + bob);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    const now = performance.now();
    for (const t of this.fx.texts) {
      const k = (now - t.born) / t.ttl;
      const rise = t.kind === 'dmg' ? 0.9 * (1 - Math.pow(1 - k, 2)) : t.kind === 'callout' ? 0.35 * k : 0.7 * k;
      const s = this.toScreen(t.x + (t.kind === 'dmg' ? t.jitter : 0), t.y + rise, t.z);
      if (!s) continue;
      const pop = t.kind === 'dmg' || t.kind === 'big' ? (k < 0.12 ? 1.7 - (k / 0.12) * 0.7 : 1) : 1;
      const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const px = (t.kind === 'dmg' ? 26 : t.kind === 'big' ? 28 : t.kind === 'callout' ? 21 : 15) * pop;
      ctx.globalAlpha = alpha;
      ctx.font = font(px);
      ctx.lineWidth = t.kind === 'info' ? 3.5 : 5;
      ctx.strokeStyle = 'rgba(40,16,8,0.9)';
      if (t.kind === 'callout') {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 14;
      }
      ctx.strokeText(t.text, s.x, s.y);
      if (t.kind === 'dmg') {
        const grd = ctx.createLinearGradient(0, s.y - px, 0, s.y);
        grd.addColorStop(0, '#fff7cc');
        grd.addColorStop(1, t.color);
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = t.kind === 'callout' ? '#ffffff' : t.color;
      }
      ctx.fillText(t.text, s.x, s.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ frame
  render(state, localId) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    const mapId = state?.mapId || this.stage?.map.id || 'sky_temple';
    if (!this.stage || this.stage.map.id !== mapId) this.setStage(mapId);

    let me = null;
    if (state) {
      this.lastMode = state.mode;
      this.syncPlayers(state.players, localId, dt);
      this.syncProjectiles(state.projectiles || [], dt);
      this.syncGears(state.droppedGears || [], dt);
      this.syncHazards(state.hazards || [], dt);
      me = state.players.find(p => p.id === localId) || null;
    }

    this.updateCamera(dt, me);
    this.stage.update(this.time, dt, state?.shrineState);
    this.fx.update(dt);
    if (this.knightVfx) this.knightVfx.update(dt, state);
    if (this.ninjaVfx) this.ninjaVfx.update(dt);
    if (this.mageVfx) this.mageVfx.update(dt, state);
    if (this.cowboyVfx) this.cowboyVfx.update(dt);
    if (this.samuraiVfx) this.samuraiVfx.update(dt, state);
    if (this.witchVfx) this.witchVfx.update(dt, state);
    if (this.cyborgVfx) this.cyborgVfx.update(dt, state);
    if (this.vikingVfx) this.vikingVfx.update(dt, state);
    if (this.strikerVfx) this.strikerVfx.update(dt, state);
    this.composer.render(dt);
    if (window.KnightEffekseerVFX) {
      window.KnightEffekseerVFX.renderForThreeCamera(dt, this.camera, state);
    }
    this.drawOverlay(state, localId);
  }
}
