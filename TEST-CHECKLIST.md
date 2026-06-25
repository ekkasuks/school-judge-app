# Test Checklist — V2

**ใช้ checklist นี้ตอน deploy จริง** เพื่อ verify ระบบทำงานครบทุก flow

> ✅ = ผ่าน, ❌ = พบปัญหา, ⚠️ = มีคำเตือน

---

## 0. Pre-Deploy Setup

- [ ] สร้าง Google Spreadsheet ใหม่ → คัดลอก `SPREADSHEET_ID`
- [ ] สร้าง Google Drive folder → ตั้ง sharing เป็น "Anyone with link" → คัดลอก `DRIVE_FOLDER_ID`
- [ ] เปิด Extensions → Apps Script → paste โค้ดทั้ง 9 ไฟล์
- [ ] ตั้ง Script Properties: `SPREADSHEET_ID`, `ADMIN_PASSWORD`, `DRIVE_FOLDER_ID`
- [ ] รัน `initSpreadsheet()` ใน Apps Script editor
- [ ] ตรวจ Spreadsheet:
  - [ ] มี 7 sheets: Teams, Judges, Awards, Votes, Results, Config, Sessions
  - [ ] Awards มี 6 แถว (A1–A6)
  - [ ] Judges มี 11 แถว (J01–J11) ตามชื่อ: ครูชมพู่, ครูอ้อม, ครูอ้อน, ครูดาว, ครูแนน, ครูน๊อต, ครูดิว, ครูเอก, ครูเบียร์, ครูสา, ผอ.
  - [ ] Config มี 7 keys: eventName, eventDate, votingOpen=FALSE, voteComputed=FALSE, resultsPublished=FALSE, revealIndex=0, revealedTeam=FALSE
- [ ] รัน `_testHungarian()` → ดู Logger: ควรเห็น `assignment = [0,1,2]`, `total votes = 8`
- [ ] (ทางเลือก) รัน `seedSampleTeams()` → 6 ทีมตัวอย่าง
- [ ] Deploy → New deployment → Web app
  - Execute as: **Me**
  - Who has access: **Anyone**
- [ ] คัดลอก Web App URL → ใส่ใน `js/config.js`
- [ ] Push ขึ้น GitHub → เปิด GitHub Pages → จด URL

---

## 1. Backend Smoke Test

### 1.1 doGet
- [ ] เปิด Web App URL ในเบราว์เซอร์ → ควรเห็น JSON: `{"ok":true,"message":"API running","version":"2.0.0"}`

### 1.2 adminLogin
```bash
curl -L -X POST '<WEB_APP_URL>' -H 'Content-Type: text/plain' \
  -d '{"action":"adminLogin","payload":{"password":"<ADMIN_PASSWORD>"}}'
```
- [ ] ตอบ `{"ok":true,"token":"..."}`
- [ ] ใส่ password ผิด → `{"ok":false,"error":"รหัสผ่านไม่ถูกต้อง"}`

### 1.3 getJudgesList
```bash
curl -L -X POST '<WEB_APP_URL>' -H 'Content-Type: text/plain' \
  -d '{"action":"getJudgesList","payload":{}}'
```
- [ ] ตอบ `{"ok":true,"judges":[11 รายการ],"votingOpen":false,"eventName":"..."}`
- [ ] รายชื่อตรงตาม seed (ครูชมพู่ → ผอ.)

---

## 2. Admin UI Flow

### 2.1 Login
- [ ] เปิด `admin.html` → เห็น login screen
- [ ] ใส่ password ผิด → toast error
- [ ] ใส่ password ถูก → เข้า app + Dashboard
- [ ] Refresh page → ยังคง login อยู่ (token ใน localStorage)
- [ ] กด "ออกจากระบบ" → กลับ login screen

