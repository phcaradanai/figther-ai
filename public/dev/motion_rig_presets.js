// ============================================================================
// Motion & Rig Lab — Presets, Joint Specs, & JSON Draft/Export Validation
// Strictly dev-lab only; zero DOM dependencies so Node tests can verify directly.
// ============================================================================

export const SCHEMA_ID = 'figther-ai.motion-rig.v1';
export const RIG_SPEC_VERSION = 'knight-skinned-v1';
export const SUPPORTED_HEROES = ['knight'];
export const SUPPORTED_CLIPS = ['attack2', 'attack1', 'attack3', 'heavy'];

export const JOINT_SPECS = [
  {
    id: 'hips',
    label: 'สะโพก (Hips)',
    group: 'แกนลำตัว',
    axes: 'XYZ',
    hasHipsY: true,
    hipsYRangeCm: [-18, 18],
    rangeDeg: { x: [-60, 60], y: [-60, 60], z: [-45, 45] }
  },
  {
    id: 'torso',
    label: 'ลำตัว / อก (Torso)',
    group: 'แกนลำตัว',
    axes: 'XYZ',
    rangeDeg: { x: [-40, 60], y: [-55, 55], z: [-30, 30] }
  },
  {
    id: 'head',
    label: 'ศีรษะ (Head)',
    group: 'แกนลำตัว',
    axes: 'XYZ',
    rangeDeg: { x: [-40, 48], y: [-65, 65], z: [-28, 28] }
  },
  {
    id: 'armR',
    label: 'ไหล่ขวา (ดาบ)',
    group: 'แขนขวา (อาวุธ)',
    axes: 'XYZ',
    rangeDeg: { x: [-90, 90], y: [-90, 90], z: [-90, 90] }
  },
  {
    id: 'foreR',
    label: 'ศอกขวา',
    group: 'แขนขวา (อาวุธ)',
    axes: 'XYZ',
    lockZ: true,
    rangeDeg: { x: [-90, 90], y: [-75, 75], z: [0, 0] }
  },
  {
    id: 'handR',
    label: 'ข้อมือขวา (จับดาบ)',
    group: 'แขนขวา (อาวุธ)',
    axes: 'XYZ',
    rangeDeg: { x: [-60, 60], y: [-55, 55], z: [-36, 36] }
  },
  {
    id: 'swordMount',
    label: 'จุดจับอาวุธ (Sword Mount)',
    group: 'แขนขวา (อาวุธ)',
    axes: 'XYZ',
    isMount: true,
    posRangeCm: [-10, 10],
    rangeDeg: { x: [-45, 45], y: [-45, 45], z: [-45, 45] }
  },
  {
    id: 'armL',
    label: 'ไหล่ซ้าย (โล่)',
    group: 'แขนซ้าย (โล่)',
    axes: 'XYZ',
    rangeDeg: { x: [-90, 90], y: [-90, 90], z: [-90, 90] }
  },
  {
    id: 'foreL',
    label: 'ศอกซ้าย',
    group: 'แขนซ้าย (โล่)',
    axes: 'XYZ',
    lockZ: true,
    rangeDeg: { x: [-90, 90], y: [-75, 75], z: [0, 0] }
  },
  {
    id: 'handL',
    label: 'ข้อมือซ้าย (สายรัดโล่)',
    group: 'แขนซ้าย (โล่)',
    axes: 'XYZ',
    shieldLockedDefault: true,
    rangeDeg: { x: [-45, 45], y: [-45, 45], z: [-45, 45] }
  },
  {
    id: 'legL',
    label: 'สะโพก/ต้นขาซ้าย',
    group: 'ขาซ้าย',
    axes: 'XYZ',
    rangeDeg: { x: [-75, 75], y: [-45, 45], z: [-45, 45] }
  },
  {
    id: 'shinL',
    label: 'เข่าซ้าย',
    group: 'ขาซ้าย',
    axes: 'XYZ',
    lockZ: true,
    rangeDeg: { x: [-75, 75], y: [-10, 10], z: [0, 0] }
  },
  {
    id: 'footL',
    label: 'เท้าซ้าย',
    group: 'ขาซ้าย',
    axes: 'XYZ',
    rangeDeg: { x: [-45, 55], y: [-25, 25], z: [-20, 20] }
  },
  {
    id: 'legR',
    label: 'สะโพก/ต้นขาขวา',
    group: 'ขาขวา',
    axes: 'XYZ',
    rangeDeg: { x: [-75, 75], y: [-45, 45], z: [-45, 45] }
  },
  {
    id: 'shinR',
    label: 'เข่าขวา',
    group: 'ขาขวา',
    axes: 'XYZ',
    lockZ: true,
    rangeDeg: { x: [-75, 75], y: [-10, 10], z: [0, 0] }
  },
  {
    id: 'footR',
    label: 'เท้าขวา',
    group: 'ขาขวา',
    axes: 'XYZ',
    rangeDeg: { x: [-45, 55], y: [-25, 25], z: [-20, 20] }
  }
];

