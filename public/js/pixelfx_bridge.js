// ============================================================================
// LOST SAGA 2.5D PIXEL ARENA - PIXELFX.IO (patch-gg/pixelfx) 2.5D VFX BRIDGE
// ============================================================================
// - Uses 100% actor-free pure VFX modules from patch-gg/pixelfx (no grey dummy
//   silhouettes!)
// - Custom compositeCleanVfx() strips dark soot, black scorch stains, and dark
//   smoke shadow blotches while preserving crisp colored pixel art & additive
//   light glow over the colorful 3D Rubik's Cube Arena!
// ============================================================================

import { createFrame, clearFrame, createFx } from '/pixelfx/core/index.js';

// Melee Effects
import * as swordSlash from '/pixelfx/fx/melee/sword-slash.js';
import * as doubleSlash from '/pixelfx/fx/melee/double-slash.js';
import * as heavyCleave from '/pixelfx/fx/melee/heavy-cleave.js';
import * as daggerFlurry from '/pixelfx/fx/melee/dagger-flurry.js';
import * as hammerSmash from '/pixelfx/fx/melee/hammer-smash.js';
import * as scytheReap from '/pixelfx/fx/melee/scythe-reap.js';
import * as spinSlash from '/pixelfx/fx/melee/spin-slash.js';
import * as thrust from '/pixelfx/fx/melee/thrust.js';
import * as uppercut from '/pixelfx/fx/melee/uppercut.js';
import * as whipCrack from '/pixelfx/fx/melee/whip-crack.js';

// Impact Effects (Actor-free pure impacts)
import * as hitSpark from '/pixelfx/fx/impacts/hit-spark.js';
import * as critHit from '/pixelfx/fx/impacts/crit-hit.js';
import * as bluntHit from '/pixelfx/fx/impacts/blunt-hit.js';
import * as parry from '/pixelfx/fx/impacts/parry.js';
import * as groundSlam from '/pixelfx/fx/impacts/ground-slam.js';
import * as heavyLanding from '/pixelfx/fx/impacts/heavy-landing.js';

// Fire & Explosion Effects
import * as meteor from '/pixelfx/fx/fire/meteor.js';
import * as fireRing from '/pixelfx/fx/fire/fire-ring.js';
import * as fireTornado from '/pixelfx/fx/fire/fire-tornado.js';
import * as flamePillar from '/pixelfx/fx/fire/flame-pillar.js';
import * as fireball from '/pixelfx/fx/fire/fireball.js';
import * as smokeBomb from '/pixelfx/fx/explosions/smoke-bomb.js';
import * as barrelExplosion from '/pixelfx/fx/explosions/barrel-explosion.js';
import * as grenade from '/pixelfx/fx/explosions/grenade.js';
import * as bigExplosion from '/pixelfx/fx/explosions/big-explosion.js';
import * as cartoonPow from '/pixelfx/fx/explosions/cartoon-pow.js';
import * as plasmaExplosion from '/pixelfx/fx/explosions/plasma-explosion.js';

// Ice, Lightning, Nature, Weather Effects (Actor-free)
import * as blizzardVortex from '/pixelfx/fx/ice/blizzard-vortex.js';
import * as frostNova from '/pixelfx/fx/ice/frost-nova.js';
import * as iceSpikes from '/pixelfx/fx/ice/ice-spikes.js';
import * as frostBreath from '/pixelfx/fx/ice/frost-breath.js';
import * as snowflakeBurst from '/pixelfx/fx/ice/snowflake-burst.js';
import * as iceShatter from '/pixelfx/fx/ice/ice-shatter.js';
import * as iceLance from '/pixelfx/fx/ice/ice-lance.js';
import * as lightningStrike from '/pixelfx/fx/lightning/lightning-strike.js';
import * as quake from '/pixelfx/fx/nature/quake.js';
import * as earthSpike from '/pixelfx/fx/nature/earth-spike.js';
import * as cherryBlossoms from '/pixelfx/fx/weather/cherry-blossoms.js';

