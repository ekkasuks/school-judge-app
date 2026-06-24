# TODO — แผนพัฒนา 12 Steps

> ทำทีละ Step **หยุดรอ confirm หลังจบทุก step** ก่อนเริ่ม step ถัดไป

✅ = เสร็จ • 🔄 = กำลังทำ • ⏸️ = รอ confirm • ⬜ = ยังไม่เริ่ม

---

## Step 1 — ออกแบบ Google Sheets Schema ✅

- [x] กำหนด 8 sheet: `Teams`, `Judges`, `Awards`, `Round1Votes`, `Round2Votes`, `Results`, `Config`, `Sessions`
- [x] กำหนดทุก column + type + constraint
- [x] กำหนด ER relationships
- [x] กำหนดสูตรคำนวณรอบ 1 (sort key + tiebreak)
- [x] กำหนดสูตรคำนวณรอบ 2 (Hungarian assignment)
- [x] กำหนด seed data ทั้งหมด (7 ทีม + 7 รางวัล + 3+7 กรรมการ + 8 config keys)
- [x] เขียนลง [database-schema.md](database-schema.md)

**Deliverable:** [database-schema.md](database-schema.md) ✓

---

## Step 2 — สร้าง Google Apps Script API ⏸️ รอ confirm

- [x] เขียนไฟล์ Apps Script ทั้ง 9 ไฟล์ใน [apps-script/](apps-script/)
  - [x] `Code.gs` — entry `doPost`, router, helpers, lock
  - [x] `Auth.gs` — adminLogin, validateAdmin, validateJudgeToken, getJudgeContext
  - [x] `Teams.gs` — getTeams, saveTeam, deleteTeam, reorderTeams, uploadImage
  - [x] `Judges.gs` — getJudges, saveJudge, deleteJudge, resetJudgeToken
  - [x] `Votes.gs` — submitRound1Vote, submitRound2Vote (มี race-condition guard)
  - [x] `Results.gs` — dashboard, computeRound1/2, setWinner, publish, export
  - [x] `Hungarian.gs` — JV algorithm + `_testHungarian`
  - [x] `Config.gs` — getConfig, setConfig
  - [x] `Init.gs` — `initSpreadsheet()` + `seedSampleData()`
- [x] เขียน [apps-script/README.md](apps-script/README.md) (setup steps)
- [ ] **ต้องทำใน Google ฝั่งผู้ใช้:**
  - [ ] สร้าง Spreadsheet + Drive folder
  - [ ] paste โค้ดเข้า Apps Script editor
  - [ ] ตั้ง Script Properties: `SPREADSHEET_ID`, `ADMIN_PASSWORD`, `DRIVE_FOLDER_ID`
  - [ ] รัน `initSpreadsheet()`
  - [ ] Deploy เป็น Web App + copy URL

⏸️ รอ confirm

---

## Step 3 — Admin Dashboard ⏸️ รอ confirm

- [x] [index.html](index.html) — landing 3 ปุ่ม
- [x] [css/style.css](css/style.css) — เสริม Tailwind (Sarabun font, no-scrollbar, tab-active, drag-handle)
- [x] [js/config.js](js/config.js) — `API_URL` placeholder
- [x] [js/api.js](js/api.js) — fetch wrapper, token helpers, toast, confirmDialog, blocker, fileToBase64
- [x] [admin.html](admin.html) — login + 6 tabs + 3 modals
- [x] [js/admin.js](js/admin.js):
  - [x] login form + auto-resume token
  - [x] tab switcher (6 tabs)
  - [x] dashboard widgets (counts + progress bars + state badges)
  - [x] realtime refresh 5s + session-expired handling
  - [x] ทีม: เพิ่ม/แก้ไข/ลบ + อัปโหลด Drive + drag reorder (SortableJS)
  - [x] กรรมการ: เพิ่ม/แก้ไข/ลบ + รีเซ็ต token + QR + copy ลิงก์
  - [x] toggles: round1Open / round2Open / resultsPublished (มี confirm สำหรับ publish)
