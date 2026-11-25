// ============================================================================
// LOST SAGA 3D - IRON KNIGHT EFFEKSEER FOR WEBGL (1.80.8) + HD2D VFX ENGINE
// ============================================================================
// Dual-mode Iron Knight VFX runtime:
//   1. PRIMARY (True 3D WebGL): Uses EffekseerForWebGL 1.80.8 (.efkefc + WASM)
//      with exact 4x4 View/Projection matrix synchronization matching
//      PixelRenderer25D's 45-degree diamond isometric camera (or any Three.js /
//      Babylon.js / custom WebGL camera).
//   2. AUTOMATIC HD TEXTURED FALLBACK: Uses the 10 custom 512x512 Knight PNG
//      VFX textures (/assets/vfx/knight/textures/*.png) on Canvas 2D whenever
//      .efkefc / effekseer.wasm has not been built yet, so Knight immediately
//      displays the new HD VFX suite in-game with zero setup friction!
// ============================================================================
(function (root) {
  const COS45 = Math.SQRT1_2;

  const KNIGHT_VFX_CATALOG = {
    basic_slash: {
      id: 'basic_slash',
      hotkey: '1',
      nameTh: 'คอมโบฟันดาบ (Broadsword Slash)',
      file: '/assets/vfx/knight/knight_basic_slash.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_basic_slash.efk',
      sourceFile: '/assets/vfx/knight/knight_basic_slash.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.48,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'คลื่นดาบเสี้ยวทอง-น้ำเงินแซฟไฟร์ + ประกายไฟฟัน 3 มิติ'
    },
    heavy_shield_bash: {
      id: 'heavy_shield_bash',
      hotkey: '2',
      nameTh: 'กระแทกโล่ทะลวงการ์ด (Shield Bash)',
      file: '/assets/vfx/knight/knight_heavy_shield_bash.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_heavy_shield_bash.efk',
      sourceFile: '/assets/vfx/knight/knight_heavy_shield_bash.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.68,
      attachToCaster: false,
      color: '#38bdf8',
      desc: 'ตราโล่หกเหลี่ยม Aegis พุ่งกระแทก + คลื่นทะลวงการ์ดสีทอง'
    },
    knight_weapon: {
      id: 'knight_weapon',
      hotkey: '3',
      nameTh: '[Q/SD] คลื่นดาบเอ็กซ์คาลิเบอร์ (Excalibur Wave)',
      file: '/assets/vfx/knight/knight_skill_weapon_excalibur.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_weapon_excalibur.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_weapon_excalibur.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.05,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'วงเวทศักดิ์สิทธิ์ใต้เท้า + คลื่นดาบแสงทองแนวตั้งพุ่งทะลวงศัตรู'
    },
    knight_armor: {
      id: 'knight_armor',
      hotkey: '4',
      nameTh: '[E/ASD] ปราการศักดิ์สิทธิ์ (Aegis Fortress)',
      file: '/assets/vfx/knight/knight_skill_armor_aegis.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_armor_aegis.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_armor_aegis.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.45,
      attachToCaster: true,
      color: '#60a5fa',
      desc: 'โดมกำแพงโล่ 6 ด้าน + คลื่นกระแทกรอบตัว + ริบบิ้น Super Armor หมุนวน'
    },
    knight_helmet: {
      id: 'knight_helmet',
      hotkey: '5',
      nameTh: '[R/AD] คำรามราชสีห์ (Lionheart Warcry)',
      file: '/assets/vfx/knight/knight_skill_helmet_lionheart.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_helmet_lionheart.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_helmet_lionheart.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.25,
      attachToCaster: true,
      color: '#f59e0b',
      desc: 'ตราราชสีห์คำราม 3 ระลอก + เสาแสงทอง + กากบาทฮีล +20 HP'
    },
    knight_trinket: {
      id: 'knight_trinket',
      hotkey: '6',
      nameTh: '[F/AS] พุ่งชนโล่ราชรถ (Chariot Rush)',
      file: '/assets/vfx/knight/knight_skill_trinket_chariot.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_skill_trinket_chariot.efk',
      sourceFile: '/assets/vfx/knight/knight_skill_trinket_chariot.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.95,
      attachToCaster: true,
      color: '#38bdf8',
      desc: 'กรวยลมหัวโล่ 3 มิติ + วงแหวนความเร็วสูง + ประกายไฟเสียดสีพื้น'
    },
    guard_parry: {
      id: 'guard_parry',
      hotkey: '7',
      nameTh: 'ตั้งโล่สะท้อน (Shield Guard / Parry)',
      file: '/assets/vfx/knight/knight_hit_guard_parry.efkefc',
      fallbackFile: '/assets/vfx/knight/knight_hit_guard_parry.efk',
      sourceFile: '/assets/vfx/knight/knight_hit_guard_parry.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.50,
      attachToCaster: false,
      color: '#7dd3fc',
      desc: 'ม่านโล่หกเหลี่ยมฟ้าคราม + แสงสะท้อน Starburst + สะเก็ดไฟกระเด็น'
    },

    // ========================================================================
    // 2. SHADOW NINJA (นินจาเงา) 7-MOVE EFFEKSEER VFX SUITE
    // ========================================================================
    ninja_basic_slash: {
      id: 'ninja_basic_slash',
      hero: 'ninja',
      nameTh: 'คอมโบมีดสั้นคู่ (Dual Kunai Cross-Slash)',
      file: '/assets/vfx/ninja/ninja_basic_slash.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_basic_slash.efk',
      sourceFile: '/assets/vfx/ninja/ninja_basic_slash.efkproj',
      scale: 1.0,
      speed: 1.2,
      durationSec: 0.38,
      attachToCaster: false,
      color: '#a855f7',
      desc: 'คมมีดสั้นคู่สีม่วงเงา-ฟ้าครามฟันไขว้ความเร็วสูง'
    },
    ninja_heavy_backstab: {
      id: 'ninja_heavy_backstab',
      hero: 'ninja',
      nameTh: 'ก้าวพริบตาแทงหลัง (Shadow Backstab)',
      file: '/assets/vfx/ninja/ninja_heavy_backstab.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_heavy_backstab.efk',
      sourceFile: '/assets/vfx/ninja/ninja_heavy_backstab.efkproj',
      scale: 1.0,
      speed: 1.1,
      durationSec: 0.65,
      attachToCaster: false,
      color: '#f43f5e',
      desc: 'รอยฟันกากบาทสีแดงเพลิง-ม่วงเงา + หมอกนินจา + ยันต์พื้น'
    },
    ninja_weapon: {
      id: 'ninja_weapon',
      hero: 'ninja',
      nameTh: '[Q/SD] พายุเพลงดาบเงา (Izuna Blade Storm)',
      file: '/assets/vfx/ninja/ninja_skill_weapon_izuna.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_skill_weapon_izuna.efk',
      sourceFile: '/assets/vfx/ninja/ninja_skill_weapon_izuna.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 1.08,
      attachToCaster: false,
      color: '#a855f7',
      desc: 'ยันต์คุจิอิน + พายุเพลงดาบ 6 แนว + พายุหมุนเงาเสยศัตรูลอยฟ้า'
    },
    ninja_armor: {
      id: 'ninja_armor',
      hero: 'ninja',
      nameTh: '[E/ASD] ระเบิดควันพรางตัว (Smoke Bomb Stealth)',
      file: '/assets/vfx/ninja/ninja_skill_armor_smokebomb.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_skill_armor_smokebomb.efk',
      sourceFile: '/assets/vfx/ninja/ninja_skill_armor_smokebomb.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.35,
      attachToCaster: false,
      color: '#8b5cf6',
      desc: 'โดมควันสีครามม่วงหนาแน่น + คลื่นสตั๊นรอบตัว + ยันต์พรางตัว'
    },
    ninja_helmet: {
      id: 'ninja_helmet',
      hero: 'ninja',
      nameTh: '[R/AD] ดาวกระจายยักษ์ 5 แฉก (Fuuma Shuriken Fan)',
      file: '/assets/vfx/ninja/ninja_skill_helmet_shuriken.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_skill_helmet_shuriken.efk',
      sourceFile: '/assets/vfx/ninja/ninja_skill_helmet_shuriken.efkproj',
      scale: 1.0,
      speed: 1.1,
      durationSec: 0.78,
      attachToCaster: false,
      color: '#c084fc',
      desc: 'วงเหวี่ยงพัด + ดาวกระจายยักษ์ 5 แฉกหมุนพุ่งกระจาย'
    },
    ninja_trinket: {
      id: 'ninja_trinket',
      hero: 'ninja',
      nameTh: '[F/AS] คาถาสลับร่างขอนไม้ระเบิด (Explosive Substitution)',
      file: '/assets/vfx/ninja/ninja_skill_trinket_substitution.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_skill_trinket_substitution.efk',
      sourceFile: '/assets/vfx/ninja/ninja_skill_trinket_substitution.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.05,
      attachToCaster: false,
      color: '#f43f5e',
      desc: 'ควันสลับร่าง + ยันต์ระเบิด 6 แผ่นหมุนรอบขอนไม้ + ระเบิดสีแดงฉาน'
    },
    ninja_mobility_shadowstep: {
      id: 'ninja_mobility_shadowstep',
      hero: 'ninja',
      nameTh: 'พริบตาเงา / ก้าวกลางอากาศ (Shadow Step)',
      file: '/assets/vfx/ninja/ninja_mobility_shadowstep.efkefc',
      fallbackFile: '/assets/vfx/ninja/ninja_mobility_shadowstep.efk',
      sourceFile: '/assets/vfx/ninja/ninja_mobility_shadowstep.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.46,
      attachToCaster: false,
      color: '#a855f7',
      desc: 'ยันต์เงา + หมอกม่วงดำ + สะเก็ดคุไนเมื่อพุ่ง/วาป/โดด 3 ชั้น'
    },

    // ========================================================================
    // 3. FIRE ARCHMAGE (จอมเวทย์อัคคี) 7-MOVE EFFEKSEER VFX SUITE
    // ========================================================================
    mage_basic_fireball: {
      id: 'mage_basic_fireball',
      hero: 'mage',
      nameTh: 'ร่ายลูกบอลเพลิง (Arcane Fireball Cast)',
      file: '/assets/vfx/mage/mage_basic_fireball.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_basic_fireball.efk',
      sourceFile: '/assets/vfx/mage/mage_basic_fireball.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.40,
      attachToCaster: false,
      color: '#f97316',
      desc: 'วงเวทอัคคีหน้าปลายคทา + ประกายเพลิงสุริยะ 3 จังหวะ'
    },
    mage_heavy_pillar: {
      id: 'mage_heavy_pillar',
      hero: 'mage',
      nameTh: 'เสาเพลิงมังกร (Dragon Pillar)',
      file: '/assets/vfx/mage/mage_heavy_pillar.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_heavy_pillar.efk',
      sourceFile: '/assets/vfx/mage/mage_heavy_pillar.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.88,
      attachToCaster: false,
      color: '#ef4444',
      desc: 'รอยแยกแมกมาใต้พื้น + เสาเพลิงเกลียวมังกร 3 มิติทะลวงการ์ด'
    },
    mage_weapon: {
      id: 'mage_weapon',
      hero: 'mage',
      nameTh: '[Q/SD] มหาอุกกาบาตล้างผลาญ (Meteor Apocalypse)',
      file: '/assets/vfx/mage/mage_skill_weapon_meteor.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_skill_weapon_meteor.efk',
      sourceFile: '/assets/vfx/mage/mage_skill_weapon_meteor.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.55,
      attachToCaster: false,
      color: '#ef4444',
      desc: 'วงเวทล็อกเป้า 9 เมตร + อุกกาบาตหลอมละลายพุ่งถล่ม + หลุมแมกมา & ควันภูเขาไฟ'
    },
    mage_armor: {
      id: 'mage_armor',
      hero: 'mage',
      nameTh: '[E/ASD] วงแหวนเพลิงกัลป์ (Supernova Ring)',
      file: '/assets/vfx/mage/mage_skill_armor_supernova.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_skill_armor_supernova.efk',
      sourceFile: '/assets/vfx/mage/mage_skill_armor_supernova.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 1.05,
      attachToCaster: false,
      color: '#f97316',
      desc: 'กำแพงเพลิงซูเปอร์โนวาขยาย 360 องศา + คลื่นไฟกระแทกศัตรู'
    },
    mage_helmet: {
      id: 'mage_helmet',
      hero: 'mage',
      nameTh: '[R/AD] ลูกแก้วสุริยะพิทักษ์ (Solar Orbit Spheres)',
      file: '/assets/vfx/mage/mage_skill_helmet_solar.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_skill_helmet_solar.efk',
      sourceFile: '/assets/vfx/mage/mage_skill_helmet_solar.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 6.0,
      attachToCaster: true,
      color: '#fb923c',
      desc: 'วงเวทสุริยะใต้เท้า + ลูกแก้วดวงอาทิตย์ 4 ดวงหมุนรอบตัวนาน 6 วินาที'
    },
    mage_trinket: {
      id: 'mage_trinket',
      hero: 'mage',
      nameTh: '[F/AS] พริบตาเพลิงมิติ (Flame Blink Warp)',
      file: '/assets/vfx/mage/mage_skill_trinket_blink.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_skill_trinket_blink.efk',
      sourceFile: '/assets/vfx/mage/mage_skill_trinket_blink.efkproj',
      scale: 1.0,
      speed: 1.1,
      durationSec: 0.78,
      attachToCaster: false,
      color: '#facc15',
      desc: 'ระเบิดปีกฟีนิกซ์เพลิง + แนวเส้นวาปไฟทั้งจุดออกตัวและจุดหมาย'
    },
    mage_mobility_hover: {
      id: 'mage_mobility_hover',
      hero: 'mage',
      nameTh: 'ลอยตัวเวทย์เพลิง / พริบตาเพลิงสั้น (Flame Hover)',
      file: '/assets/vfx/mage/mage_mobility_hover.efkefc',
      fallbackFile: '/assets/vfx/mage/mage_mobility_hover.efk',
      sourceFile: '/assets/vfx/mage/mage_mobility_hover.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.48,
      attachToCaster: false,
      color: '#fb923c',
      desc: 'วงเวทอัคคีใต้เท้า + ปีกฟีนิกซ์เพลิงและสะเก็ดไฟขณะโดด/แดชกลางอากาศ'
    },

    // ========================================================================
    // 4. DESPERADO COWBOY (คาวบอยปืนคู่) 7-MOVE EFFEKSEER VFX SUITE
    // ========================================================================
    cowboy_basic_shot: {
      id: 'cowboy_basic_shot',
      hero: 'cowboy',
      nameTh: 'ยิงปืนลูกโม่คู่ (Dual Revolver Quickdraw)',
      file: '/assets/vfx/cowboy/cowboy_basic_shot.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_basic_shot.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_basic_shot.efkproj',
      scale: 1.0,
      speed: 1.2,
      durationSec: 0.34,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'ประกายปากกระบอกปืนรูปดาว + เส้นกระสุนทองคำความเร็วสูงและควันดินปืน'
    },
    cowboy_heavy_deadeye: {
      id: 'cowboy_heavy_deadeye',
      hero: 'cowboy',
      nameTh: 'กระสุนแม็กนั่มเดดอาย (Deadeye Magnum)',
      file: '/assets/vfx/cowboy/cowboy_heavy_deadeye.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_heavy_deadeye.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_heavy_deadeye.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.68,
      attachToCaster: false,
      color: '#fde047',
      desc: 'เป้าเล็งเดดอาย + ลำแสงกระสุนแม็กนั่มทะลุเกราะและคลื่นโซนิกบูม 3 ชั้น'
    },
    cowboy_weapon: {
      id: 'cowboy_weapon',
      hero: 'cowboy',
      nameTh: '[Q/SD] พายุกระสุนเที่ยงตรง (High Noon Barrage)',
      file: '/assets/vfx/cowboy/cowboy_skill_weapon_highnoon.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_skill_weapon_highnoon.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_skill_weapon_highnoon.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.15,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'นาฬิกาแดดนายอำเภอ 8.4 เมตร + พายุกระสุน 360 องศา + ระเบิดกระสุนทองคำปิดท้าย'
    },
    cowboy_armor: {
      id: 'cowboy_armor',
      hero: 'cowboy',
      nameTh: '[E/ASD] ระเบิดไดนาไมต์ TNT (TNT Dynamite Toss)',
      file: '/assets/vfx/cowboy/cowboy_skill_armor_tnt.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_skill_armor_tnt.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_skill_armor_tnt.efkproj',
      scale: 1.0,
      speed: 1.0,
      durationSec: 1.25,
      attachToCaster: false,
      color: '#ef4444',
      desc: 'โยนมัดไดนาไมต์ TNT วิถีโค้ง + เป้าเตือนภัย + ระเบิดเพลิงและกลุ่มควันดินปืนยักษ์'
    },
    cowboy_helmet: {
      id: 'cowboy_helmet',
      hero: 'cowboy',
      nameTh: '[R/AD] กลิ้งหลบยิงแฟลช (Tactical Roll & Stun Shot)',
      file: '/assets/vfx/cowboy/cowboy_skill_helmet_rollshot.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_skill_helmet_rollshot.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_skill_helmet_rollshot.efkproj',
      scale: 1.0,
      speed: 1.1,
      durationSec: 0.68,
      attachToCaster: false,
      color: '#fde047',
      desc: 'วงแหวนหลบหลีก + แสงแฟลชสตั๊นเจิดจ้าและแนวกระสุนความเร็วสูง'
    },
    cowboy_trinket: {
      id: 'cowboy_trinket',
      hero: 'cowboy',
      nameTh: '[F/AS] บ่วงบาศเชือกคล้อง (Bounty Hunter Lasso)',
      file: '/assets/vfx/cowboy/cowboy_skill_trinket_lasso.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_skill_trinket_lasso.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_skill_trinket_lasso.efkproj',
      scale: 1.0,
      speed: 1.05,
      durationSec: 0.80,
      attachToCaster: false,
      color: '#d97706',
      desc: 'เหวี่ยงบ่วงเชือกคาวบอยระยะ 8 เมตร + รัดบ่วงคล้องแล้วกระชากศัตรูเข้าหาตัว'
    },
    cowboy_mobility_tumble: {
      id: 'cowboy_mobility_tumble',
      hero: 'cowboy',
      nameTh: 'กระโดด 2 ชั้น / กลิ้งหลบแดช (Tumble Dash)',
      file: '/assets/vfx/cowboy/cowboy_mobility_tumble.efkefc',
      fallbackFile: '/assets/vfx/cowboy/cowboy_mobility_tumble.efk',
      sourceFile: '/assets/vfx/cowboy/cowboy_mobility_tumble.efkproj',
      scale: 1.0,
      speed: 1.15,
      durationSec: 0.46,
      attachToCaster: false,
      color: '#fbbf24',
      desc: 'ตราดาวนายอำเภอสีทอง + ฝุ่นแคนยอนและประกายเดือยรองเท้า'
    }
  };

  const KNIGHT_TEX_NAMES = [
    'slash_crescent',
    'holy_rune_circle',
    'hex_aegis_shield',
    'lion_crest_roar',
    'shockwave_ring',
    'starburst_flare',
    'energy_ribbon',
    'soft_glow',
    'holy_spark',
    'heal_cross'
  ];

  const NINJA_TEX_NAMES = [
    'kunai_slash',
    'cross_fang',
    'shinobi_seal',
    'shadow_smoke',
    'shuriken_glint',
    'paper_talisman',
    'shadow_vortex',
    'shadow_ring',
    'crimson_flare',
    'kunai_spark'
  ];

  const MAGE_TEX_NAMES = [
    'pyro_rune_circle',
    'flame_lick',
    'flame_vortex',
    'fire_shockwave',
    'magma_crater',
    'meteor_core',
    'solar_orb',
    'phoenix_wings',
    'volcanic_smoke',
    'fire_ember'
  ];

  const COWBOY_TEX_NAMES = [
    'sheriff_crest',
    'deadeye_reticle',
    'muzzle_star',
    'bullet_tracer',
    'sonic_ring',
    'tnt_bundle',
    'tnt_blast',
    'lasso_loop',
    'gun_smoke',
    'brass_spark'
  ];

  function easeOutCubic(t) {
    const u = 1 - Math.max(0, Math.min(1, t));
    return 1 - u * u * u;
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Column-major LookAt matrix for WebGL / Effekseer
  function makeLookAt(eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    const out = new Float32Array(16);
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  class KnightEffekseerVFX {
    constructor() {
      this.ctx = null;
      this.gl = null;
      this.overlayCanvas = null;
      this.effects = new Map();
      this.activeHandles = [];
      this.fallbackInstances = [];
      this.textures = {};
      this.tintedCache = new Map();

      this.ready = false;
      this.runtimeLoaded = false;
      this.mode = 'hd2d'; // 'webgl' when Effekseer .efkefc runtime is active, else 'hd2d'
      this.loadErrors = [];
      this.loadedCount = 0;
      this.totalCount = Object.keys(KNIGHT_VFX_CATALOG).length;
      this.lastFrameTime = performance.now();

      this.preloadFallbackTextures();
    }

    getCatalog() {
      return KNIGHT_VFX_CATALOG;
    }

    isEffectReady(effectId) {
      return !!(this.ctx && this.effects.has(effectId));
    }

    preloadFallbackTextures() {
      if (typeof Image === 'undefined') return;
      for (const name of KNIGHT_TEX_NAMES) {
        const img = new Image();
        img.src = `/assets/vfx/knight/textures/${name}.png`;
        this.textures[name] = img;
      }
      for (const name of NINJA_TEX_NAMES) {
        const img = new Image();
        img.src = `/assets/vfx/ninja/textures/${name}.png`;
        this.textures[name] = img;
      }
      for (const name of MAGE_TEX_NAMES) {
        const img = new Image();
        img.src = `/assets/vfx/mage/textures/${name}.png`;
        this.textures[name] = img;
      }
      for (const name of COWBOY_TEX_NAMES) {
        const img = new Image();
        img.src = `/assets/vfx/cowboy/textures/${name}.png`;
        this.textures[name] = img;
      }
    }

    getTintedTexture(name, hexColor, preserveCore = true) {
      const img = this.textures[name];
      if (!img || !img.complete || img.naturalWidth === 0) return null;
      if (!hexColor || hexColor === '#ffffff') return img;

      const key = `${name}_${hexColor}_${preserveCore ? '1' : '0'}`;
      if (this.tintedCache.has(key)) return this.tintedCache.get(key);

      const size = 256;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const c = off.getContext('2d');
      c.drawImage(img, 0, 0, size, size);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = hexColor;
      c.fillRect(0, 0, size, size);
      if (preserveCore) {
        // Preserve luminous white-hot core highlight by adding 40% original texture back
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.42;
        c.drawImage(img, 0, 0, size, size);
      }

      this.tintedCache.set(key, off);
      return off;
    }

    /**
     * Attach to the live game's transparent WebGL overlay canvas (#effekseerCanvas).
     * Automatically falls back to HD2D textured Canvas rendering if effekseer.wasm
     * or .efkefc binaries have not been built yet.
     */
    attachGameCanvas(canvas, options = {}) {
      if (!canvas) return Promise.resolve(this);
      this.overlayCanvas = canvas;
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: true })
              || canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
      if (!gl) {
        this.mode = 'hd2d';
        return Promise.resolve(this);
      }
      this.gl = gl;

      if (typeof root.effekseer === 'undefined') {
        this.mode = 'hd2d';
        return Promise.resolve(this);
      }

      return this.init(gl, options).catch(() => {
        this.mode = 'hd2d';
        return this;
      });
    }

    /**
     * Initialize Effekseer WASM runtime and attach to an existing WebGL context
     * (from raw WebGL, Three.js renderer.getContext(), or Babylon.js engine._gl).
     */
    init(gl, options = {}) {
      const wasmPath = options.wasmPath || '/vendor/effekseer/effekseer.wasm';
      const onStatus = options.onStatus || (() => {});
      this.gl = gl;

      return new Promise((resolve, reject) => {
        if (typeof root.effekseer === 'undefined') {
          const err = new Error('effekseer.min.js not loaded (/vendor/effekseer/effekseer.min.js)');
          this.loadErrors.push(err.message);
          reject(err);
          return;
        }

        const onRuntimeReady = () => {
          this.runtimeLoaded = true;
          this.ctx = root.effekseer.createContext();
          this.ctx.init(gl, {
            instanceMaxCount: options.instanceMaxCount || 4000,
            squareMaxCount: options.squareMaxCount || 20000
          });
          if (typeof this.ctx.setRestorationOfStatesFlag === 'function') {
            this.ctx.setRestorationOfStatesFlag(true);
          }

          this.preloadAll(onStatus).then(() => {
            this.ready = this.loadedCount > 0;
            this.mode = this.ready ? 'webgl' : 'hd2d';
            resolve(this);
          });
        };

        const onRuntimeError = (err) => {
          const msg = `Failed to initialize Effekseer WASM (${wasmPath}): ${err || 'unknown error'}`;
          this.loadErrors.push(msg);
          this.mode = 'hd2d';
          reject(new Error(msg));
        };

        root.effekseer.initRuntime(wasmPath, onRuntimeReady, onRuntimeError);
      });
    }

    preloadAll(onStatus = () => {}) {
      const entries = Object.values(KNIGHT_VFX_CATALOG);
      this.loadedCount = 0;
      this.loadErrors = [];

      const promises = entries.map((item) => new Promise((resolve) => {
        const tryLoad = (url, isFallback) => {
          const eff = this.ctx.loadEffect(
            url,
            item.scale || 1.0,
            () => {
              this.effects.set(item.id, eff);
              this.loadedCount++;
              onStatus({ loaded: this.loadedCount, total: entries.length, id: item.id, ok: true });
              resolve(true);
            },
            (msg) => {
              if (!isFallback && item.fallbackFile) {
                tryLoad(item.fallbackFile, true);
              } else {
                this.loadErrors.push(`${item.id}: ${msg || '404 not compiled yet'} (${url})`);
                onStatus({ loaded: this.loadedCount, total: entries.length, id: item.id, ok: false });
                resolve(false);
              }
            }
          );
        };
        tryLoad(item.file, false);
      }));

      return Promise.all(promises);
    }

    /**
     * Determine whether a server FX event belongs to Iron Knight and should be
     * rendered by this dedicated Knight VFX suite instead of legacy PixelFX.
     */
    resolveServerFxMapping(fx) {
      if (!fx) return null;

      // --- IRON KNIGHT ---
      if (fx.type === 'skill_cast' && ['knight_weapon', 'knight_armor', 'knight_helmet', 'knight_trinket'].includes(fx.skillId)) {
        return {
          effectId: fx.skillId,
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'slash' && (fx.heroId === 'knight' || fx.weaponType === 'broadsword')) {
        return {
          effectId: 'basic_slash',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.isFinisher ? 1.28 : 1.0,
          comboStep: fx.comboStep || 1,
          isFinisher: !!fx.isFinisher
        };
      }

      if (fx.type === 'heavy_impact' && fx.heroId === 'knight') {
        return {
          effectId: 'heavy_shield_bash',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if ((fx.type === 'block' || fx.type === 'parry') && fx.heroId === 'knight') {
        return {
          effectId: 'guard_parry',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.type === 'parry' ? 1.22 : 0.95,
          isParry: fx.type === 'parry'
        };
      }

      // --- SHADOW NINJA ---
      if (fx.type === 'blade_storm' && fx.fromSkill === 'ninja_weapon') {
        return {
          effectId: 'ninja_weapon',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'skill_cast' && ['ninja_armor', 'ninja_helmet', 'ninja_trinket'].includes(fx.skillId)) {
        return {
          effectId: fx.skillId,
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'slash' && (fx.heroId === 'ninja' || fx.weaponType === 'dual_kunai')) {
        return {
          effectId: 'ninja_basic_slash',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.isFinisher ? 1.25 : 1.0,
          comboStep: fx.comboStep || 1,
          isFinisher: !!fx.isFinisher
        };
      }

      if (fx.type === 'teleport' && fx.heroId === 'ninja') {
        return {
          effectId: fx.isArrival ? 'ninja_heavy_backstab' : 'ninja_mobility_shadowstep',
          x: fx.x || 0,
          y: fx.y || 0,
          z: fx.z || 0,
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'heavy_impact' && fx.heroId === 'ninja') {
        return {
          effectId: 'ninja_heavy_backstab',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if ((fx.type === 'air_jump' || fx.type === 'dash') && fx.heroId === 'ninja') {
        return {
          effectId: 'ninja_mobility_shadowstep',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : (fx.y || 0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.type === 'air_jump' ? 0.9 : 0.8
        };
      }

      // --- FIRE ARCHMAGE ---
      if (fx.type === 'meteor_strike' && fx.fromSkill === 'mage_weapon') {
        return {
          effectId: 'mage_weapon',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : (fx.y || 0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'skill_cast' && ['mage_armor', 'mage_helmet'].includes(fx.skillId)) {
        return {
          effectId: fx.skillId,
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'shockwave' && fx.fromSkill === 'mage_trinket') {
        return {
          effectId: 'mage_trinket',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          isArrival: !!fx.isArrival,
          scale: 1.0
        };
      }

      if (fx.type === 'muzzle' && fx.heroId === 'mage') {
        return {
          effectId: 'mage_basic_fireball',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          comboStep: fx.comboStep || 1,
          isFinisher: !!fx.isFinisher,
          scale: fx.isFinisher ? 1.25 : 1.0
        };
      }

      if (fx.type === 'heavy_impact' && fx.heroId === 'mage') {
        return {
          effectId: 'mage_heavy_pillar',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.9),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if ((fx.type === 'air_jump' || fx.type === 'dash') && fx.heroId === 'mage') {
        return {
          effectId: 'mage_mobility_hover',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : (fx.y || 0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.type === 'air_jump' ? 0.95 : 0.85
        };
      }

      // --- DESPERADO COWBOY ---
      if (fx.type === 'skill_cast' && ['cowboy_weapon', 'cowboy_helmet'].includes(fx.skillId)) {
        return {
          effectId: fx.skillId,
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'explosion' && fx.fromSkill === 'cowboy_armor') {
        return {
          effectId: 'cowboy_armor',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 0.5),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'lasso' && fx.fromSkill === 'cowboy_trinket') {
        return {
          effectId: 'cowboy_trinket',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if (fx.type === 'muzzle' && fx.heroId === 'cowboy') {
        return {
          effectId: 'cowboy_basic_shot',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          comboStep: fx.comboStep || 1,
          isFinisher: !!fx.isFinisher,
          scale: fx.isFinisher ? 1.25 : 1.0
        };
      }

      if (fx.type === 'heavy_cast' && fx.heroId === 'cowboy') {
        return {
          effectId: 'cowboy_heavy_deadeye',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : Math.max(0, (fx.y || 0) - 1.0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: 1.0
        };
      }

      if ((fx.type === 'air_jump' || fx.type === 'dash') && fx.heroId === 'cowboy') {
        return {
          effectId: 'cowboy_mobility_tumble',
          x: fx.originX !== undefined ? fx.originX : (fx.x || 0),
          y: fx.originY !== undefined ? fx.originY : (fx.y || 0),
          z: fx.originZ !== undefined ? fx.originZ : (fx.z || 0),
          facing: typeof fx.facing === 'number' ? fx.facing : 0,
          playerId: fx.playerId || null,
          scale: fx.type === 'air_jump' ? 0.95 : 0.85
        };
      }

      return null;
    }

    /**
     * Returns true if this event is exclusively handled by the dedicated
     * Knight, Ninja, Fire Archmage, or Desperado Cowboy VFX suite so legacy PixelFX doesn't double-render.
     */
    shouldSuppressLegacyVfx(fx) {
      if (!fx) return false;
      if (this.resolveServerFxMapping(fx)) return true;
      if (fx.type === 'heavy_cast' && (fx.heroId === 'knight' || fx.heroId === 'ninja' || fx.heroId === 'mage')) return true;
      if (fx.type === 'shockwave' && (fx.fromSkill === 'knight_armor' || fx.fromSkill === 'knight_helmet' || fx.fromSkill === 'mage_armor')) {
        return true;
      }
      if (fx.type === 'skill_cast' && (fx.skillId === 'ninja_weapon' || fx.skillId === 'mage_weapon' || fx.skillId === 'mage_trinket' || fx.skillId === 'cowboy_armor' || fx.skillId === 'cowboy_trinket')) return true;
      if (fx.type === 'smoke' && fx.fromSkill === 'ninja_armor') return true;
      if (fx.type === 'explosion' && fx.fromSkill === 'ninja_trinket') return true;
      return false;
    }

    /**
     * Play a Knight effect at 3D world position (x, y, z) rotated by yaw (radians).
     * Automatically uses EffekseerForWebGL (.efkefc) if compiled, otherwise spawns
     * the matching HD textured Knight VFX instance for Canvas 2D.
     */
    play(effectId, opts = {}) {
      const meta = KNIGHT_VFX_CATALOG[effectId];
      if (!meta) return null;

      const x = opts.x || 0;
      const y = opts.y || 0;
      const z = opts.z || 0;
      const scale = opts.scale !== undefined ? opts.scale : 1.0;
      const speed = opts.speed !== undefined ? opts.speed : (meta.speed || 1.0);
      const facing = typeof opts.facing === 'number' ? opts.facing : 0;
      const yaw = opts.yaw !== undefined ? opts.yaw : (Math.PI * 0.5 - facing);

      // 1. Primary path: Real 3D EffekseerForWebGL
      if (this.ctx && this.effects.has(effectId)) {
        const eff = this.effects.get(effectId);
        const handle = this.ctx.play(eff, x, y, z);
        if (handle) {
          handle.setLocation(x, y, z);
          handle.setRotation(opts.pitch || 0, yaw, opts.roll || 0);
          handle.setScale(scale, scale, scale);
          if (typeof handle.setSpeed === 'function') {
            handle.setSpeed(speed);
          }
          this.activeHandles.push({
            id: effectId,
            handle,
            meta,
            playerId: opts.playerId || null,
            attachToCaster: meta.attachToCaster && !!opts.playerId,
            scale
          });
          return handle;
        }
      }

      // 2. Fallback path: HD Textured 2.5D Knight VFX using our 10 512x512 PNGs
      this.spawnFallbackEffect(effectId, meta, {
        ...opts,
        x, y, z, scale, facing
      });
      return true;
    }

    /**
     * Play via EffekseerForWebGL (.efkefc) ONLY — returns true if real 3D
     * Effekseer runtime played the effect, or false so ThreeRenderer can run
     * its native 3D HDR-Bloom Three.js mesh fallback instead of Canvas 2D!
     */
    playWebGLOnly(effectId, opts = {}) {
      const meta = KNIGHT_VFX_CATALOG[effectId];
      if (!meta || !this.ctx || !this.effects.has(effectId)) return false;

      const x = opts.x || 0;
      const y = opts.y || 0;
      const z = opts.z || 0;
      const scale = opts.scale !== undefined ? opts.scale : 1.0;
      const speed = opts.speed !== undefined ? opts.speed : (meta.speed || 1.0);
      const facing = typeof opts.facing === 'number' ? opts.facing : 0;
      const yaw = opts.yaw !== undefined ? opts.yaw : (Math.PI * 0.5 - facing);

      const eff = this.effects.get(effectId);
      const handle = this.ctx.play(eff, x, y, z);
      if (!handle) return false;

      handle.setLocation(x, y, z);
      handle.setRotation(opts.pitch || 0, yaw, opts.roll || 0);
      handle.setScale(scale, scale, scale);
      if (typeof handle.setSpeed === 'function') {
        handle.setSpeed(speed);
      }

      this.activeHandles.push({
        id: effectId,
        handle,
        meta,
        playerId: opts.playerId || null,
        attachToCaster: meta.attachToCaster && !!opts.playerId,
        scale
      });
      return true;
    }

    /**
     * Render WebGL 3D Effekseer overlay synchronized directly to a Three.js PerspectiveCamera.
     */
    renderForThreeCamera(dtSec, camera, gameState) {
      this.syncAttachedHandles(gameState);

      if (!this.overlayCanvas || !this.gl) return;
      if (!this.ready || this.activeHandles.length === 0) {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.floor(window.innerWidth * dpr);
      const ch = Math.floor(window.innerHeight * dpr);
      if (this.overlayCanvas.width !== cw || this.overlayCanvas.height !== ch) {
        this.overlayCanvas.width = cw;
        this.overlayCanvas.height = ch;
      }

      this.gl.viewport(0, 0, cw, ch);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      camera.updateMatrixWorld();
      this.updateAndDraw(dtSec, camera.projectionMatrix.elements, camera.matrixWorldInverse.elements);
    }

    handleServerFx(fx) {
      const mapped = this.resolveServerFxMapping(fx);
      if (mapped) {
        this.play(mapped.effectId, mapped);
        return true;
      }
      return this.shouldSuppressLegacyVfx(fx);
    }

    stopAll() {
      if (this.ctx) {
        this.ctx.stopAll();
      }
      this.activeHandles = [];
      this.fallbackInstances = [];
    }

    // ------------------------------------------------------------------------
    // EXACT 45-DEGREE ISOMETRIC CAMERA MATRIX SYNC FOR PixelRenderer25D
    // Maps 3D world (wx, wy, wz) onto the EXACT same pixel coordinates as
    // PixelRenderer25D.project(wx, wy, wz), including pan, tilt & screen shake!
    // ------------------------------------------------------------------------
    buildIsometricMatrices(renderer) {
      const w = Math.max(1, renderer.width);
      const h = Math.max(1, renderer.height);
      const fovDist = 52.0;
      const pitch = Math.atan(renderer.isoTilt / renderer.heightScale);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const D = (fovDist / 0.65) * cosP;

      const eye = [
        renderer.camX + D * cosP * COS45,
        renderer.camY + D * sinP,
        renderer.camZ + D * cosP * COS45
      ];
      const target = [renderer.camX, renderer.camY, renderer.camZ];
      const view = makeLookAt(eye, target, [0, 1, 0]);

      const near = 4.0;
      const far = 260.0;
      const proj = new Float32Array(16);
      proj[0] = (2.0 * renderer.camZoom * D) / w;
      proj[5] = (2.0 * renderer.camZoom * renderer.heightScale * D) / (h * cosP);
      proj[8] = -(2.0 * (renderer.shakeOffsetX || 0)) / w;
      proj[9] = (2.0 * (renderer.shakeOffsetY || 0)) / h;
      proj[10] = -(far + near) / (far - near);
      proj[11] = -1.0;
      proj[14] = -(2.0 * far * near) / (far - near);

      return { proj, view };
    }

    syncAttachedHandles(gameState) {
      if (!gameState || !gameState.players) return;
      const playerMap = new Map();
      for (const pl of gameState.players) {
        playerMap.set(pl.id, pl);
      }

      for (const item of this.activeHandles) {
        if (!item.attachToCaster || !item.playerId) continue;
        const pl = playerMap.get(item.playerId);
        if (pl && pl.state !== 'dead' && item.handle) {
          item.handle.setLocation(pl.x, pl.y, pl.z);
          if (item.id === 'knight_trinket' && typeof pl.facing === 'number') {
            item.handle.setRotation(0, Math.PI * 0.5 - pl.facing, 0);
          }
        }
      }

      for (const inst of this.fallbackInstances) {
        if (!inst.attachToCaster || !inst.playerId) continue;
        const pl = playerMap.get(inst.playerId);
        if (pl && pl.state !== 'dead') {
          inst.x = pl.x;
          inst.y = pl.y;
          inst.z = pl.z;
          if (inst.id === 'knight_trinket' && typeof pl.facing === 'number') {
            inst.facing = pl.facing;
          }
        }
      }
    }

    /**
     * Render WebGL 3D Effekseer overlay synchronized with PixelRenderer25D.
     */
    renderForIsometricRenderer(renderer, gameState) {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) * 0.001));
      this.lastFrameTime = now;

      this.syncAttachedHandles(gameState);

      if (!this.overlayCanvas || !this.gl) return;
      if (!this.ready || this.activeHandles.length === 0) {
        // Keep transparent overlay clear when idle
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.floor(renderer.width * dpr);
      const ch = Math.floor(renderer.height * dpr);
      if (this.overlayCanvas.width !== cw || this.overlayCanvas.height !== ch) {
        this.overlayCanvas.width = cw;
        this.overlayCanvas.height = ch;
      }

      this.gl.viewport(0, 0, cw, ch);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      const { proj, view } = this.buildIsometricMatrices(renderer);
      this.updateAndDraw(dt, proj, view);
    }

    /**
     * Update & render Effekseer frame with explicit projection & view matrices
     * (used by knight_vfx_preview.html, Three.js, Babylon.js, or isometric overlay).
     */
    updateAndDraw(dtSec, projectionMatrix, viewMatrix) {
      if (!this.ctx) return;
      const frames = Math.min(3.0, Math.max(0.0, dtSec * 60.0));
      this.ctx.update(frames);
      this.ctx.setProjectionMatrix(projectionMatrix);
      this.ctx.setCameraMatrix(viewMatrix);
      this.ctx.draw();

      for (let i = this.activeHandles.length - 1; i >= 0; i--) {
        const h = this.activeHandles[i].handle;
        if (!h || (typeof h.exists === 'function' && !h.exists())) {
          this.activeHandles.splice(i, 1);
        }
      }
    }

    // ========================================================================
    // HD TEXTURED CANVAS 2D KNIGHT & NINJA VFX FALLBACK (512x512 PNGs!)
    // ========================================================================
    spawnFallbackEffect(effectId, meta, opts) {
      const now = performance.now();
      const sparks = [];
      const isNinja = meta && meta.hero === 'ninja';
      const isMage = meta && meta.hero === 'mage';
      const isCowboy = meta && meta.hero === 'cowboy';
      const sparkCount = (effectId === 'basic_slash' || effectId === 'ninja_basic_slash' || effectId === 'mage_basic_fireball' || effectId === 'cowboy_basic_shot')
        ? 14
        : ((effectId === 'guard_parry' || effectId === 'ninja_mobility_shadowstep' || effectId === 'mage_mobility_hover' || effectId === 'cowboy_mobility_tumble') ? 16 : 24);
      const dirX = Math.cos(opts.facing || 0);
      const dirZ = Math.sin(opts.facing || 0);

      for (let i = 0; i < sparkCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 5.2;
        const forwardBias = (effectId === 'heavy_shield_bash' || effectId === 'basic_slash' || effectId === 'ninja_basic_slash' || effectId === 'ninja_helmet' || effectId === 'mage_basic_fireball' || effectId === 'cowboy_basic_shot' || effectId === 'cowboy_heavy_deadeye' || effectId === 'cowboy_helmet') ? 4.5 : 0;
        const upBias = (effectId === 'knight_helmet' || effectId === 'knight_armor' || effectId === 'ninja_weapon' || effectId === 'ninja_trinket' || effectId === 'mage_weapon' || effectId === 'mage_heavy_pillar' || effectId === 'cowboy_armor' || effectId === 'cowboy_weapon')
          ? (2.4 + Math.random() * 4.5)
          : (1.5 + Math.random() * 4.0);
        sparks.push({
          ox: (Math.random() - 0.5) * 0.6,
          oy: 0.25 + Math.random() * 1.1,
          oz: (Math.random() - 0.5) * 0.6,
          vx: Math.cos(ang) * spd + dirX * forwardBias,
          vy: upBias,
          vz: Math.sin(ang) * spd + dirZ * forwardBias,
          size: 0.45 + Math.random() * 0.55,
          delay: effectId === 'ninja_trinket'
            ? (0.42 + Math.random() * 0.14)
            : (effectId === 'mage_weapon' ? (0.27 + Math.random() * 0.14) : (effectId === 'cowboy_armor' ? (0.21 + Math.random() * 0.12) : (Math.random() * 0.16))),
          isHeal: effectId === 'knight_helmet' && i < 12,
          isNinja,
          isMage,
          isCowboy
        });
      }

      if (this.fallbackInstances.length >= 28) {
        this.fallbackInstances.shift();
      }

      this.fallbackInstances.push({
        id: effectId,
        hero: isNinja ? 'ninja' : (isMage ? 'mage' : (isCowboy ? 'cowboy' : 'knight')),
        born: now,
        durationMs: (meta.durationSec || 0.9) * 1000,
        x: opts.x,
        y: opts.y,
        z: opts.z,
        facing: opts.facing || 0,
        scale: opts.scale || 1.0,
        comboStep: opts.comboStep || 1,
        isFinisher: !!opts.isFinisher,
        isParry: !!opts.isParry,
        isArrival: !!opts.isArrival,
        playerId: opts.playerId || null,
        attachToCaster: meta.attachToCaster && !!opts.playerId,
        sparks
      });
    }

    drawSpriteTex(ctx, name, tintHex, x, y, w, h, rotRad, alpha, isoFlatten = 1.0, blendMode = 'lighter') {
      if (alpha <= 0.01) return;
      const tex = this.getTintedTexture(name, tintHex, blendMode !== 'source-over');
      if (!tex) return;
      ctx.save();
      ctx.globalCompositeOperation = blendMode;
      ctx.globalAlpha = clamp01(alpha);
      ctx.translate(x, y);
      if (isoFlatten !== 1.0) ctx.scale(1, isoFlatten);
      if (rotRad) ctx.rotate(rotRad);
      ctx.drawImage(tex, -w * 0.5, -h * 0.5, w, h);
      ctx.restore();
    }

    /**
     * Draw ground-layer HD Knight & Ninja VFX (runes, lion crest, shinobi seals, floor shockwaves)
     * BEFORE entities so characters stand ON TOP of their circles!
     */
    drawCanvasGround(ctx, renderer, gameState) {
      if (this.fallbackInstances.length === 0) return;
      this.syncAttachedHandles(gameState);

      const now = performance.now();
      for (let i = this.fallbackInstances.length - 1; i >= 0; i--) {
        const fx = this.fallbackInstances[i];
        const age = now - fx.born;
        if (age >= fx.durationMs) {
          this.fallbackInstances.splice(i, 1);
          continue;
        }
        const t = age / fx.durationMs;
        const ease = easeOutCubic(t);
        const fade = t < 0.1 ? (t / 0.1) : Math.pow(1 - t, 1.3);
        const gp = renderer.project(fx.x, fx.y + 0.05, fx.z);
        const unit = renderer.camZoom * gp.scale * fx.scale;

        if (fx.id === 'knight_weapon') {
          const r = unit * (1.2 + ease * 3.8);
          this.drawSpriteTex(ctx, 'holy_rune_circle', '#fbbf24', gp.x, gp.y, r * 2, r * 2, t * 2.2, fade * 0.92, renderer.isoTilt);
        } else if (fx.id === 'knight_armor') {
          const rRune = unit * (1.5 + ease * 4.5);
          this.drawSpriteTex(ctx, 'holy_rune_circle', '#38bdf8', gp.x, gp.y, rRune * 2, rRune * 2, t * 2.4, fade * 0.95, renderer.isoTilt);
          if (t < 0.45) {
            const wt = t / 0.45;
            const rWave = unit * (0.9 + easeOutCubic(wt) * 4.6);
            this.drawSpriteTex(ctx, 'shockwave_ring', '#60a5fa', gp.x, gp.y, rWave * 2, rWave * 2, 0, (1 - wt) * 0.95, renderer.isoTilt);
          }
        } else if (fx.id === 'knight_helmet') {
          const rCrest = unit * (1.2 + ease * 5.2);
          this.drawSpriteTex(ctx, 'lion_crest_roar', '#f59e0b', gp.x, gp.y, rCrest * 2, rCrest * 2, t * 1.4, fade * 0.95, renderer.isoTilt);
          for (let w = 0; w < 3; w++) {
            const wt = (t - w * 0.14) / 0.55;
            if (wt > 0 && wt < 1) {
              const rWave = unit * (0.8 + easeOutCubic(wt) * 5.0);
              this.drawSpriteTex(ctx, 'shockwave_ring', '#fde047', gp.x, gp.y, rWave * 2, rWave * 2, 0, (1 - wt) * 0.85, renderer.isoTilt);
            }
          }
        } else if (fx.id === 'heavy_shield_bash') {
          const dirX = Math.cos(fx.facing), dirZ = Math.sin(fx.facing);
          const bp = renderer.project(fx.x + dirX * 1.35, fx.y + 0.05, fx.z + dirZ * 1.35);
          const r = unit * (0.8 + ease * 3.1);
          this.drawSpriteTex(ctx, 'shockwave_ring', '#fbbf24', bp.x, bp.y, r * 2, r * 2, 0, fade * 0.88, renderer.isoTilt);
        } else if (fx.id === 'ninja_heavy_backstab') {
          const rSeal = unit * (1.1 + ease * 2.5);
          this.drawSpriteTex(ctx, 'shinobi_seal', '#1b0828', gp.x, gp.y, rSeal * 2.1, rSeal * 2.1, -t * 2.5, fade * 0.72, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'shinobi_seal', '#f43f5e', gp.x, gp.y, rSeal * 2, rSeal * 2, -t * 2.5, fade * 0.92, renderer.isoTilt, 'lighter');
          const rRing = unit * (0.7 + ease * 3.0);
          this.drawSpriteTex(ctx, 'shadow_ring', '#e11d48', gp.x, gp.y, rRing * 2, rRing * 2, t * 2.0, fade * 0.85, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'ninja_weapon') {
          const rSeal = unit * (1.8 + ease * 3.6);
          this.drawSpriteTex(ctx, 'shinobi_seal', '#16092c', gp.x, gp.y, rSeal * 2.15, rSeal * 2.15, t * 3.2, fade * 0.78, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'shinobi_seal', '#a855f7', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, t * 3.2, fade * 0.96, renderer.isoTilt, 'lighter');
          const rVort = unit * (1.4 + ease * 3.4);
          this.drawSpriteTex(ctx, 'shadow_vortex', '#38bdf8', gp.x, gp.y, rVort * 2.0, rVort * 2.0, -t * 7.0, fade * 0.82, renderer.isoTilt, 'lighter');
          if (t < 0.55) {
            const wt = t / 0.55;
            const rWave = unit * (1.0 + easeOutCubic(wt) * 4.4);
            this.drawSpriteTex(ctx, 'shadow_ring', '#c084fc', gp.x, gp.y, rWave * 2, rWave * 2, t * 4, (1 - wt) * 0.9, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'ninja_armor') {
          const rSeal = unit * (1.6 + ease * 3.8);
          this.drawSpriteTex(ctx, 'shinobi_seal', '#120724', gp.x, gp.y, rSeal * 2.15, rSeal * 2.15, -t * 1.8, fade * 0.78, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'shinobi_seal', '#8b5cf6', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, -t * 1.8, fade * 0.88, renderer.isoTilt, 'lighter');
          if (t < 0.45) {
            const wt = t / 0.45;
            const rWave = unit * (1.0 + easeOutCubic(wt) * 4.8);
            this.drawSpriteTex(ctx, 'shadow_ring', '#a855f7', gp.x, gp.y, rWave * 2, rWave * 2, 0, (1 - wt) * 0.95, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'ninja_helmet') {
          if (t < 0.5) {
            const wt = t / 0.5;
            const rSeal = unit * (1.1 + easeOutCubic(wt) * 2.3);
            this.drawSpriteTex(ctx, 'shinobi_seal', '#1b0b34', gp.x, gp.y, rSeal * 2.1, rSeal * 2.1, wt * 2.4, (1 - wt) * 0.65, renderer.isoTilt, 'source-over');
            this.drawSpriteTex(ctx, 'shinobi_seal', '#c084fc', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, wt * 2.4, (1 - wt) * 0.85, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'ninja_trinket') {
          const detonateT = 0.43;
          const rSeal = unit * (1.5 + (t < detonateT ? (t / detonateT) * 2.1 : 2.3 + (t - detonateT) * 2.0));
          const pulse = t < detonateT ? (0.72 + 0.28 * Math.sin(t * 42)) : fade;
          this.drawSpriteTex(ctx, 'shinobi_seal', '#240714', gp.x, gp.y, rSeal * 2.15, rSeal * 2.15, t * 4.5, pulse * 0.78, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'shinobi_seal', '#f43f5e', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, t * 4.5, pulse * 0.95, renderer.isoTilt, 'lighter');
          if (t >= detonateT) {
            const bt = (t - detonateT) / (1 - detonateT);
            const rBlast = unit * (1.1 + easeOutCubic(bt) * 4.6);
            this.drawSpriteTex(ctx, 'shadow_ring', '#fb7185', gp.x, gp.y, rBlast * 2, rBlast * 2, bt * 3.0, (1 - bt) * 0.96, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'ninja_mobility_shadowstep') {
          const rSeal = unit * (0.9 + ease * 1.9);
          this.drawSpriteTex(ctx, 'shinobi_seal', '#16092c', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, t * 3.0, fade * 0.65, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'shadow_ring', '#a855f7', gp.x, gp.y, rSeal * 2.2, rSeal * 2.2, -t * 3.5, fade * 0.86, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'mage_heavy_pillar') {
          const dirX = Math.cos(fx.facing), dirZ = Math.sin(fx.facing);
          const pp = renderer.project(fx.x + dirX * 2.35, fx.y + 0.05, fx.z + dirZ * 2.35);
          const rC = unit * (1.2 + ease * 3.1);
          this.drawSpriteTex(ctx, 'magma_crater', '#260604', pp.x, pp.y, rC * 2.1, rC * 2.1, 0, fade * 0.86, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'magma_crater', '#f97316', pp.x, pp.y, rC * 2.0, rC * 2.0, 0, fade * 0.94, renderer.isoTilt, 'lighter');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#ef4444', pp.x, pp.y, rC * 2.1, rC * 2.1, t * 3.8, fade * 0.90, renderer.isoTilt, 'lighter');
          if (t < 0.55) {
            const wt = t / 0.55;
            const rW = unit * (0.9 + easeOutCubic(wt) * 3.6);
            this.drawSpriteTex(ctx, 'fire_shockwave', '#fde047', pp.x, pp.y, rW * 2, rW * 2, wt * 2, (1 - wt) * 0.95, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'mage_weapon') {
          const impactT = 0.28 / 1.55;
          const rSeal = unit * (1.8 + ease * 4.8);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#260504', gp.x, gp.y, rSeal * 2.1, rSeal * 2.1, t * 2.8, fade * 0.85, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#ef4444', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, t * 2.8, fade * 0.95, renderer.isoTilt, 'lighter');
          if (t >= impactT) {
            const it = (t - impactT) / (1 - impactT);
            const rC = unit * (1.6 + easeOutCubic(it) * 4.6);
            const iFade = Math.pow(1 - it, 1.3);
            this.drawSpriteTex(ctx, 'magma_crater', '#1c0504', gp.x, gp.y, rC * 2.1, rC * 2.1, 0, iFade * 0.92, renderer.isoTilt, 'source-over');
            this.drawSpriteTex(ctx, 'magma_crater', '#f97316', gp.x, gp.y, rC * 2.0, rC * 2.0, 0, iFade * 0.96, renderer.isoTilt, 'lighter');
            if (it < 0.55) {
              const wt = it / 0.55;
              const rW = unit * (1.2 + easeOutCubic(wt) * 5.6);
              this.drawSpriteTex(ctx, 'fire_shockwave', '#fde047', gp.x, gp.y, rW * 2, rW * 2, wt * 2.5, (1 - wt) * 0.98, renderer.isoTilt, 'lighter');
            }
          }
        } else if (fx.id === 'mage_armor') {
          const rSeal = unit * (1.5 + ease * 4.8);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#260504', gp.x, gp.y, rSeal * 2.1, rSeal * 2.1, -t * 3.5, fade * 0.85, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#f97316', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, -t * 3.5, fade * 0.94, renderer.isoTilt, 'lighter');
          if (t < 0.65) {
            const wt = t / 0.65;
            const rW = unit * (1.0 + easeOutCubic(wt) * 5.2);
            this.drawSpriteTex(ctx, 'fire_shockwave', '#2b0504', gp.x, gp.y, rW * 2.1, rW * 2.1, wt * 2.5, (1 - wt) * 0.85, renderer.isoTilt, 'source-over');
            this.drawSpriteTex(ctx, 'fire_shockwave', '#fde047', gp.x, gp.y, rW * 2.0, rW * 2.0, wt * 2.5, (1 - wt) * 0.98, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'mage_helmet') {
          const fadeOut = t > 0.88 ? (1 - (t - 0.88) / 0.12) : 1.0;
          const rHalo = unit * (t < 0.06 ? (1.0 + easeOutCubic(t / 0.06) * 2.4) : 3.4);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#2a0704', gp.x, gp.y, rHalo * 2.05, rHalo * 2.05, t * 14.0, 0.70 * fadeOut, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#fb923c', gp.x, gp.y, rHalo * 2.0, rHalo * 2.0, t * 14.0, 0.82 * fadeOut, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'mage_trinket') {
          const rSeal = unit * (1.1 + ease * 3.1);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#2b0604', gp.x, gp.y, rSeal * 2.1, rSeal * 2.1, (fx.isArrival ? -1 : 1) * t * 5.0, fade * 0.85, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', fx.isArrival ? '#ef4444' : '#facc15', gp.x, gp.y, rSeal * 2.0, rSeal * 2.0, (fx.isArrival ? -1 : 1) * t * 5.0, fade * 0.96, renderer.isoTilt, 'lighter');
          if (t < 0.6) {
            const wt = t / 0.6;
            const rW = unit * (0.9 + easeOutCubic(wt) * 3.5);
            this.drawSpriteTex(ctx, 'fire_shockwave', fx.isArrival ? '#f97316' : '#fde047', gp.x, gp.y, rW * 2, rW * 2, 0, (1 - wt) * 0.95, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'mage_mobility_hover') {
          const rRing = unit * (0.8 + ease * 2.0);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#2b0604', gp.x, gp.y, rRing * 2.0, rRing * 2.0, t * 5.0, fade * 0.72, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#fb923c', gp.x, gp.y, rRing * 2.0, rRing * 2.0, t * 5.0, fade * 0.92, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'cowboy_weapon') {
          const rC = unit * (1.6 + ease * 4.2);
          this.drawSpriteTex(ctx, 'sheriff_crest', '#241005', gp.x, gp.y, rC * 2.1, rC * 2.1, t * 4.5, fade * 0.88, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'sheriff_crest', '#fbbf24', gp.x, gp.y, rC * 2.0, rC * 2.0, t * 4.5, fade * 0.96, renderer.isoTilt, 'lighter');
          this.drawSpriteTex(ctx, 'sonic_ring', '#fde047', gp.x, gp.y, rC * 2.2, rC * 2.2, -t * 5.0, fade * 0.9, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'cowboy_armor') {
          const detT = 0.22 / 1.25;
          const rZ = unit * (1.5 + ease * 3.9);
          this.drawSpriteTex(ctx, 'deadeye_reticle', '#2e0704', gp.x, gp.y, rZ * 2.1, rZ * 2.1, t * 3.5, fade * 0.85, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'deadeye_reticle', '#ef4444', gp.x, gp.y, rZ * 2.0, rZ * 2.0, t * 3.5, fade * 0.95, renderer.isoTilt, 'lighter');
          if (t >= detT) {
            const wt = Math.min(1, (t - detT) / 0.55);
            const rW = unit * (1.2 + easeOutCubic(wt) * 4.6);
            this.drawSpriteTex(ctx, 'sonic_ring', '#fde047', gp.x, gp.y, rW * 2, rW * 2, 0, (1 - wt) * 0.96, renderer.isoTilt, 'lighter');
          }
        } else if (fx.id === 'cowboy_helmet') {
          const rW = unit * (0.9 + ease * 2.8);
          this.drawSpriteTex(ctx, 'sonic_ring', '#2b1205', gp.x, gp.y, rW * 2.1, rW * 2.1, 0, fade * 0.82, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'sonic_ring', '#fde047', gp.x, gp.y, rW * 2.0, rW * 2.0, 0, fade * 0.95, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'cowboy_trinket') {
          const dirX = Math.cos(fx.facing), dirZ = Math.sin(fx.facing);
          const tp = renderer.project(fx.x + dirX * 7.6, fx.y + 0.05, fx.z + dirZ * 7.6);
          const rR = unit * (2.6 - ease * 0.9);
          this.drawSpriteTex(ctx, 'deadeye_reticle', '#d97706', tp.x, tp.y, rR * 2, rR * 2, -t * 4.5, fade * 0.92, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'cowboy_mobility_tumble') {
          const rS = unit * (0.8 + ease * 1.9);
          this.drawSpriteTex(ctx, 'sheriff_crest', '#261005', gp.x, gp.y, rS * 2.0, rS * 2.0, t * 5.0, fade * 0.78, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'sheriff_crest', '#fbbf24', gp.x, gp.y, rS * 2.0, rS * 2.0, t * 5.0, fade * 0.92, renderer.isoTilt, 'lighter');
        }
      }
    }

    /**
     * Draw foreground HD Knight & Ninja VFX (slashes, Excalibur wave, Aegis barrier,
     * Chariot Rush, Lionheart pillar, Izuna Blade Storm, Smoke Bomb, Fuuma Shuriken,
     * Explosive Substitution, Shadow Backstab, Shadow Step).
     */
    drawCanvasForeground(ctx, renderer) {
      if (this.fallbackInstances.length === 0) return;

      const now = performance.now();
      for (const fx of this.fallbackInstances) {
        const age = now - fx.born;
        if (age >= fx.durationMs) continue;
        const t = age / fx.durationMs;
        const ease = easeOutCubic(t);
        const fade = t < 0.08 ? (t / 0.08) : Math.pow(1 - t, 1.25);

        const dirX = Math.cos(fx.facing);
        const dirZ = Math.sin(fx.facing);
        const pOrigin = renderer.project(fx.x, fx.y + 1.05, fx.z);
        const pAhead = renderer.project(fx.x + dirX * 2.0, fx.y + 1.05, fx.z + dirZ * 2.0);
        const screenAng = Math.atan2(pAhead.y - pOrigin.y, pAhead.x - pOrigin.x);
        const unit = renderer.camZoom * pOrigin.scale * fx.scale;

        if (fx.id === 'basic_slash') {
          const pMid = renderer.project(fx.x + dirX * 0.85, fx.y + 1.05, fx.z + dirZ * 0.85);
          const swingDir = (fx.comboStep % 2 === 0) ? -1 : 1;
          const arcRot = screenAng + swingDir * (-1.15 + ease * 2.15);
          const sz = unit * (2.6 + ease * 1.1);
          // Sapphire trail arc + razor gold primary arc
          this.drawSpriteTex(ctx, 'slash_crescent', '#38bdf8', pMid.x, pMid.y, sz * 1.08, sz * 0.82, arcRot - swingDir * 0.24, fade * 0.82);
          this.drawSpriteTex(ctx, 'slash_crescent', '#fde047', pMid.x, pMid.y, sz, sz * 0.76, arcRot, fade * 0.98);
          if (t < 0.45) {
            const pTip = renderer.project(fx.x + dirX * 1.85, fx.y + 1.15, fx.z + dirZ * 1.85);
            const fSz = unit * (0.8 + (t / 0.45) * 1.6);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fef08a', pTip.x, pTip.y, fSz, fSz, t * 4, (1 - t / 0.45) * 0.95);
          }
        } else if (fx.id === 'heavy_shield_bash') {
          const dist = 0.55 + ease * 1.9;
          const pBash = renderer.project(fx.x + dirX * dist, fx.y + 1.05, fx.z + dirZ * dist);
          const sz = unit * (1.2 + ease * 2.1);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#38bdf8', pBash.x, pBash.y, sz, sz, t * 0.5, fade * 0.96);
          const pEcho = renderer.project(fx.x + dirX * (dist + 0.4), fx.y + 1.05, fx.z + dirZ * (dist + 0.4));
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#fbbf24', pEcho.x, pEcho.y, sz * 1.25, sz * 1.25, -t * 0.3, fade * 0.80);
          if (t < 0.5) {
            const fSz = unit * (1.1 + ease * 2.4);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fde047', pBash.x, pBash.y, fSz, fSz, t * 5, (1 - t / 0.5) * 0.98);
          }
        } else if (fx.id === 'knight_weapon') {
          // Excalibur Wave launching forward along Knight's facing!
          const travel = 0.9 + t * 13.5;
          const pWave = renderer.project(fx.x + dirX * travel, fx.y + 1.35, fx.z + dirZ * travel);
          const wUnit = renderer.camZoom * pWave.scale * fx.scale;
          const wSz = wUnit * (2.6 + ease * 2.4);
          this.drawSpriteTex(ctx, 'slash_crescent', '#f59e0b', pWave.x - Math.cos(screenAng) * 10, pWave.y - Math.sin(screenAng) * 10, wSz * 1.15, wSz * 1.25, screenAng, fade * 0.85);
          this.drawSpriteTex(ctx, 'slash_crescent', '#fef08a', pWave.x, pWave.y, wSz, wSz * 1.15, screenAng, fade * 1.0);
          if (t < 0.35) {
            const fSz = unit * (1.2 + (t / 0.35) * 3.0);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fef08a', pOrigin.x, pOrigin.y, fSz, fSz, t * 6, (1 - t / 0.35) * 0.95);
          }
        } else if (fx.id === 'knight_armor') {
          // Aegis Fortress dome barrier + orbiting hexagonal shield crests
          const sz = unit * (2.2 + ease * 1.6);
          this.drawSpriteTex(ctx, 'soft_glow', '#38bdf8', pOrigin.x, pOrigin.y, sz * 1.6, sz * 1.6, 0, fade * 0.45);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#60a5fa', pOrigin.x, pOrigin.y, sz * 1.15, sz * 1.15, Math.sin(t * 6) * 0.15, fade * 0.85);
          // Twin orbiting golden ribbon arcs
          for (let k = 0; k < 2; k++) {
            const orbAng = t * Math.PI * 5 + k * Math.PI;
            const ox = fx.x + Math.cos(orbAng) * 1.45;
            const oz = fx.z + Math.sin(orbAng) * 1.45;
            const oy = fx.y + 0.35 + t * 1.7;
            const op = renderer.project(ox, oy, oz);
            this.drawSpriteTex(ctx, 'energy_ribbon', '#fde047', op.x, op.y, unit * 1.8, unit * 0.65, orbAng, fade * 0.88);
          }
        } else if (fx.id === 'knight_helmet') {
          // Lionheart Warcry: Golden holy beam column + sunburst roar flash
          const pCol = renderer.project(fx.x, fx.y + 2.2, fx.z);
          const colW = unit * (1.2 + ease * 1.4);
          const colH = unit * (3.2 + ease * 3.2);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#fbbf24', pCol.x, pCol.y, colH, colW, Math.PI * 0.5, fade * 0.78);
          if (t < 0.42) {
            const fSz = unit * (1.4 + (t / 0.42) * 3.8);
            this.drawSpriteTex(ctx, 'starburst_flare', '#fde047', pOrigin.x, pOrigin.y, fSz, fSz, t * 4, (1 - t / 0.42) * 0.98);
          }
        } else if (fx.id === 'knight_trinket') {
          // Chariot Rush: Aerodynamic sapphire-gold shield ram cone attached to dashing Knight!
          const pFront = renderer.project(fx.x + dirX * 1.55, fx.y + 1.05, fx.z + dirZ * 1.55);
          const coneW = unit * (2.6 + ease * 1.2);
          const coneH = unit * (1.8 + ease * 0.8);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#38bdf8', pOrigin.x, pOrigin.y, coneW * 1.35, coneH, screenAng, fade * 0.85);
          this.drawSpriteTex(ctx, 'energy_ribbon', '#fde047', pOrigin.x, pOrigin.y, coneW, coneH * 0.62, screenAng, fade * 0.92);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#7dd3fc', pFront.x, pFront.y, unit * 1.9, unit * 1.9, t * 2.5, fade * 0.95);
          for (let r = 0; r < 3; r++) {
            const rt = ((t * 3 + r * 0.33) % 1);
            const pRing = renderer.project(fx.x + dirX * (1.3 - rt * 2.2), fx.y + 1.05, fx.z + dirZ * (1.3 - rt * 2.2));
            const rSz = unit * (0.9 + rt * 1.4);
            this.drawSpriteTex(ctx, 'shockwave_ring', '#7dd3fc', pRing.x, pRing.y, rSz * 0.65, rSz * 1.3, screenAng, (1 - rt) * fade * 0.85);
          }
        } else if (fx.id === 'guard_parry') {
          const pShield = renderer.project(fx.x + dirX * 0.75, fx.y + 1.05, fx.z + dirZ * 0.75);
          const sz = unit * (1.1 + ease * 1.4);
          this.drawSpriteTex(ctx, 'hex_aegis_shield', '#7dd3fc', pShield.x, pShield.y, sz, sz, 0, fade * 0.96);
          this.drawSpriteTex(ctx, 'shockwave_ring', '#38bdf8', pShield.x, pShield.y, sz * 1.35, sz * 1.35, 0, fade * 0.85);
          if (t < 0.55) {
            this.drawSpriteTex(ctx, 'starburst_flare', '#ffffff', pShield.x, pShield.y, sz * 1.45, sz * 1.45, t * 7, (1 - t / 0.55) * 0.98);
          }
        } else if (fx.id === 'ninja_basic_slash') {
          // Dual Kunai Cross-Slash: Dark obsidian ink + neon violet & cyan twin sweeps
          const pMid = renderer.project(fx.x + dirX * 0.85, fx.y + 1.05, fx.z + dirZ * 0.85);
          const swingDir = (fx.comboStep % 2 === 0) ? -1 : 1;
          const arcRot = screenAng + swingDir * (-1.1 + ease * 2.1);
          const sz = unit * (2.3 + ease * 1.0);
          this.drawSpriteTex(ctx, 'kunai_slash', '#140826', pMid.x, pMid.y, sz * 1.15, sz * 0.85, arcRot, fade * 0.82, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'kunai_slash', '#c084fc', pMid.x, pMid.y, sz, sz * 0.72, arcRot, fade * 0.96, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'kunai_slash', '#38bdf8', pMid.x, pMid.y, sz * 0.92, sz * 0.66, screenAng - swingDir * (-0.95 + ease * 1.85), fade * 0.86, 1.0, 'lighter');
          if (fx.isFinisher || t < 0.45) {
            const pTip = renderer.project(fx.x + dirX * 1.65, fx.y + 1.1, fx.z + dirZ * 1.65);
            const fSz = unit * (0.9 + ease * 1.6);
            this.drawSpriteTex(ctx, 'crimson_flare', fx.isFinisher ? '#f43f5e' : '#e879f9', pTip.x, pTip.y, fSz, fSz, t * 5, (1 - t) * 0.92, 1.0, 'lighter');
          }
        } else if (fx.id === 'ninja_heavy_backstab') {
          // Shadow Backstab: Dark veil + blazing crimson X-fang cross-mark
          const pStrike = renderer.project(fx.x + dirX * 0.65, fx.y + 1.15, fx.z + dirZ * 0.65);
          const smokeSz = unit * (2.2 + ease * 2.0);
          this.drawSpriteTex(ctx, 'shadow_smoke', '#18092c', pOrigin.x, pOrigin.y, smokeSz, smokeSz, t * 1.2, fade * 0.76, 1.0, 'source-over');
          const xSz = unit * (1.8 + ease * 2.4);
          this.drawSpriteTex(ctx, 'cross_fang', '#2a0618', pStrike.x, pStrike.y, xSz * 1.15, xSz * 1.15, screenAng * 0.25, fade * 0.82, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'cross_fang', '#f43f5e', pStrike.x, pStrike.y, xSz, xSz, screenAng * 0.25, fade * 0.98, 1.0, 'lighter');
          if (t < 0.48) {
            const fSz = unit * (1.1 + (t / 0.48) * 2.4);
            this.drawSpriteTex(ctx, 'crimson_flare', '#fda4af', pStrike.x, pStrike.y, fSz, fSz, -t * 6, (1 - t / 0.48) * 0.96, 1.0, 'lighter');
          }
        } else if (fx.id === 'ninja_weapon') {
          // [Q] Izuna Blade Storm: Towering shadow cyclone + 6 staggered slash bursts
          const pLow = renderer.project(fx.x, fx.y + 0.9, fx.z);
          const pMid = renderer.project(fx.x, fx.y + 1.9 + ease * 1.2, fx.z);
          const pTop = renderer.project(fx.x, fx.y + 2.9 + ease * 1.6, fx.z);
          const smokeSz = unit * (3.0 + ease * 2.2);
          this.drawSpriteTex(ctx, 'shadow_smoke', '#140826', pLow.x, pLow.y, smokeSz, smokeSz * 0.75, t * 2.5, fade * 0.78, 1.0, 'source-over');
          const vSz = unit * (2.4 + ease * 2.4);
          this.drawSpriteTex(ctx, 'shadow_vortex', '#1c0b38', pMid.x, pMid.y, vSz * 1.12, vSz * 1.12, t * 6.5, fade * 0.75, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'shadow_vortex', '#a855f7', pMid.x, pMid.y, vSz, vSz, t * 6.5, fade * 0.94, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'shadow_vortex', '#38bdf8', pTop.x, pTop.y, vSz * 0.78, vSz * 0.78, -t * 8.5, fade * 0.82, 1.0, 'lighter');
          // 6 staggered criss-crossing kunai slashes inside the storm
          for (let k = 0; k < 6; k++) {
            const kt = (t - k * 0.08) / 0.42;
            if (kt <= 0 || kt >= 1) continue;
            const kFade = Math.sin(kt * Math.PI);
            const ang = k * 1.05 + kt * 1.8;
            const sy = fx.y + 0.8 + (k % 3) * 0.85 + kt * 0.9;
            const sp = renderer.project(fx.x + Math.cos(ang) * 1.1, sy, fx.z + Math.sin(ang) * 1.1);
            const sSz = unit * (2.2 + kt * 1.5);
            const tint = k % 3 === 0 ? '#c084fc' : (k % 3 === 1 ? '#38bdf8' : '#f43f5e');
            this.drawSpriteTex(ctx, 'kunai_slash', '#140726', sp.x, sp.y, sSz * 1.08, sSz * 0.65, ang, kFade * 0.72, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'kunai_slash', tint, sp.x, sp.y, sSz, sSz * 0.58, ang, kFade * 0.96, 1.0, 'lighter');
          }
          if (t < 0.35) {
            const fSz = unit * (1.4 + (t / 0.35) * 2.8);
            this.drawSpriteTex(ctx, 'crimson_flare', '#e879f9', pMid.x, pMid.y, fSz, fSz, t * 5, (1 - t / 0.35) * 0.92, 1.0, 'lighter');
          }
        } else if (fx.id === 'ninja_armor') {
          // [E] Smoke Bomb Stealth: Thick multi-puff indigo-obsidian cloud dome + floating talismans
          for (let k = 0; k < 6; k++) {
            const orbAng = k * (Math.PI / 3) + t * 0.7;
            const rad = (0.65 + ease * 2.15) * (k % 2 === 0 ? 1.0 : 0.72);
            const cy = fx.y + 0.55 + (k % 3) * 0.42 + ease * 0.5;
            const cp = renderer.project(fx.x + Math.cos(orbAng) * rad, cy, fx.z + Math.sin(orbAng) * rad);
            const pSz = unit * (2.1 + ease * 2.2);
            this.drawSpriteTex(ctx, 'shadow_smoke', '#180b2e', cp.x, cp.y, pSz * 1.12, pSz * 1.02, orbAng + t * 1.2, fade * 0.82, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'shadow_smoke', '#8b5cf6', cp.x, cp.y, pSz * 0.9, pSz * 0.85, -orbAng, fade * 0.55, 1.0, 'lighter');
          }
          // Center dense dome + floating paper talismans
          const cSz = unit * (2.6 + ease * 2.4);
          this.drawSpriteTex(ctx, 'shadow_smoke', '#120724', pOrigin.x, pOrigin.y, cSz, cSz, -t * 1.5, fade * 0.86, 1.0, 'source-over');
          for (let p = 0; p < 4; p++) {
            const pa = p * (Math.PI * 0.5) + t * 2.8;
            const pp = renderer.project(fx.x + Math.cos(pa) * (1.2 + ease * 1.6), fx.y + 0.8 + t * 1.4, fx.z + Math.sin(pa) * (1.2 + ease * 1.6));
            this.drawSpriteTex(ctx, 'paper_talisman', '#e9d5ff', pp.x, pp.y, unit * 0.85, unit * 1.15, pa, fade * 0.92, 1.0, 'lighter');
          }
          if (t < 0.28) {
            const fSz = unit * (1.5 + (t / 0.28) * 3.0);
            this.drawSpriteTex(ctx, 'crimson_flare', '#c084fc', pOrigin.x, pOrigin.y, fSz, fSz, t * 6, (1 - t / 0.28) * 0.95, 1.0, 'lighter');
          }
        } else if (fx.id === 'ninja_helmet') {
          // [R] Fuuma Shuriken Fan: 5 giant spinning shurikens flying out in fan formation
          if (t < 0.35) {
            const sweepSz = unit * (2.4 + (t / 0.35) * 1.6);
            this.drawSpriteTex(ctx, 'kunai_slash', '#a855f7', pOrigin.x, pOrigin.y, sweepSz, sweepSz * 0.72, screenAng, (1 - t / 0.35) * 0.92, 1.0, 'lighter');
          }
          const offsets = [-0.44, -0.22, 0, 0.22, 0.44];
          const travel = 0.8 + t * 12.8;
          for (let k = 0; k < offsets.length; k++) {
            const ang = fx.facing + offsets[k];
            const sx = fx.x + Math.cos(ang) * travel;
            const sz = fx.z + Math.sin(ang) * travel;
            const ps = renderer.project(sx, fx.y + 1.15, sz);
            const sUnit = renderer.camZoom * ps.scale * fx.scale;
            const sSz = sUnit * (1.55 + Math.sin(t * Math.PI) * 0.45);
            const spin = t * 24.0 + k * 0.7;
            this.drawSpriteTex(ctx, 'shuriken_glint', '#1a0936', ps.x, ps.y, sSz * 1.15, sSz * 1.15, spin, fade * 0.85, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'shuriken_glint', k === 2 ? '#38bdf8' : '#e9d5ff', ps.x, ps.y, sSz, sSz, spin, fade * 0.98, 1.0, 'lighter');
          }
        } else if (fx.id === 'ninja_trinket') {
          // [F] Explosive Substitution: Fuse talisman ring (0..0.43) -> Crimson bomb blast (0.43..1)
          const detonateT = 0.43;
          if (t < detonateT) {
            const ft = t / detonateT;
            const puffSz = unit * (1.8 + ft * 1.4);
            this.drawSpriteTex(ctx, 'shadow_smoke', '#18092c', pOrigin.x, pOrigin.y, puffSz, puffSz, ft * 2.0, (1 - ft * 0.3) * 0.82, 1.0, 'source-over');
            const ringRad = 1.6 - ft * 0.65;
            for (let k = 0; k < 6; k++) {
              const pa = k * (Math.PI / 3) + ft * Math.PI * 3.5;
              const pp = renderer.project(fx.x + Math.cos(pa) * ringRad, fx.y + 0.95 + Math.sin(ft * 8 + k) * 0.2, fx.z + Math.sin(pa) * ringRad);
              this.drawSpriteTex(ctx, 'paper_talisman', '#fda4af', pp.x, pp.y, unit * 0.85, unit * 1.2, pa, 0.95, 1.0, 'lighter');
            }
            const glowSz = unit * (1.0 + ft * 1.8);
            this.drawSpriteTex(ctx, 'crimson_flare', '#f43f5e', pOrigin.x, pOrigin.y, glowSz, glowSz, ft * 5, (0.45 + ft * 0.55), 1.0, 'lighter');
          } else {
            const bt = (t - detonateT) / (1 - detonateT);
            const bEase = easeOutCubic(bt);
            const bFade = Math.pow(1 - bt, 1.2);
            const smokeSz = unit * (2.6 + bEase * 4.2);
            this.drawSpriteTex(ctx, 'shadow_smoke', '#240714', pOrigin.x, pOrigin.y, smokeSz, smokeSz, bt * 2.2, bFade * 0.88, 1.0, 'source-over');
            const flareSz = unit * (2.4 + bEase * 4.4);
            this.drawSpriteTex(ctx, 'crimson_flare', '#f43f5e', pOrigin.x, pOrigin.y, flareSz, flareSz, bt * 6, bFade * 0.98, 1.0, 'lighter');
            this.drawSpriteTex(ctx, 'crimson_flare', '#fb923c', pOrigin.x, pOrigin.y, flareSz * 0.72, flareSz * 0.72, -bt * 8, bFade * 0.95, 1.0, 'lighter');
            this.drawSpriteTex(ctx, 'cross_fang', '#fda4af', pOrigin.x, pOrigin.y, flareSz * 0.95, flareSz * 0.95, bt * 1.5, bFade * 0.88, 1.0, 'lighter');
            for (let k = 0; k < 6; k++) {
              const pa = k * (Math.PI / 3) + 0.4;
              const dist = 0.6 + bEase * 3.4;
              const pp = renderer.project(fx.x + Math.cos(pa) * dist, fx.y + 0.9 + bEase * 2.1, fx.z + Math.sin(pa) * dist);
              this.drawSpriteTex(ctx, 'paper_talisman', '#fb923c', pp.x, pp.y, unit * 0.8, unit * 1.1, pa + bt * 6, bFade * 0.92, 1.0, 'lighter');
            }
          }
        } else if (fx.id === 'ninja_mobility_shadowstep') {
          // Shadow Step / Triple Jump / Dash: Compact shadow mist puff + vortex + drifting talismans
          const sz = unit * (1.6 + ease * 1.6);
          this.drawSpriteTex(ctx, 'shadow_smoke', '#16082c', pOrigin.x, pOrigin.y, sz * 1.15, sz * 1.05, t * 2.0, fade * 0.78, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'shadow_vortex', '#a855f7', pOrigin.x, pOrigin.y, sz, sz, -t * 5.0, fade * 0.92, 1.0, 'lighter');
          for (let k = 0; k < 3; k++) {
            const pa = k * 2.09 + t * 3.2;
            const pp = renderer.project(fx.x + Math.cos(pa) * (0.5 + ease * 1.1), fx.y + 0.6 + ease * 1.0, fx.z + Math.sin(pa) * (0.5 + ease * 1.1));
            this.drawSpriteTex(ctx, 'paper_talisman', '#d8b4fe', pp.x, pp.y, unit * 0.65, unit * 0.9, pa, fade * 0.88, 1.0, 'lighter');
          }
        } else if (fx.id === 'mage_basic_fireball') {
          // Arcane Fireball Staff Cast: Spinning sigil + solar flash + forward flame licks
          const pTip = renderer.project(fx.x + dirX * 1.05, fx.y + 1.05, fx.z + dirZ * 1.05);
          const sz = unit * (1.2 + ease * 1.35);
          this.drawSpriteTex(ctx, 'pyro_rune_circle', '#3b0704', pTip.x, pTip.y, sz * 1.1, sz * 1.1, t * 6.0, fade * 0.82, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'pyro_rune_circle', fx.isFinisher ? '#ef4444' : '#f97316', pTip.x, pTip.y, sz, sz, t * 6.0, fade * 0.96, 1.0, 'lighter');
          if (t < 0.55) {
            const fSz = unit * (0.9 + (t / 0.55) * 1.5);
            this.drawSpriteTex(ctx, 'solar_orb', '#fde047', pTip.x, pTip.y, fSz, fSz, t * 5, (1 - t / 0.55) * 0.95, 1.0, 'lighter');
          }
        } else if (fx.id === 'mage_heavy_pillar') {
          // Dragon Pillar: Towering volcanic fire column ahead of Fire Mage
          const px = fx.x + dirX * 2.35, pz = fx.z + dirZ * 2.35;
          const pLow = renderer.project(px, fx.y + 0.8, pz);
          const pMid = renderer.project(px, fx.y + 2.2 + ease * 1.0, pz);
          const pTop = renderer.project(px, fx.y + 3.4 + ease * 1.4, pz);
          const colW = unit * (1.9 + ease * 1.5);
          const colH = unit * (3.2 + ease * 2.8);
          this.drawSpriteTex(ctx, 'volcanic_smoke', '#220908', pLow.x, pLow.y, colW * 1.5, colW * 1.0, t * 1.8, fade * 0.82, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'flame_vortex', '#3b0704', pMid.x, pMid.y, colW * 1.15, colH * 1.08, 0, fade * 0.85, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'flame_vortex', '#f97316', pMid.x, pMid.y, colW, colH, 0, fade * 0.96, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'flame_lick', '#fde047', pTop.x, pTop.y, colW * 0.85, colH * 0.72, Math.sin(t * 16) * 0.12, fade * 0.92, 1.0, 'lighter');
        } else if (fx.id === 'mage_weapon') {
          // [Q] Meteor Apocalypse: Falling molten asteroid (0..0.18) -> Cataclysm eruption (0.18..1)
          const impactT = 0.28 / 1.55;
          if (t < impactT) {
            const ft = (t / impactT) * (t / impactT);
            const mx = fx.x - 4.5 * (1 - ft);
            const my = fx.y + 13.5 * (1 - ft) + 0.6;
            const mz = fx.z - 3.5 * (1 - ft);
            const pm = renderer.project(mx, my, mz);
            const mSz = unit * (2.6 + ft * 1.5);
            this.drawSpriteTex(ctx, 'meteor_core', '#4a1206', pm.x, pm.y, mSz * 1.1, mSz * 1.1, t * 14, 0.98, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'meteor_core', '#fb923c', pm.x, pm.y, mSz, mSz, t * 14, 0.96, 1.0, 'lighter');
          } else {
            const it = (t - impactT) / (1 - impactT);
            const iEase = easeOutCubic(it);
            const iFade = Math.pow(1 - it, 1.25);
            const pMid = renderer.project(fx.x, fx.y + 2.2 + iEase * 1.6, fx.z);
            const smkSz = unit * (3.2 + iEase * 4.2);
            this.drawSpriteTex(ctx, 'volcanic_smoke', '#1e0807', pOrigin.x, pOrigin.y, smkSz, smkSz * 0.85, it * 1.8, iFade * 0.88, 1.0, 'source-over');
            const colW = unit * (2.4 + iEase * 2.2);
            const colH = unit * (3.6 + iEase * 3.4);
            this.drawSpriteTex(ctx, 'flame_vortex', '#2b0604', pMid.x, pMid.y, colW * 1.15, colH * 1.08, 0, iFade * 0.86, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'flame_vortex', '#f97316', pMid.x, pMid.y, colW, colH, 0, iFade * 0.96, 1.0, 'lighter');
            if (it < 0.45) {
              const fSz = unit * (2.4 + (it / 0.45) * 4.4);
              this.drawSpriteTex(ctx, 'solar_orb', '#fde047', pOrigin.x, pOrigin.y, fSz, fSz, it * 5, (1 - it / 0.45) * 0.98, 1.0, 'lighter');
            }
          }
        } else if (fx.id === 'mage_armor') {
          // [E] Supernova Ring: Blazing 360 flame wall + ash burst + solar core flare
          const wallSz = unit * (2.4 + ease * 4.0);
          this.drawSpriteTex(ctx, 'volcanic_smoke', '#210807', pOrigin.x, pOrigin.y, wallSz * 1.15, wallSz * 0.85, t * 2.0, fade * 0.78, 1.0, 'source-over');
          for (let k = 0; k < 6; k++) {
            const ang = k * (Math.PI / 3) + t * 1.4;
            const rad = 0.8 + ease * 3.2;
            const fp = renderer.project(fx.x + Math.cos(ang) * rad, fx.y + 1.05, fx.z + Math.sin(ang) * rad);
            const fSz = unit * (1.8 + ease * 1.4);
            this.drawSpriteTex(ctx, 'flame_lick', '#3b0704', fp.x, fp.y, fSz * 0.85, fSz * 1.25, ang, fade * 0.78, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'flame_lick', '#fb923c', fp.x, fp.y, fSz * 0.78, fSz * 1.18, ang, fade * 0.96, 1.0, 'lighter');
          }
          if (t < 0.45) {
            const cSz = unit * (1.6 + (t / 0.45) * 3.6);
            this.drawSpriteTex(ctx, 'solar_orb', '#fde047', pOrigin.x, pOrigin.y, cSz, cSz, t * 5, (1 - t / 0.45) * 0.96, 1.0, 'lighter');
          }
        } else if (fx.id === 'mage_helmet') {
          // [R] Solar Orbit Spheres: 4 radiant miniature suns orbiting the Fire Mage for 6s
          const sec = age * 0.001;
          const expand = t < 0.05 ? easeOutCubic(t / 0.05) : 1.0;
          const fadeOut = t > 0.90 ? (1 - (t - 0.90) / 0.10) : 1.0;
          const rad = 1.65 * expand;
          for (let k = 0; k < 4; k++) {
            const ang = sec * 4.4 + k * (Math.PI * 0.5);
            const op = renderer.project(fx.x + Math.cos(ang) * rad, fx.y + 1.15 + Math.sin(sec * 5 + k) * 0.22, fx.z + Math.sin(ang) * rad);
            const oSz = unit * 1.25 * expand;
            this.drawSpriteTex(ctx, 'solar_orb', '#450a0a', op.x, op.y, oSz * 1.15, oSz * 1.15, sec * 4, 0.82 * fadeOut, 1.0, 'source-over');
            this.drawSpriteTex(ctx, 'solar_orb', '#fb923c', op.x, op.y, oSz, oSz, -sec * 5, 0.96 * fadeOut, 1.0, 'lighter');
            this.drawSpriteTex(ctx, 'solar_orb', '#fef08a', op.x, op.y, oSz * 0.58, oSz * 0.58, sec * 6, 0.95 * fadeOut, 1.0, 'lighter');
          }
        } else if (fx.id === 'mage_trinket') {
          // [F] Flame Blink Warp: Blazing Phoenix Wings + Volcanic Poof
          const pWing = renderer.project(fx.x, fx.y + 1.3 + ease * 0.6, fx.z);
          const wSz = unit * ((fx.isArrival ? 1.8 : 1.2) + ease * (fx.isArrival ? 2.5 : 1.6));
          this.drawSpriteTex(ctx, 'volcanic_smoke', '#240807', pOrigin.x, pOrigin.y, wSz * 1.05, wSz * 0.85, t * 2.0, fade * 0.78, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'phoenix_wings', '#3b0604', pWing.x, pWing.y, wSz * 1.25, wSz * 1.05, 0, fade * 0.88, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'phoenix_wings', fx.isArrival ? '#fb923c' : '#fde047', pWing.x, pWing.y, wSz * 1.2, wSz, 0, fade * 0.98, 1.0, 'lighter');
        } else if (fx.id === 'mage_mobility_hover') {
          // Flame Hover / Air Dash: Compact Phoenix Wings flare
          const wSz = unit * (1.2 + ease * 1.4);
          this.drawSpriteTex(ctx, 'phoenix_wings', '#3b0604', pOrigin.x, pOrigin.y, wSz * 1.2, wSz, 0, fade * 0.82, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'phoenix_wings', '#fde047', pOrigin.x, pOrigin.y, wSz * 1.15, wSz * 0.95, 0, fade * 0.95, 1.0, 'lighter');
        } else if (fx.id === 'cowboy_basic_shot') {
          const pTip = renderer.project(fx.x + dirX * 1.0, fx.y + 1.05, fx.z + dirZ * 1.0);
          const pTrail = renderer.project(fx.x + dirX * (1.8 + t * 5.5), fx.y + 1.05, fx.z + dirZ * (1.8 + t * 5.5));
          const sz = unit * (1.0 + ease * 1.3);
          this.drawSpriteTex(ctx, 'muzzle_star', '#fde047', pTip.x, pTip.y, sz, sz, t * 8, fade * 0.96, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'bullet_tracer', '#fbbf24', pTrail.x, pTrail.y, unit * 2.4, unit * 0.65, screenAng, fade * 0.95, 1.0, 'lighter');
        } else if (fx.id === 'cowboy_heavy_deadeye') {
          const pRet = renderer.project(fx.x + dirX * 1.5, fx.y + 1.08, fx.z + dirZ * 1.5);
          const pBeam = renderer.project(fx.x + dirX * 5.2, fx.y + 1.05, fx.z + dirZ * 5.2);
          const rSz = unit * (2.6 - ease * 1.0);
          this.drawSpriteTex(ctx, 'deadeye_reticle', '#260d04', pRet.x, pRet.y, rSz * 1.08, rSz * 1.08, t * 5, fade * 0.85, 1.0, 'source-over');
          this.drawSpriteTex(ctx, 'deadeye_reticle', '#fbbf24', pRet.x, pRet.y, rSz, rSz, t * 5, fade * 0.98, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'bullet_tracer', '#fde047', pBeam.x, pBeam.y, unit * 8.4, unit * 1.25, screenAng, fade * 0.96, 1.0, 'lighter');
        } else if (fx.id === 'cowboy_weapon') {
          for (let k = 0; k < 12; k++) {
            const kt = (t - k * 0.038) / 0.34;
            if (kt <= 0 || kt >= 1) continue;
            const ang = (k / 12) * Math.PI * 2;
            const dist = 1.4 + easeOutCubic(kt) * 5.2;
            const pt = renderer.project(fx.x + Math.cos(ang) * dist, fx.y + 1.05, fx.z + Math.sin(ang) * dist);
            const pt2 = renderer.project(fx.x + Math.cos(ang) * (dist + 1.0), fx.y + 1.05, fx.z + Math.sin(ang) * (dist + 1.0));
            const sAng = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);
            this.drawSpriteTex(ctx, 'bullet_tracer', '#fde047', pt.x, pt.y, unit * 2.8, unit * 0.72, sAng, (1 - kt) * 0.96, 1.0, 'lighter');
          }
          if (t >= 0.58) {
            const st = (t - 0.58) / 0.42;
            const bSz = unit * (2.2 + easeOutCubic(st) * 4.8);
            this.drawSpriteTex(ctx, 'tnt_blast', '#fbbf24', pOrigin.x, pOrigin.y, bSz, bSz, st * 2, (1 - st) * 0.96, 1.0, 'lighter');
          }
        } else if (fx.id === 'cowboy_armor') {
          const detT = 0.22 / 1.25;
          if (t < detT) {
            const lt = t / detT;
            const tx = fx.x - dirX * 4.5 * (1 - lt);
            const tz = fx.z - dirZ * 4.5 * (1 - lt);
            const ty = fx.y + 1.1 * (1 - lt) + 0.5 * lt + Math.sin(lt * Math.PI) * 2.8;
            const pt = renderer.project(tx, ty, tz);
            this.drawSpriteTex(ctx, 'tnt_bundle', '#ffffff', pt.x, pt.y, unit * 1.5, unit * 1.5, t * 24, 1.0, 1.0, 'source-over');
          } else {
            const dt2 = (t - detT) / (1 - detT);
            const dEase = easeOutCubic(dt2);
            const dFade = Math.pow(1 - dt2, 1.2);
            const smkSz = unit * (2.6 + dEase * 4.2);
            this.drawSpriteTex(ctx, 'gun_smoke', '#21120a', pOrigin.x, pOrigin.y, smkSz, smkSz * 0.85, dt2 * 2, dFade * 0.88, 1.0, 'source-over');
            const bSz = unit * (2.2 + dEase * 4.6);
            this.drawSpriteTex(ctx, 'tnt_blast', '#f97316', pOrigin.x, pOrigin.y, bSz, bSz, dt2 * 1.5, dFade * 0.98, 1.0, 'lighter');
            this.drawSpriteTex(ctx, 'muzzle_star', '#fef08a', pOrigin.x, pOrigin.y, bSz * 0.8, bSz * 0.8, -dt2 * 4, dFade * 0.95, 1.0, 'lighter');
          }
        } else if (fx.id === 'cowboy_helmet') {
          const pFl = renderer.project(fx.x + dirX * 1.9, fx.y + 1.08, fx.z + dirZ * 1.9);
          const pBm = renderer.project(fx.x + dirX * 4.6, fx.y + 1.05, fx.z + dirZ * 4.6);
          const fSz = unit * (1.6 + ease * 3.2);
          this.drawSpriteTex(ctx, 'muzzle_star', '#fef08a', pFl.x, pFl.y, fSz, fSz, t * 9, fade * 0.98, 1.0, 'lighter');
          this.drawSpriteTex(ctx, 'bullet_tracer', '#fef08a', pBm.x, pBm.y, unit * 7.2, unit * 1.1, screenAng, fade * 0.95, 1.0, 'lighter');
        } else if (fx.id === 'cowboy_trinket') {
          const reach = t < 0.25 ? easeOutCubic(t / 0.25) : Math.max(0.18, 1 - (t - 0.25) * 1.05);
          const pMid = renderer.project(fx.x + dirX * (4.1 * reach), fx.y + 1.02, fx.z + dirZ * (4.1 * reach));
          const pEnd = renderer.project(fx.x + dirX * (0.5 + 7.8 * reach), fx.y + 0.95, fx.z + dirZ * (0.5 + 7.8 * reach));
          this.drawSpriteTex(ctx, 'bullet_tracer', '#f59e0b', pMid.x, pMid.y, unit * (8.0 * reach), unit * 0.55, screenAng, fade * 0.96, 1.0, 'lighter');
          const lSz = unit * (t < 0.32 ? (3.0 - (t / 0.32) * 1.3) : 1.7);
          this.drawSpriteTex(ctx, 'lasso_loop', '#2b1204', pEnd.x, pEnd.y, lSz * 1.08, lSz * 1.08, t * 14, fade * 0.85, renderer.isoTilt, 'source-over');
          this.drawSpriteTex(ctx, 'lasso_loop', '#fde047', pEnd.x, pEnd.y, lSz, lSz, t * 14, fade * 0.98, renderer.isoTilt, 'lighter');
        } else if (fx.id === 'cowboy_mobility_tumble') {
          const dSz = unit * (1.2 + ease * 1.4);
          this.drawSpriteTex(ctx, 'gun_smoke', '#4f321c', pOrigin.x, pOrigin.y, dSz, dSz * 0.8, t * 3, fade * 0.78, 1.0, 'source-over');
        }

        // Draw sparks & Lionheart heal crosses for every Knight, Ninja, Fire Archmage & Cowboy effect!
        const sec = age * 0.001;
        for (const sp of fx.sparks) {
          const localSec = sec - sp.delay;
          if (localSec <= 0) continue;
          const spLife = fx.durationMs * 0.001 - sp.delay;
          const st = clamp01(localSec / Math.max(0.15, spLife));
          if (st >= 1) continue;

          const gravity = sp.isHeal ? 0 : -7.5;
          const sx = fx.x + sp.ox + sp.vx * localSec;
          const sy = Math.max(0.05, fx.y + sp.oy + sp.vy * localSec + 0.5 * gravity * localSec * localSec);
          const sz = fx.z + sp.oz + sp.vz * localSec;

          const pNow = renderer.project(sx, sy, sz);
          const pPrev = renderer.project(sx - sp.vx * 0.03, sy - (sp.vy + gravity * localSec) * 0.03, sz - sp.vz * 0.03);
          const velAng = Math.atan2(pNow.y - pPrev.y, pNow.x - pPrev.x) + Math.PI * 0.5;
          const alpha = (1 - st) * 0.95;

          if (sp.isHeal) {
            const hSz = renderer.camZoom * pNow.scale * sp.size * (0.65 + st * 0.45);
            this.drawSpriteTex(ctx, 'heal_cross', '#86efac', pNow.x, pNow.y, hSz, hSz, 0, alpha);
          } else if (sp.isNinja) {
            const pSz = renderer.camZoom * pNow.scale * sp.size * (1.1 - st * 0.65);
            const tint = (fx.id === 'ninja_heavy_backstab' || fx.id === 'ninja_trinket')
              ? '#fb7185'
              : (fx.id === 'ninja_helmet' || fx.id === 'ninja_weapon' ? '#38bdf8' : '#d8b4fe');
            this.drawSpriteTex(ctx, 'kunai_spark', tint, pNow.x, pNow.y, pSz * 0.55, pSz * 1.45, velAng, alpha);
          } else if (sp.isMage) {
            const pSz = renderer.camZoom * pNow.scale * sp.size * (1.1 - st * 0.65);
            const tint = (fx.id === 'mage_weapon' || fx.id === 'mage_heavy_pillar') ? '#fb923c' : '#fde047';
            this.drawSpriteTex(ctx, 'fire_ember', tint, pNow.x, pNow.y, pSz * 0.55, pSz * 1.45, velAng, alpha);
          } else if (sp.isCowboy) {
            const pSz = renderer.camZoom * pNow.scale * sp.size * (1.1 - st * 0.65);
            const tint = fx.id === 'cowboy_armor' ? '#fb923c' : '#fde047';
            this.drawSpriteTex(ctx, 'brass_spark', tint, pNow.x, pNow.y, pSz * 0.55, pSz * 1.45, velAng, alpha);
          } else {
            const pSz = renderer.camZoom * pNow.scale * sp.size * (1.1 - st * 0.65);
            const tint = (fx.id === 'knight_armor' || fx.id === 'knight_trinket' || fx.id === 'guard_parry') ? '#7dd3fc' : '#fde047';
            this.drawSpriteTex(ctx, 'holy_spark', tint, pNow.x, pNow.y, pSz * 0.55, pSz * 1.45, velAng, alpha);
          }
        }
      }
    }
  }

  root.KNIGHT_VFX_CATALOG = KNIGHT_VFX_CATALOG;
  root.KnightEffekseerVFX = new KnightEffekseerVFX();
})(typeof self !== 'undefined' ? self : this);