// Holy, Arcane, Shadow, Sci-Fi, Projectiles, Pickups (Actor-free)
import * as smite from '/pixelfx/fx/holy/smite.js';
import * as sunburst from '/pixelfx/fx/holy/sunburst.js';
import * as healAoe from '/pixelfx/fx/holy/heal-aoe.js';
import * as holyPillar from '/pixelfx/fx/holy/holy-pillar.js';
import * as arcaneBeam from '/pixelfx/fx/arcane/arcane-beam.js';
import * as manaBurst from '/pixelfx/fx/arcane/mana-burst.js';
import * as soulDrain from '/pixelfx/fx/shadow/soul-drain.js';
import * as darkExplosion from '/pixelfx/fx/shadow/dark-explosion.js';
import * as necroSkulls from '/pixelfx/fx/shadow/necro-skulls.js';
import * as graspingHands from '/pixelfx/fx/shadow/grasping-hands.js';
import * as empBlast from '/pixelfx/fx/scifi/emp-blast.js';
import * as jetpack from '/pixelfx/fx/scifi/jetpack.js';
import * as teleporterPad from '/pixelfx/fx/scifi/teleporter-pad.js';
import * as muzzlePistol from '/pixelfx/fx/projectiles/muzzle-pistol.js';
import * as muzzleShotgun from '/pixelfx/fx/projectiles/muzzle-shotgun.js';
import * as muzzleSmg from '/pixelfx/fx/projectiles/muzzle-smg.js';
import * as energyDisc from '/pixelfx/fx/projectiles/energy-disc.js';
import * as homingMissile from '/pixelfx/fx/projectiles/homing-missile.js';
import * as plasmaShot from '/pixelfx/fx/projectiles/plasma-shot.js';
import * as collectBurst from '/pixelfx/fx/pickups/collect-burst.js';
import * as lootBeam from '/pixelfx/fx/pickups/loot-beam.js';

const FX_CATALOG = {
  'melee/sword-slash': swordSlash,
  'melee/double-slash': doubleSlash,
  'melee/heavy-cleave': heavyCleave,
  'melee/dagger-flurry': daggerFlurry,
  'melee/hammer-smash': hammerSmash,
  'melee/scythe-reap': scytheReap,
  'melee/spin-slash': spinSlash,
  'melee/thrust': thrust,
  'melee/uppercut': uppercut,
  'melee/whip-crack': whipCrack,

  'impacts/hit-spark': hitSpark,
  'impacts/crit-hit': critHit,
  'impacts/blunt-hit': bluntHit,
  'impacts/parry': parry,
  'impacts/ground-slam': groundSlam,
  'impacts/heavy-landing': heavyLanding,

  'fire/meteor': meteor,
  'fire/fire-ring': fireRing,
  'fire/fire-tornado': fireTornado,
  'fire/flame-pillar': flamePillar,
  'fire/fireball': fireball,
  'explosions/smoke-bomb': smokeBomb,
  'explosions/barrel-explosion': barrelExplosion,
  'explosions/grenade': grenade,
  'explosions/big-explosion': bigExplosion,
  'explosions/cartoon-pow': cartoonPow,
  'explosions/plasma-explosion': plasmaExplosion,

  'ice/blizzard-vortex': blizzardVortex,
  'ice/frost-nova': frostNova,
  'ice/ice-spikes': iceSpikes,
  'ice/frost-breath': frostBreath,
  'ice/snowflake-burst': snowflakeBurst,
  'ice/ice-shatter': iceShatter,
  'ice/ice-lance': iceLance,
  'lightning/lightning-strike': lightningStrike,
  'nature/quake': quake,
  'nature/earth-spike': earthSpike,
  'weather/cherry-blossoms': cherryBlossoms,

  'holy/smite': smite,
  'holy/sunburst': sunburst,
  'holy/heal-aoe': healAoe,
  'holy/holy-pillar': holyPillar,
  'arcane/arcane-beam': arcaneBeam,
  'arcane/mana-burst': manaBurst,
  'shadow/soul-drain': soulDrain,
  'shadow/dark-explosion': darkExplosion,
  'shadow/necro-skulls': necroSkulls,
  'shadow/grasping-hands': graspingHands,
  'scifi/emp-blast': empBlast,
  'scifi/jetpack': jetpack,
  'scifi/teleporter-pad': teleporterPad,
  'projectiles/muzzle-pistol': muzzlePistol,
  'projectiles/muzzle-shotgun': muzzleShotgun,
  'projectiles/muzzle-smg': muzzleSmg,
  'projectiles/energy-disc': energyDisc,
  'projectiles/homing-missile': homingMissile,
  'projectiles/plasma-shot': plasmaShot,
  'pickups/collect-burst': collectBurst,
  'pickups/loot-beam': lootBeam
};

