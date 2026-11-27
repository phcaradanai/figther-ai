// Audits every skinned hero animation clip and live 60 Hz gameplay
// sequences for true 3D anatomical joint limits, shield orientation (Knight), and pops.
// Usage: node tools/rig/anatomy-audit.mjs [--hero=knight|ninja|mage|cowboy|samurai|all] [--strict]
import { Quaternion, Vector3 } from 'three';
import { loadChibiViews } from './load-chibi.mjs';
import { SHIELD_HOLD } from '../../public/js/three/knight_anatomy.js';

const strict = process.argv.includes('--strict');
const heroArg = process.argv.find(a => a.startsWith('--hero='))?.slice('--hero='.length) || 'knight';
const heroes = heroArg === 'all' ? ['knight', 'ninja', 'mage', 'cowboy', 'samurai'] : [heroArg];
const { ChibiView } = await loadChibiViews();
const qShield = new Quaternion(...SHIELD_HOLD);
const deg = r => +(r * 180 / Math.PI).toFixed(1);

const vHip = new Vector3(), vKnee = new Vector3(), vAnk = new Vector3();
const vSh = new Vector3(), vElb = new Vector3(), vWr = new Vector3();
const qInv = new Quaternion(), u = new Vector3(), w = new Vector3(), perp = new Vector3();

function measureFrame(view, checkShield) {
  view.root.updateMatrixWorld(true);
  const out = {};
  for (const side of ['L', 'R']) {
    const leg = view.R['leg' + side], shin = view.R['shin' + side], foot = view.R['foot' + side];
    leg.getWorldPosition(vHip); shin.getWorldPosition(vKnee); foot.getWorldPosition(vAnk);
    leg.getWorldQuaternion(qInv).invert();
    u.subVectors(vKnee, vHip).applyQuaternion(qInv).normalize();
    w.subVectors(vAnk, vKnee).applyQuaternion(qInv).normalize();
    perp.copy(w).addScaledVector(u, -w.dot(u));
    const ang = deg(Math.acos(Math.max(-1, Math.min(1, u.dot(w)))));
    const hyp = perp.z > 0 ? deg(Math.atan2(perp.z, Math.max(1e-4, u.dot(w)))) : 0;
    const lat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
    out['knee' + side] = { flex: perp.z <= 0 ? ang : 0, hyp, lat };
  }
  for (const side of ['L', 'R']) {
    const arm = view.R['arm' + side], fore = view.R['fore' + side], hand = view.R['hand' + side];
    arm.getWorldPosition(vSh); fore.getWorldPosition(vElb); hand.getWorldPosition(vWr);
    arm.getWorldQuaternion(qInv).invert();
    u.subVectors(vElb, vSh).applyQuaternion(qInv).normalize();
    w.subVectors(vWr, vElb).applyQuaternion(qInv).normalize();
    perp.copy(w).addScaledVector(u, -w.dot(u));
    const ang = deg(Math.acos(Math.max(-1, Math.min(1, u.dot(w)))));
    const hyp = perp.z < 0 ? deg(Math.atan2(-perp.z, Math.max(1e-4, u.dot(w)))) : 0;
    const lat = deg(Math.asin(Math.min(1, Math.abs(perp.x))));
    out['elbow' + side] = { flex: perp.z >= 0 ? ang : 0, hyp, lat };
  }
  out.headAng = deg(2 * Math.acos(Math.min(1, Math.abs(view.R.head.quaternion.w))));
  out.shieldErr = checkShield ? deg(2 * Math.acos(Math.min(1, Math.abs(view.R.handL.quaternion.dot(qShield))))) : 0;
  return out;
}

const HERO_CLIPS = {
  knight: [
    'idle', 'idleFidget', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'turnL', 'turnR', 'draw', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'sweep', 'slam', 'warcry', 'charge',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ],
  ninja: [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'windslash', 'seal', 'throw', 'backflip',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ],
  mage: [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'fly', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'summon', 'nova', 'raise', 'blink',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ],
  samurai: [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'spin', 'counter', 'aura', 'rising',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ],
  cowboy: [
    'idle', 'walk', 'run', 'dash', 'jump', 'fall', 'roll',
    'guard', 'guardHit', 'hurt', 'knockdown', 'dead',
    'attack1', 'attack2', 'attack3', 'heavy',
    'spin', 'toss', 'rollshot', 'lasso',
    'airRise', 'airCut', 'airSpike', 'slamAim', 'slamDive', 'slamImpact'
  ]
};

