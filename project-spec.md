# Project Specification — ระบบตัดสินการประกวดชุดต่อต้านยาเสพติด

**โรงเรียนบ้านใหม่** | ระดับประถมศึกษา

---

## 1. ภาพรวม (Overview)

Web App สำหรับการตัดสินการประกวดชุดต่อต้านยาเสพติดแบบออนไลน์ กรรมการลงคะแนนผ่านมือถือด้วยลิงก์เฉพาะตัว ระบบคำนวณผลและประกาศผลอัตโนมัติ

## 2. เป้าหมาย

- กรรมการลงคะแนนจากมือถือผ่านลิงก์เฉพาะของตน
- คำนวณผลอัตโนมัติทั้ง 2 รอบ
- รองรับมือถือ 100%, โหลด ≤ 3 วินาที
- ไม่มีค่าใช้จ่ายรายเดือน
- รองรับกรรมการลงคะแนนพร้อมกัน ≥ 20 คน

## 3. Tech Stack

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | HTML5 + CSS3 + TailwindCSS (CDN) + Vanilla JS |
| Backend | Google Apps Script Web App |
| Database | Google Sheets |
| Image Storage | Google Drive |
| Version Control | GitHub |
| Deployment | GitHub Pages |
| API | REST ผ่าน Apps Script (POST + text/plain เลี่ยง CORS preflight) |

## 4. ผู้ใช้งาน (Roles)

| Role | สิทธิ์ |
|------|-------|
| **Admin** | login ด้วย password, จัดการทุกอย่าง |
| **Judge (กรรมการ)** | เข้าผ่าน token URL, ลงคะแนนได้ครั้งเดียวต่อรอบ |
| **Public** | ดูประกาศผลโดยไม่ต้อง login |

---

## 5. ระบบ Admin

### 5.1 Login
- รหัสผ่าน Admin (เก็บใน Apps Script Properties)
- Token หมดอายุใน 8 ชั่วโมง

### 5.2 เมนูหลัก
1. จัดการทีมแข่งขัน
2. จัดการกรรมการ
3. เปิด-ปิดรอบการลงคะแนน
4. ดูสถานะการลงคะแนน
5. ดูผลคะแนน
6. ประกาศผล
7. Export PDF
8. Export Excel

### 5.3 จัดการทีมแข่งขัน
- จำนวนเริ่มต้น **7 ทีม**
- ฟิลด์ทีม: `TeamID`, `TeamName`, `School`, `TeamNumber`, `ImageURL`, `Order`
- การกระทำ: เพิ่ม / แก้ไขชื่อ / แก้ไขรูป / ลบ / เปลี่ยนลำดับ
- อัปโหลดรูปไป **Google Drive** → บันทึก URL ลง Sheet

### 5.4 จัดการกรรมการ
- **รอบที่ 1:** 3 คน
- **รอบที่ 2:** 7 คน
- การกระทำ: เพิ่ม / แก้ไขชื่อ / รีเซ็ตลิงก์ (regenerate token)

### 5.5 Dashboard
- จำนวนทีม / กรรมการ / ผู้ลงคะแนนแล้ว / ยังไม่ลง
- Progress bar แยกรอบ (เช่น `รอบที่ 1: 2/3`, `รอบที่ 2: 5/7`)
- Realtime: รีเฟรชทุก 5 วินาที

---

## 6. รอบที่ 1 — "น่ารักจนกรรมการใจละลาย"

### 6.1 รูปแบบ
- ทีมเข้าแข่งขัน: **7 ทีม**
- กรรมการ: **3 คน**
- รางวัล: 1 รางวัล ("น่ารักจนกรรมการใจละลาย")

### 6.2 วิธีตัดสิน
กรรมการ **จัดอันดับ** ทีมทั้ง 7 ทีมด้วย **Drag & Drop**

| อันดับ | คะแนน |
|--------|-------|
| 1 | 7 |
| 2 | 6 |
| 3 | 5 |
| 4 | 4 |
| 5 | 3 |
| 6 | 2 |
| 7 | 1 |

### 6.3 หน้าจอกรรมการ
- แสดง: รูปทีม + ชื่อทีม
- ลากเรียงจากบน (อันดับ 1) → ล่าง (อันดับ 7)
- ปุ่ม "ส่งคะแนน" → ระบบบันทึกและล็อก ไม่สามารถแก้ไขได้

### 6.4 การคำนวณผล
- รวมคะแนนจากกรรมการทั้ง 3 คน
- ทีมที่ได้คะแนนรวมสูงสุด = ผู้ชนะรางวัล "น่ารักจนกรรมการใจละลาย"
- ผู้ชนะ → `Status = Winner-Round1` → ตัดออกจากรอบที่ 2 อัตโนมัติ

### 6.5 กรณีคะแนนเท่ากัน (Tiebreak)
1. จำนวน "อันดับ 1" มากกว่า
2. จำนวน "อันดับ 2" มากกว่า
3. จำนวน "อันดับ 3" มากกว่า
4. หากยังเท่า → Admin เลือกผู้ชนะเอง

---

## 7. รอบที่ 2 — รางวัล 6 ประเภท

### 7.1 รูปแบบ
- ทีมเข้าแข่งขัน: **6 ทีม** (ที่เหลือจากรอบที่ 1)
- กรรมการ: **7 คน**
- รางวัล 6 ประเภท:
  1. หลอนชุด ไม่หลอนยา
  2. พลังจิ๋วแต่แจ๋ว
  3. เด็กทรงดี ไม่มีทรงยา
  4. โอ้โห ! ทำไปได้
  5. เจ้าหนูพลังบวก
  6. ตัวตึงไม่พึ่งผง