// Map all 40 Hero Gear Skills to clean, actor-free PixelFX effects!
const SKILL_TO_PIXELFX = {
  // 1. Iron Knight
  knight_weapon:  { id: 'holy/smite',          scale: 2.1, maxDur: 1.5 },
  knight_armor:   { id: 'holy/sunburst',       scale: 2.1, maxDur: 1.4 },
  knight_helmet:  { id: 'holy/heal-aoe',       scale: 2.0, maxDur: 1.4 },
  knight_trinket: { id: 'impacts/ground-slam', scale: 2.2, maxDur: 1.2 },

  // 2. Shadow Ninja
  ninja_weapon:   { id: 'melee/dagger-flurry',         scale: 2.1, maxDur: 1.3 },
  ninja_armor:    { id: 'explosions/smoke-bomb',       scale: 2.0, maxDur: 1.4 },
  ninja_helmet:   { id: 'projectiles/energy-disc',     scale: 1.9, maxDur: 1.1 },
  ninja_trinket:  { id: 'explosions/barrel-explosion', scale: 2.0, maxDur: 1.4 },

  // 3. Fire Archmage
  mage_weapon:    { id: 'fire/meteor',       scale: 2.0, maxDur: 2.0 },
  mage_armor:     { id: 'fire/fire-ring',    scale: 2.0, maxDur: 1.5 },
  mage_helmet:    { id: 'fire/fire-tornado', scale: 2.0, maxDur: 1.7 },
  mage_trinket:   { id: 'fire/flame-pillar', scale: 2.0, maxDur: 1.2 },

  // 4. Desperado Cowboy
  cowboy_weapon:  { id: 'projectiles/muzzle-smg',     scale: 2.2, maxDur: 1.2 },
  cowboy_armor:   { id: 'explosions/grenade',         scale: 2.1, maxDur: 1.5 },
  cowboy_helmet:  { id: 'projectiles/muzzle-shotgun', scale: 2.0, maxDur: 1.0 },
  cowboy_trinket: { id: 'melee/whip-crack',           scale: 2.1, maxDur: 1.1 },

  // 5. Samurai EVO
  samurai_weapon:  { id: 'weather/cherry-blossoms', scale: 2.1, maxDur: 1.6 },
  samurai_armor:   { id: 'melee/spin-slash',        scale: 2.2, maxDur: 1.2 },
  samurai_helmet:  { id: 'fire/flame-pillar',       scale: 2.0, maxDur: 1.3 },
  samurai_trinket: { id: 'melee/uppercut',          scale: 2.2, maxDur: 1.1 },

  // 6. Frost Ice Witch
  witch_weapon:   { id: 'ice/blizzard-vortex', scale: 2.1, maxDur: 1.8 },
  witch_armor:    { id: 'ice/frost-nova',      scale: 1.9, maxDur: 1.8 },
  witch_helmet:   { id: 'ice/ice-spikes',      scale: 2.0, maxDur: 1.5 },
  witch_trinket:  { id: 'ice/snowflake-burst', scale: 2.0, maxDur: 1.3 },

  // 7. Giga Suit (Cyborg)
  cyborg_weapon:  { id: 'arcane/arcane-beam',         scale: 2.2, maxDur: 1.4 },
  cyborg_armor:   { id: 'scifi/emp-blast',            scale: 2.1, maxDur: 1.4 },
  cyborg_helmet:  { id: 'projectiles/homing-missile', scale: 2.0, maxDur: 1.4 },
  cyborg_trinket: { id: 'scifi/jetpack',              scale: 2.1, maxDur: 1.4 },

  // 8. Viking Berserker
  viking_weapon:  { id: 'nature/quake',        scale: 2.2, maxDur: 1.5 },
  viking_armor:   { id: 'fire/flame-pillar',   scale: 2.1, maxDur: 1.4 },
  viking_helmet:  { id: 'impacts/ground-slam', scale: 2.2, maxDur: 1.2 },
  viking_trinket: { id: 'melee/spin-slash',    scale: 2.1, maxDur: 1.2 },

  // 9. Muay Thai Striker
  striker_weapon:  { id: 'explosions/cartoon-pow',     scale: 2.2, maxDur: 1.3 },
  striker_armor:   { id: 'impacts/crit-hit',           scale: 2.1, maxDur: 1.1 },
  striker_helmet:  { id: 'lightning/lightning-strike', scale: 2.0, maxDur: 1.3 },
  striker_trinket: { id: 'nature/earth-spike',         scale: 2.1, maxDur: 1.4 },

  // 10. Necro Grim Reaper
  reaper_weapon:  { id: 'melee/scythe-reap',     scale: 2.3, maxDur: 1.3 },
  reaper_armor:   { id: 'shadow/dark-explosion', scale: 2.1, maxDur: 1.4 },
  reaper_helmet:  { id: 'shadow/necro-skulls',   scale: 2.0, maxDur: 1.5 },
  reaper_trinket: { id: 'shadow/grasping-hands', scale: 2.1, maxDur: 1.5 }
};

