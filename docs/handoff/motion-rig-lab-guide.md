# คู่มือ & บันทึกผล Movement & Motion Rig Lab (`/dev/motion-rig-lab.html`)

หน้า Lab สำหรับตรวจ แก้ไข บันทึก และเทียบ **Before | After** ของการเคลื่อนที่ (Movement: พุ่งแล้วหยุด) และท่าโจมตีจริง (Motion Rig) ของ **Knight** บน `ChibiView` จริงโดยไม่แตะไฟล์เกมหลัก

---

## 1. การเปิดใช้งานและการควบคุม
1. สตาร์ตเซิร์ฟเวอร์เกมจากรากโปรเจกต์ (`npm start` หรือ `$env:PORT=3010; node server.js` หากพอร์ต 3000 มีโปรเซสอื่นใช้อยู่)
2. เปิด Chrome ไปที่:
   - `http://localhost:3000/dev/motion-rig-lab.html` (หรือพอร์ตที่รันอยู่ เช่น `:3010`)
   - ลิงก์เชื่อมโยงไป-กลับจากแถบบนของ [Art & Combat Lab](../../public/dev/art-combat-lab.html) และ [Knight Motion Lab](../../public/knight_motion_lab.html)
3. **คีย์ลัดและปุ่มหลัก**:
   - `Space` / `P`: หยุดภาพ / เล่นต่อ, `R`: เล่นซ้ำตั้งแต่ `0.000s`, `,` / `.`: ถอย / เดินทีละ 1 เฟรม (`1/60s`)
   - **มุมมอง**: `Before | After` (ค่าเริ่มต้น), `Before เต็ม`, `After เต็ม`
   - **กล้อง**: `มุมเกมจริง (game)`, `ด้านข้าง (side)`, `ด้านหน้า (front)`, `3/4 ข้อต่อชัด (closeup)` + ลากเมาส์หมุน / Scroll ซูม
   - **ไฟล์ข้อมูล Preset & Scenario (โหลดได้ทันทีจาก checkout ใหม่)**:
     - Presets & Validation: [motion_rig_presets.js](../../public/dev/motion_rig_presets.js)
     - Scenarios & Dash Physics: [motion_rig_scenarios.js](../../public/dev/motion_rig_scenarios.js)

---

## 2. คลิปอ้างอิงที่ศึกษา (จาก `C:\Users\phcar\game-learning\technic`, คงไฟล์ไว้ที่ต้นทาง)
1. `Your dash works_. but it looks like sliding on ice 🧊 5 steps to make it feel FAST.Save this fo.mp4`
   - `0:11–0:17` (**Wind-up**): เอน/ถอยสะสมแรงสั้น ๆ ก่อนพุ่ง (`0:14+`)
   - `0:18–0:24` (**Stretch / Lean**): ย่อตัวและโน้มตัวตามทิศพุ่งเพื่อให้เห็นการถ่ายน้ำหนัก
   - `0:25–0:32` (**Launch vs Skid**): แยกจังหวะออกตัวกับจังหวะเบรกหยุดให้ชัด
   - `0:33–0:42` (**Afterimages & Dust Cue**): เงาติดตาและฝุ่นพื้นช่วยบอกทิศและความเร็วแทนการปล่อยลื่นบนพื้น
   - **ผลที่นำมาสร้างใน Lab**: โหมด Movement ใช้ระยะทางและความเร็ว 30Hz เดียวกับ `server.js` แต่เพิ่มช่วงเตรียม (`-10°`), ช่วงพุ่ง (`28°` + ย่อสะโพก `9.5cm` + ภาพติดตา + ฝุ่น), และช่วงเบรกที่ล็อกเท้าหน้าด้วย `solveAnatomicalLeg`
2. `Game dev secret- getting hit isn’t one effect. It’s 7 tricks stacked 🪓💥Which one surprised you.mp4`
   - `0:08–0:24` (**Hitbox/Hurtbox Readability & Contact Alignment**): คนดูต้องเห็นชัดจากท่าและวิถีอาวุธว่าดาบถึงเป้าเมื่อไหร่ โดยไม่สับสนกับจังหวะที่เซิร์ฟเวอร์ยืนยันผล
   - **ผลที่นำมาสร้างใน Lab**: แสดงตัวช่วย `วิถีปลายดาบ + วงระยะเป้า 2.3u` พร้อมแถบเวลาคู่แยก `ยืนยันเซิร์ฟเวอร์ (0.000s)` ออกจาก `อาวุธถึงเป้า (เช่น 0.100s สำหรับ attack2)` และตรึงเฟรมสัมผัสให้คงเดิมไม่คลาดเคลื่อน