### 7.2 วิธีตัดสิน
- แสดงผู้เข้าประกวด **ทีละทีม** (ทีม A → ทีม B → ...)
- แต่ละทีม: แสดงรูป + ชื่อ + **radio button รางวัลทั้ง 6**
- กรรมการเลือก "รางวัลที่เหมาะสมที่สุด" สำหรับทีมนั้น **1 รางวัล**
- ต้องเลือกครบทั้ง 6 ทีม → กดส่ง → ล็อก

> ⚠️ หมายเหตุ: 1 กรรมการ อาจเลือกรางวัลเดียวกันซ้ำให้หลายทีมได้ (เป็นการโหวต ไม่ใช่การจัด assignment)

### 7.3 การคำนวณผล — Assignment Matching
หลังกรรมการทุกคน vote ครบ:

**Step A:** สร้างตาราง vote count `votes[team][award]` = จำนวนกรรมการที่โหวต `award` ให้ `team`

**Step B:** หา assignment ที่:
- 1 ทีม ได้ 1 รางวัล
- 1 รางวัล มี 1 ผู้ชนะ
- ผลรวม `votes[team][award]` ตามการ assign **สูงสุด**

ใช้ **Hungarian Algorithm** (assignment problem) บน 6×6 matrix

### 7.4 กรณีหลายคำตอบให้ผลรวมเท่ากัน
- ใช้คำตอบแรกที่อัลกอริทึมหา (deterministic)
- Admin override ได้ในหน้า "ผลคะแนน" ก่อนกด "ประกาศผล"

---

## 8. ระบบกรรมการ (Token System)

- Token สร้างอัตโนมัติเมื่อ admin เพิ่มกรรมการ
- รูปแบบ: `judge-r{round}-{6 hex}` เช่น `judge-r1-a1b2c3`
- ลิงก์: `https://<github-pages-url>/judge.html?token=judge-r1-a1b2c3`
- **ใช้งานได้ครั้งเดียวต่อรอบ** (กดส่งแล้วล็อก)
- บันทึก `VotedAt` timestamp
- Admin รีเซ็ต token ได้ → generate ใหม่, ล้างคะแนนเก่าของ token นั้น

---

## 9. ประกาศผล (Public Result)

- หน้า `/results.html` ไม่ต้อง login
- แสดงเมื่อ Admin กด "ประกาศผล" (Config `resultsPublished = TRUE`)

### 9.1 ผลรอบที่ 1
```
🏆 น่ารักจนกรรมการใจละลาย
[รูปทีม]
ชื่อทีม — โรงเรียน
คะแนนรวม: XX
```

### 9.2 ผลรอบที่ 2
แสดงการ์ดรางวัล 6 ใบ:
```
🏆 หลอนชุด ไม่หลอนยา
[รูปทีม]
ทีม ABC — โรงเรียน...
```

---

## 10. Export

### 10.1 PDF (ใช้ jsPDF ฝั่ง client)
- รายงานคะแนนรอบที่ 1 (matrix กรรมการ × ทีม)
- รายงานคะแนนรอบที่ 2 (vote count matrix + ผล assignment)
- สรุปผู้ได้รับรางวัล

### 10.2 Excel (ใช้ SheetJS ฝั่ง client หรือ export CSV จาก Apps Script)
- Sheet 1: ตารางคะแนนทั้งหมด
- Sheet 2: รายงานกรรมการ (ใครส่งเมื่อไหร่)
- Sheet 3: สรุปผลการแข่งขัน

---

## 11. API Contract (Apps Script)

ทุก request: `POST` body JSON `{ action, payload }`, content-type `text/plain`

| Action | Auth | Description |
|--------|------|-------------|
| `adminLogin` | – | { password } → { token } |
| `getDashboard` | admin | สถานะรวม |
| `getTeams` | – | รายการทีม (public ใช้ได้) |
| `saveTeam` | admin | เพิ่ม/แก้ไขทีม |
| `deleteTeam` | admin | |
| `reorderTeams` | admin | { teamIds: [...] } |
| `uploadImage` | admin | { filename, base64 } → { url } |
| `getJudges` | admin | |
| `saveJudge` | admin | เพิ่ม/แก้ไขกรรมการ + gen token |
| `resetJudgeToken` | admin | |
| `setConfig` | admin | { key, value } |
| `getJudgeContext` | – | { token } → ข้อมูลรอบ + ทีม |
| `submitRound1Vote` | judge token | { token, rankings: [teamId...] } |
| `submitRound2Vote` | judge token | { token, votes: { teamId: award } } |
| `getResults` | – | คืนผลเมื่อ published |
| `getAdminResults` | admin | คืนผลก่อน publish ได้ |
| `publishResults` | admin | |
| `exportData` | admin | dump ทุก sheet → JSON |

---

## 12. Performance & Security

- HTTPS เท่านั้น (GitHub Pages + Apps Script default)
- ป้องกัน double-submit: ตรวจ `Judges.Voted = TRUE` ก่อนรับคะแนน
- Apps Script LockService ป้องกัน race condition ตอนเขียน vote
- Backup: Google Sheets มี version history ในตัว

---

## 13. แผนการพัฒนา (12 Steps)

ทำทีละขั้น **หยุดรอ confirm หลังจบทุก step**

1. ออกแบบ Google Sheets Schema ⬅️ **ปัจจุบัน**
2. สร้าง Google Apps Script API
3. สร้าง Admin Dashboard
4. สร้างระบบกรรมการรอบที่ 1
5. สร้างระบบคำนวณรอบที่ 1
6. สร้างระบบกรรมการรอบที่ 2
7. สร้าง Assignment Matching Algorithm
8. สร้างระบบประกาศผล
9. สร้าง Export PDF
10. สร้าง Export Excel
11. เชื่อม GitHub Pages
12. ทดสอบระบบทั้งหมด