- [x] Placeholder: tab "ผลคะแนน" + "Export" (เติมใน Step 5/7/9/10)

⏸️ รอ confirm

---

## Step 4 — ระบบกรรมการรอบที่ 1 ⏸️ รอ confirm

- [x] [judge.html](judge.html) — มี 6 state UI: loading / error / closed / done / round1 / round2(placeholder)
- [x] [js/judge.js](js/judge.js) — state machine + drag & drop
- [x] อ่าน `?token=` จาก URL → call `getJudgeContext`
- [x] route ตาม Voted / roundOpen / round number
- [x] รอบ 1: drag & drop ranking ด้วย SortableJS
  - [x] การ์ดใหญ่ + รูป + หมายเลขทีม + ชื่อ + โรงเรียน
  - [x] badge ลำดับ (1, 2, …) อัพเดตอัตโนมัติหลังลาก
  - [x] sticky submit bar ค้างล่างจอ (safe-area-inset-bottom)
  - [x] `delay: 80ms` กัน scroll พลาดเป็นการลาก
- [x] ปุ่มส่งคะแนน → confirm modal → `submitRound1Vote`
- [x] หลังส่ง → reload context → เข้า "ขอบคุณ" state อัตโนมัติ
- [x] guard:
  - [x] ไม่มี token → error screen
  - [x] Voted=TRUE → "ขอบคุณ" state พร้อมเวลา VotedAt
  - [x] roundOpen=FALSE → "ยังไม่เปิด" state + auto-poll ทุก 10s

⏸️ รอ confirm

---

## Step 5 — ระบบคำนวณรอบที่ 1 ⏸️ รอ confirm

- [x] Apps Script `computeRound1()` + `setRound1Winner()` (ทำใน Step 2)
- [x] Admin UI ในแท็บ "ผลคะแนน":
  - [x] แสดงสถานะ "ยังไม่คำนวณ" / "บันทึกแล้ว" + badge
  - [x] ปุ่ม "🧮 คำนวณผลรอบ 1" → call `computeRound1`
  - [x] ตารางพรีวิว: อันดับ + ชื่อทีม + คะแนน + อันดับ 1/2/3
  - [x] ถ้าไม่เสมอ → winner card + ปุ่ม "บันทึก" inline
  - [x] ถ้าเสมอ → tie-break modal + radio + ช่อง note + ยืนยัน
  - [x] หลังบันทึก → reload Results + Teams + Dashboard
  - [x] ถ้าคำนวณซ้ำหลังบันทึกแล้ว → confirm overwrite
- [x] หน้า winner card (saved state) แสดง: รูป + ชื่อทีม + คะแนน + note
- [x] [admin.html](admin.html) เพิ่ม `#tie-modal`
- [x] [js/admin.js](js/admin.js) เพิ่ม section RESULTS — Round 1

⏸️ รอ confirm

---

## Step 6 — ระบบกรรมการรอบที่ 2 ⏸️ รอ confirm

- [x] reuse `judge.html` (เพิ่ม `state-round2` มี 2 view: form + review)
- [x] state machine ภายในรอบ 2: form (ทีละทีม) ↔ review (สรุป)
- [x] หน้าทีละทีม: รูปใหญ่ 48×48 + #หมายเลข + ชื่อ + โรงเรียน + radio 6 รางวัล
- [x] progress bar + ข้อความ "ทีม X / N"
- [x] sticky bottom: ปุ่ม "← ก่อนหน้า" / "ถัดไป →"
- [x] บังคับเลือกก่อนถัดไป (toast เตือน)
- [x] หน้า review: list ทุกทีม + รางวัลที่เลือก, คลิกแถวเพื่อกระโดดไปแก้ไข
- [x] localStorage draft cache (`r2_draft_<token>`) กันหลุดเมื่อรีเฟรช
- [x] confirm modal ก่อน submit → `submitRound2Vote({ votes })`
- [x] หลังส่งสำเร็จ → ลบ draft + reload context → เข้า "ขอบคุณ" state

