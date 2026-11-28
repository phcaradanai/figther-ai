# คู่มือ Art & Combat Lab (`/dev/art-combat-lab.html`)

หน้า Lab สำหรับเทียบความกลมกลืนของสีตัวละคร สนาม แสง เงาใต้เท้า และเอฟเฟกต์ต่อสู้แบบ **A / B / C** บนเฟรมเดียวกันที่ระยะกล้องเล่นจริง (`camDist = 41`)

## 1. วิธีเปิดใช้งาน
1. รันเซิร์ฟเวอร์เกมเดิมจากรากโปรเจกต์:
   ```powershell
   npm start
   ```
2. เปิด Chrome ไปที่:
   - `http://localhost:3000/dev/art-combat-lab.html`

## 2. การควบคุมและคีย์ลัด
- **สลับมุมมอง Preset**:
  - `4` — เทียบ 3 ช่องพร้อมกัน `A | B | C` (ค่าเริ่มต้น)
  - `1` — `A · เกมปัจจุบัน (Baseline)`
  - `2` — `B · เฉพาะ Knight ลดโทน 3D (Proof)`
  - `3` — `C · จูนสนาม แสง เงา และ FX (C-r1)`
- **เลือกฉากทดสอบ**: ปุ่ม `โดน · Hit`, `บล็อก · Block`, `พลาด · Miss`, และ `ฟันสวน · attack2` (`attack2_hit`) สำหรับเทียบท่า `attack2` ระหว่าง Baseline (`A/B`) กับ `attack2_ik_r2` (`C`)
- **ตัวเลือกเทียบท่า Rig (`#rigPoseSel`)**: สลับได้ระหว่าง `C ใช้ attack2_ik_r2 · A/B เดิม` (ค่าเริ่มต้น), `ทั้ง 3 ช่องใช้ท่าเดิม`, และ `ทั้ง 3 ช่องใช้ attack2_ik_r2`
- **เล่นซ้ำ / หยุด / เลื่อนเฟรม**:
  - `R` — เล่นซ้ำตั้งแต่ `0.00s`
  - `P` หรือ `Space` — หยุดภาพ / เล่นต่อ
  - `,` / `.` — ถอย / เดินทีละ 1 เฟรม (`1/60s`)
  - ปุ่ม `ท่ายืน (0.15s)`, `เฟรมสัมผัส (0.44s)` (อัปเดตอัตโนมัติเป็น `0.40s` ในฉาก `attack2_hit`), และ `คืนท่า (0.67s)` — กระโดดไปเฟรมมาตรฐานทันที
  - แถบเลื่อนเวลา (scrubber) — ลากดูได้ทุกเฟรมในช่วง `0.00s – 1.25s`
- **กล้อง**: เปลี่ยนระหว่าง `ระยะเกมจริง (41)` กับ `ระยะกลาง (24)` (มุมก้ม `0.62 rad`, `FOV = 22` เท่ากับเกมจริง)
- **ค่า Preset**: กดปุ่ม `ค่า Preset` เพื่อดู JSON ของ A, B หรือ C แบบละเอียด

## 3. สิ่งที่ใช้ของเกมจริง vs สิ่งที่จำลองใน Lab
- **ใช้ของเกมจริง**:
  - โมเดลและแอนิเมชัน `ChibiView` ของ **Knight** (`attack1`, และ `attack2` ที่แก้ทับด้วย [motion_rig_ik.js](../../public/dev/motion_rig_ik.js) + preset `attack2_ik_r2` จาก [motion_rig_presets.js](../../public/dev/motion_rig_presets.js)) และ **Ninja** (`idle` / `hurt` / `guard` / `guardHit`) จาก [chibi.js](../../public/js/three/chibi.js)
  - ฉาก `sky_temple` จาก [stage.js](../../public/js/three/stage.js)
  - ระบบเอฟเฟกต์จริง `FxSystem`, `KnightThreeVFX`, `KnightHolyVFX` และ `SwordTrail` จาก [fx.js](../../public/js/three/fx.js) และ [knight_holy_vfx.js](../../public/js/three/knight_holy_vfx.js)
  - กติกา damage (`11`), range (`2.3u`), block chip (`2`), knockback (`3.5 * 0.85`), lunge (`2.4`) และ hit-stop จาก [shared_data.js](../../public/js/shared_data.js) และ [server.js](../../server.js)
