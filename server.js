// ============================================================================
// LOST SAGA 3D ARENA - AUTHORITATIVE LAN MULTIPLAYER SERVER
// ============================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const GAME_DATA = require('./public/js/shared_data.js');

const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const GRAVITY = 28.0;
const SPRINT_DRAIN_PER_SEC = 30; // full gauge ≈ 3.3 s of sprint
const SPRINT_RESUME = 30;        // gauge needed to sprint again after running dry
const SPRINT_SPEED_SHARE = 0.7;  // sprint gets 70% of the hero's old dash speed bonus
const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.7;
const FLOOR_EPSILON = 0.05;
const MAX_STAIR_RISE = 0.31;
const TARGET_HEIGHT_LIMIT = 3;
const SKILL_TARGET_TIMEOUT = 4000;
const SKILL_CHARGE_DEALT = 0.45;
const SKILL_CHARGE_TAKEN = 0.30;

function insideRect(area, x, z) {
  return x >= area.x && x <= area.x + area.w && z >= area.z && z <= area.z + area.d;
}

function stairDirection(platform) {
  return platform.stair === true ? '+x' : platform.stair;
}

function crossesStairFace(platform, from, to, uphill) {
  const stair = stairDirection(platform);
  if (!stair) return false;
  const axis = stair[1];
  const direction = (stair[0] === '+' ? 1 : -1) * (uphill ? 1 : -1);
  const length = axis === 'x' ? platform.w : platform.d;
  const face = platform[axis] + (direction < 0 ? length : 0);
  return (from[axis] - face) * direction <= 0 && (to[axis] - face) * direction > 0;
}

function moveAlongPlatformAxis(platforms, axis, start, across, delta, y, nextY, grounded) {
  if (delta === 0) return start;
  const direction = Math.sign(delta);
  const travel = Math.abs(delta);
  const crossAxis = axis === 'x' ? 'z' : 'x';
  const width = axis === 'x' ? 'w' : 'd';
  const depth = axis === 'x' ? 'd' : 'w';
  let allowed = travel;
  for (const platform of platforms) {
    const crossMin = platform[crossAxis];
    if (across <= crossMin - PLAYER_RADIUS || across >= crossMin + platform[depth] + PLAYER_RADIUS) continue;
    const face = platform[axis] + (direction < 0 ? platform[width] : 0);
    const distance = (face - start) * direction;
    if (distance < 0 || distance > allowed + PLAYER_RADIUS) continue;

    const toContact = Math.max(0, distance - PLAYER_RADIUS);
    const contactY = y + (nextY - y) * (toContact / travel);
    // A side blocks only the part of the player's path alongside the solid platform.
    if (contactY >= platform.y - FLOOR_EPSILON || contactY + PLAYER_HEIGHT <= platform.y - platform.h) continue;
    // Only the shallow uphill face of an authored stair is walkable.
    if (grounded && stairDirection(platform) === (direction > 0 ? '+' : '-') + axis && platform.y - y <= MAX_STAIR_RISE) continue;
    allowed = toContact;
  }
  return start + direction * allowed;
}

// Helper to get all LAN IPv4 addresses
function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ interface: name, ip: net.address, url: `http://${net.address}:${PORT}` });
      }
    }
  }
  if (results.length === 0) {
    results.push({ interface: 'Localhost', ip: '127.0.0.1', url: `http://127.0.0.1:${PORT}` });
  }
  return results;
}

// MIME types for static serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.efkefc': 'application/octet-stream',
  '.efk': 'application/octet-stream',
  '.efkproj': 'application/xml; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream'
};