### 2.2 Dashboard
- [ ] แสดง จำนวนทีม, กรรมการ, voted count
- [ ] Progress bar = 0/11
- [ ] State row 4 บรรทัด: votingOpen=ปิด, voteComputed=ยังไม่, resultsPublished=ยังไม่, reveal=0/6
- [ ] รีเฟรชอัตโนมัติทุก 5 วินาที (ดูใน DevTools Network)

### 2.3 ทีม (เพิ่ม/แก้ไข/ลบ/reorder)
- [ ] กด "+ เพิ่มทีม" → modal ปรากฏ
- [ ] กรอกข้อมูล + อัปโหลดรูป (ไฟล์ < 5MB) → preview → บันทึก
- [ ] ตรวจ Drive folder → มีรูปใหม่
- [ ] ทีมปรากฏใน list พร้อมรูป
- [ ] กด "แก้ไข" → ฟอร์มมีค่าเดิม → แก้ + บันทึก
- [ ] ลาก ☰ → เปลี่ยนลำดับ → toast success
- [ ] กด "ลบ" → confirm → ทีมหาย จาก list
- [ ] ตรวจ Sheet `Teams`: Status='Removed' (soft delete)
- [ ] เพิ่ม 6 ทีมจนครบ

### 2.4 กรรมการ
- [ ] เห็นรายชื่อ 11 คน + Order 1-11
- [ ] เห็น shared link card บนสุด + ปุ่ม 📋 คัดลอก
- [ ] กดคัดลอก → toast "คัดลอกลิงก์แล้ว"
- [ ] กด "แก้" → modal เปลี่ยนชื่อ → บันทึก → ชื่อใหม่ปรากฏ
- [ ] กด "+ เพิ่มกรรมการ" → modal → กรอกชื่อ → บันทึก → คนที่ 12 ปรากฏ (J12)
- [ ] ลบคนที่เพิ่ม → soft delete

### 2.5 ควบคุม - เปิดโหวต
- [ ] toggle `votingOpen` OFF → ON → ไม่มี confirm → toast success
- [ ] ตรวจ `Config.votingOpen=TRUE`
- [ ] Dashboard refresh แสดง "เปิดโหวต" badge เขียว

---

## 3. Judge Flow

### 3.1 Pick name
- [ ] เปิด shared link จากเครื่องอื่น (หรือ incognito)
- [ ] เห็น 11 ชื่อ → ทุกชื่อยัง enable (สีเขียว)
- [ ] ถ้า votingOpen=FALSE → เห็น banner "ยังไม่เปิดให้ลงคะแนน"

### 3.2 Vote
- [ ] กด "ครูชมพู่"
- [ ] เห็นการ์ดรางวัล "หลอนชุด ไม่หลอนยา" (รางวัลที่ 1/6)
- [ ] เห็น 6 ทีม + radio
- [ ] กด "ถัดไป" โดยไม่เลือก → toast "โปรดเลือกทีม"
- [ ] เลือกทีม 1 → border สีฟ้า + auto-save draft (ตรวจใน DevTools localStorage)
- [ ] กดถัดไป → รางวัลที่ 2
- [ ] รีเฟรชหน้า → กลับมาที่รางวัลเดิม + ทีมที่เลือกยังอยู่ (draft restore)
- [ ] โหวตให้ครบ 6 รางวัล → ถึงสุดท้ายปุ่ม "ตรวจสอบ →"
- [ ] เห็น review list 6 รางวัล + ทีมที่เลือก
- [ ] กดแถวใดแถวหนึ่ง → กระโดดกลับไปแก้ → กดถัดไปกลับมา review
- [ ] กด "✅ ส่งคะแนน" → confirm → ส่งสำเร็จ → state `done`
- [ ] เห็น "ขอบคุณ" + เวลาส่ง

### 3.3 Lock guard
- [ ] รีเฟรช judge.html อีกครั้ง → ยังเข้า state done (เพราะ Voted=TRUE)
- [ ] localStorage มี `judge_id` + ไม่มี `judge_draft_*`
- [ ] กลับไป pick-name → ครูชมพู่ ขึ้น "✅ ส่งแล้ว" สีเทา disabled