- **เหตุการณ์จำลองใน Lab** (แสดงป้ายเตือนบนแถบด้านบนชัดเจน):
  - ไทม์ไลน์ 60Hz แบบ deterministic (`performance.now` และ RNG แบบมี seed ในหน้า Lab เท่านั้น) จำลองจังหวะกดฟัน `0.30s` และผลโดน/บล็อก/พลาดที่ contact frame `0.42s` เพื่อให้เล่นซ้ำและเทียบ A/B/C บนเฟรมเดียวกันได้ตรงกันทุกครั้ง

## 4. วิธีเพิ่ม Preset ใหม่ (เก็บ A ไว้เป็น Baseline เสมอ)
1. เปิด [art_combat_presets.js](../../public/dev/art_combat_presets.js)
2. **ห้ามแก้หรือลบ `PRESETS.A`** เพื่อรักษา baseline ของเกมปัจจุบัน
3. หากต้องการทดลองรอบใหม่ เช่น `C-r2`:
   - อัปเดตค่า `PRESET_REVISION` หรือเพิ่มคีย์ใหม่ใน `PRESETS` (เช่น `C2` หรืออัปเดต `C` พร้อมบันทึกค่าเดิมของ `C-r1` ไว้ใน [art-combat-lab-log.md](art-combat-lab-log.md))
   - โครงสร้างที่ปรับได้แยกเป็น 5 ส่วนชัดเจน:
     - `knightTone` / `ninjaTone` (พารามิเตอร์สำหรับ `art_tone_shader.js` หรือ `null` เพื่อใช้วัสดุเดิม)
     - `stage` (`floorTint`, `propTint`, `fogColor`, `exposure`, `envIntensity`)
     - `lighting` (`hemiSky`, `hemiGround`, `hemiIntensity`, `sunColor`, `sunIntensity`)
     - `groundShadow` (`color`, `scale`, `opacity`, `knightRingColor`, `ninjaRingColor`, `ringOpacity`)
     - `vfx` (`recolor`, `swordTrail`, `hit`, `block`)

## 5. วิธีเพิ่มฉากทดสอบใหม่ (Scenario)
1. เปิด [art_combat_scenarios.js](../../public/dev/art_combat_scenarios.js)
2. เพิ่มอ็อบเจกต์ใหม่ใน `SCENARIOS` (เช่น `shield_break` สำหรับทดสอบการ์ดแตกในรอบถัดไป) โดยระบุ:
   - `id`, `label`, `desc`
   - `length`, `standTime`, `swingAt`, `contactAt`, `inspectContactTime`
   - `knightStart`, `ninjaStart`, `outcome`, ค่าท่า/ดาเมจ/ระยะผลักตาม `server.js`
3. เพิ่มปุ่มหรือตัวเลือกใน [art-combat-lab.html](../../public/dev/art-combat-lab.html) เชื่อมเข้า `setScenario(...)` และเพิ่มเคสใน `releaseCombatResult(...)` หากมีผลสถานะใหม่ (เช่น `guard_break`)

## 6. รูปแบบบันทึกการทดลอง (คัดลอกไปใช้ใน `art-combat-lab-log.md`)
```markdown
### YYYY-MM-DD · Revision (<เช่น C-r2>) — <หัวข้อ>
- **ปัญหาที่เห็น**: ...
- **คลิปและช่วงเวลา**: `<ชื่อไฟล์>` (`mm:ss–mm:ss`) — สิ่งที่สังเกต + สมมติฐาน
- **ค่าที่เปลี่ยน**: ระบุ diff เทียบกับ baseline `A` / revision ก่อนหน้า
- **วิธีทำซ้ำ**: URL + scenario + timestamp + preset + ระยะกล้อง
- **หลักฐานก่อน–หลัง**: ลิงก์ภาพจาก `docs/handoff/evidence/art-combat-lab/`
- **ผลหลังทดลองจริงและคำตัดสิน**: ใช้ต่อ / ปรับเพิ่ม / ย้อนกลับ + เหตุผล
```