⏸️ รอ confirm

---

## Step 7 — Assignment Matching Algorithm ⏸️ รอ confirm

- [x] Apps Script (ใน Step 2):
  - [x] `Hungarian.gs` — JV algorithm + `_testHungarian` ตัวอย่าง
  - [x] `computeRound2()` build matrix + เรียก Hungarian
  - [x] `setRound2Results()` รับ assignment + บันทึก
- [x] Admin UI ในแท็บ "ผลคะแนน":
  - [x] แสดงสถานะ "ยังไม่ได้คำนวณ" / "บันทึกแล้ว"
  - [x] กรณีบันทึกแล้ว — grid 6 การ์ด (รางวัล → ทีม + คะแนน + note ถ้า override)
  - [x] ปุ่ม "🧮 คำนวณผลรอบ 2" → call `computeRound2`
  - [x] พรีวิว: ผลรวมเสียง + ป้าย "Hungarian optimal" หรือ "admin สลับ N คู่"
  - [x] Vote matrix table (collapsible) — highlight cell ที่เป็น assignment
  - [x] Assignment grid 6 การ์ด — click-to-swap (2 ครั้งสลับ)
  - [x] swap → mark `overridden=true` → note=admin override
  - [x] ปุ่ม "บันทึกผลรอบ 2" → confirm → `setRound2Results`
  - [x] หลังบันทึก → reload Results + Dashboard

⏸️ รอ confirm

---

## Step 8 — ระบบประกาศผล (Public Results) ⏸️ รอ confirm

- [x] [results.html](results.html) — 3 state (loading / pending / results) ไม่ต้อง login
- [x] [js/results.js](js/results.js) — poll + render + confetti
- [x] poll `getResults` ทุก 10 วินาที
- [x] ถ้า `resultsPublished=FALSE` → "ยังไม่ประกาศผล" + auto-refresh
- [x] รอบ 1: hero card สีทอง 👑 รูปใหญ่ + ชื่อทีม + คะแนนรวม
- [x] รอบ 2: grid responsive (1 col mobile, 2 col sm+) 6 การ์ดรางวัล
- [x] CSS animations:
  - [x] fade-in การ์ดเรียงทีละใบ (`animation-delay`)
  - [x] confetti CSS-only — gen 24-40 ชิ้นด้วย JS, สีสุ่ม + duration สุ่ม
- [x] mobile-first responsive
- [x] diff-detection: poll signature → ไม่ re-render ถ้าผลเหมือนเดิม → ไม่กระตุก
- [x] กราเชียส: ถ้า admin ถอด publish ระหว่าง show → กลับไป pending state

⏸️ รอ confirm

---

## Step 9 — Export PDF ⏸️ รอ confirm

- [x] เพิ่ม CDN: jsPDF 2.5.2 + html2canvas 1.4.1 ใน [admin.html](admin.html)
- [x] [js/export-pdf.js](js/export-pdf.js) — แยกออกจาก admin.js
- [x] ปุ่ม "📄 Export PDF" ในแท็บ Export → bind ใน admin.js
- [x] 4 section / 4 หน้า:
  - [x] หน้าปก: 🏆 + ชื่องาน + โรงเรียน + วันที่ + timestamp
  - [x] สรุปผู้ได้รับรางวัล (7 รางวัล, ตารางพร้อม emoji แยกรอบ)
  - [x] คะแนนรอบ 1: matrix (ทีม × กรรมการ) + คอลัมน์รวม + 1/2/3
  - [x] คะแนนรอบ 2: vote matrix + assignment summary
