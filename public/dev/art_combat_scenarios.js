// ============================================================================
// Named Combat Test Scenarios for /dev/art-combat-lab.html
//
// Locked duel setup: Sky Temple courtyard, Knight (attack1) vs Ninja, using
// shared_data.js stats & server.js combat rules (damage, range, block chip,
// knockback, hit-stop, and blade contact timing).
// ============================================================================

export const DUEL_CAMERA = Object.freeze({
  mapId: 'sky_temple',
  fov: 22,
  pitch: 0.62,
  camDist: 41,
  target: [0, 0.35, 0]
});

export const SCENARIO_ORDER = ['hit', 'block', 'miss'];

const KNIGHT_START = Object.freeze({
  x: 0.62,
  y: 0,
  z: -0.62,
  facing: (3 * Math.PI) / 4 // 135 deg: faces screen-left so left-arm blue shield faces camera
});

export const SCENARIOS = {
  hit: {
    id: 'hit',
    label: 'โดน · Hit',
    desc: 'Knight ฟันท่าแรก (attack1) ระยะ 1.75u เข้าตัว Ninja เต็มเป้า (ดาเมจ 11, hit-stop, กระเด็น)',
    length: 1.25,
    standTime: 0.15,
    swingAt: 0.30,
    contactAt: 0.42,
    inspectContactTime: 0.44,
    knightStart: KNIGHT_START,
    ninjaStart: {
      x: -0.62,
      y: 0,
      z: 0.62,
      facing: -Math.PI / 4
    },
    outcome: 'hit',
    ninjaGuarding: false,
    damage: 11,
    knockback: 3.5 * 0.85,
    lunge: 2.4,
    stunSec: 0.38,
    knightHitStopMs: 70,
    ninjaHitStopMs: 75
  },

  block: {
    id: 'block',
    label: 'บล็อก · Block',
    desc: 'Knight ฟันท่าแรกใส่ Ninja ที่ตั้งรับ (guard) ระยะ 1.75u: ลดดาเมจเหลือ chip 2, วงบล็อกสีฟ้า, ถอยเล็กน้อย',
    length: 1.25,
    standTime: 0.15,
    swingAt: 0.30,
    contactAt: 0.42,
    inspectContactTime: 0.44,
    knightStart: KNIGHT_START,
    ninjaStart: {
      x: -0.62,
      y: 0,
      z: 0.62,
      facing: -Math.PI / 4
    },
    outcome: 'block',
    ninjaGuarding: true,
    chipDamage: 2,
    knockback: 3.5 * 0.85,
    blockPush: 3.5 * 0.85 * 0.35,
    lunge: 2.4,
    knightHitStopMs: 90,
    ninjaHitStopMs: 60
  },

  miss: {
    id: 'miss',
    label: 'พลาด · Miss',
    desc: 'Knight ฟันท่าแรกนอกระยะ 3.14u (> 2.3u) วืดไม่โดน Ninja: มีเฉพาะแนวฟัน, ไม่มีแฟลชโดนหรือ hit-stop',
    length: 1.25,
    standTime: 0.15,
    swingAt: 0.30,
    contactAt: 0.42,
    inspectContactTime: 0.44,
    knightStart: KNIGHT_START,
    ninjaStart: {
      x: -1.60,
      y: 0,
      z: 1.60,
      facing: -Math.PI / 4
    },
    outcome: 'miss',
    ninjaGuarding: false,
    lunge: 2.4
  }
};
