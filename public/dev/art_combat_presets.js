// ============================================================================
// Named Art & Combat Presets for /dev/art-combat-lab.html
//
// Rules for future experiments:
// - Keep preset 'A' untouched as the permanent baseline (current live game).
// - Keep preset 'B' synced with the user-selected Knight Sprite Proof tone.
// - When iterating on preset 'C', bump PRESET_REVISION (e.g. 'C-r2') or add a
//   new entry in PRESETS and record the change in docs/handoff/art-combat-lab-log.md.
// ============================================================================
import { DEFAULT_TONE_PARAMS } from '/dev/art_tone_shader.js';

export const PRESET_REVISION = 'C-r1';
export const PRESET_ORDER = ['A', 'B', 'C'];

const KNIGHT_PROOF_TONE = Object.freeze({
  ...DEFAULT_TONE_PARAMS,
  colorMode: 'proof',
  headBoost: 1.22,
  outlinePx: 1.0,
  outlineAlpha: 0.95,
  outlineColor: '#40332c'
});

export const PRESETS = {
  A: {
    id: 'A',
    revision: 'baseline',
    label: 'A · เกมปัจจุบัน (Baseline)',
    shortLabel: 'A · เกมเดิม',
    summary: 'วัสดุ 3D, แสง, ฉาก Sky Temple, เงาใต้เท้า และสีเอฟเฟกต์ของเกมปัจจุบันทั้งหมด',
    knightTone: null,
    ninjaTone: null,
    stage: {
      floorTint: '#ffffff',
      propTint: '#ffffff',
      fogColor: '#f6e7cc',
      fogNearOffset: 11,
      fogFarOffset: 15,
      exposure: 1.02,
      envIntensity: 0.72
    },
    lighting: {
      hemiSky: '#fff5e0',
      hemiGround: '#a7bfd9',
      hemiIntensity: 1.0,
      sunColor: '#fff0d4',
      sunIntensity: 1.7
    },
    groundShadow: {
      color: '#ffffff',
      scale: 1.08,
      opacity: 0.92,
      knightRingColor: '#d4a349',
      ninjaRingColor: '#f87171',
      ringOpacity: 0.42
    },
    vfx: {
      recolor: false,
      swordTrail: {
        root: [0.22, 0.50, 0.98],
        mid: [0.20, 0.55, 1.00],
        edge: [0.94, 0.99, 1.00]
      },
      hit: {
        outline: '#3a1c00',
        body: '#ffd46e',
        accent: '#ffb02a',
        hot: '#fff7e2',
        spark: '#ffd46e',
        damageText: '#ffb15c',
        scale: 1.0
      },
      block: {
        shield: '#60a5fa',
        shieldOpacity: 0.22,
        ring: '#bfe7ff',
        spark: '#bfdbfe',
        flash: '#93c5fd',
        text: '#60a5fa',
        scale: 1.0
      }
    }
  },

  B: {
    id: 'B',
    revision: 'knight-proof-v1',
    label: 'B · เฉพาะ Knight ลดโทน 3D (Proof)',
    shortLabel: 'B · Knight โทนใหม่',
    summary: 'เปลี่ยนเฉพาะ Knight เป็นโทนลด 3D (Proof) ขณะที่ Ninja, ฉาก, แสง และ FX ยังเป็นค่าเดิม',
    knightTone: KNIGHT_PROOF_TONE,
    ninjaTone: null,
    stage: {
      floorTint: '#ffffff',
      propTint: '#ffffff',
      fogColor: '#f6e7cc',
      fogNearOffset: 11,
      fogFarOffset: 15,
      exposure: 1.02,
      envIntensity: 0.72
    },
    lighting: {
      hemiSky: '#fff5e0',
      hemiGround: '#a7bfd9',
      hemiIntensity: 1.0,
      sunColor: '#fff0d4',
      sunIntensity: 1.7
    },
    groundShadow: {
      color: '#ffffff',
      scale: 1.08,
      opacity: 0.92,
      knightRingColor: '#d4a349',
      ninjaRingColor: '#f87171',
      ringOpacity: 0.42
    },
    vfx: {
      recolor: false,
      swordTrail: {
        root: [0.22, 0.50, 0.98],
        mid: [0.20, 0.55, 1.00],
        edge: [0.94, 0.99, 1.00]
      },
      hit: {
        outline: '#3a1c00',
        body: '#ffd46e',
        accent: '#ffb02a',
        hot: '#fff7e2',
        spark: '#ffd46e',
        damageText: '#ffb15c',
        scale: 1.0
      },
      block: {
        shield: '#60a5fa',
        shieldOpacity: 0.22,
        ring: '#bfe7ff',
        spark: '#bfdbfe',
        flash: '#93c5fd',
        text: '#60a5fa',
        scale: 1.0
      }
    }
  },

  C: {
    id: 'C',
    revision: 'C-r1',
    label: 'C · จูนสนาม แสง เงา และ FX ร่วมกัน (C-r1)',
    shortLabel: 'C · จูนรวม C-r1',
    summary: 'ใช้ Knight แบบเดียวกับ B แล้วจูนพื้นศิลา Sky Temple ให้นุ่มลง ลดความจ้าของแสง เน้นเงาใต้เท้า และแยกสี FX โดน (อำพันอุ่น) กับ บล็อก (ฟ้าเย็น) ให้ไม่บังโล่',
    knightTone: KNIGHT_PROOF_TONE,
    ninjaTone: null,
    stage: {
      floorTint: '#cfd4c6',
      propTint: '#d8d9cc',
      fogColor: '#e8e2d0',
      fogNearOffset: 11,
      fogFarOffset: 15,
      exposure: 0.96,
      envIntensity: 0.55
    },
    lighting: {
      hemiSky: '#f5ecdc',
      hemiGround: '#8ea19d',
      hemiIntensity: 0.92,
      sunColor: '#ffe8c6',
      sunIntensity: 1.42
    },
    groundShadow: {
      color: '#6b594c',
      scale: 1.18,
      opacity: 0.98,
      knightRingColor: '#b89658',
      ninjaRingColor: '#b86c6c',
      ringOpacity: 0.28
    },
    vfx: {
      recolor: true,
      swordTrail: {
        root: [0.68, 0.48, 0.22],
        mid: [0.95, 0.76, 0.38],
        edge: [1.00, 0.96, 0.86]
      },
      hit: {
        outline: '#3b2316',
        body: '#e57b35',
        accent: '#f2b857',
        hot: '#fff2cc',
        spark: '#f2b857',
        damageText: '#ff8b3d',
        scale: 0.82
      },
      block: {
        shield: '#5b8fd9',
        shieldOpacity: 0.15,
        ring: '#74b9ff',
        spark: '#d6eeff',
        flash: '#9bc9f5',
        text: '#7dd3fc',
        scale: 0.88
      }
    }
  }
};