// Empty actor mask so no effect ever draws a grey dummy body silhouette
const EMPTY_ACTOR = {
  mask: { w: 24, h: 38, data: new Uint8Array(24 * 38) },
  pixels: new Uint32Array(24 * 38),
  x: -12,
  y: -38,
  w: 24,
  h: 38,
  k: 2,
  head: [0, -38],
  chest: [0, -26],
  eyes: []
};

// Custom Clean Compositor:
// Composites frame.color + additive frame.light while stripping out dark soot,
// black scorch stains, and dark charcoal smoke blotches so effects never leave
// dark shadow boxes over the colorful 3D Rubik's Cube tiles!
function compositeCleanVfx(f, out, lightK = 1.2) {
  const n = f.w * f.h;
  const C = f.color;
  const L = f.light;

  for (let i = 0; i < n; i++) {
    const c = C[i];
    const l = L[i] & 0xffffff;
    const j = i * 4;

    if (!c && !l) {
      out[j] = 0;
      out[j + 1] = 0;
      out[j + 2] = 0;
      out[j + 3] = 0;
      continue;
    }

    let r = c & 255;
    let g = (c >>> 8) & 255;
    let b = (c >>> 16) & 255;
    let a = c >>> 24;

    // Filter out dark soot, black scorch stains, and dark grey smoke blobs
    // (In pixelfx gallery these blend into a #07060d black background,
    //  but on bright 3D cube tiles they look like dark shadow boxes!)
    if (a > 0) {
      const maxCh = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minCh = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const sat = maxCh - minCh; // color saturation (0 = grey/black smoke/soot)

      if (maxCh < 58 && !l) {
        // Pure dark soot / black outline -> make completely transparent
        a = 0;
      } else if (maxCh < 125 && sat < 38) {
        // Dark desaturated grey smoke / charcoal -> fade out strongly
        const keep = Math.max(0, (maxCh - 65) / 60) * 0.35;
        a = (a * keep) | 0;
      } else if (maxCh < 90) {
        // Very dark colored shadow pixel -> soften alpha
        a = (a * ((maxCh - 40) / 50)) | 0;
      }
    }

    // Add the additive light buffer on top
    if (l) {
      const lr = (l & 255) * lightK;
      const lg = ((l >>> 8) & 255) * lightK;
      const lb = ((l >>> 16) & 255) * lightK;
      const lMax = lr > lg ? (lr > lb ? lr : lb) : (lg > lb ? lg : lb);

      if (a <= 4) {
        // Pure additive glow over transparency
        if (lMax > 8) {
          const inv = 255 / Math.min(255, lMax);
          r = Math.min(255, lr * inv) | 0;
          g = Math.min(255, lg * inv) | 0;
          b = Math.min(255, lb * inv) | 0;
          a = Math.min(220, lMax * 0.85) | 0;
        } else {
          a = 0;
        }
      } else {
        const pa = a / 255;
        const pr = r * pa + lr;
        const pg = g * pa + lg;
        const pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.min(0.9, lMax / 255)));
        r = Math.min(255, pr / na) | 0;
        g = Math.min(255, pg / na) | 0;
        b = Math.min(255, pb / na) | 0;
        a = (na * 255) | 0;
      }
    }

    out[j] = r;
    out[j + 1] = g;
    out[j + 2] = b;
    out[j + 3] = a;
  }
}

class PixelFXBridge {
  constructor() {
    this.instances = [];
    this.bufferPool = new Map();
    this.lastTime = performance.now();
    this.ready = true;
  }