export const JOINT_SPEC_MAP = Object.fromEntries(JOINT_SPECS.map(j => [j.id, j]));
export const VALID_JOINT_IDS = new Set(JOINT_SPECS.filter(j => !j.isMount).map(j => j.id));

export const MOVEMENT_PRESET_ORDER = ['baseline', 'dash_grounded_r1'];

export const MOVEMENT_PRESETS = {
  baseline: {
    id: 'baseline',
    label: 'Baseline · เกมเดิม',
    summary: 'ใช้ค่า dash เกมปัจจุบันตรง ๆ (ไม่มี wind-up, ไม่มียันเท้าเบรก, ไม่มีภาพติดตาบอกทิศ)',
    enabled: false,
    windupLeanDeg: 0,
    windupHipDropCm: 0,
    dashLeanDeg: 0,
    dashHipDropCm: 0,
    leadFootFlexDeg: 0,
    trailFootExtendDeg: 0,
    brakeLeanDeg: 0,
    brakeHipDropCm: 0,
    brakeFootLock: false,
    recoverDuration: 0.14,
    showAfterimages: false,
    showDust: false
  },
  dash_grounded_r1: {
    id: 'dash_grounded_r1',
    label: 'Tuned r1 · โน้มพุ่ง + ยันเท้าเบรก',
    summary: 'เพิ่มเตรียมตัว -10° ย่อ 4.5cm -> โน้มพุ่ง 28° ย่อ 9.5cm + ภาพติดตา/ฝุ่น -> ยันเท้าหน้าล็อกพื้นเบรก (-14°)',
    enabled: true,
    windupLeanDeg: -10,
    windupHipDropCm: 4.5,
    dashLeanDeg: 28,
    dashHipDropCm: 9.5,
    leadFootFlexDeg: 18,
    trailFootExtendDeg: 22,
    brakeLeanDeg: -14,
    brakeHipDropCm: 8.5,
    brakeFootLock: true,
    recoverDuration: 0.22,
    showAfterimages: true,
    showDust: true
  }
};

export const RIG_PRESET_ORDER = [
  'attack2_clean_r1',
  'attack2_baseline',
  'attack1_baseline',
  'attack3_baseline',
  'heavy_baseline'
];

