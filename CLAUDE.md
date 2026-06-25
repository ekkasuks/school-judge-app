# CLAUDE.md

คำแนะนำสำหรับ Claude Code เมื่อทำงานในโปรเจกต์นี้

## เกี่ยวกับโปรเจกต์

**ชื่อ:** school-judge-app
**ลูกค้า:** โรงเรียนบ้านใหม่ (ระดับประถมศึกษา)
**ระบบ:** Web App ตัดสินการประกวดชุดต่อต้านยาเสพติด — **โหวตรอบเดียว**
**สถานะปัจจุบัน:** V2 rework — Phase V1 (Schema/Spec) เสร็จ รอ confirm ก่อนเริ่ม Phase V2

อ่านบริบทเสมอ:
- [project-spec.md](project-spec.md) — สเปก V2
- [database-schema.md](database-schema.md) — โครงสร้าง Sheets 7 ชีต (V2)
- [todo.md](todo.md) — แผน 7 Phases ใหม่

## วิธีทำงาน (สำคัญที่สุด)

> **กฎเหล็ก:** ทำทีละ Step ตามลำดับใน `todo.md` → จบ Step → **หยุดและรอผู้ใช้ confirm** → ค่อยเริ่ม Step ถัดไป

- อย่ากระโดดข้าม Step
- อย่ารวมหลาย Step ในรอบเดียว (ยกเว้นผู้ใช้สั่ง)
- เมื่อ Step เสร็จ ให้สรุปสั้น ๆ ว่าทำอะไร + ถามว่าไปต่อไหม

## Tech Stack (อย่าเปลี่ยนโดยไม่ขอ)

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | HTML5 + CSS3 + **TailwindCSS (CDN)** + Vanilla JS — ไม่มี framework, ไม่มี build step |
| Backend | Google Apps Script Web App |
| Database | Google Sheets (8 sheet) |
| Image | Google Drive (folder เดียว, public link) |
| Drag & Drop | SortableJS (CDN) — ใช้ในรอบ 1 |
| PDF | jsPDF + html2canvas (CDN) |
| Excel | SheetJS xlsx.js (CDN) |
| Font | Google Fonts (Sarabun หรือ Prompt) |
| Deploy | GitHub Pages (static) |

**ห้าม:** React, Vue, npm, build tool, Firebase, Supabase, database อื่น

## หลักการเขียนโค้ด

1. **เรียบง่ายมาก่อนสมบูรณ์แบบ** — งานชั่วคราว 1 วัน ไม่ต้อง over-engineer
2. **ไม่มี build step** — เขียน JS ตรง ๆ ใส่ `<script>` tag
3. **ภาษา:**
   - identifier (ตัวแปร/ฟังก์ชัน): camelCase อังกฤษ
   - UI string: ภาษาไทยทั้งหมด
   - comment: เขียนเท่าที่จำเป็น
4. **API call:**
   - `fetch` ด้วย `content-type: text/plain` (เลี่ยง CORS preflight)
   - body: `JSON.stringify({ action, payload })`
   - response: JSON
5. **Token:**
   - admin token เก็บใน `localStorage` key `admin_token`
   - judge token อยู่ใน URL `?token=...`
6. **Error handling:** alert/toast เรียบ ๆ ไม่ต้องมี retry ซับซ้อน
7. **Mobile-first:** ออกแบบสำหรับ iPhone SE (375px) ก่อน แล้วค่อย scale ขึ้น

## หลักการ Google Apps Script

- ใช้ `LockService.getScriptLock()` ทุก write operation (กัน race condition)
- `SpreadsheetApp.openById()` ครั้งเดียวต่อ request — cache ref
- อ่าน `sheet.getDataRange().getValues()` ทีเดียวมา filter ใน memory ดีกว่า getRange ซ้ำ
- ทุก response: `ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)`
- Secrets เก็บใน `PropertiesService.getScriptProperties()`:
  - `ADMIN_PASSWORD`
  - `SPREADSHEET_ID`
  - `DRIVE_FOLDER_ID`

## โครงสร้างไฟล์เป้าหมาย

