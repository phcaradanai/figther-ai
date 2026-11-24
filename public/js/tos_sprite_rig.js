// ============================================================================
// LOST SAGA 2.5D - TREE OF SAVIOR STYLE MODULAR PAPER-DOLL CHIBI RIG (v2)
// ============================================================================
// Smooth 60 FPS Tree-of-Savior Animation Engine:
// - Per-player exponential pose blending (zero frame snapping!)
// - Real 3-phase Attack Keyframes (Anticipation -> Snap/Recoil -> Follow-through)
// - Landing Squash & Stretch + Footstep/Landing Watercolor Dust hooks
// - Translucent Hero-Tinted Dash / Skill / Spin Ghost Afterimages
// - Desperado Cowboy Signature Dual-Pistol Quickdraw, Recoil & 360° Spin Barrage!
// - Full Cross-Hero Modular Gear Swapping (Weapon, Armor, Helmet, Trinket)
// ============================================================================
(function (root) {
  const HERO_IDS = [
    'knight', 'ninja', 'mage', 'cowboy', 'samurai',
    'witch', 'cyborg', 'viking', 'striker', 'reaper'
  ];

  const HERO_META = {
    knight: {
      hairMain: '#d9a44e', hairDark: '#8c5d23', hairHi: '#f8df9c', hairStyle: 'short',
      sleeve: '#2d58a8', sleeveDark: '#1c356b', trim: '#e5b94c',
      boot: '#3c4a66', bootSole: '#252936', glove: '#d9d4c7',
      glowColor: '#60a5fa',
      headScale: 1.0, headOy: 0,
      armorScale: 1.02, armorOy: 2,
      helmet: { ox: -3, oy: -20, scale: 1.04, mode: 'top' },
      weapon: { gripX: 0.50, gripY: 0.80, targetH: 64, baseAngle: 0.12, offhand: 'shield', style: 'heavy_melee' },
      trinket: { ox: -14, oy: 12, scale: 1.12, sway: 0.14 }
    },
    ninja: {
      hairMain: '#2d2842', hairDark: '#171426', hairHi: '#595080', hairStyle: 'spiky',
      sleeve: '#2a243d', sleeveDark: '#161224', trim: '#8b5cf6',
      boot: '#272336', bootSole: '#12101a', glove: '#2c2540',
      glowColor: '#a855f7',
      headScale: 1.02, headOy: 0,
      armorScale: 1.0, armorOy: 2,
      helmet: { ox: -7, oy: -5, scale: 1.08, mode: 'band' },
      weapon: { gripX: 0.48, gripY: 0.78, targetH: 42, baseAngle: 0.22, offhand: 'kunai', style: 'fast_melee' },
      trinket: { ox: -10, oy: 4, scale: 0.98, sway: 0.10 }
    },
    mage: {
      hairMain: '#a64d32', hairDark: '#662818', hairHi: '#de8764', hairStyle: 'wavy',
      sleeve: '#9e262e', sleeveDark: '#5e1318', trim: '#e5b84b',
      boot: '#5c2620', bootSole: '#2e1210', glove: '#f5d8c0',
      glowColor: '#fb923c',
      headScale: 1.02, headOy: 1,
      armorScale: 1.06, armorOy: 3,
      helmet: { ox: -3, oy: -22, scale: 1.24, mode: 'top' },
      weapon: { gripX: 0.50, gripY: 0.65, targetH: 68, baseAngle: 0.10, offhand: null, style: 'caster' },
      trinket: { ox: -2, oy: -12, scale: 1.12, sway: 0.08, isFloatingOrbs: true }
    },
    cowboy: {
      hairMain: '#805336', hairDark: '#4d2e1b', hairHi: '#b5845e', hairStyle: 'wavy',
      sleeve: '#e6d8be', sleeveDark: '#a89270', trim: '#b87a3b',
      boot: '#6b4226', bootSole: '#331d10', glove: '#7a4d2c',
      glowColor: '#fbbf24',
      headScale: 1.02, headOy: 1,
      armorScale: 1.04, armorOy: 2,
      helmet: { ox: -2, oy: -19, scale: 1.22, mode: 'top' },
      weapon: { gripX: 0.34, gripY: 0.76, targetH: 42, baseAngle: 1.15, offhand: 'revolver', style: 'gunslinger' },
      trinket: { ox: -13, oy: 10, scale: 0.96, sway: 0.20 }
    },
    samurai: {
      hairMain: '#24232b', hairDark: '#121117', hairHi: '#4f4e5c', hairStyle: 'bun',
      sleeve: '#3a3034', sleeveDark: '#1f181b', trim: '#b82830',
      boot: '#382a2a', bootSole: '#1c1515', glove: '#403438',
      glowColor: '#f87171',
      headScale: 1.04, headOy: -1,
      armorScale: 1.02, armorOy: 2,
      helmet: { ox: -2, oy: -17, scale: 1.14, mode: 'top' },
      weapon: { gripX: 0.48, gripY: 0.80, targetH: 74, baseAngle: 0.14, offhand: null, style: 'fast_melee' },
      trinket: { ox: -8, oy: 18, scale: 0.92, sway: 0.09 }
    },
    witch: {
      hairMain: '#e8e4d5', hairDark: '#a8b5c2', hairHi: '#ffffff', hairStyle: 'long',
      sleeve: '#233b5c', sleeveDark: '#142338', trim: '#9be7f5',
      boot: '#2c415e', bootSole: '#182436', glove: '#e6f4f8',
      glowColor: '#67e8f9',
      headScale: 1.05, headOy: 2,
      armorScale: 1.08, armorOy: 4,
      helmet: { ox: 1, oy: -17, scale: 0.94, mode: 'top' },
      weapon: { gripX: 0.50, gripY: 0.74, targetH: 60, baseAngle: 0.12, offhand: null, style: 'caster' },
      trinket: { ox: -10, oy: -2, scale: 1.18, sway: 0.15, isWings: true }
    },
    cyborg: {
      hairMain: '#cfdbe3', hairDark: '#7c94a6', hairHi: '#f4fbff', hairStyle: 'short',
      sleeve: '#ebe5dc', sleeveDark: '#b3a799', trim: '#d9682b',
      boot: '#d6cfc4', bootSole: '#4a433d', glove: '#d9682b',
      glowColor: '#38bdf8',
      headScale: 1.0, headOy: 0,
      armorScale: 1.02, armorOy: 2,
      helmet: { ox: -2, oy: -4, scale: 1.12, mode: 'full' },
      weapon: { gripX: 0.42, gripY: 0.78, targetH: 48, baseAngle: 1.18, offhand: null, style: 'gunner' },
      trinket: { ox: -10, oy: -3, scale: 1.15, sway: 0.11, isWings: true, isThruster: true }
    },
    viking: {
      hairMain: '#c96b2c', hairDark: '#7d3912', hairHi: '#f2a863', hairStyle: 'braid',
      sleeve: '#70492e', sleeveDark: '#422816', trim: '#c7a47b',
      boot: '#5c3a21', bootSole: '#2b190d', glove: '#6e472b',
      glowColor: '#fb923c',
      headScale: 1.04, headOy: 1,
      armorScale: 1.04, armorOy: 2,
      helmet: { ox: -1, oy: -17, scale: 1.10, mode: 'top' },
      weapon: { gripX: 0.50, gripY: 0.74, targetH: 60, baseAngle: 0.15, offhand: 'axe', style: 'heavy_melee' },
      trinket: { ox: -8, oy: 10, scale: 1.04, sway: 0.12 }
    },
    striker: {
      hairMain: '#4f3322', hairDark: '#2b1a10', hairHi: '#855c42', hairStyle: 'spiky',
      sleeve: '#e6b83c', sleeveDark: '#a67617', trim: '#c9302c',
      boot: '#a62929', bootSole: '#4a1818', glove: '#d99e32',
      glowColor: '#fde047',
      headScale: 1.02, headOy: -1,
      armorScale: 1.02, armorOy: 2,
      helmet: { ox: -4, oy: -13, scale: 1.06, mode: 'top' },
      weapon: { gripX: 0.50, gripY: 0.62, targetH: 26, baseAngle: 0.45, offhand: 'gauntlet', style: 'fast_melee' },
      trinket: { ox: -14, oy: 14, scale: 1.00, sway: 0.22 }
    },
    reaper: {
      hairMain: '#ccc7cf', hairDark: '#827b8c', hairHi: '#f5f2f7', hairStyle: 'long',
      sleeve: '#3e2954', sleeveDark: '#20132e', trim: '#b4a7c7',
      boot: '#2c1f3b', bootSole: '#130c1c', glove: '#2b1d3b',
      glowColor: '#e879f9',
      headScale: 1.04, headOy: 2,
      armorScale: 1.08, armorOy: 4,
      helmet: { ox: -2, oy: -7, scale: 1.16, mode: 'hood' },
      weapon: { gripX: 0.42, gripY: 0.62, targetH: 76, baseAngle: 0.14, offhand: null, style: 'heavy_melee' },
      trinket: { ox: -10, oy: -2, scale: 1.18, sway: 0.16, isWings: true }
    }
  };

  const DEFAULT_UNARMORED = {
    sleeve: '#d9cdb8', sleeveDark: '#9e8f75', trim: '#8a6946',
    boot: '#694a30', bootSole: '#362314', glove: '#f5d7be'
  };

  const SKIN_LIGHT = '#fce4d2';
  const SKIN_SHADE = '#e6b79c';
  const OUTLINE_WARM = '#3b241c';

  function damp(cur, target, speed, dt) {
    return cur + (target - cur) * (1 - Math.exp(-speed * dt));
  }

  class ToSSpriteRig {
    constructor() {
      this.images = { head: {}, armor: {}, helmet: {}, weapon: {}, trinket: {} };
      this.animStates = new Map(); // playerId -> smooth pose & afterimages
      this.loadedCount = 0;
      this.totalCount = 0;
      this.ready = false;
      this.preloadAll();
    }

    preloadAll() {
      const slots = ['head', 'armor', 'helmet', 'weapon', 'trinket'];
      for (const slot of slots) {
        for (const heroId of HERO_IDS) {
          this.loadOne(slot, heroId, `/assets/tos/${slot}/${heroId}.png`);
        }
      }
      this.loadOne('weapon', 'ninja_offhand', '/assets/tos/weapon/ninja_offhand.png');
    }

    loadOne(slot, key, url) {
      this.totalCount++;
      const img = new Image();
      img.onload = () => {
        this.loadedCount++;
        if (this.loadedCount >= this.totalCount) this.ready = true;
      };
      img.onerror = () => { this.loadedCount++; };
      img.src = url;
      this.images[slot][key] = img;
    }

    getImg(slot, key) {
      const img = this.images[slot] && this.images[slot][key];
      if (img && img.complete && img.naturalWidth > 0) return img;
      return null;
    }

    getAnimState(pl, timeSec) {
      const id = pl.id || 'local';
      let st = this.animStates.get(id);
      if (!st) {
        let phaseSeed = 0;
        const s = String(id);
        for (let i = 0; i < s.length; i++) phaseSeed += s.charCodeAt(i) * 0.37;
        st = {
          phaseSeed,
          lastTime: timeSec,
          lastState: pl.state,
          lastCombo: pl.comboStep || 0,
          stateStart: timeSec,
          wasAirborne: false,
          squashX: 1, squashY: 1,
          hipX: 0, hipY: -27,
          torsoRot: 0.04, headRot: 0, headBobY: 0,
          bLegAng: -0.18, bKneeAng: -0.08,
          fLegAng: 0.22, fKneeAng: 0.06,
          bArmAng: -0.32, bForeAng: 0.25,
          fArmAng: 0.32, fForeAng: 0.90,
          weaponExtra: 0, offhandExtra: 0,
          capeSway: 0, wingFlap: 0,
          spinAngle: 0,
          muzzleFlash: 0,
          offMuzzleFlash: 0,
          lastGhostTime: 0,
          lastDustTime: 0,
          afterimages: []
        };
        this.animStates.set(id, st);
      }
      return st;
    }

    drawPart(ctx, img, x, y, targetH, anchorX = 0.5, anchorY = 0.5, rot = 0, scaleX = 1, scaleY = 1) {
      if (!img) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      const dh = targetH;
      const dw = targetH * ratio;
      ctx.save();
      ctx.translate(x, y);
      if (rot !== 0) ctx.rotate(rot);
      if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
      ctx.drawImage(img, -dw * anchorX, -dh * anchorY, dw, dh);
      ctx.restore();
    }

    // Painterly storybook rounded limb with warm watercolor shading & soft highlight
    drawPainterlyLimb(ctx, x1, y1, x2, y2, w1, w2, fillMain, fillDark, cuffColor = null) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.max(0.5, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(x1, y1);
      ctx.rotate(ang);

      ctx.beginPath();
      ctx.moveTo(0, -w1 * 0.5);
      ctx.lineTo(len, -w2 * 0.5);
      ctx.arc(len, 0, w2 * 0.5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.lineTo(0, w1 * 0.5);
      ctx.arc(0, 0, w1 * 0.5, Math.PI * 0.5, -Math.PI * 0.5);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, -w1 * 0.55, 0, w1 * 0.55);
      grad.addColorStop(0, fillMain);
      grad.addColorStop(0.58, fillMain);
      grad.addColorStop(1, fillDark);
      ctx.fillStyle = grad;
      ctx.fill();

      // Delicate warm top-edge specular brush stroke
      ctx.beginPath();
      ctx.moveTo(1.5, -w1 * 0.25);
      ctx.lineTo(len - 2, -w2 * 0.24);
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (cuffColor) {
        ctx.fillStyle = cuffColor;
        ctx.fillRect(len - 3.4, -w2 * 0.48, 3.0, w2 * 0.96);
      }

      ctx.lineWidth = 1.55;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    drawPainterlyBoot(ctx, x, y, rot, bootColor, soleColor, trimColor, isBackLimb) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      ctx.beginPath();
      ctx.moveTo(-4.5, -4);
      ctx.lineTo(4.5, -4);
      ctx.quadraticCurveTo(9.8, -2.2, 9.6, 2.3);
      ctx.quadraticCurveTo(9.0, 5.2, 4.5, 5.3);
      ctx.lineTo(-4.8, 5.0);
      ctx.quadraticCurveTo(-6.2, 2.5, -4.5, -4);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, -4, 0, 5);
      grad.addColorStop(0, bootColor);
      grad.addColorStop(0.68, soleColor);
      grad.addColorStop(1, soleColor);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.fillStyle = trimColor;
      ctx.fillRect(-4.5, -4.5, 9.0, 2.4);

      if (isBackLimb) {
        ctx.fillStyle = 'rgba(25, 15, 20, 0.20)';
        ctx.fill();
      }

      ctx.lineWidth = 1.55;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.stroke();
      ctx.restore();
    }

    drawPainterlyHand(ctx, x, y, r, color) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
      g.addColorStop(0, color === SKIN_LIGHT ? SKIN_LIGHT : color);
      g.addColorStop(1, color === SKIN_LIGHT ? SKIN_SHADE : OUTLINE_WARM);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.45;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.stroke();
      ctx.restore();
    }

    drawBaseAdventurerTunic(ctx, x, y, leanRot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(leanRot);

      ctx.beginPath();
      ctx.moveTo(-11, -15);
      ctx.quadraticCurveTo(0, -18, 11, -15);
      ctx.lineTo(15, 13);
      ctx.quadraticCurveTo(0, 17, -15, 13);
      ctx.closePath();

      const g = ctx.createLinearGradient(-12, -16, 12, 15);
      g.addColorStop(0, '#f0e6d2');
      g.addColorStop(0.6, '#d9c7a7');
      g.addColorStop(1, '#ad9572');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.stroke();

      ctx.fillStyle = '#7c4f2d';
      ctx.fillRect(-12, 1, 24, 5);
      ctx.strokeRect(-12, 1, 24, 5);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-2.5, 0.5, 6, 6);
      ctx.strokeRect(-2.5, 0.5, 6, 6);
      ctx.restore();
    }

    drawOffhandShield(ctx, x, y, rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-10, -13);
      ctx.quadraticCurveTo(0, -16, 10, -13);
      ctx.lineTo(9, 4);
      ctx.quadraticCurveTo(0, 16, 0, 16);
      ctx.quadraticCurveTo(-9, 4, -9, 4);
      ctx.closePath();
      const g = ctx.createLinearGradient(-10, -14, 10, 14);
      g.addColorStop(0, '#4f7de0');
      g.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#e5b84b';
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-4.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Painterly inline starburst muzzle flash at gun barrel tip!
    drawGunMuzzleBurst(ctx, x, y, intensity) {
      if (intensity <= 0.04) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = 'lighter';
      const r = 18 * intensity;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.3);
      g.addColorStop(0, `rgba(255, 255, 240, ${intensity})`);
      g.addColorStop(0.4, `rgba(253, 224, 71, ${intensity * 0.85})`);
      g.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 254, 235, ${intensity})`;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2 + 0.3);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.16);
        ctx.lineTo(r * 1.25, 0);
        ctx.lineTo(0, r * 0.16);
        ctx.lineTo(-r * 0.3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Styled hero-specific painterly back-of-head hair silhouette (used on Up-Back & 360° spins!)
    drawBackHairHead(ctx, x, y, rot, meta) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // Long flowing hair extension behind neck for long/wavy/braid styles
      if (meta.hairStyle === 'long' || meta.hairStyle === 'wavy') {
        ctx.beginPath();
        ctx.moveTo(-20, -4);
        ctx.quadraticCurveTo(-23, 18, -14, 24);
        ctx.quadraticCurveTo(0, 27, 14, 24);
        ctx.quadraticCurveTo(23, 18, 20, -4);
        ctx.closePath();
        const lg = ctx.createLinearGradient(0, -4, 0, 26);
        lg.addColorStop(0, meta.hairMain);
        lg.addColorStop(1, meta.hairDark);
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = OUTLINE_WARM;
        ctx.stroke();
      } else if (meta.hairStyle === 'braid') {
        ctx.beginPath();
        ctx.ellipse(-4, 18, 6.5, 13, 0.25, 0, Math.PI * 2);
        ctx.fillStyle = meta.hairMain;
        ctx.fill();
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = OUTLINE_WARM;
        ctx.stroke();
      } else if (meta.hairStyle === 'bun') {
        ctx.beginPath();
        ctx.arc(0, -21, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = meta.hairMain;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = OUTLINE_WARM;
        ctx.stroke();
      }

      // Main chibi cranium hair dome
      ctx.beginPath();
      ctx.arc(0, -2, 22, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-5, -10, 4, 0, 0, 24);
      g.addColorStop(0, meta.hairHi);
      g.addColorStop(0.55, meta.hairMain);
      g.addColorStop(1, meta.hairDark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.9;
      ctx.strokeStyle = OUTLINE_WARM;
      ctx.stroke();

      // Painterly anime halo highlight arc across crown
      ctx.beginPath();
      ctx.arc(0, -4, 15, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.strokeStyle = meta.hairHi;
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // UPDATE SMOOTH 60FPS ANIMATION + DRAW AFTERIMAGES + DRAW CHARACTER
    // ------------------------------------------------------------------------
    drawCharacter(ctx, pl, dirOctant, timeSec, scale = 1.0, isAirborne = false, renderer = null) {
      const heroId = HERO_META[pl.heroId] ? pl.heroId : 'knight';
      const heroMeta = HERO_META[heroId];
      const g = pl.gear || pl.gears || { weapon: heroId, armor: heroId, helmet: heroId, trinket: heroId };

      const st = this.getAnimState(pl, timeSec);
      const dt = Math.min(0.05, Math.max(0.001, timeSec - st.lastTime));
      st.lastTime = timeSec;

      // Detect state or combo transitions to kick off crisp 3-phase keyframe curves!
      const comboStep = ((pl.comboStep || 1) - 1) % 4 + 1;
      const stateChanged = (pl.state !== st.lastState) || (pl.state === 'attack' && comboStep !== st.lastCombo);
      if (stateChanged) {
        st.stateStart = timeSec;
        st.lastState = pl.state;
        st.lastCombo = comboStep;

        // Instant punchy squash/stretch & muzzle trigger on attack start
        if (pl.state === 'attack' || pl.state === 'heavy' || pl.state === 'skill') {
          st.squashX = 1.10;
          st.squashY = 0.92;
          const isGunHero = (g.weapon === 'cowboy' || g.weapon === 'cyborg');
          if (isGunHero) {
            st.muzzleFlash = 1.0;
            if (g.weapon === 'cowboy' && (comboStep >= 2 || pl.state === 'skill' || pl.state === 'heavy')) {
              st.offMuzzleFlash = 1.0;
            }
          }
        }
      }

      // Detect Landing Squash & Takeoff Stretch + Watercolor Dust!
      if (st.wasAirborne && !isAirborne) {
        st.squashX = 1.18;
        st.squashY = 0.84;
        if (renderer && renderer.tosVfx) {
          renderer.tosVfx.spawnDust(pl.x, pl.y, pl.z, 5, '#f5ebd8', 1.8);
        }
      } else if (!st.wasAirborne && isAirborne) {
        st.squashX = 0.88;
        st.squashY = 1.14;
        if (renderer && renderer.tosVfx) {
          renderer.tosVfx.spawnDust(pl.x, pl.y, pl.z, 3, '#f5ebd8', 1.2);
        }
      }
      st.wasAirborne = isAirborne;

      // Spring squash & stretch smoothly back to (1, 1)
      st.squashX = damp(st.squashX, 1.0, 14, dt);
      st.squashY = damp(st.squashY, 1.0, 14, dt);
      st.muzzleFlash = Math.max(0, st.muzzleFlash - dt * 7.5);
      st.offMuzzleFlash = Math.max(0, st.offMuzzleFlash - dt * 7.5);

      const stateAge = Math.max(0, timeSec - st.stateStart);
      const t = timeSec + st.phaseSeed;
      const breath = Math.sin(t * 3.8);
      const runPhase = t * 15.2;

      const isRun = pl.state === 'run' && !isAirborne;
      const isDash = !!pl.isDashing;
      const isFly = !!pl.isFlying;
      const isAttack = pl.state === 'attack';
      const isHeavy = pl.state === 'heavy';
      const isSkill = pl.state === 'skill';
      const isGuard = !!pl.guarding;
      const isHurt = pl.state === 'hurt' || pl.state === 'frozen';

      // Running footstep dust clouds!
      if ((isRun || isDash) && !isAirborne && renderer && renderer.tosVfx) {
        const interval = isDash ? 0.065 : 0.19;
        if (timeSec - st.lastDustTime > interval) {
          st.lastDustTime = timeSec;
          renderer.tosVfx.spawnDust(pl.x, pl.y, pl.z, isDash ? 3 : 2, '#f5ebd8', isDash ? 1.5 : 0.8);
        }
      }

      // ----------------------------------------------------------------------
      // 1. TARGET POSE SOLVER (WITH 3-PHASE ANTICIPATION / STRIKE / RECOVERY!)
      // ----------------------------------------------------------------------
      const wStyle = (g.weapon && HERO_META[g.weapon]) ? HERO_META[g.weapon].weapon.style : 'fast_melee';
      let tgt = {
        hipX: 0, hipY: -27, torsoRot: 0.04, headRot: 0, headBobY: breath * 1.4,
        bLegAng: -0.20, bKneeAng: -0.08, fLegAng: 0.24, fKneeAng: 0.05,
        bArmAng: -0.32, bForeAng: 0.28, fArmAng: 0.32, fForeAng: 0.92,
        weaponExtra: 0, offhandExtra: 0, capeSway: Math.sin(t * 4.2) * 0.08,
        wingFlap: Math.sin(t * 6.5) * 0.14
      };

      let targetSpin = 0;
      let poseBlendSpeed = 16;
      let showSlash = false;
      let slashType = 'horizontal';
      let slashColor = heroMeta.glowColor;

      if (isDash) {
        poseBlendSpeed = 22;
        tgt.hipX = 6; tgt.hipY = isAirborne ? -34 : -25;
        tgt.torsoRot = 0.44; tgt.headRot = -0.20;
        tgt.bLegAng = -0.98; tgt.bKneeAng = -1.30;
        tgt.fLegAng = 0.82;  tgt.fKneeAng = 0.12;
        tgt.bArmAng = wStyle === 'gunslinger' ? -0.95 : -1.15;
        tgt.bForeAng = wStyle === 'gunslinger' ? -0.45 : -0.95;
        tgt.fArmAng = wStyle === 'gunslinger' ? 1.25 : 1.05;
        tgt.fForeAng = wStyle === 'gunslinger' ? 1.50 : 1.25;
        tgt.capeSway = 0.46 + Math.sin(t * 24) * 0.10;
        tgt.wingFlap = 0.34;
        showSlash = true;
        slashType = 'dash';
      } else if (isAttack) {
        poseBlendSpeed = 30;
        // 3-phase animation envelope: windUp (0..0.055s) -> snapStrike (0.055..0.18s) -> followThrough
        const windUp = stateAge < 0.055;
        const strikeT = Math.min(1, Math.max(0, (stateAge - 0.05) / 0.16));
        const recoil = Math.exp(-stateAge * 14);
        showSlash = !windUp && stateAge < 0.24;

        if (wStyle === 'gunslinger') {
          // DESPERADO COWBOY SIGNATURE TREE-OF-SAVIOR DUAL-PISTOL CHOREOGRAPHY!
          if (comboStep === 1) {
            // Quickdraw right-hand forward shot + crisp recoil snap
            tgt.hipX = 5 - recoil * 2; tgt.hipY = -26;
            tgt.torsoRot = 0.24 - recoil * 0.14; tgt.headRot = -0.10;
            tgt.bLegAng = -0.58; tgt.bKneeAng = -0.68;
            tgt.fLegAng = 0.62;  tgt.fKneeAng = 0.10;
            tgt.bArmAng = -0.55; tgt.bForeAng = 0.20;
            tgt.fArmAng = 1.48;  tgt.fForeAng = 1.56 + recoil * 0.35;
            tgt.weaponExtra = -recoil * 0.45;
            slashType = 'gunshot';
          } else if (comboStep === 2) {
            // Cross-body twin-pistol alternate burst
            tgt.hipX = 3; tgt.hipY = -27;
            tgt.torsoRot = -0.10 - recoil * 0.10; tgt.headRot = 0.06;
            tgt.bLegAng = -0.40; tgt.bKneeAng = -0.45;
            tgt.fLegAng = 0.55;  tgt.fKneeAng = 0.05;
            tgt.bArmAng = 1.45;  tgt.bForeAng = 1.62 + recoil * 0.4;
            tgt.fArmAng = 0.85;  tgt.fForeAng = 1.35 - recoil * 0.2;
            tgt.offhandExtra = -recoil * 0.5;
            slashType = 'gunshot';
          } else if (comboStep === 3) {
            // DESPERADO 360° SPINNING DUAL-GUN WHIRLWIND BARRAGE!!
            targetSpin = Math.min(Math.PI * 2, stateAge * 24);
            tgt.hipX = 0; tgt.hipY = -32;
            tgt.torsoRot = 0.10; tgt.headRot = 0;
            tgt.bLegAng = -0.45; tgt.bKneeAng = -0.80;
            tgt.fLegAng = 0.55;  tgt.fKneeAng = -0.20;
            tgt.bArmAng = -1.45; tgt.bForeAng = -1.52;
            tgt.fArmAng = 1.45;  tgt.fForeAng = 1.52;
            tgt.capeSway = 0.48;
            if (stateAge < 0.24) {
              st.muzzleFlash = 0.6 + 0.4 * Math.abs(Math.sin(stateAge * 45));
              st.offMuzzleFlash = 0.6 + 0.4 * Math.abs(Math.cos(stateAge * 45));
            }
            slashType = 'spin_guns';
          } else {
            // Low Sliding Akimbo Finisher Burst!
            tgt.hipX = 8; tgt.hipY = -22;
            tgt.torsoRot = 0.36 - recoil * 0.12; tgt.headRot = -0.18;
            tgt.bLegAng = -0.90; tgt.bKneeAng = -1.15;
            tgt.fLegAng = 0.92;  tgt.fKneeAng = 0.45;
            tgt.bArmAng = 1.35;  tgt.bForeAng = 1.55 + recoil * 0.35;
            tgt.fArmAng = 1.52;  tgt.fForeAng = 1.60 + recoil * 0.40;
            tgt.weaponExtra = -recoil * 0.48;
            tgt.capeSway = 0.42;
            slashType = 'finisher';
          }
        } else {
          // MELEE / CASTER 3-PHASE KEYFRAME COMBO CURVES
          if (comboStep === 1) {
            tgt.hipX = windUp ? -3 : 6; tgt.hipY = -26;
            tgt.torsoRot = windUp ? -0.18 : 0.32; tgt.headRot = -0.10;
            tgt.bLegAng = -0.62; tgt.bKneeAng = -0.75;
            tgt.fLegAng = 0.68;  tgt.fKneeAng = 0.12;
            tgt.bArmAng = -0.70; tgt.bForeAng = -0.35;
            tgt.fArmAng = windUp ? 2.45 : (1.25 - strikeT * 0.45);
            tgt.fForeAng = windUp ? 2.65 : (1.55 - strikeT * 0.55);
            tgt.weaponExtra = windUp ? -0.55 : (0.55 + strikeT * 0.35);
            slashType = 'horizontal';
          } else if (comboStep === 2) {
            tgt.hipX = windUp ? 0 : 4; tgt.hipY = -30;
            tgt.torsoRot = windUp ? 0.22 : -0.14; tgt.headRot = 0.05;
            tgt.bLegAng = -0.35; tgt.bKneeAng = -0.30;
            tgt.fLegAng = 0.48;  tgt.fKneeAng = 0.12;
            tgt.bArmAng = 0.85;  tgt.bForeAng = 1.45;
            tgt.fArmAng = windUp ? 0.45 : 2.15;
            tgt.fForeAng = windUp ? 0.55 : 2.55;
            tgt.weaponExtra = windUp ? 0.5 : -0.35;
            slashType = 'upper';
          } else if (comboStep === 3) {
            // High Martial Roundhouse / Acrobat Spin Kick
            tgt.hipX = 2; tgt.hipY = -29;
            tgt.torsoRot = -0.28; tgt.headRot = 0.14;
            tgt.bLegAng = -0.15; tgt.bKneeAng = -0.10;
            tgt.fLegAng = windUp ? 0.65 : 1.72;
            tgt.fKneeAng = windUp ? -0.50 : 1.62;
            tgt.bArmAng = -0.85; tgt.bForeAng = -0.45;
            tgt.fArmAng = 0.95;  tgt.fForeAng = 1.25;
            slashType = 'kick';
          } else {
            // Lunging Finisher Cleave
            tgt.hipX = windUp ? -4 : 8; tgt.hipY = -25;
            tgt.torsoRot = windUp ? -0.25 : 0.42; tgt.headRot = -0.16;
            tgt.bLegAng = -0.84; tgt.bKneeAng = -0.96;
            tgt.fLegAng = 0.84;  tgt.fKneeAng = 0.18;
            tgt.bArmAng = 1.15;  tgt.bForeAng = 1.30;
            tgt.fArmAng = windUp ? 2.65 : 1.35;
            tgt.fForeAng = windUp ? 2.85 : 1.50;
            tgt.weaponExtra = windUp ? -0.65 : 0.72;
            slashType = 'finisher';
          }
          tgt.capeSway = 0.30;
        }
      } else if (isHeavy) {
        poseBlendSpeed = 24;
        const windUp = stateAge < 0.09;
        showSlash = !windUp;
        slashType = 'heavy';
        slashColor = '#fde047';
        tgt.hipX = windUp ? -4 : 7; tgt.hipY = windUp ? -30 : -24;
        tgt.torsoRot = windUp ? -0.26 : 0.38; tgt.headRot = -0.12;
        tgt.bLegAng = -0.78; tgt.bKneeAng = -0.88;
        tgt.fLegAng = 0.80;  tgt.fKneeAng = 0.14;
        tgt.bArmAng = windUp ? 2.4 : 1.55; tgt.bForeAng = windUp ? 2.6 : 1.40;
        tgt.fArmAng = windUp ? 2.55 : 1.68; tgt.fForeAng = windUp ? 2.75 : 1.45;
        tgt.weaponExtra = windUp ? -0.65 : 0.62;
        tgt.capeSway = 0.38;
      } else if (isSkill) {
        poseBlendSpeed = 24;
        showSlash = true;
        slashType = wStyle === 'gunslinger' ? 'spin_guns' : 'skill';
        slashColor = heroMeta.glowColor;
        if (wStyle === 'gunslinger') {
          // Desperado Skill: High-speed Bullet Storm Spin!
          targetSpin = (stateAge * 20) % (Math.PI * 2);
          tgt.hipY = -33;
          tgt.torsoRot = 0.15;
          tgt.bArmAng = -1.45; tgt.bForeAng = -1.55;
          tgt.fArmAng = 1.45;  tgt.fForeAng = 1.55;
          st.muzzleFlash = 0.65 + 0.35 * Math.abs(Math.sin(t * 40));
          st.offMuzzleFlash = 0.65 + 0.35 * Math.abs(Math.cos(t * 40));
        } else {
          tgt.hipY = -32; tgt.torsoRot = -0.16; tgt.headRot = -0.06;
          tgt.bLegAng = -0.45; tgt.bKneeAng = -0.75;
          tgt.fLegAng = 0.55;  tgt.fKneeAng = -0.25;
          tgt.bArmAng = 2.05;  tgt.bForeAng = 2.35;
          tgt.fArmAng = 1.85;  tgt.fForeAng = 2.05;
        }
        tgt.capeSway = 0.36 + Math.sin(t * 20) * 0.12;
        tgt.wingFlap = Math.sin(t * 20) * 0.35;
      } else if (isGuard) {
        poseBlendSpeed = 22;
        tgt.hipX = -2; tgt.hipY = -24; tgt.torsoRot = 0.16; tgt.headRot = -0.08;
        tgt.bLegAng = -0.45; tgt.bKneeAng = -0.55;
        tgt.fLegAng = 0.55;  tgt.fKneeAng = -0.12;
        tgt.bArmAng = 0.72;  tgt.bForeAng = 2.05;
        tgt.fArmAng = 0.92;  tgt.fForeAng = 2.15;
      } else if (isHurt) {
        poseBlendSpeed = 26;
        tgt.hipX = -6; tgt.hipY = -27; tgt.torsoRot = -0.42; tgt.headRot = -0.24;
        tgt.bLegAng = -0.32; tgt.bKneeAng = -0.68;
        tgt.fLegAng = 0.55;  tgt.fKneeAng = -0.38;
        tgt.bArmAng = -0.88; tgt.bForeAng = -1.28;
        tgt.fArmAng = 0.65;  tgt.fForeAng = 1.78;
        tgt.capeSway = -0.28;
      } else if (isFly) {
        poseBlendSpeed = 14;
        const hover = Math.sin(t * 7.5) * 4.5;
        tgt.hipY = -34 + hover; tgt.torsoRot = 0.18; tgt.headRot = -0.08;
        tgt.bLegAng = -0.35; tgt.bKneeAng = -0.72;
        tgt.fLegAng = 0.45;  tgt.fKneeAng = -0.25;
        tgt.bArmAng = -0.55; tgt.bForeAng = 0.55;
        tgt.fArmAng = 1.15;  tgt.fForeAng = 1.35;
        tgt.capeSway = 0.30 + Math.sin(t * 12) * 0.10;
        tgt.wingFlap = Math.sin(t * 16) * 0.34;
      } else if (isAirborne) {
        poseBlendSpeed = 16;
        tgt.hipY = -32;
        tgt.torsoRot = (pl.jumpCount >= 2) ? 0.28 : 0.14;
        tgt.headRot = -0.06;
        tgt.bLegAng = -0.58; tgt.bKneeAng = -1.12;
        tgt.fLegAng = 0.82;  tgt.fKneeAng = -0.32;
        tgt.bArmAng = -0.65; tgt.bForeAng = -0.15;
        tgt.fArmAng = 1.10;  tgt.fForeAng = 1.55;
        tgt.capeSway = 0.28;
        tgt.wingFlap = 0.26;
      } else if (isRun) {
        poseBlendSpeed = 20;
        const s = Math.sin(runPhase);
        const c = Math.cos(runPhase);
        const bounce = Math.abs(s) * 4.8;
        tgt.hipY = -28 - bounce;
        tgt.torsoRot = 0.24 + c * 0.045;
        tgt.headRot = -0.06 + s * 0.04;
        tgt.headBobY = -bounce * 0.48;
        tgt.bLegAng = s * 0.76;
        tgt.bKneeAng = tgt.bLegAng - Math.max(0, -c) * 0.90 - 0.10;
        tgt.fLegAng = -s * 0.76;
        tgt.fKneeAng = tgt.fLegAng - Math.max(0, c) * 0.90 - 0.10;
        tgt.bArmAng = -s * 0.68;
        tgt.bForeAng = tgt.bArmAng + 0.58;
        tgt.fArmAng = s * 0.60 + 0.25;
        tgt.fForeAng = tgt.fArmAng + 0.68;
        tgt.capeSway = 0.26 + s * 0.14;
        tgt.wingFlap = Math.sin(runPhase) * 0.22;
      } else {
        // Gentle Storybook Idle Breathing Stance
        poseBlendSpeed = 12;
        tgt.hipY = -27 + breath * 1.3;
        tgt.torsoRot = 0.04 + breath * 0.016;
        tgt.headRot = breath * 0.028;
        tgt.bLegAng = -0.20; tgt.bKneeAng = -0.08;
        tgt.fLegAng = 0.24;  tgt.fKneeAng = 0.05;
        tgt.bArmAng = -0.32 + breath * 0.04; tgt.bForeAng = 0.28;
        tgt.fArmAng = 0.32 - breath * 0.05;  tgt.fForeAng = 0.92 + breath * 0.05;
      }

      // Smoothly damp every bone toward target (zero snapping!)
      st.hipX = damp(st.hipX, tgt.hipX, poseBlendSpeed, dt);
      st.hipY = damp(st.hipY, tgt.hipY, poseBlendSpeed, dt);
      st.torsoRot = damp(st.torsoRot, tgt.torsoRot, poseBlendSpeed, dt);
      st.headRot = damp(st.headRot, tgt.headRot, poseBlendSpeed * 0.85, dt);
      st.headBobY = damp(st.headBobY, tgt.headBobY, poseBlendSpeed * 0.85, dt);
      st.bLegAng = damp(st.bLegAng, tgt.bLegAng, poseBlendSpeed, dt);
      st.bKneeAng = damp(st.bKneeAng, tgt.bKneeAng, poseBlendSpeed, dt);
      st.fLegAng = damp(st.fLegAng, tgt.fLegAng, poseBlendSpeed, dt);
      st.fKneeAng = damp(st.fKneeAng, tgt.fKneeAng, poseBlendSpeed, dt);
      st.bArmAng = damp(st.bArmAng, tgt.bArmAng, poseBlendSpeed, dt);
      st.bForeAng = damp(st.bForeAng, tgt.bForeAng, poseBlendSpeed, dt);
      st.fArmAng = damp(st.fArmAng, tgt.fArmAng, poseBlendSpeed, dt);
      st.fForeAng = damp(st.fForeAng, tgt.fForeAng, poseBlendSpeed, dt);
      st.weaponExtra = damp(st.weaponExtra, tgt.weaponExtra, poseBlendSpeed * 1.1, dt);
      st.offhandExtra = damp(st.offhandExtra, tgt.offhandExtra, poseBlendSpeed * 1.1, dt);
      st.capeSway = damp(st.capeSway, tgt.capeSway, 10, dt);
      st.wingFlap = damp(st.wingFlap, tgt.wingFlap, 12, dt);
      st.spinAngle = targetSpin > 0 ? targetSpin : damp(st.spinAngle, 0, 18, dt);

      // Facing Left vs Right + 360° Spin horizontal foreshortening!
      const baseFlipX = (dirOctant === 3 || dirOctant === 4 || dirOctant === 5) ? -1 : 1;
      let spinScaleX = 1.0;
      let spinBack = false;
      if (st.spinAngle > 0.05) {
        const cSpin = Math.cos(st.spinAngle);
        spinBack = cSpin < 0;
        spinScaleX = Math.max(0.28, Math.abs(cSpin)) * (cSpin < 0 ? -1 : 1);
      }
      const flipX = baseFlipX * (spinScaleX < 0 ? -1 : 1);
      const horizSqueeze = Math.abs(spinScaleX);
      const isBackView = (dirOctant === 6) || spinBack;

      // Record Painterly Ghost Afterimages during Dash, Skill, or Desperado Spin!
      const wantGhosts = isDash || isSkill || (st.spinAngle > 0.15);
      if (wantGhosts && (timeSec - st.lastGhostTime > 0.042)) {
        st.lastGhostTime = timeSec;
        st.afterimages.push({
          wx: pl.x, wy: pl.y, wz: pl.z,
          born: timeSec,
          flipX, isBackView, horizSqueeze,
          pose: {
            hipX: st.hipX, hipY: st.hipY, torsoRot: st.torsoRot, headRot: st.headRot, headBobY: st.headBobY,
            bLegAng: st.bLegAng, bKneeAng: st.bKneeAng, fLegAng: st.fLegAng, fKneeAng: st.fKneeAng,
            bArmAng: st.bArmAng, bForeAng: st.bForeAng, fArmAng: st.fArmAng, fForeAng: st.fForeAng,
            weaponExtra: st.weaponExtra, offhandExtra: st.offhandExtra, capeSway: st.capeSway, wingFlap: st.wingFlap
          }
        });
        if (st.afterimages.length > 4) st.afterimages.shift();
      }

      // Draw fading Ghost Afterimages behind the character!
      if (renderer && st.afterimages.length > 0) {
        const curScreen = renderer.project(pl.x, pl.y, pl.z);
        for (let i = st.afterimages.length - 1; i >= 0; i--) {
          const gh = st.afterimages[i];
          const age = timeSec - gh.born;
          if (age > 0.25) {
            st.afterimages.splice(i, 1);
            continue;
          }
          const gScreen = renderer.project(gh.wx, gh.wy, gh.wz);
          const dx = gScreen.x - curScreen.x;
          const dy = gScreen.y - curScreen.y;
          ctx.save();
          ctx.translate(dx, dy);
          ctx.globalAlpha = (1 - age / 0.25) * 0.34;
          this.renderPose(ctx, heroId, g, gh.pose, gh.flipX, gh.isBackView, gh.horizSqueeze, scale, 1, 1, t, false, false, false, false, false, '', '', 0, 0, true);
          ctx.restore();
        }
      }

      // Render main live character with squash & stretch!
      this.renderPose(
        ctx, heroId, g, st, flipX, isBackView, horizSqueeze, scale,
        st.squashX, st.squashY, t,
        isAirborne, isFly, isDash, isAttack || isHeavy || isSkill, isGuard,
        showSlash ? slashType : '', slashColor,
        st.muzzleFlash, st.offMuzzleFlash, false
      );
    }

    renderPose(
      ctx, heroId, g, pose, flipX, isBackView, horizSqueeze, scale,
      squashX, squashY, t,
      isAirborne, isFly, isDash, isCombatActive, isGuard,
      slashType, slashColor, muzzleFlash, offMuzzleFlash, isGhost
    ) {
      const heroMeta = HERO_META[heroId] || HERO_META.knight;
      const armorMeta = (g.armor && HERO_META[g.armor]) ? HERO_META[g.armor] : DEFAULT_UNARMORED;
      const armorHeroMeta = (g.armor && HERO_META[g.armor]) ? HERO_META[g.armor] : null;
      const helmetMeta = (g.helmet && HERO_META[g.helmet]) ? HERO_META[g.helmet] : null;
      const weaponMeta = (g.weapon && HERO_META[g.weapon]) ? HERO_META[g.weapon] : null;
      const trinketMeta = (g.trinket && HERO_META[g.trinket]) ? HERO_META[g.trinket] : null;

      // Solve Compact Chibi Skeleton Joints
      const torsoLen = 28;
      const thighLen = 12;
      const shinLen = 11;
      const uArmLen = 11;
      const fArmLen = 10;

      const sinT = Math.sin(pose.torsoRot);
      const cosT = Math.cos(pose.torsoRot);

      const torsoCenter = { x: pose.hipX + sinT * (torsoLen * 0.46), y: pose.hipY - cosT * (torsoLen * 0.46) };
      const shoulder = { x: pose.hipX + sinT * torsoLen, y: pose.hipY - cosT * torsoLen };
      const headCenter = {
        x: shoulder.x + sinT * 18 + 1.5,
        y: shoulder.y - cosT * 18 + pose.headBobY
      };

      const boneEnd = (ox, oy, ang, len) => ({
        x: ox + Math.sin(ang) * len,
        y: oy + Math.cos(ang) * len
      });

      const bHip = { x: pose.hipX - 5, y: pose.hipY + 3 };
      const bKnee = boneEnd(bHip.x, bHip.y, pose.bLegAng, thighLen);
      const bFoot = boneEnd(bKnee.x, bKnee.y, pose.bKneeAng, shinLen);

      const fHip = { x: pose.hipX + 5, y: pose.hipY + 4 };
      const fKnee = boneEnd(fHip.x, fHip.y, pose.fLegAng, thighLen);
      const fFoot = boneEnd(fKnee.x, fKnee.y, pose.fKneeAng, shinLen);

      const bShldr = { x: shoulder.x + 7, y: shoulder.y + 4 };
      const bElbow = boneEnd(bShldr.x, bShldr.y, pose.bArmAng, uArmLen);
      const bHand = boneEnd(bElbow.x, bElbow.y, pose.bForeAng, fArmLen);

      const fShldr = { x: shoulder.x - 7, y: shoulder.y + 5 };
      const fElbow = boneEnd(fShldr.x, fShldr.y, pose.fArmAng, uArmLen);
      const fHand = boneEnd(fElbow.x, fElbow.y, pose.fForeAng, fArmLen);

      ctx.save();
      ctx.scale(scale * flipX * squashX * horizSqueeze, scale * squashY);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const renderTrinket = () => {
        if (!g.trinket || !trinketMeta) return;
        const img = this.getImg('trinket', g.trinket);
        if (!img) return;
        const tCfg = trinketMeta.trinket;
        const tx = shoulder.x + tCfg.ox;
        const ty = shoulder.y + tCfg.oy;

        if (tCfg.isFloatingOrbs) {
          const orbitY = Math.sin(t * 4.5) * 4.5;
          const orbitRot = Math.sin(t * 2.2) * 0.14;
          this.drawPart(ctx, img, tx, ty + orbitY, 54 * tCfg.scale, 0.5, 0.5, orbitRot);
        } else if (tCfg.isWings) {
          const flapScaleX = 1.0 - Math.abs(pose.wingFlap) * 0.22;
          const flapRot = pose.torsoRot * 0.4 - pose.wingFlap * 0.25;
          if (!isGhost && tCfg.isThruster && (isAirborne || isFly || isDash || isCombatActive)) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const gGlow = ctx.createRadialGradient(tx - 4, ty + 14, 2, tx - 4, ty + 14, 26);
            gGlow.addColorStop(0, 'rgba(186, 230, 253, 0.90)');
            gGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.40)');
            gGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = gGlow;
            ctx.beginPath();
            ctx.arc(tx - 4, ty + 14, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          this.drawPart(ctx, img, tx, ty, 52 * tCfg.scale, 0.52, 0.52, flapRot, flapScaleX, 1.0);
        } else {
          const rot = pose.torsoRot * 0.45 + pose.capeSway * (tCfg.sway / 0.12);
          this.drawPart(ctx, img, tx, ty, 50 * tCfg.scale, 0.5, 0.25, rot);
        }
      };

      // LAYER 1: BACK TRINKET
      if (!isBackView) renderTrinket();

      // LAYER 2: BACK ARM + OFF-HAND WEAPON / SHIELD
      this.drawPainterlyLimb(ctx, bShldr.x, bShldr.y, bElbow.x, bElbow.y, 8.5, 7.2, armorMeta.sleeveDark, OUTLINE_WARM);
      this.drawPainterlyLimb(ctx, bElbow.x, bElbow.y, bHand.x, bHand.y, 7.0, 5.8, armorMeta.sleeveDark, OUTLINE_WARM, armorMeta.trim);
      this.drawPainterlyHand(ctx, bHand.x, bHand.y, 4.2, armorMeta.glove);

      if (g.weapon && weaponMeta && weaponMeta.weapon.offhand) {
        const oh = weaponMeta.weapon.offhand;
        if (oh === 'shield') {
          this.drawOffhandShield(ctx, bHand.x + 2, bHand.y, pose.torsoRot * 0.5);
        } else if (oh === 'kunai') {
          const ohImg = this.getImg('weapon', 'ninja_offhand') || this.getImg('weapon', 'ninja');
          const ohRot = 0.25 + (0.9 - pose.bForeAng) * 0.5 + pose.offhandExtra;
          this.drawPart(ctx, ohImg, bHand.x, bHand.y, 38, 0.5, 0.78, ohRot);
        } else if (oh === 'revolver') {
          const ohImg = this.getImg('weapon', 'cowboy');
          const ohRot = (Math.PI * 0.5) - (pose.bForeAng - 0.92) * 0.45 + pose.offhandExtra;
          this.drawPart(ctx, ohImg, bHand.x + 1, bHand.y, 36, 0.34, 0.76, ohRot);
          if (!isGhost && offMuzzleFlash > 0.05) {
            const tipX = bHand.x + Math.sin(ohRot) * 26;
            const tipY = bHand.y - Math.cos(ohRot) * 26;
            this.drawGunMuzzleBurst(ctx, tipX, tipY, offMuzzleFlash);
          }
        } else if (oh === 'axe') {
          const ohImg = this.getImg('weapon', 'viking');
          const ohRot = 0.25 + (0.9 - pose.bForeAng) * 0.45;
          this.drawPart(ctx, ohImg, bHand.x, bHand.y, 48, 0.5, 0.74, ohRot);
        } else if (oh === 'gauntlet') {
          const ohImg = this.getImg('weapon', 'striker');
          const ohRot = Math.PI - pose.bForeAng + 0.35;
          this.drawPart(ctx, ohImg, bHand.x, bHand.y, 24, 0.5, 0.62, ohRot);
        }
      }

      // LAYER 3: BACK LEG + BOOT
      this.drawPainterlyLimb(ctx, bHip.x, bHip.y, bKnee.x, bKnee.y, 9.2, 8.0, SKIN_SHADE, '#c9977a');
      this.drawPainterlyLimb(ctx, bKnee.x, bKnee.y, bFoot.x, bFoot.y, 8.2, 7.2, armorMeta.boot, armorMeta.bootSole);
      this.drawPainterlyBoot(ctx, bFoot.x, bFoot.y, -pose.bKneeAng * 0.25, armorMeta.boot, armorMeta.bootSole, armorMeta.trim, true);

      // LAYER 4: FRONT LEG + BOOT
      this.drawPainterlyLimb(ctx, fHip.x, fHip.y, fKnee.x, fKnee.y, 9.6, 8.2, SKIN_LIGHT, SKIN_SHADE);
      this.drawPainterlyLimb(ctx, fKnee.x, fKnee.y, fFoot.x, fFoot.y, 8.4, 7.4, armorMeta.boot, armorMeta.bootSole);
      this.drawPainterlyBoot(ctx, fFoot.x, fFoot.y, -pose.fKneeAng * 0.25, armorMeta.boot, armorMeta.bootSole, armorMeta.trim, false);

      // LAYER 5: MODULAR TORSO / ARMOR OUTFIT
      const armorImg = g.armor ? this.getImg('armor', g.armor) : null;
      if (armorImg && armorHeroMeta) {
        this.drawPart(
          ctx, armorImg,
          torsoCenter.x, torsoCenter.y + armorHeroMeta.armorOy,
          44 * armorHeroMeta.armorScale, 0.50, 0.46, pose.torsoRot * 0.72
        );
      } else {
        this.drawBaseAdventurerTunic(ctx, torsoCenter.x, torsoCenter.y + 2, pose.torsoRot * 0.72);
      }

      // LAYER 6: BACK-OF-HOOD LAYER (if wearing Reaper hood)
      const helmetImg = g.helmet ? this.getImg('helmet', g.helmet) : null;
      const hCfg = helmetMeta ? helmetMeta.helmet : null;
      if (helmetImg && hCfg && hCfg.mode === 'hood') {
        const hx = headCenter.x + hCfg.ox;
        const hy = headCenter.y + hCfg.oy;
        this.drawPart(ctx, helmetImg, hx, hy, 48 * hCfg.scale, 0.5, 0.5, pose.torsoRot * 0.35 + pose.headRot);
      }

      // LAYER 7: CHIBI HEAD & HAIR
      if (isBackView) {
        this.drawBackHairHead(ctx, headCenter.x, headCenter.y, pose.torsoRot * 0.35 + pose.headRot, heroMeta);
      } else {
        const headImg = this.getImg('head', heroId);
        if (headImg) {
          this.drawPart(
            ctx, headImg,
            headCenter.x, headCenter.y + heroMeta.headOy,
            46 * heroMeta.headScale, 0.50, 0.52, pose.torsoRot * 0.35 + pose.headRot
          );
        } else {
          this.drawBackHairHead(ctx, headCenter.x, headCenter.y, pose.torsoRot * 0.35 + pose.headRot, heroMeta);
        }
      }

      // LAYER 8: MODULAR HELMET / HEADGEAR
      if (helmetImg && hCfg) {
        const hx = headCenter.x + hCfg.ox;
        const hy = headCenter.y + hCfg.oy;
        const hRot = pose.torsoRot * 0.35 + pose.headRot;

        if (hCfg.mode === 'hood') {
          const ratio = helmetImg.naturalWidth / helmetImg.naturalHeight;
          const dh = 48 * hCfg.scale;
          const dw = dh * ratio;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.rotate(hRot);
          ctx.beginPath();
          ctx.rect(-dw * 0.6, -dh * 0.6, dw * 1.2, dh * 0.54);
          ctx.clip();
          ctx.drawImage(helmetImg, -dw * 0.5, -dh * 0.5, dw, dh);
          ctx.restore();
        } else {
          this.drawPart(ctx, helmetImg, hx, hy, 40 * hCfg.scale, 0.5, 0.5, hRot);
        }
      }

      // LAYER 9: FRONT TRINKET (when facing back or rear half of 360° spin!)
      if (isBackView) renderTrinket();

      // LAYER 10: FRONT ARM + HAND + MODULAR EQUIPPED WEAPON
      this.drawPainterlyLimb(ctx, fShldr.x, fShldr.y, fElbow.x, fElbow.y, 9.0, 7.6, armorMeta.sleeve, armorMeta.sleeveDark);
      this.drawPainterlyLimb(ctx, fElbow.x, fElbow.y, fHand.x, fHand.y, 7.6, 6.2, armorMeta.sleeve, armorMeta.sleeveDark, armorMeta.trim);
      this.drawPainterlyHand(ctx, fHand.x, fHand.y, 4.6, armorMeta.glove);

      if (g.weapon && weaponMeta) {
        const wImg = this.getImg('weapon', g.weapon);
        if (wImg) {
          const wCfg = weaponMeta.weapon;
          const isGun = (g.weapon === 'cowboy' || g.weapon === 'cyborg');
          let wristRot;
          if (isGun) {
            wristRot = (Math.PI * 0.5) - (pose.fForeAng - 0.92) * 0.50 + pose.weaponExtra;
          } else if (isCombatActive) {
            wristRot = (Math.PI - pose.fForeAng) * 0.72 + wCfg.baseAngle + pose.weaponExtra;
          } else {
            wristRot = 0.28 + (0.92 - pose.fForeAng) * 0.45 + wCfg.baseAngle;
          }
          this.drawPart(ctx, wImg, fHand.x + 1, fHand.y, wCfg.targetH, wCfg.gripX, wCfg.gripY, wristRot);

          if (!isGhost && isGun && muzzleFlash > 0.05) {
            const barrelLen = wCfg.targetH * 0.65;
            const tipX = fHand.x + 1 + Math.sin(wristRot) * barrelLen;
            const tipY = fHand.y - Math.cos(wristRot) * barrelLen;
            this.drawGunMuzzleBurst(ctx, tipX, tipY, muzzleFlash);
          }
        }
      }

      // LAYER 11: PAINTERLY ADDITIVE COMBAT SLASH RIBBONS, SPIN RINGS & GUARD WARD
      if (!isGhost && slashType) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = slashColor;
        ctx.lineCap = 'round';
        ctx.shadowColor = slashColor;
        ctx.shadowBlur = 12;

        if (slashType === 'spin_guns') {
          // Desperado 360° Golden Whirlwind Bullet Ring!
          ctx.save();
          ctx.translate(torsoCenter.x, torsoCenter.y + 4);
          ctx.scale(1, 0.38);
          ctx.lineWidth = 6;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(0, 0, 48, 0, Math.PI * 1.75);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        } else if (slashType === 'gunshot') {
          // Crisp forward golden bullet streak line!
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(fHand.x + 22, fHand.y - 2);
          ctx.lineTo(fHand.x + 68, fHand.y - 2);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (slashType === 'dash') {
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.moveTo(-24, shoulder.y - 4); ctx.lineTo(-54, shoulder.y - 4);
          ctx.moveTo(-20, pose.hipY + 4); ctx.lineTo(-48, pose.hipY + 4);
          ctx.stroke();
        } else {
          ctx.lineWidth = (slashType === 'heavy' || slashType === 'finisher') ? 8 : 5.5;
          ctx.globalAlpha = 0.88;
          ctx.beginPath();
          if (slashType === 'kick') {
            ctx.arc(pose.hipX + 6, pose.hipY, 36, -0.85, 0.60);
          } else if (slashType === 'upper') {
            ctx.arc(shoulder.x + 6, shoulder.y, 40, -1.55, 0.18);
          } else {
            ctx.arc(shoulder.x + 6, shoulder.y + 4, 42, -1.20, 0.75);
          }
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!isGhost && isGuard) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gx = shoulder.x + 16;
        const gy = shoulder.y + 8;
        const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, 32);
        grad.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
        grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.30)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, 32, -1.25, 1.25);
        ctx.fill();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(gx, gy, 28, -1.15, 1.15);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }

    drawDroppedGearIcon(ctx, slot, heroId, x, y, size) {
      const img = this.getImg(slot, heroId);
      if (!img) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const ratio = img.naturalWidth / img.naturalHeight;
      let dw = size;
      let dh = size;
      if (ratio > 1) dh = size / ratio;
      else dw = size * ratio;
      ctx.shadowColor = 'rgba(255, 240, 185, 0.85)';
      ctx.shadowBlur = 12;
      ctx.drawImage(img, x - dw * 0.5, y - dh * 0.5, dw, dh);
      ctx.restore();
      return true;
    }
  }

  root.ToSSpriteRig = ToSSpriteRig;
})(typeof self !== 'undefined' ? self : this);
