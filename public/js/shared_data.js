// ============================================================================
// LOST SAGA 3D ARENA - SHARED GAME DATA (Heroes, 40 Gear Skills, Maps)
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GAME_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'trinket'];

  const GEAR_SLOT_LABELS = {
    weapon: { th: 'อาวุธ', en: 'Weapon', key: 'JL', altKey: 'Q' },
    armor:  { th: 'ชุดเกราะ', en: 'Armor', key: 'JKL', altKey: 'E' },
    helmet: { th: 'หมวก', en: 'Helmet', key: 'JK', altKey: 'R' },
    trinket:{ th: 'ผ้าคลุม/ประดับ', en: 'Trinket', key: 'KL', altKey: 'F' }
  };

  const RARITY_TIERS = {
    normal: { id: 'normal', code: 'N', labelTh: 'ปกติ',  labelEn: 'Normal', color: '#15803d', bg: '#22c55e', border: '#16a34a', softBg: '#dcfce7' },
    rare:   { id: 'rare',   code: 'R', labelTh: 'หายาก', labelEn: 'Rare',   color: '#a16207', bg: '#facc15', border: '#eab308', softBg: '#fef9c3' },
    unique: { id: 'unique', code: 'U', labelTh: 'พิเศษ', labelEn: 'Unique', color: '#b91c1c', bg: '#ef4444', border: '#dc2626', softBg: '#fee2e2' },
    epic:   { id: 'epic',   code: 'E', labelTh: 'ตำนาน', labelEn: 'Epic',   color: '#6d28d9', bg: '#a855f7', border: '#7c3aed', softBg: '#f3e8ff' }
  };

  const ITEM_STATUS_BADGES = {
    perm:    { id: 'perm',    labelTh: 'ถาวร',    labelEn: 'Permanent', bg: '#16a34a', color: '#ffffff' },
    rent:    { id: 'rent',    labelTh: 'เช่า 7วัน', labelEn: 'Rental',    bg: '#f59e0b', color: '#ffffff' },
    expired: { id: 'expired', labelTh: 'หมดอายุ',  labelEn: 'Expired',   bg: '#dc2626', color: '#ffffff' },
    event:   { id: 'event',   labelTh: 'ลิมิเต็ด',  labelEn: 'Limited',   bg: '#9333ea', color: '#ffffff' }
  };

  // --------------------------------------------------------------------------
  // 10 ICONIC HEROES (Every hero has unique stats, visual palette, normal/heavy/
  // dash/jump attacks, and 4 modular gear pieces with distinct skills)
  // --------------------------------------------------------------------------
  const HEROES = {
    knight: {
      id: 'knight',
      index: 1,
      nameTh: 'อัศวินเกราะเหล็ก',
      nameEn: 'Iron Knight',
      roleTh: 'ประชิด / แทงค์ & ผลักตกเหว',
      roleEn: 'Melee / Tank',
      color: '#3b82f6',
      accentColor: '#fbbf24',
      skinColor: '#fcd34d',
      speed: 5.4,
      jumpForce: 11.2,
      maxHp: 125,
      attackType: 'melee',
      weaponType: 'broadsword',
      mobility: {
        nameTh: 'พุ่งเกราะเหล็ก (Armored Sprint) + กระโดดเสริม 2 ชั้น',
        type: 'armored_sprint',
        maxJumps: 2,
        canAirDash: false,
        canFly: false,
        canRoll: false,
        dashSpeedMult: 1.55,
        dashCost: 22,
        airJumpCost: 30,
        gaugeRegen: 32
      },
      descTh: 'อัศวินเกราะหนักผู้เชี่ยวชาญการตั้งโล่สะท้อน วิ่งพุ่งชนต้านทานการชะงัก และคลื่นดาบศักดิ์สิทธิ์',
      basicAttack: {
        damage: 11,
        range: 2.3,
        cooldown: 280,
        knockback: 3.5,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'กระแทกโล่ (Shield Bash)',
        damage: 18,
        range: 2.5,
        knockback: 7.5,
        stunMs: 1100,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'knight_weapon',
          aimRange: 14.4,
          heroId: 'knight',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          otg: true,
          nameTh: 'คลื่นดาบเอ็กซ์คาลิเบอร์',
          nameEn: 'Excalibur Wave',
          descTh: 'ฟาดคลื่นดาบแสงสีทองขนาดใหญ่ ทะลวงและงัดศัตรูลอยขึ้นฟ้า',
          cooldownMs: 7000,
          color: '#fbbf24'
        },
        armor: {
          id: 'knight_armor',
          aimRange: 3.8,
          heroId: 'knight',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'ปราการศักดิ์สิทธิ์',
          nameEn: 'Aegis Fortress',
          descTh: 'ระเบิดพลังโล่ผลักศัตรูรอบตัว และได้รับ Super Armor ลดดาเมจ 50% นาน 5 วินาที',
          cooldownMs: 10000,
          color: '#60a5fa',
          usableWhileHit: true
        },
        helmet: {
          id: 'knight_helmet',
          aimRange: 4.3,
          heroId: 'knight',
          slot: 'helmet',
          conditions: ['ground'],
          nameTh: 'คำรามราชสีห์',
          nameEn: 'Lionheart Warcry',
          descTh: 'คำรามสตั๊นศัตรูรอบข้าง 1.8 วินาที พร้อมฟื้นฟูเลือด 20 HP',
          cooldownMs: 9000,
          color: '#f59e0b'
        },
        trinket: {
          id: 'knight_trinket',
          aimRange: 6,
          heroId: 'knight',
          slot: 'trinket',
          conditions: ['ground'],
          nameTh: 'พุ่งชนโล่ราชรถ',
          nameEn: 'Chariot Rush',
          descTh: 'ยกโล่พุ่งชนความเร็วสูง ลากศัตรูที่ขวางทางไปจนสุดขอบสนาม',
          cooldownMs: 8000,
          color: '#38bdf8'
        }
      }
    },

    ninja: {
      id: 'ninja',
      index: 2,
      nameTh: 'นินจาเงา',
      nameEn: 'Shadow Ninja',
      roleTh: 'ประชิด / ความเร็วสูง & ลอบสังหาร',
      roleEn: 'Melee / Speed Assassin',
      color: '#6366f1',
      accentColor: '#a855f7',
      skinColor: '#fde68a',
      speed: 7.0,
      jumpForce: 12.6,
      maxHp: 95,
      attackType: 'melee',
      weaponType: 'dual_kunai',
      mobility: {
        nameTh: 'กระโดด 3 ชั้น (Triple Jump) + พุ่งกลางอากาศ (Air Dash)',
        type: 'triple_jump_airdash',
        maxJumps: 3,
        canAirDash: true,
        canFly: false,
        canRoll: true,
        dashSpeedMult: 1.75,
        dashCost: 20,
        airJumpCost: 20,
        gaugeRegen: 38
      },
      descTh: 'นินจาความเร็วสูง กระโดดกลางอากาศได้ 3 ชั้น พุ่งตัวกลางอากาศ (Air Dash) คอมโบมีดสั้น และวาปฟันหลัง',
      basicAttack: {
        damage: 8,
        range: 2.0,
        cooldown: 190,
        knockback: 2.4,
        comboHits: 4
      },
      heavyAttack: {
        nameTh: 'ก้าวพริบตาแทงหลัง (Shadow Backstab)',
        damage: 16,
        range: 5.5,
        knockback: 5.0,
        launchY: 9.0,
        stunMs: 800,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'ninja_weapon',
          aimRange: 6.1,
          heroId: 'ninja',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'พายุเพลงดาบเงา',
          nameEn: 'Izuna Blade Storm',
          descTh: 'พุ่งฟันเงาความเร็วสูง 6 ฮิตซ้อน แล้วเสยศัตรูลอยขึ้นกลางอากาศ',
          cooldownMs: 7500,
          color: '#a855f7'
        },
        armor: {
          id: 'ninja_armor',
          aimRange: 3.5,
          heroId: 'ninja',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'ระเบิดควันพรางตัว',
          nameEn: 'Smoke Bomb Stealth',
          descTh: 'กดใช้ตอนโดนตีได้! ปาระเบิดควันสตั๊นรอบตัวแล้วหายตัวเพิ่มความเร็ว 4 วินาที',
          cooldownMs: 10500,
          color: '#8b5cf6',
          usableWhileHit: true
        },
        helmet: {
          id: 'ninja_helmet',
          aimRange: 13.5,
          heroId: 'ninja',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'ดาวกระจายยักษ์ 5 แฉก',
          nameEn: 'Fuuma Shuriken Fan',
          descTh: 'ซัดดาวกระจายยักษ์ 5 อันเป็นพัด ทะลวงและผลักศัตรูระยะไกล',
          cooldownMs: 6000,
          color: '#c084fc'
        },
        trinket: {
          id: 'ninja_trinket',
          aimRange: 3.4,
          heroId: 'ninja',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          mobilityGrant: { canAirDash: true, canRoll: true, minJumps: 2 },
          nameTh: 'คาถาสลับร่างขอนไม้ระเบิด',
          nameEn: 'Explosive Substitution',
          descTh: 'วางหุ่นฟางระเบิดไว้กับพื้นพร้อมตีลังกากระโดดถอยหลังกลางอากาศ',
          cooldownMs: 7000,
          color: '#f43f5e'
        }
      }
    },

    mage: {
      id: 'mage',
      index: 3,
      nameTh: 'จอมเวทย์อัคคี',
      nameEn: 'Fire Archmage',
      roleTh: 'เวทมนตร์ / ระเบิดพื้นที่ AoE',
      roleEn: 'Magic / AoE Burst',
      color: '#ef4444',
      accentColor: '#f97316',
      skinColor: '#fde68a',
      speed: 5.1,
      jumpForce: 11.4,
      maxHp: 95,
      attackType: 'ranged',
      weaponType: 'fire_staff',
      mobility: {
        nameTh: 'ลอยตัวเวทย์เพลิง (Flame Hover Fly) + พริบตาเพลิงสั้น',
        type: 'hover_fly',
        maxJumps: 2,
        canAirDash: true,
        canFly: true,
        canRoll: true,
        flyDrainPerSec: 28,
        dashSpeedMult: 1.6,
        dashCost: 25,
        airJumpCost: 20,
        gaugeRegen: 34
      },
      descTh: 'จอมเวทย์เพลิง ลอยตัวร่ายเวทย์กลางอากาศด้วยเกจพลังไฟ เรียกอุกกาบาตยักษ์ถล่มสนาม และวาประเบิดไฟ',
      basicAttack: {
        damage: 10,
        range: 7.5,
        cooldown: 340,
        knockback: 3.0,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'เสาเพลิงมังกร (Dragon Pillar)',
        damage: 20,
        range: 5.0,
        knockback: 6.8,
        launchY: 9.0,
        stunMs: 700,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'mage_weapon',
          aimRange: 9.5,
          heroId: 'mage',
          slot: 'weapon',
          conditions: ['ground'],
          otg: true,
          nameTh: 'มหาอุกกาบาตล้างผลาญ',
          nameEn: 'Meteor Apocalypse',
          descTh: 'เรียกอุกกาบาตเพลิงยักษ์ตกใส่พื้นที่ด้านหน้า ระเบิดศัตรูลอยฟ้าและทิ้งบ่อลาวา',
          cooldownMs: 9000,
          color: '#ef4444'
        },
        armor: {
          id: 'mage_armor',
          aimRange: 4.4,
          heroId: 'mage',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'วงแหวนเพลิงกัลป์',
          nameEn: 'Supernova Ring',
          descTh: 'กดใช้ขณะถูกโจมตีได้! ระเบิดคลื่นไฟ 360 องศาซัดศัตรูกระเด็นและติดสถานะเผาไหม้',
          cooldownMs: 9500,
          color: '#f97316',
          usableWhileHit: true
        },
        helmet: {
          id: 'mage_helmet',
          aimRange: 2.7,
          heroId: 'mage',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'ลูกแก้วสุริยะพิทักษ์',
          nameEn: 'Solar Orbit Spheres',
          descTh: 'เสกลูกไฟ 4 ดวงหมุนรอบตัวนาน 6 วินาที เผาและกระแทกศัตรูที่เข้าใกล้',
          cooldownMs: 8500,
          color: '#fb923c'
        },
        trinket: {
          id: 'mage_trinket',
          aimRange: 8.8,
          homingIndicator: true,
          heroId: 'mage',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          mobilityGrant: { canFly: true, flyDrainPerSec: 28 },
          nameTh: 'พริบตาเพลิงมิติ',
          nameEn: 'Flame Blink Warp',
          descTh: 'เทเลพอร์ตไปข้างหน้าในพริบตา พร้อมระเบิดเพลิงทั้งจุดเริ่มต้นและจุดหมาย',
          cooldownMs: 6500,
          color: '#facc15'
        }
      }
    },

    cowboy: {
      id: 'cowboy',
      index: 4,
      nameTh: 'คาวบอยปืนคู่',
      nameEn: 'Desperado Cowboy',
      roleTh: 'ระยะไกล / ปืนคู่ & บ่วงบาศดึงศัตรู',
      roleEn: 'Ranged / Gunslinger',
      color: '#d97706',
      accentColor: '#fcd34d',
      skinColor: '#fed7aa',
      speed: 5.8,
      jumpForce: 11.5,
      maxHp: 100,
      attackType: 'ranged',
      weaponType: 'dual_revolvers',
      mobility: {
        nameTh: 'กระโดด 2 ชั้น (Double Jump) + กลิ้งหลบแดช (Tumble Dash)',
        type: 'double_jump_tumble',
        maxJumps: 2,
        canAirDash: false,
        canFly: false,
        canRoll: true,
        dashSpeedMult: 1.7,
        dashCost: 22,
        airJumpCost: 25,
        gaugeRegen: 35
      },
      descTh: 'มือปืนแดนเถื่อน กระโดด 2 ชั้น กลิ้งหลบความเร็วสูง ยิงปืนลูกโม่คู่ ปาระเบิดไดนาไมต์ และใช้เชือกคล้องดึงศัตรู',
      basicAttack: {
        damage: 8,
        range: 8.8,
        cooldown: 230,
        knockback: 2.8,
        comboHits: 4
      },
      heavyAttack: {
        nameTh: 'กระสุนแม็กนั่มเดดอาย (Deadeye Magnum)',
        damage: 19,
        range: 10.5,
        knockback: 8.5,
        stunMs: 900,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'cowboy_weapon',
          aimRange: 13,
          heroId: 'cowboy',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'พายุกระสุนเที่ยงตรง',
          nameEn: 'High Noon Barrage',
          descTh: 'หมุนตัวยิงกราด 360 องศาอย่างรวดเร็ว ปิดท้ายด้วยกระสุนทองคำระเบิด',
          cooldownMs: 8000,
          color: '#fbbf24'
        },
        armor: {
          id: 'cowboy_armor',
          aimRange: 8.5,
          heroId: 'cowboy',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          otg: true,
          usableWhileHit: true,
          nameTh: 'ระเบิดไดนาไมต์ TNT',
          nameEn: 'TNT Dynamite Toss',
          descTh: 'โยนมัดระเบิดไดนาไมต์วิถีโค้ง ระเบิดรุนแรงงัดศัตรูลอยสูงขึ้นฟ้า',
          cooldownMs: 7500,
          color: '#ef4444'
        },
        helmet: {
          id: 'cowboy_helmet',
          aimRange: 14.4,
          heroId: 'cowboy',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'กลิ้งหลบยิงแฟลช',
          nameEn: 'Tactical Roll & Stun Shot',
          descTh: 'กลิ้งหลบการโจมตีพร้อมยิงกระสุนแฟลชสตั๊นศัตรูที่อยู่ใกล้ที่สุดทันที',
          cooldownMs: 6000,
          color: '#fde047'
        },
        trinket: {
          id: 'cowboy_trinket',
          aimRange: 8.5,
          homingIndicator: true,
          heroId: 'cowboy',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          mobilityGrant: { canRoll: true },
          nameTh: 'บ่วงบาศเชือกคล้อง',
          nameEn: 'Bounty Hunter Lasso',
          descTh: 'เหวี่ยงบ่วงเชือกคาวบอยคล้องศัตรูระยะไกลแล้วกระชากดึงเข้ามาหาตัว!',
          cooldownMs: 8000,
          color: '#d97706'
        }
      }
    },

    samurai: {
      id: 'samurai',
      index: 5,
      nameTh: 'ซามูไร',
      nameEn: 'Samurai',
      roleTh: 'ประชิด / ดาบอิไอความเร็วสูง & คอมโบกลางอากาศ',
      roleEn: 'Melee / High-Speed Iaido',
      color: '#1e293b',
      accentColor: '#ef4444',
      skinColor: '#fcd34d',
      speed: 6.6,
      jumpForce: 12.2,
      maxHp: 110,
      attackType: 'melee',
      weaponType: 'katana',
      mobility: {
        nameTh: 'กระโดด 2 ชั้น (Double Jump) + ก้าวพริบตาอิไอ (Flash Dash)',
        type: 'flash_step',
        maxJumps: 2,
        canAirDash: true,
        canFly: false,
        canRoll: true,
        dashSpeedMult: 1.85,
        dashCost: 22,
        airJumpCost: 22,
        gaugeRegen: 36
      },
      descTh: 'ซามูไร กระโดด 2 ชั้น พุ่งก้าวพริบตากลางอากาศ ฟันอิไอความเร็วแสง งัดลอยต่อคอมโบ และตั้งท่าสวนกลับ',
      basicAttack: {
        damage: 11,
        range: 2.6,
        cooldown: 210,
        knockback: 3.2,
        comboHits: 4
      },
      heavyAttack: {
        nameTh: 'เพลงดาบอิไอผ่าพริบตา (Iaido Flash)',
        damage: 19,
        range: 5.5,
        knockback: 5.5,
        launchY: 9.2,
        stunMs: 1000,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'samurai_weapon',
          aimRange: 6.8,
          heroId: 'samurai',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'ระบำซากุระพันกลีบ',
          nameEn: 'Senbonzakura Storm',
          descTh: 'ปลดปล่อยพายุคมดาบสีชาดด้านหน้า ฟันรัว 8 ฮิตและงัดศัตรูลอยขึ้นฟ้า',
          cooldownMs: 7000,
          color: '#ef4444'
        },
        armor: {
          id: 'samurai_armor',
          aimRange: 4.4,
          heroId: 'samurai',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'เนตรแห่งใจสวนกลับ',
          nameEn: 'Minds Eye Counter',
          descTh: 'กดใช้ตอนโดนตีได้! วาปฟันคลื่นดาบสีชาดรอบทิศทาง สตั๊นและงัดศัตรูขึ้นฟ้า',
          cooldownMs: 8500,
          color: '#f43f5e',
          usableWhileHit: true
        },
        helmet: {
          id: 'samurai_helmet',
          type: 'buff',
          heroId: 'samurai',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'จิตอสูรดาบโลหิต',
          nameEn: 'Asura Blood Aura',
          descTh: 'ปลุกออร่าดาบอสูร 6 วินาที เพิ่มพลังโจมตี 40% ความเร็ว 30% และฟันปกติมีคลื่นดาบ',
          cooldownMs: 9500,
          color: '#dc2626'
        },
        trinket: {
          id: 'samurai_trinket',
          aimRange: 5,
          heroId: 'samurai',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          otg: true,
          mobilityGrant: { canAirDash: true, canRoll: true },
          nameTh: 'นางแอ่นหวนกลับ (Tsubame)',
          nameEn: 'Tsubame Gaeshi',
          descTh: 'ฟันเสยมังกรทะยานฟ้าส่งศัตรูลอยขึ้นกลางอากาศพร้อมกระโดดตามไปฟันซ้ำ',
          cooldownMs: 6500,
          color: '#fb7185'
        }
      }
    },

    witch: {
      id: 'witch',
      index: 6,
      nameTh: 'แม่มดน้ำแข็ง',
      nameEn: 'Frost Ice Witch',
      roleTh: 'เวทมนตร์ / แช่แข็ง & ควบคุมสนาม',
      roleEn: 'Magic / Crowd Control',
      color: '#06b6d4',
      accentColor: '#67e8f9',
      skinColor: '#f8fafc',
      speed: 5.3,
      jumpForce: 11.6,
      maxHp: 95,
      attackType: 'ranged',
      weaponType: 'ice_wand',
      mobility: {
        nameTh: 'ร่อนเวทย์น้ำแข็ง (Frost Glide Fly) + สเก็ตแดช',
        type: 'frost_glide',
        maxJumps: 2,
        canAirDash: true,
        canFly: true,
        canRoll: true,
        flyDrainPerSec: 25,
        dashSpeedMult: 1.75,
        dashCost: 20,
        airJumpCost: 18,
        gaugeRegen: 35
      },
      descTh: 'ราชินีหิมะ ร่อนลอยตัวกลางอากาศด้วยเกจเวทย์น้ำแข็ง ไถลสเก็ตความเร็วสูง แช่แข็งศัตรู และเสกพายุหิมะ',
      basicAttack: {
        damage: 9,
        range: 7.8,
        cooldown: 310,
        knockback: 2.6,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'ลมหายใจศูนย์องศา (Absolute Zero)',
        damage: 15,
        range: 4.5,
        knockback: 3.0,
        stunMs: 1800,
        freeze: true,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'witch_weapon',
          aimRange: 8.7,
          heroId: 'witch',
          slot: 'weapon',
          conditions: ['ground'],
          nameTh: 'พายุหิมะนิรันดร์',
          nameEn: 'Eternal Blizzard',
          descTh: 'เสกพายุหิมะเยือกแข็งขนาดใหญ่ ลดความเร็ว 70% และแช่แข็งศัตรูทุกคนในพื้นที่',
          cooldownMs: 8500,
          color: '#22d3ee'
        },
        armor: {
          id: 'witch_armor',
          aimRange: 4,
          heroId: 'witch',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'เกราะผลึกน้ำแข็งนิรันดร์',
          nameEn: 'Crystal Ice Tomb',
          descTh: 'กดใช้ขณะถูกตีได้! ห่อหุ้มร่างด้วยคริสตัลอมตะ ฟื้นฟู 25 HP แล้วระเบิดแช่แข็งรอบตัว',
          cooldownMs: 10000,
          color: '#67e8f9',
          usableWhileHit: true
        },
        helmet: {
          id: 'witch_helmet',
          aimRange: 7.5,
          heroId: 'witch',
          slot: 'helmet',
          conditions: ['ground'],
          otg: true,
          nameTh: 'เสาน้ำแข็งทะลวงพิภพ',
          nameEn: 'Glacial Spike Eruption',
          descTh: 'ระเบิดเสาน้ำแข็งยักษ์ 5 ต้นเรียงไปข้างหน้า งัดศัตรูลอยสูงและติดสถานะหนาวเหน็บ',
          cooldownMs: 7000,
          color: '#38bdf8'
        },
        trinket: {
          id: 'witch_trinket',
          aimRange: 5.5,
          heroId: 'witch',
          slot: 'trinket',
          conditions: ['ground'],
          mobilityGrant: { canFly: true, flyDrainPerSec: 25 },
          nameTh: 'สเก็ตน้ำแข็งเยือกแข็ง',
          nameEn: 'Frost Skate Trail',
          descTh: 'ไถลสเก็ตน้ำแข็งความเร็วสูง ทิ้งทางน้ำแข็งที่แช่แข็งศัตรูที่เหยียบทันที',
          cooldownMs: 6500,
          color: '#a5f3fc'
        }
      }
    },

    cyborg: {
      id: 'cyborg',
      index: 7,
      nameTh: 'Cyborg',
      nameEn: 'Cyborg',
      roleTh: 'ระยะไกล / บินลอยตัวยิงเลเซอร์ & มิสไซล์',
      roleEn: 'Ranged / Flying Cyborg',
      color: '#ea580c',
      accentColor: '#38bdf8',
      skinColor: '#f8fafc',
      speed: 5.9,
      jumpForce: 13.0,
      maxHp: 115,
      attackType: 'ranged',
      weaponType: 'plasma_rifle',
      mobility: {
        nameTh: 'โหมดบินไอพ่นอิสระ (Cyborg Jetpack Fly) + บูสต์แดชกลางอากาศ',
        type: 'jetpack_fly',
        maxJumps: 2,
        canAirDash: true,
        canFly: true,
        canRoll: true,
        flyDrainPerSec: 22,
        dashSpeedMult: 1.8,
        dashCost: 20,
        airJumpCost: 15,
        gaugeRegen: 38
      },
      descTh: 'ไซบอร์กหุ่นรบสีแดง-ขาว มีเกจไอพ่นบินลอยตัวอิสระกลางอากาศ พุ่งบูสต์กลางอากาศ ยิงเลเซอร์บีม และมิสไซล์ล็อคเป้า',
      basicAttack: {
        damage: 9,
        range: 9.2,
        cooldown: 230,
        knockback: 3.0,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'ไซบอร์กเลเซอร์บีม (Cyborg Laser Cannon)',
        damage: 21,
        range: 12.0,
        knockback: 8.2,
        stunMs: 850,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'cyborg_weapon',
          aimRange: 9.5,
          heroId: 'cyborg',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'บัสเตอร์บีม (Buster Beam)',
          nameEn: 'Buster Beam',
          descTh: 'ชาร์จยิงลำแสงพลาสม่าสีฟ้าขนาดยักษ์กวาดไปด้านหน้า ทะลวงการ์ดและซัดปลิว',
          cooldownMs: 8000,
          color: '#38bdf8'
        },
        armor: {
          id: 'cyborg_armor',
          aimRange: 4.8,
          heroId: 'cyborg',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'สนามแม่เหล็กแรงโน้มถ่วง',
          nameEn: 'EMP Gravity Field',
          descTh: 'กดใช้ตอนโดนตีได้! สร้างโดมแม่เหล็กดูดศัตรูรอบทิศทางแล้วช็อตไฟฟ้าสตั๊น',
          cooldownMs: 8500,
          color: '#38bdf8',
          usableWhileHit: true
        },
        helmet: {
          id: 'cyborg_helmet',
          aimRange: 12,
          confirmTarget: true,
          homingIndicator: true,
          heroId: 'cyborg',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'มิสไซล์ติดตามเป้าหมาย',
          nameEn: 'Cyborg Homing Missiles',
          descTh: 'กดครั้งแรกเพื่อเล็ง ใช้ลูกศรเปลี่ยนเป้า แล้วกดซ้ำเพื่อยิงมิสไซล์นำวิถี 3 ลูก',
          cooldownMs: 6500,
          color: '#f97316'
        },
        trinket: {
          id: 'cyborg_trinket',
          aimRange: 14,
          homingIndicator: true,
          otg: true,
          gaugeCost: 50,
          repeatMs: 950,
          heroId: 'cyborg',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          mobilityGrant: { canFly: true, canAirDash: true, flyDrainPerSec: 24 },
          nameTh: 'บูสเตอร์บินยิงเลเซอร์ (Flight Assault)',
          nameEn: 'Cyborg Flight Thruster',
          descTh: 'จุดไอพ่นลอยตัวและยิงเลเซอร์เฉียงลงพื้น ใช้เกจ 50% ต่อครั้งและกดซ้ำได้เมื่อมีเกจพอ',
          cooldownMs: 6500,
          color: '#38bdf8'
        }
      }
    },

    viking: {
      id: 'viking',
      index: 8,
      nameTh: 'ไวกิ้งคลั่ง',
      nameEn: 'Viking Berserker',
      roleTh: 'ประชิด / จับทุ่มตกเหว & โหมดคลั่ง',
      roleEn: 'Melee / Brawler & Grappler',
      color: '#ea580c',
      accentColor: '#fb923c',
      skinColor: '#fed7aa',
      speed: 5.5,
      jumpForce: 11.4,
      maxHp: 130,
      attackType: 'melee',
      weaponType: 'twin_axes',
      mobility: {
        nameTh: 'วิ่งคลั่งชนแหลก (Berserk Bull Rush) + กระโดดยักษ์ 2 ชั้น',
        type: 'bull_charge',
        maxJumps: 2,
        canAirDash: false,
        canFly: false,
        canRoll: false,
        dashSpeedMult: 1.65,
        dashCost: 22,
        airJumpCost: 28,
        gaugeRegen: 32
      },
      descTh: 'นักรบไวกิ้งร่างยักษ์ วิ่งพุ่งชนความเร็วสูง กระโดด 2 ชั้น ควงขวานคู่พายุหมุน จับศัตรูเขวี้ยงตกเหว และโหมดคลั่งดูดเลือด',
      basicAttack: {
        damage: 13,
        range: 2.4,
        cooldown: 310,
        knockback: 4.5,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'พายุขวานหมุน (Whirlwind Axe)',
        damage: 20,
        range: 2.9,
        knockback: 8.2,
        launchY: 7.2,
        stunMs: 900,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'viking_weapon',
          aimRange: 7.1,
          heroId: 'viking',
          slot: 'weapon',
          conditions: ['ground'],
          otg: true,
          nameTh: 'ขวานแร็กนาร็อกผ่าปฐพี',
          nameEn: 'Ragnarok Earthshatter',
          descTh: 'กระโดดสับขวานคู่ลงพื้น แผ่นดินแยกซัดศัตรูกระเด็นไกลตกขอบสนาม!',
          cooldownMs: 8000,
          color: '#ea580c'
        },
        armor: {
          id: 'viking_armor',
          type: 'buff',
          aimRange: 3.5,
          heroId: 'viking',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'โหมดคลั่งวัลฮัลลา',
          nameEn: 'Valhalla Berserk',
          descTh: 'ขยายร่างคลั่งนาน 6 วินาที ไม่ชะงัก (Super Armor) วิ่งเร็วขึ้น และโจมตีดูดเลือด',
          cooldownMs: 10500,
          color: '#f97316',
          usableWhileHit: true
        },
        helmet: {
          id: 'viking_helmet',
          aimRange: 3.2,
          homingIndicator: true,
          heroId: 'viking',
          slot: 'helmet',
          conditions: ['ground'],
          nameTh: 'จับทุ่มยักษ์ไวกิ้ง',
          nameEn: 'Colossus Hurl Throw',
          descTh: 'พุ่งคว้าคอศัตรูด้านหน้าแล้วเหวี่ยงขว้างออกไปไกลสุดขอบแมพ!',
          cooldownMs: 7500,
          color: '#fb923c'
        },
        trinket: {
          id: 'viking_trinket',
          aimRange: 8,
          heroId: 'viking',
          slot: 'trinket',
          conditions: ['ground', 'air'],
          nameTh: 'ขวานบินบูมเมอแรง',
          nameEn: 'Boomerang Tomahawk',
          descTh: 'ปาขวานยักษ์หมุนวนไปข้างหน้าแล้วลากศัตรูกลับมาพร้อมขวาน',
          cooldownMs: 6500,
          color: '#fdba74'
        }
      }
    },

    striker: {
      id: 'striker',
      index: 9,
      nameTh: 'ยอดนักสู้มวยไทย',
      nameEn: 'Muay Thai Striker',
      roleTh: 'ประชิด / คอมโบกลางอากาศ & หมัดรัว',
      roleEn: 'Melee / Combo Rushdown',
      color: '#eab308',
      accentColor: '#fef08a',
      skinColor: '#f59e0b',
      speed: 6.7,
      jumpForce: 12.4,
      maxHp: 110,
      attackType: 'melee',
      weaponType: 'gauntlets',
      mobility: {
        nameTh: 'กระโดด 2 ชั้น + ฟุตเวิร์คพุ่งกลางอากาศ (Air Sway Dash)',
        type: 'sway_airdash',
        maxJumps: 2,
        canAirDash: true,
        canFly: false,
        canRoll: true,
        dashSpeedMult: 1.85,
        dashCost: 18,
        airJumpCost: 20,
        gaugeRegen: 40
      },
      descTh: 'แชมเปี้ยนมวยไทย กระโดด 2 ชั้น พุ่งฟุตเวิร์คกลางอากาศไล่ต่อคอมโบ หมัด-เข่า-ศอกความเร็วแสง และงัดศัตรูที่นอนอยู่ลอยขึ้นฟ้า!',
      basicAttack: {
        damage: 9,
        range: 2.1,
        cooldown: 195,
        knockback: 2.5,
        comboHits: 4
      },
      heavyAttack: {
        nameTh: 'อัปเปอร์คัตพยัคฆ์เสยฟ้า (Tiger Uppercut)',
        damage: 17,
        range: 2.3,
        knockback: 4.0,
        launchY: 11.5,
        stunMs: 1100,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'striker_weapon',
          aimRange: 5.6,
          heroId: 'striker',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'หมัดปืนกลอสูร 100 หมัด',
          nameEn: 'Asura Hundred Fists',
          descTh: 'ระดมต่อยและเตะความเร็วแสง ปิดท้ายด้วยหมัดมังกรทองระเบิดร่างศัตรู',
          cooldownMs: 7000,
          color: '#eab308'
        },
        armor: {
          id: 'striker_armor',
          aimRange: 4.7,
          heroId: 'striker',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'โยกหลบสวนหมัดทะลวงไส้',
          nameEn: 'Sway & Liver Blow',
          descTh: 'กดใช้ตอนโดนตีได้! โยกหลบอมตะแล้วสวนหมัดคลื่นกระแทกสตั๊นศัตรู 2 วินาที',
          cooldownMs: 8500,
          color: '#facc15',
          usableWhileHit: true
        },
        helmet: {
          id: 'striker_helmet',
          type: 'passive',
          conditions: ['passive'],
          passive: { moveSpeedMultiplier: 1.12, extraJumps: 1 },
          heroId: 'striker',
          slot: 'helmet',
          nameTh: 'ก้าวพริบตาสายฟ้า',
          nameEn: 'Lightning Footwork',
          descTh: 'ขณะสวมใส่จะวิ่งเร็วขึ้น 12% และกระโดดกลางอากาศเพิ่มได้อีก 1 ครั้ง',
          color: '#fde047'
        },
        trinket: {
          id: 'striker_trinket',
          aimRange: 4,
          heroId: 'striker',
          slot: 'trinket',
          conditions: ['ground'],
          otg: true,
          mobilityGrant: { canAirDash: true, canRoll: true },
          nameTh: 'กระทืบพสุธางัดลอย',
          nameEn: 'Seismic Ground Stomp',
          descTh: 'กระทืบพื้นสร้างคลื่นสั่นสะเทือน งัดศัตรูรอบตัว (รวมถึงที่ล้มอยู่) ให้ลอยขึ้นฟ้า!',
          cooldownMs: 6500,
          color: '#fbbf24'
        }
      }
    },

    reaper: {
      id: 'reaper',
      index: 10,
      nameTh: 'ยมทูตเคียวทมิฬ',
      nameEn: 'Necro Grim Reaper',
      roleTh: 'พิเศษ / ดูดวิญญาณ & ตีเกราะหลุด',
      roleEn: 'Special / Soul Harvester',
      color: '#9333ea',
      accentColor: '#e879f9',
      skinColor: '#e2e8f0',
      speed: 5.9,
      jumpForce: 12.0,
      maxHp: 105,
      attackType: 'melee',
      weaponType: 'scythe',
      mobility: {
        nameTh: 'บินร่อนวิญญาณ (Wraith Float Fly) + แดชเงาทมิฬกลางอากาศ',
        type: 'wraith_fly',
        maxJumps: 2,
        canAirDash: true,
        canFly: true,
        canRoll: true,
        flyDrainPerSec: 25,
        dashSpeedMult: 1.75,
        dashCost: 20,
        airJumpCost: 18,
        gaugeRegen: 36
      },
      descTh: 'ยมทูตแห่งความมืด บินร่อนวิญญาณกลางอากาศ พุ่งแดชเงากลางอากาศ ตวัดเคียวยักษ์ดูดเลือด และตีเกราะศัตรูหลุดง่าย',
      basicAttack: {
        damage: 11,
        range: 2.8,
        cooldown: 270,
        knockback: 3.4,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'เคียวกระชากวิญญาณ (Soul Hook Pull)',
        damage: 16,
        range: 4.8,
        knockback: -4.5, // Negative knockback pulls enemy toward Reaper!
        launchY: 7.5,
        stunMs: 1000,
        guardBreak: true,
        otg: true
      },
      skills: {
        weapon: {
          id: 'reaper_weapon',
          aimRange: 6.2,
          heroId: 'reaper',
          slot: 'weapon',
          conditions: ['ground', 'air'],
          nameTh: 'เคียวมรณะเกี่ยววิญญาณ',
          nameEn: 'Grim Soul Harvest',
          descTh: 'ฟาดเคียววิญญาณยักษ์วงกว้าง ดูดเลือดศัตรูทุกคนที่โดนและมีโอกาสตีเกราะหลุดทันที!',
          cooldownMs: 8500,
          color: '#a855f7'
        },
        armor: {
          id: 'reaper_armor',
          aimRange: 3.6,
          heroId: 'reaper',
          slot: 'armor',
          conditions: ['ground', 'air', 'down'],
          nameTh: 'ร่างหมอกวิญญาณอมตะ',
          nameEn: 'Wraith Mist Form',
          descTh: 'กดใช้ตอนโดนตีได้! กลายเป็นหมอกทมิฬอมตะ 3.5 วินาที ทะลุศัตรูพร้อมดูดพลังชีวิต',
          cooldownMs: 10000,
          color: '#c084fc',
          usableWhileHit: true
        },
        helmet: {
          id: 'reaper_helmet',
          aimRange: 12,
          confirmTarget: true,
          homingIndicator: true,
          heroId: 'reaper',
          slot: 'helmet',
          conditions: ['ground', 'air'],
          nameTh: 'ฝูงกะโหลกอาฆาต',
          nameEn: 'Phantom Skull Swarm',
          descTh: 'กดครั้งแรกเพื่อเล็ง ใช้ลูกศรเปลี่ยนเป้า แล้วกดซ้ำเพื่อปล่อยกะโหลกนำวิถี 3 หัว',
          cooldownMs: 7000,
          color: '#e879f9'
        },
        trinket: {
          id: 'reaper_trinket',
          aimRange: 8.2,
          heroId: 'reaper',
          slot: 'trinket',
          conditions: ['ground'],
          otg: true,
          mobilityGrant: { canFly: true, canAirDash: true, flyDrainPerSec: 26 },
          nameTh: 'โซ่ตรวนขุมนรก',
          nameEn: 'Abyssal Grave Chains',
          descTh: 'เสกโซ่ทมิฬผุดจากพื้นตรึงร่างศัตรูในพื้นที่ ไม่ให้ขยับและสร้างความเสียหายต่อเนื่อง',
          cooldownMs: 7500,
          color: '#d946ef'
        }
      }
    }
  };

  const HERO_LIST = Object.values(HEROES);

  // Assign color-coded rarity tiers, catalog prices, and initial status tags
  // across all 10 heroes and 40 gear pieces (Green/Yellow/Red/Purple badges).
  const HERO_CATALOG_META = {
    knight:  { rarity: 'normal', defaultStatus: 'perm',  shopPrice: 4500 },
    cowboy:  { rarity: 'normal', defaultStatus: 'perm',  shopPrice: 4500 },
    viking:  { rarity: 'normal', defaultStatus: 'rent',  shopPrice: 5200 },
    ninja:   { rarity: 'rare',   defaultStatus: 'perm',  shopPrice: 7500 },
    mage:    { rarity: 'rare',   defaultStatus: 'perm',  shopPrice: 7500 },
    striker: { rarity: 'rare',   defaultStatus: 'rent',  shopPrice: 8200 },
    samurai: { rarity: 'unique', defaultStatus: 'perm',  shopPrice: 11500 },
    witch:   { rarity: 'unique', defaultStatus: 'rent',  shopPrice: 11500 },
    cyborg:  { rarity: 'epic',   defaultStatus: 'perm',  shopPrice: 15000 },
    reaper:  { rarity: 'epic',   defaultStatus: 'event', shopPrice: 15500 }
  };

  const GEAR_STATUS_OVERRIDES = {
    viking_helmet: 'expired',
    witch_trinket: 'expired',
    cowboy_trinket: 'rent',
    ninja_armor: 'rent',
    mage_helmet: 'rent',
    samurai_trinket: 'event',
    cyborg_trinket: 'event',
    reaper_weapon: 'event'
  };

  const GEAR_RARITY_OVERRIDES = {
    knight_weapon: 'rare',
    cowboy_trinket: 'rare',
    viking_weapon: 'rare',
    ninja_weapon: 'unique',
    mage_weapon: 'unique',
    striker_helmet: 'unique',
    samurai_weapon: 'epic',
    witch_weapon: 'epic',
    cyborg_trinket: 'epic',
    reaper_weapon: 'epic'
  };

  // Build lookup dictionary of all 40 skills by skillId
  const SKILLS_BY_ID = {};
  HERO_LIST.forEach(hero => {
    const meta = HERO_CATALOG_META[hero.id] || { rarity: 'normal', defaultStatus: 'perm', shopPrice: 5000 };
    hero.rarity = meta.rarity;
    hero.defaultStatus = meta.defaultStatus;
    hero.shopPrice = meta.shopPrice;
    GEAR_SLOTS.forEach(slot => {
      const sk = hero.skills[slot];
      if (sk) {
        sk.type ??= sk.usableWhileHit ? 'counter' : 'active';
        if (sk.type !== 'passive') {
          sk.gaugeCost ??= 100;
          sk.iframeMs ??= 350;
        }
        sk.conditions ??= (sk.type === 'passive' ? ['passive'] : sk.usableWhileHit ? ['ground', 'air', 'down'] : ['ground', 'air']);
        sk.rarity = GEAR_RARITY_OVERRIDES[sk.id] || meta.rarity;
        sk.defaultStatus = GEAR_STATUS_OVERRIDES[sk.id] || meta.defaultStatus;
        sk.shopPrice = Math.round(meta.shopPrice * (slot === 'weapon' ? 0.55 : 0.4));
        SKILLS_BY_ID[sk.id] = sk;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3D arenas shared by the server simulation and the client.
  // --------------------------------------------------------------------------
  function stairRun(id, { x, z, w, d }, { steps, rise, up, finish }) {
    const alongX = up.endsWith('x');
    const positive = up.startsWith('+');
    const width = alongX ? w / steps : w;
    const depth = alongX ? d : d / steps;
    return Array.from({ length: steps }, (_, i) => {
      const y = rise * (positive ? i + 1 : steps - i) / steps;
      return {
        id: id + '_' + (i + 1), x: x + (alongX ? i * width : 0), z: z + (alongX ? 0 : i * depth),
        w: width, d: depth, y, h: y, stair: up, finish
      };
    });
  }

  const MAPS = {
    sky_temple: {
      id: 'sky_temple',
      nameTh: 'วิหารลอยฟ้า (Sky Sanctuary)',
      nameEn: 'Sky Sanctuary Courtyard',
      descTh: 'ฝึกคอมโบและสวนกลับบนลานศิลาราบ กลางลานมีพื้นที่ถอยตั้งหลัก ส่วนขอบทั้งสี่เปิดให้ผลักคู่ต่อสู้ตกเหว',
      skyTop: '#052e16',
      skyBottom: '#14532d',
      voidType: 'green_matrix',
      voidY: -6.5,
      platforms: [
        { id: 'sanctuary_court', x: -16, z: -16, w: 32, d: 32, y: 0, h: 3.4 }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -9, z: 6.5 }, { x: 9, z: -8.5 }, { x: -9, z: -8.5 }, { x: 9, z: 6.5 },
        { x: 0, z: 10 }, { x: 0, z: -10 }, { x: -10, z: 0 }, { x: 10, z: 0 }
      ]
    },

    lava_citadel: {
      id: 'lava_citadel',
      nameTh: 'ป้อมปราการลาวา (Lava Citadel)',
      nameEn: 'Lava Citadel',
      descTh: 'ข้ามคูลาวาทางสะพานหินฝั่งใต้ หรือวิ่งเข้าแท่นส่งตัวที่ชี้ไปยังเกาะกลาง ถ้าตกลงลาวาจะเสีย 18 HP และเด้งขึ้นให้หนีกลับฝั่งได้หนึ่งครั้ง',
      skyTop: '#302935',
      skyBottom: '#987268',
      voidType: 'lava',
      voidY: -6.5,
      platforms: [
        { id: 'lava_west', x: -30, z: -24, w: 23, d: 41, y: 0, h: 4.6 },
        { id: 'lava_west_apron', x: -24, z: 17, w: 17, d: 9, y: 0, h: 4.6 },
        { id: 'lava_east', x: 8, z: -15, w: 22, d: 41, y: 0, h: 4.6 },
        { id: 'lava_east_apron', x: 8, z: -26, w: 16, d: 11, y: 0, h: 4.6 },
        { id: 'lava_bridge', x: -7, z: 8, w: 15, d: 6, y: 0, h: 0.7, finish: 'archstone' },
        { id: 'lava_altar', x: -3.5, z: -8, w: 8, d: 8, y: 1.2, h: 4.8, finish: 'cinder' }
      ],
      lava: { x: -7, z: -26, w: 15, d: 52, y: -2.2, damage: 18, boostY: 14.8 },
      pillars: [
        { x: -27, z: -20, r: 0.6, y: 0, h: 1.25 }, { x: 21, z: -23, r: 0.6, y: 0, h: 1.25 },
        { x: -21, z: 23, r: 0.6, y: 0, h: 1.25 }, { x: 27, z: 23, r: 0.6, y: 0, h: 1.25 }
      ],
      jumpPads: [
        { x: -8.5, z: -4, r: 0.95, boostY: 19.1, directionX: 1 },
        { x: 9.5, z: -4, r: 0.95, boostY: 19.1, directionX: -1 }
      ],
      spawns: [
        { x: -16, z: 7 }, { x: 17, z: 7 }, { x: -23, z: -10 }, { x: 23, z: -10 },
        { x: -17, z: 19 }, { x: 18, z: 19 }, { x: -15, z: -13 }, { x: 16, z: -13 }
      ]
    },

    cyber_rooftop: {
      id: 'cyber_rooftop',
      nameTh: 'ดาดฟ้าไซเบอร์ (Cyber Rooftops)',
      nameEn: 'Cyber Rooftops',
      descTh: 'เดินข้ามสะพานเยื้องสองช่วงผ่านตึกกลาง หรือขึ้นบันไดไปทางซ่อมบำรุงแล้วกระโดดข้ามช่อง 3 หน่วย ระวังโดนผลักตรงรอยต่อระหว่างตึก',
      skyTop: '#20334f',
      skyBottom: '#829aaa',
      voidType: 'neon_city',
      voidY: -6.5,
      platforms: [
        { id: 'cyber_west', x: -34, z: -25, w: 21, d: 45, y: 0, h: 16 },
        { id: 'cyber_east', x: 12, z: -20, w: 22, d: 45, y: 0, h: 16 },
        { id: 'cyber_center', x: -7, z: -8, w: 14, d: 19, y: 0, h: 13 },
        { id: 'cyber_west_bridge', x: -13, z: -2, w: 6, d: 6, y: 0, h: 0.72, finish: 'catwalk' },
        { id: 'cyber_east_bridge', x: 7, z: 4, w: 5, d: 6, y: 0, h: 0.72, finish: 'catwalk' },
        { id: 'cyber_west_gantry', x: -17, z: -17, w: 12, d: 6, y: 1.4, h: 0.45, finish: 'catwalk' },
        { id: 'cyber_east_gantry', x: -2, z: -17, w: 18, d: 6, y: 1.4, h: 0.45, finish: 'catwalk' },
        ...stairRun('cyber_west_tread', { x: -23, z: -16, w: 6, d: 4 }, { steps: 5, rise: 1.4, up: '+x', finish: 'catwalk' }),
        ...stairRun('cyber_east_tread', { x: 16, z: -16, w: 6, d: 4 }, { steps: 5, rise: 1.4, up: '-x', finish: 'catwalk' })
      ],
      pillars: [
        { x: -32, z: -23, r: 0.3, y: 0, h: 2.05 }, { x: 32, z: 23, r: 0.3, y: 0, h: 2.05 },
        { x: -32, z: 18, r: 0.3, y: 0, h: 2.05 }, { x: 32, z: -18, r: 0.3, y: 0, h: 2.05 }
      ],
      jumpPads: [],
      spawns: [
        { x: -21, z: 2 }, { x: 21, z: 6 }, { x: -27, z: -12 }, { x: 25, z: -8 },
        { x: -27, z: 12 }, { x: 27, z: 15 }, { x: -16, z: 6 }, { x: 16, z: 1 }
      ]
    },

    tideglass_harbor: {
      id: 'tideglass_harbor',
      nameTh: 'ท่าเรือคลื่นคราม (Tideglass Harbor)',
      nameEn: 'Tideglass Harbor',
      descTh: 'เดินข้ามแอ่งน้ำทางซ้ายหรือสะพานเยื้องกลาง ท่าฝั่งขวามีช่องกระโดด 2 หน่วย สายพานบนท่าใต้พาไปถึงขอบทะเลทางตะวันออก',
      skyTop: '#668b9b',
      skyBottom: '#d9d5bb',
      voidType: 'sea',
      voidY: -5,
      platforms: [
        { id: 'harbor_south_quay', x: -36, z: 8, w: 72, d: 17, y: 0, h: 1.2 },
        { id: 'harbor_north_quay', x: -29, z: -25, w: 59, d: 16, y: 0, h: 1.2 },
        { id: 'harbor_west_pier', x: -28, z: -9, w: 10, d: 17, y: 0, h: 1, course: 'z', finish: 'pier' },
        { id: 'harbor_center_south', x: -3, z: -3, w: 12, d: 11, y: 0, h: 1, course: 'z', finish: 'pier' },
        { id: 'harbor_center_north', x: 4, z: -9, w: 9, d: 6, y: 0, h: 1, course: 'z', finish: 'pier' },
        { id: 'harbor_landing', x: 20, z: -3, w: 14, d: 9, y: 0, h: 1.1, finish: 'pier' },
        { id: 'harbor_east_gangway', x: 23, z: -9, w: 5, d: 6, y: 0, h: 0.9, course: 'z', finish: 'pier' }
      ],
      conveyor: { x: -13, z: 14, w: 49, d: 4, y: 0, speedX: 2.8 },
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -12, z: -16 }, { x: 10, z: 11 }, { x: -22, z: -14 }, { x: -18, z: 17 },
        { x: 8, z: -15 }, { x: 22, z: 21 }, { x: 23, z: -17 }, { x: -27, z: 20 }
      ]
    },

    brasswind_courier: {
      id: 'brasswind_courier',
      nameTh: 'เรือเหาะทองเหลือง (Brasswind Courier)',
      nameEn: 'Brasswind Courier',
      descTh: 'เดินเลียบกราบเข้าท้ายลานหรือใช้บันได 8 ขั้นขึ้นไปยิงจากหัวเรือ แท่นส่งตัวด้านข้างเป็นทางบุกขึ้นประชิด ชานริมกราบสองฝั่งใช้ถอยตั้งหลักได้',
      skyTop: '#728aa9',
      skyBottom: '#ecdbc3',
      voidType: 'clouds',
      voidY: -6.5,
      platforms: [
        { id: 'courier_deck', x: -35, z: -12, w: 70, d: 24, y: 0, h: 1.8 },
        { id: 'courier_port_bay', x: -22, z: -20, w: 24, d: 8, y: 0, h: 1.3, finish: 'courier_wing' },
        { id: 'courier_starboard_bay', x: -3, z: 12, w: 22, d: 8, y: 0, h: 1.3, finish: 'courier_wing' },
        ...stairRun('courier_tread', { x: 8, z: -2.5, w: 10, d: 5 }, { steps: 8, rise: 1.6, up: '+x', finish: 'forecastle' }),
        { id: 'courier_forecastle', x: 18, z: -7, w: 13, d: 14, y: 1.6, h: 1.6, finish: 'forecastle' }
      ],
      pillars: [],
      jumpPads: [
        { x: 14, z: -6, r: 0.95, boostY: 17.6, directionX: 1 }
      ],
      spawns: [
        { x: -22, z: 1 }, { x: 22, z: 9 }, { x: -16, z: -15 }, { x: 11, z: 16 },
        { x: -13, z: 7 }, { x: 6, z: -8 }, { x: -6, z: -9 }, { x: 3, z: 8 }
      ]
    },

    mossgate_ruins: {
      id: 'mossgate_ruins',
      nameTh: 'ซากวิหารมอสส์ (Mossgate Ruins)',
      nameEn: 'Mossgate Ruins',
      descTh: 'สองสะพานเยื้องพาเข้าวงฟื้นพลัง 6 HP ต่อวินาทีเมื่อคุมพื้นที่ได้ ระเบียงหินด้านเหนือมีบันไดขึ้นลงสองปลายสำหรับอ้อมเข้าลานอีกฝั่ง',
      skyTop: '#587768',
      skyBottom: '#ced1ad',
      voidType: 'forest',
      voidY: -6.5,
      platforms: [
        { id: 'mossgate_court', x: -11, z: -12, w: 21, d: 24, y: 0, h: 4.1 },
        { id: 'mossgate_west', x: -34, z: -28, w: 19, d: 42, y: 0, h: 4 },
        { id: 'mossgate_east', x: 14, z: -13, w: 20, d: 41, y: 0, h: 4 },
        { id: 'mossgate_west_arch', x: -15, z: -4, w: 4, d: 8, y: 0, h: 1.15, finish: 'ruin_walk' },
        { id: 'mossgate_east_arch', x: 10, z: 4, w: 4, d: 7, y: 0, h: 1.15, finish: 'ruin_walk' },
        { id: 'mossgate_terrace', x: -15, z: -25, w: 29, d: 7, y: 1.35, h: 1.1, finish: 'ruin_walk' },
        { id: 'mossgate_terrace_corner', x: 14, z: -20, w: 5, d: 2, y: 1.35, h: 1.1, finish: 'ruin_walk' },
        { id: 'mossgate_terrace_end', x: 11, z: -18, w: 8, d: 5, y: 1.35, h: 1.1, finish: 'ruin_walk' },
        ...stairRun('mossgate_west_tread', { x: -20, z: -24, w: 5, d: 5 }, { steps: 5, rise: 1.35, up: '+x', finish: 'ruin_walk' }),
        ...stairRun('mossgate_east_tread', { x: 14, z: -13, w: 5, d: 5 }, { steps: 5, rise: 1.35, up: '-z', finish: 'ruin_walk' })
      ],
      shrine: { x: 0, z: 0, y: 0, r: 4, heal: 6, periodMs: 1000 },
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -22, z: -4 }, { x: 23, z: 9 }, { x: -26, z: 8 }, { x: 28, z: -4 },
        { x: -26, z: -18 }, { x: 22, z: 20 }, { x: -19, z: 5 }, { x: 18, z: 15 }
      ]
    },

    frostline_pass: {
      id: 'frostline_pass',
      nameTh: 'ช่องเขาเหมันต์ (Frostline Pass)',
      nameEn: 'Frostline Pass',
      descTh: 'ทางน้ำแข็งกลางเขาไถลไกล ทางหิมะด้านซ้ายเดินอ้อมเหวและหยุดได้ง่ายกว่า ส่วนฝั่งขวาต้องกระโดดข้ามชานผาทีละช่วง',
      skyTop: '#6e89a4',
      skyBottom: '#d7e3e6',
      voidType: 'snow',
      voidY: -6.5,
      platforms: [
        { id: 'frostline_north', x: -32, z: -28, w: 56, d: 16, y: 0, h: 4.1 },
        { id: 'frostline_south', x: -22, z: 12, w: 54, d: 16, y: 0, h: 4.1 },
        { id: 'frostline_passage', x: 3, z: -12, w: 10, d: 24, y: 0, h: 2.7, finish: 'ice' },
        { id: 'frostline_shelf', x: -28, z: -12, w: 8, d: 18, y: 0, h: 3.3, finish: 'packed_snow' },
        { id: 'frostline_bend', x: -28, z: 6, w: 16, d: 6, y: 0, h: 3.3, finish: 'packed_snow' },
        { id: 'frostline_north_ledge', x: 16, z: -8, w: 8, d: 7, y: 0, h: 3, finish: 'packed_snow' },
        { id: 'frostline_south_ledge', x: 19, z: 2, w: 8, d: 7, y: 0, h: 3, finish: 'packed_snow' }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: 7, z: -20 }, { x: 8, z: 20 }, { x: -22, z: -21 }, { x: -15, z: 22 },
        { x: 17, z: -22 }, { x: 23, z: 21 }, { x: -7, z: -17 }, { x: -4, z: 17 }
      ]
    }
  };

  return {
    RANGED_AIM_HOLD_MS: 220,
    MELEE_CHARGE_HOLD_MS: 380,
    RANGED_CHARGE_HOLD_MS: 520,
    SKILL_IFRAME_MS: 350,
    SWAP_COOLDOWN_MS: 1000,
    GEAR_SLOTS,
    GEAR_SLOT_LABELS,
    RARITY_TIERS,
    ITEM_STATUS_BADGES,
    HEROES,
    HERO_LIST,
    SKILLS_BY_ID,
    MAPS
  };
});