export const RIG_PRESETS = {
  attack2_baseline: {
    id: 'attack2_baseline',
    heroId: 'knight',
    clip: 'attack2',
    rigVersion: RIG_SPEC_VERSION,
    label: 'Baseline · attack2 (เกมเดิม)',
    summary: 'คลิปเดิม: ดาบทะลุ armL 3.4cm ที่ 0.000s, ข้อมือขวาดีด -45.3°/เฟรม และดาบทะลุหมวก 6.0cm ที่ 0.367s',
    keyframes: []
  },
  attack2_clean_r1: {
    id: 'attack2_clean_r1',
    heroId: 'knight',
    clip: 'attack2',
    rigVersion: RIG_SPEC_VERSION,
    label: 'Fixed r1 · attack2 แก้แนวไหล่–ศอก–ข้อมือ',
    summary: 'กระจายมุมคืนท่าไปที่ไหล่ขวา (armR) + ศอกขวา (foreR) และคลายข้อมือขวา (handR) ลดทะลุ >2cm จาก 3/13 เหลือ 0/13 เฟรม โดยคงเฟรมสัมผัส 0.100s เดิม',
    keyframes: [
      { t: 0.000, joints: { armR: [20, 10, 10], foreR: [15, 0, 0], handR: [6, 12, 20] } },
      { t: 0.067, joints: { armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 4] } },
      { t: 0.100, joints: { armR: [0, 0, 0], foreR: [0, 0, 0], handR: [0, 0, 0] } },
      { t: 0.200, joints: { armR: [4, 6, 12], foreR: [-6, -8, 0], handR: [-14, 14, -12] } },
      { t: 0.333, joints: { armR: [6, 18, 28], foreR: [-10, -10, 0], handR: [-18, 18, -16] } },
      { t: 0.367, joints: { armR: [10, 24, 34], foreR: [-14, -8, 0], handR: [14, 22, -6] } },
      { t: 0.400, joints: { armR: [8, 20, 32], foreR: [-6, -6, 0], handR: [-6, 16, -16] } }
    ]
  },
  attack1_baseline: {
    id: 'attack1_baseline',
    heroId: 'knight',
    clip: 'attack1',
    rigVersion: RIG_SPEC_VERSION,
    label: 'Baseline · attack1 (เกมเดิม)',
    summary: 'ท่าฟันเฉียง 1: คลิปเกมปัจจุบัน (มีเฉียดขอบโล่ 2.1cm ช่วง 0.233s สำหรับดูเปรียบเทียบ)',
    keyframes: []
  },
  attack3_baseline: {
    id: 'attack3_baseline',
    heroId: 'knight',
    clip: 'attack3',
    rigVersion: RIG_SPEC_VERSION,
    label: 'Baseline · attack3 (เกมเดิม)',
    summary: 'ท่าปิดคอมโบ 3: คลิปเกมปัจจุบัน',
    keyframes: []
  },
  heavy_baseline: {
    id: 'heavy_baseline',
    heroId: 'knight',
    clip: 'heavy',
    rigVersion: RIG_SPEC_VERSION,
    label: 'Baseline · heavy (Shield Bash เกมเดิม)',
    summary: 'ท่ากระแทกโล่: คลิปทำมือปัจจุบัน สำหรับตรวจแนวไหล่-ศอก-ข้อมือซ้ายและเท้าหลัก',
    keyframes: []
  }
};

export function presetsForClip(clip) {
  return RIG_PRESET_ORDER
    .map(id => RIG_PRESETS[id])
    .filter(p => p && p.clip === clip);
}

export function defaultPresetForClip(clip) {
  if (clip === 'attack2') return 'attack2_clean_r1';
  return `${clip}_baseline`;
}

export function cloneKeyframes(keyframes = []) {
  return (keyframes || [])
    .map(kf => ({
      t: Number(Number(kf.t).toFixed(4)),
      ...(Number.isFinite(kf.hipsYCm) && kf.hipsYCm !== 0 ? { hipsYCm: Number(kf.hipsYCm) } : {}),
      ...(Array.isArray(kf.swordMountPosCm) ? { swordMountPosCm: kf.swordMountPosCm.slice(0, 3).map(Number) } : {}),
      ...(Array.isArray(kf.swordMountRotDeg) ? { swordMountRotDeg: kf.swordMountRotDeg.slice(0, 3).map(Number) } : {}),
      joints: Object.fromEntries(
        Object.entries(kf.joints || {}).map(([j, vec]) => [j, vec.slice(0, 3).map(Number)])
      )
    }))
    .sort((a, b) => a.t - b.t);
}

