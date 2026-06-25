# Project Specification — V2 (Single Round)

**โรงเรียนบ้านใหม่** | ระดับประถมศึกษา | ระบบตัดสินการประกวดชุดต่อต้านยาเสพติด

---

## 1. ภาพรวม

Web App สำหรับโหวต **รอบเดียว** — 6 ทีม × 6 รางวัล × 11 กรรมการ
- กรรมการใช้ **ลิงก์เดียวกัน** → เลือกชื่อตนเอง → โหวต "ทีมที่เหมาะกับแต่ละรางวัล"
- Admin กดปิดโหวต → ระบบคำนวณ **Hungarian Assignment** อัตโนมัติ
- หน้าประกาศผล = **TV Reveal Mode** — ขึ้นชื่อรางวัล → กดเปิดผล → ทีมโผล่พร้อม effect → กดถัดไป (วน 6 รางวัล)

## 2. เป้าหมาย

- กรรมการโหวตจากมือถือผ่านลิงก์เดียว ไม่ต้องแจกรหัสรายตัว
- ระบบจับคู่ทีม↔รางวัลให้เหมาะสมที่สุด (ค่ารวมเสียงสูงสุด ใต้ bijection)
- หน้าประกาศผลตื่นเต้น เหมาะกับการฉายจอใหญ่
- รองรับมือถือ 100%, โหลด ≤ 3 วินาที
- ค่าใช้จ่าย 0 บาท/เดือน

## 3. Tech Stack (ไม่เปลี่ยน)

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | HTML5 + CSS3 + TailwindCSS (CDN) + Vanilla JS |
| Backend | Google Apps Script Web App |
| Database | Google Sheets (7 ชีต) |
| Image Storage | Google Drive |
| Deploy | GitHub Pages |
| Libraries (CDN) | qrcode-generator, jsPDF, html2canvas, SheetJS |

> ❌ ลบ SortableJS แล้ว — ไม่มี drag & drop ranking อีกต่อไป

## 4. ผู้ใช้งาน (Roles)

| Role | สิทธิ์ | วิธีเข้า |
|------|-------|---------|
| **Admin** | จัดการทุกอย่าง | password |
| **Judge (กรรมการ 11 คน)** | โหวต 1 ครั้งต่อคน (6 รางวัล) | ลิงก์ shared + เลือกชื่อตัวเอง |
| **Public / TV** | ดูประกาศผล (auto-sync เมื่อ admin กดปุ่ม) | ลิงก์ shared, ไม่ต้อง login |

---

## 5. ระบบ Admin

### 5.1 Login
- Password เก็บใน Apps Script Properties
- Token expiry 8 ชั่วโมง

### 5.2 เมนูหลัก
1. Dashboard (progress + sync state)
2. จัดการทีม (6 ทีม — เหมือนเดิม + อัปโหลด Drive)
3. จัดการกรรมการ (เพิ่ม/แก้ไขชื่อ/ลบ — รายชื่อ default 11 คน)
4. ควบคุมโหวต (เปิด/ปิด → กดปิด = auto-compute)
5. ผลคะแนน (preview Hungarian, click-to-swap override)
6. ประกาศผล TV Mode (ปุ่ม Next / Reveal)
7. Export PDF / Excel

### 5.3 Dashboard
- จำนวนทีม / กรรมการ / สถานะคำนวณ
- Progress bar: `X / 11` กรรมการลงคะแนน
- realtime polling 5 วินาที

### 5.4 ควบคุมโหวต
- Toggle เดียว: `votingOpen`
- เมื่อเปลี่ยน TRUE → FALSE: ระบบเรียก `computeResults` ทันที (Hungarian) + เขียนลง `Results`
- เปลี่ยน FALSE → TRUE หลังคำนวณแล้ว: clear `Results` + `revealIndex=0`

---

## 6. ระบบกรรมการ

### 6.1 ลิงก์ shared
- URL: `https://<pages>/judge.html`
- **ไม่มี token** — รายชื่อกรรมการเปิดเผยในแอป (เป็น in-house judges, low security needs)

### 6.2 Flow
```
เปิดลิงก์ → ถ้ายังไม่เคยเลือก → "เลือกชื่อของคุณ"
                                  │
                                  ▼
  list 11 ชื่อ (รวม "ผอ.") + ปุ่ม "ฉันคือ ___"
                                  │
            เก็บ judgeId ใน localStorage  →  หน้าโหวต
                                  │
                          (ถ้า Voted=TRUE → ขอบคุณ)
                                  │
                                  ▼
  รางวัล 1/6 → เลือก 1 ทีม → ถัดไป
  รางวัล 2/6 → ... → ถัดไป
  ...
  รางวัล 6/6 → ตรวจสอบ → ส่ง
                                  │
                                  ▼
                     "ขอบคุณ" state (lock)
```

### 6.3 รายละเอียดหน้า "เลือกชื่อ"
- โหลด `getJudgesList()` (public)
- ปุ่มใหญ่ 11 ใบ (ตามลำดับ Order) แสดงชื่อ
- ปุ่มที่ `Voted=TRUE` → grey + "✅ ส่งแล้ว" + disabled
- กดปุ่ม → เก็บ `judgeId` ใน `localStorage.judge_id` → เปลี่ยนหน้า

