# บันทึกการทดลอง Art & Combat Lab

บันทึกการทดลองจูนภาพและจังหวะต่อสู้ใน `/dev/art-combat-lab.html` เพื่อใช้เทียบซ้ำกับ baseline `A` และส่งต่องานระหว่างรอบ

---

### 2026-11-27 · Revision `C-r1` — จูนสนาม แสง เงาใต้เท้า และสี FX รอบแรก (Knight vs Ninja, `attack1`)

- **ปัญหาที่เห็น**:
  - ใน Preset `B` (เปลี่ยนเฉพาะ Knight เป็นโทนลด 3D แบบ Proof) เกราะสีครีมอ่อนของ Knight กลืนกับพื้นศิลาสีทรายสว่างของ `Sky Temple` และเงาใต้เท้าอ่อนจนตัวละครดูลอยเมื่อเทียบกับพื้น
  - ในเกมปัจจุบัน (`A`/`B`) เส้นฟัน `SwordTrail` สีฟ้า-ไซอันชนโทนกับโล่และผ้าคลุมสีน้ำเงินของ Knight รวมถึงชนกับสีของ `BLOCK`, และ `guardDome` บังตัวละครช่วงกำลังรับแรงเมื่อดูจากระยะกล้องเล่นจริง (`cam=41`)
- **คลิปและช่วงเวลาที่ศึกษา** (จาก `C:\Users\phcar\game-learning\technic`):
  1. `Game dev secret- getting hit isn’t one effect. It’s 7 tricks stacked 🪓💥Which one surprised you.mp4`
     - `0:08–0:18`: เน้น **Hitbox / Hurtbox & Miss fairness** — การฟันเฉียดนอกระยะต้องอ่านออกว่าพลาดจริง ไม่มีแฟลชหรือแรงกระแทกหลอก
     - `0:18–0:25`: **Freeze + White Flash + Micro Camera Shake** — หยุดเฟรมสั้น แฟลชขาวทั้งตัวผู้โดน และเขย่ากล้องเบา ๆ ณ จังหวะสัมผัส
     - `0:25–0:35`: **Impact Frame + Directional Pushback** — ประกายปะทะสั้นคมตามทิศการฟัน
     - **สมมติฐานสำหรับ figther-ai**: คง `hitStop` + แฟลชขาวของ `ChibiView` + ระยะ `2.3u` เดิมไว้ แต่ลดขนาด `impactBurst` ลงเล็กน้อย (`scale: 0.82`) และเปลี่ยนสีปะทะเป็นส้มอำพันอุ่น (`#e57b35` / `#f2b857`) พร้อมเส้นฟันทองอุ่น (`SwordTrail`) เพื่อแยกจากผ้าคลุม/โล่น้ำเงิน และแยก Hit ออกจาก Block ชัดเจน
  2. `How to make shield breaks feel good (5 steps) #gamedev #indiedev #godot #gamedesign #gamefeel #s.mp4`
     - `0:10–0:14`: **Ripple** — การรับแรงปกติควรมีคลื่น/วงรับแรงที่ขอบโล่โดยไม่บังตัวละคร
     - `0:16–0:28`: **Cracks -> Warning Flicker -> Shatter Shards -> Stagger** — เก็บเป็นกรณีทดลอง `shield_break` รอบถัดไป เพื่อแยก "บล็อกปกติ" กับ "การ์ดแตก" ให้ขาดกัน
     - **สมมติฐานสำหรับ figther-ai (รอบนี้)**: ปรับการบล็อกปกติใน `C-r1` ให้ใช้โดมโปร่งบางลง (`shieldOpacity: 0.15`, `scale: 0.88`) กับวง/ประกายฟ้าเย็น (`#74b9ff` / `#d6eeff`) เพื่อให้เห็นท่าตั้งรับของ Ninja และโล่/ดาบของ Knight ชัดขึ้น
- **ค่าที่เปลี่ยนใน `C-r1`** (นิยามอยู่ใน [art_combat_presets.js](../../public/dev/art_combat_presets.js)):
  - **Knight**: คงค่า `KNIGHT_PROOF_TONE` เดียวกับ `B` (`paletteMix: 0.73`, `headBoost: 1.22`, `outlinePx: 1.0`, `outlineColor: '#40332c'`)
  - **Ninja**: ใช้วัสดุเกมเดิม (`ninjaTone: null`) เพื่อคุมตัวแปรรอบแรก
  - **Stage (`sky_temple`)**: `floorTint: '#cfd4c6'`, `propTint: '#d8d9cc'`, `fogColor: '#e8e2d0'`, `exposure: 0.96`, `envIntensity: 0.55`
  - **Lighting**: `hemiSky: '#f5ecdc'`, `hemiGround: '#8ea19d'`, `hemiIntensity: 0.92`, `sunColor: '#ffe8c6'`, `sunIntensity: 1.42`
  - **Ground Shadow & Rings**: `color: '#6b594c'`, `scale: 1.18`, `opacity: 0.98`, `knightRingColor: '#b89658'`, `ninjaRingColor: '#b86c6c'`, `ringOpacity: 0.28`
  - **VFX (`recolor: true`)**:
    - `swordTrail`: `root [0.68, 0.48, 0.22]`, `mid [0.95, 0.76, 0.38]`, `edge [1.00, 0.96, 0.86]`
    - `hit`: `outline '#3b2316'`, `body '#e57b35'`, `accent '#f2b857'`, `hot '#fff2cc'`, `spark '#f2b857'`, `damageText '#ff8b3d'`, `scale: 0.82`
    - `block`: `shield '#5b8fd9'`, `shieldOpacity: 0.15`, `ring '#74b9ff'`, `spark '#d6eeff'`, `flash '#9bc9f5'`, `text '#7dd3fc'`, `scale: 0.88`
