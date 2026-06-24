# Apps Script — Backend API

โฟลเดอร์นี้เก็บ source code ของ Google Apps Script Web App ที่ทำหน้าที่เป็น REST API
**โค้ดจริงจะ run อยู่ใน Apps Script editor** ของ Google ไฟล์ที่นี่เก็บไว้เป็น reference + version control

## ขั้นตอนติดตั้ง

### 1) สร้าง Google Spreadsheet
- เปิด <https://sheets.new>
- ตั้งชื่อ `school-judge-app-db`
- คัดลอก **Spreadsheet ID** จาก URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`

### 2) สร้าง Drive Folder สำหรับรูปทีม
- สร้าง folder ใน Google Drive (เช่น `school-judge-app-images`)
- คัดลอก **Folder ID** จาก URL: `https://drive.google.com/drive/folders/<ID>`

### 3) เปิด Apps Script
- ใน Spreadsheet → **Extensions → Apps Script**
- ลบไฟล์ `Code.gs` ตั้งต้น
- สร้างไฟล์ใหม่ ตามรายชื่อด้านล่าง แล้ว paste โค้ดจาก `apps-script/` ของ repo

ไฟล์ที่ต้องสร้าง (ลำดับไม่สำคัญ):
- `Code.gs`
- `Auth.gs`
- `Teams.gs`
- `Judges.gs`
- `Votes.gs`
- `Results.gs`
- `Hungarian.gs`
- `Config.gs`
- `Init.gs`

### 4) ตั้ง Script Properties
ใน Apps Script editor → ⚙️ **Project Settings** → **Script Properties** → Add property:

| Property | Value |
|----------|-------|
| `SPREADSHEET_ID` | จาก step 1 |
| `ADMIN_PASSWORD` | รหัสที่อยากใช้ login admin |
| `DRIVE_FOLDER_ID` | จาก step 2 |

### 5) Init โครงสร้าง
- เปิดไฟล์ `Init.gs`
- เลือก function `initSpreadsheet` ในเมนู → กด **Run**
- อนุญาตสิทธิ์เมื่อขอ (ครั้งแรก)
- ตรวจ Spreadsheet → ควรเห็น 8 sheet พร้อม headers และ Awards/Config มี seed data
- (ทางเลือก) รัน `seedSampleData` เพื่อเพิ่ม 7 ทีม + 10 กรรมการตัวอย่าง

### 6) Test ด้วยฟังก์ชัน built-in
- เปิด `Hungarian.gs` → รัน `_testHungarian` → ดู Logger (View → Logs)
- ควรเห็น `assignment = [0,1,2]`, `total votes = 8`

### 7) Deploy เป็น Web App
- คลิก **Deploy → New deployment**
- Type: **Web app**
- Execute as: **Me (อีเมลของคุณ)**
- Who has access: **Anyone**
- กด **Deploy** → copy **Web app URL** เก็บไว้
- URL นี้คือ `API_URL` ที่ใช้ใน frontend

> ทุกครั้งที่แก้โค้ดแล้วอยาก deploy ใหม่ → **Deploy → Manage deployments → ✏️** → เลือก version: **New version** → Deploy
> URL จะคงเดิม

### 8) Test endpoint
```bash
curl -L -X POST '<WEB_APP_URL>' \
  -H 'Content-Type: text/plain' \
  -d '{"action":"adminLogin","payload":{"password":"<ADMIN_PASSWORD>"}}'
```
ควรได้: `{"ok":true,"token":"..."}`

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|------|--------|
| `Code.gs` | entry `doPost`, router, helpers (getSheet, withLock, jsonResponse) |
| `Auth.gs` | admin login, session, judge token validate, getJudgeContext |
| `Teams.gs` | CRUD ทีม + reorder + uploadImage ไป Drive |
| `Judges.gs` | CRUD กรรมการ + token gen/reset |
| `Votes.gs` | submitRound1Vote, submitRound2Vote |
| `Results.gs` | dashboard, computeRound1/2, setWinner, publish, export |
| `Hungarian.gs` | assignment algorithm สำหรับรอบ 2 |
| `Config.gs` | key-value config |
| `Init.gs` | ตั้งค่า spreadsheet เริ่มต้น + seed data |

## API endpoints (ทุก action ใช้ POST /)

ดูใน [project-spec.md](../project-spec.md#11-api-contract-apps-script)