---

## 3. โหมด Movement — Knight พุ่งแล้วหยุด (`dash_stop`)
- **ฐานฟิสิกส์จริง (`DASH_PHYSICS`)**: `walkSpeed = 5.4`, `dashSpeedMult = 1.55`, `dashBurst = 13.8105 u/s` (`burstDuration = 0.36s`), ผสมความเร็ว 30Hz (`burstBlend = 0.14`, `stopBlend = 0.28`), ระยะเคลื่อนที่รวม `3.40u` แล้วหยุดที่ `0.00 u/s`
- **ค่าที่จูนใน Preset `dash_grounded_r1`**:
  - เตรียม (`0.19–0.25s`): `windupLeanDeg = -10°`, `windupHipDropCm = 4.5cm`
  - พุ่ง (`0.25–0.53s`): `dashLeanDeg = +28°`, `dashHipDropCm = 9.5cm`, `leadFootFlexDeg = 18°`, `trailFootExtendDeg = 22°`, `showAfterimages = true`, `showDust = true`
  - เบรก (`0.53–0.75s`): `brakeLeanDeg = -14°`, `brakeHipDropCm = 8.5cm`, `brakeFootLock = true`, `recoverDuration = 0.22s`
- **ผลวัดจริงใน Lab**:
  - ช่วงพุ่ง (`0.340s`, กล้อง `game`): Before โน้มลำตัว `37.7°` | After โน้ม `65.5°` พร้อมเงาติดตาและฝุ่นออกตัว — [dash_burst_game.png](evidence/motion-rig-lab/dash_burst_game.png)
  - ช่วงเบรก (`0.580s`, กล้อง `side`): ลดระยะไถลเท้าหน้า (`footL`) ช่วงชะลอตัวลงจาก **`17.6cm` เหลือ `9.7cm`** และปรับลำตัวตั้งรับจาก `14.6°` เหลือ `1°` โดยไม่ทำลายระยะพุ่งจริง — [dash_brake_side.png](evidence/motion-rig-lab/dash_brake_side.png)

---

## 4. โหมด Motion Rig — แก้ท่าโจมตี `attack2` (Backhand Sweep)
- **การตรวจพบปัญหาในคลิปเดิม (`public/assets/anims/knight/attack2.json`)**:
  - ตรวจทุกเฟรม (`13` เฟรม, `0.000s–0.400s`) ด้วย `BodyField` (`tools/rig/body-field.mjs`):
    - `f0 (0.000s)`: ดาบทะลุ `armL` ลึก **`3.4cm`** (`armR = [27, 69.5, 171.1]°`)
    - `f5–f10 (0.167s–0.333s)`: ข้อมือขวา (`handR`) ติดเพดาน `HUMAN_ROM` (`~59°`) ทำให้ข้อมือขวางแนวแขนและพาดาบวกกลับเข้าศีรษะ
    - `f11 (0.367s)`: ข้อมือดีดมุม **`-45.3°` ในเฟรมเดียว** (`handR.x` จาก `57.9° -> 12.6°`) และพาดาบทะลุหมวก (`helmet`) ลึกถึง **`6.0cm`**
    - `f12 (0.400s)`: ดาบยังทะลุ `helmet` ลึก **`2.4cm`**
  - สรุป Baseline: **`3/13` เฟรม** ดาบทะลุตัวละครเกิน `2cm` (สูงสุด `6.0cm`)
- **สาเหตุจริงและการแก้ใน Preset `attack2_clean_r1`**:
  - กระจายการหมุนกลับออกจาก `handR` ไปที่ไหล่ขวา (`armR`) และศอกขวา (`foreR` แกน X/Y โดยล็อกแกน Z ตามข้อต่อจริง) เพื่อให้แนวแขนพาปลายดาบอ้อมออกนอกหมวกและ `armL` โดย **ไม่แตะเฟรมสัมผัส `0.100s`** (และคง `ServerConfirm 0.000s` / `VisualContact 0.100s` เดิม):