- [x] **ไทยใช้ได้** — html2canvas capture Sarabun font ที่ browser render แล้ว (ไม่ต้อง embed .ttf)
- [x] รองรับรูปข้ามต้นทาง (`useCORS: true`) + `waitImages` รอโหลด
- [x] auto-fit section ลงหน้า A4 (scale ลงถ้าสูงเกิน)
- [x] ตั้งชื่อไฟล์ `รายงานผล-YYYYMMDD.pdf`

⏸️ รอ confirm

---

## Step 10 — Export Excel ⏸️ รอ confirm

- [x] เพิ่ม CDN SheetJS 0.18.5 ใน [admin.html](admin.html)
- [x] [js/export-xlsx.js](js/export-xlsx.js) — แยกออกจาก admin.js
- [x] ปุ่ม "📊 Export Excel" ในแท็บ Export → bind ใน admin.js
- [x] 5 sheets:
  - [x] **สรุปผลรางวัล** — 7 รางวัล (ลำดับ, รอบ, รางวัล, ทีม, หมายเลข, โรงเรียน, คะแนน, note, ComputedAt)
  - [x] **คะแนนรอบ 1** — matrix (ทีม × กรรมการ) + คอลัมน์รวม + อันดับ 1/2/3 + เรียงตาม tiebreak
  - [x] **คะแนนรอบ 2** — vote matrix + คอลัมน์ "รางวัลที่ได้" + "เสียงที่ตรงรางวัล" + note
  - [x] **กรรมการ** — JudgeID + ชื่อ + รอบ + สถานะ + เวลาส่ง + Token
  - [x] **ทีม** — TeamID + หมายเลข + ชื่อ + โรงเรียน + สถานะแปลไทย
- [x] auto-fit column width (จากความยาวเนื้อหา, cap 40)
- [x] ตั้งชื่อไฟล์ `รายงานผล-YYYYMMDD.xlsx`
- [x] รองรับชื่อ sheet ภาษาไทย + truncate 31 ตัวอักษร

⏸️ รอ confirm

---

## Step 11 — เชื่อม GitHub Pages ⬜

- [ ] init git, push code
- [ ] เปิด GitHub Pages (Settings → Pages → main branch)
- [ ] verify URL
- [ ] ใส่ `API_URL` (Apps Script Web App URL) ใน `js/config.js`
- [ ] ทดสอบเปิดบนมือถือจริง

⏸️ รอ confirm

---

## Step 12 — ทดสอบระบบทั้งหมด ⬜

- [ ] **Smoke test:** admin login → เพิ่ม 7 ทีม + 3+7 กรรมการ
- [ ] **รอบ 1 E2E:** กรรมการ 3 คนจาก 3 มือถือลงคะแนน → คำนวณ → ผู้ชนะถูกต้อง
- [ ] **Tiebreak test:** force ให้คะแนนเท่ากัน → ตรวจสอบ tiebreak rules
- [ ] **รอบ 2 E2E:** ทีมเหลือ 6, กรรมการ 7 ลงคะแนน → Hungarian → ทุกทีมได้ 1 รางวัล
- [ ] **Token reuse guard:** กรรมการเข้าลิงก์เดิมหลังส่งแล้ว → ต้อง lock
- [ ] **Concurrency:** กรรมการ 5 คนกด submit พร้อมกัน → ทุกคนสำเร็จ ไม่มี race condition
- [ ] **Mobile:** test บน iPhone Safari + Android Chrome
- [ ] **Public results:** ดูบนมือถือ + desktop
- [ ] **Export:** PDF ภาษาไทยอ่านได้, Excel เปิดได้ใน Google Sheets
- [ ] **Load:** ทดสอบ 20 คนลงคะแนนพร้อมกัน

---

## Stretch Goals (ทำถ้ามีเวลา)

- [ ] QR code สำหรับลิงก์กรรมการ (qrcode.js CDN)
- [ ] dark mode toggle
- [ ] confetti animation ตอนประกาศผล
- [ ] เสียง fanfare ตอน reveal
- [ ] ภาพถ่ายผู้ชนะถ่ายสดผ่านมือถือ