const dt = 1 / 60;
const failures = [];

for (const heroId of heroes) {
  const gear = { weapon: heroId, armor: heroId, helmet: heroId, trinket: heroId };
  const base = { heroId, gear, grounded: true, x: 0, y: 0, z: 0, facing: Math.PI / 2 };
  const checkShield = heroId === 'knight';
  const view = new ChibiView(base);

  console.log(`\n=== ${heroId.toUpperCase()} CLIP AUDIT ===`);
  console.log('CLIP         | KNEE_L(f/h/lat) | KNEE_R(f/h/lat) | ELB_L(f/h/lat)  | ELB_R(f/h/lat)  | HEAD | SHLD');
  for (const name of (HERO_CLIPS[heroId] || [])) {
    const act = view.actions[name];
    if (!act) continue;
    const clip = act.getClip();
    const steps = Math.max(16, Math.round(clip.duration * 30));
    view.mixer.stopAllAction();
    act.reset(); act.setEffectiveWeight(1); act.play();
    const m = { kLH: 0, kLL: 0, kLF: 0, kRH: 0, kRL: 0, kRF: 0, eLH: 0, eLL: 0, eLF: 0, eRH: 0, eRL: 0, eRF: 0, head: 0, shld: 0 };
    for (let i = 0; i <= steps; i++) {
      act.time = clip.duration * i / steps;
      view.mixer.update(0);
      const f = measureFrame(view, checkShield);
      m.kLF = Math.max(m.kLF, f.kneeL.flex); m.kLH = Math.max(m.kLH, f.kneeL.hyp); m.kLL = Math.max(m.kLL, f.kneeL.lat);
      m.kRF = Math.max(m.kRF, f.kneeR.flex); m.kRH = Math.max(m.kRH, f.kneeR.hyp); m.kRL = Math.max(m.kRL, f.kneeR.lat);
      m.eLF = Math.max(m.eLF, f.elbowL.flex); m.eLH = Math.max(m.eLH, f.elbowL.hyp); m.eLL = Math.max(m.eLL, f.elbowL.lat);
      m.eRF = Math.max(m.eRF, f.elbowR.flex); m.eRH = Math.max(m.eRH, f.elbowR.hyp); m.eRL = Math.max(m.eRL, f.elbowR.lat);
      m.head = Math.max(m.head, f.headAng);
      m.shld = Math.max(m.shld, f.shieldErr);
    }
    const allowLat = name === 'dead' ? 24 : 12;
    const allowShield = (!checkShield || name === 'dead' || name === 'knockdown') ? 180 : 3;
    const ok = m.kLH <= 2 && m.kRH <= 2 && m.kLL <= allowLat && m.kRL <= allowLat
      && m.eLH <= 2 && m.eRH <= 2 && m.eLL <= allowLat && m.eRL <= allowLat
      && m.head <= 75 && m.shld <= allowShield;
    if (!ok) failures.push(`${heroId}:${name}`);
    const fmt = (fl, hy, la) => `${fl.toFixed(0)}/${hy.toFixed(0)}/${la.toFixed(0)}`.padEnd(15);
    console.log(
      name.padEnd(12), '|',
      fmt(m.kLF, m.kLH, m.kLL), '|',
      fmt(m.kRF, m.kRH, m.kRL), '|',
      fmt(m.eLF, m.eLH, m.eLL), '|',
      fmt(m.eRF, m.eRH, m.eRL), '|',
      m.head.toFixed(0).padEnd(4), '|',
      m.shld.toFixed(0).padEnd(4),
      ok ? '' : ' <-- FAIL'
    );
  }
  view.dispose();

  const walkSpd = heroId === 'ninja' ? 7.0 : (heroId === 'mage' ? 5.1 : (heroId === 'cowboy' ? 5.8 : (heroId === 'samurai' ? 6.6 : 5.4)));
  const runSpd = heroId === 'ninja' ? 12.25 : (heroId === 'mage' ? 8.16 : (heroId === 'cowboy' ? 9.0 : (heroId === 'samurai' ? 10.5 : 7.5)));
  const SEQS = {
    walk: Array.from({ length: 60 }, (_, i) => ({ z: i * walkSpd * dt, vz: walkSpd })),
    sprint: Array.from({ length: 60 }, (_, i) => ({ z: i * runSpd * dt, vz: runSpd, isSprinting: true })),
    dash: Array.from({ length: 24 }, (_, i) => ({ z: i * 12 * dt, vz: 12, isDashing: true })),
    jumpLand: [
      ...Array.from({ length: 18 }, (_, i) => ({ y: 0.2 + i * 0.06, grounded: false, vy: 8 - i * 0.4, jumpCount: 1 })),
      ...Array.from({ length: 18 }, (_, i) => ({ y: Math.max(0.02, 1.1 - i * 0.065), grounded: false, vy: -9, jumpCount: heroId === 'ninja' ? 3 : 1 })),
      ...Array.from({ length: 24 }, () => ({ y: 0, grounded: true, vy: 0 }))
    ],
    combo: [
      ...Array.from({ length: 14 }, () => ({ state: 'attack', comboStep: 1 })),
      ...Array.from({ length: 14 }, () => ({ state: 'attack', comboStep: 2 })),
      ...Array.from({ length: 24 }, () => ({ state: 'attack', comboStep: 3 }))
    ],
    dodge: Array.from({ length: 24 }, (_, i) => ({ x: i * 9 * dt, vx: 9, isRolling: true })),
    hurt: Array.from({ length: 20 }, () => ({ state: 'hurt' })),
    ...(heroId === 'ninja' ? {
      skills: [
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'ninja_weapon' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'ninja_armor' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'ninja_helmet' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'ninja_trinket' }))
      ]
    } : {}),
    ...(heroId === 'samurai' ? {
      skills: [
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'samurai_weapon' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'samurai_armor' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'samurai_helmet' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'samurai_trinket' }))
      ]
    } : {}),
    ...(heroId === 'cowboy' ? {
      skills: [
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'cowboy_weapon' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'cowboy_armor' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'cowboy_helmet' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'cowboy_trinket' }))
      ]
    } : {}),
    ...(heroId === 'mage' ? {
      fly: Array.from({ length: 30 }, () => ({ y: 1.6, grounded: false, vy: 0, isFlying: true })),
      skills: [
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'mage_weapon' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'mage_armor' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'mage_helmet' })),
        ...Array.from({ length: 24 }, () => ({ state: 'skill', animSkillId: 'mage_trinket' }))
      ]
    } : {})
  };

  console.log(`\n=== ${heroId.toUpperCase()} LIVE 60Hz RUNTIME AUDIT ===`);
  for (const [name, frames] of Object.entries(SEQS)) {
    const actor = new ChibiView(base);
    for (let i = 0; i < 20; i++) actor.update(base, { dt, floorY: () => 0 });
    const worst = { kH: 0, kL: 0, eH: 0, eL: 0, head: 0, shld: 0 };
    for (const s of frames) {
      actor.update({ ...base, ...s }, { dt, floorY: () => 0 });
      const f = measureFrame(actor, checkShield);
      worst.kH = Math.max(worst.kH, f.kneeL.hyp, f.kneeR.hyp);
      worst.kL = Math.max(worst.kL, f.kneeL.lat, f.kneeR.lat);
      worst.eH = Math.max(worst.eH, f.elbowL.hyp, f.elbowR.hyp);
      worst.eL = Math.max(worst.eL, f.elbowL.lat, f.elbowR.lat);
      worst.head = Math.max(worst.head, f.headAng);
      worst.shld = Math.max(worst.shld, f.shieldErr);
    }
    actor.dispose();
    const ok = worst.kH <= 2 && worst.kL <= 12 && worst.eH <= 2 && worst.eL <= 12 && worst.head <= 75 && worst.shld <= (checkShield ? 3 : 180);
    if (!ok) failures.push(`${heroId}:live:${name}`);
    console.log(
      name.padEnd(10),
      `kneeHyp=${worst.kH.toFixed(1)} kneeLat=${worst.kL.toFixed(1)}`,
      `elbHyp=${worst.eH.toFixed(1)} elbLat=${worst.eL.toFixed(1)}`,
      `head=${worst.head.toFixed(1)} shld=${worst.shld.toFixed(1)}`,
      ok ? 'OK' : 'FAIL'
    );
  }
}

if (strict && failures.length) {
  console.error(`\nFAILED anatomy audit: ${failures.join(', ')}`);
  process.exit(1);
}
