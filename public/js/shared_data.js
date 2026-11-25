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
    weapon: { th: 'อาวุธ (SD/Q)', en: 'Weapon', key: 'Q', combo: 'S+D' },
    armor:  { th: 'ชุดเกราะ (ASD/W)', en: 'Armor',  key: 'W', combo: 'A+S+D' },
    helmet: { th: 'หมวก (AD/E)',   en: 'Helmet', key: 'E', combo: 'A+D' },
    trinket:{ th: 'เครื่องประดับ (AS/R)', en: 'Trinket', key: 'R', combo: 'A+S' }
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
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'knight_weapon',
          heroId: 'knight',
          slot: 'weapon',
          nameTh: 'คลื่นดาบเอ็กซ์คาลิเบอร์',
          nameEn: 'Excalibur Wave',
          descTh: 'ฟาดคลื่นดาบแสงสีทองขนาดใหญ่ ทะลวงและงัดศัตรูลอยขึ้นฟ้า',
          cooldownMs: 7000,
          color: '#fbbf24'
        },
        armor: {
          id: 'knight_armor',
          heroId: 'knight',
          slot: 'armor',
          nameTh: 'ปราการศักดิ์สิทธิ์',
          nameEn: 'Aegis Fortress',
          descTh: 'ระเบิดพลังโล่ผลักศัตรูรอบตัว และได้รับ Super Armor ลดดาเมจ 50% นาน 5 วินาที',
          cooldownMs: 10000,
          color: '#60a5fa',
          usableWhileHit: true
        },
        helmet: {
          id: 'knight_helmet',
          heroId: 'knight',
          slot: 'helmet',
          nameTh: 'คำรามราชสีห์',
          nameEn: 'Lionheart Warcry',
          descTh: 'คำรามสตั๊นศัตรูรอบข้าง 1.8 วินาที พร้อมฟื้นฟูเลือด 20 HP',
          cooldownMs: 9000,
          color: '#f59e0b'
        },
        trinket: {
          id: 'knight_trinket',
          heroId: 'knight',
          slot: 'trinket',
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
        stunMs: 800,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'ninja_weapon',
          heroId: 'ninja',
          slot: 'weapon',
          nameTh: 'พายุเพลงดาบเงา',
          nameEn: 'Izuna Blade Storm',
          descTh: 'พุ่งฟันเงาความเร็วสูง 6 ฮิตซ้อน แล้วเสยศัตรูลอยขึ้นกลางอากาศ',
          cooldownMs: 7500,
          color: '#a855f7'
        },
        armor: {
          id: 'ninja_armor',
          heroId: 'ninja',
          slot: 'armor',
          nameTh: 'ระเบิดควันพรางตัว',
          nameEn: 'Smoke Bomb Stealth',
          descTh: 'กดใช้ตอนโดนตีได้! ปาระเบิดควันสตั๊นรอบตัวแล้วหายตัวเพิ่มความเร็ว 4 วินาที',
          cooldownMs: 10500,
          color: '#8b5cf6',
          usableWhileHit: true
        },
        helmet: {
          id: 'ninja_helmet',
          heroId: 'ninja',
          slot: 'helmet',
          nameTh: 'ดาวกระจายยักษ์ 5 แฉก',
          nameEn: 'Fuuma Shuriken Fan',
          descTh: 'ซัดดาวกระจายยักษ์ 5 อันเป็นพัด ทะลวงและผลักศัตรูระยะไกล',
          cooldownMs: 6000,
          color: '#c084fc'
        },
        trinket: {
          id: 'ninja_trinket',
          heroId: 'ninja',
          slot: 'trinket',
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
        stunMs: 700,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'mage_weapon',
          heroId: 'mage',
          slot: 'weapon',
          nameTh: 'มหาอุกกาบาตล้างผลาญ',
          nameEn: 'Meteor Apocalypse',
          descTh: 'เรียกอุกกาบาตเพลิงยักษ์ตกใส่พื้นที่ด้านหน้า ระเบิดศัตรูลอยฟ้าและทิ้งบ่อลาวา',
          cooldownMs: 9000,
          color: '#ef4444'
        },
        armor: {
          id: 'mage_armor',
          heroId: 'mage',
          slot: 'armor',
          nameTh: 'วงแหวนเพลิงกัลป์',
          nameEn: 'Supernova Ring',
          descTh: 'กดใช้ขณะถูกโจมตีได้! ระเบิดคลื่นไฟ 360 องศาซัดศัตรูกระเด็นและติดสถานะเผาไหม้',
          cooldownMs: 9500,
          color: '#f97316',
          usableWhileHit: true
        },
        helmet: {
          id: 'mage_helmet',
          heroId: 'mage',
          slot: 'helmet',
          nameTh: 'ลูกแก้วสุริยะพิทักษ์',
          nameEn: 'Solar Orbit Spheres',
          descTh: 'เสกลูกไฟ 4 ดวงหมุนรอบตัวนาน 6 วินาที เผาและกระแทกศัตรูที่เข้าใกล้',
          cooldownMs: 8500,
          color: '#fb923c'
        },
        trinket: {
          id: 'mage_trinket',
          heroId: 'mage',
          slot: 'trinket',
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
          heroId: 'cowboy',
          slot: 'weapon',
          nameTh: 'พายุกระสุนเที่ยงตรง',
          nameEn: 'High Noon Barrage',
          descTh: 'หมุนตัวยิงกราด 360 องศาอย่างรวดเร็ว ปิดท้ายด้วยกระสุนทองคำระเบิด',
          cooldownMs: 8000,
          color: '#fbbf24'
        },
        armor: {
          id: 'cowboy_armor',
          heroId: 'cowboy',
          slot: 'armor',
          nameTh: 'ระเบิดไดนาไมต์ TNT',
          nameEn: 'TNT Dynamite Toss',
          descTh: 'โยนมัดระเบิดไดนาไมต์วิถีโค้ง ระเบิดรุนแรงงัดศัตรูลอยสูงขึ้นฟ้า',
          cooldownMs: 7500,
          color: '#ef4444'
        },
        helmet: {
          id: 'cowboy_helmet',
          heroId: 'cowboy',
          slot: 'helmet',
          nameTh: 'กลิ้งหลบยิงแฟลช',
          nameEn: 'Tactical Roll & Stun Shot',
          descTh: 'กลิ้งหลบการโจมตีพร้อมยิงกระสุนแฟลชสตั๊นศัตรูที่อยู่ใกล้ที่สุดทันที',
          cooldownMs: 6000,
          color: '#fde047'
        },
        trinket: {
          id: 'cowboy_trinket',
          heroId: 'cowboy',
          slot: 'trinket',
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
      nameTh: 'ซามูไร อีโว (Samurai EVO)',
      nameEn: 'Samurai EVO',
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
        dashSpeedMult: 1.85,
        dashCost: 22,
        airJumpCost: 22,
        gaugeRegen: 36
      },
      descTh: 'ซามูไรร่างพัฒนา (EVO) กระโดด 2 ชั้น พุ่งก้าวพริบตากลางอากาศ ฟันอิไอความเร็วแสง งัดลอยต่อคอมโบ และตั้งท่าสวนกลับ',
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
        launchY: 8.5,
        stunMs: 1000,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'samurai_weapon',
          heroId: 'samurai',
          slot: 'weapon',
          nameTh: 'ระบำซากุระพันกลีบ (EVO)',
          nameEn: 'Senbonzakura Storm',
          descTh: 'ปลดปล่อยพายุคมดาบสีชาดด้านหน้า ฟันรัว 8 ฮิตและงัดศัตรูลอยขึ้นฟ้า',
          cooldownMs: 7000,
          color: '#ef4444'
        },
        armor: {
          id: 'samurai_armor',
          heroId: 'samurai',
          slot: 'armor',
          nameTh: 'เนตรแห่งใจสวนกลับ',
          nameEn: 'Minds Eye Counter',
          descTh: 'กดใช้ตอนโดนตีได้! วาปฟันคลื่นดาบสีชาดรอบทิศทาง สตั๊นและงัดศัตรูขึ้นฟ้า',
          cooldownMs: 8500,
          color: '#f43f5e',
          usableWhileHit: true
        },
        helmet: {
          id: 'samurai_helmet',
          heroId: 'samurai',
          slot: 'helmet',
          nameTh: 'จิตอสูรดาบโลหิต',
          nameEn: 'Asura Blood Aura',
          descTh: 'ปลุกออร่าดาบอสูร 6 วินาที เพิ่มพลังโจมตี 40% ความเร็ว 30% และฟันปกติมีคลื่นดาบ',
          cooldownMs: 9500,
          color: '#dc2626'
        },
        trinket: {
          id: 'samurai_trinket',
          heroId: 'samurai',
          slot: 'trinket',
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
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'witch_weapon',
          heroId: 'witch',
          slot: 'weapon',
          nameTh: 'พายุหิมะนิรันดร์',
          nameEn: 'Eternal Blizzard',
          descTh: 'เสกพายุหิมะเยือกแข็งขนาดใหญ่ ลดความเร็ว 70% และแช่แข็งศัตรูทุกคนในพื้นที่',
          cooldownMs: 8500,
          color: '#22d3ee'
        },
        armor: {
          id: 'witch_armor',
          heroId: 'witch',
          slot: 'armor',
          nameTh: 'เกราะผลึกน้ำแข็งนิรันดร์',
          nameEn: 'Crystal Ice Tomb',
          descTh: 'กดใช้ขณะถูกตีได้! ห่อหุ้มร่างด้วยคริสตัลอมตะ ฟื้นฟู 25 HP แล้วระเบิดแช่แข็งรอบตัว',
          cooldownMs: 10000,
          color: '#67e8f9',
          usableWhileHit: true
        },
        helmet: {
          id: 'witch_helmet',
          heroId: 'witch',
          slot: 'helmet',
          nameTh: 'เสาน้ำแข็งทะลวงพิภพ',
          nameEn: 'Glacial Spike Eruption',
          descTh: 'ระเบิดเสาน้ำแข็งยักษ์ 5 ต้นเรียงไปข้างหน้า งัดศัตรูลอยสูงและติดสถานะหนาวเหน็บ',
          cooldownMs: 7000,
          color: '#38bdf8'
        },
        trinket: {
          id: 'witch_trinket',
          heroId: 'witch',
          slot: 'trinket',
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
      nameTh: 'กิกะสูท (Giga Suit)',
      nameEn: 'Giga Suit Mecha',
      roleTh: 'ระยะไกล / บินลอยตัวยิงเลเซอร์ & มิสไซล์',
      roleEn: 'Ranged / Flying Mecha',
      color: '#ea580c',
      accentColor: '#38bdf8',
      skinColor: '#f8fafc',
      speed: 5.9,
      jumpForce: 13.0,
      maxHp: 115,
      attackType: 'ranged',
      weaponType: 'plasma_rifle',
      mobility: {
        nameTh: 'โหมดบินไอพ่นอิสระ (Giga Jetpack Fly) + บูสต์แดชกลางอากาศ',
        type: 'jetpack_fly',
        maxJumps: 2,
        canAirDash: true,
        canFly: true,
        flyDrainPerSec: 22,
        dashSpeedMult: 1.8,
        dashCost: 20,
        airJumpCost: 15,
        gaugeRegen: 38
      },
      descTh: 'หุ่นรบกิกะสูทสีแดง-ขาว มีเกจไอพ่นบินลอยตัวอิสระกลางอากาศ พุ่งบูสต์กลางอากาศ ยิงเลเซอร์บีม และมิสไซล์ล็อคเป้า',
      basicAttack: {
        damage: 9,
        range: 9.2,
        cooldown: 230,
        knockback: 3.0,
        comboHits: 3
      },
      heavyAttack: {
        nameTh: 'กิกะเลเซอร์บีม (Giga Laser Cannon)',
        damage: 21,
        range: 12.0,
        knockback: 8.2,
        stunMs: 850,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'cyborg_weapon',
          heroId: 'cyborg',
          slot: 'weapon',
          nameTh: 'กิกะบัสเตอร์บีม (Giga Buster Beam)',
          nameEn: 'Giga Buster Beam',
          descTh: 'ชาร์จยิงลำแสงพลาสม่าสีฟ้าขนาดยักษ์กวาดไปด้านหน้า ทะลวงการ์ดและซัดปลิว',
          cooldownMs: 8000,
          color: '#38bdf8'
        },
        armor: {
          id: 'cyborg_armor',
          heroId: 'cyborg',
          slot: 'armor',
          nameTh: 'สนามแม่เหล็กแรงโน้มถ่วง',
          nameEn: 'EMP Gravity Field',
          descTh: 'กดใช้ตอนโดนตีได้! สร้างโดมแม่เหล็กดูดศัตรูรอบทิศทางแล้วช็อตไฟฟ้าสตั๊น',
          cooldownMs: 8500,
          color: '#38bdf8',
          usableWhileHit: true
        },
        helmet: {
          id: 'cyborg_helmet',
          heroId: 'cyborg',
          slot: 'helmet',
          nameTh: 'มิสไซล์ติดตามเป้าหมาย',
          nameEn: 'Giga Homing Missiles',
          descTh: 'ยิงมิสไซล์นำวิถี 5 ลูก พุ่งเลี้ยวติดตามศัตรูที่อยู่ใกล้ที่สุดอัตโนมัติ',
          cooldownMs: 6500,
          color: '#f97316'
        },
        trinket: {
          id: 'cyborg_trinket',
          heroId: 'cyborg',
          slot: 'trinket',
          nameTh: 'บูสเตอร์บินยิงเลเซอร์ (Flight Assault)',
          nameEn: 'Giga Flight Thruster',
          descTh: 'จุดไอพ่นปีกทะยานลอยค้างกลางอากาศ พร้อมยิงเลเซอร์สีฟ้าเฉียงลงพื้น!',
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
        stunMs: 900,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'viking_weapon',
          heroId: 'viking',
          slot: 'weapon',
          nameTh: 'ขวานแร็กนาร็อกผ่าปฐพี',
          nameEn: 'Ragnarok Earthshatter',
          descTh: 'กระโดดสับขวานคู่ลงพื้น แผ่นดินแยกซัดศัตรูกระเด็นไกลตกขอบสนาม!',
          cooldownMs: 8000,
          color: '#ea580c'
        },
        armor: {
          id: 'viking_armor',
          heroId: 'viking',
          slot: 'armor',
          nameTh: 'โหมดคลั่งวัลฮัลลา',
          nameEn: 'Valhalla Berserk',
          descTh: 'ขยายร่างคลั่งนาน 6 วินาที ไม่ชะงัก (Super Armor) วิ่งเร็วขึ้น และโจมตีดูดเลือด',
          cooldownMs: 10500,
          color: '#f97316',
          usableWhileHit: true
        },
        helmet: {
          id: 'viking_helmet',
          heroId: 'viking',
          slot: 'helmet',
          nameTh: 'จับทุ่มยักษ์ไวกิ้ง',
          nameEn: 'Colossus Hurl Throw',
          descTh: 'พุ่งคว้าคอศัตรูด้านหน้าแล้วเหวี่ยงขว้างออกไปไกลสุดขอบแมพ!',
          cooldownMs: 7500,
          color: '#fb923c'
        },
        trinket: {
          id: 'viking_trinket',
          heroId: 'viking',
          slot: 'trinket',
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
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'striker_weapon',
          heroId: 'striker',
          slot: 'weapon',
          nameTh: 'หมัดปืนกลอสูร 100 หมัด',
          nameEn: 'Asura Hundred Fists',
          descTh: 'ระดมต่อยและเตะความเร็วแสง ปิดท้ายด้วยหมัดมังกรทองระเบิดร่างศัตรู',
          cooldownMs: 7000,
          color: '#eab308'
        },
        armor: {
          id: 'striker_armor',
          heroId: 'striker',
          slot: 'armor',
          nameTh: 'โยกหลบสวนหมัดทะลวงไส้',
          nameEn: 'Sway & Liver Blow',
          descTh: 'กดใช้ตอนโดนตีได้! โยกหลบอมตะแล้วสวนหมัดคลื่นกระแทกสตั๊นศัตรู 2 วินาที',
          cooldownMs: 8500,
          color: '#facc15',
          usableWhileHit: true
        },
        helmet: {
          id: 'striker_helmet',
          heroId: 'striker',
          slot: 'helmet',
          nameTh: 'ก้าวพริบตาสายฟ้า',
          nameEn: 'Lightning Footwork',
          descTh: 'พุ่งตัวความเร็วสูงทิ้งร่างเงาทอง ลดคูลดาวน์สกิลทั้งหมดลง 3 วินาทีทันที',
          cooldownMs: 6500,
          color: '#fde047'
        },
        trinket: {
          id: 'striker_trinket',
          heroId: 'striker',
          slot: 'trinket',
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
        stunMs: 1000,
        guardBreak: true
      },
      skills: {
        weapon: {
          id: 'reaper_weapon',
          heroId: 'reaper',
          slot: 'weapon',
          nameTh: 'เคียวมรณะเกี่ยววิญญาณ',
          nameEn: 'Grim Soul Harvest',
          descTh: 'ฟาดเคียววิญญาณยักษ์วงกว้าง ดูดเลือดศัตรูทุกคนที่โดนและมีโอกาสตีเกราะหลุดทันที!',
          cooldownMs: 8500,
          color: '#a855f7'
        },
        armor: {
          id: 'reaper_armor',
          heroId: 'reaper',
          slot: 'armor',
          nameTh: 'ร่างหมอกวิญญาณอมตะ',
          nameEn: 'Wraith Mist Form',
          descTh: 'กดใช้ตอนโดนตีได้! กลายเป็นหมอกทมิฬอมตะ 3.5 วินาที ทะลุศัตรูพร้อมดูดพลังชีวิต',
          cooldownMs: 10000,
          color: '#c084fc',
          usableWhileHit: true
        },
        helmet: {
          id: 'reaper_helmet',
          heroId: 'reaper',
          slot: 'helmet',
          nameTh: 'ฝูงกะโหลกอาฆาต',
          nameEn: 'Phantom Skull Swarm',
          descTh: 'ปล่อยกะโหลกวิญญาณอาฆาต 3 หัว พุ่งติดตามศัตรูและระเบิดเพลิงทมิฬ',
          cooldownMs: 7000,
          color: '#e879f9'
        },
        trinket: {
          id: 'reaper_trinket',
          heroId: 'reaper',
          slot: 'trinket',
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

  // Build lookup dictionary of all 40 skills by skillId
  const SKILLS_BY_ID = {};
  HERO_LIST.forEach(hero => {
    GEAR_SLOTS.forEach(slot => {
      const sk = hero.skills[slot];
      if (sk) {
        SKILLS_BY_ID[sk.id] = sk;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3D arenas shared by the server simulation and the client.
  // --------------------------------------------------------------------------
  const MAPS = {
    sky_temple: {
      id: 'sky_temple',
      nameTh: 'วิหารลอยฟ้า (Sky Sanctuary)',
      nameEn: 'Sky Sanctuary Courtyard',
      descTh: 'ลานประลองกว้าง มีระเบียงศิลายกสูงตลอดแนวด้านหลังและชานหน้าให้ถอยตั้งหลัก',
      skyTop: '#052e16',
      skyBottom: '#14532d',
      voidType: 'green_matrix',
      voidY: -6.5,
      platforms: [
        { id: 'sanctuary_court', x: -16, z: -13, w: 32, d: 25, y: 0, h: 3.4 },
        { id: 'sanctuary_gallery', x: -13.5, z: -11.5, w: 27, d: 6, y: 1.25, h: 1.25 },
        { id: 'sanctuary_apron', x: -6, z: 12, w: 12, d: 6, y: 0, h: 1.6 }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -9, z: 6.5 }, { x: 9, z: -8.5 }, { x: -9, z: -8.5 }, { x: 9, z: 6.5 },
        { x: 0, z: 14.5 }, { x: 0, z: -8.5 }, { x: -10, z: 0 }, { x: 10, z: 0 }
      ]
    },

    lava_citadel: {
      id: 'lava_citadel',
      nameTh: 'ป้อมปราการลาวา (Lava Citadel)',
      nameEn: 'Lava Citadel',
      descTh: 'ทางเดินหินภูเขาไฟล้อมบ่อลาวา ใช้แท่นกระโดดข้ามไปยังเกาะยกสูงตรงกลาง',
      skyTop: '#362c37',
      skyBottom: '#967169',
      voidType: 'lava',
      voidY: -6.5,
      platforms: [
        { id: 'lava_north', x: -17.5, z: -17.5, w: 35, d: 11, y: 0, h: 3.2 },
        { id: 'lava_west', x: -17.5, z: -6.5, w: 11, d: 13, y: 0, h: 3.2 },
        { id: 'lava_east', x: 6.5, z: -6.5, w: 11, d: 13, y: 0, h: 3.2 },
        { id: 'lava_south', x: -17.5, z: 6.5, w: 35, d: 11, y: 0, h: 3.2 },
        { id: 'lava_altar', x: -4.7, z: -4.7, w: 9.4, d: 9.4, y: 1.5, h: 3.2 }
      ],
      pillars: [],
      jumpPads: [
        { x: -8.2, z: 0, r: 1.15, boostY: 15.5 },
        { x: 8.2, z: 0, r: 1.15, boostY: 15.5 }
      ],
      spawns: [
        { x: -11, z: 11 }, { x: 11, z: -11 }, { x: -11, z: -11 }, { x: 11, z: 11 },
        { x: 0, z: 11 }, { x: 0, z: -11 }, { x: -12.5, z: 0 }, { x: 12.5, z: 0 }
      ]
    },

    cyber_rooftop: {
      id: 'cyber_rooftop',
      nameTh: 'ดาดฟ้าไซเบอร์ (Cyber Rooftops)',
      nameEn: 'Cyber Rooftops',
      descTh: 'ดาดฟ้าสองฝั่งคั่นด้วยช่องเหว มีสะพานกลางและแท่นสูงคนละมุม',
      skyTop: '#243a55',
      skyBottom: '#8298a5',
      voidType: 'neon_city',
      voidY: -6.5,
      platforms: [
        { id: 'cyber_west', x: -19, z: -14, w: 14.5, d: 25, y: 0, h: 4.5 },
        { id: 'cyber_bridge', x: -4.5, z: -3.6, w: 9, d: 7.2, y: 0, h: 1.2 },
        { id: 'cyber_east', x: 4.5, z: -11, w: 14.5, d: 25, y: 0, h: 4.5 },
        { id: 'cyber_terminal_west', x: -17.5, z: 3, w: 8, d: 6.5, y: 1.45, h: 1.45 },
        { id: 'cyber_terminal_east', x: 9.5, z: -9.5, w: 8, d: 6.5, y: 1.45, h: 1.45 }
      ],
      pillars: [],
      jumpPads: [
        { x: -8.5, z: -4.5, r: 1.1, boostY: 15 },
        { x: 8.5, z: 4.5, r: 1.1, boostY: 15 }
      ],
      spawns: [
        { x: -12.5, z: 6 }, { x: 12.5, z: -6 }, { x: -12.5, z: -8 }, { x: 12.5, z: 8 },
        { x: -7, z: 1.5 }, { x: 7, z: -1.5 }, { x: -14, z: 0 }, { x: 14, z: 0 }
      ]
    },

    tideglass_harbor: {
      id: 'tideglass_harbor',
      nameTh: 'ท่าเรือคลื่นคราม (Tideglass Harbor)',
      nameEn: 'Tideglass Harbor',
      descTh: 'ท่าไม้ทอดขนานชายฝั่ง มีชานเรือต่อคนละด้านและทะเลล้อมรอบ',
      skyTop: '#668b9b',
      skyBottom: '#d9d5bb',
      voidType: 'sea',
      voidY: -5,
      platforms: [
        { id: 'harbor_boardwalk', x: -17, z: -6, w: 34, d: 12, y: 0, h: 1.2 },
        { id: 'harbor_north_pier', x: -15, z: -16, w: 12, d: 10, y: 0, h: 1 },
        { id: 'harbor_south_pier', x: 3, z: 6, w: 12, d: 10, y: 0, h: 1 },
        { id: 'harbor_lookout', x: -14.5, z: -15.3, w: 6, d: 5, y: 1.1, h: 1.1 }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -9, z: -8.5 }, { x: 9, z: 8.5 }, { x: -12, z: 1.5 }, { x: 12, z: -1.5 },
        { x: -5.5, z: -12 }, { x: 9, z: 12 }, { x: -6, z: 2.5 }, { x: 6, z: -2.5 }
      ]
    },

    brasswind_courier: {
      id: 'brasswind_courier',
      nameTh: 'เรือเหาะทองเหลือง (Brasswind Courier)',
      nameEn: 'Brasswind Courier',
      descTh: 'ดาดฟ้าเรือเหาะทรงยาว มีแท่นกระโดดส่งขึ้นหอบังคับการที่หัวและท้ายเรือ',
      skyTop: '#728aa9',
      skyBottom: '#ecdbc3',
      voidType: 'clouds',
      voidY: -6.5,
      platforms: [
        { id: 'courier_deck', x: -19, z: -8, w: 38, d: 16, y: 0, h: 1.8 },
        { id: 'courier_stern', x: -17.5, z: -6.6, w: 7.5, d: 10.8, y: 1.55, h: 1.55 },
        { id: 'courier_bow', x: 10, z: -4.2, w: 7.5, d: 10.8, y: 1.55, h: 1.55 }
      ],
      pillars: [],
      jumpPads: [
        { x: -7.7, z: -2, r: 1.05, boostY: 15 },
        { x: 7.7, z: 2, r: 1.05, boostY: 15 }
      ],
      spawns: [
        { x: -12.5, z: -1.5 }, { x: 12.5, z: 1.5 }, { x: -4.5, z: 4.5 }, { x: 4.5, z: -4.5 },
        { x: 0, z: 5.5 }, { x: 0, z: -5.5 }, { x: -3, z: -4.5 }, { x: 3, z: 4.5 }
      ]
    },

    mossgate_ruins: {
      id: 'mossgate_ruins',
      nameTh: 'ซากวิหารมอสส์ (Mossgate Ruins)',
      nameEn: 'Mossgate Ruins',
      descTh: 'ลานวิหารกลางป่าเขียวชื้น มีแท่นบูชาและชานหินแยกที่ต้องกระโดดข้าม',
      skyTop: '#587768',
      skyBottom: '#ced1ad',
      voidType: 'forest',
      voidY: -6.5,
      platforms: [
        { id: 'mossgate_court', x: -12, z: -12, w: 24, d: 24, y: 0, h: 3.7 },
        { id: 'mossgate_west', x: -21, z: -10, w: 7, d: 12, y: 0, h: 2.6 },
        { id: 'mossgate_east', x: 14, z: -2, w: 7, d: 12, y: 0.65, h: 3.25 },
        { id: 'mossgate_altar', x: -5.5, z: -8.5, w: 11, d: 7.5, y: 1.35, h: 1.35 }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -8, z: 7 }, { x: 8, z: -7 }, { x: -8, z: -4.5 }, { x: 8, z: 7 },
        { x: 0, z: 7 }, { x: 0, z: -5.5 }, { x: -17, z: -4.5 }, { x: 17, z: 4.5 }
      ]
    },

    frostline_pass: {
      id: 'frostline_pass',
      nameTh: 'ช่องเขาเหมันต์ (Frostline Pass)',
      nameEn: 'Frostline Pass',
      descTh: 'ชั้นหิมะสามระดับตามแนวหน้าผา แต่ละชั้นเยื้องด้านข้างให้มีทางขึ้นลงต่างกัน',
      skyTop: '#6e89a4',
      skyBottom: '#d7e3e6',
      voidType: 'snow',
      voidY: -6.5,
      platforms: [
        { id: 'frostline_middle', x: -14, z: -7.5, w: 28, d: 15, y: 0, h: 3.2 },
        { id: 'frostline_upper', x: -16, z: -16, w: 24, d: 8.5, y: 1.25, h: 4.45 },
        { id: 'frostline_lower', x: -8, z: 7.5, w: 24, d: 8.5, y: -0.65, h: 2.55 }
      ],
      pillars: [],
      jumpPads: [],
      spawns: [
        { x: -9, z: 3 }, { x: 9, z: -3 }, { x: -10, z: -11.5 }, { x: 10, z: 11.5 },
        { x: -3, z: 12 }, { x: 3, z: -12 }, { x: -6, z: 0 }, { x: 6, z: 0 }
      ]
    }
  };

  return {
    GEAR_SLOTS,
    GEAR_SLOT_LABELS,
    HEROES,
    HERO_LIST,
    SKILLS_BY_ID,
    MAPS
  };
});
