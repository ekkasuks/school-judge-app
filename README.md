# school-judge-app

ระบบ Web App ตัดสินการประกวดชุดต่อต้านยาเสพติด — **โรงเรียนบ้านใหม่** (ระดับประถมศึกษา)

> รองรับ 2 รอบ: รอบที่ 1 จัดอันดับด้วย Drag & Drop (1 รางวัล), รอบที่ 2 เลือกรางวัลทีละทีม + Hungarian Assignment (6 รางวัล)

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

1. Admin login → เพิ่มทีม (7 ทีม) + กรรมการ (3 รอบ 1 + 7 รอบ 2)
2. แชร์ลิงก์ + QR code ให้กรรมการแต่ละคน (จากแท็บ "กรรมการ")
3. เปิด toggle "รอบที่ 1" → กรรมการลงคะแนน (รอ progress bar เต็ม)
4. ปิด toggle "รอบที่ 1" → ไปแท็บ "ผลคะแนน" → กด "คำนวณรอบ 1" → ยืนยันผู้ชนะ
5. เปิด toggle "รอบที่ 2" → กรรมการลงคะแนน
6. ปิด toggle "รอบที่ 2" → กด "คำนวณรอบ 2" → (สลับการ์ดถ้าต้องการ) → บันทึก
7. เปิด toggle "ประกาศผลสาธารณะ" → ฉาย `results.html` บนจอใหญ่
8. แท็บ Export → ดาวน์โหลด PDF + Excel เก็บเป็นหลักฐาน

---

## เกณฑ์การให้คะแนน

### รอบที่ 1 — น่ารักจนกรรมการใจละลาย (1 รางวัล)

- 7 ทีม × 3 กรรมการ
- Drag & Drop จัดอันดับ → คะแนน: 1️⃣=7, 2️⃣=6, ..., 7️⃣=1
- Tiebreak: ผลรวมคะแนน → จำนวนอันดับ 1 → 2 → 3 → admin เลือก
- ผู้ชนะถูกตัดออกจากรอบ 2 อัตโนมัติ

### รอบที่ 2 — รางวัล 6 ประเภท

- 6 ทีม × 7 กรรมการ × 6 รางวัล
- กรรมการเลือกรางวัลที่เหมาะสมที่สุดให้ทีมละ 1 รางวัล (ซ้ำได้)
- คำนวณด้วย **Hungarian Algorithm** บน vote count matrix 6×6
- เป้าหมาย: max Σ votes ภายใต้ bijection ทีม↔รางวัล
- รางวัล: หลอนชุด ไม่หลอนยา / พลังจิ๋วแต่แจ๋ว / เด็กทรงดี ไม่มีทรงยา / โอ้โห ! ทำไปได้ / เจ้าหนูพลังบวก / ตัวตึงไม่พึ่งผง

---

## เกณฑ์ความปลอดภัย

- ✅ HTTPS เท่านั้น (GitHub Pages + Apps Script default)
- ✅ Apps Script `LockService` ทุก write — กัน race condition
- ✅ Double-check `Voted` flag ภายใน lock — กัน double-submit
- ✅ ไม่มี secret ใน repo (admin password อยู่ใน Script Properties)
- ✅ Backup อัตโนมัติผ่าน Google Sheets version history

## ค่าใช้จ่าย

**0 บาทรายเดือน** — ใช้ GitHub Pages + Google Apps Script + Google Sheets/Drive (free quota)
