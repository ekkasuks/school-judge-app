# school-judge-app

ระบบ Web App ตัดสินการประกวดชุดต่อต้านยาเสพติด — **โรงเรียนบ้านใหม่** (ระดับประถมศึกษา)

> **V2 — โหวตรอบเดียว:** 6 ทีม × 6 รางวัล × 11 กรรมการ → Hungarian Assignment (bijection)
> กรรมการใช้ลิงก์เดียวกัน → เลือกชื่อตัวเอง → โหวต "ทีมที่เหมาะกับแต่ละรางวัล"
> Admin ปิดโหวต → ระบบคำนวณอัตโนมัติ → ประกาศผลแบบ TV reveal mode (ทีละรางวัลพร้อม effect)

## เอกสารหลัก

| ไฟล์ | หน้าที่ |
|------|---------|
| [project-spec.md](project-spec.md) | สเปกระบบเต็ม + ฟีเจอร์ + API contract |
| [database-schema.md](database-schema.md) | โครงสร้าง Google Sheets 8 ชีต + ER + สูตรคำนวณ |
| [todo.md](todo.md) | แผนพัฒนา 12 Steps + progress |
| [CLAUDE.md](CLAUDE.md) | คำแนะนำสำหรับ Claude Code |
| [apps-script/README.md](apps-script/README.md) | ขั้นตอน deploy backend |

## Tech Stack

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | HTML5 + Tailwind CSS (CDN) + Vanilla JS — ไม่มี build step |
| Backend | Google Apps Script Web App |
| Database | Google Sheets (8 ชีต) |
| Image storage | Google Drive (folder เดียว, public link) |
| Deploy | GitHub Pages |
| Libraries (CDN) | SortableJS, qrcode-generator, jsPDF, html2canvas, SheetJS |

## โครงสร้างไฟล์

```
.
├── index.html              ── landing (เลือก Admin / Results)
├── admin.html              ── หน้า Admin (login + 6 tabs)
├── judge.html              ── หน้ากรรมการ (รอบ 1 + รอบ 2)
├── results.html            ── หน้าประกาศผลสาธารณะ
├── css/style.css           ── เสริม Tailwind
├── js/
│   ├── config.js           ── ⚠️ ใส่ API_URL ที่นี่
│   ├── api.js              ── fetch wrapper + UI helpers
│   ├── admin.js            ── logic ฝั่ง admin
│   ├── judge.js            ── logic ฝั่งกรรมการ
│   ├── results.js          ── logic หน้าประกาศผล
│   ├── export-pdf.js       ── สร้าง PDF 4 หน้า
│   └── export-xlsx.js      ── สร้าง Excel 5 ชีต
└── apps-script/            ── source ของ Apps Script (ดูใน editor ของ Google)
    ├── Code.gs · Auth.gs · Teams.gs · Judges.gs · Votes.gs
    ├── Results.gs · Hungarian.gs · Config.gs · Init.gs
    └── README.md
```

---

## วิธี Deploy (รวม 4 ขั้นตอน)

### 1) Setup Backend (Google)

ดูรายละเอียดเต็มใน [apps-script/README.md](apps-script/README.md) — สรุป:

1. สร้าง Google Spreadsheet → คัดลอก `SPREADSHEET_ID`
2. สร้าง Google Drive folder (สำหรับรูปทีม) → คัดลอก `DRIVE_FOLDER_ID`
3. Extensions → Apps Script → paste `apps-script/*.gs` ทั้ง 9 ไฟล์
4. ตั้ง Script Properties: `SPREADSHEET_ID`, `ADMIN_PASSWORD`, `DRIVE_FOLDER_ID`
5. รัน `initSpreadsheet()` ครั้งเดียว
6. Deploy → New deployment → Web app → **Execute as: Me · Access: Anyone**
7. คัดลอก **Web App URL**

### 2) ตั้งค่า Frontend

แก้ [js/config.js](js/config.js):

```js
const API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
```