### 3.4 Other judges
- [ ] ทำซ้ำสำหรับครูอื่น (อย่างน้อย 3 คน) จากอุปกรณ์/incognito ต่าง
- [ ] Admin dashboard → progress bar เพิ่มขึ้น real-time

### 3.5 Change name
- [ ] กด "ไม่ใช่ฉัน?" → กลับ pick-name → ยังเห็น flag คนเดิม "ส่งแล้ว"

---

## 4. Compute (auto-trigger)

- [ ] (ต้องโหวตครบ 11 คนก่อน — หรืออย่างน้อยให้ใกล้ครบ)
- [ ] Admin → tab ควบคุม → toggle votingOpen ON → OFF
- [ ] confirm dialog "ปิดการโหวต? — ระบบจะคำนวณ Hungarian อัตโนมัติ"
- [ ] ยืนยัน → blocker → toast "คำนวณเสร็จ — บันทึกผล 6 รางวัล"
- [ ] Dashboard: voteComputed = ✅ คำนวณแล้ว
- [ ] ตรวจ Sheet `Results`: มี 6 แถว, AwardOrder 1-6
- [ ] tab "ผลคะแนน" → เห็น grid 6 การ์ดผู้ชนะ (badge "บันทึกแล้ว")

---

## 5. Admin Override (Swap)

- [ ] tab ผลคะแนน → กด "🔄 คำนวณใหม่" → confirm overwrite
- [ ] เห็น Vote Matrix (collapsible) + 6 การ์ด assignment + ผลรวม "Hungarian optimal"
- [ ] คลิกการ์ด A → border สีเหลือง "รอสลับ…"
- [ ] คลิกการ์ด B → swap! → 2 ใบเป็นสีชมพู "admin override"
- [ ] ผลรวมเสียงเปลี่ยน + badge "admin สลับ 1 คู่"
- [ ] กด "บันทึกผล" → confirm → toast success
- [ ] ตรวจ Sheet `Results`: Note = "admin override" ใน 2 แถว

---

## 6. Publish + TV Reveal Mode

### 6.1 Publish
- [ ] tab ควบคุม → toggle resultsPublished ON
- [ ] confirm "ประกาศผลให้สาธารณะ?"
- [ ] ยืนยัน → toast → Dashboard: resultsPublished = ✅

### 6.2 TV View (ไม่มี admin token)
- [ ] เปิด `results.html` ในเครื่องที่ไม่ login admin (incognito)
- [ ] เห็น state `intro` พร้อม "🎉 ประกาศผล" + "รอผู้ดำเนินรายการ..."
- [ ] ไม่มีแถบควบคุม admin ด้านล่าง

### 6.3 Admin TV Controls
- [ ] เปิด `results.html` ในเครื่องที่ login admin แล้ว
- [ ] เห็นแถบควบคุมล่างจอ "🛠 Admin" + ปุ่ม "เริ่มประกาศ"
- [ ] กด "🎤 เริ่มประกาศ" → state เปลี่ยนเป็น `award-name`
- [ ] เห็น "รางวัลที่ 1" + ชื่อรางวัล "หลอนชุด ไม่หลอนยา" + emoji 🏆 ใหญ่
- [ ] (Optional) ได้ยินเสียง drumroll (ต้อง click อะไรก่อนหน้านี้)
- [ ] TV view (incognito) อัปเดตตามภายใน 2 วินาที
- [ ] กด "🎉 เปิดผล" → confetti + ชื่อทีม + รูป + fanfare
- [ ] กด "← ย้อน" → กลับ award-name (revealedTeam=false)
- [ ] กด "🎉 เปิดผล" อีกครั้ง → award-team
- [ ] กด "➡️ รางวัลถัดไป" → รางวัลที่ 2
- [ ] วนจนครบ 6 รางวัล → ปุ่มเปลี่ยนเป็น "🎊 ดูสรุป"
- [ ] กด → state `final` + grid 6 ใบ + confetti
- [ ] กด "↻ เริ่มใหม่" → กลับ intro (revealIndex=0)

