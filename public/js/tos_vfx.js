// ============================================================================
// LOST SAGA 2.5D - TREE OF SAVIOR PAINTERLY BLOOM & RIBBON VFX ENGINE
// ============================================================================
// Replaces blocky square pixel particles/projectiles with smooth, lush
// Tree-of-Savior style additive bloom, tapered bullet/slash ribbon trails,
// starburst muzzle flashes, watercolor dash/landing dust puffs, isometric
// arcane ground rings, and drifting sanctuary petals/sun-motes.
// ============================================================================
(function (root) {
  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(253, 224, 71, ${alpha})`;
    const h = hex.replace('#', '');
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(253, 224, 71, ${alpha})`;
  }

  class ToSVFX {
    constructor() {
      this.sparks = [];       // Elongated luminous sparks & embers
      this.dusts = [];        // Soft watercolor dust / smoke clouds
      this.rings = [];        // Isometric ground shockwaves & magic circles
      this.flares = [];       // Starburst hit flashes & muzzle flashes
      this.slashes = [];      // Painterly crescent slash ribbons
      this.projTrails = new Map(); // projId -> [{x,y,z,t}]
      this.ambient = [];      // Drifting sakura petals / golden sun motes / embers
      this.lastTime = performance.now();

      for (let i = 0; i < 34; i++) {
        this.ambient.push({
          nx: Math.random(),
          ny: Math.random(),
          vx: 0.012 + Math.random() * 0.022,
          vy: 0.008 + Math.random() * 0.018,
          size: 2.5 + Math.random() * 4.5,
          phase: Math.random() * Math.PI * 2,
          rotSpd: (Math.random() - 0.5) * 2.5,
          alpha: 0.35 + Math.random() * 0.5
        });
      }
    }

    // Spawn soft cream watercolor dust puffs (dash, run, jump takeoff, landing!)
    spawnDust(x, y, z, count = 4, color = '#f5ebd8', spread = 1.6) {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.6 + Math.random() * spread;
        this.dusts.push({
          x: x + (Math.random() - 0.5) * 0.35,
          y: y + 0.08 + Math.random() * 0.15,
          z: z + (Math.random() - 0.5) * 0.35,
          vx: Math.cos(ang) * spd,
          vy: 0.6 + Math.random() * 1.4,
          vz: Math.sin(ang) * spd,
          r0: 6 + Math.random() * 6,
          r1: 18 + Math.random() * 14,
          color,
          born: now,
          ttl: 340 + Math.random() * 220
        });
      }
    }

    // Spawn elongated luminous ToS sparks (hit, muzzle, skill burst!)
    spawnSparks(x, y, z, color = '#fde047', count = 12, speedMult = 1.0) {
      const now = performance.now();
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (2.2 + Math.random() * 6.5) * speedMult;
        this.sparks.push({
          x, y: y + 0.5, z,
          vx: Math.cos(ang) * spd,
          vy: (2.0 + Math.random() * 5.8) * speedMult,
          vz: Math.sin(ang) * spd,
          color,
          size: 2.4 + Math.random() * 2.8,
          born: now,
          ttl: 260 + Math.random() * 240
        });
      }
    }

    // Spawn starburst flash (hit impact or Desperado gun muzzle flash!)
    spawnFlare(x, y, z, color = '#fde047', radius = 34, ttl = 200, rays = 4) {
      this.flares.push({
        x, y, z, color, radius, rays,
        rot: Math.random() * Math.PI,
        born: performance.now(),
        ttl
      });
    }

    // Spawn isometric floor shockwave / arcane ring
    spawnRing(x, y, z, color = '#fde047', r0 = 0.4, r1 = 2.8, ttl = 380, runes = false) {
      this.rings.push({
        x, y, z, color, r0, r1, runes,
        born: performance.now(),
        ttl
      });
    }

    // Spawn painterly crescent slash ribbon in 3D world position
    spawnSlash(x, y, z, facing = 0, color = '#fde047', radius = 48, ttl = 230, heavy = false) {
      this.slashes.push({
        x, y: y + 0.85, z,
        facing, color, radius, heavy,
        flip: Math.random() > 0.5 ? 1 : -1,
        born: performance.now(),
        ttl
      });
    }

    // Process server FX events cleanly into Tree-of-Savior painterly VFX
    handleServerFx(fx) {
      const x = fx.tx !== undefined ? fx.tx : (fx.x || 0);
      const y = fx.ty !== undefined ? fx.ty : (fx.y || 0);
      const z = fx.tz !== undefined ? fx.tz : (fx.z || 0);
      const col = fx.color || '#fde047';

      switch (fx.type) {
        case 'muzzle':
          this.spawnFlare(fx.x || x, (fx.y || y) + 0.95, fx.z || z, '#fef08a', 32, 160, 4);
          this.spawnSparks(fx.x || x, (fx.y || y) + 0.5, fx.z || z, '#fbbf24', 7, 0.9);
          this.spawnDust(fx.x || x, (fx.y || y) + 0.8, fx.z || z, 2, '#fff7ed', 0.9);
          break;
        case 'slash':
          this.spawnSlash(fx.x || x, fx.y || y, fx.z || z, fx.facing || 0, col, 48, 220, false);
          this.spawnSparks(fx.x || x, (fx.y || y) + 0.4, fx.z || z, col, 6, 0.8);
          break;
        case 'hit':
          this.spawnFlare(x, y + 0.8, z, fx.guardBreak ? '#fde047' : col, fx.damage >= 16 ? 44 : 28, 190, 4);
          this.spawnSparks(x, y + 0.4, z, fx.guardBreak ? '#fde047' : col, fx.damage >= 16 ? 14 : 8, 1.0);
          break;
        case 'heavy_cast':
        case 'heavy_impact':
          this.spawnSlash(x, y, z, fx.facing || 0, '#fde047', 66, 290, true);
          this.spawnRing(x, y + 0.05, z, '#fde047', 0.5, 3.2, 360, true);
          this.spawnFlare(x, y + 0.9, z, '#fef08a', 52, 240, 6);
          this.spawnSparks(x, y + 0.5, z, '#fbbf24', 16, 1.25);
          this.spawnDust(x, y, z, 6, '#f5ebd8', 2.4);
          break;
        case 'skill_cast':
          this.spawnRing(fx.x || x, (fx.y || y) + 0.05, fx.z || z, col, 0.5, 3.6, 440, true);
          this.spawnFlare(fx.x || x, (fx.y || y) + 1.0, fx.z || z, col, 50, 260, 6);
          this.spawnSparks(fx.x || x, (fx.y || y) + 0.5, fx.z || z, col, 14, 1.15);
          break;
        case 'dash':
          this.spawnDust(fx.x || x, fx.y || y, fx.z || z, 5, '#f5ebd8', 2.0);
          this.spawnRing(fx.x || x, (fx.y || y) + 0.04, fx.z || z, col, 0.3, 1.8, 250, false);
          break;
        case 'jump':
        case 'air_jump':
        case 'jumppad':
          this.spawnDust(fx.x || x, fx.y || y, fx.z || z, 5, '#f5ebd8', 1.8);
          this.spawnRing(fx.x || x, (fx.y || y) + 0.04, fx.z || z, fx.type === 'air_jump' ? '#7dd3fc' : '#fef3c7', 0.3, 2.2, 300, false);
          break;
        case 'hero_swap':
          this.spawnRing(fx.x || x, (fx.y || y) + 0.05, fx.z || z, '#fde047', 0.4, 2.8, 420, true);
          this.spawnSparks(fx.x || x, (fx.y || y) + 0.6, fx.z || z, '#fef08a', 14, 1.0);
          break;
        case 'parry':
          this.spawnFlare(x, y + 0.9, z, '#7dd3fc', 48, 240, 6);
          this.spawnRing(x, y + 0.06, z, '#38bdf8', 0.4, 2.6, 320, true);
          break;
        case 'gear_break':
          this.spawnFlare(x, y + 1.0, z, '#fb923c', 54, 260, 6);
          this.spawnSparks(x, y + 0.7, z, '#fde047', 16, 1.3);
          break;
        case 'shockwave':
        case 'explosion':
        case 'meteor_strike':
        case 'earthshatter':
        case 'emp_dome':
        case 'blizzard':
        case 'sakura_storm':
        case 'blade_storm':
        case 'scythe_reap':
          this.spawnRing(x, y + 0.05, z, col, 0.6, 4.4, 520, true);
          this.spawnFlare(x, y + 0.9, z, col, 58, 300, 6);
          this.spawnSparks(x, y + 0.6, z, col, 18, 1.3);
          this.spawnDust(x, y, z, 6, '#f5ebd8', 2.8);
          break;
      }
    }

    // Update projectile ribbon trail histories
    syncProjectiles(projectiles, now) {
      const alive = new Set();
      for (const pr of (projectiles || [])) {
        const id = pr.id || `${pr.ownerId}_${pr.type}_${Math.round(pr.x * 2)}`;
        alive.add(id);
        let arr = this.projTrails.get(id);
        if (!arr) {
          arr = [];
          this.projTrails.set(id, arr);
        }
        const last = arr[arr.length - 1];
        if (!last || Math.hypot(pr.x - last.x, pr.y - last.y, pr.z - last.z) > 0.14) {
          arr.push({ x: pr.x, y: pr.y, z: pr.z, t: now });
          if (arr.length > 9) arr.shift();
        }
      }
      for (const id of this.projTrails.keys()) {
        if (!alive.has(id)) this.projTrails.delete(id);
      }
    }

    // Draw sleek Tree-of-Savior projectile + tapered glowing ribbon trail
    drawProjectile(ctx, renderer, pr, screenPos, map, timeSec) {
      const id = pr.id || `${pr.ownerId}_${pr.type}_${Math.round(pr.x * 2)}`;
      const trail = this.projTrails.get(id);
      const col = pr.color || '#fde047';
      const sz = Math.max(7, (pr.radius || 0.6) * 16 * screenPos.scale);

      // Soft ground shadow directly beneath projectile
      const floorInfo = renderer.getFloorUnder(pr.x, pr.z, pr.y, map);
      if (floorInfo.onPlatform) {
        const sp = renderer.project(pr.x, floorInfo.floorY + 0.03, pr.z);
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.scale(1, renderer.isoTilt);
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 20, 15, 0.28)';
        ctx.fill();
        ctx.restore();
      }

      // 1. Tapered Additive Glow Ribbon Trail!
      if (trail && trail.length >= 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          const a = renderer.project(trail[i - 1].x, trail[i - 1].y, trail[i - 1].z);
          const b = renderer.project(trail[i].x, trail[i].y, trail[i].z);
          const frac = i / (trail.length - 1);
          // Outer warm bloom
          ctx.strokeStyle = hexToRgba(col, frac * 0.42);
          ctx.lineWidth = Math.max(2, sz * 0.95 * frac);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // White-hot core streak
          ctx.strokeStyle = `rgba(255, 253, 240, ${frac * 0.85})`;
          ctx.lineWidth = Math.max(1.2, sz * 0.36 * frac);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Compute screen-space velocity direction for sleek oriented bullets/waves
      let moveAng = 0;
      if (trail && trail.length >= 2) {
        const pPrev = renderer.project(trail[trail.length - 2].x, trail[trail.length - 2].y, trail[trail.length - 2].z);
        moveAng = Math.atan2(screenPos.y - pPrev.y, screenPos.x - pPrev.x);
      }

      // 2. Painterly Directional Projectile Head
      ctx.save();
      ctx.translate(screenPos.x, screenPos.y);
      ctx.globalCompositeOperation = 'lighter';

      // Soft radial bloom halo
      const halo = ctx.createRadialGradient(0, 0, sz * 0.1, 0, 0, sz * 1.45);
      halo.addColorStop(0, 'rgba(255, 255, 245, 0.95)');
      halo.addColorStop(0.38, hexToRgba(col, 0.72));
      halo.addColorStop(1, hexToRgba(col, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, sz * 1.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      if (pr.type === 'shuriken' || pr.type === 'boomerang_axe') {
        ctx.rotate(timeSec * 20);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
          ctx.lineTo(Math.cos(a + 0.45) * sz * 0.34, Math.sin(a + 0.45) * sz * 0.34);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (pr.type === 'sword_wave' || pr.type === 'excalibur') {
        ctx.rotate(moveAng);
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(-sz * 0.5, 0, sz * 1.25, -0.95, 0.95);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // Elongated luminous bullet / energy bolt
        ctx.rotate(moveAng);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * 0.95, sz * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sz * 0.15, 0, sz * 0.55, sz * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw isometric floor rings BEFORE entities so characters stand cleanly ON TOP of magic circles!
    drawGroundRings(ctx, renderer, now) {
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const rg = this.rings[i];
        const age = now - rg.born;
        if (age >= rg.ttl) {
          this.rings.splice(i, 1);
          continue;
        }
        const t = age / rg.ttl;
        const easeOut = 1 - Math.pow(1 - t, 3);
        const p = renderer.project(rg.x, rg.y, rg.z);
        const rad = (rg.r0 + (rg.r1 - rg.r0) * easeOut) * renderer.camZoom * p.scale;
        const alpha = (1 - t) * 0.85;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, renderer.isoTilt);
        ctx.globalCompositeOperation = 'lighter';

        // Soft glowing fill wave
        const grad = ctx.createRadialGradient(0, 0, rad * 0.55, 0, 0, rad);
        grad.addColorStop(0, hexToRgba(rg.color, 0));
        grad.addColorStop(0.75, hexToRgba(rg.color, alpha * 0.38));
        grad.addColorStop(1, hexToRgba(rg.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();

        // Crisp outer bright ring
        ctx.strokeStyle = hexToRgba(rg.color, alpha);
        ctx.lineWidth = Math.max(1.5, 4.5 * (1 - t * 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();

        // Inner white-gold arcane rune ring
        if (rg.runes) {
          ctx.rotate(t * 1.4);
          ctx.strokeStyle = `rgba(255, 252, 230, ${alpha * 0.75})`;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.78, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    // Draw foreground painterly effects: dust clouds, slash ribbons, starburst flares, luminous sparks
    drawForegroundVfx(ctx, renderer, now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) * 0.001));
      this.lastTime = now;

      // 1. Soft Watercolor Dust Puffs
      for (let i = this.dusts.length - 1; i >= 0; i--) {
        const d = this.dusts[i];
        const age = now - d.born;
        if (age >= d.ttl) {
          this.dusts.splice(i, 1);
          continue;
        }
        const t = age / d.ttl;
        const ease = 1 - Math.pow(1 - t, 2);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.vx *= 0.94;
        d.vz *= 0.94;
        d.vy *= 0.96;

        const sp = renderer.project(d.x, d.y, d.z);
        const r = (d.r0 + (d.r1 - d.r0) * ease) * sp.scale;
        const alpha = (1 - t) * 0.52;

        ctx.save();
        const g = ctx.createRadialGradient(sp.x, sp.y - r * 0.15, r * 0.15, sp.x, sp.y, r);
        g.addColorStop(0, hexToRgba(d.color, alpha));
        g.addColorStop(0.65, hexToRgba(d.color, alpha * 0.45));
        g.addColorStop(1, hexToRgba(d.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Painterly Tapered Crescent Slash Ribbons
      for (let i = this.slashes.length - 1; i >= 0; i--) {
        const sl = this.slashes[i];
        const age = now - sl.born;
        if (age >= sl.ttl) {
          this.slashes.splice(i, 1);
          continue;
        }
        const t = age / sl.ttl;
        const p = renderer.project(sl.x, sl.y, sl.z);
        const rad = sl.radius * (0.8 + t * 0.35) * p.scale;
        const alpha = Math.sin(Math.min(1, t * 1.15) * Math.PI);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((sl.facing + Math.PI * 0.25) * 0.25 + (t - 0.5) * 0.6 * sl.flip);
        ctx.scale(1, 0.62);
        ctx.globalCompositeOperation = 'lighter';

        // Outer painterly glow
        ctx.strokeStyle = hexToRgba(sl.color, alpha * 0.55);
        ctx.lineWidth = (sl.heavy ? 18 : 12) * (1 - t * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, rad, -1.25, 1.05);
        ctx.stroke();

        // Mid vivid arc
        ctx.strokeStyle = hexToRgba(sl.color, alpha * 0.92);
        ctx.lineWidth = (sl.heavy ? 9 : 6) * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, rad, -1.15, 0.95);
        ctx.stroke();

        // White-hot blade edge
        ctx.strokeStyle = `rgba(255, 255, 245, ${alpha * 0.95})`;
        ctx.lineWidth = (sl.heavy ? 3.8 : 2.4) * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, rad + 1.5, -1.0, 0.8);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Starburst Muzzle & Impact Flares
      for (let i = this.flares.length - 1; i >= 0; i--) {
        const fl = this.flares[i];
        const age = now - fl.born;
        if (age >= fl.ttl) {
          this.flares.splice(i, 1);
          continue;
        }
        const t = age / fl.ttl;
        const p = renderer.project(fl.x, fl.y, fl.z);
        const rad = fl.radius * (0.65 + (1 - Math.pow(1 - t, 2)) * 0.65) * p.scale;
        const alpha = 1 - t;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(fl.rot + t * 0.35);
        ctx.globalCompositeOperation = 'lighter';

        // Radial bloom orb
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rad * 0.85);
        g.addColorStop(0, `rgba(255, 255, 245, ${alpha})`);
        g.addColorStop(0.35, hexToRgba(fl.color, alpha * 0.72));
        g.addColorStop(1, hexToRgba(fl.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Crisp 4/6-point anime star rays
        ctx.fillStyle = `rgba(255, 254, 242, ${alpha * 0.95})`;
        for (let r = 0; r < fl.rays; r++) {
          const ang = (r * Math.PI) / (fl.rays * 0.5);
          ctx.save();
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(0, -rad * 0.14);
          ctx.lineTo(rad * 1.15, 0);
          ctx.lineTo(0, rad * 0.14);
          ctx.lineTo(-rad * 0.25, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      // 4. Luminous Elongated Motion Sparks
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const sp = this.sparks[i];
        const age = now - sp.born;
        if (age >= sp.ttl) {
          this.sparks.splice(i, 1);
          continue;
        }
        const t = age / sp.ttl;
        const prev = renderer.project(sp.x, sp.y, sp.z);
        sp.vy -= 18 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        const cur = renderer.project(sp.x, sp.y, sp.z);
        const alpha = 1 - t * t;

        ctx.strokeStyle = hexToRgba(sp.color, alpha * 0.85);
        ctx.lineWidth = Math.max(1.5, sp.size * (1 - t * 0.5) * cur.scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 245, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, Math.max(1.2, sp.size * 0.48 * cur.scale), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw dreamy drifting cherry-blossom petals / golden sun-motes across the sanctuary!
    drawAmbientAtmosphere(ctx, width, height, map, timeSec) {
      const isLava = map && map.voidType === 'lava';
      const isStar = map && map.voidType === 'neon_city';

      ctx.save();
      // Subtle warm golden diagonal sunbeams in the Sky Sanctuary!
      if (!isLava && !isStar) {
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          const bx = width * (0.14 + b * 0.32) + Math.sin(timeSec * 0.3 + b) * 28;
          const beamGrad = ctx.createLinearGradient(bx, 0, bx + 160, height * 0.72);
          beamGrad.addColorStop(0, 'rgba(255, 244, 200, 0.09)');
          beamGrad.addColorStop(0.55, 'rgba(255, 236, 175, 0.04)');
          beamGrad.addColorStop(1, 'rgba(255, 236, 175, 0)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(bx - 55, 0);
          ctx.lineTo(bx + 75, 0);
          ctx.lineTo(bx + 260, height * 0.78);
          ctx.lineTo(bx + 70, height * 0.78);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // Drifting petals / embers / starlight motes
      for (const p of this.ambient) {
        const px = ((p.nx + timeSec * p.vx + Math.sin(timeSec * 0.8 + p.phase) * 0.02) % 1.08 + 1.08) % 1.08 - 0.04;
        const dirY = isLava ? -1 : 1;
        const py = ((p.ny + timeSec * p.vy * dirY) % 1.08 + 1.08) % 1.08 - 0.04;
        const sx = px * width;
        const sy = py * height;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(timeSec * p.rotSpd + p.phase);
        if (isLava) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (isStar) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(125, 211, 252, ${p.alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Soft pink-cream Tree of Savior blossom petals & golden sun motes
          if (p.phase > 3.1) {
            ctx.fillStyle = `rgba(255, 218, 224, ${p.alpha * 0.78})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.9, p.size * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 245, 195, ${p.alpha * 0.65})`;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  root.ToSVFX = ToSVFX;
})(typeof self !== 'undefined' ? self : this);
