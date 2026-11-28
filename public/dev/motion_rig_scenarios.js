// ============================================================================
// Movement & Motion Rig Lab — Deterministic 60 Hz Scenarios
// Mirrors real server.js dash physics and shared_data.js / attack*.json timing.
// Strictly dev-lab only; zero DOM dependencies.
// ============================================================================

export const DASH_PHYSICS = {
  walkSpeed: 5.4,
  dashSpeedMult: 1.55,
  // server.js performDash(): hero.speed * (mob.dashSpeedMult || 1.7) * 1.65
  dashBurst: 5.4 * 1.55 * 1.65, // 13.8105 u/s
  burstDuration: 0.36,          // dashUntil = now + 360 ms
  serverTick: 1 / 30,
  burstBlend: 0.14,             // velocity blend during isBurstDashing
  stopBlend: 0.28,              // normal ground blend during deceleration
  facing: -Math.PI / 4          // screen-right travel in default game camera
};

export const DASH_SCENARIO = {
  id: 'dash_stop',
  label: 'Knight พุ่งแล้วหยุด (Armored Sprint)',
  desc: 'ใช้ความเร็วต้น 13.81 u/s และแรงต้าน 30Hz เดียวกับ server.js พุ่ง 0.36s แล้วปล่อยหยุดบนกริด 1m เพื่อเทียบท่าโน้มและการไถลเท้า',
  length: 1.35,
  windupAt: 0.19,
  dashAt: 0.25,
  burstEndAt: 0.61,
  settleAt: 0.92,
  markers: [
    { id: 'windup', label: 'เตรียม (0.22s)', t: 0.22 },
    { id: 'burst', label: 'พุ่ง (0.34s)', t: 0.34 },
    { id: 'brake', label: 'ลงน้ำหนัก (0.58s)', t: 0.58 },
    { id: 'recover', label: 'คืนท่า (0.82s)', t: 0.82 }
  ]
};

/**
 * Integrate exact 30 Hz server.js dash burst -> hold brief burst -> stop,
 * then sample cleanly onto a fixed 60 Hz frame list for Before/After parity.
 */
export function precomputeDashPath(dt = 1 / 60) {
  const { facing, dashBurst, dashSpeedMult, walkSpeed } = DASH_PHYSICS;
  const tickDt = DASH_PHYSICS.serverTick;
  const cosF = Math.cos(facing);
  const sinF = Math.sin(facing);

  const ticks = [{ t: 0, x: 0, z: 0, vx: 0, vz: 0, speed: 0, isDashing: false }];
  let x = 0;
  let z = 0;
  let vx = 0;
  let vz = 0;
  let burstStarted = false;

  const totalTicks = Math.ceil(DASH_SCENARIO.length / tickDt) + 2;
  for (let i = 1; i <= totalTicks; i++) {
    const t = i * tickDt;
    const isBurst = t >= DASH_SCENARIO.dashAt && t < DASH_SCENARIO.burstEndAt;
    if (!burstStarted && t >= DASH_SCENARIO.dashAt) {
      burstStarted = true;
      vx = cosF * dashBurst;
      vz = sinF * dashBurst;
    } else if (t >= DASH_SCENARIO.dashAt) {
      // Hold sprint input briefly for the first 3 ticks (~100ms), then release to test Dash -> Stop.
      const held = t < DASH_SCENARIO.dashAt + 0.10;
      const moveSpeed = walkSpeed * dashSpeedMult;
      const targetVx = held ? cosF * moveSpeed : 0;
      const targetVz = held ? sinF * moveSpeed : 0;
      const blend = isBurst ? DASH_PHYSICS.burstBlend : DASH_PHYSICS.stopBlend;
      vx = vx * (1 - blend) + targetVx * blend;
      vz = vz * (1 - blend) + targetVz * blend;
      if (!held && Math.hypot(vx, vz) < 0.03) {
        vx = 0;
        vz = 0;
      }
    }
    x += vx * tickDt;
    z += vz * tickDt;
    ticks.push({ t, x, z, vx, vz, speed: Math.hypot(vx, vz), isDashing: isBurst });
  }

  const frames = [];
  const totalFrames = Math.round(DASH_SCENARIO.length / dt);
  for (let f = 0; f <= totalFrames; f++) {
    const t = Number((f * dt).toFixed(6));
    const idx = Math.min(ticks.length - 2, Math.floor(t / tickDt));
    const a = ticks[idx];
    const b = ticks[idx + 1];
    const u = Math.max(0, Math.min(1, (t - a.t) / tickDt));
    const fx = a.x + (b.x - a.x) * u;
    const fz = a.z + (b.z - a.z) * u;
    const fvx = a.vx + (b.vx - a.vx) * u;
    const fvz = a.vz + (b.vz - a.vz) * u;
    const speed = Math.hypot(fvx, fvz);

    let phase = 'idle';
    if (t >= DASH_SCENARIO.windupAt && t < DASH_SCENARIO.dashAt) phase = 'windup';
    else if (t >= DASH_SCENARIO.dashAt && t < DASH_SCENARIO.burstEndAt - 0.08) phase = 'burst';
    else if (t >= DASH_SCENARIO.burstEndAt - 0.08 && t < DASH_SCENARIO.settleAt) phase = 'brake';
    else if (t >= DASH_SCENARIO.settleAt && speed > 0.05) phase = 'recover';

    frames.push({
      t,
      x: fx,
      z: fz,
      vx: fvx,
      vz: fvz,
      speed,
      facing,
      isDashing: t >= DASH_SCENARIO.dashAt && t < DASH_SCENARIO.burstEndAt,
      phase
    });
  }
  return frames;
}

