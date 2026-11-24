// ============================================================================
// LOST SAGA 3D - IRON KNIGHT EFFEKSEER FOR WEBGL (1.80.8) + HD2D VFX ENGINE
// ============================================================================
// Dual-mode Iron Knight VFX runtime:
//   1. PRIMARY (True 3D WebGL): Uses EffekseerForWebGL 1.80.8 (.efkefc + WASM)
//      with exact 4x4 View/Projection matrix synchronization matching
//      PixelRenderer25D's 45-degree diamond isometric camera (or any Three.js /
//      Babylon.js / custom WebGL camera).
//   2. AUTOMATIC HD TEXTURED FALLBACK: Uses the 10 custom 512x512 Knight PNG
//      VFX textures (/assets/vfx/knight/textures/*.png) on Canvas 2D whenever
//      .efkefc / effekseer.wasm has not been built yet, so Knight immediately
//      displays the new HD VFX suite in-game with zero setup friction!
// ============================================================================
(function (root) {
  const COS45 = Math.SQRT1_2;

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
      durationSec: 0.48,
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
      durationSec: 0.68,
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
      durationSec: 1.05,
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
      durationSec: 1.45,
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
      durationSec: 1.25,
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
      durationSec: 0.95,
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
      durationSec: 0.50,
      attachToCaster: false,
      color: '#7dd3fc',
      desc: 'ม่านโล่หกเหลี่ยมฟ้าคราม + แสงสะท้อน Starburst + สะเก็ดไฟกระเด็น'
    }
  };

  const KNIGHT_TEX_NAMES = [
    'slash_crescent',
    'holy_rune_circle',
    'hex_aegis_shield',
    'lion_crest_roar',
    'shockwave_ring',
    'starburst_flare',
    'energy_ribbon',
    'soft_glow',
    'holy_spark',
    'heal_cross'
  ];

  function easeOutCubic(t) {
    const u = 1 - Math.max(0, Math.min(1, t));
    return 1 - u * u * u;
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Column-major LookAt matrix for WebGL / Effekseer
  function makeLookAt(eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    const out = new Float32Array(16);
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  class KnightEffekseerVFX {
    constructor() {
      this.ctx = null;
      this.gl = null;
      this.overlayCanvas = null;
      this.effects = new Map();
      this.activeHandles = [];
      this.fallbackInstances = [];
      this.textures = {};
      this.tintedCache = new Map();

      this.ready = false;
      this.runtimeLoaded = false;
      this.mode = 'hd2d'; // 'webgl' when Effekseer .efkefc runtime is active, else 'hd2d'
      this.loadErrors = [];
      this.loadedCount = 0;
      this.totalCount = Object.keys(KNIGHT_VFX_CATALOG).length;
      this.lastFrameTime = performance.now();

      this.preloadFallbackTextures();
    }

    getCatalog() {
      return KNIGHT_VFX_CATALOG;
    }

    isEffectReady(effectId) {
      return !!(this.ctx && this.effects.has(effectId));
    }

    preloadFallbackTextures() {
      if (typeof Image === 'undefined') return;
      for (const name of KNIGHT_TEX_NAMES) {
        const img = new Image();
        img.src = `/assets/vfx/knight/textures/${name}.png`;
        this.textures[name] = img;
      }
    }

    getTintedTexture(name, hexColor) {
      const img = this.textures[name];
      if (!img || !img.complete || img.naturalWidth === 0) return null;
      if (!hexColor || hexColor === '#ffffff') return img;

      const key = `${name}_${hexColor}`;
      if (this.tintedCache.has(key)) return this.tintedCache.get(key);

      const size = 256;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const c = off.getContext('2d');
      c.drawImage(img, 0, 0, size, size);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = hexColor;
      c.fillRect(0, 0, size, size);
      // Preserve luminous white-hot core highlight by adding 40% original texture back
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.42;
      c.drawImage(img, 0, 0, size, size);

      this.tintedCache.set(key, off);
      return off;
    }

    /**
     * Attach to the live game's transparent WebGL overlay canvas (#effekseerCanvas).
     * Automatically falls back to HD2D textured Canvas rendering if effekseer.wasm
     * or .efkefc binaries have not been built yet.
     */
    attachGameCanvas(canvas, options = {}) {
      if (!canvas) return Promise.resolve(this);
      this.overlayCanvas = canvas;
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: true })
              || canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
      if (!gl) {
        this.mode = 'hd2d';
        return Promise.resolve(this);
      }
      this.gl = gl;

      if (typeof root.effekseer === 'undefined') {
        this.mode = 'hd2d';
        return Promise.resolve(this);
      }

      return this.init(gl, options).catch(() => {
        this.mode = 'hd2d';
        return this;
      });
    }

    /**
     * Initialize Effekseer WASM runtime and attach to an existing WebGL context
     * (from raw WebGL, Three.js renderer.getContext(), or Babylon.js engine._gl).
     */
    init(gl, options = {}) {
      const wasmPath = options.wasmPath || '/vendor/effekseer/effekseer.wasm';
      const onStatus = options.onStatus || (() => {});
      this.gl = gl;

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
            this.mode = this.ready ? 'webgl' : 'hd2d';
            resolve(this);
          });
        };

        const onRuntimeError = (err) => {
          const msg = `Failed to initialize Effekseer WASM (${wasmPath}): ${err || 'unknown error'}`;
          this.loadErrors.push(msg);
          this.mode = 'hd2d';
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
     * Determine whether a server FX event belongs to Iron Knight and should be
     * rendered by this dedicated Knight VFX suite instead of legacy PixelFX.
     */
    resolveServerFxMapping(fx) {
      if (!fx) return null;

      if (fx.type === 'skill_cast' && KNIGHT_VFX_CATALOG[fx.skillId]) {
        return {
          effectId: fx.skillId,
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'slash' && (fx.heroId === 'knight' || fx.weaponType === 'broadsword')) {
        return {
          effectId: 'basic_slash',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.isFinisher ? 1.28 : 1.0,
          comboStep: fx.comboStep || 1,
          isFinisher: !!fx.isFinisher
        };
      }

      // Shield Bash triggers once on heavy_impact (skip heavy_cast to avoid double burst)
      if (fx.type === 'heavy_impact' && fx.heroId === 'knight') {
        return {
          effectId: 'heavy_shield_bash',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if ((fx.type === 'block' || fx.type === 'parry') && fx.heroId === 'knight') {
        return {
          effectId: 'guard_parry',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.type === 'parry' ? 1.22 : 0.95,
          isParry: fx.type === 'parry'
        };
      }

      return null;
    }

    /**
     * Returns true if this event is exclusively handled by Knight's new VFX
     * (including secondary suppression for knight_armor / knight_helmet shockwaves
     * and knight heavy_cast so legacy PixelFX doesn't double-render).
     */
    shouldSuppressLegacyVfx(fx) {
      if (!fx) return false;
      if (this.resolveServerFxMapping(fx)) return true;
      if (fx.type === 'heavy_cast' && fx.heroId === 'knight') return true;
      if (fx.type === 'shockwave' && (fx.fromSkill === 'knight_armor' || fx.fromSkill === 'knight_helmet')) {
        return true;
      }
      return false;
    }

    /**
     * Play a Knight effect at 3D world position (x, y, z) rotated by yaw (radians).
     * Automatically uses EffekseerForWebGL (.efkefc) if compiled, otherwise spawns
     * the matching HD textured Knight VFX instance for Canvas 2D.
     */
    play(effectId, opts = {}) {
      const meta = KNIGHT_VFX_CATALOG[effectId];
      if (!meta) return null;

      const x = opts.x || 0;
      const y = opts.y || 0;
      const z = opts.z || 0;
      const scale = opts.scale !== undefined ? opts.scale : 1.0;
      const speed = opts.speed !== undefined ? opts.speed : (meta.speed || 1.0);
      const facing = typeof opts.facing === 'number' ? opts.facing : 0;
      const yaw = opts.yaw !== undefined ? opts.yaw : (Math.PI * 0.5 - facing);

      // 1. Primary path: Real 3D EffekseerForWebGL
      if (this.ctx && this.effects.has(effectId)) {
        const eff = this.effects.get(effectId);
        const handle = this.ctx.play(eff, x, y, z);
        if (handle) {
          handle.setLocation(x, y, z);
          handle.setRotation(opts.pitch || 0, yaw, opts.roll || 0);
          handle.setScale(scale, scale, scale);
          if (typeof handle.setSpeed === 'function') {
            handle.setSpeed(speed);
          }
          this.activeHandles.push({
            id: effectId,
            handle,
            meta,
            playerId: opts.playerId || null,
            attachToCaster: meta.attachToCaster && !!opts.playerId,
            scale
          });
          return handle;
        }
      }

      // 2. Fallback path: HD Textured 2.5D Knight VFX using our 10 512x512 PNGs
      this.spawnFallbackEffect(effectId, meta, {
        ...opts,
        x, y, z, scale, facing
      });
      return true;
    }

    /**
     * Play via EffekseerForWebGL (.efkefc) ONLY — returns true if real 3D
     * Effekseer runtime played the effect, or false so ThreeRenderer can run
     * its native 3D HDR-Bloom Three.js mesh fallback instead of Canvas 2D!
     */
    playWebGLOnly(effectId, opts = {}) {
      const meta = KNIGHT_VFX_CATALOG[effectId];
      if (!meta || !this.ctx || !this.effects.has(effectId)) return false;

      const x = opts.x || 0;
      const y = opts.y || 0;
      const z = opts.z || 0;
      const scale = opts.scale !== undefined ? opts.scale : 1.0;
      const speed = opts.speed !== undefined ? opts.speed : (meta.speed || 1.0);
      const facing = typeof opts.facing === 'number' ? opts.facing : 0;
      const yaw = opts.yaw !== undefined ? opts.yaw : (Math.PI * 0.5 - facing);

      const eff = this.effects.get(effectId);
      const handle = this.ctx.play(eff, x, y, z);
      if (!handle) return false;

      handle.setLocation(x, y, z);
      handle.setRotation(opts.pitch || 0, yaw, opts.roll || 0);
      handle.setScale(scale, scale, scale);
      if (typeof handle.setSpeed === 'function') {
        handle.setSpeed(speed);
      }

      this.activeHandles.push({
        id: effectId,
        handle,
        meta,
        playerId: opts.playerId || null,
        attachToCaster: meta.attachToCaster && !!opts.playerId,
        scale
      });
      return true;
    }

    /**
     * Render WebGL 3D Effekseer overlay synchronized directly to a Three.js PerspectiveCamera.
     */
    renderForThreeCamera(dtSec, camera, gameState) {
      this.syncAttachedHandles(gameState);

      if (!this.overlayCanvas || !this.gl) return;
      if (!this.ready || this.activeHandles.length === 0) {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.floor(window.innerWidth * dpr);
      const ch = Math.floor(window.innerHeight * dpr);
      if (this.overlayCanvas.width !== cw || this.overlayCanvas.height !== ch) {
        this.overlayCanvas.width = cw;
        this.overlayCanvas.height = ch;
      }

      this.gl.viewport(0, 0, cw, ch);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      camera.updateMatrixWorld();
      this.updateAndDraw(dtSec, camera.projectionMatrix.elements, camera.matrixWorldInverse.elements);
    }

    handleServerFx(fx) {
      const mapped = this.resolveServerFxMapping(fx);
      if (mapped) {
        this.play(mapped.effectId, mapped);
        return true;
      }
      return this.shouldSuppressLegacyVfx(fx);
    }

    stopAll() {
      if (this.ctx) {
        this.ctx.stopAll();
      }
      this.activeHandles = [];
      this.fallbackInstances = [];
    }

    // ------------------------------------------------------------------------
    // EXACT 45-DEGREE ISOMETRIC CAMERA MATRIX SYNC FOR PixelRenderer25D
    // Maps 3D world (wx, wy, wz) onto the EXACT same pixel coordinates as
    // PixelRenderer25D.project(wx, wy, wz), including pan, tilt & screen shake!
    // ------------------------------------------------------------------------
    buildIsometricMatrices(renderer) {
      const w = Math.max(1, renderer.width);
      const h = Math.max(1, renderer.height);
      const fovDist = 52.0;
      const pitch = Math.atan(renderer.isoTilt / renderer.heightScale);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const D = (fovDist / 0.65) * cosP;

      const eye = [
        renderer.camX + D * cosP * COS45,
        renderer.camY + D * sinP,
        renderer.camZ + D * cosP * COS45
      ];
      const target = [renderer.camX, renderer.camY, renderer.camZ];
      const view = makeLookAt(eye, target, [0, 1, 0]);

      const near = 4.0;
      const far = 260.0;
      const proj = new Float32Array(16);
      proj[0] = (2.0 * renderer.camZoom * D) / w;
      proj[5] = (2.0 * renderer.camZoom * renderer.heightScale * D) / (h * cosP);
      proj[8] = -(2.0 * (renderer.shakeOffsetX || 0)) / w;
      proj[9] = (2.0 * (renderer.shakeOffsetY || 0)) / h;
      proj[10] = -(far + near) / (far - near);
      proj[11] = -1.0;
      proj[14] = -(2.0 * far * near) / (far - near);

      return { proj, view };
    }

    syncAttachedHandles(gameState) {
      if (!gameState || !gameState.players) return;
      const playerMap = new Map();
      for (const pl of gameState.players) {
        playerMap.set(pl.id, pl);
      }

      for (const item of this.activeHandles) {
        if (!item.attachToCaster || !item.playerId) continue;
        const pl = playerMap.get(item.playerId);
        if (pl && pl.state !== 'dead' && item.handle) {
          item.handle.setLocation(pl.x, pl.y, pl.z);
          if (item.id === 'knight_trinket' && typeof pl.facing === 'number') {
            item.handle.setRotation(0, Math.PI * 0.5 - pl.facing, 0);
          }
        }
      }

      for (const inst of this.fallbackInstances) {
        if (!inst.attachToCaster || !inst.playerId) continue;
        const pl = playerMap.get(inst.playerId);
        if (pl && pl.state !== 'dead') {
          inst.x = pl.x;
          inst.y = pl.y;
          inst.z = pl.z;
          if (inst.id === 'knight_trinket' && typeof pl.facing === 'number') {
            inst.facing = pl.facing;
          }
        }
      }
    }

    /**
     * Render WebGL 3D Effekseer overlay synchronized with PixelRenderer25D.
     */
    renderForIsometricRenderer(renderer, gameState) {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) * 0.001));
      this.lastFrameTime = now;

      this.syncAttachedHandles(gameState);

      if (!this.overlayCanvas || !this.gl) return;
      if (!this.ready || this.activeHandles.length === 0) {
        // Keep transparent overlay clear when idle
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.floor(renderer.width * dpr);
      const ch = Math.floor(renderer.height * dpr);
      if (this.overlayCanvas.width !== cw || this.overlayCanvas.height !== ch) {
        this.overlayCanvas.width = cw;
        this.overlayCanvas.height = ch;
      }

      this.gl.viewport(0, 0, cw, ch);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      const { proj, view } = this.buildIsometricMatrices(renderer);
      this.updateAndDraw(dt, proj, view);
    }

    /**
     * Update & render Effekseer frame with explicit projection & view matrices
     * (used by knight_vfx_preview.html, Three.js, Babylon.js, or isometric overlay).
     */
    updateAndDraw(dtSec, projectionMatrix, viewMatrix) {
      if (!this.ctx) return;
      const frames = Math.min(3.0, Math.max(0.0, dtSec * 60.0));
      this.ctx.update(frames);
      this.ctx.setProjectionMatrix(projectionMatrix);
      this.ctx.setCameraMatrix(viewMatrix);
      this.ctx.draw();

      for (let i = this.activeHandles.length - 1; i >= 0; i--) {
        const h = this.activeHandles[i].handle;
        if (!h || (typeof h.exists === 'function' && !h.exists())) {
          this.activeHandles.splice(i, 1);
        }
      }
    }

    // ========================================================================
    // HD TEXTURED CANVAS 2D KNIGHT VFX FALLBACK (Uses our 10 512x512 PNGs!)
    // ========================================================================
    spawnFallbackEffect(effectId, meta, opts) {
      const now = performance.now();
      const sparks = [];
      const sparkCount = effectId === 'basic_slash' ? 14 : (effectId === 'guard_parry' ? 16 : 24);
      const dirX = Math.cos(opts.facing || 0);
      const dirZ = Math.sin(opts.facing || 0);

      for (let i = 0; i < sparkCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 5.2;
        sparks.push({
          ox: (Math.random() - 0.5) * 0.6,
          oy: 0.25 + Math.random() * 1.1,
          oz: (Math.random() - 0.5) * 0.6,
          vx: Math.cos(ang) * spd + (effectId === 'heavy_shield_bash' || effectId === 'basic_slash' ? dirX * 4.5 : 0),
          vy: (effectId === 'knight_helmet' || effectId === 'knight_armor') ? (2.2 + Math.random() * 3.8) : (1.5 + Math.random() * 4.2),
          vz: Math.sin(ang) * spd + (effectId === 'heavy_shield_bash' || effectId === 'basic_slash' ? dirZ * 4.5 : 0),
          size: 0.45 + Math.random() * 0.55,
          delay: Math.random() * 0.16,
          isHeal: effectId === 'knight_helmet' && i < 12
        });
      }

      if (this.fallbackInstances.length >= 24) {
        this.fallbackInstances.shift();
      }

      this.fallbackInstances.push({
        id: effectId,
        born: now,
        durationMs: (meta.durationSec || 0.9) * 1000,
        x: opts.x,
        y: opts.y,
        z: opts.z,
        facing: opts.facing || 0,
        scale: opts.scale || 1.0,
        comboStep: opts.comboStep || 1,
        isFinisher: !!opts.isFinisher,
        isParry: !!opts.isParry,
        playerId: opts.playerId || null,
        attachToCaster: meta.attachToCaster && !!opts.playerId,
        sparks
      });
    }

    drawSpriteTex(ctx, name, tintHex, x, y, w, h, rotRad, alpha, isoFlatten = 1.0) {
      if (alpha <= 0.01) return;
      const tex = this.getTintedTexture(name, tintHex);
      if (!tex) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(alpha);
      ctx.translate(x, y);
      if (isoFlatten !== 1.0) ctx.scale(1, isoFlatten);
      if (rotRad) ctx.rotate(rotRad);
      ctx.drawImage(tex, -w * 0.5, -h * 0.5, w, h);
      ctx.restore();
    }

    /**
     * Draw ground-layer HD Knight VFX (runes, lion crest, floor shockwaves)
     * BEFORE entities so characters stand ON TOP of their holy circles!
     */
    drawCanvasGround(ctx, renderer, gameState) {
      if (this.fallbackInstances.length === 0) return;
      this.syncAttachedHandles(gameState);

      const now = performance.now();
      for (let i = this.fallbackInstances.length - 1; i >= 0; i--) {
        const fx = this.fallbackInstances[i];
        const age = now - fx.born;
        if (age >= fx.durationMs) {
          this.fallbackInstances.splice(i, 1);
          continue;
        }
        const t = age / fx.durationMs;
        const ease = easeOutCubic(t);
        const fade = t < 0.1 ? (t / 0.1) : Math.pow(1 - t, 1.3);
        const gp = renderer.project(fx.x, fx.y + 0.05, fx.z);
        const unit = renderer.camZoom * gp.scale * fx.scale;

        if (fx.id === 'knight_weapon') {
          const r = unit * (1.2 + ease * 3.8);
          this.drawSpriteTex(ctx, 'holy_rune_circle', '#fbbf24', gp.x, gp.y, r * 2, r * 2, t * 2.2, fade * 0.92, renderer.isoTilt);
        } else if (fx.id === 'knight_armor') {
          const rRune = unit * (1.5 + ease * 4.5);
          this.drawSpriteTex(ctx, 'holy_rune_circle', '#38bdf8', gp.x, gp.y, rRune * 2, rRune * 2, t * 2.4, fade * 0.95, renderer.isoTilt);
          if (t < 0.45) {
            const wt = t / 0.45;
            const rWave = unit * (0.9 + easeOutCubic(wt) * 4.6);
            this.drawSpriteTex(ctx, 'shockwave_ring', '#60a5fa', gp.x, gp.y, rWave * 2, rWave * 2, 0, (1 - wt) * 0.95, renderer.isoTilt);
          }
        } else if (fx.id === 'knight_helmet') {
          const rCrest = unit * (1.2 + ease * 5.2);
          this.drawSpriteTex(ctx, 'lion_crest_roar', '#f59e0b', gp.x, gp.y, rCrest * 2, rCrest * 2, t * 1.4, fade * 0.95, renderer.isoTilt);
          for (let w = 0; w < 3; w++) {
            const wt = (t - w * 0.14) / 0.55;
            if (wt > 0 && wt < 1) {
              const rWave = unit * (0.8 + easeOutCubic(wt) * 5.0);
              this.drawSpriteTex(ctx, 'shockwave_ring', '#fde047', gp.x, gp.y, rWave * 2, rWave * 2, 0, (1 - wt) * 0.85, renderer.isoTilt);
            }
          }
        } else if (fx.id === 'heavy_shield_bash') {
          const dirX = Math.cos(fx.facing), dirZ = Math.sin(fx.facing);
          const bp = renderer.project(fx.x + dirX * 1.35, fx.y + 0.05, fx.z + dirZ * 1.35);
          const r = unit * (0.8 + ease * 3.1);
          this.drawSpriteTex(ctx, 'shockwave_ring', '#fbbf24', bp.x, bp.y, r * 2, r * 2, 0, fade * 0.88, renderer.isoTilt);
        }
      }
    }

    /**
     * Draw foreground HD Knight VFX (slashes, Excalibur wave, Aegis barrier,
     * Chariot Rush ram cone, Lionheart pillar + heal crosses, parry shield).
     */
    drawCanvasForeground(ctx, renderer) {
      if (this.fallbackInstances.length === 0) return;

      const now = performance.now();
      for (const fx of this.fallbackInstances) {
        const age = now - fx.born;
        if (age >= fx.durationMs) continue;
        const t = age / fx.durationMs;
        const ease = easeOutCubic(t);
        const fade = t < 0.08 ? (t / 0.08) : Math.pow(1 - t, 1.25);

        const dirX = Math.cos(fx.facing);
        const dirZ = Math.sin(fx.facing);
        const pOrigin = renderer.project(fx.x, fx.y + 1.05, fx.z);
        const pAhead = renderer.project(fx.x + dirX * 2.0, fx.y + 1.05, fx.z + dirZ * 2.0);
        const screenAng = Math.atan2(pAhead.y - pOrigin.y, pAhead.x - pOrigin.x);
        const unit = renderer.camZoom * pOrigin.scale * fx.scale;

        if (fx.id === 'basic_slash') {
          const pMid = renderer.project(fx.x + dirX * 0.85, fx.y + 1.05, fx.z + dirZ * 0.85);
          const swingDir = (fx.comboStep % 2 === 0) ? -1 : 1;
          const arcRot = screenAng + swingDir * (-1.15 + ease * 2.15);
          const sz = unit * (2.6 + ease * 1.1);
          // Sapphire trail arc + razor gold primary arc
          this.drawSpriteTex(ctx, 'slash_crescent', '#38bdf8', pMid.x, pMid.y, sz * 1.08, sz * 0.82, arcRot - swingDir * 0.24, fade * 0.82);
          this.drawSpriteTex(ctx, 'slash_crescent', '#fde047', pMid.x, pMid.y, sz, sz * 0.76, arcRot, fade * 0.98);
          if (t < 0.45) {
            const pTip = renderer.project(fx.x + dirX * 1.85, fx.y + 1.15, fx.z + dirZ * 1.85);
            const fSz = unit * (0.8 + (t / 0.45) * 1.6);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fef08a', pTip.x, pTip.y, fSz, fSz, t * 4, (1 - t / 0.45) * 0.95);
          }
        } else if (fx.id === 'heavy_shield_bash') {
          const dist = 0.55 + ease * 1.9;
          const pBash = renderer.project(fx.x + dirX * dist, fx.y + 1.05, fx.z + dirZ * dist);
          const sz = unit * (1.2 + ease * 2.1);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#38bdf8', pBash.x, pBash.y, sz, sz, t * 0.5, fade * 0.96);
          const pEcho = renderer.project(fx.x + dirX * (dist + 0.4), fx.y + 1.05, fx.z + dirZ * (dist + 0.4));
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#fbbf24', pEcho.x, pEcho.y, sz * 1.25, sz * 1.25, -t * 0.3, fade * 0.80);
          if (t < 0.5) {
            const fSz = unit * (1.1 + ease * 2.4);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fde047', pBash.x, pBash.y, fSz, fSz, t * 5, (1 - t / 0.5) * 0.98);
          }
        } else if (fx.id === 'knight_weapon') {
          // Excalibur Wave launching forward along Knight's facing!
          const travel = 0.9 + t * 13.5;
          const pWave = renderer.project(fx.x + dirX * travel, fx.y + 1.35, fx.z + dirZ * travel);
          const wUnit = renderer.camZoom * pWave.scale * fx.scale;
          const wSz = wUnit * (2.6 + ease * 2.4);
          this.drawSpriteTex(ctx, 'slash_crescent', '#f59e0b', pWave.x - Math.cos(screenAng) * 10, pWave.y - Math.sin(screenAng) * 10, wSz * 1.15, wSz * 1.25, screenAng, fade * 0.85);
          this.drawSpriteTex(ctx, 'slash_crescent', '#fef08a', pWave.x, pWave.y, wSz, wSz * 1.15, screenAng, fade * 1.0);
          if (t < 0.35) {
            const fSz = unit * (1.2 + (t / 0.35) * 3.0);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fef08a', pOrigin.x, pOrigin.y, fSz, fSz, t * 6, (1 - t / 0.35) * 0.95);
          }
        } else if (fx.id === 'knight_armor') {
          // Aegis Fortress dome barrier + orbiting hexagonal shield crests
          const sz = unit * (2.2 + ease * 1.6);
          this.drawSpriteTex(ctx, 'soft_glow', '#38bdf8', pOrigin.x, pOrigin.y, sz * 1.6, sz * 1.6, 0, fade * 0.45);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#60a5fa', pOrigin.x, pOrigin.y, sz * 1.15, sz * 1.15, Math.sin(t * 6) * 0.15, fade * 0.85);
          // Twin orbiting golden ribbon arcs
          for (let k = 0; k < 2; k++) {
            const orbAng = t * Math.PI * 5 + k * Math.PI;
            const ox = fx.x + Math.cos(orbAng) * 1.45;
            const oz = fx.z + Math.sin(orbAng) * 1.45;
            const oy = fx.y + 0.35 + t * 1.7;
            const op = renderer.project(ox, oy, oz);
            this.drawSpriteTex(ctx, 'energy_ribbon', '#fde047', op.x, op.y, unit * 1.8, unit * 0.65, orbAng, fade * 0.88);
          }
        } else if (fx.id === 'knight_helmet') {
          // Lionheart Warcry: Golden holy beam column + sunburst roar flash
          const pCol = renderer.project(fx.x, fx.y + 2.2, fx.z);
          const colW = unit * (1.2 + ease * 1.4);
          const colH = unit * (3.2 + ease * 3.2);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#fbbf24', pCol.x, pCol.y, colH, colW, Math.PI * 0.5, fade * 0.78);
          if (t < 0.42) {
            const fSz = unit * (1.4 + (t / 0.42) * 3.8);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fde047', pOrigin.x, pOrigin.y, fSz, fSz, t * 4, (1 - t / 0.42) * 0.98);
          }
        } else if (fx.id === 'knight_trinket') {
          // Chariot Rush: Aerodynamic sapphire-gold shield ram cone attached to dashing Knight!
          const pFront = renderer.project(fx.x + dirX * 1.55, fx.y + 1.05, fx.z + dirZ * 1.55);
          const coneW = unit * (2.6 + ease * 1.2);
          const coneH = unit * (1.8 + ease * 0.8);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#38bdf8', pOrigin.x, pOrigin.y, coneW * 1.35, coneH, screenAng, fade * 0.85);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#fde047', pOrigin.x, pOrigin.y, coneW, coneH * 0.62, screenAng, fade * 0.92);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#7dd3fc', pFront.x, pFront.y, unit * 1.9, unit * 1.9, t * 2.5, fade * 0.95);
          for (let r = 0; r < 3; r++) {
            const rt = ((t * 3 + r * 0.33) % 1);
            const pRing = renderer.project(fx.x + dirX * (1.3 - rt * 2.2), fx.y + 1.05, fx.z + dirZ * (1.3 - rt * 2.2));
            const rSz = unit * (0.9 + rt * 1.4);
            this.drawSpriteTex(ctx, 'shockwave_ring', '#7dd3fc', pRing.x, pRing.y, rSz * 0.65, rSz * 1.3, screenAng, (1 - rt) * fade * 0.85);
          }
        } else if (fx.id === 'guard_parry') {
          const pShield = renderer.project(fx.x + dirX * 0.75, fx.y + 1.05, fx.z + dirZ * 0.75);
          const sz = unit * (1.1 + ease * 1.4);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#7dd3fc', pShield.x, pShield.y, sz, sz, 0, fade * 0.96);
          this.drawSpriteTex(ctx, 'shockwave_ring', '#38bdf8', pShield.x, pShield.y, sz * 1.35, sz * 1.35, 0, fade * 0.85);
          if (t < 0.55) {
            this.drawSpriteTex(ctx, 'starburst_flare', '#ffffff', pShield.x, pShield.y, sz * 1.45, sz * 1.45, t * 7, (1 - t / 0.55) * 0.98);
          }
        }

        // Draw sparks & Lionheart heal crosses for every Knight effect!
        const sec = age * 0.001;
        for (const sp of fx.sparks) {
          const localSec = sec - sp.delay;
          if (localSec <= 0) continue;
          const spLife = fx.durationMs * 0.001 - sp.delay;
          const st = clamp01(localSec / Math.max(0.15, spLife));
          if (st >= 1) continue;

          const gravity = sp.isHeal ? 0 : -7.5;
          const sx = fx.x + sp.ox + sp.vx * localSec;
          const sy = Math.max(0.05, fx.y + sp.oy + sp.vy * localSec + 0.5 * gravity * localSec * localSec);
          const sz = fx.z + sp.oz + sp.vz * localSec;

          const pNow = renderer.project(sx, sy, sz);
          const pPrev = renderer.project(sx - sp.vx * 0.03, sy - (sp.vy + gravity * localSec) * 0.03, sz - sp.vz * 0.03);
          const velAng = Math.atan2(pNow.y - pPrev.y, pNow.x - pPrev.x) + Math.PI * 0.5;
          const alpha = (1 - st) * 0.95;

          if (sp.isHeal) {
            const hSz = renderer.camZoom * pNow.scale * sp.size * (0.65 + st * 0.45);
            this.drawSpriteTex(ctx, 'heal_cross', '#86efac', pNow.x, pNow.y, hSz, hSz, 0, alpha);
          } else {
            const pSz = renderer.camZoom * pNow.scale * sp.size * (1.1 - st * 0.65);
            const tint = (fx.id === 'knight_armor' || fx.id === 'knight_trinket' || fx.id === 'guard_parry') ? '#7dd3fc' : '#fde047';
            this.drawSpriteTex(ctx, 'holy_spark', tint, pNow.x, pNow.y, pSz * 0.55, pSz * 1.45, velAng, alpha);
          }
        }
      }
    }
  }

  root.KNIGHT_VFX_CATALOG = KNIGHT_VFX_CATALOG;
  root.KnightEffekseerVFX = new KnightEffekseerVFX();
})(typeof self !== 'undefined' ? self : this);