const MODULE_MOUNTS = [
  { prefix: '/pixelfx/', root: path.join(__dirname, 'node_modules', 'pixelfx', 'src') },
  { prefix: '/vendor/three/', root: path.join(__dirname, 'node_modules', 'three') }
];

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (parsedUrl.pathname === '/api/lan-info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      port: PORT,
      addresses: getLanAddresses(),
      rooms: Array.from(rooms.values()).map(r => r.getSummary())
    }));
    return;
  }

  // Serve browser ES modules straight from node_modules (no bundler):
  // /pixelfx/* -> pixelfx/src, /vendor/three/* -> three (build + examples/jsm)
  const moduleMount = MODULE_MOUNTS.find(m => parsedUrl.pathname.startsWith(m.prefix));
  if (moduleMount) {
    const relPath = parsedUrl.pathname.slice(moduleMount.prefix.length);
    const pfxRoot = moduleMount.root;
    const pfxPath = path.join(pfxRoot, relPath);
    if (!pfxPath.startsWith(pfxRoot + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const ext = path.extname(pfxPath).toLowerCase();
    fs.readFile(pfxPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/javascript; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  let filePath = path.join(__dirname, 'public', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

// ============================================================================
// ROOM & 3D COMBAT SIMULATION ENGINE
// ============================================================================
const rooms = new Map();
let nextEntityId = 1;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function newSkillGauges(now) {
  return Object.fromEntries(GAME_DATA.GEAR_SLOTS.map(slot => [
    slot, { charge: 100, updatedAt: now, nextUseAt: 0 }
  ]));
}

function rechargeSkillGauge(gauge, skill, now) {
  const elapsed = Math.max(0, now - gauge.updatedAt);
  if (skill.type !== 'passive') {
    gauge.charge = Math.min(100, gauge.charge + 100 * elapsed / skill.cooldownMs);
  }
  gauge.updatedAt = now;
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// A bot crosses adjoining floors through the middle of their shared opening.
// Keep the first crossing for each destination so chasing at 30 Hz is a lookup.
function buildWalkingRoutes(platforms) {
  const links = new Map(platforms.map(p => [p, []]));
  for (const from of platforms) {
    for (const to of platforms) {
      if (from === to || (from.y !== to.y && (!(from.stair || to.stair) || Math.abs(from.y - to.y) > MAX_STAIR_RISE))) continue;
      const x0 = Math.max(from.x, to.x), x1 = Math.min(from.x + from.w, to.x + to.w);
      const z0 = Math.max(from.z, to.z), z1 = Math.min(from.z + from.d, to.z + to.d);
      if (x1 < x0 || z1 < z0 || Math.max(x1 - x0, z1 - z0) < 2 * PLAYER_RADIUS) continue;
      const insetX = Math.min(0.75, to.w / 2), insetZ = Math.min(0.75, to.d / 2);
      links.get(from).push({
        to,
        x: clamp((x0 + x1) / 2, to.x + insetX, to.x + to.w - insetX),
        z: clamp((z0 + z1) / 2, to.z + insetZ, to.z + to.d - insetZ)
      });
    }
  }
  const routes = new Map();
  for (const start of platforms) {
    const first = new Map([[start, null]]);
    const queue = [start];
    for (const current of queue) {
      for (const link of links.get(current)) {
        if (first.has(link.to)) continue;
        first.set(link.to, current === start ? link : first.get(current));
        queue.push(link.to);
      }
    }
    routes.set(start, first);
  }
  return routes;
}

class GameRoom {
  constructor(id, name, mapId = 'sky_temple', mode = 'ffa') {
    this.id = id;
    this.name = name;
    this.mapId = GAME_DATA.MAPS[mapId] ? mapId : 'sky_temple';
    this.walkingRoutes = buildWalkingRoutes(this.getMap().platforms);
    this.mode = mode; // 'ffa', 'team', 'koth'
    this.players = new Map(); // id -> PlayerState
    this.projectiles = [];
    this.droppedGears = [];
    this.hazards = [];
    this.fxEvents = [];
    this.killFeed = [];
    this.kothOwner = null;
    this.createdAt = Date.now();
  }

  getMap() {
    return GAME_DATA.MAPS[this.mapId] || GAME_DATA.MAPS.sky_temple;
  }

  changeMap(mapId) {
    if (this.mapId === mapId) return;
    this.mapId = mapId;
    this.walkingRoutes = buildWalkingRoutes(this.getMap().platforms);
    this.projectiles.length = 0;
    this.droppedGears.length = 0;
    this.hazards.length = 0;
    this.fxEvents.length = 0;
    for (const player of this.players.values()) {
      this.respawnPlayer(player);
    }
  }

  getSummary() {
    let humanCount = 0;
    let botCount = 0;
    for (const p of this.players.values()) {
      if (p.isBot) botCount++;
      else humanCount++;
    }
    return {
      id: this.id,
      name: this.name,
      mapId: this.mapId,
      mapNameTh: this.getMap().nameTh,
      mode: this.mode,
      humanCount,
      botCount,
      totalPlayers: this.players.size
    };
  }

  getSpawnPoint(index = 0) {
    const spawns = this.getMap().spawns;
    const sp = spawns[index % spawns.length] || { x: 0, z: 0 };
    return {
      x: sp.x + (Math.random() - 0.5) * 1.2,
      y: 3.0,
      z: sp.z + (Math.random() - 0.5) * 1.2
    };
  }

  createPlayer(id, name, heroId, isBot = false, ws = null, team = 0) {
    const validHeroId = GAME_DATA.HEROES[heroId] ? heroId : 'knight';
    const hero = GAME_DATA.HEROES[validHeroId];
    const sp = this.getSpawnPoint(this.players.size);

    if (this.mode === 'team' && team === 0) {
      let blue = 0, red = 0;
      for (const p of this.players.values()) {
        if (p.team === 1) blue++;
        else if (p.team === 2) red++;
      }
      team = blue <= red ? 1 : 2;
    }

    const player = {
      id,
      name: name || `Player ${id}`,
      isBot,
      ws,
      team, // 0 = FFA, 1 = Blue, 2 = Red
      heroId: validHeroId,
      x: sp.x,
      y: sp.y,
      z: sp.z,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: 0, // angle in radians on XZ plane
      grounded: false,
      hp: hero.maxHp,
      maxHp: hero.maxHp,
      mobilityGauge: 100,
      maxMobilityGauge: 100,
      jumpCount: 0,
      airDashCount: 0,
      dashUntil: 0,
      isSprinting: false,
      sprintLocked: false,
      isFlying: false,
      flyUntil: 0,
      hoverUntil: 0,
      flyExhausted: false,
      kills: 0,
      deaths: 0,
      score: 0,
      comboCount: 0,
      comboStep: 0,
      lastComboTime: 0,
      lastAttackTime: 0,
      attackHeldAt: null,
      targeting: null,
      lastSwapTime: 0,
      state: 'idle', // 'idle', 'run', 'jump', 'attack', 'heavy', 'skill', 'guard', 'hurt', 'knockdown', 'frozen', 'dead'
      stateUntil: 0,
      animSkillId: null,
      guarding: false,
      guardStartTime: 0,
      invulnUntil: Date.now() + 1500,
      superArmorUntil: 0,
      stealthUntil: 0,
      speedBuffUntil: 0,
      attackBuffUntil: 0,
      berserkUntil: 0,
      wraithUntil: 0,
      orbitSpheresUntil: 0,
      orbitTick: 0,
      frozenUntil: 0,
      burnUntil: 0,
      burnAttackerId: null,
      burnTick: 0,
      rootUntil: 0,
      lastHitBy: null,
      lastHitTime: 0,
      respawnAt: 0,
      bouncedOnLava: false,
      nextShrineHealAt: 0,
      // Authentic Lost Saga 4 Gear Slots: stores heroId of each equipped gear piece (or null if stripped!)
      gear: {
        weapon: validHeroId,
        armor: validHeroId,
        helmet: validHeroId,
        trinket: validHeroId
      },
      acquiredGear: new Set(),
      skillGauges: newSkillGauges(Date.now()),
      // Input state from client or AI
      input: {
        mx: 0,
        mz: 0,
        facing: 0,
        guard: false,
        jumpHeld: false,
        sprinting: false
      },
      aiTimer: 0,
      aiTargetId: null
    };

    this.players.set(id, player);
    return player;
  }

  addBot(heroId = null) {
    const heroKeys = Object.keys(GAME_DATA.HEROES);
    const chosenHero = heroId && GAME_DATA.HEROES[heroId]
      ? heroId
      : heroKeys[Math.floor(Math.random() * heroKeys.length)];
    const hero = GAME_DATA.HEROES[chosenHero];
    const botId = `bot_${nextEntityId++}`;
    const botNames = ['AI-Alpha', 'AI-Bravo', 'AI-Omega', 'AI-Striker', 'AI-Shadow', 'AI-Titan', 'AI-Valkyrie', 'AI-Rex'];
    const botName = `[BOT] ${hero.nameTh}`;
    const bot = this.createPlayer(botId, botName, chosenHero, true, null);
    this.emitFx('spawn', bot.x, bot.y, bot.z, { color: hero.color, text: `${bot.name} เข้าร่วม!` });
    return bot;
  }

  removeBots() {
    for (const [id, p] of this.players.entries()) {
      if (p.isBot) this.players.delete(id);
    }
  }

  emitFx(type, x, y, z, extra = {}) {
    this.fxEvents.push({
      id: nextEntityId++,
      type,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
      ...extra
    });
  }

  addKillFeed(killerName, victimName, methodTh, isRingOut = false) {
    this.killFeed.unshift({
      id: nextEntityId++,
      killer: killerName,
      victim: victimName,
      method: methodTh,
      isRingOut,
      time: Date.now()
    });
    if (this.killFeed.length > 6) this.killFeed.pop();
  }

  areEnemies(p1, p2) {
    if (!p1 || !p2 || p1.id === p2.id) return false;
    if (this.mode === 'team' && p1.team > 0 && p1.team === p2.team) return false;
    return true;
  }

  equippedSkill(player, slot) {
    return GAME_DATA.HEROES[player.gear[slot]]?.skills[slot];
  }

  addSkillCharge(player, amount, now) {
    if (!player || player.state === 'dead' || amount <= 0) return;
    for (const slot of GAME_DATA.GEAR_SLOTS) {
      const skill = this.equippedSkill(player, slot);
      if (!skill || skill.type === 'passive') continue;
      const gauge = player.skillGauges[slot];
      rechargeSkillGauge(gauge, skill, now);
      gauge.charge = Math.min(100, gauge.charge + amount);
    }
  }

  chargeFromDamage(attacker, victim, damage, now) {
    this.addSkillCharge(attacker, damage * SKILL_CHARGE_DEALT, now);
    this.addSkillCharge(victim, damage * SKILL_CHARGE_TAKEN, now);
  }

  canAttack(player) {
    return !['dead', 'hurt', 'knockdown', 'frozen'].includes(player.state);
  }

  isTargetable(player, target, now) {
    return this.areEnemies(player, target) && target.state !== 'dead' && now >= target.stealthUntil;
  }

  targetInRange(player, target, range, height, now) {
    return this.isTargetable(player, target, now) &&
      Math.abs(player.y - target.y) <= height && distXZ(player, target) <= range;
  }

  findTarget(player, range, height, now, direction = null, origin = player) {
    let nearest = null;
    let bestDistance = Infinity;
    for (const candidate of this.players.values()) {
      if (candidate === origin || !this.targetInRange(player, candidate, range, height, now)) continue;
      const dx = candidate.x - origin.x;
      const dz = candidate.z - origin.z;
      const distance = Math.hypot(dx, dz);
      if (direction && (dx * direction.dx + dz * direction.dz <= distance * 0.5)) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = candidate;
      }
    }
    return nearest;
  }

  faceTarget(player, target) {
    if (!target || (target.x === player.x && target.z === player.z)) return;
    player.facing = Math.atan2(target.z - player.z, target.x - player.x);
    player.input.facing = player.facing;
  }

  clearTargeting(player) {
    player.attackHeldAt = null;
    player.targeting = null;
  }

  lockedTarget(player, now) {
    const lock = player.targeting;
    if (!lock) return null;
    const target = this.players.get(lock.targetId);
    return this.targetInRange(player, target, lock.range, TARGET_HEIGHT_LIMIT, now) ? target : null;
  }

  updateTargeting(player, now) {
    if (!this.canAttack(player)) {
      this.clearTargeting(player);
      return null;
    }
    if (player.targeting?.mode === 'skill') {
      const { slot, gearHeroId, expiresAt } = player.targeting;
      if (now >= expiresAt || player.gear[slot] !== gearHeroId) player.targeting = null;
    }
    if (!player.targeting && player.attackHeldAt !== null &&
        now - player.attackHeldAt >= GAME_DATA.RANGED_AIM_HOLD_MS) {
      const range = GAME_DATA.HEROES[player.heroId].basicAttack.range;
      player.targeting = { mode: 'ranged', range, targetId: null };
    }
    if (!player.targeting) return null;

    const target = this.lockedTarget(player, now) ||
      this.findTarget(player, player.targeting.range, TARGET_HEIGHT_LIMIT, now);
    player.targeting.targetId = target?.id ?? null;
    return target;
  }

  switchTarget(player, dx, dz) {
    const now = Date.now();
    const current = this.updateTargeting(player, now);
    if (!player.targeting) return;
    const distance = Math.hypot(dx, dz);
    const target = this.findTarget(player, player.targeting.range, TARGET_HEIGHT_LIMIT, now,
      { dx: dx / distance, dz: dz / distance }, current || player);
    if (target) {
      player.targeting.targetId = target.id;
      this.faceTarget(player, target);
    }
  }

  handleAttackInput(player, phase, isDashAttack) {
    const isJumpAttack = !player.grounded;
    if (phase === 'release') {
      if (player.attackHeldAt === null) return;
      const target = this.updateTargeting(player, Date.now());
      this.clearTargeting(player);
      this.performBasicAttack(player, isDashAttack, isJumpAttack, target);
    } else if (phase === 'press' && GAME_DATA.HEROES[player.heroId].attackType === 'ranged') {
      if (!this.canAttack(player) || player.attackHeldAt !== null) return;
      player.targeting = null;
      player.attackHeldAt = Date.now();
    } else {
      this.clearTargeting(player);
      this.performBasicAttack(player, isDashAttack, isJumpAttack);
    }
  }

  // Hot-swap hero mid-battle (Keys 1..0) - signature Lost Saga feature!
  swapHero(player, newHeroId) {
    const now = Date.now();
    if (player.state === 'dead') return;
    if (!GAME_DATA.HEROES[newHeroId] || player.heroId === newHeroId) return;
    if (now - player.lastSwapTime < 1500) {
      this.emitFx('text', player.x, player.y + 1.8, player.z, { text: 'รอคูลดาวน์สลับฮีโร่!', color: '#94a3b8' });
      return;
    }
    if (player.state === 'hurt' || player.state === 'knockdown' || player.state === 'frozen') {
      this.emitFx('text', player.x, player.y + 1.8, player.z, { text: 'สลับขณะถูกโจมตีไม่ได้!', color: '#f87171' });
      return;
    }

    const hpRatio = player.hp / player.maxHp;
    const newHero = GAME_DATA.HEROES[newHeroId];
    player.heroId = newHeroId;
    this.clearTargeting(player);
    player.maxHp = newHero.maxHp;
    player.hp = Math.max(10, Math.round(newHero.maxHp * hpRatio));
    player.lastSwapTime = now;

    // Swap the hero's own gear while retaining acquired gear and elapsed charge.
    for (const slot of GAME_DATA.GEAR_SLOTS) {
      const skill = this.equippedSkill(player, slot);
      if (skill && !player.acquiredGear.has(slot)) {
        rechargeSkillGauge(player.skillGauges[slot], skill, now);
        player.gear[slot] = newHeroId;
      }
    }

    // Mid-combo Relay Shockwave (pops nearby enemies up slightly for combo continuation!)
    player.state = 'idle';
    player.stateUntil = now + 150;
    this.emitFx('hero_swap', player.x, player.y, player.z, {
      color: newHero.color,
      heroName: newHero.nameTh
    });

    for (const other of this.players.values()) {
      if (this.areEnemies(player, other) && other.state !== 'dead' && distXZ(player, other) < 2.6 && Math.abs(player.y - other.y) < 2.2) {
        other.vy = Math.max(other.vy, 6.5);
        other.state = 'hurt';
        other.stateUntil = now + 450;
        this.emitFx('hit', other.x, other.y + 1, other.z, { color: newHero.accentColor, text: 'RELAY!' });
      }
    }
  }

  dropGear(player, slot, struck = false) {
    if (player.state === 'dead' || slot === 'weapon') return false;
    const skill = this.equippedSkill(player, slot);
    if (!skill) return false;
    const now = Date.now();
    const gauge = player.skillGauges[slot];
    rechargeSkillGauge(gauge, skill, now);
    const angle = struck ? Math.random() * Math.PI * 2 : 0;
    const speed = struck ? 2.5 + Math.random() * 2.5 : 0;
    this.droppedGears.push({
      id: `gear_${nextEntityId++}`,
      slot,
      heroId: player.gear[slot],
      gauge,
      manualDropBy: struck ? null : player.id,
      x: player.x,
      y: player.y + (struck ? 0.9 : 0.55),
      z: player.z,
      vx: Math.cos(angle) * speed,
      vy: struck ? 7.5 + Math.random() * 2.5 : 0,
      vz: Math.sin(angle) * speed,
      spawnedAt: now,
      expiresAt: now + 22000
    });
    player.gear[slot] = null;
    player.acquiredGear.delete(slot);
    player.skillGauges[slot] = null;
    if (player.targeting?.slot === slot) this.clearTargeting(player);
    return true;
  }

  // Mix & Match gear swap from My Item inventory (supports all 4 gear slots)
  equipGear(player, slot, gearHeroId) {
    const now = Date.now();
    if (player.state === 'dead') return false;
    if (!GAME_DATA.GEAR_SLOTS.includes(slot) || !GAME_DATA.HEROES[gearHeroId]) return false;
    if (player.state === 'hurt' || player.state === 'knockdown' || player.state === 'frozen') {
      this.emitFx('text', player.x, player.y + 1.8, player.z, { text: 'เปลี่ยนเกียร์ขณะถูกโจมตีไม่ได้!', color: '#f87171' });
      return false;
    }
    if (player.gear[slot] === gearHeroId) return false;

    const prevSkill = this.equippedSkill(player, slot);
    const prevGauge = player.skillGauges[slot];
    if (prevSkill && prevGauge) rechargeSkillGauge(prevGauge, prevSkill, now);
    const carriedCharge = prevGauge ? Math.min(100, prevGauge.charge) : 50;

    player.gear[slot] = gearHeroId;
    player.skillGauges[slot] = {
      charge: carriedCharge,
      updatedAt: now,
      nextUseAt: prevGauge ? Math.max(0, prevGauge.nextUseAt) : 0
    };
    if (slot !== 'weapon') {
      if (gearHeroId === player.heroId) player.acquiredGear.delete(slot);
      else player.acquiredGear.add(slot);
    }
    if (player.targeting?.slot === slot) this.clearTargeting(player);

    const gearHero = GAME_DATA.HEROES[gearHeroId];
    const slotLabel = GAME_DATA.GEAR_SLOT_LABELS[slot]?.th || slot;
    this.emitFx('pickup', player.x, player.y + 1.5, player.z, {
      text: `เปลี่ยน [${slotLabel}] ${gearHero.nameTh}!`,
      color: gearHero.accentColor || '#4ade80'
    });
    return true;
  }

  stripOneGear(victim) {
    const slot = ['helmet', 'trinket', 'armor'].find(slot => victim.gear[slot] !== null);
    if (!slot || !this.dropGear(victim, slot, true)) return false;
    this.emitFx('gear_break', victim.x, victim.y + 1.4, victim.z, {
      text: `เกราะหลุด! (${GAME_DATA.GEAR_SLOT_LABELS[slot].th})`,
      color: '#fbbf24'
    });
    return true;
  }

  // Apply Damage, Guard Check, Perfect Parry, Knockback, and Lost Saga Gear Strip!
  applyDamage(attacker, victim, opts = {}) {
    const now = Date.now();
    if (!victim || victim.state === 'dead') return false;
    if (now < victim.invulnUntil || now < victim.wraithUntil) {
      this.emitFx('text', victim.x, victim.y + 1.5, victim.z, { text: 'MISS / อมตะ', color: '#94a3b8' });
      return false;
    }

    const {
      damage = 10,
      knockback = 3.5,
      launchY = 0,
      stunMs = 450,
      guardBreak = false,
      freeze = false,
      burn = false,
      root = false,
      lifesteal = 0,
      stripChance = 0,
      skillNameTh = 'โจมตี',
      dirX = null,
      dirZ = null
    } = opts;

    // Direction vector from attacker to victim
    let dx = dirX !== null ? dirX : (victim.x - (attacker ? attacker.x : victim.x));
    let dz = dirZ !== null ? dirZ : (victim.z - (attacker ? attacker.z : victim.z));
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    // Check Guard / Perfect Counter
    if (victim.guarding && !guardBreak && victim.state !== 'hurt' && victim.state !== 'knockdown' && victim.state !== 'frozen') {
      // Check if attack is roughly from the front
      const faceX = Math.cos(victim.facing);
      const faceZ = Math.sin(victim.facing);
      const dot = (-dx) * faceX + (-dz) * faceZ;
      if (dot > -0.25) {
        const guardDuration = now - victim.guardStartTime;
        if (guardDuration < 260 && attacker) {
          // PERFECT GUARD / COUNTER!
          this.emitFx('parry', victim.x, victim.y + 1.2, victim.z, {
            text: 'PERFECT GUARD!',
            color: '#38bdf8',
            heroId: victim.heroId,
            playerId: victim.id,
            facing: victim.facing,
            originX: victim.x,
            originY: victim.y,
            originZ: victim.z
          });
          attacker.state = 'hurt';
          attacker.stateUntil = now + 900;
          attacker.vx = -dx * 6.0;
          attacker.vz = -dz * 6.0;
          return false;
        } else {
          // Normal Block reduces damage by 80%
          const chip = Math.max(1, Math.round(damage * 0.2));
          this.chargeFromDamage(attacker, victim, Math.min(chip, victim.hp - 1), now);
          victim.hp = Math.max(1, victim.hp - chip);
          victim.vx = dx * (knockback * 0.35);
          victim.vz = dz * (knockback * 0.35);
          this.emitFx('block', victim.x, victim.y + 1.0, victim.z, {
            text: `BLOCK (-${chip})`,
            color: '#60a5fa',
            heroId: victim.heroId,
            playerId: victim.id,
            facing: victim.facing,
            originX: victim.x,
            originY: victim.y,
            originZ: victim.z
          });
          return false;
        }
      }
    }

    // Calculate final damage with buffs
    let finalDmg = damage;
    if (attacker && now < attacker.attackBuffUntil) finalDmg = Math.round(finalDmg * 1.4);
    if (now < victim.superArmorUntil) finalDmg = Math.round(finalDmg * 0.55);

    this.chargeFromDamage(attacker, victim, Math.min(finalDmg, victim.hp), now);
    victim.hp -= finalDmg;
    if (attacker) {
      victim.lastHitBy = attacker.id;
      victim.lastHitTime = now;
      attacker.comboCount = (attacker.comboCount || 0) + 1;
      if (lifesteal > 0 || now < attacker.berserkUntil) {
        const heal = Math.max(2, Math.round(finalDmg * (lifesteal || 0.35)));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        this.emitFx('heal', attacker.x, attacker.y + 1.5, attacker.z, { text: `+${heal} HP`, color: '#4ade80' });
      }
    }

    // Break stealth if hit
    victim.stealthUntil = 0;

    // Status effects
    if (burn) {
      victim.burnUntil = now + 3500;
      victim.burnAttackerId = attacker ? attacker.id : null;
    }
    if (root) {
      victim.rootUntil = now + 2200;
    }

    // Apply Knockback & Stun unless victim has Super Armor
    const hasSuperArmor = now < victim.superArmorUntil || now < victim.berserkUntil;
    if (!hasSuperArmor || freeze) {
      victim.vx = dx * knockback * 2.2;
      victim.vz = dz * knockback * 2.2;
      if (launchY > 0) {
        victim.vy = launchY;
        victim.grounded = false;
      } else if (Math.abs(knockback) >= 6.5) {
        victim.vy = Math.max(victim.vy, 6.2);
        victim.grounded = false;
      }

      if (freeze) {
        victim.state = 'frozen';
        victim.frozenUntil = now + Math.max(1400, stunMs);
        victim.stateUntil = victim.frozenUntil;
        this.emitFx('freeze', victim.x, victim.y + 1.0, victim.z, { text: 'FROZEN! แช่แข็ง!', color: '#67e8f9' });
      } else if (Math.abs(knockback) >= 7.0 || launchY >= 8.5) {
        victim.state = 'knockdown';
        victim.stateUntil = now + Math.max(950, stunMs);
      } else {
        victim.state = 'hurt';
        victim.stateUntil = now + stunMs;
      }
    }

    this.emitFx('hit', victim.x, victim.y + 1.1, victim.z, {
      damage: finalDmg,
      guardBreak,
      color: guardBreak ? '#facc15' : '#f87171'
    });

    // Bonus chance to strip gear (e.g. Reaper Scythe)
    if (stripChance > 0 && Math.random() < stripChance && victim.hp > 0) {
      this.stripOneGear(victim);
    }

    // Check Authentic Lost Saga 0 HP Gear Strip vs KO!
    if (victim.hp <= 0) {
      // Does victim still have armor, helmet, or trinket to lose before dying?
      const stripped = this.stripOneGear(victim);
      if (stripped) {
        // Survived by losing a piece of equipment!
        victim.hp = 18;
        victim.vy = Math.max(victim.vy, 7.5);
        victim.grounded = false;
        victim.state = 'knockdown';
        victim.stateUntil = now + 1000;
        victim.invulnUntil = now + 650;
      } else {
        // With no transferable gear left to lose, this hit is a KO.
        this.killPlayer(victim, attacker, skillNameTh, false);
      }
    }

    return true;
  }

  killPlayer(victim, attacker, methodTh = 'KO', isRingOut = false) {
    const now = Date.now();
    if (victim.state === 'dead') return;
    victim.hp = 0;
    victim.state = 'dead';
    this.clearTargeting(victim);
    victim.respawnAt = now + 3000;
    victim.deaths++;
    victim.vx = 0;
    victim.vz = 0;

    let killer = attacker;
    if (!killer && victim.lastHitBy && now - victim.lastHitTime < 7500) {
      killer = this.players.get(victim.lastHitBy) || null;
    }

    if (killer && killer.id !== victim.id) {
      killer.kills++;
      killer.score += isRingOut ? 150 : 100;
      this.addKillFeed(killer.name, victim.name, isRingOut ? `${methodTh} (ตกเหว!)` : methodTh, isRingOut);
      this.emitFx('ko', victim.x, Math.max(-2, victim.y + 1.0), victim.z, {
        text: isRingOut ? 'RING OUT! ตกขอบ!' : 'K.O.!',
        killerName: killer.name,
        victimName: victim.name,
        color: isRingOut ? '#38bdf8' : '#ef4444'
      });
    } else {
      this.addKillFeed(victim.name, victim.name, isRingOut ? 'พลัดตกเหว!' : 'K.O.', isRingOut);
      this.emitFx('ko', victim.x, Math.max(-2, victim.y + 1.0), victim.z, {
        text: isRingOut ? 'FALL OUT!' : 'K.O.!',
        victimName: victim.name,
        color: '#f97316'
      });
    }
  }

  respawnPlayer(player) {
    const hero = GAME_DATA.HEROES[player.heroId] || GAME_DATA.HEROES.knight;
    const sp = this.getSpawnPoint(Math.floor(Math.random() * 8));
    player.x = sp.x;
    player.y = sp.y;
    player.z = sp.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.grounded = false;
    player.hp = hero.maxHp;
    player.maxHp = hero.maxHp;
    player.mobilityGauge = 100;
    player.jumpCount = 0;
    player.airDashCount = 0;
    player.dashUntil = 0;
    player.isSprinting = false;
    player.sprintLocked = false;
    player.isFlying = false;
    player.flyUntil = 0;
    player.hoverUntil = 0;
    player.flyExhausted = false;
    player.state = 'idle';
    this.clearTargeting(player);
    player.stateUntil = 0;
    player.invulnUntil = Date.now() + 2000;
    player.frozenUntil = 0;
    player.burnUntil = 0;
    player.rootUntil = 0;
    player.bouncedOnLava = false;
    player.nextShrineHealAt = 0;
    player.lastHitBy = null;
    player.lastHitTime = 0;
    // Restore default gear for current hero on respawn
    player.gear = {
      weapon: player.heroId,
      armor: player.heroId,
      helmet: player.heroId,
      trinket: player.heroId
    };
    player.skillGauges = newSkillGauges(Date.now());
    player.acquiredGear.clear();
    this.emitFx('spawn', player.x, player.y, player.z, {
      color: hero.color,
      text: 'RESPAWN!'
    });
  }

  // ==========================================================================
  // LOST SAGA MOBILITY: Multi-Jump (Double/Triple Jump), Flight/Hover Mode,
  // Ground Dash, Flash Step, Tumble Roll, and Air Dash (with Mobility Gauge!)
  // ==========================================================================
  performJumpOrFly(player) {
    const now = Date.now();
    if (player.state === 'dead' || player.state === 'frozen' || player.state === 'knockdown' || player.state === 'hurt') return;

    const hero = GAME_DATA.HEROES[player.heroId] || GAME_DATA.HEROES.knight;
    const mob = hero.mobility || {};

    // 1. First Jump from Ground
    if (player.grounded) {
      const isDashJump = now < player.dashUntil;
      player.vy = hero.jumpForce * (isDashJump ? 1.12 : 1.0);
      if (isDashJump) {
        player.vx *= 1.3;
        player.vz *= 1.3;
      }
      player.grounded = false;
      player.jumpCount = 1;
      player.isFlying = false;
      player.flyExhausted = false;
      player.state = 'jump';
      this.emitFx('jump', player.x, player.y, player.z, { color: hero.accentColor });
      return;
    }

    // Cannot fly or air-jump if gauge is exhausted until landing on the ground!
    if (player.flyExhausted || player.mobilityGauge <= 0) {
      player.isFlying = false;
      player.flyUntil = 0;
      return;
    }

    // 2. Airborne Press of Space: Either Activate Flight/Hover OR Double/Triple Air Jump!
    if (mob.canFly) {
      const cost = mob.airJumpCost || 16;
      if (player.mobilityGauge >= cost) {
        player.mobilityGauge = Math.max(0, player.mobilityGauge - cost);
        player.vy = Math.max(player.vy, hero.jumpForce * 0.65);
        player.flyUntil = now + 1200;
        player.isFlying = true;
        player.jumpCount = Math.min((mob.maxJumps || 2), player.jumpCount + 1);
        if (player.mobilityGauge <= 0) {
          player.flyExhausted = true;
          player.isFlying = false;
          player.flyUntil = 0;
        }
        this.emitFx('air_jump', player.x, player.y, player.z, {
          color: hero.accentColor,
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
      }
      return;
    }

    // 3. Double Jump / Triple Jump (Ninja has 3 jumps, others have 2 jumps!)
    const maxJumps = (mob.maxJumps || 2) + (this.equippedSkill(player, 'helmet')?.passive?.extraJumps ?? 0);
    if (player.jumpCount < maxJumps) {
      const cost = mob.airJumpCost || 22;
      if (player.mobilityGauge >= cost) {
        player.mobilityGauge = Math.max(0, player.mobilityGauge - cost);
        player.jumpCount++;
        player.vy = hero.jumpForce * (player.jumpCount === 3 ? 0.94 : 0.98);

        const imx = player.input.mx || 0;
        const imz = player.input.mz || 0;
        if (Math.hypot(imx, imz) > 0.1) {
          const ang = Math.atan2(imz, imx);
          player.facing = ang;
          player.vx = Math.cos(ang) * hero.speed * 1.25;
          player.vz = Math.sin(ang) * hero.speed * 1.25;
        }

        this.emitFx('air_jump', player.x, player.y, player.z, {
          color: hero.accentColor,
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
      }
    }
  }

  performDash(player, dirXOverride = null, dirZOverride = null) {
    const now = Date.now();
    if (player.state === 'dead' || player.state === 'frozen' || player.state === 'knockdown' || player.state === 'hurt') return;
    if (now < player.dashUntil - 100) return;

    const hero = GAME_DATA.HEROES[player.heroId] || GAME_DATA.HEROES.knight;
    const mob = hero.mobility || {};

    // Check Air Dash eligibility if airborne
    if (!player.grounded) {
      if ((!mob.canAirDash && !mob.canFly) || player.flyExhausted) {
        return;
      }
      if (player.airDashCount >= 2) return;
    }

    const cost = mob.dashCost || 20;
    if (player.mobilityGauge < cost) {
      return;
    }

    player.mobilityGauge = Math.max(0, player.mobilityGauge - cost);
    if (player.mobilityGauge <= 0 && !player.grounded) {
      player.flyExhausted = true;
      player.isFlying = false;
      player.flyUntil = 0;
    }
    player.dashUntil = now + 360;
    player.guarding = false;

    let dx = dirXOverride !== null ? dirXOverride : (player.input.mx || 0);
    let dz = dirZOverride !== null ? dirZOverride : (player.input.mz || 0);
    if (Math.hypot(dx, dz) < 0.1) {
      dx = Math.cos(player.facing);
      dz = Math.sin(player.facing);
    } else {
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      player.facing = Math.atan2(dz, dx);
    }

    const dashBurst = hero.speed * (mob.dashSpeedMult || 1.7) * 1.65;
    player.vx = dx * dashBurst;
    player.vz = dz * dashBurst;

    if (!player.grounded) {
      player.airDashCount++;
      player.vy = Math.max(1.5, player.vy * 0.35);
    }

    if (mob.type === 'flash_step' || mob.type === 'double_jump_tumble' || mob.type === 'sway_airdash') {
      player.invulnUntil = Math.max(player.invulnUntil, now + 240);
    } else if (mob.type === 'armored_sprint' || mob.type === 'bull_charge') {
      player.superArmorUntil = Math.max(player.superArmorUntil, now + 450);
    } else if (mob.type === 'hover_fly') {
      player.x += dx * 1.1;
      player.z += dz * 1.1;
    }

    this.emitFx('dash', player.x, player.y + 0.5, player.z, {
      color: hero.accentColor,
      heroId: player.heroId,
      playerId: player.id,
      facing: player.facing,
      originX: player.x,
      originY: player.y,
      originZ: player.z,
      isAir: !player.grounded
    });
  }

  // ==========================================================================
  // COMBAT ACTIONS: Basic Attack (J), Ranged Aim (Hold J), Heavy Attack (K),
  // Jump and Sprint Attacks, and Gear Skills (Q/E/R/F)
  // ==========================================================================
  performBasicAttack(player, isDashAttack = false, isJumpAttack = false, lockedTarget = null) {
    const now = Date.now();
    if (!this.canAttack(player)) return;
    if (now < player.stateUntil && player.state === 'skill') return;

    const hero = GAME_DATA.HEROES[player.heroId];
    const cd = hero.basicAttack.cooldown;
    if (now - player.lastAttackTime < cd) return;

    player.lastAttackTime = now;
    player.guarding = false;
    player.stealthUntil = 0;

    // Advance combo step (1 -> 2 -> 3/4)
    if (now - player.lastComboTime > 900) {
      player.comboStep = 0;
    }
    player.comboStep = (player.comboStep % hero.basicAttack.comboHits) + 1;
    player.lastComboTime = now;

    const isFinisher = player.comboStep === hero.basicAttack.comboHits || isDashAttack || isJumpAttack;
    player.state = 'attack';
    player.stateUntil = now + Math.round(cd * 0.85);

    const melee = hero.attackType === 'melee';
    const range = hero.basicAttack.range * (melee && isDashAttack ? 1.25 : 1);
    const target = lockedTarget || this.findTarget(player, range, melee ? 2.3 : TARGET_HEIGHT_LIMIT, now);
    this.faceTarget(player, target);
    const dirX = Math.cos(player.facing);
    const dirZ = Math.sin(player.facing);

    // Slight forward step on melee swings
    if (melee) {
      const lunge = isDashAttack ? 7.5 : (isFinisher ? 4.2 : 2.4);
      player.vx = dirX * lunge;
      player.vz = dirZ * lunge;

      this.emitFx('slash', player.x + dirX * 1.1, player.y + 0.9, player.z + dirZ * 1.1, {
        facing: player.facing,
        color: hero.accentColor,
        heroId: player.heroId,
        playerId: player.id,
        originX: player.x,
        originY: player.y,
        originZ: player.z,
        weaponType: hero.weaponType,
        comboStep: player.comboStep,
        isFinisher
      });

      const dmg = Math.round(hero.basicAttack.damage * (isFinisher ? 1.35 : 1.0));
      const kb = hero.basicAttack.knockback * (isFinisher ? 1.7 : 0.85);
      const launchY = (isFinisher && player.heroId === 'striker') ? 7.5 : (isJumpAttack ? 5.5 : 0);

      for (const target of this.players.values()) {
        if (!this.areEnemies(player, target) || target.state === 'dead') continue;
        // Check knocked-down targets (Striker & Jump attacks can hit grounded!)
        if (distXZ(player, target) <= range && Math.abs(player.y - target.y) <= 2.3) {
          const toX = target.x - player.x;
          const toZ = target.z - player.z;
          const dist = Math.hypot(toX, toZ) || 1;
          const dot = (toX / dist) * dirX + (toZ / dist) * dirZ;
          if (dot > 0.1 || dist < 1.2) {
            this.applyDamage(player, target, {
              damage: dmg,
              knockback: kb,
              launchY,
              stunMs: isFinisher ? 650 : 380,
              skillNameTh: hero.nameTh
            });
          }
        }
      }

      // Samurai Blood Aura bonus wave!
      if (now < player.attackBuffUntil) {
        this.spawnProjectile(player, {
          type: 'wave',
          x: player.x + dirX * 1.0,
          y: player.y + 0.9,
          z: player.z + dirZ * 1.0,
          vx: dirX * 15,
          vy: 0,
          vz: dirZ * 15,
          radius: 1.0,
          damage: 9,
          knockback: 3.5,
          color: '#ef4444',
          ttl: 600,
          skillNameTh: 'คลื่นดาบโลหิต'
        });
      }
    } else {
      // Ranged Basic Attack (Mage, Cowboy, Witch, Cyborg)
      const projSpeed = player.heroId === 'cowboy' ? 22 : (player.heroId === 'cyborg' ? 20 : 16);
      const projType = player.heroId === 'mage' ? 'fireball'
        : player.heroId === 'witch' ? 'icebolt'
        : player.heroId === 'cyborg' ? 'plasma'
        : 'bullet';
      const muzzleOffset = target ? Math.min(0.9, distXZ(player, target) * 0.5) : 0.9;
      const shotX = player.x + dirX * muzzleOffset;
      const shotY = player.y + 0.95;
      const shotZ = player.z + dirZ * muzzleOffset;
      const shotPitch = target
        ? Math.atan2(target.y + 0.9 - shotY, Math.hypot(target.x - shotX, target.z - shotZ))
        : Math.asin((isJumpAttack ? -3.5 : 0) / projSpeed);
      const speedXZ = projSpeed * Math.cos(shotPitch);

      this.emitFx('muzzle', shotX, player.y + 1.0, shotZ, {
        facing: player.facing,
        heroId: player.heroId,
        playerId: player.id,
        originX: player.x,
        originY: player.y,
        originZ: player.z,
        comboStep: player.comboStep,
        isFinisher,
        color: hero.accentColor
      });

      this.spawnProjectile(player, {
        type: projType,
        x: shotX,
        y: shotY,
        z: shotZ,
        vx: dirX * speedXZ,
        vy: projSpeed * Math.sin(shotPitch),
        vz: dirZ * speedXZ,
        targetId: lockedTarget?.id,
        radius: 0.65,
        damage: Math.round(hero.basicAttack.damage * (isFinisher ? 1.3 : 1.0)),
        knockback: hero.basicAttack.knockback * (isFinisher ? 1.5 : 0.9),
        color: hero.accentColor,
        ttl: Math.round((hero.basicAttack.range / projSpeed) * 1000),
        burn: player.heroId === 'mage' && isFinisher,
        freeze: player.heroId === 'witch' && isFinisher,
        skillNameTh: hero.nameTh
      });
    }
  }

  // Heavy Attack (Right Click / K)
  performHeavyAttack(player) {
    const now = Date.now();
    if (!this.canAttack(player)) return;
    if (now - player.lastAttackTime < 550) return;

    const hero = GAME_DATA.HEROES[player.heroId];
    const heavy = hero.heavyAttack;
    player.lastAttackTime = now;
    player.state = 'heavy';
    player.stateUntil = now + 520;
    player.guarding = false;
    player.stealthUntil = 0;
    this.clearTargeting(player);

    const range = player.heroId === 'ninja' ? 6.5 : heavy.range;
    const target = this.findTarget(player, range, 2.5, now);
    this.faceTarget(player, target);
    const dirX = Math.cos(player.facing);
    const dirZ = Math.sin(player.facing);

    this.emitFx('heavy_cast', player.x, player.y + 1.0, player.z, {
      facing: player.facing,
      heroId: player.heroId,
      playerId: player.id,
      originX: player.x,
      originY: player.y,
      originZ: player.z,
      color: hero.accentColor,
      text: heavy.nameTh.split(' ')[0]
    });

    // Special hero-specific heavy attack implementations
    if (player.heroId === 'ninja') {
      // Shadow Backstab: teleport behind the nearest enemy.
      const bestTarget = target;
      if (bestTarget) {
        const backX = bestTarget.x - Math.cos(bestTarget.facing) * 1.2;
        const backZ = bestTarget.z - Math.sin(bestTarget.facing) * 1.2;
        this.emitFx('teleport', player.x, player.y, player.z, {
          color: '#a855f7',
          heroId: 'ninja',
          playerId: player.id,
          isArrival: false,
          facing: player.facing
        });
        player.x = backX;
        player.z = backZ;
        player.y = bestTarget.y;
        this.faceTarget(player, bestTarget);
        this.emitFx('teleport', player.x, player.y, player.z, {
          color: '#a855f7',
          heroId: 'ninja',
          playerId: player.id,
          isArrival: true,
          facing: player.facing
        });
        this.applyDamage(player, bestTarget, {
          damage: heavy.damage,
          knockback: heavy.knockback,
          launchY: 8.5,
          stunMs: heavy.stunMs,
          guardBreak: true,
          skillNameTh: heavy.nameTh
        });
      } else {
        player.vx = dirX * 10;
        player.vz = dirZ * 10;
        this.emitFx('heavy_impact', player.x + dirX * 1.2, player.y + 0.9, player.z + dirZ * 1.2, {
          facing: player.facing,
          heroId: 'ninja',
          playerId: player.id,
          originX: player.x,
          originY: player.y,
          originZ: player.z,
          color: hero.accentColor
        });
      }
      return;
    }

    if (player.heroId === 'samurai') {
      // Iaido Flash Cut: Dash through enemies in a line!
      const startX = player.x, startZ = player.z;
      player.x += dirX * 4.8;
      player.z += dirZ * 4.8;
      this.emitFx('iaido_line', startX, player.y + 0.9, startZ, {
        tx: player.x,
        tz: player.z,
        color: '#f472b6',
        heroId: 'samurai',
        playerId: player.id,
        facing: player.facing,
        originX: startX,
        originY: player.y,
        originZ: startZ
      });
      for (const t of this.players.values()) {
        if (this.areEnemies(player, t) && t.state !== 'dead') {
          // Check distance to segment
          const midX = (startX + player.x) * 0.5;
          const midZ = (startZ + player.z) * 0.5;
          if (Math.hypot(t.x - midX, t.z - midZ) <= 3.0 && Math.abs(t.y - player.y) < 2.2) {
            this.applyDamage(player, t, {
              damage: heavy.damage,
              knockback: heavy.knockback,
              launchY: 7.0,
              stunMs: heavy.stunMs,
              guardBreak: true,
              skillNameTh: heavy.nameTh
            });
          }
        }
      }
      return;
    }

    if (player.heroId === 'cowboy' || player.heroId === 'cyborg') {
      // High-velocity piercing Deadeye shot / Railgun laser beam
      this.spawnProjectile(player, {
        type: player.heroId === 'cyborg' ? 'railgun' : 'magnum',
        x: player.x + dirX * 1.0,
        y: player.y + 1.0,
        z: player.z + dirZ * 1.0,
        vx: dirX * 28,
        vy: 0,
        vz: dirZ * 28,
        radius: 0.9,
        pierce: true,
        damage: heavy.damage,
        knockback: heavy.knockback,
        guardBreak: true,
        stunMs: heavy.stunMs,
        color: hero.accentColor,
        ttl: 500,
        skillNameTh: heavy.nameTh
      });
      return;
    }

    // Cone / AoE Heavy Attacks (Knight Shield Bash, Mage Dragon Pillar, Witch Freeze Breath, Viking Whirlwind, Striker Tiger Uppercut, Reaper Soul Hook)
    player.vx = dirX * 5.0;
    player.vz = dirZ * 5.0;
    if (player.heroId === 'striker') {
      player.vy = 7.5;
      player.grounded = false;
    }

    this.emitFx('heavy_impact', player.x + dirX * 1.5, player.y + 0.9, player.z + dirZ * 1.5, {
      facing: player.facing,
      heroId: player.heroId,
      playerId: player.id,
      originX: player.x,
      originY: player.y,
      originZ: player.z,
      color: hero.accentColor
    });

    for (const t of this.players.values()) {
      if (!this.areEnemies(player, t) || t.state === 'dead') continue;
      const d = distXZ(player, t);
      if (d <= heavy.range && Math.abs(player.y - t.y) <= 2.5) {
        const toX = t.x - player.x;
        const toZ = t.z - player.z;
        const dot = (toX / (d || 1)) * dirX + (toZ / (d || 1)) * dirZ;
        // Viking Whirlwind hits 360 degrees; others hit forward arc
        if (player.heroId === 'viking' || dot > 0.0 || d < 1.5) {
          this.applyDamage(player, t, {
            damage: heavy.damage,
            knockback: heavy.knockback,
            launchY: heavy.launchY || (heavy.knockback > 6 ? 6.5 : 0),
            stunMs: heavy.stunMs,
            guardBreak: true,
            freeze: !!heavy.freeze,
            burn: player.heroId === 'mage',
            skillNameTh: heavy.nameTh
          });
        }
      }
    }
  }

  // ==========================================================================
  // GEAR SKILLS (Weapon: Q, Armor: E, Helmet: R, Trinket: F)
  // Remember: A player casts the skill of the GEAR PIECE currently equipped in that slot!
  // ==========================================================================
  castGearSkill(player, slot) {
    const now = Date.now();
    if (player.state === 'dead') return;
    if (!GAME_DATA.GEAR_SLOTS.includes(slot)) return;

    // Check if the player actually has gear in this slot (not knocked off!)
    const equippedGearHeroId = player.gear[slot];
    if (!equippedGearHeroId) {
      this.emitFx('text', player.x, player.y + 1.8, player.z, {
        text: `ไม่มีอุปกรณ์ช่อง ${slot.toUpperCase()}! (เก็บที่พื้น)`,
        color: '#f87171'
      });
      return;
    }

    const skill = this.equippedSkill(player, slot);
    if (!skill || skill.type === 'passive') return;

    const gauge = player.skillGauges[slot];
    rechargeSkillGauge(gauge, skill, now);
    if (gauge.charge < skill.gaugeCost || now < gauge.nextUseAt) return;

    // Can this skill be cast while stunned/hurt/frozen? (Many Armor skills can!)
    const isIncapacitated = player.state === 'hurt' || player.state === 'knockdown' || player.state === 'frozen';
    if (isIncapacitated && !skill.usableWhileHit) {
      return;
    }

    let target;
    if (skill.confirmTarget && !player.isBot) {
      const lock = player.targeting;
      if (lock?.mode !== 'skill' || lock.slot !== slot || lock.gearHeroId !== equippedGearHeroId || now >= lock.expiresAt) {
        this.clearTargeting(player);
        player.targeting = {
          mode: 'skill', slot, gearHeroId: equippedGearHeroId, range: skill.aimRange,
          expiresAt: now + SKILL_TARGET_TIMEOUT, targetId: null
        };
        this.faceTarget(player, this.updateTargeting(player, now));
        return;
      }
      target = this.lockedTarget(player, now);
      if (!target) return;
    } else if (skill.aimRange) {
      target = this.findTarget(player, skill.aimRange, TARGET_HEIGHT_LIMIT, now);
    }

    this.clearTargeting(player);
    this.faceTarget(player, target);
    gauge.charge -= skill.gaugeCost;
    gauge.nextUseAt = now + (skill.repeatMs ?? 550);
    if (isIncapacitated) {
      player.vx = 0;
      player.vz = 0;
      if (!player.grounded) player.vy = Math.max(0, player.vy);
    }
    if (skill.usableWhileHit) {
      player.frozenUntil = 0;
      player.rootUntil = 0;
    }
    player.state = 'skill';
    player.stateUntil = now + 550;
    player.animSkillId = skill.id;
    player.guarding = false;

    const dirX = Math.cos(player.facing);
    const dirZ = Math.sin(player.facing);

    // Announce skill callout in 3D world!
    this.emitFx('skill_cast', player.x, player.y + 1.5, player.z, {
      skillId: skill.id,
      skillNameTh: skill.nameTh,
      slot,
      heroId: player.heroId,
      playerId: player.id,
      originX: player.x,
      originY: player.y,
      originZ: player.z,
      color: skill.color,
      facing: player.facing
    });

    // Execute specific skill logic among the 40 skills
    switch (skill.id) {
      // ----------------------------------------------------------------------
      // 1. IRON KNIGHT SKILLS
      // ----------------------------------------------------------------------
      case 'knight_weapon': { // Excalibur Wave
        this.spawnProjectile(player, {
          type: 'crescent_wave',
          x: player.x + dirX * 1.2,
          y: player.y + 1.0,
          z: player.z + dirZ * 1.2,
          vx: dirX * 16,
          vy: 0,
          vz: dirZ * 16,
          radius: 1.8,
          pierce: true,
          damage: 26,
          knockback: 8.5,
          launchY: 9.5,
          guardBreak: true,
          color: '#fbbf24',
          ttl: 900,
          skillNameTh: skill.nameTh
        });
        break;
      }
      case 'knight_armor': { // Aegis Fortress
        player.superArmorUntil = now + 5000;
        this.emitFx('shockwave', player.x, player.y + 0.5, player.z, { radius: 4.0, color: '#60a5fa', fromSkill: 'knight_armor' });
        this.hitAoE(player, player.x, player.y, player.z, 3.8, {
          damage: 15, knockback: 7.5, launchY: 6.0, stunMs: 900, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'knight_helmet': { // Lionheart Warcry
        player.hp = Math.min(player.maxHp, player.hp + 20);
        this.emitFx('shockwave', player.x, player.y + 1.0, player.z, { radius: 4.5, color: '#f59e0b', fromSkill: 'knight_helmet' });
        this.hitAoE(player, player.x, player.y, player.z, 4.3, {
          damage: 12, knockback: 3.0, stunMs: 1800, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'knight_trinket': { // Chariot Rush
        player.vx = dirX * 18.0;
        player.vz = dirZ * 18.0;
        player.superArmorUntil = now + 1200;
        this.hitLine(player, 6.0, 2.2, {
          damage: 22, knockback: 10.5, launchY: 6.0, stunMs: 1100, guardBreak: true,
          dirX, dirZ, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 2. SHADOW NINJA SKILLS
      // ----------------------------------------------------------------------
      case 'ninja_weapon': { // Izuna Blade Storm
        const startX = player.x, startZ = player.z;
        player.x += dirX * 5.2;
        player.z += dirZ * 5.2;
        this.emitFx('blade_storm', (startX + player.x) * 0.5, player.y + 1.0, (startZ + player.z) * 0.5, {
          color: '#a855f7',
          radius: 3.5,
          fromSkill: 'ninja_weapon',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: (startX + player.x) * 0.5,
          originY: player.y,
          originZ: (startZ + player.z) * 0.5
        });
        this.hitAoE(player, (startX + player.x) * 0.5, player.y, (startZ + player.z) * 0.5, 3.5, {
          damage: 28, knockback: 6.0, launchY: 11.0, stunMs: 1200, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'ninja_armor': { // Smoke Bomb Stealth
        player.stealthUntil = now + 4000;
        player.speedBuffUntil = now + 4000;
        player.invulnUntil = now + 600;
        this.emitFx('smoke', player.x, player.y + 0.8, player.z, {
          radius: 3.8,
          color: '#8b5cf6',
          fromSkill: 'ninja_armor',
          heroId: player.heroId,
          playerId: player.id
        });
        this.hitAoE(player, player.x, player.y, player.z, 3.5, {
          damage: 12, knockback: 5.0, stunMs: 1400, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'ninja_helmet': { // Fuuma Shuriken Fan (5 giant shurikens)
        for (let i = -2; i <= 2; i++) {
          const ang = player.facing + i * 0.22;
          this.spawnProjectile(player, {
            type: 'shuriken',
            x: player.x + Math.cos(ang) * 0.9,
            y: player.y + 1.0,
            z: player.z + Math.sin(ang) * 0.9,
            vx: Math.cos(ang) * 18,
            vy: 0,
            vz: Math.sin(ang) * 18,
            radius: 0.85,
            pierce: true,
            damage: 13,
            knockback: 5.5,
            color: '#c084fc',
            ttl: 750,
            skillNameTh: skill.nameTh
          });
        }
        break;
      }
      case 'ninja_trinket': { // Explosive Substitution
        this.hazards.push({
          id: nextEntityId++,
          ownerId: player.id,
          type: 'decoy_bomb',
          x: player.x,
          y: player.y,
          z: player.z,
          radius: 3.4,
          damage: 24,
          knockback: 8.5,
          launchY: 9.5,
          color: '#f43f5e',
          triggerAt: now + 450,
          expiresAt: now + 600,
          skillNameTh: skill.nameTh
        });
        player.vx = -dirX * 10;
        player.vz = -dirZ * 10;
        player.vy = 10.5;
        player.grounded = false;
        break;
      }

      // ----------------------------------------------------------------------
      // 3. FIRE ARCHMAGE SKILLS
      // ----------------------------------------------------------------------
      case 'mage_weapon': { // Meteor Apocalypse
        const tx = player.x + dirX * 5.0;
        const tz = player.z + dirZ * 5.0;
        this.emitFx('meteor_strike', tx, player.y, tz, {
          radius: 4.5,
          color: '#ef4444',
          fromSkill: 'mage_weapon',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz
        });
        this.hitAoE(player, tx, player.y, tz, 4.5, {
          damage: 30, knockback: 9.0, launchY: 11.0, stunMs: 1200, burn: true, guardBreak: true, skillNameTh: skill.nameTh
        });
        this.hazards.push({
          id: nextEntityId++,
          ownerId: player.id,
          type: 'lava_pool',
          x: tx, y: player.y, z: tz,
          radius: 3.8,
          damage: 6,
          color: '#f97316',
          nextTick: now + 500,
          expiresAt: now + 4000,
          skillNameTh: skill.nameTh
        });
        break;
      }
      case 'mage_armor': { // Supernova Ring
        this.emitFx('shockwave', player.x, player.y + 0.8, player.z, {
          radius: 4.5,
          color: '#f97316',
          fromSkill: 'mage_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 4.4, {
          damage: 19, knockback: 8.5, launchY: 7.5, burn: true, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'mage_helmet': { // Solar Orbit Spheres
        player.orbitSpheresUntil = now + 6000;
        break;
      }
      case 'mage_trinket': { // Flame Blink Warp
        const startX = player.x, startZ = player.z;
        this.emitFx('shockwave', startX, player.y + 0.5, startZ, {
          radius: 2.8,
          color: '#facc15',
          fromSkill: 'mage_trinket',
          isArrival: false,
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: startX,
          originY: player.y,
          originZ: startZ
        });
        this.hitAoE(player, player.x, player.y, player.z, 2.8, {
          damage: 12, knockback: 5.0, burn: true, skillNameTh: skill.nameTh
        });
        player.x += dirX * 6.0;
        player.z += dirZ * 6.0;
        this.emitFx('shockwave', player.x, player.y + 0.5, player.z, {
          radius: 2.8,
          color: '#ef4444',
          fromSkill: 'mage_trinket',
          isArrival: true,
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 2.8, {
          damage: 14, knockback: 6.0, burn: true, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 4. DESPERADO COWBOY SKILLS
      // ----------------------------------------------------------------------
      case 'cowboy_weapon': { // High Noon Barrage (360 bullet storm)
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI * 2 * i) / 12;
          this.spawnProjectile(player, {
            type: 'bullet',
            x: player.x + Math.cos(ang) * 0.8,
            y: player.y + 1.0,
            z: player.z + Math.sin(ang) * 0.8,
            vx: Math.cos(ang) * 20,
            vy: 0,
            vz: Math.sin(ang) * 20,
            radius: 0.75,
            damage: 16,
            knockback: 6.5,
            guardBreak: true,
            color: '#fbbf24',
            ttl: 600,
            skillNameTh: skill.nameTh
          });
        }
        this.hitAoE(player, player.x, player.y, player.z, 4.2, {
          damage: 18, knockback: 7.5, launchY: 7.0, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'cowboy_armor': { // TNT Dynamite Toss
        const tx = player.x + dirX * 4.5;
        const tz = player.z + dirZ * 4.5;
        this.emitFx('explosion', tx, player.y + 0.5, tz, {
          radius: 4.0,
          color: '#ef4444',
          fromSkill: 'cowboy_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz,
          startX: player.x,
          startZ: player.z
        });
        this.hitAoE(player, tx, player.y, tz, 4.0, {
          damage: 25, knockback: 8.5, launchY: 10.5, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'cowboy_helmet': { // Tactical Roll & Stun Shot
        player.invulnUntil = now + 500;
        player.vx = dirX * 12;
        player.vz = dirZ * 12;
        this.spawnProjectile(player, {
          type: 'magnum',
          x: player.x + dirX * 0.9,
          y: player.y + 1.0,
          z: player.z + dirZ * 0.9,
          vx: dirX * 24,
          vy: 0,
          vz: dirZ * 24,
          radius: 0.9,
          damage: 16,
          knockback: 5.0,
          stunMs: 1600,
          guardBreak: true,
          color: '#fde047',
          ttl: 600,
          skillNameTh: skill.nameTh
        });
        break;
      }
      case 'cowboy_trinket': { // Bounty Hunter Lasso (Pull enemy to you!)
        this.hitLine(player, 8.5, 2.2, {
          damage: 15,
          knockback: -9.5, // Negative knockback yanks target right toward cowboy!
          launchY: 5.5,
          stunMs: 1300,
          guardBreak: true,
          dirX, dirZ,
          skillNameTh: skill.nameTh
        });
        this.emitFx('lasso', player.x, player.y + 1.0, player.z, {
          tx: player.x + dirX * 8.0,
          tz: player.z + dirZ * 8.0,
          color: '#d97706',
          fromSkill: 'cowboy_trinket',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 5. RONIN SAMURAI SKILLS
      // ----------------------------------------------------------------------
      case 'samurai_weapon': { // Senbonzakura Storm
        const tx = player.x + dirX * 3.0;
        const tz = player.z + dirZ * 3.0;
        this.emitFx('sakura_storm', tx, player.y + 1.0, tz, {
          facing: player.facing,
          color: '#f472b6',
          radius: 3.8,
          fromSkill: 'samurai_weapon',
          heroId: player.heroId,
          playerId: player.id,
          originX: tx,
          originY: player.y,
          originZ: tz
        });
        this.hitAoE(player, tx, player.y, tz, 3.8, {
          damage: 28, knockback: 8.0, launchY: 9.0, stunMs: 1100, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'samurai_armor': { // Mind's Eye Counter
        player.invulnUntil = now + 700;
        this.emitFx('shockwave', player.x, player.y + 1.0, player.z, {
          radius: 4.5,
          color: '#ef4444',
          fromSkill: 'samurai_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 4.4, {
          damage: 22, knockback: 7.5, launchY: 9.5, stunMs: 1300, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'samurai_helmet': { // Asura Blood Aura
        player.attackBuffUntil = now + 6000;
        player.speedBuffUntil = now + 6000;
        this.emitFx('aura', player.x, player.y + 1.0, player.z, {
          color: '#dc2626',
          text: 'ASURA AURA!',
          fromSkill: 'samurai_helmet',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        break;
      }
      case 'samurai_trinket': { // Tsubame Gaeshi
        player.vy = 11.5;
        player.vx = dirX * 7.5;
        player.vz = dirZ * 7.5;
        player.grounded = false;
        this.hitAoE(player, player.x + dirX * 1.8, player.y, player.z + dirZ * 1.8, 3.2, {
          damage: 21, knockback: 5.5, launchY: 11.5, stunMs: 1000, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 6. FROST ICE WITCH SKILLS
      // ----------------------------------------------------------------------
      case 'witch_weapon': { // Eternal Blizzard
        const tx = player.x + dirX * 4.2;
        const tz = player.z + dirZ * 4.2;
        this.emitFx('blizzard', tx, player.y + 1.0, tz, {
          radius: 4.5,
          color: '#22d3ee',
          fromSkill: 'witch_weapon',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz
        });
        this.hitAoE(player, tx, player.y, tz, 4.5, {
          damage: 24, knockback: 4.0, freeze: true, stunMs: 2200, guardBreak: true, skillNameTh: skill.nameTh
        });
        this.hazards.push({
          id: nextEntityId++,
          ownerId: player.id,
          type: 'blizzard_zone',
          x: tx, y: player.y, z: tz,
          radius: 4.2,
          damage: 7,
          freeze: true,
          color: '#22d3ee',
          nextTick: now + 600,
          expiresAt: now + 3800,
          skillNameTh: skill.nameTh
        });
        break;
      }
      case 'witch_armor': { // Crystal Ice Tomb
        player.invulnUntil = now + 1500;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        this.emitFx('ice_tomb', player.x, player.y + 1.0, player.z, {
          radius: 4.0,
          color: '#67e8f9',
          fromSkill: 'witch_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 4.0, {
          damage: 16, knockback: 6.0, freeze: true, stunMs: 1800, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'witch_helmet': { // Glacial Spike Eruption
        this.emitFx('ice_spikes', player.x, player.y, player.z, {
          tx: player.x + dirX * 7.5,
          tz: player.z + dirZ * 7.5,
          color: '#38bdf8',
          fromSkill: 'witch_helmet',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitLine(player, 7.5, 2.4, {
          damage: 23, knockback: 6.5, launchY: 11.0, freeze: true, stunMs: 1500, guardBreak: true,
          dirX, dirZ, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'witch_trinket': { // Frost Skate Trail
        player.vx = dirX * 16.5;
        player.vz = dirZ * 16.5;
        player.speedBuffUntil = now + 3000;
        this.hitLine(player, 5.5, 2.2, {
          damage: 15, knockback: 4.0, freeze: true, stunMs: 1500, dirX, dirZ, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 7. CYBORG SKILLS
      // ----------------------------------------------------------------------
      case 'cyborg_weapon': { // Buster Beam
        this.emitFx('orbital_beam', player.x + dirX * 4.5, player.y, player.z + dirZ * 4.5, {
          facing: player.facing,
          color: '#38bdf8',
          radius: 3.8,
          fromSkill: 'cyborg_weapon',
          heroId: player.heroId,
          playerId: player.id,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitLine(player, 9.5, 2.6, {
          damage: 30, knockback: 9.0, launchY: 10.5, stunMs: 1100, guardBreak: true,
          dirX, dirZ, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'cyborg_armor': { // EMP Gravity Field (Pulls enemies inward + stuns)
        this.emitFx('emp_dome', player.x, player.y + 0.8, player.z, {
          radius: 4.8,
          color: '#38bdf8',
          fromSkill: 'cyborg_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        for (const t of this.players.values()) {
          if (this.areEnemies(player, t) && t.state !== 'dead' && distXZ(player, t) <= 4.8) {
            this.applyDamage(player, t, {
              damage: 18,
              knockback: -6.5, // Pull inward!
              stunMs: 1500,
              guardBreak: true,
              skillNameTh: skill.nameTh
            });
          }
        }
        break;
      }
      case 'cyborg_helmet': { // Cyborg Homing Missiles
        for (let i = -1; i <= 1; i++) {
          const ang = player.facing + i * 0.35;
          this.spawnProjectile(player, {
            type: 'homing_missile',
            x: player.x + Math.cos(ang) * 0.9,
            y: player.y + 1.3,
            z: player.z + Math.sin(ang) * 0.9,
            vx: Math.cos(ang) * 14,
            vy: 1.5,
            vz: Math.sin(ang) * 14,
            radius: 0.95,
            targetId: target?.id,
            damage: 14,
            knockback: 6.0,
            launchY: 6.0,
            color: '#38bdf8',
            ttl: 1800,
            skillNameTh: skill.nameTh
          });
        }
        break;
      }
      case 'cyborg_trinket': { // Cyborg Flight Thruster + Diagonal Aerial Laser Beam!
        player.vy = 11.5;
        player.grounded = false;
        player.hoverUntil = now + 2600;
        const tx = target?.x ?? (player.x + dirX * 5.0);
        const tz = target?.z ?? (player.z + dirZ * 5.0);
        const ty = target?.y ?? 0;
        this.emitFx('aerial_laser', player.x, player.y + 3.2, player.z, {
          tx,
          ty: ty + 0.5,
          tz,
          color: '#38bdf8',
          fromSkill: 'cyborg_trinket',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, tx, ty, tz, 3.6, {
          damage: 22, knockback: 7.5, launchY: 7.5, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 8. VIKING BERSERKER SKILLS
      // ----------------------------------------------------------------------
      case 'viking_weapon': { // Ragnarok Earthshatter (Extreme Ring-Out Knockback!)
        const tx = player.x + dirX * 2.5;
        const tz = player.z + dirZ * 2.5;
        this.emitFx('earthshatter', tx, player.y, tz, {
          radius: 4.6,
          color: '#ea580c',
          fromSkill: 'viking_weapon',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz
        });
        this.hitAoE(player, tx, player.y, tz, 4.6, {
          damage: 28, knockback: 12.5, launchY: 10.0, stunMs: 1200, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'viking_armor': { // Valhalla Berserk
        player.berserkUntil = now + 6000;
        player.superArmorUntil = now + 6000;
        player.speedBuffUntil = now + 6000;
        this.emitFx('shockwave', player.x, player.y + 0.8, player.z, {
          radius: 3.8,
          color: '#f97316',
          fromSkill: 'viking_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 3.5, {
          damage: 14, knockback: 6.5, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'viking_helmet': { // Colossus Hurl Throw (Grabs & throws enemy toward facing!)
        if (target) {
          this.applyDamage(player, target, {
            damage: 22,
            knockback: 14.0, // Massive throw force!
            launchY: 9.5,
            stunMs: 1300,
            guardBreak: true,
            dirX, dirZ,
            skillNameTh: skill.nameTh
          });
        } else {
          player.vx = dirX * 10;
          player.vz = dirZ * 10;
        }
        break;
      }
      case 'viking_trinket': { // Boomerang Tomahawk
        this.spawnProjectile(player, {
          type: 'boomerang_axe',
          x: player.x + dirX * 1.0,
          y: player.y + 1.0,
          z: player.z + dirZ * 1.0,
          vx: dirX * 16,
          vy: 0,
          vz: dirZ * 16,
          radius: 1.2,
          pierce: true,
          boomerang: true,
          damage: 19,
          knockback: 6.5,
          color: '#fb923c',
          ttl: 1100,
          skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 9. MUAY THAI STRIKER SKILLS
      // ----------------------------------------------------------------------
      case 'striker_weapon': { // Asura Hundred Fists
        player.vx = dirX * 8.0;
        player.vz = dirZ * 8.0;
        const tx = player.x + dirX * 2.0;
        const tz = player.z + dirZ * 2.0;
        this.emitFx('hundred_fists', tx, player.y + 1.0, tz, {
          facing: player.facing,
          color: '#eab308',
          fromSkill: 'striker_weapon',
          heroId: player.heroId,
          playerId: player.id,
          originX: tx,
          originY: player.y,
          originZ: tz
        });
        this.hitAoE(player, player.x + dirX * 2.2, player.y, player.z + dirZ * 2.2, 3.4, {
          damage: 29, knockback: 9.0, launchY: 10.5, stunMs: 1200, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'striker_armor': { // Sway & Liver Blow
        player.invulnUntil = now + 700;
        this.hitAoE(player, player.x + dirX * 1.5, player.y, player.z + dirZ * 1.5, 3.2, {
          damage: 20, knockback: 4.5, stunMs: 2000, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'striker_trinket': { // Seismic Ground Stomp (Pops enemies high into air)
        this.emitFx('shockwave', player.x, player.y + 0.2, player.z, {
          radius: 4.2,
          color: '#fbbf24',
          fromSkill: 'striker_trinket',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z
        });
        this.hitAoE(player, player.x, player.y, player.z, 4.0, {
          damage: 18, knockback: 2.5, launchY: 12.5, stunMs: 1200, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }

      // ----------------------------------------------------------------------
      // 10. NECRO GRIM REAPER SKILLS
      // ----------------------------------------------------------------------
      case 'reaper_weapon': { // Grim Soul Harvest (High Lifesteal + 65% Gear Strip Chance!)
        const tx = player.x + dirX * 2.2;
        const tz = player.z + dirZ * 2.2;
        this.emitFx('scythe_reap', tx, player.y + 1.0, tz, {
          fromSkill: 'reaper_weapon',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz,
          color: '#a855f7',
          radius: 4.2
        });
        this.hitAoE(player, player.x + dirX * 2.0, player.y, player.z + dirZ * 2.0, 4.2, {
          damage: 25,
          knockback: 7.5,
          launchY: 8.5,
          lifesteal: 0.6,
          stripChance: 0.65, // Signature gear-strip effect!
          guardBreak: true,
          skillNameTh: skill.nameTh
        });
        break;
      }
      case 'reaper_armor': { // Wraith Mist Form
        player.wraithUntil = now + 3500;
        player.speedBuffUntil = now + 3500;
        this.emitFx('smoke', player.x, player.y + 0.9, player.z, {
          fromSkill: 'reaper_armor',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: player.x,
          originY: player.y,
          originZ: player.z,
          radius: 3.8,
          color: '#9333ea'
        });
        this.hitAoE(player, player.x, player.y, player.z, 3.6, {
          damage: 15, knockback: 4.0, lifesteal: 0.8, skillNameTh: skill.nameTh
        });
        break;
      }
      case 'reaper_helmet': { // Phantom Skull Swarm (3 Homing Skulls)
        for (let i = -1; i <= 1; i++) {
          const ang = player.facing + i * 0.4;
          this.spawnProjectile(player, {
            type: 'skull',
            x: player.x + Math.cos(ang) * 0.9,
            y: player.y + 1.2,
            z: player.z + Math.sin(ang) * 0.9,
            vx: Math.cos(ang) * 12,
            vy: 0,
            vz: Math.sin(ang) * 12,
            radius: 0.9,
            targetId: target?.id,
            damage: 14,
            knockback: 5.0,
            burn: true,
            color: '#e879f9',
            ttl: 1900,
            skillNameTh: skill.nameTh
          });
        }
        break;
      }
      case 'reaper_trinket': { // Abyssal Grave Chains (AoE Root + Pull)
        const tx = player.x + dirX * 4.2;
        const tz = player.z + dirZ * 4.2;
        this.emitFx('grave_chains', tx, player.y, tz, {
          fromSkill: 'reaper_trinket',
          heroId: player.heroId,
          playerId: player.id,
          facing: player.facing,
          originX: tx,
          originY: player.y,
          originZ: tz,
          radius: 4.0,
          color: '#d946ef'
        });
        this.hitAoE(player, tx, player.y, tz, 4.0, {
          damage: 19, knockback: -4.0, root: true, stunMs: 1400, guardBreak: true, skillNameTh: skill.nameTh
        });
        break;
      }
    }
  }

  hitAoE(attacker, cx, cy, cz, radius, opts) {
    for (const target of this.players.values()) {
      if (!this.areEnemies(attacker, target) || target.state === 'dead') continue;
      if (Math.hypot(target.x - cx, target.z - cz) <= radius && Math.abs(target.y - cy) <= 3.5) {
        this.applyDamage(attacker, target, opts);
      }
    }
  }

  hitLine(attacker, length, halfWidth, opts) {
    const { dirX, dirZ } = opts;
    for (const target of this.players.values()) {
      if (!this.areEnemies(attacker, target) || target.state === 'dead') continue;
      const rx = target.x - attacker.x;
      const rz = target.z - attacker.z;
      const proj = rx * dirX + rz * dirZ;
      const perp = Math.abs(-rx * dirZ + rz * dirX);
      if (proj >= -0.5 && proj <= length && perp <= halfWidth && Math.abs(target.y - attacker.y) <= 3.0) {
        this.applyDamage(attacker, target, opts);
      }
    }
  }

  spawnProjectile(owner, p) {
    this.projectiles.push({
      id: `proj_${nextEntityId++}`,
      ownerId: owner.id,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + (p.ttl || 1000),
      hitSet: new Set(),
      ...p
    });
  }

  // Pick up dropped gear from the arena floor
  tryPickupGear(player, manualPress = false) {
    if (player.state === 'dead') return;
    const now = Date.now();
    let bestIdx = -1;
    let bestDist = 2.0;

    for (let i = 0; i < this.droppedGears.length; i++) {
      const g = this.droppedGears[i];
      if (g.slot === 'weapon' || now - g.spawnedAt < 450) continue;
      const d = distXZ(player, g);
      if (d < bestDist && Math.abs(player.y - g.y) < 2.2) {
        // G swaps an equipped piece. Automatically equip only gear that fills an empty slot.
        if (manualPress || (player.gear[g.slot] === null && g.manualDropBy !== player.id)) {
          bestDist = d;
          bestIdx = i;
        }
      }
    }

    if (bestIdx !== -1) {
      const g = this.droppedGears.splice(bestIdx, 1)[0];
      this.dropGear(player, g.slot);
      player.gear[g.slot] = g.heroId;
      player.skillGauges[g.slot] = g.gauge;
      player.acquiredGear.add(g.slot);

      const gearHero = GAME_DATA.HEROES[g.heroId];
      const slotLabel = GAME_DATA.GEAR_SLOT_LABELS[g.slot].th;
      this.emitFx('pickup', player.x, player.y + 1.5, player.z, {
        text: `สวมใส่ [${slotLabel}] ${gearHero ? gearHero.nameTh : ''}!`,
        color: '#4ade80'
      });
    }
  }

  // ==========================================================================
  // 3D PLATFORM & ARENA PHYSICS + AI BOT LOGIC (Runs at 30 Hz)
  // ==========================================================================
  floorPlatformAt(x, z, currentY, tolerance = FLOOR_EPSILON, approach = null) {
    let best = null;
    for (const plat of this.getMap().platforms) {
      if (!insideRect(plat, x, z) || (best && plat.y <= best.y)) continue;
      const reach = approach && crossesStairFace(plat, approach, { x, z }, true) ? MAX_STAIR_RISE : tolerance;
      if (currentY >= plat.y - reach) best = plat;
    }
    return best;
  }

  getFloorHeightAt(x, z, currentY, tolerance = 0.45) {
    return this.floorPlatformAt(x, z, currentY, tolerance)?.y ?? null;
  }

  touchLava(p, lava) {
    if (p.bouncedOnLava || p.hp <= lava.damage) {
      this.killPlayer(p, null, 'คูลาวา', true);
      return;
    }
    this.chargeFromDamage(null, p, Math.min(lava.damage, p.hp), Date.now());
    p.hp -= lava.damage;
    p.bouncedOnLava = true;
    p.y = lava.y;
    p.vy = lava.boostY;
    this.emitFx('hit', p.x, p.y + 0.85, p.z, { damage: lava.damage, color: '#ff9650' });
  }

  updateShrine(shrine, now) {
    const occupants = [];
    for (const p of this.players.values()) {
      if (p.state !== 'dead' && p.grounded && Math.abs(p.y - shrine.y) < FLOOR_EPSILON && distXZ(p, shrine) <= shrine.r) {
        occupants.push(p);
      } else {
        p.nextShrineHealAt = 0;
      }
    }
    const contested = occupants.some(p => this.areEnemies(occupants[0], p));
    for (const p of occupants) {
      if (contested) {
        p.nextShrineHealAt = 0;
      } else if (!p.nextShrineHealAt) {
        p.nextShrineHealAt = now + shrine.periodMs;
      } else if (now >= p.nextShrineHealAt) {
        p.nextShrineHealAt = now + shrine.periodMs;
        const heal = Math.min(shrine.heal, p.maxHp - p.hp);
        if (heal > 0) {
          p.hp += heal;
          this.emitFx('heal', p.x, p.y + 1.2, p.z, { text: '+' + heal + ' HP', color: '#86d5a0' });
        }
      }
    }
    if (!occupants.length) return 'idle';
    return contested ? 'contested' : 'held';
  }

  hasSafeFooting(x, z, y) {
    for (const dx of [-PLAYER_RADIUS, PLAYER_RADIUS]) {
      for (const dz of [-PLAYER_RADIUS, PLAYER_RADIUS]) {
        if (!this.floorPlatformAt(x + dx, z + dz, y, MAX_STAIR_RISE)) return false;
      }
    }
    return true;
  }

  updateAI(bot, now) {
    if (bot.state === 'dead' || bot.state === 'frozen' || bot.state === 'knockdown' || bot.state === 'hurt') {
      // Check if bot can use an escape Armor Skill while being hit!
      if ((bot.state === 'hurt' || bot.state === 'knockdown') && Math.random() < 0.08) {
        this.castGearSkill(bot, 'armor');
      }
      bot.input.mx = 0;
      bot.input.mz = 0;
      return;
    }

    // Find closest enemy or missing gear
    let target = null;
    let minDist = 999;
    for (const other of this.players.values()) {
      if (this.areEnemies(bot, other) && other.state !== 'dead' && now >= other.stealthUntil) {
        const d = distXZ(bot, other);
        if (d < minDist) {
          minDist = d;
          target = other;
        }
      }
    }

    // If bot lost gear and there is dropped gear nearby, try to grab it
    if (bot.gear.helmet === null || bot.gear.armor === null || bot.gear.trinket === null) {
      for (const g of this.droppedGears) {
        if (bot.gear[g.slot] === null && distXZ(bot, g) < 5.0) {
          const ang = Math.atan2(g.z - bot.z, g.x - bot.x);
          bot.input.mx = Math.cos(ang);
          bot.input.mz = Math.sin(ang);
          bot.facing = ang;
          return;
        }
      }
    }

    const map = this.getMap();
    const seekShrine = map.shrine && bot.hp < bot.maxHp * 0.72;
    if (!target && !seekShrine) {
      bot.input.mx = 0;
      bot.input.mz = 0;
      return;
    }

    const hero = GAME_DATA.HEROES[bot.heroId];
    const goal = seekShrine ? map.shrine : target;
    const enemy = target || goal;
    const angleToTarget = Math.atan2(enemy.z - bot.z, enemy.x - bot.x);
    bot.facing = angleToTarget;

    const idealDist = hero.attackType === 'ranged' ? 5.2 : 1.7;
    const from = this.floorPlatformAt(bot.x, bot.z, bot.y);
    if (seekShrine || minDist > idealDist + 0.5) {
      const to = this.floorPlatformAt(goal.x, goal.z, goal.y);
      const crossing = this.walkingRoutes.get(from)?.get(to);
      let next = crossing || goal;
      if (!crossing && from && to && map.lava && map.jumpPads.length && to.y > from.y && bot.grounded) {
        next = map.jumpPads.reduce((best, pad) => distXZ(bot, pad) < distXZ(bot, best) ? pad : best);
      }
      const dx = next.x - bot.x, dz = next.z - bot.z;
      const distance = Math.hypot(dx, dz);
      const holdPosition = seekShrine && distXZ(bot, goal) < map.shrine.r * 0.6;
      bot.input.mx = distance && !holdPosition ? dx / distance : 0;
      bot.input.mz = distance && !holdPosition ? dz / distance : 0;
    } else if (hero.attackType === 'ranged' && minDist < 2.6) {
      bot.input.mx = -Math.cos(angleToTarget);
      bot.input.mz = -Math.sin(angleToTarget);
    } else {
      // Strafe slightly
      bot.input.mx = Math.cos(angleToTarget + Math.PI * 0.5) * 0.4;
      bot.input.mz = Math.sin(angleToTarget + Math.PI * 0.5) * 0.4;
    }

    const nextX = bot.x + bot.input.mx * 1.3;
    const nextZ = bot.z + bot.input.mz * 1.3;
    if (bot.grounded && from && !this.hasSafeFooting(nextX, nextZ, bot.y)) {
      const jumpReach = hero.speed * (2 * hero.jumpForce / GRAVITY - DT);
      if (this.hasSafeFooting(bot.x + bot.input.mx * jumpReach, bot.z + bot.input.mz * jumpReach, bot.y)) {
        this.performJumpOrFly(bot);
      } else {
        const inward = Math.atan2(from.z + from.d / 2 - bot.z, from.x + from.w / 2 - bot.x);
        bot.input.mx = Math.cos(inward);
        bot.input.mz = Math.sin(inward);
      }
    }

    // Sprint (same stamina rules as players) while closing a long gap
    bot.input.sprinting = !!target && minDist > 5.0 && bot.mobilityGauge >= (bot.input.sprinting ? 20 : 45);

    if (!target) return;
    // Jump / Double Jump / Dash if target is higher or chasing
    if (target.y > bot.y + 0.8 && Math.random() < 0.12) {
      this.performJumpOrFly(bot);
    } else if (minDist > 5.0 && minDist < 10.0 && bot.mobilityGauge >= 45 && Math.random() < 0.035) {
      this.performDash(bot, bot.input.mx, bot.input.mz);
    } else if (!bot.grounded && hero.mobility?.canFly && bot.mobilityGauge > 40 && Math.random() < 0.08) {
      this.performJumpOrFly(bot);
    }

    // Attack & Skill Decisions
    if (minDist <= hero.basicAttack.range + 0.5) {
      const r = Math.random();
      if (r < 0.045) {
        this.performHeavyAttack(bot);
      } else if (r < 0.28) {
        this.performBasicAttack(bot, false, !bot.grounded);
      }
    }

    // Cast skills when in range
    if (minDist <= 7.0 && Math.random() < 0.05) {
      const slots = ['weapon', 'helmet', 'trinket', 'armor'];
      const chosen = slots[Math.floor(Math.random() * slots.length)];
      this.castGearSkill(bot, chosen);
    }
  }

  update() {
    const now = Date.now();
    const map = this.getMap();

    // 1. Update Players & Bots
    for (const p of this.players.values()) {
      if (p.state === 'dead') {
        if (now >= p.respawnAt) {
          this.respawnPlayer(p);
        }
        continue;
      }

      if (p.isBot) {
        this.updateAI(p, now);
      }

      // Recover from temporary states
      if ((p.state === 'hurt' || p.state === 'knockdown' || p.state === 'frozen' || p.state === 'attack' || p.state === 'heavy' || p.state === 'skill') && now >= p.stateUntil) {
        p.state = 'idle';
      }

      // Periodic Burn DoT
      if (now < p.burnUntil && now >= p.burnTick) {
        p.burnTick = now + 700;
        this.chargeFromDamage(this.players.get(p.burnAttackerId), p, Math.min(4, p.hp - 1), now);
        p.hp = Math.max(1, p.hp - 4);
        this.emitFx('hit', p.x, p.y + 1.2, p.z, { damage: 4, color: '#f97316' });
      }

      // Mage Orbiting Solar Spheres
      if (now < p.orbitSpheresUntil && now >= p.orbitTick) {
        p.orbitTick = now + 550;
        this.hitAoE(p, p.x, p.y, p.z, 2.7, {
          damage: 7, knockback: 3.0, burn: true, skillNameTh: 'ลูกแก้วสุริยะ'
        });
      }

      const hero = GAME_DATA.HEROES[p.heroId] || GAME_DATA.HEROES.knight;
      const mob = hero.mobility || {};
      const aimTarget = this.updateTargeting(p, now);
      const canMove = p.state !== 'hurt' && p.state !== 'knockdown' && p.state !== 'frozen' && now >= p.rootUntil;
      const isBurstDashing = now < p.dashUntil;
      // Hold-Shift sprint: faster run that drains the mobility gauge (stamina).
      // Running it dry locks sprint until the gauge refills to SPRINT_RESUME.
      if (p.sprintLocked && p.mobilityGauge >= SPRINT_RESUME) p.sprintLocked = false;
      const sprintIntent = canMove && !p.guarding && !p.sprintLocked && !!p.input.sprinting
        && Math.hypot(p.input.mx || 0, p.input.mz || 0) > 0.15;
      p.isSprinting = sprintIntent && (p.grounded ? p.mobilityGauge > 0 : p.isSprinting);
      const support = p.grounded ? this.floorPlatformAt(p.x, p.z, p.y) : null;
      const onIce = support?.finish === 'ice';

      if (canMove) {
        let moveSpeed = hero.speed * (this.equippedSkill(p, 'helmet')?.passive?.moveSpeedMultiplier ?? 1);
        if (now < p.speedBuffUntil) moveSpeed *= 1.38;
        if (isBurstDashing) {
          moveSpeed *= (mob.dashSpeedMult || 1.7);
        } else if (p.isSprinting) {
          moveSpeed *= 1 + ((mob.dashSpeedMult || 1.7) - 1) * SPRINT_SPEED_SHARE;
        }
        if (p.guarding) moveSpeed *= 0.35;

        const imx = clamp(p.input.mx || 0, -1, 1);
        const imz = clamp(p.input.mz || 0, -1, 1);
        const ilen = Math.hypot(imx, imz);
        const nx = ilen > 1 ? imx / ilen : imx;
        const nz = ilen > 1 ? imz / ilen : imz;

        let blend = isBurstDashing ? 0.14 : 0.28;
        if (onIce) blend = ilen > 0.05 ? 0.075 : 0.045;
        p.vx = p.vx * (1 - blend) + nx * moveSpeed * blend;
        p.vz = p.vz * (1 - blend) + nz * moveSpeed * blend;

        if (aimTarget) {
          this.faceTarget(p, aimTarget);
        } else if (p.state !== 'attack' && p.state !== 'heavy' && p.state !== 'skill') {
          if (ilen > 0.05) {
            p.facing = Math.atan2(nz, nx);
            p.input.facing = p.facing;
          } else if (!p.isBot) {
            p.facing = p.input.facing;
          }
        }

        if (p.state === 'idle' || p.state === 'run' || p.state === 'jump' || p.state === 'guard') {
          if (!p.grounded) p.state = 'jump';
          else if (p.guarding) p.state = 'guard';
          else if (ilen > 0.15 || isBurstDashing) p.state = 'run';
          else p.state = 'idle';
        }
      } else {
        const drag = onIce ? 0.98 : 0.91;
        p.vx *= drag;
        p.vz *= drag;
      }

      // Gear hover is paid for at cast time. Native flight uses the mobility gauge.
      const gearHover = now < p.hoverUntil;
      const nativeFlight = mob.canFly && !p.flyExhausted && p.mobilityGauge > 0 &&
        (now < p.flyUntil || (p.input.jumpHeld && p.jumpCount >= 1 && p.y > 0.5));
      if (!p.grounded && canMove && (gearHover || nativeFlight)) {
        p.isFlying = true;

        if (p.input.jumpHeld && p.y < 4.4) {
          p.vy = Math.min(4.0, p.vy + 14.0 * DT);
        } else {
          const glideFall = mob.type === 'frost_glide' ? -1.1 : -0.35;
          p.vy = Math.max(glideFall, p.vy * 0.6);
        }

        if (!gearHover) {
          p.mobilityGauge = Math.max(0, p.mobilityGauge - (mob.flyDrainPerSec || 28) * DT);
          if (p.mobilityGauge === 0) {
            p.isFlying = false;
            p.flyUntil = 0;
            p.flyExhausted = true;
          }
        }
      } else {
        p.isFlying = false;
        p.flyUntil = 0;
        p.hoverUntil = 0;
        // Normal Gravity pulls character straight down!
        p.vy -= GRAVITY * DT;
      }

      const previousY = p.y;
      const approach = support ? { x: p.x, z: p.z } : null;
      const nextY = p.y + p.vy * DT;
      const belt = map.conveyor;
      const onBelt = belt && support && support.y === belt.y && insideRect(belt, p.x, p.z);
      const travelX = (p.vx + (onBelt ? belt.speedX : 0)) * DT;
      const travelZ = p.vz * DT;
      const nextX = p.x + travelX;
      const nextZ = p.z + travelZ;
      p.x = moveAlongPlatformAxis(map.platforms, 'x', p.x, p.z, travelX, previousY, nextY, !!support);
      p.z = moveAlongPlatformAxis(map.platforms, 'z', p.z, p.x, travelZ, previousY, nextY, !!support);
      if (p.x !== nextX) p.vx = 0;
      if (p.z !== nextZ) p.vz = 0;
      p.y = nextY;

      // Platform Floor Collision
      const floor = this.floorPlatformAt(p.x, p.z, previousY, FLOOR_EPSILON, approach);
      const descendingStair = approach && floor && previousY > floor.y && previousY - floor.y <= MAX_STAIR_RISE
        && (crossesStairFace(support, p, approach, true) || crossesStairFace(floor, approach, p, false));
      if (floor && (p.y <= floor.y || descendingStair)) {
        p.y = floor.y;
        p.vy = 0;
        p.grounded = true;
        p.jumpCount = 0;
        p.airDashCount = 0;
        p.isFlying = false;
        p.flyUntil = 0;
        p.hoverUntil = 0;
        p.flyExhausted = false;
        p.bouncedOnLava = false;
      } else {
        p.grounded = false;
      }

      // Mobility Gauge ONLY regenerates when standing on the ground (never in mid-air!)
      if (p.isSprinting && p.grounded) {
        p.mobilityGauge = Math.max(0, p.mobilityGauge - SPRINT_DRAIN_PER_SEC * DT);
        if (p.mobilityGauge <= 0) {
          p.isSprinting = false;
          p.sprintLocked = true;
        }
      } else if (p.grounded && !isBurstDashing) {
        const regenRate = mob.gaugeRegen || 35;
        p.mobilityGauge = Math.min(p.maxMobilityGauge, p.mobilityGauge + regenRate * DT);
      }

      // Pillar Collisions
      for (const pil of map.pillars) {
        const dx = p.x - pil.x;
        const dz = p.z - pil.z;
        const d = Math.hypot(dx, dz);
        const minR = pil.r + PLAYER_RADIUS;
        if (d < minR && p.y < pil.y + pil.h && p.y + PLAYER_HEIGHT > pil.y) {
          p.x = pil.x + (d ? dx / d : 1) * minR;
          p.z = pil.z + (d ? dz / d : 0) * minR;
        }
      }

      // Jump Pads
      for (const jp of map.jumpPads) {
        if (p.grounded && Math.hypot(p.x - jp.x, p.z - jp.z) <= jp.r && Math.abs(p.y - (jp.y ?? 0)) < FLOOR_EPSILON) {
          p.vy = jp.boostY;
          p.grounded = false;
          this.emitFx('jumppad', jp.x, 0.2, jp.z, { color: '#38bdf8' });
        }
      }

      // Auto-Pickup Dropped Gear if player is missing that gear slot!
      this.tryPickupGear(p, false);

      // Check Ring-Out / Fall into Void!
      if (map.lava && previousY >= map.lava.y && p.y <= map.lava.y && insideRect(map.lava, p.x, p.z)) {
        this.touchLava(p, map.lava);
      } else if (p.y < map.voidY) {
        this.killPlayer(p, null, 'RING OUT', true);
      }
    }

    // 2. Update Projectiles (Bullets, Fireballs, Waves, Homing Missiles, Boomerang Axes)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (now >= pr.expiresAt) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const owner = this.players.get(pr.ownerId);

      if (pr.targetId) {
        const target = this.players.get(pr.targetId);
        if (!this.isTargetable(owner, target, now)) {
          pr.targetId = null;
        } else {
          const dx = target.x - pr.x;
          const dy = target.y + 0.9 - pr.y;
          const dz = target.z - pr.z;
          const distance = Math.hypot(dx, dy, dz) || 1;
          const speed = Math.hypot(pr.vx, pr.vy, pr.vz);
          const steering = 0.32 * speed / distance;
          const vx = pr.vx * 0.68 + dx * steering;
          const vy = pr.vy * 0.68 + dy * steering;
          const vz = pr.vz * 0.68 + dz * steering;
          const scale = speed / (Math.hypot(vx, vy, vz) || 1);
          pr.vx = vx * scale;
          pr.vy = vy * scale;
          pr.vz = vz * scale;
        }
      }

      // Boomerang return behavior (Viking axe)
      if (pr.boomerang && owner && now - pr.spawnedAt > 500) {
        const tx = owner.x - pr.x;
        const tz = owner.z - pr.z;
        const tlen = Math.hypot(tx, tz) || 1;
        pr.vx = (tx / tlen) * 17;
        pr.vz = (tz / tlen) * 17;
      }

      pr.x += pr.vx * DT;
      pr.y += (pr.vy || 0) * DT;
      pr.z += pr.vz * DT;

      let consumed = false;
      for (const target of this.players.values()) {
        if (!owner || !this.areEnemies(owner, target) || target.state === 'dead') continue;
        if (pr.hitSet.has(target.id)) continue;

        if (Math.hypot(target.x - pr.x, target.z - pr.z) <= pr.radius + 0.55 && Math.abs((target.y + 0.9) - pr.y) <= 1.8) {
          pr.hitSet.add(target.id);
          this.applyDamage(owner, target, {
            damage: pr.damage,
            knockback: pr.boomerang && (now - pr.spawnedAt > 500) ? -6.5 : pr.knockback,
            launchY: pr.launchY || 0,
            stunMs: pr.stunMs || 450,
            guardBreak: !!pr.guardBreak,
            burn: !!pr.burn,
            freeze: !!pr.freeze,
            dirX: pr.vx,
            dirZ: pr.vz,
            skillNameTh: pr.skillNameTh || 'กระสุน'
          });
          if (!pr.pierce) {
            consumed = true;
            break;
          }
        }
      }

      if (consumed) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Update Ground Hazards (Lava pools, Blizzard zones, Ninja Decoy Bombs)
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      const owner = this.players.get(hz.ownerId);

      if (hz.type === 'decoy_bomb' && now >= hz.triggerAt) {
        this.emitFx('explosion', hz.x, hz.y + 0.5, hz.z, { radius: hz.radius, color: hz.color, fromSkill: 'ninja_trinket' });
        if (owner) {
          this.hitAoE(owner, hz.x, hz.y, hz.z, hz.radius, {
            damage: hz.damage, knockback: hz.knockback, launchY: hz.launchY, guardBreak: true, skillNameTh: hz.skillNameTh
          });
        }
        this.hazards.splice(i, 1);
        continue;
      }

      if (hz.nextTick && now >= hz.nextTick) {
        hz.nextTick = now + 650;
        if (owner) {
          this.hitAoE(owner, hz.x, hz.y, hz.z, hz.radius, {
            damage: hz.damage, knockback: 1.5, freeze: !!hz.freeze, burn: hz.type === 'lava_pool', skillNameTh: hz.skillNameTh
          });
        }
      }

      if (now >= hz.expiresAt) {
        this.hazards.splice(i, 1);
      }
    }

    // 4. Update Dropped Gear Physics on Ground
    for (let i = this.droppedGears.length - 1; i >= 0; i--) {
      const g = this.droppedGears[i];
      if (now >= g.expiresAt || g.y < map.voidY) {
        this.droppedGears.splice(i, 1);
        continue;
      }
      g.vy -= GRAVITY * DT;
      g.x += g.vx * DT;
      g.y += g.vy * DT;
      g.z += g.vz * DT;
      const floorY = this.getFloorHeightAt(g.x, g.z, g.y + 0.5);
      if (floorY !== null && g.y <= floorY + 0.25) {
        g.y = floorY + 0.25;
        g.vy = 0;
        g.vx *= 0.8;
        g.vz *= 0.8;
      }
    }

    // 5. Broadcast Snapshot to Connected LAN Clients
    this.broadcastState(now, map.shrine && this.updateShrine(map.shrine, now));
    this.fxEvents = [];
  }

  broadcastState(now, shrineState) {
    const playersPayload = [];
    for (const p of this.players.values()) {
      const skillGauges = {};
      const cooldowns = {};
      for (const slot of GAME_DATA.GEAR_SLOTS) {
        const skill = this.equippedSkill(p, slot);
        if (!skill || skill.type === 'passive') {
          skillGauges[slot] = null;
          cooldowns[slot] = 0;
          continue;
        }
        const gauge = p.skillGauges[slot];
        rechargeSkillGauge(gauge, skill, now);
        skillGauges[slot] = Math.floor(gauge.charge);
        cooldowns[slot] = Math.ceil(Math.max(
          0, gauge.nextUseAt - now, (skill.gaugeCost - gauge.charge) * skill.cooldownMs / 100
        ));
      }
      playersPayload.push({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        team: p.team,
        heroId: p.heroId,
        x: Number(p.x.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        z: Number(p.z.toFixed(2)),
        vx: Number(p.vx.toFixed(2)),
        vy: Number(p.vy.toFixed(2)),
        vz: Number(p.vz.toFixed(2)),
        facing: Number(p.facing.toFixed(2)),
        grounded: p.grounded,
        hp: p.hp,
        maxHp: p.maxHp,
        mobilityGauge: Math.round(p.mobilityGauge),
        maxMobilityGauge: p.maxMobilityGauge,
        jumpCount: p.jumpCount,
        isFlying: !!p.isFlying,
        isDashing: now < p.dashUntil,
        isSprinting: !!p.isSprinting,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        state: p.state,
        animSkillId: p.animSkillId,
        targeting: p.targeting && { mode: p.targeting.mode, targetId: p.targeting.targetId, slot: p.targeting.slot },
        comboStep: p.comboStep,
        guarding: p.guarding,
        gear: p.gear,
        skillGauges,
        cooldowns,
        swapCooldownMs: Math.max(0, 1500 - (now - (p.lastSwapTime || 0))),
        buffs: {
          invuln: now < p.invulnUntil,
          superArmor: now < p.superArmorUntil,
          stealth: now < p.stealthUntil,
          berserk: now < p.berserkUntil,
          wraith: now < p.wraithUntil,
          orbit: now < p.orbitSpheresUntil,
          asura: now < p.attackBuffUntil,
          frozen: now < p.frozenUntil,
          burn: now < p.burnUntil,
          root: now < p.rootUntil
        }
      });
    }

    const packet = JSON.stringify({
      type: 'state',
      roomId: this.id,
      roomName: this.name,
      mapId: this.mapId,
      mode: this.mode,
      players: playersPayload,
      shrineState,
      projectiles: this.projectiles.map(pr => ({
        id: pr.id,
        type: pr.type,
        x: Number(pr.x.toFixed(2)),
        y: Number(pr.y.toFixed(2)),
        z: Number(pr.z.toFixed(2)),
        vx: Number(pr.vx.toFixed(1)),
        vz: Number(pr.vz.toFixed(1)),
        color: pr.color,
        radius: pr.radius
      })),
      droppedGears: this.droppedGears.map(g => ({
        id: g.id,
        slot: g.slot,
        heroId: g.heroId,
        x: Number(g.x.toFixed(2)),
        y: Number(g.y.toFixed(2)),
        z: Number(g.z.toFixed(2))
      })),
      hazards: this.hazards.map(h => ({
        id: h.id,
        type: h.type,
        x: Number(h.x.toFixed(2)),
        y: Number(h.y.toFixed(2)),
        z: Number(h.z.toFixed(2)),
        radius: h.radius,
        color: h.color
      })),
      fx: this.fxEvents,
      killFeed: this.killFeed
    });

    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(packet);
      }
    }
  }
}

// Create default LAN Rooms (Default room features Giga Suit VS Samurai EVO in the Cube Matrix Arena!)
const defaultRoom = new GameRoom('LAN-1', 'ด่านรูบิค (Cube Matrix - Lost Saga Origin)', 'sky_temple', 'ffa');
defaultRoom.addBot('samurai');
defaultRoom.addBot('cyborg');
rooms.set(defaultRoom.id, defaultRoom);

const lavaRoom = new GameRoom('LAN-2', 'ศึกป้อมลาวา (Lava Citadel)', 'lava_citadel', 'ffa');
lavaRoom.addBot('mage');
lavaRoom.addBot('samurai');
rooms.set(lavaRoom.id, lavaRoom);

const cyberRoom = new GameRoom('LAN-3', 'สงครามทีมไซเบอร์ (Team Battle)', 'cyber_rooftop', 'team');
cyberRoom.addBot('cyborg');
cyberRoom.addBot('cowboy');
cyberRoom.addBot('reaper');
rooms.set(cyberRoom.id, cyberRoom);

// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================
function isValidClientMessage(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') return false;

  const optionalString = key => msg[key] === undefined || typeof msg[key] === 'string';
  const optionalBoolean = key => msg[key] === undefined || typeof msg[key] === 'boolean';
  const optionalNumber = key => msg[key] === undefined || (typeof msg[key] === 'number' && Number.isFinite(msg[key]));
  const isId = (value, table) => typeof value === 'string' && Object.hasOwn(table, value);
  const optionalId = (key, table) => msg[key] === undefined || isId(msg[key], table);

  switch (msg.type) {
    case 'join_room':
      return ['roomId', 'roomName', 'playerName'].every(optionalString)
        && optionalId('heroId', GAME_DATA.HEROES)
        && optionalId('mapId', GAME_DATA.MAPS)
        && (msg.mode === undefined || ['ffa', 'team', 'koth'].includes(msg.mode))
        && (msg.team === undefined || [0, 1, 2].includes(msg.team))
        && optionalBoolean('changeMap');
    case 'input':
      return ['mx', 'mz', 'facing'].every(optionalNumber)
        && ['guard', 'jumpHeld', 'sprinting'].every(optionalBoolean);
    case 'dash':
      return ['dx', 'dz'].every(key => msg[key] === null || optionalNumber(key));
    case 'attack':
      return optionalBoolean('isDash') && (msg.phase === undefined || ['press', 'release'].includes(msg.phase));
    case 'switch_target':
      return ['dx', 'dz'].every(key => typeof msg[key] === 'number' && Math.abs(msg[key]) <= 1)
        && Math.hypot(msg.dx, msg.dz) >= 0.5;
    case 'skill':
      return GAME_DATA.GEAR_SLOTS.includes(msg.slot);
    case 'drop_gear':
      return msg.slot !== 'weapon' && GAME_DATA.GEAR_SLOTS.includes(msg.slot);
    case 'equip_gear':
      return GAME_DATA.GEAR_SLOTS.includes(msg.slot) && isId(msg.heroId, GAME_DATA.HEROES);
    case 'swap_hero':
      return isId(msg.heroId, GAME_DATA.HEROES);
    case 'add_bot':
      return msg.heroId === null || optionalId('heroId', GAME_DATA.HEROES);
    case 'change_map':
      return isId(msg.mapId, GAME_DATA.MAPS);
    case 'jump':
    case 'heavy':
    case 'cancel_targeting':
    case 'pickup_gear':
    case 'clear_bots':
      return true;
    default:
      return false;
  }
}

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = `p_${nextEntityId++}`;
  let currentRoom = null;
  let currentPlayer = null;

  // A malformed frame must only disconnect its sender, not the game server.
  ws.on('error', () => ws.terminate());

  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    lanAddresses: getLanAddresses(),
    rooms: Array.from(rooms.values()).map(r => r.getSummary())
  }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!isValidClientMessage(msg)) return;

    if (msg.type === 'join_room') {
      // Remove from previous room if any
      if (currentRoom && currentPlayer) {
        currentRoom.players.delete(currentPlayer.id);
      }

      let roomId = (msg.roomId || 'LAN-1').trim().toUpperCase();
      let room = rooms.get(roomId);
      if (!room) {
        room = new GameRoom(
          roomId,
          msg.roomName || `ห้อง LAN (${roomId})`,
          msg.mapId || 'sky_temple',
          msg.mode || 'ffa'
        );
        rooms.set(roomId, room);
      } else if (msg.mapId && GAME_DATA.MAPS[msg.mapId] && msg.changeMap) {
        room.changeMap(msg.mapId);
      }

      currentRoom = room;
      currentPlayer = room.createPlayer(
        clientId,
        (msg.playerName || 'นักสู้ LAN').slice(0, 18),
        msg.heroId || 'knight',
        false,
        ws,
        msg.team || 0
      );

      ws.send(JSON.stringify({
        type: 'joined',
        clientId,
        roomId: room.id,
        roomName: room.name,
        mapId: room.mapId,
        mode: room.mode,
        heroId: currentPlayer.heroId
      }));
      return;
    }

    if (!currentRoom || !currentPlayer) return;

    switch (msg.type) {
      case 'input': {
        currentPlayer.input.mx = Number(msg.mx) || 0;
        currentPlayer.input.mz = Number(msg.mz) || 0;
        if (typeof msg.facing === 'number') {
          currentPlayer.input.facing = msg.facing;
        }
        currentPlayer.input.jumpHeld = !!msg.jumpHeld;
        currentPlayer.input.sprinting = !!msg.sprinting;
        const wantGuard = !!msg.guard;
        if (wantGuard && !currentPlayer.guarding) {
          currentPlayer.guardStartTime = Date.now();
        }
        currentPlayer.guarding = wantGuard;
        break;
      }
      case 'jump': {
        currentRoom.performJumpOrFly(currentPlayer);
        break;
      }
      case 'dash': {
        currentRoom.performDash(
          currentPlayer,
          typeof msg.dx === 'number' ? msg.dx : null,
          typeof msg.dz === 'number' ? msg.dz : null
        );
        break;
      }
      case 'attack': {
        const isDash = !!msg.isDash && (currentPlayer.isSprinting || Date.now() < currentPlayer.dashUntil + 400);
        currentRoom.handleAttackInput(currentPlayer, msg.phase, isDash);
        break;
      }
      case 'switch_target': {
        currentRoom.switchTarget(currentPlayer, msg.dx, msg.dz);
        break;
      }
      case 'cancel_targeting': {
        currentRoom.clearTargeting(currentPlayer);
        break;
      }
      case 'heavy': {
        currentRoom.performHeavyAttack(currentPlayer);
        break;
      }
      case 'skill': {
        currentRoom.castGearSkill(currentPlayer, msg.slot);
        break;
      }
      case 'swap_hero': {
        currentRoom.swapHero(currentPlayer, msg.heroId);
        break;
      }
      case 'pickup_gear': {
        currentRoom.tryPickupGear(currentPlayer, true);
        break;
      }
      case 'drop_gear': {
        currentRoom.dropGear(currentPlayer, msg.slot);
        break;
      }
      case 'equip_gear': {
        currentRoom.equipGear(currentPlayer, msg.slot, msg.heroId);
        break;
      }
      case 'add_bot': {
        if (currentRoom.players.size < 10) {
          currentRoom.addBot(msg.heroId || null);
        }
        break;
      }
      case 'clear_bots': {
        currentRoom.removeBots();
        break;
      }
      case 'change_map': {
        currentRoom.changeMap(msg.mapId);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentPlayer) {
      currentRoom.players.delete(currentPlayer.id);
    }
  });
});

// Master 30 Hz Physics & Combat Loop
setInterval(() => {
  for (const room of rooms.values()) {
    room.update();
  }
}, 1000 / TICK_RATE);

server.listen(PORT, '0.0.0.0', () => {
  const addrs = getLanAddresses();
  console.log('==============================================================');
  console.log('  LOST SAGA 3D ARENA - LAN SERVER RUNNING!');
  console.log('==============================================================');
  addrs.forEach(a => {
    console.log(`  [LAN URL]  ${a.url}  (${a.interface})`);
  });
  console.log(`  [Local]    http://localhost:${PORT}`);
  console.log('==============================================================');
});