### 3) Push ขึ้น GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 4) เปิด GitHub Pages

1. ไปที่ repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/ (root)`
4. Save → รอ 1–2 นาที → URL จะปรากฏ

URL ที่ได้: `https://<user>.github.io/<repo>/`

---

## วิธีใช้งานในวันงาน

1. **Admin login** → ตรวจรายชื่อกรรมการ default 11 คน (ครูชมพู่ ... ผอ.) แก้ชื่อได้
2. **เพิ่มทีม** 6 ทีม (admin tab "ทีม")
3. **คัดลอกลิงก์** จาก tab "กรรมการ" (📋 ปุ่มคัดลอก) → ส่งให้กรรมการทุกคน
4. **เปิด toggle "เปิดให้กรรมการโหวต"** → กรรมการเปิดลิงก์ เลือกชื่อตัวเอง แล้วโหวต
5. **รอ progress bar เต็ม** (X / 11) แล้ว **ปิด toggle** → ระบบคำนวณ Hungarian อัตโนมัติ
6. (ทางเลือก) ไปแท็บ "ผลคะแนน" → สลับการ์ด (admin override) → บันทึก
7. **เปิด toggle "ประกาศผลสาธารณะ"** → เปิด `results.html` บนจอ TV
8. กดปุ่ม "🎤 เริ่มประกาศ" → "🎉 เปิดผล" → "➡️ รางวัลถัดไป" (วนจนครบ 6 รางวัล)
9. แท็บ Export → ดาวน์โหลด PDF + Excel เก็บเป็นหลักฐาน

---

## เกณฑ์การให้คะแนน (V2)

### โหวตรอบเดียว — 6 รางวัล 6 ทีม

- **6 ทีม × 6 รางวัล × 11 กรรมการ**
- กรรมการเปิดลิงก์ → **เลือกชื่อตัวเอง** จากรายการ
- โหวต per award: ดูชื่อรางวัล → เลือก 1 ทีมที่เหมาะที่สุด
- โหวตครบ 6 รางวัล — **1 กรรมการเลือก 1 ทีม ต่อ 1 รางวัล และไม่ซ้ำกันในทั้ง 6 รางวัล** (ทีมที่ถูกเลือกแล้วจะไม่ปรากฏในรางวัลถัดไป)
- คำนวณด้วย **Hungarian Algorithm** บน vote count matrix 6×6
- เป้าหมาย: **max Σ votes** ภายใต้ bijection — 1 ทีม : 1 รางวัล ทุกทีมได้รับครบ
- รางวัล 6 ประเภท:
  1. หลอนชุด ไม่หลอนยา
  2. พลังจิ๋วแต่แจ๋ว
  3. เด็กทรงดี ไม่มีทรงยา
  4. โอ้โห ! ทำไปได้
  5. เจ้าหนูพลังบวก
  6. ตัวตึงไม่พึ่งผง

### TV Reveal Mode

- ฉาย `results.html` บนจอใหญ่
- Admin (มี admin_token ใน localStorage) เห็นแถบควบคุมล่างจอ
- กดปุ่ม → ระบบขึ้นชื่อรางวัลก่อน (พร้อม drumroll)
- กดปุ่ม "เปิดผล" → ทีมโผล่ + confetti + fanfare
- ถัดไปเรื่อย ๆ จนครบ 6 รางวัล → grid สรุป + ฉลอง

---

## เกณฑ์ความปลอดภัย

- ✅ HTTPS เท่านั้น (GitHub Pages + Apps Script default)
- ✅ Apps Script `LockService` ทุก write — กัน race condition
- ✅ Double-check `Voted` flag ภายใน lock — กัน double-submit
- ✅ ไม่มี secret ใน repo (admin password อยู่ใน Script Properties)
- ✅ Backup อัตโนมัติผ่าน Google Sheets version history

## ค่าใช้จ่าย

**0 บาทรายเดือน** — ใช้ GitHub Pages + Google Apps Script + Google Sheets/Drive (free quota)
