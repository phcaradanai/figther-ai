import { Vector3 } from 'three';
import { GAME_DATA, loadChibiViews } from './load-chibi.mjs';

const args = process.argv.slice(2);
const heroOption = args.find(arg => arg.startsWith('--hero='));
const hero = heroOption?.slice('--hero='.length);
if (args.some(arg => arg !== '--frames' && arg !== heroOption) ||
    (heroOption && !Object.hasOwn(GAME_DATA.HEROES, hero))) {
  throw new Error('Usage: node tools/rig/measure-motion.mjs [--hero=<heroId>] [--frames]');
}

// Prescribed identical render input for every rig. Keeping the trajectory
// fixed isolates animation from balance values, controls and network timing.
const fps = 60;
const dt = 1 / fps;
const walkSpeed = 5.4;
const sprintSpeed = 7.5;
const gravity = 28;
const ankle = new Vector3();
const rounded = value => Number(value.toFixed(4));

function capture(View, heroId) {
  const gear = Object.fromEntries(GAME_DATA.GEAR_SLOTS.map(slot => [slot, heroId]));
  const player = { heroId, gear, x: 0, y: 0, z: 0, facing: Math.PI / 2, grounded: true };
  const actor = new View(player);
  const skinned = !!actor.root.getObjectByProperty('isSkinnedMesh', true);
  const frames = [];

  function run(segment, count, input = () => ({})) {
    for (let i = 0; i < count; i++) {
      const {
        speed = 0, facing = Math.PI / 2, y = 0, vy = 0, grounded = true,
        sprint = false, rolling = false, state = 'idle', comboStep = 0
      } = input(i, (i + 1) / count);
      const vx = Math.cos(facing) * speed;
      const vz = Math.sin(facing) * speed;
      Object.assign(player, { x: player.x + vx * dt, y, z: player.z + vz * dt, vx, vy, vz,
        facing, grounded, isSprinting: sprint, isRolling: rolling, state, comboStep });
      actor.update(player, { dt });
      actor.root.updateMatrixWorld(true);
      const point = joint => joint.getWorldPosition(ankle).toArray().map(rounded);
      frames.push({
        frame: frames.length,
        segment,
        grounded,
        speed: rounded(speed),
        vy: rounded(vy),
        clip: actor.currentName,
        phase: rounded(actor.current.time / actor.current.getClip().duration),
        root: [player.x, y, player.z].map(rounded),
        hips: point(actor.R.hips),
        leftAnkle: point(actor.R.footL),
        rightAnkle: point(actor.R.footR),
        weaponHand: point(actor.R.handR),
        targetYaw: rounded(Math.PI / 2 - facing),
        yaw: rounded(actor.yaw),
        torsoPitch: rounded(actor.R.torso.rotation.x)
      });
    }
  }

  function jump(name, launchSpeed) {
    run(name, 78, i => {
      const t = (i + 1) * dt;
      const y = (launchSpeed - gravity * t * 0.5) * t;
      return y > 0 ? { y, vy: launchSpeed - gravity * t, grounded: false } : {};
    });
  }

  try {
    run('idle', 60);
    run('start', 18, (_, k) => ({ speed: walkSpeed * k }));
    run('walk', 84, () => ({ speed: walkSpeed }));
    run('sprint', 66, () => ({ speed: sprintSpeed, sprint: true }));
    run('turn', 24, (_, k) => ({ speed: walkSpeed, facing: (1 - k) * Math.PI / 2 }));
    run('brake', 18, (_, k) => ({ speed: walkSpeed * (1 - k), facing: 0 }));
    run('stop', 48, () => ({ facing: 0 }));
    jump('lowJump', 7);
    jump('highJump', 11.2);
    run('dodge', 20, (_, k) => ({ speed: 10 * (1 - k * 0.6), rolling: true }));
    run('recover', 32);
    run('attack', 30, () => ({ state: 'attack', comboStep: 1 }));
    run('attackRecover', 36);
    return { skinned, frames };
  } finally {
    actor.dispose();
  }
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor((ordered.length - 1) * fraction)];
}