function lerp3(a = [0, 0, 0], b = [0, 0, 0], k = 0) {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function isZero3(v) {
  return !v || (Math.abs(v[0]) < 1e-6 && Math.abs(v[1]) < 1e-6 && Math.abs(v[2]) < 1e-6);
}

export function sampleRigKeyframes(keyframes, t) {
  const sorted = cloneKeyframes(keyframes);
  const empty = { joints: {}, hipsYCm: 0, swordMountPosCm: [0, 0, 0], swordMountRotDeg: [0, 0, 0] };
  if (!sorted.length) return empty;

  let a = sorted[0];
  let b = sorted[sorted.length - 1];
  let k = 0;

  if (t <= a.t) {
    b = a;
  } else if (t >= b.t) {
    a = b;
  } else {
    for (let i = 0; i < sorted.length - 1; i++) {
      if (t >= sorted[i].t && t <= sorted[i + 1].t) {
        a = sorted[i];
        b = sorted[i + 1];
        const span = Math.max(1e-6, b.t - a.t);
        const u = (t - a.t) / span;
        k = u * u * (3 - 2 * u);
        break;
      }
    }
  }

  const joints = {};
  const names = new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);
  for (const name of names) {
    const v = lerp3(a.joints[name] || [0, 0, 0], b.joints[name] || [0, 0, 0], k);
    if (!isZero3(v)) joints[name] = v;
  }

  const ha = Number(a.hipsYCm || 0);
  const hb = Number(b.hipsYCm || 0);
  const hipsYCm = ha + (hb - ha) * k;

  const swordMountPosCm = lerp3(a.swordMountPosCm || [0, 0, 0], b.swordMountPosCm || [0, 0, 0], k);
  const swordMountRotDeg = lerp3(a.swordMountRotDeg || [0, 0, 0], b.swordMountRotDeg || [0, 0, 0], k);

  return { joints, hipsYCm, swordMountPosCm, swordMountRotDeg };
}

export function buildExportPayload({
  mode = 'rig',
  heroId = 'knight',
  clip = 'attack2',
  presetId = 'custom_draft',
  label = 'Custom Draft',
  movementParams = null,
  keyframes = []
} = {}) {
  return {
    schema: SCHEMA_ID,
    rigVersion: RIG_SPEC_VERSION,
    heroId,
    clip,
    mode,
    presetId,
    label,
    updatedAt: new Date().toISOString(),
    movementParams: movementParams ? { ...movementParams } : { ...MOVEMENT_PRESETS.dash_grounded_r1 },
    keyframes: cloneKeyframes(keyframes)
  };
}

function isVec3Finite(v) {
  return Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));
}