```
/
├── project-spec.md
├── database-schema.md
├── todo.md
├── CLAUDE.md
├── README.md
├── index.html              ── landing 3 ปุ่ม
├── admin.html
├── judge.html
├── results.html
├── css/
│   └── style.css            ── เสริม Tailwind
├── js/
│   ├── config.js            ── API_URL
│   ├── api.js               ── fetch wrapper
│   ├── admin.js
│   ├── judge.js
│   └── results.js
└── apps-script/             ── เก็บ source อ้างอิง (จริงอยู่ใน Apps Script editor)
    ├── Code.gs
    ├── Auth.gs
    ├── Teams.gs
    ├── Judges.gs
    ├── Votes.gs
    ├── Results.gs
    ├── Hungarian.gs
    ├── Drive.gs
    └── Config.gs
```

## กฎเฉพาะของระบบนี้ (V2)

### โหวตรอบเดียว
- 6 ทีม × 6 รางวัล × **11 กรรมการ**
- กรรมการเปิดลิงก์เดียวกัน → **เลือกชื่อตัวเอง** → โหวต
- UX: per award — แสดงรางวัลทีละใบ + ให้กรรมการเลือกทีมที่เหมาะกับรางวัลนั้น
- คำนวณ **Hungarian Algorithm** บน vote count matrix 6×6 (bijection)
- เป้าหมาย: max Σ votes — 1 ทีม ได้ 1 รางวัล ครบทุกทีม

### กรรมการ default (seed)
1. ครูชมพู่ 2. ครูอ้อม 3. ครูอ้อน 4. ครูดาว 5. ครูแนน 6. ครูน๊อต
7. ครูดิว 8. ครูเอก 9. ครูเบียร์ 10. ครูสา 11. ผอ.

### Identity ของกรรมการ
- ไม่มี token รายตัว — ใช้ลิงก์ shared `judge.html` (ไม่มี query string)
- เก็บ `judge_id` ใน `localStorage` ของแต่ละเครื่อง
- กัน double-submit ที่ server ผ่าน `Voted=TRUE` ใน `LockService`

### TV Reveal Mode (results.html)
- State อยู่ใน `Config`:
  - `revealIndex`: 0..6 — รางวัลที่เปิดเผยล่าสุด
  - `revealedTeam`: TRUE/FALSE — ในรางวัลปัจจุบัน เปิดทีมแล้วหรือยัง
- Admin กดปุ่ม "ถัดไป" / "เปิดผล" → server update state → ทุก viewer poll ทุก 2 วินาที sync
- effect: drumroll, confetti burst, scale animation

### Auto-compute trigger
- Admin set `Config.votingOpen = FALSE` → Apps Script auto-เรียก `computeResults()` ทันที
- ผลลัพธ์เขียนลง `Results` 6 แถว
- Admin override ภายหลังได้ใน UI (click-to-swap)

## ขั้นตอนทุกครั้งก่อนแก้โค้ด

1. เปิด `todo.md` — อยู่ Step ไหน?
2. ถ้าจะเปลี่ยน schema → แก้ `database-schema.md` ก่อน
3. ถ้าจะเพิ่มฟีเจอร์ → อัปเดต `project-spec.md` ก่อน
4. ทำ Step → update checkbox ใน `todo.md`
5. **หยุดและรายงานผู้ใช้**

## ข้อห้าม

- ❌ ใช้ framework, build tool, npm
- ❌ ใส่ admin password ใน repo
- ❌ ลบแถวใน Sheet ที่มี ID แล้ว — ใช้ `Active=FALSE` หรือ `Status` แทน
- ❌ เปลี่ยน schema โดยไม่อัปเดต `database-schema.md`
- ❌ ทำหลาย Step รวดเดียวโดยไม่มีคนสั่ง

## บริบทเพิ่มเติม

- ผู้ใช้: `ekkasuks@gmail.com`
- ภาษา UI: ไทย 100%
- กลุ่มเป้าหมาย: ครูประถม + กรรมการที่ไม่ใช่สาย tech → UI ต้องเรียบ ตัวใหญ่ ปุ่มใหญ่
- งานจริง: ดู `Config.eventDate`