function groundMotion(frames) {
  const speeds = [];
  const fields = ['leftAnkle', 'rightAnkle'];
  for (const key of fields) {
    const threshold = percentile(frames.map(f => f[key][1]), 0.25) + 0.025;
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1][key];
      const after = frames[i][key];
      if (Math.max(before[1], after[1]) > threshold) continue;
      const dx = after[0] - before[0];
      const dz = after[2] - before[2];
      const rootDx = frames[i].root[0] - frames[i - 1].root[0];
      const rootDz = frames[i].root[2] - frames[i - 1].root[2];
      // A supporting foot travels backward relative to the advancing body.
      // Reject low feet swinging forward before estimating drift.
      if (dx * rootDx + dz * rootDz >= rootDx ** 2 + rootDz ** 2) continue;
      speeds.push(Math.hypot(dx, dz) * fps);
    }
  }
  const p90 = percentile(speeds, 0.90);
  return { lowAnkleSamples: speeds.length, apparentSlideP90: p90 === null ? null : rounded(p90) };
}

function summarize(frames) {
  const segment = name => frames.filter(frame => frame.segment === name);
  const idle = segment('idle').slice(30);
  const standingHipY = idle.reduce((sum, f) => sum + f.hips[1], 0) / idle.length;
  const landing = name => {
    const flight = segment(name);
    const landed = flight.findIndex(f => f.grounded);
    return rounded(Math.max(0, standingHipY - Math.min(...flight.slice(landed, landed + 12).map(f => f.hips[1]))));
  };
  const recovery = segment('stop');
  let stopPoseSettledMs = 0;
  for (let i = 1; i < recovery.length; i++) {
    const previous = recovery[i - 1];
    const current = recovery[i];
    const moving = ['leftAnkle', 'rightAnkle'].some(key => {
      const travel = current[key].map((value, axis) => value - previous[key][axis]);
      return Math.hypot(...travel) * fps > 0.15;
    });
    if (moving) stopPoseSettledMs = Math.round(i * dt * 1000);
  }
  const start = segment('start');
  const firstGait = start.find(f => f.clip === 'walk' || f.clip === 'run');
  const turnLag = segment('turn').map(f => {
    const error = f.targetYaw - f.yaw;
    return Math.abs(Math.atan2(Math.sin(error), Math.cos(error))) * 180 / Math.PI;
  });
  const dodgeRecovery = segment('recover');
  const dodgeIdle = dodgeRecovery.find(f => f.clip === 'idle');
  const attack = segment('attack');
  const handSpeed = (a, b) => Math.hypot(...b.weaponHand.map((value, axis) => value - a.weaponHand[axis])) * fps;
  let peak = attack[1];
  let peakSpeed = 0;
  for (let i = 1; i < attack.length; i++) {
    const speed = handSpeed(attack[i - 1], attack[i]);
    if (speed <= peakSpeed) continue;
    peakSpeed = speed;
    peak = attack[i];
  }
  return {
    walk: groundMotion(segment('walk').slice(18)),
    sprint: groundMotion(segment('sprint').slice(18)),
    gaitFromStartMs: firstGait ? Math.round((firstGait.frame - start[0].frame) * dt * 1000) : null,
    turnYawLagP90Deg: rounded(percentile(turnLag, 0.90)),
    stopPoseSettledMs,
    landingHipDrop: { low: landing('lowJump'), high: landing('highJump') },
    idleAfterDodgeInputMs: dodgeIdle ? Math.round((dodgeIdle.frame - dodgeRecovery[0].frame) * dt * 1000) : null,
    attackHandSpeedPeakMs: Math.round((peak.frame - attack[0].frame) * dt * 1000)
  };
}

const { ChibiView, ProceduralView } = await loadChibiViews();
const profiles = heroOption
  ? [[hero, ChibiView], [hero, ProceduralView]]
  : [['knight', ChibiView], ['knight', ProceduralView], ['ninja', ProceduralView], ['viking', ProceduralView]];
const result = profiles.map(([heroId, View]) => {
  const { skinned, frames } = capture(View, heroId);
  return { heroId, rig: skinned ? 'skinned' : 'procedural', metrics: summarize(frames),
    ...(args.includes('--frames') ? { frames } : {}) };
});
console.log(JSON.stringify({ protocol: 1, fps, profiles: result }, null, 2));