  acquireBuffer(w, h) {
    const key = `${w}x${h}`;
    const pool = this.bufferPool.get(key);
    if (pool && pool.length > 0) {
      return pool.pop();
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return {
      w,
      h,
      frame: createFrame(w, h),
      canvas,
      ctx,
      imgData: ctx.createImageData(w, h)
    };
  }

  releaseBuffer(buf) {
    if (!buf) return;
    const key = `${buf.w}x${buf.h}`;
    if (!this.bufferPool.has(key)) this.bufferPool.set(key, []);
    const pool = this.bufferPool.get(key);
    if (pool.length < 16) pool.push(buf);
  }

  spawn(fxKey, wx, wy, wz, opts = {}) {
    const mod = FX_CATALOG[fxKey];
    if (!mod) return;

    while (this.instances.length >= 14) {
      const oldest = this.instances.shift();
      this.releaseBuffer(oldest.buf);
    }

    const meta = mod.meta || {};
    const [w, h] = meta.size || [128, 128];
    const [ox, oy] = meta.origin || [w >> 1, h >> 1];

    const buf = this.acquireBuffer(w, h);
    const fxInst = createFx(mod, {
      x: ox,
      y: oy,
      flip: !!opts.flip,
      angle: opts.angle || 0,
      seed: opts.seed || Math.floor(Math.random() * 50) + 1,
      light: 1.2,
      actor: EMPTY_ACTOR,
      ...(opts.fxOpts || {})
    });

    fxInst.update(1 / 30);
    clearFrame(buf.frame);
    fxInst.draw(buf.frame);
    compositeCleanVfx(buf.frame, buf.imgData.data, 1.2);
    buf.ctx.putImageData(buf.imgData, 0, 0);

    const maxDuration = opts.maxDur || Math.min(2.0, meta.duration || 1.0);

    this.instances.push({
      fxKey,
      fxInst,
      buf,
      wx,
      wy,
      wz,
      ox,
      oy,
      w,
      h,
      scaleMult: opts.scale || 2.0,
      maxDuration,
      elapsed: 0,
      stepAccum: 0
    });
  }

  handleServerFx(fx) {
    // Defer Iron Knight attacks/skills/parry to the dedicated Knight Effekseer/HD VFX suite!
    if (window.KnightEffekseerVFX && window.KnightEffekseerVFX.shouldSuppressLegacyVfx(fx)) {
      return;
    }

    let isLeft = false;
    if (typeof fx.facing === 'number') {
      let relAngle = (fx.facing + Math.PI * 0.25) % (Math.PI * 2);
      if (relAngle < 0) relAngle += Math.PI * 2;
      isLeft = (relAngle > Math.PI * 0.5 && relAngle < Math.PI * 1.5);
    }

    switch (fx.type) {
      case 'slash': {
        let fxId = 'melee/sword-slash';
        if (fx.weaponType === 'dual_kunai') {
          fxId = fx.isFinisher ? 'melee/dagger-flurry' : 'melee/double-slash';
        } else if (fx.weaponType === 'katana') {
          fxId = fx.comboStep === 2 ? 'melee/double-slash' : (fx.comboStep === 3 ? 'melee/uppercut' : (fx.isFinisher ? 'melee/spin-slash' : 'melee/sword-slash'));
        } else if (fx.weaponType === 'twin_axes') {
          fxId = fx.isFinisher ? 'melee/hammer-smash' : 'melee/heavy-cleave';
        } else if (fx.weaponType === 'gauntlets') {
          fxId = fx.comboStep === 3 ? 'melee/uppercut' : (fx.isFinisher ? 'impacts/crit-hit' : 'melee/thrust');
        } else if (fx.weaponType === 'scythe') {
          fxId = fx.isFinisher ? 'melee/spin-slash' : 'melee/scythe-reap';
        } else {
          fxId = fx.isFinisher ? 'melee/heavy-cleave' : 'melee/sword-slash';
        }
        this.spawn(fxId, fx.x, fx.y - 0.5, fx.z, { flip: isLeft, scale: 1.95, maxDur: 0.75 });
        break;
      }

      case 'muzzle': {
        this.spawn('projectiles/muzzle-pistol', fx.x, fx.y - 0.3, fx.z, { flip: isLeft, scale: 1.8, maxDur: 0.5 });
        break;
      }

      case 'hit': {
        const isCrit = fx.guardBreak || (fx.damage && fx.damage >= 18);
        this.spawn(isCrit ? 'impacts/crit-hit' : 'impacts/hit-spark', fx.x, fx.y - 0.3, fx.z, {
          scale: isCrit ? 2.1 : 1.85,
          maxDur: 0.65
        });
        break;
      }

      case 'block':
      case 'parry': {
        this.spawn('impacts/parry', fx.x, fx.y - 0.3, fx.z, { flip: isLeft, scale: 2.0, maxDur: 0.75 });
        break;
      }

      case 'freeze': {
        this.spawn('ice/ice-shatter', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.3 });
        break;
      }

      case 'heal': {
        this.spawn('holy/heal-aoe', fx.x, fx.y, fx.z, { scale: 1.85, maxDur: 1.2 });
        break;
      }

      case 'pickup': {
        this.spawn('pickups/collect-burst', fx.x, fx.y - 0.5, fx.z, { scale: 1.9, maxDur: 0.9 });
        break;
      }

      case 'gear_break': {
        this.spawn('impacts/crit-hit', fx.x, fx.y - 0.4, fx.z, { scale: 2.2, maxDur: 0.9 });
        break;
      }

      case 'ko': {
        this.spawn('explosions/plasma-explosion', fx.x, Math.max(0, fx.y), fx.z, { scale: 2.2, maxDur: 1.4 });
        break;
      }

      case 'spawn': {
        this.spawn('holy/holy-pillar', fx.x, fx.y, fx.z, { scale: 1.9, maxDur: 1.2 });
        break;
      }

      case 'hero_swap': {
        this.spawn('arcane/mana-burst', fx.x, fx.y + 0.3, fx.z, { scale: 2.0, maxDur: 1.0 });
        break;
      }

      case 'jump': {
        this.spawn('impacts/heavy-landing', fx.x, fx.y, fx.z, { scale: 1.6, maxDur: 0.5 });
        break;
      }

      case 'air_jump': {
        const isJet = fx.text && fx.text.includes('GIGA');
        const isFrost = fx.text && fx.text.includes('FROST');
        const isFlame = fx.text && fx.text.includes('FLAME');
        const fxId = isJet ? 'scifi/jetpack' : (isFrost ? 'ice/snowflake-burst' : (isFlame ? 'fire/flame-pillar' : 'arcane/mana-burst'));
        this.spawn(fxId, fx.x, fx.y, fx.z, { scale: 1.85, maxDur: 0.85 });
        break;
      }

      case 'dash': {
        this.spawn('impacts/hit-spark', fx.x, fx.y, fx.z, { flip: isLeft, scale: 1.8, maxDur: 0.5 });
        break;
      }

      case 'jumppad': {
        this.spawn('scifi/teleporter-pad', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.0 });
        break;
      }

      case 'teleport': {
        this.spawn('arcane/mana-burst', fx.x, fx.y + 0.3, fx.z, { scale: 2.0, maxDur: 0.85 });
        break;
      }

      case 'heavy_cast':
      case 'heavy_impact': {
        let fxId = 'melee/heavy-cleave';
        if (fx.heroId === 'knight') fxId = 'impacts/ground-slam';
        else if (fx.heroId === 'mage') fxId = 'fire/flame-pillar';
        else if (fx.heroId === 'witch') fxId = 'ice/frost-breath';
        else if (fx.heroId === 'viking') fxId = 'melee/spin-slash';
        else if (fx.heroId === 'striker') fxId = 'melee/uppercut';
        else if (fx.heroId === 'reaper') fxId = 'melee/scythe-reap';
        this.spawn(fxId, fx.x, fx.y - 0.3, fx.z, { flip: isLeft, scale: 2.1, maxDur: 1.1 });
        break;
      }

      case 'skill_cast': {
        const cfg = SKILL_TO_PIXELFX[fx.skillId];
        if (cfg) {
          this.spawn(cfg.id, fx.x, fx.y - 0.5, fx.z, {
            flip: isLeft,
            scale: cfg.scale,
            maxDur: cfg.maxDur
          });
        } else {
          this.spawn('arcane/mana-burst', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.1 });
        }
        break;
      }