### 6.4 Unpublish
- [ ] Admin → toggle resultsPublished OFF
- [ ] results.html ทุกจอ → กลับ "not-published" state ภายใน 2 วินาที

---

## 7. Reopen Voting (Reset)

- [ ] toggle votingOpen ON หลังจากคำนวณ + publish แล้ว
- [ ] confirm "เปิดโหวตอีกครั้ง? — ผลที่คำนวณไว้และสถานะการประกาศจะถูก reset"
- [ ] ยืนยัน → toast "Reset แล้ว"
- [ ] ตรวจ Sheets:
  - [ ] Config: voteComputed=FALSE, resultsPublished=FALSE, revealIndex=0, revealedTeam=FALSE
  - [ ] Results: ว่าง
- [ ] ⚠️ Judges ที่โหวตแล้วยัง Voted=TRUE — ต้องลบ judges + เพิ่มใหม่ ถ้าอยากให้พวกเขาโหวตอีก

---

## 8. Export

### 8.1 PDF
- [ ] tab Export → กด "📄 Export PDF"
- [ ] blocker → ไฟล์ดาวน์โหลด `รายงานผล-YYYYMMDD.pdf`
- [ ] เปิด PDF → 3 หน้า:
  - [ ] หน้าปก: 🏆 + ชื่องาน + วันที่
  - [ ] สรุปรางวัล: 6 รางวัล + ทีม + เสียงโหวต
  - [ ] Vote Matrix 6×6 + เซลล์ฟ้า + ตาราง assignment
- [ ] ตัวอักษรไทยอ่านได้
- [ ] ถ้ามี admin override → note "admin override" ในตาราง

### 8.2 Excel
- [ ] กด "📊 Export Excel"
- [ ] ดาวน์โหลด `รายงานผล-YYYYMMDD.xlsx`
- [ ] เปิดใน Excel/Google Sheets → 4 ชีต:
  - [ ] สรุปผลรางวัล (6 แถว)
  - [ ] Vote Matrix (6 ทีม × 6 รางวัล + รวม)
  - [ ] กรรมการ (11 คน + สถิติ)
  - [ ] ทีม (6 ทีม)
- [ ] คอลัมน์กว้างพอ ตัวอักษรไทยถูก
- [ ] ทดสอบเปิดใน Google Sheets ด้วย

---

## 9. Mobile / Cross-device

- [ ] iPhone Safari: admin login + dashboard works
- [ ] iPhone Safari: judge.html — pick name + vote per award (อ่านได้)
- [ ] Android Chrome: เหมือนกัน
- [ ] results.html บน TV (Chrome cast / browser fullscreen) — ฟอนต์ใหญ่ดูสบาย
- [ ] confetti + animations ไม่กระตุก

---

## 10. Edge Cases

- [ ] ลบกรรมการที่โหวตแล้ว → vote rows + Voted flag ใน Sheet หายไป
- [ ] เพิ่มทีมที่ 7 → คำนวณ → error "จำนวนทีม (7) ต้องเท่ากับจำนวนรางวัล (6)" → toast warning
- [ ] เปิดโหวตขณะที่ยังไม่มีทีม → กรรมการเห็น error
- [ ] Session expire (8h) → admin ทำ action → toast error → auto-reload login
- [ ] Network drop → reconnect → state ยังถูก (re-poll)
- [ ] 2 admins ทำพร้อมกัน → LockService กันได้
- [ ] กรรมการ 11 คนกด submit พร้อมกัน → ทุกคนสำเร็จ ไม่มี race
- [ ] Reopen voting → Re-vote (admin ต้องลบ + เพิ่มกรรมการใหม่ก่อน)

---

## ผลการ Test

วันที่ test: __________
ผู้ test: __________
ผลรวม: ⬜ ผ่านทั้งหมด ⬜ มีปัญหา (โปรดระบุ)