| Keyframe | `armR` offset (°) | `foreR` offset (°) | `handR` offset (°) | ผลต่อระยะทะลุ |
| ---: | --- | --- | --- | --- |
| `0.000s` | `[20, 10, 10]` | `[15, 0, 0]` | `[6, 12, 20]` | ลดทะลุ `armL` `3.4cm -> 1.6cm` (<2cm) |
| `0.067s` | `[0, 0, 0]` | `[0, 0, 0]` | `[0, 0, 4]` | เข้าสู่แนวฟันราบรื่น |
| **`0.100s`** | **`[0, 0, 0]`** | **`[0, 0, 0]`** | **`[0, 0, 0]`** | **เฟรมสัมผัสคงเดิม 100% (0.0cm)** |
| `0.200s` | `[4, 6, 12]` | `[-6, -8, 0]` | `[-14, 14, -12]` | คลายข้อมือออกจากเพดาน ROM |
| `0.333s` | `[6, 18, 28]` | `[-10, -10, 0]` | `[-18, 18, -16]` | กางไหล่นำดาบหลบขอบหมวก |
| `0.367s` | `[10, 24, 34]` | `[-14, -8, 0]` | `[14, 22, -6]` | **แก้ทะลุหมวก `6.0cm -> 0.0cm` และขจัด snap** |
| `0.400s` | `[8, 20, 32]` | `[-6, -6, 0]` | `[-6, 16, -16]` | **แก้ทะลุหมวก `2.4cm -> 0.0cm`** |

- **หลักฐานภาพเปรียบเทียบ**:
  - มุม `closeup` เฟรมคืนท่า (`0.367s`): [attack2_recovery_closeup.png](evidence/motion-rig-lab/attack2_recovery_closeup.png) (ฝั่ง `Before` เห็นจุดเตือนสีแดงและดาบจมหลังปีกหมวก ส่วนฝั่ง `After` ดาบหลบพ้นนอกแนวหมวก ไร้จุดแดง)
  - กล้องเล่นจริง (`game`) เฟรมสัมผัส (`0.100s`): [attack2_contact_game.png](evidence/motion-rig-lab/attack2_contact_game.png) (ระยะฟันถึงเป้า 2.3u และ `VisualContact 0.100s` ตรงกันทั้งสองฝั่ง)

---

## 5. ระบบ Save Draft / Export / Import JSON และการตรวจสอบความเข้ากันได้
- **Storage Key**: `figther_ai.motion_rig_lab.draft.v1` (รอดการรีโหลดหน้าเว็บ กด `Load Draft` เพื่อกู้คืนได้ทันที)
- **Schema มาตรฐาน (`figther-ai.motion-rig.v1`)**: ระบุ `rigVersion: "knight-skinned-v1"`, `heroId: "knight"`, `clip`, `mode`, `movementParams`, `keyframes` (`t`, `joints`, และ optional `hipsYCm` / `swordMountPosCm` / `swordMountRotDeg`)
- **Validation ก่อน Import**:
  - ปฏิเสธทันทีพร้อมข้อความภาษาไทยเมื่อ `schema` ผิด, `rigVersion` ไม่ตรง (เช่น `ninja-skinned-v1`), `heroId` ไม่ตรง, `clip` คนละท่ากับที่เปิดอยู่, หรือมีชื่อกระดูกที่ไม่อยู่ใน rig
- **ขั้นตอนนำผลที่ผ่านเกณฑ์เข้าเกมจริง (แยกจากรอบ Lab นี้)**:
  1. นำค่า `dash_grounded_r1` ไปทดสอบเป็น candidate ใน `knight_motion.js` / `knight_footwork.js` (ตรวจเทียบเคียงกับ `tests/knight_animation.test.mjs`)
  2. นำคีย์ `attack2_clean_r1` ไปเบก/แพตช์ลง `public/assets/anims/knight/attack2.json` แล้วรัน `node tools/rig/self-collision.mjs attack2`, `node tools/rig/anatomy-audit.mjs --strict`, และ `tests/knight_animation.test.mjs` เพื่อยืนยันก่อนใช้งานจริง
