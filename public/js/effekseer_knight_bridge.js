// ============================================================================
// LOST SAGA 3D - IRON KNIGHT EFFEKSEER FOR WEBGL (1.80.8) VFX BRIDGE
// ============================================================================
// Engine-agnostic WebGL bridge for playing the 7 Iron Knight 3D Effekseer VFX
// on a raw WebGL2/WebGL1 canvas, Three.js WebGLRenderer, or Babylon.js Engine.
//
// Files expected after running tools\build_knight_vfx.bat:
//   /vendor/effekseer/effekseer.min.js
//   /vendor/effekseer/effekseer.wasm
//   /assets/vfx/knight/*.efkefc
//   /assets/vfx/knight/textures/*.png
// ============================================================================
(function (root) {
  const KNIGHT_VFX_CATALOG = {
    basic_slash: {
      id: 'basic_slash',
      hotkey: '1',
      nameTh: 'คอมโบฟันดาบ (Broadsword Slash)',
      file: '/assets/vfx/knight/knight_basic_slash.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_basic_slash.efk',
      sourceFile: '/assets/vfx/knight/knight_basic_slash.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.52,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'คลื่นดาบเสี้ยวทอง-น้ำเงินแซฟไฟร์ + ประกายไฟฟัน 3 มิติ'
    },
    heavy_shield_bash: {
      id: 'heavy_shield_bash',
      hotkey: '2',
      nameTh: 'กระแทกโล่ทะลวงการ์ด (Shield Bash)',
      file: '/assets/vfx/knight/knight_heavy_shield_bash.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_heavy_shield_bash.efk',
      sourceFile: '/assets/vfx/knight/knight_heavy_shield_bash.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.72,
      attachToCaster: false,
      color: '#38bdf8',
      desc: 'ตราโล่หกเหลี่ยม Aegis พุ่งกระแทก + คลื่นทะลวงการ์ดสีทอง'
    },
    knight_weapon: {
      id: 'knight_weapon',
      hotkey: '3',
      nameTh: '[Q/SD] คลื่นดาบเอ็กซ์คาลิเบอร์ (Excalibur Wave)',
      file: '/assets/vfx/knight/knight_skill_weapon_excalibur.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_weapon_excalibur.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_weapon_excalibur.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.15,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'วงเวทศักดิ์สิทธิ์ใต้เท้า + คลื่นดาบแสงทองแนวตั้งพุ่งทะลวงศัตรู'
    },
    knight_armor: {
      id: 'knight_armor',
      hotkey: '4',
      nameTh: '[E/ASD] ปราการศักดิ์สิทธิ์ (Aegis Fortress)',
      file: '/assets/vfx/knight/knight_skill_armor_aegis.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_armor_aegis.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_armor_aegis.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.55,
      attachToCaster: true,
      color: '#60a5fa',
      desc: 'โดมกำแพงโล่ 6 ด้าน + คลื่นกระแทกรอบตัว + ริบบิ้น Super Armor หมุนวน'
    },
    knight_helmet: {
      id: 'knight_helmet',
      hotkey: '5',
      nameTh: '[R/AD] คำรามราชสีห์ (Lionheart Warcry)',
      file: '/assets/vfx/knight/knight_skill_helmet_lionheart.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_helmet_lionheart.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_helmet_lionheart.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.30,
      attachToCaster: true,
      color: '#f59e0b',
      desc: 'ตราราชสีห์คำราม 3 ระลอก + เสาแสงทอง + กากบาทฮีล +20 HP'
    },
    knight_trinket: {
      id: 'knight_trinket',
      hotkey: '6',
      nameTh: '[F/AS] พุ่งชนโล่ราชรถ (Chariot Rush)',
      file: '/assets/vfx/knight/knight_skill_trinket_chariot.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_trinket_chariot.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_trinket_chariot.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 1.05,
      attachToCaster: true,
      color: '#38bdf8',
      desc: 'กรวยลมหัวโล่ 3 มิติ + วงแหวนความเร็วสูง + ประกายไฟเสียดสีพื้น'
    },
    guard_parry: {
      id: 'guard_parry',
      hotkey: '7',
      nameTh: 'ตั้งโล่สะท้อน (Shield Guard / Parry)',
      file: '/assets/vfx/knight/knight_hit_guard_parry.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_hit_guard_parry.efk',
      sourceFile: '/assets/vfx/knight/knight_hit_guard_parry.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.55,
      attachToCaster: false,
      color: '#7dd3fc',
      desc: 'ม่านโล่หกเหลี่ยมฟ้าคราม + แสงสะท้อน Starburst + สะเก็ดไฟกระเด็น'
    }
  };

  class KnightEffekseerVFX {
    constructor() {
      this.ctx = null;
      this.effects = new Map();
      this.activeHandles = [];
      this.ready = false;
      this.runtimeLoaded = false;
      this.loadErrors = [];
      this.loadedCount = 0;
      this.totalCount = Object.keys(KNIGHT_VFX_CATALOG).length;
    }

    getCatalog() {
      return KNIGHT_VFX_CATALOG;
    }

    /**
     * Initialize Effekseer WASM runtime and attach to an existing WebGL context
     * (from raw WebGL, Three.js renderer.getContext(), or Babylon.js engine._gl).
     */
    init(gl, options = {}) {
      const wasmPath = options.wasmPath || '/vendor/effekseer/effekseer.wasm';
      const onStatus = options.onStatus || (() => {});

      return new Promise((resolve, reject) => {
        if (typeof root.effekseer === 'undefined') {
          const err = new Error('effekseer.min.js not loaded (/vendor/effekseer/effekseer.min.js)');
          this.loadErrors.push(err.message);
          reject(err);
          return;
        }

        const onRuntimeReady = () => {
          this.runtimeLoaded = true;
          this.ctx = root.effekseer.createContext();
          this.ctx.init(gl, {
            instanceMaxCount: options.instanceMaxCount || 4000,
            squareMaxCount: options.squareMaxCount || 20000
          });
          if (typeof this.ctx.setRestorationOfStatesFlag === 'function') {
            this.ctx.setRestorationOfStatesFlag(true);
          }

          this.preloadAll(onStatus).then(() => {
            this.ready = this.loadedCount > 0;
            resolve(this);
          });
        };

        const onRuntimeError = (err) => {
          const msg = `Failed to initialize Effekseer WASM (${wasmPath}): ${err || 'unknown error'}`;
          this.loadErrors.push(msg);
          reject(new Error(msg));
        };

        root.effekseer.initRuntime(wasmPath, onRuntimeReady, onRuntimeError);
      });
    }

    preloadAll(onStatus = () => {}) {
      const entries = Object.values(KNIGHT_VFX_CATALOG);
      this.loadedCount = 0;
      this.loadErrors = [];

      const promises = entries.map((item) => new Promise((resolve) => {
        const tryLoad = (url, isFallback) => {
          const eff = this.ctx.loadEffect(
            url,
            item.scale || 1.0,
            () => {
              this.effects.set(item.id, eff);
              this.loadedCount++;
              onStatus({ loaded: this.loadedCount, total: entries.length, id: item.id, ok: true });
              resolve(true);
            },
            (msg) => {
              if (!isFallback && item.fallbackFile) {
                tryLoad(item.fallbackFile, true);
              } else {
                this.loadErrors.push(`${item.id}: ${msg || '404 not compiled yet'} (${url})`);
                onStatus({ loaded: this.loadedCount, total: entries.length, id: item.id, ok: false });
                resolve(false);
              }
            }
          );
        };
        tryLoad(item.file, false);
      }));

      return Promise.all(promises);
    }

    /**
     * Play a Knight effect at 3D world position (x, y, z) rotated by yaw (radians).
     * Convention: In Effekseer assets, forward is +Z.
     * In server.js, facing = atan2(dz, dx), so yaw around +Y to align +Z with (cos(facing), sin(facing))
     * is: yaw = Math.PI * 0.5 - facing.
     */
    play(effectId, opts = {}) {
      if (!this.ctx || !this.effects.has(effectId)) return null;
      const meta = KNIGHT_VFX_CATALOG[effectId];
      const eff = this.effects.get(effectId);

      const x = opts.x || 0;
      const y = opts.y || 0;
      const z = opts.z || 0;
      const scale = opts.scale !== undefined ? opts.scale : 1.0;
      const speed = opts.speed !== undefined ? opts.speed : (meta.speed || 1.0);
      const yaw = opts.yaw !== undefined
        ? opts.yaw
        : (typeof opts.facing === 'number' ? (Math.PI * 0.5 - opts.facing) : 0);

      const handle = this.ctx.play(eff, x, y, z);
      if (!handle) return null;

      handle.setLocation(x, y, z);
      handle.setRotation(opts.pitch || 0, yaw, opts.roll || 0);
      handle.setScale(scale, scale, scale);
      if (typeof handle.setSpeed === 'function') {
        handle.setSpeed(speed);
      }

      this.activeHandles.push({ id: effectId, handle, meta, opts });
      return handle;
    }

    /**
     * Directly handle server.js FX event objects for Iron Knight!
     */
    handleServerFx(fx) {
      if (!fx) return null;
      const common = {
        x: fx.x || 0,
        y: fx.y || 0,
        z: fx.z || 0,
        facing: typeof fx.facing === 'number' ? fx.facing : 0
      };

      if (fx.type === 'skill_cast' && KNIGHT_VFX_CATALOG[fx.skillId]) {
        return this.play(fx.skillId, common);
      }
      if (fx.type === 'slash' && (fx.heroId === 'knight' || fx.weaponType === 'broadsword')) {
        return this.play('basic_slash', {
          ...common,
          scale: fx.isFinisher ? 1.28 : 1.0
        });
      }
      if ((fx.type === 'heavy_cast' || fx.type === 'heavy_impact') && fx.heroId === 'knight') {
        return this.play('heavy_shield_bash', common);
      }
      if (fx.type === 'block' || fx.type === 'parry') {
        return this.play('guard_parry', common);
      }
      return null;
    }

    stopAll() {
      if (this.ctx) {
        this.ctx.stopAll();
      }
      this.activeHandles = [];
    }

    /**
     * Update & render Effekseer frame.
     * Pass column-major 4x4 Float32Array projectionMatrix and cameraViewMatrix.
     */
    updateAndDraw(dtSec, projectionMatrix, viewMatrix) {
      if (!this.ctx) return;
      const frames = Math.min(3.0, Math.max(0.0, dtSec * 60.0));
      this.ctx.update(frames);
      this.ctx.setProjectionMatrix(projectionMatrix);
      this.ctx.setCameraMatrix(viewMatrix);
      this.ctx.draw();

      // Prune ended handles
      for (let i = this.activeHandles.length - 1; i >= 0; i--) {
        const h = this.activeHandles[i].handle;
        if (!h || (typeof h.exists === 'function' && !h.exists())) {
          this.activeHandles.splice(i, 1);
        }
      }
    }
  }

  root.KNIGHT_VFX_CATALOG = KNIGHT_VFX_CATALOG;
  root.KnightEffekseerVFX = new KnightEffekseerVFX();
})(typeof self !== 'undefined' ? self : this);