### 6.4 รายละเอียดหน้าโหวต
- header: ชื่อกรรมการ + progress
- การ์ดใหญ่: **ชื่อรางวัล** (เน้น)
- ใต้: list ทีม (รูป + ชื่อ) + radio
- **ทีมที่ถูกเลือกในรางวัลอื่นแล้วจะไม่แสดง** — กรรมการเลือก 1 ทีม ต่อ 1 รางวัล และไม่ซ้ำกันใน 6 รางวัล
- ปุ่ม "ก่อนหน้า / ถัดไป"
- หน้าสุดท้าย: review → ส่ง
- localStorage draft `judge_draft_<judgeId>` — restore เมื่อรีเฟรช

### 6.5 ปกป้อง double-submit
- ตรวจ `Voted=TRUE` ภายใน `LockService`
- หลังส่ง → ลบ draft + เปลี่ยนเป็น "ขอบคุณ"

---

## 7. ระบบประกาศผล (TV Reveal Mode)

### 7.1 ขอบเขต
- Admin เปิด `resultsPublished=TRUE` หลังคำนวณเรียบร้อย
- หน้า `results.html` ฉายจอทีวี — full-screen friendly

### 7.2 State
ใน `Config`:
- `revealIndex`: 0..6 — รางวัลปัจจุบันที่ "เปิดเผย" แล้ว
- `revealedTeam`: TRUE/FALSE — ในรางวัลปัจจุบัน แสดงชื่อทีมแล้วหรือยัง

### 7.3 Flow บนหน้า results.html
```
revealIndex=0  → "กดเริ่มประกาศ"
revealIndex=1, revealedTeam=FALSE → แสดงชื่อรางวัล 1, ปุ่ม "เปิดผล"
revealIndex=1, revealedTeam=TRUE  → แสดงชื่อทีม + confetti, ปุ่ม "รางวัลถัดไป"
revealIndex=2, revealedTeam=FALSE → ชื่อรางวัล 2 ...
...
revealIndex=6, revealedTeam=TRUE  → ทีมสุดท้าย → ปุ่ม "ดูสรุปทั้งหมด"
```

### 7.4 Effects
- ขึ้นชื่อรางวัล: drumroll animation + fade-in + scale
- เปิดผลทีม: confetti burst + zoom รูป + ชื่อทีมตัวใหญ่
- 6 รางวัลครบ: grid 6 ใบสรุป + ฉลอง

### 7.5 ปุ่มควบคุม
- **เฉพาะ admin** เท่านั้นที่กดเปิด/ถัดไป
- บนหน้า results มี passcode-gated panel (admin token จาก localStorage)
- ถ้าไม่มี token → แสดงผลตาม state เท่านั้น (passive viewer)

---

## 8. API Contract (Apps Script)

ทุก request: `POST` body JSON `{ action, payload }`, content-type `text/plain`

| Action | Auth | Description |
|--------|------|-------------|
| `adminLogin` | – | { password } → { token } |
| `getJudgesList` | – | public — รายชื่อ + Voted flag |
| `getVoteContext` | – | { judgeId } → judge + teams + awards + votingOpen |
| `submitVote` | – | { judgeId, votes: [{awardId, teamId}] × 6 } |
| `getTeams` | – | public |
| `saveTeam` / `deleteTeam` / `reorderTeams` / `uploadImage` | admin | |
| `getJudges` / `saveJudge` / `deleteJudge` | admin | |
| `getDashboard` | admin | สถานะ + count |
| `setConfig` | admin | ถ้า `votingOpen` → FALSE จะ trigger auto-compute |
| `computeResults` | admin | manual recompute |
| `setResults` | admin | manual override |
| `getAdminResults` | admin | preview ก่อน publish |
| `publishResults` | admin | set `resultsPublished=TRUE`, `revealIndex=0` |
| `setRevealState` | admin | { revealIndex, revealedTeam } — สำหรับปุ่ม TV |
| `getRevealState` | – | public — sync TV |
| `getResults` | – | public — list ที่ reveal แล้ว (ตาม `revealIndex`) |
| `exportData` | admin | dump |

> ❌ ลบ: `submitRound1Vote`, `submitRound2Vote`, `getJudgeContext` (เก่า), `computeRound1`, `computeRound2`, `setRound1Winner`, `setRound2Results`, `resetJudgeToken`

---

## 9. Performance & Security

- HTTPS เท่านั้น
- ป้องกัน double-submit ผ่าน `Voted=TRUE` ใน LockService
- Apps Script LockService ทุก write
- `localStorage.judge_id` กัน user เลือกชื่อใหม่หลังโหวต (UX guard เท่านั้น — server เป็น source of truth)

## 10. แผนพัฒนา (V2 — 7 Phases)

ทำทีละ phase **หยุดรอ confirm หลังจบทุก phase**

1. **V1** ปรับ schema + spec + todo ⬅️ **ปัจจุบัน**
2. **V2** Apps Script (ลบรอบเก่า, เพิ่ม shared-link, auto-compute)
3. **V3** Judge UI ใหม่ (เลือกชื่อ → vote per award)
4. **V4** Admin UI (toggle เดียว + แสดงผล Hungarian)
5. **V5** Results TV Reveal Mode (state + effects)
6. **V6** ปรับ Export PDF/Excel
7. **V7** Test end-to-end + checklist