- **วิธีทำซ้ำ**:
  1. รัน `npm start` แล้วเปิด `http://localhost:3000/dev/art-combat-lab.html`
  2. โหมดเริ่มต้น `เทียบ 3 ช่อง A | B | C (4)` ที่ `กล้อง = ระยะเกมจริง (41)`
  3. กดเลือกฉาก `โดน · Hit` / `บล็อก · Block` / `พลาด · Miss` แล้วกด `ท่ายืน (0.15s)` หรือ `เฟรมสัมผัส (0.44s)`
  4. หรือใน Console: `artCombatLab.setScenario('hit'); artCombatLab.setPaused(true); artCombatLab.seek(0.44);`
- **หลักฐานก่อน–หลัง** (`A | B | C` บนเฟรมเดียวกัน):
  - ท่ายืน (`hit`, `0.15s`, `cam=41`): [stand_abc_cam41.png](evidence/art-combat-lab/stand_abc_cam41.png)
  - เฟรมสัมผัสโดน (`hit`, `0.43s`, `cam=41`): [hit_abc_cam41.png](evidence/art-combat-lab/hit_abc_cam41.png)
  - เฟรมสัมผัสโดนระยะกลาง (`hit`, `0.43s`, `cam=24`): [hit_abc_cam24.png](evidence/art-combat-lab/hit_abc_cam24.png)
  - เฟรมสัมผัสบล็อก (`block`, `0.43s`, `cam=41`): [block_abc_cam41.png](evidence/art-combat-lab/block_abc_cam41.png)
  - เฟรมสัมผัสบล็อกระยะกลาง (`block`, `0.43s`, `cam=24`): [block_abc_cam24.png](evidence/art-combat-lab/block_abc_cam24.png)
  - เฟรมฟันพลาด (`miss`, `0.43s`, `cam=41`): [miss_abc_cam41.png](evidence/art-combat-lab/miss_abc_cam41.png)
- **ผลที่เกิดขึ้นหลังทดลองจริง**:
  - **ความกลมกลืนของทั้งเฟรม (`C-r1` vs `A`/`B`)**: พื้นศิลาโทน `#cfd4c6` ที่ลดความจ้าและเงาใต้เท้า `#6b594c` ช่วยให้ Knight โทนลด 3D ไม่ดูสว่างลอยแยกจากพื้นเหมือนใน `B` ทั้ง Knight และ Ninja ยืนเกาะพื้นขึ้นชัดเจน
  - **การแยก โดน / บล็อก / พลาด ที่ระยะ `cam=41`**:
    - **Hit**: แฟลชขาวบน Ninja + ประกายอำพันอุ่น + ตัวเลข `11` + hit-stop อ่านชัด โดยไม่กลบโล่สีน้ำเงินของ Knight
    - **Block**: การลดความทึบโดมเป็น `0.15` และย่อ `0.88` ทำให้เห็นดาบ Knight และท่า `guardHit` ของ Ninja ทะลุโดมได้ชัดกว่า `A`/`B` พร้อมข้อความ `BLOCK (-2)`
    - **Miss**: เส้นฟันทองอุ่นแยกจากโล่และผ้าคลุมสีน้ำเงินของ Knight ไม่ปนกับสีฟ้าของ `Block` และไม่เกิดแฟลชหลอก
- **คำตัดสิน**: **ใช้ `C-r1` ต่อเป็นฐานทดลองรอบถัดไป**
- **สิ่งที่ยังต้องเทียบเพิ่มในรอบถัดไป**:
  1. ทดลองปรับโทนสีของ **Ninja** ด้วย (`ninjaTone`) ใน `C-r2` เพื่อดูว่าเมื่อทั้ง Knight และ Ninja อยู่ในภาษาภาพลด 3D ด้วยกันแล้ว คอนทราสต์ระหว่างสีม่วงเข้มของ Ninja กับพื้น `#cfd4c6` ยังอ่านท่าชัดหรือไม่
  2. เพิ่ม Scenario `shield_break` (ท่า Heavy `Shield Bash` ของ Knight ใส่การ์ด Ninja) ตามคลิป `How to make shield breaks feel good` ช่วง `0:16–0:28`
  3. ทดสอบในแมตช์ 2 ไคลเอนต์จริงบน LAN หลังเลือกโทนสรุปเพื่อเช็กการอ่านจังหวะเคลื่อนไหวจริง