export function validateImportPayload(raw, expected = {}) {
  const errors = [];
  const warnings = [];

  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return { ok: false, errors: [`JSON ไม่ถูกต้อง: ${err.message}`], warnings, data: null };
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['โครงสร้างไฟล์ต้องเป็นอ็อบเจกต์ JSON'], warnings, data: null };
  }

  if (data.schema !== SCHEMA_ID) {
    errors.push(`schema "${data.schema || '-'}" ไม่รองรับ (ต้องเป็น "${SCHEMA_ID}")`);
  }

  if (data.rigVersion !== RIG_SPEC_VERSION) {
    errors.push(`ไฟล์นี้สำหรับ rig เวอร์ชัน "${data.rigVersion || '-'}" ไม่ตรงกับเวอร์ชันปัจจุบัน ("${RIG_SPEC_VERSION}")`);
  }

  const expectedHero = expected.heroId || 'knight';
  if (!SUPPORTED_HEROES.includes(data.heroId)) {
    errors.push(`ตัวละคร "${data.heroId || '-'}" ยังไม่รองรับใน Lab นี้ (รองรับ: ${SUPPORTED_HEROES.join(', ')})`);
  } else if (expectedHero && data.heroId !== expectedHero) {
    errors.push(`ไฟล์นี้สำหรับตัวละคร "${data.heroId}" ไม่ตรงกับตัวละครที่เปิดอยู่ ("${expectedHero}")`);
  }

  if (data.mode !== 'movement' && data.mode !== 'rig') {
    errors.push(`mode "${data.mode || '-'}" ไม่ถูกต้อง (ต้องเป็น "movement" หรือ "rig")`);
  }

  if (data.mode === 'rig' || data.clip) {
    if (!SUPPORTED_CLIPS.includes(data.clip)) {
      errors.push(`ท่า "${data.clip || '-'}" ไม่อยู่ในรายการที่ Lab รองรับ (${SUPPORTED_CLIPS.join(', ')})`);
    } else if (expected.clip && expected.mode === 'rig' && data.clip !== expected.clip) {
      errors.push(`ไฟล์นี้สำหรับท่า "${data.clip}" แต่ตอนนี้กำลังเปิดท่า "${expected.clip}" อยู่ (สลับไปท่า "${data.clip}" ก่อนนำเข้าหรือตรวจไฟล์)`);
    }
  }

  if (data.movementParams !== undefined) {
    if (!data.movementParams || typeof data.movementParams !== 'object' || Array.isArray(data.movementParams)) {
      errors.push('movementParams ต้องเป็นอ็อบเจกต์');
    } else {
      const numericKeys = ['windupLeanDeg', 'windupHipDropCm', 'dashLeanDeg', 'dashHipDropCm', 'leadFootFlexDeg', 'trailFootExtendDeg', 'brakeLeanDeg', 'brakeHipDropCm', 'recoverDuration'];
      for (const k of numericKeys) {
        if (k in data.movementParams && (typeof data.movementParams[k] !== 'number' || !Number.isFinite(data.movementParams[k]))) {
          errors.push(`movementParams.${k} ต้องเป็นตัวเลขที่ถูกต้อง`);
        }
      }
    }
  }

  if (!Array.isArray(data.keyframes)) {
    errors.push('keyframes ต้องเป็นอาเรย์');
  } else {
    data.keyframes.forEach((kf, idx) => {
      if (!kf || typeof kf !== 'object') {
        errors.push(`keyframe #${idx} ไม่ใช่อ็อบเจกต์`);
        return;
      }
      if (typeof kf.t !== 'number' || !Number.isFinite(kf.t) || kf.t < 0 || kf.t > 10) {
        errors.push(`keyframe #${idx} มีเวลา t="${kf.t}" ไม่ถูกต้อง`);
      }
      if (kf.hipsYCm !== undefined && (typeof kf.hipsYCm !== 'number' || !Number.isFinite(kf.hipsYCm))) {
        errors.push(`keyframe #${idx} ค่า hipsYCm ไม่ถูกต้อง`);
      }
      if (kf.swordMountPosCm !== undefined && !isVec3Finite(kf.swordMountPosCm)) {
        errors.push(`keyframe #${idx} ค่า swordMountPosCm ต้องเป็น [x,y,z]`);
      }
      if (kf.swordMountRotDeg !== undefined && !isVec3Finite(kf.swordMountRotDeg)) {
        errors.push(`keyframe #${idx} ค่า swordMountRotDeg ต้องเป็น [x,y,z]`);
      }
      if (kf.joints !== undefined) {
        if (!kf.joints || typeof kf.joints !== 'object' || Array.isArray(kf.joints)) {
          errors.push(`keyframe #${idx} joints ต้องเป็นอ็อบเจกต์`);
        } else {
          for (const [jointId, vec] of Object.entries(kf.joints)) {
            if (!VALID_JOINT_IDS.has(jointId)) {
              errors.push(`keyframe #${idx} พบชื่อข้อต่อ "${jointId}" ที่ไม่มีอยู่ใน rig "${RIG_SPEC_VERSION}"`);
            } else if (!isVec3Finite(vec)) {
              errors.push(`keyframe #${idx} ค่ามุมของ "${jointId}" ต้องเป็นอาเรย์ 3 ตัวเลข [x, y, z]`);
            }
          }
        }
      }
    });
  }

  if (expected.mode && data.mode && expected.mode !== data.mode) {
    warnings.push(`ไฟล์ถูกบันทึกจากโหมด "${data.mode}" (ระบบจะสลับโหมดให้อัตโนมัติเมื่อนำเข้า)`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? { ...data, keyframes: cloneKeyframes(data.keyframes) } : null
  };
}