      case 'meteor_strike': {
        this.spawn('fire/meteor', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.9 });
        break;
      }

      case 'explosion': {
        this.spawn('explosions/big-explosion', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.3 });
        break;
      }

      case 'smoke': {
        this.spawn('explosions/smoke-bomb', fx.x, fx.y, fx.z, { scale: 1.9, maxDur: 1.2 });
        break;
      }

      case 'blade_storm': {
        this.spawn('melee/dagger-flurry', fx.x, fx.y - 0.4, fx.z, { scale: 2.2, maxDur: 1.2 });
        break;
      }

      case 'sakura_storm': {
        this.spawn('weather/cherry-blossoms', fx.x, fx.y, fx.z, { scale: 2.1, maxDur: 1.5 });
        this.spawn('melee/double-slash', fx.x, fx.y - 0.3, fx.z, { flip: isLeft, scale: 2.1, maxDur: 1.0 });
        break;
      }

      case 'blizzard': {
        this.spawn('ice/blizzard-vortex', fx.x, fx.y, fx.z, { scale: 2.1, maxDur: 1.8 });
        break;
      }

      case 'ice_tomb': {
        this.spawn('ice/frost-nova', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.8 });
        break;
      }

      case 'ice_spikes': {
        this.spawn('ice/ice-spikes', fx.tx || fx.x, fx.y, fx.tz || fx.z, { flip: isLeft, scale: 2.1, maxDur: 1.5 });
        break;
      }

      case 'emp_dome': {
        this.spawn('scifi/emp-blast', fx.x, fx.y, fx.z, { scale: 2.1, maxDur: 1.3 });
        break;
      }

      case 'earthshatter': {
        this.spawn('nature/quake', fx.x, fx.y, fx.z, { scale: 2.2, maxDur: 1.4 });
        this.spawn('melee/hammer-smash', fx.x, fx.y, fx.z, { flip: isLeft, scale: 2.1, maxDur: 1.1 });
        break;
      }

      case 'hundred_fists': {
        this.spawn('explosions/cartoon-pow', fx.x, fx.y - 0.3, fx.z, { flip: isLeft, scale: 2.2, maxDur: 1.2 });
        break;
      }

      case 'scythe_reap': {
        this.spawn('melee/scythe-reap', fx.x, fx.y - 0.4, fx.z, { flip: isLeft, scale: 2.3, maxDur: 1.2 });
        this.spawn('shadow/soul-drain', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.3 });
        break;
      }

      case 'grave_chains': {
        this.spawn('shadow/grasping-hands', fx.x, fx.y, fx.z, { scale: 2.1, maxDur: 1.5 });
        break;
      }

      case 'shockwave': {
        this.spawn('impacts/ground-slam', fx.x, fx.y, fx.z, { scale: 2.0, maxDur: 1.1 });
        break;
      }
    }
  }

  updateAndDraw(ctx, renderer) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) * 0.001);
    this.lastTime = now;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.instances.length - 1; i >= 0; i--) {
      const v = this.instances[i];
      v.elapsed += dt;
      v.stepAccum += dt;

      if (v.elapsed >= v.maxDuration || v.fxInst.done()) {
        this.releaseBuffer(v.buf);
        this.instances.splice(i, 1);
        continue;
      }

      if (v.stepAccum >= 1 / 30) {
        const stepDt = Math.min(0.06, v.stepAccum);
        v.stepAccum = 0;
        v.fxInst.update(stepDt);
        clearFrame(v.buf.frame);
        v.fxInst.draw(v.buf.frame);
        compositeCleanVfx(v.buf.frame, v.buf.imgData.data, 1.2);
        v.buf.ctx.putImageData(v.buf.imgData, 0, 0);
      }

      const sp = renderer.project(v.wx, v.wy, v.wz);
      const drawScale = v.scaleMult * sp.scale;
      const drawW = Math.round(v.w * drawScale);
      const drawH = Math.round(v.h * drawScale);
      const drawX = Math.round(sp.x - v.ox * drawScale);
      const drawY = Math.round(sp.y - v.oy * drawScale);

      const rem = v.maxDuration - v.elapsed;
      ctx.globalAlpha = (rem < 0.25 ? Math.max(0, rem / 0.25) : 1.0) * 0.85;
      ctx.drawImage(v.buf.canvas, drawX, drawY, drawW, drawH);
    }

    ctx.restore();
  }
}

window.PixelFXBridge = new PixelFXBridge();