export const ATTACK_SCENARIOS = {
  attack2: {
    id: 'attack2',
    label: 'attack2 · ฟันตวัดกลับ (Backhand Sweep)',
    desc: 'จุดผิดชัดสุดที่พบ: คลิปเดิมดาบทะลุ armL 3.4cm ที่ 0.000s, ข้อมือขวาดีด -45.3° และดาบทะลุหมวก 6.0cm ที่ 0.367s — แก้ที่ไหล่+ศอก+ข้อมือโดยคงสัมผัส 0.100s',
    duration: 0.400,
    serverConfirmAt: 0.000,
    visualContactAt: 0.100,
    trailWindow: [0.000, 0.2667],
    attackRange: 2.3,
    facing: Math.PI / 4,
    markers: [
      { id: 'windup', label: 'เตรียม (0.000s)', t: 0.000 },
      { id: 'swing', label: 'ตวัด (0.067s)', t: 0.067 },
      { id: 'contact', label: 'สัมผัส (0.100s)', t: 0.100 },
      { id: 'recover', label: 'จุดทะลุเดิม (0.367s)', t: 0.367 }
    ]
  },
  attack1: {
    id: 'attack1',
    label: 'attack1 · ฟันเฉียง 1 (Diagonal Cleave)',
    desc: 'ท่าฟันที่ 1 จาก One Hand Sword Combo (contact 0.133s, เฉียดโล่ 2.1cm ช่วง 0.233s)',
    duration: 0.4333,
    serverConfirmAt: 0.000,
    visualContactAt: 0.1333,
    trailWindow: [0.0333, 0.300],
    attackRange: 2.3,
    facing: Math.PI / 4,
    markers: [
      { id: 'windup', label: 'เตรียม (0.033s)', t: 0.0333 },
      { id: 'swing', label: 'ฟัน (0.100s)', t: 0.100 },
      { id: 'contact', label: 'สัมผัส (0.133s)', t: 0.1333 },
      { id: 'recover', label: 'คืนท่า (0.300s)', t: 0.300 }
    ]
  },
  attack3: {
    id: 'attack3',
    label: 'attack3 · ฟันปิดคอมโบ 3 (Finisher Chop)',
    desc: 'ท่าฟันปิดคอมโบ 3 (contact 0.200s)',
    duration: 0.5667,
    serverConfirmAt: 0.000,
    visualContactAt: 0.200,
    trailWindow: [0.0333, 0.300],
    attackRange: 2.3,
    facing: Math.PI / 4,
    markers: [
      { id: 'windup', label: 'เตรียม (0.100s)', t: 0.100 },
      { id: 'swing', label: 'ฟัน (0.167s)', t: 0.167 },
      { id: 'contact', label: 'สัมผัส (0.200s)', t: 0.200 },
      { id: 'recover', label: 'คืนท่า (0.433s)', t: 0.433 }
    ]
  },
  heavy: {
    id: 'heavy',
    label: 'heavy · กระแทกโล่ (Shield Bash)',
    desc: 'ท่าโจมตีหนักทำลายการ์ดด้วยโล่ซ้าย (contact 0.210s)',
    duration: 0.560,
    serverConfirmAt: 0.000,
    visualContactAt: 0.210,
    trailWindow: null,
    attackRange: 2.5,
    facing: Math.PI / 4,
    markers: [
      { id: 'windup', label: 'เตรียม (0.120s)', t: 0.120 },
      { id: 'swing', label: 'พุ่งโล่ (0.167s)', t: 0.167 },
      { id: 'contact', label: 'สัมผัส (0.210s)', t: 0.210 },
      { id: 'recover', label: 'คืนท่า (0.400s)', t: 0.400 }
    ]
  }
};
