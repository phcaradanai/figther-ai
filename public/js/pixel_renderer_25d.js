// ============================================================================
// LOST SAGA 2.5D PIXEL ARENA - VIDEO-ACCURATE 45° ISOMETRIC CUBE STAGE RENDERER
// ============================================================================
// Inspired directly by "Giga Suit VS Samurai EVO | Lost Saga Origin" (oJAFd9dXd1Y):
// - Fixed/Locked 45° Diamond Isometric-Perspective Camera (No camera rotation!)
// - 9x9 Beveled 3D Rubik's Cube Tiles (Yellow, Blue, Red, Green, Orange 3x3 zones)
// - 3D Vertical Cube Cliff Walls with circular emblems & Sunken Green Matrix Pit
// - 3D Extruded Neon Green Matrix Back Walls meeting at the back corner
// - Projected Character Silhouette Shadow + Glowing Floor Target Ring on Tiles
// - Overhead 3D Pyramid Marker (▼), [Player Name], HP Bar & LV Badge
// - Top-Right 45° Diamond Radar Mini-Map
// ============================================================================
(function (root) {
  const GAME_DATA = root.GAME_DATA;
  const COS45 = Math.SQRT1_2; // 0.70710678
  const SIN45 = Math.SQRT1_2;

  class PixelRenderer25D {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.tosRig = root.ToSSpriteRig ? new root.ToSSpriteRig() : null;
      this.tosVfx = root.ToSVFX ? new root.ToSVFX() : null;
      this.knightVfx = root.KnightEffekseerVFX || null;
      if (this.knightVfx && typeof document !== 'undefined') {
        const efkCanvas = document.getElementById('effekseerCanvas');
        if (efkCanvas) {
          this.knightVfx.attachGameCanvas(efkCanvas);
        }
      }

      // Preload Tree-of-Savior Hand-Painted Watercolor Sanctuary Arena Textures
      this.arenaTextures = {};
      const texFiles = {
        sanctuary_sky: '/assets/tos/arena/sanctuary_sky.jpg',
        sanctuary_floor: '/assets/tos/arena/sanctuary_floor.jpg',
        lava_sky: '/assets/tos/arena/lava_sky.jpg',
        lava_floor: '/assets/tos/arena/lava_floor.jpg',
        astral_sky: '/assets/tos/arena/astral_sky.jpg',
        astral_floor: '/assets/tos/arena/astral_floor.jpg'
      };
      for (const [k, url] of Object.entries(texFiles)) {
        const img = new Image();
        img.src = url;
        this.arenaTextures[k] = img;
      }

      // Fixed 45° Diamond Arena Camera (Locked angle, tracks player smoothly)
      this.camX = 0;
      this.camY = 0;
      this.camZ = 0;
      this.camZoom = 31;        // Pixels per world unit
      this.isoTilt = 0.52;      // Isometric diamond vertical foreshortening ratio
      this.heightScale = 1.15;  // Vertical Y height scale
      this.shakeAmount = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;

      this.spriteCache = new Map();
      this.gearIconCache = new Map();

      this.particles = [];
      this.activeFx = [];
      this.floatingTexts = [];

      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }

    addShake(amount) {
      this.shakeAmount = Math.min(16, Math.max(this.shakeAmount, amount));
    }

    // ------------------------------------------------------------------------
    // 45° DIAMOND ISOMETRIC-PERSPECTIVE PROJECTION (FIXED CAMERA ANGLE)
    // Rotates world (wx, wz) by 45° so:
    // - Back Corner (-L, -L) is at top-center (where the two green walls meet)
    // - Left Corner (-L, +L) is at far-left
    // - Right Corner (+L, -L) is at far-right
    // - Front Corner (+L, +L) is at bottom-center (Yellow 3x3 tiles in video!)
    // ------------------------------------------------------------------------
    project(wx, wy, wz) {
      const dx = wx - this.camX;
      const dy = wy - this.camY;
      const dz = wz - this.camZ;

      // Rotate 45 degrees into Diamond coordinates
      const rx = (dx - dz) * COS45;
      const rz = (dx + dz) * SIN45;

      // Subtle perspective foreshortening (foreground rz > 0 is slightly larger than background rz < 0)
      const fovDist = 52.0;
      const scale = fovDist / Math.max(18.0, fovDist - rz * 0.65);

      const screenX = this.width * 0.5 + rx * this.camZoom * scale + this.shakeOffsetX;
      const screenY = this.height * 0.50 + (rz * this.isoTilt - dy * this.heightScale) * this.camZoom * scale + this.shakeOffsetY;

      return {
        x: screenX,
        y: screenY,
        depth: rz, // Back (-rz) to Front (+rz)
        scale: scale
      };
    }

    // Convert mouse screen coordinates to 3D world facing angle in (X, Z)
    screenToWorldAngle(player, mouseX, mouseY) {
      const pScreen = this.project(player.x, player.y + 0.9, player.z);
      const srx = mouseX - pScreen.x;
      const srz = (mouseY - pScreen.y) / this.isoTilt;
      // Inverse 45-degree rotation from screen diamond (srx, srz) back to world (wx, wz)
      const wx = (srz + srx) * COS45;
      const wz = (srz - srx) * SIN45;
      return Math.atan2(wz, wx);
    }

    // Map screen-aligned WASD (A/D = screen Left/Right, W/S = screen Up-Back/Down-Front)
    // into the 45° diamond world coordinates so pressing D always walks right on screen
    // and pressing W always walks toward the top-back corner of the screen!
    transformInputByCamera(ix, iz) {
      if (ix === 0 && iz === 0) return { mx: 0, mz: 0 };
      return {
        mx: (iz + ix) * COS45,
        mz: (iz - ix) * SIN45
      };
    }

    // Check floor elevation under (x, z, currentY)
    getFloorUnder(x, z, currentY, map) {
      let bestPlat = null;
      let bestY = -999;

      for (const plat of map.platforms) {
        if (x >= plat.x && x <= plat.x + plat.w && z >= plat.z && z <= plat.z + plat.d) {
          if (currentY >= plat.y - 0.55 && plat.y >= bestY) {
            bestY = plat.y;
            bestPlat = plat;
          }
        }
      }

      if (bestPlat) {
        const dLeft = x - bestPlat.x;
        const dRight = (bestPlat.x + bestPlat.w) - x;
        const dBack = z - bestPlat.z;
        const dFront = (bestPlat.z + bestPlat.d) - z;
        const minEdgeDist = Math.min(dLeft, dRight, dBack, dFront);

        return {
          onPlatform: true,
          floorY: bestPlat.y,
          heightAboveFloor: Math.max(0, currentY - bestPlat.y),
          minEdgeDist,
          plat: bestPlat
        };
      }

      return {
        onPlatform: false,
        floorY: null,
        heightAboveFloor: null,
        minEdgeDist: 0,
        plat: null
      };
    }

    // ------------------------------------------------------------------------
    // SPAWN CLIENT VISUAL FX FROM SERVER EVENTS
    // ------------------------------------------------------------------------
    processServerFx(fxList) {
      const now = performance.now();
      for (const fx of fxList) {
        // Trigger dedicated Iron Knight 3D Effekseer / HD Textured VFX Suite first!
        const handledByKnightVfx = !!(this.knightVfx && this.knightVfx.handleServerFx(fx));

        // Trigger Tree-of-Savior Painterly Bloom & Ribbon VFX (skip duplicate bursts on Knight's dedicated moves)
        if (this.tosVfx && !handledByKnightVfx) {
          this.tosVfx.handleServerFx(fx);
        }
        // Trigger smoothed additive PixelFX skill VFX for the other 9 heroes
        if (root.PixelFXBridge && !handledByKnightVfx) {
          root.PixelFXBridge.handleServerFx(fx);
        }

        if (!this.tosVfx && (fx.type === 'hit' || fx.type === 'slash' || fx.type === 'heavy_impact' || fx.type === 'aerial_laser')) {
          const count = fx.type === 'heavy_impact' || fx.type === 'aerial_laser' ? 18 : 9;
          for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 2 + Math.random() * 6;
            this.particles.push({
              x: fx.tx || fx.x,
              y: (fx.ty !== undefined ? fx.ty : fx.y) + 0.3,
              z: fx.tz || fx.z,
              vx: Math.cos(ang) * spd,
              vy: 3 + Math.random() * 6,
              vz: Math.sin(ang) * spd,
              color: fx.color || '#38bdf8',
              size: 5,
              born: now,
              ttl: 400 + Math.random() * 220
            });
          }
        }

        if (fx.type === 'hit' && fx.damage) {
          this.floatingTexts.push({
            x: fx.x + (Math.random() - 0.5) * 0.5,
            y: fx.y + 0.7,
            z: fx.z,
            text: `-${fx.damage}`,
            color: fx.guardBreak ? '#fde047' : '#ff4d4d',
            scale: fx.damage >= 18 ? 1.35 : 1.05,
            born: now,
            ttl: 850
          });
          if (fx.damage >= 16) this.addShake(6);
        }

        if (fx.text && (fx.type === 'ko' || fx.type === 'gear_break' || fx.type === 'parry' || fx.type === 'clash' || fx.type === 'guard_break')) {
          this.floatingTexts.push({
            x: fx.x,
            y: fx.y + 0.8,
            z: fx.z,
            text: fx.text,
            color: fx.color || '#ffffff',
            scale: (fx.type === 'ko' || fx.type === 'gear_break' || fx.type === 'clash' || fx.type === 'guard_break') ? 1.35 : 1.05,
            born: now,
            ttl: fx.type === 'ko' ? 1400 : 950
          });
        }

        if (fx.type === 'skill_cast') {
          this.addShake(4);
        }
        if (fx.type === 'clash' || fx.type === 'guard_break') {
          this.addShake(6);
        }

        if (fx.type === 'hero_swap') {
          this.activeFx.push({ ...fx, born: now, ttl: 450 });
        }

        if (['slash', 'shockwave', 'meteor_strike', 'explosion', 'smoke', 'blade_storm', 'sakura_storm', 'blizzard', 'ice_tomb', 'ice_spikes', 'orbital_beam', 'aerial_laser', 'emp_dome', 'earthshatter', 'hundred_fists', 'scythe_reap', 'grave_chains', 'lasso', 'iaido_line', 'jumppad', 'air_jump', 'dash', 'clash', 'guard_break'].includes(fx.type)) {
          this.activeFx.push({
            ...fx,
            born: now,
            ttl: fx.type === 'aerial_laser' || fx.type === 'orbital_beam' || fx.type === 'meteor_strike' ? 780 : 420
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // PERSPECTIVE-ACCURATE AFFINE TRIANGLE TEXTURE MAPPER (Preserves Retina DPR!)
    // ------------------------------------------------------------------------
    drawTexturedTriangle(img, u0, v0, u1, v1, u2, v2, x0, y0, x1, y1, x2, y2) {
      const ctx = this.ctx;
      const du1 = u1 - u0, dv1 = v1 - v0;
      const du2 = u2 - u0, dv2 = v2 - v0;
      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-4) return;

      const dx1 = x1 - x0, dy1 = y1 - y0;
      const dx2 = x2 - x0, dy2 = y2 - y0;
      const a = (dx1 * dv2 - dx2 * dv1) / det;
      const b = (dy1 * dv2 - dy2 * dv1) / det;
      const c = (dx2 * du1 - dx1 * du2) / det;
      const d = (dy2 * du1 - dy1 * du2) / det;
      const e = x0 - a * u0 - c * v0;
      const f = y0 - b * u0 - d * v0;

      // Expand clip triangle slightly from centroid by 0.65px to eliminate hairline seams
      const cx = (x0 + x1 + x2) / 3;
      const cy = (y0 + y1 + y2) / 3;
      const pad = (x, y) => {
        const vx = x - cx, vy = y - cy;
        const len = Math.max(1, Math.hypot(vx, vy));
        return [x + (vx / len) * 0.65, y + (vy / len) * 0.65];
      };
      const [px0, py0] = pad(x0, y0);
      const [px1, py1] = pad(x1, y1);
      const [px2, py2] = pad(x2, y2);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px0, py0);
      ctx.lineTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // HAND-PAINTED TREE OF SAVIOR WATERCOLOR SKY SANCTUARY BACKDROP
    // ------------------------------------------------------------------------
    drawGreenMatrixEnvironment(map, timeSec) {
      const ctx = this.ctx;
      const isLava = map.voidType === 'lava';
      const isStar = map.voidType === 'neon_city';
      const skyKey = isLava ? 'lava_sky' : (isStar ? 'astral_sky' : 'sanctuary_sky');
      const skyImg = this.arenaTextures[skyKey];

      if (skyImg && skyImg.complete && skyImg.naturalWidth > 0) {
        // Cover viewport cleanly with subtle camera parallax so floating cathedrals glide!
        const parallaxX = -this.camX * 2.8;
        const parallaxY = -this.camZ * 1.6 + this.camY * 2.0;
        const pad = 64;
        const availW = this.width + pad * 2;
        const availH = this.height + pad * 2;
        const imgAspect = skyImg.naturalWidth / skyImg.naturalHeight;
        const viewAspect = availW / availH;

        let dw, dh;
        if (viewAspect > imgAspect) {
          dw = availW;
          dh = availW / imgAspect;
        } else {
          dh = availH;
          dw = availH * imgAspect;
        }
        const dx = (this.width - dw) * 0.5 + parallaxX;
        const dy = (this.height - dh) * 0.5 + parallaxY;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(skyImg, dx, dy, dw, dh);

        // Soft storybook horizon glow & gentle bottom cloud haze
        const haze = ctx.createLinearGradient(0, this.height * 0.55, 0, this.height);
        if (isLava) {
          haze.addColorStop(0, 'rgba(69, 10, 10, 0)');
          haze.addColorStop(1, 'rgba(124, 24, 12, 0.42)');
        } else if (isStar) {
          haze.addColorStop(0, 'rgba(15, 23, 42, 0)');
          haze.addColorStop(1, 'rgba(15, 23, 56, 0.45)');
        } else {
          haze.addColorStop(0, 'rgba(255, 246, 224, 0)');
          haze.addColorStop(1, 'rgba(255, 238, 206, 0.32)');
        }
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, isLava ? '#2b0d0c' : (isStar ? '#0b1433' : '#7dbce6'));
        bgGrad.addColorStop(1, isLava ? '#7c2d12' : (isStar ? '#1e2959' : '#fde8c8'));
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);
      }
    }

    // ------------------------------------------------------------------------
    // GET RUBIK'S CUBE 3x3 ZONE COLOR FOR TILE (row 0..8, col 0..8)
    // Matches the exact color layout of the Lost Saga Cube Stage in 1.jpg & 2.jpg!
    // ------------------------------------------------------------------------
    getCubeTileColors(row, col, style) {
      if (style === 'lava_cube') {
        const zr = Math.floor(row / 3);
        const zc = Math.floor(col / 3);
        if (zr === 1 && zc === 1) return { top: '#dc2626', bevel: '#f87171', sideL: '#991b1b', sideR: '#7f1d1d' };
        if ((zr + zc) % 2 === 0) return { top: '#57534e', bevel: '#78716c', sideL: '#44403c', sideR: '#292524' };
        return { top: '#ea580c', bevel: '#fb923c', sideL: '#c2410c', sideR: '#9a3412' };
      }

      if (style === 'lava_altar') {
        return { top: '#ef4444', bevel: '#fca5a5', sideL: '#b91c1c', sideR: '#7f1d1d' };
      }

      if (style === 'cyber_cube') {
        const zr = Math.floor(row / 3);
        const zc = Math.floor(col / 3);
        if (zr === 1 && zc === 1) return { top: '#0284c7', bevel: '#38bdf8', sideL: '#0369a1', sideR: '#075985' };
        if ((zr + zc) % 2 === 0) return { top: '#334155', bevel: '#64748b', sideL: '#1e293b', sideR: '#0f172a' };
        return { top: '#4f46e5', bevel: '#818cf8', sideL: '#3730a3', sideR: '#312e81' };
      }

      // Default: Lost Saga Origin Rubik's Cube Stage (1.jpg, 2.jpg, 3.jpg, maxresdefault.jpg)
      const zr = Math.floor(row / 3); // 0 = Back, 1 = Mid, 2 = Front
      const zc = Math.floor(col / 3); // 0 = Left, 1 = Mid, 2 = Right

      // Front Corner (2, 2): Bright Golden Yellow
      if (zr === 2 && zc === 2) {
        return { top: '#facc15', bevel: '#fef08a', sideL: '#ca8a04', sideR: '#a16207' };
      }
      // Center Zone (1, 1): Crimson Red
      if (zr === 1 && zc === 1) {
        return { top: '#dc2626', bevel: '#f87171', sideL: '#b91c1c', sideR: '#991b1b' };
      }
      // Back Corner (0, 0): Amber Orange
      if (zr === 0 && zc === 0) {
        return { top: '#f59e0b', bevel: '#fde68a', sideL: '#d97706', sideR: '#b45309' };
      }
      // Far Left (2, 0) & Far Right (0, 2) Wings: Emerald Green
      if ((zr === 2 && zc === 0) || (zr === 0 && zc === 2)) {
        return { top: '#22c55e', bevel: '#86efac', sideL: '#15803d', sideR: '#166534' };
      }
      // Four Mid-Side Zones ((1,2), (2,1), (0,1), (1,0)): Royal Blue
      return { top: '#2563eb', bevel: '#60a5fa', sideL: '#1d4ed8', sideR: '#1e3a8a' };
    }

    // ------------------------------------------------------------------------
    // DRAW HAND-PAINTED 2.5D FLOATING STONE SANCTUARY COURTYARD PLATFORM
    // - Perspective-accurate 4x4 triangle-mapped Tree of Savior stone courtyard
    // - Carved medieval limestone cliff walls with warm sunlit / cool shaded sides,
    //   golden filigree cornice molding, recessed stone arches, and draping ivy!
    // ------------------------------------------------------------------------
    drawCubePlatform(plat, map) {
      const ctx = this.ctx;
      const yTop = plat.y;
      const yBot = plat.y - plat.h;
      const isLava = plat.style === 'lava_cube' || plat.style === 'lava_altar' || (map && map.voidType === 'lava');
      const isStar = plat.style === 'cyber_cube' || (map && map.voidType === 'neon_city');

      const floorKey = isLava ? 'lava_floor' : (isStar ? 'astral_floor' : 'sanctuary_floor');
      const floorImg = this.arenaTextures[floorKey];

      // Sanctuary stone masonry cliff palette (Warm sunlit Left face vs Cool shadowed Right face!)
      const cliffPal = isLava
        ? {
            leftTop: '#59332b', leftBot: '#291210',
            rightTop: '#3d201c', rightBot: '#1a0a0a',
            trim: '#d97706', seam: '#1f0d0b', arch: 'rgba(249, 115, 22, 0.25)',
            ivy: null, glow: 'rgba(234, 88, 12, 0.35)'
          }
        : isStar
        ? {
            leftTop: '#3a496e', leftBot: '#1b2440',
            rightTop: '#263252', rightBot: '#11182e',
            trim: '#7dd3fc', seam: '#12182b', arch: 'rgba(125, 211, 252, 0.25)',
            ivy: null, glow: 'rgba(56, 189, 248, 0.30)'
          }
        : {
            leftTop: '#cfc0a6', leftBot: '#948269',
            rightTop: '#a89a87', rightBot: '#73685c',
            trim: '#d4a64a', seam: '#5c4b3c', arch: 'rgba(74, 58, 44, 0.28)',
            ivy: '#6d9456', glow: 'rgba(255, 244, 214, 0.42)'
          };

      const cBack  = this.project(plat.x, yTop, plat.z);
      const cRight = this.project(plat.x + plat.w, yTop, plat.z);
      const cFront = this.project(plat.x + plat.w, yTop, plat.z + plat.d);
      const cLeft  = this.project(plat.x, yTop, plat.z + plat.d);

      const bLeft  = this.project(plat.x, yBot, plat.z + plat.d);
      const bFront = this.project(plat.x + plat.w, yBot, plat.z + plat.d);
      const bRight = this.project(plat.x + plat.w, yBot, plat.z);

      // Soft atmospheric aura beneath the floating stone island
      ctx.save();
      const dropGrad = ctx.createRadialGradient(
        bFront.x, bFront.y + 8, 20,
        bFront.x, bFront.y + 8, Math.max(180, (cRight.x - cLeft.x) * 0.56)
      );
      dropGrad.addColorStop(0, isLava ? 'rgba(234, 88, 12, 0.32)' : (isStar ? 'rgba(56, 189, 248, 0.26)' : 'rgba(82, 68, 56, 0.24)'));
      dropGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dropGrad;
      ctx.beginPath();
      ctx.ellipse(bFront.x, bFront.y - 12, (cRight.x - cLeft.x) * 0.48, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 1. DRAW CARVED STONE MASONRY CLIFF SIDES (Front-Left sunlit & Front-Right shaded)
      const segs = plat.gridN >= 6 ? 6 : 3;

      // Front-Left Cliff Wall (z = plat.z + plat.d, x from plat.x to plat.x + plat.w)
      {
        const gradL = ctx.createLinearGradient(0, cLeft.y, 0, bFront.y);
        gradL.addColorStop(0, cliffPal.leftTop);
        gradL.addColorStop(1, cliffPal.leftBot);
        ctx.beginPath();
        ctx.moveTo(cLeft.x, cLeft.y);
        ctx.lineTo(cFront.x, cFront.y);
        ctx.lineTo(bFront.x, bFront.y);
        ctx.lineTo(bLeft.x, bLeft.y);
        ctx.closePath();
        ctx.fillStyle = gradL;
        ctx.fill();
        ctx.strokeStyle = cliffPal.seam;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Carved pilasters, arches & cornice trim along Front-Left face
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs;
          const t1 = (i + 1) / segs;
          const wx0 = plat.x + plat.w * t0;
          const wx1 = plat.x + plat.w * t1;
          const wz = plat.z + plat.d;

          const pT0 = this.project(wx0, yTop, wz);
          const pT1 = this.project(wx1, yTop, wz);
          const pB0 = this.project(wx0, yBot, wz);
          const pB1 = this.project(wx1, yBot, wz);

          // Vertical masonry pillar seam
          ctx.beginPath();
          ctx.moveTo(pT0.x, pT0.y);
          ctx.lineTo(pB0.x, pB0.y);
          ctx.strokeStyle = 'rgba(58, 44, 34, 0.35)';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Recessed stone arch relief inside each bay
          const aT0 = this.project(wx0 + (wx1 - wx0) * 0.2, yTop - plat.h * 0.22, wz);
          const aT1 = this.project(wx0 + (wx1 - wx0) * 0.8, yTop - plat.h * 0.22, wz);
          const aB0 = this.project(wx0 + (wx1 - wx0) * 0.2, yBot + plat.h * 0.14, wz);
          const aB1 = this.project(wx0 + (wx1 - wx0) * 0.8, yBot + plat.h * 0.14, wz);
          const aMidX = (aT0.x + aT1.x) * 0.5;
          const aMidY = (aT0.y + aT1.y) * 0.5 - 8 * aT0.scale;
          ctx.beginPath();
          ctx.moveTo(aB0.x, aB0.y);
          ctx.lineTo(aT0.x, aT0.y);
          ctx.quadraticCurveTo(aMidX, aMidY, aT1.x, aT1.y);
          ctx.lineTo(aB1.x, aB1.y);
          ctx.closePath();
          ctx.fillStyle = cliffPal.arch;
          ctx.fill();

          // Upper golden stone cornice lip
          const lip0 = this.project(wx0, yTop - plat.h * 0.10, wz);
          const lip1 = this.project(wx1, yTop - plat.h * 0.10, wz);
          ctx.beginPath();
          ctx.moveTo(pT0.x, pT0.y);
          ctx.lineTo(pT1.x, pT1.y);
          ctx.lineTo(lip1.x, lip1.y);
          ctx.lineTo(lip0.x, lip0.y);
          ctx.closePath();
          ctx.fillStyle = cliffPal.trim;
          ctx.globalAlpha = 0.65;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Delicate hanging watercolor moss/ivy clusters on Sky Sanctuary
          if (cliffPal.ivy && (i === 1 || i === 4)) {
            ctx.save();
            ctx.fillStyle = cliffPal.ivy;
            const ix = (pT0.x + pT1.x) * 0.5;
            const iy = (pT0.y + pT1.y) * 0.5 + 3;
            for (let v = 0; v < 4; v++) {
              ctx.beginPath();
              ctx.ellipse(ix + (v - 1.5) * 6, iy + v * 7 + (v % 2) * 5, 5.5, 9, 0.15, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      // Front-Right Cliff Wall (x = plat.x + plat.w, z from plat.z to plat.z + plat.d)
      {
        const gradR = ctx.createLinearGradient(0, cRight.y, 0, bFront.y);
        gradR.addColorStop(0, cliffPal.rightTop);
        gradR.addColorStop(1, cliffPal.rightBot);
        ctx.beginPath();
        ctx.moveTo(cFront.x, cFront.y);
        ctx.lineTo(cRight.x, cRight.y);
        ctx.lineTo(bRight.x, bRight.y);
        ctx.lineTo(bFront.x, bFront.y);
        ctx.closePath();
        ctx.fillStyle = gradR;
        ctx.fill();
        ctx.strokeStyle = cliffPal.seam;
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let i = 0; i < segs; i++) {
          const t0 = i / segs;
          const t1 = (i + 1) / segs;
          const wz0 = plat.z + plat.d * t0;
          const wz1 = plat.z + plat.d * t1;
          const wx = plat.x + plat.w;

          const pT0 = this.project(wx, yTop, wz0);
          const pT1 = this.project(wx, yTop, wz1);
          const pB0 = this.project(wx, yBot, wz0);
          const pB1 = this.project(wx, yBot, wz1);

          ctx.beginPath();
          ctx.moveTo(pT0.x, pT0.y);
          ctx.lineTo(pB0.x, pB0.y);
          ctx.strokeStyle = 'rgba(42, 32, 26, 0.38)';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          const aT0 = this.project(wx, yTop - plat.h * 0.22, wz0 + (wz1 - wz0) * 0.2);
          const aT1 = this.project(wx, yTop - plat.h * 0.22, wz0 + (wz1 - wz0) * 0.8);
          const aB0 = this.project(wx, yBot + plat.h * 0.14, wz0 + (wz1 - wz0) * 0.2);
          const aB1 = this.project(wx, yBot + plat.h * 0.14, wz0 + (wz1 - wz0) * 0.8);
          const aMidX = (aT0.x + aT1.x) * 0.5;
          const aMidY = (aT0.y + aT1.y) * 0.5 - 8 * aT0.scale;
          ctx.beginPath();
          ctx.moveTo(aB0.x, aB0.y);
          ctx.lineTo(aT0.x, aT0.y);
          ctx.quadraticCurveTo(aMidX, aMidY, aT1.x, aT1.y);
          ctx.lineTo(aB1.x, aB1.y);
          ctx.closePath();
          ctx.fillStyle = cliffPal.arch;
          ctx.fill();

          const lip0 = this.project(wx, yTop - plat.h * 0.10, wz0);
          const lip1 = this.project(wx, yTop - plat.h * 0.10, wz1);
          ctx.beginPath();
          ctx.moveTo(pT0.x, pT0.y);
          ctx.lineTo(pT1.x, pT1.y);
          ctx.lineTo(lip1.x, lip1.y);
          ctx.lineTo(lip0.x, lip0.y);
          ctx.closePath();
          ctx.fillStyle = cliffPal.trim;
          ctx.globalAlpha = 0.50;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          if (cliffPal.ivy && (i === 2 || i === 5)) {
            ctx.save();
            ctx.fillStyle = '#557842';
            const ix = (pT0.x + pT1.x) * 0.5;
            const iy = (pT0.y + pT1.y) * 0.5 + 3;
            for (let v = 0; v < 4; v++) {
              ctx.beginPath();
              ctx.ellipse(ix + (v - 1.5) * 5.5, iy + v * 6.5 + (v % 2) * 4, 5, 8.5, -0.15, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      // 2. DRAW PERSPECTIVE-ACCURATE HAND-PAINTED STONE COURTYARD FLOOR (4x4 Mesh!)
      if (floorImg && floorImg.complete && floorImg.naturalWidth > 0) {
        const sub = 4;
        const iw = floorImg.naturalWidth;
        const ih = floorImg.naturalHeight;
        const pts = [];
        for (let r = 0; r <= sub; r++) {
          const rowArr = [];
          for (let c = 0; c <= sub; c++) {
            const wx = plat.x + (plat.w * c) / sub;
            const wz = plat.z + (plat.d * r) / sub;
            rowArr.push(this.project(wx, yTop, wz));
          }
          pts.push(rowArr);
        }

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        for (let r = 0; r < sub; r++) {
          for (let c = 0; c < sub; c++) {
            const u0 = (iw * c) / sub, u1 = (iw * (c + 1)) / sub;
            const v0 = (ih * r) / sub, v1 = (ih * (r + 1)) / sub;
            const p00 = pts[r][c];
            const p10 = pts[r][c + 1];
            const p01 = pts[r + 1][c];
            const p11 = pts[r + 1][c + 1];

            this.drawTexturedTriangle(floorImg, u0, v0, u1, v0, u1, v1, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
            this.drawTexturedTriangle(floorImg, u0, v0, u1, v1, u0, v1, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
          }
        }
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.moveTo(cBack.x, cBack.y);
        ctx.lineTo(cRight.x, cRight.y);
        ctx.lineTo(cFront.x, cFront.y);
        ctx.lineTo(cLeft.x, cLeft.y);
        ctx.closePath();
        ctx.fillStyle = isLava ? '#57362e' : (isStar ? '#273557' : '#e5d5b7');
        ctx.fill();
      }

      // 3. CRISP WARM GOLDEN RIM BEVEL AROUND THE FLOATING SANCTUARY EDGE
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cBack.x, cBack.y);
      ctx.lineTo(cRight.x, cRight.y);
      ctx.lineTo(cFront.x, cFront.y);
      ctx.lineTo(cLeft.x, cLeft.y);
      ctx.closePath();
      ctx.strokeStyle = cliffPal.seam;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.strokeStyle = cliffPal.glow;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // ARTICULATED 2.5D PIXEL-ART STICKMAN SKELETAL RIG & COMBAT ANIMATOR (64x72)
    // - Clear human/stickman proportions: Head, Neck, Spine, Shoulders, Elbows,
    //   Hands, Hips, Knees, Feet (2-segment arms & 2-segment legs!)
    // - Dynamic skeletal keyframes for Idle breathing, Full-stride Run, Jump/Fly,
    //   4-Step Attack Combos (Slash/Punch/Kick), Heavy Guard-Break, Skill Cast,
    //   Guard/Parry, Hurt Stagger, and Knockdown
    // - Modular Lost Saga Gear (Helmet, Slim Torso Armor/Core, Back Trinket/Wings,
    //   and Hand-Tracked Weapons + Motion Swing Arcs)
    // ------------------------------------------------------------------------
    getCharacterSprite(player, dirOctant, animFrame) {
      const g = player.gear || {};
      const isAir = !player.grounded || player.state === 'jump';
      const isFly = !!player.isFlying;
      const isDash = !!player.isDashing;
      const comboStep = player.comboStep || 1;
      const key = `stickman3|${player.heroId}|${g.weapon || 'none'}|${g.armor || 'none'}|${g.helmet || 'none'}|${g.trinket || 'none'}|${player.state}|${comboStep}|${isAir ? 1 : 0}|${isFly ? 1 : 0}|${isDash ? 1 : 0}|${player.guarding ? 1 : 0}|${dirOctant}|${animFrame}`;
      if (this.spriteCache.has(key)) {
        return this.spriteCache.get(key);
      }

      if (this.spriteCache.size > 1400) {
        this.spriteCache.clear();
      }

      const pw = 64;
      const ph = 72;
      const off = document.createElement('canvas');
      off.width = pw;
      off.height = ph;
      const c = off.getContext('2d');
      c.imageSmoothingEnabled = false;

      const hero = GAME_DATA.HEROES[player.heroId] || GAME_DATA.HEROES.knight;
      const isLeft = (dirOctant === 3 || dirOctant === 4 || dirOctant === 5);
      const isBack = (dirOctant === 5 || dirOctant === 6 || dirOctant === 7);
      const isFrontCenter = (dirOctant === 2);
      const isBackCenter = (dirOctant === 6);
      const dirSign = isLeft ? -1 : 1;

      // Exact 8-directional angle in screen space (0=Right, 1=DownRight, 2=DownFront, 3=DownLeft, 4=Left, 5=UpLeft, 6=UpBack, 7=UpRight)
      const octAngle = dirOctant * (Math.PI * 0.25);
      const fwdX = Math.cos(octAngle);               // Horizontal forward component (-1..+1)
      const fwdY = Math.sin(octAngle) * 0.45;        // Depth/vertical forward foreshortening
      const latX = -Math.sin(octAngle);              // Lateral shoulder/hip width when facing Front/Back!
      const latY = Math.cos(octAngle) * 0.22;

      // Pixel-stepped thick bone/limb segment drawer (gives crisp pixel-art stickman limbs!)
      const drawBone = (x1, y1, x2, y2, thickness, color, outlineColor = '#090d16') => {
        const dist = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
        const steps = Math.ceil(dist * 1.5);
        const rOut = Math.ceil(thickness * 0.5) + 1;
        const rIn = Math.max(1, Math.floor(thickness * 0.5));

        c.fillStyle = outlineColor;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = Math.round(x1 + (x2 - x1) * t);
          const py = Math.round(y1 + (y2 - y1) * t);
          c.fillRect(px - rOut, py - rOut, rOut * 2, rOut * 2);
        }
        c.fillStyle = color;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = Math.round(x1 + (x2 - x1) * t);
          const py = Math.round(y1 + (y2 - y1) * t);
          c.fillRect(px - rIn, py - rIn, rIn * 2, rIn * 2);
        }
      };

      const drawJointDot = (x, y, r, color) => {
        const rx = Math.round(x);
        const ry = Math.round(y);
        c.fillStyle = '#090d16';
        c.fillRect(rx - r - 1, ry - r - 1, (r + 1) * 2, (r + 1) * 2);
        c.fillStyle = color;
        c.fillRect(rx - r, ry - r, r * 2, r * 2);
      };

      // True 3D-to-2.5D Forward Kinematics Helper:
      // Projects a bone of length `len` pitched forward by `degForward` (0° = down, +90° = forward along movement vector!)
      // and optional lateral offset `latOffset` so the stickman turns accurately in all 8 directions!
      const limbPt = (ox, oy, degForward, len, latOffset = 0) => {
        const rad = (degForward * Math.PI) / 180;
        const fDist = Math.sin(rad) * len;
        const vDist = Math.cos(rad) * len;
        return {
          x: ox + fDist * fwdX + latOffset * latX,
          y: oy + vDist + fDist * fwdY + latOffset * latY
        };
      };

      // ----------------------------------------------------------------------
      // 1. COMPUTE SKELETAL POSE ANGLES BASED ON ACTION STATE & ANIMATION FRAME
      // ----------------------------------------------------------------------
      // Angles in degrees where 0° = straight down, +90° = horizontal forward, -90° = horizontal back, +180° = straight up
      let hipX = 32;
      let hipY = 44;
      let spineLean = 6; // forward torso lean in degrees

      // Left (Back) & Right (Front) leg and arm joint angles
      let lThigh = -18, lShin = -12;
      let rThigh = 22,  rShin = 8;
      let lUpperArm = -25, lForeArm = 20;
      let rUpperArm = 30,  rForeArm = 65;
      let showSwingArc = false;
      let swingArcColor = hero.accentColor;
      let swingType = 'slash';

      if (player.state === 'run' && !isAir) {
        // Dynamic 4-frame Stickman Full-Stride Run Cycle!
        spineLean = 22;
        const runCycle = [
          { lt: 52,  ls: -10, rt: -45, rs: -75, la: -55, lf: -10, ra: 55,  rf: 95,  hy: 43 },
          { lt: 20,  ls: -5,  rt: -15, rs: -35, la: -20, lf: 25,  ra: 25,  rf: 65,  hy: 45 },
          { lt: -45, ls: -75, rt: 52,  rs: -10, la: 55,  lf: 95,  ra: -55, rf: -10, hy: 43 },
          { lt: -15, ls: -35, rt: 20,  rs: -5,  la: 25,  lf: 65,  ra: -20, rf: 25,  hy: 45 }
        ][animFrame % 4];
        hipY = runCycle.hy;
        lThigh = runCycle.lt; lShin = runCycle.ls;
        rThigh = runCycle.rt; rShin = runCycle.rs;
        lUpperArm = runCycle.la; lForeArm = runCycle.lf;
        rUpperArm = runCycle.ra; rForeArm = runCycle.rf;
      } else if (player.state === 'attack') {
        // 4 Distinct Stickman Combo Poses (Wide Slash, Upward Backhand, High Roundhouse Kick, Lunging Finisher!)
        showSwingArc = true;
        const step = ((comboStep - 1) % 4) + 1;
        if (step === 1) {
          // Combo 1: Deep forward lunge + wide horizontal slash/punch
          spineLean = 28;
          hipX += fwdX * 3;
          hipY = 45 + fwdY * 2;
          lThigh = -42; lShin = -50;
          rThigh = 48;  rShin = 5;
          lUpperArm = -45; lForeArm = -25;
          rUpperArm = 95;  rForeArm = 85;
          swingType = 'horizontal';
        } else if (step === 2) {
          // Combo 2: Rising uppercut / upward reverse cleave
          spineLean = -8;
          hipY = 42;
          lThigh = -25; lShin = -20;
          rThigh = 32;  rShin = 10;
          lUpperArm = 75;  lForeArm = 110;
          rUpperArm = 135; rForeArm = 155;
          swingType = 'upper';
        } else if (step === 3) {
          // Combo 3: Acrobat High Roundhouse Kick + counter-balanced arms!
          spineLean = -22;
          hipY = 43;
          lThigh = -10; lShin = -5;
          rThigh = 105; rShin = 98; // High horizontal kick!
          lUpperArm = -60; lForeArm = -40;
          rUpperArm = 65;  rForeArm = 80;
          swingType = 'kick';
        } else {
          // Combo 4: Aerial / Lunging Full-Extension Finisher Strike
          spineLean = 35;
          hipX += fwdX * 4;
          hipY = 44 + fwdY * 2;
          lThigh = -55; lShin = -65;
          rThigh = 58;  rShin = 12;
          lUpperArm = 85;  lForeArm = 90;
          rUpperArm = 88;  rForeArm = 88;
          swingType = 'finisher';
        }
      } else if (player.state === 'heavy') {
        // Heavy Guard-Break Attack: Dramatic Overhead Cleave / Power Stance!
        showSwingArc = true;
        swingArcColor = '#fde047';
        swingType = 'heavy';
        spineLean = 32;
        hipX += fwdX * 4;
        hipY = 45 + fwdY * 2;
        lThigh = -50; lShin = -55;
        rThigh = 55;  rShin = 8;
        lUpperArm = 110; lForeArm = 95;
        rUpperArm = 100; rForeArm = 82;
      } else if (player.state === 'skill') {
        // Active Gear Skill Cast: Heroic Power Unleash Pose!
        showSwingArc = true;
        swingArcColor = '#38bdf8';
        swingType = 'skill';
        spineLean = -12;
        hipY = 40;
        lThigh = -35; lShin = -55;
        rThigh = 45;  rShin = -25;
        lUpperArm = 130; lForeArm = 145;
        rUpperArm = 115; rForeArm = 110;
      } else if (player.guarding) {
        // Guard / Parry Stance: Crouched martial defensive block
        spineLean = 14;
        hipY = 47;
        lThigh = -30; lShin = -35;
        rThigh = 38;  rShin = -10;
        lUpperArm = 45;  lForeArm = 135;
        rUpperArm = 60;  rForeArm = 145;
      } else if (player.state === 'hurt' || player.state === 'frozen') {
        // Hurt / Stagger Pose: Bent backward in recoil, limbs flung out
        spineLean = -32;
        hipX -= fwdX * 3;
        hipY = 44 - fwdY * 2;
        lThigh = -20; lShin = -45;
        rThigh = 35;  rShin = -25;
        lUpperArm = -55; lForeArm = -85;
        rUpperArm = 45;  rForeArm = 125;
      } else if (isDash) {
        // High-Speed Stickman Dash / Air-Dash Aero Pose (Deep forward lean + trailing arms & speed lines!)
        spineLean = 38;
        hipX += fwdX * 4;
        hipY = (isAir ? 41 : 45) + fwdY * 2;
        lThigh = -65; lShin = -80;
        rThigh = 65;  rShin = 10;
        lUpperArm = -75; lForeArm = -60;
        rUpperArm = 85;  rForeArm = 95;
        showSwingArc = true;
        swingArcColor = hero.accentColor;
        swingType = 'horizontal';
      } else if (isFly) {
        // Active Flight / Levitation Hover Pose (Elevated hovering posture with arms ready!)
        const hoverBob = (animFrame % 2 === 0) ? -1 : 1;
        spineLean = 14;
        hipY = 38 + hoverBob;
        lThigh = -22; lShin = -45;
        rThigh = 30;  rShin = -18;
        lUpperArm = -35; lForeArm = 45;
        rUpperArm = 85;  rForeArm = 90;
      } else if (isAir) {
        // Airborne / Double-Jumping Martial-Arts Pose (Tucked front knee, extended back leg)
        spineLean = (player.jumpCount >= 2) ? 24 : 12;
        hipY = 40;
        lThigh = -38; lShin = -75;
        rThigh = 58;  rShin = -25;
        lUpperArm = -45; lForeArm = -15;
        rUpperArm = 75;  rForeArm = 105;
      } else {
        // Idle Breathing Combat Stance
        const breath = (animFrame % 2 === 0) ? 0 : 1;
        hipY = 44 + breath;
        spineLean = 8;
        lThigh = -22; lShin = -18;
        rThigh = 26;  rShin = 10;
        lUpperArm = -18; lForeArm = 35;
        rUpperArm = 28 + breath * 4; rForeArm = 72;
      }

      // ----------------------------------------------------------------------
      // 2. SOLVE JOINT COORDINATES FROM HIP (hipX, hipY)
      // ----------------------------------------------------------------------
      const torsoLen = 15;
      const thighLen = 11;
      const shinLen = 11;
      const upperArmLen = 10;
      const foreArmLen = 10;

      // Shoulder & Head positions
      const shoulder = limbPt(hipX, hipY, 180 - spineLean, torsoLen);
      const neck = limbPt(hipX, hipY, 180 - spineLean, torsoLen + 3);
      const head = limbPt(hipX, hipY, 180 - spineLean, torsoLen + 9);

      // Left (Back/Left-Side) Leg & Arm (with 3D lateral hip/shoulder spread!)
      const lHip = { x: hipX - fwdX * 1.5 - latX * 3.2, y: hipY - fwdY * 1.5 - latY * 3.2 };
      const lShldr = { x: shoulder.x - fwdX * 1.5 - latX * 4.2, y: shoulder.y + 1 - fwdY * 1.5 - latY * 4.2 };
      const lKnee = limbPt(lHip.x, lHip.y, lThigh, thighLen);
      const lFoot = limbPt(lKnee.x, lKnee.y, lShin, shinLen);
      const lElbow = limbPt(lShldr.x, lShldr.y, lUpperArm, upperArmLen);
      const lHand = limbPt(lElbow.x, lElbow.y, lForeArm, foreArmLen);

      // Right (Front/Right-Side) Leg & Arm (with 3D lateral hip/shoulder spread!)
      const rHip = { x: hipX + fwdX * 1.5 + latX * 3.2, y: hipY + fwdY * 1.5 + latY * 3.2 };
      const rShldr = { x: shoulder.x + fwdX * 1.5 + latX * 4.2, y: shoulder.y + 1 + fwdY * 1.5 + latY * 4.2 };
      const rKnee = limbPt(rHip.x, rHip.y, rThigh, thighLen);
      const rFoot = limbPt(rKnee.x, rKnee.y, rShin, shinLen);
      const rElbow = limbPt(rShldr.x, rShldr.y, rUpperArm, upperArmLen);
      const rHand = limbPt(rElbow.x, rElbow.y, rForeArm, foreArmLen);

      // Stickman body color palette (High contrast dark core with hero's vibrant energy trim!)
      const stickCoreColor = '#1e293b';
      const backLimbColor = '#334155';
      const frontLimbColor = g.armor ? hero.color : '#475569';
      const jointColor = hero.accentColor;

      // ----------------------------------------------------------------------
      // 3. DRAW TRINKET / BACK LAYER (Attached to Shoulder/Back)
      // ----------------------------------------------------------------------
      const drawTrinket = () => {
        if (!g.trinket) return;
        const sx = Math.round(shoulder.x);
        const sy = Math.round(shoulder.y);
        const backDir = -dirSign;
        switch (g.trinket) {
          case 'knight': // Flowing Royal Cape
            drawBone(sx, sy, sx + backDir * 12, sy + 18, 6, '#1d4ed8');
            drawBone(sx, sy + 2, sx + backDir * 10, sy + 16, 3, '#fbbf24');
            break;
          case 'ninja': // Giant Back Ninja Scroll & Scarf
            drawBone(sx + backDir * 2, sy - 2, sx + backDir * 14, sy - 6, 3, '#a855f7');
            drawBone(sx - 5, sy + 1, sx + 5, sy - 3, 5, '#7e22ce');
            break;
          case 'mage': // Floating Solar Flame Orbs behind shoulders (no box!)
            drawJointDot(sx - 10, sy - 7, 2, '#f97316');
            drawJointDot(sx + 10, sy - 7, 2, '#f97316');
            drawJointDot(sx, sy - 13, 2, '#fde047');
            break;
          case 'cowboy': // Western Scarf Tail
            drawBone(sx, sy, sx + backDir * 11, sy + 7, 4, '#d97706');
            break;
          case 'samurai': // Samurai EVO Battle Sash & Scabbard at Hip
            drawBone(hipX, hipY, hipX + backDir * 14, hipY + 4, 3, '#991b1b');
            drawBone(hipX + backDir * 10, hipY + 2, hipX + dirSign * 4, hipY - 3, 3, '#0f172a');
            break;
          case 'witch': // Crystal Ice Wings
            drawBone(sx, sy, sx + backDir * 14, sy - 8, 4, '#67e8f9');
            drawBone(sx, sy + 2, sx + backDir * 12, sy + 6, 4, '#22d3ee');
            break;
          case 'cyborg': // Giga Suit Twin Mecha Flight Wings + Cyan Thrusters!
            drawBone(sx, sy, sx + backDir * 15, sy - 9, 5, '#f8fafc');
            drawBone(sx, sy + 1, sx + backDir * 14, sy - 8, 3, '#ea580c');
            drawBone(sx, sy + 3, sx + backDir * 13, sy + 5, 4, '#f8fafc');
            if (isAir || player.state === 'skill') {
              drawBone(sx + backDir * 8, sy + 4, sx + backDir * 18, sy + 15, 5, '#38bdf8');
            }
            break;
          case 'viking': // Fur Cape
            drawBone(sx, sy, sx + backDir * 11, sy + 16, 7, '#7c2d12');
            break;
          case 'striker': // Golden Champion Ribbons
            drawBone(sx, sy - 2, sx + backDir * 13, sy + 8, 3, '#facc15');
            drawBone(sx, sy + 1, sx + backDir * 11, sy + 13, 3, '#fde047');
            break;
          case 'reaper': // Tattered Shadow Wings
            drawBone(sx, sy, sx + backDir * 16, sy - 10, 5, '#581c87');
            drawBone(sx, sy + 2, sx + backDir * 14, sy + 8, 4, '#9333ea');
            break;
        }
      };

      if (!isBack) drawTrinket();

      // ----------------------------------------------------------------------
      // 4. DRAW BACK LIMBS (Left Leg & Left Arm + Off-Hand Weapon)
      // ----------------------------------------------------------------------
      // Back Leg: Hip -> Knee -> Foot
      drawBone(lHip.x, lHip.y, lKnee.x, lKnee.y, 4, backLimbColor);
      drawBone(lKnee.x, lKnee.y, lFoot.x, lFoot.y, 4, backLimbColor);
      drawJointDot(lKnee.x, lKnee.y, 2, jointColor);
      drawBone(lFoot.x, lFoot.y, lFoot.x + fwdX * 4, lFoot.y + fwdY * 3, 4, hero.color);

      // Back Arm: Shoulder -> Elbow -> Hand
      drawBone(lShldr.x, lShldr.y, lElbow.x, lElbow.y, 4, backLimbColor);
      drawBone(lElbow.x, lElbow.y, lHand.x, lHand.y, 4, backLimbColor);
      drawJointDot(lElbow.x, lElbow.y, 2, jointColor);
      drawJointDot(lHand.x, lHand.y, 2, hero.skinColor);

      // Off-hand weapons for dual-wielding heroes (Ninja, Cowboy, Viking, Striker, Knight Shield, Giga Suit Blaster)
      if (g.weapon === 'knight') {
        // Shield on left forearm
        drawBone(lHand.x, lHand.y - 6, lHand.x, lHand.y + 6, 6, '#2563eb');
        drawJointDot(lHand.x, lHand.y, 3, '#fbbf24');
      } else if (g.weapon === 'ninja') {
        const tip = limbPt(lHand.x, lHand.y, lForeArm + 20, 10);
        drawBone(lHand.x, lHand.y, tip.x, tip.y, 2, '#c084fc');
      } else if (g.weapon === 'viking') {
        const tip = limbPt(lHand.x, lHand.y, lForeArm + 15, 12);
        drawBone(lHand.x, lHand.y, tip.x, tip.y, 3, '#78350f');
        drawJointDot(tip.x, tip.y, 4, '#cbd5e1');
      } else if (g.weapon === 'striker') {
        drawJointDot(lHand.x, lHand.y, 4, '#eab308');
      } else if (g.weapon === 'cyborg') {
        drawJointDot(lHand.x, lHand.y, 4, '#ea580c');
      }

      // ----------------------------------------------------------------------
      // 5. DRAW STICKMAN SPINE / TORSO & SLIM MODULAR ARMOR HARNESS
      // ----------------------------------------------------------------------
      drawBone(hipX, hipY, shoulder.x, shoulder.y, 5, stickCoreColor);
      drawJointDot(hipX, hipY, 3, '#0f172a');

      if (g.armor) {
        const aHero = GAME_DATA.HEROES[g.armor] || hero;
        // Slim Armor Chest Harness & Belt (keeps stickman waist & limbs 100% clear!)
        const chestX = (hipX + shoulder.x) * 0.5;
        const chestY = (hipY + shoulder.y) * 0.5;
        drawBone(shoulder.x - 4, shoulder.y + 1, shoulder.x + 4, shoulder.y + 1, 5, aHero.color);
        drawJointDot(chestX, chestY - 1, 3, g.armor === 'cyborg' ? '#38bdf8' : aHero.accentColor);
        drawJointDot(hipX, hipY, 3, aHero.accentColor);
      }

      // ----------------------------------------------------------------------
      // 6. DRAW STICKMAN HEAD, EYES & MODULAR HELMET
      // ----------------------------------------------------------------------
      const hx = Math.round(head.x);
      const hy = Math.round(head.y);

      // Stickman Round Head (Radius 6px)
      drawJointDot(hx, hy, 6, g.helmet === 'reaper' ? '#1e1b4b' : (g.helmet === 'cyborg' ? '#f8fafc' : hero.skinColor));

      // Glowing Eyes facing movement direction (centered when facing straight down-front!)
      if (!isBack) {
        c.fillStyle = player.heroId === 'reaper' ? '#e879f9' : (player.heroId === 'cyborg' ? '#38bdf8' : '#090d16');
        if (isFrontCenter) {
          c.fillRect(hx - 4, hy - 2, 2, 3);
          c.fillRect(hx + 2, hy - 2, 2, 3);
        } else {
          const eyeX = hx + dirSign * 3;
          c.fillRect(eyeX - 2, hy - 2, 4, 3);
        }
      }

      // Modular Helmet sitting on the Stickman Head
      if (g.helmet) {
        switch (g.helmet) {
          case 'knight': // Silver Visor Crest & Gold Plume
            drawBone(hx - 5, hy - 5, hx + 5, hy - 5, 4, '#94a3b8');
            drawBone(hx, hy - 8, hx - dirSign * 5, hy - 12, 3, '#fbbf24');
            break;
          case 'ninja': // Ninja Headband + Flowing Tail
            drawBone(hx - 6, hy - 3, hx + 6, hy - 3, 3, '#a855f7');
            drawBone(hx - dirSign * 6, hy - 3, hx - dirSign * 14, hy - 1, 2, '#a855f7');
            break;
          case 'mage': // Pointed Wizard Hat
            drawBone(hx - 8, hy - 5, hx + 8, hy - 5, 3, '#b91c1c');
            drawBone(hx, hy - 6, hx - dirSign * 4, hy - 15, 5, '#ef4444');
            break;
          case 'cowboy': // Wide Western Stetson Hat
            drawBone(hx - 9, hy - 5, hx + 9, hy - 5, 3, '#78350f');
            drawBone(hx - 4, hy - 8, hx + 4, hy - 8, 4, '#b45309');
            break;
          case 'samurai': // Samurai EVO Dark Kabuto + Golden Kuwagata Horns!
            drawBone(hx - 6, hy - 5, hx + 6, hy - 5, 4, '#1e293b');
            drawBone(hx - 4, hy - 6, hx - 9, hy - 14, 3, '#fbbf24');
            drawBone(hx + 4, hy - 6, hx + 9, hy - 14, 3, '#fbbf24');
            break;
          case 'witch': // Frost Crown
            drawBone(hx - 5, hy - 6, hx + 5, hy - 6, 3, '#06b6d4');
            drawBone(hx, hy - 6, hx, hy - 13, 3, '#67e8f9');
            break;
          case 'cyborg': // Giga Suit Red/White Fin & Cyan Crest
            drawBone(hx - 5, hy - 6, hx + 5, hy - 6, 3, '#ea580c');
            drawBone(hx, hy - 6, hx - dirSign * 3, hy - 14, 3, '#38bdf8');
            break;
          case 'viking': // Horned Viking Helmet
            drawBone(hx - 5, hy - 5, hx + 5, hy - 5, 4, '#57534e');
            drawBone(hx - 5, hy - 6, hx - 10, hy - 12, 3, '#fef3c7');
            drawBone(hx + 5, hy - 6, hx + 10, hy - 12, 3, '#fef3c7');
            break;
          case 'striker': // Golden Muay Thai Mongkhon Headband
            drawBone(hx - 6, hy - 4, hx + 6, hy - 4, 3, '#eab308');
            drawBone(hx - dirSign * 6, hy - 4, hx - dirSign * 12, hy - 2, 3, '#fef08a');
            break;
          case 'reaper': // Dark Grim Hood Peak
            drawBone(hx - 6, hy - 5, hx + 5, hy - 5, 4, '#581c87');
            drawBone(hx, hy - 6, hx - dirSign * 5, hy - 12, 4, '#3b0764');
            break;
        }
      }

      if (isBack) drawTrinket();

      // ----------------------------------------------------------------------
      // 7. DRAW FRONT LIMBS (Right Leg & Right Arm)
      // ----------------------------------------------------------------------
      // Front Leg: Hip -> Knee -> Foot
      drawBone(rHip.x, rHip.y, rKnee.x, rKnee.y, 5, frontLimbColor);
      drawBone(rKnee.x, rKnee.y, rFoot.x, rFoot.y, 4, frontLimbColor);
      drawJointDot(rKnee.x, rKnee.y, 2, jointColor);
      drawBone(rFoot.x, rFoot.y, rFoot.x + fwdX * 5, rFoot.y + fwdY * 3.5, 4, hero.accentColor);

      // Front Arm: Shoulder -> Elbow -> Hand
      drawBone(rShldr.x, rShldr.y, rElbow.x, rElbow.y, 4, frontLimbColor);
      drawBone(rElbow.x, rElbow.y, rHand.x, rHand.y, 4, frontLimbColor);
      drawJointDot(rElbow.x, rElbow.y, 2, jointColor);
      drawJointDot(rHand.x, rHand.y, 3, hero.skinColor);

      // ----------------------------------------------------------------------
      // 8. DRAW EQUIPPED WEAPON ATTACHED TO FRONT HAND (rHand) + SWING MOTION ARC!
      // ----------------------------------------------------------------------
      if (g.weapon) {
        const wAngle = rForeArm + 15; // Weapon aligns dynamically with the forearm swing!
        switch (g.weapon) {
          case 'knight': { // Giant Broadsword
            const tip = limbPt(rHand.x, rHand.y, wAngle, 20);
            const guardL = limbPt(rHand.x, rHand.y, wAngle + 90, 5);
            const guardR = limbPt(rHand.x, rHand.y, wAngle - 90, 5);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 4, '#e2e8f0');
            drawBone(guardL.x, guardL.y, guardR.x, guardR.y, 3, '#fbbf24');
            break;
          }
          case 'ninja': { // Main-Hand Kunai Dagger
            const tip = limbPt(rHand.x, rHand.y, wAngle, 13);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 3, '#c084fc');
            break;
          }
          case 'mage': { // Blazing Ruby Staff
            const tip = limbPt(rHand.x, rHand.y, wAngle + 10, 19);
            const butt = limbPt(rHand.x, rHand.y, wAngle - 170, 7);
            drawBone(butt.x, butt.y, tip.x, tip.y, 3, '#78350f');
            drawJointDot(tip.x, tip.y, 4, '#ef4444');
            drawJointDot(tip.x, tip.y, 2, '#fde047');
            break;
          }
          case 'cowboy': { // Dual Revolvers
            const tip = limbPt(rHand.x, rHand.y, rForeArm, 9);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 3, '#cbd5e1');
            break;
          }
          case 'samurai': { // Long Curved Katana (Samurai EVO)
            const tip = limbPt(rHand.x, rHand.y, wAngle, 23);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 3, '#f8fafc');
            drawJointDot(rHand.x, rHand.y, 3, '#ef4444');
            break;
          }
          case 'witch': { // Crystal Ice Wand
            const tip = limbPt(rHand.x, rHand.y, wAngle + 10, 18);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 3, '#0284c7');
            drawJointDot(tip.x, tip.y, 4, '#67e8f9');
            break;
          }
          case 'cyborg': { // Giga Suit Arm Buster Cannon
            const tip = limbPt(rHand.x, rHand.y, rForeArm, 10);
            drawBone(rElbow.x, rElbow.y, tip.x, tip.y, 5, '#ea580c');
            drawJointDot(tip.x, tip.y, 3, '#38bdf8');
            break;
          }
          case 'viking': { // Giant Battleaxe
            const tip = limbPt(rHand.x, rHand.y, wAngle, 17);
            const blade = limbPt(tip.x, tip.y, wAngle - 75, 7);
            drawBone(rHand.x, rHand.y, tip.x, tip.y, 3, '#78350f');
            drawBone(tip.x, tip.y, blade.x, blade.y, 5, '#e2e8f0');
            break;
          }
          case 'striker': { // Golden Muay Thai Gauntlets
            drawJointDot(rHand.x, rHand.y, 5, '#eab308');
            break;
          }
          case 'reaper': { // Colossal Grim Scythe
            const tip = limbPt(rHand.x, rHand.y, wAngle + 10, 22);
            const butt = limbPt(rHand.x, rHand.y, wAngle - 170, 8);
            const scytheBlade = limbPt(tip.x, tip.y, wAngle - 85, 14);
            drawBone(butt.x, butt.y, tip.x, tip.y, 3, '#4c1d95');
            drawBone(tip.x, tip.y, scytheBlade.x, scytheBlade.y, 4, '#e879f9');
            break;
          }
        }
      }

      // ----------------------------------------------------------------------
      // 9. DRAW COMBAT MOTION SMEAR / SLASH ARC DURING ATTACKS & SKILLS!
      // Makes every swing, kick, punch, and skill animation immediately readable!
      // ----------------------------------------------------------------------
      if (showSwingArc) {
        c.save();
        c.strokeStyle = swingArcColor;
        c.lineWidth = swingType === 'heavy' || swingType === 'finisher' ? 4 : 3;
        c.beginPath();
        if (swingType === 'kick') {
          c.arc(hipX, hipY, 22, dirSign > 0 ? -0.9 : Math.PI - 0.5, dirSign > 0 ? 0.5 : Math.PI + 0.9);
        } else if (swingType === 'upper') {
          c.arc(shoulder.x, shoulder.y, 24, dirSign > 0 ? -1.4 : Math.PI - 0.1, dirSign > 0 ? 0.1 : Math.PI + 1.4);
        } else {
          c.arc(shoulder.x, shoulder.y, 25, dirSign > 0 ? -1.1 : Math.PI - 0.7, dirSign > 0 ? 0.7 : Math.PI + 1.1);
        }
        c.stroke();
        c.restore();
      }

      if (player.guarding) {
        c.save();
        c.strokeStyle = '#38bdf8';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(shoulder.x + dirSign * 6, shoulder.y + 4, 18, dirSign > 0 ? -1.1 : Math.PI - 1.1, dirSign > 0 ? 1.1 : Math.PI + 1.1);
        c.stroke();
        c.restore();
      }

      // Build Dark Projected Shadow Canvas for 2.5D Extrusion & Isometric Floor Tile Shadow!
      const depthCanvas = document.createElement('canvas');
      depthCanvas.width = pw;
      depthCanvas.height = ph;
      const dc = depthCanvas.getContext('2d');
      dc.imageSmoothingEnabled = false;
      dc.drawImage(off, 0, 0);
      dc.globalCompositeOperation = 'source-atop';
      dc.fillStyle = 'rgba(10, 15, 28, 0.58)';
      dc.fillRect(0, 0, pw, ph);

      const result = { front: off, side: depthCanvas, pw, ph };
      this.spriteCache.set(key, result);
      return result;
    }

    getGearDropSprite(slot, heroId) {
      const key = `${slot}_${heroId}`;
      if (this.gearIconCache.has(key)) return this.gearIconCache.get(key);

      const hero = GAME_DATA.HEROES[heroId] || GAME_DATA.HEROES.knight;
      const off = document.createElement('canvas');
      off.width = 16;
      off.height = 16;
      const c = off.getContext('2d');
      c.imageSmoothingEnabled = false;

      const px = (x, y, w, h, col) => {
        c.fillStyle = col;
        c.fillRect(x, y, w, h);
      };

      px(2, 2, 12, 12, '#0f172a');
      px(3, 3, 10, 10, hero.color);

      if (slot === 'helmet') {
        px(4, 4, 8, 6, hero.accentColor);
        px(5, 8, 6, 2, '#0f172a');
      } else if (slot === 'armor') {
        px(4, 4, 8, 8, hero.accentColor);
        px(6, 5, 4, 5, hero.color);
      } else if (slot === 'trinket') {
        px(5, 3, 6, 10, hero.accentColor);
        px(6, 5, 4, 6, '#ffffff');
      } else {
        px(7, 3, 2, 10, '#ffffff');
        px(5, 9, 6, 2, hero.accentColor);
      }

      this.gearIconCache.set(key, off);
      return off;
    }

    // ------------------------------------------------------------------------
    // DRAW TOP-RIGHT 45° DIAMOND RADAR MINI-MAP (Just like in the video!)
    // ------------------------------------------------------------------------
    drawDiamondMiniMap(gameState, localClientId, map) {
      const ctx = this.ctx;
      const cx = this.width - 88;
      const cy = 112;
      const radius = 56;

      ctx.save();
      ctx.translate(cx, cy);

      // Diamond frame rotated 45° (Warm Tree-of-Savior Sanctuary Parchment & Gold)
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.72);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius * 0.72);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(38, 30, 26, 0.72)';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(234, 198, 114, 0.90)';
      ctx.stroke();

      // Inner 3x3 Courtyard Grid Lines on the Diamond Mini-Map
      ctx.strokeStyle = 'rgba(234, 198, 114, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        const f = i / 3;
        // Line parallel to back-right
        const ax = -radius * f, ay = -radius * 0.72 * (1 - f);
        const bx = radius * (1 - f), by = radius * 0.72 * f;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Line parallel to back-left
        const cx1 = radius * f, cy1 = -radius * 0.72 * (1 - f);
        const dx1 = -radius * (1 - f), dy1 = radius * 0.72 * f;
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(dx1, dy1);
        ctx.stroke();
      }

      // Plot Players on Diamond Mini-Map
      const L = 11.7;
      for (const pl of (gameState.players || [])) {
        if (pl.state === 'dead') continue;
        const nx = pl.x / L; // -1..+1
        const nz = pl.z / L; // -1..+1
        const mx = (nx - nz) * 0.5 * radius;
        const my = (nx + nz) * 0.5 * (radius * 0.72);

        const isMe = pl.id === localClientId;
        ctx.beginPath();
        ctx.arc(mx, my, isMe ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isMe ? '#4ade80' : (pl.heroId === 'cyborg' ? '#38bdf8' : '#ef4444');
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // MAIN FRAME RENDER LOOP
    // ------------------------------------------------------------------------
    render(gameState, localClientId) {
      const ctx = this.ctx;
      const now = performance.now();
      const timeSec = now * 0.001;

      if (this.shakeAmount > 0.1) {
        this.shakeOffsetX = (Math.random() - 0.5) * this.shakeAmount * 2;
        this.shakeOffsetY = (Math.random() - 0.5) * this.shakeAmount * 2;
        this.shakeAmount *= 0.85;
      } else {
        this.shakeAmount = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }

      const map = (gameState && GAME_DATA.MAPS[gameState.mapId]) || GAME_DATA.MAPS.sky_temple;

      // Smoothly center camera between local player and nearest opponent (like Lost Saga 1v1 Arena camera!)
      let localPlayer = null;
      if (gameState && gameState.players) {
        localPlayer = gameState.players.find(p => p.id === localClientId) || gameState.players[0];
      }
      if (localPlayer && localPlayer.state !== 'dead') {
        this.camX += (localPlayer.x * 0.55 - this.camX) * 0.12;
        this.camZ += (localPlayer.z * 0.55 - this.camZ) * 0.12;
        const targetY = Math.max(-1.0, Math.min(3.5, localPlayer.y * 0.28));
        this.camY += (targetY - this.camY) * 0.12;
      } else {
        this.camX += (0 - this.camX) * 0.06;
        this.camY += (0 - this.camY) * 0.06;
        this.camZ += (0 - this.camZ) * 0.06;
      }

      // 1. Background Fill + 3D Extruded Neon Green Matrix Back Walls & Sunken Pit Floor
      ctx.fillStyle = map.skyTop;
      ctx.fillRect(0, 0, this.width, this.height);
      this.drawGreenMatrixEnvironment(map, timeSec);

      if (!gameState) return;

      // 2. Players who fell behind the Back-Left (x < -11.7) or Back-Right (z < -11.7) edges
      // are drawn BEFORE the Cube Platform so they visibly drop into the pit behind the cube!
      const behindCubePlayers = [];
      const foregroundPlayers = [];

      for (const pl of (gameState.players || [])) {
        if (pl.state === 'dead') continue;
        const fInfo = this.getFloorUnder(pl.x, pl.z, pl.y, map);
        if (!fInfo.onPlatform && pl.y < 0 && (pl.x < -11.5 || pl.z < -11.5)) {
          behindCubePlayers.push(pl);
        } else {
          foregroundPlayers.push(pl);
        }
      }

      for (const pl of behindCubePlayers) {
        const p = this.project(pl.x, pl.y, pl.z);
        this.drawPlayer25D(pl, p, pl.id === localClientId, map, timeSec);
      }

      // 3. Draw Hand-Painted 2.5D Floating Sanctuary Courtyard Platforms
      for (const plat of map.platforms) {
        this.drawCubePlatform(plat, map);
      }

      // 3.5 Sync Projectile Ribbon Trails & Draw Isometric Ground Shockwave/Magic Rings!
      if (this.tosVfx) {
        this.tosVfx.syncProjectiles(gameState.projectiles, now);
        this.tosVfx.drawGroundRings(ctx, this, now);
      }
      if (this.knightVfx) {
        this.knightVfx.drawCanvasGround(ctx, this, gameState);
      }

      // 4. Draw Jump Pads
      for (const jp of map.jumpPads) {
        const p = this.project(jp.x, 0.04, jp.z);
        const r = jp.r * this.camZoom * p.scale;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, this.isoTilt);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw Ground Hazards
      for (const hz of (gameState.hazards || [])) {
        const p = this.project(hz.x, hz.y + 0.04, hz.z);
        const r = hz.radius * this.camZoom * p.scale;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, this.isoTilt);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = hz.type === 'blizzard_zone'
          ? 'rgba(34, 211, 238, 0.35)'
          : 'rgba(249, 115, 22, 0.38)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = hz.color || '#ef4444';
        ctx.stroke();
        ctx.restore();
      }

      // 6. Depth-Sorted 2.5D Entities on the Cube Arena
      const renderables = [];

      for (const g of (gameState.droppedGears || [])) {
        const p = this.project(g.x, g.y, g.z);
        renderables.push({
          depth: p.depth,
          draw: () => this.drawDroppedGear(g, p, map, timeSec)
        });
      }

      for (const pr of (gameState.projectiles || [])) {
        const p = this.project(pr.x, pr.y, pr.z);
        renderables.push({
          depth: p.depth,
          draw: () => this.drawProjectile(pr, p, map, timeSec)
        });
      }

      for (const pl of foregroundPlayers) {
        const p = this.project(pl.x, pl.y, pl.z);
        renderables.push({
          depth: p.depth,
          draw: () => this.drawPlayer25D(pl, p, pl.id === localClientId, map, timeSec)
        });
      }

      renderables.sort((a, b) => a.depth - b.depth);
      for (const item of renderables) {
        item.draw();
      }

      // 7. Draw Active 3D Skill FX + Knight Effekseer/HD VFX + Tree-of-Savior Painterly Bloom/Ribbon VFX!
      this.drawActiveFx(now);
      if (root.PixelFXBridge) {
        root.PixelFXBridge.updateAndDraw(ctx, this);
      }
      if (this.knightVfx) {
        this.knightVfx.drawCanvasForeground(ctx, this);
        this.knightVfx.renderForIsometricRenderer(this, gameState);
      }
      if (this.tosVfx) {
        this.tosVfx.drawForegroundVfx(ctx, this, now);
        this.tosVfx.drawAmbientAtmosphere(ctx, this.width, this.height, map, timeSec);
      }

      // 8. Draw 3D Pixel Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        const age = now - pt.born;
        if (age >= pt.ttl) {
          this.particles.splice(i, 1);
          continue;
        }
        pt.vy -= 22 * 0.016;
        pt.x += pt.vx * 0.016;
        pt.y += pt.vy * 0.016;
        pt.z += pt.vz * 0.016;

        const sp = this.project(pt.x, pt.y, pt.z);
        const sz = Math.max(2, Math.round(pt.size * sp.scale));
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(sp.x - sz * 0.5), Math.round(sp.y - sz * 0.5), sz, sz);
      }

      // 9. Draw Floating Combat Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        const age = now - ft.born;
        if (age >= ft.ttl) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        const progress = age / ft.ttl;
        const sp = this.project(ft.x, ft.y + progress * 1.4, ft.z);
        ctx.save();
        ctx.globalAlpha = 1 - Math.pow(progress, 2);
        const fontSize = Math.round(15 * (ft.scale || 1));
        ctx.font = `900 ${fontSize}px "Kanit", "Segoe UI", Tahoma, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeText(ft.text, sp.x, sp.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, sp.x, sp.y);
        ctx.restore();
      }

      // 10. Draw Top-Right 45° Diamond Radar Mini-Map (exact match to video!)
      this.drawDiamondMiniMap(gameState, localClientId, map);
    }

    // ------------------------------------------------------------------------
    // DRAW 2.5D PIXEL HERO + PROJECTED SILHOUETTE FLOOR SHADOW + GLOWING FLOOR RING
    // (Matches maxresdefault.jpg, 1.jpg, 2.jpg, 3.jpg!)
    // ------------------------------------------------------------------------
    drawPlayer25D(pl, screenPos, isLocal, map, timeSec) {
      const ctx = this.ctx;
      const floorInfo = this.getFloorUnder(pl.x, pl.z, pl.y, map);
      const isAirborne = floorInfo.onPlatform && floorInfo.heightAboveFloor > 0.14;
      const isOverAbyss = !floorInfo.onPlatform;

      // Compute 8-directional view in screen space (relAngle = pl.facing + Math.PI * 0.25):
      // 0 = Right (D), 1 = Down-Right (SD), 2 = Down-Front (S), 3 = Down-Left (SA),
      // 4 = Left (A),  5 = Up-Left (WA),    6 = Up-Back (W),    7 = Up-Right (WD)
      let relAngle = (pl.facing + Math.PI * 0.25) % (Math.PI * 2);
      if (relAngle < 0) relAngle += Math.PI * 2;
      const dirOctant = Math.round((relAngle / (Math.PI * 2)) * 8) % 8;

      const animFrame = Math.floor(timeSec * 9) % 4;
      const berserkMult = (pl.buffs && pl.buffs.berserk) ? 1.32 : 1.0;
      const useToSRig = !!this.tosRig;
      const rigScale = Math.max(0.75, 1.06 * screenPos.scale * berserkMult);
      const spriteObj = useToSRig ? null : this.getCharacterSprite(pl, dirOctant, animFrame);
      const pixelScale = Math.max(0.95, 1.55 * screenPos.scale * berserkMult);
      const drawW = useToSRig ? Math.round(92 * rigScale) : Math.round(spriteObj.pw * pixelScale);
      const drawH = useToSRig ? Math.round(118 * rigScale) : Math.round(spriteObj.ph * pixelScale);

      // ----------------------------------------------------------------------
      // 1. PROJECTED CHARACTER SILHOUETTE SHADOW & GLOWING TARGET RING ON THE FLOOR TILE!
      // Look at maxresdefault.jpg:
      // - Directly on the floor tile at (pl.x, floorY, pl.z) is a skewed dark
      //   silhouette shadow of the character + a bright glowing cyan/red ring!
      // ----------------------------------------------------------------------
      const shadowFloorY = floorInfo.onPlatform ? floorInfo.floorY : -4.2;
      const shadowPos = this.project(pl.x, shadowFloorY + 0.02, pl.z);

      ctx.save();
      ctx.translate(shadowPos.x, shadowPos.y);

      // A. Warm Watercolor Ambient-Occlusion Shadow + Subtle Sleek Target Ring on Sanctuary Floor!
      ctx.save();
      ctx.scale(1, this.isoTilt);
      const ringR = (isAirborne ? 22 : 19) * shadowPos.scale;
      const ringColor = isOverAbyss
        ? '#ef4444'
        : (isAirborne ? '#38bdf8' : (isLocal ? '#4ade80' : '#f97316'));

      const aoGrad = ctx.createRadialGradient(0, 0, ringR * 0.15, 0, 0, ringR * 1.05);
      aoGrad.addColorStop(0, 'rgba(42, 26, 22, 0.50)');
      aoGrad.addColorStop(0.65, 'rgba(42, 26, 22, 0.25)');
      aoGrad.addColorStop(1, 'rgba(42, 26, 22, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = aoGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.lineWidth = isLocal ? 2.6 : 2.0;
      ctx.globalAlpha = isLocal ? 0.85 : 0.60;
      ctx.strokeStyle = ringColor;
      ctx.stroke();

      // Subtle directional facing pointer dot on the ground ring
      const pointerDist = ringR + 4;
      const px = Math.cos(relAngle) * pointerDist;
      const py = Math.sin(relAngle) * pointerDist;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = ringColor;
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // C. Vertical Dashed Guide Line connecting Floor Ring to Airborne/Falling Character
      if (isAirborne || isOverAbyss) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = isOverAbyss ? '#ef4444' : 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shadowPos.x, shadowPos.y);
        ctx.lineTo(screenPos.x, screenPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ----------------------------------------------------------------------
      // 2. DRAW 2.5D EXTRUDED PIXEL ART CHARACTER
      // ----------------------------------------------------------------------
      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);

      // Golden/Flame Airborne Thruster Aura when flying/jumping (like Giga Suit in maxresdefault.jpg!)
      if (isAirborne) {
        const auraGrad = ctx.createRadialGradient(0, -drawH * 0.3, 4, 0, -drawH * 0.3, drawW * 0.75);
        auraGrad.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
        auraGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
        auraGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, -drawH * 0.3, drawW * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pl.buffs && (pl.buffs.stealth || pl.buffs.wraith)) {
        ctx.globalAlpha = isLocal ? 0.48 : 0.18;
      } else if (pl.buffs && pl.buffs.invuln) {
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(timeSec * 25);
      }

      if (pl.state === 'knockdown') {
        ctx.translate(0, -drawH * 0.25);
        ctx.rotate(Math.PI * 0.45);
      }

      if (useToSRig) {
        // Tree-of-Savior Style Smooth HD Modular Paper-Doll Chibi Character (with Afterimages & Easing!)
        this.tosRig.drawCharacter(ctx, pl, dirOctant, timeSec, rigScale, isAirborne, this);
      } else {
        // Fallback: Pseudo-3D Voxel Depth Extrusion
        const depthSlices = 3;
        const extrudeAngle = relAngle + Math.PI * 0.75;
        const exX = Math.cos(extrudeAngle) * 1.0;
        const exY = Math.sin(extrudeAngle) * 0.6;

        for (let s = depthSlices; s >= 1; s--) {
          ctx.drawImage(
            spriteObj.side,
            Math.round(-drawW * 0.5 + exX * s),
            Math.round(-drawH + 8 + exY * s),
            drawW,
            drawH
          );
        }

        ctx.drawImage(
          spriteObj.front,
          Math.round(-drawW * 0.5),
          Math.round(-drawH + 8),
          drawW,
          drawH
        );
      }

      if (pl.buffs && pl.buffs.frozen) {
        // Faceted Diamond Ice Crystal Polygon around frozen character (no square box!)
        ctx.beginPath();
        ctx.moveTo(0, -drawH * 0.88);
        ctx.lineTo(drawW * 0.32, -drawH * 0.55);
        ctx.lineTo(drawW * 0.24, -4);
        ctx.lineTo(-drawW * 0.24, -4);
        ctx.lineTo(-drawW * 0.32, -drawH * 0.55);
        ctx.closePath();
        ctx.fillStyle = 'rgba(103, 232, 249, 0.38)';
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();

      // ----------------------------------------------------------------------
      // 3. LOST SAGA ORIGIN OVERHEAD TAG (3D Pyramid ▼ + [Name] + HP Bar + LV 56)
      // Matches maxresdefault.jpg!
      // ----------------------------------------------------------------------
      const tagY = screenPos.y - drawH * (useToSRig ? 1.04 : 0.86);
      const barW = 68;
      const barH = 7;

      // 3D Inverted Pyramid Marker (▼) above player
      ctx.save();
      const pyY = tagY - 22;
      ctx.beginPath();
      ctx.moveTo(screenPos.x, pyY + 9);
      ctx.lineTo(screenPos.x - 7, pyY);
      ctx.lineTo(screenPos.x + 7, pyY);
      ctx.closePath();
      ctx.fillStyle = isLocal ? '#4ade80' : (pl.heroId === 'cyborg' ? '#38bdf8' : '#f97316');
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      // Bracketed Player Name ([Peso Happiness] / [IEJoey])
      ctx.font = '800 11.5px "Kanit", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#090d16';
      const displayName = `[${pl.name}]`;
      ctx.strokeText(displayName, screenPos.x, tagY - 4);
      ctx.fillStyle = isLocal ? '#4ade80' : (pl.heroId === 'cyborg' ? '#38bdf8' : '#f87171');
      ctx.fillText(displayName, screenPos.x, tagY - 4);

      // Rounded HP Bar
      ctx.fillStyle = '#090d16';
      ctx.fillRect(screenPos.x - barW * 0.5 - 1, tagY - 1, barW + 2, barH + 2);
      const hpRatio = Math.max(0, Math.min(1, pl.hp / pl.maxHp));
      ctx.fillStyle = isLocal ? '#22c55e' : (pl.heroId === 'cyborg' ? '#38bdf8' : '#ef4444');
      ctx.fillRect(screenPos.x - barW * 0.5, tagY, Math.round(barW * hpRatio), barH);

      // Mobility / Flight Energy Gauge Bar directly beneath HP Bar (Clean bar, no status text clutter!)
      const mobY = tagY + barH + 2;
      const mobH = 4;
      const mobRatio = Math.max(0, Math.min(1, (pl.mobilityGauge ?? 100) / (pl.maxMobilityGauge || 100)));
      ctx.fillStyle = '#090d16';
      ctx.fillRect(screenPos.x - barW * 0.5 - 1, mobY - 1, barW + 2, mobH + 2);
      ctx.fillStyle = pl.isFlying ? '#fde047' : (pl.isDashing || pl.isSprinting ? '#38bdf8' : '#0ea5e9');
      ctx.fillRect(screenPos.x - barW * 0.5, mobY, Math.round(barW * mobRatio), mobH);
      ctx.restore();
    }

    drawDroppedGear(g, screenPos, map, timeSec) {
      const ctx = this.ctx;
      const hero = GAME_DATA.HEROES[g.heroId] || GAME_DATA.HEROES.knight;
      const bob = Math.sin(timeSec * 5 + g.x) * 5;
      const icon = this.getGearDropSprite(g.slot, g.heroId);
      const sz = Math.round(30 * screenPos.scale);

      const floorInfo = this.getFloorUnder(g.x, g.z, g.y + 0.3, map);
      const sp = this.project(g.x, (floorInfo.onPlatform ? floorInfo.floorY : -4.2) + 0.02, g.z);
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.scale(1, this.isoTilt);
      ctx.beginPath();
      ctx.arc(0, 0, 13 * sp.scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
      ctx.fill();
      ctx.strokeStyle = hero.accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      const drewPng = this.tosRig && this.tosRig.drawDroppedGearIcon(
        ctx,
        g.slot,
        g.heroId,
        screenPos.x,
        screenPos.y - sz * 0.58 + bob,
        sz * 1.38
      );
      if (!drewPng) {
        const icon = this.getGearDropSprite(g.slot, g.heroId);
        ctx.drawImage(icon, Math.round(screenPos.x - sz * 0.5 + 2), Math.round(screenPos.y - sz + bob + 2), sz, sz);
        ctx.drawImage(icon, Math.round(screenPos.x - sz * 0.5), Math.round(screenPos.y - sz + bob), sz, sz);
      }

      const slotName = GAME_DATA.GEAR_SLOT_LABELS[g.slot]?.th.split(' ')[0] || g.slot;
      ctx.font = '700 11px "Kanit", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f172a';
      const label = `[${slotName}] ${hero.nameTh}`;
      ctx.strokeText(label, screenPos.x, screenPos.y - sz + bob - 4);
      ctx.fillStyle = hero.accentColor;
      ctx.fillText(label, screenPos.x, screenPos.y - sz + bob - 4);
    }

    drawProjectile(pr, screenPos, map, timeSec) {
      if (this.tosVfx) {
        this.tosVfx.drawProjectile(this.ctx, this, pr, screenPos, map, timeSec);
        return;
      }
      const ctx = this.ctx;
      const sz = Math.max(8, Math.round((pr.radius || 0.7) * 18 * screenPos.scale));

      const floorInfo = this.getFloorUnder(pr.x, pr.z, pr.y, map);
      if (floorInfo.onPlatform) {
        const sp = this.project(pr.x, floorInfo.floorY + 0.02, pr.z);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
        ctx.fillRect(sp.x - sz * 0.4, sp.y - 2, sz * 0.8, 4);
      }

      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);
      if (pr.type === 'shuriken' || pr.type === 'boomerang_axe') {
        ctx.rotate(timeSec * 18);
      }
      ctx.fillStyle = pr.color || '#fbbf24';
      ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-sz * 0.25, -sz * 0.25, sz * 0.5, sz * 0.5);
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // DRAW ACTIVE 3D SKILL EFFECTS (Including Giga Suit Diagonal Aerial Laser Beam!)
    // ------------------------------------------------------------------------
    drawActiveFx(now) {
      const ctx = this.ctx;
      for (let i = this.activeFx.length - 1; i >= 0; i--) {
        const fx = this.activeFx[i];
        const age = now - fx.born;
        if (age >= fx.ttl) {
          this.activeFx.splice(i, 1);
          continue;
        }
        const t = age / fx.ttl;
        const p = this.project(fx.x, fx.y, fx.z);

        ctx.save();
        ctx.globalAlpha = 1 - t * 0.85;

        if (fx.type === 'aerial_laser') {
          // Diagonal Cyan Laser Beam from airborne Giga Suit down to target floor tile (no square box!)
          const pTarget = this.project(fx.tx, fx.ty || 0, fx.tz);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pTarget.x, pTarget.y);
          ctx.strokeStyle = 'rgba(14, 165, 233, 0.55)';
          ctx.lineWidth = 34 * (1 - t * 0.4);
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pTarget.x, pTarget.y);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 18 * (1 - t * 0.4);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pTarget.x, pTarget.y);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8 * (1 - t * 0.4);
          ctx.stroke();
        } else if (fx.type === 'lasso' || fx.type === 'iaido_line') {
          const p2 = this.project(fx.tx || fx.x, fx.y, fx.tz || fx.z);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = fx.color || '#fbbf24';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else if (fx.type === 'clash' || fx.type === 'guard_break') {
          const r = (18 + 34 * t) * p.scale;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = fx.color || (fx.type === 'clash' ? '#fef08a' : '#facc15');
          ctx.lineWidth = Math.max(2, 6 * (1 - t));
          ctx.stroke();
          for (let ray = 0; ray < 8; ray++) {
            const ang = (ray / 8) * Math.PI * 2 + t * 0.4;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(ang) * r * 0.35, p.y + Math.sin(ang) * r * 0.35);
            ctx.lineTo(p.x + Math.cos(ang) * r * 1.15, p.y + Math.sin(ang) * r * 1.15);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }
  }

  root.PixelRenderer25D = PixelRenderer25D;
})(typeof self !== 'undefined' ? self : this);
