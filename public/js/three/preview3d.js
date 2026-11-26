// ============================================================================
// Interactive 3D Character Preview Stage for My Item (Mix & Match Dressing Room)
// Reuses ChibiView so any hero + mixed weapon/armor/helmet/trinket renders live.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChibiView, SKILL_ANIM } from './chibi.js';

export class CharacterPreview3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.85;
    roomEnv.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(31, 1, 0.2, 40);
    this.camera.position.set(0, 1.48, 4.35);
    this.camera.lookAt(0, 0.88, 0);

    const hemi = new THREE.HemisphereLight('#fff5ed', '#dbbdac', 1.45);
    const key = new THREE.DirectionalLight('#fff1e3', 2.1);
    key.position.set(-3.2, 4.4, 4.2);
    const rim = new THREE.DirectionalLight('#c8d9f1', 1.0);
    rim.position.set(-3.4, 2.8, -3.2);
    const fill = new THREE.DirectionalLight('#ffeadf', 0.9);
    fill.position.set(2.2, 1.6, 3.5);
    this.scene.add(hemi, key, rim, fill);

    // Glossy arcade pedestal platform
    this.pedestal = new THREE.Group();
    const baseTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.96, 1.08, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.28, metalness: 0.08 })
    );
    baseTop.position.y = -0.07;
    const baseTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.01, 0.036, 10, 40),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.45, roughness: 0.25 })
    );
    baseTrim.rotation.x = Math.PI / 2;
    baseTrim.position.y = -0.01;
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.018, 8, 36),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.78 })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.008;
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 24),
      new THREE.MeshBasicMaterial({ color: '#0c4a6e', transparent: true, opacity: 0.16, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.005;
    this.pedestal.add(baseTop, baseTrim, innerRing, shadowDisc);
    this.scene.add(this.pedestal);
    this.innerRing = innerRing;

    this.stageRoot = new THREE.Group();
    this.scene.add(this.stageRoot);

    this.view = null;
    this.heroId = 'knight';
    this.gear = { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' };
    this.yaw = 0.35;
    this.autoRotate = true;
    this.dragging = false;
    this.dragX = 0;
    this.popT = 0;
    this.active = false;
    this.rafId = 0;
    this.lastTime = performance.now();
    this.poseState = 'idle';
    this.poseUntil = 0;
    this.poseSkillId = null;

    this._bindPointer();
    this._loop = this._loop.bind(this);
  }

  _bindPointer() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.dragX = e.clientX;
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragX;
      this.dragX = e.clientX;
      this.yaw += dx * 0.013;
    });
    const endDrag = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  setLoadout(heroId, gear = {}) {
    const safeHero = heroId || 'knight';
    const nextGear = {
      weapon: gear.weapon === undefined ? safeHero : gear.weapon,
      armor: gear.armor === undefined ? safeHero : gear.armor,
      helmet: gear.helmet === undefined ? safeHero : gear.helmet,
      trinket: gear.trinket === undefined ? safeHero : gear.trinket
    };
    const fakePlayer = {
      heroId: safeHero,
      gear: nextGear,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: Math.PI / 2,
      grounded: true,
      state: 'idle',
      buffs: {}
    };
    const key = ChibiView.gearKey(fakePlayer);
    this.heroId = safeHero;
    this.gear = nextGear;

    if (this.view && this.view.gearKey === key) return;
    if (this.view) {
      this.view.dispose();
      this.view = null;
    }
    this.view = new ChibiView(fakePlayer);
    this.stageRoot.add(this.view.root);
    this.popT = 1;
    this.resize();
  }

  playPose(kind = 'idle') {
    const now = performance.now();
    if (kind === 'attack') {
      this.poseState = 'attack';
      this.poseUntil = now + 720;
      this.poseSkillId = null;
      this.view?.play('attack3', 0.06, true);
    } else if (kind === 'heavy') {
      this.poseState = 'heavy';
      this.poseUntil = now + 780;
      this.poseSkillId = null;
      this.view?.play('heavy', 0.06, true);
    } else if (kind === 'skill') {
      const skillId = window.GAME_DATA?.HEROES?.[this.gear.weapon || this.heroId]?.skills?.weapon?.id;
      const clipName = SKILL_ANIM[skillId] || 'skill';
      this.poseState = 'skill';
      this.poseSkillId = skillId || null;
      this.poseUntil = now + 900;
      this.view?.play(clipName, 0.06, true);
    } else {
      this.poseState = 'idle';
      this.poseUntil = 0;
      this.poseSkillId = null;
      this.view?.play('idle', 0.12, false);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(120, Math.floor(rect.width || this.canvas.clientWidth || 260));
    const h = Math.max(140, Math.floor(rect.height || this.canvas.clientHeight || 280));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setActive(visible) {
    if (visible && !this.active) {
      this.active = true;
      this.resize();
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this._loop);
    } else if (!visible && this.active) {
      this.active = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  _loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.autoRotate && !this.dragging) {
      this.yaw += dt * 0.45;
    }
    this.stageRoot.rotation.y = this.yaw;
    this.innerRing.rotation.z += dt * 0.85;

    // Juicy pop-in bounce when dressing/swapping gear
    if (this.popT > 0) {
      this.popT = Math.max(0, this.popT - dt * 4.5);
      const bounce = 1 + Math.sin(this.popT * Math.PI) * 0.14;
      this.stageRoot.scale.set(bounce, 1 + Math.sin(this.popT * Math.PI) * 0.08, bounce);
    } else {
      this.stageRoot.scale.set(1, 1, 1);
    }

    if (this.poseState !== 'idle' && now > this.poseUntil) {
      this.poseState = 'idle';
      this.poseSkillId = null;
    }

    if (this.view) {
      this.view.update({
        heroId: this.heroId,
        gear: this.gear,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        facing: Math.PI / 2,
        grounded: true,
        comboStep: this.poseState === 'attack' ? 3 : 0,
        state: this.poseState,
        animSkillId: this.poseSkillId,
        buffs: {}
      }, { dt, now, fx: null, floorY: () => 0 });
      this.view.root.rotation.y = 0;
    }

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this._loop);
  }

  dispose() {
    this.setActive(false);
    if (this.view) this.view.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}
